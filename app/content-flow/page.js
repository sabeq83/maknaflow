'use client';

import Sidebar from '../components/Sidebar';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PublishingScheduler from './PublishingScheduler';

const SearchIcon = ({ style }) => (
  <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const LayersIcon = ({ style }) => (
  <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0l-7 7m7-7l-7-7" />
  </svg>
);
const CheckCircleIcon = ({ style }) => (
  <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const ClockIcon = ({ style }) => (
  <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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
const FilmIcon = ({ style }) => (
  <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="2" y="4" width="20" height="16" rx="2" strokeWidth="2" />
    <path d="M7 4v16M17 4v16M2 8h20M2 16h20" strokeWidth="2" />
  </svg>
);
const XIcon = ({ style }) => (
  <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const getBrandBadgeStyle = (accountName) => {
  const acc = (accountName || '').toLowerCase().trim();
  if (acc === 'dummybrand01' || acc.includes('blue') || acc.includes('skincare')) {
    return {
      background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.25) 0%, rgba(59, 130, 246, 0.25) 100%)',
      border: '1px solid #3b82f6',
      color: '#93c5fd',
      boxShadow: '0 2px 10px rgba(59, 130, 246, 0.35)'
    };
  }
  if (acc === 'dummybrand02' || acc.includes('red') || acc.includes('food')) {
    return {
      background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.25) 0%, rgba(239, 68, 68, 0.25) 100%)',
      border: '1px solid #ef4444',
      color: '#fca5a5',
      boxShadow: '0 2px 10px rgba(239, 68, 68, 0.35)'
    };
  }
  if (acc === 'siasatsehat' || acc.includes('sehat') || acc.includes('health')) {
    return {
      background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.3) 0%, rgba(16, 185, 129, 0.3) 100%)',
      border: '1px solid #10b981',
      color: '#6ee7b7',
      boxShadow: '0 2px 10px rgba(16, 185, 129, 0.4)'
    };
  }
  // Fallback Option D (Sleek Emerald Green)
  return {
    background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.25) 0%, rgba(16, 185, 129, 0.25) 100%)',
    border: '1px solid #10b981',
    color: '#6ee7b7',
    boxShadow: '0 2px 10px rgba(16, 185, 129, 0.35)'
  };
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

function ContentFlowHubPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const accountQuery = searchParams.get('account') || 'all';
  const initialView = searchParams.get('view') === 'publishing' ? 'publishing' : 'library';

  const [mainView, setMainView] = useState(initialView);
  const [schedulePreloadItem, setSchedulePreloadItem] = useState(null);

  const [items, setItems] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState(accountQuery);
  const [productFilter, setProductFilter] = useState('all');
  const [pipelineFilter, setPipelineFilter] = useState('Completed');
  const [tiktokFilter, setTiktokFilter] = useState('Semua');
  const [fbFilter, setFbFilter] = useState('Semua');
  const [igFilter, setIgFilter] = useState('Semua');

  useEffect(() => {
    if (accountQuery) {
      setAccountFilter(accountQuery);
    }
  }, [accountQuery]);

  const [availableAccounts, setAvailableAccounts] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');

  // Admin Skedul Controller & Header Controller Card State
  const [activeBrandSchedules, setActiveBrandSchedules] = useState([]);
  const [showAdminScheduleModal, setShowAdminScheduleModal] = useState(false);
  const [adminSlotsForm, setAdminSlotsForm] = useState([
    { slot_index: 1, product_id: '', product_name: '', target_daily_posts: 1 },
    { slot_index: 2, product_id: '', product_name: '', target_daily_posts: 1 },
    { slot_index: 3, product_id: '', product_name: '', target_daily_posts: 1 },
    { slot_index: 4, product_id: '', product_name: '', target_daily_posts: 1 },
    { slot_index: 5, product_id: '', product_name: '', target_daily_posts: 1 }
  ]);
  const [savingSchedule, setSavingSchedule] = useState(false);

  // User Session & RBAC Permissions State
  const [currentUser, setCurrentUser] = useState(null);

  const getStatusSelectStyle = (statusVal) => {
    if (statusVal === 'Published') {
      return { background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#34d399', fontWeight: 700 };
    }
    if (statusVal === 'Scheduled') {
      return { background: 'rgba(245, 158, 11, 0.2)', border: '1px solid #fbbf24', color: '#fcd34d', fontWeight: 700 };
    }
    if (statusVal === 'Skipped') {
      return { background: 'rgba(168, 85, 247, 0.2)', border: '1px solid #a855f7', color: '#e9d5ff', fontWeight: 700 };
    }
    return { background: '#05070d', border: '1px solid #334155', color: '#a1a1aa' };
  };

  const getDateInputStyle = (dateVal) => {
    if (dateVal && dateVal.trim() !== '') {
      return { background: 'rgba(59, 130, 246, 0.18)', border: '1px solid #60a5fa', color: '#93c5fd', fontWeight: 700 };
    }
    return { background: '#05070d', border: '1px solid #334155', color: '#71717a' };
  };

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => { });
  }, []);

  const canEditProductLink = currentUser && (currentUser.role === 'admin' || (Array.isArray(currentUser.menuPermissions) && currentUser.menuPermissions.includes('edit_link_product')));
  const canEditAffiliateLink = currentUser && (currentUser.role === 'admin' || (Array.isArray(currentUser.menuPermissions) && currentUser.menuPermissions.includes('edit_link_affiliate')));
  const canEditProductName = currentUser && (currentUser.role === 'admin' || (Array.isArray(currentUser.menuPermissions) && currentUser.menuPermissions.includes('edit_nama_product')));

  // Detail Modal State
  const [activeItem, setActiveItem] = useState(null);
  const [directDownloadUrl, setDirectDownloadUrl] = useState(null);
  const [loadingDownloadUrl, setLoadingDownloadUrl] = useState(false);
  const [copiedKeys, setCopiedKeys] = useState({});
  const [downloadCooldowns, setDownloadCooldowns] = useState({});

  const getDirectDownloadUrl = (nextcloudUrl, videoId) => {
    if (!nextcloudUrl || !videoId) return null;
    const cleanUrl = nextcloudUrl.replace(/\/+$/, '');
    const cleanVideoId = videoId.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');
    const filename = `${cleanVideoId}_final.mp4`;
    return `${cleanUrl}/download?files=${encodeURIComponent(filename)}`;
  };

  const handleDownload = (itemId, downloadUrl) => {
    if (!downloadUrl) return;
    window.open(downloadUrl, '_blank');
    setDownloadCooldowns(prev => ({ ...prev, [itemId]: true }));
    setTimeout(() => {
      setDownloadCooldowns(prev => ({ ...prev, [itemId]: false }));
    }, 30000);
  };
  const [editStatusForm, setEditStatusForm] = useState({
    tiktok_status: 'Not Published',
    tiktok_publish_date: '',
    permalink_tiktok: '',
    facebook_status: 'Not Published',
    facebook_publish_date: '',
    permalink_facebook: '',
    instagram_status: 'Not Published',
    instagram_publish_date: '',
    permalink_instagram: '',
    account_name: '',
    drive_link: '',
    nextcloud_url: '',
    nama_produk: '',
    link_produk: '',
    link_affiliate: ''
  });
  const [savingStatus, setSavingStatus] = useState(false);
  const [editingInlineField, setEditingInlineField] = useState(null);
  const [inlineValue, setInlineValue] = useState('');
  const [isProductSectionOpen, setIsProductSectionOpen] = useState(true);

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3200);
  }, []);

  const fallbackCopyToClipboard = useCallback((text, label, key = null) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed"; // hindari scroll halaman
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        showToast(`${label || 'Teks'} berhasil disalin ke clipboard! 📋`);
        if (key) {
          setCopiedKeys(prev => ({ ...prev, [key]: true }));
          setTimeout(() => {
            setCopiedKeys(prev => ({ ...prev, [key]: false }));
          }, 2000);
        }
      } else {
        showToast(`Gagal menyalin ${label || 'Teks'} ❌`);
      }
    } catch (err) {
      console.error('Fallback copy failed:', err);
      showToast(`Gagal menyalin ${label || 'Teks'} ❌`);
    }
  }, [showToast]);

  const copyToClipboard = useCallback((text, label, key = null) => {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          showToast(`${label || 'Teks'} berhasil disalin ke clipboard! 📋`);
          if (key) {
            setCopiedKeys(prev => ({ ...prev, [key]: true }));
            setTimeout(() => {
              setCopiedKeys(prev => ({ ...prev, [key]: false }));
            }, 2000);
          }
        })
        .catch(err => {
          console.warn('Navigator clipboard copy failed, falling back...', err);
          fallbackCopyToClipboard(text, label, key);
        });
    } else {
      fallbackCopyToClipboard(text, label, key);
    }
  }, [showToast, fallbackCopyToClipboard]);

  const resetFilters = useCallback(() => {
    setSearchTerm('');
    setSourceFilter('all');
    setAccountFilter('all');
    setProductFilter('all');
    setPipelineFilter('Completed');
    setTiktokFilter('Semua');
    setFbFilter('Semua');
    setIgFilter('Semua');
  }, []);

  const fetchBrandSchedules = useCallback(async (brandName) => {
    if (!brandName || brandName === 'all') {
      setActiveBrandSchedules([]);
      return;
    }
    try {
      const res = await fetch(`/api/v2/content-flow/schedules?brandId=${encodeURIComponent(brandName)}`);
      const data = await res.json();
      if (data.success) {
        setActiveBrandSchedules(data.schedules || []);
      }
    } catch (e) {
      console.error('Failed to fetch brand schedules:', e);
    }
  }, []);

  const loadContent = useCallback(async () => {
    try {
      setLoading(true);
      let url = `/api/content-flow?page=1&limit=50&`;
      if (searchTerm.trim()) url += `q=${encodeURIComponent(searchTerm.trim())}&`;
      if (sourceFilter !== 'all') url += `source_type=${encodeURIComponent(sourceFilter)}&`;
      if (accountFilter !== 'all') url += `account=${encodeURIComponent(accountFilter)}&`;
      if (productFilter !== 'all') url += `product=${encodeURIComponent(productFilter)}&`;
      if (pipelineFilter !== 'all') url += `pipeline_status=${encodeURIComponent(pipelineFilter)}&`;
      if (tiktokFilter !== 'Semua') url += `tiktok_status=${encodeURIComponent(tiktokFilter)}&`;
      if (fbFilter !== 'Semua') url += `facebook_status=${encodeURIComponent(fbFilter)}&`;
      if (igFilter !== 'Semua') url += `instagram_status=${encodeURIComponent(igFilter)}&`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
        setTotalItems(data.total_items || 0);
        setAvailableAccounts(data.available_accounts || []);
        setAvailableProducts(data.available_products || []);
      }
    } catch (err) {
      console.error('Failed to load content flow:', err);
      showToast('Gagal memuat konten: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, sourceFilter, accountFilter, productFilter, pipelineFilter, tiktokFilter, fbFilter, igFilter, showToast]);

  useEffect(() => {
    loadContent();
    if (accountFilter && accountFilter !== 'all') {
      fetchBrandSchedules(accountFilter);
    }
  }, [loadContent, accountFilter, fetchBrandSchedules]);

  function openAdminScheduleModal() {
    let targetBrand = accountFilter;
    if (!targetBrand || targetBrand === 'all') {
      if (availableAccounts.length > 0) {
        targetBrand = availableAccounts[0];
        setAccountFilter(targetBrand);
        router.push(`/content-flow?account=${encodeURIComponent(targetBrand)}`);
      } else {
        showToast('Pilih salah satu Akun Brand terlebih dahulu untuk mengatur Skedul!');
        return;
      }
    }
    const initialSlots = [1, 2, 3, 4, 5].map(idx => {
      const existing = activeBrandSchedules.find(s => s.slot_index === idx);
      return {
        slot_index: idx,
        product_id: existing?.product_id || '',
        product_name: existing ? (existing.product_name || '') : '',
        target_daily_posts: existing?.target_daily_posts || 1
      };
    });
    setAdminSlotsForm(initialSlots);
    setShowAdminScheduleModal(true);
  }

  async function handleSaveBrandSchedules(e) {
    if (e) e.preventDefault();
    if (!accountFilter || accountFilter === 'all') return;
    setSavingSchedule(true);
    try {
      const res = await fetch('/api/v2/content-flow/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: accountFilter,
          slots: adminSlotsForm
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Skedul 5 Produk Aktif berhasil diperbarui! 📅✨');
        setShowAdminScheduleModal(false);
        fetchBrandSchedules(accountFilter);
      } else {
        showToast('Gagal simpan skedul: ' + data.error);
      }
    } catch (err) {
      showToast('Error save schedule: ' + err.message);
    } finally {
      setSavingSchedule(false);
    }
  }

  async function handleTriggerRetroSync() {
    setSyncing(true);
    try {
      const res = await fetch('/api/content-flow/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        loadContent();
      } else {
        showToast('Sync error: ' + data.error);
      }
    } catch (err) {
      showToast('Error sync: ' + err.message);
    } finally {
      setSyncing(false);
    }
  }

  function openDetailModal(item) {
    setActiveItem(item);
    setDirectDownloadUrl(null);
    setEditStatusForm({
      tiktok_status: item.tiktok_status || 'Not Published',
      tiktok_publish_date: item.tiktok_publish_date || '',
      permalink_tiktok: item.permalink_tiktok || '',
      facebook_status: item.facebook_status || 'Not Published',
      facebook_publish_date: item.facebook_publish_date || '',
      permalink_facebook: item.permalink_facebook || '',
      instagram_status: item.instagram_status || 'Not Published',
      instagram_publish_date: item.instagram_publish_date || '',
      permalink_instagram: item.permalink_instagram || '',
      account_name: item.account_name || '',
      drive_link: item.drive_link || '',
      nextcloud_url: item.nextcloud_url || '',
      nama_produk: item.nama_produk || '',
      link_produk: item.link_produk || '',
      link_affiliate: item.link_affiliate || '',
      catatan: item.catatan || ''
    });

    if (item.nextcloud_url) {
      setLoadingDownloadUrl(true);
      fetch(`/api/content-flow/media-files?videoId=${encodeURIComponent(item.video_id)}&folderUrl=${encodeURIComponent(item.nextcloud_url)}`)
        .then(res => res.json())
        .then(json => {
          if (json.success && json.defaultFile) {
            setDirectDownloadUrl(json.defaultFile.directUrl);
          }
        })
        .catch(err => console.error('Error fetching media files:', err))
        .finally(() => setLoadingDownloadUrl(false));
    }
  }

  async function handleSaveStatus(e) {
    if (e) e.preventDefault();
    if (!activeItem) return;
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/content-flow/${activeItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editStatusForm)
      });
      const data = await res.json();
      if (data.success) {
        showToast('Data & status publishing berhasil diperbarui! ✨');
        
        // Update local items state secara instan
        setItems(prevItems => prevItems.map(it => 
          String(it.id) === String(activeItem.id) 
            ? { ...it, ...editStatusForm } 
            : it
        ));

        setActiveItem(null); // Auto-close modal on save!
        loadContent();
        if (accountFilter && accountFilter !== 'all') {
          fetchBrandSchedules(accountFilter);
        }
      } else {
        showToast('Gagal update: ' + data.error);
      }
    } catch (err) {
      showToast('Error update: ' + err.message);
    } finally {
      setSavingStatus(false);
    }
  }

  // Admin Item Delete Handler
  async function handleDeleteItem(itemId) {
    if (!confirm('Apakah Anda yakin ingin menghapus video konten ini secara permanen dari ContentFlow?')) return;
    try {
      const res = await fetch(`/api/content-flow/${itemId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Konten berhasil dihapus! 🗑️');
        if (activeItem && activeItem.id === itemId) {
          setActiveItem(null);
        }
        loadContent();
      } else {
        showToast('Gagal menghapus: ' + data.error);
      }
    } catch (err) {
      showToast('Error hapus: ' + err.message);
    }
  }

  // Option 2 Brand Delete Safety Modal State & Handler
  const [deleteBrandTarget, setDeleteBrandTarget] = useState(null);
  const [deleteBrandConfirmInput, setDeleteBrandConfirmInput] = useState('');
  const [deletingBrand, setDeletingBrand] = useState(false);

  async function handleConfirmDeleteBrand() {
    if (!deleteBrandTarget) return;
    if (deleteBrandConfirmInput.trim().toLowerCase() !== deleteBrandTarget.trim().toLowerCase()) {
      showToast('Nama brand yang diketik tidak cocok!');
      return;
    }
    setDeletingBrand(true);
    try {
      const res = await fetch(`/api/content-flow/brands?account=${encodeURIComponent(deleteBrandTarget)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Seluruh konten brand @${deleteBrandTarget} berhasil dihapus! 🗑️`);
        setDeleteBrandTarget(null);
        setDeleteBrandConfirmInput('');
        setAccountFilter('all');
        router.push('/content-flow?account=all');
        loadContent();
      } else {
        showToast('Gagal menghapus brand: ' + data.error);
      }
    } catch (err) {
      showToast('Error hapus brand: ' + err.message);
    } finally {
      setDeletingBrand(false);
    }
  }

  async function handleSaveInlineField(fieldKey) {
    if (!activeItem) return;
    setSavingStatus(true);
    try {
      const payload = { [fieldKey]: inlineValue };
      const res = await fetch(`/api/content-flow/${activeItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Berhasil memperbarui ${fieldKey.replace('_', ' ')}! ✏️`);
        const updatedItem = data.item || { ...activeItem, [fieldKey]: inlineValue };

        // 1. Update activeItem state immediately
        setActiveItem(updatedItem);
        setEditStatusForm(prev => ({ ...prev, [fieldKey]: inlineValue }));

        // 2. Update items array in state so background cards and top buttons update instantly
        setItems(prevItems => prevItems.map(it => String(it.id) === String(activeItem.id) ? { ...it, [fieldKey]: inlineValue } : it));

        setEditingInlineField(null);
        loadContent();
      } else {
        showToast('Gagal memperbarui: ' + (data.error || 'Server error'));
      }
    } catch (err) {
      showToast('Error: ' + err.message);
    } finally {
      setSavingStatus(false);
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Published':
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '12px',
            background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)',
            fontSize: '11px', fontWeight: 600
          }}>
            <CheckCircleIcon style={{ width: 12, height: 12, color: '#34d399' }} /> Published
          </span>
        );
      case 'Scheduled':
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '12px',
            background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)',
            fontSize: '11px', fontWeight: 600
          }}>
            <ClockIcon style={{ width: 12, height: 12, color: '#fbbf24' }} /> Scheduled
          </span>
        );
      default:
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '12px',
            background: 'rgba(39, 39, 42, 0.8)', color: '#9ca3af', border: '1px solid rgba(63, 63, 70, 0.8)',
            fontSize: '11px', fontWeight: 500
          }}>
            <AlertCircleIcon style={{ width: 12, height: 12, color: '#9ca3af' }} /> Not Published
          </span>
        );
    }
  };

  const getSourceBadge = (sourceType) => {
    const badges = {
      opc: { label: 'OPC Pillar', bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)' },
      strategic: { label: 'Strategic (SC)', bg: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: 'rgba(99, 102, 241, 0.35)' },
      re: { label: 'Reverse Eng (RE)', bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' },
      instant: { label: 'Instant Factory', bg: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', border: 'rgba(236, 72, 153, 0.3)' },
      recipe: { label: 'Recipe Labs', bg: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', border: 'rgba(139, 92, 246, 0.3)' },
      bridge: { label: 'Bridge Injector', bg: 'rgba(6, 182, 212, 0.15)', color: '#38bdf8', border: 'rgba(6, 182, 212, 0.3)' }
    };
    const b = badges[sourceType] || badges.opc;
    return (
      <span style={{
        padding: '3px 9px', borderRadius: '12px', background: b.bg, color: b.color,
        border: `1px solid ${b.border}`, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase'
      }}>
        {b.label}
      </span>
    );
  };

  const publishedCount = items.filter(
    (i) => i.tiktok_status === 'Published' || i.facebook_status === 'Published' || i.instagram_status === 'Published'
  ).length;
  const scheduledCount = items.filter(
    (i) => i.tiktok_status === 'Scheduled' || i.facebook_status === 'Scheduled' || i.instagram_status === 'Scheduled'
  ).length;

  return (
    <div className="layout-with-sidebar">
      <Sidebar />

      <main className="main-content" style={{ padding: '28px 32px', background: '#0a0a0c', minHeight: '100vh', color: '#f3f4f6' }}>
        {/* Centered Main Container (1050px) setara OPC / RE */}
        <div style={{ maxWidth: '1050px', margin: '0 auto' }}>
          {/* Toast Notification */}
          {toastMsg && (
            <div style={{
              position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
              padding: '12px 24px', borderRadius: '12px', background: '#2563eb',
              color: '#fff', fontWeight: 600, fontSize: '14px', boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
              display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(96, 165, 250, 0.4)'
            }}>
              <CheckCircleIcon style={{ width: 16, height: 16 }} />
              <span>{toastMsg}</span>
            </div>
          )}

          {/* Top Control Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '10px', borderRadius: '14px', background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)', color: '#fff' }}>
                  <LayersIcon style={{ width: 24, height: 24 }} />
                </div>
                <div>
                  <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                    ContentFlow Publishing Tracker Hub
                  </h1>
                  <p style={{ color: '#9ca3af', fontSize: '13px', margin: '2px 0 0' }}>
                    Pusat pemantauan & manajemen status tayang konten media sosial dari seluruh mesin kampanye MAKNA Flow.
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              {(!currentUser || currentUser.role === 'admin') && (
                <button
                  onClick={openAdminScheduleModal}
                  style={{
                    padding: '10px 18px', background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                    color: '#fff', border: '1px solid #c084fc', borderRadius: '10px', fontWeight: 700, cursor: 'pointer',
                    fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(168, 85, 247, 0.35)'
                  }}
                  title="Atur 5 Produk Aktif & Target Posting (Admin Only)"
                >
                  <span>📅 Skedul Controller (Admin)</span>
                </button>
              )}
              <button
                onClick={handleTriggerRetroSync}
                disabled={syncing}
                style={{
                  padding: '10px 18px', background: syncing ? '#1e293b' : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  color: '#fff', border: '1px solid #10b981', borderRadius: '10px', fontWeight: 700, cursor: syncing ? 'not-allowed' : 'pointer',
                  fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
                }}
              >
                <RefreshCwIcon style={{ width: 14, height: 14, animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
                <span>{syncing ? '⏳ Menyinkronkan...' : '🔄 Sync Seluruh Aset Kampanye'}</span>
              </button>
            </div>
          </div>

          {/* Primary View Switcher: Content Library vs Publishing Scheduler */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #1f293d', paddingBottom: '14px' }}>
            <button
              onClick={() => { setMainView('library'); setSchedulePreloadItem(null); }}
              style={{
                padding: '9px 18px',
                borderRadius: '10px',
                background: mainView === 'library' ? '#2563eb' : '#111827',
                border: `1px solid ${mainView === 'library' ? '#60a5fa' : '#27272a'}`,
                color: '#fff',
                fontSize: '13px',
                fontWeight: 750,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: mainView === 'library' ? '0 4px 14px rgba(37, 99, 235, 0.35)' : 'none'
              }}
            >
              <LayersIcon style={{ width: 15, height: 15 }} />
              <span>▣ Content Library</span>
            </button>
            <button
              onClick={() => setMainView('publishing')}
              style={{
                padding: '9px 18px',
                borderRadius: '10px',
                background: mainView === 'publishing' ? 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)' : '#111827',
                border: `1px solid ${mainView === 'publishing' ? '#c084fc' : '#27272a'}`,
                color: '#fff',
                fontSize: '13px',
                fontWeight: 750,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: mainView === 'publishing' ? '0 4px 14px rgba(168, 85, 247, 0.35)' : 'none'
              }}
            >
              <ClockIcon style={{ width: 15, height: 15 }} />
              <span>⏱️ Publishing Scheduler</span>
            </button>
          </div>

          {mainView === 'publishing' ? (
            <PublishingScheduler
              initialPreloadItem={schedulePreloadItem}
              onBackToLibrary={() => { setMainView('library'); setSchedulePreloadItem(null); }}
            />
          ) : (
            <>
              {/* Quick Metrics Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            <div style={{ padding: '16px', borderRadius: '16px', background: 'rgba(18, 19, 24, 0.8)', border: '1px solid #27272a' }}>
              <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 600, display: 'block' }}>Total Konten Terindeks</span>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '6px' }}>
                <span style={{ fontSize: '26px', fontWeight: 800, color: '#ffffff' }}>{totalItems}</span>
                <span style={{ fontSize: '11px', color: '#6b7280' }}>Video Items</span>
              </div>
            </div>

            <div style={{ padding: '16px', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <span style={{ fontSize: '12px', color: '#34d399', fontWeight: 600, display: 'block' }}>Telah Publish</span>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '6px' }}>
                <span style={{ fontSize: '26px', fontWeight: 800, color: '#34d399' }}>{publishedCount}</span>
                <span style={{ fontSize: '11px', color: '#059669', fontFamily: 'monospace' }}>Completed</span>
              </div>
            </div>

            <div style={{ padding: '16px', borderRadius: '16px', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <span style={{ fontSize: '12px', color: '#fbbf24', fontWeight: 600, display: 'block' }}>Terjadwal (Scheduled)</span>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '6px' }}>
                <span style={{ fontSize: '26px', fontWeight: 800, color: '#fbbf24' }}>{scheduledCount}</span>
                <span style={{ fontSize: '11px', color: '#d97706', fontFamily: 'monospace' }}>Queue</span>
              </div>
            </div>

            <div style={{ padding: '16px', borderRadius: '16px', background: 'rgba(18, 19, 24, 0.8)', border: '1px solid #27272a' }}>
              <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 600, display: 'block' }}>Produk Aktif</span>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '6px' }}>
                <span style={{ fontSize: '26px', fontWeight: 800, color: '#60a5fa' }}>{availableProducts.length}</span>
                <span style={{ fontSize: '11px', color: '#6b7280' }}>Skus</span>
              </div>
            </div>
          </div>

          {/* Header Controller Card: 5 Active Products Progress */}
          {accountFilter !== 'all' && (
            <div style={{
              padding: '18px 22px', borderRadius: '18px', background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.6) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.35)', boxShadow: '0 10px 30px rgba(0,0,0,0.35)', marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>📊</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' }}>
                    Target Posting Hari Ini — <span style={{ color: '#34d399' }}>@{accountFilter}</span>
                  </span>
                </div>
                {(!currentUser || currentUser.role === 'admin') && (
                  <button
                    onClick={openAdminScheduleModal}
                    style={{ background: 'none', border: 'none', color: '#a855f7', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    ✏️ Edit Skedul (5 Produk)
                  </button>
                )}
              </div>

              {(() => {
                const filledSlots = activeBrandSchedules.filter(s => s.product_name && s.product_name.trim() !== '');
                if (filledSlots.length === 0) {
                  return (
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '8px 0' }}>
                      Belum ada produk aktif yang diisi pada skedul ini. {(!currentUser || currentUser.role === 'admin') && 'Klik "Edit Skedul" untuk memilih produk aktif.'}
                    </div>
                  );
                }

                return (
                  <div className="custom-schedule-scroll" style={{ display: 'flex', justifyContent: 'center', gap: '16px', overflowX: 'auto', padding: '8px 4px 16px 4px', width: '100%' }}>
                    <style dangerouslySetInnerHTML={{ __html: `
                      .product-schedule-card:hover {
                        transform: translateY(-4px);
                        border-color: rgba(16, 185, 129, 0.5) !important;
                        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4), 0 0 15px rgba(16, 185, 129, 0.25) !important;
                      }
                      .product-schedule-card-pending:hover {
                        transform: translateY(-4px);
                        border-color: rgba(245, 158, 11, 0.5) !important;
                        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4), 0 0 15px rgba(245, 158, 11, 0.25) !important;
                      }
                      .custom-schedule-scroll::-webkit-scrollbar {
                        height: 6px;
                      }
                      .custom-schedule-scroll::-webkit-scrollbar-track {
                        background: rgba(255, 255, 255, 0.02);
                        border-radius: 10px;
                      }
                      .custom-schedule-scroll::-webkit-scrollbar-thumb {
                        background: rgba(255, 255, 255, 0.08);
                        border-radius: 10px;
                      }
                      .custom-schedule-scroll::-webkit-scrollbar-thumb:hover {
                        background: rgba(255, 255, 255, 0.18);
                      }
                    `}} />
                    {filledSlots.map((slot) => {
                      const prodName = slot.product_name;
                      const targetCount = slot.target_daily_posts || 1;
                      const publishedToday = slot.published_today || 0;

                      const radius = 28;
                      const circumference = 2 * Math.PI * radius;
                      const percent = Math.min(100, Math.max(0, (publishedToday / targetCount) * 100));
                      const strokeDashoffset = circumference - (percent / 100) * circumference;
                      const isCompleted = publishedToday >= targetCount;
                      const isActive = productFilter.toLowerCase() === prodName.toLowerCase();

                      const accentColor = isCompleted ? '#10b981' : '#f59e0b';
                      const glowShadow = isActive 
                        ? 'rgba(16, 185, 129, 0.55)' 
                        : (isCompleted ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.2)');

                      // Get active product image path
                      const activeField = slot.active_photo || 'cleaned_photo_url';
                      const prodImageUrl = slot[activeField] || slot.cleaned_photo_url || slot.clean_photo_url || slot.generated_photo_url || '';

                      return (
                        <div
                          key={slot.slot_index}
                          className={isCompleted ? "product-schedule-card" : "product-schedule-card-pending"}
                          onClick={() => {
                            if (isActive) {
                              setProductFilter('all');
                            } else {
                              setProductFilter(prodName);
                            }
                          }}
                          style={{
                            display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center',
                            flexGrow: 1, flexShrink: 1, minWidth: '144px', maxWidth: '200px',
                            height: '215px', padding: '12px 10px', borderRadius: '16px',
                            background: isActive
                              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(15, 23, 42, 0.95) 100%)'
                              : (isCompleted
                                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(15, 23, 42, 0.9) 100%)'
                                  : 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.5) 100%)'),
                            border: isActive 
                              ? '2px solid #10b981' 
                              : `1px solid ${isCompleted ? '#10b981' : 'rgba(255, 255, 255, 0.08)'}`,
                            boxShadow: isActive
                              ? '0 8px 32px rgba(16, 185, 129, 0.4), 0 0 20px rgba(16, 185, 129, 0.35)'
                              : `0 4px 16px rgba(0,0,0,0.2), 0 0 12px ${glowShadow}`,
                            transform: isActive ? 'translateY(-6px)' : 'none',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'pointer'
                          }}
                        >
                          {/* Product Name (Top) */}
                          <div style={{
                            fontSize: '11px', fontWeight: 800, color: '#f8fafc', textAlign: 'center',
                            display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical',
                            overflow: 'hidden', textOverflow: 'ellipsis', height: '28px', lineHeight: '14px', width: '100%'
                          }}>
                            {prodName}
                          </div>

                          {/* Large Product Image (Middle - Square 1:1) */}
                          <div style={{
                            width: '90px', height: '90px', position: 'relative', borderRadius: '12px',
                            overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', margin: '8px 0',
                            background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'center', alignItems: 'center'
                          }}>
                            {prodImageUrl ? (
                              <img
                                src={prodImageUrl}
                                alt={prodName}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => {
                                  // Fallback to placeholder emoji if image fails to load
                                  e.target.style.display = 'none';
                                  const parent = e.target.parentNode;
                                  const fb = document.createElement('div');
                                  fb.style.width = '100%';
                                  fb.style.height = '100%';
                                  fb.style.background = 'rgba(255,255,255,0.03)';
                                  fb.style.display = 'flex';
                                  fb.style.justifyContent = 'center';
                                  fb.style.alignItems = 'center';
                                  fb.style.fontSize = '24px';
                                  fb.innerText = '📦';
                                  parent.appendChild(fb);
                                }}
                              />
                            ) : (
                              <div style={{
                                width: '100%', height: '100%', background: 'rgba(255,255,255,0.03)',
                                display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '24px'
                              }}>
                                📦
                              </div>
                            )}
                          </div>

                          {/* Sleek Progress Bar (Bottom) */}
                          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#94a3b8' }}>
                              <span>Progress:</span>
                              <span style={{ fontWeight: 800, color: accentColor }}>{publishedToday}/{targetCount}</span>
                            </div>
                            <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ width: `${percent}%`, height: '100%', background: accentColor, borderRadius: '2px', transition: 'width 0.4s ease' }} />
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div style={{
                            fontSize: '8px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                            color: accentColor, background: isCompleted ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                            padding: '2px 8px', borderRadius: '20px', border: `1px solid ${accentColor}25`, marginTop: '6px'
                          }}>
                            {isCompleted ? 'Completed' : 'In Progress'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Quick-Switch Brand Account Tab Bar */}
          {availableAccounts.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
              overflowX: 'auto',
              paddingBottom: '4px'
            }}>
              <button
                onClick={() => {
                  setAccountFilter('all');
                  router.push('/content-flow?account=all');
                }}
                style={{
                  padding: '7px 16px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: accountFilter === 'all' ? '1px solid #10b981' : '1px solid #27272a',
                  background: accountFilter === 'all' ? 'rgba(16, 185, 129, 0.15)' : '#121318',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>🌐</span> Semua Akun ({totalItems})
              </button>
              {(() => {
                const userAssigned = (currentUser && Array.isArray(currentUser.assignedBrandNames) && currentUser.assignedBrandNames.length > 0)
                  ? currentUser.assignedBrandNames
                  : [];
                const displayAccs = (currentUser && currentUser.role === 'admin')
                  ? availableAccounts
                  : availableAccounts.filter(acc => userAssigned.map(b => b.toLowerCase()).includes(acc.toLowerCase()));
                return displayAccs.map((acc) => {
                  const isSelected = accountFilter.toLowerCase() === acc.toLowerCase();
                  return (
                    <button
                      key={acc}
                      onClick={() => {
                        setAccountFilter(acc);
                        router.push(`/content-flow?account=${encodeURIComponent(acc)}`);
                      }}
                      style={{
                        padding: '7px 16px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: isSelected ? '1px solid #10b981' : '1px solid #27272a',
                        background: isSelected ? 'rgba(16, 185, 129, 0.15)' : '#121318',
                        color: isSelected ? '#34d399' : '#e4e4e7',
                        transition: 'all 0.2s ease',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>🏷️</span> @{acc}
                    </button>
                  );
                });
              })()}

              {/* Admin-only Brand Deletion Button */}
              {currentUser?.role === 'admin' && accountFilter !== 'all' && (
                <button
                  onClick={() => {
                    setDeleteBrandTarget(accountFilter);
                    setDeleteBrandConfirmInput('');
                  }}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: '#f87171',
                    marginLeft: 'auto',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Hapus seluruh konten brand ini (Admin Only)"
                >
                  <span>🗑️</span> Hapus Brand "{accountFilter}"
                </button>
              )}
            </div>
          )}

          {/* Multi-level Search & Filter Panel */}
          <div style={{ padding: '20px', borderRadius: '16px', background: '#121318', border: '1px solid #27272a', marginBottom: '24px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
            {/* Row 1: Universal Search & Metadata Filters (4 Columns) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              {/* Universal Search */}
              <div style={{ position: 'relative' }}>
                <SearchIcon style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#9ca3af' }} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari ID Video, Hook, Produk, Caption..."
                  style={{
                    width: '100%', padding: '9px 12px 9px 36px', borderRadius: '10px', background: '#09090b',
                    border: '1px solid #3f3f46', color: '#fff', fontSize: '12px', outline: 'none'
                  }}
                />
              </div>

              {/* Campaign Source Type Filter */}
              <div>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', background: '#09090b', border: '1px solid #3f3f46', color: '#e4e4e7', fontSize: '12px', outline: 'none' }}
                >
                  <option value="all">Semua Sumber Kampanye (All)</option>
                  <option value="opc">🌱 OPC (Organic Pillar)</option>
                  <option value="strategic">🎯 Strategic Campaign</option>
                  <option value="re">🔄 Reverse Engineering</option>
                  <option value="instant">⚡ Instant Factory</option>
                  <option value="recipe">🧪 Recipe Labs</option>
                  <option value="bridge">🔗 Bridge Injector</option>
                </select>
              </div>

              {/* Pipeline Status Filter */}
              <div>
                <select
                  value={pipelineFilter}
                  onChange={(e) => setPipelineFilter(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', background: '#09090b', border: '1px solid #3f3f46', color: '#e4e4e7', fontSize: '12px', outline: 'none' }}
                >
                  <option value="all">Semua Status Produksi (All)</option>
                  <option value="Completed">🎬 Completed (Siap Publish)</option>
                  <option value="In Production">⚙️ In Production (Diproses)</option>
                </select>
              </div>

              {/* Product Filter with Search Box */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <input
                  type="text"
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                  placeholder="🔎 Filter SKU Produk..."
                  style={{
                    width: '100%', padding: '5px 9px', borderRadius: '6px', background: '#09090b',
                    border: '1px solid #3f3f46', color: '#34d399', fontSize: '11px', outline: 'none'
                  }}
                />
                <select
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                  style={{ width: '100%', padding: '6px 9px', borderRadius: '6px', background: '#09090b', border: '1px solid #3f3f46', color: '#e4e4e7', fontSize: '11px', outline: 'none' }}
                >
                  <option value="all">Semua Produk ({availableProducts.length})</option>
                  {availableProducts
                    .filter(prod => prod.toLowerCase().includes(productSearchTerm.toLowerCase()))
                    .map(prod => (
                      <option key={prod} value={prod}>{prod}</option>
                    ))}
                </select>
              </div>
            </div>

            {/* Row 2: Platform Status Filters + Reset Button (4 Columns) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', paddingTop: '14px', borderTop: '1px solid #1f2937', alignItems: 'center' }}>
              <div>
                <select
                  value={tiktokFilter}
                  onChange={(e) => setTiktokFilter(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', background: '#09090b', border: '1px solid #3f3f46', color: '#d4d4d8', fontSize: '12px', outline: 'none' }}
                >
                  <option value="Semua">🎵 Semua TikTok Status</option>
                  <option value="Not Published">Not Published</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Published">Published</option>
                </select>
              </div>

              <div>
                <select
                  value={fbFilter}
                  onChange={(e) => setFbFilter(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', background: '#09090b', border: '1px solid #3f3f46', color: '#d4d4d8', fontSize: '12px', outline: 'none' }}
                >
                  <option value="Semua">📘 Semua Facebook Status</option>
                  <option value="Not Published">Not Published</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Published">Published</option>
                </select>
              </div>

              <div>
                <select
                  value={igFilter}
                  onChange={(e) => setIgFilter(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', background: '#09090b', border: '1px solid #3f3f46', color: '#d4d4d8', fontSize: '12px', outline: 'none' }}
                >
                  <option value="Semua">📷 Semua Instagram Status</option>
                  <option value="Not Published">Not Published</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Published">Published</option>
                </select>
              </div>

              <div>
                <button
                  type="button"
                  onClick={resetFilters}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: '8px',
                    background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1',
                    fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s ease'
                  }}
                >
                  🔄 Reset Filter
                </button>
              </div>
            </div>
          </div>

          {/* Content Items 1-Column Feed */}
          {loading ? (
            <div style={{ padding: '64px', textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ width: 32, height: 32, border: '3px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }}></div>
              <p>Memuat item konten dari SQLite Database...</p>
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: '64px 24px', textAlign: 'center', background: '#121318', borderRadius: '16px', border: '1px solid #27272a' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔍</div>
              <h3 style={{ fontSize: '18px', color: '#fff', margin: '0 0 8px' }}>Tidak Ada Konten Ditemukan</h3>
              <p style={{ color: '#9ca3af', fontSize: '13px', maxWidth: '420px', margin: '0 auto 20px' }}>
                Tidak ada konten yang sesuai dengan filter atau pencarian Anda. Klik tombol Sync untuk menyinkronkan seluruh kampanye.
              </p>
              <button
                onClick={handleTriggerRetroSync}
                style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
              >
                🔄 Refresh & Sync Database
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {items.map((item) => {
                const isTkPub = item.tiktok_status === 'Published' || item.tiktok_status === 'Skipped';
                const isFbPub = item.facebook_status === 'Published' || item.facebook_status === 'Skipped';
                const isIgPub = item.instagram_status === 'Published' || item.instagram_status === 'Skipped';
                const publishedPlatformCount = [isTkPub, isFbPub, isIgPub].filter(Boolean).length;
                const isAll3Published = publishedPlatformCount === 3;

                return (
                  <div
                    key={item.id}
                    style={{
                      background: '#0d1322',
                      border: isAll3Published ? '1px solid #10b981' : '1px solid #1e293b',
                      borderRadius: '16px',
                      padding: isAll3Published ? '22px 20px 16px' : '16px 20px',
                      display: 'grid',
                      gridTemplateColumns: '200px 1fr 240px',
                      gap: '20px',
                      alignItems: 'center',
                      boxShadow: isAll3Published ? '0 0 20px rgba(16, 185, 129, 0.25)' : '0 4px 16px rgba(0,0,0,0.3)',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = isAll3Published ? '#10b981' : 'rgba(59, 130, 246, 0.45)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = isAll3Published ? '#10b981' : '#1e293b'}
                  >
                    {/* Top Status Badge Banner */}
                    {isAll3Published ? (
                      <div style={{
                        position: 'absolute', top: '-11px', left: '24px',
                        background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                        color: '#ffffff', fontSize: '10px', fontWeight: 800,
                        padding: '2px 12px', borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
                        letterSpacing: '0.04em', border: '1px solid #34d399'
                      }}>
                        🎉 3/3 PUBLISHED (ALL PLATFORMS)
                      </div>
                    ) : publishedPlatformCount > 0 ? (
                      <div style={{
                        position: 'absolute', top: '-11px', left: '24px',
                        background: 'rgba(245, 158, 11, 0.15)',
                        border: '1px solid #f59e0b', color: '#fbbf24', fontSize: '10px', fontWeight: 800,
                        padding: '2px 10px', borderRadius: '12px', letterSpacing: '0.04em'
                      }}>
                        ⏳ {publishedPlatformCount}/3 TERPUBLIKASI
                      </div>
                    ) : null}

                    {/* KOLOM KIRI: Thumbnail Video, Video ID, & Link Asset */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{
                        position: 'relative', width: '100%', height: '110px', borderRadius: '12px',
                        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', border: '1px solid #334155',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
                      }}>
                        <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
                          <FilmIcon style={{ width: 20, height: 20 }} />
                        </div>

                        <div style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 2 }}>
                          <span style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid #3b82f6', color: '#60a5fa', fontSize: '10px', fontWeight: 700, fontFamily: 'monospace' }}>
                            {item.video_id}
                          </span>
                        </div>

                        {item.production_date && (
                          <div style={{ position: 'absolute', bottom: '8px', right: '8px', zIndex: 2 }}>
                            <span style={{ padding: '3px 6px', borderRadius: '4px', background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #334155', color: '#94a3b8', fontSize: '8px', fontWeight: 700 }}>
                              📅 Selesai: {formatDate(item.production_date)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Link Asset Button */}
                      <div style={{ width: '100%' }}>
                        {(() => {
                          const allUrls = [item.nextcloud_url, item.drive_link, item.url_asset].filter(Boolean);
                          const ncUrl = allUrls.find(u => typeof u === 'string' && (u.includes('100.78.186.123') || u.includes('index.php/s/') || u.toLowerCase().includes('nextcloud')));
                          const gdUrl = allUrls.find(u => typeof u === 'string' && (u.includes('drive.google.com') || u.includes('docs.google.com')));

                          const targetUrl = ncUrl || item.nextcloud_url || gdUrl || item.drive_link || item.url_asset;
                          const isNextcloud = Boolean(ncUrl || (item.nextcloud_url && !gdUrl) || (targetUrl && (targetUrl.includes('100.78.186.123') || targetUrl.includes('index.php/s/'))));

                          if (!targetUrl) {
                            return (
                              <span style={{ display: 'block', width: '100%', textAlign: 'center', padding: '6px 10px', borderRadius: '8px', background: 'rgba(30, 41, 59, 0.5)', color: '#64748b', fontSize: '11px', fontWeight: 600 }}>
                                ⏳ Asset Belum Tersedia
                              </span>
                            );
                          }

                          if (isNextcloud) {
                            const isCardCooldown = downloadCooldowns[item.id];
                            const cardDownloadUrl = getDirectDownloadUrl(targetUrl, item.video_id);
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <a href={targetUrl} target="_blank" rel="noreferrer" style={{ display: 'block', width: '100%', textAlign: 'center', padding: '6px 10px', borderRadius: '8px', background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)', color: '#ffffff', fontSize: '11px', fontWeight: 700, textDecoration: 'none', boxShadow: '0 2px 8px rgba(56, 189, 248, 0.25)' }} title="Buka Link Nextcloud">
                                  ☁️ Nextcloud
                                </a>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownload(item.id, cardDownloadUrl);
                                  }}
                                  disabled={isCardCooldown || !cardDownloadUrl}
                                  style={{
                                    display: 'block',
                                    width: '100%',
                                    textAlign: 'center',
                                    padding: '6px 10px',
                                    borderRadius: '8px',
                                    background: isCardCooldown
                                      ? 'rgba(74, 85, 104, 0.5)'
                                      : 'linear-gradient(135deg, #a855f7 0%, #c084fc 100%)',
                                    border: isCardCooldown ? '1px solid #4a5568' : '1px solid #c084fc',
                                    color: isCardCooldown ? '#a0aec0' : '#ffffff',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: (isCardCooldown || !cardDownloadUrl) ? 'not-allowed' : 'pointer',
                                    boxShadow: isCardCooldown ? 'none' : '0 2px 8px rgba(192, 132, 252, 0.25)',
                                    transition: 'all 0.2s ease'
                                  }}
                                >
                                  {isCardCooldown ? '⏳ Cooldown' : '📥 Download Video'}
                                </button>
                              </div>
                            );
                          }

                          return (
                            <a href={targetUrl} target="_blank" rel="noreferrer" style={{ display: 'block', width: '100%', textAlign: 'center', padding: '6px 10px', borderRadius: '8px', background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: '#ffffff', fontSize: '11px', fontWeight: 700, textDecoration: 'none', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)' }} title="Buka Link Google Drive">
                              📁 Google Drive
                            </a>
                          );
                        })()}
                      </div>
                    </div>

                    {/* KOLOM TENGAH: 1. Nama Produk ➡️ 2. Pratinjau Caption 10 Kata (11px) ➡️ 3. Platform Status Bar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
                      {/* 1. Nama Produk SKU */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#34d399', background: 'rgba(16, 185, 129, 0.12)', padding: '3px 10px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                          📦 {item.nama_produk || 'Umum'}
                        </span>
                        {item.link_produk && (
                          <a href={item.link_produk} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#38bdf8', background: 'rgba(2, 132, 199, 0.15)', padding: '2px 8px', borderRadius: '6px', border: '1px solid #0284c7', textDecoration: 'none', fontWeight: 600 }}>
                            🔗 Link Produk
                          </a>
                        )}
                        {item.link_affiliate && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); copyToClipboard(item.link_affiliate, 'Link Affiliate', `card_affiliate_${item.id}`); }} style={{ fontSize: '11px', color: '#c084fc', background: 'rgba(168, 85, 247, 0.15)', padding: '2px 8px', borderRadius: '6px', border: '1px solid #a855f7', cursor: 'pointer', fontWeight: 600 }}>
                            {copiedKeys[`card_affiliate_${item.id}`] ? '✓ Copied!' : '🛒 Affiliate Link'}
                          </button>
                        )}
                      </div>

                      {/* 2. Pratinjau Caption 10 Kata (Font Monospace 11px) + Tombol Copy */}
                      <div style={{ position: 'relative', background: '#05070d', borderRadius: '8px', border: '1px solid #1e293b', padding: '8px 12px' }}>
                        <p style={{ fontSize: '11px', fontFamily: 'monospace', color: '#cbd5e1', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '80px', lineHeight: '1.4' }}>
                          {item.caption ? item.caption.split(' ').slice(0, 10).join(' ') + '...' : '(Tidak ada caption)'}
                        </p>
                        {item.caption && (
                          <button
                            onClick={() => copyToClipboard(item.caption, 'Caption', `card_caption_${item.id}`)}
                            style={{
                              position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                              padding: '3px 8px', borderRadius: '6px',
                              background: copiedKeys[`card_caption_${item.id}`] ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : '#1e293b',
                              border: `1px solid ${copiedKeys[`card_caption_${item.id}`] ? '#10b981' : '#334155'}`,
                              color: '#ffffff', fontSize: '10px', cursor: 'pointer', fontWeight: 600
                            }}
                          >
                            {copiedKeys[`card_caption_${item.id}`] ? '✓ Copied!' : '📋 Copy'}
                          </button>
                        )}
                      </div>

                      {/* 3. Platform Status Chips Bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', paddingTop: '2px' }}>
                        {/* TikTok Chip */}
                        <div style={{
                          padding: '3px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                          background: isTkPub ? 'rgba(16, 185, 129, 0.15)' : 'rgba(15, 23, 42, 0.8)',
                          border: isTkPub ? '1px solid #10b981' : '1px solid #334155',
                          color: isTkPub ? '#34d399' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px'
                        }}>
                          <span>🎵 TikTok</span>
                          <span>{item.tiktok_status === 'Published' ? `✓ Published (${formatDate(item.tiktok_publish_date)})` : item.tiktok_status === 'Skipped' ? '⏭️ Skipped' : item.tiktok_status}</span>
                        </div>

                        {/* FB Chip */}
                        <div style={{
                          padding: '3px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                          background: isFbPub ? 'rgba(59, 130, 246, 0.15)' : 'rgba(15, 23, 42, 0.8)',
                          border: isFbPub ? '1px solid #3b82f6' : '1px solid #334155',
                          color: isFbPub ? '#60a5fa' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px'
                        }}>
                          <span>📘 FB</span>
                          <span>{item.facebook_status === 'Published' ? `✓ Published (${formatDate(item.facebook_publish_date)})` : item.facebook_status === 'Skipped' ? '⏭️ Skipped' : item.facebook_status}</span>
                        </div>

                        {/* IG Chip */}
                        <div style={{
                          padding: '3px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                          background: isIgPub ? 'rgba(239, 68, 68, 0.15)' : 'rgba(15, 23, 42, 0.8)',
                          border: isIgPub ? '1px solid #ef4444' : '1px solid #334155',
                          color: isIgPub ? '#f87171' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px'
                        }}>
                          <span>📸 IG</span>
                          <span>{item.instagram_status === 'Published' ? `✓ Published (${formatDate(item.instagram_publish_date)})` : item.instagram_status === 'Skipped' ? '⏭️ Skipped' : item.instagram_status}</span>
                        </div>
                      </div>
                    </div>

                    {/* KOLOM KANAN: Brand Tag, Hook Title, & Tombol Detail & Status */}
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px', height: '100%', borderLeft: '1px solid #1e293b', paddingLeft: '16px' }}>
                      <div>
                        {item.account_name && (
                          <div style={{ marginBottom: '6px' }}>
                            <span style={{
                              fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px',
                              ...getBrandBadgeStyle(item.account_name)
                            }}>
                              🏷️ @{item.account_name}
                            </span>
                          </div>
                        )}
                        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', margin: 0, lineHeight: 1.4 }}>
                          {item.hook || 'Tanpa Hook'}
                        </h3>
                      </div>

                      <button
                        onClick={() => openDetailModal(item)}
                        style={{
                          width: '100%', padding: '9px 14px', borderRadius: '10px',
                          background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
                          color: '#ffffff', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)', transition: 'all 0.2s ease'
                        }}
                      >
                        Detail & Status
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Modal Detail & Update Status */}
          {activeItem && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px'
            }}>
              <div style={{
                background: '#0d1322', border: '1px solid #1e293b', borderRadius: '16px',
                width: '100%', maxWidth: '820px', maxHeight: '92vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 20px 50px rgba(0,0,0,0.6)', overflow: 'hidden'
              }}>
                {/* Modal Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #1e293b', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    <span style={{
                      padding: '5px 12px', borderRadius: '8px', background: '#1e293b', border: '1px solid #3b82f6',
                      color: '#60a5fa', fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, flexShrink: 0
                    }}>
                      {activeItem.video_id}
                    </span>
                    <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {activeItem.hook}
                    </h2>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const itemToSchedule = { ...activeItem };
                        setActiveItem(null);
                        setSchedulePreloadItem(itemToSchedule);
                        setMainView('publishing');
                      }}
                      style={{
                        padding: '6px 12px', borderRadius: '8px',
                        background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                        border: '1px solid #c084fc', color: '#fff', fontSize: '11px',
                        fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                      }}
                      title="Jadwalkan publikasi Facebook / Instagram untuk konten ini"
                    >
                      <span>⏱️ Jadwalkan Publikasi</span>
                    </button>
                    {currentUser?.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(activeItem.id)}
                        style={{
                          padding: '5px 10px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', fontSize: '11px',
                          fontWeight: 600, cursor: 'pointer'
                        }}
                        title="Hapus item konten ini (Admin Only)"
                      >
                        🗑️ Hapus Konten
                      </button>
                    )}
                    <button
                      onClick={() => setActiveItem(null)}
                      style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                    >
                      <XIcon style={{ width: 22, height: 22 }} />
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSaveStatus} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', margin: 0 }}>
                  {/* Two-Column Scrollable Body */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1.15fr 0.85fr',
                    gap: '20px',
                    padding: '24px',
                    overflow: 'hidden',
                    flex: 1
                  }}>
                    {/* Left Column: Actions & Product Data */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', paddingRight: '4px' }}>
                      {/* Row 1: Copy Actions (2 Columns) */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(activeItem.caption, 'Caption', `modal_caption_${activeItem.id}`)}
                          disabled={!activeItem.caption}
                          style={{
                            padding: '10px 14px', borderRadius: '10px',
                            background: copiedKeys[`modal_caption_${activeItem.id}`]
                              ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                              : activeItem.caption
                                ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)'
                                : 'rgba(30, 41, 59, 0.5)',
                            border: copiedKeys[`modal_caption_${activeItem.id}`]
                              ? '1px solid #10b981'
                              : activeItem.caption
                                ? '1px solid #8b5cf6'
                                : '1px solid #334155',
                            color: activeItem.caption ? '#ffffff' : '#64748b', fontWeight: 600, fontSize: '13px',
                            cursor: activeItem.caption ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            boxShadow: activeItem.caption && !copiedKeys[`modal_caption_${activeItem.id}`] ? '0 4px 12px rgba(139, 92, 246, 0.3)' : 'none',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {copiedKeys[`modal_caption_${activeItem.id}`] ? '✓ Copied!' : '📋 Copy Caption'}
                        </button>

                        <button
                          type="button"
                          onClick={() => copyToClipboard(activeItem.link_affiliate, 'Link Affiliate', `modal_affiliate_${activeItem.id}`)}
                          disabled={!activeItem.link_affiliate}
                          style={{
                            padding: '10px 14px', borderRadius: '10px',
                            background: copiedKeys[`modal_affiliate_${activeItem.id}`] ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : activeItem.link_affiliate ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'rgba(30, 41, 59, 0.5)',
                            border: copiedKeys[`modal_affiliate_${activeItem.id}`] ? '1px solid #10b981' : activeItem.link_affiliate ? '1px solid #818cf8' : '1px solid #334155',
                            color: activeItem.link_affiliate ? '#ffffff' : '#64748b', fontWeight: 700, fontSize: '13px',
                            cursor: activeItem.link_affiliate ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            boxShadow: activeItem.link_affiliate ? '0 4px 14px rgba(99, 102, 241, 0.35)' : 'none',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {copiedKeys[`modal_affiliate_${activeItem.id}`] ? '✓ Copied!' : '📋 Copy Affiliate Link'}
                        </button>
                      </div>

                      {/* Row 2: Asset & Navigation Links (Dynamic 2 or 3 Columns) */}
                      {(() => {
                        const allUrls = [activeItem.nextcloud_url, activeItem.drive_link, activeItem.url_asset].filter(Boolean);
                        const ncUrl = allUrls.find(u => typeof u === 'string' && (u.includes('100.78.186.123') || u.includes('index.php/s/') || u.toLowerCase().includes('nextcloud')));
                        const gdUrl = allUrls.find(u => typeof u === 'string' && (u.includes('drive.google.com') || u.includes('docs.google.com')));

                        const targetUrl = ncUrl || activeItem.nextcloud_url || gdUrl || activeItem.drive_link || activeItem.url_asset;
                        const isNextcloud = Boolean(ncUrl || (activeItem.nextcloud_url && !gdUrl) || (targetUrl && (targetUrl.includes('100.78.186.123') || targetUrl.includes('index.php/s/'))));
                        
                        const showDownloadButton = isNextcloud && targetUrl;
                        const gridCols = showDownloadButton ? '1fr 1fr 1fr' : '1fr 1fr';

                        return (
                          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '10px' }}>
                            {/* 1. Buka Link Produk */}
                            {activeItem.link_produk ? (
                              <a
                                href={activeItem.link_produk}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  padding: '10px 14px', borderRadius: '10px',
                                  background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
                                  border: '1px solid #38bdf8', color: '#ffffff', fontWeight: 700, fontSize: '13px',
                                  textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                  boxShadow: '0 4px 14px rgba(56, 189, 248, 0.3)'
                                }}
                              >
                                🔗 Buka Link Produk
                              </a>
                            ) : (
                              <button
                                disabled
                                style={{
                                  padding: '10px 14px', borderRadius: '10px', background: 'rgba(30, 41, 59, 0.5)',
                                  border: '1px solid #334155', color: '#64748b', fontWeight: 600, fontSize: '13px',
                                  cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                }}
                              >
                                🔗 Tanpa Link Produk
                              </button>
                            )}

                            {/* 2. Nextcloud Asset / Drive Asset / Asset Kosong */}
                            {!targetUrl ? (
                              <button
                                disabled
                                style={{
                                  padding: '10px 14px', borderRadius: '10px', background: 'rgba(30, 41, 59, 0.5)',
                                  border: '1px solid #334155', color: '#64748b', fontWeight: 600, fontSize: '13px',
                                  cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                }}
                              >
                                📥 Asset Kosong
                              </button>
                            ) : (
                              <a
                                href={targetUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  padding: '10px 14px', borderRadius: '10px',
                                  background: isNextcloud ? 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)' : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                                  border: isNextcloud ? '1px solid #38bdf8' : '1px solid #10b981', color: '#ffffff', fontWeight: 700, fontSize: '13px',
                                  textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                  boxShadow: isNextcloud ? '0 4px 14px rgba(56, 189, 248, 0.3)' : '0 4px 14px rgba(16, 185, 129, 0.3)'
                                }}
                              >
                                {isNextcloud ? '☁️ Nextcloud Asset' : '📁 Drive Asset'}
                              </a>
                            )}

                            {/* 3. Download Video Final with Cooldown */}
                            {showDownloadButton && (() => {
                              const isCooldown = downloadCooldowns[activeItem.id];
                              return (
                                <button
                                  type="button"
                                  onClick={() => handleDownload(activeItem.id, directDownloadUrl)}
                                  disabled={loadingDownloadUrl || !directDownloadUrl || isCooldown}
                                  style={{
                                    padding: '10px 14px', borderRadius: '10px',
                                    background: isCooldown 
                                      ? 'rgba(74, 85, 104, 0.5)' 
                                      : 'linear-gradient(135deg, #a855f7 0%, #c084fc 100%)',
                                    border: isCooldown ? '1px solid #4a5568' : '1px solid #c084fc',
                                    color: isCooldown ? '#a0aec0' : '#ffffff',
                                    fontWeight: 700, fontSize: '13px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    cursor: (loadingDownloadUrl || !directDownloadUrl || isCooldown) ? 'not-allowed' : 'pointer',
                                    boxShadow: isCooldown ? 'none' : '0 4px 14px rgba(192, 132, 252, 0.3)',
                                    opacity: (loadingDownloadUrl || !directDownloadUrl) ? 0.6 : 1,
                                    transition: 'all 0.2s ease'
                                  }}
                                >
                                  {loadingDownloadUrl ? '🔄 Loading...' : isCooldown ? '⏳ Cooldown' : '📥 Download Video Final'}
                                </button>
                              );
                            })()}
                          </div>
                        );
                      })()}

                      {/* Field Catatan Konten */}
                      <div style={{ background: '#090d16', padding: '16px', borderRadius: '14px', border: '1px solid #1e293b' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: '#60a5fa', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            📝 CATATAN KONTEN
                          </span>
                          {activeItem.catatan && (
                            <span style={{ fontSize: '10px', color: '#34d399', fontWeight: 700 }}>✓ Tersimpan</span>
                          )}
                        </div>
                        <textarea
                          value={editStatusForm.catatan || ''}
                          onChange={(e) => setEditStatusForm({ ...editStatusForm, catatan: e.target.value })}
                          placeholder="Tambahkan catatan khusus untuk item konten ini (misal: Revisi caption, Jadwal tayang, dsb)..."
                          style={{
                            width: '100%', padding: '10px 12px', background: '#05070d', border: '1px solid #334155',
                            borderRadius: '8px', color: '#e2e8f0', fontSize: '12px', outline: 'none', resize: 'vertical', minHeight: '65px',
                            lineHeight: '1.5', fontFamily: 'inherit'
                          }}
                        />
                      </div>

                      {/* Accordion Product Data */}
                      <div style={{ background: '#090d16', padding: '18px', borderRadius: '14px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div
                          onClick={() => setIsProductSectionOpen(!isProductSectionOpen)}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
                        >
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#c084fc', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            📦 DATA PRODUK & LINK
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>
                              {isProductSectionOpen ? 'Tutup Panel 🔼' : 'Buka Panel 🔽'}
                            </span>
                            <button
                              type="button"
                              style={{ padding: '2px 8px', borderRadius: '6px', background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}
                            >
                              {isProductSectionOpen ? '▲' : '▼'}
                            </button>
                          </div>
                        </div>

                        {isProductSectionOpen && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {/* 1. Nama Produk */}
                            <div style={{ background: '#05070d', padding: '12px 14px', borderRadius: '10px', border: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Nama Produk:</span>
                                {editingInlineField === 'nama_produk' ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                    <input
                                      type="text"
                                      value={inlineValue}
                                      onChange={(e) => setInlineValue(e.target.value)}
                                      autoFocus
                                      placeholder="Masukkan nama produk..."
                                      style={{ flex: 1, padding: '6px 10px', background: '#0f172a', border: '1px solid #38bdf8', borderRadius: '6px', color: '#fff', fontSize: '12px', outline: 'none' }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSaveInlineField('nama_produk')}
                                      disabled={savingStatus}
                                      style={{ padding: '6px 12px', borderRadius: '6px', background: '#10b981', border: 'none', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                      ✔️ Simpan
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingInlineField(null)}
                                      style={{ padding: '6px 10px', borderRadius: '6px', background: '#334155', border: 'none', color: '#cbd5e1', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                                    >
                                      ❌
                                    </button>
                                  </div>
                                ) : (
                                  <strong style={{ fontSize: '13px', color: activeItem.nama_produk ? '#ffffff' : '#64748b' }}>
                                    {activeItem.nama_produk || '(Belum diisi)'}
                                  </strong>
                                )}
                              </div>
                              {editingInlineField !== 'nama_produk' && (
                                canEditProductName ? (
                                  <button
                                    type="button"
                                    onClick={() => { setEditingInlineField('nama_produk'); setInlineValue(activeItem.nama_produk || ''); }}
                                    title="Edit Nama Produk"
                                    style={{ padding: '6px 10px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.4)', color: '#38bdf8', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    ✏️ Edit
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }} title="Terkunci (Edit Nama Product Permission)">🔒 Terkunci</span>
                                )
                              )}
                            </div>

                            {/* 2. Link Produk */}
                            <div style={{ background: '#05070d', padding: '12px 14px', borderRadius: '10px', border: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Link Produk:</span>
                                {editingInlineField === 'link_produk' ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                    <input
                                      type="text"
                                      value={inlineValue}
                                      onChange={(e) => setInlineValue(e.target.value)}
                                      autoFocus
                                      placeholder="https://..."
                                      style={{ flex: 1, padding: '6px 10px', background: '#0f172a', border: '1px solid #38bdf8', borderRadius: '6px', color: '#fff', fontSize: '12px', outline: 'none' }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSaveInlineField('link_produk')}
                                      disabled={savingStatus}
                                      style={{ padding: '6px 12px', borderRadius: '6px', background: '#10b981', border: 'none', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                      ✔️ Simpan
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingInlineField(null)}
                                      style={{ padding: '6px 10px', borderRadius: '6px', background: '#334155', border: 'none', color: '#cbd5e1', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                                    >
                                      ❌
                                    </button>
                                  </div>
                                ) : activeItem.link_produk ? (
                                  <a href={activeItem.link_produk} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 600, textDecoration: 'none' }}>
                                    🔗 Buka Link Produk ↗
                                  </a>
                                ) : (
                                  <span style={{ fontSize: '12px', color: '#64748b' }}>(Belum diisi)</span>
                                )}
                              </div>
                              {editingInlineField !== 'link_produk' && (
                                canEditProductLink ? (
                                  <button
                                    type="button"
                                    onClick={() => { setEditingInlineField('link_produk'); setInlineValue(activeItem.link_produk || ''); }}
                                    title="Edit Link Produk"
                                    style={{ padding: '6px 10px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.4)', color: '#38bdf8', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    ✏️ Edit
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }} title="Terkunci (Edit Link Product Permission)">🔒 Terkunci</span>
                                )
                              )}
                            </div>

                            {/* 3. Link Affiliate */}
                            <div style={{ background: '#05070d', padding: '12px 14px', borderRadius: '10px', border: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Link Affiliate:</span>
                                {editingInlineField === 'link_affiliate' ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                    <input
                                      type="text"
                                      value={inlineValue}
                                      onChange={(e) => setInlineValue(e.target.value)}
                                      autoFocus
                                      placeholder="https://..."
                                      style={{ flex: 1, padding: '6px 10px', background: '#0f172a', border: '1px solid #38bdf8', borderRadius: '6px', color: '#fff', fontSize: '12px', outline: 'none' }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSaveInlineField('link_affiliate')}
                                      disabled={savingStatus}
                                      style={{ padding: '6px 12px', borderRadius: '6px', background: '#10b981', border: 'none', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                      ✔️ Simpan
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingInlineField(null)}
                                      style={{ padding: '6px 10px', borderRadius: '6px', background: '#334155', border: 'none', color: '#cbd5e1', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                                    >
                                      ❌
                                    </button>
                                  </div>
                                ) : activeItem.link_affiliate ? (
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(activeItem.link_affiliate, 'Link Affiliate')}
                                    style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#fbbf24', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                                  >
                                    🛒 Copy Affiliate Link 📋
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '12px', color: '#64748b' }}>(Belum diisi)</span>
                                )}
                              </div>
                              {editingInlineField !== 'link_affiliate' && (
                                canEditAffiliateLink ? (
                                  <button
                                    type="button"
                                    onClick={() => { setEditingInlineField('link_affiliate'); setInlineValue(activeItem.link_affiliate || ''); }}
                                    title="Edit Link Affiliate"
                                    style={{ padding: '6px 10px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.4)', color: '#38bdf8', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    ✏️ Edit
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }} title="Terkunci (Edit Link Affiliate Permission)">🔒 Terkunci</span>
                                )
                              )}
                            </div>

                            {/* Lineage & Affiliate Source info */}
                            <div style={{ background: '#05070d', padding: '12px 14px', borderRadius: '10px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', color: '#9ca3af', marginTop: '12px' }}>
                              <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700, display: 'block' }}>🛡️ Lineage & Affiliate Source Info:</span>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <div>
                                  <span style={{ display: 'block', color: '#64748b', fontSize: '10px' }}>Affiliate Source:</span>
                                  <strong style={{ color: '#e2e8f0', textTransform: 'uppercase' }}>{activeItem.affiliate_source || 'legacy'}</strong>
                                </div>
                                <div>
                                  <span style={{ display: 'block', color: '#64748b', fontSize: '10px' }}>Affiliate Status:</span>
                                  <strong style={{ color: '#e2e8f0', textTransform: 'uppercase' }}>{activeItem.affiliate_status || 'missing'}</strong>
                                </div>
                                <div>
                                  <span style={{ display: 'block', color: '#64748b', fontSize: '10px' }}>Product ID:</span>
                                  <strong style={{ color: '#e2e8f0' }}>{activeItem.product_id || '-'}</strong>
                                </div>
                                <div>
                                  <span style={{ display: 'block', color: '#64748b', fontSize: '10px' }}>Brand Profile ID:</span>
                                  <strong style={{ color: '#e2e8f0' }}>{activeItem.brand_profile_id || '-'}</strong>
                                </div>
                                {activeItem.affiliate_resolved_at && (
                                  <div style={{ gridColumn: 'span 2' }}>
                                    <span style={{ display: 'block', color: '#64748b', fontSize: '10px' }}>Resolved At:</span>
                                    <strong style={{ color: '#e2e8f0' }}>{new Date(activeItem.affiliate_resolved_at).toLocaleString('id-ID')}</strong>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Caption Panel */}
                            <div style={{ marginTop: '4px' }}>
                              <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Caption:</span>
                              <div style={{
                                fontSize: '12px', fontFamily: 'monospace', color: '#cbd5e1', background: '#05070d',
                                padding: '12px', borderRadius: '8px', border: '1px solid #1e293b', whiteSpace: 'pre-wrap',
                                maxHeight: '140px', overflowY: 'auto', lineHeight: '1.6'
                              }}>
                                {activeItem.caption || '(Tidak ada caption)'}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Platform Publication Status */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', paddingRight: '4px' }}>
                      <h3 style={{ fontSize: '11px', fontWeight: 800, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
                        STATUS PUBLIKASI PER PLATFORM
                      </h3>

                      {/* TikTok Controls */}

                  {/* TikTok Controls */}
                  <div style={{ background: '#090d16', padding: '16px', borderRadius: '12px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      📱 TIKTOK
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: '#9ca3af', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Status Posting</label>
                        <select
                          value={editStatusForm.tiktok_status}
                          onChange={(e) => setEditStatusForm({ ...editStatusForm, tiktok_status: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', outline: 'none', transition: 'all 0.2s ease', ...getStatusSelectStyle(editStatusForm.tiktok_status) }}
                        >
                          <option value="Not Published">Not Published</option>
                          <option value="Scheduled">Scheduled</option>
                          <option value="Published">Published</option>
                          <option value="Skipped">Skipped</option>
                        </select>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <label style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600 }}>
                            Tanggal Rilis {editStatusForm.tiktok_publish_date ? <span style={{ color: '#60a5fa', fontWeight: 700 }}>✓ Terisi</span> : null}
                          </label>
                          <button
                            type="button"
                            onClick={() => setEditStatusForm({ ...editStatusForm, tiktok_publish_date: new Date().toISOString().split('T')[0] })}
                            style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '10px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                          >
                            Hari Ini
                          </button>
                        </div>
                        <input
                          type="date"
                          value={editStatusForm.tiktok_publish_date}
                          onChange={(e) => setEditStatusForm({ ...editStatusForm, tiktok_publish_date: e.target.value })}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', outline: 'none', colorScheme: 'dark', transition: 'all 0.2s ease', ...getDateInputStyle(editStatusForm.tiktok_publish_date) }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', color: '#9ca3af', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Permalink</label>
                        <input
                          type="text"
                          value={editStatusForm.permalink_tiktok}
                          onChange={(e) => setEditStatusForm({ ...editStatusForm, permalink_tiktok: e.target.value })}
                          placeholder="https://tiktok.com/@..."
                          style={{ width: '100%', padding: '8px 10px', background: '#05070d', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '12px', outline: 'none' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Facebook Controls */}
                  <div style={{ background: '#090d16', padding: '16px', borderRadius: '12px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      📘 FACEBOOK
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: '#9ca3af', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Status Posting</label>
                        <select
                          value={editStatusForm.facebook_status}
                          onChange={(e) => setEditStatusForm({ ...editStatusForm, facebook_status: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', outline: 'none', transition: 'all 0.2s ease', ...getStatusSelectStyle(editStatusForm.facebook_status) }}
                        >
                          <option value="Not Published">Not Published</option>
                          <option value="Scheduled">Scheduled</option>
                          <option value="Published">Published</option>
                          <option value="Skipped">Skipped</option>
                        </select>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <label style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600 }}>
                            Tanggal Rilis {editStatusForm.facebook_publish_date ? <span style={{ color: '#60a5fa', fontWeight: 700 }}>✓ Terisi</span> : null}
                          </label>
                          <button
                            type="button"
                            onClick={() => setEditStatusForm({ ...editStatusForm, facebook_publish_date: new Date().toISOString().split('T')[0] })}
                            style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '10px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                          >
                            Hari Ini
                          </button>
                        </div>
                        <input
                          type="date"
                          value={editStatusForm.facebook_publish_date}
                          onChange={(e) => setEditStatusForm({ ...editStatusForm, facebook_publish_date: e.target.value })}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', outline: 'none', colorScheme: 'dark', transition: 'all 0.2s ease', ...getDateInputStyle(editStatusForm.facebook_publish_date) }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', color: '#9ca3af', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Permalink</label>
                        <input
                          type="text"
                          value={editStatusForm.permalink_facebook}
                          onChange={(e) => setEditStatusForm({ ...editStatusForm, permalink_facebook: e.target.value })}
                          placeholder="https://facebook.com/..."
                          style={{ width: '100%', padding: '8px 10px', background: '#05070d', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '12px', outline: 'none' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Instagram Controls */}
                  <div style={{ background: '#090d16', padding: '16px', borderRadius: '12px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#f472b6', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      📷 INSTAGRAM
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: '#9ca3af', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Status Posting</label>
                        <select
                          value={editStatusForm.instagram_status}
                          onChange={(e) => setEditStatusForm({ ...editStatusForm, instagram_status: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', outline: 'none', transition: 'all 0.2s ease', ...getStatusSelectStyle(editStatusForm.instagram_status) }}
                        >
                          <option value="Not Published">Not Published</option>
                          <option value="Scheduled">Scheduled</option>
                          <option value="Published">Published</option>
                          <option value="Skipped">Skipped</option>
                        </select>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <label style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600 }}>
                            Tanggal Rilis {editStatusForm.instagram_publish_date ? <span style={{ color: '#60a5fa', fontWeight: 700 }}>✓ Terisi</span> : null}
                          </label>
                          <button
                            type="button"
                            onClick={() => setEditStatusForm({ ...editStatusForm, instagram_publish_date: new Date().toISOString().split('T')[0] })}
                            style={{ background: 'none', border: 'none', color: '#f472b6', fontSize: '10px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                          >
                            Hari Ini
                          </button>
                        </div>
                        <input
                          type="date"
                          value={editStatusForm.instagram_publish_date}
                          onChange={(e) => setEditStatusForm({ ...editStatusForm, instagram_publish_date: e.target.value })}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', outline: 'none', colorScheme: 'dark', transition: 'all 0.2s ease', ...getDateInputStyle(editStatusForm.instagram_publish_date) }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', color: '#9ca3af', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Permalink</label>
                        <input
                          type="text"
                          value={editStatusForm.permalink_instagram}
                          onChange={(e) => setEditStatusForm({ ...editStatusForm, permalink_instagram: e.target.value })}
                          placeholder="https://instagram.com/p/..."
                          style={{ width: '100%', padding: '8px 10px', background: '#05070d', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '12px', outline: 'none' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer Submit Bar */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px', borderTop: '1px solid #1e293b', background: '#0d1322' }}>
                    <button
                      type="button"
                      onClick={() => setActiveItem(null)}
                      style={{ padding: '10px 18px', background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', borderRadius: '10px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={savingStatus}
                      style={{
                        padding: '10px 22px', background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
                        border: 'none', color: '#ffffff', borderRadius: '10px', fontWeight: 700,
                        cursor: savingStatus ? 'not-allowed' : 'pointer', fontSize: '13px',
                        boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)'
                      }}
                    >
                      {savingStatus ? 'Menyimpan...' : '💾 Simpan Perubahan Status'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Option 2 Brand Delete Red Danger Safety Modal */}
          {deleteBrandTarget && (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
            }}>
              <div style={{
                width: '100%', maxWidth: '480px', borderRadius: '16px',
                background: '#18181b', border: '1px solid rgba(239, 68, 68, 0.5)',
                boxShadow: '0 20px 50px rgba(239, 68, 68, 0.3)', padding: '24px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#ef4444', marginBottom: '16px' }}>
                  <span style={{ fontSize: '28px' }}>⚠️</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#f87171' }}>Strict Brand Deletion Warning</h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#a1a1aa' }}>Tindakan ini permanen & tidak dapat dibatalkan</p>
                  </div>
                </div>

                <p style={{ fontSize: '13px', color: '#e4e4e7', lineHeight: '1.5', marginBottom: '16px' }}>
                  Anda akan menghapus <strong style={{ color: '#f87171' }}>SELURUH KONTEN VIDEO</strong> milik akun brand <strong style={{ color: '#f87171' }}>@{deleteBrandTarget}</strong> secara permanen dari SQLite Node 1 & PostgreSQL Node 3 Storage Database.
                </p>

                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '12px', borderRadius: '10px', marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#fca5a5', marginBottom: '6px' }}>
                    Ketik ulang nama brand di bawah ini untuk mengonfirmasi: <span style={{ fontFamily: 'monospace', color: '#fff', background: '#000', padding: '2px 6px', borderRadius: '4px' }}>{deleteBrandTarget}</span>
                  </label>
                  <input
                    type="text"
                    value={deleteBrandConfirmInput}
                    onChange={(e) => setDeleteBrandConfirmInput(e.target.value)}
                    placeholder={`Ketik "${deleteBrandTarget}"...`}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: '8px',
                      background: '#09090b', border: '1px solid #71717a', color: '#fff', fontSize: '13px', outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => {
                      setDeleteBrandTarget(null);
                      setDeleteBrandConfirmInput('');
                    }}
                    style={{
                      padding: '10px 18px', borderRadius: '10px', background: '#27272a',
                      border: '1px solid #3f3f46', color: '#e4e4e7', cursor: 'pointer', fontSize: '12px', fontWeight: 600
                    }}
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleConfirmDeleteBrand}
                    disabled={deletingBrand || deleteBrandConfirmInput.trim().toLowerCase() !== deleteBrandTarget.trim().toLowerCase()}
                    style={{
                      padding: '10px 18px', borderRadius: '10px',
                      background: (deleteBrandConfirmInput.trim().toLowerCase() === deleteBrandTarget.trim().toLowerCase() && !deletingBrand)
                        ? 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)'
                        : '#3f3f46',
                      color: '#fff', border: 'none', cursor: (deleteBrandConfirmInput.trim().toLowerCase() === deleteBrandTarget.trim().toLowerCase() && !deletingBrand) ? 'pointer' : 'not-allowed',
                      fontSize: '12px', fontWeight: 700, boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)'
                    }}
                  >
                    {deletingBrand ? 'Memusnahkan...' : '🔥 Hapus Permanen Akun Brand'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Admin Schedule Controller Modal (Admin Only) */}
          {showAdminScheduleModal && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(5, 7, 13, 0.85)', backdropFilter: 'blur(12px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px'
            }}>
              <div style={{
                width: '100%', maxWidth: '640px', background: '#0f172a', border: '1px solid rgba(168, 85, 247, 0.4)',
                borderRadius: '20px', padding: '28px', boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      📅 Skedul Controller — <span style={{ color: '#c084fc' }}>@{accountFilter}</span>
                    </h3>
                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0' }}>
                      Atur 5 Produk Aktif & Target Posting Harian (1 s/d 6 video/hari) untuk dikelola tim posting.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAdminScheduleModal(false)}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveBrandSchedules}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
                    {adminSlotsForm.map((slot, i) => (
                      <div
                        key={slot.slot_index}
                        style={{
                          display: 'grid', gridTemplateColumns: 'auto 1fr 140px', gap: '12px', alignItems: 'center',
                          padding: '12px 14px', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)'
                        }}
                      >
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#c084fc', width: '60px' }}>
                          Slot #{slot.slot_index}
                        </span>

                        {/* Product Name Selector */}
                        <div>
                          {availableProducts.length > 0 ? (
                            <select
                              value={slot.product_name}
                              onChange={(e) => {
                                const updated = [...adminSlotsForm];
                                updated[i].product_name = e.target.value;
                                updated[i].product_id = e.target.value;
                                setAdminSlotsForm(updated);
                              }}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', fontSize: '12px', outline: 'none' }}
                            >
                              <option value="">-- (Kosong / Tidak Digunakan) --</option>
                              {availableProducts.map(p => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={slot.product_name}
                              onChange={(e) => {
                                const updated = [...adminSlotsForm];
                                updated[i].product_name = e.target.value;
                                updated[i].product_id = e.target.value;
                                setAdminSlotsForm(updated);
                              }}
                              placeholder="Nama Produk..."
                              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: '#09090b', border: '1px solid #3f3f46', color: '#fff', fontSize: '12px', outline: 'none' }}
                            />
                          )}
                        </div>

                        {/* Target Post Per Day Selector (1-6) */}
                        <div>
                          <select
                            value={slot.target_daily_posts}
                            onChange={(e) => {
                              const updated = [...adminSlotsForm];
                              updated[i].target_daily_posts = parseInt(e.target.value) || 1;
                              setAdminSlotsForm(updated);
                            }}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: '#09090b', border: '1px solid #c084fc', color: '#e9d5ff', fontWeight: 700, fontSize: '12px', outline: 'none' }}
                          >
                            {[1, 2, 3, 4, 5, 6].map(num => (
                              <option key={num} value={num}>{num} / Hari</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setShowAdminScheduleModal(false)}
                      style={{ padding: '10px 18px', borderRadius: '10px', background: '#27272a', border: '1px solid #3f3f46', color: '#e4e4e7', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={savingSchedule}
                      style={{
                        padding: '10px 22px', borderRadius: '10px', background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                        color: '#fff', border: 'none', cursor: savingSchedule ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 700,
                        boxShadow: '0 4px 14px rgba(168, 85, 247, 0.4)'
                      }}
                    >
                      {savingSchedule ? 'Menyimpan...' : '💾 Simpan Skedul 5 Produk'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          </>
        )}
        </div>
      </main>
    </div>
  );
}

export default function ContentFlowHubPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', color: '#34d399', background: '#0b0f17', minHeight: '100vh' }}>Loading ContentFlow...</div>}>
      <ContentFlowHubPageContent />
    </Suspense>
  );
}
