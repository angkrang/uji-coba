/* ============================================================
   LOKER.JS — Denah & Manajemen Loker Laboratorium
   Integrasi dengan LabInventori via callGAS()
   ============================================================
   GAS actions yang dibutuhkan (tambahkan di Code.gs):
     getLokers        → return array semua loker
     updateLokerStatus→ params: {kode, lantai, status, nim, catatan}
     assignLoker      → params: {kode, lantai, nim, tanggal}
     unassignLoker    → params: {kode, lantai, catatan}
   ============================================================ */

/* ----------------------------------------------------------
   KONSTANTA
   ---------------------------------------------------------- */
var LKR_ICONS  = { K:'🔓', T:'👤', A:'🔒', H:'🗝', B:'⚠' };
var LKR_LABELS = {
  K:'Kosong',
  T:'Terpakai',
  A:'Dipakai + Kunci Ada',
  H:'Terkunci + Kunci Hilang',
  B:'Buka + Kunci Hilang'
};
var LKR_BADGE = { K:'b-green', T:'b-blue', A:'b-amber', H:'b-red', B:'b-gray' };

/* data loker aktif di memori */
var _lokerData = [];

/* ----------------------------------------------------------
   LOAD DATA dari GAS
   ---------------------------------------------------------- */
async function loadLoker() {
  var wrap = document.getElementById('loker-map-wrap');
  if (wrap) wrap.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-title">Memuat denah loker...</div></div>';

  try {
    var data = await callGAS('getLokers');
    /* Fallback: jika GAS belum dibuat, pakai data demo */
    if (!data || !Array.isArray(data) || data.length === 0) {
      data = _lokerDemoData();
    }
    _lokerData = data;
    _renderLokerStats();
    _renderLokerMap();
  } catch(e) {
    /* GAS belum tersedia — tampilkan demo */
    _lokerData = _lokerDemoData();
    _renderLokerStats();
    _renderLokerMap();
  }
}

/* ----------------------------------------------------------
   STATS BAR
   ---------------------------------------------------------- */
function _renderLokerStats() {
  var c = { K:0, T:0, A:0, H:0, B:0 };
  _lokerData.forEach(function(d){ if(c[d.status]!==undefined) c[d.status]++; });
  var total = _lokerData.length;

  var el = document.getElementById('loker-stats');
  if (!el) return;
  el.innerHTML = [
    { n:total,      l:'Total Loker',  col:'var(--text)',    ic:'bi-grid-3x3-gap', bg:'var(--primary-faint)' },
    { n:c.K,        l:'Tersedia',     col:'var(--success)', ic:'bi-lock-open',    bg:'#dcfce7' },
    { n:c.T+c.A,    l:'Terpakai',     col:'var(--primary)', ic:'bi-person-fill',  bg:'#dbeafe' },
    { n:c.H+c.B,    l:'Bermasalah',   col:'var(--danger)',  ic:'bi-exclamation-triangle', bg:'#fee2e2' }
  ].map(function(s){
    return '<div class="stat-card" style="flex:1;min-width:0">'
      + '<div class="sc-icon-wrap" style="background:'+s.bg+';width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:8px">'
      + '<i class="bi '+s.ic+'" style="color:'+s.col+';font-size:15px"></i></div>'
      + '<div style="font-size:11px;color:var(--muted);font-weight:500;margin-bottom:3px">'+s.l+'</div>'
      + '<div style="font-size:22px;font-weight:800;color:'+s.col+'">'+s.n+'</div>'
      + '</div>';
  }).join('');
}

/* ----------------------------------------------------------
   RENDER DENAH
   ---------------------------------------------------------- */
var LKH = 44, MEJAH = 24, GAP = 2, JALAN = 72;

