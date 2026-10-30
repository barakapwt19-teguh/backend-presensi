// Konfigurasi URL Backend FastAPI / Cloudflare Worker
const API_BASE_URL = "https://api-presensi.domain-anda.workers.dev"; // Sesuaikan dengan URL Backend Anda

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
  checkSession();
  setupPWAInstallPrompt();
});

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

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.toggle('active');
  if (overlay) overlay.classList.toggle('show');
}

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