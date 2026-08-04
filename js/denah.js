/* ============================================================
   DENAH.JS — Denah Meja Kerja Laboratorium
   Integrasi dengan LabInventori via callGAS()
   ============================================================
   Aturan akses:
     - Lihat denah        → SEMUA role (Admin, PLP, Dosen, Mahasiswa)
     - Isi/ubah identitas  → HANYA Admin & PLP
     - Identitas HARUS dipilih dari mahasiswa yang sudah terdaftar
       di sistem (bukan input bebas) — diambil dari getMahasiswaExternal

   GAS actions yang dibutuhkan (tambahkan di Code.gs — lihat
   contoh backend terpisah "denah-code-gs-snippet.gs"):
     getDenahMeja          → return array semua stasiun meja + isinya
     assignMejaIdentitas   → params: {meja, posisi, nim}      (admin/plp only)
     unassignMejaIdentitas → params: {meja, posisi}           (admin/plp only)
   ============================================================ */

/* ----------------------------------------------------------
   LAYOUT LAB — 4 meja panjang, masing-masing 8 stasiun kerja
   (4 stasiun sisi atas + 4 stasiun sisi bawah, sesuai denah fisik)
   ---------------------------------------------------------- */
var DNH_TABLES = [
  { id: 'meja1', label: 'Meja 1' },
  { id: 'meja2', label: 'Meja 2' },
  { id: 'meja3', label: 'Meja 3' },
  { id: 'meja4', label: 'Meja 4' }
];
var DNH_STATION_ICONS = ['bi-droplet-half', 'bi-square', 'bi-list-ul', 'bi-diagram-3'];
var DNH_STATION_LABELS = ['Erlenmeyer', 'Umum', 'Tabung Reaksi', 'Struktur/Molekul'];

/* data denah aktif di memori: array {meja, posisi, kode, nim, nama, status, updatedAt} */
var _denahData = [];
/* daftar mahasiswa terdaftar (sumber identitas — TIDAK BOLEH input bebas) */
var _denahMhsList = [];
var _activeStasiun = null;
var _denahPickedNim = '';

/* ----------------------------------------------------------
   LOAD DATA dari GAS
   ---------------------------------------------------------- */
async function loadDenahMeja() {
  var wrap = document.getElementById('denah-map-wrap');
  if (wrap) wrap.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-title">Memuat denah meja...</div></div>';

  try {
    var data = await callGAS('getDenahMeja');
    if (!data || !Array.isArray(data) || data.length === 0) data = _denahDemoData();
    _denahData = data;
  } catch (e) {
    _denahData = _denahDemoData();
  }

  /* muat daftar mahasiswa terdaftar (untuk dropdown identitas — hanya perlu utk admin/plp,
     tapi dimuat sekali saja di awal supaya modal langsung siap) */
  if (_role === 'admin' || _role === 'plp') {
    try {
      var mhs = await callGAS('getMahasiswaExternal');
      _denahMhsList = Array.isArray(mhs) ? mhs : [];
    } catch (e) {
      _denahMhsList = [];
    }
  }

  _renderDenahStats();
  _renderDenahMap();
}

/* ----------------------------------------------------------
   STATS BAR
   ---------------------------------------------------------- */
function _renderDenahStats() {
  var total = DNH_TABLES.length * 8;
  var terisi = _denahData.filter(function (d) { return d.nim; }).length;
  var kosong = total - terisi;

  var el = document.getElementById('denah-stats');
  if (!el) return;
  el.innerHTML = [
    { n: total, l: 'Total Stasiun', col: 'var(--text)', ic: 'bi-grid-3x3-gap', bg: 'var(--primary-faint)' },
    { n: terisi, l: 'Sudah Diisi', col: 'var(--primary)', ic: 'bi-person-fill', bg: '#dbeafe' },
    { n: kosong, l: 'Belum Diisi', col: 'var(--success)', ic: 'bi-square', bg: '#dcfce7' }
  ].map(function (s) {
    return '<div class="stat-card" style="flex:1;min-width:0">'
      + '<div class="sc-icon-wrap" style="background:' + s.bg + ';width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:8px">'
      + '<i class="bi ' + s.ic + '" style="color:' + s.col + ';font-size:15px"></i></div>'
      + '<div style="font-size:11px;color:var(--muted);font-weight:500;margin-bottom:3px">' + s.l + '</div>'
      + '<div style="font-size:22px;font-weight:800;color:' + s.col + '">' + s.n + '</div>'
      + '</div>';
  }).join('');
}

