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

  /* Helper: propagasi tanggal — bila tanggal baris kosong, pakai
     tanggal terakhir yang terisi (kartu bon sering hanya tulis
     tanggal di baris pertama, baris berikutnya dibiarkan kosong). */
  function _propagateTanggal(items) {
    var lastTgl = '';
    return items.map(function(item) {
      if (item.tanggal && item.tanggal.trim() !== '') {
        lastTgl = item.tanggal.trim();
      } else if (lastTgl) {
        item.tanggal = lastTgl;
      }
      return item;
    });
  }

  /* Coba parse langsung */
  try {
    var cleaned = raw.replace(/```json|```/g, '').trim();
    var arr = JSON.parse(cleaned);
    if (Array.isArray(arr)) {
      _ocrState.parsedItems = _propagateTanggal(arr.map(_normalize).filter(function(i){ return i.nama; }));
      return;
    }
  } catch(e) { /* lanjut ke fallback */ }

  /* Fallback: cari JSON array di dalam teks */
  var match = raw.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      var arr2 = JSON.parse(match[0]);
      if (Array.isArray(arr2)) {
        _ocrState.parsedItems = _propagateTanggal(arr2.map(_normalize).filter(function(i){ return i.nama; }));
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

    /* Kolom Nama disematkan (sticky) di sisi kiri saat scroll horizontal,
       dan diberi lebar minimum yang cukup supaya nama bahan/alat selalu
       terbaca penuh — sebelumnya kolom ini tidak punya lebar sama sekali
       sehingga "dikorbankan" habis oleh kolom-kolom lain yang lebar
       tetapnya sudah dipatok (Jumlah/Satuan/Tanggal/dst). */
    var namaBg = conf < 80 ? '#fffbeb' : '#fff';

    return '<tr' + rowStyle + '>'
      /* Nama */
      + '<td style="min-width:150px;position:sticky;left:0;z-index:1;'
        + 'background:' + namaBg + ';box-shadow:2px 0 4px rgba(0,0,0,0.05);">'
        + '<input type="text" class="form-control form-control-sm" value="' + esc(item.nama)
        + '" oninput="_ocrUpdateItem(' + idx + ',\'nama\',this.value)" style="width:100%;min-width:134px;"'
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
   FUZZY MATCH — Cocokkan nama OCR ke database bahan/alat
   ============================================================ */

/**
 * Normalisasi string untuk perbandingan nama:
 * lowercase, hapus spasi ganda, hapus karakter non-alfanumerik kecuali angka & huruf kimia umum
 */
function _ocrNorm(s) {
  return (s || '').toLowerCase()
    .replace(/[^a-z0-9µα-ω]/g, '')  // hanya alfanumerik + karakter kimia
    .trim();
}

/**
 * Normalisasi rumus kimia untuk perbandingan.
 * Contoh: "Na₂CO₃", "Na2CO3", "na2co3", "NA2CO3" → token canonical yang sama.
 *
 * Langkah:
 * 1. Ganti subscript unicode (₀–₉) ke digit ASCII
 * 2. Ambil hanya alfanumerik
 * 3. Parse menjadi segmen {elemen, count}, urutkan Hill (C→H→lainnya alfabetis)
 * 4. Gabung kembali, lowercase
 */
function _ocrNormFormula(s) {
  if (!s) return '';
  // 1. Subscript unicode → digit ASCII
  var SUBS = {'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9',
               '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9'};
  var str = '';
  for (var ci = 0; ci < s.length; ci++) str += (SUBS[s[ci]] !== undefined ? SUBS[s[ci]] : s[ci]);
  // 2. Hanya alfanumerik
  str = str.replace(/[^a-zA-Z0-9]/g, '');
  // 3. Parse segmen elemen
  var segs = [];
  var re = /([A-Z][a-z]*)(\d*)/g, m;
  while ((m = re.exec(str)) !== null) {
    if (!m[1]) continue;
    var el = m[1], cnt = m[2] ? parseInt(m[2], 10) : 1;
    var found = false;
    for (var k = 0; k < segs.length; k++) {
      if (segs[k].el === el) { segs[k].cnt += cnt; found = true; break; }
    }
    if (!found) segs.push({ el: el, cnt: cnt });
  }
  if (!segs.length) return str.toLowerCase();
  // 4. Urutkan Hill: C → H → lainnya abjad
  segs.sort(function(a, b) {
    function rank(e) { return e === 'C' ? 0 : e === 'H' ? 1 : 2; }
    var ra = rank(a.el), rb = rank(b.el);
    return ra !== rb ? ra - rb : a.el.localeCompare(b.el);
  });
  return segs.map(function(sg) { return sg.el.toLowerCase() + (sg.cnt > 1 ? sg.cnt : ''); }).join('');
}

/**
 * Skor kemiripan antara dua string nama (0–100).
 * Menggabungkan: exact match, contains, token overlap, dan Levenshtein distance.
 */
function _ocrSimilarity(a, b) {
  var na = _ocrNorm(a);
  var nb = _ocrNorm(b);
  if (!na || !nb) return 0;

  // Exact match setelah normalisasi
  if (na === nb) return 100;

  // Salah satu mengandung yang lain
  if (na.includes(nb) || nb.includes(na)) return 85;

  // Token overlap (kata-per-kata)
  var tokA = a.toLowerCase().split(/\s+/).filter(Boolean);
  var tokB = b.toLowerCase().split(/\s+/).filter(Boolean);
  var matched = tokA.filter(function(t) {
    var nt = _ocrNorm(t);
    return tokB.some(function(tb){ return _ocrNorm(tb) === nt || _ocrNorm(tb).includes(nt) || nt.includes(_ocrNorm(tb)); });
  }).length;
  var tokenScore = matched / Math.max(tokA.length, tokB.length) * 75;
  if (tokenScore > 50) return Math.round(tokenScore);

  // Levenshtein distance (hanya untuk string pendek)
  function lev(s1, s2) {
    var m = s1.length, n = s2.length;
    if (m > 30 || n > 30) return Math.abs(m - n) + 5;
    var dp = [];
    for (var i = 0; i <= m; i++) { dp[i] = [i]; }
    for (var j = 0; j <= n; j++) { dp[0][j] = j; }
    for (var ii = 1; ii <= m; ii++) {
      for (var jj = 1; jj <= n; jj++) {
        dp[ii][jj] = s1[ii-1] === s2[jj-1] ? dp[ii-1][jj-1]
          : 1 + Math.min(dp[ii-1][jj], dp[ii][jj-1], dp[ii-1][jj-1]);
      }
    }
    return dp[m][n];
  }
  var dist = lev(na, nb);
  var maxLen = Math.max(na.length, nb.length);
  var levScore = Math.max(0, (1 - dist / maxLen) * 60);
  return Math.round(levScore);
}

/**
 * Skor kemiripan rumus kimia antara teks OCR dan rumus di DB (0–100).
 * Menggunakan _ocrNormFormula untuk canonical comparison.
 *
 * Contoh: "Na2CO3" vs "Na₂CO₃" → keduanya jadi "co3na2" → skor 100.
 * Contoh: "NaHPO4" vs "Na₂HPO₄" → token mirip sebagian → skor partial.
 */
function _ocrFormulaScore(ocrTeks, rumusDb) {
  if (!ocrTeks || !rumusDb) return 0;
  var tokOcr = _ocrNormFormula(ocrTeks);
  var tokDb  = _ocrNormFormula(rumusDb);
  if (!tokOcr || !tokDb) return 0;

  // Exact match canonical
  if (tokOcr === tokDb) return 100;

  // Salah satu mengandung yang lain (partial — misalnya HPO4Na vs NaHPO4)
  if (tokDb.indexOf(tokOcr) !== -1 || tokOcr.indexOf(tokDb) !== -1) return 80;

  // Fallback: coba juga exact match kasar tanpa normalisasi Hill
  var rawOcr = (ocrTeks || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  var rawDb  = (rumusDb  || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (rawOcr === rawDb) return 95;
  if (rawDb.indexOf(rawOcr) !== -1 || rawOcr.indexOf(rawDb) !== -1) return 70;

  return 0;
}

/* ============================================================
   PENCOCOKAN ALAT DENGAN UKURAN/VOLUME (mis. "Beaker 1L")
   ------------------------------------------------------------
   Beda dari bahan kimia: ukuran/volume alat sering menyatu
   langsung di nama ("Beaker 1L", "Beaker to 2L", "Gelas ukur
   100 ml") dan ditulis dengan format yang sangat bervariasi:
     1L / 1 L / 1l / 1000mL / 1000 mL / (1000 ml)
   Fungsi-fungsi ini menormalkan semua variasi itu ke satu
   satuan baku (mL) SEBELUM nama dibandingkan, supaya semuanya
   dianggap merujuk ke alat yang sama.
   ============================================================ */

// Satuan volume → faktor pengali ke mL
var _OCR_VOLUME_UNIT_TO_ML = {
  'ml': 1, 'mL': 1, 'ML': 1, 'Ml': 1,
  'cc': 1, 'CC': 1, 'cm3': 1, 'cm³': 1,
  'l': 1000, 'L': 1000, 'liter': 1000, 'Liter': 1000, 'litre': 1000,
  'µl': 0.001, 'ul': 0.001, 'uL': 0.001, 'UL': 0.001
};

/**
 * Cari pola "<angka><satuan volume>" di dalam teks (menempel atau
 * berspasi, dalam kurung atau tidak) dan kembalikan volumenya
 * dalam mL, plus potongan teks yang match (untuk dihapus dari nama).
 */
function _ocrExtractVolume(text) {
  if (!text) return { volumeML: null, matchedText: '' };
  var re = /(\d+(?:[.,]\d+)?)\s*(ml|mL|ML|Ml|cc|CC|cm3|cm³|µl|ul|uL|UL|liter|Liter|litre|l|L)(?![a-zA-Z])/;
  var m = String(text).match(re);
  if (!m) return { volumeML: null, matchedText: '' };
  var angka  = parseFloat(m[1].replace(',', '.'));
  var faktor = _OCR_VOLUME_UNIT_TO_ML[m[2]];
  if (faktor === undefined) return { volumeML: null, matchedText: '' };
  return { volumeML: angka * faktor, matchedText: m[0] };
}

/** Buang token volume + kata pengganggu ("to", "s/d") dari nama alat. */
function _ocrStripVolume(nama) {
  if (!nama) return '';
  var s = String(nama);
  var vol = _ocrExtractVolume(s);
  if (vol.matchedText) s = s.replace(vol.matchedText, ' ');
  s = s.replace(/[()]/g, ' ');
  s = s.replace(/\b(to|s\/d|sd|s\.d)\b/gi, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

// Sinonim istilah alat lab yang umum dipakai bergantian
var _OCR_ALAT_SYNONYM_GROUPS = [
  ['beaker', 'beker', 'gelas beker', 'gelas beaker', 'gelas piala', 'beaker glass'],
  ['erlenmeyer', 'elemeyer', 'labu erlenmeyer', 'erlenmeyer flask'],
  ['gelas ukur', 'measuring cylinder', 'silinder ukur', 'gelas ukuran'],
  ['labu ukur', 'labu takar', 'volumetric flask'],
  ['pipet ukur', 'measuring pipette', 'pipet volume'],
  ['pipet tetes', 'dropper'],
  ['pump pipet', 'filler pipet', 'rubber bulb', 'bulb pipet'],
  ['tabung reaksi', 'test tube'],
  ['rak tabung reaksi', 'rak tabung', 'test tube rack'],
  ['corong kaca', 'corong gelas', 'glass funnel', 'corong'],
  ['labu lemak', 'fat flask', 'soxhlet flask'],
  ['spatula besi', 'spatula stainless', 'sendok spatula', 'spatula']
];
var _OCR_ALAT_SYNONYM_MAP = (function() {
  var map = {};
  _OCR_ALAT_SYNONYM_GROUPS.forEach(function(g) { g.forEach(function(t) { map[t] = g[0]; }); });
  return map;
})();
var _OCR_ALAT_SYNONYM_TERMS_SORTED = Object.keys(_OCR_ALAT_SYNONYM_MAP).sort(function(a, b) {
  return b.split(' ').length - a.split(' ').length; // frasa 2 kata dicek dulu
});

/** Normalisasi nama dasar alat: lowercase, rapikan, samakan sinonim. */
function _ocrNormAlatName(nama) {
  if (!nama) return '';
  var s = String(nama).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  _OCR_ALAT_SYNONYM_TERMS_SORTED.forEach(function(term) {
    var re = new RegExp('\\b' + term.replace(/\s+/g, '\\s+') + '\\b', 'g');
    s = s.replace(re, _OCR_ALAT_SYNONYM_MAP[term]);
  });
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Cari kandidat alat terbaik dengan mempertimbangkan volume/ukuran.
 * Volume "1L", "1 L", "1l", "1000mL" dianggap identik (dikonversi ke mL).
 * Nama dasar dibandingkan setelah volume & sinonim dinormalisasi.
 *
 * Prioritas:
 *   1. Nama dasar sama + volume sama persis → skor 100
 *   2. Nama dasar sama, salah satu/keduanya tanpa info volume → skor 90
 *   3. Kemiripan nama biasa (fallback _ocrSimilarity), volume harus
 *      sama jika keduanya punya volume (mencegah "Beaker 250mL"
 *      ke-tarik ke "Beaker 1000mL")
 */
function _ocrFindBestMatchAlat(namaOcr, specOcr, daftarDb) {
  var volOcr = _ocrExtractVolume(namaOcr);
  if (volOcr.volumeML === null) volOcr = _ocrExtractVolume(specOcr);
  var namaBase = _ocrNormAlatName(_ocrStripVolume(namaOcr));

  var best = null, bestSkor = -1;

  daftarDb.forEach(function(item) {
    var volDb = _ocrExtractVolume(item.nama || '');
    if (volDb.volumeML === null) volDb = _ocrExtractVolume(item.spek || item.spesifikasi || '');
    var dbBase = _ocrNormAlatName(_ocrStripVolume(item.nama || ''));

    var sameVolume = (volOcr.volumeML !== null && volDb.volumeML !== null)
      ? Math.abs(volOcr.volumeML - volDb.volumeML) < 0.001
      : null; // null = tidak bisa dibandingkan

    if (sameVolume === false) return; // ukuran beda → bukan alat yang sama, skip

    var skor;
    if (namaBase && namaBase === dbBase) {
      skor = (sameVolume === true) ? 100 : 90;
    } else {
      var skorNamaFallback = _ocrSimilarity(namaOcr, item.nama || '');
      if (skorNamaFallback < 50) return;
      skor = Math.min(skorNamaFallback, 89); // di bawah exact-name match
    }

    if (skor > bestSkor) {
      bestSkor = skor;
      best = { namaDb: item.nama, skor: skor, via: 'nama' };
    }
  });

  return best;
}

/**
 * Cari kandidat terbaik dari daftar untuk nama/rumus OCR yang diberikan.
 * Strategi (prioritas menurun):
 *   1. Exact match nama (skor 100)
 *   2. Exact match rumus kimia terhadap field `rumus` di DB (skor 100)
 *   3. Partial match nama (skor ≥ 50)
 *   4. Partial match rumus (skor ≥ 70)
 *
 * Untuk alat (`type === 'alat'`), pencocokan mempertimbangkan
 * ukuran/volume yang menyatu di nama (lihat _ocrFindBestMatchAlat).
 *
 * Mengembalikan { namaDb, skor, via } atau null.
 * `via`: 'nama' | 'rumus' — menunjukkan kolom mana yang cocok (untuk debug/display).
 */
function _ocrFindBestMatch(namaOcr, daftarDb, type, specOcr) {
  if (type === 'alat') {
    return _ocrFindBestMatchAlat(namaOcr, specOcr || '', daftarDb);
  }

  var best = null;
  var bestSkor = 0;
  var THRESHOLD_NAMA   = 50;
  var THRESHOLD_RUMUS  = 70; // lebih tinggi — rumus partial bisa false positive

  daftarDb.forEach(function(item) {
    // -- 1 & 3: Cocokkan terhadap nama bahan/alat --
    var skorNama = _ocrSimilarity(namaOcr, item.nama || '');

    // -- 2 & 4: Cocokkan terhadap rumus kimia (field `rumus`, atau `sub` dari _reqInlineData) --
    var rumusDb  = item.rumus || item.sub || '';
    var skorRumus = rumusDb ? _ocrFormulaScore(namaOcr, rumusDb) : 0;

    // Ambil skor tertinggi dari kedua jalur
    var skor = Math.max(skorNama, skorRumus);
    var via  = skorRumus >= skorNama ? 'rumus' : 'nama';

    // Terapkan threshold yang berbeda per jalur
    var threshold = (via === 'rumus') ? THRESHOLD_RUMUS : THRESHOLD_NAMA;
    if (skor < threshold) return;

    if (skor > bestSkor) {
      bestSkor = skor;
      best = { namaDb: item.nama, skor: skor, via: via };
    }
  });

  return best;
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
      var nama        = inputs[0].value.trim();
      var spesifikasi = inputs[1] ? inputs[1].value.trim() : '';
      var jumlah  = Number(inputs[2].value);
      var tanggal = inputs[3] ? inputs[3].value.trim() : '';
      var satuan  = selects.length ? selects[0].value : (_ocrState.type === 'bahan' ? 'mL' : 'pcs');
      if (nama && jumlah > 0) {
        items.push({ nama: nama, spesifikasi: spesifikasi, jumlah: jumlah, satuan: satuan, tanggal: tanggal });
      }
    }
  });

  if (!items.length) {
    Swal.fire('Peringatan', 'Tidak ada item valid (nama &amp; jumlah harus diisi).', 'warning');
    return;
  }

  var isBahan  = _ocrState.type === 'bahan';
  var tipeTeks = isBahan ? 'permintaan bahan kimia' : 'peminjaman alat';
  var dbList   = isBahan ? (_chemData || []) : (_toolData || []);

  /* ── Fuzzy matching: resolusi nama OCR → nama database ── */
  var resolved = [];    // item yang berhasil dicocokkan
  var unresolved = [];  // item yang tidak ada padanannya di DB

  items.forEach(function(item) {
    var match = _ocrFindBestMatch(item.nama, dbList, _ocrState.type, item.spesifikasi);
    if (match) {
      resolved.push({
        namaOcr: item.nama,
        namaDb:  match.namaDb,
        skor:    match.skor,
        via:     match.via || 'nama',
        jumlah:  item.jumlah,
        satuan:  item.satuan,
        diganti: _ocrNorm(item.nama) !== _ocrNorm(match.namaDb),
      });
    } else {
      unresolved.push(item.nama);
    }
  });

  /* ── Tampilkan konfirmasi dengan preview nama yang akan disubmit ── */
  var previewHtml = '<div style="font-size:13px;text-align:left;max-height:260px;overflow-y:auto;">';

  if (resolved.length) {
    previewHtml += '<div style="font-weight:700;margin-bottom:6px;color:#1e40af;">✅ Akan disubmit (' + resolved.length + '):</div>';
    resolved.forEach(function(r) {
      var skorColor = r.skor >= 85 ? '#059669' : r.skor >= 65 ? '#d97706' : '#dc2626';
      previewHtml += '<div style="padding:5px 8px;margin-bottom:4px;border-radius:6px;background:#f0f9ff;border:1px solid #bae6fd;">';
      if (r.diganti) {
        previewHtml += '<span style="color:#6b7280;text-decoration:line-through;font-size:11px;">' + esc(r.namaOcr) + '</span> → ';
        previewHtml += '<strong style="color:#1e40af;">' + esc(r.namaDb) + '</strong>';
        var viaLabel = r.via === 'rumus' ? ' · via rumus' : '';
        previewHtml += '<span style="font-size:10px;color:' + skorColor + ';margin-left:5px;">(cocok ' + r.skor + '%' + viaLabel + ')</span>';
      } else {
        previewHtml += '<strong>' + esc(r.namaDb) + '</strong>';
        var exactLabel = r.via === 'rumus' ? '✓ rumus cocok' : '✓ exact';
        previewHtml += '<span style="font-size:10px;color:#059669;margin-left:5px;">' + exactLabel + '</span>';
      }
      previewHtml += '<span style="float:right;color:#64748b;font-size:11px;">' + r.jumlah + ' ' + esc(r.satuan) + '</span>';
      previewHtml += '</div>';
    });
  }

  if (unresolved.length) {
    previewHtml += '<div style="font-weight:700;margin:8px 0 6px;color:#991b1b;">❌ Tidak ditemukan di database (' + unresolved.length + '):</div>';
    unresolved.forEach(function(nama) {
      previewHtml += '<div style="padding:5px 8px;margin-bottom:4px;border-radius:6px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;">'
        + esc(nama) + '</div>';
    });
    previewHtml += '<div style="font-size:11px;color:#64748b;margin-top:4px;">Item tidak ditemukan akan dilewati. Periksa ejaan atau tambahkan ke inventaris dahulu.</div>';
  }

  previewHtml += '</div>';

  if (!resolved.length) {
    Swal.fire({
      icon:  'error',
      title: 'Tidak ada item yang cocok',
      html:  previewHtml,
    });
    return;
  }

  /* ── Dedup: ambil riwayat yang sudah ada, skip item yang
     tanggal + nama sudah tercatat (gunakan data yang baru) ── */
  var gasHistory = _ocrState.type === 'bahan'
    ? (await callGAS('getMahasiswaChemicalLoans', { nim: _ocrState.nim }).catch(function(){ return []; }))
    : (await callGAS('getStudentEquipmentHistory', { nim: _ocrState.nim }).catch(function(){ return []; }));

  var _existingKey = function(tgl, nama) {
    return (tgl || '').replace(/[^0-9]/g, '') + '|' + (nama || '').toLowerCase().trim();
  };
  var existingSet = {};
  (gasHistory || []).forEach(function(h) {
    var namaBahan = (h.namaBahan || h.namaAlat || '').toLowerCase().trim();
    /* Tanggal dari riwayat format: "dd/MM/yyyy HH:mm" — ambil bagian tanggalnya saja */
    var tglRaw = (h.tanggal || '').split(' ')[0];
    existingSet[_existingKey(tglRaw, namaBahan)] = true;
  });

  var dupItems = [], newItems = [];
  resolved.forEach(function(r, i) {
    var tglItem = (items[i] && items[i].tanggal) ? items[i].tanggal : '';
    /* Normalkan format tanggal item ke "dd/MM/yyyy" agar cocok dgn riwayat */
    var tglNorm = tglItem.replace(/[^0-9]/g, '');
    var key = _existingKey(tglNorm, r.namaDb);
    if (existingSet[key]) {
      dupItems.push(r.namaDb + (tglItem ? ' (' + tglItem + ')' : ''));
    } else {
      newItems.push({ resolved: r, tanggal: tglItem });
    }
  });

  if (dupItems.length && !newItems.length) {
    Swal.fire({
      icon:  'info',
      title: 'Semua item sudah tercatat',
      html:  '<div style="font-size:13px;text-align:left;">'
           + '<p style="margin-bottom:8px;">Item berikut sudah ada di riwayat (tanggal &amp; nama sama), tidak disubmit ulang:</p>'
           + dupItems.map(function(d){ return '<div style="padding:4px 8px;background:#f0fdf4;border-radius:6px;margin-bottom:3px;">✓ ' + esc(d) + '</div>'; }).join('')
           + '</div>',
    });
    return;
  }

  if (dupItems.length) {
    previewHtml += '<div style="margin-top:10px;padding:8px 10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:12px;">'
      + '<b style="color:#166534;">⏭ Dilewati (' + dupItems.length + ') — sudah tercatat:</b><br>'
      + dupItems.map(function(d){ return '• ' + esc(d); }).join('<br>')
      + '</div>';
    /* Perbarui resolved agar hanya berisi item baru */
    resolved = newItems.map(function(n){ return n.resolved; });
    items    = newItems.map(function(n){
      return { nama: n.resolved.namaDb, jumlah: n.resolved.jumlah, satuan: n.resolved.satuan };
    });
  }

  var confirmRes = await Swal.fire({
    title:             'Submit ' + resolved.length + ' ' + tipeTeks + '?',
    html:              previewHtml,
    icon:              'question',
    showCancelButton:  true,
    confirmButtonText: 'Ya, Submit',
    cancelButtonText:  'Batal',
    width:             '520px',
  });
  if (!confirmRes.isConfirmed) return;

  Swal.fire({ title: 'Mengirim...', allowOutsideClick: false,
    didOpen: function(){ Swal.showLoading(); } });

  var gasFunc = isBahan ? 'submitChemicalRequest' : 'submitToolRequest';
  var errors  = [];

  /* Ganti items dengan resolved (gunakan namaDb untuk exact match ke GAS) */
  items = resolved.map(function(r){ return { nama: r.namaDb, jumlah: r.jumlah, satuan: r.satuan }; });
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

  var skipTeks = unresolved.length
    ? '<div style="font-size:12px;color:#64748b;margin-top:8px;">'
      + unresolved.length + ' item dilewati (tidak ada di database): '
      + unresolved.map(function(n){ return '<em>' + esc(n) + '</em>'; }).join(', ')
      + '</div>'
    : '';

  if (!errors.length) {
    Swal.fire({
      icon:              'success',
      title:             success + ' permintaan berhasil diajukan!',
      html:              '<div>Data kartu bon telah masuk ke sistem.</div>' + skipTeks,
      timer:             4000,
      showConfirmButton: false,
    });
  } else {
    Swal.fire({
      icon:  success > 0 ? 'warning' : 'error',
      title: success + ' berhasil, ' + errors.length + ' gagal',
      html:  '<div style="font-size:13px;text-align:left;">'
               + errors.map(function(e){ return '<div style="color:#991b1b;">• ' + esc(e) + '</div>'; }).join('')
             + '</div>' + skipTeks,
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
