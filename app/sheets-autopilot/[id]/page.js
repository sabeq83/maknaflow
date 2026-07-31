"use client";

import Sidebar from '../../components/Sidebar';
import Link from 'next/link';
import { useEffect, useState, use, Fragment } from 'react';

export default function CampaignDetailPage({ params }) {
  // Safe param unwrapping for compatibility
  const resolvedParams = use(params);
  const { id } = resolvedParams;

  const [campaign, setCampaign] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryLoading, setRetryLoading] = useState({});
  const [repairingClip, setRepairingClip] = useState({});
  const [realigningClip, setRealigningClip] = useState({});
  const [batchRepairing, setBatchRepairing] = useState(false);
  const [batchRepairResults, setBatchRepairResults] = useState(null);
  const [selectedJobIds, setSelectedJobIds] = useState(new Set());

  // Selected job for inline detail view (accordion)
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [activeTabs, setActiveTabs] = useState({});

  useEffect(() => {
    fetchDetail();
  }, [id]);

  async function fetchDetail() {
    setLoading(true);
    try {
      const res = await fetch(`/api/sheets-autopilot?id=${id}`);
      const json = await res.json();
      if (json.success) {
        setCampaign(json.data.campaign);
        setJobs(json.data.jobs || []);
      } else {
        setError(json.error || 'Gagal memuat detail kampanye.');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRetryJob(rowIndex, force = false) {
    const confirmationMsg = force
      ? `Apakah Anda yakin ingin melakukan Reset Total pada baris #${rowIndex}? Semua progres (naskah, audio, klip video) akan dihapus dan diulang sepenuhnya dari awal.`
      : `Apakah Anda yakin ingin memproses ulang (Smart Retry) baris #${rowIndex}? Tahap yang sukses akan dilewati dan hanya klip yang gagal yang akan dibuat ulang.`;

    if (!confirm(confirmationMsg)) {
      return;
    }
    setRetryLoading(prev => ({ ...prev, [`${rowIndex}-${force}`]: true }));
    try {
      const res = await fetch('/api/sheets-autopilot/retry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ campaignId: id, rowIndex, force }),
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message || `Baris #${rowIndex} berhasil di-retry.`);
        fetchDetail();
      } else {
        alert(`Gagal memproses ulang baris #${rowIndex}: ${json.error}`);
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      setRetryLoading(prev => ({ ...prev, [`${rowIndex}-${force}`]: false }));
    }
  }

  async function handleRepairClip(jobId, clipNum) {
    const clipIndex = Number(clipNum);
    if (!confirm(`Apakah Anda yakin ingin me-generate ulang video untuk Klip ${clipIndex}?`)) {
      return;
    }
    const key = `${jobId}-${clipIndex}`;
    setRepairingClip(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetch('/api/sheets-autopilot/repair-clip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId, clipIndex }),
      });
      const json = await res.json();
      if (json.success) {
        alert(`Klip ${clipIndex} berhasil di-generate ulang dan di-remux!`);
        fetchDetail();
      } else {
        alert(`Gagal me-generate ulang Klip ${clipIndex}: ${json.error}`);
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      setRepairingClip(prev => ({ ...prev, [key]: false }));
    }
  }

  async function handleRealignClip(jobId, clipNum) {
    const clipIndex = Number(clipNum);
    if (!confirm(`Apakah Anda yakin ingin menyelaraskan naskah Klip ${clipIndex} via Gemini dan me-generate ulang video & audio Klip ${clipIndex}?`)) {
      return;
    }
    const key = `${jobId}-${clipIndex}`;
    setRealigningClip(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetch('/api/sheets-autopilot/repair-storyboard-clip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId, clipIndex }),
      });
      const json = await res.json();
      if (json.success) {
        alert(`Klip ${clipIndex} berhasil diselaraskan dan di-generate ulang!`);
        fetchDetail();
      } else {
        alert(`Gagal menyelaraskan Klip ${clipIndex}: ${json.error}`);
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      setRealigningClip(prev => ({ ...prev, [key]: false }));
    }
  }

  async function handleBatchRepairClip2() {
    if (selectedJobIds.size === 0) {
      alert('Pilih dulu baris yang ingin di-repair dengan mencentang checkbox di kolom kiri tabel.');
      return;
    }

    // Hanya proses job yang dipilih user (selectedJobIds)
    // Untuk setiap batch_id, prefer job yang statusnya 'completed'
    const seenBatchIds = new Map();
    for (const job of jobs) {
      if (!selectedJobIds.has(job.id)) continue;
      const existing = seenBatchIds.get(job.batch_id);
      if (!existing || job.status === 'completed') {
        seenBatchIds.set(job.batch_id, { jobId: job.id, clipIndex: 2, batchId: job.batch_id, rowIndex: job.row_index });
      }
    }
    const targetJobs = Array.from(seenBatchIds.values());

    if (targetJobs.length === 0) {
      alert('Tidak ada job yang valid untuk diproses.');
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin menjalankan Batch Re-align Klip 2 untuk ${targetJobs.length} baris yang dipilih? Proses ini akan memperbaiki narasi, T2I, I2V Klip 2 dan generate ulang video.`)) {
      return;
    }

    setBatchRepairing(true);
    setBatchRepairResults(null);
    try {
      const res = await fetch('/api/sheets-autopilot/batch-repair-storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: id,
          jobs: targetJobs.map(j => ({ jobId: j.jobId, clipIndex: j.clipIndex }))
        })
      });
      const json = await res.json();
      setBatchRepairResults(json);
      if (json.success) {
        alert(`Batch selesai! ${json.successCount} sukses, ${json.failCount} gagal dari ${json.totalProcessed} total baris.`);
        setSelectedJobIds(new Set());
        fetchDetail();
      } else {
        alert(`Batch gagal: ${json.error}`);
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      setBatchRepairing(false);
    }
  }

  function toggleSelectJob(jobId) {
    setSelectedJobIds(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }

  function toggleSelectAll() {
    // Ambil unique job per batch_id (prefer completed)
    const uniqueIds = new Set();
    const seenBatch = new Set();
    for (const job of jobs) {
      if (!seenBatch.has(job.batch_id)) {
        seenBatch.add(job.batch_id);
        uniqueIds.add(job.id);
      } else if (job.status === 'completed') {
        uniqueIds.add(job.id);
      }
    }
    const allSelected = uniqueIds.size > 0 && [...uniqueIds].every(id => selectedJobIds.has(id));
    if (allSelected) setSelectedJobIds(new Set());
    else setSelectedJobIds(uniqueIds);
  }

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'completed': return { bg: 'rgba(0,184,148,0.15)', color: 'var(--success)', border: '1px solid rgba(0,184,148,0.3)' };
      case 'failed': return { bg: 'rgba(225,112,85,0.15)', color: 'var(--danger)', border: '1px solid rgba(225,112,85,0.3)' };
      case 'processing': return { bg: 'rgba(116,185,255,0.15)', color: 'var(--info)', border: '1px solid rgba(116,185,255,0.3)', pulse: true };
      default: return { bg: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--border)' };
    }
  };

  const totalJobs = jobs.length;
  const completedJobs = jobs.filter(j => j.status === 'completed').length;
  const failedJobs = jobs.filter(j => j.status === 'failed').length;
  const processingJobs = jobs.filter(j => j.status === 'processing').length;

  const renderStoryboard = (job) => {
    let storyboard = [];
    let voiceover = [];
    try {
      storyboard = JSON.parse(job.storyboard || '[]');
      voiceover = JSON.parse(job.voiceover || '[]');
    } catch (_) {}

    if (storyboard.length === 0) {
      return <p style={{ color: 'var(--text-muted)' }}>Data storyboard kosong.</p>;
    }

    const audioExt = job.local_audio_path ? job.local_audio_path.split('.').pop() : 'mp3';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {storyboard.map((scene, idx) => {
          const clipNum = scene.scene || scene.clip || scene.scene_number || (idx + 1);
          const vo = voiceover.find(v => Number(v.scene || v.clip || v.scene_number) === Number(clipNum)) || {};
          const audioClipPath = `/temp/tts_autopilot_${job.batch_id}_clip_${idx}.${audioExt}`;
          
          return (
            <div key={idx} style={{
              background: 'rgba(255,255,255,0.01)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>
                  Scene {clipNum}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Durasi: {scene.duration || '8s'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>DESKRIPSI ADEGAN VISUAL</div>
                  <p style={{ fontSize: '0.85rem', margin: 0, lineHeight: 1.4 }}>{scene.visual_description || scene.visual_segment?.visual_action || ''}</p>
                  {(scene.camera_movement || scene.visual_segment?.camera_movement) && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
                      🎥 Gerakan: <i>{scene.camera_movement || scene.visual_segment?.camera_movement}</i>
                    </div>
                  )}
                </div>
                <div style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '16px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>VOICEOVER & AUDIO MOOD</div>
                  <p style={{ fontSize: '0.88rem', margin: 0, fontWeight: 500, color: 'var(--accent)', lineHeight: 1.4 }}>
                    "{vo.narration || vo.voiceover_text || ''}"
                  </p>
                  {(scene.audio_mood || scene.audio_segment?.audio_mood) && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6, marginBottom: 6 }}>
                      🎵 SFX/Mood: <i>{scene.audio_mood || scene.audio_segment?.audio_mood}</i>
                    </div>
                  )}
                  {job.local_audio_path && (
                    <div style={{ marginTop: 8 }}>
                      <audio src={audioClipPath} controls style={{ width: '100%', height: '32px' }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderPrompts = (job) => {
    let storyboard = [];
    let prompts = { t2v_prompts: [], t2i_prompts: [], i2v_prompts: [] };
    try {
      storyboard = JSON.parse(job.storyboard || '[]');
      if (job.prompts_json) {
        prompts = JSON.parse(job.prompts_json);
      }
    } catch (_) {}

    if (storyboard.length === 0) {
      return <p style={{ color: 'var(--text-muted)' }}>Data storyboard kosong.</p>;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {storyboard.map((scene, idx) => {
          const clipNum = scene.scene || scene.clip || scene.scene_number || (idx + 1);
          const t2v = (prompts.t2v_prompts || []).find(p => Number(p.clip) === Number(clipNum))?.prompt;
          const t2i = (prompts.t2i_prompts || []).find(p => Number(p.clip) === Number(clipNum))?.prompt;
          const i2v = (prompts.i2v_prompts || []).find(p => Number(p.clip) === Number(clipNum))?.prompt;
          
          const videoClipPath = `/temp/temp_clip_${job.batch_id}_${clipNum}.mp4`;

          return (
            <div key={idx} style={{
              background: 'rgba(255,255,255,0.01)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '16px'
             }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  Klip {clipNum}
                </span>
                {campaign?.enable_glabs === 1 && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => handleRepairClip(job.id, clipNum)}
                      disabled={repairingClip[`${job.id}-${clipNum}`] || realigningClip[`${job.id}-${clipNum}`] || job.status === 'processing'}
                      className="btn btn-secondary"
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.72rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: (repairingClip[`${job.id}-${clipNum}`] || realigningClip[`${job.id}-${clipNum}`] || job.status === 'processing') ? 'not-allowed' : 'pointer',
                        borderColor: 'var(--accent)',
                        color: 'var(--accent-light)',
                        background: 'rgba(var(--accent-rgb), 0.1)',
                      }}
                    >
                      {repairingClip[`${job.id}-${clipNum}`] ? '⏳ Re-generating...' : '⚡ Re-generate Video'}
                    </button>
                    {Number(clipNum) === 2 && (
                      <button
                        onClick={() => handleRealignClip(job.id, clipNum)}
                        disabled={realigningClip[`${job.id}-${clipNum}`] || repairingClip[`${job.id}-${clipNum}`] || job.status === 'processing'}
                        className="btn btn-secondary"
                        style={{
                          padding: '4px 8px',
                          fontSize: '0.72rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: (realigningClip[`${job.id}-${clipNum}`] || repairingClip[`${job.id}-${clipNum}`] || job.status === 'processing') ? 'not-allowed' : 'pointer',
                          borderColor: 'var(--info)',
                          color: 'var(--info)',
                          background: 'rgba(116, 185, 255, 0.1)',
                        }}
                      >
                        {realigningClip[`${job.id}-${clipNum}`] ? '⏳ Re-aligning...' : '🔧 Re-align & Re-generate (Gemini)'}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {t2v && (
                  <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 6 }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>T2V Prompt</div>
                    <p style={{ fontSize: '0.8rem', margin: 0, fontFamily: 'monospace', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{t2v}</p>
                  </div>
                )}
                {t2i && (
                  <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 6 }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>T2I Prompt (Start Frame)</div>
                    <p style={{ fontSize: '0.8rem', margin: 0, fontFamily: 'monospace', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{t2i}</p>
                  </div>
                )}
                {i2v && (
                  <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 6 }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>I2V Prompt (Motion)</div>
                    <p style={{ fontSize: '0.8rem', margin: 0, fontFamily: 'monospace', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{i2v}</p>
                  </div>
                )}
                {campaign?.enable_glabs === 1 && job.status === 'completed' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>🎬 Generated Visual Clip</span>
                    <video 
                      src={videoClipPath} 
                      controls 
                      preload="metadata"
                      style={{ 
                        width: '100%', 
                        maxHeight: '240px', 
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
  };

  const renderSocial = (job) => {
    let captions = { tiktok_caption: '', ig_caption: '', yt_title: '', yt_desc: '' };
    try {
      if (job.captions_json) {
        captions = JSON.parse(job.captions_json);
      }
    } catch (_) {}

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {captions.yt_title && (
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: '0.85rem' }}>
              <div style={{ fontWeight: 600, color: 'var(--accent)' }}>🔴 YouTube Shorts Draft Title</div>
              <div style={{ marginTop: 6, color: '#fff', fontSize: '0.85rem' }}>{captions.yt_title}</div>
              <div style={{ marginTop: 12, fontWeight: 600, color: 'var(--accent)' }}>Description</div>
              <div style={{ marginTop: 6, color: 'var(--text-muted)', whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>{captions.yt_desc}</div>
            </div>
          </div>
        )}

        {captions.tiktok_caption && (
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--accent)', display: 'block', marginBottom: 8 }}>🎵 TikTok Caption</span>
            <p style={{ fontSize: '0.85rem', margin: 0, whiteSpace: 'pre-wrap', color: '#fff' }}>{captions.tiktok_caption}</p>
          </div>
        )}

        {captions.ig_caption && (
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--accent)', display: 'block', marginBottom: 8 }}>📸 Instagram Reels Caption</span>
            <p style={{ fontSize: '0.85rem', margin: 0, whiteSpace: 'pre-wrap', color: '#fff' }}>{captions.ig_caption}</p>
          </div>
        )}
      </div>
    );
  };

  const renderLogs = (job) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 8 }}>
          <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 8, color: 'var(--text-primary)' }}>Detail Teknis Pekerjaan Autopilot:</div>
          <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>ID Pekerjaan</td>
                <td style={{ padding: '6px 0', fontWeight: 600 }}>#{job.id}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Batch ID</td>
                <td style={{ padding: '6px 0', fontWeight: 600 }}>{job.batch_id}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Baris Ke</td>
                <td style={{ padding: '6px 0' }}>Baris #{job.row_index}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Dibuat Pada</td>
                <td style={{ padding: '6px 0' }}>{new Date(job.created_at).toLocaleString('id-ID')}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Retry Count</td>
                <td style={{ padding: '6px 0' }}>{job.retry_count || 0} kali</td>
              </tr>
              <tr>
                <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Google Drive Folder</td>
                <td style={{ padding: '6px 0' }}>
                  {job.gdrive_folder_url ? (
                    <a href={job.gdrive_folder_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                      Buka Google Drive ➔
                    </a>
                  ) : '(Belum diunggah)'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-container">
          <div style={{ marginBottom: '16px' }}>
            <Link href="/sheets-autopilot" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>← Kembali ke Dashboard</span>
            </Link>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <span>⏳ Memuat detail kampanye...</span>
            </div>
          ) : error ? (
            <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
              <strong>Error:</strong> {error}
            </div>
          ) : (
            <div>
              {/* Campaign Header Details */}
              <div className="card" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h2 style={{ margin: 0 }}>{campaign.campaign_name}</h2>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        background: 'var(--accent-glow)', 
                        color: 'var(--accent-light)', 
                        padding: '2px 8px', 
                        borderRadius: '4px',
                        border: '1px solid var(--accent)'
                      }}>
                        {campaign.campaign_type === 'RE' ? '🎬 RE' : (campaign.campaign_type === 'OPC' ? '🌱 OPC' : '🚀 IFC')}
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
                      Campaign ID: {campaign.id}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <a 
                      href={`https://docs.google.com/spreadsheets/d/${campaign.spreadsheet_id}`} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '8px 14px' }}
                    >
                      🟢 Buka Google Spreadsheet ↗
                    </a>
                    <button 
                      onClick={fetchDetail} 
                      className="btn btn-primary"
                      style={{ fontSize: '0.8rem', padding: '8px 14px' }}
                    >
                      🔄 Refresh Data
                    </button>
                    {campaign?.enable_glabs === 1 && (
                      <button
                        id="btn-batch-repair-clip2"
                        onClick={handleBatchRepairClip2}
                        disabled={batchRepairing || selectedJobIds.size === 0}
                        className="btn btn-secondary"
                        style={{
                          fontSize: '0.8rem',
                          padding: '8px 14px',
                          borderColor: selectedJobIds.size > 0 ? 'var(--warning)' : 'var(--border)',
                          color: selectedJobIds.size > 0 ? 'var(--warning)' : 'var(--text-muted)',
                          background: selectedJobIds.size > 0 ? 'rgba(253, 203, 110, 0.08)' : 'transparent',
                          cursor: (batchRepairing || selectedJobIds.size === 0) ? 'not-allowed' : 'pointer',
                          opacity: (batchRepairing || selectedJobIds.size === 0) ? 0.6 : 1,
                        }}
                      >
                        {batchRepairing
                          ? '⏳ Batch Re-aligning...'
                          : selectedJobIds.size > 0
                            ? `🔧 Batch Re-align Klip 2 (${selectedJobIds.size} dipilih)`
                            : '🔧 Batch Re-align Klip 2'
                        }
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '20px', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Target Language:</span> <strong style={{ color: '#fff' }}>{campaign.target_language}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Aspect Ratio:</span> <strong style={{ color: '#fff' }}>{campaign.aspect_ratio}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Visual Mode:</span> <strong style={{ color: '#fff' }}>{campaign.visual_mode}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Product Bridging:</span>{' '}
                    <strong style={{ color: campaign.is_bridging_active === 1 ? 'var(--success)' : 'var(--text-muted)' }}>
                      {campaign.is_bridging_active === 1 ? 'Active' : 'Inactive'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="stats-grid" style={{ marginBottom: '24px' }}>
                <div className="stat-card">
                  <div className="stat-label">Total Baris</div>
                  <div className="stat-value" style={{ color: 'var(--text-primary)' }}>{totalJobs}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Sukses (Completed)</div>
                  <div className="stat-value success">{completedJobs}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Gagal (Failed)</div>
                  <div className="stat-value danger">{failedJobs}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Sedang Diproses</div>
                  <div className="stat-value info" style={{ animation: processingJobs > 0 ? 'pulse-glow 1.5s infinite alternate' : 'none' }}>{processingJobs}</div>
                </div>
              </div>

              {/* Batch Repair Results Panel */}
              {batchRepairResults && (
                <div className="card" style={{ marginBottom: '24px', borderColor: batchRepairResults.failCount > 0 ? 'var(--warning)' : 'var(--success)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                      🔧 Hasil Batch Re-align Klip 2
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      ✅ {batchRepairResults.successCount} sukses &nbsp;|&nbsp; ❌ {batchRepairResults.failCount} gagal &nbsp;|&nbsp; Total: {batchRepairResults.totalProcessed}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '260px', overflowY: 'auto' }}>
                    {(batchRepairResults.results || []).map((r, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        background: r.success ? 'rgba(0,184,148,0.07)' : 'rgba(225,112,85,0.07)',
                        border: `1px solid ${r.success ? 'rgba(0,184,148,0.25)' : 'rgba(225,112,85,0.25)'}`,
                        fontSize: '0.78rem',
                      }}>
                        <span>{r.success ? '✅' : '❌'}</span>
                        <div>
                          <strong>{r.batchId || r.jobId}</strong>
                          {r.success
                            ? <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>"{r.newNarration}"</span>
                            : <span style={{ color: 'var(--danger)', marginLeft: '8px' }}>{r.error}</span>
                          }
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setBatchRepairResults(null)}
                    style={{ marginTop: '10px', fontSize: '0.75rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Tutup panel ini
                  </button>
                </div>
              )}

              {/* Job Execution List */}
              <div className="card">
                <div className="card-title" style={{ marginBottom: '16px' }}>
                  Riwayat Pekerjaan Baris (Row Jobs)
                </div>

                {jobs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                    Belum ada baris spreadsheet dari kampanye ini yang diproses oleh Autopilot poller.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                          <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', width: '36px' }}>
                            <input
                              type="checkbox"
                              title="Pilih / hapus semua"
                              onChange={toggleSelectAll}
                              checked={jobs.length > 0 && jobs.every(j => selectedJobIds.has(j.id))}
                              style={{ cursor: 'pointer', accentColor: 'var(--warning)' }}
                            />
                          </th>
                          <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Row Index</th>
                          <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Batch ID</th>
                          <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Topik / URL Sumber</th>
                          <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Status</th>
                          <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Aset Kreatif</th>
                          <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Folder Drive</th>
                          <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', textAlign: 'center' }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobs.map(job => {
                          const badge = getStatusBadgeColor(job.status);
                          const activeTab = activeTabs[job.id] || 'storyboard';
                          return (
                            <Fragment key={job.id}>
                              <tr style={{ borderBottom: '1px solid var(--border)', background: selectedJobIds.has(job.id) ? 'rgba(253,203,110,0.04)' : 'transparent' }}>
                                <td style={{ padding: '14px 8px' }}>
                                  <input
                                    type="checkbox"
                                    checked={selectedJobIds.has(job.id)}
                                    onChange={() => toggleSelectJob(job.id)}
                                    style={{ cursor: 'pointer', accentColor: 'var(--warning)' }}
                                  />
                                </td>
                                <td style={{ padding: '14px 8px', fontWeight: 'bold' }}>#{job.row_index}</td>
                                <td style={{ padding: '14px 8px', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{job.batch_id}</td>
                                <td style={{ padding: '14px 8px', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {job.url_or_topic.startsWith('http') ? (
                                    <a href={job.url_or_topic} target="_blank" rel="noreferrer" style={{ color: 'var(--info)' }}>
                                      {job.url_or_topic}
                                    </a>
                                  ) : job.url_or_topic}
                                </td>
                                <td style={{ padding: '14px 8px' }}>
                                  <span style={{
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    background: badge.bg,
                                    color: badge.color,
                                    border: badge.border,
                                    fontSize: '0.72rem',
                                    fontWeight: '600',
                                    textTransform: 'uppercase',
                                    display: 'inline-block',
                                    animation: badge.pulse ? 'active-pulse 1.5s infinite alternate' : 'none'
                                  }}>
                                    {job.status}
                                  </span>
                                </td>
                                <td style={{ padding: '14px 8px' }}>
                                  {(job.storyboard || job.voiceover) ? (
                                    <button 
                                      className="btn btn-secondary"
                                      onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                                      style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                                    >
                                      {expandedJobId === job.id ? '📖 Tutup Detail' : '📖 Detail'}
                                    </button>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)' }}>Belum ada</span>
                                  )}
                                </td>
                                <td style={{ padding: '14px 8px' }}>
                                  {job.gdrive_folder_url ? (
                                    <a 
                                      href={job.gdrive_folder_url} 
                                      target="_blank" 
                                      rel="noreferrer"
                                      className="btn btn-secondary"
                                      style={{ padding: '4px 10px', fontSize: '0.72rem', borderColor: 'var(--success)', color: 'var(--success)' }}
                                    >
                                      📂 Buka Drive ↗
                                    </a>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                                  )}
                                </td>
                                <td style={{ padding: '14px 8px', textAlign: 'center' }}>
                                  {(job.status === 'completed' || job.status === 'failed') ? (
                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                      <button
                                        className="btn btn-secondary"
                                        onClick={() => handleRetryJob(job.row_index, false)}
                                        disabled={retryLoading[`${job.row_index}-false`] || retryLoading[`${job.row_index}-true`]}
                                        style={{ 
                                          padding: '4px 8px', 
                                          fontSize: '0.72rem', 
                                          display: 'inline-flex', 
                                          alignItems: 'center', 
                                          gap: '4px',
                                          cursor: (retryLoading[`${job.row_index}-false`] || retryLoading[`${job.row_index}-true`]) ? 'not-allowed' : 'pointer'
                                        }}
                                      >
                                        {retryLoading[`${job.row_index}-false`] ? '⏳ Loading...' : '🔄 Retry'}
                                      </button>
                                      <button
                                        className="btn btn-secondary"
                                        onClick={() => handleRetryJob(job.row_index, true)}
                                        disabled={retryLoading[`${job.row_index}-false`] || retryLoading[`${job.row_index}-true`]}
                                        style={{ 
                                          padding: '4px 8px', 
                                          fontSize: '0.72rem', 
                                          display: 'inline-flex', 
                                          alignItems: 'center', 
                                          gap: '4px',
                                          borderColor: 'rgba(225,112,85,0.4)',
                                          color: 'var(--danger)',
                                          cursor: (retryLoading[`${job.row_index}-false`] || retryLoading[`${job.row_index}-true`]) ? 'not-allowed' : 'pointer'
                                        }}
                                      >
                                        {retryLoading[`${job.row_index}-true`] ? '⏳ Loading...' : '🗑️ Reset'}
                                      </button>
                                    </div>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>—</span>
                                  )}
                                </td>
                              </tr>

                              {expandedJobId === job.id && (
                                <tr>
                                  <td colSpan="7" style={{ background: 'var(--bg-secondary)', padding: '24px', borderTop: 'none', borderBottom: '1px solid var(--border)' }}>
                                    <div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 12 }}>
                                        <div>
                                          <strong style={{ fontSize: '1.1rem' }}>Workspace Baris #{job.row_index}</strong>
                                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 8 }}>
                                            (Batch ID: {job.batch_id})
                                          </span>
                                        </div>
                                        <span className="badge" style={{ background: badge.bg, color: badge.color, border: badge.border, textTransform: 'uppercase', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                                          {job.status}
                                        </span>
                                      </div>

                                      {/* Media Paths if available */}
                                      {(job.local_video_path || job.local_audio_path) && (
                                        <div style={{ 
                                          display: 'flex', 
                                          flexDirection: 'column',
                                          gap: '16px',
                                          background: 'rgba(255,255,255,0.01)',
                                          border: '1px solid var(--border)',
                                          borderRadius: '8px',
                                          padding: '16px',
                                          marginBottom: '20px'
                                        }}>
                                          {job.local_audio_path && (
                                            <div>
                                              <strong style={{ fontSize: '0.75rem', display: 'block', marginBottom: '6px', color: 'var(--text-secondary)' }}>🎙️ Audio Voiceover Utama (Muxed)</strong>
                                              <audio src={job.local_audio_path} controls style={{ width: '100%' }} />
                                            </div>
                                          )}
                                          {job.local_video_path && (
                                            <div>
                                              <strong style={{ fontSize: '0.75rem', display: 'block', marginBottom: '6px', color: 'var(--text-secondary)' }}>🎬 Video Final Tergabung (Muxed)</strong>
                                              <video src={job.local_video_path} controls style={{ width: '100%', maxHeight: '280px', borderRadius: '6px', background: '#000' }} />
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      <div style={{ marginTop: 16 }}>
                                        {/* Tab Headers */}
                                        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: 8, marginBottom: 16, overflowX: 'auto' }}>
                                          {[
                                            { id: 'storyboard', label: '📖 Storyboard' },
                                            { id: 'voiceover', label: '🎤 Voiceover' },
                                            { id: 'prompts', label: '🤖 AI Video Prompt' },
                                            { id: 'social', label: '📱 Social Draft' },
                                            { id: 'logs', label: '🖥 System Log' }
                                          ].map(t => (
                                            <button
                                              key={t.id}
                                              className={`btn ${activeTab === t.id ? 'btn-primary' : 'btn-secondary'}`}
                                              onClick={() => setActiveTabs(prev => ({ ...prev, [job.id]: t.id }))}
                                              style={{ 
                                                padding: '6px 12px', 
                                                fontSize: '0.78rem',
                                                borderBottom: activeTab === t.id ? '2px solid var(--accent)' : 'none',
                                                background: activeTab === t.id ? 'var(--accent)' : 'transparent',
                                                color: '#fff',
                                                borderColor: 'transparent',
                                                whiteSpace: 'nowrap'
                                              }}
                                            >
                                              {t.label}
                                            </button>
                                          ))}
                                        </div>

                                        {/* Tab Content */}
                                        <div style={{ minHeight: '150px' }}>
                                          {activeTab === 'storyboard' && renderStoryboard(job)}
                                          {activeTab === 'voiceover' && (
                                            <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                              <p>Data voiceover tersedia melalui pipeline TTS. Lihat System Log untuk detail audio.</p>
                                              {job.tts_audio_path && (
                                                <div style={{ marginTop: 12 }}>
                                                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Audio Preview</label>
                                                  <audio controls src={job.tts_audio_path} style={{ width: '100%' }} />
                                                </div>
                                              )}
                                            </div>
                                          )}
                                          {activeTab === 'prompts' && renderPrompts(job)}
                                          {activeTab === 'social' && renderSocial(job)}
                                          {activeTab === 'logs' && renderLogs(job)}
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

            </div>
          )}

        </div>
      </main>
    </div>
  );
}

