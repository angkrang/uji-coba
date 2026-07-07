/* ============================================================
   SURVEI KEPUASAN PENGGUNA LAB
   File: js/survei.js
   ============================================================ */

var SURVEI_PARAMS = [
  'Pelayanan Laboratorium yang Mendukung Penelitian Anda',
  'Fasilitas Bahan yang Ada di Laboratorium yang Mendukung Penelitian Anda',
  'Fasilitas Peralatan Yang Ada di Laboratorium yang Mendukung Penelitian Anda',
  'Perlindungan Terhadap Keselamatan dan Kesehatan Kerja (K3) yang Ada di Laboratorium',
  'Sarana Pendukung dan Ruang Laboratorium'
];

/* Default nama laboratorium — sistem saat ini fokus ke 1 lab ini saja.
   Dipakai untuk mengisi ulang kolom Laboratorium setiap kali form direset. */
var SURVEI_LAB_DEFAULT = 'Laboratorium Kimia dan Biokimia Pangan dan Hasil Pertanian';

var _surveiData = [], _surveiFiltered = [], _surveiEditId = null;
var _surveiEditSumberRekap = false;
var _surveiPeriodeAktif = 'ALL'; // state filter rekap periode (admin)

/* ------------------------------------------------------------
   ENTRY POINT — dipanggil dari goTo('survei') di nav.js
   ------------------------------------------------------------ */
function initSurveiPage() {
  var mhsView = document.getElementById('survei-mhs-view');
  var adminView = document.getElementById('survei-admin-view');
  if (_role === 'admin' || _role === 'plp') {
    if (mhsView) mhsView.classList.add('hidden');
    if (adminView) adminView.classList.remove('hidden');
    resetSurveiForm();
    resetSurveiRekapForm();
    switchSurveiInputTab('single');
    loadSurveiPeriodeOptions();
    loadSurveiList();
  } else {
    if (adminView) adminView.classList.add('hidden');
    if (mhsView) mhsView.classList.remove('hidden');
    resetSurveiMhsForm();
    loadSurveiMhsHistory();
    _cekStatusTriwulanMhs();
  }
}

/* ------------------------------------------------------------
   RENDER BARIS PARAMETER — radio 1..4 (admin single & mahasiswa)
   ------------------------------------------------------------ */
function _renderParamRadioRows(bodyId, namePrefix, existingVals) {
  var body = document.getElementById(bodyId);
  if (!body) return;
  body.innerHTML = SURVEI_PARAMS.map(function (p, i) {
    var opts = [1, 2, 3, 4].map(function (v) {
      var checked = existingVals && Number(existingVals[i]) === v ? 'checked' : '';
      return '<label style="display:inline-flex;align-items:center;gap:4px;margin:0 8px;cursor:pointer;font-size:13px;">'
        + '<input type="radio" name="' + namePrefix + i + '" value="' + v + '" ' + checked + '> ' + v
        + '</label>';
    }).join('');
    return '<tr><td>' + (i + 1) + '</td><td style="font-size:13px;">' + esc(p) + '</td>'
      + '<td style="text-align:center;white-space:nowrap;">' + opts + '</td></tr>';
  }).join('');
}

function _getParamRadioVals(namePrefix) {
  var vals = [];
  for (var i = 0; i < SURVEI_PARAMS.length; i++) {
    var checked = document.querySelector('input[name="' + namePrefix + i + '"]:checked');
    vals.push(checked ? parseInt(checked.value, 10) : null);
  }
  return vals;
}

/* ------------------------------------------------------------
   RENDER BARIS PARAMETER — input angka rata-rata (rekap manual)
   ------------------------------------------------------------ */
function _renderParamAvgRows(bodyId, idPrefix, existingVals) {
  var body = document.getElementById(bodyId);
  if (!body) return;
  body.innerHTML = SURVEI_PARAMS.map(function (p, i) {
    var v = (existingVals && existingVals[i] != null) ? existingVals[i] : '';
    return '<tr><td>' + (i + 1) + '</td><td style="font-size:13px;">' + esc(p) + '</td>'
      + '<td style="text-align:center;"><input type="number" id="' + idPrefix + i + '" class="form-control" '
      + 'style="text-align:center;" min="1" max="4" step="0.1" value="' + esc(String(v)) + '" placeholder="1-4"></td></tr>';
  }).join('');
}

