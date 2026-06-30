/* ============================================================
   DOSEN.JS — Dashboard & log bimbingan untuk role "Dosen"
   ============================================================ */

var _dosenData = null; // cache hasil terakhir getDosenDashboard
// esc() dipakai dari js/utils.js (sudah dimuat lebih dulu)

async function loadDosenDashboard() {
  try {
    var res = await callGAS('getDosenDashboard', {});
    if (!res || !res.success) {
      Swal.fire('Gagal', (res && res.message) || 'Gagal memuat dashboard bimbingan.', 'error');
      return;
    }
    _dosenData = res;
    _renderDosenSummary(res.summary);
    _renderDosenMahasiswa(res.mahasiswa);
    _renderDosenKendala(res.kendalaAktif);
    _renderDosenRiwayat(res.riwayatSesi);
    _populateDosenFormMhs(res.mahasiswa);
  } catch (e) {
    Swal.fire('Error', 'Tidak dapat menghubungi server.', 'error');
  }
}

function _renderDosenSummary(s) {
  if (!s) return;
  document.getElementById('dsnJumlahMhs').textContent = s.jumlahMahasiswaBimbingan;
}

function _renderDosenMahasiswa(list) {
  var body = document.getElementById('dsnMhsBody');
  if (!body) return;
  if (!list || !list.length) {
    body.innerHTML = '<tr><td colspan="9"><div class="empty-state"><div class="empty-state-title">Belum ada mahasiswa bimbingan terdaftar</div><div class="empty-state-sub">Pastikan nama Anda di akun Dosen sama dengan kolom "Dosen Pembimbing" pada data mahasiswa.</div></div></td></tr>';
    return;
  }
  body.innerHTML = list.map(function(m) {
    return '<tr>'
      + '<td>' + esc(m.nimLengkap || m.nim) + '</td>'
      + '<td>' + esc(m.nama) + '</td>'
      + '<td>' + esc(m.judulPenelitian||'—') + '</td>'
      + '<td>' + esc(m.tanggalMulai||'-') + '</td>'
      + '<td>' + esc(m.tanggalSelesai||'-') + '</td>'
      + '<td>' + esc(m.sisaWaktu||'-') + '</td>'
      + '<td>' + m.jumlahSesi + '</td>'
      + '<td>' + (m.kendalaTerbuka>0
            ? '<span class="badge b-red">'+m.kendalaTerbuka+' aktif</span>'
            : '<span class="badge b-green">Tidak ada</span>') + '</td>'
      + '<td><button class="btn btn-xs btn-outline" onclick="prefillDosenForm(\''+esc(m.nim)+'\')"><i class="bi bi-plus-circle"></i> Catat Sesi</button></td>'
      + '</tr>';
  }).join('');
}

function _renderDosenKendala(list) {
  var body = document.getElementById('dsnKendalaBody');
  if (!body) return;
  if (!list || !list.length) {
    body.innerHTML = '<tr><td colspan="4"><div class="empty-state"><div class="empty-state-title">Tidak ada kendala aktif</div></div></td></tr>';
    return;
  }
  body.innerHTML = list.map(function(k) {
    return '<tr>'
      + '<td>' + esc(k.tanggal) + '</td>'
      + '<td>' + esc(k.nama) + ' (' + esc(k.nim) + ')</td>'
      + '<td>' + esc(k.kendala) + '</td>'
      + '<td><button class="btn btn-xs btn-outline" onclick="resolveKendala(\''+esc(k.id)+'\')"><i class="bi bi-check2"></i> Tandai Selesai</button></td>'
      + '</tr>';
  }).join('');
}

