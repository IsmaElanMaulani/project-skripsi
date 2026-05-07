const express = require('express');
const multer = require('multer');
const path = require('path');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const authController = require('../controllers/authController');
const dashboardController = require('../controllers/dashboardController');
const cloudflareController = require('../controllers/cloudflareController');
const ipController = require('../controllers/ipController');
const malwareController = require('../controllers/malwareController');
const settingsController = require('../controllers/settingsController');
const userController = require('../controllers/userController');
const notificationController = require('../controllers/notificationController');
const cveController = require('../controllers/cveController');
const domainController = require('../controllers/domainController');
const activityLogController = require('../controllers/activityLogController');

const router = express.Router();

const upload = multer({
  dest: path.join(__dirname, '../../uploads/'),
  limits: { fileSize: 32 * 1024 * 1024 },
});

// Auth
router.post('/auth/login', authController.login);
router.post('/auth/logout', authMiddleware, authController.logout);
router.get('/auth/me', authMiddleware, authController.me);

// Dashboard
router.get('/dashboard/stats', authMiddleware, dashboardController.getStats);

// Cloudflare
router.get('/cloudflare/logs', authMiddleware, cloudflareController.getLogs);
router.post('/cloudflare/block-ip', authMiddleware, adminOnly, cloudflareController.blockIP);
router.get('/cloudflare/test', authMiddleware, adminOnly, cloudflareController.testConnection);
router.post('/cloudflare/sync-domains', authMiddleware, adminOnly, cloudflareController.syncDomains);

// IP Check
router.post('/ip/check', authMiddleware, ipController.checkIP);
router.get('/ip/history', authMiddleware, ipController.getIPHistory);
router.delete('/ip/history/:id', authMiddleware, ipController.deleteIPHistory);

// Malware
router.post('/malware/scan-url', authMiddleware, malwareController.scanURL);
router.post('/malware/scan-file', authMiddleware, upload.single('file'), malwareController.scanFile);
router.get('/malware/result/:id', authMiddleware, malwareController.getResult);
router.get('/malware/history', authMiddleware, malwareController.getScanHistory);

// Settings
router.get('/settings', authMiddleware, settingsController.getSettings);
router.put('/settings', authMiddleware, adminOnly, settingsController.updateSettings);

// Users
router.get('/users', authMiddleware, adminOnly, userController.getUsers);
router.post('/users', authMiddleware, adminOnly, userController.createUser);
router.put('/users/:id', authMiddleware, adminOnly, userController.updateUser);
router.delete('/users/:id', authMiddleware, adminOnly, userController.deleteUser);

// Notifications
router.get('/notifications', authMiddleware, notificationController.getNotifications);
router.put('/notifications/:id/read', authMiddleware, notificationController.markRead);

// CVE
router.get('/cve/list', authMiddleware, cveController.getList);
router.post('/cve/fetch', authMiddleware, adminOnly, cveController.fetchLatest);
router.get('/cve/early', authMiddleware, cveController.fetchEarly);
router.get('/cve/search', authMiddleware, cveController.searchCVE);

// Domain Monitoring
router.get('/domains', authMiddleware, domainController.getDomains);
router.post('/domains', authMiddleware, domainController.addDomain);
router.post('/domains/upload', authMiddleware, upload.single('file'), domainController.uploadDomains);
router.put('/domains/:id', authMiddleware, domainController.updateDomain);
router.delete('/domains/:id', authMiddleware, domainController.deleteDomain);
router.post('/domains/:id/scan', authMiddleware, domainController.scanDomain);
router.get('/domains/:id/history', authMiddleware, domainController.getScanHistory);
router.get('/domains/:id/report', authMiddleware, domainController.generateReport);
router.get('/domains/:id/whois', authMiddleware, domainController.getWhoisInfo);

// Activity Logs
router.get('/activity-logs', authMiddleware, adminOnly, activityLogController.getActivityLogs);
router.get('/activity-logs/stats', authMiddleware, adminOnly, activityLogController.getActivityStats);
router.post('/activity-logs/cleanup', authMiddleware, adminOnly, activityLogController.deleteOldLogs);
router.get('/activity-logs/export', authMiddleware, adminOnly, activityLogController.exportLogs);

// Test Notification
router.post('/test-notification', authMiddleware, async (req, res) => {
  const { sendNotification } = require('../services/notificationService');
  
  try {
    const result = await sendNotification(
      '🔔 Notifikasi dari SecMonitor',
      `Halo ${req.user.username}!

Ini adalah notifikasi real dari sistem SecMonitor Anda.

📊 Status Sistem:
✅ Backend: Running
✅ Database: Connected
✅ Email Service: Active

🛡️ Security Summary:
- Total Domains Monitored: Active
- Last Scan: ${new Date().toLocaleString('id-ID')}
- Threats Detected: 0

💡 Sistem monitoring berjalan dengan baik dan siap mengirim alert jika ada ancaman terdeteksi.

Terima kasih telah menggunakan SecMonitor! 🚀`
    );
    
    if (result) {
      res.json({ 
        success: true, 
        message: 'Notifikasi berhasil dikirim! Cek email Anda.',
        email: 'ismaelanmaulani068@gmail.com'
      });
    } else {
      res.json({ 
        success: false, 
        message: 'Gagal mengirim notifikasi. Cek konfigurasi email di Settings.' 
      });
    }
  } catch (err) {
    console.error('Test notification error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

module.exports = router;