/*
  Layout tiap ruangan (birds-eye, atas=Barat, kanan=Utara/Pintu):
    - Meja dinding selatan (kiri): vertikal sepanjang dinding, 6 loker
    - 2 meja tengah horizontal, masing-masing sisi A (Barat) & sisi B (Timur)
    - Jalan mobilitas lebar di antara 2 meja tengah
*/
var ROOM_DEFS = [
  {
    id: 'room-f1', label: 'F.II.1', pintuCorner: 'top',
    meja: [
      { label:'Meja 1', sisiAKey:'f1-m1-a', sisiBKey:'f1-m1-b' },
      { label:'Meja 2', sisiAKey:'f1-m2-a', sisiBKey:'f1-m2-b' }
    ],
    dindingKey: 'f1-dinding'
  },
  {
    id: 'room-f2', label: 'F.II.2', pintuCorner: 'middle',
    meja: [
      { label:'Meja 1', sisiAKey:'f2-m1-a', sisiBKey:'f2-m1-b' },
      { label:'Meja 2', sisiAKey:'f2-m2-a', sisiBKey:'f2-m2-b' }
    ],
    dindingKey: 'f2-dinding'
  }
];

function _lokerByKey(key) {
  return _lokerData.filter(function(d){ return d.posisi === key; });
}

function _renderLokerMap() {
  var wrap = document.getElementById('loker-map-wrap');
  if (!wrap) return;

  /* container 2 ruangan side by side */
  wrap.innerHTML = '<div id="loker-floors" style="display:flex;gap:14px;"></div>';
  var floorWrap = document.getElementById('loker-floors');

  ROOM_DEFS.forEach(function(def) {
    var card = document.createElement('div');
    card.style.cssText = 'flex:1;min-width:0;background:var(--card);border:1px solid var(--border);border-radius:16px;padding:14px;box-shadow:var(--shadow-card)';

    /* label ruangan */
    var lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:10px;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px';
    lbl.textContent = 'Ruangan ' + def.label;
    card.appendChild(lbl);

    /* room canvas */
    var room = document.createElement('div');
    room.id = def.id;
    room.style.cssText = 'position:relative;background:#eef2f7;border:2.5px solid #94a3b8;border-radius:6px;height:500px;overflow:visible';
    card.appendChild(room);

    floorWrap.appendChild(card);

    /* render setelah DOM ready */
    setTimeout(function(){ _buildRoom(room, def); }, 60);
  });
}

