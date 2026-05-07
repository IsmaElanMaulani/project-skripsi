# Sistem Monitoring Keamanan Web

Dashboard keamanan fullstack dengan integrasi VirusTotal, AbuseIPDB, dan API.

## Stack
- **Frontend**: React + TailwindCSS (dark mode cyber theme)
- **Backend**: Node.js + Express
- **Database**: MySQL
- **Auth**: JWT
- **Realtime**: Socket.IO

## Fitur
- Login admin dengan JWT
- Dashboard statistik serangan harian
- Security Logs + Block IP
- IP Threat Check via AbuseIPDB
- Malware Scanner via VirusTotal (URL & File)
- Notifikasi realtime (Socket.IO)
- Cronjob auto-fetch logs & auto-scan
- User Management CRUD
- Pengaturan threshold & interval

## Instalasi

### 1. Database MySQL
```sql
CREATE DATABASE security_monitoring CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Backend
```bash
cd backend
npm install
# Edit .env dengan kredensial Anda
npm run dev
```

### 3. Frontend
```bash
cd frontend
npm install
npm start
```

## Konfigurasi .env (backend)

```env
PORT=5000
JWT_SECRET=your_secret_key

MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=security_monitoring

VIRUSTOTAL_API_KEY=    # https://www.virustotal.com/gui/my-apikey
ABUSEIPDB_API_KEY=     # https://www.abuseipdb.com/account/api
Cloudflare Logs
_API_TOKEN=  # https://dash.Cloudflare Logs
.com/profile/api-tokens
Cloudflare Logs
_ZONE_ID=    # Dashboard > Zone ID
```

## Default Login
- Username: `admin`
- Password: `admin123`

## API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |
| GET | /api/dashboard/stats | Statistik dashboard |
| GET | /api/Cloudflare Logs
/logs | Log |
| POST | /api/Cloudflare Logs
/block-ip | Blokir IP |
| POST | /api/ip/check | Cek reputasi IP |
| POST | /api/malware/scan-url | Scan URL |
| POST | /api/malware/scan-file | Scan file |
| GET | /api/malware/result/:id | Hasil scan |
| GET | /api/settings | Ambil settings |
| PUT | /api/settings | Update settings |
| GET | /api/users | Daftar user |
| POST | /api/users | Buat user |
| PUT | /api/users/:id | Update user |
| DELETE | /api/users/:id | Hapus user |
