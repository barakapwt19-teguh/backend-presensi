import json
import math
import os
import libsql_client
import asyncio

from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from google.oauth2.service_account import Credentials
import gspread
from pydantic import BaseModel

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

# 1. Definisikan BASE_DIR menggunakan path absolut (Wajib untuk Vercel)
BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(title="Backend Presensi & Operasional Logistik Baraka")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Hubungkan folder Static & Templates dengan path absolut BASE_DIR
static_dir = os.path.join(BASE_DIR, "static")
templates_dir = os.path.join(BASE_DIR, "templates")

if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

templates = Jinja2Templates(directory=templates_dir)

# 3. Rute Utama (Index.html)
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse(
        request=request, 
        name="Index.html"
    )

# 4. Rute Favicon (Mencegah Error 404 Favicon)
@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    favicon_path = os.path.join(static_dir, "favicon.ico")
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path)
    return Response(status_code=204)

# 5. Rute Modals.html (Mencegah Error 404 Modals)
@app.get("/Modals.html", include_in_schema=False)
@app.get("/modals.html", include_in_schema=False)
async def get_modals():
    modals_path = os.path.join(BASE_DIR, "static", "Modals.html")
    if os.path.exists(modals_path):
        return FileResponse(modals_path)
    return Response(status_code=404)

TURSO_URL = os.environ.get("TURSO_DATABASE_URL", "")
TURSO_TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "")

def get_turso_client():
    if not TURSO_URL or not TURSO_TOKEN:
        raise Exception("Konfigurasi Turso URL atau Auth Token belum disetel di environment variables.")
    return libsql_client.create_client(url=TURSO_URL, auth_token=TURSO_TOKEN)

