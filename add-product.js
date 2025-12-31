// CONFIG - Isi dengan token dan cookie Anda
const CONFIG = {
    XSRF_TOKEN: 'YOUR_XSRF_TOKEN_HERE',
    COOKIE: 'YOUR_COOKIE_HERE',
    
    // Filter untuk skip kategori, brand, type, dan produk
    SKIPPED_CATEGORY: [
        "Malaysia TOPUP", "China TOPUP", "Vietnam Topup", "Thailand TOPUP", 
        "Singapore TOPUP", "Philippines TOPUP", "Bundling"
    ],
    SKIPPED_BRAND: [
        "GO PAY", "OVO", "DANA", "LinkAja", "SHOPEE PAY", "e-Materai", 
        "DIGI", "CELCOM", "UMOBILE", "TUNETALK", "XOX", "Hotlink", "YES", 
        "Be The King", "Kopi Kenangan", "Sushiroll", "Tanaka Voucher"
    ],
    SKIPPED_TYPE: [
        "Cek Hutang", "Pulsa Reguler Combo", "Combo Data", "Umroh", "IlmuPedia", 
        "Cek Paket", "Belajar", "Haji", "Roaming", "Umroh Haji Combo", 
        "Umroh Haji Internet", "Umroh Haji", "FIFA World Cup", "Freedom Apps Gift", 
        "Kzl", "UMKM", "Conference", "Edukasi", "Komik", "Bronet Vidio", 
        "Edu Confrence", "Tapal Kuda", "Cicilan", "Data Transfer", "Ibadah", 
        "Kikida", "Combo Umroh Haji", "Internet Umroh Haji", "Umroh Plus", 
        "East", "West", "Central", "Powered by Google Play", "Indonesia", 
        "Brazil", "Russia", "Turkey"
    ],
    SKIPPED_PRODUCT: [
        "Cek Nama Token PLN", "Cek Username", "Free Fire Cek Username", 
        "Mobile Legends Cek Username"
    ],
    
    // Jumlah kali call API untuk setiap produk
    TARGET_PRODUCT: 3
};

// Headers untuk semua request API
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

// Base URL API
const BASE_URL = 'https://member.digiflazz.com/api/v1';

// Cache untuk brands dan types (diload sekali)
let brandsCache = null;
let typesCache = null;

/**
 * Fetch dengan error handling dan rate limit handling
 */
async function fetchAPI(url, options = {}, retryCount = 0) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                ...headers,
                ...options.headers
            }
        });

        // Handle rate limiting (429)
        if (response.status === 429) {
            console.log(`⚠️  Rate limit terdeteksi (429), menunggu 15 detik...`);
            await new Promise(resolve => setTimeout(resolve, 15000));
            // Retry request yang sama
            return fetchAPI(url, options, retryCount);
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        if (error.message.includes('429')) {
            // Jika error masih 429, tunggu lagi
            console.log(`⚠️  Rate limit masih aktif, menunggu 15 detik lagi...`);
            await new Promise(resolve => setTimeout(resolve, 15000));
            return fetchAPI(url, options, retryCount);
        }
        
        console.error(`Error fetching ${url}:`, error.message);
        throw error;
    }
}

/**
 * Mendapatkan semua kategori
 */
async function getCategories() {
    console.log('📋 Mengambil daftar kategori...');
    const response = await fetchAPI(`${BASE_URL}/product/categories/false`);
    
    if (response.data && Array.isArray(response.data)) {
        console.log(`✅ Ditemukan ${response.data.length} kategori`);
        return response.data;
    }
    
    throw new Error('Format response kategori tidak valid');
}

/**
 * Mendapatkan semua brands (sekali saja, di-cache)
 */
async function getBrands() {
    if (brandsCache) {
        return brandsCache;
    }
    
    console.log('📋 Mengambil daftar brands...');
    const response = await fetchAPI(`${BASE_URL}/product/brands`);
    
    if (response.data && Array.isArray(response.data)) {
        console.log(`✅ Ditemukan ${response.data.length} brands`);
        brandsCache = response.data;
        return brandsCache;
    }
    
    throw new Error('Format response brands tidak valid');
}

