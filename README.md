# LabInventory — Sistem Informasi Laboratorium

**LabInventory** adalah platform manajemen inventaris laboratorium modern, responsif, dan offline-ready yang dirancang untuk Laboratorium Kimia dan Biokimia Pangan dan Hasil Pertanian. Sistem ini menyediakan solusi lengkap untuk mengelola bahan kimia, alat/peralatan, peminjaman, pengembalian, tagihan, dan pengguna laboratorium.

---

## 🎯 Fitur Utama

### 📊 Dashboard & Analitik
- **Dashboard Admin** dengan ringkasan statistik real-time (total bahan, alat, item kritis, tagihan menunggu)
- **Grafik Top 10 Penggunaan** — visualisasi bahan kimia dan alat paling sering digunakan (Chart.js)
- **Rekap Data Mahasiswa** — ringkasan status mahasiswa aktif per angkatan
- **Jadwal Kalibrasi** — daftar alat yang akan/sedang dikalibrasi
- **Tren Kepuasan Pengguna** — analytics survei per triwulan/tahunan

### 📦 Manajemen Inventaris
- **CRUD Bahan Kimia & Alat** — tambah, ubah, hapus, dan lacak stok
- **Tracking Stok** — peringatan otomatis item hampir habis
- **Kategori & Atribut** — pengelompokan dan metadata untuk setiap item
- **Riwayat Perubahan** — audit trail lengkap setiap mutasi stok

### 👥 Manajemen Pengguna & Akses
- **Multi-Role** — mahasiswa, dosen, admin laboratorium, admin sistem
- **Role-Based Access Control (RBAC)** — menu dan fitur terbatas per peran
- **Kelola User** — create, edit, reset password, hapus akun
- **Lab Clearance** — status pembersihan laboran sebelum mahasiswa lulus

### 📋 Permintaan & Peminjaman
- **Permintaan Bahan Kimia & Alat** — mahasiswa dan dosen dapat mengajukan request
- **Sistem Peminjaman** — tracking peminjaman alat dengan durasi dan kondisi
- **Pengembalian Alat** — proses pengembalian dengan validasi kondisi fisik
- **Status Tracking** — konfirmasi/penolakan request dengan notifikasi real-time

### 💳 Manajemen Tagihan
- **Tagihan Bahan Kimia** — pencatatan biaya penggunaan bahan per mahasiswa
- **Submit Payment Request** — mahasiswa submit tagihan dengan detail item
- **Approval Workflow** — admin konfirmasi atau tolak tagihan
- **Badge Notifikasi** — penanda tagihan menunggu di sidebar dan mobile topbar
- **Export Laporan** — unduh data tagihan dalam format Excel

### 🔧 Maintenance & Kebersihan
- **Maintenance Log** — pencatatan pemeliharaan rutin alat
- **Jadwal Kalibrasi** — perencanaan dan tracking kalibrasi peralatan
- **Limbah Lab** — monitoring limbah yang akan dibuang, tipe limbah, dan volume
- **Audit Log** — jurnal lengkap semua aktivitas sistem untuk compliance

### 📊 Laporan & Export
- **Export ke Excel** — laporan inventaris, peminjaman, tagihan, riwayat
- **Multiple Format** — dukungan berbagai tipe laporan per kategori
- **Filtering & Sorting** — ekspor data terfilter sesuai kebutuhan

### 😊 Survei Kepuasan
- **Form Survei Interaktif** — rating kepuasan pengguna lab (1-5 bintang)
- **Kategori Pertanyaan** — fasilitas, kecepatan layanan, profesionalisme staff
- **Tren Analytics** — visualisasi tren kepuasan per triwulan/tahun
- **Feedback Loop** — mengumpulkan masukan untuk perbaikan berkelanjutan

### 🔓 Bimbingan Dosen (Role Dosen)
- **Daftar Mahasiswa Bimbingan** — lihat mahasiswa yang dibimbing
- **Status Lab Clearance** — cek pembersihan lab mahasiswa
- **Approval Clearance** — tanda tangan digital penyelesaian bimbingan

