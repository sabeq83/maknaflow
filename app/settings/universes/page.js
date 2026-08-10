'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';

const emptyUniverseForm = {
  name: '',
  slug: '',
  premise: '',
  tone: '',
  knowledge_domain: 'general',
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
  canonical_prompt: '',
  reference_image: null
};

const emptyLocForm = {
  name: '',
  location_key: '',
  visual_description: '',
  lighting_default: '',
  props: ''
};

export default function UniverseManagerPage() {
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

  useEffect(() => {
    fetchUniverses();
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
    try {
      const url = editingId 
        ? `/api/v2/universe-profiles/${editingId}`
        : '/api/v2/universe-profiles';
      const method = editingId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
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
      <main className="main-content" style={{ backgroundColor: '#0f0f23', minHeight: '100vh', color: '#fff', padding: '24px' }}>
        <div className="page-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title" style={{ margin: 0, fontSize: '24px' }}>🏰 Universe Manager</h1>
            <p className="page-subtitle" style={{ color: '#a29bfe', margin: '8px 0 0' }}>Define and manage your rich, consistent story universes.</p>
          </div>
          {activeTab === 'universes' && (
            <button className="btn btn-primary" style={{ backgroundColor: '#6c5ce7', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer' }} onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData({ ...emptyUniverseForm }); }}>
              {showForm ? '✕ Close Form' : '+ New Universe'}
            </button>
          )}
        </div>

        {toast && (
          <div style={{ position: 'fixed', top: '20px', right: '20px', backgroundColor: toast.type === 'error' ? '#e74c3c' : '#2ecc71', color: '#fff', padding: '12px 20px', borderRadius: '4px', zIndex: 1000 }}>
            {toast.msg}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #2d3436', paddingBottom: '12px' }}>
          <button onClick={() => setActiveTab('universes')} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', backgroundColor: activeTab === 'universes' ? '#6c5ce7' : '#1e1e3a', color: '#fff', cursor: 'pointer' }}>Universes</button>
          {selectedUniverse && (
            <>
              <button onClick={() => setActiveTab('characters')} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', backgroundColor: activeTab === 'characters' ? '#6c5ce7' : '#1e1e3a', color: '#fff', cursor: 'pointer' }}>Characters ({selectedUniverse.name})</button>
              <button onClick={() => setActiveTab('locations')} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', backgroundColor: activeTab === 'locations' ? '#6c5ce7' : '#1e1e3a', color: '#fff', cursor: 'pointer' }}>Locations</button>
              <button onClick={() => setActiveTab('episodes')} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', backgroundColor: activeTab === 'episodes' ? '#6c5ce7' : '#1e1e3a', color: '#fff', cursor: 'pointer' }}>Episodes</button>
            </>
          )}
        </div>

        {/* Tab 1: Universes */}
        {activeTab === 'universes' && (
          <>
            {showForm && (
              <div style={{ backgroundColor: '#1a1a2e', padding: '24px', borderRadius: '8px', marginBottom: '24px' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px' }}>{editingId ? 'Edit Universe' : 'Create Universe'}</h3>
                <form onSubmit={handleUniverseSave} style={{ display: 'grid', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Name *</label>
                      <input required name="name" value={formData.name} onChange={handleUniverseChange} style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Slug *</label>
                      <input required name="slug" value={formData.slug} onChange={handleUniverseChange} style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Premise *</label>
                    <textarea required name="premise" value={formData.premise} onChange={handleUniverseChange} rows="3" style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Tone</label>
                      <input name="tone" value={formData.tone} onChange={handleUniverseChange} style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Knowledge Domain</label>
                      <select name="knowledge_domain" value={formData.knowledge_domain} onChange={handleUniverseChange} style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }}>
                        <option value="general">General</option>
                        <option value="pet_supplies">Pet Supplies</option>
                        <option value="food_culinary">Food & Culinary</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Human Presence</label>
                      <select name="human_presence" value={formData.human_presence} onChange={handleUniverseChange} style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }}>
                        <option value="allowed">Allowed</option>
                        <option value="faceless_only">Faceless Only</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Visual Style *</label>
                    <textarea required name="visual_style" value={formData.visual_style} onChange={handleUniverseChange} rows="2" style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Aspect Ratio</label>
                      <select name="aspect_ratio" value={formData.aspect_ratio} onChange={handleUniverseChange} style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }}>
                        <option value="9:16">9:16</option>
                        <option value="16:9">16:9</option>
                        <option value="1:1">1:1</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Scene Count</label>
                      <input type="number" name="scene_count" value={formData.scene_count} onChange={handleUniverseChange} style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Scene Duration (sec)</label>
                      <input type="number" name="scene_duration" value={formData.scene_duration} onChange={handleUniverseChange} style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Story Template</label>
                    <textarea name="story_template" value={formData.story_template} onChange={handleUniverseChange} rows="2" style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>CTA Personality</label>
                    <input name="cta_personality" value={formData.cta_personality} onChange={handleUniverseChange} style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Pillars</label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <input value={pillarDraft} onChange={e => setPillarDraft(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); addPillar(); } }} placeholder="Add pillar..." style={{ flex: 1, padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }} />
                      <button type="button" onClick={addPillar} style={{ padding: '10px 16px', backgroundColor: '#34495e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Add</button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {formData.pillars.map((pillar, idx) => (
                        <span key={idx} style={{ backgroundColor: '#2d3436', padding: '4px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                          {pillar}
                          <button type="button" onClick={() => removePillar(idx)} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer' }}>✕</button>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button type="submit" style={{ backgroundColor: '#6c5ce7', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer' }}>Save Universe</button>
                    <button type="button" onClick={() => setShowForm(false)} style={{ backgroundColor: '#34495e', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </form>
              </div>
            )}
            
            <div style={{ backgroundColor: '#1a1a2e', borderRadius: '8px', overflow: 'hidden' }}>
              <table className="ideas-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0f0f23', borderBottom: '1px solid #2d3436' }}>
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
                    <tr key={u.id} style={{ borderBottom: '1px solid #2d3436' }}>
                      <td style={{ padding: '16px', fontWeight: 'bold' }}>{u.name}</td>
                      <td style={{ padding: '16px', color: '#a29bfe' }}>{u.slug}</td>
                      <td style={{ padding: '16px', color: '#bdc3c7', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.visual_style}</td>
                      <td style={{ padding: '16px' }}>{u.scene_count}</td>
                      <td style={{ padding: '16px' }}>
                        <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', backgroundColor: u.status === 'active' || !u.status ? '#27ae60' : '#7f8c8d' }}>
                          {u.status === 'active' || !u.status ? 'Active' : 'Archived'}
                        </span>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => { setSelectedUniverse(u); setActiveTab('characters'); }} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #6c5ce7', backgroundColor: 'transparent', color: '#6c5ce7', cursor: 'pointer' }}>Manage</button>
                        <button onClick={() => { 
                          setEditingId(u.id); 
                          setFormData({ 
                            name: u.name || '', slug: u.slug || '', premise: u.premise || '', tone: u.tone || '',
                            knowledge_domain: u.knowledge_domain || 'general', human_presence: u.human_presence || 'allowed',
                            visual_style: u.visual_style || '', aspect_ratio: u.aspect_ratio || '9:16', scene_count: u.scene_count || 5,
                            scene_duration: u.scene_duration || 3, story_template: u.story_template || '', cta_personality: u.cta_personality || '',
                            pillars: (() => { try { return typeof u.pillars === 'string' ? JSON.parse(u.pillars) : (u.pillars || []); } catch { return []; } })()
                          });
                          setShowForm(true); 
                        }} style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', backgroundColor: '#3498db', color: '#fff', cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => handleUniverseArchive(u.id)} style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', backgroundColor: '#e74c3c', color: '#fff', cursor: 'pointer' }}>Archive</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedUniverse && (
              <div style={{ marginTop: '24px', backgroundColor: '#1a1a2e', padding: '24px', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 16px 0', color: '#a29bfe' }}>Preview: {selectedUniverse.name}</h4>
                <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#bdc3c7' }}><strong>Premise:</strong> {selectedUniverse.premise}</p>
                <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#bdc3c7' }}><strong>Format:</strong> {selectedUniverse.scene_count} scenes x {selectedUniverse.scene_duration}s ({selectedUniverse.aspect_ratio})</p>
                <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#bdc3c7' }}><strong>Tone:</strong> {selectedUniverse.tone}</p>
              </div>
            )}
          </>
        )}

        {/* Tab 2: Characters */}
        {activeTab === 'characters' && selectedUniverse && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
               <button className="btn btn-primary" onClick={() => { setShowCharForm(!showCharForm); setEditingId(null); setCharFormData({ ...emptyCharForm }); }} style={{ backgroundColor: '#6c5ce7', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                {showCharForm ? '✕ Close Form' : '+ New Character'}
              </button>
            </div>
            
            {showCharForm && (
              <div style={{ backgroundColor: '#1a1a2e', padding: '24px', borderRadius: '8px', marginBottom: '24px' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px' }}>{editingId ? 'Edit Character' : 'Create Character'}</h3>
                <form onSubmit={handleCharSave} style={{ display: 'grid', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Name *</label>
                      <input required name="name" value={charFormData.name} onChange={handleCharChange} style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Character Key *</label>
                      <input required name="character_key" value={charFormData.character_key} onChange={handleCharChange} style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Species</label>
                      <input name="species" value={charFormData.species} onChange={handleCharChange} style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Breed</label>
                      <input name="breed" value={charFormData.breed} onChange={handleCharChange} style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Role</label>
                      <select name="role" value={charFormData.role} onChange={handleCharChange} style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }}>
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
                      <input name="body_shape" value={charFormData.body_shape} onChange={handleCharChange} style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Fur Color</label>
                      <input name="fur_color" value={charFormData.fur_color} onChange={handleCharChange} style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Eye Color</label>
                      <input name="eye_color" value={charFormData.eye_color} onChange={handleCharChange} style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Wardrobe</label>
                    <input name="wardrobe" value={charFormData.wardrobe} onChange={handleCharChange} style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Personality</label>
                      <input name="personality" value={charFormData.personality} onChange={handleCharChange} style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Movement Style</label>
                      <input name="movement_style" value={charFormData.movement_style} onChange={handleCharChange} style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Relative Size</label>
                      <select name="relative_size" value={charFormData.relative_size} onChange={handleCharChange} style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }}>
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Canonical Prompt</label>
                    <textarea name="canonical_prompt" value={charFormData.canonical_prompt} onChange={handleCharChange} rows="3" style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Reference Image</label>
                    <input type="file" onChange={handleCharFileChange} style={{ color: '#bdc3c7' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <button type="submit" style={{ backgroundColor: '#6c5ce7', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer' }}>Save Character</button>
                    <button type="button" onClick={() => setShowCharForm(false)} style={{ backgroundColor: '#34495e', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </form>
              </div>
            )}
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {characters.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', backgroundColor: '#1a1a2e', borderRadius: '8px', color: '#7f8c8d' }}>No characters found.</div>
              ) : characters.map(c => (
                <div key={c.id} style={{ backgroundColor: '#1a1a2e', borderRadius: '8px', overflow: 'hidden', border: '1px solid #2d3436' }}>
                  <div style={{ height: '160px', backgroundColor: '#1e1e3a', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #2d3436' }}>
                    {c.reference_image_url ? (
                      <img src={c.reference_image_url} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '48px' }}>🐾</span>
                    )}
                  </div>
                  <div style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <h4 style={{ margin: 0, fontSize: '18px' }}>{c.name}</h4>
                      <span style={{ backgroundColor: '#6c5ce7', fontSize: '10px', padding: '2px 6px', borderRadius: '10px' }}>v{c.version || 1}</span>
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                      <span style={{ display: 'inline-block', backgroundColor: '#2d3436', fontSize: '12px', padding: '4px 8px', borderRadius: '4px', marginBottom: '4px' }}>{c.role}</span>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#bdc3c7' }}>{c.species} • {c.breed}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => {
                        setEditingId(c.id);
                        setCharFormData({
                          name: c.name || '', character_key: c.character_key || '', species: c.species || '', breed: c.breed || '',
                          body_shape: c.body_shape || '', fur_color: c.fur_color || '', eye_color: c.eye_color || '', wardrobe: c.wardrobe || '',
                          personality: c.personality || '', movement_style: c.movement_style || '', relative_size: c.relative_size || 'medium',
                          role: c.role || 'supporting', canonical_prompt: c.canonical_prompt || '', reference_image: null
                        });
                        setShowCharForm(true);
                      }} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: 'none', backgroundColor: '#3498db', color: '#fff', cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => handleCharDelete(c.id)} style={{ padding: '8px', borderRadius: '4px', border: 'none', backgroundColor: '#e74c3c', color: '#fff', cursor: 'pointer' }}>Delete</button>
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
              <button className="btn btn-primary" onClick={() => { setShowLocForm(!showLocForm); setEditingId(null); setLocFormData({ ...emptyLocForm }); }} style={{ backgroundColor: '#6c5ce7', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                {showLocForm ? '✕ Close Form' : '+ New Location'}
              </button>
            </div>
            
            {showLocForm && (
              <div style={{ backgroundColor: '#1a1a2e', padding: '24px', borderRadius: '8px', marginBottom: '24px' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px' }}>{editingId ? 'Edit Location' : 'Create Location'}</h3>
                <form onSubmit={handleLocSave} style={{ display: 'grid', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Name *</label>
                      <input required name="name" value={locFormData.name} onChange={handleLocChange} style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Location Key *</label>
                      <input required name="location_key" value={locFormData.location_key} onChange={handleLocChange} style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Visual Description *</label>
                    <textarea required name="visual_description" value={locFormData.visual_description} onChange={handleLocChange} rows="3" style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Lighting Default</label>
                      <input name="lighting_default" value={locFormData.lighting_default} onChange={handleLocChange} style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Props</label>
                      <input name="props" value={locFormData.props} onChange={handleLocChange} style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e3a', border: '1px solid #2d3436', color: '#fff', borderRadius: '4px' }} placeholder="Comma separated" />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <button type="submit" style={{ backgroundColor: '#6c5ce7', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer' }}>Save Location</button>
                    <button type="button" onClick={() => setShowLocForm(false)} style={{ backgroundColor: '#34495e', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </form>
              </div>
            )}
            
            <div style={{ backgroundColor: '#1a1a2e', borderRadius: '8px', overflow: 'hidden' }}>
              <table className="ideas-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0f0f23', borderBottom: '1px solid #2d3436' }}>
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
                    <tr key={l.id} style={{ borderBottom: '1px solid #2d3436' }}>
                      <td style={{ padding: '16px', fontWeight: 'bold' }}>{l.name}</td>
                      <td style={{ padding: '16px', color: '#a29bfe' }}>{l.location_key}</td>
                      <td style={{ padding: '16px', color: '#bdc3c7' }}>{l.lighting_default}</td>
                      <td style={{ padding: '16px' }}>v{l.version || 1}</td>
                      <td style={{ padding: '16px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => {
                          setEditingId(l.id);
                          setLocFormData({
                            name: l.name || '', location_key: l.location_key || '', visual_description: l.visual_description || '',
                            lighting_default: l.lighting_default || '', props: l.props || ''
                          });
                          setShowLocForm(true);
                        }} style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', backgroundColor: '#3498db', color: '#fff', cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => handleLocDelete(l.id)} style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', backgroundColor: '#e74c3c', color: '#fff', cursor: 'pointer' }}>Delete</button>
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
              <div style={{ backgroundColor: '#1a1a2e', padding: '24px', borderRadius: '8px', marginBottom: '24px', border: '1px solid #6c5ce7' }}>
                <h4 style={{ margin: '0 0 16px 0', color: '#a29bfe' }}>Anti-Repetition Digest Summary</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div>
                    <strong style={{ display: 'block', marginBottom: '8px' }}>Used Products</strong>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#bdc3c7', fontSize: '14px' }}>
                      {Object.entries(episodeDigest.products || {}).map(([p, count]) => (
                        <li key={p}>{p} ({count})</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <strong style={{ display: 'block', marginBottom: '8px' }}>Addressed Problems</strong>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#bdc3c7', fontSize: '14px' }}>
                      {Object.entries(episodeDigest.problems || {}).map(([p, count]) => (
                        <li key={p}>{p} ({count})</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <strong style={{ display: 'block', marginBottom: '8px' }}>Used Hooks</strong>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#bdc3c7', fontSize: '14px' }}>
                      {Object.entries(episodeDigest.hooks || {}).map(([h, count]) => (
                        <li key={h}>{h} ({count})</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            
            <div style={{ backgroundColor: '#1a1a2e', borderRadius: '8px', overflow: 'hidden' }}>
              <table className="ideas-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0f0f23', borderBottom: '1px solid #2d3436' }}>
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
                    <tr key={e.id} style={{ borderBottom: '1px solid #2d3436' }}>
                      <td style={{ padding: '16px', fontSize: '14px' }}>{new Date(e.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '16px', fontSize: '14px', color: '#a29bfe' }}>{e.main_character}</td>
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
      </main>
    </div>
  );
}
