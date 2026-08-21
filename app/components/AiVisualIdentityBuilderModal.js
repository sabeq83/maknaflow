'use client';

import { useState } from 'react';
import { SUBJECT_KINDS, HUMAN_FACELESS_MODES, ALL_FACELESS_MODES } from '../../lib/visual-identity-contract';

export default function AiVisualIdentityBuilderModal({ onClose, onContinueEditing }) {
  const [step, setStep] = useState('brief'); // 'brief' | 'generating' | 'review' | 'refining'
  const [error, setError] = useState(null);

  // Creative Brief Form State
  const [brief, setBrief] = useState({
    seed: '',
    purpose: '',
    subject_kind: 'human',
    faceless_mode: 'hands_only',
    audience: '',
    mood: '',
    wardrobe_direction: '',
    color_direction: '',
    environment_direction: '',
    lighting_direction: '',
    camera_direction: '',
    style_direction: '',
    aspect_ratio: '9:16',
    special_constraints: '',
    variation_level: 'balanced'
  });

  // Current AI generated/refined draft state
  const [draft, setDraft] = useState(null);
  const [refineInstruction, setRefineInstruction] = useState('');

  const handleInputChange = (field, value) => {
    setBrief(prev => {
      const next = { ...prev, [field]: value };
      // Faceless mode rule logic for subject kind change
      if (field === 'subject_kind') {
        if (value === 'human' || value === 'blank_face_3d') {
          next.faceless_mode = 'hands_only';
        } else {
          next.faceless_mode = 'not_applicable';
        }
      }
      return next;
    });
  };

  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    if (!brief.seed || brief.seed.trim().length < 3) {
      setError('Seed visual wajib diisi (minimal 3 karakter)');
      return;
    }

    setStep('generating');
    setError(null);

    try {
      const res = await fetch('/api/v2/visual-identities/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brief)
      });
      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error || 'Gagal menghasilkan identitas visual');
      }

      setDraft(result.data);
      setStep('review');
    } catch (err) {
      setError(err.message);
      setStep('brief');
    }
  };

  const handleRefine = async (e) => {
    if (e) e.preventDefault();
    if (!refineInstruction || refineInstruction.trim().length === 0) return;

    setStep('refining');
    setError(null);

    try {
      const res = await fetch('/api/v2/visual-identities/ai/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief,
          current_draft: {
            label: draft.label,
            description: draft.description,
            suggested_preset_key: draft.suggested_preset_key,
            creative_rationale: draft.creative_rationale,
            config: draft.config
          },
          instruction: refineInstruction
        })
      });
      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error || 'Gagal menyempurnakan identitas visual');
      }

      setDraft(result.data);
      setRefineInstruction('');
      setStep('review');
    } catch (err) {
      setError(err.message);
      setStep('review');
    }
  };

  // Allow user to edit draft values directly on review screen
  const handleDraftFieldChange = (section, field, value) => {
    setDraft(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [section]: {
          ...prev.config[section],
          [field]: value
        }
      }
    }));
  };

  return (
    <div 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="ai-visual-identity-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'var(--overlay-backdrop)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 24,
        overflowY: 'auto'
      }}
    >
      <div 
        className="card"
        style={{
          width: '100%',
          maxWidth: step === 'review' ? '960px' : '680px',
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <h2 id="ai-visual-identity-title" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--action-primary)', margin: 0 }}>
            ✨ AI Visual Identity Studio Builder
          </h2>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '6px 12px' }}>✕ Close</button>
        </div>

        {/* Scrollable Workspace */}
        <div style={{ overflowY: 'auto', padding: 24, flexGrow: 1 }}>
          {error && (
            <div style={{ background: 'var(--status-danger-soft)', border: '1px solid rgba(251, 113, 133, 0.2)', color: 'var(--status-danger)', padding: 14, borderRadius: 'var(--radius)', fontSize: '0.85rem', marginBottom: 20 }}>
              ⚠️ <strong>Error:</strong> {error}
            </div>
          )}

          {step === 'brief' && (
            <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card" style={{ padding: 16, background: 'var(--surface-interactive)' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  Ketik arahan estetik visual utama Anda (misal produk, model, mood). Gemini AI akan merumuskan parameter identitas visual faceless terstruktur secara lengkap.
                </p>
              </div>

              <label className="form-label">
                Visual Seed / Arahan Utama (Wajib)*
                <textarea
                  required
                  rows={4}
                  placeholder="Ketik detail visual... (Contoh: Skincare Muslimah premium, tone sage green hangat, latar belakang meja rias minimalis)"
                  value={brief.seed}
                  onChange={e => handleInputChange('seed', e.target.value)}
                  className="form-input"
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <label className="form-label">
                  Subject Kind
                  <select
                    value={brief.subject_kind}
                    onChange={e => handleInputChange('subject_kind', e.target.value)}
                    className="form-select"
                  >
                    {SUBJECT_KINDS.map(kind => (
                      <option key={kind} value={kind}>{kind.replace('_', ' ')}</option>
                    ))}
                  </select>
                </label>

                <label className="form-label">
                  Faceless Mode
                  <select
                    value={brief.faceless_mode}
                    onChange={e => handleInputChange('faceless_mode', e.target.value)}
                    className="form-select"
                    disabled={brief.subject_kind !== 'human' && brief.subject_kind !== 'blank_face_3d'}
                  >
                    {brief.subject_kind === 'human' || brief.subject_kind === 'blank_face_3d' ? (
                      HUMAN_FACELESS_MODES.map(mode => (
                        <option key={mode} value={mode}>{mode.replace('_', ' ')}</option>
                      ))
                    ) : (
                      <option value="not_applicable">Not Applicable</option>
                    )}
                  </select>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <label className="form-label">
                  Target Audience
                  <input
                    type="text"
                    placeholder="e.g. Wanita karir urban 25-35 tahun"
                    value={brief.audience}
                    onChange={e => handleInputChange('audience', e.target.value)}
                    className="form-input"
                  />
                </label>
                <label className="form-label">
                  Aspect Ratio
                  <select
                    value={brief.aspect_ratio}
                    onChange={e => handleInputChange('aspect_ratio', e.target.value)}
                    className="form-select"
                  >
                    {['9:16', '16:9', '1:1'].map(ar => (
                      <option key={ar} value={ar}>{ar}</option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Accordion/Collapsible Advanced directions */}
              <fieldset style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <legend style={{ padding: '0 8px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Advanced Brief Parameters</legend>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <label className="form-label">
                    Wardrobe Direction
                    <input type="text" placeholder="e.g. linen gamis, wrists covered" value={brief.wardrobe_direction} onChange={e => handleInputChange('wardrobe_direction', e.target.value)} className="form-input" />
                  </label>
                  <label className="form-label">
                    Color Palette
                    <input type="text" placeholder="e.g. warm terracotta, cream, olive" value={brief.color_direction} onChange={e => handleInputChange('color_direction', e.target.value)} className="form-input" />
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <label className="form-label">
                    Environment
                    <input type="text" placeholder="e.g. nordic aesthetic kitchen" value={brief.environment_direction} onChange={e => handleInputChange('environment_direction', e.target.value)} className="form-input" />
                  </label>
                  <label className="form-label">
                    Lighting Style
                    <input type="text" placeholder="e.g. cinematic morning daylight" value={brief.lighting_direction} onChange={e => handleInputChange('lighting_direction', e.target.value)} className="form-input" />
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <label className="form-label">
                    Camera & Framing
                    <input type="text" placeholder="e.g. close-up macro, natural 50mm" value={brief.camera_direction} onChange={e => handleInputChange('camera_direction', e.target.value)} className="form-input" />
                  </label>
                  <label className="form-label">
                    Art Style Preset
                    <input type="text" placeholder="e.g. cinematic realistic photo" value={brief.style_direction} onChange={e => handleInputChange('style_direction', e.target.value)} className="form-input" />
                  </label>
                </div>
              </fieldset>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
                <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">✨ Generate Draft Config</button>
              </div>
            </form>
          )}

          {(step === 'generating' || step === 'refining') && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 16 }}>
              <svg className="animate-spin" width="38" height="38" viewBox="0 0 38 38" stroke="var(--action-primary)" xmlns="http://www.w3.org/2000/svg">
                <g fill="none" fillRule="evenodd">
                  <g transform="translate(1 1)" strokeWidth="3">
                    <circle strokeOpacity=".25" cx="18" cy="18" r="18"/>
                    <path d="M36 18c0-9.94-8.06-18-18-18"/>
                  </g>
                </g>
              </svg>
              <strong style={{ fontSize: '1.05rem' }}>
                {step === 'generating' ? 'Gemini AI is generating visual blueprint...' : 'Gemini AI is refining the visual parameters...'}
              </strong>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Memproses deskripsi kognitif, menganalisis faceless invariant, dan menyusun preset.
              </p>
            </div>
          )}

          {step === 'review' && draft && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Compliance Report Bar */}
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: 16, 
                  background: draft.compliance.status === 'compliant' ? 'var(--status-success-soft)' : 'var(--status-warning-soft)',
                  border: `1px solid ${draft.compliance.status === 'compliant' ? 'rgba(74,222,128,0.2)' : 'rgba(251,191,36,0.2)'}`,
                  borderRadius: 'var(--radius)' 
                }}
              >
                <div>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>Compliance Status</span>
                  <strong style={{ color: draft.compliance.status === 'compliant' ? 'var(--status-success)' : 'var(--status-warning)' }}>
                    {draft.compliance.status.replace(/_/g, ' ').toUpperCase()}
                  </strong>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>Score</span>
                  <strong style={{ fontSize: '1.15rem' }}>{draft.compliance.score}/100</strong>
                </div>
              </div>

              {/* Rationale and Info */}
              <div className="card" style={{ padding: 20, background: 'var(--surface-interactive)' }}>
                <h4 style={{ margin: '0 0 8px 0', color: 'var(--action-primary)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Creative Rationale</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  {draft.creative_rationale || 'AI did not provide details.'}
                </p>
              </div>

              {/* Warnings and Corrections if any */}
              {draft.compliance.corrections.length > 0 && (
                <div style={{ background: 'var(--status-warning-soft)', border: '1px solid rgba(251,191,36,0.15)', padding: 16, borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--status-warning)', textTransform: 'uppercase' }}>Auto-Corrections Applied</strong>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {draft.compliance.corrections.map((corr, idx) => (
                      <li key={idx}><strong>{corr.path}</strong>: {corr.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Editable Preset Configuration Preview */}
              <div>
                <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: 12 }}>Edit Generated Draft Parameters</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <label className="form-label">
                      Draft Label
                      <input 
                        type="text" 
                        value={draft.label} 
                        onChange={e => setDraft({ ...draft, label: e.target.value })} 
                        className="form-input" 
                      />
                    </label>
                    
                    <label className="form-label">
                      Subject Description Detail
                      <textarea
                        rows={3}
                        value={draft.config.subject.custom_description}
                        onChange={e => handleDraftFieldChange('subject', 'custom_description', e.target.value)}
                        className="form-input"
                      />
                    </label>

                    <label className="form-label">
                      Wardrobe Preset Key
                      <input 
                        type="text" 
                        value={draft.config.wardrobe.preset_key} 
                        onChange={e => handleDraftFieldChange('wardrobe', 'preset_key', e.target.value)} 
                        className="form-input" 
                      />
                    </label>

                    <label className="form-label">
                      Environment Preset Key
                      <input 
                        type="text" 
                        value={draft.config.environment.preset_key} 
                        onChange={e => handleDraftFieldChange('environment', 'preset_key', e.target.value)} 
                        className="form-input" 
                      />
                    </label>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <label className="form-label">
                      Suggested Key Slug
                      <input 
                        type="text" 
                        value={draft.suggested_preset_key} 
                        onChange={e => setDraft({ ...draft, suggested_preset_key: e.target.value })} 
                        className="form-input" 
                      />
                    </label>

                    <label className="form-label">
                      Camera Framing (Enforced Faceless)
                      <select
                        value={draft.config.camera.framing}
                        onChange={e => handleDraftFieldChange('camera', 'framing', e.target.value)}
                        className="form-select"
                      >
                        {['hands_closeup', 'forearms_and_hands', 'crop_below_neck', 'back_view', 'full_body_blank_face', 'object_or_animal'].map(framing => (
                          <option key={framing} value={framing}>{framing.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </label>

                    <label className="form-label">
                      Lighting Preset Key
                      <input 
                        type="text" 
                        value={draft.config.lighting.preset_key} 
                        onChange={e => handleDraftFieldChange('lighting', 'preset_key', e.target.value)} 
                        className="form-input" 
                      />
                    </label>

                    <label className="form-label">
                      Art Style Preset Key
                      <input 
                        type="text" 
                        value={draft.config.style.preset_key} 
                        onChange={e => handleDraftFieldChange('style', 'preset_key', e.target.value)} 
                        className="form-input" 
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Resolved Preview Output */}
              <div className="card" style={{ padding: 20, border: '1px dashed var(--border-color)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Resolved Prompt Output (Central Resolver Preview)</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--action-primary)', display: 'block', marginBottom: 2 }}>Subject Prompt:</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{draft.resolved_preview?.subject_prompt || 'N/A'}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--action-primary)', display: 'block', marginBottom: 2 }}>Wardrobe Prompt:</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{draft.resolved_preview?.wardrobe_prompt || 'N/A'}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--action-primary)', display: 'block', marginBottom: 2 }}>Environment Prompt:</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{draft.resolved_preview?.environment_prompt || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Refinement Panel */}
              <div className="card" style={{ padding: 20, background: 'var(--sidebar)' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--action-primary)' }}>💡 Refine Visual Parameters</h4>
                <div style={{ display: 'flex', gap: 12 }}>
                  <input
                    type="text"
                    placeholder="e.g. Buat pakaian lebih gelap, ganti lighting ke golden hour sore hari"
                    value={refineInstruction}
                    onChange={e => setRefineInstruction(e.target.value)}
                    className="form-input"
                    style={{ flexGrow: 1 }}
                  />
                  <button onClick={handleRefine} className="btn btn-secondary" style={{ padding: '0 20px' }}>
                    Apply Refinement
                  </button>
                </div>
              </div>

              {/* Handoff Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: 20 }}>
                <button type="button" onClick={() => setStep('brief')} className="btn btn-secondary">
                  ← Back to Brief
                </button>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button type="button" onClick={handleGenerate} className="btn btn-secondary">
                    Regenerate
                  </button>
                  <button
                    type="button"
                    onClick={() => onContinueEditing(draft)}
                    className="btn btn-primary"
                  >
                    Continue in Studio Editor →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
