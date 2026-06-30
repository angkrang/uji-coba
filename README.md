# LabInventory 🧪

Sistem Informasi Inventaris Laboratorium berbasis web untuk **Laboratorium Kimia dan Biokimia Pangan dan Hasil Pertanian**, Departemen Teknologi Pangan dan Hasil Pertanian, Universitas Gadjah Mada.

Dibangun di atas **Google Apps Script (GAS)** sebagai backend dan **HTML/CSS/JS statis** sebagai frontend — tanpa server tambahan, cukup deploy sebagai GAS Web App.

---

## Fitur Utama

### 👤 Role: Admin
| Fitur | Keterangan |
|---|---|
| Dashboard | Statistik inventaris, grafik Top 10 penggunaan, jadwal kalibrasi, rekap mahasiswa |
| Data Mahasiswa | Tabel lengkap mahasiswa aktif dari spreadsheet Rekap eksternal |
| Inventaris | CRUD bahan kimia & alat, sort/filter kolom, update stok |
| Peminjaman | Monitor peminjaman bahan & alat per mahasiswa, approve/reject pengembalian |
| Tagihan Bahan | Konfirmasi rekapitulasi tagihan bahan kimia mahasiswa |
| Bebas Lab | Approve bebas lab, reset status untuk periode baru |
| Kelola User | Tambah/edit/hapus user Admin (akun mahasiswa otomatis dari Rekap) |
| Maintenance | Catat log perawatan & kalibrasi alat |
| Limbah | Catat log pengelolaan limbah laboratorium |
| Survei Kepuasan | Input survei per responden atau rekap manual, rekap per periode/triwulan |
| Export Laporan | Excel & PDF untuk semua jenis laporan |
| Audit Log | Riwayat seluruh aktivitas sistem |
| OCR Kartu Bon | Scan kartu bon bahan/alat tulis tangan via Anthropic Vision API |

### 🎓 Role: Mahasiswa
| Fitur | Keterangan |
|---|---|
| Dashboard | Profil penelitian, akumulasi pinjaman, status bebas lab, time tracker izin |
| Inventaris | Lihat ketersediaan bahan kimia & alat |
| Permintaan & Pinjam | Ajukan permintaan bahan atau pinjam alat langsung dari sistem |
| Pengembalian | Ajukan pengembalian alat, pantau status konfirmasi |
| Tagihan | Lihat rekapitulasi tagihan bahan, ajukan ke admin |
| Survei Kepuasan | Isi survei 1x per triwulan |

---

## Arsitektur Sistem

```
┌─────────────────────────────────────────────┐
│              Browser (Frontend)              │
│  HTML + Tailwind CSS + Vanilla JS            │
│                                              │
│  js/config.js      — GAS_URL & global state  │
│  js/api.js         — callGAS() bridge        │
│  js/nav.js         — routing & auth          │
│  js/utils.js       — helpers & pagination    │
│  js/dashboard.js   — admin & mhs dashboard   │
│  js/inventaris.js  — inventory management    │
│  js/permintaan.js  — request & return        │
│  js/tagihan.js     — payment management      │
│  js/peminjaman.js  — borrowing admin         │
│  js/user.js        — user management         │
│  js/export.js      — Excel & PDF export      │
│  js/misc.js        — audit, maintenance, dll │
│  js/survei.js      — satisfaction survey     │
└───────────────────┬─────────────────────────┘
                    │ fetch POST (JSON)
                    ▼
┌─────────────────────────────────────────────┐
│         Google Apps Script (Backend)         │
│  Code.gs — handleRequest() router            │
│                                              │
│  Auth: CacheService session (6 jam)          │
│  DB  : Google Spreadsheet (SPREADSHEET_ID)   │
│  OCR : Anthropic API (claude-sonnet-4-6)     │
└───────────────────┬─────────────────────────┘
                    │ SpreadsheetApp
                    ▼
┌─────────────────────────────────────────────┐
│           Google Spreadsheet (DB)            │
│                                              │
│  CHEMICALS_DB / EQUIPMENTS_DB               │
│  CHEMICALS / EQUIPMENTS (View)              │
│  CHEMICAL_HISTORY / EQUIPMENT_HISTORY       │
│  USERS / STUDENTS_DB                        │
│  RETURN_REQUESTS / PAYMENT_REQUESTS         │
│  AUDIT_LOG / MAINTENANCE_LOG / WASTE_LOG    │
│  SURVEI_KEPUASAN / LAB_CLEARANCE            │
└─────────────────────────────────────────────┘
                    │ IMPORTRANGE + QUERY
                    ▼
┌─────────────────────────────────────────────┐
│        Spreadsheet Rekap Eksternal           │
│  Sheet: DataEdit                             │
│  (sumber data mahasiswa aktif)               │
└─────────────────────────────────────────────┘
```

---

## Struktur Sheet Google Spreadsheet

