/* ============================================================
   AUDIT LOG
   ============================================================ */
async function loadAudit() {
  var tb=document.getElementById('tbAudit');
  if(tb) tb.innerHTML='<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-title">Memuat log...</div></div></td></tr>';
  try {
    var data=await callGAS('getAuditLog');
    if(!data||!data.length){ if(tb) tb.innerHTML='<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">📜</div><div class="empty-state-title">Belum ada log</div></div></td></tr>'; return; }
    if(tb) tb.innerHTML=data.map(function(l){
      var ac='b-gray', a=(l.aksi||'').toLowerCase();
      if(a.includes('tambah')||a.includes('approve')) ac='b-green';
      else if(a.includes('hapus')||a.includes('reset')) ac='b-red';
      else if(a.includes('update')||a.includes('pinjam')||a.includes('ambil')) ac='b-amber';
      return '<tr>'
        +'<td style="font-size:12px;color:var(--muted);white-space:nowrap;">'+esc(l.timestamp)+'</td>'
        +'<td style="font-size:12.5px;">'+esc(l.user)+'</td>'
        +'<td><span class="badge '+ac+'" style="font-size:10px;">'+esc(l.aksi)+'</span></td>'
        +'<td style="font-size:12.5px;">'+esc(l.target)+'</td>'
        +'<td style="font-size:12px;color:var(--muted);">'+esc(l.nilaiLama)+' → '+esc(l.nilaiBaru)+'</td></tr>';
    }).join('');
  } catch(e) {}
}

function filterAudit() {
  var v=document.getElementById('srchAudit').value.toLowerCase();
  document.querySelectorAll('#tbAudit tr').forEach(function(r){ r.style.display=r.textContent.toLowerCase().includes(v)?'':'none'; });
}

/* ============================================================
   MAINTENANCE
   ============================================================ */
async function loadMaint() {
  try {
    if(!_toolData.length){ var tools=await callGAS('getTools'); _toolData=tools; }
    var mAlat=document.getElementById('mNamaAlat');
    if(mAlat) mAlat.innerHTML='<option value="">— Pilih alat —</option>'+_toolData.map(function(t){ return '<option value="'+esc(t.nama)+'">'+esc(t.nama)+'</option>'; }).join('');
    var data=await callGAS('getMaintenanceLog');
    var tb=document.getElementById('tbMaint');
    if(!data||!data.length){
      if(tb) tb.innerHTML='<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">🔧</div><div class="empty-state-title">Belum ada log maintenance</div><div class="empty-state-sub">Catat kegiatan maintenance pertama di form atas</div></div></td></tr>';
      return;
    }
    if(tb) tb.innerHTML=data.map(function(l){
      var kc='b-green', k=(l.kondisi||'').toLowerCase();
      if(k.includes('rusak')) kc='b-red'; else if(k.includes('servis')) kc='b-amber';
      return '<tr>'
        +'<td style="font-weight:600;">'+esc(l.namaAlat)+'</td>'
        +'<td><span class="badge b-gray" style="font-size:10px;">'+esc(l.tipeKegiatan)+'</span></td>'
        +'<td style="font-size:12px;color:var(--muted);">'+esc(l.tanggal)+'</td>'
        +'<td style="font-size:12px;color:var(--muted);">'+esc(l.tanggalBerikutnya)+'</td>'
        +'<td><span class="badge '+kc+'" style="font-size:10px;">'+esc(l.kondisi)+'</span></td>'
        +'<td style="font-size:12px;color:var(--muted);">'+esc(l.catatan||'—')+'</td></tr>';
    }).join('');
  } catch(e) {}
}

