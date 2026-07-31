'use client';

import Sidebar from '../components/Sidebar';
import { useEffect, useState } from 'react';
import Link from 'next/link';

// Simple Markdown parser for rendering changelog items beautifully
function renderMarkdown(md) {
  if (!md) return null;
  const lines = md.split('\n');
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={idx} style={{ height: '8px' }} />;
    
    if (trimmed.startsWith('# ')) {
      return (
        <h1 key={idx} style={{ fontSize: '1.3rem', borderBottom: '1px solid var(--border)', paddingBottom: '6px', margin: '20px 0 10px 0', color: '#fff', fontWeight: 700 }}>
          {trimmed.replace('# ', '')}
        </h1>
      );
    }
    if (trimmed.startsWith('## ')) {
      return (
        <h2 key={idx} style={{ fontSize: '1.05rem', color: 'var(--accent-light)', margin: '16px 0 6px 0', fontWeight: 600 }}>
          {trimmed.replace('## ', '')}
        </h2>
      );
    }
    if (trimmed.startsWith('- ')) {
      return (
        <li key={idx} style={{ marginLeft: '16px', marginBottom: '6px', color: 'var(--text-primary)', listStyleType: 'disc' }}>
          {trimmed.replace('- ', '')}
        </li>
      );
    }
    return (
      <p key={idx} style={{ margin: '4px 0', color: 'var(--text-secondary)' }}>
        {trimmed}
      </p>
    );
  });
}

