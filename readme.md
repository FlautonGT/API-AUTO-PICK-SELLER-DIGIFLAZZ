# Digiflazz AI Seller Picker v5.0

Otomasi pemilihan seller Digiflazz menggunakan AI (GPT-4.1-mini). Langsung via API tanpa browser - **10-50x lebih cepat** dari versi browser.

## Fitur

- **Direct API** - Tidak perlu browser, 10-50x lebih cepat dari DOM scraping
- **AI-Powered Seller Selection** - GPT-4.1-mini untuk pemilihan seller optimal dengan reasoning
- **AI Product Code Generation** - GPT-4.1-nano untuk generate kode produk context-aware (TSEL5, TSELD1G, TSEL1GUMAX)
- **Smart Pre-Filtering** - Blacklist deskripsi, rating filter, stock/multi filter sebelum AI (hemat token)
- **Verbose Logging** - Log detail setiap step: seller yang dipilih, AI reasoning, code generation
- **Smart Retry** - Auto retry dengan delay, max 15 attempts
- **Rate Limit Detection** - Auto-detect 429 error, sleep 15 detik, auto-resume
- **File Logging & Reports** - Log harian + report JSON/TXT otomatis
- **3 Mode Operasi** - ALL, UNSET, DISTURBANCE

## Requirements

