'use client';

import React, { useState } from 'react';

const KNOWLEDGE_DOMAINS = [
  { key: 'general', label: 'General / Umum' },
  { key: 'pet_supplies', label: 'Pet Supplies' },
  { key: 'food_culinary', label: 'Food & Culinary' },
  { key: 'history', label: 'History / Sejarah' },
  { key: 'islamic_history', label: 'Islamic History' },
  { key: 'kitchen', label: 'Kitchen / Peralatan Dapur' },
  { key: 'home_improvement', label: 'Home Improvement' },
  { key: 'herbal', label: 'Herbal & Jamu' }
];

const UNIVERSE_TYPES = [
  { key: 'animal', label: 'Animal / Hewan' },
  { key: 'mascot_object', label: 'Mascot / Benda' },
  { key: 'human', label: 'Human / Manusia' }
];

const FACELESS_MODES = [
  { key: 'faceless', label: 'Faceless (Tanpa Wajah)' },
  { key: 'back_view', label: 'Back View (Tampak Belakang)' },
  { key: 'silhouette', label: 'Silhouette (Siluet)' },
  { key: 'environment_only', label: 'Environment Only' }
];

const initialBrief = {
  name: '',
  purpose: '',
  knowledge_domain: 'general',
  universe_type: 'animal',
  target_audience: '',
  premise_seed: '',
  tone: '',
  visual_direction: '',
  character_count: 2,
  location_count: 2,
  content_pillars: '',
  special_constraints: '',
  historical_period: '',
  freeform_brief: ''
};

