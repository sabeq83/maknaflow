'use client';

import Sidebar from '../../components/Sidebar';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { normalizeAudioConfig, syncAudioConfigKeyValue } from '@/lib/multiplier-audio-config';

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

function renderPhaseBadge(task) {
  let text = '⚡ Fase 1 : Pending';
  let color = 'var(--text-muted)';
  let bg = 'var(--surface-interactive)';
  let border = 'var(--border-subtle)';
  let isPulse = false;

  switch (task.status) {
    case 'draft':
      text = '📝 Fase 1 : Draft (Belum Dimulai)';
      color = 'var(--text-muted)';
      bg = 'var(--surface-interactive)';
      break;
    case 'pending_resolution':
      text = '⏳ Fase 1 : Queue for Generation';
      color = 'var(--text-muted)';
      bg = 'var(--surface-interactive)';
      break;
    case 'resolving_product':
      text = '⚡ Fase 1 : Resolving Product DNA';
      color = 'var(--status-neutral)';
      bg = 'var(--status-neutral-soft)';
      border = 'var(--status-neutral-soft)';
      isPulse = true;
      break;
    case 'remaking':
      text = '⚡ Fase 1 : AI Storyboard Remake';
      color = 'var(--status-info)';
      bg = 'var(--status-info-soft)';
      border = 'var(--status-info-soft)';
      isPulse = true;
      break;
    case 'generating_t2i':
      text = '⚡ Fase 1 : Generasi T2I Start Frames';
      color = 'var(--status-info)';
      bg = 'var(--status-info-soft)';
      border = 'var(--status-info-soft)';
      isPulse = true;
      break;
    case 'waiting_approval':
      text = '⏸️ Fase 2 : Paused (Ready for Review)';
      color = 'var(--status-warning)';
      bg = 'var(--status-warning-soft)';
      border = 'var(--status-warning-soft)';
      break;
    case 'generating_audio':
      text = '⚡ Fase 2 : Generasi TTS Audio';
      color = 'var(--status-info)';
      bg = 'var(--status-info-soft)';
      border = 'var(--status-info-soft)';
      isPulse = true;
      break;
    case 'generating_visuals':
      text = '⚡ Fase 2 : Generasi I2V Video (G-Labs)';
      color = 'var(--status-neutral)';
      bg = 'var(--status-neutral-soft)';
      border = 'var(--status-neutral-soft)';
      isPulse = true;
      break;
    case 'ffmpeg_muxing':
      text = '⚡ Fase 2 : FFMPEG Process & Assembly';
      color = 'var(--status-info)';
      bg = 'var(--status-info-soft)';
      border = 'var(--status-info-soft)';
      isPulse = true;
      break;
    case 'uploading_assets':
      text = '⚡ Fase 2 : Uploading Assets (Nextcloud)';
      color = 'var(--action-primary)';
      bg = 'rgba(45, 212, 191, 0.15)';
      border = 'rgba(45, 212, 191, 0.3)';
      isPulse = true;
      break;
    case 'completed':
      text = '✅ Fase 2 : Completed';
      color = 'var(--status-success)';
      bg = 'var(--status-success-soft)';
      border = 'var(--status-success-soft)';
      break;
    case 'failed':
      text = `⚠️ Error: ${task.error_message ? task.error_message.slice(0, 35) + '...' : 'Gagal'}`;
      color = 'var(--status-danger)';
      bg = 'var(--status-danger-soft)';
      border = 'var(--status-danger-soft)';
      break;
    default:
      text = `⚡ ${task.status}`;
      color = 'var(--text-secondary)';
      bg = 'var(--surface-interactive)';
  }

  return (
    <span style={{
      padding: '6px 12px',
      borderRadius: 6,
      fontWeight: 600,
      fontSize: '0.8rem',
      color: color,
      background: bg,
      border: `1px solid ${border}`,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      whiteSpace: 'nowrap',
      animation: isPulse ? 'pulse 2s infinite ease-in-out' : 'none'
    }}>
      {text}
    </span>
  );
}

