'use client';

import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import AiVisualIdentityBuilderModal from '../../components/AiVisualIdentityBuilderModal';
import ReferenceAssetManager from '../../components/ReferenceAssetManager';

const SUBJECT_KINDS = ['human', 'blank_face_3d', 'animal', 'mascot_object'];
const HUMAN_FACELESS_MODES = ['hands_only', 'crop_below_neck', 'back_view', 'silhouette', 'first_person_pov', 'blank_face_3d'];
const ALL_FACELESS_MODES = [...HUMAN_FACELESS_MODES, 'not_applicable'];
const WARDROBE_MODES = ['fixed', 'sequential', 'stable_random', 'custom'];
const SLEEVE_POLICIES = ['wrists_covered', 'forearms_exposed', 'not_applicable'];
const BACKGROUND_DENSITIES = ['minimal', 'balanced', 'dense'];
const LIGHTING_TEMPERATURES = ['warm', 'cool', 'neutral', 'warm_neutral', 'cool_neutral'];
const LIGHTING_CONTRASTS = ['soft', 'medium', 'high_contrast'];
const CAMERA_FRAMINGS = ['hands_closeup', 'forearms_and_hands', 'crop_below_neck', 'back_view', 'full_body_blank_face', 'object_or_animal'];
const CAMERA_PERSPECTIVES = ['first_person', 'third_person'];
const CAMERA_LENS_LOOKS = ['natural_50mm', 'wide_angle_24mm', 'telephoto_85mm', 'macro_closeup'];
const CAMERA_DEPTHS = ['shallow', 'deep', 'medium'];
const CAMERA_MOVEMENTS = ['still', 'subtle_handheld', 'slow_pan', 'zoom_in'];

const DEFAULT_CONFIG = {
  subject: { kind: 'human', faceless_mode: 'hands_only', demographic_key: 'syari_classic', custom_description: '', character_count: 1 },
  wardrobe: { mode: 'fixed', preset_key: 'sage_muted', custom_description: '', primary_color: '', secondary_color: '', material: '', sleeve_policy: 'wrists_covered', accessories: [] },
  environment: { preset_key: 'nordic_kitchen', custom_description: '', material_palette: [], props: [], background_density: 'balanced' },
  lighting: { preset_key: 'window_daylight', custom_description: '', color_temperature: 'warm_neutral', contrast: 'soft' },
  camera: { framing: 'forearms_and_hands', perspective: 'third_person', lens_look: 'natural_50mm', depth_of_field: 'shallow', movement: 'subtle_handheld' },
  style: { preset_key: 'cinematic_realistic', custom_description: '', aspect_ratio: '9:16' },
  guardrails: { face_visibility: 'prohibited', reflection_face: 'prohibited', extra_people: 'prohibited', identity_drift: 'prohibited', wardrobe_drift: 'prohibited', required_negative_prompts: [] }
};

