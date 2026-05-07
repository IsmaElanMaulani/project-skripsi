const { pool } = require('../config/database');

async function getStats(req, res) {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const [[attacksToday]] = await pool.query(
      `SELECT COUNT(*) as count FROM security_logs WHERE DATE(timestamp) = ?`, [today]
    );
    const [[dangerousIPs]] = await pool.query(
      `SELECT COUNT(*) as count FROM ip_checks WHERE status = 'dangerous' AND DATE(checked_at) = ?`, [today]
    );
    const [[malwareFound]] = await pool.query(
      `SELECT COUNT(*) as count FROM malware_scans WHERE status IN ('suspicious','infected') AND DATE(scanned_at) = ?`, [today]
    );
    const [[blockedIPs]] = await pool.query(
      `SELECT COUNT(*) as count FROM cloudflare_blocks WHERE status = 'active' AND DATE(created_at) = ?`, [today]
    );
    const [[totalBlacklist]] = await pool.query(
      `SELECT COUNT(*) as count FROM ip_blacklist WHERE is_active = 1`
    );

    // CVE stats
    const [[totalCVE]] = await pool.query(`SELECT COUNT(*) as count FROM cve_entries`).catch(() => [[{ count: 0 }]]);
    const [[criticalCVE]] = await pool.query(`SELECT COUNT(*) as count FROM cve_entries WHERE severity = 'critical'`).catch(() => [[{ count: 0 }]]);
    const [[highCVE]] = await pool.query(`SELECT COUNT(*) as count FROM cve_entries WHERE severity = 'high'`).catch(() => [[{ count: 0 }]]);
    const [[newCVE]] = await pool.query(
      `SELECT COUNT(*) as count FROM cve_entries WHERE DATE(published_at) >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
    ).catch(() => [[{ count: 0 }]]);

    // Last 7 days attacks chart
    const [chartData] = await pool.query(`
      SELECT DATE(timestamp) as date, COUNT(*) as count
      FROM security_logs
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(timestamp)
      ORDER BY date ASC
    `);

    // Severity breakdown
    const [severityData] = await pool.query(`
      SELECT severity, COUNT(*) as count
      FROM security_logs
      WHERE DATE(timestamp) = ?
      GROUP BY severity
    `, [today]);

    // Recent logs
    const [recentLogs] = await pool.query(`
      SELECT ip_address, country_code, action, severity, timestamp
      FROM security_logs
      ORDER BY timestamp DESC
      LIMIT 5
    `);

    // Latest CVE (7 terbaru)
    const [latestCVE] = await pool.query(`
      SELECT template_id, name, severity, cve_ids, cwe_ids, cvss_score, epss_score,
             vendor, product, published_at
      FROM cve_entries
      ORDER BY published_at DESC
      LIMIT 7
    `).catch(() => [[]]);

    // CVE severity distribution
    const [cveSeverityDist] = await pool.query(`
      SELECT severity, COUNT(*) as count
      FROM cve_entries
      GROUP BY severity
      ORDER BY FIELD(severity,'critical','high','medium','low','info','unknown')
    `).catch(() => [[]]);

    res.json({
      success: true,
      stats: {
        attacksToday: attacksToday.count,
        dangerousIPs: dangerousIPs.count,
        malwareFound: malwareFound.count,
        blockedIPs: blockedIPs.count,
        totalBlacklist: totalBlacklist.count,
        totalCVE: totalCVE.count,
        criticalCVE: criticalCVE.count,
        highCVE: highCVE.count,
        newCVE: newCVE.count,
      },
      chartData,
      severityData,
      recentLogs,
      latestCVE,
      cveSeverityDist,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = { getStats };