@app.post("/api/sync/sheets-to-turso")
async def sync_sheets_to_turso():
    try:
        raw_karyawan = await asyncio.to_thread(get_data_table, "tb_karyawan")
        client = get_turso_client()
        
        await asyncio.to_thread(
            client.execute,
            """
            CREATE TABLE IF NOT EXISTS tb_karyawan (
                id_karyawan TEXT PRIMARY KEY,
                nama_lengkap TEXT,
                id_cabang TEXT,
                posisi TEXT,
                status TEXT,
                hari_libur_rutin TEXT
            )
            """
        )
        
        for k in raw_karyawan:
            await asyncio.to_thread(
                client.execute,
                """
                INSERT OR REPLACE INTO tb_karyawan (id_karyawan, nama_lengkap, id_cabang, posisi, status, hari_libur_rutin)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    k.get("id_karyawan"),
                    k.get("nama_lengkap"),
                    k.get("id_cabang"),
                    k.get("posisi"),
                    k.get("status"),
                    k.get("hari_libur_rutin", "Minggu")
                )
            )
            
        return {"status": "success", "message": "Berhasil mengimpor data tb_karyawan dari Google Sheets ke Turso Cloud!"}
    except Exception as e:
        import traceback
        err_msg = traceback.format_exc()
        print("DETAIL SYNC ERROR:", err_msg)
        raise HTTPException(status_code=500, detail=f"Gagal sinkronisasi: {str(e)}")

@app.post("/api/sync/turso-to-sheets")
def sync_turso_to_sheets():
    try:
        # Logika untuk mengambil data dari Turso lalu memperbarui Google Sheets via gspread
        # (Dapat disesuaikan dengan kebutuhan tabel rekap Anda)
        return {"status": "success", "message": "Berhasil mengekspor data Turso ke Google Sheets!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class LoginPayload(BaseModel):
    username: str
    password: str

# Konfigurasi Google Sheets
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]
SPREADSHEET_ID = "1FbPrmPU7yslM9nHpzx0mEAMLO4_-MM7V-FPJespPyF4"


def get_gspread_client():
    creds = None
    if os.path.exists("credentials.json"):
        creds = Credentials.from_service_account_file(
            "credentials.json", scopes=SCOPES
        )
    elif "credentials" in os.environ:
        creds_dict = json.loads(os.environ["credentials"])
        creds = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
    elif "GOOGLE_CREDENTIALS" in os.environ:
        creds_dict = json.loads(os.environ["GOOGLE_CREDENTIALS"])
        creds = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
    else:
        raise HTTPException(
            status_code=500,
            detail="Kredensial Google Sheets tidak ditemukan!",
        )
    return gspread.authorize(creds)


def get_sheet(sheet_name: str):
    try:
        client = get_gspread_client()
        spreadsheet = client.open_by_key(SPREADSHEET_ID)
        try:
            return spreadsheet.worksheet(sheet_name)
        except Exception:
            return spreadsheet.get_worksheet(0)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Gagal koneksi Google Sheets: {str(e)}"
        )


# ==========================================
# 2. HELPER UTILITAS DATA & TANGGAL
# ==========================================
def clean_date_str(val: Any) -> str:
    if not val:
        return ""
    s_val = str(val).strip()
    if "1899-12-30" in s_val or "T" in s_val:
        try:
            dt = datetime.fromisoformat(s_val.replace("Z", "+00:00"))
            return dt.strftime("%Y-%m-%d")
        except Exception:
            pass
    if len(s_val) >= 10 and "-" in s_val:
        return s_val[:10]
    return s_val.split("T")[0]


def clean_time_str(val: Any) -> str:
    if not val:
        return ""
    s_val = str(val).strip()
    if " " in s_val:
        parts = s_val.split(" ")
        for p in parts:
            if ":" in p:
                return p[:5]
    return s_val[:5]


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0
    rad = math.pi / 180.0
    d_lat = (lat2 - lat1) * rad
    d_lon = (lon2 - lon1) * rad
    a = math.sin(d_lat / 2.0) ** 2 + math.cos(lat1 * rad) * math.cos(lat2 * rad) * math.sin(d_lon / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def get_nama_hari_indo(dt: datetime) -> str:
    hari_arr = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]
    return hari_arr[dt.weekday() if dt.weekday() != 6 else 0]


def get_data_table(sheet_name: str) -> List[Dict[str, Any]]:
    sheet = get_sheet(sheet_name)
    values = sheet.get_all_values()
    if not values or len(values) <= 1:
        return []

    headers = [str(h).strip() for h in values[0]]
    result = []

    if sheet_name == "tb_karyawan":
        for r in values[1:]:
            if not r or not r[0]:
                continue
            id_cab = str(r[3]).strip() if len(r) > 3 else ""
            result.append(
                {
                    "id_karyawan": str(r[0]).strip(),
                    "nama_lengkap": str(r[1]) if len(r) > 1 else "",
                    "posisi": str(r[2]) if len(r) > 2 else "",
                    "jabatan": str(r[2]) if len(r) > 2 else "",
                    "id_cabang": id_cab,
                    "tb_cabang": id_cab,
                    "email": str(r[4]) if len(r) > 4 else "",
                    "role": str(r[5]) if len(r) > 5 else "",
                    "username": str(r[6]) if len(r) > 6 else "",
                    "password": str(r[7]) if len(r) > 7 else "",
                    "gaji_harian": float(r[8]) if len(r) > 8 and r[8] else 0.0,
                    "hari_libur_rutin": str(r[9]) if len(r) > 9 else "Minggu",
                    "status": str(r[10]) if len(r) > 10 else "Aktif",
                    "insentif_khusus": float(r[11]) if len(r) > 11 and r[11] else 0.0,
                    "tipe_insentif": str(r[12]) if len(r) > 12 and r[12] else "Harian",
                }
            )
        return result

    for row in values[1:]:
        obj = {}
        has_data = False
        for idx, header_key in enumerate(headers):
            val = row[idx] if idx < len(row) else ""
            if "jam" in header_key:
                val = clean_time_str(val)
            elif "tanggal" in header_key or "tgl" in header_key or "periode" in header_key:
                val = clean_date_str(val)
            obj[header_key] = str(val) if val is not None else ""
            if obj[header_key] != "":
                has_data = True
        if has_data:
            result.append(obj)

    return result


def is_karyawan_libur(
    emp: Dict[str, Any],
    date_obj: datetime,
    list_libur: List[Dict],
    list_tukar: List[Dict],
) -> bool:
    if not emp or not date_obj:
        return False
    tgl_str = clean_date_str(date_obj)
    nama_hari = get_nama_hari_indo(date_obj)

    for t in list_tukar:
        if str(t.get("status")) == "Disetujui":
            if (
                str(t.get("id_pemohon")) == str(emp["id_karyawan"])
                and clean_date_str(t.get("tgl_pengganti")) == tgl_str
            ) or (
                str(t.get("id_pengganti")) == str(emp["id_karyawan"])
                and clean_date_str(t.get("tgl_pemohon")) == tgl_str
            ):
                return True
            if (
                str(t.get("id_pemohon")) == str(emp["id_karyawan"])
                and clean_date_str(t.get("tgl_pemohon")) == tgl_str
            ) or (
                str(t.get("id_pengganti")) == str(emp["id_karyawan"])
                and clean_date_str(t.get("tgl_pengganti")) == tgl_str
            ):
                return False

    for l in list_libur:
        if (
            str(l.get("id_karyawan")) == str(emp["id_karyawan"])
            or str(l.get("id_karyawan")) == "ALL"
        ) and clean_date_str(l.get("tanggal")) == tgl_str:
            return True

    if emp.get("hari_libur_rutin", "").strip().lower() == nama_hari.lower():
        return True

    return False


def get_senin_minggu_range(date_obj: datetime) -> Dict[str, str]:
    weekday = date_obj.weekday()  # Monday=0, Sunday=6
    monday = date_obj - timedelta(days=weekday)
    sunday = monday + timedelta(days=6)
    return {
        "mulai": monday.strftime("%Y-%m-%d"),
        "selesai": sunday.strftime("%Y-%m-%d"),
    }


# ==========================================
# 3. PYDANTIC SCHEMAS
# ==========================================
class LoginPayload(BaseModel):
    username: str
    password: str

@app.post("/api/auth/login")
@app.post("/api/login")
def login_user(payload: LoginPayload):
    try:
        list_karyawan = get_data_table("tb_karyawan")
        user = None
        for k in list_karyawan:
            if (
                str(k.get("username", "")).strip() == payload.username.strip()
                and str(k.get("password", "")).strip() == payload.password.strip()
            ):
                user = k
                break

        if not user:
            return {"status": "error", "message": "Username atau Password salah!"}
        if str(user.get("status")) != "Aktif":
            return {"status": "error", "message": "Akun Anda non-aktif. Hubungi HRD."}

        return {
            "status": "success",
            "message": "Login berhasil!",
            "user": {
                "id_karyawan": user.get("id_karyawan"),
                "nama_lengkap": user.get("nama_lengkap"),
                "posisi": user.get("posisi") or user.get("jabatan"),
                "id_cabang": user.get("id_cabang"),
                "email": user.get("email"),
                "role": user.get("role"),
                "hari_libur_rutin": user.get("hari_libur_rutin"),
            },
        }
    except Exception as err:
        return {"status": "error", "message": f"Error Login: {str(err)}"}


class PresensiProcessPayload(BaseModel):
    id_karyawan: str
    lat_user: float
    long_user: float
    jenis: str  # 'IN' / 'OUT'


class InsentifKhususPayload(BaseModel):
    id_cabang: Optional[str] = "Semua"
    nominalInsentifKhusus: Optional[float] = 0
    karyawanKhusus: Optional[str] = ""
    minHadirKhusus: Optional[int] = 5
    potonganTerlambat: Optional[float] = 0
    bonusFull7Hari: Optional[float] = 0


class RuleUmumCabangPayload(BaseModel):
    id_cabang: Optional[str] = "Semua"
    jamOvertime: Optional[str] = "17:30"
    nominalOvertime: Optional[float] = 15000
    nominalKerjaPagi: Optional[float] = 10000
    nominalUangMakan: Optional[float] = 15000


class AreaDistribusiPayload(BaseModel):
    nama_area: str
    id_cabang: str
    nopol_default: Optional[str] = ""


class PenugasanJadwalItem(BaseModel):
    tanggal: str
    id_sopir: str
    id_kenek: Optional[str] = ""
    id_gudang: Optional[str] = ""
    id_area: str
    nopol_armada: Optional[str] = ""
    keterangan: Optional[str] = ""


class MingguanJadwalPayload(BaseModel):
    id_cabang: str
    id_foreman: Optional[str] = ""
    daftar_penugasan: List[PenugasanJadwalItem]


class UpdateJadwalPayload(BaseModel):
    id_jadwal: str
    id_sopir: str
    id_kenek: Optional[str] = ""
    id_gudang: Optional[str] = ""
    id_area: str
    nopol_armada: Optional[str] = ""
    keterangan: Optional[str] = ""


class TukarLiburPayload(BaseModel):
    id_pemohon: str
    tgl_pemohon: str
    id_pengganti: str
    tgl_pengganti: str
    alasan: str


class ResponTukarLiburPayload(BaseModel):
    id_tukar: str
    status: str


class IzinPayload(BaseModel):
    id_karyawan: str
    tgl_mulai: str
    tgl_selesai: str
    jenis: str
    keterangan: str


class UpdateIzinACCPayload(BaseModel):
    id_izin: str
    status: str


class KasbonPayload(BaseModel):
    id_karyawan: str
    nominal: float
    keterangan: str
    operator_id: str
    operator_role: str


class KoreksiPresensiPayload(BaseModel):
    id_presensi: str
    jam_masuk: str
    jam_keluar: str
    dapat_kerja_pagi: str
    dapat_uang_makan: str
    catatan_koreksi: str


class TogglePenandaPayload(BaseModel):
    id_presensi: str
    tipe: str  # 'kerja_pagi' / 'uang_makan'
    status: str


class SimpanPayrollPayload(BaseModel):
    tgl_mulai: str
    tgl_selesai: str
    data_payroll: List[Dict[str, Any]]


class UpdateKaryawanPayload(BaseModel):
    id_karyawan: str
    nama: str
    posisi: str
    id_cabang: str
    email: str
    role: str
    gaji_harian: float
    hari_libur_rutin: str
    status: str
    insentif_khusus: float


class UpdateCabangPayload(BaseModel):
    id_cabang: str
    nama_cabang: str
    latitude: float
    longitude: float
    radius: float


class UpdateAbsensiPayload(BaseModel):
    id_absen: str
    jam_masuk: str
    jam_keluar: str


# ==========================================
# 4. LOGIKA UTAMA & ENDPOINTS
# ==========================================

@app.post("/api/setup-database")
def setup_database():
    sheet_client = get_gspread_client()
    ss = sheet_client.open_by_key(SPREADSHEET_ID)

    schema = {
        "tb_pengaturan": [
            ["key", "value"],
            ["app_name", "Sistem Operasional Logistik"],
            ["app_description", "Portal Presensi & Penjadwalan Distribusi"],
            ["app_logo", "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"],
            ["app_announcement", "Selamat datang di portal presensi & operasional."],
            ["contact_info", "HRD/Admin: 08123456789"],
        ],
        "tb_pengaturan_gaji": [
            ["key", "value"],
            ["jamOvertime", "17:30"],
            ["nominalOvertime", "15000"],
            ["nominalKerjaPagi", "10000"],
            ["nominalUangMakan", "15000"],
            ["nominalInsentifKhusus", "50000"],
            ["minHadirKhusus", "5"],
            ["potonganTerlambat", "10000"],
            ["bonusFull7Hari", "50000"],
            ["karyawanKhusus", "EMP003,EMP004"],
        ],
        "tb_karyawan": [
            [
                "id_karyawan", "nama_lengkap", "posisi", "tb_cabang", "email",
                "role", "username", "password", "gaji_harian", "hari_libur_rutin",
                "status", "insentif_khusus", "tipe_insentif",
            ],
            ["EMP001", "Admin Sistem", "Super Admin", "CAB001", "admin@mail.com", "Admin", "admin", "admin123", 150000, "Minggu", "Aktif", 0, "Harian"],
            ["EMP002", "Manager HRD", "HRD", "CAB001", "hrd@mail.com", "HRD", "hrd", "hrd123", 140000, "Minggu", "Aktif", 0, "Harian"],
            ["EMP003", "Budi Santoso", "Sopir", "CAB001", "budi@mail.com", "Karyawan", "budi", "123456", 100000, "Minggu", "Aktif", 0, "Harian"],
            ["EMP004", "Agus Setiawan", "Kenek", "CAB001", "agus@mail.com", "Karyawan", "agus", "123456", 90000, "Minggu", "Aktif", 0, "Harian"],
            ["EMP005", "Dedi Gudang", "Staf Gudang", "CAB001", "dedi@mail.com", "Karyawan", "dedi", "123456", 95000, "Minggu", "Aktif", 0, "Harian"],
            ["EMP006", "Siti Foreman", "Foreman Cabang", "CAB001", "admincabang@mail.com", "Admin Cabang", "admincabang", "cabang123", 120000, "Minggu", "Aktif", 0, "Harian"],
            ["EMP007", "Rina Admin", "Staf Admin Cabang", "CAB001", "stafadmin@mail.com", "Staf Admin Cabang", "stafadmin", "staf123", 110000, "Minggu", "Aktif", 0, "Harian"],
        ],
        "tb_cabang": [
            ["id_cabang", "nama_cabang", "latitude", "longitude", "radius_meter"],
            ["CAB001", "Kantor Pusat", -6.200000, 106.816666, 100],
        ],
        "tb_area_distribusi": [
            ["id_area", "nama_area", "id_cabang", "nopol_default"],
            ["AREA001", "Purwokerto Kota & Baturraden", "CAB001", "R 8923 BS"],
            ["AREA002", "Cilacap Barat & Sidareja", "CAB001", "R 9102 CR"],
        ],
        "tb_jadwal_distribusi": [
            [
                "id_jadwal", "tanggal", "id_cabang", "id_foreman", "id_sopir",
                "id_kenek", "id_gudang", "id_area", "nopol_armada", "keterangan"
            ]
        ],
        "tb_absensi": [
            [
                "id_absen", "id_karyawan", "tanggal", "jam_masuk", "jam_keluar",
                "koordinat", "status_radius", "dapat_kerja_pagi", "dapat_uang_makan", "catatan_koreksi"
            ]
        ],
        "tb_izin": [
            ["id_izin", "id_karyawan", "tgl_mulai", "tgl_selesai", "jenis", "keterangan", "status"]
        ],
        "tb_tukar_libur": [
            ["id_tukar", "id_pemohon", "tgl_pemohon", "id_pengganti", "tgl_pengganti", "alasan", "status"]
        ],
        "tb_libur": [["id_libur", "id_karyawan", "tanggal", "keterangan"]],
        "tb_kasbon": [
            ["id_kasbon", "id_karyawan", "tanggal", "nominal", "bayar_cicilan", "sisa_kasbon", "keterangan", "status"]
        ],
        "tb_payroll": [
            [
                "id_payroll", "id_karyawan", "periode_mulai", "periode_selesai",
                "gaji_harian", "subtotal", "lain_lain", "potongan_kasbon", "total_diterima", "tanggal_dibuat"
            ]
        ],
    }

    existing_sheets = [s.title for s in ss.worksheets()]
    for sheet_name, rows in schema.items():
        if sheet_name not in existing_sheets:
            ws = ss.add_worksheet(title=sheet_name, rows="100", cols=str(len(rows[0])))
        else:
            ws = ss.worksheet(sheet_name)

        if ws.row_count == 0 or not ws.get_all_values():
            ws.update("A1", rows)

    return {"status": "success", "message": "Setup Database Google Sheets Berhasil Disiapkan!"}


def kalkulasi_payroll_mingguan(
    tgl_awal: str, tgl_akhir: str, id_cabang: str
) -> List[Dict[str, Any]]:
    list_emp = get_data_table("tb_karyawan")
    list_absen = get_data_table("tb_absensi")
    list_kasbon = get_data_table("tb_kasbon")
    list_pengaturan = get_data_table("tb_pengaturan_gaji")
    list_saved_payroll = get_data_table("tb_payroll")

    str_awal = clean_date_str(tgl_awal)
    str_akhir = clean_date_str(tgl_akhir)

    map_saved_potongan = {}
    for row_pay in list_saved_payroll:
        p_emp_id = str(row_pay.get("id_karyawan", "")).strip()
        p_start = clean_date_str(row_pay.get("periode_mulai") or row_pay.get("tgl_mulai"))
        p_end = clean_date_str(row_pay.get("periode_selesai") or row_pay.get("tgl_selesai"))

        if p_emp_id and p_start == str_awal and p_end == str_akhir:
            p_pot = row_pay.get("potongan_kasbon", 0)
            map_saved_potongan[p_emp_id] = float(p_pot or 0)

    config_map = {
        str(r.get("key")).strip(): str(r.get("value", "")).strip()
        for r in list_pengaturan
        if r.get("key")
    }

    min_hadir_khusus = int(config_map.get("minHadirKhusus", 5))
    nominal_potong_terlambat = float(config_map.get("potonganTerlambat", 0))
    bonus_full_7hari = float(config_map.get("bonusFull7Hari", 0))

    rekap_payroll = []
    filter_cabang_norm = str(id_cabang or "").strip().lower()

    for emp in list_emp:
        emp_id_str = str(emp.get("id_karyawan", "")).strip()
        if not emp_id_str or str(emp.get("status", "")).strip().lower() != "aktif":
            continue

        val_cabang = str(emp.get("id_cabang") or emp.get("tb_cabang") or "").strip()
        emp_cabang_norm = val_cabang.lower()

        if filter_cabang_norm not in ["", "all", "semua", "undefined"]:
            if emp_cabang_norm != filter_cabang_norm and filter_cabang_norm not in emp_cabang_norm:
                continue

        jam_overtime = (
            config_map.get(f"jamOvertime_{val_cabang}")
            or config_map.get("jamOvertime_Semua")
            or config_map.get("jamOvertime", "17:30")
        )
        nominal_overtime = float(
            config_map.get(f"nominalOvertime_{val_cabang}")
            or config_map.get("nominalOvertime_Semua")
            or config_map.get("nominalOvertime", 15000)
        )
        nominal_kerja_pagi = float(
            config_map.get(f"nominalKerjaPagi_{val_cabang}")
            or config_map.get("nominalKerjaPagi_Semua")
            or config_map.get("nominalKerjaPagi", 10000)
        )
        nominal_uang_makan = float(
            config_map.get(f"nominalUangMakan_{val_cabang}")
            or config_map.get("nominalUangMakan_Semua")
            or config_map.get("nominalUangMakan", 15000)
        )

        total_hadir = 0.0
        total_kerja_pagi = 0.0
        total_uang_makan = 0.0
        total_overtime = 0.0
        total_terlambat = 0

        for ab in list_absen:
            ab_emp_id = str(ab.get("id_karyawan", "")).strip()
            ab_tgl = clean_date_str(ab.get("tanggal"))
            j_masuk = str(ab.get("jam_masuk", "")).strip()
            j_keluar = str(ab.get("jam_keluar", "")).strip()

            if ab_emp_id == emp_id_str and str_awal <= ab_tgl <= str_akhir:
                if j_masuk and j_masuk != "-":
                    if j_keluar and j_keluar not in ["-", "23:59:59", "23:59"]:
                        jam_keluar_clean = clean_time_str(j_keluar)
                        if jam_keluar_clean < "16:30":
                            total_hadir += 0.5
                        else:
                            total_hadir += 1.0

                        if jam_keluar_clean > clean_time_str(jam_overtime):
                            total_overtime += nominal_overtime
                    else:
                        total_hadir += 1.0

                    jam_masuk_clean = clean_time_str(j_masuk)
                    if jam_masuk_clean > "08:15":
                        total_terlambat += 1

                    if str(ab.get("dapat_kerja_pagi", "")).lower() == "ya":
                        total_kerja_pagi += nominal_kerja_pagi

                    if str(ab.get("dapat_uang_makan", "")).lower() == "ya":
                        total_uang_makan += nominal_uang_makan

        raw_khusus_cabang = (
            config_map.get(f"karyawanKhusus_{val_cabang}")
            or config_map.get("karyawanKhusus_Semua")
            or config_map.get("karyawanKhusus", "")
        )
        list_khusus_cabang = [x.strip() for x in raw_khusus_cabang.split(",") if x.strip()]

        nominal_khusus_cabang = float(
            config_map.get(f"nominalInsentifKhusus_{val_cabang}")
            or config_map.get("nominalInsentifKhusus_Semua")
            or config_map.get("nominalInsentifKhusus", 0)
        )

        insentif_khusus_tetap = float(emp.get("insentif_khusus", 0))
        insentif_khusus_kondisional = 0.0

        if emp_id_str in list_khusus_cabang:
            if total_hadir >= min_hadir_khusus:
                insentif_khusus_kondisional = nominal_khusus_cabang
                if total_terlambat > 0 and nominal_potong_terlambat > 0:
                    total_denda = total_terlambat * nominal_potong_terlambat
                    insentif_khusus_kondisional = max(0.0, insentif_khusus_kondisional - total_denda)

        total_bonus_7hari = bonus_full_7hari if total_hadir >= 7 and bonus_full_7hari > 0 else 0.0
        total_lain_lain = (
            total_kerja_pagi
            + total_uang_makan
            + total_overtime
            + insentif_khusus_tetap
            + insentif_khusus_kondisional
            + total_bonus_7hari
        )

        gaji_harian = float(emp.get("gaji_harian", 0))
        subtotal = total_hadir * gaji_harian

        total_sisa_kasbon_aktif = 0.0
        for kb in list_kasbon:
            if str(kb.get("id_karyawan", "")).strip() == emp_id_str and str(kb.get("status", "")).strip() != "Lunas":
                total_sisa_kasbon_aktif += float(
                    kb.get("sisa_kasbon") if kb.get("sisa_kasbon") != "" else kb.get("nominal", 0)
                )

        final_potong_kasbon = map_saved_potongan.get(emp_id_str, 0.0)
        raw_gaji_diterima = subtotal + total_lain_lain - final_potong_kasbon
        total_gaji_diterima = math.ceil(max(0.0, raw_gaji_diterima) / 1000.0) * 1000

        rekap_payroll.append(
            {
                "id_karyawan": emp_id_str,
                "nama": str(emp.get("nama_lengkap") or emp_id_str),
                "posisi": str(emp.get("jabatan") or emp.get("posisi") or "-"),
                "id_cabang": val_cabang,
                "tb_cabang": val_cabang,
                "gaji_harian": gaji_harian,
                "total_hadir": total_hadir,
                "total_terlambat": total_terlambat,
                "total_izin": 0,
                "total_alpha": 0,
                "subtotal": subtotal,
                "komponen_pagi": total_kerja_pagi,
                "komponen_makan": total_uang_makan,
                "komponen_overtime": total_overtime,
                "komponen_khusus_tetap": insentif_khusus_tetap,
                "komponen_khusus_syarat": insentif_khusus_kondisional,
                "komponen_bonus_7hari": total_bonus_7hari,
                "lain_lain": total_lain_lain,
                "total_sisa_kasbon": total_sisa_kasbon_aktif,
                "potongan_kasbon": final_potong_kasbon,
                "total_diterima": total_gaji_diterima,
            }
        )

    return rekap_payroll


# ENDPOINT TAMBAHAN: Kalkulasi Payroll untuk dipanggil JS
@app.get("/api/kalkulasi-payroll")
def get_kalkulasi_payroll(tgl_mulai: str, tgl_selesai: str, id_cabang: Optional[str] = "Semua"):
    try:
        data = kalkulasi_payroll_mingguan(tgl_mulai, tgl_selesai, id_cabang)
        return {"status": "success", "payroll": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/app/initial-data")
@app.get("/api/initial-data")
def get_initial_data(id_karyawan: str = "", role: str = ""):
    try:
        all_karyawan = get_data_table("tb_karyawan")
        raw_absensi = get_data_table("tb_absensi")
        raw_izin = get_data_table("tb_izin")
        raw_tukar = get_data_table("tb_tukar_libur")
        raw_libur = get_data_table("tb_libur")
        raw_kasbon = get_data_table("tb_kasbon")
        raw_payroll = get_data_table("tb_payroll")
        raw_area = get_data_table("tb_area_distribusi")
        raw_jadwal = get_data_table("tb_jadwal_distribusi")
        settings_data = get_data_table("tb_pengaturan")
        raw_pengaturan_gaji = get_data_table("tb_pengaturan_gaji")
        raw_cabang = get_data_table("tb_cabang")

        settings = {r["key"]: r["value"] for r in settings_data if r.get("key")}
        
        now = datetime.now()

        all_absensi = []
        for idx, row in enumerate(raw_absensi):
            item = {
                "rowIndex": idx + 2,
                "id_absen": str(row.get("id_absen") or row.get("id_presensi") or ""),
                "id_karyawan": str(row.get("id_karyawan") or ""),
                "tanggal": clean_date_str(row.get("tanggal")),
                "jam_masuk": clean_time_str(row.get("jam_masuk")),
                "jam_keluar": clean_time_str(row.get("jam_keluar")),
                "koordinat": str(row.get("koordinat") or ""),
                "status_radius": str(row.get("status_radius") or row.get("status") or ""),
                "dapat_kerja_pagi": "Ya" if str(row.get("dapat_kerja_pagi")).lower() in ["ya", "true"] else "Tidak",
                "dapat_uang_makan": "Ya" if str(row.get("dapat_uang_makan")).lower() in ["ya", "true"] else "Tidak",
                "catatan_koreksi": str(row.get("catatan_koreksi") or ""),
            }
            all_absensi.append(item)

        return {
            "settings": settings,
            "allKaryawanPublic": [
                {
                    "id_karyawan": k["id_karyawan"],
                    "nama_lengkap": k["nama_lengkap"],
                    "id_cabang": k["id_cabang"],
                    "posisi": k["posisi"],
                    "hari_libur_rutin": k.get("hari_libur_rutin", "Minggu"),
                }
                for k in all_karyawan if k.get("status") == "Aktif"
            ],
            "cabang": raw_cabang,
            "area": raw_area,
            "jadwal": raw_jadwal,
            "absensi": all_absensi,
            "izin": raw_izin,
            "tukarLibur": raw_tukar,
            "libur": raw_libur,
            "kasbon": raw_kasbon,
            "payroll": raw_payroll,
            "pengaturanGaji": raw_pengaturan_gaji,
            "statusAbsen": "BELUM_ABSEN",
            "periodeMingguIni": {
                "mulai": (now - timedelta(days=now.weekday())).strftime("%Y-%m-%d"),
                "selesai": (now + timedelta(days=6 - now.weekday())).strftime("%Y-%m-%d"),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal memproses data server: {str(e)}")


@app.post("/api/proses-presensi")
def proses_presensi(payload: PresensiProcessPayload):
    try:
        list_karyawan = get_data_table("tb_karyawan")
        list_cabang = get_data_table("tb_cabang")
        list_izin = get_data_table("tb_izin")

        now = datetime.now()
        tgl_str = now.strftime("%Y-%m-%d")

        emp = next((k for k in list_karyawan if str(k.get("id_karyawan")).strip() == str(payload.id_karyawan).strip()), None)
        if not emp:
            return {"status": "error", "message": "ID Karyawan tidak ditemukan!"}

        for iz in list_izin:
            if str(iz.get("id_karyawan")) == str(payload.id_karyawan) and str(iz.get("status")) != "Ditolak":
                t_m = clean_date_str(iz.get("tgl_mulai"))
                t_s = clean_date_str(iz.get("tgl_selesai"))
                if t_m <= tgl_str <= t_s:
                    return {
                        "status": "error",
                        "message": "Anda telah mengajukan Izin/Cuti untuk hari ini. Presensi tidak diizinkan!",
                    }

        cabang = next((c for c in list_cabang if str(c.get("id_cabang")) == str(emp.get("id_cabang"))), None)
        is_bebas_radius = emp.get("role") in ["Admin", "HRD"]

        if not is_bebas_radius:
            if not cabang:
                return {
                    "status": "error",
                    "message": "Lokasi cabang tempat bertugas tidak valid!",
                }
            jarak = calculate_distance(
                payload.lat_user,
                payload.long_user,
                float(cabang["latitude"]),
                float(cabang["longitude"]),
            )
            if jarak > float(cabang["radius_meter"]):
                return {
                    "status": "error",
                    "message": f"Gagal Presensi! Anda berada di luar radius kantor ({round(jarak)}m).",
                }

        sheet = get_sheet("tb_absensi")
        jam_str = now.strftime("%H:%M:%S")
        data_absen = sheet.get_all_values()

        is_late = now.hour > 8 or (now.hour == 8 and now.minute > 15)
        list_badge = []
        if is_late:
            list_badge.append("Terlambat")

        if is_bebas_radius:
            list_badge.append(f"Bebas Radius ({emp.get('role')})")
        else:
            list_badge.append("Dalam Radius")

        status_fix_text = ", ".join(list_badge)

        if payload.jenis == "IN":
            for row in data_absen[1:]:
                if (
                    len(row) > 2
                    and str(row[1]).strip() == str(payload.id_karyawan).strip()
                    and clean_date_str(row[2]) == tgl_str
                ):
                    return {
                        "status": "error",
                        "message": "Anda sudah melakukan Check-in hari ini!",
                    }

            id_absen = f"ABS{str(len(data_absen)).zfill(4)}"
            sheet.append_row(
                [
                    id_absen,
                    payload.id_karyawan,
                    tgl_str,
                    jam_str,
                    "",
                    f"{payload.lat_user},{payload.long_user}",
                    status_fix_text,
                    "Tidak",
                    "Tidak",
                    "",
                ]
            )

            late_msg = "\n⚠️ Catatan: Anda dicatat TERLAMBAT (Presensi setelah jam 08.15)." if is_late else ""
            return {
                "status": "success",
                "message": f"Check-in Berhasil jam {jam_str}!{late_msg}",
            }

        elif payload.jenis == "OUT":
            for idx, row in enumerate(data_absen[1:], start=2):
                if (
                    len(row) > 2
                    and str(row[1]).strip() == str(payload.id_karyawan).strip()
                    and clean_date_str(row[2]) == tgl_str
                ):
                    j_out_existing = str(row[4]).strip() if len(row) > 4 else ""
                    if j_out_existing and j_out_existing not in ["-", "23:59:59"]:
                        return {
                            "status": "error",
                            "message": f"Anda sudah melakukan Check-out sebelumnya jam {j_out_existing}",
                        }

                    sheet.update_cell(idx, 5, jam_str)
                    return {
                        "status": "success",
                        "message": f"Check-out Berhasil jam {jam_str}!",
                    }

            return {
                "status": "error",
                "message": "Anda belum Check-in hari ini!",
            }

    except Exception as err:
        return {"status": "error", "message": f"Gagal Presensi: {str(err)}"}


@app.post("/api/simpan-insentif-khusus")
def simpan_insentif_khusus(payload: InsentifKhususPayload):
    try:
        sheet = get_sheet("tb_pengaturan_gaji")
        id_cab = str(payload.id_cabang or "Semua").strip()
        data = sheet.get_all_values()

        updates = {
            f"nominalInsentifKhusus_{id_cab}": payload.nominalInsentifKhusus,
            f"karyawanKhusus_{id_cab}": payload.karyawanKhusus or "",
            "minHadirKhusus": payload.minHadirKhusus,
            "potonganTerlambat": payload.potonganTerlambat,
            "bonusFull7Hari": payload.bonusFull7Hari,
        }

        updated_keys = []
        for idx, row in enumerate(data[1:], start=2):
            key = str(row[0]).strip()
            if key in updates:
                sheet.update_cell(idx, 2, updates[key])
                updated_keys.append(key)

        for k, v in updates.items():
            if k not in updated_keys:
                sheet.append_row([k, v])

        return {
            "status": "success",
            "message": f"Aturan insentif khusus cabang {id_cab} berhasil disimpan",
        }
    except Exception as err:
        raise HTTPException(
            status_code=500, detail=f"Gagal simpan insentif khusus: {str(err)}"
        )


@app.post("/api/simpan-rule-umum-cabang")
def simpan_rule_umum_cabang(payload: RuleUmumCabangPayload):
    try:
        sheet = get_sheet("tb_pengaturan_gaji")
        id_cab = str(payload.id_cabang or "Semua").strip()
        data = sheet.get_all_values()

        updates = {
            f"jamOvertime_{id_cab}": payload.jamOvertime,
            f"nominalOvertime_{id_cab}": payload.nominalOvertime,
            f"nominalKerjaPagi_{id_cab}": payload.nominalKerjaPagi,
            f"nominalUangMakan_{id_cab}": payload.nominalUangMakan,
        }

        updated_keys = []
        for idx, row in enumerate(data[1:], start=2):
            key = str(row[0]).strip()
            if key in updates:
                sheet.update_cell(idx, 2, updates[key])
                updated_keys.append(key)

        for k, v in updates.items():
            if k not in updated_keys:
                sheet.append_row([k, v])

        return {
            "status": "success",
            "message": "Rule payroll cabang berhasil diperbarui",
        }
    except Exception as err:
        raise HTTPException(
            status_code=500, detail=f"Gagal simpan rule cabang: {str(err)}"
        )


@app.post("/api/tambah-kasbon")
def tambah_kasbon(payload: KasbonPayload):
    try:
        if payload.operator_role == "Staf Admin Cabang":
            return {
                "status": "error",
                "message": "Akses Ditolak! Staf Admin Cabang tidak memiliki hak akses kasbon.",
            }

        list_karyawan = get_data_table("tb_karyawan")
        target_emp = next((k for k in list_karyawan if str(k.get("id_karyawan")) == str(payload.id_karyawan)), None)
        operator_emp = next((k for k in list_karyawan if str(k.get("id_karyawan")) == str(payload.operator_id)), None)

        if not target_emp:
            return {
                "status": "error",
                "message": "Karyawan penerima kasbon tidak ditemukan!",
            }

        if payload.operator_role == "Admin Cabang" and operator_emp:
            if str(target_emp.get("id_cabang")) != str(operator_emp.get("id_cabang")):
                return {
                    "status": "error",
                    "message": "Akses Ditolak! Anda hanya bisa mencatat kasbon untuk karyawan di cabang Anda.",
                }

        sheet = get_sheet("tb_kasbon")
        data = sheet.get_all_values()
        tgl_str = datetime.now().strftime("%Y-%m-%d")
        nom_tambahan = float(payload.nominal or 0)
        emp_id_str = str(payload.id_karyawan).strip()

        if nom_tambahan <= 0:
            return {
                "status": "error",
                "message": "Nominal kasbon harus lebih dari 0!",
            }

        existing_row_index = -1
        current_nominal_awal = 0.0
        current_cicilan = 0.0
        current_sisa = 0.0
        current_ket = ""

        for idx, row in enumerate(data[1:], start=2):
            row_emp_id = str(row[1]).strip() if len(row) > 1 else ""
            status_db = str(row[7]).strip() if len(row) > 7 else ""

            if row_emp_id == emp_id_str and status_db != "Lunas":
                existing_row_index = idx
                current_nominal_awal = float(row[3]) if len(row) > 3 and row[3] else 0.0
                current_cicilan = float(row[4]) if len(row) > 4 and row[4] else 0.0
                current_sisa = (
                    float(row[5])
                    if len(row) > 5 and row[5] != ""
                    else (current_nominal_awal - current_cicilan)
                )
                current_ket = str(row[6]) if len(row) > 6 else ""
                break

        if existing_row_index > 0:
            new_nominal_awal = current_nominal_awal + nom_tambahan
            new_sisa = current_sisa + nom_tambahan
            new_ket = (
                f"{current_ket} | Tambah: Rp {int(nom_tambahan):,} ({tgl_str})"
                if current_ket
                else payload.keterangan
            )

            sheet.update_cell(existing_row_index, 4, new_nominal_awal)
            sheet.update_cell(existing_row_index, 6, new_sisa)
            sheet.update_cell(existing_row_index, 7, new_ket)

            return {
                "status": "success",
                "message": f"Kasbon berhasil diakumulasikan! Sisa kasbon {target_emp.get('nama_lengkap')} saat ini: Rp {int(new_sisa):,}",
            }
        else:
            id_kasbon = f"KSB{str(len(data)).zfill(4)}"
            sheet.append_row(
                [
                    id_kasbon,
                    emp_id_str,
                    tgl_str,
                    nom_tambahan,
                    0,
                    nom_tambahan,
                    payload.keterangan,
                    "Belum Lunas",
                ]
            )
            return {
                "status": "success",
                "message": "Kasbon baru berhasil dicatat!",
            }

    except Exception as err:
        return {
            "status": "error",
            "message": f"Gagal mencatat kasbon: {str(err)}",
        }


@app.post("/api/simpan-payroll")
def simpan_payroll(payload: SimpanPayrollPayload):
    try:
        if not payload.data_payroll:
            return {
                "status": "error",
                "message": "Data payroll kosong atau tidak valid!",
            }

        sheet_pay = get_sheet("tb_payroll")
        sheet_kasbon = get_sheet("tb_kasbon")
        now_str = datetime.now().strftime("%Y-%m-%d")

        str_start = clean_date_str(payload.tgl_mulai)
        str_end = clean_date_str(payload.tgl_selesai)

        pay_data = sheet_pay.get_all_values()

        for p in payload.data_payroll:
            pot_kasbon_baru = float(p.get("potongan_kasbon") or 0)
            emp_id_str = str(p.get("id_karyawan") or "").strip()

            existing_row_index = -1
            pot_kasbon_lama = 0.0

            for idx, row in enumerate(pay_data[1:], start=2):
                row_emp_id = str(row[1]).strip() if len(row) > 1 else ""
                row_start = clean_date_str(row[2]) if len(row) > 2 else ""
                row_end = clean_date_str(row[3]) if len(row) > 3 else ""

                if (
                    row_emp_id == emp_id_str
                    and row_start == str_start
                    and row_end == str_end
                ):
                    existing_row_index = idx
                    pot_kasbon_lama = float(row[7]) if len(row) > 7 and row[7] else 0.0
                    break

            selisih_potongan = pot_kasbon_baru - pot_kasbon_lama

            if selisih_potongan != 0 and sheet_kasbon:
                kasbon_data = sheet_kasbon.get_all_values()

                if selisih_potongan > 0:
                    sisa_potong = selisih_potongan
                    for j, k_row in enumerate(kasbon_data[1:], start=2):
                        status_db = str(k_row[7]).strip() if len(k_row) > 7 else ""
                        if (
                            str(k_row[1]).strip() == emp_id_str
                            and status_db != "Lunas"
                        ):
                            nominal_awal = float(k_row[3]) if len(k_row) > 3 and k_row[3] else 0.0
                            prev_cicilan = float(k_row[4]) if len(k_row) > 4 and k_row[4] else 0.0
                            prev_sisa = (
                                float(k_row[5])
                                if len(k_row) > 5 and k_row[5] != ""
                                else nominal_awal
                            )

                            if prev_sisa > 0:
                                bayar_modal = min(prev_sisa, sisa_potong)
                                new_cicilan = prev_cicilan + bayar_modal
                                new_sisa = prev_sisa - bayar_modal

                                sheet_kasbon.update_cell(j, 5, new_cicilan)
                                sheet_kasbon.update_cell(j, 6, new_sisa)
                                sheet_kasbon.update_cell(
                                    j, 8, "Lunas" if new_sisa <= 0 else "Belum Lunas"
                                )

                                sisa_potong -= bayar_modal
                                if sisa_potong <= 0:
                                    break
                elif selisih_potongan < 0:
                    sisa_kembali = abs(selisih_potongan)
                    for j in range(len(kasbon_data) - 1, 0, -1):
                        k_row = kasbon_data[j]
                        if str(k_row[1]).strip() == emp_id_str:
                            nominal_awal = float(k_row[3]) if len(k_row) > 3 and k_row[3] else 0.0
                            prev_cicilan = float(k_row[4]) if len(k_row) > 4 and k_row[4] else 0.0

                            if prev_cicilan > 0:
                                kembalikan = min(prev_cicilan, sisa_kembali)
                                new_cicilan = prev_cicilan - kembalikan
                                new_sisa = nominal_awal - new_cicilan

                                sheet_kasbon.update_cell(j + 1, 5, new_cicilan)
                                sheet_kasbon.update_cell(j + 1, 6, new_sisa)
                                sheet_kasbon.update_cell(
                                    j + 1, 8, "Lunas" if new_sisa <= 0 else "Belum Lunas"
                                )

                                sisa_kembali -= kembalikan
                                if sisa_kembali <= 0:
                                    break

            p["potongan_kasbon"] = pot_kasbon_baru
            raw_diterima = (
                float(p.get("subtotal") or 0) + float(p.get("lain_lain") or 0)
            ) - pot_kasbon_baru
            p["total_diterima"] = math.ceil(max(0.0, raw_diterima) / 1000.0) * 1000

            row_values = [
                f"PAY-{int(datetime.now().timestamp()*1000)}-{emp_id_str}",
                emp_id_str,
                str_start,
                str_end,
                float(p.get("gaji_harian") or 0),
                float(p.get("subtotal") or 0),
                float(p.get("lain_lain") or 0),
                pot_kasbon_baru,
                p["total_diterima"],
                now_str,
            ]

            # PERBAIKAN SINTAKS gspread v6.0+: range_name, values
            if existing_row_index > 0:
                sheet_pay.update(range_name=f"A{existing_row_index}", values=[row_values])
            else:
                sheet_pay.append_row(row_values)

        return {
            "status": "success",
            "message": "Rekap Payroll berhasil diperbarui & pemotongan kasbon disesuaikan!",
            "dataPayroll": payload.data_payroll,
        }
    except Exception as err:
        return {
            "status": "error",
            "message": f"Gagal simpan ke Sheet: {str(err)}",
        }


# ==========================================
# 5. CRUD ENDPOINTS KARYAWAN, JADWAL & IZIN
# ==========================================

@app.post("/api/tambah-area-distribusi")
def tambah_area_distribusi(payload: AreaDistribusiPayload):
    sheet = get_sheet("tb_area_distribusi")
    data = sheet.get_all_values()
    id_area = f"AREA{str(len(data)).zfill(3)}"
    sheet.append_row(
        [id_area, payload.nama_area, payload.id_cabang, payload.nopol_default or ""]
    )
    return {
        "status": "success",
        "message": "Area distribusi baru berhasil ditambahkan!",
    }


@app.post("/api/simpan-mingguan-jadwal")
def simpan_mingguan_jadwal_distribusi(payload: MingguanJadwalPayload):
    try:
        sheet_jadwal = get_sheet("tb_jadwal_distribusi")
        list_karyawan = get_data_table("tb_karyawan")

        if not payload.daftar_penugasan:
            return {"status": "error", "message": "Data penugasan jadwal kosong!"}

        map_emp = {
            str(k.get("id_karyawan")): {
                "nama": k.get("nama_lengkap"),
                "idCabang": str(k.get("id_cabang")),
            }
            for k in list_karyawan
        }

        new_rows = []
        last_row_idx = len(sheet_jadwal.get_all_values())

        for idx, item in enumerate(payload.daftar_penugasan):
            sopir_obj = map_emp.get(str(item.id_sopir))
            kenek_obj = map_emp.get(str(item.id_kenek))

            if sopir_obj and sopir_obj["idCabang"] != str(payload.id_cabang):
                return {
                    "status": "error",
                    "message": f"Gagal: Sopir {sopir_obj['nama']} berasal dari cabang yang berbeda!",
                }
            if kenek_obj and kenek_obj["idCabang"] != str(payload.id_cabang):
                return {
                    "status": "error",
                    "message": f"Gagal: Kenek {kenek_obj['nama']} berasal dari cabang yang berbeda!",
                }

            id_jadwal = f"JDW{str(last_row_idx + idx).zfill(4)}"
            clean_tgl = clean_date_str(item.tanggal)

            new_rows.append(
                [
                    id_jadwal,
                    clean_tgl,
                    payload.id_cabang,
                    payload.id_foreman or "",
                    item.id_sopir,
                    item.id_kenek or "",
                    item.id_gudang or "",
                    item.id_area,
                    item.nopol_armada or "",
                    item.keterangan or "",
                ]
            )

        if new_rows:
            sheet_jadwal.append_rows(new_rows)

        return {
            "status": "success",
            "message": f"Master jadwal operasional mingguan ({len(new_rows)} hari) berhasil disimpan!",
        }
    except Exception as err:
        return {
            "status": "error",
            "message": f"Gagal menyimpan jadwal mingguan: {str(err)}",
        }


@app.post("/api/update-jadwal")
def update_jadwal_distribusi(payload: UpdateJadwalPayload):
    try:
        sheet = get_sheet("tb_jadwal_distribusi")
        values = sheet.get_all_values()
        for idx, row in enumerate(values[1:], start=2):
            if str(row[0]) == str(payload.id_jadwal):
                sheet.update_cell(idx, 5, payload.id_sopir)
                sheet.update_cell(idx, 6, payload.id_kenek or "")
                sheet.update_cell(idx, 7, payload.id_gudang or "")
                sheet.update_cell(idx, 8, payload.id_area)
                sheet.update_cell(idx, 9, payload.nopol_armada or "")
                sheet.update_cell(idx, 10, payload.keterangan or "")
                return {
                    "status": "success",
                    "message": "Perubahan jadwal operasional berhasil diperbarui!",
                }
        return {"status": "error", "message": "Data jadwal tidak ditemukan!"}
    except Exception as err:
        return {
            "status": "error",
            "message": f"Gagal memperbarui jadwal: {str(err)}",
        }


@app.delete("/api/hapus-jadwal/{id_jadwal}")
def hapus_jadwal_distribusi(id_jadwal: str):
    sheet = get_sheet("tb_jadwal_distribusi")
    values = sheet.get_all_values()
    for idx, row in enumerate(values[1:], start=2):
        if str(row[0]) == str(id_jadwal):
            sheet.delete_rows(idx)
            return {
                "status": "success",
                "message": "Jadwal operasional berhasil dihapus!",
            }
    return {"status": "error", "message": "Data jadwal tidak ditemukan!"}


@app.post("/api/ajukan-tukar-libur")
def ajukan_tukar_libur(payload: TukarLiburPayload):
    try:
        sheet = get_sheet("tb_tukar_libur")
        data = sheet.get_all_values()
        id_tukar = f"TKR{str(len(data)).zfill(4)}"
        sheet.append_row(
            [
                id_tukar,
                payload.id_pemohon,
                payload.tgl_pemohon,
                payload.id_pengganti,
                payload.tgl_pengganti,
                payload.alasan,
                "Menunggu Persetujuan",
            ]
        )
        return {
            "status": "success",
            "message": "Pengajuan tukar libur berhasil dikirim!",
        }
    except Exception as err:
        return {"status": "error", "message": str(err)}


@app.post("/api/respon-tukar-libur")
def respon_tukar_libur(payload: ResponTukarLiburPayload):
    sheet = get_sheet("tb_tukar_libur")
    values = sheet.get_all_values()
    for idx, row in enumerate(values[1:], start=2):
        if str(row[0]) == str(payload.id_tukar):
            sheet.update_cell(idx, 7, payload.status)
            return {
                "status": "success",
                "message": f"Pengajuan tukar libur berhasil di-{payload.status.lower()}!",
            }
    return {"status": "error", "message": "Data tukar libur tidak ditemukan!"}


@app.post("/api/ajukan-izin")
def ajukan_izin(payload: IzinPayload):
    sheet = get_sheet("tb_izin")
    data = sheet.get_all_values()
    id_izin = f"IZN{str(len(data)).zfill(4)}"
    sheet.append_row(
        [
            id_izin,
            payload.id_karyawan,
            payload.tgl_mulai,
            payload.tgl_selesai,
            payload.jenis,
            payload.keterangan,
            "Menunggu Persetujuan",
        ]
    )
    return {"status": "success", "message": "Pengajuan izin berhasil dikirim!"}


@app.post("/api/update-status-izin")
def update_status_izin_acc(payload: UpdateIzinACCPayload):
    try:
        sheet = get_sheet("tb_izin")
        values = sheet.get_all_values()
        for idx, row in enumerate(values[1:], start=2):
            if str(row[0]) == str(payload.id_izin):
                sheet.update_cell(idx, 7, payload.status)
                return {
                    "status": "success",
                    "message": f"Pengajuan izin berhasil di-{payload.status.lower()}!",
                }
        return {"status": "error", "message": "Data izin tidak ditemukan!"}
    except Exception as err:
        return {"status": "error", "message": str(err)}


@app.post("/api/koreksi-presensi")
def koreksi_data_presensi(payload: KoreksiPresensiPayload):
    try:
        sheet = get_sheet("tb_absensi")
        values = sheet.get_all_values()
        for idx, row in enumerate(values[1:], start=2):
            if str(row[0]) == str(payload.id_presensi):
                sheet.update_cell(idx, 4, payload.jam_masuk)
                sheet.update_cell(idx, 5, payload.jam_keluar)
                sheet.update_cell(idx, 8, payload.dapat_kerja_pagi)
                sheet.update_cell(idx, 9, payload.dapat_uang_makan)
                sheet.update_cell(idx, 10, payload.catatan_koreksi)
                break
        return {"status": "success"}
    except Exception as err:
        return {"status": "error", "message": str(err)}


@app.post("/api/toggle-penanda-presensi")
def toggle_penanda_presensi(payload: TogglePenandaPayload):
    try:
        sheet = get_sheet("tb_absensi")
        values = sheet.get_all_values()
        for idx, row in enumerate(values[1:], start=2):
            if str(row[0]) == str(payload.id_presensi):
                col_idx = 8 if payload.tipe == "kerja_pagi" else 9
                sheet.update_cell(idx, col_idx, payload.status)
                break
        return {"status": "success"}
    except Exception as err:
        return {"status": "error", "message": str(err)}


@app.post("/api/update-karyawan")
def update_karyawan(payload: UpdateKaryawanPayload):
    sheet = get_sheet("tb_karyawan")
    values = sheet.get_all_values()
    for idx, row in enumerate(values[1:], start=2):
        if str(row[0]).strip() == str(payload.id_karyawan).strip():
            sheet.update_cell(idx, 2, payload.nama)
            sheet.update_cell(idx, 3, payload.posisi)
            sheet.update_cell(idx, 4, payload.id_cabang)
            sheet.update_cell(idx, 5, payload.email)
            sheet.update_cell(idx, 6, payload.role)
            sheet.update_cell(idx, 9, payload.gaji_harian)
            sheet.update_cell(idx, 10, payload.hari_libur_rutin)
            sheet.update_cell(idx, 11, payload.status)
            sheet.update_cell(idx, 12, payload.insentif_khusus)
            return {"status": "success", "message": "Data karyawan diperbarui!"}
    return {"status": "error", "message": "Karyawan tidak ditemukan!"}


@app.post("/api/update-cabang")
def update_cabang(payload: UpdateCabangPayload):
    sheet = get_sheet("tb_cabang")
    values = sheet.get_all_values()
    for idx, row in enumerate(values[1:], start=2):
        if str(row[0]) == str(payload.id_cabang):
            sheet.update_cell(idx, 2, payload.nama_cabang)
            sheet.update_cell(idx, 3, payload.latitude)
            sheet.update_cell(idx, 4, payload.longitude)
            sheet.update_cell(idx, 5, payload.radius)
            return {"status": "success", "message": "Data cabang diperbarui!"}
    return {"status": "error", "message": "Cabang tidak ditemukan!"}


@app.post("/api/update-absensi")
def update_absensi(payload: UpdateAbsensiPayload):
    sheet = get_sheet("tb_absensi")
    values = sheet.get_all_values()
    for idx, row in enumerate(values[1:], start=2):
        if str(row[0]) == str(payload.id_absen):
            sheet.update_cell(idx, 4, payload.jam_masuk)
            sheet.update_cell(idx, 5, payload.jam_keluar)
            return {"status": "success", "message": "Data absensi diperbarui!"}
    return {"status": "error", "message": "Data absensi tidak ditemukan!"}


@app.post("/api/sync-from-sheets")
def sync_from_sheets():
    return {
        "status": "success",
        "message": "Webhook sinkronisasi dari Google Sheets diterima.",
    }