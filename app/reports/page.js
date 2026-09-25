'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/app/components/Sidebar';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('token_meter'); // 'token_meter' or 'jobs_overview'

  // Standard Reports Data
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

  // AI Token Meter Data
  const [tokenReport, setTokenReport] = useState(null);
  const [tokenLogs, setTokenLogs] = useState([]);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [tokenSubTab, setTokenSubTab] = useState('features'); // 'features' | 'models' | 'logs' | 'simulator'

  const currentYearMonth = () => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  };
  const [selectedPeriod, setSelectedPeriod] = useState(currentYearMonth());

  // Simulator State
  const [simModel, setSimModel] = useState('gemini-3.6-flash');
  const [simVideoCount, setSimVideoCount] = useState(100);
  const [simVariasiCount, setSimVariasiCount] = useState(3);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [page, queueFilter, statusFilter]);

  useEffect(() => {
    fetchTokenUsage();
  }, [selectedPeriod]);

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

  async function fetchTokenUsage() {
    setTokenLoading(true);
    try {
      const res = await fetch(`/api/reports/token-usage?period=${selectedPeriod}&limit=20`);
      const json = await res.json();
      if (json.success) {
        setTokenReport(json.report);
        setTokenLogs(json.recentLogs || []);
      }
    } catch (e) {
      console.error('[Token Usage Fetch Error]', e);
    } finally {
      setTokenLoading(false);
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

  // Calculate simulation values
  const promptPerItem = 4200;
  const outputPerItem = 1800 * (simVariasiCount / 3);
  const totalSimPrompt = promptPerItem * simVideoCount;
  const totalSimOutput = outputPerItem * simVideoCount;
  const totalSimTokens = totalSimPrompt + totalSimOutput;

  let simInputRate = 0.25;
  let simOutputRate = 0.75;
  if (simModel === 'gemini-1.5-flash-8b') {
    simInputRate = 0.075;
    simOutputRate = 0.30;
  } else if (simModel === 'gemini-3.8-flash') {
    simInputRate = 0.30;
    simOutputRate = 0.90;
  } else if (simModel === 'gemini-3.1-pro') {
    simInputRate = 1.75;
    simOutputRate = 7.00;
  }
  const simCostUsd = ((totalSimPrompt / 1000000) * simInputRate) + ((totalSimOutput / 1000000) * simOutputRate);
  const simCostIdr = simCostUsd * 16000;

  if (loading && !data) {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <div className="page-container" style={{ padding: '32px', color: 'var(--text-secondary)' }}>
            Memuat data Reports &amp; Analytics...
          </div>
        </main>
      </div>
    );
  }

  const { executiveSummary, queueMonitor = [], activeCampaigns = [], glabsTasks = [] } = data || {};

  const queuesMap = {};
  for (const item of queueMonitor) {
    if (!queuesMap[item.queue_name]) queuesMap[item.queue_name] = { pending: 0, running: 0, completed: 0, failed: 0 };
    queuesMap[item.queue_name][item.status] = item.count;
  }

  const tokenSummary = tokenReport?.summary || {
    totalCalls: 0,
    totalPromptTokens: 0,
    totalCandidatesTokens: 0,
    totalCachedTokens: 0,
    totalTokens: 0,
    totalCostUsd: 0,
    totalCostIdr: 0,
    avgTokensPerCall: 0
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content" style={{ overflowY: 'auto', height: '100vh', background: 'var(--canvas)' }}>
        <div className="page-container" style={{ padding: '28px 32px', maxWidth: '1280px', margin: '0 auto' }}>
          
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                📊 Analytics &amp; Reports
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Monitoring pemakaian token AI, estimasi biaya Paid Tier, serta observabilitas antrean sistem.
              </p>
            </div>

            {/* Main Navigation Tabs */}
            <div style={{ display: 'flex', gap: '8px', background: 'var(--surface-raised)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <button
                onClick={() => setActiveTab('token_meter')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeTab === 'token_meter' ? 'var(--action-primary)' : 'transparent',
                  color: activeTab === 'token_meter' ? 'var(--on-action-primary)' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                ⚡ AI Token &amp; Cost Meter
              </button>
              <button
                onClick={() => setActiveTab('jobs_overview')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeTab === 'jobs_overview' ? 'var(--action-primary)' : 'transparent',
                  color: activeTab === 'jobs_overview' ? 'var(--on-action-primary)' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                🔄 Scheduler &amp; Campaign Jobs
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: AI TOKEN & COST METER                                             */}
          {/* ========================================================================= */}
          {activeTab === 'token_meter' && (
            <div>
              {/* Filter Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px', padding: '14px 18px', background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Periode Bulan:</span>
                  <select
                    value={selectedPeriod}
                    onChange={e => setSelectedPeriod(e.target.value)}
                    style={{
                      background: 'var(--surface-raised)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      padding: '6px 12px',
                      fontSize: '13px',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="2026-09">September 2026 (Bulan Ini)</option>
                    <option value="2026-08">Agustus 2026</option>
                    <option value="2026-07">Juli 2026</option>
                    <option value="2026-06">Juni 2026</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', padding: '4px 10px', background: 'var(--status-info-soft)', color: 'var(--status-info)', borderRadius: '999px', fontWeight: 700 }}>
                    Paid Tier (Pay-As-You-Go)
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Kurs: $1 = Rp 16.000
                  </span>
                  <button
                    onClick={fetchTokenUsage}
                    style={{
                      background: 'var(--surface-raised)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                    title="Segarkan data token"
                  >
                    🔄 Refresh
                  </button>
                </div>
              </div>

              {/* 4 Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {/* Card 1: Total Tokens */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '20px', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '16px', right: '16px', fontSize: '20px', padding: '6px', background: 'var(--surface-interactive)', borderRadius: '8px' }}>🪙</div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                    Total Token Terpakai (MTD)
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                    {tokenSummary.totalTokens.toLocaleString()}
                  </div>
                  <div style={{ marginTop: '8px', display: 'flex', gap: '6px', fontSize: '11px' }}>
                    <span style={{ background: 'var(--status-info-soft)', color: 'var(--status-info)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                      Input: {tokenSummary.totalPromptTokens.toLocaleString()}
                    </span>
                    <span style={{ background: 'var(--status-neutral-soft)', color: 'var(--status-neutral)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                      Output: {tokenSummary.totalCandidatesTokens.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Card 2: Estimated Cost */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '20px', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '16px', right: '16px', fontSize: '20px', padding: '6px', background: 'var(--surface-interactive)', borderRadius: '8px' }}>💰</div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                    Estimasi Biaya Paid Tier
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--status-success)', fontFamily: 'monospace' }}>
                    ${tokenSummary.totalCostUsd.toFixed(4)}{' '}
                    <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 600 }}>
                      (~Rp {Math.round(tokenSummary.totalCostIdr).toLocaleString('id-ID')})
                    </span>
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Rata-rata: ${tokenSummary.totalCalls > 0 ? (tokenSummary.totalCostUsd / tokenSummary.totalCalls).toFixed(4) : '0.0000'} / request
                  </div>
                </div>

                {/* Card 3: Total AI Calls */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '20px', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '16px', right: '16px', fontSize: '20px', padding: '6px', background: 'var(--surface-interactive)', borderRadius: '8px' }}>🚀</div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                    Total Panggilan AI (API Calls)
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                    {tokenSummary.totalCalls.toLocaleString()} Calls
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Rata-rata: {tokenSummary.avgTokensPerCall.toLocaleString()} Tokens / Call
                  </div>
                </div>

                {/* Card 4: Cached Tokens */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '20px', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '16px', right: '16px', fontSize: '20px', padding: '6px', background: 'var(--surface-interactive)', borderRadius: '8px' }}>🛡️</div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                    Hemat Context Caching
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--status-warning)', fontFamily: 'monospace' }}>
                    {tokenSummary.totalCachedTokens.toLocaleString()}
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--status-success)', fontWeight: 600 }}>
                    Hemat ~${((tokenSummary.totalCachedTokens / 1000000) * 0.25 * 0.75).toFixed(4)} biaya input
                  </div>
                </div>
              </div>

              {/* Sub-Tabs Selector */}
              <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '20px' }}>
                <button
                  onClick={() => setTokenSubTab('features')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '10px 16px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    color: tokenSubTab === 'features' ? 'var(--action-primary)' : 'var(--text-muted)',
                    borderBottom: tokenSubTab === 'features' ? '3px solid var(--action-primary)' : '3px solid transparent'
                  }}
                >
                  📦 Breakdown per Fitur
                </button>
                <button
                  onClick={() => setTokenSubTab('models')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '10px 16px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    color: tokenSubTab === 'models' ? 'var(--action-primary)' : 'var(--text-muted)',
                    borderBottom: tokenSubTab === 'models' ? '3px solid var(--action-primary)' : '3px solid transparent'
                  }}
                >
                  🧠 Breakdown per Model AI
                </button>
                <button
                  onClick={() => setTokenSubTab('logs')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '10px 16px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    color: tokenSubTab === 'logs' ? 'var(--action-primary)' : 'var(--text-muted)',
                    borderBottom: tokenSubTab === 'logs' ? '3px solid var(--action-primary)' : '3px solid transparent'
                  }}
                >
                  📜 Log Transaksi Terakhir
                </button>
                <button
                  onClick={() => setTokenSubTab('simulator')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '10px 16px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    color: tokenSubTab === 'simulator' ? 'var(--action-primary)' : 'var(--text-muted)',
                    borderBottom: tokenSubTab === 'simulator' ? '3px solid var(--action-primary)' : '3px solid transparent'
                  }}
                >
                  🧮 Kalkulator Simulasi Biaya
                </button>
              </div>

              {/* Sub-Tab Content */}
              {tokenSubTab === 'features' && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '20px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>
                    Distribusi Penggunaan Token per Modul Generator
                  </h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                          <th style={{ padding: '10px 14px' }}>Fitur / Modul</th>
                          <th style={{ padding: '10px 14px' }}>Panggilan API</th>
                          <th style={{ padding: '10px 14px' }}>Input Tokens</th>
                          <th style={{ padding: '10px 14px' }}>Output Tokens</th>
                          <th style={{ padding: '10px 14px' }}>Total Tokens</th>
                          <th style={{ padding: '10px 14px' }}>Porsi (%)</th>
                          <th style={{ padding: '10px 14px' }}>Estimasi Biaya</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(!tokenReport?.featureBreakdown || tokenReport.featureBreakdown.length === 0) ? (
                          <tr><td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada rekaman transaksi AI untuk periode ini.</td></tr>
                        ) : (
                          tokenReport.featureBreakdown.map(f => (
                            <tr key={f.featureName} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {f.featureName}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <span style={{ padding: '2px 8px', background: 'var(--surface-interactive)', borderRadius: '999px', fontSize: '11px', fontWeight: 700 }}>
                                  {f.callCount} Calls
                                </span>
                              </td>
                              <td style={{ padding: '12px 14px', fontFamily: 'monospace' }}>{f.promptTokens.toLocaleString()}</td>
                              <td style={{ padding: '12px 14px', fontFamily: 'monospace' }}>{f.candidatesTokens.toLocaleString()}</td>
                              <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700 }}>{f.totalTokens.toLocaleString()}</td>
                              <td style={{ padding: '12px 14px', minWidth: '120px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>{f.sharePercentage}%</div>
                                <div style={{ width: '100%', height: '6px', background: 'var(--surface-raised)', borderRadius: '4px', overflow: 'hidden' }}>
                                  <div style={{ width: `${f.sharePercentage}%`, height: '100%', background: 'var(--action-primary)' }}></div>
                                </div>
                              </td>
                              <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: 'var(--status-success)', fontWeight: 700 }}>
                                ${f.costUsd.toFixed(4)} (~Rp {Math.round(f.costIdr).toLocaleString('id-ID')})
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tokenSubTab === 'models' && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '20px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>
                    Katalog Model Riil MAKNA Flow &amp; Tarif Resmi Paid Tier
                  </h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                          <th style={{ padding: '10px 14px' }}>Model Gemini</th>
                          <th style={{ padding: '10px 14px' }}>Peran di MAKNA Flow</th>
                          <th style={{ padding: '10px 14px' }}>Tarif Input / 1M</th>
                          <th style={{ padding: '10px 14px' }}>Tarif Output / 1M</th>
                          <th style={{ padding: '10px 14px' }}>Panggilan Bulan Ini</th>
                          <th style={{ padding: '10px 14px' }}>Total Token</th>
                          <th style={{ padding: '10px 14px' }}>Total Biaya</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(!tokenReport?.modelBreakdown || tokenReport.modelBreakdown.length === 0) ? (
                          <tr><td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada data pemakaian model.</td></tr>
                        ) : (
                          tokenReport.modelBreakdown.map(m => (
                            <tr key={m.modelName} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {m.modelName}
                              </td>
                              <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                                {m.role || '-'}
                              </td>
                              <td style={{ padding: '12px 14px', fontFamily: 'monospace' }}>${m.inputRate} (~Rp {m.inputRate * 16000})</td>
                              <td style={{ padding: '12px 14px', fontFamily: 'monospace' }}>${m.outputRate} (~Rp {m.outputRate * 16000})</td>
                              <td style={{ padding: '12px 14px' }}>
                                <span style={{ padding: '2px 8px', background: 'var(--surface-interactive)', borderRadius: '999px', fontSize: '11px', fontWeight: 700 }}>
                                  {m.callCount} Calls
                                </span>
                              </td>
                              <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700 }}>{m.totalTokens.toLocaleString()}</td>
                              <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: 'var(--status-success)', fontWeight: 700 }}>
                                ${m.costUsd.toFixed(4)} (~Rp {Math.round(m.costIdr).toLocaleString('id-ID')})
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tokenSubTab === 'logs' && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '20px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>
                    Riwayat Transaksi Token Terakhir (Live Feed)
                  </h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                          <th style={{ padding: '10px 14px' }}>Waktu</th>
                          <th style={{ padding: '10px 14px' }}>Fitur</th>
                          <th style={{ padding: '10px 14px' }}>Model</th>
                          <th style={{ padding: '10px 14px' }}>Prompt Tokens</th>
                          <th style={{ padding: '10px 14px' }}>Output Tokens</th>
                          <th style={{ padding: '10px 14px' }}>Cached Tokens</th>
                          <th style={{ padding: '10px 14px' }}>Total Tokens</th>
                          <th style={{ padding: '10px 14px' }}>Estimasi Biaya</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tokenLogs.length === 0 ? (
                          <tr><td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada log transaksi AI.</td></tr>
                        ) : (
                          tokenLogs.map(log => (
                            <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                {new Date(log.createdAt).toLocaleTimeString('id-ID')}
                              </td>
                              <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>{log.featureName}</td>
                              <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{log.modelName}</td>
                              <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{log.promptTokens.toLocaleString()}</td>
                              <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{log.candidatesTokens.toLocaleString()}</td>
                              <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: 'var(--status-warning)' }}>{log.cachedTokens > 0 ? log.cachedTokens.toLocaleString() : '-'}</td>
                              <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700 }}>{log.totalTokens.toLocaleString()}</td>
                              <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: 'var(--status-success)', fontWeight: 700 }}>
                                ${log.costUsd.toFixed(5)} (~Rp {log.costIdr.toFixed(0)})
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tokenSubTab === 'simulator' && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '24px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
                    🧮 Kalkulator Simulasi Proyeksi Biaya API Bulanan
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                    Simulasikan perkiraan pemakaian token dan tagihan Google AI Studio berdasarkan rencana kuota produksi konten Anda.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                    <div>
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '6px' }}>
                          Model yang Digunakan:
                        </label>
                        <select
                          value={simModel}
                          onChange={e => setSimModel(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            background: 'var(--surface-raised)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '8px',
                            color: 'var(--text-primary)',
                            fontSize: '13px',
                            outline: 'none'
                          }}
                        >
                          <option value="gemini-3.6-flash">gemini-3.6-flash ($0.25/1M in, $0.75/1M out) — Workhorse Utama</option>
                          <option value="gemini-3.8-flash">gemini-3.8-flash ($0.30/1M in, $0.90/1M out) — High-Speed Turbo</option>
                          <option value="gemini-1.5-flash-8b">gemini-1.5-flash-8b ($0.075/1M in, $0.30/1M out) — Scraper/Lite</option>
                          <option value="gemini-3.1-pro">gemini-3.1-pro ($1.75/1M in, $7.00/1M out) — Deep Reasoning</option>
                        </select>
                      </div>

                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Jumlah Konten / Video per Bulan:</label>
                          <span style={{ color: 'var(--action-primary)', fontWeight: 700, fontSize: '13px' }}>{simVideoCount} Konten</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="1000"
                          step="10"
                          value={simVideoCount}
                          onChange={e => setSimVideoCount(Number(e.target.value))}
                          style={{ width: '100%', accentColor: 'var(--action-primary)', cursor: 'pointer' }}
                        />
                      </div>

                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Rata-rata Resep / Variasi per Konten:</label>
                          <span style={{ color: 'var(--action-primary)', fontWeight: 700, fontSize: '13px' }}>{simVariasiCount} Resep</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          step="1"
                          value={simVariasiCount}
                          onChange={e => setSimVariasiCount(Number(e.target.value))}
                          style={{ width: '100%', accentColor: 'var(--action-primary)', cursor: 'pointer' }}
                        />
                      </div>
                    </div>

                    <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>
                        Estimasi Tagihan Google AI Studio Bulanan:
                      </div>
                      <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--status-success)', fontFamily: 'monospace' }}>
                        ${simCostUsd.toFixed(2)}
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                        ~Rp {Math.round(simCostIdr).toLocaleString('id-ID')} / Bulan
                      </div>
                      <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        Total proyeksi konsumsi: <strong style={{ color: 'var(--text-primary)' }}>{totalSimTokens.toLocaleString()} Token</strong> (~{Math.round(totalSimTokens / simVideoCount).toLocaleString()} token / konten lengkap).
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: SCHEDULER & CAMPAIGN JOBS                                          */}
          {/* ========================================================================= */}
          {activeTab === 'jobs_overview' && (
            <div>
              {/* ZONE A: Executive Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔋</div>
                  <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>API Pool Health</h3>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                    {executiveSummary?.apiPool?.used} / {executiveSummary?.apiPool?.total} Calls Used
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--status-success)' }}>Aman - Kuota Tersedia</div>
                </div>

                <div className="card" style={{ padding: '20px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎯</div>
                  <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Global Success Rate</h3>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                    {((executiveSummary?.successRate || 0) * 100).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Dari total {executiveSummary?.totalJobs || 0} Job</div>
                </div>

                <div className="card" style={{ padding: '20px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⏱️</div>
                  <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Avg Processing Time</h3>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                    {(executiveSummary?.avgProcessingTimeSec || 0).toFixed(1)} Detik / Job
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Rata-rata Keseluruhan</div>
                </div>
              </div>

              {/* ZONE B: Queue Live Monitor */}
              <div className="card" style={{ marginBottom: '24px', background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>Queue Live Monitor</div>
                <div className="table-responsive" style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                        <th style={{ padding: '10px 14px' }}>Nama Antrean (Queue)</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>PENDING</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>RUNNING</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>COMPLETED</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>FAILED</th>
                        <th style={{ padding: '10px 14px' }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(queuesMap).length === 0 ? (
                        <tr><td colSpan="6" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>Belum ada data antrean</td></tr>
                      ) : (
                        Object.keys(queuesMap).map(queueName => {
                          const q = queuesMap[queueName];
                          let statusText = '🟢 Aman';
                          if (q.failed > 0) statusText = '🔴 Ada Error';
                          else if (q.running > 0) statusText = '🟡 Memproses';
                          else if (q.pending > 0) statusText = '🔵 Menunggu';

                          return (
                            <tr key={queueName} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '10px 14px' }}><strong>{queueName}</strong></td>
                              <td style={{ textAlign: 'center', padding: '10px 14px' }}>{q.pending}</td>
                              <td style={{ textAlign: 'center', padding: '10px 14px' }}>{q.running}</td>
                              <td style={{ textAlign: 'center', padding: '10px 14px', color: 'var(--status-success)' }}>{q.completed}</td>
                              <td style={{ textAlign: 'center', padding: '10px 14px', color: q.failed > 0 ? 'var(--status-danger)' : 'inherit' }}>{q.failed}</td>
                              <td style={{ padding: '10px 14px' }}>{statusText}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ZONE D: Jobs History */}
              <div className="card" style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Scheduler Job Audit Trail</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      value={queueFilter}
                      onChange={e => { setQueueFilter(e.target.value); setPage(1); }}
                      style={{ padding: '6px 12px', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '12px' }}
                    >
                      <option value="all">Semua Queue</option>
                      {Object.keys(queuesMap).map(q => <option key={q} value={q}>{q}</option>)}
                    </select>
                    <select
                      value={statusFilter}
                      onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                      style={{ padding: '6px 12px', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '12px' }}
                    >
                      <option value="all">Semua Status</option>
                      <option value="pending">Pending</option>
                      <option value="running">Running</option>
                      <option value="completed">Completed</option>
                      <option value="failed">Failed</option>
                    </select>
                  </div>
                </div>

                <div className="table-responsive" style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                        <th style={{ padding: '10px 14px' }}>Job ID</th>
                        <th style={{ padding: '10px 14px' }}>Queue</th>
                        <th style={{ padding: '10px 14px' }}>Status</th>
                        <th style={{ padding: '10px 14px' }}>Attempts</th>
                        <th style={{ padding: '10px 14px' }}>Error Info</th>
                        <th style={{ padding: '10px 14px' }}>Timestamp</th>
                        <th style={{ padding: '10px 14px' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobsData.jobs.length === 0 ? (
                        <tr><td colSpan="7" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>Tidak ada data job</td></tr>
                      ) : (
                        jobsData.jobs.map(job => (
                          <tr key={job.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ fontFamily: 'monospace', padding: '10px 14px' }}>{job.id}</td>
                            <td style={{ padding: '10px 14px' }}>{job.queue_name}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{
                                padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                                background: job.status === 'completed' ? 'var(--status-success-soft)' :
                                           job.status === 'failed' ? 'var(--status-danger-soft)' : 'var(--surface-interactive)',
                                color: job.status === 'completed' ? 'var(--status-success)' :
                                       job.status === 'failed' ? 'var(--status-danger)' : 'var(--text-secondary)'
                              }}>
                                {job.status}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px' }}>{job.attempts}/{job.max_attempts}</td>
                            <td style={{ color: 'var(--status-danger)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '10px 14px' }} title={job.error_note}>
                              {job.error_note || '-'}
                            </td>
                            <td style={{ padding: '10px 14px' }}>{new Date(job.completed_at || job.started_at || job.created_at).toLocaleString('id-ID')}</td>
                            <td style={{ padding: '10px 14px' }}>
                              {job.status === 'failed' && (
                                <button
                                  style={{ padding: '2px 8px', fontSize: '11px', background: 'var(--surface-interactive)', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: 'var(--text-primary)', cursor: 'pointer' }}
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
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Total {jobsData.total} jobs
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      style={{ padding: '4px 10px', fontSize: '12px', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
                    >
                      &lt; Prev
                    </button>
                    <button
                      disabled={page * limit >= jobsData.total}
                      onClick={() => setPage(p => p + 1)}
                      style={{ padding: '4px 10px', fontSize: '12px', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', cursor: page * limit >= jobsData.total ? 'not-allowed' : 'pointer' }}
                    >
                      Next &gt;
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
