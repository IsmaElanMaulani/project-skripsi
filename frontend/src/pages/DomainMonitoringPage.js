import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import {
  GlobeAltIcon, PlusIcon, ArrowUpTrayIcon, MagnifyingGlassIcon,
  CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon,
  TrashIcon, ClockIcon, ArrowPathIcon, DocumentTextIcon,
  ChartBarIcon, DocumentArrowDownIcon, InformationCircleIcon
} from '@heroicons/react/24/outline';

export default function DomainMonitoringPage() {
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showWhoisModal, setShowWhoisModal] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [whoisData, setWhoisData] = useState(null);
  const [loadingWhois, setLoadingWhois] = useState(false);
  const [scanHistory, setScanHistory] = useState([]);
  const [newDomain, setNewDomain] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState({});
  const [scanSubdomains, setScanSubdomains] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    fetchDomains();
  }, []);

  async function fetchDomains() {
    setLoading(true);
    try {
      const res = await api.get('/domains');
      setDomains(res.data.domains || []);
    } catch (err) {
      setMsg({ type: 'error', text: 'Gagal memuat data domain' });
    } finally {
      setLoading(false);
    }
  }

  async function handleAddDomain(e) {
    e.preventDefault();
    if (!newDomain.trim()) return;

    setSubmitting(true);
    setMsg(null);

    try {
      await api.post('/domains', { domain: newDomain.trim(), notes: notes.trim() || null });
      setMsg({ type: 'success', text: 'Domain berhasil ditambahkan' });
      setNewDomain('');
      setNotes('');
      setShowAddModal(false);
      fetchDomains();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Gagal menambahkan domain' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUploadFile(e) {
    e.preventDefault();
    if (!file) return;

    setSubmitting(true);
    setMsg(null);

    try {
      const form = new FormData();
      form.append('file', file);

      const res = await api.post('/domains/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setMsg({ type: 'success', text: res.data.message });
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      setShowUploadModal(false);
      fetchDomains();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Gagal upload file' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleScanDomain(id) {
    setScanning(prev => ({ ...prev, [id]: true }));
    setMsg(null);

    try {
      const res = await api.post(`/domains/${id}/scan`, { scan_subdomains: scanSubdomains });
      setMsg({ type: 'success', text: res.data.message });
      fetchDomains();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Gagal scan domain' });
    } finally {
      setScanning(prev => ({ ...prev, [id]: false }));
    }
  }

  async function handleDownloadReport(domainId, domainName) {
    try {
      const response = await api.get(`/domains/${domainId}/report`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `domain-report-${domainName}-${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setMsg({ type: 'success', text: 'Report berhasil didownload' });
    } catch (err) {
      setMsg({ type: 'error', text: 'Gagal download report' });
    }
  }

  async function handleSyncFromCloudflare() {
    setShowSyncModal(true);
  }

  async function confirmSyncFromCloudflare() {
    setShowSyncModal(false);
    setSyncing(true);
    setMsg(null);

    try {
      const res = await api.post('/cloudflare/sync-domains');
      if (res.data.success) {
        setMsg({ 
          type: 'success', 
          text: `${res.data.message}. Total zones: ${res.data.totalZones}, Imported: ${res.data.imported}, Skipped: ${res.data.skipped}` 
        });
        fetchDomains();
      } else {
        setMsg({ type: 'error', text: res.data.message });
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Gagal sync dari Cloudflare' });
    } finally {
      setSyncing(false);
    }
  }

  async function handleDeleteDomain(id) {
    if (!window.confirm('Yakin ingin menghapus domain ini?')) return;

    try {
      await api.delete(`/domains/${id}`);
      setMsg({ type: 'success', text: 'Domain berhasil dihapus' });
      fetchDomains();
    } catch (err) {
      setMsg({ type: 'error', text: 'Gagal menghapus domain' });
    }
  }

  async function handleToggleStatus(id, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await api.put(`/domains/${id}`, { status: newStatus });
      fetchDomains();
    } catch (err) {
      setMsg({ type: 'error', text: 'Gagal update status' });
    }
  }

  async function showHistory(domain) {
    setSelectedDomain(domain);
    setShowHistoryModal(true);
    try {
      const res = await api.get(`/domains/${domain.id}/history`);
      setScanHistory(res.data.history || []);
    } catch (err) {
      setScanHistory([]);
    }
  }

  async function showWhois(domain) {
    setSelectedDomain(domain);
    setShowWhoisModal(true);
    setLoadingWhois(true);
    setWhoisData(null);
    
    try {
      const res = await api.get(`/domains/${domain.id}/whois`);
      setWhoisData(res.data.whois);
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Gagal memuat WHOIS info' });
      setShowWhoisModal(false);
    } finally {
      setLoadingWhois(false);
    }
  }

  const stats = {
    total: domains.length,
    active: domains.filter(d => d.status === 'active').length,
    clean: domains.filter(d => d.last_scan_result === 'clean').length,
    threats: domains.filter(d => ['infected', 'suspicious'].includes(d.last_scan_result)).length,
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Memuat data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <GlobeAltIcon className="w-6 h-6 text-cyber-accent" /> Domain Monitoring
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Monitor domain dengan scan otomatis harian</p>
        </div>
        <div className="flex gap-2">
          <label 
            className="flex items-center gap-2 cursor-pointer bg-cyber-card px-3 py-2 rounded-lg border border-cyber-border hover:border-cyber-accent transition-colors group"
            onClick={() => setScanSubdomains(!scanSubdomains)}
            title={scanSubdomains ? "Saat scan domain, akan scan subdomain juga (dari VirusTotal)" : "Saat scan domain, hanya scan domain utama saja"}
          >
            <div className={`relative w-10 h-5 rounded-full transition-colors ${scanSubdomains ? 'bg-cyber-accent' : 'bg-cyber-border'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${scanSubdomains ? 'left-5' : 'left-0.5'}`} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">
                Scan Subdomain
              </span>
              <span className="text-xs text-gray-600">
                {scanSubdomains ? 'Akan scan subdomain dari VT' : 'Hanya scan domain utama'}
              </span>
            </div>
          </label>
          <button onClick={handleSyncFromCloudflare} disabled={syncing} className="cyber-btn-ghost flex items-center gap-2 text-sm">
            {syncing ? (
              <>
                <div className="w-4 h-4 border-2 border-cyber-accent border-t-transparent rounded-full animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <ArrowPathIcon className="w-4 h-4" /> Sync dari Cloudflare
              </>
            )}
          </button>
          <button onClick={() => setShowUploadModal(true)} className="cyber-btn-ghost flex items-center gap-2 text-sm">
            <ArrowUpTrayIcon className="w-4 h-4" /> Upload File
          </button>
          <button onClick={() => setShowAddModal(true)} className="cyber-btn-primary flex items-center gap-2 text-sm">
            <PlusIcon className="w-4 h-4" /> Tambah Domain
          </button>
        </div>
      </div>

      {/* Info Box - Penjelasan Subdomain */}
      {domains.some(d => d.notes?.includes('Cloudflare') || d.notes?.includes('Subdomain')) && (
        <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="bg-blue-500/20 rounded-lg p-2">
                <GlobeAltIcon className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-300 mb-1">
                ℹ️ Tentang Subdomain di List
              </h3>
              <div className="text-xs text-blue-400/80 space-y-1">
                <p>
                  <strong>Subdomain yang muncul di list</strong> adalah hasil <strong>import dari Cloudflare</strong> (DNS records). 
                  Mereka sudah tersimpan sebagai domain terpisah di database.
                </p>
                <p className="mt-2">
                  <strong>Toggle "Scan Subdomain"</strong> mengontrol: Saat Anda klik tombol <strong>"Scan"</strong> pada 1 domain, 
                  apakah sistem akan otomatis fetch & scan subdomain-nya dari VirusTotal juga?
                </p>
                <div className="mt-2 pt-2 border-t border-blue-700/30 flex gap-4">
                  <div>
                    <span className="text-green-400">✅ ON:</span> Scan domain + fetch subdomain dari VT
                  </div>
                  <div>
                    <span className="text-gray-400">❌ OFF:</span> Hanya scan domain yang diklik
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Domain" value={stats.total} icon={GlobeAltIcon} color="text-cyber-accent" />
        <StatCard label="Aktif" value={stats.active} icon={CheckCircleIcon} color="text-green-400" />
        <StatCard label="Bersih" value={stats.clean} icon={CheckCircleIcon} color="text-cyber-green" />
        <StatCard label="Terdeteksi Ancaman" value={stats.threats} icon={ExclamationTriangleIcon} color="text-red-400" />
      </div>

      {/* Message */}
      {msg && (
        <div className={`text-sm px-4 py-3 rounded-lg ${msg.type === 'success' ? 'bg-green-900 bg-opacity-30 text-green-400 border border-green-700 border-opacity-40' : 'bg-red-900 bg-opacity-30 text-red-400 border border-red-700 border-opacity-40'}`}>
          {msg.text}
        </div>
      )}

      {/* Domain List */}
      <div className="cyber-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-cyber-border">
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Domain</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Last Scan</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Result</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Scan Count</th>
                <th className="text-right px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {domains.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-gray-500">
                    <GlobeAltIcon className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                    <p>Belum ada domain yang dimonitor</p>
                    <button onClick={() => setShowAddModal(true)} className="cyber-btn-primary mt-4 text-sm">
                      <PlusIcon className="w-4 h-4 inline mr-2" /> Tambah Domain Pertama
                    </button>
                  </td>
                </tr>
              ) : (
                domains.map((domain) => (
                  <tr key={domain.id} className="border-b border-cyber-border border-opacity-50 hover:bg-cyber-border hover:bg-opacity-20 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-mono text-sm text-white">{domain.domain}</div>
                      {domain.notes && <div className="text-xs text-gray-500 mt-1">{domain.notes}</div>}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => handleToggleStatus(domain.id, domain.status)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${domain.status === 'active' ? 'bg-green-900 bg-opacity-30 text-green-400 border border-green-700 border-opacity-40' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}
                      >
                        {domain.status === 'active' ? '● Aktif' : '○ Nonaktif'}
                      </button>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-400">
                      {domain.last_scan_at ? (
                        <div className="flex items-center gap-2">
                          <ClockIcon className="w-4 h-4" />
                          {new Date(domain.last_scan_at).toLocaleString('id-ID', { 
                            day: '2-digit', 
                            month: 'short', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      ) : (
                        <span className="text-gray-600">Belum pernah</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {domain.last_scan_result ? (
                        <ResultBadge result={domain.last_scan_result} />
                      ) : (
                        <span className="text-gray-600 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-400">
                      {domain.scan_count || 0}x
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleScanDomain(domain.id)}
                          disabled={scanning[domain.id]}
                          className="cyber-btn-ghost text-xs flex items-center gap-1 disabled:opacity-50"
                          title="Scan sekarang"
                        >
                          {scanning[domain.id] ? (
                            <>
                              <div className="w-3 h-3 border-2 border-cyber-accent border-t-transparent rounded-full animate-spin" />
                              Scanning...
                            </>
                          ) : (
                            <>
                              <MagnifyingGlassIcon className="w-4 h-4" />
                              Scan
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => showHistory(domain)}
                          className="cyber-btn-ghost text-xs flex items-center gap-1"
                          title="Lihat riwayat"
                        >
                          <ChartBarIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => showWhois(domain)}
                          className="cyber-btn-ghost text-xs flex items-center gap-1"
                          title="WHOIS Info"
                        >
                          <InformationCircleIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadReport(domain.id, domain.domain)}
                          className="cyber-btn-ghost text-xs flex items-center gap-1"
                          title="Download PDF Report"
                        >
                          <DocumentArrowDownIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteDomain(domain.id)}
                          className="text-red-400 hover:text-red-300 p-2 hover:bg-red-900 hover:bg-opacity-20 rounded transition-colors"
                          title="Hapus"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Domain Modal */}
      {showAddModal && (
        <Modal title="Tambah Domain" onClose={() => setShowAddModal(false)}>
          <form onSubmit={handleAddDomain} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">Domain / URL</label>
              <input
                type="text"
                className="cyber-input w-full"
                placeholder="example.com atau https://example.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">Protokol (http/https) akan dihapus otomatis</p>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-2">Catatan (opsional)</label>
              <textarea
                className="cyber-input w-full"
                rows="3"
                placeholder="Catatan tentang domain ini..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowAddModal(false)} className="cyber-btn-ghost flex-1">
                Batal
              </button>
              <button type="submit" disabled={submitting || !newDomain.trim()} className="cyber-btn-primary flex-1 disabled:opacity-50">
                {submitting ? 'Menambahkan...' : 'Tambah Domain'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Upload File Modal */}
      {showUploadModal && (
        <Modal title="Upload Domain dari File" onClose={() => setShowUploadModal(false)}>
          <form onSubmit={handleUploadFile} className="space-y-4">
            <div>
              <div
                className="border-2 border-dashed border-cyber-border rounded-lg p-8 text-center cursor-pointer hover:border-cyber-accent transition-colors"
                onClick={() => !submitting && fileRef.current?.click()}
              >
                <DocumentTextIcon className="w-10 h-10 mx-auto mb-3 text-gray-500" />
                <p className="text-gray-400 text-sm mb-1">
                  {file ? file.name : 'Klik atau drag file ke sini'}
                </p>
                <p className="text-gray-600 text-xs">Format: TXT atau CSV (satu domain per baris)</p>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept=".txt,.csv"
                  onChange={(e) => setFile(e.target.files[0])}
                />
              </div>
            </div>
            <div className="bg-blue-900 bg-opacity-20 border border-blue-700 border-opacity-30 rounded-lg p-3">
              <div className="text-xs text-blue-300">
                <div className="font-semibold mb-1">📝 Format file:</div>
                <pre className="text-blue-400 font-mono text-xs mt-2 bg-cyber-bg p-2 rounded">
example.com{'\n'}https://another-domain.com{'\n'}test.org
                </pre>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowUploadModal(false)} className="cyber-btn-ghost flex-1">
                Batal
              </button>
              <button type="submit" disabled={submitting || !file} className="cyber-btn-primary flex-1 disabled:opacity-50">
                {submitting ? 'Mengupload...' : 'Upload & Tambahkan'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedDomain && (
        <Modal title={`Riwayat Scan: ${selectedDomain.domain}`} onClose={() => setShowHistoryModal(false)} large>
          <div className="space-y-3">
            {scanHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ChartBarIcon className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p>Belum ada riwayat scan</p>
              </div>
            ) : (
              scanHistory.map((scan) => {
                let scanDetails = null;
                try {
                  scanDetails = JSON.parse(scan.scan_details);
                } catch (e) {
                  // Ignore parse errors
                }

                return (
                  <div key={scan.id} className="cyber-card p-4 border border-cyber-border">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <ResultBadge result={scan.scan_result} />
                          <span className="text-xs text-gray-500">
                            {new Date(scan.scanned_at).toLocaleString('id-ID')}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                          <div className="bg-red-900 bg-opacity-20 border border-red-700 border-opacity-40 rounded px-3 py-2">
                            <div className="text-red-400 font-bold">{scan.malicious_count}</div>
                            <div className="text-xs text-gray-500">Malicious</div>
                          </div>
                          <div className="bg-yellow-900 bg-opacity-20 border border-yellow-700 border-opacity-40 rounded px-3 py-2">
                            <div className="text-yellow-400 font-bold">{scan.suspicious_count}</div>
                            <div className="text-xs text-gray-500">Suspicious</div>
                          </div>
                          <div className="bg-green-900 bg-opacity-20 border border-green-700 border-opacity-40 rounded px-3 py-2">
                            <div className="text-green-400 font-bold">{scan.clean_count}</div>
                            <div className="text-xs text-gray-500">Clean</div>
                          </div>
                        </div>

                        {/* Subdomain Results */}
                        {scanDetails?.subdomains && scanDetails.subdomains.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-cyber-border">
                            <div className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-2">
                              <GlobeAltIcon className="w-4 h-4" />
                              Subdomain Scanned ({scanDetails.subdomains.length})
                            </div>
                            <div className="space-y-2">
                              {scanDetails.subdomains.map((sub, idx) => (
                                <div key={idx} className="bg-cyber-bg rounded px-3 py-2 flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="text-xs font-mono text-gray-300">{sub.subdomain}</div>
                                    <div className="text-xs text-gray-600 mt-0.5">
                                      M: {sub.stats.malicious || 0} | S: {sub.stats.suspicious || 0} | C: {(sub.stats.harmless || 0) + (sub.stats.undetected || 0)}
                                    </div>
                                  </div>
                                  <ResultBadge result={sub.result} />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Modal>
      )}

      {/* Sync Confirmation Modal - Modern Design */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
          {/* Backdrop with blur */}
          <div 
            className="absolute inset-0 bg-black bg-opacity-60 backdrop-blur-sm"
            onClick={() => setShowSyncModal(false)}
          />
          
          {/* Modal Content */}
          <div className="relative bg-gradient-to-br from-cyber-card via-cyber-bg to-cyber-card border-2 border-cyber-accent rounded-2xl shadow-2xl max-w-md w-full animate-slideUp overflow-hidden">
            {/* Animated gradient background */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyber-accent/10 via-transparent to-purple-500/10 animate-pulse" />
            
            {/* Content */}
            <div className="relative p-6">
              {/* Icon with animation */}
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-cyber-accent rounded-full blur-xl opacity-50 animate-ping" />
                  <div className="relative bg-gradient-to-br from-cyber-accent to-purple-500 rounded-full p-4">
                    <ArrowPathIcon className="w-8 h-8 text-white animate-spin-slow" />
                  </div>
                </div>
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold text-center bg-gradient-to-r from-cyber-accent via-purple-400 to-cyber-accent bg-clip-text text-transparent mb-2">
                Sync dari Cloudflare
              </h3>

              {/* Description */}
              <p className="text-gray-400 text-sm text-center mb-6">
                Import semua domain dan subdomain dari akun Cloudflare Anda. Proses ini mungkin memakan waktu beberapa menit.
              </p>

              {/* Info Cards */}
              <div className="space-y-2 mb-6">
                <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3 flex items-start gap-3">
                  <CheckCircleIcon className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-blue-300">Auto-detect Zones</div>
                    <div className="text-xs text-blue-400/70 mt-0.5">Fetch semua zones dari account</div>
                  </div>
                </div>
                <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-3 flex items-start gap-3">
                  <GlobeAltIcon className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-green-300">Include Subdomains</div>
                    <div className="text-xs text-green-400/70 mt-0.5">Import DNS records (A, AAAA, CNAME)</div>
                  </div>
                </div>
                <div className="bg-purple-900/20 border border-purple-700/30 rounded-lg p-3 flex items-start gap-3">
                  <ClockIcon className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-purple-300">Estimasi Waktu</div>
                    <div className="text-xs text-purple-400/70 mt-0.5">2-5 menit (tergantung jumlah domains)</div>
                  </div>
                </div>
              </div>

              {/* Warning */}
              <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3 mb-6">
                <div className="flex items-start gap-2">
                  <ExclamationTriangleIcon className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-yellow-300">
                    <span className="font-semibold">Catatan:</span> Domain yang sudah ada akan di-skip. Tidak akan ada duplikasi.
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSyncModal(false)}
                  className="flex-1 px-4 py-3 bg-cyber-border hover:bg-cyber-border/80 text-gray-300 rounded-lg font-medium transition-all duration-200 hover:scale-105"
                >
                  Batal
                </button>
                <button
                  onClick={confirmSyncFromCloudflare}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-cyber-accent to-purple-500 hover:from-cyber-accent/90 hover:to-purple-500/90 text-white rounded-lg font-medium transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-cyber-accent/50 flex items-center justify-center gap-2"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                  Mulai Sync
                </button>
              </div>
            </div>

            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyber-accent/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl" />
          </div>
        </div>
      )}

      {/* WHOIS Modal */}
      {showWhoisModal && selectedDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div 
            className="absolute inset-0 bg-black bg-opacity-60 backdrop-blur-sm"
            onClick={() => setShowWhoisModal(false)}
          />
          
          <div className="relative bg-gradient-to-br from-cyber-card via-cyber-bg to-cyber-card border-2 border-cyber-accent rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden animate-slideUp">
            <div className="absolute inset-0 bg-gradient-to-r from-cyber-accent/10 via-transparent to-purple-500/10" />
            
            <div className="relative">
              {/* Header */}
              <div className="p-6 border-b border-cyber-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-cyber-accent to-purple-500 rounded-lg p-3">
                      <InformationCircleIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold bg-gradient-to-r from-cyber-accent via-purple-400 to-cyber-accent bg-clip-text text-transparent">
                        WHOIS Information
                      </h3>
                      <p className="text-sm text-gray-400 font-mono">{selectedDomain.domain}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowWhoisModal(false)}
                    className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-cyber-border rounded-lg"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                {loadingWhois ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-12 h-12 border-4 border-cyber-accent border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-gray-400 text-sm">Fetching WHOIS data from VirusTotal...</p>
                  </div>
                ) : whoisData ? (
                  <div className="space-y-4">
                    {/* Domain Info */}
                    <div className="bg-cyber-card rounded-lg p-4 border border-cyber-border">
                      <h4 className="text-sm font-semibold text-cyber-accent mb-3 flex items-center gap-2">
                        <GlobeAltIcon className="w-4 h-4" />
                        Domain Information
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <WhoisRow label="Domain" value={whoisData.domain} />
                        <WhoisRow label="Registrar" value={whoisData.registrar} />
                        <WhoisRow label="Created" value={whoisData.creation_date ? new Date(whoisData.creation_date).toLocaleDateString('id-ID') : 'N/A'} />
                        <WhoisRow label="Updated" value={whoisData.updated_date ? new Date(whoisData.updated_date).toLocaleDateString('id-ID') : 'N/A'} />
                        <WhoisRow label="Expires" value={whoisData.expiration_date ? new Date(whoisData.expiration_date).toLocaleDateString('id-ID') : 'N/A'} />
                        <WhoisRow label="DNSSEC" value={whoisData.dnssec} />
                      </div>
                    </div>

                    {/* Registrant Info */}
                    {whoisData.registrant_name !== 'N/A' && (
                      <div className="bg-cyber-card rounded-lg p-4 border border-cyber-border">
                        <h4 className="text-sm font-semibold text-green-400 mb-3">👤 Registrant</h4>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <WhoisRow label="Name" value={whoisData.registrant_name} />
                          <WhoisRow label="Organization" value={whoisData.registrant_organization} />
                          <WhoisRow label="Email" value={whoisData.registrant_email} />
                          <WhoisRow label="Country" value={whoisData.registrant_country} />
                        </div>
                      </div>
                    )}

                    {/* Admin & Tech Contacts */}
                    <div className="grid grid-cols-2 gap-4">
                      {whoisData.admin_name !== 'N/A' && (
                        <div className="bg-cyber-card rounded-lg p-4 border border-cyber-border">
                          <h4 className="text-sm font-semibold text-blue-400 mb-3">👨‍💼 Admin</h4>
                          <div className="space-y-2 text-xs">
                            <WhoisRow label="Name" value={whoisData.admin_name} />
                            <WhoisRow label="Email" value={whoisData.admin_email} />
                          </div>
                        </div>
                      )}
                      {whoisData.tech_name !== 'N/A' && (
                        <div className="bg-cyber-card rounded-lg p-4 border border-cyber-border">
                          <h4 className="text-sm font-semibold text-purple-400 mb-3">🔧 Technical</h4>
                          <div className="space-y-2 text-xs">
                            <WhoisRow label="Name" value={whoisData.tech_name} />
                            <WhoisRow label="Email" value={whoisData.tech_email} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Name Servers */}
                    {whoisData.name_servers && whoisData.name_servers.length > 0 && (
                      <div className="bg-cyber-card rounded-lg p-4 border border-cyber-border">
                        <h4 className="text-sm font-semibold text-yellow-400 mb-3">🌐 Name Servers</h4>
                        <div className="space-y-1">
                          {whoisData.name_servers.map((ns, idx) => (
                            <div key={idx} className="text-xs font-mono text-gray-400 bg-cyber-bg px-3 py-2 rounded">
                              {ns}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Security Stats */}
                    {whoisData.last_analysis_stats && Object.keys(whoisData.last_analysis_stats).length > 0 && (
                      <div className="bg-cyber-card rounded-lg p-4 border border-cyber-border">
                        <h4 className="text-sm font-semibold text-red-400 mb-3">🛡️ Security Analysis</h4>
                        <div className="grid grid-cols-4 gap-3">
                          <div className="bg-green-900/20 rounded p-3 text-center">
                            <div className="text-2xl font-bold text-green-400">{whoisData.last_analysis_stats.harmless || 0}</div>
                            <div className="text-xs text-gray-500 mt-1">Harmless</div>
                          </div>
                          <div className="bg-red-900/20 rounded p-3 text-center">
                            <div className="text-2xl font-bold text-red-400">{whoisData.last_analysis_stats.malicious || 0}</div>
                            <div className="text-xs text-gray-500 mt-1">Malicious</div>
                          </div>
                          <div className="bg-yellow-900/20 rounded p-3 text-center">
                            <div className="text-2xl font-bold text-yellow-400">{whoisData.last_analysis_stats.suspicious || 0}</div>
                            <div className="text-xs text-gray-500 mt-1">Suspicious</div>
                          </div>
                          <div className="bg-gray-800 rounded p-3 text-center">
                            <div className="text-2xl font-bold text-gray-400">{whoisData.last_analysis_stats.undetected || 0}</div>
                            <div className="text-xs text-gray-500 mt-1">Undetected</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Reputation */}
                    {whoisData.reputation !== undefined && (
                      <div className="bg-cyber-card rounded-lg p-4 border border-cyber-border">
                        <h4 className="text-sm font-semibold text-cyan-400 mb-3">⭐ Reputation Score</h4>
                        <div className="flex items-center gap-4">
                          <div className="text-4xl font-bold text-cyber-accent">{whoisData.reputation}</div>
                          <div className="flex-1">
                            <div className="h-2 bg-cyber-border rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${whoisData.reputation >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                                style={{ width: `${Math.min(Math.abs(whoisData.reputation), 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {whoisData.reputation >= 0 ? 'Positive reputation' : 'Negative reputation'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <InformationCircleIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>WHOIS data tidak tersedia</p>
                  </div>
                )}
              </div>
            </div>

            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyber-accent/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl" />
          </div>
        </div>
      )}
    </div>
  );
}

function WhoisRow({ label, value }) {
  return (
    <div>
      <div className="text-gray-500 mb-0.5">{label}</div>
      <div className="text-gray-300 font-mono">{value || 'N/A'}</div>
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

function ResultBadge({ result }) {
  const config = {
    clean: { label: '✓ Bersih', cls: 'bg-green-900 bg-opacity-30 text-green-400 border border-green-700 border-opacity-40' },
    suspicious: { label: '⚠ Mencurigakan', cls: 'bg-yellow-900 bg-opacity-30 text-yellow-400 border border-yellow-700 border-opacity-40' },
    infected: { label: '✕ Terinfeksi', cls: 'bg-red-900 bg-opacity-30 text-red-400 border border-red-700 border-opacity-40' },
  };
  const cfg = config[result] || config.clean;
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${cfg.cls}`}>{cfg.label}</span>;
}

function Modal({ title, children, onClose, large }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className={`cyber-card ${large ? 'max-w-3xl' : 'max-w-md'} w-full max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyber-border sticky top-0 bg-cyber-card z-10">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <XCircleIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
