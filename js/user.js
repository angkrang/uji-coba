/* ============================================================
   KELOLA USER
   ============================================================ */
async function loadUsers() {
  var tb=document.getElementById('tbUser');
  try {
    var data=await callGAS('getUserList');
    if(!data||!data.length){ if(tb) tb.innerHTML='<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">👤</div><div class="empty-state-title">Belum ada user</div></div></td></tr>'; return; }
    if(tb) tb.innerHTML=data.map(function(u){
      var rb=(u.role.toLowerCase()==='admin'||u.role.toLowerCase()==='plp')
        ?'<span class="badge b-purple"><i class="bi bi-shield-check" style="margin-right:3px;"></i>'+esc(u.role)+'</span>'
        :'<span class="badge b-blue"><i class="bi bi-person" style="margin-right:3px;"></i>'+esc(u.role)+'</span>';
      var isMahasiswa=(u.role||'').toLowerCase()==='mahasiswa';
      var delBtn;
      if (isMahasiswa) {
        delBtn='<span style="color:var(--muted);font-size:11px;" title="Akun mahasiswa dikelola otomatis dari Rekap. Nonaktifkan lewat status Lulus di Rekap.">Dikelola dari Rekap</span>';
      } else if (u.username!==_uname) {
        delBtn='<button class="btn btn-xs" style="background:#fee2e2;color:#991b1b;border:none;cursor:pointer;border-radius:6px;font-size:11px;font-weight:600;" onclick="delUser(\''+esc(u.username)+'\')"><i class="bi bi-trash"></i></button>';
      } else {
        delBtn='<span style="color:var(--muted);font-size:12px;">(aktif)</span>';
      }
      var initials=(u.nama||'?').charAt(0).toUpperCase();
      var fotoUser=u.foto||(isMahasiswa?'assets/foto-profil-default.png':'');
      var avatarCell='<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#4C6FA5,#6B93C0);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;overflow:hidden;">'+_avatarHtml(initials,fotoUser)+'</div>';
      return '<tr class="user-row" data-s="'+esc((u.username+u.nama).toLowerCase())+'">'
        +'<td>'+avatarCell+'</td>'
        +'<td><code>'+esc(u.username)+'</code></td>'
        +'<td style="font-weight:600;">'+esc(u.nama)+'</td>'
        +'<td>'+rb+'</td>'
        +'<td style="display:flex;gap:4px;flex-wrap:wrap;">'
        +'<button class="btn btn-xs btn-outline" onclick="openEditUser(\''+esc(u.username)+'\',\''+esc(u.nama)+'\',\''+esc(u.role)+'\',\''+esc(u.foto||'')+'\')"><i class="bi bi-key"></i> Reset Pass</button>'
        +'<button class="btn btn-xs" style="background:#eff6ff;color:#385780;border:1px solid #bfdbfe;cursor:pointer;border-radius:6px;font-size:11px;font-weight:600;" data-uname="'+esc(u.username)+'" data-nama="'+esc(u.nama)+'" data-role="'+esc(u.role)+'" data-foto="'+esc(u.foto||'')+'" onclick="openUbahFotoAdmin(this)"><i class="bi bi-camera"></i> Foto</button>'
        +delBtn+'</td></tr>';
    }).join('');
  } catch(e) {}
}

function filterUsers() {
  var v=document.getElementById('srchUser').value.toLowerCase();
  document.querySelectorAll('#tbUser .user-row').forEach(function(r){ r.style.display=(r.getAttribute('data-s')||'').includes(v)?'':'none'; });
}

function toggleStudentFields() {
  var role=document.getElementById('uRole').value;
  document.getElementById('studentFields').classList.toggle('hidden', role!=='Mahasiswa');
  var sfw=document.getElementById('staffFotoWrap'); if(sfw) sfw.classList.toggle('hidden', role==='Mahasiswa');
}

