/* ============================================================
   PEMINJAMAN - PENGEMBALIAN — ADMIN (konfirmasi pengajuan dari mahasiswa)
   ============================================================ */
async function loadReturnRequestsAdmin() {
  var tb=document.getElementById('tbReturnReq'); if(!tb) return;
  tb.innerHTML='<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-title">Memuat...</div></div></td></tr>';
  try {
    var list=await callGAS('getReturnRequests');
    var pending=(list||[]).filter(function(r){ return r.status==='Menunggu'; });
    var badge=document.getElementById('retReqBadge');
    if(badge){ if(pending.length>0){badge.textContent=pending.length+' pending';badge.classList.remove('hidden');}else badge.classList.add('hidden'); }
    if(!pending.length){
      tb.innerHTML='<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">Tidak ada pengajuan pending</div><div class="empty-state-sub">Semua pengembalian sudah dikonfirmasi</div></div></td></tr>';
      return;
    }
    tb.innerHTML=pending.map(function(r){
      return '<tr>'
        +'<td><div style="font-weight:700;">'+esc(r.nama)+'</div><div style="font-size:12px;color:var(--muted);">'+esc(r.nim)+'</div></td>'
        +'<td style="font-weight:600;">'+esc(r.namaAlat)+'</td>'
        +'<td>'+esc(r.jumlah)+' pcs</td>'
        +'<td><span class="badge b-gray" style="font-size:10px;">'+esc(r.kondisi)+'</span></td>'
        +'<td style="font-size:12px;color:var(--muted);">'+esc(r.tanggal)+'</td>'
        +'<td><div style="display:flex;gap:4px;">'
        +'<button class="btn btn-xs" style="background:#dcfce7;color:#166534;border:none;cursor:pointer;border-radius:6px;font-size:11px;font-weight:600;" onclick="konfirmasiReturn(\''+esc(r.idReq)+'\')"><i class="bi bi-check-lg"></i> Konfirmasi</button>'
        +'<button class="btn btn-xs" style="background:#fee2e2;color:#991b1b;border:none;cursor:pointer;border-radius:6px;font-size:11px;font-weight:600;" onclick="tolakReturn(\''+esc(r.idReq)+'\')"><i class="bi bi-x-lg"></i> Tolak</button>'
        +'</div></td></tr>';
    }).join('');
  } catch(e) {}
}

async function konfirmasiReturn(idReq) {
  var r=await Swal.fire({title:'Konfirmasi Pengembalian?',text:'Stok alat akan otomatis bertambah sesuai jumlah yang dikembalikan.',icon:'question',showCancelButton:true,confirmButtonText:'Konfirmasi',cancelButtonText:'Batal',confirmButtonColor:'#059669'});
  if(!r.isConfirmed) return;
  Swal.fire({title:'Memproses...',allowOutsideClick:false,didOpen:function(){Swal.showLoading();}});
  try {
    var res=await callGAS('confirmReturnRequest',{idReq:idReq,adminNim:_uname});
    Swal.close();
    if(res.success){ Swal.fire({toast:true,position:'top-end',icon:'success',title:'Pengembalian dikonfirmasi & stok diperbarui',showConfirmButton:false,timer:2500}); loadReturnRequestsAdmin(); loadPem(); loadInv(); refreshNavBadges(); }
    else Swal.fire('Gagal',res.message,'error');
  } catch(e){ Swal.close(); Swal.fire('Error',e.message,'error'); }
}

async function tolakReturn(idReq) {
  var r=await Swal.fire({title:'Tolak Pengembalian?',input:'text',inputLabel:'Alasan penolakan (opsional)',inputPlaceholder:'Tulis alasan...',showCancelButton:true,confirmButtonText:'Tolak',cancelButtonText:'Batal',confirmButtonColor:'#dc2626'});
  if(!r.isConfirmed) return;
  Swal.fire({title:'Menolak...',allowOutsideClick:false,didOpen:function(){Swal.showLoading();}});
  try {
    var res=await callGAS('rejectReturnRequest',{idReq:idReq,adminNim:_uname,alasan:r.value||''});
    Swal.close();
    if(res.success){ Swal.fire({toast:true,position:'top-end',icon:'success',title:'Pengajuan ditolak',showConfirmButton:false,timer:2000}); loadReturnRequestsAdmin(); refreshNavBadges(); }
    else Swal.fire('Gagal',res.message,'error');
  } catch(e){ Swal.close(); Swal.fire('Error',e.message,'error'); }
}