---

## 🏗️ Arsitektur & Stack

### Frontend
- **HTML5 / CSS3 / Vanilla JavaScript** — tanpa framework frontend besar
- **Tailwind CSS CDN** — utility-first styling dengan custom config
- **Responsive Design** — desktop, tablet, mobile-first approach
- **Bootstrap Icons** — 1,200+ ikon untuk UI

### Backend Integration
- **Google Apps Script (GAS)** — serverless backend via Google Sheets
- **Custom RPC Layer** (api.js) — komunikasi async dengan handler success/failure
- **REST API** — fetch-based POST requests ke GAS deployment URL

### Progressive Web App (PWA)
- **Service Worker** (sw.js) — caching otomatis app shell
- **Content Hash Versioning** — cache busting otomatis saat ada perubahan file
- **Offline Support** — akses fitur UI saat offline, sync saat online
- **Web Manifest** — instalasi sebagai native app di Android/iOS
- **Dynamic Icons** — support untuk maskable icons dan berbagai ukuran

### Libraries & Dependencies
- **Chart.js** — visualisasi data dan grafik interaktif
- **SheetJS (XLSX)** — export data ke Excel
- **SweetAlert2** — dialog dan notifikasi yang elegan
- **Google Fonts (Inter)** — typography modern dan konsisten

### Data Storage
- **Google Sheets** — backend database (via Apps Script)
- **IndexedDB** (potensial) — local caching browser untuk offline-first
- **Session Storage** — menyimpan auth token dan user state

---

## 📂 Struktur Direktori

```
LabInventori/
├── index.html              # Entry point utama, login & app wrapper
├── api.js                  # RPC layer untuk GAS (di-load di index.html)
├── sw.js                   # Service worker PWA dengan smart caching
├── manifest.json           # PWA manifest (app info, icons, display)
│
├── js/                     # Frontend modules (vanilla JS)
│   ├── api.js              # RPC wrapper (duplikat di js/, dipake di bundle)
│   ├── config.js           # Konfigurasi global, konstanta
│   ├── nav.js              # Navigation & sidebar logic
│   ├── dashboard.js        # Dashboard admin, loading stats & charts
│   ├── inventaris.js       # CRUD bahan & alat, stok management
│   ├── permintaan.js       # Form permintaan & persetujuan request
│   ├── tagihan.js          # Payment request, approval workflow
│   ├── peminjaman.js       # Borrowing management & tracking
│   ├── dosen.js            # Dosen module (bimbingan, clearance)
│   ├── user.js             # User management (CRUD user, roles)
│   ├── export.js           # Export ke Excel, report generation
│   ├── survei.js           # Survey form & analytics
│   ├── ocr.js              # OCR image processing (optional)
│   ├── utils.js            # Helper functions (dates, validation)
│   └── misc.js             # Miscellaneous UI helpers & dialogs
│
├── css/                    # Styling
│   ├── style.css           # Main stylesheet, component styles
│   ├── style-mobile.css    # Mobile-first overrides & responsive
│   └── style-patch.css     # Additional tweaks & fixes
│
├── assets/                 # Static assets
│   ├── favicon-32x32.png
│   ├── favicon-16x16.png
│   ├── android-chrome-192x192.png
│   ├── apple-touch-icon.png
│   ├── icon-512.png
│   ├── icon-192-maskable.png
│   └── icon-512-maskable.png
│
└── README.md               # Dokumentasi ini
```

### Data Flow

```
User Login
    ↓
Session State (NIM, Role) → localStorage
    ↓
Navigation (Role-based menu) → goTo() function
    ↓
Render Section (Dashboard/Inventaris/Permintaan/dll)
    ↓
gsr.withSuccessHandler().actionName()
    ↓
Google Apps Script Deployment
    ↓
Sheets API (read/write data)
    ↓
Response → handler callback
    ↓
Update UI + Chart refresh (Chart.js)
```

---

## 🚀 Panduan Instalasi & Setup

