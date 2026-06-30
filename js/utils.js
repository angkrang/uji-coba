/* ============================================================
   UTILITY FUNCTIONS
   ============================================================ */

function esc(s) {
  return (s||'').toString()
    .replace(/&/g,'&amp;').replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function openModal(id)  { var el=document.getElementById(id); if(el) el.classList.remove('hidden'); }
function closeModal(id) { var el=document.getElementById(id); if(el) el.classList.add('hidden'); }

function formatRupiah(angka) {
  if (!angka || isNaN(angka)) return 'Rp 0';
  return 'Rp ' + Number(angka).toLocaleString('id-ID');
}

function statusBadge(v) {
  var c='b-gray', vl=(v||'').toLowerCase().trim();
  if (vl==='sudah kembali'||vl==='lunas'||vl==='approved'||vl==='aman'||vl==='tersedia') c='b-green';
  else if (vl==='sebagian'||vl==='hampir habis'||vl==='jumlah terbatas') c='b-amber';
  else if (vl==='belum kembali'||vl==='belum lunas'||vl==='kritis'||vl==='habis'||vl==='stok minim') c='b-red';
  return '<span class="badge '+c+'">'+esc(v)+'</span>';
}

function selClass(v) {
  var vl=(v||'').toLowerCase();
  if (vl==='sudah kembali'||vl==='lunas'||vl==='approved') return 'sel-green';
  if (vl==='sebagian') return 'sel-amber';
  return 'sel-red';
}

function hideSplash() {
  var splash = document.getElementById('splashScreen');
  if (!splash) return;
  splash.style.transition = 'opacity 0.5s ease';
  splash.style.opacity = '0';
  setTimeout(function(){ splash.style.display='none'; }, 500);
}

function togglePasswordVisibility() {
  var inp = document.getElementById('loginPass');
  var icon = document.getElementById('togglePassIcon');
  if (!inp) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    if(icon) { icon.classList.remove('bi-eye'); icon.classList.add('bi-eye-slash'); }
  } else {
    inp.type = 'password';
    if(icon) { icon.classList.remove('bi-eye-slash'); icon.classList.add('bi-eye'); }
  }
}

/* ============================================================
   FIX #1 & #8:
   - Tambahkan 'sec-survei' agar section survei ikut
     disembunyikan saat navigasi antar halaman
   - Hapus duplikat 'sec-student-detail' (sebelumnya muncul
     dua kali di array yang sama)
   ============================================================ */
function hideAllSec() {
  [
    'sec-dash-admin',
    'sec-dash-mhs',
    'sec-mhs-ext',
    'sec-student-detail',
    'sec-inv',
    'sec-req',
    'sec-pay',
    'sec-pem',
    'sec-user',
    'sec-export',
    'sec-audit',
    'sec-maint',
    'sec-waste',
    'sec-survei',         // FIX #1: ditambahkan — sebelumnya tidak ada
                          // FIX #8: duplikat 'sec-student-detail' dihapus
    'sec-dosen'           // DOSEN: dashboard bimbingan
  ].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
}

/* ============================================================
   FIX #2:
   - Tambahkan 'ni-survei' dan 'nl-survei-label' agar
     menu survei ikut di-reset ke hidden saat logout atau
     saat resetAllNavVisibility() dipanggil
   ============================================================ */
function resetAllNavVisibility() {
  [
    'ni-inv',
    'ni-req',
    'ni-pay',
    'ni-pem',
    'ni-user',
    'ni-export',
    'ni-audit',
    'ni-maint',
    'ni-waste',
    'nl-admin-label',
    'ni-survei',          // FIX #2: ditambahkan
    'nl-survei-label',    // FIX #2: ditambahkan
    'ni-dosen'            // DOSEN: menu bimbingan
  ].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
}

function _toInputDate(s) {
  if (!s || s === '—') return '';
  var p = s.split('/');
  if (p.length !== 3) return '';
  var pad = function(n){ return n.length===1 ? '0'+n : n; };
  return p[2] + '-' + pad(p[1]) + '-' + pad(p[0]);
}

/* ============================================================
   PAGINATION HELPER
   ============================================================ */
var INV_PER_PAGE = 25;
var _invState = {
  bahan: { data: [], page: 1, filtered: [] },
  alat:  { data: [], page: 1, filtered: [] }
};