/* ============================================================
   PEMINJAMAN (Admin) — Tabel utama
   ============================================================ */
async function loadPem() {
  var tb=document.getElementById('tbPem');
  if(tb) tb.innerHTML='<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-title">Memuat data...</div></div></td></tr>';
  try {
    var data=await callGAS('getAllBorrowings');
    if(!data||!data.length){ if(tb) tb.innerHTML='<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-title">Belum ada data peminjaman</div></div></td></tr>'; return; }
    if(tb) tb.innerHTML=data.map(function(item){
      var strB=item.chemicals.length>0?item.chemicals.map(function(c){ return '• '+c.name+' ('+c.qty+' '+c.unit+')'; }).join('<br>'):'<span style="color:var(--muted);font-size:12px;">—</span>';
      var strA=item.equipments.length>0?item.equipments.map(function(e){ return '• '+e.name+' ('+e.qty+' '+e.unit+')'; }).join('<br>'):'<span style="color:var(--muted);font-size:12px;">—</span>';
      var ck=selClass(item.status_kembali), cb=selClass(item.status_bayar);
      /* FIX: pakai isKembaliOk/isLunasOk (bukan exact-match) supaya
         mahasiswa dengan status "Tidak Ada Peminjaman"/"Tidak Ada
         Permintaan" (tidak pernah ada transaksi) juga dianggap lolos
         syarat Bebas Lab — sinkron dengan approveLabClearance() di backend. */
      var isEligible=isKembaliOk(item.status_kembali)&&isLunasOk(item.status_bayar);
      var bc='b-gray'; if(item.status_bebas==='Approved') bc='b-green'; else if(item.status_bebas==='Belum Bebas Lab') bc='b-red';
      var btnKembali=item.equipments.length>0?'<button class="btn btn-xs" style="background:#dcfce7;color:#166534;border:none;cursor:pointer;border-radius:6px;font-size:11px;font-weight:600;" onclick="openKembali(\''+esc(item.nim)+'\',\''+esc(item.nama)+'\')"><i class="bi bi-arrow-return-left"></i> Kembalikan</button>':'';
      var tooltipBebas=''; if(!isEligible){ var tipMsg=!isKembaliOk(item.status_kembali)?'Alat belum kembali':'Tagihan belum lunas'; tooltipBebas='title="'+tipMsg+'"'; }
      var btnBebas='';
      if(item.status_bebas==='Approved'){
        btnBebas='<button class="btn btn-xs" style="background:#fee2e2;color:#991b1b;border:none;cursor:pointer;border-radius:6px;font-size:11px;font-weight:600;" onclick="cancelClear(\''+esc(item.nim)+'\')">Batal Approve</button>';
      } else {
        var disabledAttr=isEligible?'':'disabled '+tooltipBebas+' style="opacity:0.45;cursor:not-allowed;"';
        var onclickAttr=isEligible?'onclick="approveClear(\''+esc(item.nim)+'\')"':'';
        btnBebas='<button class="btn btn-xs btn-primary" '+disabledAttr+' '+onclickAttr+'>APPROVE</button>';
      }
      var btnReset=item.status_bebas==='Approved'?'<button class="btn btn-xs btn-outline" onclick="resetClear(\''+esc(item.nim)+'\')"><i class="bi bi-arrow-counterclockwise"></i> Reset</button>':'';
      return '<tr class="pem-row" data-s="'+esc((item.nama+item.nim).toLowerCase())+'">'
        +'<td><div style="font-weight:700;">'+esc(item.nama)+'</div><div style="font-size:12px;color:var(--muted);">'+esc(item.nim)+'</div><div style="font-size:11px;color:var(--muted);">'+esc(item.tanggal)+'</div></td>'
        +'<td style="font-size:12.5px;">'+strB+'<hr style="margin:5px 0;border-color:var(--border);">'+strA+'</td>'
        +'<td><select class="sel-badge '+ck+'" onchange="chgKembali(this,\''+esc(item.nim)+'\')">'
        +'<option '+(item.status_kembali==='Belum Kembali'?'selected':'')+'>Belum Kembali</option>'
        +'<option '+(item.status_kembali==='Sebagian'?'selected':'')+'>Sebagian</option>'
        +'<option '+(item.status_kembali==='Sudah Kembali'?'selected':'')+'>Sudah Kembali</option>'
        +'<option '+(item.status_kembali==='Tidak Ada Peminjaman'?'selected':'')+'>Tidak Ada Peminjaman</option></select></td>'
        +'<td><select class="sel-badge '+cb+'" onchange="chgBayar(this,\''+esc(item.nim)+'\')">'
        +'<option '+(item.status_bayar==='Belum Lunas'?'selected':'')+'>Belum Lunas</option>'
        +'<option '+(item.status_bayar==='Lunas'?'selected':'')+'>Lunas</option>'
        +'<option '+(item.status_bayar==='Tidak Ada Permintaan'?'selected':'')+'>Tidak Ada Permintaan</option></select></td>'
        +'<td><span class="badge '+bc+'">'+esc(item.status_bebas)+'</span></td>'
        +'<td><div style="display:flex;flex-wrap:wrap;gap:4px;">'
        +'<button class="btn btn-xs btn-outline" onclick="viewDetail(\''+esc(item.nim)+'\')"><i class="bi bi-eye"></i> Detail</button>'
        +btnKembali+btnBebas+btnReset+'</div></td></tr>';
    }).join('');
  } catch(e) {}
}

