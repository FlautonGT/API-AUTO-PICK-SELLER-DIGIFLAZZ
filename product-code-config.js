/**
 * =============================================================================
 * PRODUCT CODE CONFIGURATION
 * =============================================================================
 * 
 * Format Kode: [BRAND][CATEGORY][TYPE][NOMINAL/VALUE]
 * 
 * Contoh:
 * - Pulsa Telkomsel 10.000 Umum       → SP10 (S+P+10)
 * - Pulsa Indosat 25.000 Umum         → ISATP25 (ISAT+P+25)
 * - Data Telkomsel Bulk 1GB 30 Hari   → SDBLK1G30H (S+D+BLK+1G30H)
 * - Data Telkomsel Bulk 1GB 7 Hari    → SDBLK1G7H (S+D+BLK+1G7H)
 * - Games Mobile Legend 86 Diamond    → MLG86 (ML+G+86)
 * - E-Money GoPay 50.000              → GPE50 (GP+E+50)
 * - PLN Token 50.000                  → PLN50 (PLN kosong + 50)
 */

// =============================================================================
// CATEGORY PREFIX
// =============================================================================
export const CATEGORY_PREFIX = {
    // === 1 KARAKTER (PRIORITAS) ===
    'Pulsa': 'P',
    'Data': 'D',
    'Games': 'G',
    'Voucher': 'V',
    'E-Money': 'E',
    'Bundling': 'B',
    'TV': 'T',
    'Masa Aktif': 'M',
    'Aktivasi Voucher': 'A',
    
    // 'S' diambil untuk SMS & Telpon (Komunikasi)
    'Paket SMS & Telpon': 'S', 
    'PLN': '', 

    // === 2 KARAKTER (BENTROK / KHUSUS) ===
    // Bentrok dengan 'A' (Aktivasi Voucher)
    'Aktivasi Perdana': 'AP', 
    
    // Bentrok dengan 'M' (Masa Aktif)
    'Media Sosial': 'MS', 
    
    // Bentrok dengan 'E' (E-Money)
    'eSIM': 'ESIM', 
    
    // Bentrok dengan 'G' (Games)
    'Gas': 'GS', 
    
    // Bentrok dengan 'S' (SMS)
    'Streaming': 'ST', 

    // === TOPUP INTERNASIONAL (KODE NEGARA) ===
    'Malaysia TOPUP': 'MY',
    'China TOPUP': 'CN',
    'Vietnam Topup': 'VN',
    'Thailand TOPUP': 'TH',
    'Singapore TOPUP': 'SG',
    'Philippines TOPUP': 'PH'
};

