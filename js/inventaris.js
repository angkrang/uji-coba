/* =====================================================================================================================================================
   INVENTARIS — Sort & Filter Kolom Dropdown filter memakai position:fixed (dirender ke <body>) sehingga tidak ter-clip oleh overflow atau sticky thead.
   ===================================================================================================================================================== */

/* ── State sort/filter ── */
var _sortBahan       = { col: null, dir: 'asc' };
var _sortAlat        = { col: null, dir: 'asc' };
var _filterBahanKat  = '';
var _filterBahanStat = '';
var _filterBahanLok  = '';
var _filterAlatKat   = '';
var _filterAlatStat  = '';
var _filterAlatLok   = '';

/* ── Satu elemen dropdown global yang di-mount ke <body> ── */
var _invDropEl = null;
var _invDropKey = '';
/* ============================================================
   INISIALISASI DROPDOWN GLOBAL (dipanggil sekali dari DOMContentLoaded)
   ============================================================ */
function _initInvDrop() {
  if (document.getElementById('invFilterDropGlobal')) return;
  var el = document.createElement('div');
  el.id = 'invFilterDropGlobal';
  el.style.cssText = [
    'position:fixed',
    'z-index:99999',
    'background:#fff',
    'border:1.5px solid #e4eaf4',
    'border-radius:10px',
    'box-shadow:0 8px 28px rgba(0,0,0,0.14)',
    'padding:10px',
    'min-width:190px',
    'display:none'
  ].join(';');
  document.body.appendChild(el);
  _invDropEl = el;

  /* Tutup kalau klik di luar */
  document.addEventListener('click', function(e) {
    if (_invDropEl && !_invDropEl.contains(e.target)) _closeInvDrop();
  });
  /* Tutup kalau scroll */
  window.addEventListener('scroll', _closeInvDrop, true);
}

function _closeInvDrop() {
  if (_invDropEl) { _invDropEl.style.display = 'none'; }
  _invDropKey = '';
}
/* ============================================================
   LOAD INVENTARIS
   ============================================================ */
async function loadInv() {
  _initInvDrop();

  if (_role === 'admin' || _role === 'plp') {
    document.getElementById('btnAddBahanWrap').classList.remove('hidden');
    document.getElementById('btnAddAlatWrap').classList.remove('hidden');
  } else {
    document.getElementById('btnAddBahanWrap').classList.add('hidden');
    document.getElementById('btnAddAlatWrap').classList.add('hidden');
  }

  /* ── BAHAN ── */
  try {
    var chems = await callGAS('getChemicals');
    _chemData = chems;
    _hargaMap = {};
    chems.forEach(function(b) {
      var key = (b.nama||b.name||'').toString().trim().toLowerCase();
      if(key) _hargaMap[key] = { harga: Number(b.harga||b.Harga||b.price||0), satuan: b.satuan||b.unit||'' };
    });
    _sortBahan       = { col: null, dir: 'asc' };
    _filterBahanKat  = '';
    _filterBahanStat = '';
    _renderBahanHeader();
    _invState.bahan.filtered = chems;
    window._renderBahanPage = function(p) {
      renderPagedTable('bahan', _getSortedFilteredBahan(), p, _rowBahan);
    };
    window._renderBahanPage(1);
  } catch(e) {}

  /* ── ALAT ── */
  try {
    var tools = await callGAS('getTools');
    _toolData = tools;
    _sortAlat       = { col: null, dir: 'asc' };
    _filterAlatKat  = '';
    _filterAlatStat = '';
    _renderAlatHeader();
    _invState.alat.filtered = tools;
    window._renderAlatPage = function(p) {
      renderPagedTable('alat', _getSortedFilteredAlat(), p, _rowAlat);
    };
    window._renderAlatPage(1);
  } catch(e) {}
}
/* ============================================================
   ROW RENDERERS
   ============================================================ */
