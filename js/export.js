/* ============================================================
   EXPORT LAPORAN
   ============================================================ */
var _exportLabels = {
  inventaris_bahan: 'Inventaris Bahan Kimia',
  inventaris_alat:  'Inventaris Alat',
  peminjaman:       'Rekap Peminjaman',
  history_bahan:    'Riwayat Bahan Kimia',
  history_alat:     'Riwayat Alat',
  audit_log:        'Audit Log',
  maintenance:      'Log Maintenance',
  waste:            'Log Limbah',
  payment:          'Rekap Tagihan',
  mahasiswa_aktif:  'Daftar Mahasiswa Aktif'
};

function triggerExport(tipe) {
  _exportTipe=tipe;
  var desc=document.getElementById('exportDesc');
  if(desc) desc.textContent='Unduh laporan "'+(_exportLabels[tipe]||tipe)+'" sebagai:';
  openModal('mdlExport');
}

async function doExport(fmt) {
  closeModal('mdlExport');
  Swal.fire({ title: 'Menyiapkan data...', allowOutsideClick: false, didOpen: function() { Swal.showLoading(); } });
  try {
    /* Daftar Mahasiswa Aktif diambil dari endpoint mahasiswa, bukan getExportData */
    var res = (_exportTipe === 'mahasiswa_aktif')
      ? await _getMahasiswaAktifExportData()
      : await callGAS('getExportData', { tipe: _exportTipe });
    Swal.close();
    if (!res.success) { Swal.fire('Error', res.message || 'Gagal mengambil data', 'error'); return; }

    /* Khusus survei PDF: tampilkan pilihan periode dulu */
    if (fmt === 'pdf' && _exportTipe === 'survei_kepuasan') {
      _doPDFSurveiWithPeriode(res);
    } else {
      if (fmt === 'excel') _doExcel(res); else _doPDF(res);
    }
  } catch(e) { Swal.close(); Swal.fire('Error', e.message, 'error'); }
}

/* Ambil jenjang (S1/S2/S3/Lainnya) dari kolom "tujuan", mis. "Skripsi (S1)", "Tesis (S2)", "Disertasi (S3)" */
function _jenjangFromTujuan(tujuan) {
  var t = (tujuan || '').toString().toUpperCase();
  if (t.indexOf('S1') !== -1) return 'S1';
  if (t.indexOf('S2') !== -1) return 'S2';
  if (t.indexOf('S3') !== -1) return 'S3';
  return 'Lainnya';
}

/* Susun data Daftar Mahasiswa Aktif ke bentuk {judul, tanggal, headers, rows, footer}
   agar bisa dipakai oleh _doExcel() dan _doPDF() seperti laporan lainnya. */
async function _getMahasiswaAktifExportData() {
  var raw = await callGAS('getMahasiswaExternal');
  var data = Array.isArray(raw) ? raw : (raw && raw.data ? raw.data : (raw && raw.result ? raw.result : []));
  if (!data || data.error) {
    return { success: false, message: (data && data.error) || 'Gagal memuat data mahasiswa.' };
  }
  var aktif = data.filter(function(m) { return (m.status || '').toString().toLowerCase().trim() === 'aktif'; });
  if (!aktif.length) {
    return { success: false, message: 'Tidak ada mahasiswa dengan status Aktif saat ini.' };
  }
  aktif.sort(function(a, b) { return (a.nama || '').toString().localeCompare((b.nama || '').toString()); });

  var now = new Date();
  var tglStr = ('0' + now.getDate()).slice(-2) + '/' + ('0' + (now.getMonth() + 1)).slice(-2) + '/' + now.getFullYear();

  var rows = aktif.map(function(m, i) {
    return [
      i + 1,
      m.nimLengkap || m.nim || '-',
      m.nama || '-',
      m.judul || '-',
      _jenjangFromTujuan(m.tujuan),
      m.pembimbing || '-',
      m.tanggalSelesai || '-'
    ];
  });

  return {
    success: true,
    judul: 'Daftar Mahasiswa Aktif Laboratorium KBPHP',
    tanggal: tglStr,
    headers: ['No.', 'NIM', 'Nama Mahasiswa', 'Judul Penelitian', 'Jenjang', 'Dosen Pembimbing', 'Akhir Ijin Penelitian'],
    rows: rows,
    footer: true
  };
}