- **Node.js** v18+ ([Download](https://nodejs.org/))
- **OpenAI API Key** ([Get API Key](https://platform.openai.com/api-keys))
- **Digiflazz Account** (Member area access)

## Rekomendasi VPS/RDP

Script ini ringan karena hanya melakukan API calls (tidak ada browser/headless).

### Minimum (Hemat Biaya)
| Spesifikasi | Nilai |
|-------------|-------|
| **vCPU** | 2 |
| **RAM** | 1 GB |
| **Storage** | 10 GB SSD |
| **OS** | Ubuntu 22.04 |

### Recommended (Optimal)
| Spesifikasi | Nilai |
|-------------|-------|
| **vCPU** | 2 |
| **RAM** | 2 GB |
| **Storage** | 20 GB SSD |
| **OS** | Ubuntu 22.04 |

## Instalasi

### 1. Clone Repository

```bash
git clone https://github.com/FlautonGT/API-AUTO-PICK-SELLER-DIGIFLAZZ.git
cd API-AUTO-PICK-SELLER-DIGIFLAZZ
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Buat File `.env`

Copy `env.example` ke `.env`:

```bash
cp .env.example .env
```

Edit `.env` dan isi dengan nilai yang sesuai:

```env
# =============================================================================
# AUTHENTICATION (WAJIB)
# =============================================================================
XSRF_TOKEN=eyJpdiI6Im1IN2UySFwvR3JlQmhmM....
COOKIE=_ga=GA1.1.975276696.1761842373; remember_web_...

# =============================================================================
# OPENAI API (WAJIB)
# =============================================================================
GPT_API_KEY=sk-proj-xxxxxx

# Model untuk Seller Selection
GPT_MODEL_SELLER=gpt-4.1-mini

# Model untuk Product Code Generation
GPT_MODEL_CODE=gpt-4.1-nano

# =============================================================================
# MODE
# =============================================================================
# ALL = proses semua produk
# UNSET = hanya proses produk yang belum ada kode
# DISTURBANCE = hanya proses produk yang mengalami gangguan
MODE=ALL

# =============================================================================
# SELLER FILTER
# =============================================================================
MIN_RATING=3.0
REQUIRE_UNLIMITED_STOCK=true
REQUIRE_MULTI=true
REQUIRE_STATUS_ACTIVE=true
REQUIRE_FP=false
ENABLE_DESCRIPTION_BLACKLIST=true
ENABLE_RATING_PREFILTER=true

# =============================================================================
# CATEGORY FILTER
# =============================================================================
SKIP_CATEGORIES=Malaysia TOPUP,China TOPUP,Vietnam Topup,Thailand TOPUP,Singapore TOPUP,Philippines TOPUP
CATEGORIES=

# =============================================================================
# PRODUCT CODE
# =============================================================================
SET_PRODUCT_CODE=true
SKIP_IF_CODES_COMPLETE=true
CODE_MAX_LENGTH=15
BACKUP1_SUFFIX=B1
BACKUP2_SUFFIX=B2

# =============================================================================
# TIMING & RETRY
# =============================================================================
DELAY_BETWEEN_PRODUCTS=100
DELAY_BETWEEN_SAVES=250
MAX_RETRIES=15
RETRY_DELAY=1500
RATE_LIMIT_SLEEP_DURATION=15000

# =============================================================================
# LOGGING
# =============================================================================
VERBOSE=true
LOG_TO_FILE=true
LOG_TO_CONSOLE=true
```

### 4. Cara Dapat Token & Cookie

1. Buka https://member.digiflazz.com/buyer-area/product
2. Tekan `F12` (DevTools) > Tab **Network**
3. Refresh halaman
4. Klik request apapun (misal: `category`)
5. Lihat **Request Headers**:
   - Copy nilai `x-xsrf-token` > paste ke `XSRF_TOKEN`
   - Copy nilai `cookie` > paste ke `COOKIE`

## Cara Pakai

### Via Command Line

```bash
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

### Via PM2 (Recommended untuk VPS)

```bash
# Install PM2
npm install -g pm2

# Jalankan dengan PM2
pm2 start index.js --name "digiflazz-picker"

# Lihat logs
pm2 logs digiflazz-picker

# Stop
pm2 stop digiflazz-picker

# Restart
pm2 restart digiflazz-picker
```

## Konfigurasi

### Variabel Wajib

| Variable | Keterangan |
|----------|------------|
| `XSRF_TOKEN` | Token dari browser DevTools |
| `COOKIE` | Cookie dari browser DevTools |
| `GPT_API_KEY` | API Key OpenAI |

### Mode Operasi

| Mode | Keterangan |
|------|------------|
| `ALL` | Proses semua produk |
| `UNSET` | Hanya proses produk yang belum ada kode |
| `DISTURBANCE` | Hanya proses produk yang mengalami gangguan |

### Filter Seller

| Variable | Default | Keterangan |
|----------|---------|------------|
| `MIN_RATING` | `3.0` | Minimum rating (0 = belum ada rating, OK) |
| `REQUIRE_UNLIMITED_STOCK` | `true` | Wajib stok unlimited |
| `REQUIRE_MULTI` | `true` | Wajib support multi transaksi |
| `REQUIRE_STATUS_ACTIVE` | `true` | Wajib status aktif |
| `REQUIRE_FP` | `false` | Wajib faktur pajak (false = tanpa faktur) |

### Timing

| Variable | Default | Keterangan |
|----------|---------|------------|
| `DELAY_BETWEEN_SAVES` | `250` | Delay antar save (ms) |
| `DELAY_BETWEEN_PRODUCTS` | `100` | Delay antar produk (ms) |
| `MAX_RETRIES` | `15` | Max retry per operasi |
| `RETRY_DELAY` | `1500` | Delay antar retry (ms) |
| `RATE_LIMIT_SLEEP_DURATION` | `15000` | Sleep saat kena rate limit (ms) |

## Output

```
digiflazz-picker/
├── logs/
│   └── 2024-12-31.log              # Log harian
└── reports/
    ├── report-2024-12-31-xxx.json  # Detail report (JSON)
    └── summary-2024-12-31.txt      # Ringkasan (TXT)
```

## Logika Pemilihan Seller

### Pre-Filtering (Sebelum AI)

1. **Blacklist Filter** - Filter seller dengan deskripsi:
   - `testing`, `trial`, `demo`, `maintenance`
   - `pulsa transfer`, `paket transfer`
   - Deskripsi kosong atau terlalu pendek

2. **Rating Filter** - Filter seller dengan rating < 3.0 (rating 0 = OK)

3. **Stock & Multi Filter**:
   - Unlimited stock (jika `REQUIRE_UNLIMITED_STOCK=true`)
   - Multi transaksi (jika `REQUIRE_MULTI=true`)
   - Status aktif (jika `REQUIRE_STATUS_ACTIVE=true`)

### AI Selection

| Type | Kriteria |
|------|----------|
| **MAIN** | Harga TERMURAH dan stabil |
| **B1** | Rating TERTINGGI, berbeda dari MAIN |
| **B2** | 24 jam operasional (cutoff 00:00-00:00), berbeda dari MAIN & B1 |

### Code Allocation

- Row 1 > `TSEL5` (MAIN)
- Row 2 > `TSEL5B1` (B1)
- Row 3 > `TSEL5B2` (B2)

## Troubleshooting

### Error: "XSRF_TOKEN tidak di-set"
- Pastikan file `.env` sudah dibuat
- Pastikan `XSRF_TOKEN` sudah diisi

### Error: "HTTP 401 Unauthorized"
- Token/Cookie expired
- Ambil ulang token dari browser

### Error: "HTTP 429 Rate Limit"
- Script akan otomatis sleep 15 detik dan retry
- Jika masih error, tunggu beberapa menit

### Seller tidak ditemukan
- Coba set `REQUIRE_MULTI=false`
- Coba set `MIN_RATING=0`

## Setup VPS

### 1. Launch VPS

```bash
# Pilih: Ubuntu Server 22.04 LTS
```

### 2. Connect & Setup

```bash
# SSH ke instance
ssh -i "your-key.pem" ubuntu@your-instance-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version  # v20.x.x
npm --version   # 10.x.x
```

### 3. Deploy Script

```bash
# Clone repo
git clone https://github.com/FlautonGT/API-AUTO-PICK-SELLER-DIGIFLAZZ.git
cd API-AUTO-PICK-SELLER-DIGIFLAZZ

# Install dependencies
npm install

# Create .env
nano .env  # paste config

# Test
node index.js --test

# Run dengan PM2
npm install -g pm2
pm2 start index.js --name "digiflazz-picker"
pm2 save
pm2 startup
```

### 4. Auto-Start on Reboot

```bash
pm2 startup
# Copy & paste command yang muncul
pm2 save
```

## Changelog

### v5.0.0
- Direct API calls (tanpa browser)
- AI-powered seller selection dengan reasoning
- AI product code generation context-aware
- Smart pre-filtering sebelum AI
- Rate limit detection & auto-handle
- 3 mode operasi: ALL, UNSET, DISTURBANCE
- File logging & reports

## License
Author: Flauton & Claude Code Opus 4.5
MIT License - Free to use and modify.
