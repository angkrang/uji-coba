/* ============================================================
   NAVIGATION & ROLE UI
   ============================================================ */

var _adminMenus = [
  {id:'dash',   icon:'bi-grid-1x2',         label:'Dashboard'},
  {id:'mhs-ext',icon:'bi-person-lines-fill', label:'Mahasiswa'},
  {id:'inv',    icon:'bi-box-seam',          label:'Inventaris'},
  {id:'pem',    icon:'bi-people',            label:'Peminjaman'},
  {id:'pay',    icon:'bi-receipt',           label:'Tagihan'},
  {id:'user',   icon:'bi-person-gear',       label:'User'},
  {id:'export', icon:'bi-download',          label:'Export'},
  {id:'audit',  icon:'bi-journal-text',      label:'Audit'},
  {id:'maint',  icon:'bi-wrench-adjustable', label:'Maintenance'},
  {id:'waste',  icon:'bi-trash3',            label:'Limbah'},
  {id:'survei', icon:'bi-emoji-smile',       label:'Survei'}, // >>> SURVEI: entri menu admin
];
var _mhsMenus = [
  {id:'dash', icon:'bi-grid-1x2',        label:'Dashboard'},
  {id:'inv',  icon:'bi-box-seam',        label:'Inventaris'},
  {id:'req',  icon:'bi-clipboard-check', label:'Permintaan'},
  {id:'ret',  icon:'bi-arrow-return-left', label:'Pengembalian'},
  {id:'pay',  icon:'bi-receipt',         label:'Tagihan'},
   {id:'survei', icon:'bi-emoji-smile',   label:'Survei'},
];

function _buildBottomNav(role) { /*dihapus saja */}

function setActive(navId) {
  document.querySelectorAll('.nav-link').forEach(function(el){ el.classList.remove('active'); });
  var el = document.getElementById(navId);
  if (el) el.classList.add('active');
}

function _roleLabel() {
  if (_role === 'admin') return 'Administrator';
  if (_role === 'dosen') return 'Dosen';
  return 'Mahasiswa';
}