function _rowBahan(item) {
  var idx = _chemData.indexOf(item);
  var sc  = 'b-gray', st = (item.status || '').toLowerCase();
  if (st.includes('aman'))                              sc = 'b-green';
  else if (st.includes('hampir'))                       sc = 'b-amber';
  else if (st.includes('kritis') || st.includes('habis')) sc = 'b-red';

  var hargaTxt = (item.harga > 0)
    ? '<div style="font-size:11px;color:var(--muted);">' + formatRupiah(item.harga) + '/' + esc(item.satuan) + '</div>'
    : '';
  var aksi = (_role === 'admin' || _role === 'plp')
    ? '<button class="btn btn-xs btn-outline" style="color:var(--primary);border-color:var(--primary);" onclick="openStokModal(\'bahan\',' + idx + ')"><i class="bi bi-pencil"></i> Stok</button>'
    : '';

  return '<tr>'
    + '<td><div style="font-weight:700;">' + esc(item.nama) + '</div>'
    + '<div style="font-size:11.5px;color:var(--muted);">' + esc(item.rumus || '—') + '</div>' + hargaTxt + '</td>'
    + '<td class="tc"><span class="badge b-gray" style="font-size:11px;">' + esc(item.kategori || '—') + '</span></td>'
    + '<td class="tc"><div style="font-weight:700;">' + item.stok + ' ' + esc(item.satuan) + '</div>'
    + '<span class="badge ' + sc + '" style="font-size:10px;">' + esc(item.status || '—') + '</span></td>'
    + '<td style="font-size:12.5px;color:var(--muted);">' + esc(item.lokasi || '—') + '</td>'
    + '<td class="tc">' + aksi + '</td>'
    + '</tr>';
}

function _rowAlat(item) {
  var idx = _toolData.indexOf(item);
  var sc  = 'b-green', st = (item.status || '').toLowerCase();
  if (st.includes('habis') || st.includes('stok minim')) sc = 'b-red';
  else if (st.includes('jumlah terbatas'))               sc = 'b-amber';

  var aksi = (_role === 'admin' || _role === 'plp')
    ? '<button class="btn btn-xs btn-outline" style="color:var(--success);border-color:var(--success);" onclick="openStokModal(\'alat\',' + idx + ')"><i class="bi bi-pencil"></i> Stok</button>'
    : '';
  var katHtml = item.kategori
    ? '<span class="badge b-purple" style="font-size:10px;">' + esc(item.kategori) + '</span>'
    : '<span style="color:var(--muted);font-size:12px;">—</span>';

  return '<tr>'
    + '<td><div style="font-weight:700;">' + esc(item.nama) + '</div>'
    + '<div style="font-size:11.5px;color:var(--muted);">' + esc(item.id || '—') + '</div></td>'
    + '<td class="tc" style="font-size:12.5px;color:var(--muted);">' + esc(item.spek || '—') + '</td>'
    + '<td class="tc"><div style="font-weight:700;">' + item.jumlah
    + ' <span style="font-weight:400;color:var(--muted);">/ ' + esc(item.stokAman || '—') + ' ' + esc(item.satuan || 'pcs') + '</span></div>'
    + '<span class="badge ' + sc + '" style="font-size:10px;">' + esc(item.status || '—') + '</span></td>'
    + '<td class="tc">' + katHtml + '</td>'
    + '<td style="font-size:12.5px;color:var(--muted);">' + esc(item.lokasi || '—') + '</td>'
    + '<td class="tc">' + aksi + '</td>'
    + '</tr>';
}
/* ============================================================
   SORT + FILTER ENGINE
   ============================================================ */
function _getSortedFilteredBahan() {
  var q = ((document.getElementById('srchChem') || {}).value || '').toLowerCase();
  var arr = _chemData.filter(function(i) {
    return (!q || (i.nama||'').toLowerCase().includes(q) || (i.rumus||'').toLowerCase().includes(q))
        && (!_filterBahanKat  || (i.kategori||'') === _filterBahanKat)
        && (!_filterBahanStat || (i.status  ||'') === _filterBahanStat)
        && (!_filterBahanLok  || (i.lokasi  ||'') === _filterBahanLok);
  });
  if (_sortBahan.col) arr = _doSort(arr, _sortBahan, { nama:'nama', kat:'kategori', stok:'stok', stat:'status', lok:'lokasi' });
  _invState.bahan.filtered = arr;
  return arr;
}