function openModalAddUser() {
  _editUsername='';
  document.getElementById('mdlUserTitle').textContent='Tambah User Baru';
  ['uUsername','uNama','uPass','uDosen','uJudul','uTglMulai','uTglSelesai','uFoto'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('uRole').value='Mahasiswa';
  document.getElementById('uStatus').value='Aktif';
  document.getElementById('uUsername').disabled=false;
  document.getElementById('uPassWrap').classList.remove('hidden');
  document.getElementById('uResetWrap').classList.add('hidden');
  document.getElementById('studentFields').classList.remove('hidden');
  var sfw=document.getElementById('staffFotoWrap'); if(sfw) sfw.classList.add('hidden');
  openModal('mdlUser');
}

function openEditUser(username, nama, role, foto) {
  _editUsername=username;
  document.getElementById('mdlUserTitle').textContent='Edit User: '+nama;
  document.getElementById('uUsername').value=username;
  document.getElementById('uNama').value=nama;
  document.getElementById('uRole').value=role;
  document.getElementById('uUsername').disabled=true;
  document.getElementById('uNewPass').value='';
  document.getElementById('uPassWrap').classList.add('hidden');
  document.getElementById('uResetWrap').classList.remove('hidden');
  document.getElementById('studentFields').classList.toggle('hidden', role!=='Mahasiswa');
  var sfw=document.getElementById('staffFotoWrap'); if(sfw) sfw.classList.toggle('hidden', role==='Mahasiswa');
  var uFoto=document.getElementById('uFoto'); if(uFoto) uFoto.value=foto||'';
   // === TAMBAHAN: bersihkan field penelitian dari data modal sebelumnya ===
  ['uDosen','uJudul','uTglMulai','uTglSelesai'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('uStatus').value='Aktif';
  // Ambil status Aktif/Lulus terkini dari Rekap (DataEdit) — hanya untuk Mahasiswa
  if (role === 'Mahasiswa') {
    callGAS('getMahasiswaExternalByNim', { nim: username }).then(function (ext) {
      if (ext && ext.status) {
        var statusNormal = ext.status.charAt(0).toUpperCase() + ext.status.slice(1).toLowerCase();
        var sel = document.getElementById('uStatus');
        if (sel && (statusNormal === 'Aktif' || statusNormal === 'Lulus')) sel.value = statusNormal;
      }
    }).catch(function () {});
  }
  openModal('mdlUser');
}


async function doSaveUser() {
  var username = document.getElementById('uUsername').value.trim();
  var nama     = document.getElementById('uNama').value.trim();
  var role     = document.getElementById('uRole').value;
  var pass     = document.getElementById('uPass').value.trim();
  var foto     = (document.getElementById('uFoto')||{}).value||'';
  foto = foto.trim();
 
  if (!username || !nama) {
    Swal.fire('Peringatan', 'Username dan nama wajib diisi', 'warning');
    return;
  }
 
  /* ── MODE TAMBAH USER BARU ── */
  if (!_editUsername) {
    if (!pass) {
      Swal.fire('Peringatan', 'Password wajib diisi', 'warning');
      return;
    }
 
    Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });
 
    try {
      /* FIX: pakai nama variabel addRes, bukan res, agar tidak clash */
      var addRes = await callGAS('addUser', { username: username, password: pass, nama: nama, role: role, foto: foto });
      Swal.close();
 
      /* FIX: guard — pastikan addRes tidak null/undefined sebelum akses .success */
      if (!addRes) {
        Swal.fire('Gagal', 'Tidak ada respons dari server', 'error');
        return;
      }
 
      if (addRes.success) {
        closeModal('mdlUser');
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'User berhasil ditambahkan', showConfirmButton: false, timer: 2000 });
        loadUsers();
 
        if (role === 'Mahasiswa') {
          var sobj = {
            nim:              username,
            nama:             nama,
            dosenPembimbing:  document.getElementById('uDosen').value.trim(),
            judulPenelitian:  document.getElementById('uJudul').value.trim(),
            tanggalMulai:     document.getElementById('uTglMulai').value,
            tanggalSelesai:   document.getElementById('uTglSelesai').value
          };
          callGAS('saveStudentInfo', sobj).catch(function () {});
        }
 
      } else {
        Swal.fire('Gagal', addRes.message || 'Tidak dapat menyimpan user', 'error');
      }
 
    } catch (e) {
      Swal.close();
      Swal.fire('Error', e.message || 'Terjadi kesalahan', 'error');
    }
 
  /* ── MODE EDIT USER ── */
  } else {
    var uStatusEl = document.getElementById('uStatus');
    var isMahasiswaLulus = (role === 'Mahasiswa' && uStatusEl && uStatusEl.value === 'Lulus');

    Swal.fire({
      title: isMahasiswaLulus ? 'Menyimpan & Menyinkronkan Data...' : 'Menyimpan...',
      text : isMahasiswaLulus ? 'Mohon tunggu, status sedang disinkronkan ke seluruh sistem.' : undefined,
      allowOutsideClick: false,
      didOpen: function () { Swal.showLoading(); }
    });

    /* Untuk role Mahasiswa: updateUserInfo() di GAS SELALU menolak
       (nama/role mahasiswa dikelola otomatis dari Rekap via ARRAYFORMULA),
       jadi panggilan itu dilewati sama sekali. Field yang memang bisa
       diubah (dosen/judul/tanggal/status) dikirim langsung lewat
       saveStudentInfo(), yang menulis ke Rekap/DataEdit. */
    if (role === 'Mahasiswa') {
      try {
        var sobj = {
          nim:              username,
          nama:             nama,
          dosenPembimbing:  document.getElementById('uDosen').value.trim(),
          judulPenelitian:  document.getElementById('uJudul').value.trim(),
          tanggalMulai:     document.getElementById('uTglMulai').value,
          tanggalSelesai:   document.getElementById('uTglSelesai').value,
          status:           document.getElementById('uStatus').value,
          adminNim:         _uname
        };
        var saveRes = await callGAS('saveStudentInfo', sobj);
        Swal.close();

        if (!saveRes) {
          Swal.fire('Gagal', 'Tidak ada respons dari server.', 'error');
          return;
        }

        if (saveRes.success) {
          closeModal('mdlUser');
          Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Data mahasiswa berhasil diperbarui', showConfirmButton: false, timer: 2000 });
          loadUsers();

          var sedangLihatDetailMhsIni = (typeof _detailNim !== 'undefined' && _detailNim &&
            _normalizeNimShort(_detailNim) === _normalizeNimShort(username));
          if (sedangLihatDetailMhsIni) {
            if (sobj.status === 'Lulus') {
              // Mahasiswa sudah Lulus: halaman detail tidak relevan lagi
              // (mahasiswa tidak lagi muncul di daftar aktif) — tutup
              // halaman detail dan kembali ke dashboard, lalu refresh
              // card mahasiswa supaya yang bersangkutan hilang dari daftar.
              if (typeof goTo === 'function') goTo('dash');
            } else if (typeof loadStudentDetail === 'function') {
              loadStudentDetail(username);
            }
          }
        } else {
          Swal.fire('Gagal', saveRes.message || 'Tidak dapat memperbarui data mahasiswa', 'error');
        }
      } catch (e) {
        Swal.close();
        Swal.fire('Error', e.message || 'Terjadi kesalahan', 'error');
      }
      return;
    }

    try {
      /* FIX: pakai nama variabel editRes, bukan res, agar tidak clash */
      var editRes = await callGAS('updateUserInfo', { username: username, nama: nama, role: role, foto: foto });
      Swal.close();
 
      /* FIX: guard — pastikan editRes tidak null/undefined */
      if (!editRes) {
        Swal.fire('Gagal', 'Tidak ada respons dari server. Pastikan fungsi updateUserInfo sudah ada di Google Apps Script.', 'error');
        return;
      }
 
      if (editRes.success) {
        closeModal('mdlUser');
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Data user berhasil diperbarui', showConfirmButton: false, timer: 2000 });
        loadUsers();
        if (username === _uname) { _foto = foto; _saveSession(); _applyRoleUI(); }
      } else {
        Swal.fire('Gagal', editRes.message || 'Tidak dapat memperbarui data', 'error');
      }
 
    } catch (e) {
      Swal.close();
      /* FIX: pesan error yang lebih informatif untuk membantu debug */
      var errMsg = e.message || 'Terjadi kesalahan';
      if (errMsg.toLowerCase().includes('updateuserinfo') || errMsg.toLowerCase().includes('not found')) {
        errMsg = 'Fungsi updateUserInfo belum ada di Google Apps Script. Tambahkan fungsi tersebut di GAS backend.';
      }
      Swal.fire('Error', errMsg, 'error');
    }
  }
}

