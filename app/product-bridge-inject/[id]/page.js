'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '../../components/Sidebar';

const GEMINI_VOICES = [
  { id: 'Kore', name: 'Kore (Male)' },
  { id: 'Puck', name: 'Puck (Male)' },
  { id: 'Charon', name: 'Charon (Male)' },
  { id: 'Fenrir', name: 'Fenrir (Male)' },
  { id: 'Aoede', name: 'Aoede (Female)' }
];

const MINIMAX_VOICES = [
  { id: 'Indonesian_energetic_streamer_vv2', name: '⚡ Energetic Streamer (Male)' },
  { id: 'Indonesian_crisp_reporter_vv2', name: '🎙 Crisp Reporter (Female)' },
  { id: 'Indonesian_professional_anchor_vv2', name: '📺 Professional Anchor (Female)' },
  { id: 'Indonesian_casual_reporter_vv2', name: '😊 Casual Reporter (Male)' },
  { id: 'Indonesian_intellectual_commentator_vv2', name: '🧠 Intellectual Commentator (Female)' },
  { id: 'Indonesian_compelling_storyteller_vv2', name: '📖 Compelling Storyteller (Male)' },
  { id: 'Indonesian_expressive_podcaster_vv2', name: '🎤 Expressive Podcaster (Male)' }
];