function _getSortedFilteredAlat() {
  var q = ((document.getElementById('srchAlat') || {}).value || '').toLowerCase();
  var arr = _toolData.filter(function(i) {
    return (!q || (i.nama||'').toLowerCase().includes(q) || (i.kategori||'').toLowerCase().includes(q))
        && (!_filterAlatKat  || (i.kategori||'') === _filterAlatKat)
        && (!_filterAlatStat || (i.status  ||'') === _filterAlatStat)
        && (!_filterAlatLok   || (i.lokasi  ||'') === _filterAlatLok);
  });
  if (_sortAlat.col) arr = _doSort(arr, _sortAlat, { nama:'nama', spek:'spek', stok:'jumlah', kat:'kategori', lok:'lokasi', stat:'status' });
  _invState.alat.filtered = arr;
  return arr;
}

function _doSort(arr, state, keyMap) {
  var field = keyMap[state.col];
  if (!field) return arr;
  var dir = state.dir;
  return arr.slice().sort(function(a, b) {
    var va = (field === 'stok' || field === 'jumlah') ? (Number(a[field]) || 0) : (a[field] || '').toString().toLowerCase();
    var vb = (field === 'stok' || field === 'jumlah') ? (Number(b[field]) || 0) : (b[field] || '').toString().toLowerCase();
    if (va < vb) return dir === 'asc' ? -1 :  1;
    if (va > vb) return dir === 'asc' ?  1 : -1;
    return 0;
  });
}
/* ============================================================
   HEADER RENDERER
   ============================================================ */
function _renderBahanHeader() {
  var kats  = _uniqueVals(_chemData, 'kategori');
  var stats = _uniqueVals(_chemData, 'status');
  var cols = [
    { key:'nama', label:'Nama Bahan',    w:'30%', sort:true,  fKey:null },
    { key:'kat',  label:'Kategori',      w:'14%', sort:true,  fKey:'bahanKat',  fVals:kats,  fPlaceholder:'Semua Kategori', center:true },
    { key:'stok', label:'Stok & Status', w:'22%', sort:true,  fKey:'bahanStat', fVals:stats, fPlaceholder:'Semua Status',   center:true },
    { key:'lok',  label:'Lokasi',        w:'20%', sort:true,  fKey:'bahanLok',  fVals:_uniqueVals(_chemData,'lokasi'), fPlaceholder:'Semua Lokasi' },
    { key:'aksi', label:'Aksi',          w:'14%', sort:false, fKey:null, center:true },
  ];
  var thead = document.querySelector('#tbBahan-wrap thead');
  if (thead) thead.innerHTML = '<tr>' + cols.map(function(c){ return _buildTh(c, _sortBahan, 'Bahan'); }).join('') + '</tr>';
}

function _renderAlatHeader() {
  var kats  = _uniqueVals(_toolData, 'kategori');
  var stats = _uniqueVals(_toolData, 'status');
  var cols = [
    { key:'nama', label:'Nama Alat',           w:'24%', sort:true,  fKey:null },
    { key:'spek', label:'Spesifikasi',          w:'16%', sort:true,  fKey:null, center:true },
    { key:'stok', label:'Tersedia / Stok Awal', w:'20%', sort:true,  fKey:'alatStat', fVals:stats, fPlaceholder:'Semua Status',   center:true },
    { key:'kat',  label:'Kategori',             w:'14%', sort:true,  fKey:'alatKat',  fVals:kats,  fPlaceholder:'Semua Kategori', center:true },
    { key:'lok',  label:'Lokasi',               w:'14%', sort:true,  fKey:'alatLok',  fVals:_uniqueVals(_toolData,'lokasi'), fPlaceholder:'Semua Lokasi' },
    { key:'aksi', label:'Aksi',                 w:'12%', sort:false, fKey:null, center:true },
  ];
  var thead = document.querySelector('#tbAlat-wrap thead');
  if (thead) thead.innerHTML = '<tr>' + cols.map(function(c){ return _buildTh(c, _sortAlat, 'Alat'); }).join('') + '</tr>';
}

