/**
 * api.js — FIXED VERSION
 * File ini HANYA berjalan di BROWSER (frontend).
 * JANGAN tempel kode Apps Script (SpreadsheetApp, LockService, dll)
 * ke file ini — itu harus masuk ke project Apps Script terpisah
 * (Code.gs di script.google.com), bukan di sini.
 */

const GAS_URL = 'https://script.google.com/macros/s/AKfycby7E44WJvlbfY4lJjbM8heLN_bmw_BzNOJjpF3Ap_ecGuhZ_lWQgHWlSLPhidzDs2Rp/exec';

const gsr = (() => {
  let _successFn = null;
  let _failureFn = null;

  async function _call(action, args) {
    /* Bangun params object dari args array */
    const params = _buildParams(action, args);

    /* Body yang dikirim: { action, params }
       Ini persis yang dibaca handleRequest() di Code.gs */
    const bodyObj = { action, params };

    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        body  : JSON.stringify(bodyObj)
        /* TIDAK ada Content-Type header:
           - Browser default ke text/plain → simple request (no preflight)
           - GAS baca dari e.postData.contents → JSON.parse() → dapat action & params
           - Jika ditambah Content-Type: application/json → preflight → CORS error
           - Jika Content-Type: text/plain eksplisit → sama saja, tapi lebih aman biarkan default */
      });

      if (!response.ok) throw new Error('HTTP ' + response.status);

      const text = await response.text();
      let data;
      try { data = JSON.parse(text); }
      catch(e) { data = text; }

      /* GAS handleRequest() return object langsung (bukan {ok, data})
         Jadi kita pass seluruh response ke successHandler */
      if (_successFn) _successFn(data);

    } catch (err) {
      console.error('[gsr] error pada action:', action, err);
      if (_failureFn) _failureFn(err);
      else console.error('[gsr] (no failure handler):', err);
    } finally {
      _successFn = null;
      _failureFn = null;
    }
  }

  /**
   * Konversi args array → params object
   * sesuai signature masing-masing fungsi GAS
   */
  function _buildParams(action, args) {
    /* Fungsi yang menerima object tunggal sebagai argumen pertama */
    const objFns = [
      'addChemical', 'addEquipment', 'addUser',
      'submitChemicalRequest', 'submitToolRequest',
      'saveStudentInfo', 'addMaintenanceLog', 'addWasteLog',
      'updateUserInfo', 'getMahasiswaExternalByNim'
    ];

    /* Fungsi tanpa parameter */
    const noParamFns = [
      'getDashboardStats', 'getAnalyticsData', 'getChemicals', 'getTools',
      'getAllBorrowings', 'getReturnRequests', 'getPaymentRequests',
      'getUserList', 'getAuditLog', 'getMaintenanceLog', 'getWasteLog',
      'getMahasiswaExternal', 'getMahasiswaExternalStats'
    ];

    if (noParamFns.includes(action)) return {};

    if (objFns.includes(action)) {
      /* Jika arg pertama sudah object → kirim langsung sebagai params
         Jika bukan (misal string) → wrap dalam { obj } */
      var first = args[0];
      if (first && typeof first === 'object' && !Array.isArray(first)) return first;
      return { obj: first };
    }

    /* Mapping action → nama parameter sesuai signature di Code.gs */
    const maps = {
      loginUser              : ['username', 'password'],
      updateChemicalStock    : ['namaBahan', 'jumlahTambah', 'adminNim'],
      updateToolStock        : ['namaAlat',  'jumlahTambah', 'adminNim'],
      updateEquipmentKategori: ['namaAlat',  'kategori',     'adminNim'],
      getActiveEquipmentLoans: ['nim'],
      getMahasiswaChemicalLoans: ['nim'],
      getStudentEquipmentHistory: ['nim'],
      getBorrowingDetails    : ['nim'],
      getStudentInfo         : ['nim'],
      getMyPaymentRequests   : ['nim'],
      submitReturnRequest    : ['nim', 'namaAlat', 'jumlahKembali', 'kondisi', 'catatan'],
      confirmReturnRequest   : ['idReq', 'adminNim'],
      rejectReturnRequest    : ['idReq', 'adminNim', 'alasan'],
      returnEquipment        : ['nim', 'namaAlat', 'jumlahKembali', 'kondisi', 'adminNim'],
      updateReturnStatus     : ['nim', 'status', 'adminNim'],
      updatePaymentStatus    : ['nim', 'status', 'adminNim'],
      approveLabClearance    : ['nim', 'adminName'],
      cancelLabClearance     : ['nim'],
      resetLabClearance      : ['nim', 'adminNim'],
      submitPaymentRequest   : ['nim', 'totalBiaya', 'detailItems', 'catatan'],
      confirmPaymentRequest  : ['idReq', 'adminNim'],
      rejectPaymentRequest   : ['idReq', 'adminNim', 'alasan'],
      deleteUser             : ['username'],
      resetUserPassword      : ['username', 'newPassword'],
      getExportData          : ['tipe'],
      processOcrImage        : ['imageBase64', 'imageMime', 'type'],
    };

    if (maps[action]) {
      var params = {};
      maps[action].forEach(function(key, i) {
        if (args[i] !== undefined) params[key] = args[i];
      });
      return params;
    }

    /* Fallback: jika tidak ada mapping, kirim args[0] apa adanya */
    return args[0] || {};
  }

  /* Proxy handler untuk gsr.withSuccessHandler(fn).namaFungsi(...) */
  const handler = {
    get(target, prop) {
      if (prop === 'withSuccessHandler') {
        return (fn) => { _successFn = fn; return new Proxy({}, handler); };
      }
      if (prop === 'withFailureHandler') {
        return (fn) => { _failureFn = fn; return new Proxy({}, handler); };
      }
      return (...args) => { _call(prop, args); };
    }
  };

  return new Proxy({}, handler);
})();

/* Alias untuk kompatibilitas mundur */
window.google = window.google || {};
window.google.script = window.google.script || {};
window.google.script.run = gsr;
