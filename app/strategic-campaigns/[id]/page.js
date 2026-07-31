'use client';

import Sidebar from '../../components/Sidebar';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useRef, Fragment } from 'react';

const GEMINI_VOICES = [
  { id: 'Kore', name: 'Kore (Female)', avatar: '👩', desc: 'Standard Female (Skincare/Cosmetic)' },
  { id: 'Fenrir', name: 'Fenrir (Male)', avatar: '🧔', desc: 'Deep/Heavy Male (Otomotif/High-End)' },
  { id: 'Puck', name: 'Puck (Male)', avatar: '👦', desc: 'Ceria, Playful (Makanan/Promo Kilat)' },
  { id: 'Charon', name: 'Charon (Male)', avatar: '👨', desc: 'Formal, News Style (Review Tech/Finansial)' },
  { id: 'Leda', name: 'Leda (Female)', avatar: '👵', desc: 'Hangat, Ramah (Edukasi/Ibu Anak)' },
  { id: 'Zephyr', name: 'Zephyr (Male)', avatar: '👦', desc: 'Kasual, Santai (Storytelling/Daily Vlog)' },
  { id: 'Orus', name: 'Orus (Male)', avatar: '🧔', desc: 'Tegas, Optimis (Motivasi/Online Course)' },
  { id: 'Aoede', name: 'Aoede (Female)', avatar: '👩‍🎨', desc: 'Artistik, Ekspresif (Fashion/Seni)' },
  { id: 'Callirrhoe', name: 'Callirrhoe (Female)', avatar: '👩‍💼', desc: 'Berenergi, Dinamis (Olahraga/Lifestyle)' },
  { id: 'Autonoe', name: 'Autonoe (Female)', avatar: '👩‍🎓', desc: 'Dewasa, Profesional (Bisnis/Corporate)' },
  { id: 'Enceladus', name: 'Enceladus (Male)', avatar: '👨‍🎤', desc: 'Misterius, Berat (Teaser/Trailer)' },
  { id: 'Iapetus', name: 'Iapetus (Male)', avatar: '👴', desc: 'Bijaksana, Ramah (Mentor/Tips Hidup)' },
  { id: 'Umbriel', name: 'Umbriel (Male)', avatar: '👨‍🔬', desc: 'Dingin, Fokus (Dokumenter/Sains)' },
  { id: 'Despina', name: 'Despina (Female)', avatar: '👧', desc: 'Cepat, Riang (TikTok/Tips Singkat)' }
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

const writeToClipboard = (text) => {
  if (typeof window !== 'undefined') {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textarea);
  }
  return Promise.resolve();
};

