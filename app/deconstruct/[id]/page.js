'use client';

import Sidebar from '../../components/Sidebar';
import { useEffect, useState, useRef, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AssetDetailPage({ params }) {
  const router = useRouter();
  const { id } = use(params);

  // Detail State
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Metadata Editor State
  const [editingMeta, setEditingMeta] = useState(false);
  const [nicheInput, setNicheInput] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);

  // Clipboard copies
  const [copiedQuery, setCopiedQuery] = useState(null);
  
  // UI States
  const [toast, setToast] = useState(null);
  const pollingRef = useRef(null);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  // --- Fetch Detail ---
  async function fetchDetail(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/v2/deconstruct/assets/${id}`);
      const data = await res.json();
      if (data.success) {
        setAsset(data.asset);
        setNicheInput(data.asset.niche || '');
        setTagsInput(data.asset.tags || '');
        setError(null);
      } else {
        setError(data.error || 'Gagal memuat detail aset');
      }
    } catch {
      setError('Gagal menghubungi server');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    fetchDetail();
  }, [id]);

  // Polling if asset is processing
  useEffect(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    if (asset && ['pending_download', 'downloading', 'uploading', 'analyzing'].includes(asset.status)) {
      pollingRef.current = setInterval(() => {
        fetchDetail(true);
      }, 4000);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [asset?.status]);

  // --- Metadata Edit Action ---
  async function handleSaveMetadata(e) {
    e.preventDefault();
    if (!nicheInput.trim()) {
      showToast('Niche tidak boleh kosong', 'error');
      return;
    }
    setSavingMeta(true);
    try {
      const res = await fetch(`/api/v2/deconstruct/assets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: nicheInput.trim(), tags: tagsInput })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Metadata berhasil diperbarui');
        setAsset(prev => ({ ...prev, niche: nicheInput.trim(), tags: tagsInput }));
        setEditingMeta(false);
      } else {
        showToast(data.error || 'Gagal memperbarui metadata', 'error');
      }
    } catch {
      showToast('Gagal terhubung ke server', 'error');
    } finally {
      setSavingMeta(false);
    }
  }

  // --- Copy Utility ---
  function handleCopyQuery(query, key) {
    navigator.clipboard.writeText(query);
    setCopiedQuery(key);
    setTimeout(() => setCopiedQuery(null), 2000);
  }

  // --- Status and Visual Helpers ---
  function getStatusBadge(s) {
    const m = {
      saved: { color: 'var(--text-muted)', bg: 'rgba(255, 255, 255, 0.05)', label: 'BELUM DI-PROSES' },
      pending_download: { color: 'var(--info)', bg: 'rgba(116, 185, 255, 0.12)', label: 'ANTREAN DOWNLOAD' },
      downloading: { color: 'var(--info)', bg: 'rgba(116, 185, 255, 0.15)', label: 'MENGUNDUH VIDEO' },
      uploading: { color: 'var(--info)', bg: 'rgba(116, 185, 255, 0.15)', label: 'MENGUNGGAH KE AI' },
      analyzing: { color: 'var(--info)', bg: 'rgba(116, 185, 255, 0.2)', label: 'GEMINI MENGANALISIS' },
      deconstructed: { color: 'var(--success)', bg: 'rgba(46, 204, 113, 0.12)', label: 'DECONSTRUCTED' },
      failed: { color: 'var(--danger)', bg: 'rgba(231, 76, 60, 0.12)', label: 'PROSES GAGAL' }
    };
    return m[s] || { color: 'var(--text-muted)', bg: 'var(--surface-interactive)', label: s?.toUpperCase() };
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--background)' }}>
        <Sidebar />
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }}></div>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Memuat detail aset dekonstruksi...</span>
        </main>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--background)' }}>
        <Sidebar />
        <main style={{ flex: 1, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ padding: '24px 32px', background: 'var(--danger-glow)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textAlign: 'center', maxWidth: 460 }}>
            <span style={{ fontSize: '2rem', display: 'block', marginBottom: 12 }}>⚠</span>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--danger)' }}>Kesalahan Memuat Aset</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>{error || 'Aset tidak ditemukan.'}</p>
            <Link href="/deconstruct" className="btn btn-secondary" style={{ marginTop: 16, display: 'inline-block', textDecoration: 'none' }}>
              Kembali ke Library
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const storyboard = asset.storyboard || [];
  const lowTicket = asset.product_ideas?.low_ticket || [];
  const highTicket = asset.product_ideas?.high_ticket || [];
  const statusOpt = getStatusBadge(asset.status);

  // Current pipeline index
  const stages = ['saved', 'downloading', 'uploading', 'analyzing', 'deconstructed'];
  let currentStageIndex = stages.indexOf(asset.status);
  if (asset.status === 'pending_download') currentStageIndex = 0; // treat pending download as saved / beginning
  if (asset.status === 'failed') currentStageIndex = -1;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--background)' }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
        {/* Back and Title Navigation */}
        <div style={{ marginBottom: 20 }}>
          <Link href="/deconstruct" style={{ textDecoration: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}>
            ← KEMBALI KE LIBRARY
          </Link>
        </div>

        {/* Title Header Card */}
        <div style={{
          background: 'var(--overlay-subtle)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: 24,
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 20,
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.68rem', padding: '3px 8px', borderRadius: 4, background: 'rgba(108, 92, 231, 0.08)', color: 'var(--accent-light)', fontWeight: 700, border: '1px solid rgba(108, 92, 231, 0.15)' }}>
                {asset.niche || 'TANPA NICHE'}
              </span>
              <span style={{ fontSize: '0.68rem', padding: '3px 8px', borderRadius: 4, background: statusOpt.bg, color: statusOpt.color, fontWeight: 800 }}>
                {statusOpt.label}
              </span>
            </div>

            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
              {asset.source_url}
            </h2>

            <div style={{ marginTop: 12, display: 'flex', gap: 16, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span>📥 Diinput: <strong>{new Date(asset.created_at).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' })}</strong></span>
              {asset.deconstructed_at && (
                <span>✓ Selesai: <strong>{new Date(asset.deconstructed_at).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' })}</strong></span>
              )}
            </div>

            {asset.tags && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                {asset.tags.split(',').map((t, idx) => (
                  <span key={idx} style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--surface-interactive)', padding: '2px 8px', borderRadius: 4 }}>
                    #{t.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setEditingMeta(!editingMeta)}
              className="btn btn-secondary"
              style={{ padding: '8px 14px', fontSize: '0.8rem', height: 36 }}
            >
              📝 Edit Metadata
            </button>

            {asset.status === 'deconstructed' && (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <button
                  className="btn btn-primary"
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    height: 36,
                    background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    const el = document.getElementById('labs-menu');
                    if (el) el.style.display = el.style.display === 'block' ? 'none' : 'block';
                  }}
                >
                  ⚡ Gunakan Hasil Aset
                </button>
                <div
                  id="labs-menu"
                  style={{
                    display: 'none',
                    position: 'absolute',
                    right: 0,
                    top: 40,
                    background: 'var(--surface-interactive)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
                    zIndex: 100,
                    width: 230
                  }}
                >
                  <Link
                    href={`/recipe-labs?source_deconstruct_id=${asset.id}`}
                    style={{ display: 'block', padding: '10px 14px', fontSize: '0.8rem', color: 'var(--text-primary)', textDecoration: 'none', borderBottom: '1px solid var(--border)', fontWeight: 500 }}
                    onClick={() => { const el = document.getElementById('labs-menu'); if (el) el.style.display = 'none'; }}
                  >
                    ✨ Buat Konsep Baru di Recipe Labs
                  </Link>
                  <Link
                    href={`/multiplier-lab?asset_id=${asset.id}`}
                    style={{ display: 'block', padding: '10px 14px', fontSize: '0.8rem', color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500 }}
                    onClick={() => { const el = document.getElementById('labs-menu'); if (el) el.style.display = 'none'; }}
                  >
                    🎛️ Buat Variasi di Multiplier Labs
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Metadata Editor Form */}
        {editingMeta && (
          <div style={{
            background: 'var(--overlay-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: 20,
            marginBottom: 24
          }}>
            <h4 style={{ fontSize: '0.88rem', margin: '0 0 14px 0', color: 'var(--text-primary)' }}>Ubah Metadata Aset</h4>
            <form onSubmit={handleSaveMetadata} style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Niche</label>
                <input
                  type="text"
                  required
                  value={nicheInput}
                  onChange={(e) => setNicheInput(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', background: 'var(--surface-interactive)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                />
              </div>
              <div style={{ flex: 2, minWidth: 280 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Tags (pisahkan dengan koma)</label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="tag1, tag2, tag3"
                  style={{ width: '100%', padding: '8px 10px', background: 'var(--surface-interactive)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setEditingMeta(false)} className="btn btn-secondary" style={{ height: 34, fontSize: '0.8rem' }}>Batal</button>
                <button type="submit" disabled={savingMeta} className="btn btn-primary" style={{ height: 34, fontSize: '0.8rem', fontWeight: 600 }}>
                  {savingMeta ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Pipeline Progress Tracker */}
        {asset.status !== 'deconstructed' && (
          <div style={{
            background: 'var(--overlay-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: 20,
            marginBottom: 24
          }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-secondary)' }}>
              ⚙️ Pipeline Analisis Status
            </h4>

            {asset.status === 'failed' ? (
              <div style={{ padding: 14, background: 'var(--danger-glow)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
                <strong>Proses Gagal:</strong> {asset.error_message || 'Kesalahan analisis Gemini AI.'}
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', overflowX: 'auto', padding: '10px 0' }}>
                {stages.slice(0, -1).map((st, idx) => {
                  const isActive = idx === currentStageIndex;
                  const isCompleted = idx < currentStageIndex;
                  let title = st.toUpperCase();
                  if (st === 'saved') title = 'QUEUED / SAVED';
                  if (st === 'downloading') title = 'DOWNLOADING VIDEO';
                  if (st === 'uploading') title = 'UPLOADING TO AI';
                  if (st === 'analyzing') title = 'GEMINI ANALYZING';

                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 100, textAlign: 'center', position: 'relative' }}>
                      <div style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: isCompleted ? 'var(--success)' : isActive ? 'var(--info)' : 'var(--border)',
                        color: isCompleted || isActive ? '#fff' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        boxShadow: isActive ? '0 0 10px var(--info)' : 'none',
                        zIndex: 2
                      }}>
                        {isCompleted ? '✓' : idx + 1}
                      </div>
                      <span style={{ fontSize: '0.7rem', fontWeight: isActive || isCompleted ? 700 : 500, color: isActive ? 'var(--info)' : isCompleted ? 'var(--text-primary)' : 'var(--text-muted)', marginTop: 8 }}>
                        {title}
                      </span>
                    </div>
                  );
                })}
                {/* Connecting bar */}
                <div style={{ position: 'absolute', top: 23, left: '10%', right: '10%', height: 2, background: 'var(--border)', zIndex: 1 }} />
              </div>
            )}
          </div>
        )}

        {/* Content Results Section (Only if status is deconstructed) */}
        {asset.status === 'deconstructed' && (
          <>
            {/* Viral Pattern Summary Insights */}
            {asset.viral_pattern_summary && (
              <div style={{
                marginBottom: 24,
                padding: '20px 24px',
                borderRadius: 'var(--radius-sm)',
                background: 'linear-gradient(135deg, rgba(108,92,231,0.08) 0%, rgba(108,92,231,0.02) 100%)',
                border: '1px solid rgba(108,92,231,0.25)',
                borderLeft: '4px solid var(--accent)',
                boxShadow: '0 4px 20px var(--overlay-subtle)'
              }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 800, margin: '0 0 10px 0', color: 'var(--accent-light)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  🧠 AI Viral Pattern & Insights
                </h4>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                  {asset.viral_pattern_summary}
                </p>
              </div>
            )}

            {/* Storyboard Block */}
            <div style={{
              background: 'var(--overlay-subtle)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: 24,
              marginBottom: 24
            }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>
                📋 Detailed Storyboard ({storyboard.length} scenes)
              </h3>
              
              <div style={{ overflowX: 'auto' }}>
                <table className="ideas-table" style={{ width: '100%', fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>Scene</th>
                      <th style={{ width: 90 }}>Timestamp</th>
                      <th>Visual Description</th>
                      <th style={{ width: 160 }}>Emotional Hook</th>
                      <th style={{ width: 140 }}>Camera Technique</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storyboard.map((scene, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 700, textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            background: 'var(--surface-interactive)',
                            color: 'var(--accent-light)',
                            fontSize: '0.7rem'
                          }}>
                            {scene.scene || idx + 1}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                          {scene.timestamp || '—'}
                        </td>
                        <td style={{ lineHeight: 1.5, color: 'var(--text-primary)' }}>
                          {scene.visual_description}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {scene.emotional_hook ? scene.emotional_hook.split(',').map((hook, hi) => (
                              <span key={hi} style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(253, 203, 110, 0.1)', color: 'var(--warning)', border: '1px solid rgba(253, 203, 110, 0.15)' }}>
                                ✨ {hook.trim()}
                              </span>
                            )) : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>}
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {scene.camera_technique || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Audio Narration Audio Transcript */}
              {storyboard.some(s => s.narration_transcript) && (
                <div style={{ marginTop: 20, padding: '16px 20px', background: 'var(--surface-interactive)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12 }}>
                    🎙️ Voice Narration Audio Transcript
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {storyboard.filter(s => s.narration_transcript).map((s, si) => (
                      <div key={si} style={{ fontSize: '0.82rem', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--accent-light)', background: 'var(--overlay-subtle)', padding: '2px 6px', borderRadius: 3, flexShrink: 0 }}>
                          Scene {s.scene || si + 1}
                        </span>
                        <span style={{ color: 'var(--text-primary)', fontStyle: 'italic' }}>
                          "{s.narration_transcript}"
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Product Ideas Section */}
            <div style={{
              background: 'var(--overlay-subtle)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: 24,
              marginBottom: 24
            }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>
                💡 E-commerce Product Blueprints
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Low Ticket Products */}
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--success)', marginBottom: 10, letterSpacing: '0.06em' }}>
                    💚 Low Ticket Concepts
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {lowTicket.map((prod, idx) => (
                      <div key={idx} style={{ padding: 14, borderRadius: 'var(--radius-sm)', border: '1px solid var(--status-success-soft)', background: 'rgba(46, 204, 113, 0.02)' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: 4, color: 'var(--text-primary)' }}>{prod.product_name}</div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                          <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: 4, background: 'var(--status-success-soft)', color: 'var(--success)', fontWeight: 600 }}>{prod.category}</span>
                          {prod.estimated_price_range && (
                            <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(253,203,110,0.12)', color: 'var(--warning)', fontWeight: 600 }}>{prod.estimated_price_range}</span>
                          )}
                        </div>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 10px 0', lineHeight: 1.45 }}>{prod.reason}</p>
                        
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--overlay-subtle)', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>
                            🔍 {prod.marketplace_search_query}
                          </span>
                          <button
                            onClick={() => handleCopyQuery(prod.marketplace_search_query, `low-${idx}`)}
                            style={{ background: 'var(--surface-interactive)', border: 'none', color: copiedQuery === `low-${idx}` ? 'var(--success)' : 'var(--text-muted)', fontSize: '0.65rem', cursor: 'pointer', padding: '3px 8px', borderRadius: 3, fontWeight: 600 }}
                          >
                            {copiedQuery === `low-${idx}` ? '✓ Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    ))}
                    {lowTicket.length === 0 && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>— Tidak ada ide low ticket —</div>}
                  </div>
                </div>

                {/* High Ticket Products */}
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--status-warning)', marginBottom: 10, letterSpacing: '0.06em' }}>
                    🔥 High Ticket Concepts
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {highTicket.map((prod, idx) => (
                      <div key={idx} style={{ padding: 14, borderRadius: 'var(--radius-sm)', border: '1px solid rgba(225,112,85,0.15)', background: 'rgba(225,112,85,0.02)' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: 4, color: 'var(--text-primary)' }}>{prod.product_name}</div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                          <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(225,112,85,0.15)', color: 'var(--status-warning)', fontWeight: 600 }}>{prod.category}</span>
                          {prod.estimated_price_range && (
                            <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(253,203,110,0.12)', color: 'var(--warning)', fontWeight: 600 }}>{prod.estimated_price_range}</span>
                          )}
                        </div>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 10px 0', lineHeight: 1.45 }}>{prod.reason}</p>
                        
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--overlay-subtle)', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>
                            🔍 {prod.marketplace_search_query}
                          </span>
                          <button
                            onClick={() => handleCopyQuery(prod.marketplace_search_query, `high-${idx}`)}
                            style={{ background: 'var(--surface-interactive)', border: 'none', color: copiedQuery === `high-${idx}` ? 'var(--success)' : 'var(--text-muted)', fontSize: '0.65rem', cursor: 'pointer', padding: '3px 8px', borderRadius: 3, fontWeight: 600 }}
                          >
                            {copiedQuery === `high-${idx}` ? '✓ Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    ))}
                    {highTicket.length === 0 && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>— Tidak ada ide high ticket —</div>}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Global Toast */}
        {toast && (
          <div style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            padding: '12px 20px',
            background: toast.type === 'error' ? 'var(--danger)' : 'var(--success)',
            color: '#fff',
            borderRadius: 'var(--radius-sm)',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
            fontSize: '0.82rem',
            fontWeight: 600,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            animation: 'slideDownFadeIn 0.25s ease-out'
          }}>
            <span>{toast.type === 'error' ? '⚠' : '✓'}</span>
            {toast.msg}
          </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .spinner {
          border: 3px solid rgba(255,255,255,0.05);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes slideDownFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
