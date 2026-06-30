/* ============================================================
   ADD-ON: FITUR ROLE "DOSEN" — LabInventori
   ============================================================
   CARA PASANG:
   1. Buka project Apps Script yang sudah ada (Code.gs).
   2. Klik "+" di sidebar editor → buat file baru, kasih nama
      misalnya "DosenFeature" → tempel SELURUH isi file ini ke situ.
      (Boleh juga ditempel di paling bawah Code.gs, terserah —
      Apps Script menggabungkan semua file .gs jadi satu project.)
   3. Buka Code.gs yang asli, cari variabel "var ROUTES = {" lalu
      tambahkan 6 baris di bagian PALING BAWAH ROUTES (sebelum
      tanda kurung kurawal penutup "};"). Baris yang harus
      ditambahkan ada di file "ROUTES_PATCH.txt" (saya kirim terpisah).
   4. Buat akun dosen lewat menu Admin → Kelola User → tambah user
      baru dengan Role = "Dosen". Field "Nama" HARUS sama persis
      (atau minimal mengandung) nama yang tertulis di kolom
      "Dosen Pembimbing" pada data mahasiswa (STUDENTS_DB / Rekap),
      karena pencocokan dosen↔mahasiswa memakai nama, bukan NIM.
   5. Jalankan migrateAdminPasswordsToHash() tidak perlu diulang
      (sudah ada), akun dosen baru otomatis di-hash saat dibuat
      lewat addUser() yang sudah ada di Code.gs asli — TIDAK PERLU
      DIUBAH karena fungsi itu generik untuk semua role selain
      Mahasiswa.
   ============================================================ */

/* =================================
   SHEET BIMBINGAN_LOG (dibuat otomatis)
   [A]ID [B]NIM [C]NamaMahasiswa [D]DosenNama [E]Tanggal
   [F]DurasiMenit [G]Topik [H]Kendala [I]StatusKendala
   [J]InputOleh [K]Timestamp
================================= */
function _ensureBimbinganSheet() {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('BIMBINGAN_LOG');
  if (!sheet) {
    sheet = ss.insertSheet('BIMBINGAN_LOG');
    sheet.appendRow([
      'ID', 'NIM', 'NamaMahasiswa', 'DosenNama', 'Tanggal',
      'DurasiMenit', 'Topik', 'Kendala', 'StatusKendala',
      'InputOleh', 'Timestamp'
    ]);
  }
  return sheet;
}

/* =================================
   HELPER: cocokkan nama dosen
   Field "Dosen Pembimbing" di STUDENTS_DB kadang berisi 2 nama
   digabung "Dosen A / Dosen B", jadi pakai substring match,
   case-insensitive, setelah trim.
================================= */
function _isDosenMatch(pembimbingField, dosenNama) {
  if (!pembimbingField || !dosenNama) return false;
  var a = pembimbingField.toString().toLowerCase().trim();
  var b = dosenNama.toString().toLowerCase().trim();
  if (!a || !b) return false;
  return a.indexOf(b) !== -1 || b.indexOf(a) !== -1;
}

/* =================================
   DAFTAR MAHASISWA BIMBINGAN SEORANG DOSEN
   (dipakai dashboard dosen & validasi akses)
================================= */
function _getMahasiswaByDosen(dosenNama) {
  var all = getAllStudentInfo(); // sudah ada di Code.gs asli — map keyed by NIM
  var result = [];
  Object.keys(all).forEach(function(nim) {
    var s = all[nim];
    if (_isDosenMatch(s.dosenPembimbing, dosenNama)) result.push(s);
  });
  return result;
}