export default function StrategicCampaignWorkbench() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id;

  const [campaign, setCampaign] = useState(null);
  const [items, setItems] = useState([]);
  const [expandedItemId, setExpandedItemId] = useState(null);
  const [itemActiveTabs, setItemActiveTabs] = useState({}); // { [itemId]: 'concept' | 'storyboard' | 'dna' | 'assets' | 'logs' }
  const [complianceReviews, setComplianceReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [executingCall1, setExecutingCall1] = useState(false);
  const [handlingOverride, setHandlingOverride] = useState(false);
  const [toast, setToast] = useState(null);
  const [copySuccess, setCopySuccess] = useState({});
  const [syncingItemAssets, setSyncingItemAssets] = useState({});
  const [syncingContentFlow, setSyncingContentFlow] = useState({});
  const [liveLogs, setLiveLogs] = useState({});
  const [fetchingLogs, setFetchingLogs] = useState({});

  // Inline Editing State
  const [editScenes, setEditScenes] = useState([]);
  const [editSocialPkg, setEditSocialPkg] = useState({ caption: '', hashtags: [], call_to_action: '', marketing_angle: '' });
  const [savingItem, setSavingItem] = useState(false);

  // Workflow Settings State (Fase 2)
  const [settings, setSettings] = useState({
    enable_tts: true,
    voice_provider: 'minimax',
    voice_persona: 'Indonesian_casual_reporter_vv2',
    voice_speed: 1.0,
    voice_volume: 1.0,
    enable_glabs: true,
    enable_ffmpeg: true,
    ffmpeg_sync_option: 'smart_sync',
    ffmpeg_video_scale: 1.0,
    ffmpeg_sfx_volume: 0.0,
    ffmpeg_bgm_volume: 0.0
  });

  const [triggeringSteps, setTriggeringSteps] = useState({});
  const [approvingItems, setApprovingItems] = useState({});
  const [regeneratingSingleT2I, setRegeneratingSingleT2I] = useState({});
  const [isSchedulerActive, setIsSchedulerActive] = useState(true);

  // Terminal Poller Logs State
  const [terminalLogs, setTerminalLogs] = useState('Menginisialisasi log Strategic Campaign...');
  const [showLogsTerminal, setShowLogsTerminal] = useState(true);
  const terminalRef = useRef(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  useEffect(() => {
    if (campaignId) {
      fetchCampaignDetail();
      fetchSchedulerStatus();
      pollLogs();
      const interval = setInterval(pollLogs, 3000);
      return () => clearInterval(interval);
    }
  }, [campaignId]);

  async function fetchSchedulerStatus() {
    try {
      const res = await fetch('/api/strategic-campaigns/scheduler-control');
      const json = await res.json();
      if (json.success) {
        setIsSchedulerActive(json.isSchedulerActive);
      }
    } catch (_) {}
  }

  async function toggleStrategicScheduler() {
    try {
      const nextStatus = !isSchedulerActive;
      const res = await fetch('/api/strategic-campaigns/scheduler-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedulerStatus: nextStatus })
      });
      const json = await res.json();
      if (json.success) {
        setIsSchedulerActive(nextStatus);
        showToast(`Skeduler Strategic Campaign ${nextStatus ? 'DIAKTIFKAN 🟢' : 'DIMATIKAN 🔴'}`);
      } else {
        showToast('Gagal mengubah status skeduler: ' + (json.error || 'Unknown error'), 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  }

  async function pollLogs() {
    try {
      const res = await fetch(`/api/system-logs?type=strategic&t=${Date.now()}`);
      if (res.ok) {
        const text = await res.text();
        const lines = text.split('\n');
        const last500 = lines.slice(-500).join('\n');
        setTerminalLogs(last500 || 'Belum ada log aktivitas Strategic Campaign.');
      }
    } catch (_) {}
  }

  useEffect(() => {
    if (expandedItemId) {
      fetchComplianceReviews(expandedItemId);
      const selectedItem = items.find(it => it.id === expandedItemId);
      if (selectedItem) {
        setEditScenes(selectedItem.scenes ? JSON.parse(JSON.stringify(selectedItem.scenes)) : []);
        let pubPkg = null;
        try {
          pubPkg = selectedItem.publishing_package_json ? JSON.parse(selectedItem.publishing_package_json) : null;
        } catch (_) {}
        if (!pubPkg) {
          try {
            const crPkg = selectedItem.creative_package_json ? JSON.parse(selectedItem.creative_package_json) : null;
            pubPkg = crPkg?.social_media_package || null;
          } catch (_) {}
        }
        const socialData = pubPkg?.publishing_assets?.tiktok || pubPkg?.publishing_assets?.instagram || pubPkg?.social_media_package || pubPkg || {};
        setEditSocialPkg({
          caption: socialData.caption || pubPkg?.caption || '',
          hashtags: socialData.hashtags || pubPkg?.hashtags || [],
          call_to_action: socialData.call_to_action || socialData.cta || pubPkg?.call_to_action || '',
          marketing_angle: socialData.marketing_angle || pubPkg?.marketing_angle || ''
        });
      }
    }
  }, [expandedItemId, items]);

  async function fetchCampaignDetail() {
    try {
      setLoading(true);
      const res = await fetch(`/api/strategic-campaigns/${campaignId}`);
      const data = await res.json();
      if (data.success && data.campaign) {
        setCampaign(data.campaign);
        const itms = data.campaign.items || [];
        setItems(itms);
        if (data.campaign.workflow_config_json) {
          try {
            const wf = JSON.parse(data.campaign.workflow_config_json);
            setSettings(prev => ({
              ...prev,
              enable_tts: wf.enable_tts !== undefined ? !!wf.enable_tts : true,
              voice_provider: wf.voice_provider || 'minimax',
              voice_persona: wf.voice_persona || 'Indonesian_casual_reporter_vv2',
              voice_speed: wf.voice_speed !== undefined ? Number(wf.voice_speed) : 1.0,
              voice_volume: wf.voice_volume !== undefined ? Number(wf.voice_volume) : 1.0,
              enable_glabs: wf.enable_glabs !== undefined ? !!wf.enable_glabs : true,
              enable_ffmpeg: wf.enable_ffmpeg !== undefined ? !!wf.enable_ffmpeg : true,
              ffmpeg_sync_option: wf.ffmpeg_sync_option || 'smart_sync',
              ffmpeg_video_scale: wf.ffmpeg_video_scale !== undefined ? Number(wf.ffmpeg_video_scale) : 1.0,
              ffmpeg_sfx_volume: wf.ffmpeg_sfx_volume !== undefined ? Number(wf.ffmpeg_sfx_volume) : 0.0,
              ffmpeg_bgm_volume: wf.ffmpeg_bgm_volume !== undefined ? Number(wf.ffmpeg_bgm_volume) : 0.0,
            }));
          } catch (_) {}
        }
      } else {
        showToast('Gagal memuat detail kampanye: ' + data.error, 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchComplianceReviews(itemId) {
    try {
      const res = await fetch(`/api/strategic-campaigns/${campaignId}/items/${itemId}/compliance-review`);
      const data = await res.json();
      if (data.success) {
        setComplianceReviews(data.reviews || []);
      }
    } catch (e) {}
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  function handleCopy(text, key) {
    if (!text) return;
    writeToClipboard(text).then(() => {
      setCopySuccess(prev => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopySuccess(prev => ({ ...prev, [key]: false }));
      }, 2000);
    });
  }

  async function handleToggleRunCampaign() {
    if (!campaign) return;
    try {
      const res = await fetch(`/api/strategic-campaigns/${campaignId}/run`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(`Status kampanye diubah menjadi: ${data.status.toUpperCase()}`);
        fetchCampaignDetail();
      }
    } catch (e) {
      showToast('Gagal mengubah status: ' + e.message, 'error');
    }
  }

  async function handleCall1Execution(item) {
    if (!item) return;
    try {
      setExecutingCall1(true);
      const res = await fetch(`/api/strategic-campaigns/${campaignId}/items/${item.id}/call1`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        showToast(`AI Call 1 Berhasil! ${data.scenes_count} klip storyboard dihasilkan ✨`);
        fetchCampaignDetail();
        fetchComplianceReviews(item.id);
      } else {
        showToast('Gagal AI Call 1: ' + data.error, 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setExecutingCall1(false);
    }
  }

  async function handleSaveItemEdits() {
    if (!expandedItemId) return;
    try {
      setSavingItem(true);
      const res = await fetch(`/api/strategic-campaigns/${campaignId}/items/${expandedItemId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenes: editScenes,
          publishingPackage: editSocialPkg
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Perubahan naskah & aset berhasil disimpan! 💾');
        fetchCampaignDetail();
      } else {
        showToast('Gagal menyimpan: ' + data.error, 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setSavingItem(false);
    }
  }

  async function handleUploadStartFrame(sceneNumber, file) {
    if (!file || !expandedItemId) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sceneNumber', sceneNumber);

      const res = await fetch(`/api/strategic-campaigns/${campaignId}/items/${expandedItemId}/replace-start-frame`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Start frame Klip #${sceneNumber} berhasil diperbarui! 🖼️`);
        fetchCampaignDetail();
      } else {
        showToast('Gagal upload gambar: ' + data.error, 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  }

  async function handleComplianceOverride(item, actionType) {
    if (!item) return;
    try {
      setHandlingOverride(true);
      const res = await fetch(`/api/strategic-campaigns/${campaignId}/items/${item.id}/compliance-override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionType })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Kepatuhan disetujui (${actionType})! Status lanjut ke Call 2 ✨`);
        fetchCampaignDetail();
        fetchComplianceReviews(item.id);
      } else {
        showToast('Gagal memperbarui kepatuhan: ' + data.error, 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setHandlingOverride(false);
    }
  }

  async function handleTriggerStep(itemId, step) {
    const key = `${itemId}-${step}`;
    try {
      setTriggeringSteps(prev => ({ ...prev, [key]: true }));
      const res = await fetch(`/api/strategic-campaigns/${campaignId}/items/${itemId}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || `Langkah ${step.toUpperCase()} berhasil di-retry! 🔄`);
        fetchCampaignDetail();
      } else {
        showToast('Gagal retry: ' + (data.error || 'Unknown error'), 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setTriggeringSteps(prev => ({ ...prev, [key]: false }));
    }
  }

  async function handleRegenerateSingleSceneT2I(itemId, sceneNumber, t2iPrompt) {
    const key = `${itemId}-${sceneNumber}`;
    try {
      setRegeneratingSingleT2I(prev => ({ ...prev, [key]: true }));
      showToast(`Merender ulang Start Frame Klip #${sceneNumber}... ⏳`);
      const res = await fetch(`/api/strategic-campaigns/${campaignId}/items/${itemId}/regenerate-t2i`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneNumber, t2i_prompt: t2iPrompt })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || `Gambar Klip #${sceneNumber} berhasil diregenerasi! ✨`);
        if (data.start_frame_path) {
          setEditScenes(prev => prev.map(sc => sc.scene_number === sceneNumber ? { ...sc, start_frame_path: data.start_frame_path } : sc));
        }
        fetchCampaignDetail();
      } else {
        showToast('Gagal regenerasi klip: ' + (data.error || 'Unknown error'), 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setRegeneratingSingleT2I(prev => ({ ...prev, [key]: false }));
    }
  }

  async function handleSaveWorkflowSettings() {
    try {
      const res = await fetch(`/api/strategic-campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Pengaturan Workflow & Produksi (Fase 2) berhasil disimpan! 💾');
        fetchCampaignDetail();
      } else {
        showToast('Gagal menyimpan pengaturan: ' + (data.error || 'Unknown error'), 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  }

  async function handleApproveAndProceedItem(item) {
    if (!item || !item.id) return;
    setApprovingItems(prev => ({ ...prev, [item.id]: true }));
    try {
      const res = await fetch(`/api/v2/strategic-campaigns/items/${item.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          video_dna: item.video_dna_json ? JSON.parse(item.video_dna_json) : null
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('🚀 Item disetujui! Alur produksi Fase 2 (TTS & Video) sedang diproses.');
        fetchCampaignDetail();
      } else {
        showToast('Gagal menyetujui item: ' + (data.error || 'Unknown error'), 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setApprovingItems(prev => ({ ...prev, [item.id]: false }));
    }
  }

  async function handleSyncItemAssets(item) {
    if (!item || !item.id) return;
    setSyncingItemAssets(prev => ({ ...prev, [item.id]: true }));
    try {
      const res = await fetch(`/api/v2/strategic-campaigns/items/${item.id}/sync-assets`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(`Berhasil mengunggah ${data.totalFiles} aset ke ${data.storageProvider ? data.storageProvider.toUpperCase() : 'CLOUD'}!`);
        fetchCampaignDetail();
      } else {
        showToast('Gagal menyinkronkan aset: ' + (data.error || 'Unknown error'), 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setSyncingItemAssets(prev => ({ ...prev, [item.id]: false }));
    }
  }

  async function handleSyncItemToContentFlow(item) {
    if (!item || !item.id) return;
    setSyncingContentFlow(prev => ({ ...prev, [item.id]: true }));
    try {
      const res = await fetch(`/api/v2/strategic-campaigns/items/${item.id}/sync-contentflow`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('🌐 Data berhasil disinkronkan ke Content Flow!');
      } else {
        showToast('Gagal menyinkronkan ke Content Flow: ' + (data.error || 'Unknown error'), 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setSyncingContentFlow(prev => ({ ...prev, [item.id]: false }));
    }
  }

  async function fetchItemLogs(itemId) {
    if (!itemId) return;
    setFetchingLogs(prev => ({ ...prev, [itemId]: true }));
    try {
      const res = await fetch(`/api/system-logs?type=strategic&t=${Date.now()}`);
      const text = await res.text();
      const lines = text.split('\n');
      const filtered = lines.filter(line => line.includes(itemId) || line.includes('Strategic'));
      setLiveLogs(prev => ({ ...prev, [itemId]: filtered.slice(-50).join('\n') || `[SYSTEM] Belum ada log aktivitas khusus untuk Item #${itemId}.` }));
    } catch (e) {
      setLiveLogs(prev => ({ ...prev, [itemId]: `[ERROR] Gagal memuat log aktivitas: ${e.message}` }));
    } finally {
      setFetchingLogs(prev => ({ ...prev, [itemId]: false }));
    }
  }

  function renderPipelineProgressBar(item) {
    if (!item) return null;

    const getStageInfo = (status, label) => {
      if (status === 'completed') return { status: 'success', label: `✓ ${label}`, color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981' };
      if (status === 'failed') return { status: 'danger', label: `✗ ${label}`, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444' };
      if (status === 'processing') return { status: 'active', label: `⏳ ${label}`, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.2)', border: '1px solid #3b82f6' };
      if (status === 'skipped') return { status: 'skipped', label: `⚡ ${label}`, color: '#9ca3af', bg: 'rgba(255, 255, 255, 0.05)', border: '1px dashed #6b7280' };
      return { status: 'pending', label: `⏸️ ${label}`, color: '#9ca3af', bg: 'rgba(255, 255, 255, 0.03)', border: '1px solid #3f3f46' };
    };

    const stages = [
      { key: 'generator', label: 'Naskah & Storyboard', ...getStageInfo(item.generation_status, 'Storyboard') },
      { key: 'tts', label: 'Suara TTS', ...getStageInfo(item.tts_status, 'TTS Audio') },
      { key: 'visuals', label: 'Visual G-Labs', ...getStageInfo(item.visual_status, 'Visual Clips') },
      { key: 'ffmpeg', label: 'Render FFmpeg', ...getStageInfo(item.ffmpeg_status, 'Video Final') },
      { key: 'social', label: 'Social Post', ...getStageInfo(item.social_post_status, 'Posting') }
    ];

    return (
      <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#a5b4fc', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>📊 5-Stage Pipeline Progress & Manual Retry Controls</span>
          <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 400 }}>Klik 🔄 Retry untuk mengulang tahapan tertentu secara granular</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {stages.map((stg, idx) => {
            const isTriggering = triggeringSteps[`${item.id}-${stg.key}`];
            const canRetry = stg.status !== 'active';

            return (
              <div key={stg.key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: stg.bg,
                  color: stg.color,
                  fontWeight: 700,
                  fontSize: '12px',
                  border: stg.border,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  {stg.label}
                </span>

                {canRetry && (
                  <button
                    onClick={() => handleTriggerStep(item.id, stg.key)}
                    disabled={isTriggering}
                    title={`Retry ${stg.key}`}
                    style={{
                      padding: '4px 8px', background: '#27272a', color: '#fff', border: '1px solid #3f3f46',
                      borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700
                    }}
                  >
                    {isTriggering ? '⏳' : '🔄'}
                  </button>
                )}

                {idx < stages.length - 1 && (
                  <span style={{ color: '#4b5563', fontWeight: 900, fontSize: '12px', margin: '0 2px' }}>➔</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderPhaseStatusBadge(item) {
    if (!item) return null;
    const status = item.workflow_status || 'draft';
    let icon = '⏸️';
    let label = 'Fase 1 : Paused (Ready for Review)';
    let color = '#f59e0b';
    let bg = 'rgba(245, 158, 11, 0.1)';

    if (status === 'draft') {
      icon = '⚙️';
      label = 'Draft (Belum Dijalankan)';
      color = '#9ca3af'; bg = 'rgba(156, 163, 175, 0.1)';
    } else if (status === 'creative_generated') {
      icon = '⏸️';
      label = 'Fase 1 : Selesai (Generating Start Frames)';
      color = '#3b82f6'; bg = 'rgba(59, 130, 246, 0.1)';
    } else if (status === 'ready_for_review' || status === 'compliance_passed' || (item.generation_status === 'completed' && status !== 'completed')) {
      icon = '⏸️';
      label = 'Fase 2 : Paused (Ready for Review)';
      color = '#f39c12'; bg = 'rgba(243, 156, 18, 0.15)';
    } else if (status === 'human_review_required') {
      icon = '🟠';
      label = 'Human Review Required (Compliance Gate)';
      color = '#f59e0b'; bg = 'rgba(245, 158, 11, 0.1)';
    } else if (status === 'completed') {
      icon = '✅';
      label = 'Kampanye Selesai (Fase 2 Completed)';
      color = '#10b981'; bg = 'rgba(16, 185, 129, 0.15)';
    }

    return (
      <span style={{
        padding: '6px 14px', borderRadius: '8px', fontWeight: 700, fontSize: '12px',
        color: color, background: bg, border: `1px solid ${color}40`,
        display: 'inline-flex', alignItems: 'center', gap: '8px'
      }}>
        <span>{icon}</span> {label}
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#09090b', color: '#f3f4f6' }}>
      <Sidebar />
      <main className="main-content" style={{ flex: 1, marginLeft: 'var(--sidebar-w, 240px)', height: '100vh', overflowY: 'auto', padding: '24px 32px', minWidth: 0 }}>
        
        {/* Toast Notification */}
        {toast && (
          <div style={{
            position: 'fixed', top: '24px', right: '24px', zIndex: 1000,
            background: toast.type === 'error' ? '#ef4444' : '#10b981',
            color: '#fff', padding: '12px 20px', borderRadius: '8px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.3)', fontWeight: 600, fontSize: '14px'
          }}>
            {toast.msg}
          </div>
        )}

        {/* Header Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => router.push('/strategic-campaigns')} style={{ background: '#18181b', border: '1px solid #27272a', color: '#9ca3af', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
              ← Kembali ke Daftar
            </button>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', margin: 0 }}>
              🎯 {campaign?.campaign_name || 'Strategic Campaign Workbench'}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={handleToggleRunCampaign}
              style={{
                padding: '8px 18px', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '13px',
                background: campaign?.status === 'running' ? '#ef4444' : '#10b981', color: '#fff'
              }}
            >
              {campaign?.status === 'running' ? '⏸ Pause Otomatisasi' : '▶ Run Semi-Otomatis'}
            </button>
          </div>
        </div>

        {/* STATUS SKEDULER STRATEGIC CAMPAIGN CARD (OPC PARITY) */}
        <div style={{
          background: '#18181b', border: '1px solid #27272a', borderRadius: '12px',
          padding: '16px 20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', flexWrap: 'wrap', gap: '12px'
        }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ⚙️ Status Skeduler Strategic Campaign
            </h3>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0 0' }}>
              Mengontrol jalannya antrean pembuatan video SC secara otomatis.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
              padding: '4px 10px', borderRadius: '12px',
              background: isSchedulerActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: isSchedulerActive ? '#10b981' : '#ef4444',
              border: `1px solid ${isSchedulerActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
            }}>
              {isSchedulerActive ? '🟢 SKEDULER AKTIF' : '🔴 SKEDULER MATI'}
            </span>
            <button
              type="button"
              onClick={toggleStrategicScheduler}
              style={{
                padding: '8px 18px', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '12px',
                background: isSchedulerActive ? '#ef4444' : '#10b981', color: '#fff',
                boxShadow: isSchedulerActive ? '0 0 15px rgba(239, 68, 68, 0.4)' : '0 0 15px rgba(16, 185, 129, 0.4)'
              }}
            >
              {isSchedulerActive ? '🛑 STOP SKEDULER' : '▶️ START SKEDULER'}
            </button>
          </div>
        </div>

        {/* SYSTEM POLLER LOGGER (OPC PARITY) */}
        <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '12px', border: '1px solid #27272a', overflow: 'hidden', marginBottom: '24px' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #27272a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#00b894', display: 'inline-block', boxShadow: '0 0 8px #00b894' }}></span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: '600', color: '#9ca3af' }}>SYSTEM POLLER LOGGER</span>
            </div>
            <button
              type="button"
              onClick={pollLogs}
              style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'monospace' }}
            >
              [Refresh Log]
            </button>
          </div>
          <pre ref={terminalRef} style={{
            margin: 0, padding: '20px', background: '#07070a', color: '#20c20e',
            fontFamily: 'monospace', fontSize: '0.82rem',
            maxHeight: '220px', overflowY: 'auto', lineHeight: '1.5', whiteSpace: 'pre-wrap'
          }}>
            {terminalLogs}
          </pre>
        </div>

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>Memuat detail kampanye...</div>
        ) : (
          /* TABLE VIEW ITEM LIST (EXACT OPC ALIGNMENT: 3 COLUMNS IN HEADER) */
          <div style={{ background: '#121318', border: '1px solid #27272a', borderRadius: '16px', padding: '24px', marginBottom: '32px' }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📋</span> Daftar Video Item ({items.length})
            </div>

            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #27272a', textAlign: 'left', color: '#9ca3af', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ width: '4%', padding: '12px 14px' }}>#</th>
                  <th style={{ width: '40%', padding: '12px 14px' }}>VIDEO ITEM / PILAR</th>
                  <th style={{ width: '38%', padding: '12px 14px' }}>FASE</th>
                  <th style={{ width: '18%', padding: '12px 14px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const isExpanded = expandedItemId === it.id;
                  const currentTab = itemActiveTabs[it.id] || 'concept';

                  return (
                    <Fragment key={it.id}>
                      <tr style={{ borderBottom: '1px solid #27272a', background: isExpanded ? 'rgba(99, 102, 241, 0.04)' : 'transparent' }}>
                        <td style={{ padding: '16px 14px', fontFamily: 'monospace', fontSize: '12px', color: '#a1a1aa' }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: '16px 14px' }}>
                          <div style={{ fontWeight: 700, fontSize: '14px', color: '#fff', marginBottom: '2px' }}>
                            Video Item #{idx + 1}
                          </div>
                          <div style={{ fontSize: '12px', color: '#818cf8', fontWeight: 600 }}>
                            Pilar: {it.pillar}
                          </div>
                          <div style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', marginTop: '2px' }}>
                            Hook: "{it.hook}"
                          </div>
                        </td>
                        <td style={{ padding: '16px 14px' }}>
                          {renderPhaseStatusBadge(it)}
                        </td>
                        <td style={{ padding: '16px 14px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => setExpandedItemId(isExpanded ? null : it.id)}
                            style={{
                              padding: '6px 14px', borderRadius: '6px', border: '1px solid #3f3f46',
                              background: isExpanded ? '#6366f1' : '#27272a', color: '#fff',
                              fontWeight: 700, fontSize: '12px', cursor: 'pointer'
                            }}
                          >
                            {isExpanded ? '📖 Tutup' : '📖 Detail'}
                          </button>
                        </td>
                      </tr>

                      {/* EXPANDED ACCORDION ROW (WORKBENCH CARD FOR THIS ITEM) */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="4" style={{ background: '#09090b', padding: '24px', borderBottom: '1px solid #27272a' }}>
                            
                            {/* Call 1 Trigger Button & Compliance Banner Header */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginBottom: '20px', background: '#18181b', border: '1px solid #27272a', padding: '16px', borderRadius: '12px', gap: '16px' }}>
                              <div>
                                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: 0 }}>
                                  📖 Item #{idx + 1} Workspace — {it.pillar}
                                </h3>
                                <span style={{ fontSize: '12px', color: '#9ca3af' }}>ID: #{it.id} | CEP: {it.category_cep}</span>
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <button
                                  onClick={() => handleCall1Execution(it)}
                                  disabled={executingCall1}
                                  style={{
                                    padding: '8px 20px',
                                    backgroundImage: (it.generation_status === 'completed' || (editScenes && editScenes.length > 0))
                                      ? 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)'
                                      : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                    color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '12px',
                                    boxShadow: '0 2px 10px rgba(99, 102, 241, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '6px'
                                  }}
                                >
                                  {executingCall1
                                    ? '⏳ Generasi 1-Call...'
                                    : (it.generation_status === 'completed' || (editScenes && editScenes.length > 0))
                                      ? '⚡ Re-Generasi Storyboard & Script (Call 1)'
                                      : '🚀 Generasi Storyboard & Script (1-Call)'}
                                </button>
                              </div>

                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.3)', fontWeight: 600 }}>
                                  Fase 1: {it.generation_status === 'completed' ? 'Completed ✓' : (it.generation_status || 'Pending')}
                                </span>
                              </div>
                            </div>

                            {/* Compliance Gate Banner if required */}
                            {it.workflow_status === 'human_review_required' && (
                              <div style={{ background: '#451a03', border: '1px solid #d97706', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                                <div style={{ fontWeight: 800, color: '#fcd34d', fontSize: '13px', marginBottom: '8px' }}>
                                  🟠 Human Review Required: Terdeteksi Risiko Kepatuhan TikTok Shop
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                  <button
                                    onClick={() => handleComplianceOverride(it, 'apply_safe_revisions')}
                                    disabled={handlingOverride}
                                    style={{ padding: '6px 12px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}
                                  >
                                    1. Terapkan Revisi AI
                                  </button>
                                  <button
                                    onClick={() => handleComplianceOverride(it, 'override_approve')}
                                    disabled={handlingOverride}
                                    style={{ padding: '6px 12px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}
                                  >
                                    2. Approve & Override
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* 5-STAGE PIPELINE PROGRESS BAR & MANUAL RETRY CONTROLS */}
                            {renderPipelineProgressBar(it)}

                            {/* 5-TAB NAVIGATION BAR (100% PARITY WITH OPC) */}
                            <div style={{ display: 'flex', borderBottom: '1px solid #27272a', marginBottom: '24px', gap: '8px', overflowX: 'auto' }}>
                              {[
                                { id: 'concept', label: '💡 Tab 1: Konsep Awal & Produk' },
                                { id: 'storyboard', label: '📖 Tab 2: Storyboard & Rencana Visual' },
                                { id: 'dna', label: '🧬 Tab 3: Video DNA' },
                                { id: 'assets', label: '☁️ Tab 4: Aset & Recovery' },
                                { id: 'logs', label: '🖥 Tab 5: System Log' }
                              ].map(tb => (
                                <button
                                  key={tb.id}
                                  onClick={() => setItemActiveTabs(prev => ({ ...prev, [it.id]: tb.id }))}
                                  style={{
                                    padding: '10px 18px',
                                    background: currentTab === tb.id ? '#6366f1' : 'transparent',
                                    color: currentTab === tb.id ? '#fff' : '#9ca3af',
                                    border: 'none',
                                    borderRadius: '6px 6px 0 0',
                                    fontWeight: 700,
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {tb.label}
                                </button>
                              ))}
                            </div>

                            {/* TAB 1: KONSEP AWAL & PRODUK (SELURUH OUTPUT CONTENT PLANNER) */}
                            {currentTab === 'concept' && (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                {/* CARD 1: STRATEGI & CONTENT PLANNER OUTPUT */}
                                <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#818cf8', margin: '0 0 4px 0', borderBottom: '1px solid #27272a', paddingBottom: '8px' }}>
                                    🎯 Output Content Planner
                                  </h4>

                                  <div>
                                    <label style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Pilar Konten Utama</label>
                                    <div style={{ fontSize: '13px', color: '#fff', fontWeight: 700 }}>{it.pillar || '-'}</div>
                                  </div>

                                  <div>
                                    <label style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: '2px' }}>🪝 Hook Pembuka (Klip 1)</label>
                                    <div style={{ fontSize: '12px', color: '#fcd34d', fontStyle: 'italic', background: '#09090b', padding: '10px', borderRadius: '6px', border: '1px solid #27272a' }}>
                                      "{it.hook || '-'}"
                                    </div>
                                  </div>

                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div>
                                      <label style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Sudut Pandang Strategis</label>
                                      <div style={{ fontSize: '12px', color: '#a5b4fc', fontWeight: 600 }}>{it.strategic_angle || '-'}</div>
                                    </div>
                                    <div>
                                      <label style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Category Entry Point (CEP)</label>
                                      <div style={{ fontSize: '12px', color: '#a5b4fc', fontWeight: 600 }}>{it.category_cep || '-'}</div>
                                    </div>
                                  </div>

                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div>
                                      <label style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Matrix Situasi (WS Matrix)</label>
                                      <div style={{ fontSize: '12px', color: '#e5e7eb' }}>{it.ws_matrix || '-'}</div>
                                    </div>
                                    <div>
                                      <label style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Visual Focus Object (VFO)</label>
                                      <div style={{ fontSize: '12px', color: '#e5e7eb' }}>{it.vfo || '-'}</div>
                                    </div>
                                  </div>

                                  <div>
                                    <label style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Konteks Momen Audiens</label>
                                    <div style={{ fontSize: '12px', color: '#d1d5db', background: '#09090b', padding: '8px', borderRadius: '6px' }}>{it.context || '-'}</div>
                                  </div>

                                  <div>
                                    <label style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: '2px' }}>🎬 Visual Aksi Utama</label>
                                    <div style={{ fontSize: '12px', color: '#d1d5db', background: '#09090b', padding: '8px', borderRadius: '6px' }}>{it.visual_action || '-'}</div>
                                  </div>
                                </div>

                                {/* CARD 2: SPESIFIKASI PRODUK */}
                                <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#10b981', margin: '0 0 4px 0', borderBottom: '1px solid #27272a', paddingBottom: '8px' }}>
                                    📦 Informasi & Spesifikasi Produk
                                  </h4>

                                  <div>
                                    <label style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Nama Produk Target</label>
                                    <div style={{ fontSize: '14px', color: '#fff', fontWeight: 800 }}>{campaign?.product_name || '-'}</div>
                                  </div>

                                  <div>
                                    <label style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Deskripsi Produk</label>
                                    <div style={{ fontSize: '12px', color: '#d1d5db', background: '#09090b', padding: '10px', borderRadius: '6px', minHeight: '60px', lineHeight: '1.5' }}>
                                      {campaign?.product_description || '-'}
                                    </div>
                                  </div>

                                  <div>
                                    <label style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: '2px' }}>⚡ Keunggulan Utama (USP Produk)</label>
                                    <div style={{ fontSize: '12px', color: '#a7f3d0', background: '#09090b', padding: '10px', borderRadius: '6px', border: '1px solid #04785740', lineHeight: '1.5' }}>
                                      {campaign?.product_usp || '-'}
                                    </div>
                                  </div>

                                  {campaign?.product_ref_image && (
                                    <div>
                                      <label style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: '6px' }}>🖼️ Foto Studio Referensi Produk</label>
                                      <img src={campaign.product_ref_image} alt="Ref Produk" style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #27272a' }} />
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* TAB 2: STORYBOARD, SOCIAL CAPTIONS & WORKFLOW SETTINGS FASE 2 */}
                            {currentTab === 'storyboard' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                                
                                {/* 1. Grid Preview T2I Start Frame Gallery */}
                                <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '16px' }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginBottom: '12px', gap: '16px' }}>
                                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#818cf8', margin: 0 }}>
                                      🖼️ Grid Preview T2I (Start Frame Gallery)
                                    </h4>

                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                      <button
                                        type="button"
                                        onClick={() => handleTriggerStep(it.id, 'regenerate_start_frames')}
                                        disabled={triggeringSteps[`${it.id}-regenerate_start_frames`]}
                                        style={{
                                          padding: '6px 16px', background: '#6366f1', color: '#fff', border: 'none',
                                          borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                                          boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
                                        }}
                                      >
                                        {triggeringSteps[`${it.id}-regenerate_start_frames`]
                                          ? '⏳ Memproses...'
                                          : editScenes.some(sc => sc.start_frame_path && sc.start_frame_path.trim() !== '')
                                            ? '🖼️ Re-Generate Start Frame (T2I)'
                                            : '✨ Generate Start Frame (T2I)'}
                                      </button>
                                    </div>

                                    <div style={{ textAlign: 'right' }}>
                                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                                        {editScenes.filter(sc => sc.start_frame_path && sc.start_frame_path.trim() !== '').length} / {editScenes.length} Start Frame Ready
                                      </span>
                                    </div>
                                  </div>
                                  {editScenes.length > 0 ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px', marginTop: '10px' }}>
                                      {editScenes.map((sc, scIdx) => (
                                        <div key={sc.id || scIdx} style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)', textAlign: 'center' }}>
                                          <div style={{ fontWeight: '700', fontSize: '0.72rem', color: '#a5b4fc' }}>
                                            Klip #{sc.scene_number}
                                          </div>
                                          <div style={{ width: '100%', height: '180px', position: 'relative', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.01)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {sc.start_frame_path ? (
                                              <img src={sc.start_frame_path} alt={`Klip #${sc.scene_number}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                              <div style={{ color: '#71717a', fontSize: '0.62rem', padding: '5px', textAlign: 'center' }}>
                                                <span>🖼️ Belum Ada Start Frame</span>
                                              </div>
                                            )}
                                          </div>
                                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', width: '100%' }}>
                                            <button
                                              type="button"
                                              onClick={() => handleRegenerateSingleSceneT2I(it.id, sc.scene_number, sc.t2i_prompt)}
                                              disabled={!!regeneratingSingleT2I[`${it.id}-${sc.scene_number}`]}
                                              style={{
                                                flex: 1, padding: '3px 4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                                color: '#fff', borderRadius: '4px', fontSize: '0.62rem', cursor: 'pointer', fontWeight: 600,
                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                                              }}
                                            >
                                              {regeneratingSingleT2I[`${it.id}-${sc.scene_number}`] ? '⏳' : '🔄 Re-Gen'}
                                            </button>
                                            <label style={{ flex: 1, padding: '3px 4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#a5b4fc', borderRadius: '4px', fontSize: '0.62rem', cursor: 'pointer', fontWeight: 600, textAlign: 'center' }}>
                                              📁 Replace
                                              <input
                                                type="file"
                                                accept="image/*"
                                                style={{ display: 'none' }}
                                                onChange={(e) => {
                                                  if (e.target.files && e.target.files[0]) {
                                                    handleUploadStartFrame(sc.scene_number, e.target.files[0]);
                                                  }
                                                }}
                                              />
                                            </label>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '12px' }}>
                                      Belum ada adegan. Klik 🚀 Generasi Storyboard di atas.
                                    </div>
                                  )}
                                </div>

                                {/* 2. Per-Clip Storyboard Cards (Editable + Copy) */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fff', margin: 0 }}>
                                      🎬 Naskah Adegan & Prompts T2I / I2V (Editable)
                                    </h4>
                                    <button
                                      onClick={handleSaveItemEdits}
                                      disabled={savingItem}
                                      style={{ padding: '6px 14px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}
                                    >
                                      {savingItem ? 'Menyimpan...' : '💾 Simpan Perubahan Naskah'}
                                    </button>
                                  </div>

                                  {editScenes.map((sc, scIdx) => (
                                    <div key={sc.id || scIdx} style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '10px', padding: '14px' }}>
                                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#818cf8', marginBottom: '8px' }}>
                                        Klip #{sc.scene_number} ({sc.duration_seconds || 8}s) — {sc.scene_function || 'Beat Adegan'}
                                      </div>
                                      
                                      {/* Voiceover Edit */}
                                      <div style={{ marginBottom: '10px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                          <label style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600 }}>🗣️ Voiceover (VO)</label>
                                          <button onClick={() => handleCopy(sc.voice_over, `vo_${scIdx}`)} style={{ background: 'none', border: 'none', color: '#a5b4fc', fontSize: '10px', cursor: 'pointer' }}>
                                            {copySuccess[`vo_${scIdx}`] ? 'Tersalin ✓' : '📋 Salin'}
                                          </button>
                                        </div>
                                        <textarea
                                          value={sc.voice_over || ''}
                                          onChange={(e) => {
                                            const updated = [...editScenes];
                                            updated[scIdx].voice_over = e.target.value;
                                            setEditScenes(updated);
                                          }}
                                          rows={2}
                                          style={{ width: '100%', background: '#09090b', border: '1px solid #27272a', borderRadius: '6px', color: '#fff', padding: '8px', fontSize: '12px' }}
                                        />
                                      </div>

                                      {/* T2I Prompt Edit */}
                                      <div style={{ marginBottom: '10px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                          <label style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600 }}>🖼️ T2I Prompt (100% English)</label>
                                          <button onClick={() => handleCopy(sc.t2i_prompt, `t2i_${scIdx}`)} style={{ background: 'none', border: 'none', color: '#a5b4fc', fontSize: '10px', cursor: 'pointer' }}>
                                            {copySuccess[`t2i_${scIdx}`] ? 'Tersalin ✓' : '📋 Salin'}
                                          </button>
                                        </div>
                                        <textarea
                                          value={sc.t2i_prompt || ''}
                                          onChange={(e) => {
                                            const updated = [...editScenes];
                                            updated[scIdx].t2i_prompt = e.target.value;
                                            setEditScenes(updated);
                                          }}
                                          rows={2}
                                          style={{ width: '100%', background: '#09090b', border: '1px solid #27272a', borderRadius: '6px', color: '#a7f3d0', fontFamily: 'monospace', padding: '8px', fontSize: '11px' }}
                                        />
                                      </div>

                                      {/* I2V Prompt Edit */}
                                      <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                          <label style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600 }}>🎥 I2V Prompt (Micro-Pacing 100% English)</label>
                                          <button onClick={() => handleCopy(sc.i2v_prompt, `i2v_${scIdx}`)} style={{ background: 'none', border: 'none', color: '#a5b4fc', fontSize: '10px', cursor: 'pointer' }}>
                                            {copySuccess[`i2v_${scIdx}`] ? 'Tersalin ✓' : '📋 Salin'}
                                          </button>
                                        </div>
                                        <textarea
                                          value={sc.i2v_prompt || ''}
                                          onChange={(e) => {
                                            const updated = [...editScenes];
                                            updated[scIdx].i2v_prompt = e.target.value;
                                            setEditScenes(updated);
                                          }}
                                          rows={2}
                                          style={{ width: '100%', background: '#09090b', border: '1px solid #27272a', borderRadius: '6px', color: '#cbd5e1', fontFamily: 'monospace', padding: '8px', fontSize: '11px' }}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {/* 3. Social Captions & Distribution Package */}
                                <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #27272a', paddingBottom: '10px' }}>
                                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#f59e0b', margin: 0 }}>
                                      📢 Social Captions & Distribution Package
                                    </h4>
                                    <button
                                      onClick={handleSaveItemEdits}
                                      disabled={savingItem}
                                      style={{ padding: '6px 14px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}
                                    >
                                      {savingItem ? 'Menyimpan...' : '💾 Simpan Perubahan Captions'}
                                    </button>
                                  </div>

                                  <div>
                                    <label style={{ display: 'block', fontSize: '11px', color: '#818cf8', fontWeight: 700, marginBottom: '6px' }}>🎯 Strategi Pemasaran / Marketing Angle</label>
                                    <input
                                      type="text"
                                      value={editSocialPkg.marketing_angle || ''}
                                      onChange={(e) => setEditSocialPkg(prev => ({ ...prev, marketing_angle: e.target.value }))}
                                      style={{ width: '100%', background: '#09090b', border: '1px solid #27272a', color: '#fff', padding: '8px', borderRadius: '6px', fontSize: '12px' }}
                                    />
                                  </div>

                                  <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                      <label style={{ fontSize: '12px', color: '#fff', fontWeight: 700 }}>🎵 Posting Caption</label>
                                      <button onClick={() => handleCopy(`${editSocialPkg.caption}\n\n${Array.isArray(editSocialPkg.hashtags) ? editSocialPkg.hashtags.join(' ') : editSocialPkg.hashtags}`, 'soc_cap')} style={{ padding: '3px 8px', background: '#27272a', border: 'none', color: '#a5b4fc', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 700 }}>
                                        {copySuccess['soc_cap'] ? 'Tersalin ✓' : '📋 Salin Caption + Hashtags'}
                                      </button>
                                    </div>
                                    <textarea
                                      value={editSocialPkg.caption || ''}
                                      onChange={(e) => setEditSocialPkg(prev => ({ ...prev, caption: e.target.value }))}
                                      rows={4}
                                      style={{ width: '100%', background: '#09090b', border: '1px solid #27272a', color: '#e5e7eb', padding: '10px', borderRadius: '6px', fontSize: '12px', lineHeight: '1.6' }}
                                    />
                                  </div>

                                  <div>
                                    <label style={{ display: 'block', fontSize: '11px', color: '#f59e0b', fontWeight: 700, marginBottom: '6px' }}>👉 Call To Action (CTA)</label>
                                    <input
                                      type="text"
                                      value={editSocialPkg.call_to_action || ''}
                                      onChange={(e) => setEditSocialPkg(prev => ({ ...prev, call_to_action: e.target.value }))}
                                      style={{ width: '100%', background: '#09090b', border: '1px solid #27272a', color: '#fff', padding: '8px', borderRadius: '6px', fontSize: '12px' }}
                                    />
                                  </div>
                                </div>

                                {/* 4. Workflow & Production Settings (Fase 2) - PALING BAWAH (OPC PARITY) */}
                                <div style={{ background: '#18181b', border: '1px solid #6366f140', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                  <div style={{ fontWeight: '700', fontSize: '14px', color: '#818cf8', borderBottom: '1px solid #27272a', paddingBottom: '10px' }}>
                                    ⚙️ Workflow & Production Settings (Fase 2)
                                  </div>

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {/* 1. TTS Section */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
                                        <input
                                          type="checkbox"
                                          checked={!!settings.enable_tts}
                                          onChange={() => setSettings(prev => ({ ...prev, enable_tts: !prev.enable_tts }))}
                                        />
                                        Generate TTS (Audio Voiceover)
                                      </label>
                                      {settings.enable_tts && (
                                        <div style={{ background: '#09090b', border: '1px solid #27272a', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                          <div>
                                            <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginBottom: '6px', fontWeight: 600 }}>Voice Provider</label>
                                            <select
                                              value={settings.voice_provider || 'minimax'}
                                              onChange={(e) => {
                                                const prov = e.target.value;
                                                setSettings(prev => ({
                                                  ...prev,
                                                  voice_provider: prov,
                                                  voice_persona: prov === 'gemini' ? 'Kore' : 'Indonesian_casual_reporter_vv2'
                                                }));
                                              }}
                                              style={{ width: '100%', padding: '8px 10px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '6px', fontSize: '12px' }}
                                            >
                                              <option value="gemini">Google Gemini TTS</option>
                                              <option value="minimax">MiniMax Speech</option>
                                            </select>
                                          </div>

                                          <div>
                                            <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginBottom: '6px', fontWeight: 600 }}>Voice Persona</label>
                                            <select
                                              value={settings.voice_persona || 'Indonesian_casual_reporter_vv2'}
                                              onChange={(e) => setSettings(prev => ({ ...prev, voice_persona: e.target.value }))}
                                              style={{ width: '100%', padding: '8px 10px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '6px', fontSize: '12px' }}
                                            >
                                              {settings.voice_provider === 'gemini' ? (
                                                GEMINI_VOICES.map(v => <option key={v.id} value={v.id}>{v.avatar} {v.name} - {v.desc}</option>)
                                              ) : (
                                                (campaign?.target_language === 'en-US' ? MINIMAX_ENGLISH_VOICES : MINIMAX_VOICES).map(v => <option key={v.id} value={v.id}>{v.avatar} {v.name} - {v.desc}</option>)
                                              )}
                                            </select>
                                          </div>

                                          <div style={{ display: 'flex', gap: '16px' }}>
                                            <div style={{ flex: 1 }}>
                                              <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginBottom: '4px', fontWeight: 600 }}>Speed ({settings.voice_speed || 1.0}x)</label>
                                              <input type="range" min="0.5" max="2.0" step="0.1" value={settings.voice_speed || 1.0} onChange={(e) => setSettings(prev => ({ ...prev, voice_speed: Number(e.target.value) }))} style={{ width: '100%' }} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                              <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginBottom: '4px', fontWeight: 600 }}>Volume ({settings.voice_volume || 1.0}x)</label>
                                              <input type="range" min="0.0" max="2.0" step="0.1" value={settings.voice_volume || 1.0} onChange={(e) => setSettings(prev => ({ ...prev, voice_volume: Number(e.target.value) }))} style={{ width: '100%' }} />
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {/* 2. G-Labs Section */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
                                        <input
                                          type="checkbox"
                                          checked={!!settings.enable_glabs}
                                          onChange={() => setSettings(prev => ({ ...prev, enable_glabs: !prev.enable_glabs }))}
                                        />
                                        Generate Video (G-Labs AI Video)
                                      </label>
                                      {settings.enable_glabs && (
                                        <div style={{ background: '#09090b', border: '1px solid #27272a', borderRadius: '8px', padding: '12px 14px', fontSize: '11px', color: '#9ca3af', lineHeight: 1.4 }}>
                                          ℹ️ Menggunakan model video kustom Veo/Kling via Webhook. Klip adegan yang memiliki Start Frame akan diproses dengan I2V (Image-to-Video).
                                        </div>
                                      )}
                                    </div>

                                    {/* 3. FFmpeg Section */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
                                        <input
                                          type="checkbox"
                                          checked={!!settings.enable_ffmpeg}
                                          onChange={() => setSettings(prev => ({ ...prev, enable_ffmpeg: !prev.enable_ffmpeg }))}
                                        />
                                        FFmpeg Muxing & Compiling
                                      </label>
                                      {settings.enable_ffmpeg && (
                                        <div style={{ background: '#09090b', border: '1px solid #27272a', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                          <div>
                                            <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginBottom: '6px', fontWeight: 600 }}>Sync Option</label>
                                            <select
                                              value={settings.ffmpeg_sync_option || 'smart_sync'}
                                              onChange={(e) => setSettings(prev => ({ ...prev, ffmpeg_sync_option: e.target.value }))}
                                              style={{ width: '100%', padding: '8px 10px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '6px', fontSize: '12px' }}
                                            >
                                              <option value="smart_sync">Auto-Pilot Smart Sync</option>
                                              <option value="shortest">Shortest Clip</option>
                                            </select>
                                          </div>

                                          <div>
                                            <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginBottom: '4px', fontWeight: 600 }}>Video Scale Zoom ({settings.ffmpeg_video_scale || 1.0}x)</label>
                                            <input type="range" min="0.5" max="2.0" step="0.05" value={settings.ffmpeg_video_scale || 1.0} onChange={(e) => setSettings(prev => ({ ...prev, ffmpeg_video_scale: Number(e.target.value) }))} style={{ width: '100%' }} />
                                          </div>

                                          <div style={{ display: 'flex', gap: '16px' }}>
                                            <div style={{ flex: 1 }}>
                                              <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginBottom: '4px', fontWeight: 600 }}>SFX Vol ({settings.ffmpeg_sfx_volume !== undefined ? settings.ffmpeg_sfx_volume : 0.0}x)</label>
                                              <input type="range" min="0.0" max="2.0" step="0.05" value={settings.ffmpeg_sfx_volume !== undefined ? settings.ffmpeg_sfx_volume : 0.0} onChange={(e) => setSettings(prev => ({ ...prev, ffmpeg_sfx_volume: Number(e.target.value) }))} style={{ width: '100%' }} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                              <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginBottom: '4px', fontWeight: 600 }}>BGM Vol ({settings.ffmpeg_bgm_volume !== undefined ? settings.ffmpeg_bgm_volume : 0.0}x)</label>
                                              <input type="range" min="0.0" max="1.0" step="0.05" value={settings.ffmpeg_bgm_volume !== undefined ? settings.ffmpeg_bgm_volume : 0.0} onChange={(e) => setSettings(prev => ({ ...prev, ffmpeg_bgm_volume: Number(e.target.value) }))} style={{ width: '100%' }} />
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                                    <button
                                      type="button"
                                      onClick={handleSaveWorkflowSettings}
                                      style={{ padding: '9px 18px', background: '#27272a', border: '1px solid #3f3f46', color: '#fff', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}
                                    >
                                      💾 Simpan Perubahan
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleApproveAndProceedItem(it)}
                                      disabled={!!approvingItems[it.id]}
                                      style={{ padding: '9px 20px', backgroundImage: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: approvingItems[it.id] ? 'not-allowed' : 'pointer', fontSize: '12px', opacity: approvingItems[it.id] ? 0.7 : 1 }}
                                    >
                                      {approvingItems[it.id] ? '⏳ Memproses...' : '🚀 Approve & Proceed (Jalankan Fase 2)'}
                                    </button>
                                  </div>
                                </div>

                              </div>
                            )}

                            {/* TAB 3: VIDEO DNA (EXACT OPC PARITY) */}
                            {currentTab === 'dna' && (() => {
                              if (!it.video_dna_json) {
                                return (
                                  <div style={{ background: '#18181b', border: '1px dashed #3f3f46', padding: '28px', borderRadius: '12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '32px', marginBottom: '10px' }}>🧬</div>
                                    <h4 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '14px', fontWeight: 700 }}>
                                      Video DNA Belum Dihasilkan
                                    </h4>
                                    <p style={{ margin: '0 auto', fontSize: '12px', color: '#9ca3af', maxWidth: '480px', lineHeight: '1.5' }}>
                                      Data 10 parameter Video DNA (tipe hook, gaya visual, emosi utama, signature moment, dll.) akan diekstrak secara otomatis oleh Gemini AI saat Anda menjalankan <strong>Eksekusi Storyboard Call 1</strong>.
                                    </p>
                                  </div>
                                );
                              }

                              let dnaObj = {};
                              try {
                                dnaObj = JSON.parse(it.video_dna_json);
                              } catch (_) {}
                              const dnaItems = [
                                { label: '1. Kategori Pilar Konten', val: dnaObj.pilar_konten || it.pillar || '-' },
                                { label: '2. Tipe Hook Pembuka', val: dnaObj.hook_type || '-' },
                                { label: '3. Gaya Visual Presentasi', val: dnaObj.visual_style || '-' },
                                { label: '4. Signature Moment (ASMR)', val: dnaObj.signature_moment || '-' },
                                { label: '5. Camera Pacing', val: dnaObj.camera_pace || '-' },
                                { label: '6. Emosi Utama', val: dnaObj.primary_emotion || '-' },
                                { label: '7. Integrasi Penempatan Produk', val: dnaObj.affiliate_integration || '-' },
                                { label: '8. Penyorotan Produk', val: dnaObj.affiliate_mention || '-' },
                                { label: '9. Jumlah Klip/Adegan', val: dnaObj.scene_count ? `${dnaObj.scene_count} Klip` : '-' },
                                { label: '10. Jenis CTA Penutup', val: dnaObj.cta_type || '-' }
                              ];
                              return (
                                <div style={{ background: '#18181b', border: '1px solid #27272a', padding: '20px', borderRadius: '12px' }}>
                                  <h4 style={{ margin: '0 0 20px 0', fontWeight: '700', fontSize: '14px', color: '#fff' }}>
                                    🧬 Video DNA & Narasi Metrik (Strategic Campaign - AI Generated)
                                  </h4>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                                    {dnaItems.map((d, dIdx) => (
                                      <div key={dIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: '#09090b', padding: '12px', borderRadius: '8px', border: '1px solid #27272a' }}>
                                        <label style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600 }}>{d.label}</label>
                                        <div style={{ fontSize: '12px', color: '#818cf8', fontWeight: 700 }}>{d.val}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* TAB 4: ASET & RECOVERY (EXACT OPC PARITY) */}
                            {currentTab === 'assets' && (
                              <div style={{ background: '#18181b', border: '1px solid #27272a', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #27272a', paddingBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                                  <div>
                                    <h4 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '14px', fontWeight: 700 }}>☁️ Asset Vault & Cloud Recovery Panel</h4>
                                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                                      Kelola aset lokal (T2I, I2V, TTS, MD) dan sinkronisasi cloud storage.
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    {it.drive_link && (
                                      <a
                                        href={it.drive_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ fontSize: '12px', padding: '8px 14px', fontWeight: 600, background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)', color: '#60a5fa', borderRadius: '6px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                      >
                                        🔗 Buka Folder Cloud
                                      </a>
                                    )}
                                    <button
                                      onClick={() => handleSyncItemAssets(it)}
                                      disabled={syncingItemAssets[it.id]}
                                      style={{ fontSize: '12px', padding: '8px 16px', fontWeight: 700, background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', opacity: syncingItemAssets[it.id] ? 0.6 : 1 }}
                                    >
                                      {syncingItemAssets[it.id] ? '⏳ Syncing...' : '📤 Sync Assets to Cloud'}
                                    </button>
                                    <button
                                      onClick={() => handleSyncItemToContentFlow(it)}
                                      disabled={syncingContentFlow[it.id]}
                                      style={{ fontSize: '12px', padding: '8px 16px', fontWeight: 700, background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', opacity: syncingContentFlow[it.id] ? 0.6 : 1 }}
                                    >
                                      {syncingContentFlow[it.id] ? '⏳ Syncing...' : '🌐 Sync ke Content Flow'}
                                    </button>
                                  </div>
                                </div>

                                <div>
                                  <h5 style={{ margin: '0 0 12px 0', color: '#818cf8', fontSize: '13px', fontWeight: 700 }}>
                                    🎬 Status Aset per Klip & Pemulihan Granular
                                  </h5>
                                  <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                                      <thead>
                                        <tr style={{ borderBottom: '1px solid #27272a', color: '#9ca3af' }}>
                                          <th style={{ padding: '8px' }}>Klip</th>
                                          <th style={{ padding: '8px' }}>🖼️ Start Frame (T2I)</th>
                                          <th style={{ padding: '8px' }}>🎥 Motion Video (I2V)</th>
                                          <th style={{ padding: '8px' }}>🎵 Voiceover (TTS)</th>
                                          <th style={{ padding: '8px', textAlign: 'right' }}>Status Aset</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {editScenes.map((sc, scIdx) => {
                                          const hasStartFrame = sc.start_frame_path && sc.start_frame_path.trim() !== '';
                                          const hasVideo = (sc.local_clip_path && sc.local_clip_path.trim() !== '') || (sc.video_path && sc.video_path.trim() !== '');
                                          const hasAudio = (sc.voice_over_audio_path && sc.voice_over_audio_path.trim() !== '') || (sc.audio_path && sc.audio_path.trim() !== '');

                                          return (
                                            <tr key={scIdx} style={{ borderBottom: '1px solid #27272a' }}>
                                              <td style={{ padding: '8px', fontWeight: 700, color: '#fff' }}>Klip #{sc.scene_number || (scIdx + 1)}</td>
                                              <td style={{ padding: '8px', color: hasStartFrame ? '#10b981' : '#f59e0b' }}>
                                                {hasStartFrame ? 'Ready ✓' : 'Pending'}
                                              </td>
                                              <td style={{ padding: '8px', color: hasVideo ? '#10b981' : '#9ca3af' }}>
                                                {hasVideo ? 'Ready ✓' : 'Pending (Fase 2)'}
                                              </td>
                                              <td style={{ padding: '8px', color: hasAudio ? '#10b981' : '#9ca3af' }}>
                                                {hasAudio ? 'Ready ✓' : 'Pending (Fase 2)'}
                                              </td>
                                              <td style={{ padding: '8px', textAlign: 'right', color: (hasStartFrame && hasVideo && hasAudio) ? '#10b981' : '#a5b4fc', fontWeight: 600 }}>
                                                {(hasStartFrame && hasVideo && hasAudio) ? 'OK ✓' : 'Partial'}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* TAB 5: SYSTEM LOG (EXACT OPC PARITY) */}
                            {currentTab === 'logs' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {/* SECTION 1: DETAIL TEKNIS PIPELINE & VARIABEL */}
                                <div style={{ background: '#18181b', border: '1px solid #27272a', padding: '20px', borderRadius: '12px' }}>
                                  <h4 style={{ margin: '0 0 12px 0', color: '#fff', fontSize: '14px', fontWeight: 700 }}>
                                    ⚙️ Detail Teknis Pipeline & Variabel
                                  </h4>
                                  <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                                      <tbody>
                                        <tr style={{ borderBottom: '1px solid #27272a' }}>
                                          <td style={{ padding: '8px', color: '#9ca3af', width: '220px' }}>ID Item</td>
                                          <td style={{ padding: '8px', fontWeight: 700, color: '#fff' }}>#{it.id}</td>
                                        </tr>
                                        <tr style={{ borderBottom: '1px solid #27272a' }}>
                                          <td style={{ padding: '8px', color: '#9ca3af' }}>Voiceover Provider & Persona</td>
                                          <td style={{ padding: '8px', color: '#e4e4e7' }}>{settings.voice_provider || 'minimax'} ({settings.voice_persona || 'Default'})</td>
                                        </tr>
                                        <tr style={{ borderBottom: '1px solid #27272a' }}>
                                          <td style={{ padding: '8px', color: '#9ca3af' }}>Video Model AI & Rasio</td>
                                          <td style={{ padding: '8px', color: '#e4e4e7' }}>{settings.video_model || campaign?.video_model || 'veo_31_lite'} ({campaign?.aspect_ratio || '9:16'})</td>
                                        </tr>
                                        <tr style={{ borderBottom: '1px solid #27272a' }}>
                                          <td style={{ padding: '8px', color: '#9ca3af' }}>FFmpeg Sync Option & Scale</td>
                                          <td style={{ padding: '8px', color: '#e4e4e7' }}>{settings.ffmpeg_sync_option || 'smart_sync'} (Scale: {settings.ffmpeg_video_scale || 1.0}x)</td>
                                        </tr>
                                        <tr style={{ borderBottom: '1px solid #27272a' }}>
                                          <td style={{ padding: '8px', color: '#9ca3af' }}>Cloud Upload Status</td>
                                          <td style={{ padding: '8px' }}>
                                            <span style={{
                                              padding: '4px 8px',
                                              borderRadius: '4px',
                                              fontSize: '11px',
                                              fontWeight: 700,
                                              background: it.upload_status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                              color: it.upload_status === 'completed' ? '#10b981' : '#9ca3af',
                                              border: it.upload_status === 'completed' ? '1px solid #10b981' : '1px solid #3f3f46'
                                            }}>
                                              {it.upload_status || 'pending'}
                                            </span>
                                          </td>
                                        </tr>
                                        <tr>
                                          <td style={{ padding: '8px', color: '#9ca3af' }}>Cloud Storage Folder Link</td>
                                          <td style={{ padding: '8px' }}>
                                            {it.drive_link ? (
                                              <a href={it.drive_link} target="_blank" rel="noreferrer" style={{ color: '#60a5fa', textDecoration: 'underline', fontWeight: 600 }}>
                                                Buka Cloud Folder ➔
                                              </a>
                                            ) : <span style={{ color: '#71717a' }}>(Belum diunggah)</span>}
                                          </td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                                {/* SECTION 2: ANTREAN VIDEO TASK (G-LABS TASKS) */}
                                <div style={{ background: '#18181b', border: '1px solid #27272a', padding: '20px', borderRadius: '12px' }}>
                                  <h4 style={{ margin: '0 0 12px 0', color: '#818cf8', fontSize: '13px', fontWeight: 700 }}>
                                    🎥 Antrean Video Task (G-Labs Tasks per Adegan)
                                  </h4>
                                  <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                                      <thead>
                                        <tr style={{ borderBottom: '1px solid #27272a', color: '#9ca3af' }}>
                                          <th style={{ padding: '8px' }}>Adegan</th>
                                          <th style={{ padding: '8px' }}>Task ID G-Labs</th>
                                          <th style={{ padding: '8px' }}>Snippet Prompt I2V</th>
                                          <th style={{ padding: '8px', textAlign: 'right' }}>Status Visual</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {editScenes.map((sc, scIdx) => {
                                          const pText = sc.i2v_prompt || sc.visual_action || sc.t2i_prompt || '-';
                                          const hasVideo = sc.local_clip_path && sc.local_clip_path.trim() !== '';

                                          return (
                                            <tr key={scIdx} style={{ borderBottom: '1px solid #27272a' }}>
                                              <td style={{ padding: '8px', fontWeight: 700, color: '#fff' }}>Klip #{sc.scene_number || (scIdx + 1)}</td>
                                              <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '11px', color: sc.task_id ? '#a5b4fc' : '#71717a' }}>
                                                {sc.task_id || '(Belum disubmit)'}
                                              </td>
                                              <td style={{ padding: '8px', color: '#9ca3af', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {pText}
                                              </td>
                                              <td style={{ padding: '8px', textAlign: 'right' }}>
                                                <span style={{
                                                  padding: '3px 8px',
                                                  borderRadius: '4px',
                                                  fontSize: '11px',
                                                  fontWeight: 700,
                                                  background: hasVideo ? 'rgba(16, 185, 129, 0.15)' : sc.task_id ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                                                  color: hasVideo ? '#10b981' : sc.task_id ? '#3b82f6' : '#9ca3af',
                                                  border: hasVideo ? '1px solid #10b981' : sc.task_id ? '1px solid #3b82f6' : '1px solid #3f3f46'
                                                }}>
                                                  {hasVideo ? 'Completed ✓' : sc.task_id ? 'Processing ⏳' : 'Pending'}
                                                </span>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                                {/* SECTION 3: LIVE LOG AKTIVITAS CONSOLE */}
                                <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '16px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#a5b4fc', margin: 0 }}>
                                      🖥 Live Log Aktivitas Real-Time Item #{it.id}
                                    </h4>
                                    <button
                                      onClick={() => fetchItemLogs(it.id)}
                                      disabled={fetchingLogs[it.id]}
                                      style={{ fontSize: '11px', padding: '4px 10px', background: '#27272a', border: '1px solid #3f3f46', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                      {fetchingLogs[it.id] ? '⏳ Memuat Log...' : '🔄 Refresh Log'}
                                    </button>
                                  </div>
                                  <div style={{ background: '#09090b', padding: '12px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '11px', color: '#10b981', maxHeight: '220px', overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                                    {liveLogs[it.id] || '[SYSTEM] Klik tombol Refresh Log di atas untuk memuat histori log aktivitas.'}
                                  </div>
                                </div>
                              </div>
                            )}

                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