/* ----------------------------------------------------------
   HELPERS DATA
   ---------------------------------------------------------- */
function _denahByPos(meja, posisi) {
  for (var i = 0; i < _denahData.length; i++) {
    if (_denahData[i].meja === meja && _denahData[i].posisi === posisi) return _denahData[i];
  }
  return { meja: meja, posisi: posisi, kode: _denahKode(meja, posisi), nim: '', nama: '', status: '', updatedAt: '', updatedBy: '' };
}
function _denahKode(meja, posisi) {
  var mejaNum = meja.replace('meja', '');
  var sisi = posisi.charAt(0) === 'a' ? 'A' : 'B';
  var num = posisi.charAt(1);
  return 'M' + mejaNum + '-' + sisi + num;
}

/* ----------------------------------------------------------
   RENDER DENAH (kartu meja, mirroring layout fisik: 4 kursi atas,
   4 stasiun atas, meja, 4 stasiun bawah, 4 kursi bawah)
   ---------------------------------------------------------- */
function _renderDenahMap() {
  var wrap = document.getElementById('denah-map-wrap');
  if (!wrap) return;

  wrap.innerHTML = '<div id="denah-grid"></div>';
  var grid = document.getElementById('denah-grid');

  DNH_TABLES.forEach(function (t) {
    var card = document.createElement('div');
    card.className = 'dnh-table-card';

    var lbl = document.createElement('div');
    lbl.className = 'dnh-table-label';
    lbl.innerHTML = '<i class="bi bi-table" style="margin-right:6px"></i>' + esc(t.label);
    card.appendChild(lbl);

    /* kursi atas (dekoratif) */
    card.appendChild(_dnhSeatRow());

    /* stasiun atas (a1..a4) */
    var rowA = document.createElement('div');
    rowA.className = 'dnh-station-row';
    for (var i = 1; i <= 4; i++) rowA.appendChild(_dnhStationEl(t.id, 'a' + i, i - 1));
    card.appendChild(rowA);

    /* permukaan meja (dekoratif — outlet & keran gas) */
    var surface = document.createElement('div');
    surface.className = 'dnh-table-surface';
    surface.innerHTML = '<span class="dnh-fixture"><i class="bi bi-plug"></i></span>'
      + '<span class="dnh-fixture"><i class="bi bi-plug"></i></span>'
      + '<span class="dnh-fixture dnh-fx-gas"><i class="bi bi-fire"></i></span>'
      + '<span class="dnh-fixture dnh-fx-gas"><i class="bi bi-fire"></i></span>'
      + '<span class="dnh-fixture"><i class="bi bi-plug"></i></span>'
      + '<span class="dnh-fixture"><i class="bi bi-plug"></i></span>';
    card.appendChild(surface);

    /* stasiun bawah (b1..b4) */
    var rowB = document.createElement('div');
    rowB.className = 'dnh-station-row';
    for (var j = 1; j <= 4; j++) rowB.appendChild(_dnhStationEl(t.id, 'b' + j, j - 1));
    card.appendChild(rowB);

    /* kursi bawah (dekoratif) */
    card.appendChild(_dnhSeatRow());

    grid.appendChild(card);
  });
}

function _dnhSeatRow() {
  var row = document.createElement('div');
  row.className = 'dnh-seat-row';
  for (var i = 0; i < 4; i++) {
    var s = document.createElement('span');
    s.className = 'dnh-seat';
    row.appendChild(s);
  }
  return row;
}

function _dnhStationEl(meja, posisi, iconIdx) {
  var d = _denahByPos(meja, posisi);
  var filled = !!d.nim;
  var perluDikosongkan = filled && !!d.sudahLulus;
  var el = document.createElement('div');
  el.className = 'dnh-station' + (filled ? ' dnh-filled' : ' dnh-empty') + (perluDikosongkan ? ' dnh-lulus' : '');
  el.innerHTML = '<span class="dnh-st-icon"><i class="bi ' + DNH_STATION_ICONS[iconIdx] + '"></i></span>'
    + '<span class="dnh-st-kode">' + esc(d.kode) + '</span>'
    + '<span class="dnh-st-name">' + (filled ? esc(d.nama) : 'Kosong') + '</span>'
    + (perluDikosongkan ? '<span class="dnh-st-badge" title="Mahasiswa sudah lulus, meja perlu dikosongkan"><i class="bi bi-exclamation-triangle-fill"></i> Lulus</span>' : '');
  el.onclick = function () { _openDenahModal(meja, posisi); };
  return el;
}

