/* ============================================================
   OCR.JS  —  Pembacaan Kartu Bon via Claude Vision API
   Disesuaikan dengan format kartu bon resmi:
     Bahan : NO | TGL PERMINTAAN | NAMA BAHAN KIMIA | SPESIFIKASI | JUMLAH | TTD | KET
     Alat  : NO | TGL PINJAM | NAMA ALAT | SPESIFIKASI | JUMLAH | TTD | TGL KEMBALI | KET
   ============================================================ */

/* ── State modul ── */
var _ocrState = {
  type:        null,   // 'bahan' | 'alat'
  imageBase64: null,
  imageMime:   null,
  parsedItems: [],     // [{tanggal,nama,spesifikasi,jumlah,satuan,keterangan,confidence}]
  nim:         null,
  user:        null,
};

/* ── Satuan yang dikenali per tipe ── */
var OCR_SATUAN_BAHAN = ['mL','L','g','mg','kg','tetes','unit','pcs','µL','mmol','mol'];
var OCR_SATUAN_ALAT  = ['pcs','set','unit','buah'];

/* ============================================================
   BUKA MODAL OCR
   Dipanggil dari tombol di tab permintaan (mahasiswa)
   atau dari halaman admin (dengan nim override)
   ============================================================ */
function openOcrModal(type, nimOverride) {
  _ocrState.type        = type || 'bahan';
  _ocrState.imageBase64 = null;
  _ocrState.imageMime   = null;
  _ocrState.parsedItems = [];
  _ocrState.nim         = nimOverride || _uname;
  _ocrState.user        = _user;

  _ocrSetStep(1);
  _ocrEl('ocrUploadZone').classList.remove('hidden');
  _ocrEl('ocrPreviewWrap').classList.add('hidden');
  _ocrEl('ocrResultWrap').classList.add('hidden');
  _ocrEl('ocrSubmitWrap').classList.add('hidden');
  _ocrEl('ocrEmptyPlaceholder').classList.remove('hidden');
  _ocrEl('ocrFileInput').value = '';
  _ocrEl('ocrPreviewImg').src  = '';

  _ocrEl('ocrModalTitle').textContent =
    type === 'bahan' ? 'Scan Kartu Permintaan Bahan Kimia'
                     : 'Scan Kartu Peminjaman Alat';

  openModal('mdlOcr');
}

/* ============================================================
   HANDLE FILE INPUT  (drag-drop atau klik)
   ============================================================ */
function ocrHandleFile(file) {
  if (!file) return;
  var allowed = ['image/jpeg','image/png','image/webp','image/gif'];
  if (!allowed.includes(file.type)) {
    Swal.fire('Format tidak didukung', 'Gunakan JPG, PNG, atau WEBP.', 'warning');
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    var dataUrl = e.target.result;
    _ocrState.imageBase64 = dataUrl.split(',')[1];
    _ocrState.imageMime   = file.type;

    _ocrEl('ocrPreviewImg').src = dataUrl;
    _ocrEl('ocrUploadZone').classList.add('hidden');
    _ocrEl('ocrPreviewWrap').classList.remove('hidden');
    _ocrEl('ocrResultWrap').classList.add('hidden');
    _ocrEl('ocrSubmitWrap').classList.add('hidden');
    _ocrSetStep(1);
  };
  reader.readAsDataURL(file);
}

function ocrDragOver(e) {
  e.preventDefault();
  document.getElementById('ocrDropTarget').classList.add('ocr-drag-over');
}
function ocrDragLeave() {
  document.getElementById('ocrDropTarget').classList.remove('ocr-drag-over');
}
function ocrDrop(e) {
  e.preventDefault();
  document.getElementById('ocrDropTarget').classList.remove('ocr-drag-over');
  var f = e.dataTransfer.files[0];
  if (f) ocrHandleFile(f);
}

/* ============================================================
   PROSES OCR  —  kirim ke Claude API
   ============================================================ */
