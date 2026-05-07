import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  ShieldExclamationIcon, GlobeAltIcon, BugAntIcon, NoSymbolIcon,
  ArrowPathIcon, ExclamationTriangleIcon, ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

const SEVERITY_COLORS = {
  low: '#00ff88', medium: '#ffcc00', high: '#ff8800', critical: '#ff3366',
  info: '#6b7280', unknown: '#374151',
};

const CVE_SEVERITY_CFG = {
  critical: { cls: 'bg-red-900 text-red-300 border-red-700', dot: 'bg-red-500' },
  high: { cls: 'bg-orange-900 text-orange-300 border-orange-700', dot: 'bg-orange-500' },
  medium: { cls: 'bg-yellow-900 text-yellow-300 border-yellow-700', dot: 'bg-yellow-400' },
  low: { cls: 'bg-blue-900 text-blue-300 border-blue-700', dot: 'bg-blue-500' },
  info: { cls: 'bg-gray-800 text-gray-400 border-gray-700', dot: 'bg-gray-500' },
  unknown: { cls: 'bg-gray-800 text-gray-500 border-gray-700', dot: 'bg-gray-600' },
};

function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className={`cyber-card p-5 border-l-4 ${color}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">{label}</div>
          <div className="text-3xl font-bold text-white">{value ?? '—'}</div>
          {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
        </div>
        <div className={`p-2 rounded-lg bg-opacity-10 ${color.replace('border-', 'bg-')}`}>
          <Icon className="w-6 h-6 text-gray-300" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [severityData, setSeverityData] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [latestCVE, setLatestCVE] = useState([]);
  const [cveSeverityDist, setCveSeverityDist] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStats(); }, []);

  async function fetchStats() {
    setLoading(true);
    try {
      const res = await api.get('/dashboard/stats');
      setStats(res.data.stats);
      setChartData(res.data.chartData || []);
      setSeverityData(res.data.severityData || []);
      setRecentLogs(res.data.recentLogs || []);
      setLatestCVE(res.data.latestCVE || []);
      setCveSeverityDist(res.data.cveSeverityDist || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const severityPie = severityData.map(s => ({
    name: s.severity?.toUpperCase(),
    value: s.count,
    color: SEVERITY_COLORS[s.severity] || '#888',
  }));

  const cvePie = cveSeverityDist.map(s => ({
    name: s.severity?.toUpperCase(),
    value: parseInt(s.count),
    color: { critical: '#ff3366', high: '#ff8800', medium: '#ffcc00', low: '#3b82f6', info: '#6b7280', unknown: '#374151' }[s.severity] || '#888',
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Ringkasan keamanan hari ini</p>
        </div>
        <button onClick={fetchStats} disabled={loading} className="cyber-btn-ghost flex items-center gap-2">
          <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stat Cards — Security */}
      <div>
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Aktivitas Keamanan Hari Ini</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard icon={ShieldExclamationIcon} label="Total Serangan" value={stats?.attacksToday} color="border-cyber-red" sub="Dari logs" />
          <StatCard icon={GlobeAltIcon} label="IP Berbahaya" value={stats?.dangerousIPs} color="border-orange-500" sub="IP reputation check" />
          <StatCard icon={BugAntIcon} label="Malware Ditemukan" value={stats?.malwareFound} color="border-cyber-yellow" sub="Hasil scan" />
          <StatCard icon={NoSymbolIcon} label="IP Diblokir" value={stats?.blockedIPs} color="border-cyber-green" sub={`Total blacklist: ${stats?.totalBlacklist ?? 0}`} />
        </div>
      </div>

      {/* Stat Cards — CVE */}
      <div>
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-3 flex items-center justify-between">
          <span>Vulnerability Intelligence (CVE/CWE)</span>
          <button onClick={() => navigate('/cve')} className="text-cyber-accent hover:underline text-xs normal-case flex items-center gap-1">
            Lihat semua <ArrowTopRightOnSquareIcon className="w-3 h-3" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard icon={ExclamationTriangleIcon} label="Total CVE/CWE" value={stats?.totalCVE} color="border-purple-500" sub="Di database lokal" />
          <StatCard icon={ExclamationTriangleIcon} label="Critical CVE" value={stats?.criticalCVE} color="border-red-600" sub="Severity critical" />
          <StatCard icon={ExclamationTriangleIcon} label="High CVE" value={stats?.highCVE} color="border-orange-500" sub="Severity high" />
          <StatCard icon={ExclamationTriangleIcon} label="CVE Baru (7 hari)" value={stats?.newCVE} color="border-cyan-500" sub="Dipublikasikan minggu ini" />
        </div>
      </div>

      {/* Global Threat Map */}
      <div className="cyber-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <GlobeAltIcon className="w-4 h-4 text-cyber-accent" />
              Global Cyber Attack Map - Real Time
            </h2>
            <p className="text-xs text-gray-500 mt-1">Live threat intelligence dari Check Point</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            <span className="text-xs text-red-400 font-medium">Live</span>
          </div>
        </div>
        <div className="relative rounded-xl overflow-hidden border border-cyber-border bg-black" style={{ height: '500px' }}>
          <iframe
            src="https://threatmap.checkpoint.com/ThreatPortal/livemap.html"
            className="w-full h-full"
            frameBorder="0"
            allowFullScreen
            title="Global Threat Map"
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
          <span>Powered by Check Point ThreatCloud</span>
          <a 
            href="https://threatmap.checkpoint.com/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-cyber-accent hover:underline flex items-center gap-1"
          >
            View Full Map <ArrowTopRightOnSquareIcon className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Attack chart */}
        <div className="xl:col-span-2 cyber-card p-5">
          <h2 className="text-sm font-medium text-gray-300 mb-4">Serangan 7 Hari Terakhir</h2>
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-600 text-sm">Belum ada data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: '8px', color: '#e5e7eb' }} />
                <Area type="monotone" dataKey="count" stroke="#00d4ff" fill="url(#colorCount)" strokeWidth={2} name="Serangan" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Severity pie */}
        <div className="cyber-card p-5">
          <h2 className="text-sm font-medium text-gray-300 mb-4">Distribusi Severity Serangan</h2>
          {severityPie.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-600 text-sm">Belum ada data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={severityPie} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                  {severityPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: '8px', color: '#e5e7eb' }} />
                <Legend formatter={v => <span style={{ color: '#9ca3af', fontSize: 11 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* CVE Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Latest CVE list */}
        <div className="xl:col-span-2 cyber-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <ExclamationTriangleIcon className="w-4 h-4 text-cyber-red" />
              CVE/CWE Terbaru
            </h2>
            <button onClick={() => navigate('/cve')} className="text-xs text-cyber-accent hover:underline flex items-center gap-1">
              Lihat semua <ArrowTopRightOnSquareIcon className="w-3 h-3" />
            </button>
          </div>

          {latestCVE.length === 0 ? (
            <div className="text-center py-8 text-gray-600 text-sm">
              <ExclamationTriangleIcon className="w-8 h-8 mx-auto mb-2 opacity-20" />
              Belum ada data CVE. Buka halaman CVE Intelligence dan klik "Update CVE Terbaru".
            </div>
          ) : (
            <div className="space-y-2">
              {latestCVE.map((cve, i) => {
                const cfg = CVE_SEVERITY_CFG[cve.severity] || CVE_SEVERITY_CFG.unknown;
                const cveIds = parseJSON(cve.cve_ids) || [];
                const cweIds = parseJSON(cve.cwe_ids) || [];
                return (
                  <div key={i} onClick={() => navigate('/cve')}
                    className="flex items-start gap-3 p-3 rounded-lg border border-cyber-border hover:border-gray-600 hover:bg-cyber-border hover:bg-opacity-20 cursor-pointer transition-all">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${cfg.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-1.5 mb-1">
                        {cveIds.slice(0, 2).map((id, j) => (
                          <span key={j} className="text-xs font-mono font-bold text-cyber-accent">{id}</span>
                        ))}
                        {cweIds.slice(0, 1).map((id, j) => (
                          <span key={j} className="text-xs font-mono text-purple-400">{id}</span>
                        ))}
                      </div>
                      <div className="text-xs text-gray-300 truncate">{cve.name}</div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                        {cve.product && <span>📦 {cve.product}</span>}
                        {cve.cvss_score && <span className="text-orange-400">CVSS {cve.cvss_score}</span>}
                        {cve.epss_score && <span className="text-purple-400">EPSS {(cve.epss_score * 100).toFixed(1)}%</span>}
                        {cve.published_at && <span>{new Date(cve.published_at).toLocaleDateString('id-ID')}</span>}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold border flex-shrink-0 ${cfg.cls}`}>
                      {cve.severity}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* CVE severity pie */}
        <div className="cyber-card p-5">
          <h2 className="text-sm font-medium text-gray-300 mb-4">Distribusi CVE per Severity</h2>
          {cvePie.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-600 text-sm">Belum ada data CVE</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={cvePie} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value">
                    {cvePie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: '8px', color: '#e5e7eb' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {cvePie.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                      <span className="text-gray-400 capitalize">{item.name}</span>
                    </div>
                    <span className="text-gray-300 font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Recent Security Logs */}
      <div className="cyber-card p-5">
        <h2 className="text-sm font-medium text-gray-300 mb-4">Log Keamanan Terbaru</h2>
        {recentLogs.length === 0 ? (
          <div className="text-center py-8 text-gray-600 text-sm">Belum ada log keamanan</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase border-b border-cyber-border">
                  <th className="text-left pb-3 pr-4">IP Address</th>
                  <th className="text-left pb-3 pr-4">Negara</th>
                  <th className="text-left pb-3 pr-4">Action</th>
                  <th className="text-left pb-3 pr-4">Severity</th>
                  <th className="text-left pb-3">Waktu</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log, i) => (
                  <tr key={i} className="table-row-hover border-b border-cyber-border border-opacity-50">
                    <td className="py-3 pr-4 font-mono text-cyber-accent">{log.ip_address || '—'}</td>
                    <td className="py-3 pr-4 text-gray-400">{log.country_code || '—'}</td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-0.5 rounded text-xs ${log.action === 'block' ? 'bg-red-900 text-red-300' : 'bg-yellow-900 text-yellow-300'}`}>
                        {log.action || '—'}
                      </span>
                    </td>
                    <td className="py-3 pr-4"><SeverityBadge severity={log.severity} /></td>
                    <td className="py-3 text-gray-500 text-xs">{log.timestamp ? new Date(log.timestamp).toLocaleString('id-ID') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SeverityBadge({ severity }) {
  const map = { low: 'bg-green-900 text-green-300', medium: 'bg-yellow-900 text-yellow-300', high: 'bg-orange-900 text-orange-300', critical: 'bg-red-900 text-red-300' };
  return <span className={`px-2 py-0.5 rounded text-xs ${map[severity] || 'bg-gray-800 text-gray-400'}`}>{severity || '—'}</span>;
}

function parseJSON(val) {
  if (!val) return [];
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return []; }
}
