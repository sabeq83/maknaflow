'use client';

import Sidebar from '../../components/Sidebar';
import Link from 'next/link';
import { useEffect, useState, Fragment } from 'react';
import { useParams } from 'next/navigation';

const writeToClipboard = (text) => {
  if (typeof window !== 'undefined') {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textarea);
  }
  return Promise.resolve();
};

const isJsonError = (val) => {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('{\\"')) {
    try {
      let normalized = trimmed;
      if (trimmed.startsWith('{\\"')) {
        normalized = trimmed.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }
      JSON.parse(normalized);
      return false;
    } catch (e) {
      return true;
    }
  }
  return false;
};

const getFormattedPrompt = (val) => {
  if (typeof val !== 'string') return val;
  const trimmed = val.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('{\\"')) {
    try {
      let normalized = trimmed;
      if (trimmed.startsWith('{\\"')) {
        normalized = trimmed.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }
      return JSON.stringify(JSON.parse(normalized), null, 2);
    } catch (e) {
      return val;
    }
  }
  return val;
};

const getDemographicLabel = (demographic, custom) => {
  if (demographic === 'custom') return custom || 'Custom';
  if (demographic === 'genz_casual') return 'Gen Z (Casual / Slang)';
  if (demographic === 'millennial_professional') return 'Millennial (Professional / Formal)';
  if (demographic === 'parent_warm') return 'Parents / Warm & Caring';
  return demographic || 'Generik / Kasual';
};


const GEMINI_VOICES = [
  { id: 'Kore', name: 'Kore (Female)', avatar: '👩', desc: 'Standard Female (Skincare/Cosmetic)' },
  { id: 'Fenrir', name: 'Fenrir (Male)', avatar: '🧔', desc: 'Deep/Heavy Male (Otomotif/High-End)' },
  { id: 'Puck', name: 'Puck (Male)', avatar: '👦', desc: 'Ceria, Playful (Makanan/Promo Kilat)' },
  { id: 'Charon', name: 'Charon (Male)', avatar: '👨', desc: 'Formal, News Style (Review Tech/Finansial)' },
  { id: 'Leda', name: 'Leda (Female)', avatar: '👵', desc: 'Hangat, Ramah (Edukasi/Ibu Anak)' },
  { id: 'Zephyr', name: 'Zephyr (Male)', avatar: 'sn', desc: 'Kasual, Santai (Storytelling/Daily Vlog)' },
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

const MINIMAX_ENGLISH_VOICES = [
  { id: 'English_Resonant_Man', name: 'Resonant Man (Male)', avatar: '👨', desc: 'English Resonant Man' },
  { id: 'English_Trustworth_Man', name: 'Trustworthy Man (Male)', avatar: '👨', desc: 'English Trustworthy Man' },
  { id: 'English_causual_narrator_vv1', name: 'Casual Narrator (Male)', avatar: '👨', desc: 'English Casual Narrator' },
  { id: 'English_causual_podcast_vv1', name: 'Casual Podcast (Male)', avatar: '👨', desc: 'English Casual Podcast' },
  { id: 'English_expressive_host__vv1', name: 'Expressive Host (Male)', avatar: '👨', desc: 'English Expressive Host' },
  { id: 'English_instructive_professor_vv1', name: 'Instructive Professor (Female)', avatar: '👩', desc: 'English Instructive Professor' },
  { id: 'English_nursery_teacher_vv2', name: 'Nursery Teacher (Female)', avatar: '👩', desc: 'English Nursery Teacher' },
  { id: 'English_captivating_female1', name: 'Captivating Female (Female)', avatar: '👩', desc: 'English Captivating Female' },
  { id: 'English_radiant_girl', name: 'Radiant Girl (Female)', avatar: '👩', desc: 'English Radiant Girl' },
  { id: 'English_CalmWoman', name: 'Calm Woman (Female)', avatar: '👩', desc: 'English Calm Woman' }
];

const STATUS_COLOR = {
  pending:    'var(--text-muted)',
  downloaded: 'var(--accent-light)',
  analyzed:   'var(--success)',
  failed:     'var(--danger)',
};

function renderPipelineStatus(item, triggerManualStep, triggering = {}) {
  const getStageStatus = (currentStatus) => {
    if (currentStatus === 'completed' || currentStatus === 'downloaded' || currentStatus === 'analyzed') {
      return 'success';
    }
    if (currentStatus === 'failed') {
      return 'danger';
    }
    if (currentStatus === 'processing' || currentStatus === 'uploading') {
      return 'active';
    }
    if (currentStatus === 'skipped') {
      return 'skipped';
    }
    return 'pending';
  };

  const stages = [
    { label: 'Scraped', status: getStageStatus(item.scrape_status) },
    { label: 'Analyzed', status: getStageStatus(item.analyze_status) },
    { label: 'TTS', status: getStageStatus(item.tts_status) },
    { label: 'Visuals', status: getStageStatus(item.visual_status) },
    { label: 'FFmpeg', status: getStageStatus(item.ffmpeg_status) },
    { label: 'Cloud', status: getStageStatus(item.upload_status) },
    { label: 'Social', status: getStageStatus(item.social_post_status) }
  ];

  const stepMap = {
    'Scraped': 'scrape',
    'Analyzed': 'analyze',
    'TTS': 'tts',
    'Visuals': 'visuals',
    'FFmpeg': 'ffmpeg',
    'Cloud': 'ffmpeg',
    'Social': 'social'
  };

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
        } else if (stage.status === 'skipped') {
          color = 'rgba(255, 255, 255, 0.3)';
          bg = 'rgba(255, 255, 255, 0.02)';
          border = '1px dashed rgba(255, 255, 255, 0.15)';
          labelText = `⚡ ${stage.label}`;
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

        const stepName = stepMap[stage.label];
        const canRetry = stage.status !== 'pending' && stage.status !== 'active';

        return (
          <div key={stage.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              padding: '3px 8px',
              borderRadius: 4,
              background: bg,
              color: color,
              fontWeight: 600,
              fontSize: '0.65rem',
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
            {canRetry && (
              <button
                type="button"
                onClick={() => triggerManualStep(item.id, stepName)}
                disabled={!!triggering[`${item.id}-${stepName}`]}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '3px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  fontSize: '0.58rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-muted)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                }}
                title={`Retry langkah ${stage.label} (akan mereset langkah sesudahnya)`}
              >
                {triggering[`${item.id}-${stepName}`] ? '⏳' : '🔄'}
              </button>
            )}
            {sIdx < stages.length - 1 && <span style={{ color: 'rgba(255, 255, 255, 0.15)', fontSize: '0.75rem', marginLeft: 2 }}>➔</span>}
          </div>
        );
      })}
    </div>
  );
}

function renderItemStatus(item, campaign) {
  let text = 'Fase 1 : Pending';
  let color = 'var(--text-muted)';
  let bg = 'rgba(255, 255, 255, 0.05)';
  let pulse = false;

  const pauseAt = campaign?.scheduler_pause_at;

  // 1. Errors
  if (
    item.scrape_status === 'failed' || 
    item.analyze_status === 'failed' || 
    item.tts_status === 'failed' || 
    item.visual_status === 'failed' || 
    item.ffmpeg_status === 'failed' || 
    item.upload_status === 'failed' || 
    item.social_post_status === 'failed'
  ) {
    text = '⚠️ Error / Failed';
    color = '#e74c3c';
    bg = 'rgba(231, 76, 60, 0.1)';
  }
  // 2. Pause states
  else if (pauseAt === 'tts' && item.analyze_status === 'analyzed' && item.tts_status === 'pending') {
    text = '⏸️ Fase 2 : Paused (Review Script)';
    color = '#f39c12';
    bg = 'rgba(243, 156, 18, 0.1)';
  } else if (pauseAt === 'visuals' && item.tts_status === 'completed' && item.visual_status === 'pending') {
    text = '⏸️ Fase 2 : Paused (Review Prompts)';
    color = '#f39c12';
    bg = 'rgba(243, 156, 18, 0.1)';
  } else if (pauseAt === 'ffmpeg' && item.visual_status === 'completed' && item.ffmpeg_status === 'pending') {
    text = '⏸️ Fase 2 : Paused (Review Clips)';
    color = '#f39c12';
    bg = 'rgba(243, 156, 18, 0.1)';
  } else if (pauseAt === 'social' && item.ffmpeg_status === 'completed' && item.social_post_status === 'pending') {
    text = '⏸️ Fase 2 : Paused (Ready to Post)';
    color = '#f39c12';
    bg = 'rgba(243, 156, 18, 0.1)';
  }
  // 3. Active processing states
  else if (item.scrape_status === 'processing') {
    text = '⚡ Fase 1 : Downloading';
    color = 'var(--accent-light)';
    bg = 'rgba(59, 130, 246, 0.1)';
    pulse = true;
  } else if (item.scrape_status === 'pending') {
    text = '⏳ Fase 1 : Queue for Download';
    color = 'var(--text-muted)';
  } else if (item.analyze_status === 'processing') {
    text = '⚡ Fase 1 : AI Analyze';
    color = 'var(--accent-light)';
    bg = 'rgba(59, 130, 246, 0.1)';
    pulse = true;
  } else if (item.analyze_status === 'generating_t2i') {
    text = '⚡ Fase 1 : Generate Start Frame T2I';
    color = '#9b59b6';
    bg = 'rgba(155, 89, 182, 0.1)';
    pulse = true;
  } else if (item.analyze_status === 'pending' && item.scrape_status === 'downloaded') {
    text = '⏳ Fase 1 : Queue for Analysis';
    color = 'var(--text-muted)';
  } else if (item.tts_status === 'processing') {
    text = '⚡ Fase 2 : Generate TTS';
    color = 'var(--accent-light)';
    bg = 'rgba(59, 130, 246, 0.1)';
    pulse = true;
  } else if (item.tts_status === 'pending' && item.analyze_status === 'analyzed' && item.workflow_status === 'production_processing') {
    text = '⏳ Fase 2 : Queue for TTS';
    color = 'var(--text-muted)';
  } else if (item.visual_status === 'processing') {
    text = '⚡ Fase 2 : Generate Video';
    color = '#9b59b6';
    bg = 'rgba(155, 89, 182, 0.1)';
    pulse = true;
  } else if (item.visual_status === 'pending' && item.tts_status === 'completed') {
    text = '⏳ Fase 2 : Queue for Video';
    color = 'var(--text-muted)';
  } else if (item.ffmpeg_status === 'processing') {
    text = '⚡ Fase 2 : FFMPEG Process';
    color = '#3498db';
    bg = 'rgba(52, 152, 219, 0.1)';
    pulse = true;
  } else if (item.ffmpeg_status === 'pending' && item.visual_status === 'completed') {
    text = '⏳ Fase 2 : Queue for FFmpeg';
    color = 'var(--text-muted)';
  } else if (item.upload_status === 'uploading') {
    text = '⚡ Fase 2 : Uploading Assets';
    color = '#3498db';
    bg = 'rgba(52, 152, 219, 0.1)';
    pulse = true;
  } else if (item.social_post_status === 'processing') {
    text = '⚡ Fase 2 : Social Posting';
    color = '#e67e22';
    bg = 'rgba(230, 126, 34, 0.1)';
    pulse = true;
  }
  // 3.5 Paused Review
  else if (item.workflow_status === 'ready_for_review') {
    text = '⏸️ Fase 2 : Paused (Ready for Review)';
    color = '#f39c12';
    bg = 'rgba(243, 156, 18, 0.1)';
  }
  // 4. Completed states
  else if (item.social_post_status === 'completed' || item.upload_status === 'completed') {
    text = '✅ Fase 2 : Completed';
    color = 'var(--success)';
    bg = 'rgba(46, 204, 113, 0.1)';
  } else if (item.analyze_status === 'analyzed') {
    text = '✅ Fase 1 : Completed';
    color = 'var(--success)';
    bg = 'rgba(46, 204, 113, 0.1)';
  }

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '0.72rem',
      fontWeight: 600,
      color: color,
      backgroundColor: bg,
      border: `1px solid ${color}33`,
      whiteSpace: 'nowrap'
    }}>
      {pulse && (
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
          display: 'inline-block',
          animation: 'pulse-glow 1.5s infinite'
        }} />
      )}
      <span>{text}</span>
    </div>
  );
}

function renderSocialLinks(item) {
  if (item.social_post_status !== 'completed' || !item.social_links_json) return null;
  let links = {};
  try {
    links = JSON.parse(item.social_links_json);
  } catch {
    return null;
  }

  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
      {links.youtube && (
        <a href={links.youtube} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.7rem', textDecoration: 'none', background: '#FF0000', color: '#fff', padding: '3px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
          🎥 YouTube Draft
        </a>
      )}
      {links.tiktok && (
        <a href={links.tiktok} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.7rem', textDecoration: 'none', background: '#000000', color: '#fff', padding: '3px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, border: '1px solid rgba(255, 255, 255, 0.2)' }}>
          🎵 TikTok Draft
        </a>
      )}
      {links.facebook && (
        <a href={links.facebook} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.7rem', textDecoration: 'none', background: '#1877F2', color: '#fff', padding: '3px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
          👥 Facebook Draft
        </a>
      )}
    </div>
  );
}

