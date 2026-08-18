'use client';

import Sidebar from '../components/Sidebar';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

const GEMINI_VOICES = [
  { id: 'Kore', name: 'Kore (Female)', avatar: '👩', desc: 'Standard Female (Skincare/Cosmetic)' },
  { id: 'Fenrir', name: 'Fenrir (Male)', avatar: '🧔', desc: 'Deep/Heavy Male (Otomotif/High-End)' },
  { id: 'Puck', name: 'Puck (Male)', avatar: '👦', desc: 'Ceria, Playful (Makanan/Promo Kilat)' },
  { id: 'Charon', name: 'Charon (Male)', avatar: '👨', desc: 'Formal, News Style (Review Tech/Finansial)' },
  { id: 'Leda', name: 'Leda (Female)', avatar: '👵', desc: 'Hangat, Ramah (Edukasi/Ibu Anak)' },
  { id: 'Zephyr', name: 'Zephyr (Male)', avatar: 'sn', desc: 'Kasual, Santai (Storytelling/Daily Vlog)' },
  { id: 'Orus', name: 'Orus (Male)', avatar: '🧔', desc: 'Tegas, Optimis (Motivasi/Online Course)' },
  { id: 'Aoede', name: 'Aoede (Female)', avatar: '👩‍🎨', desc: 'Artistik, Ekspresif (Fashion/Seni)' },
  { id: 'Callirrhoe', name: 'Callirrhoe (Female)', avatar: '👩‍💼', desc: 'Berenergi, Dinamis (Olahraga/Lifestyle)' },
  { id: 'Autonoe', name: 'Autonoe (Female)', avatar: '👩‍🎓', desc: 'Dewasa, Profesional (Bisnis/Corporate)' },
  { id: 'Enceladus', name: 'Enceladus (Male)', avatar: '👨‍🎤', desc: 'Misterius, Berat (Teaser/Trailer)' },
  { id: 'Iapetus', name: 'Iapetus (Male)', avatar: '👴', desc: 'Bijaksana, Ramah (Mentor/Tips Hidup)' },
  { id: 'Umbriel', name: 'Umbriel (Male)', avatar: '👨‍🔬', desc: 'Dingin, Fokus (Dokumenter/Sains)' },
  { id: 'Despina', name: 'Despina (Female)', avatar: '👧', desc: 'Cepat, Riang (TikTok/Tips Singkat)' },
];

const MINIMAX_VOICES = [
  { id: 'Indonesian_casual_reporter_vv2', name: 'Casual Reporter (Male)', avatar: '👨', desc: 'Laki-laki (Casual Reporter - Vv2)' },
  { id: 'Indonesian_compelling_storyteller_vv2', name: 'Compelling Storyteller (Male)', avatar: '👨', desc: 'Laki-laki (Storyteller - Vv2)' },
  { id: 'Indonesian_expressive_podcaster_vv2', name: 'Expressive Podcaster (Male)', avatar: '👨', desc: 'Laki-laki (Podcaster - Vv2)' },
  { id: 'Indonesian_energetic_streamer_vv2', name: 'Energetic Streamer (Male)', avatar: '👨', desc: 'Laki-laki (Streamer - Vv2)' },
  { id: 'Indonesian_intellectual_commentator_vv2', name: 'Intellectual Commentator (Female)', avatar: '👩', desc: 'Perempuan (Commentator - Vv2)' },
  { id: 'Indonesian_professional_anchor_vv2', name: 'Professional Anchor (Female)', avatar: '👩', desc: 'Perempuan (Anchor - Vv2)' },
  { id: 'Indonesian_crisp_reporter_vv2', name: 'Crisp Reporter (Female)', avatar: '👩', desc: 'Perempuan (Crisp Reporter - Vv2)' }
];

