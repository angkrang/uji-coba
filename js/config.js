/* ============================================================
   KONFIGURASI — GANTI URL INI dengan URL GAS Web App Anda
   Deploy GAS sebagai: "Execute as: Me", "Who has access: Anyone"
   ============================================================ */
const GAS_URL = 'https://script.google.com/macros/s/AKfycby7E44WJvlbfY4lJjbM8heLN_bmw_BzNOJjpF3Ap_ecGuhZ_lWQgHWlSLPhidzDs2Rp/exec';

/* ============================================================
   GLOBAL STATE
   ============================================================ */
var _user = '', _uname = '', _role = '';
var _chemData = [], _toolData = [];
var _stokItemNama = '', _stokType = '';
var _kbNim = '', _kbAlatNama = '', _kbAlatJml = 0;
var _editUsername = '';
var _exportTipe = '', _reqType = '';
var _hargaMap = {};
var SESSION_KEY    = 'labinv_session';
var SESSION_EXPIRY = 5.5 * 60 * 60 * 1000; // 5.5 jam — sedikit lebih pendek dari token server (6 jam)
                                             // supaya logout duluan sebelum token expired di server
/* ============================================================
   API BRIDGE
   ============================================================ */
var _token = ''; // ← deklarasi global, taruh di paling atas file (sekali saja)

async function callGAS(action, params) {
  try {
    params = params || {};
    params.token = _token; // ← tambahkan baris ini: selalu sisipkan token ke setiap request

    const url = new URL(GAS_URL);
    url.searchParams.set('action', action);
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, params: params })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    try { return JSON.parse(text); } catch(e) { return text; }
  } catch (err) {
    console.error('callGAS error:', action, err);
    throw err;
  }
}

/* ============================================================
   SESSION HELPERS
   Ganti sessionStorage → localStorage + expiry 8 jam
   Sehingga user tidak logout saat layar HP terkunci
   ============================================================ */
function _saveSession() {
  var d = {
    user : _user,
    uname: _uname,
    role : _role,
    token: _token,
    exp  : Date.now() + SESSION_EXPIRY   // ← pakai variable, bukan hardcode
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(d));
}

function _loadSession() {
  try {
    var raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    var d = JSON.parse(raw);
    if (!d.uname || !d.role || !d.token) return false;  // ← tambahkan cek token
    /* Session kedaluwarsa → paksa login ulang */
    if (d.exp && Date.now() > d.exp) {
      localStorage.removeItem(SESSION_KEY);
      return false;
    }
    _user  = d.user  || '';
    _uname = d.uname || '';
    _role  = d.role  || '';
    _token = d.token || '';   // ← tambahkan baris ini
    /* Perpanjang expiry selama user masih aktif */
    _saveSession();
    return true;
  } catch(e) {
    localStorage.removeItem(SESSION_KEY);
    return false;
  }
}

function _clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch(e) {}
}
