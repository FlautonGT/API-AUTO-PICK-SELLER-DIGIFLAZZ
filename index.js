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

    async getClosedProducts() {
        log('Fetching closed/error products...', 'api');
        const res = await this.request('/product/closed');
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

    // STEP 0: Basic validation filter (price must be valid and > 0)
    let filtered = sellers.filter(s => {
        const price = s.price || 0;
        if (!price || price <= 0 || isNaN(price)) {
            if (CONFIG.LOG_FILTERED_SELLERS) {
                log(`   ❌ Invalid price: ${s.seller} (price: ${price})`, 'warning');
            }
            return false;
        }
        if (!s.seller || !s.id) {
            if (CONFIG.LOG_FILTERED_SELLERS) {
                log(`   ❌ Missing seller name/id: ${s.seller || 'unknown'}`, 'warning');
            }
            return false;
        }
        return true;
    });

    if (CONFIG.VERBOSE && before !== filtered.length) {
        log(`  After basic validation: ${filtered.length} sellers (removed ${before - filtered.length})`, 'filter');
    }

    // STEP 1: Blacklist filter
    const beforeBlacklist = filtered.length;
    filtered = filtered.filter(s => {
        const isBlacklisted = isBlacklistedDescription(s.deskripsi);
        if (isBlacklisted && CONFIG.LOG_FILTERED_SELLERS) {
            log(`   ❌ Blacklisted: ${s.seller} (desc: "${(s.deskripsi || '').substring(0, 30)}...")`, 'warning');
        }
        return !isBlacklisted;
    });

    if (CONFIG.VERBOSE && beforeBlacklist !== filtered.length) {
        log(`  After blacklist filter: ${filtered.length} sellers (removed ${beforeBlacklist - filtered.length})`, 'filter');
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
        // Relax: filter blacklist + tetap pertahankan rating, REQUIRE_UNLIMITED_STOCK, REQUIRE_MULTI, dan REQUIRE_FP jika sudah di-set
        filtered = sellers.filter(s => {
            // Tetap filter blacklist
            if (isBlacklistedDescription(s.deskripsi)) return false;
            
            // Tetap pertahankan rating filter jika ENABLE_RATING_PREFILTER = true
            if (CONFIG.ENABLE_RATING_PREFILTER) {
                const passes = passesRatingFilter(s);
                if (!passes) return false;
            }
            
            // Tetap pertahankan REQUIRE_UNLIMITED_STOCK jika true (unlimited_stock harus true)
            const requireUnlimited = CONFIG.REQUIRE_UNLIMITED_STOCK || CONFIG.REQUIRE_UNLIMITED;
            if (requireUnlimited && !s.unlimited_stock) return false;
            
            // Tetap pertahankan REQUIRE_MULTI jika true (multi harus true)
            if (CONFIG.REQUIRE_MULTI && !s.multi) return false;
            
            // Tetap pertahankan REQUIRE_FP jika sudah di-set
            if (CONFIG.REQUIRE_FP === false && s.faktur === true) return false;
            if (CONFIG.REQUIRE_FP === true && s.faktur === false) return false;
            
            return true;
        });
        
        if (filtered.length < 3) {
            log('  ⚠️ Still too few, using all non-blacklisted sellers (with rating/unlimited/multi/faktur requirements)', 'warning');
        }
    }

    return filtered;
};

