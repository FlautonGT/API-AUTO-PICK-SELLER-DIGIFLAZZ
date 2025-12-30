# 🚀 Digiflazz AI Seller Picker v5.0

Otomasi pemilihan seller Digiflazz menggunakan AI (GPT-4.1-mini). Langsung via API tanpa browser.

## ✨ Fitur

- ⚡ **Direct API** - Tidak perlu browser, 10-50x lebih cepat
- 🤖 **AI-Powered** - GPT-4.1-mini untuk pemilihan seller optimal
- 🔍 **Smart Filtering** - Pre-filter seller sebelum AI (hemat token)
- 🏷️ **Auto Product Code** - Generate kode produk otomatis (TSEL5, TSEL5B1, TSEL5B2)
- 📊 **Logging & Report** - Log harian + report JSON/TXT
- 🔄 **Auto Retry** - Retry otomatis jika gagal
- ⚙️ **Configurable** - Semua setting di file `.env`

## 📋 Requirements

- **Node.js** v18+ ([Download](https://nodejs.org/))
- **OpenAI API Key** ([Get API Key](https://platform.openai.com/api-keys))
- **Digiflazz Account** (Member area access)

## 🛠️ Instalasi

### 1. Download & Extract

Extract file zip ke folder, contoh: `C:\digiflazz-picker\`

### 2. Buat File `.env`

Rename `env.example` ke `.env`, atau buat file baru `.env` dengan isi:

```env
# =============================================================================
# DIGIFLAZZ PICKER v5.0 - CONFIGURATION
# =============================================================================
# Copy file ini ke .env dan isi dengan nilai yang sesuai
# =============================================================================

# =============================================================================
# AUTHENTICATION (WAJIB)
# =============================================================================
# Copy dari browser DevTools > Network > Headers

XSRF_TOKEN=eyJpdiI6Im1IN2UySFwvR3JlQmhmM....
COOKIE=_ga=GA1.1.975276696.1761842373; remember_web_59ba36addc2b2f9401580f014c7f58ea4e30989d=....

# =============================================================================
# OPENAI API (WAJIB untuk Seller Selection)
# =============================================================================

GPT_API_KEY=sk-proj-xxxxxx
GPT_MODEL=gpt-4.1-mini
GPT_TEMPERATURE=0.1
GPT_MAX_TOKENS=1000

# =============================================================================
# GROQ API (WAJIB untuk Product Code Generation)
# =============================================================================

GROQ_API_KEY=gsk_xxxxxx
GROQ_MODEL_PRODUCT_CODE=llama-3.1-8b-instant

# =============================================================================
# SELLER FILTER
# =============================================================================

# Minimum rating seller (0 = belum ada rating, tetap OK)
MIN_RATING=3.0
MIN_RATING_PREFILTER=3.0

# Wajib stok unlimited (true/false)
REQUIRE_UNLIMITED_STOCK=true

# Wajib support multi transaksi (true/false)
REQUIRE_MULTI=true

# Wajib status aktif (true/false)
REQUIRE_STATUS_ACTIVE=true

# Wajib faktur pajak (true/false) - biasanya false karena lebih murah tanpa faktur
REQUIRE_FP=false

# Prefer tanpa faktur pajak (true/false)
PREFER_NO_FAKTUR=true

# Enable description blacklist filter (true/false)
ENABLE_DESCRIPTION_BLACKLIST=true

# Enable rating pre-filter sebelum AI (true/false)
ENABLE_RATING_PREFILTER=true

# Log setiap seller yang di-filter (true/false) - untuk debugging
LOG_FILTERED_SELLERS=false

# =============================================================================
# CATEGORY FILTER
# =============================================================================

# Categories yang akan di-SKIP (pisahkan dengan koma)
SKIP_CATEGORIES=Malaysia TOPUP,China TOPUP,Vietnam Topup,Thailand TOPUP,Singapore TOPUP,Philippines TOPUP

# Categories yang akan di-PROSES (kosongkan untuk semua)
# Contoh: Pulsa,Data,E-Money
CATEGORIES=

# =============================================================================
# PRODUCT CODE
# =============================================================================

# Generate kode produk baru (true/false)
SET_PRODUCT_CODE=true

# Skip produk jika kode sudah lengkap & konsisten (true/false)
SKIP_IF_CODES_COMPLETE=true

# Maksimal panjang kode produk
CODE_MAX_LENGTH=15

# Suffix untuk backup seller 1
BACKUP1_SUFFIX=B1

# Suffix untuk backup seller 2
BACKUP2_SUFFIX=B2

# =============================================================================
# PROCESSING TIMING (dalam milidetik)
# =============================================================================

# Delay antar product group
DELAY_BETWEEN_PRODUCTS=100

# Delay antar save (untuk hindari rate limit)
DELAY_BETWEEN_SAVES=250

# Delay antar kategori
DELAY_BETWEEN_CATEGORIES=1000

# Delay setelah error
DELAY_ON_ERROR=2000

# =============================================================================
# RETRY
# =============================================================================

# Enable smart retry mechanism (true/false)
ENABLE_SMART_RETRY=true

# Maksimal retry per operasi (angka atau "Infinity" untuk never give up)
MAX_RETRIES=15

# Min delay antar retry (ms)
RETRY_DELAY_MIN=1500

# Max delay antar retry (ms)
RETRY_DELAY_MAX=2000

# Exponential backoff (true/false)
RETRY_EXPONENTIAL_BACKOFF=false

# Log setiap retry attempt (true/false)
RETRY_LOG_VERBOSE=true

# =============================================================================
# LOGGING
# =============================================================================

# Tampilkan log detail (true/false)
VERBOSE=true

# Simpan log ke file (true/false)
LOG_TO_FILE=true

# Tampilkan log di console (true/false)
LOG_TO_CONSOLE=true

# Folder untuk log
LOG_DIR=./logs

# Folder untuk report
REPORT_DIR=./reports

# =============================================================================
# AI SETTINGS
# =============================================================================

# Maksimal kandidat seller yang dikirim ke AI (hemat token)
MAX_AI_CANDIDATES=20

# Minimum panjang deskripsi seller
MIN_DESCRIPTION_LENGTH=15

# Blacklist keywords di deskripsi seller (pisahkan dengan koma)
# Seller dengan deskripsi mengandung keyword ini akan di-filter
DESCRIPTION_BLACKLIST=testing,test,sedang testing,testing bersama admin,sedang testing bersama admin,test bersama admin,percobaan,trial,demo,maintenance,under construction,pulsa transfer,paket transfer

# =============================================================================
# RATE LIMIT HANDLING
# =============================================================================

# Enable rate limit detection & auto-handle (true/false)
ENABLE_RATE_LIMIT_DETECTION=true

# Sleep duration saat kena rate limit (ms) - default 15 detik
RATE_LIMIT_SLEEP_DURATION=15000

# Check interval untuk rate limit detection (ms)
RATE_LIMIT_CHECK_INTERVAL=500
```

### 3. Cara Dapat Token & Cookie

1. Buka https://member.digiflazz.com/buyer-area/product
2. Tekan `F12` (DevTools) → Tab **Network**
3. Refresh halaman
4. Klik request apapun (misal: `category`)
5. Lihat **Request Headers**:
   - Copy nilai `x-xsrf-token` → paste ke `XSRF_TOKEN`
   - Copy nilai `cookie` → paste ke `COOKIE`

![Get Token](https://i.imgur.com/example.png)

### 4. Install Dependencies

Double-click `start.bat` (otomatis install saat pertama kali)

Atau manual via CMD:
```cmd
cd C:\digiflazz-picker
npm install
```

## 🚀 Cara Pakai

### Via BAT File (Windows)

| File | Fungsi |
|------|--------|
| `start.bat` | Jalankan semua kategori |
| `test.bat` | Test koneksi API saja |
| `run-pulsa.bat` | Jalankan kategori Pulsa saja |

### Via Command Line

```cmd
# Jalankan semua kategori
node index.js

# Test koneksi API
node index.js --test

# Jalankan kategori tertentu
node index.js --category Pulsa

# Jalankan multiple kategori
node index.js --category "Pulsa,Data,E-Money"

# Help
node index.js --help
```

## ⚙️ Konfigurasi

### Variabel Wajib

| Variable | Keterangan |
|----------|------------|
| `XSRF_TOKEN` | Token dari browser DevTools |
| `COOKIE` | Cookie dari browser DevTools |
| `GPT_API_KEY` | API Key OpenAI |

### Filter Seller

| Variable | Default | Keterangan |
|----------|---------|------------|
| `MIN_RATING` | `3.0` | Minimum rating (0 = belum ada rating, OK) |
| `REQUIRE_UNLIMITED_STOCK` | `true` | Wajib stok unlimited |
| `REQUIRE_MULTI` | `true` | Wajib support multi transaksi |
| `REQUIRE_STATUS_ACTIVE` | `true` | Wajib status aktif |
| `PREFER_NO_FAKTUR` | `true` | Prefer tanpa faktur (lebih murah) |

### Filter Kategori

| Variable | Default | Keterangan |
|----------|---------|------------|
| `SKIP_CATEGORIES` | `Malaysia TOPUP,...` | Kategori yang di-skip |
| `CATEGORIES` | _(kosong)_ | Kategori yang diproses (kosong = semua) |

### Timing

| Variable | Default | Keterangan |
|----------|---------|------------|
| `DELAY_BETWEEN_SAVES` | `250` | Delay antar save (ms) |
| `DELAY_BETWEEN_PRODUCTS` | `100` | Delay antar produk (ms) |
| `MAX_RETRIES` | `3` | Max retry per operasi |

### AI Settings

| Variable | Default | Keterangan |
|----------|---------|------------|
| `GPT_MODEL` | `gpt-4.1-mini` | Model OpenAI |
| `MAX_AI_CANDIDATES` | `20` | Max seller dikirim ke AI |
| `BLACKLIST_KEYWORDS` | `testing,test,...` | Keyword blacklist di deskripsi |

## 📁 Output

```
digiflazz-picker/
├── logs/
│   └── 2024-12-31.log              # Log harian
└── reports/
    ├── report-2024-12-31-xxx.json  # Detail report (JSON)
    └── summary-2024-12-31.txt      # Ringkasan (TXT)
```

### Contoh Log

```
[14:30:45] 🚀 DIGIFLAZZ API SELLER PICKER v5.0
[14:30:45] ⏱️    Started at: 31/12/2024 14.30.45
════════════════════════════════════════════════════════════

[14:30:46] 🌐 Fetching categories...
[14:30:47] ℹ️  Loaded: 22 categories, 156 brands

════════════════════════════════════════════════════════════
[14:30:47] 📁 Category: Pulsa
────────────────────────────────────────

[14:30:48] 📦 Telkomsel 2.000 (3 rows)
[14:30:48] ℹ️    Total sellers: 156
[14:30:48] 🔍   Filtered: 156 → 89 sellers
[14:30:49] 🤖   Asking AI...
[14:30:50] 🤖   AI: MAIN=BAHIYYA PULSA, B1=Payfast ID, B2=RUMAH KOMUNIKA
[14:30:50] ✅   MAIN: TSEL2 → BAHIYYA PULSA @ Rp 2.125
[14:30:51] ✅   B1: TSEL2B1 → Payfast ID @ Rp 2.430
[14:30:51] ✅   B2: TSEL2B2 → RUMAH KOMUNIKA @ Rp 2.950

════════════════════════════════════════════════════════════
[14:45:30] 🏁 COMPLETED!
[14:45:30] ⏱️    Duration: 14m 45s
[14:45:30] ℹ️    Total: 2541 | Success: 2489 | Skip: 32 | Error: 20
[14:45:30] ℹ️    Success Rate: 97.95%
════════════════════════════════════════════════════════════
```

## 🤖 Logika Pemilihan Seller

### MAIN (Seller Utama)
- Harga **TERMURAH** dari yang lolos filter
- Deskripsi menyebut: nasional / speed / stok
- Rating >= 3.0 atau 0 (belum ada rating)

### B1 (Backup Stabilitas)
- Nama **BERBEDA** dari MAIN
- Rating **TERTINGGI**
- Deskripsi lengkap & profesional

### B2 (Backup 24 Jam)
- **WAJIB** 24 jam (`start_cut_off = 00:00` DAN `end_cut_off = 00:00`)
- Nama **BERBEDA** dari MAIN & B1
- Deskripsi bagus (bukan testing/trial)

### Blacklist Otomatis
Seller dengan deskripsi berikut akan di-skip:
- `testing`, `test bersama admin`, `sedang testing`
- `percobaan`, `trial`, `demo`, `maintenance`
- `pulsa transfer`, `paket transfer`
- Deskripsi < 15 karakter
- Deskripsi hanya nama produk (contoh: "telkomsel 2000")

## ❓ Troubleshooting

### Error: "XSRF_TOKEN tidak di-set"
- Pastikan file `.env` sudah dibuat
- Pastikan `XSRF_TOKEN` sudah diisi

### Error: "HTTP 401 Unauthorized"
- Token/Cookie expired
- Ambil ulang token dari browser

### Error: "GPT API 429"
- Rate limit OpenAI
- Tunggu beberapa menit dan coba lagi

### Seller tidak ditemukan
- Pastikan filter tidak terlalu ketat
- Coba set `REQUIRE_MULTI=false` atau `MIN_RATING=0`

## 📝 Changelog

### v5.0.0
- Initial release
- Direct API (tanpa browser)
- AI-powered seller selection
- Pre-filtering sebelum AI
- Auto product code generation
- File logging & reports

## 📄 License

MIT License - Free to use and modify.

## 👨‍💻 Author

Created by **Claude AI** for **Riko**