function _renderDosenRiwayat(list) {
  var body = document.getElementById('dsnRiwayatBody');
  if (!body) return;
  if (!list || !list.length) {
    body.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-state-title">Belum ada riwayat</div></div></td></tr>';
    return;
  }
  body.innerHTML = list.map(function(l) {
    var statusBadge = l.statusKendala === 'Open'
      ? '<span class="badge b-red">Kendala Aktif</span>'
      : (l.statusKendala === 'Selesai' ? '<span class="badge b-green">Kendala Selesai</span>' : '<span class="badge b-blue">Tanpa Kendala</span>');
    return '<tr>'
      + '<td>' + esc(l.tanggal) + '</td>'
      + '<td>' + esc(l.namaMahasiswa) + ' (' + esc(l.nim) + ')</td>'
      + '<td>' + l.durasiMenit + ' menit</td>'
      + '<td>' + esc(l.topik||'—') + '</td>'
      + '<td>' + esc(l.kendala||'—') + '</td>'
      + '<td>' + statusBadge + '</td>'
      + '</tr>';
  }).join('');
}

function _populateDosenFormMhs(list) {
  var sel = document.getElementById('dsnFormNim');
  if (!sel) return;
  sel.innerHTML = '<option value="">— pilih mahasiswa —</option>' +
    (list||[]).map(function(m){ return '<option value="'+esc(m.nim)+'">'+esc(m.nama)+' ('+esc(m.nim)+')</option>'; }).join('');
}

function prefillDosenForm(nim) {
  var sel = document.getElementById('dsnFormNim');
  if (sel) sel.value = nim;
  var t = document.getElementById('dsnFormTanggal');
  if (t && !t.value) t.value = new Date().toISOString().slice(0,10);
  document.getElementById('dsnFormDurasi').focus();
}

async function submitBimbinganLog() {
  var nim     = document.getElementById('dsnFormNim').value;
  var tanggal = document.getElementById('dsnFormTanggal').value;
  var durasi  = document.getElementById('dsnFormDurasi').value;
  var topik   = document.getElementById('dsnFormTopik').value.trim();
  var kendala = document.getElementById('dsnFormKendala').value.trim();

  if (!nim) { Swal.fire('Peringatan','Pilih mahasiswa terlebih dahulu','warning'); return; }
  if (!tanggal) { Swal.fire('Peringatan','Tanggal wajib diisi','warning'); return; }

  Swal.fire({ title:'Menyimpan...', allowOutsideClick:false, didOpen:function(){ Swal.showLoading(); } });
  try {
    var res = await callGAS('addBimbinganLog', {
      nim: nim, tanggal: tanggal, durasiMenit: durasi, topik: topik,
      kendala: kendala, statusKendala: kendala ? 'Open' : ''
    });
    Swal.close();
    if (res && res.success) {
      Swal.fire({icon:'success', title:'Tersimpan', timer:1200, showConfirmButton:false});
      document.getElementById('dsnFormTopik').value = '';
      document.getElementById('dsnFormKendala').value = '';
      document.getElementById('dsnFormDurasi').value = '';
      loadDosenDashboard();
    } else {
      Swal.fire('Gagal', (res && res.message) || 'Gagal menyimpan.', 'error');
    }
  } catch(e) {
    Swal.close();
    Swal.fire('Error', 'Tidak dapat menghubungi server.', 'error');
  }
}

async function resolveKendala(id) {
  var confirm = await Swal.fire({
    title: 'Tandai kendala ini selesai?', icon: 'question',
    showCancelButton: true, confirmButtonText: 'Ya, selesai', cancelButtonText: 'Batal'
  });
  if (!confirm.isConfirmed) return;
  try {
    var res = await callGAS('updateBimbinganLog', { id: id, statusKendala: 'Selesai' });
    if (res && res.success) {
      Swal.fire({icon:'success', title:'Diperbarui', timer:1000, showConfirmButton:false});
      loadDosenDashboard();
    } else {
      Swal.fire('Gagal', (res && res.message) || 'Gagal memperbarui.', 'error');
    }
  } catch(e) {
    Swal.fire('Error', 'Tidak dapat menghubungi server.', 'error');
  }
}
