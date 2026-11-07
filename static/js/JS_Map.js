/**
 * ============================================================================
 * LOGIKA PETA & GEOLOKASI (Leaflet & GPS - Migrasi FastAPI Backend)
 * ============================================================================
 */

function initMapAndLocation() {
  const statusDiv = document.getElementById('gpsStatus') || document.getElementById('textStatusRadius');
  const isSuperAdmin = (CURRENT_USER && CURRENT_USER.role === 'Admin');

  if (isSuperAdmin) {
    const adminGroup = document.getElementById('adminCabangSelectorGroup');
    if (adminGroup) adminGroup.classList.remove('d-none');
  }

  // Ambil data cabang dengan fallback aman ke Purwokerto / Default
  let empCabang = (GLOBAL_DATA && GLOBAL_DATA.cabang && GLOBAL_DATA.cabang.length > 0)
    ? (GLOBAL_DATA.cabang.find(c => String(c.id_cabang) === String(CURRENT_USER ? CURRENT_USER.id_cabang : '')) || GLOBAL_DATA.cabang[0])
    : { id_cabang: "CAB-001", latitude: -7.421458, longitude: 109.233322, radius_meter: 100, nama_cabang: 'Kantor Pusat' };

  // Validasi ketat koordinat agar tidak bernilai NaN
  let latCabang = Number(empCabang.latitude);
  let longCabang = Number(empCabang.longitude);
  let radiusMeters = Number(empCabang.radius_meter || empCabang.radius || 100);

  if (isNaN(latCabang) || isNaN(longCabang)) {
    console.warn("Koordinat cabang tidak valid, menggunakan default Purwokerto.");
    latCabang = -7.421458;
    longCabang = 109.233322;
  }

  try {
    const mapEl = document.getElementById('map') || document.getElementById('mapPresensi');
    if (mapEl && typeof L !== 'undefined') {
      const mapId = mapEl.id;

      // Jika container peta berubah atau belum ada instance, bersihkan instance lama jika ada
      if (MAP_INSTANCE && MAP_INSTANCE._container && MAP_INSTANCE._container.id !== mapId) {
        MAP_INSTANCE.remove();
        MAP_INSTANCE = null;
      }

      if (!MAP_INSTANCE) {
        MAP_INSTANCE = L.map(mapId).setView([latCabang, longCabang], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap'
        }).addTo(MAP_INSTANCE);

        CABANG_MARKER = L.marker([latCabang, longCabang]).addTo(MAP_INSTANCE)
          .bindPopup(`<b>${empCabang.nama_cabang || 'Kantor'}</b><br>Radius: ${radiusMeters}m`);
          
        CABANG_CIRCLE = L.circle([latCabang, longCabang], {
          color: '#0d6efd',
          fillColor: '#0d6efd',
          fillOpacity: 0.15,
          radius: radiusMeters
        }).addTo(MAP_INSTANCE);
      } else {
        MAP_INSTANCE.setView([latCabang, longCabang], 16);
        if (CABANG_MARKER) CABANG_MARKER.setLatLng([latCabang, longCabang]);
        if (CABANG_CIRCLE) {
          CABANG_CIRCLE.setLatLng([latCabang, longCabang]);
          CABANG_CIRCLE.setRadius(radiusMeters);
        }
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

        const radCab = Number(currentCabangObj.radius_meter || currentCabangObj.radius || 100);
        const jarak = calculateDistanceLocal(CURRENT_LAT, CURRENT_LONG, Number(currentCabangObj.latitude), Number(currentCabangObj.longitude));
        IS_WITHIN_RADIUS = jarak <= radCab;

        try {
          if (MAP_INSTANCE) {
            if (!USER_MARKER) {
              USER_MARKER = L.marker([CURRENT_LAT, CURRENT_LONG]).addTo(MAP_INSTANCE).bindPopup("<b>Posisi Anda</b>");
            } else {
              USER_MARKER.setLatLng([CURRENT_LAT, CURRENT_LONG]);
            }
            MAP_INSTANCE.invalidateSize();
          }
        } catch(e) {}

        const btnIn = document.getElementById('btnCheckIn');
        const btnOut = document.getElementById('btnCheckOut');

        if (statusDiv) {
          const isBebasRadius = (CURRENT_USER && (CURRENT_USER.role === 'Admin' || CURRENT_USER.role === 'HRD'));

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
            statusDiv.innerHTML = `<span class="text-danger fw-bold">⚠️ Di Luar Radius Kantor (${Math.round(jarak)}m dari kantor, maks ${radCab}m)</span>`;
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
        if (CURRENT_USER && (CURRENT_USER.role === 'Admin' || CURRENT_USER.role === 'HRD')) {
          const btnIn = document.getElementById('btnCheckIn');
          const btnOut = document.getElementById('btnCheckOut');
          if (btnIn) btnIn.disabled = false;
          if (btnOut) btnOut.disabled = false;
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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
  const rad = Number(cabangObj.radius_meter || cabangObj.radius || 100);

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

/**
 * Submit data presensi ke REST API FastAPI menggantikan google.script.run
 */
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

  const payload = {
    id_karyawan: CURRENT_USER.id_karyawan,
    lat_user: CURRENT_LAT,
    long_user: CURRENT_LONG,
    jenis: jenis // 'IN' atau 'OUT'
  };

  try {
    const res = await apiFetch('/api/presensi/submit', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (btnIn) btnIn.disabled = false;
    if (btnOut) btnOut.disabled = false;

    alert(res.message || `✔️ Check-${jenis} Berhasil!`);
    if (res.status === 'success' && typeof loadAppData === 'function') {
      loadAppData();
    }
  } catch (err) {
    if (btnIn) btnIn.disabled = false;
    if (btnOut) btnOut.disabled = false;
    alert("Gagal melakukan presensi: " + err.message);
  }
}