function _doExcel(d) {
  try {
    var wb = XLSX.utils.book_new();
    var aoaData = [];

    // Judul
    aoaData.push([d.judul]);
    aoaData.push(['Dicetak: ' + (d.tanggal || '') + ' | Total: ' + (d.rows ? d.rows.length : 0) + ' data']);
    aoaData.push([]);

    // Keterangan parameter survei (jika ada)
    if (d.surveiParams && d.surveiParams.length) {
      aoaData.push(['Keterangan Parameter:']);
      d.surveiParams.forEach(function(p) { aoaData.push([p]); });
      aoaData.push([]);
    }

    // Header tabel
    aoaData.push(d.headers);

    // Baris data
    (d.rows || []).forEach(function(r) { aoaData.push(r); });

    // Footer dengan tanda tangan (jika ada)
    if (d.footer) {
      aoaData.push([]);
      aoaData.push([]);
      aoaData.push(['Dilaporkan oleh', '', '', '', '', '', 'Disetujui Kalab KBPHP,']);
      aoaData.push(['PLP Laboratorium KBPHP', '', '', '', '', '', 'Kepala Laboratorium KBPHP,']);
      aoaData.push([]);
      aoaData.push([]);
      aoaData.push([]);
      aoaData.push(['Ashari Priyanto, S.T.P.', '', '', '', '', '', 'Dr. Manikharda, S.T.P., M.Agr.']);
      aoaData.push(['NIP. 210198704201706101', '', '', '', '', '', 'NIP. 198901172024062001']);
    }

    var ws = XLSX.utils.aoa_to_sheet(aoaData);

    // Hitung offset header row untuk lebar kolom
    var headerRowIndex = (d.surveiParams && d.surveiParams.length)
      ? 4 + d.surveiParams.length + 1  // judul+tgl+kosong+label+params+kosong
      : 3;                              // judul+tgl+kosong

    ws['!cols'] = d.headers.map(function(h, i) {
      var mx = h.length;
      (d.rows || []).forEach(function(r) {
        if (r[i] && r[i].toString().length > mx) mx = r[i].toString().length;
      });
      return { wch: Math.min(mx + 4, 50) };
    });

    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, (d.judul || 'Laporan').replace(/\s+/g, '_') + '_' + new Date().toISOString().slice(0, 10) + '.xlsx');
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'File Excel berhasil diunduh!', showConfirmButton: false, timer: 2000 });
  } catch(e) {
    Swal.fire('Error', 'Gagal membuat file Excel: ' + e.toString(), 'error');
  }
}