const MINIMAX_ENGLISH_VOICES = [
  { id: 'English_Resonant_Man', name: 'Resonant Man (Male)', avatar: '👨', desc: 'English Resonant Man' },
  { id: 'English_Trustworth_Man', name: 'Trustworthy Man (Male)', avatar: '👨', desc: 'English Trustworthy Man' },
  { id: 'English_causual_narrator_vv1', name: 'Casual Narrator (Male)', avatar: '👨', desc: 'English Casual Narrator' },
  { id: 'English_causual_podcast_vv1', name: 'Casual Podcast (Male)', avatar: '👨', desc: 'English Casual Podcast' },
  { id: 'English_expressive_host__vv1', name: 'Expressive Host (Male)', avatar: '👨', desc: 'English Expressive Host' },
  { id: 'English_instructive_professor_vv1', name: 'Instructive Professor (Female)', avatar: '👩', desc: 'English Instructive Professor' },
  { id: 'English_nursery_teacher_vv2', name: 'Nursery Teacher (Female)', avatar: '👩', desc: 'English Nursery Teacher' },
  { id: 'English_captivating_female1', name: 'Captivating Female (Female)', avatar: '👩', desc: 'English Captivating Female' },
  { id: 'English_radiant_girl', name: 'Radiant Girl (Female)', avatar: '👩', desc: 'English Radiant Girl' },
  { id: 'English_CalmWoman', name: 'Calm Woman (Female)', avatar: '👩', desc: 'English Calm Woman' }
];

function MultiplierLabPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preSelectedAssetId = searchParams.get('asset_id');

  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [assetSearchQuery, setAssetSearchQuery] = useState('');

  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [campaigns, setCampaigns] = useState([]);

  const [productionMode, setProductionMode] = useState('single');
  const [activeAccordion, setActiveAccordion] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const pollingRef = useRef(null);
  const terminalRef = useRef(null);

  const [showConfigForm, setShowConfigForm] = useState(false);
  const [isSchedulerActive, setIsSchedulerActive] = useState(true);
  const [terminalLogs, setTerminalLogs] = useState('');

  const [productUrl, setProductUrl] = useState('');
  const [affiliateUrl, setAffiliateUrl] = useState('');
  const [massUrlsText, setMassUrlsText] = useState('');

  const [brandProfiles, setBrandProfiles] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [filterBrandId, setFilterBrandId] = useState('all');

  const [narrativeMode, setNarrativeMode] = useState('Storytelling');
  const [visualStyle, setVisualStyle] = useState('Cinematic');
  const [targetAi, setTargetAi] = useState('Google Veo (8s)');
  const [videoModel, setVideoModel] = useState('veo_31_lite');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [faceVisibility, setFaceVisibility] = useState('Faceless');
  const [wordsPerClip, setWordsPerClip] = useState('17-19 kata');

  const [isVsoActive, setIsVsoActive] = useState(false);
  const [characterConcept, setCharacterConcept] = useState('faceless');
  const [subjectDemographic, setSubjectDemographic] = useState('syari_classic');
  const [wardrobeStyle, setWardrobeStyle] = useState('random');
  const [wardrobeStyleCustom, setWardrobeStyleCustom] = useState('');
  const [lightingStyle, setLightingStyle] = useState('random');
  const [lightingStyleCustom, setLightingStyleCustom] = useState('');

  const [isBridgingActive, setIsBridgingActive] = useState(true);
  const [targetClipsCount, setTargetClipsCount] = useState(4);
  const [bridgeAtClip, setBridgeAtClip] = useState(2);
  const [bridgeDurationClips, setBridgeDurationClips] = useState(1);
  const [promotionStyle, setPromotionStyle] = useState('Softselling');
  const [bridgingMode, setBridgingMode] = useState('url_extract');
  const [manualProductName, setManualProductName] = useState('');
  const [manualProductDesc, setManualProductDesc] = useState('');
  const [manualProductUsp, setManualProductUsp] = useState('');
  const [productRefImage, setProductRefImage] = useState(null);
  const [productFilenameDeclare, setProductFilenameDeclare] = useState('');
  const [visualMode, setVisualMode] = useState('hybrid_lock');

  const [enableTts, setEnableTts] = useState(true);
  const [voiceProvider, setVoiceProvider] = useState('minimax');
  const [voicePersona, setVoicePersona] = useState('Indonesian_casual_reporter_vv2');
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [voiceVolume, setVoiceVolume] = useState(1.0);
  const [ttsModelQuality, setTtsModelQuality] = useState('speech-2.8-turbo');
  const [enableGlabs, setEnableGlabs] = useState(true);
  const [enableFfmpeg, setEnableFfmpeg] = useState(true);
  const [targetLanguage, setTargetLanguage] = useState('id-ID');
  const [ffmpegSyncOption, setFfmpegSyncOption] = useState('smart_sync');
  const [syncMode, setSyncMode] = useState('auto');
  const [ffmpegVideoScale, setFfmpegVideoScale] = useState(1.0);
  const [ffmpegSfxVolume, setFfmpegSfxVolume] = useState(0.0);
  const [ffmpegBgmVolume, setFfmpegBgmVolume] = useState(0.0);
  const [enableSocialPost, setEnableSocialPost] = useState(false);
  const [enableVoAudit, setEnableVoAudit] = useState(1);

  const [nextcloudParentFolder, setNextcloudParentFolder] = useState('/MAKNA_Assets');
  const [targetDemographic, setTargetDemographic] = useState('genz_casual');
  const [targetDemographicCustom, setTargetDemographicCustom] = useState('');
  const [aiDirective, setAiDirective] = useState('');
  const [mandatoryOutroLine, setMandatoryOutroLine] = useState('');
  const [customInstruction, setCustomInstruction] = useState('');

  useEffect(() => {
    fetchAssets();
    fetchTasks();
    pollLogs();
    fetch('/api/v2/brand-profiles').then(r => r.json()).then(d => { if (d.success) setBrandProfiles(d.data || []); }).catch(() => {});

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

  useEffect(() => {
    if (assets.length > 0 && preSelectedAssetId) {
      setSelectedAssetId(preSelectedAssetId);
    }
  }, [assets, preSelectedAssetId]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAssets = async () => {
    setLoadingAssets(true);
    try {
      const res = await fetch('/api/v2/deconstruct?limit=100');
      const data = await res.json();
      if (data.success) {
        setAssets(data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAssets(false);
    }
  };

  const fetchTasks = async (isPoll = false) => {
    if (!isPoll) setLoadingTasks(true);
    try {
      const res = await fetch('/api/v2/multiplier');
      const data = await res.json();
      if (data.success) {
        setTasks(data.tasks || []);
        setIsSchedulerActive(data.isSchedulerActive);
        
        // Group tasks into campaigns (batches)
        const groups = {};
        data.tasks.forEach(t => {
          const bid = t.batch_id || `single_${t.id}`;
          if (!groups[bid]) {
            let brandName = '';
            let productTitle = '';
            try {
              const snap = t.product_snapshot_json ? (typeof t.product_snapshot_json === 'string' ? JSON.parse(t.product_snapshot_json) : t.product_snapshot_json) : null;
              brandName = snap?.product_name || '';
            } catch (_) {}

            groups[bid] = {
              id: bid,
              brand_profile_id: t.brand_profile_id || 'default_tenant',
              brand_name: t.brand_name || brandName || 'default_tenant',
              campaign_name: t.new_caption ? t.new_caption.slice(0, 50) : `Multiplier Campaign ${bid.slice(4, 10)}`,
              created_at: t.created_at,
              status: t.status,
              tasks: [],
              stats: { total: 0, completed: 0, failed: 0, processing: 0 }
            };
          }
          groups[bid].tasks.push(t);
          groups[bid].stats.total++;
          if (t.status === 'completed') groups[bid].stats.completed++;
          else if (t.status === 'failed') groups[bid].stats.failed++;
          else if (['remaking', 'generating_audio', 'generating_visuals', 'ffmpeg_muxing'].includes(t.status)) groups[bid].stats.processing++;
        });

        // Determine aggregated campaign status
        const campaignList = Object.values(groups).map(g => {
          let overallStatus = 'draft';
          if (g.stats.completed === g.stats.total) overallStatus = 'completed';
          else if (g.stats.failed > 0) overallStatus = 'failed';
          else if (g.stats.processing > 0) overallStatus = 'running';
          else if (g.tasks.some(t => t.status === 'paused')) overallStatus = 'paused';
          
          return { ...g, status: overallStatus };
        });

        setCampaigns(campaignList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!isPoll) setLoadingTasks(false);
    }
  };

  const pollLogs = async () => {
    try {
      const res = await fetch('/api/system-logs?service=multiplier');
      const data = await res.json();
      if (data.success) {
        setTerminalLogs(data.logs || 'Memulai pemantauan sistem log...');
      }
    } catch (_) {}
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSubmitting(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/v2/products/image', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setProductRefImage(data.filePath);
        setProductFilenameDeclare(data.fileName);
        showToast('Foto produk berhasil diunggah.');
      } else {
        showToast(data.error || 'Gagal mengunggah foto.', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAssetId) {
      showToast('Harap pilih dekonstruksi referensi (blueprint).', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        deconstruct_asset_id: selectedAssetId,
        production_mode: productionMode,
        enable_vo_audit: enableVoAudit,
        vso_config_json: JSON.stringify({
          narrativeMode, visualStyle, targetAi, videoModel, aspectRatio, faceVisibility, wordsPerClip,
          isVsoActive, characterConcept, subjectDemographic, wardrobeStyle, wardrobeStyleCustom, lightingStyle, lightingStyleCustom
        }),
        bridging_config_json: JSON.stringify({
          isBridgingActive, targetClipsCount, bridgeAtClip, bridgeDurationClips, promotionStyle, bridgingMode,
          manualProductName, manualProductDesc, manualProductUsp, visualMode
        }),
        audio_config_json: JSON.stringify({
          enableTts, voiceProvider, voicePersona, voiceSpeed, voiceVolume, ttsModelQuality,
          enableGlabs, enableFfmpeg, targetLanguage, ffmpegSyncOption, syncMode,
          ffmpegVideoScale, ffmpegSfxVolume, ffmpegBgmVolume, enableSocialPost,
          nextcloudParentFolder, targetDemographic, targetDemographicCustom, aiDirective,
          mandatoryOutroLine, customInstruction
        }),
        productRefImagePath: productRefImage
      };

      if (productionMode === 'single') {
        payload.target_product_url = productUrl;
        payload.affiliate_url = affiliateUrl;
      } else {
        const lines = massUrlsText.split('\n').map(l => l.trim()).filter(Boolean);
        const rows = lines.map(line => {
          const parts = line.split('|');
          return {
            target_product_url: parts[0],
            affiliate_url: parts[1] || ''
          };
        });
        payload.csv_data_json = JSON.stringify(rows);
      }

      const res = await fetch('/api/v2/multiplier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast('Kampanye Multiplier baru berhasil didaftarkan!');
        setShowConfigForm(false);
        setProductUrl('');
        setAffiliateUrl('');
        setMassUrlsText('');
        setProductRefImage(null);
        fetchTasks();
      } else {
        showToast(data.error || 'Gagal mendaftarkan kampanye.', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleGlobalScheduler = async () => {
    try {
      const res = await fetch('/api/v2/multiplier', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_scheduler' })
      });
      const data = await res.json();
      if (data.success) {
        setIsSchedulerActive(data.isActive);
        showToast(`Status Scheduler berhasil diubah menjadi: ${data.isActive ? 'AKTIF' : 'NONAKTIF'}`);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const toggleStatus = async (campaign) => {
    const isCurrentlyRunning = campaign.status === 'running';
    const action = isCurrentlyRunning ? 'pause' : 'resume';
    try {
      const res = await fetch('/api/v2/multiplier', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, batchId: campaign.id })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Berhasil mengubah status kampanye ke ${action.toUpperCase()}`);
        fetchTasks();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const deleteCampaign = async (batchId) => {
    if (!confirm('Apakah Anda yakin ingin menghapus seluruh kampanye beserta tugas di dalamnya?')) return;
    try {
      const res = await fetch(`/api/v2/multiplier?batchId=${batchId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Kampanye berhasil dihapus.');
        fetchTasks();
      } else {
        showToast(data.error || 'Gagal menghapus kampanye.', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const filteredCampaigns = campaigns.filter(c => filterBrandId === 'all' || c.brand_profile_id === filterBrandId);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              🧬 Multiplier Lab & Remake Engine
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: 4 }}>
              Duplikasi & rekonstruksi massal video konten performa tinggi untuk katalog produk Anda.
            </p>
          </div>
          <button
            onClick={() => setShowConfigForm(!showConfigForm)}
            className="btn btn-primary"
            style={{ fontWeight: 600, padding: '10px 20px', borderRadius: 8, fontSize: '0.88rem' }}
          >
            {showConfigForm ? '📂 Tutup Form Kreasi' : '⚡ Buat Kampanye Baru'}
          </button>
        </div>

        {toast && (
          <div style={{
            position: 'fixed', top: 20, right: 20, zIndex: 9999,
            padding: '12px 24px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600,
            background: toast.type === 'error' ? 'var(--status-danger-soft)' : 'var(--status-success-soft)',
            border: `1px solid ${toast.type === 'error' ? 'var(--danger)' : 'var(--success)'}`,
            color: 'var(--text-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}>
            {toast.message}
          </div>
        )}

        {/* Creation Config Form */}
        {showConfigForm && (
          <div className="card" style={{ marginBottom: 28, border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', fontWeight: 700 }}>⚙️ Konfigurasi Kampanye Multiplier Baru</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Accordion Configs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                
                {/* Accordion 1: Source Blueprint & Mode */}
                <details open={activeAccordion === 0} onClick={(e) => { e.preventDefault(); setActiveAccordion(0); }} style={{ background: 'var(--surface-interactive)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <summary style={{ padding: '14px 20px', fontWeight: 600, cursor: 'pointer', background: 'var(--overlay-subtle)' }}>
                    📂 1. Pilih Blueprint Referensi & Mode Produksi
                  </summary>
                  <div style={{ padding: 20, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="form-group">
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                        Pilih Blueprint Dekonstruksi Referensi
                      </label>
                      <select
                        value={selectedAssetId}
                        onChange={e => setSelectedAssetId(e.target.value)}
                        className="form-input"
                        required
                        style={{ width: '100%', padding: '10px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6 }}
                      >
                        <option value="">-- Pilih Blueprint --</option>
                        {assets.map(a => (
                          <option key={a.id} value={a.id}>
                            [{a.niche || 'Niche'}] {a.original_caption?.slice(0, 60) || a.id}...
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Mode Produksi</label>
                        <div style={{ display: 'flex', gap: 12 }}>
                          <button type="button" onClick={() => setProductionMode('single')} className={`btn ${productionMode === 'single' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1, padding: 10 }}>Single Task</button>
                          <button type="button" onClick={() => setProductionMode('mass')} className={`btn ${productionMode === 'mass' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1, padding: 10 }}>Mass Campaign</button>
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Audit Voiceover Safe</label>
                        <select value={enableVoAudit} onChange={e => setEnableVoAudit(Number(e.target.value))} className="form-input" style={{ width: '100%', padding: '10px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6 }}>
                          <option value={1}>Aktifkan (TikTok Safe)</option>
                          <option value={0}>Matikan (Lewati)</option>
                        </select>
                      </div>
                    </div>

                    {productionMode === 'single' ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div className="form-group">
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>URL Detail Produk Tokopedia/Shopee</label>
                          <input type="url" value={productUrl} onChange={e => setProductUrl(e.target.value)} placeholder="https://shopee.co.id/product-name" className="form-input" required={productionMode === 'single'} />
                        </div>
                        <div className="form-group">
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>URL Affiliate Rekomendasi (Opsional)</label>
                          <input type="url" value={affiliateUrl} onChange={e => setAffiliateUrl(e.target.value)} placeholder="https://shope.ee/xxxxx" className="form-input" />
                        </div>
                      </div>
                    ) : (
                      <div className="form-group">
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                          Daftar URL Produk Massal (Satu URL per Baris, Format: `url_produk|url_affiliate_opsional`)
                        </label>
                        <textarea
                          value={massUrlsText}
                          onChange={e => setMassUrlsText(e.target.value)}
                          placeholder="https://tokopedia.com/product-a|https://tokopedia.link/aff-a&#10;https://shopee.co.id/product-b"
                          rows={4}
                          className="form-input"
                          required={productionMode === 'mass'}
                          style={{ width: '100%', padding: '10px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, fontFamily: 'monospace' }}
                        />
                      </div>
                    )}
                  </div>
                </details>

                {/* Accordion 2: Aesthetics Strategy */}
                <details open={activeAccordion === 1} onClick={(e) => { e.preventDefault(); setActiveAccordion(1); }} style={{ background: 'var(--surface-interactive)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <summary style={{ padding: '14px 20px', fontWeight: 600, cursor: 'pointer', background: 'var(--overlay-subtle)' }}>
                    🎨 2. Aesthetics & Visual Style (VSO Overrides)
                  </summary>
                  <div style={{ padding: 20, borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Visual Style Preset</label>
                      <select value={visualStyle} onChange={e => setVisualStyle(e.target.value)} className="form-input" style={{ width: '100%' }}>
                        <option value="Cinematic">Cinematic</option>
                        <option value="Aesthetic Warm">Aesthetic Warm</option>
                        <option value="Product Showcase">Product Showcase</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Video Model (G-Labs)</label>
                      <select value={videoModel} onChange={e => setVideoModel(e.target.value)} className="form-input" style={{ width: '100%' }}>
                        <option value="veo_31_lite">Google Veo (8s) Lite</option>
                        <option value="veo_31">Google Veo (8s) High Quality</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Aspect Ratio</label>
                      <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="form-input" style={{ width: '100%' }}>
                        <option value="9:16">Vertical 9:16 (TikTok/Shorts)</option>
                        <option value="16:9">Landscape 16:9 (YouTube)</option>
                      </select>
                    </div>
                  </div>
                </details>

                {/* Accordion 3: Product Bridging */}
                <details open={activeAccordion === 2} onClick={(e) => { e.preventDefault(); setActiveAccordion(2); }} style={{ background: 'var(--surface-interactive)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <summary style={{ padding: '14px 20px', fontWeight: 600, cursor: 'pointer', background: 'var(--overlay-subtle)' }}>
                    🌉 3. Product Bridging & Start Frame Settings
                  </summary>
                  <div style={{ padding: 20, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                      <div>
                        <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Visual Mode</label>
                        <select value={visualMode} onChange={e => setVisualMode(e.target.value)} className="form-input" style={{ width: '100%' }}>
                          <option value="hybrid_lock">Hybrid Lock (Start Frame T2I + I2V)</option>
                          <option value="pure_t2v">Pure Text-To-Video (T2V)</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Klip Target Promosi</label>
                        <input type="number" min={1} max={10} value={bridgeAtClip} onChange={e => setBridgeAtClip(Number(e.target.value))} className="form-input" style={{ width: '100%' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Gaya Promosi</label>
                        <select value={promotionStyle} onChange={e => setPromotionStyle(e.target.value)} className="form-input" style={{ width: '100%' }}>
                          <option value="Softselling">Softselling (Storytelling)</option>
                          <option value="Hardselling">Hardselling (Direct USP)</option>
                        </select>
                      </div>
                    </div>

                    {visualMode === 'hybrid_lock' && (
                      <div style={{ background: 'var(--overlay-subtle)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                        <h4 style={{ margin: '0 0 10px', fontSize: '0.85rem', fontWeight: 700 }}>📸 Upload Foto Acuan Produk (Optional)</h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} id="product-ref-upload" />
                          <button type="button" className="btn btn-secondary" onClick={() => document.getElementById('product-ref-upload').click()} style={{ fontSize: '0.8rem' }}>
                            📤 Pilih Foto Produk
                          </button>
                          {productFilenameDeclare && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>
                              ✓ Terunggah: {productFilenameDeclare}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </details>

              </div>

              {/* Action Form Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowConfigForm(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? '⏳ Mendaftarkan...' : '🚀 Daftarkan Kampanye'}
                </button>
              </div>

            </form>
          </div>
        )}

        {/* Global Scheduler Controller */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          padding: 16, marginBottom: 20,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12
        }}>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>⚙️ Status Skeduler Multiplier Lab</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>Mengontrol jalannya rendering video kampanye remake secara terpusat.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', padding: '4px 10px', borderRadius: 12,
              background: isSchedulerActive ? 'var(--status-success-soft)' : 'var(--status-danger-soft)',
              color: isSchedulerActive ? 'var(--success)' : 'var(--danger)',
              border: `1px solid ${isSchedulerActive ? 'var(--status-success-soft)' : 'var(--status-danger-soft)'}`
            }}>
              {isSchedulerActive ? '🟢 SKEDULER AKTIF' : '🔴 SKEDULER MATI'}
            </span>
            <button
              type="button"
              onClick={toggleGlobalScheduler}
              className={`btn ${isSchedulerActive ? 'btn-danger' : 'btn-success'}`}
              style={{
                fontSize: '0.8rem', padding: '6px 16px', fontWeight: 600,
                boxShadow: isSchedulerActive ? '0 0 15px var(--status-danger-soft)' : '0 0 15px var(--status-success-soft)',
                border: isSchedulerActive ? '1px solid var(--status-danger-soft)' : '1px solid var(--status-success-soft)'
              }}
            >
              {isSchedulerActive ? '🛑 STOP SKEDULER' : '▶️ START SKEDULER'}
            </button>
          </div>
        </div>

        {/* System Logs */}
        <div className="card" style={{ padding: '0', background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: '24px' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--status-success)', display: 'inline-block', boxShadow: '0 0 8px var(--status-success)' }}></span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>SYSTEM POLLER LOGGER (MULTIPLIER)</span>
            </div>
            <button onClick={pollLogs} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>[Refresh Log]</button>
          </div>
          <pre ref={terminalRef} style={{ margin: 0, padding: '20px', background: 'var(--surface)', color: '#20c20e', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', maxHeight: '180px', overflowY: 'auto', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
            {terminalLogs}
          </pre>
        </div>

        {/* Brand filter and campaigns header */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 20px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>🎬 Daftar Kampanye Multiplier ({filteredCampaigns.length})</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>🔍 FILTER BRAND:</span>
            <select
              value={filterBrandId}
              onChange={e => setFilterBrandId(e.target.value)}
              style={{
                background: 'var(--surface-interactive)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600
              }}
            >
              <option value="all">Semua Brand</option>
              {brandProfiles.map(bp => (
                <option key={bp.id} value={bp.id}>{bp.brand_name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Campaigns rendering cards */}
        {loadingTasks ? (
          <div style={{ color: 'var(--text-muted)', padding: 32, textAlign: 'center' }}>Memuat kampanye...</div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎬</div>
            <p style={{ color: 'var(--text-muted)' }}>Tidak ada kampanye yang cocok dengan filter brand ini.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filteredCampaigns.map(c => {
              const pct = Math.round((c.stats.completed / c.stats.total) * 100) || 0;
              let statusColor = 'var(--text-muted)';
              let statusBg = 'var(--surface-interactive)';
              let statusBorder = 'var(--border-subtle)';
              if (c.status === 'completed') { statusColor = 'var(--success)'; statusBg = 'var(--status-success-soft)'; statusBorder = 'var(--status-success-soft)'; }
              else if (c.status === 'running') { statusColor = 'var(--status-info)'; statusBg = 'var(--status-info-soft)'; statusBorder = 'var(--status-info-soft)'; }
              else if (c.status === 'paused') { statusColor = 'var(--status-warning)'; statusBg = 'rgba(253,203,110,0.15)'; statusBorder = 'rgba(253,203,110,0.3)'; }
              else if (c.status === 'failed') { statusColor = 'var(--danger)'; statusBg = 'var(--status-danger-soft)'; statusBorder = 'var(--status-danger-soft)'; }

              return (
                <div key={c.id} className="card" style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-sm)' }}>
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          background: c.brand_name ? 'rgba(168, 85, 247, 0.15)' : 'var(--surface-interactive)',
                          border: c.brand_name ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid var(--border-subtle)',
                          color: c.brand_name ? '#d8b4fe' : 'var(--text-muted)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          🏷️ Brand: {c.brand_name || 'Tidak Ditentukan'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1.1rem' }}>🎬</span>
                        <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{c.campaign_name}</strong>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 8, background: statusBg, color: statusColor, border: `1px solid ${statusBorder}` }}>
                          {c.status}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(c.created_at).toLocaleString('id-ID')}
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                    <div><strong>Total Item:</strong> <span style={{ color: 'var(--text-primary)' }}>{c.stats.total}</span></div>
                    <div><strong>Selesai Render:</strong> <span style={{ color: 'var(--success)' }}>{c.stats.completed}</span></div>
                    <div><strong>Gagal:</strong> <span style={{ color: 'var(--danger)' }}>{c.stats.failed}</span></div>
                    <div><strong>Dalam Antrean:</strong> <span style={{ color: 'var(--status-info)' }}>{c.stats.processing}</span></div>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: 4, height: 5, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>{pct}% complete</div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--surface-interactive)', paddingTop: 12, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => router.push(`/multiplier-lab/${c.id}`)} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                        🔍 Detail Kampanye
                      </button>

                      {c.status !== 'completed' && (
                        <button type="button" className={`btn btn-sm ${c.status === 'running' ? 'btn-danger' : 'btn-success'}`} onClick={() => toggleStatus(c)} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                          {c.status === 'draft' ? '▶ Run' : (c.status === 'running' ? '⏸ Pause' : '▶ Resume')}
                        </button>
                      )}

                      <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteCampaign(c.id)} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                        🗑 Hapus
                      </button>
                    </div>

                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', background: 'var(--surface-interactive)', padding: '2px 8px', borderRadius: '4px' }}>
                      🔑 ID Batch: {c.id}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        </div>
      </main>
    </div>
  );
}

export default function MultiplierLabPage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Memuat Halaman...</div>}>
      <MultiplierLabPageContent />
    </Suspense>
  );
}
