/* ============================================================
   DOSEN.JS — Dashboard & log bimbingan untuk role "Dosen"
   Fitur:
   - Dashboard ringkas (jumlah mhs, sebaran jenjang)
   - Tabel mahasiswa bimbingan + filter pencarian
   - Kendala aktif dengan tombol "Selesaikan"
   - Catat sesi bimbingan baru
   - Riwayat semua sesi + hapus + edit status kendala
   - Edit sesi (modal)
   ============================================================ */

var _dosenData      = null;   // cache hasil terakhir getDosenDashboard
var _dosenAllLog    = [];     // seluruh riwayat sesi (untuk filter)
var _dosenLogFilter = '';     // filter pencarian riwayat
var _dosenEditId    = null;   // ID sesi yang sedang diedit

/* ============================================================
   LOAD DASHBOARD UTAMA
   ============================================================ */
async function loadDosenDashboard() {
  try {
    var res = await callGAS('getDosenDashboard', {});
    if (!res || !res.success) {
      Swal.fire('Gagal', (res && res.message) || 'Gagal memuat dashboard bimbingan.', 'error');
      return;
    }
    _dosenData   = res;
    _dosenAllLog = res.riwayatSesi || [];
    _renderDosenSummary(res.summary);
    _renderDosenMahasiswa(res.mahasiswa);
    _renderDosenKendala(res.kendalaAktif);
    _populateDosenFormMhs(res.mahasiswa);
    _renderDosenRiwayat(_dosenAllLog);
  } catch (e) {
    console.error('loadDosenDashboard error:', e);
    Swal.fire('Error', 'Tidak dapat menghubungi server.', 'error');
  }
}

/* ============================================================
   RENDER SUMMARY (stat cards)
   ============================================================ */
function _renderDosenSummary(s) {
  if (!s) return;
  var el = document.getElementById('dsnJumlahMhs');
  if (el) el.textContent = s.jumlahMahasiswaBimbingan;
  _renderDosenJenjang(s.sebaranJenjang);
}

function _renderDosenJenjang(sebaran) {
  var box = document.getElementById('dsnJenjangBreakdown');
  if (!box) return;
  if (!sebaran) { box.innerHTML = ''; return; }

  var cfg = {
    S1      : { bg:'#dbeafe', fg:'#1e40af', icon:'bi-mortarboard',       label:'Skripsi (S1)' },
    S2      : { bg:'#ede9fe', fg:'#6d28d9', icon:'bi-journal-bookmark',   label:'Tesis (S2)'   },
    S3      : { bg:'#fef3c7', fg:'#92400e', icon:'bi-award',              label:'Disertasi (S3)'},
    PKM     : { bg:'#dcfce7', fg:'#166534', icon:'bi-lightbulb',          label:'PKM'           },
    Lainnya : { bg:'#f1f5f9', fg:'#475569', icon:'bi-three-dots',         label:'Lainnya'       }
  };
  box.innerHTML = Object.keys(cfg).map(function(k) {
    var n = sebaran[k] || 0;
    var c = cfg[k];
    return '<div style="display:flex;align-items:center;gap:10px;background:'+c.bg+';color:'+c.fg+';'
         + 'border-radius:12px;padding:10px 16px;min-width:150px;">'
         + '<i class="bi ' + c.icon + '" style="font-size:20px;"></i>'
         + '<div>'
           + '<div style="font-size:13px;font-weight:600;line-height:1.2;">' + esc(c.label) + '</div>'
           + '<div style="font-size:20px;font-weight:800;line-height:1.3;">' + n + '</div>'
         + '</div></div>';
  }).join('');
}

/* ============================================================
   RENDER TABEL MAHASISWA BIMBINGAN
   ============================================================ */
