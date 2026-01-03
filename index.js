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
                
                // Log request body for debugging (especially for 400 errors)
                let requestBody = null;
                if (options.body) {
                    try {
                        requestBody = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
                    } catch (e) {
                        requestBody = options.body; // If not JSON, use as-is
                    }
                }
                
                // Log request body for errors
                if (requestBody) {
                    log(`  📤 Request Body:`, 'error');
                    log(`     ${JSON.stringify(requestBody, null, 2)}`, 'error');
                }
                
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
                        error.requestBody = requestBody; // Include request body in error
                        throw error;
                    }
                }
                
                // For 5xx errors, wait a bit before throwing
                if (res.status >= 500) {
                    log(`⚠️ Server error (${res.status}), waiting ${CONFIG.DELAY_ON_ERROR}ms...`, 'warning');
                    await wait(CONFIG.DELAY_ON_ERROR);
                }
                
                const error = new Error(errorMsg);
                error.requestBody = requestBody; // Include request body in error
                error.statusCode = res.status; // Include status code
                error.responseText = text; // Include response text for error checking
                throw error;
            }

            return await res.json();
        } catch (e) {
            // If it's a network error or timeout, wait before retrying
            if (e.message.includes('fetch') || e.message.includes('network') || e.message.includes('timeout')) {
                log(`⚠️ Network error, waiting ${CONFIG.DELAY_ON_ERROR}ms...`, 'warning');
                await wait(CONFIG.DELAY_ON_ERROR);
            }
            
            // Log request body if available (from error object or options)
            if (e.requestBody) {
                log(`  📤 Request Body:`, 'error');
                log(`     ${JSON.stringify(e.requestBody, null, 2)}`, 'error');
            } else if (options.body) {
                try {
                    const requestBody = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
                    log(`  📤 Request Body:`, 'error');
                    log(`     ${JSON.stringify(requestBody, null, 2)}`, 'error');
                } catch (parseErr) {
                    // Ignore parse errors
                }
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

    const MIN_RATING_FILTER = CONFIG.MIN_RATING;

    // Rating 0 = belum ada rating, BOLEH lolos (bukan rating jelek)
    // Rating > 0 tapi < MIN_RATING = TIDAK lolos
    const rating = seller.reviewAvg;
    if (rating === 0 || rating === null || rating === undefined) {
        return true; // No rating yet, OK
    }

    return rating >= MIN_RATING_FILTER;
};

const filterSellers = (sellers) => {
    const before = sellers.length;

    // STEP 0: Basic validation filter (price must be valid and > 0)
    let filtered = sellers.filter(s => {
        const price = s.price;
        if (!price || price <= 1 || isNaN(price)) {
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
        const requireUnlimited = CONFIG.REQUIRE_UNLIMITED_STOCK;
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
            const requireUnlimited = CONFIG.REQUIRE_UNLIMITED_STOCK;
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
- Deskripsi mengandung: "testing", "sedang testing", "maintenance", "sedang testing bersama admin"
- Deskripsi mengandung: "pulsa transfer", "paket transfer" (bukan stok sendiri)
- Deskripsi terlalu singkat atau hanya nama produk (contoh: "telkomsel 2000")
- Deskripsi kosong atau hanya "-"
- Prioritaskan Multi = True, jika tidak ada seller dengan Multi = False boleh dimasukkan
- Faktur Wajib ${CONFIG.REQUIRE_FP ? 'true' : 'false'}

STEP 2 - PILIH SELLER (dari yang lolos blacklist):

MAIN (Seller Utama):
- WAJIB: Harga TERMURAH dari data yang diberikan
- WAJIB: Deskripsi menyebut zona/coverage (nasional/all zone) ATAU speed ATAU stok

${CONFIG.BACKUP1_SUFFIX} (Backup Stabilitas):
- WAJIB: ID BERBEDA dari MAIN
- Prioritas: Jika bisa, cari deskripsi yang menyebut stabil atau tidak ada gangguan, jika tidak ada, tidak apa apa
- Harga: Boleh lebih mahal dari MAIN (wajar untuk kualitas), tapi kalau bisa, sedikit lebih mahal saja dari harga MAIN

${CONFIG.BACKUP2_SUFFIX} (Backup 24 Jam):
- WAJIB: h24=1 (24 jam operasional), jika tidak ada, cari yang mendekati cut off tercepat
- WAJIB: Cek c= berapa, jika h24=1 dan C bukan 00:00 - 00:00, maka ad kesalahan, cari yang c=00:00 - 00:00, itu adalah 24 jam operasional yang asli, karena kadang ada kesalahan
- WAJIB: ID BERBEDA dari MAIN dan ${CONFIG.BACKUP1_SUFFIX}
- Prioritas: deskripsi terbaik > harga termurah
- Jika tidak ada seller yang menurutmu masuk kriteria, masukkan seller lain yang menurutmu bisa stabil seperti MAIN dan ${CONFIG.BACKUP1_SUFFIX}

=== KRITERIA DESKRIPSI BAGUS ===

Zona (salah satu):
- "Nasional", "All Zone", "Lintas Nasional", "Seluruh Indonesia"
- Tidak menyebut zona = netral (OK)
- "Zonasi" dengan "gagal alihkan/failover" = OK (ada backup)

Speed (salah satu):
- "Detikan", "1-10 detik", "Instant", "Proses Cepat"

Stok (salah satu):
- "Stok Sendiri", "Full NGRS", "Stok Terjamin", "Chip Sendiri"

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

PENTING: Sertakan "id" seller untuk akurasi!`;

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
    // Filter out excluded sellers
    // excludeSellerIds can contain:
    // - Problematic sellers (KTP/PPh22 error) - should be permanently excluded
    // - Duplicate sellers (duplicate error) - excluded only for this retry, can be included again
    const availableSellers = sellers.filter(s => !excludeSellerIds.includes(s.id));
    
    if (availableSellers.length === 0) {
        throw new Error('No sellers available after excluding sellers');
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
        // excludeSellerIds can contain problematic sellers (KTP error) or just excluded sellers (duplicate error)
        log(`  ⚠️ Excluding ${excludeSellerIds.length} seller(s)`, 'warning');
    }
    
    const result = await retry(() => callGPTAPI(userMessage));

    if (!result.sellers || result.sellers.length === 0) {
        // Fallback: jika seller sedikit (<=5), auto-select tanpa AI
        if (availableSellers.length <= 5) {
            log(`  ⚠️ AI returned no sellers, but only ${availableSellers.length} seller(s) available. Auto-selecting...`, 'warning');
            
            // Sort by price (cheapest first), then by rating (highest first)
            const sorted = [...availableSellers].sort((a, b) => {
                const priceDiff = (a.price || 0) - (b.price || 0);
                if (priceDiff !== 0) return priceDiff;
                return (b.reviewAvg || 0) - (a.reviewAvg || 0);
            });
            
            // Take needed sellers
            const selected = sorted.slice(0, neededSellers);
            
            // Assign types: MAIN, B1, B2
            const typeMap = ['MAIN', CONFIG.BACKUP1_SUFFIX, CONFIG.BACKUP2_SUFFIX];
            const autoSelected = selected.map((seller, idx) => ({
                type: typeMap[idx] || 'MAIN',
                ...seller
            }));
            
            log(`  ✅ Auto-selected ${autoSelected.length} seller(s) (fallback):`, 'success');
            autoSelected.forEach((s, idx) => {
                log(`     ${idx + 1}. ${s.type}: ${s.seller || s.name} @ ${formatRp(s.price || 0)}`, 'info');
            });
            
            log(`  📋 Final sellers: ${autoSelected.map(s => `${s.type}=${s.seller || s.name}@${formatRp(s.price)}`).join(', ')}`, 'ai');
            return autoSelected;
        }
        
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
    
    // Add variation to make codes more unique
    const variations = [
        '', // Standard: brand + nominal
        'PUL', // Add PUL for pulsa
        'K', // Add K for thousands
        'RB', // Add RB for ribu
    ];
    
    // Randomly select a variation (or use timestamp-based for more randomness)
    const variationIndex = Math.floor(Math.random() * variations.length);
    const variation = variations[variationIndex];
    
    // Build base code with variation
    let baseCode = (brand + variation + nominal).substring(0, maxLength);
    
    // If still too long, try without variation
    if (baseCode.length > maxLength) {
        baseCode = (brand + nominal).substring(0, maxLength);
    }
    
    let code = baseCode;
    let suffix = 1;

    while (STATE.generatedCodes.has(code)) {
        // Try different variations if code is taken
        if (suffix <= variations.length) {
            const altVariation = variations[(variationIndex + suffix) % variations.length];
            code = (brand + altVariation + nominal).substring(0, maxLength);
            if (code.length > maxLength) {
                code = (brand + nominal).substring(0, maxLength);
            }
        } else {
            code = baseCode + suffix++;
        }
        
        if (suffix > 99) {
            // Use timestamp + random for maximum uniqueness
            const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
            code = baseCode.substring(0, Math.max(1, maxLength - 3)) + randomSuffix;
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
- Format: [BRAND][KATEGORI_SUFFIX][BRAND_KATEGORI][NOMINAL/UNIT]
- Kode harus UNIK dan MUDAH DIBACA
- PENTING: Gunakan VARIASI KREATIF! Jangan selalu format yang sama!
- Bisa singkat (5-8 char) atau agak panjang (10-15 char), sesuai kreativitas
- Contoh variasi untuk produk yang sama:
  * Telkomsel 5000: TSELP5, TSELPUL5, TSEL5K, TSEL5RB, TSEL5000, TSELP5K
  * Indosat 10000: ISATP10, ISATPUL10, ISAT10K, ISAT10RB, ISAT10000

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
- PLN → PLN
- NETFLIX → NFLX
- VIDIO → VID
- VIU → VIU
- (Brand lain → ambil 2-4 huruf pertama yang mudah dikenali sesuai nama brand mereka)

=== SUFFIX KATEGORI ===
- Pulsa → P
  Contoh: TSELP5, ISATP10, XLP25

- Data → D + angka
  Contoh: TSELD1, ISATD5G, XLD10

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
- Malaysia → MY
- Singapore → SG
- Filipina → PH
- Thailand → TH
- (Lainnya → 2 huruf pertama)

=== FORMAT NOMINAL (VARIASI KREATIF) ===
- Ribuan: Bisa berbagai format
  - 5.000 / 5000 → 5, 5K, 5RB, 5000, PUL5, P5
  - 10.000 → 10, 10K, 10RB, 10000, PUL10, P10
  - 25.000 → 25, 25K, 25RB, 25000, PUL25, P25
  - 100.000 → 100, 100K, 100RB, 100000, PUL100, P100
- Puluhan ribu: 15000 → 15, 15K, 15RB, 15000, PUL15, P15
- Ratusan ribu: 100000 → 100, 100K, 100RB, 100000, PUL100, P100
- Gunakan variasi: kadang singkat (5), kadang dengan suffix (5K, 5RB), kadang full (5000)

Penempatan: Di AKHIR kode
Contoh variasi: TSELD1GUM, TSEL1GUM, TSEL1GBUM, TSELD1G (Telkomsel Data 1GB UnlimitedMax)

=== PRIORITAS JIKA > 10 KARAKTER ===
Jika kombinasi melebihi 10 karakter, potong dengan prioritas:
1. BRAND (wajib, 2-4 char)
2. BRAND KATEGORI (bisa disingkat 1 huruf atau dihilangkan)
3. KATEGORI SUFFIX (P untuk pulsa, D untuk data, V untuk voucher)
4. NOMINAL/UNIT (wajib)

=== FORMAT RESPONSE ===

{"code":"TSELP5","reasoning":"Telkomsel Pulsa 5rb"}

HANYA balas dengan JSON di atas, tidak ada teks lain.`;

const callGroqAPI = async (userMessage, systemPrompt, modelName) => {
    if (!CONFIG.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY not set');
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
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
            temperature: 0.7, // Increased from 0.1 to 0.7 for more creativity and variation
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
            userMessage += `\nGunakan variasi kreatif: bisa singkat, bisa panjang, bisa dengan format berbeda!`;
            userMessage += `\nContoh variasi untuk Telkomsel 5000: TSELP5, TSELPUL5, TSEL5K, TSEL5RB, TSEL5000, dll`;
        } else {
            // Even for first attempt, ask for variety
            userMessage += `\n\nPENTING: Gunakan variasi kreatif dalam format kode!`;
            userMessage += `\nTidak harus selalu format standar, bisa variasi singkat/panjang sesuai kreativitas.`;
            userMessage += `\nContoh variasi untuk Telkomsel 5000: TSELP5, TSELPUL5, TSEL5K, TSEL5RB, TSEL5000, dll`;
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
 * Check code consistency across rows and fix if inconsistent
 * Returns: { isConsistent: boolean, baseCode: string, needsFix: boolean }
 */
const checkCodeConsistency = (rows) => {
    if (!rows || rows.length === 0) {
        return { isConsistent: true, baseCode: '', needsFix: false };
    }
    
    // Get all rows with codes
    const rowsWithCodes = rows.filter(r => r.code && r.code.trim() !== '');
    if (rowsWithCodes.length === 0) {
        return { isConsistent: true, baseCode: '', needsFix: false };
    }
    
    // Extract base codes and identify code types (MAIN, B1, B2) based on suffix, not array position
    const baseCodes = [];
    const rowCodes = [];
    const codeTypes = {
        main: null,  // Code without suffix
        b1: null,    // Code with B1 suffix
        b2: null     // Code with B2 suffix
    };
    
    rows.forEach((row) => {
        if (row.code && row.code.trim() !== '') {
            const code = row.code.trim();
            rowCodes.push(code);
            
            // Extract base code (remove B1/B2 suffix)
            const baseCode = getBaseCode(code);
            baseCodes.push(baseCode);
            
            // Identify code type based on suffix (not array position)
            if (code.endsWith(CONFIG.BACKUP2_SUFFIX)) {
                codeTypes.b2 = { code, baseCode, row };
            } else if (code.endsWith(CONFIG.BACKUP1_SUFFIX)) {
                codeTypes.b1 = { code, baseCode, row };
            } else {
                // No suffix = MAIN
                codeTypes.main = { code, baseCode, row };
            }
        }
    });
    
    const uniqueBaseCodes = [...new Set(baseCodes.filter(b => b !== ''))];
    
    // Check if all base codes are the same
    if (uniqueBaseCodes.length === 1) {
        const baseCode = uniqueBaseCodes[0];
        
        // Check if codes are correctly structured (MAIN, B1, B2) regardless of array order
        const hasMain = codeTypes.main !== null && codeTypes.main.baseCode === baseCode;
        const hasB1 = codeTypes.b1 !== null && codeTypes.b1.baseCode === baseCode;
        const hasB2 = codeTypes.b2 !== null && codeTypes.b2.baseCode === baseCode;
        
        // Check if all existing codes match their expected format
        let allCodesCorrect = true;
        if (codeTypes.main && codeTypes.main.code !== baseCode) {
            allCodesCorrect = false;
        }
        if (codeTypes.b1 && codeTypes.b1.code !== baseCode + CONFIG.BACKUP1_SUFFIX) {
            allCodesCorrect = false;
        }
        if (codeTypes.b2 && codeTypes.b2.code !== baseCode + CONFIG.BACKUP2_SUFFIX) {
            allCodesCorrect = false;
        }
        
        // If all base codes are the same and all codes are correctly formatted, it's consistent
        if (allCodesCorrect) {
            return { isConsistent: true, baseCode: baseCode, needsFix: false };
        }
        
        // Base codes are same but format is wrong (e.g., MAIN has B1 suffix)
        return { 
            isConsistent: false, 
            baseCode: baseCode, 
            needsFix: true,
            existingCodes: rowCodes,
            baseCodes: uniqueBaseCodes
        };
    }
    
    // Inconsistent: multiple base codes found
    // Use the most common base code (or first one if equal)
    const baseCodeCount = {};
    baseCodes.forEach(b => {
        if (b !== '') {
            baseCodeCount[b] = (baseCodeCount[b] || 0) + 1;
        }
    });
    
    const sorted = Object.entries(baseCodeCount).sort((a, b) => b[1] - a[1]);
    const mostCommonBaseCode = sorted.length > 0 ? sorted[0][0] : baseCodes[0] || '';
    
    return { 
        isConsistent: false, 
        baseCode: mostCommonBaseCode, 
        needsFix: true,
        existingCodes: rowCodes,
        baseCodes: uniqueBaseCodes
    };
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

    // Store original rows count for stats
    const originalRowsCount = rows.length;
    
    // Store original rows for reference (needed for code consistency check and error handling)
    const originalRows = [...rows];

    // Check code consistency across all rows (for all modes)
    const consistencyCheck = checkCodeConsistency(rows);
    if (!consistencyCheck.isConsistent && consistencyCheck.needsFix) {
        log(`  ⚠️ Code inconsistency detected!`, 'warning');
        log(`     Existing codes: ${consistencyCheck.existingCodes.join(', ')}`, 'info');
        log(`     Base codes found: ${consistencyCheck.baseCodes.join(', ')}`, 'info');
        log(`     Will use base code: ${consistencyCheck.baseCode}`, 'info');
        log(`  🔧 Fixing code consistency...`, 'info');
        
        // Track rows that need to be updated via API
        const rowsToUpdateViaAPI = [];
        
        // Identify which row is MAIN, B1, B2 based on code suffix (not array position)
        const rowTypeMap = new Map(); // Map: rowId -> { row, expectedCode, rowType }
        
        rows.forEach((row) => {
            if (row.code && row.code.trim() !== '') {
                const code = row.code.trim();
                const baseCode = getBaseCode(code);
                
                // Determine row type based on code suffix, not array position
                let rowType;
                let expectedCode;
                
                if (code.endsWith(CONFIG.BACKUP2_SUFFIX)) {
                    rowType = 'B2';
                    expectedCode = consistencyCheck.baseCode + CONFIG.BACKUP2_SUFFIX;
                } else if (code.endsWith(CONFIG.BACKUP1_SUFFIX)) {
                    rowType = 'B1';
                    expectedCode = consistencyCheck.baseCode + CONFIG.BACKUP1_SUFFIX;
                } else {
                    // No suffix = MAIN
                    rowType = 'MAIN';
                    expectedCode = consistencyCheck.baseCode;
                }
                
                // Only update if code is different
                if (code !== expectedCode) {
                    log(`     🔄 Row ${row.id} (${rowType}): "${code}" → "${expectedCode}"`, 'info');
                    rowTypeMap.set(row.id, { row, expectedCode, rowType });
                    rowsToUpdateViaAPI.push({ ...row, code: expectedCode, rowType, rowId: row.id });
                }
            }
        });
        
        // Update rows in memory
        rows = rows.map((row) => {
            const updateInfo = rowTypeMap.get(row.id);
            if (updateInfo) {
                return { ...row, code: updateInfo.expectedCode };
            }
            return row;
        });
        
        // Update rows via API if needed
        if (rowsToUpdateViaAPI.length > 0) {
            log(`  💾 Updating ${rowsToUpdateViaAPI.length} row(s) via API...`, 'info');
            
            for (const rowToUpdate of rowsToUpdateViaAPI) {
                try {
                    // Prepare postData for API update
                    const postData = {
                        id: rowToUpdate.id,
                        code: rowToUpdate.code,
                        max_price: 0, // Set to 0 as per requirement
                        product: rowToUpdate.product,
                        product_id: rowToUpdate.product_id,
                        product_details: rowToUpdate.product_details,
                        description: rowToUpdate.description,
                        price: rowToUpdate.price || 0,
                        stock: rowToUpdate.stock || 0,
                        start_cut_off: rowToUpdate.start_cut_off,
                        end_cut_off: rowToUpdate.end_cut_off,
                        unlimited_stock: rowToUpdate.unlimited_stock,
                        faktur: rowToUpdate.faktur || false,
                        multi: rowToUpdate.multi,
                        multi_counter: rowToUpdate.multi_counter,
                        seller_sku_id: rowToUpdate.seller_sku_id,
                        seller_sku_id_int: rowToUpdate.seller_sku_id_int,
                        seller: rowToUpdate.seller,
                        seller_details: rowToUpdate.seller_details || {},
                        status: rowToUpdate.status !== false, // Keep existing status or set to true
                        last_update: rowToUpdate.last_update || '-',
                        status_sellerSku: rowToUpdate.status_sellerSku || 1,
                        sort_order: rowToUpdate.sort_order,
                        seller_sku_desc: rowToUpdate.seller_sku_desc || '-',
                        change: true,
                    };
                    
                    await retry(() => api.saveProduct(postData));
                    log(`     ✅ Updated row ${rowToUpdate.rowId} (${rowToUpdate.rowType}): "${rowToUpdate.code}"`, 'success');
                    
                    // Wait between API calls
                    if (rowsToUpdateViaAPI.indexOf(rowToUpdate) < rowsToUpdateViaAPI.length - 1) {
                        await wait(CONFIG.DELAY_BETWEEN_SAVES);
                    }
                } catch (updateErr) {
                    log(`     ❌ Failed to update row ${rowToUpdate.rowId} (${rowToUpdate.rowType}): ${updateErr.message}`, 'error');
                    STATE.errors.push({ 
                        product: productName, 
                        row: rowToUpdate.id, 
                        code: rowToUpdate.code, 
                        error: `Code consistency update: ${updateErr.message}` 
                    });
                    STATE.stats.errors++;
                }
            }
        }
        
        log(`  ✅ Code consistency fixed`, 'success');
    }

    // Check if all rows already have valid sellers
    let rowsWithSeller = rows.filter(r => hasValidSeller(r));
    let rowsWithoutSeller = rows.filter(r => !hasValidSeller(r));
    
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
        if (rowsWithoutCode.length === 0 && !CONFIG.SET_PRODUCT_CODE && CONFIG.SKIP_IF_CODES_COMPLETE) {
            log(`  ✅ All rows already have codes, skipping (UNSET mode)`, 'skip');
            STATE.skipped.push({ product: productName, reason: 'All rows have codes (UNSET mode)' });
            STATE.stats.skipped += rows.length;
            return;
        }
        log(`  🔄 Mode UNSET: Processing ${rowsWithoutCode.length} row(s) without codes`, 'info');
        rows = rowsWithoutCode; // Only process rows without codes
        
        // If no rows without codes, skip
        if (rows.length === 0) {
            log(`  ✅ No rows without codes, skipping (UNSET mode)`, 'skip');
            STATE.skipped.push({ product: productName, reason: 'No rows without codes (UNSET mode)' });
            STATE.stats.skipped += originalRowsCount;
            return;
        }
        
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
    // Also collect existing seller IDs to exclude them from AI selection
    const existingSellerIds = [];
    if (rowsWithSeller.length > 0) {
        rowsWithSeller.forEach(row => {
            if (row.seller_sku_id) {
                existingSellerIds.push(row.seller_sku_id);
            }
        });
    }
    
    if (rowsWithoutSeller.length > 0 && rowsWithSeller.length > 0 && !isStatusOnlyUpdate) {
        log(`  📊 Processing ${rowsWithoutSeller.length} row(s) without seller (${rowsWithSeller.length} already have seller)`, 'info');
        if (existingSellerIds.length > 0) {
            log(`  📋 Excluding ${existingSellerIds.length} existing seller(s) from AI selection to avoid duplicates`, 'info');
        }
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
        
        // Max price: set to 0 (tidak ngaruh)
        maxPrice = 0;
        
        log(`  ✅ Using existing sellers: ${selectedSellers.map(s => s.seller).join(', ')}`, 'success');
        log(`  💰 Max price: ${formatRp(maxPrice)} (set to 0)`, 'info');
    } else {
        // Need new sellers - get from API
        // Check if rows is not empty
        if (!rows || rows.length === 0 || !rows[0] || !rows[0].id) {
            log(`  ❌ No rows available to get sellers`, 'error');
            STATE.errors.push({ product: productName, error: 'No rows available to get sellers' });
            STATE.stats.errors += rows.length || 1;
            return;
        }
        
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
                
                // Determine how many sellers are needed based on rows
                const neededSellers = rows.length >= 3 ? 3 : rows.length;
                
                // Exclude existing seller IDs to avoid duplicates (if some rows already have sellers)
                const excludeIds = existingSellerIds.length > 0 ? existingSellerIds : [];
                if (excludeIds.length > 0) {
                    log(`  ⚠️ Excluding ${excludeIds.length} existing seller(s) from AI selection to avoid duplicates`, 'info');
                }
                
                selectedSellers = await getAISellers(candidates, productName, usedList, excludeIds, neededSellers);
                
                // Double-check: if any selected seller matches existing sellers, request AI again with exclude
                if (rowsWithSeller.length > 0 && selectedSellers.length > 0) {
                    const duplicateSellers = selectedSellers.filter(aiSeller => {
                        return rowsWithSeller.some(row => row.seller_sku_id === aiSeller.id);
                    });
                    
                    if (duplicateSellers.length > 0) {
                        log(`  ⚠️ AI selected ${duplicateSellers.length} seller(s) that already exist in other rows`, 'warning');
                        duplicateSellers.forEach(dup => {
                            const matchingRow = rowsWithSeller.find(row => row.seller_sku_id === dup.id);
                            log(`     - "${dup.seller || dup.name}" (ID: ${dup.id}) already exists in row ${matchingRow?.id}`, 'warning');
                        });
                        
                        // Add duplicate seller IDs to exclude list and request AI again
                        const newExcludeIds = [...excludeIds, ...duplicateSellers.map(s => s.id)];
                        log(`  🔄 Requesting AI again with ${newExcludeIds.length} excluded seller(s)...`, 'info');
                        
                        try {
                            selectedSellers = await getAISellers(candidates, productName, usedList, newExcludeIds, neededSellers);
                            log(`  ✅ AI re-selected ${selectedSellers.length} seller(s) (excluding duplicates)`, 'success');
                        } catch (retryErr) {
                            log(`  ⚠️ AI re-selection failed: ${retryErr.message}`, 'warning');
                            // Continue with original selection (will cause duplicate error, but handled by duplicate error handler)
                        }
                    }
                }

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

        // Max price: set to 0 (tidak ngaruh)
        maxPrice = 0;
        log(`  💰 Max price: ${formatRp(maxPrice)} (set to 0)`, 'info');
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
    const hasEmptyCode = rows.some(r => !r.code || r.code.trim() === '');
    
    let baseCode;
    
    // Determine if we should generate new code or use existing
    // If SET_PRODUCT_CODE is true, always generate new code (even if existing codes exist)
    // If SET_PRODUCT_CODE is false, use existing code if available, generate only if empty
    const shouldGenerateNew = CONFIG.SET_PRODUCT_CODE || hasEmptyCode;
    
    if (someRowsHaveCodes && !shouldGenerateNew && CONFIG.SKIP_IF_CODES_COMPLETE) {
        // Extract base code from existing codes (only if we're NOT generating new code)
        // Priority: MAIN code first, then B1, then B2
        log(`  🏷️ Some rows have codes - extracting base code...`, 'info');
        const existingCodes = rowsWithCodes.filter(r => r.hasCode).map(r => r.code);
        
        // Check if MAIN row (first row) has code - prioritize MAIN
        const mainRow = rows[0];
        if (mainRow && mainRow.code && mainRow.code.trim() !== '') {
            const mainCode = mainRow.code.trim();
            baseCode = getBaseCode(mainCode);
            if (baseCode) {
                log(`     ✅ Extracted base code from MAIN: ${baseCode} (from ${mainCode})`, 'success');
                log(`     📝 B1 and B2 will follow MAIN base code: ${baseCode}`, 'info');
            }
        }
        
        // If MAIN doesn't have code, try to extract from other rows
        if (!baseCode) {
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
    }
    
    // Generate base code if:
    // 1. No baseCode extracted yet (no existing codes OR should generate new)
    // 2. SET_PRODUCT_CODE is true (always generate new, even if existing codes exist)
    // 3. Has empty codes (need to fill them)
    if (!baseCode || shouldGenerateNew) {
        if (baseCode && shouldGenerateNew && CONFIG.SET_PRODUCT_CODE) {
            log(`  🏷️ SET_PRODUCT_CODE=true: Generating new code (existing: ${baseCode})...`, 'info');
        } else if (baseCode && shouldGenerateNew && hasEmptyCode) {
            log(`  🏷️ Some rows have empty codes - generating new product code...`, 'info');
        } else if (!baseCode) {
            log(`  🏷️ No existing codes found - generating new product code...`, 'info');
        }
        
        if (shouldGenerateNew) {
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
            // Use existing code or generate new one (fallback)
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
    
    log(`  🔑 Base code for mapping: ${baseCode} (SET_PRODUCT_CODE=${CONFIG.SET_PRODUCT_CODE})`, 'info');
    log(`     Expected codes: MAIN=${expectedCodeForMain}, B1=${expectedCodeForB1}, B2=${expectedCodeForB2}`, 'info');
    
    // Map sellers to rows based on existing codes
    const sellerToRowMap = new Map();
    const usedRowIds = new Set(); // Track which rows have been assigned to prevent duplicate assignment
    
    log(`  🔄 Mapping ${selectedSellers.length} seller(s) to ${rows.length} row(s)...`, 'info');
    
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
            log(`     ✅ Mapped ${seller.type} to row ${targetRow.id} (matched code: ${code})`, 'info');
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
                    log(`     ✅ Mapped ${seller.type} to row ${targetRow.id} (by index ${sellerIndex}, no existing code)`, 'info');
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
                        log(`     ✅ Mapped ${seller.type} to row ${targetRow.id} (first available, no existing code)`, 'info');
                        break;
                    }
                }
            }
            
            // If STILL no target row (all rows have codes or are used), assign to first available row anyway
            // This ensures seller is always assigned even if all rows have codes
            if (!targetRow) {
                for (const row of rows) {
                    if (!usedRowIds.has(row.id)) {
                        targetRow = row;
                        usedRowIds.add(row.id);
                        log(`     ⚠️ Mapped ${seller.type} to row ${targetRow.id} (fallback: all rows have codes, using first available)`, 'warning');
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
            // Determine code for mapping:
            // - If SET_PRODUCT_CODE=true, always use new generated code
            // - If SET_PRODUCT_CODE=false, use existing code if available, otherwise use new code
            let finalCodeForMapping;
            if (CONFIG.SET_PRODUCT_CODE) {
                // SET_PRODUCT_CODE=true: Always use new generated code
                finalCodeForMapping = code;
            } else if (targetRow.code && targetRow.code.trim() !== '') {
                // SET_PRODUCT_CODE=false: Use existing code if available
                finalCodeForMapping = targetRow.code.trim();
            } else {
                // No existing code: Use new code
                finalCodeForMapping = code;
            }
            sellerToRowMap.set(seller.type, { row: targetRow, seller, code: finalCodeForMapping });
        } else {
            log(`     ❌ ERROR: Could not map ${seller.type} seller "${seller.seller || seller.name}" to any row!`, 'error');
        }
    }
    
    if (sellerToRowMap.size === 0) {
        log(`  ❌ ERROR: No sellers were mapped to rows! This should not happen.`, 'error');
        log(`     Selected sellers: ${selectedSellers.length}, Rows: ${rows.length}`, 'error');
        STATE.errors.push({ product: productName, error: 'Failed to map sellers to rows' });
        STATE.stats.errors += rows.length;
        return;
    }
    
    log(`  📝 Code allocation plan:`, 'info');
    if (allRowsHaveCodes && CONFIG.SKIP_IF_CODES_COMPLETE) {
        log(`     All rows already have codes - mapping sellers to rows by code`, 'info');
    } else {
        log(`     Base code: ${baseCode}`, 'info');
        log(`     Will generate missing codes based on seller type`, 'info');
    }
    
    // Process each seller-row mapping (only process sellers that match available rows)
    // Helper function to process sellers with retry logic for duplicate seller errors
    // Track saved rows to update them if code changes
    const savedRowsMap = new Map(); // Map: rowId -> { row, seller, code, sellerType }
    
    const processSellersWithRetry = async (currentSellerToRowMap, retryCount = 0) => {
        const maxDuplicateSellerRetries = 3;
        let processedCount = 0;
        
        try {
            for (const [sellerType, mapping] of currentSellerToRowMap.entries()) {
        const { row, seller, code: mappedCode } = mapping;
        
        // Skip B1 if only 1 row, skip B2 if only 1-2 rows
        if (sellerType === 'B1' && rows.length < 2) continue;
        if (sellerType === 'B2' && rows.length < 3) continue;
        
        processedCount++;
        
        // Determine which code to use:
        // - If SET_PRODUCT_CODE=true, always use new generated code (mappedCode)
        // - If SET_PRODUCT_CODE=false, use existing code if available, otherwise use mappedCode
        // - If SKIP_IF_CODES_COMPLETE=true and row has code, preserve existing code (unless SET_PRODUCT_CODE=true)
        let finalCode;
        if (CONFIG.SET_PRODUCT_CODE) {
            // SET_PRODUCT_CODE=true: Always use new generated code
            finalCode = mappedCode;
        } else if (row.code && row.code.trim() !== '') {
            // SET_PRODUCT_CODE=false: Use existing code if available
            finalCode = row.code.trim();
        } else {
            // No existing code: Use mapped code
            finalCode = mappedCode;
        }
        
        log(`     Mapping: ${sellerType} seller "${seller.seller || seller.name}" → Row ID ${row.id}`, 'info');
        if (row.code && row.code.trim() !== '' && !CONFIG.SET_PRODUCT_CODE && CONFIG.SKIP_IF_CODES_COMPLETE) {
            log(`     ✅ Using existing code from row: "${finalCode}" (preserved)`, 'info');
        } else if (CONFIG.SET_PRODUCT_CODE && row.code && row.code.trim() !== '') {
            log(`     🔄 Updating code from "${row.code.trim()}" to "${finalCode}" (SET_PRODUCT_CODE=true)`, 'info');
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
                    log(`     🔄 Retry attempt ${retryCount}/${maxRetriesForKTPError}...`, 'info');
                    if (currentSeller.seller !== seller.seller) {
                        log(`     New Seller: ${currentSeller.seller || currentSeller.name} @ ${formatRp(currentSeller.price)}`, 'info');
                    }
                    if (finalCode !== mappedCode) {
                        log(`     New Code: ${finalCode} (was: ${mappedCode})`, 'info');
                    }
                } else {
                    log(`     💾 Saving to API...`, 'save');
                }
                
                // Validate seller price before saving
                const sellerPrice = currentSeller.price || 0;
                if (!sellerPrice || sellerPrice <= 0 || isNaN(sellerPrice)) {
                    throw new Error(`Invalid seller price: ${sellerPrice} for seller ${currentSeller.seller || currentSeller.name}`);
                }

                // Create postData with current finalCode (will be updated if code is taken)
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
                
                // Track saved row for potential code update if error 422 occurs later
                savedRowsMap.set(row.id, { row, seller: currentSeller, code: finalCode, sellerType: seller.type });

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
                // Check if it's "Produk dan Seller sudah ada sebelumnya" error (400)
                if (e.statusCode === 400 || (e.message && e.message.includes('400'))) {
                    const errorText = e.responseText || e.message || '';
                    const isDuplicateError = errorText.toLowerCase().includes('sudah ada sebelumnya') || 
                                           errorText.toLowerCase().includes('already exists') ||
                                           errorText.toLowerCase().includes('duplicate');
                    
                    if (isDuplicateError) {
                        // Error "Produk dan Seller sudah ada sebelumnya" berarti ada seller yang sama antara MAIN/B1/B2
                        // Harus ganti semua seller (MAIN, B1, B2) dengan seller yang berbeda
                        log(`     ⚠️ Duplicate seller detected: "${currentSeller.seller || currentSeller.name}" already used in another row`, 'warning');
                        log(`     🔄 Will replace ALL sellers (MAIN, B1, B2) to avoid duplicates`, 'info');
                        
                        // Throw special error to be caught at processProductGroup level
                        const duplicateError = new Error(`Duplicate seller: ${currentSeller.seller || currentSeller.name}`);
                        duplicateError.isDuplicateSellerError = true;
                        duplicateError.usedSellerIds = Array.from(sellerToRowMap.values()).map(m => m.seller.id).filter(Boolean);
                        throw duplicateError;
                    }
                }
                
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
                } else if (e.statusCode === 422 || (e.message && e.message.includes('422'))) {
                    // Check if it's "Kode Produk sudah diambil" error (422)
                    const errorText = e.responseText || e.message || '';
                    const isCodeTakenError = errorText.toLowerCase().includes('kode produk sudah diambil') || 
                                           errorText.toLowerCase().includes('code already taken') ||
                                           errorText.toLowerCase().includes('sudah diambil');
                    
                    if (isCodeTakenError) {
                        log(`     ⚠️ Code "${finalCode}" already taken - requesting AI to generate new code...`, 'warning');
                        
                        // Check if there are saved rows (MAIN/B1 already saved)
                        const hasSavedRows = savedRowsMap.size > 0;
                        if (hasSavedRows) {
                            log(`     ⚠️ ${savedRowsMap.size} row(s) already saved - will update ALL rows with new base code for consistency`, 'warning');
                        }
                        
                        // Get used codes (including current one and all generated codes)
                        const usedCodes = Array.from(STATE.generatedCodes);
                        if (finalCode && !usedCodes.includes(finalCode)) {
                            usedCodes.push(finalCode);
                        }
                        
                        // Also add codes from saved rows
                        savedRowsMap.forEach((saved, rowId) => {
                            if (saved.code && !usedCodes.includes(saved.code)) {
                                usedCodes.push(saved.code);
                            }
                        });
                        
                        // Generate new code using AI
                        try {
                            const brandCategoryName = row.product_details?.brand_category?.name || 
                                                     row.product_details?.type?.name || 
                                                     'Umum';
                            
                            log(`     🤖 Asking AI for new product code (excluding: ${usedCodes.join(', ')})...`, 'info');
                            log(`     💡 Requesting VARIASI KREATIF yang berbeda dari kode sebelumnya!`, 'info');
                            const newBaseCode = await generateProductCodeAI(
                                productName, 
                                brandName, 
                                categoryName, 
                                brandCategoryName,
                                usedCodes,
                                1 // retryCount
                            );
                            
                            log(`     ✅ AI generated new base code: ${newBaseCode}`, 'success');
                            
                            // If there are saved rows, update them with new base code
                            if (hasSavedRows) {
                                log(`     🔄 Updating ${savedRowsMap.size} saved row(s) with new base code for consistency...`, 'info');
                                
                                for (const [savedRowId, savedData] of savedRowsMap.entries()) {
                                    const savedRow = savedData.row;
                                    const savedSellerType = savedData.sellerType;
                                    
                                    // Determine new code for saved row
                                    let newCodeForSaved;
                                    if (savedSellerType === 'MAIN') {
                                        newCodeForSaved = newBaseCode;
                                    } else if (savedSellerType === 'B1') {
                                        newCodeForSaved = newBaseCode + CONFIG.BACKUP1_SUFFIX;
                                    } else if (savedSellerType === 'B2') {
                                        newCodeForSaved = newBaseCode + CONFIG.BACKUP2_SUFFIX;
                                    } else {
                                        newCodeForSaved = newBaseCode;
                                    }
                                    
                                    // Update saved row with new code
                                    const updatePostData = {
                                        id: savedRow.id,
                                        code: newCodeForSaved,
                                        max_price: 0,
                                        product: savedRow.product,
                                        product_id: savedRow.product_id,
                                        product_details: savedRow.product_details,
                                        description: savedRow.description,
                                        price: savedData.seller.price,
                                        stock: savedData.seller.stock || 0,
                                        start_cut_off: savedData.seller.start_cut_off,
                                        end_cut_off: savedData.seller.end_cut_off,
                                        unlimited_stock: savedData.seller.unlimited_stock,
                                        faktur: savedData.seller.faktur || false,
                                        multi: savedData.seller.multi,
                                        multi_counter: savedData.seller.multi_counter,
                                        seller_sku_id: savedData.seller.id,
                                        seller_sku_id_int: savedData.seller.id_int,
                                        seller: savedData.seller.seller,
                                        seller_details: savedData.seller.seller_details || {},
                                        status: true,
                                        last_update: savedRow.last_update || '-',
                                        status_sellerSku: 1,
                                        sort_order: savedRow.sort_order,
                                        seller_sku_desc: savedData.seller.deskripsi || '-',
                                        change: true,
                                    };
                                    
                                    try {
                                        await retry(() => api.saveProduct(updatePostData));
                                        log(`     ✅ Updated saved row ${savedRowId} (${savedSellerType}): "${savedData.code}" → "${newCodeForSaved}"`, 'success');
                                        
                                        // Update saved row code in map
                                        savedRowsMap.set(savedRowId, { ...savedData, code: newCodeForSaved });
                                    } catch (updateErr) {
                                        log(`     ⚠️ Failed to update saved row ${savedRowId}: ${updateErr.message}`, 'warning');
                                    }
                                    
                                    await wait(CONFIG.DELAY_BETWEEN_SAVES);
                                }
                            }
                            
                            // Determine new code based on seller type for current row
                            let newCode;
                            if (seller.type === 'MAIN') {
                                newCode = newBaseCode;
                            } else if (seller.type === 'B1') {
                                newCode = newBaseCode + CONFIG.BACKUP1_SUFFIX;
                            } else if (seller.type === 'B2') {
                                newCode = newBaseCode + CONFIG.BACKUP2_SUFFIX;
                            } else {
                                newCode = newBaseCode;
                            }
                            
                            log(`     ✅ Using new code for current row: ${newCode}`, 'success');
                            
                            // Update finalCode and retry
                            finalCode = newCode;
                            
                            // Track new codes
                            STATE.generatedCodes.add(newBaseCode);
                            STATE.generatedCodes.add(newBaseCode + CONFIG.BACKUP1_SUFFIX);
                            STATE.generatedCodes.add(newBaseCode + CONFIG.BACKUP2_SUFFIX);
                            
                            retryCount++;
                            await wait(1000); // Wait before retry
                            continue; // Retry with new code
                            
                        } catch (aiErr) {
                            log(`     ❌ AI code generation failed: ${aiErr.message}`, 'error');
                            // Fallback to script-based generation
                            const fallbackBaseCode = generateProductCode(productName, brandName);
                            let fallbackCode;
                            if (seller.type === 'MAIN') {
                                fallbackCode = fallbackBaseCode;
                            } else if (seller.type === 'B1') {
                                fallbackCode = fallbackBaseCode + CONFIG.BACKUP1_SUFFIX;
                            } else if (seller.type === 'B2') {
                                fallbackCode = fallbackBaseCode + CONFIG.BACKUP2_SUFFIX;
                            } else {
                                fallbackCode = fallbackBaseCode;
                            }
                            
                            log(`     🔄 Using fallback code: ${fallbackCode}`, 'info');
                            finalCode = fallbackCode;
                            
                            // Track fallback codes
                            STATE.generatedCodes.add(fallbackBaseCode);
                            STATE.generatedCodes.add(fallbackBaseCode + CONFIG.BACKUP1_SUFFIX);
                            STATE.generatedCodes.add(fallbackBaseCode + CONFIG.BACKUP2_SUFFIX);
                            
                            retryCount++;
                            await wait(1000);
                            continue; // Retry with fallback code
                        }
                    } else {
                        // Other 422 errors - just throw
                        log(`     ❌ Save failed: ${e.message}`, 'error');
                        STATE.errors.push({ product: productName, seller: currentSeller.seller || currentSeller.name, code: finalCode, error: e.message });
                        STATE.stats.errors++;
                        break; // Exit retry loop
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
    
    // Return the sellerToRowMap after successful processing
    return currentSellerToRowMap;
    } catch (e) {
            // Handle duplicate seller error at product group level
            if (e.isDuplicateSellerError && retryCount < maxDuplicateSellerRetries) {
                log(`  ⚠️ Duplicate seller error detected - replacing ALL sellers (MAIN, B1, B2)`, 'warning');
                log(`  🔄 Retry attempt ${retryCount + 1}/${maxDuplicateSellerRetries}...`, 'info');
                
                // Collect all used seller IDs (only for this retry, not problematic)
                // These sellers are not problematic - they just caused duplicate, so exclude only for this retry
                const usedSellerIds = e.usedSellerIds || Array.from(sellerToRowMap.values()).map(m => m.seller.id).filter(Boolean);
                log(`  📋 Excluding ${usedSellerIds.length} seller(s) that caused duplicates (not problematic, just for this retry)`, 'info');
                
                // Get fresh sellers
                // Check if rows is not empty
                if (!rows || rows.length === 0 || !rows[0] || !rows[0].id) {
                    log(`  ❌ No rows available to get fresh sellers`, 'error');
                    STATE.errors.push({ product: productName, error: 'No rows available to get fresh sellers' });
                    STATE.stats.errors += rows.length || 1;
                    return;
                }
                
                let freshSellers;
                try {
                    freshSellers = await retry(() => api.getSellers(rows[0].id));
                    freshSellers = filterSellers(freshSellers);
                } catch (err) {
                    log(`  ❌ Failed to get fresh sellers: ${err.message}`, 'error');
                    STATE.errors.push({ product: productName, error: `Get fresh sellers: ${err.message}` });
                    STATE.stats.errors += rows.length;
                    return;
                }
                
                if (freshSellers.length === 0) {
                    log(`  ❌ No sellers available after filtering`, 'error');
                    STATE.errors.push({ product: productName, error: 'No sellers available after duplicate error' });
                    STATE.stats.errors += rows.length;
                    return new Map();
                }
                
                // Re-select all sellers (exclude only for this retry, not permanently)
                // Note: usedSellerIds are NOT problematic sellers - they just caused duplicate
                // They can be included again in future attempts if needed
                const neededSellers = rows.length >= 3 ? 3 : rows.length;
                
                // If excluding sellers would leave us with too few sellers, don't exclude them
                // (they're not problematic, just caused duplicate - can try again)
                const availableAfterExclude = freshSellers.filter(s => !usedSellerIds.includes(s.id));
                if (availableAfterExclude.length < neededSellers) {
                    log(`  ⚠️ Too few sellers after excluding duplicates (${availableAfterExclude.length} < ${neededSellers})`, 'warning');
                    log(`  💡 Not excluding duplicate sellers - will try with all available sellers`, 'info');
                    // Don't exclude - use all available sellers
                }
                
                const candidates = prepareSellersForAI(freshSellers, neededSellers);
                const usedKey = `${categoryName}-${brandName}`;
                const usedList = STATE.usedSellers.get(usedKey) || [];
                
                try {
                    // Only exclude if we have enough sellers after exclusion
                    const excludeIds = availableAfterExclude.length >= neededSellers ? usedSellerIds : [];
                    const newSelectedSellers = await getAISellers(candidates, productName, usedList, excludeIds, neededSellers);
                    
                    // Update used sellers
                    if (!STATE.usedSellers.has(usedKey)) STATE.usedSellers.set(usedKey, []);
                    newSelectedSellers.forEach(s => STATE.usedSellers.get(usedKey).push(s.seller || s.name));
                    
                    log(`  ✅ Re-selected ${newSelectedSellers.length} seller(s) (excluding duplicates)`, 'success');
                    
                    // Max price: set to 0 (tidak ngaruh)
                    maxPrice = 0;
                    
                    // Re-map sellers to rows
                    const newSellerToRowMap = new Map();
                    const newUsedRowIds = new Set();
                    
                    log(`  🔄 Re-mapping ${newSelectedSellers.length} seller(s) to ${rows.length} row(s)...`, 'info');
                    
                    for (const seller of newSelectedSellers) {
                        if (seller.type === 'B1' && rows.length < 2) continue;
                        if (seller.type === 'B2' && rows.length < 3) continue;
                        
                        let targetRow = null;
                        let code = '';
                        
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
                        
                        if (targetRow && !newUsedRowIds.has(targetRow.id)) {
                            newUsedRowIds.add(targetRow.id);
                            const finalCodeForMapping = targetRow.code.trim();
                            newSellerToRowMap.set(seller.type, { row: targetRow, seller, code: finalCodeForMapping });
                            continue;
                        }
                        
                        // Find first available row
                        for (let i = 0; i < rows.length; i++) {
                            const r = rows[i];
                            if (!newUsedRowIds.has(r.id)) {
                                newUsedRowIds.add(r.id);
                                let mappedCode = '';
                                if (seller.type === 'MAIN') mappedCode = expectedCodeForMain;
                                else if (seller.type === 'B1') mappedCode = expectedCodeForB1;
                                else if (seller.type === 'B2') mappedCode = expectedCodeForB2;
                                
                                newSellerToRowMap.set(seller.type, { row: r, seller, code: mappedCode });
                                break;
                            }
                        }
                    }
                    
                    // Recursively retry with new sellers
                    const result = await processSellersWithRetry(newSellerToRowMap, retryCount + 1);
                    return result;
                    
                } catch (aiErr) {
                    log(`  ❌ AI re-selection failed: ${aiErr.message}`, 'error');
                    STATE.errors.push({ product: productName, error: `AI re-selection: ${aiErr.message}` });
                    STATE.stats.errors += rows.length;
                    // Return empty Map to indicate failure
                    return new Map();
                }
            } else {
                // Not a duplicate seller error or max retries reached - re-throw
                throw e;
            }
        }
    };
    
    // Start processing and get final result
    const finalSellerToRowMap = await processSellersWithRetry(sellerToRowMap);
    
    // Check if processing failed (empty Map returned)
    if (!finalSellerToRowMap || finalSellerToRowMap.size === 0) {
        log(`  ❌ Failed to process sellers`, 'error');
        return;
    }
    
    if (finalSellerToRowMap.size < rows.length && CONFIG.SKIP_IF_CODES_COMPLETE) {
        const skipped = rows.length - finalSellerToRowMap.size;
        log(`  ⏭️  Skipped ${skipped} extra row(s) (only ${finalSellerToRowMap.size} sellers mapped)`, 'skip');
        STATE.stats.skipped += skipped;
    }

    log(`  ✅ Completed: ${productName}`, 'success');
    log(`     Processed: ${finalSellerToRowMap.size}/${rows.length} rows`, 'info');
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