async function ocrProcess() {
  if (!_ocrState.imageBase64) {
    Swal.fire('Peringatan', 'Unggah foto terlebih dahulu.', 'warning');
    return;
  }

  var btn = _ocrEl('ocrBtnProcess');
  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Membaca...';
  _ocrEl('ocrEmptyPlaceholder').classList.add('hidden');
  _ocrSetStep(2);

  try {
    /* Kirim ke GAS — GAS yang meneruskan ke Anthropic API dengan API key server-side */
    var result = await callGAS('processOcrImage', {
      imageBase64: _ocrState.imageBase64,
      imageMime:   _ocrState.imageMime,
      type:        _ocrState.type,
    });

    if (!result || !result.success) {
      throw new Error(result && result.message ? result.message : 'Gagal membaca kartu bon');
    }

    /* result.items sudah berupa array dari GAS, stringify dulu agar _ocrParseResult bisa proses */
    _ocrParseResult(JSON.stringify(result.items));
    _ocrRenderTable();

    _ocrEl('ocrResultWrap').classList.remove('hidden');
    _ocrEl('ocrSubmitWrap').classList.remove('hidden');
    _ocrSetStep(2);

  } catch (err) {
    _ocrSetStep(1);
    _ocrEl('ocrEmptyPlaceholder').classList.remove('hidden');
    Swal.fire('Gagal membaca', err.message || 'Terjadi kesalahan saat menghubungi API.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-cpu"></i> Baca Ulang';
  }
}

/* ── Prompt kartu BAHAN KIMIA ──
   Kolom kartu: NO | TGL PERMINTAAN | NAMA BAHAN KIMIA | SPESIFIKASI | JUMLAH | TTD | KET
   Mahasiswa selalu menulis satuan bersama angka di kolom JUMLAH, misal: "10 g", "50 mL", "2 mg".
*/
function _ocrPromptBahan() {
  return [
    'Ini adalah foto KARTU PERMINTAAN BAHAN KIMIA dari Laboratorium Departemen Teknologi Pangan',
    'dan Hasil Pertanian UGM. Kartu diisi tulis tangan.',
    '',
    'Struktur tabel kartu:',
    '  Kolom 1: NO (nomor urut)',
    '  Kolom 2: TANGGAL PERMINTAAN',
    '  Kolom 3: NAMA BAHAN KIMIA',
    '  Kolom 4: SPESIFIKASI (kemurnian, konsentrasi, merek — misal "96%", "p.a.", "Merck")',
    '  Kolom 5: JUMLAH — mahasiswa selalu menulis angka DAN satuan di sini, misal "10 g", "50 mL", "2 mg", "0,5 L"',
    '  Kolom 6: TANDA TANGAN PEMOHON (abaikan)',
    '  Kolom 7: KETERANGAN (abaikan jika kosong)',
    '',
    'Tugas: ekstrak setiap baris yang terisi. Pisahkan angka dan satuan dari kolom JUMLAH.',
    'Contoh: "50 mL" → jumlah=50, satuan="mL" | "2 mg" → jumlah=2, satuan="mg" | "0,5 L" → jumlah=0.5, satuan="L"',
    '',
    'Kembalikan HANYA JSON array (tanpa teks lain, tanpa markdown/backtick):',
    '[{"tanggal":"DD/MM/YYYY atau kosong","nama":"<nama bahan>","spesifikasi":"<atau kosong>","jumlah":<angka desimal>,"satuan":"<satuan>","keterangan":"<atau kosong>","confidence":<0-100>}]',
    '',
    'Aturan:',
    '- jumlah: angka murni, koma → titik desimal (misal 0,5 → 0.5)',
    '- satuan: tulis persis seperti di kartu (mL, L, g, mg, kg, µL, mmol, mol, tetes, pcs, unit)',
    '- confidence: 0–100, perkiraan akurasi pembacaan baris ini; tulis < 50 jika tulisan tidak terbaca',
    '- Abaikan baris kosong, baris header (NO/TANGGAL/NAMA...), dan baris nomor urut (1 2 3 ...)',
  ].join('\n');
}

/* ── Prompt kartu PEMINJAMAN ALAT ──
   Kolom kartu: NO | TGL PINJAM | NAMA ALAT | SPESIFIKASI | JUMLAH | TTD | TGL KEMBALI | KET
*/
function _ocrPromptAlat() {
  return [
    'Ini adalah foto KARTU PEMINJAMAN ALAT dari Laboratorium Departemen Teknologi Pangan',
    'dan Hasil Pertanian UGM. Kartu diisi tulis tangan.',
    '',
    'Struktur tabel kartu:',
    '  Kolom 1: NO (nomor urut)',
    '  Kolom 2: TANGGAL PINJAM',
    '  Kolom 3: NAMA ALAT',
    '  Kolom 4: SPESIFIKASI (ukuran, merek, tipe, kapasitas)',
    '  Kolom 5: JUMLAH',
    '  Kolom 6: TANDA TANGAN PEMINJAM (abaikan)',
    '  Kolom 7: TGL PENGEMBALIAN DAN TANDA TANGAN PENERIMA (abaikan)',
    '  Kolom 8: KETERANGAN',
    '',
    'Tugas: ekstrak setiap baris yang terisi (bukan baris kosong).',
    '',
    'Kembalikan HANYA JSON array (tanpa teks lain, tanpa markdown/backtick) dengan format:',
    '[{"tanggal":"DD/MM/YYYY atau kosong","nama":"<nama alat>","spesifikasi":"<spesifikasi atau kosong>","jumlah":<angka>,"satuan":"pcs","keterangan":"<keterangan atau kosong>","confidence":<0-100>}]',
    '',
    'Aturan tambahan:',
    '- confidence: nilai 0-100 perkiraan akurasi pembacaan tulisan tangan untuk baris ini',
    '- jumlah harus angka murni',
    '- satuan default untuk alat: pcs (kecuali jelas tertulis set/unit/buah)',
    '- Jika jumlah tidak terbaca, tulis 1 dengan confidence rendah',
    '- Abaikan: baris header tabel, baris nomor (1 2 3 4 5 6 7 8), baris kosong, tanda tangan',
  ].join('\n');
}

/* ── Parse JSON dari respons Claude ── */
function _ocrParseResult(raw) {
  _ocrState.parsedItems = [];

  function _normalize(item) {
    return {
      tanggal:     String(item.tanggal     || '').trim(),
      nama:        String(item.nama        || '').trim(),
      spesifikasi: String(item.spesifikasi || '').trim(),
      jumlah:      Number(item.jumlah)     || 0,
      satuan:      String(item.satuan      || '').trim(),
      keterangan:  String(item.keterangan  || '').trim(),
      confidence:  Math.min(100, Math.max(0, Number(item.confidence) || 0)),
    };
  }

  /* Coba parse langsung */
  try {
    var cleaned = raw.replace(/```json|```/g, '').trim();
    var arr = JSON.parse(cleaned);
    if (Array.isArray(arr)) {
      _ocrState.parsedItems = arr.map(_normalize).filter(function(i){ return i.nama; });
      return;
    }
  } catch(e) { /* lanjut ke fallback */ }

  /* Fallback: cari JSON array di dalam teks */
  var match = raw.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      var arr2 = JSON.parse(match[0]);
      if (Array.isArray(arr2)) {
        _ocrState.parsedItems = arr2.map(_normalize).filter(function(i){ return i.nama; });
        return;
      }
    } catch(e2) { /* tetap kosong */ }
  }

  /* Jika benar-benar gagal parse, beri satu baris kosong */
  _ocrState.parsedItems = [{
    tanggal: '', nama: '', spesifikasi: '', jumlah: 0,
    satuan: _ocrState.type === 'bahan' ? 'mL' : 'pcs',
    keterangan: '', confidence: 0
  }];
}

