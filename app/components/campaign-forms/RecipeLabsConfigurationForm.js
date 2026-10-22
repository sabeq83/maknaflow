'use client';

import { useState, useEffect } from 'react';
import { VIDEO_MODELS } from '@/lib/words-per-clip-presets';

const LAYOUT_PRESET_METADATA = {
  3: [
    { id: '3_split_left', name: 'Editorial Tri-Split Left', desc: 'Kolom kiri penuh (hero) & 2 blok proses kanan' },
    { id: '3_split_right', name: 'Tri-Split Right Mirror', desc: '2 blok persiapan kiri & kolom kanan penuh (hero)' },
    { id: '3_stacked_horizontal', name: 'Landscape Cascade', desc: '3 strip horizontal bertingkat alur waktu' }
  ],
  4: [
    { id: '4_editorial_split', name: 'Editorial Split (Default)', desc: 'Kolom kiri lebar, 2 proses kanan, banner saji bawah' },
    { id: '4_modern_masonry', name: 'Modern Masonry', desc: 'Banner atas megah diikuti susunan kolom asimetris estetik' },
    { id: '4_landscape_cascade', name: 'Vertical Story Cascade 4', desc: '4 strip bertumpuk naratif proses sekuensial' }
  ],
  5: [
    { id: '5_pentagon_grid', name: 'Pentagon Asymmetric', desc: 'Susunan dinamis 5 modul foto dengan banner bawah' },
    { id: '5_step_cascade', name: 'Story Step-by-Step 5', desc: '5 strip bertingkat dramatis step-by-step' },
    { id: '5_magazine_editorial', name: 'Magazine Editorial', desc: 'Hero banner kolom kiri & 4 grid proses di kanan' }
  ],
  6: [
    { id: '6_magazine_spread', name: 'Magazine Hexa-Grid', desc: 'Tata letak majalah kuliner komprehensif 6 slot' },
    { id: '6_vertical_masonry', name: 'Pinterest Masonry Style', desc: 'Gaya visual masonry pinterest dinamis 6 slot' },
    { id: '6_asymmetric_mosaic', name: 'Modern Asymmetric Mosaic', desc: 'Mosaik asimetris modern untuk resep kaya bumbu' }
  ]
};

const GEMINI_VOICES = [
  { id: 'Kore', name: 'Kore (Female)', avatar: '👩', desc: 'Standard Female (Skincare/Cosmetic)' },
  { id: 'Fenrir', name: 'Fenrir (Male)', avatar: '🧔', desc: 'Deep/Heavy Male (Otomotif/High-End)' },
  { id: 'Puck', name: 'Puck (Male)', avatar: '👦', desc: 'Ceria, Playful (Makanan/Promo Kilat)' },
  { id: 'Charon', name: 'Charon (Male)', avatar: '👨', desc: 'Formal, News Style (Review Tech/Finansial)' },
  { id: 'Leda', name: 'Leda (Female)', avatar: '👵', desc: 'Hangat, Ramah (Edukasi/Ibu Anak)' },
  { id: 'Zephyr', name: 'Zephyr (Male)', avatar: '🧑', desc: 'Kasual, Santai (Storytelling/Daily Vlog)' },
  { id: 'Orus', name: 'Orus (Male)', avatar: '🧔', desc: 'Tegas, Optimis (Motivasi/Online Course)' },
  { id: 'Aoede', name: 'Aoede (Female)', avatar: '👩‍🎨', desc: 'Artistik, Ekspresif (Fashion/Seni)' },
  { id: 'Callirrhoe', name: 'Callirrhoe (Female)', avatar: '👩‍💼', desc: 'Berenergi, Dinamis (Olahraga/Lifestyle)' },
  { id: 'Autonoe', name: 'Autonoe (Female)', avatar: '👩‍🎓', desc: 'Dewasa, Profesional (Bisnis/Corporate)' },
  { id: 'Enceladus', name: 'Enceladus (Male)', avatar: '👨‍🎤', desc: 'Misterius, Berat (Teaser/Trailer)' },
  { id: 'Iapetus', name: 'Iapetus (Male)', avatar: '👴', desc: 'Bijaksana, Ramah (Mentor/Tips Hidup)' },
  { id: 'Umbriel', name: 'Umbriel (Male)', avatar: '👨‍🔬', desc: 'Dingin, Fokus (Dokumenter/Sains)' },
  { id: 'Despina', name: 'Despina (Female)', avatar: '👧', desc: 'Cepat, Riang (TikTok/Tips Singkat)' },
];

