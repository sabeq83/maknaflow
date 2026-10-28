'use client';

import React, { useState, useEffect, useRef } from 'react';
import { buildRecipeDescriptionHtml } from '@/lib/recipe-export-helper';
import DedicatedVideoLightbox from './DedicatedVideoLightbox';
import './recipe-export.css';

const DEFAULT_PRESETS = {
  airfry: {
    name: 'Air Fryer Recipes App',
    url: 'https://api.airfryerapp.com/api_sync_recipe.php',
    token: 'SAMPLE_AIRFRY_SYNC_KEY',
    defaultCategory: 'Air Fryer'
  },
  proteinprep: {
    name: 'Protein Prep App',
    url: 'http://127.0.0.1:8088/api_sync_recipe.php',
    token: 'pp_sync_sec_88f9e2c4a1b0d7e6359c4172',
    defaultCategory: 'High Protein'
  },
  yourrecipe: {
    name: 'Your Recipes App',
    url: 'https://api.yourrecipesapp.com/api_sync_recipe.php',
    token: 'SAMPLE_YOURRECIPE_SYNC_KEY',
    defaultCategory: 'Main Course'
  },
  custom: {
    name: 'Custom Webadmin Receiver',
    url: 'http://localhost:8080/api_sync_recipe.php',
    token: 'SAMPLE_CUSTOM_SECRET_KEY',
    defaultCategory: 'Custom'
  }
};

