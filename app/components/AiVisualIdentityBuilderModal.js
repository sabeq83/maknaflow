'use client';

import { useState, useMemo } from 'react';
import {
  SUBJECT_KINDS,
  HUMAN_FACELESS_MODES,
  POPULATION_MODES
} from '../../lib/visual-identity-contract';
import {
  VISUAL_STYLE_KEYS,
  VISUAL_LANGUAGE_CATALOG,
  NARRATIVE_FUNCTIONS,
  getVisualStyleDefinition
} from '../../lib/visual-language-catalog';

const BUILDER_STEPS = [
  { id: 'foundation', label: '1. Foundation', description: 'Brand seed & core idea' },
  { id: 'subject', label: '2. Subject', description: 'Faceless subject system' },
  { id: 'visual_language', label: '3. Visual Language', description: 'Primary & supporting modes' },
  { id: 'routing', label: '4. Mode Routing', description: 'Narrative scene mapping' },
  { id: 'review', label: '5. Output & Review', description: 'AI generation & preview' }
];

export default function AiVisualIdentityBuilderModal({ onClose, onContinueEditing }) {
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);

  // Creative Brief State
  const [brief, setBrief] = useState({
    seed: 'Wa’y Siyasi — Membaca fakta, memahami akar masalah dan sistem di balik kebijakan sosial-politik dalam kerangka pemikiran Islam.',
    purpose: 'Edukasi sosial politik faceless sistematis',
    audience: 'Masyarakat umum dan pemuda kritis',
    mood: 'Intelektual, reflektif, tajam, berwibawa',
    subject_kind: 'human',
    faceless_mode: 'featureless_editorial',
    population_mode: 'single_group_or_crowd',
    aspect_ratio: '9:16',
    variation_level: 'balanced',
    primary_style: 'editorial_graphic_novel',
    supporting_styles: ['isometric_society', 'symbolic_surrealism', 'paper_cutout_documentary'],
    mode_routing: {
      hook: 'symbolic_surrealism',
      context: 'editorial_graphic_novel',
      mechanism: 'isometric_society',
      consequence: 'editorial_graphic_novel',
      evidence_reveal: 'paper_cutout_documentary',
      conclusion: 'symbolic_surrealism'
    },
    texture_direction: 'Subtle printed paper grain, editorial ink, tactile collage',
    composition_direction: '1 primary idea per scene, vertical social safe zones, clean negative space',
    metaphor_direction: 'Concept -> physical object -> visual action',
    wardrobe_direction: 'Everyday civilian attire, modest charcoal, off-white, warm gray',
    color_direction: 'Charcoal, off-white, warm gray, muted beige, max 1 accent color',
    environment_direction: 'Clean structural environment with subtle paper texture',
    lighting_direction: 'Soft directional editorial lighting with geometric shadows',
    camera_direction: 'Editorial wide, isometric systemic view, silhouette profiles',
    special_constraints: 'Strictly faceless; intentional crowds allowed only without visible faces'
  });

  // Current AI generated/refined draft state
  const [draft, setDraft] = useState(null);
  const [refineInstruction, setRefineInstruction] = useState('');

  // Active styles available for routing
  const activeStyles = useMemo(() => {
    return [brief.primary_style, ...(brief.supporting_styles || [])];
  }, [brief.primary_style, brief.supporting_styles]);

  // Handle Style Card Role Change (Primary / Supporting / Off)
  const handleSetStyleRole = (styleKey, role) => {
    setBrief(prev => {
      let nextPrimary = prev.primary_style;
      let nextSupporting = [...(prev.supporting_styles || [])];

      if (role === 'primary') {
        if (nextPrimary !== styleKey) {
          // Demote old primary to supporting if not already there
          if (!nextSupporting.includes(nextPrimary)) {
            nextSupporting.push(nextPrimary);
          }
          // Remove new primary from supporting
          nextSupporting = nextSupporting.filter(s => s !== styleKey);
          nextPrimary = styleKey;
        }
      } else if (role === 'supporting') {
        if (nextPrimary === styleKey) {
          // Cannot set primary to supporting without choosing another primary
          return prev;
        }
        if (!nextSupporting.includes(styleKey)) {
          nextSupporting.push(styleKey);
        }
      } else if (role === 'off') {
        if (nextPrimary === styleKey) {
          // Cannot turn off primary; select another primary first
          return prev;
        }
        nextSupporting = nextSupporting.filter(s => s !== styleKey);
      }

      // Repair routes if any route used a now-disabled style
      const allowedStyles = [nextPrimary, ...nextSupporting];
      const nextRouting = { ...prev.mode_routing };
      for (const fn of NARRATIVE_FUNCTIONS) {
        if (!allowedStyles.includes(nextRouting[fn])) {
          nextRouting[fn] = nextPrimary;
        }
      }

      return {
        ...prev,
        primary_style: nextPrimary,
        supporting_styles: nextSupporting,
        mode_routing: nextRouting
      };
    });
  };

  const handleUpdateRoute = (narrativeFn, styleKey) => {
    setBrief(prev => ({
      ...prev,
      mode_routing: {
        ...prev.mode_routing,
        [narrativeFn]: styleKey
      }
    }));
  };

  const handleInputChange = (field, value) => {
    setBrief(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'subject_kind') {
        if (value === 'human' || value === 'blank_face_3d') {
          next.faceless_mode = value === 'blank_face_3d' ? 'blank_face_3d' : 'featureless_editorial';
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

    setIsGenerating(true);
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
      setActiveStep(4); // Go to step 5 (review)
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefine = async (e) => {
    if (e) e.preventDefault();
    if (!refineInstruction || refineInstruction.trim().length === 0) return;

    setIsRefining(true);
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
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRefining(false);
    }
  };

  // Resolved Prompt Preview string
  const previewPrompt = useMemo(() => {
    if (draft?.resolved_preview?.style_prompt) {
      return draft.resolved_preview.style_prompt;
    }
    const primaryDef = getVisualStyleDefinition(brief.primary_style);
    return `(VERTICAL ${brief.aspect_ratio}) [PRIMARY STYLE] ${primaryDef.prompt}, [TEXTURE] ${brief.texture_direction}, [COMPOSITION] ${brief.composition_direction}, [NEGATIVE] ${primaryDef.negative_prompts.join(', ')}`;
  }, [draft, brief]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-visual-identity-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--overlay-backdrop)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
        overflowY: 'auto'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1080px',
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-md, 12px)',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-card, 0 12px 34px rgba(0,0,0,0.3))'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle)'
          }}
        >
          <div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: 'var(--action-primary)',
                letterSpacing: '.1em',
                textTransform: 'uppercase'
              }}
            >
              VISUAL IDENTITY STUDIO V2
            </span>
            <h2
              id="ai-visual-identity-title"
              style={{
                fontSize: '1.25rem',
                fontWeight: 850,
                color: 'var(--text-primary)',
                margin: '2px 0 0'
              }}
            >
              Multi-Mode Visual Language Builder
            </h2>
          </div>
          <button
            onClick={onClose}
            className="btn"
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              background: 'var(--surface-interactive)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm, 8px)',
              color: 'var(--text-secondary)'
            }}
          >
            ✕ Tutup
          </button>
        </div>

        {/* Step Indicator */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 8,
            padding: '14px 24px',
            background: 'var(--surface-raised)',
            borderBottom: '1px solid var(--border-subtle)',
            overflowX: 'auto'
          }}
        >
          {BUILDER_STEPS.map((s, idx) => {
            const isActive = activeStep === idx;
            const isDone = activeStep > idx;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveStep(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm, 8px)',
                  background: isActive ? 'var(--surface)' : 'transparent',
                  border: isActive ? '1px solid var(--action-primary)' : '1px solid transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '12px',
                  fontWeight: isActive ? 700 : 500
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    background: (isActive || isDone) ? 'var(--action-primary)' : 'var(--surface-interactive)',
                    color: (isActive || isDone) ? 'var(--on-action-primary)' : 'var(--text-muted)',
                    fontSize: '11px',
                    fontWeight: 800,
                    flexShrink: 0
                  }}
                >
                  {idx + 1}
                </span>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.label.replace(/^\d+\.\s*/, '')}
                </span>
              </button>
            );
          })}
        </div>

        {/* Body Workspace */}
        <div style={{ overflowY: 'auto', padding: 24, flexGrow: 1 }}>
          {error && (
            <div
              style={{
                background: 'var(--status-danger-soft)',
                border: '1px solid var(--status-danger)',
                color: 'var(--status-danger)',
                padding: 12,
                borderRadius: 'var(--radius-sm, 8px)',
                fontSize: '13px',
                marginBottom: 18
              }}
            >
              ⚠️ <strong>Error:</strong> {error}
            </div>
          )}

          {/* STEP 1: FOUNDATION */}
          {activeStep === 0 && (
            <div style={{ display: 'grid', gap: 18 }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
                  1. Brand Foundation & Seed
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                  Definisikan filosofi visual utama, tujuan konten, dan target audiens brand Anda.
                </p>
              </div>

              <label style={{ display: 'grid', gap: 6, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Visual Seed / Arahan Inti Brand (Wajib)*
                <textarea
                  rows={4}
                  value={brief.seed}
                  onChange={e => handleInputChange('seed', e.target.value)}
                  placeholder="Deskripsikan inti pesan visual brand..."
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 'var(--radius-sm, 8px)',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                    fontSize: '13px'
                  }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                <label style={{ display: 'grid', gap: 6, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Tujuan Konten (Purpose)
                  <input
                    type="text"
                    value={brief.purpose}
                    onChange={e => handleInputChange('purpose', e.target.value)}
                    placeholder="Contoh: Edukasi sosial politik faceless"
                    style={{
                      padding: '9px 11px',
                      borderRadius: 'var(--radius-sm, 8px)',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '13px'
                    }}
                  />
                </label>

                <label style={{ display: 'grid', gap: 6, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Target Audiens
                  <input
                    type="text"
                    value={brief.audience}
                    onChange={e => handleInputChange('audience', e.target.value)}
                    placeholder="Contoh: Pemuda kritis & masyarakat umum"
                    style={{
                      padding: '9px 11px',
                      borderRadius: 'var(--radius-sm, 8px)',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '13px'
                    }}
                  />
                </label>

                <label style={{ display: 'grid', gap: 6, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Mood & Tonality
                  <input
                    type="text"
                    value={brief.mood}
                    onChange={e => handleInputChange('mood', e.target.value)}
                    placeholder="Contoh: Intelektual, reflektif, tajam"
                    style={{
                      padding: '9px 11px',
                      borderRadius: 'var(--radius-sm, 8px)',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '13px'
                    }}
                  />
                </label>

                <label style={{ display: 'grid', gap: 6, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Aspect Ratio
                  <select
                    value={brief.aspect_ratio}
                    onChange={e => handleInputChange('aspect_ratio', e.target.value)}
                    style={{
                      padding: '9px 11px',
                      borderRadius: 'var(--radius-sm, 8px)',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '13px'
                    }}
                  >
                    <option value="9:16">Vertical 9:16 (TikTok, Reels, Shorts)</option>
                    <option value="16:9">Horizontal 16:9 (YouTube Standard)</option>
                    <option value="1:1">Square 1:1 (Instagram Feed)</option>
                  </select>
                </label>
              </div>
            </div>
          )}

          {/* STEP 2: SUBJECT SYSTEM */}
          {activeStep === 1 && (
            <div style={{ display: 'grid', gap: 18 }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
                  2. Subject & Population System
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                  Konfigurasi subjek manusia tanpa wajah (faceless) dan aturan kerumunan (intentional crowd).
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                <label style={{ display: 'grid', gap: 6, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Subject Kind
                  <select
                    value={brief.subject_kind}
                    onChange={e => handleInputChange('subject_kind', e.target.value)}
                    style={{
                      padding: '9px 11px',
                      borderRadius: 'var(--radius-sm, 8px)',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '13px'
                    }}
                  >
                    <option value="human">Human (Faceless)</option>
                    <option value="blank_face_3d">Blank Face 3D</option>
                    <option value="animal">Animal</option>
                    <option value="mascot_object">Mascot / Object</option>
                  </select>
                </label>

                <label style={{ display: 'grid', gap: 6, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Faceless Treatment Mode
                  <select
                    value={brief.faceless_mode}
                    onChange={e => handleInputChange('faceless_mode', e.target.value)}
                    style={{
                      padding: '9px 11px',
                      borderRadius: 'var(--radius-sm, 8px)',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '13px'
                    }}
                  >
                    <option value="featureless_editorial">Featureless Editorial (Minimalist silhouette / turned away)</option>
                    <option value="hands_only">Hands Only (Forearms & hands focused)</option>
                    <option value="silhouette">Silhouette (High-contrast backlight)</option>
                    <option value="crop_below_neck">Crop Below Neck</option>
                    <option value="back_view">Back View</option>
                    <option value="first_person_pov">First-Person POV</option>
                  </select>
                </label>

                <label style={{ display: 'grid', gap: 6, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Population Mode
                  <select
                    value={brief.population_mode}
                    onChange={e => handleInputChange('population_mode', e.target.value)}
                    style={{
                      padding: '9px 11px',
                      borderRadius: 'var(--radius-sm, 8px)',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '13px'
                    }}
                  >
                    <option value="single_group_or_crowd">Single, Group, or Intentional Crowd (Flexible)</option>
                    <option value="single">Single Character Only</option>
                    <option value="group">Small Group (2-4 characters)</option>
                    <option value="crowd">Intentional Crowd (Systemic faceless masses)</option>
                  </select>
                </label>
              </div>

              <label style={{ display: 'grid', gap: 6, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Deskripsi Arahan Subjek & Busana (Wardrobe Direction)
                <textarea
                  rows={3}
                  value={brief.wardrobe_direction}
                  onChange={e => handleInputChange('wardrobe_direction', e.target.value)}
                  placeholder="Contoh: Warga sipil berpakaian kasual sopan, palet charcoal, off-white, warm gray..."
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 'var(--radius-sm, 8px)',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '13px'
                  }}
                />
              </label>
            </div>
          )}

          {/* STEP 3: VISUAL LANGUAGE */}
          {activeStep === 2 && (
            <div style={{ display: 'grid', gap: 18 }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
                  3. Multi-Mode Visual Language
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                  Pilih 1 <strong>Primary Style</strong> utama dan beberapa <strong>Supporting Styles</strong> pendukung.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                {VISUAL_STYLE_KEYS.map(key => {
                  const def = VISUAL_LANGUAGE_CATALOG[key];
                  const isPrimary = brief.primary_style === key;
                  const isSupporting = (brief.supporting_styles || []).includes(key);
                  const isOff = !isPrimary && !isSupporting;

                  return (
                    <div
                      key={key}
                      style={{
                        borderRadius: 'var(--radius-md, 12px)',
                        border: isPrimary ? '2px solid var(--action-primary)' : isSupporting ? '1px solid var(--status-info)' : '1px solid var(--border-subtle)',
                        background: 'var(--surface-raised)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      <div style={{ padding: 14, flexGrow: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{def.label}</strong>
                          {isPrimary && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                padding: '2px 6px',
                                borderRadius: 'var(--radius-xs, 4px)',
                                background: 'var(--action-primary)',
                                color: 'var(--on-action-primary)'
                              }}
                            >
                              PRIMARY
                            </span>
                          )}
                          {isSupporting && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                padding: '2px 6px',
                                borderRadius: 'var(--radius-xs, 4px)',
                                background: 'var(--status-info-soft)',
                                color: 'var(--status-info)'
                              }}
                            >
                              SUPPORTING
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.4 }}>
                          {def.description}
                        </p>
                      </div>

                      {/* Segmented Controls: Primary / Supporting / Off */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          borderTop: '1px solid var(--border-subtle)',
                          background: 'var(--surface)'
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleSetStyleRole(key, 'primary')}
                          style={{
                            padding: '8px 4px',
                            fontSize: '11px',
                            fontWeight: isPrimary ? 800 : 500,
                            background: isPrimary ? 'var(--action-primary)' : 'transparent',
                            color: isPrimary ? 'var(--on-action-primary)' : 'var(--text-secondary)',
                            border: 0,
                            borderRight: '1px solid var(--border-subtle)',
                            cursor: 'pointer'
                          }}
                        >
                          Primary
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetStyleRole(key, 'supporting')}
                          style={{
                            padding: '8px 4px',
                            fontSize: '11px',
                            fontWeight: isSupporting ? 800 : 500,
                            background: isSupporting ? 'var(--status-info-soft)' : 'transparent',
                            color: isSupporting ? 'var(--status-info)' : 'var(--text-secondary)',
                            border: 0,
                            borderRight: '1px solid var(--border-subtle)',
                            cursor: isPrimary ? 'not-allowed' : 'pointer',
                            opacity: isPrimary ? 0.5 : 1
                          }}
                          disabled={isPrimary}
                        >
                          Supporting
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetStyleRole(key, 'off')}
                          style={{
                            padding: '8px 4px',
                            fontSize: '11px',
                            fontWeight: isOff ? 800 : 500,
                            background: isOff ? 'var(--surface-interactive)' : 'transparent',
                            color: isOff ? 'var(--text-muted)' : 'var(--text-secondary)',
                            border: 0,
                            cursor: isPrimary ? 'not-allowed' : 'pointer',
                            opacity: isPrimary ? 0.5 : 1
                          }}
                          disabled={isPrimary}
                        >
                          Off
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: NARRATIVE MODE ROUTING */}
          {activeStep === 3 && (
            <div style={{ display: 'grid', gap: 18 }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
                  4. Narrative Mode Routing
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                  Arahkan fungsi narasi setiap scene ke visual mode yang sesuai. Hanya mode yang aktif (Primary & Supporting) yang dapat dipilih.
                </p>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                {NARRATIVE_FUNCTIONS.map(fn => {
                  const currentStyle = brief.mode_routing?.[fn] || brief.primary_style;
                  const labels = {
                    hook: 'Hook (01) — Pembuka kontras / visualisasi metaforik',
                    context: 'Context (02) — Latar belakang & fakta fenomena',
                    mechanism: 'Mechanism (03) — Alur sistemik / cara kerja kebijakan',
                    consequence: 'Consequence (04) — Dampak riil terhadap masyarakat',
                    evidence_reveal: 'Evidence Reveal (05) — Bukti dokumen / data / investigasi',
                    conclusion: 'Conclusion (06) — Solusi sistemik & perspektif Islam'
                  };

                  return (
                    <div
                      key={fn}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr minmax(200px, 280px)',
                        alignItems: 'center',
                        gap: 14,
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-sm, 8px)',
                        background: 'var(--surface-raised)',
                        border: '1px solid var(--border-subtle)'
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '13px', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                          {fn.replace(/_/g, ' ')}
                        </strong>
                        <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '11px', marginTop: 2 }}>
                          {labels[fn] || fn}
                        </small>
                      </div>

                      <select
                        value={currentStyle}
                        onChange={e => handleUpdateRoute(fn, e.target.value)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-sm, 8px)',
                          background: 'var(--input-bg)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-primary)',
                          fontSize: '12px',
                          fontWeight: 600
                        }}
                      >
                        {activeStyles.map(sKey => (
                          <option key={sKey} value={sKey}>
                            {VISUAL_LANGUAGE_CATALOG[sKey]?.label} {sKey === brief.primary_style ? '(Primary)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 5: OUTPUT & REVIEW */}
          {activeStep === 4 && (
            <div style={{ display: 'grid', gap: 18 }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
                  5. Output & AI Generation
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                  Jalankan Single-Pass Gemini AI untuk menyusun preset terstruktur lengkap atau terapkan langsung ke editor.
                </p>
              </div>

              {/* Generate AI Button & Live Prompt Preview */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 'var(--radius-md, 12px)',
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-subtle)',
                  display: 'grid',
                  gap: 14
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Single-Pass Gemini Generator</strong>
                    <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>
                      Menghasilkan seluruh parameter visual, prompt layers, dan guardrail dalam 1x panggilan.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="btn primary"
                    style={{
                      padding: '9px 18px',
                      fontSize: '13px',
                      fontWeight: 700,
                      background: 'var(--action-primary)',
                      color: 'var(--on-action-primary)',
                      border: 0,
                      borderRadius: 'var(--radius-sm, 8px)',
                      cursor: isGenerating ? 'wait' : 'pointer'
                    }}
                  >
                    {isGenerating ? '⏳ Merumuskan Preset...' : '✨ Generate AI Preset'}
                  </button>
                </div>

                {/* Live Prompt Preview Box */}
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Resolved Production Prompt Preview:
                  </span>
                  <div
                    style={{
                      marginTop: 6,
                      padding: 12,
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm, 8px)',
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: '11px',
                      lineHeight: 1.5,
                      color: 'var(--text-secondary)',
                      maxHeight: 140,
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {previewPrompt}
                  </div>
                </div>
              </div>

              {/* Draft Output if Generated */}
              {draft && (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 'var(--radius-md, 12px)',
                    background: 'var(--surface-interactive)',
                    border: '1px solid var(--border-strong)',
                    display: 'grid',
                    gap: 12
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--text-primary)' }}>{draft.label}</h4>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{draft.description}</p>
                    </div>
                    {draft.compliance && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-xs, 4px)',
                          background: draft.compliance.status === 'compliant' ? 'var(--status-success-soft)' : 'var(--status-info-soft)',
                          color: draft.compliance.status === 'compliant' ? 'var(--status-success)' : 'var(--status-info)'
                        }}
                      >
                        Score: {draft.compliance.score}/100 ({draft.compliance.status})
                      </span>
                    )}
                  </div>

                  {draft.creative_rationale && (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--surface)', padding: 10, borderRadius: 'var(--radius-sm, 8px)' }}>
                      <strong>Creative Rationale:</strong> {draft.creative_rationale}
                    </div>
                  )}

                  {/* Refinement input */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <input
                      type="text"
                      value={refineInstruction}
                      onChange={e => setRefineInstruction(e.target.value)}
                      placeholder="Instruksi penyempurnaan (misal: buat bayangan lebih geometris)..."
                      style={{
                        flexGrow: 1,
                        padding: '8px 10px',
                        fontSize: '12px',
                        background: 'var(--input-bg)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm, 8px)',
                        color: 'var(--text-primary)'
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleRefine}
                      disabled={isRefining || !refineInstruction.trim()}
                      className="btn"
                      style={{
                        padding: '8px 14px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: 'var(--surface-raised)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm, 8px)',
                        cursor: (isRefining || !refineInstruction.trim()) ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isRefining ? '⏳ Menyempurnakan...' : 'Refine'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--surface-raised)'
          }}
        >
          <button
            type="button"
            onClick={() => setActiveStep(prev => Math.max(0, prev - 1))}
            disabled={activeStep === 0}
            className="btn"
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm, 8px)',
              color: 'var(--text-secondary)',
              cursor: activeStep === 0 ? 'not-allowed' : 'pointer',
              opacity: activeStep === 0 ? 0.4 : 1
            }}
          >
            ← Sebelumnya
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            {activeStep < 4 ? (
              <button
                type="button"
                onClick={() => setActiveStep(prev => Math.min(4, prev + 1))}
                className="btn primary"
                style={{
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 700,
                  background: 'var(--action-primary)',
                  color: 'var(--on-action-primary)',
                  border: 0,
                  borderRadius: 'var(--radius-sm, 8px)',
                  cursor: 'pointer'
                }}
              >
                Lanjutkan →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (onContinueEditing) {
                    if (draft?.config) {
                      onContinueEditing(draft.config, draft.label, draft.description);
                    } else {
                      // Apply current brief configuration as config
                      const syntheticConfig = {
                        schema_version: '2',
                        label: brief.purpose || 'Custom Visual Identity',
                        description: brief.seed,
                        subject: {
                          kind: brief.subject_kind,
                          faceless_mode: brief.faceless_mode,
                          population_mode: brief.population_mode,
                          demographic_key: 'custom',
                          custom_description: brief.wardrobe_direction
                        },
                        visual_language: {
                          primary_style: brief.primary_style,
                          supporting_styles: brief.supporting_styles,
                          disabled_styles: VISUAL_STYLE_KEYS.filter(k => k !== brief.primary_style && !brief.supporting_styles.includes(k))
                        },
                        mode_routing: brief.mode_routing,
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
                          custom_description: brief.wardrobe_direction,
                          sleeve_policy: 'wrists_covered'
                        },
                        environment: {
                          preset_key: 'general_workspace',
                          custom_description: brief.environment_direction
                        },
                        lighting: {
                          preset_key: 'window_daylight',
                          custom_description: brief.lighting_direction
                        },
                        camera: {
                          framing: 'editorial_wide',
                          perspective: 'third_person'
                        },
                        style: {
                          preset_key: brief.primary_style,
                          aspect_ratio: brief.aspect_ratio
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
                      onContinueEditing(syntheticConfig, brief.purpose || 'Custom Visual Identity', brief.seed);
                    }
                  }
                  onClose();
                }}
                className="btn primary"
                style={{
                  padding: '8px 20px',
                  fontSize: '13px',
                  fontWeight: 800,
                  background: 'var(--action-primary)',
                  color: 'var(--on-action-primary)',
                  border: 0,
                  borderRadius: 'var(--radius-sm, 8px)',
                  cursor: 'pointer'
                }}
              >
                ✓ Terapkan ke Editor Manual
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
