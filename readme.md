# 🚀 Digiflazz AI Seller Picker v5.0

Otomasi pemilihan seller Digiflazz menggunakan AI (GPT-4.1-mini + Groq). Langsung via API tanpa browser - **10-50x lebih cepat** dari versi browser.

## ✨ Fitur

- ⚡ **Direct API** - Tidak perlu browser, 10-50x lebih cepat dari DOM scraping
- 🤖 **AI-Powered Seller Selection** - GPT-4.1-mini untuk pemilihan seller optimal dengan reasoning
- 🏷️ **AI Product Code Generation** - Groq API untuk generate kode produk context-aware (TSEL5, TSELD1G, TSEL1GUMAX)
- 🔍 **Smart Pre-Filtering** - Blacklist deskripsi, rating filter, stock/multi filter sebelum AI (hemat token)
- 📊 **Verbose Logging** - Log detail setiap step: seller yang dipilih, AI reasoning, code generation, dll
- 🔄 **Smart Retry** - Auto retry dengan exponential backoff, never give up
- 🚨 **Rate Limit Detection** - Auto-detect 429 error, sleep 15 detik, auto-resume
- 📁 **File Logging & Reports** - Log harian + report JSON/TXT otomatis
- ⚙️ **Fully Configurable** - Semua setting di file `.env`
- 🎯 **100% Feature Parity** - Sama dengan versi browser (old_file.js), hanya beda cara akses data

## 📋 Requirements