function _buildRoom(room, def) {
  var rw = room.offsetWidth, rh = room.offsetHeight;

  /* compass labels */
  [
    { t:'Barat ↑',    css:'top:4px;left:50%;transform:translateX(-50%)' },
    { t:'Timur ↓',    css:'bottom:4px;left:50%;transform:translateX(-50%)' },
    { t:'Utara →',    css:'right:6px;top:50%;transform:translateY(-50%)' },
    { t:'← Selatan',  css:'left:6px;top:50%;transform:translateY(-50%)' }
  ].forEach(function(c) {
    var d = document.createElement('div');
    d.style.cssText = 'position:absolute;font-size:7.5px;color:#94a3b8;font-weight:600;pointer-events:none;z-index:1;' + c.css;
    d.textContent = c.t;
    room.appendChild(d);
  });

  /* PINTU — dinding kanan (utara) */
  var doorH = 28;
  var doorTop = def.pintuCorner === 'top' ? 14 : Math.round((rh - doorH) / 2);
  var dn = document.createElement('div');
  dn.style.cssText = 'position:absolute;right:-3px;top:'+doorTop+'px;width:6px;height:'+doorH+'px;background:#eef2f7;border-top:2px dashed var(--primary);border-bottom:2px dashed var(--primary);z-index:6';
  room.appendChild(dn);
  var dl = document.createElement('div');
  dl.style.cssText = 'position:absolute;right:5px;top:'+(doorTop-13)+'px;font-size:7px;color:var(--primary);font-weight:700;z-index:7;white-space:nowrap';
  dl.textContent = 'PINTU';
  room.appendChild(dl);

  /* MEJA DINDING — kiri (selatan), vertikal */
  var mdX = 18, mdW = 22, mdH = rh - 36;
  var mdEl = document.createElement('div');
  mdEl.style.cssText = 'position:absolute;left:'+mdX+'px;top:18px;width:'+mdW+'px;height:'+mdH+'px;background:#b8c8da;border:1.5px solid #7e96b4;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:6.5px;font-weight:600;color:#475569;writing-mode:vertical-rl;z-index:2';
  mdEl.textContent = 'Meja dinding';
  room.appendChild(mdEl);

  /* loker dinding — 6 buah vertikal di kanan meja dinding */
  var dlkW = 26, dlkH = Math.floor((mdH - GAP * 5) / 6);
  var dlkX = mdX + mdW + 4;
  var dindingItems = _lokerByKey(def.dindingKey);
  dindingItems.forEach(function(d, i) {
    var el = _makeLkEl(d, dlkW, dlkH, def.label);
    el.style.left = dlkX + 'px';
    el.style.top = (18 + i * (dlkH + GAP)) + 'px';
    room.appendChild(el);
  });

  /* MEJA TENGAH */
  var jalanSampingW = 20;
  var mejaX = dlkX + dlkW + jalanSampingW;
  var mejaW = rw - mejaX - 14;
  var lkW   = Math.floor((mejaW - GAP * 7) / 8);

  /* total tinggi 2 meja + jalan */
  var totalBlok = 2 * (LKH + MEJAH + LKH) + JALAN + 20;
  var startTop  = Math.max(22, Math.round((rh - totalBlok) / 2));

  def.meja.forEach(function(m, mi) {
    var lbl1Top = startTop + mi * (LKH + MEJAH + LKH + 10 + JALAN);
    if (mi === 1) lbl1Top = startTop + (LKH + MEJAH + LKH + 14) + JALAN;

    var sA_top = lbl1Top + 10;
    var m_top  = sA_top + LKH + 2;
    var sB_top = m_top + MEJAH + 2;

    /* sisi A label */
    _addSlbl(room, mejaX, lbl1Top, 'Sisi A (barat)');
    /* sisi A lokers */
    _lokerByKey(m.sisiAKey).forEach(function(d, i) {
      var el = _makeLkEl(d, lkW, LKH, def.label);
      el.style.left = (mejaX + i * (lkW + GAP)) + 'px';
      el.style.top  = sA_top + 'px';
      room.appendChild(el);
    });

    /* meja surface */
    var ms = document.createElement('div');
    ms.style.cssText = 'position:absolute;left:'+mejaX+'px;top:'+m_top+'px;width:'+mejaW+'px;height:'+MEJAH+'px;background:#c7d2e0;border:1.5px solid #7e96b4;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:600;color:#475569;z-index:2';
    ms.textContent = m.label + ' (meja kerja)';
    room.appendChild(ms);

    /* sisi B lokers */
    _lokerByKey(m.sisiBKey).forEach(function(d, i) {
      var el = _makeLkEl(d, lkW, LKH, def.label);
      el.style.left = (mejaX + i * (lkW + GAP)) + 'px';
      el.style.top  = sB_top + 'px';
      room.appendChild(el);
    });
    _addSlbl(room, mejaX, sB_top + LKH + 3, 'Sisi B (timur)');

    /* JALAN MOBILITAS hanya setelah meja pertama */
    if (mi === 0) {
      var jalanTop = sB_top + LKH + 14;
      var strip = document.createElement('div');
      strip.style.cssText = 'position:absolute;left:'+mejaX+'px;top:'+jalanTop+'px;width:'+mejaW+'px;height:'+JALAN+'px;background:rgba(255,255,255,0.72);border-top:1.5px dashed #94a3b8;border-bottom:1.5px dashed #94a3b8;z-index:1;display:flex;align-items:center;justify-content:center;pointer-events:none';
      var jlbl = document.createElement('div');
      jlbl.style.cssText = 'font-size:7px;color:#94a3b8;font-weight:600;letter-spacing:.4px';
      jlbl.textContent = '⟵  Jalan mobilitas  ⟶';
      strip.appendChild(jlbl);
      room.appendChild(strip);
    }
  });
}

function _addSlbl(room, x, y, txt) {
  var el = document.createElement('div');
  el.style.cssText = 'position:absolute;font-size:6.5px;font-weight:600;color:#94a3b8;z-index:4;white-space:nowrap;left:'+x+'px;top:'+y+'px';
  el.textContent = txt;
  room.appendChild(el);
}