function _applyRoleUI() {
  var initials = _user ? _user.charAt(0).toUpperCase() : 'U';
  var ua=document.getElementById('userAvatar'); if(ua) ua.textContent=initials;
  var ucn=document.getElementById('userChipName'); if(ucn) ucn.textContent=_user;
  var ucr=document.getElementById('userChipRole'); if(ucr) ucr.textContent=_roleLabel();
  var sa=document.getElementById('sidebarAvatar'); if(sa) sa.textContent=initials;
  var sun=document.getElementById('sidebarUserName'); if(sun) sun.textContent=_user;
  var sur=document.getElementById('sidebarUserRole'); if(sur) sur.textContent=_roleLabel();
  var sr=document.getElementById('sidebarRole'); if(sr) sr.textContent=_roleLabel();
  var mtn=document.getElementById('mtName'); if(mtn) mtn.textContent=_user;
  var mta=document.getElementById('mtAvatar'); if(mta) mta.textContent=initials;

  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('appWrap').classList.remove('hidden'); // FIX: tampilkan kembali mobile topbar setiap kali user berhasil login
  var mtb = document.getElementById('mobileTopbar'); if (mtb) mtb.classList.remove('hidden');

  resetAllNavVisibility();

  if (_role === 'admin') {
    ['ni-mhs-ext','ni-inv','ni-pem','ni-pay','ni-user','ni-export','ni-audit','ni-maint','ni-waste','nl-admin-label']
      .forEach(function(id){ var el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
    var niReq=document.getElementById('ni-req'); if(niReq) niReq.classList.add('hidden');
    var niRet=document.getElementById('ni-ret'); if(niRet) niRet.classList.add('hidden');
  } else if (_role === 'dosen') {
    // Dosen: tampilan menu SAMA dengan admin, ditambah menu "Bimbingan Saya"
    ['ni-mhs-ext','ni-inv','ni-pem','ni-pay','ni-user','ni-export','ni-audit','ni-maint','ni-waste','nl-admin-label','ni-dosen']
      .forEach(function(id){ var el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
    var niReq2=document.getElementById('ni-req'); if(niReq2) niReq2.classList.add('hidden');
    var niRet2=document.getElementById('ni-ret'); if(niRet2) niRet2.classList.add('hidden');
  } else {
    ['ni-req','ni-ret','ni-pay','ni-inv'].forEach(function(id){ var el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
    var niMhsExt=document.getElementById('ni-mhs-ext'); if(niMhsExt) niMhsExt.classList.add('hidden');
  }
  // Survei Kepuasan: tampil untuk Admin maupun Mahasiswa, kontennya beda (lihat survei.js)
  // (Dosen belum punya halaman survei — sengaja tidak ditampilkan untuk role dosen)
  if (_role !== 'dosen') {
    ['ni-survei','nl-survei-label'].forEach(function(id){ var el=document.getElementById(id); if(el) el.classList.remove('hidden'); });
  }

  _buildBottomNav(_role);
}
/* ============================================================
   SIDEBAR TOGGLE
   ============================================================ */
function toggleSidebar() {
   if (!_role) return;
   
  var sidebar  = document.getElementById('sidebar');
  var backdrop = document.getElementById('sidebarBackdrop');
  if (sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
    backdrop.classList.remove('show');
    document.body.style.overflow = '';
  } else {
    sidebar.classList.add('open');
    backdrop.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.remove('show');
  document.body.style.overflow = '';
}
/* ============================================================
   MAIN ROUTER
   ============================================================ */
function goTo(sec) {
   closeSidebar();
  hideAllSec(); 
   document.querySelectorAll('#mainContent > div[id^="sec-"]').forEach(function(el){
    el.classList.add('hidden');
  });
   setActive('nl-'+sec);

  var titleMap = {
    'dash'           : 'Dashboard',
    'mhs-ext'        : 'Data Mahasiswa',
    'student-detail' : 'Detail Mahasiswa',
    'inv'            : 'Inventaris',
    'req'            : 'Permintaan & Pinjam',
    'ret'            : 'Pengembalian Alat',
    'pay'            : 'Tagihan Bahan',
    'pem'            : 'Peminjaman',
    'user'           : 'Kelola User',
    'export'         : 'Export Laporan',
    'audit'          : 'Audit Log',
    'maint'          : 'Maintenance',
    'waste'          : 'Pengelolaan Limbah',
    'survei'         : 'Survei Kepuasan', // >>> SURVEI: judul topbar & mobile title
    'dosen'          : 'Bimbingan Saya'
  };
  var tt=document.getElementById('topbarTitle'); if(tt) tt.textContent=titleMap[sec]||'Dashboard';
  var mt=document.getElementById('mtTitle'); if(mt) mt.textContent=titleMap[sec]||'Dashboard';

  if (sec === 'dash') {
    if (_role === 'admin' || _role === 'dosen') {
      // Dosen: dashboard utama dibuat sama persis dengan tampilan admin
      var el = document.getElementById('sec-dash-admin'); if(el) el.classList.remove('hidden');
      loadAdminDash();
    } else {
      var el2 = document.getElementById('sec-dash-mhs'); if(el2) el2.classList.remove('hidden');
      loadMhsAll();
    }

  } else if (sec === 'dosen') {
    var elDsn = document.getElementById('sec-dosen'); if(elDsn) elDsn.classList.remove('hidden');
    loadDosenDashboard();

  } else if (sec === 'mhs-ext') {
    var el = document.getElementById('sec-mhs-ext'); if(el) el.classList.remove('hidden');
    loadMhsExt();

  } else if (sec === 'student-detail') {
    // Halaman detail mahasiswa — konten dirender oleh loadStudentDetail(nim)
    var el = document.getElementById('sec-student-detail'); if(el) el.classList.remove('hidden');

  } else if (sec === 'inv') {
    var el = document.getElementById('sec-inv'); if(el) el.classList.remove('hidden');
    loadInv();

  } else if (sec === 'req') {
    var el = document.getElementById('sec-req'); if(el) el.classList.remove('hidden');
    switchReqTab('req'); loadReqDropdowns(); loadReqHistory();

  } else if (sec === 'ret') {
    var el = document.getElementById('sec-req'); if(el) el.classList.remove('hidden');
    switchReqTab('ret');

  } else if (sec === 'pay') {
    var el = document.getElementById('sec-pay'); if(el) el.classList.remove('hidden');
    if (_role === 'admin' || _role === 'dosen') {
      document.getElementById('pay-mhs-view').classList.add('hidden');
      document.getElementById('pay-admin-view').classList.remove('hidden');
      loadAdminPayRequests();
    } else {
      document.getElementById('pay-mhs-view').classList.remove('hidden');
      document.getElementById('pay-admin-view').classList.add('hidden');
      loadPaySummary(); loadPayHistory(); loadBebasLabStatus();
    }

  } else if (sec === 'pem') {
    var el = document.getElementById('sec-pem'); if(el) el.classList.remove('hidden');
    loadPem(); loadReturnRequestsAdmin();

  } else if (sec === 'user') {
    var el = document.getElementById('sec-user'); if(el) el.classList.remove('hidden');
    loadUsers();

  } else if (sec === 'export') {
    var el = document.getElementById('sec-export'); if(el) el.classList.remove('hidden');

  } else if (sec === 'audit') {
    var el = document.getElementById('sec-audit'); if(el) el.classList.remove('hidden');
    loadAudit();

  } else if (sec === 'maint') {
    var el = document.getElementById('sec-maint'); if(el) el.classList.remove('hidden');
    loadMaint();

  } else if (sec === 'waste') {
    var el = document.getElementById('sec-waste'); if(el) el.classList.remove('hidden');
    loadWaste();

  } else if (sec === 'survei') { // >>> SURVEI: routing ke halaman survei kepuasan
    var el = document.getElementById('sec-survei'); if(el) el.classList.remove('hidden');
    initSurveiPage();
  }
}

/* ============================================================
   TAB HELPERS
   ============================================================ */
function switchReqTab(t) {
  var rpReq = document.getElementById('rp-req');
  var rpRet = document.getElementById('rp-ret');
  if (rpReq) rpReq.classList.toggle('hidden', t!=='req');
  if (rpRet) rpRet.classList.toggle('hidden', t!=='ret');
  if (t === 'ret') { loadMhsActiveLoans(); loadReturnHistory(); }
}

function switchInvTab(t) {
  document.getElementById('it-bahan').classList.toggle('active', t==='bahan');
  document.getElementById('it-alat').classList.toggle('active',  t==='alat');
  document.getElementById('ip-bahan').classList.toggle('hidden', t!=='bahan');
  document.getElementById('ip-alat').classList.toggle('hidden',  t!=='alat');
}

function switchChart(t) {
  document.getElementById('tc-bahan').classList.toggle('active', t==='bahan');
  document.getElementById('tc-alat').classList.toggle('active',  t==='alat');
  document.getElementById('cp-bahan').classList.toggle('hidden', t!=='bahan');
  document.getElementById('cp-alat').classList.toggle('hidden',  t!=='alat');
   // Paksa chart resize setelah tab muncul
  setTimeout(function() {
    if (t === 'bahan' && window._chartBahan) window._chartBahan.resize();
    if (t === 'alat'  && window._chartAlat)  window._chartAlat.resize();
  }, 50);
}

/* ============================================================
   AUTH
   ============================================================ */
async function doLogin() {
  var u = (document.getElementById('loginUser')||{}).value||'';
  var p = (document.getElementById('loginPass')||{}).value||'';
  u = u.trim(); p = p.trim();
  if (!u || !p) { Swal.fire('Peringatan','Username dan password wajib diisi','warning'); return; }
  var btn = document.getElementById('loginBtn');
  if(btn){ btn.disabled=true; btn.innerHTML='<i class="bi bi-hourglass-split"></i> Masuk...'; }
  Swal.fire({ title:'Verifikasi...', allowOutsideClick:false, didOpen:function(){ Swal.showLoading(); } });
  try {
    var res = await callGAS('loginUser', {username:u, password:p});
    Swal.close();
    if (res && res.success) {
      _token = res.token;
      _user  = res.nama;
      _uname = res.username;
      _role  = (res.role||'').toLowerCase();
      _saveSession();
      _applyRoleUI();
      hideAllSec();
      _chemData=[]; _toolData=[]; _hargaMap={};
      goTo('dash');
      if (_role === 'admin' || _role === 'dosen') refreshNavBadges();
    } else {
      Swal.fire({ icon:'error', title:'Login Gagal', text:'Username atau password salah. Periksa kembali data Anda.' });
    }
  } catch(err) {
    Swal.close();
    Swal.fire({ icon:'error', title:'Koneksi Gagal', text:'Tidak dapat menghubungi server. Coba beberapa saat lagi.' });
  } finally {
    if(btn){ btn.disabled=false; btn.innerHTML='<i class="bi bi-box-arrow-in-right"></i> Masuk ke Sistem'; }
  }
}

async function doLogout() {           // ← ubah jadi async
  await callGAS('logoutUser', {});    // ← tambahkan baris ini: hapus token di server
  _clearSession();
  _user=''; _uname=''; _role=''; _token='';   // ← tambahkan _token='' di sini
  _chemData=[]; _toolData=[]; _hargaMap={};
  _stokItemNama=''; _stokType='';
  _kbNim=''; _kbAlatNama=''; _kbAlatJml=0;
  _editUsername=''; _exportTipe=''; _reqType='';

  closeSidebar();
  var sidebar  = document.getElementById('sidebar');  if (sidebar)  sidebar.classList.remove('open');
  var backdrop = document.getElementById('sidebarBackdrop'); if (backdrop) backdrop.classList.remove('show');
  document.body.style.overflow = '';

   ['userAvatar','sidebarAvatar','mtAvatar'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.textContent = '';
  });
  ['userChipName','sidebarUserName','mtName'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.textContent = '';
  });
  ['userChipRole','sidebarUserRole','sidebarRole'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.textContent = '';
  });

  // FIX: paksa sembunyikan SEMUA menu role-specific, jangan andalkan
  // resetAllNavVisibility() saja (untuk jaga-jaga kalau itu belum lengkap)
  [
    'ni-mhs-ext','ni-inv','ni-pem','ni-pay','ni-user','ni-export',
    'ni-audit','ni-maint','ni-waste','ni-req','ni-ret','ni-dosen',
    'ni-survei','nl-admin-label','nl-survei-label'
  ].forEach(function(id){ var el=document.getElementById(id); if (el) el.classList.add('hidden'); });

   var mtb = document.getElementById('mobileTopbar'); if (mtb) mtb.classList.add('hidden');

  var smv=document.getElementById('survei-mhs-view'); if(smv) smv.classList.remove('hidden');
  var sav=document.getElementById('survei-admin-view'); if(sav) sav.classList.add('hidden');

  document.getElementById('appWrap').classList.add('hidden');
  document.getElementById('loginPage').style.display='flex';
  var lu=document.getElementById('loginUser'); if(lu) lu.value='';
  var lp=document.getElementById('loginPass'); if(lp) lp.value='';
  hideAllSec(); resetAllNavVisibility();
}

/* ============================================================
   NAV BADGES
   ============================================================ */
async function refreshNavBadges() {
  try {
    var s = await callGAS('getDashboardStats');
    var nb = document.getElementById('navBadgePay');
    if(nb){ if((s.pendingPayment||0)>0){nb.textContent=s.pendingPayment;nb.classList.remove('hidden');}else nb.classList.add('hidden'); }
    var nr = document.getElementById('navBadgeRet');
    if(nr){ if((s.pendingReturn||0)>0){nr.textContent=s.pendingReturn;nr.classList.remove('hidden');}else nr.classList.add('hidden'); }
    var rb = document.getElementById('retReqBadge');
    if(rb){ if((s.pendingReturn||0)>0){rb.textContent=s.pendingReturn+' pending';rb.classList.remove('hidden');}else rb.classList.add('hidden'); }
  } catch(e) {}
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() { hideSplash(); }, 2000);

  if (_loadSession()) {
    _applyRoleUI();
    hideAllSec();
    _chemData=[]; _toolData=[]; _hargaMap={};
    goTo('dash');
    hideSplash();
  } else {
    var mtb = document.getElementById('mobileTopbar'); if (mtb) mtb.classList.add('hidden');
    hideSplash();
  }

  var passEl = document.getElementById('loginPass');
  if (passEl) passEl.addEventListener('keypress', function(e){ if(e.key==='Enter') doLogin(); });
  var userEl = document.getElementById('loginUser');
  if (userEl) userEl.addEventListener('keypress', function(e){ if(e.key==='Enter') doLogin(); });

  var hints = ['Memuat komponen antarmuka...','Menghubungkan ke server...','Menyiapkan data laboratorium...','Hampir selesai...'];
  var hi = 0;
  var hintEl = document.getElementById('splashHint');
  if (hintEl) setInterval(function(){ hintEl.textContent=hints[hi%hints.length]; hi++; }, 800);
});
/* ============================================================
   MOBILE BACK BUTTON — Hardware/gesture back di Android
   ============================================================ */
(function () {
  var _currentSec = 'dash'; // track section aktif

  // Patch goTo() agar selalu update _currentSec
  var _origGoTo = goTo;
  goTo = function (sec) {
    _currentSec = sec;
    _origGoTo(sec);
  };

  // Push state awal sebagai "jebakan" pertama
  history.pushState({ labApp: true }, '', location.href);

  window.addEventListener('popstate', function () {
    // Selalu push ulang agar back berikutnya tetap bisa dicegat
    history.pushState({ labApp: true }, '', location.href);

    if (_currentSec === 'dash') {
      // Sudah di dashboard → keluar app
      // Di Android WebView/TWA ini akan minimize/close app
      // Di browser biasa akan pindah ke tab sebelumnya
      history.go(-2);
    } else {
      // Section lain → kembali ke dashboard
      goTo('dash');
    }
  });
})();
