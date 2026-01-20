import 'dotenv/config';

// Helper to parse boolean from env
const parseBool = (val, defaultVal = false) => {
    if (val === undefined || val === null || val === '') return defaultVal;
    return val.toLowerCase() === 'true' || val === '1';
};

// Helper to parse number from env
const parseNum = (val, defaultVal = 0) => {
    const num = parseFloat(val);
    return isNaN(num) ? defaultVal : num;
};

// Helper to parse array from env (comma-separated)
const parseArray = (val, defaultVal = []) => {
    if (!val || val.trim() === '') return defaultVal;
    return val.split(',').map(s => s.trim()).filter(s => s.length > 0);
};

export const CONFIG = {
    // =============================================================================
    // API
    // =============================================================================
    BASE_URL: 'https://member.digiflazz.com/api/v1/buyer/product',
    XSRF_TOKEN: process.env.XSRF_TOKEN || '',
    COOKIE: process.env.COOKIE || '',

    // =============================================================================
    // TELEGRAM BOT
    // =============================================================================
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',

    // =============================================================================
    // OPENAI API
    // =============================================================================
    GPT_API_KEY: process.env.GPT_API_KEY || '',
    GPT_MODEL_SELLER: process.env.GPT_MODEL_SELLER || 'gpt-4.1-mini',
    GPT_TEMPERATURE: parseNum(process.env.GPT_TEMPERATURE, 0.1),
    GPT_MAX_TOKENS: parseNum(process.env.GPT_MAX_TOKENS, 1000),

    // =============================================================================
    // MODE
    // =============================================================================
    MODE: (process.env.MODE || 'ALL').toUpperCase(), // ALL, UNSET, DISTURBANCE

    // =============================================================================
    // SELLER FILTER
    // =============================================================================
    MIN_RATING: parseNum(process.env.MIN_RATING, 3.0),
    REQUIRE_UNLIMITED_STOCK: parseBool(process.env.REQUIRE_UNLIMITED_STOCK, true),
    REQUIRE_MULTI: parseBool(process.env.REQUIRE_MULTI, true),
    REQUIRE_STATUS_ACTIVE: parseBool(process.env.REQUIRE_STATUS_ACTIVE, true),
    REQUIRE_FP: parseBool(process.env.REQUIRE_FP, false),
    ENABLE_DESCRIPTION_BLACKLIST: parseBool(process.env.ENABLE_DESCRIPTION_BLACKLIST, true),
    ENABLE_RATING_PREFILTER: parseBool(process.env.ENABLE_RATING_PREFILTER, true),
    LOG_FILTERED_SELLERS: parseBool(process.env.LOG_FILTERED_SELLERS, false),

    // =============================================================================
    // CATEGORY FILTER
    // =============================================================================
    SKIP_CATEGORIES: parseArray(process.env.SKIP_CATEGORIES, [
        'Malaysia TOPUP', 'China TOPUP', 'Vietnam Topup',
        'Thailand TOPUP', 'Singapore TOPUP', 'Philippines TOPUP'
    ]),
    CATEGORIES_TO_PROCESS: parseArray(process.env.CATEGORIES, null),

    // =============================================================================
    // PRODUCT CODE
    // =============================================================================
    SET_PRODUCT_CODE: parseBool(process.env.SET_PRODUCT_CODE, true),
    CODE_MAX_LENGTH: parseNum(process.env.CODE_MAX_LENGTH, 15),
    SKIP_IF_CODES_COMPLETE: parseBool(process.env.SKIP_IF_CODES_COMPLETE, true),
    BACKUP1_SUFFIX: process.env.BACKUP1_SUFFIX || 'B1',
    BACKUP2_SUFFIX: process.env.BACKUP2_SUFFIX || 'B2',

    // =============================================================================
    // TIMING (ms)
    // =============================================================================
    DELAY_BETWEEN_PRODUCTS: parseNum(process.env.DELAY_BETWEEN_PRODUCTS, 100),
    DELAY_BETWEEN_SAVES: parseNum(process.env.DELAY_BETWEEN_SAVES, 250),
    DELAY_BETWEEN_CATEGORIES: parseNum(process.env.DELAY_BETWEEN_CATEGORIES, 1000),
    DELAY_ON_ERROR: parseNum(process.env.DELAY_ON_ERROR, 2000),

    // =============================================================================
    // RETRY
    // =============================================================================
    MAX_RETRIES: process.env.MAX_RETRIES === 'Infinity' ? Infinity : parseNum(process.env.MAX_RETRIES, 15),
    RETRY_DELAY: parseNum(process.env.RETRY_DELAY, 1500),

    // =============================================================================
    // LOGGING
    // =============================================================================
    VERBOSE: parseBool(process.env.VERBOSE, true),
    LOG_TO_FILE: parseBool(process.env.LOG_TO_FILE, true),
    LOG_TO_CONSOLE: parseBool(process.env.LOG_TO_CONSOLE, true),
    LOG_DIR: process.env.LOG_DIR || './logs',
    REPORT_DIR: process.env.REPORT_DIR || './reports',

    // =============================================================================
    // AI SETTINGS
    // =============================================================================
    MAX_AI_CANDIDATES: parseNum(process.env.MAX_AI_CANDIDATES, 20),
    MIN_DESCRIPTION_LENGTH: parseNum(process.env.MIN_DESCRIPTION_LENGTH, 15),
    DESCRIPTION_BLACKLIST: parseArray(process.env.DESCRIPTION_BLACKLIST, [
        'testing', 'test', 'percobaan', 'trial', 'demo',
        'maintenance', 'pulsa transfer', 'paket transfer'
    ]),

    // =============================================================================
    // RATE LIMIT
    // =============================================================================
    RATE_LIMIT_SLEEP_DURATION: parseNum(process.env.RATE_LIMIT_SLEEP_DURATION, 15000),
    MAX_RATE_LIMIT_RETRIES: parseNum(process.env.MAX_RATE_LIMIT_RETRIES, 5),
};

