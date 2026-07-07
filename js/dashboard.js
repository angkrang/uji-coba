/* ============================================================
   ADMIN DASHBOARD
   ============================================================ */
var cBahanInst = null, cAlatInst = null;

if (typeof ChartDataLabels !== 'undefined' && typeof Chart !== 'undefined') {
  Chart.register(ChartDataLabels);
  Chart.defaults.set('plugins.datalabels', { display: false });
}

async function loadAdminDash() {
  try {
    var s = await callGAS('getDashboardStats');
    function set(id,v){ var el=document.getElementById(id); if(el) el.textContent=v; }
    set('st-bahan',  s.totalBahan    || 0);
    set('st-alat',   s.totalAlat     || 0);
    set('st-kritis', s.totalKritis   || 0);
    set('st-mhs',    s.statMhs       || 0);
    set('st-pay',    s.pendingPayment || 0);
    var nb=document.getElementById('navBadgePay');
    if(nb){ if((s.pendingPayment||0)>0){nb.textContent=s.pendingPayment;nb.classList.remove('hidden');}else nb.classList.add('hidden'); }
    var nr=document.getElementById('navBadgeRet');
    if(nr){ if((s.pendingReturn||0)>0){nr.textContent=s.pendingReturn;nr.classList.remove('hidden');}else nr.classList.add('hidden'); }
  } catch(e) {}
  loadAdminStudentCards();
  loadAdminCharts();
  loadKalibrasiDash();
  loadMhsExternalSummary();
  loadSurveiTren();
}

/* ============================================================
   MODAL LIHAT SEMUA MAHASISWA
   ============================================================ */
async function openModalAllStudents() {
  openModal('mdlAllStudents');
  var tb=document.getElementById('tbAllStudentsBody');
  if(tb) tb.innerHTML='<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-title">Memuat data...</div></div></td></tr>';
  document.getElementById('srchStudentModal').value='';
  try {
    var dataRaw = await callGAS('getAllBorrowings');
    // [FIX] modal ini khusus "Seluruh Mahasiswa Aktif" — hanya tampilkan
    // mahasiswa yang statusnya PERSIS 'aktif' di Rekap. Status kosong,
    // 'lulus', atau nilai lain apapun tidak ikut ditampilkan.
    var data = (dataRaw||[]).filter(function(b){
      return (b.statusMahasiswa||'').toLowerCase().trim()==='aktif';
    });
    if(!data||!data.length){
      if(tb) tb.innerHTML='<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-title">Belum ada mahasiswa aktif</div></div></td></tr>';
      return;
    }
    if(tb) tb.innerHTML = data.map(function(b){
      var sisa=b.sisaWaktu||'—', sc='b-green';
      if(sisa==='Izin Penelitian Habis') sc='b-red';
      else if(typeof b.sisaHari==='number'&&b.sisaHari<30) sc='b-amber';
      var bc=b.status_bebas==='Approved'?'b-green':'b-red';
      return '<tr class="student-modal-row" style="cursor:pointer;" '
        +'data-s="'+esc((b.nim+b.nama).toLowerCase())+'" '
        +'onclick="closeModal(\'mdlAllStudents\');loadStudentDetail(\''+esc(b.nim)+'\')">'
        +'<td><code>'+esc(b.nim)+'</code></td>'
        +'<td style="color:var(--primary);font-weight:700;">'+esc(b.nama)+'</td>'
        +'<td style="font-size:12px;">'+esc(b.dosenPembimbing||'—')+'</td>'
        +'<td style="font-size:12px;font-style:italic;">'+esc(b.judulPenelitian||'—')+'</td>'
        +'<td style="font-size:12px;color:var(--muted);">'+esc(b.tanggalMulai||'—')+' – '+esc(b.tanggalSelesai||'—')+'</td>'
        +'<td><span class="badge '+sc+'" style="font-size:10px;">'+esc(sisa)+'</span></td>'
        +'<td><span class="badge '+bc+'" style="font-size:10px;">'+esc(b.status_bebas||'Belum Bebas Lab')+'</span></td>'
        +'</tr>';
    }).join('');
  } catch(e) {
    if(tb) tb.innerHTML='<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--muted);">Gagal memuat data.</td></tr>';
  }
}

function filterStudentModal() {
  var v=document.getElementById('srchStudentModal').value.toLowerCase();
  document.querySelectorAll('#tbAllStudentsBody .student-modal-row').forEach(function(r){
    r.style.display=(r.getAttribute('data-s')||'').includes(v)?'':'none';
  });
}

function _normalizeExtStudent(ext) {
  var sisaHari=null, sisaWaktu='—';
  if(ext.tanggalSelesai&&ext.tanggalSelesai!=='—'){
    try{
      var p=ext.tanggalSelesai.split('/');
      if(p.length===3){
        var tglSelesai=new Date(+p[2],p[1]-1,+p[0]);
        sisaHari=Math.round((tglSelesai-new Date())/86400000);
        if(sisaHari>0) sisaWaktu=sisaHari+' hari lagi';
        else if(sisaHari===0) sisaWaktu='Hari ini berakhir';
        else sisaWaktu='Izin Penelitian Habis';
      }
    }catch(ex){}
  }
  return {
    nim:ext.nim, nimLengkap:ext.nim, nama:ext.nama,
    dosenPembimbing:ext.pembimbing||'—', judulPenelitian:ext.judul||'—',
    tanggalMulai:ext.tanggalMulai||'—', tanggalSelesai:ext.tanggalSelesai||'—',
    sisaWaktu:sisaWaktu, sisaHari:sisaHari, status_bebas:'—',
    laboratorium:ext.laboratorium||'—', tujuan:ext.tujuan||'—',
    bon:ext.bon||'—', tahun:ext.tahun||'—', status:ext.status||'—',
    _sourceExternal:true
  };
}

/* ============================================================
   HALAMAN DETAIL MAHASISWA
   ============================================================ */
var _detailNim='', _detailBonData=[], _detailPemData=[], _detailStudentData=null;
var _detailBonSort={col:0,asc:false}, _detailPemSort={col:0,asc:false};

