# 🔧 CARA FIX CLOUDFLARE API - LANGKAH DEMI LANGKAH

## ❌ Masalah Saat Ini

Test menunjukkan error:
```
❌ Token verification failed: Invalid API Token
```

**Penyebab**: Anda menggunakan **Global API Key** tapi **tidak mengisi Email**.

Global API Key **HARUS** digunakan bersama Email address untuk autentikasi.

---

## ✅ SOLUSI - Pilih Salah Satu

### 🎯 SOLUSI 1: Lengkapi Email (RECOMMENDED - MUDAH!)

Anda sudah punya:
- ✅ Global API Key: `bc2c87e4f2882c6680326182824172270`
- ✅ Account ID: `a80e4adae09f4e8b31066d0213bc7fe5`
- ❌ Email: **BELUM DIISI**

**Langkah-langkah:**

1. **Buka Settings page** di aplikasi (http://localhost:3000/settings)

2. **Isi 3 field ini:**
   ```
   Cloudflare API Token: bc2c87e4f2882c6680326182824172270
   Cloudflare Email: [EMAIL CLOUDFLARE ANDA]
   Cloudflare Account ID: a80e4adae09f4e8b31066d0213bc7fe5
   ```

3. **Klik "Simpan Pengaturan"**

4. **Klik "Test Koneksi Cloudflare"**

5. **Jika berhasil**, buka Security Logs page dan klik "Fetch Logs"

**Email yang mana?**
- Email yang Anda gunakan untuk **login ke Cloudflare**
- Contoh: `admin@domain.com` atau `user@gmail.com`

---

### 🎯 SOLUSI 2: Buat API Token Baru (Lebih Aman)

Jika Anda tidak ingin menggunakan Global API Key (lebih aman), buat API Token baru:

**Langkah-langkah:**

1. **Login ke Cloudflare Dashboard**: https://dash.cloudflare.com

2. **Buka API Tokens**:
   - Klik foto profil (kanan atas)
   - Klik **My Profile**
   - Klik **API Tokens** (sidebar kiri)

3. **Create Custom Token**:
   - Klik **Create Token**
   - Klik **Create Custom Token**

4. **Set Permissions**:
   ```
   Permissions:
   - Zone → Analytics → Read
   - Zone → Logs → Read
   - Account → Account Settings → Read
   
   Zone Resources:
   - All zones from an account → [Pilih account Anda]
   
   IP Address Filtering:
   - (kosongkan)
   
   TTL:
   - (kosongkan atau set expire date)
   ```

5. **Create Token**:
   - Klik **Continue to summary**
   - Klik **Create Token**
   - **COPY TOKEN** (tidak akan ditampilkan lagi!)

6. **Masukkan ke Aplikasi**:
   - Buka Settings page
   - Paste token ke **Cloudflare API Token**
   - **KOSONGKAN** field **Cloudflare Email**
   - Isi **Cloudflare Account ID**: `a80e4adae09f4e8b31066d0213bc7fe5`
   - Klik **Simpan Pengaturan**
   - Klik **Test Koneksi Cloudflare**

---

## 🧪 Test Setelah Setup

### Test 1: Via Command Line
```bash
cd backend
node test-cloudflare.js
```

**Output yang diharapkan:**
```
✅ Token valid
✅ Found 10 zones total
✅ Found X security events
✅ Cloudflare API is working!
```

### Test 2: Via Settings Page
1. Buka Settings page
2. Klik **Test Koneksi Cloudflare**
3. Harus muncul: ✅ "Koneksi Cloudflare berhasil!"

### Test 3: Fetch Logs
1. Buka **Security Logs** page
2. Klik **Fetch Logs**
3. Harus muncul: ✅ "Berhasil fetch X events dari Y zones"

---

## ⚠️ CATATAN PENTING

### Tentang Security Events API

**Security Events API** memerlukan **Cloudflare Business atau Enterprise plan**.

Jika Anda menggunakan **Free plan**, Anda akan mendapat error:
```
❌ Security Events API not available (404)
```

**Cek plan Anda:**
1. Login ke Cloudflare Dashboard
2. Pilih salah satu domain
3. Lihat di sidebar: **Free**, **Pro**, **Business**, atau **Enterprise**

**Jika Free plan:**
- ❌ Security Events API **TIDAK TERSEDIA**
- ✅ Anda masih bisa:
  - Block IP via Firewall Rules
  - Sync domains ke Domain Monitoring
  - Gunakan fitur lain di aplikasi

**Jika Business/Enterprise plan:**
- ✅ Security Events API **TERSEDIA**
- ✅ Bisa fetch logs otomatis
- ✅ Semua fitur berfungsi

---

## 📞 Masih Error?

Jika masih ada error setelah mengikuti langkah di atas:

### Error: "Permission denied" (403)
**Solusi**: 
- Pastikan API Token punya permission Analytics:Read + Logs:Read
- Atau gunakan Global API Key + Email

### Error: "No zones found"
**Solusi**: 
- Periksa Account ID (copy dari dashboard URL)
- Pastikan ada domain di akun Cloudflare

### Error: "No security events found"
**Solusi**: 
- Ini normal jika tidak ada traffic/threats
- Atau Security Events API tidak tersedia (Free plan)

### Error: "Invalid API Token"
**Solusi**: 
- Jika pakai Global API Key: **WAJIB isi Email**
- Jika pakai API Token: **KOSONGKAN Email**

---

## 📋 Checklist

Sebelum test, pastikan:

- [ ] Sudah isi **Cloudflare API Token** atau **Global API Key**
- [ ] Jika pakai Global API Key, sudah isi **Email**
- [ ] Sudah isi **Account ID**
- [ ] Sudah klik **Simpan Pengaturan**
- [ ] Sudah klik **Test Koneksi Cloudflare**
- [ ] Test berhasil (muncul ✅)

---

## 🎯 KESIMPULAN

**Yang Anda butuhkan sekarang:**

1. **Isi Email Cloudflare Anda** di Settings page
2. Atau **buat API Token baru** (lebih aman)

**Setelah itu:**
- Test koneksi harus berhasil ✅
- Bisa fetch logs dari semua 10 zones ✅
- Sistem berjalan otomatis ✅

**Jika masih error 404 saat fetch logs:**
- Kemungkinan besar Anda pakai **Free plan**
- Security Events API **tidak tersedia** di Free plan
- Perlu upgrade ke **Business plan** ($200/bulan per domain)

---

## 💡 Rekomendasi

**Untuk testing:**
- Gunakan **Global API Key + Email** (mudah setup)

**Untuk production:**
- Gunakan **API Token** (lebih aman, bisa dibatasi permission)

**Untuk Free plan:**
- Security Events API **tidak akan berfungsi**
- Pertimbangkan upgrade ke Business plan
- Atau gunakan fitur lain (Domain Monitoring, IP Check, CVE, dll)

---

**Selamat mencoba! 🚀**