export default function RecipeExportModal({ recipe, onClose, onSuccess }) {
  // 1. Form Tuning State
  const [title, setTitle] = useState(recipe?.title || recipe?.recipe_title || '');
  const [time, setTime] = useState(recipe?.time || recipe?.recipe_time || '15 mins prep | 30 mins cook');
  const [summary, setSummary] = useState(recipe?.summary || '');
  const [baseIngredients, setBaseIngredients] = useState(
    Array.isArray(recipe?.base_ingredients) 
      ? recipe.base_ingredients.join('\n') 
      : (typeof recipe?.baseIng === 'string' ? recipe.baseIng : (recipe?.ingredients || ''))
  );
  const [ingredientGroups, setIngredientGroups] = useState(
    Array.isArray(recipe?.ingredient_groups) 
      ? recipe.ingredient_groups 
      : (Array.isArray(recipe?.groups) ? recipe.groups : [])
  );
  const [directions, setDirections] = useState(
    Array.isArray(recipe?.directions) 
      ? recipe.directions.join('\n') 
      : (recipe?.directions || '')
  );

  // 2. Preset & Category State
  const [presets, setPresets] = useState(DEFAULT_PRESETS);
  const [selectedApp, setSelectedApp] = useState('airfry');
  const [editPresetOpen, setEditPresetOpen] = useState(false);
  const [pingStatus, setPingStatus] = useState('Online (HTTP 200)');
  const [pinging, setPinging] = useState(false);

  const [category, setCategory] = useState(recipe?.category || 'Air Fryer');
  const [customCategoryMode, setCustomCategoryMode] = useState(false);
  const [customCategoryText, setCustomCategoryText] = useState('');

  // 3. T2I 4:3 Cover State
  const [t2iPrompt43, setT2iPrompt43] = useState(recipe?.t2i_prompt_4_3 || '');
  const [coverImageUrl, setCoverImageUrl] = useState(recipe?.image || recipe?.cover_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80');
  const [generatingCover, setGeneratingCover] = useState(false);

  // 4. Video Pipeline State
  const [videoMutedReady, setVideoMutedReady] = useState(Boolean(recipe?.videoMutedReady || recipe?.video_url || recipe?.videoR2Url));
  const [videoR2Url, setVideoR2Url] = useState(recipe?.videoR2Url || recipe?.video_url || '');
  const [processingVideo, setProcessingVideo] = useState(false);
  const [uploadingR2, setUploadingR2] = useState(false);
  const [inlineVideoOpen, setInlineVideoOpen] = useState(false);
  const [audioMode, setAudioMode] = useState('muted'); // 'muted' | 'original'
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const inlinePlayerRef = useRef(null);

  // 5. Simulator & Tab State
  const [modalTab, setModalTab] = useState('editor'); // 'editor' | 'html' | 'plain'
  const [pixelMediaTab, setPixelMediaTab] = useState('photo'); // 'photo' | 'video'
  const [aiEnriching, setAiEnriching] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushToast, setPushToast] = useState(null);

  const pixelDeviceRef = useRef(null);

  // Keyboard escape listener
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && !lightboxOpen) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, lightboxOpen]);

  // Audio Mode change for inline video
  useEffect(() => {
    if (inlinePlayerRef.current) {
      inlinePlayerRef.current.muted = (audioMode === 'muted');
      if (audioMode === 'original') inlinePlayerRef.current.volume = 0.6;
    }
  }, [audioMode]);

  // Load persistent presets for active tenant from tenant_settings
  useEffect(() => {
    fetch('/api/recipes/presets')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.presets && typeof d.presets === 'object') {
          setPresets(prev => ({ ...prev, ...d.presets }));
        }
      })
      .catch(() => {});
  }, []);

  // Build Standard HTML Description
  const activeBaseArray = baseIngredients.split('\n').map(s => s.trim()).filter(Boolean);
  const activeDirectionsArray = directions.split('\n').map(s => s.trim()).filter(Boolean);
  const currentHtmlDescription = buildRecipeDescriptionHtml({
    summary,
    baseIngredients: activeBaseArray,
    ingredientGroups: ingredientGroups.map(g => ({
      name: g.name,
      items: Array.isArray(g.items) ? g.items : String(g.items || '').split('\n').map(s => s.trim()).filter(Boolean)
    })),
    directions: activeDirectionsArray
  });

  const effectiveCategory = customCategoryMode && customCategoryText.trim() ? customCategoryText.trim() : category;

  // AI Auto Enrich (1-Klik)
  async function handleAiAutoEnrich() {
    setAiEnriching(true);
    try {
      const res = await fetch('/api/recipes/auto-enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          currentIngredients: baseIngredients,
          currentDirections: directions
        })
      });
      const json = await res.json();
      if (json.success && json.data) {
        if (json.data.recipe_time) setTime(json.data.recipe_time);
        if (json.data.summary) setSummary(json.data.summary);
        if (Array.isArray(json.data.base_ingredients)) {
          setBaseIngredients(json.data.base_ingredients.join('\n'));
        }
        if (Array.isArray(json.data.ingredient_groups)) {
          setIngredientGroups(json.data.ingredient_groups);
        }
        if (Array.isArray(json.data.directions)) {
          setDirections(json.data.directions.join('\n'));
        }
        if (json.data.t2i_prompt_4_3) setT2iPrompt43(json.data.t2i_prompt_4_3);
      } else {
        alert(`Gagal AI Auto Enrich: ${json.error || 'Respon AI tidak valid'}`);
      }
    } catch (err) {
      alert(`Gagal AI Auto Enrich: ${err.message}`);
    }
    setAiEnriching(false);
  }

  // FFmpeg Muting & Video Pipeline
  async function handleRunFfmpegMute() {
    const rawLocalPath = recipe?.sourceVideoPath || recipe?.video_url || recipe?.media_url || recipe?.ffmpeg_output_path;
    if (!rawLocalPath && !videoR2Url) {
      alert('Resep ini belum memiliki file video ter-render di server Mac Mini.');
      return;
    }

    setProcessingVideo(true);
    try {
      const res = await fetch('/api/recipes/video-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeId: recipe?.id || 'rcitem_' + Date.now(),
          sourceVideoPath: rawLocalPath,
          videoUrl: videoR2Url || rawLocalPath
        })
      });
      const data = await res.json();
      if (data.success) {
        setVideoMutedReady(true);
        if (data.videoR2Url) setVideoR2Url(data.videoR2Url);
        setInlineVideoOpen(true);
        setAudioMode('muted');
        alert('Video berhasil disalin, di-mute via FFmpeg (-an), dan diunggah ke Cloudflare R2!');
        try {
          if (inlinePlayerRef.current) {
            inlinePlayerRef.current.currentTime = 0;
            inlinePlayerRef.current.play();
          }
        } catch (_) {}
      } else {
        alert(`Gagal memproses video FFmpeg: ${data.error}`);
      }
    } catch (err) {
      alert(`Gagal memproses video: ${err.message}`);
    }
    setProcessingVideo(false);
  }

  // Upload to Cloudflare R2
  async function handleUploadToR2() {
    const rawLocalPath = recipe?.sourceVideoPath || recipe?.video_url || recipe?.media_url || recipe?.ffmpeg_output_path;
    if (!rawLocalPath && !videoR2Url) {
      alert('Tidak ada file video lokal yang dapat diunggah ke Cloudflare R2.');
      return;
    }

    setUploadingR2(true);
    try {
      const res = await fetch('/api/recipes/video-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeId: recipe?.id || 'rcitem_' + Date.now(),
          sourceVideoPath: rawLocalPath,
          videoUrl: videoR2Url || rawLocalPath
        })
      });
      const data = await res.json();
      if (data.success && data.videoR2Url) {
        setVideoR2Url(data.videoR2Url);
        setVideoMutedReady(true);
        alert('Video ter-mute berhasil diunggah ke Cloudflare R2!');
        setPixelMediaTab('video');
      } else {
        alert(`Gagal upload ke R2: ${data.error}`);
      }
    } catch (err) {
      alert(`Gagal upload ke R2: ${err.message}`);
    }
    setUploadingR2(false);
  }

  // Ping API Target
  async function handlePingEndpoint() {
    setPinging(true);
    setPingStatus('⏳ Pinging...');
    try {
      const activePreset = presets[selectedApp];
      const res = await fetch('/api/recipes/push-webadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ping',
          endpointUrl: activePreset.url,
          syncToken: activePreset.token
        })
      });
      const data = await res.json();
      if (data.success) {
        setPingStatus('✅ Online (HTTP 200)');
      } else {
        setPingStatus(`⚠️ Offline (${data.error || 'Failed'})`);
      }
    } catch (e) {
      setPingStatus('🔴 Gagal Koneksi');
    }
    setPinging(false);
  }

  // Direct Push ke Webadmin
  async function handleDirectPush() {
    setPushing(true);
    setPushToast({ type: 'loading', msg: `Mengunggah resep ke ${presets[selectedApp].name}...` });
    try {
      const activePreset = presets[selectedApp];
      const res = await fetch('/api/recipes/push-webadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'push_recipe',
          endpointUrl: activePreset.url,
          syncToken: activePreset.token,
          recipeTitle: title,
          recipeTime: time,
          categoryName: effectiveCategory,
          recipeDescriptionHtml: currentHtmlDescription,
          videoUrl: videoR2Url || null,
          imageUrl: coverImageUrl,
          source: recipe?.sourceType || (recipe?.source && recipe.source.includes('Campaign') ? 'campaign' : 'labs'),
          sourceItemId: recipe?.id || '',
          targetApp: activePreset.name
        })
      });
      const data = await res.json();
      if (data.success) {
        setPushToast({
          type: 'success',
          msg: `✅ Sukses! Resep berhasil diterbitkan ke ${activePreset.name} (ID: #${data.recipeId || 'Sync'}). Siap tampil di Android.`
        });
        if (onSuccess) onSuccess({ recipeId: data.recipeId, title });
      } else {
        setPushToast({ type: 'error', msg: `🔴 Gagal: ${data.error || 'Server menolak push resep.'}` });
      }
    } catch (err) {
      setPushToast({ type: 'error', msg: `🔴 Gagal: ${err.message}` });
    }
    setPushing(false);
  }

  // Download JSON
  function handleDownloadJson() {
    const payload = {
      recipe_title: title,
      recipe_time: time,
      category: effectiveCategory,
      target_app: presets[selectedApp].name,
      video_url: videoR2Url || null,
      t2i_prompt_4_3: t2iPrompt43,
      cover_image: coverImageUrl,
      recipe_description_html: currentHtmlDescription,
      exported_at: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recipe_export_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleAddIngredientGroup() {
    const name = prompt('Masukkan tajuk sub-kelompok bahan (contoh: For the sauce :, For the marinade :):', 'For the sauce :');
    if (!name || !name.trim()) return;
    setIngredientGroups(prev => [...prev, { name: name.trim(), items: [] }]);
  }

  function handleRemoveIngredientGroup(index) {
    setIngredientGroups(prev => prev.filter((_, i) => i !== index));
  }

  function handleGroupItemsChange(index, newItemsText) {
    setIngredientGroups(prev => prev.map((g, i) => i === index ? { ...g, items: newItemsText.split('\n') } : g));
  }

  return (
    <div className="recipe-modal-backdrop" onClick={onClose}>
      <div className="recipe-modal-window" onClick={e => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="recipe-modal-header">
          <div className="recipe-modal-title-group">
            <h3>
              <span>📱</span>
              <span>{title || 'Modul Export Recipe'}</span>
            </h3>
            <div className="recipe-modal-subtitle">
              <span className="recipe-pixel-chip" style={{ background: 'var(--surface-interactive)', color: 'var(--action-primary)' }}>
                {recipe?.source || 'Recipe Studio Item'}
              </span>
              <span>•</span>
              <span>Target Simulator: Google Pixel 7 (412 × 915 WebView Standard • Cover 4:3 & R2 Video)</span>
            </div>
          </div>
          <button type="button" className="recipe-modal-close-btn" onClick={onClose} title="Tutup (Esc)">✕</button>
        </div>

        {/* Modal Body: Split 2 Panes */}
        <div className="recipe-modal-body">
          
          {/* PANE KIRI: TUNING & CONTROLS */}
          <div className="recipe-pane-tuning">

            {recipe?.isExported && (
              <div style={{
                padding: '10px 14px',
                background: 'var(--status-success-soft)',
                border: '1px solid var(--status-success)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--status-success)',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '1rem' }}>✓</span>
                <div>
                  Resep ini sebelumnya telah diekspor ke <strong>{recipe.lastExportTarget || 'Android Webadmin'}</strong>
                  {recipe.lastExportedAt ? ` pada ${new Date(recipe.lastExportedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
                  {recipe.exportCount > 1 ? ` (${recipe.exportCount}x total ekspor)` : ''}.
                </div>
              </div>
            )}

            {/* 1. Preset Target Box */}
            <div className="recipe-preset-box">
              <div className="recipe-preset-header">
                <span className="recipe-preset-title">🎯 Preset Target Aplikasi & Kategori:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="recipe-endpoint-badge">{pingStatus}</span>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                    onClick={() => setEditPresetOpen(!editPresetOpen)}
                  >
                    ⚙️ Edit Preset & API
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Preset Aplikasi Tujuan</label>
                  <select
                    className="form-control"
                    value={selectedApp}
                    onChange={e => {
                      setSelectedApp(e.target.value);
                      setCategory(presets[e.target.value].defaultCategory);
                    }}
                  >
                    <option value="airfry">🥔 Air Fryer Recipes App (_app_airfry)</option>
                    <option value="proteinprep">🥗 Protein Prep App (_app_proteinprep)</option>
                    <option value="yourrecipe">📖 Your Recipes App (_app_yourrecipe)</option>
                    <option value="custom">⚙️ Custom Webadmin Receiver</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Kategori di Aplikasi</span>
                    <button
                      type="button"
                      style={{ background: 'transparent', border: 'none', color: 'var(--action-primary)', cursor: 'pointer', fontSize: '0.7rem' }}
                      onClick={() => {
                        const newCat = prompt('Masukkan nama kategori baru:', 'Snack & Sides');
                        if (newCat && newCat.trim()) {
                          setCategory(newCat.trim());
                          setCustomCategoryMode(false);
                        }
                      }}
                    >
                      + Baru
                    </button>
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {!customCategoryMode ? (
                      <select
                        className="form-control"
                        style={{ flex: 1 }}
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                      >
                        <option value="Air Fryer">Air Fryer</option>
                        <option value="Main Course">Main Course</option>
                        <option value="Vegetarian">Vegetarian & Sides</option>
                        <option value="High Protein">High Protein</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ketik custom kategori..."
                        value={customCategoryText}
                        onChange={e => setCustomCategoryText(e.target.value)}
                        style={{ flex: 1 }}
                      />
                    )}
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ padding: '0 8px', fontSize: '0.72rem' }}
                      title="Toggle mode ketik bebas kategori"
                      onClick={() => setCustomCategoryMode(!customCategoryMode)}
                    >
                      {customCategoryMode ? '📋' : '✏️'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Endpoint detail & Ping */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--input-bg)', padding: '8px 12px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Endpoint Receiver URL:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {presets[selectedApp].url}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ padding: '4px 10px', fontSize: '0.72rem', whiteSpace: 'nowrap' }}
                  onClick={handlePingEndpoint}
                  disabled={pinging}
                >
                  ⚡ Ping API
                </button>
              </div>

              {/* Preset Drawer Editor */}
              {editPresetOpen && (
                <div style={{ background: 'var(--surface-interactive)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xs)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <strong style={{ fontSize: '0.78rem', color: 'var(--action-primary)' }}>⚙️ Edit Konfigurasi Preset Aktif:</strong>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.7rem' }}>Nama Aplikasi Label</label>
                    <input
                      type="text"
                      className="form-control"
                      value={presets[selectedApp].name}
                      onChange={e => setPresets(prev => ({
                        ...prev,
                        [selectedApp]: { ...prev[selectedApp], name: e.target.value }
                      }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.7rem' }}>Target URL (api_sync_recipe.php)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={presets[selectedApp].url}
                      onChange={e => setPresets(prev => ({
                        ...prev,
                        [selectedApp]: { ...prev[selectedApp], url: e.target.value }
                      }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.7rem' }}>Secret Sync Token</label>
                    <input
                      type="password"
                      className="form-control"
                      value={presets[selectedApp].token}
                      onChange={e => setPresets(prev => ({
                        ...prev,
                        [selectedApp]: { ...prev[selectedApp], token: e.target.value }
                      }))}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ alignSelf: 'flex-end', padding: '4px 12px', fontSize: '0.72rem' }}
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/recipes/presets', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ presets })
                        });
                        const data = await res.json();
                        if (data.success) {
                          alert('Konfigurasi preset berhasil disimpan untuk tenant ini!');
                        } else {
                          alert(`Gagal menyimpan preset: ${data.error}`);
                        }
                      } catch (e) {
                        alert(`Gagal menyimpan preset: ${e.message}`);
                      }
                      setEditPresetOpen(false);
                    }}
                  >
                    Simpan Konfigurasi Tenant
                  </button>
                </div>
              )}
            </div>

            {/* 2. AI Auto Enrich (1-Klik) */}
            <div className="recipe-ai-magic-box">
              <div className="recipe-ai-magic-text">
                <strong>✨ AI Auto Enrich (1-Klik Lengkap)</strong>
                Menghasilkan otomatis 4 elemen standar: <strong>SUMMARY</strong>, <strong>INGREDIENTS</strong> (Sub-Kelompok Adaptif), <strong>DIRECTIONS</strong>, dan <strong>T2I_PROMPT_4_3</strong> untuk foto resep mobile.
              </div>
              <button
                type="button"
                className="btn-ai-magic"
                onClick={handleAiAutoEnrich}
                disabled={aiEnriching}
              >
                <span>{aiEnriching ? '⏳' : '✨'}</span>
                <span>{aiEnriching ? 'Memproses...' : 'AI Auto Enrich'}</span>
              </button>
            </div>

            {/* 3. Video Pipeline Box */}
            <div className="recipe-video-pipeline-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.1rem' }}>🎬</span>
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Video Resep (Pulling, Mute via FFmpeg & Cloudflare R2 Sync)</strong>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {videoMutedReady ? '✓ Video Ter-Mute Siap Diputar' : '🎥 Video Kampanye Terdeteksi: 1080x1920 MP4'}
                    </div>
                  </div>
                </div>
                <span className="recipe-pixel-chip" style={{ color: videoR2Url ? 'var(--status-success)' : 'var(--status-warning)', borderColor: videoR2Url ? 'var(--status-success)' : 'var(--status-warning)' }}>
                  {videoR2Url ? '☁️ R2 Synced' : '☁️ R2 Ready'}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="recipe-video-steps-row">
                <div className="recipe-video-step-card">
                  <div className="recipe-video-step-title">
                    <span>🔇</span>
                    <span>1. Pull & Mute Audio (FFmpeg)</span>
                  </div>
                  <div className="recipe-video-step-status">
                    Hilangkan trek audio voiceover murni tanpa re-encoding (<code>-c:v copy -an</code>).
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ padding: '4px 10px', fontSize: '0.75rem', flex: 1 }}
                      onClick={handleRunFfmpegMute}
                      disabled={processingVideo}
                    >
                      <span>{processingVideo ? '⏳' : '✂️'}</span>
                      <span>{processingVideo ? 'Memproses...' : (videoMutedReady ? 'Mute Ulang' : 'Mute Video')}</span>
                    </button>
                    {videoMutedReady && (
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        onClick={() => setInlineVideoOpen(!inlineVideoOpen)}
                        title="Tampilkan / Sembunyikan Player Preview"
                      >
                        👁️ Preview
                      </button>
                    )}
                  </div>
                </div>

                <div className="recipe-video-step-card">
                  <div className="recipe-video-step-title">
                    <span>☁️</span>
                    <span>2. Upload ke Cloudflare R2</span>
                  </div>
                  <div className="recipe-video-step-status">
                    Simpan video ter-mute ke bucket R2 CDN publik dan tautkan ke database webadmin.
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '4px 10px', fontSize: '0.75rem', marginTop: '4px' }}
                    onClick={handleUploadToR2}
                    disabled={uploadingR2}
                  >
                    <span>{uploadingR2 ? '⏳' : '🚀'}</span>
                    <span>{uploadingR2 ? 'Mengunggah...' : 'Upload ke R2 Bucket'}</span>
                  </button>
                </div>
              </div>

              {/* Inline Preview Drawer */}
              {inlineVideoOpen && (
                <div className="recipe-video-preview-inline-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--status-warning)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>👁️</span> <span>Pratinjau Video Ter-Mute (FFmpeg):</span>
                      </span>
                      <span className="recipe-pixel-chip">1080×1920 MP4 • 38 Detik</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInlineVideoOpen(false)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}
                    >
                      ✕ Sembunyikan
                    </button>
                  </div>

                  <div className="recipe-video-preview-player-wrapper">
                    <video
                      ref={inlinePlayerRef}
                      src={videoR2Url || recipe?.video_url || 'https://assets.mixkit.co/videos/preview/mixkit-vegetables-and-meat-simmering-in-a-pan-43407-large.mp4'}
                      poster={coverImageUrl}
                      controls
                      playsInline
                      loop
                    />
                    <div className="recipe-video-muted-floating-badge">
                      <span>🔇</span>
                      <span>{audioMode === 'muted' ? '100% Muted (Audio Track Removed)' : '⚠️ Mode Simulasi Suara Asli'}</span>
                    </div>
                    <button
                      type="button"
                      className="recipe-video-floating-expand-btn"
                      onClick={() => setLightboxOpen(true)}
                    >
                      <span>🔍</span> <span>Layar Penuh 9:16</span>
                    </button>
                  </div>

                  {/* Audio Silence Spectrum */}
                  <div className="recipe-audio-silence-meter">
                    <div className="recipe-audio-meter-visual">
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.72rem' }}>Track Audio:</span>
                      <div className="recipe-audio-meter-bars">
                        {[...Array(8)].map((_, i) => (
                          <div
                            key={i}
                            className={`recipe-audio-bar ${audioMode === 'muted' ? 'muted-flat' : 'active-sound'}`}
                          />
                        ))}
                      </div>
                      <span style={{ color: audioMode === 'muted' ? 'var(--status-success)' : 'var(--status-warning)', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                        {audioMode === 'muted' ? '🔇 -inf dB (Audio Stripped / Hening)' : '🔊 ~ -12 dB (Trek Asli Bersuara)'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Uji Dengar:</span>
                      <button
                        type="button"
                        className={`btn-video-ctrl ${audioMode === 'muted' ? 'active-mode' : ''}`}
                        onClick={() => setAudioMode('muted')}
                      >
                        🔇 Hening
                      </button>
                      <button
                        type="button"
                        className={`btn-video-ctrl ${audioMode === 'original' ? 'active-mode' : ''}`}
                        onClick={() => setAudioMode('original')}
                      >
                        🔊 Asli
                      </button>
                    </div>
                  </div>

                  {/* Toolbar */}
                  <div className="recipe-video-quick-controls">
                    <button
                      type="button"
                      className="btn-video-ctrl"
                      onClick={() => {
                        setPixelMediaTab('video');
                        if (pixelDeviceRef.current) {
                          pixelDeviceRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }}
                      style={{ borderColor: 'var(--action-primary)', color: 'var(--action-primary)' }}
                    >
                      <span>📱</span> <span>Tonton di Layar Pixel 7</span>
                    </button>
                    <button
                      type="button"
                      className="btn-video-ctrl"
                      onClick={() => setLightboxOpen(true)}
                    >
                      <span>🔍</span> <span>Buka Lightbox (9:16)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* R2 Video URL input */}
              <div className="form-group" style={{ marginTop: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>
                    <span>Public R2 Video CDN URL:</span>
                    {videoR2Url && <span style={{ color: 'var(--status-success)', fontSize: '0.7rem', fontWeight: 700, marginLeft: '6px' }}>✓ Tersimpan</span>}
                  </label>
                  {videoR2Url && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                      onClick={() => {
                        navigator.clipboard.writeText(videoR2Url);
                        alert('URL Video CDN berhasil disalin!');
                      }}
                    >
                      📋 Salin URL
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  className="form-control"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
                  placeholder="https://pub-r2.maknaflow.com/recipes/..."
                  value={videoR2Url}
                  onChange={e => setVideoR2Url(e.target.value)}
                />
              </div>
            </div>

            {/* Sub-Tabs: Editor, HTML Preview, Plain Text */}
            <div className="recipe-sub-tabs">
              <button
                type="button"
                className={`recipe-sub-tab-btn ${modalTab === 'editor' ? 'active' : ''}`}
                onClick={() => setModalTab('editor')}
              >
                ✏️ Penyesuaian Resep
              </button>
              <button
                type="button"
                className={`recipe-sub-tab-btn ${modalTab === 'html' ? 'active' : ''}`}
                onClick={() => setModalTab('html')}
              >
                🌐 Live HTML Inspector
              </button>
              <button
                type="button"
                className={`recipe-sub-tab-btn ${modalTab === 'plain' ? 'active' : ''}`}
                onClick={() => setModalTab('plain')}
              >
                📄 Plain Text
              </button>
            </div>

            {/* TAB CONTENT: EDITOR */}
            {modalTab === 'editor' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Judul Resep (Recipe Title)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Waktu Masak (Recipe Time)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={time}
                      onChange={e => setTime(e.target.value)}
                    />
                  </div>
                </div>

                {/* T2I Prompt 4:3 Box */}
                <div className="recipe-t2i-prompt-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>📷 T2I_PROMPT_4_3 (Landscape Food Photography)</span>
                      <span className="recipe-t2i-prompt-badge">Rasio 4:3</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {t2iPrompt43 && (
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                          onClick={() => {
                            navigator.clipboard.writeText(t2iPrompt43);
                            alert('Prompt T2I 4:3 disalin!');
                          }}
                        >
                          📋 Salin Prompt
                        </button>
                      )}
                    </div>
                  </div>
                  <textarea
                    className="recipe-ing-textarea"
                    style={{ minHeight: '50px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}
                    placeholder="Award-winning 4:3 food photography of..."
                    value={t2iPrompt43}
                    onChange={e => setT2iPrompt43(e.target.value)}
                  />
                </div>

                {/* SUMMARY */}
                <div className="form-group" style={{ width: '100%' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>SUMMARY (Naratif Sensory Hook)</label>
                  <textarea
                    className="recipe-ing-textarea"
                    rows={3}
                    style={{ width: '100%', boxSizing: 'border-box', minHeight: '75px', fontSize: '0.8rem' }}
                    value={summary}
                    onChange={e => setSummary(e.target.value)}
                    placeholder="Deskripsi pembuka yang menggugah selera..."
                  />
                </div>

                {/* INGREDIENTS (Base + Optional Groups) */}
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', margin: 0 }}>
                      INGREDIENTS (Bahan Pokok & Sub-Kelompok Opsional)
                    </label>
                    <button
                      type="button"
                      style={{ background: 'transparent', border: 'none', color: 'var(--action-primary)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                      onClick={handleAddIngredientGroup}
                    >
                      + Tambah Sub-Kelompok (Saus/Marinasi/Topping)
                    </button>
                  </div>

                  {/* Base Ingredients */}
                  <div className="recipe-ing-group">
                    <div className="recipe-ing-group-header">
                      <span className="recipe-ing-group-name">Bahan Dasar (Base Ingredients)</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>1 baris per bahan</span>
                    </div>
                    <textarea
                      className="recipe-ing-textarea"
                      rows={4}
                      value={baseIngredients}
                      onChange={e => setBaseIngredients(e.target.value)}
                    />
                  </div>

                  {/* Dynamic Sub-Groups */}
                  {ingredientGroups.map((group, index) => (
                    <div key={index} className="recipe-ing-group" style={{ marginTop: '8px' }}>
                      <div className="recipe-ing-group-header">
                        <span className="recipe-ing-group-name">{group.name}</span>
                        <button
                          type="button"
                          style={{ background: 'transparent', border: 'none', color: 'var(--status-danger)', cursor: 'pointer', fontSize: '0.75rem' }}
                          onClick={() => handleRemoveIngredientGroup(index)}
                        >
                          Hapus
                        </button>
                      </div>
                      <textarea
                        className="recipe-ing-textarea"
                        rows={3}
                        value={Array.isArray(group.items) ? group.items.join('\n') : group.items}
                        onChange={e => handleGroupItemsChange(index, e.target.value)}
                      />
                    </div>
                  ))}
                </div>

                {/* DIRECTIONS */}
                <div className="form-group" style={{ width: '100%' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>DIRECTION (Langkah Memasak Berurutan)</label>
                  <textarea
                    className="recipe-ing-textarea"
                    rows={4}
                    style={{ width: '100%', boxSizing: 'border-box', minHeight: '90px', fontSize: '0.8rem' }}
                    value={directions}
                    onChange={e => setDirections(e.target.value)}
                    placeholder="1 baris per langkah memasak..."
                  />
                </div>
              </div>
            )}

            {/* TAB CONTENT: HTML INSPECTOR */}
            {modalTab === 'html' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Kode HTML standar Android WebView (HtmlSanitizer PHP Parity):</span>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                    onClick={() => {
                      navigator.clipboard.writeText(currentHtmlDescription);
                      alert('HTML resep berhasil disalin!');
                    }}
                  >
                    📋 Salin HTML
                  </button>
                </div>
                <pre style={{ background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xs)', padding: '12px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', overflowX: 'auto', whiteSpace: 'pre-wrap', maxHeight: '400px' }}>
                  {currentHtmlDescription}
                </pre>
              </div>
            )}

            {/* TAB CONTENT: PLAIN TEXT */}
            {modalTab === 'plain' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Format Teks Polos (Dokumentasi & Arsip):</span>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                    onClick={() => {
                      navigator.clipboard.writeText(`${title}\n\nSUMMARY:\n${summary}\n\nINGREDIENTS:\n${baseIngredients}\n\nDIRECTIONS:\n${directions}`);
                      alert('Teks polos disalin!');
                    }}
                  >
                    📋 Salin Teks
                  </button>
                </div>
                <pre style={{ background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xs)', padding: '12px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', overflowX: 'auto', whiteSpace: 'pre-wrap', maxHeight: '400px' }}>
                  {`${title}\n\nSUMMARY:\n${summary}\n\nINGREDIENTS:\n${baseIngredients}\n\nDIRECTIONS:\n${directions}`}
                </pre>
              </div>
            )}

          </div>

          {/* PANE KANAN: GOOGLE PIXEL 7 SIMULATOR */}
          <div className="recipe-pane-simulator">
            <div style={{ marginBottom: '12px', textAlign: 'center' }}>
              <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>📱 Google Pixel 7 Simulator</strong>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>412 × 915 px • WebView Live Preview</div>
            </div>

            {/* Hardware Frame */}
            <div className="recipe-pixel7-device" ref={pixelDeviceRef}>
              <div className="recipe-pixel7-screen">
                
                {/* Punch Hole */}
                <div className="recipe-pixel-punch-hole" />

                {/* Status Bar */}
                <div className="recipe-pixel-status-bar">
                  <span>9:41</span>
                  <span>5G  100% 🔋</span>
                </div>

                {/* App Bar */}
                <div className="recipe-pixel-app-bar">
                  <span>←</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Detail Resep</span>
                  <span>❤️</span>
                  <span>⋮</span>
                </div>

                {/* Scrollable Canvas */}
                <div className="recipe-pixel-webview-body">
                  
                  {/* Media Switcher */}
                  <div className="recipe-pixel-media-tabs">
                    <button
                      type="button"
                      className={`recipe-pixel-media-tab-btn ${pixelMediaTab === 'photo' ? 'active' : ''}`}
                      onClick={() => setPixelMediaTab('photo')}
                    >
                      🖼️ Cover (4:3)
                    </button>
                    <button
                      type="button"
                      className={`recipe-pixel-media-tab-btn ${pixelMediaTab === 'video' ? 'active' : ''}`}
                      onClick={() => setPixelMediaTab('video')}
                    >
                      🎬 Video Ter-Mute (R2)
                    </button>
                  </div>

                  {/* Media Display */}
                  {pixelMediaTab === 'photo' ? (
                    <img
                      src={coverImageUrl}
                      alt={title}
                      className="recipe-pixel-hero-img"
                    />
                  ) : (
                    <div className="recipe-pixel-video-container">
                      <video
                        src={videoR2Url || recipe?.video_url || 'https://assets.mixkit.co/videos/preview/mixkit-vegetables-and-meat-simmering-in-a-pan-43407-large.mp4'}
                        poster={coverImageUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                      />
                      <div className="recipe-video-muted-floating-badge" style={{ top: '6px', left: '6px', fontSize: '0.65rem' }}>
                        <span>🔇 Audio Muted</span>
                      </div>
                    </div>
                  )}

                  {/* Title & Chips */}
                  <div className="recipe-pixel-recipe-title">{title || 'Judul Resep'}</div>
                  <div className="recipe-pixel-chips-row">
                    <span className="recipe-pixel-chip">⏱️ {time}</span>
                    <span className="recipe-pixel-chip">🏷️ {effectiveCategory}</span>
                    {videoR2Url && (
                      <span className="recipe-pixel-chip" style={{ color: 'var(--status-warning)', borderColor: 'var(--status-warning)' }}>
                        🎥 Video R2 Ready
                      </span>
                    )}
                  </div>

                  {/* Rendered HTML content */}
                  <div
                    className="recipe-pixel-webview-content"
                    dangerouslySetInnerHTML={{ __html: currentHtmlDescription }}
                  />

                </div>

                {/* Gesture Navigation Pill */}
                <div className="recipe-pixel-nav-bar">
                  <div className="recipe-pixel-gesture-pill" />
                </div>

              </div>
            </div>

          </div>

        </div>

        {/* Modal Footer */}
        <div className="recipe-modal-footer">
          <div>
            {pushToast && (
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: pushToast.type === 'success' ? 'var(--status-success)' : (pushToast.type === 'error' ? 'var(--status-danger)' : 'var(--text-muted)') }}>
                {pushToast.msg}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Batal</button>
            <button type="button" className="btn btn-outline" onClick={handleDownloadJson}>💾 Unduh JSON</button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleDirectPush}
              disabled={pushing}
            >
              <span>{pushing ? '⏳' : '🚀'}</span>
              <span>{pushing ? 'Mempublikasikan...' : 'Push ke Webadmin Sekarang (Direct API)'}</span>
            </button>
          </div>
        </div>

      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <DedicatedVideoLightbox
          recipe={{
            title,
            source: recipe?.source,
            videoR2Url,
            image: coverImageUrl
          }}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}