/**
 * Mendapatkan semua types (sekali saja, di-cache)
 */
async function getTypes() {
    if (typesCache) {
        return typesCache;
    }
    
    console.log('📋 Mengambil daftar types...');
    const response = await fetchAPI(`${BASE_URL}/product/types`);
    
    if (response.data && Array.isArray(response.data)) {
        console.log(`✅ Ditemukan ${response.data.length} types`);
        typesCache = response.data;
        return typesCache;
    }
    
    throw new Error('Format response types tidak valid');
}

/**
 * Mendapatkan semua produk dari sebuah kategori
 */
async function getProductsByCategory(categoryId, categoryName) {
    console.log(`\n📦 Mengambil produk dari kategori: ${categoryName} (${categoryId})...`);
    
    const response = await fetchAPI(`${BASE_URL}/product/buyer/false/${categoryId}`);
    
    if (!response.data || !Array.isArray(response.data)) {
        console.log(`⚠️  Kategori ${categoryName} mengembalikan format tidak valid, skip...`);
        return [];
    }
    
    if (response.data.length === 0) {
        console.log(`⚠️  Kategori ${categoryName} kosong, skip...`);
        return [];
    }
    
    console.log(`✅ Ditemukan ${response.data.length} produk di kategori ${categoryName}`);
    return response.data;
}

/**
 * Filter produk berdasarkan config
 */
function filterProduct(product, categoryName, brands, types) {
    // Filter kategori (exact match)
    if (CONFIG.SKIPPED_CATEGORY.includes(categoryName)) {
        return { skip: true, reason: 'Kategori di-skip' };
    }
    
    // Filter brand (exact match dengan nama brand)
    const brand = brands.find(b => b.id === product.brand);
    if (brand && CONFIG.SKIPPED_BRAND.includes(brand.name)) {
        return { skip: true, reason: `Brand "${brand.name}" di-skip` };
    }
    
    // Filter type (exact match dengan nama type)
    const type = types.find(t => t.id === product.type);
    if (type && CONFIG.SKIPPED_TYPE.includes(type.name)) {
        return { skip: true, reason: `Type "${type.name}" di-skip` };
    }
    
    // Filter produk (partial match dengan nama produk)
    if (CONFIG.SKIPPED_PRODUCT.some(skipped => product.name.includes(skipped))) {
        return { skip: true, reason: `Produk mengandung kata yang di-skip` };
    }
    
    return { skip: false };
}

/**
 * Menambahkan produk via API
 */