/* ── Render tabel preview editable ── */
function _ocrRenderTable() {
  var isBahan    = _ocrState.type === 'bahan';
  var satuanOpts = isBahan ? OCR_SATUAN_BAHAN : OCR_SATUAN_ALAT;
  var lowCount   = _ocrState.parsedItems.filter(function(i){ return i.confidence < 80; }).length;

  _ocrEl('ocrItemCount').textContent = _ocrState.parsedItems.length + ' item terdeteksi';
  if (lowCount > 0) {
    _ocrEl('ocrWarnBadge').textContent = lowCount + ' perlu dicek';
    _ocrEl('ocrWarnBadge').classList.remove('hidden');
  } else {
    _ocrEl('ocrWarnBadge').classList.add('hidden');
  }

  var rows = _ocrState.parsedItems.map(function(item, idx) {
    var conf      = item.confidence;
    var confClass = conf >= 85 ? 'ocr-conf-high' : conf >= 65 ? 'ocr-conf-med' : 'ocr-conf-low';
    var confIcon  = conf >= 85 ? 'bi-check-circle-fill' : conf >= 65 ? 'bi-exclamation-circle-fill' : 'bi-x-circle-fill';
    var rowStyle  = conf < 80 ? ' style="background:#fffbeb;"' : '';

    /* Bangun dropdown satuan */
    var satuanHtml = '<select class="form-select form-select-sm" style="width:72px;" '
      + 'onchange="_ocrUpdateItem(' + idx + ',\'satuan\',this.value)">'
      + satuanOpts.map(function(s){
          return '<option value="' + s + '"' + (item.satuan === s ? ' selected' : '') + '>' + s + '</option>';
        }).join('')
      /* Jika satuan dari OCR tidak ada dalam daftar, tambahkan sebagai opsi */
      + (item.satuan && satuanOpts.indexOf(item.satuan) === -1
          ? '<option value="' + esc(item.satuan) + '" selected>' + esc(item.satuan) + '</option>'
          : '')
      + '</select>';

    return '<tr' + rowStyle + '>'
      /* Nama */
      + '<td><input type="text" class="form-control form-control-sm" value="' + esc(item.nama)
        + '" oninput="_ocrUpdateItem(' + idx + ',\'nama\',this.value)"'
        + ' placeholder="Nama ' + (isBahan ? 'bahan' : 'alat') + '..."></td>'
      /* Spesifikasi */
      + '<td><input type="text" class="form-control form-control-sm" value="' + esc(item.spesifikasi)
        + '" oninput="_ocrUpdateItem(' + idx + ',\'spesifikasi\',this.value)"'
        + ' placeholder="opsional" style="min-width:90px;"></td>'
      /* Jumlah */
      + '<td style="width:80px;"><input type="number" class="form-control form-control-sm" value="'
        + item.jumlah + '" min="0.01" step="any"'
        + ' oninput="_ocrUpdateItem(' + idx + ',\'jumlah\',this.value)" style="width:70px;"></td>'
      /* Satuan */
      + '<td style="width:80px;">' + satuanHtml + '</td>'
      /* Tanggal */
      + '<td style="width:96px;"><input type="text" class="form-control form-control-sm" value="'
        + esc(item.tanggal) + '" oninput="_ocrUpdateItem(' + idx + ',\'tanggal\',this.value)"'
        + ' placeholder="tgl" style="width:86px;font-size:11px;"></td>'
      /* Confidence badge */
      + '<td style="width:72px;text-align:center;">'
        + '<span class="' + confClass + '" title="Tingkat keyakinan pembacaan OCR">'
        + '<i class="bi ' + confIcon + '" style="margin-right:2px;"></i>' + conf + '%</span></td>'
      /* Hapus */
      + '<td style="width:38px;text-align:center;">'
        + '<button class="btn btn-xs" style="background:#fee2e2;color:#991b1b;border:none;'
        + 'border-radius:6px;padding:3px 6px;cursor:pointer;" title="Hapus baris ini"'
        + ' onclick="_ocrRemoveItem(' + idx + ')"><i class="bi bi-trash3"></i></button></td>'
      + '</tr>';
  }).join('');

  _ocrEl('ocrTableBody').innerHTML = rows
    || '<tr><td colspan="7" style="text-align:center;color:var(--muted);font-size:13px;padding:24px;">'
    + 'Tidak ada item terdeteksi — tambahkan manual atau coba foto ulang.</td></tr>';
}

