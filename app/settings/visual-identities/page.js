'use client';

import { useState, useEffect } from 'react';

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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-teal-400 via-emerald-400 to-indigo-400 bg-clip-text text-transparent">
              Visual Identity Studio
            </h1>
            <p className="text-slate-400 mt-2 text-sm max-w-xl">
              Create, edit, and manage reusable visual identity presets to lock faceless parameters, wardrobe colors, and scene styling.
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-teal-500/10 transition duration-300 transform active:scale-95"
          >
            <span className="text-xl">+</span> New Visual Identity
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-2xl w-fit mb-6">
          {['system', 'user', 'archived'].map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setEditingPreset(null); setPreviewPreset(null); }}
              className={`px-6 py-2.5 rounded-xl font-bold transition duration-300 text-sm capitalize ${
                activeTab === tab
                  ? 'bg-slate-850 text-teal-400 border border-slate-800 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {presets.map(preset => (
                <div
                  key={preset.id}
                  className="bg-slate-900 border border-slate-850 hover:border-slate-700 p-6 rounded-2xl shadow-xl flex flex-col justify-between transition duration-300 hover:shadow-teal-950/5 group"
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                        preset.source === 'system' 
                          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/25'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                      }`}>
                        {preset.source}
                      </span>
                      <span className="text-slate-500 text-xs font-semibold">
                        v{preset.version}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-100 group-hover:text-teal-400 transition mb-2">
                      {preset.label}
                    </h3>
                    <p className="text-slate-400 text-xs line-clamp-2 mb-6">
                      {preset.description || 'No description provided.'}
                    </p>

                    {/* Metadata Badges */}
                    <div className="grid grid-cols-2 gap-2.5 text-xs text-slate-400 bg-slate-950/40 p-3.5 rounded-xl border border-slate-900/50 mb-6">
                      <div>
                        <span className="text-slate-600 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Subject</span>
                        <span className="capitalize truncate font-medium text-slate-300">{preset.config?.subject?.kind}</span>
                      </div>
                      <div>
                        <span className="text-slate-600 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Faceless Mode</span>
                        <span className="capitalize truncate font-medium text-slate-300">{(preset.config?.subject?.faceless_mode || '').replace('_', ' ')}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-600 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Environment Preset</span>
                        <span className="capitalize truncate font-medium text-slate-300">{(preset.config?.environment?.preset_key || '').replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 border-t border-slate-850 pt-4 mt-2">
                    <button
                      onClick={() => handlePreview(preset)}
                      className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold py-2 rounded-xl text-xs transition active:scale-95"
                    >
                      Preview Prompt
                    </button>
                    <button
                      onClick={() => handleClone(preset)}
                      className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold py-2 rounded-xl text-xs transition active:scale-95"
                    >
                      Clone
                    </button>
                    {preset.source === 'user' && activeTab === 'user' && (
                      <>
                        <button
                          onClick={() => handleOpenEdit(preset)}
                          className="bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/25 font-bold px-3.5 rounded-xl text-xs transition active:scale-95"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleArchive(preset)}
                          className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 font-bold px-3.5 rounded-xl text-xs transition active:scale-95"
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
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
            <button
              onClick={() => setPreviewPreset(null)}
              className="absolute top-6 right-6 text-slate-500 hover:text-slate-300 text-xl font-bold"
            >
              ✕
            </button>
            <h2 className="text-xl font-bold text-teal-400 mb-6">
              Prompt Preview for: {previewPreset.label}
            </h2>
            <div className="space-y-4">
              {Object.entries(previewPreset.resolved).map(([key, value]) => (
                <div key={key} className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                    {key.replace('_', ' ')}
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed">{value || 'N/A'}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Create & Edit Studio Form */
          <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl space-y-8">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-6">
              <h2 className="text-xl font-extrabold text-teal-400">
                {editingPreset.isNew ? 'Create New Preset' : `Editing Preset: ${editingPreset.label}`}
              </h2>
              <button
                type="button"
                onClick={() => setEditingPreset(null)}
                className="text-slate-500 hover:text-slate-300 text-sm font-bold"
              >
                Cancel & Close
              </button>
            </div>

            {/* Section 1: Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Identity Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Muslimah Sage Kitchen"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-teal-500 p-3 rounded-xl text-slate-100 text-sm focus:outline-none transition"
                />
              </div>
              {editingPreset.isNew && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Custom Preset Key (Slug)</label>
                  <input
                    type="text"
                    placeholder="e.g. muslimah_sage_kitchen"
                    value={presetKey}
                    onChange={(e) => setPresetKey(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-teal-500 p-3 rounded-xl text-slate-100 text-sm focus:outline-none transition"
                  />
                </div>
              )}
              <div className={editingPreset.isNew ? 'md:col-span-1' : 'md:col-span-2'}>
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Description</label>
                <input
                  type="text"
                  placeholder="Describe the aesthetic and purpose of this identity"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-teal-500 p-3 rounded-xl text-slate-100 text-sm focus:outline-none transition"
                />
              </div>
            </div>

            {/* Section 2: Subject */}
            <div className="border border-slate-850 p-6 rounded-2xl space-y-6">
              <h3 className="text-sm font-bold text-teal-400 uppercase tracking-widest border-b border-slate-850 pb-2">Subject Properties</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Subject Kind</label>
                  <select
                    value={config.subject.kind}
                    onChange={(e) => updateConfigField('subject', 'kind', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-teal-500 capitalize"
                  >
                    {SUBJECT_KINDS.map(kind => (
                      <option key={kind} value={kind}>{kind.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Faceless Mode</label>
                  <select
                    value={config.subject.faceless_mode}
                    onChange={(e) => updateConfigField('subject', 'faceless_mode', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-teal-500 capitalize"
                  >
                    {ALL_FACELESS_MODES.map(mode => (
                      <option key={mode} value={mode}>{mode.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Demographic Key</label>
                  <input
                    type="text"
                    value={config.subject.demographic_key}
                    onChange={(e) => updateConfigField('subject', 'demographic_key', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Custom Subject Description (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. delicate Southeast Asian female hands, smooth skin, slender fingers"
                    value={config.subject.custom_description}
                    onChange={(e) => updateConfigField('subject', 'custom_description', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Wardrobe */}
            <div className="border border-slate-850 p-6 rounded-2xl space-y-6">
              <h3 className="text-sm font-bold text-teal-400 uppercase tracking-widest border-b border-slate-850 pb-2">Wardrobe & Colors</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Wardrobe Mode</label>
                  <select
                    value={config.wardrobe.mode}
                    onChange={(e) => updateConfigField('wardrobe', 'mode', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-200 text-sm focus:outline-none capitalize"
                  >
                    {WARDROBE_MODES.map(mode => (
                      <option key={mode} value={mode}>{mode.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Wardrobe Preset Key</label>
                  <input
                    type="text"
                    value={config.wardrobe.preset_key}
                    onChange={(e) => updateConfigField('wardrobe', 'preset_key', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-100 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Sleeve Policy</label>
                  <select
                    value={config.wardrobe.sleeve_policy}
                    onChange={(e) => updateConfigField('wardrobe', 'sleeve_policy', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-200 text-sm focus:outline-none capitalize"
                  >
                    {SLEEVE_POLICIES.map(policy => (
                      <option key={policy} value={policy}>{policy.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Primary Color (Hex or Label)</label>
                  <input
                    type="text"
                    placeholder="e.g. #8A9A7B"
                    value={config.wardrobe.primary_color}
                    onChange={(e) => updateConfigField('wardrobe', 'primary_color', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-100 text-sm focus:outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Custom Wardrobe Description (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. wearing a premium linen flowing modest dress with neat cuff details"
                    value={config.wardrobe.custom_description}
                    onChange={(e) => updateConfigField('wardrobe', 'custom_description', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-100 text-sm focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Environment */}
            <div className="border border-slate-850 p-6 rounded-2xl space-y-6">
              <h3 className="text-sm font-bold text-teal-400 uppercase tracking-widest border-b border-slate-850 pb-2">Environment & Background</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Environment Preset</label>
                  <input
                    type="text"
                    value={config.environment.preset_key}
                    onChange={(e) => updateConfigField('environment', 'preset_key', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-100 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Background Density</label>
                  <select
                    value={config.environment.background_density}
                    onChange={(e) => updateConfigField('environment', 'background_density', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-200 text-sm focus:outline-none capitalize"
                  >
                    {BACKGROUND_DENSITIES.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Custom Environment Description (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. standing in a bright minimalist aesthetic cafe, blurred warm light bulbs background"
                    value={config.environment.custom_description}
                    onChange={(e) => updateConfigField('environment', 'custom_description', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-100 text-sm focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 5: Lighting */}
            <div className="border border-slate-850 p-6 rounded-2xl space-y-6">
              <h3 className="text-sm font-bold text-teal-400 uppercase tracking-widest border-b border-slate-850 pb-2">Lighting Style</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Lighting Preset</label>
                  <input
                    type="text"
                    value={config.lighting.preset_key}
                    onChange={(e) => updateConfigField('lighting', 'preset_key', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-100 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Color Temperature</label>
                  <select
                    value={config.lighting.color_temperature}
                    onChange={(e) => updateConfigField('lighting', 'color_temperature', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-200 text-sm focus:outline-none capitalize"
                  >
                    {LIGHTING_TEMPERATURES.map(t => (
                      <option key={t} value={t}>{t.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Contrast</label>
                  <select
                    value={config.lighting.contrast}
                    onChange={(e) => updateConfigField('lighting', 'contrast', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-200 text-sm focus:outline-none capitalize"
                  >
                    {LIGHTING_CONTRASTS.map(c => (
                      <option key={c} value={c}>{c.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 6: Camera */}
            <div className="border border-slate-850 p-6 rounded-2xl space-y-6">
              <h3 className="text-sm font-bold text-teal-400 uppercase tracking-widest border-b border-slate-850 pb-2">Camera & Framing</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Framing</label>
                  <select
                    value={config.camera.framing}
                    onChange={(e) => updateConfigField('camera', 'framing', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-200 text-sm focus:outline-none capitalize"
                  >
                    {CAMERA_FRAMINGS.map(f => (
                      <option key={f} value={f}>{f.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Perspective</label>
                  <select
                    value={config.camera.perspective}
                    onChange={(e) => updateConfigField('camera', 'perspective', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-200 text-sm focus:outline-none capitalize"
                  >
                    {CAMERA_PERSPECTIVES.map(p => (
                      <option key={p} value={p}>{p.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Lens Look</label>
                  <select
                    value={config.camera.lens_look}
                    onChange={(e) => updateConfigField('camera', 'lens_look', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-200 text-sm focus:outline-none capitalize"
                  >
                    {CAMERA_LENS_LOOKS.map(l => (
                      <option key={l} value={l}>{l.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 7: Style */}
            <div className="border border-slate-850 p-6 rounded-2xl space-y-6">
              <h3 className="text-sm font-bold text-teal-400 uppercase tracking-widest border-b border-slate-850 pb-2">Art Style</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Style Preset</label>
                  <input
                    type="text"
                    value={config.style.preset_key}
                    onChange={(e) => updateConfigField('style', 'preset_key', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-100 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Aspect Ratio</label>
                  <input
                    type="text"
                    value={config.style.aspect_ratio}
                    onChange={(e) => updateConfigField('style', 'aspect_ratio', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-100 text-sm focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Locked Guardrails Summary */}
            <div className="bg-slate-950 p-6 border border-slate-850 rounded-2xl">
              <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-3">Locked Deterministic Guardrails</h3>
              <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
                <li>Face Visibility is locked to <strong className="text-rose-300">PROHIBITED</strong>.</li>
                <li>Reflections showing faces is locked to <strong className="text-rose-300">PROHIBITED</strong>.</li>
                <li>Unintended extra people in generation is locked to <strong className="text-rose-300">PROHIBITED</strong>.</li>
                <li>Character and Wardrobe consistency drift is locked to <strong className="text-rose-300">PROHIBITED</strong>.</li>
              </ul>
            </div>

            <div className="flex gap-4 border-t border-slate-800 pt-6">
              <button
                type="submit"
                disabled={saving}
                className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 px-8 py-3.5 rounded-xl font-bold text-sm shadow-xl transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Visual Identity'}
              </button>
              <button
                type="button"
                onClick={() => setEditingPreset(null)}
                className="bg-slate-800 hover:bg-slate-750 px-8 py-3.5 rounded-xl font-bold text-sm text-slate-300 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