function renderVariantPipelineStatus(variant) {
  const getStageStatus = (currentStatus) => {
    if (currentStatus === 'completed' || currentStatus === 'analyzed') return 'success';
    if (currentStatus === 'failed') return 'danger';
    if (currentStatus === 'processing' || currentStatus === 'uploading') return 'active';
    if (currentStatus === 'skipped') return 'skipped';
    return 'pending';
  };

  const stages = [
    { label: 'TTS', status: getStageStatus(variant.tts_status) },
    { label: 'Visuals', status: getStageStatus(variant.visual_status) },
    { label: 'FFmpeg', status: getStageStatus(variant.ffmpeg_status) },
    { label: 'Cloud', status: getStageStatus(variant.upload_status) }
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
        } else if (stage.status === 'skipped') {
          color = 'rgba(255, 255, 255, 0.3)';
          bg = 'rgba(255, 255, 255, 0.02)';
          border = '1px dashed rgba(255, 255, 255, 0.15)';
          labelText = `⚡ ${stage.label}`;
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
              padding: '3px 8px',
              borderRadius: 4,
              background: bg,
              color: color,
              fontWeight: 600,
              fontSize: '0.65rem',
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

function renderMiniPipeline(v) {
  const getDotStyle = (status) => {
    if (status === 'completed' || status === 'success') {
      return { color: '#2ecc71', label: '✓' };
    }
    if (status === 'failed') {
      return { color: '#e74c3c', label: '✗' };
    }
    if (status === 'processing' || status === 'uploading') {
      return { color: '#3498db', label: '⏳', pulse: true };
    }
    if (status === 'skipped') {
      return { color: 'rgba(255,255,255,0.25)', label: '⚡' };
    }
    return { color: 'rgba(255,255,255,0.1)', label: '●' };
  };

  const tts = getDotStyle(v.tts_status);
  const vis = getDotStyle(v.visual_status);
  const ffm = getDotStyle(v.ffmpeg_status);
  const cld = getDotStyle(v.upload_status);

  const stages = [
    { name: 'T', ...tts },
    { name: 'V', ...vis },
    { name: 'F', ...ffm },
    { name: 'C', ...cld },
  ];

  return (
    <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
      {stages.map(s => (
        <span 
          key={s.name} 
          style={{ 
            fontSize: '0.58rem', 
            background: 'rgba(0,0,0,0.3)', 
            padding: '1px 4px', 
            borderRadius: '3px', 
            border: `1px solid ${s.pulse ? '#3498db' : 'rgba(255,255,255,0.03)'}`,
            color: s.color,
            fontWeight: '700',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '1px',
            animation: s.pulse ? 'active-pulse 1s infinite alternate' : 'none'
          }}
          title={`${s.name === 'T' ? 'TTS' : s.name === 'V' ? 'Visuals' : s.name === 'F' ? 'FFmpeg' : 'Cloud'}: ${s.pulse ? 'Sedang Diproses' : s.label === '✓' ? 'Selesai' : s.label === '⚡' ? 'Dilewati' : 'Antre'}`}
        >
          <span>{s.label}</span>
          <span style={{ fontSize: '0.52rem', opacity: 0.6 }}>{s.name}</span>
        </span>
      ))}
    </div>
  );
}

function renderClipGlabsStatusAndPreview(item, clipIdx) {
  let activeTaskId = null;
  try {
    if (item.visual_tasks_json) {
      const parsed = JSON.parse(item.visual_tasks_json);
      if (Array.isArray(parsed)) {
        activeTaskId = parsed[clipIdx];
      }
    }
  } catch {}

  const task = item.glabs_tasks?.find(t => t.task_id === activeTaskId) || 
               item.glabs_tasks?.find(t => t.clip_index === clipIdx);

  let badgeText = '💤 Antre (Queue)';
  let badgeColor = 'var(--text-muted)';
  let badgeBg = 'rgba(255,255,255,0.05)';
  let badgeBorder = '1px solid rgba(255,255,255,0.1)';
  let anim = 'none';

  if (task) {
    if (task.status === 'completed') {
      badgeText = '✅ Selesai (Completed)';
      badgeColor = '#2ecc71';
      badgeBg = 'rgba(46, 204, 113, 0.1)';
      badgeBorder = '1px solid rgba(46, 204, 113, 0.3)';
    } else if (task.status === 'failed') {
      badgeText = '❌ Gagal (Failed)';
      badgeColor = '#e74c3c';
      badgeBg = 'rgba(231, 76, 60, 0.1)';
      badgeBorder = '1px solid rgba(231, 76, 60, 0.3)';
    } else if (task.status === 'processing') {
      badgeText = '⏳ Sedang Diproses (Processing)...';
      badgeColor = '#3498db';
      badgeBg = 'rgba(52, 152, 219, 0.1)';
      badgeBorder = '1px solid rgba(52, 152, 219, 0.3)';
      anim = 'active-pulse 1.5s infinite alternate';
    }
  } else if (item.visual_status === 'processing') {
    badgeText = '⏳ Sedang Diproses (Processing)...';
    badgeColor = '#3498db';
    badgeBg = 'rgba(52, 152, 219, 0.1)';
    badgeBorder = '1px solid rgba(52, 152, 219, 0.3)';
    anim = 'active-pulse 1.5s infinite alternate';
  }

  return (
    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>STATUS KLIP:</span>
        <span style={{
          padding: '2px 6px',
          borderRadius: 4,
          background: badgeBg,
          color: badgeColor,
          fontWeight: 'bold',
          fontSize: '0.65rem',
          border: badgeBorder,
          animation: anim,
          textTransform: 'uppercase',
          display: 'inline-flex',
          alignItems: 'center',
        }}>
          {badgeText}
        </span>
      </div>
      
      {task && task.status === 'completed' && task.video_url && (
        <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>🎬 Preview Klip (G-Labs)</span>
          <video 
            src={task.video_url} 
            controls 
            preload="metadata"
            style={{ 
              width: '100%', 
              maxHeight: '220px', 
              borderRadius: '6px', 
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: '#000'
            }} 
          />
        </div>
      )}
    </div>
  );
}

function renderVariantClipGlabsStatusAndPreview(variant, clipIdx) {
  let activeTaskId = null;
  try {
    if (variant.glabs_task_ids) {
      const parsed = JSON.parse(variant.glabs_task_ids);
      if (Array.isArray(parsed)) {
        activeTaskId = parsed[clipIdx];
      }
    }
  } catch {}

  const task = variant.glabs_tasks?.find(t => t.task_id === activeTaskId) || 
               variant.glabs_tasks?.find(t => t.clip_index === clipIdx);

  let badgeText = '💤 Antre (Queue)';
  let badgeColor = 'var(--text-muted)';
  let badgeBg = 'rgba(255,255,255,0.05)';
  let badgeBorder = '1px solid rgba(255,255,255,0.1)';
  let anim = 'none';

  if (task) {
    if (task.status === 'completed') {
      badgeText = '✅ Selesai (Completed)';
      badgeColor = '#2ecc71';
      badgeBg = 'rgba(46, 204, 113, 0.1)';
      badgeBorder = '1px solid rgba(46, 204, 113, 0.3)';
    } else if (task.status === 'failed') {
      badgeText = '❌ Gagal (Failed)';
      badgeColor = '#e74c3c';
      badgeBg = 'rgba(231, 76, 60, 0.1)';
      badgeBorder = '1px solid rgba(231, 76, 60, 0.3)';
    } else if (task.status === 'processing') {
      badgeText = '⏳ Sedang Diproses (Processing)...';
      badgeColor = '#3498db';
      badgeBg = 'rgba(52, 152, 219, 0.1)';
      badgeBorder = '1px solid rgba(52, 152, 219, 0.3)';
      anim = 'active-pulse 1.5s infinite alternate';
    }
  } else if (variant.visual_status === 'processing') {
    badgeText = '⏳ Sedang Diproses (Processing)...';
    badgeColor = '#3498db';
    badgeBg = 'rgba(52, 152, 219, 0.1)';
    badgeBorder = '1px solid rgba(52, 152, 219, 0.3)';
    anim = 'active-pulse 1.5s infinite alternate';
  }

  let localClipPath = null;
  if (variant.visual_clip_paths) {
    try {
      const paths = JSON.parse(variant.visual_clip_paths);
      if (Array.isArray(paths)) {
        localClipPath = paths[clipIdx];
      }
    } catch {}
  }

  return (
    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>STATUS KLIP:</span>
        <span style={{
          padding: '2px 6px',
          borderRadius: 4,
          background: badgeBg,
          color: badgeColor,
          fontWeight: 'bold',
          fontSize: '0.65rem',
          border: badgeBorder,
          animation: anim,
          textTransform: 'uppercase',
          display: 'inline-flex',
          alignItems: 'center',
        }}>
          {badgeText}
        </span>
      </div>
      
      {localClipPath ? (
        <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>🎬 Preview Klip (Lokal)</span>
          <video 
            src={localClipPath} 
            controls 
            preload="metadata"
            style={{ 
              width: '100%', 
              maxHeight: '220px', 
              borderRadius: '6px', 
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: '#000'
            }} 
          />
        </div>
      ) : (task && task.status === 'completed' && task.video_url && (
        <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>🎬 Preview Klip (G-Labs)</span>
          <video 
            src={task.video_url} 
            controls 
            preload="metadata"
            style={{ 
              width: '100%', 
              maxHeight: '220px', 
              borderRadius: '6px', 
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: '#000'
            }} 
          />
        </div>
      ))}
    </div>
  );
}

function renderVariantTimelineBanner(variant) {
  const getStageInfo = (currentStatus, activeText, pendingText, completedText, failedText) => {
    if (currentStatus === 'completed' || currentStatus === 'analyzed') {
      return { status: 'success', text: completedText, color: '#2ecc71', icon: '✓' };
    }
    if (currentStatus === 'failed') {
      return { status: 'danger', text: failedText, color: '#e74c3c', icon: '✗' };
    }
    if (currentStatus === 'processing' || currentStatus === 'uploading') {
      return { status: 'active', text: activeText, color: '#3498db', icon: '⏳', pulse: true };
    }
    if (currentStatus === 'skipped') {
      return { status: 'skipped', text: 'Dilewati (Skipped)', color: 'rgba(255, 255, 255, 0.3)', icon: '⚡' };
    }
    return { status: 'pending', text: pendingText, color: 'var(--text-muted)', icon: '●' };
  };

  const tts = getStageInfo(variant.tts_status, '🎙️ Sedang TTS...', '⏳ Antre TTS', '🎙️ TTS Selesai', '❌ TTS Gagal');
  const vis = getStageInfo(variant.visual_status, '🎨 Sedang Render Visual...', '⏳ Antre Visual', '🎨 Visual Selesai', '❌ Visual Gagal');
  const ffm = getStageInfo(variant.ffmpeg_status, '🛠️ Sedang FFmpeg Muxing...', '⏳ Antre FFmpeg', '🛠️ FFmpeg Selesai', '❌ FFmpeg Gagal');
  const cld = getStageInfo(variant.upload_status, '☁️ Sedang Unggah Cloud...', '⏳ Antre Unggah', '☁️ Upload Selesai', '❌ Upload Gagal');

  const stages = [
    { key: 'tts', label: '1. TTS Voiceover', ...tts },
    { key: 'vis', label: '2. G-Labs Video', ...vis },
    { key: 'ffm', label: '3. FFmpeg Muxing', ...ffm },
    { key: 'cld', label: '4. Cloud Storage', ...cld },
  ];

  return (
    <div style={{ 
      background: 'var(--bg-glass)', 
      border: '1px solid var(--border)', 
      borderRadius: '10px', 
      padding: '16px 20px', 
      marginBottom: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          🚀 Pipeline Rendering Status
        </span>
        {variant.visual_status === 'processing' && (
          <span style={{ fontSize: '0.72rem', color: '#9b59b6', animation: 'pulse-glow 1.5s infinite', fontWeight: '600' }}>
            🎨 Sedang Menghasilkan Visual Klip...
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'nowrap', overflowX: 'auto', padding: '4px 0' }}>
        {stages.map((s, idx) => {
          let bg = 'rgba(255,255,255,0.01)';
          let border = '1px solid rgba(255,255,255,0.05)';
          let shadow = 'none';

          if (s.status === 'success') {
            bg = 'rgba(46, 204, 113, 0.08)';
            border = '1px solid rgba(46, 204, 113, 0.3)';
          } else if (s.status === 'active') {
            bg = 'rgba(52, 152, 219, 0.12)';
            border = '1px solid var(--accent-light)';
            shadow = '0 0 10px rgba(52, 152, 219, 0.15)';
          } else if (s.status === 'danger') {
            bg = 'rgba(231, 76, 60, 0.08)';
            border = '1px solid rgba(231, 76, 60, 0.3)';
          } else if (s.status === 'skipped') {
            bg = 'rgba(255,255,255,0.005)';
            border = '1px dashed rgba(255,255,255,0.1)';
          }

          return (
            <Fragment key={s.key}>
              <div style={{
                flex: 1,
                minWidth: '150px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: bg,
                border: border,
                boxShadow: shadow,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                position: 'relative',
                animation: s.pulse ? 'active-pulse 2s infinite alternate' : 'none'
              }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                  {s.label}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <span style={{ 
                    color: s.color, 
                    fontWeight: 'bold', 
                    fontSize: '0.85rem',
                    animation: s.pulse ? 'pulse-glow 1s infinite' : 'none'
                  }}>
                    {s.icon}
                  </span>
                  <span style={{ fontSize: '0.78rem', fontWeight: '600', color: s.status === 'pending' ? 'var(--text-muted)' : '#fff' }}>
                    {s.text}
                  </span>
                </div>
              </div>
              {idx < stages.length - 1 && (
                <span style={{ 
                  color: s.status === 'success' ? '#2ecc71' : 'rgba(255,255,255,0.1)', 
                  fontSize: '1rem',
                  fontWeight: 'bold'
                }}>
                  ➔
                </span>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

export default function RECampaignDetailPage() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [voiceCast, setVoiceCast] = useState([]);
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [storageProvider, setStorageProvider] = useState('gdrive');
  const [nextcloudUrl, setNextcloudUrl] = useState('');
  
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Expanded storyboard & voiceover detail states (v6.7)
  const [expandedItemId, setExpandedItemId] = useState(null);
  const [activeTabs, setActiveTabs] = useState({}); // Stores { [itemId]: 'storyboard' | 'voiceover' | 't2v' | 'captions' }
  const [copySuccess, setCopySuccess] = useState({}); // Stores { [key]: boolean }
  const [triggering, setTriggering] = useState({});
  const [downloading, setDownloading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // RE+AM states
  const [activeAngleTabs, setActiveAngleTabs] = useState({}); // { [itemId]: variantId }
  const [editedClips, setEditedClips] = useState({}); // { [variantId]: [ { voiceover, t2v_prompt }, ... ] }
  const [savingClips, setSavingClips] = useState({}); // { [variantId]: boolean }

  function renderLogs(item) {
    const getBadgeStyle = (status) => {
      if (status === 'completed' || status === 'success') {
        return { color: '#2ecc71', background: 'rgba(46, 204, 113, 0.1)', border: '1px solid rgba(46, 204, 113, 0.3)' };
      }
      if (status === 'failed') {
        return { color: '#e74c3c', background: 'rgba(231, 76, 60, 0.1)', border: '1px solid rgba(231, 76, 60, 0.3)' };
      }
      if (status === 'processing' || status === 'uploading') {
        return { color: '#3498db', background: 'rgba(52, 152, 219, 0.1)', border: '1px solid rgba(52, 152, 219, 0.3)' };
      }
      return { color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' };
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 8 }}>
          <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 8, color: 'var(--text-primary)' }}>Detail Teknis Pipeline & Variabel:</div>
          <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>ID Item</td><td style={{ padding: '6px 0', fontWeight: 600 }}>#{item.id}</td></tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Voiceover Provider</td><td style={{ padding: '6px 0' }}>{campaign?.voice_provider} ({campaign?.voice_persona})</td></tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Visual Mode</td><td style={{ padding: '6px 0' }}>{campaign?.visual_mode}</td></tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Retry Count</td><td style={{ padding: '6px 0' }}>{item.retry_count || 0} kali</td></tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>
                  {storageProvider === 'nextcloud' ? 'Nextcloud Upload Status' : 'Google Drive Upload Status'}
                </td>
                <td style={{ padding: '6px 0' }}>
                  <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600, ...getBadgeStyle(item.upload_status) }}>
                    {item.upload_status || 'pending'}
                  </span>
                </td>
              </tr>
              <tr>
                <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>
                  {storageProvider === 'nextcloud' ? 'Nextcloud Storage Link' : 'Google Drive Folder'}
                </td>
                <td style={{ padding: '6px 0' }}>
                  {storageProvider === 'nextcloud' ? (
                    (item.nextcloud_url || (item.drive_link && (item.drive_link.includes('100.78.186.123') || item.drive_link.includes('index.php/s/')))) ? (
                      <a href={item.nextcloud_url || item.drive_link} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'underline' }}>
                        Buka Nextcloud ➔
                      </a>
                    ) : '(Belum diunggah)'
                  ) : (
                    (item.drive_link && !item.drive_link.includes('100.78.186.123')) ? (
                      <a href={item.drive_link} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'underline' }}>
                        Buka Google Drive ➔
                      </a>
                    ) : '(Belum diunggah)'
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {item.glabs_tasks && item.glabs_tasks.length > 0 && (
          <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 8 }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 8, color: 'var(--text-primary)' }}>Antrean Video Task (GLabs):</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {item.glabs_tasks.map(task => (
                <div key={task.task_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: 6, fontSize: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>Task ID: {task.task_id}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Klip {task.clip_index + 1} | Prompt: {task.prompt.slice(0, 50)}...</div>
                  </div>
                  <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600, ...getBadgeStyle(task.status) }}>
                    {task.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
  const [renderingVariants, setRenderingVariants] = useState({}); // { [variantId]: boolean }
  const [angleOptions, setAngleOptions] = useState({}); // { [variantId]: { enable_tts: boolean, enable_ffmpeg: boolean } }
  const [replacingImage, setReplacingImage] = useState(false);

  // V2 Human-in-the-Loop & Video DNA state hooks
  const [editedVideoPlans, setEditedVideoPlans] = useState({}); // { [itemId]: [...] }
  const [editedVideoDnas, setEditedVideoDnas] = useState({}); // { [itemId]: {...} }
  const [approvingItems, setApprovingItems] = useState({}); // { [itemId]: boolean }
  const [savingDraft, setSavingDraft] = useState({}); // { [itemId]: boolean }
  const [regeneratingT2I, setRegeneratingT2I] = useState({}); // { [itemId_clipIdx]: boolean }
  const [replacingSF, setReplacingSF] = useState({}); // { [itemId_clipIdx]: boolean }
  const [showOriginalDecon, setShowOriginalDecon] = useState({}); // { [itemId]: boolean }
  const [regeneratingItemSF, setRegeneratingItemSF] = useState({});
  const [workflowSettings, setWorkflowSettings] = useState({}); // { [itemId]: { enable_tts, enable_glabs, enable_ffmpeg } }
  const [activeRowTabs, setActiveRowTabs] = useState({}); // { [itemId]: 'decon' | 'storyboard' | 'dna' | 'assets' }
  const [syncingAssets, setSyncingAssets] = useState({});
  const [retryingI2V, setRetryingI2V] = useState({});
  const [selectedVoVersions, setSelectedVoVersions] = useState({}); // { [itemId]: 'original' | 'safe' }
  const [cacheBuster, setCacheBuster] = useState(Date.now());

  // Accordion Clip state
  const [activeClipIndex, setActiveClipIndex] = useState({});
  const toggleClip = (itemId, idx) => {
    setActiveClipIndex(prev => {
      const currentActive = prev[itemId] !== undefined ? prev[itemId] : 0;
      return {
        ...prev,
        [itemId]: currentActive === idx ? -1 : idx
      };
    });
  };


  async function handleProductImageReplace(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setReplacingImage(true);
    const formData = new FormData();
    formData.append('product_media', file);
    formData.append('product_filename_declare', file.name);

    try {
      const res = await fetch(`/api/v2/re-campaigns/${id}/replace-image`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        showToast('Foto produk berhasil diperbarui!');
        fetchDetail();
      } else {
        showToast(`Gagal memperbarui foto produk: ${data.error || 'Terjadi kesalahan'}`, 'error');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setReplacingImage(false);
    }
  }

  async function updateCampaignSettings(fields) {
    try {
      const res = await fetch(`/api/v2/re-campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      });
      if (!res.ok) throw new Error('Gagal memperbarui pengaturan kampanye');
      fetchDetail();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  const MINIMAX_VOICES = [
    { id: 'Indonesian_energetic_streamer_vv2', name: '⚡ Energetic Streamer (Male)', avatar: '😊' },
    { id: 'Indonesian_crisp_reporter_vv2', name: '🎙 Crisp Reporter (Female)', avatar: '🎙' },
    { id: 'Indonesian_professional_anchor_vv2', name: '📺 Professional Anchor (Female)', avatar: '📺' },
    { id: 'Indonesian_casual_reporter_vv2', name: '😊 Casual Reporter (Male)', avatar: '😊' },
    { id: 'Indonesian_intellectual_commentator_vv2', name: '🧠 Intellectual Commentator (Female)', avatar: '🧠' },
    { id: 'Indonesian_compelling_storyteller_vv2', name: '📖 Compelling Storyteller (Male)', avatar: '📖' },
    { id: 'Indonesian_expressive_podcaster_vv2', name: '🎤 Expressive Podcaster (Male)', avatar: '🎤' }
  ];

  const MINIMAX_ENGLISH_VOICES = [
    { id: 'male-rad-presenter', name: 'Male Rad Presenter', avatar: '🧔' },
    { id: 'female-active-presenter', name: 'Female Active Presenter', avatar: '👩' },
    { id: 'male-crisp-presenter', name: 'Male Crisp Presenter', avatar: '🧔' },
    { id: 'female-casual-presenter', name: 'Female Casual Presenter', avatar: '👩' }
  ];

  const handleSaveVoiceCast = async () => {
    await updateCampaignSettings({
      voice_cast_json: JSON.stringify({ characters: voiceCast })
    });
    showToast('Voice Cast berhasil disimpan!');
  };

  const handleClipEdit = (variantId, clipIdx, field, val) => {
    const variant = items.flatMap(item => item.angle_variants || []).find(v => v.id === variantId);
    const currentClips = editedClips[variantId] || JSON.parse(variant?.visual_tasks_json || '[]');
    const newClips = [...currentClips];
    newClips[clipIdx] = { ...newClips[clipIdx], [field]: val };
    setEditedClips(prev => ({ ...prev, [variantId]: newClips }));
  };

  async function saveVariantClips(variantId) {
    const clipsToSave = editedClips[variantId];
    if (!clipsToSave) return;
    setSavingClips(prev => ({ ...prev, [variantId]: true }));
    try {
      const res = await fetch(`/api/v2/re-campaigns/angle-variants/${variantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visual_tasks_json: JSON.stringify(clipsToSave) })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        fetchDetail();
      } else {
        showToast(`Gagal menyimpan: ${data.error || 'Terjadi kesalahan'}`, 'error');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setSavingClips(prev => ({ ...prev, [variantId]: false }));
    }
  }

  async function triggerAngleRender(variantId) {
    const opts = angleOptions[variantId] || { enable_tts: false, enable_ffmpeg: false };
    setRenderingVariants(prev => ({ ...prev, [variantId]: true }));
    try {
      const res = await fetch(`/api/v2/re-campaigns/angle-render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          angle_variant_id: variantId,
          enable_tts: opts.enable_tts,
          enable_ffmpeg: opts.enable_ffmpeg
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        fetchDetail();
      } else {
        showToast(`Gagal: ${data.error || 'Terjadi kesalahan'}`, 'error');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setRenderingVariants(prev => ({ ...prev, [variantId]: false }));
    }
  }

  async function triggerManualStep(itemId, step) {
    if (!confirm(`Apakah Anda yakin ingin memicu proses ${step.toUpperCase()} secara manual?`)) return;
    setTriggering(prev => ({ ...prev, [`${itemId}-${step}`]: true }));
    try {
      const res = await fetch(`/api/v2/re-campaigns/items/${itemId}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        fetchDetail();
      } else {
        showToast(`Gagal: ${data.error || 'Terjadi kesalahan'}`, 'error');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setTriggering(prev => ({ ...prev, [`${itemId}-${step}`]: false }));
    }
  }

  async function handleRetryItem(itemId) {
    if (!confirm('Apakah Anda yakin ingin mencoba ulang (retry) langkah yang gagal pada adegan ini?')) return;
    try {
      const res = await fetch(`/api/v2/re-campaigns/items/${itemId}/retry`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        showToast('Langkah yang gagal berhasil di-retry!');
        fetchDetail();
      } else {
        showToast(`Gagal: ${data.error || 'Terjadi kesalahan'}`, 'error');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  }

  async function handleResetItem(itemId) {
    if (!confirm('⚠️ PERINGATAN: Aksi ini akan menghapus semua hasil pengerjaan adegan ini dan mengulangnya kembali dari awal scraping. Apakah Anda yakin ingin melakukan reset?')) return;
    try {
      const res = await fetch(`/api/v2/re-campaigns/items/${itemId}/reset`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        showToast('Adegan berhasil di-reset ke tahap awal!');
        fetchDetail();
      } else {
        showToast(`Gagal: ${data.error || 'Terjadi kesalahan'}`, 'error');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  }

  function handleCopy(text, key) {
    writeToClipboard(text).then(() => {
      setCopySuccess(prev => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopySuccess(prev => ({ ...prev, [key]: false }));
      }, 2000);
    }).catch(err => {
      console.error('Gagal menyalin teks:', err);
    });
  }

  function generateClientMarkdown() {
    const lines = [];
    lines.push(`# Campaign Batch: ${campaign.campaign_name}`);
    lines.push(`- **Campaign ID (Batch ID):** \`${campaign.id}\``);
    lines.push(`- **Status:** ${campaign.status}`);

    lines.push(`- **Aspect Ratio:** ${campaign.aspect_ratio || '9:16'}`);
    lines.push(`- **Target AI:** ${campaign.target_ai || 'Google Veo (8s)'}`);
    if (campaign.visual_overrides_json) {
      try {
        const vso = JSON.parse(campaign.visual_overrides_json);
        lines.push(`- **Visual Swap Overrides:**`);
        lines.push(`  - **Concept:** ${vso.character_concept || '-'}`);
        lines.push(`  - **Demographic:** ${vso.subject_demographic || '-'}`);
        lines.push(`  - **Wardrobe:** ${vso.wardrobe_style || '-'}${vso.wardrobe_style === 'custom' ? ` (${vso.wardrobe_style_custom || ''})` : ''}`);
        lines.push(`  - **Lighting:** ${vso.lighting_style || '-'}${vso.lighting_style === 'custom' ? ` (${vso.lighting_style_custom || ''})` : ''}`);
      } catch (e) {
        lines.push(`- **Visual Swap Overrides:** invalid JSON`);
      }
    }
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(`## 📋 Daftar URL (${items.length})`);
    items.forEach((item, idx) => {
      const statuses = [
        `Scraped: ${item.scrape_status || 'pending'}`,
        `Analyzed: ${item.analyze_status || 'pending'}`,
        `TTS: ${item.tts_status || 'pending'}`,
        `Visuals: ${item.visual_status || 'pending'}`,
        `FFmpeg: ${item.ffmpeg_status || 'pending'}`,
        `Cloud: ${item.upload_status || 'pending'}`,
        `Social: ${item.social_post_status || 'pending'}`
      ].join(' | ');
      lines.push(`${idx + 1}. [${item.source_url}](${item.source_url}) - Status: ${statuses}`);
    });
    lines.push('');

    items.forEach((item, idx) => {
      lines.push('---');
      lines.push('');
      lines.push(`## 🔗 Item ${idx + 1}: ${item.source_url}`);
      lines.push('');

      if (item.analyze_status !== 'analyzed' && item.analyze_status !== 'completed') {
        lines.push(`> *Item belum selesai dianalisis. Status: ${item.analyze_status}*`);
        lines.push('');
        return;
      }

      if (item.angle_variants && item.angle_variants.length > 0) {
        lines.push(`### ⚡ Variasi Multi-Angle (RE+AM V8.3)`);
        lines.push('');
        item.angle_variants.forEach((v, vIdx) => {
          lines.push(`#### Angle ${vIdx + 1}: ${v.angle_name}`);
          lines.push(`- **Kategori:** ${v.angle_category} | **Strategi Matriks:** ${v.matrix_strategy_used} | **Target Kognitif:** ${v.system_targeting}`);
          lines.push(`- **Voice Persona:** ${v.voice_persona_assigned}`);
          lines.push(`- **Deskripsi Taktik:** ${v.angle_description}`);
          if (v.drive_link) {
            lines.push(`- **Drive Link:** [Google Drive](${v.drive_link})`);
          }
          lines.push('');
          
          let clips = [];
          try {
            clips = JSON.parse(v.visual_tasks_json || '[]');
          } catch(e) {}
          
          lines.push('##### Storyboard & Naskah');
          lines.push('| Clip | Voiceover Narration | Visual T2V Prompt |');
          lines.push('|---|---|---|');
          clips.forEach((clip, cIdx) => {
            lines.push(`| ${clip.clip_index || cIdx + 1} | ${clip.voiceover || '-'} | ${clip.t2v_prompt || '-'} |`);
          });
          lines.push('');
        });
        return;
      }

      let parsed = {};
      if (item.result_json) {
        try {
          parsed = JSON.parse(item.result_json);
        } catch (e) {
          lines.push('> *Gagal memproses data analisis JSON.*');
          lines.push('');
          return;
        }
      }

      // 💡 Analisis & Strategi Upgrade
      const summary = parsed.analysis_summary || {};
      lines.push('### 💡 Analisis & Strategi Upgrade');
      lines.push(`- **Original Hook Analysis:** ${summary.original_hook_analysis || '-'}`);
      lines.push(`- **Weakness Identified:** ${summary.weakness_identified || '-'}`);
      lines.push(`- **The Upgrade Strategy:** ${summary.the_upgrade_strategy || '-'}`);
      lines.push('');

      // 🎬 Storyboard
      lines.push('### 🎬 Storyboard');
      lines.push('| Scene | Duration | Visual Description | Camera Movement | Audio & SFX Mood |');
      lines.push('|---|---|---|---|---|');
      const storyboard = parsed.storyboard || [];
      if (storyboard.length === 0) {
        lines.push('| - | - | - | - | - |');
      } else {
        storyboard.forEach((s, sIdx) => {
          const sceneNum = s.scene || sIdx + 1;
          lines.push(`| ${sceneNum} | ${s.duration || '-'} | ${s.visual_description || '-'} | ${s.camera_movement || '-'} | ${s.audio_mood || '-'} |`);
        });
      }
      lines.push('');

      // 🎙️ Voiceover Script
      lines.push('### 🎙️ Voiceover Script');
      const voiceover = parsed.voiceover || [];
      if (voiceover.length === 0) {
        lines.push('*Tidak ada data voiceover.*');
      } else {
        voiceover.forEach((v, vIdx) => {
          const sceneNum = v.scene || vIdx + 1;
          lines.push(`- **Scene ${sceneNum} (${v.duration || '-'}):**`);
          lines.push(`  > "${v.narration || '-'}"`);
        });
      }
      lines.push('');

      // 🤖 T2V Prompts
      const prompts = parsed.t2v_prompts || [];
      if (prompts.length > 0) {
        lines.push('### 🤖 T2V Prompts');
        prompts.forEach((p, pIdx) => {
          const clipNum = p.clip || pIdx + 1;
          lines.push(`#### Clip ${clipNum} (${p.duration || 'Estimated Duration'})`);
          lines.push(`- **Scenes:** ${p.scenes_covered || '-'} | **Motion:** ${p.motion_type || '-'} | **Camera:** ${p.camera_movement || '-'} | **Style:** ${p.style || '-'}`);
          lines.push('- **Prompt:**');
          lines.push('  ```');
          lines.push(`  ${p.prompt || ''}`);
          lines.push('  ```');
        });
        lines.push('');
      }

      // 📸 T2I Prompts
      const t2iPrompts = parsed.t2i_prompts || [];
      if (t2iPrompts.length > 0) {
        lines.push('### 📸 T2I Prompts');
        t2iPrompts.forEach((p, pIdx) => {
          const clipNum = p.clip || pIdx + 1;
          lines.push(`#### Clip ${clipNum} (Start Frame)`);
          lines.push('- **Prompt:**');
          lines.push('  ```');
          lines.push(`  ${p.prompt || ''}`);
          lines.push('  ```');
        });
        lines.push('');
      }

      // 🎥 I2V Prompts
      const i2vPrompts = parsed.i2v_prompts || [];
      if (i2vPrompts.length > 0) {
        lines.push('### 🎥 I2V Prompts');
        i2vPrompts.forEach((p, pIdx) => {
          const clipNum = p.clip || pIdx + 1;
          lines.push(`#### Clip ${clipNum} (Animation)`);
          lines.push('- **Prompt:**');
          lines.push('  ```');
          lines.push(`  ${p.prompt || ''}`);
          lines.push('  ```');
        });
        lines.push('');
      }

      // 📲 Captions & Metadata
      lines.push('### 📲 Captions & Metadata');
      lines.push('- **TikTok Caption:**');
      lines.push('  ```');
      lines.push(`  ${parsed.tiktok_caption || ''}`);
      lines.push('  ```');
      lines.push('- **Instagram Caption:**');
      lines.push('  ```');
      lines.push(`  ${parsed.ig_caption || ''}`);
      lines.push('  ```');
      lines.push(`- **YouTube Title:** \`${parsed.yt_title || ''}\``);
      lines.push('- **YouTube Description:**');
      lines.push('  ```');
      lines.push(`  ${parsed.yt_desc || ''}`);
      lines.push('  ```');
      lines.push('');
    });

    return lines.join('\n');
  }

  async function handleDownloadMarkdown() {
    setDownloading(true);
    try {
      const sanitizedName = campaign.campaign_name.replace(/[^a-zA-Z0-9-\s_]/g, '').trim() || campaign.id;
      const filename = `${sanitizedName}.md`;

      // 1. Generate client-side markdown and trigger immediate download
      const md = generateClientMarkdown();
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      showToast(`Gagal mendownload markdown: ${err.message}`, 'error');
    } finally {
      setDownloading(false);
    }
  }

  async function handleRegenerateItemStartFrames(itemId) {
    if (!confirm('Apakah Anda yakin ingin me-regenerate semua start frame untuk baris kampanye ini? Proses ini akan memakan waktu beberapa menit karena ada delay aman 10-20 detik per prompt.')) {
      return;
    }
    setRegeneratingItemSF(prev => ({ ...prev, [itemId]: true }));
    try {
      const res = await fetch(`/api/v2/re-campaigns/items/${itemId}/regenerate-start-frames`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        showToast('Regenerasi start frame telah dimulai di latar belakang. Progres akan diperbarui secara otomatis.');
        fetchDetail();
      } else {
        showToast(`Gagal: ${data.error || 'Terjadi kesalahan'}`, 'error');
      }
    } catch (err) {
      showToast(`Gagal: ${err.message}`, 'error');
    } finally {
      setRegeneratingItemSF(prev => ({ ...prev, [itemId]: false }));
    }
  }

  async function handleSyncDrive() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/v2/re-campaigns/${id}/export-markdown`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Sukses sinkronisasi! Berkas dan aset telah diunggah ke cloud storage.`);
        fetchDetail();
      } else {
        showToast(`Peringatan: Gagal melakukan sinkronisasi ke cloud storage: ${data.error}`, 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(`Peringatan: Gagal melakukan sinkronisasi ke cloud: ${err.message}`, 'error');
    } finally {
      setSyncing(false);
    }
  }

  function renderAngleVariantWorkspace(variant) {
    if (!variant) return null;

    let clips = [];
    try {
      clips = editedClips[variant.id] || JSON.parse(variant.visual_tasks_json || '[]');
    } catch (e) {
      clips = [];
    }

    const originalClipsStr = variant.visual_tasks_json || '[]';
    const currentClipsStr = JSON.stringify(clips);
    const hasChanges = originalClipsStr !== currentClipsStr;

    const opts = angleOptions[variant.id] || { enable_tts: false, enable_ffmpeg: false };
    const setOpt = (field, val) => {
      setAngleOptions(prev => ({
        ...prev,
        [variant.id]: {
          ...opts,
          [field]: val
        }
      }));
    };

    const isRendering = !!renderingVariants[variant.id];
    const isSaving = !!savingClips[variant.id];

    let visualClipPaths = [];
    if (variant.visual_clip_paths) {
      try {
        visualClipPaths = JSON.parse(variant.visual_clip_paths);
      } catch (e) {
        console.error('Failed to parse visual_clip_paths:', e);
      }
    }

    // Determine category styling
    let catColor = 'var(--accent-light)';
    let catBg = 'rgba(108, 92, 231, 0.1)';
    if (variant.angle_category === 'Ego') {
      catColor = '#ff6b81';
      catBg = 'rgba(255, 107, 129, 0.1)';
    } else if (variant.angle_category === 'Brain') {
      catColor = '#70a1ff';
      catBg = 'rgba(112, 161, 255, 0.1)';
    } else if (variant.angle_category === 'Gut') {
      catColor = '#2ecc71';
      catBg = 'rgba(46, 204, 113, 0.1)';
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: 'var(--text-primary)', textAlign: 'left' }}>
        
        {/* 1. Pipeline Status (Timeline Banner) */}
        {renderVariantTimelineBanner(variant)}

        {/* Product Reference Card */}
        {(campaign.is_bridging_active === 1 || campaign.product_ref_image_path) && (
          <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              📦 Foto Produk Referensi (Pixel Lock)
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '120px', height: '120px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {campaign.product_ref_image_path ? (
                  <img
                    src={campaign.product_ref_image_path}
                    alt="Product Reference"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', padding: '8px' }}>
                    Belum ada foto produk
                  </div>
                )}
              </div>
              <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600' }}>
                  {campaign.product_filename_declare || 'Product Reference Image'}
                </span>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  Foto produk ini akan di-blend bersama prompt T2I pada klip ke-N untuk menjaga konsistensi produk. Pastikan foto sudah sesuai dengan keinginan Anda.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <label 
                    className="btn btn-secondary" 
                    style={{ 
                      padding: '6px 12px', 
                      fontSize: '0.75rem', 
                      cursor: 'pointer',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '4px',
                      color: '#fff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {campaign.product_ref_image_path ? '✏️ Replace Foto Produk' : '📤 Upload Foto Produk'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleProductImageReplace(e)}
                      style={{ display: 'none' }}
                    />
                  </label>
                  {replacingImage && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>⏳ Mengunggah...</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. Strategic Metadata Card */}
        <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🧠 Strategic Metadata
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Kategori Value:</span>
              <span style={{ color: catColor, background: catBg, padding: '2px 6px', borderRadius: '4px', fontWeight: '600', fontSize: '0.72rem' }}>
                {variant.angle_category}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Strategi Matriks:</span>
              <span style={{ fontWeight: '600' }}>{variant.matrix_strategy_used}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Target Kognitif:</span>
              <span style={{ fontWeight: '600', color: variant.system_targeting === 'System 1' ? '#ff4757' : '#2ed573' }}>
                {variant.system_targeting}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Nusa Voice Persona:</span>
              <span style={{ fontWeight: '600', color: 'var(--accent-light)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                🎙️ {variant.voice_persona_assigned}
              </span>
            </div>
            <div style={{ marginTop: '8px' }}>
              <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Taktik Kognitif:</span>
              <p style={{ margin: 0, fontSize: '0.78rem', lineHeight: '1.4', background: 'rgba(0,0,0,0.15)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)' }}>
                {variant.angle_description}
              </p>
            </div>
          </div>
        </div>

        {/* 3. Storyboard & Clip Editor Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              🎬 Storyboard & Clip Editor
            </h4>
            {hasChanges && (
              <button
                type="button"
                onClick={() => saveVariantClips(variant.id)}
                disabled={isSaving}
                className="btn btn-primary"
                style={{
                  padding: '6px 14px',
                  fontSize: '0.78rem',
                  fontWeight: '600',
                  boxShadow: '0 4px 10px rgba(108, 92, 231, 0.3)'
                }}
              >
                {isSaving ? '⏳ Menyimpan...' : '💾 Simpan Perubahan Naskah & Prompt'}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {clips.map((clip, idx) => {
              const ttsClip = variant.tts_clips?.find(c => c.clip_index === idx);
              return (
                <div
                  key={idx}
                  style={{
                    background: 'var(--bg-glass)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '700', color: 'var(--accent-light)', fontSize: '0.85rem' }}>
                      Klip #{idx + 1}
                    </span>
                    {ttsClip && ttsClip.status === 'completed' && (
                      <span style={{ fontSize: '0.65rem', color: '#2ecc71', background: 'rgba(46,204,113,0.1)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                        🎙️ Audio Ready
                      </span>
                    )}
                  </div>

                  {/* Form fields for edit: VO and Prompt are stacked vertically (no grid!) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase' }}>
                        Voiceover Narration (Bahasa)
                      </label>
                      <textarea
                        value={clip.voiceover || ''}
                        onChange={(e) => handleClipEdit(variant.id, idx, 'voiceover', e.target.value)}
                        style={{
                          width: '100%',
                          minHeight: '60px',
                          background: 'rgba(0, 0, 0, 0.2)',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          color: '#fff',
                          padding: '8px',
                          fontSize: '0.78rem',
                          fontFamily: 'var(--font-sans)',
                          lineHeight: '1.4',
                          resize: 'vertical',
                          outline: 'none'
                        }}
                      />
                    </div>

                    {campaign.visual_mode === 'hybrid_lock' && (idx + 1) >= (campaign.bridge_at_clip || 3) && ((campaign.bridge_duration_clips || 0) === 0 || (idx + 1) < (campaign.bridge_at_clip || 3) + (campaign.bridge_duration_clips || 0)) ? (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div>
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase' }}>
                              Visual Prompt T2I (Start Frame - English)
                            </label>
                            <textarea
                              value={clip.t2i_prompt || ''}
                              onChange={(e) => handleClipEdit(variant.id, idx, 't2i_prompt', e.target.value)}
                              style={{
                                width: '100%',
                                minHeight: '60px',
                                background: 'rgba(0, 0, 0, 0.2)',
                                border: '1px solid var(--border)',
                                borderRadius: '6px',
                                color: '#dfe4ea',
                                padding: '8px',
                                fontSize: '0.74rem',
                                fontFamily: 'var(--font-mono)',
                                lineHeight: '1.4',
                                resize: 'vertical',
                                outline: 'none'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase' }}>
                              Visual Prompt I2V (Motion - English)
                            </label>
                            <textarea
                              value={clip.i2v_prompt || ''}
                              onChange={(e) => handleClipEdit(variant.id, idx, 'i2v_prompt', e.target.value)}
                              style={{
                                width: '100%',
                                minHeight: '60px',
                                background: 'rgba(0, 0, 0, 0.2)',
                                border: '1px solid var(--border)',
                                borderRadius: '6px',
                                color: '#dfe4ea',
                                padding: '8px',
                                fontSize: '0.74rem',
                                fontFamily: 'var(--font-mono)',
                                lineHeight: '1.4',
                                resize: 'vertical',
                                outline: 'none'
                              }}
                            />
                          </div>
                        </div>

                        {variant.t2i_start_frame_paths?.[idx + 1] && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>T2I Start Frame (Pixel Lock):</div>
                            <img 
                              src={variant.t2i_start_frame_paths[idx + 1]} 
                              alt="Pixel Lock Start Frame" 
                              style={{ maxWidth: '160px', borderRadius: '4px', border: '1px solid var(--border)' }} 
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      clip.t2v_prompt ? (
                        <div>
                          <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase' }}>
                            Visual Prompt T2V (English)
                          </label>
                          <textarea
                            value={clip.t2v_prompt || ''}
                            onChange={(e) => handleClipEdit(variant.id, idx, 't2v_prompt', e.target.value)}
                            style={{
                              width: '100%',
                              minHeight: '60px',
                              background: 'rgba(0, 0, 0, 0.2)',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              color: '#dfe4ea',
                              padding: '8px',
                              fontSize: '0.74rem',
                              fontFamily: 'var(--font-mono)',
                              lineHeight: '1.4',
                              resize: 'vertical',
                              outline: 'none'
                            }}
                          />
                        </div>
                      ) : null
                    )}
                  </div>

                  {/* Audio Player if TTS is ready */}
                  {variant.tts_status === 'completed' && ttsClip && ttsClip.status === 'completed' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>🎙️ Generated Voiceover Audio:</span>
                      <audio
                        src={ttsClip.audio_path}
                        controls
                        style={{ width: '100%', height: '32px', borderRadius: '4px' }}
                      />
                    </div>
                  )}

                  {/* Video Clip Player if visual is ready or show individual status/preview */}
                  {variant.visual_status === 'completed' && visualClipPaths && visualClipPaths[idx] ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>🎬 Generated Visual Clip (Lokal):</span>
                      <video
                        src={visualClipPaths[idx]}
                        controls
                        preload="metadata"
                        style={{ width: '100%', maxHeight: '360px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', background: '#000' }}
                      />
                    </div>
                  ) : (
                    renderVariantClipGlabsStatusAndPreview(variant, idx)
                  )}

                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Konfigurasi Render & Output Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ⚙️ Konfigurasi Render
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={opts.enable_tts}
                    onChange={(e) => setOpt('enable_tts', e.target.checked)}
                  />
                  <span className="slider"></span>
                </label>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Aktifkan TTS Voiceover</span>
              </div>
              
              {opts.enable_tts && (
                campaign.enable_tts === 1 ? (
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.78rem', marginTop: '-4px', marginBottom: '4px' }}>
                    🎙️ <b>TTS Dikonfigurasi (Awal):</b> {campaign.voice_provider === 'gemini' ? 'Gemini Audio' : 'MiniMax TTS'} ({campaign.voice_persona}) | Speed: {campaign.voice_speed}x | Vol: {campaign.voice_volume}
                  </div>
                ) : (
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '-4px', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '0.8rem', color: 'var(--accent-light)' }}>🎙️ Konfigurasi TTS Voiceover (Kustom)</strong>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 120px' }}>
                        <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>TTS Provider</label>
                        <select 
                          value={campaign.voice_provider || 'gemini'} 
                          onChange={(e) => updateCampaignSettings({ voice_provider: e.target.value })}
                          style={{ width: '100%', background: '#000', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 8px', color: '#fff', fontSize: '0.75rem', outline: 'none' }}
                        >
                          <option value="gemini">Gemini Audio</option>
                          <option value="minimax">MiniMax TTS</option>
                        </select>
                      </div>
                      <div style={{ flex: '1 1 120px' }}>
                        <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Voice Persona</label>
                        <select 
                          value={campaign.voice_persona || 'Kore'} 
                          onChange={(e) => updateCampaignSettings({ voice_persona: e.target.value })}
                          style={{ width: '100%', background: '#000', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 8px', color: '#fff', fontSize: '0.75rem', outline: 'none' }}
                        >
                          {((campaign.voice_provider || 'gemini') === 'gemini'
                            ? GEMINI_VOICES
                            : ((campaign.target_language || 'id-ID') === 'en-US' ? MINIMAX_ENGLISH_VOICES : MINIMAX_VOICES)
                          ).map(voice => (
                            <option key={voice.id} value={voice.id}>
                              {voice.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '4px' }}>
                      <div style={{ flex: '1 1 120px' }}>
                        <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span>Speed</span>
                          <span>{campaign.voice_speed || 1.0}x</span>
                        </label>
                        <input 
                          type="range" 
                          min="0.5" 
                          max="2.0" 
                          step="0.1" 
                          value={campaign.voice_speed || 1.0} 
                          onChange={(e) => updateCampaignSettings({ voice_speed: Number(e.target.value) })}
                          style={{ width: '100%', accentColor: 'var(--accent)' }} 
                        />
                      </div>
                      <div style={{ flex: '1 1 120px' }}>
                        <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span>Volume</span>
                          <span>{campaign.voice_volume || 1.0}</span>
                        </label>
                        <input 
                          type="range" 
                          min="0.1" 
                          max="2.0" 
                          step="0.1" 
                          value={campaign.voice_volume || 1.0} 
                          onChange={(e) => updateCampaignSettings({ voice_volume: Number(e.target.value) })}
                          style={{ width: '100%', accentColor: 'var(--accent)' }} 
                        />
                      </div>
                    </div>
                    {(campaign.voice_provider || 'gemini') === 'minimax' && (
                      <div style={{ marginTop: '4px' }}>
                        <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>MiniMax Model Quality</label>
                        <select 
                          value={campaign.tts_model_quality || 'speech-2.8-turbo'} 
                          onChange={(e) => updateCampaignSettings({ tts_model_quality: e.target.value })}
                          style={{ width: '100%', background: '#000', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 8px', color: '#fff', fontSize: '0.75rem', outline: 'none' }}
                        >
                          <option value="speech-2.8-turbo">Turbo (speech-2.8-turbo)</option>
                          <option value="speech-2.8-hd">HD (speech-2.8-hd)</option>
                        </select>
                      </div>
                    )}
                  </div>
                )
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={opts.enable_ffmpeg}
                    onChange={(e) => setOpt('enable_ffmpeg', e.target.checked)}
                  />
                  <span className="slider"></span>
                </label>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Aktifkan FFmpeg Muxing (Video Utuh)</span>
              </div>

              {opts.enable_ffmpeg && (
                campaign.enable_ffmpeg === 1 ? (
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.78rem', marginTop: '-4px', marginBottom: '4px' }}>
                    🎬 <b>FFmpeg Dikonfigurasi (Awal):</b> {campaign.ffmpeg_sync_option} | Scale: {campaign.ffmpeg_video_scale}x | SFX: {campaign.ffmpeg_sfx_volume} | BGM: {campaign.ffmpeg_bgm_volume}
                  </div>
                ) : (
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '-4px', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '0.8rem', color: 'var(--accent-light)' }}>🎬 Konfigurasi FFmpeg Video Studio (Kustom)</strong>
                    
                    <div>
                      <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Metode Sinkronisasi Audio-Video</label>
                      <select 
                        value={campaign.ffmpeg_sync_option || 'smart_sync'} 
                        onChange={(e) => updateCampaignSettings({ ffmpeg_sync_option: e.target.value })}
                        style={{ width: '100%', background: '#000', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 8px', color: '#fff', fontSize: '0.75rem', outline: 'none' }}
                      >
                        <option value="smart_sync">Auto-Pilot Smart Sync (Sangat Direkomendasikan)</option>
                        <option value="shortest">Shortest (Potong video mengikuti audio)</option>
                        <option value="loop">Loop (Ulang video jika lebih pendek dari audio)</option>
                        <option value="stretch">Stretch (Ubah kecepatan video mengikuti audio)</option>
                        <option value="freeze">Freeze (Tahan frame terakhir video di akhir)</option>
                      </select>
                    </div>

                    <div style={{ marginTop: '4px' }}>
                      <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span>Video Scale (Zoom):</span>
                        <span>{Math.round((campaign.ffmpeg_video_scale || 1.0) * 100)}%</span>
                      </label>
                      <input 
                        type="range" 
                        min="1.0" 
                        max="2.0" 
                        step="0.05" 
                        value={campaign.ffmpeg_video_scale || 1.0} 
                        onChange={(e) => updateCampaignSettings({ ffmpeg_video_scale: Number(e.target.value) })}
                        style={{ width: '100%', accentColor: 'var(--accent)' }} 
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '4px' }}>
                      <div style={{ flex: '1 1 120px' }}>
                        <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span>SFX Volume:</span>
                          <span>{Math.round((campaign.ffmpeg_sfx_volume || 0.0) * 100)}%</span>
                        </label>
                        <input 
                          type="range" 
                          min="0.0" 
                          max="1.0" 
                          step="0.05" 
                          value={campaign.ffmpeg_sfx_volume || 0.0} 
                          onChange={(e) => updateCampaignSettings({ ffmpeg_sfx_volume: Number(e.target.value) })}
                          style={{ width: '100%', accentColor: 'var(--accent)' }} 
                        />
                      </div>
                      <div style={{ flex: '1 1 120px' }}>
                        <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span>BGM Volume:</span>
                          <span>{Math.round((campaign.ffmpeg_bgm_volume || 0.15) * 100)}%</span>
                        </label>
                        <input 
                          type="range" 
                          min="0.0" 
                          max="1.0" 
                          step="0.05" 
                          value={campaign.ffmpeg_bgm_volume || 0.15} 
                          onChange={(e) => updateCampaignSettings({ ffmpeg_bgm_volume: Number(e.target.value) })}
                          style={{ width: '100%', accentColor: 'var(--accent)' }} 
                        />
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>

            {campaign.is_bridging_active === 1 && (
              <div style={{ marginTop: '12px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                <strong style={{ fontSize: '0.8rem', color: 'var(--accent-light)' }}>🔌 Konfigurasi Bridging Produk</strong>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 120px' }}>
                    <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Mulai Bridging (Klip Ke-)</label>
                    <input
                      type="number"
                      min="2"
                      max={campaign.target_clips_count || 10}
                      value={campaign.bridge_at_clip || 3}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 3;
                        updateCampaignSettings({ bridge_at_clip: val });
                      }}
                      style={{ width: '100%', background: '#000', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 8px', color: '#fff', fontSize: '0.75rem', outline: 'none' }}
                    />
                  </div>
                  <div style={{ flex: '1 1 120px' }}>
                    <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Durasi Bridging (Klip)</label>
                    <select
                      value={campaign.bridge_duration_clips || 0}
                      onChange={(e) => updateCampaignSettings({ bridge_duration_clips: parseInt(e.target.value) || 0 })}
                      style={{ width: '100%', background: '#000', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 8px', color: '#fff', fontSize: '0.75rem', outline: 'none' }}
                    >
                      <option value="0">0 (Sisa seluruh klip)</option>
                      <option value="1">1 Klip</option>
                      <option value="2">2 Klip</option>
                      <option value="3">3 Klip</option>
                      <option value="4">4 Klip</option>
                      <option value="5">5 Klip</option>
                    </select>
                  </div>
                </div>
                <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Mengubah transisi visual (T2I + I2V) dan narasi voiceover pada workspace ini secara dinamis.</small>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status Rendering:</span>
                {renderVariantPipelineStatus(variant)}
              </div>

              <button
                type="button"
                onClick={() => triggerAngleRender(variant.id)}
                disabled={isRendering || variant.visual_status === 'processing'}
                className="btn btn-success"
                style={{
                  width: '100%',
                  padding: '10px',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(46, 204, 113, 0.2)'
                }}
              >
                {isRendering || variant.visual_status === 'processing' ? (
                  <>⏳ Sedang Render...</>
                ) : (
                  <>▶️ Render Angle Ini</>
                )}
              </button>
            </div>
          </div>

          {/* Muxed Final Video Card */}
          {variant.ffmpeg_status === 'completed' && variant.ffmpeg_output_path && (
            <div style={{ background: 'rgba(46, 204, 113, 0.05)', border: '1px solid rgba(46, 204, 113, 0.3)', borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontWeight: '700', marginBottom: '8px', color: '#2ecc71', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🎬 Video Final (Muxed)
              </div>
              <video
                src={variant.ffmpeg_output_path}
                controls
                preload="metadata"
                style={{ width: '100%', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', background: '#000' }}
              />
              {variant.drive_link && (
                <a
                  href={variant.drive_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{
                    width: '100%',
                    marginTop: '10px',
                    fontSize: '0.72rem',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    background: 'rgba(46, 204, 113, 0.1)',
                    borderColor: 'rgba(46, 204, 113, 0.3)',
                    color: '#2ecc71'
                  }}
                >
                  💾 Buka di Google Drive
                </a>
              )}
            </div>
          )}

          {/* GDrive Folder Link (If no muxed video shown but folder link is present) */}
          {variant.drive_link && variant.ffmpeg_status !== 'completed' && (
            <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                ☁️ Folder Google Drive (Klip Individual):
              </div>
              <a
                href={variant.drive_link}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
                style={{
                  width: '100%',
                  fontSize: '0.72rem',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  background: 'rgba(46, 204, 113, 0.1)',
                  borderColor: 'rgba(46, 204, 113, 0.3)',
                  color: '#2ecc71'
                }}
              >
                💾 Buka Folder GDrive
              </a>
            </div>
          )}

        </div>

      </div>
    );
  }

  function renderExpandedDetails(item) {
    const hasAngles = item.angle_variants && item.angle_variants.length > 0;
    const activeAngleTab = activeAngleTabs[item.id] || (hasAngles ? 'original' : null);

    const renderOriginalDetails = () => {
      let parsed = {};
      try {
        parsed = JSON.parse(item.result_json || '{}');
      } catch (e) {
        return <div style={{ color: 'var(--danger)', fontSize: '0.8rem', padding: '8px' }}>Gagal memproses data analisis. Struktur data JSON tidak valid.</div>;
      }

      const currentTab = activeTabs[item.id] || 'storyboard';
      const setTab = (tabName) => {
        setActiveTabs(prev => ({ ...prev, [item.id]: tabName }));
      };

      const storyboard = parsed.storyboard || [];
      const voiceover = parsed.voiceover || [];
      const t2vPrompts = parsed.t2v_prompts || [];
      const t2iPrompts = parsed.t2i_prompts || [];
      const i2vPrompts = parsed.i2v_prompts || [];
      const tiktokCaption = parsed.tiktok_caption || '';
      const igCaption = parsed.ig_caption || '';
      const ytTitle = parsed.yt_title || '';
      const ytDesc = parsed.yt_desc || '';

      let visualClipPaths = [];
      if (item.visual_clip_paths) {
        try {
          visualClipPaths = JSON.parse(item.visual_clip_paths);
        } catch (e) {
          console.error('Failed to parse visual_clip_paths:', e);
        }
      }

      const getT2VClipIdx = (p, idx) => {
        if (p && p.clip !== undefined && p.clip !== null) {
          const num = parseInt(String(p.clip).replace(/\D/g, ''), 10);
          if (!isNaN(num)) {
            return num - 1;
          }
        }
        return idx;
      };

      const getI2VClipIdx = (p, idx) => {
        const t2vCount = t2vPrompts.length;
        if (p && p.clip !== undefined && p.clip !== null) {
          const num = parseInt(String(p.clip).replace(/\D/g, ''), 10);
          if (!isNaN(num)) {
            if (num > t2vCount) {
              return num - 1;
            }
            return t2vCount + (num - 1);
          }
        }
        return t2vCount + idx;
      };

      return (
        <div style={{ color: 'var(--text-primary)', fontSize: '0.82rem', textAlign: 'left' }}>
          {/* Deconstruction Summary */}
          {parsed.analysis_summary && (
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px 16px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.05)', marginBottom: '14px' }}>
              <div style={{ fontWeight: '700', marginBottom: '8px', color: 'var(--accent-light)', fontSize: '0.88rem' }}>💡 Analisis & Strategi Upgrade</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Hook Asli & Kelemahan</span>
                  <p style={{ margin: '4px 0 0 0', lineHeight: '1.4' }}>
                    <b>Hook:</b> {parsed.analysis_summary.original_hook_analysis || '-'}<br />
                    <b>Kelemahan:</b> {parsed.analysis_summary.weakness_identified || '-'}
                  </p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Strategi Peningkatan (Upgrade)</span>
                  <p style={{ margin: '4px 0 0 0', lineHeight: '1.4', color: '#f1c40f' }}>{parsed.analysis_summary.the_upgrade_strategy || '-'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Dynamic Navigation Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '14px', gap: '6px', flexWrap: 'wrap', overflowX: 'auto' }}>
            {[
              { id: 'storyboard', label: '📖 Storyboard', count: storyboard.length },
              { id: 'voiceover', label: '🎤 Voiceover', count: voiceover.length },
              t2vPrompts.length > 0 ? { id: 't2v', label: '🤖 AI Video Prompt', count: t2vPrompts.length } : null,
              t2iPrompts.length > 0 ? { id: 't2i', label: '📸 T2I Prompts', count: t2iPrompts.length } : null,
              i2vPrompts.length > 0 ? { id: 'i2v', label: '🎥 I2V Prompts', count: i2vPrompts.length } : null,
              { id: 'captions', label: '📱 Social Draft' }
            ].filter(Boolean).map(t => {
              const isActive = currentTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  type="button"
                  style={{
                    padding: '8px 14px',
                    background: isActive ? 'rgba(255,255,255,0.04)' : 'transparent',
                    color: isActive ? 'var(--accent-light)' : 'var(--text-muted)',
                    border: 'none',
                    borderBottom: isActive ? '2px solid var(--accent-light)' : '2px solid transparent',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: isActive ? '600' : '400',
                    transition: 'all 0.15s ease',
                    borderRadius: '4px 4px 0 0',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {t.label} {t.count !== undefined && `(${t.count})`}
                </button>
              );
            })}
          </div>

          {/* Panels Content */}
          <div style={{ minHeight: '80px', padding: '4px 0' }}>
            {currentTab === 'storyboard' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {storyboard.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Tidak ada data storyboard.</div>
                ) : (
                  storyboard.map((s, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '14px', background: 'rgba(255,255,255,0.01)', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px', borderRight: '1px solid rgba(255,255,255,0.05)', paddingRight: '12px' }}>
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Scene</span>
                        <span style={{ fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--accent-light)' }}>{s.scene || idx + 1}</span>
                        <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', padding: '2px 5px', borderRadius: '4px', marginTop: '4px', fontWeight: 600 }}>{s.duration || '-'}</span>
                      </div>
                      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                        <div>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600, marginBottom: '2px' }}>Visual Description</span>
                          <p style={{ margin: 0, lineHeight: '1.45' }}>{s.visual_description || '-'}</p>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600, marginBottom: '2px' }}>Camera Movement</span>
                          <p style={{ margin: 0, lineHeight: '1.45', color: '#70a1ff' }}>{s.camera_movement || '-'}</p>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600, marginBottom: '2px' }}>Audio & SFX Mood</span>
                          <p style={{ margin: 0, lineHeight: '1.45', color: '#ff6b81' }}>{s.audio_mood || '-'}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {currentTab === 'voiceover' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {voiceover.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Tidak ada data voiceover script.</div>
                ) : (
                  voiceover.map((v, idx) => {
                    const ttsClip = item.tts_clips?.find(c => c.clip_index === idx);
                    return (
                      <div key={idx} style={{ display: 'flex', gap: '14px', background: 'rgba(255,255,255,0.01)', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px', borderRight: '1px solid rgba(255,255,255,0.05)', paddingRight: '12px' }}>
                          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Scene</span>
                          <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--accent-light)' }}>{v.scene || idx + 1}</span>
                          <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', padding: '2px 5px', borderRadius: '4px', marginTop: '4px', fontWeight: 600 }}>{v.duration || '-'}</span>
                        </div>
                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', borderLeft: '3px solid var(--accent)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <p style={{ margin: 0, fontStyle: 'italic', fontSize: '0.85rem', lineHeight: '1.5', color: '#ecf0f1' }}>
                            "{v.narration || '-'}"
                          </p>
                          {item.tts_status === 'completed' && ttsClip && ttsClip.status === 'completed' && (
                            <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <audio 
                                src={ttsClip.audio_path} 
                                controls 
                                style={{ 
                                  width: '100%', 
                                  height: '32px',
                                  borderRadius: '4px'
                                }} 
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {currentTab === 't2v' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                 {t2vPrompts.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Tidak ada data T2V prompts.</div>
                ) : (
                  t2vPrompts.map((p, idx) => {
                    const clipIdx = getT2VClipIdx(p, idx);
                    const copyKey = `t2v_${item.id}_${idx}`;
                    const isCopied = copySuccess[copyKey];
                    return (
                      <div key={idx} style={{ background: 'rgba(0,0,0,0.15)', padding: '14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 'bold', color: 'var(--accent-light)', fontSize: '0.85rem' }}>🤖 Clip {p.clip || idx + 1} ({p.duration || 'Estimated Duration'})</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(p.prompt, copyKey)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.65rem', padding: '2px 6px', background: isCopied ? '#2ed573' : 'rgba(255,255,255,0.08)', color: '#fff', border: 'none' }}
                          >
                            {isCopied ? '✅ Terkopi!' : '📋 Salin Prompt'}
                          </button>
                        </div>

                        {(p.scenes_covered || p.motion_type || p.camera_movement || p.style) && (
                          <div style={{ display: 'flex', gap: '12px', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '8px', flexWrap: 'wrap' }}>
                            {p.scenes_covered && <span>🎬 Scenes: <b>{p.scenes_covered}</b></span>}
                            {p.motion_type && <span>🏃 Motion: <b>{p.motion_type}</b></span>}
                            {p.camera_movement && <span>📹 Camera: <b>{p.camera_movement}</b></span>}
                            {p.style && <span>🎨 Style: <b>{p.style}</b></span>}
                          </div>
                        )}

                        <pre style={{
                          background: '#151515',
                          padding: '10px',
                          borderRadius: '4px',
                          overflowX: 'auto',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          fontSize: '0.75rem',
                          fontFamily: 'var(--font-mono)',
                          color: '#dfe4ea',
                          border: '1px solid rgba(255,255,255,0.03)',
                          margin: 0,
                          lineHeight: 1.4
                        }}>
                          {p.prompt}
                        </pre>
                        {item.visual_status === 'completed' && visualClipPaths && visualClipPaths[clipIdx] ? (
                          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>🎬 Generated Visual Clip (Local)</span>
                            <video 
                              src={visualClipPaths[clipIdx]} 
                              controls 
                              preload="metadata"
                              style={{ 
                                width: '100%', 
                                maxHeight: '260px', 
                                borderRadius: '6px', 
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                background: '#000'
                              }} 
                            />
                          </div>
                        ) : (
                          renderClipGlabsStatusAndPreview(item, clipIdx)
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {currentTab === 't2i' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {t2iPrompts.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Tidak ada data T2I prompts.</div>
                ) : (
                  t2iPrompts.map((p, idx) => {
                    const copyKey = `t2i_${item.id}_${idx}`;
                    const isCopied = copySuccess[copyKey];
                    return (
                      <div key={idx} style={{ background: 'rgba(0,0,0,0.15)', padding: '14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 'bold', color: 'var(--accent-light)', fontSize: '0.85rem' }}>📸 Clip {p.clip || idx + 1} (T2I Start Frame)</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(p.prompt, copyKey)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.65rem', padding: '2px 6px', background: isCopied ? '#2ed573' : 'rgba(255,255,255,0.08)', color: '#fff', border: 'none' }}
                          >
                            {isCopied ? '✅ Terkopi!' : '📋 Salin Prompt'}
                          </button>
                        </div>

                        <pre style={{
                          background: '#151515',
                          padding: '10px',
                          borderRadius: '4px',
                          overflowX: 'auto',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          fontSize: '0.75rem',
                          fontFamily: 'var(--font-mono)',
                          color: '#dfe4ea',
                          border: '1px solid rgba(255,255,255,0.03)',
                          margin: 0,
                          lineHeight: 1.4
                        }}>
                          {p.prompt}
                        </pre>

                        {item.t2i_start_frame_path && (
                          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>🖼️ Generated Start Frame Image</span>
                            <img 
                              src={item.t2i_start_frame_path} 
                              alt={`Clip ${p.clip || idx + 1} Start Frame`}
                              style={{ 
                                maxWidth: '100%', 
                                maxHeight: '300px', 
                                borderRadius: '6px', 
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                objectFit: 'contain',
                                background: '#111'
                              }} 
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {currentTab === 'i2v' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                 {i2vPrompts.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Tidak ada data I2V prompts.</div>
                ) : (
                  i2vPrompts.map((p, idx) => {
                    const clipIdx = getI2VClipIdx(p, idx);
                    const copyKey = `i2v_${item.id}_${idx}`;
                    const isCopied = copySuccess[copyKey];
                    return (
                      <div key={idx} style={{ background: 'rgba(0,0,0,0.15)', padding: '14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 'bold', color: 'var(--accent-light)', fontSize: '0.85rem' }}>🎥 Clip {p.clip || idx + 1} (I2V Animation)</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(p.prompt, copyKey)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.65rem', padding: '2px 6px', background: isCopied ? '#2ed573' : 'rgba(255,255,255,0.08)', color: '#fff', border: 'none' }}
                          >
                            {isCopied ? '✅ Terkopi!' : '📋 Salin Prompt'}
                          </button>
                        </div>

                        <pre style={{
                          background: '#151515',
                          padding: '10px',
                          borderRadius: '4px',
                          overflowX: 'auto',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          fontSize: '0.75rem',
                          fontFamily: 'var(--font-mono)',
                          color: '#dfe4ea',
                          border: '1px solid rgba(255,255,255,0.03)',
                          margin: 0,
                          lineHeight: 1.4
                        }}>
                          {p.prompt}
                        </pre>

                        {item.visual_status === 'completed' && visualClipPaths && visualClipPaths[clipIdx] ? (
                          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>🎬 Generated Visual Clip (Local)</span>
                            <video 
                              src={visualClipPaths[clipIdx]} 
                              controls 
                              preload="metadata"
                              style={{ 
                                width: '100%', 
                                maxHeight: '260px', 
                                borderRadius: '6px', 
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                background: '#000'
                              }} 
                            />
                          </div>
                        ) : (
                          renderClipGlabsStatusAndPreview(item, clipIdx)
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {currentTab === 'captions' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {/* Universal Social Caption */}
                {(() => {
                  const capKey = `cap_${item.id}`;
                  const universalCap = parsed.caption || parsed.universal_caption || (typeof parsed.social_media_package === 'object' ? parsed.social_media_package?.caption : '') || parsed.tiktok_caption || parsed.ig_caption || '';
                  const isCopied = copySuccess[capKey];
                  return (
                    <div style={{ background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--accent-light)', fontSize: '0.85rem' }}>📱 Universal Social Media Caption</span>
                        <button
                          type="button"
                          disabled={!universalCap}
                          onClick={() => handleCopy(universalCap, capKey)}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.7rem', padding: '4px 10px', background: isCopied ? '#2ed573' : 'rgba(255,255,255,0.08)', color: '#fff', border: 'none' }}
                        >
                          {isCopied ? '✅ Terkopi!' : '📋 Salin Caption'}
                        </button>
                      </div>
                      <textarea
                        className="form-textarea"
                        style={{ width: '100%', minHeight: '120px', fontSize: '0.82rem', background: '#09090b', color: '#fff', borderRadius: '6px', padding: '10px', lineHeight: 1.4 }}
                        value={universalCap}
                        onChange={(e) => updateSocialField(item.id, 'caption', e.target.value)}
                        placeholder="Naskah caption universal media sosial (TikTok, Instagram, Facebook, Shorts)..."
                      />
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      );
    };

    const renderV2Workbench = (item) => {
      if (!editedVideoPlans.hasOwnProperty(item.id)) {
        let plan = [];
        try { plan = JSON.parse(item.new_video_plan_json || '[]'); } catch {}
        setTimeout(() => {
          setEditedVideoPlans(prev => ({ ...prev, [item.id]: plan }));
        }, 0);
        return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Memuat Workbench...</div>;
      }

      if (!editedVideoDnas.hasOwnProperty(item.id)) {
        let dna = {};
        try { dna = JSON.parse(item.video_dna_json || '{}'); } catch {}
        setTimeout(() => {
          setEditedVideoDnas(prev => ({ ...prev, [item.id]: dna }));
        }, 0);
        return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Memuat Video DNA...</div>;
      }

      if (!workflowSettings.hasOwnProperty(item.id)) {
        setTimeout(() => {
          setWorkflowSettings(prev => ({
            ...prev,
            [item.id]: {
              enable_tts: campaign.enable_tts !== 0,
              enable_glabs: campaign.enable_glabs !== 0,
              enable_ffmpeg: campaign.enable_ffmpeg !== 0,
              voice_provider: campaign.voice_provider || 'gemini',
              voice_persona: campaign.voice_persona || 'Kore',
              voice_speed: campaign.voice_speed !== undefined ? Number(campaign.voice_speed) : 1.0,
              voice_volume: campaign.voice_volume !== undefined ? Number(campaign.voice_volume) : 1.0,
              ffmpeg_video_scale: campaign.ffmpeg_video_scale !== undefined ? Number(campaign.ffmpeg_video_scale) : 1.0,
              ffmpeg_sfx_volume: campaign.ffmpeg_sfx_volume !== undefined ? Number(campaign.ffmpeg_sfx_volume) : 0.0,
              ffmpeg_bgm_volume: campaign.ffmpeg_bgm_volume !== undefined ? Number(campaign.ffmpeg_bgm_volume) : 0.15,
              ffmpeg_sync_option: campaign.ffmpeg_sync_option || 'smart_sync',
              sync_mode: campaign.sync_mode || 'auto'
            }
          }));
        }, 0);
        return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Memuat Pengaturan Alur Kerja...</div>;
      }

      if (!selectedVoVersions.hasOwnProperty(item.id)) {
        setTimeout(() => {
          setSelectedVoVersions(prev => ({ ...prev, [item.id]: item.selected_vo_version || 'original' }));
        }, 0);
        return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Memuat Workbench...</div>;
      }

      const activeVoVersion = selectedVoVersions[item.id] || item.selected_vo_version || 'original';

      const handleVoVersionChange = (version) => {
        let voArray = [];
        if (version === 'original') {
          try { voArray = JSON.parse(item.original_voiceover || '[]'); } catch {}
        } else {
          try { voArray = JSON.parse(item.tiktok_safe_voiceover || '[]'); } catch {}
        }

        setEditedVideoPlans(prev => {
          const currentPlan = [...(prev[item.id] || [])];
          const updatedPlan = currentPlan.map((clip, idx) => {
            const matchingVo = voArray.find(v => Number(v.scene) === Number(clip.clip_index || idx + 1));
            return {
              ...clip,
              new_vo: matchingVo ? matchingVo.narration : (clip.new_vo || '')
            };
          });
          return { ...prev, [item.id]: updatedPlan };
        });

        setSelectedVoVersions(prev => ({ ...prev, [item.id]: version }));
      };

      const plan = editedVideoPlans[item.id] || [];
      const dna = editedVideoDnas[item.id] || {};
      const settings = workflowSettings[item.id] || {};
      const isProductionFailed = 
        item.visual_status === 'failed' ||
        item.tts_status === 'failed' ||
        item.ffmpeg_status === 'failed' ||
        item.upload_status === 'failed' ||
        item.social_post_status === 'failed';
      const canEditStoryboard = item.workflow_status === 'ready_for_review' || isProductionFailed;
      const isReadOnly = !canEditStoryboard;

      const hookTypeOptions = ["Pertanyaan", "Mitos", "Hasil Akhir", "Visual Shock", "Curiosity", "Problem/Solution", "Statement"];
      const visualStyleOptions = ["Faceless", "Macro", "Food Porn", "Cinematic", "Lifestyle", "Studio/Unboxing"];
      const cameraPaceOptions = ["Static", "Dynamic Tracking", "Fast Cuts", "Slow Dolly", "Panning"];
      const emotionOptions = ["Menggugah Selera", "Segar", "Santai", "Kagum", "Penasaran", "Surprise"];
      const affiliateIntegrationOptions = ["Natural Usage", "Background", "Problem Solver", "None"];
      const affiliateMentionOptions = ["Voice Over", "Visual Only", "Both", "None"];
      const ctaTypeOptions = ["Save Recipe", "Share to Friend", "Buy Now", "Link in Bio", "Comment for Link"];

      const updateDnaField = (field, value) => {
        if (isReadOnly) return;
        setEditedVideoDnas(prev => ({
          ...prev,
          [item.id]: {
            ...prev[item.id],
            [field]: value
          }
        }));
      };

      const updatePlanField = (index, field, value) => {
        if (isReadOnly) return;
        setEditedVideoPlans(prev => {
          const updatedPlan = [...(prev[item.id] || [])];
          updatedPlan[index] = {
            ...updatedPlan[index],
            [field]: value
          };
          return { ...prev, [item.id]: updatedPlan };
        });
      };

      const toggleSetting = (field) => {
        if (isReadOnly) return;
        setWorkflowSettings(prev => ({
          ...prev,
          [item.id]: {
            ...prev[item.id],
            [field]: !prev[item.id][field]
          }
        }));
      };

      const updateSettingField = (field, value) => {
        if (isReadOnly) return;
        setWorkflowSettings(prev => ({
          ...prev,
          [item.id]: {
            ...prev[item.id],
            [field]: value
          }
        }));
      };

      const handleSyncItemAssets = async () => {
        setSyncingAssets(prev => ({ ...prev, [item.id]: true }));
        try {
          const res = await fetch(`/api/v2/re-campaigns/items/${item.id}/sync-assets`, { method: 'POST' });
          const data = await res.json();
          if (data.success) {
            showToast(`Berhasil mengunggah ${data.totalFiles} aset ke ${data.storageProvider.toUpperCase()}!`);
            fetchDetail();
          } else {
            showToast(`Gagal sync aset: ${data.error || 'Terjadi kesalahan'}`, 'error');
          }
        } catch (err) {
          showToast(`Error: ${err.message}`, 'error');
        } finally {
          setSyncingAssets(prev => ({ ...prev, [item.id]: false }));
        }
      };

      const handleRetryClipI2V = async (clipIdx) => {
        const taskKey = `${item.id}_${clipIdx}`;
        setRetryingI2V(prev => ({ ...prev, [taskKey]: true }));
        try {
          const res = await fetch(`/api/v2/re-campaigns/items/${item.id}/retry-clip-i2v`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clipIndex: clipIdx })
          });
          const data = await res.json();
          if (data.success) {
            showToast(`Klip #${clipIdx} I2V retry berhasil dijadwalkan!`);
            fetchDetail();
          } else {
            showToast(`Gagal retry klip: ${data.error || 'Terjadi kesalahan'}`, 'error');
          }
        } catch (err) {
          showToast(`Error: ${err.message}`, 'error');
        } finally {
          setRetryingI2V(prev => ({ ...prev, [taskKey]: false }));
        }
      };

      const handleRegenerateT2I = async (clipIdx, t2iPrompt) => {
        const taskKey = `${item.id}_${clipIdx}`;
        setRegeneratingT2I(prev => ({ ...prev, [taskKey]: true }));
        try {
          const res = await fetch(`/api/v2/re-campaigns/items/${item.id}/regenerate-t2i`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clipIndex: clipIdx, t2i_prompt: t2iPrompt })
          });
          const resData = await res.json();
          if (resData.success) {
            showToast(`Gambar T2I klip ${clipIdx} berhasil diregenerasi!`);
            // Force refetch to update DB values
            fetchDetail();
          } else {
            showToast(resData.error || 'Gagal meregenerasi gambar.', 'error');
          }
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          setRegeneratingT2I(prev => ({ ...prev, [taskKey]: false }));
        }
      };

      const handleUploadStartFrame = async (clipIdx, file) => {
        if (!file) return;
        const taskKey = `${item.id}_${clipIdx}`;
        setReplacingSF(prev => ({ ...prev, [taskKey]: true }));
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('clipIndex', clipIdx);

        try {
          const res = await fetch(`/api/v2/re-campaigns/items/${item.id}/replace-start-frame`, {
            method: 'POST',
            body: formData
          });
          const data = await res.json();
          if (data.success) {
            showToast(`Start frame untuk klip ${clipIdx} berhasil diperbarui!`);
            setCacheBuster(Date.now());
            fetchDetail();
          } else {
            showToast(`Gagal memperbarui: ${data.error || 'Terjadi kesalahan'}`, 'error');
          }
        } catch (err) {
          showToast(`Error: ${err.message}`, 'error');
        } finally {
          setReplacingSF(prev => ({ ...prev, [taskKey]: false }));
        }
      };

      const handleApprove = async () => {
        if (settings.voice_provider === 'gemini') {
          for (let i = 0; i < plan.length; i++) {
            if (isJsonError(plan[i].i2v_prompt)) {
              showToast(`Klip ${i + 1} memiliki format JSON tidak valid pada prompt I2V. Silakan perbaiki sebelum menyetujui!`, 'error');
              return;
            }
          }
        }

        if (settings.enable_tts) {
          const missingVoClips = [];
          plan.forEach((p, idx) => {
            if (!p.new_vo || p.new_vo.trim() === '') {
              missingVoClips.push(p.clip_index || (idx + 1));
            }
          });

          if (missingVoClips.length > 0) {
            showToast(`Peringatan: Klip #${missingVoClips.join(', #')} belum memiliki naskah VO. Mohon isi naskah VO terlebih dahulu sebelum menyetujui dan menjalankan produksi.`, 'error');
            return;
          }
        }

        setApprovingItems(prev => ({ ...prev, [item.id]: true }));
        try {
          const res = await fetch(`/api/v2/re-campaigns/items/${item.id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              new_video_plan: plan,
              video_dna: dna,
              enable_tts: settings.enable_tts,
              enable_glabs: settings.enable_glabs,
              enable_ffmpeg: settings.enable_ffmpeg,
              voice_provider: settings.voice_provider,
              voice_persona: settings.voice_persona,
              voice_speed: settings.voice_speed,
              voice_volume: settings.voice_volume,
              ffmpeg_video_scale: settings.ffmpeg_video_scale,
              ffmpeg_sfx_volume: settings.ffmpeg_sfx_volume,
              ffmpeg_bgm_volume: settings.ffmpeg_bgm_volume,
              ffmpeg_sync_option: settings.ffmpeg_sync_option,
              sync_mode: settings.sync_mode,
              selected_vo_version: activeVoVersion
            })
          });
          const resData = await res.json();
          if (resData.success) {
            showToast("Kampanye disetujui! Alur produksi berjalan sekarang.");
            fetchDetail();
          } else {
            showToast(resData.error || "Gagal menyetujui kampanye.", "error");
          }
        } catch (err) {
          showToast(err.message, "error");
        } finally {
          setApprovingItems(prev => ({ ...prev, [item.id]: false }));
        }
      };

      const handleSaveDraft = async () => {
        if (settings.voice_provider === 'gemini') {
          for (let i = 0; i < plan.length; i++) {
            if (isJsonError(plan[i].i2v_prompt)) {
              showToast(`Klip ${i + 1} memiliki format JSON tidak valid pada prompt I2V. Silakan perbaiki sebelum menyimpan!`, 'error');
              return;
            }
          }
        }
        setSavingDraft(prev => ({ ...prev, [item.id]: true }));
        try {
          const res = await fetch(`/api/v2/re-campaigns/items/${item.id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              new_video_plan: plan,
              video_dna: dna,
              enable_tts: settings.enable_tts,
              enable_glabs: settings.enable_glabs,
              enable_ffmpeg: settings.enable_ffmpeg,
              voice_provider: settings.voice_provider,
              voice_persona: settings.voice_persona,
              voice_speed: settings.voice_speed,
              voice_volume: settings.voice_volume,
              ffmpeg_video_scale: settings.ffmpeg_video_scale,
              ffmpeg_sfx_volume: settings.ffmpeg_sfx_volume,
              ffmpeg_bgm_volume: settings.ffmpeg_bgm_volume,
              ffmpeg_sync_option: settings.ffmpeg_sync_option,
              sync_mode: settings.sync_mode,
              only_save: true,
              selected_vo_version: activeVoVersion
            })
          });
          const resData = await res.json();
          if (resData.success) {
            showToast(resData.message || "Storyboard draft berhasil disimpan!");
            fetchDetail();
          } else {
            showToast(resData.error || "Gagal menyimpan draft.", "error");
          }
        } catch (err) {
          showToast(err.message, "error");
        } finally {
          setSavingDraft(prev => ({ ...prev, [item.id]: false }));
        }
      };

      let t2iImages = [];
      try {
        t2iImages = JSON.parse(item.t2i_images_json || '[]');
      } catch {}

      const subTab = activeRowTabs[item.id] || 'decon';
      const setSubTab = (t) => {
        setActiveRowTabs(prev => ({ ...prev, [item.id]: t }));
      };

      return (
        <div style={{ color: 'var(--text-primary)', fontSize: '0.82rem', textAlign: 'left' }}>
          {/* Status Banner */}
          {item.workflow_status === 'ready_for_review' && (
            <div style={{
              background: 'rgba(230, 126, 34, 0.08)',
              border: '1px solid rgba(230, 126, 34, 0.3)',
              color: '#f39c12',
              padding: '16px 20px',
              borderRadius: '8px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              lineHeight: 1.5
            }}>
              <span style={{ fontSize: '1.4rem' }}>⏳</span>
              <div>
                <strong style={{ display: 'block', marginBottom: '2px', color: '#fff' }}>Menunggu Review Kreatif (Human-in-the-Loop)</strong>
                Gemini telah merancang Dekonstruksi Asli & Rencana Video baru di bawah ini. Harap tinjau voiceover, prompt gambar T2I, dan prompt pergerakan I2V. Anda bisa mengedit teksnya secara bebas, meregenerasi gambar T2I, dan menyesuaikan tahapan pipa produksi sebelum klik tombol <strong>"Approve & Proceed to Production"</strong>.
              </div>
            </div>
          )}

          {item.workflow_status === 'production_processing' && (
            <div style={{
              background: 'rgba(52, 152, 219, 0.08)',
              border: '1px solid rgba(52, 152, 219, 0.3)',
              color: '#3498db',
              padding: '16px 20px',
              borderRadius: '8px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              lineHeight: 1.5
            }}>
              <span style={{ fontSize: '1.4rem' }}>⚙️</span>
              <div>
                <strong style={{ display: 'block', marginBottom: '2px', color: '#fff' }}>Sedang Memproses Produksi...</strong>
                Antrean produksi sedang berjalan. Mesin sedang melakukan render audio TTS, visual G-Labs (Veo/Kling), dan penggabungan FFmpeg. Antarmuka ini dikunci sementara (Read-Only) hingga produksi selesai.
              </div>
            </div>
          )}

          {item.workflow_status === 'completed' && !isProductionFailed && (
            <div style={{
              background: 'rgba(46, 204, 113, 0.08)',
              border: '1px solid rgba(46, 204, 113, 0.3)',
              color: '#2ecc71',
              padding: '16px 20px',
              borderRadius: '8px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              lineHeight: 1.5
            }}>
              <span style={{ fontSize: '1.4rem' }}>✅</span>
              <div>
                <strong style={{ display: 'block', marginBottom: '2px', color: '#fff' }}>Produksi Selesai</strong>
                Tahapan produksi (TTS, Video G-Labs, dan Muxing FFmpeg) telah selesai dieksekusi sepenuhnya! Video akhir siap diunduh atau diposting.
              </div>
            </div>
          )}

          {isProductionFailed && (
            <div style={{
              background: 'rgba(231, 76, 60, 0.08)',
              border: '1px solid rgba(231, 76, 60, 0.3)',
              color: '#e74c3c',
              padding: '16px 20px',
              borderRadius: '8px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              lineHeight: 1.5
            }}>
              <span style={{ fontSize: '1.4rem' }}>❌</span>
              <div>
                <strong style={{ display: 'block', marginBottom: '2px', color: '#fff' }}>Produksi Gagal / Terhenti</strong>
                Terjadi kegagalan saat memproses tahapan produksi (TTS, Video G-Labs, atau FFmpeg). Anda dapat mengedit storyboard di bawah ini, mengunggah Start Frame pengganti, lalu klik tombol <strong>"Approve & Proceed to Production"</strong> untuk merender ulang video.
              </div>
            </div>
          )}

          {/* TikTok Safe Compliance Report & VO Selector */}
          {campaign.enable_vo_audit === 1 && item.compliance_status && (
            <div style={{
              background: 'var(--bg-glass)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.2rem' }}>🛡️</span>
                  <span style={{ fontWeight: '700', fontSize: '0.9rem', color: '#fff' }}>TikTok Shop Compliance Audit</span>
                </div>
                
                {/* Verdict Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status:</span>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    background: item.compliance_status === 'PASS' 
                      ? 'rgba(46, 204, 113, 0.15)' 
                      : item.compliance_status === 'REVISE' 
                        ? 'rgba(241, 196, 15, 0.15)' 
                        : 'rgba(231, 76, 60, 0.15)',
                    color: item.compliance_status === 'PASS' 
                      ? '#2ecc71' 
                      : item.compliance_status === 'REVISE' 
                        ? '#f1c40f' 
                        : '#e74c3c',
                    border: `1px solid ${
                      item.compliance_status === 'PASS' 
                        ? '#2ecc71' 
                        : item.compliance_status === 'REVISE' 
                          ? '#f1c40f' 
                          : '#e74c3c'
                    }`
                  }}>
                    {item.compliance_status}
                  </span>
                  
                  {/* Risk Score */}
                  {item.compliance_score !== undefined && (
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: '700',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--border)',
                      color: item.compliance_score < 30 ? '#2ecc71' : item.compliance_score < 70 ? '#f1c40f' : '#e74c3c'
                    }}>
                      Skor Risiko: {item.compliance_score}/100
                    </span>
                  )}
                </div>
              </div>

              {/* Show issues if any */}
              {(() => {
                let log = {};
                try { log = JSON.parse(item.compliance_log_json || '{}'); } catch {}
                const issues = log.issues || [];
                if (issues.length === 0) return null;
                return (
                  <div style={{
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    borderLeft: '4px solid #f1c40f'
                  }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#f1c40f', display: 'block', marginBottom: '6px' }}>
                      Peringatan Kepatuhan Kebijakan:
                    </span>
                    <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {issues.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                );
              })()}

              {/* VO Version Switcher */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Pilih Versi Voiceover (Mempengaruhi Teks Naskah):
                </span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => handleVoVersionChange('original')}
                    disabled={isReadOnly}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: activeVoVersion === 'original' ? 'rgba(255,255,255,0.08)' : 'transparent',
                      border: `1px solid ${activeVoVersion === 'original' ? 'var(--accent)' : 'var(--border)'}`,
                      color: activeVoVersion === 'original' ? '#fff' : 'var(--text-muted)',
                      cursor: isReadOnly ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontWeight: activeVoVersion === 'original' ? 700 : 500,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span>🎨</span>
                    <div style={{ textAlign: 'left' }}>
                      <span style={{ display: 'block', fontSize: '0.8rem' }}>Versi Orisinal</span>
                      <span style={{ display: 'block', fontSize: '0.62rem', opacity: 0.6 }}>Naskah asli AI yang lebih persuasif & kreatif</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleVoVersionChange('safe')}
                    disabled={isReadOnly}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: activeVoVersion === 'safe' ? 'rgba(46, 204, 113, 0.08)' : 'transparent',
                      border: `1px solid ${activeVoVersion === 'safe' ? '#2ecc71' : 'var(--border)'}`,
                      color: activeVoVersion === 'safe' ? '#2ecc71' : 'var(--text-muted)',
                      cursor: isReadOnly ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontWeight: activeVoVersion === 'safe' ? 700 : 500,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span>🛡️</span>
                    <div style={{ textAlign: 'left' }}>
                      <span style={{ display: 'block', fontSize: '0.8rem' }}>Versi Audit (TikTok Safe)</span>
                      <span style={{ display: 'block', fontSize: '0.62rem', opacity: 0.6 }}>Naskah tersanitasi bebas dari pelanggaran medis</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Sub-tab Navigation */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px', marginBottom: '20px' }}>
            <button
              type="button"
              onClick={() => setSubTab('decon')}
              style={{
                background: subTab === 'decon' ? 'rgba(108, 92, 231, 0.15)' : 'transparent',
                border: subTab === 'decon' ? '1px solid var(--accent)' : '1px solid transparent',
                color: subTab === 'decon' ? 'var(--accent-light)' : 'var(--text-muted)',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                transition: 'all 0.2s ease'
              }}
            >
              🔍 Tab 1: Dekonstruksi Asli
            </button>
            <button
              type="button"
              onClick={() => setSubTab('storyboard')}
              style={{
                background: subTab === 'storyboard' ? 'rgba(108, 92, 231, 0.15)' : 'transparent',
                border: subTab === 'storyboard' ? '1px solid var(--accent)' : '1px solid transparent',
                color: subTab === 'storyboard' ? 'var(--accent-light)' : 'var(--text-muted)',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                transition: 'all 0.2s ease'
              }}
            >
              📖 Tab 2: Storyboard & Rencana Visual Baru
            </button>
            <button
              type="button"
              onClick={() => setSubTab('dna')}
              style={{
                background: subTab === 'dna' ? 'rgba(108, 92, 231, 0.15)' : 'transparent',
                border: subTab === 'dna' ? '1px solid var(--accent)' : '1px solid transparent',
                color: subTab === 'dna' ? 'var(--accent-light)' : 'var(--text-muted)',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                transition: 'all 0.2s ease'
              }}
            >
              🧬 Tab 3: Metadata DNA
            </button>
            <button
              type="button"
              onClick={() => setSubTab('assets')}
              style={{
                background: subTab === 'assets' ? 'rgba(108, 92, 231, 0.15)' : 'transparent',
                border: subTab === 'assets' ? '1px solid var(--accent)' : '1px solid transparent',
                color: subTab === 'assets' ? 'var(--accent-light)' : 'var(--text-muted)',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                transition: 'all 0.2s ease'
              }}
            >
              ☁️ Tab 4: Aset & Recovery
            </button>
            <button
              type="button"
              onClick={() => setSubTab('logs')}
              style={{
                background: subTab === 'logs' ? 'rgba(108, 92, 231, 0.15)' : 'transparent',
                border: subTab === 'logs' ? '1px solid var(--accent)' : '1px solid transparent',
                color: subTab === 'logs' ? 'var(--accent-light)' : 'var(--text-muted)',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                transition: 'all 0.2s ease'
              }}
            >
              🖥 Tab 5: System Log
            </button>
          </div>

          {/* Sub-tab Content Panels */}
          {subTab === 'decon' && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              marginBottom: '20px'
            }}>
              <h4 style={{ margin: '0 0 16px 0', color: '#fff', fontSize: '0.9rem', fontWeight: 700 }}>🔍 Dekonstruksi Asli Kompetitor</h4>
              {(() => {
                let deconList = [];
                try { deconList = JSON.parse(item.original_deconstruction_json || '[]'); } catch {}
                if (deconList.length === 0) {
                  return <div style={{ color: 'var(--text-muted)', padding: '20px 0' }}>Tidak ada data dekonstruksi asli.</div>;
                }
                return (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                          <th style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>Klip</th>
                          <th style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>Audio Asli (Verbatim)</th>
                          <th style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>Terjemahan (ID)</th>
                          <th style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>Aksi Visual Asli</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deconList.map((d, index) => (
                          <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '10px 8px', fontWeight: 600 }}>{d.scene_number || (index + 1)}</td>
                            <td style={{ padding: '10px 8px', verticalAlign: 'top', fontStyle: 'italic' }}>{d.verbatim_audio_ori || '-'}</td>
                            <td style={{ padding: '10px 8px', verticalAlign: 'top' }}>{d.translated_audio_id || '-'}</td>
                            <td style={{ padding: '10px 8px', verticalAlign: 'top', color: '#eccc68' }}>{d.visual_action || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}

          {subTab === 'storyboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>
              <h4 style={{ margin: 0, fontWeight: '700', fontSize: '0.9rem', color: '#fff' }}>📖 Storyboard & Rencana Visual Baru</h4>
              
              {/* 1. CSS Grid of Start Frame images */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  borderBottom: '1px solid rgba(255,255,255,0.04)', 
                  paddingBottom: '6px' 
                }}>
                  <span style={{ fontWeight: '600', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    🖼️ Grid Preview Start Frame Gambar (T2I)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRegenerateItemStartFrames(item.id)}
                    disabled={item.regenerate_start_frames_status === 'running' || !!regeneratingItemSF[item.id]}
                    className="btn btn-secondary btn-sm"
                    style={{
                      fontSize: '0.72rem',
                      padding: '4px 10px',
                      background: item.regenerate_start_frames_status === 'running' ? 'rgba(155, 89, 182, 0.4)' : 'rgba(155, 89, 182, 0.15)',
                      borderColor: 'rgba(155, 89, 182, 0.3)',
                      color: '#fff',
                      cursor: item.regenerate_start_frames_status === 'running' ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {item.regenerate_start_frames_status === 'running'
                      ? `⏳ Regenerating (${item.regenerate_start_frames_progress || '0%'})`
                      : '🎨 Regenerate All Start Frames'
                    }
                  </button>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: '16px',
                  marginTop: '10px'
                }}>
                  {plan.map((p, idx) => {
                    const clipImgPath = t2iImages[idx];
                    const taskKey = `${item.id}_${p.clip_index || (idx + 1)}`;
                    const isRegenerating = regeneratingT2I[taskKey];

                    return (
                      <div key={idx} style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        alignItems: 'center',
                        background: 'rgba(0,0,0,0.1)',
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255,255,255,0.03)'
                      }}>
                        <div style={{ fontWeight: '700', fontSize: '0.72rem', color: 'var(--accent-light)' }}>
                          Klip #{p.clip_index || (idx + 1)}
                        </div>
                        <div style={{ width: '100%', height: '180px', position: 'relative', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                          {clipImgPath ? (
                            <img
                              src={clipImgPath.includes('?') ? `${clipImgPath}&t=${cacheBuster}` : `${clipImgPath}?t=${cacheBuster}`}
                              alt={`Klip ${idx + 1}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div style={{
                              width: '100%',
                              height: '100%',
                              background: 'rgba(255,255,255,0.01)',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--text-muted)',
                              fontSize: '0.62rem',
                              padding: '5px',
                              textAlign: 'center'
                            }}>
                              <span>🖼️ Belum Ada Start Frame</span>
                            </div>
                          )}
                        </div>
                        <input 
                          type="file" 
                          accept="image/*" 
                          style={{ display: 'none' }} 
                          id={`replace-sf-${item.id}-${p.clip_index || (idx + 1)}`}
                          onChange={(e) => {
                            handleUploadStartFrame(p.clip_index || (idx + 1), e.target.files[0]);
                            e.target.value = '';
                          }}
                        />
                        <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={isReadOnly || isRegenerating || replacingSF[taskKey]}
                            onClick={() => handleRegenerateT2I(p.clip_index || (idx + 1), p.t2i_prompt)}
                            style={{
                              flex: 1,
                              fontSize: '0.62rem',
                              padding: '4px 2px',
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              color: '#fff',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              textAlign: 'center',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {isRegenerating ? '⏳...' : '🔄 Regen'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={isReadOnly || isRegenerating || replacingSF[taskKey]}
                            onClick={() => document.getElementById(`replace-sf-${item.id}-${p.clip_index || (idx + 1)}`).click()}
                            style={{
                              flex: 1,
                              fontSize: '0.62rem',
                              padding: '4px 2px',
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              color: '#fff',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              textAlign: 'center',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {replacingSF[taskKey] ? '⏳...' : '📤 Replace'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Full Width list of prompt fields (no inline image) */}
              {plan.map((p, idx) => {
                const isExpanded = (activeClipIndex[item.id] !== undefined ? activeClipIndex[item.id] : 0) === idx;

                return (
                  <div key={idx} style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px'
                  }}>
                    <div 
                      onClick={() => toggleClip(item.id, idx)}
                      style={{ 
                        fontWeight: 700, 
                        fontSize: '0.82rem', 
                        color: 'var(--accent-light)', 
                        borderBottom: isExpanded ? '1px solid rgba(255,255,255,0.04)' : 'none', 
                        paddingBottom: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}
                    >
                      <span>{isExpanded ? '▼' : '▶'} Aset Klip #{p.clip_index || (idx + 1)}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {isExpanded ? 'Tutup Aset' : 'Buka Aset'}
                      </span>
                    </div>

                    {isExpanded && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {/* Voiceover Script */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>Naskah Voiceover (VO)</label>
                          <button
                            type="button"
                            onClick={(e) => {
                              writeToClipboard(p.new_vo || '');
                              const originalText = e.currentTarget.innerText;
                              e.currentTarget.innerText = '✅ Disalin!';
                              setTimeout((btn) => { if (btn) btn.innerText = originalText; }, 1500, e.currentTarget);
                            }}
                            style={{ background: 'transparent', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', fontSize: '0.65rem', padding: '0 4px', fontWeight: 600 }}
                          >
                            📋 Salin
                          </button>
                        </div>
                        <textarea
                          disabled={isReadOnly}
                          style={{ width: '100%', minHeight: '45px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', padding: '8px', color: '#fff', fontSize: '0.78rem', resize: 'vertical', lineHeight: 1.4 }}
                          value={p.new_vo || ''}
                          onChange={(e) => updatePlanField(idx, 'new_vo', e.target.value)}
                        />
                      </div>

                      {/* Aksi Visual Baru */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>Aksi Visual Baru (Deskripsi Scene)</label>
                          <button
                            type="button"
                            onClick={(e) => {
                              writeToClipboard(p.visual_action || '');
                              const originalText = e.currentTarget.innerText;
                              e.currentTarget.innerText = '✅ Disalin!';
                              setTimeout((btn) => { if (btn) btn.innerText = originalText; }, 1500, e.currentTarget);
                            }}
                            style={{ background: 'transparent', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', fontSize: '0.65rem', padding: '0 4px', fontWeight: 600 }}
                          >
                            📋 Salin
                          </button>
                        </div>
                        <textarea
                          disabled={isReadOnly}
                          style={{ width: '100%', minHeight: '45px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', padding: '8px', color: '#fff', fontSize: '0.78rem', resize: 'vertical', lineHeight: 1.4 }}
                          value={p.visual_action || ''}
                          onChange={(e) => updatePlanField(idx, 'visual_action', e.target.value)}
                          placeholder="Deskripsi aksi visual versi baru..."
                        />
                      </div>

                      {/* Prompt T2V */}
                      {p.t2v_prompt !== undefined && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>Prompt T2V (Text-to-Video)</label>
                            <button
                              type="button"
                              onClick={(e) => {
                                writeToClipboard(p.t2v_prompt || '');
                                const originalText = e.currentTarget.innerText;
                                e.currentTarget.innerText = '✅ Disalin!';
                                setTimeout((btn) => { if (btn) btn.innerText = originalText; }, 1500, e.currentTarget);
                              }}
                              style={{ background: 'transparent', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', fontSize: '0.65rem', padding: '0 4px', fontWeight: 600 }}
                            >
                              📋 Salin
                            </button>
                          </div>
                          <textarea
                            disabled={isReadOnly}
                            style={{ width: '100%', minHeight: '45px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', padding: '8px', color: '#fff', fontSize: '0.74rem', fontFamily: 'monospace', resize: 'vertical', lineHeight: 1.4 }}
                            value={p.t2v_prompt || ''}
                            onChange={(e) => updatePlanField(idx, 't2v_prompt', e.target.value)}
                            placeholder="Prompt Text-to-Video..."
                          />
                        </div>
                      )}

                      {/* Prompt T2I (Start Frame) */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>Prompt T2I (Start Frame)</label>
                          <button
                            type="button"
                            onClick={(e) => {
                              writeToClipboard(p.t2i_prompt || '');
                              const originalText = e.currentTarget.innerText;
                              e.currentTarget.innerText = '✅ Disalin!';
                              setTimeout((btn) => { if (btn) btn.innerText = originalText; }, 1500, e.currentTarget);
                            }}
                            style={{ background: 'transparent', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', fontSize: '0.65rem', padding: '0 4px', fontWeight: 600 }}
                          >
                            📋 Salin
                          </button>
                        </div>
                        <textarea
                          disabled={isReadOnly}
                          style={{ width: '100%', minHeight: '45px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', padding: '8px', color: '#fff', fontSize: '0.74rem', fontFamily: 'monospace', resize: 'vertical', lineHeight: 1.4 }}
                          value={p.t2i_prompt || ''}
                          onChange={(e) => updatePlanField(idx, 't2i_prompt', e.target.value)}
                          placeholder="Prompt Text-to-Image..."
                        />
                      </div>

                      {/* Prompt I2V (Motion) */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>Prompt I2V (Motion)</label>
                          <button
                            type="button"
                            onClick={(e) => {
                              writeToClipboard(p.i2v_prompt || '');
                              const originalText = e.currentTarget.innerText;
                              e.currentTarget.innerText = '✅ Disalin!';
                              setTimeout((btn) => { if (btn) btn.innerText = originalText; }, 1500, e.currentTarget);
                            }}
                            style={{ background: 'transparent', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', fontSize: '0.65rem', padding: '0 4px', fontWeight: 600 }}
                          >
                            📋 Salin
                          </button>
                        </div>
                        <textarea
                          disabled={isReadOnly}
                          style={{ width: '100%', minHeight: '120px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', padding: '8px', color: '#fff', fontSize: '0.74rem', fontFamily: 'monospace', resize: 'vertical', lineHeight: 1.4 }}
                          value={getFormattedPrompt(p.i2v_prompt || '')}
                          onChange={(e) => updatePlanField(idx, 'i2v_prompt', e.target.value)}
                          placeholder="Prompt Image-to-Video..."
                        />
                        {isJsonError(p.i2v_prompt) && (
                          <div style={{ fontSize: '0.68rem', color: '#ff7675', marginTop: '4px', fontWeight: 600 }}>
                            ⚠️ Format JSON tidak valid. Periksa kembali tanda baca (koma, tanda kutip, kurung).
                          </div>
                        )}
                      </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {subTab === 'dna' && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              marginBottom: '20px'
            }}>
              <h4 style={{ margin: '0 0 16px 0', color: '#fff', fontSize: '0.9rem', fontWeight: 700 }}>🧬 Metadata Video DNA</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {[
                  { field: 'pilar_konten', label: 'Pilar Konten' },
                  { field: 'hook_type', label: 'Hook Type' },
                  { field: 'visual_style', label: 'Visual Style' },
                  { field: 'signature_moment', label: 'Signature Moment' },
                  { field: 'camera_pace', label: 'Camera Pace' },
                  { field: 'primary_emotion', label: 'Primary Emotion' },
                  { field: 'affiliate_integration', label: 'Affiliate Integration' },
                  { field: 'affiliate_mention', label: 'Affiliate Mention' },
                  { field: 'scene_count', label: 'Scene Count', isNumber: true },
                  { field: 'cta_type', label: 'CTA Type' }
                ].map(({ field, label, isNumber }) => (
                  <div key={field}>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>{label}</label>
                    <input
                      type={isNumber ? 'number' : 'text'}
                      className="form-control"
                      disabled={isReadOnly}
                      style={{
                        fontSize: '0.8rem',
                        padding: '8px 12px',
                        background: 'rgba(255,255,255,0.01)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '4px',
                        color: '#fff',
                        width: '100%'
                      }}
                      value={dna[field] ?? ''}
                      onChange={(e) => {
                        const val = isNumber ? (parseInt(e.target.value) || 0) : e.target.value;
                        updateDnaField(field, val);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {subTab === 'assets' && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              marginBottom: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '0.95rem', fontWeight: 700 }}>☁️ Asset Vault & Cloud Recovery Panel</h4>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Kelola aset lokal (T2I, I2V, TTS, MD) dan unggah manual ke Nextcloud / Drive meskipun pipeline belum komplit.
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {item.nextcloud_folder_url && (
                    <a
                      href={item.nextcloud_folder_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.72rem', padding: '6px 12px', background: 'rgba(52, 152, 219, 0.2)', borderColor: 'rgba(52, 152, 219, 0.4)', color: '#3498db' }}
                    >
                      🔗 Buka Folder Nextcloud
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={handleSyncItemAssets}
                    disabled={syncingAssets[item.id]}
                    className="btn btn-primary btn-sm"
                    style={{ fontSize: '0.75rem', padding: '6px 14px', fontWeight: 600 }}
                  >
                    {syncingAssets[item.id] ? '⏳ Syncing...' : '📤 Sync ALL Available Assets to Cloud'}
                  </button>
                </div>
              </div>

              <div>
                <h5 style={{ margin: '0 0 12px 0', color: 'var(--accent-light)', fontSize: '0.82rem', fontWeight: 700 }}>
                  🎬 Status Aset per Klip & Pemulihan Granular
                </h5>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '8px' }}>Klip</th>
                        <th style={{ padding: '8px' }}>🖼️ Start Frame (T2I)</th>
                        <th style={{ padding: '8px' }}>🎥 Motion Video (I2V)</th>
                        <th style={{ padding: '8px' }}>🎵 Voiceover (TTS)</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Aksi Pemulihan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.map((p, idx) => {
                        const cIdx = p.clip_index || (idx + 1);
                        const clipImgPath = t2iImages[idx];
                        let resultObj = {};
                        try { resultObj = JSON.parse(item.result_json || '{}'); } catch(e){}
                        const vPaths = resultObj.downloaded_video_paths || resultObj.video_paths || [];
                        const clipVidPath = vPaths[idx];
                        const taskKey = `${item.id}_${cIdx}`;

                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '10px 8px', fontWeight: 700, color: '#fff' }}>Klip #{cIdx}</td>
                            <td style={{ padding: '10px 8px' }}>
                              {clipImgPath ? (
                                <span style={{ color: '#2ecc71', fontWeight: 600 }}>✅ Ready</span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>❌ Missing</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 8px' }}>
                              {clipVidPath ? (
                                <span style={{ color: '#2ecc71', fontWeight: 600 }}>✅ Ready</span>
                              ) : item.status === 'failed' || item.workflow_status === 'failed' ? (
                                <span style={{ color: '#e74c3c', fontWeight: 600 }}>❌ Failed</span>
                              ) : (
                                <span style={{ color: '#f1c40f', fontWeight: 600 }}>⏳ Pending</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 8px' }}>
                              <span style={{ color: '#2ecc71', fontWeight: 600 }}>✅ Script Ready</span>
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                              <button
                                type="button"
                                disabled={retryingI2V[taskKey]}
                                onClick={() => handleRetryClipI2V(cIdx)}
                                style={{
                                  fontSize: '0.68rem',
                                  padding: '4px 8px',
                                  background: 'rgba(230, 126, 34, 0.2)',
                                  border: '1px solid rgba(230, 126, 34, 0.4)',
                                  color: '#e67e22',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: 600
                                }}
                              >
                                {retryingI2V[taskKey] ? '⏳...' : '🔄 Retry I2V Only'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {subTab === 'logs' && renderLogs(item)}

          {/* Workflow & Production Settings */}
          <div style={{
            background: 'rgba(255,255,255,0.01)',
            border: '1px solid rgba(255,255,255,0.04)',
            borderRadius: '8px',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ fontWeight: '700', fontSize: '0.8rem', color: 'var(--accent-light)' }}>⚙️ Workflow & Production Settings</div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Column 1: TTS Switch & Settings */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={!!settings.enable_tts}
                      disabled={isReadOnly}
                      onChange={() => toggleSetting('enable_tts')}
                    />
                    <span className="slider round"></span>
                  </label>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Generate TTS (Audio Voiceover)</span>
                </div>
                {settings.enable_tts && (
                  <div style={{
                    background: 'rgba(0,0,0,0.15)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '6px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>Voice Provider</label>
                      <select
                        disabled={isReadOnly || (campaign.enable_audio_segment === 1 && voiceCast && voiceCast.length > 0)}
                        value={settings.voice_provider || 'gemini'}
                        onChange={(e) => {
                          const prov = e.target.value;
                          updateSettingField('voice_provider', prov);
                          // Auto set suitable persona
                          if (prov === 'gemini') {
                            updateSettingField('voice_persona', 'Kore');
                          } else {
                            if (campaign.target_language === 'en-US') {
                              updateSettingField('voice_persona', 'English_causual_narrator_vv1');
                            } else {
                              updateSettingField('voice_persona', 'Indonesian_casual_reporter_vv2');
                            }
                          }
                        }}
                        style={{ width: '100%', padding: '6px 8px', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', fontSize: '0.75rem' }}
                      >
                        <option value="gemini">Google Gemini TTS</option>
                        <option value="minimax">MiniMax Speech</option>
                      </select>
                      {campaign.enable_audio_segment === 1 && voiceCast && voiceCast.length > 0 && (
                        <div style={{ fontSize: '0.65rem', color: '#ff7675', marginTop: '4px', fontWeight: 600 }}>
                          🔒 Voice cast terdaftar. Pilihan provider dikunci untuk konsistensi Fase 2.
                        </div>
                      )}
                    </div>

                    {campaign.enable_audio_segment !== 1 ? (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>Voice Persona</label>
                        <select
                          disabled={isReadOnly}
                          value={settings.voice_persona || 'Kore'}
                          onChange={(e) => updateSettingField('voice_persona', e.target.value)}
                          style={{ width: '100%', padding: '6px 8px', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', fontSize: '0.75rem' }}
                        >
                          {settings.voice_provider === 'gemini' ? (
                            GEMINI_VOICES.map(v => (
                              <option key={v.id} value={v.id}>{v.avatar} {v.name} - {v.desc}</option>
                            ))
                          ) : (
                            (campaign.target_language === 'en-US' ? MINIMAX_ENGLISH_VOICES : MINIMAX_VOICES).map(v => (
                              <option key={v.id} value={v.id}>{v.avatar} {v.name} - {v.desc}</option>
                            ))
                          )}
                        </select>
                      </div>
                    ) : (
                      <div style={{ marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>🎭 Voice Cast Configuration</span>
                        {voiceCast.length === 0 ? (
                          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.72rem', padding: '4px 0' }}>
                            Belum ada karakter yang terdeteksi. Jalankan analisis (Fase 1) untuk mendaftarkan karakter secara otonom.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {voiceCast.map((ch, idx) => (
                              <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--accent-light)' }}>{ch.name}</span>
                                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>ID: {ch.id}</span>
                                </div>
                                <select
                                  disabled={isReadOnly}
                                  value={settings.voice_provider === 'gemini' ? (ch.gemini_voice_id || 'Kore') : (ch.minimax_voice_id || 'Indonesian_casual_reporter_vv2')}
                                  style={{ width: '100%', padding: '4px 6px', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', fontSize: '0.7rem' }}
                                  onChange={e => {
                                    const a = [...voiceCast];
                                    if (settings.voice_provider === 'gemini') {
                                      a[idx] = { ...a[idx], gemini_voice_id: e.target.value };
                                    } else {
                                      a[idx] = { ...a[idx], minimax_voice_id: e.target.value };
                                    }
                                    setVoiceCast(a);
                                    updateCampaignSettings({
                                      voice_cast_json: JSON.stringify({ characters: a })
                                    });
                                  }}
                                >
                                  {settings.voice_provider === 'gemini' ? (
                                    GEMINI_VOICES.map(v => (
                                      <option key={v.id} value={v.id}>{v.avatar} {v.name}</option>
                                    ))
                                  ) : (
                                    (campaign.target_language === 'en-US' ? MINIMAX_ENGLISH_VOICES : MINIMAX_VOICES).map(v => (
                                      <option key={v.id} value={v.id}>{v.avatar} {v.name}</option>
                                    ))
                                  )}
                                </select>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px', fontWeight: 600 }}>Speed ({settings.voice_speed || 1.0}x)</label>
                        <input
                          type="range"
                          min="0.5"
                          max="2.0"
                          step="0.1"
                          disabled={isReadOnly}
                          value={settings.voice_speed || 1.0}
                          onChange={(e) => updateSettingField('voice_speed', Number(e.target.value))}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px', fontWeight: 600 }}>Volume ({settings.voice_volume || 1.0}x)</label>
                        <input
                          type="range"
                          min="0.0"
                          max="2.0"
                          step="0.1"
                          disabled={isReadOnly}
                          value={settings.voice_volume || 1.0}
                          onChange={(e) => updateSettingField('voice_volume', Number(e.target.value))}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Column 2: Video Gen Switch */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={!!settings.enable_glabs}
                      disabled={isReadOnly}
                      onChange={() => toggleSetting('enable_glabs')}
                    />
                    <span className="slider round"></span>
                  </label>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Generate Video (G-Labs I2V)</span>
                </div>
                {settings.enable_glabs && (
                  <div style={{
                    background: 'rgba(0,0,0,0.15)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '6px',
                    padding: '12px 14px',
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                    lineHeight: 1.4
                  }}>
                    ℹ️ Menggunakan model Double-Pass (T2I + I2V) untuk semua adegan demi konsistensi visual.
                  </div>
                )}
              </div>

              {/* Column 3: FFmpeg Switch & Settings */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={!!settings.enable_ffmpeg}
                      disabled={isReadOnly}
                      onChange={() => toggleSetting('enable_ffmpeg')}
                    />
                    <span className="slider round"></span>
                  </label>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>FFmpeg Muxing (Mux)</span>
                </div>
                {settings.enable_ffmpeg && (
                  <div style={{
                    background: 'rgba(0,0,0,0.15)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '6px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>Sync Option</label>
                        <select
                          disabled={isReadOnly}
                          value={settings.ffmpeg_sync_option || 'smart_sync'}
                          onChange={(e) => updateSettingField('ffmpeg_sync_option', e.target.value)}
                          style={{ width: '100%', padding: '6px 8px', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', fontSize: '0.72rem' }}
                        >
                          <option value="smart_sync">Auto-Pilot Smart Sync</option>
                          <option value="shortest">Shortest Clip</option>
                        </select>
                      </div>

                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>Sync Mode</label>
                        <select
                          disabled={isReadOnly}
                          value={settings.sync_mode || 'auto'}
                          onChange={(e) => updateSettingField('sync_mode', e.target.value)}
                          style={{ width: '100%', padding: '6px 8px', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', fontSize: '0.72rem' }}
                        >
                          <option value="auto">Auto-Pilot</option>
                          <option value="manual">Manual Adjust</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px', fontWeight: 600 }}>Video Scale Zoom ({settings.ffmpeg_video_scale || 1.0}x)</label>
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.05"
                        disabled={isReadOnly}
                        value={settings.ffmpeg_video_scale || 1.0}
                        onChange={(e) => updateSettingField('ffmpeg_video_scale', Number(e.target.value))}
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px', fontWeight: 600 }}>SFX Vol ({settings.ffmpeg_sfx_volume || 0.0}x)</label>
                        <input
                          type="range"
                          min="0.0"
                          max="2.0"
                          step="0.05"
                          disabled={isReadOnly}
                          value={settings.ffmpeg_sfx_volume || 0.0}
                          onChange={(e) => updateSettingField('ffmpeg_sfx_volume', Number(e.target.value))}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px', fontWeight: 600 }}>BGM Vol ({settings.ffmpeg_bgm_volume || 0.15}x)</label>
                        <input
                          type="range"
                          min="0.0"
                          max="1.0"
                          step="0.05"
                          disabled={isReadOnly}
                          value={settings.ffmpeg_bgm_volume || 0.15}
                          onChange={(e) => updateSettingField('ffmpeg_bgm_volume', Number(e.target.value))}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action button panel */}
          {(item.workflow_status === 'ready_for_review' || isProductionFailed) && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={savingDraft[item.id] || approvingItems[item.id]}
                onClick={handleSaveDraft}
                style={{
                  padding: '10px 24px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                {savingDraft[item.id] ? '⏳ Menyimpan...' : '💾 Simpan Perubahan (Save Draft)'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={savingDraft[item.id] || approvingItems[item.id]}
                onClick={handleApprove}
                style={{
                  padding: '10px 24px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  boxShadow: '0 4px 15px rgba(108, 92, 231, 0.3)',
                  cursor: 'pointer'
                }}
              >
                {approvingItems[item.id] ? '⏳ Memproses...' : '🚀 Approve & Proceed to Production'}
              </button>
            </div>
          )}
        </div>
      );
    };

    if (!hasAngles) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Pipeline Status Header */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.01)',
            border: '1px solid rgba(255, 255, 255, 0.04)',
            borderRadius: '8px',
            padding: '16px 20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ⚙️ Pipeline Rendering Status
              </span>
            </div>
            {renderPipelineStatus(item, triggerManualStep, triggering)}
          </div>
          {(item.workflow_status && item.new_video_plan_json) ? renderV2Workbench(item) : renderOriginalDetails()}
        </div>
      );
    }

    const angleTabs = [
      { id: 'original', label: '🔍 Dekonstruksi Asli' },
      ...item.angle_variants.map((v, vIdx) => ({
        id: v.id,
        label: `⚡ Angle ${vIdx + 1}: ${v.angle_name}`
      }))
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Pipeline Status Header */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.01)',
          border: '1px solid rgba(255, 255, 255, 0.04)',
          borderRadius: '8px',
          padding: '16px 20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ⚙️ Pipeline Rendering Status
            </span>
          </div>
          {renderPipelineStatus(item, triggerManualStep, triggering)}
        </div>

        <div style={{ display: 'flex', gap: '24px', alignItems: 'stretch' }}>
          {/* Left Column: Sidebar with Vertically Stacked Tabs */}
          <div style={{
            width: '280px',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
            paddingRight: '20px'
          }}>
            {angleTabs.map(tab => {
              const isActive = activeAngleTab === tab.id;
              const isOriginal = tab.id === 'original';
              const variant = !isOriginal ? item.angle_variants.find(v => v.id === tab.id) : null;
              
              // Determine styling based on category
              let catColor = 'var(--text-muted)';
              let catBg = 'rgba(255,255,255,0.02)';
              let catBorder = 'rgba(255,255,255,0.05)';
              
              if (variant) {
                if (variant.angle_category === 'Ego') {
                  catColor = '#ff6b81';
                  catBg = 'rgba(255, 107, 129, 0.06)';
                  catBorder = 'rgba(255, 107, 129, 0.2)';
                } else if (variant.angle_category === 'Brain') {
                  catColor = '#70a1ff';
                  catBg = 'rgba(112, 161, 255, 0.06)';
                  catBorder = 'rgba(112, 161, 255, 0.2)';
                } else if (variant.angle_category === 'Gut') {
                  catColor = '#2ecc71';
                  catBg = 'rgba(46, 204, 113, 0.06)';
                  catBorder = 'rgba(46, 204, 113, 0.2)';
                }
              }

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveAngleTabs(prev => ({ ...prev, [item.id]: tab.id }))}
                  type="button"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: isActive ? 'rgba(108, 92, 231, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                    border: isActive ? '1px solid var(--accent)' : '1px solid rgba(255, 255, 255, 0.05)',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    textAlign: 'left',
                    transition: 'all 0.2s ease',
                    outline: 'none',
                    boxShadow: isActive ? '0 4px 15px rgba(108, 92, 231, 0.15)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                    }
                  }}
                >
                  <div style={{ 
                    fontWeight: '700', 
                    fontSize: '0.82rem', 
                    color: isActive ? 'var(--accent-light)' : '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    width: '100%',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {tab.label}
                  </div>
                  
                  {variant ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: '2px' }}>
                      <span style={{ 
                        fontSize: '0.62rem', 
                        background: catBg, 
                        color: catColor, 
                        border: `1px solid ${catBorder}`,
                        padding: '1px 5px', 
                        borderRadius: '3px', 
                        fontWeight: '700' 
                      }}>
                        {variant.angle_category}
                      </span>
                      {/* Miniature pipeline indicators */}
                      {renderMiniPipeline(variant)}
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                      Original Video Deconstruction
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Column: Content Workspace */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {activeAngleTab === 'original' ? (
              (item.workflow_status && item.new_video_plan_json) ? renderV2Workbench(item) : renderOriginalDetails()
            ) : (
              renderAngleVariantWorkspace(item.angle_variants.find(v => v.id === activeAngleTab))
            )}
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!id) return;
    fetchDetail();
    const hasItemInReview = items.some(item => item.workflow_status === 'ready_for_review');
    if (!hasItemInReview) {
      const interval = setInterval(fetchDetail, 8000);
      return () => clearInterval(interval);
    }
  }, [id, items.map(item => item.workflow_status).join(',')]);

  async function fetchDetail() {
    try {
      const res = await fetch(`/api/v2/re-campaigns/${id}`);
      const data = await res.json();
      if (data.campaign) {
        setCampaign(data.campaign);
        try {
          const parsed = data.campaign.voice_cast_json
            ? JSON.parse(data.campaign.voice_cast_json)?.characters || []
            : [];
          setVoiceCast(parsed);
        } catch (e) {
          setVoiceCast([]);
        }
        setItems(data.items || []);
        setStats(data.stats || null);
        setStorageProvider(data.storage_provider || 'gdrive');
        setNextcloudUrl(data.nextcloud_url || '');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div style={{ color: 'var(--text-muted)', padding: 48, textAlign: 'center' }}>Memuat...</div>
      </main>
    </div>
  );

  if (!campaign) return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>Kampanye tidak ditemukan.</div>
      </main>
    </div>
  );

  const pct = stats && stats.total > 0 ? Math.round((stats.analyzed / stats.total) * 100) : 0;

  return (
    <div className="app-layout">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes active-pulse {
          from { box-shadow: 0 0 4px rgba(52, 152, 219, 0.4); border-color: rgba(52, 152, 219, 0.5); }
          to { box-shadow: 0 0 12px rgba(52, 152, 219, 0.8); border-color: var(--accent-light); }
        }
        @keyframes pulse-glow {
          0% { opacity: 0.75; }
          50% { opacity: 1; }
          100% { opacity: 0.75; }
        }
      `}} />
      <Sidebar />
      <main className="main-content">
        <div style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto' }}>
          <div className="page-header" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* 1. Judul Kampanye */}
            <div>
              <Link href="/re-campaigns" style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>
                ← Kembali ke RE Campaign
              </Link>
              <h1 className="page-title" style={{ marginTop: 0, fontSize: '2.2rem', fontWeight: 800 }}>🎬 {campaign.campaign_name}</h1>
              
              {/* 2. ID Kampanye | Nama Akun Brand | Created Date */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                <span>🔑 ID: <code style={{ background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: '4px', color: 'var(--accent-light)', fontFamily: 'monospace' }}>{campaign.id}</code></span>
                <span style={{ opacity: 0.3 }}>|</span>
                <span>🏷️ Brand: <strong>{campaign.brand_name || 'Tidak Ditentukan'}</strong></span>
                <span style={{ opacity: 0.3 }}>|</span>
                <span>📅 Dibuat: <strong>{new Date(campaign.created_at).toLocaleString('id-ID')}</strong></span>
              </div>
            </div>

            {/* 3. Tombol Aksi Utama */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {campaign.status === 'running' ? (
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/v2/re-campaigns/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'paused' })
                      });
                      if (!res.ok) throw new Error('Gagal menghentikan kampanye');
                      fetchDetail();
                    } catch (err) {
                      showToast(err.message, 'error');
                    }
                  }}
                  className="btn"
                  style={{
                    background: 'linear-gradient(135deg, #e67e22 0%, #d35400 100%)',
                    color: '#fff', border: 'none', padding: '10px 16px', fontWeight: 600, borderRadius: '6px', cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(230, 126, 34, 0.3)'
                  }}
                >
                  ⏸️ Pause Campaign
                </button>
              ) : (
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/v2/re-campaigns/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'running' })
                      });
                      if (!res.ok) throw new Error('Gagal memulai kampanye');
                      fetchDetail();
                    } catch (err) {
                      showToast(err.message, 'error');
                    }
                  }}
                  className="btn"
                  style={{
                    background: 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)',
                    color: '#fff', border: 'none', padding: '10px 16px', fontWeight: 600, borderRadius: '6px', cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(46, 204, 113, 0.3)'
                  }}
                >
                  🟢 Start Campaign
                </button>
              )}

              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/v2/re-campaigns/${id}/sync-contentflow`, { method: 'POST' });
                    if (!res.ok) throw new Error('Gagal sync ke Contentflow');
                    showToast('Sukses sync ke Contentflow!', 'success');
                  } catch (err) {
                    showToast(err.message, 'error');
                  }
                }}
                className="btn"
                style={{
                  background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
                  color: '#fff', border: 'none', padding: '10px 16px', fontWeight: 600, borderRadius: '6px', cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(52, 152, 219, 0.3)'
                }}
              >
                🚀 Push to Content Flow
              </button>

              <button
                onClick={handleSyncDrive}
                disabled={syncing}
                className="btn"
                style={{
                  background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)',
                  color: '#fff', border: 'none', padding: '10px 16px', fontWeight: 600, borderRadius: '6px', cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(26, 188, 156, 0.3)'
                }}
              >
                {syncing ? '⏳ Syncing...' : '☁️ Sync to Cloud'}
              </button>
            </div>

            {/* 4. Accordion Info Konfigurasi */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px', width: '100%' }}>
              
              {/* Accordion 1: Info Konfigurasi Basic Creative Strategy */}
              <details open style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                <summary style={{ padding: '16px 20px', fontWeight: 600, fontSize: '0.92rem', cursor: 'pointer', outline: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
                  <span>📂 Info Konfigurasi Basic Creative Strategy</span>
                </summary>
                <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>🏷️ Nama Akun (Brand Account)</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.brand_name || 'Tidak Ditentukan'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Parent Folder Nextcloud</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.nextcloud_parent_folder || 'Default Parent Folder'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Bahasa Naskah Voiceover (Script Language)</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.target_language || 'id-ID'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>🎯 Target Demografi & Tone Bahasa</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{getDemographicLabel(campaign.target_demographic, campaign.target_demographic_custom)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>🎙 Audio Segment (per Klip)</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Provider: {campaign.voice_provider || 'minimax'} | Persona: {campaign.voice_persona || 'reporter_vv2'} | Speed: {campaign.voice_speed || 1.0}x</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>SFX Setting</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.sfx_setting === 'without_sfx' ? 'Tanpa SFX' : 'Dengan SFX'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Audit Kepatuhan Voiceover (TikTok Safe)</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.compliance_audit || 'Aktif (TikTok Safe)'}</span>
                  </div>
                  {campaign.custom_instruction && (
                    <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Custom Instruction (Opsional)</span>
                      <pre style={{ margin: 0, padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)', fontSize: '0.82rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
                        {campaign.custom_instruction}
                      </pre>
                    </div>
                  )}
                  {campaign.brand_profile_desc && (
                    <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>🧬 Brand Profile (Opsional)</span>
                      <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>{campaign.brand_profile_desc}</span>
                    </div>
                  )}
                </div>
              </details>

              {/* Accordion 2: Info Konfigurasi Aesthetics & Visual Settings */}
              <details style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                <summary style={{ padding: '16px 20px', fontWeight: 600, fontSize: '0.92rem', cursor: 'pointer', outline: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
                  <span>🎬 Info Konfigurasi Aesthetics & Visual Settings</span>
                </summary>
                <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Narrative Mode</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.narrative_mode || 'Storytelling / Casual'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Aspect Ratio</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.aspect_ratio || '9:16'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Target AI</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.target_ai || 'Google Gemini 3.6-flash'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Video Model</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.video_model || 'Google Veo'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Face Visibility</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.face_visibility || 'Faceless'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Jumlah Klip Video (N)</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.target_clips_count || 3} clips</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Jumlah Kata Per Klip</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.words_per_clip || '15 - 20 Kata'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Visual Style</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.visual_style || 'Cinematic'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Visual Mode</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.visual_mode || 'T2V & I2V'}</span>
                  </div>
                </div>
              </details>

              {/* Accordion 3: Info Konfigurasi Product Bridging Settings */}
              <details style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                <summary style={{ padding: '16px 20px', fontWeight: 600, fontSize: '0.92rem', cursor: 'pointer', outline: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
                  <span>🌉 Info Konfigurasi Product Bridging Settings</span>
                </summary>
                <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Bridging Promosi Produk</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.is_bridging_active === 1 ? 'Aktif' : 'Nonaktif'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Klip Target Promosi</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Klip Ke-{campaign.bridge_at_clip || 2}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Durasi Bridge</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.bridge_duration_clips || 1} Klip</span>
                  </div>
                  <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Instruksi Transisi Bridge</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.bridge_instruction || 'Default transition layout'}</span>
                  </div>
                </div>
              </details>

              {/* Accordion 4: Info Konfigurasi Visual Swap Overrides */}
              <details style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                <summary style={{ padding: '16px 20px', fontWeight: 600, fontSize: '0.92rem', cursor: 'pointer', outline: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
                  <span>🎭 Info Konfigurasi Visual Swap Overrides</span>
                </summary>
                <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Konsep Karakter (Framing)</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.face_visibility || 'Faceless Close-Up Shot'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Demografi Subjek / Model</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{getDemographicLabel(campaign.target_demographic, campaign.target_demographic_custom)}</span>
                  </div>
                  <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Pencahayaan & Gaya Sinematik (Lighting Ambiance)</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{campaign.visual_style || 'Cinematic Warm Moody Accent'}</span>
                  </div>
                </div>
              </details>
              
            </div>
          </div>

          <div className="card">
            <div className="card-title"><span className="icon">🎬</span> Item Produksi Video ({items.length})</div>
          <table className="ideas-table">
            <thead>
              <tr>
                <th style={{ width: '4%' }}>#</th>
                <th style={{ width: '56%' }}>Source URL</th>
                <th style={{ width: '20%' }}>Status</th>
                <th style={{ width: '20%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <Fragment key={item.id}>
                  <tr>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{idx + 1}</td>
                    <td>
                      <a href={item.source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-light)', fontSize: '0.8rem', wordBreak: 'break-all' }}>
                        {item.source_url.length > 50 ? item.source_url.slice(0, 50) + '…' : item.source_url}
                      </a>
                      {renderSocialLinks(item)}
                    </td>
                    <td>
                      {renderItemStatus(item, campaign)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(item.analyze_status === 'analyzed' || item.analyze_status === 'completed' || (item.angle_variants && item.angle_variants.length > 0)) && (
                          <button
                            type="button"
                            onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                            className="btn btn-secondary btn-sm"
                            style={{
                              fontSize: '0.7rem',
                              padding: '3px 8px',
                              background: expandedItemId === item.id ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                              color: '#fff',
                              border: '1px solid rgba(255,255,255,0.1)'
                            }}
                          >
                            {expandedItemId === item.id ? '📖 Tutup' : (item.angle_variants && item.angle_variants.length > 0 ? '📖 Workspace Angle' : '📖 Detail')}
                          </button>
                        )}
                        {(
                          item.scrape_status === 'failed' || 
                          item.analyze_status === 'failed' || 
                          item.tts_status === 'failed' || 
                          item.visual_status === 'failed' || 
                          item.ffmpeg_status === 'failed' || 
                          item.upload_status === 'failed' || 
                          item.social_post_status === 'failed'
                        ) && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleRetryItem(item.id)}
                              className="btn btn-secondary btn-sm"
                              style={{
                                fontSize: '0.7rem',
                                padding: '3px 8px',
                                background: '#2980b9',
                                color: '#fff',
                                border: '1px solid rgba(255,255,255,0.1)'
                              }}
                            >
                              🔄 Retry
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResetItem(item.id)}
                              className="btn btn-secondary btn-sm"
                              style={{
                                fontSize: '0.7rem',
                                padding: '3px 8px',
                                background: '#c0392b',
                                color: '#fff',
                                border: '1px solid rgba(255,255,255,0.1)'
                              }}
                            >
                              💥 Reset
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedItemId === item.id && (
                    <tr>
                      <td colSpan="4" style={{ background: 'var(--bg-secondary)', padding: '20px', borderTop: 'none', borderBottom: '1px solid var(--border-color)' }}>
                        {renderExpandedDetails(item)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        </div>
        {toast && (
          <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
            {toast.msg}
          </div>
        )}
      </main>
    </div>
  );
}