// =============================================================================
// BRAND PREFIX
// =============================================================================
export const BRAND_PREFIX = {
    // === OPERATOR SELULER (INDONESIA) ===
    'TELKOMSEL': 'S',
    'Telkomsel Omni': 'SOMNI',
    'INDOSAT': 'ISAT',
    'Indosat Only4u': 'ISAT4U',
    'XL': 'XL',
    'XL Axis Cuanku': 'XLAX',
    'AXIS': 'AX',
    'TRI': 'TRI',
    'Tri CuanMax': 'TRICM',
    'SMARTFREN': 'SM',
    'by.U': 'BYU',
    'eSIM': '',
    'Bundling': 'BNDL',
    'CERIA': 'CERIA',
    'IMP Net': 'IMPNET',
    'Bonet': 'BONET',
    'Jagad': 'JAGAD',
    'Biznet': 'BIZNET',
    'WIFI ID': 'WIFI',
    'GOWIFI': 'GOWIFI',

    // === OPERATOR SELULER (INTERNASIONAL) ===
    'DIGI': 'DIGI',
    'CELCOM': 'CELCOM',
    'MAXIS': 'MAXIS',
    'UMOBILE': 'UMO',
    'TUNETALK': 'TUNE',
    'XOX': 'XOX',
    'Hotlink': 'HOTLINK',
    'Yes': 'YES',
    'STARHUB': 'STAR',
    'M1': 'M1',
    'SINGTEL': 'SINGTEL',
    'Smart Communications': 'SMARTPH',
    'GLOBE': 'GLOBE',
    'SMART PINOY': 'PINOY',
    'SUN TELECOM': 'SUN',
    'AIS': 'AIS',
    'TrueMove H': 'TRUE',
    'DTAC': 'DTAC',
    'my by nt': 'MYNT',
    'VIETNAM TOPUP': 'VN',
    'THAILAND TOPUP': 'TH',
    'CHINA TOPUP': 'CN',

    // === E-WALLET, FINANCE & BANK ===
    'DANA': 'DN',
    'OVO': 'OV',
    'GO PAY': 'GP',
    'SHOPEE PAY': 'SP',
    'LinkAja': 'LA',
    'DOKU': 'DOKU',
    'i.saku': 'ISAKU',
    'Sakuku': 'SAKUKU',
    'MAXIM': 'MAXIM',
    'GRAB': 'GRAB',
    'Shopee Food Driver': 'SPFOOD',
    'Indriver': 'INDRIVE',
    'TIX ID': 'TIX',
    'BRI BRIZZI': 'BRIZZI',
    'MANDIRI E-TOLL': 'ETOLL',
    'TAPCASH BNI': 'TAPCASH',
    'E-MONEY': 'EMONEY',
    'AstraPay': 'ASTRA',
    'KasPro': 'KASPRO',
    'Mitra Blibli': 'MBLIBLI',
    'BLIBLI': 'BLIBLI',
    'Mitra Shopee': 'MITRASHP',
    'BCA': 'BCA',
    'BRI': 'BRI',
    'Mandiri': 'MANDIRI',
    'BNI': 'BNI',
    'Bank Permata': 'PERMATA',
    'CIMB Niaga': 'CIMB',
    'Bank Sinarmas': 'SINARMAS',
    'BSI': 'BSI',
    'Alipay': 'ALIPAY',
    'MULTIFINANCE': 'MULTI',

    // === UTILITIES & PPOB ===
    'PLN': 'PLN',
    'PLN PASCABAYAR': 'PLNPASCA',
    'PLN NONTAGLIS': 'PLNNON',
    'Pertamina Gas': 'PERTAGAS',
    'PGN': 'PGN',
    'GAS NEGARA': 'GASN',
    'PDAM': 'PDAM',
    'BPJS KESEHATAN': 'BPJSKES',
    'BPJS KETENAGAKERJAAN': 'BPJSTK',
    'PBB': 'PBB',
    'SAMSAT': 'SAMSAT',
    'e-Meterai': 'EMET',
    'MyPertamina': 'MYPERT',
    'HP PASCABAYAR': 'HPPASCA',
    'INTERNET PASCABAYAR': 'INTPASCA',
    'TV PASCABAYAR': 'TVPASCA',

    // === TV BERBAYAR & STREAMING ===
    'Vidio': 'VIDIO',
    'WeTV': 'WETV',
    'Netflix': 'NFLX',
    'Disney Plus': 'DPLUS',
    'HBO GO': 'HBOGO',
    'Genflix': 'GENFLIX',
    'Viu': 'VIU',
    'Iqiyi': 'IQIYI',
    'Bstation': 'BSTATION',
    'Youtube': 'YT',
    'SPOTIFY': 'SPOT',
    'TikTok': 'TIKTOK',
    'Nex Parabola': 'NEX',
    'K-VISION dan GOL': 'KVISION',
    'Kawan Kvision': 'KAWANKV',
    'Decoder GOL': 'GOL',
    'Transvision': 'TRANS',
    'Matrix Garuda - Sinema - Mola Matrix': 'MATRIXGAR',
    'Matrix': 'MATRIX',
    'Jawara Vision': 'JAWARA',
    'Tanaka Voucher': 'TANAKA',
    'ORANGE TV': 'ORANGE',
    'Meralco': 'MERALCO',

    // === VOUCHER BELANJA & MAKAN ===
    'ALFAMART VOUCHER': 'ALFA',
    'INDOMARET': 'IDM',
    'Tokopedia': 'TOKOPEDIA',
    'BUKALAPAK': 'BL',
    'E-COMMERCE': 'ECOM',
    'MAP E-gift Voucher': 'MAP',
    'Traveloka E-Voucher': 'TVLK',
    'CARREFOUR / TRANSMART': 'CTTRANS',
    'H&M': 'HM',
    'GRAMEDIA': 'GRAMEDIA',
    'METROX': 'METROX',
    'CT CORP': 'CTCORP',
    'Kopi Kenangan': 'KOPI',
    'BAKMI GM': 'BGM',
    'BOGA': 'BOGA',
    'BREADLIFE': 'BREAD',
    'TA WAN': 'TAWAN',
    'ANCOL': 'ANCOL',
    'SHARETEA': 'SHARE',
    'JUNGLELAND': 'JUNGLE',
    'BAKERZIN': 'BAKER',
    'DREAMLINE': 'DREAM',
    'KIMUKATSU': 'KIMU',
    'KINTAN BUFFET': 'KINTAN',
    'MASTER WOK': 'MWOK',
    'ONOKABE': 'ONO',
    'PARADISE DYNASTY': 'PDYNASTY',
    'PARADISE INN': 'PINN',
    'PEPPER LUNCH': 'PLUNCH',
    'PUTUMADE': 'PUTU',
    'SHABURI': 'SHABURI',
    'FRANK & CO': 'FRANK',
    'NANNYS PAVILLON': 'NANNYS',
    'HAAGEN DAZS': 'HD',
    'PORTAL CAFE': 'PORTAL',
    'STEVAN MEAT SHOP': 'STEVAN',
    'NOBLE BY ZHAB THAI': 'NOBLE',
    'NEGIYA': 'NEGIYA',
    'SUNNY SIDE UP': 'SSU',
    'RED SUKI': 'RSUKI',
    'KAFE BETAWI': 'KBETAWI',
    'BAKMI NAGA': 'BNAGA',
    'STEAK 21': 'STEAK21',
    'YOSHINOYA': 'YOSHINOYA',
    'LIFEJUICE': 'JUICE',
    'HONEST BEE': 'HBEE',
    'ARENA GROUP': 'ARENAG',
    'HOTELMURAH': 'HOTEL',

    // === GAME VOUCHERS & PLATFORMS ===
    'GOOGLE PLAY INDONESIA': 'GPC',
    'GOOGLE PLAY US REGION': 'GPCUS',
    'GOOGLE PLAY KOREA SELATAN': 'GPCKR',
    'iTunes': 'ITUNES',
    'ITUNES GIFT CARD INDONESIA': 'ITUNESID',
    'ITUNES US REGION': 'ITUNESUS',
    'Steam Wallet (IDR)': 'SWIDR',
    'Steam Wallet (USD)': 'SWUSD',
    'Steam Wallet': 'SW',
    'GARENA': 'GARENA',
    'Unipin Voucher': 'UP',
    'Razer Gold': 'RAZER',
    'WAVE GAME': 'WAVE',
    'MEGAXUS': 'MEGA',
    'LYTO': 'LYTO',
    'GEMSCOOL': 'GEMS',
    'XIXI GAMES': 'XIXI',
    'MYCARD': 'MYCARD',
    'BATTLENET SEA': 'BNET',
    'PLAYSTATION': 'PSN',
    'XBOX': 'XBOX',
    'Nintendo eShop': 'ESHOP',
    'Game-On Credits': 'GOC',
    'Karma Koin': 'KARMA',
    'BDN': 'BDN',

    // === GAMES (A-Z) ===
    'Aether Gazer': 'AG',
    'AFK Journey': 'AFK',
    'Age of Empires Mobile': 'AOE',
    'Airplane Chefs': 'APC',
    'Among Us': 'AMONG',
    'Apex Legends Mobile': 'APEX',
    'Arena Breakout': 'AB',
    'ARENA OF VALOR': 'AOV',
    'Asphalt 9': 'ASP9',
    'Astra Knights of Veda': 'AKV',
    'AU2 MOBILE': 'AU2',
    
    'Be The King': 'BTK',
    'Bermuda': 'BERMUDA',
    'Bleach Soul Resonance': 'BSR',
    'Blood Strike': 'BLDST',
    'Blue Protocol Star Resonance': 'BPSR',
    'Boss Party': 'BOSS',
    'Boyaa Capsa Susun': 'BOYAA',
    
    'Call of Duty MOBILE': 'CODM',
    'Call of Duty Modern Warfare': 'CODMW',
    'Captain Tsubasa Ace': 'CTACE',
    'Captain Tsubasa Dream Team': 'CTDT',
    'Castle Duels': 'CD',
    'Chamet': 'CHAMET',
    'Clash Royale': 'CR',
    'Conquer Online': 'CO',
    'Crossfire': 'CF',
    'Crystal of Atlan': 'COA',
    'Culinary Tour': 'CTOUR',
    
    'Delta Force': 'DF',
    'Destiny M': 'DM',
    'Destiny Rising': 'DR',
    'Dota Auto Chess Candy (Global)': 'DAC',
    'Draconia Saga': 'DS',
    'Dragon City': 'DCITY',
    'Dragon Nest M Classic': 'DNM',
    'Dragonheir Silent Gods': 'DSG',
    'Duet Night Abyss': 'DNA',
    
    'eFootball': 'PES',
    'Eggy Party': 'EGGY',
    'Eternal City': 'EC',
    
    'Farlight 84': 'FL84',
    'FC Mobile': 'FCM',
    'Football Master 2': 'FM2',
    'Fortnite': 'FN',
    'Foundation Galactic Frontier': 'FGF',
    'FRAG Pro Shooter': 'FRAG',
    'FREE FIRE': 'FF',
    'Free Fire Max': 'FFM',
    
    'Genshin Impact': 'GI',
    'Ghost Story': 'GS',
    'Goddess of Victory Nikke': 'NIKKE',
    'Growtopia': 'GT',
    'Guns of Glory': 'GOG',
    
    'Haikyu Fly High': 'HFH',
    'Harry Potter Magic Awakened': 'HPMA',
    'Heaven Burns Red': 'HBR',
    'Heroic Uncle Kim': 'HUK',
    'Heroes Evolved': 'HE',
    'Honkai Impact 3': 'HI3',
    'Honkai Star Rail': 'HSR',
    'Honor of Kings': 'HOK',
    
    'Identity V': 'IDV',
    'IDV': 'IDV_DIRECT',
    'IMVU': 'IMVU',
    'IndoPlay': 'INDOPLAY',
    'Indus Battle Royale Mobile': 'IBR',
    'Isekai Feast': 'IF',
    
    'King of Avalon': 'KOA',
    'Kings Choice': 'KC',
    
    'Laplace M': 'LAPLACE',
    'League of Legends PC': 'LOL',
    'League of Legends Wild Rift': 'WR',
    'LifeAfter Credits': 'LIFE',
    'Lineage2M': 'L2M',
    'LivU': 'LIVU',
    'Lordnine Infinite Class': 'LIC',
    'Lords Mobile': 'LM',
    'LUDO CLUB': 'LUDO',
    'LYSSA Goddess of Rage': 'LYSSA',
    
    'M-Tix': 'MTIX',
    'Machina Waking': 'MW',
    'Magic Chess': 'MCHESS',
    'Marvel Rivals': 'MR',
    'Mechabellum': 'MECHA',
    'Melojam': 'MELO',
    'Metal Slug Awakening': 'MSA',
    'Mico': 'MICO',
    'Minecraft': 'MC',
    'Mirren Star Legends': 'MSL',
    'Mob Rush': 'MOBR',
    'MOBILE LEGENDS': 'ML',
    'Mobile Legends Adventure': 'MLA',
    'Modern Combat 5': 'MC5',
    'Moonlight Blade M': 'MBM',
    'MU ORIGIN 3': 'MU3',
    'MU Origin 2': 'MU2',
    
    'Naruto Shippuden': 'NARUTO',
    'NBA Infinite': 'NBA',
    
    'Octopath Traveler': 'OCTO',
    'Once Human': 'OH',
    'One Punch Man': 'OPM',
    'Onmyoji Arena': 'OA',
    'Oxide Survival Island': 'OSI',
    
    'Paw Tales Eternal Bond': 'PTEB',
    'Perfect World 2': 'PW2',
    'Persona 5 The Phantom X': 'P5X',
    'Pixel Gun 3D': 'PG3D',
    'Playwith': 'PLAYWITH',
    'POINT BLANK': 'PB',
    'Pokemon Unite': 'POKE',
    'PUBG MOBILE': 'PUBGM',
    'PUBG Mobile Lite': 'PML',
    'PUBG Lite': 'PUBL',
    'PUBG New State Mobile': 'NEWSTATE',
    'PUBG': 'PUBG',
    'Punishing Gray Raven': 'PGR',
    
    'Racing Master': 'RM',
    'Ragnarok Idle Adventure Plus': 'ROIA',
    'Ragnarok M Classic': 'RMC',
    'Ragnarok M: Eternal Love': 'ROM',
    'Ragnarok Origin': 'ROO',
    'Ragnarok Twilight': 'ROT',
    'Redfinger': 'REDF',
    'Rememento White Shadow': 'RWS',
    'Revelation Infinite Journey': 'RIJ',
    'Riot Cash': 'RIOT',
    'Royal Dream': 'RD',
    'Royal Play': 'RP',
    'Rules of Survival Mobile': 'ROS',
    
    'Sausage Man': 'SMAN',
    'Scroll of Onmyoji': 'SOO',
    'Seal M Sea': 'SEAL',
    'Sega Football Club Champions': 'SEGAFC',
    'Shining Spirit': 'SHINING',
    'Slime Haven': 'SLIME',
    'Smash Legends': 'SL',
    'Snowbreak Containment Zone': 'SCZ',
    'Soul Land New World': 'SLNW',
    'Speed Drifters': 'SD',
    'State of Survival': 'SOS',
    'Stumble Guys': 'SG',
    'Super Sus': 'SUS',
    'Sword of Justice': 'SOJ',
    
    'T3 Arena': 'T3',
    'Tacticool': 'TACT',
    'Teamfight Tactics Mobile': 'TFT',
    'Teen Patti Gold': 'TPG',
    'The Ants Underground Kingdom': 'TAUK',
    'The Moonlit Oath': 'TMO',
    'Tinder': 'TINDER',
    'Tom and Jerry : Chase': 'TNJ',
    'Touch N Go': 'TNG',
    'Tower of Fantasy': 'TOF',
    'Trails of Cold Steel NW': 'TOCS',
    'Turbo VPN': 'TURBO',
    
    'Undawn': 'UNDAWN',
    
    'Valorant': 'VAL',
    'War Robots': 'WRB',
    'Watcher of Realms': 'WOR',
    'Werewolf (Party Game)': 'WW',
    'Where Winds Meet': 'WWM',
    'Whiteout Survival Frost Star': 'WS',
    'World War Heroes': 'WWH',
    'Wuthering Waves': 'WWAVES',
    
    'Zenless Zone Zero': 'ZZZ',
    'Zepeto': 'ZEPETO'
};