function CampaignDetailPageContent() {
  const { id } = useParams();
  const router = useRouter();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [isSchedulerActive, setIsSchedulerActive] = useState(true);
  const [togglingScheduler, setTogglingScheduler] = useState(false);
  const [syncingContentFlow, setSyncingContentFlow] = useState(false);
  const [syncingNextcloud, setSyncingNextcloud] = useState(false);
  const [startingCampaign, setStartingCampaign] = useState(false);
  const [retryingTask, setRetryingTask] = useState({}); // { [taskId]: boolean }
  
  // Expanded row and tab selection
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [activeTabs, setActiveTabs] = useState({}); // { [taskId]: 'storyboard' | 'deconstruct' | 'vault' | 'dna' | 'logs' }
  const [terminalLogs, setTerminalLogs] = useState('');
  
  // Inline editing states for expanded task workbenches
  const [editedStoryboards, setEditedStoryboards] = useState({}); // { [taskId]: [clips] }
  const [editedCaptions, setEditedCaptions] = useState({}); // { [taskId]: string }
  const [editedYtTitles, setEditedYtTitles] = useState({}); // { [taskId]: string }
  const [editedDnas, setEditedDnas] = useState({}); // { [taskId]: dnaObj }
  const [editedAudioConfigs, setEditedAudioConfigs] = useState({}); // { [taskId]: audioConfigObj }
  
  // Regeneration and replacement loadings
  const [batchRegeneratingSF, setBatchRegeneratingSF] = useState({}); // { [taskId]: boolean }
  const [regeneratingT2I, setRegeneratingT2I] = useState({}); // { [`${taskId}_${clipIndex}`]: boolean }
  const [replacingSF, setReplacingSF] = useState({}); // { [`${taskId}_${clipIndex}`]: boolean }
  const [actionLoading, setActionLoading] = useState({}); // { [taskId]: boolean }

  const pollingRef = useRef(null);

  useEffect(() => {
    fetchTasks();
    pollLogs();
    
    pollingRef.current = setInterval(() => {
      fetchTasks(true);
    }, 5000);

    const logInterval = setInterval(pollLogs, 3000);

    return () => {
      clearInterval(pollingRef.current);
      clearInterval(logInterval);
    };
  }, [id]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchTasks = async (isPoll = false) => {
    if (!isPoll) setLoading(true);
    try {
      const res = await fetch(`/api/v2/multiplier?batchId=${id}`);
      const data = await res.json();
      if (data.success) {
        const sorted = (data.tasks || []).sort((a, b) => {
          const aIdx = (a.row_index !== null && a.row_index !== undefined) ? Number(a.row_index) : 0;
          const bIdx = (b.row_index !== null && b.row_index !== undefined) ? Number(b.row_index) : 0;
          if (aIdx !== bIdx) return aIdx - bIdx;
          return (a.id || '').localeCompare(b.id || '', undefined, { numeric: true });
        });
        setTasks(sorted);
        if (data.isSchedulerActive !== undefined) {
          setIsSchedulerActive(data.isSchedulerActive);
        }
        
        // Populate local states for editing if not already set (functional updater prevents stale closure overwrites)
        data.tasks.forEach(t => {
          setEditedStoryboards(prev => {
            if (prev[t.id] && prev[t.id].length > 0) return prev;
            let storyboard = [];
            try {
              storyboard = JSON.parse(t.remake_storyboard_json || '[]');
            } catch (_) {}
            
            let prompts = [];
            try {
              prompts = JSON.parse(t.t2i_i2v_prompts_json || '[]');
            } catch (_) {}

            const combined = storyboard.map((scene, idx) => {
              const p = prompts[idx] || {};
              return {
                ...scene,
                narration: scene.narration_transcript || scene.voiceover || scene.narration || '',
                t2i_prompt: p.t2i_prompt || '',
                i2v_prompt: p.i2v_prompt || p.t2v_prompt || ''
              };
            });
            return combined.length > 0 ? { ...prev, [t.id]: combined } : prev;
          });

          setEditedCaptions(prev => {
            if (prev[t.id] !== undefined && prev[t.id] !== '') return prev;
            return { ...prev, [t.id]: t.new_caption || '' };
          });

          setEditedYtTitles(prev => {
            if (prev[t.id] !== undefined && prev[t.id] !== '') return prev;
            return { ...prev, [t.id]: t.yt_title || '' };
          });

          setEditedDnas(prev => {
            if (prev[t.id]) return prev;
            let dna = {};
            try {
              dna = JSON.parse(t.vso_config_json || '{}');
            } catch (_) {}
            return { ...prev, [t.id]: dna };
          });

          setEditedAudioConfigs(prev => {
            if (prev[t.id]) return prev;
            return { ...prev, [t.id]: normalizeAudioConfig(t.audio_config_json) };
          });
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!isPoll) setLoading(false);
    }
  };

  const pollLogs = async () => {
    try {
      const res = await fetch(`/api/system-logs?type=multiplier&t=${Date.now()}`);
      const text = await res.text();
      setTerminalLogs(text);
    } catch (_) {}
  };

  const handleGenerateAllT2I = async (taskId) => {
    if (!confirm('Apakah Anda yakin ingin meregenerasi semua start frame T2I untuk adegan ini di latar belakang?')) return;
    setBatchRegeneratingSF(prev => ({ ...prev, [taskId]: true }));
    try {
      const res = await fetch(`/api/v2/multiplier/${taskId}/regenerate-start-frames`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        showToast('Proses regenerasi semua start frame telah dimulai di latar belakang.');
        fetchTasks(true);
      } else {
        showToast(data.error || 'Gagal memulai regenerasi massal.', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBatchRegeneratingSF(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const handleRegenerateT2I = async (taskId, clipIndex, prompt) => {
    if (!prompt) {
      showToast("T2I prompt kosong, mohon masukkan deskripsi prompt terlebih dahulu.", "error");
      return;
    }
    const taskKey = `${taskId}_${clipIndex}`;
    setRegeneratingT2I(prev => ({ ...prev, [taskKey]: true }));
    try {
      const res = await fetch(`/api/v2/multiplier/${taskId}/regenerate-t2i`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipIndex, t2i_prompt: prompt })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Gambar T2I klip ${clipIndex} berhasil diregenerasi!`);
        fetchTasks();
      } else {
        showToast(data.error || 'Gagal meregenerasi gambar.', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setRegeneratingT2I(prev => ({ ...prev, [taskKey]: false }));
    }
  };

  const handleReplaceStartFrame = async (taskId, clipIndex, file) => {
    if (!file) return;
    const taskKey = `${taskId}_${clipIndex}`;
    setReplacingSF(prev => ({ ...prev, [taskKey]: true }));
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('clipIndex', clipIndex);

    try {
      const res = await fetch(`/api/v2/multiplier/${taskId}/replace-start-frame`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Start frame klip ${clipIndex} berhasil diganti!`);
        fetchTasks();
      } else {
        showToast(data.error || 'Gagal mengganti gambar.', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setReplacingSF(prev => ({ ...prev, [taskKey]: false }));
    }
  };

  const handleSaveChanges = async (taskId) => {
    setActionLoading(prev => ({ ...prev, [taskId]: true }));
    try {
      const task = tasks.find(t => t.id === taskId);
      const currentAudio = normalizeAudioConfig(editedAudioConfigs[taskId] || task.audio_config_json);
      const res = await fetch(`/api/v2/multiplier/${taskId}/update-creative`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyboard: editedStoryboards[taskId],
          vsoConfig: JSON.parse(task.vso_config_json || '{}'),
          bridgingConfig: JSON.parse(task.bridging_config_json || '{}'),
          audioConfig: currentAudio,
          newCaption: editedCaptions[taskId],
          ytTitle: editedYtTitles[taskId]
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Perubahan kreatif berhasil disimpan.');
        setEditedAudioConfigs(prev => ({ ...prev, [taskId]: currentAudio }));
        fetchTasks();
      } else {
        showToast(data.error || 'Gagal menyimpan perubahan.', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const handleApproveAndProceed = async (taskId) => {
    if (!confirm('Apakah Anda yakin ingin menyetujui kreatif ini dan melanjutkan ke produksi video?')) return;
    setActionLoading(prev => ({ ...prev, [taskId]: true }));
    try {
      const currentAudio = normalizeAudioConfig(editedAudioConfigs[taskId] || tasks.find(t => t.id === taskId)?.audio_config_json);
      const res = await fetch(`/api/v2/multiplier/${taskId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_config_json: JSON.stringify(currentAudio)
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Kreatif disetujui! Memulai produksi video...');
        setEditedAudioConfigs(prev => ({ ...prev, [taskId]: currentAudio }));
        fetchTasks();
      } else {
        showToast(data.error || 'Gagal memproses persetujuan.', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const handleTriggerRetry = async (taskId, stage) => {
    try {
      const res = await fetch(`/api/v2/multiplier/${taskId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Tahapan ${stage} berhasil dipicu ulang.`);
        fetchTasks();
      } else {
        showToast(data.error || 'Gagal melakukan retry.', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleScheduler = async () => {
    setTogglingScheduler(true);
    try {
      const res = await fetch('/api/v2/multiplier', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_scheduler' })
      });
      const data = await res.json();
      if (data.success) {
        setIsSchedulerActive(data.isSchedulerActive);
        showToast(`Skeduler ${data.isSchedulerActive ? 'diaktifkan' : 'dinonaktifkan'}.`);
      } else {
        showToast(data.error || 'Gagal mengubah status skeduler.', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setTogglingScheduler(false);
    }
  };

  const handleStartCampaign = async () => {
    if (!confirm('Apakah Anda yakin ingin menjalankan kampanye Multiplier ini sekarang? Pemrosesan akan dieksekusi sekuensial baris demi baris.')) return;
    setStartingCampaign(true);
    try {
      const res = await fetch('/api/v2/multiplier', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_campaign', batchId: id })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Kampanye berhasil dijalankan secara sekuensial!');
        fetchTasks(true);
      } else {
        showToast(data.error || 'Gagal menjalankan kampanye.', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setStartingCampaign(false);
    }
  };

  const handleRetryTask = async (taskId) => {
    setRetryingTask(prev => ({ ...prev, [taskId]: true }));
    try {
      const res = await fetch('/api/v2/multiplier', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry_task', taskId })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || `Baris ${taskId} berhasil dimasukkan kembali ke antrean sekuensial!`);
        fetchTasks(true);
      } else {
        showToast(data.error || 'Gagal me-retry baris ini.', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setRetryingTask(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const firstTask = tasks[0];
  const bridging = firstTask ? JSON.parse(firstTask.bridging_config_json || '{}') : {};
  const aesthetics = firstTask ? JSON.parse(firstTask.vso_config_json || '{}') : {};
  const audio = firstTask ? JSON.parse(firstTask.audio_config_json || '{}') : {};

  // Calculate campaign status
  let overallStatus = 'draft';
  const isDraftCampaign = tasks.length > 0 && tasks.every(t => t.status === 'draft');
  if (tasks.length > 0) {
    const completedCount = tasks.filter(t => t.status === 'completed').length;
    const failedCount = tasks.filter(t => t.status === 'failed').length;
    const processingCount = tasks.filter(t => t.status && ['pending_resolution', 'resolving_product', 'remaking', 'generating_t2i', 'generating_audio', 'generating_visuals', 'ffmpeg_muxing'].includes(t.status)).length;
    
    if (isDraftCampaign) overallStatus = 'draft';
    else if (completedCount === tasks.length) overallStatus = 'completed';
    else if (failedCount > 0) overallStatus = 'failed';
    else if (processingCount > 0) overallStatus = 'running';
    else if (tasks.some(t => t.status === 'paused')) overallStatus = 'paused';
    else if (tasks.some(t => t.status === 'waiting_approval')) overallStatus = 'waiting_approval';
  }

  const getStageStatus = (task, stageName) => {
    const taskStatus = task.status;
    let activeStage = 'resolving';

    if (taskStatus === 'pending_resolution' || taskStatus === 'resolving_product') {
      activeStage = 'resolving';
    } else if (taskStatus === 'remaking') {
      activeStage = 'remaking';
    } else if (taskStatus === 'generating_t2i') {
      activeStage = 't2i';
    } else if (taskStatus === 'waiting_approval') {
      activeStage = 'waiting_approval';
    } else if (taskStatus === 'generating_audio') {
      activeStage = 'tts';
    } else if (taskStatus === 'generating_visuals') {
      activeStage = 'visuals';
    } else if (taskStatus === 'ffmpeg_muxing') {
      activeStage = 'ffmpeg';
    } else if (taskStatus === 'completed') {
      activeStage = 'completed';
    } else if (taskStatus === 'failed') {
      if (!task.remake_storyboard_json || task.remake_storyboard_json === '[]') {
        activeStage = 'remaking_failed';
      } else {
        let hasT2i = false;
        try {
          const t2iImgs = JSON.parse(task.t2i_images_json || '[]');
          hasT2i = Array.isArray(t2iImgs) && t2iImgs.length > 0 && t2iImgs.some(img => img !== null);
        } catch (_) {}

        if (!hasT2i) {
          activeStage = 't2i_failed';
        } else {
          let hasAudio = false;
          try {
            const audioConfig = JSON.parse(task.audio_config_json || '{}');
            hasAudio = !!audioConfig.combined_audio_path;
          } catch (_) {}

          if (!hasAudio) {
            activeStage = 'tts_failed';
          } else if (!task.video_paths_json || task.video_paths_json === '[]') {
            activeStage = 'visuals_failed';
          } else if (!task.ffmpeg_output_path) {
            activeStage = 'ffmpeg_failed';
          } else {
            activeStage = 'cloud_failed';
          }
        }
      }
    }

    const stages = ['resolving', 'remaking', 't2i', 'tts', 'visuals', 'ffmpeg', 'cloud'];
    const targetIdx = stages.indexOf(stageName);

    if (activeStage === 'completed') return 'success';

    if (activeStage.endsWith('_failed')) {
      const failedStage = activeStage.replace('_failed', '');
      const failedIdx = stages.indexOf(failedStage);
      if (targetIdx === failedIdx) return 'danger';
      if (targetIdx < failedIdx) return 'success';
      return 'pending';
    }

    if (activeStage === 'waiting_approval') {
      if (targetIdx <= 2) return 'success';
      return 'pending';
    }

    const currentIdx = stages.indexOf(activeStage);
    if (targetIdx === currentIdx) return 'active';
    if (targetIdx < currentIdx) return 'success';
    return 'pending';
  };

  const renderPipelineStatus = (task) => {
    const stages = [
      { label: 'Resolving', name: 'resolving' },
      { label: 'Storyboard', name: 'remaking' },
      { label: 'T2I Start Frame', name: 't2i' },
      { label: 'TTS Audio', name: 'tts' },
      { label: 'Visual G-Labs', name: 'visuals' },
      { label: 'FFmpeg Muxing', name: 'ffmpeg' },
      { label: 'Nextcloud Cloud', name: 'cloud' }
    ];

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        {stages.map((stage) => {
          const status = getStageStatus(task, stage.name);
          let color = 'var(--text-muted)';
          let bg = 'var(--surface-interactive)';
          let border = '1px solid var(--border-subtle)';
          let labelText = stage.label;

          if (status === 'success') {
            color = 'var(--text-primary)';
            bg = 'var(--status-success-soft)';
            border = '1px solid var(--status-success-soft)';
            labelText = `✓ ${stage.label}`;
          } else if (status === 'danger') {
            color = 'var(--text-primary)';
            bg = 'var(--status-danger-soft)';
            border = '1px solid var(--status-danger-soft)';
            labelText = `✗ ${stage.label} (Gagal)`;
          } else if (status === 'active') {
            color = 'var(--text-primary)';
            bg = 'var(--status-info-soft)';
            border = '1px solid var(--status-info-soft)';
            labelText = `⏳ ${stage.label}...`;
          }

          return (
            <div key={stage.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: bg, color, border }}>
                {labelText}
              </span>
              {(status === 'success' || status === 'danger') && (
                <button
                  type="button"
                  onClick={() => handleTriggerRetry(task.id, stage.name)}
                  style={{
                    background: status === 'danger' ? 'var(--danger)' : 'var(--surface-interactive)',
                    color: status === 'danger' ? 'var(--text-primary)' : 'var(--text-muted)',
                    border: status === 'danger' ? 'none' : '1px solid var(--border-subtle)',
                    borderRadius: 4,
                    padding: '2px 8px',
                    fontSize: '0.65rem',
                    cursor: 'pointer',
                    fontWeight: 700
                  }}
                >
                  🔄 Retry
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* 1 & 2: Header Card Detail Kampanye (Persis layout Pillar Campaign L3005-3084) */}
        <div className="card" style={{ marginBottom: 24, padding: 32, border: '1px solid var(--border-color)', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)' }}>
          <div>
            <button
              onClick={() => router.push('/multiplier-lab')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.82rem', padding: '6px 12px', marginBottom: 12, cursor: 'pointer' }}
            >
              ← Kembali ke Dashboard Multiplier
            </button>
            <h1 style={{ margin: '4px 0 0 0', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
              🎬 {firstTask?.campaign_name || bridging.campaign_name || audio.campaignName || firstTask?.new_caption?.slice(0, 45) || bridging.editorialTopic || 'Kampanye Multiplier Lab'}
            </h1>

            {/* ID Kampanye | Nama Akun Brand | Created Date | Mode */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 12, fontSize: '0.88rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', paddingBottom: 16, marginBottom: 20 }}>
              <span>🔑 ID: <code style={{ background: 'var(--surface-interactive)', padding: '3px 8px', borderRadius: 4, color: 'var(--action-primary)', fontFamily: 'monospace', fontSize: '0.85rem' }}>{id}</code></span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span>🏷️ Brand: <strong>{firstTask?.account_name || firstTask?.brand_name || bridging.account_name || bridging.brandName || audio.accountName || 'Tanpa Akun'}</strong></span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span>📅 Dibuat: <strong>{firstTask?.created_at ? new Date(firstTask.created_at).toLocaleString('id-ID') : '-'}</strong></span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span style={{ fontSize: '0.72rem', background: 'var(--action-primary)', color: 'var(--on-action-primary)', padding: '3px 8px', borderRadius: 4, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                🧬 1 BLUEPRINT TO {tasks.length} MULTI-ANGLES
              </span>
              <span style={{
                fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 6,
                background: overallStatus === 'completed' ? 'var(--status-success-soft)' : (overallStatus === 'running' ? 'var(--status-info-soft)' : (overallStatus === 'failed' ? 'var(--status-danger-soft)' : (overallStatus === 'paused' ? 'var(--status-warning-soft)' : (overallStatus === 'waiting_approval' ? 'var(--status-warning-soft)' : 'var(--surface-interactive)')))),
                color: overallStatus === 'completed' ? 'var(--status-success)' : (overallStatus === 'running' ? 'var(--status-info)' : (overallStatus === 'failed' ? 'var(--status-danger)' : (overallStatus === 'paused' ? 'var(--status-warning)' : (overallStatus === 'waiting_approval' ? 'var(--status-warning)' : 'var(--text-muted)')))),
                border: '1px solid var(--border-subtle)'
              }}>
                {overallStatus.toUpperCase()}
              </span>
            </div>
          </div>

          {/* 3. Tombol Aksi Utama (Gradient buttons selaras Pillar Campaign) */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {isDraftCampaign && (
              <button
                className="btn"
                disabled={startingCampaign}
                onClick={handleStartCampaign}
                style={{
                  background: 'linear-gradient(135deg, var(--action-primary), var(--status-info))',
                  color: 'var(--on-action-primary)',
                  border: 'none',
                  padding: '10px 18px',
                  fontWeight: 700,
                  borderRadius: 6,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-card)'
                }}
              >
                {startingCampaign ? '⏳ Memulai Kampanye...' : '▶️ Jalankan Kampanye'}
              </button>
            )}
            <button
              className="btn"
              disabled={togglingScheduler}
              onClick={handleToggleScheduler}
              style={{
                background: isSchedulerActive ? 'var(--status-success)' : 'var(--surface-interactive)',
                color: isSchedulerActive ? 'var(--on-action-primary)' : 'var(--text-muted)',
                border: 'none',
                padding: '10px 16px',
                fontWeight: 600,
                borderRadius: 6,
                cursor: 'pointer'
              }}
            >
              {isSchedulerActive ? '🟢 Skeduler Aktif (Running)' : '⏸️ Skeduler Dijeda (Paused)'}
            </button>
            <button
              className="btn"
              disabled={syncingContentFlow}
              onClick={async () => {
                setSyncingContentFlow(true);
                try {
                  const res = await fetch(`/api/v2/multiplier-lab/${id}/sync-contentflow`, { method: 'POST' });
                  const data = await res.json();
                  if (data.success) {
                    showToast(`Berhasil mendorong ${data.synced_count || 0} video selesai ke ContentFlow!`);
                    fetchTasks();
                  } else {
                    showToast(data.error || 'Gagal sinkron ke ContentFlow', 'error');
                  }
                } catch (err) {
                  showToast(err.message, 'error');
                } finally {
                  setSyncingContentFlow(false);
                }
              }}
              style={{ background: 'var(--status-info)', color: 'var(--on-action-primary)', border: 'none', padding: '10px 16px', fontWeight: 600, borderRadius: 6, cursor: 'pointer' }}
            >
              {syncingContentFlow ? '⏳ Mendorong ke ContentFlow...' : '🚀 Push to Contentflow'}
            </button>
            <button
              className="btn"
              disabled={syncingNextcloud}
              onClick={async () => {
                setSyncingNextcloud(true);
                try {
                  const res = await fetch(`/api/v2/multiplier-lab/${id}/sync-nextcloud`, { method: 'POST' });
                  const data = await res.json();
                  if (data.success) {
                    showToast(`Berhasil menyinkronkan aset folder Nextcloud (${data.synced_count || 0} video)!`);
                    fetchTasks();
                  } else {
                    showToast(data.error || 'Gagal sinkron ke Nextcloud', 'error');
                  }
                } catch (err) {
                  showToast(err.message, 'error');
                } finally {
                  setSyncingNextcloud(false);
                }
              }}
              style={{ background: 'var(--action-primary)', color: 'var(--on-action-primary)', border: 'none', padding: '10px 16px', fontWeight: 600, borderRadius: 6, cursor: 'pointer' }}
            >
              {syncingNextcloud ? '⏳ Menyinkronkan ke Nextcloud...' : '☁️ Sync to Nextcloud'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                const mdContent = `# Kampanye Multiplier Lab\nID: ${id}\nTotal Tasks: ${tasks.length}\n`;
                const blob = new Blob([mdContent], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `multiplier_campaign_${id}.md`;
                a.click();
                showToast('Ekspor data berhasil diunduh.');
              }}
              style={{ padding: '10px 16px', fontWeight: 600, borderRadius: 6, cursor: 'pointer' }}
            >
              📊 Export Data (.md)
            </button>
          </div>
        </div>

        {/* 4. Accordion Info Konfigurasi (Selaras Pillar Campaign, 1 Kolom Penuh) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28, width: '100%' }}>
          
          {/* Accordion A: Info Konfigurasi Basic Creative Strategy */}
          <details open style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
            <summary style={{ padding: '14px 20px', fontWeight: 700, cursor: 'pointer', background: 'var(--surface-interactive)', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>📂 Info Konfigurasi Basic Creative Strategy</span>
            </summary>
            <div style={{ padding: 20, borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>🏷️ Nama Akun (Brand Account)</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{firstTask?.account_name || firstTask?.brand_name || bridging.account_name || bridging.brandName || audio.accountName || 'Tanpa Akun'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Parent Folder Nextcloud</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{audio.nextcloudParentFolder || '/MAKNA_Assets/Multiplier'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Bahasa Naskah Voiceover</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{audio.targetLanguage || 'Bahasa Indonesia (id-ID)'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>🎯 Target Demografi & Tone Bahasa</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{audio.targetDemographic || aesthetics.targetDemographic || 'Dewasa Muda (20–35 th) • Santai, Informatif & Relatable'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>🎙 Audio Segment (per Klip)</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>Provider: {audio.voiceProvider || audio.voice_provider || 'minimax'} | Persona: {audio.voicePersona || audio.voice_persona || 'Indonesian_casual_reporter_vv2'} | Speed: {audio.voiceSpeed || audio.voice_speed || '1.0'}x</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>SFX Setting</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>Tanpa SFX (Volume: 0.0x - Staging Standard)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Audit Kepatuhan Voiceover (TikTok Safe)</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{firstTask?.enable_vo_audit === 1 ? 'Aktif (TikTok Safe Compliance Checker)' : 'Nonaktif'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>🧬 Resep & High-CTR Mandate</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{firstTask?.generate_recipe === 1 ? 'Aktif (Mandatory Viral Hook & Persona Hook Formula)' : 'Nonaktif'}</span>
              </div>
            </div>
          </details>

          {/* Accordion B: Info Konfigurasi Aesthetics & Visual Settings */}
          <details style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
            <summary style={{ padding: '14px 20px', fontWeight: 700, cursor: 'pointer', background: 'var(--surface-interactive)', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🎬 Info Konfigurasi Aesthetics & Visual Settings</span>
            </summary>
            <div style={{ padding: 20, borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Narrative Mode</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{aesthetics.narrativeMode || 'Storytelling / Casual Vlog'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Aspect Ratio</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{aesthetics.aspectRatio || '9:16 (Vertical Shorts / Reels / TikTok)'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Target AI Engine</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{aesthetics.targetAi || 'Google Veo / Gemini 2.5 Flash'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Video Model</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{aesthetics.videoModel || 'veo_31_lite'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Face Visibility</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{aesthetics.faceVisibility || 'Faceless (Focus on hands, food macro, and cooking actions)'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Visual Style</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{aesthetics.visualStyle || 'Cinematic Macro & Lifestyle'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Visual Mode</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{bridging.visualMode || 'hybrid_lock (T2I Start Frame + I2V Motion)'}</span>
              </div>
            </div>
          </details>

          {/* Accordion C: Info Konfigurasi Product Bridging Settings */}
          <details style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
            <summary style={{ padding: '14px 20px', fontWeight: 700, cursor: 'pointer', background: 'var(--surface-interactive)', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🌉 Info Konfigurasi Product Bridging Settings</span>
            </summary>
            <div style={{ padding: 20, borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Bridging Promosi Produk</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{bridging.isBridgingActive ? 'Aktif' : 'Nonaktif (Pure Organic Storytelling)'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Tipe Kampanye</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{bridging.campaignType || 'Edukasi Kesehatan & Resep Sehari-hari'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Instruksi Transisi</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>Transisi mulus antar tips tanpa interupsi penjualan langsung, pertahankan retensi audiens tinggi.</span>
              </div>
            </div>
          </details>

          {/* Accordion D: Info Konfigurasi Visual Identity */}
          <details style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
            <summary style={{ padding: '14px 20px', fontWeight: 700, cursor: 'pointer', background: 'var(--surface-interactive)', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🎭 Info Konfigurasi Visual Identity</span>
            </summary>
            <div style={{ padding: 20, borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Konsep Karakter (Framing)</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{aesthetics.characterConcept || 'POV Orang Pertama (First-Person Perspective)'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Demografi Model</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{aesthetics.subjectDemographic || 'Tangan perempuan Asia usia 25-30 tahun, kasual bersih'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Pencahayaan & Gaya Sinematik</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{aesthetics.lightingStyle || 'Warm afternoon sunlight through kitchen window, soft shadows, warm natural colors'}</span>
              </div>
            </div>
          </details>

        </div>

        {/* CAMPAIGN ITEMS GENERATION DETAIL SECTION (Selaras Pillar Campaign) */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-interactive)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              🎬 Item Produksi Video ({tasks.length})
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Judul tiap baris disesuaikan dengan <strong>Angle & YouTube High-CTR Formula</strong>
            </div>
          </div>
          <table className="ideas-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-interactive)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'center', width: '4%' }}>#</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', width: '52%' }}>Angle & Judul Konten (Berdasarkan Sudut Pandang)</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', width: '26%' }}>Fase</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', width: '18%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, idx) => {
                let snap = {};
                try {
                  snap = task.product_snapshot_json ? (typeof task.product_snapshot_json === 'string' ? JSON.parse(task.product_snapshot_json) : task.product_snapshot_json) : {};
                } catch (_) {}

                let bridgingConfig = {};
                try {
                  bridgingConfig = task.bridging_config_json ? (typeof task.bridging_config_json === 'string' ? JSON.parse(task.bridging_config_json) : task.bridging_config_json) : {};
                } catch (_) {}

                const isExpanded = expandedTaskId === task.id;
                const activeTab = activeTabs[task.id] || 'storyboard';
                const storyboard = editedStoryboards[task.id] || [];
                const rowNumber = (task.row_index !== null && task.row_index !== undefined) ? Number(task.row_index) + 1 : idx + 1;
                const displayTitle = task.yt_title || editedYtTitles[task.id] || bridgingConfig.angleTitle || bridgingConfig.editorialTopic || snap.product_name || `Video Angle #${rowNumber}`;

                return (
                  <Suspense key={task.id} fallback={<tr><td colSpan={4}>Loading...</td></tr>}>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', padding: '14px 16px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>
                        {rowNumber}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'var(--surface-interactive)', color: 'var(--action-primary)', border: '1px solid var(--border-subtle)' }}>
                            Baris #{rowNumber} ({task.id})
                          </span>
                          {bridgingConfig.hookType && (
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(45, 212, 191, 0.15)', color: 'var(--action-primary)', border: '1px solid rgba(45, 212, 191, 0.3)' }}>
                              {bridgingConfig.hookType}
                            </span>
                          )}
                          {bridgingConfig.targetPersona && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              🎯 Target: {bridgingConfig.targetPersona}
                            </span>
                          )}
                          {task.new_caption && (
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'var(--status-success-soft)', color: 'var(--status-success)', border: '1px solid var(--status-success-soft)' }}>
                              📝 Caption ({task.new_caption.length} kar)
                            </span>
                          )}
                          {Number(task.generate_recipe) === 1 && (
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'var(--status-neutral-soft)', color: 'var(--status-neutral)', border: '1px solid var(--status-neutral-soft)' }}>
                              🍳 Resep Lengkap
                            </span>
                          )}
                          {(task.is_synced_to_contentflow || task.status === 'completed') && (
                            <a
                              href={`/content-flow?q=${encodeURIComponent(task.content_flow_video_id || task.id.replace('mul_', ''))}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ textDecoration: 'none' }}
                            >
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'var(--status-info-soft)', color: 'var(--status-info)', border: '1px solid var(--status-info-soft)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                🔗 Synced to ContentFlow ({task.content_flow_video_id || 'Lihat ➔'})
                              </span>
                            </a>
                          )}
                          {task.nextcloud_folder_url && (
                            <a
                              href={task.nextcloud_folder_url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ textDecoration: 'none' }}
                            >
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'var(--surface-interactive)', color: 'var(--action-primary)', border: '1px solid var(--border-subtle)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                📁 Cloud Folder
                              </span>
                            </a>
                          )}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: 4 }}>
                          {displayTitle}
                        </div>
                        {bridgingConfig.hookText && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                            Hook: "{bridgingConfig.hookText.slice(0, 80)}..."
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {renderPhaseBadge(task)}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                          {task.status === 'failed' && (
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={retryingTask[task.id]}
                              onClick={() => handleRetryTask(task.id)}
                              style={{
                                background: 'var(--status-warning-soft)',
                                color: 'var(--status-warning)',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                padding: '4px 8px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                borderRadius: 4,
                                cursor: 'pointer'
                              }}
                            >
                              {retryingTask[task.id] ? '⏳...' : '🔄 Retry Baris'}
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                          >
                            {isExpanded ? '📖 Tutup' : '📖 Detail'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Expanded Detail Panel Workbench */}
                    {isExpanded && (
                      <tr style={{ background: 'var(--surface)' }}>
                        <td colSpan={4} style={{ padding: '24px 30px', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            
                            {/* Pipeline status */}
                            <div style={{ background: 'var(--surface-interactive)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 20px' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                                ⚙️ Pipeline Rendering Status
                              </div>
                              {renderPipelineStatus(task)}
                            </div>

                            {/* Horizontal Tabs Navigation */}
                            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', marginBottom: '14px', gap: '6px', flexWrap: 'wrap', overflowX: 'auto' }}>
                              {[
                                { id: 'deconstruct', label: '🔍 Tab 1: Dekonstruksi Asli' },
                                { id: 'storyboard', label: '📖 Tab 2: Storyboard & Visual Baru' },
                                { id: 'recipe', label: '🍳 Tab 3: Resep Kuliner & Paket Medsos' },
                                { id: 'vault', label: '🗄️ Tab 4: Asset Vault Status' },
                                { id: 'dna', label: '🧬 Tab 5: Video DNA Metadata' },
                                { id: 'logs', label: '💻 Tab 6: Terminal Log & Queue' }
                              ].map(tab => {
                                const isActive = activeTab === tab.id;
                                return (
                                  <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTabs(prev => ({ ...prev, [task.id]: tab.id }))}
                                    style={{
                                      padding: '8px 14px',
                                      background: isActive ? 'var(--surface-interactive)' : 'transparent',
                                      color: isActive ? 'var(--accent-light)' : 'var(--text-muted)',
                                      border: 'none',
                                      borderBottom: isActive ? '2px solid var(--accent-light)' : '2px solid transparent',
                                      cursor: 'pointer',
                                      fontSize: '0.78rem',
                                      fontWeight: isActive ? '600' : '400',
                                      transition: 'all 0.15s ease',
                                      borderRadius: '4px 4px 0 0',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {tab.label}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Tab Content details in 1 column */}
                            <div style={{ minHeight: '80px', padding: '4px 0' }}>
                                
                                {/* Tab 1: Dekonstruksi Asli */}
                                {activeTab === 'deconstruct' && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>🔍 detail Dekonstruksi Asli</h4>
                                    
                                    {/* Product Snapshot Info */}
                                    <div style={{ display: 'flex', gap: 16, background: 'var(--surface-interactive)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                                      {snap.product_image_url && (
                                        <div style={{ width: 120, height: 120, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
                                          <img src={snap.product_image_url} alt="Foto Produk" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                      )}
                                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <div style={{ fontWeight: 700 }}>{snap.product_name}</div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{snap.product_description || 'Tanpa deskripsi produk.'}</div>
                                        {snap.product_usp && (
                                          <div style={{ fontSize: '0.78rem', color: 'var(--accent-light)' }}>
                                            💡 USP: {snap.product_usp}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Original Deconstruction Storyboard Table */}
                                    <div style={{ background: 'var(--surface-interactive)', border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
                                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                                        📖 Alur Storyboard Dekonstruksi Asli
                                      </div>
                                      {(() => {
                                        const originalStoryboard = task.original_storyboard_json ? JSON.parse(task.original_storyboard_json) : [];
                                        if (originalStoryboard.length === 0) {
                                          return <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontStyle: 'italic' }}>Tidak ada data storyboard dekonstruksi asli.</div>;
                                        }
                                        return (
                                          <table className="ideas-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                              <tr style={{ background: 'var(--overlay-subtle)', borderBottom: '1px solid var(--border)' }}>
                                                <th style={{ padding: '10px', textAlign: 'left', width: '10%' }}>Scene</th>
                                                <th style={{ padding: '10px', textAlign: 'left', width: '15%' }}>Timestamp</th>
                                                <th style={{ padding: '10px', textAlign: 'left', width: '35%' }}>Visual Description</th>
                                                <th style={{ padding: '10px', textAlign: 'left', width: '40%' }}>Voice Narration Audio Transcript</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {originalStoryboard.map((scene, sidx) => (
                                                <tr key={sidx} style={{ borderBottom: '1px solid var(--border)' }}>
                                                  <td style={{ padding: '10px', fontWeight: 700, color: 'var(--accent-light)' }}>#{scene.scene || sidx + 1}</td>
                                                  <td style={{ padding: '10px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{scene.duration || scene.timestamp || '-'}</td>
                                                  <td style={{ padding: '10px', fontSize: '0.78rem', lineHeight: 1.4 }}>{scene.visual_description || '-'}</td>
                                                  <td style={{ padding: '10px', fontSize: '0.78rem', lineHeight: 1.4, fontStyle: 'italic' }}>{scene.narration || '-'}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                )}

                                {/* Tab 2: Storyboard & Visual Baru */}
                                {activeTab === 'storyboard' && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    
                                    {/* CARD HASIL RENDER VIDEO AKHIR (FINAL OUTPUT) */}
                                    {(task.ffmpeg_output_path || task.status === 'completed') && (
                                      <div style={{
                                        background: 'var(--surface-interactive)',
                                        border: '1px solid var(--border-strong)',
                                        borderRadius: 8,
                                        padding: 20,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 16
                                      }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: '1.1rem' }}>🎬</span>
                                            <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                                              Hasil Render Video Akhir (Final Output)
                                            </strong>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, background: 'var(--status-success-soft)', color: 'var(--status-success)', padding: '2px 8px', borderRadius: 4 }}>
                                              1080x1920 (9:16) • MP4
                                            </span>
                                          </div>
                                          {task.ffmpeg_output_path && (
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                              File: {task.ffmpeg_output_path}
                                            </div>
                                          )}
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: task.ffmpeg_output_path ? '220px 1fr' : '1fr', gap: 20, alignItems: 'start' }}>
                                          {task.ffmpeg_output_path ? (
                                            <div style={{ display: 'flex', justifyContent: 'center', background: '#000', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-subtle)', maxHeight: 380 }}>
                                              <video src={task.ffmpeg_output_path} controls preload="metadata" style={{ width: '100%', maxHeight: 380, display: 'block', objectFit: 'contain' }} />
                                            </div>
                                          ) : (
                                            <div style={{ background: 'var(--surface)', border: '1px dashed var(--border-subtle)', padding: 30, textAlign: 'center', color: 'var(--text-muted)', borderRadius: 6 }}>
                                              🎥 File video belum dikompilasi / langkah FFmpeg sedang diproses.
                                            </div>
                                          )}

                                          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                              Video final telah selesai digabungkan melalui <strong>FFmpeg Smart Sync Studio</strong> (Audio Voiceover + Visual Klip). Anda dapat meninjau video langsung di pemutar sebelah kiri, mengunduh file mentah, atau menyinkronkannya ke Nextcloud & ContentFlow.
                                            </div>

                                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                              {task.ffmpeg_output_path && (
                                                <a href={task.ffmpeg_output_path} download className="btn btn-primary" style={{ padding: '8px 16px', background: 'var(--status-success)', color: 'var(--on-action-primary)', fontWeight: 700, textDecoration: 'none' }}>
                                                  ⬇️ Unduh Video (.mp4)
                                                </a>
                                              )}
                                              {(task.nextcloud_folder_url || task.nextcloud_video_url) && (
                                                <a href={task.nextcloud_folder_url || task.nextcloud_video_url} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ padding: '8px 16px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                  📁 Buka Folder Aset
                                                </a>
                                              )}
                                              {task.nextcloud_video_url && task.nextcloud_folder_url && task.nextcloud_video_url !== task.nextcloud_folder_url && (
                                                <a href={task.nextcloud_video_url} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ padding: '8px 16px', textDecoration: 'none' }}>
                                                  ☁️ Buka Video Nextcloud
                                                </a>
                                              )}
                                              {(task.is_synced_to_contentflow || task.status === 'completed') && (
                                                <a
                                                  href={`/content-flow?q=${encodeURIComponent(task.content_flow_video_id || task.id.replace('mul_', ''))}`}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="btn btn-secondary"
                                                  style={{ padding: '8px 16px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--status-info)' }}
                                                >
                                                  🚀 Buka di ContentFlow ➔
                                                </a>
                                              )}
                                              {task.ffmpeg_output_path && (
                                                <button
                                                  type="button"
                                                  className="btn btn-secondary"
                                                  onClick={() => {
                                                    navigator.clipboard.writeText(window.location.origin + task.ffmpeg_output_path);
                                                    showToast('Tautan video berhasil disalin ke clipboard!');
                                                  }}
                                                  style={{ padding: '8px 16px' }}
                                                >
                                                  📋 Salin Tautan Video
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Start Frame Grid Preview */}
                                    {bridging.visualMode === 'hybrid_lock' && (
                                      <div style={{ background: 'var(--surface-interactive)', border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
                                         <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                           <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                             🖼️ Grid Preview Start Frame Gambar (T2I)
                                           </span>
                                           {(() => {
                                             const isBatchRunning = task.regenerate_start_frames_status === 'running' || !!batchRegeneratingSF[task.id];
                                             return (
                                               <button
                                                 type="button"
                                                 onClick={() => handleGenerateAllT2I(task.id)}
                                                 disabled={isBatchRunning}
                                                 className="btn btn-secondary btn-sm"
                                                 style={{
                                                   fontSize: '0.72rem',
                                                   padding: '4px 10px',
                                                   background: isBatchRunning ? 'rgba(155, 89, 182, 0.4)' : 'rgba(155, 89, 182, 0.15)',
                                                   borderColor: 'rgba(155, 89, 182, 0.3)',
                                                   color: 'var(--text-primary)',
                                                   cursor: isBatchRunning ? 'not-allowed' : 'pointer'
                                                 }}
                                               >
                                                 {task.regenerate_start_frames_status === 'running'
                                                   ? `⏳ Regenerating (${task.regenerate_start_frames_progress || '0%'})`
                                                   : (batchRegeneratingSF[task.id] ? '⏳ Memulai...' : '🎨 Generate T2I Start Frames')
                                                 }
                                               </button>
                                             );
                                           })()}
                                         </div>
                                        
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16, marginTop: 12 }}>
                                          {storyboard.map((clip, cidx) => {
                                            const t2iImagesList = task.t2i_images_json ? JSON.parse(task.t2i_images_json) : [];
                                            const imgPath = t2iImagesList[cidx];
                                            const taskKey = `${task.id}_${cidx + 1}`;
                                            const isRegening = regeneratingT2I[taskKey];
                                            const isReplacing = replacingSF[taskKey];
                                            const isBatchRunning = task.regenerate_start_frames_status === 'running' || !!batchRegeneratingSF[task.id];

                                            return (
                                              <div key={cidx} style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--overlay-subtle)', padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}>
                                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-light)' }}>
                                                  Klip #{cidx + 1}
                                                </div>
                                                <div style={{ width: '100%', height: 160, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }}>
                                                  {imgPath ? (
                                                    <img src={imgPath} alt="Start Frame" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                  ) : (
                                                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                                                      Belum Ada Start Frame
                                                    </div>
                                                  )}
                                                </div>

                                                <input
                                                  type="file"
                                                  accept="image/*"
                                                  style={{ display: 'none' }}
                                                  id={`replace-startframe-${task.id}-${cidx + 1}`}
                                                  onChange={(e) => handleReplaceStartFrame(task.id, cidx + 1, e.target.files[0])}
                                                />

                                                <div style={{ display: 'flex', gap: 4 }}>
                                                  <button
                                                    type="button"
                                                    disabled={isRegening || isBatchRunning}
                                                    onClick={() => handleRegenerateT2I(task.id, cidx + 1, clip.t2i_prompt)}
                                                    style={{
                                                      flex: 1, fontSize: '0.62rem', padding: '4px',
                                                      cursor: (isRegening || isBatchRunning) ? 'not-allowed' : 'pointer',
                                                      opacity: (isRegening || isBatchRunning) ? 0.6 : 1,
                                                      background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 4
                                                    }}
                                                  >
                                                    {isRegening ? '⏳' : '🔄 Regen'}
                                                  </button>
                                                  <button
                                                    type="button"
                                                    disabled={isReplacing || isBatchRunning}
                                                    onClick={() => document.getElementById(`replace-startframe-${task.id}-${cidx + 1}`).click()}
                                                    style={{
                                                      flex: 1, fontSize: '0.62rem', padding: '4px',
                                                      cursor: (isReplacing || isBatchRunning) ? 'not-allowed' : 'pointer',
                                                      opacity: (isReplacing || isBatchRunning) ? 0.6 : 1,
                                                      background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 4
                                                    }}
                                                  >
                                                    {isReplacing ? '⏳' : '📤 Replace'}
                                                  </button>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {/* Clips edit rows */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                      {storyboard.map((clip, cidx) => (
                                        <div key={cidx} style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--surface-interactive)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                                          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent-light)', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                                            🎬 Klip #{cidx + 1}
                                          </div>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            <div>
                                              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Naskah Voiceover (VO)</label>
                                              <textarea
                                                value={clip.narration || ''}
                                                onChange={(e) => {
                                                  const updated = [...storyboard];
                                                  updated[cidx].narration = e.target.value;
                                                  setEditedStoryboards(prev => ({ ...prev, [task.id]: updated }));
                                                }}
                                                rows={2}
                                                style={{ width: '100%', padding: 10, fontSize: '0.82rem', background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6 }}
                                              />
                                            </div>
                                            <div>
                                              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Aksi Visual</label>
                                              <textarea
                                                value={clip.visual_description || ''}
                                                onChange={(e) => {
                                                  const updated = [...storyboard];
                                                  updated[cidx].visual_description = e.target.value;
                                                  setEditedStoryboards(prev => ({ ...prev, [task.id]: updated }));
                                                }}
                                                rows={2}
                                                style={{ width: '100%', padding: 10, fontSize: '0.82rem', background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6 }}
                                              />
                                            </div>
                                            <div>
                                              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Prompt T2I</label>
                                              <textarea
                                                value={clip.t2i_prompt || ''}
                                                onChange={(e) => {
                                                  const updated = [...storyboard];
                                                  updated[cidx].t2i_prompt = e.target.value;
                                                  setEditedStoryboards(prev => ({ ...prev, [task.id]: updated }));
                                                }}
                                                rows={2}
                                                style={{ width: '100%', padding: 10, fontSize: '0.8rem', background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6 }}
                                              />
                                            </div>
                                            <div>
                                              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Prompt I2V</label>
                                              <textarea
                                                value={clip.i2v_prompt || ''}
                                                onChange={(e) => {
                                                  const updated = [...storyboard];
                                                  updated[cidx].i2v_prompt = e.target.value;
                                                  setEditedStoryboards(prev => ({ ...prev, [task.id]: updated }));
                                                }}
                                                rows={2}
                                                style={{ width: '100%', padding: 10, fontSize: '0.8rem', background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6 }}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>

                                    {/* YouTube Shorts High-CTR Title */}
                                    <div style={{ background: 'var(--surface-interactive)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                        <label style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                          🔥 Judul YouTube Shorts (High-CTR Formula)
                                          <span style={{ fontSize: '0.68rem', padding: '1px 6px', background: 'var(--status-danger-soft)', color: 'var(--status-danger)', borderRadius: 4, fontWeight: 700 }}>#Shorts</span>
                                        </label>
                                        <span style={{ 
                                          fontSize: '0.72rem', 
                                          fontWeight: 600,
                                          color: (editedYtTitles[task.id] || '').length > 85 ? 'var(--status-danger)' : (editedYtTitles[task.id] || '').length >= 50 ? 'var(--status-success)' : 'var(--text-muted)' 
                                        }}>
                                          {(editedYtTitles[task.id] || '').length} / 85 karakter (Target: 50–75)
                                        </span>
                                      </div>
                                      <input
                                        type="text"
                                        value={editedYtTitles[task.id] || ''}
                                        onChange={(e) => setEditedYtTitles(prev => ({ ...prev, [task.id]: e.target.value }))}
                                        placeholder="Judul click-worthy anti-terpotong diakhiri #Shorts..."
                                        style={{ width: '100%', padding: '10px 12px', fontSize: '0.85rem', fontWeight: 600, background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6 }}
                                      />
                                    </div>

                                    {/* Social Caption Packaging */}
                                    <div style={{ background: 'var(--surface-interactive)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
                                      <label style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                                        📲 Social Media Package & Caption Draft
                                      </label>
                                      <textarea
                                        value={editedCaptions[task.id] || ''}
                                        onChange={(e) => setEditedCaptions(prev => ({ ...prev, [task.id]: e.target.value }))}
                                        rows={3}
                                        style={{ width: '100%', padding: 10, fontSize: '0.82rem', background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6 }}
                                      />
                                    </div>

                                    {/* 5. Workflow & Audio Settings (1 Column Layout) */}
                                    {(() => {
                                      const cfg = normalizeAudioConfig(editedAudioConfigs[task.id] || task.audio_config_json);
                                      const setCfgValue = (key, value) => {
                                        setEditedAudioConfigs(prev => {
                                          const updated = syncAudioConfigKeyValue(prev[task.id] || task.audio_config_json, key, value);
                                          return { ...prev, [task.id]: updated };
                                        });
                                      };

                                      return (
                                        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'rgba(9, 14, 26, 0.4)', marginTop: 20 }}>
                                          <div style={{ padding: '12px 20px', background: 'var(--surface-interactive)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>⚙️ 5. Workflow & Audio Settings (Fase 2 Rendering)</span>
                                            </div>
                                          </div>
                                          
                                          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
                                            
                                            {/* Stage Checklists */}
                                            <div>
                                              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 10, display: 'block' }}>
                                                Tahapan Workflow Aktif untuk Visual / Produksi Video
                                              </label>
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-interactive)', padding: '10px 14px', borderRadius: 6, border: '1px solid var(--border)' }}>
                                                  <span style={{ fontSize: '0.8rem' }}>Enable TTS (Voiceover)</span>
                                                  <input
                                                    type="checkbox"
                                                    checked={cfg.enable_tts !== false}
                                                    onChange={e => setCfgValue('enable_tts', e.target.checked)}
                                                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                                                  />
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-interactive)', padding: '10px 14px', borderRadius: 6, border: '1px solid var(--border)' }}>
                                                  <span style={{ fontSize: '0.8rem' }}>Enable G-Labs (AI Video)</span>
                                                  <input
                                                    type="checkbox"
                                                    checked={cfg.enable_glabs !== false}
                                                    onChange={e => setCfgValue('enable_glabs', e.target.checked)}
                                                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                                                  />
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-interactive)', padding: '10px 14px', borderRadius: 6, border: '1px solid var(--border)' }}>
                                                  <span style={{ fontSize: '0.8rem' }}>Enable FFmpeg Muxing</span>
                                                  <input
                                                    type="checkbox"
                                                    checked={cfg.enable_ffmpeg !== false}
                                                    onChange={e => setCfgValue('enable_ffmpeg', e.target.checked)}
                                                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                                                  />
                                                </div>
                                              </div>
                                            </div>

                                            {/* TTS Settings */}
                                            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                                              <label style={{ fontWeight: 700, color: 'var(--action-primary)', display: 'block', fontSize: '0.82rem' }}>
                                                🔊 TTS Audio Engine Settings
                                              </label>
                                              
                                              <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Voice Provider</label>
                                                <select
                                                  className="form-input"
                                                  value={cfg.voice_provider || cfg.voiceProvider || 'minimax'}
                                                  onChange={e => {
                                                    const prov = e.target.value;
                                                    setEditedAudioConfigs(prev => {
                                                      let updated = syncAudioConfigKeyValue(prev[task.id] || task.audio_config_json, 'voice_provider', prov);
                                                      const defaultPersona = prov === 'gemini' ? 'Kore' : 'Indonesian_casual_reporter_vv2';
                                                      updated = syncAudioConfigKeyValue(updated, 'voice_persona', defaultPersona);
                                                      return { ...prev, [task.id]: updated };
                                                    });
                                                  }}
                                                >
                                                  <option value="minimax">MiniMax Speech (vv2 Engine)</option>
                                                  <option value="gemini">Google Gemini TTS (Gemini 2.5)</option>
                                                </select>
                                              </div>

                                              <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Voice Persona</label>
                                                <select
                                                  className="form-input"
                                                  value={cfg.voice_persona || cfg.voicePersona || (cfg.voice_provider === 'gemini' ? 'Kore' : 'Indonesian_casual_reporter_vv2')}
                                                  onChange={e => setCfgValue('voice_persona', e.target.value)}
                                                >
                                                  {cfg.voice_provider === 'gemini' ? (
                                                    <optgroup label="✨ Google Gemini TTS Voices (14 Karakter Selaras Pillar)">
                                                      {GEMINI_VOICES.map(v => (
                                                        <option key={v.id} value={v.id}>{v.avatar} {v.name} - {v.desc}</option>
                                                      ))}
                                                    </optgroup>
                                                  ) : (
                                                    <>
                                                      <optgroup label="🇮🇩 MiniMax Bahasa Indonesia (Vv2)">
                                                        {MINIMAX_VOICES.map(v => (
                                                          <option key={v.id} value={v.id}>{v.avatar} {v.name} - {v.desc}</option>
                                                        ))}
                                                      </optgroup>
                                                      <optgroup label="🇺🇸 MiniMax English Voices">
                                                        {MINIMAX_ENGLISH_VOICES.map(v => (
                                                          <option key={v.id} value={v.id}>{v.avatar} {v.name} - {v.desc}</option>
                                                        ))}
                                                      </optgroup>
                                                    </>
                                                  )}
                                                </select>
                                              </div>

                                              <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TTS Voice Speed ({cfg.voice_speed || '1.0'}x)</label>
                                                <input
                                                  type="range"
                                                  min="0.5"
                                                  max="2.0"
                                                  step="0.1"
                                                  value={cfg.voice_speed || 1.0}
                                                  onChange={e => setCfgValue('voice_speed', parseFloat(e.target.value))}
                                                  style={{ width: '100%' }}
                                                />
                                              </div>

                                              <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TTS Voice Volume ({cfg.voice_volume || '1.0'}x)</label>
                                                <input
                                                  type="range"
                                                  min="0.0"
                                                  max="2.0"
                                                  step="0.1"
                                                  value={cfg.voice_volume || 1.0}
                                                  onChange={e => setCfgValue('voice_volume', parseFloat(e.target.value))}
                                                  style={{ width: '100%' }}
                                                />
                                              </div>
                                            </div>

                                            {/* FFmpeg Video Studio Settings */}
                                            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                                              <label style={{ fontWeight: 700, color: 'var(--action-primary)', display: 'block', fontSize: '0.82rem' }}>
                                                🎬 FFmpeg Video Studio Settings
                                              </label>
                                              
                                              <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sync Option</label>
                                                <select
                                                  className="form-input"
                                                  value={cfg.ffmpeg_sync_option || 'smart_sync'}
                                                  onChange={e => setCfgValue('ffmpeg_sync_option', e.target.value)}
                                                >
                                                  <option value="smart_sync">Auto-Pilot Smart Sync (Rekomendasi)</option>
                                                  <option value="shortest">Shortest Clip</option>
                                                  <option value="loop">Loop Visual</option>
                                                  <option value="stretch">Stretch (Slow Down Visual)</option>
                                                </select>
                                              </div>

                                              <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Video Scale Zoom ({cfg.ffmpeg_video_scale !== undefined ? cfg.ffmpeg_video_scale : '1.1'}x)</label>
                                                <input
                                                  type="range"
                                                  min="1.0"
                                                  max="2.0"
                                                  step="0.05"
                                                  value={cfg.ffmpeg_video_scale !== undefined ? cfg.ffmpeg_video_scale : 1.1}
                                                  onChange={e => setCfgValue('ffmpeg_video_scale', parseFloat(e.target.value))}
                                                  style={{ width: '100%' }}
                                                />
                                              </div>

                                              <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SFX Volume ({cfg.ffmpeg_sfx_volume || '0.0'}x)</label>
                                                <input
                                                  type="range"
                                                  min="0.0"
                                                  max="2.0"
                                                  step="0.05"
                                                  value={cfg.ffmpeg_sfx_volume || 0.0}
                                                  onChange={e => setCfgValue('ffmpeg_sfx_volume', parseFloat(e.target.value))}
                                                  style={{ width: '100%' }}
                                                />
                                              </div>

                                              <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>BGM Volume ({cfg.ffmpeg_bgm_volume || '0.0'}x)</label>
                                                <input
                                                  type="range"
                                                  min="0.0"
                                                  max="1.0"
                                                  step="0.05"
                                                  value={cfg.ffmpeg_bgm_volume || 0.0}
                                                  onChange={e => setCfgValue('ffmpeg_bgm_volume', parseFloat(e.target.value))}
                                                  style={{ width: '100%' }}
                                                />
                                              </div>
                                            </div>

                                          </div>
                                        </div>
                                      );
                                    })()}

                                    {/* Action buttons */}
                                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16 }}>
                                      <button
                                        type="button"
                                        className="btn btn-secondary"
                                        disabled={actionLoading[task.id]}
                                        onClick={() => handleSaveChanges(task.id)}
                                      >
                                        💾 Simpan Perubahan
                                      </button>
                                      {task.status === 'waiting_approval' && (
                                        <button
                                          type="button"
                                          className="btn btn-primary"
                                          disabled={actionLoading[task.id]}
                                          onClick={() => handleApproveAndProceed(task.id)}
                                        >
                                          ✓ Approve & Proceed to Production
                                        </button>
                                      )}
                                    </div>

                                  </div>
                                )}

                                {/* Tab 3: Resep Kuliner & Paket Medsos */}
                                {activeTab === 'recipe' && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                                      <div>
                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--status-success)', textTransform: 'uppercase' }}>
                                          ✓ Paket Naskah Kuliner Siap Publikasi
                                        </span>
                                        <h4 style={{ margin: '2px 0 0', fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                          🍳 Resep & Social Media Package (Baris #{idx + 1})
                                        </h4>
                                      </div>
                                      <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                          type="button"
                                          className="btn btn-secondary btn-sm"
                                          onClick={() => {
                                            const fullText = `${editedYtTitles[task.id] || task.yt_title || ''}\n\n${editedCaptions[task.id] || task.new_caption || ''}`;
                                            navigator.clipboard.writeText(fullText.trim());
                                            showToast('Seluruh naskah & judul berhasil disalin!');
                                          }}
                                        >
                                          📋 Salin Seluruh Naskah
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-primary btn-sm"
                                          disabled={actionLoading[task.id]}
                                          onClick={() => handleSaveChanges(task.id)}
                                        >
                                          💾 Simpan Resep
                                        </button>
                                      </div>
                                    </div>

                                    {/* Judul YouTube */}
                                    <div style={{ background: 'var(--surface-interactive)', padding: 14, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--status-danger)' }}>
                                          ▶ Judul YouTube Shorts Click-Worthy (Anti-Terpotong)
                                        </label>
                                        <button
                                          type="button"
                                          className="btn btn-secondary btn-sm"
                                          style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                                          onClick={() => {
                                            navigator.clipboard.writeText(editedYtTitles[task.id] || task.yt_title || '');
                                            showToast('Judul YouTube disalin!');
                                          }}
                                        >
                                          Salin Judul
                                        </button>
                                      </div>
                                      <input
                                        type="text"
                                        value={editedYtTitles[task.id] || ''}
                                        onChange={(e) => setEditedYtTitles(prev => ({ ...prev, [task.id]: e.target.value }))}
                                        placeholder="Judul click-worthy anti-terpotong diakhiri #Shorts..."
                                        style={{ width: '100%', padding: '10px 12px', fontSize: '0.85rem', fontWeight: 600, background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6 }}
                                      />
                                    </div>

                                    {/* Textarea Caption & Resep Lengkap */}
                                    <div style={{ background: 'var(--surface-interactive)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 16 }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <label style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                          📝 Naskah Caption / Resep Lengkap (Bahan, Langkah & Medsos)
                                        </label>
                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                          {(editedCaptions[task.id] || '').length} karakter
                                        </span>
                                      </div>
                                      <textarea
                                        value={editedCaptions[task.id] || ''}
                                        onChange={(e) => setEditedCaptions(prev => ({ ...prev, [task.id]: e.target.value }))}
                                        rows={12}
                                        placeholder="Naskah resep & caption..."
                                        style={{ width: '100%', padding: 12, fontSize: '0.82rem', fontFamily: 'monospace', lineHeight: 1.6, background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6 }}
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* Tab 4: Asset Vault */}
                                {activeTab === 'vault' && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>🗄️ Asset Vault Kesiapan Render</h4>
                                    <table className="ideas-table" style={{ width: '100%' }}>
                                      <thead>
                                        <tr style={{ background: 'var(--overlay-subtle)' }}>
                                          <th style={{ padding: 8 }}>Klip Index</th>
                                          <th style={{ padding: 8 }}>Start Frame (T2I)</th>
                                          <th style={{ padding: 8 }}>Render Video G-Labs</th>
                                          <th style={{ padding: 8 }}>Voiceover Path</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {storyboard.map((clip, cidx) => {
                                          const t2iImagesList = task.t2i_images_json ? JSON.parse(task.t2i_images_json) : [];
                                          const startFrame = t2iImagesList[cidx];
                                          const glabsTask = task.glabs_tasks?.find(gt => gt.clip_index === cidx + 1);

                                          return (
                                            <tr key={cidx} style={{ borderBottom: '1px solid var(--border)' }}>
                                              <td style={{ padding: 10, textAlign: 'center' }}>Klip #{cidx + 1}</td>
                                              <td style={{ padding: 10, textAlign: 'center' }}>
                                                {startFrame ? <span style={{ color: 'var(--success)' }}>✓ Ready</span> : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                                              </td>
                                              <td style={{ padding: 10, textAlign: 'center' }}>
                                                {glabsTask?.video_url ? (
                                                  <a href={glabsTask.video_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-light)' }}>Buka G-Labs Video ➔</a>
                                                ) : <span style={{ color: 'var(--text-muted)' }}>Pending</span>}
                                              </td>
                                              <td style={{ padding: 10, textAlign: 'center' }}>
                                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Auto generated</span>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}

                                {/* Tab 4: DNA Metadata */}
                                {activeTab === 'dna' && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>🧬 10 Parameter Video DNA</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                      <div>
                                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>1. Visual Style</label>
                                        <input type="text" readOnly value={aesthetics.visualStyle || 'Cinematic'} className="form-input" style={{ background: 'var(--surface-interactive)', color: 'var(--text-muted)' }} />
                                      </div>
                                      <div>
                                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>2. Aspect Ratio</label>
                                        <input type="text" readOnly value={aesthetics.aspectRatio || '9:16'} className="form-input" style={{ background: 'var(--surface-interactive)', color: 'var(--text-muted)' }} />
                                      </div>
                                      <div>
                                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>3. Video Model</label>
                                        <input type="text" readOnly value={aesthetics.videoModel || 'veo_31_lite'} className="form-input" style={{ background: 'var(--surface-interactive)', color: 'var(--text-muted)' }} />
                                      </div>
                                      <div>
                                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>4. Narrative Mode</label>
                                        <input type="text" readOnly value={aesthetics.narrativeMode || 'Storytelling'} className="form-input" style={{ background: 'var(--surface-interactive)', color: 'var(--text-muted)' }} />
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Tab 5: System Log */}
                                {activeTab === 'logs' && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>💻 Technical log & G-Labs Sub-tasks Queue</h4>
                                    
                                    {/* Parameters table */}
                                    <div style={{ background: 'var(--surface-interactive)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
                                      <h5 style={{ margin: '0 0 10px', fontSize: '0.8rem', fontWeight: 700 }}>Detail Teknis Pipeline & Variabel</h5>
                                      <table className="ideas-table" style={{ width: '100%' }}>
                                        <tbody>
                                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: 6, fontWeight: 600 }}>ID Item</td>
                                            <td style={{ padding: 6 }}>#{task.id}</td>
                                          </tr>
                                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: 6, fontWeight: 600 }}>Voiceover Provider</td>
                                            <td style={{ padding: 6 }}>{audio.voiceProvider || 'minimax'} ({audio.voicePersona})</td>
                                          </tr>
                                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: 6, fontWeight: 600 }}>Visual Mode</td>
                                            <td style={{ padding: 6 }}>{bridging.visualMode || 'hybrid_lock'}</td>
                                          </tr>
                                          {task.nextcloud_video_url && (
                                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                              <td style={{ padding: 6, fontWeight: 600 }}>Nextcloud Storage Link</td>
                                              <td style={{ padding: 6 }}>
                                                <a href={task.nextcloud_video_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-light)' }}>Buka Nextcloud ➔</a>
                                              </td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>

                                    {/* Tasks queue */}
                                    <div style={{ background: 'var(--surface-interactive)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
                                      <h5 style={{ margin: '0 0 10px', fontSize: '0.8rem', fontWeight: 700 }}>Antrean Video Task (GLabs)</h5>
                                      {(!task.glabs_tasks || task.glabs_tasks.length === 0) ? (
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Belum ada antrean task terdaftar.</div>
                                      ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                          {task.glabs_tasks.map(gt => (
                                            <div key={gt.task_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--overlay-subtle)', padding: 10, borderRadius: 6, fontSize: '0.75rem' }}>
                                              <div>
                                                <div style={{ fontWeight: 700 }}>Task ID: {gt.task_id}</div>
                                                <div style={{ color: 'var(--text-muted)' }}>Klip {gt.clip_index} | Prompt: {gt.prompt?.slice(0, 60)}...</div>
                                              </div>
                                              <span style={{ fontWeight: 700, color: gt.status === 'completed' ? 'var(--success)' : 'var(--status-info)' }}>{gt.status}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                              </div>

                          </div>
                        </td>
                      </tr>
                    )}
                  </Suspense>
                );
              })}
            </tbody>
          </table>
        </div>

        </div>
      </main>
    </div>
  );
}

export default function CampaignDetailPage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Memuat Halaman Detail...</div>}>
      <CampaignDetailPageContent />
    </Suspense>
  );
}
