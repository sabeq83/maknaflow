'use client';

import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import AiVisualIdentityBuilderModal from '../../components/AiVisualIdentityBuilderModal';
import ReferenceAssetManager from '../../components/ReferenceAssetManager';
import {
  SUBJECT_KINDS,
  HUMAN_FACELESS_MODES,
  ALL_FACELESS_MODES,
  POPULATION_MODES,
  CAMERA_FRAMINGS,
  CAMERA_PERSPECTIVES,
  CAMERA_LENS_LOOKS,
  CAMERA_DEPTHS,
  CAMERA_MOVEMENTS,
  WARDROBE_MODES,
  SLEEVE_POLICIES,
  BACKGROUND_DENSITIES,
  LIGHTING_TEMPERATURES,
  LIGHTING_CONTRASTS,
  RENDERING_GEOMETRIES,
  RENDERING_FINISHES,
  SHADOW_STYLES,
  NEGATIVE_SPACE_OPTIONS,
  SAFE_ZONE_OPTIONS
} from '../../../lib/visual-identity-contract';
import {
  VISUAL_STYLE_KEYS,
  VISUAL_LANGUAGE_CATALOG,
  NARRATIVE_FUNCTIONS,
  getVisualStyleDefinition
} from '../../../lib/visual-language-catalog';

