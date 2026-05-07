# 🔄 Sync Domains from Cloudflare - Panduan Lengkap

## 🎯 Apa itu Sync Domains?

Fitur **Sync Domains** akan:
1. ✅ Fetch semua **zones (domains)** dari akun Cloudflare Anda
2. ✅ Fetch semua **DNS records (subdomains)** dari setiap zone
3. ✅ Import semuanya ke **Domain Monitoring**
4. ✅ Siap untuk di-scan dengan VirusTotal

---

## 🚀 Cara Menggunakan

### Metode 1: Via Security Logs Page

1. **Buka Security Logs page**: http://localhost:3000/cloudflare
2. **Klik tombol "Sync Domains"** di pojok kanan atas
3. **Tunggu proses selesai** (bisa 1-5 menit tergantung jumlah domains)
4. **Lihat hasil**: Akan muncul notifikasi berapa domain yang berhasil di-import
5. **Buka Domain Monitoring**: Klik link "Lihat di Domain Monitoring"

### Metode 2: Via Domain Monitoring Page

1. **Buka Domain Monitoring page**: http://localhost:3000/domain-monitoring
2. **Klik tombol "Sync from Cloudflare"** (jika ada)
3. **Tunggu proses selesai**
4. **Refresh page** untuk lihat domains yang baru di-import

---

## 📊 Apa yang Di-Import?

### 1. Main Domains (Zones)
Semua domain utama di akun Cloudflare Anda:
- academiaopenpublisher.com
- admirationpublisher.id
- ajosh.org
- al-makkipublisher.com
- bimapublisher.co.id
- globalpublikasiana.com
- greenpublisher.id
- infojurnal.id
- internationaljournallabs.com
- jurnalsyntaxadmiration.com
- ... dan 9 lainnya (total 19 zones)

### 2. Subdomains (DNS Records)
Semua subdomain dari setiap zone:
- www.academiaopenpublisher.com
- mail.academiaopenpublisher.com
- api.academiaopenpublisher.com
- ... dan seterusnya

**Jenis DNS records yang di-import**:
- ✅ **A records** (IPv4)
- ✅ **AAAA records** (IPv6)
- ✅ **CNAME records** (Alias)

**Tidak di-import**:
- ❌ MX records (email)
- ❌ TXT records (verification)
- ❌ NS records (nameservers)

---

## ⚙️ Cara Kerja

### Step 1: Fetch Zones
```
GET https://api.cloudflare.com/client/v4/zones
```
- Fetch semua zones dari akun
- Pagination: 50 zones per page
- Filter by Account ID (jika ada)

### Step 2: Fetch DNS Records
Untuk setiap zone:
```
GET https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records
```
- Fetch semua DNS records
- Filter: A, AAAA, CNAME only
- Pagination: 100 records per page

### Step 3: Import to Database
```sql
INSERT INTO monitored_domains (domain, notes, created_by, status)
VALUES (?, ?, ?, 'active')
ON DUPLICATE KEY UPDATE domain=domain
```
- Skip jika domain sudah ada
- Set status: active
- Set notes: "Imported from Cloudflare"

---

## 📈 Estimasi Waktu & Data

### Berdasarkan 19 Zones:

| Jumlah Zones | Avg Subdomains | Total Domains | Waktu Estimasi |
|--------------|----------------|---------------|----------------|
| 19 zones | 5 subdomains | ~114 domains | 2-3 menit |
| 19 zones | 10 subdomains | ~209 domains | 3-5 menit |
| 19 zones | 20 subdomains | ~399 domains | 5-10 menit |

**Rate Limiting**:
- 200ms delay antara DNS record fetch
- 500ms delay antara zone fetch
- Untuk menghindari Cloudflare rate limit

---

## ✅ Setelah Sync Berhasil

### 1. Lihat di Domain Monitoring
```
http://localhost:3000/domain-monitoring
```
Semua domains akan muncul di tabel dengan:
- Status: Active
- Last Scan: Belum pernah
- Notes: "Imported from Cloudflare"

### 2. Scan Domains
**Manual Scan**:
- Klik tombol "Scan" di setiap domain
- Atau pilih multiple domains → Bulk scan

**Auto Scan**:
- Buka Settings page
- Enable "Auto Scan" di cronjob settings
- Set interval (default: setiap hari jam 2 pagi)

### 3. Monitor Results
- Lihat scan history
- Generate PDF reports
- Get email/Telegram notifications

---

## 🔧 Troubleshooting