async function loadStudentDetail(nim) {
  _detailNim=nim;
  hideAllSec();
  var sec=document.getElementById('sec-student-detail');
  if(!sec) return;
  sec.classList.remove('hidden');
  var tt=document.getElementById('topbarTitle'); if(tt) tt.textContent='Detail Mahasiswa';
  var mt=document.getElementById('mtTitle');     if(mt) mt.textContent='Detail Mahasiswa';
  switchDetailTab('identitas');
  _renderDetailSkeleton();
  try {
    var results=await Promise.all([
      callGAS('getAllBorrowings'),
      callGAS('getMahasiswaChemicalLoans',{nim:nim}),
      callGAS('getStudentEquipmentHistory',{nim:nim}).catch(function(){return[];})
    ]);
    var allBorrowings=results[0], bonList=results[1], pemList=results[2];

    function _shortNim(s){ return (s||'').toString().replace(/\//g,'').substring(2,8); }
    var studentData=null;
    var nimShort = _shortNim(nim);
    (allBorrowings||[]).forEach(function(b){
      if (b.nim===nim || b.nimLengkap===nim || b.nim===nimShort) studentData=b;
    });

    if(!studentData){
      try{
        var extData=await callGAS('getMahasiswaExternalByNim',{nim:nim});
        if(extData&&!extData.error) studentData=_normalizeExtStudent(extData);
      }catch(ex){}
    }
    _detailBonData=bonList||[];
    _detailPemData=pemList||[];
    _detailStudentData=studentData;
    _renderDetailIdentitas(studentData);
    _renderDetailBon(_detailBonData);
    _renderDetailPem(_detailPemData);
  }catch(e){
    var content=document.getElementById('detailIdentitasContent');
    if(content) content.innerHTML='<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">Gagal memuat data</div><div class="empty-state-sub">'+esc(e.message||'Coba refresh')+'</div></div>';
  }
}

function _renderDetailSkeleton() {
  ['detailIdentitasContent','detailBonContent','detailPemContent'].forEach(function(id){
    var el=document.getElementById(id);
    if(el) el.innerHTML='<div style="display:flex;flex-direction:column;gap:12px;padding:8px 0;">'
      +'<div class="skeleton" style="height:32px;width:60%;border-radius:8px;"></div>'
      +'<div class="skeleton" style="height:20px;width:40%;border-radius:8px;"></div>'
      +'<div class="skeleton" style="height:100px;border-radius:10px;"></div></div>';
  });
}

function _renderDetailIdentitas(d) {
  var el=document.getElementById('detailIdentitasContent'); if(!el) return;
  if(!d){ el.innerHTML='<div class="empty-state"><div class="empty-state-icon">👤</div><div class="empty-state-title">Data tidak ditemukan</div></div>'; return; }
  var sisa=d.sisaWaktu||'—', sc='b-green';
  if(sisa==='Izin Penelitian Habis') sc='b-red';
  else if(typeof d.sisaHari==='number'&&d.sisaHari<30) sc='b-amber';
  var bbc=d.status_bebas==='Approved'?'b-green':'b-red';
  var progress=0;
  if(d.tanggalMulai&&d.tanggalMulai!=='—'&&d.tanggalSelesai&&d.tanggalSelesai!=='—'){
    try{
      var prs=function(s){var p=s.split('/');return new Date(p[2],p[1]-1,p[0]);};
      var st=prs(d.tanggalMulai),en=prs(d.tanggalSelesai),nw=new Date();
      progress=Math.min(100,Math.max(0,Math.round(((nw-st)/(en-st))*100)));
    }catch(ex){}
  }
  var initials=(d.nama||'?').split(' ').map(function(w){return w[0];}).slice(0,2).join('').toUpperCase();
  el.innerHTML=
    '<div style="display:grid;grid-template-columns:auto 1fr;gap:20px;align-items:start;margin-bottom:20px;">'
      +'<div style="display:flex;flex-direction:column;align-items:center;gap:8px;">'
        +'<div style="width:80px;height:80px;border-radius:50%;overflow:hidden;box-shadow:0 8px 24px rgba(76,111,165,0.25);">'
          +'<img src="assets/foto-profil-default.png" style="width:100%;height:100%;object-fit:cover;" '
          +'onerror="this.parentElement.innerHTML=\'<div style=width:100%;height:100%;background:linear-gradient(135deg,#4C6FA5,#6B93C0);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#fff;\'>'+initials+'</div>\'">'
        +'</div>'
        +'<span class="badge '+bbc+'" style="font-size:10.5px;">'+esc(d.status_bebas||'Belum Bebas Lab')+'</span>'
      +'</div>'
      +'<div>'
        +'<div style="font-size:20px;font-weight:800;color:#0f172a;margin-bottom:4px;">'+esc(d.nama)+'</div>'
        +'<div style="font-family:Courier New,monospace;font-size:13px;color:var(--muted);margin-bottom:10px;background:#f1f5f9;display:inline-block;padding:3px 10px;border-radius:6px;">'+esc(d.nimLengkap||d.nim)+'</div>'
        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">'
          +_detailRow('bi-person-workspace','Dosen Pembimbing',d.dosenPembimbing||'—')
          +_detailRow('bi-journal-richtext','Judul Penelitian',d.judulPenelitian||'—',true)
          +_detailRow('bi-calendar-event','Tanggal Mulai',d.tanggalMulai||'—')
          +_detailRow('bi-calendar-check','Tanggal Selesai',d.tanggalSelesai||'—')
        +'</div>'
      +'</div>'
    +'</div>'
    +'<div style="background:#f8fafc;border:1.5px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:16px;">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'
        +'<span style="font-size:13px;font-weight:600;"><i class="bi bi-clock-history" style="margin-right:5px;color:var(--primary);"></i>Progress Penelitian</span>'
        +'<span class="badge '+sc+'">'+esc(sisa)+'</span>'
      +'</div>'
      +'<div style="background:#e2e8f0;border-radius:999px;height:8px;overflow:hidden;">'
        +'<div style="height:100%;width:'+progress+'%;background:linear-gradient(90deg,#4C6FA5,#6B93C0);border-radius:999px;"></div>'
      +'</div>'
      +'<div style="display:flex;justify-content:space-between;margin-top:5px;font-size:11px;color:var(--muted);">'
        +'<span>'+esc(d.tanggalMulai||'—')+'</span>'
        +'<span style="font-weight:600;color:var(--primary);">'+progress+'% berjalan</span>'
        +'<span>'+esc(d.tanggalSelesai||'—')+'</span>'
      +'</div>'
    +'</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">'
      +'<div style="background:#dbeafe;border-radius:10px;padding:12px 14px;text-align:center;">'
        +'<div style="font-size:22px;font-weight:800;color:#1e40af;">'+(_detailBonData.filter(function(x){return(x.tipe||'').toLowerCase().includes('bahan');}).length||'—')+'</div>'
        +'<div style="font-size:11px;color:#1e40af;font-weight:600;margin-top:2px;">Riwayat Bon Bahan</div>'
      +'</div>'
      +'<div style="background:#dcfce7;border-radius:10px;padding:12px 14px;text-align:center;">'
        +'<div style="font-size:22px;font-weight:800;color:#166534;">'+(_detailPemData.length||'—')+'</div>'
        +'<div style="font-size:11px;color:#166534;font-weight:600;margin-top:2px;">Riwayat Peminjaman</div>'
      +'</div>'
      +'<div style="background:'+(d.status_bebas==='Approved'?'#dcfce7':'#fee2e2')+';border-radius:10px;padding:12px 14px;text-align:center;">'
        +'<div style="font-size:22px;">'+(d.status_bebas==='Approved'?'✅':'⏳')+'</div>'
        +'<div style="font-size:11px;font-weight:600;color:'+(d.status_bebas==='Approved'?'#166534':'#991b1b')+';margin-top:2px;">Bebas Lab</div>'
      +'</div>'
    +'</div>';
}

function _detailRow(icon,label,value,fullWidth){
  return '<div style="'+(fullWidth?'grid-column:span 2;':'')+'">'
    +'<div style="font-size:10.5px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;"><i class="bi '+icon+'" style="margin-right:3px;"></i>'+label+'</div>'
    +'<div style="font-size:13px;font-weight:600;color:#1e293b;line-height:1.4;">'+esc(value)+'</div>'
  +'</div>';
}

/* ============================================================
   RENDER: RIWAYAT BON BAHAN
   ============================================================ */
function _renderDetailBon(data) {
  var el=document.getElementById('detailBonContent'); if(!el) return;
  var srch=(document.getElementById('bonSearch')||{}).value||'';
  var tglDar=(document.getElementById('bonTglDari')||{}).value||'';
  var tglSmp=(document.getElementById('bonTglSampai')||{}).value||'';
  var col=_detailBonSort.col, asc=_detailBonSort.asc;
  var filtered=data.filter(function(r){
    var tipe=(r.tipe||'').toLowerCase();
    if(tipe.includes('alat')||tipe.includes('kembali alat')||tipe.includes('pinjam alat')) return false;
    var hay=(r.tanggal+' '+(r.namaBahan||'')+(r.tipe||'')+(r.status||'')).toLowerCase();
    if(srch&&!hay.includes(srch.toLowerCase())) return false;
    if(tglDar||tglSmp){
      var pts=r.tanggal.split(' ')[0].split('/');
      if(pts.length===3){
        var rd=new Date(pts[2],pts[1]-1,pts[0]);
        if(tglDar&&rd<new Date(tglDar)) return false;
        if(tglSmp&&rd>new Date(tglSmp)) return false;
      }
    }
    return true;
  });
  var flds=['tanggal','idReq','namaBahan','jumlah','','tipe','status'];
  filtered.sort(function(a,b){
    var fa=flds[col]||'tanggal', va=(a[fa]||'').toString().toLowerCase(), vb=(b[fa]||'').toString().toLowerCase();
    var na=parseFloat(va),nb=parseFloat(vb);
    if(!isNaN(na)&&!isNaN(nb)) return asc?na-nb:nb-na;
    return asc?(va<vb?-1:va>vb?1:0):(va>vb?-1:va<vb?1:0);
  });
  if(!filtered.length){
    el.innerHTML='<div class="empty-state"><div class="empty-state-icon">🧪</div><div class="empty-state-title">Tidak ada data bon bahan</div><div class="empty-state-sub">Coba ubah filter atau kata kunci</div></div>';
    return;
  }
  var arrow=function(n){return col===n?('<i class="bi bi-arrow-'+(asc?'up':'down')+'-short" style="color:var(--primary);"></i>'):''};
  var th=function(n,lbl,mw){return '<th style="cursor:pointer;user-select:none;white-space:nowrap;min-width:'+(mw||'80px')+';" onclick="_bonSortBy('+n+')">'+lbl+' '+arrow(n)+'</th>';};
  var total=0;
  var rows=filtered.map(function(r){
    var sc='b-green', s=(r.status||'').toLowerCase();
    if(s==='lunas'||s==='approved') sc='b-green';
    else if(s==='menunggu') sc='b-amber';
    else if(s==='ditolak')  sc='b-red';
    var satuan='—', hp=0;
    if(_hargaMap&&_hargaMap[r.namaBahan]) hp=parseFloat(_hargaMap[r.namaBahan].harga)||0;
    (_chemData||[]).forEach(function(c){if(c.nama===(r.namaBahan||''))satuan=c.satuan||'—';});
    var sub=(parseFloat(r.jumlah)||0)*hp; total+=sub;
    var fmt=function(n){return n>0?'Rp '+n.toLocaleString('id-ID'):'—';};
    return '<tr>'
      +'<td style="font-size:12px;color:var(--muted);white-space:nowrap;">'+esc(r.tanggal)+'</td>'
      +'<td><code style="font-size:11px;">'+esc(r.idReq||'—')+'</code></td>'
      +'<td style="font-weight:600;">'+esc(r.namaBahan||'—')+'</td>'
      +'<td style="font-weight:700;color:var(--primary);">'+esc(String(r.jumlah||'—'))+'</td>'
      +'<td style="color:var(--muted);font-size:12px;">'+esc(satuan)+'</td>'
      +'<td><span class="badge b-blue" style="font-size:10px;">'+esc(r.tipe||'—')+'</span></td>'
      +'<td><span class="badge '+sc+'" style="font-size:10px;">'+esc(r.status||'—')+'</span></td>'
      +'<td style="font-size:12px;text-align:right;">'+fmt(hp)+'</td>'
      +'<td style="font-size:12px;text-align:right;font-weight:700;color:var(--primary);">'+fmt(sub)+'</td>'
      +'</tr>';
  }).join('');
  el.innerHTML='<div class="tbl-wrap"><table class="tbl"><thead><tr>'
    +th(0,'Tanggal','110px')+th(1,'No. Bon','100px')+th(2,'Nama Bahan','140px')
    +th(3,'Jumlah','70px')+'<th style="min-width:60px;">Satuan</th>'
    +th(5,'Tipe','120px')+th(6,'Status','100px')
    +'<th style="min-width:100px;text-align:right;">Harga/Sat</th>'
    +'<th style="min-width:100px;text-align:right;">Subtotal</th>'
    +'</tr></thead><tbody>'+rows+'</tbody>'
    +'<tfoot><tr style="background:#dbeafe;">'
    +'<td colspan="8" style="text-align:right;padding:8px;font-weight:bold;font-size:12px;">TOTAL BIAYA</td>'
    +'<td style="text-align:right;padding:8px;font-weight:bold;color:#4C6FA5;">Rp '+total.toLocaleString('id-ID')+'</td>'
    +'</tr></tfoot></table></div>'
    +'<div style="font-size:12px;color:var(--muted);margin-top:8px;text-align:right;">Menampilkan <strong>'+filtered.length+'</strong> dari <strong>'+data.length+'</strong> entri</div>';
}
function _bonSortBy(col){if(_detailBonSort.col===col)_detailBonSort.asc=!_detailBonSort.asc;else{_detailBonSort.col=col;_detailBonSort.asc=true;}_renderDetailBon(_detailBonData);}
function filterDetailBon(){_renderDetailBon(_detailBonData);}

/* ============================================================
   RENDER: RIWAYAT PEMINJAMAN ALAT
   ============================================================ */
function _renderDetailPem(data) {
  var el=document.getElementById('detailPemContent'); if(!el) return;
  var srch=(document.getElementById('pemSearch')||{}).value||'';
  var tglDar=(document.getElementById('pemTglDari')||{}).value||'';
  var tglSmp=(document.getElementById('pemTglSampai')||{}).value||'';
  var col=_detailPemSort.col, asc=_detailPemSort.asc;
  var filtered=data.filter(function(r){
    var hay=((r.namaAlat||r.nama||r.namaBahan||'')+(r.status||'')+(r.kondisi||'')+(r.tanggal||'')).toLowerCase();
    if(srch&&!hay.includes(srch.toLowerCase())) return false;
    if(tglDar||tglSmp){
      var pts=(r.tanggal||'').split(' ')[0].split('/');
      if(pts.length===3){
        var rd=new Date(pts[2],pts[1]-1,pts[0]);
        if(tglDar&&rd<new Date(tglDar)) return false;
        if(tglSmp&&rd>new Date(tglSmp)) return false;
      }
    }
    return true;
  });
  var flds=['tanggal','namaAlat','jumlah','kondisi','tanggalKembali','kondisiKembali','status'];
  filtered.sort(function(a,b){
    var fa=flds[col]||'tanggal', va=(a[fa]||'').toString().toLowerCase(), vb=(b[fa]||'').toString().toLowerCase();
    var na=parseFloat(va),nb=parseFloat(vb);
    if(!isNaN(na)&&!isNaN(nb)) return asc?na-nb:nb-na;
    return asc?(va<vb?-1:va>vb?1:0):(va>vb?-1:va<vb?1:0);
  });
  if(!filtered.length){
    el.innerHTML='<div class="empty-state"><div class="empty-state-icon">🔧</div><div class="empty-state-title">Tidak ada data peminjaman</div><div class="empty-state-sub">Coba ubah filter atau kata kunci</div></div>';
    return;
  }
  var arrow=function(n){return col===n?('<i class="bi bi-arrow-'+(asc?'up':'down')+'-short" style="color:var(--success);"></i>'):''};
  var th=function(n,lbl,mw){return '<th style="cursor:pointer;user-select:none;white-space:nowrap;min-width:'+(mw||'80px')+';" onclick="_pemSortBy('+n+')">'+lbl+' '+arrow(n)+'</th>';};
  var kc=function(k){var kl=(k||'').toLowerCase();if(kl==='baik') return 'color:#166534;';if(kl.includes('rusak')) return 'color:#991b1b;';return 'color:#92400e;';};
  var rows=filtered.map(function(r){
    var nama=r.namaAlat||r.nama||r.namaBahan||'—';
    var sk=r.statusKembali||r.status||'—', sc='b-amber';
    if(sk.toLowerCase()==='sudah kembali') sc='b-green';
    else if(sk.toLowerCase()==='belum kembali') sc='b-red';
    return '<tr>'
      +'<td style="font-size:12px;color:var(--muted);white-space:nowrap;">'+esc(r.tanggal||'—')+'</td>'
      +'<td style="font-weight:600;">'+esc(nama)+'</td>'
      +'<td style="font-weight:700;color:var(--success);">'+esc(String(r.jumlah||'—'))+'</td>'
      +'<td style="font-size:12px;'+kc(r.kondisi||r.kondisiPinjam)+'">'+esc(r.kondisi||r.kondisiPinjam||'—')+'</td>'
      +'<td style="font-size:12px;color:var(--muted);">'+esc(r.tanggalKembali||'—')+'</td>'
      +'<td style="font-size:12px;'+kc(r.kondisiKembali)+'">'+esc(r.kondisiKembali||'—')+'</td>'
      +'<td><span class="badge '+sc+'" style="font-size:10px;">'+esc(sk)+'</span></td>'
      +'</tr>';
  }).join('');
  el.innerHTML='<div class="tbl-wrap"><table class="tbl"><thead><tr>'
    +th(0,'Tgl Pinjam','110px')+th(1,'Nama Alat','140px')+th(2,'Jumlah','70px')
    +th(3,'Kondisi Pinjam','120px')+th(4,'Tgl Kembali','110px')
    +th(5,'Kondisi Kembali','120px')+th(6,'Status','100px')
    +'</tr></thead><tbody>'+rows+'</tbody></table></div>'
    +'<div style="font-size:12px;color:var(--muted);margin-top:8px;text-align:right;">Menampilkan <strong>'+filtered.length+'</strong> dari <strong>'+data.length+'</strong> entri</div>';
}
function _pemSortBy(col){if(_detailPemSort.col===col)_detailPemSort.asc=!_detailPemSort.asc;else{_detailPemSort.col=col;_detailPemSort.asc=true;}_renderDetailPem(_detailPemData);}
function filterDetailPem(){_renderDetailPem(_detailPemData);}

function switchDetailTab(tab){
  ['identitas','bon','pem'].forEach(function(t){
    var btn=document.getElementById('dtab-'+t), pane=document.getElementById('dpane-'+t), isA=t===tab;
    if(btn) btn.classList.toggle('active',isA);
    if(pane) pane.classList.toggle('hidden',!isA);
  });
}

/* ============================================================
   AKSI: EDIT, HAPUS, CETAK
   ============================================================ */
function editStudentDetail() {
  if (!_detailNim) return;
  var d = _detailStudentData;

  if (!d || d._sourceExternal) {
    Swal.fire('Info', 'Mahasiswa ini hanya tercatat di data eksternal dan belum memiliki akun sistem, sehingga belum bisa diedit dari sini.', 'info');
    return;
  }

  function _parseToInputDate(str) {
    if (!str || str === '—' || str === '-') return '';
    var m = (str + '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    try {
      var dt = new Date(str);
      if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
    } catch(ex) {}
    return '';
  }

  var nimUntukEdit = _normalizeNimShort(_detailNim);
  openEditUser(nimUntukEdit, d.nama || '', 'Mahasiswa');

  var setVal = function(id, v) { var el = document.getElementById(id); if (el) el.value = v || ''; };
  setVal('uDosen',      d.dosenPembimbing && d.dosenPembimbing !== '—' ? d.dosenPembimbing : '');
  setVal('uJudul',      d.judulPenelitian && d.judulPenelitian !== '—' ? d.judulPenelitian : '');
  setVal('uTglMulai',   _parseToInputDate(d.tanggalMulai));
  setVal('uTglSelesai', _parseToInputDate(d.tanggalSelesai));
}

async function deleteStudentDetail(){
  var r=await Swal.fire({title:'Hapus Data Mahasiswa?',html:'NIM <strong>'+esc(_detailNim)+'</strong> akan dihapus permanen.',icon:'warning',showCancelButton:true,confirmButtonText:'Ya, Hapus!',cancelButtonText:'Batal',confirmButtonColor:'#dc2626'});
  if(!r.isConfirmed) return;
  Swal.fire({title:'Menghapus...',allowOutsideClick:false,didOpen:function(){Swal.showLoading();}});
  try{
    var res=await callGAS('deleteUser',{username:_detailNim}); Swal.close();
    if(res.success){Swal.fire({icon:'success',title:'Berhasil',text:'Data mahasiswa berhasil dihapus.',timer:2000,showConfirmButton:false});goTo('dash');}
    else Swal.fire('Gagal',res.message||'Tidak dapat menghapus.','error');
  }catch(e){Swal.close();Swal.fire('Error',e.message,'error');}
}

function printStudentIdentitas(){
  var el=document.getElementById('detailIdentitasContent');
  if(!el){Swal.fire('Info','Muat identitas terlebih dahulu','info');return;}
  _triggerPrint('Identitas Mahasiswa — NIM '+_detailNim, el.innerHTML);
}
function printStudentBon(){
  if(!_detailBonData.length){Swal.fire('Info','Tidak ada data bon','info');return;}
  var rows=_detailBonData.map(function(r){
    var satuan='—'; (_chemData||[]).forEach(function(c){if(c.nama===(r.namaBahan||''))satuan=c.satuan||'—';});
    return '<tr><td>'+esc(r.tanggal)+'</td><td>'+esc(r.idReq||'—')+'</td><td>'+esc(r.namaBahan||'—')+'</td><td>'+esc(String(r.jumlah||'—'))+'</td><td>'+esc(satuan)+'</td><td>'+esc(r.tipe||'—')+'</td><td>'+esc(r.status||'—')+'</td></tr>';
  }).join('');
  _triggerPrint('Riwayat Bon Bahan Kimia — NIM '+_detailNim,
    '<table border="1" style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:#f1f5f9;"><th>Tanggal</th><th>No. Bon</th><th>Bahan</th><th>Jumlah</th><th>Satuan</th><th>Keperluan</th><th>Status</th></tr></thead><tbody>'+rows+'</tbody></table>');
}
function printStudentPem(){
  if(!_detailPemData.length){Swal.fire('Info','Tidak ada data peminjaman','info');return;}
  var rows=_detailPemData.map(function(r){
    var nama=r.namaAlat||r.nama||r.namaBahan||'—', sk=r.statusKembali||r.status||'—';
    return '<tr><td>'+esc(r.tanggal||'—')+'</td><td>'+esc(nama)+'</td><td>'+esc(String(r.jumlah||'—'))+'</td><td>'+esc(r.kondisi||r.kondisiPinjam||'—')+'</td><td>'+esc(r.tanggalKembali||'—')+'</td><td>'+esc(r.kondisiKembali||'—')+'</td><td>'+esc(sk)+'</td></tr>';
  }).join('');
  _triggerPrint('Riwayat Peminjaman Alat — NIM '+_detailNim,
    '<table border="1" style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:#f1f5f9;"><th>Tgl Pinjam</th><th>Nama Alat</th><th>Jml</th><th>Kondisi Pinjam</th><th>Tgl Kembali</th><th>Kondisi Kembali</th><th>Status</th></tr></thead><tbody>'+rows+'</tbody></table>');
}
function printStudentFull(){
  var identEl=document.getElementById('detailIdentitasContent');
  if(!identEl){Swal.fire('Info','Muat data terlebih dahulu','info');return;}
  var bonRows=_detailBonData.map(function(r){var s='—';(_chemData||[]).forEach(function(c){if(c.nama===(r.namaBahan||''))s=c.satuan||'—';});return '<tr><td>'+esc(r.tanggal)+'</td><td>'+esc(r.idReq||'—')+'</td><td>'+esc(r.namaBahan||'—')+'</td><td>'+esc(String(r.jumlah||'—'))+'</td><td>'+esc(s)+'</td><td>'+esc(r.tipe||'—')+'</td><td>'+esc(r.status||'—')+'</td></tr>';}).join('');
  var pemRows=_detailPemData.map(function(r){var nama=r.namaAlat||r.nama||r.namaBahan||'—',sk=r.statusKembali||r.status||'—';return '<tr><td>'+esc(r.tanggal||'—')+'</td><td>'+esc(nama)+'</td><td>'+esc(String(r.jumlah||'—'))+'</td><td>'+esc(r.kondisi||r.kondisiPinjam||'—')+'</td><td>'+esc(r.tanggalKembali||'—')+'</td><td>'+esc(r.kondisiKembali||'—')+'</td><td>'+esc(sk)+'</td></tr>';}).join('');
  var html=identEl.innerHTML.replace(/onclick="[^"]*"/g,'')
    +'<div style="page-break-before:always;"></div>'
    +'<h3 style="font-family:sans-serif;margin:16px 0 8px;">Riwayat Bon Bahan Kimia</h3>'
    +(bonRows?'<table border="1" style="width:100%;border-collapse:collapse;font-size:11px;"><thead><tr style="background:#f1f5f9;"><th>Tanggal</th><th>No. Bon</th><th>Bahan</th><th>Jml</th><th>Satuan</th><th>Keperluan</th><th>Status</th></tr></thead><tbody>'+bonRows+'</tbody></table>':'<p style="color:gray;">Tidak ada data.</p>')
    +'<h3 style="font-family:sans-serif;margin:24px 0 8px;">Riwayat Peminjaman Alat</h3>'
    +(pemRows?'<table border="1" style="width:100%;border-collapse:collapse;font-size:11px;"><thead><tr style="background:#f1f5f9;"><th>Tgl Pinjam</th><th>Nama Alat</th><th>Jml</th><th>Kondisi Pinjam</th><th>Tgl Kembali</th><th>Kondisi Kembali</th><th>Status</th></tr></thead><tbody>'+pemRows+'</tbody></table>':'<p style="color:gray;">Tidak ada data.</p>');
  _triggerPrint('Laporan Lengkap — NIM '+_detailNim, html);
}
function _triggerPrint(judul,content){
  var now=new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});
  var win=window.open('','_blank','width=900,height=700');
  win.document.write('<!DOCTYPE html><html><head><title>'+judul+'</title><style>body{font-family:"Segoe UI",Arial,sans-serif;font-size:13px;color:#1e293b;margin:24px;}h1{font-size:17px;margin-bottom:2px;}h3{font-size:14px;color:#4C6FA5;border-bottom:2px solid #4C6FA5;padding-bottom:4px;}.meta{font-size:11px;color:#64748b;margin-bottom:16px;}table{width:100%;border-collapse:collapse;margin-bottom:16px;}th,td{border:1px solid #e2e8f0;padding:5px 8px;text-align:left;font-size:11px;}thead tr{background:#f1f5f9;}@media print{body{margin:10mm;}}</style></head><body>'
    +'<h1>'+judul+'</h1><div class="meta">Laboratorium Kimia &amp; Biokimia Pangan &nbsp;|&nbsp; Dicetak: '+now+'</div>'
    +'<hr style="border:none;border-top:2px solid #e2e8f0;margin-bottom:16px;">'+content+'</body></html>');
  win.document.close();
  setTimeout(function(){win.focus();win.print();},400);
}

