# 👥 User Accounts Documentation

## Default Users

Sistem SecMonitor memiliki 4 user dengan role berbeda:

### 1. 👑 Admin
- **Username**: `admin`
- **Password**: `admin123`
- **Email**: `admin@security.local`
- **Role**: `admin`
- **Akses**:
  - ✅ Full access ke semua fitur
  - ✅ Kelola user (create, edit, delete)
  - ✅ Ubah settings sistem
  - ✅ Lihat semua dashboard & logs
  - ✅ Scan malware & check IP
  - ✅ Manage CVE data
  - ✅ Block/unblock IP

### 2. 👀 Viewer
- **Username**: `viewer1`
- **Password**: `viewer123`
- **Email**: `viewer@security.local`
- **Role**: `viewer`
- **Akses**:
  - ✅ Lihat dashboard & statistics
  - ✅ Lihat security logs
  - ✅ Check IP reputation
  - ✅ Scan malware
  - ✅ Lihat CVE/vulnerability data
  - ❌ Tidak bisa kelola user
  - ❌ Tidak bisa ubah settings
  - ❌ Tidak bisa block IP

**Cocok untuk**: Tim monitoring, stakeholder, SOC analyst junior

### 3. 🔍 Analyst
- **Username**: `analyst`
- **Password**: `analyst123`
- **Email**: `analyst@security.local`
- **Role**: `analyst`
- **Akses**:
  - ✅ Semua akses Viewer
  - ✅ Tambah IP ke blacklist
  - ✅ Buat catatan investigasi
  - ✅ Export reports
  - ✅ Update CVE data
  - ❌ Tidak bisa kelola user
  - ❌ Tidak bisa ubah settings sistem

**Cocok untuk**: Security analyst, incident responder, threat hunter

### 4. ⚙️ Operator
- **Username**: `operator`
- **Password**: `operator123`
- **Email**: `operator@security.local`
- **Role**: `operator`
- **Akses**:
  - ✅ Semua akses Analyst
  - ✅ Ubah API keys
  - ✅ Konfigurasi scan schedule
  - ✅ Manage notification settings
  - ❌ Tidak bisa kelola user

**Cocok untuk**: DevOps, system administrator, operations team

---

## Role Hierarchy

```
Admin (Full Access)
  ↓
Operator (Config + Operations)
  ↓
Analyst (Monitoring + Analysis)
  ↓
Viewer (Read Only)
```

---

## Cara Login

1. Buka browser: `http://localhost:3000`
2. Masukkan username dan password
3. Klik "Sign In to Dashboard"

---

## Keamanan

⚠️ **PENTING**: Ganti password default setelah login pertama kali!

### Cara Ganti Password:
1. Login sebagai user yang ingin diganti passwordnya
2. Minta admin untuk edit user di halaman "User Management"
3. Atau admin bisa langsung update via database

---

## Menambah User Baru

### Via UI (Admin Only):
1. Login sebagai `admin`
2. Buka menu "User Management"
3. Klik "Tambah User"
4. Isi form:
   - Username
   - Email
   - Password
   - Role (pilih sesuai kebutuhan)
5. Klik "Simpan"

### Via Script:
Edit file `backend/create-users.js` dan tambahkan user baru, lalu jalankan:
```bash
cd backend
node create-users.js
```

---

## Troubleshooting

### Lupa Password?
Admin bisa reset password user lain via User Management page.

### User Tidak Bisa Login?
1. Cek status user (harus "Aktif")
2. Pastikan password benar
3. Cek di database: `SELECT * FROM users WHERE username = 'namauser';`

### Role Tidak Sesuai?
Admin bisa edit role user via User Management page.

---

## Database Schema

```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'operator', 'analyst', 'viewer') DEFAULT 'viewer',
  is_active TINYINT(1) DEFAULT 1,
  last_login DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user

### User Management (Admin Only)
- `GET /api/users` - List all users
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

---

**Last Updated**: 2024
**Version**: 1.0.0