function renderPagedTable(type, data, page, renderRowFn) {
  var state = _invState[type];
  state.filtered = data;
  state.page = Math.max(1, Math.min(page, Math.ceil(data.length / INV_PER_PAGE) || 1));
  var start = (state.page - 1) * INV_PER_PAGE;
  var slice = data.slice(start, start + INV_PER_PAGE);
  var tbodyId = type === 'bahan' ? 'tbBahan' : 'tbAlat';
  var cols    = type === 'bahan' ? 5 : 6;
  var tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = !data.length
    ? '<tr><td colspan="'+cols+'"><div class="empty-state"><div class="empty-state-icon">'+(type==='bahan'?'🧪':'🔧')+'</div><div class="empty-state-title">Tidak ada data</div><div class="empty-state-sub">Coba ubah kata kunci pencarian</div></div></td></tr>'
    : slice.map(renderRowFn).join('');
  var total = data.length, totalPg = Math.ceil(total / INV_PER_PAGE) || 1;
  var prefix = type === 'bahan' ? 'pgBahan' : 'pgAlat';
  var wrap = document.getElementById(prefix + 'Wrap');
  if (total <= INV_PER_PAGE) { if(wrap) wrap.classList.add('hidden'); return; }
  if(wrap) wrap.classList.remove('hidden');
  var from = start + 1, to = Math.min(start + INV_PER_PAGE, total);
  var infoEl = document.getElementById(prefix + 'Info');
  var btnsEl = document.getElementById(prefix + 'Btns');
  if(infoEl) infoEl.textContent = 'Menampilkan ' + from + '–' + to + ' dari ' + total + ' item';
  var cur = state.page, pages = [];
  if (totalPg <= 7) { for (var i = 1; i <= totalPg; i++) pages.push(i); }
  else {
    pages = [1];
    if (cur > 3) pages.push('…');
    for (var j = Math.max(2, cur-1); j <= Math.min(totalPg-1, cur+1); j++) pages.push(j);
    if (cur < totalPg - 2) pages.push('…');
    pages.push(totalPg);
  }
  var goFn = type === 'bahan' ? 'goBahanPage' : 'goAlatPage';
  if(btnsEl) btnsEl.innerHTML =
    '<button class="pg-btn" '+(cur===1?'disabled':'onclick="'+goFn+'('+(cur-1)+')"')+'><i class="bi bi-chevron-left"></i></button>' +
    pages.map(function(p) {
      if (p==='…') return '<span class="pg-btn" style="border:none;background:none;color:var(--muted);cursor:default;">…</span>';
      return '<button class="pg-btn'+(p===cur?' active':'')+'" onclick="'+goFn+'('+p+')">'+p+'</button>';
    }).join('') +
    '<button class="pg-btn" '+(cur===totalPg?'disabled':'onclick="'+goFn+'('+(cur+1)+')"')+'><i class="bi bi-chevron-right"></i></button>';
}

function goBahanPage(p) { if (window._renderBahanPage) window._renderBahanPage(p); }
function goAlatPage(p)  { if (window._renderAlatPage)  window._renderAlatPage(p); }

/* ============================================================
   TERBILANG — konversi angka ke teks bahasa Indonesia
   Dipakai di formulir tagihan (baris "Terbilang: ...rupiah")
   ============================================================ */
function terbilang(angka) {
  angka = Math.floor(Math.abs(Number(angka) || 0));
  if (angka === 0) return 'nol rupiah';

  var satuan = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan',
    'sepuluh', 'sebelas'];

  function _kata(n) {
    n = Math.floor(n);
    if (n < 12) return satuan[n];
    if (n < 20) return _kata(n - 10) + ' belas';
    if (n < 100) return _kata(Math.floor(n / 10)) + ' puluh' + (n % 10 !== 0 ? ' ' + _kata(n % 10) : '');
    if (n < 200) return 'seratus' + (n - 100 !== 0 ? ' ' + _kata(n - 100) : '');
    if (n < 1000) return _kata(Math.floor(n / 100)) + ' ratus' + (n % 100 !== 0 ? ' ' + _kata(n % 100) : '');
    if (n < 2000) return 'seribu' + (n - 1000 !== 0 ? ' ' + _kata(n - 1000) : '');
    if (n < 1000000) return _kata(Math.floor(n / 1000)) + ' ribu' + (n % 1000 !== 0 ? ' ' + _kata(n % 1000) : '');
    if (n < 1000000000) return _kata(Math.floor(n / 1000000)) + ' juta' + (n % 1000000 !== 0 ? ' ' + _kata(n % 1000000) : '');
    return _kata(Math.floor(n / 1000000000)) + ' miliar' + (n % 1000000000 !== 0 ? ' ' + _kata(n % 1000000000) : '');
  }

  var teks = _kata(angka).trim().replace(/\s+/g, ' ');
  return teks.charAt(0).toUpperCase() + teks.slice(1) + ' rupiah';
}