const MINIMAX_VOICES = [
  { id: 'Indonesian_casual_reporter_vv2', name: 'Casual Reporter (Male)', avatar: '👨', desc: 'Laki-laki (Casual Reporter - Vv2)' },
  { id: 'Indonesian_compelling_storyteller_vv2', name: 'Compelling Storyteller (Male)', avatar: '👨', desc: 'Laki-laki (Storyteller - Vv2)' },
  { id: 'Indonesian_expressive_podcaster_vv2', name: 'Expressive Podcaster (Male)', avatar: '👨', desc: 'Laki-laki (Podcaster - Vv2)' },
  { id: 'Indonesian_energetic_streamer_vv2', name: 'Energetic Streamer (Male)', avatar: '👨', desc: 'Laki-laki (Streamer - Vv2)' },
  { id: 'Indonesian_intellectual_commentator_vv2', name: 'Intellectual Commentator (Female)', avatar: '👩', desc: 'Perempuan (Commentator - Vv2)' },
  { id: 'Indonesian_professional_anchor_vv2', name: 'Professional Anchor (Female)', avatar: '👩', desc: 'Perempuan (Anchor - Vv2)' },
  { id: 'Indonesian_crisp_reporter_vv2', name: 'Crisp Reporter (Female)', avatar: '👩', desc: 'Perempuan (Crisp Reporter - Vv2)' }
];

