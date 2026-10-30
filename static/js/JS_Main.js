let map, userMarker, branchCircle;
let userLat = 0, userLong = 0;

document.addEventListener("DOMContentLoaded", () => {
  const tabPresensi = document.getElementById('tab-presensi-nav');
  if (tabPresensi) {
    tabPresensi.addEventListener('shown.bs.tab', () => {
      if (typeof MAP_INSTANCE !== 'undefined' && MAP_INSTANCE) {
        setTimeout(() => { MAP_INSTANCE.invalidateSize(); }, 200);
      }
    });
  }
});

// 🟢 DIGANTI DENGAN FETCH API (LOGIN)
async function handleLogin(e) {
  e.preventDefault();
  const u = document.getElementById('loginUsername').value;
  const p = document.getElementById('loginPassword').value;
  const btn = document.getElementById('btnLogin');
  btn.disabled = true;
  btn.innerText = "Memeriksa...";

  try {
    const response = await fetch(`${API_BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    const res = await response.json();

    btn.disabled = false;
    btn.innerText = "Masuk Sistem";

    if (res && res.status === 'success') {
      CURRENT_USER = res.user;
      localStorage.setItem('APP_USER_SESSION', JSON.stringify(CURRENT_USER));
      showDashboard();
    } else {
      alert(res ? res.message : 'Gagal terhubung ke server.');
    }
  } catch (err) {
    btn.disabled = false;
    btn.innerText = "Masuk Sistem";
    alert("Terjadi kesalahan sistem: " + err.message);
  }
}

function checkSession() {
  const saved = localStorage.getItem('APP_USER_SESSION');
  if (saved) {
    try {
      CURRENT_USER = JSON.parse(saved);
      showDashboard();
    } catch(e) {
      localStorage.removeItem('APP_USER_SESSION');
    }
  }
}

function handleLogout() {
  localStorage.removeItem('APP_USER_SESSION');
  CURRENT_USER = null;
  document.getElementById('dashboardView').classList.add('d-none');
  document.getElementById('loginView').classList.remove('d-none');
}

// 🟢 DIGANTI DENGAN FETCH API
async function runDatabaseSetup() {
  if (confirm("Jalankan setup database otomatis pada server ini?")) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/setup-database`, { method: 'POST' });
      const res = await response.json();
      alert(res.message);
      loadAppData();
    } catch (err) {
      alert("Error setup database: " + err.message);
    }
  }
}

function showDashboard() {
  document.getElementById('loginView').classList.add('d-none');
  document.getElementById('dashboardView').classList.remove('d-none');

  const welcomeEl = document.getElementById('userWelcome');
  if (welcomeEl) {
    welcomeEl.innerText = `Halo, ${CURRENT_USER.nama_lengkap} (${CURRENT_USER.posisi || CURRENT_USER.jabatan || 'Staff'})`;
  }

  const badge = document.getElementById('roleBadge');
  if (badge) {
    badge.innerText = CURRENT_USER.role;
    let bgClass = 'bg-primary';
    if (CURRENT_USER.role === 'Admin') bgClass = 'bg-danger';
    else if (CURRENT_USER.role === 'HRD') bgClass = 'bg-warning text-dark';
    else if (CURRENT_USER.role === 'Admin Cabang') bgClass = 'bg-info text-dark';
    else if (CURRENT_USER.role === 'Staf Admin Cabang') bgClass = 'bg-secondary';
    badge.className = `badge role-badge ${bgClass}`;
  }

  const cardGaji = document.getElementById('cardEstimasiGaji');
  if (cardGaji) {
    if (CURRENT_USER.role === 'Staf Admin Cabang') {
      cardGaji.classList.add('d-none');
    } else {
      cardGaji.classList.remove('d-none');
    }
  }

  document.querySelectorAll('.tab-role-karyawan, .tab-role-cabang, .tab-role-acc, .tab-role-payroll, .tab-role-histori-admin').forEach(el => el.classList.add('d-none'));
  document.querySelectorAll('.role-hrd, .role-admin, .role-admin-cabang').forEach(el => el.classList.add('d-none'));

  const tabPengaturanNav = document.getElementById('tab-pengaturan');
  const filterAdminOnly = document.querySelectorAll('.filter-admin-only');

  if (CURRENT_USER.role === 'Admin') {
    document.querySelectorAll('.tab-role-karyawan, .tab-role-cabang, .tab-role-acc, .tab-role-payroll, .tab-role-histori-admin').forEach(el => el.classList.remove('d-none'));
    document.querySelectorAll('.role-hrd, .role-admin, .role-admin-cabang').forEach(el => el.classList.remove('d-none'));
    filterAdminOnly.forEach(el => el.classList.remove('d-none'));
    if (tabPengaturanNav) tabPengaturanNav.classList.remove('d-none');
  } else if (CURRENT_USER.role === 'HRD') {
    document.querySelectorAll('.tab-role-karyawan, .tab-role-acc, .tab-role-payroll, .tab-role-histori-admin').forEach(el => el.classList.remove('d-none'));
    document.querySelectorAll('.role-hrd').forEach(el => el.classList.remove('d-none'));
    filterAdminOnly.forEach(el => el.classList.remove('d-none'));
    if (tabPengaturanNav) tabPengaturanNav.classList.remove('d-none');
  } else if (CURRENT_USER.role === 'Admin Cabang') {
    document.querySelectorAll('.tab-role-karyawan, .tab-role-acc, .tab-role-payroll, .tab-role-histori-admin').forEach(el => el.classList.remove('d-none'));
    document.querySelectorAll('.role-admin-cabang').forEach(el => el.classList.remove('d-none'));
    filterAdminOnly.forEach(el => el.classList.remove('d-none'));
    if (tabPengaturanNav) tabPengaturanNav.classList.add('d-none');
  } else if (CURRENT_USER.role === 'Staf Admin Cabang') {
    document.querySelectorAll('.tab-role-karyawan, .tab-role-payroll, .tab-role-histori-admin').forEach(el => el.classList.remove('d-none'));
    document.querySelectorAll('.role-admin-cabang').forEach(el => el.classList.remove('d-none'));
    filterAdminOnly.forEach(el => el.classList.remove('d-none'));
    if (tabPengaturanNav) tabPengaturanNav.classList.add('d-none');
  } else {
    filterAdminOnly.forEach(el => el.classList.add('d-none'));
    if (tabPengaturanNav) tabPengaturanNav.classList.add('d-none');
  }

  loadAppData();
}

