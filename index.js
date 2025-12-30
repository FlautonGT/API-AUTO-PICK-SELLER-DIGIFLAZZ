/**
 * =============================================================================
 * DIGIFLAZZ API SELLER PICKER v5.0
 * =============================================================================
 *
 * Node.js version - Runs in CMD/PowerShell without browser
 * Single run mode only (no cron)
 *
 * Features:
 * - Direct API calls (no DOM scraping)
 * - AI-powered seller selection (GPT-4.1-mini)
 * - Pre-filtering sellers before AI (hemat token)
 * - Auto product code generation
 * - File logging & reports
 * - Retry mechanism
 *
 * Usage:
 *   node index.js                    - Run all categories
 *   node index.js --test             - Test API connection only
 *   node index.js --category Pulsa   - Run specific category
 *
 * Author: Claude AI for Riko
 * Version: 5.0.0
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG, validateConfig, printConfig } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// LOGGER
// =============================================================================

const ensureDir = (dir) => {
    const fullPath = path.resolve(__dirname, dir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
    }
    return fullPath;
};

const logDir = ensureDir(CONFIG.LOG_DIR);
const reportDir = ensureDir(CONFIG.REPORT_DIR);

const getTimestamp = () => new Date().toISOString();
const getDateStr = () => new Date().toISOString().split('T')[0];
const getTimeStr = () => new Date().toLocaleTimeString('id-ID');
const getLogFile = () => path.join(logDir, `${getDateStr()}.log`);

const ICONS = {
    info: 'ℹ️ ', success: '✅', error: '❌', warning: '⚠️ ',
    ai: '🤖', skip: '⏭️ ', save: '💾', start: '🚀', stop: '🛑',
    api: '🌐', filter: '🔍', product: '📦', category: '📁', time: '⏱️ ',
};

const COLORS = {
    error: '\x1b[31m', warning: '\x1b[33m', success: '\x1b[32m',
    ai: '\x1b[36m', api: '\x1b[35m', reset: '\x1b[0m'
};

const log = (msg, type = 'info') => {
    const icon = ICONS[type] || 'ℹ️ ';
    const time = getTimeStr();
    const logLine = `[${time}] ${icon} ${msg}`;

    if (CONFIG.LOG_TO_CONSOLE) {
        const color = COLORS[type] || '';
        console.log(`${color}${logLine}${COLORS.reset}`);
    }

    if (CONFIG.LOG_TO_FILE) {
        fs.appendFileSync(getLogFile(), `[${getTimestamp()}] [${type.toUpperCase()}] ${msg}\n`);
    }
};

const logSeparator = (char = '═', length = 60) => log(char.repeat(length), 'info');

// =============================================================================
// UTILITIES
// =============================================================================

const wait = (ms) => new Promise(r => setTimeout(r, ms));
const formatRp = (n) => `Rp ${(n || 0).toLocaleString('id-ID')}`;

const retry = async (fn, maxRetries = CONFIG.MAX_RETRIES, delay = CONFIG.RETRY_DELAY) => {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (e) {
            lastError = e;
            if (i < maxRetries - 1) {
                log(`Retry ${i + 1}/${maxRetries}: ${e.message}`, 'warning');
                await wait(delay);
            }
        }
    }
    throw lastError;
};

// =============================================================================
// STATE
// =============================================================================

const STATE = {
    isRunning: false,
    categories: [],
    brands: [],
    types: [],
    stats: {
        total: 0, success: 0, skipped: 0, errors: 0,
        startTime: null, endTime: null,
        categoriesProcessed: 0, productsProcessed: 0,
        aiCalls: 0, apiCalls: 0,
    },
    processed: [],
    errors: [],
    skipped: [],
    generatedCodes: new Set(),
    usedSellers: new Map(),
};

const resetState = () => {
    STATE.isRunning = false;
    STATE.stats = {
        total: 0, success: 0, skipped: 0, errors: 0,
        startTime: null, endTime: null,
        categoriesProcessed: 0, productsProcessed: 0,
        aiCalls: 0, apiCalls: 0,
    };
    STATE.processed = [];
    STATE.errors = [];
    STATE.skipped = [];
    STATE.generatedCodes.clear();
    STATE.usedSellers.clear();
};

// =============================================================================
// API CLIENT
// =============================================================================

const api = {
    async request(endpoint, options = {}) {
        const url = endpoint.startsWith('http') ? endpoint : `${CONFIG.BASE_URL}${endpoint}`;

        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-XSRF-TOKEN': CONFIG.XSRF_TOKEN,
            'X-Requested-With': 'XMLHttpRequest',
            'Cookie': CONFIG.COOKIE,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://member.digiflazz.com/buyer-area/product',
            'Origin': 'https://member.digiflazz.com',
        };

        STATE.stats.apiCalls++;

        try {
            const res = await fetch(url, {
                ...options,
                headers: { ...headers, ...options.headers },
            });

            // Handle rate limit (429) - sleep 15 seconds
            if (res.status === 429) {
                log(`🚨 Rate limit detected (429) on ${endpoint}`, 'error');
                log(`⏸️  Sleeping for ${CONFIG.RATE_LIMIT_SLEEP_DURATION / 1000} seconds...`, 'warning');
                await wait(CONFIG.RATE_LIMIT_SLEEP_DURATION);
                log(`✅ Rate limit sleep completed, retrying...`, 'success');
                // Retry once after sleep
                return await this.request(endpoint, options);
            }

            // Handle other non-200 errors
            if (!res.ok) {
                const text = await res.text();
                const errorMsg = `HTTP ${res.status}: ${text.substring(0, 200)}`;
                
                // Check for KTP/PPh22 error (400) - seller mewajibkan KTP meski faktur: false
                if (res.status === 400) {
                    const errorLower = text.toLowerCase();
                    const isKTPError = errorLower.includes('ktp') || 
                                      errorLower.includes('pph22') || 
                                      errorLower.includes('bukti potong') ||
                                      errorLower.includes('verifikasi') ||
                                      errorLower.includes('mewajibkan buyer');
                    
                    if (isKTPError) {
                        // Return special error object untuk handle di processProductGroup
                        const error = new Error(errorMsg);
                        error.isKTPError = true;
                        error.statusCode = 400;
                        error.responseText = text;
                        throw error;
                    }
                }
                
                // For 5xx errors, wait a bit before throwing
                if (res.status >= 500) {
                    log(`⚠️ Server error (${res.status}), waiting ${CONFIG.DELAY_ON_ERROR}ms...`, 'warning');
                    await wait(CONFIG.DELAY_ON_ERROR);
                }
                
                throw new Error(errorMsg);
            }

            return await res.json();
        } catch (e) {
            // If it's a network error or timeout, wait before retrying
            if (e.message.includes('fetch') || e.message.includes('network') || e.message.includes('timeout')) {
                log(`⚠️ Network error, waiting ${CONFIG.DELAY_ON_ERROR}ms...`, 'warning');
                await wait(CONFIG.DELAY_ON_ERROR);
            }
            
            log(`API Error [${endpoint}]: ${e.message}`, 'error');
            throw e;
        }
    },

    async getCategories() {
        log('Fetching categories...', 'api');
        const res = await this.request('/category');
        return res.data || [];
    },

    async getBrands() {
        log('Fetching brands...', 'api');
        const res = await this.request('/brand');
        return res.data || [];
    },

    async getTypes() {
        log('Fetching types...', 'api');
        const res = await this.request('/type');
        return res.data || [];
    },

    async getProductsByCategory(categoryId) {
        const res = await this.request(`/category/${categoryId}/`);
        return res.data || [];
    },

    async getSellers(productRowId) {
        const res = await this.request(`/seller/${productRowId}`);
        return res.data || [];
    },

    async saveProduct(productData) {
        return await this.request('', {
            method: 'POST',
            body: JSON.stringify(productData),
        });
    },
};

// =============================================================================
// SELLER FILTERING
// =============================================================================

const isBlacklistedDescription = (desc) => {
    if (!CONFIG.ENABLE_DESCRIPTION_BLACKLIST) {
        return false;
    }

    if (!desc || typeof desc !== 'string') return true;
    if (desc.trim() === '' || desc.trim() === '-') return true;
    if (desc.length < CONFIG.MIN_DESCRIPTION_LENGTH) return true;

    const descLower = desc.toLowerCase();
    // Use DESCRIPTION_BLACKLIST as primary, fallback to BLACKLIST_KEYWORDS for backward compatibility
    const blacklist = (CONFIG.DESCRIPTION_BLACKLIST && CONFIG.DESCRIPTION_BLACKLIST.length > 0)
        ? CONFIG.DESCRIPTION_BLACKLIST 
        : (CONFIG.BLACKLIST_KEYWORDS || []);
    
    if (blacklist.some(kw => descLower.includes(kw.toLowerCase()))) {
        return true;
    }
    if (/^[a-z]+\s*\d+$/i.test(desc.trim())) {
        return true;
    }

    return false;
};

const passesRatingFilter = (seller) => {
    if (!CONFIG.ENABLE_RATING_PREFILTER) {
        return true;
    }

    const MIN_RATING_FILTER = CONFIG.MIN_RATING_PREFILTER || CONFIG.MIN_RATING || 3.0;

    // Rating 0 = belum ada rating, BOLEH lolos (bukan rating jelek)
    // Rating > 0 tapi < MIN_RATING = TIDAK lolos
    const rating = seller.reviewAvg || seller.rating || 0;
    if (rating === 0 || rating === null || rating === undefined) {
        return true; // No rating yet, OK
    }

    return rating >= MIN_RATING_FILTER;
};

const filterSellers = (sellers) => {
    const before = sellers.length;

    // STEP 1: Blacklist filter
    let filtered = sellers.filter(s => {
        const isBlacklisted = isBlacklistedDescription(s.deskripsi);
        if (isBlacklisted && CONFIG.LOG_FILTERED_SELLERS) {
            log(`   ❌ Blacklisted: ${s.seller} (desc: "${(s.deskripsi || '').substring(0, 30)}...")`, 'warning');
        }
        return !isBlacklisted;
    });

    if (CONFIG.VERBOSE && before !== filtered.length) {
        log(`  After blacklist filter: ${filtered.length} sellers (removed ${before - filtered.length})`, 'filter');
    }

    // STEP 2: Rating filter
    const beforeRatingCount = filtered.length;
    filtered = filtered.filter(s => {
        const passes = passesRatingFilter(s);
        if (!passes && CONFIG.LOG_FILTERED_SELLERS) {
            const rating = s.reviewAvg || s.rating || 0;
            log(`   ❌ Low rating: ${s.seller} (rating: ${rating})`, 'warning');
        }
        return passes;
    });

    if (CONFIG.VERBOSE && beforeRatingCount !== filtered.length) {
        log(`  After rating filter: ${filtered.length} sellers (removed ${beforeRatingCount - filtered.length})`, 'filter');
    }

    // STEP 3: Stock & Multi filter
    const beforeStockCount = filtered.length;
    filtered = filtered.filter(s => {
        const requireUnlimited = CONFIG.REQUIRE_UNLIMITED_STOCK || CONFIG.REQUIRE_UNLIMITED;
        if (requireUnlimited && !s.unlimited_stock) return false;
        if (CONFIG.REQUIRE_MULTI && !s.multi) return false;
        if (CONFIG.REQUIRE_STATUS_ACTIVE && !s.status) return false;
        
        // Filter faktur: jika REQUIRE_FP = false, hanya ambil seller dengan faktur = false
        // Ini penting karena ada seller yang faktur: false tapi tetap mewajibkan KTP
        if (CONFIG.REQUIRE_FP === false && s.faktur === true) {
            return false; // Skip seller yang pakai faktur jika kita tidak mau faktur
        }
        if (CONFIG.REQUIRE_FP === true && s.faktur === false) {
            return false; // Skip seller yang tidak pakai faktur jika kita mau faktur
        }
        
        return true;
    });

    if (CONFIG.VERBOSE && beforeStockCount !== filtered.length) {
        log(`  After stock/multi filter: ${filtered.length} sellers (removed ${beforeStockCount - filtered.length})`, 'filter');
    }

    // STEP 4: Fallback jika terlalu sedikit
    if (filtered.length < 3) {
        log('  ⚠️ Too few sellers after strict filter, relaxing requirements...', 'warning');
        // Relax: hanya filter blacklist, skip rating & multi
        filtered = sellers.filter(s => !isBlacklistedDescription(s.deskripsi));
        if (filtered.length < 3) {
            log('  ⚠️ Still too few, using all non-blacklisted sellers', 'warning');
        }
    }

    return filtered;
};

const prepareSellersForAI = (sellers) => {
    const sorted = [...sellers].sort((a, b) => a.price - b.price);
    const cheapest = sorted.slice(0, 10);
    const highRated = [...sellers]
        .filter(s => s.reviewAvg && s.reviewAvg >= 3)
        .sort((a, b) => (b.reviewAvg || 0) - (a.reviewAvg || 0))
        .slice(0, 5);
    const is24h = sellers
        .filter(s => s.start_cut_off === '00:00' && s.end_cut_off === '00:00')
        .slice(0, 5);

    const map = new Map();
    [...cheapest, ...highRated, ...is24h].forEach(s => {
        if (!map.has(s.id)) map.set(s.id, s);
    });

    return Array.from(map.values()).slice(0, CONFIG.MAX_AI_CANDIDATES);
};

// =============================================================================
// AI SELLER SELECTION
// =============================================================================

const SYSTEM_PROMPT_SELLER = `Kamu adalah asisten pemilihan seller PPOB. HANYA BALAS DENGAN JSON.

TUGAS: Pilih seller sesuai JUMLAH yang diminta.

=== STEP PEMILIHAN ===

STEP 1 - BLACKLIST (filter dulu, JANGAN pilih seller dengan ciri ini):
- Deskripsi mengandung: "testing", "test bersama admin", "sedang testing", "percobaan", "trial", "demo", "maintenance", "sedang testing bersama admin"
- Deskripsi mengandung: "pulsa transfer", "paket transfer" (bukan stok sendiri)
- Deskripsi terlalu singkat (< 15 karakter) atau hanya nama produk (contoh: "telkomsel 2000")
- Deskripsi kosong atau hanya "-"

STEP 2 - PILIH SELLER (dari yang lolos blacklist):

MAIN (Seller Utama):
- WAJIB: Harga TERMURAH dari yang lolos blacklist
- WAJIB: Deskripsi menyebut zona/coverage (nasional/all zone) ATAU speed ATAU stok
- Rating: Prioritaskan >= ${CONFIG.MIN_RATING}, atau jika rating 0, null, undefinied tetap masuk

${CONFIG.BACKUP1_SUFFIX} (Backup Stabilitas):
- WAJIB: Nama BERBEDA dari MAIN
- Prioritas 1: Rating TERTINGGI (>= ${CONFIG.MIN_RATING}) atau jika rating 0, null, undefinied tetap masuk
- Prioritas 2: Jika rating sama, pilih deskripsi terlengkap
- Prioritas 3: Jika bisa, cari deskripsi yang menyebut stabil atau tidak ada gangguan, jika tidak ada, tidak apa apa
- Harga: Boleh lebih mahal dari MAIN (wajar untuk kualitas), tapi kalau bisa, sedikit lebih mahal saja dari harga MAIN

${CONFIG.BACKUP2_SUFFIX} (Backup 24 Jam):
- WAJIB: h24=1 (24 jam operasional)
- WEAJIB: Cek c= berapa, jika h24=1 dan C bukan 00:00 - 00:00, maka ad kesalahan, cari yang c=00:00 - 00:00, itu adalah 24 jam operasional yang asli, karena kadang ada kesalahan
- WAJIB: Nama BERBEDA dari MAIN dan ${CONFIG.BACKUP1_SUFFIX}
- WAJIB: Lolos blacklist (deskripsi "testing", "testing bersama admin" dll TETAP DILARANG meski h24=1)
- Prioritas 1: deskripsi terbaik > harga termurah
- Prioritas 2: Rating TERTINGGI (>= ${CONFIG.MIN_RATING}) atau jika rating 0, null, undefinied tetap masuk
- Jika tidak ada seller yang menurutmu masuk kriteria, masukkan seller lain yang menurutmu bisa stabil seperti MAIN dan B1

=== KRITERIA DESKRIPSI BAGUS ===

Zona (salah satu):
- "Nasional", "All Zone", "Lintas Nasional", "Seluruh Indonesia"
- Tidak menyebut zona = netral (OK)
- "Zonasi" dengan "gagal alihkan/failover" = OK (ada backup)

Speed (salah satu):
- "Detikan", "1-10 detik", "Instant", "Proses Cepat"

Stok (salah satu):
- "Stok Sendiri", "Full NGRS", "Stok Terjamin", "Chip Sendiri"

Kualitas:
- "Valid 100%", "Terpercaya", "Garansi", "H2H", "Mochan"

=== ZONA TERBATAS (HINDARI jika ada alternatif) ===
- "Zona Jawa only", "Zona 1 saja", "Khusus Sumatera", "Jawa Bali only"
- TAPI BOLEH jika:
  • Ada "gagal alihkan", "failover", atau "alihkan otomatis"
  • Ada "NASIONAL" atau "All Zone" di deskripsi (override zona terbatas)

=== FORMAT RESPONSE ===

{
  "sellers": [
    {"type": "MAIN", "id": "xxx", "name": "XXX", "price": 1000},
    {"type": "${CONFIG.BACKUP1_SUFFIX}", "id": "yyy", "name": "YYY", "price": 1100},
    {"type": "${CONFIG.BACKUP2_SUFFIX}", "id": "zzz", "name": "ZZZ", "price": 1200}
  ],
  "reasoning": "penjelasan singkat pemilihan"
}

PENTING: Sertakan "id" seller untuk akurasi!

INGAT: Blacklist berlaku untuk SEMUA tipe termasuk ${CONFIG.BACKUP2_SUFFIX}. Seller "testing" DILARANG dipilih meski h24=1.`;

const callGPTAPI = async (userMessage) => {
    STATE.stats.aiCalls++;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CONFIG.GPT_API_KEY}`
        },
        body: JSON.stringify({
            model: CONFIG.GPT_MODEL,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT_SELLER },
                { role: 'user', content: userMessage }
            ],
            temperature: CONFIG.GPT_TEMPERATURE,
            max_tokens: CONFIG.GPT_MAX_TOKENS,
            response_format: { type: "json_object" }
        })
    });

    // Handle rate limit (429) - sleep 15 seconds
    if (res.status === 429) {
        log(`🚨 GPT API rate limit detected (429)`, 'error');
        log(`⏸️  Sleeping for ${CONFIG.RATE_LIMIT_SLEEP_DURATION / 1000} seconds...`, 'warning');
        await wait(CONFIG.RATE_LIMIT_SLEEP_DURATION);
        log(`✅ Rate limit sleep completed, retrying...`, 'success');
        // Retry once after sleep
        return await callGPTAPI(userMessage);
    }

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`GPT API ${res.status}: ${err.substring(0, 100)}`);
    }

    const data = await res.json();
    const content = data.choices[0]?.message?.content;

    if (!content) throw new Error('GPT returned empty response');
    return JSON.parse(content);
};

const getAISellers = async (sellers, productName, usedSellers = [], excludeSellerIds = []) => {
    // Filter out excluded sellers (yang bermasalah)
    const availableSellers = sellers.filter(s => !excludeSellerIds.includes(s.id));
    
    if (availableSellers.length === 0) {
        throw new Error('No sellers available after excluding problematic sellers');
    }
    
    const sellerData = availableSellers.map(s => ({
        id: s.id,
        n: s.seller,
        p: s.price,
        r: s.reviewAvg || 0,
        c: `${s.start_cut_off} - ${s.end_cut_off}`,
        h24: (s.start_cut_off === '00:00' && s.end_cut_off === '00:00') ? 1 : 0,
        d: (s.deskripsi || '-').substring(0, 100),
        faktur: s.faktur || false, // Include faktur info
    }));

    let userMessage = `PRODUCT: ${productName}
NEED: 3 sellers

SELLERS (id, n=name, p=price, r=rating, c=cutoff, h24=24jam, d=desc, faktur=true/false):
${JSON.stringify(sellerData)}

AVOID: ${usedSellers.slice(-5).join(', ') || '-'}`;

    // Add exclusion info if any
    if (excludeSellerIds.length > 0) {
        userMessage += `\n\nEXCLUDED SELLERS (JANGAN PILIH - bermasalah): ${excludeSellerIds.join(', ')}`;
        userMessage += `\nPilih seller LAIN yang tidak bermasalah!`;
    }

    userMessage += `\n\nChoose 3 DIFFERENT sellers with IDs.`;

    log('  Asking AI for seller selection...', 'ai');
    log(`  📊 Sending ${sellerData.length} candidates to AI`, 'info');
    if (excludeSellerIds.length > 0) {
        log(`  ⚠️ Excluding ${excludeSellerIds.length} problematic seller(s)`, 'warning');
    }
    
    const result = await retry(() => callGPTAPI(userMessage));

    if (!result.sellers || result.sellers.length === 0) {
        throw new Error('AI returned no sellers');
    }

    // Log AI reasoning if available
    if (result.reasoning) {
        log(`  🤖 AI Reasoning: ${result.reasoning}`, 'ai');
    }

    log(`  ✅ AI selected ${result.sellers.length} seller(s):`, 'success');
    result.sellers.forEach((s, idx) => {
        log(`     ${idx + 1}. ${s.type}: ${s.name || s.id} @ ${formatRp(s.price || 0)}`, 'info');
    });

    const enrichedSellers = result.sellers.map(aiSeller => {
        // Try to find by ID first (most accurate)
        let fullSeller = sellers.find(s => s.id === aiSeller.id);
        
        // Fallback: try by name (support both naming conventions)
        if (!fullSeller) {
            fullSeller = sellers.find(s => 
                (s.seller || s.name) === aiSeller.name
            );
        }
        
        // Stricter fuzzy match: only match if candidate name STARTS WITH seller name
        if (!fullSeller) {
            fullSeller = sellers.find(s => {
                const candidateName = (s.seller || s.name || '').toLowerCase();
                const sellerName = (aiSeller.name || '').toLowerCase();
                return candidateName.startsWith(sellerName) || candidateName === sellerName;
            });
            if (fullSeller) {
                log(`  💡 Found fuzzy match: "${aiSeller.name}" → "${fullSeller.seller || fullSeller.name}"`, 'info');
            }
        }

        if (!fullSeller) {
            log(`  ⚠️ Warning: Seller not found: ${aiSeller.name || aiSeller.id}`, 'warning');
            return null;
        }
        
        const enriched = { type: aiSeller.type, ...fullSeller };
        log(`  ✓ Enriched seller ${aiSeller.type}: ${enriched.seller || enriched.name} @ ${formatRp(enriched.price)} (Rating: ${enriched.reviewAvg || enriched.rating || 0})`, 'success');
        return enriched;
    }).filter(Boolean);

    if (enrichedSellers.length === 0) {
        throw new Error('No valid sellers from AI response');
    }

    log(`  📋 Final sellers: ${enrichedSellers.map(s => `${s.type}=${s.seller || s.name}@${formatRp(s.price)}`).join(', ')}`, 'ai');
    return enrichedSellers;
};

// =============================================================================
// PRODUCT CODE GENERATOR
// =============================================================================

const BRAND_CODES = {
    'telkomsel': 'TSEL', 'tsel': 'TSEL', 'indosat': 'ISAT', 'im3': 'ISAT',
    'xl': 'XL', 'axis': 'AXIS', 'tri': 'TRI', 'three': 'TRI',
    'smartfren': 'SMFR', 'by.u': 'BYU', 'byu': 'BYU',
    'mobile legend': 'ML', 'mobile legends': 'ML', 'mlbb': 'ML',
    'free fire': 'FF', 'freefire': 'FF', 'garena': 'FF',
    'pubg': 'PUBG', 'valorant': 'VALO', 'genshin': 'GI', 'honkai': 'HSR',
    'pln': 'PLN', 'token listrik': 'PLN',
    'gopay': 'GPAY', 'ovo': 'OVO', 'dana': 'DANA',
    'shopeepay': 'SPAY', 'shopee pay': 'SPAY', 'linkaja': 'LINK',
    'google play': 'GP', 'steam': 'STEAM', 'spotify': 'SPOT',
    'netflix': 'NFLX', 'vidio': 'VID', 'viu': 'VIU',
};

const generateProductCode = (productName, brandName = '') => {
    const nameLower = productName.toLowerCase();
    const brandLower = brandName.toLowerCase();

    let brand = '';
    for (const [key, code] of Object.entries(BRAND_CODES)) {
        if (nameLower.includes(key) || brandLower.includes(key)) {
            brand = code;
            break;
        }
    }
    if (!brand) {
        // Use first word, max 4 chars (same as old_file.js)
        const firstWord = productName.split(' ')[0].replace(/[^a-zA-Z]/g, '');
        brand = firstWord.substring(0, 4).toUpperCase() || 'PROD';
    }

    // Extract nominal - find numbers (same logic as old_file.js)
    const numbers = productName.match(/[\d.,]+/g);
    let nominal = '';
    if (numbers && numbers.length > 0) {
        // Get the number, remove dots/commas
        let numStr = numbers[0].replace(/[.,]/g, '');
        let num = parseInt(numStr);

        // Convert to K if >= 1000 (same as old_file.js)
        if (num >= 1000) {
            nominal = String(Math.floor(num / 1000));
        } else {
            nominal = String(num);
        }
    }

    // Use max length from config, but default to 10 if not set (same as old_file.js)
    const maxLength = CONFIG.CODE_MAX_LENGTH || 10;
    let baseCode = (brand + nominal).substring(0, maxLength);
    let code = baseCode;
    let suffix = 1;

    while (STATE.generatedCodes.has(code)) {
        code = baseCode + suffix++;
        if (suffix > 99) {
            code = baseCode + Date.now().toString().slice(-4);
            break;
        }
    }

    STATE.generatedCodes.add(code);
    STATE.generatedCodes.add(code + CONFIG.BACKUP1_SUFFIX);
    STATE.generatedCodes.add(code + CONFIG.BACKUP2_SUFFIX);

    return code || 'PROD';
};

// =============================================================================
// AI PRODUCT CODE GENERATION (GROQ)
// =============================================================================

const SYSTEM_PROMPT_PRODUCT_CODE = `Kamu asisten generator kode produk PPOB. HANYA BALAS DENGAN JSON.

TUGAS: Generate kode produk singkat berdasarkan KATEGORI, BRAND KATEGORI, BRAND, dan NAMA PRODUK.

=== ATURAN DASAR ===
- Maksimal 25 karakter (STRICT - tidak boleh lebih)
- Hanya HURUF KAPITAL dan ANGKA (tanpa simbol, spasi, atau underscore)
- Format: [BRAND][KATEGORI_SUFFIX][NOMINAL/UNIT][BRAND_KATEGORI]
- Kode harus UNIK dan MUDAH DIBACA

=== SINGKATAN BRAND (2-4 huruf) ===
- TELKOMSEL → TSEL
- INDOSAT → ISAT
- XL → XL
- AXIS → AXIS
- TRI/THREE → TRI
- SMARTFREN → SMFR
- GOOGLE PLAY → GP
- FREE FIRE → FF
- MOBILE LEGENDS → ML atau MLBB
- PUBG → PUBG
- (Brand lain → ambil 2-4 huruf pertama yang mudah dikenali)

=== FORMAT NOMINAL ===
- Ribuan: Hilangkan 000, tanpa suffix K
  - 5.000 / 5000 → 5
  - 10.000 → 10
  - 25.000 → 25
  - 100.000 → 100
- Puluhan ribu langsung: 15000 → 15, 50000 → 50
- Ratusan ribu: 100000 → 100, 500000 → 500

=== SUFFIX KATEGORI ===
- Pulsa → (tidak ada suffix)
  Contoh: TSEL5, ISAT10, XL25

- Data → D + angka + G (untuk GB)
  Contoh: TSELD1G, ISATD5G, XLD10G

- Voucher → V atau VC
  Contoh: GPV10, GPV50, GPV100

- Game → sesuai unit game
  - Diamond → DM (Contoh: ML86DM, FF100DM)
  - UC → UC (Contoh: PUBG60UC)
  - Coin → C (Contoh: HAGO100C)
  - Jika tidak ada unit khusus → langsung nominal

=== SUFFIX BRAND KATEGORI (jika bukan "Umum" atau "-") ===
- UnlimitedMax → UM (max 2 huruf untuk hemat karakter)
- Orbit → OB
- Freedom → FM  
- Conference → CF
- Flash → FL
- Combo → CB
- (Lainnya → 2 huruf pertama)

Penempatan: Di AKHIR kode
Contoh: TSELD1GUM (Telkomsel Data 1GB UnlimitedMax)

=== PRIORITAS JIKA > 10 KARAKTER ===
Jika kombinasi melebihi 10 karakter, potong dengan prioritas:
1. BRAND (wajib, 2-4 char)
2. NOMINAL/UNIT (wajib)
3. KATEGORI SUFFIX (D untuk data, V untuk voucher)
4. BRAND KATEGORI (bisa disingkat 1-2 huruf atau dihilangkan)

=== FORMAT RESPONSE ===

{"code":"TSEL5","reasoning":"Telkomsel Pulsa 5rb"}

HANYA balas dengan JSON di atas, tidak ada teks lain.`;

const callGroqAPI = async (userMessage, systemPrompt, modelName) => {
    if (!CONFIG.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY not set');
    }

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CONFIG.GROQ_API_KEY}`
        },
        body: JSON.stringify({
            model: modelName || 'llama-3.1-8b-instant',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ],
            temperature: 0.1,
            max_tokens: 1000,
            response_format: { type: "json_object" }
        })
    });

    // Handle rate limit (429)
    if (res.status === 429) {
        log(`🚨 Groq API rate limit detected (429)`, 'error');
        log(`⏸️  Sleeping for ${CONFIG.RATE_LIMIT_SLEEP_DURATION / 1000} seconds...`, 'warning');
        await wait(CONFIG.RATE_LIMIT_SLEEP_DURATION);
        log(`✅ Rate limit sleep completed, retrying...`, 'success');
        return await callGroqAPI(userMessage, systemPrompt, modelName);
    }

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Groq API ${res.status}: ${err.substring(0, 100)}`);
    }

    const data = await res.json();
    const content = data.choices[0]?.message?.content;

    if (!content) throw new Error('Groq returned empty response');
    return JSON.parse(content);
};

const sanitizeCode = (code) => {
    if (!code) return '';
    return code.replace(/[^A-Z0-9]/gi, '').toUpperCase().substring(0, 25);
};

const generateProductCodeAI = async (productName, brandName = '', categoryName = '', brandCategoryName = '', usedCodes = [], retryCount = 0) => {
    if (!CONFIG.GROQ_API_KEY || !CONFIG.GROQ_MODEL_PRODUCT_CODE) {
        log('⚠️ GROQ_API_KEY or GROQ_MODEL_PRODUCT_CODE not set, using script-based generation', 'warning');
        return generateProductCode(productName, brandName);
    }

    const MAX_RETRIES = 3;

    try {
        // Build comprehensive user message with all context
        let userMessage = `Product Name: ${productName}`;
        if (brandName) userMessage += `\nBrand: ${brandName}`;
        if (categoryName) userMessage += `\nKategori: ${categoryName}`;
        if (brandCategoryName) userMessage += `\nBrand Kategori: ${brandCategoryName}`;

        // Add info about used codes if this is a retry
        if (usedCodes.length > 0) {
            userMessage += `\n\nKODE YANG SUDAH DIPAKAI (JANGAN PAKAI INI): ${usedCodes.join(', ')}`;
            userMessage += `\nGenerate kode BARU yang BERBEDA dan UNIK!`;
        }

        const logMsg = retryCount > 0
            ? `🤖 Asking AI for product code (retry ${retryCount})...`
            : `🤖 Asking AI for product code...`;
        log(logMsg, 'ai');

        const response = await callGroqAPI(userMessage, SYSTEM_PROMPT_PRODUCT_CODE, CONFIG.GROQ_MODEL_PRODUCT_CODE);
        const result = typeof response === 'string' ? JSON.parse(response) : response;

        if (!result.code) {
            throw new Error('AI did not return a code');
        }

        const code = sanitizeCode(result.code);

        // Validate code is not empty
        if (!code || code.length === 0) {
            throw new Error('AI returned empty code');
        }

        // Check if this code (or its variants with suffix) is already used
        let isUsed = STATE.generatedCodes.has(code) || 
                    STATE.generatedCodes.has(code + CONFIG.BACKUP1_SUFFIX) ||
                    STATE.generatedCodes.has(code + CONFIG.BACKUP2_SUFFIX);

        if (isUsed && retryCount < MAX_RETRIES) {
            log(`⚠️ Code ${code} already used, retrying...`, 'warning');
            const allUsedCodes = [...usedCodes, code];
            return await generateProductCodeAI(productName, brandName, categoryName, brandCategoryName, allUsedCodes, retryCount + 1);
        }

        // If still duplicate after max retries, use script-based fallback
        if (isUsed && retryCount >= MAX_RETRIES) {
            log(`⚠️ AI retry limit reached, using fallback`, 'warning');
            return generateProductCode(productName, brandName);
        }

        log(`🤖 AI Generated: ${code} (${result.reasoning || 'no reasoning'})`, 'ai');
        return code;

    } catch (e) {
        log(`⚠️ AI code generation failed: ${e.message}, using fallback`, 'warning');
        return generateProductCode(productName, brandName);
    }
};

// =============================================================================
// MAIN PROCESSING
// =============================================================================

const processProductGroup = async (productName, rows, brandName, categoryName) => {
    log(`\n📦 ${productName} (${rows.length} rows)`, 'product');

    let sellers;
    try {
        sellers = await retry(() => api.getSellers(rows[0].id));
    } catch (e) {
        log(`  Failed to get sellers: ${e.message}`, 'error');
        STATE.errors.push({ product: productName, error: `Get sellers: ${e.message}` });
        STATE.stats.errors += rows.length;
        return;
    }

    log(`  Total sellers: ${sellers.length}`, 'info');
    sellers = filterSellers(sellers);

    if (sellers.length === 0) {
        log(`  No sellers after filter`, 'warning');
        STATE.skipped.push({ product: productName, reason: 'No sellers after filter' });
        STATE.stats.skipped += rows.length;
        return;
    }

    const candidates = prepareSellersForAI(sellers);
    log(`  Candidates: ${candidates.length}`, 'info');

    let selectedSellers;
    try {
        const usedKey = `${categoryName}-${brandName}`;
        const usedList = STATE.usedSellers.get(usedKey) || [];
        
        if (usedList.length > 0) {
            log(`  ⚠️ Avoiding recently used sellers: ${usedList.slice(-5).join(', ')}`, 'info');
        }
        
        selectedSellers = await getAISellers(candidates, productName, usedList);

        if (!STATE.usedSellers.has(usedKey)) STATE.usedSellers.set(usedKey, []);
        selectedSellers.forEach(s => STATE.usedSellers.get(usedKey).push(s.seller || s.name));
        
        log(`  ✅ Selected ${selectedSellers.length} seller(s) for ${rows.length} row(s)`, 'success');
    } catch (e) {
        log(`  ❌ AI failed: ${e.message}`, 'error');
        STATE.errors.push({ product: productName, error: `AI: ${e.message}` });
        STATE.stats.errors += rows.length;
        return;
    }

    const maxPrice = Math.ceil(Math.max(...selectedSellers.map(s => s.price)) * 1.05);
    log(`  💰 Max price calculated: ${formatRp(maxPrice)} (from seller prices: ${selectedSellers.map(s => formatRp(s.price)).join(', ')})`, 'info');
    
    // Generate product code - use AI if available, otherwise script-based
    let baseCode;
    log(`  🏷️ Generating product code...`, 'info');
    if (CONFIG.SET_PRODUCT_CODE) {
        if (CONFIG.GROQ_API_KEY && CONFIG.GROQ_MODEL_PRODUCT_CODE) {
            // Use AI generation with category and brand category context
            const brandCategoryName = rows[0].product_details?.brand_category?.name || 
                                     rows[0].product_details?.type?.name || 
                                     'Umum';
            log(`     Context: Category=${categoryName}, Brand=${brandName}, BrandCategory=${brandCategoryName}`, 'info');
            try {
                baseCode = await generateProductCodeAI(productName, brandName, categoryName, brandCategoryName);
                log(`     ✅ AI generated code: ${baseCode}`, 'success');
            } catch (e) {
                log(`     ⚠️ AI code generation failed: ${e.message}, using fallback`, 'warning');
                baseCode = generateProductCode(productName, brandName);
                log(`     🔄 Fallback code: ${baseCode}`, 'info');
            }
        } else {
            // Fallback to script-based
            log(`     Using script-based generation (Groq not configured)`, 'info');
            baseCode = generateProductCode(productName, brandName);
            log(`     ✅ Generated code: ${baseCode}`, 'success');
        }
    } else {
        // Use existing code or generate new one
        baseCode = rows[0].code || generateProductCode(productName, brandName);
        log(`     Using existing code: ${baseCode}`, 'info');
    }
    
    // Track generated codes to prevent duplicates
    STATE.generatedCodes.add(baseCode);
    STATE.generatedCodes.add(baseCode + CONFIG.BACKUP1_SUFFIX);
    STATE.generatedCodes.add(baseCode + CONFIG.BACKUP2_SUFFIX);
    
    log(`  📝 Code allocation plan:`, 'info');
    log(`     Row 1 (MAIN): ${baseCode}`, 'info');
    if (rows.length > 1) log(`     Row 2 (${CONFIG.BACKUP1_SUFFIX}): ${baseCode}${CONFIG.BACKUP1_SUFFIX}`, 'info');
    if (rows.length > 2) log(`     Row 3 (${CONFIG.BACKUP2_SUFFIX}): ${baseCode}${CONFIG.BACKUP2_SUFFIX}`, 'info');

    for (let i = 0; i < rows.length && i < selectedSellers.length; i++) {
        const row = rows[i];
        const seller = selectedSellers[i];

        let code = baseCode;
        if (seller.type === 'B1') code = baseCode + CONFIG.BACKUP1_SUFFIX;
        if (seller.type === 'B2') code = baseCode + CONFIG.BACKUP2_SUFFIX;

        log(`\n  🔧 Processing row ${i + 1}/${rows.length} (${seller.type}):`, 'info');
        log(`     Code: ${code}`, 'info');
        log(`     Seller: ${seller.seller || seller.name}`, 'info');
        log(`     Price: ${formatRp(seller.price)}`, 'info');
        log(`     Max Price: ${formatRp(maxPrice)}`, 'info');
        log(`     Rating: ${seller.reviewAvg || seller.rating || 0}`, 'info');
        log(`     Faktur: ${seller.faktur ? 'Ya' : 'Tidak'}`, 'info');
        log(`     Description: ${(seller.deskripsi || seller.description || '-').substring(0, 50)}...`, 'info');
        log(`     Cutoff: ${seller.start_cut_off || '00:00'} - ${seller.end_cut_off || '00:00'}`, 'info');
        
        let saveSuccess = false;
        let retryCount = 0;
        const maxRetriesForKTPError = 3;
        let currentSeller = seller;
        let problematicSellerIds = [];

        while (!saveSuccess && retryCount < maxRetriesForKTPError) {
            try {
                if (retryCount > 0) {
                    log(`     🔄 Retry attempt ${retryCount}/${maxRetriesForKTPError} with new seller...`, 'info');
                    log(`     New Seller: ${currentSeller.seller || currentSeller.name} @ ${formatRp(currentSeller.price)}`, 'info');
                } else {
                    log(`     💾 Saving to API...`, 'save');
                }
                
                const postData = {
                    id: row.id,
                    code: code,
                    max_price: maxPrice,
                    product: row.product,
                    product_id: row.product_id,
                    product_details: row.product_details,
                    description: row.description,
                    price: currentSeller.price,
                    stock: currentSeller.stock || 0,
                    start_cut_off: currentSeller.start_cut_off,
                    end_cut_off: currentSeller.end_cut_off,
                    unlimited_stock: currentSeller.unlimited_stock,
                    faktur: currentSeller.faktur || false, // Pastikan faktur sesuai seller
                    multi: currentSeller.multi,
                    multi_counter: currentSeller.multi_counter,
                    seller_sku_id: currentSeller.id,
                    seller_sku_id_int: currentSeller.id_int,
                    seller: currentSeller.seller,
                    seller_details: currentSeller.seller_details || {},
                    status: true,
                    last_update: row.last_update || '-',
                    status_sellerSku: currentSeller.status_sellerSku,
                    sort_order: row.sort_order,
                    seller_sku_desc: currentSeller.deskripsi || '-',
                    change: true,
                };

                await retry(() => api.saveProduct(postData));
                log(`     ✅ Saved successfully!`, 'success');
                saveSuccess = true;

                STATE.processed.push({
                    product: productName,
                    category: categoryName,
                    type: currentSeller.type || seller.type,
                    code,
                    seller: currentSeller.seller || currentSeller.name,
                    price: currentSeller.price,
                    maxPrice,
                    timestamp: getTimestamp(),
                });
                STATE.stats.success++;
                
            } catch (e) {
                // Check if it's KTP/PPh22 error (400)
                if (e.isKTPError && e.statusCode === 400) {
                    log(`     ⚠️ Seller "${currentSeller.seller || currentSeller.name}" requires KTP/PPh22 verification`, 'warning');
                    log(`     🔄 Requesting AI to replace problematic seller...`, 'info');
                    
                    // Add problematic seller to exclusion list
                    problematicSellerIds.push(currentSeller.id);
                    
                    // Get fresh sellers list
                    let freshSellers;
                    try {
                        freshSellers = await retry(() => api.getSellers(rows[0].id));
                        freshSellers = filterSellers(freshSellers);
                    } catch (err) {
                        log(`     ❌ Failed to get fresh sellers: ${err.message}`, 'error');
                        throw e; // Re-throw original error
                    }
                    
                    // Prepare candidates excluding problematic sellers
                    const freshCandidates = prepareSellersForAI(freshSellers);
                    const usedKey = `${categoryName}-${brandName}`;
                    const usedList = STATE.usedSellers.get(usedKey) || [];
                    
                    // Ask AI to replace problematic seller
                    try {
                        const replacementResult = await getAISellers(
                            freshCandidates, 
                            productName, 
                            usedList, 
                            problematicSellerIds
                        );
                        
                        // Find replacement for the same type (MAIN, B1, or B2)
                        const sellerType = currentSeller.type || seller.type;
                        const replacement = replacementResult.find(s => s.type === sellerType);
                        
                        if (!replacement) {
                            log(`     ❌ No replacement found for ${sellerType}`, 'error');
                            throw e; // Re-throw original error
                        }
                        
                        log(`     ✅ AI selected replacement: ${replacement.seller || replacement.name} @ ${formatRp(replacement.price)}`, 'success');
                        currentSeller = replacement;
                        retryCount++;
                        
                        // Update used sellers
                        if (!STATE.usedSellers.has(usedKey)) STATE.usedSellers.set(usedKey, []);
                        STATE.usedSellers.get(usedKey).push(replacement.seller || replacement.name);
                        
                        await wait(1000); // Wait before retry
                        continue; // Retry with new seller
                        
                    } catch (aiErr) {
                        log(`     ❌ AI replacement failed: ${aiErr.message}`, 'error');
                        throw e; // Re-throw original error
                    }
                } else {
                    // Other errors - just throw
                    log(`     ❌ Save failed: ${e.message}`, 'error');
                    STATE.errors.push({ product: productName, seller: currentSeller.seller || currentSeller.name, code, error: e.message });
                    STATE.stats.errors++;
                    break; // Exit retry loop
                }
            }
        }
        
        if (!saveSuccess) {
            log(`     ❌ Failed after ${retryCount} retry attempts`, 'error');
        }

        await wait(CONFIG.DELAY_BETWEEN_SAVES);
    }

    if (rows.length > selectedSellers.length) {
        const skipped = rows.length - selectedSellers.length;
        log(`  ⏭️  Skipped ${skipped} extra row(s) (max ${selectedSellers.length} sellers)`, 'skip');
        STATE.stats.skipped += skipped;
    }

    log(`  ✅ Completed: ${productName}`, 'success');
    log(`     Processed: ${Math.min(rows.length, selectedSellers.length)}/${rows.length} rows`, 'info');
    log(`${'═'.repeat(60)}\n`, 'info');

    STATE.stats.productsProcessed++;
};

const processCategory = async (category) => {
    logSeparator();
    log(`📁 Category: ${category.name}`, 'category');
    logSeparator('-', 40);

    let products;
    try {
        products = await retry(() => api.getProductsByCategory(category.id));
    } catch (e) {
        log(`Failed to get products: ${e.message}`, 'error');
        STATE.errors.push({ category: category.name, error: e.message });
        return;
    }

    log(`Products: ${products.length}`, 'info');
    if (products.length === 0) {
        log('No products in category', 'warning');
        return;
    }

    const groups = new Map();
    for (const p of products) {
        const key = p.product;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(p);
    }

    log(`Product groups: ${groups.size}`, 'info');

    const brandMap = new Map(STATE.brands.map(b => [b.id, b.name]));

    let groupIndex = 0;
    for (const [productName, rows] of groups) {
        if (!STATE.isRunning) {
            log('Stopped by user', 'stop');
            return;
        }

        groupIndex++;
        const brandId = rows[0].product_details?.brand?.id;
        const brandName = brandMap.get(brandId) || 'Unknown';

        await processProductGroup(productName, rows, brandName, category.name);
        STATE.stats.total += rows.length;

        if (groupIndex % 10 === 0) {
            log(`Progress: ${groupIndex}/${groups.size} products`, 'info');
        }

        await wait(CONFIG.DELAY_BETWEEN_PRODUCTS);
    }

    STATE.stats.categoriesProcessed++;
    await wait(CONFIG.DELAY_BETWEEN_CATEGORIES);
};

// =============================================================================
// REPORT
// =============================================================================

const generateReport = () => {
    const duration = STATE.stats.endTime - STATE.stats.startTime;
    const durationStr = `${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s`;

    const report = {
        summary: {
            startTime: STATE.stats.startTime?.toISOString(),
            endTime: STATE.stats.endTime?.toISOString(),
            duration: durationStr,
        },
        stats: {
            total: STATE.stats.total,
            success: STATE.stats.success,
            skipped: STATE.stats.skipped,
            errors: STATE.stats.errors,
            successRate: STATE.stats.total > 0
                ? ((STATE.stats.success / STATE.stats.total) * 100).toFixed(2) + '%'
                : '0%',
            categoriesProcessed: STATE.stats.categoriesProcessed,
            productsProcessed: STATE.stats.productsProcessed,
            aiCalls: STATE.stats.aiCalls,
            apiCalls: STATE.stats.apiCalls,
        },
        processed: STATE.processed,
        errors: STATE.errors,
        skipped: STATE.skipped,
    };

    const reportFile = path.join(reportDir, `report-${getDateStr()}-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    log(`Report saved: ${reportFile}`, 'save');

    const txtFile = path.join(reportDir, `summary-${getDateStr()}.txt`);
    const txtContent = `
DIGIFLAZZ PICKER REPORT
${'='.repeat(50)}
Date: ${getDateStr()}
Duration: ${durationStr}

STATS
-----
Total Rows: ${STATE.stats.total}
Success: ${STATE.stats.success}
Skipped: ${STATE.stats.skipped}
Errors: ${STATE.stats.errors}
Success Rate: ${report.stats.successRate}

Categories: ${STATE.stats.categoriesProcessed}
Products: ${STATE.stats.productsProcessed}
AI Calls: ${STATE.stats.aiCalls}
API Calls: ${STATE.stats.apiCalls}
${STATE.errors.length > 0 ? `
ERRORS (${STATE.errors.length})
------
${STATE.errors.map(e => `- ${e.product || e.category}: ${e.error}`).join('\n')}
` : ''}
${'='.repeat(50)}
`;
    fs.appendFileSync(txtFile, txtContent);

    return report;
};

// =============================================================================
// MAIN
// =============================================================================

const run = async (categoryFilter = null) => {
    if (STATE.isRunning) {
        log('Already running!', 'warning');
        return;
    }

    resetState();
    STATE.isRunning = true;
    STATE.stats.startTime = new Date();

    console.log('\n');
    logSeparator('═');
    log('🚀 DIGIFLAZZ API SELLER PICKER v5.0', 'start');
    log(`   Started at: ${STATE.stats.startTime.toLocaleString('id-ID')}`, 'time');
    logSeparator('═');

    printConfig();

    try {
        log('\nLoading metadata...', 'api');
        STATE.categories = await retry(() => api.getCategories());
        STATE.brands = await retry(() => api.getBrands());
        STATE.types = await retry(() => api.getTypes());

        log(`Loaded: ${STATE.categories.length} categories, ${STATE.brands.length} brands, ${STATE.types.length} types`, 'info');

        let categoriesToProcess = STATE.categories.filter(c =>
            !CONFIG.SKIP_CATEGORIES.includes(c.name)
        );

        const filter = categoryFilter || CONFIG.CATEGORIES_TO_PROCESS;
        if (filter && filter.length > 0) {
            categoriesToProcess = categoriesToProcess.filter(c =>
                filter.includes(c.name) || filter.includes(c.id)
            );
            log(`Filtered to ${categoriesToProcess.length} categories: ${filter.join(', ')}`, 'filter');
        }

        log(`\nProcessing ${categoriesToProcess.length} categories...`, 'info');

        for (const category of categoriesToProcess) {
            if (!STATE.isRunning) break;
            await processCategory(category);
        }

    } catch (e) {
        log(`Fatal error: ${e.message}`, 'error');
        console.error(e);
        STATE.errors.push({ fatal: true, error: e.message });
    }

    STATE.stats.endTime = new Date();
    STATE.isRunning = false;

    const report = generateReport();

    console.log('\n');
    logSeparator('═');
    log('🏁 COMPLETED!', 'success');
    log(`   Duration: ${report.summary.duration}`, 'time');
    log(`   Total: ${STATE.stats.total} | Success: ${STATE.stats.success} | Skip: ${STATE.stats.skipped} | Error: ${STATE.stats.errors}`, 'info');
    log(`   Success Rate: ${report.stats.successRate}`, 'info');
    logSeparator('═');
    console.log('\n');

    return report;
};

const testConnection = async () => {
    log('\nTesting API connection...', 'api');

    try {
        const categories = await api.getCategories();
        log(`✅ Categories: ${categories.length}`, 'success');

        const brands = await api.getBrands();
        log(`✅ Brands: ${brands.length}`, 'success');

        if (categories.length > 0) {
            const products = await api.getProductsByCategory(categories[0].id);
            log(`✅ Products (${categories[0].name}): ${products.length}`, 'success');

            if (products.length > 0) {
                const sellers = await api.getSellers(products[0].id);
                log(`✅ Sellers (${products[0].product}): ${sellers.length}`, 'success');
            }
        }

        log('\n✅ All API tests passed!', 'success');
        return true;
    } catch (e) {
        log(`\n❌ API test failed: ${e.message}`, 'error');
        return false;
    }
};

// =============================================================================
// CLI
// =============================================================================

const parseArgs = () => {
    const args = process.argv.slice(2);
    const options = { test: false, categories: null };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--test' || arg === '-t') {
            options.test = true;
        } else if (arg === '--category' || arg === '-c') {
            const next = args[i + 1];
            if (next && !next.startsWith('-')) {
                options.categories = next.split(',').map(c => c.trim());
                i++;
            }
        } else if (arg === '--help' || arg === '-h') {
            console.log(`
DIGIFLAZZ PICKER v5.0 - Usage:

  node index.js [options]

Options:
  --test, -t              Test API connection only
  --category, -c <name>   Process specific category (comma-separated)
  --help, -h              Show this help

Examples:
  node index.js
  node index.js --test
  node index.js --category Pulsa
  node index.js --category "Pulsa,Data,E-Money"
`);
            process.exit(0);
        }
    }

    return options;
};

// =============================================================================
// STARTUP
// =============================================================================

const main = async () => {
    console.log(`
╔════════════════════════════════════════════════════════════════════╗
║              DIGIFLAZZ API SELLER PICKER v5.0                      ║
║                    Node.js CMD Version                             ║
╚════════════════════════════════════════════════════════════════════╝
`);

    const configErrors = validateConfig();
    if (configErrors.length > 0) {
        log('Configuration errors:', 'error');
        configErrors.forEach(e => log(`  - ${e}`, 'error'));
        log('\nPlease check your .env file', 'error');
        process.exit(1);
    }

    const options = parseArgs();

    if (options.test) {
        const success = await testConnection();
        process.exit(success ? 0 : 1);
    }

    await run(options.categories);
};

process.on('SIGINT', () => {
    log('\nStopping...', 'stop');
    STATE.isRunning = false;
    setTimeout(() => process.exit(0), 1000);
});

main().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});