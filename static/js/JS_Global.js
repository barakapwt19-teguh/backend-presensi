/**
 * ============================================================================
 * GLOBAL STATE & CLIENT UTILITIES (FastAPI Migration)
 * ============================================================================
 */

let CURRENT_USER = null;
let GLOBAL_DATA = {};
let CURRENT_LAT = null;
let CURRENT_LONG = null;
let MAP_INSTANCE = null;
let USER_MARKER = null;
let CABANG_CIRCLE = null;
let CABANG_MARKER = null;
let IS_WITHIN_RADIUS = false;
let TEMP_PAYROLL = [];
let deferredPrompt = null;

document.addEventListener("DOMContentLoaded", () => {
  if (typeof checkSession === "function") {
    checkSession();
  }
  setupPWAInstallPrompt();
});

/**
 * ----------------------------------------------------------------------------
 * HELPER CALL BACKEND / API FETCH
 * ----------------------------------------------------------------------------
 */
async function apiFetch(endpoint, options = {}) {
  const method = options.method || "GET";
  let bodyData = null;
  if (options.body) {
    try {
      bodyData = JSON.parse(options.body);
    } catch (e) {
      bodyData = options.body;
    }
  }

  // Menggunakan helper callBackend yang terdefinisi di Index.html
  if (typeof callBackend === "function") {
    return await callBackend(endpoint, method, bodyData);
  } else {
    const baseUrl = typeof API_BASE_URL !== "undefined" ? API_BASE_URL : "https://backend-presensi-tau.vercel.app";
    const reqOptions = {
      method: method,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    };
    if (bodyData) reqOptions.body = JSON.stringify(bodyData);
    
    const res = await fetch(`${baseUrl}${endpoint}`, reqOptions);
    return await res.json();
  }
}

function showToast(message, type = "success") {
  alert(message);
}

/**
 * ----------------------------------------------------------------------------
 * PWA INSTALLATION PROMPT
 * ----------------------------------------------------------------------------
 */
function setupPWAInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('pwaInstallBtn');
    if (installBtn) {
      installBtn.classList.remove('d-none');
    }
  });
}

function installPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((res) => {
      if (res.outcome === 'accepted') {
        const installBtn = document.getElementById('pwaInstallBtn');
        if (installBtn) installBtn.classList.add('d-none');
      }
      deferredPrompt = null;
    });
  }
}

/**
 * ----------------------------------------------------------------------------
 * UI NAVIGATION & LAYOUT UTILITIES
 * ----------------------------------------------------------------------------
 */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.toggle('active');
  if (overlay) overlay.classList.toggle('show');
}

/**
 * ----------------------------------------------------------------------------
 * FORMATTING HELPERS
 * ----------------------------------------------------------------------------
 */
function formatDisplayDate(rawDate) {
  if (!rawDate) return '-';
  try {
    if (typeof rawDate === 'string') {
      if (rawDate.includes('T')) return rawDate.split('T')[0];
      return rawDate.substring(0, 10);
    }
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return String(rawDate);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    return String(rawDate);
  }
}

function formatDisplayTime(rawTime) {
  if (!rawTime || rawTime === '-') return '-';
  let str = String(rawTime).trim();
  if (str.includes('T')) str = str.split('T')[1];
  return str.length >= 5 ? str.substring(0, 5) : str;
}

function cleanTimeStr(rawTime) {
  if (!rawTime || rawTime === '-') return '00:00:00';
  let str = String(rawTime).trim();
  if (str.includes('T')) str = str.split('T')[1];
  const parts = str.split(':');
  const hh = parts[0] ? parts[0].padStart(2, '0') : '00';
  const mm = parts[1] ? parts[1].padStart(2, '0') : '00';
  const ss = parts[2] ? parts[2].padStart(2, '0') : '00';
  return `${hh}:${mm}:${ss}`;
}

function cleanDateStr(rawDate) {
  return formatDisplayDate(rawDate);
}