// 🟢 DIGANTI DENGAN FETCH API
async function loadAppData() {
  if (!CURRENT_USER || !CURRENT_USER.id_karyawan) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/initial-data?id_karyawan=${CURRENT_USER.id_karyawan}&role=${CURRENT_USER.role}`);
    const data = await response.json();

    if (!data) return alert("Gagal memuat data dari server.");
    GLOBAL_DATA = data;
    try { applySettings(data.settings); } catch(e){}
    try { populateDropdowns(); } catch(e){}
    try { initMapAndLocation(); } catch(e){}
    try { updateActionButtonState(data.statusAbsen); } catch(e){}
    try { renderCardJadwalHariIni(data.jadwalHariIni); } catch(e){}
    try { renderRingkasanGaji(data); } catch(e){}
    try { setupDefaultFilterHistori(data); } catch(e){}
    try { renderAllTables(); } catch(e){}
    try { populateScopeOptions(); } catch(e){}
    try { loadPengaturanGajiToForm(); } catch(e){}
    try { loadRuleUmumByCabang(); } catch(e){}
    try { renderListKaryawanInsentifKhusus(); } catch(e){}
  } catch (err) {
    alert("Gagal memperbarui data dari server: " + err.message);
  }
}

function applySettings(set) {
  if (!set) return;
  const loginName = document.getElementById('loginAppName');
  const dashName = document.getElementById('dashAppName');
  const loginDesc = document.getElementById('loginAppDesc');
  const loginLogo = document.getElementById('loginAppLogo');
  const dashLogo = document.getElementById('dashAppLogo');
  const announceText = document.getElementById('announcementText');
  const announceBox = document.getElementById('announcementBoxInBanner');

  if (set.app_name) {
    if (loginName) loginName.innerText = set.app_name;
    if (dashName) dashName.innerText = set.app_name;
  }
  if (set.app_description && loginDesc) {
    loginDesc.innerText = set.app_description;
  }
  if (set.app_logo) {
    if (loginLogo) loginLogo.src = set.app_logo;
    if (dashLogo) dashLogo.src = set.app_logo;
  }
  if (set.app_announcement && set.app_announcement.trim() !== '') {
    if (announceText) announceText.innerText = set.app_announcement;
    if (announceBox) announceBox.classList.remove('d-none');
  } else if (announceBox) {
    announceBox.classList.add('d-none');
  }

  const elName = document.getElementById('setAppName');
  const elLogo = document.getElementById('setAppLogo');
  const elDesc = document.getElementById('setAppDesc');
  const elAnnounce = document.getElementById('setAnnounce');
  const elContact = document.getElementById('setContact');

  if (elName) elName.value = set.app_name || '';
  if (elLogo) elLogo.value = set.app_logo || '';
  if (elDesc) elDesc.value = set.app_description || '';
  if (elAnnounce) elAnnounce.value = set.app_announcement || '';
  if (elContact) elContact.value = set.contact_info || '';
}

function updateActionButtonState(statusAbsen) {
  const btnIn = document.getElementById('btnCheckIn');
  const btnOut = document.getElementById('btnCheckOut');
  const doneAlert = document.getElementById('statusDoneAlert');
  const liburAlert = document.getElementById('statusLiburAlert');
  const izinAlert = document.getElementById('statusIzinAlert');
  const banner = document.getElementById('bannerPeringatanPresensi');
  const titlePeringatan = document.getElementById('titlePeringatanPresensi');
  const textPeringatan = document.getElementById('textPeringatanPresensi');
  const iconPeringatan = document.getElementById('iconPeringatanPresensi');

  if (btnIn) { btnIn.classList.add('d-none'); btnIn.disabled = true; }
  if (btnOut) { btnOut.classList.add('d-none'); btnOut.disabled = true; }
  if (doneAlert) doneAlert.classList.add('d-none');
  if (liburAlert) liburAlert.classList.add('d-none');
  if (izinAlert) izinAlert.classList.add('d-none');
  if (banner) banner.classList.add('d-none');

  const petunjukGPS = "<b>Penting:</b> Pastikan fitur <b>GPS HP aktif</b> sebelum presensi.<br>⏰ <b>Jam Masuk Normal:</b> Maksimal jam <b>08.15 WIB</b>. Presensi di atas jam 08.15 dicatat TERLAMBAT.";

  if (statusAbsen === 'SEDANG_IZIN') {
    if (izinAlert) izinAlert.classList.remove('d-none');
    if (btnIn) { btnIn.classList.remove('d-none'); btnIn.disabled = true; }
    if (banner) {
      banner.className = "alert alert-warning border-0 shadow-sm mb-4";
      iconPeringatan.innerText = "📝";
      titlePeringatan.innerText = "Status: Sedang Izin / Cuti Hari Ini";
      textPeringatan.innerHTML = "Anda dalam masa izin atau cuti yang telah disetujui. Tombol presensi dinonaktifkan.";
      banner.classList.remove('d-none');
    }
  } else if (statusAbsen === 'HARI_LIBUR_OPSIONAL') {
    if (liburAlert) liburAlert.classList.remove('d-none');
    if (btnIn) { btnIn.classList.remove('d-none'); btnIn.disabled = false; }
    if (banner) {
      banner.className = "alert alert-info border-0 shadow-sm mb-4";
      iconPeringatan.innerText = "📅";
      titlePeringatan.innerText = "Informasi: Jadwal Libur Rutin";
      textPeringatan.innerHTML = `Hari ini adalah jadwal libur rutin Anda. Presensi bersifat opsional.<br>${petunjukGPS}`;
      banner.classList.remove('d-none');
    }
  } else if (statusAbsen === 'BELUM_ABSEN') {
    if (btnIn) { btnIn.classList.remove('d-none'); btnIn.disabled = false; }
    if (banner) {
      banner.className = "alert alert-warning border-0 shadow-sm mb-4";
      iconPeringatan.innerText = "⚠️";
      titlePeringatan.innerText = "Perhatian: Anda Belum Check-In Masuk!";
      textPeringatan.innerHTML = `Silakan lakukan Check-in lokasi presensi sekarang untuk mencatat kehadiran hari ini.<br>${petunjukGPS}`;
      banner.classList.remove('d-none');
    }
  } else if (statusAbsen === 'SUDAH_CHECKIN') {
    if (btnOut) { 
      btnOut.classList.remove('d-none'); 
      updateTombolCheckOutUI();
    }
    if (banner) {
      banner.className = "alert alert-info border-0 shadow-sm mb-4";
      iconPeringatan.innerText = "🔔";
      titlePeringatan.innerText = "Pengingat: Jangan Lupa Check-Out Keluar";
      textPeringatan.innerHTML = `Anda telah Check-in masuk.<br>⏰ <b>Batas Check-Out:</b> Tombol aktif pukul 14:00 WIB.<br>⚠️ <i>Check-Out sebelum 16:30 WIB dihitung SETENGAH HARI (0.5 hari kerja).</i>`;
      banner.classList.remove('d-none');
    }
  } else if (statusAbsen === 'SUDAH_CHECKOUT') {
    if (doneAlert) doneAlert.classList.remove('d-none');
    if (banner) {
      banner.className = "alert alert-success border-0 shadow-sm mb-4";
      iconPeringatan.innerText = "✔";
      titlePeringatan.innerText = "Presensi Hari Ini Selesai";
      textPeringatan.innerHTML = "Terima kasih! Anda telah menyelesaikan presensi Check-in dan Check-out untuk hari ini.";
      banner.classList.remove('d-none');
    }
  }
}

function renderCardJadwalHariIni(jdw) {
  const card = document.getElementById('cardJadwalHariIni');
  if (!card) return;
  if (!jdw) {
    card.classList.add('d-none');
    return;
  }
  const getEmpName = (id) => {
    if (!id) return '-';
    const found = (GLOBAL_DATA.allKaryawanPublic || []).find(e => String(e.id_karyawan) === String(id));
    return found ? found.nama_lengkap : id;
  };
  let textTim = `<b>Sopir:</b> ${getEmpName(jdw.id_sopir)} | <b>Kenek:</b> ${getEmpName(jdw.id_kenek)}`;
  if (jdw.id_gudang) {
    textTim += ` | <b>Bantuan:</b> ${getEmpName(jdw.id_gudang)}`;
  }
  document.getElementById('badgePeranJadwal').innerText = `Jadwal Distribusi: ${jdw.peran_user}`;
  document.getElementById('titleAreaJadwal').innerText = jdw.nama_area;
  document.getElementById('detailJadwalTim').innerHTML = textTim;
  document.getElementById('detailJadwalNopol').innerText = `Armada: ${jdw.nopol} ${jdw.keterangan ? ' ('+jdw.keterangan+')' : ''}`;
  card.classList.remove('d-none');
}

function renderRingkasanGaji(data) {
  if (!data || (CURRENT_USER && CURRENT_USER.role === 'Staf Admin Cabang')) return;

  if (data.periodeMingguIni) {
    const payStart = document.getElementById('payStart');
    const payEnd = document.getElementById('payEnd');
    if (payStart && !payStart.value) payStart.value = data.periodeMingguIni.mulai;
    if (payEnd && !payEnd.value) payEnd.value = data.periodeMingguIni.selesai;

    const txtPeriode = document.getElementById('periodeGajiText');
    if (txtPeriode) {
      txtPeriode.innerText = `Periode: ${formatDisplayDate(data.periodeMingguIni.mulai)} s/d ${formatDisplayDate(data.periodeMingguIni.selesai)}`;
    }
    
    const modalPeriode = document.getElementById('modalGajiPeriodeText');
    if (modalPeriode) {
      modalPeriode.innerText = `${formatDisplayDate(data.periodeMingguIni.mulai)} - ${formatDisplayDate(data.periodeMingguIni.selesai)}`;
    }
  }

  if (data.gajiMingguIni) {
    const g = data.gajiMingguIni;
    const nominalEl = document.getElementById('nominalGajiMingguIni');
    const infoEl = document.getElementById('infoKehadiranGaji');
    const lainLainEl = document.getElementById('modalGajiLainLainText');

    if (nominalEl) {
      nominalEl.innerText = `Rp ${Number(g.total_diterima || 0).toLocaleString('id-ID')}`;
    }

    if (lainLainEl) {
      lainLainEl.innerText = `Rp ${Number(g.lain_lain || 0).toLocaleString('id-ID')}`;
    }

    if (infoEl) {
      infoEl.innerText = `Rp ${Number(g.potongan_kasbon || g.potongan || 0).toLocaleString('id-ID')}`;
    }

    const boxBadgeModal = document.getElementById('badgeKehadiranMingguIniModal');
    if (boxBadgeModal) {
      boxBadgeModal.innerHTML = `
        <span class="badge bg-success p-2"><i class="bi bi-check-circle"></i> Hadir: ${g.total_hadir || 0} Hari</span>
        <span class="badge bg-warning text-dark p-2"><i class="bi bi-file-text"></i> Izin/Cuti: ${g.total_izin || 0} Hari</span>
        <span class="badge bg-danger p-2"><i class="bi bi-x-circle"></i> Alpha: ${g.total_alpha || 0} Hari</span>
      `;
    }
  }
}

function handleCheckOutClick() {
  const now = new Date();
  const jam = now.getHours();
  const menit = now.getMinutes();
  
  const totalMenitNow = (jam * 60) + menit;
  const batasCheckOutAwal = 14 * 60;
  const batasPulangCepat = (16 * 60) + 30;

  if (totalMenitNow < batasCheckOutAwal) {
    if (typeof showToast === 'function') {
      showToast('⚠️ Tombol Check-Out baru dapat aktif setelah pukul 14:00 WIB!', 'warning');
    } else {
      alert('⚠️ Tombol Check-Out baru dapat aktif setelah pukul 14:00 WIB!');
    }
    return;
  }

  if (totalMenitNow < batasPulangCepat) {
    const konfirmasi = confirm(
      "⚠️ PERINGATAN PULANG CEPAT!\n\n" +
      "Anda melakukan Check-Out sebelum pukul 16:30 WIB.\n" +
      "Kehadiran hari ini akan dihitung SETENGAH HARI (0.5 hari kerja).\n\n" +
      "Apakah Anda yakin ingin melanjutkan Check-Out?"
    );
    
    if (!konfirmasi) return;
  }

  if (typeof kirimPresensi === 'function') {
    kirimPresensi('OUT');
  } else if (typeof handlePresensiSubmit === 'function') {
    handlePresensiSubmit('OUT');
  }
}

function updateTombolCheckOutUI() {
  const btnOut = document.getElementById('btnCheckOut');
  if (!btnOut) return;

  const now = new Date();
  const totalMenitNow = (now.getHours() * 60) + now.getMinutes();
  const batas1400 = 14 * 60;

  if (totalMenitNow < batas1400) {
    btnOut.disabled = true;
    btnOut.classList.add('disabled');
    btnOut.title = "Check-Out baru aktif pukul 14:00 WIB";
  } else {
    btnOut.disabled = false;
    btnOut.classList.remove('disabled');
    btnOut.title = "";
  }
}

function showModalEstimasiGaji() {
  const user = (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) ? CURRENT_USER : (window.CURRENT_USER || {});
  const rawId = String(user.id_karyawan || user.id || '123');
  const validPasscode = rawId.slice(-3);

  const inputPin = prompt('🔒 Masukkan 3 digit PIN privasi (3 digit terakhir ID Karyawan):');
  if (inputPin === null) return;

  if (inputPin.trim() !== validPasscode) {
    alert('⚠️ PIN/Passcode salah! Akses ditolak.');
    return;
  }

  const modalEl = document.getElementById('modalEstimasiGaji');
  if (modalEl) {
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();
  }
}

function filterEmployeeOptionsBySelected(excludeIds = []) {
  let opts = '<option value="">-- Pilih Karyawan --</option>';
  const isCabangScope = (CURRENT_USER.role === 'Admin Cabang' || CURRENT_USER.role === 'Staf Admin Cabang');
  if (GLOBAL_DATA.allKaryawanPublic) {
    GLOBAL_DATA.allKaryawanPublic.forEach(e => {
      if (isCabangScope && String(e.id_cabang) !== String(CURRENT_USER.id_cabang)) return;
      if (excludeIds.includes(String(e.id_karyawan))) return;
      let labelPos = e.posisi ? ` [${e.posisi}]` : '';
      opts += `<option value="${e.id_karyawan}">${e.nama_lengkap}${labelPos} (${e.id_karyawan})</option>`;
    });
  }
  return opts;
}

function updateJadwalDropdownsDynamic() {
  const selectedSopir = document.getElementById('jdwSopir')?.value || '';
  const selectedKenek = document.getElementById('jdwKenek')?.value || '';
  const selectedGudang = document.getElementById('jdwGudang')?.value || '';

  const elSopir = document.getElementById('jdwSopir');
  const elKenek = document.getElementById('jdwKenek');
  const elGudang = document.getElementById('jdwGudang');

  if (elSopir) {
    elSopir.innerHTML = filterEmployeeOptionsBySelected([selectedKenek, selectedGudang]);
    elSopir.value = selectedSopir;
  }
  if (elKenek) {
    elKenek.innerHTML = filterEmployeeOptionsBySelected([selectedSopir, selectedGudang]);
    elKenek.value = selectedKenek;
  }
  if (elGudang) {
    let gOpts = '<option value="">-- Tidak Ada (Kondisi Normal) --</option>' + filterEmployeeOptionsBySelected([selectedSopir, selectedKenek]).replace('<option value="">-- Pilih Karyawan --</option>', '');
    elGudang.innerHTML = gOpts;
    elGudang.value = selectedGudang;
  }
}

function populateDropdowns() {
  let empOpts = filterEmployeeOptionsBySelected([]);
  let empLiburOpts = '<option value="ALL">Semua Karyawan (Libur Nasional)</option>';

  if (GLOBAL_DATA.allKaryawanPublic) {
    const isCabangScope = (CURRENT_USER.role === 'Admin Cabang' || CURRENT_USER.role === 'Staf Admin Cabang');
    GLOBAL_DATA.allKaryawanPublic.forEach(e => {
      if (isCabangScope && String(e.id_cabang) !== String(CURRENT_USER.id_cabang)) return;
      empLiburOpts += `<option value="${e.id_karyawan}">${e.nama_lengkap} (${e.id_karyawan})</option>`;
    });

    if (document.getElementById('kasbonEmpId')) document.getElementById('kasbonEmpId').innerHTML = empOpts;
    if (document.getElementById('liburEmpId')) document.getElementById('liburEmpId').innerHTML = empLiburOpts;
    updateJadwalDropdownsDynamic();
  }

  let cabOpts = '';
  let payCabOpts = '';
  let cfgCabOpts = '<option value="Semua">Semua Cabang (Global)</option>';

  if (CURRENT_USER.role === 'Admin' || CURRENT_USER.role === 'HRD') {
    payCabOpts = '<option value="ALL">Semua Cabang</option>';
  }

  if (GLOBAL_DATA.cabang) {
    GLOBAL_DATA.cabang.forEach(c => {
      const idCab = c.id_cabang || c.tb_cabang || '';
      const namaCab = c.nama_cabang || idCab;

      cabOpts += `<option value="${idCab}">${namaCab}</option>`;
      payCabOpts += `<option value="${idCab}">${namaCab}</option>`;
      cfgCabOpts += `<option value="${idCab}">${namaCab}</option>`;
    });

    if (document.getElementById('empCabang')) document.getElementById('empCabang').innerHTML = cabOpts;
    if (document.getElementById('adminCabangSelector')) document.getElementById('adminCabangSelector').innerHTML = cabOpts;

    if (document.getElementById('cfgCabangRuleUmum')) document.getElementById('cfgCabangRuleUmum').innerHTML = cfgCabOpts;
    if (document.getElementById('cfgCabangInsentifKhusus')) document.getElementById('cfgCabangInsentifKhusus').innerHTML = cfgCabOpts;

    const selectPayCab = document.getElementById('payCabangFilter');
    if (selectPayCab) {
      selectPayCab.innerHTML = payCabOpts;
      if (CURRENT_USER.role === 'Admin Cabang' || CURRENT_USER.role === 'Staf Admin Cabang') {
        selectPayCab.value = CURRENT_USER.id_cabang;
        selectPayCab.disabled = true;
      } else {
        selectPayCab.disabled = false;
      }
    }
  }

  let areaOpts = '<option value="">-- Pilih Area Tujuan --</option>';
  if (GLOBAL_DATA.area) {
    GLOBAL_DATA.area.forEach(a => {
      areaOpts += `<option value="${a.id_area}">${a.nama_area}</option>`;
    });
    if (document.getElementById('jdwArea')) document.getElementById('jdwArea').innerHTML = areaOpts;
    if (document.getElementById('editJdwArea')) document.getElementById('editJdwArea').innerHTML = areaOpts;
  }
}

function showModalTambahJadwal() {
  const selectCabang = document.getElementById('genIdCabang');
  if (selectCabang) {
    let optsCabang = '';
    const isCabangScope = (CURRENT_USER.role === 'Admin Cabang' || CURRENT_USER.role === 'Staf Admin Cabang');
    
    (GLOBAL_DATA.cabang || []).forEach(c => {
      if (isCabangScope && String(c.id_cabang) !== String(CURRENT_USER.id_cabang)) return;
      optsCabang += `<option value="${c.id_cabang}">${c.nama_cabang}</option>`;
    });
    
    selectCabang.innerHTML = optsCabang;
    selectCabang.value = CURRENT_USER.id_cabang || (GLOBAL_DATA.cabang[0] ? GLOBAL_DATA.cabang[0].id_cabang : '');
    if (isCabangScope) selectCabang.disabled = true;
    else selectCabang.disabled = false;
  }

  const today = new Date();
  const day = today.getDay();
  const diffToTuesday = today.getDate() - day + (day < 2 ? -5 : 2);
  const tuesday = new Date(today.setDate(diffToTuesday));

  const inputTgl = document.getElementById('genTglMulai');
  if (inputTgl) {
    inputTgl.value = tuesday.toISOString().split('T')[0];
  }

  buildMingguanRows();
  new bootstrap.Modal(document.getElementById('modalJadwal')).show();
}

// 🟢 DIGANTI DENGAN FETCH API
async function buildMingguanRows() {
  const tglInput = document.getElementById('genTglMulai')?.value;
  const targetCabang = document.getElementById('genIdCabang')?.value;
  const container = document.getElementById('containerRowMingguan');

  if (!container || !tglInput || !targetCabang) return;

  const parts = tglInput.split('-');
  const startDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const hariIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  if (startDate.getDay() !== 2) {
    alert('Tanggal mulai siklus harus jatuh pada hari SELASA!');
    document.getElementById('genTglMulai').value = '';
    container.innerHTML = `<tr><td colspan="6" class="text-center text-danger fw-bold py-3">Silakan pilih tanggal yang jatuh pada hari Selasa.</td></tr>`;
    return;
  }

  container.innerHTML = `<tr><td colspan="6" class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div> Memuat susunan jadwal rutin per area...</td></tr>`;

  try {
    const response = await fetch(`${API_BASE_URL}/api/jadwal-auto?id_cabang=${targetCabang}&tgl_mulai=${tglInput}`);
    const res = await response.json();

    if (!res || res.status !== 'success') {
      alert('Gagal memuat draf jadwal rutin.');
      return;
    }

    const autoData = res.data || [];
    const listKaryawanCabang = (GLOBAL_DATA.allKaryawanPublic || []).filter(e => String(e.id_cabang) === String(targetCabang));
    
    let listAreaCabang = (GLOBAL_DATA.area || []).filter(a => String(a.id_cabang || a.cabang || '').trim() === String(targetCabang).trim());
    if (listAreaCabang.length === 0) listAreaCabang = GLOBAL_DATA.area || [];

    let htmlRows = '';

    for (let i = 0; i < 7; i++) {
      let curDate = new Date(startDate);
      curDate.setDate(startDate.getDate() + i);

      let yyyy = curDate.getFullYear();
      let mm = String(curDate.getMonth() + 1).padStart(2, '0');
      let dd = String(curDate.getDate()).padStart(2, '0');
      let curStr = `${yyyy}-${mm}-${dd}`;
      let namaHari = hariIndo[curDate.getDay()];

      listAreaCabang.forEach((area, indexArea) => {
        let draftItem = autoData.find(d => d.tanggal === curStr && String(d.id_area) === String(area.id_area)) || {};

        let optSopir = `<option value="">-- Pilih Sopir --</option>`;
        listKaryawanCabang.forEach(k => {
          let isLibur = (k.hari_libur_rutin && k.hari_libur_rutin.toLowerCase() === namaHari.toLowerCase());
          let isSelected = String(k.id_karyawan) === String(draftItem.id_sopir || '');
          optSopir += `<option value="${k.id_karyawan}" ${isSelected ? 'selected' : ''} ${isLibur ? 'class="text-danger bg-warning-subtle"' : ''}>
            ${k.nama_lengkap || k.nama} ${isLibur ? '⚠️ (Libur Rutin)' : ''}
          </option>`;
        });

        let optKenek = `<option value="">-- Pilih Kenek --</option>`;
        listKaryawanCabang.forEach(k => {
          let isLibur = (k.hari_libur_rutin && k.hari_libur_rutin.toLowerCase() === namaHari.toLowerCase());
          let isSelected = String(k.id_karyawan) === String(draftItem.id_kenek || '');
          optKenek += `<option value="${k.id_karyawan}" ${isSelected ? 'selected' : ''} ${isLibur ? 'class="text-danger bg-warning-subtle"' : ''}>
            ${k.nama_lengkap || k.nama} ${isLibur ? '⚠️ (Libur Rutin)' : ''}
          </option>`;
        });

        let nopolVal = draftItem.nopol_armada || area.armada_default || '';
        let ketVal = draftItem.keterangan || (draftItem.is_auto_copied ? 'Salinan Minggu Lalu (Cek Ulang)' : '');

        htmlRows += `
          <tr data-tgl="${curStr}">
            ${indexArea === 0 ? `
              <td rowspan="${listAreaCabang.length}" class="fw-bold align-middle bg-light text-center border-end">
                <div class="text-primary">${namaHari}</div>
                <small class="text-muted fw-normal">${curStr}</small>
              </td>
            ` : ''}

            <td class="align-middle fw-bold text-dark">
              <span>${area.nama_area}</span>
              <input type="hidden" class="input-area" value="${area.id_area}">
            </td>

            <td>
              <input type="text" class="form-control form-control-sm input-nopol" value="${nopolVal}" placeholder="Plat Nopol">
            </td>

            <td>
              <select class="form-select form-select-sm input-sopir" onchange="checkLiburWarning(this)">${optSopir}</select>
            </td>

            <td>
              <select class="form-select form-select-sm input-kenek" onchange="checkLiburWarning(this)">${optKenek}</select>
            </td>

            <td>
              <input type="text" class="form-control form-control-sm input-ket" value="${ketVal}" placeholder="Catatan opsional">
            </td>
          </tr>
        `;
      });
    }

    container.innerHTML = htmlRows;
  } catch (err) {
    alert("Gagal memuat jadwal: " + err.message);
  }
}

function autoFillNopolRow(selectEl) {
  const row = selectEl.closest('tr');
  const areaId = selectEl.value;
  const areaObj = (GLOBAL_DATA.area || []).find(a => String(a.id_area) === String(areaId));
  const nopolInput = row.querySelector('.input-nopol');
  if (areaObj && areaObj.nopol_default && nopolInput) {
    nopolInput.value = areaObj.nopol_default;
  }
}

function checkLiburWarning(selectEl) {
  const selectedText = selectEl.options[selectEl.selectedIndex].text;
  if (selectedText.includes('Libur Rutin')) {
    alert('ℹ️ Informasi Opsional: Karyawan ini terdaftar sedang Hari Libur Rutin pada hari tersebut (Akan dicatat sebagai Tugas Lembur/Khusus).');
    selectEl.classList.add('border-warning', 'bg-warning-subtle');
  } else {
    selectEl.classList.remove('border-warning', 'bg-warning-subtle');
  }
}

// 🟢 DIGANTI DENGAN FETCH API
async function handleSaveJadwalMingguan(e) {
  e.preventDefault();
  
  const tglMulai = document.getElementById('genTglMulai').value;
  const idCabang = document.getElementById('genIdCabang').value;
  const rows = document.querySelectorAll('#containerRowMingguan tr');

  const listAreaCabang = (GLOBAL_DATA.area || []).filter(a => String(a.id_cabang) === String(idCabang));
  
  let daftarPenugasan = [];
  let tempNewJadwal = [];
  let areaPerTanggal = {};

  rows.forEach((tr, index) => {
    let tgl = tr.getAttribute('data-tgl');
    let id_area = tr.querySelector('.input-area')?.value;
    let nopol = tr.querySelector('.input-nopol')?.value;
    let id_sopir = tr.querySelector('.input-sopir')?.value;
    let id_kenek = tr.querySelector('.input-kenek')?.value;
    let ket = tr.querySelector('.input-ket')?.value;

    if (!areaPerTanggal[tgl]) {
      areaPerTanggal[tgl] = new Set();
    }

    if (id_area && id_sopir) {
      areaPerTanggal[tgl].add(String(id_area));

      const itemData = {
        tanggal: tgl,
        id_area: id_area,
        nopol_armada: nopol || '',
        id_sopir: id_sopir,
        id_kenek: id_kenek || '',
        keterangan: ket || ''
      };
      
      daftarPenugasan.push(itemData);

      tempNewJadwal.push({
        id_jadwal: 'TEMP_' + Date.now() + '_' + index,
        tanggal: tgl,
        id_cabang: idCabang,
        id_foreman: CURRENT_USER.id_karyawan,
        id_sopir: id_sopir,
        id_kenek: id_kenek || '',
        id_gudang: '',
        id_area: id_area,
        nopol_armada: nopol || '',
        keterangan: ket || ''
      });
    }
  });

  let tanggalBelumLengkap = [];

  for (let tgl in areaPerTanggal) {
    const areaTerisi = areaPerTanggal[tgl];
    
    if (areaTerisi.size < listAreaCabang.length) {
      const areaKosong = listAreaCabang
        .filter(a => !areaTerisi.has(String(a.id_area)))
        .map(a => a.nama_area)
        .join(', ');

      const tglFormatted = (typeof formatDisplayDate === 'function') ? formatDisplayDate(tgl) : tgl;
      tanggalBelumLengkap.push(`\n• Tanggal ${tglFormatted}: Belum diisi area (${areaKosong})`);
    }
  }

  if (tanggalBelumLengkap.length > 0) {
    const pesanPeringatan = "⚠️ Jadwal Belum Lengkap!\nSemua area harus terjadwal di setiap hari.\n" + tanggalBelumLengkap.join('');
    
    if (typeof showToast === 'function') {
      showToast('⚠️ Masih ada area yang belum terjadwal! Silakan periksa kembali.', 'danger');
    }
    alert(pesanPeringatan);
    return;
  }

  if (daftarPenugasan.length === 0) {
    return showToast('Harap isi penugasan jadwal secara lengkap!', 'warning');
  }

  if (!GLOBAL_DATA.jadwal) GLOBAL_DATA.jadwal = [];
  
  const datesToReplace = tempNewJadwal.map(t => t.tanggal);
  GLOBAL_DATA.jadwal = GLOBAL_DATA.jadwal.filter(j => !(String(j.id_cabang) === String(idCabang) && datesToReplace.includes(j.tanggal)));
  GLOBAL_DATA.jadwal.push(...tempNewJadwal);

  renderAllTables();
  bootstrap.Modal.getInstance(document.getElementById('modalJadwal')).hide();
  showToast('⚡ Jadwal mingguan lengkap berhasil diterapkan!');

  const payload = {
    tgl_mulai: tglMulai,
    id_cabang: idCabang,
    id_foreman: CURRENT_USER.id_karyawan,
    daftar_penugasan: daftarPenugasan
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/jadwal-mingguan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const res = await response.json();
    if (res && res.status === 'success') {
      showToast('✔️ Data tersinkronisasi sempurna ke Cloud Database.');
    } else {
      showToast('⚠️ Gagal sinkronisasi: ' + (res ? res.message : 'Unknown error'), 'danger');
      loadAppData();
    }
  } catch (err) {
    showToast('❌ Koneksi terputus saat menyimpan ke database!', 'danger');
    loadAppData();
  }
}

function autoFillNopolDefault(isEdit = false) {
  const areaId = document.getElementById(isEdit ? 'editJdwArea' : 'jdwArea').value;
  const areaObj = (GLOBAL_DATA.area || []).find(a => String(a.id_area) === String(areaId));
  if (areaObj && areaObj.nopol_default) {
    document.getElementById(isEdit ? 'editJdwNopol' : 'jdwNopol').value = areaObj.nopol_default;
  }
}

function openEditJadwalModal(idJadwal) {
  const jdw = (GLOBAL_DATA.jadwal || []).find(j => String(j.id_jadwal) === String(idJadwal));
  if (!jdw) return alert("Data jadwal tidak ditemukan!");

  document.getElementById('editJdwId').value = jdw.id_jadwal;
  document.getElementById('editJdwTglText').innerText = formatDisplayDate(jdw.tanggal);

  const targetCabang = jdw.id_cabang || CURRENT_USER.id_cabang;

  const filterEmployeeByCabang = (excludeIds = []) => {
    let opts = '<option value="">-- Pilih Karyawan --</option>';
    if (GLOBAL_DATA.allKaryawanPublic) {
      GLOBAL_DATA.allKaryawanPublic.forEach(e => {
        if (String(e.id_cabang) !== String(targetCabang)) return;
        if (excludeIds.includes(String(e.id_karyawan))) return;
        
        let labelPos = e.posisi ? ` [${e.posisi}]` : '';
        opts += `<option value="${e.id_karyawan}">${e.nama_lengkap}${labelPos} (${e.id_karyawan})</option>`;
      });
    }
    return opts;
  };

  const empOpts = filterEmployeeByCabang([]);
  document.getElementById('editJdwSopir').innerHTML = empOpts;
  document.getElementById('editJdwKenek').innerHTML = empOpts;
  document.getElementById('editJdwGudang').innerHTML = '<option value="">-- Tidak Ada --</option>' + empOpts.replace('<option value="">-- Pilih Karyawan --</option>', '');

  document.getElementById('editJdwSopir').value = jdw.id_sopir || '';
  document.getElementById('editJdwKenek').value = jdw.id_kenek || '';
  document.getElementById('editJdwGudang').value = jdw.id_gudang || '';
  document.getElementById('editJdwArea').value = jdw.id_area || '';
  document.getElementById('editJdwNopol').value = jdw.nopol_armada || '';
  document.getElementById('editJdwKet').value = jdw.keterangan || '';

  new bootstrap.Modal(document.getElementById('modalEditJadwal')).show();
}

// 🟢 DIGANTI DENGAN FETCH API
async function handleEditJadwalSubmit(e) {
  e.preventDefault();

  const idJadwal = document.getElementById('editJdwId').value;
  const updatedData = {
    id_jadwal: idJadwal,
    id_sopir: document.getElementById('editJdwSopir').value,
    id_kenek: document.getElementById('editJdwKenek').value,
    id_gudang: document.getElementById('editJdwGudang').value || '',
    id_area: document.getElementById('editJdwArea').value,
    nopol_armada: document.getElementById('editJdwNopol').value,
    keterangan: document.getElementById('editJdwKet').value
  };

  const idx = (GLOBAL_DATA.jadwal || []).findIndex(j => String(j.id_jadwal) === String(idJadwal));
  if (idx !== -1) {
    Object.assign(GLOBAL_DATA.jadwal[idx], updatedData);
  }

  renderAllTables();
  bootstrap.Modal.getInstance(document.getElementById('modalEditJadwal')).hide();
  showToast('⚡ Perubahan jadwal langsung diterapkan!');

  try {
    const response = await fetch(`${API_BASE_URL}/api/jadwal`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData)
    });
    const res = await response.json();

    if (res && res.status === 'success') {
      showToast('✔️ Perubahan jadwal tersimpan di server.');
    } else {
      showToast('⚠️ Gagal update: ' + (res ? res.message : 'Eror'), 'danger');
      loadAppData();
    }
  } catch (err) {
    showToast('❌ Gagal terhubung ke server!', 'danger');
    loadAppData();
  }
}

// 🟢 DIGANTI DENGAN FETCH API
async function deleteJadwal(idJadwal) {
  if (confirm('Hapus penugasan operasional ini?')) {
    if (GLOBAL_DATA.jadwal) {
      GLOBAL_DATA.jadwal = GLOBAL_DATA.jadwal.filter(j => String(j.id_jadwal) !== String(idJadwal));
    }
    
    renderAllTables();
    showToast('⚡ Jadwal berhasil dihapus!');

    try {
      const response = await fetch(`${API_BASE_URL}/api/jadwal/${idJadwal}`, { method: 'DELETE' });
      const res = await response.json();
      if (res && res.status === 'success') {
        showToast('✔️ Data terhapus permanen dari cloud.');
      } else {
        showToast('⚠️ Gagal menghapus dari server!', 'danger');
        loadAppData();
      }
    } catch (err) {
      showToast('❌ Kesalahan jaringan!', 'danger');
      loadAppData();
    }
  }
}

function showModalTambahArea() {
  new bootstrap.Modal(document.getElementById('modalArea')).show();
}

// 🟢 DIGANTI DENGAN FETCH API
async function handleSaveArea(e) {
  e.preventDefault();
  const data = {
    nama_area: document.getElementById('areaNama').value,
    id_cabang: CURRENT_USER.id_cabang,
    nopol_default: document.getElementById('areaNopol').value
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/area`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const res = await response.json();
    alert(res.message);
    if (res.status === 'success') {
      bootstrap.Modal.getInstance(document.getElementById('modalArea')).hide();
      loadAppData();
    }
  } catch (err) {
    alert("Error tambah area: " + err.message);
  }
}