function _makeLkEl(d, w, h, ruang) {
  var el = document.createElement('div');
  el.className = 'lkr-cell lkr-s-' + d.status;
  el.style.cssText = 'position:absolute;width:'+w+'px;height:'+h+'px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;border-radius:4px;border:1.5px solid;transition:transform .12s,box-shadow .12s;gap:1px;z-index:3';
  el.innerHTML = '<span style="font-size:10px;line-height:1">' + LKR_ICONS[d.status] + '</span>'
    + '<span style="font-size:7px;font-weight:700;line-height:1">' + esc(d.kode) + '</span>'
    + '<span style="font-size:6px;line-height:1.1;max-width:'+(w-4)+'px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.85">'
    + (d.namaPengguna && d.namaPengguna !== '—' ? d.namaPengguna.split(' ')[0] : 'Kosong') + '</span>';
  el.onmouseenter = function(){ this.style.transform='scale(1.12)';this.style.zIndex='20';this.style.boxShadow='0 4px 14px rgba(0,0,0,.2)'; };
  el.onmouseleave = function(){ this.style.transform='';this.style.zIndex='3';this.style.boxShadow=''; };
  el.onclick = function(){ _openLokerModal(d, ruang); };
  return el;
}

/* ----------------------------------------------------------
   MODAL DETAIL / EDIT LOKER
   ---------------------------------------------------------- */
var _activeLoker = null;

function _openLokerModal(d, ruang) {
  _activeLoker = d;
  var isAdmin = (_role === 'admin' || _role === 'plp');

  document.getElementById('lkm-title').textContent    = 'Loker ' + d.kode + ' — ' + ruang;
  document.getElementById('lkm-kode').textContent     = d.kode;
  document.getElementById('lkm-ruang').textContent    = ruang;
  document.getElementById('lkm-status').innerHTML     = '<span class="badge ' + LKR_BADGE[d.status] + '">' + LKR_LABELS[d.status] + '</span>';
  document.getElementById('lkm-user').textContent     = d.namaPengguna || '—';
  document.getElementById('lkm-nim').textContent      = d.nim || '—';
  document.getElementById('lkm-sejak').textContent    = d.tanggalMulai || '—';

  /* riwayat */
  var hist = d.riwayat || [];
  var hEl = document.getElementById('lkm-hist');
  hEl.innerHTML = hist.length
    ? hist.map(function(x){ return '<div class="lkm-hitem"><span class="lkm-hdot"></span>' + esc(x) + '</div>'; }).join('')
    : '<div style="font-size:10px;color:var(--muted);padding:3px 0">Belum ada riwayat.</div>';

  /* form edit — hanya admin */
  var editWrap = document.getElementById('lkm-edit-wrap');
  if (editWrap) {
    if (isAdmin) {
      editWrap.classList.remove('hidden');
      document.getElementById('lkm-sel-status').value = d.status;
      document.getElementById('lkm-inp-nim').value    = d.nim || '';
      document.getElementById('lkm-inp-catatan').value = '';
    } else {
      editWrap.classList.add('hidden');
    }
  }

  document.getElementById('loker-modal-bg').classList.add('open');
}

function closeLokerModal() {
  document.getElementById('loker-modal-bg').classList.remove('open');
  _activeLoker = null;
}

async function saveLokerEdit() {
  if (!_activeLoker) return;
  var status  = document.getElementById('lkm-sel-status').value;
  var nim     = document.getElementById('lkm-inp-nim').value.trim();
  var catatan = document.getElementById('lkm-inp-catatan').value.trim();

  Swal.fire({ title:'Menyimpan...', allowOutsideClick:false, didOpen:function(){ Swal.showLoading(); } });
  try {
    var res = await callGAS('updateLokerStatus', {
      kode   : _activeLoker.kode,
      posisi : _activeLoker.posisi,
      status : status,
      nim    : nim,
      catatan: catatan,
      adminNim: _uname
    });
    Swal.close();
    if (res && res.success) {
      Swal.fire({ toast:true, position:'top-end', icon:'success', title:'Loker berhasil diperbarui', showConfirmButton:false, timer:2000 });
      closeLokerModal();
      loadLoker();
    } else {
      Swal.fire('Gagal', (res && res.message) || 'Terjadi kesalahan', 'error');
    }
  } catch(e) {
    Swal.close();
    Swal.fire('Error', e.message, 'error');
  }
}

