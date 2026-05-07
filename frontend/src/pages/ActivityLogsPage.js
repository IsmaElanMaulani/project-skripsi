import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  ClockIcon, UserIcon, FunnelIcon, ArrowPathIcon,
  MagnifyingGlassIcon, DocumentArrowDownIcon, TrashIcon,
  ChartBarIcon, ComputerDesktopIcon, CheckCircleIcon,
  XCircleIcon, ShieldCheckIcon
} from '@heroicons/react/24/outline';

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({
    search: '',
    action: '',
    user_id: '',
    start_date: '',
    end_date: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [pagination.page]);

  async function fetchLogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...filters
      });

      const res = await api.get(`/activity-logs?${params}`);
      setLogs(res.data.logs || []);
      setPagination(res.data.pagination);
    } catch (err) {
      setMsg({ type: 'error', text: 'Gagal memuat activity logs' });
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats() {
    try {
      const res = await api.get('/activity-logs/stats');
      setStats(res.data.stats);
    } catch (err) {
      console.error('Failed to fetch stats');
    }
  }

  async function handleSearch(e) {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchLogs();
  }

  async function handleExport() {
    try {
      const params = new URLSearchParams(filters);
      const response = await api.get(`/activity-logs/export?${params}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `activity-logs-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setMsg({ type: 'success', text: 'Logs berhasil diexport' });
    } catch (err) {
      setMsg({ type: 'error', text: 'Gagal export logs' });
    }
  }

  async function handleCleanup() {
    if (!window.confirm('Hapus log yang lebih dari 90 hari? Tindakan ini tidak dapat dibatalkan.')) return;

    try {
      const res = await api.post('/activity-logs/cleanup', { days: 90 });
      setMsg({ type: 'success', text: res.data.message });
      fetchLogs();
      fetchStats();
    } catch (err) {
      setMsg({ type: 'error', text: 'Gagal cleanup logs' });
    }
  }

  function getActionIcon(action) {
    if (action.includes('LOGIN')) return <UserIcon className="w-4 h-4" />;
    if (action.includes('LOGOUT')) return <UserIcon className="w-4 h-4" />;
    if (action.includes('CREATE')) return <CheckCircleIcon className="w-4 h-4" />;
    if (action.includes('UPDATE')) return <ArrowPathIcon className="w-4 h-4" />;
    if (action.includes('DELETE')) return <TrashIcon className="w-4 h-4" />;
    if (action.includes('SCAN')) return <ShieldCheckIcon className="w-4 h-4" />;
    return <ClockIcon className="w-4 h-4" />;
  }

  function getActionColor(action) {
    if (action.includes('LOGIN_FAILED')) return 'text-red-400 bg-red-900 bg-opacity-20 border-red-700';
    if (action.includes('LOGIN')) return 'text-green-400 bg-green-900 bg-opacity-20 border-green-700';
    if (action.includes('LOGOUT')) return 'text-gray-400 bg-gray-800 border-gray-700';
    if (action.includes('DELETE')) return 'text-red-400 bg-red-900 bg-opacity-20 border-red-700';
    if (action.includes('CREATE')) return 'text-blue-400 bg-blue-900 bg-opacity-20 border-blue-700';
    if (action.includes('UPDATE')) return 'text-yellow-400 bg-yellow-900 bg-opacity-20 border-yellow-700';
    return 'text-gray-400 bg-gray-800 border-gray-700';
  }

  if (loading && logs.length === 0) {
    return <div className="text-center py-12 text-gray-500">Memuat data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <ClockIcon className="w-6 h-6 text-cyber-accent" /> Activity Logs
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Monitor semua aktivitas user di sistem</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowFilters(!showFilters)} className="cyber-btn-ghost flex items-center gap-2 text-sm">
            <FunnelIcon className="w-4 h-4" /> Filter
          </button>
          <button onClick={handleExport} className="cyber-btn-ghost flex items-center gap-2 text-sm">
            <DocumentArrowDownIcon className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={handleCleanup} className="cyber-btn-ghost flex items-center gap-2 text-sm text-red-400 hover:text-red-300">
            <TrashIcon className="w-4 h-4" /> Cleanup
          </button>
          <button onClick={fetchLogs} className="cyber-btn-primary flex items-center gap-2 text-sm">
            <ArrowPathIcon className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Total Activities" value={stats.total} icon={ClockIcon} color="text-cyber-accent" />
          <StatCard label="Last 24 Hours" value={stats.recent} icon={ChartBarIcon} color="text-green-400" />
          <StatCard label="Unique Users" value={stats.byUser.length} icon={UserIcon} color="text-blue-400" />
          <StatCard label="Action Types" value={stats.byAction.length} icon={ShieldCheckIcon} color="text-purple-400" />
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="cyber-card p-5">
          <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">Search</label>
              <input
                type="text"
                className="cyber-input w-full"
                placeholder="Username, action, description..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-2">Start Date</label>
              <input
                type="datetime-local"
                className="cyber-input w-full"
                value={filters.start_date}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-2">End Date</label>
              <input
                type="datetime-local"
                className="cyber-input w-full"
                value={filters.end_date}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
              />
            </div>
            <div className="md:col-span-3 flex gap-3">
              <button type="submit" className="cyber-btn-primary flex items-center gap-2">
                <MagnifyingGlassIcon className="w-4 h-4" /> Apply Filters
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilters({ search: '', action: '', user_id: '', start_date: '', end_date: '' });
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className="cyber-btn-ghost"
              >
                Reset
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Message */}
      {msg && (
        <div className={`text-sm px-4 py-3 rounded-lg ${msg.type === 'success' ? 'bg-green-900 bg-opacity-30 text-green-400 border border-green-700 border-opacity-40' : 'bg-red-900 bg-opacity-30 text-red-400 border border-red-700 border-opacity-40'}`}>
          {msg.text}
        </div>
      )}

      {/* Logs Table */}
      <div className="cyber-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-cyber-border">
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Time</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">User</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Action</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Description</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-12 text-gray-500">
                    <ClockIcon className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                    <p>Belum ada activity logs</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-cyber-border border-opacity-50 hover:bg-cyber-border hover:bg-opacity-20 transition-colors">
                    <td className="px-5 py-4 text-sm text-gray-400">
                      <div className="flex items-center gap-2">
                        <ClockIcon className="w-4 h-4" />
                        {new Date(log.created_at).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyber-accent to-blue-500 flex items-center justify-center text-white font-semibold text-xs">
                          {log.username?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="text-sm text-white font-medium">{log.username || 'Unknown'}</div>
                          <div className="text-xs text-gray-500">ID: {log.user_id || 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${getActionColor(log.action)}`}>
                        {getActionIcon(log.action)}
                        {log.action}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-300 max-w-md">
                      {log.description || '-'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <ComputerDesktopIcon className="w-4 h-4" />
                        <span className="font-mono text-xs">{log.ip_address}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-cyber-border">
            <div className="text-sm text-gray-500">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} logs
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="cyber-btn-ghost text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
                  const pageNum = i + 1;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                      className={`px-3 py-1 rounded text-sm ${pagination.page === pageNum ? 'bg-cyber-accent text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page === pagination.totalPages}
                className="cyber-btn-ghost text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Top Actions */}
      {stats && stats.byAction.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="cyber-card p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <ChartBarIcon className="w-5 h-5 text-cyber-accent" />
              Top Actions
            </h3>
            <div className="space-y-2">
              {stats.byAction.slice(0, 5).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">{item.action}</span>
                  <span className="text-sm font-semibold text-cyber-accent">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="cyber-card p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-blue-400" />
              Most Active Users
            </h3>
            <div className="space-y-2">
              {stats.byUser.slice(0, 5).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">{item.username}</span>
                  <span className="text-sm font-semibold text-blue-400">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="cyber-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className={`text-2xl font-bold ${color}`}>{value}</div>
          <div className="text-xs text-gray-500 mt-1">{label}</div>
        </div>
        <Icon className={`w-8 h-8 ${color} opacity-50`} />
      </div>
    </div>
  );
}