function _buildTh(col, sortState, type) {
  var center = col.center ? 'text-align:center;' : '';
  var thStyle = 'width:' + col.w + ';' + center + 'white-space:nowrap;overflow:visible;';

  var sortHtml = '';
  if (col.sort) {
    var isActive = sortState.col === col.key;
    var ic = isActive ? (sortState.dir === 'asc' ? 'bi-sort-up' : 'bi-sort-down') : 'bi-arrow-down-up';
    var ic_color = isActive ? 'color:var(--primary);' : 'color:#94a3b8;';
    sortHtml = '<span onclick="sortInv(\'' + type + '\',\'' + col.key + '\')" '
      + 'style="cursor:pointer;display:inline-flex;align-items:center;gap:2px;user-select:none;">'
      + esc(col.label)
      + '<i class="bi ' + ic + '" style="font-size:11px;margin-left:3px;' + ic_color + '"></i>'
      + '</span>';
  } else {
    sortHtml = esc(col.label);
  }

  var filterHtml = '';
  if (col.fKey && col.fVals && col.fVals.length > 0) {
    var cur = _getFilterVal(col.fKey);
    var isActive2 = cur !== '';
    var icFunnel = isActive2 ? 'bi-funnel-fill' : 'bi-funnel';
    var btnStyle = isActive2
      ? 'background:rgba(76,111,165,0.12);color:var(--primary);'
      : 'background:transparent;color:#94a3b8;';
    filterHtml = ' <button class="inv-filter-btn" '
      + 'style="' + btnStyle + '" '
      + 'onclick="openInvDrop(event,\'' + col.fKey + '\')" '
      + 'title="Filter ' + esc(col.label) + '">'
      + '<i class="bi ' + icFunnel + '" style="font-size:11px;pointer-events:none;"></i>'
      + '</button>';
  }

  return '<th style="' + thStyle + '">'
    + '<span style="display:inline-flex;align-items:center;gap:2px;">'
    + sortHtml + filterHtml
    + '</span></th>';
}
/* ============================================================
   DROPDOWN GLOBAL
   ============================================================ */
function openInvDrop(e, key) {
  e.stopPropagation();
  _initInvDrop();
  if (_invDropKey === key) { _closeInvDrop(); return; }
  _invDropKey = key;
  var btn  = e.currentTarget;
  var rect = btn.getBoundingClientRect();
  var vals = _getFilterVals(key);
  var cur  = _getFilterVal(key);
  var placeholder = _getFilterPlaceholder(key);
  var options = '<option value="">' + esc(placeholder) + '</option>';
  vals.forEach(function(v) {
    options += '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(v) + '</option>';
  });
  var clearBtn = cur !== ''
    ? '<button onclick="applyInvFilter(\'' + key + '\',\'\')" '
      + 'style="display:block;width:100%;margin-top:7px;padding:5px 10px;font-size:11.5px;font-weight:600;'
      + 'color:#dc2626;background:#fff5f5;border:1px solid #fecaca;border-radius:6px;cursor:pointer;text-align:center;">'
      + '✕ Hapus filter</button>'
    : '';
  _invDropEl.innerHTML =
    '<select onchange="applyInvFilter(\'' + key + '\',this.value)" '
    + 'style="width:100%;border:1.5px solid #e4eaf4;border-radius:7px;padding:6px 28px 6px 10px;'
    + 'font-size:12.5px;font-family:Inter,sans-serif;background:#f8fafc;color:#0f172a;'
    + 'outline:none;cursor:pointer;appearance:none;-webkit-appearance:none;'
    + 'background-image:url(\'data:image/svg+xml,%3Csvg xmlns=\\\'http://www.w3.org/2000/svg\\\' width=\\\'10\\\' height=\\\'10\\\' viewBox=\\\'0 0 24 24\\\' fill=\\\'none\\\' stroke=\\\'%23475569\\\' stroke-width=\\\'2.5\\\'%3E%3Cpolyline points=\\\'6 9 12 15 18 9\\\'/%3E%3C/svg%3E\');'
    + 'background-repeat:no-repeat;background-position:right 8px center;">'
    + options + '</select>' + clearBtn;
  var dropW = 190, left = rect.left, top = rect.bottom + 4;
  if (left + dropW > window.innerWidth - 8) left = window.innerWidth - dropW - 8;
  _invDropEl.style.left    = left + 'px';
  _invDropEl.style.top     = top  + 'px';
  _invDropEl.style.width   = dropW + 'px';
  _invDropEl.style.display = 'block';
}

function _getFilterVal(key) {
  if (key === 'bahanKat')  return _filterBahanKat;
  if (key === 'bahanStat') return _filterBahanStat;
  if (key === 'bahanLok')  return _filterBahanLok;
  if (key === 'alatKat')   return _filterAlatKat;
  if (key === 'alatStat')  return _filterAlatStat;
  if (key === 'alatLok')   return _filterAlatLok;
  return '';
}