function filterPem() {
  var v=document.getElementById('srchPem').value.toLowerCase();
  document.querySelectorAll('#tbPem .pem-row').forEach(function(r){ r.style.display=(r.getAttribute('data-s')||'').includes(v)?'':'none'; });
}

async function chgKembali(sel, nim) {
  sel.className='sel-badge '+selClass(sel.value);
  try { await callGAS('updateReturnStatus',{nim:nim,status:sel.value,adminNim:_uname}); Swal.fire({toast:true,position:'top-end',icon:'success',title:'Status kembali diperbarui',showConfirmButton:false,timer:1500}); loadPem(); } catch(e) {}
}

async function chgBayar(sel, nim) {
  sel.className='sel-badge '+selClass(sel.value);
  try { await callGAS('updatePaymentStatus',{nim:nim,status:sel.value,adminNim:_uname}); Swal.fire({toast:true,position:'top-end',icon:'success',title:'Status bon diperbarui',showConfirmButton:false,timer:1500}); loadPem(); } catch(e) {}
}

async function approveClear(nim) {
  try {
    var res=await callGAS('approveLabClearance',{nim:nim,adminName:_user});
    if(res.success){ Swal.fire({icon:'success',title:'Bebas Lab Disetujui!',text:'Mahasiswa telah memenuhi semua syarat bebas laboratorium.',timer:3000,showConfirmButton:false}); loadPem(); }
    else Swal.fire('Gagal',res.message,'error');
  } catch(e) {}
}

async function cancelClear(nim) {
  var r=await Swal.fire({title:'Batalkan Bebas Lab?',icon:'warning',showCancelButton:true,confirmButtonText:'Ya',cancelButtonText:'Tidak'});
  if(r.isConfirmed){ try { await callGAS('cancelLabClearance',{nim:nim}); Swal.fire('Berhasil','Bebas Lab dibatalkan','success'); loadPem(); } catch(e) {} }
}

async function resetClear(nim) {
  var r=await Swal.fire({title:'Reset Bebas Lab?',text:'Status mahasiswa akan dikembalikan ke awal untuk periode baru.',icon:'warning',showCancelButton:true,confirmButtonText:'Reset',cancelButtonText:'Batal',confirmButtonColor:'#f97316'});
  if(r.isConfirmed){ try { var res=await callGAS('resetLabClearance',{nim:nim,adminNim:_uname}); if(res.success){ Swal.fire('Berhasil','Status berhasil direset','success'); loadPem(); } else Swal.fire('Gagal',res.message,'error'); } catch(e) {} }
}

