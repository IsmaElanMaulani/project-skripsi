const axios = require('axios');
const { pool } = require('../config/database');

const CF_BASE = 'https://api.cloudflare.com/client/v4';

// Get setting from database
async function getSetting(key) {
  try {
    const [rows] = await pool.query('SELECT value FROM settings WHERE key_name = ?', [key]);
    return rows[0]?.value || '';
  } catch (err) {
    console.error('Error getting setting:', err);
    return '';
  }
}

async function cfHeaders() {
  const token = await getSetting('cloudflare_api_token') || process.env.CLOUDFLARE_API_TOKEN;
  const email = await getSetting('cloudflare_email') || process.env.CLOUDFLARE_EMAIL;
  
  // Auto-detect Global API Key vs API Token
  // Global API Key is a 37-character hex string
  const isGlobalKey = token && /^[a-f0-9]{37}$/i.test(token.trim());

  // If email is provided and the token is a Global API Key, use X-Auth authentication
  if (email && token && isGlobalKey) {
    return {
      'X-Auth-Email': email.trim(),
      'X-Auth-Key': token.trim(),
      'Content-Type': 'application/json',
    };
  }
  
  // Otherwise, use Bearer token authentication (for Custom API Tokens)
  return {
    Authorization: `Bearer ${token ? token.trim() : ''}`,
    'Content-Type': 'application/json',
  };
}