/* ============================================================
   STUDENT CARDS DI DASHBOARD
   ============================================================ */
async function loadAdminStudentCards(){
  var el=document.getElementById('adminStudentList'); if(!el) return;
  el.innerHTML='<div style="display:flex;gap:10px;"><div class="skeleton" style="height:120px;flex:1;border-radius:12px;"></div><div class="skeleton" style="height:120px;flex:1;border-radius:12px;"></div><div class="skeleton" style="height:120px;flex:1;border-radius:12px;"></div><div class="skeleton" style="height:120px;flex:1;border-radius:12px;"></div><div class="skeleton" style="height:120px;flex:1;border-radius:12px;"></div></div>';
  try{
    // [FIX] Pakai getMahasiswaExternal() langsung — sumber yang sama dengan
    // tabel daftar mahasiswa. getAllBorrowings() tidak dipakai di sini karena
    // bergantung pada join NIM USERS↔Rekap, sehingga peneliti yang NIM-nya
    // kosong atau belum terdaftar di USERS tidak akan pernah muncul di card.
    var raw=await callGAS('getMahasiswaExternal');
    var all=Array.isArray(raw)?raw:[];
    var data=all.filter(function(d){
      return (d.status||'').toLowerCase().trim()==='aktif';
    });
    if(!data||!data.length){el.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:20px;">Belum ada mahasiswa aktif.</div>';return;}

    // Hitung sisa hari dari tanggalSelesai (format dd/MM/yyyy dari backend)
    function _sisaCard(tglSelesai){
      if(!tglSelesai||tglSelesai==='\u2014') return {label:'\u2014',sc:'b-gray'};
      try{
        var p=tglSelesai.split('/');
        if(p.length!==3) return {label:tglSelesai,sc:'b-gray'};
        var tgl=new Date(+p[2],p[1]-1,+p[0]);
        var hari=Math.round((tgl-new Date())/86400000);
        if(hari<0)   return {label:'Izin Penelitian Habis',sc:'b-red'};
        if(hari===0) return {label:'Hari ini',sc:'b-amber'};
        if(hari<=30) return {label:hari+' hari',sc:'b-amber'};
        var bln=Math.floor(hari/30);
        return {label:(bln>0?(bln+' bulan '+(hari%30)+' hari'):(hari+' hari')),sc:'b-green'};
      }catch(ex){return {label:tglSelesai,sc:'b-gray'};}
    }

    var pages=[],perPage=5;
    for(var p=0;p<data.length;p+=perPage) pages.push(data.slice(p,p+perPage));
    var currentPage=0;
    function renderCards(pageIdx){
      currentPage=pageIdx;
      var items=pages[pageIdx], html='<div style="display:flex;gap:12px;flex-wrap:wrap;">';
      items.forEach(function(b){
        var dosen=(b.pembimbing&&b.pembimbing!=='\u2014')?b.pembimbing:'\u2014';
        var judul=(b.judul&&b.judul!=='\u2014')?b.judul:'\u2014';
        var nim=b.nim||'';
        var sisa=_sisaCard(b.tanggalSelesai);
        // Card bisa diklik hanya jika ada NIM; tanpa NIM tetap tampil tapi tidak bisa diklik detail
        var cardStyle='flex:1 1 180px;min-width:0;max-width:260px;';
        var cardClick=nim?('onclick="loadStudentDetail(\''+esc(nim)+'\')" style="'+cardStyle+'cursor:pointer;"')
                         :('style="'+cardStyle+'cursor:default;opacity:0.85;"');
        var hoverIn =nim?'this.style.borderColor=\'var(--primary)\';this.style.boxShadow=\'0 4px 16px rgba(76,111,165,0.12)\'':'';
        var hoverOut=nim?'this.style.borderColor=\'var(--border)\';this.style.boxShadow=\'\'':'';
        html+='<div class="identity-card" '+cardClick
          +' onmouseover="'+hoverIn+'" onmouseout="'+hoverOut+'">'
          +'<div style="font-size:10.5px;color:var(--muted);font-weight:600;text-transform:uppercase;">'+(nim?esc(nim):'<span style="color:var(--danger);font-style:italic;">NIM tidak tersedia</span>')+'</div>'
          +'<div style="font-weight:800;font-size:14px;margin:3px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--primary);">'+esc(b.nama||'\u2014')+'</div>'
          +'<div style="font-size:11.5px;color:var(--muted);margin-bottom:2px;"><i class="bi bi-person-workspace" style="margin-right:3px;"></i>'+esc(dosen)+'</div>'
          +'<div style="font-size:11px;font-style:italic;color:var(--muted);margin-bottom:6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">'+esc(judul)+'</div>'
          +'<div style="font-size:10.5px;color:var(--muted);margin-bottom:4px;"><i class="bi bi-calendar3" style="margin-right:3px;"></i>'+esc(b.tanggalMulai||'\u2014')+' \u2013 '+esc(b.tanggalSelesai||'\u2014')+'</div>'
          +'<span class="badge '+sisa.sc+'" style="font-size:10px;">\u23f1 '+esc(sisa.label)+'</span>'
          +'</div>';
      });
      html+='</div>';
      if(pages.length>1){
        html+='<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;">';
        html+='<button onclick="window._mhsCardPrev()" style="width:28px;height:28px;border-radius:50%;border:1.5px solid var(--border);background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;'+(pageIdx===0?'opacity:0.3;':'')+'\"><i class=\"bi bi-chevron-left\"></i></button>';
        pages.forEach(function(_,i){html+='<div onclick="window._mhsCardGo('+i+')" style="width:8px;height:8px;border-radius:50%;background:'+(i===pageIdx?'var(--primary)':'#cbd5e1')+';cursor:pointer;"></div>';});
        html+='<button onclick="window._mhsCardNext()" style="width:28px;height:28px;border-radius:50%;border:1.5px solid var(--border);background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;'+(pageIdx===pages.length-1?'opacity:0.3;':'')+'\"><i class=\"bi bi-chevron-right\"></i></button>';
        html+='<span style="font-size:11px;color:var(--muted);">'+(pageIdx+1)+' / '+pages.length+'</span></div>';
      }
      el.innerHTML=html;
    }
    window._mhsCardPrev=function(){if(currentPage>0) renderCards(currentPage-1);};
    window._mhsCardNext=function(){if(currentPage<pages.length-1) renderCards(currentPage+1);};
    window._mhsCardGo=function(i){renderCards(i);};
    renderCards(0);
    if(window._mhsCardTimer) clearInterval(window._mhsCardTimer);
    window._mhsCardTimer=setInterval(function(){renderCards((currentPage+1)%pages.length);},5000);
  }catch(e){el.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:20px;">Gagal memuat data.</div>';}
}

/* ============================================================
   ADMIN CHARTS
   ============================================================ */
function _mkChart(canvasId, lbl, vals, c1, c2, oldInst){
  var ctx=document.getElementById(canvasId);
  if(!ctx||!lbl||!lbl.length) return null;
  if(oldInst){try{oldInst.destroy();}catch(e){}}
  return new Chart(ctx.getContext('2d'),{
    type:'bar',
    data:{labels:lbl,datasets:[{data:vals,
      backgroundColor:function(ctx2){var chart=ctx2.chart,ca=chart.chartArea;if(!ca) return c1;var g=chart.ctx.createLinearGradient(0,ca.bottom,0,ca.top);g.addColorStop(0,c2);g.addColorStop(1,c1);return g;},
      borderRadius:8,borderSkipped:false,barThickness:22}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{backgroundColor:'#0f172a',titleColor:'#f1f5f9',bodyColor:'#94a3b8',cornerRadius:8,padding:10,
        callbacks:{label:function(c){return '  '+c.parsed.y+' kali';}}}},
      scales:{
        x:{grid:{display:false},ticks:{font:{size:11,weight:'500'},color:'#64748b',maxRotation:25,callback:function(v,i){var l=this.getLabelForValue(v);return l.length>14?l.substring(0,13)+'…':l;}}},
        y:{grid:{color:'#f8fafc'},ticks:{font:{size:11},color:'#94a3b8',stepSize:1},beginAtZero:true}},
      animation:{duration:700,easing:'easeOutQuart'}}
  });
}

async function loadAdminCharts(){
  try{
    var res=await callGAS('getAnalyticsData');
    cBahanInst=_mkChart('chartBahan',res.chem.labels,res.chem.values,'#4C6FA5','#93c5fd',cBahanInst);
    cAlatInst=_mkChart('chartAlat',res.tool.labels,res.tool.values,'#059669','#6ee7b7',cAlatInst);
    window._chartBahan = cBahanInst;
    window._chartAlat  = cAlatInst;
    setTimeout(function(){if(cBahanInst) cBahanInst.resize();},100);
  }catch(e){}
}

/* ============================================================
   KALIBRASI DASHBOARD
   ============================================================ */
async function loadKalibrasiDash(){
  var el=document.getElementById('kalibrasiList'); if(!el) return;
  el.innerHTML='<div class="skeleton" style="height:56px;border-radius:8px;margin-bottom:6px;"></div><div class="skeleton" style="height:56px;border-radius:8px;"></div>';
  try{
    var data=await callGAS('getMaintenanceLog');
    var kal=(data||[]).filter(function(l){return(l.tipeKegiatan||'').toLowerCase().includes('kalibrasi');});
    if(!kal.length){el.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:20px;">Tidak ada jadwal kalibrasi.</div>';return;}
    var html='';
    kal.slice(0,5).forEach(function(l){
      var kc='b-green',k=(l.kondisi||'').toLowerCase();
      if(k.includes('rusak')) kc='b-red'; else if(k.includes('servis')) kc='b-amber';
      var next=(l.tanggalBerikutnya&&l.tanggalBerikutnya!=='-')?'<span class="badge b-purple" style="font-size:10px;margin-top:2px;">Next: '+esc(l.tanggalBerikutnya)+'</span>':'';
      html+='<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">'
        +'<div><div style="font-weight:700;font-size:13px;">'+esc(l.namaAlat)+'</div><div style="font-size:11.5px;color:var(--muted);">'+esc(l.tanggal)+'</div></div>'
        +'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;"><span class="badge '+kc+'" style="font-size:10px;">'+esc(l.kondisi||'—')+'</span>'+next+'</div></div>';
    });
    el.innerHTML=html;
  }catch(e){}
}

/* ============================================================
   MHS EXTERNAL SUMMARY
   ============================================================ */
async function loadMhsExternalSummary(){
  var el=document.getElementById('mhsExtSummary'); if(!el) return;
  try{
    var s=await callGAS('getMahasiswaExternalStats');
    if(s.error){el.innerHTML='<div style="color:var(--muted);font-size:13px;">Gagal memuat data.</div>';return;}
    var tahunLabels=Object.keys(s.perTahun).filter(function(t){return t!=='Unknown';}).sort();
    var tahunVals=tahunLabels.map(function(k){return s.perTahun[k];});
    el.innerHTML=
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:10px;margin-bottom:16px;">'
      +_extStatCard('Total Mahasiswa',s.total,'#dbeafe','#1e40af')
      +_extStatCard('Basecamp di Lab',s.aktifLab,'#dcfce7','#166534')
      +_extStatCard('S1/Skripsi',s.s1,'#fef3c7','#92400e')
      +_extStatCard('S2/Tesis',s.s2,'#ede9fe','#5b21b6')
      +_extStatCard('S3/Disertasi',s.s3,'#f0fdf4','#166534')
      +_extStatCard('PKM & Lainnya',s.pkm+s.lainnya,'#fce7f3','#9d174d')
      +'</div>'
      +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;">'
      +'<div style="background:#f8fafc;border:1.5px solid var(--border);border-radius:12px;padding:14px 16px;min-width:0;">'
      +'<div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:10px;"><i class="bi bi-graph-up" style="color:var(--primary);margin-right:5px;"></i>Mahasiswa per Tahun</div>'
      +'<div style="height:250px;"><canvas id="chartMhsExt"></canvas></div></div>'
      +'<div style="background:#f8fafc;border:1.5px solid var(--border);border-radius:12px;padding:14px 16px;min-width:0;">'
      +'<div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:10px;"><i class="bi bi-pie-chart" style="color:#7c3aed;margin-right:5px;"></i>Jenjang Penelitian</div>'
      +'<div style="height:250px;"><canvas id="chartMhsTujuan"></canvas></div></div>'
      +'</div>'
      +'<div style="margin-top:10px;font-size:11px;color:var(--muted);"><i class="bi bi-info-circle"></i> Statistik dari mahasiswa <strong>Aktif</strong> basecamp di <strong>Lab. KBPHP</strong>.</div>';

    setTimeout(function(){
      var ctx1=document.getElementById('chartMhsExt');
      if(ctx1&&tahunLabels.length){
        new Chart(ctx1.getContext('2d'),{
          type:'line',
          data:{labels:tahunLabels,datasets:[{data:tahunVals,borderColor:'#4C6FA5',backgroundColor:'rgba(76,111,165,0.08)',borderWidth:2.5,pointBackgroundColor:'#4C6FA5',pointRadius:4,pointHoverRadius:6,tension:0.35,fill:true}]},
          options:{responsive:true,maintainAspectRatio:false,
            plugins:{legend:{display:false},tooltip:{backgroundColor:'#0f172a',titleColor:'#f1f5f9',bodyColor:'#94a3b8',cornerRadius:8,callbacks:{label:function(c){return '  '+c.parsed.y+' mahasiswa';}}}},
            scales:{x:{grid:{display:false},ticks:{font:{size:11},color:'#64748b'}},y:{beginAtZero:true,grid:{color:'#f1f5f9'},ticks:{font:{size:11},color:'#94a3b8',stepSize:1}}},
            animation:{duration:600,easing:'easeOutQuart'}}
        });
      }
      var ctx2=document.getElementById('chartMhsTujuan');
      if(ctx2){
        var donutColors=['#4C6FA5','#059669','#7c3aed','#db2777','#94a3b8'];
        var donutLabels=['S1/Skripsi','S2/Tesis','S3/Disertasi','PKM','Lainnya'];
        var donutData=[s.s1,s.s2,s.s3,s.pkm,s.lainnya];
        var donutTotal=donutData.reduce(function(a,b){return a+b;},0);
        new Chart(ctx2.getContext('2d'),{
          type:'doughnut',
          data:{labels:donutLabels,datasets:[{data:donutData,backgroundColor:donutColors,borderWidth:2,borderColor:'#fff',hoverOffset:6}]},
          options:{responsive:true,maintainAspectRatio:false,
            layout:{padding:{top:50,bottom:50,left:90,right:90}},
            plugins:{legend:{display:false},
              datalabels:{
                display:function(ctx){return donutData[ctx.dataIndex]>0;},
                anchor:'end',align:'end',offset:16,
                color:function(ctx){return donutColors[ctx.dataIndex];},
                font:{size:11,weight:'700'},textAlign:'center',
                formatter:function(value,ctx){
                  if(!value||!donutTotal) return null;
                  var pct=Math.round((value/donutTotal)*100);
                  return donutLabels[ctx.dataIndex].split('/')[0]+'\n'+value+' ('+pct+'%)';
                }
              },
              tooltip:{callbacks:{label:function(c){var pct=donutTotal>0?Math.round((c.parsed/donutTotal)*100):0;return ' '+c.label+': '+c.parsed+' ('+pct+'%)';}}}
            }
          },
          plugins:[{
            id:'pointerLines',
            afterDraw:function(chart){
              var c=chart.ctx,dataset=chart.data.datasets[0],meta=chart.getDatasetMeta(0);
              if(!donutTotal) return;
              c.save();c.lineWidth=1.2;c.setLineDash([]);
              meta.data.forEach(function(arc,i){
                if(!dataset.data[i]) return;
                var angle=(arc.startAngle+arc.endAngle)/2,outerR=arc.outerRadius,cx=arc.x,cy=arc.y,cosA=Math.cos(angle),sinA=Math.sin(angle);
                c.strokeStyle=donutColors[i];
                var x1=cx+cosA*outerR,y1=cy+sinA*outerR,x2=cx+cosA*(outerR+22),y2=cy+sinA*(outerR+22),x3=x2+(cosA>=0?18:-18),y3=y2;
                c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.lineTo(x3,y3);c.stroke();
              });
              c.restore();
            }
          }]
        });
      }
    },100);
  }catch(e){el.innerHTML='<div style="color:var(--muted);font-size:13px;">Terjadi kesalahan: '+esc(e.message||'')+'</div>';}
}

function _extStatCard(label,val,bg,color){
  return '<div style="background:'+bg+';border-radius:10px;padding:12px 14px;text-align:center;">'
    +'<div style="font-size:22px;font-weight:800;color:'+color+';">'+val+'</div>'
    +'<div style="font-size:11px;color:'+color+';font-weight:600;margin-top:2px;">'+label+'</div></div>';
}

/* ============================================================
   MAHASISWA DASHBOARD
   ============================================================ */
function loadMhsAll(){loadMhsProfile();loadMhsSummary();loadMhsHistory();loadBebasLabBanner();}

async function loadMhsProfile(){
  try{
    var info=await callGAS('getStudentInfo',{nim:_uname});
    function set(id,v){var el=document.getElementById(id);if(el)el.textContent=v;}
    function setH(id,v){var el=document.getElementById(id);if(el)el.innerHTML=v;}
    if(!info){set('mhsProfileName',_user);set('mhsProfileNim',_uname);setH('mhsProfileRows','<div class="profile-row"><span class="lbl">Data penelitian</span><span class="val">Belum diisi</span></div>');updateTrackerDonut('—','—');return;}
    set('mhsProfileName',info.nama||_user);
    set('mhsProfileNim',info.nim||_uname);
    updateTrackerDonut(info.tanggalMulai||'—',info.tanggalSelesai||'—');
    var av=document.getElementById('mhsAvatarCircle');
    if(av) av.innerHTML='<img src="assets/foto-profil-default.png" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
    var sisa=info.sisaWaktu||'—',sc='b-green';
    if(sisa==='Izin Penelitian Habis') sc='b-red';
    else if(typeof info.sisaHari==='number'&&info.sisaHari<30) sc='b-amber';
    var sb=info.statusBebas||'Belum Bebas Lab',sbc=sb==='Approved'?'b-green':'b-red';
    var rows=[['NIM',info.nim||_uname],['Dosen Pembimbing',info.dosenPembimbing||'—'],['Judul Penelitian',info.judulPenelitian||'—'],['Tanggal Mulai',info.tanggalMulai||'—'],['Tanggal Selesai',info.tanggalSelesai||'—'],['Sisa Waktu','<span class="badge '+sc+'">'+esc(sisa)+'</span>'],['Status Bebas Lab','<span class="badge '+sbc+'">'+esc(sb)+'</span>']];
    setH('mhsProfileRows',rows.map(function(r){return '<div class="profile-row"><span class="lbl">'+r[0]+'</span><span class="val">'+r[1]+'</span></div>';}).join(''));
  }catch(e){}
}

async function loadMhsSummary(){
  try{
    var data=await callGAS('getBorrowingDetails',{nim:_uname});
    var bEl=document.getElementById('mhsSumBahan'),aEl=document.getElementById('mhsSumAlat');
    if(!bEl||!aEl) return;
    var bHtml='<div style="font-weight:700;color:var(--primary);margin-bottom:8px;font-size:13px;"><i class="bi bi-droplet-half" style="margin-right:4px;"></i>Bahan Kimia</div>';
    if(data.chemicals&&data.chemicals.length>0){bHtml+='<div style="display:flex;flex-direction:column;gap:4px;">';data.chemicals.forEach(function(c){bHtml+='<div style="display:flex;justify-content:space-between;font-size:13px;padding:5px 0;border-bottom:1px solid var(--border);"><span>'+esc(c.name)+'</span><span style="font-weight:700;">'+c.qty+' '+esc(c.unit)+'</span></div>';});bHtml+='</div>';}
    else bHtml+='<div style="color:var(--muted);font-size:13px;">Tidak ada bahan yang dipinjam</div>';
    var aHtml='<div style="font-weight:700;color:var(--success);margin-bottom:8px;font-size:13px;"><i class="bi bi-tools" style="margin-right:4px;"></i>Alat</div>';
    if(data.equipments&&data.equipments.length>0){aHtml+='<div style="display:flex;flex-direction:column;gap:4px;">';data.equipments.forEach(function(e){aHtml+='<div style="display:flex;justify-content:space-between;font-size:13px;padding:5px 0;border-bottom:1px solid var(--border);"><span>'+esc(e.name)+'</span><span style="font-weight:700;">'+e.qty+' '+esc(e.unit)+'</span></div>';});aHtml+='</div>';}
    else aHtml+='<div style="color:var(--muted);font-size:13px;">Tidak ada alat yang dipinjam</div>';
    bEl.innerHTML=bHtml; aEl.innerHTML=aHtml;
    var stB=document.getElementById('stMhsBahan');if(stB)stB.textContent=(data.chemicals&&data.chemicals.length)?data.chemicals.length:0;
    var stA=document.getElementById('stMhsAlat');if(stA)stA.textContent=(data.equipments&&data.equipments.length)?data.equipments.length:0;
  }catch(e){}
}

async function loadMhsHistory(){
  var tb=document.getElementById('mhsHistBody'); if(!tb) return;
  try{
    var loans=await callGAS('getMahasiswaChemicalLoans',{nim:_uname});
    if(!loans||!loans.length){tb.innerHTML='<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">Belum ada aktivitas</div></div></td></tr>';return;}
    tb.innerHTML=loans.map(function(l){
      var kb=l.statusKembali?'<span class="badge '+(l.statusKembali==='Sudah Kembali'?'b-green':'b-amber')+'" style="font-size:10px;margin-left:4px;">'+esc(l.statusKembali)+'</span>':'';
      return '<tr><td style="font-size:12px;color:var(--muted);">'+esc(l.tanggal)+'</td><td style="font-weight:600;">'+esc(l.namaBahan)+'</td><td>'+esc(l.jumlah)+'</td><td><span class="badge b-blue" style="font-size:10px;">'+esc(l.tipe)+'</span></td><td>'+statusBadge(l.status)+kb+'</td></tr>';
    }).join('');
  }catch(e){}
}

/* ============================================================
   BANNER BEBAS LAB (MAHASISWA)
   ------------------------------------------------------------
   FIX: pakai isKembaliOk/isLunasOk supaya mahasiswa yang memang
   tidak pernah punya transaksi alat/bahan (status "Tidak Ada
   Peminjaman"/"Tidak Ada Permintaan" hasil migrasi bon legacy)
   tetap dianggap lolos pada checklist ini, bukan dianggap belum
   beres.
   ============================================================ */
async function loadBebasLabBanner(){
  var el=document.getElementById('bebasLabBannerBody'); if(!el) return;
  try{
    var results=await Promise.all([callGAS('getAllBorrowings'),callGAS('getActiveEquipmentLoans',{nim:_uname})]);
    var allData=results[0],activeLoans=results[1];
    var myData=null;(allData||[]).forEach(function(b){if(b.nim===_uname)myData=b;});
    var alatKembali=!activeLoans||activeLoans.length===0;
    var sK=myData?(myData.status_kembali||'Belum Kembali'):'Belum Kembali';
    var sB=myData?(myData.status_bayar||'Belum Lunas'):'Belum Lunas';
    var sBL=myData?(myData.status_bebas||'Belum Bebas Lab'):'Belum Bebas Lab';
    function item(ok,label,note){var icon=ok?'✅':'❌',c=ok?'#059669':'#dc2626',bg=ok?'#f0fdf4':'#fff5f5',bd=ok?'#bbf7d0':'#fecaca';return '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:'+bg+';border:1.5px solid '+bd+';border-radius:10px;"><span style="font-size:18px;">'+icon+'</span><div><div style="font-weight:700;font-size:13px;color:'+c+';">'+label+'</div><div style="font-size:12px;color:var(--muted);">'+esc(note)+'</div></div></div>';}
    var html='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">';
    html+=item(alatKembali&&isKembaliOk(sK),'Alat Dikembalikan',alatKembali?'Tidak ada alat yang masih dipinjam':'Masih ada alat yang belum dikembalikan');
    html+=item(isLunasOk(sB),'Tagihan Lunas',isLunasOk(sB)?'Tagihan bahan sudah lunas':'Tagihan bahan belum diselesaikan');
    html+=item(sBL==='Approved','Bebas Lab',sBL==='Approved'?'Bebas lab sudah disetujui admin':'Menunggu approval admin');
    html+='</div>';
    el.innerHTML=html;
  }catch(e){}
}

async function loadBebasLabStatus(){
  var el=document.getElementById('bebasLabStatusBody'); if(!el) return;
  el.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;"><div class="skeleton" style="height:68px;border-radius:10px;"></div><div class="skeleton" style="height:68px;border-radius:10px;"></div><div class="skeleton" style="height:68px;border-radius:10px;"></div></div>';

  function item(ok,label,note){
    var icon=ok?'✅':'❌',c=ok?'#059669':'#dc2626',bg=ok?'#f0fdf4':'#fff5f5',bd=ok?'#bbf7d0':'#fecaca';
    return '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:'+bg+';border:1.5px solid '+bd+';border-radius:10px;">'
      +'<span style="font-size:18px;">'+icon+'</span>'
      +'<div><div style="font-weight:700;font-size:13px;color:'+c+';">'+label+'</div>'
      +'<div style="font-size:12px;color:var(--muted);">'+esc(note)+'</div></div></div>';
  }

  /* Ambil data mahasiswa sendiri — lebih ringan daripada getAllBorrowings */
  var activeLoans=[], myPays=[], myData=null;
  try { activeLoans = await callGAS('getActiveEquipmentLoans',{nim:_uname}); } catch(e){ activeLoans=[]; }
  try { myPays     = await callGAS('getMyPaymentRequests',{nim:_uname}); }    catch(e){ myPays=[]; }
  try {
    /* getBorrowingStatus mengembalikan data satu mahasiswa — lebih ringan */
    var stat = await callGAS('getBorrowingStatus',{nim:_uname});
    if(stat && !stat.error) myData=stat;
  } catch(e){}

  /* Fallback: coba getBorrowingDetails jika getBorrowingStatus tidak ada */
  if(!myData){
    try {
      var det = await callGAS('getBorrowingDetails',{nim:_uname});
      if(det && !det.error) myData=det;
    } catch(e){}
  }

  var alatKembali = !activeLoans || activeLoans.length===0;
  var sB  = myData ? (myData.status_bayar  || myData.statusBayar  || 'Belum Lunas')   : 'Belum Lunas';
  var sBL = myData ? (myData.status_bebas  || myData.statusBebas  || 'Belum Bebas Lab'): 'Belum Bebas Lab';
  var adaPending  = (myPays||[]).some(function(p){ return p.status==='Menunggu'; });

  var html='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">';
  html+=item(alatKembali,'Alat Dikembalikan',alatKembali?'Tidak ada alat yang masih dipinjam':'Masih ada alat yang belum dikembalikan');
  var note2=isLunasOk(sB)?'Tagihan bahan sudah lunas':(adaPending?'Sedang menunggu konfirmasi admin':'Belum mengajukan tagihan bahan');
  html+=item(isLunasOk(sB),'Tagihan Lunas',note2);
  html+=item(sBL==='Approved','Bebas Lab',sBL==='Approved'?'Bebas lab sudah disetujui admin':'Menunggu approval admin');
  html+='</div>';

  if(!alatKembali && activeLoans && activeLoans.length>0){
    html+='<div style="background:#fff5f5;border:1.5px solid #fecaca;border-radius:10px;padding:12px 14px;margin-top:8px;">'
      +'<div style="font-weight:700;font-size:12px;color:#dc2626;margin-bottom:6px;"><i class="bi bi-exclamation-triangle" style="margin-right:4px;"></i>Alat yang masih dipinjam:</div>';
    activeLoans.forEach(function(a){ html+='<div style="font-size:12.5px;padding:2px 0;color:#78350f;">• '+esc(a.nama)+': '+a.jumlah+' pcs</div>'; });
    html+='</div>';
  }

  el.innerHTML=html;
}

/* ============================================================
   DATA MAHASISWA EXTERNAL
   ============================================================ */
var _mhsExtData=[],_mhsExtFiltered=[],_mhsExtPage=1,_mhsExtPerPage=20,_mhsExtLoaded=false;
var _filterMhsTujuan='',_filterMhsLab='',_filterMhsDosen='';

async function loadMhsExt(){
  if(_mhsExtLoaded&&_mhsExtData.length){filterMhsExt();return;}
  var tb=document.getElementById('tbMhsExt'); if(!tb) return;
  tb.innerHTML='<tr><td colspan="9"><div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-title">Memuat data mahasiswa...</div></div></td></tr>';
  var srchEl=document.getElementById('srchMhsExt');if(srchEl)srchEl.value='';
  var statEl=document.getElementById('filterStatusMhsExt');if(statEl)statEl.value='';
  _filterMhsTujuan='';_filterMhsLab='';_filterMhsDosen='';
  try{
    var raw=await callGAS('getMahasiswaExternal');
    var data=Array.isArray(raw)?raw:(raw&&raw.data?raw.data:raw&&raw.result?raw.result:[]);
    if(!data||data.error){
      tb.innerHTML='<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--danger);"><i class="bi bi-exclamation-triangle" style="font-size:20px;display:block;margin-bottom:6px;"></i><strong>Gagal memuat data</strong><br><span style="font-size:12px;color:var(--muted);">'+esc((data&&data.error)?data.error:'Cek nama sheet di GAS')+'</span></td></tr>';
      return;
    }
    if(!data.length){tb.innerHTML='<tr><td colspan="9"><div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-title">Belum ada data mahasiswa</div></div></td></tr>';return;}
    _mhsExtData=data;_mhsExtLoaded=true;
    var tahunEl=document.getElementById('filterTahunMhsExt');
    if(tahunEl&&tahunEl.options.length<=1){
      var tahuns=[];
      data.forEach(function(d){var t=(d.tahun||'').toString().trim();if(t&&tahuns.indexOf(t)===-1)tahuns.push(t);});
      tahuns.sort().forEach(function(t){var op=document.createElement('option');op.value=t;op.textContent=t;tahunEl.appendChild(op);});
    }
    filterMhsExt();
  }catch(e){tb.innerHTML='<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--muted);">Terjadi kesalahan: '+esc(e.message||'Unknown error')+'</td></tr>';}
}

function filterMhsExt(){
  var q=((document.getElementById('srchMhsExt')||{}).value||'').toLowerCase().trim();
  var status=((document.getElementById('filterStatusMhsExt')||{}).value||'').toLowerCase().trim();
  var tahun=((document.getElementById('filterTahunMhsExt')||{}).value||'').trim();
  _mhsExtFiltered=_mhsExtData.filter(function(d){
    if((d.status||'').toLowerCase()!=='aktif') return false;
    if(status&&(d.status||'').toLowerCase()!==status) return false;
    if(tahun&&(d.tahun||'').toString()!==tahun) return false;
    if(_filterMhsTujuan&&(d.tujuan||'')!==_filterMhsTujuan) return false;
    if(_filterMhsLab&&(d.laboratorium||'')!==_filterMhsLab) return false;
    if(_filterMhsDosen&&(d.pembimbing||'')!==_filterMhsDosen) return false;
    if(q){var hay=[d.nama,d.nim,d.judul,d.tujuan,d.laboratorium,d.pembimbing,d.bon].join(' ').toLowerCase();if(hay.indexOf(q)===-1) return false;}
    return true;
  });
  _mhsExtPage=1;
  _renderMhsExtTable();
}

function _renderMhsExtTable(){
  var tb=document.getElementById('tbMhsExt'); if(!tb) return;
  var total=_mhsExtFiltered.length, start=(_mhsExtPage-1)*_mhsExtPerPage;
  var pageData=_mhsExtFiltered.slice(start,start+_mhsExtPerPage);
  if(!pageData.length){tb.innerHTML='<tr><td colspan="9"><div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-title">Tidak ada data yang cocok</div><div class="empty-state-sub">Coba ubah kata kunci atau filter</div></div></td></tr>';_hidePagination();return;}
  var scMap={'aktif':'b-green','lulus':'b-blue','cuti':'b-amber'};
  function sisaBadge(tglSelesai){
    if(!tglSelesai||tglSelesai==='—') return '<span class="badge b-gray" style="font-size:10px;">—</span>';
    try{var p=tglSelesai.split('/');if(p.length!==3) return '<span style="font-size:12px;color:var(--muted);">'+esc(tglSelesai)+'</span>';
      var tgl=new Date(+p[2],p[1]-1,+p[0]),sisa=Math.round((tgl-new Date())/86400000);
      if(sisa<0) return '<span class="badge b-red" style="font-size:10px;white-space:nowrap;">Izin Penelitian Habis</span>';
      if(sisa===0) return '<span class="badge b-amber" style="font-size:10px;white-space:nowrap;">Hari ini</span>';
      if(sisa<=30) return '<span class="badge b-amber" style="font-size:10px;white-space:nowrap;">'+sisa+' hari</span>';
      return '<span class="badge b-green" style="font-size:10px;white-space:nowrap;">'+sisa+' hari</span>';
    }catch(ex){return '<span style="font-size:12px;color:var(--muted);">'+esc(tglSelesai)+'</span>';}
  }
  var thead=document.getElementById('theadMhsExt');
  if(thead){
    var tujuanVals=_uniqueValsMhs(_mhsExtData,'tujuan');
    var labVals=_uniqueValsMhs(_mhsExtData,'laboratorium');
    var dosenVals=_uniqueValsMhs(_mhsExtData,'pembimbing');
    thead.innerHTML='<tr>'
      +_mhsExtTh('Nama / Status',false,null,null)+_mhsExtTh('NIM',false,null,null)
      +_mhsExtTh('Judul Penelitian',false,null,null)+_mhsExtTh('Tujuan',true,'mhsTujuan',tujuanVals)
      +_mhsExtTh('Laboratorium',true,'mhsLab',labVals)+_mhsExtTh('Dosen Pembimbing',true,'mhsDosen',dosenVals)
      +_mhsExtTh('Tgl Mulai',false,null,null)+_mhsExtTh('Tgl Selesai',false,null,null)
      +_mhsExtTh('Bon',false,null,null)+'</tr>';
  }
  tb.innerHTML=pageData.map(function(d){
    var sc=scMap[(d.status||'').toLowerCase()]||'b-gray';
    var bon=d.bon?'<span class="badge b-amber" style="font-size:10px;white-space:nowrap;">'+esc(d.bon)+'</span>':'<span style="color:var(--muted);font-size:12px;">—</span>';
    return '<tr style="cursor:pointer;" onclick="loadStudentDetail(\''+esc(d.nim)+'\')" onmouseover="this.style.background=\'#f0f9ff\'" onmouseout="this.style.background=\'\'">'
      +'<td><div style="font-weight:700;font-size:13px;color:var(--primary);">'+esc(d.nama||'—')+'</div><span class="badge '+sc+'" style="font-size:10px;margin-top:3px;">'+esc(d.status||'—')+'</span></td>'
      +'<td><code style="font-size:11px;">'+esc(d.nim||'—')+'</code></td>'
      +'<td style="font-size:12px;font-style:italic;color:#374151;max-width:220px;"><div style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">'+esc(d.judul||'—')+'</div></td>'
      +'<td style="font-size:12px;">'+esc(d.tujuan||'—')+'</td>'
      +'<td style="font-size:12px;">'+esc(d.laboratorium||'—')+'</td>'
      +'<td style="font-size:12px;">'+esc(d.pembimbing||'—')+'</td>'
      +'<td style="font-size:12px;color:var(--muted);white-space:nowrap;">'+esc(d.tanggalMulai||'—')+'</td>'
      +'<td style="white-space:nowrap;min-width:160px;"><div style="font-size:12px;color:var(--muted);">'+esc(d.tanggalSelesai||'—')+'</div><div style="margin-top:2px;">'+sisaBadge(d.tanggalSelesai)+'</div></td>'
      +'<td>'+bon+'</td></tr>';
  }).join('');
  var pgWrap=document.getElementById('pgMhsExtWrap'),pgInfo=document.getElementById('pgMhsExtInfo'),pgBtns=document.getElementById('pgMhsExtBtns');
  var totalPg=Math.ceil(total/_mhsExtPerPage);
  if(totalPg>1&&pgWrap){
    pgWrap.classList.remove('hidden');
    if(pgInfo) pgInfo.textContent='Menampilkan '+(start+1)+'–'+Math.min(start+_mhsExtPerPage,total)+' dari '+total+' mahasiswa';
    if(pgBtns){
      var btns='<button '+(_mhsExtPage===1?'disabled':'')+' onclick="_mhsExtGoPage('+(_mhsExtPage-1)+')">‹ Prev</button>';
      var from=Math.max(1,_mhsExtPage-2),to=Math.min(totalPg,_mhsExtPage+2);
      for(var p=from;p<=to;p++) btns+='<button class="'+(p===_mhsExtPage?'active':'')+'" onclick="_mhsExtGoPage('+p+')">'+p+'</button>';
      btns+='<button '+(_mhsExtPage===totalPg?'disabled':'')+' onclick="_mhsExtGoPage('+(_mhsExtPage+1)+')">Next ›</button>';
      pgBtns.innerHTML=btns;
    }
  }else{_hidePagination();}
}
function _hidePagination(){var el=document.getElementById('pgMhsExtWrap');if(el)el.classList.add('hidden');}
function _mhsExtGoPage(p){_mhsExtPage=p;_renderMhsExtTable();}

/* ============================================================
   FILTER DROPDOWN HEADER TABEL MHS EXTERNAL
   ============================================================ */
function _uniqueValsMhs(arr,field){var seen={},result=[];(arr||[]).forEach(function(item){var v=(item[field]||'').toString().trim();if(v&&!seen[v]){seen[v]=true;result.push(v);}});return result.sort();}

function _mhsExtTh(label,hasFilter,fKey,fVals){
  if(!hasFilter||!fKey||!fVals||!fVals.length) return '<th style="white-space:nowrap;">'+esc(label)+'</th>';
  var cur=_getMhsFilterVal(fKey),isActive=cur!=='';
  var icFunnel=isActive?'bi-funnel-fill':'bi-funnel';
  var btnStyle=isActive?'background:rgba(76,111,165,0.12);color:var(--primary);':'background:transparent;color:#94a3b8;';
  return '<th style="white-space:nowrap;"><span style="display:inline-flex;align-items:center;gap:3px;">'+esc(label)
    +'<button class="inv-filter-btn" style="'+btnStyle+'" onclick="openMhsExtDrop(event,\''+fKey+'\',this)" title="Filter '+esc(label)+'">'
    +'<i class="bi '+icFunnel+'" style="font-size:11px;pointer-events:none;"></i></button></span></th>';
}

function openMhsExtDrop(e,key,btn){
  e.stopPropagation();
  _initInvDrop();
  if(_invDropKey==='mhs_'+key){_closeInvDrop();return;}
  _invDropKey='mhs_'+key;
  var rect=btn.getBoundingClientRect();
  var vals=_getMhsFilterVals(key),cur=_getMhsFilterVal(key),ph=_getMhsFilterPlaceholder(key);
  var options='<option value="">'+esc(ph)+'</option>';
  vals.forEach(function(v){options+='<option value="'+esc(v)+'"'+(v===cur?' selected':'')+'>'+esc(v.length>40?v.substring(0,39)+'…':v)+'</option>';});
  var clearBtn=cur!==''?'<button onclick="applyMhsExtFilter(\''+key+'\',\'\')" style="display:block;width:100%;margin-top:7px;padding:5px 10px;font-size:11.5px;font-weight:600;color:#dc2626;background:#fff5f5;border:1px solid #fecaca;border-radius:6px;cursor:pointer;text-align:center;">✕ Hapus filter</button>':'';
  _invDropEl.innerHTML='<select onchange="applyMhsExtFilter(\''+key+'\',this.value)" style="width:100%;border:1.5px solid #e4eaf4;border-radius:7px;padding:6px 28px 6px 10px;font-size:12px;font-family:Inter,sans-serif;background:#f8fafc;color:#0f172a;outline:none;cursor:pointer;appearance:none;-webkit-appearance:none;">'+options+'</select>'+clearBtn;
  var dropW=240,left=rect.left,top=rect.bottom+4;
  if(left+dropW>window.innerWidth-8) left=window.innerWidth-dropW-8;
  _invDropEl.style.width=dropW+'px';_invDropEl.style.left=left+'px';_invDropEl.style.top=top+'px';_invDropEl.style.display='block';
}
function applyMhsExtFilter(key,val){if(key==='mhsTujuan')_filterMhsTujuan=val;if(key==='mhsLab')_filterMhsLab=val;if(key==='mhsDosen')_filterMhsDosen=val;_closeInvDrop();filterMhsExt();}
function _getMhsFilterVal(key){if(key==='mhsTujuan')return _filterMhsTujuan;if(key==='mhsLab')return _filterMhsLab;if(key==='mhsDosen')return _filterMhsDosen;return '';}
function _getMhsFilterVals(key){if(key==='mhsTujuan')return _uniqueValsMhs(_mhsExtData,'tujuan');if(key==='mhsLab')return _uniqueValsMhs(_mhsExtData,'laboratorium');if(key==='mhsDosen')return _uniqueValsMhs(_mhsExtData,'pembimbing');return [];}
function _getMhsFilterPlaceholder(key){if(key==='mhsTujuan')return 'Semua Tujuan';if(key==='mhsLab')return 'Semua Laboratorium';if(key==='mhsDosen')return 'Semua Dosen Pembimbing';return 'Semua';}

/* ============================================================
   TIME TRACKER DONAT
   ============================================================ */
function updateTrackerDonut(tglMulai,tglSelesai){
  var setEl=function(id,val){var el=document.getElementById(id);if(el)el.textContent=val;};
  var totalHari=0,terpakaiHari=0,sisaHari=0,pct=0,faseLabel='—';
  if(tglMulai&&tglSelesai&&tglMulai!=='—'&&tglSelesai!=='—'){
    try{
      var parse=function(s){var p=s.split('/');return new Date(parseInt(p[2]),parseInt(p[1])-1,parseInt(p[0]));};
      var start=parse(tglMulai),end=parse(tglSelesai),now=new Date();
      now.setHours(0,0,0,0);
      totalHari=Math.max(0,Math.round((end-start)/86400000));
      terpakaiHari=Math.max(0,Math.min(totalHari,Math.round((now-start)/86400000)));
      sisaHari=Math.max(0,totalHari-terpakaiHari);
      pct=totalHari>0?Math.round((terpakaiHari/totalHari)*100):0;
      if(pct<15)faseLabel='Pengajuan & persetujuan';
      else if(pct<75)faseLabel='Penggunaan bahan & alat';
      else if(pct<92)faseLabel='Analisis & pengolahan data';
      else faseLabel='Penyelesaian & bebas lab';
    }catch(ex){}
  }
  setEl('trackerTotal',totalHari>0?totalHari+' hari':'— hari');
  setEl('trackerUsed',terpakaiHari>0?terpakaiHari+' hari':'— hari');
  setEl('trackerLeft',sisaHari>0?sisaHari+' hari':'— hari');
  setEl('trackerPhase',faseLabel);
  var outerCirc=2*Math.PI*52,outerFill=(pct/100)*outerCirc;
  var outerEl=document.getElementById('donutOuter');
  if(outerEl) outerEl.setAttribute('stroke-dasharray',outerFill.toFixed(1)+' '+outerCirc.toFixed(1));
  var innerCirc=2*Math.PI*33,fasePct=0;
  if(pct<15)fasePct=(pct/15)*100;
  else if(pct<75)fasePct=((pct-15)/60)*100;
  else if(pct<92)fasePct=((pct-75)/17)*100;
  else fasePct=((pct-92)/8)*100;
  fasePct=Math.min(100,Math.max(0,fasePct));
  var innerEl=document.getElementById('donutInner');
  if(innerEl) innerEl.setAttribute('stroke-dasharray',(fasePct/100*innerCirc).toFixed(1)+' '+innerCirc.toFixed(1));
  var pctEl=document.getElementById('donutPct');
  if(pctEl) pctEl.textContent=pct+'%';
}

/* ============================================================
   TREN KEPUASAN SURVEI
   ============================================================ */
var _surveiTrenInst = null;

async function loadSurveiTren() {
  var wrap = document.getElementById('surveiTrenWrap');
  if (!wrap) return;

  wrap.innerHTML = '<div style="display:flex;gap:10px;margin-bottom:14px;">'
    + '<div class="skeleton" style="height:64px;flex:1;border-radius:10px;"></div>'.repeat(4)
    + '</div><div class="skeleton" style="height:220px;border-radius:10px;"></div>';

  try {
    var mode = (document.getElementById('surveiTrenMode') || {}).value || 'triwulan';
    var periodeRes = await callGAS('getSurveiPeriodeList');
    if (!periodeRes.success) throw new Error('Gagal memuat periode');

    var periodeList = mode === 'tahun' ? periodeRes.tahunList : periodeRes.triwulanList;
    if (!periodeList || !periodeList.length) {
      wrap.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:13px;"><i class="bi bi-emoji-neutral" style="font-size:28px;display:block;margin-bottom:8px;"></i>Belum ada data survei.</div>';
      return;
    }

    // Ambil data tiap periode secara paralel (max 8 periode terakhir)
    var periodeToLoad = periodeList.slice(0, 8).reverse(); // urut lama→baru
    var results = await Promise.all(periodeToLoad.map(function(p) {
      return callGAS('getSurveiRekapPeriode', { periode: p });
    }));

    // Label tampilan
    var bulanMap = { 'Q1': 'Q1 (Jan–Mar)', 'Q2': 'Q2 (Apr–Jun)', 'Q3': 'Q3 (Jul–Sep)', 'Q4': 'Q4 (Okt–Des)' };
    var labels = periodeToLoad.map(function(p) {
      if (p.indexOf('-Q') !== -1) {
        var parts = p.split('-Q');
        return parts[0] + '\n' + (bulanMap['Q' + parts[1]] || 'Q' + parts[1]);
      }
      return p;
    });

    var avgKeseluruhan = results.map(function(r) { return r.success ? r.rataRataKeseluruhan : null; });
    var avgP1 = results.map(function(r) { return r.success ? r.avgPerParam[0] : null; });
    var avgP2 = results.map(function(r) { return r.success ? r.avgPerParam[1] : null; });
    var avgP3 = results.map(function(r) { return r.success ? r.avgPerParam[2] : null; });
    var avgP4 = results.map(function(r) { return r.success ? r.avgPerParam[3] : null; });
    var avgP5 = results.map(function(r) { return r.success ? r.avgPerParam[4] : null; });
    var totalResponden = results.map(function(r) { return r.success ? r.totalResponden : 0; });

    // Stat cards: periode terbaru
    var latest = results[results.length - 1];
    var latestLabel = periodeToLoad[periodeToLoad.length - 1];
    var prevLatest = results.length > 1 ? results[results.length - 2] : null;

    function trendIcon(cur, prev) {
      if (!prev || prev === null) return '';
      var d = parseFloat(cur) - parseFloat(prev);
      if (d > 0.05) return '<span style="color:#16a34a;font-size:10px;margin-left:4px;">▲ +' + d.toFixed(2) + '</span>';
      if (d < -0.05) return '<span style="color:#dc2626;font-size:10px;margin-left:4px;">▼ ' + d.toFixed(2) + '</span>';
      return '<span style="color:#64748b;font-size:10px;margin-left:4px;">— stabil</span>';
    }

    function katColor(a) { a = parseFloat(a); return isNaN(a) ? '#6b7280' : a >= 3.5 ? '#16a34a' : a >= 2.5 ? '#4C6FA5' : a >= 1.5 ? '#B96B38' : '#dc2626'; }
    function katLabel(a) { a = parseFloat(a); return isNaN(a) ? '—' : a >= 3.5 ? 'Sangat Puas' : a >= 2.5 ? 'Puas' : a >= 1.5 ? 'Cukup' : 'Kurang'; }

    var statHtml = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:16px;">';
    var paramNames = ['Pelayanan Lab','Fasilitas Bahan','Peralatan','K3','Sarana & Ruang'];
    var paramAvgs = latest && latest.success ? latest.avgPerParam : [null,null,null,null,null];
    var prevAvgs = prevLatest && prevLatest.success ? prevLatest.avgPerParam : [null,null,null,null,null];

    // Card rata-rata keseluruhan
    var oa = latest && latest.success ? latest.rataRataKeseluruhan : '—';
    var prevOa = prevLatest && prevLatest.success ? prevLatest.rataRataKeseluruhan : null;
    statHtml += '<div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:10px;padding:12px 14px;grid-column:span 2;">'
      + '<div style="font-size:10px;color:#1e40af;font-weight:600;margin-bottom:4px;"><i class="bi bi-stars"></i> Rata-rata Keseluruhan</div>'
      + '<div style="font-size:26px;font-weight:800;color:' + katColor(oa) + ';">' + oa + trendIcon(oa, prevOa) + '</div>'
      + '<div style="font-size:10.5px;color:#475569;margin-top:2px;">' + katLabel(oa) + ' &bull; ' + (latest && latest.success ? latest.totalResponden : 0) + ' responden</div>'
      + '</div>';

    // Card per parameter
    paramNames.forEach(function(name, i) {
      var a = paramAvgs[i] !== null ? paramAvgs[i] : '—';
      var prev = prevAvgs[i];
      statHtml += '<div style="background:#f8fafc;border:1.5px solid var(--border);border-radius:10px;padding:10px 12px;">'
        + '<div style="font-size:10px;color:#64748b;font-weight:600;margin-bottom:3px;">P' + (i+1) + ' ' + name + '</div>'
        + '<div style="font-size:18px;font-weight:800;color:' + katColor(a) + ';">' + a + trendIcon(a, prev) + '</div>'
        + '</div>';
    });
    statHtml += '</div>';

    // Chart
    var chartHtml = '<div style="position:relative;height:220px;"><canvas id="chartSurveiTren"></canvas></div>'
      + '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:10px;font-size:10.5px;color:#64748b;">'
      + '<span style="display:flex;align-items:center;gap:4px;"><span style="width:20px;height:3px;background:#4C6FA5;display:inline-block;border-radius:2px;"></span>Rata-rata</span>'
      + '<span style="display:flex;align-items:center;gap:4px;"><span style="width:20px;height:2px;background:#ef4444;display:inline-block;border-radius:2px;border:1px dashed #ef4444;"></span>P1 Pelayanan</span>'
      + '<span style="display:flex;align-items:center;gap:4px;"><span style="width:20px;height:2px;background:#DB8A52;display:inline-block;border-radius:2px;border:1px dashed #DB8A52;"></span>P2 Bahan</span>'
      + '<span style="display:flex;align-items:center;gap:4px;"><span style="width:20px;height:2px;background:#8b5cf6;display:inline-block;border-radius:2px;border:1px dashed #8b5cf6;"></span>P3 Peralatan</span>'
      + '<span style="display:flex;align-items:center;gap:4px;"><span style="width:20px;height:2px;background:#059669;display:inline-block;border-radius:2px;border:1px dashed #059669;"></span>P4 K3</span>'
      + '<span style="display:flex;align-items:center;gap:4px;"><span style="width:20px;height:2px;background:#db2777;display:inline-block;border-radius:2px;border:1px dashed #db2777;"></span>P5 Sarana</span>'
      + '</div>'
      + '<div style="margin-top:8px;font-size:11px;color:var(--muted);"><i class="bi bi-info-circle"></i> Menampilkan ' + periodeToLoad.length + ' periode terakhir. Skor: 1 (Kurang) – 4 (Sangat Puas).</div>';

    wrap.innerHTML = statHtml + chartHtml;

    // Render chart
    setTimeout(function() {
      var ctx = document.getElementById('chartSurveiTren');
      if (!ctx) return;
      if (_surveiTrenInst) { try { _surveiTrenInst.destroy(); } catch(e) {} }

      function makeDataset(label, data, color, isDashed) {
        return {
          label: label, data: data, borderColor: color,
          backgroundColor: isDashed ? 'transparent' : color + '18',
          borderWidth: isDashed ? 1.5 : 2.5,
          borderDash: isDashed ? [5, 4] : [],
          pointBackgroundColor: color, pointRadius: isDashed ? 3 : 4,
          pointHoverRadius: 6, tension: 0.4,
          fill: !isDashed, spanGaps: true
        };
      }

      _surveiTrenInst = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            makeDataset('Rata-rata', avgKeseluruhan, '#4C6FA5', false),
            makeDataset('P1 Pelayanan', avgP1, '#ef4444', true),
            makeDataset('P2 Bahan', avgP2, '#DB8A52', true),
            makeDataset('P3 Peralatan', avgP3, '#8b5cf6', true),
            makeDataset('P4 K3', avgP4, '#059669', true),
            makeDataset('P5 Sarana', avgP5, '#db2777', true)
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#0f172a', titleColor: '#f1f5f9', bodyColor: '#94a3b8',
              cornerRadius: 8, padding: 10,
              callbacks: {
                label: function(c) { return '  ' + c.dataset.label + ': ' + (c.parsed.y !== null ? c.parsed.y.toFixed(2) : '—'); }
              }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#64748b', maxRotation: 0 } },
            y: {
              min: 1, max: 4, grid: { color: '#f1f5f9' },
              ticks: {
                font: { size: 10 }, color: '#94a3b8', stepSize: 1,
                callback: function(v) {
                  return v === 1 ? '1 Kurang' : v === 2 ? '2 Cukup' : v === 3 ? '3 Puas' : v === 4 ? '4 Sangat Puas' : '';
                }
              }
            }
          },
          animation: { duration: 700, easing: 'easeOutQuart' }
        }
      });
    }, 100);

  } catch(e) {
    if (wrap) wrap.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:13px;"><i class="bi bi-exclamation-circle" style="font-size:28px;display:block;margin-bottom:8px;"></i>Gagal memuat data survei.<br><small>' + esc(e.message || '') + '</small></div>';
  }
}

/* ============================================================
   RESIZE CHART
   ============================================================ */
window.addEventListener('resize',function(){
  if(cBahanInst) cBahanInst.resize();
  if(cAlatInst)  cAlatInst.resize();
  if(_surveiTrenInst) _surveiTrenInst.resize();
});