function setupDefaultFilterHistori(data) {
  if (data.periodeMingguIni) {
    const filterStart = document.getElementById('filterHistoriStart');
    const filterEnd = document.getElementById('filterHistoriEnd');
    if (filterStart && !filterStart.value) filterStart.value = data.periodeMingguIni.mulai;
    if (filterEnd && !filterEnd.value) filterEnd.value = data.periodeMingguIni.selesai;
  }
}

function resetFilterHistori() {
  if (GLOBAL_DATA.periodeMingguIni) {
    document.getElementById('filterHistoriStart').value = GLOBAL_DATA.periodeMingguIni.mulai;
    document.getElementById('filterHistoriEnd').value = GLOBAL_DATA.periodeMingguIni.selesai;
  }
  const searchInput = document.getElementById('filterHistoriSearch');
  if (searchInput) searchInput.value = '';
  filterHistoriAbsen();
}

function filterHistoriAbsen() {
  renderAllTables();
}

function exportPresensiCSV() {
  const isSuperAdmin = (CURRENT_USER.role === 'Admin');
  const isHRD = (CURRENT_USER.role === 'HRD');
  const isAdminCabang = (CURRENT_USER.role === 'Admin Cabang' || CURRENT_USER.role === 'Staf Admin Cabang');
  const isManagement = (isSuperAdmin || isHRD || isAdminCabang);

  const filterStartVal = document.getElementById('filterHistoriStart')?.value;
  const filterEndVal = document.getElementById('filterHistoriEnd')?.value;
  const searchText = (document.getElementById('filterHistoriSearch')?.value || '').toLowerCase();

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += isManagement ? "ID Karyawan,Nama Karyawan,Tanggal,Jam Masuk,Jam Keluar,Status Radius,Kerja Pagi,Uang Makan\n" : "Tanggal,Jam Masuk,Jam Keluar,Status Radius\n";

  if (GLOBAL_DATA.absensi && Array.isArray(GLOBAL_DATA.absensi)) {
    GLOBAL_DATA.absensi.forEach(a => {
      const tglStr = formatDisplayDate(a.tanggal);
      if (filterStartVal && tglStr < filterStartVal) return;
      if (filterEndVal && tglStr > filterEndVal) return;

      let empName = a.id_karyawan;
      const empFound = (GLOBAL_DATA.allKaryawanPublic || []).find(e => String(e.id_karyawan) === String(a.id_karyawan));
      if (empFound) empName = empFound.nama_lengkap;

      if (isManagement && searchText !== '') {
        const matchName = empName.toLowerCase().includes(searchText);
        const matchId = String(a.id_karyawan).toLowerCase().includes(searchText);
        if (!matchName && !matchId) return;
      }

      const jamIn = formatDisplayTime(a.jam_masuk);
      const jamOut = formatDisplayTime(a.jam_keluar);
      const radius = a.status_radius || 'Dalam Radius';
      const isPagi = (a.dapat_kerja_pagi === 'Ya' || a.dapat_kerja_pagi === true) ? 'Ya' : 'Tidak';
      const isMakan = (a.dapat_uang_makan === 'Ya' || a.dapat_uang_makan === true) ? 'Ya' : 'Tidak';

      if (isManagement) {
        csvContent += `"${a.id_karyawan}","${empName}","${tglStr}","${jamIn}","${jamOut}","${radius}","${isPagi}","${isMakan}"\n`;
      } else {
        csvContent += `"${tglStr}","${jamIn}","${jamOut}","${radius}"\n`;
      }
    });
  }

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Laporan_Presensi_${filterStartVal || 'All'}_sd_${filterEndVal || 'All'}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function generateAbsenStatusBadge(absenObj, izinObj, isLiburDay, isPastDate, isToday) {
  if (absenObj) {
    let jamMasukStr = String(absenObj.jam_masuk || absenObj[3] || '').trim();
    let jamKeluarStr = String(absenObj.jam_keluar || absenObj[4] || '').trim();
    let isAutoSystemOut = (jamKeluarStr === '23:59:59');
    let isLate = false;

    if (jamMasukStr) {
      let timeParts = jamMasukStr.split(':');
      if (timeParts.length >= 2) {
        let hour = Number(timeParts[0]);
        let min = Number(timeParts[1]);
        if (hour > 8 || (hour === 8 && min > 15)) isLate = true;
      }
    }

    if (isLiburDay) {
      return `<span class="badge text-white" style="background-color: #6f42c1;">🟣 Libur (Lembur)</span>`;
    } else if (isAutoSystemOut) {
      return `<span class="badge bg-danger">⚠️ Check-Out Otomatis (23.59)</span>`;
    } else if (isLate) {
      return `<span class="badge bg-warning text-dark">⚠️ Terlambat (> 08.15)</span>`;
    } else if (jamMasukStr && jamKeluarStr) {
      return `<span class="badge bg-success">✔ Tepat Waktu</span>`;
    } else {
      return `<span class="badge bg-info text-dark">🔔 Belum Check-Out</span>`;
    }
  } else if (izinObj) {
    return `<span class="badge bg-warning text-dark">📝 Izin / Cuti (${izinObj.jenis || 'Izin'})</span>`;
  } else if (isLiburDay) {
    return `<span class="badge bg-secondary">📅 Libur Rutin / Nasional</span>`;
  } else if (!isPastDate && !isToday) {
    return `<span class="badge bg-light text-dark border">Belum Berjalan</span>`;
  } else {
    return `<span class="badge bg-danger">❌ Alpha (Tidak Absen)</span>`;
  }
}

function renderAllTables() {
  const isSuperAdmin = (CURRENT_USER.role === 'Admin');
  const isHRD = (CURRENT_USER.role === 'HRD');
  const isAdminCabang = (CURRENT_USER.role === 'Admin Cabang' || CURRENT_USER.role === 'Staf Admin Cabang');
  const isManagement = (isSuperAdmin || isHRD || isAdminCabang);

  const getEmpName = (id) => {
    if (!id || id === 'ALL') return '<b>-</b>';
    const list = GLOBAL_DATA.allKaryawanPublic || GLOBAL_DATA.karyawan || [];
    const found = list.find(e => String(e.id_karyawan || e[0]) === String(id));
    return found ? `<b>${found.nama_lengkap || found[1]}</b> <br><small class="text-muted">(${id})</small>` : id;
  };

  const todayStr = formatDisplayDate(new Date());
  const hariIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  let htmlSaya = '';
  if (GLOBAL_DATA.periodeMingguIni) {
    const pStart = GLOBAL_DATA.periodeMingguIni.mulai;
    const parts = pStart.split('-');
    const startDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));

    for (let i = 0; i < 7; i++) {
      let cur = new Date(startDate);
      cur.setDate(startDate.getDate() + i);
      let curStr = formatDisplayDate(cur);
      let namaHari = hariIndo[cur.getDay()];

      let ab = (GLOBAL_DATA.absensi || []).find(a => 
        String(a.id_karyawan) === String(CURRENT_USER.id_karyawan) && formatDisplayDate(a.tanggal) === curStr
      );

      let iz = (GLOBAL_DATA.izin || []).find(z => 
        String(z.id_karyawan) === String(CURRENT_USER.id_karyawan) && 
        z.status === 'Disetujui' &&
        curStr >= formatDisplayDate(z.tgl_mulai) && curStr <= formatDisplayDate(z.tgl_selesai)
      );

      let isLiburRutin = (CURRENT_USER.hari_libur_rutin && CURRENT_USER.hari_libur_rutin.toLowerCase() === namaHari.toLowerCase());
      let isLiburNasional = (GLOBAL_DATA.libur || []).some(l => 
        (String(l.id_karyawan) === String(CURRENT_USER.id_karyawan) || l.id_karyawan === 'ALL') &&
        formatDisplayDate(l.tanggal) === curStr
      );
      let isLiburDay = isLiburRutin || isLiburNasional;

      let jamIn = ab ? formatDisplayTime(ab.jam_masuk) : '-';
      let jamOut = ab ? (ab.jam_keluar && String(ab.jam_keluar).trim() === '23:59:59' ? '<span class="text-danger fw-bold">23:59:59 (Auto)</span>' : formatDisplayTime(ab.jam_keluar)) : '-';

      let badgeHtml = generateAbsenStatusBadge(ab, iz, isLiburDay, curStr < todayStr, curStr === todayStr);

      htmlSaya += `
        <tr class="${curStr === todayStr ? 'table-primary fw-bold' : ''}">
          <td><b>${namaHari}</b>, ${curStr}</td>
          <td class="text-success fw-bold">${jamIn}</td>
          <td class="text-danger fw-bold">${jamOut}</td>
          <td>${badgeHtml}</td>
        </tr>
      `;
    }
  }
  if (document.getElementById('tabelRiwayatAbsenSaya')) {
    document.getElementById('tabelRiwayatAbsenSaya').innerHTML = htmlSaya || `<tr><td colspan="4" class="text-center">Belum ada data.</td></tr>`;
  }

  const filterStartVal = document.getElementById('filterHistoriStart')?.value;
  const filterEndVal = document.getElementById('filterHistoriEnd')?.value;
  const searchText = (document.getElementById('filterHistoriSearch')?.value || '').toLowerCase();

  let filteredAbsen = (GLOBAL_DATA.absensi || []).filter(a => {
    const tglStr = formatDisplayDate(a.tanggal);
    if (filterStartVal && tglStr < filterStartVal) return false;
    if (filterEndVal && tglStr > filterEndVal) return false;

    let empFound = (GLOBAL_DATA.allKaryawanPublic || []).find(e => String(e.id_karyawan) === String(a.id_karyawan));
    let empNameText = empFound ? empFound.nama_lengkap : String(a.id_karyawan);

    if (searchText !== '') {
      const matchName = empNameText.toLowerCase().includes(searchText);
      const matchId = String(a.id_karyawan).toLowerCase().includes(searchText);
      if (!matchName && !matchId) return false;
    }
    return true;
  });

  renderTabelHistoriPresensiAdmin(filteredAbsen);

  let htmlJdw = '';
  if (GLOBAL_DATA.jadwal && Array.isArray(GLOBAL_DATA.jadwal)) {
    const today = new Date();
    const day = today.getDay();
    const diffToTuesday = today.getDate() - day + (day < 2 ? -5 : 2);
    const selasaMulai = new Date(today.setDate(diffToTuesday));
    selasaMulai.setHours(0, 0, 0, 0);

    const seninSelesai = new Date(selasaMulai.getTime());
    seninSelesai.setDate(seninSelesai.getDate() + 6);
    seninSelesai.setHours(23, 59, 59, 999);

    const startStr = formatDisplayDate(selasaMulai);
    const endStr = formatDisplayDate(seninSelesai);

    const jadwalMingguIni = GLOBAL_DATA.jadwal.filter(j => {
      const tglJdw = formatDisplayDate(j.tanggal);
      return tglJdw >= startStr && tglJdw <= endStr;
    });

    jadwalMingguIni.forEach(j => {
      let areaObj = (GLOBAL_DATA.area || []).find(a => String(a.id_area) === String(j.id_area));
      let namaArea = areaObj ? areaObj.nama_area : j.id_area;
      let actionBtn = (isSuperAdmin || isAdminCabang) ?
        `<button class="btn btn-sm btn-outline-primary me-1" onclick="openEditJadwalModal('${j.id_jadwal}')">Edit</button><button class="btn btn-sm btn-outline-danger" onclick="deleteJadwal('${j.id_jadwal}')">Hapus</button>` : '-';
      
      htmlJdw += `<tr>
        <td><b>${formatDisplayDate(j.tanggal)}</b></td>
        <td><span class="badge bg-primary">${namaArea}</span></td>
        <td>${getEmpName(j.id_sopir)}</td>
        <td>${getEmpName(j.id_kenek)}</td>
        <td>${j.id_gudang ? getEmpName(j.id_gudang) : '<span class="text-muted small">-</span>'}</td>
        <td><span class="badge bg-secondary">${j.nopol_armada}</span></td>
        <td><small>${j.keterangan || '-'}</small></td>
        <td>${actionBtn}</td>
      </tr>`;
    });
  }

  if (document.getElementById('tabelJadwalDistribusi')) {
    document.getElementById('tabelJadwalDistribusi').innerHTML = htmlJdw || '<tr><td colspan="8" class="text-center">Belum ada penjadwalan operasional untuk minggu berjalan ini.</td></tr>';
  }

  let htmlArea = '';
  if (GLOBAL_DATA.area && Array.isArray(GLOBAL_DATA.area)) {
    GLOBAL_DATA.area.forEach(ar => {
      htmlArea += `<tr><td><b>${ar.id_area}</b></td><td>${ar.nama_area}</td><td>${ar.id_cabang}</td><td><span class="badge bg-secondary">${ar.nopol_default || '-'}</span></td></tr>`;
    });
  }
  if (document.getElementById('tabelAreaDistribusi')) {
    document.getElementById('tabelAreaDistribusi').innerHTML = htmlArea || '<tr><td colspan="4" class="text-center">Belum ada master area.</td></tr>';
  }

  let htmlT = '';
  if (GLOBAL_DATA.tukarLibur && Array.isArray(GLOBAL_DATA.tukarLibur)) {
    GLOBAL_DATA.tukarLibur.forEach(tk => {
      let pemoName = getEmpName(tk.id_pemohon || tk[1]);
      let pengName = getEmpName(tk.id_pengganti || tk[3]);
      let statusVal = tk.status || tk[6] || 'Menunggu Persetujuan';
      let actionBtn = '-';
      if (String(tk.id_pengganti || tk[3]) === String(CURRENT_USER.id_karyawan) && statusVal === 'Menunggu Persetujuan') {
        actionBtn = `<button class="btn btn-sm btn-success me-1" onclick="handleResponTukarLibur('${tk.id_tukar || tk[0]}', 'Disetujui')">Setujui</button><button class="btn btn-sm btn-danger" onclick="handleResponTukarLibur('${tk.id_tukar || tk[0]}', 'Ditolak')">Tolak</button>`;
      }
      htmlT += `<tr><td>${pemoName}</td><td>${formatDisplayDate(tk.tgl_pemohon || tk[2])}</td><td>${pengName}</td><td>${formatDisplayDate(tk.tgl_pengganti || tk[4])}</td><td>${tk.alasan || tk[5] || '-'}</td><td><span class="badge ${statusVal === 'Disetujui' ? 'bg-success' : statusVal === 'Ditolak' ? 'bg-danger' : 'bg-warning text-dark'}">${statusVal}</span></td><td>${actionBtn}</td></tr>`;
    });
  }
  if (document.getElementById('tabelRiwayatTukarLibur')) {
    document.getElementById('tabelRiwayatTukarLibur').innerHTML = htmlT || '<tr><td colspan="7" class="text-center">Belum ada riwayat pengajuan tukar libur.</td></tr>';
  }

  let htmlI = '';
  if (GLOBAL_DATA.izin && Array.isArray(GLOBAL_DATA.izin)) {
    GLOBAL_DATA.izin.forEach(iz => {
      let actionBtn = isSuperAdmin ? `<button class="btn btn-sm btn-outline-primary" onclick="openEditIzinModal('${iz.id_izin || iz[0]}')">Edit Status</button>` : '-';
      let colKaryawan = isManagement ? `<td>${getEmpName(iz.id_karyawan || iz[1])}</td>` : '';
      let statusVal = iz.status || iz[6] || 'Menunggu Persetujuan';
      htmlI += `<tr>${colKaryawan}<td>${formatDisplayDate(iz.tgl_mulai || iz[2])}</td><td>${formatDisplayDate(iz.tgl_selesai || iz[3])}</td><td><span class="badge bg-warning text-dark">${iz.jenis || iz[4]}</span></td><td>${iz.keterangan || iz[5] || '-'}</td><td><span class="badge bg-info text-dark">${statusVal}</span></td><td>${actionBtn}</td></tr>`;
    });
  }
  if (document.getElementById('tabelRiwayatIzin')) {
    document.getElementById('tabelRiwayatIzin').innerHTML = htmlI || `<tr><td colspan="6" class="text-center">Belum ada riwayat izin.</td></tr>`;
  }

  if (document.getElementById('tabelKaryawan') && GLOBAL_DATA.karyawan) {
    let htmlK = '';
    GLOBAL_DATA.karyawan.forEach(k => {
      let actionBtn = (isSuperAdmin || CURRENT_USER.role === 'Admin Cabang') ? `<button class="btn btn-sm btn-outline-primary" onclick="openEditKaryawanModal('${k.id_karyawan}')">Edit</button>` : '-';
      htmlK += `<tr><td><b>${k.id_karyawan}</b></td><td>${k.nama_lengkap}</td><td>${k.posisi || k.jabatan}</td><td>${k.id_cabang}</td><td><span class="badge bg-warning text-dark">${k.hari_libur_rutin || 'Minggu'}</span></td><td>Rp ${Number(k.gaji_harian || 0).toLocaleString()}</td><td>${k.username || '-'}</td><td><span class="badge bg-success">${k.status}</span></td><td>${actionBtn}</td></tr>`;
    });
    document.getElementById('tabelKaryawan').innerHTML = htmlK;
  }

  if (document.getElementById('tabelCabang') && GLOBAL_DATA.cabang) {
    let htmlC = '';
    GLOBAL_DATA.cabang.forEach(c => {
      let actionBtn = isSuperAdmin ? `<button class="btn btn-sm btn-outline-primary" onclick="openEditCabangModal('${c.id_cabang}')">Edit</button>` : '-';
      htmlC += `<tr><td><b>${c.id_cabang}</b></td><td>${c.nama_cabang}</td><td>${c.latitude}</td><td>${c.longitude}</td><td>${c.radius_meter} meter</td><td>${actionBtn}</td></tr>`;
    });
    document.getElementById('tabelCabang').innerHTML = htmlC;
  }

  renderTableACC();

  if (document.getElementById('tabelKasbon') && GLOBAL_DATA.kasbon) {
    let htmlKas = '';
    GLOBAL_DATA.kasbon.forEach(ks => {
      let kName = getEmpName(ks.id_karyawan);
      let nomAwal = Number(ks.nominal || 0);
      let totalCicilan = Number(ks.bayar_cicilan || 0);
      let sisaKas = ks.sisa_kasbon !== '' ? Number(ks.sisa_kasbon) : (nomAwal - totalCicilan);
      htmlKas += `<tr><td><b>${ks.id_kasbon}</b></td><td>${kName}</td><td>${formatDisplayDate(ks.tanggal)}</td><td>Rp ${nomAwal.toLocaleString()}</td><td class="text-success fw-bold">Rp ${totalCicilan.toLocaleString()}</td><td class="text-danger fw-bold">Rp ${sisaKas.toLocaleString()}</td><td>${ks.keterangan || '-'}</td><td><span class="badge ${ks.status === 'Lunas' ? 'bg-success' : 'bg-warning text-dark'}">${ks.status}</span></td></tr>`;
    });
    document.getElementById('tabelKasbon').innerHTML = htmlKas;
  }

  renderPermintaanTukarKaryawan();
  renderTabelJadwal();
}