/* ============================================================
   RENDER FORMULIR TAGIHAN BAHAN KIMIA
   Layout meniru "Formulir Penggunaan Bahan Kimia Untuk Penelitian"
   (Departemen TPHP UGM). Dipakai bersama di:
   - Ringkasan tagihan mahasiswa (tagihan.js -> loadPaySummary)
   - Modal detail tagihan admin (tagihan.js -> viewPayDetail)
   - Export laporan tagihan (export.js)

   Parameter:
   - info: { nama, nim }  -- Program Studi SENGAJA dikosongkan
     (belum ada datanya di sistem; ditulis tangan setelah print)
   - items: [{ nama, qty, unit, harga, total }]
   - opts: { printMode: boolean }  -- printMode = border lebih
     tegas untuk hasil cetak/PDF, dipakai oleh export.js
   ============================================================ */
function renderTagihanForm(info, items, opts) {
  opts = opts || {};
  info = info || {};
  items = items || [];

  var grandTotal = items.reduce(function (sum, it) { return sum + (Number(it.total) || 0); }, 0);

  var rows = items.map(function (it, i) {
    return '<tr>'
      + '<td class="col-no">' + (i + 1) + '</td>'
      + '<td>' + esc(it.nama) + '</td>'
      + '<td class="col-jumlah">' + esc(it.qty) + ' ' + esc(it.unit || '') + '</td>'
      + '<td class="col-harga">' + formatRupiah(it.harga) + '</td>'
      + '<td class="col-total">' + formatRupiah(it.total) + '</td>'
      + '</tr>';
  }).join('');

  if (!rows) {
    rows = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:16px;">Tidak ada item bahan kimia.</td></tr>';
  }

  var cls = 'tagihan-form' + (opts.printMode ? ' print-mode' : '');

  return ''
    + '<div class="' + cls + '">'
    +   '<div class="tagihan-form-header">'
    +     '<div class="tagihan-form-header-row"><span class="tagihan-form-header-label">Nama Mahasiswa</span><span class="tagihan-form-header-sep">:</span><span class="tagihan-form-header-value">' + esc(info.nama || '-') + '</span></div>'
    +     '<div class="tagihan-form-header-row"><span class="tagihan-form-header-label">Nomor Mahasiswa</span><span class="tagihan-form-header-sep">:</span><span class="tagihan-form-header-value">' + esc(info.nim || '-') + '</span></div>'
    +     '<div class="tagihan-form-header-row"><span class="tagihan-form-header-label">Program Studi/Fakultas/PT</span><span class="tagihan-form-header-sep">:</span><span class="tagihan-form-header-value is-blank">....................................</span></div>'
    +   '</div>'
    +   '<table class="tagihan-form-table">'
    +     '<thead><tr>'
    +       '<th style="width:36px;">No.</th>'
    +       '<th>Nama Bahan Kimia</th>'
    +       '<th>Jumlah</th>'
    +       '<th>Harga Satuan (Rp)</th>'
    +       '<th>Jumlah Harga (Rp)</th>'
    +     '</tr></thead>'
    +     '<tbody>' + rows + '</tbody>'
    +     '<tfoot><tr class="total-row"><td class="label" colspan="4">Total (Rp)</td><td class="value">' + formatRupiah(grandTotal) + '</td></tr></tfoot>'
    +   '</table>'
    +   '<div class="tagihan-form-terbilang"><span class="label">Terbilang:</span><span class="value">' + esc(terbilang(grandTotal)) + '</span></div>'
    + '</div>';
}