// Validate required config
export const validateConfig = () => {
    const errors = [];

    if (!CONFIG.XSRF_TOKEN) {
        errors.push('XSRF_TOKEN tidak di-set di .env');
    }
    if (!CONFIG.COOKIE) {
        errors.push('COOKIE tidak di-set di .env');
    }
    if (!CONFIG.GPT_API_KEY) {
        errors.push('GPT_API_KEY tidak di-set di .env');
    }
    if (!CONFIG.TELEGRAM_BOT_TOKEN) {
        errors.push('TELEGRAM_BOT_TOKEN tidak di-set di .env');
    }
    if (!CONFIG.TELEGRAM_CHAT_ID) {
        errors.push('TELEGRAM_CHAT_ID tidak di-set di .env');
    }

    return errors;
};

// Print config for debugging
export const printConfig = () => {
    console.log('\n📋 Configuration:');
    console.log('─'.repeat(50));
    console.log(`   Mode: ${CONFIG.MODE}`);
    console.log(`   GPT Model (Seller): ${CONFIG.GPT_MODEL_SELLER}`);
    console.log(`   Telegram Bot: ${CONFIG.TELEGRAM_BOT_TOKEN ? 'Configured' : 'Not configured'}`);
    console.log(`   Min Rating: ${CONFIG.MIN_RATING}`);
    console.log(`   Require Unlimited: ${CONFIG.REQUIRE_UNLIMITED_STOCK}`);
    console.log(`   Require Multi: ${CONFIG.REQUIRE_MULTI}`);
    console.log(`   Require FP: ${CONFIG.REQUIRE_FP}`);
    console.log(`   Set Product Code: ${CONFIG.SET_PRODUCT_CODE}`);
    console.log(`   Skip If Codes Complete: ${CONFIG.SKIP_IF_CODES_COMPLETE}`);
    console.log(`   Backup Suffixes: ${CONFIG.BACKUP1_SUFFIX}, ${CONFIG.BACKUP2_SUFFIX}`);
    console.log('─'.repeat(50));
};