// =============================================================================
// TYPE PREFIX
// =============================================================================
export const TYPE_PREFIX = {
    // === TIPE UMUM / STANDARD (NO PREFIX) ===
    'Umum': '',
    'Reguler': '',
    'Regular': '',
    'Basic': '',
    'Pulsa Reguler': '',
    'Pulsa Reguler Combo': '',

    // === TIPE TRANSAKSI KHUSUS ===
    'Pulsa Transfer': 'TP',
    'Pulsa Gift': 'GIFT',
    'Gift Data': 'GIFTD',
    'Bulk': 'BLK',
    'Promo': 'PRM',
    'Hot Promo': 'HOT',
    'Voucher Pulsa': 'VCR',
    'Masa Aktif': 'AKTIF',
    'Cek Status': 'CEK',
    'Cek Paket': 'CEKPKT',
    'Inject': 'INJ',
    'Addon': 'ADD',
    'Bagi Kuota': 'BAGI',

    // === PAKET DATA & INTERNET (GENERAL) ===
    'Flash': 'FLASH',
    'Flash Revamp': 'FLASHR',
    'Unlimited': 'UNL',
    'Unlimited Harian': 'UNLH',
    'Unlimited Harian 5G': 'UNLH5G',
    'Unlimited Nonstop': 'UNS',
    'Unlimited Nonstop 5G': 'UNS5G',
    'UnlimitedMAX': 'UMAX',
    'Volume': 'VOL',
    'Mini': 'MINI',
    'Yellow': 'YELO',
    'Yellow Gift': 'YELOG',
    'Vaganza': 'VGZ',
    'Maxstream': 'MAX',
    'Mix': 'MIX',
    'Kzl': 'KZL',
    'Bronet': 'BRN',
    'Bronet Vidio': 'BRNVID',
    'Owsem': 'OWS',
    'Hotrod': 'HR',
    'Hotrod Special': 'HRS',
    'Ekstra': 'EXT',
    'Komik': 'KOMIK',
    'Obor': 'OBOR',
    'Best Deal': 'BEST',
    'Special': 'SPC',
    'Spesial': 'SPC',
    'Gokil Max': 'GMAX',
    'Gokil Combo': 'GCOM',
    'Nonstop': 'NON',
    'Kuotanya': 'KUOTA',
    'Kuota': 'KTA',
    'Kuota 5G': 'K5G',
    'Ultra 5G+': 'U5G',
    'Internet Sakti': 'SAKTI',
    'Combo Sakti': 'CS',
    'Nelpon Sakti': 'NS',
    'Serba Lima Ribu': '5K',
    'Super Seru': 'SS',
    'Super Kaget': 'SK',
    'Kaget': 'KGT',
    'Juara': 'JRA',
    'Mapan': 'MAPAN',
    'Mantap': 'MTP',
    'Gaspol': 'GAS',
    'gaspol': 'GAS', // Case sensitive handling
    'Pasti': 'PST',
    'Harian': 'DAY',
    'Harian Sepuasnya': 'DAYFULL',
    'Mingguan': 'WEEK',
    'Bulanan': 'MONTH',
    '1ON+': '1ON',
    'Aigo': 'AIGO',
    'Aigo SS': 'AIGOSS',
    'AIGO Unlimited': 'AIGOUNL',
    'Bebas Puas 2rb': 'BP2',
    'Bebas Puas 3rb': 'BP3',
    'Bebas Puas 5rb': 'BP5',
    'Bebas Puas 6rb': 'BP6',

    // === FREEDOM SERIES (INDOSAT) ===
    'Freedom Internet': 'FI',
    'Freedom Internet 5G': 'FI5G',
    'Freedom Internet Plus': 'FIP',
    'Freedom Internet Gift': 'FIG',
    'Freedom Combo': 'FC',
    'Freedom Combo Gift': 'FCG',
    'Freedom U': 'FU',
    'Freedom U Gift': 'FUG',
    'Freedom Harian': 'FH',
    'Freedom Kuota Harian': 'FKH',
    'Freedom Apps': 'FA',
    'Freedom Apps Gift': 'FAG',
    'Freedom Longlife': 'FLL',
    'Freedom Spesial': 'FSPC',
    'Freedom Play': 'FPLAY',
    'Freedom Max': 'FMAX',

    // === XTRA SERIES (XL) ===
    'Xtra Combo': 'XC',
    'Xtra Combo Flex': 'XCF',
    'Xtra Combo VIP': 'XCV',
    'Xtra Combo VIP Gift': 'XCVG',
    'Xtra Combo VIP Plus': 'XCVP',
    'Xtra Combo Mini': 'XCM',
    'Xtra Combo Plus': 'XCP',
    'Xtra Combo Weekend': 'XCW',
    'Xtra Combo Gift': 'XCG',
    'Xtra Kuota': 'XK',
    'Xtra Kuota Vidio': 'XKVID',
    'Xtra Rejeki': 'XR',
    'Xtra On': 'XO',
    'Xstream': 'XSTR',

    // === TRI & OTHERS ===
    'AlwaysOn': 'AON',
    'Home': 'HOME',
    'Chelsea': 'CLS',
    'Kikida': 'KKD',
    'Happy': 'HAPPY',
    'Happy 5G': 'HAPPY5G',
    'Happy Play': 'HPLAY',
    'Happy Travel': 'HTRV',
    'Compact': 'CPT',
    'KeepOn': 'KEEP',
    'Pamax': 'PMX',
    'Janet': 'JNT',
    'Cinta': 'LOVE',
    'Kampus': 'KAMPUS',
    'Bima': 'BIMA',
    'Sachet': 'SCH',
    'Perdana': 'SP',
    'Vouchers': 'VCRS',

    // === BY.U & DIGITAL ===
    'by.U': 'BYU',
    'byU Promo': 'BYUP',
    'Yang Bikin Aman Jaya': 'YBAJ',
    'Yang Bikin Cuan': 'YBC',
    'Yang Bikin Deket': 'YBD',
    'Yang Bikin Kangen': 'YBK',
    'Yang Bikin Konelan': 'YBKO',
    'Yang Bikin Nempel': 'YBN',
    'Yang Bikin Nyaman': 'YBNY',
    'Yang Bikin Santai': 'YBS',
    'Yang Dicap Tiga Jari': 'YDTJ',

    // === ZONA & REGIONAL (General) ===
    'Lokal': 'LOK',
    'Naslok': 'NASLOK', // Nasional Lokal
    'Zone': 'ZN',
    'Zona 1': 'Z1',
    'Zona 2': 'Z2',
    'Zona 3': 'Z3',
    'Sumatera': 'SUM',
    'Sumatera Zona 1': 'SUMZ1',
    'Sumatera Zona 2': 'SUMZ2',
    'Sumatera Zona 3': 'SUMZ3',
    'Jawa': 'JAWA',
    'Jawa Tengah': 'JTG',
    'Jawa Tengah - DIY': 'JTGDIY',
    'Jawa Barat': 'JBR',
    'Jawa Timur': 'JTM',
    'Jabodetabek': 'JABO',
    'Jabodetabek Zona 1': 'JABOZ1',
    'Jabodetabek Zona 2': 'JABOZ2',
    'Jabodetabek Zona 3': 'JABOZ3',
    'Kalimantan': 'KAL',
    'Sulawesi': 'SUL',
    'Papua': 'PAP',
    'Maluku': 'MAL',
    'Papua Maluku': 'PAMAL',
    'Bali': 'BALI',
    'Nusa Tenggara': 'NUSRA',
    'Balnus': 'BALNUS',
    
    // === ZONA GABUNGAN (Singkatan Unik) ===
    'Sumbagut': 'SBG', // Sumatera Bagian Utara
    'Sumbagteng': 'SBT', // Sumatera Bagian Tengah
    'Sumbagsel': 'SBS', // Sumatera Bagian Selatan
    'Jabo - Jabar': 'JBJB',
    'Jatim - Jateng': 'JTJT',
    'Jatim Madura': 'JTMD',
    'Jawa Bali Nusra': 'JBN',
    'Jawa Lombok': 'JLMB',
    'Kalisumapa': 'KSP', // Kalimantan Sulawesi Papua
    'Pamasuka': 'PMS', // Papua Maluku Sulawesi Kalimantan
    'Sumapa': 'SMP', // Sulawesi Maluku Papua
    'Sulutra': 'SLT', // Sulawesi Utara
    'CWJ': 'CWJ', // Central West Java
    'EJBN': 'EJBN', // East Java Bali Nusra
    'BB': 'BB', // Bangka Belitung (usually) or BlackBerry
    'Indonesia': 'ID',

    // === KATEGORI APPS, GAMES & STREAMING ===
    'Apps Kuota': 'APPS',
    'Apps Games': 'GAME',
    'GamesMAX': 'GMAXP',
    'GamesMAX Booster': 'GMBOOST',
    'GamesMAX Unlimited Play': 'GMUNL',
    'MusicMAX': 'MMAX',
    'Video': 'VID',
    'Videomax': 'VIDMAX',
    'Youtube': 'YT',
    'Tiktok': 'TIKTOK',
    'Ketengan TikTok': 'KTIKTOK',
    'Instagram': 'IG',
    'Facebook': 'FB',
    'Twitter': 'TWIT',
    'Whatsapp': 'WA',
    'Zoom': 'ZOOM',
    'Spotify': 'SPOT',
    'Joox': 'JOOX',
    'Vidio': 'VIDIO',
    'Viu': 'VIU',
    'Netflix': 'NFLX',
    'Disney': 'DISNEY',
    'Disney+ Hotstar': 'DPLUS',
    'WeTV': 'WETV',
    'Iqiyi': 'IQIYI',
    'Klikfilm': 'KLIK',
    'Genflix': 'GEN',
    'Sushiroll': 'SUSHI',
    'Visionku': 'VIS',
    'Visionku Gaspol': 'VISGAS',
    'Mobile Legends': 'ML',
    'Free Fire': 'FF',
    'PUBG': 'PUBG',
    'AOV': 'AOV',
    'COD': 'COD',
    'Garena': 'GAR',
    'Steam': 'STEAM',
    'Roblox': 'RBLX',
    'Call of Duty': 'COD',
    'Hago': 'HAGO',
    'Boyaa': 'BOYAA',
    'Higgs Domino': 'HIGGS',
    'Chip Ungu': 'CHIPU',
    'Chip Kuning': 'CHIPK',
    'Kupon Emas': 'KEMAS',

    // === CALL, SMS & ROAMING ===
    'Telepon': 'TLP',
    'Telepon Pas': 'TLPPAS',
    'Nelpon': 'TLP',
    'SMS': 'SMS',
    'SMS Gift': 'SMSG',
    'Roaming': 'ROAM',
    'Roamax': 'RMAX',
    'RoaMAX Haji': 'RMAXH',
    'Haji': 'HAJI',
    'Umroh': 'UMROH',
    'Umroh Plus': 'UMROHP',
    'Umroh Haji': 'UH',
    'Umroh Haji Combo': 'UHC',
    'Umroh Haji Internet': 'UHI',
    'Mabrur': 'MABRUR',
    'Combo Mabrur': 'CMABRUR',
    'Ibadah': 'IBADAH',
    
    // === NEGARA (ROAMING) ===
    'Malaysia': 'MY',
    'Singapore': 'SG',
    'Singapura': 'SG',
    'Thailand': 'TH',
    'China': 'CN',
    'Hong Kong': 'HK',
    'Macao': 'MO',
    'Taiwan': 'TW',
    'Jepang': 'JP',
    'Korea Selatan': 'KR',
    'Korea Utara': 'KP',
    'Vietnam': 'VN',
    'Philippines': 'PH',
    'Filipina': 'PH',
    'Australia': 'AU',
    'Saudi Arabia': 'SA',
    'Turkey': 'TR',
    'USA': 'US',
    'US': 'US', // Duplicate handle
    'UK': 'UK',
    'Russia': 'RU',
    'Europe': 'EU',
    'Asia': 'ASIA',
    'Africa': 'AF',
    'America': 'AM',
    'Global': 'GLB',
    'United Arab Emirates': 'UAE',
    'Brasil': 'BR',
    'Brazil': 'BR',

    // === BUNDLING & KHUSUS ===
    'Bundling': 'BNDL',
    'BundlingSG': 'BNDLSG',
    'BundlingWG': 'BNDLWG',
    'BundlingWT': 'BNDLWT',
    'BundlingWX': 'BNDLWX',
    'Telkomsel Omni': 'OMNI',
    'Telkomsel dan Garena': 'TSLGAR',
    'Telkomsel dan Wavegame': 'TSLWAVE',
    'XL dan Garena': 'XLGAR',
    'XL dan Wavegame': 'XLWAVE',
    'XL dan Free Fire': 'XLFF',
    'Axis dan Free Fire': 'AXFF',
    'Tri dan Free Fire': 'TRIFF',
    'Gopay dan Wavegame': 'GPWAVE',
    'Gopay dan Steam': 'GPSTEAM',
    'Merdeka': 'MERDEKA',
    'Merdeka dan Combo': 'MCOM',
    'Membership': 'MEMBER',
    'Edukasi': 'EDU',
    'Edu Confrence': 'EDUCONF',
    'Conference': 'CONF',
    'Belajar': 'STUDY',
    'Ilmupedia': 'ILMU',
    'Ruangguru': 'RG',
    'Sekolah Online': 'SCHON',
    'Work From Home': 'WFH',
    'Sahabat Ojol': 'OJOL',
    'Driver': 'DRV',
    'Customer': 'CUST',
    'Grab Food': 'GF',
    'Grab Mart': 'GM',
    'Grab Gacor': 'GG',
    'Grab Transport Customer': 'GTC',
    'UMKM': 'UMKM',
    'UKM': 'UKM',
    'UKM Plus': 'UKMP',
    'UKM COMBO': 'UKMC',
    'Enterprise+': 'ENTP',
    'Corporate': 'CORP',
    'Community': 'COMM',
    'Karyawan': 'EMP',
    'Orbit': 'ORBIT',
    'Wifi ID': 'WIFI',
    'Indosat Only4u': 'ONLY4U',
    
    // === TV & LAINNYA ===
    'Indovision': 'INDOV',
    'Nex Parabola': 'NEX',
    'Nex Vidio': 'NEXV',
    'K-Vision': 'KV',
    'Transvision': 'TRANS',
    'Skynindo': 'SKY',
    'Matrix': 'MTX',
    'Tanaka': 'TNK',
    'Tanaka HD': 'TNKHD',
    'Samsung HD': 'SAMHD',
    'Samsung SD': 'SAMSD',
    'Cling': 'CLING',
    'Jawara': 'JWR',
    'Jawara+': 'JWR+',
    'Gol': 'GOL',
    'Bein Sports': 'BEIN',
    'Champions': 'CHAMP',
    'Liga 1': 'LIGA1',
    'Liga Indonesia': 'LIGAINDO',
    'Gila Bola': 'GIBOL',
    'Timnas': 'TIMNAS',
    'World Cup': 'WC',
    'FIFA World Cup': 'FWC',
    'Sport': 'SPORT',
    'Spotv': 'SPOTV',
    'Film': 'FILM',
    'Nomat': 'NOMAT',
    'Nonton': 'WATCH',

    // === TOKEN & LISTRIK ===
    'PLN': 'PLN',
    'Token PLN': 'TOKEN',
    'Nontaglis': 'NONTAG',
    'Pascabayar': 'PASCA',
    'Tagihan': 'BILL',
    'E-Money': 'EM',
    'Tapcash': 'TAP',
    'Brizzi': 'BRIZ',
    
    // === FINANCE & E-WALLET ===
    'Dana': 'DN',
    'Ovo': 'OV',
    'Gopay': 'GP',
    'Shopeepay': 'SPY',
    'LinkAja': 'LA',
    'Sakuku': 'SKK',
    'Isaku': 'ISK',
    'Doku': 'DK',
    'Maxim': 'MX',
    'Sudo': 'SDO',
    'Bank': 'BANK',
    'Transfer': 'TF',
    'Cek Saldo': 'BAL',
    'Cek Hutang': 'DEBT',
    'Bayar': 'PAY',
    'Cicilan': 'INST', // Installment
    
    // === LAIN-LAIN DARI LIST ===
    'Connex Evo': 'CNX',
    'IMPreneur': 'IMP',
    'Generasi Gigit': 'GENGG',
    'Poin': 'POIN',
    'Point': 'POINT',
    'Tukar Poin': 'REDEEM',
    'Reward': 'RWD',
    'Surprise Deal': 'SDEAL',
    'Cash': 'CASH',
    'Coins': 'COIN',
    'Crystals': 'CRYS',
    'Diamonds': 'DM',
    'Gems': 'GEM',
    'Gold': 'GOLD',
    'Silver': 'SLV',
    'Bronze': 'BRZ',
    'Emas': 'GOLD',
    'Emas D': 'GOLDD',
    'Emas MD': 'GOLDMD',
    'Platinum': 'PLAT',
    'Titanium': 'TITAN',
    'Vip': 'VIP',
    'Vvip': 'VVIP',
    'Reseller': 'RS',
    'Agen': 'AGN',
    'Master': 'MST',
    'H2H': 'H2H',
    'Server': 'SRV',
    'Api': 'API',
    'Lainnya': 'OTH',
    'lainnya': 'OTH',
    'Mytsel Gift': 'MYGIFT',
    'Tiket Rekrut': 'TICKET',
    'Pixel Pass Tickets': 'PIXEL',
    'Ult Tokens': 'TOKENS',
    'Badges': 'BDG',
    'B Chips': 'BCHIP',
    'Opals': 'OPAL',
    'Keys': 'KEY',
    'Cek Nama': 'CNAME',
    'Time Based': 'TIME',
    'Sesama': 'SESAMA',
    'Sesama Operator': 'SESAMA',
    'Semua Operator': 'ALLOP',
    'Anynet': 'ANY',
    'Luar Negeri': 'INT',
    'Magnet': 'MAG',
    'Solusi': 'SOL',
    'Pintar': 'SMART',
    'Cerdas': 'CLEVER',
    'Hebat': 'GREAT',
    'Dahsyat': 'WOW',
    'Mantul': 'COOL',
    'Kombinasi': 'COMBI',

    // === PAKET DATA TAMBAHAN ===
    'GetMore': 'GETM',
    'Malam': 'MLM',
    'Combo Lite': 'CLIT',
    'Data Transfer': 'DTF',
    'OMG': 'OMG',
    'GigaMAX': 'GIGMAX',
    'InternetMAX': 'INTMAX',
    'Paket': 'PKT',
    'Gift Card': 'GC',
    'Chat': 'CHAT',
    'Sosmed': 'SOSM',
    'Combo Data': 'CDATA',
    'Mania': 'MNI',
    'Combo': 'CMB',
    'Pure': 'PURE',
    'Eksklusif': 'EKSKL',
    'Bonus Xtra Combo Flex': 'BXCF',
    'Bonus Paket Akrab': 'BPKA',
    'Bundles': 'BNDLS',
    'Paket Akrab Sharing': 'PKAS',
    'Small': 'SML',
    'Saldo': 'SALDO',
    'Bonus Harian': 'BHAR',
    'Bonus': 'BNS',
    'Infinite': 'INF',
    'Kita': 'KITA',
    'Pass': 'PASS',
    'Ramadan': 'RMDN',
    'Unlimited Gift': 'UNLG',
    'HiFi Air': 'HIFI',
    'Digital': 'DIG',
    'Talkmania': 'TLKMN',
    'Terbaik Untukmu': 'TBU',
    'Flex': 'FLEX',
    'ON': 'ON',
    'FlexMax': 'FLXMAX',
    'Topping GGWP': 'GGWP',
    'SnackVideo': 'SNACK',
    'Chronal Nexus': 'CHNX',
    'Jajan': 'JJN',

    // === ZONA SUMATERA ===
    'Sumatera Utara Zona 1': 'SUMUZ1',
    'Sumatera Utara Zona 2': 'SUMUZ2',
    'Sumatera Utara Zona 3': 'SUMUZ3',
    'Sumatera Tengah Zona 1': 'SUMTZ1',
    'Sumatera Tengah Zona 2': 'SUMTZ2',
    'Sumatera Tengah Zona 3': 'SUMTZ3',
    'Sumatera Selatan Zona 1': 'SUMSZ1',
    'Sumatera Selatan Zona 2': 'SUMSZ2',
    'Sumatera Selatan Zona 3': 'SUMSZ3',
    'Sumatera Utara': 'SUMU',
    'Sumatera Tengah': 'SUMT',
    'Sumatera Selatan': 'SUMS',
    'Sumatera Tengah Sumatera Selatan': 'SUMTS',
    'Sumbagut Zona 1': 'SBGZ1',
    'Sumbagut Zona 2': 'SBGZ2',
    'Sumbagut Zona 3': 'SBGZ3',
    'Sumbagsel Zona 1': 'SBSZ1',
    'Sumbagsel Zona 2': 'SBSZ2',
    'Sumbagsel Zona 3': 'SBSZ3',

    // === ZONA BALI & NUSA TENGGARA ===
    'Bali - Nusa Tenggara Zona 1': 'BALNZ1',
    'Bali - Nusa Tenggara Zona 2': 'BALNZ2',
    'Bali - Nusa Tenggara Zona 3': 'BALNZ3',
    'Bali - Nusa Tenggara Zona 4': 'BALNZ4',
    'Balnus Zona 1': 'BLNZ1',
    'Balnus Zona 2': 'BLNZ2',
    'Balnus Zona 3': 'BLNZ3',
    'NTT': 'NTT',

    // === ZONA KALIMANTAN ===
    'Kalimantan Zona 1': 'KALZ1',
    'Kalimantan Zona 2': 'KALZ2',
    'Kalimantan Zona 3': 'KALZ3',
    'Kalimantan Sulawesi': 'KALSUL',
    'Kalisumapa Zona 1': 'KSPZ1',
    'Kalisumapa Zona 2': 'KSPZ2',
    'East Kalsul': 'EKALSUL',

    // === ZONA SULAWESI ===
    'Sulawesi Zona 1': 'SULZ1',
    'Sulawesi Zona 2': 'SULZ2',
    'Sulawesi Zona 3': 'SULZ3',
    'Sulawesi Selatan - Sulawesi Barat': 'SULSB',
    'Sulawesi Ewako': 'SULEW',
    'Sumapa Zona 1': 'SMPZ1',
    'Sumapa Zona 2': 'SMPZ2',
    'Sumapa Zona 3': 'SMPZ3',

    // === ZONA JAWA TENGAH & DIY ===
    'Jateng - DIY Zona 1': 'JTDZ1',
    'Jateng - DIY Zona 2': 'JTDZ2',
    'Jateng - DIY Zona 3': 'JTDZ3',
    'Jawa Tengah - Jawa Barat': 'JTJB',
    'Jawa Tengah EJBN': 'JTEJB',
    'Kendal': 'KNDL',
    'Semarang-Salatiga': 'SMGSTG',
    'Salatiga': 'STG',
    'Hanacaraka': 'HNK',

    // === ZONA JAWA BARAT ===
    'Jabar Zona 1': 'JBRZ1',
    'Jabar Zona 2': 'JBRZ2',
    'Jabar Zona 3': 'JBRZ3',
    'Sukabumi': 'SKB',
    'Branch Cianjur Sukabumi': 'BCJS',
    'Sukabumi Bogor Banten': 'SKBB',
    'Banten': 'BTN',

    // === ZONA JAWA TIMUR ===
    'Jatim Zona 1': 'JTMZ1',
    'Jatim Zona 2': 'JTMZ2',
    'Jatim Zona 3': 'JTMZ3',
    'Jatim Bali Nusra': 'JTMBN',
    'Mdra Sdrj Mlng Smbw': 'MDRSM',
    'Tapal Kuda': 'TPKD',
    'Banyuwangi Probolinggo': 'BWPRB',

    // === ZONA EJBN ===
    'EJBN Zona 1': 'EJBNZ1',
    'EJBN Zona 2': 'EJBNZ2',
    'EJBN Zona 3': 'EJBNZ3',

    // === ZONA CWJ ===
    'CWJ Zona 1': 'CWJZ1',
    'CWJ Zona 2': 'CWJZ2',

    // === ZONA JABODETABEK ===
    'Jabo': 'JABO2',
    'Jakarta Raya': 'JAKR',

    // === ZONA LAINNYA ===
    'Non Jawa Bali Nusra': 'NJBN',
    'Non Pamasuka': 'NPMS',
    'Non Puma': 'NPUMA',
    'Non Air': 'NAIR',
    'Region AS': 'RAS',
    'Branch Purwokerto': 'BPWK',
    'Branch Aceh': 'BACH',
    'East': 'EAST',
    'West': 'WEST',
    'Central': 'CNTR',
    'Special East': 'SPEAST',

    // === PAKET KHUSUS ===
    'Paket Akrab': 'PKTAKR',
    'Serumax Zona A': 'SRMXA',
    'Ketengan Utama': 'KTGU',
    'Powered by Google Play': 'PBGP',
    'BOY': 'BOYP',
    'Paket Warnet': 'WARNET',
    'Tinder': 'TNDR',
    'SEA': 'SEAP',
    'Southeast Asia': 'SEASIA',
    'H3RO': 'H3RO',
    'Blue': 'BLUE',
    'Orange': 'ORNG',
    'KringKring Bulk': 'KKB',
    'Combo Umroh Haji': 'CUMH',
    'Internet Umroh Haji': 'IUH',
    'Musik': 'MUSIK',
    'Games': 'GAMES',
    'Sunset': 'SNST',
    'Extra Booster Gift': 'EBGIFT',

    // === ADMIN FEE ===
    'Admin 500': 'ADM5',
    'Admin 1000': 'ADM10',
    'Admin 1500': 'ADM15',

    // === TRANSPORTASI ===
    'Penumpang': 'PNPG',

    // === SP SERIES ===
    'SP3K': 'SP3K',
    'SP5K SP7K': 'SP57K',
    'SP7K': 'SP7K2',
    'SP9K SP10K': 'SP910K',
    'SP3K SP7K': 'SP37K',
    'SP10K': 'SP10K',

    // === VIP & PREMIUM ===
    'VIP': 'VIPP',
    'Pure Merdeka': 'PMRDK',
    'Pure 7 Hari': 'PURE7H',
    'Pure 14 Hari': 'PURE14H',
    'Pure 30 Hari': 'PURE30H',

    // === DRP & DPI ===
    'DRP Games': 'DRPG',
    'DPI': 'DPII',

    // === UTILITIES ===
    'Mandiri': 'MNDR',
    'Perumda': 'PRMDA',
    'UPTD': 'UPTD',
    'Indomaret': 'IDMRT',

    // === TV & STREAMING ===
    'HBO': 'HBOP',
    'Apex': 'APEXP',
    'SMB': 'SMBP',

    // === SPORT ===
    'WCQ': 'WCQP',
    'Voli': 'VOLIP',
    'Kids': 'KIDSP',
    'Badminton': 'BDMTN',
    'Golf': 'GOLFP',

    // === SPEED & BANDWIDTH ===
    'Mbps': 'MBPS',

    // === TOPUP INTERNASIONAL ===
    'Mobile Credit': 'MCRD',
    'Mobile Data': 'MDATA',
    'Smart Home Wifi': 'SHWIFI',
    'Smart Bro': 'SBRO',
    'TNT': 'TNTP',
    'Smart Prepaid': 'SPRPD',

    // === VOUCHER & COUPON ===
    'Coupon': 'CPN'
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get category prefix from category name
 */
export const getCategoryPrefix = (category) => {
    if (!category) return '';
    const categoryLower = category.toLowerCase().trim();
    
    // Exact match first (case-insensitive)
    for (const [key, prefix] of Object.entries(CATEGORY_PREFIX)) {
        if (key.toLowerCase() === categoryLower) {
            return prefix;
        }
    }
    
    // Partial match (case-insensitive)
    for (const [key, prefix] of Object.entries(CATEGORY_PREFIX)) {
        const keyLower = key.toLowerCase();
        if (categoryLower.includes(keyLower) || keyLower.includes(categoryLower)) {
            return prefix;
        }
    }
    
    // Fallback: first 2 chars
    return category.toUpperCase().substring(0, 2);
};

/**
 * Get brand prefix from brand name
 */
export const getBrandPrefix = (brand) => {
    if (!brand) return '';
    const brandLower = brand.toLowerCase().trim();
    
    // Exact match first (case-insensitive)
    for (const [key, prefix] of Object.entries(BRAND_PREFIX)) {
        if (key.toLowerCase() === brandLower) {
            return prefix;
        }
    }
    
    // Partial match (case-insensitive)
    for (const [key, prefix] of Object.entries(BRAND_PREFIX)) {
        const keyLower = key.toLowerCase();
        if (brandLower.includes(keyLower) || keyLower.includes(brandLower)) {
            return prefix;
        }
    }
    
    // Fallback: first 3 chars uppercase
    return brand.toUpperCase().substring(0, 3);
};

/**
 * Get type prefix from type name
 */
export const getTypePrefix = (type) => {
    if (!type) return '';
    const typeLower = type.toLowerCase().trim();
    
    // Check for Umum/Reguler first - these should return empty
    if (['umum', 'reguler', 'regular', 'basic', '-', ''].includes(typeLower)) {
        return '';
    }
    
    // Exact match first (case-insensitive)
    for (const [key, prefix] of Object.entries(TYPE_PREFIX)) {
        if (key.toLowerCase() === typeLower) {
            return prefix;
        }
    }
    
    // Partial match (case-insensitive)
    for (const [key, prefix] of Object.entries(TYPE_PREFIX)) {
        const keyLower = key.toLowerCase();
        if (typeLower.includes(keyLower) || keyLower.includes(typeLower)) {
            return prefix;
        }
    }
    
    return '';
};

/**
 * Extract nominal/value from product name
 * 
 * Handles various formats:
 * - "Telkomsel 10.000" → "10"
 * - "Data Bulk 1 GB / 30 Hari" → "1G30H"
 * - "Data 500 MB / 7 Hari" → "500M7H"
 * - "Mobile Legend 86 Diamond" → "86"
 * - "Paket 1.5GB + 1GB OMG" → "1.5G"
 */
export const extractNominal = (productName, category) => {
    if (!productName) return '';
    const nameUpper = productName.toUpperCase();
    const categoryUpper = (category || '').toUpperCase();
    
    // === CASE 1: Data/Internet dengan GB/MB dan Hari ===
    // Pattern: X GB / Y Hari atau X MB / Y Hari
    const dataWithDaysMatch = nameUpper.match(/(\d+(?:[.,]\d+)?)\s*(GB|MB|TB)\s*[\/\-\+]?\s*(\d+)\s*(HARI|H|DAYS?|D)/i);
    if (dataWithDaysMatch) {
        const size = dataWithDaysMatch[1].replace(',', '.');
        const unit = dataWithDaysMatch[2].charAt(0); // G, M, or T
        const days = dataWithDaysMatch[3];
        return `${size}${unit}${days}H`;
    }
    
    // === CASE 2: Data/Internet dengan GB/MB tanpa Hari ===
    // Pattern: X GB atau X MB (unlimited atau tidak spesifik hari)
    const dataOnlyMatch = nameUpper.match(/(\d+(?:[.,]\d+)?)\s*(GB|MB|TB)/i);
    if (dataOnlyMatch && (categoryUpper.includes('DATA') || categoryUpper.includes('INTERNET') || categoryUpper.includes('PAKET'))) {
        const size = dataOnlyMatch[1].replace(',', '.');
        const unit = dataOnlyMatch[2].charAt(0); // G, M, or T
        return `${size}${unit}`;
    }
    
    // === CASE 3: Pulsa/E-Money dengan nominal ribuan ===
    // Pattern: 10.000, 25000, 50,000
    const thousandMatch = nameUpper.match(/(\d+)[.,]?0{3}(?:\b|[^\d])/);
    if (thousandMatch) {
        return thousandMatch[1]; // Return number without thousands
    }
    
    // === CASE 4: Games dengan diamond/UC/etc ===
    // Pattern: 86 Diamond, 100 UC, 500 Coins
    const gameMatch = nameUpper.match(/(\d+)\s*(DIAMOND|DM|UC|COIN|CREDIT|GEMS?|CP|VP|ROBUX|PRIMOGEM|GENESIS)/i);
    if (gameMatch) {
        return gameMatch[1];
    }
    
    // === CASE 5: Masa Aktif dengan hari ===
    // Pattern: Masa Aktif 30 Hari
    const masaAktifMatch = nameUpper.match(/(\d+)\s*(HARI|H|DAYS?)/i);
    if (masaAktifMatch && categoryUpper.includes('MASA AKTIF')) {
        return `${masaAktifMatch[1]}H`;
    }
    
    // === CASE 6: SMS/Nelpon dengan jumlah ===
    // Pattern: 100 SMS, 50 Menit
    const smsNelponMatch = nameUpper.match(/(\d+)\s*(SMS|MENIT|MIN|MINUTES?)/i);
    if (smsNelponMatch) {
        const amount = smsNelponMatch[1];
        const unit = smsNelponMatch[2].toUpperCase().startsWith('M') ? 'M' : 'S';
        return `${amount}${unit}`;
    }
    
    // === CASE 7: General number extraction ===
    const numMatch = nameUpper.match(/(\d+)/);
    if (numMatch) {
        const num = numMatch[1];
        // Truncate if too long (max 4 digits)
        return num.length > 4 ? num.substring(0, 4) : num;
    }
    
    return '';
};

/**
 * Generate product code from category, brand, type, and product name
 * 
 * Format: [BRAND][CATEGORY][TYPE][NOMINAL]
 * Max length: 15 characters
 */
export const generateProductCode = (category, brand, type, productName) => {
    const catPrefix = getCategoryPrefix(category);
    const brandPrefix = getBrandPrefix(brand);
    const typePrefix = getTypePrefix(type);
    const nominal = extractNominal(productName, category);
    
    // Combine: Brand + Category + Type + Nominal
    let code = `${brandPrefix}${catPrefix}${typePrefix}${nominal}`;
    
    // Clean up: remove spaces, special chars
    code = code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    
    // Ensure max length 15
    if (code.length > 15) {
        code = code.substring(0, 15);
    }
    
    // Ensure minimum meaningful code
    if (code.length < 2) {
        code = `${brandPrefix}${catPrefix}`.substring(0, 6) || 'XX';
    }
    
    return code;
};

/**
 * Make code unique by adding counter suffix if duplicate exists
 */
export const makeUniqueCode = (baseCode, existingCodes = new Set()) => {
    if (!existingCodes.has(baseCode)) {
        return baseCode;
    }
    
    // Try adding counter
    let counter = 2;
    let uniqueCode = `${baseCode}${counter}`;
    
    while (existingCodes.has(uniqueCode) && counter < 100) {
        counter++;
        uniqueCode = `${baseCode}${counter}`;
    }
    
    // Ensure max length 15 (leave room for B1/B2 suffix)
    return uniqueCode.substring(0, 13);
};

// =============================================================================
// EXAMPLES
// =============================================================================
/*
Format: [BRAND][CATEGORY][TYPE][NOMINAL]

generateProductCode('Pulsa', 'Telkomsel', 'Umum', 'Telkomsel 10.000')
→ "SP10" (S + P + 10)

generateProductCode('Pulsa', 'Indosat', 'Umum', 'Indosat 25.000')
→ "ISATP25" (ISAT + P + 25)

generateProductCode('Data', 'Telkomsel', 'Bulk', 'Data Bulk 1 GB / 30 Hari')
→ "SDBLK1G30H" (S + D + BLK + 1G30H)

generateProductCode('Data', 'Telkomsel', 'Bulk', 'Data Bulk 1 GB / 7 Hari')
→ "SDBLK1G7H" (S + D + BLK + 1G7H)

generateProductCode('Data', 'XL', 'Umum', 'XL Xtra Combo 15GB')
→ "XLD15G" (XL + D + 15G)

generateProductCode('Games', 'Mobile Legend', 'Umum', 'Mobile Legend 86 Diamond')
→ "MLG86" (ML + G + 86)

generateProductCode('E-Money', 'GoPay', 'Umum', 'GoPay 50.000')
→ "GPE50" (GP + E + 50)

generateProductCode('PLN', 'PLN', 'Umum', 'Token PLN 50.000')
→ "PLN50" (PLN + kosong + 50)

generateProductCode('Masa Aktif', 'Telkomsel', 'Umum', 'Masa Aktif 30 Hari')
→ "SM30H" (S + M + 30H)

generateProductCode('Paket SMS & Telpon', 'Telkomsel', 'Umum', '100 SMS + 50 Menit')
→ "SS100S" (S + S + 100S)
*/
