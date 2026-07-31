'use client';

import Sidebar from '../components/Sidebar';
import { useEffect, useState } from 'react';

const PACING_LEVELS = ['Level 1: Standard / Storytelling', 'Level 2: Fast / Promo', 'Level 3: Hyper-Affiliate'];
const AUTEUR_STYLES = ['Hyper-Realist UGC', 'Cinematic Drama', 'Motion Graphic', 'Mixed Media', 'Macro Product'];
const FACE_OPTIONS = ['Faceless', 'POV', 'Talent On-Screen', 'Silhouette'];
const TARGET_AIS = ['Google Veo (8s)', 'Kling AI (5s)', 'Runway Gen-3 (10s)', 'Sora (Max 60s)', 'Minimax'];
const ASPECT_RATIOS = ['9:16', '16:9', '1:1', '4:5'];

export default function PipelinePage() {
  const [step, setStep] = useState(1);
  const [inputMode, setInputMode] = useState('manual');
  const [inputName, setInputName] = useState('');
  const [inputSource, setInputSource] = useState('');
  const [productData, setProductData] = useState(null);
  const [productId, setProductId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  // Step 2
  const [jumlahIde, setJumlahIde] = useState(3);
  const [ideas, setIdeas] = useState([]);
  const [hotTrend, setHotTrend] = useState('');
  const [pipelineId, setPipelineId] = useState(null);
  const [selectedIdea, setSelectedIdea] = useState(null);

  // Step 3 config
  const [config, setConfig] = useState({
    pacing_level: 'Level 2: Fast / Promo',
    jumlah_klip: 5,
    auteur_style: 'Hyper-Realist UGC',
    face_visibility: 'Faceless',
    target_ai: 'Google Veo (8s)',
    aspect_ratio: '9:16',
    prompt_output_format: 'plain_text',
  });

  // Step 3-5 output
  const [pipelineResult, setPipelineResult] = useState(null);
  const [activeTab, setActiveTab] = useState('audio');

  // History
  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]);

  useEffect(() => { fetchHistory(); }, []);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function fetchHistory() {
    try {
      const [pRes, hRes] = await Promise.all([
        fetch('/api/product-agent'),
        fetch('/api/pipeline-v54/history'),
      ]);
      const pData = await pRes.json();
      if (pData.success) setProducts(pData.data || []);
      
      const hData = await hRes.json();
      if (hData.success) setHistory(hData.data || []);
    } catch (e) {
      console.error(e);
    }
  }

  // =========== STEP 1: Product Agent ===========
  async function handleExtractProduct() {
    if (!inputSource.trim() && inputMode === 'url') { setError('URL wajib diisi'); return; }
    if (!inputSource.trim() && inputMode === 'manual') { setError('Deskripsi wajib diisi'); return; }
    
    let finalSource = inputSource;
    if (inputMode === 'manual' && inputName.trim()) {
      finalSource = `Nama Produk: ${inputName}\nDeskripsi: ${inputSource}`;
    }

    setError('');
    setLoading(true);
    setLoadingText('🔍 Mengekstrak data produk...');
    try {
      const res = await fetch('/api/product-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input_source: finalSource, is_url: inputMode === 'url' }),
      });
      const data = await res.json();
      if (data.success) {
        setProductData(data.data);
        setProductId(data.data.id);
        setStep(2);
        showToast('Product data berhasil diekstrak!');
      } else {
        setError(data.error);
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
    setLoadingText('');
  }

  // =========== STEP 2: Ideation ===========
  async function handleGenerateIdeas() {
    setError('');
    setLoading(true);
    setLoadingText('✦ Generating ideas + detecting hot trends...');
    try {
      const res = await fetch('/api/pipeline-v54', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          action: 'ideation',
          config: { jumlah_ide: jumlahIde },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIdeas(data.data.strategic_ideas || []);
        setHotTrend(data.data.hot_trend_detected || '');
        setPipelineId(data.data.id);
        fetchHistory(); // Refresh history
        showToast(`${(data.data.strategic_ideas || []).length} ide berhasil di-generate!`);
      } else {
        setError(data.error);
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
    setLoadingText('');
  }

  function handleSelectIdea(idea) {
    setSelectedIdea(idea);
    setStep(3);
  }

  // =========== STEP 3-5: Run Pipeline ===========
  async function handleRunPipeline() {
    if (!selectedIdea || !pipelineId) return;
    setError('');
    setLoading(true);
    setLoadingText('🎙 Stage 3: Narration Agent...');
    try {
      const res = await fetch('/api/pipeline-v54', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          action: 'run_pipeline',
          pipeline_id: pipelineId,
          selected_idea: selectedIdea,
          config,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPipelineResult(data.data);
        setStep(4);
        fetchHistory();
        showToast('Pipeline berhasil! Semua stage selesai.');
      } else {
        setError(data.error);
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
    setLoadingText('');
  }

  // =========== Regenerate Actions ===========
  async function handleRegenerate(stage) {
    if (!pipelineId) return;
    setLoading(true);
    setLoadingText(`🔄 Regenerating ${stage}...`);
    try {
      const res = await fetch('/api/pipeline-v54', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          action: 'regenerate',
          pipeline_id: pipelineId,
          stage,
          config,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPipelineResult(prev => ({
          ...prev,
          ...data.data
        }));
        showToast(`Regenerate ${stage} berhasil!`);
      } else {
        showToast(`Error: ${data.error}`, 'error');
      }
    } catch (e) { showToast(e.message, 'error'); }
    setLoading(false);
    setLoadingText('');
  }

  // =========== View History Asset ===========
  async function viewHistoryItem(id) {
    setLoading(true);
    try {
      const res = await fetch(`/api/pipeline-v54/${id}`);
      const data = await res.json();
      if (data.success) {
        const asset = data.data;
        setPipelineId(asset.id);
        setProductId(asset.product_id);
        setProductData({
          product_name: asset.product_name,
          product_description: asset.product_description,
          unique_selling_point: asset.unique_selling_point,
          target_audience: asset.target_audience,
          pain_point_solved: asset.pain_point_solved,
        });
        
        if (asset.status === 'completed') {
          setPipelineResult(asset);
          setStep(4);
        } else if (asset.status === 'idea_ready') {
          setIdeas(asset.all_ideas || []);
          setHotTrend(asset.hot_trend_detected || '');
          setStep(2);
        } else {
          setIdeas(asset.all_ideas || []);
          setHotTrend(asset.hot_trend_detected || '');
          if (asset.selected_idea) {
            setSelectedIdea(asset.selected_idea);
            setStep(3);
          } else {
            setStep(2);
          }
        }
      }
    } catch (e) { showToast(e.message, 'error'); }
    setLoading(false);
  }

  async function deleteHistoryItem(id) {
    if (!confirm('Hapus pipeline ini?')) return;
    await fetch(`/api/pipeline-v54/${id}`, { method: 'DELETE' });
    fetchHistory();
    if (pipelineId === id) {
      setStep(1);
      setPipelineResult(null);
    }
  }

  function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied!`);
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-container" style={{ maxWidth: '800px' }}>
          <div className="page-header">
            <h2>🧠 Pipeline v54.9</h2>
            <p>5-Stage AI Content Pipeline — Product → Ideation → Narration → Visual → Prompts</p>
          </div>

          {/* Progress Bar */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '24px' }}>
            {['Product', 'Ideation', 'Config', 'Output'].map((label, i) => (
              <div key={i} style={{
                flex: 1, padding: '8px', textAlign: 'center', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600,
                background: step > i ? 'var(--accent)' : step === i + 1 ? 'var(--accent-glow)' : 'var(--bg-glass)',
                color: step > i ? '#fff' : step === i + 1 ? 'var(--accent-light)' : 'var(--text-muted)',
                border: `1px solid ${step === i + 1 ? 'var(--accent)' : 'var(--border)'}`,
                transition: 'all 0.3s ease',
              }}>
                {i + 1}. {label}
              </div>
            ))}
          </div>

          {error && <div style={{ color: 'var(--danger)', fontSize: '0.88rem', marginBottom: '16px', padding: '12px', background: 'var(--danger-glow)', borderRadius: 'var(--radius-sm)' }}>⚠ {error}</div>}

          {/* ============ STEP 1: Product Agent ============ */}
          {step === 1 && (
            <div className="card">
              <div className="card-title"><span className="icon">🏷</span> Stage 1 — Product Agent</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
                Ekstrak data produk secara otomatis dari URL landing page atau input manual.
              </p>

              <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: 'var(--bg-glass)', padding: '4px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <button onClick={() => setInputMode('manual')} style={{ flex: 1, padding: '8px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'var(--font-sans)', background: inputMode === 'manual' ? 'var(--accent)' : 'none', color: inputMode === 'manual' ? '#fff' : 'var(--text-secondary)' }}>📝 Input Manual</button>
                <button onClick={() => setInputMode('url')} style={{ flex: 1, padding: '8px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'var(--font-sans)', background: inputMode === 'url' ? 'var(--accent)' : 'none', color: inputMode === 'url' ? '#fff' : 'var(--text-secondary)' }}>🔗 Scrape URL</button>
              </div>

              {inputMode === 'url' ? (
                <div className="form-group">
                  <label className="form-label">URL Landing Page Produk</label>
                  <input className="form-input" placeholder="https://example.com/product-page" value={inputSource} onChange={e => setInputSource(e.target.value)} />
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>URL halaman penjualan produk (Tokopedia, Shopee, website, dll)</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Nama Produk (Opsional)</label>
                    <input className="form-input" placeholder="Contoh: Sepatu Lari Ortuseight X..." value={inputName} onChange={e => setInputName(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Deskripsi Produk</label>
                    <textarea className="form-textarea" rows={5} placeholder="Jelaskan produk secara detail: fungsi, keunggulan, target market..." value={inputSource} onChange={e => setInputSource(e.target.value)} />
                  </div>
                </div>
              )}

              <button className="btn btn-primary btn-lg btn-block" onClick={handleExtractProduct} disabled={loading}>
                {loading ? '⏳ Extracting...' : '🔍 Extract Product Data'}
              </button>

              {/* Quick-select from history */}
              {products.length > 0 && (
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>📜 Produk Sebelumnya</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {products.slice(0, 5).map(p => (
                      <button key={p.id} className="btn btn-sm btn-secondary" style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                        onClick={() => { setProductId(p.id); setProductData(p); setStep(2); }}>
                        🏷 {p.product_name} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '8px' }}>{p.is_url ? 'URL' : 'Manual'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============ STEP 2: Ideation ============ */}
          {step === 2 && productData && (
            <>
              {/* Product Summary */}
              <div className="card" style={{ marginBottom: '16px' }}>
                <div className="card-title"><span className="icon">✅</span> Product Data</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>PRODUCT</div><div style={{ fontSize: '0.88rem' }}>{productData.product_name}</div></div>
                  <div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>USP</div><div style={{ fontSize: '0.88rem' }}>{productData.unique_selling_point}</div></div>
                  <div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>TARGET</div><div style={{ fontSize: '0.88rem' }}>{productData.target_audience}</div></div>
                  <div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>PAIN POINT</div><div style={{ fontSize: '0.88rem' }}>{productData.pain_point_solved}</div></div>
                </div>
                <button className="btn btn-sm btn-secondary" style={{ marginTop: '12px' }} onClick={() => setStep(1)}>← Ganti Produk</button>
              </div>

              <div className="card">
                <div className="card-title"><span className="icon">✦</span> Stage 2 — Ideation (Auto Hot Trend)</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>AI akan otomatis mencari hot trend terkini dan generate ide konten strategis.</p>
                <div className="form-group">
                  <label className="form-label">Jumlah Ide</label>
                  <input className="form-input" type="number" min={1} max={10} value={jumlahIde} onChange={e => setJumlahIde(parseInt(e.target.value) || 3)} />
                </div>
                <button className="btn btn-primary btn-lg btn-block" onClick={handleGenerateIdeas} disabled={loading}>
                  {loading ? '⏳ Generating...' : '✦ Generate Ideas'}
                </button>
              </div>

              {/* Ideas Output */}
              {ideas.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  {hotTrend && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'linear-gradient(135deg, rgba(108,92,231,0.15), rgba(162,155,254,0.1))', border: '1px solid rgba(108,92,231,0.3)', borderRadius: '20px', marginBottom: '16px', fontSize: '0.82rem' }}>
                      🔥 <strong>Hot Trend Detected:</strong> <span style={{ color: 'var(--accent-light)' }}>{hotTrend}</span>
                    </div>
                  )}
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>Pilih 1 Ide untuk Pipeline:</h3>
                  {ideas.map((idea, i) => (
                    <div key={i} className="card" style={{ marginBottom: '10px', cursor: 'pointer', border: selectedIdea === idea ? '2px solid var(--accent)' : '1px solid var(--border)' }} onClick={() => handleSelectIdea(idea)}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <span style={{ background: 'var(--accent-glow)', color: 'var(--accent-light)', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>{idea.id_ide || i + 1}</span>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ fontSize: '0.95rem', marginBottom: '6px' }}>{idea.topik}</h4>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>📌 {idea.narrative_mode} — {idea.cavac_angle}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>⚡ Hook: {idea.hook_strategy}</div>
                        </div>
                        <button className="btn btn-sm btn-primary" onClick={e => { e.stopPropagation(); handleSelectIdea(idea); }}>Pilih →</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ============ STEP 3: Config & Run ============ */}
          {step === 3 && selectedIdea && (
            <>
              <div className="card" style={{ marginBottom: '16px', background: 'var(--accent-glow)', border: '1px solid var(--accent)' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>📌 Ide Terpilih: <span style={{ color: 'var(--accent-light)' }}>{selectedIdea.topik}</span></div>
                <button className="btn btn-sm btn-secondary" style={{ marginTop: '8px' }} onClick={() => setStep(2)}>← Ganti Ide</button>
              </div>

              <div className="card">
                <div className="card-title"><span className="icon">⚙</span> Pipeline Config (Stage 3→5)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group"><label className="form-label">Pacing Level</label><select className="form-select" value={config.pacing_level} onChange={e => setConfig(p => ({ ...p, pacing_level: e.target.value }))}>{PACING_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
                  <div className="form-group"><label className="form-label">Jumlah Klip</label><input className="form-input" type="number" min={3} max={15} value={config.jumlah_klip} onChange={e => setConfig(p => ({ ...p, jumlah_klip: parseInt(e.target.value) || 5 }))} /></div>
                  <div className="form-group"><label className="form-label">Auteur Style</label><select className="form-select" value={config.auteur_style} onChange={e => setConfig(p => ({ ...p, auteur_style: e.target.value }))}>{AUTEUR_STYLES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                  <div className="form-group"><label className="form-label">Face Visibility</label><select className="form-select" value={config.face_visibility} onChange={e => setConfig(p => ({ ...p, face_visibility: e.target.value }))}>{FACE_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}</select></div>
                  <div className="form-group"><label className="form-label">Target AI Engine</label><select className="form-select" value={config.target_ai} onChange={e => setConfig(p => ({ ...p, target_ai: e.target.value }))}>{TARGET_AIS.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
                  <div className="form-group"><label className="form-label">Aspect Ratio</label><select className="form-select" value={config.aspect_ratio} onChange={e => setConfig(p => ({ ...p, aspect_ratio: e.target.value }))}>{ASPECT_RATIOS.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                </div>
                <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: '20px', background: 'linear-gradient(135deg, var(--accent), #6c5ce7)' }} onClick={handleRunPipeline} disabled={loading}>
                  {loading ? '⏳ Running Pipeline...' : '⚡ Run Full Pipeline (Stage 3→5)'}
                </button>
              </div>
            </>
          )}

          {/* Loading Overlay */}
          {loading && loadingText && (
            <div className="loading-overlay" style={{ marginTop: '24px' }}>
              <div className="spinner"></div>
              <div className="loading-text">{loadingText}</div>
            </div>
          )}

          {/* ============ STEP 4: Output ============ */}
          {step === 4 && pipelineResult && (
            <div className="output-panel">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.2rem', margin: 0 }}>🎬 Pipeline v54.9 Output</h3>
                <button className="btn btn-sm btn-secondary" onClick={() => { setStep(1); setPipelineResult(null); setIdeas([]); setSelectedIdea(null); setProductData(null); }}>🔄 New Pipeline</button>
              </div>

              <div className="tabs">
                <button className={`tab ${activeTab === 'audio' ? 'active' : ''}`} onClick={() => setActiveTab('audio')}>🎙 Audio</button>
                <button className={`tab ${activeTab === 'visual' ? 'active' : ''}`} onClick={() => setActiveTab('visual')}>🎬 Visual</button>
                <button className={`tab ${activeTab === 't2i' ? 'active' : ''}`} onClick={() => setActiveTab('t2i')}>🖼 T2I</button>
                <button className={`tab ${activeTab === 'i2v' ? 'active' : ''}`} onClick={() => setActiveTab('i2v')}>🎥 I2V</button>
                <button className={`tab ${activeTab === 't2v' ? 'active' : ''}`} onClick={() => setActiveTab('t2v')}>📹 T2V</button>
                <button className={`tab ${activeTab === 'captions' ? 'active' : ''}`} onClick={() => setActiveTab('captions')}>📝 Captions</button>
              </div>

              {/* Audio Blueprint */}
              {activeTab === 'audio' && pipelineResult.audio_blueprint && (
                <div>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    {pipelineResult.audio_blueprint.voice_id_selected && <span style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'rgba(108,92,231,0.15)', borderRadius: '12px', color: 'var(--accent-light)' }}>🎤 {pipelineResult.audio_blueprint.voice_id_selected}</span>}
                    {pipelineResult.audio_blueprint.global_mood && <span style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'rgba(0,184,148,0.12)', borderRadius: '12px', color: 'var(--success)' }}>🎭 {pipelineResult.audio_blueprint.global_mood}</span>}
                    <div style={{ flex: 1, textAlign: 'right' }}>
                       <button className="btn btn-sm" style={{ background: 'var(--accent-glow)', color: 'var(--accent-light)', border: '1px solid var(--accent)' }} onClick={() => handleRegenerate('narration')} disabled={loading}>🔄 Regenerate Voiceover</button>
                    </div>
                  </div>
                  {(pipelineResult.audio_blueprint.script_clips || []).map((clip, i) => (
                    <div key={i} className="prompt-block">
                      <button className="copy-btn" onClick={() => copyToClipboard(clip.dialogue_line, `Clip ${clip.clip}`)}>Copy</button>
                      <div className="scene-number">Clip {clip.clip || i + 1} — {clip.time_segment} <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>({clip.word_count} words)</span></div>
                      <div style={{ fontSize: '0.92rem', lineHeight: 1.7, marginTop: '6px' }}>{clip.dialogue_line}</div>
                      {clip.sfx_direction && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>🔊 SFX: {clip.sfx_direction}</div>}
                    </div>
                  ))}
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: '12px' }} onClick={() => copyToClipboard(JSON.stringify(pipelineResult.audio_blueprint, null, 2), 'Audio Blueprint')}>📋 Copy All</button>
                </div>
              )}

              {/* Visual Storyboard */}
              {activeTab === 'visual' && pipelineResult.visual_storyboard && (
                <div>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    {pipelineResult.visual_storyboard.global_camera_locked && <span style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'var(--bg-glass)', borderRadius: '12px', color: 'var(--text-secondary)' }}>📷 {pipelineResult.visual_storyboard.global_camera_locked}</span>}
                    {pipelineResult.visual_storyboard.global_lighting && <span style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'var(--bg-glass)', borderRadius: '12px', color: 'var(--text-secondary)' }}>💡 {pipelineResult.visual_storyboard.global_lighting}</span>}
                  </div>
                  {(pipelineResult.visual_storyboard.clips || []).map((clip, i) => (
                    <div key={i} className="scene-card">
                      <div className="scene-number">Clip {clip.clip || i + 1}</div>
                      <div className="scene-field"><div className="scene-field-label">Location</div><div className="scene-field-value">{clip.location}</div></div>
                      <div className="scene-field"><div className="scene-field-label">Visual Action</div><div className="scene-field-value">{clip.visual_action}</div></div>
                      <div className="scene-field"><div className="scene-field-label">Camera</div><div className="scene-field-value">{clip.camera_movement}</div></div>
                    </div>
                  ))}
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: '12px' }} onClick={() => copyToClipboard(JSON.stringify(pipelineResult.visual_storyboard, null, 2), 'Visual Storyboard')}>📋 Copy All</button>
                </div>
              )}

              {/* T2I / I2V / T2V Prompts */}
              {['t2i', 'i2v', 't2v'].includes(activeTab) && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                    <button className="btn btn-sm" style={{ background: 'var(--accent-glow)', color: 'var(--accent-light)', border: '1px solid var(--accent)' }} onClick={() => handleRegenerate('prompts')} disabled={loading}>🔄 Regenerate Prompts (T2I/I2V/T2V)</button>
                  </div>
                  {(pipelineResult[`${activeTab}_prompts`] || []).map((p, i) => (
                    <div key={i} className="prompt-block">
                      <button className="copy-btn" onClick={() => copyToClipboard(p.prompt, `${activeTab.toUpperCase()} Clip ${p.clip || p.scenes_covered || i + 1}`)}>Copy</button>
                      <div className="scene-number" style={{ marginBottom: '8px' }}>
                        Clip {p.clip || i + 1}
                        {p.duration && <span style={{ marginLeft: '8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>({p.duration})</span>}
                      </div>
                      <div style={{ fontSize: '0.85rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {typeof p.prompt === 'string' ? p.prompt : JSON.stringify(p.prompt, null, 2)}
                      </div>
                    </div>
                  ))}
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: '12px' }} onClick={() => copyToClipboard(
                    (pipelineResult[`${activeTab}_prompts`] || []).map((p, i) => `--- Clip ${p.clip || i + 1} ---\n${p.prompt}`).join('\n\n'),
                    `All ${activeTab.toUpperCase()} Prompts`
                  )}>📋 Copy All {activeTab.toUpperCase()} Prompts</button>
                </div>
              )}

              {/* Captions */}
              {activeTab === 'captions' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                    <button className="btn btn-sm" style={{ background: 'var(--accent-glow)', color: 'var(--accent-light)', border: '1px solid var(--accent)' }} onClick={() => handleRegenerate('prompts')} disabled={loading}>🔄 Regenerate Captions</button>
                  </div>
                  {[
                    { label: 'TikTok Caption', value: pipelineResult.tiktok_caption, icon: '🎵' },
                    { label: 'Instagram Caption', value: pipelineResult.ig_caption, icon: '📸' },
                    { label: 'YouTube Title', value: pipelineResult.yt_title, icon: '🎬' },
                    { label: 'YouTube Description', value: pipelineResult.yt_desc, icon: '📺' },
                  ].map((cap, i) => (
                    <div key={i} className="caption-block">
                      <button className="copy-btn" onClick={() => copyToClipboard(cap.value, cap.label)}>Copy</button>
                      <div className="caption-label">{cap.icon} {cap.label}</div>
                      <div className="caption-text">{cap.value || '—'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Pipeline History Table */}
          {history.length > 0 && step === 1 && (
            <div className="card" style={{ marginTop: '32px' }}>
              <div className="card-title"><span className="icon">📜</span> Pipeline History</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="ideas-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Stage</th>
                      <th>Hot Trend</th>
                      <th>Date</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(item => (
                      <tr key={item.id}>
                        <td style={{ fontSize: '0.85rem', fontWeight: 500 }}>{item.product_name || 'Unknown'}</td>
                        <td>
                          <span style={{
                            fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px',
                            background: item.status === 'completed' ? 'rgba(0,184,148,0.12)' : 'rgba(253,203,110,0.12)',
                            color: item.status === 'completed' ? 'var(--success)' : 'var(--warning)',
                          }}>
                            {item.status === 'completed' ? 'DONE' : item.current_stage?.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.hot_trend_detected || '—'}
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {new Date(item.created_at).toLocaleDateString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button className="btn btn-sm btn-secondary" onClick={() => viewHistoryItem(item.id)}>👁 View</button>
                            <button className="btn btn-sm btn-danger" onClick={() => deleteHistoryItem(item.id)}>✕</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </main>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
