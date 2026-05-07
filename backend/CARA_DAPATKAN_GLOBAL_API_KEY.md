# 🔑 Cara Mendapatkan Global API Key yang Benar

## ❌ Masalah Saat Ini

Error dari Cloudflare:
```
Invalid format for X-Auth-Key header (Error code: 6103)
```

**Penyebab**: Global API Key yang dimasukkan **tidak valid** atau **formatnya salah**.

Global API Key yang Anda berikan:
```
bc2c87e4f2882c6680326182824172270
```

Panjang: **33 karakter** ❌

Global API Key yang benar seharusnya:
- Panjang: **37 karakter**
- Format: Hexadecimal (0-9, a-f)
- Contoh: `1234567890abcdef1234567890abcdef12345`

---

## ✅ CARA MENDAPATKAN GLOBAL API KEY YANG BENAR

### Langkah 1: Login ke Cloudflare
1. Buka: https://dash.cloudflare.com
2. Login dengan email: `akun.intention2@gmail.com`

### Langkah 2: Buka API Tokens Page
1. Klik **foto profil** Anda (pojok kanan atas)
2. Klik **My Profile**
3. Di sidebar kiri, klik **API Tokens**

### Langkah 3: Lihat Global API Key
1. Scroll ke bawah sampai section **API Keys**
2. Cari baris **Global API Key**
3. Klik tombol **View** di sebelah kanan
4. Masukkan **password Cloudflare** Anda
5. **COPY** key yang ditampilkan (37 karakter)

**PENTING**: 
- Jangan copy dari email atau tempat lain
- Copy langsung dari dashboard Cloudflare
- Pastikan tidak ada spasi di awal/akhir

### Langkah 4: Masukkan ke Aplikasi
1. Buka **Settings** page di aplikasi
2. Paste Global API Key ke field **Cloudflare API Token**
3. Pastikan **Email** sudah terisi: `akun.intention2@gmail.com`
4. Pastikan **Account ID** sudah terisi: `a80e4adae09f4e8b31066d0213bc7fe5`
5. Klik **Simpan Pengaturan**
6. Klik **Test Koneksi Cloudflare**

---

## 🎯 ALTERNATIF: Gunakan API Token (Lebih Mudah!)

Jika Anda kesulitan dengan Global API Key, gunakan **API Token** saja:

### Langkah 1: Buat API Token
1. Di page **API Tokens**, klik **Create Token**
2. Klik **Create Custom Token**

### Langkah 2: Set Permissions
```
Token name: SecMonitor API Token

Permissions:
✅ Zone → Analytics → Read
✅ Zone → Logs → Read  
✅ Account → Account Settings → Read

Zone Resources:
✅ All zones from an account → [Pilih account Anda]

IP Address Filtering: (kosongkan)
TTL: (kosongkan)
```

### Langkah 3: Create & Copy Token
1. Klik **Continue to summary**
2. Klik **Create Token**
3. **COPY TOKEN** (tidak akan ditampilkan lagi!)
4. Token akan seperti: `abcdefghijklmnopqrstuvwxyz1234567890ABCD`

### Langkah 4: Masukkan ke Aplikasi
1. Buka **Settings** page
2. Paste API Token ke field **Cloudflare API Token**
3. **KOSONGKAN** field **Cloudflare Email** (penting!)
4. Isi **Account ID**: `a80e4adae09f4e8b31066d0213bc7fe5`
5. Klik **Simpan Pengaturan**
6. Klik **Test Koneksi Cloudflare**

---

## 🧪 Test Setelah Setup

Jalankan test:
```bash
cd backend
node test-simple.js
```

**Output yang diharapkan:**
```
✅ Success!
Status: 200
Zones found: 10

Zones:
  1. domain1.com
  2. domain2.com
  ...
```

---

## 📸 Screenshot Bantuan

Jika masih bingung, berikut lokasi Global API Key:

```
Cloudflare Dashboard
└── My Profile (klik foto profil kanan atas)
    └── API Tokens (sidebar kiri)
        └── API Keys (scroll ke bawah)
            └── Global API Key
                └── [View] ← Klik ini
                    └── Masukkan password
                        └── Copy key (37 karakter)
```

---

## ⚠️ CATATAN PENTING

### Jangan Gunakan:
- ❌ Zone ID (bukan API Key)
- ❌ Account ID (bukan API Key)
- ❌ API Token name (bukan API Key)
- ❌ Email address (bukan API Key)

### Yang Benar:
- ✅ Global API Key dari dashboard (37 karakter)
- ✅ Atau API Token yang baru dibuat (40+ karakter)

---

## 🔐 Keamanan

**JANGAN SHARE** Global API Key dengan siapa pun!

Global API Key memberikan **full access** ke semua domain dan settings di akun Cloudflare Anda.

Jika tidak yakin, lebih baik gunakan **API Token** yang bisa dibatasi permission-nya.

---

## 📞 Masih Bermasalah?

Jika masih error setelah mengikuti langkah di atas:

1. **Screenshot** halaman API Tokens Anda (blur sensitive info)
2. **Copy** error message lengkap dari test script
3. **Cek** apakah akun Cloudflare Anda aktif dan bisa login

---

**Silakan coba lagi dengan Global API Key yang benar! 🚀**
