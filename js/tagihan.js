/* ============================================================
   TAGIHAN — MAHASISWA
   ============================================================ */

/* ============================================================
   KONFIGURASI POSISI CETAK BON DI ATAS BLANGKO FISIK
   (Formulir Penggunaan Bahan Kimia untuk Penelitian — FO-UGM-FTP-QP.8.5.14/L.04)

   Semua satuan dalam MILIMETER (mm), dihitung dari pojok KIRI-ATAS
   kertas A4 (210 x 297 mm). Kertas blangko dimasukkan ke printer,
   lalu HANYA teks (tanpa garis/kop/judul) yang dicetak menimpa
   kolom-kolom kosong yang sudah ada di kertas.

   ‼️ ANGKA DI BAWAH INI ADALAH PERKIRAAN AWAL, BELUM DIKALIBRASI.
   Cara mengkalibrasi:
     1. Klik tombol "Cetak Kalibrasi" pada halaman admin Tagihan.
     2. Masukkan kertas BLANGKO ASLI (bukan kertas kosong biasa) ke
        printer, lalu cetak halaman kalibrasi tersebut.
     3. Garis grid merah (vertikal, label = posisi X dalam mm) dan
        garis grid biru (horizontal, label = posisi Y dalam mm) akan
        tercetak menimpa blangko. Baca di mm berapa setiap kolom
        ("Nama Mahasiswa", kolom tabel, dst.) berada.
     4. Ubah angka x/y di bawah sesuai hasil pembacaan itu.
     5. Cetak ulang satu bon sungguhan dengan printBon(), cek hasilnya,
        ulangi penyesuaian halus (biasanya geser 1-3mm) bila perlu.

   Pemetaan kolom tabel (sesuai instruksi — kolom asli blangko dipakai
   ulang untuk data bon bahan, label cetakan kolom diabaikan/dibiarkan
   seperti aslinya di kertas):
     Kolom "No."                    -> nomor urut baris
     Kolom "Nama Alat Laboratorium" -> nama bahan
     Kolom "Tanggal"                -> jumlah bahan
     Kolom "Lama waktu (jam)"       -> harga satuan bahan (Rp)
     Kolom "Jumlah harga (Rp)"      -> jumlah harga (Rp) per baris & total
   ============================================================ */
var BLANGKO_CFG = {
  // Posisi nilai "Nama Mahasiswa" & "Nomor Mahasiswa" (setelah tanda titik-titik)
  nama: { x: 48, y: 41 },
  nim:  { x: 48, y: 47.5 },

  table: {
    startY:  79,   // posisi Y baris pertama tabel (mm dari atas)
    rowH:    9,    // tinggi tiap baris (mm) — sesuaikan dgn jumlah baris di blangko
    maxRows: 12,   // jumlah baris kosong yang tersedia di blangko

    colNo:        { x: 24,  w: 10, align: 'center' }, // kolom "No."
    colNamaBahan: { x: 39,  w: 70, align: 'left'   }, // kolom "Nama Alat Laboratorium"
    colJumlah:    { x: 113, w: 26, align: 'center' }, // kolom "Tanggal"   -> jumlah bahan
    colHarga:     { x: 143, w: 30, align: 'right'  }, // kolom "Lama waktu"-> harga satuan
    colTotal:     { x: 176, w: 28, align: 'right'  }, // kolom "Jumlah harga"

    totalRowY:    198,  // posisi Y baris "Total (Rp)" (tetap, di bawah tabel)
    terbilangY:   206,  // posisi Y kotak "Terbilang"
    terbilangX:   30
  }
};

