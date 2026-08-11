'use client';

import Sidebar from '../components/Sidebar';
import { useEffect, useState, useRef } from 'react';

export default function SettingsPage() {
  const [kbs, setKbs] = useState([]);
  const [apiKey, setApiKey] = useState('');
  const [maskedKey, setMaskedKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [editing, setEditing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [toast, setToast] = useState(null);
  
  // Google OAuth Status
  const [googleStatus, setGoogleStatus] = useState({ credentialsSet: false, connected: false, email: null });
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [savingGoogle, setSavingGoogle] = useState(false);

  // Webhook / G-Labs Settings
  const [webhookApiKey, setWebhookApiKey] = useState('');
  const [maskedWebhookKey, setMaskedWebhookKey] = useState('');
  const [hasWebhookKey, setHasWebhookKey] = useState(false);
  const [editingWebhookKey, setEditingWebhookKey] = useState(false);
  const [webhookHost, setWebhookHost] = useState('100.117.59.92');
  const [webhookPort, setWebhookPort] = useState('8765');
  const [webhookImageModel, setWebhookImageModel] = useState('nano_banana_pro');
  const [webhookVideoModel, setWebhookVideoModel] = useState('veo_31_lite_relaxed');
  const [webhookDelayEnabled, setWebhookDelayEnabled] = useState(true);
  const [webhookDelayMin, setWebhookDelayMin] = useState(10);
  const [webhookDelayMax, setWebhookDelayMax] = useState(20);
  const [webhookT2iPattern, setWebhookT2iPattern] = useState('threading');
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState(null);
  const [testingWebhook, setTestingWebhook] = useState(false);

  // MiniMax AI Config
  const [minimaxApiKey, setMinimaxApiKey] = useState('');
  const [maskedMinimaxKey, setMaskedMinimaxKey] = useState('');
  const [hasMinimaxKey, setHasMinimaxKey] = useState(false);
  const [editingMinimax, setEditingMinimax] = useState(false);
  const [savingMinimax, setSavingMinimax] = useState(false);
  
  // Gemini API Tier & Caching
  const [geminiApiTier, setGeminiApiTier] = useState('paid');
  const [geminiContextCaching, setGeminiContextCaching] = useState('on');
  const [savingGeminiConfig, setSavingGeminiConfig] = useState(false);

  // Gemini API Pool Manager
  const [poolKeys, setPoolKeys] = useState([]);
  const [poolSummary, setPoolSummary] = useState({ total_keys: 0, active_keys: 0, total_capacity: 0, total_used: 0, remaining: 0 });
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newKeyLimit, setNewKeyLimit] = useState(20);
  const [addingKey, setAddingKey] = useState(false);
  const [poolAddMode, setPoolAddMode] = useState('bulk');
  const [bulkKeysText, setBulkKeysText] = useState('');
  const [bulkDefaultLimit, setBulkDefaultLimit] = useState(20);
  const [bulkAliasPrefix, setBulkAliasPrefix] = useState('AISKey');
  const [validateLive, setValidateLive] = useState(true);
  const [testingHealth, setTestingHealth] = useState(false);
  const [cleaningDead, setCleaningDead] = useState(false);
  
  // Cloud Storage Setup
  const [storageProvider, setStorageProvider] = useState('gdrive');
  const [nextcloudUrl, setNextcloudUrl] = useState('');
  const [nextcloudUsername, setNextcloudUsername] = useState('');
  const [nextcloudAppPassword, setNextcloudAppPassword] = useState('');
  const [nextcloudTargetFolder, setNextcloudTargetFolder] = useState('/MAKNA_Video_Generations');
  const [driveTargetFolder, setDriveTargetFolder] = useState('/MAKNA_Video_Generations');
  const [testingNextcloud, setTestingNextcloud] = useState(false);
  const [savingStorageConfig, setSavingStorageConfig] = useState(false);
  const [appOrigin, setAppOrigin] = useState('http://localhost:3000');

  // Facebook Page Credentials
  const [fbPageId, setFbPageId] = useState('');
  const [fbPageIds, setFbPageIds] = useState('');
  const [fbPageToken, setFbPageToken] = useState('');
  const [maskedFbToken, setMaskedFbToken] = useState('');
  const [fbServerUrl, setFbServerUrl] = useState('');
  const [hasFbToken, setHasFbToken] = useState(false);
  const [editingFb, setEditingFb] = useState(false);
  const [savingFb, setSavingFb] = useState(false);
  const [testingFb, setTestingFb] = useState(false);
  const [fbTestResult, setFbTestResult] = useState(null);
  const [discoveredPages, setDiscoveredPages] = useState([]);
  const [selectedPageIds, setSelectedPageIds] = useState([]);
  const [discoveringPages, setDiscoveringPages] = useState(false);
  const [manualInputPageId, setManualInputPageId] = useState('');
  const [addingManualPage, setAddingManualPage] = useState(false);

  // Marketplace Scraper Settings
  const [scraperUseCdp, setScraperUseCdp] = useState(true);
  const [testingCdp, setTestingCdp] = useState(false);
  const [scraperChromeProfile, setScraperChromeProfile] = useState('Default');
  const [ytdlpCookiesFromBrowser, setYtdlpCookiesFromBrowser] = useState('none');
  const [savingScraperConfig, setSavingScraperConfig] = useState(false);

  // Category Tabs & Collapsible Cards State
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'ai' | 'storage' | 'automation'
  const [collapsedCards, setCollapsedCards] = useState({});

  const fileRef = useRef(null);

  useEffect(() => {
    fetchKBs();
    fetchSettings();
    fetchGoogleStatus();
    fetchScraperSessionStatus();
    fetchPool();
    if (typeof window !== 'undefined') {
      setAppOrigin(window.location.origin);
      try {
        const saved = localStorage.getItem('makna_settings_collapsed_cards');
        if (saved) setCollapsedCards(JSON.parse(saved));
      } catch (e) {}
    }
    const interval = setInterval(() => {
      fetchPool();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const toastTimerRef = useRef(null);

  function showToast(msg, type = 'success') {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    const duration = type === 'error' ? 15000 : 3500;
    toastTimerRef.current = setTimeout(() => setToast(null), duration);
  }

  function toggleCardCollapse(cardKey) {
    setCollapsedCards(prev => {
      const next = { ...prev, [cardKey]: !prev[cardKey] };
      if (typeof window !== 'undefined') {
        localStorage.setItem('makna_settings_collapsed_cards', JSON.stringify(next));
      }
      return next;
    });
  }

  function expandAllCards() {
    setCollapsedCards({});
    if (typeof window !== 'undefined') {
      localStorage.setItem('makna_settings_collapsed_cards', JSON.stringify({}));
    }
  }

  function collapseAllCards() {
    const allKeys = ['gemini_config', 'pool_manager', 'minimax', 'cloud_storage', 'google_workspace', 'kb', 'glabs_webhook', 'marketplace_scraper', 'facebook_page'];
    const next = {};
    allKeys.forEach(k => next[k] = true);
    setCollapsedCards(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('makna_settings_collapsed_cards', JSON.stringify(next));
    }
  }

  async function fetchKBs() {
    const res = await fetch('/api/kb');
    const data = await res.json();
    if (data.success) setKbs(data.data);
  }

  async function fetchSettings() {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.success) {
      setMaskedKey(data.data.gemini_api_key || '');
      setHasKey(data.data.has_api_key);
      setMaskedMinimaxKey(data.data.minimax_api_key || '');
      setHasMinimaxKey(data.data.has_minimax_key);
      setMaskedWebhookKey(data.data.webhook_api_key || '');
      setHasWebhookKey(data.data.has_webhook_key);
      setWebhookHost(data.data.webhook_host || '100.117.59.92');
      setWebhookPort(data.data.webhook_port || '8765');
      setWebhookImageModel(data.data.webhook_image_model || 'nano_banana_pro');
      setWebhookVideoModel(data.data.webhook_video_model || 'veo_31_lite_relaxed');
      setWebhookDelayEnabled(data.data.webhook_delay_enabled === 1);
      setWebhookDelayMin(data.data.webhook_delay_min !== undefined ? data.data.webhook_delay_min : 10);
      setWebhookDelayMax(data.data.webhook_delay_max !== undefined ? data.data.webhook_delay_max : 20);
      setWebhookT2iPattern(data.data.webhook_t2i_pattern || 'threading');
      setStorageProvider(data.data.storage_provider || 'gdrive');
      setNextcloudUrl(data.data.nextcloud_url || '');
      setNextcloudUsername(data.data.nextcloud_username || '');
      setNextcloudAppPassword(data.data.nextcloud_app_password || '');
      setNextcloudTargetFolder(data.data.nextcloud_target_folder || '/MAKNA_Video_Generations');
      setDriveTargetFolder(data.data.drive_target_folder || '/MAKNA_Video_Generations');
      setGeminiApiTier(data.data.gemini_api_tier || 'paid');
      setGeminiContextCaching(data.data.gemini_context_caching || 'on');
      setFbPageId(data.data.fb_page_id || '');
      setFbPageIds(data.data.fb_page_ids || '');
      setMaskedFbToken(data.data.fb_page_token || '');
      setHasFbToken(data.data.has_fb_token);
      setFbServerUrl(data.data.fb_server_url || '');

      const initialSelected = (data.data.fb_page_ids || data.data.fb_page_id || '')
        .split(',')
        .map(id => id.trim())
        .filter(Boolean);
      setSelectedPageIds(initialSelected);

      if (data.data.has_fb_token) {
        fetch('/api/settings/facebook-pages')
          .then(r => r.json())
          .then(res => {
            if (res.success && Array.isArray(res.pages)) {
              setDiscoveredPages(res.pages);
              if (initialSelected.length === 0 && res.pages.length > 0) {
                setSelectedPageIds(res.pages.map(p => p.id));
              }
            }
          })
          .catch(() => {});
      }
      setScraperUseCdp(true);
      setScraperChromeProfile(data.data.scraper_chrome_profile || 'Default');
      setYtdlpCookiesFromBrowser(data.data.ytdlp_cookies_from_browser || 'none');
    }
  }

  async function fetchGoogleStatus() {
    const res = await fetch('/api/google/status');
    const data = await res.json();
    if (data.success) {
      setGoogleStatus({
        credentialsSet: data.data.credentialsSet,
        connected: data.data.connected,
        email: data.data.userEmail || null,
      });
      if (data.data.clientId) setGoogleClientId(data.data.clientId);
    }
  }

  async function fetchScraperSessionStatus() {
    try {
      const res = await fetch('/api/scraper/session');
      const data = await res.json();
      if (data.success) {
        setScraperUseCdp(true);
        if (data.data.chromeProfile) setScraperChromeProfile(data.data.chromeProfile);
      }
    } catch (e) {}
  }

  async function saveApiKey() {
    if (!apiKey.trim()) return;
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gemini_api_key: apiKey }),
    });
    const data = await res.json();
    if (data.success) {
      showToast('API Key berhasil disimpan');
      setApiKey('');
      setEditing(false);
      setTestResult(null);
      fetchSettings();
    }
  }

  async function discoverFacebookPages(overrideToken = null) {
    setDiscoveringPages(true);
    try {
      const tokenToUse = overrideToken || fbPageToken;
      const res = await fetch('/api/settings/facebook-pages', {
        method: tokenToUse ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
        ...(tokenToUse ? { body: JSON.stringify({ token: tokenToUse }) } : {})
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.pages) && data.pages.length > 0) {
        setDiscoveredPages(data.pages);
        if (selectedPageIds.length === 0) {
          setSelectedPageIds(data.pages.map(p => p.id));
        }
        showToast(`Berhasil menemukan ${data.pages.length} Halaman Facebook / IG!`, 'success');
      } else {
        showToast(data.error || 'Tidak ada Halaman Facebook yang ditemukan untuk token ini.', 'error');
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
    setDiscoveringPages(false);
  }

  async function handleAddManualPage() {
    if (!manualInputPageId.trim()) return;
    setAddingManualPage(true);
    try {
      const tokenToUse = fbPageToken || undefined;
      const inputIds = manualInputPageId.split(',').map(s => s.trim()).filter(Boolean);
      const allKnownIds = Array.from(new Set([...selectedPageIds, ...discoveredPages.map(p => p.id), ...inputIds]));

      const res = await fetch('/api/settings/facebook-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenToUse,
          manualPageIds: allKnownIds
        })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.pages)) {
        setDiscoveredPages(data.pages);
        const newSelected = Array.from(new Set([...selectedPageIds, ...inputIds]));
        setSelectedPageIds(newSelected);
        setManualInputPageId('');
        showToast(`Berhasil menambahkan dan memverifikasi ${data.pages.length} Halaman Meta! 🟢`, 'success');
      } else {
        showToast(data.error || 'Gagal memverifikasi Page ID ke Meta', 'error');
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
    setAddingManualPage(false);
  }

  async function saveFbSettings() {
    setSavingFb(true);
    try {
      const activeIds = selectedPageIds.filter(Boolean);
      const body = { 
        fb_page_id: activeIds.length > 0 ? activeIds[0] : '',
        fb_page_ids: activeIds.join(','),
        fb_server_url: fbServerUrl.trim()
      };
      if (fbPageToken) body.fb_page_token = fbPageToken;

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        // Sync selected pages to publishing_accounts
        if (discoveredPages.length > 0) {
          const selectedPagesToSave = discoveredPages.filter(p => selectedPageIds.includes(p.id));
          await fetch('/api/v2/publishing/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: fbPageToken || undefined,
              pages: selectedPagesToSave
            })
          }).catch(err => console.warn('[Publishing Accounts Batch Save Warning]', err));
        }

        showToast('Konfigurasi Meta & Halaman Publikasi berhasil disimpan!');
        setFbPageToken('');
        setEditingFb(false);
        fetchSettings();
      } else {
        showToast(data.error, 'error');
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
    setSavingFb(false);
  }

  async function testFbSettings() {
    setTestingFb(true);
    setFbTestResult(null);
    try {
      const activeIds = selectedPageIds.filter(Boolean);
      const body = { 
        fb_page_id: activeIds.length > 0 ? activeIds[0] : '',
        fb_page_ids: activeIds.join(',')
      };
      if (fbPageToken) body.fb_page_token = fbPageToken;

      const res = await fetch('/api/settings/test-facebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setFbTestResult({ type: 'success', message: data.message || 'Koneksi ke Facebook Page Berhasil!' });
        showToast('🟢 Koneksi Facebook Berhasil!', 'success');
      } else {
        setFbTestResult({ type: 'error', message: data.error || 'Gagal terhubung ke Facebook Page' });
        showToast('🔴 Gagal Koneksi Facebook', 'error');
      }
    } catch (e) {
      setFbTestResult({ type: 'error', message: e.message });
      showToast('🔴 Error testing Facebook', 'error');
    }
    setTestingFb(false);
  }

  async function saveScraperSettings() {
    setSavingScraperConfig(true);
    try {
      const body = {
        scraper_use_cdp: 1,
        scraper_chrome_profile: scraperChromeProfile.trim(),
        ytdlp_cookies_from_browser: ytdlpCookiesFromBrowser
      };
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      showToast(data.success ? 'Marketplace scraper settings saved!' : data.error, data.success ? 'success' : 'error');
      fetchSettings();
    } catch (e) {
      showToast(e.message, 'error');
    }
    setSavingScraperConfig(false);
  }

  async function testCdpConnection() {
    setTestingCdp(true);
    try {
      const res = await fetch('/api/scraper/session/test-cdp', { method: 'POST' });
      const data = await res.json();
      showToast(data.success ? '🔌 Google Chrome CDP Connected!' : `🔴 Gagal: ${data.error}`, data.success ? 'success' : 'error');
    } catch (e) {
      showToast(`🔴 Error testing CDP: ${e.message}`, 'error');
    }
    setTestingCdp(false);
  }

  async function saveMinimaxSettings() {
    if (!minimaxApiKey.trim()) return;
    setSavingMinimax(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minimax_api_key: minimaxApiKey }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('MiniMax API Key berhasil disimpan');
        setMinimaxApiKey('');
        setEditingMinimax(false);
        fetchSettings();
      } else {
        showToast(data.error, 'error');
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
    setSavingMinimax(false);
  }

  async function saveGeminiSettings() {
    setSavingGeminiConfig(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gemini_api_tier: geminiApiTier,
          gemini_context_caching: geminiContextCaching,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Pengaturan Tier & Caching berhasil disimpan');
        fetchSettings();
      } else {
        showToast(data.error, 'error');
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
    setSavingGeminiConfig(false);
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const keyToTest = editing ? apiKey : maskedKey;
      const res = await fetch('/api/settings/test-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: keyToTest }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (e) {
      setTestResult({ success: false, message: e.message });
    }
    setTesting(false);
  }

  async function saveGoogleCredentials() {
    if (!googleClientId.trim() || !googleClientSecret.trim()) return;
    setSavingGoogle(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          google_client_id: googleClientId.trim(),
          google_client_secret: googleClientSecret.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Google credentials berhasil disimpan');
        fetchGoogleStatus();
      } else {
        showToast(data.error, 'error');
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
    setSavingGoogle(false);
  }

  async function disconnectGoogle() {
    if (!confirm('Disconnect Google Account?')) return;
    await fetch('/api/google/status', { method: 'DELETE' });
    showToast('Google account disconnected');
    fetchGoogleStatus();
  }

  async function fetchPool() {
    try {
      const res = await fetch('/api/keys');
      const data = await res.json();
      if (data.success) {
        setPoolKeys(data.data.keys);
        setPoolSummary(data.data.pool);
      }
    } catch (e) {
      console.error('Pool fetch error:', e);
    }
  }

  async function addPoolKey() {
    if (!newKeyName.trim() || !newKeyValue.trim()) return;
    setAddingKey(true);
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key_name: newKeyName, api_key: newKeyValue, daily_limit: newKeyLimit }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('API Key successfully added to pool');
        setNewKeyName(''); 
        setNewKeyValue(''); 
        setNewKeyLimit(20);
        fetchPool();
      } else {
        showToast(data.error, 'error');
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
    setAddingKey(false);
  }

  async function addPoolKeysBulk() {
    if (!bulkKeysText.trim()) return;
    
    const lines = bulkKeysText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;

    setAddingKey(true);
    try {
      const formattedKeys = lines.map((line, idx) => {
        let name = '';
        let key = line;

        if (line.includes(':')) {
          const parts = line.split(':');
          name = parts[0].trim();
          key = parts.slice(1).join(':').trim();
        } else if (line.includes(',')) {
          const parts = line.split(',');
          name = parts[0].trim();
          key = parts.slice(1).join(',').trim();
        }

        if (!name) {
          const num = String(idx + 1).padStart(2, '0');
          name = `${bulkAliasPrefix || 'AISKey'}_${num}`;
        }

        return {
          key_name: name,
          api_key: key,
          daily_limit: Number(bulkDefaultLimit) || 20,
          tier: 'FREE'
        };
      });

      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulk_keys: formattedKeys, validate_live: validateLive }),
      });

      const data = await res.json();
      if (data.success) {
        const s = data.summary || {};
        showToast(`${s.added || 0} ditambahkan · ${s.duplicates || 0} duplikat · ${s.rejected || 0} ditolak · ${s.failed || 0} gagal`);
        setBulkKeysText('');
        await fetchPool();
      } else {
        const s = data.summary || {};
        showToast(data.error || `${s.failed || 0} key gagal disimpan. Tidak ada key baru yang masuk.`, 'error');
        await fetchPool();
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
    setAddingKey(false);
  }

  async function healthCheckAllPoolKeys() {
    setTestingHealth(true);
    showToast('⏳ Memulai pengujian keaktifan seluruh API Key di pool...');
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'health-check-all' }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        fetchPool();
      } else {
        showToast(data.error, 'error');
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
    setTestingHealth(false);
  }

  async function cleanDeadPoolKeys() {
    if (!confirm('Hapus semua API Key yang mati/invalid dari pool?')) return;
    setCleaningDead(true);
    try {
      const res = await fetch('/api/keys?action=clean-dead', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        fetchPool();
      } else {
        showToast(data.error, 'error');
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
    setCleaningDead(false);
  }

  async function togglePoolKey(id, currentActive) {
    try {
      const res = await fetch('/api/keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: currentActive ? 0 : 1 }),
      });
      const data = await res.json();
      if (data.success) {
        fetchPool();
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function removePoolKey(id) {
    if (!confirm('Remove this API Key from pool?')) return;
    try {
      const res = await fetch(`/api/keys?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('API Key removed from pool');
        fetchPool();
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function uploadFile(file) {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/kb', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();

    if (data.success) {
      showToast(`Knowledge Base ${file.name} uploaded!`);
      fetchKBs();
    } else {
      showToast(data.error, 'error');
    }
    setUploading(false);
  }

  async function deleteKB(id, name) {
    if (!confirm(`Hapus KB "${name}"?`)) return;
    const res = await fetch(`/api/kb?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(`KB ${name} dihapus`);
      fetchKBs();
    }
  }

  async function seedKBs() {
    setSeeding(true);
    const res = await fetch('/api/kb/seed', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message);
      fetchKBs();
    } else {
      showToast(data.error, 'error');
    }
    setSeeding(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files);
    files.forEach(uploadFile);
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // Collapsible Card Renderer Component
  function renderCollapsibleCard(key, category, title, icon, content) {
    if (activeTab !== 'all' && activeTab !== category) {
      return null;
    }
    const isCollapsed = !!collapsedCards[key];

    return (
      <div key={key} className="card" style={{ marginBottom: '20px', transition: 'all 0.2s ease' }}>
        <div
          className="card-title"
          onClick={() => toggleCardCollapse(key)}
          style={{
            justifyContent: 'space-between',
            cursor: 'pointer',
            userSelect: 'none',
            borderBottom: isCollapsed ? 'none' : '1px solid var(--border)',
            paddingBottom: isCollapsed ? '0' : '12px',
            marginBottom: isCollapsed ? '0' : '16px',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="icon">{icon}</span>
            <span style={{ fontWeight: 600 }}>{title}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: '4px' }}
            >
              {isCollapsed ? '🔽 Buka' : '🔼 Lipat'}
            </button>
          </div>
        </div>

        {!isCollapsed && content}
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-container">
          <div className="page-header" style={{ marginBottom: '20px' }}>
            <h2>⚙ Settings</h2>
            <p>Pusat Konfigurasi Engine AI, Storage, & Integrasi MAKNA Flow</p>
          </div>

          {/* Toast Notification */}
          {toast && (
            <div
              className={`toast toast-${toast.type}`}
              style={{
                position: 'fixed',
                bottom: '28px',
                right: '28px',
                maxWidth: '420px',
                width: 'calc(100vw - 56px)',
                zIndex: 9999,
                background: toast.type === 'error' ? 'rgba(225, 29, 72, 0.96)' : 'rgba(16, 185, 129, 0.95)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: '12px',
                padding: '14px 18px',
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
                color: '#ffffff',
                animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{toast.type === 'error' ? '🔴' : '✅'}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.01em' }}>
                      {toast.type === 'error' ? 'Error / Peringatan' : 'Berhasil'}
                    </div>
                    <div style={{ fontSize: '0.8rem', lineHeight: 1.4, marginTop: '2px', opacity: 0.95, wordBreak: 'break-word', userSelect: 'text' }}>
                      {toast.msg}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setToast(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255, 255, 255, 0.8)',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    lineHeight: 1,
                    padding: '2px 4px'
                  }}
                >
                  ✕
                </button>
              </div>

              {toast.type === 'error' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator?.clipboard) {
                        navigator.clipboard.writeText(toast.msg);
                      }
                      showToast('📋 Pesan error berhasil disalin ke clipboard!', 'success');
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#ffffff',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '4px 10px',
                      cursor: 'pointer'
                    }}
                  >
                    📋 Copy Error Message
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Category Tabs & Card Toggle Bar */}
          <div style={{
            display: 'flex',
            justify: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
            flexWrap: 'wrap',
            gap: '12px',
            background: 'var(--bg-card)',
            padding: '14px 18px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: '🌐 Semua Pengaturan' },
                { id: 'ai', label: '🤖 Engine & AI Services' },
                { id: 'storage', label: '☁️ Storage & Cloud' },
                { id: 'automation', label: '⚙️ Otomasi & Integrasi' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={expandAllCards}
                className="btn btn-sm btn-secondary"
                style={{ fontSize: '0.75rem', padding: '5px 10px' }}
              >
                📂 Buka Semua
              </button>
              <button
                type="button"
                onClick={collapseAllCards}
                className="btn btn-sm btn-secondary"
                style={{ fontSize: '0.75rem', padding: '5px 10px' }}
              >
                📁 Lipat Semua
              </button>
            </div>
          </div>

          {/* 1. CARD: Gemini API Configuration */}
          {renderCollapsibleCard('gemini_config', 'ai', 'Gemini API Configuration', '🔑', (
            <div>
              <div className="form-group">
                <label className="form-label">API Key Utama (Fallback)</label>
                {hasKey && !editing ? (
                  <div>
                    <div className="api-key-group">
                      <div className="form-input" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', cursor: 'default' }}>
                        {maskedKey}
                      </div>
                      <button className="btn btn-secondary" onClick={() => { setEditing(true); setApiKey(''); setTestResult(null); }}>✏️ Ganti</button>
                      <button className="btn btn-primary" onClick={testConnection} disabled={testing}>
                        {testing ? '⏳' : '🔌'} Test
                      </button>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '6px' }}>✓ API Key aktif tersimpan</p>
                  </div>
                ) : (
                  <div>
                    <div className="api-key-group">
                      <input
                        type="password"
                        className="form-input"
                        placeholder="Masukkan Gemini API Key dari Google AI Studio"
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                        autoFocus
                      />
                      <button className="btn btn-primary" onClick={saveApiKey} disabled={!apiKey.trim()}>💾 Save</button>
                      {hasKey && <button className="btn btn-secondary" onClick={() => { setEditing(false); setApiKey(''); setTestResult(null); }}>Batal</button>}
                      <button className="btn btn-secondary" onClick={testConnection} disabled={testing || !apiKey.trim()}>
                        {testing ? '⏳' : '🔌'} Test
                      </button>
                    </div>
                    {hasKey && <p style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: '6px' }}>⚠ Masukkan key baru untuk mengganti yang lama</p>}
                  </div>
                )}

                {testResult && (
                  <p style={{ fontSize: '0.8rem', marginTop: '8px', color: testResult.success ? 'var(--success)' : 'var(--danger)' }}>
                    {testResult.success ? '✓ ' : '✗ '}{testResult.message}
                  </p>
                )}
              </div>

              <div style={{ borderTop: '1px solid var(--border)', marginTop: '20px', paddingTop: '20px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.88rem', fontWeight: '600' }}>Pengaturan Tier API & Context Caching</h4>
                
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Pilih Tier API</label>
                  <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                      <input type="radio" name="geminiApiTier" value="paid" checked={geminiApiTier === 'paid'} onChange={() => {
                        setGeminiApiTier('paid');
                        setGeminiContextCaching('on');
                      }} />
                      Paid Tier API (Premium)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                      <input type="radio" name="geminiApiTier" value="free" checked={geminiApiTier === 'free'} onChange={() => {
                        setGeminiApiTier('free');
                        setGeminiContextCaching('off');
                      }} />
                      Free Tier API (Standard)
                    </label>
                  </div>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    {geminiApiTier === 'paid' 
                      ? '✓ Menggunakan Kunci Utama yang stabil (tanpa rotasi) dan mendukung Context Caching.' 
                      : '✓ Menggunakan rotasi key pool jika tersedia. Caching dinonaktifkan secara otomatis.'}
                  </p>
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label className="form-label">Status Context Caching</label>
                  {geminiApiTier === 'paid' ? (
                    <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input type="radio" name="geminiContextCaching" value="on" checked={geminiContextCaching === 'on'} onChange={() => setGeminiContextCaching('on')} />
                        Aktif (Hemat Anggaran 90%)
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input type="radio" name="geminiContextCaching" value="off" checked={geminiContextCaching === 'off'} onChange={() => setGeminiContextCaching('off')} />
                        Nonaktif
                      </label>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'not-allowed', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        <input type="radio" name="geminiContextCaching" value="on" checked={false} disabled />
                        Aktif (Hanya untuk Paid Tier)
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'default', fontSize: '0.9rem' }}>
                        <input type="radio" name="geminiContextCaching" value="off" checked={true} readOnly />
                        Nonaktif (Otomatis Off pada Free Tier)
                      </label>
                    </div>
                  )}
                </div>

                <button className="btn btn-primary" onClick={saveGeminiSettings} disabled={savingGeminiConfig}>
                  {savingGeminiConfig ? '⏳ Saving...' : '💾 Save settings'}
                </button>
              </div>
            </div>
          ))}

          {/* 2. CARD: Gemini API Pool Manager */}
          {renderCollapsibleCard('pool_manager', 'ai', 'Gemini API Pool Manager', '🏊', (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  📊 Total pool load: {poolSummary.total_used || 0} / {poolSummary.total_capacity || 0} queries today
                </span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={healthCheckAllPoolKeys}
                    disabled={testingHealth}
                    style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                  >
                    {testingHealth ? '⏳ Testing Keys...' : '🔍 Audit & Test All Keys'}
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={cleanDeadPoolKeys}
                    disabled={cleaningDead}
                    style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                  >
                    {cleaningDead ? '⏳ Cleaning...' : '🗑️ Clean Dead Keys'}
                  </button>
                </div>
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px', lineHeight: 1.6 }}>
                Stack multiple Free tier API Keys to maximize limits. Engine intelligently round-robins queries & auto failovers 429 errors.
              </p>

              {poolSummary.total_capacity > 0 && (
                <div style={{ marginBottom: '24px', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.75rem', fontWeight: 600 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Daily Key-Pool Quota Utilization</span>
                    <span style={{ color: poolSummary.remaining > 0 ? '#00b894' : '#e17055' }}>
                      {poolSummary.remaining || 0} calls left
                    </span>
                  </div>
                  <div style={{ height: '10px', borderRadius: '5px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: '5px',
                      width: `${Math.min(100, ((poolSummary.total_used || 0) / poolSummary.total_capacity) * 100)}%`,
                      background: poolSummary.remaining > 0
                        ? 'linear-gradient(90deg, #00b894, #00cec9)'
                        : 'linear-gradient(90deg, #e17055, #d63031)',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <span>🔑 {poolSummary.active_keys || 0} active keys in pool</span>
                    <span>Total Pool capacity: {poolSummary.total_capacity || 0} queries/day</span>
                  </div>
                </div>
              )}

              {/* Key List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {poolKeys.length > 0 ? poolKeys.map(k => (
                  <div key={k.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 18px', borderRadius: 'var(--radius-sm)',
                    background: k.is_active ? 'var(--bg-glass)' : 'rgba(255,255,255,0.02)', 
                    border: '1px solid var(--border)',
                    opacity: k.is_active ? 1 : 0.45,
                    transition: 'all 0.2s ease',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{k.key_name}</span>
                        <span style={{ 
                          fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px',
                          background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)'
                        }}>{k.tier}</span>

                        {k.status === 'INVALID' || k.is_active === 0 ? (
                          <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(225,112,85,0.2)', color: '#e17055', fontWeight: 600 }}>
                            🔴 DEAD / INVALID
                          </span>
                        ) : (k.used_today || 0) >= k.daily_limit ? (
                          <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(253,203,110,0.2)', color: '#ffeaa7', fontWeight: 600 }}>
                            ⏸️ COOLDOWN
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(0,184,148,0.2)', color: '#00b894', fontWeight: 600 }}>
                            🟢 LIVE
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {k.api_key} · Daily Cap: {k.daily_limit} calls
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{
                          fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px',
                          background: (k.used_today || 0) >= k.daily_limit ? 'rgba(225,112,85,0.15)' : 'rgba(0,184,148,0.15)',
                          color: (k.used_today || 0) >= k.daily_limit ? '#e17055' : '#00b894',
                          fontWeight: 600
                        }}>
                          {k.used_today || 0} / {k.daily_limit} used
                        </span>
                      </div>
                      
                      <button
                        className="btn btn-sm"
                        onClick={() => togglePoolKey(k.id, k.is_active)}
                        style={{
                          fontSize: '0.75rem',
                          padding: '4px 12px',
                          fontWeight: 600,
                          background: k.is_active ? 'rgba(253, 203, 110, 0.18)' : 'rgba(0, 184, 148, 0.22)',
                          color: k.is_active ? '#ffeaa7' : '#00b894',
                          border: `1px solid ${k.is_active ? 'rgba(253, 203, 110, 0.4)' : 'rgba(0, 184, 148, 0.4)'}`,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {k.is_active ? '⏸ Pause' : '▶ Enable'}
                      </button>
                      
                      <button className="btn btn-sm btn-danger" onClick={() => removePoolKey(k.id)}
                        style={{ fontSize: '0.75rem', padding: '4px 10px' }}>✕ Delete</button>
                    </div>
                  </div>
                )) : (
                  <div className="empty-state" style={{ padding: '30px' }}>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>No API Keys in pool. Add keys below to start automation.</p>
                  </div>
                )}
              </div>

              {/* Add Key Form */}
              <div style={{ 
                marginTop: '20px', padding: '16px', background: 'rgba(255,255,255,0.02)',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                  <h5 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    + Tambah Gemini API Key ke Pool
                  </h5>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setPoolAddMode('bulk')}
                      className={`btn btn-sm ${poolAddMode === 'bulk' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.75rem', padding: '4px 12px' }}
                    >
                      📋 Bulk Add (Paste Multi-line)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPoolAddMode('single')}
                      className={`btn btn-sm ${poolAddMode === 'single' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.75rem', padding: '4px 12px' }}
                    >
                      ➕ Single Input
                    </button>
                  </div>
                </div>

                {poolAddMode === 'bulk' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Prefix Alias:</span>
                        <input 
                          className="form-input" 
                          placeholder="e.g. AISKey"
                          value={bulkAliasPrefix} 
                          onChange={e => setBulkAliasPrefix(e.target.value)}
                          style={{ width: '110px', fontSize: '0.8rem', padding: '6px 10px' }} 
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Default Daily Cap:</span>
                        <input 
                          className="form-input" 
                          type="number" 
                          placeholder="20" 
                          min="1" 
                          max="1500"
                          value={bulkDefaultLimit} 
                          onChange={e => setBulkDefaultLimit(Number(e.target.value))}
                          style={{ width: '80px', fontSize: '0.8rem', padding: '6px 10px', textAlign: 'center' }} 
                        />
                      </div>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={validateLive}
                          onChange={e => setValidateLive(e.target.checked)}
                        />
                        🔍 Ping Test sebelum simpan (Filter key mati/invalid)
                      </label>

                      {(() => {
                        const linesCount = bulkKeysText.split('\n').map(l => l.trim()).filter(l => l.length > 0).length;
                        return (
                          <span style={{ fontSize: '0.75rem', color: linesCount > 0 ? '#00b894' : 'var(--text-muted)', fontWeight: 600 }}>
                            🔑 Terdeteksi {linesCount} API Key {linesCount > 0 ? `(${bulkAliasPrefix}_01 s/d ${bulkAliasPrefix}_${String(linesCount).padStart(2, '0')})` : ''}
                          </span>
                        );
                      })()}
                    </div>

                    <textarea
                      className="form-input"
                      rows="6"
                      placeholder="Tempelkan daftar Gemini API Keys di sini (1 baris per API Key)&#10;Contoh:&#10;AIzaSyA1234567890abcdef...&#10;AIzaSyB0987654321fedcba...&#10;&#10;Atau format custom:&#10;Akun_Kerja_1 : AIzaSyA1234567890abcdef..."
                      value={bulkKeysText}
                      onChange={e => setBulkKeysText(e.target.value)}
                      style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', lineHeight: '1.5' }}
                    />

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button 
                        className="btn btn-primary" 
                        onClick={addPoolKeysBulk}
                        disabled={addingKey || !bulkKeysText.trim()}
                        style={{ fontSize: '0.82rem', padding: '8px 20px' }}
                      >
                        {addingKey ? '⏳ Importing Keys...' : '⚡ Bulk Import API Keys'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <input className="form-input" placeholder="Alias Name (e.g. WorkKey1)"
                      value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
                      style={{ flex: '1 1 150px', fontSize: '0.82rem', padding: '8px 12px' }} />
                    
                    <input className="form-input" type="password" placeholder="Gemini API Key"
                      value={newKeyValue} onChange={e => setNewKeyValue(e.target.value)}
                      style={{ flex: '2 1 250px', fontSize: '0.82rem', padding: '8px 12px' }} />
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Daily Cap:</span>
                      <input className="form-input" type="number" placeholder="Cap" min="1" max="1500"
                        value={newKeyLimit} onChange={e => setNewKeyLimit(Number(e.target.value))}
                        style={{ width: '80px', fontSize: '0.82rem', padding: '8px 12px', textAlign: 'center' }} />
                    </div>

                    <button className="btn btn-primary" onClick={addPoolKey} 
                      disabled={addingKey || !newKeyName.trim() || !newKeyValue.trim()}
                      style={{ fontSize: '0.82rem', padding: '8px 16px' }}>
                      {addingKey ? '⏳ Adding...' : 'Add Key'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* 3. CARD: MiniMax AI Configuration */}
          {renderCollapsibleCard('minimax', 'ai', 'MiniMax AI Configuration', '🎙️', (
            <div>
              <div className="form-group">
                <label className="form-label">MiniMax API Key</label>
                {hasMinimaxKey && !editingMinimax ? (
                  <div>
                    <div className="api-key-group">
                      <div className="form-input" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', cursor: 'default' }}>
                        {maskedMinimaxKey}
                      </div>
                      <button className="btn btn-secondary" onClick={() => { setEditingMinimax(true); setMinimaxApiKey(''); }}>✏️ Ganti</button>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '6px' }}>✓ MiniMax API Key aktif tersimpan</p>
                  </div>
                ) : (
                  <div>
                    <div className="api-key-group">
                      <input
                        type="password"
                        className="form-input"
                        placeholder="Masukkan MiniMax API Key"
                        value={minimaxApiKey}
                        onChange={e => setMinimaxApiKey(e.target.value)}
                        autoFocus={editingMinimax}
                      />
                      {hasMinimaxKey && <button className="btn btn-secondary" onClick={() => { setEditingMinimax(false); setMinimaxApiKey(''); }}>Batal</button>}
                    </div>
                    {hasMinimaxKey && <p style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: '6px' }}>⚠ Masukkan key baru untuk mengganti yang lama</p>}
                  </div>
                )}
              </div>

              <div style={{ marginTop: '16px' }}>
                <button
                  className="btn btn-primary"
                  onClick={saveMinimaxSettings}
                  disabled={savingMinimax || !minimaxApiKey.trim()}
                >
                  {savingMinimax ? '⏳ Saving...' : '💾 Save MiniMax Config'}
                </button>
              </div>
            </div>
          ))}

          {/* 4. CARD: Cloud Storage Configuration (Nextcloud & Google Drive Setup) */}
          {renderCollapsibleCard('cloud_storage', 'storage', 'Cloud Storage Configuration', '☁️', (
            <div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Pilih penyedia penyimpanan utama untuk menyimpan hasil video, dokumen markdown, dan aset media.
              </p>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Active Storage Provider</label>
                <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input type="radio" name="storageProvider" value="gdrive" checked={storageProvider === 'gdrive'} onChange={() => setStorageProvider('gdrive')} />
                    Google Drive
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input type="radio" name="storageProvider" value="nextcloud" checked={storageProvider === 'nextcloud'} onChange={() => setStorageProvider('nextcloud')} />
                    Nextcloud Server
                  </label>
                </div>
              </div>

              {/* Nextcloud Setup */}
              {storageProvider === 'nextcloud' && (
                <div style={{ padding: '16px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: '16px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--accent-light)' }}>{'>'} Nextcloud Connection Setup</h4>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Server URL</label>
                    <input className="form-input" placeholder="http://192.168.10.50/nextcloud" value={nextcloudUrl} onChange={e => setNextcloudUrl(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Username</label>
                    <input className="form-input" placeholder="admin_makna" value={nextcloudUsername} onChange={e => setNextcloudUsername(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">App Password</label>
                    <input type="password" className="form-input" placeholder="********************" value={nextcloudAppPassword} onChange={e => setNextcloudAppPassword(e.target.value)} />
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>Disarankan generate dari Nextcloud Security Settings.</div>
                  </div>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Default Target Folder Nextcloud</label>
                    <input className="form-input" placeholder="/MAKNA_Video_Generations" value={nextcloudTargetFolder} onChange={e => setNextcloudTargetFolder(e.target.value)} />
                  </div>
                  
                  <button className="btn btn-sm btn-secondary" onClick={async () => {
                    if (!nextcloudUrl || !nextcloudUsername || !nextcloudAppPassword) {
                      showToast('URL, Username, dan Password wajib diisi untuk test.', 'error'); return;
                    }
                    setTestingNextcloud(true);
                    try {
                      const res = await fetch('/api/settings/test-nextcloud', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: nextcloudUrl, username: nextcloudUsername, password: nextcloudAppPassword })
                      });
                      const data = await res.json();
                      showToast(data.success ? '🟢 Nextcloud Connected!' : `🔴 Gagal: ${data.message}`, data.success ? 'success' : 'error');
                    } catch (e) {
                      showToast(`🔴 Gagal: ${e.message}`, 'error');
                    }
                    setTestingNextcloud(false);
                  }} disabled={testingNextcloud}>
                    {testingNextcloud ? '⏳ Testing...' : '🔌 Test Connection'}
                  </button>
                </div>
              )}

              {/* Google Drive Setup (Unified Single Target Folder) */}
              {storageProvider === 'gdrive' && (
                <div style={{ padding: '16px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: '16px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--accent-light)' }}>{'>'} Google Drive Connection Setup</h4>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Default Target Folder Google Drive</label>
                    <input 
                      className="form-input" 
                      placeholder="/MAKNA_Video_Generations" 
                      value={driveTargetFolder} 
                      onChange={e => setDriveTargetFolder(e.target.value)} 
                    />
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.5 }}>
                      Folder utama penyimpanan Google Drive. Sub-folder (<code>/RE Videos</code>, <code>/RE Markdown Export</code>, <code>/Master RE Sheet</code>, <code>/_fotoproduk</code>) akan dibuat otomatis oleh backend.
                    </div>
                  </div>
                </div>
              )}

              <button
                className="btn btn-primary"
                onClick={async () => {
                  setSavingStorageConfig(true);
                  try {
                    const body = {
                      storage_provider: storageProvider,
                      nextcloud_url: nextcloudUrl,
                      nextcloud_username: nextcloudUsername,
                      nextcloud_app_password: nextcloudAppPassword,
                      nextcloud_target_folder: nextcloudTargetFolder,
                      drive_target_folder: driveTargetFolder.trim()
                    };
                    const res = await fetch('/api/settings', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(body),
                    });
                    const data = await res.json();
                    showToast(data.success ? '🔗 Storage config saved!' : data.error, data.success ? 'success' : 'error');
                    fetchSettings();
                  } catch (e) { showToast(e.message, 'error'); }
                  setSavingStorageConfig(false);
                }}
                disabled={savingStorageConfig}
              >
                {savingStorageConfig ? '⏳' : '💾'} Save Storage Config
              </button>
            </div>
          ))}

          {/* 5. CARD: Google Workspace Integration (OAuth) */}
          {renderCollapsibleCard('google_workspace', 'storage', 'Google Workspace Integration', '🔗', (
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '16px', lineHeight: 1.6 }}>
                Hubungkan Google Account untuk ekspor otomatis ke Google Sheets dan Google Docs.
              </p>

              <div style={{
                padding: '14px 18px', marginBottom: '18px', borderRadius: 'var(--radius-sm)',
                background: googleStatus.connected ? 'var(--success-glow)' : 'var(--bg-glass)',
                border: `1px solid ${googleStatus.connected ? 'rgba(0,184,148,0.3)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.2rem' }}>{googleStatus.connected ? '✅' : '⚪'}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                      {googleStatus.connected ? 'Connected' : 'Not Connected'}
                    </div>
                    {googleStatus.email && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {googleStatus.email}
                      </div>
                    )}
                  </div>
                </div>
                {googleStatus.connected && (
                  <button className="btn btn-sm btn-danger" onClick={disconnectGoogle}>Disconnect</button>
                )}
              </div>

              {!googleStatus.connected && (
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.7, padding: '12px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <strong>Setup:</strong> Buka{' '}
                    <a href="https://console.cloud.google.com" target="_blank" rel="noopener" style={{ color: 'var(--accent-light)' }}>Google Cloud Console</a>
                    {' → '}Buat Project → Enable <strong>Google Sheets API</strong>, <strong>Google Docs API</strong>, <strong>Google Drive API</strong>
                    {' → '}Credentials → Create OAuth Client ID (Web Application)
                    {' → '}Authorized redirect URI: <code style={{ fontSize: '0.72rem', background: 'var(--bg-card)', padding: '2px 6px', borderRadius: '4px' }}>{appOrigin}/api/google/callback</code>
                  </div>

                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">OAuth Client ID</label>
                    <input
                      className="form-input"
                      placeholder="xxxx.apps.googleusercontent.com"
                      value={googleClientId}
                      onChange={e => setGoogleClientId(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">OAuth Client Secret</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="GOCSPX-xxxx..."
                      value={googleClientSecret}
                      onChange={e => setGoogleClientSecret(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      className="btn btn-primary"
                      onClick={saveGoogleCredentials}
                      disabled={savingGoogle || !googleClientId.trim() || !googleClientSecret.trim()}
                    >
                      {savingGoogle ? '⏳' : '💾'} Save Credentials
                    </button>
                    {googleStatus.credentialsSet && (
                      <a href="/api/google/auth" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
                        🔗 Connect Google Account
                      </a>
                    )}
                  </div>

                  {googleStatus.credentialsSet && !googleStatus.connected && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: '10px' }}>
                      ⚠ Credentials tersimpan. Klik "Connect Google Account" untuk menyelesaikan setup.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* 6. CARD: Knowledge Base Management */}
          {renderCollapsibleCard('kb', 'storage', 'Knowledge Base Management', '📚', (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <button className="btn btn-sm btn-primary" onClick={seedKBs} disabled={seeding}>
                  {seeding ? '⏳' : '📥'} Load dari kb/
                </button>
              </div>

              <div
                className="upload-area"
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('dragover'); }}
                onDragLeave={e => e.currentTarget.classList.remove('dragover')}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <div className="upload-icon">📄</div>
                <p>{uploading ? 'Uploading...' : 'Drop file di sini atau klik untuk upload'}</p>
                <p className="upload-hint">Format: .md, .txt, .json</p>
              </div>
              <input ref={fileRef} type="file" accept=".md,.txt,.json" multiple hidden
                onChange={e => Array.from(e.target.files).forEach(uploadFile)} />

              {kbs.length > 0 ? (
                <div className="kb-list" style={{ marginTop: '20px' }}>
                  {kbs.map(kb => (
                    <div key={kb.id} className="kb-item">
                      <div className="kb-item-info">
                        <span className="kb-item-icon">{kb.file_type === 'json' ? '📋' : '📝'}</span>
                        <div>
                          <div className="kb-item-name">{kb.name}</div>
                          <div className="kb-item-meta">{kb.file_type.toUpperCase()} • {formatSize(kb.file_size)} • {new Date(kb.created_at).toLocaleDateString('id-ID')}</div>
                        </div>
                      </div>
                      <div className="kb-item-actions">
                        <button className="btn btn-sm btn-danger" onClick={() => deleteKB(kb.id, kb.name)}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '30px' }}>
                  <p>Belum ada Knowledge Base. Upload file atau load dari kb/.</p>
                </div>
              )}
            </div>
          ))}

          {/* 7. CARD: G Labs Webhook */}
          {renderCollapsibleCard('glabs_webhook', 'automation', 'G Labs Webhook', '🎬', (
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '16px', lineHeight: 1.6 }}>
                Koneksi ke local webhook server G-Labs untuk generate visual animasi image & video.
              </p>

              <div style={{
                padding: '14px 18px', marginBottom: '18px', borderRadius: 'var(--radius-sm)',
                background: webhookStatus?.success ? 'var(--success-glow)' : 'var(--bg-glass)',
                border: `1px solid ${webhookStatus?.success ? 'rgba(0,184,148,0.3)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.2rem' }}>{webhookStatus?.success ? '🟢' : '⚪'}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                      {webhookStatus?.success ? 'Online' : webhookStatus ? 'Offline' : 'Belum ditest'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      http://{webhookHost}:{webhookPort}
                    </div>
                  </div>
                </div>
                <button className="btn btn-sm btn-secondary" onClick={async () => {
                  setTestingWebhook(true); setWebhookStatus(null);
                  try {
                    const res = await fetch(`/api/webhook/generate?host=${encodeURIComponent(webhookHost.trim())}&port=${encodeURIComponent(webhookPort.trim())}`);
                    const data = await res.json();
                    setWebhookStatus(data);
                    showToast(data.success ? '🟢 Webhook online!' : '🔴 Webhook offline', data.success ? 'success' : 'error');
                  } catch (e) { setWebhookStatus({ success: false, error: e.message }); showToast('🔴 Webhook offline', 'error'); }
                  setTestingWebhook(false);
                }} disabled={testingWebhook}>
                  {testingWebhook ? '⏳ Testing...' : '🔌 Test Connection'}
                </button>
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">🌐 Host / IP Address Webhook G Labs</label>
                <input
                  className="form-input"
                  placeholder="100.117.59.92 atau 127.0.0.1"
                  value={webhookHost}
                  onChange={e => setWebhookHost(e.target.value)}
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  IP server G-Labs Automation. Gunakan <code>100.117.59.92</code> (Node 2 Worker) atau IP LAN/Tailscale tempat G-Labs berjalan.
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Port</label>
                <input
                  className="form-input"
                  placeholder="8765"
                  value={webhookPort}
                  onChange={e => setWebhookPort(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">API Key Webhook G Labs</label>
                {hasWebhookKey && !editingWebhookKey ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div className="form-input" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', cursor: 'default', flex: 1 }}>
                      {maskedWebhookKey}
                    </div>
                    <button type="button" className="btn btn-secondary" onClick={() => { setEditingWebhookKey(true); setWebhookApiKey(''); }}>✏️ Ganti</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Masukkan API Key Webhook G-Labs..."
                      value={webhookApiKey}
                      onChange={e => setWebhookApiKey(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    {hasWebhookKey && (
                      <button type="button" className="btn btn-secondary" onClick={() => { setEditingWebhookKey(false); setWebhookApiKey(''); }}>Batal</button>
                    )}
                  </div>
                )}
              </div>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Image Model</label>
                <select className="form-input" value={webhookImageModel} onChange={e => setWebhookImageModel(e.target.value)}>
                  <option value="nano_banana_pro">Nano Banana Pro</option>
                  <option value="nano_banana_2">Nano Banana 2</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Video Model</label>
                <select className="form-input" value={webhookVideoModel} onChange={e => setWebhookVideoModel(e.target.value)}>
                  <option value="veo_31_lite">Veo 3.1 Lite (10 Credit)</option>
                  <option value="veo_31_fast">Veo 3.1 Fast (20 Credit)</option>
                  <option value="veo_31_quality">Veo 3.1 Quality (100 Credit)</option>
                  <option value="veo_31_lite_relaxed">Veo 3.1 Lite Relaxed (Ultra)</option>
                  <option value="veo_31_fast_relaxed">Veo 3.1 Fast Relaxed (Ultra)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={webhookDelayEnabled}
                    onChange={e => setWebhookDelayEnabled(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span>Aktifkan Safety Delay (Jeda Pengiriman Prompt)</span>
                </label>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Memberikan jeda waktu acak sebelum mengirim prompt ke G-Labs untuk mencegah rate limit Google Flow.
                </div>
              </div>

              {webhookDelayEnabled && (
                <div style={{ display: 'flex', gap: '15px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Jeda Minimum (Detik)</label>
                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      placeholder="10"
                      value={webhookDelayMin}
                      onChange={e => setWebhookDelayMin(Math.max(0, parseInt(e.target.value) || 0))}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Jeda Maksimum (Detik)</label>
                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      placeholder="20"
                      value={webhookDelayMax}
                      onChange={e => setWebhookDelayMax(Math.max(0, parseInt(e.target.value) || 0))}
                    />
                  </div>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Pola T2I (Start Frame)</label>
                <select 
                  className="form-input" 
                  value={webhookT2iPattern} 
                  onChange={e => setWebhookT2iPattern(e.target.value)}
                >
                  <option value="threading">Threading (Kirim berurutan dengan jeda 10-20s, pantau bersama - paralel)</option>
                  <option value="sequential">Sequential (Kirim, tunggu selesai, jeda 10-20s, ulangi - sekuensial)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    setSavingWebhook(true);
                    try {
                      const res = await fetch('/api/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                          webhook_api_key: webhookApiKey, 
                          webhook_host: webhookHost.trim(),
                          webhook_port: webhookPort, 
                          webhook_image_model: webhookImageModel, 
                          webhook_video_model: webhookVideoModel,
                          webhook_delay_enabled: webhookDelayEnabled ? 1 : 0,
                          webhook_delay_min: webhookDelayMin,
                          webhook_delay_max: webhookDelayMax,
                          webhook_t2i_pattern: webhookT2iPattern
                        }),
                      });
                      const data = await res.json();
                      showToast(data.success ? 'G Labs Webhook settings saved!' : data.error, data.success ? 'success' : 'error');
                    } catch (e) { showToast(e.message, 'error'); }
                    setSavingWebhook(false);
                  }}
                  disabled={savingWebhook}
                >
                  {savingWebhook ? '⏳' : '💾'} Save Webhook Settings
                </button>
              </div>
            </div>
          ))}

          {/* 8. CARD: Marketplace Scraper Settings */}
          {renderCollapsibleCard('marketplace_scraper', 'automation', 'Marketplace Scraper Settings', '🛍️', (
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '16px', lineHeight: 1.6 }}>
                Koneksi peramban Google Chrome asli Anda untuk mengambil detail produk secara otomatis dari Shopee skala besar tanpa hambatan Captcha.
              </p>

              <div style={{
                padding: '14px 18px', marginBottom: '18px', borderRadius: 'var(--radius-sm)',
                background: 'rgba(0, 184, 148, 0.08)', border: '1px solid rgba(0, 184, 148, 0.3)',
                display: 'flex', alignItems: 'center', gap: '12px'
              }}>
                <span style={{ fontSize: '1.5rem' }}>🔌</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>Koneksi CDP Google Chrome Asli</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Maknagen akan mengendalikan Google Chrome asli Anda secara langsung untuk melewati blokir bot dan sistem Captcha Shopee.
                  </div>
                </div>
              </div>

              <div style={{
                padding: '14px', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-glass)', border: '1px dashed rgba(255,255,255,0.15)',
                marginBottom: '16px'
              }}>
                <div style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--text-primary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  💡 Langkah-langkah Menghubungkan Google Chrome:
                </div>
                
                <div style={{ marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '500' }}>
                    Nama Folder Profil Chrome (Profile Folder Name):
                  </label>
                  <input
                    type="text"
                    value={scraperChromeProfile}
                    onChange={e => setScraperChromeProfile(e.target.value)}
                    placeholder="misal: Default, Profile 1, Profile 22"
                    style={{
                      padding: '6px 10px', fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)',
                      border: '1px solid var(--border)', borderRadius: 'var(--radius-xs)',
                      color: 'var(--text-primary)', width: '100%', maxWidth: '240px'
                    }}
                  />
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Masukkan nama folder profil fisik Chrome Anda di Macbook/Server.
                  </div>
                </div>

                <ol style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', paddingLeft: '16px', margin: '0 0 10px 0', lineHeight: '1.5' }}>
                  <li>Tutup Google Chrome secara keseluruhan terlebih dahulu (<kbd>Command + Q</kbd> / <kbd>Alt + F4</kbd>).</li>
                  <li>Jalankan Chrome dalam mode debugging di terminal/command prompt sesuai OS Anda:</li>
                </ol>
                
                <div style={{ fontSize: '0.74rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '4px' }}>💻 macOS:</div>
                <pre style={{
                  padding: '8px 12px', background: 'rgba(0,0,0,0.4)', color: '#00FFCC',
                  borderRadius: '4px', fontSize: '0.72rem', overflowX: 'auto', border: '1px solid var(--border)',
                  margin: '4px 0 8px 0', fontFamily: 'monospace'
                }}>
                  {`/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222 --profile-directory="${scraperChromeProfile}"`}
                </pre>

                <div style={{ fontSize: '0.74rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '4px', marginTop: '6px' }}>🪟 Windows:</div>
                <pre style={{
                  padding: '8px 12px', background: 'rgba(0,0,0,0.4)', color: '#00FFCC',
                  borderRadius: '4px', fontSize: '0.72rem', overflowX: 'auto', border: '1px solid var(--border)',
                  margin: '4px 0 8px 0', fontFamily: 'monospace'
                }}>
                  {`"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --profile-directory="${scraperChromeProfile}"`}
                </pre>

                <button
                  className="btn btn-sm btn-secondary"
                  onClick={testCdpConnection}
                  disabled={testingCdp}
                  style={{ fontSize: '0.72rem', padding: '5px 10px' }}
                >
                  {testingCdp ? '⏳ Menghubungkan...' : '🔌 Test Chrome Connection'}
                </button>
              </div>

              <div style={{ marginTop: '16px', marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  🍪 yt-dlp Cookie Source Browser (Untuk Autopilot FB/YT Reels)
                </label>
                <select
                  value={ytdlpCookiesFromBrowser}
                  onChange={e => setYtdlpCookiesFromBrowser(e.target.value)}
                  style={{
                    padding: '8px 12px', fontSize: '0.82rem', background: 'rgba(0,0,0,0.2)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-xs)',
                    color: 'var(--text-primary)', width: '100%', maxWidth: '240px'
                  }}
                >
                  <option value="none">None / Static File Only</option>
                  <option value="chrome">Google Chrome</option>
                  <option value="safari">Safari (Memerlukan Full Disk Access)</option>
                  <option value="firefox">Mozilla Firefox</option>
                  <option value="edge">Microsoft Edge</option>
                  <option value="opera">Opera</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="btn btn-primary"
                  onClick={saveScraperSettings}
                  disabled={savingScraperConfig}
                >
                  {savingScraperConfig ? '⏳ Saving...' : '💾 Save Scraper Settings'}
                </button>
              </div>
            </div>
          ))}

          {/* 9. CARD: Meta Publishing Accounts Integration */}
          {renderCollapsibleCard('facebook_page', 'automation', 'Meta Publishing Accounts Integration (Facebook & Instagram)', '📘', (
            <div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Konfigurasi Access Token Meta Graph API untuk menjadwalkan dan mempublikasikan konten ke Facebook Page dan Instagram Professional melalui Publishing Scheduler.
              </p>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Global Server URL (Public Domain)</label>
                <input
                  className="form-input"
                  placeholder="Misal: https://domain-publik-anda.com"
                  value={fbServerUrl}
                  onChange={e => setFbServerUrl(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Page Access Token (Facebook & Instagram Connected)</label>
                {hasFbToken && !editingFb ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input className="form-input" value={maskedFbToken} disabled style={{ background: 'var(--bg-glass)', opacity: 0.8 }} />
                    <button className="btn btn-sm btn-secondary" onClick={() => setEditingFb(true)}>Ubah Token</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Masukkan Page Access Token Facebook..."
                      value={fbPageToken}
                      onChange={e => setFbPageToken(e.target.value)}
                    />
                    {hasFbToken && (
                      <button className="btn btn-sm btn-secondary" onClick={() => { setEditingFb(false); setFbPageToken(''); }}>Batal</button>
                    )}
                  </div>
                )}
              </div>

              {/* Auto-Discovery Section & Daftar Halaman Interaktif dengan Toggle Slide */}
              <div style={{
                marginTop: '16px', marginBottom: '16px', padding: '14px',
                background: 'rgba(0,0,0,0.25)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      📑 Daftar Halaman Terhubung (Auto-Discovery)
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Pindai otomatis semua Facebook Page dan akun Instagram Bisnis yang dikelola oleh token Anda.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => discoverFacebookPages()}
                    disabled={discoveringPages || (!hasFbToken && !fbPageToken)}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {discoveringPages ? '⏳ Memindai...' : '🔍 Pindai & Muat Halaman'}
                  </button>
                </div>

                {discoveredPages.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {discoveredPages.map(page => {
                      const isSelected = selectedPageIds.includes(page.id);
                      return (
                        <div
                          key={page.id}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 14px',
                            background: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-glass)',
                            borderRadius: 'var(--radius-xs)',
                            border: `1px solid ${isSelected ? 'var(--accent, #3b82f6)' : 'var(--border)'}`,
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '1.3rem' }}>📘</span>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.84rem', color: '#fff' }}>
                                {page.name}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                ID: <code style={{ color: '#93c5fd' }}>{page.id}</code> · {page.category || 'Facebook Page'}
                                {page.instagram && (
                                  <span style={{ marginLeft: 8, color: '#f472b6', fontWeight: 600 }}>
                                    📸 @{page.instagram.username || page.instagram.id}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Toggle Slide ON/OFF Switch */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: isSelected ? '#34d399' : '#64748b' }}>
                              {isSelected ? 'ON' : 'OFF'}
                            </span>
                            <div
                              onClick={() => {
                                if (isSelected) setSelectedPageIds(selectedPageIds.filter(id => id !== page.id));
                                else setSelectedPageIds([...selectedPageIds, page.id]);
                              }}
                              style={{
                                position: 'relative', width: '46px', height: '24px', borderRadius: '12px',
                                backgroundColor: isSelected ? 'var(--accent, #3b82f6)' : '#334155',
                                cursor: 'pointer', transition: 'background-color 0.25s ease'
                              }}
                            >
                              <div style={{
                                position: 'absolute', top: '2px',
                                left: isSelected ? '24px' : '2px',
                                width: '20px', height: '20px', borderRadius: '50%',
                                backgroundColor: '#ffffff', transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                              }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>
                    {hasFbToken ? (
                      <span>Halaman belum dimuat. Klik tombol <strong>"🔍 Pindai & Muat Halaman"</strong> di atas atau masukkan Page ID di bawah.</span>
                    ) : (
                      <span>Masukkan Access Token di atas lalu klik tombol <strong>"🔍 Pindai & Muat Halaman"</strong>.</span>
                    )}
                  </div>
                )}

                {/* Form Quick Add Manual Page ID */}
                <div style={{
                  marginTop: '14px', paddingTop: '14px', borderTop: '1px dashed rgba(255,255,255,0.12)',
                  display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap'
                }}>
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Masukkan Page ID tambahan (misal: 1030799026791337)..."
                      value={manualInputPageId}
                      onChange={e => setManualInputPageId(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddManualPage(); } }}
                      style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={handleAddManualPage}
                    disabled={addingManualPage || !manualInputPageId.trim() || (!hasFbToken && !fbPageToken)}
                    style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}
                  >
                    {addingManualPage ? '⏳ Memverifikasi...' : '➕ Tambah & Verifikasi Page ID'}
                  </button>
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  💡 Gunakan ini jika halaman Anda dikelola di Meta Business Suite atau Meta App masih dalam Development Mode.
                </div>
              </div>

              {fbTestResult && (
                <div style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '16px',
                  fontSize: '0.8rem',
                  background: fbTestResult.type === 'success' ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)',
                  border: `1px solid ${fbTestResult.type === 'success' ? 'rgba(46, 204, 113, 0.4)' : 'rgba(231, 76, 60, 0.4)'}`,
                  color: fbTestResult.type === 'success' ? '#2ecc71' : '#e74c3c'
                }}>
                  {fbTestResult.message}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button className="btn btn-secondary" onClick={testFbSettings} disabled={testingFb || (!hasFbToken && !fbPageToken)}>
                  {testingFb ? '⏳ Testing...' : '🟢 Test Koneksi Meta Graph API'}
                </button>
                <button className="btn btn-primary" onClick={saveFbSettings} disabled={savingFb}>
                  {savingFb ? '⏳ Menyimpan...' : '💾 Simpan Konfigurasi Meta'}
                </button>
              </div>
            </div>
          ))}

        </div>
      </main>
    </div>
  );
}
