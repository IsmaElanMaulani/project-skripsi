const axios = require('axios');
const { pool } = require('../config/database');
const FormData = require('form-data');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const path = require('path');
const { sendNotification } = require('../services/notificationService');

const VT_BASE = 'https://www.virustotal.com/api/v3';

function vtKey() {
  return process.env.VIRUSTOTAL_API_KEY?.trim();
}

// Get subdomains from VirusTotal
async function getSubdomains(hostname, apiKey) {
  const subs = new Set();
  try {
    let cursor = null;
    let page = 0;
    do {
      const params = { limit: 40 };
      if (cursor) params.cursor = cursor;
      const res = await axios.get(`${VT_BASE}/domains/${hostname}/subdomains`, {
        headers: { 'x-apikey': apiKey },
        params,
        timeout: 10000,
      });
      (res.data.data || []).forEach(d => subs.add(d.id));
      cursor = res.data.meta?.cursor;
      page++;
    } while (cursor && page < 3);
  } catch (e) {
    console.error('Error fetching subdomains:', e.message);
  }

  return [...subs].filter(s => s !== hostname).slice(0, 10); // Limit to 10 subdomains
}

// Get all monitored domains
async function getDomains(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT d.*, u.username as created_by_name 
      FROM monitored_domains d 
      LEFT JOIN users u ON d.created_by = u.id 
      ORDER BY d.created_at DESC
    `);
    res.json({ success: true, domains: rows });
  } catch (err) {
    console.error('getDomains error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// Add single domain
async function addDomain(req, res) {
  const { domain, notes } = req.body;
  if (!domain) {
    return res.status(400).json({ success: false, message: 'Domain wajib diisi' });
  }

  // Clean domain
  let cleanDomain = domain.trim().toLowerCase();
  cleanDomain = cleanDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');

  try {
    // Check if already exists
    const [existing] = await pool.query('SELECT id FROM monitored_domains WHERE domain = ?', [cleanDomain]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Domain sudah ada dalam monitoring' });
    }

    const [result] = await pool.query(
      'INSERT INTO monitored_domains (domain, notes, created_by) VALUES (?, ?, ?)',
      [cleanDomain, notes || null, req.user.id]
    );

    res.json({ success: true, message: 'Domain berhasil ditambahkan', id: result.insertId });
  } catch (err) {
    console.error('addDomain error:', err);
    res.status(500).json({ success: false, message: 'Gagal menambahkan domain' });
  }
}

// Bulk upload domains from file
async function uploadDomains(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'File wajib diupload' });
  }

  try {
    const content = fs.readFileSync(req.file.path, 'utf-8');
    const lines = content.split(/\r?\n/).filter(l => l.trim());
    
    const domains = [];
    for (const line of lines) {
      let domain = line.trim().toLowerCase();
      domain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      if (domain && !domains.includes(domain)) {
        domains.push(domain);
      }
    }

    fs.unlink(req.file.path, () => {});

    if (domains.length === 0) {
      return res.status(400).json({ success: false, message: 'Tidak ada domain valid dalam file' });
    }

    let added = 0;
    let skipped = 0;

    for (const domain of domains) {
      try {
        const [existing] = await pool.query('SELECT id FROM monitored_domains WHERE domain = ?', [domain]);
        if (existing.length === 0) {
          await pool.query(
            'INSERT INTO monitored_domains (domain, created_by) VALUES (?, ?)',
            [domain, req.user.id]
          );
          added++;
        } else {
          skipped++;
        }
      } catch (e) {
        skipped++;
      }
    }

    res.json({ 
      success: true, 
      message: `Berhasil menambahkan ${added} domain, ${skipped} dilewati (duplikat)`,
      added,
      skipped
    });
  } catch (err) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    console.error('uploadDomains error:', err);
    res.status(500).json({ success: false, message: 'Gagal memproses file' });
  }
}

// Update domain
async function updateDomain(req, res) {
  const { id } = req.params;
  const { status, notes } = req.body;

  try {
    const updates = [];
    const values = [];

    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'Tidak ada data untuk diupdate' });
    }

    values.push(id);
    await pool.query(`UPDATE monitored_domains SET ${updates.join(', ')} WHERE id = ?`, values);

    res.json({ success: true, message: 'Domain berhasil diupdate' });
  } catch (err) {
    console.error('updateDomain error:', err);
    res.status(500).json({ success: false, message: 'Gagal update domain' });
  }
}

// Delete domain
async function deleteDomain(req, res) {
  const { id } = req.params;

  try {
    // Delete scan history first
    await pool.query('DELETE FROM domain_scan_history WHERE domain_id = ?', [id]);
    
    // Delete domain
    await pool.query('DELETE FROM monitored_domains WHERE id = ?', [id]);

    res.json({ success: true, message: 'Domain berhasil dihapus' });
  } catch (err) {
    console.error('deleteDomain error:', err);
    res.status(500).json({ success: false, message: 'Gagal menghapus domain' });
  }
}

// Manual scan single domain
async function scanDomain(req, res) {
  const { id } = req.params;
  const { scan_subdomains } = req.body;
  const apiKey = vtKey();

  if (!apiKey) {
    return res.status(400).json({ success: false, message: 'VIRUSTOTAL_API_KEY belum diset' });
  }

  try {
    const [domains] = await pool.query('SELECT * FROM monitored_domains WHERE id = ?', [id]);
    if (domains.length === 0) {
      return res.status(404).json({ success: false, message: 'Domain tidak ditemukan' });
    }

    const domain = domains[0];
    const url = `https://${domain.domain}`;

    // Submit URL to VT
    const form = new FormData();
    form.append('url', url);

    const submitRes = await axios.post(`${VT_BASE}/urls`, form, {
      headers: { 'x-apikey': apiKey, ...form.getHeaders() },
      timeout: 15000,
    });

    const analysisId = submitRes.data.data.id;

    // Wait for result (max 60 seconds)
    let attrs = null;
    const maxWait = 60000;
    const start = Date.now();

    while (Date.now() - start < maxWait) {
      await new Promise(r => setTimeout(r, 4000));
      const r = await axios.get(`${VT_BASE}/analyses/${analysisId}`, {
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
      const r = await axios.get(`${VT_BASE}/analyses/${analysisId}`, {
        headers: { 'x-apikey': apiKey },
        timeout: 10000,
      });
      attrs = r.data.data.attributes;
    }

    const stats = attrs.stats || {};
    let result = 'clean';
    if (stats.malicious > 0) result = 'infected';
    else if (stats.suspicious > 0) result = 'suspicious';

    // Scan subdomains if requested
    let subdomainResults = [];
    if (scan_subdomains) {
      const subdomains = await getSubdomains(domain.domain, apiKey);
      
      for (const subdomain of subdomains.slice(0, 5)) {
        try {
          const subUrl = `https://${subdomain}`;
          const subForm = new FormData();
          subForm.append('url', subUrl);

          const subSubmitRes = await axios.post(`${VT_BASE}/urls`, subForm, {
            headers: { 'x-apikey': apiKey, ...subForm.getHeaders() },
            timeout: 15000,
          });

          const subAnalysisId = subSubmitRes.data.data.id;
          
          // Wait for subdomain result
          let subAttrs = null;
          const subStart = Date.now();
          while (Date.now() - subStart < 45000) {
            await new Promise(r => setTimeout(r, 4000));
            const r = await axios.get(`${VT_BASE}/analyses/${subAnalysisId}`, {
              headers: { 'x-apikey': apiKey },
              timeout: 10000,
            });
            if (r.data.data.attributes.status === 'completed') {
              subAttrs = r.data.data.attributes;
              break;
            }
          }

          if (subAttrs) {
            const subStats = subAttrs.stats || {};
            let subResult = 'clean';
            if (subStats.malicious > 0) subResult = 'infected';
            else if (subStats.suspicious > 0) subResult = 'suspicious';

            subdomainResults.push({
              subdomain,
              result: subResult,
              stats: subStats
            });
          }

          // Rate limiting
          await new Promise(r => setTimeout(r, 15000));
        } catch (e) {
          console.error(`Error scanning subdomain ${subdomain}:`, e.message);
        }
      }
    }

    // Save scan result with subdomains
    const scanData = {
      main: { result, stats },
      subdomains: subdomainResults
    };

    await pool.query(
      `INSERT INTO domain_scan_history (domain_id, scan_result, malicious_count, suspicious_count, clean_count, scan_details) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        result,
        stats.malicious || 0,
        stats.suspicious || 0,
        (stats.harmless || 0) + (stats.undetected || 0),
        JSON.stringify(scanData)
      ]
    );

    // Update domain
    await pool.query(
      `UPDATE monitored_domains SET last_scan_at = NOW(), last_scan_result = ?, scan_count = scan_count + 1 WHERE id = ?`,
      [result, id]
    );

    // Create notification if threat detected
    const totalThreats = subdomainResults.filter(s => s.result !== 'clean').length;
    if (result !== 'clean' || totalThreats > 0) {
      const severity = result === 'infected' ? 'critical' : 'danger';
      await pool.query(
        `INSERT INTO notifications (title, message, severity, type, related_id) VALUES (?, ?, ?, ?, ?)`,
        [
          `Domain Monitoring: ${result === 'infected' ? 'Terinfeksi' : 'Mencurigakan'}`,
          `Domain ${domain.domain} terdeteksi ${result === 'infected' ? 'terinfeksi' : 'mencurigakan'} (${stats.malicious || 0} malicious, ${stats.suspicious || 0} suspicious)${totalThreats > 0 ? ` + ${totalThreats} subdomain terdeteksi ancaman` : ''}`,
          severity,
          'domain_scan',
          id
        ]
      );

      // Send external notifications
      await sendNotification(
        `⚠️ Domain ${result === 'infected' ? 'Terinfeksi' : 'Mencurigakan'}`,
        `Domain: ${domain.domain}\nStatus: ${result === 'infected' ? 'TERINFEKSI' : 'MENCURIGAKAN'}\nMalicious: ${stats.malicious || 0}\nSuspicious: ${stats.suspicious || 0}${totalThreats > 0 ? `\nSubdomain terancam: ${totalThreats}` : ''}\n\nSegera periksa dashboard untuk detail lengkap.`
      );
    }

    res.json({ 
      success: true, 
      message: 'Scan selesai',
      result: {
        scan_result: result,
        stats,
        subdomains: subdomainResults
      }
    });

  } catch (err) {
    console.error('scanDomain error:', err);
    if (err.response?.status === 429) {
      return res.status(429).json({ success: false, message: 'VirusTotal rate limit - coba lagi nanti' });
    }
    res.status(500).json({ success: false, message: 'Gagal scan domain: ' + err.message });
  }
}

// Get scan history for a domain
async function getScanHistory(req, res) {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT * FROM domain_scan_history WHERE domain_id = ? ORDER BY scanned_at DESC LIMIT 50`,
      [id]
    );
    res.json({ success: true, history: rows });
  } catch (err) {
    console.error('getScanHistory error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// Generate PDF report
async function generateReport(req, res) {
  const { id } = req.params;

  try {
    // Get domain info
    const [domains] = await pool.query('SELECT * FROM monitored_domains WHERE id = ?', [id]);
    if (domains.length === 0) {
      return res.status(404).json({ success: false, message: 'Domain tidak ditemukan' });
    }
    const domain = domains[0];

    // Get scan history
    const [history] = await pool.query(
      `SELECT * FROM domain_scan_history WHERE domain_id = ? ORDER BY scanned_at DESC LIMIT 20`,
      [id]
    );

    // Calculate statistics
    const totalScans = history.length;
    const cleanScans = history.filter(h => h.scan_result === 'clean').length;
    const suspiciousScans = history.filter(h => h.scan_result === 'suspicious').length;
    const infectedScans = history.filter(h => h.scan_result === 'infected').length;
    const totalMalicious = history.reduce((sum, h) => sum + (h.malicious_count || 0), 0);
    const totalSuspicious = history.reduce((sum, h) => sum + (h.suspicious_count || 0), 0);

    // Create PDF with custom styling
    const doc = new PDFDocument({ 
      margin: 50,
      size: 'A4',
      bufferPages: true
    });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=domain-report-${domain.domain}-${Date.now()}.pdf`);
    
    doc.pipe(res);

    // ============ COVER PAGE ============
    // Background gradient effect (simulated with rectangles)
    doc.rect(0, 0, doc.page.width, 250).fill('#667eea');
    doc.rect(0, 250, doc.page.width, doc.page.height - 250).fill('#f8f9fa');

    // Logo/Icon area
    doc.circle(doc.page.width / 2, 100, 40).fill('#ffffff');
    doc.fontSize(30).fillColor('#667eea').text('🛡️', doc.page.width / 2 - 15, 85);

    // Title
    doc.fontSize(32).fillColor('#ffffff').text('SecMonitor', 50, 160, { 
      align: 'center',
      width: doc.page.width - 100
    });
    
    doc.fontSize(20).fillColor('#e0e7ff').text('Domain Security Report', 50, 200, { 
      align: 'center',
      width: doc.page.width - 100
    });

    // Domain name in box
    doc.roundedRect(100, 280, doc.page.width - 200, 60, 10)
       .fillAndStroke('#ffffff', '#667eea');
    doc.fontSize(18).fillColor('#667eea').text(domain.domain, 100, 300, {
      align: 'center',
      width: doc.page.width - 200
    });

    // Report metadata
    doc.fontSize(11).fillColor('#6b7280');
    const reportDate = new Date().toLocaleString('id-ID', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    doc.text(`Generated: ${reportDate}`, 50, 380, { align: 'center', width: doc.page.width - 100 });
    doc.text(`Report ID: ${domain.id}-${Date.now()}`, 50, 400, { align: 'center', width: doc.page.width - 100 });

    // Status badge
    const statusY = 450;
    const statusColor = domain.last_scan_result === 'clean' ? '#10b981' : 
                       domain.last_scan_result === 'infected' ? '#ef4444' : '#f59e0b';
    const statusText = domain.last_scan_result === 'clean' ? '✓ CLEAN' : 
                      domain.last_scan_result === 'infected' ? '✕ INFECTED' : '⚠ SUSPICIOUS';
    
    doc.roundedRect(doc.page.width / 2 - 80, statusY, 160, 40, 20)
       .fill(statusColor);
    doc.fontSize(16).fillColor('#ffffff').text(statusText, doc.page.width / 2 - 80, statusY + 12, {
      align: 'center',
      width: 160
    });

    // Footer on cover
    doc.fontSize(9).fillColor('#9ca3af').text(
      'Confidential - For Internal Use Only',
      50,
      doc.page.height - 80,
      { align: 'center', width: doc.page.width - 100 }
    );

    // ============ PAGE 2: EXECUTIVE SUMMARY ============
    doc.addPage();
    
    // Page header
    drawPageHeader(doc, 'Executive Summary');

    let yPos = 120;

    // Domain Information Card
    drawCard(doc, 50, yPos, doc.page.width - 100, 140, '#667eea');
    doc.fontSize(14).fillColor('#667eea').text('📋 Domain Information', 70, yPos + 15);
    
    doc.fontSize(10).fillColor('#374151');
    yPos += 45;
    drawInfoRow(doc, 70, yPos, 'Domain Name', domain.domain);
    yPos += 20;
    drawInfoRow(doc, 70, yPos, 'Monitoring Status', domain.status === 'active' ? '● Active' : '○ Inactive');
    yPos += 20;
    drawInfoRow(doc, 70, yPos, 'Total Scans Performed', `${domain.scan_count || 0} scans`);
    yPos += 20;
    drawInfoRow(doc, 70, yPos, 'Last Scan Date', domain.last_scan_at ? new Date(domain.last_scan_at).toLocaleString('id-ID') : 'Never scanned');

    yPos += 50;

    // Security Summary Card
    drawCard(doc, 50, yPos, doc.page.width - 100, 160, '#10b981');
    doc.fontSize(14).fillColor('#10b981').text('🔒 Security Summary', 70, yPos + 15);
    
    yPos += 45;
    
    // Statistics boxes
    const boxWidth = (doc.page.width - 140) / 3;
    drawStatBox(doc, 70, yPos, boxWidth - 10, 'Total Scans', totalScans, '#667eea');
    drawStatBox(doc, 70 + boxWidth, yPos, boxWidth - 10, 'Clean', cleanScans, '#10b981');
    drawStatBox(doc, 70 + boxWidth * 2, yPos, boxWidth - 10, 'Threats', infectedScans + suspiciousScans, '#ef4444');

    yPos += 80;

    // Threat Analysis Card
    drawCard(doc, 50, yPos, doc.page.width - 100, 120, '#f59e0b');
    doc.fontSize(14).fillColor('#f59e0b').text('⚠️ Threat Analysis', 70, yPos + 15);
    
    yPos += 45;
    doc.fontSize(10).fillColor('#374151');
    drawInfoRow(doc, 70, yPos, 'Total Malicious Detections', `${totalMalicious} threats`);
    yPos += 20;
    drawInfoRow(doc, 70, yPos, 'Total Suspicious Detections', `${totalSuspicious} warnings`);
    yPos += 20;
    drawInfoRow(doc, 70, yPos, 'Infected Scans', `${infectedScans} (${totalScans > 0 ? ((infectedScans/totalScans)*100).toFixed(1) : 0}%)`);

    // ============ PAGE 3: DETAILED SCAN HISTORY ============
    doc.addPage();
    drawPageHeader(doc, 'Detailed Scan History');

    yPos = 120;

    if (history.length === 0) {
      doc.fontSize(12).fillColor('#6b7280').text('No scan history available', 50, yPos, {
        align: 'center',
        width: doc.page.width - 100
      });
    } else {
      history.forEach((scan, index) => {
        // Check if we need a new page
        if (yPos > doc.page.height - 200) {
          doc.addPage();
          drawPageHeader(doc, 'Detailed Scan History (continued)');
          yPos = 120;
        }

        // Scan card
        const cardHeight = 140;
        const scanColor = scan.scan_result === 'clean' ? '#10b981' : 
                         scan.scan_result === 'infected' ? '#ef4444' : '#f59e0b';
        
        drawCard(doc, 50, yPos, doc.page.width - 100, cardHeight, scanColor);

        // Scan header
        doc.fontSize(12).fillColor(scanColor).text(`Scan #${index + 1}`, 70, yPos + 15);
        doc.fontSize(9).fillColor('#6b7280').text(
          new Date(scan.scanned_at).toLocaleString('id-ID'),
          doc.page.width - 250,
          yPos + 17
        );

        // Result badge
        const badgeX = doc.page.width - 150;
        doc.roundedRect(badgeX, yPos + 12, 80, 20, 10).fill(scanColor);
        doc.fontSize(9).fillColor('#ffffff').text(
          scan.scan_result.toUpperCase(),
          badgeX,
          yPos + 16,
          { align: 'center', width: 80 }
        );

        // Stats
        yPos += 45;
        const statBoxWidth = (doc.page.width - 140) / 3;
        drawMiniStatBox(doc, 70, yPos, statBoxWidth - 10, 'Malicious', scan.malicious_count, '#ef4444');
        drawMiniStatBox(doc, 70 + statBoxWidth, yPos, statBoxWidth - 10, 'Suspicious', scan.suspicious_count, '#f59e0b');
        drawMiniStatBox(doc, 70 + statBoxWidth * 2, yPos, statBoxWidth - 10, 'Clean', scan.clean_count, '#10b981');

        // Subdomain info
        try {
          const details = JSON.parse(scan.scan_details);
          if (details.subdomains && details.subdomains.length > 0) {
            yPos += 50;
            doc.fontSize(9).fillColor('#6b7280').text(`🌐 ${details.subdomains.length} Subdomains Scanned`, 70, yPos);
            
            yPos += 18;
            details.subdomains.slice(0, 3).forEach(sub => {
              const subColor = sub.result === 'clean' ? '#10b981' : 
                              sub.result === 'infected' ? '#ef4444' : '#f59e0b';
              doc.fontSize(8).fillColor('#374151').text(`• ${sub.subdomain}`, 80, yPos, { continued: true });
              doc.fillColor(subColor).text(` - ${sub.result.toUpperCase()}`, { continued: false });
              yPos += 12;
            });

            if (details.subdomains.length > 3) {
              doc.fontSize(8).fillColor('#9ca3af').text(`  ... and ${details.subdomains.length - 3} more`, 80, yPos);
            }
          }
        } catch (e) {
          // Ignore parse errors
        }

        yPos += cardHeight - 30;
      });
    }

    // ============ FINAL PAGE: RECOMMENDATIONS ============
    doc.addPage();
    drawPageHeader(doc, 'Security Recommendations');

    yPos = 120;

    // Recommendations based on scan results
    const recommendations = [];
    
    if (infectedScans > 0) {
      recommendations.push({
        icon: '🚨',
        title: 'Critical Action Required',
        desc: 'Domain has been detected as infected. Immediate investigation and remediation required.',
        color: '#ef4444'
      });
    }

    if (suspiciousScans > 0) {
      recommendations.push({
        icon: '⚠️',
        title: 'Monitor Closely',
        desc: 'Suspicious activity detected. Continue monitoring and consider additional security measures.',
        color: '#f59e0b'
      });
    }

    if (cleanScans === totalScans && totalScans > 0) {
      recommendations.push({
        icon: '✅',
        title: 'Good Security Posture',
        desc: 'All scans returned clean results. Continue regular monitoring to maintain security.',
        color: '#10b981'
      });
    }

    recommendations.push({
      icon: '🔄',
      title: 'Regular Scanning',
      desc: 'Maintain daily automated scans to detect threats early and respond quickly.',
      color: '#667eea'
    });

    recommendations.push({
      icon: '📧',
      title: 'Enable Notifications',
      desc: 'Configure email and Telegram notifications for real-time threat alerts.',
      color: '#8b5cf6'
    });

    recommendations.forEach((rec, idx) => {
      if (yPos > doc.page.height - 150) {
        doc.addPage();
        drawPageHeader(doc, 'Security Recommendations (continued)');
        yPos = 120;
      }

      drawCard(doc, 50, yPos, doc.page.width - 100, 80, rec.color);
      doc.fontSize(20).text(rec.icon, 70, yPos + 15);
      doc.fontSize(12).fillColor(rec.color).text(rec.title, 110, yPos + 15);
      doc.fontSize(9).fillColor('#374151').text(rec.desc, 110, yPos + 35, {
        width: doc.page.width - 180
      });

      yPos += 95;
    });

    // Footer section
    yPos = doc.page.height - 120;
    doc.moveTo(50, yPos).lineTo(doc.page.width - 50, yPos).stroke('#e5e7eb');
    yPos += 20;

    doc.fontSize(10).fillColor('#374151').text('About SecMonitor', 50, yPos);
    doc.fontSize(8).fillColor('#6b7280').text(
      'SecMonitor is an advanced security monitoring platform that provides real-time threat detection, ' +
      'automated scanning, and comprehensive reporting for your digital assets.',
      50,
      yPos + 20,
      { width: doc.page.width - 100, align: 'justify' }
    );

    // Add page numbers to all pages
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      
      // Footer line
      doc.moveTo(50, doc.page.height - 50)
         .lineTo(doc.page.width - 50, doc.page.height - 50)
         .stroke('#e5e7eb');
      
      // Page number
      doc.fontSize(9).fillColor('#9ca3af').text(
        `Page ${i + 1} of ${pages.count}`,
        50,
        doc.page.height - 40,
        { align: 'center', width: doc.page.width - 100 }
      );
    }

    doc.end();

  } catch (err) {
    console.error('generateReport error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Gagal generate report' });
    }
  }
}

