'use client';

import Sidebar from '../components/Sidebar';
import { useEffect, useState, useRef } from 'react';

export default function ScraperPage() {
  const [videos, setVideos] = useState([]);
  const [storage, setStorage] = useState(null);
  const [urlInput, setUrlInput] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [playingVideo, setPlayingVideo] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => { fetchLibrary(); }, []);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function fetchLibrary() {
    try {
      const url = search ? `/api/scraper/library?search=${encodeURIComponent(search)}` : '/api/scraper/library';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setVideos(data.data);
        setStorage(data.storage);
      }
    } catch (e) { console.error(e); }
  }

  async function handleUrlDownload() {
    if (!urlInput.trim()) return;
    setDownloading(true);
    try {
      const res = await fetch('/api/scraper/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_url: urlInput.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ Video downloaded: ${data.data.filename}`);
        setUrlInput('');
        fetchLibrary();
      } else {
        showToast(data.error || 'Download failed', 'error');
      }
    } catch (e) { showToast(e.message, 'error'); }
    setDownloading(false);
  }

  async function handleFileUpload(file) {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/scraper/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ Uploaded: ${data.data.filename}`);
        fetchLibrary();
      } else {
        showToast(data.error || 'Upload failed', 'error');
      }
    } catch (e) { showToast(e.message, 'error'); }
    setUploading(false);
  }

  async function handleAnalyze(videoId) {
    setAnalyzing(videoId);
    try {
      const res = await fetch('/api/reverse/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: videoId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`🔍 RE selesai: ${data.data.scenes_count} scenes (${data.data.pipeline?.batch_id || ''})`);
        fetchLibrary();
      } else {
        showToast(data.error || 'Analysis failed', 'error');
      }
    } catch (e) { showToast(e.message, 'error'); }
    setAnalyzing(null);
  }

  async function handleDelete(id) {
    if (!confirm('Hapus video ini dari library?')) return;
    try {
      const res = await fetch('/api/scraper/library', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('🗑 Video dihapus');
        fetchLibrary();
      } else { showToast(data.error, 'error'); }
    } catch (e) { showToast(e.message, 'error'); }
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  const statusColors = {
    ready: { bg: '#00b89420', color: '#00b894', label: 'Ready' },
    downloading: { bg: '#fdcb6e30', color: '#fdcb6e', label: 'Downloading...' },
    failed: { bg: '#d6303120', color: '#d63031', label: 'Failed' },
    analyzed: { bg: '#6c5ce720', color: '#a29bfe', label: 'Analyzed ✓' },
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-container">
          <div className="page-header">
            <h2>📼 Video Library</h2>
            <p>Kelola perpustakaan video referensi lokal. Download dari URL atau upload manual.</p>
          </div>

          {/* Storage Banner */}
          {storage && (
            <div style={{
              background: storage.warning ? 'linear-gradient(135deg, #d6303120, #e1705520)' : 'var(--bg-glass)',
              border: `1px solid ${storage.warning ? '#d63031' : 'var(--border)'}`,
              borderRadius: 'var(--radius)', padding: '12px 20px', marginBottom: '20px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                💾 Penyimpanan: <strong style={{ color: storage.warning ? '#d63031' : 'var(--accent-light)' }}>{storage.used_gb} GB</strong> / {storage.limit_gb} GB
                &nbsp;·&nbsp; {storage.total_files} video
              </div>
              {storage.warning && (
                <span style={{ fontSize: '0.75rem', color: '#d63031', fontWeight: 600 }}>⚠ Batas penyimpanan hampir penuh!</span>
              )}
            </div>
          )}

          {/* Input Bar */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-title"><span className="icon">📥</span> Tambah Video ke Library</div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <input
                type="text"
                className="input-field"
                placeholder="Paste URL video (TikTok, IG, YouTube, dll.)"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleUrlDownload()}
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary" onClick={handleUrlDownload} disabled={downloading || !urlInput.trim()}>
                {downloading ? '⏳ Downloading...' : '⬇ Download'}
              </button>
            </div>

            {/* Upload Zone */}
            <div
              style={{
                border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius)', padding: '24px', textAlign: 'center',
                background: dragOver ? 'var(--accent)10' : 'transparent',
                transition: 'all 0.2s ease', cursor: 'pointer',
              }}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFileUpload(e.dataTransfer.files[0]); }}
            >
              <input ref={fileRef} type="file" accept="video/*" hidden onChange={e => handleFileUpload(e.target.files[0])} />
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>{uploading ? '⏳' : '📁'}</div>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                {uploading ? 'Uploading...' : 'Drag & drop video file atau klik untuk browse (.mp4, .webm, .mov)'}
              </div>
            </div>
          </div>

          {/* Search */}
          <div style={{ marginBottom: '16px', display: 'flex', gap: '10px' }}>
            <input
              type="text"
              className="input-field"
              placeholder="🔎 Cari video..."
              value={search}
              onChange={e => { setSearch(e.target.value); }}
              onKeyDown={e => e.key === 'Enter' && fetchLibrary()}
              style={{ maxWidth: '360px' }}
            />
            <button className="btn btn-secondary btn-sm" onClick={fetchLibrary}>Search</button>
            {search && <button className="btn btn-sm" style={{ background: 'transparent', color: 'var(--text-muted)' }} onClick={() => { setSearch(''); setTimeout(fetchLibrary, 100); }}>Clear</button>}
          </div>

          {/* Video Gallery Grid */}
          {videos.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📼</div>
              <h3>Library masih kosong</h3>
              <p>Download dari URL atau upload video manual untuk memulai.</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '16px',
            }}>
              {videos.map(video => {
                const st = statusColors[video.status] || statusColors.ready;
                const canPlay = video.status === 'ready' || video.status === 'analyzed';
                return (
                  <div key={video.id} className="card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {/* Thumbnail */}
                    <div 
                      onClick={() => canPlay && setPlayingVideo(video)}
                      style={{
                        height: '160px', background: '#111',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                        cursor: canPlay ? 'pointer' : 'default',
                        overflow: 'hidden',
                      }}
                    >
                      {video.thumbnail_path ? (
                        <img
                          src={`/api/scraper/thumbnail?id=${video.id}`}
                          alt={video.filename}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span style={{ fontSize: '3rem', opacity: 0.3 }}>🎬</span>
                      )}
                      
                      {/* Play overlay on hover */}
                      {canPlay && (
                        <div style={{
                          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: 0, transition: 'opacity 0.2s',
                        }} className="play-overlay">
                          <span style={{
                            fontSize: '2.5rem', color: '#fff', 
                            background: 'rgba(0,0,0,0.6)', width: '60px', height: '60px', 
                            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            paddingLeft: '5px',
                          }}>▶</span>
                        </div>
                      )}

                      {/* Status badge */}
                      <span style={{
                        position: 'absolute', top: '8px', right: '8px',
                        fontSize: '0.68rem', fontWeight: 600,
                        padding: '2px 8px', borderRadius: '4px',
                        background: st.bg, color: st.color,
                        zIndex: 2,
                      }}>{st.label}</span>
                      {/* Source badge */}
                      <span style={{
                        position: 'absolute', bottom: '8px', left: '8px',
                        fontSize: '0.65rem', padding: '2px 6px', borderRadius: '3px',
                        background: 'rgba(0,0,0,0.7)', color: '#ccc',
                        zIndex: 2,
                      }}>{video.source_type === 'url' ? '🔗 URL' : '📁 Upload'}</span>
                    </div>

                    {/* Info */}
                    <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={video.filename}>
                        {video.filename}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
                        <span>{formatBytes(video.file_size)}</span>
                        <span>·</span>
                        <span>{formatDate(video.created_at)}</span>
                      </div>
                      {video.source_url && (
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={video.source_url}>
                          {video.source_url}
                        </div>
                      )}
                      {video.error_note && (
                        <div style={{ fontSize: '0.72rem', color: '#d63031', marginTop: '2px' }}>❌ {video.error_note}</div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{
                      padding: '10px 14px', borderTop: '1px solid var(--border)',
                      display: 'flex', gap: '6px', justifyContent: 'flex-end',
                      alignItems: 'center',
                    }}>
                      {canPlay && (
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => setPlayingVideo(video)}
                          style={{ fontSize: '0.72rem', padding: '4px 10px', marginRight: 'auto' }}
                        >
                          ▶ Play
                        </button>
                      )}
                      {video.status === 'ready' && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleAnalyze(video.id)}
                          disabled={analyzing === video.id}
                          style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                        >
                          {analyzing === video.id ? '⏳ Analyzing...' : '🔍 Analyze (RE)'}
                        </button>
                      )}
                      {video.status === 'analyzed' && (
                        <>
                          <button
                            className="btn btn-sm"
                            onClick={() => handleAnalyze(video.id)}
                            disabled={analyzing === video.id}
                            style={{ fontSize: '0.72rem', padding: '4px 10px', background: 'var(--bg-glass)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                          >
                            {analyzing === video.id ? '⏳' : '🔄 Re-analyze'}
                          </button>
                          <a href="/reverse" className="btn btn-sm btn-secondary" style={{ fontSize: '0.72rem', padding: '4px 10px', textDecoration: 'none' }}>
                            👁 View RE
                          </a>
                        </>
                      )}
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(video.id)}
                        style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                      >✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Premium Video Player Modal */}
      {playingVideo && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.85)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)',
        }} onClick={() => setPlayingVideo(null)}>
          <div style={{
            background: 'var(--bg-panel)',
            width: '90%', maxWidth: '480px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              padding: '14px 20px', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '320px' }}>
                {playingVideo.filename}
              </strong>
              <button 
                onClick={() => setPlayingVideo(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
              >✕</button>
            </div>
            <div style={{ background: '#000', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <video 
                src={`/api/scraper/video?id=${playingVideo.id}`}
                controls 
                autoPlay 
                style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain' }}
              />
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
      
      {/* Dynamic CSS styles for the hover overlay */}
      <style jsx global>{`
        .card:hover .play-overlay {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}