export default function BridgeBulkCampaignDetailPage() {
  const params = useParams();
  const campaignId = params.id;

  const [campaign, setCampaign] = useState(null);
  const [items, setItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Selected Item Sub-tabs: 'original_script' | 'storyboard' | 'dna' | 'logs'
  const [activeTab, setActiveTab] = useState('storyboard');

  // Input states for selected item review (Tab 2)
  const [vo1, setVo1] = useState('');
  const [vo2, setVo2] = useState('');
  const [vo3, setVo3] = useState('');
  const [vo4, setVo4] = useState('');
  const [t2iPrompt, setT2iPrompt] = useState('');
  const [i2vPrompt, setI2vPrompt] = useState('');

  // UI state loaders & alerts
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [logsText, setLogsText] = useState('');

  const fileInputRef = useRef(null);
  const selectedItemIdRef = useRef(null);

  useEffect(() => {
    if (campaignId) {
      fetchCampaignDetails();
      const interval = setInterval(() => {
        fetchCampaignDetails(true);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [campaignId]);

  useEffect(() => {
    if (campaignId) {
      pollLogs();
      const logInterval = setInterval(pollLogs, 4000);
      return () => clearInterval(logInterval);
    }
  }, [campaignId, selectedItemId]);

  async function fetchCampaignDetails(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/v2/bridge-injector/${campaignId}`);
      const data = await res.json();
      if (data.success) {
        setCampaign(data.data.campaign);
        const fetchedItems = data.data.items || [];
        setItems(fetchedItems);
        
        // Auto select first item if none is selected
        if (fetchedItems.length > 0 && !selectedItemIdRef.current) {
          selectItem(fetchedItems[0]);
        } else if (selectedItemIdRef.current) {
          // Keep inputs updated with database values if not editing
          const currentItem = fetchedItems.find(i => i.id === selectedItemIdRef.current);
          if (currentItem && !saving) {
            updateInputStatesFromItem(currentItem);
          }
        }
      } else {
        showToast(data.error || 'Gagal memuat detail kampanye.', 'error');
      }
    } catch (err) {
      if (!silent) showToast('Gagal memuat detail dari API.', 'error');
    }
    if (!silent) setLoading(false);
  }

  async function pollLogs() {
    try {
      const res = await fetch(`/api/system-logs?type=bridge_injector&t=${Date.now()}`);
      if (res.ok) {
        const text = await res.text();
        const lines = text.split('\n');
        
        // Filter lines containing the campaignId OR selectedItemId
        const filterKeyCampaign = campaignId;
        const filterKeyItem = selectedItemId ? `[BULK Item #${selectedItemId}]` : null;
        const filterKeyBulkItem = selectedItemId ? `bulk_${campaignId}_${selectedItemId}` : null;
        
        const filteredLines = lines.filter(line => {
          const hasCampaign = line.includes(filterKeyCampaign);
          const hasItem = filterKeyItem && line.includes(filterKeyItem);
          const hasBulk = filterKeyBulkItem && line.includes(filterKeyBulkItem);
          return hasCampaign || hasItem || hasBulk;
        });

        const last150 = filteredLines.slice(-150).join('\n');
        setLogsText(last150 || 'Belum ada log khusus untuk item/kampanye ini.');
      }
    } catch (e) {
      // Ignore network errors
    }
  }

  function selectItem(item) {
    setSelectedItemId(item.id);
    selectedItemIdRef.current = item.id;
    updateInputStatesFromItem(item);
  }

  function updateInputStatesFromItem(item) {
    setVo1(item.injected_vo_1 || '');
    setVo2(item.injected_vo_2 || '');
    setVo3(item.injected_vo_3 || '');
    setVo4(item.injected_vo_4 || '');
    setT2iPrompt(item.clip2_t2i_prompt || '');
    setI2vPrompt(item.clip2_i2v_prompt || '');
  }

  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function updateItemSettings(itemId, fields) {
    try {
      const res = await fetch(`/api/v2/bridge-injector/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      });
      if (!res.ok) throw new Error('Gagal memperbarui pengaturan item');
      fetchCampaignDetails(true);
      showToast('Pengaturan render baris diperbarui!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  const selectedItem = items.find(i => i.id === selectedItemId);

  // Edit/PUT Changes Handler
  async function handleSaveChanges() {
    if (!selectedItemId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v2/bridge-injector/items/${selectedItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          injected_vo_1: vo1,
          injected_vo_2: vo2,
          injected_vo_3: vo3,
          injected_vo_4: vo4,
          clip2_t2i_prompt: t2iPrompt,
          clip2_i2v_prompt: i2vPrompt
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Naskah & prompt berhasil disimpan!');
        fetchCampaignDetails(true);
      } else {
        showToast(data.error, 'error');
      }
    } catch (err) {
      showToast('Gagal menyimpan perubahan.', 'error');
    }
    setSaving(false);
  }

  // Regenerate Start Frame (T2I)
  async function handleRegenerateStartFrame() {
    if (!selectedItemId) return;
    setActionLoading(true);
    showToast('Memulai regenerasi Start Frame via G-Labs...', 'info');
    try {
      const res = await fetch(`/api/v2/bridge-injector/items/${selectedItemId}/regenerate-t2i`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t2i_prompt: t2iPrompt })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Start Frame sukses diregenerasi!');
        fetchCampaignDetails(true);
      } else {
        showToast(data.error, 'error');
      }
    } catch (err) {
      showToast('Terjadi kesalahan koneksi.', 'error');
    }
    setActionLoading(false);
  }

  // Upload custom start frame image
  async function handleReplaceStartFrame(e) {
    const file = e.target.files?.[0];
    if (!file || !selectedItemId) return;

    setActionLoading(true);
    showToast('Mengunggah gambar start frame baru...', 'info');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/v2/bridge-injector/items/${selectedItemId}/replace-start-frame`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        showToast('Start Frame berhasil diganti secara manual!');
        fetchCampaignDetails(true);
      } else {
        showToast(data.error, 'error');
      }
    } catch (err) {
      showToast('Gagal mengunggah gambar kustom.', 'error');
    }
    setActionLoading(false);
  }

  // Approve and proceed to Phase 2 (I2V + Sync)
  async function handleApproveAndProceed() {
    if (!selectedItemId) return;
    setActionLoading(true);
    showToast('Menyetujui baris naskah... Mengirim tugas video ke background queue.', 'info');
    try {
      const res = await fetch(`/api/v2/bridge-injector/items/${selectedItemId}/approve`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        showToast('Tugas video & sync berhasil masuk antrean!');
        fetchCampaignDetails(true);
      } else {
        showToast(data.error, 'error');
      }
    } catch (err) {
      showToast('Terjadi kesalahan koneksi.', 'error');
    }
    setActionLoading(false);
  }

  // Reset item to initial queue status
  async function handleResetItem(itemId) {
    if (!itemId) return;
    setActionLoading(true);
    showToast('Mereset status baris...', 'info');
    try {
      const res = await fetch(`/api/v2/bridge-injector/items/${itemId}/reset`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        showToast('Baris berhasil di-reset ke antrean awal!');
        
        // Clear active selection if the reset item was the selected one
        if (selectedItemIdRef.current === itemId) {
          setSelectedItemId(null);
          selectedItemIdRef.current = null;
        }
        
        fetchCampaignDetails(true);
      } else {
        showToast(data.error || 'Gagal mereset baris.', 'error');
      }
    } catch (err) {
      showToast('Terjadi kesalahan koneksi saat mereset baris.', 'error');
    }
    setActionLoading(false);
  }

  function getStatusLabel(status) {
    switch (status) {
      case 'pending': return { text: 'Antrean (Pending)', color: 'var(--text-muted)' };
      case 'processing': return { text: 'Sedang Proses (Phase 1)', color: '#0984e3' };
      case 'ready_for_review': return { text: 'Siap Review', color: '#fdcb6e' };
      case 'approved': return { text: 'Disetujui', color: '#e17055' };
      case 'generating_video': return { text: 'Render Video (Phase 2)', color: '#a29bfe' };
      case 'rendering_tts': return { text: 'Rendering TTS', color: '#1abc9c' };
      case 'muxing_ffmpeg': return { text: 'Muxing FFmpeg', color: '#9b59b6' };
      case 'uploading': return { text: 'Mengunggah Aset', color: '#2980b9' };
      case 'completed': return { text: 'Selesai (Completed)', color: '#2ecc71' };
      case 'failed': return { text: 'Gagal (Failed)', color: '#e74c3c' };
      default: return { text: status, color: '#fff' };
    }
  }

  function renderExpandedDetails(item) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        background: 'rgba(0, 0, 0, 0.25)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '24px'
      }}>
        {/* Error message banner */}
        {item.error_message && (
          <div style={{ background: 'rgba(231, 76, 60, 0.12)', border: '1px solid rgba(231, 76, 60, 0.3)', borderRadius: '4px', padding: '12px 16px', color: '#e74c3c', fontSize: '0.8rem' }}>
            ⚠️ Error: {item.error_message}
          </div>
        )}

        {/* Sub-tab Navigation */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setActiveTab('original_script'); }}
            style={{
              background: activeTab === 'original_script' ? 'rgba(108, 92, 231, 0.15)' : 'transparent',
              border: activeTab === 'original_script' ? '1px solid var(--accent)' : '1px solid transparent',
              color: activeTab === 'original_script' ? 'var(--accent-light)' : 'var(--text-muted)',
              padding: '8px 16px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            📖 Tab 1: Naskah Asli (Original)
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setActiveTab('storyboard'); }}
            style={{
              background: activeTab === 'storyboard' ? 'rgba(108, 92, 231, 0.15)' : 'transparent',
              border: activeTab === 'storyboard' ? '1px solid var(--accent)' : '1px solid transparent',
              color: activeTab === 'storyboard' ? 'var(--accent-light)' : 'var(--text-muted)',
              padding: '8px 16px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            🎨 Tab 2: Storyboard & Rencana Visual
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setActiveTab('dna'); }}
            style={{
              background: activeTab === 'dna' ? 'rgba(108, 92, 231, 0.15)' : 'transparent',
              border: activeTab === 'dna' ? '1px solid var(--accent)' : '1px solid transparent',
              color: activeTab === 'dna' ? 'var(--accent-light)' : 'var(--text-muted)',
              padding: '8px 16px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            🧬 Tab 3: Metadata DNA
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setActiveTab('logs'); }}
            style={{
              background: activeTab === 'logs' ? 'rgba(108, 92, 231, 0.15)' : 'transparent',
              border: activeTab === 'logs' ? '1px solid var(--accent)' : '1px solid transparent',
              color: activeTab === 'logs' ? 'var(--accent-light)' : 'var(--text-muted)',
              padding: '8px 16px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            🖥 Tab 4: System Log
          </button>
        </div>

        {/* Panels */}
        {activeTab === 'original_script' && (
          <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '20px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#fff' }}>📄 Naskah Markdown Asli (Diunduh)</h4>
            {item.original_script_content ? (
              <pre style={{
                margin: 0, padding: '16px', borderRadius: '4px',
                background: '#07070a', color: 'var(--text-secondary)',
                fontSize: '0.82rem', fontFamily: 'var(--font-mono)',
                maxHeight: '400px', overflowY: 'auto', whiteSpace: 'pre-wrap',
                lineHeight: '1.5', border: '1px solid var(--border)'
              }}>
                {item.original_script_content}
              </pre>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '24px' }}>
                {item.download_status === 'pending' ? '⏳ Sedang mengunduh naskah...' : '❌ Gagal mengunduh isi naskah.'}
              </p>
            )}
          </div>
        )}

        {activeTab === 'storyboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* TikTok Safe Compliance Report Card */}
            {(campaign?.enable_vo_audit === 1 || item.compliance_status) && item.compliance_status !== 'skipped' && (
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.1rem' }}>🛡️</span>
                  <span style={{ fontWeight: '700', fontSize: '0.85rem', color: '#fff' }}>TikTok Shop Compliance Audit Status</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    padding: '4px 12px',
                    borderRadius: '20px',
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
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      color: 'var(--text-muted)'
                    }}>
                      Skor Risiko: {item.compliance_score}/100
                    </span>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              
              {/* Left Panel: VO Text Editor */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--accent-light)', display: 'block', marginBottom: '8px' }}>
                    KLIP 1: HOOK (ORIGINAL)
                  </span>
                  <textarea
                    className="form-input"
                    rows="3"
                    value={vo1}
                    onChange={e => setVo1(e.target.value)}
                    style={{ fontSize: '0.8rem', lineHeight: '1.4' }}
                    disabled={['pending', 'processing'].includes(item.workflow_status)}
                  />
                </div>

                <div style={{ 
                  background: 'var(--bg-card)', 
                  padding: '16px', 
                  borderRadius: 'var(--radius-sm)', 
                  border: '2px solid #2ecc71',
                  boxShadow: '0 0 12px rgba(46, 204, 113, 0.05)'
                }}>
                  <span style={{ fontWeight: 700, fontSize: '0.75rem', color: '#2ecc71', display: 'block', marginBottom: '8px' }}>
                    KLIP 2: PRODUCT INJECTED (NEW)
                  </span>
                  <textarea
                    className="form-input"
                    rows="3"
                    value={vo2}
                    onChange={e => setVo2(e.target.value)}
                    style={{ fontSize: '0.8rem', lineHeight: '1.4', fontWeight: 'bold' }}
                    disabled={['pending', 'processing'].includes(item.workflow_status)}
                  />
                </div>

                <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--accent-light)', display: 'block', marginBottom: '8px' }}>
                    KLIP 3: CONTINUATION
                  </span>
                  <textarea
                    className="form-input"
                    rows="3"
                    value={vo3}
                    onChange={e => setVo3(e.target.value)}
                    style={{ fontSize: '0.8rem', lineHeight: '1.4' }}
                    disabled={['pending', 'processing'].includes(item.workflow_status)}
                  />
                </div>

                <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--accent-light)', display: 'block', marginBottom: '8px' }}>
                    KLIP 4: CTA
                  </span>
                  <textarea
                    className="form-input"
                    rows="3"
                    value={vo4}
                    onChange={e => setVo4(e.target.value)}
                    style={{ fontSize: '0.8rem', lineHeight: '1.4' }}
                    disabled={['pending', 'processing'].includes(item.workflow_status)}
                  />
                </div>
              </div>

              {/* Right Panel: Previews */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.75rem', color: '#fff', display: 'block', marginBottom: '10px' }}>
                    🖼️ INJECTION START FRAME PREVIEW (T2I)
                  </span>
                  <div style={{
                    width: '100%', height: '220px', background: '#07070a',
                    borderRadius: '4px', border: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    overflow: 'hidden', position: 'relative', marginBottom: '12px'
                  }}>
                    {item.clip2_t2i_image_path ? (
                      <img 
                        src={`${item.clip2_t2i_image_path}`}
                        alt="Start Frame"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : item.t2i_status === 'processing' ? (
                      <div style={{ textAlign: 'center' }}>
                        <div className="spinner" style={{ borderTopColor: 'var(--accent)' }} />
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px' }}>Menge-render Start Frame...</p>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Belum ada gambar start frame.</span>
                    )}
                  </div>

                  {!['pending', 'processing'].includes(item.workflow_status) && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleRegenerateStartFrame(); }}
                        disabled={actionLoading}
                        className="btn btn-secondary"
                        style={{ flex: 1, fontSize: '0.75rem', padding: '6px 12px' }}
                      >
                        🔄 Re-generate SF
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                        disabled={actionLoading}
                        className="btn btn-secondary"
                        style={{ flex: 1, fontSize: '0.75rem', padding: '6px 12px' }}
                      >
                        📤 Upload SF Kustom
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        accept="image/*" 
                        onChange={handleReplaceStartFrame} 
                        style={{ display: 'none' }}
                      />
                    </div>
                  )}
                </div>

                <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.75rem', color: '#fff', display: 'block', marginBottom: '10px' }}>
                    🎥 INJECTION VIDEO PREVIEW (I2V)
                  </span>
                  <div style={{
                    width: '100%', height: '220px', background: '#07070a',
                    borderRadius: '4px', border: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    overflow: 'hidden', position: 'relative', marginBottom: '12px'
                  }}>
                    {item.clip2_video_path ? (
                      <video 
                        src={`${item.clip2_video_path}`}
                        controls
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : item.i2v_status === 'processing' ? (
                      <div style={{ textAlign: 'center' }}>
                        <div className="spinner" style={{ borderTopColor: 'var(--accent)' }} />
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px' }}>Menge-render Klip Video di G-Labs...</p>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Video belum di-render. Approve dulu baris ini.</span>
                    )}
                  </div>
                </div>
              </div>

            </div>

            <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>T2I Prompt (Start Frame)</label>
                  <textarea
                    className="form-input"
                    rows="2"
                    value={t2iPrompt}
                    onChange={e => setT2iPrompt(e.target.value)}
                    style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}
                    disabled={['pending', 'processing'].includes(item.workflow_status)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>I2V Prompt (Video Animation)</label>
                  <textarea
                    className="form-input"
                    rows="2"
                    value={i2vPrompt}
                    onChange={e => setI2vPrompt(e.target.value)}
                    style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}
                    disabled={['pending', 'processing'].includes(item.workflow_status)}
                  />
                </div>
              </div>

            {/* Row-level Render Configuration Card */}
            <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border)', borderRadius: '6px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--accent-light)', display: 'block' }}>
                ⚙️ Konfigurasi Render & TTS untuk Baris Ini
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                
                {/* TTS Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '40px', height: '20px' }}>
                      <input
                        type="checkbox"
                        checked={item.enable_tts === 1}
                        onChange={(e) => updateItemSettings(item.id, { enable_tts: e.target.checked ? 1 : 0 })}
                        disabled={['pending', 'processing'].includes(item.workflow_status)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span className="slider" style={{
                        position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: item.enable_tts === 1 ? 'var(--accent)' : '#ccc',
                        borderRadius: '20px', transition: '0.4s'
                      }}></span>
                    </label>
                    <span style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 600 }}>Aktifkan TTS Voiceover</span>
                  </div>

                  {item.enable_tts === 1 && (
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>TTS Provider</label>
                          <select
                            value={item.voice_provider || 'minimax'}
                            onChange={(e) => updateItemSettings(item.id, { voice_provider: e.target.value })}
                            disabled={['pending', 'processing'].includes(item.workflow_status)}
                            style={{ width: '100%', background: '#000', border: '1px solid var(--border)', borderRadius: '4px', padding: '6px', color: '#fff', fontSize: '0.78rem', outline: 'none' }}
                          >
                            <option value="gemini">Gemini Audio</option>
                            <option value="minimax">MiniMax TTS</option>
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Voice Persona</label>
                          <select
                            value={item.voice_persona || 'Indonesian_casual_reporter_vv2'}
                            onChange={(e) => updateItemSettings(item.id, { voice_persona: e.target.value })}
                            disabled={['pending', 'processing'].includes(item.workflow_status)}
                            style={{ width: '100%', background: '#000', border: '1px solid var(--border)', borderRadius: '4px', padding: '6px', color: '#fff', fontSize: '0.78rem', outline: 'none' }}
                          >
                            {((item.voice_provider || 'minimax') === 'minimax' ? MINIMAX_VOICES : GEMINI_VOICES).map(voice => (
                              <option key={voice.id} value={voice.id}>
                                {voice.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span>Speed</span>
                            <span>{item.voice_speed || 1.0}x</span>
                          </label>
                          <input
                            type="range"
                            min="0.5"
                            max="2.0"
                            step="0.1"
                            value={item.voice_speed || 1.0}
                            onChange={(e) => updateItemSettings(item.id, { voice_speed: Number(e.target.value) })}
                            disabled={['pending', 'processing'].includes(item.workflow_status)}
                            style={{ width: '100%', accentColor: 'var(--accent)' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span>Volume</span>
                            <span>{item.voice_volume || 1.0}</span>
                          </label>
                          <input
                            type="range"
                            min="0.1"
                            max="2.0"
                            step="0.1"
                            value={item.voice_volume || 1.0}
                            onChange={(e) => updateItemSettings(item.id, { voice_volume: Number(e.target.value) })}
                            disabled={['pending', 'processing'].includes(item.workflow_status)}
                            style={{ width: '100%', accentColor: 'var(--accent)' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* FFmpeg Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '40px', height: '20px' }}>
                      <input
                        type="checkbox"
                        checked={item.enable_ffmpeg === 1}
                        onChange={(e) => updateItemSettings(item.id, { enable_ffmpeg: e.target.checked ? 1 : 0 })}
                        disabled={['pending', 'processing'].includes(item.workflow_status)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span className="slider" style={{
                        position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: item.enable_ffmpeg === 1 ? 'var(--accent)' : '#ccc',
                        borderRadius: '20px', transition: '0.4s'
                      }}></span>
                    </label>
                    <span style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 600 }}>Aktifkan FFmpeg Muxing</span>
                  </div>

                  {item.enable_ffmpeg === 1 && (
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Sync Option</label>
                          <select
                            value={item.ffmpeg_sync_option || 'smart_sync'}
                            onChange={(e) => updateItemSettings(item.id, { ffmpeg_sync_option: e.target.value })}
                            disabled={['pending', 'processing'].includes(item.workflow_status)}
                            style={{ width: '100%', background: '#000', border: '1px solid var(--border)', borderRadius: '4px', padding: '6px', color: '#fff', fontSize: '0.78rem', outline: 'none' }}
                          >
                            <option value="smart_sync">Autopilot Smart Sync</option>
                            <option value="stretch">Stretch (Symmetrical Speed)</option>
                            <option value="shortest">Shortest (Trim duration)</option>
                            <option value="freeze">Freeze Frame (Hold last frame)</option>
                            <option value="loop">Loop Visual</option>
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span>Video Scale (Zoom)</span>
                            <span>{item.ffmpeg_video_scale || 1.0}x</span>
                          </label>
                          <input
                            type="range"
                            min="1.0"
                            max="2.0"
                            step="0.05"
                            value={item.ffmpeg_video_scale || 1.0}
                            onChange={(e) => updateItemSettings(item.id, { ffmpeg_video_scale: Number(e.target.value) })}
                            disabled={['pending', 'processing'].includes(item.workflow_status)}
                            style={{ width: '100%', accentColor: 'var(--accent)' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span>SFX Volume</span>
                            <span>{item.ffmpeg_sfx_volume !== undefined ? item.ffmpeg_sfx_volume : 0.0}</span>
                          </label>
                          <input
                            type="range"
                            min="0.0"
                            max="2.0"
                            step="0.1"
                            value={item.ffmpeg_sfx_volume !== undefined ? item.ffmpeg_sfx_volume : 0.0}
                            onChange={(e) => updateItemSettings(item.id, { ffmpeg_sfx_volume: Number(e.target.value) })}
                            disabled={['pending', 'processing'].includes(item.workflow_status)}
                            style={{ width: '100%', accentColor: 'var(--accent)' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span>BGM Volume</span>
                            <span>{item.ffmpeg_bgm_volume !== undefined ? item.ffmpeg_bgm_volume : 0.0}</span>
                          </label>
                          <input
                            type="range"
                            min="0.0"
                            max="2.0"
                            step="0.1"
                            value={item.ffmpeg_bgm_volume !== undefined ? item.ffmpeg_bgm_volume : 0.0}
                            onChange={(e) => updateItemSettings(item.id, { ffmpeg_bgm_volume: Number(e.target.value) })}
                            disabled={['pending', 'processing'].includes(item.workflow_status)}
                            style={{ width: '100%', accentColor: 'var(--accent)' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); handleSaveChanges(); }} 
                className="btn btn-secondary" 
                disabled={saving}
                style={{ padding: '10px 20px', fontSize: '0.82rem' }}
              >
                {saving ? '⏳ Menyimpan...' : '💾 Simpan Perubahan'}
              </button>
              {item.workflow_status === 'ready_for_review' && (
                <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleApproveAndProceed(); }} 
                  className="btn btn-success" 
                  disabled={actionLoading}
                  style={{ padding: '10px 24px', fontSize: '0.82rem', fontWeight: 'bold', boxShadow: '0 0 15px rgba(46, 204, 113, 0.2)' }}
                >
                  ✅ Approve & Proceed Video
                </button>
              )}
            </div>
            </div>
          </div>
        )}

        {activeTab === 'dna' && (
          <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '20px' }}>
            <h4 style={{ margin: '0 0 14px 0', fontSize: '0.9rem', color: '#fff' }}>🧬 Detail Informasi & Metadata DNA</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px', color: 'var(--text-muted)' }}>URL Naskah Sumber</th>
                  <td style={{ padding: '10px', wordBreak: 'break-all' }}>
                    <a href={item.original_script_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-light)' }}>
                      {item.original_script_url}
                    </a>
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px', color: 'var(--text-muted)' }}>URL Target Produk</th>
                  <td style={{ padding: '10px', wordBreak: 'break-all' }}>
                    <a href={item.product_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-light)' }}>
                      {item.product_url}
                    </a>
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px', color: 'var(--text-muted)' }}>Produk Terpetakan</th>
                  <td style={{ padding: '10px', fontWeight: 600 }}>{item.product_name || 'Menunggu pemetaan...'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px', color: 'var(--text-muted)' }}>Folder Nextcloud</th>
                  <td style={{ padding: '10px', fontFamily: 'var(--font-mono)' }}>{item.nextcloud_folder}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px', color: 'var(--text-muted)' }}>Path Naskah Bridging Lokal</th>
                  <td style={{ padding: '10px', fontFamily: 'var(--font-mono)' }}>{item.injected_script_md_path || '-'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px', color: 'var(--text-muted)' }}>Path Start Frame Lokal</th>
                  <td style={{ padding: '10px', fontFamily: 'var(--font-mono)' }}>{item.clip2_t2i_image_path || '-'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px', color: 'var(--text-muted)' }}>Path Video Klip Lokal</th>
                  <td style={{ padding: '10px', fontFamily: 'var(--font-mono)' }}>{item.clip2_video_path || '-'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px', color: 'var(--text-muted)' }}>Status TTS</th>
                  <td style={{ padding: '10px', fontWeight: 600 }}>{item.tts_status || 'pending'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px', color: 'var(--text-muted)' }}>Status FFmpeg Muxing</th>
                  <td style={{ padding: '10px', fontWeight: 600 }}>{item.ffmpeg_status || 'pending'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px', color: 'var(--text-muted)' }}>Status Sync Nextcloud</th>
                  <td style={{ padding: '10px', fontWeight: 600 }}>{item.sync_status || 'pending'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="card" style={{ background: '#050508', border: '1px solid var(--border)', padding: '0' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#09090e' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: '600', color: '#ffb86c' }}>
                🖥 SYSTEM ACTIVITY TERMINAL (FILTERED)
              </span>
              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); pollLogs(); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
              >
                [Refresh Log]
              </button>
            </div>
            <pre style={{
              margin: 0, padding: '20px', background: '#050508', color: '#50fa7b',
              fontFamily: 'var(--font-mono)', fontSize: '0.8rem', maxHeight: '350px',
              overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: '1.5'
            }}>
              {logsText}
            </pre>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app-container" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-app)' }}>
      <Sidebar />

      <main className="main-content" style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
        <div style={{ maxWidth: '1250px', margin: '0 auto' }}>
          
          {toast && (
            <div style={{
              position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
              padding: '12px 24px', borderRadius: 'var(--radius-sm)',
              fontSize: '0.88rem', fontWeight: 500, boxShadow: 'var(--shadow-lg)',
              background: toast.type === 'error' ? 'var(--danger)' : (toast.type === 'info' ? 'var(--accent)' : 'var(--success)'),
              color: '#fff', transition: 'all 0.3s ease'
            }}>
              {toast.type === 'error' ? '❌ ' : (toast.type === 'info' ? 'ℹ️ ' : '✅ ')} {toast.message}
            </div>
          )}

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
            <div>
              <a href="/product-bridge-inject" style={{ color: 'var(--accent-light)', fontSize: '0.82rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
                ⬅️ Kembali ke Dashboard Lab
              </a>
              <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#fff' }}>
                🛠️ Workbench Massal: {campaign?.campaign_name || 'Memuat...'}
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '4px' }}>
                Review baris demi baris, edit naskah, setujui start-frame, dan unggah video secara massal.
              </p>
            </div>
            <button 
              type="button" 
              onClick={() => fetchCampaignDetails()} 
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '8px 14px' }}
            >
              🔄 Refresh Detail
            </button>
          </div>

          {campaign?.custom_instruction && (
            <div style={{
              background: 'rgba(9, 132, 227, 0.08)',
              borderLeft: '4px solid var(--accent)',
              padding: '12px 16px',
              borderRadius: '4px',
              marginBottom: '20px',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)'
            }}>
              <strong>💡 Instruksi Khusus Kampanye:</strong>
              <div style={{ marginTop: '4px', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
                "{campaign.custom_instruction}"
              </div>
            </div>
          )}



          {loading ? (
            <div style={{ color: 'var(--text-secondary)', padding: '40px', textAlign: 'center' }}>
              Memuat data Workbench kampanye...
            </div>
          ) : (
            <div className="card" style={{ padding: '0px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>
                📋 Daftar Baris Import ({items.length})
              </div>
              <table className="ideas-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', margin: 0 }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ width: '5%', padding: '12px 20px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>#</th>
                    <th style={{ width: '55%', padding: '12px 20px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Target URL / Nextcloud</th>
                    <th style={{ width: '20%', padding: '12px 20px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Status</th>
                    <th style={{ width: '20%', padding: '12px 20px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const isExpanded = item.id === selectedItemId;
                    const statusInfo = getStatusLabel(item.workflow_status);
                    
                    return (
                      <React.Fragment key={item.id}>
                        <tr style={{ borderBottom: '1px solid var(--border)', background: isExpanded ? 'rgba(108, 92, 231, 0.04)' : 'transparent', transition: 'background 0.2s' }}>
                          <td style={{ padding: '16px 20px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{idx + 1}</td>
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#fff' }}>
                              {item.product_name || 'Menunggu Sourcing Produk...'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                              Naskah: <a href={item.original_script_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-light)', textDecoration: 'none' }}>
                                {item.original_script_url.length > 50 ? item.original_script_url.slice(0, 50) + '…' : item.original_script_url}
                              </a>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              Nextcloud: <span style={{ fontFamily: 'var(--font-mono)' }}>{item.nextcloud_folder}</span>
                            </div>
                          </td>
                          <td style={{ padding: '16px 20px' }}>
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '4px 10px',
                              borderRadius: '12px',
                              background: statusInfo.color + '22',
                              color: statusInfo.color,
                              border: `1px solid ${statusInfo.color}33`
                            }}>
                              {statusInfo.text}
                            </span>
                          </td>
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isExpanded) {
                                    setSelectedItemId(null);
                                    selectedItemIdRef.current = null;
                                  } else {
                                    selectItem(item);
                                  }
                                }}
                                className="btn btn-secondary btn-sm"
                                style={{
                                  fontSize: '0.72rem',
                                  padding: '6px 12px',
                                  background: isExpanded ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                                  color: '#fff',
                                  border: '1px solid rgba(255,255,255,0.1)'
                                }}
                              >
                                {isExpanded ? '📖 Tutup' : '📖 Detail'}
                              </button>

                              {!['pending', 'processing'].includes(item.workflow_status) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('Apakah Anda yakin ingin me-reset baris ini kembali ke antrean awal?')) {
                                      handleResetItem(item.id);
                                    }
                                  }}
                                  className="btn btn-secondary btn-sm"
                                  style={{
                                    fontSize: '0.72rem',
                                    padding: '6px 12px',
                                    background: '#c0392b',
                                    color: '#fff',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                  }}
                                >
                                  💥 Reset
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan="4" style={{ background: 'var(--bg-secondary)', padding: '24px 20px', borderTop: 'none', borderBottom: '1px solid var(--border)' }}>
                              {renderExpandedDetails(item)}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
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
