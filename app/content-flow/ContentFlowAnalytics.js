'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

const CalendarIcon = ({ style }) => (
  <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 002-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const DownloadIcon = ({ style }) => (
  <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const AlertTriangleIcon = ({ style }) => (
  <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const CheckCircleIcon = ({ style }) => (
  <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const FilterIcon = ({ style }) => (
  <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
  </svg>
);

const RefreshIcon = ({ style }) => (
  <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

function getTodayString() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

function get30DaysAgoString() {
  const dt = new Date();
  dt.setDate(dt.getDate() - 29);
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(dt);
}

export default function ContentFlowAnalytics({ accountQuery = 'all' }) {
  const [draftFilters, setDraftFilters] = useState({
    range: '30d',
    dateDimension: 'production',
    dateFrom: get30DaysAgoString(),
    dateTo: getTodayString(),
    account: accountQuery,
    pipelineStatus: 'all'
  });

  const [activeFilters, setActiveFilters] = useState({ ...draftFilters });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (accountQuery && accountQuery !== draftFilters.account) {
      setDraftFilters(prev => ({ ...prev, account: accountQuery }));
      setActiveFilters(prev => ({ ...prev, account: accountQuery }));
    }
  }, [accountQuery]);

  const loadReport = useCallback(async (filtersToUse, signal) => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams();
      queryParams.set('range', filtersToUse.range);
      queryParams.set('date_dimension', filtersToUse.dateDimension);
      queryParams.set('account', filtersToUse.account);
      queryParams.set('pipeline_status', filtersToUse.pipelineStatus);

      if (filtersToUse.range === 'custom') {
        queryParams.set('date_from', filtersToUse.dateFrom);
        queryParams.set('date_to', filtersToUse.dateTo);
      }

      const res = await fetch(`/api/content-flow/reporting?${queryParams.toString()}`, { signal });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal memuat data analytics.');
      }

      setReport(data);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('[ContentFlowAnalytics Error]', err);
      setError(err.message || 'Terjadi kesalahan saat menghubungi server reporting.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadReport(activeFilters, controller.signal);
    return () => controller.abort();
  }, [activeFilters, loadReport]);

  const handleApplyFilters = (e) => {
    if (e) e.preventDefault();
    setActiveFilters({ ...draftFilters });
  };

  const exportCSV = useCallback(() => {
    if (!report || !report.brands) return;

    const headers = [
      'Brand',
      'Total Aset',
      'Published Minimal 1',
      'Belum Tayang',
      'TikTok Published',
      'Facebook Published',
      'Instagram Published',
      'YouTube Published',
      'Coverage (%)'
    ];

    const rows = report.brands.map(b => [
      `"${(b.brand || '').replace(/"/g, '""')}"`,
      b.total_assets,
      b.published_any_assets,
      b.never_published_assets,
      b.tiktok,
      b.facebook,
      b.instagram,
      b.youtube,
      b.coverage_percent
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `content_flow_analytics_${activeFilters.account}_${activeFilters.range}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [report, activeFilters]);

  // Max value calculation for timeline trend chart bars
  const maxTimelineVal = useMemo(() => {
    if (!report || !report.timeline || report.timeline.length === 0) return 1;
    return Math.max(...report.timeline.map(t => Math.max(t.produced, t.published)), 1);
  }, [report]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Filter Control Section */}
      <form onSubmit={handleApplyFilters} aria-label="Filter Analytics" style={{
        padding: '20px',
        borderRadius: '16px',
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-card)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FilterIcon style={{ width: 18, height: 18, color: 'var(--action-primary)' }} />
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Filter & Parameter Reporting
            </h2>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={exportCSV}
              disabled={loading || !report}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: '1px solid var(--border-strong)',
                background: 'var(--surface-interactive)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: loading || !report ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <DownloadIcon style={{ width: 14, height: 14 }} />
              <span>Export CSV</span>
            </button>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '8px 20px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--action-primary)',
                color: 'var(--on-action-primary)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RefreshIcon style={{ width: 14, height: 14 }} />
              <span>Terapkan Filter</span>
            </button>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '14px',
          alignItems: 'end'
        }}>
          {/* Preset Rentang Waktu */}
          <div>
            <label htmlFor="filter-range" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              Rentang Waktu
            </label>
            <select
              id="filter-range"
              value={draftFilters.range}
              onChange={(e) => setDraftFilters(prev => ({ ...prev, range: e.target.value }))}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '10px',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              <option value="7d">7 Hari Terakhir</option>
              <option value="30d">30 Hari Terakhir</option>
              <option value="this_month">Bulan Ini</option>
              <option value="last_month">Bulan Lalu</option>
              <option value="all">Semua Data (Global)</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Custom Date From & To */}
          {draftFilters.range === 'custom' && (
            <>
              <div>
                <label htmlFor="filter-date-from" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Dari Tanggal
                </label>
                <input
                  id="filter-date-from"
                  type="date"
                  value={draftFilters.dateFrom}
                  onChange={(e) => setDraftFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '13px'
                  }}
                />
              </div>
              <div>
                <label htmlFor="filter-date-to" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Sampai Tanggal
                </label>
                <input
                  id="filter-date-to"
                  type="date"
                  value={draftFilters.dateTo}
                  onChange={(e) => setDraftFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '13px'
                  }}
                />
              </div>
            </>
          )}

          {/* Dimensi Tanggal */}
          <div>
            <label htmlFor="filter-dimension" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              Dimensi Tanggal
            </label>
            <select
              id="filter-dimension"
              value={draftFilters.dateDimension}
              onChange={(e) => setDraftFilters(prev => ({ ...prev, dateDimension: e.target.value }))}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '10px',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              <option value="production">Tanggal Produksi (Target/Created)</option>
              <option value="publish">Tanggal Publish (Kanal Sosial)</option>
            </select>
          </div>

          {/* Filter Brand */}
          <div>
            <label htmlFor="filter-account" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              Brand Account
            </label>
            <select
              id="filter-account"
              value={draftFilters.account}
              onChange={(e) => setDraftFilters(prev => ({ ...prev, account: e.target.value }))}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '10px',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              <option value="all">Semua Brand</option>
              {report?.available_accounts?.map(acc => (
                <option key={acc} value={acc}>@{acc}</option>
              ))}
            </select>
          </div>

          {/* Pipeline Status */}
          <div>
            <label htmlFor="filter-pipeline" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              Status Produksi
            </label>
            <select
              id="filter-pipeline"
              value={draftFilters.pipelineStatus}
              onChange={(e) => setDraftFilters(prev => ({ ...prev, pipelineStatus: e.target.value }))}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '10px',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              <option value="all">Semua Status Produksi</option>
              <option value="Completed">Completed Only</option>
              <option value="In Production">In Production Only</option>
            </select>
          </div>
        </div>
      </form>

      {/* Error Banner */}
      {error && (
        <div style={{
          padding: '16px 20px',
          borderRadius: '14px',
          background: 'var(--status-danger-soft)',
          border: '1px solid var(--status-danger)',
          color: 'var(--status-danger)',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangleIcon style={{ width: 20, height: 20 }} />
            <span style={{ fontSize: '14px', fontWeight: 600 }}>{error}</span>
          </div>
          <button
            onClick={() => setActiveFilters({ ...draftFilters })}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--status-danger)',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !report && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} style={{
              height: '110px',
              borderRadius: '16px',
              background: 'var(--surface)',
              border: '1px solid var(--border-subtle)',
              animation: 'pulse 1.5s infinite ease-in-out'
            }} />
          ))}
        </div>
      )}

      {/* Report Dashboard View */}
      {report && (
        <>
          {/* Anomaly Banner */}
          {report.anomalies && report.anomalies.total > 0 && (
            <div style={{
              padding: '14px 18px',
              borderRadius: '14px',
              background: 'var(--status-warning-soft)',
              border: '1px solid var(--status-warning)',
              color: 'var(--status-warning)',
              display: 'flex',
              alignItems: 'center',
              justify: 'space-between',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangleIcon style={{ width: 20, height: 20 }} />
                <span style={{ fontSize: '13px', fontWeight: 700 }}>
                  Perhatian: Ditemukan {report.anomalies.total} anomali data publikasi!
                </span>
              </div>
              <div style={{ fontSize: '12px', display: 'flex', gap: '16px', fontWeight: 600 }}>
                {report.anomalies.published_without_date > 0 && (
                  <span>Published Tanpa Tanggal: {report.anomalies.published_without_date}</span>
                )}
                {report.anomalies.date_without_published_status > 0 && (
                  <span>Tanggal Tanpa Status Published: {report.anomalies.date_without_published_status}</span>
                )}
                {report.anomalies.invalid_publish_date > 0 && (
                  <span>Format Tanggal Invalid: {report.anomalies.invalid_publish_date}</span>
                )}
              </div>
            </div>
          )}

          {/* 6 Primary KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            {/* 1. Total Video Assets */}
            <div style={{
              padding: '18px',
              borderRadius: '16px',
              background: 'var(--surface)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-card)'
            }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Total Aset Video</span>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px' }}>
                {report.summary.total_assets}
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                Video Unik dalam Scope
              </span>
            </div>

            {/* 2. Produksi Selesai */}
            <div style={{
              padding: '18px',
              borderRadius: '16px',
              background: 'var(--surface)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-card)'
            }}>
              <span style={{ fontSize: '12px', color: 'var(--status-success)', fontWeight: 600 }}>Produksi Selesai</span>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--status-success)', marginTop: '8px' }}>
                {report.summary.completed_assets}
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                Pipeline Completed
              </span>
            </div>

            {/* 3. Masih Produksi */}
            <div style={{
              padding: '18px',
              borderRadius: '16px',
              background: 'var(--surface)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-card)'
            }}>
              <span style={{ fontSize: '12px', color: 'var(--status-warning)', fontWeight: 600 }}>Masih Produksi</span>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--status-warning)', marginTop: '8px' }}>
                {report.summary.in_production_assets}
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                Pipeline In Production
              </span>
            </div>

            {/* 4. Published Minimal 1 Platform */}
            <div style={{
              padding: '18px',
              borderRadius: '16px',
              background: 'var(--surface)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-card)'
            }}>
              <span style={{ fontSize: '12px', color: 'var(--link)', fontWeight: 600 }}>Sudah Tayang (Min. 1 Platform)</span>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--link)', marginTop: '8px' }}>
                {report.summary.published_any_assets}
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                Published Any Asset
              </span>
            </div>

            {/* 5. Belum Pernah Tayang */}
            <div style={{
              padding: '18px',
              borderRadius: '16px',
              background: 'var(--surface)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-card)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--status-danger)', fontWeight: 600 }}>Belum Tayang</span>
                {report.summary.ready_unpublished_assets > 0 && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '6px',
                    background: 'var(--status-neutral-soft)',
                    color: 'var(--status-neutral)'
                  }}>
                    {report.summary.ready_unpublished_assets} Ready
                  </span>
                )}
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--status-danger)', marginTop: '8px' }}>
                {report.summary.never_published_assets}
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                Never Published
              </span>
            </div>

            {/* 6. Distribusi Lengkap (TT+FB+IG) */}
            <div style={{
              padding: '18px',
              borderRadius: '16px',
              background: 'var(--surface)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-card)'
            }}>
              <span style={{ fontSize: '12px', color: 'var(--action-primary)', fontWeight: 600 }}>Distribusi Lengkap</span>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--action-primary)', marginTop: '8px' }}>
                {report.summary.fully_distributed_assets}
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                TikTok + FB + IG Published
              </span>
            </div>
          </div>

          {/* Section: Platform Breakdown & Timeline Chart */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* Platform Post Counts */}
            <div style={{
              padding: '20px',
              borderRadius: '16px',
              background: 'var(--surface)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Publikasi per Platform (Platform Posts)
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* TikTok */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-primary)' }}>TikTok</span>
                    <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{report.platforms.tiktok} posts</span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '4px', background: 'var(--surface-interactive)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${report.summary.total_assets ? Math.min(100, (report.platforms.tiktok / report.summary.total_assets) * 100) : 0}%`,
                      background: '#00f2fe',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>

                {/* Facebook */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-primary)' }}>Facebook</span>
                    <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{report.platforms.facebook} posts</span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '4px', background: 'var(--surface-interactive)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${report.summary.total_assets ? Math.min(100, (report.platforms.facebook / report.summary.total_assets) * 100) : 0}%`,
                      background: 'var(--platform-facebook)',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>

                {/* Instagram */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-primary)' }}>Instagram</span>
                    <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{report.platforms.instagram} posts</span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '4px', background: 'var(--surface-interactive)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${report.summary.total_assets ? Math.min(100, (report.platforms.instagram / report.summary.total_assets) * 100) : 0}%`,
                      background: '#e1306c',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>

                {/* YouTube */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-primary)' }}>YouTube</span>
                    <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{report.platforms.youtube} posts</span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '4px', background: 'var(--surface-interactive)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${report.summary.total_assets ? Math.min(100, (report.platforms.youtube / report.summary.total_assets) * 100) : 0}%`,
                      background: 'var(--platform-youtube)',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline Production vs Publication Chart */}
            <div style={{
              padding: '20px',
              borderRadius: '16px',
              background: 'var(--surface)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Tren Produksi vs Publikasi
                </h3>
                <div style={{ display: 'flex', gap: '12px', fontSize: '11px', fontWeight: 600 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--status-info)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--status-info)' }} /> Produksi
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--status-success)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--status-success)' }} /> Published
                  </span>
                </div>
              </div>

              {report.timeline.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>
                  Tidak ada data tren dalam rentang waktu terpilih.
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '8px',
                  height: '160px',
                  paddingTop: '20px',
                  borderBottom: '1px solid var(--border-subtle)',
                  overflowX: 'auto'
                }}>
                  {report.timeline.map((item) => {
                    const hProd = Math.max(4, Math.round((item.produced / maxTimelineVal) * 120));
                    const hPub = Math.max(4, Math.round((item.published / maxTimelineVal) * 120));
                    return (
                      <div
                        key={item.period}
                        title={`${item.period}: Produksi ${item.produced}, Published ${item.published}`}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          flex: 1,
                          minWidth: '24px',
                          height: '100%',
                          justifyContent: 'flex-end'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px' }}>
                          <div style={{
                            width: '8px',
                            height: `${hProd}px`,
                            background: 'var(--status-info)',
                            borderRadius: '4px 4px 0 0',
                            transition: 'height 0.2s ease'
                          }} />
                          <div style={{
                            width: '8px',
                            height: `${hPub}px`,
                            background: 'var(--status-success)',
                            borderRadius: '4px 4px 0 0',
                            transition: 'height 0.2s ease'
                          }} />
                        </div>
                        <span style={{
                          fontSize: '9px',
                          color: 'var(--text-muted)',
                          marginTop: '6px',
                          whiteSpace: 'nowrap',
                          transform: 'rotate(-45deg)',
                          transformOrigin: 'top left'
                        }}>
                          {item.period.length > 7 ? item.period.slice(5) : item.period}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Section: Brand Breakdown Table */}
          <div style={{
            padding: '20px',
            borderRadius: '16px',
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Ringkasan Distribusi Konten per Brand
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {report.brands.length} Brand Terdaftar
              </span>
            </div>

            {report.brands.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>
                Tidak ada data brand yang memenuhi kriteria filter.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-strong)', color: 'var(--text-muted)' }}>
                      <th scope="col" style={{ padding: '10px 12px', fontWeight: 600 }}>Brand</th>
                      <th scope="col" style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>Total Aset</th>
                      <th scope="col" style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>Published (Min. 1)</th>
                      <th scope="col" style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>Belum Tayang</th>
                      <th scope="col" style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>TikTok</th>
                      <th scope="col" style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>Facebook</th>
                      <th scope="col" style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>Instagram</th>
                      <th scope="col" style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>YouTube</th>
                      <th scope="col" style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>Coverage %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.brands.map((b) => (
                      <tr key={b.brand} style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                        <td style={{ padding: '12px', fontWeight: 700 }}>@{b.brand}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{b.total_assets}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--status-success)' }}>{b.published_any_assets}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: b.never_published_assets > 0 ? 'var(--status-danger)' : 'var(--text-muted)' }}>{b.never_published_assets}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{b.tiktok}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{b.facebook}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{b.instagram}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{b.youtube}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: b.coverage_percent > 70 ? 'var(--status-success)' : b.coverage_percent > 40 ? 'var(--status-warning)' : 'var(--status-danger)' }}>
                          {b.coverage_percent}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