/**
 * ----------------------------------------------------------------------------
 * MAP & GEOLOCATION (LEAFLET INTEGRATION)
 * ----------------------------------------------------------------------------
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radius bumi dalam meter
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Hasil dalam meter
}

function initMapAndLocation() {
  if (!navigator.geolocation) {
    alert("Browser Anda tidak mendukung fitur lokasi/GPS.");
    return;
  }

  // Dukungan untuk ID 'map' (di Index.html) maupun 'mapPresensi'
  const mapContainer = document.getElementById('map') || document.getElementById('mapPresensi');
  if (!mapContainer) return;

  const mapId = mapContainer.id;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      CURRENT_LAT = position.coords.latitude;
      CURRENT_LONG = position.coords.longitude;

      // Dapatkan data lokasi cabang user
      const userCabangId = CURRENT_USER ? CURRENT_USER.id_cabang : null;
      const cabang = (GLOBAL_DATA.cabang || []).find(c => String(c.id_cabang) === String(userCabangId)) || (GLOBAL_DATA.cabang || [])[0];

      const cabLat = cabang ? parseFloat(cabang.latitude) : CURRENT_LAT;
      const cabLong = cabang ? parseFloat(cabang.longitude) : CURRENT_LONG;
      const radiusMeters = cabang ? parseFloat(cabang.radius_meter || cabang.radius || 100) : 100;

      // Hitung Jarak Karyawan ke Cabang
      const distance = calculateDistance(CURRENT_LAT, CURRENT_LONG, cabLat, cabLong);
      IS_WITHIN_RADIUS = distance <= radiusMeters;

      const infoRadiusEl = document.getElementById('textStatusRadius');
      if (infoRadiusEl) {
        if (IS_WITHIN_RADIUS) {
          infoRadiusEl.className = "text-success fw-bold";
          infoRadiusEl.innerHTML = `✅ Terdeteksi Di Dalam Radius (${Math.round(distance)}m dari cabang)`;
        } else {
          infoRadiusEl.className = "text-danger fw-bold";
          infoRadiusEl.innerHTML = `⚠️ Di Luar Radius Cabang (${Math.round(distance)}m / maks ${radiusMeters}m)`;
        }
      }

      // Inisialisasi Peta Leaflet jika belum ada
      if (typeof L !== 'undefined') {
        if (!MAP_INSTANCE) {
          MAP_INSTANCE = L.map(mapId).setView([CURRENT_LAT, CURRENT_LONG], 17);

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
          }).addTo(MAP_INSTANCE);
        } else {
          MAP_INSTANCE.setView([CURRENT_LAT, CURRENT_LONG], 17);
        }

        // Marker Posisi Karyawan
        if (USER_MARKER) MAP_INSTANCE.removeLayer(USER_MARKER);
        USER_MARKER = L.marker([CURRENT_LAT, CURRENT_LONG]).addTo(MAP_INSTANCE)
          .bindPopup("<b>Posisi Anda</b>").openPopup();

        // Marker & Circle Radius Cabang
        if (cabang && cabLat && cabLong) {
          if (CABANG_CIRCLE) MAP_INSTANCE.removeLayer(CABANG_CIRCLE);
          if (CABANG_MARKER) MAP_INSTANCE.removeLayer(CABANG_MARKER);

          CABANG_CIRCLE = L.circle([cabLat, cabLong], {
            color: IS_WITHIN_RADIUS ? '#28a745' : '#dc3545',
            fillColor: IS_WITHIN_RADIUS ? '#28a745' : '#dc3545',
            fillOpacity: 0.15,
            radius: radiusMeters
          }).addTo(MAP_INSTANCE);

          CABANG_MARKER = L.marker([cabLat, cabLong]).addTo(MAP_INSTANCE)
            .bindPopup(`<b>Cabang: ${cabang.nama_cabang}</b>`);
        }

        setTimeout(() => { MAP_INSTANCE.invalidateSize(); }, 300);
      }
    },
    (err) => {
      console.warn("Gagal mendapatkan lokasi GPS:", err.message);
      const infoRadiusEl = document.getElementById('textStatusRadius');
      if (infoRadiusEl) {
        infoRadiusEl.className = "text-warning fw-bold";
        infoRadiusEl.innerHTML = "⚠️ Gagal membaca GPS. Pastikan izin lokasi aktif.";
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

/**
 * ----------------------------------------------------------------------------
 * SUBMIT PRESENSI (CHECK-IN / CHECK-OUT)
 * ----------------------------------------------------------------------------
 */
async function kirimPresensi(tipeAbsen) {
  if (!CURRENT_LAT || !CURRENT_LONG) {
    alert("⚠️ GPS belum siap. Pastikan lokasi HP aktif lalu muat ulang halaman.");
    return;
  }

  const btnIn = document.getElementById('btnCheckIn');
  const btnOut = document.getElementById('btnCheckOut');

  if (tipeAbsen === 'IN' && btnIn) {
    btnIn.disabled = true;
    btnIn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Memproses...';
  } else if (tipeAbsen === 'OUT' && btnOut) {
    btnOut.disabled = true;
    btnOut.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Memproses...';
  }

  const payload = {
    id_karyawan: CURRENT_USER ? CURRENT_USER.id_karyawan : null,
    id_cabang: CURRENT_USER ? CURRENT_USER.id_cabang : null,
    tipe: tipeAbsen,
    latitude: CURRENT_LAT,
    longitude: CURRENT_LONG,
    status_radius: IS_WITHIN_RADIUS ? 'Dalam Radius' : 'Luar Radius'
  };

  try {
    const res = await apiFetch('/api/presensi/submit', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res && res.status === 'success') {
      showToast(res.message || `✔️ Check-${tipeAbsen} Berhasil!`);
      if (typeof loadAppData === 'function') loadAppData();
    } else {
      alert("⚠️ Presensi Gagal: " + (res ? res.message : 'Terjadi kesalahan sistem.'));
      if (btnIn) { btnIn.disabled = false; btnIn.innerText = "Check-In Masuk"; }
      if (btnOut) { btnOut.disabled = false; btnOut.innerText = "Check-Out Keluar"; }
    }
  } catch (err) {
    alert("❌ Kesalahan Server/Koneksi: " + err.message);
    if (btnIn) { btnIn.disabled = false; btnIn.innerText = "Check-In Masuk"; }
    if (btnOut) { btnOut.disabled = false; btnOut.innerText = "Check-Out Keluar"; }
  }
}

function handlePresensiSubmit(tipe) {
  kirimPresensi(tipe);
}