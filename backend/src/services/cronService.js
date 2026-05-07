const cron = require('node-cron');
const axios = require('axios');
const { pool } = require('../config/database');
const { sendNotification } = require('./notificationService');

let fetchLogsCron = null;
let autoScanCron = null;

async function getSetting(key) {
  const [rows] = await pool.query('SELECT value FROM settings WHERE key_name = ?', [key]);
  return rows[0]?.value;
}

async function fetchCloudflareLogs() {
  try {
    // Get Cloudflare credentials from settings
    const [tokenRows] = await pool.query('SELECT value FROM settings WHERE key_name = ?', ['cloudflare_api_token']);
    const [emailRows] = await pool.query('SELECT value FROM settings WHERE key_name = ?', ['cloudflare_email']);
    const [accountRows] = await pool.query('SELECT value FROM settings WHERE key_name = ?', ['cloudflare_account_id']);
    
    const apiToken = tokenRows[0]?.value || process.env.CLOUDFLARE_API_TOKEN;
    const email = emailRows[0]?.value || process.env.CLOUDFLARE_EMAIL;
    const accountId = accountRows[0]?.value || process.env.CLOUDFLARE_ACCOUNT_ID;

    if (!apiToken) {
      console.log('[CRON] Cloudflare API Token not configured, skipping fetch');
      return;
    }

    // Build headers based on authentication method
    const headers = email && apiToken ? {
      'X-Auth-Email': email,
      'X-Auth-Key': apiToken,
      'Content-Type': 'application/json',
    } : {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    };

    // Step 1: Get all zones
    let allZones = [];
    let zonePage = 1;
    let hasMoreZones = true;

    while (hasMoreZones && zonePage <= 5) {
      const zonesResponse = await axios.get(
        'https://api.cloudflare.com/client/v4/zones',
        {
          headers,
          params: { 
            page: zonePage, 
            per_page: 50,
            ...(accountId && { account: { id: accountId } })
          },
          timeout: 15000,
        }
      );

      if (zonesResponse.data.success && zonesResponse.data.result) {
        allZones = allZones.concat(zonesResponse.data.result);
        const totalPages = zonesResponse.data.result_info?.total_pages || 1;
        hasMoreZones = zonePage < totalPages;
        zonePage++;
      } else {
        hasMoreZones = false;
      }
    }

    console.log(`[CRON] Found ${allZones.length} Cloudflare zones`);

    if (allZones.length === 0) {
      console.log('[CRON] No zones found in Cloudflare account');
      return;
    }

    // Step 2: Fetch security events from each zone
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    let totalFetched = 0;

    for (const zone of allZones) {
      try {
        const response = await axios.get(
          `https://api.cloudflare.com/client/v4/zones/${zone.id}/security/events`,
          {
            headers,
            params: { since, per_page: 100 },
            timeout: 15000,
          }
        );

        if (response.data.success && response.data.result) {
          for (const log of response.data.result) {
            await pool.query(
              `INSERT IGNORE INTO security_logs 
               (source, ip_address, country_code, user_agent, rule_id, action, severity, raw_data, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                `cloudflare:${zone.name}`,
                log.clientIP || log.source?.ip || 'unknown',
                log.clientCountryName || log.source?.country || 'unknown',
                log.userAgent || log.source?.asn || 'unknown',
                log.ruleId || log.matchedRuleId || 'unknown',
                log.action || 'unknown',
                log.action === 'block' ? 'high' : 'medium',
                JSON.stringify(log),
                log.occurredAt || new Date().toISOString(),
              ]
            );
          }
          totalFetched += response.data.result.length;
          console.log(`[CRON] Zone ${zone.name}: ${response.data.result.length} events`);
        }

        // Rate limiting
        await new Promise(r => setTimeout(r, 500));

      } catch (zoneError) {
        console.error(`[CRON] Error fetching zone ${zone.name}:`, zoneError.message);
      }
    }

    console.log(`[CRON] Total fetched: ${totalFetched} events from ${allZones.length} zones`);
  } catch (e) {
    console.error('[CRON] Cloudflare fetch error:', e.response?.data || e.message);
  }
}

async function checkPendingScans() {
  try {
    const [scans] = await pool.query(
      `SELECT id, analysis_id FROM malware_scans WHERE status IN ('queued','scanning') AND analysis_id IS NOT NULL LIMIT 10`
    );

    for (const scan of scans) {
      try {
        const response = await axios.get(
          `https://www.virustotal.com/api/v3/analyses/${scan.analysis_id}`,
          { headers: { 'x-apikey': process.env.VIRUSTOTAL_API_KEY }, timeout: 10000 }
        );

        const attrs = response.data.data.attributes;
        if (attrs.status === 'completed') {
          const stats = attrs.stats;
          let status = 'clean';
          if (stats.malicious > 0) status = 'infected';
          else if (stats.suspicious > 0) status = 'suspicious';

          await pool.query(
            `UPDATE malware_scans SET status = ?, stats = ?, updated_at = NOW() WHERE id = ?`,
            [status, JSON.stringify(stats), scan.id]
          );
          console.log(`[CRON] Scan ${scan.id} completed: ${status}`);
        }
      } catch (e) {
        console.error(`[CRON] VT check error for scan ${scan.id}:`, e.message);
      }
    }
  } catch (e) {
    console.error('[CRON] Auto scan error:', e.message);
  }
}

// Daily domain scan
async function scanMonitoredDomains() {
  const apiKey = process.env.VIRUSTOTAL_API_KEY?.trim();
  if (!apiKey) {
    console.log('[CRON] VirusTotal API key not set, skipping domain scan');
    return;
  }

  try {
    // Get active domains
    const [domains] = await pool.query(
      'SELECT * FROM monitored_domains WHERE status = "active" ORDER BY last_scan_at ASC LIMIT 20'
    );

    console.log(`[CRON] Starting daily domain scan for ${domains.length} domains`);

    for (const domain of domains) {
      try {
        const url = `https://${domain.domain}`;
        
        // Submit URL to VT
        const FormData = require('form-data');
        const form = new FormData();
        form.append('url', url);

        const submitRes = await axios.post('https://www.virustotal.com/api/v3/urls', form, {
          headers: { 'x-apikey': apiKey, ...form.getHeaders() },
          timeout: 15000,
        });

        const analysisId = submitRes.data.data.id;

        // Wait for result (max 60 seconds)
        let attrs = null;
        const maxWait = 60000;
        const start = Date.now();

        while (Date.now() - start < maxWait) {
          await new Promise(r => setTimeout(r, 5000));
          const r = await axios.get(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, {
            headers: { 'x-apikey': apiKey },
            timeout: 10000,
          });
          if (r.data.data.attributes.status === 'completed') {
            attrs = r.data.data.attributes;
            break;
          }
        }

        if (!attrs) {
          // Get partial result
          const r = await axios.get(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, {
            headers: { 'x-apikey': apiKey },
            timeout: 10000,
          });
          attrs = r.data.data.attributes;
        }

        const stats = attrs.stats || {};
        let result = 'clean';
        if (stats.malicious > 0) result = 'infected';
        else if (stats.suspicious > 0) result = 'suspicious';

        // Save scan result
        await pool.query(
          `INSERT INTO domain_scan_history (domain_id, scan_result, malicious_count, suspicious_count, clean_count, scan_details) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            domain.id,
            result,
            stats.malicious || 0,
            stats.suspicious || 0,
            (stats.harmless || 0) + (stats.undetected || 0),
            JSON.stringify(stats)
          ]
        );

        // Update domain
        await pool.query(
          `UPDATE monitored_domains SET last_scan_at = NOW(), last_scan_result = ?, scan_count = scan_count + 1 WHERE id = ?`,
          [result, domain.id]
        );

        // Create notification if threat detected
        if (result !== 'clean') {
          const severity = result === 'infected' ? 'critical' : 'danger';
          await pool.query(
            `INSERT INTO notifications (title, message, severity, type, related_id) VALUES (?, ?, ?, ?, ?)`,
            [
              `Domain Monitoring: ${result === 'infected' ? 'Terinfeksi' : 'Mencurigakan'}`,
              `Domain ${domain.domain} terdeteksi ${result === 'infected' ? 'terinfeksi' : 'mencurigakan'} (${stats.malicious || 0} malicious, ${stats.suspicious || 0} suspicious)`,
              severity,
              'domain_scan',
              domain.id
            ]
          );

          // Send external notifications
          await sendNotification(
            `⚠️ Domain ${result === 'infected' ? 'Terinfeksi' : 'Mencurigakan'}`,
            `Domain: ${domain.domain}\nStatus: ${result === 'infected' ? 'TERINFEKSI' : 'MENCURIGAKAN'}\nMalicious: ${stats.malicious || 0}\nSuspicious: ${stats.suspicious || 0}\n\nSegera periksa dashboard untuk detail lengkap.`
          );
        }

        console.log(`[CRON] Domain ${domain.domain} scanned: ${result}`);

        // Rate limiting - wait 15 seconds between scans
        await new Promise(r => setTimeout(r, 15000));

      } catch (e) {
        console.error(`[CRON] Error scanning domain ${domain.domain}:`, e.message);
        // Continue with next domain
      }
    }

    console.log('[CRON] Daily domain scan completed');
  } catch (e) {
    console.error('[CRON] Domain scan error:', e.message);
  }
}

async function initCronJobs() {
  cron.schedule('* * * * *', async () => {
    try {
      const fetchEnabled = await getSetting('auto_fetch_logs_enabled');
      const fetchInterval = parseInt(await getSetting('auto_fetch_logs_interval')) || 15;
      const scanEnabled = await getSetting('auto_scan_enabled');

      if (fetchEnabled === '1' && !fetchLogsCron) {
        fetchLogsCron = cron.schedule(`*/${fetchInterval} * * * *`, fetchCloudflareLogs);
        console.log(`[CRON] Auto fetch logs started (every ${fetchInterval} min)`);
      } else if (fetchEnabled !== '1' && fetchLogsCron) {
        fetchLogsCron.stop();
        fetchLogsCron = null;
        console.log('[CRON] Auto fetch logs stopped');
      }

      if (scanEnabled === '1' && !autoScanCron) {
        autoScanCron = cron.schedule('*/5 * * * *', checkPendingScans);
        console.log('[CRON] Auto scan started');
      } else if (scanEnabled !== '1' && autoScanCron) {
        autoScanCron.stop();
        autoScanCron = null;
        console.log('[CRON] Auto scan stopped');
      }
    } catch (e) {}
  });

  cron.schedule('*/5 * * * *', checkPendingScans);
  
  // Daily domain scan at 2 AM
  cron.schedule('0 2 * * *', scanMonitoredDomains);
  
  // Daily reports at 7 AM and 4 PM
  cron.schedule('0 7 * * *', () => sendDailyReport('morning'));
  cron.schedule('0 16 * * *', () => sendDailyReport('afternoon'));
  
  console.log('✅ Cron jobs initialized');
  console.log('📧 Daily reports scheduled: 07:00 & 16:00');
}

// Generate and send daily report
async function sendDailyReport(period = 'morning') {
  try {
    console.log(`[CRON] Generating ${period} report...`);

    // Check if email notifications enabled
    const emailEnabled = await getSetting('email_notifications_enabled');
    if (emailEnabled !== '1') {
      console.log('[CRON] Email notifications disabled, skipping report');
      return;
    }

    // Get statistics from database
    const [[domainStats]] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN last_scan_result = 'clean' THEN 1 ELSE 0 END) as clean,
        SUM(CASE WHEN last_scan_result = 'infected' THEN 1 ELSE 0 END) as infected,
        SUM(CASE WHEN last_scan_result = 'suspicious' THEN 1 ELSE 0 END) as suspicious,
        SUM(CASE WHEN last_scan_result IS NULL THEN 1 ELSE 0 END) as not_scanned
      FROM monitored_domains
    `);

    const [[scanStats]] = await pool.query(`
      SELECT 
        COUNT(*) as total_scans,
        SUM(CASE WHEN scan_result = 'clean' THEN 1 ELSE 0 END) as clean_scans,
        SUM(CASE WHEN scan_result = 'infected' THEN 1 ELSE 0 END) as infected_scans,
        SUM(CASE WHEN scan_result = 'suspicious' THEN 1 ELSE 0 END) as suspicious_scans
      FROM domain_scan_history
      WHERE DATE(scanned_at) = CURDATE()
    `);

    const [[activityStats]] = await pool.query(`
      SELECT COUNT(*) as total_activities
      FROM activity_logs
      WHERE DATE(created_at) = CURDATE()
    `);

    const [recentThreats] = await pool.query(`
      SELECT d.domain, dsh.scan_result, dsh.malicious_count, dsh.suspicious_count, dsh.scanned_at
      FROM domain_scan_history dsh
      JOIN monitored_domains d ON dsh.domain_id = d.id
      WHERE dsh.scan_result IN ('infected', 'suspicious')
        AND DATE(dsh.scanned_at) = CURDATE()
      ORDER BY dsh.scanned_at DESC
      LIMIT 5
    `);

    const [recentScans] = await pool.query(`
      SELECT d.domain, dsh.scan_result, dsh.scanned_at
      FROM domain_scan_history dsh
      JOIN monitored_domains d ON dsh.domain_id = d.id
      WHERE DATE(dsh.scanned_at) = CURDATE()
      ORDER BY dsh.scanned_at DESC
      LIMIT 10
    `);

    // Generate report content
    const periodLabel = period === 'morning' ? 'Pagi' : 'Sore';
    const greeting = period === 'morning' ? 'Selamat Pagi' : 'Selamat Sore';
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    // Build HTML report
    let threatsHtml = '';
    if (recentThreats.length > 0) {
      threatsHtml = `
        <div style="background: #fee; border-left: 4px solid #f44; padding: 15px; margin: 15px 0; border-radius: 5px;">
          <h3 style="color: #c00; margin: 0 0 10px 0;">⚠️ Ancaman Terdeteksi Hari Ini</h3>
          ${recentThreats.map(t => `
            <div style="background: white; padding: 10px; margin: 5px 0; border-radius: 3px;">
              <strong style="color: #333;">${t.domain}</strong><br>
              <span style="color: ${t.scan_result === 'infected' ? '#f00' : '#f80'};">
                ${t.scan_result === 'infected' ? '🔴 TERINFEKSI' : '🟡 MENCURIGAKAN'}
              </span><br>
              <small style="color: #666;">
                Malicious: ${t.malicious_count} | Suspicious: ${t.suspicious_count}<br>
                ${new Date(t.scanned_at).toLocaleString('id-ID')}
              </small>
            </div>
          `).join('')}
        </div>
      `;
    }

    let recentScansHtml = '';
    if (recentScans.length > 0) {
      recentScansHtml = `
        <div style="background: #f9f9f9; padding: 15px; margin: 15px 0; border-radius: 5px;">
          <h3 style="color: #333; margin: 0 0 10px 0;">📊 Scan Terbaru Hari Ini</h3>
          ${recentScans.map(s => `
            <div style="padding: 8px 0; border-bottom: 1px solid #eee;">
              <strong style="color: #333;">${s.domain}</strong>
              <span style="float: right; color: ${s.scan_result === 'clean' ? '#0a0' : s.scan_result === 'infected' ? '#f00' : '#f80'};">
                ${s.scan_result === 'clean' ? '✅' : s.scan_result === 'infected' ? '🔴' : '🟡'} ${s.scan_result.toUpperCase()}
              </span><br>
              <small style="color: #999;">${new Date(s.scanned_at).toLocaleString('id-ID')}</small>
            </div>
          `).join('')}
        </div>
      `;
    }

    const subject = `📊 Laporan ${periodLabel} SecMonitor - ${dateStr}`;
    const message = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🛡️ SecMonitor</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Laporan Keamanan ${periodLabel}</p>
        </div>
        
        <div style="background: #f5f5f5; padding: 30px;">
          <div style="background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
            <h2 style="color: #333; margin: 0 0 10px 0; font-size: 20px;">${greeting}! 👋</h2>
            <p style="color: #666; margin: 0; line-height: 1.6;">
              Berikut adalah laporan keamanan sistem monitoring Anda untuk hari ini, ${dateStr} pukul ${timeStr} WIB.
            </p>
          </div>

          <!-- Statistics Cards -->
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; color: white;">
              <div style="font-size: 36px; font-weight: bold; margin-bottom: 5px;">${domainStats.total || 0}</div>
              <div style="opacity: 0.9;">Total Domain</div>
            </div>
            <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 20px; border-radius: 10px; color: white;">
              <div style="font-size: 36px; font-weight: bold; margin-bottom: 5px;">${domainStats.active || 0}</div>
              <div style="opacity: 0.9;">Domain Aktif</div>
            </div>
            <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 20px; border-radius: 10px; color: white;">
              <div style="font-size: 36px; font-weight: bold; margin-bottom: 5px;">${scanStats.total_scans || 0}</div>
              <div style="opacity: 0.9;">Scan Hari Ini</div>
            </div>
            <div style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); padding: 20px; border-radius: 10px; color: white;">
              <div style="font-size: 36px; font-weight: bold; margin-bottom: 5px;">${activityStats.total_activities || 0}</div>
              <div style="opacity: 0.9;">Aktivitas User</div>
            </div>
          </div>

          <!-- Security Status -->
          <div style="background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
            <h3 style="color: #333; margin: 0 0 15px 0;">🛡️ Status Keamanan</h3>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span style="color: #666;">✅ Bersih</span>
              <strong style="color: #0a0;">${domainStats.clean || 0} domain</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span style="color: #666;">🔴 Terinfeksi</span>
              <strong style="color: #f00;">${domainStats.infected || 0} domain</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span style="color: #666;">🟡 Mencurigakan</span>
              <strong style="color: #f80;">${domainStats.suspicious || 0} domain</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #666;">⚪ Belum Discan</span>
              <strong style="color: #999;">${domainStats.not_scanned || 0} domain</strong>
            </div>
          </div>

          ${threatsHtml}
          ${recentScansHtml}

          <!-- Action Required -->
          ${(domainStats.infected > 0 || domainStats.suspicious > 0) ? `
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; border-radius: 5px;">
              <h3 style="color: #856404; margin: 0 0 10px 0;">⚡ Tindakan Diperlukan</h3>
              <p style="color: #856404; margin: 0;">
                Ada ${(domainStats.infected || 0) + (domainStats.suspicious || 0)} domain yang memerlukan perhatian Anda. 
                Silakan login ke dashboard untuk melihat detail dan mengambil tindakan yang diperlukan.
              </p>
            </div>
          ` : `
            <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 15px 0; border-radius: 5px;">
              <h3 style="color: #155724; margin: 0 0 10px 0;">✅ Semua Aman</h3>
              <p style="color: #155724; margin: 0;">
                Tidak ada ancaman terdeteksi hari ini. Sistem monitoring berjalan dengan baik dan semua domain dalam kondisi aman.
              </p>
            </div>
          `}

          <!-- Footer -->
          <div style="text-align: center; padding: 20px 0; border-top: 1px solid #ddd; margin-top: 20px;">
            <p style="color: #999; font-size: 12px; margin: 0 0 10px 0;">
              Laporan otomatis dari SecMonitor Dashboard<br>
              ${dateStr} • ${timeStr} WIB
            </p>
            <a href="http://localhost:3000" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Buka Dashboard
            </a>
          </div>
        </div>
      </div>
    `;

    // Send email
    await sendNotification(subject, message);
    console.log(`[CRON] ${periodLabel} report sent successfully`);

  } catch (err) {
    console.error(`[CRON] Error sending ${period} report:`, err.message);
  }
}

module.exports = { initCronJobs, fetchCloudflareLogs, scanMonitoredDomains, sendDailyReport };