async function addProduct(product) {
    try {
        const response = await fetchAPI(`${BASE_URL}/buyer/product/store/prabayar`, {
            method: 'POST',
            body: JSON.stringify({
                id: product.id,
                name: product.name,
                desc: product.desc,
                category: product.category,
                brand: product.brand,
                type: product.type,
                total_added: product.total_added,
                total_produk_seller: product.total_produk_seller,
                generate_sku_code: false
            })
        });

        return {
            success: true,
            message: response.message || 'Produk berhasil ditambahkan'
        };
    } catch (error) {
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * Menambahkan produk sebanyak TARGET_PRODUCT kali (atau sesuai total_produk_seller)
 */
async function addProductMultiple(product, categoryName) {
    const targetCount = Math.min(CONFIG.TARGET_PRODUCT, product.total_produk_seller || CONFIG.TARGET_PRODUCT);
    
    if (targetCount <= 0) {
        return { success: 0, failed: 0 };
    }
    
    let successCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < targetCount; i++) {
        const result = await addProduct(product);
        
        if (result.success) {
            successCount++;
            console.log(`  ✅ [${i + 1}/${targetCount}] ${product.name} - ${result.message}`);
        } else {
            failedCount++;
            console.log(`  ❌ [${i + 1}/${targetCount}] ${product.name} - ${result.message}`);
        }
        
        // Delay kecil antar request untuk menghindari rate limiting
        if (i < targetCount - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }
    
    return { success: successCount, failed: failedCount };
}

/**
 * Fungsi utama untuk menambahkan semua produk
 */
async function addAllProducts() {
    console.log('🚀 Memulai proses penambahan produk...\n');
    
    let totalAdded = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    let totalSkippedByFilter = 0;

    try {
        // 1. Load categories, brands, dan types
        const categories = await getCategories();
        const brands = await getBrands();
        const types = await getTypes();
        
        console.log('\n' + '='.repeat(50));
        console.log('📊 FILTER AKTIF:');
        console.log(`Kategori di-skip: ${CONFIG.SKIPPED_CATEGORY.length}`);
        console.log(`Brand di-skip: ${CONFIG.SKIPPED_BRAND.length}`);
        console.log(`Type di-skip: ${CONFIG.SKIPPED_TYPE.length}`);
        console.log(`Produk di-skip: ${CONFIG.SKIPPED_PRODUCT.length}`);
        console.log(`Target produk per item: ${CONFIG.TARGET_PRODUCT}`);
        console.log('='.repeat(50) + '\n');

        // 2. Loop melalui setiap kategori
        for (const category of categories) {
            const { id: categoryId, name: categoryName } = category;

            try {
                // 3. Filter kategori
                if (CONFIG.SKIPPED_CATEGORY.includes(categoryName)) {
                    console.log(`\n⏭️  Kategori "${categoryName}" di-skip berdasarkan filter`);
                    totalSkipped++;
                    continue;
                }

                // 4. Ambil semua produk dari kategori ini
                const products = await getProductsByCategory(categoryId, categoryName);

                // 5. Jika kategori kosong, skip
                if (products.length === 0) {
                    totalSkipped++;
                    continue;
                }

                // 6. Filter dan proses setiap produk
                for (const product of products) {
                    const filterResult = filterProduct(product, categoryName, brands, types);
                    
                    if (filterResult.skip) {
                        console.log(`  ⏭️  Skip: ${product.name} - ${filterResult.reason}`);
                        totalSkippedByFilter++;
                        continue;
                    }

                    // 7. Tambahkan produk
                    console.log(`\n➕ Menambahkan: ${product.name}`);
                    const result = await addProductMultiple(product, categoryName);
                    totalAdded += result.success;
                    totalFailed += result.failed;

                    // 8. Delay kecil antar produk untuk menghindari rate limiting
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

            } catch (error) {
                console.error(`❌ Error saat memproses kategori ${categoryName}:`, error.message);
                totalFailed++;
            }
        }

        // 9. Tampilkan ringkasan
        console.log('\n' + '='.repeat(50));
        console.log('📊 RINGKASAN:');
        console.log(`✅ Berhasil ditambahkan: ${totalAdded} produk`);
        console.log(`❌ Gagal: ${totalFailed} produk`);
        console.log(`⏭️  Kategori dilewati: ${totalSkipped} kategori`);
        console.log(`🚫 Produk di-skip oleh filter: ${totalSkippedByFilter} produk`);
        console.log('='.repeat(50));

    } catch (error) {
        console.error('\n❌ Error fatal:', error.message);
        process.exit(1);
    }
}

// Validasi CONFIG
if (CONFIG.XSRF_TOKEN === 'YOUR_XSRF_TOKEN_HERE' || CONFIG.COOKIE === 'YOUR_COOKIE_HERE') {
    console.error('❌ ERROR: Silakan isi CONFIG.XSRF_TOKEN dan CONFIG.COOKIE terlebih dahulu!');
    process.exit(1);
}

// Jalankan script
addAllProducts()
    .then(() => {
        console.log('\n✅ Proses selesai!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Proses gagal:', error);
        process.exit(1);
    });