// 🟢 DIGANTI DENGAN FETCH API
async function showRegisterModal() {
  new bootstrap.Modal(document.getElementById('modalRegister')).show();
  try {
    const response = await fetch(`${API_BASE_URL}/api/cabang-public`);
    const cabangList = await response.json();
    let opts = '<option value="">-- Pilih Cabang Tugas --</option>';
    if (cabangList && cabangList.length > 0) {
      cabangList.forEach(c => { opts += `<option value="${c.id_cabang}">${c.nama_cabang}</option>`; });
    }
    document.getElementById('regCabang').innerHTML = opts;
  } catch (err) {
    console.error("Gagal memuat list cabang:", err);
  }
}

// 🟢 DIGANTI DENGAN FETCH API
async function handleRegister(e) {
  e.preventDefault();
  const data = {
    nama: document.getElementById('regNama').value,
    email: document.getElementById('regEmail').value,
    posisi: document.getElementById('regJabatan').value,
    id_cabang: document.getElementById('regCabang').value,
    hari_libur_rutin: document.getElementById('regHariLibur').value,
    username: document.getElementById('regUser').value,
    password: document.getElementById('regPass').value
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const res = await response.json();
    alert(res.message);
    if (res.status === 'success') bootstrap.Modal.getInstance(document.getElementById('modalRegister')).hide();
  } catch (err) {
    alert("Error pendaftaran: " + err.message);
  }
}

function showTukarLiburModal() {
  const nowStr = new Date().toISOString().split('T')[0];
  document.getElementById('tukarTglPemohon').value = nowStr;
  document.getElementById('tukarTglPengganti').value = nowStr;

  let rekanOpts = '<option value="">-- Pilih Rekan Kerja --</option>';
  if (GLOBAL_DATA.allKaryawanPublic) {
    GLOBAL_DATA.allKaryawanPublic.forEach(k => {
      if (String(k.id_karyawan) !== String(CURRENT_USER.id_karyawan)) {
        rekanOpts += `<option value="${k.id_karyawan}">${k.nama_lengkap} (${k.id_karyawan})</option>`;
      }
    });
  }
  document.getElementById('tukarIdPengganti').innerHTML = rekanOpts;
  new bootstrap.Modal(document.getElementById('modalTukarLibur')).show();
}

// 🟢 DIGANTI DENGAN FETCH API
async function handleFormTukarLibur(e) {
  e.preventDefault();

  const btnSubmit = e.target.querySelector('button[type="submit"]');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Mengirim...';
  }

  const data = {
    id_tukar: 'TKR_' + Date.now(),
    id_pemohon: CURRENT_USER.id_karyawan,
    tgl_pemohon: document.getElementById('tukarTglPemohon').value,
    id_pengganti: document.getElementById('tukarIdPengganti').value,
    tgl_pengganti: document.getElementById('tukarTglPengganti').value,
    alasan: document.getElementById('tukarAlasan').value,
    status: 'Menunggu Persetujuan'
  };

  if (!GLOBAL_DATA.tukarLibur) GLOBAL_DATA.tukarLibur = [];
  GLOBAL_DATA.tukarLibur.unshift(data);

  renderAllTables();

  const modalElem = document.getElementById('modalTukarLibur');
  if (modalElem) {
    const modalInstance = bootstrap.Modal.getInstance(modalElem) || new bootstrap.Modal(modalElem);
    modalInstance.hide();
  }
  e.target.reset();

  if (typeof showToast === 'function') {
    showToast('⚡ Pengajuan tukar libur berhasil dikirim!');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/tukar-libur`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const res = await response.json();

    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = 'Kirim Pengajuan';
    }
    if (res && res.status === 'success') {
      if (typeof showToast === 'function') showToast('✔️ Pengajuan tersimpan di cloud.');
      loadAppData();
    } else {
      if (typeof showToast === 'function') showToast('⚠️ Gagal simpan: ' + (res ? res.message : 'Error'), 'danger');
      loadAppData();
    }
  } catch (err) {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = 'Kirim Pengajuan';
    }
    if (typeof showToast === 'function') showToast('❌ Kesalahan koneksi jaringan!', 'danger');
    loadAppData();
  }
}

function handleResponTukarLibur(idTukar, statusKeputusan) {
  prosesACC_Tukar(idTukar, statusKeputusan);
}

function showIzinModal() {
  const nowStr = new Date().toISOString().split('T')[0];
  document.getElementById('izinStart').value = nowStr;
  document.getElementById('izinEnd').value = nowStr;
  new bootstrap.Modal(document.getElementById('modalIzin')).show();
}

// 🟢 DIGANTI DENGAN FETCH API
async function handleFormIzin(e) {
  e.preventDefault();
  if (GLOBAL_DATA.statusAbsen === 'SUDAH_CHECKIN' || GLOBAL_DATA.statusAbsen === 'SUDAH_CHECKOUT') {
    return showToast('Gagal! Anda sudah melakukan presensi hari ini.', 'warning');
  }

  const data = {
    id_izin: 'IZN_' + Date.now(),
    id_karyawan: CURRENT_USER.id_karyawan,
    tgl_mulai: document.getElementById('izinStart').value,
    tgl_selesai: document.getElementById('izinEnd').value,
    jenis: document.getElementById('izinJenis').value,
    keterangan: document.getElementById('izinKet').value,
    status: 'Menunggu Persetujuan'
  };

  if (!GLOBAL_DATA.izin) GLOBAL_DATA.izin = [];
  GLOBAL_DATA.izin.unshift(data);

  renderAllTables();
  bootstrap.Modal.getInstance(document.getElementById('modalIzin')).hide();
  showToast('⚡ Pengajuan izin dikirim!');

  try {
    const response = await fetch(`${API_BASE_URL}/api/izin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const res = await response.json();

    if (res && res.status === 'success') showToast('✔️ Pengajuan izin tercatat.');
    else { showToast('⚠️ ' + (res ? res.message : 'Error'), 'danger'); loadAppData(); }
  } catch (err) {
    showToast('❌ Terjadi kesalahan server!', 'danger');
    loadAppData();
  }
}

function openEditKaryawanModal(id) {
  const emp = (GLOBAL_DATA.karyawan || []).find(k => String(k.id_karyawan).trim() === String(id).trim());
  if (!emp) return;

  const currentCabang = String(emp.tb_cabang || emp.id_cabang || '').trim();

  document.getElementById('editEmpId').value = emp.id_karyawan || '';
  document.getElementById('editEmpNama').value = emp.nama_lengkap || emp.nama || '';
  document.getElementById('editEmpPosisi').value = emp.posisi || emp.jabatan || '';
  document.getElementById('editEmpEmail').value = emp.email || '';
  document.getElementById('editEmpRole').value = emp.role || 'Karyawan';
  document.getElementById('editEmpHariLibur').value = emp.hari_libur_rutin || 'Minggu';
  document.getElementById('editEmpGaji').value = emp.gaji_harian || 0;
  document.getElementById('editEmpStatus').value = emp.status || 'Aktif';

  if (document.getElementById('editEmpInsentifKhususTetap')) {
    document.getElementById('editEmpInsentifKhususTetap').value = emp.insentif_khusus || 0;
  }

  let cabOpts = '<option value="">-- Pilih Cabang --</option>';
  (GLOBAL_DATA.cabang || []).forEach(c => {
    const cabId = String(c.id_cabang || c.tb_cabang || '').trim();
    const cabNama = c.nama_cabang || cabId;
    const isSelected = (cabId === currentCabang) ? 'selected' : '';
    cabOpts += `<option value="${cabId}" ${isSelected}>${cabNama}</option>`;
  });
  document.getElementById('editEmpCabang').innerHTML = cabOpts;

  new bootstrap.Modal(document.getElementById('modalEditKaryawan')).show();
}

// 🟢 DIGANTI DENGAN FETCH API
async function handleEditKaryawanSubmit(e) {
  e.preventDefault();
  const idEmp = document.getElementById('editEmpId').value;
  const selectedCabang = document.getElementById('editEmpCabang').value;

  const valInsentifKhusus = document.getElementById('editEmpInsentifKhususTetap') ? document.getElementById('editEmpInsentifKhususTetap').value : 0;

  const updatedData = {
    id_karyawan: idEmp,
    nama: document.getElementById('editEmpNama').value,
    posisi: document.getElementById('editEmpPosisi').value,
    tb_cabang: selectedCabang,
    id_cabang: selectedCabang,
    email: document.getElementById('editEmpEmail').value,
    role: document.getElementById('editEmpRole').value,
    hari_libur_rutin: document.getElementById('editEmpHariLibur').value,
    gaji_harian: document.getElementById('editEmpGaji').value,
    insentif_khusus: valInsentifKhusus,
    status: document.getElementById('editEmpStatus').value
  };

  const idx = (GLOBAL_DATA.karyawan || []).findIndex(k => String(k.id_karyawan).trim() === String(idEmp).trim());
  if (idx !== -1) Object.assign(GLOBAL_DATA.karyawan[idx], updatedData);

  const idxPub = (GLOBAL_DATA.allKaryawanPublic || []).findIndex(k => String(k.id_karyawan).trim() === String(idEmp).trim());
  if (idxPub !== -1) Object.assign(GLOBAL_DATA.allKaryawanPublic[idxPub], updatedData);

  renderAllTables();
  populateDropdowns();
  bootstrap.Modal.getInstance(document.getElementById('modalEditKaryawan')).hide();
  showToast('⚡ Data karyawan berhasil diperbarui!');

  try {
    const response = await fetch(`${API_BASE_URL}/api/karyawan`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData)
    });
    const res = await response.json();

    if (res && res.status === 'success') showToast('✔ Update karyawan tersimpan.');
    else { showToast('⚠️ Gagal update: ' + (res ? res.message : 'Unknown error'), 'danger'); loadAppData(); }
  } catch (err) {
    showToast('❌ Gagal terhubung ke server!', 'danger');
    loadAppData();
  }
}

// 🟢 DIGANTI DENGAN FETCH API
async function saveKaryawan(e) {
  e.preventDefault();

  const valInsentifKhusus = document.getElementById('empInsentifKhususTetap') ? document.getElementById('empInsentifKhususTetap').value : 0;

  const data = {
    id_karyawan: 'EMP_' + Date.now(),
    nama_lengkap: document.getElementById('empNama').value,
    posisi: document.getElementById('empPosisi').value,
    id_cabang: document.getElementById('empCabang').value,
    email: document.getElementById('empEmail').value,
    role: document.getElementById('empRole').value,
    hari_libur_rutin: document.getElementById('empHariLibur').value,
    username: document.getElementById('empUser').value,
    password: document.getElementById('empPass').value,
    gaji_harian: document.getElementById('empGaji').value,
    insentif_khusus: valInsentifKhusus,
    status: 'Aktif'
  };

  if (!GLOBAL_DATA.karyawan) GLOBAL_DATA.karyawan = [];
  if (!GLOBAL_DATA.allKaryawanPublic) GLOBAL_DATA.allKaryawanPublic = [];
  
  GLOBAL_DATA.karyawan.push(data);
  GLOBAL_DATA.allKaryawanPublic.push({
    id_karyawan: data.id_karyawan,
    nama_lengkap: data.nama_lengkap,
    posisi: data.posisi,
    id_cabang: data.id_cabang,
    insentif_khusus: data.insentif_khusus,
    hari_libur_rutin: data.hari_libur_rutin
  });

  renderAllTables();
  populateDropdowns();
  bootstrap.Modal.getInstance(document.getElementById('modalKaryawan')).hide();
  showToast('⚡ Data karyawan berhasil ditambahkan!');

  try {
    const response = await fetch(`${API_BASE_URL}/api/karyawan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const res = await response.json();

    if (res && res.status === 'success') showToast('✔️ Karyawan tersimpan di cloud database.');
    else { showToast('⚠️ Gagal simpan karyawan: ' + res.message, 'danger'); loadAppData(); }
  } catch (err) {
    showToast('❌ Kesalahan jaringan!', 'danger');
    loadAppData();
  }
}

function openEditCabangModal(id) {
  const cab = (GLOBAL_DATA.cabang || []).find(c => String(c.id_cabang) === String(id));
  if (!cab) return;

  document.getElementById('editCabId').value = cab.id_cabang;
  document.getElementById('editCabNama').value = cab.nama_cabang;
  document.getElementById('editCabLat').value = cab.latitude;
  document.getElementById('editCabLong').value = cab.longitude;
  document.getElementById('editCabRadius').value = cab.radius_meter;

  new bootstrap.Modal(document.getElementById('modalEditCabang')).show();
}

// 🟢 DIGANTI DENGAN FETCH API
async function handleEditCabangSubmit(e) {
  e.preventDefault();
  const idCab = document.getElementById('editCabId').value;
  const updatedData = {
    id_cabang: idCab,
    nama_cabang: document.getElementById('editCabNama').value,
    latitude: document.getElementById('editCabLat').value,
    longitude: document.getElementById('editCabLong').value,
    radius: document.getElementById('editCabRadius').value
  };

  const idx = (GLOBAL_DATA.cabang || []).findIndex(c => String(c.id_cabang) === String(idCab));
  if (idx !== -1) Object.assign(GLOBAL_DATA.cabang[idx], updatedData);

  renderAllTables();
  populateDropdowns();
  bootstrap.Modal.getInstance(document.getElementById('modalEditCabang')).hide();
  showToast('⚡ Data cabang berhasil diperbarui!');

  try {
    const response = await fetch(`${API_BASE_URL}/api/cabang`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData)
    });
    const res = await response.json();

    if (res && res.status === 'success') showToast('✔️ Perubahan cabang tersimpan.');
    else { showToast('⚠️ Gagal update cabang: ' + res.message, 'danger'); loadAppData(); }
  } catch (err) {
    showToast('❌ Terjadi kesalahan koneksi!', 'danger');
    loadAppData();
  }
}

// 🟢 DIGANTI DENGAN FETCH API
async function saveCabang(e) {
  e.preventDefault();
  const data = {
    id_cabang: 'CAB_' + Date.now(),
    nama_cabang: document.getElementById('cabNama').value,
    latitude: document.getElementById('cabLat').value,
    longitude: document.getElementById('cabLong').value,
    radius: document.getElementById('cabRadius').value
  };

  if (!GLOBAL_DATA.cabang) GLOBAL_DATA.cabang = [];
  GLOBAL_DATA.cabang.push(data);

  renderAllTables();
  populateDropdowns();
  bootstrap.Modal.getInstance(document.getElementById('modalCabang')).hide();
  showToast('⚡ Master Cabang berhasil ditambahkan!');

  try {
    const response = await fetch(`${API_BASE_URL}/api/cabang`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const res = await response.json();

    if (res && res.status === 'success') showToast('✔️ Cabang tersimpan di database.');
    else { showToast('⚠️ Gagal simpan cabang: ' + res.message, 'danger'); loadAppData(); }
  } catch (err) {
    showToast('❌ Gagal terhubung ke server!', 'danger');
    loadAppData();
  }
}

function openEditIzinModal(id) {
  const iz = (GLOBAL_DATA.izin || []).find(i => String(i.id_izin || i[0]) === String(id));
  if (!iz) return;

  document.getElementById('editIzinId').value = iz.id_izin || iz[0];
  document.getElementById('editIzinStatus').value = iz.status || iz[6] || 'Menunggu Persetujuan';

  new bootstrap.Modal(document.getElementById('modalEditIzin')).show();
}

// 🟢 DIGANTI DENGAN FETCH API
async function handleEditIzinSubmit(e) {
  e.preventDefault();
  const idIzin = document.getElementById('editIzinId').value;
  const newStatus = document.getElementById('editIzinStatus').value;

  const idx = (GLOBAL_DATA.izin || []).findIndex(i => String(i.id_izin || i[0]) === String(idIzin));
  if (idx !== -1) {
    if (typeof GLOBAL_DATA.izin[idx] === 'object' && !Array.isArray(GLOBAL_DATA.izin[idx])) {
      GLOBAL_DATA.izin[idx].status = newStatus;
    } else {
      GLOBAL_DATA.izin[idx][6] = newStatus;
    }
  }

  renderAllTables();
  bootstrap.Modal.getInstance(document.getElementById('modalEditIzin')).hide();
  showToast(`⚡ Status perizinan diubah menjadi ${newStatus}!`);

  try {
    const response = await fetch(`${API_BASE_URL}/api/izin/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_izin: idIzin, status: newStatus })
    });
    const res = await response.json();

    if (res && res.status === 'success') showToast('✔️ Status perizinan tersimpan.');
    else { showToast('⚠️ Gagal update status!', 'danger'); loadAppData(); }
  } catch (err) {
    showToast('❌ Kesalahan jaringan!', 'danger');
    loadAppData();
  }
}

