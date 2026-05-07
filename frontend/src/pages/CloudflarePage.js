import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { ArrowPathIcon, NoSymbolIcon, FunnelIcon, CloudIcon } from '@heroicons/react/24/outline';

export default function CloudflarePage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [blockIP, setBlockIP] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [blocking, setBlocking] = useState(false);
  const [blockMsg, setBlockMsg] = useState(null);
  const [cfError, setCfError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const limit = 20;

  useEffect(() => { fetchLogs(); }, [page]);

  async function fetchLogs() {
    setLoading(true);
    try {
      const res = await api.get('/cloudflare/logs', { params: { page, limit } });
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
      if (res.data.cfError) {
        setCfError(res.data.cfError);
      } else if (res.data.fetchedNow > 0) {
        setCfError(`✓ Berhasil fetch ${res.data.fetchedNow} events dari ${res.data.zonesCount} zones`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleBlock(e) {
    e.preventDefault();
    if (!blockIP) return;
    setBlocking(true);
    setBlockMsg(null);
    try {
      const res = await api.post('/cloudflare/block-ip', { ip_address: blockIP, reason: blockReason });
      setBlockMsg({ type: 'success', text: res.data.message });
      setBlockIP('');
      setBlockReason('');
    } catch (err) {
      setBlockMsg({ type: 'error', text: err.response?.data?.message || 'Gagal memblokir IP' });
    } finally {
      setBlocking(false);
    }
  }

  async function handleSyncDomains() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await api.post('/cloudflare/sync-domains');
      if (res.data.success) {
        setSyncMsg({ 
          type: 'success', 
          text: `✅ Berhasil import ${res.data.imported} domain/subdomain dari ${res.data.totalZones} zones Cloudflare! (${res.data.skipped} sudah ada sebelumnya)` 
        });
      } else {
        setSyncMsg({ type: 'error', text: res.data.message });
      }
    } catch (err) {
      setSyncMsg({ type: 'error', text: err.response?.data?.message || 'Gagal sync domains' });
    } finally {
      setSyncing(false);
    }
  }

  function handleQuickBlock(ip) {
    setBlockIP(ip);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <CloudIcon className="w-6 h-6 text-cyber-accent" /> Security Logs
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Log firewall dan security events</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSyncDomains} disabled={syncing} className="cyber-btn-ghost flex items-center gap-2">
            <CloudIcon className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Domains'}
          </button>
          <button onClick={fetchLogs} disabled={loading} className="cyber-btn-ghost flex items-center gap-2">
            <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Fetch Logs
          </button>
        </div>
      </div>

      {cfError && (
        <div className={`${cfError.startsWith('✓') ? 'bg-green-900 bg-opacity-30 border-green-600' : cfError.includes('route') || cfError.includes('404') ? 'bg-red-900 bg-opacity-30 border-red-600' : 'bg-yellow-900 bg-opacity-30 border-yellow-600'} border border-opacity-40 rounded-lg px-4 py-3 text-sm`}>
          <div className="flex items-start gap-3">
            <div className={`${cfError.startsWith('✓') ? 'text-green-400' : cfError.includes('route') || cfError.includes('404') ? 'text-red-400' : 'text-yellow-400'} text-xl`}>
              {cfError.startsWith('✓') ? '✓' : cfError.includes('route') || cfError.includes('404') ? '✗' : '⚠'}
            </div>
            <div className="flex-1">
              <div className={`${cfError.startsWith('✓') ? 'text-green-400' : cfError.includes('route') || cfError.includes('404') ? 'text-red-400' : 'text-yellow-400'} font-semibold mb-1`}>
                {cfError.startsWith('✓') ? 'Fetch Berhasil' : cfError.includes('route') || cfError.includes('404') ? 'Security Events API Tidak Tersedia' : 'Cloudflare API Error'}
              </div>
              <div className={`${cfError.startsWith('✓') ? 'text-green-300' : cfError.includes('route') || cfError.includes('404') ? 'text-red-300' : 'text-yellow-300'} text-xs mb-2`}>{cfError}</div>
              
              {/* Plan requirement warning */}
              {(cfError.includes('route') || cfError.includes('404') || cfError.includes('invalid')) && !cfError.includes('belum dikonfigurasi') && (
                <div className="bg-red-950 bg-opacity-50 rounded p-3 mt-2">
                  <div className="text-red-200 text-xs font-semibold mb-2">🔒 Security Events API Requirements:</div>
                  <div className="text-red-300 text-xs mb-3">
                    <strong>Security Events API</strong> hanya tersedia untuk domain dengan <strong>Cloudflare Business</strong> atau <strong>Enterprise plan</strong>.
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      <span className="text-red-400">❌</span>
                      <div className="text-red-300">
                        <strong>Free Plan / Pro Plan:</strong> Security Events API tidak tersedia
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-400">✅</span>
                      <div className="text-green-300">
                        <strong>Business Plan ($200/bulan):</strong> Full access ke Security Events API
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-400">✅</span>
                      <div className="text-green-300">
                        <strong>Enterprise Plan:</strong> Full access + Advanced features
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 p-2 bg-blue-900 bg-opacity-30 rounded border border-blue-700 border-opacity-40">
                    <div className="text-blue-300 text-xs">
                      <strong>💡 Alternatif:</strong> Klik tombol <strong>"Sync Domains"</strong> di atas untuk import semua domain & subdomain dari Cloudflare ke <strong>Domain Monitoring</strong>, lalu scan dengan VirusTotal!
                    </div>
                  </div>
                  <div className="mt-2">
                    <a href="https://www.cloudflare.com/plans/" target="_blank" rel="noopener noreferrer" 
                       className="text-xs text-blue-400 hover:text-blue-300 underline">
                      📋 Lihat Cloudflare Plans & Pricing
                    </a>
                  </div>
                </div>
              )}

              {/* Setup instructions */}
              {!cfError.startsWith('✓') && (cfError.includes('belum dikonfigurasi') || (cfError.includes('invalid') && !cfError.includes('route'))) && (
                <div className="bg-yellow-950 bg-opacity-50 rounded p-3 mt-2">
                  <div className="text-yellow-200 text-xs font-semibold mb-2">📖 Cara Setup Cloudflare API:</div>
                  <ol className="list-decimal list-inside space-y-1 text-yellow-300 text-xs">
                    <li>Buka <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-yellow-200">Cloudflare Dashboard</a></li>
                    <li>Pergi ke <strong>My Profile → API Tokens</strong></li>
                    <li>Create Token dengan permission <strong>Analytics:Read</strong> untuk semua zones</li>
                    <li>Copy <strong>Account ID</strong> dari URL dashboard</li>
                    <li>Paste API Token dan Account ID ke <a href="/settings" className="underline hover:text-yellow-200">Settings</a></li>
                    <li>Klik "Test Koneksi Cloudflare" untuk verify</li>
                  </ol>
                  <div className="mt-2 p-2 bg-blue-900 bg-opacity-30 rounded border border-blue-700 border-opacity-40">
                    <div className="text-blue-300 text-xs">
                      <strong>💡 Tips:</strong> Dengan Account ID, sistem akan fetch logs dari <strong>SEMUA zones</strong> dalam akun Anda secara otomatis!
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {syncMsg && (
        <div className={`${syncMsg.type === 'success' ? 'bg-green-900 bg-opacity-30 border-green-600' : 'bg-red-900 bg-opacity-30 border-red-600'} border border-opacity-40 rounded-lg px-4 py-3 text-sm`}>
          <div className="flex items-start gap-3">
            <div className={`${syncMsg.type === 'success' ? 'text-green-400' : 'text-red-400'} text-xl`}>
              {syncMsg.type === 'success' ? '✓' : '✗'}
            </div>
            <div className="flex-1">
              <div className={`${syncMsg.type === 'success' ? 'text-green-400' : 'text-red-400'} font-semibold mb-1`}>
                {syncMsg.type === 'success' ? 'Sync Berhasil!' : 'Sync Gagal'}
              </div>
              <div className={`${syncMsg.type === 'success' ? 'text-green-300' : 'text-red-300'} text-xs mb-2`}>{syncMsg.text}</div>
              {syncMsg.type === 'success' && (
                <div className="mt-2">
                  <a href="/domain-monitoring" className="cyber-btn-primary text-xs inline-flex items-center gap-2">
                    📊 Lihat di Domain Monitoring →
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="cyber-card p-5">
        <h2 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
          <NoSymbolIcon className="w-4 h-4 text-cyber-red" /> Blokir IP Address
        </h2>
        <form onSubmit={handleBlock} className="flex flex-wrap gap-3">
          <input type="text" className="cyber-input flex-1 min-w-48" placeholder="IP Address (contoh: 1.2.3.4)"
            value={blockIP} onChange={(e) => setBlockIP(e.target.value)} required />
          <input type="text" className="cyber-input flex-1 min-w-48" placeholder="Alasan (opsional)"
            value={blockReason} onChange={(e) => setBlockReason(e.target.value)} />
          <button type="submit" disabled={blocking} className="cyber-btn-danger flex items-center gap-2 whitespace-nowrap">
            <NoSymbolIcon className="w-4 h-4" />
            {blocking ? 'Memblokir...' : 'Blokir IP'}
          </button>
        </form>
        {blockMsg && (
          <div className={`mt-3 text-sm px-3 py-2 rounded-lg ${blockMsg.type === 'success' ? 'bg-green-900 bg-opacity-30 text-green-400' : 'bg-red-900 bg-opacity-30 text-red-400'}`}>
            {blockMsg.text}
          </div>
        )}
      </div>

      <div className="cyber-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-300">Security Events ({total} total)</h2>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <FunnelIcon className="w-4 h-4" />
            Halaman {page} / {totalPages || 1}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Memuat logs...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <CloudIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Belum ada log. Klik "Fetch Logs" untuk mengambil data security events.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase border-b border-cyber-border">
                    <th className="text-left pb-3 pr-3">IP Address</th>
                    <th className="text-left pb-3 pr-3">Negara</th>
                    <th className="text-left pb-3 pr-3">Rule ID</th>
                    <th className="text-left pb-3 pr-3">Action</th>
                    <th className="text-left pb-3 pr-3">Severity</th>
                    <th className="text-left pb-3 pr-3">Waktu</th>
                    <th className="text-left pb-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="table-row-hover border-b border-cyber-border border-opacity-30">
                      <td className="py-3 pr-3 font-mono text-cyber-accent text-xs">{log.ip_address || '—'}</td>
                      <td className="py-3 pr-3 text-gray-400 text-xs">{log.country_code || '—'}</td>
                      <td className="py-3 pr-3 text-gray-500 text-xs max-w-32 truncate" title={log.rule_id}>{log.rule_id || '—'}</td>
                      <td className="py-3 pr-3"><ActionBadge action={log.action} /></td>
                      <td className="py-3 pr-3"><SeverityBadge severity={log.severity} /></td>
                      <td className="py-3 pr-3 text-gray-500 text-xs whitespace-nowrap">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString('id-ID') : '—'}
                      </td>
                      <td className="py-3">
                        {log.ip_address && (
                          <button onClick={() => handleQuickBlock(log.ip_address)}
                            className="text-xs text-cyber-red hover:underline flex items-center gap-1">
                            <NoSymbolIcon className="w-3 h-3" /> Blokir
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-cyber-border">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="cyber-btn-ghost text-xs disabled:opacity-40">← Sebelumnya</button>
              <span className="text-xs text-gray-500">Halaman {page} dari {totalPages || 1}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="cyber-btn-ghost text-xs disabled:opacity-40">Berikutnya →</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ActionBadge({ action }) {
  const map = { block: 'bg-red-900 text-red-300', challenge: 'bg-yellow-900 text-yellow-300', js_challenge: 'bg-orange-900 text-orange-300', managed_challenge: 'bg-orange-900 text-orange-300', allow: 'bg-green-900 text-green-300', log: 'bg-gray-800 text-gray-400' };
  return <span className={`px-2 py-0.5 rounded text-xs ${map[action] || 'bg-gray-800 text-gray-400'}`}>{action || '—'}</span>;
}

function SeverityBadge({ severity }) {
  const map = { low: 'bg-green-900 text-green-300', medium: 'bg-yellow-900 text-yellow-300', high: 'bg-orange-900 text-orange-300', critical: 'bg-red-900 text-red-300' };
  return <span className={`px-2 py-0.5 rounded text-xs ${map[severity] || 'bg-gray-800 text-gray-400'}`}>{severity || '—'}</span>;
}
