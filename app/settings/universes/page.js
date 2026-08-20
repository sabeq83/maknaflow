'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import AiUniverseBuilderModal from '@/app/components/AiUniverseBuilderModal';

const emptyUniverseForm = {
  name: '',
  slug: '',
  premise: '',
  tone: '',
  knowledge_domain: 'general',
  universe_type: 'animal',
  depiction_policy: '',
  historical_period: '',
  human_presence: 'allowed',
  visual_style: '',
  aspect_ratio: '9:16',
  scene_count: 5,
  scene_duration: 3,
  story_template: '',
  cta_personality: '',
  pillars: []
};

const emptyCharForm = {
  name: '',
  character_key: '',
  species: '',
  breed: '',
  body_shape: '',
  fur_color: '',
  eye_color: '',
  wardrobe: '',
  personality: '',
  movement_style: '',
  relative_size: 'medium',
  role: 'supporting',
  depiction_mode: 'normal',
  reference_type: 'identity',
  historical_period: '',
  canonical_prompt: '',
  reference_image: null
};

const emptyLocForm = {
  name: '',
  location_key: '',
  visual_description: '',
  lighting_default: '',
  props: '',
  historical_period: '',
  reference_type: 'location'
};

// Helpers untuk boundary mapping (API <-> UI Form) (Tahap 3.6)
function mapUniverseRecordToForm(u) {
  return {
    name: u.name || '',
    slug: u.slug || '',
    premise: u.premise || '',
    tone: u.tone || '',
    knowledge_domain: u.knowledge_domain || 'general',
    universe_type: u.universe_type || 'animal',
    depiction_policy: u.depiction_policy || '',
    historical_period: u.historical_period || '',
    human_presence: u.human_presence || 'allowed',
    visual_style: u.default_visual_style ?? u.visual_style ?? '',
    aspect_ratio: u.default_aspect_ratio ?? u.aspect_ratio ?? '9:16',
    scene_count: u.default_scene_count ?? u.scene_count ?? 5,
    scene_duration: u.default_scene_duration ?? u.scene_duration ?? 3,
    story_template: u.default_story_template ?? u.story_template ?? '',
    cta_personality: u.cta_personality || '',
    pillars: (() => {
      const pData = u.default_pillars_json ?? u.pillars ?? [];
      try {
        return typeof pData === 'string' ? JSON.parse(pData) : (pData || []);
      } catch {
        return [];
      }
    })()
  };
}

function mapUniverseFormToPayload(form) {
  return {
    name: form.name,
    slug: form.slug,
    premise: form.premise,
    tone: form.tone,
    knowledge_domain: form.knowledge_domain,
    universe_type: form.universe_type,
    depiction_policy: form.depiction_policy,
    historical_period: form.historical_period,
    human_presence: form.human_presence,
    default_visual_style: form.visual_style,
    default_aspect_ratio: form.aspect_ratio,
    default_scene_count: Number(form.scene_count),
    default_scene_duration: Number(form.scene_duration),
    default_story_template: form.story_template,
    cta_personality: form.cta_personality,
    default_pillars_json: form.pillars
  };
}