| Sheet | Kolom | Keterangan |
|---|---|---|
| `CHEMICALS_DB` | Rumus, Nama, Kategori, StokAman, SisaStok, Satuan, Lokasi, Status\*, Harga\* | `*` = dikelola formula |
| `EQUIPMENTS_DB` | ID, Nama, Spek, StokAman, Tersedia, Satuan, Lokasi, Kondisi, Status\*, Kategori | |
| `CHEMICALS` | View dari CHEMICALS_DB via QUERY | Dibaca frontend |
| `EQUIPMENTS` | View dari EQUIPMENTS_DB via QUERY | Dibaca frontend |
| `CHEMICAL_HISTORY` | ID_Req, NIM, NamaBahan, Jumlah, Tipe, Tanggal, Status | |
| `EQUIPMENT_HISTORY` | ID_Req, NIM, NamaAlat, Jumlah, Tipe, Tanggal, Status, StatusKembali | |
| `USERS` | username, password\*, Nama\*, Role\*, status_pengembalian, status_pembayaran, bebas_lab, approved_by, approved_date | Baris mahasiswa A-D = ARRAYFORMULA |
| `STUDENTS_DB` | NIM, Nama, DosenPembimbing, JudulPenelitian, TanggalMulai, TanggalSelesai | QUERY+IMPORTRANGE dari Rekap, **jangan ditulis manual** |
| `RETURN_REQUESTS` | ID_Req, NIM, NamaAlat, Jumlah, Kondisi, Tanggal, Status, CatatanMhs | |
| `PAYMENT_REQUESTS` | ID_Req, NIM, Tanggal, TotalBiaya, Status, CatatanMhs, ApprovedBy, ApprovedDate, DetailJSON | |
| `AUDIT_LOG` | Timestamp, User, Aksi, Target, NilaiLama, NilaiBaru, Keterangan | |
| `MAINTENANCE_LOG` | ID, NamaAlat, TipeKegiatan, Tanggal, TanggalBerikutnya, Teknisi, Kondisi, Catatan | |
| `WASTE_LOG` | ID, Tanggal, NamaBahan, Jumlah, Satuan, KategoriLimbah, Kemasan, MetodePembuangan, PetugasAdmin, Catatan | |
| `SURVEI_KEPUASAN` | ID, Sumber, NIM, Laboratorium, Tanggal, Nama, JumlahResponden, P1-P5, Catatan, InputOleh, Timestamp | Dibuat otomatis |

---

## Cara Deploy

### Prasyarat
- Akun Google
- Google Spreadsheet dengan struktur sheet di atas
- Spreadsheet Rekap eksternal (opsional, untuk data mahasiswa otomatis)
- API key Anthropic (opsional, untuk fitur OCR kartu bon)

### Langkah-Langkah

#### 1. Siapkan Google Spreadsheet
Buat spreadsheet baru dan tambahkan sheet sesuai tabel di atas. Catat **Spreadsheet ID** dari URL:
```
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
```

#### 2. Deploy Google Apps Script
1. Buka spreadsheet → **Extensions → Apps Script**
2. Salin seluruh isi `Code.gs` ke editor
3. Ganti `SPREADSHEET_ID` di baris pertama dengan ID spreadsheet Anda
4. Klik **Deploy → New Deployment**
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Salin **URL Web App** yang dihasilkan

#### 3. Konfigurasi Frontend
Edit `js/config.js`, ganti nilai `GAS_URL`:
```javascript
const GAS_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
```

#### 4. Konfigurasi OCR (Opsional)
Di GAS Editor → **Project Settings → Script Properties**, tambahkan:
```
ANTHROPIC_API_KEY = sk-ant-...
```

#### 5. Hosting Frontend
Upload seluruh file HTML/CSS/JS ke hosting statis pilihan Anda:
- GitHub Pages
- Netlify / Vercel
- Google Drive (untuk akses internal)

---

## Cara Login

### Admin
Gunakan username dan password yang terdaftar di sheet `USERS` dengan role `Admin`.

### Mahasiswa
| Field | Format |
|---|---|
| **Username** | 6 digit NIU tengah dari NIM. Contoh: NIM `22/321123/TP/12345` → username `321123` |
| **Password** | Inisial nama (kapital) + 3 angka terakhir NIU. Contoh: nama `Naura Balqis Anggraeni`, NIU `321123` → password `NBA123` |

> Password mahasiswa di-generate otomatis via ARRAYFORMULA di sheet USERS dan tidak bisa direset manual dari sistem.

---

## Struktur File Frontend

```
/
├── index.html              # Halaman utama (SPA)
├── css/
│   ├── style.css           # Base styles & design system
│   ├── style-mobile.css    # Responsive overrides
│   └── style-patch.css     # Scroll & chart fixes
├── js/
│   ├── config.js           # GAS_URL, global state, callGAS(), session
│   ├── api.js              # gsr proxy (kompatibilitas google.script.run)
│   ├── nav.js              # Router, auth, sidebar, init
│   ├── utils.js            # esc(), openModal(), pagination, helpers
│   ├── dashboard.js        # Dashboard admin & mahasiswa
│   ├── inventaris.js       # Tabel inventaris, sort/filter, modal stok
│   ├── permintaan.js       # Form permintaan bahan & pinjam alat
│   ├── tagihan.js          # Tagihan bahan (mahasiswa & admin)
│   ├── peminjaman.js       # Peminjaman & pengembalian (admin)
│   ├── user.js             # Manajemen user
│   ├── export.js           # Export Excel & PDF
│   ├── misc.js             # Audit log, maintenance, limbah
│   └── survei.js           # Survei kepuasan
└── assets/
    └── foto-profil-default.png
```