// Helper functions for PDF styling
function drawPageHeader(doc, title) {
  doc.rect(0, 0, doc.page.width, 80).fill('#667eea');
  doc.fontSize(18).fillColor('#ffffff').text(title, 50, 35);
  doc.fontSize(10).fillColor('#e0e7ff').text('SecMonitor Domain Security Report', 50, 60);
}

function drawCard(doc, x, y, width, height, accentColor) {
  // Shadow effect
  doc.rect(x + 3, y + 3, width, height).fill('#00000020');
  // Main card
  doc.roundedRect(x, y, width, height, 8).fill('#ffffff');
  // Accent border
  doc.roundedRect(x, y, width, height, 8).lineWidth(2).stroke(accentColor + '40');
  // Accent line on left
  doc.roundedRect(x, y, 5, height, 8).fill(accentColor);
}

function drawInfoRow(doc, x, y, label, value) {
  doc.fontSize(9).fillColor('#6b7280').text(label + ':', x, y, { width: 200 });
  doc.fontSize(10).fillColor('#111827').text(value, x + 210, y, { width: 300 });
}

function drawStatBox(doc, x, y, width, label, value, color) {
  doc.roundedRect(x, y, width, 60, 8).fill(color + '15');
  doc.roundedRect(x, y, width, 60, 8).lineWidth(1.5).stroke(color + '40');
  doc.fontSize(24).fillColor(color).text(value.toString(), x, y + 12, { 
    align: 'center', 
    width: width 
  });
  doc.fontSize(9).fillColor('#6b7280').text(label, x, y + 42, { 
    align: 'center', 
    width: width 
  });
}