/* Helper: render tabel formulir bahan kimia bergaya FO-UGM (preview di layar/modal) */
function _renderFormulirTable(nama, nim, prodi, items, grandTotal) {
  var noStart = 1;
  var rows = items.map(function(d, i) {
    return '<tr>'
      + '<td style="text-align:center;">' + (noStart + i) + '</td>'
      + '<td>' + esc(d.nama) + '</td>'
      + '<td style="text-align:center;">' + d.qty + ' ' + esc(d.unit || '') + '</td>'
      + '<td style="text-align:right;">' + formatRupiah(d.harga) + '</td>'
      + '<td style="text-align:right;">' + formatRupiah(d.total) + '</td>'
      + '</tr>';
  }).join('');

  return ''
    + '<div style="border:1.5px solid #b0b8c9;border-radius:4px;overflow:hidden;font-size:13px;">'

    /* — Header info mahasiswa — */
    + '<table style="width:100%;border-collapse:collapse;border-bottom:1.5px solid #b0b8c9;">'
    + '<tr>'
    + '<td style="padding:6px 10px;width:50%;border-right:1px solid #b0b8c9;">'
    + '<span style="color:var(--muted);font-size:11.5px;">Nama Mahasiswa</span><br>'
    + '<strong style="font-size:13px;">' + esc(nama) + '</strong>'
    + '</td>'
    + '<td style="padding:6px 10px;width:50%;">'
    + '<span style="color:var(--muted);font-size:11.5px;">NIM</span><br>'
    + '<strong style="font-size:13px;">' + esc(nim) + '</strong>'
    + '</td>'
    + '</tr>'
    + '<tr>'
    + '<td colspan="2" style="padding:6px 10px;border-top:1px solid #b0b8c9;">'
    + '<span style="color:var(--muted);font-size:11.5px;">Program Studi / Fakultas</span><br>'
    + '<span style="font-size:13px;">' + esc(prodi || '—') + '</span>'
    + '</td>'
    + '</tr>'
    + '</table>'

    /* — Tabel bahan — */
    + '<table style="width:100%;border-collapse:collapse;">'
    + '<thead>'
    + '<tr style="background:#dbeafe;">'
    + '<th style="padding:7px 8px;border:1px solid #b0b8c9;text-align:center;width:36px;font-size:12px;">No.</th>'
    + '<th style="padding:7px 8px;border:1px solid #b0b8c9;font-size:12px;">Nama Bahan Kimia</th>'
    + '<th style="padding:7px 8px;border:1px solid #b0b8c9;text-align:center;width:90px;font-size:12px;">Jumlah</th>'
    + '<th style="padding:7px 8px;border:1px solid #b0b8c9;text-align:right;width:110px;font-size:12px;">Harga/Satuan (Rp)</th>'
    + '<th style="padding:7px 8px;border:1px solid #b0b8c9;text-align:right;width:110px;font-size:12px;">Jumlah Harga (Rp)</th>'
    + '</tr>'
    + '</thead>'
    + '<tbody>'
    + rows
    + '</tbody>'
    + '<tfoot>'
    + '<tr style="background:#f1f5f9;">'
    + '<td colspan="4" style="padding:8px;border:1px solid #b0b8c9;text-align:right;font-weight:700;font-size:13px;">TOTAL</td>'
    + '<td style="padding:8px;border:1px solid #b0b8c9;text-align:right;font-weight:700;font-size:13px;">' + formatRupiah(grandTotal) + '</td>'
    + '</tr>'
    + '</tfoot>'
    + '</table>'

    /* — Terbilang — */
    + '<div style="padding:7px 10px;border-top:1px solid #b0b8c9;font-size:12px;">'
    + '<span style="color:var(--muted);">Terbilang: </span>'
    + '<em>' + terbilangRupiah(grandTotal) + '</em>'
    + '</div>'

    + '</div>';
}