async function doResetPass() {
  var newPass=document.getElementById('uNewPass').value.trim();
  if(!newPass){ Swal.fire('Peringatan','Masukkan password baru','warning'); return; }
  Swal.fire({title:'Mereset...',allowOutsideClick:false,didOpen:function(){Swal.showLoading();}});
  try {
    var res=await callGAS('resetUserPassword',{username:_editUsername,newPassword:newPass});
    Swal.close();
    if(res.success){ closeModal('mdlUser'); Swal.fire({toast:true,position:'top-end',icon:'success',title:'Password berhasil direset',showConfirmButton:false,timer:2000}); }
    else Swal.fire('Gagal',res.message,'error');
  } catch(e){ Swal.close(); Swal.fire('Error',e.message,'error'); }
}

async function delUser(username) {
  var r=await Swal.fire({title:'Hapus user ini?',text:'Username: '+username,icon:'warning',showCancelButton:true,confirmButtonColor:'#dc2626',confirmButtonText:'Hapus',cancelButtonText:'Batal'});
  if(r.isConfirmed){
    try {
      var res=await callGAS('deleteUser',{username:username});
      if(res.success){ Swal.fire({toast:true,position:'top-end',icon:'success',title:'User dihapus',showConfirmButton:false,timer:2000}); loadUsers(); }
      else Swal.fire('Gagal',res.message,'error');
    } catch(e) {}
  }
}

