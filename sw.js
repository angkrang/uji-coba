/* ============================================================
   sw.js — Service Worker LabInventory
   Strategi:
   - App shell (HTML/CSS/JS/assets) di-precache saat install,
     lalu disajikan dengan "stale-while-revalidate" supaya
     tetap bisa dibuka offline tapi selalu update di background.
   - HTML utama (navigasi) pakai "network-first" supaya user
     selalu dapat versi terbaru saat online, fallback ke cache
     saat offline.
   - Request ke luar origin (Google Apps Script API, CDN, font,
     dsb) TIDAK disentuh sama sekali — dibiarkan lewat langsung
     ke network seperti biasa, supaya data tidak pernah basi.

   VERSIONING OTOMATIS (hash konten):
   Nama cache TIDAK ditulis manual (bukan 'v1', 'v2', dst).
   Saat install, semua file APP_SHELL diambil dengan cache:'no-store'
   (bypass cache HTTP browser), lalu isinya digabung dan di-hash
   (SHA-256). Hash itu dipakai sebagai nama cache.

   Akibatnya: kalau ADA SATU FILE SAJA yang isinya berubah di server
   (index.html, css apa pun, js apa pun) → hash berubah otomatis →
   activate event akan melihat nama cache lama tidak cocok lagi →
   cache lama dihapus, precache baru dibuat dari file-file terbaru.

   Anda TIDAK PERLU edit angka versi di file ini lagi untuk setiap
   deploy. Tinggal upload file yang sudah diubah ke server seperti
   biasa — service worker akan mendeteksi sendiri di pembukaan
   berikutnya (umumnya dalam beberapa detik/saat reload halaman).
   ============================================================ */

const CACHE_PREFIX = 'labinventory-';
const APP_SHELL = [
  './',
  'index.html',
  'manifest.json',
  'css/style.css',
  'css/style-mobile.css',
  'css/style-patch.css',
  'js/config.js',
  'js/utils.js',
  'js/nav.js',
  'js/dashboard.js',
  'js/inventaris.js',
  'js/permintaan.js',
  'js/tagihan.js',
  'js/peminjaman.js',
  'js/user.js',
  'js/export.js',
  'js/misc.js',
  'js/survei.js',
  'assets/android-chrome-192x192.png',
  'assets/apple-touch-icon.png',
  'assets/favicon-16x16.png',
  'assets/favicon-32x32.png',
  'assets/icon-512.png',
  'assets/icon-512-maskable.png',
  'assets/icon-192-maskable.png',
];

/* ---------- HELPER: hitung hash gabungan dari isi semua file ---------- */
async function _computeShellHash() {
  const buffers = [];
  for (const path of APP_SHELL) {
    try {
      // cache:'no-store' -> WAJIB, supaya benar-benar ambil isi
      // terbaru dari server saat menghitung hash, bukan dari cache
      // HTTP browser yang mungkin masih menyimpan versi lama.
      const res = await fetch(path, { cache: 'no-store' });
      buffers.push(await res.arrayBuffer());
    } catch (e) {
      // Kalau satu file gagal diambil (offline saat install pertama,
      // path tidak ada, dll), tetap lanjut -- nanti fallback ke
      // addAll() di bawah yang akan melempar error yang lebih jelas.
      buffers.push(new TextEncoder().encode(path + ':error'));
    }
  }
  // Gabungkan semua buffer jadi satu, lalu SHA-256
  const totalLen = buffers.reduce((sum, b) => sum + b.byteLength, 0);
  const merged = new Uint8Array(totalLen);
  let offset = 0;
  for (const b of buffers) {
    merged.set(new Uint8Array(b), offset);
    offset += b.byteLength;
  }
  const digest = await crypto.subtle.digest('SHA-256', merged);
  const hashArray = Array.from(new Uint8Array(digest));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex.substring(0, 16); // 16 karakter cukup untuk identifikasi unik
}

/* ---------- INSTALL: hitung hash, precache app shell ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    _computeShellHash().then((hash) => {
      const cacheName = CACHE_PREFIX + hash;
      return caches.open(cacheName).then((cache) => cache.addAll(APP_SHELL));
    })
  );
  self.skipWaiting();
});

/* ---------- ACTIVATE: bersihkan SEMUA cache versi lain ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    _computeShellHash().then((hash) => {
      const currentCacheName = CACHE_PREFIX + hash;
      return caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith(CACHE_PREFIX) && k !== currentCacheName)
            .map((k) => caches.delete(k))
        )
      );
    })
  );
  self.clients.claim();
});

/* ---------- FETCH ---------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Hanya tangani GET. Selain itu (POST ke GAS API, dll) biarkan lewat normal.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Hanya tangani request same-origin (file aplikasi sendiri).
  // Request ke domain lain (script.google.com, CDN, fonts, dll) dibiarkan
  // lewat langsung ke network — tidak pernah di-cache, supaya data API
  // dan library eksternal selalu fresh.
  if (url.origin !== self.location.origin) return;

  // Navigasi halaman (HTML) -> network-first, fallback ke cache saat offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.keys().then((keys) => {
            const myCache = keys.find((k) => k.startsWith(CACHE_PREFIX));
            if (myCache) caches.open(myCache).then((cache) => cache.put(req, copy));
          });
          return res;
        })
        .catch(() => caches.match('index.html'))
    );
    return;
  }

  // Aset statis (css/js/gambar) -> stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchAndUpdate = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.keys().then((keys) => {
              const myCache = keys.find((k) => k.startsWith(CACHE_PREFIX));
              if (myCache) caches.open(myCache).then((cache) => cache.put(req, copy));
            });
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchAndUpdate;
    })
  );
});
