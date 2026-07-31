'use client';

import Sidebar from '../components/Sidebar';
import { useEffect, useState, useRef } from 'react';

export default function ProductionPage() {
  const [ideas, setIdeas] = useState([]);
  const [generating, setGenerating] = useState(null);
  const [activeAsset, setActiveAsset] = useState(null);
  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState('storyboard');
  const [googleConnected, setGoogleConnected] = useState(false);
  const [exporting, setExporting] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [pipelineUrl, setPipelineUrl] = useState('');
  const [generatingAssets, setGeneratingAssets] = useState({});
  const [assetResults, setAssetResults] = useState({});
  const outputPanelRef = useRef(null);

  useEffect(() => { fetchIdeas(); fetchGoogleStatus(); fetchPipelineInfo(); }, []);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function fetchIdeas() {
    const res = await fetch('/api/ideas');
    const data = await res.json();
    if (data.success) setIdeas(data.data);
  }

  async function fetchGoogleStatus() {
    try {
      const res = await fetch('/api/google/status');
      const data = await res.json();
      if (data.success) setGoogleConnected(data.data.connected);
    } catch (e) { console.error(e); }
  }

  async function exportToGoogle(type) {
    if (!activeAsset?.asset_id) return;
    setExporting(type);
    try {
      const res = await fetch(`/api/export/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeAsset.asset_id, source: 'production' }),
      });
      const data = await res.json();
      if (data.success) {
        window.open(data.data.url, '_blank');
        showToast(`Export ke Google ${type === 'sheets' ? 'Sheets' : 'Docs'} berhasil!`);
      } else {
        showToast(data.error || 'Export gagal', 'error');
      }
    } catch (e) { showToast(e.message, 'error'); }
    setExporting('');
  }

  async function fetchPipelineInfo() {
    try {
      const res = await fetch('/api/export/pipeline');
      const data = await res.json();
      if (data.success && data.data.url) setPipelineUrl(data.data.url);
    } catch (e) { console.error(e); }
  }

  async function syncToPipeline() {
    if (!activeAsset?.asset_id) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/export/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeAsset.asset_id, source: 'production', stage: 'production' }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.data.url) setPipelineUrl(data.data.url);
        window.open(data.data.url, '_blank');
        showToast(`${data.data.scenesCount} scenes synced ke Pipeline! (${data.data.batchId})`);
      } else {
        showToast(data.error || 'Sync gagal', 'error');
      }
    } catch (e) { showToast(e.message, 'error'); }
    setSyncing(false);
  }

  async function generateAssetProd(sceneIndex, type, prompt) {
    const key = `${type}_${sceneIndex}`;
    setGeneratingAssets(prev => ({ ...prev, [key]: 'submitting' }));
    try {
      const res = await fetch('/api/webhook/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, prompt, aspect_ratio: '9:16' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setGeneratingAssets(prev => ({ ...prev, [key]: 'polling' }));
      pollTaskProd(key, data.data.task_id, type);
    } catch (e) {
      showToast(`${type} gen failed: ${e.message}`, 'error');
      setGeneratingAssets(prev => ({ ...prev, [key]: null }));
    }
  }

  async function pollTaskProd(key, taskId, type) {
    for (let i = 0; i < 90; i++) {
      await new Promise(r => setTimeout(r, 10000));
      try {
        const res = await fetch(`/api/webhook/status?task_id=${taskId}`);
        const data = await res.json();
        if (data.success && data.data.status === 'completed') {
          const urls = data.data.results || [];
          setGeneratingAssets(prev => ({ ...prev, [key]: 'uploading to Drive...' }));

          const driveUrls = [];
          const sceneNum = parseInt(key.split('_')[1]) + 1;
          const batchId = activeAsset?.asset_id?.substring(0, 8) || 'PROD-batch';
          for (const fileUrl of urls) {
            try {
              const ext = fileUrl.split('.').pop()?.split('?')[0] || (type === 'image' ? 'png' : 'mp4');
              const mime = type === 'image' ? `image/${ext}` : `video/${ext === 'mp4' ? 'mp4' : 'webm'}`;
              const driveRes = await fetch('/api/drive/upload-asset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  file_url: fileUrl,
                  batch_id: `PROD-${batchId}`,
                  filename: `${type}_scene_${String(sceneNum).padStart(2, '0')}.${ext}`,
                  mime_type: mime,
                }),
              });
              const driveData = await driveRes.json();
              if (driveData.success) driveUrls.push(driveData.data);
            } catch (e) { console.error('Drive upload failed:', e); }
          }

          setAssetResults(prev => ({ ...prev, [key]: { status: 'done', urls, drive: driveUrls } }));
          setGeneratingAssets(prev => ({ ...prev, [key]: null }));
          showToast(`${type === 'image' ? '🖼️' : '🎬'} Scene ${sceneNum} done${driveUrls.length ? ' + uploaded to Drive!' : '!'}`);
          return;
        }
        if (data.success && data.data.status === 'failed') {
          setAssetResults(prev => ({ ...prev, [key]: { status: 'failed', error: data.data.error_detail || 'Error' } }));
          setGeneratingAssets(prev => ({ ...prev, [key]: null }));
          showToast(`${type} failed`, 'error');
          return;
        }
        setGeneratingAssets(prev => ({ ...prev, [key]: `polling (${i + 1})` }));
      } catch { /* retry */ }
    }
    setGeneratingAssets(prev => ({ ...prev, [key]: null }));
    showToast(`${type} timeout`, 'error');
  }

  async function generateAllProd(type, prompts) {
    for (let i = 0; i < prompts.length; i++) {
      generateAssetProd(i, type, prompts[i].prompt);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  async function generateAssets(ideaId) {
    setGenerating(ideaId);
    setActiveAsset(null);
    try {
      const res = await fetch('/api/production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea_id: ideaId }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveAsset(data.data);
        showToast('Production assets berhasil di-generate!');
        fetchIdeas();
      } else {
        showToast(data.error || 'Gagal generate assets', 'error');
      }
    } catch (e) { showToast(e.message, 'error'); }
    setGenerating(null);
  }

  async function regeneratePrompts(ideaId, assetId) {
    setGenerating(ideaId);
    try {
      const res = await fetch('/api/production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea_id: ideaId, action: 'regenerate_prompts', asset_id: assetId }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveAsset(data.data);
        showToast('Prompt T2I & I2V berhasil di-regenerate!');
        if (tab !== 't2i' && tab !== 'i2v') setTab('i2v');
      } else {
        showToast(data.error || 'Gagal regenerate prompts', 'error');
      }
    } catch (e) { showToast(e.message, 'error'); }
    setGenerating(null);
  }

  async function viewAssets(ideaId) {
    try {
      const res = await fetch(`/api/assets?idea_id=${ideaId}`);
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        setActiveAsset(data.data[0]);
        setTab('storyboard');
        setTimeout(() => {
          outputPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    } catch (e) { showToast(e.message, 'error'); }
  }

  async function deleteIdea(id) {
    if (!confirm('Hapus ide ini?')) return;
    await fetch('/api/ideas', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    fetchIdeas();
    if (activeAsset?.idea_id === id) setActiveAsset(null);
    showToast('Ide dihapus');
  }

  function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied!`);
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-container">
          <div className="page-header">
            <h2>⬡ Stage 2 — Production Board</h2>
            <p>Generate storyboard, AI prompts & caption dari ide konten</p>
          </div>

          {/* Ideas Table */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-title"><span className="icon">💡</span> Daftar Ide Konten</div>
            {ideas.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💡</div>
                <h3>Belum ada ide</h3>
                <p>Generate ide di <a href="/ideation" style={{ color: 'var(--accent-light)' }}>Stage 1 — Ideation</a> terlebih dahulu</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="ideas-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>CEP</th>
                      <th>Scene</th>
                      <th>Mode</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ideas.map(idea => (
                      <tr key={idea.id}>
                        {/* Product */}
                        <td style={{ minWidth: '120px', fontWeight: 500, fontSize: '0.85rem' }}>
                          {idea.product_name || '—'}
                        </td>

                        {/* CEP — Rich Composite Cell */}
                        <td style={{ minWidth: '280px', maxWidth: '420px' }}>
                          {/* Row 1: Category CEP (bold accent) */}
                          {idea.category_cep && (
                            <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--accent-light)', marginBottom: '2px' }}>
                              🏷 {idea.category_cep}
                            </div>
                          )}
                          {/* Row 2: Main CEP */}
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: '4px', lineHeight: 1.4 }} title={idea.cep || idea.topik || ''}>
                            {idea.cep || idea.topik || '—'}
                          </div>
                          {/* Separator + Detail rows */}
                          {(idea.sub_cep_matrix || idea.vfo || idea.key_messages) && (
                            <div style={{ borderTop: '1px dotted var(--border)', paddingTop: '4px', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              {idea.sub_cep_matrix && (
                                <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.35 }} title={idea.sub_cep_matrix}>
                                  📊 <span style={{ opacity: 0.7 }}>SubCEP:</span> {idea.sub_cep_matrix.length > 80 ? idea.sub_cep_matrix.substring(0, 80) + '…' : idea.sub_cep_matrix}
                                </div>
                              )}
                              {idea.vfo && (
                                <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.35 }} title={idea.vfo}>
                                  💎 <span style={{ opacity: 0.7 }}>VFO:</span> {idea.vfo.length > 80 ? idea.vfo.substring(0, 80) + '…' : idea.vfo}
                                </div>
                              )}
                              {idea.key_messages && (
                                <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.35 }} title={idea.key_messages}>
                                  🎯 <span style={{ opacity: 0.7 }}>Msg:</span> {idea.key_messages.length > 80 ? idea.key_messages.substring(0, 80) + '…' : idea.key_messages}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Scene */}
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', textAlign: 'center' }}>{idea.jumlah_klip}</td>

                        {/* Mode */}
                        <td><span style={{ fontSize: '0.78rem' }}>{idea.narrative_mode}</span></td>

                        {/* Status */}
                        <td><span className={`status-badge ${idea.status === 'Generated' ? 'status-generated' : 'status-draft'}`}>{idea.status}</span></td>

                        {/* Aksi */}
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            {idea.status === 'Generated' ? (
                              <>
                                <button className="btn btn-sm btn-secondary" onClick={() => viewAssets(idea.id)}>👁 View</button>
                                <button className="btn btn-sm btn-outline-warning" onClick={() => generateAssets(idea.id)} disabled={generating === idea.id} title="Regenerate Assets">
                                  {generating === idea.id ? '⏳' : '🔄'}
                                </button>
                              </>
                            ) : (
                              <button className="btn btn-sm btn-success" onClick={() => generateAssets(idea.id)} disabled={generating === idea.id}>
                                {generating === idea.id ? '⏳' : '⚡'} Generate
                              </button>
                            )}
                            <button className="btn btn-sm btn-danger" onClick={() => deleteIdea(idea.id)} title="Hapus Ide">✕</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Loading */}
          {generating && (
            <div className="loading-overlay">
              <div className="spinner"></div>
              <div className="loading-text">Generating Storyboard & AI Prompts (Tahap 1 & 2)...</div>
            </div>
          )}

          {/* Output Panel */}
          {activeAsset && (
            <div className="output-panel" ref={outputPanelRef}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.2rem', margin: 0 }}>🎬 Production Assets</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-sm btn-outline-warning" 
                    onClick={() => regeneratePrompts(activeAsset.idea_id, activeAsset.asset_id)}
                    disabled={generating === activeAsset.idea_id}
                    title="Hanya regenerate prompt T2I & I2V (Stage 2.B) tanpa mengubah Storyboard & Voiceover"
                    style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                  >
                    {generating === activeAsset.idea_id ? '⏳' : '🔄 Regenerate Prompts (T2I & I2V)'}
                  </button>
                  <div style={{ background: 'var(--bg-card)', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-light)', display: 'flex', alignItems: 'center' }}>
                    Batch ID: {activeAsset.asset_id?.substring(0, 8) || activeAsset.idea_id?.substring(0, 8)}
                  </div>
                </div>
              </div>

              <div className="tabs">
                <button className={`tab ${tab === 'storyboard' ? 'active' : ''}`} onClick={() => setTab('storyboard')}>📋 Storyboard</button>
                <button className={`tab ${tab === 'voiceover' ? 'active' : ''}`} onClick={() => setTab('voiceover')}>🎙 Voiceover</button>
                <button className={`tab ${tab === 't2i' ? 'active' : ''}`} onClick={() => setTab('t2i')}>🖼 T2I Prompts</button>
                <button className={`tab ${tab === 'i2v' ? 'active' : ''}`} onClick={() => setTab('i2v')}>🎥 I2V Prompts</button>
                <button className={`tab ${tab === 'captions' ? 'active' : ''}`} onClick={() => setTab('captions')}>📝 Captions</button>
              </div>

              {/* Storyboard Tab */}
              {tab === 'storyboard' && (
                <div>
                  {(activeAsset.storyboard || []).map((scene, i) => (
                    <div key={i} className="scene-card">
                      <div className="scene-number">Scene {scene.scene || i + 1} — {scene.duration || ''}</div>
                      <div className="scene-field">
                        <div className="scene-field-label">Narration</div>
                        <div className="scene-field-value">{scene.narration}</div>
                      </div>
                      <div className="scene-field">
                        <div className="scene-field-label">Visual Description</div>
                        <div className="scene-field-value">{scene.visual_description}</div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="scene-field">
                          <div className="scene-field-label">Camera</div>
                          <div className="scene-field-value">{scene.camera_movement}</div>
                        </div>
                        <div className="scene-field">
                          <div className="scene-field-label">Audio Mood</div>
                          <div className="scene-field-value">{scene.audio_mood}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: '12px' }}
                    onClick={() => copyToClipboard(JSON.stringify(activeAsset.storyboard, null, 2), 'Storyboard')}>
                    📋 Copy All Storyboard JSON
                  </button>
                </div>
              )}

              {/* Voiceover Tab */}
              {tab === 'voiceover' && (
                <div>
                  {(activeAsset.storyboard || []).map((scene, i) => (
                    <div key={i} className="prompt-block">
                      <button className="copy-btn" onClick={() => copyToClipboard(scene.narration || '', `Voiceover Scene ${scene.scene || i+1}`)}>Copy</button>
                      <div className="scene-number" style={{ marginBottom: '6px' }}>
                        Scene {scene.scene || i + 1}
                        {scene.duration && <span style={{ marginLeft: '8px', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>({scene.duration})</span>}
                      </div>
                      <div style={{ fontSize: '0.95rem', lineHeight: '1.75', color: 'var(--text-primary)' }}>
                        {scene.narration || '—'}
                      </div>
                    </div>
                  ))}
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: '12px' }}
                    onClick={() => copyToClipboard(
                      (activeAsset.storyboard || []).map((s, i) => `[Scene ${s.scene || i+1}]\n${s.narration || ''}`).join('\n\n'),
                      'Full Voiceover Script'
                    )}>
                    📋 Copy Full Voiceover Script
                  </button>
                </div>
              )}
              {tab === 't2i' && (
                <div>
                  {(activeAsset.t2i_prompts || []).map((p, i) => {
                    const imgKey = `image_${i}`;
                    const imgGen = generatingAssets[imgKey];
                    const imgResult = assetResults[imgKey];
                    return (
                    <div key={i} className="prompt-block">
                      <button className="copy-btn" onClick={() => { copyToClipboard(p.prompt, `T2I Scene ${p.scene || i+1}`); }}>Copy</button>
                      <div className="scene-number" style={{ marginBottom: '8px' }}>Scene {p.scene || i + 1}</div>
                      {p.prompt}
                      {p.negative_prompt && (
                        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                          <div className="scene-field-label">Negative Prompt</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: '2px' }}>{p.negative_prompt}</div>
                        </div>
                      )}
                      {p.parameters && (
                        <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {Object.entries(p.parameters).map(([k, v]) => (
                            <span key={k} style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', background: 'var(--bg-glass)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-muted)' }}>{k}: {v}</span>
                          ))}
                        </div>
                      )}
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button className="btn btn-sm" onClick={() => generateAssetProd(i, 'image', p.prompt)}
                          disabled={!!imgGen}
                          style={{ background: 'linear-gradient(135deg, #e17055, #d63031)', color: '#fff', fontSize: '0.72rem', padding: '4px 10px' }}>
                          {imgGen ? `⏳ ${imgGen}` : '🖼️ Generate Image'}
                        </button>
                        {imgResult?.status === 'done' && imgResult.urls?.map((url, ui) => (
                          <a key={ui} href={url} target="_blank" rel="noopener" style={{ fontSize: '0.7rem', color: 'var(--success)' }}>✓ Image {ui+1}</a>
                        ))}
                        {imgResult?.status === 'failed' && <span style={{ fontSize: '0.7rem', color: 'var(--danger)' }}>❌ {imgResult.error}</span>}
                        {imgResult?.drive?.map((d, di) => (
                          <a key={`di${di}`} href={d.driveUrl} target="_blank" rel="noopener" style={{ fontSize: '0.68rem', color: '#4285f4' }}>📁 Drive</a>
                        ))}
                      </div>
                    </div>
                    );
                  })}
                  <div style={{ marginTop: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary btn-sm"
                      onClick={() => copyToClipboard((activeAsset.t2i_prompts || []).map((p,i) => `--- Scene ${p.scene||i+1} ---\n${p.prompt}`).join('\n\n'), 'All T2I Prompts')}>
                      📋 Copy All T2I Prompts
                    </button>
                    <button className="btn btn-sm" onClick={() => generateAllProd('image', activeAsset.t2i_prompts || [])}
                      style={{ background: 'linear-gradient(135deg, #e17055, #d63031)', color: '#fff' }}>
                      🖼️ Generate All Images
                    </button>
                  </div>
                </div>
              )}

              {/* I2V Prompts Tab */}
              {tab === 'i2v' && (
                <div>
                  {(activeAsset.i2v_prompts || []).map((p, i) => {
                    const vidKey = `video_${i}`;
                    const vidGen = generatingAssets[vidKey];
                    const vidResult = assetResults[vidKey];
                    return (
                    <div key={i} className="prompt-block">
                      <button className="copy-btn" onClick={() => { copyToClipboard(p.prompt, `I2V Scene ${p.scene || i+1}`); }}>Copy</button>
                      <div className="scene-number" style={{ marginBottom: '8px' }}>Scene {p.scene || i + 1}</div>
                      {p.prompt}
                      {(p.motion_type || p.camera_movement || p.duration) && (
                        <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {p.motion_type && <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', background: 'var(--bg-glass)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-muted)' }}>motion: {p.motion_type}</span>}
                          {p.camera_movement && <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', background: 'var(--bg-glass)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-muted)' }}>camera: {p.camera_movement}</span>}
                          {p.duration && <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', background: 'var(--bg-glass)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-muted)' }}>duration: {p.duration}</span>}
                        </div>
                      )}
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button className="btn btn-sm" onClick={() => generateAssetProd(i, 'video', p.prompt)}
                          disabled={!!vidGen}
                          style={{ background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', color: '#fff', fontSize: '0.72rem', padding: '4px 10px' }}>
                          {vidGen ? `⏳ ${vidGen}` : '🎬 Generate Video'}
                        </button>
                        {vidResult?.status === 'done' && vidResult.urls?.map((url, ui) => (
                          <a key={ui} href={url} target="_blank" rel="noopener" style={{ fontSize: '0.7rem', color: 'var(--success)' }}>✓ Video {ui+1}</a>
                        ))}
                        {vidResult?.status === 'failed' && <span style={{ fontSize: '0.7rem', color: 'var(--danger)' }}>❌ {vidResult.error}</span>}
                        {vidResult?.drive?.map((d, di) => (
                          <a key={`dv${di}`} href={d.driveUrl} target="_blank" rel="noopener" style={{ fontSize: '0.68rem', color: '#4285f4' }}>📁 Drive</a>
                        ))}
                      </div>
                    </div>
                    );
                  })}
                  <div style={{ marginTop: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary btn-sm"
                      onClick={() => copyToClipboard((activeAsset.i2v_prompts || []).map((p,i) => `--- Scene ${p.scene||i+1} ---\n${p.prompt}`).join('\n\n'), 'All I2V Prompts')}>
                      📋 Copy All I2V Prompts
                    </button>
                    <button className="btn btn-sm" onClick={() => generateAllProd('video', activeAsset.i2v_prompts || [])}
                      style={{ background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', color: '#fff' }}>
                      🎬 Generate All Videos
                    </button>
                  </div>
                </div>
              )}

              {/* Captions Tab */}
              {tab === 'captions' && (
                <div>
                  {[
                    { label: 'TikTok Caption', value: activeAsset.tiktok_caption, icon: '🎵' },
                    { label: 'Instagram Caption', value: activeAsset.ig_caption, icon: '📸' },
                    { label: 'YouTube Title', value: activeAsset.yt_title, icon: '🎬' },
                    { label: 'YouTube Description', value: activeAsset.yt_desc, icon: '📺' },
                  ].map((cap, i) => (
                    <div key={i} className="caption-block">
                      <button className="copy-btn" onClick={() => copyToClipboard(cap.value, cap.label)}>Copy</button>
                      <div className="caption-label">{cap.icon} {cap.label}</div>
                      <div className="caption-text">{cap.value || '—'}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Export Bar */}
              <div style={{
                marginTop: '24px', padding: '20px',
                background: 'var(--bg-glass)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: '12px',
              }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📤</span> Export Result
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <a
                    href={`/api/export/download?id=${activeAsset.asset_id}&format=xlsx&source=production`}
                    className="btn btn-secondary btn-sm"
                    style={{ textDecoration: 'none' }}
                  >📊 Download .xlsx</a>
                  <a
                    href={`/api/export/download?id=${activeAsset.asset_id}&format=md&source=production`}
                    className="btn btn-secondary btn-sm"
                    style={{ textDecoration: 'none' }}
                  >📄 Download .md</a>
                  {googleConnected ? (
                    <>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => exportToGoogle('sheets')}
                        disabled={!!exporting}
                      >{exporting === 'sheets' ? '⏳' : '📊'} Export to Sheets</button>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => exportToGoogle('docs')}
                        disabled={!!exporting}
                      >{exporting === 'docs' ? '⏳' : '📄'} Export to Docs</button>
                    </>
                  ) : (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                      Google: <a href="/settings" style={{ color: 'var(--accent-light)' }}>Setup</a>
                    </span>
                  )}
                </div>

                {/* Pipeline Sync */}
                {googleConnected && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={syncToPipeline}
                      disabled={!!syncing}
                      style={{ background: 'linear-gradient(135deg, var(--accent), #6c5ce7)' }}
                    >{syncing ? '⏳ Syncing...' : '📌 Sync to Pipeline'}</button>
                    {pipelineUrl && (
                      <a href={pipelineUrl} target="_blank" rel="noopener" style={{ fontSize: '0.72rem', color: 'var(--accent-light)' }}>
                        ✓ Master Pipeline Sheet
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