async function viewDetail(nim) {
  document.getElementById('mdlDetailBody').innerHTML='<div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-title">Memuat...</div></div>';
  openModal('mdlDetail');
  try {
    var d=await callGAS('getBorrowingDetails',{nim:nim});
    if(!d){ document.getElementById('mdlDetailBody').innerHTML='<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">Data tidak ditemukan</div></div>'; return; }
    var html='<div style="font-family:\'Inter\',sans-serif;font-size:16px;font-weight:700;">'+esc(d.nama)+'</div><div style="font-size:12px;color:var(--muted);margin-bottom:14px;">'+esc(d.nim)+'</div>'
      +'<div class="divider"></div>'
      +'<div style="font-weight:700;margin-bottom:8px;font-size:13px;display:flex;align-items:center;gap:6px;"><i class="bi bi-droplet-half" style="color:var(--primary);"></i>Bahan Kimia:</div>';
    html+=d.chemicals.length>0?'<ul style="padding-left:18px;margin-bottom:14px;">'+d.chemicals.map(function(c){ return '<li style="font-size:13px;margin-bottom:4px;">'+esc(c.name)+': <strong>'+c.qty+' '+esc(c.unit)+'</strong></li>'; }).join('')+'</ul>':'<p style="color:var(--muted);font-size:13px;margin-bottom:14px;">Tidak ada</p>';
    html+='<div style="font-weight:700;margin-bottom:8px;font-size:13px;display:flex;align-items:center;gap:6px;"><i class="bi bi-tools" style="color:var(--success);"></i>Alat:</div>';
    html+=d.equipments.length>0?'<ul style="padding-left:18px;">'+d.equipments.map(function(e){ return '<li style="font-size:13px;margin-bottom:4px;">'+esc(e.name)+': <strong>'+e.qty+' '+esc(e.unit)+'</strong></li>'; }).join('')+'</ul>':'<p style="color:var(--muted);font-size:13px;">Tidak ada</p>';
    document.getElementById('mdlDetailBody').innerHTML=html;
  } catch(e) {}
}

async function openKembali(nim, namaMhs) {
  _kbNim=nim;
  document.getElementById('kbNamaMhs').textContent=namaMhs;
  document.getElementById('kbNimMhs').textContent=nim;
  document.getElementById('kbAlatList').innerHTML='<div class="skeleton" style="height:48px;border-radius:8px;margin-bottom:6px;"></div><div class="skeleton" style="height:48px;border-radius:8px;"></div>';
  document.getElementById('kbForm').classList.add('hidden'); _kbAlatNama=''; _kbAlatJml=0;
  openModal('mdlKembali');
  try {
    var list=await callGAS('getActiveEquipmentLoans',{nim:nim});
    if(!list||!list.length){ document.getElementById('kbAlatList').innerHTML='<div style="color:var(--muted);font-size:13px;padding:12px;">Tidak ada alat aktif yang dipinjam.</div>'; return; }
    var html='<div style="display:flex;flex-direction:column;gap:4px;">';
    list.forEach(function(a){ html+='<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;cursor:pointer;transition:all .18s;" onclick="selectKbAlat(\''+esc(a.nama)+'\','+a.jumlah+',this)"><span style="font-size:13px;font-weight:600;">'+esc(a.nama)+'</span><span class="badge b-red">'+a.jumlah+' pcs dipinjam</span></div>'; });
    html+='</div>';
    document.getElementById('kbAlatList').innerHTML=html;
  } catch(e) {}
}

function selectKbAlat(nama, jml, el) {
  _kbAlatNama=nama; _kbAlatJml=jml;
  document.querySelectorAll('#kbAlatList [onclick]').forEach(function(e){ e.style.borderColor='var(--border)'; e.style.background=''; });
  el.style.borderColor='var(--success)'; el.style.background='#f0fdf4';
  document.getElementById('kbSelectedNama').textContent=nama;
  document.getElementById('kbSelectedJml').textContent=jml;
  document.getElementById('kbJumlah').value=jml;
  document.getElementById('kbJumlah').max=jml;
  document.getElementById('kbForm').classList.remove('hidden');
}

async function saveKembali() {
  if(!_kbAlatNama){ Swal.fire('Peringatan','Pilih alat terlebih dahulu','warning'); return; }
  var jml=Number(document.getElementById('kbJumlah').value), kondisi=document.getElementById('kbKondisi').value;
  if(!jml||jml<=0){ Swal.fire('Gagal','Jumlah harus lebih dari 0','error'); return; }
  if(jml>_kbAlatJml){ Swal.fire('Gagal','Jumlah melebihi yang dipinjam ('+_kbAlatJml+')','error'); return; }
  Swal.fire({title:'Memproses...',allowOutsideClick:false,didOpen:function(){Swal.showLoading();}});
  try {
    var res=await callGAS('returnEquipment',{nim:_kbNim,namaAlat:_kbAlatNama,jumlahKembali:jml,kondisi:kondisi,adminNim:_uname});
    Swal.close();
    if(res.success){ closeModal('mdlKembali'); Swal.fire({icon:'success',title:'Berhasil!',text:_kbAlatNama+' berhasil dikembalikan.',timer:2500,showConfirmButton:false}); loadPem(); loadInv(); }
    else Swal.fire('Error',res.message,'error');
  } catch(e){ Swal.close(); Swal.fire('Error',e.message,'error'); }
}