---

## Catatan Teknis Penting

### ARRAYFORMULA di Sheet USERS
Baris mahasiswa di kolom A–D dikelola oleh ARRAYFORMULA yang merujuk ke `STUDENTS_DB`. **Jangan pernah** menulis manual (setValue/appendRow/deleteRow) ke kolom A–D untuk baris mahasiswa — akan merusak formula dan menyebabkan `#REF!`.

### STUDENTS_DB adalah View
Sheet `STUDENTS_DB` diisi otomatis oleh QUERY+IMPORTRANGE dari spreadsheet Rekap eksternal. Untuk update data mahasiswa, gunakan `saveStudentInfo()` yang akan menulis ke spreadsheet Rekap (sheet `DataEdit`) dan `STUDENTS_DB` akan refresh sendiri.

### Session Management
Session disimpan di `localStorage` dengan expiry 6 jam (sesuai masa berlaku token di GAS CacheService). Token diperbarui setiap kali halaman dibuka selama belum expired.

### OCR Kartu Bon
Fitur OCR membutuhkan API key Anthropic yang disimpan di GAS Script Properties. Gambar diproses di server (GAS) menggunakan Claude Vision — gambar tidak pernah dikirim ke browser lain.

---

## Bug yang Diketahui

| # | Lokasi | Deskripsi | Dampak |
|---|---|---|---|
| 1 | `utils.js` → `hideAllSec()` | `sec-survei` tidak disertakan dalam daftar section yang disembunyikan | Section survei bisa bertumpuk dengan section lain |
| 2 | `utils.js` → `resetAllNavVisibility()` | `ni-survei` & `nl-survei-label` tidak di-reset saat logout | Menu survei tetap tampil setelah logout |
| 3 | `Code.gs` → `addWasteLog()` | Kolom Tanggal di `WASTE_LOG` selalu diisi `new Date()` (waktu server), bukan tanggal yang dipilih user di form | Tanggal pembuangan limbah tidak akurat |
| 4 | `dashboard.js` → `loadAdminStudentCards()` | `_mhsCardTimer` (interval 5 detik) tidak dibersihkan saat navigasi keluar dashboard | Timer berjalan di background, bisa menyebabkan re-render tidak perlu |
| 5 | `Code.gs` → `processOcrImage()` | Model string `claude-sonnet-4-20250514` sudah deprecated | OCR mungkin gagal atau menggunakan model fallback |

### Fix Cepat

**Bug #1 & #2** — tambahkan di `utils.js`:
```javascript
// hideAllSec() — tambahkan 'sec-survei' ke array
function hideAllSec() {
  ['sec-dash-admin','sec-dash-mhs','sec-mhs-ext','sec-student-detail',
   'sec-inv','sec-req','sec-pay','sec-pem','sec-user','sec-export',
   'sec-audit','sec-maint','sec-waste','sec-survei']  // ← tambahkan
  .forEach(function(id){ var el=document.getElementById(id); if(el) el.classList.add('hidden'); });
}

// resetAllNavVisibility() — tambahkan 'ni-survei', 'nl-survei-label'
function resetAllNavVisibility() {
  ['ni-inv','ni-req','ni-pay','ni-pem','ni-user','ni-export',
   'ni-audit','ni-maint','ni-waste','nl-admin-label',
   'ni-survei','nl-survei-label']  // ← tambahkan
  .forEach(function(id){ var el=document.getElementById(id); if(el) el.classList.add('hidden'); });
}
```

**Bug #3** — di `Code.gs`, fungsi `addWasteLog()`, ubah:
```javascript
// Sebelum:
sheet.appendRow([id, new Date(), ...]);

// Sesudah:
var tglPembuangan = obj.tanggal ? new Date(obj.tanggal) : new Date();
sheet.appendRow([id, tglPembuangan, ...]);
```

**Bug #5** — di `Code.gs`, fungsi `processOcrImage()`, ubah:
```javascript
// Sebelum:
model: 'claude-sonnet-4-20250514',

// Sesudah:
model: 'claude-sonnet-4-6',
```

---

## Teknologi

| Layer | Teknologi |
|---|---|
| Frontend | HTML5, Tailwind CSS (CDN), Vanilla JavaScript |
| Backend | Google Apps Script (V8) |
| Database | Google Spreadsheet |
| Charts | Chart.js + chartjs-plugin-datalabels |
| Export | SheetJS (xlsx) |
| Alert/Dialog | SweetAlert2 |
| Icons | Bootstrap Icons |
| OCR/AI | Anthropic Claude (Vision) |

---

## Lisensi

Proyek ini dikembangkan untuk keperluan internal Laboratorium Kimia dan Biokimia Pangan dan Hasil Pertanian, Departemen Teknologi Pangan dan Hasil Pertanian, Universitas Gadjah Mada.

---

*Dikembangkan oleh tim laboratorium KBPHP — UGM*
