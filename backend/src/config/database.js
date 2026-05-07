const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'security_monitoring',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+00:00',
});

async function initializeDatabase() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role ENUM('admin','viewer') DEFAULT 'viewer',
      is_active TINYINT(1) DEFAULT 1,
      last_login DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS security_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      source VARCHAR(50) DEFAULT 'cloudflare',
      ip_address VARCHAR(45),
      country_code VARCHAR(10),
      user_agent TEXT,
      rule_id VARCHAR(255),
      action VARCHAR(100),
      severity ENUM('low','medium','high','critical') DEFAULT 'low',
      raw_data JSON,
      timestamp DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS ip_checks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ip_address VARCHAR(45) NOT NULL,
      abuse_confidence_score INT DEFAULT 0,
      country_code VARCHAR(10),
      isp VARCHAR(255),
      domain VARCHAR(255),
      total_reports INT DEFAULT 0,
      last_reported_at DATETIME NULL,
      status ENUM('safe','suspicious','dangerous') DEFAULT 'safe',
      raw_data JSON,
      checked_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS ip_blacklist (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ip_address VARCHAR(45) NOT NULL UNIQUE,
      reason TEXT,
      blocked_by VARCHAR(100),
      cloudflare_rule_id VARCHAR(255),
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS malware_scans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      scan_type ENUM('url','file','hash') NOT NULL,
      target VARCHAR(2048),
      file_name VARCHAR(255),
      file_size INT,
      analysis_id VARCHAR(255),
      status ENUM('queued','scanning','clean','suspicious','infected') DEFAULT 'queued',
      stats JSON,
      raw_data JSON,
      scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type VARCHAR(100),
      title VARCHAR(255),
      message TEXT,
      severity ENUM('info','warning','danger','critical') DEFAULT 'info',
      is_read TINYINT(1) DEFAULT 0,
      data JSON,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      key_name VARCHAR(100) NOT NULL UNIQUE,
      value TEXT,
      description VARCHAR(255),
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS cloudflare_blocks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ip_address VARCHAR(45) NOT NULL,
      rule_id VARCHAR(255),
      reason TEXT,
      blocked_by_user VARCHAR(100),
      status ENUM('active','removed') DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await conn.query(`CREATE TABLE IF NOT EXISTS cve_entries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      template_id VARCHAR(255) NOT NULL UNIQUE,
      name VARCHAR(500),
      description TEXT,
      severity ENUM('critical','high','medium','low','info','unknown') DEFAULT 'unknown',
      cve_ids JSON,
      cwe_ids JSON,
      cvss_score FLOAT NULL,
      epss_score FLOAT NULL,
      cvss_metrics VARCHAR(255),
      vendor VARCHAR(255),
      product VARCHAR(255),
      tags JSON,
      references_list JSON,
      remediation TEXT,
      impact TEXT,
      raw_data JSON,
      published_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

    const defaultSettings = [
      ['auto_scan_enabled', '0', 'Aktifkan auto scan VirusTotal'],
      ['auto_scan_interval', '60', 'Interval auto scan (menit)'],
      ['auto_fetch_logs_enabled', '0', 'Aktifkan auto fetch logs'],
      ['auto_fetch_logs_interval', '15', 'Interval fetch logs (menit)'],
      ['abuse_score_threshold', '50', 'Threshold skor AbuseIPDB untuk suspicious'],
      ['abuse_score_danger', '80', 'Threshold skor AbuseIPDB untuk dangerous'],
      ['notification_high_severity', '1', 'Notifikasi realtime untuk severity high'],
    ];

    for (const [key, value, desc] of defaultSettings) {
      await conn.query(
        `INSERT IGNORE INTO settings (key_name, value, description) VALUES (?, ?, ?)`,
        [key, value, desc]
      );
    }

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('admin123', 10);
    await conn.query(
      `INSERT IGNORE INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`,
      ['admin', 'admin@security.local', hash, 'admin']
    );

    console.log('✅ Database initialized successfully');
  } finally {
    conn.release();
  }
}

module.exports = { pool, initializeDatabase };