const prepareSellersForAI = (sellers, minCandidates = 3) => {
    // Determine minimum candidates needed
    // If sellers >= 3, send at least 3. If sellers < 3, send what's available
    const actualMin = sellers.length >= 3 ? Math.max(minCandidates, 3) : sellers.length;
    
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

    const candidates = Array.from(map.values());
    
    // Ensure minimum candidates: if sellers >= 3, send at least 3
    // If we have less than minCandidates, add more from sorted list
    if (candidates.length < actualMin && sellers.length >= actualMin) {
        // Add more sellers from sorted list to reach minimum
        for (const s of sorted) {
            if (!map.has(s.id)) {
                map.set(s.id, s);
                candidates.push(s);
                if (candidates.length >= actualMin) break;
            }
        }
    }
    
    // Return at least actualMin candidates (or all if less), but cap at MAX_AI_CANDIDATES
    return candidates.slice(0, Math.max(actualMin, Math.min(candidates.length, CONFIG.MAX_AI_CANDIDATES)));
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
- Multi Wajib ${CONFIG.REQUIRE_MULTI ? 'true' : 'false'}
- Faktur Wajib ${CONFIG.REQUIRE_FP ? 'true' : 'false'}

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
- WAJIB: Cek c= berapa, jika h24=1 dan C bukan 00:00 - 00:00, maka ad kesalahan, cari yang c=00:00 - 00:00, itu adalah 24 jam operasional yang asli, karena kadang ada kesalahan
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

const getAISellers = async (sellers, productName, usedSellers = [], excludeSellerIds = [], neededSellers = 3) => {
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
        multi: s.multi || false, // Include multi info
    }));
    
    let userMessage = `PRODUCT: ${productName}
NEED: ${neededSellers} seller(s)

SELLERS (id, n=name, p=price, r=rating, c=cutoff, h24=24jam, d=desc, faktur=true/false, multi=true/false):
${JSON.stringify(sellerData)}`;

    // Add exclusion info if any
    if (excludeSellerIds.length > 0) {
        userMessage += `\n\nEXCLUDED SELLERS (JANGAN PILIH - bermasalah): ${excludeSellerIds.join(', ')}`;
        userMessage += `\nPilih seller LAIN yang tidak bermasalah!`;
    }

    if (neededSellers === 1) {
        userMessage += `\n\nChoose 1 seller (MAIN only) with ID.`;
    } else if (neededSellers === 2) {
        userMessage += `\n\nChoose 2 DIFFERENT sellers (MAIN and ${CONFIG.BACKUP1_SUFFIX}) with IDs.`;
    } else {
        userMessage += `\n\nChoose 3 DIFFERENT sellers (MAIN, ${CONFIG.BACKUP1_SUFFIX}, and ${CONFIG.BACKUP2_SUFFIX}) with IDs.`;
    }

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

/**
 * Extract base code from product code (remove B1/B2 suffix)
 */
const getBaseCode = (code) => {
    if (!code || typeof code !== 'string') return '';
    let base = code.trim();
    if (base.endsWith(CONFIG.BACKUP1_SUFFIX)) {
        base = base.substring(0, base.length - CONFIG.BACKUP1_SUFFIX.length);
    } else if (base.endsWith(CONFIG.BACKUP2_SUFFIX)) {
        base = base.substring(0, base.length - CONFIG.BACKUP2_SUFFIX.length);
    }
    return base;
};

/**
 * Check if product row has valid seller
 */
const hasValidSeller = (row) => {
    return row.seller && 
           row.seller !== '-' && 
           row.price !== null && 
           row.price > 0 &&
           row.code && 
           row.code.trim() !== '';
};

/**
 * Check if product needs update (max_price > price, status false, or status_sellerSku !== 1)
 * Returns: { needsUpdate: boolean, needsNewSeller: boolean, reason: string }
 * - needsNewSeller = true: harus ganti seller ketiganya + update max price
 * - needsNewSeller = false: hanya update status saja dengan seller yang sama
 */
const needsUpdate = (row) => {
    // Check status_sellerSku (1 = aktif, bukan 1 = gangguan) - HARUS ganti seller
    if (row.status_sellerSku !== 1) {
        return { 
            reason: `status_sellerSku is ${row.status_sellerSku} (gangguan)`, 
            needsUpdate: true,
            needsNewSeller: true // Ganti seller ketiganya
        };
    }
    
    // Check max_price vs price - HARUS ganti seller + update max price
    if (row.max_price && row.price && row.max_price > row.price) {
        return { 
            reason: `max_price (${row.max_price}) > price (${row.price})`, 
            needsUpdate: true,
            needsNewSeller: true // Ganti seller ketiganya + update max price
        };
    }
    
    // Check status - HANYA update status dengan seller yang sama
    if (!row.status) {
        return { 
            reason: 'status is false', 
            needsUpdate: true,
            needsNewSeller: false // Hanya update status, seller tetap sama
        };
    }
    
    return { reason: 'no update needed', needsUpdate: false, needsNewSeller: false };
};

/**
 * Find all rows with same base code (for updating all 3 sellers together)
 */
const findRowsWithSameBaseCode = (allRows, baseCode) => {
    const matchingRows = [];
    for (const row of allRows) {
        const rowBaseCode = getBaseCode(row.code || '');
        if (rowBaseCode === baseCode) {
            matchingRows.push(row);
        }
    }
    return matchingRows;
};