async function getLogs(req, res) {
  const { page = 1, limit = 50, since } = req.query;
  try {
    // Get Cloudflare credentials from settings
    const apiToken = await getSetting('cloudflare_api_token') || process.env.CLOUDFLARE_API_TOKEN;
    const accountId = await getSetting('cloudflare_account_id') || process.env.CLOUDFLARE_ACCOUNT_ID;

    if (!apiToken) {
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const [logs] = await pool.query(
        `SELECT * FROM security_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
        [parseInt(limit), offset]
      );
      const [[{ total }]] = await pool.query(`SELECT COUNT(*) as total FROM security_logs`);

      return res.json({ 
        success: true, 
        logs, 
        total, 
        page: parseInt(page), 
        limit: parseInt(limit), 
        cfError: 'Cloudflare API Token belum dikonfigurasi. Silakan isi di halaman Settings.' 
      });
    }

    let cfError = null;
    let totalFetched = 0;
    let allZones = [];

    try {
      // Step 1: Get all zones in the account
      let zonePage = 1;
      let hasMoreZones = true;

      console.log('[Cloudflare] Fetching all zones from account...');

      while (hasMoreZones && zonePage <= 10) { // Max 10 pages (500 zones)
        const zonesResponse = await axios.get(
          `${CF_BASE}/zones`,
          {
            headers: await cfHeaders(),
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

      console.log(`[Cloudflare] Found ${allZones.length} zones`);

      if (allZones.length === 0) {
        cfError = 'Tidak ada zone ditemukan di akun Cloudflare';
      } else {
        // Step 2: Fetch security events from each zone
        const sinceDate = since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        for (const zone of allZones) {
          try {
            const eventsResponse = await axios.get(
              `${CF_BASE}/zones/${zone.id}/security/events`,
              {
                headers: await cfHeaders(),
                params: { since: sinceDate, per_page: 100 },
                timeout: 15000,
              }
            );

            if (eventsResponse.data.success && eventsResponse.data.result) {
              const events = eventsResponse.data.result;
              console.log(`[Cloudflare] Zone ${zone.name}: ${events.length} events`);
              
              for (const log of events) {
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
                    mapSeverity(log.action),
                    JSON.stringify(log),
                    log.occurredAt || new Date().toISOString(),
                  ]
                );
              }
              totalFetched += events.length;
            }

            // Rate limiting between zones
            await new Promise(r => setTimeout(r, 500));

          } catch (zoneError) {
            console.error(`[Cloudflare] Error fetching events for zone ${zone.name}:`, zoneError.message);
            
            // Check if it's a 404 or route error (plan limitation)
            if (zoneError.response?.status === 404 || 
                zoneError.response?.data?.errors?.[0]?.message?.includes('route') ||
                zoneError.response?.data?.errors?.[0]?.message?.includes('invalid')) {
              // This is likely a plan limitation, not a temporary error
              if (!cfError) {
                cfError = `Security Events API tidak tersedia. Fitur ini memerlukan Cloudflare Business atau Enterprise plan. Anda memiliki ${allZones.length} zones, tapi tidak bisa akses Security Events API dengan plan saat ini.`;
              }
            }
            // Continue with next zone
          }
        }

        console.log(`[Cloudflare] Total fetched: ${totalFetched} events from ${allZones.length} zones`);
      }
    } catch (e) {
      console.error('[Cloudflare] API Error:', e.response?.data || e.message);
      cfError = e.response?.data?.errors?.[0]?.message || e.message;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [logs] = await pool.query(
      `SELECT * FROM security_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
      [parseInt(limit), offset]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) as total FROM security_logs`);

    res.json({ 
      success: true, 
      logs, 
      total, 
      page: parseInt(page), 
      limit: parseInt(limit), 
      cfError,
      fetchedNow: totalFetched,
      zonesCount: allZones?.length || 0
    });
  } catch (err) {
    console.error('[Cloudflare] Error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function blockIP(req, res) {
  const { ip_address, reason } = req.body;
  if (!ip_address) {
    return res.status(400).json({ success: false, message: 'IP address wajib diisi' });
  }

  try {
    const zoneId = await getSetting('cloudflare_zone_id') || process.env.CLOUDFLARE_ZONE_ID;
    const apiToken = await getSetting('cloudflare_api_token') || process.env.CLOUDFLARE_API_TOKEN;
    
    let ruleId = null;
    let cfError = null;

    if (zoneId && apiToken) {
      try {
        const response = await axios.post(
          `${CF_BASE}/zones/${zoneId}/firewall/access_rules/rules`,
          {
            mode: 'block',
            configuration: { target: 'ip', value: ip_address },
            notes: reason || `Blocked via SecMonitor - ${new Date().toISOString()}`,
          },
          { headers: await cfHeaders(), timeout: 10000 }
        );

        if (response.data.success) {
          ruleId = response.data.result?.id;
        } else {
          cfError = response.data.errors?.[0]?.message;
        }
      } catch (e) {
        console.error('[Cloudflare] Block IP Error:', e.response?.data || e.message);
        cfError = e.response?.data?.errors?.[0]?.message || e.message;
      }
    } else {
      cfError = 'Cloudflare API credentials not configured';
    }

    await pool.query(
      `INSERT INTO cloudflare_blocks (ip_address, rule_id, reason, blocked_by_user, status)
       VALUES (?, ?, ?, ?, 'active')
       ON DUPLICATE KEY UPDATE rule_id=VALUES(rule_id), status='active', created_at=NOW()`,
      [ip_address, ruleId, reason || 'Manual block', req.user.username]
    );

    await pool.query(
      `INSERT INTO ip_blacklist (ip_address, reason, blocked_by, cloudflare_rule_id)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE reason=VALUES(reason), is_active=1`,
      [ip_address, reason || 'Manual block', req.user.username, ruleId]
    );

    await pool.query(
      `INSERT INTO notifications (type, title, message, severity)
       VALUES (?, ?, ?, ?)`,
      ['block_ip', 'IP Diblokir', `IP ${ip_address} berhasil diblokir oleh ${req.user.username}`, 'warning']
    );

    res.json({
      success: true,
      message: cfError
        ? `IP disimpan ke blacklist lokal (Cloudflare: ${cfError})`
        : `IP ${ip_address} berhasil diblokir di Cloudflare`,
      ruleId,
      cfError,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

function mapSeverity(action) {
  if (!action) return 'low';
  const a = action.toLowerCase();
  if (a === 'block') return 'high';
  if (a === 'challenge' || a === 'js_challenge' || a === 'managed_challenge') return 'medium';
  return 'low';
}

// Test Cloudflare connection
async function testConnection(req, res) {
  try {
    const apiToken = await getSetting('cloudflare_api_token') || process.env.CLOUDFLARE_API_TOKEN;
    const accountId = await getSetting('cloudflare_account_id') || process.env.CLOUDFLARE_ACCOUNT_ID;

    if (!apiToken) {
      return res.json({
        success: false,
        message: 'Cloudflare API Token belum dikonfigurasi',
        details: {
          hasApiToken: false,
          hasAccountId: !!accountId
        }
      });
    }

    try {
      // Test: Fetch zones from account
      const zonesResponse = await axios.get(
        `${CF_BASE}/zones`,
        {
          headers: await cfHeaders(),
          params: { 
            per_page: 10,
            ...(accountId && { account: { id: accountId } })
          },
          timeout: 10000,
        }
      );

      if (!zonesResponse.data.success) {
        return res.json({
          success: false,
          message: 'Gagal mengakses Cloudflare API',
          error: zonesResponse.data.errors?.[0]?.message
        });
      }

      const zones = zonesResponse.data.result || [];
      const zoneNames = zones.map(z => z.name).slice(0, 5);

      if (zones.length === 0) {
        return res.json({
          success: false,
          message: 'Tidak ada zone ditemukan di akun Cloudflare',
          details: {
            hasApiToken: true,
            hasAccountId: !!accountId,
            zonesCount: 0
          }
        });
      }

      // Test: Try to fetch security events from first zone
      const firstZone = zones[0];
      const sinceDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      try {
        const eventsResponse = await axios.get(
          `${CF_BASE}/zones/${firstZone.id}/security/events`,
          {
            headers: await cfHeaders(),
            params: { since: sinceDate, per_page: 1 },
            timeout: 10000,
          }
        );

        return res.json({
          success: true,
          message: `Koneksi Cloudflare berhasil! Ditemukan ${zones.length} zones`,
          details: {
            zonesCount: zones.length,
            zoneNames,
            accountId: accountId || 'Not set',
            eventsAvailable: eventsResponse.data.result?.length || 0,
            apiWorking: true
          }
        });
      } catch (eventsError) {
        // API Token works but can't access security events
        return res.json({
          success: true,
          message: `API Token valid, ditemukan ${zones.length} zones. Namun tidak bisa akses security events.`,
          warning: 'Pastikan API Token memiliki permission "Analytics:Read"',
          details: {
            zonesCount: zones.length,
            zoneNames,
            accountId: accountId || 'Not set',
            eventsError: eventsError.response?.data?.errors?.[0]?.message
          }
        });
      }

    } catch (error) {
      console.error('[Cloudflare] Test connection error:', error.response?.data || error.message);
      return res.json({
        success: false,
        message: 'Gagal terhubung ke Cloudflare API',
        error: error.response?.data?.errors?.[0]?.message || error.message,
        details: {
          status: error.response?.status,
          statusText: error.response?.statusText
        }
      });
    }

  } catch (err) {
    console.error('[Cloudflare] Test error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error saat test koneksi',
      error: err.message 
    });
  }
}

// Sync domains from Cloudflare to Domain Monitoring
async function syncDomains(req, res) {
  try {
    const apiToken = await getSetting('cloudflare_api_token') || process.env.CLOUDFLARE_API_TOKEN;
    const accountId = await getSetting('cloudflare_account_id') || process.env.CLOUDFLARE_ACCOUNT_ID;

    if (!apiToken) {
      return res.status(400).json({
        success: false,
        message: 'Cloudflare API Token belum dikonfigurasi'
      });
    }

    let allDomains = [];
    let page = 1;
    let hasMore = true;

    // Fetch all zones (domains) from Cloudflare
    while (hasMore) {
      try {
        const response = await axios.get(
          `${CF_BASE}/zones`,
          {
            headers: await cfHeaders(),
            params: { 
              page, 
              per_page: 50,
              ...(accountId && { account: { id: accountId } })
            },
            timeout: 15000,
          }
        );

        if (response.data.success && response.data.result) {
          allDomains = allDomains.concat(response.data.result);
          
          const totalPages = response.data.result_info?.total_pages || 1;
          hasMore = page < totalPages;
          page++;
        } else {
          hasMore = false;
        }
      } catch (error) {
        console.error('[Cloudflare] Error fetching zones:', error.message);
        hasMore = false;
      }
    }

    if (allDomains.length === 0) {
      return res.json({
        success: false,
        message: 'Tidak ada domain ditemukan di Cloudflare',
        imported: 0,
        skipped: 0
      });
    }

    let imported = 0;
    let skipped = 0;
    const importedDomains = [];

    // Import each domain to monitored_domains
    for (const zone of allDomains) {
      const domain = zone.name;
      
      try {
        // Check if already exists
        const [existing] = await pool.query(
          'SELECT id FROM monitored_domains WHERE domain = ?',
          [domain]
        );

        if (existing.length === 0) {
          await pool.query(
            `INSERT INTO monitored_domains (domain, notes, created_by, status) 
             VALUES (?, ?, ?, 'active')`,
            [
              domain,
              `Imported from Cloudflare - Zone ID: ${zone.id}`,
              req.user.id
            ]
          );
          imported++;
          importedDomains.push(domain);
        } else {
          skipped++;
        }

        // Also try to get DNS records (subdomains)
        try {
          const dnsResponse = await axios.get(
            `${CF_BASE}/zones/${zone.id}/dns_records`,
            {
              headers: await cfHeaders(),
              params: { per_page: 100 },
              timeout: 10000,
            }
          );

          if (dnsResponse.data.success && dnsResponse.data.result) {
            for (const record of dnsResponse.data.result) {
              // Only import A, AAAA, CNAME records
              if (['A', 'AAAA', 'CNAME'].includes(record.type)) {
                const subdomain = record.name;
                
                // Skip if it's the main domain
                if (subdomain === domain) continue;
                
                // Check if already exists
                const [subExists] = await pool.query(
                  'SELECT id FROM monitored_domains WHERE domain = ?',
                  [subdomain]
                );

                if (subExists.length === 0) {
                  await pool.query(
                    `INSERT INTO monitored_domains (domain, notes, created_by, status) 
                     VALUES (?, ?, ?, 'active')`,
                    [
                      subdomain,
                      `Subdomain from Cloudflare - Type: ${record.type}`,
                      req.user.id
                    ]
                  );
                  imported++;
                  importedDomains.push(subdomain);
                } else {
                  skipped++;
                }
              }
            }
          }
        } catch (dnsError) {
          console.error(`[Cloudflare] Error fetching DNS for ${domain}:`, dnsError.message);
        }

        // Rate limiting
        await new Promise(r => setTimeout(r, 200));

      } catch (error) {
        console.error(`[Cloudflare] Error importing ${domain}:`, error.message);
        skipped++;
      }
    }

    res.json({
      success: true,
      message: `Berhasil import ${imported} domain/subdomain dari Cloudflare`,
      imported,
      skipped,
      totalZones: allDomains.length,
      domains: importedDomains.slice(0, 10) // Show first 10
    });

  } catch (err) {
    console.error('[Cloudflare] Sync domains error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error saat sync domains',
      error: err.message
    });
  }
}

module.exports = { getLogs, blockIP, testConnection, syncDomains };
