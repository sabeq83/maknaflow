'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

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

  // Video Autocomplete & Settings State
  const [cloudBaseUrl, setCloudBaseUrl] = useState('');
  const [videoSearchQuery, setVideoSearchQuery] = useState(initialPreloadItem?.video_id || '');
  const [videoSearchResults, setVideoSearchResults] = useState([]);
  const [searchingVideos, setSearchingVideos] = useState(false);
  const [showVideoDropdown, setShowVideoDropdown] = useState(false);
  const [syncingAccounts, setSyncingAccounts] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Cloud Folder Media Files State
  const [folderMediaFiles, setFolderMediaFiles] = useState([]);
  const [loadingMediaFiles, setLoadingMediaFiles] = useState(false);
  const [selectedMediaFileName, setSelectedMediaFileName] = useState('');
  const [showVideoPreview, setShowVideoPreview] = useState(false);

  // Reschedule Modal State
  const [rescheduleModalJob, setRescheduleModalJob] = useState(null);
  const [newScheduleTime, setNewScheduleTime] = useState('');
  const [submittingReschedule, setSubmittingReschedule] = useState(false);
  const [syncingJobId, setSyncingJobId] = useState(null);

  // Toast
  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  // Load Settings for Cloud Base Domain
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data) {
          const sUrl = data.data.fb_server_url || data.data.nextcloud_url || '';
          setCloudBaseUrl(sUrl);
        }
      })
      .catch(() => {});
  }, []);

  // 1. Fetch Accounts
  const fetchAccounts = useCallback(async (isManualSync = false) => {
    if (isManualSync) setSyncingAccounts(true);
    try {
      const url = isManualSync ? '/api/v2/publishing/accounts?sync=1' : '/api/v2/publishing/accounts';
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const seenKeys = new Set();
        const unique = json.data.filter(acc => {
          const key = `${acc.platform}_${acc.facebook_page_id || ''}_${acc.instagram_user_id || ''}`;
          if (seenKeys.has(key)) return false;
          seenKeys.add(key);
          return true;
        });
        setAccounts(unique);
        if (isManualSync) {
          showToast(`Berhasil menyinkronkan ${unique.length} akun Meta! 🟢`);
        }
      } else if (isManualSync) {
        showToast(json.error || 'Gagal menyinkronkan akun ❌');
      }
    } catch (err) {
      console.error('Error fetching publishing accounts:', err);
      if (isManualSync) showToast('Gagal terhubung ke server');
    } finally {
      if (isManualSync) setSyncingAccounts(false);
    }
  }, []);

  // Debounced Video Search in Content Flow
  const handleSearchVideos = (query) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!query || !query.trim()) {
      setVideoSearchResults([]);
      setShowVideoDropdown(false);
      return;
    }
    setSearchingVideos(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/content-flow?q=${encodeURIComponent(query.trim())}&limit=12`);
        const json = await res.json();
        if (json.success && Array.isArray(json.items)) {
          setVideoSearchResults(json.items);
          setShowVideoDropdown(true);
        }
      } catch (e) {
        console.warn('Video search error:', e);
      } finally {
        setSearchingVideos(false);
      }
    }, 250);
  };

  // Scan Folder Media Files (Auto-Detect *_video_final.mp4)
  const fetchMediaFiles = async (videoId, customUrl = null) => {
    if (!videoId && !customUrl) return;
    setLoadingMediaFiles(true);
    try {
      const q = `videoId=${encodeURIComponent(videoId || '')}&folderUrl=${encodeURIComponent(customUrl || '')}`;
      const res = await fetch(`/api/content-flow/media-files?${q}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.files) && json.files.length > 0) {
        setFolderMediaFiles(json.files);
        const best = json.defaultFile || json.files[0];
        if (best) {
          setSelectedMediaFileName(best.name);
          setScheduleForm(prev => ({
            ...prev,
            media_url: best.directUrl,
            media_type: best.mediaType || 'video'
          }));
        }
      } else {
        setFolderMediaFiles([]);
      }
    } catch (e) {
      console.warn('Failed to scan folder media files:', e);
    } finally {
      setLoadingMediaFiles(false);
    }
  };

  const handleSelectMediaFile = (fileName) => {
    setSelectedMediaFileName(fileName);
    const found = folderMediaFiles.find(f => f.name === fileName);
    if (found) {
      setScheduleForm(prev => ({
        ...prev,
        media_url: found.directUrl,
        media_type: found.mediaType || 'video'
      }));
    }
  };

  // Autoload Selected Video Data into Schedule Form
  const selectVideoItem = (item) => {
    // 1. Resolve media type
    const rawAsset = item.url_asset || item.nextcloud_url || '';
    const isImage = /\.(png|jpg|jpeg|webp)$/i.test(rawAsset);
    const mediaType = isImage ? 'image' : 'video';

    // 2. Resolve public URL
    let resolvedMediaUrl = '';
    if (item.nextcloud_url && item.nextcloud_url.startsWith('http')) {
      resolvedMediaUrl = item.nextcloud_url;
    } else if (item.url_asset && item.url_asset.startsWith('http')) {
      resolvedMediaUrl = item.url_asset;
    } else if (rawAsset) {
      if (cloudBaseUrl) {
        resolvedMediaUrl = `${cloudBaseUrl.replace(/\/$/, '')}/${rawAsset.replace(/^\//, '')}`;
      } else {
        resolvedMediaUrl = rawAsset;
      }
    }

    // 3. Resolve caption & hashtags
    let autoCaption = item.caption || '';
    if (!autoCaption && (item.campaign_title || item.hook)) {
      const topic = item.campaign_title || item.hook || 'Resep Spesial';
      autoCaption = `✨ ${topic.toUpperCase()} ✨\n\n${item.hook || ''}\n\n${item.nama_produk ? `Produk: ${item.nama_produk}\n` : ''}#${(item.account_name || 'resep').replace(/\s+/g, '')} #kuliner #viral #fyp`;
    }

    setScheduleForm(prev => ({
      ...prev,
      content_id: item.video_id,
      media_url: resolvedMediaUrl,
      media_type: mediaType,
      caption: autoCaption
    }));
    setVideoSearchQuery(`${item.video_id} - ${item.campaign_title || item.hook || item.nama_produk || ''}`);
    setShowVideoDropdown(false);

    // Auto-scan folder for *_video_final.mp4 and set direct download URL
    fetchMediaFiles(item.video_id, item.nextcloud_url);
  };

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

  // Scan media files on modal open if video content is loaded
  useEffect(() => {
    if (showScheduleModal && scheduleForm.content_id) {
      fetchMediaFiles(scheduleForm.content_id, scheduleForm.media_url);
    }
  }, [showScheduleModal, scheduleForm.content_id]);

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

  // Sync Status & Canonical URL from Meta Graph API
  const handleSyncMetaPost = async (jobId) => {
    setSyncingJobId(jobId);
    try {
      const res = await fetch(`/api/v2/publishing/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync-meta' })
      });
      const json = await res.json();
      if (json.success) {
        showToast('Status & URL postingan berhasil disinkronkan dari Meta! 🟢');
        fetchJobs();
        if (selectedJobId === jobId) {
          fetch(`/api/v2/publishing/jobs/${jobId}`)
            .then(r => r.json())
            .then(d => { if (d.success) setSelectedJobDetail(d.data); });
        }
      } else {
        showToast(`Gagal sinkronisasi Meta: ${json.error || 'Terjadi kesalahan'} ❌`);
      }
    } catch (err) {
      showToast('Gagal terhubung ke server saat sinkronisasi Meta ❌');
    } finally {
      setSyncingJobId(null);
    }
  };

  // Approve Job
  const handleApproveJob = async (jobId) => {
    if (!confirm('Apakah Anda yakin ingin menyetujui (Approve) jadwal postingan ini untuk dipublikasikan langsung?')) return;
    try {
      const res = await fetch(`/api/v2/publishing/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' })
      });
      const json = await res.json();
      if (json.success) {
        showToast('Jadwal publikasi berhasil disetujui! 🟢');
        fetchJobs();
        if (selectedJobId === jobId) {
          fetch(`/api/v2/publishing/jobs/${jobId}`)
            .then(r => r.json())
            .then(d => { if (d.success) setSelectedJobDetail(d.data); });
        }
      } else {
        showToast(`Gagal menyetujui: ${json.error} ❌`);
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

  const getStatusBadge = (status, approvalStatus) => {
    if (status === 'scheduled' && approvalStatus === 'pending_approval') {
      return <span style={{ background: '#3b2514', color: '#f97316', padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316' }}></span>PENDING APPROVAL</span>;
    }
    switch (status) {
      case 'published':
        return <span style={{ background: '#123828', color: 'var(--status-success)', padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-success)' }}></span>PUBLISHED</span>;
      case 'scheduled':
        return <span style={{ background: '#182b47', color: 'var(--link)', padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--link)' }}></span>SCHEDULED</span>;
      case 'processing':
      case 'publishing':
      case 'creating_container':
      case 'waiting_media':
        return <span style={{ background: '#2e2640', color: 'var(--status-neutral)', padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-neutral)' }}></span>PROCESSING</span>;
      case 'verifying':
        return <span style={{ background: '#3b2d18', color: 'var(--status-warning)', padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-warning)' }}></span>VERIFYING</span>;
      case 'retry_wait':
        return <span style={{ background: '#453314', color: 'var(--status-warning)', padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-warning)' }}></span>RETRY WAIT</span>;
      case 'failed':
        return <span style={{ background: '#481d29', color: '#fb7185', padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fb7185' }}></span>FAILED</span>;
      case 'cancelled':
        return <span style={{ background: 'var(--surface)', color: 'var(--text-muted)', padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)' }}></span>CANCELLED</span>;
      default:
        return <span style={{ background: 'var(--surface)', color: 'var(--text-muted)', padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800 }}>{status}</span>;
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
    <div style={{ color: 'var(--text-primary)', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: 'var(--surface)', border: '1px solid var(--status-info)', color: '#93c5fd',
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
          <h2 style={{ fontSize: 22, fontWeight: 850, margin: '0 0 4px', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
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
                borderRadius: 8, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 750, cursor: 'pointer'
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
              border: `1px solid ${isPaused ? 'var(--status-danger)' : '#334155'}`,
              borderRadius: 8,
              color: isPaused ? '#fca5a5' : 'var(--text-secondary)',
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
              padding: '9px 18px', background: 'linear-gradient(135deg, var(--status-neutral) 0%, var(--status-neutral) 100%)',
              border: '1px solid var(--status-neutral)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12, fontWeight: 800,
              cursor: 'pointer', boxShadow: '0 4px 14px rgba(168, 85, 247, 0.35)', display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <span>＋ Jadwalkan Konten</span>
          </button>
        </div>
      </div>

      {/* 4 Card Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--surface-interactive)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Terjadwal</div>
          <div style={{ fontSize: 24, fontWeight: 850, color: 'var(--link)', marginTop: 4 }}>{metrics.scheduled}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Antrean aktif</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--surface-interactive)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Published Hari Ini</div>
          <div style={{ fontSize: 24, fontWeight: 850, color: 'var(--status-success)', marginTop: 4 }}>{metrics.publishedToday}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Facebook & Instagram</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--surface-interactive)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Menunggu Retry</div>
          <div style={{ fontSize: 24, fontWeight: 850, color: 'var(--status-warning)', marginTop: 4 }}>{metrics.retryWait}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Percobaan otomatis</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--surface-interactive)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Perlu Tindakan</div>
          <div style={{ fontSize: 24, fontWeight: 850, color: metrics.needsAction > 0 ? '#fb7185' : 'var(--text-muted)', marginTop: 4 }}>{metrics.needsAction}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Failed / Needs review</div>
        </div>
      </div>

      {/* Navigation Tabs & Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #263044', marginBottom: 16, flexWrap: 'wrap', gap: 6 }}>
        <button
          onClick={() => setActiveTab('queue')}
          style={{
            background: 'transparent', border: 'none',
            borderBottom: activeTab === 'queue' ? '2px solid var(--status-neutral)' : '2px solid transparent',
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
            borderBottom: activeTab === 'calendar' ? '2px solid var(--status-neutral)' : '2px solid transparent',
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
            borderBottom: activeTab === 'history' ? '2px solid var(--status-neutral)' : '2px solid transparent',
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
            style={{ background: 'var(--surface)', border: '1px solid #2a354b', color: '#9eabc0', padding: '6px 10px', borderRadius: 7, fontSize: 12 }}
          >
            <option value="all">Semua Akun</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.display_name} ({acc.platform})</option>
            ))}
          </select>

          <select
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value)}
            style={{ background: 'var(--surface)', border: '1px solid #2a354b', color: '#9eabc0', padding: '6px 10px', borderRadius: 7, fontSize: 12 }}
          >
            <option value="all">Semua Platform</option>
            <option value="facebook">Facebook Page</option>
            <option value="instagram">Instagram</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ background: 'var(--surface)', border: '1px solid #2a354b', color: '#9eabc0', padding: '6px 10px', borderRadius: 7, fontSize: 12 }}
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
            style={{ background: 'var(--surface)', border: '1px solid #2a354b', color: '#9eabc0', padding: '6px 10px', borderRadius: 7, cursor: 'pointer' }}
            title="Refresh antrean"
          >
            <RefreshCwIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>

      {/* Tab 1: Queue & History Layout (Table + Drawer) */}
      {(activeTab === 'queue' || activeTab === 'history') && (
        <div style={{ display: 'grid', gridTemplateColumns: selectedJobDetail ? 'minmax(0, 1fr) 320px' : '1fr', gap: 14 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--surface-interactive)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ height: 46, borderBottom: '1px solid var(--surface-interactive)', display: 'flex', alignItems: 'center', padding: '0 16px', color: 'var(--text-primary)', fontSize: 12, fontWeight: 800 }}>
              {activeTab === 'queue' ? 'Daftar Antrean Terjadwal' : 'Riwayat Hasil Publikasi'}
              <span style={{ color: '#68768c', fontWeight: 500, marginLeft: 8 }}>({jobs.length} item)</span>
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Memuat jadwal...</div>
            ) : jobs.length === 0 ? (
              <div style={{ padding: 50, textAlign: 'center', color: 'var(--text-muted)' }}>
                Tidak ada data jadwal publikasi yang cocok dengan filter.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface)' }}>
                      <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>Konten</th>
                      <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>Tujuan</th>
                      <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>Jadwal / Waktu</th>
                      <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>Status</th>
                      <th style={{ textAlign: 'right', padding: '10px 14px', color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>Aksi</th>
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
                            boxShadow: isSelected ? 'inset 3px 0 var(--status-neutral)' : 'none'
                          }}
                        >
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                              <div style={{
                                width: 40, height: 40, borderRadius: 8, background: 'var(--surface)',
                                display: 'grid', placeItems: 'center', color: '#a78bfa', fontWeight: 800, flexShrink: 0
                              }}>
                                {job.platform === 'facebook' ? 'f' : '◎'}
                              </div>
                              <div>
                                <div style={{ color: 'var(--text-primary)', fontWeight: 750, maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {job.content_title || job.content_id}
                                </div>
                                <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
                                  {job.content_id} · Mode: {job.publish_mode.toUpperCase()}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 700, color: '#d1d5db' }}>{job.account_name || 'Meta Account'}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{job.platform.toUpperCase()} ({job.media_type})</div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                              {formatScheduleTime(job.scheduled_at, job.account_timezone)}
                            </div>
                            {job.next_attempt_at && job.status === 'retry_wait' && (
                              <div style={{ color: 'var(--status-warning)', fontSize: 10, marginTop: 2 }}>
                                Retry: {formatScheduleTime(job.next_attempt_at, job.account_timezone)}
                              </div>
                            )}
                          </td>
                           <td style={{ padding: '12px 14px' }}>
                            {getStatusBadge(job.status, job.approval_status)}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              {job.approval_status === 'pending_approval' && (
                                <button
                                  onClick={() => handleApproveJob(job.id)}
                                  style={{ background: '#14532d', border: '1px solid #166534', color: '#86efac', padding: '5px 9px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}
                                >
                                  Approve
                                </button>
                              )}
                              {job.status === 'scheduled' && (
                                <>
                                  <button
                                    onClick={() => { setRescheduleModalJob(job); setNewScheduleTime(job.scheduled_at.slice(0, 16)); }}
                                    style={{ background: '#19243a', border: '1px solid #36445f', color: 'var(--text-secondary)', padding: '5px 9px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}
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
                                  style={{ background: '#1e3a8a', border: '1px solid var(--status-info)', color: '#93c5fd', padding: '5px 9px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}
                                >
                                  Retry
                                </button>
                              )}
                              {(job.external_post_id || job.status === 'published') && (
                                <button
                                  disabled={syncingJobId === job.id}
                                  onClick={() => handleSyncMetaPost(job.id)}
                                  title="Sinkronkan status dan URL postingan dari Meta Graph API"
                                  style={{ background: 'var(--status-info-soft)', border: '1px solid var(--status-info)', color: '#93c5fd', padding: '5px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                                >
                                  {syncingJobId === job.id ? '⏳' : '🔄 Sync'}
                                </button>
                              )}
                              {job.external_permalink && (
                                <a
                                  href={job.external_permalink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={`Buka postingan di ${job.platform === 'instagram' ? 'Instagram' : 'Facebook'}`}
                                  style={{
                                    background: job.platform === 'instagram' ? 'rgba(236,72,153,0.2)' : 'rgba(37,99,235,0.2)',
                                    border: `1px solid ${job.platform === 'instagram' ? '#ec4899' : 'var(--status-info)'}`,
                                    color: job.platform === 'instagram' ? '#f472b6' : '#93c5fd',
                                    padding: '5px 8px', borderRadius: 6, fontSize: 11, textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2
                                  }}
                                >
                                  ↗️ {job.platform === 'instagram' ? 'IG' : 'FB'}
                                </a>
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
            <aside style={{ background: 'var(--surface)', border: '1px solid var(--surface-interactive)', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', fontWeight: 800 }}>Detail Publikasi</h3>
                <button
                  onClick={() => setSelectedJobDetail(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <XIcon style={{ width: 16, height: 16 }} />
                </button>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Konten</div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 750, fontSize: 13, marginTop: 2 }}>{selectedJobDetail.content_title}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>ID: {selectedJobDetail.content_id}</div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Akun & Platform</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
                  {selectedJobDetail.account_name} ({selectedJobDetail.platform.toUpperCase()})
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Mode: {selectedJobDetail.publish_mode.toUpperCase()} · Tipe: {selectedJobDetail.media_type}</div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Status & Jadwal</div>
                <div style={{ marginTop: 4 }}>{getStatusBadge(selectedJobDetail.status, selectedJobDetail.approval_status)}</div>
                {selectedJobDetail.approval_status === 'pending_approval' && (
                  <div style={{ marginTop: 8 }}>
                    <button
                      onClick={() => handleApproveJob(selectedJobDetail.id)}
                      style={{
                        width: '100%',
                        background: '#166534',
                        border: '1px solid #15803d',
                        color: '#bbf7d0',
                        padding: '6px 12px',
                        borderRadius: 6,
                        fontSize: 11,
                        cursor: 'pointer',
                        fontWeight: 700,
                        textAlign: 'center'
                      }}
                    >
                      ✅ Approve & Posting Sekarang
                    </button>
                  </div>
                )}
                <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 4 }}>
                  {formatScheduleTime(selectedJobDetail.scheduled_at, selectedJobDetail.account_timezone)}
                </div>
              </div>

              {selectedJobDetail.external_post_id && (
                <div style={{ marginBottom: 12, padding: 10, background: '#0b111d', border: '1px solid #1e293b', borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>External Meta Post</div>
                    <button
                      type="button"
                      disabled={syncingJobId === selectedJobDetail.id}
                      onClick={() => handleSyncMetaPost(selectedJobDetail.id)}
                      style={{
                        background: 'var(--status-info-soft)', border: '1px solid var(--status-info)', color: '#93c5fd',
                        fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 4, cursor: 'pointer'
                      }}
                    >
                      {syncingJobId === selectedJobDetail.id ? '⏳ Sinkronkan...' : '🔄 Sinkronkan URL'}
                    </button>
                  </div>
                  <div style={{ color: 'var(--link)', fontSize: 11, wordBreak: 'break-all', marginTop: 4 }}>
                    ID: #{selectedJobDetail.external_post_id}
                  </div>
                  {selectedJobDetail.external_permalink ? (
                    <a
                      href={selectedJobDetail.external_permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8,
                        background: selectedJobDetail.platform === 'instagram' ? 'linear-gradient(135deg, #ec4899, var(--status-neutral))' : '#2563eb',
                        color: 'var(--text-primary)', fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 6, textDecoration: 'none'
                      }}
                    >
                      <span>↗️ Buka di {selectedJobDetail.platform === 'instagram' ? 'Instagram' : 'Facebook'}</span>
                    </a>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 4 }}>
                      Klik "Sinkronkan URL" untuk memuat link kanonikal postingan.
                    </div>
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
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Caption Snapshot</div>
                <div style={{
                  background: '#0b111d', border: '1px solid #222d41', padding: 10, borderRadius: 8,
                  color: 'var(--text-muted)', fontSize: 11, maxHeight: 100, overflowY: 'auto', whiteSpace: 'pre-wrap'
                }}>
                  {selectedJobDetail.caption_snapshot || '(Tanpa caption)'}
                </div>
              </div>

              {/* Timeline attempts */}
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>Log Percobaan</div>
                {selectedJobDetail.attempts && selectedJobDetail.attempts.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedJobDetail.attempts.map((att, idx) => (
                      <div key={att.id || idx} style={{ background: '#0b111d', padding: 8, borderRadius: 6, fontSize: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontWeight: 700 }}>
                          <span>Percobaan #{att.attempt_number} · {att.stage}</span>
                          <span style={{ color: att.outcome === 'success' ? 'var(--status-success)' : '#fb7185' }}>{att.outcome.toUpperCase()}</span>
                        </div>
                        {att.sanitized_message && (
                          <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{att.sanitized_message}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Belum ada riwayat percobaan.</div>
                )}
              </div>
            </aside>
          )}
        </div>
      )}

      {/* Tab 2: Weekly Calendar */}
      {activeTab === 'calendar' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--surface-interactive)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ height: 46, borderBottom: '1px solid var(--surface-interactive)', display: 'flex', alignItems: 'center', padding: '0 16px', color: 'var(--text-primary)', fontSize: 12, fontWeight: 800 }}>
            <span>Kalender Jadwal Mingguan</span>
            <span style={{ color: '#68768c', fontWeight: 500, marginLeft: 8 }}>({calendarWeek[0].dateStr} s.d. {calendarWeek[6].dateStr})</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: '#263044' }}>
            {calendarWeek.map((day) => (
              <div key={day.dateStr} style={{ minHeight: 280, background: day.isToday ? '#141d2f' : '#101725', padding: 10 }}>
                <div style={{ fontSize: 10, color: day.isToday ? 'var(--link)' : 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>
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
                          borderLeft: `3px solid ${j.status === 'published' ? 'var(--status-success)' : (j.platform === 'instagram' ? 'var(--status-neutral)' : 'var(--status-info)')}`,
                          fontSize: 10, color: 'var(--text-secondary)', cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>
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
          position: 'fixed', inset: 0, background: 'var(--overlay-backdrop)',
          display: 'grid', placeItems: 'center', zIndex: 9999, padding: 16
        }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--surface-interactive)', borderRadius: 14,
            width: '100%', maxWidth: 540, padding: 22, color: 'var(--text-primary)', boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Jadwalkan Publikasi Konten</h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <XIcon style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit}>
              {/* 1. Searchable Video ID Combobox */}
              <div style={{ marginBottom: 12, position: 'relative' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>
                  <span>ID Konten / Video ID <span style={{ color: 'var(--status-danger)' }}>*</span></span>
                  <span style={{ color: 'var(--link)', fontWeight: 400, fontSize: 10 }}>Ketik untuk mencari di Video Library</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={videoSearchQuery || scheduleForm.content_id}
                    onChange={(e) => {
                      setVideoSearchQuery(e.target.value);
                      setScheduleForm({ ...scheduleForm, content_id: e.target.value });
                      handleSearchVideos(e.target.value);
                    }}
                    onFocus={() => { if (videoSearchResults.length > 0) setShowVideoDropdown(true); }}
                    placeholder="🔍 Cari Video ID, Judul Resep, atau Nama Produk..."
                    required
                    style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--surface-interactive)', padding: '8px 10px', borderRadius: 6, color: 'var(--text-primary)', fontSize: 12 }}
                  />
                  {searchingVideos && (
                    <span style={{ position: 'absolute', right: 10, top: 8, fontSize: 11, color: 'var(--link)' }}>⏳</span>
                  )}
                </div>

                {/* Dropdown Hasil Pencarian Video */}
                {showVideoDropdown && videoSearchResults.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: 'var(--surface)', border: '1px solid var(--status-info)', borderRadius: 8,
                    marginTop: 4, maxHeight: 220, overflowY: 'auto', boxShadow: '0 10px 25px var(--overlay-backdrop)'
                  }}>
                    {videoSearchResults.map(item => (
                      <div
                        key={item.id || item.video_id}
                        onClick={() => selectVideoItem(item)}
                        style={{
                          padding: '8px 12px', borderBottom: '1px solid #1e293b', cursor: 'pointer',
                          display: 'flex', flexDirection: 'column', gap: 2, transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#1e293b'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--link)' }}>🎬 {item.video_id}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--surface)', padding: '1px 6px', borderRadius: 4 }}>
                            {item.account_name || 'Umum'}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>
                          {item.campaign_title || item.hook || item.nama_produk || 'Konten Video'}
                        </div>
                        {item.nama_produk && (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Produk: {item.nama_produk}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Pilih Akun Publikasi */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>
                    Pilih Akun Publikasi <span style={{ color: 'var(--status-danger)' }}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => fetchAccounts(true)}
                    disabled={syncingAccounts}
                    style={{
                      background: 'transparent', border: 'none', color: 'var(--link)',
                      fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0
                    }}
                  >
                    <span>{syncingAccounts ? '⏳' : '🔄'}</span>
                    <span>{syncingAccounts ? 'Menyinkronkan...' : 'Sinkronkan Akun'}</span>
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 130, overflowY: 'auto', background: 'var(--surface)', padding: 8, borderRadius: 6, border: '1px solid var(--surface-interactive)' }}>
                  {accounts.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, padding: 6, textAlign: 'center' }}>
                      Belum ada akun Meta terdeteksi. <button type="button" onClick={() => fetchAccounts(true)} style={{ color: 'var(--link)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Klik untuk menyinkronkan dari Pengaturan</button>.
                    </div>
                  ) : (
                    accounts.map(acc => (
                      <label key={acc.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '4px 8px', borderRadius: 4, background: scheduleForm.account_ids.includes(acc.id) ? 'var(--status-info-soft)' : 'transparent',
                        fontSize: 12, cursor: 'pointer'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{acc.display_name}</span>
                        </div>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 10,
                          background: acc.platform === 'instagram' ? 'rgba(236, 72, 153, 0.2)' : 'var(--status-info-soft)',
                          color: acc.platform === 'instagram' ? '#f472b6' : '#93c5fd',
                          border: `1px solid ${acc.platform === 'instagram' ? '#ec4899' : 'var(--status-info)'}`
                        }}>
                          {acc.platform === 'instagram' ? '📸 INSTAGRAM' : '📘 FACEBOOK'}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* 3. Mode Publikasi & Tipe Media */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>Mode Publikasi</label>
                  <select
                    value={scheduleForm.publish_mode}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, publish_mode: e.target.value })}
                    style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--surface-interactive)', padding: '8px 10px', borderRadius: 6, color: 'var(--text-primary)', fontSize: 12 }}
                  >
                    <option value="draft">Scheduled Draft (Aman - Meta Draft)</option>
                    <option value="live">Live (Memerlukan Approval)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>
                    Tipe Media <span style={{ color: 'var(--link)', fontWeight: 400 }}>(Autoload)</span>
                  </label>
                  <select
                    value={scheduleForm.media_type}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, media_type: e.target.value })}
                    style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--surface-interactive)', padding: '8px 10px', borderRadius: 6, color: 'var(--text-primary)', fontSize: 12 }}
                  >
                    <option value="video">🎬 Video (MP4 / Reels)</option>
                    <option value="image">🖼️ Gambar / Foto (JPEG/PNG)</option>
                    <option value="text_only">📝 Teks Saja</option>
                  </select>
                </div>
              </div>

              {/* 3.5. File Media di Folder Cloud (Auto-Scan) */}
              {loadingMediaFiles ? (
                <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--status-info-soft)', borderRadius: 6, border: '1px dashed var(--status-info)', fontSize: 11, color: '#93c5fd', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>⏳</span>
                  <span>Memindai file media di folder Cloud...</span>
                </div>
              ) : folderMediaFiles.length > 0 ? (
                <div style={{ marginBottom: 12, padding: '10px', background: 'var(--status-info-soft)', borderRadius: 6, border: '1px solid rgba(59,130,246,0.35)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ fontSize: 11, color: 'var(--link)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>📁</span>
                      <span>Pilih File Media di Folder Cloud (Facebook Downloadable):</span>
                    </label>
                    <span style={{ fontSize: 10, color: 'var(--link)', background: 'rgba(56,189,248,0.15)', padding: '2px 6px', borderRadius: 4 }}>
                      {folderMediaFiles.length} file terdeteksi
                    </span>
                  </div>
                  <select
                    value={selectedMediaFileName}
                    onChange={(e) => handleSelectMediaFile(e.target.value)}
                    style={{
                      width: '100%', background: 'var(--surface)', border: '1px solid var(--status-info)', padding: '8px 10px',
                      borderRadius: 6, color: 'var(--text-primary)', fontSize: 12, fontWeight: 500, outline: 'none'
                    }}
                  >
                    {folderMediaFiles.map(file => (
                      <option key={file.name} value={file.name}>
                        {file.mediaType === 'video' ? '🎬 ' : (file.mediaType === 'image' ? '🖼️ ' : '📄 ')}
                        {file.name} ({file.sizeFormatted}) {file.isRecommended ? '⭐ [Rekomendasi Utama]' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {/* 4. URL Media Publik (Direct Downloadable .MP4) */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>URL Media Publik</span>
                    <span style={{ color: '#22c55e', fontSize: 10, fontWeight: 600 }}>⚡ Direct Downloadable .MP4</span>
                  </label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {scheduleForm.media_url && (
                      <button
                        type="button"
                        onClick={() => setShowVideoPreview(!showVideoPreview)}
                        style={{
                          background: showVideoPreview ? 'var(--status-danger-soft)' : 'var(--status-info-soft)',
                          border: `1px solid ${showVideoPreview ? 'var(--status-danger)' : 'var(--status-info)'}`,
                          color: showVideoPreview ? 'var(--status-danger)' : 'var(--link)',
                          fontSize: 10, cursor: 'pointer', padding: '2px 8px', borderRadius: 4
                        }}
                      >
                        {showVideoPreview ? '✕ Tutup Preview' : '▶️ Preview Media'}
                      </button>
                    )}
                    {cloudBaseUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          if (scheduleForm.media_url && !scheduleForm.media_url.startsWith('http')) {
                            setScheduleForm(prev => ({
                              ...prev,
                              media_url: `${cloudBaseUrl.replace(/\/$/, '')}/${prev.media_url.replace(/^\//, '')}`
                            }));
                          } else if (!scheduleForm.media_url) {
                            setScheduleForm(prev => ({ ...prev, media_url: cloudBaseUrl }));
                          }
                        }}
                        style={{
                          background: 'transparent', border: 'none', color: 'var(--link)',
                          fontSize: 10, cursor: 'pointer', textDecoration: 'underline', padding: 0
                        }}
                      >
                        ⚙️ Set Domain Cloud
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="url"
                  value={scheduleForm.media_url}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, media_url: e.target.value })}
                  placeholder="https://cloud.ast402.my.id/index.php/s/TOKEN/download?files=video_final.mp4"
                  style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--surface-interactive)', padding: '8px 10px', borderRadius: 6, color: 'var(--text-primary)', fontSize: 12 }}
                />

                {/* Mini Player Preview */}
                {showVideoPreview && scheduleForm.media_url && (
                  <div style={{ marginTop: 8, padding: 8, background: 'var(--surface)', borderRadius: 6, border: '1px solid #1e293b', textAlign: 'center' }}>
                    {scheduleForm.media_type === 'image' ? (
                      <img src={scheduleForm.media_url} alt="Preview" style={{ maxHeight: 200, maxWidth: '100%', borderRadius: 4, objectFit: 'contain' }} />
                    ) : (
                      <video
                        src={scheduleForm.media_url}
                        controls
                        autoPlay
                        style={{ maxHeight: 220, maxWidth: '100%', borderRadius: 4, background: '#000' }}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* 5. Caption & Tag */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>
                  Caption & Tag <span style={{ color: 'var(--link)', fontWeight: 400 }}>(Autoload dari Video)</span>
                </label>
                <textarea
                  rows={4}
                  value={scheduleForm.caption}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, caption: e.target.value })}
                  placeholder="Tulis caption lengkap beserta hashtag..."
                  style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--surface-interactive)', padding: '8px 10px', borderRadius: 6, color: 'var(--text-primary)', fontSize: 12, resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>Waktu Tayang</label>
                  <input
                    type="datetime-local"
                    value={scheduleForm.scheduled_at}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_at: e.target.value })}
                    required
                    style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--surface-interactive)', padding: '8px 10px', borderRadius: 6, color: 'var(--text-primary)', fontSize: 12 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>Zona Waktu</label>
                  <input
                    type="text"
                    value={scheduleForm.timezone}
                    readOnly
                    style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--surface-interactive)', padding: '8px 10px', borderRadius: 6, color: 'var(--text-muted)', fontSize: 12 }}
                  />
                </div>
              </div>

              {/* Preflight warning summary */}
              {preflightResult && (
                <div style={{ marginBottom: 14, padding: 10, background: preflightResult.isValid ? '#0f291e' : '#27171d', border: `1px solid ${preflightResult.isValid ? 'var(--status-success)' : 'var(--status-danger)'}`, borderRadius: 6, fontSize: 11 }}>
                  {preflightResult.warnings.map((w, i) => <div key={i} style={{ color: '#fcd34d' }}>⚠️ {w}</div>)}
                  {preflightResult.errors.map((err, i) => <div key={i} style={{ color: '#fca5a5' }}>❌ {err}</div>)}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={runPreflight}
                  disabled={runningPreflight}
                  style={{ padding: '9px 14px', background: 'var(--surface)', border: '1px solid #334155', color: 'var(--text-secondary)', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}
                >
                  {runningPreflight ? 'Memeriksa...' : '🔍 Preflight Check'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  style={{ padding: '9px 14px', background: 'transparent', border: '1px solid #334155', color: 'var(--text-muted)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingSchedule}
                  style={{ padding: '9px 18px', background: 'var(--status-neutral)', border: '1px solid var(--status-neutral)', color: 'var(--text-primary)', borderRadius: 6, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
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
          position: 'fixed', inset: 0, background: 'var(--overlay-backdrop)',
          display: 'grid', placeItems: 'center', zIndex: 9999, padding: 16
        }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--surface-interactive)', borderRadius: 14,
            width: '100%', maxWidth: 400, padding: 20, color: 'var(--text-primary)'
          }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 800 }}>Ubah Jadwal Publikasi</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px' }}>
              Pilih tanggal dan jam baru untuk job #{rescheduleModalJob.id}:
            </p>
            <input
              type="datetime-local"
              value={newScheduleTime}
              onChange={(e) => setNewScheduleTime(e.target.value)}
              style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--surface-interactive)', padding: '8px 10px', borderRadius: 6, color: 'var(--text-primary)', fontSize: 12, marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setRescheduleModalJob(null)}
                style={{ padding: '8px 14px', background: 'transparent', border: '1px solid #334155', color: 'var(--text-muted)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteReschedule}
                disabled={submittingReschedule}
                style={{ padding: '8px 16px', background: 'var(--status-neutral)', border: '1px solid var(--status-neutral)', color: 'var(--text-primary)', borderRadius: 6, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
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