function _getFilterVals(key) {
  if (key === 'bahanKat')  return _uniqueVals(_chemData, 'kategori');
  if (key === 'bahanStat') return _uniqueVals(_chemData, 'status');
  if (key === 'bahanLok')  return _uniqueVals(_chemData, 'lokasi');
  if (key === 'alatKat')   return _uniqueVals(_toolData, 'kategori');
  if (key === 'alatStat')  return _uniqueVals(_toolData, 'status');
  if (key === 'alatLok')   return _uniqueVals(_toolData, 'lokasi');
  return [];
}

function _getFilterPlaceholder(key) {
  if (key === 'bahanKat' || key === 'alatKat')  return 'Semua Kategori';
  if (key === 'bahanLok' || key === 'alatLok')  return 'Semua Lokasi';
  return 'Semua Status';
}
/* ============================================================
   SORT
   ============================================================ */
function sortInv(type, col) {
  if (type === 'Bahan') {
    _sortBahan = (_sortBahan.col === col)
      ? { col: col, dir: _sortBahan.dir === 'asc' ? 'desc' : 'asc' }
      : { col: col, dir: 'asc' };
    _renderBahanHeader();
    if (window._renderBahanPage) window._renderBahanPage(1);
  } else {
    _sortAlat = (_sortAlat.col === col)
      ? { col: col, dir: _sortAlat.dir === 'asc' ? 'desc' : 'asc' }
      : { col: col, dir: 'asc' };
    _renderAlatHeader();
    if (window._renderAlatPage) window._renderAlatPage(1);
  }
}
/* ============================================================
   APPLY FILTER
   ============================================================ */
function applyInvFilter(key, val) {
  if (key === 'bahanKat')  _filterBahanKat  = val;
  if (key === 'bahanStat') _filterBahanStat = val;
  if (key === 'bahanLok')  _filterBahanLok  = val;
  if (key === 'alatKat')   _filterAlatKat   = val;
  if (key === 'alatStat')  _filterAlatStat  = val;
  if (key === 'alatLok')   _filterAlatLok   = val;
  _closeInvDrop();
  var isBahan = key.startsWith('bahan');
  if (isBahan) { _renderBahanHeader(); if (window._renderBahanPage) window._renderBahanPage(1); }
  else         { _renderAlatHeader();  if (window._renderAlatPage)  window._renderAlatPage(1);  }
}

function filterChem() { if (window._renderBahanPage) window._renderBahanPage(1); }
function filterAlat()  { if (window._renderAlatPage)  window._renderAlatPage(1); }

function _uniqueVals(arr, field) {
  var seen = {}, result = [];
  (arr || []).forEach(function(item) {
    var v = (item[field] || '').toString().trim();
    if (v && !seen[v]) { seen[v] = true; result.push(v); }
  });
  return result.sort();
}

/* ============================================================
   MODAL STOK — TAMBAH / KURANGI
   ============================================================ */

/* State mode aktif: 'tambah' atau 'kurang' */
var _stokMode = 'tambah';

function openStokModal(type, idx) {
  _stokType = type;
  _stokMode = 'tambah'; // reset ke tambah setiap kali modal dibuka
  var item = type === 'bahan' ? _chemData[idx] : _toolData[idx];
  _stokItemNama = item.nama;

  document.getElementById('mdlStokTitle').textContent  = type === 'bahan' ? 'Update Stok Bahan' : 'Update Stok Alat';
  document.getElementById('mdlStokNama').textContent   = item.nama;
  document.getElementById('mdlStokRumus').textContent  = type === 'bahan' ? (item.rumus    || '—') : (item.spek    || '—');
  document.getElementById('mdlStokKat').textContent    = type === 'bahan' ? (item.kategori || '—') : (item.kondisi || '—');
  document.getElementById('mdlStokLok').textContent    = item.lokasi || '—';
  document.getElementById('mdlStokVal').textContent    = (type === 'bahan' ? item.stok : item.jumlah) + ' ' + (item.satuan || 'pcs');

  var st = item.status || '', stl = st.toLowerCase(), sc = 'b-gray';
  if (stl.includes('aman') || stl.includes('tersedia')) sc = 'b-green';
  else if (stl.includes('hampir')) sc = 'b-amber';
  else sc = 'b-red';
  document.getElementById('mdlStokStatus').innerHTML = '<span class="badge ' + sc + '">' + esc(st || '—') + '</span>';
  document.getElementById('mdlStokInput').value      = '';

  /* Render toggle tambah/kurangi dan pastikan state awal = tambah */
  _renderStokToggle();

  var katWrap = document.getElementById('mdlKategoriWrap');
  if (katWrap) {
    if (type === 'alat') {
      katWrap.classList.remove('hidden');
      var katSel = document.getElementById('mdlKategoriAlat');
      if (katSel) katSel.value = item.kategori || '';
    } else {
      katWrap.classList.add('hidden');
    }
  }
  openModal('mdlStok');
}