function _doPDF(d) {
  var paramSection = '';
  if (d.surveiParams && d.surveiParams.length) {
    paramSection = '<div class="param-box">'
      + '<div class="param-title">Keterangan Parameter:</div>'
      + '<ol>'
      + d.surveiParams.map(function(p) {
          return '<li>' + p.replace(/^P\d+\s*-\s*/, '') + '</li>';
        }).join('')
      + '</ol>'
      + '</div>';
  }

  var footerSection = '';
  if (d.footer) {
    footerSection = '<div class="footer-box">'
      + '<div style="display:flex;justify-content:space-between;gap:40px;margin-top:8px;">'
      + '<div style="flex:1;text-align:center;">'
      + '<div style="font-size:11.5px;color:#374151;margin-bottom:60px;">Dilaporkan oleh<br>PLP Laboratorium KBPHP</div>'
      + '<div style="border-top:1.5px solid #374151;padding-top:6px;font-weight:700;font-size:12px;">Ashari Priyanto, S.T.P.</div>'
      + '<div style="font-size:11px;color:#64748b;">NIP. 210198704201706101</div>'
      + '</div>'
      + '<div style="flex:1;text-align:center;">'
      + '<div style="font-size:11.5px;color:#374151;margin-bottom:60px;">Disetujui oleh<br>Kepala Laboratorium KBPHP</div>'
      + '<div style="border-top:1.5px solid #374151;padding-top:6px;font-weight:700;font-size:12px;">Dr. Manikharda, S.T.P., M.Agr.</div>'
      + '<div style="font-size:11px;color:#64748b;">NIP. 198901172024062001</div>'
      + '</div>'
      + '</div>'
      + '</div>';
  }

  /* isSurvei: deteksi dari headers karena GAS tidak mengirim surveiParams di export survei */
  var isSurvei = d.surveiParams && d.surveiParams.length
    || (d.headers && d.headers.indexOf('P1') !== -1);

  /* Hitung data chart untuk survei_kepuasan
     Struktur row survei (tanpa kolom Responden/Pengisi):
     [0]Tanggal [1]Lab [2]Sumber [3]JmlResponden [4..8]P1-P5 [9]Rata-rata [10]Catatan */
  var chartSection = '';
  if (isSurvei && d.rows && d.rows.length) {
    var avgPerParam = [0,0,0,0,0];
    var countPerParam = [0,0,0,0,0];
    d.rows.forEach(function(row) {
      var bobot = Number(row[3]) || 1;
      for (var k = 0; k < 5; k++) {
        var v = parseFloat(row[4 + k]);
        if (!isNaN(v)) {
          avgPerParam[k] += v * bobot;
          countPerParam[k] += bobot;
        }
      }
    });
    avgPerParam = avgPerParam.map(function(s, i) {
      return countPerParam[i] ? +(s / countPerParam[i]).toFixed(2) : 0;
    });

    /* Hitung info sumber untuk keterangan grafik */
    var totalRespondenChart = 0, jumlahMahasiswa = 0, jumlahAdmin = 0;
    d.rows.forEach(function(row) {
      var bobot = Number(row[3]) || 1;
      var sumber = (row[2] || '').toString().toLowerCase();
      totalRespondenChart += bobot;
      if (sumber === 'mahasiswa') jumlahMahasiswa += bobot;
      else jumlahAdmin += bobot;
    });
    var infoSumber = 'Total: ' + totalRespondenChart + ' responden';
    if (jumlahMahasiswa > 0 && jumlahAdmin > 0) {
      infoSumber += ' (' + jumlahMahasiswa + ' mahasiswa + ' + jumlahAdmin + ' input admin)';
    } else if (jumlahMahasiswa > 0) {
      infoSumber += ' (dari mahasiswa)';
    } else if (jumlahAdmin > 0) {
      infoSumber += ' (input admin)';
    }

    chartSection = '<div class="chart-box">'
      + '<div class="chart-title">Distribusi Skor per Parameter (100% Stacked Bar)</div>'
      + '<div class="chart-legend">'
      + '<span><span class="leg" style="background:#ef4444"></span>1 - Kurang</span>'
      + '<span><span class="leg" style="background:#f97316"></span>2 - Cukup</span>'
      + '<span><span class="leg" style="background:#3b82f6"></span>3 - Puas</span>'
      + '<span><span class="leg" style="background:#22c55e"></span>4 - Sangat Puas</span>'
      + '<span style="margin-left:auto;font-size:10px;color:#6b7280;">' + infoSumber + '</span>'
      + '</div>'
      + '<canvas id="pdfChart" width="720" height="260"></canvas>'
      + '<div style="font-size:10px;color:#64748b;margin-top:6px;font-style:italic;">* Visualisasi proporsional berdasarkan rata-rata skor tertimbang per parameter</div>'
      + '</div>'
      + '<script>'
      + '(function waitForChart() {'
      + '  if (typeof Chart === "undefined") { setTimeout(waitForChart, 50); return; }'
      + '  var _avg = ' + JSON.stringify(avgPerParam) + ';'
      + '  function scoreToPct(avg) {'
      + '    avg = Math.min(4, Math.max(1, avg));'
      + '    var p1,p2,p3,p4,t;'
      + '    if (avg<=2){t=avg-1;p1=Math.round((1-t)*100);p2=Math.round(t*100);p3=0;p4=0;}'
      + '    else if(avg<=3){t=avg-2;p1=0;p2=Math.round((1-t)*100);p3=Math.round(t*100);p4=0;}'
      + '    else{t=avg-3;p1=0;p2=0;p3=Math.round((1-t)*100);p4=Math.round(t*100);}'
      + '    var tot=p1+p2+p3+p4; if(tot!==100) p4+=(100-tot);'
      + '    return [p1,p2,p3,p4];'
      + '  }'
      + '  var pct = _avg.map(scoreToPct);'
      + '  var labels = ["P1 - Pelayanan Lab","P2 - Fasilitas Bahan","P3 - Fasilitas Peralatan","P4 - K3","P5 - Sarana & Ruang"];'
      + '  labels = labels.map(function(l,i){ return l+" ("+_avg[i].toFixed(2)+")"; });'
      + '  var chart = new Chart(document.getElementById("pdfChart"), {'
      + '    type:"bar",'
      + '    data:{'
      + '      labels:labels,'
      + '      datasets:['
      + '        {label:"1-Kurang",     data:pct.map(function(r){return r[0];}),backgroundColor:"#ef4444",borderSkipped:false},'
      + '        {label:"2-Cukup",      data:pct.map(function(r){return r[1];}),backgroundColor:"#f97316",borderSkipped:false},'
      + '        {label:"3-Puas",       data:pct.map(function(r){return r[2];}),backgroundColor:"#3b82f6",borderSkipped:false},'
      + '        {label:"4-Sangat Puas",data:pct.map(function(r){return r[3];}),backgroundColor:"#22c55e",borderSkipped:false}'
      + '      ]'
      + '    },'
      + '    options:{'
      + '      indexAxis:"y",responsive:false,maintainAspectRatio:false,'
      + '      plugins:{'
      + '        legend:{display:false},'
      + '        tooltip:{enabled:false}'
      + '      },'
      + '      scales:{'
      + '        x:{stacked:true,max:100,ticks:{callback:function(v){return v+"%";},font:{size:10}},grid:{color:"rgba(0,0,0,0.06)"}},'
      + '        y:{stacked:true,ticks:{font:{size:10}},grid:{display:false}}'
      + '      },'
      + '      animation:{'
      + '        onComplete: function() {'
      + '          var ctx = chart.ctx;'
      + '          ctx.save();'
      + '          ctx.font = "bold 10px Arial";'
      + '          ctx.textAlign = "center";'
      + '          ctx.textBaseline = "middle";'
      + '          chart.data.datasets.forEach(function(dataset, dIdx) {'
      + '            var meta = chart.getDatasetMeta(dIdx);'
      + '            if (meta.hidden) return;'
      + '            meta.data.forEach(function(bar, idx) {'
      + '              var val = dataset.data[idx];'
      + '              if (val < 8) return;'
      + '              var props = bar.getProps(["x","y","base","width","height"], true);'
      + '              var barW = Math.abs(props.x - props.base);'
      + '              if (barW < 24) return;'
      + '              var cx = props.base + barW / 2;'
      + '              ctx.fillStyle = "#ffffff";'
      + '              ctx.fillText(val + "%", cx, props.y);'
      + '            });'
      + '          });'
      + '          ctx.restore();'
      + '          setTimeout(function(){ window.print(); }, 400);'
      + '        }'
      + '      }'
      + '    }'
      + '  });'
      + '})();'
      + '</script>';
  }

  /* Lebar kolom khusus untuk tabel survei (supaya Catatan lebih lebar) */
  var colgroup = '';
  if (isSurvei) {
    colgroup = '<colgroup>' + d.headers.map(function(h) {
      if (h === 'Catatan') return '<col style="width:26%;">';
      if (h === 'Laboratorium') return '<col style="width:13%;">';
      if (h === 'Sumber') return '<col style="width:9%;">';
      if (h === 'Tanggal') return '<col style="width:7%;">';
      if (h === 'Jml Responden' || h === 'Rata-rata') return '<col style="width:7%;">';
      return '<col style="width:6%;">'; // P1-P5
    }).join('') + '</colgroup>';
  }

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + d.judul + '</title>'
    + '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"><\/script>'
    + '<style>'
    + 'body{font-family:\'Inter\',Arial,sans-serif;font-size:12px;margin:20px;}'
    + 'h2{color:#1e40af;border-bottom:3px solid #2563eb;padding-bottom:8px;}'
    + '.meta{color:#64748b;font-size:11px;margin-bottom:14px;}'
    + '.param-box{background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;margin-bottom:16px;}'
    + '.param-title{font-weight:700;color:#1e40af;font-size:12px;margin-bottom:6px;}'
    + '.param-box ol{margin:0;padding-left:18px;color:#1e3a8a;font-size:11.5px;line-height:1.7;}'
    + '.chart-box{margin-bottom:20px;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;}'
    + '.chart-title{font-weight:700;font-size:12px;color:#374151;margin-bottom:8px;}'
    + '.chart-legend{display:flex;gap:16px;margin-bottom:10px;font-size:11px;color:#64748b;flex-wrap:wrap;}'
    + '.leg{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:middle;}'
    + 'table{width:100%;border-collapse:collapse;' + (isSurvei ? 'table-layout:fixed;' : '') + '}'
    + 'th{background:#dbeafe;color:#1e40af;font-size:11px;text-transform:uppercase;padding:10px 8px;border:1px solid #e4eaf4;}'
    + 'td{padding:8px;border:1px solid #e4eaf4;vertical-align:top;word-wrap:break-word;}'
    + 'tr:nth-child(even){background:#f8fafc;}'
    + '.footer-box{margin-top:24px;padding:14px 18px;border-top:2px solid #e2e8f0;}'
    + '@media print{.chart-box{break-inside:avoid;}}'
    + '</style>'
    + '</head><body>'
    + '<h2>' + d.judul + '</h2>'
    + '<div class="meta">Dicetak: ' + d.tanggal + ' | Total: ' + d.rows.length + ' data</div>'
    + paramSection
    + chartSection
    + (function() {
        if (!isSurvei) {
          return '<table>' + colgroup + '<thead><tr>' + d.headers.map(function(h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead>'
            + '<tbody>' + d.rows.map(function(r) { return '<tr>' + r.map(function(c) { return '<td>' + (c || '\u2014') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
        }
        // Tabel rekap survei: gabungkan semua sumber jadi satu
        var paramNames = ['Pelayanan Lab','Fasilitas Bahan','Fasilitas Peralatan','K3','Sarana & Ruang'];
        var totalResponden = 0;
        var sumP = [0,0,0,0,0], cntP = [0,0,0,0,0];
        var perLab = {};
        d.rows.forEach(function(row) {
          var bobot = Number(row[3]) || 1;
          var lab = (row[1] || 'Tidak diketahui').toString().trim();
          totalResponden += bobot;
          if (!perLab[lab]) perLab[lab] = { responden: 0, sum: [0,0,0,0,0], cnt: [0,0,0,0,0] };
          perLab[lab].responden += bobot;
          for (var k = 0; k < 5; k++) {
            var v = parseFloat(row[4 + k]);
            if (!isNaN(v)) { sumP[k] += v*bobot; cntP[k] += bobot; perLab[lab].sum[k] += v*bobot; perLab[lab].cnt[k] += bobot; }
          }
        });
        var avg = sumP.map(function(s,i){ return cntP[i] ? (s/cntP[i]).toFixed(2) : '-'; });
        var totalS=0,totalC=0; sumP.forEach(function(s,i){totalS+=s;totalC+=cntP[i];});
        var overall = totalC ? (totalS/totalC).toFixed(2) : '-';
        function katLabel(a) { a=parseFloat(a); return isNaN(a)?'-':a>=3.5?'Sangat Puas':a>=2.5?'Puas':a>=1.5?'Cukup':'Kurang'; }
        function katColor(a) { a=parseFloat(a); return isNaN(a)?'#6b7280':a>=3.5?'#16a34a':a>=2.5?'#2563eb':a>=1.5?'#ea580c':'#dc2626'; }
        var thStyle = 'background:#dbeafe;color:#1e40af;font-size:11px;padding:8px;border:1px solid #e4eaf4;';
        var tdStyle = 'padding:7px 8px;border:1px solid #e4eaf4;';
        // Tabel 1: Per parameter
        var html = '<h3 style="font-size:12px;color:#1e40af;margin:16px 0 6px;">Rekap Per Parameter</h3>';
        html += '<table style="width:100%;border-collapse:collapse;margin-bottom:18px;"><thead><tr>'
          + '<th style="' + thStyle + 'text-align:left;">Parameter</th>'
          + '<th style="' + thStyle + 'text-align:center;">Rata-rata Skor</th>'
          + '<th style="' + thStyle + 'text-align:center;">Kategori</th>'
          + '</tr></thead><tbody>';
        paramNames.forEach(function(p, i) {
          html += '<tr style="' + (i%2?'background:#f8fafc;':'') + '">'
            + '<td style="' + tdStyle + '">P' + (i+1) + ' \u2014 ' + p + '</td>'
            + '<td style="' + tdStyle + 'text-align:center;font-weight:700;">' + avg[i] + '</td>'
            + '<td style="' + tdStyle + 'text-align:center;font-weight:600;color:' + katColor(avg[i]) + ';">' + katLabel(avg[i]) + '</td>'
            + '</tr>';
        });
        html += '<tr style="background:#eff6ff;font-weight:700;">'
          + '<td style="' + tdStyle + '">Rata-rata Keseluruhan</td>'
          + '<td style="' + tdStyle + 'text-align:center;">' + overall + '</td>'
          + '<td style="' + tdStyle + 'text-align:center;color:' + katColor(overall) + ';">' + katLabel(overall) + '</td>'
          + '</tr>';
        html += '<tr style="background:#f0fdf4;">'
          + '<td style="' + tdStyle + 'color:#6b7280;">Total Responden</td>'
          + '<td colspan="2" style="' + tdStyle + 'text-align:center;font-weight:700;color:#1e40af;">' + totalResponden + ' responden</td>'
          + '</tr></tbody></table>';
        // Tabel 2: Per lab (hanya jika lebih dari 1 lab)
        var labKeys = Object.keys(perLab);
        if (labKeys.length > 1) {
          html += '<h3 style="font-size:12px;color:#1e40af;margin:0 0 6px;">Rekap Per Laboratorium</h3>';
          html += '<table style="width:100%;border-collapse:collapse;margin-bottom:18px;"><thead><tr>'
            + '<th style="' + thStyle + 'text-align:left;">Laboratorium</th>'
            + '<th style="' + thStyle + 'text-align:center;">Responden</th>'
            + '<th style="' + thStyle + 'text-align:center;">Rata-rata</th>'
            + '</tr></thead><tbody>';
          labKeys.forEach(function(lab, i) {
            var o = perLab[lab], s=0, c=0;
            o.sum.forEach(function(x,j){s+=x;c+=o.cnt[j];});
            var a = c ? (s/c).toFixed(2) : '-';
            html += '<tr style="' + (i%2?'background:#f8fafc;':'') + '">'
              + '<td style="' + tdStyle + '">' + lab + '</td>'
              + '<td style="' + tdStyle + 'text-align:center;">' + o.responden + '</td>'
              + '<td style="' + tdStyle + 'text-align:center;font-weight:700;">' + a + '</td>'
              + '</tr>';
          });
          html += '</tbody></table>';
        }
        return html;
      })()
    + footerSection
    + (isSurvei ? '' : '<script>window.onload=function(){ setTimeout(function(){ window.print(); }, 300); };<\/script>')
    + '</body></html>';

  var w = window.open('', '_blank', 'width=900,height=700');
  if (w) { w.document.write(html); w.document.close(); }
  else Swal.fire('Peringatan', 'Pop-up browser diblokir. Harap aktifkan pop-up untuk mencetak PDF.', 'warning');
}

/* ============================================================
   EXPORT MAHASISWA
   ============================================================ */
async function exportMhsBahan() {
  try {
    var d=await callGAS('getBorrowingDetails',{nim:_uname});
    if(!d||!d.chemicals||!d.chemicals.length){ Swal.fire('Info','Tidak ada data bahan yang bisa diekspor','info'); return; }
    if(Object.keys(_hargaMap).length===0){ var chems=await callGAS('getChemicals'); _chemData=chems; _hargaMap={}; chems.forEach(function(b){ var key=(b.nama||b.name||'').toString().trim().toLowerCase();if(key)_hargaMap[key]={harga:Number(b.harga||b.Harga||b.price||0),satuan:b.satuan||b.unit||''}; }); }
    var grandTotal=0;
    var aoa=[
      ['FORMULIR PENGGUNAAN BAHAN KIMIA UNTUK PENELITIAN'],
      ['Departemen Teknologi Pangan dan Hasil Pertanian — UGM'],
      [],
      ['Nama Mahasiswa', _user||'', '', 'NIM', _uname||''],
      ['Program Studi / Fakultas', '', '', '', ''],
      [],
      ['No.','Nama Bahan Kimia','Jumlah','Satuan','Harga/Satuan (Rp)','Jumlah Harga (Rp)']
    ];
    d.chemicals.forEach(function(c,i){ var info=(_hargaMap[(c.name||c.nama||'').toString().trim().toLowerCase()])||{}, harga=info.harga||0, total=harga*c.qty; grandTotal+=total; aoa.push([i+1,c.name,c.qty,c.unit||'',harga,total]); });
    aoa.push([]);
    aoa.push(['','','','','TOTAL',grandTotal]);
    var wb=XLSX.utils.book_new(), ws=XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols']=[{wch:6},{wch:28},{wch:10},{wch:10},{wch:18},{wch:18}];
    XLSX.utils.book_append_sheet(wb,ws,'Bahan Kimia');
    XLSX.writeFile(wb,'FormulirBahan_'+_uname+'_'+new Date().toISOString().slice(0,10)+'.xlsx');
    Swal.fire({toast:true,position:'top-end',icon:'success',title:'Excel berhasil diunduh',showConfirmButton:false,timer:2000});
  } catch(e) {}
}

async function exportMhsAlat() {
  try {
    var d=await callGAS('getBorrowingDetails',{nim:_uname});
    if(!d||!d.equipments||!d.equipments.length){ Swal.fire('Info','Tidak ada data alat yang bisa diekspor','info'); return; }
    var wb=XLSX.utils.book_new();
    var ws=XLSX.utils.aoa_to_sheet([['Nama','NIM','Nama Alat','Jumlah','Satuan']].concat(
      d.equipments.map(function(e){ return [_user,_uname,e.name,e.qty,e.unit]; })
    ));
    XLSX.utils.book_append_sheet(wb,ws,'Alat');
    XLSX.writeFile(wb,'Peminjaman_Alat_'+_uname+'_'+new Date().toISOString().slice(0,10)+'.xlsx');
    Swal.fire({toast:true,position:'top-end',icon:'success',title:'Excel berhasil diunduh',showConfirmButton:false,timer:2000});
  } catch(e) {}
}

async function printMhsBahan() {
  try {
    var d=await callGAS('getBorrowingDetails',{nim:_uname});
    if(!d||!d.chemicals||!d.chemicals.length){ Swal.fire('Info','Tidak ada data bahan untuk dicetak','info'); return; }
    if(Object.keys(_hargaMap).length===0){ var chems=await callGAS('getChemicals'); _chemData=chems; _hargaMap={}; chems.forEach(function(b){ var key=(b.nama||b.name||'').toString().trim().toLowerCase();if(key)_hargaMap[key]={harga:Number(b.harga||b.Harga||b.price||0),satuan:b.satuan||b.unit||''}; }); }
    var grandTotal=0, items=[];
    d.chemicals.forEach(function(c){ var info=(_hargaMap[(c.name||c.nama||'').toString().trim().toLowerCase()])||{}, harga=info.harga||0, total=harga*c.qty; grandTotal+=total; items.push({nama:c.name,qty:c.qty,unit:c.unit||'',harga:harga,total:total}); });
    var now = new Date();
    var tglStr = now.getDate() + ' ' + ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][now.getMonth()] + ' ' + now.getFullYear();
    var rows = items.map(function(it,i){
      return '<tr>'
        +'<td style="text-align:center;padding:5px 7px;border:1px solid #9ca3af;">'+(i+1)+'</td>'
        +'<td style="padding:5px 7px;border:1px solid #9ca3af;">'+esc(it.nama)+'</td>'
        +'<td style="text-align:center;padding:5px 7px;border:1px solid #9ca3af;">'+it.qty+' '+esc(it.unit)+'</td>'
        +'<td style="text-align:right;padding:5px 7px;border:1px solid #9ca3af;">'+formatRupiah(it.harga)+'</td>'
        +'<td style="text-align:right;padding:5px 7px;border:1px solid #9ca3af;">'+formatRupiah(it.total)+'</td>'
        +'</tr>';
    }).join('');
    var w=window.open('','_blank','width=900,height=700');
    if(!w){ Swal.fire('Peringatan','Pop-up browser diblokir','warning'); return; }
    w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Formulir Penggunaan Bahan Kimia</title>'
      +'<style>'
      +'body{font-family:Arial,sans-serif;font-size:12px;margin:24px 32px;color:#111;}'
      +'h2{font-size:14px;text-align:center;margin:0 0 2px;}h3{font-size:12px;text-align:center;margin:0 0 12px;}'
      +'.info-tbl{width:100%;border-collapse:collapse;margin-bottom:12px;}'
      +'.info-tbl td{padding:4px 8px;border:1px solid #6b7280;font-size:12px;}'
      +'.info-lbl{color:#6b7280;font-size:11px;}'
      +'table.main{width:100%;border-collapse:collapse;}'
      +'table.main th{background:#dbeafe;padding:6px 8px;border:1px solid #6b7280;font-size:12px;}'
      +'table.main td{padding:5px 7px;border:1px solid #9ca3af;font-size:12px;}'
      +'table.main tfoot td{background:#f1f5f9;font-weight:700;}'
      +'.terbilang{margin-top:6px;border:1px solid #9ca3af;padding:5px 8px;font-size:12px;font-style:italic;}'
      +'.ttd{display:flex;justify-content:space-between;margin-top:36px;}'
      +'.ttd-box{text-align:center;width:220px;}'
      +'</style></head><body>'
      +'<h2>FORMULIR PENGGUNAAN BAHAN KIMIA</h2>'
      +'<h3>DEPARTEMEN TEKNOLOGI PANGAN DAN HASIL PERTANIAN — UGM</h3>'
      +'<table class="info-tbl"><tr>'
      +'<td style="width:50%"><span class="info-lbl">Nama Mahasiswa</span><br><strong>'+esc(_user)+'</strong></td>'
      +'<td><span class="info-lbl">NIM</span><br><strong>'+esc(_uname)+'</strong></td>'
      +'</tr><tr>'
      +'<td colspan="2"><span class="info-lbl">Program Studi / Fakultas</span><br>&nbsp;</td>'
      +'</tr></table>'
      +'<table class="main"><thead><tr>'
      +'<th style="width:36px;text-align:center;">No.</th>'
      +'<th>Nama Bahan Kimia</th>'
      +'<th style="width:90px;text-align:center;">Jumlah</th>'
      +'<th style="width:120px;text-align:right;">Harga/Satuan (Rp)</th>'
      +'<th style="width:120px;text-align:right;">Jumlah Harga (Rp)</th>'
      +'</tr></thead><tbody>'+rows+'</tbody>'
      +'<tfoot><tr><td colspan="4" style="text-align:right;padding:6px 8px;">TOTAL</td>'
      +'<td style="text-align:right;padding:6px 8px;">'+formatRupiah(grandTotal)+'</td></tr></tfoot></table>'
      +'<div class="terbilang">Terbilang: '+terbilangRupiah(grandTotal)+'</div>'
      +'<div class="ttd">'
      +'<div class="ttd-box"><div>Bendahara Departemen TPHP,</div><br><br><br><br><div style="border-top:1px solid #111;padding-top:4px;">___________________________</div><div>NIP.</div></div>'
      +'<div class="ttd-box"><div>Yogyakarta, '+tglStr+'</div><div>UB. Kepala Laboratorium KBP</div><br><br><br><br><div style="border-top:1px solid #111;padding-top:4px;">Pangiyanti</div><div>NIP.</div></div>'
      +'</div>'
      +'<script>window.onload=function(){window.print();}<\/script></body></html>');
    w.document.close();
  } catch(e) {}
}

async function printMhsAlat() {
  try {
    var d=await callGAS('getBorrowingDetails',{nim:_uname});
    if(!d||!d.equipments||!d.equipments.length){ Swal.fire('Info','Tidak ada data alat untuk dicetak','info'); return; }
    var rows=d.equipments.map(function(e){ return '<tr><td>'+esc(e.name)+'</td><td style="text-align:center;">'+e.qty+'</td><td style="text-align:center;">'+esc(e.unit)+'</td></tr>'; }).join('');
    var w=window.open('','_blank','width=900,height=650');
    if(!w){ Swal.fire('Peringatan','Pop-up browser diblokir','warning'); return; }
    w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial;font-size:13px;margin:20px 30px;}h2{color:#059669;}table{width:100%;border-collapse:collapse;margin-top:14px;}th{background:#dcfce7;color:#059669;padding:9px 8px;border:1px solid #e4eaf4;text-align:left;}td{padding:8px;border:1px solid #e4eaf4;}tr:nth-child(even){background:#f8fafc;}</style></head><body>'
      +'<h2>Laporan Peminjaman Alat Laboratorium</h2><p>'+esc(_user)+' | NIM: '+esc(_uname)+'</p>'
      +'<table><thead><tr><th>Nama Alat</th><th style="text-align:center;">Jumlah</th><th style="text-align:center;">Satuan</th></tr></thead>'
      +'<tbody>'+rows+'</tbody>'
      +'</table><script>window.onload=function(){window.print();}<\/script></body></html>');
    w.document.close();
  } catch(e) {}
}

async function _doPDFSurveiWithPeriode(d) {
  /* Kumpulkan daftar periode dari data rows */
  /* Format tanggal di rows[0] = dd/MM/yyyy */
  var periodeSet = {};
  (d.rows || []).forEach(function(row) {
    var tgl = row[0] || '';
    /* Ambil bulan & tahun → tentukan triwulan */
    var parts = tgl.split('/');
    if (parts.length === 3) {
      var bulan = parseInt(parts[1], 10);
      var tahun = parts[2];
      var q = Math.ceil(bulan / 3);
      var twKey = tahun + '-Q' + q;
      periodeSet[tahun] = periodeSet[tahun] || true;
      periodeSet[twKey] = periodeSet[twKey] || true;
    }
  });

  /* Susun opsi dropdown */
  var tahunList = [], twList = [];
  Object.keys(periodeSet).forEach(function(k) {
    if (k.indexOf('-Q') === -1) tahunList.push(k);
    else twList.push(k);
  });
  tahunList.sort().reverse();
  twList.sort().reverse();

  var bulanMap = { '1': 'Jan–Mar', '2': 'Apr–Jun', '3': 'Jul–Sep', '4': 'Okt–Des' };
  function labelTw(tw) {
    var p = tw.split('-Q');
    return 'Triwulan ' + p[1] + ' ' + p[0] + ' (' + (bulanMap[p[1]] || '') + ')';
  }

  var opsiHtml = '<option value="ALL">Semua Periode</option>';
  if (tahunList.length) {
    opsiHtml += '<optgroup label="Per Tahun">';
    tahunList.forEach(function(t) { opsiHtml += '<option value="' + t + '">Tahun ' + t + '</option>'; });
    opsiHtml += '</optgroup>';
  }
  if (twList.length) {
    opsiHtml += '<optgroup label="Per Triwulan">';
    twList.forEach(function(tw) { opsiHtml += '<option value="' + tw + '">' + labelTw(tw) + '</option>'; });
    opsiHtml += '</optgroup>';
  }

  /* Tampilkan dialog pilih periode */
  var result = await Swal.fire({
    title: 'Pilih Periode Laporan',
    html: '<div style="text-align:left;margin-bottom:8px;font-size:13px;color:#374151;">Periode yang akan dicetak:</div>'
        + '<select id="swalPeriodeSelect" class="swal2-select" style="width:100%;padding:8px;border-radius:8px;border:1.5px solid #e2e8f0;font-size:13px;">'
        + opsiHtml
        + '</select>',
    showCancelButton: true,
    confirmButtonText: '<i class="bi bi-printer"></i> Cetak PDF',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#2563eb',
    preConfirm: function() {
      return document.getElementById('swalPeriodeSelect').value;
    }
  });

  if (!result.isConfirmed) return;
  var periodeVal = result.value;

  /* Filter rows berdasarkan periode */
  var rowsFiltered = (d.rows || []).filter(function(row) {
    if (periodeVal === 'ALL') return true;
    var tgl = row[0] || '';
    var parts = tgl.split('/');
    if (parts.length !== 3) return false;
    var bulan = parseInt(parts[1], 10);
    var tahun = parts[2];
    var q = Math.ceil(bulan / 3);
    if (periodeVal.indexOf('-Q') !== -1) {
      return periodeVal === (tahun + '-Q' + q);
    } else {
      return periodeVal === tahun;
    }
  });

  if (!rowsFiltered.length) {
    Swal.fire('Info', 'Tidak ada data untuk periode yang dipilih.', 'info');
    return;
  }

  /* Buat label periode untuk judul */
  var periodeLabel = periodeVal === 'ALL' ? 'Semua Periode'
    : (periodeVal.indexOf('-Q') !== -1 ? labelTw(periodeVal) : 'Tahun ' + periodeVal);

  /* Buat copy data dengan rows terfilter dan judul diperbarui */
  var dFiltered = {};
  Object.keys(d).forEach(function(k) { dFiltered[k] = d[k]; });
  dFiltered.rows = rowsFiltered;
  dFiltered.judul = d.judul + ' — ' + periodeLabel;
  dFiltered.tanggal = d.tanggal;
  /* Selalu sertakan surveiParams agar keterangan parameter & grafik muncul */
  dFiltered.surveiParams = d.surveiParams || [
    'P1 - Pelayanan Laboratorium yang Mendukung Penelitian Anda',
    'P2 - Fasilitas Bahan yang Ada di Laboratorium yang Mendukung Penelitian Anda',
    'P3 - Fasilitas Peralatan Yang Ada di Laboratorium yang Mendukung Penelitian Anda',
    'P4 - Perlindungan Terhadap Keselamatan dan Kesehatan Kerja (K3) yang Ada di Laboratorium',
    'P5 - Sarana Pendukung dan Ruang Laboratorium'
  ];

  _doPDF(dFiltered);
}