function renderTableACC() {
  const containerIzin = document.getElementById('tbodyACC_Izin');
  const containerTukar = document.getElementById('tbodyACC_Tukar');
  
  if (!containerIzin || !containerTukar) return;

  const getEmpNameLocal = (id) => {
    if (!id || id === 'ALL') return '<b>-</b>';
    const list = GLOBAL_DATA.allKaryawanPublic || GLOBAL_DATA.karyawan || [];
    const found = list.find(e => String(e.id_karyawan || e[0]) === String(id));
    return found ? `<b>${found.nama_lengkap || found[1]}</b> <br><small class="text-muted">(${id})</small>` : id;
  };

  const listIzin = GLOBAL_DATA.izin || [];
  if (!Array.isArray(listIzin) || listIzin.length === 0) {
    containerIzin.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Tidak ada pengajuan izin.</td></tr>';
  } else {
    containerIzin.innerHTML = listIzin.map((item) => {
      const idIzin = item.id_izin || item[0];
      const idEmp = item.id_karyawan || item[1];
      const tglMulai = formatDisplayDate(item.tgl_mulai || item[2]);
      const tglSelesai = formatDisplayDate(item.tgl_selesai || item[3]);
      const jenis = item.jenis || item[4];
      const ket = item.keterangan || item[5] || '-';
      const status = item.status || item[6] || 'Menunggu Persetujuan';
      const badgeClass = status === 'Disetujui' ? 'bg-success' : status === 'Ditolak' ? 'bg-danger' : 'bg-warning text-dark';
      
      return `
        <tr>
          <td><strong>${idIzin}</strong></td>
          <td>${getEmpNameLocal(idEmp)}</td>
          <td>${tglMulai} s/d ${tglSelesai}</td>
          <td><span class="badge bg-info text-dark">${jenis}</span></td>
          <td>${ket}</td>
          <td><span class="badge ${badgeClass}">${status}</span></td>
          <td class="text-end">
            ${status === 'Menunggu Persetujuan' ? `
              <button class="btn btn-sm btn-success me-1" onclick="prosesACC_Izin('${idIzin}', 'Disetujui')">
                <i class="bi bi-check-lg"></i> ACC
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="prosesACC_Izin('${idIzin}', 'Ditolak')">
                <i class="bi bi-x-lg"></i> Tolak
              </button>
            ` : `<small class="text-muted">Selesai</small>`}
          </td>
        </tr>`;
    }).join('');
  }

  const listTukar = GLOBAL_DATA.tukarLibur || [];
  let pendingCountForMe = 0;

  if (!Array.isArray(listTukar) || listTukar.length === 0) {
    containerTukar.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Tidak ada pengajuan tukar libur.</td></tr>';
  } else {
    containerTukar.innerHTML = listTukar.map(tk => {
      const idTukar = tk.id_tukar || tk[0];
      const idPemohon = tk.id_pemohon || tk[1];
      const tglPemohon = formatDisplayDate(tk.tgl_pemohon || tk[2]);
      const idPengganti = tk.id_pengganti || tk[3];
      const tglPengganti = formatDisplayDate(tk.tgl_pengganti || tk[4]);
      const alasan = tk.alasan || tk[5] || '-';
      const status = tk.status || tk[6] || 'Menunggu Persetujuan';

      const isPengganti = String(idPengganti).trim() === String(CURRENT_USER.id_karyawan).trim();
      const isManagement = (CURRENT_USER.role === 'Admin' || CURRENT_USER.role === 'HRD' || CURRENT_USER.role === 'Admin Cabang');
      
      if (isPengganti && status === 'Menunggu Persetujuan') {
        pendingCountForMe++;
      }

      const canApprove = (isPengganti || isManagement) && status === 'Menunggu Persetujuan';
      const badgeClass = status === 'Disetujui' ? 'bg-success' : status === 'Ditolak' ? 'bg-danger' : 'bg-warning text-dark';

      return `
        <tr>
          <td><strong>${idTukar}</strong></td>
          <td>${getEmpNameLocal(idPemohon)} <br><small class="text-primary">(${tglPemohon})</small></td>
          <td>${getEmpNameLocal(idPengganti)} <br><small class="text-primary">(${tglPengganti})</small></td>
          <td>${alasan}</td>
          <td><span class="badge ${badgeClass}">${status}</span></td>
          <td class="text-end">
            ${canApprove ? `
              <button class="btn btn-sm btn-success me-1" onclick="prosesACC_Tukar('${idTukar}', 'Disetujui')">
                <i class="bi bi-check-lg"></i> ACC
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="prosesACC_Tukar('${idTukar}', 'Ditolak')">
                <i class="bi bi-x-lg"></i> Tolak
              </button>
            ` : status === 'Menunggu Persetujuan' ? `
              <small class="text-muted"><i class="bi bi-hourglass-split"></i> Menunggu Rekan/Admin</small>
            ` : `
              <small class="text-muted">Selesai</small>
            `}
          </td>
        </tr>`;
    }).join('');
  }

  const badgeElem = document.getElementById('badgePendingACC');
  if (badgeElem) {
    if (pendingCountForMe > 0) {
      badgeElem.textContent = pendingCountForMe;
      badgeElem.classList.remove('d-none');
    } else {
      badgeElem.classList.add('d-none');
    }
  }
}

// 🟢 DIGANTI DENGAN FETCH API
async function prosesACC_Izin(idIzin, newStatus) {
  const idx = (GLOBAL_DATA.izin || []).findIndex(i => String(i.id_izin || i[0]) === String(idIzin));
  if (idx !== -1) {
    if (typeof GLOBAL_DATA.izin[idx] === 'object' && !Array.isArray(GLOBAL_DATA.izin[idx])) {
      GLOBAL_DATA.izin[idx].status = newStatus;
    } else {
      GLOBAL_DATA.izin[idx][6] = newStatus;
    }
  }

  renderTableACC();
  showToast(`⚡ Pengajuan izin ${idIzin} di-set ${newStatus}!`);

  try {
    const response = await fetch(`${API_BASE_URL}/api/izin/acc`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_izin: idIzin, status: newStatus })
    });
    const res = await response.json();

    if (res && res.status === 'success') {
      showToast(`✔️ Status izin berhasil tersimpan di cloud.`);
    } else {
      showToast('⚠️ Gagal memproses: ' + (res ? res.message : 'Error'), 'danger');
      loadAppData();
    }
  } catch (err) {
    showToast('❌ Gangguan koneksi ke server!', 'danger');
    loadAppData();
  }
}

// 🟢 DIGANTI DENGAN FETCH API
async function prosesACC_Tukar(idTukar, newStatus) {
  const idx = (GLOBAL_DATA.tukarLibur || []).findIndex(t => String(t.id_tukar || t[0]) === String(idTukar));
  if (idx !== -1) {
    if (typeof GLOBAL_DATA.tukarLibur[idx] === 'object' && !Array.isArray(GLOBAL_DATA.tukarLibur[idx])) {
      GLOBAL_DATA.tukarLibur[idx].status = newStatus;
    } else {
      GLOBAL_DATA.tukarLibur[idx][6] = newStatus;
    }
  }

  renderTableACC();
  showToast(`⚡ Pengajuan tukar libur ${idTukar} di-set ${newStatus}!`);

  try {
    const response = await fetch(`${API_BASE_URL}/api/tukar-libur/acc`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_tukar: idTukar, status: newStatus })
    });
    const res = await response.json();

    if (res && res.status === 'success') {
      showToast(`✔️ Status tukar libur tersimpan di cloud.`);
    } else {
      showToast('⚠️ Gagal memproses: ' + (res ? res.message : 'Error'), 'danger');
      loadAppData();
    }
  } catch (err) {
    showToast('❌ Gangguan koneksi ke server!', 'danger');
    loadAppData();
  }
}

// 🟢 DIGANTI DENGAN FETCH API
async function saveKasbon(e) {
  e.preventDefault();
  const empId = document.getElementById('kasbonEmpId').value;
  const nom = document.getElementById('kasbonNominal').value;
  const ket = document.getElementById('kasbonKet').value;

  if (!empId) return showToast('Pilih karyawan terlebih dahulu!', 'warning');

  const todayStr = new Date().toISOString().split('T')[0];
  const newKasbon = {
    id_kasbon: 'KSB_' + Date.now(),
    id_karyawan: empId,
    tanggal: todayStr,
    nominal: nom,
    bayar_cicilan: 0,
    sisa_kasbon: nom,
    keterangan: ket,
    status: 'Belum Lunas'
  };

  if (!GLOBAL_DATA.kasbon) GLOBAL_DATA.kasbon = [];
  GLOBAL_DATA.kasbon.unshift(newKasbon);

  renderAllTables();
  document.getElementById('formKasbon').reset();
  showToast('⚡ Transaksi kasbon berhasil dicatat!');

  try {
    const response = await fetch(`${API_BASE_URL}/api/kasbon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_karyawan: empId,
        nominal: nom,
        keterangan: ket,
        created_by: CURRENT_USER.id_karyawan,
        role: CURRENT_USER.role
      })
    });
    const res = await response.json();

    if (res && res.status === 'success') showToast('✔️ Kasbon tersimpan di server.');
    else { showToast('⚠️ Gagal kasbon: ' + res.message, 'danger'); loadAppData(); }
  } catch (err) {
    showToast('❌ Gagal terhubung!', 'danger');
    loadAppData();
  }
}

// 🟢 DIGANTI DENGAN FETCH API
async function kalkulasiPayroll() {
  const elStart = document.getElementById('payStart');
  const elEnd = document.getElementById('payEnd');

  if (!elStart || !elEnd || !elStart.value || !elEnd.value) {
    alert('Pilih periode tanggal terlebih dahulu!');
    return;
  }

  const start = elStart.value;
  const end = elEnd.value;

  const selectPayCab = document.getElementById('payCabangFilter') || document.getElementById('payCabang');
  const selectedCabang = selectPayCab ? selectPayCab.value : 'ALL';

  const btnKalkulasi = document.getElementById('btnKalkulasiPay') || document.getElementById('btnHitungPayroll');
  if (btnKalkulasi) {
    btnKalkulasi.disabled = true;
    btnKalkulasi.innerHTML = 'Menghitung...';
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/payroll/hitung?start=${start}&end=${end}&cabang=${selectedCabang}`);
    const res = await response.json();

    if (btnKalkulasi) {
      btnKalkulasi.disabled = false;
      btnKalkulasi.innerHTML = 'Hitung Rekap Payroll';
    }

    window.TEMP_PAYROLL = res || [];
    renderTabelPayroll();

    const btnSimpan = document.getElementById('btnSimpanPay');
    if (btnSimpan && window.TEMP_PAYROLL.length > 0) {
      btnSimpan.classList.remove('d-none');
    }
  } catch (err) {
    if (btnKalkulasi) {
      btnKalkulasi.disabled = false;
      btnKalkulasi.innerHTML = 'Hitung Rekap Payroll';
    }
    alert('Gagal mengambil payroll: ' + err.message);
  }
}

function bulatkanKeAtasRibuan(nominal) {
  if (!nominal || nominal <= 0) return 0;
  return Math.ceil(nominal / 1000) * 1000;
}

function updateRowPayroll(index) {
  const item = window.TEMP_PAYROLL[index];
  if (!item) return;

  const sub = Number(item.subtotal || 0);
  const lain = Number(item.lain_lain || 0);
  const pot = Number(item.potongan_kasbon || 0);

  const rawTotal = Math.max(0, (sub + lain) - pot);
  const totalRounded = Math.ceil(rawTotal / 1000) * 1000;

  item.total_diterima = totalRounded;

  const elTotal = document.getElementById(`totalDiterima_${index}`);
  if (elTotal) {
    elTotal.innerText = `Rp ${totalRounded.toLocaleString('id-ID')}`;
  }
}

function renderTabelPayroll() {
  const data = window.TEMP_PAYROLL || [];
  let html = '';
  const boxAksi = document.getElementById('boxAksiPayroll');

  if (!data || data.length === 0) {
    html = '<tr><td colspan="10" class="text-center text-muted p-3">Tidak ada data payroll pada periode/cabang ini.</td></tr>';
    if (boxAksi) boxAksi.classList.add('d-none');
  } else {
    data.forEach(function(item, index) {
      const gHarian = Number(item.gaji_harian || 0);
      const sub = Number(item.subtotal || 0);
      const sisaKas = Number(item.total_sisa_kasbon || 0);
      const potKas = Number(item.potongan_kasbon || 0);
      const lain = Number(item.lain_lain || 0);
      const total = Number(item.total_diterima || 0);

      const detailLain = `Pagi: Rp ${Number(item.komponen_pagi || 0).toLocaleString('id-ID')} | Makan: Rp ${Number(item.komponen_makan || 0).toLocaleString('id-ID')} | Overtime: Rp ${Number(item.komponen_overtime || 0).toLocaleString('id-ID')} | Khusus: Rp ${(Number(item.komponen_khusus_tetap || 0) + Number(item.komponen_khusus_syarat || 0)).toLocaleString('id-ID')}`;

      html += `<tr>
        <td><b>${item.nama}</b><br><small class="text-muted">${item.id_karyawan}</small></td>
        <td>${item.posisi || item.jabatan || '-'}</td>
        <td>Rp ${gHarian.toLocaleString('id-ID')}</td>
        <td><span class="badge bg-primary">${item.total_hadir || 0} Hari</span></td>
        <td>Rp ${sub.toLocaleString('id-ID')}</td>
        <td class="text-danger fw-semibold">Rp ${sisaKas.toLocaleString('id-ID')}</td>
        
        <td style="width: 140px;">
          <input type="number" 
                 id="potKasbon_${index}" 
                 class="form-control form-control-sm text-end fw-bold text-danger" 
                 value="${potKas}" 
                 min="0" 
                 max="${sisaKas}"
                 oninput="updateRowPayrollManual(${index})"
                 placeholder="0">
        </td>

        <td>
          <span title="${detailLain}" class="fw-semibold text-primary" style="cursor: help;">
            Rp ${lain.toLocaleString('id-ID')} <i class="bi bi-info-circle small"></i>
          </span>
        </td>
        <td><b class="text-success fs-6" id="totalDiterima_${index}">Rp ${total.toLocaleString('id-ID')}</b></td>

        <td class="text-center">
          <button class="btn btn-sm btn-outline-dark fw-bold px-2 py-1" 
                  onclick="cetakStrukThermal80mm(window.TEMP_PAYROLL[${index}])" 
                  title="Cetak Struk Thermal 80mm">
            🖨️ Struk
          </button>
        </td>
      </tr>`;
    });

    if (boxAksi) {
      boxAksi.classList.remove('d-none');
    }
  }

  const elTabel = document.getElementById('tabelPayroll') || document.getElementById('tbodyPayroll');
  if (elTabel) {
    elTabel.innerHTML = html;
  }
}

function updateRowPayrollManual(index) {
  if (!window.TEMP_PAYROLL || !window.TEMP_PAYROLL[index]) return;

  const potInput = document.getElementById(`potKasbon_${index}`);
  if (!potInput) return;

  let inputVal = potInput.value === '' ? 0 : Number(potInput.value);
  const sisaKasbon = Number(window.TEMP_PAYROLL[index].total_sisa_kasbon || 0);

  if (inputVal < 0) {
    inputVal = 0;
    potInput.value = 0;
  }

  if (inputVal > sisaKasbon) {
    inputVal = sisaKasbon;
    potInput.value = sisaKasbon;
    if (typeof showToast === 'function') {
      showToast('⚠️ Potongan cicilan tidak boleh melebihi sisa kasbon!', 'warning');
    }
  }

  window.TEMP_PAYROLL[index].potongan_kasbon = inputVal;
  updateRowPayroll(index);
}

