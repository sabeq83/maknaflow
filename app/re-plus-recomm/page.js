'use client';

import Sidebar from '../components/Sidebar';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

const GEMINI_VOICES = [
  { id: 'Kore', name: 'Kore (Female)', avatar: '👩', desc: 'Standard Female (Skincare/Cosmetic)' },
  { id: 'Fenrir', name: 'Fenrir (Male)', avatar: '🧔', desc: 'Deep/Heavy Male (Otomotif/High-End)' },
  { id: 'Puck', name: 'Puck (Male)', avatar: '👦', desc: 'Ceria, Playful (Makanan/Promo Kilat)' },
  { id: 'Charon', name: 'Charon (Male)', avatar: '👨', desc: 'Formal, News Style (Review Tech/Finansial)' },
  { id: 'Leda', name: 'Leda (Female)', avatar: '👵', desc: 'Hangat, Ramah (Edukasi/Ibu Anak)' },
  { id: 'Zephyr', name: 'Zephyr (Male)', avatar: '👨', desc: 'Kasual, Santai (Storytelling/Daily Vlog)' },
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

export default function REPlusRecommPage() {
  const router = useRouter();

  // Job Listing & Details
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [outputs, setOutputs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Job Creation Form
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newUrlsText, setNewUrlsText] = useState('');
  const [newRecommCount, setNewRecommCount] = useState(3);
  const [submittingJob, setSubmittingJob] = useState(false);

  // Editing States
  const [editingOutputId, setEditingOutputId] = useState(null);
  const [editFields, setEditFields] = useState({
    recommended_product_name: '',
    short_description: '',
    unique_selling_point: ''
  });
  const [editImageFile, setEditImageFile] = useState(null);
  const [updatingOutput, setUpdatingOutput] = useState(false);

  // Dispatch Settings Modal
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchTargetOutput, setDispatchTargetOutput] = useState(null);
  const [dispatchOptions, setDispatchOptions] = useState({
    campaign_name: '',
    aspect_ratio: '9:16',
    target_ai: 'Google Veo (8s)',
    video_model: 'veo_31_lite',
    custom_instruction: '',
    promotion_style: 'Softselling',
    voice_provider: 'gemini',
    voice_persona: 'Kore',
    voice_speed: 1.0,
    voice_volume: 1.0,
    ffmpeg_sync_option: 'smart_sync',
    ffmpeg_video_scale: 1.0,
    ffmpeg_sfx_volume: 0.0,
    ffmpeg_bgm_volume: 0.15,
    words_per_clip: '17-19 kata',
    face_visibility: 'Faceless',
    enable_tts: true,
    enable_ffmpeg: true,
    enable_social_post: true,
    target_clips_count: 5,
    bridge_at_clip: 3,
    post_youtube_draft: false,
    post_tiktok_draft: false,
    post_facebook_draft: false,
    tts_model_quality: 'speech-2.8-turbo'
  });
  const [dispatching, setDispatching] = useState(false);

  // UI Toast
  const [toast, setToast] = useState(null);

  // Poll Ref for Active Jobs
  const pollingRef = useRef(null);

  // Fetch Jobs list
  const fetchJobs = async (silent = false) => {
    if (!silent) setLoadingJobs(true);
    try {
      const res = await fetch('/api/v2/re-plus-recomm/jobs');
      const data = await res.json();
      if (data.success) {
        setJobs(data.jobs || []);
      }
    } catch (e) {
      showToast('Gagal memuat daftar pekerjaan sourcing', 'error');
    } finally {
      if (!silent) setLoadingJobs(false);
    }
  };

  // Fetch job outputs and details
  const fetchJobDetails = async (jobId, silent = false) => {
    if (!silent) setLoadingDetails(true);
    try {
      const res = await fetch(`/api/v2/re-plus-recomm/jobs/${jobId}`);
      const data = await res.json();
      if (data.success) {
        setSelectedJob(data.job);
        setOutputs(data.outputs || []);
      }
    } catch (e) {
      showToast('Gagal memuat rincian pekerjaan sourcing', 'error');
    } finally {
      if (!silent) setLoadingDetails(false);
    }
  };

  // Toast Helper
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Initial Fetch
  useEffect(() => {
    fetchJobs();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Poll active job status if it is not completed or failed
  useEffect(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    if (selectedJob && ['pending', 'scraping', 'analyzing'].includes(selectedJob.status)) {
      pollingRef.current = setInterval(() => {
        fetchJobDetails(selectedJob.id, true);
        fetchJobs(true);
      }, 4000);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [selectedJob?.status]);

  // Handle Job submission
  const handleCreateJob = async (e) => {
    e.preventDefault();
    if (!newCampaignName.trim() || !newUrlsText.trim()) {
      showToast('Nama Kampanye dan URL Kompetitor wajib diisi', 'error');
      return;
    }

    const urls = newUrlsText
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0);

    if (urls.length === 0) {
      showToast('Masukkan setidaknya satu URL kompetitor yang valid', 'error');
      return;
    }

    setSubmittingJob(true);
    try {
      const res = await fetch('/api/v2/re-plus-recomm/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_name: newCampaignName,
          source_urls: urls,
          target_recommendations_count: Number(newRecommCount)
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Pekerjaan Sourcing Grounding berhasil dimasukkan ke Antrean!');
        setNewCampaignName('');
        setNewUrlsText('');
        fetchJobs();
        // Load details for the newly created job
        fetchJobDetails(data.job_id);
      } else {
        showToast(data.error || 'Gagal memulai pekerjaan sourcing', 'error');
      }
    } catch (err) {
      showToast('Gagal memulai pekerjaan sourcing', 'error');
    } finally {
      setSubmittingJob(false);
    }
  };

  // Handle Job deletion
  const handleDeleteJob = async (jobId, e) => {
    e.stopPropagation();
    if (!confirm('Apakah Anda yakin ingin menghapus pekerjaan sourcing ini beserta gambar-gambarnya?')) return;

    try {
      const res = await fetch(`/api/v2/re-plus-recomm/jobs/${jobId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Pekerjaan sourcing berhasil dihapus');
        if (selectedJob?.id === jobId) {
          setSelectedJob(null);
          setOutputs([]);
        }
        fetchJobs();
      } else {
        showToast(data.error || 'Gagal menghapus pekerjaan sourcing', 'error');
      }
    } catch (err) {
      showToast('Gagal menghapus pekerjaan sourcing', 'error');
    }
  };

  // Toggle Edit Output inline
  const startEditing = (output) => {
    setEditingOutputId(output.id);
    setEditFields({
      recommended_product_name: output.recommended_product_name,
      short_description: output.short_description,
      unique_selling_point: output.unique_selling_point
    });
    setEditImageFile(null);
  };

  // Submit edit fields & photo upload
  const handleSaveOutputEdit = async (outputId) => {
    setUpdatingOutput(true);
    try {
      const formData = new FormData();
      formData.append('recommended_product_name', editFields.recommended_product_name);
      formData.append('short_description', editFields.short_description);
      formData.append('unique_selling_point', editFields.unique_selling_point);
      if (editImageFile) {
        formData.append('image_file', editImageFile);
      }

      const res = await fetch(`/api/v2/re-plus-recomm/outputs/${outputId}`, {
        method: 'PUT',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        showToast('Metadata rekomendasi produk berhasil diperbarui!');
        setEditingOutputId(null);
        setEditImageFile(null);
        // Refresh details
        if (selectedJob) fetchJobDetails(selectedJob.id, true);
      } else {
        showToast(data.error || 'Gagal menyimpan perubahan', 'error');
      }
    } catch (err) {
      showToast('Gagal menyimpan perubahan', 'error');
    } finally {
      setUpdatingOutput(false);
    }
  };

  // Open dispatch options modal
  const openDispatchDialog = (output) => {
    setDispatchTargetOutput(output);
    setDispatchOptions(prev => ({
      ...prev,
      campaign_name: `${selectedJob.campaign_name} - ${output.recommended_product_name}`
    }));
    setShowDispatchModal(true);
  };

  // Trigger dispatching to hybrid lock campaign
  const handleDispatch = async () => {
    if (!dispatchTargetOutput) return;
    setDispatching(true);
    try {
      const res = await fetch(`/api/v2/re-plus-recomm/outputs/${dispatchTargetOutput.id}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dispatchOptions)
      });
      const data = await res.json();
      if (data.success) {
        showToast('Rekomendasi berhasil dideploy ke RE Hybrid! Memulai perenderan...');
        setShowDispatchModal(false);
        setDispatchTargetOutput(null);
        // Redirect to Campaigns list
        router.push('/re-campaigns');
      } else {
        showToast(data.error || 'Gagal mengirimkan kampanye', 'error');
      }
    } catch (err) {
      showToast('Gagal meluncurkan kampanye ke RE Engine', 'error');
    } finally {
      setDispatching(false);
    }
  };

  // Render first deconstruction video report safely
  const renderDeconstruction = () => {
    if (outputs.length === 0) return null;
    const outputWithDeconstruction = outputs.find(o => o.video_deconstruction_json);
    if (!outputWithDeconstruction) return null;

    let deconstruction = {};
    try {
      deconstruction = JSON.parse(outputWithDeconstruction.video_deconstruction_json);
    } catch (e) {
      return null;
    }

    return (
      <div className="card" style={{ marginBottom: 24, background: 'rgba(108,92,231,0.04)', borderColor: 'rgba(108,92,231,0.2)' }}>
        <div className="card-title" style={{ color: 'var(--accent-light)', marginBottom: 12 }}>
          <span className="icon">🧠</span> Analisis Kompetitor (Video Deconstruction)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.9rem' }}>
          <div>
            <strong style={{ color: 'var(--text-primary)', display: 'block' }}>🎯 Pain Point / Kebutuhan Target:</strong>
            <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{deconstruction.target_pain_point || 'Kebutuhan umum e-commerce'}</p>
          </div>
          <div>
            <strong style={{ color: 'var(--text-primary)', display: 'block' }}>🪝 Sudut Pandang Hook Promosi:</strong>
            <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{deconstruction.promotional_hook || 'Hook visual produk'}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content" style={{ display: 'flex', padding: 0 }}>
        
        {/* LEFT PANEL: Jobs & Controls */}
        <div style={{
          width: 380,
          borderRight: '1px solid var(--border)',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-secondary)',
          overflowY: 'auto'
        }}>
          {/* Header */}
          <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>💡+</span> RE Plus Recomm
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Autonomous Product Discovery Gateway (MAKNA V8.2)
            </p>
          </div>

          {/* Creation Form */}
          <div style={{ padding: 20, borderBottom: '1px solid var(--border)' }}>
            <form onSubmit={handleCreateJob}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.72rem' }}>Nama Kampanye</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Contoh: Skincare Grounding Mei"
                  value={newCampaignName}
                  onChange={e => setNewCampaignName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.72rem' }}>URL Video Kompetitor (Satu per baris)</label>
                <textarea
                  className="form-textarea"
                  placeholder="https://tiktok.com/@kompetitor/video/..."
                  style={{ minHeight: 70, fontSize: '0.8rem' }}
                  value={newUrlsText}
                  onChange={e => setNewUrlsText(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontSize: '0.72rem' }}>Jumlah Temuan per Video</label>
                <select
                  className="form-input"
                  value={newRecommCount}
                  onChange={e => setNewRecommCount(Number(e.target.value))}
                >
                  <option value={1}>1 Rekomendasi</option>
                  <option value={2}>2 Rekomendasi</option>
                  <option value={3}>3 Rekomendasi</option>
                  <option value={4}>4 Rekomendasi</option>
                  <option value={5}>5 Rekomendasi</option>
                </select>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={submittingJob}
                style={{ fontSize: '0.82rem', padding: '10px 14px' }}
              >
                {submittingJob ? 'Mendaftarkan Sourcing...' : '⚡ Jalankan Sourcing Grounding'}
              </button>
            </form>
          </div>

          {/* Jobs List */}
          <div style={{ flex: 1, padding: '16px 20px' }}>
            <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>
              Daftar Pekerjaan Discovery
            </h3>

            {loadingJobs ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Memuat daftar...
              </div>
            ) : jobs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 10px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Belum ada pekerjaan. Masukkan detail di atas untuk memulai.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {jobs.map(j => {
                  const isSelected = selectedJob?.id === j.id;
                  let statusColor = 'var(--text-muted)';
                  let statusBg = 'rgba(255,255,255,0.06)';
                  if (j.status === 'completed') {
                    statusColor = 'var(--success)';
                    statusBg = 'var(--success-glow)';
                  } else if (j.status === 'scraping' || j.status === 'analyzing') {
                    statusColor = 'var(--info)';
                    statusBg = 'rgba(116,185,255,0.15)';
                  } else if (j.status === 'failed') {
                    statusColor = 'var(--danger)';
                    statusBg = 'var(--danger-glow)';
                  }

                  return (
                    <div
                      key={j.id}
                      onClick={() => fetchJobDetails(j.id)}
                      style={{
                        padding: 14,
                        borderRadius: 'var(--radius-sm)',
                        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                        background: isSelected ? 'var(--bg-glass)' : 'rgba(255,255,255,0.01)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        position: 'relative'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <strong style={{ fontSize: '0.88rem', color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: 220 }}>
                          {j.campaign_name}
                        </strong>
                        <button
                          onClick={(e) => handleDeleteJob(j.id, e)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                          }}
                          title="Hapus Pekerjaan"
                        >
                          ✕
                        </button>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: statusColor,
                          background: statusBg,
                          padding: '2px 8px',
                          borderRadius: 12
                        }}>
                          {j.status}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {new Date(j.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Discovery Lab workspace */}
        <div style={{ flex: 1, padding: 32, overflowY: 'auto', height: '100vh' }}>
          {toast && (
            <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`} style={{ zIndex: 1100 }}>
              {toast.msg}
            </div>
          )}

          {!selectedJob ? (
            <div className="empty-state" style={{ marginTop: '10vh' }}>
              <div className="empty-icon">💡</div>
              <h3>Belum Ada Pekerjaan Sourcing Terpilih</h3>
              <p>Silakan buat pekerjaan sourcing baru di menu sebelah kiri atau pilih salah satu pekerjaan dari daftar untuk mengelola produk grounding.</p>
            </div>
          ) : (
            <div>
              {/* Job Header Info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: '1.6rem', fontWeight: 700 }}>{selectedJob.campaign_name}</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 4 }}>
                    Job ID: <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{selectedJob.id}</code> &bull; Dibuat pada {new Date(selectedJob.created_at).toLocaleString('id-ID')}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Status:</span>
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '6px 14px',
                    borderRadius: 20,
                    background: selectedJob.status === 'completed' ? 'var(--success-glow)' : 'rgba(255,255,255,0.06)',
                    color: selectedJob.status === 'completed' ? 'var(--success)' : 'var(--text-secondary)'
                  }}>
                    {selectedJob.status}
                  </span>
                </div>
              </div>

              {/* Progress Card for Non-Completed States */}
              {['pending', 'scraping', 'analyzing'].includes(selectedJob.status) && (
                <div className="card" style={{ padding: 40, textAlign: 'center', marginBottom: 24 }}>
                  <div className="spinner" style={{ margin: '0 auto 20px' }}></div>
                  <h3 style={{ marginBottom: 8 }}>Sedang Memproses Discovery Grounding...</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: 450, margin: '0 auto' }}>
                    Sistem sedang mengunduh video kompetitor, mengunggah ke Gemini, serta melakukan Google Search Grounding untuk merekomendasikan produk e-commerce Indonesia (Shopee/Tokopedia).
                  </p>
                  <div style={{ marginTop: 16, fontSize: '0.8rem', color: 'var(--accent-light)', fontFamily: 'var(--font-mono)' }}>
                    Fase Saat Ini: <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{selectedJob.status}</span>
                  </div>
                </div>
              )}

              {/* Failed Job Card */}
              {selectedJob.status === 'failed' && (
                <div className="card" style={{ padding: 32, borderColor: 'var(--danger)', background: 'var(--danger-glow)', marginBottom: 24 }}>
                  <h3 style={{ color: 'var(--danger)', marginBottom: 8 }}>Proses Sourcing Gagal</h3>
                  <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                    Kesalahan terjadi saat menjalankan AI Grounding Pipeline. Pastikan kunci API Gemini Anda aktif dan koneksi internet stabil.
                  </p>
                </div>
              )}

              {/* Completed Sourcing Screen */}
              {selectedJob.status === 'completed' && (
                <div>
                  {/* Deconstruction Report section */}
                  {renderDeconstruction()}

                  {/* Recommendations Header */}
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>🛍️</span> Hasil Temuan Rekomendasi Produk ({outputs.length})
                  </h3>

                  {outputs.length === 0 ? (
                    <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                      Tidak ditemukan rekomendasi produk untuk video ini.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      {outputs.map(out => {
                        const isEditing = editingOutputId === out.id;

                        return (
                          <div key={out.id} className="card" style={{ display: 'flex', gap: 24, position: 'relative' }}>
                            
                            {/* Product Reference Image Frame */}
                            <div style={{ width: 140, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                              <div style={{
                                width: 140,
                                height: 140,
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border)',
                                overflow: 'hidden',
                                background: '#000',
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                <img
                                  src={out.local_image_path || '/placeholder-product.png'}
                                  alt={out.recommended_product_name}
                                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = '/placeholder-product.png';
                                  }}
                                />
                              </div>

                              {isEditing ? (
                                <div style={{ width: '100%' }}>
                                  <label className="btn btn-secondary btn-sm btn-block" style={{ fontSize: '0.72rem', cursor: 'pointer', padding: '4px 8px', justifyContent: 'center' }}>
                                    <span>📁 Ganti Foto</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      style={{ display: 'none' }}
                                      onChange={(e) => setEditImageFile(e.target.files?.[0] || null)}
                                    />
                                  </label>
                                  {editImageFile && (
                                    <div style={{ fontSize: '0.65rem', color: 'var(--success)', marginTop: 4, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', textAlign: 'center' }}>
                                      ✓ {editImageFile.name}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <a
                                  href={out.scraped_image_url || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ fontSize: '0.72rem', color: 'var(--accent-light)', textDecoration: 'none' }}
                                >
                                  🔗 Lihat Source CDN
                                </a>
                              )}
                            </div>

                            {/* Product Form Content Area */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                              {isEditing ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                  <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.72rem' }}>Nama Produk</label>
                                    <input
                                      type="text"
                                      className="form-input"
                                      value={editFields.recommended_product_name}
                                      onChange={e => setEditFields(prev => ({ ...prev, recommended_product_name: e.target.value }))}
                                    />
                                  </div>
                                  <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.72rem' }}>Deskripsi Singkat</label>
                                    <textarea
                                      className="form-textarea"
                                      style={{ minHeight: 50, fontSize: '0.85rem' }}
                                      value={editFields.short_description}
                                      onChange={e => setEditFields(prev => ({ ...prev, short_description: e.target.value }))}
                                    />
                                  </div>
                                  <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.72rem' }}>Unique Selling Point (USP)</label>
                                    <input
                                      type="text"
                                      className="form-input"
                                      value={editFields.unique_selling_point}
                                      onChange={e => setEditFields(prev => ({ ...prev, unique_selling_point: e.target.value }))}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <h4 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                                    {out.recommended_product_name}
                                  </h4>
                                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 12 }}>
                                    {out.short_description}
                                  </p>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: 6, fontSize: '0.8rem' }}>
                                    <span style={{ color: 'var(--warning)' }}>★ USP:</span>
                                    <span style={{ color: 'var(--text-primary)', fontWeight: 550 }}>{out.unique_selling_point}</span>
                                  </div>
                                  
                                  {/* Comp URL source */}
                                  <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    Di-grounding dari kompetitor: <a href={out.source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>{out.source_url}</a>
                                  </div>
                                </div>
                              )}

                              {/* Form Action Controls */}
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                                {isEditing ? (
                                  <>
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => setEditingOutputId(null)}
                                      disabled={updatingOutput}
                                    >
                                      Batal
                                    </button>
                                    <button
                                      className="btn btn-success btn-sm"
                                      onClick={() => handleSaveOutputEdit(out.id)}
                                      disabled={updatingOutput}
                                    >
                                      {updatingOutput ? 'Menyimpan...' : '✓ Simpan Perubahan'}
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => startEditing(out)}
                                    >
                                      ✏️ Sunting Detail
                                    </button>
                                    <button
                                      className="btn btn-primary btn-sm"
                                      onClick={() => openDispatchDialog(out)}
                                    >
                                      🚀 Deploy ke RE Hybrid
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* DISPATCH CONFIGURATION MODAL */}
      {showDispatchModal && dispatchTargetOutput && (
        <div className="modal-backdrop" onClick={() => setShowDispatchModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 800 }}>
            <div className="modal-header">
              <h3>🚀 Dispatch ke RE Hybrid (Double-Pass I2V)</h3>
              <button className="modal-close" onClick={() => setShowDispatchModal(false)}>✕</button>
            </div>

            <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: 8 }}>
              {/* Product Info Preview */}
              <div style={{ display: 'flex', gap: 16, background: 'var(--bg-primary)', padding: 14, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 20 }}>
                <div style={{ width: 60, height: 60, borderRadius: 4, overflow: 'hidden', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={dispatchTargetOutput.local_image_path || '/placeholder-product.png'} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                </div>
                <div>
                  <strong style={{ fontSize: '0.9rem', display: 'block' }}>{dispatchTargetOutput.recommended_product_name}</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginTop: 2 }}>{dispatchTargetOutput.short_description}</span>
                </div>
              </div>

              {/* Form Options */}
              <div className="form-group">
                <label className="form-label">Nama Kampanye Baru</label>
                <input
                  type="text"
                  className="form-input"
                  value={dispatchOptions.campaign_name}
                  onChange={e => setDispatchOptions(prev => ({ ...prev, campaign_name: e.target.value }))}
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Rasio Aspek Video</label>
                  <select
                    className="form-input"
                    value={dispatchOptions.aspect_ratio}
                    onChange={e => setDispatchOptions(prev => ({ ...prev, aspect_ratio: e.target.value }))}
                  >
                    <option value="9:16">Portrait (9:16) - TikTok/Reels</option>
                    <option value="16:9">Landscape (16:9) - YouTube</option>
                    <option value="1:1">Square (1:1) - Feed Instagram</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Model Video Gen</label>
                  <select
                    className="form-input"
                    value={dispatchOptions.video_model}
                    onChange={e => setDispatchOptions(prev => ({ ...prev, video_model: e.target.value }))}
                  >
                    <option value="veo_31_lite">Google Veo 3.1 Lite (Double Pass I2V)</option>
                  </select>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Jumlah Klip Video</label>
                  <input
                    type="number"
                    className="form-input"
                    min="1"
                    max="10"
                    value={dispatchOptions.target_clips_count}
                    onChange={e => setDispatchOptions(prev => ({ ...prev, target_clips_count: Number(e.target.value) }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Klip Mulai Hybrid Lock (I2V)</label>
                  <input
                    type="number"
                    className="form-input"
                    min="1"
                    max={dispatchOptions.target_clips_count}
                    value={dispatchOptions.bridge_at_clip}
                    onChange={e => setDispatchOptions(prev => ({ ...prev, bridge_at_clip: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Gaya Promosi</label>
                  <select
                    className="form-input"
                    value={dispatchOptions.promotion_style}
                    onChange={e => setDispatchOptions(prev => ({ ...prev, promotion_style: e.target.value }))}
                  >
                    <option value="Softselling">Softselling (Storytelling & Narasi Edukatif)</option>
                    <option value="Hardselling">Hardselling (Call to Action Agresif & Promo)</option>
                    <option value="Review">Review (Bedah USP & Pembuktian Manfaat)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Visibilitas Wajah</label>
                  <select
                    className="form-input"
                    value={dispatchOptions.face_visibility}
                    onChange={e => setDispatchOptions(prev => ({ ...prev, face_visibility: e.target.value }))}
                  >
                    <option value="Faceless">Faceless (Hanya tangan/produk - Default)</option>
                    <option value="Avatar">Avatar AI (Menampilkan presenter AI)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Panjang Kata per Klip</label>
                <select
                  className="form-input"
                  value={dispatchOptions.words_per_clip}
                  onChange={e => setDispatchOptions(prev => ({ ...prev, words_per_clip: e.target.value }))}
                >
                  <option value="12-14 kata">12-14 kata (Sangat Pendek / Cepat)</option>
                  <option value="17-19 kata">17-19 kata (Sedang / Standar)</option>
                  <option value="22-25 kata">22-25 kata (Panjang / Padat)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Instruksi Kustom Tambahan</label>
                <textarea
                  className="form-textarea"
                  placeholder="Tambahkan kustom instruksi untuk perenderan AI..."
                  value={dispatchOptions.custom_instruction}
                  onChange={e => setDispatchOptions(prev => ({ ...prev, custom_instruction: e.target.value }))}
                />
              </div>

              {/* TTS & Audio Settings */}
              <div style={{ border: '1px solid var(--border)', padding: 16, borderRadius: 8, background: 'var(--bg-primary)', marginBottom: 16 }}>
                <strong style={{ fontSize: '0.9rem', display: 'block', marginBottom: 12 }}>🎙️ Pengaturan Suara & Narasi (TTS)</strong>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={dispatchOptions.enable_tts}
                      onChange={e => setDispatchOptions(prev => ({ ...prev, enable_tts: e.target.checked }))}
                    />
                    <span>Aktifkan Voiceover (TTS)</span>
                  </label>
                </div>

                {dispatchOptions.enable_tts && (
                  <>
                    <div className="form-grid">
                      <div className="form-group">
                        <label className="form-label">Provider TTS</label>
                        <select
                          className="form-input"
                          value={dispatchOptions.voice_provider}
                          onChange={e => {
                            const val = e.target.value;
                            setDispatchOptions(prev => ({
                              ...prev,
                              voice_provider: val,
                              voice_persona: val === 'gemini' ? 'Kore' : 'Indonesian_casual_reporter_vv2'
                            }));
                          }}
                        >
                          <option value="gemini">Gemini Voice (Premium & Alami)</option>
                          <option value="minimax">MiniMax Voice (Responsif & Cepat)</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Persona Pengisi Suara</label>
                        <select
                          className="form-input"
                          value={dispatchOptions.voice_persona}
                          onChange={e => setDispatchOptions(prev => ({ ...prev, voice_persona: e.target.value }))}
                        >
                          {(dispatchOptions.voice_provider === 'gemini' ? GEMINI_VOICES : MINIMAX_VOICES).map(v => (
                            <option key={v.id} value={v.id}>{v.name} - {v.desc}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {dispatchOptions.voice_provider === 'minimax' && (
                      <div className="form-group" style={{ marginTop: 12 }}>
                        <label className="form-label">Kualitas Model MiniMax</label>
                        <select
                          className="form-input"
                          value={dispatchOptions.tts_model_quality || 'speech-2.8-turbo'}
                          onChange={e => setDispatchOptions(prev => ({ ...prev, tts_model_quality: e.target.value }))}
                        >
                          <option value="speech-2.8-turbo">Turbo (speech-2.8-turbo)</option>
                          <option value="speech-2.8-hd">HD (speech-2.8-hd) - Mendukung Micro-Acting</option>
                        </select>
                      </div>
                    )}

                    <div className="form-grid">
                      <div className="form-group">
                        <label className="form-label">Kecepatan Suara ({dispatchOptions.voice_speed}x)</label>
                        <input
                          type="range"
                          min="0.6"
                          max="1.8"
                          step="0.1"
                          style={{ width: '100%' }}
                          value={dispatchOptions.voice_speed}
                          onChange={e => setDispatchOptions(prev => ({ ...prev, voice_speed: Number(e.target.value) }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Volume Suara ({dispatchOptions.voice_volume}x)</label>
                        <input
                          type="range"
                          min="0.2"
                          max="2.0"
                          step="0.1"
                          style={{ width: '100%' }}
                          value={dispatchOptions.voice_volume}
                          onChange={e => setDispatchOptions(prev => ({ ...prev, voice_volume: Number(e.target.value) }))}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* FFmpeg Studio & Social settings */}
              <div style={{ border: '1px solid var(--border)', padding: 16, borderRadius: 8, background: 'var(--bg-primary)' }}>
                <strong style={{ fontSize: '0.9rem', display: 'block', marginBottom: 12 }}>⚡ Alur Kerja & Rendering Muxer (FFmpeg)</strong>
                
                <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={dispatchOptions.enable_ffmpeg}
                      onChange={e => setDispatchOptions(prev => ({ ...prev, enable_ffmpeg: e.target.checked }))}
                    />
                    <span>Aktifkan Muxing FFmpeg</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={dispatchOptions.enable_social_post}
                      onChange={e => setDispatchOptions(prev => ({ ...prev, enable_social_post: e.target.checked }))}
                    />
                    <span>Draf Posting Medsos</span>
                  </label>
                </div>

                {dispatchOptions.enable_ffmpeg && (
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Volume BGM (Latar) - ({dispatchOptions.ffmpeg_bgm_volume})</label>
                      <input
                        type="range"
                        min="0.0"
                        max="0.8"
                        step="0.05"
                        style={{ width: '100%' }}
                        value={dispatchOptions.ffmpeg_bgm_volume}
                        onChange={e => setDispatchOptions(prev => ({ ...prev, ffmpeg_bgm_volume: Number(e.target.value) }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Zoom Scale Video ({dispatchOptions.ffmpeg_video_scale}x)</label>
                      <input
                        type="range"
                        min="0.8"
                        max="1.5"
                        step="0.05"
                        style={{ width: '100%' }}
                        value={dispatchOptions.ffmpeg_video_scale}
                        onChange={e => setDispatchOptions(prev => ({ ...prev, ffmpeg_video_scale: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowDispatchModal(false)}
                disabled={dispatching}
              >
                Batal
              </button>
              <button
                className="btn btn-primary"
                onClick={handleDispatch}
                disabled={dispatching}
              >
                {dispatching ? 'Men-deploy Kampanye...' : '🚀 Luncurkan Kampanye Hybrid'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