function _renderDosenMahasiswa(list) {
  var body = document.getElementById('dsnMhsBody');
  if (!body) return;
  if (!list || !list.length) {
    body.innerHTML = '<tr><td colspan="10" style="border:1px solid var(--border,#e2e8f0);">'
      + '<div class="empty-state">'
      + '<div class="empty-state-title">Belum ada mahasiswa bimbingan aktif</div>'
      + '<div class="empty-state-sub">Pastikan nama Anda di akun Dosen sama persis dengan kolom '
      + '"Dosen Pembimbing" pada data mahasiswa, dan status mahasiswa di Rekap adalah "Aktif".</div>'
      + '</div></td></tr>';
    return;
  }
  var td = 'style="border:1px solid var(--border,#e2e8f0);"';
  body.innerHTML = list.map(function(m) {
    var habis = (m.sisaHari !== undefined && m.sisaHari !== null && Number(m.sisaHari) <= 0);
    var sisaHtml = habis
      ? '<span style="color:var(--danger,#dc2626);font-weight:700;">Ijin Habis</span>'
      : esc(m.sisaWaktu || '-');
    return '<tr>'
      + '<td ' + td + ' style="font-size:12px;">' + esc(m.nimLengkap || m.nim) + '</td>'
      + '<td ' + td + '>' + esc(m.nama) + '</td>'
      + '<td ' + td + ' style="font-size:12px;">' + esc(m.judulPenelitian || '—') + '</td>'
      + '<td ' + td + '><span class="badge b-gray" style="font-size:11px;">' + esc(m.jenjang || '-') + '</span></td>'
      + '<td ' + td + ' style="font-size:12px;">' + esc(m.tanggalMulai || '-') + '</td>'
      + '<td ' + td + ' style="font-size:12px;">' + esc(m.tanggalSelesai || '-') + '</td>'
      + '<td ' + td + '>' + sisaHtml + '</td>'
      + '<td ' + td + ' style="text-align:center;">' + m.jumlahSesi + '</td>'
      + '<td ' + td + ' style="text-align:center;">' + (m.kendalaTerbuka > 0
          ? '<span class="badge b-red">' + m.kendalaTerbuka + ' aktif</span>'
          : '<span class="badge b-green">Tidak ada</span>') + '</td>'
      + '<td ' + td + '>'
        + '<button class="btn btn-xs btn-outline" style="white-space:nowrap;" '
        + 'onclick="prefillDosenForm(\'' + esc(m.nim) + '\')">'
        + '<i class="bi bi-plus-circle"></i> Catat</button></td>'
      + '</tr>';
  }).join('');
}

/* ============================================================
   RENDER KENDALA AKTIF
   ============================================================ */
function _renderDosenKendala(list) {
  var body = document.getElementById('dsnKendalaBody');
  if (!body) return;
  if (!list || !list.length) {
    body.innerHTML = '<tr><td colspan="4"><div class="empty-state">'
      + '<div class="empty-state-title">Tidak ada kendala aktif</div></div></td></tr>';
    return;
  }
  var td = 'style="padding:10px 12px;border-bottom:1px solid var(--border,#e2e8f0);"';
  body.innerHTML = list.map(function(k) {
    return '<tr>'
      + '<td ' + td + ' style="font-size:12px;">' + esc(k.tanggal) + '</td>'
      + '<td ' + td + '><strong>' + esc(k.nama) + '</strong><br><span style="font-size:11px;color:var(--muted);">' + esc(k.nim) + '</span></td>'
      + '<td ' + td + '>' + esc(k.kendala) + '</td>'
      + '<td ' + td + '>'
        + '<button class="btn btn-xs btn-primary" onclick="resolveKendala(\'' + esc(k.id) + '\')">'
        + '<i class="bi bi-check2-circle"></i> Selesai</button></td>'
      + '</tr>';
  }).join('');
}

/* ============================================================
   RENDER RIWAYAT SEMUA SESI (dengan filter)
   ============================================================ */
function _renderDosenRiwayat(list) {
  var body = document.getElementById('dsnRiwayatBody');
  if (!body) return;

  // Terapkan filter teks
  var q = (_dosenLogFilter || '').toLowerCase().trim();
  var filtered = q
    ? list.filter(function(l) {
        return (l.namaMahasiswa || '').toLowerCase().indexOf(q) !== -1
            || (l.nim || '').toLowerCase().indexOf(q) !== -1
            || (l.topik || '').toLowerCase().indexOf(q) !== -1
            || (l.kendala || '').toLowerCase().indexOf(q) !== -1;
      })
    : list;

  if (!filtered.length) {
    body.innerHTML = '<tr><td colspan="7"><div class="empty-state">'
      + '<div class="empty-state-title">' + (q ? 'Tidak ada sesi yang cocok' : 'Belum ada riwayat sesi') + '</div>'
      + '</div></td></tr>';
    return;
  }

  var td = 'style="padding:8px 10px;border-bottom:1px solid var(--border,#e2e8f0);font-size:13px;"';
  body.innerHTML = filtered.map(function(l) {
    var skBadge = l.statusKendala === 'Open'
      ? '<span class="badge b-red">Kendala Aktif</span>'
      : l.statusKendala === 'Selesai'
        ? '<span class="badge b-green">Kendala Selesai</span>'
        : '<span class="badge b-blue">Normal</span>';

    return '<tr>'
      + '<td ' + td + ' style="white-space:nowrap;">' + esc(l.tanggal) + '</td>'
      + '<td ' + td + '><strong>' + esc(l.namaMahasiswa) + '</strong><br>'
        + '<span style="font-size:11px;color:var(--muted);">' + esc(l.nim) + '</span></td>'
      + '<td ' + td + ' style="text-align:center;">' + (l.durasiMenit || '-') + ' mnt</td>'
      + '<td ' + td + '>' + esc(l.topik || '—') + '</td>'
      + '<td ' + td + '>' + esc(l.kendala || '—') + '</td>'
      + '<td ' + td + '>' + skBadge + '</td>'
      + '<td ' + td + ' style="white-space:nowrap;">'
        + (l.statusKendala === 'Open'
          ? '<button class="btn btn-xs btn-outline" style="margin-right:4px;" onclick="resolveKendala(\'' + esc(l.id) + '\')" title="Tandai kendala selesai"><i class="bi bi-check2"></i></button>'
          : '')
        + '<button class="btn btn-xs btn-outline" style="margin-right:4px;" onclick="editDosenSesi(\'' + esc(l.id) + '\')" title="Edit sesi"><i class="bi bi-pencil"></i></button>'
        + '<button class="btn btn-xs" style="background:#fee2e2;color:#dc2626;border:none;border-radius:6px;padding:3px 8px;cursor:pointer;" onclick="deleteDosenSesi(\'' + esc(l.id) + '\')" title="Hapus sesi"><i class="bi bi-trash3"></i></button>'
      + '</td>'
      + '</tr>';
  }).join('');
}