// 🟢 DIGANTI DENGAN FETCH API
async function prosesSimpanPayroll() {
  const start = document.getElementById('payStart')?.value;
  const end = document.getElementById('payEnd')?.value;
  const dataPayroll = window.TEMP_PAYROLL || [];
  const btnSimpan = document.getElementById('btnSimpanPay');

  if (!dataPayroll || dataPayroll.length === 0) {
    alert("Tidak ada hasil perhitungan payroll untuk disimpan!");
    return;
  }

  if (confirm('Simpan rekap payroll ini? Potongan kasbon yang diinput akan otomatis mengurangi sisa pinjaman karyawan.')) {
    if (btnSimpan) {
      btnSimpan.disabled = true;
      btnSimpan.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Menyimpan...';
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/payroll/simpan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start, end, dataPayroll })
      });
      const res = await response.json();

      if (btnSimpan) {
        btnSimpan.disabled = false;
        btnSimpan.innerHTML = '✔ Simpan Payroll & Potong Saldo Kasbon';
        btnSimpan.classList.remove('d-none');
      }

      if (res && res.status === 'success') {
        alert(res.message || 'Payroll berhasil disimpan!');
        if (res.dataPayroll) {
          window.TEMP_PAYROLL = res.dataPayroll;
        }
        renderTabelPayroll();
      } else {
        alert('Gagal menyimpan: ' + (res ? res.message : 'Respon server kosong'));
      }
    } catch (err) {
      if (btnSimpan) {
        btnSimpan.disabled = false;
        btnSimpan.innerHTML = '✔ Simpan Payroll & Potong Saldo Kasbon';
        btnSimpan.classList.remove('d-none');
      }
      alert('Error Server: ' + err.message);
    }
  }
}

// 🟢 DIGANTI DENGAN FETCH API
async function saveSettings(e) {
  e.preventDefault();
  const settingsData = {
    app_name: document.getElementById('setAppName').value,
    app_logo: document.getElementById('setAppLogo').value,
    app_description: document.getElementById('setAppDesc').value,
    app_announcement: document.getElementById('setAnnounce').value,
    contact_info: document.getElementById('setContact').value
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settingsData)
    });
    const res = await response.json();
    alert(res.message);
    loadAppData();
  } catch (err) {
    alert("Error update pengaturan: " + err.message);
  }
}

function showToast(message, type = 'success') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
  }

  const bgClass = type === 'success' ? 'bg-success' : type === 'warning' ? 'bg-warning text-dark' : 'bg-danger';
  const toastId = 'toast_' + Date.now();
  
  const toastHtml = `
    <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0 show" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body fw-bold">${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>`;

  container.insertAdjacentHTML('beforeend', toastHtml);
  
  setTimeout(() => {
    const el = document.getElementById(toastId);
    if (el) el.remove();
  }, 3000);
}

function renderPermintaanTukarKaryawan() {
  const cardElem = document.getElementById('cardPermintaanTukarLibur');
  const containerList = document.getElementById('listPermintaanTukarKaryawan');
  const badgeElem = document.getElementById('badgeNotifTukarKaryawan');

  if (!cardElem || !containerList) return;

  const listTukar = GLOBAL_DATA.tukarLibur || [];
  
  const requestsForMe = listTukar.filter(tk => {
    const idPengganti = tk.id_pengganti || tk[3];
    const status = tk.status || tk[6] || 'Menunggu Persetujuan';

    return String(idPengganti).trim() === String(CURRENT_USER.id_karyawan).trim() && status === 'Menunggu Persetujuan';
  });

  if (requestsForMe.length === 0) {
    cardElem.classList.add('d-none');
    return;
  }

  cardElem.classList.remove('d-none');
  if (badgeElem) badgeElem.textContent = `${requestsForMe.length} Permintaan`;

  const getEmpNameLocal = (id) => {
    const list = GLOBAL_DATA.allKaryawanPublic || GLOBAL_DATA.karyawan || [];
    const found = list.find(e => String(e.id_karyawan || e[0]) === String(id));
    return found ? (found.nama_lengkap || found[1]) : id;
  };

  containerList.innerHTML = requestsForMe.map(tk => {
    const idTukar = tk.id_tukar || tk[0];
    const idPemohon = tk.id_pemohon || tk[1];
    const tglPemohon = formatDisplayDate(tk.tgl_pemohon || tk[2]);
    const tglPengganti = formatDisplayDate(tk.tgl_pengganti || tk[4]);
    const alasan = tk.alasan || tk[5] || '-';

    return `
      <div class="border rounded p-2 bg-light mb-2 d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-2">
        <div>
          <strong class="text-primary">${getEmpNameLocal(idPemohon)}</strong> mengajak tukar libur.
          <br><small class="text-dark">Libur Dia: <b>${tglPemohon}</b> ➔ Ditukar Ke Libur Anda: <b>${tglPengganti}</b></small>
          <br><small class="text-muted">Alasan: ${alasan}</small>
        </div>
        <div class="d-flex gap-1">
          <button class="btn btn-sm btn-success" onclick="prosesACC_Tukar('${idTukar}', 'Disetujui')">
            <i class="bi bi-check-lg"></i> Setujui (ACC)
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="prosesACC_Tukar('${idTukar}', 'Ditolak')">
            <i class="bi bi-x-lg"></i> Tolak
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function populateScopeOptions() {
  const selectCabang = document.getElementById('cfgTargetCabang');

  if (selectCabang && GLOBAL_DATA.cabang) {
    let opt = '<option value="Semua">Semua Cabang (Global)</option>';
    GLOBAL_DATA.cabang.forEach(c => {
      opt += `<option value="${c.id_cabang}">${c.nama_cabang}</option>`;
    });
    selectCabang.innerHTML = opt;
  }

  renderCheckboxKaryawanByCabang();
}

function renderCheckboxKaryawanByCabang() {
  const selectedCabang = document.getElementById('cfgTargetCabang')?.value || 'Semua';
  const boxKaryawanList = document.getElementById('listKaryawanKhususCheck');

  if (!boxKaryawanList || !GLOBAL_DATA.karyawan) return;

  const filteredList = GLOBAL_DATA.karyawan.filter(k => {
    if (selectedCabang === 'Semua') return true;
    return String(k.id_cabang) === String(selectedCabang);
  });

  if (filteredList.length === 0) {
    boxKaryawanList.innerHTML = '<small class="text-muted p-1">Tidak ada karyawan di cabang ini.</small>';
    return;
  }

  let chk = '';
  filteredList.forEach(k => {
    chk += `
      <div class="form-check form-check-inline me-2 mb-1">
        <input class="form-check-input chk-karyawan-khusus" type="checkbox" id="chk_emp_${k.id_karyawan}" value="${k.id_karyawan}">
        <label class="form-check-label small" for="chk_emp_${k.id_karyawan}">${k.nama_lengkap}</label>
      </div>`;
  });
  boxKaryawanList.innerHTML = chk;
}

function toggleScopeKaryawan() {
  const tipe = document.getElementById('cfgTargetTipe').value;
  const box = document.getElementById('boxKaryawanKhusus');
  if (tipe === 'Khusus') {
    box.classList.remove('d-none');
    renderCheckboxKaryawanKhusus();
  } else {
    box.classList.add('d-none');
  }
}

function renderCheckboxKaryawanKhusus() {
  const store = (typeof GLOBAL_DATA !== 'undefined' && GLOBAL_DATA) ? GLOBAL_DATA : (window.GLOBAL_DATA || {});
  const listKaryawan = store.karyawan || store.tb_karyawan || [];
  const cfg = store.configGaji || {};
  const selectedCabang = document.getElementById('cfgTargetCabang').value;

  let selectedKhusus = [];
  if (Array.isArray(cfg.karyawanKhusus)) {
    selectedKhusus = cfg.karyawanKhusus.map(id => String(id).trim());
  } else if (typeof cfg.karyawanKhusus === 'string') {
    selectedKhusus = cfg.karyawanKhusus.split(',').map(id => id.trim());
  }

  let html = '';
  const filteredEmp = listKaryawan.filter(emp => {
    if (String(emp.status).toLowerCase() !== 'aktif') return false;
    if (selectedCabang !== 'Semua') {
      const empCab = String(emp.id_cabang || emp.tb_cabang || '').trim();
      return empCab === selectedCabang;
    }
    return true;
  });

  if (filteredEmp.length === 0) {
    html = '<small class="text-muted">Tidak ada karyawan aktif pada cabang ini.</small>';
  } else {
    filteredEmp.forEach(emp => {
      const empId = String(emp.id_karyawan).trim();
      const empNama = emp.nama_lengkap || emp.nama || empId;
      const isChecked = selectedKhusus.includes(empId) ? 'checked' : '';

      html += `
        <div class="form-check form-check-inline">
          <input class="form-check-input chk-karyawan-khusus" type="checkbox" value="${empId}" id="chkKhusus_${empId}" ${isChecked}>
          <label class="form-check-label small" for="chkKhusus_${empId}">
            <b>${empNama}</b> <span class="text-muted">(${empId})</span>
          </label>
        </div>`;
    });
  }

  document.getElementById('listKaryawanKhususCheck').innerHTML = html;
}

function loadPengaturanGajiToForm() {
  const store = (typeof GLOBAL_DATA !== 'undefined' && GLOBAL_DATA) ? GLOBAL_DATA : (window.GLOBAL_DATA || {});
  const cfg = store.configGajiPerCabang || store.configMap || {};

  const getValue = (key, defaultVal) => {
    return (cfg[key] !== undefined && cfg[key] !== null && cfg[key] !== '') ? cfg[key] : defaultVal;
  };

  const elNominal = document.getElementById('cfgNominalInsentifKhusus');
  if (elNominal) elNominal.value = getValue('nominalInsentifKhusus', 0);

  const elMinHadir = document.getElementById('cfgMinHadirKhusus');
  if (elMinHadir) elMinHadir.value = getValue('minHadirKhusus', 5);

  const elPotongan = document.getElementById('cfgPotonganTerlambat');
  if (elPotongan) elPotongan.value = getValue('potonganTerlambat', 0);

  const elBonus = document.getElementById('cfgBonusFull7Hari');
  if (elBonus) elBonus.value = getValue('bonusFull7Hari', 0);

  if (typeof loadRuleUmumByCabang === 'function') loadRuleUmumByCabang();
  if (typeof renderListKaryawanInsentifKhusus === 'function') renderListKaryawanInsentifKhusus();
  if (typeof renderSummaryPengaturan === 'function') renderSummaryPengaturan();
}

function loadRuleUmumByCabang() {
  const elCabang = document.getElementById('cfgCabangRuleUmum');
  if (!elCabang) return;

  const selectedCabang = elCabang.value;
  const store = (typeof GLOBAL_DATA !== 'undefined' && GLOBAL_DATA) ? GLOBAL_DATA : (window.GLOBAL_DATA || {});
  const listConfig = store.configGajiPerCabang || store.configMap || {};

  const rawJam = listConfig['jamOvertime_' + selectedCabang] || listConfig['jamOvertime_Semua'] || listConfig['jamOvertime'] || '17:30';
  const jamOvertime = cleanJamOvertime(rawJam, '17:30');

  const nominalOvertime = listConfig['nominalOvertime_' + selectedCabang] || listConfig['nominalOvertime_Semua'] || listConfig['nominalOvertime'] || 15000;
  const nominalKerjaPagi = listConfig['nominalKerjaPagi_' + selectedCabang] || listConfig['nominalKerjaPagi_Semua'] || listConfig['nominalKerjaPagi'] || 10000;
  const nominalUangMakan = listConfig['nominalUangMakan_' + selectedCabang] || listConfig['nominalUangMakan_Semua'] || listConfig['nominalUangMakan'] || 15000;

  if (document.getElementById('cfgJamOvertime')) document.getElementById('cfgJamOvertime').value = jamOvertime;
  if (document.getElementById('cfgNominalOvertime')) document.getElementById('cfgNominalOvertime').value = nominalOvertime;
  if (document.getElementById('cfgNominalKerjaPagi')) document.getElementById('cfgNominalKerjaPagi').value = nominalKerjaPagi;
  if (document.getElementById('cfgNominalUangMakan')) document.getElementById('cfgNominalUangMakan').value = nominalUangMakan;
}

// 🟢 DIGANTI DENGAN FETCH API
async function savePengaturanGaji(e) {
  e.preventDefault();

  const selectedCabang = document.getElementById('cfgCabangRuleUmum') ? document.getElementById('cfgCabangRuleUmum').value : 'Semua';
  const jamOvertime = document.getElementById('cfgJamOvertime') ? document.getElementById('cfgJamOvertime').value : '17:30';
  const nominalOvertime = document.getElementById('cfgNominalOvertime') ? document.getElementById('cfgNominalOvertime').value : 0;
  const nominalKerjaPagi = document.getElementById('cfgNominalKerjaPagi') ? document.getElementById('cfgNominalKerjaPagi').value : 0;
  const nominalUangMakan = document.getElementById('cfgNominalUangMakan') ? document.getElementById('cfgNominalUangMakan').value : 0;

  const payload = {
    id_cabang: selectedCabang,
    jamOvertime: jamOvertime,
    nominalOvertime: nominalOvertime,
    nominalKerjaPagi: nominalKerjaPagi,
    nominalUangMakan: nominalUangMakan
  };

  const btn = document.getElementById('btnSaveGajiKondisional');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Menyimpan...';
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/pengaturan/rule-umum`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const res = await response.json();

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-save"></i> Simpan Rule Payroll Cabang';
    }

    if (!GLOBAL_DATA.configGajiPerCabang) GLOBAL_DATA.configGajiPerCabang = {};
    GLOBAL_DATA.configGajiPerCabang['jamOvertime_' + selectedCabang] = jamOvertime;
    GLOBAL_DATA.configGajiPerCabang['nominalOvertime_' + selectedCabang] = nominalOvertime;
    GLOBAL_DATA.configGajiPerCabang['nominalKerjaPagi_' + selectedCabang] = nominalKerjaPagi;
    GLOBAL_DATA.configGajiPerCabang['nominalUangMakan_' + selectedCabang] = nominalUangMakan;

    renderSummaryPengaturan();

    showToast(`✅ Rule payroll cabang [${selectedCabang}] berhasil disimpan!`);
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-save"></i> Simpan Rule Payroll Cabang';
    }
    alert('❌ Gagal menyimpan rule: ' + err.message);
  }
}

// 🟢 DIGANTI DENGAN FETCH API
async function savePengaturanInsentifKhusus(e) {
  e.preventDefault();

  const checkboxes = document.querySelectorAll('.chk-insentif-khusus:checked');
  let arrayKaryawanKhusus = [];
  checkboxes.forEach(chk => arrayKaryawanKhusus.push(chk.value));

  const payload = {
    nominalInsentifKhusus: document.getElementById('cfgNominalInsentifKhusus') ? document.getElementById('cfgNominalInsentifKhusus').value : 0,
    minHadirKhusus: document.getElementById('cfgMinHadirKhusus') ? document.getElementById('cfgMinHadirKhusus').value : 5,
    potonganTerlambat: document.getElementById('cfgPotonganTerlambat') ? document.getElementById('cfgPotonganTerlambat').value : 0,
    bonusFull7Hari: document.getElementById('cfgBonusFull7Hari') ? document.getElementById('cfgBonusFull7Hari').value : 0,
    karyawanKhusus: arrayKaryawanKhusus.join(',')
  };

  const btn = document.getElementById('btnSaveInsentifKhusus');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Menyimpan...';
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/pengaturan/insentif-khusus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const res = await response.json();

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-save"></i> Simpan Rule & Daftar Insentif Khusus';
    }

    if (!GLOBAL_DATA.configGajiPerCabang) GLOBAL_DATA.configGajiPerCabang = {};
    GLOBAL_DATA.configGajiPerCabang['nominalInsentifKhusus'] = payload.nominalInsentifKhusus;
    GLOBAL_DATA.configGajiPerCabang['minHadirKhusus'] = payload.minHadirKhusus;
    GLOBAL_DATA.configGajiPerCabang['potonganTerlambat'] = payload.potonganTerlambat;
    GLOBAL_DATA.configGajiPerCabang['bonusFull7Hari'] = payload.bonusFull7Hari;
    GLOBAL_DATA.configGajiPerCabang['karyawanKhusus'] = payload.karyawanKhusus;

    renderSummaryPengaturan();
    showToast('✅ Aturan & daftar penerima insentif khusus berhasil disimpan!');
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-save"></i> Simpan Rule & Daftar Insentif Khusus';
    }
    alert('❌ Gagal menyimpan: ' + err.message);
  }
}

function renderListKaryawanInsentifKhusus() {
  const store = (typeof GLOBAL_DATA !== 'undefined' && GLOBAL_DATA) ? GLOBAL_DATA : (window.GLOBAL_DATA || {});
  const listKaryawan = store.karyawan || store.tb_karyawan || [];
  const config = store.configGajiPerCabang || store.configMap || {};
  
  const elSelectCabang = document.getElementById('cfgCabangInsentifKhusus');
  const selectedCabang = elSelectCabang ? elSelectCabang.value : 'Semua';

  let selectedKhusus = [];
  const rawKhusus = config.karyawanKhusus || config['karyawanKhusus'] || '';
  if (Array.isArray(rawKhusus)) {
    selectedKhusus = rawKhusus.map(id => String(id).trim());
  } else if (typeof rawKhusus === 'string') {
    selectedKhusus = rawKhusus.split(',').map(id => id.trim());
  }

  const filteredEmp = listKaryawan.filter(emp => {
    if (String(emp.status || '').toLowerCase() !== 'aktif') return false;
    if (selectedCabang !== 'Semua') {
      const empCab = String(emp.id_cabang || emp.tb_cabang || '').trim();
      return empCab === selectedCabang;
    }
    return true;
  });

  let html = '';
  if (filteredEmp.length === 0) {
    html = '<small class="text-muted p-2">Tidak ada karyawan aktif pada cabang ini.</small>';
  } else {
    filteredEmp.forEach(emp => {
      const empId = String(emp.id_karyawan).trim();
      const empNama = emp.nama_lengkap || emp.nama || empId;
      const isChecked = selectedKhusus.includes(empId) ? 'checked' : '';

      html += `
        <div class="form-check form-check-inline m-0 p-2 border rounded bg-light">
          <input class="form-check-input chk-insentif-khusus ms-1" type="checkbox" value="${empId}" id="chkKhusus_${empId}" ${isChecked}>
          <label class="form-check-label small ms-2 pe-2" for="chkKhusus_${empId}">
            <b>${empNama}</b> <span class="text-muted">(${empId})</span>
          </label>
        </div>`;
    });
  }

  const container = document.getElementById('listKaryawanKhususCheck');
  if (container) container.innerHTML = html;
}