/* Konversi angka ke kata terbilang (Rupiah) */
function terbilangRupiah(n) {
  var satuan = ['','satu','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan',
                'sepuluh','sebelas','dua belas','tiga belas','empat belas','lima belas',
                'enam belas','tujuh belas','delapan belas','sembilan belas'];
  function _t(x) {
    if (x < 20) return satuan[x];
    if (x < 100) return satuan[Math.floor(x/10)*10] || ((['','','dua ','tiga ','empat ','lima ','enam ','tujuh ','delapan ','sembilan '][Math.floor(x/10)]) + 'puluh') + (x%10?' '+satuan[x%10]:'');
    if (x < 200) return 'seratus' + (x%100?' '+_t(x%100):'');
    if (x < 1000) return satuan[Math.floor(x/100)] + ' ratus' + (x%100?' '+_t(x%100):'');
    if (x < 2000) return 'seribu' + (x%1000?' '+_t(x%1000):'');
    if (x < 1000000) return _t(Math.floor(x/1000)) + ' ribu' + (x%1000?' '+_t(x%1000):'');
    if (x < 1000000000) return _t(Math.floor(x/1000000)) + ' juta' + (x%1000000?' '+_t(x%1000000):'');
    return _t(Math.floor(x/1000000000)) + ' miliar' + (x%1000000000?' '+_t(x%1000000000):'');
  }
  if (!n || n <= 0) return 'nol rupiah';
  // fix puluhan
  function terbilangFix(x) {
    if (x < 20) return satuan[x];
    var p = Math.floor(x/10), s = x%10;
    var ps = p===1?'sepuluh':(['','','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan'][p]+' puluh');
    return ps + (s?' '+satuan[s]:'');
  }
  function rec(x) {
    if (x===0) return '';
    if (x < 20) return satuan[x];
    if (x < 100) { var p=Math.floor(x/10),s=x%10; return (['','','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan'][p]+' puluh')+(s?' '+satuan[s]:''); }
    if (x < 200) return 'seratus'+(x%100?' '+rec(x%100):'');
    if (x < 1000) return satuan[Math.floor(x/100)]+' ratus'+(x%100?' '+rec(x%100):'');
    if (x < 2000) return 'seribu'+(x%1000?' '+rec(x%1000):'');
    if (x < 1000000) return rec(Math.floor(x/1000))+' ribu'+(x%1000?' '+rec(x%1000):'');
    if (x < 1000000000) return rec(Math.floor(x/1000000))+' juta'+(x%1000000?' '+rec(x%1000000):'');
    return rec(Math.floor(x/1000000000))+' miliar'+(x%1000000000?' '+rec(x%1000000000):'');
  }
  var hasil = rec(Math.floor(n));
  // Capitalize first letter
  return hasil.charAt(0).toUpperCase() + hasil.slice(1) + ' rupiah';
}