function _getParamAvgVals(idPrefix) {
  var vals = [];
  for (var i = 0; i < SURVEI_PARAMS.length; i++) {
    var el = document.getElementById(idPrefix + i);
    var v = el ? parseFloat(el.value) : NaN;
    vals.push(isNaN(v) ? null : v);
  }
  return vals;
}

/* ============================================================
   VIEW MAHASISWA — isi survei sendiri
   ============================================================ */
function resetSurveiMhsForm() {
  ['svMhsTanggal', 'svMhsCatatan'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  var labEl = document.getElementById('svMhsLab');
  if (labEl) labEl.value = SURVEI_LAB_DEFAULT;
  _renderParamRadioRows('svMhsParamBody', 'svm');
}

/* ------------------------------------------------------------
   CEK STATUS TRIWULAN — tampilkan notif jika sudah pernah isi
   periode ini, sembunyikan form supaya mahasiswa tidak perlu
   mengisi dulu baru tahu ditolak. Validasi sesungguhnya tetap
   di server (saveSurveiKepuasan) — ini murni bantuan UX.
   ------------------------------------------------------------ */
async function _cekStatusTriwulanMhs() {
  var formCard = document.getElementById('svMhsFormCard');
  var notifCard = document.getElementById('svMhsTriwulanNotif');
  try {
    var res = await callGAS('cekSurveiTriwulan', { nim: _uname });
    if (res && res.success && res.sudahIsi) {
      if (formCard) formCard.classList.add('hidden');
      if (notifCard) {
        notifCard.classList.remove('hidden');
        notifCard.innerHTML = '<div class="callout callout-info">'
          + '<div class="callout-icon"><i class="bi bi-check-circle"></i></div>'
          + '<div><div class="callout-title" style="color:#1e40af;">Survei Periode Ini Sudah Diisi</div>'
          + '<div class="callout-body" style="color:#1e40af;">Anda sudah mengisi survei untuk periode <strong>' + esc(res.triwulan) + '</strong>. '
          + 'Survei kepuasan hanya dapat diisi 1 kali setiap 3 bulan (triwulan). Silakan isi kembali pada periode berikutnya.</div></div></div>';
      }
    } else {
      if (formCard) formCard.classList.remove('hidden');
      if (notifCard) notifCard.classList.add('hidden');
    }
  } catch (e) {
    // Jika gagal cek (misal masalah jaringan), tetap tampilkan form.
    // Fail-open di sisi UX; validasi anti-duplikat tetap aktif di backend.
    if (formCard) formCard.classList.remove('hidden');
    if (notifCard) notifCard.classList.add('hidden');
  }
}

async function submitSurveiMhs() {
  var lab = (document.getElementById('svMhsLab') || {}).value || '';
  var tanggal = (document.getElementById('svMhsTanggal') || {}).value || '';
  var catatan = (document.getElementById('svMhsCatatan') || {}).value || '';
  var vals = _getParamRadioVals('svm');

  if (!lab.trim()) { Swal.fire('Validasi', 'Laboratorium wajib diisi.', 'warning'); return; }
  if (!tanggal) { Swal.fire('Validasi', 'Tanggal pengisian wajib diisi.', 'warning'); return; }
  if (vals.some(function (v) { return v === null; })) {
    Swal.fire('Validasi', 'Semua parameter skala (1-4) wajib dipilih.', 'warning');
    return;
  }

  var payload = {
    laboratorium: lab.trim(), tanggal: tanggal, nama: _user, catatan: catatan.trim(),
    p1: vals[0], p2: vals[1], p3: vals[2], p4: vals[3], p5: vals[4],
    nim: _uname, jumlahResponden: 1
  };

  Swal.fire({ title: 'Mengirim survei...', allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });
  try {
    var res = await callGAS('saveSurveiKepuasan', payload);
    Swal.close();
    if (res && res.success) {
      Swal.fire({ icon: 'success', title: 'Terima kasih!', text: 'Survei Anda berhasil dikirim.', timer: 1800, showConfirmButton: false });
      resetSurveiMhsForm();
      loadSurveiMhsHistory();
      _cekStatusTriwulanMhs();
    } else {
      Swal.fire('Gagal', (res && res.message) || 'Tidak dapat mengirim survei.', 'error');
      _cekStatusTriwulanMhs();
    }
  } catch (e) {
    Swal.close();
    Swal.fire('Error', e.message, 'error');
  }
}

async function loadSurveiMhsHistory() {
  var tb = document.getElementById('tbSurveiMhs');
  if (!tb) return;
  tb.innerHTML = '<tr><td colspan="4"><div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-title">Memuat riwayat...</div></div></td></tr>';
  try {
    var data = await callGAS('getSurveiKepuasan');
    var mine = (data || []).filter(function (d) { return d.nim === _uname; });
    if (!mine.length) {
      tb.innerHTML = '<tr><td colspan="4"><div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-title">Belum pernah mengisi survei</div></div></td></tr>';
      return;
    }
    tb.innerHTML = mine.map(function (d) {
      var avg = _avgSurvei(d).toFixed(2);
      var ac = avg >= 3.5 ? 'b-green' : avg >= 2.5 ? 'b-blue' : avg >= 1.5 ? 'b-amber' : 'b-red';
      return '<tr><td style="font-size:12px;color:var(--muted);">' + esc(d.tanggal || '—') + '</td>'
        + '<td style="font-weight:600;">' + esc(d.laboratorium || '—') + '</td>'
        + '<td><span class="badge ' + ac + '">' + avg + '</span></td>'
        + '<td style="font-size:12px;color:var(--muted);">' + esc(d.catatan || '—') + '</td></tr>';
    }).join('');
  } catch (e) {
    tb.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--muted);">Gagal memuat riwayat.</td></tr>';
  }
}

