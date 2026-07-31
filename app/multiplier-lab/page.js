'use client';

import Sidebar from '../components/Sidebar';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function MultiplierLabPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preSelectedAssetId = searchParams.get('asset_id');

  // Asset list and selection
  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');

  // Queue tasks and monitoring
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [expandedTaskId, setExpandedTaskId] = useState(null);

  // Forms configuration states
  const [productionMode, setProductionMode] = useState('single'); // 'single' or 'mass'
  const [activeAccordion, setActiveAccordion] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const pollingRef = useRef(null);
  const terminalRef = useRef(null);

  // Forms and Scheduler States
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [isSchedulerActive, setIsSchedulerActive] = useState(true);
  const [terminalLogs, setTerminalLogs] = useState('');
  const [activeTabs, setActiveTabs] = useState({}); // { [taskId]: 'concept' | 'storyboard' | 'prompts' | 'social' | 'logs' }

  // Single mode product states
  const [productUrl, setProductUrl] = useState('');
  const [affiliateUrl, setAffiliateUrl] = useState('');

  // Mass mode product states
  const [massUrlsText, setMassUrlsText] = useState('');

  // Brand and products from library
  const [accountName, setAccountName] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [brandProfiles, setBrandProfiles] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [products, setProducts] = useState([]);
  const [targetProductId, setTargetProductId] = useState('');

  // 1. Aesthetics & Visual Settings + VSO
  const [narrativeMode, setNarrativeMode] = useState('Storytelling');
  const [visualStyle, setVisualStyle] = useState('Cinematic');
  const [targetAi, setTargetAi] = useState('Google Veo (8s)');
  const [videoModel, setVideoModel] = useState('veo_31_lite');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [faceVisibility, setFaceVisibility] = useState('Faceless');
  const [wordsPerClip, setWordsPerClip] = useState('17-19 kata');

  // Visual Swap Overrides (VSO)
  const [isVsoActive, setIsVsoActive] = useState(false);
  const [characterConcept, setCharacterConcept] = useState('faceless');
  const [subjectDemographic, setSubjectDemographic] = useState('syari_classic');
  const [wardrobeStyle, setWardrobeStyle] = useState('random');
  const [wardrobeStyleCustom, setWardrobeStyleCustom] = useState('');
  const [lightingStyle, setLightingStyle] = useState('random');
  const [lightingStyleCustom, setLightingStyleCustom] = useState('');

  // 2. Product Bridging Settings
  const [isBridgingActive, setIsBridgingActive] = useState(true);
  const [targetClipsCount, setTargetClipsCount] = useState(4);
  const [bridgeAtClip, setBridgeAtClip] = useState(2);
  const [bridgeDurationClips, setBridgeDurationClips] = useState(1);
  const [promotionStyle, setPromotionStyle] = useState('Softselling');
  const [bridgingMode, setBridgingMode] = useState('url_extract'); // default to URL extract for easiest onboarding
  const [manualProductName, setManualProductName] = useState('');
  const [manualProductDesc, setManualProductDesc] = useState('');
  const [manualProductUsp, setManualProductUsp] = useState('');
  const [productRefImage, setProductRefImage] = useState(null);
  const [productFilenameDeclare, setProductFilenameDeclare] = useState('');
  const [visualMode, setVisualMode] = useState('hybrid_lock');

  // 3. Workflow & Audio Settings
  const [enableTts, setEnableTts] = useState(false);
  const [voiceProvider, setVoiceProvider] = useState('minimax');
  const [voicePersona, setVoicePersona] = useState('Indonesian_SweetGirl');
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [voiceVolume, setVoiceVolume] = useState(1.0);
  const [ttsModelQuality, setTtsModelQuality] = useState('speech-2.8-turbo');
  const [enableGlabs, setEnableGlabs] = useState(false);
  const [enableFfmpeg, setEnableFfmpeg] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('id-ID');
  const [ffmpegSyncOption, setFfmpegSyncOption] = useState('smart_sync');
  const [ffmpegVideoScale, setFfmpegVideoScale] = useState(1.0);
  const [ffmpegSfxVolume, setFfmpegSfxVolume] = useState(0.0);
  const [ffmpegBgmVolume, setFfmpegBgmVolume] = useState(0.15);
  const [enableVoAudit, setEnableVoAudit] = useState(1); // Default 1 (Yes)

  const MINIMAX_VOICES = [
    { id: 'Indonesian_casual_reporter_vv2', name: 'Anchor Casual (Male)', desc: 'Natural & energetic' },
    { id: 'Indonesian_SweetGirl', name: 'Sweet Girl (Female)', desc: 'Friendly & conversational' },
    { id: 'Indonesian_Bilingual_Girl_v2', name: 'Bilingual Girl (Female)', desc: 'Clear narration' }
  ];

  const GEMINI_VOICES = [
    { id: 'Kore', name: 'Kore (Male)', desc: 'Formal presenter tone' },
    { id: 'Puck', name: 'Puck (Female)', desc: 'Crisp and professional' }
  ];

  // Fetch initial library data and active tasks
  useEffect(() => {
    fetchAssets();
    fetchTasks();
    pollLogs();
    fetch('/api/v2/brand-profiles').then(r => r.json()).then(d => { if (d.success) setBrandProfiles(d.data || []); }).catch(() => {});
    fetch('/api/product-agent').then(r => r.json()).then(d => { if (d.success) setProducts(d.data || []); }).catch(() => {});

    pollingRef.current = setInterval(() => {
      fetchTasks(true);
    }, 5000);

    const logInterval = setInterval(pollLogs, 3000);

    return () => {
      clearInterval(pollingRef.current);
      clearInterval(logInterval);
    };
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  // Pre-select deconstruction asset from search params
  useEffect(() => {
    if (assets.length > 0 && preSelectedAssetId) {
      setSelectedAssetId(preSelectedAssetId);
    }
  }, [assets, preSelectedAssetId]);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function fetchAssets() {
    setLoadingAssets(true);
    try {
      const res = await fetch('/api/v2/deconstruct?assets=true');
      const data = await res.json();
      if (data.success) {
        setAssets(data.assets || []);
      }
    } catch {
      showToast('Gagal memuat pustaka aset dekonstruksi', 'error');
    } finally {
      setLoadingAssets(false);
    }
  }

  async function fetchTasks(silent = false) {
    if (!silent) setLoadingTasks(true);
    try {
      const res = await fetch('/api/v2/multiplier');
      const data = await res.json();
      if (data.success) {
        setTasks(data.tasks || []);
        if (data.isSchedulerActive !== undefined) {
          setIsSchedulerActive(data.isSchedulerActive);
        }
      }
    } catch {
      if (!silent) showToast('Gagal memuat antrean multiplier', 'error');
    } finally {
      if (!silent) setLoadingTasks(false);
    }
  }

  async function pollLogs() {
    try {
      const res = await fetch(`/api/system-logs?type=multiplier&t=${Date.now()}`);
      if (res.ok) {
        const text = await res.text();
        const lines = text.split('\n');
        const last500 = lines.slice(-500).join('\n');
        setTerminalLogs(last500 || 'Belum ada log aktivitas multiplier.');
      }
    } catch (e) {
      // Ignore network errors on initial log checks
    }
  }

  async function toggleGlobalScheduler() {
    try {
      const res = await fetch('/api/v2/multiplier', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedulerActive: !isSchedulerActive })
      });
      const json = await res.json();
      if (json.success) {
        setIsSchedulerActive(!isSchedulerActive);
        showToast(`Skeduler berhasil ${!isSchedulerActive ? 'diaktifkan' : 'dimatikan'}`);
        pollLogs();
      } else {
        showToast('Gagal mengubah status skeduler: ' + json.error, 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  }

  async function handleToggleTaskStatus(id, currentStatus) {
    const isPaused = currentStatus === 'paused';
    const isFailed = currentStatus === 'failed';
    const newStatus = (isPaused || isFailed) ? 'pending_resolution' : 'paused';
    
    try {
      const res = await fetch(`/api/v2/multiplier/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Status tugas berhasil diubah menjadi ${newStatus}`);
        fetchTasks(true);
        pollLogs();
      } else {
        showToast('Gagal mengubah status tugas: ' + json.error, 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  }

  function handleCopyTaskSettings(task) {
    try {
      if (task.deconstruct_asset_id) setSelectedAssetId(task.deconstruct_asset_id);
      if (task.target_product_url) setProductUrl(task.target_product_url);
      if (task.affiliate_url) setAffiliateUrl(task.affiliate_url);

      const vso = JSON.parse(task.vso_config_json || '{}');
      if (vso.characterConcept) setCharacterConcept(vso.characterConcept);
      if (vso.subjectDemographic) setSubjectDemographic(vso.subjectDemographic);
      if (vso.wardrobeStyle) setWardrobeStyle(vso.wardrobeStyle);
      if (vso.wardrobeStyleCustom) setWardrobeStyleCustom(vso.wardrobeStyleCustom);
      if (vso.lightingStyle) setLightingStyle(vso.lightingStyle);
      if (vso.lightingStyleCustom) setLightingStyleCustom(vso.lightingStyleCustom);
      setIsVsoActive(Object.keys(vso).length > 0);

      const bridging = JSON.parse(task.bridging_config_json || '{}');
      if (bridging.isBridgingActive !== undefined) setIsBridgingActive(bridging.isBridgingActive);
      if (bridging.targetClipsCount) setTargetClipsCount(bridging.targetClipsCount);
      if (bridging.bridgeAtClip) setBridgeAtClip(bridging.bridgeAtClip);
      if (bridging.bridgeDurationClips) setBridgeDurationClips(bridging.bridgeDurationClips);
      if (bridging.promotionStyle) setPromotionStyle(bridging.promotionStyle);
      if (bridging.bridgingMode) setBridgingMode(bridging.bridgingMode);
      if (bridging.manualProductName) setManualProductName(bridging.manualProductName);
      if (bridging.manualProductDesc) setManualProductDesc(bridging.manualProductDesc);
      if (bridging.manualProductUsp) setManualProductUsp(bridging.manualProductUsp);
      if (bridging.productFilenameDeclare) setProductFilenameDeclare(bridging.productFilenameDeclare);
      if (bridging.visualMode) setVisualMode(bridging.visualMode);
      if (bridging.targetProductId) setTargetProductId(bridging.targetProductId);

      const audio = JSON.parse(task.audio_config_json || '{}');
      if (audio.enableTts !== undefined) setEnableTts(audio.enableTts);
      if (audio.voiceProvider) setVoiceProvider(audio.voiceProvider);
      if (audio.voicePersona) setVoicePersona(audio.voicePersona);
      if (audio.voiceSpeed) setVoiceSpeed(audio.voiceSpeed);
      if (audio.voiceVolume) setVoiceVolume(audio.voiceVolume);
      if (audio.enableFfmpeg !== undefined) setEnableFfmpeg(audio.enableFfmpeg);
      if (audio.ffmpegBgmVolume !== undefined) setFfmpegBgmVolume(audio.ffmpegBgmVolume);
      if (audio.ffmpegBgmPath) setFfmpegBgmPath(audio.ffmpegBgmPath);

      // Open the config form automatically
      setShowConfigForm(true);
      showToast('Konfigurasi tugas berhasil disalin ke form!');
    } catch (e) {
      showToast('Gagal menyalin konfigurasi: ' + e.message, 'error');
    }
  }

  // Handle Form Submission
  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedAssetId) { showToast('Silakan pilih salah satu video blueprint', 'error'); return; }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('deconstruct_asset_id', selectedAssetId);
      formData.append('production_mode', productionMode);

      // Setup VSO/Aesthetic configuration JSON
      const vsoData = {
        narrativeMode,
        visualStyle,
        targetAi,
        videoModel,
        aspectRatio,
        faceVisibility,
        wordsPerClip,
        isVsoActive,
        characterConcept,
        subjectDemographic,
        wardrobeStyle: wardrobeStyle,
        lightingStyle: lightingStyle
      };
      formData.append('vso_config_json', JSON.stringify(vsoData));

      // Setup Bridging config JSON
      const bridgingData = {
        isBridgingActive,
        targetClipsCount,
        bridgeAtClip,
        bridgeDurationClips,
        promotionStyle,
        bridgingMode,
        targetProductId,
        manualProductName,
        manualProductDesc,
        manualProductUsp,
        productUrl,
        visualMode,
        productFilenameDeclare
      };
      formData.append('bridging_config_json', JSON.stringify(bridgingData));

      // Setup Audio/Workflow config JSON
      const audioData = {
        enableTts,
        voiceProvider,
        voicePersona,
        voiceSpeed,
        voiceVolume,
        ttsModelQuality,
        enableGlabs,
        enableFfmpeg,
        targetLanguage,
        ffmpegSyncOption,
        ffmpegVideoScale,
        ffmpegSfxVolume,
        ffmpegBgmVolume
      };
      formData.append('audio_config_json', JSON.stringify(audioData));
      formData.append('enable_vo_audit', enableVoAudit ? '1' : '0');

      // Single Mode vs Multi Mode specifics
      if (productionMode === 'single') {
        formData.append('target_product_url', productUrl);
        formData.append('affiliate_url', affiliateUrl);
        if (productRefImage) {
          formData.append('product_media', productRefImage);
        }
      } else {
        // Parse textarea newline separated product URLs
        const rows = massUrlsText
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .map(url => ({ url, affiliate_url: '' }));

        if (rows.length === 0) {
          showToast('Masukkan setidaknya satu URL produk untuk diproses', 'error');
          setSubmitting(false);
          return;
        }
        formData.append('csv_data_json', JSON.stringify(rows));
      }

      const res = await fetch('/api/v2/multiplier', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Task Multiplier Lab berhasil didaftarkan.');
        setProductUrl('');
        setAffiliateUrl('');
        setMassUrlsText('');
        setProductRefImage(null);
        setShowConfigForm(false);
        fetchTasks();
        pollLogs();
      } else {
        showToast(data.error || 'Gagal mendaftarkan task', 'error');
      }
    } catch (err) {
      showToast('Error mengirim data: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // Handle deletion of task
  async function handleDelete(taskId) {
    if (!confirm('Hapus task multiplier ini?')) return;
    try {
      const res = await fetch(`/api/v2/multiplier/${taskId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Task berhasil dihapus');
        if (expandedTaskId === taskId) setExpandedTaskId(null);
        fetchTasks();
        pollLogs();
      }
    } catch {
      showToast('Gagal menghapus task', 'error');
    }
  }

  function getStatusStyle(status) {
    const map = {
      pending_resolution: { color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.06)' },
      resolving_product: { color: 'var(--info)', bg: 'rgba(116,185,255,0.15)' },
      remaking: { color: 'var(--info)', bg: 'rgba(116,185,255,0.15)' },
      generating_audio: { color: 'var(--info)', bg: 'rgba(116,185,255,0.15)' },
      generating_visuals: { color: 'var(--info)', bg: 'rgba(116,185,255,0.15)' },
      ffmpeg_muxing: { color: 'var(--info)', bg: 'rgba(116,185,255,0.15)' },
      completed: { color: 'var(--success)', bg: 'var(--success-glow)' },
      failed: { color: 'var(--danger)', bg: 'var(--danger-glow)' },
      paused: { color: '#fdcb6e', bg: 'rgba(253, 203, 110, 0.15)' }
    };
    return map[status] || { color: 'var(--text-primary)', bg: 'rgba(255,255,255,0.1)' };
  }

  return (
    <div className="app-container">
      <Sidebar />
      
      <main className="main-content">
        <div style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto' }}>
          
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <h1 className="page-title" style={{ margin: 0, fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                🎛️ Multiplier Lab (Remake Engine)
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 4 }}>
                Suntikkan produk jualan Anda ke dalam blueprint video kompetitor yang sukses secara dinamis.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button 
                type="button" 
                onClick={() => fetchTasks()} 
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '8px 14px' }}
              >
                🔄 Refresh Antrean
              </button>
            </div>
          </div>

          {/* Global Scheduler Control Card */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: 16,
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                ⚙️ Status Skeduler Multiplier Lab
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                Mengontrol jalannya antrean pembuatan video hasil perkalian (multiplier) secara otomatis.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '4px 10px',
                borderRadius: 12,
                background: isSchedulerActive ? 'rgba(46, 204, 113, 0.15)' : 'rgba(235, 77, 75, 0.15)',
                color: isSchedulerActive ? 'var(--success)' : 'var(--danger)',
                border: `1px solid ${isSchedulerActive ? 'rgba(46, 204, 113, 0.3)' : 'rgba(235, 77, 75, 0.3)'}`
              }}>
                {isSchedulerActive ? '🟢 SKEDULER AKTIF' : '🔴 SKEDULER MATI'}
              </span>
              <button
                type="button"
                onClick={toggleGlobalScheduler}
                className={`btn ${isSchedulerActive ? 'btn-danger' : 'btn-success'}`}
                style={{
                  fontSize: '0.8rem',
                  padding: '6px 16px',
                  fontWeight: 600,
                  boxShadow: isSchedulerActive ? '0 0 15px rgba(235, 77, 75, 0.4)' : '0 0 15px rgba(46, 204, 113, 0.4)',
                  border: isSchedulerActive ? '1px solid rgba(235, 77, 75, 0.6)' : '1px solid rgba(46, 204, 113, 0.6)'
                }}
              >
                {isSchedulerActive ? '🛑 STOP SKEDULER' : '▶️ START SKEDULER'}
              </button>
            </div>
          </div>

          {/* Activity Terminal */}
          <div className="card" style={{ padding: '0', background: '#07070a', border: '1px solid var(--border)', marginBottom: '24px' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0b0b12' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#00b894', display: 'inline-block', boxShadow: '0 0 8px #00b894' }}></span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>SYSTEM POLLER LOGGER</span>
              </div>
              <button 
                onClick={pollLogs} 
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
              >
                [Refresh Log]
              </button>
            </div>
            <pre 
              ref={terminalRef}
              style={{ 
                margin: 0, 
                padding: '20px', 
                background: '#07070a', 
                color: '#20c20e', 
                fontFamily: 'var(--font-mono)', 
                fontSize: '0.82rem', 
                maxHeight: '220px', 
                overflowY: 'auto', 
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap'
              }}
            >
              {terminalLogs}
            </pre>
          </div>

          {/* Stacked Layout: Config Form & Antrean */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Config Form Settings */}
            {!showConfigForm ? (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 0 }}>
                <button
                  type="button"
                  onClick={() => setShowConfigForm(true)}
                  className="btn btn-primary"
                  style={{
                    fontSize: '0.85rem',
                    padding: '10px 20px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 0 15px var(--accent-glow)'
                  }}
                >
                  ➕ New Multiplier Campaign / Buat Remake Baru
                </button>
              </div>
            ) : (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 0 }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.95rem', color: '#fff' }}>⚙️ Konfigurasi Remake Video</strong>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 6, background: 'rgba(0,0,0,0.2)', padding: 3, borderRadius: 6 }}>
                      <button
                        type="button"
                        onClick={() => setProductionMode('single')}
                        style={{
                          border: 'none', background: productionMode === 'single' ? 'var(--accent)' : 'transparent',
                          color: '#fff', fontSize: '0.72rem', fontWeight: 600, padding: '5px 10px', borderRadius: 4, cursor: 'pointer'
                        }}
                      >
                        Single Product
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductionMode('mass')}
                        style={{
                          border: 'none', background: productionMode === 'mass' ? 'var(--accent)' : 'transparent',
                          color: '#fff', fontSize: '0.72rem', fontWeight: 600, padding: '5px 10px', borderRadius: 4, cursor: 'pointer'
                        }}
                      >
                        Mass Remake
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowConfigForm(false)}
                      style={{
                        border: 'none',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-muted)',
                        fontSize: '0.75rem',
                        padding: '5px 10px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        border: '1px solid var(--border)'
                      }}
                    >
                      ❌ Tutup Form
                    </button>
                  </div>
                </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
                
                {/* 0. Brand Account & Campaign Identity */}
                <div style={{ padding: 24, borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">🏷️ Nama Akun (Brand Account)</label>
                    <select
                      className="form-input"
                      value={accountName}
                      onChange={e => {
                        const newAcc = e.target.value;
                        setAccountName(newAcc);
                        const now = new Date();
                        const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
                        setCampaignName(`[ MULTIPLIER ${dateStr} ] - ${newAcc ? newAcc + ' - ' : ''}`);
                      }}
                    >
                      <option value="">-- Pilih Nama Akun Brand --</option>
                      {brandProfiles.map(bp => (
                        <option key={bp.id} value={bp.account_name || bp.brand_name}>
                          {bp.brand_name} ({bp.account_name || bp.brand_name})
                        </option>
                      ))}
                      <option value="nutribake">nutribake</option>
                      <option value="siasatsehat">siasatsehat</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Nama Kampanye Multiplier</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Contoh: Multiplier Remake v1"
                      value={campaignName}
                      onChange={e => setCampaignName(e.target.value)}
                    />
                  </div>
                </div>

                {/* 1. Asset Picker */}
                <div style={{ padding: 24, borderBottom: '1px solid var(--border)' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>📹 Pilih Blueprint Video Target</label>
                           {/* Search Input for Video Blueprint */}
                    <input
                      type="text"
                      className="form-input"
                      style={{ marginBottom: 10, fontSize: '0.8rem' }}
                      placeholder="🔍 Cari blueprint video berdasarkan URL atau tag..."
                      value={assetSearchQuery}
                      onChange={e => setAssetSearchQuery(e.target.value)}
                    />

                    {loadingAssets ? (
                      <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: '0.8rem' }}>Loading blueprint video...</div>
                    ) : (
                      <select 
                        className="form-input" 
                        value={selectedAssetId} 
                        onChange={e => setSelectedAssetId(e.target.value)}
                        required
                      >
                        <option value="">-- Pilih Blueprint Video (Deconstructed) --</option>
                        {assets
                          .filter(a => {
                            const query = assetSearchQuery.toLowerCase();
                            return (a.source_url || '').toLowerCase().includes(query) ||
                                   (a.tags || '').toLowerCase().includes(query);
                          })
                          .map(a => {
                            const shortUrl = a.source_url.length > 50 ? a.source_url.substring(0, 50) + '...' : a.source_url;
                            const tagLabel = a.tags ? ` [#${a.tags.split(',').map(t => t.trim()).join(' #')}]` : '';
                            return (
                              <option key={a.id} value={a.id}>
                                {shortUrl}{tagLabel}
                              </option>
                            );
                          })
                        }
                      </select>
                    )}
                  </div>

                  {productionMode === 'mass' && (
                    <div className="form-group" style={{ marginTop: 14, marginBottom: 0 }}>
                      <label className="form-label">Daftar URL Produk (1 Baris per URL)</label>
                      <textarea
                        rows="4"
                        className="form-textarea"
                        placeholder="https://shopee.co.id/product-1&#10;https://shopee.co.id/product-2"
                        value={massUrlsText}
                        onChange={e => setMassUrlsText(e.target.value)}
                        required
                      />
                    </div>
                  )}
                </div>

                {/* ACCORDION SECTIONS */}
                
                {/* Section 1: Aesthetics & Visual Settings */}
                <div style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <div 
                    onClick={() => setActiveAccordion(0)} 
                    style={{ padding: '16px 24px', background: activeAccordion === 0 ? 'rgba(59, 130, 246, 0.05)' : 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>1. Aesthetics & Visual Settings</span>
                    <span>{activeAccordion === 0 ? '▲' : '▼'}</span>
                  </div>
                  {activeAccordion === 0 && (
                    <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, background: 'rgba(0,0,0,0.1)' }}>
                      <div className="form-group">
                        <label className="form-label">Narrative Mode</label>
                        <select className="form-input" value={narrativeMode} onChange={e => setNarrativeMode(e.target.value)}>
                          <option value="Storytelling">Storytelling (Daily-life)</option>
                          <option value="Problem-Solution">Problem-Solution</option>
                          <option value="Educational">Educational (Tutorial)</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Visual Style</label>
                        <select className="form-input" value={visualStyle} onChange={e => setVisualStyle(e.target.value)}>
                          <option value="Cinematic">Cinematic (Estetik / Filmis)</option>
                          <option value="Minimalist">Minimalist</option>
                          <option value="UGC Vlog">UGC Vlog (Kasual)</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">AI Engine & Model</label>
                        <select className="form-input" value={targetAi} onChange={e => setTargetAi(e.target.value)}>
                          <option value="Google Veo (8s)">Google Veo (8s)</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Video Model</label>
                        <select className="form-input" value={videoModel} onChange={e => setVideoModel(e.target.value)}>
                          <option value="veo_31_lite">Veo 3.1 Lite</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Aspect Ratio</label>
                        <select className="form-input" value={aspectRatio} onChange={e => setAspectRatio(e.target.value)}>
                          <option value="9:16">9:16 (Vertical TikTok)</option>
                          <option value="16:9">16:9 (Horizontal YouTube)</option>
                          <option value="1:1">1:1 (Square)</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Face Visibility</label>
                        <select className="form-input" value={faceVisibility} onChange={e => setFaceVisibility(e.target.value)}>
                          <option value="Faceless">Faceless (Fokus Aksi Tangan)</option>
                          <option value="POV">POV (Sudut Pandang Kamera Utama)</option>
                          <option value="Silhouette">Silhouette (Estetik Siluet)</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">Kepadatan Kata per Klip (Words per Clip)</label>
                        <select className="form-input" value={wordsPerClip} onChange={e => setWordsPerClip(e.target.value)}>
                          <option value="15-16 kata">15-16 kata (Cepat, Dinamis)</option>
                          <option value="17-19 kata">17-19 kata (Standar, Berirama)</option>
                          <option value="20-24 kata">20-24 kata (Padat, Edukatif)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 2: Product Bridging Settings */}
                <div style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <div 
                    onClick={() => setActiveAccordion(1)} 
                    style={{ padding: '16px 24px', background: activeAccordion === 1 ? 'rgba(59, 130, 246, 0.05)' : 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>2. Product Bridging Settings</span>
                    <span>{activeAccordion === 1 ? '▲' : '▼'}</span>
                  </div>
                  {activeAccordion === 1 && (
                    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, background: 'rgba(0,0,0,0.1)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={isBridgingActive}
                            onChange={e => setIsBridgingActive(e.target.checked)}
                          />
                          <span className="slider"></span>
                        </label>
                        <strong>🔌 Aktifkan Bridging Promosi Produk (Sandwich Protocol)</strong>
                      </div>

                      {isBridgingActive && (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                            <div className="form-group">
                              <label className="form-label">Jumlah Klip Video (N)</label>
                              <input
                                type="number"
                                className="form-input"
                                min="3"
                                max="10"
                                value={targetClipsCount}
                                onChange={e => setTargetClipsCount(Number(e.target.value))}
                                required
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Mulai Promosi pada Klip Ke- (X)</label>
                              <input
                                type="number"
                                className="form-input"
                                min="1"
                                max={targetClipsCount}
                                value={bridgeAtClip}
                                onChange={e => setBridgeAtClip(Number(e.target.value))}
                                required
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Durasi Promosi (Jumlah Klip)</label>
                              <input
                                type="number"
                                className="form-input"
                                min="1"
                                max={targetClipsCount - bridgeAtClip + 1}
                                value={bridgeDurationClips}
                                onChange={e => setBridgeDurationClips(Number(e.target.value))}
                                required
                              />
                            </div>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Gaya Promosi</label>
                            <select className="form-input" value={promotionStyle} onChange={e => setPromotionStyle(e.target.value)}>
                              <option value="Softselling">Softselling (Halus)</option>
                              <option value="Hardsell">Hardsell (Jelas, Promosi USP)</option>
                              <option value="Education">Education (Review Logis)</option>
                            </select>
                          </div>
                        </>
                      )}

                      {/* Product DNA Injection Settings (Always visible in Single mode for both direct and bridged placement) */}
                      {productionMode === 'single' && (
                        <>
                          <div className="form-group">
                            <label className="form-label">Metode Penyertaan Produk</label>
                            <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.8rem' }}>
                                <input type="radio" name="bridgingModeMult" value="url_extract" checked={bridgingMode === 'url_extract'} onChange={e => setBridgingMode(e.target.value)} />
                                Ekstrak dari URL
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.8rem' }}>
                                <input type="radio" name="bridgingModeMult" value="select_existing" checked={bridgingMode === 'select_existing'} onChange={e => setBridgingMode(e.target.value)} />
                                Pilih dari Pustaka
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.8rem' }}>
                                <input type="radio" name="bridgingModeMult" value="manual_input" checked={bridgingMode === 'manual_input'} onChange={e => setBridgingMode(e.target.value)} />
                                Tulis Manual
                              </label>
                            </div>
                          </div>

                          {bridgingMode === 'url_extract' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, background: 'var(--bg-secondary)', padding: 16, borderRadius: 8 }}>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">URL Produk (Shopee/Tokopedia)</label>
                                <input
                                  type="url"
                                  className="form-input"
                                  placeholder="https://shopee.co.id/product-url"
                                  value={productUrl}
                                  onChange={e => setProductUrl(e.target.value)}
                                  required={bridgingMode === 'url_extract'}
                                />
                              </div>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Affiliate URL (Opsional)</label>
                                <input
                                  type="url"
                                  className="form-input"
                                  placeholder="https://shope.ee/short-url"
                                  value={affiliateUrl}
                                  onChange={e => setAffiliateUrl(e.target.value)}
                                />
                              </div>
                            </div>
                          )}

                          {bridgingMode === 'select_existing' && (
                            <div className="form-group" style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <div>
                                <label className="form-label">Pilih Produk</label>
                                
                                {/* Search Input for Product Selection */}
                                <input
                                  type="text"
                                  className="form-input"
                                  style={{ marginBottom: 10, fontSize: '0.8rem' }}
                                  placeholder="🔍 Cari produk berdasarkan nama atau brand..."
                                  value={productSearchQuery}
                                  onChange={e => setProductSearchQuery(e.target.value)}
                                />

                                <select className="form-input" value={targetProductId} onChange={e => {
                                  const val = e.target.value;
                                  setTargetProductId(val);
                                  if (val) {
                                    const selProduct = products.find(p => String(p.id) === String(val));
                                    if (selProduct) {
                                      const photoPath = selProduct.photo_url || selProduct.clean_photo_url || selProduct.generated_photo_url || selProduct.raw_photo_url || '';
                                      if (photoPath) {
                                        setProductRefImage(photoPath);
                                        const derivedFilename = selProduct.filename_declare || (selProduct.product_name ? `${selProduct.product_name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_ref.jpg` : 'product_ref.jpg');
                                        setProductFilenameDeclare(derivedFilename);
                                      }
                                    }
                                  }
                                }}>
                                  <option value="">-- Pilih Produk Terdaftar --</option>
                                  {products
                                    .filter(p => 
                                      (p.product_name || '').toLowerCase().includes(productSearchQuery.toLowerCase()) ||
                                      (p.brand_name || '').toLowerCase().includes(productSearchQuery.toLowerCase())
                                    )
                                    .map(p => (
                                      <option key={p.id} value={p.id}>{p.brand_name || 'Generik'} - {p.product_name}</option>
                                    ))
                                  }
                                </select>
                                {targetProductId && productRefImage && (
                                  <div style={{ marginTop: 10, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: 12, borderRadius: 8 }}>
                                    <div style={{ color: '#10b981', fontWeight: 600, fontSize: '0.85rem' }}>
                                      ✨ Foto Produk & Deklarasi Mandate 88 Otomatis Terhubung dari Database Produk
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                                      {typeof productRefImage === 'string' && (
                                        <img src={productRefImage} alt="Product Ref" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-color)' }} />
                                      )}
                                      <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                                        <div><b>Nama Berkas Deklarasi:</b> <code>{productFilenameDeclare || 'Auto Generated'}</code></div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {bridgingMode === 'manual_input' && (
                            <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <div className="form-group">
                                <label className="form-label">Nama Produk</label>
                                <input className="form-input" placeholder="Contoh: Makna Brightening Serum" value={manualProductName} onChange={e => setManualProductName(e.target.value)} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Deskripsi Singkat</label>
                                <textarea className="form-textarea" placeholder="Manfaat utama..." value={manualProductDesc} onChange={e => setManualProductDesc(e.target.value)} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Unique Selling Point (USP)</label>
                                <input className="form-input" placeholder="Contoh: Mengandung 10% Niacinamide" value={manualProductUsp} onChange={e => setManualProductUsp(e.target.value)} />
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* Pixel Lock Image Upload (Always visible in Single mode for both direct and bridged placement) */}
                      {productionMode === 'single' && (
                        <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div className="form-group">
                            <label className="form-label">Visual Mode</label>
                            <select className="form-input" value={visualMode} onChange={e => setVisualMode(e.target.value)}>
                              <option value="pure_t2v">Pure Text-To-Video (T2V Langsung)</option>
                              <option value="hybrid_lock">Double-Pass Pixel Lock (T2I ➜ Veo 3.1 I2V)</option>
                            </select>
                          </div>

                          {visualMode === 'hybrid_lock' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Foto Referensi Produk</label>
                                <input 
                                  type="file" 
                                  className="form-input" 
                                  accept="image/*" 
                                  onChange={e => setProductRefImage(e.target.files[0])}
                                />
                              </div>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Deklarasi Nama Berkas (Filename)</label>
                                <input 
                                  type="text" 
                                  className="form-input" 
                                  placeholder="Contoh: botol_serum.png" 
                                  value={productFilenameDeclare} 
                                  onChange={e => setProductFilenameDeclare(e.target.value)}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Section 3: Visual Swap Overrides */}
                <div style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <div 
                    onClick={() => setActiveAccordion(2)} 
                    style={{ padding: '16px 24px', background: activeAccordion === 2 ? 'rgba(59, 130, 246, 0.05)' : 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>3. Visual Swap Overrides (VSO)</span>
                    <span>{activeAccordion === 2 ? '▲' : '▼'}</span>
                  </div>
                  {activeAccordion === 2 && (
                    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, background: 'rgba(0,0,0,0.1)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={isVsoActive}
                            onChange={e => setIsVsoActive(e.target.checked)}
                          />
                          <span className="slider"></span>
                        </label>
                        <strong>🎭 Aktifkan Visual Swap Overrides</strong>
                      </div>

                      {isVsoActive && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                          <div className="form-group">
                            <label className="form-label">Konsep Karakter (Framing)</label>
                            <select className="form-input" value={characterConcept} onChange={e => setCharacterConcept(e.target.value)}>
                              <option value="faceless">Faceless (Fokus Tangan)</option>
                              <option value="pov">POV (First Person View)</option>
                              <option value="silhouette">Siluet Bayangan</option>
                              <option value="stylized_3d">3D Stylized Claymation</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Demografi Subjek / Model</label>
                            <select 
                              className="form-input" 
                              value={subjectDemographic} 
                              onChange={e => {
                                const val = e.target.value;
                                setSubjectDemographic(val);
                                setWardrobeStyle('random');
                                if (val.startsWith('stylized_3d_')) {
                                  setCharacterConcept('stylized_3d');
                                } else {
                                  setCharacterConcept('faceless');
                                }
                              }}
                            >
                              <option value="syari_classic">Wanita Gamis Syar'iy (Hanya Tangan)</option>
                              <option value="caucasian_male">Pria Kaukasia (Hanya Tangan)</option>
                              <option value="stylized_3d_muslimah">Wanita 3D Stylized (Clay Art)</option>
                              <option value="stylized_3d_male">Pria 3D Stylized (Clay Art)</option>
                              <option value="stylized_3d_duo">Duo 3D Stylized - 2 Karakter (Clay Art)</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Pakaian / Wardrobe</label>
                            <select className="form-input" value={wardrobeStyle} onChange={e => setWardrobeStyle(e.target.value)}>
                              <option value="random">🎲 Random (Acak)</option>
                              <option value="sequential">🔄 Sequential (Urut per baris)</option>
                              {subjectDemographic === 'stylized_3d_muslimah' ? (
                                <optgroup label="Pakaian 3D Muslimah">
                                  <option value="3d_fem_emerald">Gamis Hijau Emerald 3D</option>
                                  <option value="3d_fem_pastel_pink">Gamis Pastel Pink 3D</option>
                                  <option value="3d_fem_jetblack">Abaya Hitam Legam 3D</option>
                                  <option value="3d_fem_mocca">Gamis Mocca 3D</option>
                                </optgroup>
                              ) : subjectDemographic === 'stylized_3d_male' ? (
                                <optgroup label="Pakaian 3D Pria">
                                  <option value="3d_male_tan_knit">Sweater Tan Rajut 3D</option>
                                  <option value="3d_male_sage_jacket">Jaket Kasual Sage Green 3D</option>
                                  <option value="3d_male_charcoal_tshirt">Kaos Charcoal Katun 3D</option>
                                  <option value="3d_male_terracotta_flannel">Kemeja Flanel Terracotta 3D</option>
                                </optgroup>
                              ) : subjectDemographic === 'stylized_3d_duo' ? (
                                <optgroup label="Harmoni Pakaian Duo Terkoordinasi">
                                  <option value="3d_duo_earth">Tema 1: Earthy Warmth (Tan Sweater & Cream Abaya)</option>
                                  <option value="3d_duo_contrast">Tema 2: Urban Contrast (Terracotta Jacket & Sage Abaya)</option>
                                  <option value="3d_duo_monochrome">Tema 3: Minimalist Monochrome (Off-White T-shirt & Black Abaya)</option>
                                  <option value="3d_duo_pastel">Tema 4: Soft Pastel Harmony (Mint Polo & Lilac Abaya)</option>
                                  <option value="3d_duo_cool">Tema 5: Professional Cool Tones (Grey Flannel & Teal Abaya)</option>
                                </optgroup>
                              ) : subjectDemographic === 'caucasian_male' ? (
                                <optgroup label="Preset Warna Pria Kaukasia">
                                  <option value="male_terracotta">Pria: Terracotta</option>
                                  <option value="male_caramel">Pria: Caramel Latte</option>
                                  <option value="male_khaki_tan">Pria: Khaki / Tan</option>
                                  <option value="male_navy_blue">Pria: Navy Blue</option>
                                  <option value="male_forest_green">Pria: Forest Green</option>
                                  <option value="male_charcoal">Pria: Charcoal Grey</option>
                                  <option value="male_burgundy">Pria: Burgundy Maroon</option>
                                  <option value="male_sage_muted">Pria: Sage Green Muted</option>
                                  <option value="male_steel_blue">Pria: Steel Blue</option>
                                  <option value="male_cloud_dancer">Pria: Off-White (Cloud Dancer)</option>
                                </optgroup>
                              ) : (
                                <>
                                  <optgroup label="1. Earth Tones & Warm Neutrals">
                                    <option value="amber_terracotta">Amber Haze & Terracotta</option>
                                    <option value="mocca_caramel">Mocca, Taupe & Caramel Latte</option>
                                    <option value="warm_grey">Warm Grey</option>
                                  </optgroup>
                                  <optgroup label="2. Muted Pastels (Pastel Refined)">
                                    <option value="sage_muted">Sage Green Muted</option>
                                    <option value="lavender_lilac">Lavender Soft & Soft Lilac</option>
                                    <option value="butter_yellow">Butter Yellow (Butter Cream)</option>
                                  </optgroup>
                                  <optgroup label="3. Modern Cool & Deep Tones">
                                    <option value="teal_navy">Transformative Teal & Navy Blue</option>
                                    <option value="olive_modern">Olive Green Modern</option>
                                    <option value="mahogany_maroon">Mahogany & Maroon</option>
                                  </optgroup>
                                  <optgroup label="4. Netral Klasik Modern">
                                    <option value="cloud_dancer">Cloud Dancer (Off-White Modern)</option>
                                  </optgroup>
                                </>
                              )}
                              <option value="custom">-- Tulis Custom --</option>
                            </select>
                            {wardrobeStyle === 'custom' && (
                              <input 
                                type="text" 
                                className="form-input" 
                                style={{ marginTop: 8 }} 
                                placeholder={
                                  subjectDemographic.startsWith('stylized_3d_') 
                                    ? "Ketik pakaian 3D kustom..." 
                                    : subjectDemographic === 'caucasian_male' 
                                      ? "Ketik pakaian kustom..." 
                                      : "Ketik warna kustom..."
                                }
                                value={wardrobeStyleCustom} 
                                onChange={e => setWardrobeStyleCustom(e.target.value)} 
                              />
                            )}
                          </div>
                          <div className="form-group">
                            <label className="form-label">Pencahayaan (Lighting)</label>
                            <select className="form-input" value={lightingStyle} onChange={e => setLightingStyle(e.target.value)}>
                              <option value="random">🎲 Random (Acak)</option>
                              <option value="window_daylight">Soft Window Daylight (Cahaya jendela natural)</option>
                              <option value="golden_hour">Golden Hour Warm Sunset (Sorot sore keemasan)</option>
                              <option value="moody_shadow">Moody Cinematic Shadow (Kontras chiaroscuro dramatis)</option>
                              <option value="studio_softbox">Clean Professional Studio Softbox (Sangat bersih)</option>
                              <option value="lab_cold">Clinical Cold White (Putih lab bersih terang)</option>
                              <option value="cyber_neon">Moody Cyberpunk Blue-Pink Neon (Warna glow modern)</option>
                              <option value="candle_warm">Cozy Dim Candlelight Ambiance (Sangat syahdu hangat)</option>
                              <option value="custom">-- Tulis Custom --</option>
                            </select>
                            {lightingStyle === 'custom' && (
                              <input type="text" className="form-input" style={{ marginTop: 8 }} placeholder="Lighting kustom..." value={lightingStyleCustom} onChange={e => setLightingStyleCustom(e.target.value)} />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Section 4: Workflow & Audio Settings */}
                <div style={{ borderBottom: 'none' }}>
                  <div 
                    onClick={() => setActiveAccordion(3)} 
                    style={{ padding: '16px 24px', background: activeAccordion === 3 ? 'rgba(59, 130, 246, 0.05)' : 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>4. Workflow & Audio Settings</span>
                    <span>{activeAccordion === 3 ? '▲' : '▼'}</span>
                  </div>
                  {activeAccordion === 3 && (
                    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, background: 'rgba(0,0,0,0.1)' }}>
                      
                      {/* TTS Voiceover toggle */}
                      <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <label className="switch">
                            <input type="checkbox" checked={enableTts} onChange={e => setEnableTts(e.target.checked)} />
                            <span className="slider"></span>
                          </label>
                          <strong>🎙 Aktifkan Voiceover (TTS Engine)</strong>
                        </div>

                        {enableTts && (
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 8 }}>
                              <div className="form-group">
                                <label className="form-label">TTS Provider</label>
                                <select className="form-input" value={voiceProvider} onChange={e => setVoiceProvider(e.target.value)}>
                                  <option value="minimax">MiniMax (Dynamic Voice)</option>
                                  <option value="gemini">Gemini Audio (Google Natural)</option>
                                </select>
                              </div>
                              <div className="form-group">
                                <label className="form-label">Voice Persona</label>
                                <select className="form-input" value={voicePersona} onChange={e => setVoicePersona(e.target.value)}>
                                  {voiceProvider === 'gemini' 
                                    ? GEMINI_VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)
                                    : MINIMAX_VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)
                                  }
                                </select>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 16 }}>
                              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                <label className="form-label">Speed ({voiceSpeed}x)</label>
                                <input type="range" min="0.5" max="2.0" step="0.1" className="form-input" value={voiceSpeed} onChange={e => setVoiceSpeed(Number(e.target.value))} style={{ width: '100%' }} />
                              </div>
                              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                <label className="form-label">Volume ({voiceVolume})</label>
                                <input type="range" min="0.1" max="2.0" step="0.1" className="form-input" value={voiceVolume} onChange={e => setVoiceVolume(Number(e.target.value))} style={{ width: '100%' }} />
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* TikTok Safe Compliance Audit */}
                      <div className="form-group" style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 8, marginBottom: 0 }}>
                        <label className="form-label">Audit Kepatuhan TikTok Safe</label>
                        <select
                          className="form-input"
                          value={enableVoAudit}
                          onChange={e => setEnableVoAudit(Number(e.target.value))}
                        >
                          <option value={1}>✅ Yes (Audit Compliance & Render 2 Versi VO)</option>
                          <option value={0}>❌ No (Tanpa Audit Compliance)</option>
                        </select>
                      </div>

                      {/* G-Labs Video Generator */}
                      <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <label className="switch">
                          <input type="checkbox" checked={enableGlabs} onChange={e => setEnableGlabs(e.target.checked)} />
                          <span className="slider"></span>
                        </label>
                        <strong>🎬 Aktifkan Video Generation (G Labs)</strong>
                      </div>

                      {/* FFmpeg Smart Sync Muxer */}
                      <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12, opacity: (!enableTts || !enableGlabs) ? 0.5 : 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <label className="switch">
                            <input 
                              type="checkbox" 
                              checked={enableFfmpeg} 
                              onChange={e => setEnableFfmpeg(e.target.checked)}
                              disabled={!enableTts || !enableGlabs}
                            />
                            <span className="slider"></span>
                          </label>
                          <strong>🎞 Aktifkan Smart-Sync Muxing (FFmpeg Studio)</strong>
                        </div>

                        {enableFfmpeg && enableTts && enableGlabs && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 8 }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Mode Sinkronisasi</label>
                              <select className="form-input" value={ffmpegSyncOption} onChange={e => setFfmpegSyncOption(e.target.value)}>
                                <option value="smart_sync">Auto-Pilot Smart Sync</option>
                                <option value="shortest">Shortest (Hard Trim)</option>
                                <option value="stretch">Stretch (Symmetrical Speed)</option>
                              </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">BGM Volume</label>
                              <input type="number" min="0" max="1" step="0.05" className="form-input" value={ffmpegBgmVolume} onChange={e => setFfmpegBgmVolume(Number(e.target.value))} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Submit Action */}
                <div style={{ padding: 24, borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting}
                    style={{ padding: '12px 24px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                  >
                    {submitting ? (
                      <>
                        <div className="spinner" style={{ width: 14, height: 14, border: '2px solid #fff', borderTopColor: 'transparent' }}></div>
                        Mengirim...
                      </>
                    ) : (
                      '🚀 Generate Remake Video'
                    )}
                  </button>
                </div>
              </form>
            </div>
            )}

            {/* Queue Section: Active Task Queue */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px 20px' }}>
                <strong style={{ fontSize: '0.92rem', color: '#fff', display: 'block', marginBottom: 2 }}>
                  📋 Antrean Render Multiplier
                </strong>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Total {tasks.length} task terdaftar di database
                </span>
              </div>

              {loadingTasks ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  <div className="spinner" style={{ margin: '0 auto 12px', width: 24, height: 24 }}></div>
                  Memuat data antrean...
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {tasks.map((t, idx) => {
                    const isExpanded = expandedTaskId === t.id;
                    
                    let statusLabel = 'PENDING';
                    let badgeStyle = { background: 'rgba(108, 117, 125, 0.15)', color: '#a0aec0', border: '1px solid rgba(108, 117, 125, 0.3)' };

                    if (t.status === 'completed') {
                      statusLabel = 'COMPLETED';
                      badgeStyle = { background: 'rgba(46, 204, 113, 0.15)', color: 'var(--success)', border: '1px solid rgba(46, 204, 113, 0.3)' };
                    } else if (t.status === 'failed') {
                      statusLabel = 'FAILED';
                      badgeStyle = { background: 'rgba(231, 76, 60, 0.15)', color: 'var(--danger)', border: '1px solid rgba(231, 76, 60, 0.3)' };
                    } else if (t.status === 'paused') {
                      statusLabel = 'STOPPED';
                      badgeStyle = { background: 'rgba(253, 203, 110, 0.15)', color: '#fdcb6e', border: '1px solid rgba(253, 203, 110, 0.3)' };
                    } else if (t.status === 'pending_resolution') {
                      statusLabel = 'PENDING';
                      badgeStyle = { background: 'rgba(108, 117, 125, 0.15)', color: '#a0aec0', border: '1px solid rgba(108, 117, 125, 0.3)' };
                    } else {
                      statusLabel = 'RUNNING';
                      badgeStyle = { background: 'rgba(52, 152, 219, 0.15)', color: 'var(--info)', border: '1px solid rgba(52, 152, 219, 0.3)' };
                    }

                    let bridgingData = {};
                    try {
                      bridgingData = JSON.parse(t.bridging_config_json || '{}');
                    } catch (e) {}

                    let vsoData = {};
                    try {
                      vsoData = JSON.parse(t.vso_config_json || '{}');
                    } catch (e) {}

                    let audioData = {};
                    try {
                      audioData = JSON.parse(t.audio_config_json || '{}');
                    } catch (e) {}
                    
                    return (
                      <div 
                        key={t.id} 
                        className="card" 
                        style={{ cursor: 'pointer', transition: 'all 0.2s ease', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-sm)' }}
                        onClick={() => setExpandedTaskId(isExpanded ? null : t.id)}
                      >
                        {/* Task Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '1.1rem' }}>🔗</span>
                              <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                                {t.target_product_url || 'Manual Input Product'}
                              </strong>
                              <span style={{
                                fontSize: '0.68rem',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontWeight: 'bold',
                                textTransform: 'uppercase',
                                ...badgeStyle
                              }}>
                                {statusLabel}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>ID: {t.id}</span>
                          </div>
                          
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {t.created_at ? new Date(t.created_at).toLocaleString('id-ID') : ''}
                          </div>
                        </div>

                        {/* Metadata Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                          <div>
                            <strong>Template Blueprint:</strong>{' '}
                            <span style={{ color: 'var(--info)', wordBreak: 'break-all' }}>
                              {t.asset_source_url ? t.asset_source_url.substring(0, 50) + '...' : 'Blueprint Asset'}
                            </span>
                          </div>
                          {t.affiliate_url && (
                            <div>
                              <strong>Affiliate URL:</strong>{' '}
                              <span style={{ color: 'var(--text-muted)', wordBreak: 'break-all' }}>{t.affiliate_url}</span>
                            </div>
                          )}
                          <div>
                            <strong>Metode Bridging:</strong>{' '}
                            <span>{bridgingData.isBridgingActive ? `${bridgingData.promotionStyle || 'Softselling'} (Klip ${bridgingData.bridgeAtClip || 2} dari ${bridgingData.targetClipsCount || 4})` : 'Nonaktif'}</span>
                          </div>
                          <div>
                            <strong>Konfigurasi Visual:</strong>{' '}
                            <span>VSO: {vsoData.isVsoActive ? 'Aktif' : 'Nonaktif'} | {vsoData.aspectRatio || '9:16'} | {vsoData.videoModel || 'veo_31_lite'}</span>
                          </div>
                          <div>
                            <strong>Konfigurasi Audio:</strong>{' '}
                            <span>TTS: {audioData.enableTts ? (audioData.voicePersona || 'Indonesian_SweetGirl') : 'Nonaktif'} | FFmpeg: {audioData.enableFfmpeg ? 'Smart Sync' : 'Nonaktif'}</span>
                          </div>
                        </div>

                        {/* Action Buttons — rata KIRI */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-start', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }} onClick={e => e.stopPropagation()}>
                          <button 
                            type="button"
                            className="btn btn-primary btn-sm" 
                            onClick={() => setExpandedTaskId(isExpanded ? null : t.id)}
                            style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                          >
                            🔍 Detail
                          </button>

                          <button
                            onClick={() => handleToggleTaskStatus(t.id, t.status)}
                            className="btn btn-sm"
                            style={{
                              color: (t.status === 'paused' || t.status === 'failed') ? 'var(--success)' : 'var(--danger)',
                              background: (t.status === 'paused' || t.status === 'failed') ? 'rgba(46,204,113,0.1)' : 'rgba(235,77,75,0.1)',
                              borderColor: (t.status === 'paused' || t.status === 'failed') ? 'rgba(46, 204, 113, 0.2)' : 'rgba(235, 77, 75, 0.2)',
                              fontSize: '0.75rem',
                              padding: '6px 12px'
                            }}
                          >
                            {(t.status === 'paused' || t.status === 'failed') ? '▶️ Resume' : '⏸️ Pause'}
                          </button>

                          {t.asset_source_url && (
                            <a 
                              href={t.asset_source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-secondary btn-sm"
                              style={{ textDecoration: 'none', fontSize: '0.75rem', padding: '6px 12px' }}
                            >
                              📊 Template
                            </a>
                          )}
                          
                          <button 
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleCopyTaskSettings(t)}
                            style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                          >
                            📋 Copy
                          </button>

                          <button 
                            onClick={() => handleDelete(t.id)} 
                            className="btn btn-danger btn-sm" 
                            style={{ background: '#dc2626', color: '#fff', borderColor: '#dc2626', fontSize: '0.75rem', padding: '6px 12px' }}
                          >
                            🗑 Hapus
                          </button>
                        </div>

                        {/* Task Detail Expanded */}
                        {isExpanded && (() => {
                          const activeTab = activeTabs[t.id] || 'concept';
                          const handleSelectTab = (tabId) => {
                            setActiveTabs(prev => ({ ...prev, [t.id]: tabId }));
                          };

                          return (
                            <div style={{ padding: '16px 0 0 0', borderTop: '1px solid var(--border)', background: 'transparent', marginTop: '16px' }} onClick={e => e.stopPropagation()}>
                              
                              {/* Visual Player if finished */}
                              {t.status === 'completed' && t.ffmpeg_output_path && (
                                <div style={{ marginBottom: 16 }}>
                                  <video 
                                    src={t.ffmpeg_output_path} 
                                    controls 
                                    style={{ width: '100%', borderRadius: 'var(--radius-sm)', background: '#000', maxHeight: 320 }}
                                  />
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                                    {t.nextcloud_video_url && (
                                      <a 
                                        href={t.nextcloud_video_url} 
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-secondary"
                                        style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                      >
                                        ☁️ Nextcloud Video
                                      </a>
                                    )}
                                    {t.nextcloud_md_url && (
                                      <a 
                                        href={t.nextcloud_md_url} 
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-secondary"
                                        style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                      >
                                        📝 Nextcloud Narrative (.md)
                                      </a>
                                    )}
                                    <a 
                                      href={t.ffmpeg_output_path} 
                                      download 
                                      className="btn btn-primary"
                                      style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                                    >
                                      📥 Download Video Final
                                    </a>
                                  </div>
                                </div>
                              )}

                              {/* Tabs Navigation */}
                              <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '16px', overflowX: 'auto' }}>
                                {[
                                  { id: 'concept', label: '💡 Konsep Awal & Produk' },
                                  { id: 'storyboard', label: '📖 Storyboard' },
                                  { id: 'voiceover', label: '🎤 Voiceover' },
                                  { id: 'prompts', label: '🤖 AI Video Prompt' },
                                  { id: 'social', label: '📱 Social Draft' },
                                  { id: 'logs', label: '🖥 System Log' }
                                ].map(tab => (
                                  <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => handleSelectTab(tab.id)}
                                    className="btn"
                                    style={{
                                      fontSize: '0.78rem',
                                      padding: '6px 12px',
                                      borderRadius: 4,
                                      border: activeTab === tab.id ? '1px solid var(--accent)' : '1px solid transparent',
                                      background: activeTab === tab.id ? 'var(--accent-glow)' : 'transparent',
                                      color: activeTab === tab.id ? 'var(--accent-light)' : 'var(--text-secondary)',
                                      fontWeight: activeTab === tab.id ? '600' : 'normal',
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {tab.label}
                                  </button>
                                ))}
                              </div>

                              {/* Tab Content 1: concept */}
                              {activeTab === 'concept' && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                                  
                                  {/* Left Column: Template Blueprint details */}
                                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <strong style={{ fontSize: '0.85rem', color: 'var(--accent-light)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 6 }}>
                                      📹 Detail Template Blueprint
                                    </strong>
                                    <div>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>Tautan Asal</div>
                                      <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                                        {t.asset_source_url ? (
                                          <a href={t.asset_source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info)' }}>
                                            {t.asset_source_url} ↗
                                          </a>
                                        ) : '-'}
                                      </span>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>Tags Aset</div>
                                      <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                                        {(() => {
                                          const matchingAsset = assets.find(a => a.id === t.deconstruct_asset_id);
                                          if (matchingAsset && matchingAsset.tags) {
                                            return matchingAsset.tags.split(',').map((tag, tIdx) => (
                                              <span key={tIdx} style={{ display: 'inline-block', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4, marginRight: 6, fontSize: '0.7rem' }}>
                                                #{tag.trim()}
                                              </span>
                                            ));
                                          }
                                          return '-';
                                        })()}
                                      </span>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>Visual Style</div>
                                      <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>{vsoData.visualStyle || '-'}</span>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>Narrative Mode</div>
                                      <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>{vsoData.narrativeMode || '-'}</span>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>Face Visibility</div>
                                      <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>{vsoData.faceVisibility || '-'}</span>
                                    </div>
                                  </div>

                                  {/* Right Column: Target Product & Bridging details */}
                                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <strong style={{ fontSize: '0.85rem', color: 'var(--accent-light)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 6 }}>
                                      🛍️ Target Produk & Bridging
                                    </strong>
                                    <div>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>Tautan Produk Target</div>
                                      <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                                        {t.target_product_url ? (
                                          <a href={t.target_product_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info)' }}>
                                            {t.target_product_url} ↗
                                          </a>
                                        ) : 'Input Manual'}
                                      </span>
                                    </div>
                                    {t.affiliate_url && (
                                      <div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>Affiliate URL</div>
                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{t.affiliate_url}</span>
                                      </div>
                                    )}
                                    <div>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>Visual Mode</div>
                                      <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                                        {bridgingData.visualMode === 'hybrid_lock' ? 'Double-Pass Pixel Lock (T2I ➜ I2V)' : 'Pure Text-to-Video'}
                                      </span>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>Gaya Promosi</div>
                                      <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                                        {bridgingData.isBridgingActive ? `${bridgingData.promotionStyle || 'Softselling'} (Klip ${bridgingData.bridgeAtClip || 2} durasi ${bridgingData.bridgeDurationClips || 1} klip)` : 'Nonaktif'}
                                      </span>
                                    </div>
                                    
                                    {/* Ref Image if present */}
                                    {bridgingData.productRefImagePath && (
                                      <div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>Gambar Referensi Produk</div>
                                        <img
                                          src={bridgingData.productRefImagePath}
                                          alt="Referensi Produk"
                                          style={{ maxWidth: '100%', maxHeight: '100px', borderRadius: 4, border: '1px solid var(--border)' }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Tab Content 2: storyboard */}
                              {activeTab === 'storyboard' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                  {t.remake_storyboard_json ? (
                                    JSON.parse(t.remake_storyboard_json).map((scene, sIdx) => (
                                      <div key={sIdx} style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 6, border: '1px solid rgba(255,255,255,0.03)' }}>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                                          Adegan {scene.scene || sIdx + 1}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#fff', marginBottom: 6, lineHeight: 1.4 }}>
                                          <b>Visual:</b> {scene.visual_description}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.4 }}>
                                          <b>Voiceover:</b> "{scene.narration_transcript || scene.voiceover || '-'}"
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                      Storyboard belum digenerate (Status: {t.status.replace('_', ' ')}).
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Tab Content: voiceover */}
                              {activeTab === 'voiceover' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                  {(() => {
                                    const aConfig = JSON.parse(t.audio_config_json || '{}');
                                    return (
                                      <>
                                        <div style={{ background: 'var(--bg-secondary)', padding: 14, borderRadius: 6, border: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                                            🎙️ Voiceover & Sound Settings
                                          </div>
                                          <div style={{ fontSize: '0.8rem', color: '#fff', display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                                            <div><b>Status TTS:</b> {aConfig.enableTts ? '⚡ Aktif' : '❌ Nonaktif'}</div>
                                            <div><b>Provider:</b> {aConfig.voiceProvider || 'minimax'}</div>
                                            <div><b>Persona:</b> {aConfig.voicePersona || 'Indonesian_SweetGirl'}</div>
                                            <div><b>Speed:</b> {aConfig.voiceSpeed || 1.0}x</div>
                                          </div>
                                          {aConfig.combined_audio_path && (
                                            <div style={{ marginTop: 8 }}>
                                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Audio Voiceover Gabungan:</div>
                                              <audio controls src={aConfig.combined_audio_path} style={{ width: '100%', height: 36, borderRadius: 4 }} />
                                            </div>
                                          )}
                                        </div>

                                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: 4 }}>
                                          📜 Transkrip Naskah Suara Per Adegan
                                        </div>
                                        {t.remake_storyboard_json ? (
                                          JSON.parse(t.remake_storyboard_json).map((scene, sIdx) => (
                                            <div key={sIdx} style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 6, border: '1px solid rgba(255,255,255,0.03)' }}>
                                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--info)', marginBottom: 4 }}>
                                                Adegan {scene.scene || sIdx + 1}
                                              </div>
                                              <div style={{ fontSize: '0.82rem', color: '#fff', fontStyle: 'italic', lineHeight: 1.4 }}>
                                                "{scene.narration_transcript || scene.voiceover || '-'}"
                                              </div>
                                            </div>
                                          ))
                                        ) : (
                                          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                            Transkrip belum tersedia.
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              )}

                              {/* Tab Content 3: prompts */}
                              {activeTab === 'prompts' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                  {t.t2i_i2v_prompts_json ? (
                                    JSON.parse(t.t2i_i2v_prompts_json).map((pObj, pIdx) => (
                                      <div key={pIdx} style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 6, border: '1px solid rgba(255,255,255,0.03)' }}>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                                          Klip {pObj.scene || pIdx + 1}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                          {pObj.t2v_prompt && <div><b>T2V Prompt:</b> <span style={{ color: '#fff' }}>{pObj.t2v_prompt}</span></div>}
                                          {pObj.t2i_prompt && <div><b>T2I Prompt:</b> <span style={{ color: '#fff' }}>{pObj.t2i_prompt}</span></div>}
                                          {pObj.i2v_prompt && <div><b>I2V Motion:</b> <span style={{ color: '#fff' }}>{pObj.i2v_prompt}</span></div>}
                                          {!pObj.t2v_prompt && !pObj.t2i_prompt && !pObj.i2v_prompt && <div style={{ color: 'var(--text-muted)' }}>Tidak ada prompt visual untuk klip ini.</div>}
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                      Visual prompts belum digenerate (Status: {t.status.replace('_', ' ')}).
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Tab Content 4: social */}
                              {activeTab === 'social' && (
                                <div>
                                  {t.new_caption ? (
                                    <pre style={{
                                      background: 'var(--bg-secondary)', padding: 16, borderRadius: 6, fontSize: '0.8rem',
                                      color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0,
                                      border: '1px solid rgba(255,255,255,0.03)', lineHeight: 1.5
                                    }}>
                                      {t.new_caption}
                                    </pre>
                                  ) : (
                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                      Caption belum digenerate (Status: {t.status.replace('_', ' ')}).
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Tab Content 5: logs */}
                              {activeTab === 'logs' && (
                                <pre style={{
                                  background: '#07070a', padding: '16px', borderRadius: 6, fontSize: '0.78rem',
                                  color: '#20c20e', fontFamily: 'var(--font-mono)', margin: 0,
                                  border: '1px solid var(--border)', maxHeight: '250px', overflowY: 'auto',
                                  lineHeight: 1.5, whiteSpace: 'pre-wrap'
                                }}>
                                  {(() => {
                                    const filtered = terminalLogs
                                      .split('\n')
                                      .filter(line => line.includes(t.id))
                                      .join('\n');
                                    return filtered || `Belum ada log sistem yang tercatat untuk Task ID: ${t.id}.`;
                                  })()}
                                </pre>
                              )}

                              {/* Processing Progress Status */}
                              {t.status !== 'completed' && t.status !== 'failed' && (
                                <div style={{ padding: 12, textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: 6, marginTop: 16 }}>
                                  <div className="spinner" style={{ width: 16, height: 16, margin: '0 auto 8px' }}></div>
                                  <span style={{ fontSize: '0.78rem', color: 'var(--info)' }}>
                                    {t.status === 'pending_resolution' && 'Menunggu antrean resolusi produk...'}
                                    {t.status === 'resolving_product' && 'Mengekstrak DNA & data produk target...'}
                                    {t.status === 'remaking' && 'Menggunakan Gemini AI untuk remake storyboard...'}
                                    {t.status === 'generating_audio' && 'Merender voiceover TTS (MiniMax)...'}
                                    {t.status === 'generating_visuals' && 'Merender visual adegan video (G-Labs)...'}
                                    {t.status === 'ffmpeg_muxing' && 'Menggabungkan audio-video final (FFmpeg)...'}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                  {tasks.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 40, border: '2px dashed var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      Belum ada antrean task multiplier yang dijalankan.
                    </div>
                  )}
                </div>
              )}
            </div>
            
          </div>

        </div>
      </main>

      {/* Toast Alert */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
          background: toast.type === 'error' ? 'var(--danger)' : 'var(--success)',
          color: '#fff', padding: '12px 24px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 8
        }}>
          <span>{toast.type === 'error' ? '⚠️' : '✓'}</span>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

export default function MultiplierLabPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-main)', color: 'var(--text-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: 40, height: 40, border: '4px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ marginTop: 16, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Memuat Multiplier Lab...</p>
        </div>
      </div>
    }>
      <MultiplierLabPageContent />
    </Suspense>
  );
}