### Prasyarat
1. **Google Account** — dengan akses Google Sheets & Apps Script
2. **Web Server** (optional) — untuk hosting file statis, atau gunakan GitHub Pages
3. **Google Apps Script Project** — backend Apps Script yang sudah dideploy

### Langkah 1: Klon Repository

```bash
git clone https://github.com/angkrang/LabInventori.git
cd LabInventori
```

### Langkah 2: Setup Google Apps Script Backend

1. Buat **Google Apps Script project** di [script.google.com](https://script.google.com)
2. Copy semua function GAS (handleRequest, loginUser, addChemical, dll) ke `Code.gs`
3. Deploy sebagai **web app** dengan akses "Execute as me" dan "Anyone"
4. Copy URL deployment (bentuk: `https://script.google.com/macros/s/AKfyc...`)

### Langkah 3: Update GAS URL di Frontend

Edit `api.js` dan `js/api.js`:

```javascript
const GAS_URL = 'YOUR_GAS_DEPLOYMENT_URL';
```

### Langkah 4: Setup Google Sheet Backend

1. Buat **Google Sheet** dengan sheet untuk:
   - `Users` — username, password hash, role, nim/nip
   - `Chemicals` — nama bahan, stok, satuan, kategori
   - `Equipment` — nama alat, stok, kategori, kondisi
   - `Borrowings` — nim, item, tanggal peminjaman, durasi, status
   - `Returns` — nim, item, tanggal kembali, kondisi, catatan
   - `Payments` — nim, amount, status, tanggal
   - `Surveys` — nim, rating, category, timestamp
   - `AuditLog` — action, user, timestamp, details
   - `Maintenance` — alat, tanggal, tipe service, catatan
   - `Waste` — tipe limbah, volume, tanggal, catatan

2. Bagikan sheet dengan email service account Apps Script

### Langkah 5: Deploy Frontend

**Opsi A: GitHub Pages**
```bash
git add .
git commit -m "Update LabInventory"
git push origin main
# Aktifkan GitHub Pages di repo settings (source: main)
```

**Opsi B: Web Server Biasa**
- Upload semua file ke server (FTP/SSH)
- Pastikan `index.html` accessible via HTTPS

### Langkah 6: Register Service Worker

Akses aplikasi di browser:
```
https://yourdomain.com/LabInventori/
```

- Login pertama kali (credential dari sheet Users)
- Service worker akan register otomatis
- Aplikasi bisa dibuka offline

### Langkah 7: Test & Deploy

```bash
# Test di browser
# 1. Cek dashboard statistics
# 2. Test CRUD inventaris
# 3. Test permintaan & approval
# 4. Test export laporan
# 5. Cek offline functionality
```

---

## 🔐 Authentication & Roles

### Login Credential Format

**Username (NIM Mahasiswa)**
- 6 digit tengah dari nomor NIM Anda
- Contoh: NIM `xx/321123/xx/xxxxx` → username `321123`

**Password**
- Inisial nama (huruf kapital) + 3 angka terakhir NIU
- Contoh: Naura Balqis Anggraeni, NIM `xx/321123/xx/xxxxx`
  - Inisial: **NBA**
  - 3 angka terakhir: **123**
  - Password: **NBA123**

### Role-Based Access

| Role | Menu Access | Fitur Utama |
|------|-------------|------------|
| **Mahasiswa** | Dashboard, Inventaris (view), Permintaan, Tagihan, Riwayat | Submit request, track peminjaman, lihat tagihan |
| **Dosen** | Dashboard, Bimbingan Saya, Inventaris (view), Survei | Approve/reject clearance mahasiswa bimbingan |
| **Admin Lab** | Semua kecuali User | Kelola inventory, approve requests, proses tagihan |
| **Admin Sistem** | Semua fitur | Full access: user management, audit log, maintenance |

---

## 📱 Progressive Web App (PWA)

### Install sebagai App

**Android:**
1. Buka di Chrome
2. Tap menu (⋮) → "Install app"
3. Confirm → App tersimpan di home screen

**iOS:**
1. Buka di Safari
2. Tap share → "Add to Home Screen"
3. Confirm → App tersimpan

### Offline Support

- **App shell** (HTML/CSS/JS) di-cache via Service Worker
- **Navigasi halaman** — network-first (ambil online dulu, fallback cache)
- **Aset statis** — stale-while-revalidate (cache dulu, update di background)
- **API calls** — selalu ke network (tidak di-cache, data selalu fresh)
- **Automatic versioning** — cache di-update otomatis saat file berubah

---

## 🎨 UI/UX Highlights

### Design System
- **Color Palette**
  - Primary: `#1a56db` (brand blue)
  - Success: `#10b981` (emerald)
  - Warning: `#f59e0b` (amber)
  - Danger: `#ef4444` (red)

- **Spacing & Layout**
  - Sidebar + Main content grid
  - Mobile topbar + responsive sidebar collapse
  - Card-based sections dengan consistent padding

- **Components**
  - Form inputs dengan validation
  - Data tables dengan search & filter
  - Modal dialogs untuk aksi confirm/detail
  - Toast notifications untuk feedback
  - Skeleton loaders untuk loading state

### Responsive Breakpoints
- **Desktop** (1024px+) — sidebar kiri, 2-3 kolom layout
- **Tablet** (768px-1023px) — sidebar collapse-able, 2 kolom
- **Mobile** (< 768px) — hamburger menu, topbar, single column

---

## 🛠️ Development

### Struktur Kode

**Global Variables** (di `config.js`)
```javascript
// Current user session
let currentUser = { nim: '', nama: '', role: '' };

// Timestamp untuk refresh
let lastRefresh = {};

// Modal state
let activeModal = null;
```

**Navigation Pattern**
```javascript
function goTo(page) {
  // Hide semua section
  document.querySelectorAll('[id^="sec-"]').forEach(el => el.classList.add('hidden'));
  
  // Show target section
  document.getElementById('sec-' + page).classList.remove('hidden');
  
  // Update active nav link
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
  document.getElementById('nl-' + page).classList.add('active');
  
  // Load data jika perlu
  if (page === 'inv') loadInventaris();
  if (page === 'req') loadPermintaan();
  // dll...
}
```

**API Call Pattern**
```javascript
gsr.withSuccessHandler(function(response) {
  if (response.success) {
    showAlert('Berhasil!', 'Data tersimpan');
    loadData(); // refresh
  } else {
    showAlert('Error', response.message, 'error');
  }
}).withFailureHandler(function(error) {
  console.error('API Error:', error);
  showAlert('Error', 'Koneksi gagal', 'error');
}).actionName(param1, param2, param3);
```

### Common Tasks

**Menambah Menu Baru**

1. Edit `index.html` — tambah nav item di sidebar:
```html
<div class="nav-item-wrap" id="ni-custom">
  <a class="nav-link" id="nl-custom" onclick="goTo('custom')">
    <i class="bi bi-icon"></i> Custom Menu
  </a>
</div>
```

2. Edit `nav.js` — set visibility berdasarkan role:
```javascript
if (userRole === 'admin') {
  document.getElementById('ni-custom').classList.remove('hidden');
}
```

3. Edit `index.html` — tambah section:
```html
<div id="sec-custom" class="hidden">
  <!-- content -->
</div>
```

4. Buat `js/custom.js` dengan fungsi load & handler

---

## 📊 Database Schema (Google Sheets)

### Sheet: Users
| Column | Type | Example |
|--------|------|---------|
| username | string | 321123 |
| password | string | NBA123 (hashed) |
| nama | string | Naura Balqis Anggraeni |
| nim | string | 22/321123/SB/061451 |
| role | string | mahasiswa \| dosen \| admin_lab \| admin |
| active | boolean | TRUE |

### Sheet: Chemicals
| Column | Type | Example |
|--------|------|---------|
| id | string | BAHAN-001 |
| nama | string | Asam Sulfat H2SO4 |
| kategori | string | Asam |
| stok | number | 250 |
| satuan | string | mL |
| harga_satuan | number | 5000 |
| keterangan | string | Grade pro analysis |

### Sheet: Equipment
| Column | Type | Example |
|--------|------|---------|
| id | string | ALAT-001 |
| nama | string | Beaker Glass 500mL |
| kategori | string | Glassware |
| stok | number | 25 |
| kondisi | string | baik \| rusak \| diperbaiki |
| lokasi | string | Rak A5 |

### Sheet: Borrowings
| Column | Type | Example |
|--------|------|---------|
| id | string | BRW-20260701-001 |
| nim | string | 22/321123/SB/061451 |
| nama_item | string | Beaker Glass 500mL |
| jumlah | number | 3 |
| tgl_pinjam | date | 2026-07-01 |
| tgl_kembali_rencana | date | 2026-07-08 |
| status | string | borrowed \| returned \| pending_return |

---

## 🐛 Troubleshooting

### API Connection Error
```
Error: "HTTP 403" or "CORS error"
```
**Solusi:**
- Pastikan GAS project sudah di-deploy sebagai web app
- Check akses: "Execute as" = Me, "Who has access" = Anyone
- Verify GAS_URL di api.js correct
- Cek CORS headers di GAS deployment

### Login Gagal
```
Error: "Invalid credentials"
```
**Solusi:**
- Pastikan format username = 6 digit tengah NIM
- Password = inisial + 3 digit terakhir NIU (case-sensitive)
- Cek data di sheet Users ada record tersebut
- Try reset password via admin

### Service Worker Not Caching
```
App masih perlu online untuk buka
```
**Solusi:**
- Force refresh: Ctrl+Shift+R (Windows) atau Cmd+Shift+R (Mac)
- Clear site data: DevTools → Application → Clear storage
- Reload halaman 2x (first load kenal SW, second load use cache)
- Check DevTools → Application → Cache Storage

### Offline Mode Error
```
"Permintaan gagal di offline mode"
```
**Note:**
- API calls TIDAK bisa offline (requires network)
- Hanya UI yang bisa dilihat offline
- Data sync ketika online lagi

---

## 📝 License & Credits

**Sistem LabInventory** dikembangkan untuk Laboratorium Kimia dan Biokimia Pangan dan Hasil Pertanian.

**Stack:**
- Frontend: Vanilla JS + Tailwind CSS + PWA
- Backend: Google Apps Script + Google Sheets
- Icons: Bootstrap Icons
- Chart: Chart.js
- Export: SheetJS

**Author:** [angkrang](https://github.com/angkrang)

---

## 🚀 Roadmap & Future Enhancements

- [ ] **Multi-bahasa** — support EN, ID, lainnya
- [ ] **QR Code Integration** — scan item untuk quick actions
- [ ] **SMS Notification** — notifikasi permintaan via SMS
- [ ] **Mobile App Native** — React Native/Flutter version
- [ ] **Real-time Sync** — WebSocket untuk live updates
- [ ] **Advanced Analytics** — predictive inventory, trend forecast
- [ ] **RFID Tracking** — inventory tracking via RFID
- [ ] **Multi-site Support** — multiple lab locations
- [ ] **Integration** — Telegram bot, email automation

---

## 📞 Support & Feedback

Untuk pertanyaan, bug report, atau feature request:
1. Buka **Issue** di [GitHub Issues](https://github.com/angkrang/LabInventori/issues)
2. Describe masalah dengan detail & screenshot
3. Tunggu feedback dari maintainer

---

## 📋 Changelog

### v1.0.0 (Current)
✅ Dashboard dengan analytics  
✅ Manajemen inventaris (bahan & alat)  
✅ Permintaan & peminjaman alat  
✅ Tracking pengembalian  
✅ Manajemen tagihan  
✅ Audit log & export  
✅ PWA offline support  
✅ Survey kepuasan pengguna  
✅ Multi-role access control  

---

**Selamat menggunakan LabInventory! 🎉**
