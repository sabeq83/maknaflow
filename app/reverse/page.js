'use client';

import Sidebar from '../components/Sidebar';
import { useEffect, useState, useRef } from 'react';

const OUTPUT_FORMATS = [
  { value: 'plain_text', label: 'Plain Text — Copy-paste langsung ke AI tool' },
  { value: 'json', label: 'Structured JSON — Dengan parameter tambahan' },
];

export default function ReversePage() {
  const [kbCount, setKbCount] = useState(0);
  const [inputMode, setInputMode] = useState('upload'); // 'upload' | 'url'
  const [videoUrl, setVideoUrl] = useState('');
  const [customInstruction, setCustomInstruction] = useState('');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [targetAi, setTargetAi] = useState('Google Veo (8s)');
  const [promptOutputFormat, setPromptOutputFormat] = useState('plain_text');
  const [selectedFile, setSelectedFile] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [activeResult, setActiveResult] = useState(null);
  const [tab, setTab] = useState('storyboard');
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [exporting, setExporting] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [pipelineUrl, setPipelineUrl] = useState('');
  const [generatingAssets, setGeneratingAssets] = useState({});
  const [assetResults, setAssetResults] = useState({});
  const fileRef = useRef(null);

  useEffect(() => {
    fetchKBCount();
    fetchHistory();
    fetchGoogleStatus();
    fetchPipelineInfo();
  }, []);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function fetchKBCount() {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (data.success) setKbCount(data.data.kbCount);
    } catch (e) { console.error(e); }
  }

  async function fetchHistory() {
    try {
      const res = await fetch('/api/reverse/results');
      const data = await res.json();
      if (data.success) setHistory(data.data);
    } catch (e) { console.error(e); }
  }

  async function fetchGoogleStatus() {
    try {
      const res = await fetch('/api/google/status');
      const data = await res.json();
      if (data.success) setGoogleConnected(data.data.connected);
    } catch (e) { console.error(e); }
  }

  async function exportToGoogle(type) {
    if (!activeResult?.id) return;
    setExporting(type);
    try {
      const res = await fetch(`/api/export/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeResult.id, source: 'reverse' }),
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
      const res = await fetch('/api/export/re-pipeline');
      const data = await res.json();
      if (data.success && data.data.url) setPipelineUrl(data.data.url);
    } catch (e) { console.error(e); }
  }

  async function syncToPipeline() {
    if (!activeResult?.id) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/export/re-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeResult.id }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.data.url) setPipelineUrl(data.data.url);
        window.open(data.data.url, '_blank');
        showToast(`${data.data.scenesCount} scenes synced ke RE Sheet! (${data.data.batchId})`);
      } else {
        showToast(data.error || 'Sync gagal', 'error');
      }
    } catch (e) { showToast(e.message, 'error'); }
    setSyncing(false);
  }

  async function generateAsset(sceneIndex, type, prompt) {
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
      const taskId = data.data.task_id;
      setGeneratingAssets(prev => ({ ...prev, [key]: 'polling' }));
      pollTask(key, taskId, type);
    } catch (e) {
      showToast(`${type} gen failed: ${e.message}`, 'error');
      setGeneratingAssets(prev => ({ ...prev, [key]: null }));
    }
  }

  async function pollTask(key, taskId, type) {
    const maxAttempts = 90; // 15 min max (10s intervals)
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 10000));
      try {
        const res = await fetch(`/api/webhook/status?task_id=${taskId}`);
        const data = await res.json();
        if (data.success && data.data.status === 'completed') {
          const urls = data.data.results || [];
          setGeneratingAssets(prev => ({ ...prev, [key]: 'uploading to Drive...' }));

          // Auto-upload to Drive
          const driveUrls = [];
          const sceneNum = parseInt(key.split('_')[1]) + 1;
          const batchId = activeResult?.id?.substring(0, 8) || 'RE-batch';
          for (const fileUrl of urls) {
            try {
              const ext = fileUrl.split('.').pop()?.split('?')[0] || (type === 'image' ? 'png' : 'mp4');
              const mime = type === 'image' ? `image/${ext}` : `video/${ext === 'mp4' ? 'mp4' : 'webm'}`;
              const driveRes = await fetch('/api/drive/upload-asset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  file_url: fileUrl,
                  batch_id: `RE-${batchId}`,
                  filename: `${type}_scene_${String(sceneNum).padStart(2, '0')}.${ext}`,
                  mime_type: mime,
                }),
              });
              const driveData = await driveRes.json();
              if (driveData.success) driveUrls.push(driveData.data);
            } catch (e) { console.error('Drive upload failed:', e); }
          }

          setAssetResults(prev => ({
            ...prev,
            [key]: { status: 'done', urls, taskId, drive: driveUrls },
          }));
          setGeneratingAssets(prev => ({ ...prev, [key]: null }));
          showToast(`${type === 'image' ? '🖼️' : '🎬'} Scene ${sceneNum} ${type} done${driveUrls.length ? ' + uploaded to Drive!' : '!'}`);
          return;
        }
        if (data.success && data.data.status === 'failed') {
          setAssetResults(prev => ({ ...prev, [key]: { status: 'failed', error: data.data.error_detail || 'Unknown error' } }));
          setGeneratingAssets(prev => ({ ...prev, [key]: null }));
          showToast(`${type} failed: ${data.data.error_detail || 'Unknown'}`, 'error');
          return;
        }
        setGeneratingAssets(prev => ({ ...prev, [key]: `polling (${i + 1})` }));
      } catch { /* retry */ }
    }
    setGeneratingAssets(prev => ({ ...prev, [key]: null }));
    showToast(`${type} timeout after 15 min`, 'error');
  }

  async function generateAllAssets(type) {
    const prompts = activeResult?.t2v_prompts || [];
    for (let i = 0; i < prompts.length; i++) {
      generateAsset(i, type, prompts[i].prompt);
      await new Promise(r => setTimeout(r, 2000)); // Stagger 2s between submissions
    }
  }

  function handleFileDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('video/')) setSelectedFile(file);
    else showToast('File harus berupa video (.mp4, .mov, .webm)', 'error');
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  }

  async function handleGenerate() {
    setError('');
    if (kbCount === 0) { setError('Belum ada Knowledge Base. Upload di Settings.'); return; }

    if (inputMode === 'upload' && !selectedFile) { setError('Pilih file video terlebih dahulu'); return; }
    if (inputMode === 'url' && !videoUrl.trim()) { setError('URL video wajib diisi'); return; }

    setGenerating(true);
    setActiveResult(null);
    setTab('storyboard');

    try {
      let res;
      if (inputMode === 'upload') {
        setProgressText('Mengupload video...');
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('custom_instruction', customInstruction);
        formData.append('aspect_ratio', aspectRatio);
        formData.append('target_ai', targetAi);
        formData.append('prompt_output_format', promptOutputFormat);
        res = await fetch('/api/reverse', { method: 'POST', body: formData });
      } else {
        setProgressText('Mendownload video dari URL...');
        res = await fetch('/api/reverse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            video_url: videoUrl,
            custom_instruction: customInstruction,
            aspect_ratio: aspectRatio,
            target_ai: targetAi,
            prompt_output_format: promptOutputFormat,
          }),
        });
      }

      setProgressText('Menganalisis video dengan Gemini AI...');
      const data = await res.json();

      if (data.success) {
        setActiveResult(data.data);
        showToast('Reverse engineering berhasil!');
        fetchHistory();
      } else {
        setError(data.error || 'Gagal');
      }
    } catch (e) { setError(e.message); }

    setGenerating(false);
    setProgressText('');
  }

  async function viewResult(id) {
    try {
      const res = await fetch(`/api/reverse/results?id=${id}`);
      const data = await res.json();
      if (data.success) {
        setActiveResult(data.data);
        setTab('storyboard');
      }
    } catch (e) { showToast(e.message, 'error'); }
  }

  async function deleteResult(id) {
    if (!confirm('Hapus hasil ini?')) return;
    await fetch('/api/reverse/results', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    fetchHistory();
    if (activeResult?.id === id) setActiveResult(null);
    showToast('Hasil dihapus');
  }

  function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied!`);
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-container" style={{ maxWidth: '760px' }}>
          <div className="page-header">
            <h2>🔍 Reverse Engineering</h2>
            <p>Analisis video dan reverse-engineer menjadi production assets</p>
          </div>

          {/* KB Info Bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '12px 18px', marginBottom: '24px',
            background: kbCount > 0 ? 'var(--success-glow)' : 'var(--danger-glow)',
            border: `1px solid ${kbCount > 0 ? 'rgba(0,184,148,0.3)' : 'rgba(225,112,85,0.3)'}`,
            borderRadius: 'var(--radius-sm)', fontSize: '0.85rem',
          }}>
            <span style={{ fontSize: '1.1rem' }}>{kbCount > 0 ? '📚' : '⚠️'}</span>
            {kbCount > 0 ? (
              <span style={{ color: 'var(--success)' }}>
                <strong>{kbCount} Knowledge Base</strong> aktif — semua akan digunakan saat analisis
              </span>
            ) : (
              <span style={{ color: 'var(--danger)' }}>
                Belum ada Knowledge Base. <a href="/settings" style={{ color: 'var(--accent-light)', textDecoration: 'underline' }}>Upload di Settings</a>
              </span>
            )}
          </div>

          {/* Input Mode Toggle */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-title"><span className="icon">📥</span> Input Video</div>

            <div style={{
              display: 'flex', gap: '4px', marginBottom: '20px',
              background: 'var(--bg-glass)', padding: '4px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
            }}>
              <button
                onClick={() => setInputMode('upload')}
                style={{
                  flex: 1, padding: '10px', textAlign: 'center', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600,
                  cursor: 'pointer', border: 'none', fontFamily: 'var(--font-sans)', transition: 'all var(--transition)',
                  background: inputMode === 'upload' ? 'var(--accent)' : 'none',
                  color: inputMode === 'upload' ? 'white' : 'var(--text-secondary)',
                }}
              >📁 Upload File</button>
              <button
                onClick={() => setInputMode('url')}
                style={{
                  flex: 1, padding: '10px', textAlign: 'center', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600,
                  cursor: 'pointer', border: 'none', fontFamily: 'var(--font-sans)', transition: 'all var(--transition)',
                  background: inputMode === 'url' ? 'var(--accent)' : 'none',
                  color: inputMode === 'url' ? 'white' : 'var(--text-secondary)',
                }}
              >🔗 Input URL</button>
            </div>

            {inputMode === 'upload' ? (
              <div>
                <div
                  className={`upload-area ${dragOver ? 'dragover' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileRef.current?.click()}
                >
                  <div className="upload-icon">{selectedFile ? '✅' : '🎬'}</div>
                  {selectedFile ? (
                    <div>
                      <p style={{ color: 'var(--success)', fontWeight: 600 }}>{selectedFile.name}</p>
                      <p className="upload-hint">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB — klik untuk ganti file</p>
                    </div>
                  ) : (
                    <div>
                      <p>Drag & drop video atau klik untuk pilih</p>
                      <p className="upload-hint">.mp4, .mov, .webm — max 200MB</p>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="video/*" onChange={handleFileSelect} style={{ display: 'none' }} />
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">URL Video</label>
                <input
                  className="form-input"
                  placeholder="Paste URL dari TikTok, Facebook, YouTube, Google Drive..."
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Mendukung: TikTok, Facebook, YouTube, Google Drive, Instagram — memerlukan yt-dlp
                </div>
              </div>
            )}
          </div>

          {/* Custom Instruction */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-title"><span className="icon">📝</span> Custom Instruction</div>
            <div className="form-group">
              <textarea
                className="form-textarea"
                placeholder="Instruksi tambahan untuk analisis (opsional)... Contoh: Fokus pada hook 3 detik pertama, analisis angle storytelling, dll."
                value={customInstruction}
                onChange={e => setCustomInstruction(e.target.value)}
              />
            </div>
          </div>

          {/* Aspect Ratio */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-title"><span className="icon">📐</span> Aspect Ratio (T2V)</div>
            <div className="form-group">
              <select 
                className="form-input" 
                value={aspectRatio}
                onChange={e => setAspectRatio(e.target.value)}
              >
                <option value="9:16">Vertical (9:16)</option>
                <option value="16:9">Landscape (16:9)</option>
                <option value="1:1">Square (1:1)</option>
                <option value="4:5">Portrait (4:5)</option>
              </select>
            </div>
          </div>

          {/* Target AI Engine */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-title"><span className="icon">🤖</span> Target AI Engine (Micro-pacing)</div>
            <div className="form-group">
              <select 
                className="form-input" 
                value={targetAi}
                onChange={e => setTargetAi(e.target.value)}
              >
                <option value="Google Veo (8s)">Google Veo (8s)</option>
                <option value="Runway Gen-3 (10s)">Runway Gen-3 (10s)</option>
                <option value="Kling AI (5s)">Kling AI (5s)</option>
                <option value="Luma Dream Machine (5s)">Luma Dream Machine (5s)</option>
                <option value="Sora (Max 60s)">Sora (Max 60s)</option>
              </select>
            </div>
          </div>

          {/* Output Format */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-title"><span className="icon">📤</span> Output Prompt Format (T2V)</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '14px', lineHeight: 1.6 }}>
              Pilih format output untuk Text-to-Video prompts yang dihasilkan.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {OUTPUT_FORMATS.map(fmt => (
                <label key={fmt.value} className={`checkbox-item ${promptOutputFormat === fmt.value ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="prompt_output_format"
                    value={fmt.value}
                    checked={promptOutputFormat === fmt.value}
                    onChange={e => setPromptOutputFormat(e.target.value)}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>{fmt.label}</div>
                </label>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && <div style={{ color: 'var(--danger)', fontSize: '0.88rem', marginBottom: '16px', padding: '12px', background: 'var(--danger-glow)', borderRadius: 'var(--radius-sm)' }}>⚠ {error}</div>}

          {/* Generate Button */}
          <button className="btn btn-primary btn-lg btn-block" onClick={handleGenerate} disabled={generating || kbCount === 0}>
            {generating ? '⏳ Processing...' : '🔍 Reverse Engineer Video'}
          </button>

          {/* Loading */}
          {generating && (
            <div className="loading-overlay" style={{ marginTop: '32px' }}>
              <div className="spinner"></div>
              <div className="loading-text">{progressText || 'Processing...'}</div>
            </div>
          )}

          {/* Output Panel */}
          {activeResult && (
            <div className="output-panel" style={{ marginTop: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <h3 style={{ fontSize: '1.2rem', margin: 0 }}>🎬 Reverse Engineering Result</h3>
                <div style={{ background: 'var(--bg-card)', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-light)' }}>
                  Batch ID: {activeResult.id?.substring(0, 8)}
                </div>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '16px' }}>
                {activeResult.video_filename} {activeResult.source_url && `• ${activeResult.source_url.substring(0, 50)}...`}
              </p>

              <div className="tabs">
                <button className={`tab ${tab === 'storyboard' ? 'active' : ''}`} onClick={() => setTab('storyboard')}>📋 Storyboard</button>
                <button className={`tab ${tab === 'voiceover' ? 'active' : ''}`} onClick={() => setTab('voiceover')}>🎙 Voiceover</button>
                <button className={`tab ${tab === 't2v' ? 'active' : ''}`} onClick={() => setTab('t2v')}>🎬 T2V Prompts</button>
                <button className={`tab ${tab === 'captions' ? 'active' : ''}`} onClick={() => setTab('captions')}>📝 Captions</button>
              </div>

              {/* Storyboard */}
              {tab === 'storyboard' && (
                <div>
                  {(activeResult.storyboard || []).map((scene, i) => (
                    <div key={i} className="scene-card">
                      <div className="scene-number">Scene {scene.scene || i + 1} — {scene.duration || ''}</div>
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
                    onClick={() => copyToClipboard(JSON.stringify(activeResult.storyboard, null, 2), 'Storyboard')}>
                    📋 Copy Storyboard JSON
                  </button>
                </div>
              )}

              {/* Voiceover */}
              {tab === 'voiceover' && (
                <div>
                  {(activeResult.voiceover || []).map((vo, i) => (
                    <div key={i} className="prompt-block">
                      <button className="copy-btn" onClick={() => copyToClipboard(vo.narration || '', `VO Scene ${vo.scene || i+1}`)}>Copy</button>
                      <div className="scene-number" style={{ marginBottom: '6px' }}>
                        Scene {vo.scene || i + 1}
                        {vo.duration && <span style={{ marginLeft: '8px', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>({vo.duration})</span>}
                      </div>
                      <div style={{ fontSize: '0.95rem', lineHeight: '1.75', color: 'var(--text-primary)' }}>
                        {vo.narration || '—'}
                      </div>
                    </div>
                  ))}
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: '12px' }}
                    onClick={() => copyToClipboard(
                      (activeResult.voiceover || []).map((v, i) => `[Scene ${v.scene || i+1}]\n${v.narration || ''}`).join('\n\n'),
                      'Full Voiceover Script'
                    )}>
                    📋 Copy Full Voiceover Script
                  </button>
                </div>
              )}

              {/* T2V Prompts */}
              {tab === 't2v' && (
                <div>
                  {(activeResult.t2v_prompts || []).map((p, i) => {
                    const imgKey = `image_${i}`;
                    const vidKey = `video_${i}`;
                    const imgGen = generatingAssets[imgKey];
                    const vidGen = generatingAssets[vidKey];
                    const imgResult = assetResults[imgKey];
                    const vidResult = assetResults[vidKey];
                    return (
                    <div key={i} className="prompt-block">
                      <button className="copy-btn" onClick={() => copyToClipboard(p.prompt, `T2V Scene ${p.scene || i+1}`)}>Copy</button>
                      <div className="scene-number" style={{ marginBottom: '8px' }}>Scene {p.scene || i + 1}</div>
                      {p.prompt}
                      {(p.motion_type || p.camera_movement || p.style || p.duration) && (
                        <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {p.motion_type && <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', background: 'var(--bg-glass)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-muted)' }}>motion: {p.motion_type}</span>}
                          {p.camera_movement && <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', background: 'var(--bg-glass)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-muted)' }}>camera: {p.camera_movement}</span>}
                          {p.style && <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', background: 'var(--bg-glass)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-muted)' }}>style: {p.style}</span>}
                          {p.duration && <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', background: 'var(--bg-glass)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-muted)' }}>duration: {p.duration}</span>}
                        </div>
                      )}
                      {p.negative_prompt && (
                        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                          <div className="scene-field-label">Negative Prompt</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: '2px' }}>{p.negative_prompt}</div>
                        </div>
                      )}

                      {/* Generate Buttons per Scene */}
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button className="btn btn-sm" onClick={() => generateAsset(i, 'image', p.prompt)}
                          disabled={!!imgGen}
                          style={{ background: 'linear-gradient(135deg, #e17055, #d63031)', color: '#fff', fontSize: '0.72rem', padding: '4px 10px' }}>
                          {imgGen ? `⏳ ${imgGen}` : '🖼️ Image'}
                        </button>
                        <button className="btn btn-sm" onClick={() => generateAsset(i, 'video', p.prompt)}
                          disabled={!!vidGen}
                          style={{ background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', color: '#fff', fontSize: '0.72rem', padding: '4px 10px' }}>
                          {vidGen ? `⏳ ${vidGen}` : '🎬 Video'}
                        </button>
                        {imgResult?.status === 'done' && imgResult.urls?.map((url, ui) => (
                          <a key={ui} href={url} target="_blank" rel="noopener" style={{ fontSize: '0.7rem', color: 'var(--success)' }}>✓ Image {ui+1}</a>
                        ))}
                        {vidResult?.status === 'done' && vidResult.urls?.map((url, ui) => (
                          <a key={ui} href={url} target="_blank" rel="noopener" style={{ fontSize: '0.7rem', color: 'var(--success)' }}>✓ Video {ui+1}</a>
                        ))}
                        {imgResult?.status === 'failed' && <span style={{ fontSize: '0.7rem', color: 'var(--danger)' }}>❌ Image: {imgResult.error}</span>}
                        {vidResult?.status === 'failed' && <span style={{ fontSize: '0.7rem', color: 'var(--danger)' }}>❌ Video: {vidResult.error}</span>}
                        {imgResult?.drive?.map((d, di) => (
                          <a key={`di${di}`} href={d.driveUrl} target="_blank" rel="noopener" style={{ fontSize: '0.68rem', color: '#4285f4' }}>📁 Drive Image</a>
                        ))}
                        {vidResult?.drive?.map((d, di) => (
                          <a key={`dv${di}`} href={d.driveUrl} target="_blank" rel="noopener" style={{ fontSize: '0.68rem', color: '#4285f4' }}>📁 Drive Video</a>
                        ))}
                      </div>
                    </div>
                    );
                  })}

                  {/* Batch Actions */}
                  <div style={{ marginTop: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary btn-sm" style={{ marginTop: '0' }}
                      onClick={() => copyToClipboard(
                        (activeResult.t2v_prompts || []).map((p, i) => `--- Scene ${p.scene||i+1} ---\n${p.prompt}`).join('\n\n'),
                        'All T2V Prompts'
                      )}>
                      📋 Copy All T2V Prompts
                    </button>
                    <button className="btn btn-sm" onClick={() => generateAllAssets('image')}
                      style={{ background: 'linear-gradient(135deg, #e17055, #d63031)', color: '#fff' }}>
                      🖼️ Generate All Images
                    </button>
                    <button className="btn btn-sm" onClick={() => generateAllAssets('video')}
                      style={{ background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', color: '#fff' }}>
                      🎬 Generate All Videos
                    </button>
                  </div>
                </div>
              )}

              {/* Captions */}
              {tab === 'captions' && (
                <div>
                  {[
                    { label: 'TikTok Caption', value: activeResult.tiktok_caption, icon: '🎵' },
                    { label: 'Instagram Caption', value: activeResult.ig_caption, icon: '📸' },
                    { label: 'YouTube Title (High CTR)', value: activeResult.yt_title, icon: '🎬' },
                    { label: 'YouTube Description', value: activeResult.yt_desc, icon: '📺' },
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
                    href={`/api/export/download?id=${activeResult.id}&format=xlsx&source=reverse`}
                    className="btn btn-secondary btn-sm"
                    style={{ textDecoration: 'none' }}
                  >📊 Download .xlsx</a>
                  <a
                    href={`/api/export/download?id=${activeResult.id}&format=md&source=reverse`}
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
                      Google Workspace: <a href="/settings" style={{ color: 'var(--accent-light)' }}>Setup di Settings</a>
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
                    >{syncing ? '⏳ Syncing...' : '📌 Sync to RE Sheet'}</button>
                    {pipelineUrl && (
                      <a href={pipelineUrl} target="_blank" rel="noopener" style={{ fontSize: '0.72rem', color: 'var(--accent-light)' }}>
                        ✓ Master RE Sheet
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="card" style={{ marginTop: '32px' }}>
              <div className="card-title"><span className="icon">📜</span> Riwayat Reverse Engineering</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="ideas-table">
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Filename</th>
                      <th>Format</th>
                      <th>Tanggal</th>
                      <th style={{ textAlign: 'right' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(item => (
                      <tr key={item.id}>
                        <td>
                          <span style={{
                            fontSize: '0.72rem', fontFamily: 'var(--font-mono)', padding: '3px 8px', borderRadius: '4px',
                            background: item.source_type === 'upload' ? 'rgba(0,184,148,0.12)' : 'rgba(116,185,255,0.12)',
                            color: item.source_type === 'upload' ? 'var(--success)' : 'var(--info)',
                          }}>{item.source_type === 'upload' ? 'UPLOAD' : 'URL'}</span>
                        </td>
                        <td style={{ fontSize: '0.85rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.video_filename || '—'}
                        </td>
                        <td>
                          <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: item.prompt_output_format === 'plain_text' ? 'var(--info)' : 'var(--warning)', background: item.prompt_output_format === 'plain_text' ? 'rgba(116,185,255,0.12)' : 'rgba(253,203,110,0.12)', padding: '3px 8px', borderRadius: '4px' }}>
                            {item.prompt_output_format === 'plain_text' ? 'TXT' : 'JSON'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {new Date(item.tanggal_dibuat).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button className="btn btn-sm btn-secondary" onClick={() => viewResult(item.id)}>👁 View</button>
                            <button className="btn btn-sm btn-danger" onClick={() => deleteResult(item.id)}>✕</button>
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
