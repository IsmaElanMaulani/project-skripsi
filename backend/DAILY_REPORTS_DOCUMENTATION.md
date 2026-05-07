# 📧 Daily Email Reports - Dokumentasi

## Overview
Sistem SecMonitor sekarang mengirimkan laporan keamanan otomatis ke email Anda **2 kali sehari**:
- **Pagi**: Jam 07:00 WIB
- **Sore**: Jam 16:00 WIB

## Isi Laporan

Setiap laporan email berisi informasi lengkap tentang status keamanan sistem Anda:

### 1. **Statistik Utama**
- Total Domain yang dimonitor
- Domain Aktif
- Jumlah Scan hari ini
- Aktivitas User hari ini

### 2. **Status Keamanan**
- ✅ Domain Bersih
- 🔴 Domain Terinfeksi
- 🟡 Domain Mencurigakan
- ⚪ Domain Belum Discan

### 3. **Ancaman Terdeteksi** (jika ada)
- Daftar domain yang terinfeksi atau mencurigakan hari ini
- Detail jumlah malicious dan suspicious
- Waktu deteksi

### 4. **Scan Terbaru**
- 10 scan terakhir yang dilakukan hari ini
- Status hasil scan (Clean/Infected/Suspicious)
- Timestamp scan

### 5. **Tindakan Diperlukan**
- Peringatan jika ada domain yang memerlukan perhatian
- Atau konfirmasi bahwa semua aman

## Konfigurasi

### Persyaratan
Laporan otomatis akan dikirim jika:
1. ✅ Email notifications **ENABLED** di Settings
2. ✅ SMTP settings sudah dikonfigurasi dengan benar
3. ✅ Backend server berjalan

### SMTP Settings yang Benar
```
SMTP Host: smtp.gmail.com
SMTP Port: 587
SMTP User: ismaelanmaulani068@gmail.com
SMTP Password: xxwm necb hmnd ntrc (App Password)
Email From: ismaelanmaulani068@gmail.com
Email To: ismaelanmaulani068@gmail.com
```

## Jadwal Cron Jobs

Sistem menggunakan `node-cron` untuk menjadwalkan laporan:

```javascript
// Laporan Pagi - 07:00 WIB
cron.schedule('0 7 * * *', () => sendDailyReport('morning'));

// Laporan Sore - 16:00 WIB
cron.schedule('0 16 * * *', () => sendDailyReport('afternoon'));
```

### Format Cron
- `0 7 * * *` = Setiap hari jam 07:00
- `0 16 * * *` = Setiap hari jam 16:00

## Testing Manual

Anda dapat mengirim test report secara manual:

### Test Laporan Pagi
```bash
cd backend
node test-daily-report.js
```

### Test Laporan Sore
```bash
cd backend
node test-afternoon-report.js
```

## Troubleshooting

### Email tidak terkirim?

1. **Cek Email Settings di Database**
   ```bash
   node check-email-settings.js
   ```

2. **Pastikan SMTP Host benar**
   - ❌ SALAH: `gmail.com`
   - ✅ BENAR: `smtp.gmail.com`

3. **Pastikan SMTP User benar**
   - ❌ SALAH: `elan`
   - ✅ BENAR: `ismaelanmaulani068@gmail.com`

4. **Fix Settings Otomatis**
   ```bash
   node fix-email-settings.js
   ```

5. **Restart Backend**
   ```bash
   npm start
   ```

### Cek Log Backend
Saat laporan dikirim, backend akan menampilkan log:
```
[CRON] Generating morning report...
[NOTIFICATION] Email sent successfully
[CRON] Pagi report sent successfully
```

### Error: ENETUNREACH
Jika muncul error `ENETUNREACH`, pastikan:
- SMTP host sudah benar (`smtp.gmail.com`)
- Koneksi internet stabil
- Port 587 tidak diblokir firewall

## Fitur Email Report

### Design Professional
- ✅ Gradient header dengan logo SecMonitor
- ✅ Statistics cards dengan warna-warni
- ✅ Color-coded status (hijau/merah/kuning)
- ✅ Responsive HTML layout
- ✅ Timestamp dalam format Indonesia

### Konten Dinamis
- ✅ Greeting sesuai waktu (Pagi/Sore)
- ✅ Data real-time dari database
- ✅ Hanya tampilkan ancaman jika ada
- ✅ Action required section conditional
- ✅ Link ke dashboard

### Security
- ✅ Hanya kirim jika email enabled
- ✅ Support multiple recipients (comma-separated)
- ✅ Error handling yang baik
- ✅ Timeout protection

## File Terkait

### Backend Files
- `backend/src/services/cronService.js` - Fungsi sendDailyReport()
- `backend/src/services/notificationService.js` - Email sending
- `backend/src/index.js` - Cron initialization

### Test Scripts
- `backend/test-daily-report.js` - Test laporan pagi
- `backend/test-afternoon-report.js` - Test laporan sore
- `backend/check-email-settings.js` - Cek settings
- `backend/fix-email-settings.js` - Fix settings otomatis

## Contoh Email

### Subject
```
📊 Laporan Pagi SecMonitor - Selasa, 5 Mei 2026
```

### Body Preview
```
🛡️ SecMonitor
Laporan Keamanan Pagi

Selamat Pagi! 👋
Berikut adalah laporan keamanan sistem monitoring Anda...

[Statistics Cards]
50 Total Domain | 45 Domain Aktif | 12 Scan Hari Ini | 8 Aktivitas User

[Security Status]
✅ Bersih: 40 domain
🔴 Terinfeksi: 2 domain
🟡 Mencurigakan: 3 domain
⚪ Belum Discan: 5 domain

[Ancaman Terdeteksi]
⚠️ example.com - TERINFEKSI
Malicious: 5 | Suspicious: 2

[Action Required]
Ada 5 domain yang memerlukan perhatian Anda...

[Buka Dashboard Button]
```

## Monitoring

### Cek Cron Jobs Aktif
Saat backend start, akan muncul log:
```
✅ Cron jobs initialized
📧 Daily reports scheduled: 07:00 & 16:00
```

### Cek Email Terkirim
Setiap kali laporan terkirim, cek:
1. Inbox email: `ismaelanmaulani068@gmail.com`
2. Subject: `📊 Laporan Pagi/Sore SecMonitor`
3. Backend log: `[CRON] Pagi/Sore report sent successfully`

## Tips

1. **Pastikan Backend Selalu Running**
   - Gunakan PM2 atau systemd untuk production
   - Cron jobs hanya jalan jika backend aktif

2. **Timezone**
   - Server menggunakan timezone lokal
   - Pastikan server time sudah benar (WIB)

3. **Email Spam**
   - Cek folder Spam jika email tidak masuk
   - Tandai sebagai "Not Spam" untuk email berikutnya

4. **Multiple Recipients**
   - Bisa tambah multiple email di Settings
   - Format: `email1@gmail.com, email2@gmail.com`

## Status
✅ **IMPLEMENTED & TESTED**
- Laporan Pagi (07:00) - Working
- Laporan Sore (16:00) - Working
- Email sending - Working
- Database queries - Working
- HTML template - Working
- Cron scheduling - Working

---

**Last Updated**: May 5, 2026
**Version**: 1.0.0
**Status**: Production Ready ✅