/* Parse harga dari berbagai format: angka, "Rp2.780", "2,780", "2780" */
function _parseHarga(raw) {
  if (!raw && raw !== 0) return 0;
  if (typeof raw === 'number') return raw;
  /* Buang prefix Rp/rp/IDR, spasi, lalu ganti titik ribuan → tanpa pemisah */
  var s = raw.toString()
    .replace(/[Rr][Pp]\.?\s*/g, '')  // Rp, rp, Rp.
    .replace(/IDR\s*/gi, '')
    .replace(/\./g, '')               // titik ribuan → hilang
    .replace(/,/g, '.')               // koma desimal → titik
    .trim();
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

async function loadPaySummary() {
  var bodyEl=document.getElementById('paySummaryBody'), submitEl=document.getElementById('paySubmitWrap');
  if(!bodyEl) return;
  bodyEl.innerHTML='<div class="skeleton" style="height:80px;border-radius:8px;"></div>';
  if(submitEl) submitEl.classList.add('hidden');
  try {
    if(Object.keys(_hargaMap).length===0){
      var chems=await callGAS('getChemicals'); _chemData=chems; _hargaMap={};
      /* Debug: lihat struktur data dari GAS di console browser */
      if(chems&&chems.length) console.log('[DEBUG] sample chemical dari GAS:', JSON.stringify(chems[0]));
      chems.forEach(function(b){
        var key=(b.nama||b.name||'').toString().trim().toLowerCase();
        /* Harga bisa berupa angka (2780) atau string ("Rp2.780" / "2.780") */
        var rawHarga = b.harga||b.Harga||b.price||b.Price||b.HARGA||0;
        var harga = _parseHarga(rawHarga);
        if(key) _hargaMap[key]={harga:harga, satuan:b.satuan||b.unit||b.Satuan||''};
      });
      console.log('[DEBUG] _hargaMap sample:', JSON.stringify(Object.entries(_hargaMap).slice(0,3)));
    }
    var data=await callGAS('getBorrowingDetails',{nim:_uname});
    if(!data||!data.chemicals||!data.chemicals.length){ bodyEl.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:24px;">Tidak ada bahan kimia yang pernah diambil.</div>'; return; }
    var grandTotal=0, detailItems=[];
    data.chemicals.forEach(function(c){
      /* Lookup pakai lowercase-trim agar cocok meski beda kapitalisasi */
      var keyC=(c.name||c.nama||'').toString().trim().toLowerCase();
      var info=_hargaMap[keyC]||{}, harga=info.harga||0, total=harga*c.qty;
      grandTotal+=total;
      detailItems.push({nama:c.name||c.nama,qty:c.qty,unit:c.unit||c.satuan,harga:harga,total:total});
    });
    bodyEl.innerHTML = _renderFormulirTable(_user, _uname, '', detailItems, grandTotal);
    bodyEl.dataset.total=grandTotal; bodyEl.dataset.detail=JSON.stringify(detailItems);
    if(submitEl&&detailItems.length>0) submitEl.classList.remove('hidden');
  } catch(e) { bodyEl.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:24px;">Gagal memuat data tagihan.</div>'; }
}

async function loadPayHistory() {
  var tb=document.getElementById('payHistBody'); if(!tb) return;
  try {
    var list=await callGAS('getMyPaymentRequests',{nim:_uname});
    if(!list||!list.length){ tb.innerHTML='<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">🧾</div><div class="empty-state-title">Belum ada pengajuan tagihan</div></div></td></tr>'; return; }
    tb.innerHTML=list.map(function(p){ var sc='b-amber'; if(p.status==='Dikonfirmasi') sc='b-green'; else if(p.status==='Ditolak') sc='b-red'; return '<tr><td style="font-size:12px;color:var(--muted);">'+esc(p.tanggal)+'</td><td style="font-weight:700;color:var(--warning);">'+formatRupiah(p.totalBiaya)+'</td><td><span class="badge '+sc+'">'+esc(p.status)+'</span></td><td style="font-size:12px;">'+esc(p.approvedBy||'—')+'</td><td style="font-size:12px;color:var(--muted);">'+esc(p.approvedDate||'—')+'</td></tr>'; }).join('');
  } catch(e) {}
}

async function submitPaymentReq() {
  var bodyEl=document.getElementById('paySummaryBody'), catatan=document.getElementById('payCatatan').value.trim();
  var total=Number(bodyEl.dataset.total)||0, detail=[];
  try { detail=JSON.parse(bodyEl.dataset.detail||'[]'); } catch(e) {}
  var detail2=[];try{detail2=JSON.parse(bodyEl.dataset.detail||'[]');}catch(e){}
  if(!detail2.length){ Swal.fire('Peringatan','Tidak ada bahan kimia yang bisa diajukan','warning'); return; }
  var totalLabel = total>0 ? 'Total tagihan: <strong>'+formatRupiah(total)+'</strong>' : '<span style="color:#B96B38;">⚠️ Harga bahan belum diisi di sistem. Tagihan akan diajukan dengan total Rp 0 — admin dapat menyesuaikan.</span>';
  var r=await Swal.fire({title:'Ajukan Tagihan?',html:totalLabel+'<br><small style="color:#6b7280;">'+detail2.length+' item bahan kimia</small>',icon:'question',showCancelButton:true,confirmButtonText:'Ya, Ajukan',cancelButtonText:'Batal'});
  if(!r.isConfirmed) return;
  Swal.fire({title:'Mengirim...',allowOutsideClick:false,didOpen:function(){Swal.showLoading();}});
  try {
    var res=await callGAS('submitPaymentRequest',{nim:_uname,totalBiaya:total,detailItems:detail,catatan:catatan});
    Swal.close();
    if(res.success){ document.getElementById('payCatatan').value=''; Swal.fire({icon:'success',title:'Tagihan Diajukan!',text:'Admin akan segera mengkonfirmasi tagihan Anda.',timer:3000,showConfirmButton:false}); loadPaySummary(); loadPayHistory(); loadBebasLabStatus(); }
    else Swal.fire('Gagal',res.message,'error');
  } catch(e){ Swal.close(); Swal.fire('Error',e.message,'error'); }
}

/* ============================================================
   TAGIHAN — ADMIN
   ============================================================ */
async function loadAdminPayRequests() {
  var tbReq=document.getElementById('tbPayReq'), tbAll=document.getElementById('tbPayAll');
  if(tbReq) tbReq.innerHTML='<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-title">Memuat...</div></div></td></tr>';
  if(tbAll) tbAll.innerHTML='<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-title">Memuat...</div></div></td></tr>';
  try {
    var list=await callGAS('getPaymentRequests');
    var pending=(list||[]).filter(function(p){ return p.status==='Menunggu'; });
    window._payDetailMap={}; window._payList=list||[]; (list||[]).forEach(function(p){ window._payDetailMap[p.idReq]=p.detail||[]; });
    if(tbReq){
      if(!pending.length){
        tbReq.innerHTML='<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">Tidak ada tagihan pending</div></div></td></tr>';
      } else {
        tbReq.innerHTML=pending.map(function(p){
          return '<tr>'
            +'<td><div style="font-weight:700;">'+esc(p.nama)+'</div><div style="font-size:12px;color:var(--muted);">'+esc(p.nim)+'</div></td>'
            +'<td style="font-size:12px;color:var(--muted);">'+esc(p.tanggal)+'</td>'
            +'<td style="font-weight:700;color:var(--warning);">'+formatRupiah(p.totalBiaya)+'</td>'
            +'<td style="font-size:12px;color:var(--muted);">'+esc(p.catatan||'—')+'</td>'
            +'<td><span class="badge b-amber">Menunggu</span></td>'
            +'<td><div style="display:flex;gap:4px;">'
            +'<button class="btn btn-xs" style="background:#dbeafe;color:#1e40af;border:none;cursor:pointer;border-radius:6px;font-size:11px;font-weight:600;" onclick="viewPayDetail(\''+esc(p.idReq)+'\')"><i class="bi bi-eye"></i> Detail</button>'
            +'<button class="btn btn-xs" style="background:#dcfce7;color:#166534;border:none;cursor:pointer;border-radius:6px;font-size:11px;font-weight:600;" onclick="konfirmasiPay(\''+esc(p.idReq)+'\')"><i class="bi bi-check-lg"></i> Konfirmasi</button>'
            +'<button class="btn btn-xs" style="background:#fee2e2;color:#991b1b;border:none;cursor:pointer;border-radius:6px;font-size:11px;font-weight:600;" onclick="tolakPay(\''+esc(p.idReq)+'\')"><i class="bi bi-x-lg"></i> Tolak</button>'
            +'</div></td></tr>';
        }).join('');
      }
    }
    if(tbAll){
      if(!list.length){
        tbAll.innerHTML='<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-title">Belum ada riwayat tagihan</div></div></td></tr>';
      } else {
        tbAll.innerHTML=(list||[]).map(function(p){ var sc='b-amber'; if(p.status==='Dikonfirmasi') sc='b-green'; else if(p.status==='Ditolak') sc='b-red'; return '<tr><td><div style="font-weight:700;">'+esc(p.nama)+'</div><div style="font-size:12px;color:var(--muted);">'+esc(p.nim)+'</div></td><td style="font-size:12px;color:var(--muted);">'+esc(p.tanggal)+'</td><td style="font-weight:700;">'+formatRupiah(p.totalBiaya)+'</td><td><span class="badge '+sc+'">'+esc(p.status)+'</span></td><td style="font-size:12px;">'+esc(p.approvedBy||'—')+'</td>'+'<td><button class="btn btn-xs" style="background:#dbeafe;color:#1e40af;border:none;cursor:pointer;border-radius:6px;font-size:11px;font-weight:600;" onclick="viewPayDetail(\''+esc(p.idReq)+'\')"><i class="bi bi-eye"></i> Detail</button></td></tr>'; }).join('');
      }
    }
  } catch(e) {}
}

function viewPayDetail(idReq) {
  var bodyEl=document.getElementById('mdlPayDetailBody'); if(!bodyEl) return;
  var pay=null; (window._payList||[]).forEach(function(p){ if(p.idReq===idReq) pay=p; });
  var items=(window._payDetailMap&&window._payDetailMap[idReq])?window._payDetailMap[idReq]:[];
  if(!items.length){ bodyEl.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:20px;">Tidak ada detail item.</div>'; openModal('mdlPayDetail'); return; }
  var total=0;
  items.forEach(function(d){ total+=Number(d.total)||0; });
  var nama = (pay&&pay.nama) ? pay.nama : '—';
  var nim  = (pay&&pay.nim)  ? pay.nim  : '—';
  bodyEl.innerHTML = '<div style="padding:14px 16px;">'
    + _renderFormulirTable(nama, nim, '', items, total)
    + '<div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end;">'
    + '<button class="btn btn-sm" style="background:#385780;color:#fff;border:none;cursor:pointer;border-radius:8px;font-size:13px;font-weight:600;padding:8px 18px;" onclick="printBon(\''+esc(idReq)+'\')">'
    + '<i class="bi bi-printer"></i> Cetak Bon</button>'
    + '</div>'
    + '</div>';
  openModal('mdlPayDetail');
}

/* ============================================================
   CETAK BON — overlay di atas blangko fisik (data saja, tanpa
   garis/kop/judul, karena semua itu sudah tercetak di kertas).
   Posisi tiap elemen diatur lewat BLANGKO_CFG di atas file ini.
   ============================================================ */
function _blkField(x, y, text, opts) {
  opts = opts || {};
  var align = opts.align || 'left';
  var w = opts.w ? ('width:' + opts.w + 'mm;') : '';
  return '<div style="position:absolute;left:' + x + 'mm;top:' + y + 'mm;' + w
    + 'font-size:' + (opts.size || 10.5) + 'pt;line-height:1.15;text-align:' + align
    + ';white-space:' + (opts.wrap ? 'normal' : 'nowrap') + ';overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#000;">'
    + esc(text) + '</div>';
}

function printBon(idReq) {
  var pay = null; (window._payList || []).forEach(function(p) { if (p.idReq === idReq) pay = p; });
  var items = (window._payDetailMap && window._payDetailMap[idReq]) ? window._payDetailMap[idReq] : [];
  if (!items.length) { Swal.fire('Info', 'Tidak ada detail item untuk dicetak.', 'info'); return; }

  var total = 0; items.forEach(function(d) { total += Number(d.total) || 0; });
  var nama = (pay && pay.nama) || '—';
  var nim  = (pay && pay.nim)  || '—';
  var cfg  = BLANGKO_CFG, t = cfg.table;

  if (items.length > t.maxRows) {
    Swal.fire('Peringatan', 'Jumlah item (' + items.length + ') melebihi kapasitas baris blangko (' + t.maxRows + '). Hanya ' + t.maxRows + ' baris pertama yang akan dicetak — sisanya perlu dicatat manual di lembar tambahan.', 'warning');
  }

  var html = '';
  html += _blkField(cfg.nama.x, cfg.nama.y, nama, { w: 110 });
  html += _blkField(cfg.nim.x, cfg.nim.y, nim, { w: 80 });

  items.slice(0, t.maxRows).forEach(function(it, i) {
    var y = t.startY + i * t.rowH;
    html += _blkField(t.colNo.x, y, String(i + 1), { align: t.colNo.align, w: t.colNo.w });
    html += _blkField(t.colNamaBahan.x, y, it.nama, { align: t.colNamaBahan.align, w: t.colNamaBahan.w });
    html += _blkField(t.colJumlah.x, y, String(it.qty) + ' ' + (it.unit || it.satuan || ''), { align: t.colJumlah.align, w: t.colJumlah.w });
    html += _blkField(t.colHarga.x, y, formatRupiah(it.harga), { align: t.colHarga.align, w: t.colHarga.w });
    html += _blkField(t.colTotal.x, y, formatRupiah(Number(it.total) || 0), { align: t.colTotal.align, w: t.colTotal.w });
  });

  // Total (di kolom "Jumlah harga", baris "Total (Rp)" pada blangko)
  html += _blkField(t.colTotal.x, t.totalRowY, formatRupiah(total), { align: t.colTotal.align, w: t.colTotal.w, size: 11 });
  // Terbilang
  html += _blkField(t.terbilangX, t.terbilangY, terbilangRupiah(total), { w: 165, size: 10, wrap: true });

  var w = window.open('', '_blank', 'width=850,height=900');
  if (!w) { Swal.fire('Peringatan', 'Pop-up browser diblokir. Izinkan pop-up untuk halaman ini.', 'warning'); return; }
  w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + '<title>Cetak Bon — ' + esc(nim) + '</title>'
    + '<style>'
    + '@page{size:A4;margin:0;}'
    + '*{box-sizing:border-box;margin:0;padding:0;}'
    + 'html,body{width:210mm;height:297mm;}'
    + 'body{position:relative;}'
    + '@media print{ button{display:none!important;} }'
    + '</style></head><body>'
    + html
    + '<script>window.onload=function(){setTimeout(function(){window.print();},300);}<\/script>'
    + '</body></html>');
  w.document.close();
}

/* ============================================================
   CETAK KALIBRASI — grid pengukur (tiap 10mm, berlabel) untuk
   membantu menentukan koordinat BLANGKO_CFG yang tepat. Cetak
   halaman ini LANGSUNG di atas blangko fisik kosong, lalu baca
   posisi (mm) tiap kolom/baris dari garis grid yang tercetak.
   ============================================================ */
function printKalibrasiBlangko() {
  var w = window.open('', '_blank', 'width=850,height=900');
  if (!w) { Swal.fire('Peringatan', 'Pop-up browser diblokir. Izinkan pop-up untuk halaman ini.', 'warning'); return; }
  var lines = '';
  for (var x = 0; x <= 200; x += 10) {
    lines += '<div style="position:absolute;left:' + x + 'mm;top:0;width:0.2mm;height:297mm;background:#e11d48;opacity:0.55;"></div>';
    lines += '<div style="position:absolute;left:' + (x + 0.7) + 'mm;top:1mm;font-size:6.5pt;color:#e11d48;font-family:Arial;">' + x + '</div>';
  }
  for (var y = 0; y <= 290; y += 10) {
    lines += '<div style="position:absolute;left:0;top:' + y + 'mm;width:210mm;height:0.2mm;background:#4C6FA5;opacity:0.55;"></div>';
    lines += '<div style="position:absolute;left:1mm;top:' + (y + 0.7) + 'mm;font-size:6.5pt;color:#4C6FA5;font-family:Arial;">' + y + '</div>';
  }
  w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Kalibrasi Blangko</title>'
    + '<style>@page{size:A4;margin:0;}*{box-sizing:border-box;margin:0;padding:0;}html,body{width:210mm;height:297mm;position:relative;}@media print{button{display:none!important;}}</style>'
    + '</head><body>' + lines
    + '<script>window.onload=function(){setTimeout(function(){window.print();},300);}<\/script>'
    + '</body></html>');
  w.document.close();
}

async function konfirmasiPay(idReq) {
  var r=await Swal.fire({title:'Konfirmasi Pembayaran?',text:'Status mahasiswa akan otomatis menjadi LUNAS.',icon:'question',showCancelButton:true,confirmButtonText:'Konfirmasi',cancelButtonText:'Batal',confirmButtonColor:'#059669'});
  if(!r.isConfirmed) return;
  Swal.fire({title:'Memproses...',allowOutsideClick:false,didOpen:function(){Swal.showLoading();}});
  try {
    var res=await callGAS('confirmPaymentRequest',{idReq:idReq,adminNim:_uname});
    Swal.close();
    if(res.success){ Swal.fire({toast:true,position:'top-end',icon:'success',title:'Tagihan dikonfirmasi — Status: Lunas',showConfirmButton:false,timer:2500}); loadAdminPayRequests(); loadPem(); refreshNavBadges(); }
    else Swal.fire('Gagal',res.message,'error');
  } catch(e){ Swal.close(); Swal.fire('Error',e.message,'error'); }
}

async function tolakPay(idReq) {
  var r=await Swal.fire({title:'Tolak Tagihan?',input:'text',inputLabel:'Alasan penolakan (opsional)',inputPlaceholder:'Tulis alasan...',showCancelButton:true,confirmButtonText:'Tolak',cancelButtonText:'Batal',confirmButtonColor:'#dc2626'});
  if(!r.isConfirmed) return;
  Swal.fire({title:'Menolak...',allowOutsideClick:false,didOpen:function(){Swal.showLoading();}});
  try {
    var res=await callGAS('rejectPaymentRequest',{idReq:idReq,adminNim:_uname,alasan:r.value||''});
    Swal.close();
    if(res.success){ Swal.fire({toast:true,position:'top-end',icon:'success',title:'Tagihan ditolak',showConfirmButton:false,timer:2000}); loadAdminPayRequests(); refreshNavBadges(); }
    else Swal.fire('Gagal',res.message,'error');
  } catch(e){ Swal.close(); Swal.fire('Error',e.message,'error'); }
}