/* ============================================================
   VIEW ADMIN — tab input
   ============================================================ */
function switchSurveiInputTab(tab) {
  var sB = document.getElementById('svtab-single'), rB = document.getElementById('svtab-rekap');
  var sP = document.getElementById('svpane-single'), rP = document.getElementById('svpane-rekap');
  if (sB) sB.classList.toggle('active', tab === 'single');
  if (rB) rB.classList.toggle('active', tab === 'rekap');
  if (sP) sP.classList.toggle('hidden', tab !== 'single');
  if (rP) rP.classList.toggle('hidden', tab !== 'rekap');
}

/* --- Input per responden --- */
function resetSurveiForm() {
  _surveiEditId = null;
  _surveiEditSumberRekap = false;
  ['svTanggal', 'svNama', 'svCatatan'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  var labEl = document.getElementById('svLab');
  if (labEl) labEl.value = SURVEI_LAB_DEFAULT;
  _renderParamRadioRows('svParamBody', 'svP');
}

async function saveSurvei() {
  var lab = (document.getElementById('svLab') || {}).value || '';
  var tanggal = (document.getElementById('svTanggal') || {}).value || '';
  var nama = (document.getElementById('svNama') || {}).value || '';
  var catatan = (document.getElementById('svCatatan') || {}).value || '';
  var vals = _getParamRadioVals('svP');

  if (!lab.trim()) { Swal.fire('Validasi', 'Laboratorium wajib diisi.', 'warning'); return; }
  if (!tanggal) { Swal.fire('Validasi', 'Tanggal pengisian wajib diisi.', 'warning'); return; }
  if (vals.some(function (v) { return v === null; })) {
    Swal.fire('Validasi', 'Semua parameter skala (1-4) wajib dipilih.', 'warning');
    return;
  }

  var payload = {
    laboratorium: lab.trim(), tanggal: tanggal, nama: nama.trim(), catatan: catatan.trim(),
    p1: vals[0], p2: vals[1], p3: vals[2], p4: vals[3], p5: vals[4],
    adminNim: _uname, jumlahResponden: 1
  };
  if (_surveiEditId) payload.id = _surveiEditId;

  Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });
  try {
    var res = await callGAS('saveSurveiKepuasan', payload);
    Swal.close();
    if (res && res.success) {
      Swal.fire({ icon: 'success', title: _surveiEditId ? 'Perubahan disimpan' : 'Tersimpan', timer: 1500, showConfirmButton: false });
      resetSurveiForm();
      loadSurveiList();
    } else {
      Swal.fire('Gagal', (res && res.message) || 'Tidak dapat menyimpan data.', 'error');
    }
  } catch (e) {
    Swal.close();
    Swal.fire('Error', e.message, 'error');
  }
}

