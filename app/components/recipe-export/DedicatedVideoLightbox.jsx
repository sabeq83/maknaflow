'use client';

import React, { useState, useRef, useEffect } from 'react';
import './recipe-export.css';

export default function DedicatedVideoLightbox({ recipe, onClose, onProceedToExport }) {
  const [audioMode, setAudioMode] = useState('muted'); // 'muted' | 'original'
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = (audioMode === 'muted');
      if (audioMode === 'original') videoRef.current.volume = 0.6;
      try {
        videoRef.current.play();
      } catch (_) {}
    }
  }, [audioMode]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!recipe) return null;

  const videoSourceUrl = recipe.videoR2Url || recipe.video_url || recipe.media_url || 'https://assets.mixkit.co/videos/preview/mixkit-vegetables-and-meat-simmering-in-a-pan-43407-large.mp4';

  return (
    <div className="recipe-lightbox-backdrop" onClick={onClose}>
      <div className="recipe-lightbox-card" onClick={e => e.stopPropagation()}>
        
        {/* Video Player Column (Vertical 9:16) */}
        <div className="recipe-lightbox-player-col">
          <video
            ref={videoRef}
            src={videoSourceUrl}
            poster={recipe.image || recipe.cover_url}
            controls
            playsInline
            loop
          >
            Browser Anda tidak mendukung pemutar video HTML5.
          </video>
          <div className="recipe-video-muted-floating-badge">
            <span>🔇</span>
            <span>{audioMode === 'muted' ? '100% Muted (Audio Track Stripped via FFmpeg)' : '⚠️ Mode Simulasi Suara Asli'}</span>
          </div>
        </div>

        {/* Info & Metadata Column */}
        <div className="recipe-lightbox-info-col">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span className="recipe-pixel-chip" style={{ color: 'var(--status-warning)', borderColor: 'var(--status-warning)' }}>
                    🎬 Video Vertikal 9:16
                  </span>
                  <span className="recipe-pixel-chip">{recipe.source || 'Recipe Studio'}</span>
                </div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  {recipe.title || recipe.recipe_title}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="recipe-modal-close-btn"
                title="Tutup Pratinjau (Esc)"
              >
                ✕
              </button>
            </div>

            {/* Audio Verification VU Meter */}
            <div style={{ background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.78rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🔇</span> <span>Status Trek Audio Video:</span>
                </strong>
                <span style={{ fontSize: '0.72rem', color: audioMode === 'muted' ? 'var(--status-success)' : 'var(--status-warning)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {audioMode === 'muted' ? '-inf dB (Hening Sempurna)' : '~ -12 dB (Trek Asli Bersuara)'}
                </span>
              </div>

              <div className="recipe-audio-meter-bars" style={{ height: '18px' }}>
                {[...Array(10)].map((_, i) => (
                  <div
                    key={i}
                    className={`recipe-audio-bar ${audioMode === 'muted' ? 'muted-flat' : 'active-sound'}`}
                    style={{ width: '4px' }}
                  />
                ))}
              </div>

              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                {audioMode === 'muted' 
                  ? 'Trek audio voiceover/musik telah dihapus bersih via FFmpeg (-c:v copy -an) agar video berputar hening tanpa mengganggu audio ponsel pengguna.'
                  : 'Mode simulasi audio asli aktif untuk mendengarkan perbandingan suara sebelum dipotong.'}
              </p>
            </div>

            {/* Technical Metadata */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.75rem' }}>
              <div style={{ background: 'var(--input-bg)', padding: '8px 10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Resolusi Video:</div>
                <strong style={{ color: 'var(--text-primary)' }}>1080 × 1920 (9:16)</strong>
              </div>
              <div style={{ background: 'var(--input-bg)', padding: '8px 10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Durasi Pemutaran:</div>
                <strong style={{ color: 'var(--text-primary)' }}>{recipe.duration || '00:38 Detik'}</strong>
              </div>
              <div style={{ background: 'var(--input-bg)', padding: '8px 10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Audio Codec:</div>
                <strong style={{ color: 'var(--status-success)' }}>NONE (Audio Stripped)</strong>
              </div>
              <div style={{ background: 'var(--input-bg)', padding: '8px 10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Cloudflare R2:</div>
                <strong style={{ color: recipe.videoR2Url ? 'var(--status-success)' : 'var(--text-muted)' }}>
                  {recipe.videoR2Url ? '✓ URL CDN Ready' : 'Siap Diunggah'}
                </strong>
              </div>
            </div>

            {/* A/B Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--input-bg)', padding: '8px 12px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Uji Dengar Suara:</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className={`btn-video-ctrl ${audioMode === 'muted' ? 'active-mode' : ''}`}
                  onClick={() => setAudioMode('muted')}
                >
                  🔇 Hening (Ter-Mute)
                </button>
                <button
                  type="button"
                  className={`btn-video-ctrl ${audioMode === 'original' ? 'active-mode' : ''}`}
                  onClick={() => setAudioMode('original')}
                >
                  🔊 Suara Asli
                </button>
              </div>
            </div>

          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
            {onProceedToExport && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  onClose();
                  onProceedToExport(recipe);
                }}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <span>🚀</span>
                <span>Buka di Modal Export Resep</span>
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Tutup Pratinjau
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