export default function VisualIdentityStudioPage() {
  const [activeTab, setActiveTab] = useState('system'); // 'system' | 'user' | 'archived'
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingPreset, setEditingPreset] = useState(null); // null | preset object to create/edit
  const [previewPreset, setPreviewPreset] = useState(null); // null | preset object to preview resolved prompts
  const [saving, setSaving] = useState(false);
  const [showAiBuilder, setShowAiBuilder] = useState(false);

  // Form State
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [presetKey, setPresetKey] = useState('');
  const [config, setConfig] = useState(DEFAULT_CONFIG);

  useEffect(() => {
    fetchPresets();
  }, [activeTab]);

  const fetchPresets = async () => {
    setLoading(true);
    setError(null);
    try {
      const status = activeTab === 'archived' ? 'archived' : 'active';
      const res = await fetch(`/api/v2/visual-identities?status=${status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to fetch presets');
      
      // Filter based on activeTab (system vs user)
      if (activeTab === 'system') {
        setPresets(json.data.filter(p => p.source === 'system'));
      } else if (activeTab === 'user') {
        setPresets(json.data.filter(p => p.source === 'user'));
      } else {
        setPresets(json.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setLabel('');
    setDescription('');
    setPresetKey('');
    setConfig(DEFAULT_CONFIG);
    setEditingPreset({ isNew: true });
  };

  const handleOpenEdit = (preset) => {
    setLabel(preset.label);
    setDescription(preset.description || '');
    setPresetKey(preset.preset_key);
    setConfig({
      ...DEFAULT_CONFIG,
      ...preset.config
    });
    setEditingPreset(preset);
  };

  const handleClone = async (preset) => {
    try {
      const res = await fetch(`/api/v2/visual-identities/${preset.id}/clone`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          label: `Copy of ${preset.label}`,
          preset_key: `${preset.preset_key}_copy_${Math.random().toString(36).substring(7)}`
        })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Clone failed');
      setActiveTab('user');
      fetchPresets();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleArchive = async (preset) => {
    if (!confirm(`Are you sure you want to archive "${preset.label}"?`)) return;
    try {
      const res = await fetch(`/api/v2/visual-identities/${preset.id}`, {
        method: 'DELETE'
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Archive failed');
      fetchPresets();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const isNew = editingPreset.isNew;
      const url = isNew ? '/api/v2/visual-identities' : `/api/v2/visual-identities/${editingPreset.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const payload = {
        label,
        description,
        preset_key: isNew ? presetKey : undefined,
        config
      };

      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Save failed');
      
      setEditingPreset(null);
      setActiveTab('user');
      fetchPresets();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async (preset) => {
    try {
      const res = await fetch('/api/v2/visual-identities/resolve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ preset_id: preset.id })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Resolution failed');
      setPreviewPreset({
        label: preset.label,
        resolved: json.data.snapshot.resolved
      });
    } catch (err) {
      alert(err.message);
    }
  };

  const updateConfigField = (section, field, value) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-container">
          {/* Header */}
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <h1>🎭 Visual Identity Studio</h1>
              <p className="page-subtitle">Kelola preset identitas visual terpadu, spesifikasi model faceless, wardrobe, dan scene styling.</p>
            </div>
            {!editingPreset && !previewPreset && (
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-secondary" onClick={() => setShowAiBuilder(true)}>
                  ✨ Design with AI
                </button>
                <button className="btn btn-primary" onClick={handleOpenCreate}>
                  + Create Manually
                </button>
              </div>
            )}
          </div>

        {/* Tab Navigation */}
        <div style={{ display: 'inline-flex', gap: 6, padding: 6, background: 'var(--sidebar)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', marginBottom: 24 }}>
          {['system', 'user', 'archived'].map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setEditingPreset(null); setPreviewPreset(null); }}
              style={{
                background: 'none',
                border: 'none',
                padding: '10px 20px',
                fontFamily: 'inherit',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: activeTab === tab ? 'var(--action-primary)' : 'var(--text-muted)',
                backgroundColor: activeTab === tab ? 'var(--surface-interactive)' : 'transparent',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                transition: 'var(--transition)'
              }}
            >
              {tab === 'system' ? 'System Presets' : tab === 'user' ? 'My Presets' : 'Archived'}
            </button>
          ))}
        </div>

        {/* Main Workspace */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/25 p-4 rounded-xl mb-6 text-sm text-rose-400 flex items-center gap-2">
            <span>⚠️ Error:</span> {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500 font-medium">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading Visual Catalog...
          </div>
        ) : !editingPreset && !previewPreset ? (
          /* Preset Catalog Grid */
          presets.length === 0 ? (
            <div className="bg-slate-900/40 border border-dashed border-slate-800 p-12 text-center rounded-2xl text-slate-500">
              No presets found in this category.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
              {presets.map(preset => (
                <div
                  key={preset.id}
                  className="card"
                  style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 24 }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', items: 'center', marginBottom: 16 }}>
                      <span style={{ 
                        padding: '4px 10px', 
                        borderRadius: 20, 
                        fontSize: '0.7rem', 
                        fontWeight: 700, 
                        textTransform: 'uppercase', 
                        background: preset.source === 'system' ? 'var(--status-info-soft)' : 'var(--status-success-soft)', 
                        color: preset.source === 'system' ? 'var(--status-info)' : 'var(--status-success)', 
                        border: `1px solid ${preset.source === 'system' ? 'rgba(96,165,250,0.2)' : 'rgba(74,222,128,0.2)'}`, 
                        width: 'fit-content' 
                      }}>
                        {preset.source}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                        v{preset.version}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                      {preset.label}
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: 24, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {preset.description || 'No description provided.'}
                    </p>

                    {/* Metadata Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, background: 'rgba(12, 18, 30, 0.4)', border: '1px solid var(--border-color)', padding: 14, borderRadius: 'var(--radius)', fontSize: '0.75rem', marginBottom: 24 }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.5px', display: 'block', marginBottom: 2 }}>Subject</span>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600, display: 'block', textTransform: 'capitalize' }}>{preset.config?.subject?.kind}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.5px', display: 'block', marginBottom: 2 }}>Faceless Mode</span>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600, display: 'block', textTransform: 'capitalize' }}>{(preset.config?.subject?.faceless_mode || '').replace('_', ' ')}</span>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.5px', display: 'block', marginBottom: 2 }}>Environment Preset</span>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600, display: 'block', textTransform: 'capitalize' }}>{(preset.config?.environment?.preset_key || '').replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
                    <button
                      onClick={() => handlePreview(preset)}
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, fontSize: '0.75rem' }}
                    >
                      Preview Prompt
                    </button>
                    <button
                      onClick={() => handleClone(preset)}
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, fontSize: '0.75rem' }}
                    >
                      Clone
                    </button>
                    {preset.source === 'user' && activeTab === 'user' && (
                      <>
                        <button
                          onClick={() => handleOpenEdit(preset)}
                          className="btn btn-secondary btn-sm"
                          style={{ flex: 1, fontSize: '0.75rem', borderColor: 'var(--accent-color)', color: 'var(--accent-color)' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleArchive(preset)}
                          className="btn btn-danger btn-sm"
                          style={{ flex: 1, fontSize: '0.75rem' }}
                        >
                          Archive
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : previewPreset ? (
          /* Resolved Prompt Preview Pane */
          <div className="card" style={{ padding: 32, position: 'relative' }}>
            <button
              onClick={() => setPreviewPreset(null)}
              className="btn btn-secondary btn-sm"
              style={{ position: 'absolute', top: 20, right: 20, padding: '6px 12px' }}
            >
              ✕ Tutup
            </button>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--action-primary)', marginBottom: 24 }}>
              Prompt Preview for: {previewPreset.label}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {Object.entries(previewPreset.resolved).map(([key, value]) => (
                <div key={key} style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', padding: 16, borderRadius: 'var(--radius)' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    {key.replace('_', ' ')}
                  </span>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{value || 'N/A'}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Create & Edit Studio Form */
          <form onSubmit={handleSave} className="card" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: 16 }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--action-primary)', margin: 0 }}>
                {editingPreset.isNew ? 'Create New Preset' : `Editing Preset: ${editingPreset.label}`}
              </h2>
              <button
                type="button"
                onClick={() => setEditingPreset(null)}
                className="btn btn-secondary btn-sm"
              >
                Cancel & Close
              </button>
            </div>

            {/* Section 1: Basic Info */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <label className="form-label">
                Identity Name
                <input
                  type="text"
                  required
                  placeholder="e.g. Muslimah Sage Kitchen"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="form-input"
                />
              </label>
              {editingPreset.isNew && (
                <label className="form-label">
                  Custom Preset Key (Slug)
                  <input
                    type="text"
                    placeholder="e.g. muslimah_sage_kitchen"
                    value={presetKey}
                    onChange={(e) => setPresetKey(e.target.value)}
                    className="form-input"
                  />
                </label>
              )}
              <label className="form-label">
                Description
                <input
                  type="text"
                  placeholder="Describe the aesthetic and purpose of this identity"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="form-input"
                />
              </label>
            </div>

            {/* Section 2: Subject */}
            <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--action-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: 8, margin: 0 }}>Subject Properties</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <label className="form-label">
                  Subject Kind
                  <select
                    value={config.subject.kind}
                    onChange={(e) => updateConfigField('subject', 'kind', e.target.value)}
                    className="form-select"
                    style={{ textTransform: 'capitalize' }}
                  >
                    {SUBJECT_KINDS.map(kind => (
                      <option key={kind} value={kind}>{kind.replace('_', ' ')}</option>
                    ))}
                  </select>
                </label>
                <label className="form-label">
                  Faceless Mode
                  <select
                    value={config.subject.faceless_mode}
                    onChange={(e) => updateConfigField('subject', 'faceless_mode', e.target.value)}
                    className="form-select"
                    style={{ textTransform: 'capitalize' }}
                  >
                    {ALL_FACELESS_MODES.map(mode => (
                      <option key={mode} value={mode}>{mode.replace('_', ' ')}</option>
                    ))}
                  </select>
                </label>
                <label className="form-label">
                  Demographic Key
                  <input
                    type="text"
                    value={config.subject.demographic_key}
                    onChange={(e) => updateConfigField('subject', 'demographic_key', e.target.value)}
                    className="form-input"
                  />
                </label>
              </div>
              <label className="form-label" style={{ marginTop: 12 }}>
                Custom Subject Description (Optional)
                <input
                  type="text"
                  placeholder="e.g. delicate Southeast Asian female hands, smooth skin, slender fingers"
                  value={config.subject.custom_description}
                  onChange={(e) => updateConfigField('subject', 'custom_description', e.target.value)}
                  className="form-input"
                />
              </label>
            </div>

            {/* Section 3: Wardrobe */}
            <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--action-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: 8, margin: 0 }}>Wardrobe & Colors</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <label className="form-label">
                  Wardrobe Mode
                  <select
                    value={config.wardrobe.mode}
                    onChange={(e) => updateConfigField('wardrobe', 'mode', e.target.value)}
                    className="form-select"
                    style={{ textTransform: 'capitalize' }}
                  >
                    {WARDROBE_MODES.map(mode => (
                      <option key={mode} value={mode}>{mode.replace('_', ' ')}</option>
                    ))}
                  </select>
                </label>
                <label className="form-label">
                  Wardrobe Preset Key
                  <input
                    type="text"
                    value={config.wardrobe.preset_key}
                    onChange={(e) => updateConfigField('wardrobe', 'preset_key', e.target.value)}
                    className="form-input"
                  />
                </label>
                <label className="form-label">
                  Sleeve Policy
                  <select
                    value={config.wardrobe.sleeve_policy}
                    onChange={(e) => updateConfigField('wardrobe', 'sleeve_policy', e.target.value)}
                    className="form-select"
                    style={{ textTransform: 'capitalize' }}
                  >
                    {SLEEVE_POLICIES.map(policy => (
                      <option key={policy} value={policy}>{policy.replace('_', ' ')}</option>
                    ))}
                  </select>
                </label>
                <label className="form-label">
                  Primary Color (Hex or Label)
                  <input
                    type="text"
                    placeholder="e.g. #8A9A7B"
                    value={config.wardrobe.primary_color}
                    onChange={(e) => updateConfigField('wardrobe', 'primary_color', e.target.value)}
                    className="form-input"
                  />
                </label>
              </div>
              <label className="form-label" style={{ marginTop: 12 }}>
                Custom Wardrobe Description (Optional)
                <input
                  type="text"
                  placeholder="e.g. wearing a premium linen flowing modest dress with neat cuff details"
                  value={config.wardrobe.custom_description}
                  onChange={(e) => updateConfigField('wardrobe', 'custom_description', e.target.value)}
                  className="form-input"
                />
              </label>
            </div>

            {/* Section 4: Environment */}
            <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--action-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: 8, margin: 0 }}>Environment & Background</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <label className="form-label">
                  Environment Preset
                  <input
                    type="text"
                    value={config.environment.preset_key}
                    onChange={(e) => updateConfigField('environment', 'preset_key', e.target.value)}
                    className="form-input"
                  />
                </label>
                <label className="form-label">
                  Background Density
                  <select
                    value={config.environment.background_density}
                    onChange={(e) => updateConfigField('environment', 'background_density', e.target.value)}
                    className="form-select"
                    style={{ textTransform: 'capitalize' }}
                  >
                    {BACKGROUND_DENSITIES.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="form-label" style={{ marginTop: 12 }}>
                Custom Environment Description (Optional)
                <input
                  type="text"
                  placeholder="e.g. standing in a bright minimalist aesthetic cafe, blurred warm light bulbs background"
                  value={config.environment.custom_description}
                  onChange={(e) => updateConfigField('environment', 'custom_description', e.target.value)}
                  className="form-input"
                />
              </label>
            </div>

            {/* Section 5: Lighting */}
            <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--action-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: 8, margin: 0 }}>Lighting Style</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <label className="form-label">
                  Lighting Preset
                  <input
                    type="text"
                    value={config.lighting.preset_key}
                    onChange={(e) => updateConfigField('lighting', 'preset_key', e.target.value)}
                    className="form-input"
                  />
                </label>
                <label className="form-label">
                  Color Temperature
                  <select
                    value={config.lighting.color_temperature}
                    onChange={(e) => updateConfigField('lighting', 'color_temperature', e.target.value)}
                    className="form-select"
                    style={{ textTransform: 'capitalize' }}
                  >
                    {LIGHTING_TEMPERATURES.map(t => (
                      <option key={t} value={t}>{t.replace('_', ' ')}</option>
                    ))}
                  </select>
                </label>
                <label className="form-label">
                  Contrast
                  <select
                    value={config.lighting.contrast}
                    onChange={(e) => updateConfigField('lighting', 'contrast', e.target.value)}
                    className="form-select"
                    style={{ textTransform: 'capitalize' }}
                  >
                    {LIGHTING_CONTRASTS.map(c => (
                      <option key={c} value={c}>{c.replace('_', ' ')}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {/* Section 6: Camera */}
            <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--action-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: 8, margin: 0 }}>Camera & Framing</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <label className="form-label">
                  Framing
                  <select
                    value={config.camera.framing}
                    onChange={(e) => updateConfigField('camera', 'framing', e.target.value)}
                    className="form-select"
                    style={{ textTransform: 'capitalize' }}
                  >
                    {CAMERA_FRAMINGS.map(f => (
                      <option key={f} value={f}>{f.replace('_', ' ')}</option>
                    ))}
                  </select>
                </label>
                <label className="form-label">
                  Perspective
                  <select
                    value={config.camera.perspective}
                    onChange={(e) => updateConfigField('camera', 'perspective', e.target.value)}
                    className="form-select"
                    style={{ textTransform: 'capitalize' }}
                  >
                    {CAMERA_PERSPECTIVES.map(p => (
                      <option key={p} value={p}>{p.replace('_', ' ')}</option>
                    ))}
                  </select>
                </label>
                <label className="form-label">
                  Lens Look
                  <select
                    value={config.camera.lens_look}
                    onChange={(e) => updateConfigField('camera', 'lens_look', e.target.value)}
                    className="form-select"
                    style={{ textTransform: 'capitalize' }}
                  >
                    {CAMERA_LENS_LOOKS.map(l => (
                      <option key={l} value={l}>{l.replace('_', ' ')}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {/* Section 7: Style */}
            <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--action-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: 8, margin: 0 }}>Art Style</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                <label className="form-label">
                  Style Preset
                  <input
                    type="text"
                    value={config.style.preset_key}
                    onChange={(e) => updateConfigField('style', 'preset_key', e.target.value)}
                    className="form-input"
                  />
                </label>
                <label className="form-label">
                  Aspect Ratio
                  <input
                    type="text"
                    value={config.style.aspect_ratio}
                    onChange={(e) => updateConfigField('style', 'aspect_ratio', e.target.value)}
                    className="form-input"
                  />
                </label>
              </div>
            </div>

            {/* Locked Guardrails Summary */}
            <div style={{ background: 'var(--status-danger-soft)', border: '1px solid rgba(251, 113, 133, 0.15)', padding: 18, borderRadius: 'var(--radius)' }}>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--status-danger)', marginBottom: 8, margin: 0 }}>Locked Deterministic Guardrails</h3>
              <ul style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 16, margin: 0 }}>
                <li>Face Visibility is locked to <strong style={{ color: 'var(--text-secondary)' }}>PROHIBITED</strong>.</li>
                <li>Reflections showing faces is locked to <strong style={{ color: 'var(--text-secondary)' }}>PROHIBITED</strong>.</li>
                <li>Unintended extra people in generation is locked to <strong style={{ color: 'var(--text-secondary)' }}>PROHIBITED</strong>.</li>
                <li>Character and Wardrobe consistency drift is locked to <strong style={{ color: 'var(--text-secondary)' }}>PROHIBITED</strong>.</li>
              </ul>
            </div>

            {editingPreset && !editingPreset.isNew && editingPreset.source === 'user' && (
              <ReferenceAssetManager
                ownerType="visual_identity"
                ownerId={editingPreset.id}
                allowedRoles={['wardrobe', 'visual_style', 'palette_sheet', 'character_sheet']}
              />
            )}

            <div style={{ display: 'flex', gap: 12, borderTop: '1px solid var(--border-color)', paddingTop: 20 }}>
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary"
                style={{ padding: '12px 24px' }}
              >
                {saving ? 'Saving...' : 'Save Visual Identity'}
              </button>
              <button
                type="button"
                onClick={() => setEditingPreset(null)}
                className="btn btn-secondary"
                style={{ padding: '12px 24px' }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
        {showAiBuilder && (
          <AiVisualIdentityBuilderModal
            onClose={() => setShowAiBuilder(false)}
            onContinueEditing={(draftData) => {
              setLabel(draftData.label);
              setDescription(draftData.description || '');
              setPresetKey(draftData.suggested_preset_key || '');
              setConfig({
                ...DEFAULT_CONFIG,
                ...draftData.config
              });
              setEditingPreset({ isNew: true, origin: 'ai' });
              setShowAiBuilder(false);
            }}
          />
        )}
        </div>
      </main>
    </div>
  );
}
