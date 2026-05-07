import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { GlobeAltIcon, MagnifyingGlassIcon, ArrowPathIcon, NoSymbolIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline';

const COLOR_MAP = {
  red: 'bg-red-900 bg-opacity-30 border-red-700 text-red-300',
  orange: 'bg-orange-900 bg-opacity-30 border-orange-700 text-orange-300',
  yellow: 'bg-yellow-900 bg-opacity-30 border-yellow-700 text-yellow-300',
  gray: 'bg-gray-800 border-gray-700 text-gray-400',
};

export default function IPCheckPage() {
  const [ip, setIp] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [histPage, setHistPage] = useState(1);
  const [histTotal, setHistTotal] = useState(0);
  const [blocking, setBlocking] = useState(false);
  const [blockMsg, setBlockMsg] = useState(null);
  const [showReports, setShowReports] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => { fetchHistory(); }, [histPage]);

  async function fetchHistory() {
    try {
      const res = await api.get('/ip/history', { params: { page: histPage, limit: 15 } });
      setHistory(res.data.data || []);
      setHistTotal(res.data.total || 0);
    } catch { }
  }

  async function handleCheck(e) {
    e.preventDefault();
    if (!ip.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    setBlockMsg(null);
    setShowReports(false);
    try {
      const res = await api.post('/ip/check', { ip_address: ip.trim() });
      setResult(res.data.data);
      fetchHistory();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengecek IP');
    } finally {
      setLoading(false);
    }
  }

  async function handleBlock(ipAddr) {
    setBlocking(true);
    setBlockMsg(null);
    try {
      const res = await api.post('/cloudflare/block-ip', { ip_address: ipAddr, reason: 'Blocked from IP Threat Check' });
      setBlockMsg({ type: 'success', text: res.data.message });
    } catch (err) {
      setBlockMsg({ type: 'error', text: err.response?.data?.message || 'Gagal memblokir' });
    } finally {
      setBlocking(false);
    }
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!window.confirm('Hapus riwayat pengecekan IP ini?')) return;
    setDeleting(id);
    try {
      await api.delete(`/ip/history/${id}`);
      fetchHistory();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menghapus');
    } finally {
      setDeleting(null);
    }
  }

  const statusConfig = {
    safe: { label: 'AMAN', color: 'text-cyber-green', border: 'border-green-700', bar: 'bg-cyber-green', bg: 'bg-green-900 bg-opacity-10' },
    suspicious: { label: 'MENCURIGAKAN', color: 'text-cyber-yellow', border: 'border-yellow-700', bar: 'bg-cyber-yellow', bg: 'bg-yellow-900 bg-opacity-10' },
    dangerous: { label: 'BERBAHAYA', color: 'text-cyber-red', border: 'border-red-700', bar: 'bg-cyber-red', bg: 'bg-red-900 bg-opacity-10' },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <GlobeAltIcon className="w-6 h-6 text-cyber-accent" /> IP Threat Check
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">Cek reputasi & kategori serangan IP</p>
      </div>

      {/* Search */}
      <div className="cyber-card p-5">
        <form onSubmit={handleCheck} className="flex gap-3">
          <input type="text" className="cyber-input flex-1" placeholder="Masukkan IP address (contoh: 45.148.10.147)"
            value={ip} onChange={(e) => setIp(e.target.value)} required />
          <button type="submit" disabled={loading} className="cyber-btn-primary flex items-center gap-2 whitespace-nowrap">
            <MagnifyingGlassIcon className="w-4 h-4" />
            {loading ? 'Mengecek...' : 'Cek IP'}
          </button>
        </form>
        {error && <div className="mt-3 text-sm px-3 py-2 rounded-lg bg-red-900 bg-opacity-30 text-red-400">{error}</div>}
      </div>

      {/* Result */}
      {result && (() => {
        const cfg = statusConfig[result.status] || statusConfig.safe;
        return (
          <div className={`cyber-card p-6 border ${cfg.border} ${cfg.bg} space-y-5`}>

            {/* Top row */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-2xl font-bold font-mono text-white">{result.ip_address}</div>
                <div className={`text-sm font-bold mt-1 ${cfg.color}`}>● {cfg.label}</div>
              </div>
              <button onClick={() => handleBlock(result.ip_address)} disabled={blocking}
                className="cyber-btn-danger flex items-center gap-2 text-xs flex-shrink-0">
                <NoSymbolIcon className="w-4 h-4" />
                {blocking ? 'Memblokir...' : 'Blokir IP'}
              </button>
            </div>

            {blockMsg && (
              <div className={`text-sm px-3 py-2 rounded-lg ${blockMsg.type === 'success' ? 'bg-green-900 bg-opacity-30 text-green-400' : 'bg-red-900 bg-opacity-30 text-red-400'}`}>
                {blockMsg.text}
              </div>
            )}

            {/* Score bar */}
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Abuse Confidence Score</span>
                <span className={`font-bold ${cfg.color}`}>{result.abuse_confidence_score}%</span>
              </div>
              <div className="h-2.5 bg-cyber-border rounded-full overflow-hidden">
                <div className={`h-full ${cfg.bar} transition-all duration-700`} style={{ width: `${result.abuse_confidence_score}%` }} />
              </div>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <InfoItem label="Negara" value={result.country_code || '—'} />
              <InfoItem label="ISP" value={result.isp || '—'} />
              <InfoItem label="Domain" value={result.domain || '—'} />
              <InfoItem label="Total Laporan" value={result.total_reports?.toLocaleString('id-ID') ?? '—'} />
              <InfoItem label="Terakhir Dilaporkan" value={result.last_reported_at ? new Date(result.last_reported_at).toLocaleDateString('id-ID') : '—'} />
              <InfoItem label="Tipe Penggunaan" value={result.usage_type || '—'} />
              <InfoItem label="IP Publik" value={result.is_public ? 'Ya' : 'Tidak'} />
              <InfoItem label="Tor Exit Node" value={result.is_tor ? 'Ya' : 'Tidak'} />
            </div>

            {/* Attack Categories */}
            {result.categories?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ShieldExclamationIcon className="w-4 h-4 text-cyber-red" />
                  <span className="text-sm font-bold text-gray-200">
                    Kategori Serangan ({result.categories.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.categories.map((cat) => (
                    <span key={cat.id}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${COLOR_MAP[cat.color] || COLOR_MAP.gray}`}>
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Reports */}
            {result.recent_reports?.length > 0 && (
              <div>
                <button onClick={() => setShowReports(!showReports)}
                  className="flex items-center gap-2 text-xs text-cyber-accent hover:underline mb-3">
                  {showReports ? '▲ Sembunyikan' : `▼ Tampilkan ${result.recent_reports.length} laporan terbaru`}
                </button>

                {showReports && (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {result.recent_reports.map((r, i) => (
                      <div key={i} className="bg-cyber-bg border border-cyber-border rounded-lg px-4 py-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex flex-wrap gap-1">
                            {r.categories.map((cat, j) => (
                              <span key={j} className="px-2 py-0.5 bg-red-900 bg-opacity-30 text-red-300 text-xs rounded border border-red-800 border-opacity-40">
                                {cat}
                              </span>
                            ))}
                          </div>
                          <div className="text-xs text-gray-500 flex-shrink-0 ml-2">
                            {r.countryCode} · {r.reportedAt ? new Date(r.reportedAt).toLocaleString('id-ID') : '—'}
                          </div>
                        </div>
                        {r.comment && (
                          <p className="text-xs text-gray-400 font-mono break-all leading-relaxed">
                            {r.comment.length > 200 ? r.comment.slice(0, 200) + '...' : r.comment}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* History */}
      <div className="cyber-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-300">Riwayat Pengecekan ({histTotal})</h2>
          <button onClick={fetchHistory} className="text-xs text-cyber-accent hover:underline flex items-center gap-1">
            <ArrowPathIcon className="w-3 h-3" /> Refresh
          </button>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-8 text-gray-600 text-sm">Belum ada riwayat pengecekan</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase border-b border-cyber-border">
                  <th className="text-left pb-3 pr-3">IP Address</th>
                  <th className="text-left pb-3 pr-3">Score</th>
                  <th className="text-left pb-3 pr-3">Negara</th>
                  <th className="text-left pb-3 pr-3">ISP</th>
                  <th className="text-left pb-3 pr-3">Laporan</th>
                  <th className="text-left pb-3 pr-3">Status</th>
                  <th className="text-left pb-3 pr-3">Waktu</th>
                  <th className="text-center pb-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="table-row-hover border-b border-cyber-border border-opacity-30"
                    onClick={() => setIp(h.ip_address)}>
                    <td className="py-3 pr-3 font-mono text-cyber-accent text-xs cursor-pointer">{h.ip_address}</td>
                    <td className="py-3 pr-3 cursor-pointer">
                      <span className={`font-bold text-xs ${h.abuse_confidence_score >= 80 ? 'text-cyber-red' : h.abuse_confidence_score >= 50 ? 'text-cyber-yellow' : 'text-cyber-green'}`}>
                        {h.abuse_confidence_score}%
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-gray-400 text-xs cursor-pointer">{h.country_code || '—'}</td>
                    <td className="py-3 pr-3 text-gray-400 text-xs max-w-32 truncate cursor-pointer">{h.isp || '—'}</td>
                    <td className="py-3 pr-3 text-gray-400 text-xs cursor-pointer">{h.total_reports?.toLocaleString('id-ID')}</td>
                    <td className="py-3 pr-3 cursor-pointer"><StatusBadge status={h.status} /></td>
                    <td className="py-3 pr-3 text-gray-500 text-xs cursor-pointer">{new Date(h.checked_at).toLocaleString('id-ID')}</td>
                    <td className="py-3 text-center">
                      <button onClick={(e) => handleDelete(h.id, e)} disabled={deleting === h.id}
                        className="cyber-btn-ghost text-xs px-2 py-1 text-red-400 hover:text-red-300 hover:bg-red-900 hover:bg-opacity-20 disabled:opacity-50"
                        title="Hapus">
                        {deleting === h.id ? '...' : '✕'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {histTotal > 15 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-cyber-border">
            <button onClick={() => setHistPage(p => Math.max(1, p - 1))} disabled={histPage === 1} className="cyber-btn-ghost text-xs disabled:opacity-40">← Sebelumnya</button>
            <span className="text-xs text-gray-500">Halaman {histPage}</span>
            <button onClick={() => setHistPage(p => p + 1)} disabled={history.length < 15} className="cyber-btn-ghost text-xs disabled:opacity-40">Berikutnya →</button>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className="text-sm text-gray-200 font-medium truncate">{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    safe: 'bg-green-900 text-green-300',
    suspicious: 'bg-yellow-900 text-yellow-300',
    dangerous: 'bg-red-900 text-red-300',
  };
  const labels = { safe: 'Aman', suspicious: 'Mencurigakan', dangerous: 'Berbahaya' };
  return <span className={`px-2 py-0.5 rounded text-xs ${map[status] || 'bg-gray-800 text-gray-400'}`}>{labels[status] || status}</span>;
}
