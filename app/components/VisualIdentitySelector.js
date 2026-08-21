import { useState, useEffect } from 'react';

const SUBJECT_KINDS = ['human', 'blank_face_3d', 'animal', 'mascot_object'];
const HUMAN_FACELESS_MODES = ['hands_only', 'crop_below_neck', 'back_view', 'silhouette', 'first_person_pov', 'blank_face_3d'];
const ALL_FACELESS_MODES = [...HUMAN_FACELESS_MODES, 'not_applicable'];
const WARDROBE_MODES = ['fixed', 'sequential', 'stable_random', 'custom'];
const SLEEVE_POLICIES = ['wrists_covered', 'forearms_exposed', 'not_applicable'];
const CAMERA_FRAMINGS = ['hands_closeup', 'forearms_and_hands', 'crop_below_neck', 'back_view', 'full_body_blank_face', 'object_or_animal'];

export default function VisualIdentitySelector({ value, onChange, allowLegacyCustom = true, campaignKind = 're_campaign' }) {
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customizingMode, setCustomizingMode] = useState('preset'); // 'preset' | 'inline' | 'legacy'

  useEffect(() => {
    fetchPresets();
  }, []);

  const fetchPresets = async () => {
    try {
      const res = await fetch('/api/v2/visual-identities?status=active');
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to fetch presets');
      setPresets(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const activePreset = presets.find(p => p.id === value.preset_id);

  const handleModeChange = (mode) => {
    setCustomizingMode(mode);
    if (mode === 'preset') {
      onChange({
        preset_id: presets[0]?.id || 'hands_only_muslimah_sage_kitchen',
        inline_config: null,
        visual_overrides_json: null
      });
    } else if (mode === 'inline') {
      const baseConfig = activePreset?.config || {};
      onChange({
        preset_id: 'inline',
        inline_config: {
          subject: { kind: 'human', faceless_mode: 'hands_only', demographic_key: 'syari_classic', custom_description: '', character_count: 1, ...baseConfig.subject },
          wardrobe: { mode: 'fixed', preset_key: 'sage_muted', custom_description: '', sleeve_policy: 'wrists_covered', ...baseConfig.wardrobe },
          environment: { preset_key: 'nordic_kitchen', custom_description: '', ...baseConfig.environment },
          lighting: { preset_key: 'window_daylight', custom_description: '', ...baseConfig.lighting },
          camera: { framing: 'forearms_and_hands', perspective: 'third_person', ...baseConfig.camera },
          style: { preset_key: 'cinematic_realistic', custom_description: '', aspect_ratio: '9:16', ...baseConfig.style },
          guardrails: { face_visibility: 'prohibited', reflection_face: 'prohibited', extra_people: 'prohibited', identity_drift: 'prohibited', wardrobe_drift: 'prohibited', required_negative_prompts: [] }
        },
        visual_overrides_json: null
      });
    } else if (mode === 'legacy') {
      onChange({
        preset_id: 'custom',
        inline_config: null,
        visual_overrides_json: {
          character_concept: 'faceless',
          subject_demographic: 'syari_classic',
          wardrobe_style: 'sage_muted',
          wardrobe_style_custom: '',
          lighting_style: 'window_daylight',
          lighting_style_custom: '',
          visual_style_preset: 'cinematic_realistic'
        }
      });
    }
  };

  const updateInlineField = (section, field, val) => {
    onChange({
      ...value,
      inline_config: {
        ...value.inline_config,
        [section]: {
          ...value.inline_config[section],
          [field]: val
        }
      }
    });
  };

  const updateLegacyField = (field, val) => {
    onChange({
      ...value,
      visual_overrides_json: {
        ...value.visual_overrides_json,
        [field]: val
      }
    });
  };

  if (loading) {
    return <div className="text-slate-500 text-xs animate-pulse">Loading Visual Catalog...</div>;
  }

  return (
    <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl space-y-4">
      {/* Header and Compliance Badge */}
      <div className="flex justify-between items-center border-b border-slate-850 pb-3 mb-2">
        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Visual Identity Settings</span>
        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-sm shadow-emerald-500/5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
          Faceless Compliant
        </span>
      </div>

      {/* Mode Switches */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleModeChange('preset')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition border ${
            customizingMode === 'preset'
              ? 'bg-slate-800 text-teal-400 border-slate-700'
              : 'bg-slate-950 text-slate-400 border-slate-900 hover:text-slate-200'
          }`}
        >
          Preset Mode
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('inline')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition border ${
            customizingMode === 'inline'
              ? 'bg-slate-800 text-teal-400 border-slate-700'
              : 'bg-slate-950 text-slate-400 border-slate-900 hover:text-slate-200'
          }`}
        >
          Inline Custom
        </button>
        {allowLegacyCustom && (
          <button
            type="button"
            onClick={() => handleModeChange('legacy')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition border ${
              customizingMode === 'legacy'
                ? 'bg-slate-800 text-teal-400 border-slate-700'
                : 'bg-slate-950 text-slate-400 border-slate-900 hover:text-slate-200'
            }`}
          >
            Legacy Custom
          </button>
        )}
      </div>

      {/* Preset Selection Selector */}
      {customizingMode === 'preset' && (
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select Preset</label>
            <select
              value={value.preset_id || ''}
              onChange={(e) => onChange({ ...value, preset_id: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 p-3 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-teal-500"
            >
              {presets.map(p => (
                <option key={p.id} value={p.id}>{p.label} ({p.source})</option>
              ))}
            </select>
          </div>
          {activePreset && (
            <div className="bg-slate-950/60 p-3.5 border border-slate-850 rounded-xl text-xs text-slate-400 space-y-1">
              <div><span className="text-slate-600 font-bold mr-1">Subject Kind:</span> <span className="capitalize">{activePreset.config?.subject?.kind}</span></div>
              <div><span className="text-slate-600 font-bold mr-1">Faceless Mode:</span> <span className="capitalize">{(activePreset.config?.subject?.faceless_mode || '').replace('_', ' ')}</span></div>
              <div><span className="text-slate-600 font-bold mr-1">Wardrobe:</span> <span className="capitalize">{(activePreset.config?.wardrobe?.preset_key || '').replace('_', ' ')}</span></div>
            </div>
          )}
        </div>
      )}

      {/* Inline Customization Section */}
      {customizingMode === 'inline' && value.inline_config && (
        <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
          {/* Subject */}
          <div className="space-y-2 border-b border-slate-850 pb-3">
            <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest block">Subject Properties</span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] text-slate-500 uppercase mb-0.5">Kind</label>
                <select
                  value={value.inline_config.subject.kind}
                  onChange={(e) => updateInlineField('subject', 'kind', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 p-2 rounded-lg text-xs focus:outline-none"
                >
                  {SUBJECT_KINDS.map(k => (
                    <option key={k} value={k}>{k.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[9px] text-slate-500 uppercase mb-0.5">Faceless Mode</label>
                <select
                  value={value.inline_config.subject.faceless_mode}
                  onChange={(e) => updateInlineField('subject', 'faceless_mode', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 p-2 rounded-lg text-xs focus:outline-none"
                >
                  {ALL_FACELESS_MODES.map(fm => (
                    <option key={fm} value={fm}>{fm.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[9px] text-slate-500 uppercase mb-0.5">Demographic Key</label>
                <input
                  type="text"
                  value={value.inline_config.subject.demographic_key}
                  onChange={(e) => updateInlineField('subject', 'demographic_key', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 p-2 rounded-lg text-xs focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Wardrobe */}
          <div className="space-y-2 border-b border-slate-850 pb-3">
            <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest block">Wardrobe Details</span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] text-slate-500 uppercase mb-0.5">Mode</label>
                <select
                  value={value.inline_config.wardrobe.mode}
                  onChange={(e) => updateInlineField('wardrobe', 'mode', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 p-2 rounded-lg text-xs focus:outline-none"
                >
                  {WARDROBE_MODES.map(wm => (
                    <option key={wm} value={wm}>{wm.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[9px] text-slate-500 uppercase mb-0.5">Preset Key</label>
                <input
                  type="text"
                  value={value.inline_config.wardrobe.preset_key}
                  onChange={(e) => updateInlineField('wardrobe', 'preset_key', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 p-2 rounded-lg text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] text-slate-500 uppercase mb-0.5">Sleeve Policy</label>
                <select
                  value={value.inline_config.wardrobe.sleeve_policy}
                  onChange={(e) => updateInlineField('wardrobe', 'sleeve_policy', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 p-2 rounded-lg text-xs focus:outline-none"
                >
                  {SLEEVE_POLICIES.map(sp => (
                    <option key={sp} value={sp}>{sp.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[9px] text-slate-500 uppercase mb-0.5">Primary Color (Hex)</label>
                <input
                  type="text"
                  value={value.inline_config.wardrobe.primary_color}
                  onChange={(e) => updateInlineField('wardrobe', 'primary_color', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 p-2 rounded-lg text-xs focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Environment */}
          <div className="space-y-2 border-b border-slate-850 pb-3">
            <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest block">Environment & Lighting</span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] text-slate-500 uppercase mb-0.5">Environment Key</label>
                <input
                  type="text"
                  value={value.inline_config.environment.preset_key}
                  onChange={(e) => updateInlineField('environment', 'preset_key', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 p-2 rounded-lg text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] text-slate-500 uppercase mb-0.5">Lighting Key</label>
                <input
                  type="text"
                  value={value.inline_config.lighting.preset_key}
                  onChange={(e) => updateInlineField('lighting', 'preset_key', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 p-2 rounded-lg text-xs focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Camera framing */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest block">Camera Settings</span>
            <div>
              <label className="block text-[9px] text-slate-500 uppercase mb-0.5">Framing</label>
              <select
                value={value.inline_config.camera.framing}
                onChange={(e) => updateInlineField('camera', 'framing', e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 p-2 rounded-lg text-xs focus:outline-none"
              >
                {CAMERA_FRAMINGS.map(f => (
                  <option key={f} value={f}>{f.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Legacy Custom Selection dropdowns */}
      {customizingMode === 'legacy' && value.visual_overrides_json && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Legacy Demographic</label>
            <select
              value={value.visual_overrides_json.subject_demographic}
              onChange={(e) => updateLegacyField('subject_demographic', e.target.value)}
              className="w-full bg-slate-950 border border-slate-850 p-2.5 rounded-xl text-xs text-slate-200 focus:outline-none capitalize"
            >
              <option value="syari_classic">Southeast Asian Muslimah (Syar'i)</option>
              <option value="caucasian_male">Caucasian Male</option>
              <option value="stylized_3d_muslimah">3D Muslimah (Blank Head)</option>
              <option value="stylized_3d_male">3D Male (Blank Head)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Wardrobe Mode / Key</label>
            <select
              value={value.visual_overrides_json.wardrobe_style}
              onChange={(e) => updateLegacyField('wardrobe_style', e.target.value)}
              className="w-full bg-slate-950 border border-slate-850 p-2.5 rounded-xl text-xs text-slate-200 focus:outline-none"
            >
              <option value="sequential">Sequential Rotation</option>
              <option value="random">Stable Random</option>
              <option value="sage_muted">Sage Green (Fixed)</option>
              <option value="mocca_caramel">Mocca Caramel (Fixed)</option>
              <option value="custom">Custom Color / Wardrobe</option>
            </select>
          </div>
          {value.visual_overrides_json.wardrobe_style === 'custom' && (
            <div className="md:col-span-2">
              <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Custom Wardrobe Prompt</label>
              <input
                type="text"
                placeholder="e.g. wearing a lavender soft textured sleeve, showing clean hands"
                value={value.visual_overrides_json.wardrobe_style_custom || ''}
                onChange={(e) => updateLegacyField('wardrobe_style_custom', e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 p-2.5 rounded-xl text-xs text-slate-200 focus:outline-none"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