### Error: "Cloudflare API Token belum dikonfigurasi"
**Solusi**:
1. Buka Settings page
2. Isi Cloudflare API Token
3. Isi Cloudflare Email (jika pakai Global API Key)
4. Isi Cloudflare Account ID
5. Klik "Simpan Pengaturan"

### Error: "Tidak ada domain ditemukan"
**Penyebab**:
- Account ID salah
- Tidak ada zones di akun Cloudflare
- API Token tidak punya permission

**Solusi**:
1. Cek Account ID di Cloudflare Dashboard
2. Pastikan ada domains di akun
3. Cek API Token permission (Zone:Read)

### Error: "Gagal sync domains"
**Penyebab**:
- Network timeout
- Cloudflare API rate limit
- Database error

**Solusi**:
1. Tunggu 1-2 menit, coba lagi
2. Cek backend logs untuk detail error
3. Restart backend server

### Sync Lambat / Timeout
**Penyebab**:
- Terlalu banyak domains/subdomains
- Network lambat
- Cloudflare API slow response

**Solusi**:
1. Tunggu sampai selesai (bisa 5-10 menit)
2. Jangan refresh page
3. Cek backend logs untuk progress

---

## 📊 Monitoring Progress

### Via Backend Logs
```bash
cd backend
npm start
```

Output:
```
[Cloudflare] Fetching all zones from account...
[Cloudflare] Found 19 zones
[Cloudflare] Importing zone: academiaopenpublisher.com
[Cloudflare] Fetching DNS records for academiaopenpublisher.com
[Cloudflare] Found 5 DNS records
[Cloudflare] Imported: www.academiaopenpublisher.com
[Cloudflare] Imported: mail.academiaopenpublisher.com
...
[Cloudflare] Sync complete: 114 imported, 0 skipped
```

### Via Browser Console
```javascript
// Open browser console (F12)
// Watch for API responses
```

---

## 💡 Tips & Best Practices

### 1. Sync Pertama Kali
- Lakukan saat traffic rendah (malam hari)
- Pastikan network stabil
- Jangan close browser sampai selesai

### 2. Sync Berkala
- Sync ulang setiap 1-2 minggu
- Untuk detect domain/subdomain baru
- Domains yang sudah ada akan di-skip

### 3. Setelah Sync
- Enable auto-scan di Settings
- Set email/Telegram notifications
- Review scan results regularly

### 4. Cleanup
- Hapus domains yang tidak aktif
- Atau set status ke "inactive"
- Untuk mengurangi scan quota

---

## 🎯 Use Cases

### 1. Security Monitoring
- Scan semua domains untuk malware
- Detect phishing/malicious content
- Get alerts via email/Telegram

### 2. Compliance
- Ensure all domains are clean
- Generate PDF reports for audit
- Track scan history

### 3. Inventory Management
- Know all domains/subdomains in Cloudflare
- Track which domains are monitored
- Identify unused domains

---

## 📞 FAQ

### Q: Apakah sync akan overwrite data yang sudah ada?
**A**: Tidak. Sync menggunakan `ON DUPLICATE KEY UPDATE` yang akan skip domains yang sudah ada.

### Q: Apakah bisa sync hanya 1 zone saja?
**A**: Saat ini tidak. Sync akan import semua zones. Tapi Anda bisa hapus manual domains yang tidak diinginkan setelah sync.

### Q: Apakah sync otomatis berjalan?
**A**: Tidak. Sync harus dilakukan manual dengan klik tombol "Sync Domains".

### Q: Berapa lama sync berlangsung?
**A**: Tergantung jumlah domains/subdomains. Untuk 19 zones dengan ~5 subdomains each: 2-3 menit.

### Q: Apakah sync menggunakan quota VirusTotal?
**A**: Tidak. Sync hanya import domains ke database. Scan dilakukan terpisah dan menggunakan quota VirusTotal.

### Q: Apakah bisa sync dari multiple Cloudflare accounts?
**A**: Tidak. Saat ini hanya support 1 Cloudflare account. Tapi Anda bisa ganti API Token/Account ID di Settings untuk sync dari account lain.

---

## ✨ Kesimpulan

Fitur **Sync Domains** memudahkan Anda untuk:
- ✅ Import semua domains/subdomains dari Cloudflare
- ✅ Monitor keamanan dengan VirusTotal
- ✅ Generate reports & get notifications
- ✅ **100% GRATIS** (tidak perlu Cloudflare Business plan!)

**Alternatif terbaik** untuk Security Events API yang memerlukan Business plan ($200/bulan).

---

**Selamat menggunakan! 🚀**