/* --- Input rekap manual (agregat banyak responden) --- */
function resetSurveiRekapForm() {
  ['rkTanggal', 'rkJumlah', 'rkCatatan'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  var labEl = document.getElementById('rkLab');
  if (labEl) labEl.value = SURVEI_LAB_DEFAULT;
  _renderParamAvgRows('rkParamBody', 'rkP');
}

async function saveSurveiRekapManual() {
  var lab = (document.getElementById('rkLab') || {}).value || '';
  var tanggal = (document.getElementById('rkTanggal') || {}).value || '';
  var jumlah = parseInt((document.getElementById('rkJumlah') || {}).value, 10);
  var catatan = (document.getElementById('rkCatatan') || {}).value || '';
  var vals = _getParamAvgVals('rkP');

  if (!lab.trim()) { Swal.fire('Validasi', 'Laboratorium wajib diisi.', 'warning'); return; }
  if (!tanggal) { Swal.fire('Validasi', 'Tanggal/periode rekap wajib diisi.', 'warning'); return; }
  if (!jumlah || jumlah < 1) { Swal.fire('Validasi', 'Jumlah responden wajib diisi (minimal 1).', 'warning'); return; }
  if (vals.some(function (v) { return v === null || v < 1 || v > 4; })) {
    Swal.fire('Validasi', 'Semua rata-rata skor parameter wajib diisi antara 1 dan 4.', 'warning');
    return;
  }

  var payload = {
    laboratorium: lab.trim(), tanggal: tanggal, nama: '', catatan: catatan.trim(),
    p1: vals[0], p2: vals[1], p3: vals[2], p4: vals[3], p5: vals[4],
    adminNim: _uname, jumlahResponden: jumlah, isRekapManual: true
  };
  if (_surveiEditId && _surveiEditSumberRekap) payload.id = _surveiEditId;

  Swal.fire({ title: 'Menyimpan rekap...', allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });
  try {
    var res = await callGAS('saveSurveiKepuasan', payload);
    Swal.close();
    if (res && res.success) {
      Swal.fire({ icon: 'success', title: 'Rekap tersimpan', timer: 1500, showConfirmButton: false });
      resetSurveiRekapForm();
      _surveiEditId = null; _surveiEditSumberRekap = false;
      loadSurveiList();
    } else {
      Swal.fire('Gagal', (res && res.message) || 'Tidak dapat menyimpan rekap.', 'error');
    }
  } catch (e) {
    Swal.close();
    Swal.fire('Error', e.message, 'error');
  }
}

/* ------------------------------------------------------------
   LOAD & RENDER TABEL RIWAYAT (admin)
   ------------------------------------------------------------ */
async function loadSurveiList() {
  var tb = document.getElementById('tbSurvei');
  if (!tb) return;
  tb.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-title">Memuat data survei...</div></div></td></tr>';
  try {
    var data = await callGAS('getSurveiKepuasan');
    _surveiData = data || [];
    filterSurvei();
  } catch (e) {
    tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--muted);">Gagal memuat data survei.</td></tr>';
  }
}

function filterSurvei() {
  var q = ((document.getElementById('srchSurvei') || {}).value || '').toLowerCase();
  var sumberF = ((document.getElementById('filterSumberSurvei') || {}).value || '');
  _surveiFiltered = _surveiData.filter(function (d) {
    if (sumberF && (d.sumber || '').indexOf(sumberF) !== 0) return false;
    if (!q) return true;
    var hay = [d.laboratorium, d.nama, d.catatan].join(' ').toLowerCase();
    return hay.indexOf(q) !== -1;
  });
  _renderSurveiTable();
}

function _avgSurvei(d) {
  var v = [d.p1, d.p2, d.p3, d.p4, d.p5].map(Number).filter(function (n) { return !isNaN(n); });
  if (!v.length) return 0;
  return v.reduce(function (a, b) { return a + b; }, 0) / v.length;
}