const processProductGroup = async (productName, rows, brandName, categoryName) => {
    log(`\n📦 ${productName} (${rows.length} rows)`, 'product');
    log(`  📋 Mode: ${CONFIG.MODE}`, 'info');

    // Check if all rows already have valid sellers
    const rowsWithSeller = rows.filter(r => hasValidSeller(r));
    const rowsWithoutSeller = rows.filter(r => !hasValidSeller(r));
    
    // Initialize update flags (used throughout the function)
    let needsUpdateFlag = false;
    let needsNewSellerFlag = false;
    let updateReason = '';
    const rowsToUpdate = [];
    
    // Check rows without codes (for UNSET mode)
    const rowsWithoutCode = rows.filter(r => !r.code || r.code.trim() === '');
    
    // Apply mode-based filtering
    if (CONFIG.MODE === 'ALL') {
        // ALL mode: Process all rows, replace all sellers
        log(`  🔄 Mode ALL: Will replace all sellers`, 'info');
        // Don't skip, process everything
    } else if (CONFIG.MODE === 'UNSET') {
        // UNSET mode: Only process rows without codes
        if (rowsWithoutCode.length === 0) {
            log(`  ✅ All rows already have codes, skipping (UNSET mode)`, 'skip');
            STATE.skipped.push({ product: productName, reason: 'All rows have codes (UNSET mode)' });
            STATE.stats.skipped += rows.length;
            return;
        }
        log(`  🔄 Mode UNSET: Processing ${rowsWithoutCode.length} row(s) without codes`, 'info');
        rows = rowsWithoutCode; // Only process rows without codes
        rowsWithSeller = rows.filter(r => hasValidSeller(r));
        rowsWithoutSeller = rows.filter(r => !hasValidSeller(r));
    } else if (CONFIG.MODE === 'DISTURBANCE') {
        // DISTURBANCE mode: Only process if there's a disturbance (needs update)
        if (rowsWithSeller.length > 0) {
            log(`  📊 Status check: ${rowsWithSeller.length} row(s) already have seller(s)`, 'info');
            
            // Check if any row needs update
            for (const row of rowsWithSeller) {
                const check = needsUpdate(row);
                if (check.needsUpdate) {
                    needsUpdateFlag = true;
                    if (check.needsNewSeller) {
                        needsNewSellerFlag = true; // At least one needs new seller
                    }
                    updateReason = check.reason;
                    rowsToUpdate.push(row);
                    log(`  ⚠️ Row needs update: ${row.code || 'no code'} - ${check.reason}${check.needsNewSeller ? ' (ganti seller)' : ' (update status saja)'}`, 'warning');
                }
            }
            
            // If all rows have sellers and no update needed, skip
            if (rowsWithoutSeller.length === 0 && !needsUpdateFlag) {
                log(`  ✅ All rows already have valid sellers, skipping (DISTURBANCE mode)`, 'skip');
                STATE.skipped.push({ product: productName, reason: 'Already has valid sellers (DISTURBANCE mode)' });
                STATE.stats.skipped += rows.length;
                return;
            }
        } else if (rowsWithoutSeller.length > 0) {
            // No sellers at all - process them (this is also a "disturbance")
            log(`  🔄 Mode DISTURBANCE: Processing ${rowsWithoutSeller.length} row(s) without sellers`, 'info');
        }
    }
    
    // Re-check after mode filtering
    if (rowsWithSeller.length > 0 && CONFIG.MODE !== 'ALL') {
        // Check if any row needs update (for DISTURBANCE mode)
        if (CONFIG.MODE === 'DISTURBANCE' && !needsUpdateFlag && rowsWithoutSeller.length === 0) {
            log(`  ✅ No disturbances detected, skipping (DISTURBANCE mode)`, 'skip');
            STATE.skipped.push({ product: productName, reason: 'No disturbances (DISTURBANCE mode)' });
            STATE.stats.skipped += rows.length;
            return;
        }
        
        // If update needed with new seller (status_sellerSku !== 1 or max_price > price)
        if (needsUpdateFlag && needsNewSellerFlag && rowsToUpdate.length > 0) {
            const firstRowToUpdate = rowsToUpdate[0];
            const baseCode = getBaseCode(firstRowToUpdate.code || '');
            
            if (baseCode) {
                log(`  🔄 Update needed: ${updateReason} - GANTI SELLER KETIGANYA`, 'info');
                log(`  🔍 Base code: ${baseCode}, finding all rows with same base code...`, 'info');
                
                // Find all rows with same base code (including MAIN, B1, B2)
                const allRowsSameBase = findRowsWithSameBaseCode(rows, baseCode);
                log(`  📋 Found ${allRowsSameBase.length} row(s) with base code "${baseCode}"`, 'info');
                
                // Update all rows with same base code - will get new sellers
                rows = allRowsSameBase;
                log(`  🔄 Will update all ${rows.length} row(s) with NEW sellers + max price`, 'info');
            }
        } else if (needsUpdateFlag && !needsNewSellerFlag) {
            // Only status update needed - update with same seller
            log(`  🔄 Update needed: ${updateReason} - UPDATE STATUS SAJA (seller tetap sama)`, 'info');
            const statusUpdateRows = rowsToUpdate;
            if (statusUpdateRows.length > 0) {
                const firstRow = statusUpdateRows[0];
                const baseCode = getBaseCode(firstRow.code || '');
                
                if (baseCode) {
                    // Find all rows with same base code
                    const allRowsSameBase = findRowsWithSameBaseCode(rows, baseCode);
                    log(`  📋 Found ${allRowsSameBase.length} row(s) with base code "${baseCode}"`, 'info');
                    rows = allRowsSameBase;
                    log(`  🔄 Will update status to true for all ${rows.length} row(s) with same seller`, 'info');
                }
            }
        }
    }
    
    // Determine if we need new sellers or just status update
    const isStatusOnlyUpdate = needsUpdateFlag && !needsNewSellerFlag;
    
    // If some rows don't have sellers, process only those (unless we're doing status-only update)
    if (rowsWithoutSeller.length > 0 && rowsWithSeller.length > 0 && !isStatusOnlyUpdate) {
        log(`  📊 Processing ${rowsWithoutSeller.length} row(s) without seller (${rowsWithSeller.length} already have seller)`, 'info');
        rows = rowsWithoutSeller;
    }

    let selectedSellers = [];
    let maxPrice = 0;

    if (isStatusOnlyUpdate) {
        // Status update only - use existing sellers from rows
        log(`  📋 Status update only - using existing sellers`, 'info');
        selectedSellers = rows.map((row, idx) => {
            // Extract seller info from row
            return {
                type: idx === 0 ? 'MAIN' : (idx === 1 ? 'B1' : 'B2'),
                id: row.seller_sku_id,
                id_int: row.seller_sku_id_int,
                seller: row.seller,
                name: row.seller,
                price: row.price,
                stock: row.stock || 0,
                start_cut_off: row.start_cut_off,
                end_cut_off: row.end_cut_off,
                unlimited_stock: row.unlimited_stock,
                faktur: row.faktur || false,
                multi: row.multi,
                multi_counter: row.multi_counter,
                status_sellerSku: row.status_sellerSku,
                deskripsi: row.seller_sku_desc,
                description: row.seller_sku_desc,
                seller_details: row.seller_details || {},
            };
        });
        
        // Calculate max price from existing sellers
        const existingPrices = selectedSellers.map(s => s.price || 0).filter(p => p > 0);
        if (existingPrices.length > 0) {
            maxPrice = Math.ceil(Math.max(...existingPrices) * 1.05);
        } else {
            maxPrice = rows[0].max_price || 0;
        }
        
        log(`  ✅ Using existing sellers: ${selectedSellers.map(s => s.seller).join(', ')}`, 'success');
        log(`  💰 Max price: ${formatRp(maxPrice)}`, 'info');
    } else {
        // Need new sellers - get from API
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

        // Special case: If only 1 seller available, assign to all rows without AI
        if (sellers.length === 1) {
            log(`  ⚠️ Only 1 seller available - assigning to all rows without AI`, 'info');
            const singleSeller = sellers[0];
            selectedSellers = rows.map((row, idx) => {
                let type = 'MAIN';
                if (idx === 1 && rows.length >= 2) type = 'B1';
                else if (idx === 2 && rows.length >= 3) type = 'B2';
                
                return {
                    type,
                    id: singleSeller.id,
                    id_int: singleSeller.id_int,
                    seller: singleSeller.seller,
                    name: singleSeller.seller,
                    price: singleSeller.price,
                    stock: singleSeller.stock || 0,
                    start_cut_off: singleSeller.start_cut_off,
                    end_cut_off: singleSeller.end_cut_off,
                    unlimited_stock: singleSeller.unlimited_stock,
                    faktur: singleSeller.faktur || false,
                    multi: singleSeller.multi,
                    multi_counter: singleSeller.multi_counter,
                    status_sellerSku: singleSeller.status_sellerSku,
                    deskripsi: singleSeller.deskripsi,
                    description: singleSeller.deskripsi,
                    reviewAvg: singleSeller.reviewAvg,
                    rating: singleSeller.reviewAvg,
                    seller_details: singleSeller.seller_details || {},
                };
            });
            log(`  ✅ Assigned 1 seller to all ${selectedSellers.length} row(s)`, 'success');
        } else {
            // Multiple sellers: use AI selection
            // Determine minimum candidates: if sellers >= 3, send at least 3
            const minCandidates = sellers.length >= 3 ? 3 : sellers.length;
            const candidates = prepareSellersForAI(sellers, minCandidates);
            log(`  Candidates: ${candidates.length} (min: ${minCandidates})`, 'info');

            try {
                const usedKey = `${categoryName}-${brandName}`;
                const usedList = STATE.usedSellers.get(usedKey) || [];
                
                if (usedList.length > 0) {
                    log(`  ⚠️ Avoiding recently used sellers: ${usedList.slice(-5).join(', ')}`, 'info');
                }
                
                // Determine how many sellers are needed based on rows
                const neededSellers = rows.length >= 3 ? 3 : rows.length;
                selectedSellers = await getAISellers(candidates, productName, usedList, [], neededSellers);

                if (!STATE.usedSellers.has(usedKey)) STATE.usedSellers.set(usedKey, []);
                selectedSellers.forEach(s => STATE.usedSellers.get(usedKey).push(s.seller || s.name));
                
                log(`  ✅ Selected ${selectedSellers.length} seller(s) for ${rows.length} row(s)`, 'success');
            } catch (e) {
                log(`  ❌ AI failed: ${e.message}`, 'error');
                STATE.errors.push({ product: productName, error: `AI: ${e.message}` });
                STATE.stats.errors += rows.length;
                return;
            }
        }

        // Calculate max price: 5% above highest seller price
        const sellerPrices = selectedSellers.map(s => {
            const price = s.price || 0;
            if (!price || price <= 0 || isNaN(price)) {
                log(`  ⚠️ Warning: Invalid price for seller ${s.seller || s.name}: ${price}`, 'warning');
                return 0;
            }
            return price;
        }).filter(p => p > 0);
        
        if (sellerPrices.length === 0) {
            log(`  ❌ No valid prices found for sellers`, 'error');
            STATE.errors.push({ product: productName, error: 'No valid seller prices' });
            STATE.stats.errors += rows.length;
            return;
        }
        
        maxPrice = Math.ceil(Math.max(...sellerPrices) * 1.05);
        log(`  💰 Max price calculated: ${formatRp(maxPrice)} (from seller prices: ${selectedSellers.map(s => formatRp(s.price || 0)).join(', ')})`, 'info');
    }
    
    // Check which rows have codes and extract base code
    const rowsWithCodes = rows.map((r, idx) => ({
        index: idx,
        row: r,
        hasCode: r.code && r.code.trim() !== '',
        code: r.code ? r.code.trim() : '',
        baseCode: r.code ? getBaseCode(r.code.trim()) : ''
    }));
    
    const allRowsHaveCodes = rowsWithCodes.every(r => r.hasCode);
    const someRowsHaveCodes = rowsWithCodes.some(r => r.hasCode);
    
    let baseCode;
    
    if (someRowsHaveCodes) {
        // Extract base code from existing codes (remove B1/B2 prefix if present)
        log(`  🏷️ Some rows have codes - extracting base code...`, 'info');
        const existingCodes = rowsWithCodes.filter(r => r.hasCode).map(r => r.code);
        const existingBaseCodes = rowsWithCodes.filter(r => r.hasCode).map(r => r.baseCode).filter(b => b !== '');
        
        log(`     Existing codes: ${existingCodes.join(', ')}`, 'info');
        
        if (existingBaseCodes.length > 0) {
            // Use the most common base code
            const baseCodeCount = {};
            existingBaseCodes.forEach(b => baseCodeCount[b] = (baseCodeCount[b] || 0) + 1);
            const sorted = Object.entries(baseCodeCount).sort((a, b) => b[1] - a[1]);
            baseCode = sorted[0][0];
            log(`     ✅ Extracted base code: ${baseCode} (from ${existingCodes.length} existing code(s))`, 'success');
        } else {
            // If no valid base code found, try to extract from first code
            const firstCode = existingCodes[0];
            baseCode = getBaseCode(firstCode);
            if (baseCode) {
                log(`     ✅ Extracted base code: ${baseCode} (from ${firstCode})`, 'success');
            }
        }
    }
    
    // Generate base code only if no rows have codes
    // Note: Even if SET_PRODUCT_CODE is false, we still generate if code is null/empty
    if (!baseCode) {
        log(`  🏷️ No existing codes found - generating new product code...`, 'info');
        
        // Check if any row has null/empty code - if so, always generate (even if SET_PRODUCT_CODE is false)
        const hasEmptyCode = rows.some(r => !r.code || r.code.trim() === '');
        const shouldGenerate = CONFIG.SET_PRODUCT_CODE || hasEmptyCode;
        
        if (shouldGenerate) {
            if (CONFIG.GROQ_API_KEY && CONFIG.GROQ_MODEL_PRODUCT_CODE && CONFIG.SET_PRODUCT_CODE) {
                // Use AI generation with category and brand category context (only if SET_PRODUCT_CODE is true)
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
                if (!CONFIG.SET_PRODUCT_CODE && hasEmptyCode) {
                    log(`     SET_PRODUCT_CODE is false but code is empty - generating automatically`, 'info');
                } else {
                    log(`     Using script-based generation (Groq not configured)`, 'info');
                }
                baseCode = generateProductCode(productName, brandName);
                log(`     ✅ Generated code: ${baseCode}`, 'success');
            }
        } else {
            // Use existing code or generate new one
            baseCode = rows[0].code || generateProductCode(productName, brandName);
            log(`     Using existing code: ${baseCode}`, 'info');
        }
        
        // Track generated codes to prevent duplicates (only for new codes)
        STATE.generatedCodes.add(baseCode);
        STATE.generatedCodes.add(baseCode + CONFIG.BACKUP1_SUFFIX);
        STATE.generatedCodes.add(baseCode + CONFIG.BACKUP2_SUFFIX);
    }
    
    // Map rows by their existing codes to determine which seller type should go to which row
    // Create mapping: code -> row (based on id)
    const codeToRowMap = new Map();
    const rowIdToCodeMap = new Map();
    
    for (const row of rows) {
        if (row.code && row.code.trim() !== '') {
            const code = row.code.trim();
            codeToRowMap.set(code, row);
            rowIdToCodeMap.set(row.id, code);
        }
    }
    
    // Determine expected codes for each seller type
    const expectedCodeForMain = baseCode;
    const expectedCodeForB1 = baseCode + CONFIG.BACKUP1_SUFFIX;
    const expectedCodeForB2 = baseCode + CONFIG.BACKUP2_SUFFIX;
    
    // Map sellers to rows based on existing codes
    const sellerToRowMap = new Map();
    const usedRowIds = new Set(); // Track which rows have been assigned to prevent duplicate assignment
    
    for (const seller of selectedSellers) {
        // Skip B1 if only 1 row, skip B2 if only 1-2 rows
        if (seller.type === 'B1' && rows.length < 2) {
            log(`     ⏭️ Skipping ${seller.type} seller (only ${rows.length} row available)`, 'info');
            continue;
        }
        if (seller.type === 'B2' && rows.length < 3) {
            log(`     ⏭️ Skipping ${seller.type} seller (only ${rows.length} row(s) available)`, 'info');
            continue;
        }
        
        let targetRow = null;
        let code = '';
        
        // Try to find row with matching code for this seller type
        if (seller.type === 'MAIN') {
            code = expectedCodeForMain;
            targetRow = codeToRowMap.get(code);
        } else if (seller.type === 'B1') {
            code = expectedCodeForB1;
            targetRow = codeToRowMap.get(code);
        } else if (seller.type === 'B2') {
            code = expectedCodeForB2;
            targetRow = codeToRowMap.get(code);
        }
        
        // If row found with matching code, use it (but check if already used)
        if (targetRow && !usedRowIds.has(targetRow.id)) {
            usedRowIds.add(targetRow.id);
            const finalCodeForMapping = targetRow.code.trim();
            sellerToRowMap.set(seller.type, { row: targetRow, seller, code: finalCodeForMapping });
            continue;
        }
        
        // If no row found with matching code, find first available row without code
        // Assign sellers to different rows based on type order: MAIN -> row[0], B1 -> row[1], B2 -> row[2]
        if (!targetRow) {
            // First, try to assign based on seller type order to different rows
            let sellerIndex = -1;
            if (seller.type === 'MAIN') sellerIndex = 0;
            else if (seller.type === 'B1') sellerIndex = 1;
            else if (seller.type === 'B2') sellerIndex = 2;
            
            // Try to assign to row at sellerIndex if available and not used
            if (sellerIndex >= 0 && sellerIndex < rows.length) {
                const candidateRow = rows[sellerIndex];
                const rowCode = rowIdToCodeMap.get(candidateRow.id);
                if ((!rowCode || rowCode.trim() === '') && !usedRowIds.has(candidateRow.id)) {
                    targetRow = candidateRow;
                    usedRowIds.add(candidateRow.id);
                }
            }
            
            // If still no target row, find any available row without code
            if (!targetRow) {
                for (const row of rows) {
                    if (usedRowIds.has(row.id)) continue; // Skip already used rows
                    
                    const rowCode = rowIdToCodeMap.get(row.id);
                    if (!rowCode || rowCode.trim() === '') {
                        // This row doesn't have a code yet, assign seller here
                        targetRow = row;
                        usedRowIds.add(row.id);
                        break;
                    }
                }
            }
            
            // Generate code for this row based on seller type
            if (targetRow) {
                if (seller.type === 'B1') {
                    code = expectedCodeForB1;
                } else if (seller.type === 'B2') {
                    code = expectedCodeForB2;
                } else {
                    code = expectedCodeForMain;
                }
            }
        }
        
        if (targetRow) {
            // CRITICAL: Always use existing code from row if available, never change it
            // This prevents changing TSEL2B1 to TSEL2 when TSEL2 already exists
            const finalCodeForMapping = (targetRow.code && targetRow.code.trim() !== '') 
                ? targetRow.code.trim() 
                : code;
            sellerToRowMap.set(seller.type, { row: targetRow, seller, code: finalCodeForMapping });
        }
    }
    
    log(`  📝 Code allocation plan:`, 'info');
    if (allRowsHaveCodes) {
        log(`     All rows already have codes - mapping sellers to rows by code`, 'info');
    } else {
        log(`     Base code: ${baseCode}`, 'info');
        log(`     Will generate missing codes based on seller type`, 'info');
    }
    
    // Process each seller-row mapping (only process sellers that match available rows)
    let processedCount = 0;
    for (const [sellerType, mapping] of sellerToRowMap.entries()) {
        const { row, seller, code: mappedCode } = mapping;
        
        // Skip B1 if only 1 row, skip B2 if only 1-2 rows
        if (sellerType === 'B1' && rows.length < 2) continue;
        if (sellerType === 'B2' && rows.length < 3) continue;
        
        processedCount++;
        
        // CRITICAL: Always use existing code from row if available, never change it
        // This prevents changing TSEL2B1 to TSEL2 when TSEL2 already exists
        const finalCode = (row.code && row.code.trim() !== '') ? row.code.trim() : mappedCode;
        
        log(`     Mapping: ${sellerType} seller "${seller.seller || seller.name}" → Row ID ${row.id}`, 'info');
        if (row.code && row.code.trim() !== '') {
            log(`     ✅ Using existing code from row: "${finalCode}" (preserved)`, 'info');
        } else {
            log(`     🆕 Using new code: "${finalCode}"`, 'info');
        }

        // Validate seller price before processing
        const initialPrice = seller.price || 0;
        if (!initialPrice || initialPrice <= 0 || isNaN(initialPrice)) {
            log(`     ❌ Invalid seller price: ${initialPrice} for seller ${seller.seller || seller.name}`, 'error');
            STATE.errors.push({ product: productName, seller: seller.seller || seller.name, code: finalCode, error: `Invalid price: ${initialPrice}` });
            STATE.stats.errors++;
            continue; // Skip this row
        }

        log(`\n  🔧 Processing row ${processedCount}/${sellerToRowMap.size} (${sellerType}):`, 'info');
        log(`     Row ID: ${row.id}`, 'info');
        log(`     Code: ${finalCode} (${row.code && row.code.trim() !== '' ? 'existing' : 'new'})`, 'info');
        log(`     Seller: ${seller.seller || seller.name}`, 'info');
        log(`     Price: ${formatRp(initialPrice)}`, 'info');
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
                
                // Validate seller price before saving
                const sellerPrice = currentSeller.price || 0;
                if (!sellerPrice || sellerPrice <= 0 || isNaN(sellerPrice)) {
                    throw new Error(`Invalid seller price: ${sellerPrice} for seller ${currentSeller.seller || currentSeller.name}`);
                }
                
                const postData = {
                    id: row.id,
                    code: finalCode,
                    max_price: maxPrice,
                    product: row.product,
                    product_id: row.product_id,
                    product_details: row.product_details,
                    description: row.description,
                    price: sellerPrice,
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
                    status: true, // Always set to true
                    last_update: row.last_update || '-',
                    status_sellerSku: 1, // Always set to 1 (aktif, bukan gangguan)
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
                    code: finalCode,
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
                        freshSellers = await retry(() => api.getSellers(row.id));
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
                    STATE.errors.push({ product: productName, seller: currentSeller.seller || currentSeller.name, code: finalCode, error: e.message });
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

    if (sellerToRowMap.size < rows.length) {
        const skipped = rows.length - sellerToRowMap.size;
        log(`  ⏭️  Skipped ${skipped} extra row(s) (only ${sellerToRowMap.size} sellers mapped)`, 'skip');
        STATE.stats.skipped += skipped;
    }

    log(`  ✅ Completed: ${productName}`, 'success');
    log(`     Processed: ${sellerToRowMap.size}/${rows.length} rows`, 'info');
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

    let groups = new Map();
    for (const p of products) {
        const key = p.product;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(p);
    }
    
    // Filter out products that already have valid sellers (if configured)
    if (CONFIG.SKIP_IF_CODES_COMPLETE) {
        const filteredGroups = new Map();
        for (const [productName, rows] of groups) {
            // Check if all rows have valid sellers and don't need update
            const allHaveSeller = rows.every(r => hasValidSeller(r));
            const allValid = rows.every(r => {
                if (!hasValidSeller(r)) return false;
                const check = needsUpdate(r);
                return !check.needsUpdate;
            });
            
            if (allHaveSeller && allValid) {
                log(`⏭️ Skipping ${productName}: All rows have valid sellers (no update needed)`, 'skip');
                STATE.skipped.push({ product: productName, reason: 'Already has valid sellers (no update needed)' });
                STATE.stats.skipped += rows.length;
                continue;
            }
            
            filteredGroups.set(productName, rows);
        }
        groups = filteredGroups;
        log(`After skip filter: ${groups.size} product groups to process`, 'info');
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

        // MODE=DISTURBANCE: Process closed/error products instead of categories
        if (CONFIG.MODE === 'DISTURBANCE') {
            log('\n🔧 MODE=DISTURBANCE: Processing closed/error products...', 'info');
            
            let closedProducts;
            try {
                closedProducts = await retry(() => api.getClosedProducts());
            } catch (e) {
                log(`Failed to get closed products: ${e.message}`, 'error');
                STATE.errors.push({ error: `Get closed products: ${e.message}` });
                throw e;
            }

            log(`Found ${closedProducts.length} closed/error products`, 'info');
            
            if (closedProducts.length === 0) {
                log('No closed products to process', 'warning');
            } else {
                // Group products by product name (same as processCategory)
                let groups = new Map();
                for (const p of closedProducts) {
                    const key = p.product;
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key).push(p);
                }

                log(`Product groups: ${groups.size}`, 'info');

                const brandMap = new Map(STATE.brands.map(b => [b.id, b.name]));
                
                // Get category name from first product (if available)
                const categoryName = closedProducts[0]?.product_details?.category?.name || 'Closed Products';

                let groupIndex = 0;
                for (const [productName, rows] of groups) {
                    if (!STATE.isRunning) {
                        log('Stopped by user', 'stop');
                        break;
                    }

                    groupIndex++;
                    const brandId = rows[0].product_details?.brand?.id;
                    const brandName = brandMap.get(brandId) || 'Unknown';

                    await processProductGroup(productName, rows, brandName, categoryName);
                    STATE.stats.total += rows.length;

                    if (groupIndex % 10 === 0) {
                        log(`Progress: ${groupIndex}/${groups.size} products`, 'info');
                    }

                    await wait(CONFIG.DELAY_BETWEEN_PRODUCTS);
                }
            }
        } else {
            // MODE=ALL or MODE=UNSET: Process by categories (normal flow)
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