/* ----------------------------------------------------------
   MODAL DETAIL / EDIT STASIUN
   ---------------------------------------------------------- */
function _openDenahModal(meja, posisi) {
  var d = _denahByPos(meja, posisi);
  _activeStasiun = { meja: meja, posisi: posisi };
  _denahPickedNim = d.nim || '';

  var isAdmin = (_role === 'admin' || _role === 'plp');
  var mejaLabel = (DNH_TABLES.filter(function (t) { return t.id === meja; })[0] || {}).label || meja;
  var sisiLabel = (posisi.charAt(0) === 'a' ? 'Sisi Barat' : 'Sisi Timur') + ' — Stasiun ' + posisi.charAt(1);

  document.getElementById('dnm-title').textContent = 'Stasiun ' + d.kode;
  document.getElementById('dnm-kode').textContent = d.kode;
  document.getElementById('dnm-meja').textContent = mejaLabel + ' (' + sisiLabel + ')';
  document.getElementById('dnm-nama').textContent = d.nama || '— Belum diisi —';
  document.getElementById('dnm-nim').textContent = d.nim || '—';
  document.getElementById('dnm-updated').textContent = d.updatedAt ? (d.updatedAt + (d.updatedBy ? ' oleh ' + d.updatedBy : '')) : '—';

  var lulusWarn = document.getElementById('dnm-lulus-warning');
  if (lulusWarn) lulusWarn.classList.toggle('hidden', !d.sudahLulus);

  var editWrap = document.getElementById('dnm-edit-wrap');
  if (editWrap) {
    if (isAdmin) {
      editWrap.classList.remove('hidden');
      var searchEl = document.getElementById('dnmMhsSearch');
      var hiddenEl = document.getElementById('dnmMhsNim');
      if (searchEl) searchEl.value = d.nim ? (d.nim + ' — ' + d.nama) : '';
      if (hiddenEl) hiddenEl.value = d.nim || '';
      _denahPickedNim = d.nim || '';
      document.getElementById('dnmUnassignBtn').classList.toggle('hidden', !d.nim);
      _hideDenahDropdown();
    } else {
      editWrap.classList.add('hidden');
    }
  }

  document.getElementById('denah-modal-bg').classList.add('open');
}

function closeDenahModal() {
  document.getElementById('denah-modal-bg').classList.remove('open');
  _activeStasiun = null;
}

/* ----------------------------------------------------------
   DROPDOWN PENCARIAN MAHASISWA — HANYA dari data terdaftar,
   tidak ada opsi input bebas.
   ---------------------------------------------------------- */
