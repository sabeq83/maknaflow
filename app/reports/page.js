'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/app/components/Sidebar';

export default function ReportsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [jobsData, setJobsData] = useState({ jobs: [], total: 0 });
  const [jobsLoading, setJobsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [queueFilter, setQueueFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [retrying, setRetrying] = useState({});

  useEffect(() => {
    fetchDashboardData();
    // Poll every 10 seconds
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [page, queueFilter, statusFilter]);

  async function fetchDashboardData() {
    try {
      const res = await fetch('/api/reports');
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchJobs() {
    setJobsLoading(true);
    try {
      const params = new URLSearchParams({ page, limit });
      if (queueFilter !== 'all') params.append('queue', queueFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      
      const res = await fetch(`/api/reports/jobs?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setJobsData({ jobs: json.jobs, total: json.total });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setJobsLoading(false);
    }
  }

  async function handleRetry(id) {
    if (!confirm('Re-queue job ini?')) return;
    setRetrying(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/reports/jobs/${id}/retry`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        fetchJobs();
        fetchDashboardData();
      } else {
        alert(`Gagal: ${json.error}`);
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      setRetrying(prev => ({ ...prev, [id]: false }));
    }
  }

  function showToast(msg) {
    alert(msg); // simple fallback, can be replaced with custom toast
  }

  if (loading && !data) {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <div className="page-container">
            Loading Reports...
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <div className="page-container">
            <h2 style={{color:'red'}}>Error loading reports</h2>
            <p>{error}</p>
          </div>
        </main>
      </div>
    );
  }

  const { executiveSummary, queueMonitor, activeCampaigns, glabsTasks = [] } = data;
  
  // Transform queueStats to table format
  const queuesMap = {};
  for (const item of queueMonitor) {
    if (!queuesMap[item.queue_name]) queuesMap[item.queue_name] = { pending: 0, running: 0, completed: 0, failed: 0 };
    queuesMap[item.queue_name][item.status] = item.count;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content" style={{ overflowY: 'auto', height: '100vh' }}>
        <div className="page-container">
          <div className="page-header" style={{ marginBottom: '20px' }}>
            <h2>📊 Scheduler & Campaign Reports</h2>
            <p>Observability Dashboard & Audit Trail</p>
          </div>

          {/* ZONE A: Executive Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔋</div>
              <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>API Pool Health</h3>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                {executiveSummary.apiPool.used} / {executiveSummary.apiPool.total} Calls Used
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--success)' }}>Aman - Reset Nanti</div>
            </div>

            <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎯</div>
              <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Global Success Rate</h3>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                {(executiveSummary.successRate * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Dari total {executiveSummary.totalJobs} Job</div>
            </div>

            <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⏱️</div>
              <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Avg Processing Time</h3>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                {executiveSummary.avgProcessingTimeSec.toFixed(1)} Detik / Job
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Rata-rata Keseluruhan</div>
            </div>
          </div>

          {/* ZONE B: Queue Live Monitor */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-title">Queue Live Monitor</div>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nama Antrean (Queue)</th>
                    <th style={{textAlign:'center'}}>PENDING</th>
                    <th style={{textAlign:'center'}}>RUNNING</th>
                    <th style={{textAlign:'center'}}>COMPLETED</th>
                    <th style={{textAlign:'center'}}>FAILED</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(queuesMap).length === 0 ? (
                    <tr><td colSpan="6" style={{textAlign:'center'}}>Belum ada data antrean</td></tr>
                  ) : (
                    Object.keys(queuesMap).map(queueName => {
                      const q = queuesMap[queueName];
                      let statusText = '🟢 Aman';
                      if (q.failed > 0) statusText = '🔴 Ada Error';
                      else if (q.running > 0) statusText = '🟡 Memproses';
                      else if (q.pending > 0) statusText = '🔵 Menunggu';

                      return (
                        <tr key={queueName}>
                          <td><strong>{queueName}</strong></td>
                          <td style={{textAlign:'center'}}>{q.pending}</td>
                          <td style={{textAlign:'center'}}>{q.running}</td>
                          <td style={{textAlign:'center', color: 'var(--success)'}}>{q.completed}</td>
                          <td style={{textAlign:'center', color: q.failed > 0 ? 'var(--danger)' : 'inherit'}}>{q.failed}</td>
                          <td>{statusText}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ZONE C: Active Campaigns Tracker */}
          {activeCampaigns.length > 0 && (
            <div className="card" style={{ marginBottom: '24px' }}>
              <div className="card-title">Active Campaigns Tracker</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {activeCampaigns.map(camp => {
                  if (camp.type === 're') {
                    const scrapePct = camp.progress.total > 0 ? (camp.progress.downloaded / camp.progress.total) * 100 : 0;
                    const analyzePct = camp.progress.total > 0 ? (camp.progress.analyzed / camp.progress.total) * 100 : 0;
                    
                    return (
                      <div key={camp.id} style={{ border: '1px solid var(--border)', padding: '16px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-dark)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <h4 style={{ margin: 0 }}>📦 [RE] {camp.name}</h4>
                          <span style={{ fontSize: '0.85rem', color: 'var(--accent-light)' }}>Status: {camp.status}</span>
                        </div>
                        <div style={{ marginBottom: '8px' }}>
                          <div style={{ fontSize: '0.85rem', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Progres Scrape</span>
                            <span>{camp.progress.downloaded} / {camp.progress.total} Downloaded</span>
                          </div>
                          <div style={{ width: '100%', height: '8px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${scrapePct}%`, height: '100%', background: 'var(--success)', transition: 'width 0.3s' }}></div>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Progres Analyze</span>
                            <span>{camp.progress.analyzed} / {camp.progress.total} Analyzed</span>
                          </div>
                          <div style={{ width: '100%', height: '8px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${analyzePct}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s' }}></div>
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div key={camp.id} style={{ border: '1px solid var(--border)', padding: '16px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-dark)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <h4 style={{ margin: 0 }}>🎬 [GLabs] {camp.name}</h4>
                          <span style={{ fontSize: '0.85rem', color: 'var(--accent-light)' }}>Status: {camp.status}</span>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Progres Render</span>
                            <span>Batch: {camp.progress.batch}</span>
                          </div>
                          <div style={{ width: '100%', height: '8px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `100%`, height: '100%', background: 'var(--success)', transition: 'width 0.3s' }}></div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            </div>
          )}

          {/* ZONE G-LABS: G-Labs Tasks Audit Trail */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-title">🤖 G-Labs Task Audit Trail</div>
            <div className="table-responsive">
              <table className="table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Task ID</th>
                    <th>Campaign</th>
                    <th>Source URL</th>
                    <th style={{ textAlign: 'center' }}>Clip</th>
                    <th>Prompt</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th>Result Video</th>
                    <th>Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {glabsTasks.length === 0 ? (
                    <tr><td colSpan="8" style={{ textAlign: 'center' }}>Tidak ada log tugas G-Labs</td></tr>
                  ) : (
                    glabsTasks.map(task => {
                      const statusColor = task.status === 'completed' ? 'var(--success)' : 
                                          task.status === 'failed' ? 'var(--danger)' : 'var(--accent-light)';
                      const statusBg = task.status === 'completed' ? 'rgba(46, 213, 115, 0.1)' : 
                                       task.status === 'failed' ? 'rgba(255, 71, 87, 0.1)' : 'rgba(52, 152, 219, 0.1)';
                      
                      return (
                        <tr key={task.task_id}>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{task.task_id}</td>
                          <td>
                            {task.campaign_name ? (
                              <a href={`/re-campaigns/${task.campaign_id}`} className="link" style={{ fontWeight: '600' }}>
                                {task.campaign_name}
                              </a>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Direct / Webhook API</span>
                            )}
                          </td>
                          <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {task.source_url ? (
                              <a href={task.source_url} target="_blank" rel="noopener noreferrer" className="link" title={task.source_url}>
                                {task.source_url}
                              </a>
                            ) : '-'}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                            {task.clip_index !== null ? `#${task.clip_index + 1}` : '-'}
                          </td>
                          <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={task.prompt}>
                            {task.prompt}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              background: statusBg,
                              color: statusColor,
                              textTransform: 'uppercase',
                              display: 'inline-block'
                            }}>
                              {task.status}
                            </span>
                          </td>
                          <td>
                            {task.video_url ? (
                              <a 
                                href={task.video_url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="btn btn-sm btn-primary"
                                style={{ padding: '2px 8px', fontSize: '0.75rem', textDecoration: 'none', display: 'inline-block' }}
                              >
                                🎬 Watch Video
                              </a>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>-</span>
                            )}
                          </td>
                          <td>
                            {new Date(task.created_at).toLocaleString('id-ID')}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ZONE D: Detailed Audit Trail */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Detailed Audit Trail</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select className="form-input" style={{ width: 'auto', padding: '4px 8px' }} value={queueFilter} onChange={e => {setQueueFilter(e.target.value); setPage(1);}}>
                  <option value="all">All Queues</option>
                  {Object.keys(queuesMap).map(q => <option key={q} value={q}>{q}</option>)}
                </select>
                <select className="form-input" style={{ width: 'auto', padding: '4px 8px' }} value={statusFilter} onChange={e => {setStatusFilter(e.target.value); setPage(1);}}>
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="running">Running</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </div>
            
            <div className="table-responsive">
              <table className="table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Queue</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Error Note</th>
                    <th>Timestamp</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {jobsLoading && jobsData.jobs.length === 0 ? (
                    <tr><td colSpan="7" style={{textAlign:'center'}}>Loading...</td></tr>
                  ) : jobsData.jobs.length === 0 ? (
                    <tr><td colSpan="7" style={{textAlign:'center'}}>Tidak ada data</td></tr>
                  ) : (
                    jobsData.jobs.map(job => (
                      <tr key={job.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }} title={job.payload}>{job.id}</td>
                        <td>{job.queue_name}</td>
                        <td>
                          <span style={{ 
                            padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem',
                            background: job.status === 'completed' ? 'rgba(46, 213, 115, 0.1)' : 
                                       job.status === 'failed' ? 'rgba(255, 71, 87, 0.1)' : 'rgba(255, 255, 255, 0.1)',
                            color: job.status === 'completed' ? 'var(--success)' : 
                                   job.status === 'failed' ? 'var(--danger)' : 'var(--text-secondary)'
                          }}>
                            {job.status}
                          </span>
                        </td>
                        <td>{job.attempts}/{job.max_attempts}</td>
                        <td style={{ color: 'var(--danger)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={job.error_note}>
                          {job.error_note || '-'}
                        </td>
                        <td>{new Date(job.completed_at || job.started_at || job.created_at).toLocaleString('id-ID')}</td>
                        <td>
                          {job.status === 'failed' && (
                            <button 
                              className="btn btn-sm btn-secondary" 
                              style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                              onClick={() => handleRetry(job.id)}
                              disabled={retrying[job.id]}
                            >
                              {retrying[job.id] ? '⏳' : '🔄 Retry'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Total {jobsData.total} jobs
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn btn-sm btn-secondary" 
                  disabled={page <= 1} 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  &lt; Prev
                </button>
                <button 
                  className="btn btn-sm btn-secondary" 
                  disabled={page * limit >= jobsData.total} 
                  onClick={() => setPage(p => p + 1)}
                >
                  Next &gt;
                </button>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
