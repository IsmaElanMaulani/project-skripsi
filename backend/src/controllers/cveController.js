const axios = require('axios');
const { pool } = require('../config/database');

const PD_BASE = 'https://api.projectdiscovery.io/v1';

function pdHeaders() {
  return { 'X-API-Key': process.env.PROJECTDISCOVERY_API_KEY, 'Content-Type': 'application/json' };
}

// Fetch & simpan CVE terbaru dari ProjectDiscovery
async function fetchLatest(req, res) {
  try {
    const { severity, limit = 50, page = 1, tag } = req.query;

    const params = {
      limit: Math.min(parseInt(limit), 100),
      offset: (parseInt(page) - 1) * Math.min(parseInt(limit), 100),
      sortBy: 'created_at',
      sortOrder: 'desc',
    };
    if (severity) params.severity = severity;
    if (tag) params.tag = tag;

    const response = await axios.get(`${PD_BASE}/template/public`, {
      headers: pdHeaders(),
      params,
      timeout: 15000,
    });

    const templates = response.data.results || [];
    const total = response.data.total || 0;

    // Filter hanya yang punya CVE/CWE
    const cveTemplates = templates.filter(t =>
      t.classification?.['cve-id']?.length > 0 ||
      t.classification?.['cwe-id']?.length > 0 ||
      t.tags?.some(tag => tag.toLowerCase().startsWith('cve-'))
    );

    // Simpan ke DB
    for (const t of cveTemplates) {
      const cveIds = t.classification?.['cve-id'] || [];
      const cweIds = t.classification?.['cwe-id'] || [];
      const cvssScore = t.classification?.['cvss-score'] || null;
      const epssScore = t.classification?.['epss-score'] || null;

      await pool.query(`
        INSERT INTO cve_entries
          (template_id, name, description, severity, cve_ids, cwe_ids, cvss_score, epss_score,
           cvss_metrics, vendor, product, tags, references_list, remediation, impact, raw_data, published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name=VALUES(name), description=VALUES(description), severity=VALUES(severity),
          cvss_score=VALUES(cvss_score), epss_score=VALUES(epss_score),
          remediation=VALUES(remediation), impact=VALUES(impact),
          raw_data=VALUES(raw_data), updated_at=NOW()
      `, [
        t.template_id || t.id,
        t.name,
        t.description || '',
        t.severity || 'unknown',
        JSON.stringify(cveIds),
        JSON.stringify(cweIds),
        cvssScore,
        epssScore,
        t.classification?.['cvss-metrics'] || null,
        t.vendor || null,
        t.product || null,
        JSON.stringify(t.tags || []),
        JSON.stringify(t.references || []),
        t.remediation || null,
        t.impact || null,
        JSON.stringify(t),
        t.created_at ? new Date(t.created_at).toISOString().slice(0, 19).replace('T', ' ') : null,
      ]);
    }

    res.json({
      success: true,
      message: `Berhasil fetch ${cveTemplates.length} CVE/CWE dari ${templates.length} template`,
      total,
      fetched: cveTemplates.length,
      data: cveTemplates.map(formatTemplate),
    });
  } catch (err) {
    console.error('PD fetch error:', err.response?.status, err.response?.data || err.message);
    if (err.response?.status === 401) return res.status(401).json({ success: false, message: 'ProjectDiscovery API key tidak valid' });
    res.status(500).json({ success: false, message: 'Gagal fetch CVE: ' + err.message });
  }
}

// Ambil dari DB lokal
async function getList(req, res) {
  const { page = 1, limit = 20, severity, search, sort = 'published_at' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const conditions = [];
    const params = [];

    if (severity && severity !== 'all') {
      conditions.push('severity = ?');
      params.push(severity);
    }
    if (search) {
      conditions.push('(name LIKE ? OR description LIKE ? OR cve_ids LIKE ? OR product LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const orderBy = sort === 'cvss' ? 'cvss_score DESC' : sort === 'epss' ? 'epss_score DESC' : 'published_at DESC';

    const [rows] = await pool.query(
      `SELECT * FROM cve_entries ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) as total FROM cve_entries ${where}`, params);

    // Stats
    const [stats] = await pool.query(`
      SELECT severity, COUNT(*) as count FROM cve_entries GROUP BY severity
    `);

    res.json({ success: true, data: rows, total, page: parseInt(page), limit: parseInt(limit), stats });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}

// Fetch early access (CVE terbaru belum release)
async function fetchEarly(req, res) {
  try {
    const response = await axios.get(`${PD_BASE}/template/early`, {
      headers: pdHeaders(),
      timeout: 15000,
    });

    const templates = response.data.results || [];
    res.json({
      success: true,
      data: templates.map(formatTemplate),
      total: templates.length,
    });
  } catch (err) {
    if (err.response?.status === 401) return res.status(401).json({ success: false, message: 'ProjectDiscovery API key tidak valid' });
    res.status(500).json({ success: false, message: 'Gagal fetch early CVE: ' + err.message });
  }
}

// Search CVE spesifik
async function searchCVE(req, res) {
  const { q } = req.query;
  if (!q) return res.status(400).json({ success: false, message: 'Query wajib diisi' });

  try {
    const response = await axios.get(`${PD_BASE}/template/public`, {
      headers: pdHeaders(),
      params: { tag: q, limit: 30 },
      timeout: 15000,
    });

    const results = (response.data.results || []).map(formatTemplate);
    res.json({ success: true, data: results, total: results.length });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal search: ' + err.message });
  }
}

function formatTemplate(t) {
  return {
    id: t.template_id || t.id,
    name: t.name,
    description: t.description,
    severity: t.severity,
    cve_ids: t.classification?.['cve-id'] || [],
    cwe_ids: t.classification?.['cwe-id'] || [],
    cvss_score: t.classification?.['cvss-score'],
    epss_score: t.classification?.['epss-score'],
    epss_percentile: t.classification?.['epss-percentile'],
    cvss_metrics: t.classification?.['cvss-metrics'],
    vendor: t.vendor,
    product: t.product,
    tags: t.tags || [],
    references: t.references || [],
    remediation: t.remediation,
    impact: t.impact,
    is_new: t.is_new,
    is_early: t.is_early,
    published_at: t.created_at,
    updated_at: t.updated_at,
  };
}

module.exports = { fetchLatest, getList, fetchEarly, searchCVE };
