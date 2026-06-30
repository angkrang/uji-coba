/* ============================================================
   PERMINTAAN — Dropdowns & History
   ============================================================ */
async function loadReqDropdowns() {
  try {
    var [chems,tools]=await Promise.all([callGAS('getChemicals'), callGAS('getTools')]);
    _chemData=chems; _hargaMap={};
    chems.forEach(function(b){ _hargaMap[b.nama]={harga:b.harga||0,satuan:b.satuan||''}; });
    _toolData=tools;
    _buildReqInlineData();
    ['reqBahanSearch','reqAlatSearch'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
    ['reqBahanNama','reqAlatNama'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
    document.getElementById('reqBahanSatuan').textContent='—';
    document.getElementById('reqAlatSatuan').textContent='—';
    document.getElementById('reqBahanInfo').textContent='Pilih bahan untuk melihat stok & harga';
    document.getElementById('reqAlatInfo').textContent='Pilih alat untuk melihat stok tersedia';
  } catch(e) {}
}

/* ============================================================
   SEARCHABLE DROPDOWN — Pilih Bahan / Alat di form Permintaan
   ============================================================ */
var _reqInlineData = { bahan: [], alat: [] };

function _buildReqInlineData() {
  _reqInlineData.bahan = (_chemData||[]).map(function(b){
    return { nama: b.nama, sub: b.rumus || '', stok: b.stok, satuan: b.satuan || '', harga: b.harga || 0 };
  });
  _reqInlineData.alat = (_toolData||[]).map(function(t){
    return { nama: t.nama, sub: t.spek || '', stok: t.jumlah, satuan: t.satuan || 'pcs', harga: 0 };
  });
}

function _cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }

function _reqInlineFilter(type) {
  var q = (document.getElementById('req'+_cap(type)+'Search').value || '').toLowerCase().trim();
  var list = _reqInlineData[type] || [];
  var filtered = q ? list.filter(function(d){ return d.nama.toLowerCase().includes(q) || d.sub.toLowerCase().includes(q); }) : list;
  if (!q) {
    document.getElementById('req'+_cap(type)+'Nama').value = '';
    if (type==='bahan') {
      document.getElementById('reqBahanSatuan').textContent='—';
      document.getElementById('reqBahanInfo').textContent='Pilih bahan untuk melihat stok & harga';
    } else {
      document.getElementById('reqAlatSatuan').textContent='—';
      document.getElementById('reqAlatInfo').textContent='Pilih alat untuk melihat stok tersedia';
    }
  }
  _renderReqInlineDropdown(type, filtered);
}

function filterReqBahanSearch(){ _reqInlineFilter('bahan'); }
function filterReqAlatSearch(){ _reqInlineFilter('alat'); }
function showReqBahanDropdown(){ _reqInlineFilter('bahan'); }
function showReqAlatDropdown(){ _reqInlineFilter('alat'); }
function hideReqBahanDropdown(){ var dd=document.getElementById('reqBahanDropdown'); if(dd) dd.style.display='none'; }
function hideReqAlatDropdown(){ var dd=document.getElementById('reqAlatDropdown'); if(dd) dd.style.display='none'; }

function _renderReqInlineDropdown(type, items) {
  var dd = document.getElementById('req'+_cap(type)+'Dropdown');
  if (!dd) return;
  if (!items.length) {
    dd.innerHTML = '<div style="padding:12px 14px;font-size:13px;color:var(--muted);text-align:center;">Tidak ada item yang cocok</div>';
    dd.style.display = 'block';
    return;
  }
  dd.innerHTML = items.map(function(d) {
    var stokNum = Number(d.stok)||0;
    var stokColor = stokNum > 0 ? 'var(--success)' : 'var(--danger)';
    var dataStr = encodeURIComponent(JSON.stringify(d));
    return '<div onmousedown="selectReqInlineItem(\''+type+'\', decodeAndParse(\''+dataStr+'\'))" '
      + 'style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background 0.15s;" '
      + 'onmouseover="this.style.background=\'var(--primary-light)\'" '
      + 'onmouseout="this.style.background=\'\'">'
      + '<div style="font-weight:600;font-size:13px;color:var(--text);">' + esc(d.nama) + '</div>'
      + (d.sub ? '<div style="font-size:11.5px;color:var(--muted);font-style:italic;">' + esc(d.sub) + '</div>' : '')
      + '<div style="font-size:11px;color:' + stokColor + ';margin-top:2px;font-weight:600;">'
      + (type === 'bahan' ? 'Stok: ' : 'Tersedia: ') + stokNum + ' ' + esc(d.satuan) + '</div>'
      + '</div>';
  }).join('');
  dd.style.display = 'block';
}

function selectReqInlineItem(type, d) {
  document.getElementById('req'+_cap(type)+'Search').value = d.nama;
  document.getElementById('req'+_cap(type)+'Nama').value   = d.nama;
  document.getElementById('req'+_cap(type)+'Dropdown').style.display = 'none';
  if (type === 'bahan') {
    document.getElementById('reqBahanSatuan').textContent = d.satuan || '—';
    var infoTxt = 'Stok tersisa: ' + d.stok + ' ' + d.satuan;
    if (d.harga > 0) infoTxt += ' | Harga: ' + formatRupiah(d.harga) + '/' + d.satuan;
    document.getElementById('reqBahanInfo').textContent = infoTxt;
  } else {
    document.getElementById('reqAlatSatuan').textContent = d.satuan || '—';
    document.getElementById('reqAlatInfo').textContent = 'Tersedia: ' + d.stok + ' ' + d.satuan;
  }
}

async function loadReqHistory() {
  var tb=document.getElementById('reqHistBody'); if(!tb) return;
  try {
    var loans=await callGAS('getMahasiswaChemicalLoans',{nim:_uname});
    if(!loans||!loans.length){ tb.innerHTML='<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">Belum ada aktivitas</div><div class="empty-state-sub">Ajukan permintaan bahan atau pinjam alat di atas</div></div></td></tr>'; return; }
    tb.innerHTML=loans.map(function(l){ var kb=l.statusKembali?'<span class="badge '+(l.statusKembali==='Sudah Kembali'?'b-green':'b-amber')+'" style="font-size:10px;margin-left:4px;">'+esc(l.statusKembali)+'</span>':''; return '<tr><td style="font-size:12px;color:var(--muted);">'+esc(l.tanggal)+'</td><td style="font-weight:600;">'+esc(l.namaBahan)+'</td><td>'+esc(l.jumlah)+'</td><td><span class="badge b-blue" style="font-size:10px;">'+esc(l.tipe)+'</span></td><td>'+statusBadge(l.status)+kb+'</td></tr>'; }).join('');
  } catch(e) {}
}

function fillBahanSatuan() {
  var sel=document.getElementById('reqBahanNama'), opt=sel.options[sel.selectedIndex];
  var satuan=opt?opt.getAttribute('data-satuan'):'', stok=opt?opt.getAttribute('data-stok'):'', harga=opt?Number(opt.getAttribute('data-harga')):0;
  var satuanEl=document.getElementById('reqBahanSatuan'); if(satuanEl) satuanEl.textContent=satuan||'—';
  var infoTxt=stok?'Stok tersisa: '+stok+' '+satuan:'Pilih bahan untuk melihat stok';
  if(harga>0) infoTxt+=' | Harga: '+formatRupiah(harga)+'/'+satuan;
  var infoEl=document.getElementById('reqBahanInfo'); if(infoEl) infoEl.textContent=infoTxt;
}

function fillAlatInfo() {
  var sel=document.getElementById('reqAlatNama'), opt=sel.options[sel.selectedIndex];
  var satuan=opt?opt.getAttribute('data-satuan'):'', stok=opt?opt.getAttribute('data-stok'):'';
  var satuanEl=document.getElementById('reqAlatSatuan'); if(satuanEl) satuanEl.textContent=satuan||'—';
  var infoEl=document.getElementById('reqAlatInfo'); if(infoEl) infoEl.textContent=stok?'Tersedia: '+stok+' '+satuan:'Pilih alat untuk melihat stok';
}

async function submitBahanReq() {
  var nama=document.getElementById('reqBahanNama').value, qty=Number(document.getElementById('reqBahanQty').value);
  var searchTxt=(document.getElementById('reqBahanSearch').value||'').trim();
  if(!nama||nama!==searchTxt){ Swal.fire('Peringatan','Pilih bahan dari daftar terlebih dahulu','warning'); return; }
  if(!qty||qty<=0){ Swal.fire('Peringatan','Masukkan jumlah yang valid','warning'); return; }
  Swal.fire({title:'Mengirim...',allowOutsideClick:false,didOpen:function(){Swal.showLoading();}});
  try {
    var res=await callGAS('submitChemicalRequest',{nim:_uname,user:_user,nama:nama,jumlah:qty});
    Swal.close();
    if(res.success){
      document.getElementById('reqBahanSearch').value='';
      document.getElementById('reqBahanNama').value='';
      document.getElementById('reqBahanQty').value='';
      Swal.fire({toast:true,position:'top-end',icon:'success',title:'Permintaan bahan berhasil diajukan!',showConfirmButton:false,timer:2500});
      loadReqDropdowns(); loadMhsSummary(); loadReqHistory();
    } else Swal.fire('Gagal',res.message,'error');
  } catch(e){ Swal.close(); Swal.fire('Error',e.message,'error'); }
}

async function submitAlatReq() {
  var nama=document.getElementById('reqAlatNama').value, qty=Number(document.getElementById('reqAlatQty').value);
  var searchTxt=(document.getElementById('reqAlatSearch').value||'').trim();
  if(!nama||nama!==searchTxt){ Swal.fire('Peringatan','Pilih alat dari daftar terlebih dahulu','warning'); return; }
  if(!qty||qty<=0){ Swal.fire('Peringatan','Pilih alat dan masukkan jumlah valid','warning'); return; }
  Swal.fire({title:'Mengirim...',allowOutsideClick:false,didOpen:function(){Swal.showLoading();}});
  try {
    var res=await callGAS('submitToolRequest',{nim:_uname,user:_user,nama:nama,jumlah:qty});
    Swal.close();
    if(res.success){
      document.getElementById('reqAlatSearch').value='';
      document.getElementById('reqAlatNama').value='';
      document.getElementById('reqAlatQty').value='';
      Swal.fire({toast:true,position:'top-end',icon:'success',title:'Peminjaman alat berhasil diajukan!',showConfirmButton:false,timer:2500});
      loadReqDropdowns(); loadMhsSummary(); loadReqHistory();
    } else Swal.fire('Gagal',res.message,'error');
  } catch(e){ Swal.close(); Swal.fire('Error',e.message,'error'); }
}

/* ============================================================
   PENGEMBALIAN — MAHASISWA
   ============================================================ */
async function loadMhsActiveLoans() {
  var displayEl=document.getElementById('activeLoansDisplay'), sel=document.getElementById('retAlatNama');
  if(displayEl) displayEl.innerHTML='<div class="skeleton" style="height:60px;border-radius:10px;"></div>';
  if(sel) sel.innerHTML='<option value="">Memuat...</option>';
  try {
    var list=await callGAS('getActiveEquipmentLoans',{nim:_uname});
    if(!list||!list.length){
      if(sel) sel.innerHTML='<option value="">— Tidak ada alat yang dipinjam —</option>';
      if(displayEl) displayEl.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:16px;">Tidak ada alat yang sedang dipinjam.</div>';
      var ri=document.getElementById('retAlatInfo'); if(ri) ri.textContent='Anda tidak memiliki alat yang sedang dipinjam.';
      return;
    }
    if(sel) sel.innerHTML='<option value="">— Pilih Alat —</option>'+list.map(function(a){ return '<option value="'+esc(a.nama)+'" data-jml="'+a.jumlah+'">'+esc(a.nama)+' (dipinjam: '+a.jumlah+')</option>'; }).join('');
    if(displayEl){
      var html='<div style="display:flex;flex-wrap:wrap;gap:10px;">';
      list.forEach(function(a){ html+='<div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:10px;"><i class="bi bi-tools" style="color:var(--success);font-size:16px;"></i><div><div style="font-weight:700;font-size:13px;">'+esc(a.nama)+'</div><div style="font-size:12px;color:var(--muted);">Dipinjam: <strong>'+a.jumlah+' pcs</strong></div></div></div>'; });
      html+='</div>';
      displayEl.innerHTML=html;
    }
  } catch(e) {}
}

function fillReturnAlatInfo() {
  var sel=document.getElementById('retAlatNama'), opt=sel.options[sel.selectedIndex], jml=opt?opt.getAttribute('data-jml'):'';
  var rj=document.getElementById('retJumlah'), ri=document.getElementById('retAlatInfo');
  if(jml){ if(rj){rj.value=jml;rj.max=jml;} if(ri) ri.textContent='Dipinjam: '+jml+' pcs. Masukkan jumlah yang dikembalikan.'; }
  else { if(rj) rj.value=''; if(ri) ri.textContent='Pilih alat untuk mengajukan pengembalian.'; }
}

async function submitReturnReq() {
  var nama=document.getElementById('retAlatNama').value, qty=Number(document.getElementById('retJumlah').value);
  var kondisi=document.getElementById('retKondisi').value, catatan=document.getElementById('retCatatan').value.trim();
  if(!nama){ Swal.fire('Peringatan','Pilih alat terlebih dahulu','warning'); return; }
  if(!qty||qty<=0){ Swal.fire('Peringatan','Masukkan jumlah yang dikembalikan','warning'); return; }
  var r=await Swal.fire({title:'Ajukan Pengembalian?',html:'Alat: <strong>'+esc(nama)+'</strong><br>Jumlah: <strong>'+qty+'</strong><br>Kondisi: <strong>'+esc(kondisi)+'</strong>',icon:'question',showCancelButton:true,confirmButtonText:'Ya, Ajukan',cancelButtonText:'Batal'});
  if(!r.isConfirmed) return;
  Swal.fire({title:'Mengirim...',allowOutsideClick:false,didOpen:function(){Swal.showLoading();}});
  try {
    var res=await callGAS('submitReturnRequest',{nim:_uname,namaAlat:nama,jumlahKembali:qty,kondisi:kondisi,catatan:catatan});
    Swal.close();
    if(res.success){
      document.getElementById('retAlatNama').value=''; document.getElementById('retJumlah').value=''; document.getElementById('retCatatan').value=''; document.getElementById('retKondisi').value='Baik';
      Swal.fire({icon:'success',title:'Pengajuan Terkirim!',text:'Pengembalian '+nama+' menunggu konfirmasi admin.',timer:3000,showConfirmButton:false});
      loadMhsActiveLoans(); loadReturnHistory(); loadMhsSummary();
    } else Swal.fire('Gagal',res.message,'error');
  } catch(e){ Swal.close(); Swal.fire('Error',e.message,'error'); }
}

async function loadReturnHistory() {
  var tb=document.getElementById('retHistBody'); if(!tb) return;
  try {
    var list=await callGAS('getReturnRequests');
    var mine=(list||[]).filter(function(r){ return r.nim===_uname; });
    if(!mine.length){ tb.innerHTML='<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">🔄</div><div class="empty-state-title">Belum ada pengajuan pengembalian</div></div></td></tr>'; return; }
    tb.innerHTML=mine.map(function(r){ var sc='b-amber'; if(r.status==='Dikonfirmasi') sc='b-green'; else if(r.status==='Ditolak') sc='b-red'; return '<tr><td style="font-size:12px;color:var(--muted);">'+esc(r.tanggal)+'</td><td style="font-weight:600;">'+esc(r.namaAlat)+'</td><td>'+esc(r.jumlah)+' pcs</td><td><span class="badge b-gray" style="font-size:10px;">'+esc(r.kondisi)+'</span></td><td><span class="badge '+sc+'">'+esc(r.status)+'</span></td></tr>'; }).join('');
  } catch(e) {}
}

/* ============================================================
   SEARCHABLE AUTOCOMPLETE — Modal Minta Bahan / Pinjam Alat
   ============================================================ */

var _reqSearchData = [];

async function openReqModal(type) {
  _reqType = type;
  document.getElementById('mdlReqTitle').textContent =
    type === 'bahan' ? 'Minta Bahan Kimia' : 'Pinjam Alat';
  document.getElementById('mdlReqBtn').innerHTML =
    '<i class="bi bi-check-circle"></i> ' + (type === 'bahan' ? 'Minta Bahan' : 'Pinjam Alat');
   // ← Tambahkan baris ini
  document.getElementById('mdlReqSearch').placeholder =
    type === 'bahan' ? 'Ketik nama atau rumus kimia...' : 'Ketik nama alat...';

  // Reset semua field
  document.getElementById('mdlReqQty').value          = '';
  document.getElementById('mdlReqSatuan').textContent = '—';
  document.getElementById('mdlReqInfo').textContent   = 'Pilih item untuk melihat stok';
  document.getElementById('mdlReqSearch').value       = '';
  document.getElementById('mdlReqNama').value         = '';
  document.getElementById('mdlReqDropdown').style.display = 'none';

  try {
    if (type === 'bahan') {
      if (!_chemData.length) {
        var chems = await callGAS('getChemicals');
        _chemData = chems; _hargaMap = {};
        chems.forEach(function(b) { _hargaMap[b.nama] = { harga: b.harga||0, satuan: b.satuan||'' }; });
      }
      _reqSearchData = _chemData.map(function(b) {
        return { nama: b.nama, sub: b.rumus || '', stok: b.stok, satuan: b.satuan || '', harga: b.harga || 0 };
      });
    } else {
      if (!_toolData.length) {
        var tools = await callGAS('getTools');
        _toolData = tools;
      }
      _reqSearchData = _toolData.map(function(t) {
        return { nama: t.nama, sub: t.spek || '', stok: t.jumlah, satuan: t.satuan || 'pcs', harga: 0 };
      });
    }
  } catch(e) { _reqSearchData = []; }

  openModal('mdlReq');
}

function filterReqSearch() {
  var q = (document.getElementById('mdlReqSearch').value || '').toLowerCase().trim();
  if (!q) {
    document.getElementById('mdlReqNama').value         = '';
    document.getElementById('mdlReqSatuan').textContent = '—';
    document.getElementById('mdlReqInfo').textContent   = 'Pilih item untuk melihat stok';
  }
  var filtered = q
    ? _reqSearchData.filter(function(d) {
        return d.nama.toLowerCase().includes(q) || d.sub.toLowerCase().includes(q);
      })
    : _reqSearchData;
  _renderReqDropdown(filtered);
}

function showReqDropdown() {
  var q = (document.getElementById('mdlReqSearch').value || '').toLowerCase().trim();
  var filtered = q
    ? _reqSearchData.filter(function(d) {
        return d.nama.toLowerCase().includes(q) || d.sub.toLowerCase().includes(q);
      })
    : _reqSearchData;
  _renderReqDropdown(filtered);
}

function hideReqDropdown() {
  var dd = document.getElementById('mdlReqDropdown');
  if (dd) dd.style.display = 'none';
}

function _renderReqDropdown(items) {
  var dd = document.getElementById('mdlReqDropdown');
  if (!dd) return;
  if (!items.length) {
    dd.innerHTML = '<div style="padding:12px 14px;font-size:13px;color:var(--muted);text-align:center;">Tidak ada item yang cocok</div>';
    dd.style.display = 'block';
    return;
  }
  dd.innerHTML = items.map(function(d) {
    var stokNum   = Number(d.stok) || 0;
    var stokColor = stokNum > 0 ? 'var(--success)' : 'var(--danger)';
    var stokTxt   = stokNum + ' ' + d.satuan;
    var dataStr   = encodeURIComponent(JSON.stringify(d));
    return '<div onmousedown="selectReqItem(decodeAndParse(\'' + dataStr + '\'))" '
      + 'style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background 0.15s;" '
      + 'onmouseover="this.style.background=\'var(--primary-light)\'" '
      + 'onmouseout="this.style.background=\'\'">'
      + '<div style="font-weight:600;font-size:13px;color:var(--text);">' + esc(d.nama) + '</div>'
      + (d.sub ? '<div style="font-size:11.5px;color:var(--muted);font-style:italic;">' + esc(d.sub) + '</div>' : '')
      + '<div style="font-size:11px;color:' + stokColor + ';margin-top:2px;font-weight:600;">'
      + (_reqType === 'bahan' ? 'Stok: ' : 'Tersedia: ') + stokTxt + '</div>'
      + '</div>';
  }).join('');
  dd.style.display = 'block';
}

// Helper decode — hindari masalah kutip di inline onclick
function decodeAndParse(str) {
  try { return JSON.parse(decodeURIComponent(str)); } catch(e) { return {}; }
}

function selectReqItem(d) {
  document.getElementById('mdlReqSearch').value       = d.nama;
  document.getElementById('mdlReqNama').value         = d.nama;
  document.getElementById('mdlReqSatuan').textContent = d.satuan || '—';
  document.getElementById('mdlReqDropdown').style.display = 'none';

  var infoTxt = (_reqType === 'bahan' ? 'Stok tersisa: ' : 'Tersedia: ') + d.stok + ' ' + d.satuan;
  if (_reqType === 'bahan' && d.harga > 0) {
    infoTxt += ' | Harga: ' + formatRupiah(d.harga) + '/' + d.satuan;
  }
  document.getElementById('mdlReqInfo').textContent = infoTxt;
}

// fillReqInfo tidak lagi dipakai tapi dibiarkan agar tidak error
function fillReqInfo() {}

async function doModalReq() {
   var nama = document.getElementById('mdlReqNama').value;
   var searchTxt = (document.getElementById('mdlReqSearch').value || '').trim();
   var qty  = Number(document.getElementById('mdlReqQty').value);
  // === TAMBAHAN: pastikan teks di kotak pencarian masih sama dengan item yang dipilih ===
  if (!nama || nama !== searchTxt) {
    Swal.fire('Peringatan', 'Pilih item dari daftar terlebih dahulu', 'warning');
    return;
  }
  if (!qty || qty <= 0) { Swal.fire('Peringatan', 'Masukkan jumlah yang valid', 'warning'); return; }
  closeModal('mdlReq');
  Swal.fire({ title: 'Mengirim...', allowOutsideClick: false, didOpen: function(){ Swal.showLoading(); } });
  try {
    var res = await callGAS(
      _reqType === 'bahan' ? 'submitChemicalRequest' : 'submitToolRequest',
      { nim: _uname, user: _user, nama: nama, jumlah: qty }
    );
    Swal.close();
    if (res.success) {
      Swal.fire({ toast: true, position: 'top-end', icon: 'success',
        title: 'Permintaan berhasil diajukan!', showConfirmButton: false, timer: 2500 });
      loadMhsSummary(); loadMhsHistory();
    } else Swal.fire('Gagal', res.message, 'error');
  } catch(e) { Swal.close(); Swal.fire('Error', e.message, 'error'); }
}