export default function RecipeLabsConfigurationForm({
  mode = 'direct', // 'direct' | 'capture'
  initialValues = {},
  onCapture = null,
  onSuccess = null,
  onCancel = null,
  isInline = false
}) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Mode Video vs Static
  const [campaignType, setCampaignType] = useState(initialValues.campaignType || 'static'); // 'static' | 'video'

  // Shared states
  const [brandProfiles, setBrandProfiles] = useState([]);
  const [brandProfileId, setBrandProfileId] = useState(initialValues.brandProfileId || '');
  const [nextcloudParentFolder, setNextcloudParentFolder] = useState(initialValues.nextcloudParentFolder || 'MAKNA_Recipes');
  const [targetDemographic, setTargetDemographic] = useState(initialValues.targetDemographic || 'genz_casual');
  const [targetDemographicCustom, setTargetDemographicCustom] = useState(initialValues.targetDemographicCustom || '');
  const [sourceDeconstructAssetId, setSourceDeconstructAssetId] = useState(initialValues.sourceDeconstructAssetId || '');
  const [deconstructedAssets, setDeconstructedAssets] = useState([]);

  // Static mode states
  const [category, setCategory] = useState(initialValues.category || 'Makanan');
  const [customCategory, setCustomCategory] = useState(initialValues.customCategory || '');
  const [visualStyle, setVisualStyle] = useState(initialValues.visualStyle || 'Food Porn');
  const [targetCount, setTargetCount] = useState(initialValues.targetCount || 1);
  const [enableGlabs, setEnableGlabs] = useState(initialValues.enableGlabs !== false);
  const [imagesPerRecipe, setImagesPerRecipe] = useState(initialValues.imagesPerRecipe || 4);
  const [selectedLayoutId, setSelectedLayoutId] = useState(initialValues.selectedLayoutId || '4_editorial_split');
  const [gridGapSize, setGridGapSize] = useState(initialValues.gridGapSize || 8);
  const [gridBorderRadius, setGridBorderRadius] = useState(initialValues.gridBorderRadius || 12);
  const [gridOuterPadding, setGridOuterPadding] = useState(initialValues.gridOuterPadding || 0);
  const [gridBgColor, setGridBgColor] = useState(initialValues.gridBgColor || '#0f172a');

  // Video mode states
  const [campaignName, setCampaignName] = useState(initialValues.campaignName || '');
  const [contentPillar, setContentPillar] = useState(initialValues.contentPillar || '');
  const [customHook, setCustomHook] = useState(initialValues.customHook || '');
  const [visualActionGuideline, setVisualActionGuideline] = useState(initialValues.visualActionGuideline || '');
  const [customInstruction, setCustomInstruction] = useState(initialValues.customInstruction || '');
  const [narrativeMode, setNarrativeMode] = useState(initialValues.narrativeMode || 'Storytelling');
  const [visualStyleVideo, setVisualStyleVideo] = useState(initialValues.visualStyleVideo || 'Food Cinematic Hyper-Realistic');
  const [targetAi, setTargetAi] = useState(initialValues.targetAi || 'Google Veo (8s)');
  const [videoModel, setVideoModel] = useState(initialValues.videoModel || 'veo_31_lite');
  const [aspectRatio, setAspectRatio] = useState(initialValues.aspectRatio || '9:16');
  const [faceVisibility, setFaceVisibility] = useState(initialValues.faceVisibility || 'Hands-Only');
  const [wordsPerClip, setWordsPerClip] = useState(initialValues.wordsPerClip || '17-19 kata');
  const [enableSocialPost, setEnableSocialPost] = useState(Boolean(initialValues.enableSocialPost));
  const [enableGlabsVideo, setEnableGlabsVideo] = useState(initialValues.enableGlabsVideo !== false);
  const [enableFfmpeg, setEnableFfmpeg] = useState(initialValues.enableFfmpeg !== false);
  const [targetLanguage, setTargetLanguage] = useState(initialValues.targetLanguage || 'id-ID');
  const [voiceProvider, setVoiceProvider] = useState(initialValues.voiceProvider || 'minimax');
  const [voicePersona, setVoicePersona] = useState(initialValues.voicePersona || 'Indonesian_casual_reporter_vv2');
  const [voiceSpeed, setVoiceSpeed] = useState(initialValues.voiceSpeed || 1.0);
  const [voiceVolume, setVoiceVolume] = useState(initialValues.voiceVolume || 1.0);
  const [ttsModelQuality, setTtsModelQuality] = useState(initialValues.ttsModelQuality || 'speech-2.8-turbo');
  const [enableTts, setEnableTts] = useState(initialValues.enableTts !== false);
  const [targetClipsCount, setTargetClipsCount] = useState(initialValues.targetClipsCount || 4);
  const [bridgeAtClip, setBridgeAtClip] = useState(initialValues.bridgeAtClip || 3);
  const [promotionStyle, setPromotionStyle] = useState(initialValues.promotionStyle || 'Softselling');

  useEffect(() => {
    async function fetchSupportingData() {
      try {
        const [resBrands, resAssets] = await Promise.all([
          fetch('/api/brand-profiles').then(r => r.json()).catch(() => ({ profiles: [] })),
          fetch('/api/v2/deconstruct?status=completed').then(r => r.json()).catch(() => ({ assets: [] }))
        ]);
        if (resBrands?.profiles) setBrandProfiles(resBrands.profiles);
        if (resAssets?.assets) setDeconstructedAssets(resAssets.assets);
      } catch (e) {
        console.error('Error fetching supporting data for Recipe Labs form:', e);
      }
    }
    fetchSupportingData();
  }, []);

  const buildPayload = () => {
    const isVideo = campaignType === 'video';
    const payload = isVideo ? {
      category: 'Kuliner',
      custom_category: null,
      visual_style: visualStyleVideo,
      nextcloud_parent_folder: nextcloudParentFolder || 'MAKNA_Recipes',
      post_to_facebook: enableSocialPost ? 1 : 0,
      enable_glabs: enableGlabsVideo ? 1 : 0,
      target_recipe_count: 1,
      campaign_type: 'video',
      brand_profile_id: brandProfileId || null,
      spreadsheet_id: null,
      source_deconstruct_asset_id: sourceDeconstructAssetId || null,
      config_json: {
        campaign_name: campaignName.trim(),
        content_pillar: contentPillar,
        custom_hook: customHook,
        visual_action_guideline: visualActionGuideline,
        custom_instruction: customInstruction,
        brand_profile_id: brandProfileId,
        narrative_mode: narrativeMode,
        visual_style: visualStyleVideo,
        target_ai: targetAi,
        video_model: videoModel,
        aspect_ratio: aspectRatio,
        face_visibility: faceVisibility,
        words_per_clip: wordsPerClip,
        is_bridging_active: false,
        target_clips_count: Number(targetClipsCount),
        bridge_at_clip: Number(bridgeAtClip),
        promotion_style: promotionStyle,
        enable_tts: enableTts,
        voice_provider: voiceProvider,
        voice_persona: voicePersona,
        voice_speed: Number(voiceSpeed),
        voice_volume: Number(voiceVolume),
        tts_model_quality: ttsModelQuality,
        enable_glabs: enableGlabsVideo,
        enable_ffmpeg: enableFfmpeg,
        ffmpeg_sync_option: 'smart_sync',
        ffmpeg_video_scale: 1.1,
        ffmpeg_sfx_volume: 0,
        ffmpeg_bgm_volume: 0,
        enable_social_post: enableSocialPost,
        target_language: targetLanguage,
      }
    } : {
      category,
      custom_category: customCategory,
      visual_style: visualStyle,
      nextcloud_parent_folder: nextcloudParentFolder || 'MAKNA_Recipes',
      post_to_facebook: 0,
      enable_glabs: enableGlabs ? 1 : 0,
      target_recipe_count: targetCount,
      campaign_type: 'static',
      brand_profile_id: brandProfileId || null,
      spreadsheet_id: null,
      config_json: null,
      images_per_recipe: imagesPerRecipe,
      selected_layout_id: selectedLayoutId,
      grid_gap_size: gridGapSize,
      grid_border_radius: gridBorderRadius,
      grid_outer_padding: gridOuterPadding,
      grid_bg_color: gridBgColor,
      source_deconstruct_asset_id: sourceDeconstructAssetId || null
    };

    payload.target_demographic = targetDemographic;
    payload.target_demographic_custom = targetDemographicCustom;
    return payload;
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setErrorMsg('');

    const isVideo = campaignType === 'video';
    if (isVideo && !campaignName.trim()) {
      setErrorMsg('Nama Kampanye wajib diisi untuk Video Reels.');
      return;
    }
    if (!isVideo && category === 'Custom Input' && !customCategory.trim()) {
      setErrorMsg('Harap isi kategori custom jika memilih Custom Input.');
      return;
    }

    const payload = buildPayload();

    if (mode === 'capture') {
      if (onCapture) {
        onCapture(payload);
      }
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/recipe-labs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        if (onSuccess) onSuccess(json);
      } else {
        setErrorMsg(json.error || 'Gagal membuat kampanye resep.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      background: 'var(--surface-raised)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: isInline ? '16px' : '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
            🍳 Konfigurasi Engine Recipe Labs
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Kreasi konten resep kuliner visual (Static Collage Grid atau Video Reels sekuensial).
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.2rem',
              cursor: 'pointer',
              color: 'var(--text-muted)'
            }}
          >
            ✕
          </button>
        )}
      </div>

      {errorMsg && (
        <div style={{
          padding: '10px 14px',
          background: 'var(--status-danger-soft)',
          border: '1px solid var(--status-danger)',
          color: 'var(--status-danger)',
          borderRadius: '8px',
          fontSize: '0.85rem'
        }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Mode Sub-engine: Static vs Video */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          type="button"
          onClick={() => setCampaignType('static')}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '8px',
            border: campaignType === 'static' ? '2px solid var(--action-primary)' : '1px solid var(--border)',
            background: campaignType === 'static' ? 'var(--surface-interactive)' : 'var(--surface)',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
            🖼️ Static Recipe Collage (Grid Image)
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Multi-slot grid koordinat majalah kuliner (3 - 6 slot foto beresolusi tinggi).
          </div>
        </button>
        <button
          type="button"
          onClick={() => setCampaignType('video')}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '8px',
            border: campaignType === 'video' ? '2px solid var(--action-primary)' : '1px solid var(--border)',
            background: campaignType === 'video' ? 'var(--surface-interactive)' : 'var(--surface)',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
            🎬 Video Reels Recipe (Sekuensial Video)
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Storyboard video masak step-by-step lengkap narasi TTS & render video AI.
          </div>
        </button>
      </div>

      {/* Common inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
            Brand Profile
          </label>
          <select
            value={brandProfileId}
            onChange={e => setBrandProfileId(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
          >
            <option value="">-- Tanpa Brand Profile Khusus --</option>
            {brandProfiles.map(b => (
              <option key={b.id} value={b.id}>{b.name || b.brand_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
            Nextcloud Parent Folder
          </label>
          <input
            type="text"
            value={nextcloudParentFolder}
            onChange={e => setNextcloudParentFolder(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {/* Conditional: Static vs Video */}
      {campaignType === 'static' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Kategori Resep</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
              >
                <option value="Makanan">Makanan Tradisional & Modern</option>
                <option value="Minuman">Minuman & Mocktail</option>
                <option value="Camilan">Camilan & Dessert</option>
                <option value="Herbal">Minuman Herbal & Sehat</option>
                <option value="Custom Input">Custom Input Resep</option>
              </select>
            </div>
            {category === 'Custom Input' && (
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Nama Menu Resep Custom</label>
                <input
                  type="text"
                  value={customCategory}
                  onChange={e => setCustomCategory(e.target.value)}
                  placeholder="Misal: Es Kopi Susu Aren Gula Jawa"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
                />
              </div>
            )}
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Gaya Visual Foto</label>
              <select
                value={visualStyle}
                onChange={e => setVisualStyle(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
              >
                <option value="Food Porn">Food Porn (Glossy, Rich, Close-up)</option>
                <option value="Rustic Table">Rustic Table (Kayu, Alami, Hangat)</option>
                <option value="Minimalist Studio">Minimalist Studio (Bersih, Cerah)</option>
                <option value="Street Food Authentic">Street Food Authentic (Asap, Aksi)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Jumlah Slot Foto Grid</label>
              <select
                value={imagesPerRecipe}
                onChange={e => {
                  const val = Number(e.target.value);
                  setImagesPerRecipe(val);
                  if (LAYOUT_PRESET_METADATA[val]) {
                    setSelectedLayoutId(LAYOUT_PRESET_METADATA[val][0].id);
                  }
                }}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
              >
                <option value={3}>3 Slot Foto</option>
                <option value={4}>4 Slot Foto (Default)</option>
                <option value={5}>5 Slot Foto</option>
                <option value={6}>6 Slot Foto</option>
              </select>
            </div>
          </div>

          {/* Layout Selector */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Pilihan Preset Tata Letak Grid
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
              {(LAYOUT_PRESET_METADATA[imagesPerRecipe] || []).map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedLayoutId(preset.id)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: selectedLayoutId === preset.id ? '2px solid var(--action-primary)' : '1px solid var(--border)',
                    background: selectedLayoutId === preset.id ? 'var(--surface-interactive)' : 'var(--surface)',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>{preset.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{preset.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={enableGlabs} onChange={e => setEnableGlabs(e.target.checked)} />
              Generate Gambar Nyata via G-Labs (Imagen 3 / Flux)
            </label>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Nama Kampanye Video Reels</label>
            <input
              type="text"
              value={campaignName}
              onChange={e => setCampaignName(e.target.value)}
              placeholder="Contoh: Reels Resep Rendang Daging Padang Asli"
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Pilar Konten / Deskripsi Resep</label>
            <textarea
              rows={2}
              value={contentPillar}
              onChange={e => setContentPillar(e.target.value)}
              placeholder="Jelaskan tahapan resep atau fokus keunikan masakan..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Model Video</label>
              <select
                value={videoModel}
                onChange={e => setVideoModel(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
              >
                {VIDEO_MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Voice Persona</label>
              <select
                value={voicePersona}
                onChange={e => setVoicePersona(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
              >
                {(voiceProvider === 'gemini' ? GEMINI_VOICES : MINIMAX_VOICES).map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Jumlah Klip Video</label>
              <input
                type="number"
                min={2}
                max={6}
                value={targetClipsCount}
                onChange={e => setTargetClipsCount(Number(e.target.value))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Form Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Batal
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            padding: '10px 22px',
            borderRadius: '8px',
            border: 'none',
            background: 'var(--action-primary)',
            color: 'var(--on-action-primary)',
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: '0.9rem',
            opacity: submitting ? 0.6 : 1
          }}
        >
          {submitting
            ? 'Menyimpan...'
            : (mode === 'capture'
                ? 'Gunakan Konfigurasi Recipe Labs'
                : '🚀 Buat Kampanye Recipe Labs')}
        </button>
      </div>
    </div>
  );
}