function _renderSurveiTable() {
  var tb = document.getElementById('tbSurvei');
  if (!tb) return;
  if (!_surveiFiltered.length) {
    tb.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-title">Belum ada data survei</div></div></td></tr>';
    return;
  }
  tb.innerHTML = _surveiFiltered.map(function (d) {
    var avg = _avgSurvei(d).toFixed(2);
    var ac = avg >= 3.5 ? 'b-green' : avg >= 2.5 ? 'b-blue' : avg >= 1.5 ? 'b-amber' : 'b-red';
    var catatanShort = d.catatan ? (d.catatan.length > 40 ? d.catatan.substring(0, 39) + '…' : d.catatan) : '—';
    var sb = (d.sumber || '').indexOf('Mahasiswa') === 0 ? 'b-blue' : ((d.sumber||'').indexOf('Rekap') !== -1 ? 'b-purple' : 'b-gray');
    return '<tr>'
      + '<td style="font-size:12px;color:var(--muted);white-space:nowrap;">' + esc(d.tanggal || '—') + '</td>'
      + '<td style="font-weight:600;">' + esc(d.laboratorium || '—') + '</td>'
      + '<td><span class="badge ' + sb + '" style="font-size:10px;">' + esc(d.sumber || '—') + '</span></td>'
      + '<td style="text-align:center;font-weight:600;">' + esc(String(d.jumlahResponden || 1)) + '</td>'
      + '<td><span class="badge ' + ac + '">' + avg + '</span></td>'
      + '<td style="font-size:12px;color:var(--muted);">' + esc(catatanShort) + '</td>'
      + '<td style="white-space:nowrap;">'
      + '<button class="btn btn-sm btn-outline" title="Lihat detail" onclick="viewSurveiDetail(\'' + esc(d.id) + '\')"><i class="bi bi-eye"></i></button> '
      + '<button class="btn btn-sm btn-outline" title="Edit" onclick="editSurvei(\'' + esc(d.id) + '\')"><i class="bi bi-pencil-square"></i></button> '
      + '<button class="btn btn-sm" style="background:#fee2e2;color:#991b1b;border:1.5px solid #fecaca;" title="Hapus" onclick="deleteSurvei(\'' + esc(d.id) + '\')"><i class="bi bi-trash3"></i></button>'
      + '</td></tr>';
  }).join('');
}

/* ------------------------------------------------------------
   DETAIL / EDIT / HAPUS
   ------------------------------------------------------------ */
function viewSurveiDetail(id) {
  var d = _surveiData.find(function (x) { return String(x.id) === String(id); });
  if (!d) return;
  var body = document.getElementById('mdlSurveiBody');
  var rows = SURVEI_PARAMS.map(function (p, i) {
    return '<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">'
      + '<span>' + esc(p) + '</span><span style="font-weight:700;color:var(--primary);flex-shrink:0;">' + esc(String(d['p' + (i + 1)] || '—')) + '</span></div>';
  }).join('');
  body.innerHTML = '<div style="margin-bottom:12px;font-size:13px;">'
    + '<strong>Laboratorium:</strong> ' + esc(d.laboratorium || '—')
    + ' &nbsp;|&nbsp; <strong>Tanggal:</strong> ' + esc(d.tanggal || '—')
    + ' &nbsp;|&nbsp; <strong>Sumber:</strong> ' + esc(d.sumber || '—')
    + ' &nbsp;|&nbsp; <strong>Jumlah Responden:</strong> ' + esc(String(d.jumlahResponden || 1))
    + (d.nama ? (' &nbsp;|&nbsp; <strong>Responden:</strong> ' + esc(d.nama)) : '') + '</div>'
    + rows
    + '<div style="margin-top:14px;">'
    + '<strong style="font-size:13px;">Catatan dan Saran:</strong>'
    + '<div style="margin-top:6px;background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:13px;color:#374151;white-space:pre-wrap;">' + esc(d.catatan || '—') + '</div></div>';
  openModal('mdlSurveiDetail');
}