/* ── Update item dari input DOM ── */
function _ocrUpdateItem(idx, field, val) {
  if (!_ocrState.parsedItems[idx]) return;
  _ocrState.parsedItems[idx][field] = field === 'jumlah' ? Number(val) : val;
}

/* ── Hapus satu baris ── */
function _ocrRemoveItem(idx) {
  _ocrState.parsedItems.splice(idx, 1);
  _ocrRenderTable();
}

/* ── Tambah baris kosong ── */
function ocrAddRow() {
  _ocrState.parsedItems.push({
    tanggal:     '',
    nama:        '',
    spesifikasi: '',
    jumlah:      0,
    satuan:      _ocrState.type === 'bahan' ? 'mL' : 'pcs',
    keterangan:  '',
    confidence:  100,
  });
  _ocrRenderTable();
}

/* ── Ganti foto (reset ke step 1) ── */
function ocrReset() {
  _ocrState.imageBase64 = null;
  _ocrState.imageMime   = null;
  _ocrState.parsedItems = [];
  _ocrEl('ocrPreviewWrap').classList.add('hidden');
  _ocrEl('ocrUploadZone').classList.remove('hidden');
  _ocrEl('ocrResultWrap').classList.add('hidden');
  _ocrEl('ocrSubmitWrap').classList.add('hidden');
  _ocrEl('ocrEmptyPlaceholder').classList.remove('hidden');
  _ocrEl('ocrFileInput').value = '';
  _ocrEl('ocrBtnProcess').innerHTML = '<i class="bi bi-cpu"></i> Baca Kartu Bon';
  _ocrSetStep(1);
}