/* ============================================================
   POPULATE DROPDOWN MAHASISWA DI FORM
   ============================================================ */
function _populateDosenFormMhs(list) {
  var sel = document.getElementById('dsnFormNim');
  if (!sel) return;
  sel.innerHTML = '<option value="">— pilih mahasiswa —</option>'
    + (list || []).map(function(m) {
        return '<option value="' + esc(m.nim) + '">' + esc(m.nama) + ' (' + esc(m.nim) + ')</option>';
      }).join('');
}

/* ============================================================
   PREFILL FORM (klik tombol "Catat" dari tabel mahasiswa)
   ============================================================ */
function prefillDosenForm(nim) {
  var sel = document.getElementById('dsnFormNim');
  if (sel) sel.value = nim;
  var t = document.getElementById('dsnFormTanggal');
  if (t && !t.value) t.value = new Date().toISOString().slice(0, 10);
  var dur = document.getElementById('dsnFormDurasi');
  if (dur) dur.focus();
  // Scroll ke form
  var form = document.getElementById('dsnFormCard');
  if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ============================================================
   SUBMIT SESI BIMBINGAN BARU
   ============================================================ */
async function submitBimbinganLog() {
  var nim     = document.getElementById('dsnFormNim').value;
  var tanggal = document.getElementById('dsnFormTanggal').value;
  var durasi  = document.getElementById('dsnFormDurasi').value;
  var topik   = document.getElementById('dsnFormTopik').value.trim();
  var kendala = document.getElementById('dsnFormKendala').value.trim();

  if (!nim)     { Swal.fire('Peringatan', 'Pilih mahasiswa terlebih dahulu.', 'warning'); return; }
  if (!tanggal) { Swal.fire('Peringatan', 'Tanggal wajib diisi.', 'warning'); return; }

  Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: function() { Swal.showLoading(); } });
  try {
    var res = await callGAS('addBimbinganLog', {
      nim         : nim,
      tanggal     : tanggal,
      durasiMenit : Number(durasi) || 0,
      topik       : topik,
      kendala     : kendala,
      statusKendala: kendala ? 'Open' : ''
    });
    Swal.close();
    if (res && res.success) {
      Swal.fire({ icon: 'success', title: 'Sesi tersimpan!', timer: 1200, showConfirmButton: false });
      document.getElementById('dsnFormTopik').value   = '';
      document.getElementById('dsnFormKendala').value = '';
      document.getElementById('dsnFormDurasi').value  = '';
      loadDosenDashboard();
    } else {
      Swal.fire('Gagal', (res && res.message) || 'Gagal menyimpan.', 'error');
    }
  } catch (e) {
    Swal.close();
    Swal.fire('Error', 'Tidak dapat menghubungi server.', 'error');
  }
}

/* ============================================================
   RESOLVE KENDALA (tandai selesai)
   ============================================================ */
async function resolveKendala(id) {
  var cf = await Swal.fire({
    title: 'Tandai kendala selesai?', icon: 'question',
    showCancelButton: true, confirmButtonText: 'Ya, selesai', cancelButtonText: 'Batal'
  });
  if (!cf.isConfirmed) return;
  try {
    var res = await callGAS('updateBimbinganLog', { id: id, statusKendala: 'Selesai' });
    if (res && res.success) {
      Swal.fire({ icon: 'success', title: 'Kendala ditandai selesai', timer: 1000, showConfirmButton: false });
      loadDosenDashboard();
    } else {
      Swal.fire('Gagal', (res && res.message) || 'Gagal memperbarui.', 'error');
    }
  } catch (e) {
    Swal.fire('Error', 'Tidak dapat menghubungi server.', 'error');
  }
}