function drawMiniStatBox(doc, x, y, width, label, value, color) {
  doc.roundedRect(x, y, width, 40, 6).fill(color + '10');
  doc.fontSize(16).fillColor(color).text(value.toString(), x, y + 8, { 
    align: 'center', 
    width: width 
  });
  doc.fontSize(8).fillColor('#6b7280').text(label, x, y + 28, { 
    align: 'center', 
    width: width 
  });
}

// Get WHOIS info from VirusTotal
async function getWhoisInfo(req, res) {
  const { id } = req.params;
  const apiKey = vtKey();

  if (!apiKey) {
    return res.status(400).json({ success: false, message: 'VirusTotal API key tidak dikonfigurasi' });
  }

  try {
    // Get domain from database
    const [domains] = await pool.query('SELECT * FROM monitored_domains WHERE id = ?', [id]);
    if (domains.length === 0) {
      return res.status(404).json({ success: false, message: 'Domain tidak ditemukan' });
    }

    const domain = domains[0];

    // Fetch WHOIS data from VirusTotal
    const response = await axios.get(`${VT_BASE}/domains/${domain.domain}`, {
      headers: { 'x-apikey': apiKey },
      timeout: 15000,
    });

    if (!response.data || !response.data.data) {
      return res.status(404).json({ success: false, message: 'WHOIS data tidak ditemukan' });
    }

    const data = response.data.data.attributes;
    
    // Extract WHOIS information
    const whoisInfo = {
      domain: domain.domain,
      registrar: data.registrar || 'N/A',
      creation_date: data.creation_date ? new Date(data.creation_date * 1000).toISOString() : null,
      expiration_date: data.last_update_date ? new Date(data.last_update_date * 1000).toISOString() : null,
      updated_date: data.last_modification_date ? new Date(data.last_modification_date * 1000).toISOString() : null,
      registrant_name: data.whois?.Registrant?.Name || 'N/A',
      registrant_organization: data.whois?.Registrant?.Organization || 'N/A',
      registrant_email: data.whois?.Registrant?.Email || 'N/A',
      registrant_country: data.whois?.Registrant?.Country || 'N/A',
      admin_name: data.whois?.Admin?.Name || 'N/A',
      admin_email: data.whois?.Admin?.Email || 'N/A',
      tech_name: data.whois?.Tech?.Name || 'N/A',
      tech_email: data.whois?.Tech?.Email || 'N/A',
      name_servers: data.last_dns_records?.NS?.map(ns => ns.value) || [],
      status: data.whois?.status || [],
      dnssec: data.whois?.dnssec || 'N/A',
      categories: data.categories || {},
      reputation: data.reputation || 0,
      popularity_ranks: data.popularity_ranks || {},
      last_analysis_stats: data.last_analysis_stats || {},
      whois_raw: data.whois || null,
    };

    res.json({ success: true, whois: whoisInfo });
  } catch (err) {
    console.error('getWhoisInfo error:', err);
    if (err.response?.status === 404) {
      return res.status(404).json({ success: false, message: 'Domain tidak ditemukan di VirusTotal' });
    }
    res.status(500).json({ success: false, message: 'Gagal mengambil WHOIS info: ' + err.message });
  }
}

module.exports = {
  getDomains,
  addDomain,
  uploadDomains,
  updateDomain,
  deleteDomain,
  scanDomain,
  getScanHistory,
  generateReport,
  getWhoisInfo
};