export default function UniverseManagerPage() {
  const [user, setUser] = useState(null);
  const [isTenantDisabled, setIsTenantDisabled] = useState(false);
  const [universes, setUniverses] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [locations, setLocations] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [episodeDigest, setEpisodeDigest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('universes'); // universes | characters | locations | episodes
  const [selectedUniverse, setSelectedUniverse] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({ ...emptyUniverseForm });
  const [charFormData, setCharFormData] = useState({ ...emptyCharForm });
  const [locFormData, setLocFormData] = useState({ ...emptyLocForm });

  const [showCharForm, setShowCharForm] = useState(false);
  const [showLocForm, setShowLocForm] = useState(false);
  const [toast, setToast] = useState(null);
  const [pillarDraft, setPillarDraft] = useState('');

  // Tahap 3.6: Preset picker state
  const [showAiBuilder, setShowAiBuilder] = useState(false);
  const [showStarterPicker, setShowStarterPicker] = useState(false);
  const [presets, setPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [pickerMode, setPickerMode] = useState('choice'); // 'choice' | 'grid' | 'preview'
  const [presetNameInput, setPresetNameInput] = useState('');
  const [presetSlugInput, setPresetSlugInput] = useState('');
  const [presetInstantiating, setPresetInstantiating] = useState(false);
  const [presetError, setPresetError] = useState('');

  // States for Character T2I generation
  const [painting, setPainting] = useState(false);
  const [paintingProgress, setPaintingProgress] = useState('');
  const [generatingPrompt, setGeneratingPrompt] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated && data.user) {
          setUser(data.user);
          const tenantDisabled = data.user.role !== 'superadmin' &&
            Array.isArray(data.user.tenantDisabledMenus) &&
            data.user.tenantDisabledMenus.includes('universe_manager');
          const userNotPermitted = data.user.role === 'user' &&
            Array.isArray(data.user.menuPermissions) &&
            !data.user.menuPermissions.includes('universe_manager');
          if (tenantDisabled || userNotPermitted) {
            setIsTenantDisabled(true);
          } else {
            fetchUniverses();
          }
        } else {
          fetchUniverses();
        }
      })
      .catch(err => {
        console.error('[Universe Manager Auth Check Failed]', err);
        fetchUniverses();
      });
  }, []);

  useEffect(() => {
    if (selectedUniverse) {
      if (activeTab === 'characters') fetchCharacters(selectedUniverse.id);
      if (activeTab === 'locations') fetchLocations(selectedUniverse.id);
      if (activeTab === 'episodes') fetchEpisodes(selectedUniverse.id);
    }
  }, [activeTab, selectedUniverse]);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // API Call: Fetch Universes
  async function fetchUniverses() {
    setLoading(true);
    try {
      const res = await fetch('/api/v2/universe-profiles');
      const data = await res.json();
      if (data.success || data.data) {
        setUniverses(data.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const fetchPresets = async () => {
    try {
      const res = await fetch('/api/v2/universe-presets');
      const json = await res.json();
      if (json.success) setPresets(json.data);
    } catch (e) {
      console.error('Failed to fetch presets:', e);
    }
  };

  // API Call: Fetch Characters
  async function fetchCharacters(universeId) {
    try {
      const res = await fetch(`/api/v2/universe-profiles/${universeId}/characters`);
      const data = await res.json();
      setCharacters(data.data || []);
    } catch (e) {
      console.error(e);
    }
  }

  const pollGlabsImage = async (taskId) => {
    setPainting(true);
    setPaintingProgress('Tugas lukis diajukan...');
    let attempts = 0;
    const maxAttempts = 60; // 5 menit maks

    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        alert('Tugas lukis gambar AI melebihi batas waktu (timeout). Silakan coba lagi.');
        setPainting(false);
        setPaintingProgress('');
        return;
      }

      try {
        const res = await fetch(`/api/webhook/status?task_id=${taskId}`);
        const data = await res.json();

        if (data.success && data.data) {
          const taskStatus = (data.data.status || '').toLowerCase();
          setPaintingProgress(`Status lukis: ${taskStatus}...`);

          if (taskStatus === 'completed') {
            clearInterval(interval);
            const urls = data.data.results || data.data.files || [];
            const imageUrl = urls.find(u => u.endsWith('.png') || u.endsWith('.jpg') || u.endsWith('.jpeg') || u.endsWith('.webp')) || urls[0];

            if (imageUrl) {
              setCharFormData(prev => ({ ...prev, reference_image: imageUrl }));
              setToast({ type: 'success', message: 'Karakter berhasil dilukis!' });
            } else {
              alert('Gagal mendapatkan file hasil lukis.');
            }
            setPainting(false);
            setPaintingProgress('');
          } else if (taskStatus === 'failed') {
            clearInterval(interval);
            alert('Proses lukis gagal: ' + (data.data.error || 'Terjadi kesalahan sistem'));
            setPainting(false);
            setPaintingProgress('');
          }
        }
      } catch (err) {
        console.error('Polling status error:', err);
      }
    }, 5000);
  };

  // API Call: Fetch Locations
  async function fetchLocations(universeId) {
    try {
      const res = await fetch(`/api/v2/universe-profiles/${universeId}/locations`);
      const data = await res.json();
      setLocations(data.data || []);
    } catch (e) {
      console.error(e);
    }
  }

  // API Call: Fetch Episodes
  async function fetchEpisodes(universeId) {
    try {
      const res = await fetch(`/api/v2/universe-profiles/${universeId}/episodes`);
      const data = await res.json();
      setEpisodes(data.data || []);
      if (data.digest) setEpisodeDigest(data.digest);
    } catch (e) {
      console.error(e);
    }
  }

  // Generate Slug
  function generateSlug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  // Form Handlers: Universe
  function handleUniverseChange(e) {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'name' && !editingId) {
        updated.slug = generateSlug(value);
      }
      return updated;
    });
  }

  function addPillar() {
    const value = pillarDraft.trim();
    if (!value) return;
    if (!formData.pillars.includes(value)) {
      setFormData(prev => ({ ...prev, pillars: [...prev.pillars, value] }));
    }
    setPillarDraft('');
  }

  function removePillar(index) {
    setFormData(prev => ({
      ...prev,
      pillars: prev.pillars.filter((_, i) => i !== index)
    }));
  }

  async function handleUniverseSave(e) {
    e.preventDefault();
    if (!formData.visual_style || !formData.visual_style.trim()) {
      showToast('Visual Style is required.', 'error');
      return;
    }
    try {
      const url = editingId
        ? `/api/v2/universe-profiles/${editingId}`
        : '/api/v2/universe-profiles';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mapUniverseFormToPayload(formData))
      });

      if (!res.ok) throw new Error('Failed to save universe');

      showToast(editingId ? 'Universe updated' : 'Universe created');
      setShowForm(false);
      setEditingId(null);
      setFormData({ ...emptyUniverseForm });
      fetchUniverses();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleUniverseArchive(id) {
    if (!confirm('Are you sure you want to archive this universe?')) return;
    try {
      const res = await fetch(`/api/v2/universe-profiles/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to archive');
      showToast('Universe archived');
      fetchUniverses();
      if (selectedUniverse?.id === id) {
        setSelectedUniverse(null);
        setActiveTab('universes');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Form Handlers: Characters
  function handleCharChange(e) {
    const { name, value } = e.target;
    setCharFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'name' && !editingId) {
        updated.character_key = generateSlug(value);
      }
      return updated;
    });
  }

  function handleCharFileChange(e) {
    setCharFormData(prev => ({ ...prev, reference_image: e.target.files[0] }));
  }

  async function handleCharSave(e) {
    e.preventDefault();
    try {
      const fd = new FormData();
      Object.keys(charFormData).forEach(key => {
        if (charFormData[key] !== null && charFormData[key] !== undefined) {
          fd.append(key, charFormData[key]);
        }
      });

      const url = editingId
        ? `/api/v2/universe-profiles/${selectedUniverse.id}/characters/${editingId}`
        : `/api/v2/universe-profiles/${selectedUniverse.id}/characters`;
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, { method, body: fd });
      if (!res.ok) throw new Error('Failed to save character');

      showToast('Character saved');
      setShowCharForm(false);
      setEditingId(null);
      setCharFormData({ ...emptyCharForm });
      fetchCharacters(selectedUniverse.id);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleCharDelete(id) {
    if (!confirm('Delete this character?')) return;
    try {
      const res = await fetch(`/api/v2/universe-profiles/${selectedUniverse.id}/characters/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete character');
      showToast('Character deleted');
      fetchCharacters(selectedUniverse.id);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Form Handlers: Locations
  function handleLocChange(e) {
    const { name, value } = e.target;
    setLocFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'name' && !editingId) {
        updated.location_key = generateSlug(value);
      }
      return updated;
    });
  }

  async function handleLocSave(e) {
    e.preventDefault();
    try {
      const url = editingId
        ? `/api/v2/universe-profiles/${selectedUniverse.id}/locations/${editingId}`
        : `/api/v2/universe-profiles/${selectedUniverse.id}/locations`;
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locFormData)
      });
      if (!res.ok) throw new Error('Failed to save location');

      showToast('Location saved');
      setShowLocForm(false);
      setEditingId(null);
      setLocFormData({ ...emptyLocForm });
      fetchLocations(selectedUniverse.id);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleLocDelete(id) {
    if (!confirm('Delete this location?')) return;
    try {
      const res = await fetch(`/api/v2/universe-profiles/${selectedUniverse.id}/locations/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete location');
      showToast('Location deleted');
      fetchLocations(selectedUniverse.id);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-container">
        <div className="page-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title" style={{ margin: 0, fontSize: '24px' }}>🏰 Universe Manager</h1>
            <p className="page-subtitle" style={{ color: 'var(--status-neutral)', margin: '8px 0 0' }}>Define and manage your rich, consistent story universes.</p>
          </div>
          {!isTenantDisabled && activeTab === 'universes' && (
            <button className="btn btn-primary" style={{ backgroundColor: 'var(--status-neutral)', color: 'var(--text-primary)', border: 'none', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer' }} onClick={() => { fetchPresets(); setShowStarterPicker(true); setPickerMode('choice'); setSelectedPreset(null); setPresetNameInput(''); setPresetSlugInput(''); setPresetError(''); }}>
              + New Universe
            </button>
          )}
        </div>

        {isTenantDisabled ? (
          <div style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(220, 38, 38, 0.03))',
            border: '1px solid var(--status-danger-soft)',
            borderRadius: '12px',
            padding: '48px 24px',
            textAlign: 'center',
            marginTop: '32px'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--status-danger)', margin: '0 0 8px' }}>
              Modul Dinonaktifkan
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '520px', margin: '0 auto 20px', lineHeight: 1.6 }}>
              Modul <strong>Universe Manager</strong> saat ini dinonaktifkan oleh Superadmin untuk organisasi/tenant Anda, atau Anda tidak memiliki izin akses untuk modul ini.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
              Silakan hubungi Superadmin platform untuk mengaktifkan modul ini bagi tenant Anda.
            </p>
          </div>
        ) : (
          <>

        {toast && (
          <div style={{ position: 'fixed', top: '20px', right: '20px', backgroundColor: toast.type === 'error' ? 'var(--status-danger)' : 'var(--status-success)', color: 'var(--text-primary)', padding: '12px 20px', borderRadius: '4px', zIndex: 1000 }}>
            {toast.msg}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--surface)', paddingBottom: '12px' }}>
          <button onClick={() => setActiveTab('universes')} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', backgroundColor: activeTab === 'universes' ? 'var(--status-neutral)' : 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer' }}>Universes</button>
          {selectedUniverse && (
            <>
              <button onClick={() => setActiveTab('characters')} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', backgroundColor: activeTab === 'characters' ? 'var(--status-neutral)' : 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer' }}>Characters ({selectedUniverse.name})</button>
              <button onClick={() => setActiveTab('locations')} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', backgroundColor: activeTab === 'locations' ? 'var(--status-neutral)' : 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer' }}>Locations</button>
              <button onClick={() => setActiveTab('episodes')} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', backgroundColor: activeTab === 'episodes' ? 'var(--status-neutral)' : 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer' }}>Episodes</button>
            </>
          )}
        </div>

        {/* Tab 1: Universes */}
        {activeTab === 'universes' && (
          <>
            {showForm && (
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '24px', borderRadius: '8px', marginBottom: '24px' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px' }}>{editingId ? 'Edit Universe' : 'Create Universe'}</h3>
                <form onSubmit={handleUniverseSave} style={{ display: 'grid', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Name *</label>
                      <input required name="name" value={formData.name} onChange={handleUniverseChange} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Slug *</label>
                      <input required name="slug" value={formData.slug} onChange={handleUniverseChange} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Premise *</label>
                    <textarea required name="premise" value={formData.premise} onChange={handleUniverseChange} rows="3" style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Tone</label>
                      <input name="tone" value={formData.tone} onChange={handleUniverseChange} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Knowledge Domain</label>
                      <select name="knowledge_domain" value={formData.knowledge_domain} onChange={handleUniverseChange} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }}>
                        <option value="general">General</option>
                        <option value="pet_supplies">Pet Supplies</option>
                        <option value="food_culinary">Food &amp; Culinary</option>
                        <option value="history">History</option>
                        <option value="islamic_history">Islamic History</option>
                        <option value="kitchen">Kitchen</option>
                        <option value="home_improvement">Home Improvement</option>
                        <option value="herbal">Herbal</option>
                      </select>
                    </div>
                    <div>
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>Universe Type</label>
                        <select
                          value={formData.universe_type || 'animal'}
                          onChange={e => setFormData(f => ({ ...f, universe_type: e.target.value }))}
                          style={{ width: '100%', padding: '8px', background: 'var(--bg-secondary)', color: '#e0e0ff', border: '1px solid var(--surface-interactive)', borderRadius: '6px' }}
                        >
                          <option value="animal">🐾 Animal</option>
                          <option value="mascot_object">🎭 Mascot / Object</option>
                          <option value="human">👤 Human</option>
                        </select>
                      </div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Human Presence</label>
                      <select name="human_presence" value={formData.human_presence} onChange={handleUniverseChange} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }}>
                        <option value="allowed">Allowed</option>
                        <option value="faceless_only">Faceless Only</option>
                        <option value="none">None</option>
                      </select>
                      {formData.universe_type === 'human' && (
                        <>
                          <div style={{ marginBottom: '12px', marginTop: '12px' }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>Historical Period</label>
                            <input
                              type="text"
                              value={formData.historical_period || ''}
                              onChange={e => setFormData(f => ({ ...f, historical_period: e.target.value }))}
                              placeholder="e.g. Abad ke-7 sampai abad ke-15"
                              style={{ width: '100%', padding: '8px', background: 'var(--bg-secondary)', color: '#e0e0ff', border: '1px solid var(--surface-interactive)', borderRadius: '6px', boxSizing: 'border-box' }}
                            />
                          </div>
                          <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>Depiction Policy</label>
                            <textarea
                              value={formData.depiction_policy || ''}
                              onChange={e => setFormData(f => ({ ...f, depiction_policy: e.target.value }))}
                              placeholder="Aturan penggambaran karakter sensitif, larangan, dan panduan representasi..."
                              rows={4}
                              style={{ width: '100%', padding: '8px', background: 'var(--bg-secondary)', color: '#e0e0ff', border: '1px solid var(--surface-interactive)', borderRadius: '6px', resize: 'vertical', boxSizing: 'border-box' }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Visual Style *</label>
                    <textarea required name="visual_style" value={formData.visual_style} onChange={handleUniverseChange} rows="2" style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Aspect Ratio</label>
                      <select name="aspect_ratio" value={formData.aspect_ratio} onChange={handleUniverseChange} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }}>
                        <option value="9:16">9:16</option>
                        <option value="16:9">16:9</option>
                        <option value="1:1">1:1</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Scene Count</label>
                      <input type="number" name="scene_count" value={formData.scene_count} onChange={handleUniverseChange} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Scene Duration (sec)</label>
                      <input type="number" name="scene_duration" value={formData.scene_duration} onChange={handleUniverseChange} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Story Template</label>
                    <textarea name="story_template" value={formData.story_template} onChange={handleUniverseChange} rows="2" style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>CTA Personality</label>
                    <input name="cta_personality" value={formData.cta_personality} onChange={handleUniverseChange} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Pillars</label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <input value={pillarDraft} onChange={e => setPillarDraft(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); addPillar(); } }} placeholder="Add pillar..." style={{ flex: 1, padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                      <button type="button" onClick={addPillar} style={{ padding: '10px 16px', backgroundColor: '#34495e', color: 'var(--text-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Add</button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {formData.pillars.map((pillar, idx) => (
                        <span key={idx} style={{ backgroundColor: 'var(--border)', padding: '4px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                          {pillar}
                          <button type="button" onClick={() => removePillar(idx)} style={{ background: 'none', border: 'none', color: 'var(--status-danger)', cursor: 'pointer' }}>✕</button>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button type="submit" style={{ backgroundColor: 'var(--status-neutral)', color: 'var(--text-primary)', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer' }}>Save Universe</button>
                    <button type="button" onClick={() => setShowForm(false)} style={{ backgroundColor: '#34495e', color: 'var(--text-primary)', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </form>
              </div>
            )}

            <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', overflow: 'hidden' }}>
              <table className="ideas-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--surface)' }}>
                    <th style={{ padding: '16px' }}>Name</th>
                    <th style={{ padding: '16px' }}>Slug</th>
                    <th style={{ padding: '16px' }}>Visual Style</th>
                    <th style={{ padding: '16px' }}>Scenes</th>
                    <th style={{ padding: '16px' }}>Status</th>
                    <th style={{ padding: '16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {universes.length === 0 ? (
                    <tr><td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: '#7f8c8d' }}>No universes found.</td></tr>
                  ) : universes.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--surface)' }}>
                      <td style={{ padding: '16px', fontWeight: 'bold' }}>{u.name}</td>
                      <td style={{ padding: '16px', color: 'var(--status-neutral)' }}>{u.slug}</td>
                      <td style={{ padding: '16px', color: 'var(--text-secondary)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.default_visual_style || u.visual_style || ''}</td>
                      <td style={{ padding: '16px' }}>{u.default_scene_count ?? u.scene_count ?? 5}</td>
                      <td style={{ padding: '16px' }}>
                        <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', backgroundColor: u.status === 'active' || !u.status ? '#27ae60' : '#7f8c8d' }}>
                          {u.status === 'active' || !u.status ? 'Active' : 'Archived'}
                        </span>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => { setSelectedUniverse(u); setActiveTab('characters'); }} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--status-neutral)', backgroundColor: 'transparent', color: 'var(--status-neutral)', cursor: 'pointer' }}>Manage</button>
                        <button onClick={() => {
                          setEditingId(u.id);
                          setFormData(mapUniverseRecordToForm(u));
                          setShowForm(true);
                        }} style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--status-info)', color: 'var(--text-primary)', cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => handleUniverseArchive(u.id)} style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--status-danger)', color: 'var(--text-primary)', cursor: 'pointer' }}>Archive</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedUniverse && (
              <div style={{ marginTop: '24px', backgroundColor: 'var(--bg-secondary)', padding: '24px', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 16px 0', color: 'var(--status-neutral)' }}>Preview: {selectedUniverse.name}</h4>
                <p style={{ margin: '0 0 8px', fontSize: '14px', color: 'var(--text-secondary)' }}><strong>Premise:</strong> {selectedUniverse.premise}</p>
                <p style={{ margin: '0 0 8px', fontSize: '14px', color: 'var(--text-secondary)' }}><strong>Format:</strong> {selectedUniverse.scene_count} scenes x {selectedUniverse.scene_duration}s ({selectedUniverse.aspect_ratio})</p>
                <p style={{ margin: '0 0 8px', fontSize: '14px', color: 'var(--text-secondary)' }}><strong>Tone:</strong> {selectedUniverse.tone}</p>
              </div>
            )}
          </>
        )}

        {/* Tab 2: Characters */}
        {activeTab === 'characters' && selectedUniverse && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
               <button className="btn btn-primary" onClick={() => { setShowCharForm(!showCharForm); setEditingId(null); setCharFormData({ ...emptyCharForm }); }} style={{ backgroundColor: 'var(--status-neutral)', color: 'var(--text-primary)', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                {showCharForm ? '✕ Close Form' : '+ New Character'}
              </button>
            </div>

            {showCharForm && (
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '24px', borderRadius: '8px', marginBottom: '24px' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px' }}>{editingId ? 'Edit Character' : 'Create Character'}</h3>
                <form onSubmit={handleCharSave} style={{ display: 'grid', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Name *</label>
                      <input required name="name" value={charFormData.name} onChange={handleCharChange} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Character Key *</label>
                      <input required name="character_key" value={charFormData.character_key} onChange={handleCharChange} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Species</label>
                      <input name="species" value={charFormData.species} onChange={handleCharChange} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Breed</label>
                      <input name="breed" value={charFormData.breed} onChange={handleCharChange} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Role</label>
                      <select name="role" value={charFormData.role} onChange={handleCharChange} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }}>
                        <option value="main_character">Main Character</option>
                        <option value="observer">Observer</option>
                        <option value="first_observer">First Observer</option>
                        <option value="builder_helper">Builder Helper</option>
                        <option value="assembler_helper">Assembler Helper</option>
                        <option value="supporting">Supporting</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Body Shape</label>
                      <input name="body_shape" value={charFormData.body_shape} onChange={handleCharChange} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Fur Color</label>
                      <input name="fur_color" value={charFormData.fur_color} onChange={handleCharChange} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Eye Color</label>
                      <input name="eye_color" value={charFormData.eye_color} onChange={handleCharChange} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Wardrobe</label>
                    <input name="wardrobe" value={charFormData.wardrobe} onChange={handleCharChange} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Personality</label>
                      <input name="personality" value={charFormData.personality} onChange={handleCharChange} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Movement Style</label>
                      <input name="movement_style" value={charFormData.movement_style} onChange={handleCharChange} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Relative Size</label>
                      <select name="relative_size" value={charFormData.relative_size} onChange={handleCharChange} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }}>
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>Depiction Mode</label>
                      <select
                        value={charFormData.depiction_mode || 'normal'}
                        onChange={e => setCharFormData(f => ({ ...f, depiction_mode: e.target.value }))}
                        style={{ width: '100%', padding: '8px', background: 'var(--bg-secondary)', color: '#e0e0ff', border: '1px solid var(--surface-interactive)', borderRadius: '6px' }}
                      >
                        <option value="normal">Normal</option>
                        <option value="faceless">Faceless</option>
                        <option value="back_view">Back View</option>
                        <option value="silhouette">Silhouette</option>
                        <option value="environment_only">Environment Only</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>Reference Type</label>
                      <select
                        value={charFormData.reference_type || 'identity'}
                        onChange={e => setCharFormData(f => ({ ...f, reference_type: e.target.value }))}
                        style={{ width: '100%', padding: '8px', background: 'var(--bg-secondary)', color: '#e0e0ff', border: '1px solid var(--surface-interactive)', borderRadius: '6px' }}
                      >
                        <option value="identity">Identity</option>
                        <option value="wardrobe">Wardrobe</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>Historical Period (opsional)</label>
                    <input
                      type="text"
                      value={charFormData.historical_period || ''}
                      onChange={e => setCharFormData(f => ({ ...f, historical_period: e.target.value }))}
                      placeholder="e.g. Abad ke-7 sampai abad ke-15"
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-secondary)', color: '#e0e0ff', border: '1px solid var(--surface-interactive)', borderRadius: '6px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '14px', fontWeight: 600 }}>Canonical Prompt (T2I)</label>
                      <button
                        type="button"
                        disabled={generatingPrompt}
                        onClick={async () => {
                          setGeneratingPrompt(true);
                          try {
                            const res = await fetch(`/api/v2/universe-profiles/${selectedUniverse.id}/characters/suggest-prompt`, {
                              method: 'POST',
                              headers: { 'content-type': 'application/json' },
                              body: JSON.stringify({
                                character: charFormData,
                                visual_style: selectedUniverse.default_visual_style
                              })
                            });
                            const data = await res.json();
                            if (data.success) {
                              setCharFormData(prev => ({ ...prev, canonical_prompt: data.prompt }));
                            } else {
                              alert('Gagal membuat prompt: ' + data.error);
                            }
                          } catch (err) {
                            alert('Error: ' + err.message);
                          } finally {
                            setGeneratingPrompt(false);
                          }
                        }}
                        style={{ padding: '4px 10px', fontSize: '12px', border: 'none', borderRadius: '4px', backgroundColor: 'var(--status-info)', color: 'var(--text-primary)', cursor: 'pointer', opacity: generatingPrompt ? 0.6 : 1 }}
                      >
                        {generatingPrompt ? '⏳ Menulis...' : '✨ Auto-Write Prompt'}
                      </button>
                    </div>
                    <textarea name="canonical_prompt" value={charFormData.canonical_prompt} onChange={handleCharChange} rows="3" style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                  </div>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 600 }}>Reference Image</label>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <input type="file" onChange={handleCharFileChange} style={{ color: 'var(--text-secondary)', flex: 1 }} />
                      <button
                        type="button"
                        disabled={painting || !charFormData.canonical_prompt}
                        onClick={async () => {
                          setPainting(true);
                          setPaintingProgress('Memulai G-Labs T2I...');
                          try {
                            const res = await fetch('/api/webhook/generate', {
                              method: 'POST',
                              headers: { 'content-type': 'application/json' },
                              body: JSON.stringify({
                                type: 'image',
                                prompt: charFormData.canonical_prompt,
                                aspect_ratio: '1:1'
                              })
                            });
                            const data = await res.json();
                            if (data.success && data.data?.task_id) {
                              pollGlabsImage(data.data.task_id);
                            } else {
                              alert('Gagal memulai tugas lukis: ' + (data.error || 'Server offline'));
                              setPainting(false);
                              setPaintingProgress('');
                            }
                          } catch (err) {
                            alert('Error: ' + err.message);
                            setPainting(false);
                            setPaintingProgress('');
                          }
                        }}
                        style={{ padding: '8px 14px', border: 'none', borderRadius: '6px', backgroundColor: 'var(--status-neutral)', color: 'var(--text-primary)', cursor: 'pointer', opacity: (!charFormData.canonical_prompt || painting) ? 0.6 : 1 }}
                      >
                        {painting ? '⏳ Lukis...' : '🎨 Paint Image (AI)'}
                      </button>
                    </div>
                    {paintingProgress && (
                      <div style={{ fontSize: '12px', color: 'var(--status-warning)', fontWeight: 600 }}>
                        {paintingProgress}
                      </div>
                    )}
                    {(charFormData.reference_image || charFormData.reference_image_path) && (
                      <div style={{ marginTop: '8px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Preview / Gambar Terpilih:</div>
                        <img src={charFormData.reference_image || charFormData.reference_image_path} alt="Preview" style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border)' }} />
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                    <button type="submit" disabled={painting} style={{ backgroundColor: 'var(--status-neutral)', color: 'var(--text-primary)', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer', opacity: painting ? 0.6 : 1 }}>Save Character</button>
                    <button type="button" onClick={() => setShowCharForm(false)} style={{ backgroundColor: '#34495e', color: 'var(--text-primary)', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </form>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {characters.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', color: '#7f8c8d' }}>No characters found.</div>
              ) : characters.map(c => (
                <div key={c.id} style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--surface)' }}>
                  <div style={{ height: '160px', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--surface)' }}>
                    {c.reference_image_url || c.reference_image_path ? (
                      <img src={c.reference_image_url || c.reference_image_path} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '48px' }}>🐾</span>
                    )}
                  </div>
                  <div style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <h4 style={{ margin: 0, fontSize: '18px' }}>{c.name}</h4>
                      <span style={{ backgroundColor: 'var(--status-neutral)', fontSize: '10px', padding: '2px 6px', borderRadius: '10px' }}>v{c.version || 1}</span>
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                      <span style={{ display: 'inline-block', backgroundColor: 'var(--border)', fontSize: '12px', padding: '4px 8px', borderRadius: '4px', marginBottom: '4px' }}>{c.role}</span>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>{c.species} • {c.breed}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => {
                        setEditingId(c.id);
                        setCharFormData({
                          name: c.name || '', character_key: c.character_key || '', species: c.species || '', breed: c.breed || '',
                          body_shape: c.body_shape || '', fur_color: c.fur_color || '', eye_color: c.eye_color || '', wardrobe: c.wardrobe || '',
                          personality: c.personality || '', movement_style: c.movement_style || '', relative_size: c.relative_size || 'medium',
                          role: c.role || 'supporting', canonical_prompt: c.canonical_prompt || '', reference_image: null,
                          depiction_mode: c.depiction_mode || 'normal', reference_type: c.reference_type || 'identity', historical_period: c.historical_period || ''
                        });
                        setShowCharForm(true);
                      }} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--status-info)', color: 'var(--text-primary)', cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => handleCharDelete(c.id)} style={{ padding: '8px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--status-danger)', color: 'var(--text-primary)', cursor: 'pointer' }}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Locations */}
        {activeTab === 'locations' && selectedUniverse && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
              <button className="btn btn-primary" onClick={() => { setShowLocForm(!showLocForm); setEditingId(null); setLocFormData({ ...emptyLocForm }); }} style={{ backgroundColor: 'var(--status-neutral)', color: 'var(--text-primary)', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                {showLocForm ? '✕ Close Form' : '+ New Location'}
              </button>
            </div>

            {showLocForm && (
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '24px', borderRadius: '8px', marginBottom: '24px' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px' }}>{editingId ? 'Edit Location' : 'Create Location'}</h3>
                <form onSubmit={handleLocSave} style={{ display: 'grid', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Name *</label>
                      <input required name="name" value={locFormData.name} onChange={handleLocChange} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Location Key *</label>
                      <input required name="location_key" value={locFormData.location_key} onChange={handleLocChange} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Visual Description *</label>
                    <textarea required name="visual_description" value={locFormData.visual_description} onChange={handleLocChange} rows="3" style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Lighting Default</label>
                      <input name="lighting_default" value={locFormData.lighting_default} onChange={handleLocChange} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Props</label>
                      <input name="props" value={locFormData.props} onChange={handleLocChange} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--surface)', color: 'var(--text-primary)', borderRadius: '4px' }} placeholder="Comma separated" />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>Historical Period (opsional)</label>
                      <input
                        type="text"
                        value={locFormData.historical_period || ''}
                        onChange={e => setLocFormData(f => ({ ...f, historical_period: e.target.value }))}
                        placeholder="e.g. Abad ke-7 sampai abad ke-15"
                        style={{ width: '100%', padding: '8px', background: 'var(--bg-secondary)', color: '#e0e0ff', border: '1px solid var(--surface-interactive)', borderRadius: '6px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>Reference Type</label>
                      <select
                        value={locFormData.reference_type || 'location'}
                        onChange={e => setLocFormData(f => ({ ...f, reference_type: e.target.value }))}
                        style={{ width: '100%', padding: '8px', background: 'var(--bg-secondary)', color: '#e0e0ff', border: '1px solid var(--surface-interactive)', borderRadius: '6px' }}
                      >
                        <option value="location">Location</option>
                        <option value="visual_style">Visual Style</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <button type="submit" style={{ backgroundColor: 'var(--status-neutral)', color: 'var(--text-primary)', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer' }}>Save Location</button>
                    <button type="button" onClick={() => setShowLocForm(false)} style={{ backgroundColor: '#34495e', color: 'var(--text-primary)', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </form>
              </div>
            )}

            <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', overflow: 'hidden' }}>
              <table className="ideas-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--surface)' }}>
                    <th style={{ padding: '16px' }}>Name</th>
                    <th style={{ padding: '16px' }}>Key</th>
                    <th style={{ padding: '16px' }}>Lighting</th>
                    <th style={{ padding: '16px' }}>Version</th>
                    <th style={{ padding: '16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.length === 0 ? (
                    <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#7f8c8d' }}>No locations found.</td></tr>
                  ) : locations.map(l => (
                    <tr key={l.id} style={{ borderBottom: '1px solid var(--surface)' }}>
                      <td style={{ padding: '16px', fontWeight: 'bold' }}>{l.name}</td>
                      <td style={{ padding: '16px', color: 'var(--status-neutral)' }}>{l.location_key}</td>
                      <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{l.lighting_default}</td>
                      <td style={{ padding: '16px' }}>v{l.version || 1}</td>
                      <td style={{ padding: '16px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => {
                          setEditingId(l.id);
                          setLocFormData({
                            name: l.name || '', location_key: l.location_key || '', visual_description: l.visual_description || '',
                            lighting_default: l.lighting_default || '', props: l.props || '',
                            historical_period: l.historical_period || '', reference_type: l.reference_type || 'location'
                          });
                          setShowLocForm(true);
                        }} style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--status-info)', color: 'var(--text-primary)', cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => handleLocDelete(l.id)} style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--status-danger)', color: 'var(--text-primary)', cursor: 'pointer' }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Episodes */}
        {activeTab === 'episodes' && selectedUniverse && (
          <div>
            {episodeDigest && (
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '24px', borderRadius: '8px', marginBottom: '24px', border: '1px solid var(--status-neutral)' }}>
                <h4 style={{ margin: '0 0 16px 0', color: 'var(--status-neutral)' }}>Anti-Repetition Digest Summary</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div>
                    <strong style={{ display: 'block', marginBottom: '8px' }}>Used Products</strong>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                      {Object.entries(episodeDigest.products || {}).map(([p, count]) => (
                        <li key={p}>{p} ({count})</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <strong style={{ display: 'block', marginBottom: '8px' }}>Addressed Problems</strong>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                      {Object.entries(episodeDigest.problems || {}).map(([p, count]) => (
                        <li key={p}>{p} ({count})</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <strong style={{ display: 'block', marginBottom: '8px' }}>Used Hooks</strong>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                      {Object.entries(episodeDigest.hooks || {}).map(([h, count]) => (
                        <li key={h}>{h} ({count})</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', overflow: 'hidden' }}>
              <table className="ideas-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--surface)' }}>
                    <th style={{ padding: '16px' }}>Date</th>
                    <th style={{ padding: '16px' }}>Main Character</th>
                    <th style={{ padding: '16px' }}>Product</th>
                    <th style={{ padding: '16px' }}>Problem</th>
                    <th style={{ padding: '16px' }}>Hook</th>
                    <th style={{ padding: '16px' }}>Location</th>
                    <th style={{ padding: '16px' }}>CTA</th>
                  </tr>
                </thead>
                <tbody>
                  {episodes.length === 0 ? (
                    <tr><td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: '#7f8c8d' }}>No episodes generated yet.</td></tr>
                  ) : episodes.map(e => (
                    <tr key={e.id} style={{ borderBottom: '1px solid var(--surface)' }}>
                      <td style={{ padding: '16px', fontSize: '14px' }}>{new Date(e.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '16px', fontSize: '14px', color: 'var(--status-neutral)' }}>{e.main_character}</td>
                      <td style={{ padding: '16px', fontSize: '14px' }}>{e.product}</td>
                      <td style={{ padding: '16px', fontSize: '14px' }}>{e.problem}</td>
                      <td style={{ padding: '16px', fontSize: '14px' }}>{e.hook}</td>
                      <td style={{ padding: '16px', fontSize: '14px' }}>{e.location}</td>
                      <td style={{ padding: '16px', fontSize: '14px' }}>{e.cta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tahap 3.6: Starter Picker Modal */}
        {showStarterPicker && (
          <div style={{
            position: 'fixed', inset: 0, background: 'var(--overlay-backdrop)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '20px'
          }}>
            <div style={{
              background: 'var(--bg-secondary)', borderRadius: '16px', padding: '32px',
              width: '100%', maxWidth: '800px', maxHeight: '90vh',
              overflowY: 'auto', border: '1px solid #2d2d4e'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ color: '#e0e0ff', margin: 0, fontSize: '20px' }}>✨ Buat Universe Baru</h2>
                <button onClick={() => setShowStarterPicker(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}>✕</button>
              </div>

              {/* Mode: choice */}
              {pickerMode === 'choice' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <button
                    onClick={() => { setShowStarterPicker(false); setShowAiBuilder(true); }}
                    style={{
                      background: 'linear-gradient(135deg, #1b5e20, #2e7d32)', color: '#ffffff',
                      border: 'none', borderRadius: '12px', padding: '28px 20px',
                      cursor: 'pointer', textAlign: 'left'
                    }}>
                    <div style={{ fontSize: '32px', marginBottom: '12px' }}>✨</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Build with AI</div>
                    <div style={{ fontSize: '13px', opacity: 0.9 }}>Buat universe lengkap secara otomatis menggunakan AI Gemini. <span style={{ background: '#4caf50', borderRadius: '4px', padding: '1px 5px', fontSize: '10px', color: '#121212', fontWeight: 'bold', marginLeft: '4px' }}>Recommended</span></div>
                  </button>
                  <button
                    onClick={() => setPickerMode('grid')}
                    style={{
                      background: 'linear-gradient(135deg, var(--status-neutral, #4c4c70), var(--status-neutral, #4c4c70))', color: 'var(--text-primary, #e0e0ff)',
                      border: 'none', borderRadius: '12px', padding: '28px 20px',
                      cursor: 'pointer', textAlign: 'left'
                    }}>
                    <div style={{ fontSize: '32px', marginBottom: '12px' }}>📦</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Use a Preset</div>
                    <div style={{ fontSize: '13px', opacity: 0.85 }}>Mulai dari 6 template siap pakai — lengkap dengan karakter dan lokasi starter.</div>
                  </button>
                  <button
                    onClick={() => { setShowStarterPicker(false); setShowForm(true); setEditingId(null); setFormData({ ...emptyUniverseForm }); }}
                    style={{
                      background: '#2d2d4e', color: '#e0e0ff',
                      border: '1px solid #3d3d6e', borderRadius: '12px', padding: '28px 20px',
                      cursor: 'pointer', textAlign: 'left'
                    }}>
                    <div style={{ fontSize: '32px', marginBottom: '12px' }}>📝</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Manual Setup</div>
                    <div style={{ fontSize: '13px', opacity: 0.75 }}>Isi semua field secara manual. Cocok jika kamu punya konsep universe sendiri.</div>
                  </button>
                </div>
              )}

              {/* Mode: grid — 6 preset cards */}
              {pickerMode === 'grid' && (
                <div>
                  <button onClick={() => setPickerMode('choice')}
                    style={{ background: 'none', border: 'none', color: 'var(--status-neutral)', cursor: 'pointer', marginBottom: '16px', fontSize: '13px' }}>← Kembali</button>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                    {presets.map(p => (
                      <button key={p.key} onClick={() => { setSelectedPreset(p); setPickerMode('preview');
                        setPresetNameInput(p.label); setPresetSlugInput(p.key.replace(/_/g, '-')); }}
                        style={{
                          background: '#242444', border: '1px solid #3d3d6e', borderRadius: '12px',
                          padding: '20px', cursor: 'pointer', textAlign: 'left', color: '#e0e0ff',
                          transition: 'border-color 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--status-neutral)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = '#3d3d6e'}
                      >
                        <div style={{ fontSize: '28px', marginBottom: '8px' }}>{p.icon}</div>
                        <div style={{ fontWeight: 700, marginBottom: '4px', fontSize: '14px' }}>{p.label}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>{p.description}</div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ background: '#3d3d6e', borderRadius: '4px', padding: '2px 8px', fontSize: '11px' }}>{p.universe_type}</span>
                          <span style={{ background: '#3d3d6e', borderRadius: '4px', padding: '2px 8px', fontSize: '11px' }}>{p.knowledge_domain}</span>
                        </div>
                        <div style={{ marginTop: '8px', fontSize: '11px', color: '#7070a0' }}>{p.character_count} karakter · {p.location_count} lokasi</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Mode: preview + name input */}
              {pickerMode === 'preview' && selectedPreset && (
                <div>
                  <button onClick={() => setPickerMode('grid')}
                    style={{ background: 'none', border: 'none', color: 'var(--status-neutral)', cursor: 'pointer', marginBottom: '16px', fontSize: '13px' }}>← Pilih Preset Lain</button>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{ fontSize: '32px' }}>{selectedPreset.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '16px', color: '#e0e0ff' }}>{selectedPreset.label}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{selectedPreset.universe_type} · {selectedPreset.knowledge_domain}</div>
                    </div>
                  </div>

                  <div style={{ background: '#242444', borderRadius: '8px', padding: '16px', marginBottom: '20px', fontSize: '13px', color: '#c0c0e0' }}>
                    <div style={{ marginBottom: '8px' }}><strong>Starter Characters ({selectedPreset.character_count}):</strong> {selectedPreset.character_count > 0 ? `${selectedPreset.character_count} karakter siap pakai` : 'Tidak ada — tambahkan sendiri'}</div>
                    <div style={{ marginBottom: '8px' }}><strong>Starter Locations ({selectedPreset.location_count}):</strong> {selectedPreset.location_count > 0 ? `${selectedPreset.location_count} lokasi siap pakai` : 'Tidak ada — tambahkan sendiri'}</div>
                    <div style={{ marginBottom: '8px' }}><strong>Story Template:</strong> {selectedPreset.story_template}</div>
                    <div style={{ marginBottom: '8px', color: '#d1d1f6' }}><strong>Visual Style:</strong> {selectedPreset.visual_style || 'Handcrafted 3D clay'}</div>
                    {selectedPreset.has_depiction_policy && (
                      <div style={{ background: '#2d1a1a', border: '1px solid #6e3d3d', borderRadius: '6px', padding: '10px', marginTop: '8px' }}>
                        <strong style={{ color: '#ff9a9a' }}>⚠️ Depiction Policy Aktif</strong>
                        <div style={{ fontSize: '12px', marginTop: '4px', color: '#e0b0b0' }}>Universe ini memiliki aturan penggambaran karakter. Wajib dipatuhi saat produksi konten.</div>
                      </div>
                    )}
                    {selectedPreset.historical_period && (
                      <div style={{ marginTop: '8px' }}>🕐 <strong>Periode Historis:</strong> {selectedPreset.historical_period}</div>
                    )}
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>Nama Universe *</label>
                    <input
                      type="text" value={presetNameInput}
                      onChange={e => {
                        setPresetNameInput(e.target.value);
                        setPresetSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
                      }}
                      style={{ width: '100%', padding: '10px', background: 'var(--bg-secondary)', color: '#e0e0ff', border: '1px solid var(--surface-interactive)', borderRadius: '6px', boxSizing: 'border-box', fontSize: '14px' }}
                    />
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>Slug *</label>
                    <input
                      type="text" value={presetSlugInput}
                      onChange={e => setPresetSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      style={{ width: '100%', padding: '10px', background: 'var(--bg-secondary)', color: '#e0e0ff', border: '1px solid var(--surface-interactive)', borderRadius: '6px', boxSizing: 'border-box', fontSize: '14px', fontFamily: 'monospace' }}
                    />
                  </div>

                  {presetError && (
                    <div style={{ background: '#2d1a1a', border: '1px solid #6e3d3d', borderRadius: '6px', padding: '10px', marginBottom: '12px', color: '#ff9a9a', fontSize: '13px' }}>{presetError}</div>
                  )}

                  <button
                    disabled={presetInstantiating || !presetNameInput.trim() || !presetSlugInput.trim()}
                    onClick={async () => {
                      setPresetInstantiating(true);
                      setPresetError('');
                      try {
                        const res = await fetch(`/api/v2/universe-presets/${selectedPreset.key}/instantiate`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: presetNameInput, slug: presetSlugInput })
                        });
                        const json = await res.json();
                        if (json.success) {
                          setShowStarterPicker(false);
                          await fetchUniverses();
                          setToast({ type: 'success', message: `Universe '${presetNameInput}' berhasil dibuat dari preset ${selectedPreset.label}!` });
                          setTimeout(() => setToast(null), 4000);
                        } else {
                          setPresetError(json.error || 'Gagal membuat universe.');
                        }
                      } catch (e) {
                        setPresetError('Network error: ' + e.message);
                      } finally {
                        setPresetInstantiating(false);
                      }
                    }}
                    style={{
                      width: '100%', padding: '14px',
                      background: presetInstantiating ? '#3d3d6e' : 'linear-gradient(135deg, var(--status-neutral), var(--status-neutral))',
                      color: 'var(--text-primary)', border: 'none', borderRadius: '8px',
                      fontSize: '15px', fontWeight: 700, cursor: presetInstantiating ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {presetInstantiating ? '⏳ Membuat Universe...' : '🚀 Create Universe'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {showAiBuilder && (
          <AiUniverseBuilderModal
            onClose={() => setShowAiBuilder(false)}
            onCreated={async (created) => {
              await fetchUniverses();
              setShowAiBuilder(false);
              setToast({ type: 'success', message: `Universe '${created.name}' berhasil dibuat dengan AI.` });
              setTimeout(() => setToast(null), 4000);
            }}
          />
        )}
        </>
        )}
          <footer style={{ marginTop: '80px', padding: '24px 0', borderTop: '1px solid var(--border-subtle)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            © 2026 MaknaFlow
          </footer>
        </div>
      </main>
    </div>
  );
}
