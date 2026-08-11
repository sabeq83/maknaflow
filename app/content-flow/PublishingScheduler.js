'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';

const ClockIcon = ({ style }) => (
  <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CheckCircleIcon = ({ style }) => (
  <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const AlertCircleIcon = ({ style }) => (
  <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" strokeWidth="2" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01" />
  </svg>
);

const RefreshCwIcon = ({ style }) => (
  <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const CalendarIcon = ({ style }) => (
  <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2" />
    <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2" />
    <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2" />
    <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2" />
  </svg>
);

const XIcon = ({ style }) => (
  <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default function PublishingScheduler({ initialPreloadItem = null, onBackToLibrary = null }) {
  const [activeTab, setActiveTab] = useState('queue'); // 'queue', 'calendar', 'history'
  const [jobs, setJobs] = useState([]);
  const [metrics, setMetrics] = useState({ scheduled: 0, publishedToday: 0, retryWait: 0, needsAction: 0 });
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedJobDetail, setSelectedJobDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Filters
  const [filterAccount, setFilterAccount] = useState('all');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Pause Control State
  const [isPaused, setIsPaused] = useState(false);
  const [togglingPause, setTogglingPause] = useState(false);

  // Schedule Modal State
  const [showScheduleModal, setShowScheduleModal] = useState(Boolean(initialPreloadItem));
  const [scheduleForm, setScheduleForm] = useState({
    content_id: initialPreloadItem?.video_id || '',
    account_ids: [],
    platform: 'facebook',
    publish_mode: 'draft',
    media_type: 'video',
    caption: initialPreloadItem?.caption || '',
    media_url: initialPreloadItem?.url_asset || initialPreloadItem?.nextcloud_url || '',
    scheduled_at: new Date(Date.now() + 3600000).toISOString().slice(0, 16), // default +1 hour
    timezone: 'Asia/Jakarta'
  });
  const [submittingSchedule, setSubmittingSchedule] = useState(false);
  const [preflightResult, setPreflightResult] = useState(null);
  const [runningPreflight, setRunningPreflight] = useState(false);

  // Reschedule Modal State
  const [rescheduleModalJob, setRescheduleModalJob] = useState(null);
  const [newScheduleTime, setNewScheduleTime] = useState('');
  const [submittingReschedule, setSubmittingReschedule] = useState(false);

  // Toast
  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  // 1. Fetch Accounts
  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/publishing/accounts');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setAccounts(json.data);
      }
    } catch (err) {
      console.error('Error fetching publishing accounts:', err);
    }
  }, []);

  // 2. Fetch Jobs and Metrics
  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab === 'queue') params.set('view', 'queue');
      else if (activeTab === 'history') params.set('view', 'history');
      else params.set('view', 'all');

      if (filterAccount !== 'all') params.set('account_id', filterAccount);
      if (filterPlatform !== 'all') params.set('platform', filterPlatform);
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());

      const res = await fetch(`/api/v2/publishing/jobs?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setJobs(json.data || []);
        if (json.metrics) setMetrics(json.metrics);
        if (json.data && json.data.length > 0 && !selectedJobId) {
          setSelectedJobId(json.data[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching publishing jobs:', err);
      showToast('Gagal memuat jadwal publikasi ❌');
    } finally {
      setLoading(false);
    }
  }, [activeTab, filterAccount, filterPlatform, filterStatus, searchTerm, selectedJobId]);

  // 3. Fetch Control Status (Global Pause)
  const fetchControl = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/publishing/control');
      const json = await res.json();
      if (json.success && json.data) {
        setIsPaused(Boolean(json.data.is_paused));
      }
    } catch (err) {
      console.error('Error fetching control:', err);
    }
  }, []);

  // 4. Fetch Selected Job Detail
  useEffect(() => {
    if (!selectedJobId) {
      setSelectedJobDetail(null);
      return;
    }
    let isCurrent = true;
    setLoadingDetail(true);
    fetch(`/api/v2/publishing/jobs/${selectedJobId}`)
      .then(res => res.json())
      .then(json => {
        if (isCurrent && json.success) {
          setSelectedJobDetail(json.data);
        }
      })
      .catch(err => console.error('Error fetching job detail:', err))
      .finally(() => {
        if (isCurrent) setLoadingDetail(false);
      });

    return () => { isCurrent = false; };
  }, [selectedJobId]);

  useEffect(() => {
    fetchAccounts();
    fetchControl();
  }, [fetchAccounts, fetchControl]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Preflight Runner
  const runPreflight = async () => {
    if (!scheduleForm.account_ids.length && !scheduleForm.media_url && !scheduleForm.caption) return;
    setRunningPreflight(true);
    try {
      const res = await fetch('/api/v2/publishing/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaUrl: scheduleForm.media_url,
          mediaType: scheduleForm.media_type,
          caption: scheduleForm.caption,
          accountIds: scheduleForm.account_ids
        })
      });
      const json = await res.json();
      setPreflightResult(json);
    } catch (err) {
      console.warn('Preflight error:', err);
    } finally {
      setRunningPreflight(false);
    }
  };

  // Toggle Global Pause
  const handleTogglePause = async () => {
    setTogglingPause(true);
    try {
      const nextState = !isPaused;
      const res = await fetch('/api/v2/publishing/control', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPaused: nextState })
      });
      const json = await res.json();
      if (json.success) {
        setIsPaused(nextState);
        showToast(nextState ? 'Worker publishing berhasil dijeda ⏸️' : 'Worker publishing dilanjutkan ▶️');
      } else {
        showToast(`Gagal mengubah status: ${json.error} ❌`);
      }
    } catch (err) {
      showToast(`Error: ${err.message} ❌`);
    } finally {
      setTogglingPause(false);
    }
  };

  // Cancel Job
  const handleCancelJob = async (jobId) => {
    if (!confirm('Apakah Anda yakin ingin membatalkan jadwal publikasi ini?')) return;
    try {
      const res = await fetch(`/api/v2/publishing/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' })
      });
      const json = await res.json();
      if (json.success) {
        showToast('Jadwal publikasi berhasil dibatalkan 🚫');
        fetchJobs();
      } else {
        showToast(`Gagal membatalkan: ${json.error} ❌`);
      }
    } catch (err) {
      showToast(`Error: ${err.message} ❌`);
    }
  };

  // Retry Job
  const handleRetryJob = async (jobId) => {
    try {
      const res = await fetch(`/api/v2/publishing/jobs/${jobId}/retry`, {
        method: 'POST'
      });
      const json = await res.json();
      if (json.success) {
        showToast('Job berhasil dijadwalkan ulang untuk dicoba kembali 🔄');
        fetchJobs();
      } else {
        showToast(`Gagal retry: ${json.error} ❌`);
      }
    } catch (err) {
      showToast(`Error: ${err.message} ❌`);
    }
  };

  // Submit Reschedule
  const handleExecuteReschedule = async () => {
    if (!rescheduleModalJob || !newScheduleTime) return;
    setSubmittingReschedule(true);
    try {
      const res = await fetch(`/api/v2/publishing/jobs/${rescheduleModalJob.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reschedule',
          scheduledAt: new Date(newScheduleTime).toISOString()
        })
      });
      const json = await res.json();
      if (json.success) {
        showToast('Jadwal baru berhasil disimpan 📅');
        setRescheduleModalJob(null);
        fetchJobs();
      } else {
        showToast(`Gagal ubah jadwal: ${json.error} ❌`);
      }
    } catch (err) {
      showToast(`Error: ${err.message} ❌`);
    } finally {
      setSubmittingReschedule(false);
    }
  };

  // Submit New Schedule Form
  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!scheduleForm.content_id || !scheduleForm.account_ids.length) {
      showToast('Pilih minimal satu akun dan ID konten ⚠️');
      return;
    }
    setSubmittingSchedule(true);
    try {
      const payload = {
        content_id: scheduleForm.content_id,
        account_ids: scheduleForm.account_ids,
        platform: scheduleForm.platform,
        publish_mode: scheduleForm.publish_mode,
        media_type: scheduleForm.media_type,
        caption: scheduleForm.caption,
        media_url: scheduleForm.media_url,
        scheduled_at: new Date(scheduleForm.scheduled_at).toISOString(),
        timezone: scheduleForm.timezone
      };

      const res = await fetch('/api/v2/publishing/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (json.success) {
        showToast(`Berhasil menjadwalkan konten! 🎉`);
        setShowScheduleModal(false);
        fetchJobs();
      } else {
        showToast(`Gagal menjadwalkan: ${json.error} ❌`);
      }
    } catch (err) {
      showToast(`Error: ${err.message} ❌`);
    } finally {
      setSubmittingSchedule(false);
    }
  };

  const formatScheduleTime = (isoString, tz = 'Asia/Jakarta') => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz
    }) + ` (${tz === 'Asia/Jakarta' ? 'WIB' : tz})`;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'published':
        return <span style={{ background: '#123828', color: '#4ade80', padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }}></span>PUBLISHED</span>;
      case 'scheduled':
        return <span style={{ background: '#182b47', color: '#60a5fa', padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa' }}></span>SCHEDULED</span>;
      case 'processing':
      case 'publishing':
      case 'creating_container':
      case 'waiting_media':
        return <span style={{ background: '#2e2640', color: '#c084fc', padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c084fc' }}></span>PROCESSING</span>;
      case 'verifying':
        return <span style={{ background: '#3b2d18', color: '#fbbf24', padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fbbf24' }}></span>VERIFYING</span>;
      case 'retry_wait':
        return <span style={{ background: '#453314', color: '#fbbf24', padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fbbf24' }}></span>RETRY WAIT</span>;
      case 'failed':
        return <span style={{ background: '#481d29', color: '#fb7185', padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fb7185' }}></span>FAILED</span>;
      case 'cancelled':
        return <span style={{ background: '#27272a', color: '#a1a1aa', padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a1a1aa' }}></span>CANCELLED</span>;
      default:
        return <span style={{ background: '#27272a', color: '#a1a1aa', padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800 }}>{status}</span>;
    }
  };

  // Weekly Calendar generator
  const calendarWeek = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 is Sunday
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday);

    const days = [];
    const dayNames = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayJobs = jobs.filter(j => (j.scheduled_at || '').slice(0, 10) === dateStr);
      days.push({
        dayName: dayNames[i],
        dateNum: d.getDate(),
        dateStr,
        isToday: dateStr === today.toISOString().slice(0, 10),
        jobs: dayJobs
      });
    }
    return days;
  }, [jobs]);

  return (
    <div style={{ color: '#e5e7eb', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: '#101725', border: '1px solid #3b82f6', color: '#93c5fd',
          padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: 8
        }}>
          <CheckCircleIcon style={{ width: 18, height: 18 }} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Headline & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 850, margin: '0 0 4px', color: '#fff', letterSpacing: '-0.5px' }}>
            Publishing Scheduler
          </h2>
          <p style={{ margin: 0, color: '#748198', fontSize: 13 }}>
            Jadwalkan dan pantau publikasi Facebook & Instagram dari Content Flow secara aman dan terpantau.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {onBackToLibrary && (
            <button
              onClick={onBackToLibrary}
              style={{
                padding: '9px 15px', background: '#141d2e', border: '1px solid #334155',
                borderRadius: 8, color: '#cbd5e1', fontSize: 12, fontWeight: 750, cursor: 'pointer'
              }}
            >
              ← Kembali ke Library
            </button>
          )}
          <button
            onClick={handleTogglePause}
            disabled={togglingPause}
            style={{
              padding: '9px 15px',
              background: isPaused ? '#371923' : '#141d2e',
              border: `1px solid ${isPaused ? '#ef4444' : '#334155'}`,
              borderRadius: 8,
              color: isPaused ? '#fca5a5' : '#cbd5e1',
              fontSize: 12,
              fontWeight: 750,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <span>{isPaused ? '▶ Lanjutkan Worker' : '⏸️ Pause Worker'}</span>
          </button>
          <button
            onClick={() => setShowScheduleModal(true)}
            style={{
              padding: '9px 18px', background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
              border: '1px solid #c084fc', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 800,
              cursor: 'pointer', boxShadow: '0 4px 14px rgba(168, 85, 247, 0.35)', display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <span>＋ Jadwalkan Konten</span>
          </button>
        </div>
      </div>

      {/* 4 Card Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ background: '#111827', border: '1px solid #253046', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, color: '#728097', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Terjadwal</div>
          <div style={{ fontSize: 24, fontWeight: 850, color: '#60a5fa', marginTop: 4 }}>{metrics.scheduled}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Antrean aktif</div>
        </div>
        <div style={{ background: '#111827', border: '1px solid #253046', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, color: '#728097', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Published Hari Ini</div>
          <div style={{ fontSize: 24, fontWeight: 850, color: '#4ade80', marginTop: 4 }}>{metrics.publishedToday}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Facebook & Instagram</div>
        </div>
        <div style={{ background: '#111827', border: '1px solid #253046', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, color: '#728097', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Menunggu Retry</div>
          <div style={{ fontSize: 24, fontWeight: 850, color: '#fbbf24', marginTop: 4 }}>{metrics.retryWait}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Percobaan otomatis</div>
        </div>
        <div style={{ background: '#111827', border: '1px solid #253046', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, color: '#728097', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Perlu Tindakan</div>
          <div style={{ fontSize: 24, fontWeight: 850, color: metrics.needsAction > 0 ? '#fb7185' : '#9ca3af', marginTop: 4 }}>{metrics.needsAction}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Failed / Needs review</div>
        </div>
      </div>

      {/* Navigation Tabs & Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #263044', marginBottom: 16, flexWrap: 'wrap', gap: 6 }}>
        <button
          onClick={() => setActiveTab('queue')}
          style={{
            background: 'transparent', border: 'none',
            borderBottom: activeTab === 'queue' ? '2px solid #8b5cf6' : '2px solid transparent',
            color: activeTab === 'queue' ? '#c4b5fd' : '#718097',
            padding: '10px 16px', fontSize: 13, fontWeight: 800, cursor: 'pointer'
          }}
        >
          Antrean ({metrics.scheduled + metrics.retryWait})
        </button>
        <button
          onClick={() => setActiveTab('calendar')}
          style={{
            background: 'transparent', border: 'none',
            borderBottom: activeTab === 'calendar' ? '2px solid #8b5cf6' : '2px solid transparent',
            color: activeTab === 'calendar' ? '#c4b5fd' : '#718097',
            padding: '10px 16px', fontSize: 13, fontWeight: 800, cursor: 'pointer'
          }}
        >
          Kalender
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            background: 'transparent', border: 'none',
            borderBottom: activeTab === 'history' ? '2px solid #8b5cf6' : '2px solid transparent',
            color: activeTab === 'history' ? '#c4b5fd' : '#718097',
            padding: '10px 16px', fontSize: 13, fontWeight: 800, cursor: 'pointer'
          }}
        >
          Riwayat Publikasi
        </button>

        {/* Filters */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
            style={{ background: '#111827', border: '1px solid #2a354b', color: '#9eabc0', padding: '6px 10px', borderRadius: 7, fontSize: 12 }}
          >
            <option value="all">Semua Akun</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.display_name} ({acc.platform})</option>
            ))}
          </select>

          <select
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value)}
            style={{ background: '#111827', border: '1px solid #2a354b', color: '#9eabc0', padding: '6px 10px', borderRadius: 7, fontSize: 12 }}
          >
            <option value="all">Semua Platform</option>
            <option value="facebook">Facebook Page</option>
            <option value="instagram">Instagram</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ background: '#111827', border: '1px solid #2a354b', color: '#9eabc0', padding: '6px 10px', borderRadius: 7, fontSize: 12 }}
          >
            <option value="all">Semua Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="processing">Processing</option>
            <option value="retry_wait">Retry Wait</option>
            <option value="published">Published</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <button
            onClick={fetchJobs}
            style={{ background: '#111827', border: '1px solid #2a354b', color: '#9eabc0', padding: '6px 10px', borderRadius: 7, cursor: 'pointer' }}
            title="Refresh antrean"
          >
            <RefreshCwIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>

      {/* Tab 1: Queue & History Layout (Table + Drawer) */}
      {(activeTab === 'queue' || activeTab === 'history') && (
        <div style={{ display: 'grid', gridTemplateColumns: selectedJobDetail ? 'minmax(0, 1fr) 320px' : '1fr', gap: 14 }}>
          <div style={{ background: '#101725', border: '1px solid #253046', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ height: 46, borderBottom: '1px solid #253046', display: 'flex', alignItems: 'center', padding: '0 16px', color: '#e5e7eb', fontSize: 12, fontWeight: 800 }}>
              {activeTab === 'queue' ? 'Daftar Antrean Terjadwal' : 'Riwayat Hasil Publikasi'}
              <span style={{ color: '#68768c', fontWeight: 500, marginLeft: 8 }}>({jobs.length} item)</span>
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Memuat jadwal...</div>
            ) : jobs.length === 0 ? (
              <div style={{ padding: 50, textAlign: 'center', color: '#64748b' }}>
                Tidak ada data jadwal publikasi yang cocok dengan filter.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#0b101b' }}>
                      <th style={{ textAlign: 'left', padding: '10px 14px', color: '#65738a', fontSize: 10, textTransform: 'uppercase' }}>Konten</th>
                      <th style={{ textAlign: 'left', padding: '10px 14px', color: '#65738a', fontSize: 10, textTransform: 'uppercase' }}>Tujuan</th>
                      <th style={{ textAlign: 'left', padding: '10px 14px', color: '#65738a', fontSize: 10, textTransform: 'uppercase' }}>Jadwal / Waktu</th>
                      <th style={{ textAlign: 'left', padding: '10px 14px', color: '#65738a', fontSize: 10, textTransform: 'uppercase' }}>Status</th>
                      <th style={{ textAlign: 'right', padding: '10px 14px', color: '#65738a', fontSize: 10, textTransform: 'uppercase' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => {
                      const isSelected = selectedJobId === job.id;
                      return (
                        <tr
                          key={job.id}
                          onClick={() => setSelectedJobId(job.id)}
                          style={{
                            cursor: 'pointer',
                            background: isSelected ? '#1a233a' : 'transparent',
                            borderBottom: '1px solid #1c2638',
                            boxShadow: isSelected ? 'inset 3px 0 #8b5cf6' : 'none'
                          }}
                        >
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                              <div style={{
                                width: 40, height: 40, borderRadius: 8, background: '#1e293b',
                                display: 'grid', placeItems: 'center', color: '#a78bfa', fontWeight: 800, flexShrink: 0
                              }}>
                                {job.platform === 'facebook' ? 'f' : '◎'}
                              </div>
                              <div>
                                <div style={{ color: '#f3f4f6', fontWeight: 750, maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {job.content_title || job.content_id}
                                </div>
                                <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
                                  {job.content_id} · Mode: {job.publish_mode.toUpperCase()}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 700, color: '#d1d5db' }}>{job.account_name || 'Meta Account'}</div>
                            <div style={{ color: '#64748b', fontSize: 11 }}>{job.platform.toUpperCase()} ({job.media_type})</div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ color: '#f3f4f6', fontWeight: 700 }}>
                              {formatScheduleTime(job.scheduled_at, job.account_timezone)}
                            </div>
                            {job.next_attempt_at && job.status === 'retry_wait' && (
                              <div style={{ color: '#fbbf24', fontSize: 10, marginTop: 2 }}>
                                Retry: {formatScheduleTime(job.next_attempt_at, job.account_timezone)}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            {getStatusBadge(job.status)}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              {job.status === 'scheduled' && (
                                <>
                                  <button
                                    onClick={() => { setRescheduleModalJob(job); setNewScheduleTime(job.scheduled_at.slice(0, 16)); }}
                                    style={{ background: '#19243a', border: '1px solid #36445f', color: '#cbd5e1', padding: '5px 9px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}
                                  >
                                    Ubah
                                  </button>
                                  <button
                                    onClick={() => handleCancelJob(job.id)}
                                    style={{ background: '#371923', border: '1px solid #5b2635', color: '#fb7185', padding: '5px 9px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}
                                  >
                                    Batal
                                  </button>
                                </>
                              )}
                              {(job.status === 'failed' || job.status === 'cancelled') && (
                                <button
                                  onClick={() => handleRetryJob(job.id)}
                                  style={{ background: '#1e3a8a', border: '1px solid #3b82f6', color: '#93c5fd', padding: '5px 9px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}
                                >
                                  Retry
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Drawer Detail Panel */}
          {selectedJobDetail && (
            <aside style={{ background: '#101725', border: '1px solid #253046', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 14, color: '#fff', fontWeight: 800 }}>Detail Publikasi</h3>
                <button
                  onClick={() => setSelectedJobDetail(null)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  <XIcon style={{ width: 16, height: 16 }} />
                </button>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#637087', fontWeight: 800, textTransform: 'uppercase' }}>Konten</div>
                <div style={{ color: '#fff', fontWeight: 750, fontSize: 13, marginTop: 2 }}>{selectedJobDetail.content_title}</div>
                <div style={{ color: '#64748b', fontSize: 11 }}>ID: {selectedJobDetail.content_id}</div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#637087', fontWeight: 800, textTransform: 'uppercase' }}>Akun & Platform</div>
                <div style={{ color: '#cbd5e1', fontSize: 12, marginTop: 2 }}>
                  {selectedJobDetail.account_name} ({selectedJobDetail.platform.toUpperCase()})
                </div>
                <div style={{ color: '#64748b', fontSize: 11 }}>Mode: {selectedJobDetail.publish_mode.toUpperCase()} · Tipe: {selectedJobDetail.media_type}</div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#637087', fontWeight: 800, textTransform: 'uppercase' }}>Status & Jadwal</div>
                <div style={{ marginTop: 4 }}>{getStatusBadge(selectedJobDetail.status)}</div>
                <div style={{ color: '#cbd5e1', fontSize: 11, marginTop: 4 }}>
                  {formatScheduleTime(selectedJobDetail.scheduled_at, selectedJobDetail.account_timezone)}
                </div>
              </div>

              {selectedJobDetail.external_post_id && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: '#637087', fontWeight: 800, textTransform: 'uppercase' }}>External Meta ID</div>
                  <div style={{ color: '#60a5fa', fontSize: 11, wordBreak: 'break-all', marginTop: 2 }}>
                    #{selectedJobDetail.external_post_id}
                  </div>
                  {selectedJobDetail.external_permalink && (
                    <a
                      href={selectedJobDetail.external_permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#a78bfa', fontSize: 11, textDecoration: 'underline', marginTop: 2, display: 'inline-block' }}
                    >
                      Buka Postingan Eksternal ↗
                    </a>
                  )}
                </div>
              )}

              {selectedJobDetail.last_error_message && (
                <div style={{ marginBottom: 12, padding: 10, background: '#27171d', border: '1px solid #5c202d', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: '#fb7185', fontWeight: 800, textTransform: 'uppercase' }}>Pesan Kesalahan</div>
                  <div style={{ color: '#fca5a5', fontSize: 11, marginTop: 2 }}>{selectedJobDetail.last_error_message}</div>
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: '#637087', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Caption Snapshot</div>
                <div style={{
                  background: '#0b111d', border: '1px solid #222d41', padding: 10, borderRadius: 8,
                  color: '#94a3b8', fontSize: 11, maxHeight: 100, overflowY: 'auto', whiteSpace: 'pre-wrap'
                }}>
                  {selectedJobDetail.caption_snapshot || '(Tanpa caption)'}
                </div>
              </div>

              {/* Timeline attempts */}
              <div>
                <div style={{ fontSize: 11, color: '#637087', fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>Log Percobaan</div>
                {selectedJobDetail.attempts && selectedJobDetail.attempts.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedJobDetail.attempts.map((att, idx) => (
                      <div key={att.id || idx} style={{ background: '#0b111d', padding: 8, borderRadius: 6, fontSize: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1', fontWeight: 700 }}>
                          <span>Percobaan #{att.attempt_number} · {att.stage}</span>
                          <span style={{ color: att.outcome === 'success' ? '#4ade80' : '#fb7185' }}>{att.outcome.toUpperCase()}</span>
                        </div>
                        {att.sanitized_message && (
                          <div style={{ color: '#94a3b8', marginTop: 2 }}>{att.sanitized_message}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: '#64748b', fontSize: 11 }}>Belum ada riwayat percobaan.</div>
                )}
              </div>
            </aside>
          )}
        </div>
      )}

      {/* Tab 2: Weekly Calendar */}
      {activeTab === 'calendar' && (
        <div style={{ background: '#101725', border: '1px solid #253046', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ height: 46, borderBottom: '1px solid #253046', display: 'flex', alignItems: 'center', padding: '0 16px', color: '#e5e7eb', fontSize: 12, fontWeight: 800 }}>
            <span>Kalender Jadwal Mingguan</span>
            <span style={{ color: '#68768c', fontWeight: 500, marginLeft: 8 }}>({calendarWeek[0].dateStr} s.d. {calendarWeek[6].dateStr})</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: '#263044' }}>
            {calendarWeek.map((day) => (
              <div key={day.dateStr} style={{ minHeight: 280, background: day.isToday ? '#141d2f' : '#101725', padding: 10 }}>
                <div style={{ fontSize: 10, color: day.isToday ? '#60a5fa' : '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>
                  {day.dayName} {day.isToday && '· HARI INI'}
                </div>
                <div style={{ fontSize: 16, color: '#dbe2ee', fontWeight: 800, margin: '4px 0 10px' }}>
                  {day.dateNum}
                </div>
                {day.jobs.length === 0 ? (
                  <div style={{ color: '#3f4b60', fontSize: 10, textAlign: 'center', marginTop: 30 }}>Belum ada jadwal</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {day.jobs.map((j) => (
                      <div
                        key={j.id}
                        onClick={() => { setSelectedJobId(j.id); setActiveTab('queue'); }}
                        style={{
                          padding: 7, borderRadius: 6,
                          background: j.platform === 'instagram' ? '#2e1c3a' : '#16253d',
                          borderLeft: `3px solid ${j.status === 'published' ? '#4ade80' : (j.platform === 'instagram' ? '#c084fc' : '#3b82f6')}`,
                          fontSize: 10, color: '#cbd5e1', cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontWeight: 800, color: '#f3f4f6', marginBottom: 2 }}>
                          {j.platform === 'facebook' ? 'f' : '◎'} {j.scheduled_at ? new Date(j.scheduled_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {j.content_title || j.content_id}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Schedule Content Dialog */}
      {showScheduleModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'grid', placeItems: 'center', zIndex: 9999, padding: 16
        }}>
          <div style={{
            background: '#101727', border: '1px solid #253046', borderRadius: 14,
            width: '100%', maxWidth: 540, padding: 22, color: '#fff', boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Jadwalkan Publikasi Konten</h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <XIcon style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', fontWeight: 700, marginBottom: 4 }}>ID Konten / Video ID</label>
                <input
                  type="text"
                  value={scheduleForm.content_id}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, content_id: e.target.value })}
                  placeholder="Misal: VID-RCP-0811-01"
                  required
                  style={{ width: '100%', background: '#0b101b', border: '1px solid #28354d', padding: '8px 10px', borderRadius: 6, color: '#fff', fontSize: 12 }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', fontWeight: 700, marginBottom: 4 }}>Pilih Akun Publikasi</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 120, overflowY: 'auto', background: '#0b101b', padding: 8, borderRadius: 6, border: '1px solid #28354d' }}>
                  {accounts.length === 0 ? (
                    <div style={{ color: '#64748b', fontSize: 11 }}>Belum ada akun Meta terdaftar. Tambahkan di Pengaturan.</div>
                  ) : (
                    accounts.map(acc => (
                      <label key={acc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={scheduleForm.account_ids.includes(acc.id)}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...scheduleForm.account_ids, acc.id]
                              : scheduleForm.account_ids.filter(id => id !== acc.id);
                            setScheduleForm({ ...scheduleForm, account_ids: next, platform: acc.platform });
                          }}
                        />
                        <span>{acc.display_name} <span style={{ color: '#64748b', fontSize: 10 }}>({acc.platform.toUpperCase()})</span></span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', fontWeight: 700, marginBottom: 4 }}>Mode Publikasi</label>
                  <select
                    value={scheduleForm.publish_mode}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, publish_mode: e.target.value })}
                    style={{ width: '100%', background: '#0b101b', border: '1px solid #28354d', padding: '8px 10px', borderRadius: 6, color: '#fff', fontSize: 12 }}
                  >
                    <option value="draft">Scheduled Draft (Aman - Meta Draft)</option>
                    <option value="live">Live (Memerlukan Approval)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', fontWeight: 700, marginBottom: 4 }}>Tipe Media</label>
                  <select
                    value={scheduleForm.media_type}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, media_type: e.target.value })}
                    style={{ width: '100%', background: '#0b101b', border: '1px solid #28354d', padding: '8px 10px', borderRadius: 6, color: '#fff', fontSize: 12 }}
                  >
                    <option value="video">Video (MP4 / Reels)</option>
                    <option value="image">Gambar / Foto (JPEG/PNG)</option>
                    <option value="text_only">Teks Saja</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', fontWeight: 700, marginBottom: 4 }}>URL Media Publik (Nextcloud / Cloud)</label>
                <input
                  type="url"
                  value={scheduleForm.media_url}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, media_url: e.target.value })}
                  placeholder="https://cloud.example.com/s/xyz/download"
                  style={{ width: '100%', background: '#0b101b', border: '1px solid #28354d', padding: '8px 10px', borderRadius: 6, color: '#fff', fontSize: 12 }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', fontWeight: 700, marginBottom: 4 }}>Caption & Tag</label>
                <textarea
                  rows={3}
                  value={scheduleForm.caption}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, caption: e.target.value })}
                  placeholder="Tulis caption lengkap beserta hashtag..."
                  style={{ width: '100%', background: '#0b101b', border: '1px solid #28354d', padding: '8px 10px', borderRadius: 6, color: '#fff', fontSize: 12, resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', fontWeight: 700, marginBottom: 4 }}>Waktu Tayang</label>
                  <input
                    type="datetime-local"
                    value={scheduleForm.scheduled_at}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_at: e.target.value })}
                    required
                    style={{ width: '100%', background: '#0b101b', border: '1px solid #28354d', padding: '8px 10px', borderRadius: 6, color: '#fff', fontSize: 12 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', fontWeight: 700, marginBottom: 4 }}>Zona Waktu</label>
                  <input
                    type="text"
                    value={scheduleForm.timezone}
                    readOnly
                    style={{ width: '100%', background: '#0b101b', border: '1px solid #28354d', padding: '8px 10px', borderRadius: 6, color: '#9ca3af', fontSize: 12 }}
                  />
                </div>
              </div>

              {/* Preflight warning summary */}
              {preflightResult && (
                <div style={{ marginBottom: 14, padding: 10, background: preflightResult.isValid ? '#0f291e' : '#27171d', border: `1px solid ${preflightResult.isValid ? '#10b981' : '#ef4444'}`, borderRadius: 6, fontSize: 11 }}>
                  {preflightResult.warnings.map((w, i) => <div key={i} style={{ color: '#fcd34d' }}>⚠️ {w}</div>)}
                  {preflightResult.errors.map((err, i) => <div key={i} style={{ color: '#fca5a5' }}>❌ {err}</div>)}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={runPreflight}
                  disabled={runningPreflight}
                  style={{ padding: '9px 14px', background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}
                >
                  {runningPreflight ? 'Memeriksa...' : '🔍 Preflight Check'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  style={{ padding: '9px 14px', background: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingSchedule}
                  style={{ padding: '9px 18px', background: '#7c3aed', border: '1px solid #a855f7', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                >
                  {submittingSchedule ? 'Menyimpan...' : 'Simpan Jadwal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reschedule Dialog */}
      {rescheduleModalJob && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'grid', placeItems: 'center', zIndex: 9999, padding: 16
        }}>
          <div style={{
            background: '#101727', border: '1px solid #253046', borderRadius: 14,
            width: '100%', maxWidth: 400, padding: 20, color: '#fff'
          }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 800 }}>Ubah Jadwal Publikasi</h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 14px' }}>
              Pilih tanggal dan jam baru untuk job #{rescheduleModalJob.id}:
            </p>
            <input
              type="datetime-local"
              value={newScheduleTime}
              onChange={(e) => setNewScheduleTime(e.target.value)}
              style={{ width: '100%', background: '#0b101b', border: '1px solid #28354d', padding: '8px 10px', borderRadius: 6, color: '#fff', fontSize: 12, marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setRescheduleModalJob(null)}
                style={{ padding: '8px 14px', background: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteReschedule}
                disabled={submittingReschedule}
                style={{ padding: '8px 16px', background: '#7c3aed', border: '1px solid #a855f7', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
              >
                {submittingReschedule ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
