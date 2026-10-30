function initMapAndLocation() {
  const statusDiv = document.getElementById('gpsStatus');
  const isSuperAdmin = (CURRENT_USER && CURRENT_USER.role === 'Admin');

  if (isSuperAdmin) {
    const adminGroup = document.getElementById('adminCabangSelectorGroup');
    if (adminGroup) adminGroup.classList.remove('d-none');
  }

  let empCabang = (GLOBAL_DATA && GLOBAL_DATA.cabang && GLOBAL_DATA.cabang.length > 0)
    ? (GLOBAL_DATA.cabang.find(c => String(c.id_cabang) === String(CURRENT_USER.id_cabang)) || GLOBAL_DATA.cabang[0])
    : { latitude: -6.200000, longitude: 106.816666, radius_meter: 100, nama_cabang: 'Kantor Pusat' };

  const latCabang = Number(empCabang.latitude || -6.200000);
  const longCabang = Number(empCabang.longitude || 106.816666);
  const radiusMeters = Number(empCabang.radius_meter || 100);

  try {
    const mapEl = document.getElementById('map');
    if (mapEl && typeof L !== 'undefined') {
      if (!MAP_INSTANCE) {
        MAP_INSTANCE = L.map('map').setView([latCabang, longCabang], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap'
        }).addTo(MAP_INSTANCE);

        CABANG_MARKER = L.marker([latCabang, longCabang]).addTo(MAP_INSTANCE).bindPopup(`<b>${empCabang.nama_cabang}</b><br>Radius: ${radiusMeters}m`);
        CABANG_CIRCLE = L.circle([latCabang, longCabang], {
          color: '#0d6efd',
          fillColor: '#0d6efd',
          fillOpacity: 0.15,
          radius: radiusMeters
        }).addTo(MAP_INSTANCE);
      } else {
        MAP_INSTANCE.setView([latCabang, longCabang], 16);
      }
      
      setTimeout(() => { if (MAP_INSTANCE) MAP_INSTANCE.invalidateSize(); }, 300);
      setTimeout(() => { if (MAP_INSTANCE) MAP_INSTANCE.invalidateSize(); }, 800);
    }
  } catch (e) {
    console.warn("Gagal memuat peta:", e);
  }

  if (navigator.geolocation) {
    if (statusDiv) statusDiv.innerHTML = `<span class="text-primary fw-bold">Mencari posisi GPS HP Anda...</span>`;
    navigator.geolocation.getCurrentPosition(
      pos => {
        CURRENT_LAT = pos.coords.latitude;
        CURRENT_LONG = pos.coords.longitude;

        const selectedCabangId = isSuperAdmin ? (document.getElementById('adminCabangSelector')?.value || empCabang.id_cabang) : empCabang.id_cabang;
        const currentCabangObj = (GLOBAL_DATA.cabang || []).find(c => String(c.id_cabang) === String(selectedCabangId)) || empCabang;

        const jarak = calculateDistanceLocal(CURRENT_LAT, CURRENT_LONG, Number(currentCabangObj.latitude), Number(currentCabangObj.longitude));
        IS_WITHIN_RADIUS = jarak <= Number(currentCabangObj.radius_meter);

        try {
          if (MAP_INSTANCE) {
            if (!USER_MARKER) {
              USER_MARKER = L.marker([CURRENT_LAT, CURRENT_LONG]).addTo(MAP_INSTANCE);
            } else {
              USER_MARKER.setLatLng([CURRENT_LAT, CURRENT_LONG]);
            }
            MAP_INSTANCE.invalidateSize();
          }
        } catch(e) {}

        const btnIn = document.getElementById('btnCheckIn');
        const btnOut = document.getElementById('btnCheckOut');

        if (statusDiv) {
          const isBebasRadius = (CURRENT_USER.role === 'Admin' || CURRENT_USER.role === 'HRD');

          if (isBebasRadius) {
            statusDiv.innerHTML = `<span class="text-primary fw-bold">👑 Mode Management (${CURRENT_USER.role}): Akses Presensi Bebas Radius</span>`;
            if (btnIn) btnIn.disabled = false;
            if (btnOut) btnOut.disabled = false;
          } else if (IS_WITHIN_RADIUS) {
            if (CABANG_CIRCLE) CABANG_CIRCLE.setStyle({ color: '#198754', fillColor: '#198754' });
            statusDiv.innerHTML = `<span class="text-success fw-bold">✔ Dalam Radius Kantor (${Math.round(jarak)} meter)</span>`;
            if (btnIn) btnIn.disabled = false;
            if (btnOut) btnOut.disabled = false;
          } else {
            if (CABANG_CIRCLE) CABANG_CIRCLE.setStyle({ color: '#dc3545', fillColor: '#dc3545' });
            statusDiv.innerHTML = `<span class="text-danger fw-bold">⚠️ Di Luar Radius Kantor (${Math.round(jarak)}m dari kantor)</span>`;
            if (btnIn) btnIn.disabled = true;
            if (btnOut) btnOut.disabled = true;
          }
        }
      },
      err => {
        let msg = "Akses GPS Gagal.";
        if (err.code === 1) msg = "⚠️ Akses GPS Ditolak! Harap izinkan lokasi di browser HP Anda.";
        else if (err.code === 2) msg = "⚠️ Sinyal GPS tidak ditemukan. Pastikan GPS HP Anda aktif.";
        else if (err.code === 3) msg = "⚠️ Waktu pencarian GPS habis (Timeout). Silakan refresh.";
        
        if (statusDiv) statusDiv.innerHTML = `<span class="text-danger fw-bold">${msg}</span>`;
        if (isSuperAdmin) {
          const btnIn = document.getElementById('btnCheckIn');
          const btnOut = document.getElementById('btnCheckOut');
          if (btnIn) btnIn.disabled = false;
          if (btnOut) btnOut.disabled = false;
        }
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
    );
  } else {
    if (statusDiv) statusDiv.innerHTML = `<span class="text-danger fw-bold">❌ Perangkat/Browser Anda tidak mendukung GPS.</span>`;
  }
}