/* ----------------------------------------------------------
   FILTER / SEARCH
   ---------------------------------------------------------- */
function filterLoker() {
  var q = (document.getElementById('loker-search') || {}).value || '';
  q = q.toLowerCase();
  document.querySelectorAll('.lkr-cell').forEach(function(el) {
    var txt = el.textContent.toLowerCase();
    el.style.opacity = (!q || txt.includes(q)) ? '1' : '0.25';
  });
}

/* ----------------------------------------------------------
   DEMO DATA (fallback sebelum GAS tersedia)
   ---------------------------------------------------------- */
function _lokerDemoData() {
  function L(kode, posisi, s, user, nim, sejak, hist) {
    return { kode:kode, posisi:posisi, status:s, namaPengguna:user||'—', nim:nim||'—', tanggalMulai:sejak||'—', riwayat:hist||[] };
  }
  return [
    /* F.II.1 Meja 1 Sisi A (barat) */
    L('B 08','f1-m1-a','A','Sinta Dewi','22/501344','Feb 2026',['Apr 2026 — Perpanjang sewa']),
    L('B 02','f1-m1-a','T','Rizky Aditya','21/483201','Jan 2026',['Mar 2026 — Kunci dikembalikan']),
    L('13A' ,'f1-m1-a','K',null,null,null,[]),
    L('18A' ,'f1-m1-a','T','Fauzan H.','23/510988','Apr 2026',['Apr 2026 — Mulai pakai']),
    L('10A' ,'f1-m1-a','T','Andika P.','21/480012','Mar 2026',[]),
    L('12A' ,'f1-m1-a','H',null,null,null,['Feb 2026 — Kunci hilang']),
    L('B 03','f1-m1-a','K',null,null,null,[]),
    L('B 17A','f1-m1-a','K',null,null,null,[]),
    /* F.II.1 Meja 1 Sisi B (timur) */
    L('B 25','f1-m1-b','A','Mega P.','21/475300','Sep 2025',['Mar 2026 — Perpanjang']),
    L('B 05','f1-m1-b','T','Laras W.','22/499120','Jan 2026',[]),
    L('B 06','f1-m1-b','B','Yoga P.','22/498770','Nov 2025',['Apr 2026 — Kunci hilang']),
    L('I7A' ,'f1-m1-b','T','Dian S.','22/502890','Jan 2026',[]),
    L('B 00','f1-m1-b','K',null,null,null,[]),
    L('B 01','f1-m1-b','K',null,null,null,[]),
    L('B 04','f1-m1-b','K',null,null,null,[]),
    L('B 09','f1-m1-b','H',null,null,null,['Mar 2026 — Kunci hilang']),
    /* F.II.1 Meja 2 Sisi A */
    L('B 11','f1-m2-a','T','Nita K.','23/512001','Mar 2026',[]),
    L('B 12','f1-m2-a','K',null,null,null,[]),
    L('B 13','f1-m2-a','T','Citra A.','23/515400','Apr 2026',[]),
    L('B 14','f1-m2-a','K',null,null,null,[]),
    L('B 15','f1-m2-a','K',null,null,null,[]),
    L('B 16','f1-m2-a','A','Hendra K.','21/477650','Oct 2025',['Apr 2026 — Perpanjang']),
    L('B 17','f1-m2-a','K',null,null,null,[]),
    L('B 18','f1-m2-a','K',null,null,null,[]),
    /* F.II.1 Meja 2 Sisi B */
    L('B 19','f1-m2-b','H',null,null,null,['Mar 2026 — Kunci hilang']),
    L('B 20','f1-m2-b','T','Rizky A.','21/483201','Jan 2026',[]),
    L('B 21','f1-m2-b','K',null,null,null,[]),
    L('B 22','f1-m2-b','K',null,null,null,[]),
    L('B 23','f1-m2-b','T','Sinta D.','22/501344','Feb 2026',[]),
    L('B 24','f1-m2-b','K',null,null,null,[]),
    L('B 26','f1-m2-b','B','Laras W.','22/499120','Jan 2026',['Apr — Kunci hilang']),
    L('B 27','f1-m2-b','K',null,null,null,[]),
    /* F.II.1 Meja Dinding */
    L('D 01','f1-dinding','T','Andika P.','21/480012','Mar 2026',[]),
    L('D 02','f1-dinding','K',null,null,null,[]),
    L('D 03','f1-dinding','A','Mega P.','21/475300','Sep 2025',['Mar 2026 — Perpanjang']),
    L('D 04','f1-dinding','K',null,null,null,[]),
    L('D 05','f1-dinding','H',null,null,null,['Feb 2026 — Kunci hilang']),
    L('D 06','f1-dinding','K',null,null,null,[]),
    /* F.II.2 Meja 1 Sisi A */
    L('16A' ,'f2-m1-a','K',null,null,null,[]),
    L('C 01','f2-m1-a','T','Andika P.','21/480012','Mar 2026',[]),
    L('C 02','f2-m1-a','A','Mega P.','21/475300','Sep 2025',['Mar — Perpanjang']),
    L('C 03','f2-m1-a','K',null,null,null,[]),
    L('C 04','f2-m1-a','T','Fauzan H.','23/510988','Apr 2026',[]),
    L('C 05','f2-m1-a','K',null,null,null,[]),
    L('C 06','f2-m1-a','K',null,null,null,[]),
    L('C 07','f2-m1-a','H',null,null,null,['Feb 2026 — Kunci hilang']),
    /* F.II.2 Meja 1 Sisi B */
    L('C 08','f2-m1-b','T','Dian S.','22/502890','Jan 2026',[]),
    L('C 09','f2-m1-b','B','Yoga P.','22/498770','Nov 2025',['Apr — Kunci hilang']),
    L('C 10','f2-m1-b','K',null,null,null,[]),
    L('C 11','f2-m1-b','T','Nita K.','23/512001','Mar 2026',[]),
    L('C 12','f2-m1-b','K',null,null,null,[]),
    L('C 13','f2-m1-b','K',null,null,null,[]),
    L('C 14','f2-m1-b','T','Hendra K.','21/477650','Oct 2025',['Apr — Perpanjang']),
    L('C 15','f2-m1-b','K',null,null,null,[]),
    /* F.II.2 Meja 2 Sisi A */
    L('C 16','f2-m2-a','K',null,null,null,[]),
    L('C 17','f2-m2-a','T','Citra A.','23/515400','Apr 2026',[]),
    L('C 18','f2-m2-a','H',null,null,null,['Mar 2026 — Kunci hilang']),
    L('C 19','f2-m2-a','K',null,null,null,[]),
    L('C 20','f2-m2-a','T','Rizky A.','21/483201','Jan 2026',[]),
    L('C 21','f2-m2-a','K',null,null,null,[]),
    L('C 22','f2-m2-a','A','Sinta D.','22/501344','Feb 2026',[]),
    L('C 23','f2-m2-a','K',null,null,null,[]),
    /* F.II.2 Meja 2 Sisi B */
    L('C 24','f2-m2-b','K',null,null,null,[]),
    L('C 25','f2-m2-b','B','Laras W.','22/499120','Jan 2026',['Apr — Kunci hilang']),
    L('C 26','f2-m2-b','K',null,null,null,[]),
    L('C 27','f2-m2-b','T','Andika P.','21/480012','Mar 2026',[]),
    L('C 28','f2-m2-b','K',null,null,null,[]),
    L('C 29','f2-m2-b','K',null,null,null,[]),
    L('C 30','f2-m2-b','T','Mega P.','21/475300','Sep 2025',['Mar — Perpanjang']),
    L('C 31','f2-m2-b','K',null,null,null,[]),
    /* F.II.2 Meja Dinding */
    L('E 01','f2-dinding','T','Dian S.','22/502890','Jan 2026',[]),
    L('E 02','f2-dinding','K',null,null,null,[]),
    L('E 03','f2-dinding','T','Citra A.','23/515400','Apr 2026',[]),
    L('E 04','f2-dinding','B','Yoga P.','22/498770','Nov 2025',['Apr — Kunci hilang']),
    L('E 05','f2-dinding','K',null,null,null,[]),
    L('E 06','f2-dinding','K',null,null,null,[]),
  ];
}
