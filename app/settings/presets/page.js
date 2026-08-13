'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';

const GEMINI_VOICES = [
  { id: 'Kore', name: 'Kore (Female)', avatar: '👩', desc: 'Standard Female (Skincare/Cosmetic)' },
  { id: 'Fenrir', name: 'Fenrir (Male)', avatar: '🧔', desc: 'Deep/Heavy Male (Otomotif/High-End)' },
  { id: 'Puck', name: 'Puck (Male)', avatar: '👦', desc: 'Ceria, Playful (Makanan/Promo Kilat)' },
  { id: 'Charon', name: 'Charon (Male)', avatar: '👨', desc: 'Formal, News Style (Review Tech/Finansial)' },
  { id: 'Leda', name: 'Leda (Female)', avatar: '👵', desc: 'Hangat, Ramah (Edukasi/Ibu Anak)' },
  { id: 'Zephyr', name: 'Zephyr (Male)', avatar: 'sn', desc: 'Kasual, Santai (Storytelling/Daily Vlog)' },
  { id: 'Orus', name: 'Orus (Male)', avatar: '🧔', desc: 'Tegas, Optimis (Motivasi/Online Course)' },
  { id: 'Aoede', name: 'Aoede (Female)', avatar: '👩\u200D🎨', desc: 'Artistik, Ekspresif (Fashion/Seni)' },
  { id: 'Callirrhoe', name: 'Callirrhoe (Female)', avatar: '👩\u200D💼', desc: 'Berenergi, Dinamis (Olahraga/Lifestyle)' },
  { id: 'Autonoe', name: 'Autonoe (Female)', avatar: '👩\u200D🎓', desc: 'Dewasa, Profesional (Bisnis/Corporate)' },
  { id: 'Enceladus', name: 'Enceladus (Male)', avatar: '👨\u200D🎤', desc: 'Misterius, Berat (Teaser/Trailer)' },
  { id: 'Iapetus', name: 'Iapetus (Male)', avatar: '👴', desc: 'Bijaksana, Ramah (Mentor/Tips Hidup)' },
  { id: 'Umbriel', name: 'Umbriel (Male)', avatar: '👨\u200D🔬', desc: 'Dingin, Fokus (Dokumenter/Sains)' },
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

const initialForm = {
  key: '',
  label: '',
  campaign_kinds: ['brand_editorial'],
  // Section 1: basic_strategy
  narrative_mode: 'Storytelling',
  target_language: 'id-ID',
  target_demographic: 'genz_casual',
  promotion_style: 'Softselling',
  ai_directive: '',
  mandatory_outro_line: '',
  enable_audio_segment: false,
  sfx_setting: 'without_sfx',
  enable_vo_audit: 1,
  nextcloud_parent_folder: '/MAKNA_Assets',

  // Section 2: visual_engine
  visual_style: 'Cinematic',
  visual_mode: 'hybrid_lock',
  video_model: 'veo_31_lite',
  aspect_ratio: '9:16',
  face_visibility: 'Faceless',
  target_clips_count: 4,
  words_per_clip: '17-19 kata',

  // Section 3: product_bridging
  is_bridging_active: false,
  bridge_at_clip: 2,
  bridge_duration_clips: 1,

  // Section 4: visual_swap
  is_vso_active: false,
  character_concept: 'faceless',
  subject_demographic: 'syari_classic',
  wardrobe_style: 'random',
  wardrobe_style_custom: '',
  lighting_style: 'random',
  lighting_style_custom: '',
  visual_style_preset: '3d_claymation_cozy',

  // Section 5: workflow
  approval_mode: 'storyboard',
  enable_tts: true,
  voice_provider: 'minimax',
  voice_persona: 'Indonesian_professional_anchor_vv2',
  voice_speed: 1.0,
  voice_volume: 1.0,
  tts_model_quality: 'speech-2.8-turbo',
  enable_glabs: true,
  enable_ffmpeg: true,
  ffmpeg_video_scale: 1.00,
  ffmpeg_bgm_volume: 0.00,
  ffmpeg_sfx_volume: 0.00
};

function mapPresetToForm(p) {
  const c = p.config || {};
  const bs = c.basic_strategy || {};
  const ve = c.visual_engine || {};
  const pb = c.product_bridging || {};
  const vs = c.visual_swap || {};
  const wf = c.workflow || {};

  return {
    key: p.key || '',
    label: p.label || c.label || p.key || '',
    campaign_kinds: p.campaign_kinds || c.campaign_kinds || ['brand_editorial'],
    // basic_strategy
    narrative_mode: bs.narrative_mode || 'Storytelling',
    target_language: bs.target_language || 'id-ID',
    target_demographic: bs.target_demographic || 'genz_casual',
    promotion_style: bs.promotion_style || 'Softselling',
    ai_directive: bs.ai_directive || '',
    mandatory_outro_line: bs.mandatory_outro_line || '',
    enable_audio_segment: bs.enable_audio_segment || false,
    sfx_setting: bs.sfx_setting || 'without_sfx',
    enable_vo_audit: bs.enable_vo_audit ?? 1,
    nextcloud_parent_folder: bs.nextcloud_parent_folder || '/MAKNA_Assets',

    // visual_engine
    visual_style: ve.visual_style || 'Cinematic',
    visual_mode: ve.visual_mode || 'hybrid_lock',
    video_model: ve.video_model || 'veo_31_lite',
    aspect_ratio: ve.aspect_ratio || '9:16',
    face_visibility: ve.face_visibility || 'Faceless',
    target_clips_count: ve.target_clips_count || 4,
    words_per_clip: ve.words_per_clip || '17-19 kata',

    // product_bridging
    is_bridging_active: pb.is_bridging_active || false,
    bridge_at_clip: pb.bridge_at_clip || 2,
    bridge_duration_clips: pb.bridge_duration_clips || 1,

    // visual_swap
    is_vso_active: vs.is_vso_active || false,
    character_concept: vs.character_concept || 'faceless',
    subject_demographic: vs.subject_demographic || 'syari_classic',
    wardrobe_style: vs.wardrobe_style || 'random',
    wardrobe_style_custom: vs.wardrobe_style_custom || '',
    lighting_style: vs.lighting_style || 'random',
    lighting_style_custom: vs.lighting_style_custom || '',
    visual_style_preset: vs.visual_style_preset || '3d_claymation_cozy',

    // workflow
    approval_mode: wf.approval_mode || 'storyboard',
    enable_tts: wf.enable_tts || false,
    voice_provider: bs.voice_provider || 'minimax',
    voice_persona: bs.voice_persona || 'Indonesian_professional_anchor_vv2',
    voice_speed: Number(bs.voice_speed ?? 1.0),
    voice_volume: Number(bs.voice_volume ?? 1.0),
    tts_model_quality: bs.tts_model_quality || 'speech-2.8-turbo',
    enable_glabs: wf.enable_glabs || false,
    enable_ffmpeg: wf.enable_ffmpeg || false,
    ffmpeg_video_scale: Number(wf.ffmpeg_video_scale ?? 1.00),
    ffmpeg_bgm_volume: Number(wf.ffmpeg_bgm_volume ?? 0.00),
    ffmpeg_sfx_volume: Number(wf.ffmpeg_sfx_volume ?? 0.00)
  };
}

function mapFormToPayload(f) {
  return {
    key: f.key,
    label: f.label,
    config: {
      schema_version: '2',
      label: f.label,
      campaign_kinds: f.campaign_kinds,
      basic_strategy: {
        narrative_mode: f.narrative_mode,
        voice_provider: f.voice_provider,
        voice_persona: f.voice_persona,
        voice_speed: Number(f.voice_speed),
        voice_volume: Number(f.voice_volume),
        tts_model_quality: f.tts_model_quality,
        target_language: f.target_language,
        target_demographic: f.target_demographic,
        ai_directive: f.ai_directive,
        mandatory_outro_line: f.mandatory_outro_line,
        enable_audio_segment: f.enable_audio_segment,
        sfx_setting: f.sfx_setting,
        enable_vo_audit: Number(f.enable_vo_audit),
        nextcloud_parent_folder: f.nextcloud_parent_folder,
        promotion_style: f.promotion_style
      },
      visual_engine: {
        visual_style: f.visual_style,
        visual_mode: f.visual_mode,
        video_model: f.video_model,
        aspect_ratio: f.aspect_ratio,
        face_visibility: f.face_visibility,
        target_clips_count: Number(f.target_clips_count),
        words_per_clip: f.words_per_clip
      },
      product_bridging: {
        is_bridging_active: f.is_bridging_active,
        bridge_at_clip: Number(f.bridge_at_clip),
        bridge_duration_clips: Number(f.bridge_duration_clips)
      },
      visual_swap: {
        is_vso_active: f.is_vso_active,
        character_concept: f.character_concept,
        subject_demographic: f.subject_demographic,
        wardrobe_style: f.wardrobe_style,
        wardrobe_style_custom: f.wardrobe_style_custom,
        lighting_style: f.lighting_style,
        lighting_style_custom: f.lighting_style_custom,
        visual_style_preset: f.visual_style_preset
      },
      workflow: {
        approval_mode: f.approval_mode,
        enable_tts: f.enable_tts,
        enable_glabs: f.enable_glabs,
        enable_ffmpeg: f.enable_ffmpeg,
        ffmpeg_video_scale: Number(f.ffmpeg_video_scale),
        ffmpeg_bgm_volume: Number(f.ffmpeg_bgm_volume),
        ffmpeg_sfx_volume: Number(f.ffmpeg_sfx_volume),
        enable_social_post: false,
        upload_markdown: true,
        upload_spreadsheet: false
      }
    }
  };
}

export default function PresetsPage() {
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState('');
  const [editMode, setEditMode] = useState(false); // false (list) or true (form)
  const [form, setForm] = useState(initialForm);
  const [isNew, setIsNew] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeAccordion, setActiveAccordion] = useState(0); // 0 to 4

  async function load() {
    setLoading(true);
    try {
      const [presetsRes, authRes] = await Promise.all([
        fetch('/api/v2/operator-presets').then(r => r.json()),
        fetch('/api/auth/me').then(r => r.json())
      ]);
      if (presetsRes.success) setPresets(presetsRes.presets || []);
      if (authRes.authenticated) setUser(authRes.user);
    } catch (e) {
      setMessage('Gagal memuat data: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const handleCreate = () => {
    setForm(initialForm);
    setIsNew(true);
    setEditMode(true);
    setActiveAccordion(0);
  };

  const handleEdit = (preset) => {
    setForm(mapPresetToForm(preset));
    setIsNew(false);
    setEditMode(true);
    setActiveAccordion(0);
  };

  const handleClone = (preset) => {
    const parsed = mapPresetToForm(preset);
    setForm({
      ...parsed,
      key: `${preset.key}_clone`,
      label: `${preset.label || preset.key} Clone`
    });
    setIsNew(true);
    setEditMode(true);
    setActiveAccordion(0);
  };

  const handleDelete = async (key) => {
    if (!window.confirm(`Hapus preset "${key}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v2/operator-presets/${key}`, { method: 'DELETE' }).then(r => r.json());
      if (res.success) {
        setMessage('Preset berhasil dihapus.');
        load();
      } else {
        setMessage(res.error);
      }
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.key || !form.label) return setMessage('Key dan Label wajib diisi.');
    if (!form.campaign_kinds.length) return setMessage('Pilih minimal satu jenis campaign.');
    setBusy(true);
    try {
      const body = mapFormToPayload(form);
      const res = await fetch(isNew ? '/api/v2/operator-presets' : `/api/v2/operator-presets/${form.key}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(r => r.json());

      if (res.success) {
        setMessage('Preset berhasil disimpan.');
        setEditMode(false);
        load();
      } else {
        setMessage(res.error);
      }
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  };

  const getVoices = () => {
    if (form.voice_provider === 'gemini') return GEMINI_VOICES;
    if (form.target_language === 'en-US') return MINIMAX_ENGLISH_VOICES;
    return MINIMAX_VOICES;
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  return (
    <div className="layout-with-sidebar">
      <Sidebar />
      <main className="main-content" style={{ padding: 32 }}>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1>🎛️ Preset Manager</h1>
            <p className="page-subtitle">Kelola preset strategi kreatif & visual terpusat untuk otomatisasi kampanye.</p>
          </div>
          {!editMode && isAdmin && (
            <button className="btn btn-primary" onClick={handleCreate}>+ Create Preset</button>
          )}
        </div>

        {message && (
          <div className="card" style={{ padding: 14, marginBottom: 20, background: 'var(--status-info-soft)', border: '1px solid var(--status-info-soft)' }}>
            {message}
          </div>
        )}

        {loading ? (
          <p>Memuat preset...</p>
        ) : !editMode ? (
          /* List View */
          <div className="card" style={{ padding: 20 }}>
            <h2 style={{ marginTop: 0, marginBottom: 16 }}>Daftar Preset OPC</h2>
            {presets.length === 0 ? (
              <p>Belum ada preset. Klik Create Preset untuk membuat baru.</p>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {presets.map(p => (
                  <div key={p.key} style={{ padding: 16, border: '1px solid var(--border-color)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-interactive)' }}>
                    <div>
                      <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>{p.label}</strong>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                        Key: <code style={{ color: 'var(--accent-color)' }}>{p.key}</code> · Revision: {p.revision} · Type: {p.is_system ? 'System (Read-only)' : 'Custom'}
                      </div>
                      <div style={{display:'flex',gap:6,marginTop:7,flexWrap:'wrap'}}>{(p.campaign_kinds||[]).map(kind=><span key={kind} style={{fontSize:11,padding:'3px 7px',borderRadius:12,background:'var(--status-info-soft)'}}>{kind==='product_campaign'?'Product Campaign':'Brand Editorial'}</span>)}{p.campaign_kinds_source==='inferred'&&<span style={{fontSize:11,color:'var(--warning)'}}>⚠ Inferred — Edit & Save untuk konfirmasi</span>}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {p.is_system ? (
                        isAdmin && <button className="btn btn-secondary btn-sm" onClick={() => handleClone(p)}>Clone</button>
                      ) : (
                        <>
                          {isAdmin && <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(p)}>Edit</button>}
                          <button className="btn btn-secondary btn-sm" onClick={() => handleClone(p)}>Clone</button>
                          {isAdmin && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.key)}>Delete</button>}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Form / Editor View */
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card" style={{ padding: 20 }}>
              <h2 style={{ marginTop: 0, marginBottom: 16 }}>{isNew ? 'Buat Preset Baru' : `Edit Preset: ${form.label}`}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <label className="form-label">
                  Nama Preset (Label)
                  <input
                    type="text"
                    className="form-input"
                    value={form.label}
                    onChange={e => setForm({ ...form, label: e.target.value })}
                    required
                    placeholder="Contoh: Nutribake Editorial"
                  />
                </label>
                <label className="form-label">
                  Key Preset (Unique ID)
                  <input
                    type="text"
                    className="form-input"
                    value={form.key}
                    onChange={e => setForm({ ...form, key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                    required
                    disabled={!isNew}
                    placeholder="Contoh: nutribake_editorial_v2"
                  />
                </label>
              </div>
              <fieldset style={{marginTop:16,border:'1px solid var(--border-color)',borderRadius:8,padding:12}}><legend>Digunakan untuk Campaign</legend><div style={{display:'flex',gap:18,flexWrap:'wrap'}}>{[['brand_editorial','Brand Editorial'],['product_campaign','Product Campaign']].map(([kind,label])=><label key={kind} style={{display:'flex',gap:7,alignItems:'center'}}><input type="checkbox" checked={form.campaign_kinds.includes(kind)} onChange={event=>setForm({...form,campaign_kinds:event.target.checked?[...new Set([...form.campaign_kinds,kind])]:form.campaign_kinds.filter(value=>value!==kind)})}/>{label}</label>)}</div>{form.campaign_kinds.length===0&&<small style={{color:'var(--status-danger)'}}>Pilih minimal satu jenis campaign.</small>}</fieldset>
            </div>

            {/* Accordion Panels */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Accordion 1: Creative Strategy */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                  onClick={() => setActiveAccordion(activeAccordion === 0 ? -1 : 0)}
                  style={{ padding: '16px 20px', background: 'var(--surface-interactive)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: activeAccordion === 0 ? '1px solid var(--border-color)' : 'none' }}
                >
                  <strong style={{ color: activeAccordion === 0 ? 'var(--accent-color)' : 'var(--text-primary)' }}>1. Creative Strategy (basic_strategy)</strong>
                  <span>{activeAccordion === 0 ? '▼' : '▶'}</span>
                </div>
                {activeAccordion === 0 && (
                  <div style={{ padding: 20, display: 'grid', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                      <label className="form-label">
                        Narrative Mode
                        <select className="form-select" value={form.narrative_mode} onChange={e => setForm({ ...form, narrative_mode: e.target.value })}>
                          <option value="auto">Auto (AI Decision)</option>
                          <option value="Storytelling">Storytelling</option>
                          <option value="Problem-Solution">Problem-Solution</option>
                          <option value="Educational">Educational</option>
                          <option value="Promo-Hook">Promo-Hook</option>
                        </select>
                      </label>
                      <label className="form-label">
                        Target Language
                        <select className="form-select" value={form.target_language} onChange={e => setForm({ ...form, target_language: e.target.value })}>
                          <option value="id-ID">Indonesian (id-ID)</option>
                          <option value="en-US">English (en-US)</option>
                        </select>
                      </label>
                      <label className="form-label">
                        Promotion Style
                        <select className="form-select" value={form.promotion_style} onChange={e => setForm({ ...form, promotion_style: e.target.value })}>
                          <option value="Softselling">Softselling</option>
                          <option value="Hardselling">Hardselling</option>
                        </select>
                      </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <label className="form-label">
                        Target Demographic
                        <select className="form-select" value={form.target_demographic} onChange={e => setForm({ ...form, target_demographic: e.target.value })}>
                          <option value="genz_casual">Gen Z Casual Audience</option>
                          <option value="ibu_rumah_tangga">Ibu Rumah Tangga / Keluarga Muda</option>
                          <option value="professional">Professional / B2B</option>
                          <option value="general_public">General Public</option>
                        </select>
                      </label>
                      <label className="form-label">
                        Nextcloud Parent Folder
                        <input type="text" className="form-input" value={form.nextcloud_parent_folder} onChange={e => setForm({ ...form, nextcloud_parent_folder: e.target.value })} />
                      </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <label className="form-label">
                        SFX Setting
                        <select className="form-select" value={form.sfx_setting} onChange={e => setForm({ ...form, sfx_setting: e.target.value })}>
                          <option value="without_sfx">Without SFX</option>
                          <option value="smart_sfx">Smart SFX Insertion</option>
                        </select>
                      </label>
                      <label className="form-label" style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 24 }}>
                        <input type="checkbox" checked={form.enable_audio_segment} onChange={e => setForm({ ...form, enable_audio_segment: e.target.checked })} />
                        Enable Audio Segment
                      </label>
                    </div>

                    <label className="form-label">
                      AI Directive / Guardrail
                      <textarea className="form-input" rows={3} value={form.ai_directive} onChange={e => setForm({ ...form, ai_directive: e.target.value })} placeholder="Instruksi khusus kepada Gemini..." />
                    </label>

                    <label className="form-label">
                      Mandatory Outro Line
                      <textarea className="form-input" rows={2} value={form.mandatory_outro_line} onChange={e => setForm({ ...form, mandatory_outro_line: e.target.value })} placeholder="Kalimat wajib diucapkan di akhir video..." />
                    </label>
                  </div>
                )}
              </div>

              {/* Accordion 2: Aesthetics & Visual Settings */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                  onClick={() => setActiveAccordion(activeAccordion === 1 ? -1 : 1)}
                  style={{ padding: '16px 20px', background: 'var(--surface-interactive)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: activeAccordion === 1 ? '1px solid var(--border-color)' : 'none' }}
                >
                  <strong style={{ color: activeAccordion === 1 ? 'var(--accent-color)' : 'var(--text-primary)' }}>2. Aesthetics & Visual (visual_engine)</strong>
                  <span>{activeAccordion === 1 ? '▼' : '▶'}</span>
                </div>
                {activeAccordion === 1 && (
                  <div style={{ padding: 20, display: 'grid', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                      <label className="form-label">
                        Visual Style
                        <select className="form-select" value={form.visual_style} onChange={e => setForm({ ...form, visual_style: e.target.value })}>
                          <option value="Cinematic">Cinematic</option>
                          <option value="UGC">UGC (User Generated Content)</option>
                          <option value="Food Porn">Food Porn / Aesthetic Close-Up</option>
                          <option value="Claymation">Claymation (3D Style)</option>
                        </select>
                      </label>
                      <label className="form-label">
                        Visual Mode
                        <select className="form-select" value={form.visual_mode} onChange={e => setForm({ ...form, visual_mode: e.target.value })}>
                          <option value="pure_t2v">Pure Text-to-Video</option>
                          <option value="hybrid_lock">Hybrid Image-to-Video Lock</option>
                          <option value="i2v">Image-to-Video Only</option>
                        </select>
                      </label>
                      <label className="form-label">
                        Video Model
                        <select className="form-select" value={form.video_model} onChange={e => setForm({ ...form, video_model: e.target.value })}>
                          <option value="veo_31_lite">Google Veo 3.1 Lite</option>
                        </select>
                      </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                      <label className="form-label">
                        Aspect Ratio
                        <select className="form-select" value={form.aspect_ratio} onChange={e => setForm({ ...form, aspect_ratio: e.target.value })}>
                          <option value="9:16">Portrait 9:16</option>
                          <option value="16:9">Landscape 16:9</option>
                          <option value="1:1">Square 1:1</option>
                        </select>
                      </label>
                      <label className="form-label">
                        Face Visibility
                        <select className="form-select" value={form.face_visibility} onChange={e => setForm({ ...form, face_visibility: e.target.value })}>
                          <option value="Faceless">Faceless (No visible faces)</option>
                          <option value="Visible">Visible Faces</option>
                        </select>
                      </label>
                      <label className="form-label">
                        Words per Clip
                        <select className="form-select" value={form.words_per_clip} onChange={e => setForm({ ...form, words_per_clip: e.target.value })}>
                          <option value="15-16 kata">15-16 kata (Sangat Lambat)</option>
                          <option value="17-19 kata">17-19 kata (Standard)</option>
                          <option value="20-22 kata">20-22 kata (Cepat)</option>
                        </select>
                      </label>
                    </div>

                    <label className="form-label">
                      Target Clips Count
                      <input type="number" className="form-input" min="1" max="12" value={form.target_clips_count} onChange={e => setForm({ ...form, target_clips_count: e.target.value })} />
                    </label>
                  </div>
                )}
              </div>

              {/* Accordion 3: Product Bridging Settings */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                  onClick={() => setActiveAccordion(activeAccordion === 2 ? -1 : 2)}
                  style={{ padding: '16px 20px', background: 'var(--surface-interactive)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: activeAccordion === 2 ? '1px solid var(--border-color)' : 'none' }}
                >
                  <strong style={{ color: activeAccordion === 2 ? 'var(--accent-color)' : 'var(--text-primary)' }}>3. Product Bridging (product_bridging)</strong>
                  <span>{activeAccordion === 2 ? '▼' : '▶'}</span>
                </div>
                {activeAccordion === 2 && (
                  <div style={{ padding: 20, display: 'grid', gap: 16 }}>
                    <label className="form-label" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <input type="checkbox" checked={form.is_bridging_active} onChange={e => setForm({ ...form, is_bridging_active: e.target.checked })} />
                      Aktifkan Product Bridging
                    </label>

                    {form.is_bridging_active && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <label className="form-label">
                          Bridge at Clip (Index Klip)
                          <input type="number" className="form-input" min="1" max="12" value={form.bridge_at_clip} onChange={e => setForm({ ...form, bridge_at_clip: e.target.value })} />
                        </label>
                        <label className="form-label">
                          Bridge Duration (Jumlah Klip)
                          <input type="number" className="form-input" min="1" max="12" value={form.bridge_duration_clips} onChange={e => setForm({ ...form, bridge_duration_clips: e.target.value })} />
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Accordion 4: Visual Swap Overrides (VSO) */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                  onClick={() => setActiveAccordion(activeAccordion === 3 ? -1 : 3)}
                  style={{ padding: '16px 20px', background: 'var(--surface-interactive)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: activeAccordion === 3 ? '1px solid var(--border-color)' : 'none' }}
                >
                  <strong style={{ color: activeAccordion === 3 ? 'var(--accent-color)' : 'var(--text-primary)' }}>4. Visual Swap Overrides (visual_swap)</strong>
                  <span>{activeAccordion === 3 ? '▼' : '▶'}</span>
                </div>
                {activeAccordion === 3 && (
                  <div style={{ padding: 20, display: 'grid', gap: 16 }}>
                    <label className="form-label" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <input type="checkbox" checked={form.is_vso_active} onChange={e => setForm({ ...form, is_vso_active: e.target.checked })} />
                      Aktifkan VSO (Mascot / Custom Character)
                    </label>

                    {form.is_vso_active && (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                          <label className="form-label">
                            Character Concept
                            <select className="form-select" value={form.character_concept} onChange={e => setForm({ ...form, character_concept: e.target.value })}>
                              <option value="faceless">Faceless Character</option>
                              <option value="mascot">Mascot Mode</option>
                              <option value="custom">Custom Prompt Override</option>
                            </select>
                          </label>
                          <label className="form-label">
                            Subject Demographic
                            <select className="form-select" value={form.subject_demographic} onChange={e => {
                              const val = e.target.value;
                              let concept = form.character_concept;
                              if (val.startsWith('mascot_universe_')) {
                                concept = 'cartoon_face';
                              } else if (val.startsWith('stylized_3d_')) {
                                concept = 'stylized_3d';
                              } else {
                                concept = 'faceless';
                              }
                              setForm({ ...form, subject_demographic: val, character_concept: concept, wardrobe_style: 'random' });
                            }}>
                              <optgroup label="── Manusia Terpercaya ──">
                                <option value="syari_classic">Wanita Gamis Syar'iy (Hanya Tangan)</option>
                                <option value="caucasian_male">Pria Kaukasia (Hanya Tangan)</option>
                                <option value="stylized_3d_muslimah">Wanita 3D Stylized (Clay Art)</option>
                                <option value="stylized_3d_male">Pria 3D Stylized (Clay Art)</option>
                                <option value="stylized_3d_duo">Duo 3D Stylized - 2 Karakter (Clay Art)</option>
                              </optgroup>
                              <optgroup label="── Semesta Maskot Otonom ──">
                                <option value="mascot_universe_herbal">🌿 Semesta Herbal (Jahe, Kunyit, Mint...)</option>
                                <option value="mascot_universe_kitchen">🍳 Semesta Dapur (Wajan, Blender, Tomat...)</option>
                                <option value="mascot_universe_home_living">🏠 Semesta Rumah (Vacuum, Sofa, Lampu...)</option>
                                <option value="mascot_universe_pet">🐾 Semesta Hewan Peliharaan (Kucing, Anjing...)</option>
                              </optgroup>
                            </select>
                          </label>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                          <label className="form-label">
                            Wardrobe Style
                            <select className="form-select" value={form.wardrobe_style} onChange={e => setForm({ ...form, wardrobe_style: e.target.value })}>
                              <option value="random">Randomized</option>
                              <option value="amber_terracotta">Amber Terracotta</option>
                              <option value="pastel_blue">Pastel Blue Cozy</option>
                              <option value="custom">Custom Wardrobe</option>
                            </select>
                          </label>
                          {form.wardrobe_style === 'custom' && (
                            <label className="form-label">
                              Custom Wardrobe Prompt
                              <input type="text" className="form-input" value={form.wardrobe_style_custom} onChange={e => setForm({ ...form, wardrobe_style_custom: e.target.value })} />
                            </label>
                          )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                          <label className="form-label">
                            Lighting Style
                            <select className="form-select" value={form.lighting_style} onChange={e => setForm({ ...form, lighting_style: e.target.value })}>
                              <option value="random">Randomized</option>
                              <option value="window_daylight">Window Daylight</option>
                              <option value="studio_softbox">Studio Softbox</option>
                              <option value="custom">Custom Lighting</option>
                            </select>
                          </label>
                          {form.lighting_style === 'custom' && (
                            <label className="form-label">
                              Custom Lighting Prompt
                              <input type="text" className="form-input" value={form.lighting_style_custom} onChange={e => setForm({ ...form, lighting_style_custom: e.target.value })} />
                            </label>
                          )}
                        </div>

                        {form.subject_demographic.startsWith('mascot_universe_') && (
                          <label className="form-label">
                            🎨 Gaya Estetika Animasi Maskot
                            <select className="form-select" value={form.visual_style_preset} onChange={e => setForm({ ...form, visual_style_preset: e.target.value })}>
                              <option value="3d_claymation_cozy">3D Claymation Cozy (Shaun the Sheep Look)</option>
                              <option value="kawaii_flat_vector">2D Kawaii Flat Vector (Minimalis Jepang)</option>
                              <option value="ghibli_watercolor">Studio Ghibli Watercolor (Cat Air Magis)</option>
                            </select>
                          </label>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Accordion 5: Workflow & Production Settings */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                  onClick={() => setActiveAccordion(activeAccordion === 4 ? -1 : 4)}
                  style={{ padding: '16px 20px', background: 'var(--surface-interactive)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: activeAccordion === 4 ? '1px solid var(--border-color)' : 'none' }}
                >
                  <strong style={{ color: activeAccordion === 4 ? 'var(--accent-color)' : 'var(--text-primary)' }}>5. Workflow & Audio (workflow)</strong>
                  <span>{activeAccordion === 4 ? '▼' : '▶'}</span>
                </div>
                {activeAccordion === 4 && (
                  <div style={{ padding: 20, display: 'grid', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <label className="form-label">
                        Approval Mode
                        <select className="form-select" value={form.approval_mode} onChange={e => setForm({ ...form, approval_mode: e.target.value })}>
                          <option value="storyboard">Manual Review (Awaiting Storyboard Approval)</option>
                          <option value="none">Full Auto (No Approval Needed)</option>
                        </select>
                      </label>
                      <label className="form-label" style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 24 }}>
                        <input type="checkbox" checked={form.enable_tts} onChange={e => setForm({ ...form, enable_tts: e.target.checked })} />
                        Enable TTS Voice-Over
                      </label>
                    </div>

                    {form.enable_tts && (
                      <fieldset style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 16, display: 'grid', gap: 12 }}>
                        <legend style={{ padding: '0 8px', fontSize: 13, fontWeight: 600 }}>🔊 TTS Audio Engine Settings</legend>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                          <label className="form-label">
                            TTS Provider
                            <select className="form-select" value={form.voice_provider} onChange={e => setForm({ ...form, voice_provider: e.target.value })}>
                              <option value="minimax">MiniMax VO Engine</option>
                              <option value="gemini">Gemini TTS Engine</option>
                            </select>
                          </label>
                          <label className="form-label">
                            Voice Persona
                            <select className="form-select" value={form.voice_persona} onChange={e => setForm({ ...form, voice_persona: e.target.value })}>
                              {getVoices().map(v => (
                                <option key={v.id} value={v.id}>{v.name} - {v.desc}</option>
                              ))}
                            </select>
                          </label>
                          <label className="form-label">
                            TTS Model Quality
                            <select className="form-select" value={form.tts_model_quality} onChange={e => setForm({ ...form, tts_model_quality: e.target.value })}>
                              <option value="speech-2.8-turbo">Speech 2.8 Turbo</option>
                              <option value="speech-2.8-standard">Speech 2.8 Standard</option>
                            </select>
                          </label>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                          <label className="form-label">
                            Voice Speed ({form.voice_speed}x)
                            <input type="range" min="0.5" max="2.0" step="0.1" value={form.voice_speed} onChange={e => setForm({ ...form, voice_speed: parseFloat(e.target.value) })} style={{ width: '100%' }} />
                          </label>
                          <label className="form-label">
                            Voice Volume ({form.voice_volume}x)
                            <input type="range" min="0.1" max="1.0" step="0.1" value={form.voice_volume} onChange={e => setForm({ ...form, voice_volume: parseFloat(e.target.value) })} style={{ width: '100%' }} />
                          </label>
                        </div>
                      </fieldset>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <label className="form-label" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <input type="checkbox" checked={form.enable_glabs} onChange={e => setForm({ ...form, enable_glabs: e.target.checked })} />
                        Enable G-Labs (Webhook Rendering)
                      </label>
                      <label className="form-label" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <input type="checkbox" checked={form.enable_ffmpeg} onChange={e => setForm({ ...form, enable_ffmpeg: e.target.checked })} />
                        Enable FFmpeg Video Muxing
                      </label>
                    </div>

                    {form.enable_ffmpeg && (
                      <fieldset style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 16, display: 'grid', gap: 12 }}>
                        <legend style={{ padding: '0 8px', fontSize: 13, fontWeight: 600 }}>🎞️ FFmpeg Render Settings</legend>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                          <label className="form-label">
                            Video Scale (Zoom: {Math.round(form.ffmpeg_video_scale * 100)}%)
                            <input type="range" min="1.0" max="2.0" step="0.05" value={form.ffmpeg_video_scale} onChange={e => setForm({ ...form, ffmpeg_video_scale: parseFloat(e.target.value) })} style={{ width: '100%', padding: 0 }} />
                          </label>
                          <label className="form-label">
                            BGM Volume ({form.ffmpeg_bgm_volume}x)
                            <input type="range" min="0.0" max="1.0" step="0.05" value={form.ffmpeg_bgm_volume} onChange={e => setForm({ ...form, ffmpeg_bgm_volume: parseFloat(e.target.value) })} style={{ width: '100%', padding: 0 }} />
                          </label>
                          <label className="form-label">
                            SFX Volume ({form.ffmpeg_sfx_volume}x)
                            <input type="range" min="0.0" max="1.0" step="0.05" value={form.ffmpeg_sfx_volume} onChange={e => setForm({ ...form, ffmpeg_sfx_volume: parseFloat(e.target.value) })} style={{ width: '100%', padding: 0 }} />
                          </label>
                        </div>
                      </fieldset>
                    )}

                  </div>
                )}
              </div>

            </div>

            {/* Form Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditMode(false)} disabled={busy}>Cancel</button>
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save Preset'}</button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