function renderSummaryPengaturan() {
  const store = (typeof GLOBAL_DATA !== 'undefined' && GLOBAL_DATA) ? GLOBAL_DATA : (window.GLOBAL_DATA || {});
  const listCabang = store.cabang || store.tb_cabang || [];
  const listKaryawan = store.karyawan || store.tb_karyawan || [];
  const configMap = store.configGajiPerCabang || store.configMap || {};

  let htmlRule = '';
  const jOverGlobal = cleanJamOvertime(configMap['jamOvertime_Semua'] || configMap['jamOvertime'], '17:30');
  const nOverGlobal = Number(configMap['nominalOvertime_Semua'] || configMap['nominalOvertime'] || 15000);
  const nPagiGlobal = Number(configMap['nominalKerjaPagi_Semua'] || configMap['nominalKerjaPagi'] || 10000);
  const nMakanGlobal = Number(configMap['nominalUangMakan_Semua'] || configMap['nominalUangMakan'] || 15000);

  htmlRule += `<tr class="table-secondary">
    <td><b>Global (Semua)</b></td>
    <td>${jOverGlobal}</td>
    <td>Rp ${nOverGlobal.toLocaleString('id-ID')}</td>
    <td>Rp ${nPagiGlobal.toLocaleString('id-ID')}</td>
    <td>Rp ${nMakanGlobal.toLocaleString('id-ID')}</td>
  </tr>`;

  listCabang.forEach(c => {
    const cabId = c.id_cabang || c.tb_cabang || '';
    const cabNama = c.nama_cabang || cabId;
    if (!cabId) return;

    const rawJamCab = configMap['jamOvertime_' + cabId];
    const jOver = rawJamCab ? cleanJamOvertime(rawJamCab, '-') : '-';

    const nOver = configMap['nominalOvertime_' + cabId] !== undefined && configMap['nominalOvertime_' + cabId] !== '' ? 'Rp ' + Number(configMap['nominalOvertime_' + cabId]).toLocaleString('id-ID') : '-';
    const nPagi = configMap['nominalKerjaPagi_' + cabId] !== undefined && configMap['nominalKerjaPagi_' + cabId] !== '' ? 'Rp ' + Number(configMap['nominalKerjaPagi_' + cabId]).toLocaleString('id-ID') : '-';
    const nMakan = configMap['nominalUangMakan_' + cabId] !== undefined && configMap['nominalUangMakan_' + cabId] !== '' ? 'Rp ' + Number(configMap['nominalUangMakan_' + cabId]).toLocaleString('id-ID') : '-';

    htmlRule += `<tr>
      <td>${cabNama}</td>
      <td>${jOver}</td>
      <td>${nOver}</td>
      <td>${nPagi}</td>
      <td>${nMakan}</td>
    </tr>`;
  });

  const elTbody = document.getElementById('tbodySummaryRuleCabang');
  if (elTbody) elTbody.innerHTML = htmlRule;

  const rawKhusus = configMap['karyawanKhusus'] || '';
  const arrayKhusus = rawKhusus ? rawKhusus.split(',').map(s => s.trim()) : [];
  const nominalKhusus = Number(configMap['nominalInsentifKhusus'] || 0);

  let htmlKhusus = `<div class="mb-2 pb-2 border-bottom">
    <small class="text-muted d-block">Nominal Base (Bersyarat):</small>
    <strong class="text-primary fs-6">Rp ${nominalKhusus.toLocaleString('id-ID')}</strong>
  </div>`;

  const penerimaSyarat = listKaryawan.filter(emp => arrayKhusus.includes(String(emp.id_karyawan).trim()));
  if (penerimaSyarat.length === 0) {
    htmlKhusus += '<small class="text-muted d-block mb-2">Belum ada penerima insentif bersyarat.</small>';
  } else {
    htmlKhusus += '<div class="fw-bold small text-dark mb-1">Penerima Insentif Bersyarat:</div>';
    htmlKhusus += '<ul class="list-group list-group-flush small mb-3">';
    penerimaSyarat.forEach(emp => {
      htmlKhusus += `
        <li class="list-group-item bg-transparent px-0 py-1 d-flex justify-content-between align-items-center">
          <span><b>${emp.nama_lengkap || emp.nama}</b> <small class="text-muted">(${emp.id_karyawan})</small></span>
          <span class="badge bg-warning text-dark">Bersyarat</span>
        </li>`;
    });
    htmlKhusus += '</ul>';
  }

  const penerimaTetap = listKaryawan.filter(emp => Number(emp.insentif_khusus || 0) > 0);
  if (penerimaTetap.length > 0) {
    htmlKhusus += '<div class="fw-bold small text-dark mb-1 border-top pt-2">Insentif Tetap/Jabatan (Tanpa Syarat):</div>';
    htmlKhusus += '<ul class="list-group list-group-flush small">';
    penerimaTetap.forEach(emp => {
      const nom = Number(emp.insentif_khusus).toLocaleString('id-ID');
      htmlKhusus += `
        <li class="list-group-item bg-transparent px-0 py-1 d-flex justify-content-between align-items-center">
          <span><b>${emp.nama_lengkap || emp.nama}</b></span>
          <span class="badge bg-success">Rp ${nom}</span>
        </li>`;
    });
    htmlKhusus += '</ul>';
  }

  const elBoxKhusus = document.getElementById('boxSummaryInsentifKhusus');
  if (elBoxKhusus) elBoxKhusus.innerHTML = htmlKhusus;
}

