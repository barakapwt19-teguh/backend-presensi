from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import gspread
from google.oauth2.service_account import Credentials
import os      # <--- TAMBAHKAN INI
import json    # <--- TAMBAHKAN INI
from typing import Optional, List
app = FastAPI(title="GAS to Python Backend API")

# 1. Pengaturan CORS agar Cloudflare Pages bisa mengakses API ini
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Ganti dengan domain Cloudflare Pages Anda saat produksi
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Inisialisasi Koneksi ke Google Sheets
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

# Ganti dengan ID Google Spreadsheet Anda
SPREADSHEET_ID = "1FbPrmPU7yslM9nHpzx0mEAMLO4_-MM7V-FPJespPyF4"

def get_sheet(sheet_name: str):
    try:
        # Cek apakah ada file credentials.json lokal (saat tes di komputer)
        if os.path.exists("credentials.json"):
            creds = Credentials.from_service_account_file("credentials.json", scopes=SCOPES)
        # Jika di Vercel, baca dari Environment Variable GOOGLE_CREDENTIALS
        elif "GOOGLE_CREDENTIALS" in os.environ:
            creds_dict = json.loads(os.environ["GOOGLE_CREDENTIALS"])
            creds = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
        else:
            raise Exception("Kredensial Google Sheets tidak ditemukan! (credentials.json / GOOGLE_CREDENTIALS)")

        client = gspread.authorize(creds)
        spreadsheet = client.open_by_key(SPREADSHEET_ID)
        return spreadsheet.worksheet(sheet_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal koneksi ke Google Sheets: {str(e)}")

# 3. Model Data Request (Pydantic Schema)
class PresensiPayload(BaseModel):
    id_presensi: str
    jam_masuk: str
    jam_keluar: str
    dapat_kerja_pagi: Optional[str] = "Tidak"
    dapat_uang_makan: Optional[str] = "Tidak"
    catatan_koreksi: Optional[str] = ""

class PresensiBaruPayload(BaseModel):
    id_karyawan: str
    tanggal: str
    jam_masuk: str
    status_radius: str

# 4. Endpoint API

@app.get("/")
def root():
    return {"message": "API Backend Python FastAPI Aktif"}

# --- READ: Mengambil Semua Data Presensi ---
@app.get("/api/presensi")
def get_all_presensi():
    sheet = get_sheet("Presensi")  # Nama tab/worksheet
    records = sheet.get_all_records()  # Mengembalikan list of dict berdasarkan header baris pertama
    return {"status": "success", "data": records}

# --- WRITE/INSERT: Tambah Absen Baru ---
@app.post("/api/presensi")
def tambah_presensi(payload: PresensiBaruPayload):
    sheet = get_sheet("Presensi")
    
    # Generate ID Presensi Sederhana
    id_presensi = f"PRS-{sheet.row_count}"
    
    row_data = [
        id_presensi,
        payload.id_karyawan,
        payload.tanggal,
        payload.jam_masuk,
        "",  # jam_keluar kosong saat baru absen masuk
        payload.status_radius,
        "Tidak",  # dapat_kerja_pagi
        "Tidak",  # dapat_uang_makan
        ""       # catatan
    ]
    
    sheet.append_row(row_data)
    return {"status": "success", "message": "Absen masuk berhasil dicatat", "id_presensi": id_presensi}

# --- UPDATE: Koreksi Data Presensi ---
@app.put("/api/presensi/koreksi")
def koreksi_presensi(payload: PresensiPayload):
    sheet = get_sheet("Presensi")
    
    # Cari baris berdasarkan id_presensi (Kolom A / Kolom 1)
    cell = sheet.find(payload.id_presensi)
    
    if not cell:
        raise HTTPException(status_code=404, detail="ID Presensi tidak ditemukan")
    
    row_num = cell.row
    
    # Update kolom spesifik (Kolom D=Jam Masuk, E=Jam Keluar, G=Pagi, H=Makan, I=Catatan)
    sheet.update_cell(row_num, 4, payload.jam_masuk)
    sheet.update_cell(row_num, 5, payload.jam_keluar)
    sheet.update_cell(row_num, 7, payload.dapat_kerja_pagi)
    sheet.update_cell(row_num, 8, payload.dapat_uang_makan)
    sheet.update_cell(row_num, 9, payload.catatan_koreksi)
    
    return {"status": "success", "message": "Koreksi presensi berhasil diperbarui"}