async function saveMaint() {
  var o={
    namaAlat:         document.getElementById('mNamaAlat').value,
    tipeKegiatan:     document.getElementById('mTipe').value,
    tanggal:          document.getElementById('mTanggal').value,
    tanggalBerikutnya:document.getElementById('mTglBerikutnya').value,
    teknisi:          document.getElementById('mTeknisi').value.trim(),
    kondisi:          document.getElementById('mKondisi').value,
    catatan:          document.getElementById('mCatatan').value.trim()
  };
  if(!o.namaAlat||!o.tanggal){ Swal.fire('Peringatan','Nama alat dan tanggal wajib diisi','warning'); return; }
  Swal.fire({title:'Menyimpan...',allowOutsideClick:false,didOpen:function(){Swal.showLoading();}});
  try {
    var res=await callGAS('addMaintenanceLog',{obj:o,adminNim:_uname});
    Swal.close();
    if(res.success){
      ['mNamaAlat','mTanggal','mTglBerikutnya','mTeknisi','mCatatan'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
      document.getElementById('mKondisi').value='Baik';
      Swal.fire({toast:true,position:'top-end',icon:'success',title:'Log maintenance tersimpan',showConfirmButton:false,timer:2000});
      loadMaint();
    } else Swal.fire('Gagal',res.message,'error');
  } catch(e){ Swal.close(); Swal.fire('Error',e.message,'error'); }
}

/* ============================================================
   LIMBAH
   ============================================================ */
async function loadWaste() {
  var tb=document.getElementById('tbWaste');
  try {
    var data=await callGAS('getWasteLog');
    if(!data||!data.length){
      if(tb) tb.innerHTML='<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">♻️</div><div class="empty-state-title">Belum ada log limbah</div><div class="empty-state-sub">Catat pembuangan limbah pertama di form atas</div></div></td></tr>';
      return;
    }
    if(tb) tb.innerHTML=data.map(function(l){
      var kc='b-gray', kat=(l.kategoriLimbah||'').toLowerCase();
      if(kat.includes('asam')) kc='b-red';
      else if(kat.includes('basa')) kc='b-blue';
      else if(kat.includes('pecah')) kc='b-amber';
      else if(kat.includes('organik')) kc='b-purple';
      return '<tr>'
        +'<td style="font-size:12px;color:var(--muted);">'+esc(l.tanggal)+'</td>'
        +'<td><span class="badge '+kc+'" style="font-size:10px;">'+esc(l.kategoriLimbah||'—')+'</span></td>'
        +'<td style="font-weight:600;">'+esc(l.jumlah)+'</td>'
        +'<td><span class="badge b-gray" style="font-size:10px;">'+esc(l.kemasan||'—')+'</span></td>'
        +'<td style="font-size:12.5px;">'+esc(l.metodePembuangan)+'</td>'
        +'<td style="font-size:12.5px;">'+esc(l.petugasAdmin)+'</td>'
        +'<td style="font-size:12px;color:var(--muted);">'+esc(l.catatan||'—')+'</td></tr>';
    }).join('');
  } catch(e) {}
}

async function saveWaste() {
  var o={
    tanggal:         document.getElementById('wTanggal').value,        // ← baru
    kategoriLimbah:  document.getElementById('wKategori').value,
    jumlah:          document.getElementById('wJumlah').value,
    kemasan:         document.getElementById('wKemasan').value,
    metodePembuangan:document.getElementById('wMetode').value,
    catatan:         document.getElementById('wCatatan').value.trim()
  };
  // ← tambahkan wTanggal ke validasi
  if(!o.tanggal||!o.kategoriLimbah||!o.jumlah||!o.kemasan||!o.metodePembuangan){
    Swal.fire('Peringatan','Tanggal, kategori, jumlah, kemasan, dan metode wajib diisi','warning');
    return;
  }
  Swal.fire({title:'Menyimpan...',allowOutsideClick:false,didOpen:function(){Swal.showLoading();}});
  try {
    var res=await callGAS('addWasteLog',{obj:o,adminNim:_uname});
    Swal.close();
    if(res.success){
      ['wTanggal','wJumlah','wCatatan'].forEach(function(id){  // ← tambah wTanggal ke reset
        var el=document.getElementById(id); if(el) el.value='';
      });
      document.getElementById('wKategori').value='';
      document.getElementById('wKemasan').value='';
      document.getElementById('wMetode').value='';
      Swal.fire({toast:true,position:'top-end',icon:'success',title:'Log limbah tersimpan',showConfirmButton:false,timer:2000});
      loadWaste();
    } else Swal.fire('Gagal',res.message,'error');
  } catch(e){ Swal.close(); Swal.fire('Error',e.message,'error'); }
}
/* ============================================================
   MOBILE ENHANCEMENT
   Tambahkan di paling bawah js/misc.js
   ============================================================ */
(function () {
  'use strict';

  /* ── Deteksi mobile ── */
  function isMobileDevice() {
    return window.innerWidth <= 768
      || /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
  }

  /* ── Terapkan class & override saat mobile ── */
  function applyMobileUI() {
    if (!isMobileDevice()) return;

    document.body.classList.add('is-mobile');

    /* Pastikan bottom nav & mobile topbar tampil */
    var bn = document.getElementById('bottomNav');
    var mt = document.getElementById('mobileTopbar');
    var tb = document.querySelector('.topbar');
    var sd = document.getElementById('sidebar');
    var mc = document.getElementById('mainContent');

    if (bn) bn.style.display = 'block';
    if (mt) mt.style.display = 'flex';
    if (tb) tb.style.display = 'none';
    if (sd) sd.style.transform = 'translateX(-260px)';
    if (mc) {
      mc.style.marginLeft  = '0';
      mc.style.paddingBottom = '72px';
    }
  }

  /* ── Ripple effect saat tap tombol ── */
  function initRipple() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('.btn, .db-action-item, .bn-item');
      if (!el || !isMobileDevice()) return;
      var ripple = document.createElement('span');
      ripple.className = 'ripple-effect';
      var rect = el.getBoundingClientRect();
      ripple.style.left = (e.clientX - rect.left) + 'px';
      ripple.style.top  = (e.clientY - rect.top)  + 'px';
      el.style.position = 'relative';
      el.style.overflow = 'hidden';
      el.appendChild(ripple);
      setTimeout(function () { ripple.remove(); }, 500);
    });
  }

  /* ── Resize: update saat rotasi layar ── */
  window.addEventListener('resize', function () {
    if (isMobileDevice()) {
      applyMobileUI();
    } else {
      document.body.classList.remove('is-mobile');
      var mc = document.getElementById('mainContent');
      if (mc) {
        mc.style.marginLeft    = '';
        mc.style.paddingBottom = '';
      }
    }
  });

  /* ── Init ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      applyMobileUI();
      initRipple();
    });
  } else {
    applyMobileUI();
    initRipple();
  }
})();
