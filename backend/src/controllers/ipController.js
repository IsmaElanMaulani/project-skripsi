const axios = require('axios');
const { pool } = require('../config/database');

// Mapping kategori AbuseIPDB
const ABUSE_CATEGORIES = {
  1:  { name: 'DNS Compromise', icon: '🔓', color: 'red' },
  2:  { name: 'DNS Poisoning', icon: '☠', color: 'red' },
  3:  { name: 'Fraud Orders', icon: '💳', color: 'orange' },
  4:  { name: 'DDoS Attack', icon: '💥', color: 'red' },
  5:  { name: 'FTP Brute-Force', icon: '🔑', color: 'orange' },
  6:  { name: 'Ping of Death', icon: '📡', color: 'orange' },
  7:  { name: 'Phishing', icon: '🎣', color: 'red' },
  8:  { name: 'Fraud VoIP', icon: '📞', color: 'orange' },
  9:  { name: 'Open Proxy', icon: '🔀', color: 'yellow' },
  10: { name: 'Web Spam', icon: '📧', color: 'yellow' },
  11: { name: 'Email Spam', icon: '📨', color: 'yellow' },
  12: { name: 'Blog Spam', icon: '📝', color: 'yellow' },
  13: { name: 'VPN IP', icon: '🔒', color: 'yellow' },
  14: { name: 'Port Scan', icon: '🔍', color: 'orange' },
  15: { name: 'Hacking', icon: '💻', color: 'red' },
  16: { name: 'SQL Injection', icon: '🗄', color: 'red' },
  17: { name: 'Spoofing', icon: '🎭', color: 'orange' },
  18: { name: 'Brute-Force', icon: '🔨', color: 'red' },
  19: { name: 'Bad Web Bot', icon: '🤖', color: 'orange' },
  20: { name: 'Exploited Host', icon: '⚠', color: 'red' },
  21: { name: 'Web App Attack', icon: '🌐', color: 'red' },
  22: { name: 'SSH Brute-Force', icon: '🔐', color: 'red' },
  23: { name: 'IoT Targeted', icon: '📱', color: 'orange' },
};

async function checkIP(req, res) {
  const { ip_address } = req.body;
  if (!ip_address) {
    return res.status(400).json({ success: false, message: 'IP address wajib diisi' });
  }

  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$|^([0-9a-fA-F:]+)$/;
  if (!ipRegex.test(ip_address)) {
    return res.status(400).json({ success: false, message: 'Format IP address tidak valid' });
  }

  try {
    const response = await axios.get('https://api.abuseipdb.com/api/v2/check', {
      headers: { Key: process.env.ABUSEIPDB_API_KEY, Accept: 'application/json' },
      params: { ipAddress: ip_address, maxAgeInDays: 90, verbose: true },
      timeout: 10000,
    });

    const data = response.data.data;
    const score = data.abuseConfidenceScore;

    // Ambil kategori unik dari semua laporan
    const reportedCategories = new Set();
    if (data.reports && Array.isArray(data.reports)) {
      data.reports.forEach(report => {
        if (report.categories) {
          report.categories.forEach(cat => reportedCategories.add(cat));
        }
      });
    }

    const categories = [...reportedCategories].map(id => ({
      id,
      ...(ABUSE_CATEGORIES[id] || { name: `Kategori ${id}`, icon: '⚡', color: 'gray' }),
    }));

    // Ambil sample laporan terbaru (max 10)
    const recentReports = (data.reports || []).slice(0, 10).map(r => ({
      reportedAt: r.reportedAt,
      comment: r.comment,
      categories: (r.categories || []).map(id => ABUSE_CATEGORIES[id]?.name || `Cat-${id}`),
      countryCode: r.reporterCountryCode,
    }));

    // Thresholds
    const [settings] = await pool.query(
      `SELECT key_name, value FROM settings WHERE key_name IN ('abuse_score_threshold','abuse_score_danger')`
    );
    const thresholds = {};
    settings.forEach(s => (thresholds[s.key_name] = parseInt(s.value)));
    const suspiciousThreshold = thresholds['abuse_score_threshold'] || 50;
    const dangerThreshold = thresholds['abuse_score_danger'] || 80;

    let status = 'safe';
    if (score >= dangerThreshold) status = 'dangerous';
    else if (score >= suspiciousThreshold) status = 'suspicious';

    // Save to DB
    const [result] = await pool.query(
      `INSERT INTO ip_checks 
       (ip_address, abuse_confidence_score, country_code, isp, domain, total_reports, last_reported_at, status, raw_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ip_address, score, data.countryCode, data.isp, data.domain,
       data.totalReports, data.lastReportedAt || null, status, JSON.stringify(data)]
    );

    if (status === 'dangerous') {
      await pool.query(
        `INSERT INTO notifications (type, title, message, severity, data) VALUES (?, ?, ?, ?, ?)`,
        ['dangerous_ip', 'IP Berbahaya Terdeteksi',
         `IP ${ip_address} memiliki skor abuse ${score}% (${data.countryCode})`,
         'critical', JSON.stringify({ ip: ip_address, score, country: data.countryCode })]
      );
    }

    res.json({
      success: true,
      data: {
        id: result.insertId,
        ip_address,
        abuse_confidence_score: score,
        country_code: data.countryCode,
        isp: data.isp,
        domain: data.domain,
        total_reports: data.totalReports,
        last_reported_at: data.lastReportedAt,
        status,
        usage_type: data.usageType,
        hostnames: data.hostnames,
        is_tor: data.isTor,
        is_public: data.isPublic,
        categories,
        recent_reports: recentReports,
      },
    });
  } catch (err) {
    if (err.response?.status === 422) return res.status(422).json({ success: false, message: 'IP address tidak valid' });
    if (err.response?.status === 401) return res.status(401).json({ success: false, message: 'AbuseIPDB API key tidak valid' });
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal mengecek IP: ' + err.message });
  }
}

async function getIPHistory(req, res) {
  const { page = 1, limit = 20, status } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    let where = '';
    const params = [];
    if (status) { where = 'WHERE status = ?'; params.push(status); }
    const [rows] = await pool.query(
      `SELECT id, ip_address, abuse_confidence_score, country_code, isp, domain, total_reports, status, checked_at
       FROM ip_checks ${where} ORDER BY checked_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) as total FROM ip_checks ${where}`, params);
    res.json({ success: true, data: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function deleteIPHistory(req, res) {
  const { id } = req.params;
  try {
    const [result] = await pool.query('DELETE FROM ip_checks WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
    }
    res.json({ success: true, message: 'Riwayat IP berhasil dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal menghapus data' });
  }
}

module.exports = { checkIP, getIPHistory, deleteIPHistory };
