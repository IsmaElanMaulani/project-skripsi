import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  ExclamationTriangleIcon, ArrowPathIcon, MagnifyingGlassIcon,
  BoltIcon, ShieldExclamationIcon, ArrowTopRightOnSquareIcon,
  FunnelIcon, SparklesIcon,
} from '@heroicons/react/24/outline';

const SEVERITY_CFG = {
  critical: { label: 'Critical', cls: 'bg-red-900 text-red-300 border-red-700',     dot: 'bg-red-500',    bar: 'bg-red-500' },
  high:     { label: 'High',     cls: 'bg-orange-900 text-orange-300 border-orange-700', dot: 'bg-orange-500', bar: 'bg-orange-500' },
  medium:   { label: 'Medium',   cls: 'bg-yellow-900 text-yellow-300 border-yellow-700', dot: 'bg-yellow-500', bar: 'bg-yellow-400' },
  low:      { label: 'Low',      cls: 'bg-blue-900 text-blue-300 border-blue-700',   dot: 'bg-blue-500',   bar: 'bg-blue-500' },
  info:     { label: 'Info',     cls: 'bg-gray-800 text-gray-400 border-gray-700',   dot: 'bg-gray-500',   bar: 'bg-gray-500' },
  unknown:  { label: 'Unknown',  cls: 'bg-gray-800 text-gray-500 border-gray-700',   dot: 'bg-gray-600',   bar: 'bg-gray-600' },
};