/* Render tampilan toggle dan label tombol sesuai mode aktif */
function _renderStokToggle() {
  var isTambah = _stokMode === 'tambah';

  /* Toggle button group */
  var toggleEl = document.getElementById('mdlStokToggle');
  if (toggleEl) {
    toggleEl.innerHTML =
      '<div style="display:flex;gap:0;background:#f1f5f9;border-radius:8px;padding:3px;">'
      + '<button id="btnModeTambah" onclick="_setStokMode(\'tambah\')" '
      + 'style="flex:1;padding:7px 0;border:none;border-radius:6px;font-size:12.5px;font-weight:600;cursor:pointer;transition:all .15s;'
      + (isTambah ? 'background:#fff;color:var(--primary);box-shadow:0 1px 4px rgba(0,0,0,0.08);' : 'background:transparent;color:var(--muted);') + '">'
      + '<i class="bi bi-plus-circle" style="margin-right:4px;"></i>Tambah Stok</button>'
      + '<button id="btnModeKurang" onclick="_setStokMode(\'kurang\')" '
      + 'style="flex:1;padding:7px 0;border:none;border-radius:6px;font-size:12.5px;font-weight:600;cursor:pointer;transition:all .15s;'
      + (!isTambah ? 'background:#fff;color:var(--danger);box-shadow:0 1px 4px rgba(0,0,0,0.08);' : 'background:transparent;color:var(--muted);') + '">'
      + '<i class="bi bi-dash-circle" style="margin-right:4px;"></i>Kurangi Stok</button>'
      + '</div>';
  }

  /* Label dan warna input */
  var labelEl = document.getElementById('mdlStokInputLabel');
  if (labelEl) {
    labelEl.textContent = isTambah ? 'Jumlah Penambahan' : 'Jumlah Pengurangan';
  }

  /* Warna border input dan tombol simpan */
  var inputEl = document.getElementById('mdlStokInput');
  if (inputEl) {
    inputEl.style.borderColor = isTambah ? '' : '#dc2626';
    inputEl.value = '';
    inputEl.placeholder = isTambah ? 'Masukkan jumlah yang ditambahkan...' : 'Masukkan jumlah yang dikurangi...';
  }

  var btnEl = document.getElementById('mdlStokBtn');
  if (btnEl) {
    if (isTambah) {
      btnEl.className = 'btn btn-primary';
      btnEl.innerHTML = '<i class="bi bi-plus-circle"></i> Tambah';
    } else {
      btnEl.className = 'btn btn-danger';
      btnEl.innerHTML = '<i class="bi bi-dash-circle"></i> Kurangi';
    }
    btnEl.onclick = saveStok;
  }
}

function _setStokMode(mode) {
  _stokMode = mode;
  _renderStokToggle();
}

async function saveStok() {
  var v = Number(document.getElementById('mdlStokInput').value);
  if (!v || v <= 0) {
    Swal.fire('Gagal', 'Masukkan jumlah positif', 'error');
    return;
  }

  var action = _stokType === 'bahan' ? 'updateChemicalStock' : 'updateToolStock';
  var params = _stokType === 'bahan'
    ? { namaBahan: _stokItemNama, jumlah: v, adminNim: _uname, tipe: _stokMode }
    : { namaAlat:  _stokItemNama, jumlah: v, adminNim: _uname, tipe: _stokMode };

  /* Konfirmasi sebelum kurangi */
  if (_stokMode === 'kurang') {
    var konfirm = await Swal.fire({
      title: 'Kurangi Stok?',
      html: (_stokType === 'bahan' ? 'Bahan' : 'Alat') + ': <strong>' + esc(_stokItemNama) + '</strong>'
        + '<br>Dikurangi: <strong>' + v + '</strong>',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Kurangi',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626'
    });
    if (!konfirm.isConfirmed) return;
  }

  Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: function() { Swal.showLoading(); } });
  try {
    var res = await callGAS(action, params);
    Swal.close();
    if (res.success) {
      closeModal('mdlStok');
      Swal.fire({
        toast: true, position: 'top-end', icon: 'success',
        title: _stokMode === 'tambah' ? 'Stok berhasil ditambahkan' : 'Stok berhasil dikurangi',
        showConfirmButton: false, timer: 2000
      });
      loadInv();
    } else {
      Swal.fire('Error', res.message, 'error');
    }
  } catch(e) {
    Swal.close();
    Swal.fire('Error', e.message, 'error');
  }
}

