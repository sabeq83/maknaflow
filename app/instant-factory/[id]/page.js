'use client';

import Sidebar from '../../components/Sidebar';
import Link from 'next/link';
import { useEffect, useState, Fragment } from 'react';
import { useParams } from 'next/navigation';

export default function InstantCampaignDetailPage() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState({});
  const [toast, setToast] = useState(null);
  const [copySuccess, setCopySuccess] = useState({});

  // Active tab per item
  const [activeTabs, setActiveTabs] = useState({}); // { [itemId]: 'storyboard' | 'prompts' | 'social' | 'logs' }
  const [expandedItemId, setExpandedItemId] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Self-Healing UI States
  const [editingItemId, setEditingItemId] = useState(null);
  const [editForm, setEditForm] = useState({
    content_pillar: '',
    custom_hook: '',
    visual_action_guideline: '',
    product_name: '',
    product_desc: '',
    product_usp: '',
    product_image_url: '',
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
      formData.append('product_image_url', editForm.product_image_url);
      formData.append('reset_status', editForm.reset_status ? 'true' : 'false');
      
      if (editForm.product_image_file) {
        formData.append('product_image_file', editForm.product_image_file);
      }

      const res = await fetch(`/api/v2/instant-factory/items/${itemId}/update-creative`, {
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
      const res = await fetch(`/api/v2/instant-factory/${id}`);
      if (!res.ok) throw new Error('Gagal memuat detail kampanye');
      const data = await res.json();
      setCampaign(data.campaign);
      setItems(data.items || []);
      setStats(data.stats);

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

  async function toggleStatus() {
    if (!campaign) return;
    let nextStatus;
    if (campaign.status === 'draft') {
      if (campaign.is_mass_production !== 1) {
        setLoading(true);
        try {
          const res = await fetch(`/api/v2/instant-factory/${campaign.id}/run`, {
            method: 'POST'
          });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.error || 'Gagal menjalankan kampanye');
          showToast(`Campaign "${campaign.campaign_name}" berhasil dijalankan!`);
          fetchDetail();
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          setLoading(false);
        }
        return;
      }
      nextStatus = 'running';
    } else {
      nextStatus = campaign.status === 'running' ? 'paused' : 'running';
    }

    try {
      const res = await fetch(`/api/v2/instant-factory/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error('Gagal update status');
      showToast(campaign.status === 'draft' ? `Campaign "${campaign.campaign_name}" dimulai!` : `Campaign ${nextStatus === 'running' ? 'dilanjutkan' : 'dijeda'}.`);
      fetchDetail();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function triggerManualStep(itemId, step) {
    if (!confirm(`Apakah Anda yakin ingin memicu proses ${step.toUpperCase()} secara manual?`)) return;
    setTriggering(prev => ({ ...prev, [`${itemId}-${step}`]: true }));
    try {
      const res = await fetch(`/api/v2/instant-factory/items/${itemId}/trigger`, {
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
    navigator.clipboard.writeText(text);
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
    lines.push(`- **Scheduler:** ${campaign.local_scheduler === 1 ? 'Testing Mode (Local Scheduler)' : 'Global Scheduler'}`);
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
      const productInfo = payload.product_name ? `${payload.product_name} (${payload.product_image_url || 'manual'})` : 'N/A';
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
      lines.push(`- **URL Produk:** ${payload.product_image_url || '-'}`);
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
      const res = await fetch(`/api/v2/instant-factory/${id}/export-markdown`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Sukses sinkronisasi! Berkas markdown telah diunggah ke Google Drive.`);
        fetchDetail();
      } else {
        showToast(`Gagal sinkronisasi ke Google Drive: ${data.error}`, 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(`Gagal sinkronisasi ke Drive: ${err.message}`, 'error');
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

  function renderPipelineStatusBadges(item) {
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
      { label: 'Storyboard', status: getStageStatus(item.generation_status) },
      { label: 'TTS', status: getStageStatus(item.tts_status) },
      { label: 'Visuals', status: getStageStatus(item.visual_status) },
      { label: 'FFmpeg', status: getStageStatus(item.ffmpeg_status) },
      { label: 'Social', status: getStageStatus(item.social_post_status) }
    ];

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {stages.map((stage, idx) => {
          let color = 'var(--text-muted)';
          let bg = 'rgba(255, 255, 255, 0.05)';
          let border = '1px solid rgba(255, 255, 255, 0.1)';
          let labelText = stage.label;
          let anim = 'none';

          if (stage.status === 'success') {
            color = '#fff';
            bg = 'rgba(16, 185, 129, 0.15)';
            border = '1px solid rgba(16, 185, 129, 0.5)';
            labelText = `✓ ${stage.label}`;
          } else if (stage.status === 'skipped') {
            color = 'rgba(255, 255, 255, 0.4)';
            bg = 'rgba(255, 255, 255, 0.03)';
            border = '1px dashed rgba(255, 255, 255, 0.15)';
            labelText = `⚡ ${stage.label}`;
          } else if (stage.status === 'danger') {
            color = '#fff';
            bg = 'rgba(239, 68, 68, 0.15)';
            border = '1px solid rgba(239, 68, 68, 0.5)';
            labelText = `✗ ${stage.label}`;
          } else if (stage.status === 'active') {
            color = '#fff';
            bg = 'rgba(59, 130, 246, 0.2)';
            border = '1px solid rgba(59, 130, 246, 0.5)';
            labelText = `⏳ ${stage.label}`;
            anim = 'active-pulse 1.5s infinite alternate';
          }

          return (
            <span 
              key={idx} 
              style={{
                padding: '3px 8px',
                borderRadius: 4,
                background: bg,
                color: color,
                fontWeight: 600,
                fontSize: '0.68rem',
                border: border,
                letterSpacing: '0.2px',
                animation: anim,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              {labelText}
            </span>
          );
        })}
      </div>
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
      prodUrl = payload.product_image_url || '';
      prodImage = payload.product_ref_image_path || null;
    } else {
      pillar = campaign?.content_pillar || '-';
      hook = campaign?.custom_hook || campaign?.hook || '-';
      visualAction = campaign?.visual_action_guideline || campaign?.visual_action || '-';
      prodName = campaign?.product_name || '-';
      prodDesc = campaign?.product_desc || campaign?.product_description || '-';
      prodUsp = campaign?.product_usp || campaign?.usp || '-';
      prodUrl = campaign?.product_image_url || '';
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
          prodUrl = payload.product_image_url || prodUrl;
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
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>🔗 TAUTAN GAMBAR PRODUK</label>
                <input 
                  type="text" 
                  value={editForm.product_image_url}
                  onChange={(e) => setEditForm(prev => ({ ...prev, product_image_url: e.target.value }))}
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
                  product_image_url: prodUrl,
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
                product_image_url: prodUrl,
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
                  🔗 Gambar Produk (URL)
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
                  🖼️ Lihat Gambar Produk ➔
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

        {/* TikTok Safe Compliance Report Card */}
        {(campaign?.enable_vo_audit === 1 || item.compliance_status) && item.compliance_status !== 'skipped' && (
          <div style={{
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            padding: '14px 16px',
            marginBottom: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.1rem' }}>🛡️</span>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff' }}>TikTok Shop Compliance Audit Status</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '4px 12px',
                borderRadius: 20,
                background: (item.compliance_status === 'PASS' || item.compliance_status === 'pass') 
                  ? 'rgba(46, 204, 113, 0.15)' 
                  : 'rgba(241, 196, 15, 0.15)',
                color: (item.compliance_status === 'PASS' || item.compliance_status === 'pass') 
                  ? '#2ecc71' 
                  : '#f1c40f',
                border: `1px solid ${(item.compliance_status === 'PASS' || item.compliance_status === 'pass') ? '#2ecc71' : '#f1c40f'}`
              }}>
                {item.compliance_status || 'PASS'}
              </span>
              {item.compliance_score !== undefined && (
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Skor Risiko: {item.compliance_score}/100
                </span>
              )}
            </div>
          </div>
        )}

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

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {clipsList.map(cNum => {
          const isHybridBridge = campaign?.is_bridging_active && campaign?.visual_mode === 'hybrid_lock' && cNum === campaign.bridge_at_clip;
          
          let displayPrompts = [];
          if (isHybridBridge) {
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
                <strong style={{ fontSize: '0.9rem' }}>Klip {cNum} {isHybridBridge && <span style={{ color: 'var(--accent-color)', fontSize: '0.75rem' }}>(Double-Pass Pixel Lock)</span>}</strong>
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
                  {isHybridBridge && item.t2i_start_frame_path && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>T2I Start Frame (Pixel Lock):</div>
                      <img src={item.t2i_start_frame_path} alt="Pixel Lock Frame" style={{ maxWidth: '120px', borderRadius: 4, border: '1px solid var(--border-color)' }} />
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
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Cloud Upload Status</td><td style={{ padding: '6px 0' }}><span className={`badge ${getStageBadgeClass(item.upload_status)}`}>{item.upload_status}</span></td></tr>
              <tr>
                <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Google Drive Folder</td>
                <td style={{ padding: '6px 0' }}>
                  {item.drive_link ? (
                    <a href={item.drive_link} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'underline' }}>
                      Buka Google Drive ➔
                    </a>
                  ) : '(Belum diunggah)'}
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
            <Link href="/instant-factory" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem' }}>
              ← Kembali ke Dashboard
            </Link>
          </div>

          {toast && (
            <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
              {toast.msg}
            </div>
          )}

          {/* CAMPAIGN TITLE BAR */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--accent-color)', fontWeight: 600, textTransform: 'uppercase' }}>IFC MASS CAMPAIGN MONITOR</div>
                <h1 style={{ margin: '4px 0 0 0', fontSize: '1.8rem', fontWeight: 700 }}>{campaign.campaign_name}</h1>
                <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '0.88rem' }}>
                  ID: <code style={{ fontSize: '0.78rem' }}>{campaign.id}</code> | Dibuat: {new Date(campaign.created_at).toLocaleString('id-ID')}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                {campaign.status !== 'completed' && (
                  <button 
                    className={`btn btn-${campaign.status === 'running' ? 'warning' : 'success'}`}
                    onClick={toggleStatus}
                  >
                    {campaign.status === 'draft' ? '▶️ Run Campaign' : (campaign.status === 'running' ? '⏸ Pause Scheduler' : '▶️ Resume Scheduler')}
                  </button>
                )}
                <button 
                  className="btn btn-secondary"
                  onClick={handleDownloadMarkdown}
                  disabled={downloading}
                >
                  {downloading ? '⏳ Downloading...' : '📝 Export Markdown'}
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={handleSyncDrive}
                  disabled={syncing}
                >
                  {syncing ? '⏳ Syncing...' : '🔄 Sync to Google Drive'}
                </button>
              </div>
            </div>

            {/* Scheduler Settings Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-secondary)', padding: '6px 16px', borderRadius: '24px', border: '1px solid var(--border-color)', fontSize: '0.78rem' }}>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={campaign.local_scheduler === 1}
                    onChange={async (e) => {
                      const active = e.target.checked;
                      try {
                        const res = await fetch(`/api/v2/instant-factory/${campaign.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ local_scheduler: active })
                        });
                        if (!res.ok) throw new Error('Gagal mengupdate skeduler');
                        fetchDetail();
                      } catch (err) {
                        alert(err.message);
                      }
                    }}
                  />
                  <span className="slider"></span>
                </label>
                <span style={{ color: campaign.local_scheduler === 1 ? 'var(--accent-color)' : 'var(--text-muted)', fontWeight: 600 }}>
                  {campaign.local_scheduler === 1 ? '⚡ Testing Mode (Local Scheduler Aktif)' : '💤 Gunakan Skeduler Global'}
                </span>
              </div>

              {/* TTS Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-secondary)', padding: '6px 16px', borderRadius: '24px', border: '1px solid var(--border-color)', fontSize: '0.78rem' }}>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={campaign.enable_tts === 1}
                    onChange={async (e) => {
                      const active = e.target.checked;
                      try {
                        const res = await fetch(`/api/v2/instant-factory/${campaign.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ enable_tts: active })
                        });
                        if (!res.ok) throw new Error('Gagal mengupdate status TTS');
                        fetchDetail();
                      } catch (err) {
                        alert(err.message);
                      }
                    }}
                  />
                  <span className="slider"></span>
                </label>
                <span style={{ color: campaign.enable_tts === 1 ? 'var(--accent-color)' : 'var(--text-muted)', fontWeight: 600 }}>
                  🎙️ TTS: {campaign.enable_tts === 1 ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>

              {/* G-Labs Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-secondary)', padding: '6px 16px', borderRadius: '24px', border: '1px solid var(--border-color)', fontSize: '0.78rem' }}>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={campaign.enable_glabs === 1}
                    onChange={async (e) => {
                      const active = e.target.checked;
                      try {
                        const res = await fetch(`/api/v2/instant-factory/${campaign.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ enable_glabs: active })
                        });
                        if (!res.ok) throw new Error('Gagal mengupdate status G-Labs');
                        fetchDetail();
                      } catch (err) {
                        alert(err.message);
                      }
                    }}
                  />
                  <span className="slider"></span>
                </label>
                <span style={{ color: campaign.enable_glabs === 1 ? 'var(--accent-color)' : 'var(--text-muted)', fontWeight: 600 }}>
                  🖼️ G-Labs: {campaign.enable_glabs === 1 ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>

              {/* FFmpeg Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-secondary)', padding: '6px 16px', borderRadius: '24px', border: '1px solid var(--border-color)', fontSize: '0.78rem' }}>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={campaign.enable_ffmpeg === 1}
                    onChange={async (e) => {
                      const active = e.target.checked;
                      try {
                        const res = await fetch(`/api/v2/instant-factory/${campaign.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ enable_ffmpeg: active })
                        });
                        if (!res.ok) throw new Error('Gagal mengupdate status FFmpeg');
                        fetchDetail();
                      } catch (err) {
                        alert(err.message);
                      }
                    }}
                  />
                  <span className="slider"></span>
                </label>
                <span style={{ color: campaign.enable_ffmpeg === 1 ? 'var(--accent-color)' : 'var(--text-muted)', fontWeight: 600 }}>
                  🎬 FFmpeg: {campaign.enable_ffmpeg === 1 ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>

              {/* Social Post Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-secondary)', padding: '6px 16px', borderRadius: '24px', border: '1px solid var(--border-color)', fontSize: '0.78rem' }}>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={campaign.enable_social_post === 1}
                    onChange={async (e) => {
                      const active = e.target.checked;
                      try {
                        const res = await fetch(`/api/v2/instant-factory/${campaign.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ enable_social_post: active })
                        });
                        if (!res.ok) throw new Error('Gagal mengupdate status Social Post');
                        fetchDetail();
                      } catch (err) {
                        alert(err.message);
                      }
                    }}
                  />
                  <span className="slider"></span>
                </label>
                <span style={{ color: campaign.enable_social_post === 1 ? 'var(--accent-color)' : 'var(--text-muted)', fontWeight: 600 }}>
                  📲 Sosmed: {campaign.enable_social_post === 1 ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              
              {campaign.local_scheduler === 1 && (
                <select
                  value={campaign.scheduler_pause_at || ''}
                  onChange={async (e) => {
                    const val = e.target.value || null;
                    try {
                      const res = await fetch(`/api/v2/instant-factory/${campaign.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ scheduler_pause_at: val })
                      });
                      if (!res.ok) throw new Error('Gagal update pause point');
                      fetchDetail();
                    } catch (err) {
                      alert(err.message);
                    }
                  }}
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    border: `1px solid ${campaign.scheduler_pause_at ? 'rgba(243,156,18,0.6)' : 'var(--border-color)'}`,
                    borderRadius: 16,
                    padding: '6px 12px',
                    fontSize: '0.78rem',
                    color: campaign.scheduler_pause_at ? '#f39c12' : 'var(--text-muted)',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <option value="">🤖 Autopilot Penuh</option>
                  <option value="tts">⛔ Pause sebelum TTS</option>
                  <option value="visuals">⛔ Pause sebelum G-Labs (Review Storyboard)</option>
                  <option value="ffmpeg">⛔ Pause sebelum FFmpeg</option>
                  <option value="social">⛔ Pause sebelum Social Post</option>
                </select>
              )}
            </div>

            {/* Config summary badges */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
              <span className="badge badge-secondary">AI: {campaign.target_ai}</span>
              <span className="badge badge-secondary">Model: {campaign.video_model}</span>
              <span className="badge badge-secondary">Rasio: {campaign.aspect_ratio}</span>
              <span className="badge badge-secondary">Style: {campaign.visual_style}</span>
              <span className="badge badge-secondary">Face: {campaign.face_visibility}</span>
              <span className="badge badge-secondary">G-Labs: {campaign.enable_glabs === 1 ? 'Aktif' : 'Nonaktif'}</span>
              {campaign.is_bridging_active === 1 && (
                <span className="badge badge-primary" style={{ background: '#3b82f6', color: '#fff' }}>
                  🌉 Bridge Aktif (Klip {campaign.bridge_at_clip})
                </span>
              )}
              {isVsoActive && (
                <span className="badge badge-primary" style={{ background: '#ec4899', color: '#fff' }}>
                  🎭 VSO Aktif
                </span>
              )}
            </div>

            {/* Google Drive Assets */}
            {(campaign.target_spreadsheet_id || campaign.target_markdown_url) && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-color)', display: 'flex', gap: 16, alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>📁 Google Drive Assets:</span>
                {campaign.target_spreadsheet_id && (
                  <a 
                    href={`https://docs.google.com/spreadsheets/d/${campaign.target_spreadsheet_id}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    📊 Google Spreadsheet
                  </a>
                )}
                {campaign.target_markdown_url && (
                  <a 
                    href={campaign.target_markdown_url} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    📝 Naskah Markdown (.md)
                  </a>
                )}
              </div>
            )}
          </div>

          {/* BASIC CREATIVE CONFIG DETAIL CARD */}
          {campaign.is_mass_production !== 1 && (
            <div className="card" style={{ marginBottom: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, fontSize: '0.9rem' }}>🎯 Pilar Konten Utama</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: 12, borderRadius: 6, margin: 0, minHeight: 60, lineHeight: 1.4 }}>
                  {campaign.content_pillar}
                </p>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 16, marginBottom: 8, fontSize: '0.9rem' }}>🎬 Aksi Visual Global</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: 12, borderRadius: 6, margin: 0, minHeight: 60, lineHeight: 1.4 }}>
                  {campaign.visual_action_guideline}
                </p>
              </div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, fontSize: '0.9rem' }}>🪝 Naskah Hook (Klip 1)</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: 12, borderRadius: 6, margin: 0, minHeight: 60, lineHeight: 1.4 }}>
                  "{campaign.custom_hook}"
                </p>
                {campaign.custom_instruction && (
                  <>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 16, marginBottom: 8, fontSize: '0.9rem' }}>💡 Instruksi Tambahan</div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: 12, borderRadius: 6, margin: 0, minHeight: 40, lineHeight: 1.4 }}>
                      {campaign.custom_instruction}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

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
                    <th style={{ width: '40%' }}>Pipeline Status</th>
                    <th style={{ width: '20%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const activeTab = activeTabs[item.id] || 'concept';
                    const hasFinalVideo = item.ffmpeg_output_path && item.ffmpeg_output_path !== 'skipped';

                    // Parse properties from payload/campaign for the summary row
                    let identifierLabel = 'Pilar';
                    let identifierVal = '-';
                    let hook = '-';
                    let payload = {};
                    try {
                      if (item.row_creative_payload) {
                        payload = JSON.parse(item.row_creative_payload);
                      }
                    } catch (_) {}

                    if (campaign?.is_mass_production === 1) {
                      identifierLabel = 'Product';
                      identifierVal = payload.product_name || '-';
                      hook = payload.custom_hook || payload.hook || '-';
                    } else {
                      identifierLabel = 'Pilar';
                      identifierVal = payload.content_pillar || campaign?.content_pillar || '-';
                      hook = payload.custom_hook || campaign?.custom_hook || campaign?.hook || '-';
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
                              {identifierLabel}: {identifierVal.length > 55 ? identifierVal.slice(0, 55) + '…' : identifierVal}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>
                              Hook: {hook.length > 45 ? `"${hook.slice(0, 45)}…"` : `"${hook}"`}
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            {renderPipelineStatusBadges(item)}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                              {hasFinalVideo && (
                                <a 
                                  href={item.ffmpeg_output_path} 
                                  download 
                                  className="btn btn-primary btn-sm" 
                                  style={{ fontSize: '0.7rem', padding: '3px 8px', textDecoration: 'none' }}
                                  onClick={e => e.stopPropagation()}
                                >
                                  ⬇️ Video
                                </a>
                              )}
                              {item.drive_link && (
                                <a 
                                  href={item.drive_link} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="btn btn-secondary btn-sm" 
                                  style={{ fontSize: '0.7rem', padding: '3px 8px', background: 'rgba(46, 204, 113, 0.15)', color: '#2ecc71', border: '1px solid rgba(46, 204, 113, 0.4)', textDecoration: 'none' }}
                                  onClick={e => e.stopPropagation()}
                                >
                                  GDrive
                                </a>
                              )}
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
                                  <span className={`badge ${getStageBadgeClass(item.ffmpeg_status)}`}>
                                    {item.ffmpeg_status === 'completed' ? 'READY' : item.ffmpeg_status === 'processing' ? 'PROCESSING' : 'PENDING'}
                                  </span>
                                </div>

                                {/* PIPELINE STATS ROW */}
                                {renderPipelineProgressBar(item)}

                                <div style={{ marginTop: 16 }}>
                                  {/* Tab Headers */}
                                  <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: 8, marginBottom: 16, overflowX: 'auto' }}>
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