- **Node.js** v18+ ([Download](https://nodejs.org/))
- **OpenAI API Key** ([Get API Key](https://platform.openai.com/api-keys)) - Untuk seller selection
- **Groq API Key** ([Get API Key](https://console.groq.com/keys)) - Untuk product code generation
- **Digiflazz Account** (Member area access)

## 🛠️ Instalasi

### 1. Clone Repository

```bash
git clone https://github.com/FlautonGT/API-AUTO-PICK-SELLER-DIGIFLAZZ.git
cd API-AUTO-PICK-SELLER-DIGIFLAZZ
```

Atau download ZIP dan extract ke folder, contoh: `C:\digiflazz-picker\`

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

```bash
npm install
```

Atau double-click `start.bat` (otomatis install saat pertama kali)

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
| `XSRF_TOKEN` | Token dari browser DevTools (Network > Headers) |
| `COOKIE` | Cookie dari browser DevTools (Network > Headers) |
| `GPT_API_KEY` | API Key OpenAI untuk seller selection |
| `GROQ_API_KEY` | API Key Groq untuk product code generation |
| `GROQ_MODEL_PRODUCT_CODE` | Model Groq (contoh: `llama-3.1-8b-instant`) |

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

### Timing & Retry

| Variable | Default | Keterangan |
|----------|---------|------------|
| `DELAY_BETWEEN_SAVES` | `250` | Delay antar save (ms) |
| `DELAY_BETWEEN_PRODUCTS` | `100` | Delay antar produk (ms) |
| `ENABLE_SMART_RETRY` | `true` | Enable smart retry mechanism |
| `MAX_RETRIES` | `15` | Max retry per operasi (atau `Infinity`) |
| `RETRY_DELAY_MIN` | `1500` | Min delay antar retry (ms) |
| `RETRY_DELAY_MAX` | `2000` | Max delay antar retry (ms) |
| `RATE_LIMIT_SLEEP_DURATION` | `15000` | Sleep saat kena rate limit 429 (ms) |

### AI Settings

| Variable | Default | Keterangan |
|----------|---------|------------|
| `GPT_MODEL` | `gpt-4.1-mini` | Model OpenAI untuk seller selection |
| `GROQ_MODEL_PRODUCT_CODE` | `llama-3.1-8b-instant` | Model Groq untuk product code generation |
| `MAX_AI_CANDIDATES` | `20` | Max seller dikirim ke AI (hemat token) |
| `DESCRIPTION_BLACKLIST` | `testing,test,...` | Keyword blacklist di deskripsi seller |
| `ENABLE_DESCRIPTION_BLACKLIST` | `true` | Enable/disable blacklist filter |
| `ENABLE_RATING_PREFILTER` | `true` | Enable/disable rating pre-filter |

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
[14:30:47] ℹ️  Loaded: 22 categories, 156 brands, 45 types

════════════════════════════════════════════════════════════
[14:30:47] 📁 Category: Pulsa
────────────────────────────────────────

════════════════════════════════════════════════════════════
[14:30:48] 📦 Processing: Telkomsel 2.000
   📍 Location: Pulsa > TELKOMSEL
   📊 Rows: 3
  🔍 Fetching sellers from API...
  ✅ Got 156 total sellers from API
  📋 Before filter: 156 sellers
  📋 After blacklist filter: 142 sellers (removed 14)
  📋 After rating filter: 89 sellers (removed 53)
  📋 After stock/multi filter: 67 sellers (removed 22)
  🎯 Prepared 20 candidates for AI
     Top candidates: BAHIYYA PULSA@Rp 2.125, Payfast ID@Rp 2.430, ...
  🤖 Asking AI for seller selection...
  📊 Sending 20 candidates to AI
  🤖 AI Reasoning: MAIN dipilih karena harga termurah dan deskripsi menyebut nasional. B1 dipilih karena rating tertinggi. B2 dipilih karena 24 jam operasional.
  ✅ AI selected 3 seller(s):
     1. MAIN: BAHIYYA PULSA @ Rp 2.125
     2. B1: Payfast ID @ Rp 2.430
     3. B2: RUMAH KOMUNIKA @ Rp 2.950
  ✓ Enriched seller MAIN: BAHIYYA PULSA @ Rp 2.125 (Rating: 4.8)
  ✓ Enriched seller B1: Payfast ID @ Rp 2.430 (Rating: 4.9)
  ✓ Enriched seller B2: RUMAH KOMUNIKA @ Rp 2.950 (Rating: 4.7)
  📋 Final sellers: MAIN=BAHIYYA PULSA@Rp 2.125, B1=Payfast ID@Rp 2.430, B2=RUMAH KOMUNIKA@Rp 2.950
  ✅ Selected 3 seller(s) for 3 row(s)
  💰 Max price calculated: Rp 3.098 (from seller prices: Rp 2.125, Rp 2.430, Rp 2.950)
  🏷️ Generating product code...
     Context: Category=Pulsa, Brand=TELKOMSEL, BrandCategory=Umum
  🤖 Asking AI for product code...
  🤖 AI Generated: TSEL2 (Telkomsel Pulsa 2rb)
     ✅ AI generated code: TSEL2
  📝 Code allocation plan:
     Row 1 (MAIN): TSEL2
     Row 2 (B1): TSEL2B1
     Row 3 (B2): TSEL2B2

  🔧 Processing row 1/3 (MAIN):
     Code: TSEL2
     Seller: BAHIYYA PULSA
     Price: Rp 2.125
     Max Price: Rp 3.098
     Rating: 4.8
     Description: Stok sendiri, nasional, proses cepat...
     Cutoff: 00:00 - 00:00
     💾 Saving to API...
     ✅ Saved successfully!

  🔧 Processing row 2/3 (B1):
     Code: TSEL2B1
     Seller: Payfast ID
     Price: Rp 2.430
     Max Price: Rp 3.098
     Rating: 4.9
     Description: Terpercaya, valid 100%, garansi...
     Cutoff: 00:00 - 00:00
     💾 Saving to API...
     ✅ Saved successfully!

  🔧 Processing row 3/3 (B2):
     Code: TSEL2B2
     Seller: RUMAH KOMUNIKA
     Price: Rp 2.950
     Max Price: Rp 3.098
     Rating: 4.7
     Description: 24 jam operasional, stok terjamin...
     Cutoff: 00:00 - 00:00
     💾 Saving to API...
     ✅ Saved successfully!

  ✅ Completed: Telkomsel 2.000
     Processed: 3/3 rows
════════════════════════════════════════════════════════════

════════════════════════════════════════════════════════════
[14:45:30] 🏁 COMPLETED!
[14:45:30] ⏱️    Duration: 14m 45s
[14:45:30] ℹ️    Total: 2541 | Success: 2489 | Skip: 32 | Error: 20
[14:45:30] ℹ️    Success Rate: 97.95%
[14:45:30] ℹ️    AI Calls: 523 | API Calls: 3124
════════════════════════════════════════════════════════════
```

## 🤖 Logika Pemilihan Seller

### Pre-Filtering (Sebelum AI)
1. **Blacklist Filter** - Filter seller dengan deskripsi:
   - `testing`, `test bersama admin`, `sedang testing`, `percobaan`, `trial`, `demo`, `maintenance`
   - `pulsa transfer`, `paket transfer` (bukan stok sendiri)
   - Deskripsi < 15 karakter atau hanya nama produk
   - Deskripsi kosong atau hanya "-"

2. **Rating Filter** - Filter seller dengan rating < 3.0 (rating 0 = belum ada rating, OK)

3. **Stock & Multi Filter** - Filter berdasarkan:
   - `REQUIRE_UNLIMITED_STOCK` - Wajib stok unlimited
   - `REQUIRE_MULTI` - Wajib support multi transaksi
   - `REQUIRE_STATUS_ACTIVE` - Wajib status aktif

4. **Fallback** - Jika terlalu sedikit seller, relax filter (hanya blacklist)

### AI Selection (Setelah Pre-Filter)

#### MAIN (Seller Utama)
- Harga **TERMURAH** dari yang lolos filter
- Deskripsi menyebut: nasional / speed / stok
- Rating >= 3.0 atau 0 (belum ada rating)

#### B1 (Backup Stabilitas)
- Nama **BERBEDA** dari MAIN
- Rating **TERTINGGI** (>= 3.0 atau 0)
- Deskripsi lengkap & profesional
- Harga boleh lebih mahal dari MAIN (wajar untuk kualitas)

#### B2 (Backup 24 Jam)
- **WAJIB** 24 jam (`start_cut_off = 00:00` DAN `end_cut_off = 00:00`)
- Nama **BERBEDA** dari MAIN & B1
- **WAJIB** lolos blacklist (testing/trial tetap dilarang meski 24 jam)
- Deskripsi bagus > harga termurah
- Rating tertinggi (>= 3.0 atau 0)

### AI Reasoning
Setiap pemilihan seller, AI akan memberikan **reasoning** mengapa seller tersebut dipilih. Reasoning ini ditampilkan di console log untuk transparansi.

## 🏷️ Product Code Generation

### AI-Powered (Groq)
- Context-aware: mempertimbangkan **Kategori**, **Brand Kategori**, dan **Brand**
- Contoh:
  - `Telkomsel 5.000` (Pulsa, Umum) → `TSEL5`
  - `Telkomsel 1GB` (Data, Umum) → `TSELD1G`
  - `Telkomsel 1GB` (Data, UnlimitedMax) → `TSEL1GUMAX`
  - `Telkomsel 1GB` (Data, Orbit) → `TSEL1GORB`

### Auto-Retry
- Jika kode sudah dipakai → AI retry generate kode baru (max 3x)
- Jika masih duplicate → Fallback ke script-based dengan unique suffix

### Code Allocation
- Row 1 → `TSEL5` (MAIN)
- Row 2 → `TSEL5B1` (B1)
- Row 3 → `TSEL5B2` (B2)

## ❓ Troubleshooting

### Error: "XSRF_TOKEN tidak di-set"
- Pastikan file `.env` sudah dibuat
- Pastikan `XSRF_TOKEN` sudah diisi

### Error: "HTTP 401 Unauthorized"
- Token/Cookie expired
- Ambil ulang token dari browser

### Error: "GPT API 429" atau "Groq API 429"
- Rate limit dari OpenAI/Groq
- Script akan **otomatis sleep 15 detik** dan retry
- Jika masih error, tunggu beberapa menit dan coba lagi

### Seller tidak ditemukan
- Pastikan filter tidak terlalu ketat
- Coba set `REQUIRE_MULTI=false` atau `MIN_RATING=0`

## 📝 Changelog

### v5.0.0 (Current)
- ✅ Initial release - API version
- ✅ Direct API calls (tanpa browser, 10-50x lebih cepat)
- ✅ AI-powered seller selection (GPT-4.1-mini) dengan reasoning
- ✅ AI product code generation (Groq) context-aware
- ✅ Smart pre-filtering (blacklist, rating, stock/multi) sebelum AI
- ✅ Rate limit detection & auto-handle (429 error)
- ✅ Smart retry mechanism dengan exponential backoff
- ✅ Verbose logging (seller details, AI reasoning, code generation)
- ✅ File logging & reports (JSON + TXT)
- ✅ 100% feature parity dengan versi browser (old_file.js)

### Perbedaan dengan Versi Browser
| Feature | Browser Version | API Version |
|---------|----------------|-------------|
| Akses Data | DOM Scraping | Direct API |
| Speed | Normal | 10-50x lebih cepat |
| Platform | Browser Console | Node.js CMD |
| Search Feature | Ada (USE_SEARCH) | Tidak perlu (API langsung) |
| Pagination | Manual | Tidak perlu (API langsung) |
| Logika Core | ✅ | ✅ (Sama 100%) |

## 📄 License

MIT License - Free to use and modify.

## 🔗 Links

- **Repository**: [https://github.com/FlautonGT/API-AUTO-PICK-SELLER-DIGIFLAZZ.git](https://github.com/FlautonGT/API-AUTO-PICK-SELLER-DIGIFLAZZ.git)
- **Issues**: [Report Bug](https://github.com/FlautonGT/API-AUTO-PICK-SELLER-DIGIFLAZZ/issues)

## 👨‍💻 Author

Created by **Flauton**

---

**⭐ Jika project ini membantu, jangan lupa star repository ini! ⭐**