export default function SystemHealthPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);
  const [clearing, setClearing] = useState(false);

  // Tab State: 'status' (System Status & Incidents) | 'changelog' (Version & Git Changelog)
  const [activeTab, setActiveTab] = useState('status');
  const [commits, setCommits] = useState([]);
  const [changelog, setChangelog] = useState('');
  const [version, setVersion] = useState('0.1.0');
  const [loadingChangelog, setLoadingChangelog] = useState(false);

  useEffect(() => {
    fetchHealthData();
    const interval = setInterval(fetchHealthData, 5000); // Polling every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Fetch Git History and Changelog when Changelog tab is clicked
  useEffect(() => {
    if (activeTab === 'changelog') {
      fetchChangelogAndGit();
    }
  }, [activeTab]);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function fetchHealthData() {
    try {
      const res = await fetch('/api/v2/system-health');
      if (!res.ok) throw new Error('Gagal mengambil data kesehatan sistem');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchChangelogAndGit() {
    setLoadingChangelog(true);
    try {
      const [changelogRes, gitRes] = await Promise.all([
        fetch('/api/v2/system-health/changelog'),
        fetch('/api/v2/system-health/git-history')
      ]);

      const changelogJson = await changelogRes.json();
      const gitJson = await gitRes.json();

      if (changelogJson.success) {
        setChangelog(changelogJson.content);
        setVersion(changelogJson.version);
      }
      if (gitJson.success) {
        setCommits(gitJson.commits || []);
      }
    } catch (e) {
      console.error('[Changelog fetch warning]:', e.message);
    } finally {
      setLoadingChangelog(false);
    }
  }

  async function handleResolve(logId) {
    setResolvingId(logId);
    try {
      const res = await fetch(`/api/v2/system-health/logs/${logId}/resolve`, {
        method: 'PATCH',
      });
      const resJson = await res.json();
      if (resJson.success) {
        showToast(resJson.message);
        fetchHealthData();
      } else {
        throw new Error(resJson.error || 'Gagal menandai log selesai');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setResolvingId(null);
    }
  }

  async function handleClearAllResolved() {
    if (!confirm('Apakah Anda yakin ingin menghapus semua log yang sudah diselesaikan dari database?')) return;
    setClearing(true);
    try {
      const res = await fetch('/api/v2/system-health/logs/clear-resolved', {
        method: 'POST',
      });
      const resJson = await res.json();
      if (resJson.success) {
        showToast(resJson.message);
        fetchHealthData();
      } else {
        throw new Error(resJson.error || 'Gagal menghapus log selesai');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setClearing(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <div style={{ color: 'var(--text-muted)' }}>Memuat status observabilitas sistem...</div>
        </main>
      </div>
    );
  }

  const { google, gemini, queue, logs } = data || {
    google: { credentialsSet: false, connected: false, email: null },
    gemini: { total: 0, active: 0, inactive: 0, keys: [] },
    queue: { stats: { pending: 0, processing: 0, completed: 0, failed: 0 }, pendingOpc: 0, pendingRe: 0 },
    logs: []
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto' }}>
          
          {toast && (
            <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
              {toast.msg}
            </div>
          )}

          {/* HEADER */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--accent-light)', fontWeight: 600, textTransform: 'uppercase' }}>OBSERVABILITY & MONITORING</div>
              <h1 style={{ margin: '4px 0 0 0', fontSize: '1.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
                🩺 System Health & Troubleshooting
              </h1>
            </div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8, 
              background: 'rgba(16, 185, 129, 0.1)', 
              border: '1px solid rgba(16, 185, 129, 0.25)', 
              padding: '8px 16px', 
              borderRadius: '24px',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#10b981'
            }}>
              <span className="pulse-dot" style={{ width: 8, height: 8, background: '#10b981', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 8px #10b981' }}></span>
              Core Scheduler: ACTIVE
            </div>
          </div>

          {/* METRICS PANEL */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 24 }}>
            
            {/* Google Drive Status */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 20 }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Google OAuth Token</span>
                <h3 style={{ margin: '8px 0', fontSize: '1.4rem', fontWeight: 700, color: google.connected ? '#10b981' : '#ef4444' }}>
                  {google.connected ? 'Connected' : google.credentialsSet ? 'Session Expired' : 'Not Configured'}
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                  {google.connected ? `Akun: ${google.email}` : 'Token integrasi Google Drive kadaluarsa atau tidak terhubung.'}
                </p>
              </div>
              <div style={{ marginTop: 16 }}>
                <Link href="/settings" className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'inline-block', textDecoration: 'none' }}>
                  {google.connected ? 'Hubungkan Ulang ➔' : 'Konfigurasi Google ➔'}
                </Link>
              </div>
            </div>

            {/* Gemini API Key Pool */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 20 }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Gemini Key Pool</span>
                <h3 style={{ margin: '8px 0', fontSize: '1.4rem', fontWeight: 700, color: gemini.active > 0 ? '#10b981' : '#ef4444' }}>
                  {gemini.active} / {gemini.total} Active
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                  {gemini.inactive > 0 ? `${gemini.inactive} kunci terblokir / cooldown.` : 'Seluruh key dalam kondisi sehat dan siap pakai.'}
                </p>
              </div>
              <div style={{ marginTop: 16 }}>
                <Link href="/settings" className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'inline-block', textDecoration: 'none' }}>
                  Kelola API Keys ➔
                </Link>
              </div>
            </div>

            {/* Scheduler Pending Task Queue */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 20 }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Scheduler Queue Tasks</span>
                <h3 style={{ margin: '8px 0', fontSize: '1.4rem', fontWeight: 700 }}>
                  {(queue.stats.pending || 0) + (queue.stats.processing || 0)} Aktif
                </h3>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pending: <strong>{queue.stats.pending || 0}</strong></span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-light)' }}>Running: <strong>{queue.stats.processing || 0}</strong></span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Failed: <strong style={{ color: '#ef4444' }}>{queue.stats.failed || 0}</strong></span>
                </div>
              </div>
            </div>

          </div>

          {/* TAB BUTTONS */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <button 
              onClick={() => setActiveTab('status')}
              className="btn"
              style={{
                background: activeTab === 'status' ? 'var(--accent)' : 'rgba(255,255,255,0.02)',
                color: activeTab === 'status' ? '#fff' : 'var(--text-secondary)',
                border: activeTab === 'status' ? '1px solid var(--accent)' : '1px solid var(--border)',
                padding: '8px 16px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              🩺 Status & Insiden Sistem
            </button>
            <button 
              onClick={() => setActiveTab('changelog')}
              className="btn"
              style={{
                background: activeTab === 'changelog' ? 'var(--accent)' : 'rgba(255,255,255,0.02)',
                color: activeTab === 'changelog' ? '#fff' : 'var(--text-secondary)',
                border: activeTab === 'changelog' ? '1px solid var(--accent)' : '1px solid var(--border)',
                padding: '8px 16px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              📋 Versi & Log Perubahan
            </button>
          </div>

          {/* TAB CONTENT: STATUS & INCIDENTS */}
          {activeTab === 'status' && (
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0 }}>🚨 Live System Incidents (Crash & Warning Logs)</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '4px 0 0 0' }}>
                    Menampilkan kegagalan asinkron pada modul MAKNA Engine yang membutuhkan troubleshooting operator.
                  </p>
                </div>
                <button 
                  className="btn btn-secondary"
                  onClick={handleClearAllResolved}
                  disabled={clearing}
                  style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                >
                  {clearing ? 'Membersihkan...' : '🧹 Bersihkan Log Terselesaikan'}
                </button>
              </div>

              {logs.length === 0 ? (
                <div style={{ 
                  padding: '40px 0', 
                  textAlign: 'center', 
                  background: 'rgba(255, 255, 255, 0.01)', 
                  border: '1px dashed var(--border)', 
                  borderRadius: 8 
                }}>
                  <span style={{ fontSize: '2rem' }}>🎉</span>
                  <h4 style={{ margin: '12px 0 4px 0', fontSize: '0.95rem', fontWeight: 600, color: '#10b981' }}>Sistem Sangat Sehat</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>Tidak ada insiden kegagalan yang tercatat atau belum diselesaikan.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '12px 8px', fontWeight: 600 }}>Tingkat</th>
                        <th style={{ padding: '12px 8px', fontWeight: 600 }}>Waktu</th>
                        <th style={{ padding: '12px 8px', fontWeight: 600 }}>Modul</th>
                        <th style={{ padding: '12px 8px', fontWeight: 600 }}>Detail Kesalahan teknis</th>
                        <th style={{ padding: '12px 8px', fontWeight: 600 }}>💡 Solusi Manusia (Smart Hint)</th>
                        <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'center' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => {
                        const isCritical = log.severity_level === 'CRITICAL';
                        const badgeBg = isCritical ? 'rgba(239, 68, 68, 0.15)' : 'rgba(243, 156, 18, 0.15)';
                        const badgeBorder = isCritical ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(243, 156, 18, 0.4)';
                        const badgeColor = isCritical ? '#ef4444' : '#f39c12';

                        return (
                          <tr 
                            key={log.id} 
                            style={{ 
                              borderBottom: '1px solid var(--border)', 
                              background: isCritical ? 'rgba(239, 68, 68, 0.01)' : 'transparent',
                              verticalAlign: 'top'
                            }}
                          >
                            {/* Severity */}
                            <td style={{ padding: '16px 8px' }}>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: 4,
                                background: badgeBg,
                                border: badgeBorder,
                                color: badgeColor,
                                fontWeight: 700,
                                fontSize: '0.68rem',
                                letterSpacing: '0.5px'
                              }}>
                                {log.severity_level}
                              </span>
                            </td>

                            {/* Time */}
                            <td style={{ padding: '16px 8px', color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                              {new Date(log.created_at).toLocaleString('id-ID')}
                            </td>

                            {/* Module */}
                            <td style={{ padding: '16px 8px' }}>
                              <code style={{ background: 'var(--bg-secondary)', padding: '3px 6px', borderRadius: 4, fontSize: '0.75rem' }}>
                                {log.module_name}
                              </code>
                              {log.reference_id && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                  Ref: <code>{log.reference_id}</code>
                                </div>
                              )}
                            </td>

                            {/* Error Message */}
                            <td style={{ padding: '16px 8px', maxWidth: '320px' }}>
                              <div style={{ 
                                background: 'rgba(0,0,0,0.15)', 
                                border: '1px solid var(--border)', 
                                padding: 8, 
                                borderRadius: 6, 
                                fontSize: '0.78rem', 
                                fontFamily: 'monospace',
                                color: '#fff',
                                maxHeight: '120px',
                                overflowY: 'auto',
                                wordBreak: 'break-all',
                                whiteSpace: 'pre-wrap'
                              }}>
                                {log.error_message}
                              </div>
                            </td>

                            {/* Human Hint */}
                            <td style={{ padding: '16px 8px', color: 'var(--text-primary)', lineHeight: 1.45, maxWidth: '300px' }}>
                              <strong style={{ color: isCritical ? '#fff' : 'var(--text-primary)' }}>
                                {log.human_resolution_hint}
                              </strong>
                            </td>

                            {/* Action */}
                            <td style={{ padding: '16px 8px', textAlign: 'center' }}>
                              <button
                                className="btn btn-secondary"
                                onClick={() => handleResolve(log.id)}
                                disabled={resolvingId === log.id}
                                style={{ 
                                  padding: '4px 10px', 
                                  fontSize: '0.75rem', 
                                  background: 'rgba(16, 185, 129, 0.1)', 
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                  color: '#10b981',
                                  cursor: 'pointer'
                                }}
                              >
                                {resolvingId === log.id ? 'Memproses...' : '✓ Selesai'}
                              </button>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT: VERSION & CHANGELOG */}
          {activeTab === 'changelog' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 24 }}>
              
              {/* Milestone Changelog */}
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0 }}>📋 Riwayat Milestone Fitur</h2>
                  <span style={{ 
                    background: 'rgba(108, 92, 231, 0.15)', 
                    border: '1px solid var(--accent)', 
                    color: 'var(--accent-light)', 
                    padding: '4px 10px', 
                    borderRadius: 12, 
                    fontSize: '0.78rem', 
                    fontWeight: 700 
                  }}>
                    Versi: v{version}
                  </span>
                </div>
                
                {loadingChangelog ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Memuat log perubahan...</div>
                ) : (
                  <div style={{ fontSize: '0.85rem', lineHeight: 1.6, maxHeight: '550px', overflowY: 'auto', paddingRight: '8px' }}>
                    {renderMarkdown(changelog)}
                  </div>
                )}
              </div>

              {/* Git Commit Timeline */}
              <div className="card" style={{ padding: 24 }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, marginBottom: 20 }}>🌿 Lini Masa Commit Git (Kode Terkini)</h2>
                
                {loadingChangelog ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Memuat riwayat Git...</div>
                ) : commits.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Tidak ada riwayat Git ditemukan.</div>
                ) : (
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: 16, 
                    position: 'relative',
                    maxHeight: '550px',
                    overflowY: 'auto',
                    paddingLeft: '4px',
                    paddingRight: '8px'
                  }}>
                    {/* Vertical line */}
                    <div style={{ 
                      position: 'absolute', 
                      left: '15px', 
                      top: '12px', 
                      bottom: '12px', 
                      width: '2px', 
                      background: 'var(--border)' 
                    }}></div>
                    
                    {commits.map((commit, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 16, position: 'relative', zIndex: 1 }}>
                        
                        {/* Dot */}
                        <div style={{ 
                          width: '24px', 
                          height: '24px', 
                          borderRadius: '50%', 
                          background: idx === 0 ? 'var(--accent)' : 'var(--bg-secondary)', 
                          border: idx === 0 ? '4px solid rgba(108, 92, 231, 0.3)' : '2px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {idx === 0 && <span style={{ width: 6, height: 6, background: '#fff', borderRadius: '50%' }}></span>}
                        </div>
                        
                        {/* Commit text */}
                        <div style={{ flexGrow: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, flexWrap: 'wrap', gap: 4 }}>
                            <span style={{ 
                              fontWeight: 600, 
                              fontSize: '0.82rem', 
                              color: idx === 0 ? 'var(--text-primary)' : 'var(--text-secondary)' 
                            }}>
                              {commit.message}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              {commit.date}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            <span>Oleh: <strong>{commit.author}</strong></span>
                            <span>•</span>
                            <code style={{ background: 'var(--bg-secondary)', padding: '1px 4px', borderRadius: 4, fontSize: '0.68rem', fontFamily: 'monospace' }}>
                              {commit.hash}
                            </code>
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      </main>

      <style jsx global>{`
        .pulse-dot {
          animation: active-pulse 1.5s infinite alternate;
        }
        @keyframes active-pulse {
          from {
            transform: scale(0.95);
            opacity: 0.7;
          }
          to {
            transform: scale(1.1);
            opacity: 1;
            box-shadow: 0 0 12px #10b981;
          }
        }
      `}</style>
    </div>
  );
}