export default function CVEPage() {
  const [cves, setCves] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState(null);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [severity, setSeverity] = useState('all');
  const [sort, setSort] = useState('published_at');
  const [selected, setSelected] = useState(null);
  const [earlyList, setEarlyList] = useState([]);
  const [showEarly, setShowEarly] = useState(false);
  const [loadingEarly, setLoadingEarly] = useState(false);
  const limit = 15;

  useEffect(() => { loadList(); }, [page, severity, search, sort]);

  async function loadList() {
    setLoading(true);
    try {
      const res = await api.get('/cve/list', { params: { page, limit, severity, search, sort } });
      setCves(res.data.data || []);
      setTotal(res.data.total || 0);
      setStats(res.data.stats || []);
    } catch {}
    finally { setLoading(false); }
  }

  async function handleFetch() {
    setFetching(true);
    setFetchMsg(null);
    try {
      const res = await api.post('/cve/fetch', {}, { params: { limit: 100, severity: severity !== 'all' ? severity : undefined } });
      setFetchMsg({ type: 'success', text: res.data.message });
      loadList();
    } catch (err) {
      setFetchMsg({ type: 'error', text: err.response?.data?.message || 'Gagal fetch CVE' });
    } finally {
      setFetching(false);
    }
  }

  async function handleFetchEarly() {
    setLoadingEarly(true);
    try {
      const res = await api.get('/cve/early');
      setEarlyList(res.data.data || []);
      setShowEarly(true);
    } catch (err) {
      setFetchMsg({ type: 'error', text: err.response?.data?.message || 'Gagal fetch early CVE' });
    } finally {
      setLoadingEarly(false);
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  const totalPages = Math.ceil(total / limit);
  const statsMap = {};
  stats.forEach(s => statsMap[s.severity] = s.count);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldExclamationIcon className="w-6 h-6 text-cyber-accent" /> Newest Vulnerability
          </h1>
          <p className="text-gray-500 text-sm mt-0.5"></p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleFetchEarly} disabled={loadingEarly}
            className="cyber-btn border border-purple-600 text-purple-400 hover:bg-purple-900 hover:bg-opacity-20 flex items-center gap-2 text-xs disabled:opacity-50">
            <SparklesIcon className="w-4 h-4" />
            {loadingEarly ? 'Memuat...' : 'Early Access CVE'}
          </button>
          <button onClick={handleFetch} disabled={fetching}
            className="cyber-btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
            <ArrowPathIcon className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
            {fetching ? 'Mengambil...' : 'Update CVE Terbaru'}
          </button>
        </div>
      </div>

      {fetchMsg && (
        <div className={`px-4 py-3 rounded-lg text-sm border ${fetchMsg.type === 'success' ? 'bg-green-900 bg-opacity-20 text-green-400 border-green-700 border-opacity-40' : 'bg-red-900 bg-opacity-20 text-red-400 border-red-700 border-opacity-40'}`}>
          {fetchMsg.type === 'success' ? '✅' : '❌'} {fetchMsg.text}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {['critical','high','medium','low','info','unknown'].map(sev => {
          const cfg = SEVERITY_CFG[sev];
          return (
            <button key={sev} onClick={() => { setSeverity(sev === severity ? 'all' : sev); setPage(1); }}
              className={`cyber-card p-3 text-center transition-all border ${severity === sev ? cfg.cls + ' border' : 'border-cyber-border hover:border-gray-600'}`}>
              <div className={`text-xl font-bold ${severity === sev ? '' : 'text-white'}`}>{statsMap[sev] || 0}</div>
              <div className={`text-xs mt-0.5 ${severity === sev ? '' : 'text-gray-500'}`}>{cfg.label}</div>
            </button>
          );
        })}
      </div>

      {/* Search & Filter */}
      <div className="cyber-card p-4">
        <div className="flex flex-wrap gap-3">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-64">
            <input type="text" className="cyber-input flex-1" placeholder="Cari CVE ID, nama, produk..."
              value={searchInput} onChange={e => setSearchInput(e.target.value)} />
            <button type="submit" className="cyber-btn-primary flex items-center gap-1 px-3">
              <MagnifyingGlassIcon className="w-4 h-4" />
            </button>
          </form>
          <div className="flex items-center gap-2">
            <FunnelIcon className="w-4 h-4 text-gray-500" />
            <select className="cyber-input w-40" value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}>
              <option value="published_at">Terbaru</option>
              <option value="cvss">CVSS Score</option>
              <option value="epss">EPSS Score</option>
            </select>
          </div>
          {(search || severity !== 'all') && (
            <button onClick={() => { setSearch(''); setSearchInput(''); setSeverity('all'); setPage(1); }}
              className="cyber-btn-ghost text-xs">✕ Reset Filter</button>
          )}
        </div>
      </div>

      {/* Early Access Panel */}
      {showEarly && earlyList.length > 0 && (
        <div className="cyber-card p-5 border border-purple-700 border-opacity-50 bg-purple-900 bg-opacity-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-purple-300 flex items-center gap-2">
              <SparklesIcon className="w-4 h-4" /> Early Access CVE ({earlyList.length}) — Belum dirilis publik
            </h2>
            <button onClick={() => setShowEarly(false)} className="text-xs text-gray-500 hover:text-gray-300">✕ Tutup</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {earlyList.slice(0, 10).map((cve, i) => (
              <CVECard key={i} cve={cve} onClick={() => setSelected(cve)} early />
            ))}
          </div>
        </div>
      )}

      {/* CVE List */}
      <div className="cyber-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-300">
            {total > 0 ? `${total.toLocaleString('id-ID')} CVE/CWE ditemukan` : 'Database CVE'}
            {search && <span className="text-cyber-accent ml-2">· "{search}"</span>}
          </h2>
          <button onClick={loadList} className="text-xs text-cyber-accent hover:underline flex items-center gap-1">
            <ArrowPathIcon className="w-3 h-3" /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-500">
            <ArrowPathIcon className="w-8 h-8 mx-auto mb-3 animate-spin opacity-50" />
            Memuat data CVE...
          </div>
        ) : cves.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <ShieldExclamationIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Belum ada data CVE.</p>
            <p className="text-xs mt-1">Klik <span className="text-cyber-accent">"Update CVE Terbaru"</span> untuk mengambil data dari ProjectDiscovery.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {cves.map((cve, i) => (
                <CVECard key={i} cve={cve} onClick={() => setSelected(cve)} />
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-5 pt-4 border-t border-cyber-border">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="cyber-btn-ghost text-xs disabled:opacity-40">← Sebelumnya</button>
              <span className="text-xs text-gray-500">Halaman {page} / {totalPages || 1}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="cyber-btn-ghost text-xs disabled:opacity-40">Berikutnya →</button>
            </div>
          </>
        )}
      </div>

      {/* Detail Modal */}
      {selected && <CVEDetailModal cve={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ─── CVE Card ────────────────────────────────────────────────────────────────
function CVECard({ cve, onClick, early }) {
  const cfg = SEVERITY_CFG[cve.severity] || SEVERITY_CFG.unknown;
  const cveIds = parseJSON(cve.cve_ids) || cve.cve_ids || [];
  const cweIds = parseJSON(cve.cwe_ids) || cve.cwe_ids || [];
  const tags = parseJSON(cve.tags) || cve.tags || [];

  return (
    <div onClick={onClick}
      className={`border rounded-lg px-4 py-3 cursor-pointer transition-all hover:border-gray-500 hover:bg-cyber-border hover:bg-opacity-20
        ${early ? 'border-purple-700 border-opacity-40 bg-purple-900 bg-opacity-5' : 'border-cyber-border'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* CVE IDs */}
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {cveIds.slice(0, 3).map((id, i) => (
              <span key={i} className="text-xs font-mono font-bold text-cyber-accent bg-cyber-accent bg-opacity-10 px-2 py-0.5 rounded">
                {id}
              </span>
            ))}
            {cweIds.slice(0, 2).map((id, i) => (
              <span key={i} className="text-xs font-mono text-purple-400 bg-purple-900 bg-opacity-20 px-2 py-0.5 rounded">
                {id}
              </span>
            ))}
            {early && <span className="text-xs text-purple-300 bg-purple-900 bg-opacity-30 px-2 py-0.5 rounded border border-purple-700 border-opacity-40">⚡ Early</span>}
          </div>

          {/* Name */}
          <div className="text-sm text-gray-200 font-medium truncate">{cve.name || '—'}</div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-500">
            {cve.product && <span>📦 {cve.product}</span>}
            {cve.vendor && <span>🏢 {cve.vendor}</span>}
            {cve.cvss_score && (
              <span className={`font-bold ${cve.cvss_score >= 9 ? 'text-red-400' : cve.cvss_score >= 7 ? 'text-orange-400' : cve.cvss_score >= 4 ? 'text-yellow-400' : 'text-green-400'}`}>
                CVSS {cve.cvss_score}
              </span>
            )}
            {cve.epss_score && (
              <span className="text-purple-400">EPSS {(cve.epss_score * 100).toFixed(2)}%</span>
            )}
            {cve.published_at && (
              <span>{new Date(cve.published_at).toLocaleDateString('id-ID')}</span>
            )}
          </div>
        </div>

        {/* Severity badge */}
        <span className={`px-2 py-1 rounded text-xs font-bold border flex-shrink-0 ${cfg.cls}`}>
          {cfg.label}
        </span>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {tags.slice(0, 6).map((tag, i) => (
            <span key={i} className="text-xs text-gray-600 bg-cyber-bg px-1.5 py-0.5 rounded">#{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function CVEDetailModal({ cve, onClose }) {
  const cfg = SEVERITY_CFG[cve.severity] || SEVERITY_CFG.unknown;
  const cveIds = parseJSON(cve.cve_ids) || cve.cve_ids || [];
  const cweIds = parseJSON(cve.cwe_ids) || cve.cwe_ids || [];
  const refs = parseJSON(cve.references_list) || cve.references || [];
  const tags = parseJSON(cve.tags) || cve.tags || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="cyber-card w-full max-w-3xl my-8 border border-cyber-border">
        {/* Header */}
        <div className={`px-6 py-4 border-b border-cyber-border flex items-start justify-between gap-4`}>
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              {cveIds.map((id, i) => (
                <span key={i} className="font-mono font-bold text-cyber-accent text-sm bg-cyber-accent bg-opacity-10 px-2 py-0.5 rounded">{id}</span>
              ))}
              {cweIds.map((id, i) => (
                <span key={i} className="font-mono text-purple-400 text-sm bg-purple-900 bg-opacity-20 px-2 py-0.5 rounded">{id}</span>
              ))}
              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${cfg.cls}`}>{cfg.label}</span>
            </div>
            <h2 className="text-base font-bold text-white">{cve.name}</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl flex-shrink-0">✕</button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Score row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ScoreBox label="CVSS Score" value={cve.cvss_score ?? '—'}
              color={cve.cvss_score >= 9 ? 'text-red-400' : cve.cvss_score >= 7 ? 'text-orange-400' : cve.cvss_score >= 4 ? 'text-yellow-400' : 'text-green-400'} />
            <ScoreBox label="EPSS Score" value={cve.epss_score ? (cve.epss_score * 100).toFixed(2) + '%' : '—'} color="text-purple-400" />
            <ScoreBox label="Vendor" value={cve.vendor || '—'} color="text-gray-300" small />
            <ScoreBox label="Product" value={cve.product || '—'} color="text-gray-300" small />
          </div>

          {/* CVSS Metrics */}
          {cve.cvss_metrics && (
            <div>
              <div className="text-xs text-gray-500 mb-1">CVSS Metrics</div>
              <code className="text-xs text-cyber-accent bg-cyber-bg px-3 py-2 rounded block break-all">{cve.cvss_metrics}</code>
            </div>
          )}

          {/* Description */}
          {cve.description && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Deskripsi</div>
              <p className="text-sm text-gray-300 leading-relaxed">{cve.description}</p>
            </div>
          )}

          {/* Impact */}
          {cve.impact && (
            <div className="bg-red-900 bg-opacity-10 border border-red-800 border-opacity-30 rounded-lg p-4">
              <div className="text-xs text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <ExclamationTriangleIcon className="w-3.5 h-3.5" /> Dampak
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{cve.impact}</p>
            </div>
          )}

          {/* Remediation */}
          {cve.remediation && (
            <div className="bg-green-900 bg-opacity-10 border border-green-800 border-opacity-30 rounded-lg p-4">
              <div className="text-xs text-green-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <BoltIcon className="w-3.5 h-3.5" /> Remediasi / Solusi
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{cve.remediation}</p>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Tags</div>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag, i) => (
                  <span key={i} className="text-xs text-gray-400 bg-cyber-bg border border-cyber-border px-2 py-0.5 rounded">#{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* References */}
          {refs.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Referensi</div>
              <div className="space-y-1">
                {refs.map((ref, i) => (
                  <a key={i} href={ref} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-cyber-accent hover:underline break-all">
                    <ArrowTopRightOnSquareIcon className="w-3 h-3 flex-shrink-0" />
                    {ref}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Published */}
          <div className="text-xs text-gray-600 pt-2 border-t border-cyber-border">
            Dipublikasikan: {cve.published_at ? new Date(cve.published_at).toLocaleString('id-ID') : '—'}
            {cve.updated_at && ` · Diupdate: ${new Date(cve.updated_at).toLocaleString('id-ID')}`}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreBox({ label, value, color, small }) {
  return (
    <div className="bg-cyber-bg rounded-lg p-3 text-center">
      <div className={`${small ? 'text-sm' : 'text-xl'} font-bold ${color} truncate`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function parseJSON(val) {
  if (!val) return null;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return null; }
}