/* ============================================================
   UBAH FOTO PROFIL — diakses Admin dari tabel Kelola User
   ============================================================ */
var _ubahFotoTarget = { username: '', nama: '', role: '', foto: '' };

function openUbahFotoAdmin(btn) {
  _ubahFotoTarget.username = btn.getAttribute('data-uname') || '';
  _ubahFotoTarget.nama     = btn.getAttribute('data-nama')  || '';
  _ubahFotoTarget.role     = btn.getAttribute('data-role')  || '';
  _ubahFotoTarget.foto     = btn.getAttribute('data-foto')  || '';

  var inp = document.getElementById('adminFotoUrl');
  if (inp) inp.value = _ubahFotoTarget.foto;

  var title = document.getElementById('adminFotoTitle');
  if (title) title.textContent = 'Ubah Foto: ' + _ubahFotoTarget.nama;

  _previewAdminFoto(_ubahFotoTarget.foto);
  openModal('mdlUbahFotoAdmin');
}

function _previewAdminFoto(url) {
  var el = document.getElementById('adminFotoPreview');
  if (!el) return;
  var initials = (_ubahFotoTarget.nama || '?').charAt(0).toUpperCase();
  el.innerHTML = _avatarHtml(initials, (url || '').trim());
}

async function saveUbahFotoAdmin() {
  var url = ((document.getElementById('adminFotoUrl') || {}).value || '').trim();
  try {
    Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: function(){ Swal.showLoading(); } });
    var res = await callGAS('updateUserInfo', {
      username : _ubahFotoTarget.username,
      nama     : _ubahFotoTarget.nama,
      role     : _ubahFotoTarget.role,
      foto     : url
    });
    Swal.close();
    if (res && res.success) {
      // Jika yang diubah adalah akun yang sedang login, update foto sesi juga
      if (_ubahFotoTarget.username === _uname) {
        _foto = url;
        _saveSession();
        _applyRoleUI();
      }
      closeModal('mdlUbahFotoAdmin');
      Swal.fire({ icon: 'success', title: 'Foto berhasil diperbarui', timer: 1500, showConfirmButton: false });
      loadUsers();
    } else {
      Swal.fire('Gagal', (res && res.message) || 'Tidak dapat menyimpan foto.', 'error');
    }
  } catch(e) {
    Swal.close();
    Swal.fire('Error', 'Gagal menghubungi server.', 'error');
  }
}