function filterDenahMhsSearch() {
  var q = (document.getElementById('dnmMhsSearch').value || '').toLowerCase().trim();
  document.getElementById('dnmMhsNim').value = ''; // reset pilihan sampai user klik item valid
  var dd = document.getElementById('dnmMhsDropdown');
  if (!dd) return;

  var list = _denahMhsList.filter(function (m) {
    if (!q) return true;
    var hay = ((m.nim || '') + ' ' + (m.nama || '')).toLowerCase();
    return hay.indexOf(q) !== -1;
  }).slice(0, 30);

  if (!list.length) {
    dd.innerHTML = '<div style="padding:10px 12px;font-size:12px;color:var(--muted)">Tidak ada mahasiswa terdaftar yang cocok.</div>';
  } else {
    dd.innerHTML = list.map(function (m) {
      var status = (m.status || '').toLowerCase().trim();
      var aktif = status === 'aktif';
      var lulus = status === 'lulus';
      /* Mahasiswa Lulus ditampilkan tapi tidak bisa diklik/dipilih —
         hak pakai meja kerja sudah dicabut sejak status Lulus.
         Validasi sesungguhnya tetap di server (assignMejaIdentitas). */
      var clickAttr = lulus ? '' : ' onmousedown="_pickDenahMhs(\'' + esc(m.nim) + '\',\'' + esc((m.nama || '').replace(/'/g, "\\'")) + '\')"';
      return '<div class="dnh-dd-item' + (lulus ? ' dnh-dd-disabled' : '') + '"' + clickAttr + '>'
        + '<div style="font-weight:700;font-size:12.5px;color:var(--text)">' + esc(m.nama || '—') + '</div>'
        + '<div style="font-size:11px;color:var(--muted)">' + esc(m.nim || '—') + (aktif ? '' : ' · <span style="color:var(--danger)">' + esc(m.status || 'Tidak aktif') + (lulus ? ' — tidak berhak pakai meja' : '') + '</span>') + '</div>'
        + '</div>';
    }).join('');
  }
  dd.style.display = 'block';
}
function showDenahMhsDropdown() { filterDenahMhsSearch(); }
function _hideDenahDropdown() { var dd = document.getElementById('dnmMhsDropdown'); if (dd) dd.style.display = 'none'; }
function hideDenahMhsDropdown() { setTimeout(_hideDenahDropdown, 200); }

function _pickDenahMhs(nim, nama) {
  document.getElementById('dnmMhsSearch').value = nim + ' — ' + nama;
  document.getElementById('dnmMhsNim').value = nim;
  _denahPickedNim = nim;
  _hideDenahDropdown();
}

/* ----------------------------------------------------------
   SIMPAN / KOSONGKAN
   ---------------------------------------------------------- */
async function saveDenahEdit() {
  if (!_activeStasiun) return;
  var nim = (document.getElementById('dnmMhsNim').value || '').trim();

  if (!nim) {
    Swal.fire('Peringatan', 'Pilih mahasiswa dari daftar yang sudah terdaftar terlebih dahulu. Nama tidak bisa diketik bebas.', 'warning');
    return;
  }

  Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });
  try {
    var res = await callGAS('assignMejaIdentitas', {
      meja: _activeStasiun.meja,
      posisi: _activeStasiun.posisi,
      nim: nim,
      adminNim: _uname
    });
    Swal.close();
    if (res && res.success) {
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Identitas stasiun berhasil disimpan', showConfirmButton: false, timer: 2000 });
      closeDenahModal();
      loadDenahMeja();
    } else {
      Swal.fire('Gagal', (res && res.message) || 'Terjadi kesalahan', 'error');
    }
  } catch (e) {
    Swal.close();
    Swal.fire('Error', e.message, 'error');
  }
}

async function unassignDenah() {
  if (!_activeStasiun) return;
  var conf = await Swal.fire({ title: 'Kosongkan stasiun ini?', icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, kosongkan', cancelButtonText: 'Batal' });
  if (!conf.isConfirmed) return;

  Swal.fire({ title: 'Memproses...', allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });
  try {
    var res = await callGAS('unassignMejaIdentitas', {
      meja: _activeStasiun.meja,
      posisi: _activeStasiun.posisi,
      adminNim: _uname
    });
    Swal.close();
    if (res && res.success) {
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Stasiun dikosongkan', showConfirmButton: false, timer: 2000 });
      closeDenahModal();
      loadDenahMeja();
    } else {
      Swal.fire('Gagal', (res && res.message) || 'Terjadi kesalahan', 'error');
    }
  } catch (e) {
    Swal.close();
    Swal.fire('Error', e.message, 'error');
  }
}

/* ----------------------------------------------------------
   FILTER / SEARCH DI DENAH
   ---------------------------------------------------------- */
function filterDenah() {
  var q = (document.getElementById('denah-search') || {}).value || '';
  q = q.toLowerCase();
  document.querySelectorAll('.dnh-station').forEach(function (el) {
    var txt = el.textContent.toLowerCase();
    el.style.opacity = (!q || txt.indexOf(q) !== -1) ? '1' : '0.25';
  });
}

/* ----------------------------------------------------------
   DEMO DATA (fallback sebelum GAS tersedia)
   ---------------------------------------------------------- */
function _denahDemoData() {
  function D(meja, posisi, nim, nama) {
    return {
      meja: meja, posisi: posisi, kode: _denahKode(meja, posisi),
      nim: nim || '', nama: nama || '', status: nim ? 'Aktif' : '',
      updatedAt: nim ? '20 Jul 2026' : '', updatedBy: nim ? 'PLP' : ''
    };
  }
  return [
    D('meja1', 'a1', '22/501344', 'Sinta Dewi'),
    D('meja1', 'a3', '21/483201', 'Rizky Aditya'),
    D('meja1', 'b2', '23/510988', 'Fauzan Hidayat'),
    D('meja2', 'a2', '21/475300', 'Mega Prasasti'),
    D('meja2', 'b4', '22/499120', 'Laras Wulandari'),
    D('meja3', 'a4', '22/498770', 'Yoga Pratama'),
    D('meja4', 'b1', '23/512001', 'Nita Kusuma')
  ];
}