/* ============================================================
   HAPUS SESI BIMBINGAN
   ============================================================ */
async function deleteDosenSesi(id) {
  var cf = await Swal.fire({
    title: 'Hapus sesi ini?', text: 'Data yang dihapus tidak dapat dikembalikan.',
    icon: 'warning', showCancelButton: true,
    confirmButtonText: 'Ya, hapus', cancelButtonText: 'Batal',
    confirmButtonColor: '#dc2626'
  });
  if (!cf.isConfirmed) return;
  try {
    var res = await callGAS('deleteBimbinganLog', { id: id });
    if (res && res.success) {
      Swal.fire({ icon: 'success', title: 'Sesi dihapus', timer: 1000, showConfirmButton: false });
      loadDosenDashboard();
    } else {
      Swal.fire('Gagal', (res && res.message) || 'Gagal menghapus.', 'error');
    }
  } catch (e) {
    Swal.fire('Error', 'Tidak dapat menghubungi server.', 'error');
  }
}

/* ============================================================
   EDIT SESI BIMBINGAN (buka modal edit)
   ============================================================ */
function editDosenSesi(id) {
  var sesi = _dosenAllLog.find(function(l) { return l.id === id; });
  if (!sesi) { Swal.fire('Error', 'Data sesi tidak ditemukan di cache. Coba muat ulang halaman.', 'error'); return; }

  _dosenEditId = id;

  // Isi field modal
  var et = document.getElementById('dsnEditTanggal');
  if (et) et.value = _formatIsoDate(sesi.tanggal);
  var ed = document.getElementById('dsnEditDurasi');
  if (ed) ed.value = sesi.durasiMenit || '';
  var eto = document.getElementById('dsnEditTopik');
  if (eto) eto.value = sesi.topik || '';
  var ek = document.getElementById('dsnEditKendala');
  if (ek) ek.value = sesi.kendala || '';
  var esk = document.getElementById('dsnEditStatusKendala');
  if (esk) esk.value = sesi.statusKendala || '';

  // Judul modal
  var em = document.getElementById('dsnEditMhsLabel');
  if (em) em.textContent = sesi.namaMahasiswa + ' (' + sesi.nim + ')';

  // Tampilkan modal
  var modal = document.getElementById('dsnEditModal');
  if (modal) modal.classList.remove('hidden');
}

function closeDsnEditModal() {
  var modal = document.getElementById('dsnEditModal');
  if (modal) modal.classList.add('hidden');
  _dosenEditId = null;
}

async function submitDsnEdit() {
  if (!_dosenEditId) return;
  var tanggal = document.getElementById('dsnEditTanggal').value;
  var durasi  = document.getElementById('dsnEditDurasi').value;
  var topik   = document.getElementById('dsnEditTopik').value.trim();
  var kendala = document.getElementById('dsnEditKendala').value.trim();
  var sk      = document.getElementById('dsnEditStatusKendala').value;

  if (!tanggal) { Swal.fire('Peringatan', 'Tanggal wajib diisi.', 'warning'); return; }

  Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: function() { Swal.showLoading(); } });
  try {
    var res = await callGAS('updateBimbinganLog', {
      id          : _dosenEditId,
      tanggal     : tanggal,
      durasiMenit : Number(durasi) || 0,
      topik       : topik,
      kendala     : kendala,
      statusKendala: sk || (kendala ? 'Open' : '')
    });
    Swal.close();
    if (res && res.success) {
      closeDsnEditModal();
      Swal.fire({ icon: 'success', title: 'Sesi diperbarui!', timer: 1200, showConfirmButton: false });
      loadDosenDashboard();
    } else {
      Swal.fire('Gagal', (res && res.message) || 'Gagal menyimpan perubahan.', 'error');
    }
  } catch (e) {
    Swal.close();
    Swal.fire('Error', 'Tidak dapat menghubungi server.', 'error');
  }
}

/* ============================================================
   FILTER RIWAYAT SESI
   ============================================================ */
function filterDosenRiwayat() {
  var q = document.getElementById('dsnSearchRiwayat');
  _dosenLogFilter = q ? q.value : '';
  _renderDosenRiwayat(_dosenAllLog);
}

/* ============================================================
   HELPER: format dd/MM/yyyy → yyyy-MM-dd untuk input[type=date]
   ============================================================ */
function _formatIsoDate(ddmmyyyy) {
  if (!ddmmyyyy || ddmmyyyy === '-') return '';
  var parts = ddmmyyyy.split('/');
  if (parts.length === 3) return parts[2] + '-' + parts[1] + '-' + parts[0];
  return '';
}