const DEFAULT_CONFIG = {
  schema_version: '2',
  subject: {
    kind: 'human',
    faceless_mode: 'featureless_editorial',
    demographic_key: 'custom',
    custom_description: '',
    character_count: 1,
    population_mode: 'single_group_or_crowd'
  },
  visual_language: {
    primary_style: 'editorial_graphic_novel',
    supporting_styles: ['isometric_society', 'symbolic_surrealism', 'paper_cutout_documentary'],
    disabled_styles: ['shadow_silhouette', 'clay_political_theater']
  },
  mode_routing: {
    hook: 'symbolic_surrealism',
    context: 'editorial_graphic_novel',
    mechanism: 'isometric_society',
    consequence: 'editorial_graphic_novel',
    evidence_reveal: 'paper_cutout_documentary',
    conclusion: 'symbolic_surrealism'
  },
  rendering: {
    geometry: 'simplified_semi_realistic',
    textures: ['printed_paper_grain', 'editorial_ink'],
    shadow_style: 'strong_geometric',
    finish: 'matte_editorial'
  },
  composition: {
    primary_idea_count: 1,
    primary_subject_count: 1,
    negative_space: 'required',
    safe_zone: 'vertical_social_ui'
  },
  metaphor_engine: {
    enabled: true,
    pattern: 'concept_to_object_to_action'
  },
  wardrobe: {
    mode: 'fixed',
    preset_key: 'sage_muted',
    custom_description: '',
    primary_color: '',
    secondary_color: '',
    material: '',
    sleeve_policy: 'wrists_covered',
    accessories: []
  },
  environment: {
    preset_key: 'general_workspace',
    custom_description: '',
    material_palette: [],
    props: [],
    background_density: 'balanced'
  },
  lighting: {
    preset_key: 'window_daylight',
    custom_description: '',
    color_temperature: 'warm_neutral',
    contrast: 'soft'
  },
  camera: {
    framing: 'editorial_wide',
    perspective: 'third_person',
    lens_look: 'natural_50mm',
    depth_of_field: 'shallow',
    movement: 'subtle_handheld'
  },
  style: {
    preset_key: 'editorial_graphic_novel',
    custom_description: '',
    aspect_ratio: '9:16'
  },
  guardrails: {
    face_visibility: 'prohibited',
    reflection_face: 'prohibited',
    unintended_people: 'prohibited',
    extra_people: 'prohibited',
    intentional_crowd: 'allowed_faceless',
    identity_drift: 'prohibited',
    wardrobe_drift: 'prohibited',
    required_negative_prompts: []
  }
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
      ...preset.config,
      visual_language: {
        ...DEFAULT_CONFIG.visual_language,
        ...(preset.config?.visual_language || {})
      },
      mode_routing: {
        ...DEFAULT_CONFIG.mode_routing,
        ...(preset.config?.mode_routing || {})
      },
      rendering: {
        ...DEFAULT_CONFIG.rendering,
        ...(preset.config?.rendering || {})
      },
      composition: {
        ...DEFAULT_CONFIG.composition,
        ...(preset.config?.composition || {})
      },
      metaphor_engine: {
        ...DEFAULT_CONFIG.metaphor_engine,
        ...(preset.config?.metaphor_engine || {})
      }
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

  const handlePrimaryStyleChange = (newPrimary) => {
    setConfig(prev => {
      const oldPrimary = prev.visual_language?.primary_style;
      let supporting = [...(prev.visual_language?.supporting_styles || [])];
      if (oldPrimary && oldPrimary !== newPrimary && !supporting.includes(oldPrimary)) {
        supporting.push(oldPrimary);
      }
      supporting = supporting.filter(s => s !== newPrimary);

      const allowed = [newPrimary, ...supporting];
      const nextRouting = { ...(prev.mode_routing || {}) };
      for (const fn of NARRATIVE_FUNCTIONS) {
        if (!allowed.includes(nextRouting[fn])) {
          nextRouting[fn] = newPrimary;
        }
      }

      return {
        ...prev,
        visual_language: {
          ...prev.visual_language,
          primary_style: newPrimary,
          supporting_styles: supporting
        },
        mode_routing: nextRouting,
        style: {
          ...prev.style,
          preset_key: newPrimary
        }
      };
    });
  };

  const toggleSupportingStyle = (styleKey) => {
    setConfig(prev => {
      const primary = prev.visual_language?.primary_style;
      if (styleKey === primary) return prev; // cannot toggle primary

      let supporting = [...(prev.visual_language?.supporting_styles || [])];
      if (supporting.includes(styleKey)) {
        supporting = supporting.filter(s => s !== styleKey);
      } else {
        supporting.push(styleKey);
      }

      const allowed = [primary, ...supporting];
      const nextRouting = { ...(prev.mode_routing || {}) };
      for (const fn of NARRATIVE_FUNCTIONS) {
        if (!allowed.includes(nextRouting[fn])) {
          nextRouting[fn] = primary;
        }
      }

      return {
        ...prev,
        visual_language: {
          ...prev.visual_language,
          supporting_styles: supporting
        },
        mode_routing: nextRouting
      };
    });
  };

  const handleRouteSelectionChange = (narrativeFn, styleKey) => {
    setConfig(prev => ({
      ...prev,
      mode_routing: {
        ...(prev.mode_routing || {}),
        [narrativeFn]: styleKey
      }
    }));
  };

  const activeStylesForRouting = [
    config.visual_language?.primary_style || 'editorial_graphic_novel',
    ...(config.visual_language?.supporting_styles || [])
  ];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-container">
          {/* Header */}
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 14 }}>
            <div>
              <h1 style={{ color: 'var(--text-primary)' }}>🎭 Visual Identity Studio v2</h1>
              <p className="page-subtitle">Sistem identitas visual multi-mode deterministik, narrative routing, dan faceless production rules.</p>
            </div>
            {!editingPreset && !previewPreset && (
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowAiBuilder(true)}
                  style={{ background: 'var(--surface-interactive)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                >
                  ✨ AI Studio Builder
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleOpenCreate}
                  style={{ background: 'var(--action-primary)', color: 'var(--on-action-primary)' }}
                >
                  + Create Manually
                </button>
              </div>
            )}
          </div>

          {/* Tab Navigation */}
          <div style={{ display: 'inline-flex', gap: 6, padding: 6, background: 'var(--sidebar)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius, 8px)', marginBottom: 24 }}>
            {['system', 'user', 'archived'].map(tab => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setEditingPreset(null); setPreviewPreset(null); }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '9px 18px',
                  fontFamily: 'inherit',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: activeTab === tab ? 'var(--action-primary)' : 'var(--text-muted)',
                  backgroundColor: activeTab === tab ? 'var(--surface-interactive)' : 'transparent',
                  borderRadius: 'var(--radius-sm, 6px)',
                  cursor: 'pointer'
                }}
              >
                {tab === 'system' ? 'System Presets' : tab === 'user' ? 'My Presets' : 'Archived'}
              </button>
            ))}
          </div>

          {/* Error Banner */}
          {error && (
            <div style={{ background: 'var(--status-danger-soft)', border: '1px solid var(--status-danger)', color: 'var(--status-danger)', padding: 14, borderRadius: 'var(--radius, 8px)', marginBottom: 20, fontSize: '0.85rem' }}>
              ⚠️ <strong>Error:</strong> {error}
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: 'var(--text-muted)', fontWeight: 600 }}>
              Loading Visual Catalog...
            </div>
          ) : !editingPreset && !previewPreset ? (
            /* Catalog Grid */
            presets.length === 0 ? (
              <div style={{ background: 'var(--surface-raised)', border: '1px dashed var(--border-subtle)', padding: 48, textAlign: 'center', borderRadius: 'var(--radius-md, 12px)', color: 'var(--text-muted)' }}>
                Belum ada preset dalam kategori ini.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 20 }}>
                {presets.map(preset => {
                  const vl = preset.config?.visual_language || {};
                  const primaryDef = getVisualStyleDefinition(vl.primary_style || preset.config?.style?.preset_key);
                  const supportingList = Array.isArray(vl.supporting_styles) ? vl.supporting_styles : [];
                  const isMultiMode = supportingList.length > 0;

                  return (
                    <div
                      key={preset.id}
                      className="card"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        padding: 22,
                        background: 'var(--surface)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md, 12px)',
                        boxShadow: 'var(--shadow-card, 0 4px 12px rgba(0,0,0,0.05))'
                      }}
                    >
                      <div>
                        {/* Header Badges */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span
                              style={{
                                padding: '3px 8px',
                                borderRadius: 12,
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                background: preset.source === 'system' ? 'var(--status-info-soft)' : 'var(--status-success-soft)',
                                color: preset.source === 'system' ? 'var(--status-info)' : 'var(--status-success)'
                              }}
                            >
                              {preset.source}
                            </span>
                            {isMultiMode && (
                              <span
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: 12,
                                  fontSize: '0.7rem',
                                  fontWeight: 800,
                                  background: 'var(--surface-interactive)',
                                  color: 'var(--action-primary)'
                                }}
                              >
                                Multi-mode ({1 + supportingList.length})
                              </span>
                            )}
                          </div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                            v{preset.version}
                          </span>
                        </div>

                        <h3 style={{ fontSize: '1.1rem', fontWeight: 750, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                          {preset.label}
                        </h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.45', margin: '0 0 16px', minHeight: 36 }}>
                          {preset.description || 'Tidak ada deskripsi.'}
                        </p>

                        {/* Visual Styles Preview */}
                        <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', padding: 12, borderRadius: 'var(--radius-sm, 8px)', marginBottom: 16 }}>
                          <div style={{ marginBottom: 6 }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Primary Style:
                            </span>
                            <strong style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                              {primaryDef.label}
                            </strong>
                          </div>

                          {supportingList.length > 0 && (
                            <div>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>
                                Supporting Modes:
                              </span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {supportingList.map(sKey => (
                                  <span
                                    key={sKey}
                                    style={{
                                      fontSize: '0.7rem',
                                      padding: '2px 6px',
                                      borderRadius: 'var(--radius-xs, 4px)',
                                      background: 'var(--surface-interactive)',
                                      color: 'var(--text-secondary)'
                                    }}
                                  >
                                    {VISUAL_LANGUAGE_CATALOG[sKey]?.label || sKey}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
                        <button
                          onClick={() => handlePreview(preset)}
                          className="btn btn-sm"
                          style={{ flex: 1, fontSize: '0.75rem', background: 'var(--surface-interactive)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm, 6px)', padding: '6px 8px' }}
                        >
                          Preview Prompt
                        </button>
                        <button
                          onClick={() => handleClone(preset)}
                          className="btn btn-sm"
                          style={{ flex: 1, fontSize: '0.75rem', background: 'var(--surface-interactive)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm, 6px)', padding: '6px 8px' }}
                        >
                          Clone
                        </button>
                        {preset.source === 'user' && activeTab === 'user' && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(preset)}
                              className="btn btn-sm"
                              style={{ flex: 1, fontSize: '0.75rem', background: 'var(--action-primary)', color: 'var(--on-action-primary)', border: 0, borderRadius: 'var(--radius-sm, 6px)', padding: '6px 8px' }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleArchive(preset)}
                              className="btn btn-sm"
                              style={{ flex: 1, fontSize: '0.75rem', background: 'var(--status-danger-soft)', color: 'var(--status-danger)', border: '1px solid var(--status-danger)', borderRadius: 'var(--radius-sm, 6px)', padding: '6px 8px' }}
                            >
                              Archive
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : previewPreset ? (
            /* Resolved Prompt Preview Pane */
            <div className="card" style={{ padding: 28, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md, 12px)', position: 'relative' }}>
              <button
                onClick={() => setPreviewPreset(null)}
                className="btn btn-sm"
                style={{ position: 'absolute', top: 20, right: 20, padding: '6px 12px', background: 'var(--surface-interactive)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm, 6px)' }}
              >
                ✕ Tutup
              </button>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--action-primary)', margin: '0 0 20px' }}>
                Prompt Preview: {previewPreset.label}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {Object.entries(previewPreset.resolved).map(([key, value]) => (
                  <div key={key} style={{ background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', padding: 14, borderRadius: 'var(--radius-sm, 8px)' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--action-primary)', display: 'block', marginBottom: 4 }}>
                      {key.replace(/_/g, ' ')}
                    </span>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0, whiteSpace: 'pre-wrap' }}>
                      {value || 'N/A'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Create & Edit Studio Form */
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20, background: 'var(--surface)', padding: 28, borderRadius: 'var(--radius-md, 12px)', border: '1px solid var(--border-strong)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 16 }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 850, color: 'var(--action-primary)', margin: 0 }}>
                  {editingPreset.isNew ? 'Create New Preset' : `Editing Preset: ${editingPreset.label}`}
                </h2>
                <button
                  type="button"
                  onClick={() => setEditingPreset(null)}
                  className="btn btn-sm"
                  style={{ padding: '6px 12px', background: 'var(--surface-interactive)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm, 6px)', color: 'var(--text-secondary)' }}
                >
                  ✕ Batal
                </button>
              </div>

              {/* 1. Basic Info */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <label style={{ display: 'grid', gap: 6, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Identity Name*
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Wa’y Siyasi — Editorial System"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    style={{ padding: '9px 11px', borderRadius: 'var(--radius-sm, 6px)', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '13px' }}
                  />
                </label>
                {editingPreset.isNew && (
                  <label style={{ display: 'grid', gap: 6, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Preset Key (Slug)
                    <input
                      type="text"
                      placeholder="e.g. way_siyasi_editorial_system"
                      value={presetKey}
                      onChange={(e) => setPresetKey(e.target.value)}
                      style={{ padding: '9px 11px', borderRadius: 'var(--radius-sm, 6px)', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '13px' }}
                    />
                  </label>
                )}
                <label style={{ display: 'grid', gap: 6, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Description
                  <input
                    type="text"
                    placeholder="Jelaskan karakteristik visual preset ini"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{ padding: '9px 11px', borderRadius: 'var(--radius-sm, 6px)', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '13px' }}
                  />
                </label>
              </div>

              {/* 2. Visual Language Selection (Primary & Supporting) */}
              <div style={{ background: 'var(--surface-raised)', padding: 18, borderRadius: 'var(--radius-sm, 8px)', border: '1px solid var(--border-subtle)', display: 'grid', gap: 14 }}>
                <h3 style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--action-primary)', margin: 0 }}>
                  2. Visual Language Modes (Primary & Supporting)
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                  <label style={{ display: 'grid', gap: 6, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Primary Visual Style
                    <select
                      value={config.visual_language?.primary_style || 'editorial_graphic_novel'}
                      onChange={(e) => handlePrimaryStyleChange(e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm, 6px)', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '13px' }}
                    >
                      {VISUAL_STYLE_KEYS.map(key => (
                        <option key={key} value={key}>{VISUAL_LANGUAGE_CATALOG[key]?.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                    Supporting Styles (Pilih gaya pendukung yang aktif):
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {VISUAL_STYLE_KEYS.map(key => {
                      const isPrimary = config.visual_language?.primary_style === key;
                      const isSupporting = (config.visual_language?.supporting_styles || []).includes(key);

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleSupportingStyle(key)}
                          disabled={isPrimary}
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: (isPrimary || isSupporting) ? 700 : 500,
                            borderRadius: 20,
                            border: isPrimary ? '1px solid var(--action-primary)' : isSupporting ? '1px solid var(--status-info)' : '1px solid var(--border-subtle)',
                            background: isPrimary ? 'var(--action-primary)' : isSupporting ? 'var(--status-info-soft)' : 'var(--surface-interactive)',
                            color: isPrimary ? 'var(--on-action-primary)' : isSupporting ? 'var(--status-info)' : 'var(--text-muted)',
                            cursor: isPrimary ? 'default' : 'pointer'
                          }}
                        >
                          {VISUAL_LANGUAGE_CATALOG[key]?.label} {isPrimary ? '(Primary)' : isSupporting ? '✓' : '+'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 3. Narrative Mode Routing */}
              <div style={{ background: 'var(--surface-raised)', padding: 18, borderRadius: 'var(--radius-sm, 8px)', border: '1px solid var(--border-subtle)', display: 'grid', gap: 12 }}>
                <h3 style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--action-primary)', margin: 0 }}>
                  3. Narrative Mode Routing
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                  {NARRATIVE_FUNCTIONS.map(fn => {
                    const currentTarget = config.mode_routing?.[fn] || config.visual_language?.primary_style;

                    return (
                      <label key={fn} style={{ display: 'grid', gap: 4, fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        <span style={{ textTransform: 'capitalize' }}>{fn.replace(/_/g, ' ')} Mode</span>
                        <select
                          value={currentTarget}
                          onChange={(e) => handleRouteSelectionChange(fn, e.target.value)}
                          style={{ padding: '7px 9px', borderRadius: 'var(--radius-sm, 6px)', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '12px' }}
                        >
                          {activeStylesForRouting.map(sKey => (
                            <option key={sKey} value={sKey}>
                              {VISUAL_LANGUAGE_CATALOG[sKey]?.label} {sKey === config.visual_language?.primary_style ? '(Primary)' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 4. Subject & Population Properties */}
              <div style={{ background: 'var(--surface-raised)', padding: 18, borderRadius: 'var(--radius-sm, 8px)', border: '1px solid var(--border-subtle)', display: 'grid', gap: 14 }}>
                <h3 style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--action-primary)', margin: 0 }}>
                  4. Subject & Population Properties
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                  <label style={{ display: 'grid', gap: 6, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Subject Kind
                    <select
                      value={config.subject?.kind || 'human'}
                      onChange={(e) => updateConfigField('subject', 'kind', e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm, 6px)', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '13px' }}
                    >
                      {SUBJECT_KINDS.map(kind => (
                        <option key={kind} value={kind}>{kind.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: 6, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Faceless Mode
                    <select
                      value={config.subject?.faceless_mode || 'featureless_editorial'}
                      onChange={(e) => updateConfigField('subject', 'faceless_mode', e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm, 6px)', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '13px' }}
                    >
                      {ALL_FACELESS_MODES.map(mode => (
                        <option key={mode} value={mode}>{mode.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: 6, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Population Mode
                    <select
                      value={config.subject?.population_mode || 'single_group_or_crowd'}
                      onChange={(e) => updateConfigField('subject', 'population_mode', e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm, 6px)', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '13px' }}
                    >
                      {POPULATION_MODES.map(pop => (
                        <option key={pop} value={pop}>{pop.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label style={{ display: 'grid', gap: 6, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Custom Subject Description
                  <input
                    type="text"
                    placeholder="e.g. Contemporary Southeast Asian citizens, diverse ages, everyday modest civilian attire"
                    value={config.subject?.custom_description || ''}
                    onChange={(e) => updateConfigField('subject', 'custom_description', e.target.value)}
                    style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm, 6px)', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '13px' }}
                  />
                </label>
              </div>

              {/* 5. Rendering & Composition */}
              <div style={{ background: 'var(--surface-raised)', padding: 18, borderRadius: 'var(--radius-sm, 8px)', border: '1px solid var(--border-subtle)', display: 'grid', gap: 14 }}>
                <h3 style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--action-primary)', margin: 0 }}>
                  5. Rendering & Composition System
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                  <label style={{ display: 'grid', gap: 6, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Geometry
                    <select
                      value={config.rendering?.geometry || 'simplified_semi_realistic'}
                      onChange={(e) => updateConfigField('rendering', 'geometry', e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm, 6px)', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '13px' }}
                    >
                      {RENDERING_GEOMETRIES.map(g => (
                        <option key={g} value={g}>{g.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: 6, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Shadow Style
                    <select
                      value={config.rendering?.shadow_style || 'strong_geometric'}
                      onChange={(e) => updateConfigField('rendering', 'shadow_style', e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm, 6px)', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '13px' }}
                    >
                      {SHADOW_STYLES.map(s => (
                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: 6, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Finish
                    <select
                      value={config.rendering?.finish || 'matte_editorial'}
                      onChange={(e) => updateConfigField('rendering', 'finish', e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm, 6px)', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '13px' }}
                    >
                      {RENDERING_FINISHES.map(f => (
                        <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: 6, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Negative Space
                    <select
                      value={config.composition?.negative_space || 'required'}
                      onChange={(e) => updateConfigField('composition', 'negative_space', e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm, 6px)', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '13px' }}
                    >
                      {NEGATIVE_SPACE_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: 6, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Safe Zone
                    <select
                      value={config.composition?.safe_zone || 'vertical_social_ui'}
                      onChange={(e) => updateConfigField('composition', 'safe_zone', e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm, 6px)', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '13px' }}
                    >
                      {SAFE_ZONE_OPTIONS.map(sz => (
                        <option key={sz} value={sz}>{sz.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              {/* 6. Advanced Settings (Camera, Lighting, Wardrobe, Environment) */}
              <details style={{ background: 'var(--surface-raised)', padding: 18, borderRadius: 'var(--radius-sm, 8px)', border: '1px solid var(--border-subtle)' }}>
                <summary style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  ⚙️ Advanced Settings (Camera, Lighting, Wardrobe, Environment)
                </summary>
                <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
                  {/* Camera */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    <label style={{ display: 'grid', gap: 4, fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Camera Framing
                      <select
                        value={config.camera?.framing || 'editorial_wide'}
                        onChange={(e) => updateConfigField('camera', 'framing', e.target.value)}
                        style={{ padding: '7px 9px', borderRadius: 'var(--radius-sm, 6px)', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '12px' }}
                      >
                        {CAMERA_FRAMINGS.map(f => (
                          <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: 'grid', gap: 4, fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Perspective
                      <select
                        value={config.camera?.perspective || 'third_person'}
                        onChange={(e) => updateConfigField('camera', 'perspective', e.target.value)}
                        style={{ padding: '7px 9px', borderRadius: 'var(--radius-sm, 6px)', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '12px' }}
                      >
                        {CAMERA_PERSPECTIVES.map(p => (
                          <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: 'grid', gap: 4, fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Lens Look
                      <select
                        value={config.camera?.lens_look || 'natural_50mm'}
                        onChange={(e) => updateConfigField('camera', 'lens_look', e.target.value)}
                        style={{ padding: '7px 9px', borderRadius: 'var(--radius-sm, 6px)', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '12px' }}
                      >
                        {CAMERA_LENS_LOOKS.map(l => (
                          <option key={l} value={l}>{l.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {/* Lighting */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    <label style={{ display: 'grid', gap: 4, fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Color Temperature
                      <select
                        value={config.lighting?.color_temperature || 'warm_neutral'}
                        onChange={(e) => updateConfigField('lighting', 'color_temperature', e.target.value)}
                        style={{ padding: '7px 9px', borderRadius: 'var(--radius-sm, 6px)', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '12px' }}
                      >
                        {LIGHTING_TEMPERATURES.map(t => (
                          <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: 'grid', gap: 4, fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Lighting Contrast
                      <select
                        value={config.lighting?.contrast || 'soft'}
                        onChange={(e) => updateConfigField('lighting', 'contrast', e.target.value)}
                        style={{ padding: '7px 9px', borderRadius: 'var(--radius-sm, 6px)', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '12px' }}
                      >
                        {LIGHTING_CONTRASTS.map(c => (
                          <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </details>

              {/* 7. Locked Guardrails Summary */}
              <div style={{ background: 'var(--status-danger-soft)', border: '1px solid var(--status-danger)', padding: 16, borderRadius: 'var(--radius-sm, 8px)' }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--status-danger)', margin: '0 0 6px' }}>
                  Locked Deterministic Guardrails
                </h3>
                <ul style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 16, margin: 0 }}>
                  <li>Face Visibility is locked to <strong style={{ color: 'var(--text-primary)' }}>PROHIBITED</strong>.</li>
                  <li>Reflections showing human faces is locked to <strong style={{ color: 'var(--text-primary)' }}>PROHIBITED</strong>.</li>
                  <li>Unintended extra people in generation is locked to <strong style={{ color: 'var(--text-primary)' }}>PROHIBITED</strong>.</li>
                  <li>Intentional crowds are <strong style={{ color: 'var(--text-primary)' }}>ALLOWED FACELESS</strong> (strictly featureless / turned away).</li>
                </ul>
              </div>

              {editingPreset && !editingPreset.isNew && editingPreset.source === 'user' && (
                <ReferenceAssetManager
                  ownerType="visual_identity"
                  ownerId={editingPreset.id}
                  allowedRoles={['wardrobe', 'visual_style', 'palette_sheet', 'character_sheet']}
                />
              )}

              {/* Form Action Buttons */}
              <div style={{ display: 'flex', gap: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 18 }}>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn primary"
                  style={{ padding: '10px 24px', fontSize: '13px', fontWeight: 700, background: 'var(--action-primary)', color: 'var(--on-action-primary)', border: 0, borderRadius: 'var(--radius-sm, 6px)', cursor: saving ? 'wait' : 'pointer' }}
                >
                  {saving ? 'Menyimpan...' : 'Simpan Visual Identity'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingPreset(null)}
                  className="btn"
                  style={{ padding: '10px 20px', fontSize: '13px', fontWeight: 600, background: 'var(--surface-interactive)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm, 6px)' }}
                >
                  Batal
                </button>
              </div>
            </form>
          )}

          {showAiBuilder && (
            <AiVisualIdentityBuilderModal
              onClose={() => setShowAiBuilder(false)}
              onContinueEditing={(draftConfig, draftLabel, draftDescription) => {
                setLabel(draftLabel || 'Custom Visual Identity');
                setDescription(draftDescription || '');
                setPresetKey((draftLabel || 'custom_preset').toLowerCase().replace(/[^a-z0-9_-]/g, ''));
                setConfig({
                  ...DEFAULT_CONFIG,
                  ...draftConfig
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
