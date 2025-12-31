// CONFIG - Isi dengan token dan cookie Anda
const CONFIG = {
    XSRF_TOKEN: 'YOUR_XSRF_TOKEN_HERE',
    COOKIE: 'YOUR_COOKIE_HERE'
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
const BASE_URL = 'https://member.digiflazz.com/api/v1/buyer/product';

/**
 * Fetch dengan error handling
 */
async function fetchAPI(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                ...headers,
                ...options.headers
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`Error fetching ${url}:`, error.message);
        throw error;
    }
}

/**
 * Mendapatkan semua kategori
 */
async function getCategories() {
    console.log('📋 Mengambil daftar kategori...');
    const response = await fetchAPI(`${BASE_URL}/category`);
    
    if (response.data && Array.isArray(response.data)) {
        console.log(`✅ Ditemukan ${response.data.length} kategori`);
        return response.data;
    }
    
    throw new Error('Format response kategori tidak valid');
}

/**
 * Mendapatkan semua produk dari sebuah kategori
 */
async function getProductsByCategory(categoryId, categoryName) {
    console.log(`\n📦 Mengambil produk dari kategori: ${categoryName} (${categoryId})...`);
    
    const response = await fetchAPI(`${BASE_URL}/category/${categoryId}`);
    
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
 * Menghapus produk dalam batch
 */
async function deleteProducts(productIds, categoryName) {
    if (productIds.length === 0) {
        return { success: 0, failed: 0 };
    }

    console.log(`\n🗑️  Menghapus ${productIds.length} produk dari kategori ${categoryName}...`);
    
    try {
        const response = await fetchAPI(`${BASE_URL}/multiple/delete`, {
            method: 'POST',
            body: JSON.stringify({
                product_ids: productIds
            })
        });

        // Parse message untuk mendapatkan jumlah produk yang berhasil dihapus
        const message = response.message || '';
        const match = message.match(/(\d+)/);
        const deletedCount = match ? parseInt(match[1]) : productIds.length;

        console.log(`✅ ${message || `Berhasil menghapus ${deletedCount} produk`}`);
        
        return {
            success: deletedCount,
            failed: productIds.length - deletedCount
        };
    } catch (error) {
        console.error(`❌ Error saat menghapus produk:`, error.message);
        return {
            success: 0,
            failed: productIds.length
        };
    }
}

/**
 * Fungsi utama untuk menghapus semua produk
 */
async function deleteAllProducts() {
    console.log('🚀 Memulai proses penghapusan semua produk...\n');
    
    let totalDeleted = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    try {
        // 1. Ambil semua kategori
        const categories = await getCategories();

        // 2. Loop melalui setiap kategori
        for (const category of categories) {
            const { id: categoryId, name: categoryName } = category;

            try {
                // 3. Ambil semua produk dari kategori ini
                const products = await getProductsByCategory(categoryId, categoryName);

                // 4. Jika kategori kosong, skip
                if (products.length === 0) {
                    totalSkipped++;
                    continue;
                }

                // 5. Kumpulkan semua product IDs (bukan product_id, tapi id)
                const productIds = products.map(product => product.id).filter(id => id);

                if (productIds.length === 0) {
                    console.log(`⚠️  Tidak ada ID produk yang valid di kategori ${categoryName}`);
                    totalSkipped++;
                    continue;
                }

                // 6. Hapus semua produk dari kategori ini
                const result = await deleteProducts(productIds, categoryName);
                totalDeleted += result.success;
                totalFailed += result.failed;

                // 7. Delay kecil untuk menghindari rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                console.error(`❌ Error saat memproses kategori ${categoryName}:`, error.message);
                totalFailed++;
            }
        }

        // 8. Tampilkan ringkasan
        console.log('\n' + '='.repeat(50));
        console.log('📊 RINGKASAN:');
        console.log(`✅ Berhasil dihapus: ${totalDeleted} produk`);
        console.log(`❌ Gagal: ${totalFailed} produk`);
        console.log(`⚠️  Dilewati: ${totalSkipped} kategori`);
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
deleteAllProducts()
    .then(() => {
        console.log('\n✅ Proses selesai!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Proses gagal:', error);
        process.exit(1);
    });