function editSurvei(id) {
  var d = _surveiData.find(function (x) { return String(x.id) === String(id); });
  if (!d) return;
  _surveiEditId = d.id;
  var isRekap = (d.sumber || '').indexOf('Rekap') !== -1 || Number(d.jumlahResponden) > 1;
  _surveiEditSumberRekap = isRekap;

  if (isRekap) {
    switchSurveiInputTab('rekap');
    document.getElementById('rkLab').value = d.laboratorium || '';
    document.getElementById('rkTanggal').value = d.tanggalRaw || '';
    document.getElementById('rkJumlah').value = d.jumlahResponden || 1;
    document.getElementById('rkCatatan').value = d.catatan || '';
    _renderParamAvgRows('rkParamBody', 'rkP', [d.p1, d.p2, d.p3, d.p4, d.p5]);
  } else {
    switchSurveiInputTab('single');
    document.getElementById('svLab').value = d.laboratorium || '';
    document.getElementById('svTanggal').value = d.tanggalRaw || '';
    document.getElementById('svNama').value = d.nama || '';
    document.getElementById('svCatatan').value = d.catatan || '';
    _renderParamRadioRows('svParamBody', 'svP', [d.p1, d.p2, d.p3, d.p4, d.p5]);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteSurvei(id) {
  var r = await Swal.fire({
    title: 'Hapus data survei ini?', icon: 'warning', showCancelButton: true,
    confirmButtonText: 'Ya, Hapus!', cancelButtonText: 'Batal', confirmButtonColor: '#dc2626'
  });
  if (!r.isConfirmed) return;
  try {
    var res = await callGAS('deleteSurveiKepuasan', { id: id, adminNim: _uname });
    if (res && res.success) {
      Swal.fire({ icon: 'success', title: 'Terhapus', timer: 1200, showConfirmButton: false });
      loadSurveiList();
    } else {
      Swal.fire('Gagal', (res && res.message) || 'Tidak dapat menghapus.', 'error');
    }
  } catch (e) {
    Swal.fire('Error', e.message, 'error');
  }
}

/* ============================================================
   REKAP PER PERIODE (TRIWULAN / TAHUNAN) — khusus admin
   Ini SATU-SATUNYA tampilan statistik/skor sekarang — card
   statis "Sepanjang Waktu" dan chart lama sudah dihapus karena
   dobel dengan tampilan ini.
   ============================================================ */

/* Isi dropdown #svFilterPeriode dengan daftar tahun & triwulan
   yang benar-benar ada datanya di sheet SURVEI_KEPUASAN. */
async function loadSurveiPeriodeOptions() {
  var sel = document.getElementById('svFilterPeriode');
  if (!sel) return;
  try {
    var res = await callGAS('getSurveiPeriodeList');
    if (!res || !res.success) return;

    var opts = ['<option value="ALL">Semua Periode (Keseluruhan)</option>'];
    opts.push('<optgroup label="Per Tahun">');
    res.tahunList.forEach(function (t) {
      opts.push('<option value="' + t + '">Tahun ' + t + '</option>');
    });
    opts.push('</optgroup>');
    opts.push('<optgroup label="Per Triwulan">');
    res.triwulanList.forEach(function (tw) {
      var label = _formatLabelTriwulan(tw);
      opts.push('<option value="' + tw + '">' + label + '</option>');
    });
    opts.push('</optgroup>');

    sel.innerHTML = opts.join('');
    sel.value = _surveiPeriodeAktif;
    loadSurveiRekapPeriode();
  } catch (e) { /* dropdown fallback ke "Semua Periode" saja */ }
}

/* Format "2026-Q2" → "Triwulan 2 2026 (Apr–Jun)" */
function _formatLabelTriwulan(tw) {
  var parts = tw.split('-Q');
  var bulanMap = { '1': 'Jan–Mar', '2': 'Apr–Jun', '3': 'Jul–Sep', '4': 'Okt–Des' };
  return 'Triwulan ' + parts[1] + ' ' + parts[0] + ' (' + (bulanMap[parts[1]] || '') + ')';
}

function onChangeSurveiPeriode() {
  var sel = document.getElementById('svFilterPeriode');
  _surveiPeriodeAktif = sel ? sel.value : 'ALL';
  loadSurveiRekapPeriode();
}

async function loadSurveiRekapPeriode() {
  var wrap = document.getElementById('svRekapPeriodeBody');
  if (!wrap) return;
  wrap.innerHTML = '<div class="skeleton" style="height:100px;border-radius:10px;"></div>';
  try {
    var res = await callGAS('getSurveiRekapPeriode', { periode: _surveiPeriodeAktif });
    if (!res || !res.success) {
      wrap.innerHTML = '<div class="empty-state"><div class="empty-state-title">Gagal memuat rekap periode.</div></div>';
      return;
    }
    _renderRekapPeriode(res);
  } catch (e) {
     console.log('DEBUG error:', e);
    wrap.innerHTML = '<div class="empty-state"><div class="empty-state-title">Gagal memuat rekap periode.</div></div>';
  }
}

function _renderRekapPeriode(res) {
  var wrap = document.getElementById('svRekapPeriodeBody');
  if (!wrap) return;

  if (!res.totalEntri) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div>'
      + '<div class="empty-state-title">Belum ada data survei untuk periode ini</div></div>';
    return;
  }

  var avgClass = function (v) { return v >= 3.5 ? 'b-green' : v >= 2.5 ? 'b-blue' : v >= 1.5 ? 'b-amber' : 'b-red'; };

  var statsHtml = '<div class="grid-4" style="margin-bottom:18px;">'
  + '<div class="stat-card"><div class="stat-icon" style="background:#dbeafe;color:#1e40af;"><i class="bi bi-people"></i></div>'
  + '<div class="stat-val">' + res.totalResponden + '</div><div class="stat-label">Total Responden</div></div>'
  + '<div class="stat-card"><div class="stat-icon" style="background:#dcfce7;color:#166534;"><i class="bi bi-emoji-smile"></i></div>'
  + '<div class="stat-val">' + res.rataRataKeseluruhan + '</div><div class="stat-label">Rata-rata Skor</div></div>'
  + '<div class="stat-card"><div class="stat-icon" style="background:#fef3c7;color:#92400e;"><i class="bi bi-journal-check"></i></div>'
  + '<div class="stat-val">' + res.totalEntri + '</div><div class="stat-label">Total Entri Survei</div></div>'
  + '<div class="stat-card"><div class="stat-icon" style="background:#ede9fe;color:#5b21b6;"><i class="bi bi-emoji-smile-fill"></i></div>'
  + '<div class="stat-val" style="font-size:14px;font-weight:700;">' + (res.rataRataKeseluruhan >= 3.5 ? 'Sangat Puas' : res.rataRataKeseluruhan >= 2.5 ? 'Puas' : res.rataRataKeseluruhan >= 1.5 ? 'Cukup' : 'Kurang') + '</div><div class="stat-label">Kategori Kepuasan</div></div>'
  + '</div>';

  var paramHtml = '<div style="margin-bottom:18px;"><div style="font-weight:700;font-size:13px;margin-bottom:10px;">Rata-rata Skor per Parameter</div>'
    + '<table class="tbl"><thead><tr><th style="width:40px;">No</th><th>Parameter</th><th style="text-align:center;width:100px;">Rata-rata</th></tr></thead><tbody>'
    + SURVEI_PARAMS.map(function (p, i) {
      var v = res.avgPerParam[i];
      return '<tr><td>' + (i + 1) + '</td><td style="font-size:13px;">' + esc(p) + '</td>'
        + '<td style="text-align:center;"><span class="badge ' + avgClass(v) + '">' + v + '</span></td></tr>';
    }).join('')
    + '</tbody></table></div>';

  var labHtml = '';
  if (res.perLaboratorium && res.perLaboratorium.length) {
    labHtml = '<div style="margin-bottom:18px;"><div style="font-weight:700;font-size:13px;margin-bottom:10px;">Rekap per Laboratorium</div>'
      + '<table class="tbl"><thead><tr><th>Laboratorium</th><th style="text-align:center;width:110px;">Responden</th><th style="text-align:center;width:110px;">Rata-rata</th></tr></thead><tbody>'
      + res.perLaboratorium.map(function (l) {
        return '<tr><td style="font-size:13px;">' + esc(l.laboratorium) + '</td>'
          + '<td style="text-align:center;font-weight:600;">' + l.responden + '</td>'
          + '<td style="text-align:center;"><span class="badge ' + avgClass(l.rataRata) + '">' + l.rataRata + '</span></td></tr>';
      }).join('')
      + '</tbody></table></div>';
  }

  var breakdownHtml = '';
  if (res.breakdownTriwulan && res.breakdownTriwulan.length > 1) {
    breakdownHtml = '<div><div style="font-weight:700;font-size:13px;margin-bottom:10px;">Rincian per Triwulan dalam Periode Ini</div>'
      + '<table class="tbl"><thead><tr><th>Triwulan</th><th style="text-align:center;width:110px;">Responden</th><th style="text-align:center;width:110px;">Rata-rata</th></tr></thead><tbody>'
      + res.breakdownTriwulan.map(function (b) {
        return '<tr><td style="font-size:13px;">' + esc(_formatLabelTriwulan(b.triwulan)) + '</td>'
          + '<td style="text-align:center;font-weight:600;">' + b.responden + '</td>'
          + '<td style="text-align:center;"><span class="badge ' + avgClass(b.rataRata) + '">' + b.rataRata + '</span></td></tr>';
      }).join('')
      + '</tbody></table></div>';
  }

  wrap.innerHTML = statsHtml + '<div id="svChartWrap" style="margin-bottom:18px;"></div>' + paramHtml + labHtml + breakdownHtml;
  _renderSurveiStackedBar(res);
}
function _renderSurveiStackedBar(res) {
  var wrap = document.getElementById('svChartWrap');
  if (!wrap) return;

  var paramLabels = [
    'P1 - Pelayanan Lab',
    'P2 - Fasilitas Bahan',
    'P3 - Fasilitas Peralatan',
    'P4 - K3',
    'P5 - Sarana & Ruang'
  ];

  var avgPerParam = res.avgPerParam || [0,0,0,0,0];

  function scoreToPct(avg) {
    avg = Math.min(4, Math.max(1, avg));
    var p1, p2, p3, p4, t;
    if (avg <= 2) {
      t = avg - 1;
      p1 = Math.round((1 - t) * 100);
      p2 = Math.round(t * 100);
      p3 = 0; p4 = 0;
    } else if (avg <= 3) {
      t = avg - 2;
      p1 = 0;
      p2 = Math.round((1 - t) * 100);
      p3 = Math.round(t * 100);
      p4 = 0;
    } else {
      t = avg - 3;
      p1 = 0; p2 = 0;
      p3 = Math.round((1 - t) * 100);
      p4 = Math.round(t * 100);
    }
    var total = p1 + p2 + p3 + p4;
    if (total !== 100) p4 += (100 - total);
    return [p1, p2, p3, p4];
  }

  var pct = avgPerParam.map(function(avg) { return scoreToPct(avg); });

  var colors = ['#ef4444','#DB8A52','#6B93C0','#22c55e'];
  var labels = ['1 - Kurang','2 - Cukup','3 - Puas','4 - Sangat Puas'];

  var legendHtml = '<div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:8px;font-size:12px;color:var(--muted);">'
    + colors.map(function(c, i) {
        return '<span style="display:flex;align-items:center;gap:5px;">'
          + '<span style="width:12px;height:12px;border-radius:2px;background:' + c + ';display:inline-block;"></span>'
          + labels[i] + '</span>';
      }).join('')
    + '</div>'
    + '<div style="font-size:11px;color:var(--muted);margin-bottom:10px;font-style:italic;">* Visualisasi proporsional berdasarkan rata-rata skor per parameter</div>';

  wrap.innerHTML = '<div style="font-weight:700;font-size:13px;margin-bottom:10px;">'
    + '<i class="bi bi-bar-chart-steps" style="color:#7c3aed;margin-right:6px;"></i>'
    + 'Distribusi Skor per Parameter (100% Stacked Bar)</div>'
    + legendHtml
    + '<div style="position:relative;width:100%;height:' + (paramLabels.length * 52 + 60) + 'px;">'
    + '<canvas id="svStackedChart" role="img" aria-label="Grafik distribusi skor survei kepuasan per parameter">'
    + 'Grafik distribusi skor 1-4 untuk 5 parameter survei kepuasan.</canvas></div>';

  if (typeof Chart === 'undefined') return;

  var existing = Chart.getChart('svStackedChart');
  if (existing) existing.destroy();

  new Chart(document.getElementById('svStackedChart'), {
    type: 'bar',
    data: {
      labels: paramLabels.map(function(l, i) {
        return l + ' (' + (avgPerParam[i] || 0).toFixed(2) + ')';
      }),
      datasets: [
        { label: '1 - Kurang',      data: pct.map(function(r) { return r[0]; }), backgroundColor: '#ef4444', borderSkipped: false },
        { label: '2 - Cukup',       data: pct.map(function(r) { return r[1]; }), backgroundColor: '#DB8A52', borderSkipped: false },
        { label: '3 - Puas',        data: pct.map(function(r) { return r[2]; }), backgroundColor: '#6B93C0', borderSkipped: false },
        { label: '4 - Sangat Puas', data: pct.map(function(r) { return r[3]; }), backgroundColor: '#22c55e', borderSkipped: false }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: function(items) {
              var idx = items[0].dataIndex;
              return 'P' + (idx + 1) + ' — Rata-rata: ' + (avgPerParam[idx] || 0).toFixed(2);
            },
            label: function(ctx) {
              return ' ' + ctx.dataset.label + ': ' + ctx.parsed.x + '%';
            }
          }
        },
        datalabels: { display: false }
      },
      scales: {
        x: {
          stacked: true,
          max: 100,
          ticks: {
            callback: function(v) { return v + '%'; },
            font: { size: 11 }
          },
          grid: { color: 'rgba(0,0,0,0.06)' }
        },
        y: {
          stacked: true,
          ticks: { font: { size: 11 } },
          grid: { display: false }
        }
      }
    }
  });
}