/* ============================================================
   SUBMIT HASIL OCR KE SISTEM
   Membaca nilai terkini langsung dari DOM (bukan _ocrState)
   agar edit manual user tersimpan walau tidak trigger oninput.
   ============================================================ */
async function ocrSubmit() {
  var tableRows = _ocrEl('ocrTableBody').querySelectorAll('tr');
  var items = [];

  tableRows.forEach(function(tr) {
    var inputs  = tr.querySelectorAll('input[type="text"], input[type="number"]');
    var selects = tr.querySelectorAll('select');
    /* inputs[0]=nama, inputs[1]=spesifikasi, inputs[2]=jumlah, inputs[3]=tanggal */
    if (inputs.length >= 3) {
      var nama   = inputs[0].value.trim();
      var jumlah = Number(inputs[2].value);
      var satuan = selects.length ? selects[0].value : (_ocrState.type === 'bahan' ? 'mL' : 'pcs');
      if (nama && jumlah > 0) {
        items.push({ nama: nama, jumlah: jumlah, satuan: satuan });
      }
    }
  });

  if (!items.length) {
    Swal.fire('Peringatan', 'Tidak ada item valid (nama &amp; jumlah harus diisi).', 'warning');
    return;
  }

  var isBahan    = _ocrState.type === 'bahan';
  var tipeTeks   = isBahan ? 'permintaan bahan kimia' : 'peminjaman alat';
  var confirmRes = await Swal.fire({
    title:             'Submit ' + items.length + ' ' + tipeTeks + '?',
    html:              'Semua baris di tabel akan diajukan ke sistem.',
    icon:              'question',
    showCancelButton:  true,
    confirmButtonText: 'Ya, Submit',
    cancelButtonText:  'Batal',
  });
  if (!confirmRes.isConfirmed) return;

  Swal.fire({ title: 'Mengirim...', allowOutsideClick: false,
    didOpen: function(){ Swal.showLoading(); } });

  var gasFunc = isBahan ? 'submitChemicalRequest' : 'submitToolRequest';
  var errors  = [];
  var success = 0;

  for (var i = 0; i < items.length; i++) {
    try {
      var res = await callGAS(gasFunc, {
        nim:    _ocrState.nim,
        user:   _ocrState.user,
        nama:   items[i].nama,
        jumlah: items[i].jumlah,
      });
      if (res && res.success) { success++; }
      else { errors.push(items[i].nama + ': ' + (res && res.message ? res.message : 'Gagal')); }
    } catch(e) {
      errors.push(items[i].nama + ': ' + e.message);
    }
  }

  Swal.close();

  if (!errors.length) {
    Swal.fire({
      icon:              'success',
      title:             success + ' permintaan berhasil diajukan!',
      text:              'Data kartu bon telah masuk ke sistem.',
      timer:             3000,
      showConfirmButton: false,
    });
  } else {
    Swal.fire({
      icon:  success > 0 ? 'warning' : 'error',
      title: success + ' berhasil, ' + errors.length + ' gagal',
      html:  '<div style="font-size:13px;text-align:left;">'
               + errors.map(function(e){ return '<div style="color:#991b1b;">• ' + esc(e) + '</div>'; }).join('')
             + '</div>',
    });
  }

  closeModal('mdlOcr');
  _ocrSetStep(3);

  /* Refresh semua panel yang relevan */
  if (typeof loadReqHistory   === 'function') loadReqHistory();
  if (typeof loadMhsSummary   === 'function') loadMhsSummary();
  if (typeof loadReqDropdowns === 'function') loadReqDropdowns();
  if (typeof loadPem          === 'function') loadPem();
  if (typeof refreshNavBadges === 'function') refreshNavBadges();
}

/* ============================================================
   HELPER UTILS
   ============================================================ */
function _ocrEl(id) { return document.getElementById(id); }

function _ocrSetStep(n) {
  [1, 2, 3].forEach(function(i) {
    var dot = _ocrEl('ocrStep' + i);
    if (!dot) return;
    dot.classList.remove('ocr-step-done', 'ocr-step-active', 'ocr-step-idle');
    if      (i < n)  dot.classList.add('ocr-step-done');
    else if (i === n) dot.classList.add('ocr-step-active');
    else              dot.classList.add('ocr-step-idle');
  });
}