/* =================================
   GET BIMBINGAN LOG (riwayat sesi bimbingan)
   dosenNama kosong + role Admin -> kembalikan SEMUA log
================================= */
function getBimbinganLog(dosenNama) {
  var sheet = _ensureBimbinganSheet();
  var data  = sheet.getDataRange().getValues();
  var result = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    if (dosenNama && !_isDosenMatch(data[i][3], dosenNama)) continue;
    result.push({
      id            : data[i][0],
      nim           : data[i][1],
      namaMahasiswa : data[i][2],
      dosenNama     : data[i][3],
      tanggal       : _formatDateShort(data[i][4]),
      tanggalRaw    : data[i][4] ? Utilities.formatDate(new Date(data[i][4]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
      durasiMenit   : Number(data[i][5]) || 0,
      topik         : data[i][6] || '',
      kendala       : data[i][7] || '',
      statusKendala : data[i][8] || 'Tidak Ada',
      inputOleh     : data[i][9] || '',
      timestamp     : data[i][10] ? _formatDate(data[i][10]) : '',
      rowIndex      : i + 1
    });
  }
  return result.reverse();
}

/* =================================
   TAMBAH SESI BIMBINGAN (Dosen / Admin)
   obj: { nim, dosenNama, tanggal, durasiMenit, topik, kendala,
          statusKendala, inputOleh }
================================= */
function addBimbinganLog(obj) {
  return _withLock(15000, function() {
    if (!obj || !obj.nim || !obj.dosenNama || !obj.tanggal) {
      return { success: false, message: 'NIM, nama dosen, dan tanggal wajib diisi.' };
    }

    // Validasi: mahasiswa ini benar bimbingan dosen tsb (cegah dosen catat mhs orang lain)
    var mhs = getStudentInfo(obj.nim);
    if (!mhs) return { success: false, message: 'Mahasiswa dengan NIM tersebut tidak ditemukan.' };
    if (!_isDosenMatch(mhs.dosenPembimbing, obj.dosenNama)) {
      return {
        success: false,
        message: 'Mahasiswa ini tercatat dibimbing oleh "' + mhs.dosenPembimbing +
                  '", bukan "' + obj.dosenNama + '". Tidak bisa mencatat sesi bimbingan untuk mahasiswa lain.'
      };
    }

    var sheet = _ensureBimbinganSheet();
    var id    = 'BMB-' + new Date().getTime();
    sheet.appendRow([
      id, obj.nim, mhs.nama, obj.dosenNama,
      new Date(obj.tanggal),
      Number(obj.durasiMenit) || 0,
      obj.topik   || '',
      obj.kendala || '',
      obj.kendala ? (obj.statusKendala || 'Open') : 'Tidak Ada',
      obj.inputOleh || obj.dosenNama,
      new Date()
    ]);

    _writeAuditLog(
      obj.dosenNama, 'Catat Sesi Bimbingan',
      'NIM: ' + obj.nim + ' (' + mhs.nama + ')',
      '-', (Number(obj.durasiMenit) || 0) + ' menit',
      obj.kendala ? ('Kendala: ' + obj.kendala) : 'Tanpa kendala'
    );
    return { success: true, id: id };
  });
}

/* =================================
   UPDATE SESI BIMBINGAN (mis. update status kendala jadi Selesai,
   atau edit catatan). Dosen hanya boleh edit baris miliknya sendiri.
================================= */
function updateBimbinganLog(obj, sess) {
  return _withLock(15000, function() {
    if (!obj || !obj.id) return { success: false, message: 'ID log wajib diisi.' };
    var sheet = _ensureBimbinganSheet();
    var found = _findRowByValue(sheet, 0, obj.id);
    if (!found) return { success: false, message: 'Data bimbingan tidak ditemukan.' };

    if (sess.role === 'Dosen' && !_isDosenMatch(found.row[3], sess.nama)) {
      return { success: false, message: 'Anda tidak berhak mengubah log bimbingan dosen lain.' };
    }

    if (obj.tanggal)       sheet.getRange(found.rowIndex, 5).setValue(new Date(obj.tanggal));
    if (obj.durasiMenit !== undefined) sheet.getRange(found.rowIndex, 6).setValue(Number(obj.durasiMenit) || 0);
    if (obj.topik !== undefined)       sheet.getRange(found.rowIndex, 7).setValue(obj.topik);
    if (obj.kendala !== undefined)     sheet.getRange(found.rowIndex, 8).setValue(obj.kendala);
    if (obj.statusKendala !== undefined) sheet.getRange(found.rowIndex, 9).setValue(obj.statusKendala);

    _writeAuditLog(sess.nama, 'Update Sesi Bimbingan', obj.id, '-', '-', 'Diperbarui oleh ' + sess.nama);
    return { success: true };
  });
}

/* =================================
   HAPUS SESI BIMBINGAN
================================= */
function deleteBimbinganLog(id, sess) {
  var sheet = _ensureBimbinganSheet();
  var found = _findRowByValue(sheet, 0, id);
  if (!found) return { success: false, message: 'Data tidak ditemukan.' };

  if (sess.role === 'Dosen' && !_isDosenMatch(found.row[3], sess.nama)) {
    return { success: false, message: 'Anda tidak berhak menghapus log bimbingan dosen lain.' };
  }

  sheet.deleteRow(found.rowIndex);
  _writeAuditLog(sess.nama, 'Hapus Sesi Bimbingan', id, '-', '-', '');
  return { success: true };
}

/* =================================
   DASHBOARD UTAMA DOSEN
   Ringkasan: jumlah mahasiswa bimbingan, total sesi, total durasi,
   daftar kendala terbuka, dan rincian per mahasiswa.
================================= */
function getDosenDashboard(dosenNama) {
  if (!dosenNama) return { success: false, message: 'Nama dosen tidak diketahui.' };

  var mahasiswaList = _getMahasiswaByDosen(dosenNama);
  var logs          = getBimbinganLog(dosenNama);

  var totalDurasi   = 0;
  var kendalaAktif  = [];
  var perMhs        = {}; // nim -> { sesi, durasi, kendalaTerbuka }

  mahasiswaList.forEach(function(m) {
    perMhs[m.nim] = {
      nim: m.nim, nama: m.nama,
      judulPenelitian: m.judulPenelitian,
      tanggalMulai: m.tanggalMulai, tanggalSelesai: m.tanggalSelesai,
      sisaWaktu: m.sisaWaktu, sisaHari: m.sisaHari,
      jumlahSesi: 0, totalDurasiMenit: 0, kendalaTerbuka: 0, kendalaTerakhir: '-'
    };
  });

  logs.forEach(function(l) {
    totalDurasi += l.durasiMenit;
    if (l.statusKendala === 'Open') {
      kendalaAktif.push({
        nim: l.nim, nama: l.namaMahasiswa, tanggal: l.tanggal,
        kendala: l.kendala, id: l.id
      });
    }
    var bucket = perMhs[l.nim];
    if (bucket) {
      bucket.jumlahSesi++;
      bucket.totalDurasiMenit += l.durasiMenit;
      if (l.statusKendala === 'Open') {
        bucket.kendalaTerbuka++;
        if (bucket.kendalaTerakhir === '-') bucket.kendalaTerakhir = l.kendala;
      }
    }
  });

  var jamBulat = Math.floor(totalDurasi / 60);
  var menitSisa = totalDurasi % 60;

  return {
    success: true,
    dosenNama: dosenNama,
    summary: {
      jumlahMahasiswaBimbingan: mahasiswaList.length,
      jumlahSesiBimbingan: logs.length,
      totalDurasiMenit: totalDurasi,
      totalDurasiLabel: jamBulat > 0 ? (jamBulat + ' jam ' + menitSisa + ' menit') : (menitSisa + ' menit'),
      jumlahKendalaAktif: kendalaAktif.length
    },
    mahasiswa: Object.keys(perMhs).map(function(k) { return perMhs[k]; }),
    kendalaAktif: kendalaAktif,
    riwayatSesi: logs
  };
}

/* =================================
   DAFTAR NAMA DOSEN (dipakai admin untuk filter/dropdown)
   Gabungan dari: (a) field DosenPembimbing unik di STUDENTS_DB,
   (b) akun dengan role "Dosen" di sheet USERS.
================================= */
function getDosenList() {
  var namaSet = {};

  var students = getAllStudentInfo();
  Object.keys(students).forEach(function(nim) {
    var p = students[nim].dosenPembimbing;
    if (!p || p === '-') return;
    p.split('/').forEach(function(part) {
      var nm = part.toString().trim();
      if (nm) namaSet[nm] = true;
    });
  });

  var userSheet = getSheet('USERS');
  if (userSheet) {
    var data = userSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if ((data[i][3] || '').toString().trim() === 'Dosen') {
        var nm2 = (data[i][2] || '').toString().trim();
        if (nm2) namaSet[nm2] = true;
      }
    }
  }

  return Object.keys(namaSet).sort();
}
