'use client';

import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import './studio.css';

export default function VideoStudio() {
  // Video Inputs
  const [videoSourceType, setVideoSourceType] = useState('upload');
  const [videoFiles, setVideoFiles] = useState([]);
  const [videoDbIds, setVideoDbIds] = useState([]);
  const [videoSearch, setVideoSearch] = useState('');
  const [dbVideos, setDbVideos] = useState([]);
  // Sumber dari RE Campaign & Instant Factory
  const [reCampaignVideos, setReCampaignVideos] = useState([]);
  const [instantFactoryVideos, setInstantFactoryVideos] = useState([]);
  const [campaignVideoSearch, setCampaignVideoSearch] = useState('');
  const [selectedCampaignVideos, setSelectedCampaignVideos] = useState([]);

  // Audio Inputs
  const [audioSourceType, setAudioSourceType] = useState('upload');
  const [audioFile, setAudioFile] = useState(null);
  const [audioDbId, setAudioDbId] = useState('');
  const [audioSearch, setAudioSearch] = useState('');
  const [dbAudios, setDbAudios] = useState([]);
  const [ttsBatches, setTtsBatches] = useState([]);
  const [selectedTtsBatchId, setSelectedTtsBatchId] = useState('');

  // Rendering Settings
  const [syncOption, setSyncOption] = useState('shortest');
  const [bgmFile, setBgmFile] = useState('');
  const [bgmVolume, setBgmVolume] = useState(0.15);
  const [sfxVolume, setSfxVolume] = useState(0.0);
  const [videoScale, setVideoScale] = useState(1.0);

  // Status & List Management
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch DB assets
  useEffect(() => {
    fetchDbVideos();
  }, [videoSearch]);

  useEffect(() => {
    fetchDbAudios();
  }, [audioSearch]);

  useEffect(() => {
    fetchTtsBatches();
  }, []);

  useEffect(() => {
    fetchCampaignVideos();
  }, []);

  // Fetch jobs and poll
  useEffect(() => {
    fetchJobs();
    const interval = setInterval(() => {
      fetchJobs(true); // silent fetch
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Update selected job preview when jobs array is updated
  useEffect(() => {
    if (selectedJob) {
      const updated = jobs.find(j => j.id === selectedJob.id);
      if (updated && updated.status !== selectedJob.status) {
        setSelectedJob(updated);
      }
    }
  }, [jobs]);

  async function fetchDbVideos() {
    try {
      const res = await fetch(`/api/scraper/library?type=video&search=${encodeURIComponent(videoSearch)}`);
      const data = await res.json();
      if (data.success) {
        setDbVideos(data.data || []);
      }
    } catch (e) {
      console.error('Error fetching videos:', e);
    }
  }

  async function fetchDbAudios() {
    try {
      const res = await fetch(`/api/scraper/library?type=audio&search=${encodeURIComponent(audioSearch)}`);
      const data = await res.json();
      if (data.success) {
        setDbAudios(data.data || []);
      }
    } catch (e) {
      console.error('Error fetching audios:', e);
    }
  }

  async function fetchTtsBatches() {
    try {
      const res = await fetch('/api/tts-studio/completed-batches');
      const data = await res.json();
      if (data.success) {
        setTtsBatches(data.data || []);
      }
    } catch (e) {
      console.error('Error fetching tts batches:', e);
    }
  }

  async function fetchCampaignVideos() {
    try {
      const res = await fetch('/api/video-studio/campaign-videos');
      const data = await res.json();
      if (data.success) {
        setReCampaignVideos(data.data.re_campaign || []);
        setInstantFactoryVideos(data.data.instant_factory || []);
      }
    } catch (e) {
      console.error('Error fetching campaign videos:', e);
    }
  }

  async function fetchJobs(silent = false) {
    try {
      const res = await fetch('/api/video-studio/jobs');
      const data = await res.json();
      if (data.success) {
        setJobs(data.data || []);
        // Load the latest job as default selected preview on first load (non-silent)
        if (!silent && data.data && data.data.length > 0 && !selectedJob) {
          setSelectedJob(data.data[0]);
        }
      }
    } catch (e) {
      console.error('Error fetching jobs:', e);
    }
  }

  // Multi-Select Handlers
  const handleToggleCampaignVideo = (vid) => {
    setSelectedCampaignVideos(prev => {
      const exists = prev.find(v => v.id === vid.id);
      if (exists) {
        return prev.filter(v => v.id !== vid.id);
      } else {
        return [...prev, vid];
      }
    });
  };

  const handleSelectAllRe = () => {
    const q = campaignVideoSearch.toLowerCase();
    const filtered = reCampaignVideos.filter(v => !q || v.label.toLowerCase().includes(q) || v.campaign_name.toLowerCase().includes(q));
    setSelectedCampaignVideos(prev => {
      const toAdd = filtered.filter(fv => !prev.find(pv => pv.id === fv.id));
      return [...prev, ...toAdd];
    });
  };

  const handleClearAllRe = () => {
    const q = campaignVideoSearch.toLowerCase();
    const filtered = reCampaignVideos.filter(v => !q || v.label.toLowerCase().includes(q) || v.campaign_name.toLowerCase().includes(q));
    setSelectedCampaignVideos(prev => {
      return prev.filter(pv => !filtered.find(fv => fv.id === pv.id));
    });
  };

  const handleToggleInstantFactoryVideo = (vid) => {
    setSelectedCampaignVideos(prev => {
      const exists = prev.find(v => v.id === vid.id);
      if (exists) {
        return prev.filter(v => v.id !== vid.id);
      } else {
        return [...prev, vid];
      }
    });
  };

  const handleSelectAllIf = () => {
    const q = campaignVideoSearch.toLowerCase();
    const filtered = instantFactoryVideos.filter(v => !q || v.label.toLowerCase().includes(q) || v.campaign_name.toLowerCase().includes(q));
    setSelectedCampaignVideos(prev => {
      const toAdd = filtered.filter(fv => !prev.find(pv => pv.id === fv.id));
      return [...prev, ...toAdd];
    });
  };

  const handleClearAllIf = () => {
    const q = campaignVideoSearch.toLowerCase();
    const filtered = instantFactoryVideos.filter(v => !q || v.label.toLowerCase().includes(q) || v.campaign_name.toLowerCase().includes(q));
    setSelectedCampaignVideos(prev => {
      return prev.filter(pv => !filtered.find(fv => fv.id === pv.id));
    });
  };

  const handleToggleDbVideo = (vidId) => {
    setVideoDbIds(prev => {
      if (prev.includes(vidId)) {
        return prev.filter(id => id !== vidId);
      } else {
        return [...prev, vidId];
      }
    });
  };

  const handleSelectAllDb = () => {
    const q = videoSearch.toLowerCase();
    const filtered = dbVideos.filter(v => !q || v.filename.toLowerCase().includes(q));
    setVideoDbIds(prev => {
      const toAdd = filtered.map(v => v.id).filter(id => !prev.includes(id));
      return [...prev, ...toAdd];
    });
  };

  const handleClearAllDb = () => {
    const q = videoSearch.toLowerCase();
    const filtered = dbVideos.filter(v => !q || v.filename.toLowerCase().includes(q));
    setVideoDbIds(prev => {
      return prev.filter(id => !filtered.find(v => v.id === id));
    });
  };

  // Upload handler helper
  async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/video-studio/upload', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Gagal mengunggah file.');
    }
    return data.data.fs_path;
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    setStatusMessage('');

    try {
      // 1. Validate uploads
      if (videoSourceType === 'upload' && videoFiles.length === 0) {
        throw new Error('Silakan pilih minimal 1 file video untuk diunggah.');
      }
      if (videoSourceType === 'database' && videoDbIds.length === 0) {
        throw new Error('Silakan pilih minimal 1 video dari database.');
      }
      if ((videoSourceType === 're_campaign' || videoSourceType === 'instant_factory') && selectedCampaignVideos.length === 0) {
        throw new Error('Silakan pilih minimal 1 video dari kampanye.');
      }
      if (audioSourceType === 'upload' && !audioFile) {
        throw new Error('Silakan pilih file audio untuk diunggah.');
      }
      if (audioSourceType === 'database' && !audioDbId) {
        throw new Error('Silakan pilih audio dari database.');
      }
      if (audioSourceType === 'tts_studio' && !selectedTtsBatchId) {
        throw new Error('Silakan pilih batch dari TTS Studio.');
      }

      // 2. Perform file uploads if needed
      let videoPath = '';
      let audioPath = audioSourceType === 'tts_studio' ? selectedTtsBatchId : audioDbId;

      if (videoSourceType === 'upload') {
        const uploadedPaths = [];
        for (let i = 0; i < videoFiles.length; i++) {
          setStatusMessage(`Sedang mengunggah video ${i + 1}/${videoFiles.length}...`);
          const path = await uploadFile(videoFiles[i]);
          uploadedPaths.push(path);
        }
        videoPath = JSON.stringify(uploadedPaths);
      } else if (videoSourceType === 're_campaign') {
        // Kirim ID item (format "re::<item_id>") — server resolve ke ffmpeg_output_path
        videoPath = JSON.stringify(selectedCampaignVideos.map(v => v.id));
      } else if (videoSourceType === 'instant_factory') {
        // Kirim fs_path klip Instant Factory — server resolve ke abs path
        videoPath = JSON.stringify(selectedCampaignVideos.map(v => v.fs_path));
      } else {
        videoPath = JSON.stringify(videoDbIds);
      }

      if (audioSourceType === 'upload') {
        setStatusMessage('Sedang mengunggah audio...');
        audioPath = await uploadFile(audioFile);
      }

      // 3. Queue render job
      setStatusMessage('Mengirim ke antrean rendering...');
      const renderRes = await fetch('/api/video-studio/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_source_type: videoSourceType,
          video_path: videoPath,
          audio_source_type: audioSourceType,
          audio_path: audioPath,
          sync_option: syncOption,
          bgm_file: bgmFile || null,
          bgm_volume: bgmVolume,
          sfx_volume: sfxVolume,
          video_scale: videoScale
        })
      });

      const renderData = await renderRes.json();
      if (!renderRes.ok || !renderData.success) {
        throw new Error(renderData.error || 'Gagal memicu rendering.');
      }

      setStatusMessage('Sukses! Render job ditambahkan ke antrean.');
      
      // Reset upload states
      setVideoFiles([]);
      setVideoDbIds([]);
      setSelectedCampaignVideos([]);
      setAudioFile(null);
      setSfxVolume(0.0);
      setVideoScale(1.0);
      const videoFileInput = document.getElementById('video-file-input');
      const audioFileInput = document.getElementById('audio-file-input');
      if (videoFileInput) videoFileInput.value = '';
      if (audioFileInput) audioFileInput.value = '';

      // Refresh jobs list
      await fetchJobs();

      // Automatically select the new job
      if (renderData.data && renderData.data.job_id) {
        const newJob = {
          id: renderData.data.job_id,
          status: 'pending',
          video_source_type: videoSourceType,
          audio_source_type: audioSourceType,
          sync_option: syncOption,
          created_at: new Date().toISOString()
        };
        setSelectedJob(newJob);
      }

    } catch (err) {
      setErrorMessage(err.message || String(err));
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setStatusMessage(''), 5000);
    }
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const dm = 2;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: 'numeric',
      month: 'short'
    });
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-container">
          <div className="page-header" style={{ marginBottom: '16px' }}>
            <h2>🎞 FFmpeg Standalone Video Studio</h2>
            <p>Pusat penyuntingan & sinkronisasi audio-video native dengan proteksi server CPU-bound</p>
          </div>

          {errorMessage && (
            <div className="alert alert-danger" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>⚠️ {errorMessage}</span>
              <button className="btn-close" style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem' }} onClick={() => setErrorMessage('')}>&times;</button>
            </div>
          )}

          {statusMessage && (
            <div className="alert alert-info" style={{ marginBottom: '16px' }}>
              ⏳ {statusMessage}
            </div>
          )}

          <div className="ffmpeg-studio-container">
            {/* PANEL KIRI: CONTROL & CONFIG */}
            <div className="studio-control-panel">
              <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                
                {/* 1. Sumber Video */}
                <div className="media-section">
                  <h3>1. Sumber Video (Visual)</h3>
                  <div className="tabs" style={{ flexWrap: 'wrap', gap: 4 }}>
                    <button
                      type="button"
                      className={`tab-btn ${videoSourceType === 'upload' ? 'active' : ''}`}
                      onClick={() => setVideoSourceType('upload')}
                    >
                      📁 Unggah File
                    </button>
                    <button
                      type="button"
                      className={`tab-btn ${videoSourceType === 'database' ? 'active' : ''}`}
                      onClick={() => setVideoSourceType('database')}
                    >
                      🗄️ Dari DB
                    </button>
                    <button
                      type="button"
                      className={`tab-btn ${videoSourceType === 're_campaign' ? 'active' : ''}`}
                      onClick={() => { setVideoSourceType('re_campaign'); setSelectedCampaignVideos([]); fetchCampaignVideos(); }}
                      style={{ position: 'relative' }}
                    >
                      🔄 RE Campaign
                      {reCampaignVideos.length > 0 && (
                        <span style={{ marginLeft: 4, background: 'rgba(99,102,241,0.3)', borderRadius: 8, padding: '0 5px', fontSize: '0.65rem' }}>{reCampaignVideos.length}</span>
                      )}
                    </button>
                    <button
                      type="button"
                      className={`tab-btn ${videoSourceType === 'instant_factory' ? 'active' : ''}`}
                      onClick={() => { setVideoSourceType('instant_factory'); setSelectedCampaignVideos([]); fetchCampaignVideos(); }}
                      style={{ position: 'relative' }}
                    >
                      ⚡ Instant Factory
                      {instantFactoryVideos.length > 0 && (
                        <span style={{ marginLeft: 4, background: 'rgba(234,179,8,0.3)', borderRadius: 8, padding: '0 5px', fontSize: '0.65rem' }}>{instantFactoryVideos.length}</span>
                      )}
                    </button>
                  </div>

                  {videoSourceType === 'upload' ? (
                    <div className="drag-drop-zone">
                      <input
                        id="video-file-input"
                        type="file"
                        accept="video/mp4,video/quicktime,video/webm"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          setVideoFiles(prev => [...prev, ...files]);
                        }}
                      />
                      {videoFiles.length > 0 ? (
                        <div style={{ textAlign: 'left', width: '100%' }}>
                          <p style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#e2e8f0', marginBottom: '6px' }}>
                            Klip Terpilih ({videoFiles.length}):
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '150px', overflowY: 'auto' }}>
                            {videoFiles.map((file, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                                <span style={{ color: '#38bdf8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                                  {idx + 1}. {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                                </span>
                                <button
                                  type="button"
                                  style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setVideoFiles(prev => prev.filter((_, i) => i !== idx));
                                  }}
                                >
                                  &times;
                                </button>
                              </div>
                            ))}
                          </div>
                          <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '6px', textAlign: 'center' }}>
                            (Klik/seret lagi untuk menambah klip)
                          </p>
                        </div>
                      ) : (
                        <p>Seret beberapa video (.mp4, .mov, .webm) ke sini atau klik untuk mencari (Maks 50MB/klip)</p>
                      )}
                    </div>
                  ) : videoSourceType === 're_campaign' ? (
                    <div className="db-select-box">
                      <input
                        type="text"
                        placeholder="Cari video RE Campaign..."
                        className="form-input"
                        value={campaignVideoSearch}
                        onChange={(e) => setCampaignVideoSearch(e.target.value)}
                        style={{ marginBottom: '8px' }}
                      />

                      {selectedCampaignVideos.length > 0 && (
                        <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '8px', padding: '8px', marginBottom: '8px' }}>
                          <p style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#a5b4fc', marginBottom: '4px' }}>✅ Terpilih ({selectedCampaignVideos.length}):</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '100px', overflowY: 'auto' }}>
                            {selectedCampaignVideos.map((v, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', padding: '3px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>
                                <span style={{ color: '#a5b4fc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>{idx + 1}. {v.label}</span>
                                <button type="button" style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer' }} onClick={() => setSelectedCampaignVideos(prev => prev.filter((_, i) => i !== idx))}>×</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {reCampaignVideos.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '16px 0' }}>
                          <p>⚠️ Belum ada video RE Campaign yang selesai di-render.</p>
                          <p style={{ fontSize: '0.72rem', marginTop: 4 }}>Video muncul setelah kampanye melewati fase FFmpeg Muxing.</p>
                        </div>
                      ) : (
                        <>
                          <div className="multi-select-actions">
                            <button type="button" className="btn-link" onClick={handleSelectAllRe}>☑ Select All</button>
                            <button type="button" className="btn-link" onClick={handleClearAllRe}>☒ Clear Filtered</button>
                          </div>
                          <div className="studio-multi-select-list">
                            {(() => {
                              const q = campaignVideoSearch.toLowerCase();
                              const filtered = reCampaignVideos.filter(v => !q || v.label.toLowerCase().includes(q) || v.campaign_name.toLowerCase().includes(q));
                              if (filtered.length === 0) {
                                return <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '8px', margin: 0, textAlign: 'center' }}>Tidak ada hasil pencarian.</p>;
                              }
                              
                              // Group by campaign_name → item_id
                              const byCampaign = {};
                              filtered.forEach(v => {
                                if (!byCampaign[v.campaign_name]) byCampaign[v.campaign_name] = {};
                                const itemKey = `${v.item_id}::${v.source_url?.split('/').pop() || v.item_id}`;
                                if (!byCampaign[v.campaign_name][itemKey]) byCampaign[v.campaign_name][itemKey] = [];
                                byCampaign[v.campaign_name][itemKey].push(v);
                              });
                              
                              return Object.entries(byCampaign).map(([campaignName, items]) => (
                                <div key={campaignName} style={{ display: 'flex', flexDirection: 'column' }}>
                                  <div className="multi-select-group-header">📁 {campaignName}</div>
                                  {Object.entries(items).map(([itemKey, clips]) => {
                                    const sourceLabel = itemKey.split('::')[1];
                                    return (
                                      <div key={itemKey} style={{ display: 'flex', flexDirection: 'column', paddingLeft: '8px' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '4px 8px 2px 8px', fontWeight: 'bold' }}>
                                          › {sourceLabel}
                                        </div>
                                        {clips.map(v => {
                                          const isSelected = !!selectedCampaignVideos.find(s => s.id === v.id);
                                          return (
                                            <div
                                              key={v.id}
                                              className={`multi-select-row ${isSelected ? 'selected' : ''}`}
                                              onClick={() => handleToggleCampaignVideo(v)}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => {}} // Handled by onClick
                                              />
                                              <span>
                                                {v.clip_type === 'final' ? '★ Final (Merged)' : `🎬 ${v.scene_label}`}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  })}
                                </div>
                              ));
                            })()}
                          </div>
                        </>
                      )}
                    </div>
                  ) : videoSourceType === 'instant_factory' ? (
                    <div className="db-select-box">
                      <input
                        type="text"
                        placeholder="Cari video Instant Factory..."
                        className="form-input"
                        value={campaignVideoSearch}
                        onChange={(e) => setCampaignVideoSearch(e.target.value)}
                        style={{ marginBottom: '8px' }}
                      />

                      {selectedCampaignVideos.length > 0 && (
                        <div style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: '8px', padding: '8px', marginBottom: '8px' }}>
                          <p style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#fbbf24', marginBottom: '4px' }}>✅ Terpilih ({selectedCampaignVideos.length}):</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '100px', overflowY: 'auto' }}>
                            {selectedCampaignVideos.map((v, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', padding: '3px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>
                                <span style={{ color: '#fbbf24', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>{idx + 1}. {v.label}</span>
                                <button type="button" style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer' }} onClick={() => setSelectedCampaignVideos(prev => prev.filter((_, i) => i !== idx))}>×</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {instantFactoryVideos.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '16px 0' }}>
                          <p>⚠️ Belum ada klip video dari Instant Factory yang ditemukan.</p>
                          <p style={{ fontSize: '0.72rem', marginTop: 4 }}>Klip muncul jika pipeline Instant Factory menghasilkan file video per-scene.</p>
                        </div>
                      ) : (
                        <>
                          <div className="multi-select-actions">
                            <button type="button" className="btn-link" onClick={handleSelectAllIf}>☑ Select All</button>
                            <button type="button" className="btn-link" onClick={handleClearAllIf}>☒ Clear Filtered</button>
                          </div>
                          <div className="studio-multi-select-list">
                            {(() => {
                              const q = campaignVideoSearch.toLowerCase();
                              const filtered = instantFactoryVideos.filter(v => !q || v.label.toLowerCase().includes(q) || v.campaign_name.toLowerCase().includes(q));
                              if (filtered.length === 0) {
                                return <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '8px', margin: 0, textAlign: 'center' }}>Tidak ada hasil pencarian.</p>;
                              }
                              
                              const groups = {};
                              filtered.forEach(v => {
                                if (!groups[v.campaign_name]) groups[v.campaign_name] = [];
                                groups[v.campaign_name].push(v);
                              });
                              
                              return Object.entries(groups).map(([name, items]) => (
                                <div key={name} style={{ display: 'flex', flexDirection: 'column' }}>
                                  <div className="multi-select-group-header">⚡ {name}</div>
                                  {items.map(v => {
                                    const isSelected = !!selectedCampaignVideos.find(s => s.id === v.id);
                                    return (
                                      <div
                                        key={v.id}
                                        className={`multi-select-row ${isSelected ? 'selected' : ''}`}
                                        onClick={() => handleToggleInstantFactoryVideo(v)}
                                        style={{ marginLeft: '8px' }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => {}}
                                        />
                                        <span>{v.label}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ));
                            })()}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="db-select-box">
                      <input
                        type="text"
                        placeholder="Cari video di database..."
                        className="form-input"
                        value={videoSearch}
                        onChange={(e) => setVideoSearch(e.target.value)}
                        style={{ marginBottom: '8px' }}
                      />

                      {videoDbIds.length > 0 && (
                        <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '8px', padding: '8px', marginBottom: '8px' }}>
                          <p style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#e2e8f0', marginBottom: '4px' }}>
                            Daftar Klip DB Terpilih ({videoDbIds.length}):
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '120px', overflowY: 'auto' }}>
                            {videoDbIds.map((id, idx) => {
                              const vid = dbVideos.find(v => v.id === id) || { filename: id };
                              return (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', padding: '3px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>
                                  <span style={{ color: '#38bdf8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                                    {idx + 1}. {vid.filename}
                                  </span>
                                  <button
                                    type="button"
                                    style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer' }}
                                    onClick={() => setVideoDbIds(prev => prev.filter((_, i) => i !== idx))}
                                  >
                                    &times;
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="multi-select-actions">
                        <button type="button" className="btn-link" onClick={handleSelectAllDb}>☑ Select All</button>
                        <button type="button" className="btn-link" onClick={handleClearAllDb}>☒ Clear Filtered</button>
                      </div>
                      <div className="studio-multi-select-list">
                        {(() => {
                          const q = videoSearch.toLowerCase();
                          const filtered = dbVideos.filter(v => !q || v.filename.toLowerCase().includes(q));
                          if (filtered.length === 0) {
                            return <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '8px', margin: 0, textAlign: 'center' }}>Tidak ada hasil pencarian.</p>;
                          }
                          return filtered.map(vid => {
                            const isSelected = videoDbIds.includes(vid.id);
                            return (
                              <div
                                key={vid.id}
                                className={`multi-select-row ${isSelected ? 'selected' : ''}`}
                                onClick={() => handleToggleDbVideo(vid.id)}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}}
                                />
                                <span>{vid.filename} ({formatBytes(vid.file_size)})</span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Sumber Audio */}
                <div className="media-section">
                  <h3>2. Sumber Audio (Voiceover)</h3>
                  <div className="tabs">
                    <button
                      type="button"
                      className={`tab-btn ${audioSourceType === 'upload' ? 'active' : ''}`}
                      onClick={() => setAudioSourceType('upload')}
                    >
                      Unggah File
                    </button>
                    <button
                      type="button"
                      className={`tab-btn ${audioSourceType === 'database' ? 'active' : ''}`}
                      onClick={() => setAudioSourceType('database')}
                    >
                      Pilih dari DB
                    </button>
                    <button
                      type="button"
                      className={`tab-btn ${audioSourceType === 'tts_studio' ? 'active' : ''}`}
                      onClick={() => setAudioSourceType('tts_studio')}
                    >
                      TTS Studio
                    </button>
                  </div>

                  {audioSourceType === 'upload' ? (
                    <div className="drag-drop-zone">
                      <input
                        id="audio-file-input"
                        type="file"
                        accept="audio/mp3,audio/wav,audio/mpeg"
                        onChange={(e) => setAudioFile(e.target.files[0] || null)}
                      />
                      {audioFile ? (
                        <p className="file-selected">
                          ✓ {audioFile.name} ({(audioFile.size / (1024 * 1024)).toFixed(2)} MB)
                        </p>
                      ) : (
                        <p>Seret file audio (.mp3, .wav) ke sini atau klik untuk mencari (Maks 10MB)</p>
                      )}
                    </div>
                  ) : audioSourceType === 'database' ? (
                    <div className="db-select-box">
                      <input
                        type="text"
                        placeholder="Cari audio di database..."
                        className="form-input"
                        value={audioSearch}
                        onChange={(e) => setAudioSearch(e.target.value)}
                        style={{ marginBottom: '8px' }}
                      />
                      <select
                        className="form-select"
                        value={audioDbId}
                        onChange={(e) => setAudioDbId(e.target.value)}
                      >
                        <option value="">-- Pilih Audio --</option>
                        {dbAudios.map((aud) => (
                          <option key={aud.id} value={aud.id}>
                            {aud.filename} ({formatBytes(aud.file_size)})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="db-select-box">
                      <select
                        className="form-select"
                        value={selectedTtsBatchId}
                        onChange={(e) => setSelectedTtsBatchId(e.target.value)}
                      >
                        <option value="">-- Pilih Batch TTS Studio --</option>
                        {ttsBatches.map((batch) => (
                          <option key={batch.id} value={batch.id}>
                            Batch: {batch.id} ({batch.voice_persona} - {batch.clips?.length || 0} Klip)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* 3. Sinkronisasi & BGM */}
                <div className="media-section">
                  <h3>3. Strategi Sinkronisasi & BGM</h3>
                  
                  <label className="form-label">Sinkronisasi Audio-Video</label>
                  <select
                    className="form-select"
                    value={syncOption}
                    onChange={(e) => setSyncOption(e.target.value)}
                    style={{ marginBottom: '12px' }}
                  >
                    <option value="shortest">Potong Mengikuti Durasi Terpendek (Shortest Trim)</option>
                    <option value="stretch">Sesuaikan Kecepatan Video (Speed Stretch)</option>
                    <option value="freeze">Bekukan Frame Terakhir (Freeze Last Frame)</option>
                    <option value="loop">Ulangi Klip Video (Infinite Loop Video)</option>
                  </select>

                  <label className="form-label">Volume Suara Klip SFX: {(sfxVolume * 100).toFixed(0)}%</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={sfxVolume}
                    onChange={(e) => setSfxVolume(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: '#6366f1', marginBottom: '12px' }}
                  />

                  <label className="form-label">Skala Zoom Video: {(videoScale * 100).toFixed(0)}%</label>
                  <input
                    type="range"
                    min="1.0"
                    max="2.0"
                    step="0.01"
                    value={videoScale}
                    onChange={(e) => setVideoScale(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: '#6366f1', marginBottom: '12px' }}
                  />

                  <label className="form-label">Musik Latar BGM (Opsional)</label>
                  <select
                    className="form-select"
                    value={bgmFile}
                    onChange={(e) => setBgmFile(e.target.value)}
                    style={{ marginBottom: '12px' }}
                  >
                    <option value="">Tanpa Musik Latar</option>
                    <option value="smooth_commercial.mp3">Smooth Commercial</option>
                    <option value="upbeat_promo.mp3">Upbeat Promo</option>
                  </select>

                  {bgmFile && (
                    <>
                      <label className="form-label">Volume BGM: {(bgmVolume * 100).toFixed(0)}%</label>
                      <input
                        type="range"
                        min="0.05"
                        max="0.5"
                        step="0.05"
                        value={bgmVolume}
                        onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: '#6366f1' }}
                      />
                    </>
                  )}
                </div>

                <button
                  type="submit"
                  className="glowing-btn-render"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? '⏳ Mengunggah & Memproses...' : '🎬 Mulai Rendering Video'}
                </button>
              </form>
            </div>

            {/* PANEL KANAN: LIVE PREVIEW & QUEUE */}
            <div className="studio-preview-panel">
              <h2>📺 Pratinjau & Hasil Render</h2>

              {/* Video Preview Player */}
              <div className="preview-box">
                {selectedJob && selectedJob.status === 'completed' && selectedJob.output_path ? (
                  <video
                    key={selectedJob.id}
                    controls
                    autoPlay
                    src={selectedJob.output_path}
                  >
                    Browser Anda tidak mendukung tag video.
                  </video>
                ) : selectedJob && selectedJob.status === 'processing' ? (
                  <div className="no-preview">
                    <div className="spinner-loader" style={{ width: '40px', height: '40px' }}></div>
                    <p style={{ marginTop: '8px' }}>Sedang memproses render video...</p>
                  </div>
                ) : selectedJob && selectedJob.status === 'pending' ? (
                  <div className="no-preview">
                    <p>Pekerjaan dalam antrean (Pending)...</p>
                  </div>
                ) : selectedJob && selectedJob.status === 'failed' ? (
                  <div className="no-preview" style={{ padding: '20px', textAlign: 'center' }}>
                    <p style={{ color: '#f87171', fontWeight: 'bold' }}>⚠️ Render Gagal</p>
                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', wordBreak: 'break-all', marginTop: '4px' }}>
                      {selectedJob.error_log}
                    </p>
                  </div>
                ) : (
                  <div className="no-preview">
                    <span style={{ fontSize: '2.5rem' }}>📼</span>
                    <p>Pilih pekerjaan render di bawah untuk melihat pratinjau hasil video</p>
                  </div>
                )}
              </div>

              {/* Queue List */}
              <div className="queue-box">
                <h3>Antrean Server Sekuensial</h3>
                <div className="queue-list">
                  {jobs.length === 0 ? (
                    <div className="empty-queue">
                      Belum ada riwayat pekerjaan render. Silakan buat render baru di panel kiri.
                    </div>
                  ) : (
                    jobs.map((job) => {
                      const isActive = selectedJob && selectedJob.id === job.id;
                      return (
                        <div
                          key={job.id}
                          className={`queue-item ${isActive ? 'active' : ''}`}
                          onClick={() => setSelectedJob(job)}
                        >
                          <div className="item-info">
                            <div className="title">
                              {job.id}
                            </div>
                            <div className="details">
                              <span>Opsi: {job.sync_option}</span>
                              <span>•</span>
                              <span>{formatDate(job.created_at)}</span>
                            </div>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span className={`status-badge ${job.status}`}>
                              {job.status}
                            </span>
                            {job.status === 'processing' && (
                              <div className="spinner-loader"></div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
