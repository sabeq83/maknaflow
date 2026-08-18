'use client';

import Sidebar from '../../components/Sidebar';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';

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

function CampaignDetailPageContent() {
  const { id } = useParams();
  const router = useRouter();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  
  // Expanded row and tab selection
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [activeTabs, setActiveTabs] = useState({}); // { [taskId]: 'storyboard' | 'deconstruct' | 'vault' | 'dna' | 'logs' }
  const [terminalLogs, setTerminalLogs] = useState('');
  
  // Inline editing states for expanded task workbenches
  const [editedStoryboards, setEditedStoryboards] = useState({}); // { [taskId]: [clips] }
  const [editedCaptions, setEditedCaptions] = useState({}); // { [taskId]: string }
  const [editedDnas, setEditedDnas] = useState({}); // { [taskId]: dnaObj }
  
  // Regeneration and replacement loadings
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
        setTasks(data.tasks || []);
        
        // Populate local states for editing if not already set
        data.tasks.forEach(t => {
          if (!editedStoryboards[t.id]) {
            let storyboard = [];
            try {
              storyboard = JSON.parse(t.remake_storyboard_json || '[]');
            } catch (_) {}
            setEditedStoryboards(prev => ({ ...prev, [t.id]: storyboard }));
          }
          if (editedCaptions[t.id] === undefined) {
            setEditedCaptions(prev => ({ ...prev, [t.id]: t.new_caption || '' }));
          }
          if (!editedDnas[t.id]) {
            let dna = {};
            try {
              dna = JSON.parse(t.vso_config_json || '{}');
            } catch (_) {}
            setEditedDnas(prev => ({ ...prev, [t.id]: dna }));
          }
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
      const res = await fetch('/api/system-logs?service=multiplier');
      const data = await res.json();
      if (data.success) {
        setTerminalLogs(data.logs || '');
      }
    } catch (_) {}
  };

  const handleRegenerateT2I = async (taskId, clipIndex, prompt) => {
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
      const res = await fetch(`/api/v2/multiplier/${taskId}/update-creative`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyboard: editedStoryboards[taskId],
          vsoConfig: JSON.parse(task.vso_config_json || '{}'),
          bridgingConfig: JSON.parse(task.bridging_config_json || '{}'),
          audioConfig: JSON.parse(task.audio_config_json || '{}'),
          newCaption: editedCaptions[taskId]
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Perubahan kreatif berhasil disimpan.');
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
      const res = await fetch(`/api/v2/multiplier/${taskId}/approve`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Kreatif disetujui! Memulai produksi video...');
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

  const firstTask = tasks[0];
  const bridging = firstTask ? JSON.parse(firstTask.bridging_config_json || '{}') : {};
  const aesthetics = firstTask ? JSON.parse(firstTask.vso_config_json || '{}') : {};
  const audio = firstTask ? JSON.parse(firstTask.audio_config_json || '{}') : {};

  // Calculate campaign status
  let overallStatus = 'draft';
  if (tasks.length > 0) {
    const completedCount = tasks.filter(t => t.status === 'completed').length;
    const failedCount = tasks.filter(t => t.status === 'failed').length;
    const processingCount = tasks.filter(t => t.status && ['remaking', 'generating_audio', 'generating_visuals', 'ffmpeg_muxing'].includes(t.status)).length;
    
    if (completedCount === tasks.length) overallStatus = 'completed';
    else if (failedCount > 0) overallStatus = 'failed';
    else if (processingCount > 0) overallStatus = 'running';
    else if (tasks.some(t => t.status === 'paused')) overallStatus = 'paused';
  }

  const getStageStatus = (taskStatus, stageName) => {
    const stagesOrder = ['resolving', 'remaking', 't2i', 'tts', 'visuals', 'ffmpeg', 'cloud', 'social'];
    const currentIdx = stagesOrder.indexOf(taskStatus);
    const targetIdx = stagesOrder.indexOf(stageName);

    if (taskStatus === 'completed') return 'success';
    if (taskStatus === 'failed' && currentIdx === targetIdx) return 'danger';
    if (taskStatus === stageName || (stageName === 'resolving' && taskStatus === 'pending_resolution')) return 'active';
    if (currentIdx > targetIdx) return 'success';
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
          const status = getStageStatus(task.status, stage.name);
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
              {status === 'danger' && (
                <button
                  type="button"
                  onClick={() => handleTriggerRetry(task.id, stage.name)}
                  style={{ background: 'var(--danger)', color: 'var(--text-primary)', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: '0.65rem', cursor: 'pointer', fontWeight: 700 }}
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
        
        {/* Header Campaign */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              onClick={() => router.push('/multiplier-lab')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.8rem', padding: '6px 12px' }}
            >
              ← Kembali ke Daftar Kampanye
            </button>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                🎬 Detail Kampanye Multiplier: {firstTask?.new_caption?.slice(0, 30) || 'Multiplier Campaign'}
              </h2>
              <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>🔑 ID Batch: {id}</span>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 6,
                  background: overallStatus === 'completed' ? 'var(--status-success-soft)' : (overallStatus === 'running' ? 'var(--status-info-soft)' : 'var(--surface-interactive)'),
                  color: overallStatus === 'completed' ? 'var(--success)' : (overallStatus === 'running' ? 'var(--status-info)' : 'var(--text-muted)')
                }}>
                  {overallStatus}
                </span>
              </div>
            </div>
          </div>
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

        {/* Configuration Accordions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          
          <details style={{ background: 'var(--surface-interactive)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <summary style={{ padding: '14px 20px', fontWeight: 600, cursor: 'pointer', background: 'var(--overlay-subtle)' }}>
              📂 Info Konfigurasi Basic Creative Strategy
            </summary>
            <div style={{ padding: 20, borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Bahasa Naskah Voiceover</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{audio.targetLanguage || 'id-ID'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Parent Folder Nextcloud</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{audio.nextcloudParentFolder || '/MAKNA_Assets'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>🎙 Audio Segment</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Provider: {audio.voiceProvider || 'minimax'} | Persona: {audio.voicePersona || 'anchor'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Audit Safe Kepatuhan VO</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{firstTask?.enable_vo_audit === 1 ? 'Aktif' : 'Nonaktif'}</span>
              </div>
            </div>
          </details>

          <details style={{ background: 'var(--surface-interactive)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <summary style={{ padding: '14px 20px', fontWeight: 600, cursor: 'pointer', background: 'var(--overlay-subtle)' }}>
              🎬 Info Konfigurasi Aesthetics & Visual Settings
            </summary>
            <div style={{ padding: 20, borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Narrative Mode</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{aesthetics.narrativeMode || 'Storytelling'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Aspect Ratio</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{aesthetics.aspectRatio || '9:16'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Target AI Engine</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{aesthetics.targetAi || 'Google Veo'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Video Model</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{aesthetics.videoModel || 'veo_31_lite'}</span>
              </div>
            </div>
          </details>

          <details style={{ background: 'var(--surface-interactive)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <summary style={{ padding: '14px 20px', fontWeight: 600, cursor: 'pointer', background: 'var(--overlay-subtle)' }}>
              🌉 Info Konfigurasi Product Bridging Settings
            </summary>
            <div style={{ padding: 20, borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Bridging Active</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{bridging.isBridgingActive ? 'Aktif' : 'Nonaktif'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Bridge At Clip</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Klip Ke-{bridging.bridgeAtClip || 2}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Promotion Style</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{bridging.promotionStyle || 'Softselling'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Visual Mode</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{bridging.visualMode || 'hybrid_lock'}</span>
              </div>
            </div>
          </details>

        </div>

        {/* Video Items Table List */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '0.95rem' }}>
            🎬 Item Produksi Video ({tasks.length})
          </div>
          <table className="ideas-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--overlay-subtle)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 20px', textAlign: 'left', width: '5%' }}>#</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', width: '55%' }}>Target Product Details / URL</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', width: '20%' }}>Status</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', width: '20%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, idx) => {
                let snap = {};
                try {
                  snap = task.product_snapshot_json ? (typeof task.product_snapshot_json === 'string' ? JSON.parse(task.product_snapshot_json) : task.product_snapshot_json) : {};
                } catch (_) {}

                const isExpanded = expandedTaskId === task.id;
                const activeTab = activeTabs[task.id] || 'storyboard';
                const storyboard = editedStoryboards[task.id] || [];

                return (
                  <Suspense key={task.id} fallback={<tr><td colSpan={4}>Loading...</td></tr>}>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '14px 20px' }}>{idx + 1}</td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: 600 }}>{snap.product_name || 'Tanpa Nama Produk'}</div>
                        <a href={task.target_product_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', color: 'var(--accent-light)', textDecoration: 'none' }}>
                          {task.target_product_url?.slice(0, 70)}...
                        </a>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', padding: '4px 10px', borderRadius: 8,
                          background: task.status === 'completed' ? 'var(--status-success-soft)' : (task.status === 'failed' ? 'var(--status-danger-soft)' : 'var(--status-info-soft)'),
                          color: task.status === 'completed' ? 'var(--success)' : (task.status === 'failed' ? 'var(--danger)' : 'var(--status-info)')
                        }}>
                          {task.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                        >
                          {isExpanded ? '▲ Tutup Workbench' : '▼ Buka Workbench'}
                        </button>
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
                                { id: 'deconstruct', label: '🔍 Dekonstruksi Asli' },
                                { id: 'storyboard', label: '📖 Storyboard & Visual Baru' },
                                { id: 'vault', label: '🗄️ Asset Vault Status' },
                                { id: 'dna', label: '🧬 DNA Metadata parameters' },
                                { id: 'logs', label: '💻 Terminal Log & Queue' }
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
                                  </div>
                                )}

                                {/* Tab 2: Storyboard & Visual Baru */}
                                {activeTab === 'storyboard' && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    
                                    {/* Start Frame Grid Preview */}
                                    {bridging.visualMode === 'hybrid_lock' && (
                                      <div style={{ background: 'var(--surface-interactive)', border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
                                        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                          🖼️ Grid Preview Start Frame Gambar (T2I)
                                        </div>
                                        
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16, marginTop: 12 }}>
                                          {storyboard.map((clip, cidx) => {
                                            const t2iImagesList = task.t2i_images_json ? JSON.parse(task.t2i_images_json) : [];
                                            const imgPath = t2iImagesList[cidx];
                                            const taskKey = `${task.id}_${cidx + 1}`;
                                            const isRegening = regeneratingT2I[taskKey];
                                            const isReplacing = replacingSF[taskKey];

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
                                                    disabled={isRegening}
                                                    onClick={() => handleRegenerateT2I(task.id, cidx + 1, clip.t2i_prompt)}
                                                    style={{ flex: 1, fontSize: '0.62rem', padding: '4px', cursor: 'pointer', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 4 }}
                                                  >
                                                    {isRegening ? '⏳' : '🔄 Regen'}
                                                  </button>
                                                  <button
                                                    type="button"
                                                    disabled={isReplacing}
                                                    onClick={() => document.getElementById(`replace-startframe-${task.id}-${cidx + 1}`).click()}
                                                    style={{ flex: 1, fontSize: '0.62rem', padding: '4px', cursor: 'pointer', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 4 }}
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
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                      {storyboard.map((clip, cidx) => (
                                        <div key={cidx} style={{ display: 'grid', gridTemplateColumns: '80px 2fr 2fr 1fr 1fr', gap: 12, background: 'var(--surface-interactive)', padding: 12, borderRadius: 6, border: '1px solid var(--border)' }}>
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid var(--border)' }}>
                                            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Klip</span>
                                            <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-light)' }}>#{cidx + 1}</span>
                                          </div>
                                          <div>
                                            <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Naskah Voiceover (VO)</label>
                                            <textarea
                                              value={clip.narration || ''}
                                              onChange={(e) => {
                                                const updated = [...storyboard];
                                                updated[cidx].narration = e.target.value;
                                                setEditedStoryboards(prev => ({ ...prev, [task.id]: updated }));
                                              }}
                                              rows={2}
                                              style={{ width: '100%', padding: 6, fontSize: '0.78rem', background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 4 }}
                                            />
                                          </div>
                                          <div>
                                            <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Aksi Visual</label>
                                            <textarea
                                              value={clip.visual_description || ''}
                                              onChange={(e) => {
                                                const updated = [...storyboard];
                                                updated[cidx].visual_description = e.target.value;
                                                setEditedStoryboards(prev => ({ ...prev, [task.id]: updated }));
                                              }}
                                              rows={2}
                                              style={{ width: '100%', padding: 6, fontSize: '0.78rem', background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 4 }}
                                            />
                                          </div>
                                          <div>
                                            <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Prompt T2I</label>
                                            <textarea
                                              value={clip.t2i_prompt || ''}
                                              onChange={(e) => {
                                                const updated = [...storyboard];
                                                updated[cidx].t2i_prompt = e.target.value;
                                                setEditedStoryboards(prev => ({ ...prev, [task.id]: updated }));
                                              }}
                                              rows={2}
                                              style={{ width: '100%', padding: 6, fontSize: '0.75rem', background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 4 }}
                                            />
                                          </div>
                                          <div>
                                            <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Prompt I2V</label>
                                            <textarea
                                              value={clip.i2v_prompt || ''}
                                              onChange={(e) => {
                                                const updated = [...storyboard];
                                                updated[cidx].i2v_prompt = e.target.value;
                                                setEditedStoryboards(prev => ({ ...prev, [task.id]: updated }));
                                              }}
                                              rows={2}
                                              style={{ width: '100%', padding: 6, fontSize: '0.75rem', background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 4 }}
                                            />
                                          </div>
                                        </div>
                                      ))}
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

                                    {/* Action buttons */}
                                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
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

                                {/* Tab 3: Asset Vault */}
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

                                    {/* Terminal logger */}
                                    <pre style={{ margin: 0, padding: 16, background: 'var(--surface)', color: '#20c20e', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', maxHeight: 150, overflowY: 'auto', borderRadius: 6 }}>
                                      {terminalLogs}
                                    </pre>
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
