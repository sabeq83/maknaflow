'use client';

import Sidebar from '../components/Sidebar';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

export default function DeconstructPage() {
  // Batch listing
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(true);

  // Active batch detail
  const [activeBatch, setActiveBatch] = useState(null);
  const [batchAssets, setBatchAssets] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [batchName, setBatchName] = useState('');
  const [inputMode, setInputMode] = useState('manual');
  const [urlsText, setUrlsText] = useState('');
  const [captionsText, setCaptionsText] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [recommCount, setRecommCount] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [csvDebug, setCsvDebug] = useState(null); // { headers, urlCol, captionCol, delimiter }

  function handleCsvUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (evt) => {
      // Strip BOM character that Excel/Google Sheets may add
      let text = evt.target.result.replace(/^\uFEFF/, '');
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { showToast('CSV harus punya header + minimal 1 baris data', 'error'); return; }

      // Auto-detect delimiter: count commas vs semicolons in header line
      const headerLine = lines[0];
      const commaCount = (headerLine.match(/,/g) || []).length;
      const semicolonCount = (headerLine.match(/;/g) || []).length;
      const delimiter = semicolonCount > commaCount ? ';' : ',';

      // Parse header with detected delimiter
      const headerRaw = parseCSVLine(headerLine, delimiter);
      const header = headerRaw.map(h => h.toLowerCase().trim().replace(/"/g, '').replace(/\s+/g, '_'));

      // Flexible header matching
      const urlIdx = header.findIndex(h =>
        h === 'url' || h === 'video_url' || h === 'link' ||
        (h.includes('url') && !h.includes('caption')) ||
        (h.includes('link') && !h.includes('caption'))
      );
      const captionIdx = header.findIndex(h =>
        h === 'caption' || h === 'caption_ori' || h === 'original_caption' ||
        h.includes('caption')
      );

      if (urlIdx === -1) {
        showToast(`Kolom URL tidak ditemukan. Header terdeteksi: [${headerRaw.join(' | ')}] (delimiter: "${delimiter}")`, 'error');
        return;
      }

      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i], delimiter);
        const url = (cols[urlIdx] || '').trim();
        if (!url) continue;
        rows.push({ url, caption: captionIdx !== -1 && captionIdx !== urlIdx ? (cols[captionIdx] || '').trim() : '' });
      }

      setCsvData(rows);
      setCsvDebug({
        headers: headerRaw,
        urlCol: headerRaw[urlIdx] || '—',
        captionCol: captionIdx !== -1 ? headerRaw[captionIdx] : '(tidak ada)',
        delimiter,
      });
      showToast(`${rows.length} video berhasil diparse (delimiter: "${delimiter}")`);
    };
    reader.readAsText(file);
  }

  function parseCSVLine(line, delimiter = ',') {
    const result = []; let current = ''; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === delimiter && !inQuotes) { result.push(current); current = ''; continue; }
      current += ch;
    }
    result.push(current);
    return result;
  }


  // UI
  const [toast, setToast] = useState(null);
  const [activeAssetId, setActiveAssetId] = useState(null);
  const [copiedQuery, setCopiedQuery] = useState(null);
  const pollingRef = useRef(null);
  const csvRef = useRef(null);

  // Tags Editor State
  const [editingAssetId, setEditingAssetId] = useState(null);
  const [tagsInput, setTagsInput] = useState('');
  const [savingTags, setSavingTags] = useState(false);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  // ---- Data Fetching ----
  async function fetchBatches(silent = false) {
    if (!silent) setLoadingBatches(true);
    try {
      const res = await fetch('/api/v2/deconstruct');
      const data = await res.json();
      if (data.success) setBatches(data.batches || []);
    } catch { if (!silent) showToast('Gagal memuat daftar batch', 'error'); }
    finally { if (!silent) setLoadingBatches(false); }
  }

  async function fetchBatchDetails(batchId, silent = false) {
    if (!silent) {
      setLoadingDetails(true);
      setActiveAssetId(null);
    }
    try {
      const res = await fetch(`/api/v2/deconstruct/${batchId}`);
      const data = await res.json();
      if (data.success) {
        setActiveBatch(data.batch);
        setBatchAssets(data.assets || []);
      }
    } catch { if (!silent) showToast('Gagal memuat detail batch', 'error'); }
    finally { if (!silent) setLoadingDetails(false); }
  }

  async function handleSaveTags(assetId) {
    if (savingTags) return;
    setSavingTags(true);
    try {
      const res = await fetch(`/api/v2/deconstruct/assets/${assetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: tagsInput }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Tag aset berhasil disimpan');
        setBatchAssets(prev => prev.map(a => a.id === assetId ? { ...a, tags: tagsInput } : a));
        setEditingAssetId(null);
      } else {
        showToast(data.error || 'Gagal menyimpan tag', 'error');
      }
    } catch (error) {
      console.error('[Save Tags Error]', error);
      showToast('Gagal menyimpan tag', 'error');
    } finally {
      setSavingTags(false);
    }
  }

  useEffect(() => {
    fetchBatches();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  // Poll if active batch is processing
  useEffect(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    if (activeBatch && activeBatch.status === 'processing') {
      pollingRef.current = setInterval(() => {
        fetchBatchDetails(activeBatch.id, true);
        fetchBatches(true);
      }, 4000);
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [activeBatch?.status, activeBatch?.id]);

  // ---- Submit Batch ----
  async function handleSubmit(e) {
    e.preventDefault();
    if (!batchName.trim()) { showToast('Nama batch wajib diisi', 'error'); return; }
    const body = { batch_name: batchName, target_recommendation_count: Number(recommCount) };
    if (inputMode === 'csv') {
      if (csvData.length === 0) { showToast('Upload CSV dengan data yang valid', 'error'); return; }
      body.csv_data = csvData;
    } else {
      if (!urlsText.trim()) { showToast('Masukkan setidaknya satu URL', 'error'); return; }
      body.urls = urlsText;
      body.captions = captionsText;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/v2/deconstruct', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Batch "${batchName}" berhasil! ${data.queued_count} video masuk antrean.`);
        setBatchName(''); setUrlsText(''); setCaptionsText(''); setCsvFile(null); setCsvData([]);
        setShowForm(false);
        fetchBatches();
        fetchBatchDetails(data.batch_id);
      } else { showToast(data.error || 'Gagal membuat batch', 'error'); }
    } catch { showToast('Gagal mengirim request', 'error'); }
    finally { setSubmitting(false); }
  }

  // ---- Actions ----
  async function handleDelete(batchId) {
    if (!confirm('Hapus batch ini beserta semua hasilnya?')) return;
    try {
      await fetch(`/api/v2/deconstruct/${batchId}`, { method: 'DELETE' });
      showToast('Batch dihapus');
      if (activeBatch?.id === batchId) { setActiveBatch(null); setBatchAssets([]); setActiveAssetId(null); }
      fetchBatches();
    } catch { showToast('Gagal menghapus batch', 'error'); }
  }

  function toggleAsset(assetId) {
    setActiveAssetId(prev => prev === assetId ? null : assetId);
  }

  // ---- Status Helpers ----
  function getStatusColor(s) {
    if (s === 'completed' || s === 'deconstructed') return 'var(--success)';
    if (['processing','downloading','uploading','analyzing'].includes(s)) return 'var(--info)';
    if (s === 'failed') return 'var(--danger)';
    return 'var(--text-muted)';
  }
  function getStatusBg(s) {
    if (s === 'completed' || s === 'deconstructed') return 'var(--success-glow)';
    if (['processing','downloading','uploading','analyzing'].includes(s)) return 'rgba(116,185,255,0.15)';
    if (s === 'failed') return 'var(--danger-glow)';
    return 'rgba(255,255,255,0.06)';
  }
  function getStatusLabel(s) {
    const m = { pending_download:'PENDING', downloading:'DOWNLOADING', uploading:'UPLOADING',
      analyzing:'ANALYZING', deconstructed:'DECONSTRUCTED', failed:'FAILED',
      processing:'PROCESSING', completed:'COMPLETED' };
    return m[s] || s?.toUpperCase() || '—';
  }

  function renderDeconstructPipeline(asset) {
    const getStageStatus = (stage) => {
      const s = asset.status;
      if (s === 'deconstructed') return 'success';
      if (s === 'failed') {
        if (stage === 'scrape') {
          return asset.local_video_path ? 'success' : 'danger';
        }
        if (stage === 'upload') {
          return asset.gemini_file_uri ? 'success' : (asset.local_video_path ? 'danger' : 'pending');
        }
        if (stage === 'analyze') {
          return asset.gemini_file_uri ? 'danger' : 'pending';
        }
      }
      
      if (stage === 'scrape') {
        if (s === 'pending_download') return 'pending';
        if (s === 'downloading') return 'active';
        return 'success';
      }
      if (stage === 'upload') {
        if (['pending_download', 'downloading'].includes(s)) return 'pending';
        if (s === 'uploading') return 'active';
        return 'success';
      }
      if (stage === 'analyze') {
        if (['pending_download', 'downloading', 'uploading'].includes(s)) return 'pending';
        if (s === 'analyzing') return 'active';
        return 'success';
      }
      return 'pending';
    };

    const stages = [
      { label: 'Scrape Video', status: getStageStatus('scrape') },
      { label: 'Upload AI', status: getStageStatus('upload') },
      { label: 'AI Analyze', status: getStageStatus('analyze') }
    ];

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
        {stages.map((stage, sIdx) => {
          let color = 'var(--text-muted)';
          let bg = 'rgba(255, 255, 255, 0.05)';
          let border = '1px solid rgba(255, 255, 255, 0.1)';
          let labelText = stage.label;
          let anim = 'none';

          if (stage.status === 'success') {
            color = '#fff';
            bg = 'rgba(46, 204, 113, 0.15)';
            border = '1px solid rgba(46, 204, 113, 0.5)';
            labelText = `✓ ${stage.label}`;
          } else if (stage.status === 'danger') {
            color = '#fff';
            bg = 'rgba(231, 76, 60, 0.15)';
            border = '1px solid rgba(231, 76, 60, 0.5)';
            labelText = `✗ ${stage.label}`;
          } else if (stage.status === 'active') {
            color = '#fff';
            bg = 'rgba(52, 152, 219, 0.25)';
            border = '1px solid var(--accent-light)';
            labelText = `⏳ ${stage.label}`;
            anim = 'active-pulse 1.5s infinite alternate';
          }

          return (
            <div key={stage.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                padding: '2px 6px',
                borderRadius: 4,
                background: bg,
                color: color,
                fontWeight: 600,
                fontSize: '0.62rem',
                border: border,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                animation: anim,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}>
                {labelText}
              </span>
              {sIdx < stages.length - 1 && <span style={{ color: 'rgba(255, 255, 255, 0.15)', fontSize: '0.75rem', marginLeft: 2 }}>➔</span>}
            </div>
          );
        })}
      </div>
    );
  }

  function renderDeconstructActivity(asset) {
    let text = '';
    let color = 'var(--text-muted)';
    let pulse = false;

    if (asset.status === 'pending_download') {
      text = '⏳ Antre untuk mengunduh video...';
    } else if (asset.status === 'downloading') {
      text = '⬇️ Sedang mengunduh video kompetitor...';
      color = 'var(--accent-light)';
      pulse = true;
    } else if (asset.status === 'uploading') {
      text = '⬆️ Video terunduh. Sedang mengunggah ke Gemini AI...';
      color = 'var(--accent-light)';
      pulse = true;
    } else if (asset.status === 'analyzing') {
      text = '🧠 Video terunggah. Gemini sedang menganalisis pola viral & dekonstruksi storyboard...';
      color = 'var(--accent-light)';
      pulse = true;
    } else if (asset.status === 'deconstructed') {
      text = '✅ Selesai! Pola viral dan ide produk berhasil diekstrak.';
      color = 'var(--success)';
    } else if (asset.status === 'failed') {
      text = `❌ Gagal: ${asset.error_message || 'Terjadi kesalahan sistem'}`;
      color = 'var(--danger)';
    }

    if (!text) return null;

    return (
      <div style={{
        fontSize: '0.68rem',
        color: color,
        marginTop: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        animation: pulse ? 'pulse-glow 2s infinite' : 'none'
      }}>
        {pulse && <span style={{ width: 4, height: 4, borderRadius: '50%', background: color, display: 'inline-block' }} />}
        <span>{text}</span>
      </div>
    );
  }

  // ===========================
  // RENDER
  // ===========================
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto' }}>

          {/* ===== PAGE HEADER ===== */}
          <div className="page-header">
            <div>
              <h1 className="page-title">🔬 Deconstruct Lab</h1>
              <p className="page-subtitle">Penambang Pola Viral — Bedah video kompetitor, temukan celah produk e-commerce</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
              {showForm ? '✕ Tutup Form' : '+ New Batch'}
            </button>
          </div>

          {toast && <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>{toast.msg}</div>}

          {/* ===== CREATION FORM (Collapsible) ===== */}
          {showForm && (
            <div className="card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
              <div style={{
                padding: '16px 24px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ fontWeight: 600, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--accent-light)' }}>✦</span> Konfigurasi Batch Dekonstruksi Baru
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>MAKNA V8.9 Discovery Engine</div>
              </div>

              <form onSubmit={handleSubmit} style={{ padding: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  {/* Left: batch name + mode toggle */}
                  <div>
                    <div className="form-group">
                      <label className="form-label">Nama Batch</label>
                      <input type="text" className="form-input" placeholder="Contoh: Skincare Kompetitor Juni"
                        value={batchName} onChange={e => setBatchName(e.target.value)} required />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Jumlah Rekomendasi per Video</label>
                      <select className="form-input" value={recommCount} onChange={e => setRecommCount(Number(e.target.value))}>
                        {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} Rekomendasi</option>)}
                      </select>
                    </div>

                    {/* Input Mode Toggle */}
                    <div style={{
                      display: 'flex', gap: 4, marginBottom: 16,
                      background: 'var(--bg-glass)', padding: 4, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                    }}>
                      {[{ key: 'manual', icon: '📝', label: 'Manual Input' }, { key: 'csv', icon: '📄', label: 'Upload CSV' }].map(m => (
                        <button key={m.key} type="button" onClick={() => setInputMode(m.key)} style={{
                          flex: 1, padding: 8, textAlign: 'center', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600,
                          cursor: 'pointer', border: 'none', fontFamily: 'var(--font-sans)', transition: 'all var(--transition)',
                          background: inputMode === m.key ? 'var(--accent)' : 'none',
                          color: inputMode === m.key ? 'white' : 'var(--text-secondary)',
                        }}>{m.icon} {m.label}</button>
                      ))}
                    </div>
                  </div>

                  {/* Right: URL/CSV input */}
                  <div>
                    {inputMode === 'manual' ? (
                      <>
                        <div className="form-group">
                          <label className="form-label">URL Video Kompetitor (satu per baris)</label>
                          <textarea className="form-textarea" placeholder={'https://tiktok.com/@user/video/123...\nhttps://youtube.com/watch?v=...'}
                            style={{ minHeight: 90, fontSize: '0.8rem' }}
                            value={urlsText} onChange={e => setUrlsText(e.target.value)} required />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Caption Asli (opsional, satu per baris)</label>
                          <textarea className="form-textarea" placeholder="Caption video pertama..."
                            style={{ minHeight: 50, fontSize: '0.8rem' }}
                            value={captionsText} onChange={e => setCaptionsText(e.target.value)} />
                        </div>
                      </>
                    ) : (
                      <div className="form-group">
                        <label className="form-label">Upload CSV (kolom: url, caption)</label>
                        <div onClick={() => csvRef.current?.click()} style={{
                          padding: '24px 16px', textAlign: 'center', borderRadius: 'var(--radius-sm)',
                          border: '2px dashed var(--border)', cursor: 'pointer',
                          background: csvFile ? 'var(--success-glow)' : 'var(--bg-glass)', transition: 'all 0.2s',
                        }}>
                          {csvFile ? (
                            <div>
                              <div style={{ fontSize: '1.2rem', marginBottom: 4 }}>✅</div>
                              <div style={{ fontSize: '0.82rem', color: 'var(--success)', fontWeight: 600 }}>{csvFile.name}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{csvData.length} video ditemukan</div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontSize: '1.2rem', marginBottom: 4 }}>📄</div>
                              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Klik untuk upload .csv</div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>Header: url, caption</div>
                            </div>
                          )}
                        </div>
                        <input ref={csvRef} type="file" accept=".csv" onChange={handleCsvUpload} style={{ display: 'none' }} />
                        {csvData.length > 0 && (
                          <div style={{ marginTop: 12 }}>
                            {/* Debug info strip */}
                            {csvDebug && (
                              <div style={{ marginBottom: 8, padding: '6px 10px', borderRadius: 'var(--radius-sm)', background: 'rgba(108,92,231,0.08)', border: '1px solid rgba(108,92,231,0.2)', fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                <span>Delimiter: <strong style={{ color: 'var(--accent-light)' }}>"{csvDebug.delimiter}"</strong></span>
                                <span>Kolom URL: <strong style={{ color: 'var(--success)' }}>{csvDebug.urlCol}</strong></span>
                                <span>Kolom Caption: <strong style={{ color: 'var(--info)' }}>{csvDebug.captionCol}</strong></span>
                              </div>
                            )}
                            <div style={{ 
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              marginBottom: 8,
                            }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)' }}>
                                ✓ {csvData.length} video berhasil diparse
                              </span>
                              <button type="button" onClick={() => { setCsvFile(null); setCsvData([]); if (csvRef.current) csvRef.current.value = ''; }}
                                style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>
                                Ganti File
                              </button>
                            </div>
                            <div style={{ maxHeight: 220, overflowY: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 1 }}>
                                  <tr>
                                    <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, width: 36, borderBottom: '1px solid var(--border)' }}>#</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>URL Video</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, width: 160, borderBottom: '1px solid var(--border)' }}>Caption</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {csvData.map((row, i) => (
                                    <tr key={i} style={{ borderBottom: i < csvData.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                                      <td style={{ padding: '5px 8px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{i + 1}</td>
                                      <td style={{ padding: '5px 8px', fontFamily: 'var(--font-mono)', color: 'var(--accent-light)', maxWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                        title={row.url}>{row.url}</td>
                                      <td style={{ padding: '5px 8px', color: 'var(--text-secondary)', maxWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                        title={row.caption}>{row.caption || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}
                    style={{ background: 'linear-gradient(135deg, var(--accent), #6c5ce7)', minWidth: 200 }}>
                    {submitting ? '⏳ Memproses...' : '⚡ Mulai Dekonstruksi'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ===== BATCH LIST (Cards) ===== */}
          {loadingBatches ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Memuat...</div>
          ) : batches.length === 0 && !activeBatch ? (
            <div className="card" style={{ textAlign: 'center', padding: '48px 32px' }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔬</div>
              <h3 style={{ marginBottom: 8 }}>Belum Ada Batch Dekonstruksi</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Klik "+ New Batch" untuk mulai menganalisis video kompetitor dan menemukan celah produk.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {batches.map(b => {
                const isActive = activeBatch?.id === b.id;
                const progressPct = b.total_videos > 0 ? Math.round((b.processed_videos / b.total_videos) * 100) : 0;

                return (
                  <div key={b.id}>
                    {/* Batch Card */}
                    <div className="card" style={{
                      cursor: 'pointer', transition: 'all 0.2s', padding: 0, overflow: 'hidden',
                      border: isActive ? '1px solid var(--accent)' : undefined,
                    }}>
                      {/* Batch Header Row */}
                      <div onClick={() => isActive ? (setActiveBatch(null), setBatchAssets([]), setActiveAssetId(null)) : fetchBatchDetails(b.id)}
                        style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{b.batch_name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                              {new Date(b.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              {' • '}{b.target_recommendation_count} rekomendasi/video
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {/* Progress mini */}
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {b.processed_videos}/{b.total_videos} video
                            </div>
                            {b.status === 'processing' && (
                              <div style={{ width: 120, height: 4, background: 'var(--bg-glass)', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
                                <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg, var(--accent), #6c5ce7)', borderRadius: 2, transition: 'width 0.5s' }} />
                              </div>
                            )}
                          </div>
                          {/* Status Badge */}
                          <span style={{
                            fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
                            color: getStatusColor(b.status), background: getStatusBg(b.status),
                            padding: '4px 12px', borderRadius: 12, letterSpacing: '0.03em',
                          }}>{getStatusLabel(b.status)}</span>
                          {/* Actions */}
                          <button onClick={e => { e.stopPropagation(); handleDelete(b.id); }}
                            className="btn btn-sm" style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '4px 8px', fontSize: '0.75rem' }}
                            title="Hapus">✕</button>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', transform: isActive ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▼</span>
                        </div>
                      </div>

                      {/* ===== EXPANDED: Detail Results (below batch card) ===== */}
                      {isActive && (
                        <div style={{ borderTop: '1px solid var(--border)', padding: '20px 24px', background: 'var(--bg-primary)' }}>

                          {/* Processing Spinner */}
                          {activeBatch.status === 'processing' && (
                            <div style={{ textAlign: 'center', padding: '32px 0 24px' }}>
                              <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: 500, margin: '0 auto' }}>
                                Mengunduh video, mengunggah ke Gemini AI, dan membedah storyboard. Jeda 20 detik antar video.
                              </p>
                            </div>
                          )}

                          {/* Asset Cards */}
                          {batchAssets.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {batchAssets.map((asset, idx) => {
                                const isExpanded = activeAssetId === asset.id;
                                const storyboard = asset.storyboard || [];
                                const ideas = asset.product_ideas || {};
                                const lowTicket = ideas.low_ticket || [];
                                const highTicket = ideas.high_ticket || [];

                                return (
                                  <div key={asset.id} style={{ borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-card)', overflow: 'hidden' }}>
                                    {/* Asset Row Header */}
                                    <div onClick={() => toggleAsset(asset.id)} style={{
                                      padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                      background: isExpanded ? 'var(--bg-glass)' : 'transparent', transition: 'background 0.2s',
                                    }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-light)', fontFamily: 'var(--font-mono)', width: 28, textAlign: 'center' }}>
                                          #{idx + 1}
                                        </span>
                                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, gap: 2 }}>
                                          <a 
                                            href={asset.source_url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            style={{ 
                                              fontSize: '0.82rem', 
                                              fontFamily: 'var(--font-mono)', 
                                              color: 'var(--accent-light)', 
                                              textDecoration: 'none',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '4px',
                                              width: 'fit-content',
                                              maxWidth: '100%',
                                              overflow: 'hidden', 
                                              textOverflow: 'ellipsis', 
                                              whiteSpace: 'nowrap',
                                              borderBottom: '1px dashed rgba(108, 92, 231, 0.4)',
                                              transition: 'color 0.2s, border-bottom-color 0.2s'
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.color = '#a29bfe'; e.currentTarget.style.borderBottomColor = '#a29bfe'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--accent-light)'; e.currentTarget.style.borderBottomColor = 'rgba(108, 92, 231, 0.4)'; }}
                                          >
                                            🔗 {asset.source_url}
                                          </a>
                                          {renderDeconstructPipeline(asset)}
                                          {renderDeconstructActivity(asset)}
                                          {asset.tags && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                              {asset.tags.split(',').map((t, ti) => {
                                                const cleaned = t.trim();
                                                if (!cleaned) return null;
                                                return (
                                                  <span key={ti} style={{
                                                    fontSize: '0.62rem',
                                                    padding: '1px 5px',
                                                    borderRadius: 3,
                                                    background: 'rgba(108, 92, 231, 0.08)',
                                                    color: 'var(--accent-light)',
                                                    border: '1px solid rgba(108, 92, 231, 0.15)'
                                                  }}>
                                                    #{cleaned}
                                                  </span>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                        {['downloading','uploading','analyzing'].includes(asset.status) && (
                                          <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></div>
                                        )}
                                        <span style={{
                                          fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase',
                                          color: getStatusColor(asset.status), background: getStatusBg(asset.status),
                                          padding: '2px 8px', borderRadius: 10,
                                        }}>{getStatusLabel(asset.status)}</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▼</span>
                                      </div>
                                    </div>

                                    {/* Expanded: Deconstructed Results */}
                                    {isExpanded && asset.status === 'deconstructed' && (
                                      <div className="expanded-detail-enter" style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>

                                        {/* Tags Section */}
                                        <div style={{
                                          marginTop: 16,
                                          padding: '10px 14px',
                                          background: 'var(--bg-glass)',
                                          border: '1px solid var(--border)',
                                          borderRadius: 'var(--radius-sm)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          gap: 12,
                                          flexWrap: 'wrap'
                                        }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>🏷️ Tags Konten:</span>
                                            {editingAssetId === asset.id ? (
                                              <input
                                                type="text"
                                                className="form-input"
                                                style={{
                                                  padding: '4px 8px',
                                                  fontSize: '0.78rem',
                                                  height: '30px',
                                                  flex: 1,
                                                  minWidth: '150px',
                                                  margin: 0
                                                }}
                                                placeholder="skincare, tutorial, viral (pisahkan dengan koma)"
                                                value={tagsInput}
                                                onChange={e => setTagsInput(e.target.value)}
                                                autoFocus
                                              />
                                            ) : (
                                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                {asset.tags ? (
                                                  asset.tags.split(',').map((t, ti) => {
                                                    const cleaned = t.trim();
                                                    if (!cleaned) return null;
                                                    return (
                                                      <span key={ti} style={{
                                                        fontSize: '0.68rem',
                                                        fontWeight: 600,
                                                        padding: '2px 8px',
                                                        borderRadius: 4,
                                                        background: 'rgba(108, 92, 231, 0.12)',
                                                        color: 'var(--accent-light)',
                                                        border: '1px solid rgba(108, 92, 231, 0.2)'
                                                      }}>
                                                        #{cleaned}
                                                      </span>
                                                    );
                                                  })
                                                ) : (
                                                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Belum ada tag</span>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                          <div style={{ display: 'flex', gap: 6 }}>
                                            {editingAssetId === asset.id ? (
                                              <>
                                                <button
                                                  onClick={() => handleSaveTags(asset.id)}
                                                  disabled={savingTags}
                                                  className="btn btn-primary"
                                                  style={{ padding: '4px 10px', fontSize: '0.75rem', height: '30px', display: 'flex', alignItems: 'center' }}
                                                >
                                                  {savingTags ? 'Menyimpan...' : 'Simpan'}
                                                </button>
                                                <button
                                                  onClick={() => setEditingAssetId(null)}
                                                  className="btn btn-secondary"
                                                  style={{ padding: '4px 10px', fontSize: '0.75rem', height: '30px', background: 'transparent', border: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}
                                                >
                                                  Batal
                                                </button>
                                              </>
                                            ) : (
                                              <>
                                                <button
                                                  onClick={() => {
                                                    window.location.href = `/recipe-labs?source_deconstruct_id=${asset.id}`;
                                                  }}
                                                  className="btn btn-primary"
                                                  style={{ 
                                                    padding: '4px 10px', 
                                                    fontSize: '0.75rem', 
                                                    height: '30px', 
                                                    display: 'flex', 
                                                    alignItems: 'center',
                                                    background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)',
                                                    color: '#fff',
                                                    fontWeight: 600,
                                                    border: 'none'
                                                  }}
                                                >
                                                  ✨ Generate Recipe
                                                </button>
                                                <button
                                                  onClick={() => {
                                                    setEditingAssetId(asset.id);
                                                    setTagsInput(asset.tags || '');
                                                  }}
                                                  className="btn btn-secondary"
                                                  style={{ padding: '4px 10px', fontSize: '0.75rem', height: '30px', display: 'flex', alignItems: 'center' }}
                                                >
                                                  Edit Tags
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        </div>

                                        {/* Storyboard */}
                                        <div style={{ marginTop: 16 }}>
                                          <h4 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            📋 Storyboard ({storyboard.length} scenes)
                                          </h4>
                                          <div style={{ overflowX: 'auto' }}>
                                            <table className="ideas-table" style={{ fontSize: '0.8rem' }}>
                                              <thead><tr>
                                                <th style={{ width: 55 }}>Scene</th>
                                                <th style={{ width: 85 }}>Time</th>
                                                <th>Visual Description</th>
                                                <th style={{ width: 150 }}>Emotional Hook</th>
                                                <th style={{ width: 120 }}>Camera</th>
                                              </tr></thead>
                                              <tbody>
                                                {storyboard.map((sc, si) => (
                                                  <tr key={si}>
                                                    <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', verticalAlign: 'middle' }}>
                                                      <span style={{ 
                                                        display: 'inline-flex', 
                                                        alignItems: 'center', 
                                                        justifyContent: 'center', 
                                                        width: 22, 
                                                        height: 22, 
                                                        borderRadius: '50%', 
                                                        background: 'rgba(108, 92, 231, 0.15)', 
                                                        color: 'var(--accent-light)',
                                                        fontSize: '0.72rem',
                                                        border: '1px solid rgba(108, 92, 231, 0.3)'
                                                      }}>
                                                        {sc.scene || si+1}
                                                      </span>
                                                    </td>
                                                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', verticalAlign: 'middle' }}>{sc.timestamp}</td>
                                                    <td style={{ lineHeight: 1.5, color: 'var(--text-primary)', fontSize: '0.8rem' }}>{sc.visual_description}</td>
                                                    <td style={{ verticalAlign: 'middle' }}>
                                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                        {sc.emotional_hook ? sc.emotional_hook.split(',').map((hook, hi) => {
                                                          const cleaned = hook.trim();
                                                          if (!cleaned) return null;
                                                          return (
                                                            <span key={hi} style={{ 
                                                              fontSize: '0.65rem', 
                                                              padding: '2px 6px', 
                                                              borderRadius: 4, 
                                                              background: 'rgba(253, 203, 110, 0.12)', 
                                                              color: 'var(--warning)',
                                                              border: '1px solid rgba(253, 203, 110, 0.2)',
                                                              whiteSpace: 'normal',
                                                              display: 'inline-block'
                                                            }}>
                                                              ✨ {cleaned}
                                                            </span>
                                                          );
                                                        }) : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.75rem' }}>—</span>}
                                                      </div>
                                                    </td>
                                                    <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', verticalAlign: 'middle' }}>
                                                      {sc.camera_technique ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                          <span style={{ fontSize: '0.9rem' }}>📹</span>
                                                          <span>{sc.camera_technique}</span>
                                                        </div>
                                                      ) : '—'}
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                          {/* Narrations */}
                                          {storyboard.some(s => s.narration_transcript) && (
                                            <div style={{ 
                                              marginTop: 14, 
                                              padding: '12px 16px', 
                                              background: 'rgba(255, 255, 255, 0.02)', 
                                              borderRadius: 'var(--radius-sm)', 
                                              border: '1px solid var(--border)' 
                                            }}>
                                              <div style={{ 
                                                fontSize: '0.75rem', 
                                                fontWeight: 700, 
                                                color: 'var(--text-muted)', 
                                                marginBottom: 10,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6
                                              }}>
                                                <span>🎙️</span> Narration Audio Transcript
                                              </div>
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                {storyboard.filter(s => s.narration_transcript).map((s, si) => (
                                                  <div key={si} style={{ 
                                                    fontSize: '0.8rem', 
                                                    lineHeight: 1.5,
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    gap: 8,
                                                    paddingBottom: 6,
                                                    borderBottom: si < storyboard.filter(s => s.narration_transcript).length - 1 ? '1px solid rgba(255, 255, 255, 0.03)' : 'none'
                                                  }}>
                                                    <span style={{ 
                                                      fontFamily: 'var(--font-mono)', 
                                                      fontSize: '0.7rem', 
                                                      color: 'var(--accent-light)', 
                                                      fontWeight: 600,
                                                      background: 'rgba(108, 92, 231, 0.1)',
                                                      padding: '1px 5px',
                                                      borderRadius: 3,
                                                      flexShrink: 0
                                                    }}>
                                                      Scene {s.scene||si+1}
                                                    </span>
                                                    <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                                      "{s.narration_transcript}"
                                                    </span>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>

                                        {/* Product Ideas */}
                                        <div style={{ marginTop: 20 }}>
                                          <h4 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            💡 Product Ideas
                                          </h4>
                                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                            {/* Low Ticket */}
                                            <div>
                                              <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--success)', marginBottom: 8, letterSpacing: '0.06em' }}>💚 Low Ticket</div>
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {lowTicket.map((p, pi) => (
                                                  <div key={pi} style={{ padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid rgba(46, 204, 113, 0.15)', background: 'rgba(46, 204, 113, 0.02)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                                                    <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 4, color: '#fff' }}>{p.product_name}</div>
                                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                                                      <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(46, 204, 113, 0.15)', color: 'var(--success)' }}>{p.category}</span>
                                                      {p.estimated_price_range && <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(253,203,110,0.12)', color: 'var(--warning)' }}>{p.estimated_price_range}</span>}
                                                    </div>
                                                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.45 }}>{p.reason}</p>
                                                    <div style={{ 
                                                      marginTop: 8, 
                                                      display: 'flex', 
                                                      alignItems: 'center', 
                                                      justifyContent: 'space-between',
                                                      background: 'rgba(0, 0, 0, 0.2)', 
                                                      padding: '4px 8px', 
                                                      borderRadius: 4, 
                                                      border: '1px solid rgba(255, 255, 255, 0.05)'
                                                    }}>
                                                      <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        🔍 {p.marketplace_search_query}
                                                      </span>
                                                      <button 
                                                        type="button"
                                                        onClick={() => handleCopyQuery(p.marketplace_search_query, `low-${asset.id}-${pi}`)}
                                                        style={{
                                                          background: 'none',
                                                          border: 'none',
                                                          color: copiedQuery === `low-${asset.id}-${pi}` ? 'var(--success)' : 'var(--text-muted)',
                                                          fontSize: '0.65rem',
                                                          cursor: 'pointer',
                                                          padding: '2px 6px',
                                                          borderRadius: 3,
                                                          background: 'rgba(255, 255, 255, 0.05)',
                                                          fontFamily: 'var(--font-sans)',
                                                          fontWeight: 600,
                                                          transition: 'all 0.15s'
                                                        }}
                                                      >
                                                        {copiedQuery === `low-${asset.id}-${pi}` ? '✓ Copied' : 'Copy'}
                                                      </button>
                                                    </div>
                                                  </div>
                                                ))}
                                                {lowTicket.length === 0 && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>—</div>}
                                              </div>
                                            </div>
                                            {/* High Ticket */}
                                            <div>
                                              <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#e17055', marginBottom: 8, letterSpacing: '0.06em' }}>🔥 High Ticket</div>
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {highTicket.map((p, pi) => (
                                                  <div key={pi} style={{ padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid rgba(225,112,85,0.15)', background: 'rgba(225,112,85,0.02)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                                                    <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 4, color: '#fff' }}>{p.product_name}</div>
                                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                                                      <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(225,112,85,0.15)', color: '#e17055' }}>{p.category}</span>
                                                      {p.estimated_price_range && <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(253,203,110,0.12)', color: 'var(--warning)' }}>{p.estimated_price_range}</span>}
                                                    </div>
                                                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.45 }}>{p.reason}</p>
                                                    <div style={{ 
                                                      marginTop: 8, 
                                                      display: 'flex', 
                                                      alignItems: 'center', 
                                                      justifyContent: 'space-between',
                                                      background: 'rgba(0, 0, 0, 0.2)', 
                                                      padding: '4px 8px', 
                                                      borderRadius: 4, 
                                                      border: '1px solid rgba(255, 255, 255, 0.05)'
                                                    }}>
                                                      <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        🔍 {p.marketplace_search_query}
                                                      </span>
                                                      <button 
                                                        type="button"
                                                        onClick={() => handleCopyQuery(p.marketplace_search_query, `high-${asset.id}-${pi}`)}
                                                        style={{
                                                          background: 'none',
                                                          border: 'none',
                                                          color: copiedQuery === `high-${asset.id}-${pi}` ? 'var(--success)' : 'var(--text-muted)',
                                                          fontSize: '0.65rem',
                                                          cursor: 'pointer',
                                                          padding: '2px 6px',
                                                          borderRadius: 3,
                                                          background: 'rgba(255, 255, 255, 0.05)',
                                                          fontFamily: 'var(--font-sans)',
                                                          fontWeight: 600,
                                                          transition: 'all 0.15s'
                                                        }}
                                                      >
                                                        {copiedQuery === `high-${asset.id}-${pi}` ? '✓ Copied' : 'Copy'}
                                                      </button>
                                                    </div>
                                                  </div>
                                                ))}
                                                {highTicket.length === 0 && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>—</div>}
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Viral Pattern Summary */}
                                        {asset.viral_pattern_summary && (
                                          <div style={{ 
                                            marginTop: 20, 
                                            padding: '16px 20px', 
                                            borderRadius: 'var(--radius-sm)', 
                                            background: 'linear-gradient(135deg, rgba(108,92,231,0.08) 0%, rgba(108,92,231,0.02) 100%)', 
                                            border: '1px solid rgba(108,92,231,0.25)',
                                            borderLeft: '4px solid var(--accent)',
                                            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
                                          }}>
                                            <h4 style={{ 
                                              fontSize: '0.85rem', 
                                              fontWeight: 700, 
                                              marginBottom: 8, 
                                              display: 'flex', 
                                              alignItems: 'center', 
                                              gap: 8, 
                                              color: 'var(--accent-light)',
                                              letterSpacing: '0.02em'
                                            }}>
                                              🧠 AI Viral Pattern & Insights
                                            </h4>
                                            <p style={{ 
                                              fontSize: '0.82rem', 
                                              color: 'var(--text-secondary)', 
                                              lineHeight: 1.7,
                                              margin: 0
                                            }}>
                                              {asset.viral_pattern_summary}
                                            </p>
                                          </div>
                                        )}

                                        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                                          <Link 
                                            href={`/multiplier-lab?asset_id=${asset.id}`}
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '8px',
                                              padding: '8px 16px',
                                              background: 'var(--accent)',
                                              color: '#fff',
                                              border: 'none',
                                              borderRadius: 'var(--radius-sm)',
                                              fontSize: '0.78rem',
                                              fontWeight: 600,
                                              textDecoration: 'none',
                                              cursor: 'pointer',
                                              transition: 'background 0.2s',
                                              boxShadow: '0 4px 12px rgba(108, 92, 231, 0.2)'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = '#5b3fcb'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent)'}
                                          >
                                            🎛️ Use this Blueprint (Multiplier Lab)
                                          </Link>
                                        </div>
                                      </div>
                                    )}

                                    {/* Failed state */}
                                    {isExpanded && asset.status === 'failed' && (
                                      <div className="expanded-detail-enter" style={{ padding: '0 16px 14px', borderTop: '1px solid var(--border)' }}>
                                        <div style={{ marginTop: 12, padding: 10, background: 'var(--danger-glow)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--danger)' }}>
                                          ⚠ {asset.error_message || 'Unknown error'}
                                        </div>
                                      </div>
                                    )}

                                    {/* Active processing state */}
                                    {isExpanded && ['downloading','uploading','analyzing'].includes(asset.status) && (
                                      <div className="expanded-detail-enter" style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></div>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--info)' }}>
                                          {asset.status === 'downloading' && 'Mengunduh video...'}
                                          {asset.status === 'uploading' && 'Mengunggah ke Gemini AI...'}
                                          {asset.status === 'analyzing' && 'Menganalisis (Phase 1)...'}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes active-pulse {
          from { opacity: 0.5; }
          to { opacity: 1; }
        }
        @keyframes pulse-glow {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
        .expanded-detail-enter {
          animation: slideDownFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transform-origin: top;
        }
        @keyframes slideDownFadeIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}} />
    </div>
  );
}
