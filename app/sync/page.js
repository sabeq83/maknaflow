'use client';

import Sidebar from '../components/Sidebar';
import { useEffect, useState, useRef } from 'react';

export default function SyncPage() {
  const [config, setConfig] = useState({
    cloud_sync_enabled: false,
    cloud_hub_url: '',
    secret_cloud_token: '',
    cloud_sync_interval: 60,
    cloud_last_poll_time: '',
    cloud_last_sync_status: '',
    cloud_last_sync_error: '',
    daemon: { isRunning: false, lastTickTime: null, lastTickStatus: 'Idle', logs: [] }
  });
  
  const [inputUrl, setInputUrl] = useState('');
  const [inputToken, setInputToken] = useState('');
  const [inputInterval, setInputInterval] = useState(60);
  
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [toast, setToast] = useState(null);
  
  const consoleContainerRef = useRef(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000); // Polling status & logs every 4 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (consoleContainerRef.current) {
      consoleContainerRef.current.scrollTop = consoleContainerRef.current.scrollHeight;
    }
  }, [config.daemon?.logs]);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function fetchData() {
    try {
      // 1. Fetch Config and daemon state
      const confRes = await fetch('/api/sync');
      const confData = await confRes.json();
      if (confData.success) {
        setConfig(confData.data);
        
        // Only set input fields on initial load
        if (loading) {
          setInputUrl(confData.data.cloud_hub_url || '');
          setInputToken(confData.data.raw_token || '');
          setInputInterval(confData.data.cloud_sync_interval || 60);
        }
      }

      // 2. Fetch Sync Jobs list
      const jobsRes = await fetch('/api/sync/jobs');
      const jobsData = await jobsRes.json();
      if (jobsData.success) {
        setJobs(jobsData.jobs);
      }
    } catch (err) {
      console.error('Failed to poll sync status:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings(e) {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cloud_hub_url: inputUrl,
          secret_cloud_token: inputToken,
          cloud_sync_interval: Number(inputInterval)
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        fetchData();
      } else {
        throw new Error(data.error || 'Gagal menyimpan pengaturan.');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleSync(enabled) {
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cloud_sync_enabled: enabled
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(enabled ? 'Background Sync Diaktifkan' : 'Background Sync Dinonaktifkan');
        fetchData();
      } else {
        throw new Error(data.error || 'Gagal mengubah status sync.');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    try {
      const res = await fetch('/api/sync/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cloud_hub_url: inputUrl,
          secret_cloud_token: inputToken
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`${data.message} (${data.jobsCount} antrean pekerjaan ditemukan)`, 'success');
      } else {
        throw new Error(data.error || 'Tes koneksi gagal.');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setTesting(false);
    }
  }

  async function handleTriggerSync() {
    setTriggering(true);
    try {
      const res = await fetch('/api/sync/trigger', {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        fetchData();
      } else {
        throw new Error(data.error || 'Gagal memicu sinkronisasi.');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setTriggering(false);
    }
  }

  // Count metrics
  const totalJobs = jobs.length;
  const runningJobs = jobs.filter(j => j.status === 'running').length;
  const completedJobs = jobs.filter(j => j.status === 'completed').length;
  const failedJobs = jobs.filter(j => j.status === 'failed').length;

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
              <div style={{ fontSize: '0.8rem', color: 'var(--accent-color)', fontWeight: 600, textTransform: 'uppercase' }}>CLOUD HUB CONNECTION</div>
              <h1 style={{ margin: '4px 0 0 0', fontSize: '1.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
                ☁️ MAKNA Hub Sync Control Center
              </h1>
            </div>
            
            <div style={{ display: 'flex', gap: 10 }}>
              <button 
                className="btn btn-secondary" 
                onClick={handleTriggerSync}
                disabled={triggering || !config.cloud_sync_enabled}
                style={{ fontSize: '0.82rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {triggering ? 'Menyinkronkan...' : '🔄 Sinkronkan Sekarang'}
              </button>
              
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8, 
                background: config.cloud_sync_enabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                border: config.cloud_sync_enabled ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)', 
                padding: '8px 16px', 
                borderRadius: '24px',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: config.cloud_sync_enabled ? '#10b981' : '#ef4444'
              }}>
                <span 
                  className={config.cloud_sync_enabled ? 'pulse-dot' : ''} 
                  style={{ 
                    width: 8, 
                    height: 8, 
                    background: config.cloud_sync_enabled ? '#10b981' : '#ef4444', 
                    borderRadius: '50%', 
                    display: 'inline-block', 
                    boxShadow: config.cloud_sync_enabled ? '0 0 8px #10b981' : 'none' 
                  }}
                ></span>
                Sync Daemon: {config.cloud_sync_enabled ? 'ACTIVE' : 'INACTIVE'}
              </div>
            </div>
          </div>

          {/* OVERVIEW STATS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 24 }}>
            <div className="card" style={{ padding: 18 }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Cloud Jobs</span>
              <h3 style={{ margin: '6px 0 0 0', fontSize: '1.8rem', fontWeight: 700 }}>{totalJobs}</h3>
            </div>
            <div className="card" style={{ padding: 18 }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Sedang Diproses Lokal</span>
              <h3 style={{ margin: '6px 0 0 0', fontSize: '1.8rem', fontWeight: 700, color: '#f39c12' }}>{runningJobs}</h3>
            </div>
            <div className="card" style={{ padding: 18 }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Selesai &amp; Sinkron</span>
              <h3 style={{ margin: '6px 0 0 0', fontSize: '1.8rem', fontWeight: 700, color: '#10b981' }}>{completedJobs}</h3>
            </div>
            <div className="card" style={{ padding: 18 }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Gagal / Butuh Operator</span>
              <h3 style={{ margin: '6px 0 0 0', fontSize: '1.8rem', fontWeight: 700, color: '#ef4444' }}>{failedJobs}</h3>
            </div>
          </div>

          {/* CONFIG & RUNNER PANEL */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24, alignItems: 'stretch' }}>
            
            {/* Connection Credentials Form */}
            <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1.05rem', fontWeight: 600 }}>🔒 Hub Credentials &amp; Target</h3>
                
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>MAKNA CLOUD HUB URL</label>
                  <input 
                    type="text" 
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="https://hub.makna.co" 
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-color)',
                      padding: '10px 12px',
                      borderRadius: 6,
                      color: '#fff',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
                
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>SECRET CLOUD BEARER TOKEN</label>
                  <input 
                    type="password" 
                    value={inputToken}
                    onChange={(e) => setInputToken(e.target.value)}
                    placeholder="Masukkan token autentikasi Cloud Hub"
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-color)',
                      padding: '10px 12px',
                      borderRadius: 6,
                      color: '#fff',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={handleTestConnection}
                  disabled={testing || !inputUrl || !inputToken}
                  style={{ flex: 1, padding: '10px 0', fontSize: '0.82rem' }}
                >
                  {testing ? 'Menguji...' : '🔌 Tes Koneksi'}
                </button>
                <button 
                  className="btn" 
                  onClick={handleSaveSettings}
                  disabled={saving || !inputUrl || !inputToken}
                  style={{ flex: 1, padding: '10px 0', fontSize: '0.82rem', background: 'var(--accent-color)', color: '#000', border: 'none', fontWeight: 600 }}
                >
                  {saving ? 'Menyimpan...' : '💾 Simpan Kredensial'}
                </button>
              </div>
            </div>

            {/* Daemon Switcher & Polling Settings */}
            <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1.05rem', fontWeight: 600 }}>⚙️ Polling &amp; Daemon Controls</h3>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <div>
                    <strong style={{ fontSize: '0.88rem', display: 'block' }}>Background Sync Daemon</strong>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Cari tugas baru dari cloud secara berkala</span>
                  </div>
                  <label className="switch" style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
                    <input 
                      type="checkbox" 
                      checked={config.cloud_sync_enabled}
                      onChange={(e) => handleToggleSync(e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span className="slider" style={{
                      position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: config.cloud_sync_enabled ? '#10b981' : '#333',
                      transition: '.3s', borderRadius: 24
                    }}>
                      <span className="slider-thumb" style={{
                        position: 'absolute', content: '', height: 18, width: 18, left: config.cloud_sync_enabled ? 22 : 3, bottom: 3,
                        backgroundColor: 'white', transition: '.3s', borderRadius: '50%'
                      }}></span>
                    </span>
                  </label>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>JEDA POLLING RUNNER (DETIK)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input 
                      type="number" 
                      value={inputInterval}
                      onChange={(e) => setInputInterval(Number(e.target.value))}
                      min="15"
                      max="3600"
                      style={{
                        width: 100,
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--border-color)',
                        padding: '10px 12px',
                        borderRadius: 6,
                        color: '#fff',
                        fontSize: '0.85rem'
                      }}
                    />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Detik (Minimal 15 detik)</span>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Terakhir Polling Sukses:</span>
                  <strong style={{ color: '#fff' }}>{config.cloud_last_poll_time ? new Date(config.cloud_last_poll_time).toLocaleString('id-ID') : 'Belum Pernah'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Status Sync Terakhir:</span>
                  <strong style={{ color: config.cloud_last_sync_status === 'success' ? '#10b981' : config.cloud_last_sync_status === 'error' ? '#ef4444' : 'var(--text-muted)' }}>
                    {config.cloud_last_sync_status === 'success' ? 'Sukses' : config.cloud_last_sync_status === 'error' ? 'Gagal' : 'Idle'}
                  </strong>
                </div>
                {config.cloud_last_sync_error && (
                  <div style={{ marginTop: 8, color: '#ef4444', fontStyle: 'italic', fontSize: '0.72rem', wordBreak: 'break-all' }}>
                    Error: {config.cloud_last_sync_error}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* ACTIVE SYNC JOBS TABLE */}
          <div className="card" style={{ padding: 24, marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 600 }}>📋 Daftar Tugas Cloud &amp; Status Lokal</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 16px 0' }}>
              Memantau alur pemrosesan lokal asinkron untuk tugas-tugas yang terintegrasi dari cloud.
            </p>

            {jobs.length === 0 ? (
              <div style={{ 
                padding: '40px 0', 
                textAlign: 'center', 
                background: 'rgba(255, 255, 255, 0.01)', 
                border: '1px dashed var(--border-color)', 
                borderRadius: 8 
              }}>
                <span style={{ fontSize: '1.8rem' }}>🌥️</span>
                <h4 style={{ margin: '12px 0 4px 0', fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-muted)' }}>Belum Ada Pekerjaan Cloud</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>Hubungkan ke MAKNA Hub dan aktifkan sync daemon untuk memuat pekerjaan.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '12px 8px', fontWeight: 600 }}>Tipe</th>
                      <th style={{ padding: '12px 8px', fontWeight: 600 }}>Job ID / Kampanye</th>
                      <th style={{ padding: '12px 8px', fontWeight: 600 }}>Target URL / Sourcing</th>
                      <th style={{ padding: '12px 8px', fontWeight: 600 }}>Status Global</th>
                      <th style={{ padding: '12px 8px', fontWeight: 600 }}>Alur Pengerjaan Lokal (Pipeline Stages)</th>
                      <th style={{ padding: '12px 8px', fontWeight: 600 }}>Aset Akhir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => {
                      const isComplete = job.status === 'completed';
                      const isFailed = job.status === 'failed';
                      const isRunning = job.status === 'running';
                      
                      const badgeBg = isComplete ? 'rgba(16, 185, 129, 0.12)' : isFailed ? 'rgba(239, 68, 68, 0.12)' : 'rgba(243, 156, 18, 0.12)';
                      const badgeBorder = isComplete ? '1px solid rgba(16, 185, 129, 0.3)' : isFailed ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(243, 156, 18, 0.3)';
                      const badgeColor = isComplete ? '#10b981' : isFailed ? '#ef4444' : '#f39c12';

                      return (
                        <tr key={job.id} style={{ borderBottom: '1px solid var(--border-color)', verticalAlign: 'middle' }}>
                          <td style={{ padding: '14px 8px' }}>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: job.type === 'RE' ? 'rgba(142, 68, 173, 0.15)' : 'rgba(39, 174, 96, 0.15)',
                              border: job.type === 'RE' ? '1px solid rgba(142, 68, 173, 0.3)' : '1px solid rgba(39, 174, 96, 0.3)',
                              color: job.type === 'RE' ? '#9b59b6' : '#2ecc71',
                              fontWeight: 700,
                              fontSize: '0.68rem',
                            }}>
                              {job.type}
                            </span>
                          </td>
                          <td style={{ padding: '14px 8px' }}>
                            <div style={{ fontWeight: 600, color: '#fff' }}>{job.id}</div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{job.campaign_name}</div>
                          </td>
                          <td style={{ padding: '14px 8px', maxWidth: 220 }}>
                            <div style={{ 
                              fontSize: '0.78rem', 
                              whiteSpace: 'nowrap', 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis',
                              color: 'var(--text-muted)'
                            }}>
                              {job.target_url ? (
                                <a href={job.target_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'none' }}>
                                  {job.target_url}
                                </a>
                              ) : 'N/A (Pillar)'}
                            </div>
                          </td>
                          <td style={{ padding: '14px 8px' }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: 4,
                              background: badgeBg,
                              border: badgeBorder,
                              color: badgeColor,
                              fontWeight: 600,
                              fontSize: '0.72rem',
                            }}>
                              {job.status.toUpperCase()}
                            </span>
                            {job.retry_count > 0 && job.status === 'running' && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                Retry: <strong>{job.retry_count}/3</strong>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '14px 8px' }}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {Object.entries(job.steps).map(([stepName, stepStatus]) => {
                                const st = String(stepStatus).toLowerCase();
                                const isStepComplete = st === 'completed' || st === 'analyzed' || st === 'downloaded' || st === 'ready' || st === 'skipped';
                                const isStepFailed = st === 'failed';
                                const isStepRunning = st === 'processing' || st === 'running' || st === 'uploading';
                                
                                const color = isStepComplete ? '#10b981' : isStepFailed ? '#ef4444' : isStepRunning ? '#f39c12' : '#555';
                                const bg = isStepComplete ? 'rgba(16, 185, 129, 0.08)' : isStepFailed ? 'rgba(239, 68, 68, 0.08)' : isStepRunning ? 'rgba(243, 156, 18, 0.08)' : 'rgba(255,255,255,0.02)';
                                const border = isStepComplete ? '1px solid rgba(16, 185, 129, 0.2)' : isStepFailed ? '1px solid rgba(239, 68, 68, 0.2)' : isStepRunning ? '1px solid rgba(243, 156, 18, 0.2)' : '1px solid #333';

                                return (
                                  <span key={stepName} style={{
                                    fontSize: '0.68rem',
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    color,
                                    background: bg,
                                    border,
                                    textTransform: 'uppercase',
                                    fontWeight: 600
                                  }}>
                                    {stepName}: {st}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td style={{ padding: '14px 8px' }}>
                            {job.drive_link ? (
                              <a 
                                href={job.drive_link} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="btn btn-secondary" 
                                style={{ fontSize: '0.74rem', padding: '4px 10px', textDecoration: 'none', display: 'inline-block' }}
                              >
                                🔗 Buka G-Drive ➔
                              </a>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>Proses belum selesai</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SYNC AUDIT LOG CONSOLE */}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 600 }}>☁️ Real-time Cloud Polling Console Log</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 16px 0' }}>
              Memantau riwayat aktivitas polling background sync daemon lokal.
            </p>

            <div 
              ref={consoleContainerRef}
              style={{
                background: '#0d1117',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                padding: '16px 20px',
                fontFamily: 'monospace',
                fontSize: '0.82rem',
                color: '#c9d1d9',
                height: 250,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}
            >
              {config.daemon?.logs?.length === 0 ? (
                <div style={{ color: '#8b949e', fontStyle: 'italic', textAlign: 'center', marginTop: 100 }}>
                  Belum ada catatan log masuk. Daemon sync mungkin belum aktif.
                </div>
              ) : (
                [...config.daemon.logs].reverse().map((log, index) => {
                  let logColor = '#c9d1d9';
                  if (log.type === 'error') logColor = '#f85149';
                  if (log.type === 'success') logColor = '#56d364';
                  if (log.type === 'warning') logColor = '#e3b341';
                  
                  return (
                    <div key={index} style={{ color: logColor, display: 'flex', gap: 10, lineHeight: 1.4 }}>
                      <span style={{ color: '#8b949e', whiteSpace: 'nowrap' }}>[{new Date(log.time).toLocaleTimeString()}]</span>
                      <span style={{ wordBreak: 'break-all' }}>{log.message}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

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
            transform: scale(1.15);
            opacity: 1;
            box-shadow: 0 0 12px #10b981;
          }
        }
      `}</style>
    </div>
  );
}
