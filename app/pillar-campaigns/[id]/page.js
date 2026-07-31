'use client';

import Sidebar from '../../components/Sidebar';
import Link from 'next/link';
import { useEffect, useState, Fragment } from 'react';
import { useParams } from 'next/navigation';

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

const isJsonError = (val) => {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('{\\"')) {
    try {
      let normalized = trimmed;
      if (trimmed.startsWith('{\\"')) {
        normalized = trimmed.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }
      JSON.parse(normalized);
      return false;
    } catch (e) {
      return true;
    }
  }
  return false;
};

const getFormattedPrompt = (val) => {
  if (typeof val !== 'string') return val;
  const trimmed = val.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('{\\"')) {
    try {
      let normalized = trimmed;
      if (trimmed.startsWith('{\\"')) {
        normalized = trimmed.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }
      return JSON.stringify(JSON.parse(normalized), null, 2);
    } catch (e) {
      return val;
    }
  }
  return val;
};

const getDemographicLabel = (demographic, custom) => {
  if (demographic === 'custom') return custom || 'Custom';
  if (demographic === 'genz_casual') return 'Gen Z (Casual / Slang)';
  if (demographic === 'millennial_professional') return 'Millennial (Professional / Formal)';
  if (demographic === 'parent_warm') return 'Parents / Warm & Caring';
  return demographic || 'Generik / Kasual';
};


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

const hookTypeOptions = ["Pertanyaan", "Mitos", "Hasil Akhir", "Visual Shock", "Curiosity", "Problem/Solution", "Statement"];
const visualStyleOptions = ["Faceless", "Macro", "Food Porn", "Cinematic", "Lifestyle", "Studio/Unboxing"];
const cameraPaceOptions = ["Static", "Dynamic Tracking", "Fast Cuts", "Slow Dolly", "Panning"];
const emotionOptions = ["Menggugah Selera", "Segar", "Santai", "Kagum", "Penasaran", "Surprise"];
const affiliateIntegrationOptions = ["Natural Usage", "Background", "Problem Solver", "None"];
const affiliateMentionOptions = ["Voice Over", "Visual Only", "Both", "None"];
const ctaTypeOptions = ["Save Recipe", "Share to Friend", "Buy Now", "Link in Bio", "Comment for Link"];

