'use client';

import Sidebar from '../components/Sidebar';
import { useEffect, useState } from 'react';

const NARRATIVE_MODES = ['Psikodrama', 'Realist Viral', 'Storytelling', 'Educational', 'Testimonial', 'Behind The Scene'];
const VISUAL_STYLES = ['UGC', 'Cinematic', 'Motion Graphic', 'Mixed Media', 'Stop Motion', 'Flat Design'];
const TARGET_AIS = ['Kling', 'Veo', 'Sora', 'Runway', 'Pika', 'Minimax'];
const FACE_OPTIONS = ['Faceless', 'POV', 'Talent On-Screen', 'Silhouette'];
const ASPECT_RATIOS = ['9:16 Vertical', '16:9 Landscape', '1:1 Square', '4:5 Portrait'];
const WORDS_PER_CLIP = ['15-16 Words', '17-19 Words', '20-26 Words'];
const OUTPUT_FORMATS = [
  { value: 'plain_text', label: 'Plain Text — Copy-paste langsung ke AI tool' },
  { value: 'json', label: 'Structured JSON — Dengan parameter tambahan' },
];

export default function IdeationPage() {
  const [kbCount, setKbCount] = useState(0);
  const [form, setForm] = useState({
    product_name: '',
    product_description: '',
    target_audience: '',
    jumlah_ide: 3,
    jumlah_klip: 5,
    narrative_mode: 'Psikodrama',
    visual_style: 'UGC',
    words_per_clip: '15-16 Words',
    target_ai: 'Veo',
    face_visibility: 'Faceless',
    aspect_ratio: '9:16 Vertical',
    instruksi_tambahan: '',
    prompt_output_format: 'plain_text',
  });
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [exporting, setExporting] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [pipelineUrl, setPipelineUrl] = useState('');

  useEffect(() => {
    fetchKBCount();
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

  async function fetchGoogleStatus() {
    try {
      const res = await fetch('/api/google/status');
      const data = await res.json();
      if (data.success) setGoogleConnected(data.data.connected);
    } catch (e) { console.error(e); }
  }

  async function fetchPipelineInfo() {
    try {
      const res = await fetch('/api/export/pipeline');
      const data = await res.json();
      if (data.success && data.data.url) setPipelineUrl(data.data.url);
    } catch (e) { console.error(e); }
  }

  async function exportIdeationToGoogle(type) {
    if (!results?.length) return;
    setExporting(type);
    try {
      // For ideation, we create a new Sheets/Docs with ideation data
      // Reuse the existing sheets/docs endpoints with ideation-specific data
      const res = await fetch(`/api/export/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: results[0].id, source: 'ideation' }),
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

  async function syncIdeationToPipeline() {
    if (!results?.length) return;
    setSyncing(true);
    try {
      let successCount = 0;
      for (const idea of results) {
        const res = await fetch('/api/export/pipeline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: idea.id, stage: 'ideation' }),
        });
        const data = await res.json();
        if (data.success) {
          successCount++;
          if (data.data.url) setPipelineUrl(data.data.url);
        }
      }
      showToast(`${successCount} ide berhasil di-sync ke Pipeline Sheet!`);
    } catch (e) { showToast(e.message, 'error'); }
    setSyncing(false);
  }

  function updateForm(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleGenerate() {
    setError('');
    if (!form.product_name.trim()) { setError('Nama Produk wajib diisi'); return; }
    if (kbCount === 0) { setError('Belum ada Knowledge Base. Upload di Settings terlebih dahulu.'); return; }

    setGenerating(true);
    setResults(null);
    try {
      const res = await fetch('/api/ideation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setResults(data.data);
        showToast(`${data.count} ide berhasil di-generate!`);
      } else {
        setError(data.error || 'Gagal generate ide');
      }
    } catch (e) { setError(e.message); }
    setGenerating(false);
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-container" style={{ maxWidth: '760px' }}>
          <div className="page-header">
            <h2>✦ Stage 1 — Content Ideation</h2>
            <p>Generate ide konten video strategis berbasis Knowledge Base</p>
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
                <strong>{kbCount} Knowledge Base</strong> aktif — semua akan digunakan saat generate
              </span>
            ) : (
              <span style={{ color: 'var(--danger)' }}>
                Belum ada Knowledge Base. <a href="/settings" style={{ color: 'var(--accent-light)', textDecoration: 'underline' }}>Upload di Settings</a>
              </span>
            )}
          </div>

          {/* Data Produk */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-title"><span className="icon">🏷</span> Data Produk</div>
            <div className="form-group">
              <label className="form-label">Nama Produk *</label>
              <input className="form-input" placeholder="e.g. Golden Face Cream" value={form.product_name} onChange={e => updateForm('product_name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Deskripsi / USP Produk</label>
              <textarea className="form-textarea" placeholder="Jelaskan keunggulan dan USP produk..." value={form.product_description} onChange={e => updateForm('product_description', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Target Audience</label>
              <textarea className="form-textarea" placeholder="Jelaskan secara spesifik siapa target audiensnya (contoh: Gen-Z, Pekerja Kantoran, Ibu Rumah Tangga)..." value={form.target_audience} onChange={e => updateForm('target_audience', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Jumlah Ide</label>
              <input className="form-input" type="number" min="1" max="10" value={form.jumlah_ide} onChange={e => updateForm('jumlah_ide', parseInt(e.target.value) || 1)} />
            </div>
            <div className="form-group">
              <label className="form-label">Jumlah Klip / Ide</label>
              <input className="form-input" type="number" min="1" max="20" value={form.jumlah_klip} onChange={e => updateForm('jumlah_klip', parseInt(e.target.value) || 5)} />
            </div>
          </div>

          {/* Konfigurasi Konten */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-title"><span className="icon">🎛</span> Konfigurasi Konten</div>
            <div className="form-group">
              <label className="form-label">Narrative Mode</label>
              <select className="form-select" value={form.narrative_mode} onChange={e => updateForm('narrative_mode', e.target.value)}>
                {NARRATIVE_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Visual Style</label>
              <select className="form-select" value={form.visual_style} onChange={e => updateForm('visual_style', e.target.value)}>
                {VISUAL_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Words per Clip (Target Jumlah Kata)</label>
              <select className="form-select" value={form.words_per_clip} onChange={e => updateForm('words_per_clip', e.target.value)}>
                {WORDS_PER_CLIP.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Target AI Engine</label>
              <select className="form-select" value={form.target_ai} onChange={e => updateForm('target_ai', e.target.value)}>
                {TARGET_AIS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Face Visibility</label>
              <select className="form-select" value={form.face_visibility} onChange={e => updateForm('face_visibility', e.target.value)}>
                {FACE_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Aspect Ratio</label>
              <select className="form-select" value={form.aspect_ratio} onChange={e => updateForm('aspect_ratio', e.target.value)}>
                {ASPECT_RATIOS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Instruksi Tambahan</label>
              <textarea className="form-textarea" placeholder="Instruksi khusus (opsional)..." value={form.instruksi_tambahan} onChange={e => updateForm('instruksi_tambahan', e.target.value)} />
            </div>
          </div>

          {/* Output Format Config */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-title"><span className="icon">📤</span> Output Prompt Format (Stage 2)</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '14px', lineHeight: 1.6 }}>
              Pilih format output untuk T2I (Text-to-Image) dan I2V (Image-to-Video) prompts yang akan dihasilkan di Stage 2.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {OUTPUT_FORMATS.map(fmt => (
                <label key={fmt.value} className={`checkbox-item ${form.prompt_output_format === fmt.value ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="prompt_output_format"
                    value={fmt.value}
                    checked={form.prompt_output_format === fmt.value}
                    onChange={e => updateForm('prompt_output_format', e.target.value)}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>{fmt.label}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && <div style={{ color: 'var(--danger)', fontSize: '0.88rem', marginBottom: '16px', padding: '12px', background: 'var(--danger-glow)', borderRadius: 'var(--radius-sm)' }}>⚠ {error}</div>}

          {/* Generate Button */}
          <button className="btn btn-primary btn-lg btn-block" onClick={handleGenerate} disabled={generating || kbCount === 0}>
            {generating ? '⏳ Generating Ideas...' : '✦ Generate Ideas'}
          </button>

          {/* Loading */}
          {generating && (
            <div className="loading-overlay" style={{ marginTop: '32px' }}>
              <div className="spinner"></div>
              <div className="loading-text">Gemini sedang menganalisis {kbCount} Knowledge Base...</div>
            </div>
          )}

          {/* Results */}
          {results && results.length > 0 && (
            <div style={{ marginTop: '32px' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>✅ {results.length} Ide Berhasil Di-generate</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {results.map((idea, i) => (
                  <div key={idea.id} className="card">
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                      <span style={{ background: 'var(--accent-glow)', color: 'var(--accent-light)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: '700', flexShrink: 0 }}>{i + 1}</span>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: '1rem', marginBottom: '8px' }}>{idea.topik}</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>CEP Context</div>
                            <div style={{ fontSize: '0.85rem', marginTop: '2px', lineHeight: '1.5' }}>{idea.konteks_cep}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>VFO</div>
                            <div style={{ fontSize: '0.85rem', marginTop: '2px', lineHeight: '1.5' }}>{idea.vfo}</div>
                          </div>
                        </div>
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Key Messages</div>
                          <div style={{ fontSize: '0.85rem', marginTop: '2px', lineHeight: '1.5' }}>{idea.key_messages}</div>
                        </div>
                        <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <span className="status-badge status-draft">Draft</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>• {idea.narrative_mode} • {idea.visual_style} • {idea.target_ai}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Export Bar */}
              <div style={{
                marginTop: '24px', padding: '20px',
                background: 'var(--bg-glass)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: '12px',
              }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📤</span> Export Ideation
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <a
                    href={`/api/export/ideation-download?ids=${results.map(r => r.id).join(',')}&format=xlsx&product=${encodeURIComponent(form.product_name)}`}
                    className="btn btn-secondary btn-sm"
                    style={{ textDecoration: 'none' }}
                  >📊 Download .xlsx</a>
                  <a
                    href={`/api/export/ideation-download?ids=${results.map(r => r.id).join(',')}&format=md&product=${encodeURIComponent(form.product_name)}`}
                    className="btn btn-secondary btn-sm"
                    style={{ textDecoration: 'none' }}
                  >📄 Download .md</a>
                  {googleConnected ? (
                    <>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => exportIdeationToGoogle('sheets')}
                        disabled={!!exporting}
                      >{exporting === 'sheets' ? '⏳' : '📊'} Export to Sheets</button>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => exportIdeationToGoogle('docs')}
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
                      onClick={syncIdeationToPipeline}
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