function cleanJamOvertime(val, defaultVal = '17:30') {
  if (!val || val === '-') return defaultVal;
  const str = String(val).trim();
  
  if (str.includes('1899-12-30')) {
    const d = new Date(str);
    if (!isNaN(d)) {
      const jam = String(d.getHours()).padStart(2, '0');
      const menit = String(d.getMinutes()).padStart(2, '0');
      return `${jam}:${menit}`;
    }
  }
  
  if (str.includes(':')) {
    const parts = str.split(':');
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  
  return str;
}

function openModalEditPresensi(idPresensi) {
  const presensi = (GLOBAL_DATA.absensi || GLOBAL_DATA.presensi || []).find(p => 
    String(p.id_presensi || p.id_absen || p[0]) === String(idPresensi)
  );
  if (!presensi) return alert("Data presensi tidak ditemukan!");

  const getEmpNameLocal = (id) => {
    const list = GLOBAL_DATA.allKaryawanPublic || GLOBAL_DATA.karyawan || [];
    const found = list.find(e => String(e.id_karyawan || e[0]) === String(id));
    return found ? (found.nama_lengkap || found[1]) : id;
  };

  const idK = presensi.id_karyawan || presensi[1];
  const tgl = presensi.tanggal || presensi[2];
  let jIn = String(presensi.jam_masuk || presensi[3] || '').trim();
  let jOut = String(presensi.jam_keluar || presensi[4] || '').trim();

  let valPagi = presensi.dapat_kerja_pagi !== undefined ? presensi.dapat_kerja_pagi : presensi[7];
  let valMakan = presensi.dapat_uang_makan !== undefined ? presensi.dapat_uang_makan : presensi[8];
  let cat = presensi.catatan_koreksi !== undefined ? presensi.catatan_koreksi : presensi[9] || '';

  document.getElementById('editPresensiId').value = presensi.id_presensi || presensi.id_absen || presensi[0];
  document.getElementById('editPresensiNama').value = getEmpNameLocal(idK);
  document.getElementById('editPresensiTanggal').value = formatDisplayDate(tgl);
  document.getElementById('editPresensiJamMasuk').value = jIn;
  document.getElementById('editPresensiJamKeluar').value = jOut;

  const editPagi = document.getElementById('editPresensiDapatKerjaPagi');
  if (editPagi) editPagi.checked = (valPagi === 'Ya' || valPagi === true);

  const editMakan = document.getElementById('editPresensiDapatUangMakan');
  if (editMakan) editMakan.checked = (valMakan === 'Ya' || valMakan === true);

  const editCat = document.getElementById('editPresensiCatatan');
  if (editCat) editCat.value = cat;

  new bootstrap.Modal(document.getElementById('modalEditPresensi')).show();
}

// 🟢 DIGANTI DENGAN FETCH API
async function simpanKoreksiPresensi(e) {
  e.preventDefault();
  const btn = document.getElementById('btnSimpanKoreksi');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Menyimpan...';
  }

  const idPresensi = document.getElementById('editPresensiId').value;
  const jamMasuk = document.getElementById('editPresensiJamMasuk').value;
  const jamKeluar = document.getElementById('editPresensiJamKeluar').value;
  const dapatKerjaPagi = document.getElementById('editPresensiDapatKerjaPagi').checked ? 'Ya' : 'Tidak';
  const dapatUangMakan = document.getElementById('editPresensiDapatUangMakan').checked ? 'Ya' : 'Tidak';
  const catatanKoreksi = document.getElementById('editPresensiCatatan').value;

  const payload = {
    id_presensi: idPresensi,
    jam_masuk: jamMasuk,
    jam_keluar: jamKeluar,
    dapat_kerja_pagi: dapatKerjaPagi,
    dapat_uang_makan: dapatUangMakan,
    catatan_koreksi: catatanKoreksi
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/presensi/koreksi`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const res = await response.json();

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'Simpan Koreksi';
    }

    const modalEl = document.getElementById('modalEditPresensi');
    if (modalEl) {
      const modalInstance = bootstrap.Modal.getInstance(modalEl);
      if (modalInstance) modalInstance.hide();
    }

    const listData = GLOBAL_DATA.absensi || GLOBAL_DATA.presensi || [];
    const item = listData.find(p => String(p.id_presensi || p.id_absen || p[0]) === String(idPresensi));
    
    if (item) {
      item.jam_masuk = jamMasuk;
      item.jam_keluar = jamKeluar;
      item.dapat_kerja_pagi = dapatKerjaPagi;
      item.dapat_uang_makan = dapatUangMakan;
      item.catatan_koreksi = catatanKoreksi;
    }

    renderAllTables();
    showToast('✔️ Koreksi & penandaan berhasil disimpan!');
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'Simpan Koreksi';
    }
    showToast('❌ Gagal simpan koreksi!', 'danger');
  }
}

function renderTabelHistoriPresensiAdmin(dataAbsen) {
  const tbody = document.getElementById('tabelRiwayatAbsenAll');
  if (!tbody) return;

  const list = dataAbsen || (GLOBAL_DATA ? GLOBAL_DATA.absensi || GLOBAL_DATA.presensi : []);
  window.TEMP_ABSENSI_FILTERED = list;

  if (!list || list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Tidak ada data presensi.</td></tr>';
    return;
  }

  const getEmpNameLocal = (id) => {
    const listEmp = (GLOBAL_DATA && (GLOBAL_DATA.allKaryawanPublic || GLOBAL_DATA.karyawan)) || [];
    const found = listEmp.find(e => String(e.id_karyawan || e[0]) === String(id));
    return found ? `<b>${found.nama_lengkap || found[1]}</b>` : id;
  };

  const todayStr = formatDisplayDate(new Date());

  let html = '';
  list.forEach(p => {
    let idKaryawan = p.id_karyawan || p[1];
    let empName = getEmpNameLocal(idKaryawan);
    let tglStr = formatDisplayDate(p.tanggal || p[2]);
    let jamIn = p.jam_masuk || p[3] || '-';
    let jamOut = p.jam_keluar || p[4] || '-';
    let radiusStr = p.status_radius || p[6] || 'Dalam Radius';

    let valPagi = p.dapat_kerja_pagi !== undefined ? p.dapat_kerja_pagi : p[7];
    let valMakan = p.dapat_uang_makan !== undefined ? p.dapat_uang_makan : p[8];

    let isPagi = (valPagi === 'Ya' || valPagi === true);
    let isMakan = (valMakan === 'Ya' || valMakan === true);
    let idAbs = p.id_presensi || p.id_absen || p[0];

    let badgeStatusHtml = typeof generateAbsenStatusBadge === 'function' 
      ? generateAbsenStatusBadge(p, null, false, tglStr < todayStr, tglStr === todayStr)
      : '<span class="badge bg-primary">Hadir</span>';

    html += `<tr>
      <td>${empName}</td>
      <td><b>${tglStr}</b></td>
      <td class="text-success fw-bold">${jamIn}</td>
      <td class="text-danger fw-bold">${jamOut}</td>
      <td>
        <div class="d-flex flex-column gap-1 align-items-start">
          ${badgeStatusHtml}
          <span class="badge ${radiusStr === 'Dalam Radius' ? 'bg-success' : 'bg-secondary'}">${radiusStr}</span>
        </div>
      </td>
      
      <td class="text-center">
        ${isPagi ? '<span class="badge bg-success"><i class="bi bi-check-circle"></i> Ya</span>' : '<span class="badge bg-light text-muted border">Tidak</span>'}
      </td>

      <td class="text-center">
        ${isMakan ? '<span class="badge bg-info text-dark"><i class="bi bi-check-circle"></i> Ya</span>' : '<span class="badge bg-light text-muted border">Tidak</span>'}
      </td>

      <td>
        <button class="btn btn-xs btn-outline-warning fw-bold" onclick="openModalEditPresensi('${idAbs}')">
          <i class="bi bi-pencil"></i> Edit / Tandai
        </button>
      </td>
    </tr>`;
  });

  tbody.innerHTML = html;
}

// 🟢 DIGANTI DENGAN FETCH API
async function quickTogglePenanda(idPresensi, tipe, isChecked) {
  const statusStr = isChecked ? 'Ya' : 'Tidak';

  const target = (GLOBAL_DATA.absensi || GLOBAL_DATA.presensi || []).find(p => 
    String(p.id_presensi || p.id_absen || p[0]) === String(idPresensi)
  );

  if (target) {
    if (tipe === 'kerja_pagi') target.dapat_kerja_pagi = statusStr;
    if (tipe === 'uang_makan') target.dapat_uang_makan = statusStr;
  }

  try {
    await fetch(`${API_BASE_URL}/api/presensi/toggle-penanda`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_presensi: idPresensi, tipe: tipe, status: statusStr })
    });
    showToast('✔️ Penanda berhasil diperbarui!');
  } catch (err) {
    showToast('❌ Gagal memperbarui penanda!', 'danger');
    loadAppData();
  }
}

function hitungUnsurLainLainKaryawan(idKaryawan, tglStart, tglEnd) {
  let totalLainLain = 0;
  let detailLain = {
    kerjaPagi: 0,
    uangMakan: 0,
    overtime: 0,
    insentifKhusus: 0
  };

  const store = (typeof GLOBAL_DATA !== 'undefined' && GLOBAL_DATA) ? GLOBAL_DATA : (window.GLOBAL_DATA || {});

  const listAbsen = store.presensi || store.absensi || [];
  const cfg = store.configGaji || {};

  const jamOvertimeLimit = cfg.jamOvertime || '17:30';
  const nomOvertime = Number(cfg.nominalOvertime || 0);
  const nomKerjaPagi = Number(cfg.nominalKerjaPagi || 0);
  const nomUangMakan = Number(cfg.nominalUangMakan || 0);
  const nomInsentifKhusus = Number(cfg.nominalInsentifKhusus || 0);

  const listKhusus = Array.isArray(cfg.karyawanKhusus) ? cfg.karyawanKhusus : [];
  const isKaryawanKhusus = listKhusus.includes(String(idKaryawan));

  const filteredAbsen = listAbsen.filter(a => {
    if (!a || !a.tanggal) return false;
    let dStr = (typeof cleanDateStr === 'function') ? cleanDateStr(a.tanggal) : String(a.tanggal).substring(0, 10);
    return String(a.id_karyawan) === String(idKaryawan) && dStr >= tglStart && dStr <= tglEnd;
  });

  filteredAbsen.forEach(a => {
    if (a.dapat_kerja_pagi === 'Ya') {
      detailLain.kerjaPagi += nomKerjaPagi;
    }
    if (a.dapat_uang_makan === 'Ya') {
      detailLain.uangMakan += nomUangMakan;
    }
    if (a.jam_keluar && a.jam_keluar.trim() !== '' && a.jam_keluar !== '23:59:59' && a.jam_keluar !== '23:59') {
      if (a.jam_keluar > jamOvertimeLimit) {
        detailLain.overtime += nomOvertime;
      }
    }
  });

  if (isKaryawanKhusus) {
    detailLain.insentifKhusus = nomInsentifKhusus;
  }

  totalLainLain = detailLain.kerjaPagi + detailLain.uangMakan + detailLain.overtime + detailLain.insentifKhusus;

  return {
    totalLainLain: totalLainLain,
    detail: detailLain
  };
}

function renderTabelPresensi() {
  let html = '';
  const store = (typeof GLOBAL_DATA !== 'undefined' && GLOBAL_DATA) ? GLOBAL_DATA : (window.GLOBAL_DATA || {});
  const dataAbsen = store.presensi || store.absensi || [];
  const cfg = store.configGaji || {};
  const jamOvertimeLimit = cfg.jamOvertime || '17:30';

  if (!dataAbsen || dataAbsen.length === 0) {
    html = '<tr><td colspan="8" class="text-center">Belum ada riwayat presensi.</td></tr>';
  } else {
    dataAbsen.forEach(item => {
      let isLupaOut = (item.jam_keluar === '23:59:59' || item.jam_keluar === '23:59');
      let isOvertime = (!isLupaOut && item.jam_keluar && item.jam_keluar > jamOvertimeLimit);

      let jamKeluarBadge = '';
      if (isLupaOut) {
        jamKeluarBadge = `<span class="badge bg-danger">Lupa Checkout</span>`;
      } else if (item.jam_keluar) {
        jamKeluarBadge = item.jam_keluar;
        if (isOvertime) {
          jamKeluarBadge += ` <span class="badge bg-warning text-dark"><i class="bi bi-clock-history"></i> Lembur</span>`;
        }
      } else {
        jamKeluarBadge = `<span class="badge bg-secondary">Belum Out</span>`;
      }

      let idKaryawan = item.id_karyawan || item[1];
      let tglStr = (typeof cleanDateStr === 'function') ? cleanDateStr(item.tanggal) : String(item.tanggal || '').substring(0, 10);

      html += `<tr>
        <td>${tglStr}</td>
        <td><b>${item.nama_karyawan || idKaryawan}</b></td>
        <td><span class="badge bg-success">${item.jam_masuk || '-'}</span></td>
        <td>${jamKeluarBadge}</td>
        <td>${item.status_radius || '-'}</td>
        <td>
          <span class="badge ${item.dapat_kerja_pagi === 'Ya' ? 'bg-primary' : 'bg-light text-dark'}">Pagi: ${item.dapat_kerja_pagi || 'Tidak'}</span>
          <span class="badge ${item.dapat_uang_makan === 'Ya' ? 'bg-info text-dark' : 'bg-light text-dark'}">Makan: ${item.dapat_uang_makan || 'Tidak'}</span>
        </td>
        <td>${item.catatan_koreksi || '-'}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary" onclick="openModalEditPresensi('${item.id_presensi || item.id_absen || item[0]}')">
            <i class="bi bi-pencil"></i> Edit
          </button>
        </td>
      </tr>`;
    });
  }

  const elTabel = document.getElementById('tabelHistoriPresensi');
  if (elTabel) elTabel.innerHTML = html;
}

function getRentangMingguBerjalan(refDate = new Date()) {
  const d = new Date(refDate);
  const day = d.getDay();
  
  let diffToTuesday = day >= 2 ? (day - 2) : (day + 5);
  
  const selasa = new Date(d);
  selasa.setDate(d.getDate() - diffToTuesday);
  selasa.setHours(0, 0, 0, 0);

  const senin = new Date(selasa);
  senin.setDate(selasa.getDate() + 6);
  senin.setHours(23, 59, 59, 999);

  return { selasa, senin };
}

function renderTabelJadwal() {
  const container = document.getElementById('containerJadwal');
  if (!container) return;

  const listJadwal = GLOBAL_DATA.jadwal || [];
  const listArea = GLOBAL_DATA.area || [];
  const listKaryawan = GLOBAL_DATA.karyawan || GLOBAL_DATA.allKaryawanPublic || [];

  const getEmpName = (id) => {
    if (!id) return '-';
    const emp = listKaryawan.find(k => String(k.id_karyawan) === String(id));
    return emp ? (emp.nama_lengkap || emp.nama) : '-';
  };

  const getAreaName = (id) => {
    if (!id) return '-';
    const area = listArea.find(a => String(a.id_area) === String(id));
    return area ? area.nama_area : id;
  };

  const namaHari = ['Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu', 'Senin'];
  const { selasa, senin } = getRentangMingguBerjalan();

  let html = `
    <div class="mb-3 p-2 bg-light rounded border d-flex justify-content-between align-items-center flex-wrap gap-2">
      <div>
        <strong class="text-primary-custom"><i class="bi bi-calendar-week"></i> Jadwal Distribusi Minggu Ini:</strong>
        <span class="ms-1 small fw-bold">${selasa.toLocaleDateString('id-ID')} s/d ${senin.toLocaleDateString('id-ID')}</span>
      </div>
      <small class="text-muted"><i class="bi bi-info-circle"></i> Untuk mengubah jadwal, gunakan tombol <b>+ Buat Jadwal Mingguan</b></small>
    </div>
    <div class="row g-2">
  `;

  for (let i = 0; i < 7; i++) {
    const tglHari = new Date(selasa);
    tglHari.setDate(selasa.getDate() + i);
    const tglStr = tglHari.toISOString().split('T')[0];
    const tglFormatted = (typeof formatDisplayDate === 'function') ? formatDisplayDate(tglStr) : tglStr;

    let items = listJadwal.filter(j => {
      const jTgl = String(j.tanggal || j.tgl || '').split('T')[0];
      return jTgl === tglStr;
    });

    let isAutoReplicated = false;

    if (items.length === 0) {
      const tglMingguLalu = new Date(tglHari);
      tglMingguLalu.setDate(tglHari.getDate() - 7);
      const tglMingguLaluStr = tglMingguLalu.toISOString().split('T')[0];

      items = listJadwal.filter(j => {
        const jTgl = String(j.tanggal || j.tgl || '').split('T')[0];
        return jTgl === tglMingguLaluStr;
      });

      if (items.length > 0) isAutoReplicated = true;
    }

    html += `
      <div class="col-12">
        <div class="card shadow-sm border mb-2">
          <div class="card-header ${isAutoReplicated ? 'bg-warning-subtle text-dark' : 'bg-primary text-white'} d-flex justify-content-between align-items-center py-1 px-3">
            <span class="fw-bold small">📅 ${namaHari[i]} (${tglFormatted}) ${isAutoReplicated ? '<small class="fw-normal ms-1 text-warning-emphasis">(Salinan Minggu Lalu)</small>' : ''}</span>
            <span class="badge ${isAutoReplicated ? 'bg-warning text-dark' : 'bg-light text-primary'}">${items.length} Area</span>
          </div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-sm table-hover align-middle mb-0 style-table-ringkas">
                <thead class="table-light border-bottom">
                  <tr style="font-size: 11px;">
                    <th style="width: 20%;">Area Tujuan</th>
                    <th style="width: 22%;">Sopir Utama</th>
                    <th style="width: 22%;">Kenek (Helper)</th>
                    <th style="width: 16%;">Nopol Armada</th>
                    <th style="width: 20%;">Catatan Rute</th>
                  </tr>
                </thead>
                <tbody style="font-size: 12px;">`;

    if (items.length === 0) {
      html += `
        <tr>
          <td colspan="5" class="text-center text-muted py-2">
            <small>Belum ada penugasan distribusi untuk hari ini.</small>
          </td>
        </tr>`;
    } else {
      items.forEach(j => {
        html += `
          <tr>
            <td><strong class="text-dark">${getAreaName(j.id_area)}</strong></td>
            <td><i class="bi bi-person-badge text-primary me-1"></i>${getEmpName(j.id_sopir)}</td>
            <td><i class="bi bi-person text-secondary me-1"></i>${getEmpName(j.id_kenek)}</td>
            <td><span class="badge bg-secondary font-monospace" style="font-size: 10px;">${j.nopol_armada || j.nopol || '-'}</span></td>
            <td><span class="text-muted small">${j.keterangan || '-'}</span></td>
          </tr>`;
      });
    }

    html += `
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`;
  }

  html += '</div>';
  container.innerHTML = html;
}

function exportPresensiPDF() {
  let tableRowsHtml = '';
  const data = window.TEMP_ABSENSI_FILTERED || [];

  if (Array.isArray(data) && data.length > 0) {
    const listEmp = (GLOBAL_DATA && (GLOBAL_DATA.allKaryawanPublic || GLOBAL_DATA.karyawan)) || [];

    data.forEach((item, index) => {
      const idEmp = item.id_karyawan || item[1];
      const found = listEmp.find(e => String(e.id_karyawan || e[0]) === String(idEmp));
      const nama = found ? (found.nama_lengkap || found[1]) : idEmp;

      const tgl = typeof formatDisplayDate === 'function' ? formatDisplayDate(item.tanggal || item[2]) : (item.tanggal || item[2] || '-');
      const jamMasuk = item.jam_masuk || item[3] || '-';
      const jamKeluar = item.jam_keluar || item[4] || '-';
      
      const radius = item.status_radius || item[6] || 'Dalam Radius';
      const statusAbsen = item.status || item.status_absen || 'Hadir';

      const valPagi = item.dapat_kerja_pagi !== undefined ? item.dapat_kerja_pagi : item[7];
      const valMakan = item.dapat_uang_makan !== undefined ? item.dapat_uang_makan : item[8];
      const valOT = item.overtime || item.komponen_overtime || item[9];

      const isPagi = (valPagi === 'Ya' || valPagi === true) ? 'Ya' : 'Tidak';
      const isMakan = (valMakan === 'Ya' || valMakan === true) ? 'Ya' : 'Tidak';
      const isOT = (valOT > 0 || valOT === 'Ya' || valOT === true) ? 'Ya' : 'Tidak';

      tableRowsHtml += `
        <tr>
          <td style="text-align: center;">${index + 1}</td>
          <td><b>${nama}</b></td>
          <td style="text-align: center;"><b>${tgl}</b></td>
          <td style="text-align: center; color: #16a34a; font-weight: bold;">${jamMasuk}</td>
          <td style="text-align: center; color: #dc2626; font-weight: bold;">${jamKeluar}</td>
          <td style="text-align: center;">
            <span style="display: inline-block; padding: 2px 5px; border-radius: 3px; font-size: 9px; background-color: #e2e8f0; color: #334155; font-weight: bold;">${statusAbsen}</span><br>
            <small style="color: #64748b;">${radius}</small>
          </td>
          <td style="text-align: center;">${isPagi}</td>
          <td style="text-align: center;">${isMakan}</td>
          <td style="text-align: center;">${isOT}</td>
        </tr>
      `;
    });
  } else {
    const tbody = document.getElementById('tabelRiwayatAbsenAll');
    if (!tbody) {
      alert("Tabel riwayat presensi tidak ditemukan!");
      return;
    }

    const rows = tbody.querySelectorAll('tr');
    let no = 1;

    rows.forEach(row => {
      if (row.cells.length > 1) {
        tableRowsHtml += '<tr>';
        tableRowsHtml += `<td style="text-align: center;">${no++}</td>`;
        for (let i = 0; i < Math.min(row.cells.length - 1, 7); i++) {
          tableRowsHtml += `<td style="text-align: center;">${row.cells[i].innerText.trim().replace(/\n/g, '<br>')}</td>`;
        }
        tableRowsHtml += '</tr>';
      }
    });
  }

  if (!tableRowsHtml) {
    alert("Tidak ada data presensi yang tampil untuk dicetak!");
    return;
  }

  const tglStart = document.getElementById('filterAbsenStart')?.value || document.getElementById('payStart')?.value || '';
  const tglEnd = document.getElementById('filterAbsenEnd')?.value || document.getElementById('payEnd')?.value || '';
  
  let teksPeriode = 'Semua Periode Data';
  if (tglStart && tglEnd) {
    const fmtStart = typeof formatDisplayDate === 'function' ? formatDisplayDate(tglStart) : tglStart;
    const fmtEnd = typeof formatDisplayDate === 'function' ? formatDisplayDate(tglEnd) : tglEnd;
    teksPeriode = `Periode: ${fmtStart} s/d ${fmtEnd}`;
  } else if (tglStart) {
    const fmtStart = typeof formatDisplayDate === 'function' ? formatDisplayDate(tglStart) : tglStart;
    teksPeriode = `Periode Mulai: ${fmtStart}`;
  }

  const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const printWindow = window.open('', '_blank');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Laporan Histori Presensi Karyawan</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 10px; color: #1e293b; }
        .header { text-align: center; margin-bottom: 12px; border-bottom: 2px solid #003366; padding-bottom: 6px; }
        .header h2 { margin: 0; color: #003366; text-transform: uppercase; font-size: 16px; }
        .header p { margin: 3px 0 0; font-size: 11px; color: #003366; font-weight: 600; }
        .header .sub-date { margin-top: 2px; font-size: 9px; color: #64748b; font-weight: normal; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9px; }
        th { background-color: #003366; color: white; padding: 5px 3px; border: 1px solid #cbd5e1; text-align: center; }
        td { padding: 4px 3px; border: 1px solid #cbd5e1; vertical-align: middle; }
        tr:nth-child(even) { background-color: #f8fafc; }
        .footer { margin-top: 12px; font-size: 8px; text-align: right; color: #94a3b8; }
        
        @media print { 
          @page { size: A4 portrait; margin: 8mm; } 
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>Laporan Histori Presensi Karyawan</h2>
        <p>${teksPeriode}</p>
        <div class="sub-date">Dicetak pada: ${todayStr}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 25px;">No</th>
            <th>Nama Karyawan</th>
            <th>Tanggal</th>
            <th>Masuk</th>
            <th>Keluar</th>
            <th>Status & Radius</th>
            <th>Pagi</th>
            <th>Makan</th>
            <th>OT</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
      <div class="footer">
        <p>Dokumen ini dihasilkan secara otomatis oleh Sistem Operasional & Payroll</p>
      </div>
      <script>
        window.onload = function() { window.print(); };
      <\/script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

function cetakStrukThermal80mm(item) {
  if (!item) {
    alert("Data payroll tidak valid!");
    return;
  }

  const tglMulai = document.getElementById('payStart')?.value || '-';
  const tglSelesai = document.getElementById('payEnd')?.value || '-';
  const tglCetak = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const formatRupiah = (num) => 'Rp ' + Number(num || 0).toLocaleString('id-ID');

  const gHarian = Number(item.gaji_harian || 0);
  const totalHadir = Number(item.total_hadir || 0);
  const subtotal = Number(item.subtotal || 0);
  const compPagi = Number(item.komponen_pagi || 0);
  const compMakan = Number(item.komponen_makan || 0);
  const compOT = Number(item.komponen_overtime || 0);
  const compKhusus = Number(item.komponen_khusus_tetap || 0) + Number(item.komponen_khusus_syarat || 0);
  
  const potKasbon = Number(item.potongan_kasbon || 0);
  const sisaKasbonAwal = Number(item.total_sisa_kasbon || 0);
  const sisaKasbonAkhir = Math.max(0, sisaKasbonAwal - potKasbon);
  const totalDiterima = Number(item.total_diterima || 0);

  const printWindow = window.open('', '_blank', 'width=400,height=600');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Struk Gaji - ${item.nama || 'Karyawan'}</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        body {
          font-family: 'Courier New', Courier, monospace;
          width: 74mm;
          margin: 0 auto;
          padding: 8px 2px;
          font-size: 11px;
          color: #000;
          line-height: 1.2;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .bold { font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 5px 0; }
        .double-divider { border-top: 2px double #000; margin: 5px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        td { padding: 2px 0; vertical-align: top; }
      </style>
    </head>
    <body>
      <div class="text-center">
        <div class="bold" style="font-size: 13px;">SLIP GAJI KARYAWAN</div>
        <div class="bold">PT. BARAKA SARANA TAMA</div>
        <small style="font-size: 9px;">TEPAT WAKTU, TEPAT MUTU, DAPAT DIANDALKAN</small>
      </div>

      <div class="divider"></div>

      <table>
        <tr><td>Nama</td><td>: <span class="bold">${item.nama || '-'}</span></td></tr>
        <tr><td>ID/Posisi</td><td>: ${item.id_karyawan || '-'} (${item.posisi || item.jabatan || '-'})</td></tr>
        <tr><td>Periode</td><td>: ${tglMulai} s/d ${tglSelesai}</td></tr>
        <tr><td>Tgl Cetak</td><td>: ${tglCetak}</td></tr>
      </table>

      <div class="divider"></div>
      <div class="bold text-center">RINCIAN PENERIMAAN</div>
      <div class="divider"></div>

      <table>
        <tr>
          <td>Gaji Pokok (${totalHadir} hr @${formatRupiah(gHarian)})</td>
          <td class="text-right">${formatRupiah(subtotal)}</td>
        </tr>
        ${compPagi > 0 ? `
        <tr>
          <td>Uang Kerja Pagi</td>
          <td class="text-right">${formatRupiah(compPagi)}</td>
        </tr>` : ''}
        ${compMakan > 0 ? `
        <tr>
          <td>Uang Makan</td>
          <td class="text-right">${formatRupiah(compMakan)}</td>
        </tr>` : ''}
        ${compOT > 0 ? `
        <tr>
          <td>Uang Overtime</td>
          <td class="text-right">${formatRupiah(compOT)}</td>
        </tr>` : ''}
        ${compKhusus > 0 ? `
        <tr>
          <td>Tunjangan Khusus</td>
          <td class="text-right">${formatRupiah(compKhusus)}</td>
        </tr>` : ''}
      </table>

      ${potKasbon > 0 ? `
      <div class="divider"></div>
      <div class="bold text-center">POTONGAN</div>
      <div class="divider"></div>
      <table>
        <tr>
          <td>Potongan Kasbon</td>
          <td class="text-right">-${formatRupiah(potKasbon)}</td>
        </tr>
        <tr>
          <td><small>Sisa Kasbon Saat Ini</small></td>
          <td class="text-right"><small>${formatRupiah(sisaKasbonAkhir)}</small></td>
        </tr>
      </table>` : ''}

      <div class="double-divider"></div>

      <table>
        <tr style="font-size: 12px;" class="bold">
          <td>TOTAL DITERIMA</td>
          <td class="text-right">${formatRupiah(totalDiterima)}</td>
        </tr>
      </table>

      <div class="double-divider"></div>

      <br>
      <table style="text-align: center; margin-top: 4px;">
        <tr>
          <td style="width: 50%;">Penerima,<br><br><br>( ${item.nama || 'Karyawan'} )</td>
          <td style="width: 50%;">Kasir/Payroll,<br><br><br>( Admin )</td>
        </tr>
      </table>

      <br>
      <div class="text-center" style="font-size: 9px; margin-top: 6px;">
        *** Terima Kasih ***
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      <\/script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

// 🟢 DIGANTI DENGAN FETCH API
async function eksekusiSimpanPayroll() {
  const dataPayroll = window.TEMP_PAYROLL || [];
  if (dataPayroll.length === 0) {
    alert("Tidak ada hasil perhitungan payroll untuk disimpan!");
    return;
  }

  if (!confirm("Apakah Anda yakin ingin menyimpan rekap payroll ini ke database?")) return;

  const payload = {
    id_cabang: document.getElementById('payCabangFilter')?.value || document.getElementById('payCabang')?.value || '',
    daftar_payroll: dataPayroll
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/payroll/rekap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const res = await response.json();

    if (res && res.status === 'success') {
      alert("✅ " + res.message);
      if (typeof renderSummaryPayroll === 'function') renderSummaryPayroll();
    } else {
      alert("❌ Error: " + (res ? res.message : 'Gagal menyimpan payroll.'));
    }
  } catch (err) {
    alert("❌ Error Server: " + err.message);
  }
}

let idleTimer;

function resetIdleTimer() {
  clearTimeout(idleTimer);
  const idleTimeoutDuration = 15 * 60 * 1000; 

  idleTimer = setTimeout(triggerAutoLogout, idleTimeoutDuration);
}

function triggerAutoLogout() {
  const dashView = document.getElementById('dashboardView');
  if (dashView && !dashView.classList.contains('d-none')) {
    alert("⏳ Sesi Anda telah berakhir demi keamanan karena tidak ada aktivitas selama 15 menit. Silakan login kembali untuk memuat data terbaru.");
    
    if (typeof handleLogout === 'function') {
      handleLogout();
    } else {
      location.reload();
    }
  }
}

['mousemove', 'keypress', 'click', 'scroll', 'touchstart'].forEach(eventName => {
  document.addEventListener(eventName, resetIdleTimer, false);
});

resetIdleTimer();