export default function PillarCampaignDetailPage() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [voiceCast, setVoiceCast] = useState([]);
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState({});
  const [toast, setToast] = useState(null);
  const [copySuccess, setCopySuccess] = useState({});
  const [storageProvider, setStorageProvider] = useState('gdrive');
  const [nextcloudUrl, setNextcloudUrl] = useState('');

  // Active tab per item
  const [activeTabs, setActiveTabs] = useState({}); // { [itemId]: 'storyboard' | 'prompts' | 'social' | 'logs' }
  const [expandedItemId, setExpandedItemId] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Workbench V2 states
  const [editedVideoPlans, setEditedVideoPlans] = useState({});
  const [editedVideoDnas, setEditedVideoDnas] = useState({});
  const [socialCaptions, setSocialCaptions] = useState({});
  const [workflowSettings, setWorkflowSettings] = useState({});
  const [regeneratingT2I, setRegeneratingT2I] = useState({});
  const [replacingSF, setReplacingSF] = useState({});
  const [approvingItems, setApprovingItems] = useState({});
  const [savingDraft, setSavingDraft] = useState({});
  const [recompressingItems, setRecompressingItems] = useState({});
  const [batchRegeneratingSF, setBatchRegeneratingSF] = useState({});
  const [selectedVoVersions, setSelectedVoVersions] = useState({}); // { [itemId]: 'original' | 'safe' }
  const [syncingItemAssets, setSyncingItemAssets] = useState({});
  const [cacheBuster, setCacheBuster] = useState(Date.now());

  // Accordion Clip state
  const [activeClipIndex, setActiveClipIndex] = useState({});
  const toggleClip = (itemId, idx) => {
    setActiveClipIndex(prev => {
      const currentActive = prev[itemId] !== undefined ? prev[itemId] : 0;
      return {
        ...prev,
        [itemId]: currentActive === idx ? -1 : idx
      };
    });
  };

  // Self-Healing UI States
  const [editingItemId, setEditingItemId] = useState(null);
  const [editForm, setEditForm] = useState({
    content_pillar: '',
    custom_hook: '',
    visual_action_guideline: '',
    product_name: '',
    product_desc: '',
    product_usp: '',
    source_product_url: '',
    product_image_file: null,
    product_ref_image_path: '',
    reset_status: true
  });
  const [savingEdit, setSavingEdit] = useState(false);

  async function handleSaveCreative(itemId) {
    setSavingEdit(true);
    try {
      const formData = new FormData();
      formData.append('content_pillar', editForm.content_pillar);
      formData.append('custom_hook', editForm.custom_hook);
      formData.append('visual_action_guideline', editForm.visual_action_guideline);
      formData.append('product_name', editForm.product_name);
      formData.append('product_desc', editForm.product_desc);
      formData.append('product_usp', editForm.product_usp);
      formData.append('source_product_url', editForm.source_product_url);
      formData.append('reset_status', editForm.reset_status ? 'true' : 'false');
      
      if (editForm.product_image_file) {
        formData.append('product_image_file', editForm.product_image_file);
      }

      const res = await fetch(`/api/v2/pillar-campaigns/items/${itemId}/update-creative`, {
        method: 'PATCH',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan perubahan');

      showToast(data.message || 'Perubahan berhasil disimpan!');
      setEditingItemId(null);
      fetchDetail();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingEdit(false);
    }
  }

  useEffect(() => {
    fetchDetail();
    const interval = setInterval(fetchDetail, 5000); // Poll status every 5 seconds
    return () => clearInterval(interval);
  }, [id]);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function fetchDetail() {
    try {
      const res = await fetch(`/api/v2/pillar-campaigns/${id}`);
      if (!res.ok) throw new Error('Gagal memuat detail kampanye');
      const data = await res.json();
      setCampaign(data.campaign);
      try {
        const parsed = data.campaign.voice_cast_json
          ? JSON.parse(data.campaign.voice_cast_json)?.characters || []
          : [];
        setVoiceCast(parsed);
      } catch (e) {
        setVoiceCast([]);
      }
      setItems(data.items || []);
      setStats(data.stats);
      setStorageProvider(data.storage_provider || 'gdrive');
      setNextcloudUrl(data.nextcloud_url || '');

      // Initialize tab values for items
      setActiveTabs(prevTabs => {
        const nextTabs = { ...prevTabs };
        (data.items || []).forEach(item => {
          if (!nextTabs[item.id]) {
            nextTabs[item.id] = 'concept';
          }
        });
        return nextTabs;
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSyncContentFlow() {
    try {
      setSyncing(true);
      showToast('Mengirim data kampanye ke Content Flow API...');
      const res = await fetch(`/api/v2/pillar-campaigns/${id}/sync-contentflow`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(`Berhasil sinkronisasi ${data.synced_count} item ke Content Flow Web App! 🚀`);
        fetchDetail();
      } else {
        showToast('Gagal sinkronisasi Content Flow: ' + data.error, 'error');
      }
    } catch (e) {
      showToast('Error sync: ' + e.message, 'error');
    } finally {
      setSyncing(false);
    }
  }

  async function toggleStatus() {
    if (!campaign) return;
    const nextStatus = campaign.status === 'running' ? 'paused' : 'running';
    try {
      const res = await fetch(`/api/v2/pillar-campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error('Gagal update status');
      showToast(`Campaign ${nextStatus === 'running' ? 'dilanjutkan' : 'dijeda'}.`);
      fetchDetail();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
  async function updateCampaignSettings(fields) {
    try {
      const res = await fetch(`/api/v2/pillar-campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      });
      if (!res.ok) throw new Error('Gagal memperbarui pengaturan kampanye');
      fetchDetail();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  const MINIMAX_VOICES = [
    { id: 'Indonesian_energetic_streamer_vv2', name: '⚡ Energetic Streamer (Male)', avatar: '😊' },
    { id: 'Indonesian_crisp_reporter_vv2', name: '🎙 Crisp Reporter (Female)', avatar: '🎙' },
    { id: 'Indonesian_professional_anchor_vv2', name: '📺 Professional Anchor (Female)', avatar: '📺' },
    { id: 'Indonesian_casual_reporter_vv2', name: '😊 Casual Reporter (Male)', avatar: '😊' },
    { id: 'Indonesian_intellectual_commentator_vv2', name: '🧠 Intellectual Commentator (Female)', avatar: '🧠' },
    { id: 'Indonesian_compelling_storyteller_vv2', name: '📖 Compelling Storyteller (Male)', avatar: '📖' },
    { id: 'Indonesian_expressive_podcaster_vv2', name: '🎤 Expressive Podcaster (Male)', avatar: '🎤' }
  ];

  const MINIMAX_ENGLISH_VOICES = [
    { id: 'male-rad-presenter', name: 'Male Rad Presenter', avatar: '🧔' },
    { id: 'female-active-presenter', name: 'Female Active Presenter', avatar: '👩' },
    { id: 'male-crisp-presenter', name: 'Male Crisp Presenter', avatar: '🧔' },
    { id: 'female-casual-presenter', name: 'Female Casual Presenter', avatar: '👩' }
  ];

  const handleSaveVoiceCast = async () => {
    await updateCampaignSettings({
      voice_cast_json: JSON.stringify({ characters: voiceCast })
    });
    showToast('Voice Cast berhasil disimpan!');
  };
  async function triggerManualStep(itemId, step) {
    if (!confirm(`Apakah Anda yakin ingin memicu proses ${step.toUpperCase()} secara manual?`)) return;
    setTriggering(prev => ({ ...prev, [`${itemId}-${step}`]: true }));
    try {
      const res = await fetch(`/api/v2/pillar-campaigns/items/${itemId}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        fetchDetail();
      } else {
        showToast(data.error || 'Gagal memicu langkah', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setTriggering(prev => {
        const next = { ...prev };
        delete next[`${itemId}-${step}`];
        return next;
      });
    }
  }

  const handleCopy = (text, key) => {
    writeToClipboard(text);
    setCopySuccess(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopySuccess(prev => ({ ...prev, [key]: false }));
    }, 2000);
  };

  function generateClientMarkdown() {
    const lines = [];
    lines.push(`# Campaign Batch: ${campaign.campaign_name}`);
    lines.push(`- **Campaign ID (Batch ID):** \`${campaign.id}\``);
    lines.push(`- **Status:** ${campaign.status}`);

    lines.push(`- **Aspect Ratio:** ${campaign.aspect_ratio || '9:16'}`);
    lines.push(`- **Target AI:** ${campaign.target_ai || 'Google Veo (8s)'}`);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(`## 📋 Daftar Video Items (${items.length})`);
    items.forEach((item, idx) => {
      let payload = {};
      try {
        payload = item.row_creative_payload ? JSON.parse(item.row_creative_payload) : {};
      } catch (_) {}
      const productInfo = payload.product_name ? `${payload.product_name} (${payload.source_product_url || 'manual'})` : 'N/A';
      lines.push(`${idx + 1}. **Video #${idx + 1}**: Pillar: "${payload.content_pillar || '-'}" | Hook: "${payload.custom_hook || '-'}" | Product: ${productInfo}`);
    });
    lines.push('');

    items.forEach((item, idx) => {
      lines.push('---');
      lines.push('');
      lines.push(`## 🔗 Video #${idx + 1}`);
      let payload = {};
      try {
        payload = item.row_creative_payload ? JSON.parse(item.row_creative_payload) : {};
      } catch (_) {}
      lines.push(`- **Pilar Konten:** ${payload.content_pillar || '-'}`);
      lines.push(`- **Hook:** ${payload.custom_hook || '-'}`);
      lines.push(`- **Aksi Visual (Macro):** ${payload.visual_action_guideline || '-'}`);
      lines.push(`- **URL Produk:** ${payload.source_product_url || '-'}`);
      lines.push(`- **Nama Produk:** ${payload.product_name || '-'}`);
      lines.push(`- **Deskripsi Produk:** ${payload.product_desc || '-'}`);
      lines.push(`- **USP Produk:** ${payload.product_usp || '-'}`);
      lines.push(`- **Status Pemrosesan:** ${item.generation_status || 'pending'}`);
      if (item.drive_link) {
        lines.push(`- **Folder Drive:** [Buka Google Drive](${item.drive_link})`);
      }
      lines.push('');

      if (item.generation_status !== 'completed') {
        lines.push(`> *Item belum selesai di-generate. Status: ${item.generation_status}*`);
        lines.push('');
        return;
      }

      let parsed = {};
      if (item.result_json) {
        try {
          parsed = JSON.parse(item.result_json);
        } catch (e) {
          lines.push('> *Gagal memproses naskah JSON.*');
          lines.push('');
          return;
        }
      }

      // Storyboard
      lines.push('### 📋 Storyboard');
      lines.push('| Scene | Duration | Visual Description | Camera Movement | Audio Mood |');
      lines.push('|---|---|---|---|---|');
      const storyboard = parsed.storyboard || [];
      if (storyboard.length === 0) {
        lines.push('| - | - | - | - | - |');
      } else {
        storyboard.forEach((s, sIdx) => {
          lines.push(`| ${s.scene || sIdx + 1} | ${s.duration || '-'} | ${s.visual_description || '-'} | ${s.camera_movement || '-'} | ${s.audio_mood || '-'} |`);
        });
      }
      lines.push('');

      // Voiceover
      lines.push('### 🎙️ Voiceover Script');
      const voiceover = parsed.voiceover || [];
      if (voiceover.length === 0) {
        lines.push('*Tidak ada data voiceover.*');
      } else {
        voiceover.forEach((v, vIdx) => {
          lines.push(`- **Scene ${v.scene || vIdx + 1} (${v.duration || '-'}):**`);
          lines.push(`  > "${v.narration || '-'}"`);
        });
      }
      lines.push('');

      // Captions & Metadata
      lines.push('### 📲 Captions & Metadata');
      lines.push('- **TikTok Caption:**');
      lines.push('  ```');
      lines.push(`  ${parsed.tiktok_caption || ''}`);
      lines.push('  ```');
      lines.push('- **Instagram Caption:**');
      lines.push('  ```');
      lines.push(`  ${parsed.ig_caption || ''}`);
      lines.push('  ```');
      lines.push(`- **YouTube Title:** \`${parsed.yt_title || ''}\``);
      lines.push('- **YouTube Description:**');
      lines.push('  ```');
      lines.push(`  ${parsed.yt_desc || ''}`);
      lines.push('  ```');
      lines.push('');
    });

    return lines.join('\n');
  }

  async function handleDownloadMarkdown() {
    setDownloading(true);
    try {
      const sanitizedName = campaign.campaign_name.replace(/[^a-zA-Z0-9-\s_]/g, '').trim() || campaign.id;
      const filename = `${sanitizedName}.md`;

      // 1. Generate client-side markdown and trigger immediate download
      const md = generateClientMarkdown();
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      showToast(`Gagal mendownload markdown: ${err.message}`, 'error');
    } finally {
      setDownloading(false);
    }
  }

  async function handleSyncDrive() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/v2/pillar-campaigns/${id}/export-markdown`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Sukses sinkronisasi! Berkas dan aset telah diunggah ke cloud storage.`);
        fetchDetail();
      } else {
        showToast(`Gagal sinkronisasi ke cloud storage: ${data.error}`, 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(`Gagal sinkronisasi ke cloud: ${err.message}`, 'error');
    } finally {
      setSyncing(false);
    }
  }

  const getStageBadgeClass = (status) => {
    if (status === 'completed' || status === 'success') return 'badge-success';
    if (status === 'failed') return 'badge-failed';
    if (status === 'processing' || status === 'uploading') return 'badge-running';
    if (status === 'skipped') return 'badge-paused';
    return 'badge-pending';
  };

  function renderItemStatus(item, campaign) {
    let text = 'Fase 1 : Pending';
    let color = 'var(--text-muted)';
    let bg = 'rgba(255, 255, 255, 0.05)';
    let pulse = false;

    const pauseAt = campaign?.scheduler_pause_at;

    // 1. Errors
    if (
      item.generation_status === 'failed' || 
      item.tts_status === 'failed' || 
      item.visual_status === 'failed' || 
      item.ffmpeg_status === 'failed' || 
      item.upload_status === 'failed' || 
      item.social_post_status === 'failed'
    ) {
      text = '⚠️ Error / Failed';
      color = '#e74c3c';
      bg = 'rgba(231, 76, 60, 0.1)';
    }
    // 2. Pause states
    else if (pauseAt === 'tts' && item.generation_status === 'completed' && item.tts_status === 'pending' && item.workflow_status === 'ready_for_review') {
      text = '⏸️ Fase 2 : Paused (Review Script)';
      color = '#f39c12';
      bg = 'rgba(243, 156, 18, 0.1)';
    } else if (pauseAt === 'visuals' && item.tts_status === 'completed' && item.visual_status === 'pending') {
      text = '⏸️ Fase 2 : Paused (Review Prompts)';
      color = '#f39c12';
      bg = 'rgba(243, 156, 18, 0.1)';
    } else if (pauseAt === 'ffmpeg' && item.visual_status === 'completed' && item.ffmpeg_status === 'pending') {
      text = '⏸️ Fase 2 : Paused (Review Clips)';
      color = '#f39c12';
      bg = 'rgba(243, 156, 18, 0.1)';
    } else if (pauseAt === 'social' && item.ffmpeg_status === 'completed' && item.social_post_status === 'pending') {
      text = '⏸️ Fase 2 : Paused (Ready to Post)';
      color = '#f39c12';
      bg = 'rgba(243, 156, 18, 0.1)';
    }
    // 3. Active processing states
    else if (item.generation_status === 'processing') {
      text = '⚡ Fase 1 : AI Generation';
      color = 'var(--accent-light)';
      bg = 'rgba(59, 130, 246, 0.1)';
      pulse = true;
    } else if (item.generation_status === 'pending_sourcing') {
      text = '⚡ Fase 1 : JIT Product Sourcing';
      color = '#9b59b6';
      bg = 'rgba(155, 89, 182, 0.1)';
      pulse = true;
    } else if (item.generation_status === 'pending') {
      text = '⏳ Fase 1 : Queue for Generation';
      color = 'var(--text-muted)';
    } else if (item.tts_status === 'processing') {
      text = '⚡ Fase 2 : Generate TTS';
      color = 'var(--accent-light)';
      bg = 'rgba(59, 130, 246, 0.1)';
      pulse = true;
    } else if (item.tts_status === 'pending' && item.generation_status === 'completed' && item.workflow_status === 'production_processing') {
      text = '⏳ Fase 2 : Queue for TTS';
      color = 'var(--text-muted)';
    } else if (item.visual_status === 'processing') {
      text = '⚡ Fase 2 : Generate Video';
      color = '#9b59b6';
      bg = 'rgba(155, 89, 182, 0.1)';
      pulse = true;
    } else if (item.visual_status === 'pending' && item.tts_status === 'completed') {
      text = '⏳ Fase 2 : Queue for Video';
      color = 'var(--text-muted)';
    } else if (item.ffmpeg_status === 'processing') {
      text = '⚡ Fase 2 : FFMPEG Process';
      color = '#3498db';
      bg = 'rgba(52, 152, 219, 0.1)';
      pulse = true;
    } else if (item.ffmpeg_status === 'pending' && item.visual_status === 'completed') {
      text = '⏳ Fase 2 : Queue for FFmpeg';
      color = 'var(--text-muted)';
    } else if (item.upload_status === 'uploading') {
      text = '⚡ Fase 2 : Uploading Assets';
      color = '#3498db';
      bg = 'rgba(52, 152, 219, 0.1)';
      pulse = true;
    } else if (item.social_post_status === 'processing') {
      text = '⚡ Fase 2 : Social Posting';
      color = '#e67e22';
      bg = 'rgba(230, 126, 34, 0.1)';
      pulse = true;
    }
    // 3.5 Paused Review
    else if (item.workflow_status === 'ready_for_review') {
      text = '⏸️ Fase 2 : Paused (Ready for Review)';
      color = '#f39c12';
      bg = 'rgba(243, 156, 18, 0.1)';
    }
    // 4. Completed states
    else if (item.social_post_status === 'completed' || item.upload_status === 'completed') {
      text = '✅ Fase 2 : Completed';
      color = 'var(--success)';
      bg = 'rgba(46, 204, 113, 0.1)';
    } else if (item.generation_status === 'completed') {
      text = '✅ Fase 1 : Completed';
      color = 'var(--success)';
      bg = 'rgba(46, 204, 113, 0.1)';
    }

    return (
      <span style={{
        padding: '6px 12px',
        borderRadius: 6,
        fontWeight: 600,
        fontSize: '0.8rem',
        color: color,
        background: bg,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        animation: pulse ? 'active-pulse 1.5s infinite alternate' : 'none'
      }}>
        {text}
      </span>
    );
  }

  function renderPipelineProgressBar(item) {
    const getStageStatus = (currentStatus) => {
      if (currentStatus === 'completed' || currentStatus === 'downloaded' || currentStatus === 'analyzed') {
        return 'success';
      }
      if (currentStatus === 'failed') {
        return 'danger';
      }
      if (currentStatus === 'processing' || currentStatus === 'uploading') {
        return 'active';
      }
      if (currentStatus === 'skipped') {
        return 'skipped';
      }
      return 'pending';
    };

    const stages = [
      { label: 'Generate Storyboard', key: 'generate', status: getStageStatus(item.generation_status) },
      { label: 'TTS Synthesize', key: 'tts', status: getStageStatus(item.tts_status) },
      { label: 'GLabs Video', key: 'visuals', status: getStageStatus(item.visual_status) },
      { label: 'FFmpeg Muxing', key: 'ffmpeg', status: getStageStatus(item.ffmpeg_status) },
      { label: 'Social Posting', key: 'social', status: getStageStatus(item.social_post_status) }
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          {stages.map((stage, idx) => {
            let color = 'var(--text-muted)';
            let bg = 'rgba(255, 255, 255, 0.05)';
            let border = '1px solid rgba(255, 255, 255, 0.1)';
            let label = stage.label;
            let anim = 'none';

            if (stage.status === 'success') {
              color = '#fff';
              bg = 'rgba(16, 185, 129, 0.15)';
              border = '1px solid rgba(16, 185, 129, 0.5)';
              label = `✓ ${stage.label}`;
            } else if (stage.status === 'skipped') {
              color = 'rgba(255, 255, 255, 0.4)';
              bg = 'rgba(255, 255, 255, 0.03)';
              border = '1px dashed rgba(255, 255, 255, 0.15)';
              label = `⚡ ${stage.label}`;
            } else if (stage.status === 'danger') {
              color = '#fff';
              bg = 'rgba(239, 68, 68, 0.15)';
              border = '1px solid rgba(239, 68, 68, 0.5)';
              label = `✗ ${stage.label}`;
            } else if (stage.status === 'active') {
              color = '#fff';
              bg = 'rgba(59, 130, 246, 0.2)';
              border = '1px solid rgba(59, 130, 246, 0.5)';
              label = `⏳ ${stage.label}`;
              anim = 'active-pulse 1.5s infinite alternate';
            }

            const canRetry = stage.status !== 'pending' && stage.status !== 'active';
            const isTriggering = triggering[`${item.id}-${stage.key}`];

            return (
              <div key={stage.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  background: bg,
                  color: color,
                  fontWeight: 600,
                  fontSize: '0.72rem',
                  border: border,
                  letterSpacing: '0.3px',
                  animation: anim,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  {label}
                </span>

                {canRetry && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => triggerManualStep(item.id, stage.key)}
                    disabled={isTriggering}
                    title={`Mulai ulang langkah ${stage.label}`}
                    style={{ padding: '4px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {isTriggering ? '⏳' : '🔄'}
                  </button>
                )}

                {idx < stages.length - 1 && (
                  <span style={{ color: 'var(--border-color)', fontWeight: 'bold', marginLeft: 4 }}>➜</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderConcept(item) {
    let pillar = '-';
    let hook = '-';
    let visualAction = '-';
    let prodName = '-';
    let prodDesc = '-';
    let prodUsp = '-';
    let prodUrl = '';
    let prodImage = null;

    let payload = {};
    if (campaign?.is_mass_production === 1) {
      try {
        payload = item.row_creative_payload ? JSON.parse(item.row_creative_payload) : {};
      } catch (e) {
        console.error('Gagal parse row_creative_payload:', e);
      }
      pillar = payload.content_pillar || '-';
      hook = payload.custom_hook || payload.hook || '-';
      visualAction = payload.visual_action_guideline || payload.visual_action || '-';
      prodName = payload.product_name || '-';
      prodDesc = payload.product_desc || payload.product_description || '-';
      prodUsp = payload.product_usp || payload.usp || '-';
      prodUrl = payload.source_product_url || '';
      prodImage = payload.product_ref_image_path || null;
    } else {
      pillar = campaign?.content_pillar || '-';
      hook = campaign?.custom_hook || campaign?.hook || '-';
      visualAction = campaign?.visual_action_guideline || campaign?.visual_action || '-';
      prodName = campaign?.product_name || '-';
      prodDesc = campaign?.product_desc || campaign?.product_description || '-';
      prodUsp = campaign?.product_usp || campaign?.usp || '-';
      prodUrl = campaign?.source_product_url || '';
      prodImage = campaign?.product_ref_image_path || null;
      try {
        if (item.row_creative_payload) {
          payload = JSON.parse(item.row_creative_payload);
          pillar = payload.content_pillar || pillar;
          hook = payload.custom_hook || hook;
          visualAction = payload.visual_action_guideline || visualAction;
          prodName = payload.product_name || prodName;
          prodDesc = payload.product_desc || prodDesc;
          prodUsp = payload.product_usp || prodUsp;
          prodUrl = payload.source_product_url || prodUrl;
          prodImage = payload.product_ref_image_path || prodImage;
        }
      } catch (_) {}
    }

    if (editingItemId === item.id) {
      return (
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 20 }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 600, color: 'var(--accent-color)' }}>
            ✏️ Edit Detail & Konsep Produk (Video #{items.indexOf(item) + 1})
          </h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Kolom Kiri: Konsep Iklan */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>🎯 PILAR KONTEN UTAMA</label>
                <input 
                  type="text" 
                  value={editForm.content_pillar}
                  onChange={(e) => setEditForm(prev => ({ ...prev, content_pillar: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: 10, borderRadius: 6, color: '#fff', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>🪝 NASKAH HOOK UTAMA (KLIP 1)</label>
                <input 
                  type="text" 
                  value={editForm.custom_hook}
                  onChange={(e) => setEditForm(prev => ({ ...prev, custom_hook: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: 10, borderRadius: 6, color: '#fff', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>🎬 PANDUAN AKSI VISUAL (MACRO)</label>
                <textarea 
                  rows={3}
                  value={editForm.visual_action_guideline}
                  onChange={(e) => setEditForm(prev => ({ ...prev, visual_action_guideline: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: 10, borderRadius: 6, color: '#fff', outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>🔗 TAUTAN E-COMMERCE (SHOPEE/TOKOPEDIA)</label>
                <input 
                  type="text" 
                  value={editForm.source_product_url}
                  onChange={(e) => setEditForm(prev => ({ ...prev, source_product_url: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: 10, borderRadius: 6, color: '#fff', outline: 'none' }}
                />
              </div>
            </div>

            {/* Kolom Ranan: Detail Produk */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>📦 NAMA PRODUK</label>
                <input 
                  type="text" 
                  value={editForm.product_name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, product_name: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: 10, borderRadius: 6, color: '#fff', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>📝 DESKRIPSI PRODUK</label>
                <textarea 
                  rows={3}
                  value={editForm.product_desc}
                  onChange={(e) => setEditForm(prev => ({ ...prev, product_desc: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: 10, borderRadius: 6, color: '#fff', outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>✨ UNIQUE SELLING POINT (USP)</label>
                <input 
                  type="text" 
                  value={editForm.product_usp}
                  onChange={(e) => setEditForm(prev => ({ ...prev, product_usp: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: 10, borderRadius: 6, color: '#fff', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>🖼️ UNGGAH FOTO PRODUK (MANUAL)</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setEditForm(prev => ({ ...prev, product_image_file: file }));
                    }
                  }}
                  style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)' }}
                />
                {editForm.product_ref_image_path && !editForm.product_image_file && (
                  <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    File aktif: <code>{editForm.product_ref_image_path}</code>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-color)', flexWrap: 'wrap', gap: 12 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: '#f39c12', cursor: 'pointer', fontWeight: 600 }}>
              <input 
                type="checkbox"
                checked={editForm.reset_status}
                onChange={(e) => setEditForm(prev => ({ ...prev, reset_status: e.target.checked }))}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              🔄 Reset status ke PENDING & Mulai Ulang Storyboard secara otomatis saat disimpan
            </label>

            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setEditingItemId(null)}
                disabled={savingEdit}
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                Batal
              </button>
              <button 
                className="btn btn-primary" 
                onClick={() => handleSaveCreative(item.id)}
                disabled={savingEdit}
                style={{ padding: '8px 20px', fontSize: '0.85rem', fontWeight: 600 }}
              >
                {savingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    const hasNoScrapeData = !prodName || prodName === '-' || prodName === '';

    return (
      <div style={{ width: '100%' }}>
        {hasNoScrapeData && item.generation_status === 'failed' && (
          <div style={{ 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.3)', 
            borderRadius: 8, 
            padding: '12px 16px', 
            marginBottom: 16, 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <span style={{ fontSize: '0.85rem', color: '#ff4a4a', fontWeight: 600 }}>
              ⚠️ JIT Sourcing produk dari Shopee gagal karena diblokir anti-bot. Silakan isi detail produk secara manual.
            </span>
            <button 
              className="btn btn-primary" 
              style={{ background: '#ef4444', padding: '6px 12px', fontSize: '0.78rem' }}
              onClick={() => {
                setEditForm({
                  content_pillar: pillar === '-' ? '' : pillar,
                  custom_hook: hook === '-' ? '' : hook,
                  visual_action_guideline: visualAction === '-' ? '' : visualAction,
                  product_name: '',
                  product_desc: '',
                  product_usp: '',
                  source_product_url: prodUrl,
                  product_image_file: null,
                  product_ref_image_path: '',
                  reset_status: true
                });
                setEditingItemId(item.id);
              }}
            >
              ✍️ Perbaiki Sekarang
            </button>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button 
            className="btn btn-secondary"
            onClick={() => {
              setEditForm({
                content_pillar: pillar === '-' ? '' : pillar,
                custom_hook: hook === '-' ? '' : hook,
                visual_action_guideline: visualAction === '-' ? '' : visualAction,
                product_name: prodName === '-' ? '' : prodName,
                product_desc: prodDesc === '-' ? '' : prodDesc,
                product_usp: prodUsp === '-' ? '' : prodUsp,
                source_product_url: prodUrl,
                product_image_file: null,
                product_ref_image_path: prodImage || '',
                reset_status: item.generation_status === 'failed' ? true : false
              });
              setEditingItemId(item.id);
            }}
            style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            ✏️ Edit Detail & Konsep Produk
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
          {/* Kolom 1: Konsep Ide & Naskah Kreatif */}
          <div style={{ 
            background: 'rgba(255, 255, 255, 0.01)', 
            border: '1px solid var(--border-color)', 
            borderRadius: 8, 
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
              💡 Konsep Ide & Naskah Kreatif
            </h4>
            
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                🎯 Pilar Konten Utama
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', background: 'var(--bg-secondary)', padding: 12, borderRadius: 6, margin: 0, lineHeight: 1.4 }}>
                {pillar}
              </p>
            </div>

            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                🪝 Naskah Hook Utama (Klip 1)
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', background: 'var(--bg-secondary)', padding: 12, borderRadius: 6, margin: 0, lineHeight: 1.4, fontStyle: 'italic' }}>
                "{hook}"
              </p>
            </div>

            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                🎬 Panduan Aksi Visual (Macro)
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', background: 'var(--bg-secondary)', padding: 12, borderRadius: 6, margin: 0, lineHeight: 1.4 }}>
                {visualAction}
              </p>
            </div>

            {campaign?.custom_instruction && (
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  📝 Custom Instruction (AI Directive)
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', background: 'rgba(230, 126, 34, 0.05)', borderLeft: '3px solid #f39c12', padding: 12, borderRadius: 6, margin: 0, lineHeight: 1.4 }}>
                  {campaign.custom_instruction}
                </p>
              </div>
            )}
          </div>

          {/* Kolom 2: Detail Produk & Strategi USP */}
          <div style={{ 
            background: 'rgba(255, 255, 255, 0.01)', 
            border: '1px solid var(--border-color)', 
            borderRadius: 8, 
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
              🛍️ Detail Produk & Strategi USP
            </h4>

            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                📦 Nama Produk
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', background: 'var(--bg-secondary)', padding: 12, borderRadius: 6 }}>
                {prodName}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                📝 Deskripsi Produk
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', background: 'var(--bg-secondary)', padding: 12, borderRadius: 6, margin: 0, lineHeight: 1.4, maxHeight: 150, overflowY: 'auto' }}>
                {prodDesc}
              </p>
            </div>

            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                ✨ Unique Selling Point (USP)
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', background: 'var(--bg-secondary)', padding: 12, borderRadius: 6, margin: 0, lineHeight: 1.4, borderLeft: '3px solid var(--accent-color)' }}>
                {prodUsp}
              </p>
            </div>

            {prodImage && (
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  🖼️ Gambar Produk
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 6, display: 'inline-block' }}>
                  <img 
                    src={prodImage} 
                    alt={prodName} 
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: '180px', 
                      borderRadius: 4, 
                      border: '1px solid var(--border-color)',
                      display: 'block'
                    }} 
                  />
                </div>
              </div>
            )}

            {prodUrl && (
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  🔗 Tautan E-commerce
                </div>
                <a 
                  href={prodUrl} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="btn btn-secondary"
                  style={{ 
                    fontSize: '0.8rem', 
                    padding: '8px 12px', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: 6,
                    textDecoration: 'none',
                    wordBreak: 'break-all'
                  }}
                >
                  🛒 Kunjungi Halaman Produk ➔
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderStoryboard(item) {
    let parsed = {};
    try {
      parsed = JSON.parse(item.result_json || '{}');
    } catch {
      return <p style={{ color: 'var(--danger)' }}>Gagal menguraikan hasil generator JSON.</p>;
    }

    const scenes = parsed.storyboard || [];
    const voiceover = parsed.voiceover || [];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {parsed.analysis_summary && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: 16, borderRadius: 8, fontSize: '0.85rem' }}>
            <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--accent-color)' }}>Ringkasan Strategi Konten Organik:</div>
            <div style={{ marginBottom: 8 }}><span style={{ color: 'var(--text-muted)' }}>Pilar Strategy:</span> {parsed.analysis_summary.pillar_strategy}</div>
            <div><span style={{ color: 'var(--text-muted)' }}>Rencana Transisi Sandwich:</span> {parsed.analysis_summary.sandwich_transition_plan}</div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {scenes.map((scene, index) => {
            const vo = voiceover.find(v => v.scene === scene.scene) || {};
            const isBridge = campaign?.is_bridging_active && scene.scene === campaign.bridge_at_clip;

            return (
              <div 
                key={index} 
                style={{ 
                  background: isBridge ? 'rgba(59, 130, 246, 0.04)' : 'rgba(255,255,255,0.01)', 
                  border: isBridge ? '1px solid rgba(59, 130, 246, 0.25)' : '1px solid var(--border-color)',
                  borderRadius: 8, 
                  padding: 16 
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ background: isBridge ? '#3b82f6' : 'var(--bg-secondary)', color: isBridge ? '#fff' : 'var(--text-primary)', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem' }}>
                      Scene {scene.scene}
                    </span>
                    {isBridge && <span style={{ color: '#3b82f6', fontSize: '0.75rem', fontWeight: 'bold' }}>[🌉 TITIK BRIDGE PRODUK]</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Durasi: {scene.duration}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>DESKRIPSI ADEGAN VISUAL</div>
                    <p style={{ fontSize: '0.85rem', margin: 0, lineHeight: 1.4 }}>{scene.visual_description}</p>
                    {scene.camera_movement && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
                        🎥 Gerakan: <i>{scene.camera_movement}</i>
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>VOICEOVER & AUDIO MOOD</div>
                    <p style={{ fontSize: '0.88rem', margin: 0, fontWeight: 500, color: 'var(--accent-color)', lineHeight: 1.4 }}>
                      "{vo.narration || '(Tanpa Audio)'}"
                    </p>
                    {scene.audio_mood && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
                        🎵 SFX/Mood: <i>{scene.audio_mood}</i>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderPrompts(item) {
    let parsed = {};
    try {
      parsed = JSON.parse(item.result_json || '{}');
    } catch {
      return <p style={{ color: 'var(--danger)' }}>Gagal menguraikan hasil generator JSON.</p>;
    }

    const t2v = parsed.t2v_prompts || [];
    const t2i = parsed.t2i_prompts || [];
    const i2v = parsed.i2v_prompts || [];
    const clipsList = Array.from({ length: campaign?.target_clips_count || 4 }, (_, i) => i + 1);
    const isHybrid = campaign?.visual_mode === 'hybrid_lock';

    let t2iImagePaths = [];
    try {
      if (item.t2i_images_json) {
        t2iImagePaths = JSON.parse(item.t2i_images_json);
      }
    } catch {}

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {clipsList.map(cNum => {
          const isBridge = campaign?.is_bridging_active && cNum === campaign.bridge_at_clip;
          
          let displayPrompts = [];
          if (isHybrid) {
            const promptT2i = t2i.find(p => Number(p.clip) === cNum)?.prompt || '';
            const promptI2v = i2v.find(p => Number(p.clip) === cNum)?.prompt || '';
            displayPrompts = [
              { type: 'T2I (Start Frame)', text: promptT2i, key: `t2i-${item.id}-${cNum}` },
              { type: 'I2V (Motion Prompt)', text: promptI2v, key: `i2v-${item.id}-${cNum}` }
            ];
          } else {
            const promptT2v = t2v.find(p => Number(p.clip) === cNum)?.prompt || '';
            displayPrompts = [
              { type: 'T2V Prompt', text: promptT2v, key: `t2v-${item.id}-${cNum}` }
            ];
          }

          let localClipPath = null;
          if (item.visual_clip_paths) {
            try {
              const paths = JSON.parse(item.visual_clip_paths);
              if (Array.isArray(paths)) {
                localClipPath = paths[cNum - 1];
              }
            } catch {}
          }

          const clipStartFramePath = t2iImagePaths[cNum - 1] || (isBridge ? item.t2i_start_frame_path : null);

          return (
            <div 
              key={cNum} 
              style={{ 
                background: 'rgba(255,255,255,0.01)', 
                border: '1px solid var(--border-color)', 
                borderRadius: 8, 
                padding: 16 
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <strong style={{ fontSize: '0.9rem' }}>Klip {cNum} {isHybrid && <span style={{ color: 'var(--accent-color)', fontSize: '0.75rem' }}>({isBridge ? 'Double-Pass Bridge Locked' : 'Double-Pass Pixel Lock'})</span>}</strong>
                {localClipPath && <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>✓ Rendered</span>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {displayPrompts.map((p, pIdx) => (
                    <div key={pIdx} style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 6, position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>{p.type}</span>
                        {p.text && (
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '2px 6px', fontSize: '0.65rem' }}
                            onClick={() => handleCopy(p.text, p.key)}
                          >
                            {copySuccess[p.key] ? 'Tersalin ✓' : 'Salin'}
                          </button>
                        )}
                      </div>
                      <p style={{ fontSize: '0.8rem', margin: 0, fontFamily: 'monospace', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                        {p.text || '(Prompt tidak ditemukan / Belum dibuat)'}
                      </p>
                    </div>
                  ))}
                  {isHybrid && clipStartFramePath && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>T2I Start Frame (Pixel Lock):</div>
                      <img src={clipStartFramePath} alt="Pixel Lock Frame" style={{ maxWidth: '120px', borderRadius: 4, border: '1px solid var(--border-color)' }} />
                    </div>
                  )}
                </div>

                {localClipPath && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>🎬 Generated Visual Clip (Local)</span>
                    <video 
                      src={localClipPath} 
                      controls 
                      preload="metadata"
                      style={{ 
                        width: '100%', 
                        maxHeight: '260px', 
                        borderRadius: 6, 
                        border: '1px solid rgba(255,255,255,0.08)', 
                        background: '#000',
                        display: 'block'
                      }} 
                    />
                  </div>
                )}
              </div>

            </div>
          );
        })}
      </div>
    );
  }

  function renderSocial(item) {
    let parsed = {};
    try {
      parsed = JSON.parse(item.result_json || '{}');
    } catch {
      return <p style={{ color: 'var(--danger)' }}>Gagal menguraikan hasil generator JSON.</p>;
    }

    const capKey = `cap-${item.id}`;
    const universalCap = parsed.caption || parsed.universal_caption || (typeof parsed.social_media_package === 'object' ? parsed.social_media_package?.caption : '') || parsed.tiktok_caption || parsed.ig_caption || '';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>📱 Universal Social Media Caption</span>
            <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => handleCopy(universalCap, capKey)}>
              {copySuccess[capKey] ? 'Tersalin ✓' : 'Salin Caption'}
            </button>
          </div>
          <textarea
            className="form-textarea"
            style={{ width: '100%', minHeight: 120, fontSize: '0.85rem', background: '#09090b', color: '#fff', borderRadius: 6, padding: 10 }}
            value={universalCap}
            onChange={(e) => updateSocialField('caption', e.target.value)}
            placeholder="Naskah caption universal media sosial (TikTok, Instagram, Facebook, Shorts)..."
          />
        </div>

        {item.social_post_status === 'completed' && item.social_links_json && (
          <div style={{ marginTop: 12, background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: 16, borderRadius: 8 }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#10b981', marginBottom: 8 }}>Link Publish Draft Sosmed:</div>
            {(() => {
              try {
                const links = JSON.parse(item.social_links_json);
                return (
                  <div style={{ display: 'flex', gap: 12 }}>
                    {links.youtube && <a href={links.youtube} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ background: '#FF0000', fontSize: '0.8rem', padding: '6px 12px' }}>YouTube Draft Studio</a>}
                    {links.tiktok && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>TikTok: Draft berhasil disimpan secara internal</span>}
                  </div>
                );
              } catch {
                return null;
              }
            })()}
          </div>
        )}
      </div>
    );
  }

  function renderLogs(item) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 8 }}>
          <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 8, color: 'var(--text-primary)' }}>Detail Teknis Pipeline & Variabel:</div>
          <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>ID Item</td><td style={{ padding: '6px 0', fontWeight: 600 }}>#{item.id}</td></tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Voiceover Provider</td><td style={{ padding: '6px 0' }}>{campaign?.voice_provider} ({campaign?.voice_persona})</td></tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Visual Mode</td><td style={{ padding: '6px 0' }}>{campaign?.visual_mode}</td></tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Retry Count</td><td style={{ padding: '6px 0' }}>{item.retry_count || 0} kali</td></tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>
                  {storageProvider === 'nextcloud' ? 'Nextcloud Upload Status' : 'Google Drive Upload Status'}
                </td>
                <td style={{ padding: '6px 0' }}>
                  <span className={`badge ${getStageBadgeClass(item.upload_status)}`}>
                    {item.upload_status || 'pending'}
                  </span>
                </td>
              </tr>
              <tr>
                <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>
                  {storageProvider === 'nextcloud' ? 'Nextcloud Storage Link' : 'Google Drive Folder'}
                </td>
                <td style={{ padding: '6px 0' }}>
                  {storageProvider === 'nextcloud' ? (
                    (item.nextcloud_url || (item.drive_link && (item.drive_link.includes('100.78.186.123') || item.drive_link.includes('index.php/s/')))) ? (
                      <a href={item.nextcloud_url || item.drive_link} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'underline' }}>
                        Buka Nextcloud ➔
                      </a>
                    ) : '(Belum diunggah)'
                  ) : (
                    (item.drive_link && !item.drive_link.includes('100.78.186.123')) ? (
                      <a href={item.drive_link} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'underline' }}>
                        Buka Google Drive ➔
                      </a>
                    ) : '(Belum diunggah)'
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {item.glabs_tasks && item.glabs_tasks.length > 0 && (
          <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 8 }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 8, color: 'var(--text-primary)' }}>Antrean Video Task (GLabs):</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {item.glabs_tasks.map(task => (
                <div key={task.task_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: 6, fontSize: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>Task ID: {task.task_id}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Klip {task.clip_index + 1} | Prompt: {task.prompt.slice(0, 50)}...</div>
                  </div>
                  <span className={`badge ${getStageBadgeClass(task.status)}`}>{task.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const renderV2Workbench = (item) => {
    if (!editedVideoPlans.hasOwnProperty(item.id)) {
      let plan = [];
      try { plan = JSON.parse(item.new_video_plan_json || '[]'); } catch {}
      setTimeout(() => {
        setEditedVideoPlans(prev => ({ ...prev, [item.id]: plan }));
      }, 0);
      return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Memuat Workbench...</div>;
    }

    if (!editedVideoDnas.hasOwnProperty(item.id)) {
      let dna = {};
      try { dna = JSON.parse(item.video_dna_json || '{}'); } catch {}
      setTimeout(() => {
        setEditedVideoDnas(prev => ({ ...prev, [item.id]: dna }));
      }, 0);
      return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Memuat Video DNA...</div>;
    }

    if (!socialCaptions.hasOwnProperty(item.id)) {
      let sc = { tiktok_caption: '', ig_caption: '', yt_title: '', yt_desc: '' };
      try {
        const parsed = JSON.parse(item.result_json || '{}');
        const capVal = parsed.caption || (typeof parsed.social_media_package === 'object' ? parsed.social_media_package?.caption : '') || parsed.tiktok_caption || parsed.ig_caption || '';
        sc = {
          caption: capVal,
          tiktok_caption: parsed.tiktok_caption || capVal,
          ig_caption: parsed.ig_caption || capVal,
          yt_title: parsed.yt_title || '',
          yt_desc: parsed.yt_desc || ''
        };
      } catch {}
      setTimeout(() => {
        setSocialCaptions(prev => ({ ...prev, [item.id]: sc }));
      }, 0);
      return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Memuat Social Captions...</div>;
    }

    if (!workflowSettings.hasOwnProperty(item.id)) {
      setTimeout(() => {
        setWorkflowSettings(prev => ({
          ...prev,
          [item.id]: {
            enable_tts: campaign.enable_tts !== 0,
            enable_glabs: campaign.enable_glabs !== 0,
            enable_ffmpeg: campaign.enable_ffmpeg !== 0,
            voice_provider: campaign.voice_provider || 'minimax',
            voice_persona: campaign.voice_persona || 'Indonesian_casual_reporter_vv2',
            voice_speed: campaign.voice_speed !== undefined ? Number(campaign.voice_speed) : 1.0,
            voice_volume: campaign.voice_volume !== undefined ? Number(campaign.voice_volume) : 1.0,
            ffmpeg_video_scale: campaign.ffmpeg_video_scale !== undefined ? Number(campaign.ffmpeg_video_scale) : 1.0,
            ffmpeg_sfx_volume: campaign.ffmpeg_sfx_volume !== undefined ? Number(campaign.ffmpeg_sfx_volume) : 0.0,
            ffmpeg_bgm_volume: campaign.ffmpeg_bgm_volume !== undefined ? Number(campaign.ffmpeg_bgm_volume) : 0.0,
            ffmpeg_sync_option: campaign.ffmpeg_sync_option || 'smart_sync',
          }
        }));
      }, 0);
      return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Memuat Pengaturan Alur Kerja...</div>;
    }

    if (!selectedVoVersions.hasOwnProperty(item.id)) {
      setTimeout(() => {
        setSelectedVoVersions(prev => ({ ...prev, [item.id]: item.selected_vo_version || 'original' }));
      }, 0);
      return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Memuat Workbench...</div>;
    }

    const activeVoVersion = selectedVoVersions[item.id] || item.selected_vo_version || 'original';

    const handleVoVersionChange = (version) => {
      let voArray = [];
      if (version === 'original') {
        try { voArray = JSON.parse(item.original_voiceover || '[]'); } catch {}
      } else {
        try { voArray = JSON.parse(item.tiktok_safe_voiceover || '[]'); } catch {}
      }

      setEditedVideoPlans(prev => {
        const currentPlan = [...(prev[item.id] || [])];
        const updatedPlan = currentPlan.map((clip, idx) => {
          const matchingVo = voArray.find(v => Number(v.scene) === Number(clip.clip_index || idx + 1));
          return {
            ...clip,
            new_vo: matchingVo ? matchingVo.narration : (clip.new_vo || '')
          };
        });
        return { ...prev, [item.id]: updatedPlan };
      });

      setSelectedVoVersions(prev => ({ ...prev, [item.id]: version }));
    };

    const plan = editedVideoPlans[item.id] || [];
    const dna = editedVideoDnas[item.id] || {};
    const sc = socialCaptions[item.id] || {};
    const settings = workflowSettings[item.id] || {};
    const isProductionFailed = 
      item.visual_status === 'failed' ||
      item.tts_status === 'failed' ||
      item.ffmpeg_status === 'failed' ||
      item.upload_status === 'failed' ||
      item.social_post_status === 'failed';
    const canEditStoryboard = item.workflow_status === 'ready_for_review' || isProductionFailed;
    const isReadOnly = !canEditStoryboard;

    const updateDnaField = (field, value) => {
      if (isReadOnly) return;
      setEditedVideoDnas(prev => ({
        ...prev,
        [item.id]: { ...prev[item.id], [field]: value }
      }));
    };

    const updatePlanField = (index, field, value) => {
      if (isReadOnly) return;
      setEditedVideoPlans(prev => {
        const updatedPlan = [...(prev[item.id] || [])];
        updatedPlan[index] = { ...updatedPlan[index], [field]: value };
        return { ...prev, [item.id]: updatedPlan };
      });
    };

    const updateSocialField = (field, value) => {
      if (isReadOnly) return;
      setSocialCaptions(prev => ({
        ...prev,
        [item.id]: { ...prev[item.id], [field]: value }
      }));
    };

    const toggleSetting = (field) => {
      if (isReadOnly) return;
      setWorkflowSettings(prev => ({
        ...prev,
        [item.id]: { ...prev[item.id], [field]: !prev[item.id][field] }
      }));
    };

    const updateSettingField = (field, value) => {
      if (isReadOnly) return;
      setWorkflowSettings(prev => ({
        ...prev,
        [item.id]: { ...prev[item.id], [field]: value }
      }));
    };

    const handleRegenerateT2I = async (clipIdx, t2iPrompt) => {
      const taskKey = `${item.id}_${clipIdx}`;
      setRegeneratingT2I(prev => ({ ...prev, [taskKey]: true }));
      try {
        const res = await fetch(`/api/v2/pillar-campaigns/items/${item.id}/regenerate-t2i`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clipIndex: clipIdx, t2i_prompt: t2iPrompt })
        });
        const resData = await res.json();
        if (resData.success) {
          showToast(`Gambar T2I klip ${clipIdx} berhasil diregenerasi!`);
          fetchDetail();
        } else {
          showToast(resData.error || 'Gagal meregenerasi gambar.', 'error');
        }
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setRegeneratingT2I(prev => ({ ...prev, [taskKey]: false }));
      }
    };

    const handleUploadStartFrame = async (clipIdx, file) => {
      if (!file) return;
      const taskKey = `${item.id}_${clipIdx}`;
      setReplacingSF(prev => ({ ...prev, [taskKey]: true }));
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('clipIndex', clipIdx);

      try {
        const res = await fetch(`/api/v2/pillar-campaigns/items/${item.id}/replace-start-frame`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.success) {
          showToast(`Start frame untuk klip ${clipIdx} berhasil diperbarui!`);
          setCacheBuster(Date.now());
          fetchDetail();
        } else {
          showToast(data.error || 'Gagal memperbarui start frame.', 'error');
        }
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setReplacingSF(prev => ({ ...prev, [taskKey]: false }));
      }
    };

    const handleRegenerateAllSF = async () => {
      setBatchRegeneratingSF(prev => ({ ...prev, [item.id]: true }));
      try {
        const res = await fetch(`/api/v2/pillar-campaigns/items/${item.id}/regenerate-start-frames`, {
          method: 'POST'
        });
        const resData = await res.json();
        if (resData.success) {
          showToast("Regenerasi semua start frame telah dimulai di latar belakang.");
          fetchDetail();
        } else {
          showToast(resData.error || 'Gagal memulai regenerasi start frame.', 'error');
        }
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setBatchRegeneratingSF(prev => ({ ...prev, [item.id]: false }));
      }
    };

    const handleApprove = async () => {
      if (settings.voice_provider === 'gemini') {
        for (let i = 0; i < plan.length; i++) {
          if (isJsonError(plan[i].i2v_prompt)) {
            alert(`Klip ${i + 1} memiliki format JSON tidak valid pada prompt I2V. Silakan perbaiki sebelum menyetujui!`);
            return;
          }
        }
      }

      if (settings.enable_tts) {
        const missingVoClips = [];
        plan.forEach((p, idx) => {
          if (!p.new_vo || p.new_vo.trim() === '') {
            missingVoClips.push(p.clip_index || (idx + 1));
          }
        });

        if (missingVoClips.length > 0) {
          alert(`Peringatan: Klip #${missingVoClips.join(', #')} belum memiliki naskah VO. Mohon isi naskah VO terlebih dahulu sebelum menyetujui dan menjalankan produksi.`);
          return;
        }
      }

      setApprovingItems(prev => ({ ...prev, [item.id]: true }));
      try {
        const res = await fetch(`/api/v2/pillar-campaigns/items/${item.id}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            new_video_plan: plan,
            video_dna: dna,
            tiktok_caption: sc.tiktok_caption,
            ig_caption: sc.ig_caption,
            yt_title: sc.yt_title,
            yt_desc: sc.yt_desc,
            enable_tts: settings.enable_tts,
            enable_glabs: settings.enable_glabs,
            enable_ffmpeg: settings.enable_ffmpeg,
            voice_provider: settings.voice_provider,
            voice_persona: settings.voice_persona,
            voice_speed: settings.voice_speed,
            voice_volume: settings.voice_volume,
            ffmpeg_video_scale: settings.ffmpeg_video_scale,
            ffmpeg_sfx_volume: settings.ffmpeg_sfx_volume,
            ffmpeg_bgm_volume: settings.ffmpeg_bgm_volume,
            ffmpeg_sync_option: settings.ffmpeg_sync_option,
            selected_vo_version: activeVoVersion
          })
        });
        const resData = await res.json();
        if (resData.success) {
          showToast("Kampanye disetujui! Alur produksi berjalan sekarang.");
          fetchDetail();
        } else {
          showToast(resData.error || "Gagal menyetujui kampanye.", "error");
        }
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setApprovingItems(prev => ({ ...prev, [item.id]: false }));
      }
    };

    const handleSaveDraft = async () => {
      if (settings.voice_provider === 'gemini') {
        for (let i = 0; i < plan.length; i++) {
          if (isJsonError(plan[i].i2v_prompt)) {
            alert(`Klip ${i + 1} memiliki format JSON tidak valid pada prompt I2V. Silakan perbaiki sebelum menyimpan!`);
            return;
          }
        }
      }
      setSavingDraft(prev => ({ ...prev, [item.id]: true }));
      try {
        const res = await fetch(`/api/v2/pillar-campaigns/items/${item.id}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            new_video_plan: plan,
            video_dna: dna,
            tiktok_caption: sc.tiktok_caption,
            ig_caption: sc.ig_caption,
            yt_title: sc.yt_title,
            yt_desc: sc.yt_desc,
            enable_tts: settings.enable_tts,
            enable_glabs: settings.enable_glabs,
            enable_ffmpeg: settings.enable_ffmpeg,
            voice_provider: settings.voice_provider,
            voice_persona: settings.voice_persona,
            voice_speed: settings.voice_speed,
            voice_volume: settings.voice_volume,
            ffmpeg_video_scale: settings.ffmpeg_video_scale,
            ffmpeg_sfx_volume: settings.ffmpeg_sfx_volume,
            ffmpeg_bgm_volume: settings.ffmpeg_bgm_volume,
            ffmpeg_sync_option: settings.ffmpeg_sync_option,
            only_save: true,
            selected_vo_version: activeVoVersion
          })
        });
        const resData = await res.json();
        if (resData.success) {
          showToast(resData.message || "Storyboard draft berhasil disimpan!");
          fetchDetail();
        } else {
          showToast(resData.error || "Gagal menyimpan draft.", "error");
        }
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setSavingDraft(prev => ({ ...prev, [item.id]: false }));
      }
    };

    const handleRecompilation = async () => {
      setRecompressingItems(prev => ({ ...prev, [item.id]: true }));
      try {
        const res = await fetch(`/api/v2/pillar-campaigns/items/${item.id}/re-ffmpeg`, {
          method: 'POST'
        });
        const resData = await res.json();
        if (resData.success) {
          showToast("Kompilasi ulang video (FFmpeg) berhasil dimasukkan ke antrean.");
          fetchDetail();
        } else {
          showToast(resData.error || 'Gagal memulai kompilasi ulang.', 'error');
        }
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setRecompressingItems(prev => ({ ...prev, [item.id]: false }));
      }
    };

    const handlePostFacebook = async () => {
      setTriggering(prev => ({ ...prev, [`${item.id}-social`]: true }));
      try {
        const res = await fetch(`/api/v2/pillar-campaigns/items/${item.id}/post-fb`, {
          method: 'POST'
        });
        const resData = await res.json();
        if (resData.success) {
          showToast("Draft postingan berhasil dikirim ke Facebook Page!");
          fetchDetail();
        } else {
          showToast(resData.error || 'Gagal mengirim draft ke Facebook.', 'error');
        }
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setTriggering(prev => {
          const next = { ...prev };
          delete next[`${item.id}-social`];
          return next;
        });
      }
    };

    let t2iImages = [];
    try {
      t2iImages = JSON.parse(item.t2i_images_json || '[]');
    } catch {}

    const activeTab = activeTabs[item.id] || 'concept';
    const setActiveTab = (t) => {
      setActiveTabs(prev => ({ ...prev, [item.id]: t }));
    };
    const handleSyncItemAssets = async () => {
      setSyncingItemAssets(prev => ({ ...prev, [item.id]: true }));
      try {
        const res = await fetch(`/api/v2/pillar-campaigns/items/${item.id}/sync-assets`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showToast(`Berhasil mengunggah ${data.totalFiles} aset ke ${data.storageProvider.toUpperCase()}!`);
          fetchDetail();
        } else {
          showToast(`Gagal sync aset: ${data.error || 'Terjadi kesalahan'}`, 'error');
        }
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        setSyncingItemAssets(prev => ({ ...prev, [item.id]: false }));
      }
    };

    return (
      <div style={{ color: 'var(--text-primary)', fontSize: '0.82rem', textAlign: 'left' }}>
        {/* Status Banners */}
        {item.workflow_status === 'ready_for_review' && (
          <div style={{ background: 'rgba(230, 126, 34, 0.08)', border: '1px solid rgba(230, 126, 34, 0.3)', color: '#f39c12', padding: '16px 20px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', lineHeight: 1.5 }}>
            <span style={{ fontSize: '1.4rem' }}>⏳</span>
            <div>
              <strong style={{ display: 'block', marginBottom: '2px', color: '#fff' }}>Menunggu Review Kreatif (Human-in-the-Loop)</strong>
              Gemini telah merancang Konsep Awal & Rencana Video baru di bawah ini. Harap tinjau voiceover, prompt start frame T2I, dan prompt pergerakan I2V. Anda bisa mengedit teksnya secara bebas, meregenerasi gambar T2I, dan menyesuaikan tahapan pipa produksi sebelum klik tombol <strong>"Approve & Proceed to Production"</strong>.
            </div>
          </div>
        )}

        {item.workflow_status === 'production_processing' && (
          <div style={{ background: 'rgba(52, 152, 219, 0.08)', border: '1px solid rgba(52, 152, 219, 0.3)', color: '#3498db', padding: '16px 20px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', lineHeight: 1.5 }}>
            <span style={{ fontSize: '1.4rem' }}>⚙️</span>
            <div>
              <strong style={{ display: 'block', marginBottom: '2px', color: '#fff' }}>Sedang Memproses Produksi...</strong>
              Antrean produksi sedang berjalan. Mesin sedang melakukan render audio TTS, visual G-Labs (Veo/Kling), dan penggabungan FFmpeg. Antarmuka ini dikunci sementara (Read-Only) hingga produksi selesai.
            </div>
          </div>
        )}

        {item.workflow_status === 'completed' && !isProductionFailed && (
          <div style={{ background: 'rgba(46, 204, 113, 0.08)', border: '1px solid rgba(46, 204, 113, 0.3)', color: '#2ecc71', padding: '16px 20px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', lineHeight: 1.5 }}>
            <span style={{ fontSize: '1.4rem' }}>✅</span>
            <div>
              <strong style={{ display: 'block', marginBottom: '2px', color: '#fff' }}>Produksi Selesai</strong>
              Tahapan produksi (TTS, Video G-Labs, dan Muxing FFmpeg) telah selesai dieksekusi sepenuhnya! Video akhir siap diunduh atau diposting.
            </div>
          </div>
        )}

        {isProductionFailed && (
          <div style={{ background: 'rgba(231, 76, 60, 0.08)', border: '1px solid rgba(231, 76, 60, 0.3)', color: '#e74c3c', padding: '16px 20px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', lineHeight: 1.5 }}>
            <span style={{ fontSize: '1.4rem' }}>❌</span>
            <div>
              <strong style={{ display: 'block', marginBottom: '2px', color: '#fff' }}>Produksi Gagal / Terhenti</strong>
              Terjadi kegagalan saat memproses tahapan produksi (TTS, Video G-Labs, atau FFmpeg). Anda dapat mengedit storyboard di bawah ini, mengunggah Start Frame pengganti, lalu klik tombol <strong>"Approve & Proceed to Production"</strong> untuk merender ulang video.
            </div>
          </div>
        )}

        {/* TikTok Safe Compliance Report & VO Selector */}
        {campaign.enable_vo_audit === 1 && item.compliance_status && (
          <div style={{
            background: 'var(--bg-glass)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>🛡️</span>
                <span style={{ fontWeight: '700', fontSize: '0.9rem', color: '#fff' }}>TikTok Shop Compliance Audit</span>
              </div>
              
              {/* Verdict Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status:</span>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  background: item.compliance_status === 'PASS' 
                    ? 'rgba(46, 204, 113, 0.15)' 
                    : item.compliance_status === 'REVISE' 
                      ? 'rgba(241, 196, 15, 0.15)' 
                      : 'rgba(231, 76, 60, 0.15)',
                  color: item.compliance_status === 'PASS' 
                    ? '#2ecc71' 
                    : item.compliance_status === 'REVISE' 
                      ? '#f1c40f' 
                      : '#e74c3c',
                  border: `1px solid ${
                    item.compliance_status === 'PASS' 
                      ? '#2ecc71' 
                      : item.compliance_status === 'REVISE' 
                        ? '#f1c40f' 
                        : '#e74c3c'
                  }`
                }}>
                  {item.compliance_status}
                </span>
                
                {/* Risk Score */}
                {item.compliance_score !== undefined && (
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: '700',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border)',
                    color: item.compliance_score < 30 ? '#2ecc71' : item.compliance_score < 70 ? '#f1c40f' : '#e74c3c'
                  }}>
                    Skor Risiko: {item.compliance_score}/100
                  </span>
                )}
              </div>
            </div>

            {/* Show issues if any */}
            {(() => {
              let log = {};
              try { log = JSON.parse(item.compliance_log_json || '{}'); } catch {}
              const issues = log.issues || [];
              if (issues.length === 0) return null;
              return (
                <div style={{
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  borderLeft: '4px solid #f1c40f'
                }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#f1c40f', display: 'block', marginBottom: '6px' }}>
                    Peringatan Kepatuhan Kebijakan:
                  </span>
                  <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {issues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                </div>
              );
            })()}

            {/* VO Version Switcher */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Pilih Versi Voiceover (Mempengaruhi Teks Naskah):
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleVoVersionChange('original')}
                  disabled={isReadOnly}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: activeVoVersion === 'original' ? 'rgba(255,255,255,0.08)' : 'transparent',
                    border: `1px solid ${activeVoVersion === 'original' ? 'var(--accent)' : 'var(--border)'}`,
                    color: activeVoVersion === 'original' ? '#fff' : 'var(--text-muted)',
                    cursor: isReadOnly ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontWeight: activeVoVersion === 'original' ? 700 : 500,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span>🎨</span>
                  <div style={{ textAlign: 'left' }}>
                    <span style={{ display: 'block', fontSize: '0.8rem' }}>Versi Orisinal</span>
                    <span style={{ display: 'block', fontSize: '0.62rem', opacity: 0.6 }}>Naskah asli AI yang lebih persuasif & kreatif</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleVoVersionChange('safe')}
                  disabled={isReadOnly}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: activeVoVersion === 'safe' ? 'rgba(46, 204, 113, 0.08)' : 'transparent',
                    border: `1px solid ${activeVoVersion === 'safe' ? '#2ecc71' : 'var(--border)'}`,
                    color: activeVoVersion === 'safe' ? '#2ecc71' : 'var(--text-muted)',
                    cursor: isReadOnly ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontWeight: activeVoVersion === 'safe' ? 700 : 500,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span>🛡️</span>
                  <div style={{ textAlign: 'left' }}>
                    <span style={{ display: 'block', fontSize: '0.8rem' }}>Versi Audit (TikTok Safe)</span>
                    <span style={{ display: 'block', fontSize: '0.62rem', opacity: 0.6 }}>Naskah tersanitasi bebas dari pelanggaran medis</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab Headers */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px', marginBottom: '20px', overflowX: 'auto' }}>
          {[
            { id: 'concept', label: '💡 Tab 1: Konsep Awal & Produk' },
            { id: 'storyboard', label: '📖 Tab 2: Storyboard & Rencana Visual' },
            { id: 'dna', label: '🧬 Tab 3: Video DNA' },
            { id: 'assets', label: '☁️ Tab 4: Aset & Recovery' },
            { id: 'logs', label: '🖥 Tab 5: System Log' }
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              style={{
                background: activeTab === t.id ? 'rgba(108, 92, 231, 0.15)' : 'transparent',
                border: activeTab === t.id ? '1px solid var(--accent)' : '1px solid transparent',
                color: activeTab === t.id ? 'var(--accent-light)' : 'var(--text-muted)',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content Panels */}
        {activeTab === 'concept' && renderConcept(item)}

        {activeTab === 'storyboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>
            <h4 style={{ margin: 0, fontWeight: '700', fontSize: '0.9rem', color: '#fff' }}>📖 Storyboard & Rencana Visual Baru</h4>

            {/* Start Frame Grid */}
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
                <span style={{ fontWeight: '600', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  🖼️ Grid Preview Start Frame Gambar (T2I)
                </span>
                <button
                  type="button"
                  onClick={handleRegenerateAllSF}
                  disabled={item.regenerate_start_frames_status === 'running' || !!batchRegeneratingSF[item.id]}
                  className="btn btn-secondary btn-sm"
                  style={{
                    fontSize: '0.72rem',
                    padding: '4px 10px',
                    background: item.regenerate_start_frames_status === 'running' ? 'rgba(155, 89, 182, 0.4)' : 'rgba(155, 89, 182, 0.15)',
                    borderColor: 'rgba(155, 89, 182, 0.3)',
                    color: '#fff',
                    cursor: item.regenerate_start_frames_status === 'running' ? 'not-allowed' : 'pointer'
                  }}
                >
                  {item.regenerate_start_frames_status === 'running'
                    ? `⏳ Regenerating (${item.regenerate_start_frames_progress || '0%'})`
                    : '🎨 Generate T2I Start Frames'
                  }
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px', marginTop: '10px' }}>
                {plan.map((p, idx) => {
                  const clipImgPath = t2iImages[idx];
                  const taskKey = `${item.id}_${p.clip_index || (idx + 1)}`;
                  const isRegenerating = regeneratingT2I[taskKey];
                  const hasT2iPrompt = !!p.t2i_prompt;

                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', background: 'rgba(0,0,0,0.1)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                      <div style={{ fontWeight: '700', fontSize: '0.72rem', color: 'var(--accent-light)' }}>
                        Klip #{p.clip_index || (idx + 1)}
                      </div>
                      <div style={{ width: '100%', height: '180px', position: 'relative', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {clipImgPath ? (
                          <img src={clipImgPath.includes('?') ? `${clipImgPath}&t=${cacheBuster}` : `${clipImgPath}?t=${cacheBuster}`} alt={`Klip ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.62rem', padding: '5px', textAlign: 'center' }}>
                            <span>{hasT2iPrompt ? '🖼️ Belum Ada Start Frame' : '🎬 T2V (No Start Frame)'}</span>
                          </div>
                        )}
                      </div>
                      {hasT2iPrompt && (
                        <>
                          <input 
                            type="file" 
                            accept="image/*" 
                            style={{ display: 'none' }} 
                            id={`replace-sf-${item.id}-${p.clip_index || (idx + 1)}`}
                            onChange={(e) => {
                              handleUploadStartFrame(p.clip_index || (idx + 1), e.target.files[0]);
                              e.target.value = '';
                            }}
                          />
                          <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={isReadOnly || isRegenerating || replacingSF[taskKey]}
                              onClick={() => handleRegenerateT2I(p.clip_index || (idx + 1), p.t2i_prompt)}
                              style={{
                                flex: 1,
                                fontSize: '0.62rem',
                                padding: '4px 2px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: '#fff',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                textAlign: 'center',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {isRegenerating ? '⏳...' : '🔄 Regen'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={isReadOnly || isRegenerating || replacingSF[taskKey]}
                              onClick={() => document.getElementById(`replace-sf-${item.id}-${p.clip_index || (idx + 1)}`).click()}
                              style={{
                                flex: 1,
                                fontSize: '0.62rem',
                                padding: '4px 2px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: '#fff',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                textAlign: 'center',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {replacingSF[taskKey] ? '⏳...' : '📤 Replace'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Creative Clip Plans list */}
            {plan.map((p, idx) => {
              const isBridge = campaign?.is_bridging_active && Number(p.clip_index) === Number(campaign.bridge_at_clip);
              const isExpanded = (activeClipIndex[item.id] !== undefined ? activeClipIndex[item.id] : 0) === idx;

              return (
                <div key={idx} style={{ background: isBridge ? 'rgba(59, 130, 246, 0.03)' : 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: isBridge ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(255, 255, 255, 0.05)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div 
                    onClick={() => toggleClip(item.id, idx)}
                    style={{ 
                      fontWeight: 700, 
                      fontSize: '0.82rem', 
                      color: isBridge ? '#3b82f6' : 'var(--accent-light)', 
                      borderBottom: isExpanded ? '1px solid rgba(255,255,255,0.04)' : 'none', 
                      paddingBottom: '8px', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{isExpanded ? '▼' : '▶'} Aset Klip #{p.clip_index || (idx + 1)}</span>
                      {isBridge && <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#3b82f6' }}>🌉 BRIDGE TRANSISI PRODUK</span>}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {isExpanded ? 'Tutup Aset' : 'Buka Aset'}
                    </span>
                  </div>

                  {isExpanded && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Voiceover Script */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>Naskah Voiceover (VO)</label>
                        <button
                          type="button"
                          onClick={(e) => {
                            writeToClipboard(p.new_vo || '');
                            const originalText = e.currentTarget.innerText;
                            e.currentTarget.innerText = '✅ Disalin!';
                            setTimeout((btn) => { if (btn) btn.innerText = originalText; }, 1500, e.currentTarget);
                          }}
                          style={{ background: 'transparent', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', fontSize: '0.65rem', padding: '0 4px', fontWeight: 600 }}
                        >
                          📋 Salin
                        </button>
                      </div>
                      <textarea
                        disabled={isReadOnly}
                        style={{ width: '100%', minHeight: '45px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', padding: '8px', color: '#fff', fontSize: '0.78rem', resize: 'vertical', lineHeight: 1.4 }}
                        value={p.new_vo || ''}
                        onChange={(e) => updatePlanField(idx, 'new_vo', e.target.value)}
                      />
                    </div>

                    {/* Aksi Visual */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>Aksi Visual (Deskripsi Scene)</label>
                        <button
                          type="button"
                          onClick={(e) => {
                            writeToClipboard(p.visual_action || '');
                            const originalText = e.currentTarget.innerText;
                            e.currentTarget.innerText = '✅ Disalin!';
                            setTimeout((btn) => { if (btn) btn.innerText = originalText; }, 1500, e.currentTarget);
                          }}
                          style={{ background: 'transparent', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', fontSize: '0.65rem', padding: '0 4px', fontWeight: 600 }}
                        >
                          📋 Salin
                        </button>
                      </div>
                      <textarea
                        disabled={isReadOnly}
                        style={{ width: '100%', minHeight: '45px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', padding: '8px', color: '#fff', fontSize: '0.78rem', resize: 'vertical', lineHeight: 1.4 }}
                        value={p.visual_action || ''}
                        onChange={(e) => updatePlanField(idx, 'visual_action', e.target.value)}
                      />
                    </div>

                    {/* T2I Prompt (If exists) */}
                    {p.t2i_prompt !== undefined && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>Prompt T2I Start Frame (Pixel Lock)</label>
                          <button
                            type="button"
                            onClick={(e) => {
                              writeToClipboard(p.t2i_prompt || '');
                              const originalText = e.currentTarget.innerText;
                              e.currentTarget.innerText = '✅ Disalin!';
                              setTimeout((btn) => { if (btn) btn.innerText = originalText; }, 1500, e.currentTarget);
                            }}
                            style={{ background: 'transparent', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', fontSize: '0.65rem', padding: '0 4px', fontWeight: 600 }}
                          >
                            📋 Salin
                          </button>
                        </div>
                        <textarea
                          disabled={isReadOnly}
                          style={{ width: '100%', minHeight: '45px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', padding: '8px', color: '#fff', fontSize: '0.74rem', fontFamily: 'monospace', resize: 'vertical', lineHeight: 1.4 }}
                          value={p.t2i_prompt || ''}
                          onChange={(e) => updatePlanField(idx, 't2i_prompt', e.target.value)}
                        />
                      </div>
                    )}

                    {/* Prompt T2V */}
                    {p.t2v_prompt !== undefined && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>Prompt T2V (Text-to-Video)</label>
                          <button
                            type="button"
                            onClick={(e) => {
                              writeToClipboard(p.t2v_prompt || '');
                              const originalText = e.currentTarget.innerText;
                              e.currentTarget.innerText = '✅ Disalin!';
                              setTimeout((btn) => { if (btn) btn.innerText = originalText; }, 1500, e.currentTarget);
                            }}
                            style={{ background: 'transparent', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', fontSize: '0.65rem', padding: '0 4px', fontWeight: 600 }}
                          >
                            📋 Salin
                          </button>
                        </div>
                        <textarea
                          disabled={isReadOnly}
                          style={{ width: '100%', minHeight: '45px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', padding: '8px', color: '#fff', fontSize: '0.74rem', fontFamily: 'monospace', resize: 'vertical', lineHeight: 1.4 }}
                          value={p.t2v_prompt || ''}
                          onChange={(e) => updatePlanField(idx, 't2v_prompt', e.target.value)}
                        />
                      </div>
                    )}

                    {/* Prompt I2V */}
                    {p.i2v_prompt !== undefined && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>Prompt I2V (Motion Prompt)</label>
                          <button
                            type="button"
                            onClick={(e) => {
                              writeToClipboard(p.i2v_prompt || '');
                              const originalText = e.currentTarget.innerText;
                              e.currentTarget.innerText = '✅ Disalin!';
                              setTimeout((btn) => { if (btn) btn.innerText = originalText; }, 1500, e.currentTarget);
                            }}
                            style={{ background: 'transparent', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', fontSize: '0.65rem', padding: '0 4px', fontWeight: 600 }}
                          >
                            📋 Salin
                          </button>
                        </div>
                        <textarea
                          disabled={isReadOnly}
                          style={{ width: '100%', minHeight: '120px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', padding: '8px', color: '#fff', fontSize: '0.74rem', fontFamily: 'monospace', resize: 'vertical', lineHeight: 1.4 }}
                          value={getFormattedPrompt(p.i2v_prompt || '')}
                          onChange={(e) => updatePlanField(idx, 'i2v_prompt', e.target.value)}
                        />
                        {isJsonError(p.i2v_prompt) && (
                          <div style={{ fontSize: '0.68rem', color: '#ff7675', marginTop: '4px', fontWeight: 600 }}>
                            ⚠️ Format JSON tidak valid. Periksa kembali tanda baca (koma, tanda kutip, kurung).
                          </div>
                        )}
                      </div>
                    )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Unified Social Caption Editor */}
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent-light)', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '8px' }}>
                📲 Social Media Package & Caption
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>Caption & Social Media Copy (Unified Single Field)</label>
                <textarea
                  disabled={isReadOnly}
                  style={{ width: '100%', minHeight: '140px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '12px', color: '#fff', fontSize: '0.82rem', resize: 'vertical', lineHeight: 1.5 }}
                  value={sc.caption || sc.tiktok_caption || sc.ig_caption || ''}
                  onChange={(e) => {
                    updateSocialField('caption', e.target.value);
                    updateSocialField('tiktok_caption', e.target.value);
                    updateSocialField('ig_caption', e.target.value);
                  }}
                  placeholder="Caption media sosial lengkap..."
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dna' && (
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 20px 0', fontWeight: '700', fontSize: '0.9rem', color: '#fff' }}>🧬 Video DNA & Narasi Metrik (OPC Campaign)</h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {[
                { field: 'pilar_konten', label: '1. Kategori Pilar Konten', type: 'text' },
                { field: 'hook_type', label: '2. Tipe Hook Pembuka', type: 'text' },
                { field: 'visual_style', label: '3. Gaya Visual Presentasi', type: 'text' },
                { field: 'signature_moment', label: '4. Signature Moment (ASMR)', type: 'text' },
                { field: 'camera_pace', label: '5. Camera Pacing', type: 'text' },
                { field: 'primary_emotion', label: '6. Emosi Utama', type: 'text' },
                { field: 'affiliate_integration', label: '7. Integrasi Penempatan Produk', type: 'text' },
                { field: 'affiliate_mention', label: '8. Metode Penyebutan Produk', type: 'text' },
                { field: 'scene_count', label: '9. Jumlah Klip', type: 'number' },
                { field: 'cta_type', label: '10. Jenis CTA Penutup', type: 'text' }
              ].map(d => (
                <div key={d.field} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{d.label}</label>
                  <input
                    type={d.type}
                    disabled={isReadOnly}
                    value={dna[d.field] ?? ''}
                    onChange={(e) => updateDnaField(d.field, d.type === 'number' ? (parseInt(e.target.value) || 0) : e.target.value)}
                    style={{ width: '100%', padding: '8px', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', borderRadius: '4px', fontSize: '0.8rem' }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'assets' && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            marginBottom: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h4 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '0.95rem', fontWeight: 700 }}>☁️ Asset Vault & Cloud Recovery Panel</h4>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Kelola aset lokal (T2I, I2V, TTS, MD) dan unggah manual ke Nextcloud / Drive meskipun pipeline belum komplit.
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {item.nextcloud_folder_url && (
                  <a
                    href={item.nextcloud_folder_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.72rem', padding: '6px 12px', background: 'rgba(52, 152, 219, 0.2)', borderColor: 'rgba(52, 152, 219, 0.4)', color: '#3498db' }}
                  >
                    🔗 Buka Folder Nextcloud
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleSyncItemAssets}
                  disabled={syncingItemAssets[item.id]}
                  className="btn btn-primary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '6px 14px', fontWeight: 600 }}
                >
                  {syncingItemAssets[item.id] ? '⏳ Syncing...' : '📤 Sync ALL Available Assets to Cloud'}
                </button>
              </div>
            </div>

            <div>
              <h5 style={{ margin: '0 0 12px 0', color: 'var(--accent-light)', fontSize: '0.82rem', fontWeight: 700 }}>
                🎬 Status Aset per Klip & Pemulihan Granular
              </h5>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '8px' }}>Klip</th>
                      <th style={{ padding: '8px' }}>🖼️ Start Frame (T2I)</th>
                      <th style={{ padding: '8px' }}>🎥 Motion Video (I2V)</th>
                      <th style={{ padding: '8px' }}>🎵 Voiceover (TTS)</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Aksi Pemulihan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.map((p, idx) => {
                      const cIdx = p.clip_index || (idx + 1);
                      const clipImgPath = t2iImages[idx];
                      let resultObj = {};
                      try { resultObj = JSON.parse(item.result_json || '{}'); } catch(e){}
                      const vPaths = resultObj.downloaded_video_paths || resultObj.video_paths || [];
                      const clipVidPath = vPaths[idx];

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '10px 8px', fontWeight: 700, color: '#fff' }}>Klip #{cIdx}</td>
                          <td style={{ padding: '10px 8px' }}>
                            {clipImgPath ? (
                              <span style={{ color: '#2ecc71', fontWeight: 600 }}>✅ Ready</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>❌ Missing</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 8px' }}>
                            {clipVidPath ? (
                              <span style={{ color: '#2ecc71', fontWeight: 600 }}>✅ Ready</span>
                            ) : item.status === 'failed' || item.workflow_status === 'failed' ? (
                              <span style={{ color: '#e74c3c', fontWeight: 600 }}>❌ Failed</span>
                            ) : (
                              <span style={{ color: '#f1c40f', fontWeight: 600 }}>⏳ Pending</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 8px' }}>
                            <span style={{ color: '#2ecc71', fontWeight: 600 }}>✅ Script Ready</span>
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Aset Tersedia</span>
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

        {activeTab === 'logs' && renderLogs(item)}

        {/* Workflow & Production Settings Form */}
        {(item.workflow_status === 'ready_for_review' || isProductionFailed) && activeTab === 'storyboard' && (
          <>
            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '16px 20px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontWeight: '700', fontSize: '0.8rem', color: 'var(--accent-light)' }}>⚙️ Workflow & Production Settings (Fase 2)</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label className="switch">
                      <input type="checkbox" checked={!!settings.enable_tts} disabled={isReadOnly} onChange={() => toggleSetting('enable_tts')} />
                      <span className="slider round"></span>
                    </label>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Generate TTS (Audio Voiceover)</span>
                  </div>
                  {settings.enable_tts && (
                    <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>Voice Provider</label>
                        <select
                          disabled={isReadOnly || (campaign.enable_audio_segment === 1 && voiceCast && voiceCast.length > 0)}
                          value={settings.voice_provider || 'minimax'}
                          onChange={(e) => {
                            const prov = e.target.value;
                            updateSettingField('voice_provider', prov);
                            if (prov === 'gemini') {
                              updateSettingField('voice_persona', 'Kore');
                            } else {
                              updateSettingField('voice_persona', campaign.target_language === 'en-US' ? 'English_causual_narrator_vv1' : 'Indonesian_casual_reporter_vv2');
                            }
                          }}
                          style={{ width: '100%', padding: '6px 8px', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', fontSize: '0.75rem' }}
                        >
                          <option value="gemini">Google Gemini TTS</option>
                          <option value="minimax">MiniMax Speech</option>
                        </select>
                        {campaign.enable_audio_segment === 1 && voiceCast && voiceCast.length > 0 && (
                          <div style={{ fontSize: '0.65rem', color: '#ff7675', marginTop: '4px', fontWeight: 600 }}>
                            🔒 Voice cast terdaftar. Pilihan provider dikunci untuk konsistensi Fase 2.
                          </div>
                        )}
                      </div>

                      {campaign.enable_audio_segment !== 1 ? (
                        <div>
                          <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>Voice Persona</label>
                          <select
                            disabled={isReadOnly}
                            value={settings.voice_persona || 'Indonesian_casual_reporter_vv2'}
                            onChange={(e) => updateSettingField('voice_persona', e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', fontSize: '0.75rem' }}
                          >
                            {settings.voice_provider === 'gemini' ? (
                              GEMINI_VOICES.map(v => <option key={v.id} value={v.id}>{v.avatar} {v.name} - {v.desc}</option>)
                            ) : (
                              (campaign.target_language === 'en-US' ? MINIMAX_ENGLISH_VOICES : MINIMAX_VOICES).map(v => <option key={v.id} value={v.id}>{v.avatar} {v.name} - {v.desc}</option>)
                            )}
                          </select>
                        </div>
                      ) : (
                        <div style={{ marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>🎭 Voice Cast Configuration</span>
                          {voiceCast.length === 0 ? (
                            <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.72rem', padding: '4px 0' }}>
                              Belum ada karakter yang terdeteksi. Jalankan analisis (Fase 1) untuk mendaftarkan karakter secara otonom.
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {voiceCast.map((ch, idx) => (
                                <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--accent-light)' }}>{ch.name}</span>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>ID: {ch.id}</span>
                                  </div>
                                  <select
                                    disabled={isReadOnly}
                                    value={settings.voice_provider === 'gemini' ? (ch.gemini_voice_id || 'Kore') : (ch.minimax_voice_id || 'Indonesian_casual_reporter_vv2')}
                                    style={{ width: '100%', padding: '4px 6px', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', fontSize: '0.7rem' }}
                                    onChange={e => {
                                      const a = [...voiceCast];
                                      if (settings.voice_provider === 'gemini') {
                                        a[idx] = { ...a[idx], gemini_voice_id: e.target.value };
                                      } else {
                                        a[idx] = { ...a[idx], minimax_voice_id: e.target.value };
                                      }
                                      setVoiceCast(a);
                                      updateCampaignSettings({
                                        voice_cast_json: JSON.stringify({ characters: a })
                                      });
                                    }}
                                  >
                                    {settings.voice_provider === 'gemini' ? (
                                      GEMINI_VOICES.map(v => (
                                        <option key={v.id} value={v.id}>{v.avatar} {v.name}</option>
                                      ))
                                    ) : (
                                      (campaign.target_language === 'en-US' ? MINIMAX_ENGLISH_VOICES : MINIMAX_VOICES).map(v => (
                                        <option key={v.id} value={v.id}>{v.avatar} {v.name}</option>
                                      ))
                                    )}
                                  </select>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px', fontWeight: 600 }}>Speed ({settings.voice_speed || 1.0}x)</label>
                          <input type="range" min="0.5" max="2.0" step="0.1" disabled={isReadOnly} value={settings.voice_speed || 1.0} onChange={(e) => updateSettingField('voice_speed', Number(e.target.value))} style={{ width: '100%' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px', fontWeight: 600 }}>Volume ({settings.voice_volume || 1.0}x)</label>
                          <input type="range" min="0.0" max="2.0" step="0.1" disabled={isReadOnly} value={settings.voice_volume || 1.0} onChange={(e) => updateSettingField('voice_volume', Number(e.target.value))} style={{ width: '100%' }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label className="switch">
                      <input type="checkbox" checked={!!settings.enable_glabs} disabled={isReadOnly} onChange={() => toggleSetting('enable_glabs')} />
                      <span className="slider round"></span>
                    </label>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Generate Video (G-Labs AI Video)</span>
                  </div>
                  {settings.enable_glabs && (
                    <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '12px 14px', fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      ℹ️ Menggunakan model video kustom Veo/Kling. Klip bridge yang menggunakan start frame akan dijalankan dengan I2V (Image-to-Video), klip lain dijalankan dengan T2V (Text-to-Video).
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label className="switch">
                      <input type="checkbox" checked={!!settings.enable_ffmpeg} disabled={isReadOnly} onChange={() => toggleSetting('enable_ffmpeg')} />
                      <span className="slider round"></span>
                    </label>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>FFmpeg Muxing & Compiling</span>
                  </div>
                  {settings.enable_ffmpeg && (
                    <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>Sync Option</label>
                        <select
                          disabled={isReadOnly}
                          value={settings.ffmpeg_sync_option || 'smart_sync'}
                          onChange={(e) => updateSettingField('ffmpeg_sync_option', e.target.value)}
                          style={{ width: '100%', padding: '6px 8px', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', fontSize: '0.72rem' }}
                        >
                          <option value="smart_sync">Auto-Pilot Smart Sync</option>
                          <option value="shortest">Shortest Clip</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px', fontWeight: 600 }}>Video Scale Zoom ({settings.ffmpeg_video_scale || 1.0}x)</label>
                        <input type="range" min="0.5" max="2.0" step="0.05" disabled={isReadOnly} value={settings.ffmpeg_video_scale || 1.0} onChange={(e) => updateSettingField('ffmpeg_video_scale', Number(e.target.value))} style={{ width: '100%' }} />
                      </div>

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px', fontWeight: 600 }}>SFX Vol ({settings.ffmpeg_sfx_volume || 0.0}x)</label>
                          <input type="range" min="0.0" max="2.0" step="0.05" disabled={isReadOnly} value={settings.ffmpeg_sfx_volume || 0.0} onChange={(e) => updateSettingField('ffmpeg_sfx_volume', Number(e.target.value))} style={{ width: '100%' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px', fontWeight: 600 }}>BGM Vol ({settings.ffmpeg_bgm_volume !== undefined ? settings.ffmpeg_bgm_volume : 0.0}x)</label>
                          <input type="range" min="0.0" max="1.0" step="0.05" disabled={isReadOnly} value={settings.ffmpeg_bgm_volume !== undefined ? settings.ffmpeg_bgm_volume : 0.0} onChange={(e) => updateSettingField('ffmpeg_bgm_volume', Number(e.target.value))} style={{ width: '100%' }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={savingDraft[item.id] || approvingItems[item.id]}
                onClick={handleSaveDraft}
                style={{ padding: '12px 24px', fontSize: '0.9rem', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {savingDraft[item.id] ? '⏳ Menyimpan...' : '💾 Simpan Perubahan (Save Draft)'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={savingDraft[item.id] || approvingItems[item.id]}
                onClick={handleApprove}
                style={{ background: 'var(--success)', borderColor: 'var(--success)', padding: '12px 24px', fontSize: '0.9rem', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {approvingItems[item.id] ? '⏳ Memproses Rilis...' : '🚀 Approve & Proceed to Production'}
              </button>
            </div>
          </>
        )}

        {item.workflow_status === 'completed' && !isProductionFailed && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
            <h4 style={{ margin: 0, fontWeight: '700', fontSize: '0.85rem', color: '#fff' }}>🎬 Hasil Render Video Akhir (Final Output)</h4>

            <div style={{ display: 'grid', gridTemplateColumns: item.ffmpeg_output_path ? '1fr 2fr' : '1fr', gap: '20px', alignItems: 'center' }}>
              {item.ffmpeg_output_path ? (
                <div style={{ display: 'flex', justifyContent: 'center', background: '#000', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '380px' }}>
                  <video src={item.ffmpeg_output_path} controls preload="metadata" style={{ width: '100%', maxHeight: '380px', display: 'block' }} />
                </div>
              ) : (
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.1)', padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  🎥 File video belum dikompilasi / langkah FFmpeg di-skip.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Anda dapat memutar dan meninjau video final di atas. Jika ingin mempublikasikannya, gunakan tombol draf di bawah. Jika ingin mengubah musik latar atau kecepatan suara, sesuaikan parameter dan render ulang video.
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {item.ffmpeg_output_path && (
                    <a href={item.ffmpeg_output_path} download className="btn btn-primary" style={{ padding: '8px 16px', textDecoration: 'none', background: 'var(--success)', borderColor: 'var(--success)', fontWeight: 600 }}>
                      ⬇️ Unduh Video (.mp4)
                    </a>
                  )}

                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={recompressingItems[item.id]}
                    onClick={handleRecompilation}
                    style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {recompressingItems[item.id] ? '⏳ Merender...' : '🔄 Re-FFMPEG'}
                  </button>

                  {item.ffmpeg_output_path && (
                    <button
                      type="button"
                      disabled={triggering[`${item.id}-social`]}
                      onClick={handlePostFacebook}
                      style={{ padding: '8px 16px', background: 'rgba(24, 119, 242, 0.15)', color: '#1877f2', border: '1px solid rgba(24, 119, 242, 0.4)', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600, borderRadius: '4px' }}
                    >
                      {triggering[`${item.id}-social`] ? '⏳' : '📲 Draft ke Facebook Page'}
                    </button>
                  )}
                </div>

                {item.social_links_json && (
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.78rem', marginTop: '10px' }}>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>Tautan Distribusi:</div>
                    {(() => {
                      try {
                        const links = JSON.parse(item.social_links_json);
                        return (
                          <div style={{ display: 'flex', gap: '12px' }}>
                            {links.facebook && <a href={links.facebook} target="_blank" rel="noreferrer" style={{ color: '#1877f2', textDecoration: 'underline' }}>Facebook Publishing Tools</a>}
                            {links.fb_post_id && <span style={{ color: 'var(--text-muted)' }}>(ID: {links.fb_post_id})</span>}
                            {links.facebook_error && <span style={{ color: 'var(--danger)' }}>Error: {links.facebook_error}</span>}
                          </div>
                        );
                      } catch {
                        return null;
                      }
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading || !campaign) {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <p>Memuat detail kampanye...</p>
        </main>
      </div>
    );
  }

  const isVsoActive = !!campaign.visual_overrides_json;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Link href="/pillar-campaigns" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem' }}>
              ← Kembali ke Dashboard
            </Link>
          </div>

          {toast && (
            <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
              {toast.msg}
            </div>
          )}

          {/* 1 & 2: Header Card Detail Kampanye */}
          <div className="card" style={{ marginBottom: 24, padding: 32 }}>
            {/* 1. Judul Kampanye */}
            <div>
              <Link href="/pillar-campaigns" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>
                ← Kembali ke Dashboard
              </Link>
              <h1 style={{ margin: '4px 0 0 0', fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.5px' }}>🎬 {campaign.campaign_name}</h1>
              
              {/* 2. ID Kampanye | Nama Akun Brand | Created Date */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12, fontSize: '0.9rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', paddingBottom: 16, marginBottom: 20 }}>
                <span>🔑 ID: <code style={{ background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: '4px', color: 'var(--accent-light)', fontFamily: 'monospace', fontSize: '0.85rem' }}>{campaign.id}</code></span>
                <span style={{ opacity: 0.3 }}>|</span>
                <span>🏷️ Brand: <strong>{campaign.brand_name || 'Tidak Ditentukan'}</strong></span>
                <span style={{ opacity: 0.3 }}>|</span>
                <span>📅 Dibuat: <strong>{new Date(campaign.created_at).toLocaleString('id-ID')}</strong></span>
              </div>
            </div>

            {/* 3. Tombol Aksi Utama */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button 
                className="btn"
                onClick={toggleStatus}
                style={{
                  background: campaign.status === 'running' ? 'linear-gradient(135deg, #e67e22 0%, #d35400 100%)' : 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)',
                  color: '#fff', border: 'none', padding: '10px 16px', fontWeight: 600, borderRadius: '6px', cursor: 'pointer',
                  boxShadow: campaign.status === 'running' ? '0 4px 12px rgba(230, 126, 34, 0.3)' : '0 4px 12px rgba(46, 204, 113, 0.3)'
                }}
              >
                {campaign.status === 'running' ? '⏸️ Pause Campaign' : '🟢 Start Campaign'}
              </button>
              <button 
                className="btn"
                onClick={handleSyncContentFlow}
                disabled={syncing}
                style={{
                  background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
                  color: '#fff', border: 'none', padding: '10px 16px', fontWeight: 600, borderRadius: '6px', cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(52, 152, 219, 0.3)'
                }}
              >
                🚀 Push to Contentflow
              </button>
              <button 
                className="btn"
                onClick={handleSyncDrive}
                disabled={syncing}
                style={{
                  background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)',
                  color: '#fff', border: 'none', padding: '10px 16px', fontWeight: 600, borderRadius: '6px', cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(26, 188, 156, 0.3)'
                }}
              >
                {syncing ? '⏳ Syncing...' : '☁️ Sync to Cloud'}
              </button>
              {campaign.target_spreadsheet_id && (
                <a
                  href={`https://docs.google.com/spreadsheets/d/${campaign.target_spreadsheet_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{
                    padding: '10px 16px', fontWeight: 600, borderRadius: '6px', cursor: 'pointer', textDecoration: 'none'
                  }}
                >
                  📊 Open Google Sheet
                </a>
              )}
            </div>
          </div>

          {/* 4. Accordion Info Konfigurasi */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px', marginBottom: '24px' }}>
            
            {/* Accordion A: Info Konfigurasi Basic Creative Strategy */}
            <details open style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
              <summary style={{ padding: '16px 20px', fontWeight: 600, fontSize: '0.92rem', cursor: 'pointer', outline: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
                <span>📂 Info Konfigurasi Basic Creative Strategy</span>
              </summary>
              <div style={{ padding: '20px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>🏷️ Nama Akun (Brand Account)</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.brand_name || 'Tidak Ditentukan'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Parent Folder Nextcloud</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.nextcloud_parent_folder || 'Default Parent Folder'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Bahasa Naskah Voiceover (Script Language)</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.target_language || 'id-ID'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>🎯 Target Demografi & Tone Bahasa</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{getDemographicLabel(campaign.target_demographic, campaign.target_demographic_custom)}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>🎙 Audio Segment (per Klip)</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Provider: {campaign.voice_provider || 'minimax'} | Persona: {campaign.voice_persona || 'reporter_vv2'} | Speed: {campaign.voice_speed || 1.0}x</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>SFX Setting</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.sfx_setting === 'without_sfx' ? 'Tanpa SFX' : 'Dengan SFX'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Audit Kepatuhan Voiceover (TikTok Safe)</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.compliance_audit || 'Aktif (TikTok Safe)'}</span>
                </div>
                {campaign.custom_instruction && (
                  <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Custom Instruction (Opsional)</span>
                    <pre style={{ margin: 0, padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)', fontSize: '0.82rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
                      {campaign.custom_instruction}
                    </pre>
                  </div>
                )}
                {campaign.brand_profile_desc && (
                  <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>🧬 Brand Profile (Opsional)</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>{campaign.brand_profile_desc}</span>
                  </div>
                )}
              </div>
            </details>

            {/* Accordion B: Info Konfigurasi Aesthetics & Visual Settings */}
            <details style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
              <summary style={{ padding: '16px 20px', fontWeight: 600, fontSize: '0.92rem', cursor: 'pointer', outline: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
                <span>🎬 Info Konfigurasi Aesthetics & Visual Settings</span>
              </summary>
              <div style={{ padding: '20px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Narrative Mode</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.narrative_mode || 'Storytelling / Casual'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Aspect Ratio</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.aspect_ratio || '9:16'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Target AI</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.target_ai || 'Google Gemini 3.6-flash'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Video Model</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.video_model || 'Google Veo'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Face Visibility</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.face_visibility || 'Faceless'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Jumlah Klip Video (N)</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.target_clips_count || 3} clips</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Jumlah Kata Per Klip</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.words_per_clip || '15 - 20 Kata'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Visual Style</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.visual_style || 'Cinematic'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Visual Mode</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.visual_mode || 'T2V & I2V'}</span>
                </div>
              </div>
            </details>

            {/* Accordion C: Info Konfigurasi Product Bridging Settings */}
            <details style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
              <summary style={{ padding: '16px 20px', fontWeight: 600, fontSize: '0.92rem', cursor: 'pointer', outline: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
                <span>🌉 Info Konfigurasi Product Bridging Settings</span>
              </summary>
              <div style={{ padding: '20px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Bridging Promosi Produk</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.is_bridging_active === 1 ? 'Aktif' : 'Nonaktif'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Klip Target Promosi</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Klip Ke-{campaign.bridge_at_clip || 2}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Durasi Bridge</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.bridge_duration_clips || 1} Klip</span>
                </div>
                <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Instruksi Transisi Bridge</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.bridge_instruction || 'Default transition layout'}</span>
                </div>
              </div>
            </details>

            {/* Accordion D: Info Konfigurasi Visual Swap Overrides */}
            <details style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
              <summary style={{ padding: '16px 20px', fontWeight: 600, fontSize: '0.92rem', cursor: 'pointer', outline: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
                <span>🎭 Info Konfigurasi Visual Swap Overrides</span>
              </summary>
              <div style={{ padding: '20px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Konsep Karakter (Framing)</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.face_visibility || 'Faceless Close-Up Shot'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Demografi Subjek / Model</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{getDemographicLabel(campaign.target_demographic, campaign.target_demographic_custom)}</span>
                </div>
                <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Pencahayaan & Gaya Sinematik (Lighting Ambiance)</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.visual_style || 'Cinematic Warm Moody Accent'}</span>
                </div>
              </div>
            </details>
            
          </div>



          {/* CAMPAIGN ITEMS GENERATION DETAIL SECTION */}
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '32px 0 16px 0' }}>📦 Item Produksi Video</h2>

          {items.length === 0 ? (
            <div className="card">
              <p style={{ color: 'var(--text-muted)' }}>Belum ada item terdaftar untuk kampanye ini.</p>
            </div>
          ) : (
            <div className="card">
              <div className="card-title"><span className="icon">📋</span> Daftar Video Item ({items.length})</div>
              <table className="ideas-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr>
                    <th style={{ width: '4%' }}>#</th>
                    <th style={{ width: '36%' }}>Video Item / Pilar</th>
                    <th style={{ width: '40%' }}>Fase</th>
                    <th style={{ width: '20%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const activeTab = activeTabs[item.id] || 'concept';
                    const hasFinalVideo = item.ffmpeg_output_path && item.ffmpeg_output_path !== 'skipped';

                    // Parse properties from payload/campaign for the summary row
                    let pillar = '-';
                    let hook = '-';
                    let payload = {};
                    if (campaign?.is_mass_production === 1) {
                      try {
                        payload = item.row_creative_payload ? JSON.parse(item.row_creative_payload) : {};
                      } catch (_) {}
                      pillar = payload.content_pillar || '-';
                      hook = payload.custom_hook || payload.hook || '-';
                    } else {
                      pillar = campaign?.content_pillar || '-';
                      hook = campaign?.custom_hook || campaign?.hook || '-';
                      try {
                        if (item.row_creative_payload) {
                          payload = JSON.parse(item.row_creative_payload);
                          pillar = payload.content_pillar || pillar;
                          hook = payload.custom_hook || hook;
                        }
                      } catch (_) {}
                    }

                    return (
                      <Fragment key={item.id}>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', padding: '14px 16px' }}>{index + 1}</td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                              Video Item #{index + 1}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                              Pilar: {pillar.length > 55 ? pillar.slice(0, 55) + '…' : pillar}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>
                              Hook: {hook.length > 45 ? `"${hook.slice(0, 45)}…"` : `"${hook}"`}
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            {renderItemStatus(item, campaign)}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                                className="btn btn-secondary btn-sm"
                                style={{
                                  fontSize: '0.7rem',
                                  padding: '3px 8px',
                                  background: expandedItemId === item.id ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                                  color: '#fff',
                                  border: '1px solid rgba(255,255,255,0.1)'
                                }}
                              >
                                {expandedItemId === item.id ? '📖 Tutup' : '📖 Detail'}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {expandedItemId === item.id && (
                          <tr>
                            <td colSpan="4" style={{ background: 'var(--bg-secondary)', padding: '24px', borderTop: 'none', borderBottom: '1px solid var(--border-color)' }}>
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: 12, marginBottom: 12 }}>
                                  <div>
                                    <strong style={{ fontSize: '1.1rem' }}>Video Item #{index + 1} Workspace</strong>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 8 }}>
                                      (ID: #{item.id}) | Dibuat: {new Date(item.created_at).toLocaleString('id-ID')}
                                    </span>
                                  </div>
                                  <span className={`badge ${getStageBadgeClass(item.workflow_status === 'completed' ? 'completed' : item.workflow_status === 'production_processing' ? 'processing' : 'pending')}`}>
                                    {item.workflow_status ? item.workflow_status.toUpperCase() : 'PENDING'}
                                  </span>
                                </div>

                                {/* PIPELINE STATS ROW */}
                                {renderPipelineProgressBar(item)}

                                <div style={{ marginTop: 16 }}>
                                  {(item.workflow_status && item.new_video_plan_json) ? (
                                    renderV2Workbench(item)
                                  ) : (
                                    <>
                                      {/* Tab Headers */}
                                      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: 12, marginBottom: 16, overflowX: 'auto' }}>
                                        {[
                                          { id: 'concept', label: '💡 Konsep Awal & Produk' },
                                          { id: 'storyboard', label: '📖 Storyboard' },
                                          { id: 'voiceover', label: '🎤 Voiceover' },
                                          { id: 'prompts', label: '🤖 AI Video Prompt' },
                                          { id: 'social', label: '📱 Social Draft' },
                                          { id: 'logs', label: '🖥 System Log' }
                                        ].map(t => (
                                          <button
                                            key={t.id}
                                            className={`btn ${activeTab === t.id ? 'btn-primary' : 'btn-secondary'}`}
                                            onClick={() => setActiveTabs(prev => ({ ...prev, [item.id]: t.id }))}
                                            style={{ 
                                              padding: '6px 12px', 
                                              fontSize: '0.8rem',
                                              borderBottom: activeTab === t.id ? '2px solid var(--accent-color)' : 'none',
                                              background: activeTab === t.id ? 'var(--btn-primary-bg)' : 'transparent',
                                              whiteSpace: 'nowrap'
                                            }}
                                          >
                                            {t.label}
                                          </button>
                                        ))}
                                      </div>

                                      {/* Tab Content */}
                                      <div style={{ minHeight: '200px' }}>
                                        {activeTab === 'concept' && renderConcept(item)}
                                        {activeTab === 'storyboard' && renderStoryboard(item)}
                                        {activeTab === 'voiceover' && (
                                          <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            <p>Data voiceover untuk item ini tersedia melalui pipeline TTS. Lihat System Log untuk detail proses audio.</p>
                                            {item.tts_audio_path && (
                                              <div style={{ marginTop: 12 }}>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Audio Preview</label>
                                                <audio controls src={item.tts_audio_path} style={{ width: '100%' }} />
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        {activeTab === 'prompts' && renderPrompts(item)}
                                        {activeTab === 'social' && renderSocial(item)}
                                        {activeTab === 'logs' && renderLogs(item)}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
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

        </div>
      </main>
    </div>
  );
}
