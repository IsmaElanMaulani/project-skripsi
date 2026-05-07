# 📖 Panduan Setup Cloudflare API

## 🎯 Tujuan
Mengintegrasikan Cloudflare Security Events API untuk mengambil log firewall dan security events secara otomatis dari **SEMUA zones** dalam akun Cloudflare Anda.

---

## 🔑 Pilihan Autentikasi

Ada 2 cara untuk autentikasi ke Cloudflare API:

### **Opsi 1: API Token (Recommended untuk Production)**
✅ Lebih aman (bisa dibatasi permission)  
✅ Bisa expired otomatis  
❌ Perlu setup permission yang tepat  

### **Opsi 2: Global API Key (Mudah untuk Testing)**
✅ Sangat mudah setup  
✅ Full access ke semua API  
❌ Kurang aman (full access)  
❌ Tidak bisa expired  

---

## 📋 Setup Opsi 1: API Token

### 1. Buat API Token
1. Login ke [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Klik **My Profile** (kanan atas) → **API Tokens**
3. Klik **Create Token**
4. Pilih **Create Custom Token**

### 2. Set Permissions
Berikan permission berikut:

| Permission | Access |
|------------|--------|
| **Zone** → **Analytics** | Read |
| **Zone** → **Logs** | Read |
| **Account** → **Account Settings** | Read |

### 3. Set Zone Resources
- **Zone Resources**: All zones from an account
- Pilih account Anda

### 4. Copy Token
- Klik **Continue to summary** → **Create Token**
- **COPY TOKEN** dan simpan (tidak akan ditampilkan lagi!)

### 5. Masukkan ke Aplikasi
1. Buka **Settings** page di aplikasi
2. Paste token ke field **Cloudflare API Token**
3. **KOSONGKAN** field **Cloudflare Email**
4. Isi **Cloudflare Account ID** (lihat cara di bawah)
5. Klik **Simpan Pengaturan**
6. Klik **Test Koneksi Cloudflare**

---

## 📋 Setup Opsi 2: Global API Key (MUDAH!)

### 1. Dapatkan Global API Key
1. Login ke [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Klik **My Profile** (kanan atas) → **API Tokens**
3. Scroll ke bawah ke section **API Keys**
4. Klik **View** pada **Global API Key**
5. Masukkan password Cloudflare Anda
6. **COPY KEY** yang ditampilkan

### 2. Dapatkan Email
- Email yang Anda gunakan untuk login Cloudflare

### 3. Masukkan ke Aplikasi
1. Buka **Settings** page di aplikasi
2. Paste Global API Key ke field **Cloudflare API Token**
3. Isi **Cloudflare Email** dengan email Cloudflare Anda
4. Isi **Cloudflare Account ID** (lihat cara di bawah)
5. Klik **Simpan Pengaturan**
6. Klik **Test Koneksi Cloudflare**

---

## 🆔 Cara Mendapatkan Account ID

### Metode 1: Dari Dashboard URL
1. Login ke [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Klik salah satu domain Anda
3. Lihat URL browser: `https://dash.cloudflare.com/ACCOUNT_ID/domain.com`
4. Copy **ACCOUNT_ID** dari URL

### Metode 2: Dari Overview Page
1. Login ke [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Klik salah satu domain Anda
3. Scroll ke bawah di sidebar kanan
4. Copy **Account ID**

---

## ✅ Verifikasi Setup

### 1. Test via Script
```bash
cd backend
node test-cloudflare.js
```

Output yang diharapkan:
```
✓ Connected to database
✓ Token valid
✅ Found 10 zones total:
   1. domain1.com
   2. domain2.com
   ...
✅ Found 25 security events
✅ Cloudflare API is working!
```

### 2. Test via Settings Page
1. Buka **Settings** page
2. Klik **Test Koneksi Cloudflare**
3. Harus muncul: ✅ "Koneksi Cloudflare berhasil! Ditemukan X zones"

### 3. Test Fetch Logs
1. Buka **Security Logs** page
2. Klik **Fetch Logs**
3. Harus muncul: ✅ "Berhasil fetch X events dari Y zones"

---

## 🚨 Troubleshooting

### ❌ Error: "Token invalid"
**Penyebab**: API Token salah atau expired  
**Solusi**: 
- Buat token baru
- Pastikan copy token dengan benar (tidak ada spasi)

### ❌ Error: "Permission denied" (403)
**Penyebab**: API Token tidak punya permission yang cukup  
**Solusi**: 
- Buat token baru dengan permission: Analytics:Read + Logs:Read
- Atau gunakan Global API Key + Email

### ❌ Error: "No zones found"
**Penyebab**: Account ID salah atau tidak ada zones di account  
**Solusi**: 
- Periksa Account ID (copy dari dashboard)
- Pastikan ada domain di akun Cloudflare

### ❌ Error: "Security Events API not available" (404)
**Penyebab**: Security Events API memerlukan plan Enterprise/Business  
**Solusi**: 
- Upgrade plan Cloudflare ke Business/Enterprise
- Atau gunakan Cloudflare Logpush (berbayar)
- Fitur ini **TIDAK TERSEDIA** di Free plan

### ❌ Error: "No security events found"
**Penyebab**: Tidak ada traffic atau tidak ada ancaman terdeteksi  
**Solusi**: 
- Ini normal jika site tidak ada traffic
- Atau tidak ada firewall rules yang triggered
- Tunggu beberapa hari untuk data muncul

---

## 📊 Fitur yang Tersedia

Setelah setup berhasil, Anda bisa:

### 1. **Auto-Fetch Logs**
- Sistem otomatis fetch logs setiap X menit (configurable)
- Fetch dari **SEMUA zones** dalam akun
- Simpan ke database lokal

### 2. **Manual Fetch**
- Klik "Fetch Logs" di Security Logs page
- Fetch logs dari 24 jam terakhir

### 3. **Block IP**
- Block IP address langsung dari Security Logs page
- Otomatis create firewall rule di Cloudflare

### 4. **Sync Domains**
- Import semua domains + subdomains dari Cloudflare
- Masuk ke Domain Monitoring untuk auto-scan

### 5. **Notifications**
- Email notification untuk threats
- Telegram notification untuk threats

---

## 🔐 Keamanan

### ⚠️ PENTING:
- **JANGAN** commit `.env` file ke Git
- **JANGAN** share API Token/Key dengan orang lain
- **JANGAN** simpan credentials di file public

### ✅ Best Practices:
- Gunakan API Token (bukan Global API Key) untuk production
- Set permission minimal yang dibutuhkan
- Rotate token secara berkala (3-6 bulan)
- Monitor API usage di Cloudflare dashboard

---

## 📞 Support

Jika masih ada masalah:

1. **Check logs**: `cd backend && npm start` (lihat console output)
2. **Run test script**: `node test-cloudflare.js`
3. **Check database**: Pastikan table `settings` ada dan terisi
4. **Check .env**: Pastikan credentials sudah benar

---

## 📝 Credentials Anda

Berdasarkan informasi yang diberikan:

```
Global API Key: bc2c87e4f2882c6680326182824172270
Account ID: a80e4adae09f4e8b31066d0213bc7fe5
Email: [PERLU DIISI]
```

### ⚠️ Yang Masih Kurang:
- **Email address** untuk autentikasi Global API Key

### 📋 Langkah Selanjutnya:
1. Buka Settings page
2. Isi:
   - **Cloudflare API Token**: `bc2c87e4f2882c6680326182824172270`
   - **Cloudflare Email**: `[email Cloudflare Anda]`
   - **Cloudflare Account ID**: `a80e4adae09f4e8b31066d0213bc7fe5`
3. Klik **Simpan Pengaturan**
4. Klik **Test Koneksi Cloudflare**
5. Jika berhasil, buka **Security Logs** page dan klik **Fetch Logs**

---

## ✨ Selesai!

Setelah setup berhasil, sistem akan:
- ✅ Fetch logs dari **SEMUA 10 zones** Anda secara otomatis
- ✅ Simpan ke database lokal
- ✅ Tampilkan di Security Logs page
- ✅ Kirim notifikasi jika ada threats
- ✅ Bisa block IP langsung dari dashboard

**Selamat menggunakan! 🎉**