export default function AiUniverseBuilderModal({ onClose, onCreated }) {
  const [step, setStep] = useState('brief'); // brief | generating | review | saving | success
  const [brief, setBrief] = useState({ ...initialBrief });
  const [draft, setDraft] = useState(null);
  const [meta, setMeta] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [errorDetails, setErrorDetails] = useState([]);

  // States for accordion expand/collapse in review
  const [activeReviewSection, setActiveReviewSection] = useState('profile'); // profile | characters | locations | rules

  // States for Creative Brief Generator (AI Suggestions)
  const [seedInput, setSeedInput] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [suggestedOptions, setSuggestedOptions] = useState(null);
  const [suggestError, setSuggestError] = useState('');

  const handleSuggestBriefs = async () => {
    if (!seedInput.trim()) return;
    setSuggesting(true);
    setSuggestError('');
    setSuggestedOptions(null);

    try {
      const res = await fetch('/api/v2/universe-ai/suggest-briefs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ seed: seedInput })
      });
      const data = await res.json();
      if (data.success) {
        setSuggestedOptions(data.options);
      } else {
        setSuggestError(data.message || 'Gagal menghasilkan opsi brief.');
      }
    } catch (err) {
      setSuggestError('Error: ' + err.message);
    } finally {
      setSuggesting(false);
    }
  };

  const isHistorical = brief.knowledge_domain === 'history' || brief.knowledge_domain === 'islamic_history' || brief.universe_type === 'human';

  const handleBriefChange = (field, value) => {
    setBrief(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async () => {
    setErrorMsg('');
    setErrorDetails([]);
    setStep('generating');

    const pillarsArray = brief.content_pillars
      ? brief.content_pillars.split(',').map(p => p.trim()).filter(Boolean)
      : [];

    const payload = {
      ...brief,
      character_count: Number(brief.character_count),
      location_count: Number(brief.location_count),
      content_pillars: pillarsArray
    };

    try {
      const res = await fetch('/api/v2/universe-ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setDraft(data.data.draft);
        setMeta(data.data.meta);
        setStep('review');
        setActiveReviewSection('profile');
      } else {
        setStep('brief');
        setErrorMsg(data.error || 'Terjadi kesalahan saat memproses generator.');
        setErrorDetails(data.details || []);
      }
    } catch (err) {
      setStep('brief');
      setErrorMsg('Gagal terhubung dengan server: ' + err.message);
    }
  };

  const handleSave = async () => {
    setErrorMsg('');
    setErrorDetails([]);
    setStep('saving');

    try {
      const res = await fetch('/api/v2/universe-ai/instantiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft,
          generation_meta: meta
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setStep('success');
        if (onCreated) {
          onCreated(data);
        }
      } else {
        setStep('review');
        setErrorMsg(data.error || 'Gagal menyimpan universe.');
        setErrorDetails(data.details || []);
      }
    } catch (err) {
      setStep('review');
      setErrorMsg('Network error: ' + err.message);
    }
  };

  // Editable fields handlers for Profile
  const handleProfileFieldChange = (field, val) => {
    setDraft(prev => ({
      ...prev,
      profile: {
        ...prev.profile,
        [field]: val
      }
    }));
  };

  const handleProfileRulesChange = (key, val) => {
    setDraft(prev => ({
      ...prev,
      profile: {
        ...prev.profile,
        rules_json: {
          ...prev.profile.rules_json,
          [key]: val
        }
      }
    }));
  };

  // Character handlers in draft state
  const handleCharacterFieldChange = (index, field, val) => {
    setDraft(prev => {
      const newChars = [...prev.characters];
      newChars[index] = { ...newChars[index], [field]: val };
      return { ...prev, characters: newChars };
    });
  };

  const addCharacterToDraft = () => {
    setDraft(prev => {
      const newChar = {
        name: 'Karakter Baru',
        character_key: 'karakter_baru_' + (prev.characters.length + 1),
        species: 'Mascot',
        breed: '',
        body_shape: '',
        fur_color: '',
        eye_color: '',
        wardrobe: '',
        personality: 'Ceria, suka menolong',
        movement_style: '',
        relative_size: 'medium',
        role: 'supporting',
        depiction_mode: prev.profile.universe_type === 'human' ? 'faceless' : 'normal',
        reference_type: 'identity',
        canonical_prompt: 'Claymation character description in English',
        forbidden_changes_json: []
      };
      return { ...prev, characters: [...prev.characters, newChar] };
    });
  };

  const deleteCharacterFromDraft = (index) => {
    setDraft(prev => {
      const newChars = prev.characters.filter((_, idx) => idx !== index);
      return { ...prev, characters: newChars };
    });
  };

  // Location handlers in draft state
  const handleLocationFieldChange = (index, field, val) => {
    setDraft(prev => {
      const newLocs = [...prev.locations];
      newLocs[index] = { ...newLocs[index], [field]: val };
      return { ...prev, locations: newLocs };
    });
  };

  const addLocationToDraft = () => {
    setDraft(prev => {
      const newLoc = {
        name: 'Lokasi Baru',
        location_key: 'lokasi_baru_' + (prev.locations.length + 1),
        visual_description: 'Cozy and warm room, cinematic claymation visual style',
        lighting_default: 'bright afternoon sun',
        props: 'some wooden boxes and plants',
        reference_type: 'location'
      };
      return { ...prev, locations: [...prev.locations, newLoc] };
    });
  };

  const deleteLocationFromDraft = (index) => {
    setDraft(prev => {
      const newLocs = prev.locations.filter((_, idx) => idx !== index);
      return { ...prev, locations: newLocs };
    });
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="ai-universe-title" style={modalStyles.overlay}>
      <div style={modalStyles.container}>
        
        {/* Header */}
        <div style={modalStyles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '24px' }}>✨</span>
            <h2 id="ai-universe-title" style={modalStyles.headerTitle}>Build Universe with AI</h2>
          </div>
          {step !== 'generating' && step !== 'saving' && (
            <button onClick={onClose} aria-label="Tutup" style={modalStyles.closeButton}>✕</button>
          )}
        </div>

        {/* Global Error Display */}
        {errorMsg && (
          <div style={modalStyles.errorBox}>
            <strong style={{ color: 'var(--status-danger)' }}>⚠️ Terjadi Error</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>{errorMsg}</p>
            {errorDetails.length > 0 && (
              <ul style={{ margin: '8px 0 0 0', paddingLeft: '16px', fontSize: '12px' }}>
                {errorDetails.map((detail, idx) => <li key={idx}>{detail}</li>)}
              </ul>
            )}
          </div>
        )}

        {/* Wizard Steps */}
        <div style={modalStyles.content}>

          {/* STEP 1: Brief Form */}
          {step === 'brief' && (
            <div>
              {/* Creative Brief Generator Option */}
              <div style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '24px'
              }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '8px' }}>
                  💡 Belum Punya Ide Detail? Biarkan AI Melengkapi Brief Anda
                </div>
                <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Ketik ide dasarmu di sini (contoh: "claymation tentang ekonomi kapitalisme"), lalu AI akan menghasilkan 3 draf brief kreatif terstruktur yang bisa Anda pilih.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Masukkan ide dasarmu..."
                    value={seedInput}
                    onChange={e => setSeedInput(e.target.value)}
                    disabled={suggesting}
                    style={{ ...modalStyles.input, flex: 1 }}
                  />
                  <button
                    disabled={suggesting || !seedInput.trim()}
                    onClick={handleSuggestBriefs}
                    style={{
                      ...modalStyles.primaryButton,
                      flex: 'none',
                      padding: '0 20px',
                      background: 'linear-gradient(135deg, var(--status-neutral), var(--status-neutral))',
                      color: 'var(--text-primary)',
                      opacity: (suggesting || !seedInput.trim()) ? 0.6 : 1,
                      cursor: (suggesting || !seedInput.trim()) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {suggesting ? '⏳ Memproses...' : 'Dapatkan Ide Brief (AI)'}
                  </button>
                </div>

                {suggestError && (
                  <div style={{ color: 'var(--status-danger)', fontSize: '12px', marginTop: '8px', fontWeight: 600 }}>
                    ❌ {suggestError}
                  </div>
                )}

                {/* Suggestions Selection Grid */}
                {suggestedOptions && (
                  <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', marginBottom: '12px' }}>
                      Pilih salah satu dari 3 opsi brief kreatif buatan AI:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {suggestedOptions.map((opt, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--accent)' }}>
                              Opsi #{idx + 1}: {opt.name}
                            </span>
                            <span style={{
                              fontSize: '11px',
                              background: 'var(--status-neutral-soft)',
                              color: 'var(--status-neutral)',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontWeight: 600
                            }}>
                              {opt.universe_type} • {opt.knowledge_domain}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            <strong>Premis:</strong> {opt.premise_seed}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            <strong>Tone & Visual:</strong> {opt.tone} ({opt.visual_direction})
                          </div>
                          <button
                            onClick={() => {
                              setBrief({
                                name: opt.name,
                                purpose: opt.purpose,
                                knowledge_domain: opt.knowledge_domain,
                                universe_type: opt.universe_type,
                                target_audience: opt.target_audience,
                                premise_seed: opt.premise_seed,
                                tone: opt.tone,
                                visual_direction: opt.visual_direction,
                                character_count: opt.character_count,
                                location_count: opt.location_count,
                                content_pillars: opt.content_pillars,
                                special_constraints: opt.special_constraints,
                                historical_period: '',
                                freeform_brief: ''
                              });
                              setSuggestedOptions(null);
                            }}
                            style={{
                              ...modalStyles.primaryButton,
                              marginTop: '8px',
                              padding: '8px 12px',
                              fontSize: '12px'
                            }}
                          >
                            ✓ Gunakan Brief Ini
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={modalStyles.formSectionTitle}>Lengkapi Creative Brief</div>
              
              <div style={modalStyles.row}>
                <div style={modalStyles.col}>
                  <label style={modalStyles.label}>Nama Universe *</label>
                  <input
                    type="text"
                    placeholder="Contoh: PawVille Town"
                    value={brief.name}
                    onChange={e => handleBriefChange('name', e.target.value)}
                    style={modalStyles.input}
                  />
                </div>
                <div style={modalStyles.col}>
                  <label style={modalStyles.label}>Tipe Universe *</label>
                  <select
                    value={brief.universe_type}
                    onChange={e => handleBriefChange('universe_type', e.target.value)}
                    style={modalStyles.select}
                  >
                    {UNIVERSE_TYPES.map(type => (
                      <option key={type.key} value={type.key}>{type.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={modalStyles.row}>
                <div style={modalStyles.col}>
                  <label style={modalStyles.label}>Domain Pengetahuan *</label>
                  <select
                    value={brief.knowledge_domain}
                    onChange={e => handleBriefChange('knowledge_domain', e.target.value)}
                    style={modalStyles.select}
                  >
                    {KNOWLEDGE_DOMAINS.map(domain => (
                      <option key={domain.key} value={domain.key}>{domain.label}</option>
                    ))}
                  </select>
                </div>
                <div style={modalStyles.col}>
                  <label style={modalStyles.label}>Target Audiens</label>
                  <input
                    type="text"
                    placeholder="Contoh: Anak-anak, Ibu Muda, Kolektor Mainan"
                    value={brief.target_audience}
                    onChange={e => handleBriefChange('target_audience', e.target.value)}
                    style={modalStyles.input}
                  />
                </div>
              </div>

              <div style={modalStyles.row}>
                <div style={modalStyles.col}>
                  <label style={modalStyles.label}>Tujuan Pembuatan</label>
                  <input
                    type="text"
                    placeholder="Contoh: Edukasi produk, Storytelling brand"
                    value={brief.purpose}
                    onChange={e => handleBriefChange('purpose', e.target.value)}
                    style={modalStyles.input}
                  />
                </div>
                <div style={modalStyles.col}>
                  <label style={modalStyles.label}>Tone / Suasana</label>
                  <input
                    type="text"
                    placeholder="Contoh: Hangat, lucu, dramatis"
                    value={brief.tone}
                    onChange={e => handleBriefChange('tone', e.target.value)}
                    style={modalStyles.input}
                  />
                </div>
              </div>

              <div style={modalStyles.row}>
                <div style={modalStyles.col}>
                  <label style={modalStyles.label}>Gaya Visual / Visual Direction</label>
                  <input
                    type="text"
                    placeholder="Contoh: Cinematic 3D clay, warna pastel"
                    value={brief.visual_direction}
                    onChange={e => handleBriefChange('visual_direction', e.target.value)}
                    style={modalStyles.input}
                  />
                </div>
                <div style={modalStyles.col}>
                  <label style={modalStyles.label}>Ide Dasar / Premis</label>
                  <input
                    type="text"
                    placeholder="Contoh: Hewan peliharaan yang memiliki kota mandiri"
                    value={brief.premise_seed}
                    onChange={e => handleBriefChange('premise_seed', e.target.value)}
                    style={modalStyles.input}
                  />
                </div>
              </div>

              <div style={modalStyles.row}>
                <div style={modalStyles.col}>
                  <label style={modalStyles.label}>Jumlah Karakter (1-5)</label>
                  <select
                    value={brief.character_count}
                    onChange={e => handleBriefChange('character_count', e.target.value)}
                    style={modalStyles.select}
                  >
                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div style={modalStyles.col}>
                  <label style={modalStyles.label}>Jumlah Lokasi (1-5)</label>
                  <select
                    value={brief.location_count}
                    onChange={e => handleBriefChange('location_count', e.target.value)}
                    style={modalStyles.select}
                  >
                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              <div style={modalStyles.row}>
                <div style={modalStyles.col}>
                  <label style={modalStyles.label}>Pilar Konten (pisahkan dengan koma)</label>
                  <input
                    type="text"
                    placeholder="Contoh: Nutrisi, Kebersihan, Mainan Edukatif"
                    value={brief.content_pillars}
                    onChange={e => handleBriefChange('content_pillars', e.target.value)}
                    style={modalStyles.input}
                  />
                </div>
                <div style={modalStyles.col}>
                  <label style={modalStyles.label}>Batasan Khusus (Constraints)</label>
                  <input
                    type="text"
                    placeholder="Contoh: Tidak menampilkan manusia"
                    value={brief.special_constraints}
                    onChange={e => handleBriefChange('special_constraints', e.target.value)}
                    style={modalStyles.input}
                  />
                </div>
              </div>

              {isHistorical && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={modalStyles.label}>Periode Historis (Kondisional)</label>
                  <input
                    type="text"
                    placeholder="Contoh: Abad ke-7 sampai abad ke-15"
                    value={brief.historical_period}
                    onChange={e => handleBriefChange('historical_period', e.target.value)}
                    style={modalStyles.input}
                  />
                </div>
              )}

              <div style={{ marginBottom: '24px' }}>
                <label style={modalStyles.label}>Brief Tambahan / Informasi Lain</label>
                <textarea
                  placeholder="Ceritakan sedetail mungkin tentang konsep universe yang kamu inginkan..."
                  rows={4}
                  value={brief.freeform_brief}
                  onChange={e => handleBriefChange('freeform_brief', e.target.value)}
                  style={modalStyles.textarea}
                />
              </div>

              <button
                disabled={!brief.name.trim()}
                onClick={handleGenerate}
                style={{
                  ...modalStyles.primaryButton,
                  opacity: brief.name.trim() ? 1 : 0.6,
                  cursor: brief.name.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                Generate Universe Draft
              </button>
            </div>
          )}

          {/* STEP 2: Generating */}
          {step === 'generating' && (
            <div style={modalStyles.centeredState}>
              <div style={modalStyles.spinner}></div>
              <div style={modalStyles.loadingTitle}>Gemini sedang merancang universe...</div>
              <p style={modalStyles.loadingSubtitle}>
                Gemini sedang menyusun world identity, characters, locations, dan continuity rules…
              </p>
            </div>
          )}

          {/* STEP 3: Review & Refine Draft */}
          {step === 'review' && draft && (
            <div>
              <div style={modalStyles.formSectionTitle}>Tinjau & Edit Konsep Universe</div>

              {draft.profile.universe_type === 'human' && (
                <div style={modalStyles.warningNotice}>
                  <strong>⚠️ Depiction Guardrail Aktif: Human Universe</strong>
                  <div style={{ fontSize: '12px', marginTop: '4px', color: 'var(--text-primary)' }}>
                    Karakter manusia dilarang menampilkan wajah secara penuh (harus faceless, silhouette, back view, atau env-only) untuk menjaga keselarasan konten.
                  </div>
                </div>
              )}

              {/* Accordion Tabs */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                {['profile', 'characters', 'locations'].map(section => (
                  <button
                    key={section}
                    onClick={() => setActiveReviewSection(section)}
                    style={{
                      ...modalStyles.tabButton,
                      background: activeReviewSection === section ? 'var(--status-neutral)' : 'var(--surface-raised)',
                      color: activeReviewSection === section ? 'var(--on-action-primary)' : 'var(--text-secondary)'
                    }}
                  >
                    {section === 'profile' ? '📁 Profile' : section === 'characters' ? '👥 Characters' : '📍 Locations'}
                  </button>
                ))}
              </div>

              {/* Tab: Profile */}
              {activeReviewSection === 'profile' && (
                <div style={modalStyles.card}>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                    Identitas Universe
                  </div>
                  
                  <div style={modalStyles.row}>
                    <div style={modalStyles.col}>
                      <label style={modalStyles.label}>Nama Universe</label>
                      <input
                        type="text"
                        value={draft.profile.name}
                        onChange={e => handleProfileFieldChange('name', e.target.value)}
                        style={modalStyles.input}
                      />
                    </div>
                    <div style={modalStyles.col}>
                      <label style={modalStyles.label}>Slug (Unique)</label>
                      <input
                        type="text"
                        value={draft.profile.slug}
                        onChange={e => handleProfileFieldChange('slug', e.target.value)}
                        style={modalStyles.input}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={modalStyles.label}>Premis Utama</label>
                    <textarea
                      rows={3}
                      value={draft.profile.premise}
                      onChange={e => handleProfileFieldChange('premise', e.target.value)}
                      style={modalStyles.textarea}
                    />
                  </div>

                  <div style={modalStyles.row}>
                    <div style={modalStyles.col}>
                      <label style={modalStyles.label}>Tone / Suasana</label>
                      <input
                        type="text"
                        value={draft.profile.tone}
                        onChange={e => handleProfileFieldChange('tone', e.target.value)}
                        style={modalStyles.input}
                      />
                    </div>
                    <div style={modalStyles.col}>
                      <label style={modalStyles.label}>Gaya Visual Utama</label>
                      <input
                        type="text"
                        value={draft.profile.default_visual_style}
                        onChange={e => handleProfileFieldChange('default_visual_style', e.target.value)}
                        style={modalStyles.input}
                      />
                    </div>
                  </div>

                  {draft.profile.universe_type === 'human' && (
                    <div style={{ marginBottom: '12px' }}>
                      <label style={modalStyles.label}>Kebijakan Penggambaran (Depiction Policy)</label>
                      <textarea
                        rows={2}
                        value={draft.profile.depiction_policy || ''}
                        onChange={e => handleProfileFieldChange('depiction_policy', e.target.value)}
                        style={modalStyles.textarea}
                      />
                    </div>
                  )}

                  <div style={{ marginBottom: '12px' }}>
                    <label style={modalStyles.label}>Kepribadian CTA (Call-to-Action)</label>
                    <input
                      type="text"
                      value={draft.profile.cta_personality}
                      onChange={e => handleProfileFieldChange('cta_personality', e.target.value)}
                      style={modalStyles.input}
                    />
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={modalStyles.label}>Aturan Cerita (Rules JSON) - Anti-Anachronism</label>
                    <input
                      type="text"
                      placeholder="Aturan anti anakronisme"
                      value={draft.profile.rules_json?.anti_anachronism || ''}
                      onChange={e => handleProfileRulesChange('anti_anachronism', e.target.value)}
                      style={modalStyles.input}
                    />
                  </div>
                </div>
              )}

              {/* Tab: Characters */}
              {activeReviewSection === 'characters' && (
                <div>
                  {draft.characters.map((char, index) => (
                    <div key={index} style={modalStyles.card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--status-warning)' }}>👥 Karakter #{index + 1}: {char.name}</div>
                        <button
                          onClick={() => deleteCharacterFromDraft(index)}
                          style={modalStyles.deleteButton}
                          title="Hapus Karakter"
                        >
                          ✕ Hapus
                        </button>
                      </div>

                      <div style={modalStyles.row}>
                        <div style={modalStyles.col}>
                          <label style={modalStyles.label}>Nama Karakter</label>
                          <input
                            type="text"
                            value={char.name}
                            onChange={e => handleCharacterFieldChange(index, 'name', e.target.value)}
                            style={modalStyles.input}
                          />
                        </div>
                        <div style={modalStyles.col}>
                          <label style={modalStyles.label}>Key / Speaker ID (Unik, Lowercase & Underscore)</label>
                          <input
                            type="text"
                            value={char.character_key}
                            onChange={e => handleCharacterFieldChange(index, 'character_key', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                            style={modalStyles.input}
                          />
                        </div>
                      </div>

                      <div style={modalStyles.row}>
                        <div style={modalStyles.col}>
                          <label style={modalStyles.label}>Spesies / Deskripsi Fisik</label>
                          <input
                            type="text"
                            value={char.species || ''}
                            onChange={e => handleCharacterFieldChange(index, 'species', e.target.value)}
                            style={modalStyles.input}
                          />
                        </div>
                        <div style={modalStyles.col}>
                          <label style={modalStyles.label}>Role / Peran</label>
                          <select
                            value={char.role}
                            onChange={e => handleCharacterFieldChange(index, 'role', e.target.value)}
                            style={modalStyles.select}
                          >
                            <option value="main_character">Main Character (Utama)</option>
                            <option value="supporting">Supporting (Pendukung)</option>
                            <option value="observer">Observer (Pengamat)</option>
                          </select>
                        </div>
                      </div>

                      <div style={modalStyles.row}>
                        <div style={modalStyles.col}>
                          <label style={modalStyles.label}>Bentuk Tubuh (Body Shape)</label>
                          <input
                            type="text"
                            value={char.body_shape || ''}
                            onChange={e => handleCharacterFieldChange(index, 'body_shape', e.target.value)}
                            style={modalStyles.input}
                          />
                        </div>
                        <div style={modalStyles.col}>
                          <label style={modalStyles.label}>Pakaian (Wardrobe)</label>
                          <input
                            type="text"
                            value={char.wardrobe || ''}
                            onChange={e => handleCharacterFieldChange(index, 'wardrobe', e.target.value)}
                            style={modalStyles.input}
                          />
                        </div>
                      </div>

                      <div style={modalStyles.row}>
                        <div style={modalStyles.col}>
                          <label style={modalStyles.label}>Ukuran Relatif</label>
                          <select
                            value={char.relative_size}
                            onChange={e => handleCharacterFieldChange(index, 'relative_size', e.target.value)}
                            style={modalStyles.select}
                          >
                            <option value="small">Small (Kecil)</option>
                            <option value="medium">Medium (Sedang)</option>
                            <option value="large">Large (Besar)</option>
                          </select>
                        </div>
                        <div style={modalStyles.col}>
                          <label style={modalStyles.label}>Depiction Mode (Cara Penggambaran)</label>
                          {draft.profile.universe_type === 'human' ? (
                            <select
                              value={char.depiction_mode}
                              onChange={e => handleCharacterFieldChange(index, 'depiction_mode', e.target.value)}
                              style={modalStyles.select}
                            >
                              {FACELESS_MODES.map(mode => (
                                <option key={mode.key} value={mode.key}>{mode.label}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={char.depiction_mode}
                              onChange={e => handleCharacterFieldChange(index, 'depiction_mode', e.target.value)}
                              style={modalStyles.input}
                              disabled
                            />
                          )}
                        </div>
                      </div>

                      <div style={{ marginBottom: '12px' }}>
                        <label style={modalStyles.label}>Canonical Visual Prompt (English Terminology)</label>
                        <textarea
                          rows={2}
                          value={char.canonical_prompt}
                          onChange={e => handleCharacterFieldChange(index, 'canonical_prompt', e.target.value)}
                          style={modalStyles.textarea}
                        />
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={addCharacterToDraft}
                    style={modalStyles.addButton}
                  >
                    ➕ Tambah Karakter Baru
                  </button>
                </div>
              )}

              {/* Tab: Locations */}
              {activeReviewSection === 'locations' && (
                <div>
                  {draft.locations.map((loc, index) => (
                    <div key={index} style={modalStyles.card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--status-info)' }}>📍 Lokasi #{index + 1}: {loc.name}</div>
                        <button
                          onClick={() => deleteLocationFromDraft(index)}
                          style={modalStyles.deleteButton}
                          title="Hapus Lokasi"
                        >
                          ✕ Hapus
                        </button>
                      </div>

                      <div style={modalStyles.row}>
                        <div style={modalStyles.col}>
                          <label style={modalStyles.label}>Nama Lokasi</label>
                          <input
                            type="text"
                            value={loc.name}
                            onChange={e => handleLocationFieldChange(index, 'name', e.target.value)}
                            style={modalStyles.input}
                          />
                        </div>
                        <div style={modalStyles.col}>
                          <label style={modalStyles.label}>Key (Unik, Lowercase & Underscore)</label>
                          <input
                            type="text"
                            value={loc.location_key}
                            onChange={e => handleLocationFieldChange(index, 'location_key', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                            style={modalStyles.input}
                          />
                        </div>
                      </div>

                      <div style={{ marginBottom: '12px' }}>
                        <label style={modalStyles.label}>Props (Peralatan / Objek di Lokasi)</label>
                        <input
                          type="text"
                          value={loc.props || ''}
                          onChange={e => handleLocationFieldChange(index, 'props', e.target.value)}
                          style={modalStyles.input}
                        />
                      </div>

                      <div style={{ marginBottom: '12px' }}>
                        <label style={modalStyles.label}>Deskripsi Visual Lokasi (English Visual Terminology)</label>
                        <textarea
                          rows={3}
                          value={loc.visual_description}
                          onChange={e => handleLocationFieldChange(index, 'visual_description', e.target.value)}
                          style={modalStyles.textarea}
                        />
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={addLocationToDraft}
                    style={modalStyles.addButton}
                  >
                    ➕ Tambah Lokasi Baru
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button
                  onClick={() => setStep('brief')}
                  style={modalStyles.secondaryButton}
                >
                  Back to Brief
                </button>
                <button
                  onClick={handleGenerate}
                  style={modalStyles.secondaryButton}
                >
                  🔄 Regenerate Draft
                </button>
                <button
                  onClick={handleSave}
                  style={modalStyles.primaryButton}
                >
                  Save Universe
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Saving State */}
          {step === 'saving' && (
            <div style={modalStyles.centeredState}>
              <div style={modalStyles.spinner}></div>
              <div style={modalStyles.loadingTitle}>Menyimpan Universe Baru...</div>
              <p style={modalStyles.loadingSubtitle}>
                Sedang memproses penyimpanan profile, karakter, dan lokasi secara atomik ke database.
              </p>
            </div>
          )}

          {/* STEP 5: Success State */}
          {step === 'success' && (
            <div style={modalStyles.centeredState}>
              <div style={modalStyles.successBadge}>✓</div>
              <div style={modalStyles.loadingTitle}>Universe Berhasil Dibuat!</div>
              <p style={modalStyles.loadingSubtitle}>
                Konsep universe buatan AI Anda telah berhasil disimpan dan langsung terintegrasi dengan Content Planner & Campaign.
              </p>
              <button
                onClick={onClose}
                style={modalStyles.primaryButton}
              >
                Selesai & Keluar
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

const modalStyles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'var(--overlay-backdrop)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
    padding: '20px'
  },
  container: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg, 16px)',
    width: '100%',
    maxWidth: '850px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: 'var(--shadow-modal)',
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid var(--border)'
  },
  headerTitle: {
    color: 'var(--text-primary)',
    margin: 0,
    fontSize: '20px',
    fontWeight: 700
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '4px'
  },
  content: {
    padding: '24px',
    overflowY: 'auto',
    flex: 1
  },
  errorBox: {
    background: 'var(--status-danger-soft)',
    border: '1px solid var(--status-danger)',
    borderRadius: 'var(--radius-sm, 8px)',
    padding: '12px 16px',
    margin: '16px 24px 0 24px',
    color: 'var(--status-danger)'
  },
  formSectionTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '20px'
  },
  row: {
    display: 'flex',
    gap: '16px',
    marginBottom: '16px'
  },
  col: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  },
  label: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    marginBottom: '6px',
    fontWeight: 600
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xs, 6px)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none'
  },
  select: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xs, 6px)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none'
  },
  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    minHeight: '120px',
    padding: '10px 12px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xs, 6px)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit'
  },
  warningNotice: {
    background: 'var(--status-warning-soft)',
    border: '1px solid var(--status-warning)',
    borderRadius: 'var(--radius-sm, 8px)',
    padding: '12px',
    marginBottom: '20px',
    color: 'var(--status-warning)'
  },
  tabButton: {
    border: 'none',
    borderRadius: 'var(--radius-xs, 6px)',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all var(--transition)'
  },
  card: {
    background: 'var(--surface-raised)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm, 10px)',
    padding: '18px',
    marginBottom: '16px'
  },
  primaryButton: {
    flex: 1,
    padding: '12px 24px',
    background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
    color: 'var(--on-action-primary)',
    border: 'none',
    borderRadius: 'var(--radius-xs, 6px)',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'center'
  },
  secondaryButton: {
    padding: '12px 24px',
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    borderRadius: 'var(--radius-xs, 6px)',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'center'
  },
  deleteButton: {
    background: 'none',
    border: '1px solid var(--status-danger)',
    color: 'var(--status-danger)',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '11px',
    cursor: 'pointer'
  },
  addButton: {
    width: '100%',
    padding: '12px',
    background: 'var(--surface-raised)',
    border: '1px dashed var(--accent)',
    color: 'var(--accent)',
    borderRadius: 'var(--radius-sm, 8px)',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    marginBottom: '20px',
    transition: 'all var(--transition)'
  },
  centeredState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    textAlign: 'center'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid var(--border-subtle)',
    borderTop: '4px solid var(--accent)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '20px'
  },
  loadingTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '10px'
  },
  loadingSubtitle: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    maxWidth: '450px',
    lineHeight: '1.5',
    margin: 0
  },
  successBadge: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: 'var(--status-success)',
    color: 'var(--on-action-primary)',
    fontSize: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px'
  }
};