async function saveKategoriAlat() {
  var katSel = document.getElementById('mdlKategoriAlat');
  if (!katSel) return;
  Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: function() { Swal.showLoading(); } });
  try {
    var res = await callGAS('updateEquipmentKategori', { namaAlat: _stokItemNama, kategori: katSel.value, adminNim: _uname });
    Swal.close();
    if (res.success) {
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Kategori disimpan', showConfirmButton: false, timer: 2000 });
      loadInv();
    } else Swal.fire('Error', res.message, 'error');
  } catch(e) { Swal.close(); Swal.fire('Error', e.message, 'error'); }
}
/* ============================================================
   TAMBAH BAHAN / ALAT
   ============================================================ */
function openModalAddBahan() {
  ['abNama','abRumus','abKategori','abLokasi','abStok','abStokAman','abSatuan','abHarga'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  openModal('mdlAddBahan');
}

async function saveAddBahan() {
  var o = {
    nama: document.getElementById('abNama').value.trim(), rumus: document.getElementById('abRumus').value.trim(),
    kategori: document.getElementById('abKategori').value.trim(), lokasi: document.getElementById('abLokasi').value.trim(),
    stok: document.getElementById('abStok').value, stokAman: document.getElementById('abStokAman').value,
    satuan: document.getElementById('abSatuan').value.trim(), harga: document.getElementById('abHarga').value, adminNim: _uname
  };
  if (!o.nama || !o.stok || !o.satuan) { Swal.fire('Peringatan', 'Nama, stok, dan satuan wajib diisi', 'warning'); return; }
  Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: function() { Swal.showLoading(); } });
  try {
    var res = await callGAS('addChemical', o);
    Swal.close();
    if (res.success) { closeModal('mdlAddBahan'); Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Bahan berhasil ditambahkan', showConfirmButton: false, timer: 2000 }); loadInv(); }
    else Swal.fire('Gagal', res.message, 'error');
  } catch(e) { Swal.close(); Swal.fire('Error', e.message, 'error'); }
}

function openModalAddAlat() {
  ['aaAlatNama','aaSpek','aaLokasi','aaStok','aaStokAman'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('aaSatuan').value  = 'pcs';
  document.getElementById('aaKondisi').value = 'Baik';
  var katEl = document.getElementById('aaKategori'); if (katEl) katEl.value = '';
  openModal('mdlAddAlat');
}

async function saveAddAlat() {
  var o = {
    nama: document.getElementById('aaAlatNama').value.trim(), spek: document.getElementById('aaSpek').value.trim(),
    lokasi: document.getElementById('aaLokasi').value.trim(), kondisi: document.getElementById('aaKondisi').value,
    stok: document.getElementById('aaStok').value, stokAman: document.getElementById('aaStokAman').value,
    satuan: document.getElementById('aaSatuan').value.trim() || 'pcs',
    kategori: document.getElementById('aaKategori') ? document.getElementById('aaKategori').value : '', adminNim: _uname
  };
  if (!o.nama || !o.stok) { Swal.fire('Peringatan', 'Nama dan jumlah wajib diisi', 'warning'); return; }
  Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: function() { Swal.showLoading(); } });
  try {
    var res = await callGAS('addEquipment', o);
    Swal.close();
    if (res.success) { closeModal('mdlAddAlat'); Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Alat berhasil ditambahkan', showConfirmButton: false, timer: 2000 }); loadInv(); }
    else Swal.fire('Gagal', res.message, 'error');
  } catch(e) { Swal.close(); Swal.fire('Error', e.message, 'error'); }
}