function changeMapCabangView() {
  const selectedCabangId = document.getElementById('adminCabangSelector')?.value;
  const cabangObj = (GLOBAL_DATA.cabang || []).find(c => String(c.id_cabang) === String(selectedCabangId));
  if (!cabangObj || !MAP_INSTANCE) return;

  const lat = Number(cabangObj.latitude);
  const long = Number(cabangObj.longitude);
  const rad = Number(cabangObj.radius_meter);

  MAP_INSTANCE.setView([lat, long], 16);
  if (CABANG_MARKER) CABANG_MARKER.setLatLng([lat, long]).bindPopup(`<b>${cabangObj.nama_cabang}</b><br>Radius: ${rad}m`).openPopup();
  if (CABANG_CIRCLE) {
    CABANG_CIRCLE.setLatLng([lat, long]);
    CABANG_CIRCLE.setRadius(rad);
  }
  MAP_INSTANCE.invalidateSize();
}

function calculateDistanceLocal(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// 🟢 DIGANTI DENGAN FETCH API
async function kirimPresensi(jenis) {
  const isBebasRadius = (CURRENT_USER && (CURRENT_USER.role === 'Admin' || CURRENT_USER.role === 'HRD'));

  if (!CURRENT_LAT || !CURRENT_LONG) {
    alert('Lokasi GPS belum terdeteksi! Mohon tunggu sebentar atau pastikan GPS HP Anda aktif.');
    return;
  }

  if (!isBebasRadius && !IS_WITHIN_RADIUS) {
    alert('Gagal! Anda berada di luar radius lokasi kantor.');
    return;
  }

  const btnIn = document.getElementById('btnCheckIn');
  const btnOut = document.getElementById('btnCheckOut');
  if (btnIn) btnIn.disabled = true;
  if (btnOut) btnOut.disabled = true;

  try {
    const response = await fetch(`${API_BASE_URL}/api/presensi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_karyawan: CURRENT_USER.id_karyawan,
        latitude: CURRENT_LAT,
        longitude: CURRENT_LONG,
        jenis: jenis
      })
    });

    const res = await response.json();
    if (btnIn) btnIn.disabled = false;
    if (btnOut) btnOut.disabled = false;
    
    alert(res.message);
    if (res.status === 'success') {
      loadAppData();
    }
  } catch (err) {
    if (btnIn) btnIn.disabled = false;
    if (btnOut) btnOut.disabled = false;
    alert("Gagal melakukan presensi: " + err.message);
  }
}