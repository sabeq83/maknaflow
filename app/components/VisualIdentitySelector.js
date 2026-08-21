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
    return <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '8px 0' }}>Loading Visual Catalog...</div>;
  }

  return (
    <div style={{
      background: 'var(--surface-raised)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius)',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      {/* Header and Compliance Badge */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '12px',
        marginBottom: '4px'
      }}>
        <span style={{
          fontSize: '11px',
          fontWeight: '700',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em'
        }}>Visual Identity Settings</span>
        <span style={{
          background: 'var(--status-success-soft)',
          color: 'var(--status-success)',
          border: '1px solid rgba(74, 222, 128, 0.2)',
          fontSize: '10px',
          fontWeight: '800',
          padding: '3px 10px',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span style={{
            width: '6px',
            height: '6px',
            backgroundColor: 'var(--status-success)',
            borderRadius: '50%',
            display: 'inline-block',
            boxShadow: '0 0 8px var(--status-success)'
          }}></span>
          Faceless Compliant
        </span>
      </div>

      {/* Mode Switches */}
      <div style={{
        display: 'flex',
        background: 'var(--input-bg)',
        border: '1px solid var(--border-subtle)',
        padding: '4px',
        borderRadius: 'var(--radius)',
        gap: '4px'
      }}>
        <button
          type="button"
          onClick={() => handleModeChange('preset')}
          style={{
            flex: 1,
            background: customizingMode === 'preset' ? 'var(--surface-interactive)' : 'transparent',
            border: 'none',
            color: customizingMode === 'preset' ? 'var(--action-primary)' : 'var(--text-muted)',
            padding: '8px 12px',
            fontSize: '12px',
            fontWeight: '600',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            transition: 'var(--transition)'
          }}
        >
          Preset Mode
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('inline')}
          style={{
            flex: 1,
            background: customizingMode === 'inline' ? 'var(--surface-interactive)' : 'transparent',
            border: 'none',
            color: customizingMode === 'inline' ? 'var(--action-primary)' : 'var(--text-muted)',
            padding: '8px 12px',
            fontSize: '12px',
            fontWeight: '600',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            transition: 'var(--transition)'
          }}
        >
          Inline Custom
        </button>
        {allowLegacyCustom && (
          <button
            type="button"
            onClick={() => handleModeChange('legacy')}
            style={{
              flex: 1,
              background: customizingMode === 'legacy' ? 'var(--surface-interactive)' : 'transparent',
              border: 'none',
              color: customizingMode === 'legacy' ? 'var(--action-primary)' : 'var(--text-muted)',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: '600',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              transition: 'var(--transition)'
            }}
          >
            Legacy Custom
          </button>
        )}
      </div>

      {/* Preset Selection Selector */}
      {customizingMode === 'preset' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{
              fontSize: '10px',
              fontWeight: '700',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>Select Preset</label>
            <select
              value={value.preset_id || ''}
              onChange={(e) => onChange({ ...value, preset_id: e.target.value })}
              className="form-select"
            >
              {presets.map(p => (
                <option key={p.id} value={p.id}>{p.label} ({p.source})</option>
              ))}
            </select>
          </div>
          {activePreset && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(28, 42, 64, 0.4) 0%, rgba(16, 24, 39, 0.6) 100%)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius)',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderBottom: '1px solid rgba(38, 53, 74, 0.4)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Subject Kind:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600, textTransform: 'capitalize' }}>{activePreset.config?.subject?.kind}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderBottom: '1px solid rgba(38, 53, 74, 0.4)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Faceless Mode:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600, textTransform: 'capitalize' }}>{(activePreset.config?.subject?.faceless_mode || '').replace('_', ' ')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Wardrobe:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600, textTransform: 'capitalize' }}>{(activePreset.config?.wardrobe?.preset_key || '').replace('_', ' ')}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inline Customization Section */}
      {customizingMode === 'inline' && value.inline_config && (
        <div style={{
          maxHeight: '290px',
          overflowY: 'auto',
          paddingRight: '6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {/* Subject */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span style={{
              fontSize: '10px',
              fontWeight: '800',
              color: 'var(--action-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '4px',
              marginTop: '6px'
            }}>Subject Properties</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kind</label>
                <select
                  value={value.inline_config.subject.kind}
                  onChange={(e) => updateInlineField('subject', 'kind', e.target.value)}
                  className="form-select"
                >
                  {SUBJECT_KINDS.map(k => (
                    <option key={k} value={k}>{k.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Faceless Mode</label>
                <select
                  value={value.inline_config.subject.faceless_mode}
                  onChange={(e) => updateInlineField('subject', 'faceless_mode', e.target.value)}
                  className="form-select"
                >
                  {ALL_FACELESS_MODES.map(fm => (
                    <option key={fm} value={fm}>{fm.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Demographic Key</label>
                <input
                  type="text"
                  value={value.inline_config.subject.demographic_key}
                  onChange={(e) => updateInlineField('subject', 'demographic_key', e.target.value)}
                  className="form-input"
                />
              </div>
            </div>
          </div>

          {/* Wardrobe */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span style={{
              fontSize: '10px',
              fontWeight: '800',
              color: 'var(--action-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '4px',
              marginTop: '6px'
            }}>Wardrobe Details</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mode</label>
                <select
                  value={value.inline_config.wardrobe.mode}
                  onChange={(e) => updateInlineField('wardrobe', 'mode', e.target.value)}
                  className="form-select"
                >
                  {WARDROBE_MODES.map(wm => (
                    <option key={wm} value={wm}>{wm.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preset Key</label>
                <input
                  type="text"
                  value={value.inline_config.wardrobe.preset_key}
                  onChange={(e) => updateInlineField('wardrobe', 'preset_key', e.target.value)}
                  className="form-input"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sleeve Policy</label>
                <select
                  value={value.inline_config.wardrobe.sleeve_policy}
                  onChange={(e) => updateInlineField('wardrobe', 'sleeve_policy', e.target.value)}
                  className="form-select"
                >
                  {SLEEVE_POLICIES.map(sp => (
                    <option key={sp} value={sp}>{sp.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Primary Color (Hex)</label>
                <input
                  type="text"
                  value={value.inline_config.wardrobe.primary_color}
                  onChange={(e) => updateInlineField('wardrobe', 'primary_color', e.target.value)}
                  className="form-input"
                />
              </div>
            </div>
          </div>

          {/* Environment */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span style={{
              fontSize: '10px',
              fontWeight: '800',
              color: 'var(--action-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '4px',
              marginTop: '6px'
            }}>Environment & Lighting</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Environment Key</label>
                <input
                  type="text"
                  value={value.inline_config.environment.preset_key}
                  onChange={(e) => updateInlineField('environment', 'preset_key', e.target.value)}
                  className="form-input"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lighting Key</label>
                <input
                  type="text"
                  value={value.inline_config.lighting.preset_key}
                  onChange={(e) => updateInlineField('lighting', 'preset_key', e.target.value)}
                  className="form-input"
                />
              </div>
            </div>
          </div>

          {/* Camera framing */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span style={{
              fontSize: '10px',
              fontWeight: '800',
              color: 'var(--action-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '4px',
              marginTop: '6px'
            }}>Camera Settings</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Framing</label>
                <select
                  value={value.inline_config.camera.framing}
                  onChange={(e) => updateInlineField('camera', 'framing', e.target.value)}
                  className="form-select"
                >
                  {CAMERA_FRAMINGS.map(f => (
                    <option key={f} value={f}>{f.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Camera Perspective</label>
                <select
                  value={value.inline_config.camera.perspective}
                  onChange={(e) => updateInlineField('camera', 'perspective', e.target.value)}
                  className="form-select"
                >
                  <option value="third_person">third person</option>
                  <option value="first_person_pov">first person pov</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legacy Custom Selection dropdowns */}
      {customizingMode === 'legacy' && value.visual_overrides_json && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Legacy Demographic</label>
            <select
              value={value.visual_overrides_json.subject_demographic}
              onChange={(e) => updateLegacyField('subject_demographic', e.target.value)}
              className="form-select"
              style={{ textTransform: 'capitalize' }}
            >
              <option value="syari_classic">Southeast Asian Muslimah (Syar'i)</option>
              <option value="caucasian_male">Caucasian Male</option>
              <option value="stylized_3d_muslimah">3D Muslimah (Blank Head)</option>
              <option value="stylized_3d_male">3D Male (Blank Head)</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Wardrobe Mode / Key</label>
            <select
              value={value.visual_overrides_json.wardrobe_style}
              onChange={(e) => updateLegacyField('wardrobe_style', e.target.value)}
              className="form-select"
            >
              <option value="sequential">Sequential Rotation</option>
              <option value="random">Stable Random</option>
              <option value="sage_muted">Sage Green (Fixed)</option>
              <option value="mocca_caramel">Mocca Caramel (Fixed)</option>
              <option value="custom">Custom Color / Wardrobe</option>
            </select>
          </div>
          {value.visual_overrides_json.wardrobe_style === 'custom' && (
            <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Custom Wardrobe Prompt</label>
              <input
                type="text"
                placeholder="e.g. wearing a lavender soft textured sleeve, showing clean hands"
                value={value.visual_overrides_json.wardrobe_style_custom || ''}
                onChange={(e) => updateLegacyField('wardrobe_style_custom', e.target.value)}
                className="form-input"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
