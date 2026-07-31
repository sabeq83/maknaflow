'use client';

import Sidebar from '../components/Sidebar';
import { useState, useEffect, useRef } from 'react';

const GEMINI_VOICES = [
  { id: 'Kore', name: 'Kore (Female)', avatar: '👩', desc: 'Standard Female (Skincare/Cosmetic)' },
  { id: 'Fenrir', name: 'Fenrir (Male)', avatar: '🧔', desc: 'Deep/Heavy Male (Otomotif/High-End)' },
  { id: 'Puck', name: 'Puck (Male)', avatar: '👦', desc: 'Ceria, Playful (Makanan/Promo Kilat)' },
  { id: 'Charon', name: 'Charon (Male)', avatar: '👨', desc: 'Formal, News Style (Review Tech/Finansial)' },
  { id: 'Leda', name: 'Leda (Female)', avatar: '👵', desc: 'Hangat, Ramah (Edukasi/Ibu Anak)' },
  { id: 'Zephyr', name: 'Zephyr (Male)', avatar: 'sn', desc: 'Kasual, Santai (Storytelling/Daily Vlog)' },
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

const MINIMAX_ENGLISH_VOICES = [
  { id: 'English_Resonant_Man', name: 'Resonant Man (Male)', avatar: '👨', desc: 'English Resonant Man' },
  { id: 'English_Trustworth_Man', name: 'Trustworthy Man (Male)', avatar: '👨', desc: 'English Trustworthy Man' },
  { id: 'English_causual_narrator_vv1', name: 'Casual Narrator (Male)', avatar: '👨', desc: 'English Casual Narrator' },
  { id: 'English_causual_podcast_vv1', name: 'Casual Podcast (Male)', avatar: '👨', desc: 'English Casual Podcast' },
  { id: 'English_expressive_host__vv1', name: 'Expressive Host (Male)', avatar: '👨', desc: 'English Expressive Host' },
  { id: 'English_instructive_professor_vv1', name: 'Instructive Professor (Female)', avatar: '👩', desc: 'English Instructive Professor' },
  { id: 'English_nursery_teacher_vv2', name: 'Nursery Teacher (Female)', avatar: '👩', desc: 'English Nursery Teacher' },
  { id: 'English_captivating_female1', name: 'Captivating Female (Female)', avatar: '👩', desc: 'English Captivating Female' },
  { id: 'English_radiant_girl', name: 'Radiant Girl (Female)', avatar: '👩', desc: 'English Radiant Girl' },
  { id: 'English_CalmWoman', name: 'Calm Woman (Female)', avatar: '👩', desc: 'English Calm Woman' }
];

export default function RecipeLabsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  const terminalRef = useRef(null);
  const [isSchedulerActive, setIsSchedulerActive] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState('Belum ada log aktivitas Recipe Labs.');
  const [showGuide, setShowGuide] = useState(false);

  async function fetchSchedulerStatus() {
    try {
      const res = await fetch('/api/recipe-labs/scheduler-control');
      const data = await res.json();
      if (data.success) setIsSchedulerActive(data.isSchedulerActive);
    } catch (e) {}
  }

  async function pollLogs() {
    try {
      const res = await fetch(`/api/system-logs?type=recipe&t=${Date.now()}`);
      if (res.ok) {
        const text = await res.text();
        const lines = text.split('\n');
        const last500 = lines.slice(-500).join('\n');
        setTerminalLogs(last500 || 'Belum ada log aktivitas Recipe Labs.');
      }
    } catch (e) {}
  }

  async function toggleGlobalScheduler() {
    const nextState = !isSchedulerActive;
    try {
      const res = await fetch('/api/recipe-labs/scheduler-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedulerStatus: nextState })
      });
      const json = await res.json();
      if (json.success) {
        setIsSchedulerActive(nextState);
        pollLogs();
      }
    } catch (e) {}
  }
  const [submitting, setSubmitting] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [campaignDetail, setCampaignDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Form State
  const [accountName, setAccountName] = useState('');
  const [category, setCategory] = useState('Makanan');
  const [customCategory, setCustomCategory] = useState('');
  const [visualStyle, setVisualStyle] = useState('Food Porn');
  const [targetDemographic, setTargetDemographic] = useState('genz_casual');
  const [targetDemographicCustom, setTargetDemographicCustom] = useState('');
  const [nextcloudParentFolder, setNextcloudParentFolder] = useState('MAKNA_Recipes');
  const [postToFacebook, setPostToFacebook] = useState(false);
  const [enableGlabs, setEnableGlabs] = useState(true);
  const [targetCount, setTargetCount] = useState(1);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [campaignType, setCampaignType] = useState(null); // default null (start with no selection)
  const [brandProfileId, setBrandProfileId] = useState('');
  const [brandProfiles, setBrandProfiles] = useState([]);
  const [deconstructedAssets, setDeconstructedAssets] = useState([]);
  const [sourceDeconstructAssetId, setSourceDeconstructAssetId] = useState('');

  // Collage configurations
  const [imagesPerRecipe, setImagesPerRecipe] = useState(4);
  const [selectedLayoutId, setSelectedLayoutId] = useState('4_editorial_split');
  const [gridGapSize, setGridGapSize] = useState(12);
  const [gridBorderRadius, setGridBorderRadius] = useState(16);
  const [gridOuterPadding, setGridOuterPadding] = useState(16);
  const [gridBgColor, setGridBgColor] = useState('#0d0d12');

  useEffect(() => {
    if (imagesPerRecipe === 3) setSelectedLayoutId('3_split_left');
    else if (imagesPerRecipe === 4) setSelectedLayoutId('4_editorial_split');
    else if (imagesPerRecipe === 5) setSelectedLayoutId('5_pentagon_grid');
    else if (imagesPerRecipe === 6) setSelectedLayoutId('6_magazine_spread');
  }, [imagesPerRecipe]);

  // Accordion active index
  const [activeAccordion, setActiveAccordion] = useState(0);

  // Section 1: Basic Creative Strategy
  const [campaignName, setCampaignName] = useState('');
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [contentPillar, setContentPillar] = useState('');
  const [customHook, setCustomHook] = useState('');
  const [visualActionGuideline, setVisualActionGuideline] = useState('');
  const [customInstruction, setCustomInstruction] = useState('');

  // Section 2: Aesthetics & Visual Settings
  const [narrativeMode, setNarrativeMode] = useState('Storytelling');
  const [visualStyleVideo, setVisualStyleVideo] = useState('Food Porn'); // Dibatasi Macrophotography, Food Porn, Cinematic Faceless
  const [targetAi, setTargetAi] = useState('Google Veo (8s)');
  const [videoModel, setVideoModel] = useState('veo_31_lite');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [faceVisibility, setFaceVisibility] = useState('Faceless');
  const [wordsPerClip, setWordsPerClip] = useState('17-19 kata');

  // Section 3: Product Bridging Settings (Default Inactive)
  const [isBridgingActive, setIsBridgingActive] = useState(false);
  const [targetClipsCount, setTargetClipsCount] = useState(4);
  const [bridgeAtClip, setBridgeAtClip] = useState(2);
  const [promotionStyle, setPromotionStyle] = useState('Softselling');
  const [bridgingMode, setBridgingMode] = useState('select_existing');
  const [products, setProducts] = useState([]);
  const [targetProductId, setTargetProductId] = useState('');
  const [manualProductName, setManualProductName] = useState('');
  const [manualProductDesc, setManualProductDesc] = useState('');
  const [manualProductUsp, setManualProductUsp] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [visualMode, setVisualMode] = useState('hybrid_lock');

  // Section 4: Visual Swap Overrides (Default Inactive)
  const [isVsoActive, setIsVsoActive] = useState(false);
  const [characterConcept, setCharacterConcept] = useState('faceless');
  const [subjectDemographic, setSubjectDemographic] = useState('syari_classic');
  const [wardrobeStyle, setWardrobeStyle] = useState('amber_terracotta');
  const [wardrobeStyleCustom, setWardrobeStyleCustom] = useState('');
  const [lightingStyle, setLightingStyle] = useState('window_daylight');
  const [lightingStyleCustom, setLightingStyleCustom] = useState('');

  // Section 5: Workflow & Audio Settings (Default Inactive)
  const [enableTts, setEnableTts] = useState(false);
  const [voiceProvider, setVoiceProvider] = useState('minimax');
  const [voicePersona, setVoicePersona] = useState('Indonesian_professional_anchor_vv2');
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [voiceVolume, setVoiceVolume] = useState(1.0);
  const [ttsModelQuality, setTtsModelQuality] = useState('speech-2.8-turbo');
  const [enableGlabsVideo, setEnableGlabsVideo] = useState(false);
  const [enableFfmpeg, setEnableFfmpeg] = useState(false);
  const [syncMode, setSyncMode] = useState('auto');
  const [ffmpegSyncOption, setFfmpegSyncOption] = useState('smart_sync');
  const [ffmpegVideoScale, setFfmpegVideoScale] = useState(1.0);
  const [ffmpegSfxVolume, setFfmpegSfxVolume] = useState(0.0);
  const [ffmpegBgmVolume, setFfmpegBgmVolume] = useState(0.15);
  const [enableSocialPost, setEnableSocialPost] = useState(false);
  const [postYoutube, setPostYoutube] = useState(false);
  const [postTiktok, setPostTiktok] = useState(false);
  const [postFacebook, setPostFacebook] = useState(false);
  const [facebookPageId, setFacebookPageId] = useState('');
  const [facebookServerUrl, setFacebookServerUrl] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('id-ID');
  const [facebookPages, setFacebookPages] = useState([]);

  // UI helpers
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [postingFbId, setPostingFbId] = useState(null);

  function handleCopyPrompt(key, text) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  }

  async function handleManualFbPost(itemId, postType = 'text_only') {
    setPostingFbId(itemId);
    try {
      const res = await fetch(`/api/recipe-labs/items/${itemId}/post-fb`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_type: postType })
      });
      const json = await res.json();
      if (json.success) {
        alert(`🟢 Draft postingan berhasil dikirim ke Facebook Page! (ID Draft: ${json.data.fb_post_id})`);
        if (selectedCampaign) fetchCampaignDetail(selectedCampaign);
      } else {
        alert(`🔴 Gagal mengirim draft FB: ${json.error}`);
      }
    } catch (err) {
      alert(`🔴 Terjadi kesalahan: ${err.message}`);
    } finally {
      setPostingFbId(null);
    }
  }

  const categoryOptions = [
    'Makanan',
    'Minuman',
    'Kue',
    'Dessert',
    'Jajanan Pasar',
    'Custom Input'
  ];

  const visualStyleOptions = [
    'Food Porn',
    'Macrophotography',
    'Cinematic Studio',
    'Rustic Aesthetic'
  ];

  useEffect(() => {
    fetchCampaigns();
    fetchBrandProfiles();
    fetchProductsAndPages();
    fetchSchedulerStatus();
    fetchDeconstructedAssets();
    pollLogs();

    const params = new URLSearchParams(window.location.search);
    const deconstructId = params.get('source_deconstruct_id');
    if (deconstructId) {
      setSourceDeconstructAssetId(deconstructId);
      setCampaignType('static'); // Auto open form static
    }

    const interval = setInterval(fetchCampaigns, 5000);
    const logInterval = setInterval(pollLogs, 3000);
    return () => {
      clearInterval(interval);
      clearInterval(logInterval);
    };
  }, []);

  useEffect(() => {
    if (sourceDeconstructAssetId && deconstructedAssets.length > 0) {
      const selected = deconstructedAssets.find(a => a.id === sourceDeconstructAssetId);
      if (selected && selected.recipe_suggestion) {
        setCategory('Custom Input');
        setCustomCategory(selected.recipe_suggestion);
        setCampaignName(`Reels - ${selected.recipe_suggestion}`);
        setContentPillar(`Membuat resep berdasarkan video: ${selected.recipe_suggestion}`);
      }
    }
  }, [sourceDeconstructAssetId, deconstructedAssets]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  useEffect(() => {
    if (voiceProvider === 'gemini') {
      setVoicePersona('Kore');
    } else {
      if (targetLanguage === 'en-US') {
        setVoicePersona('English_Resonant_Man');
      } else {
        setVoicePersona('Indonesian_professional_anchor_vv2');
      }
    }
  }, [voiceProvider, targetLanguage]);

  async function fetchDeconstructedAssets() {
    try {
      const res = await fetch('/api/recipe-labs/deconstructed-assets');
      const json = await res.json();
      if (json.success) {
        setDeconstructedAssets(json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch deconstructed assets:', err);
    }
  }

  async function fetchProductsAndPages() {
    try {
      const res1 = await fetch('/api/v2/products');
      const json1 = await res1.json();
      if (json1.success) setProducts(json1.data || []);
      
      const res2 = await fetch('/api/settings/facebook-pages');
      const json2 = await res2.json();
      if (json2.success && json2.pages) {
        setFacebookPages(json2.pages);
        if (json2.pages.length > 0) {
          setFacebookPageId(json2.pages[0].id);
        }
      }

      const res3 = await fetch('/api/settings');
      const json3 = await res3.json();
      if (json3.success && json3.data?.fb_server_url) {
        setFacebookServerUrl(json3.data.fb_server_url);
      }
    } catch (e) {
      console.error('Failed to load products or facebook pages helper:', e);
    }
  }

  async function fetchBrandProfiles() {
    try {
      const res = await fetch('/api/v2/brand-profiles');
      const json = await res.json();
      if (json.success) {
        setBrandProfiles(json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch brand profiles:', err);
    }
  }

  useEffect(() => {
    if (selectedCampaign) {
      fetchCampaignDetail(selectedCampaign);
    }
  }, [selectedCampaign]);

  async function fetchCampaigns() {
    try {
      const res = await fetch('/api/recipe-labs');
      const json = await res.json();
      if (json.success) {
        setCampaigns(json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch recipe campaigns:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCampaignDetail(id) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/recipe-labs/${id}`);
      const json = await res.json();
      if (json.success) {
        setCampaignDetail(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch campaign detail:', err);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const isVideo = campaignType === 'video';

    if (isVideo) {
      if (!campaignName.trim()) {
        setErrorMsg('Nama Kampanye wajib diisi untuk Video Reels.');
        return;
      }
    } else {
      if (category === 'Custom Input' && !customCategory.trim()) {
        setErrorMsg('Harap isi kategori custom jika memilih Custom Input.');
        return;
      }
    }

    if (!isVideo && !nextcloudParentFolder.trim()) {
      setErrorMsg('Harap isi Parent Folder Nextcloud.');
      return;
    }

    setSubmitting(true);
    try {
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
        spreadsheet_id: spreadsheetId || null,
        source_deconstruct_asset_id: sourceDeconstructAssetId || null,
        config_json: {
          campaign_name: campaignName,
          spreadsheet_id: spreadsheetId,
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
          is_bridging_active: isBridgingActive,
          target_clips_count: Number(targetClipsCount),
          bridge_at_clip: Number(bridgeAtClip),
          promotion_style: promotionStyle,
          bridging_mode: bridgingMode,
          target_product_id: targetProductId,
          manual_product_name: manualProductName,
          manual_product_desc: manualProductDesc,
          manual_product_usp: manualProductUsp,
          product_url: productUrl,
          visual_mode: visualMode,
          is_vso_active: isVsoActive,
          character_concept: characterConcept,
          subject_demographic: subjectDemographic,
          wardrobe_style: wardrobeStyle,
          wardrobe_style_custom: wardrobeStyleCustom,
          lighting_style: lightingStyle,
          lighting_style_custom: lightingStyleCustom,
          enable_tts: enableTts,
          voice_provider: voiceProvider,
          voice_persona: voicePersona,
          voice_speed: Number(voiceSpeed),
          voice_volume: Number(voiceVolume),
          tts_model_quality: ttsModelQuality,
          enable_glabs: enableGlabsVideo,
          enable_ffmpeg: enableFfmpeg,
          ffmpeg_sync_option: ffmpegSyncOption,
          ffmpeg_video_scale: Number(ffmpegVideoScale),
          ffmpeg_sfx_volume: Number(ffmpegSfxVolume),
          ffmpeg_bgm_volume: Number(ffmpegBgmVolume),
          enable_social_post: enableSocialPost,
          post_youtube: postYoutube,
          post_tiktok: postTiktok,
          post_facebook: enableSocialPost,
          facebook_page_id: facebookPageId,
          facebook_server_url: facebookServerUrl,
          target_language: targetLanguage,
        }
      } : {
        category,
        custom_category: customCategory,
        visual_style: visualStyle,
        nextcloud_parent_folder: nextcloudParentFolder,
        post_to_facebook: postToFacebook,
        enable_glabs: enableGlabs,
        target_recipe_count: targetCount,
        campaign_type: 'static',
        brand_profile_id: null,
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

      body.target_demographic = targetDemographic;
      body.target_demographic_custom = targetDemographicCustom;
      const res = await fetch('/api/recipe-labs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (json.success) {
        setSuccessMsg(campaignType === 'video'
          ? 'Kampanye Reels Video Storyboard berhasil dibuat! Worker sedang memproses.'
          : (enableGlabs 
              ? 'Kampanye resep berhasil dibuat! Worker sedang memproses alur sekuensial.' 
              : 'Kampanye resep (Mode Teks & Prompt Only) berhasil dibuat!'));
        fetchCampaigns();
        if (json.data?.campaign_id) {
          setSelectedCampaign(json.data.campaign_id);
        }
      } else {
        setErrorMsg(json.error || 'Gagal membuat kampanye resep.');
      }
    } catch (err) {
      setErrorMsg('Terjadi kesalahan jaringan: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus kampanye resep ini?')) return;
    try {
      const res = await fetch(`/api/recipe-labs/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        if (selectedCampaign === id) {
          setSelectedCampaign(null);
          setCampaignDetail(null);
        }
        fetchCampaigns();
      }
    } catch (err) {
      alert('Gagal menghapus kampanye: ' + err.message);
    }
  }

  function renderRecipePipeline(item, campaign) {
    const glabsOn = campaign?.enable_glabs !== 0;
    const s = item.status;

    const getStageStatus = (stage) => {
      if (s === 'failed') return 'danger';
      
      if (stage === 'gemini') {
        if (['pending_gemini'].includes(s)) return 'pending';
        if (['generating_text'].includes(s)) return 'active';
        return 'success';
      }
      
      if (stage === 'glabs') {
        if (['pending_gemini', 'generating_text'].includes(s)) return 'pending';
        if (['pending_glabs', 'generating_images'].includes(s)) return 'active';
        return 'success';
      }

      if (stage === 'exporter') {
        if (['pending_gemini', 'generating_text', 'pending_glabs', 'generating_images'].includes(s)) return 'pending';
        if (['pending_export', 'exporting'].includes(s)) return 'active';
        return 'success';
      }

      return 'pending';
    };

    const stages = glabsOn ? [
      { label: 'Gemini Resep', status: getStageStatus('gemini') },
      { label: 'G-Labs Gambar', status: getStageStatus('glabs') },
      { label: 'Grid & NC Export', status: getStageStatus('exporter') }
    ] : [
      { label: 'Gemini Resep & T2I', status: getStageStatus('gemini') }
    ];

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 6, marginBottom: 12 }}>
        {stages.map((stage, sIdx) => {
          let color = 'var(--text-muted)';
          let bg = 'rgba(255, 255, 255, 0.05)';
          let border = '1px solid rgba(255, 255, 255, 0.1)';
          let labelText = stage.label;
          let anim = 'none';

          if (stage.status === 'success') {
            color = '#fff';
            bg = 'rgba(46, 204, 113, 0.15)';
            border = '1px solid rgba(46, 204, 113, 0.5)';
            labelText = `✓ ${stage.label}`;
          } else if (stage.status === 'danger') {
            color = '#fff';
            bg = 'rgba(231, 76, 60, 0.15)';
            border = '1px solid rgba(231, 76, 60, 0.5)';
            labelText = `✗ ${stage.label}`;
          } else if (stage.status === 'active') {
            color = '#fff';
            bg = 'rgba(52, 152, 219, 0.25)';
            border = '1px solid var(--accent-light)';
            labelText = `⏳ ${stage.label}`;
          }

          return (
            <div key={stage.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                padding: '3px 8px',
                borderRadius: 4,
                background: bg,
                color: color,
                fontWeight: 600,
                fontSize: '0.68rem',
                border: border,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}>
                {labelText}
              </span>
              {sIdx < stages.length - 1 && <span style={{ color: 'rgba(255, 255, 255, 0.2)', fontSize: '0.75rem', marginLeft: 2 }}>➔</span>}
            </div>
          );
        })}
      </div>
    );
  }

  // Calculate quick stats
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter(c => c.status === 'processing').length;
  const completedCampaigns = campaigns.filter(c => c.status === 'completed').length;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-container">
          {/* Header */}
          <div className="page-header">
            <h2>🍳 Recipe Labs</h2>
            <p>Generator konten resep otomatis (Teks Markdown + 4 Gambar Instruksional + Grid Collage 2x2 + Ekspor Nextcloud Hub)</p>
            
            <button 
              onClick={() => setShowGuide(!showGuide)}
              style={{
                marginTop: '10px',
                padding: '6px 14px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'var(--accent)';
                e.currentTarget.style.borderColor = 'var(--accent)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
              }}
            >
              {showGuide ? '✖ Tutup Panduan' : '📖 Panduan Penggunaan'}
            </button>

            {showGuide && (
              <div style={{
                marginTop: '16px',
                background: 'rgba(30, 30, 30, 0.75)',
                backdropFilter: 'blur(12px)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '20px',
                textAlign: 'left',
                color: 'var(--text)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                lineHeight: '1.6'
              }}>
                <h4 style={{ color: 'var(--accent)', marginTop: 0, marginBottom: '10px', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🍳 Panduan Operasional Recipe Labs
                </h4>
                
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Recipe Labs adalah platform pembuatan konten kuliner otomatis dalam bentuk bundel resep (markdown + infografis gambar 2x2) atau naskah/storyboard video reels berdurasi penuh.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <h5 style={{ color: '#fff', marginTop: 0, marginBottom: '6px', fontSize: '0.9rem' }}>1. Kampanye Static (Gambar & Resep)</h5>
                    <ul style={{ paddingLeft: '16px', fontSize: '0.8rem', margin: 0, color: 'var(--text-muted)' }}>
                      <li><strong>Output:</strong> Dokumen Resep (Markdown) + 4 Gambar T2I (Bahan mentah, Proses, Matang, Plating) + Grid Poster 2x2.</li>
                      <li><strong>G-Labs:</strong> Menggunakan model <code>nano_banana_pro</code> (rasio 1:1) untuk merender visual instruksional yang estetis secara otomatis.</li>
                      <li><strong>Nextcloud:</strong> Bundel resep diunggah ke folder <code>/{"{"}ParentFolder{"}"}/{"{"}Category{"}"}_{"{"}Title{"}"}</code>.</li>
                    </ul>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <h5 style={{ color: '#fff', marginTop: 0, marginBottom: '6px', fontSize: '0.9rem' }}>2. Kampanye Video (Reels Storyboard)</h5>
                    <ul style={{ paddingLeft: '16px', fontSize: '0.8rem', margin: 0, color: 'var(--text-muted)' }}>
                      <li><strong>Output:</strong> 5-Module Storyboard + Naskah VO + Prompt Veo + Metadata SEO/DNA + Render Audio + Autopost.</li>
                      <li><strong>Integrasi Sheets:</strong> Otomatis menyinkronkan data visual, naskah, dan prompt ke tab Sheets yang terhubung.</li>
                      <li><strong>Audio-Video Muxing:</strong> Render suara pengisi otomatis (TTS Minimax/Gemini) dan sinkronisasi durasi video via FFmpeg.</li>
                    </ul>
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 171, 0, 0.06)', border: '1px solid rgba(255, 171, 0, 0.2)', padding: '10px 14px', borderRadius: '6px', fontSize: '0.8rem', color: '#ffb300' }}>
                  <strong>💡 Cara Menjalankan Kampanye:</strong> Setelah membuat kampanye baru, pastikan <strong>Global Scheduler Status</strong> di atas bernilai <strong>ACTIVE</strong> agar antrean task dijalankan oleh background worker. Pantau kemajuan status melalui terminal log di bagian bawah.
                </div>

                <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={() => setShowGuide(false)}
                    style={{
                      padding: '5px 12px',
                      background: 'rgba(255,255,255,0.08)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      transition: 'background 0.2s',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  >
                    Tutup Panduan
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div className="stats-grid" style={{ marginBottom: '24px' }}>
            <div className="stat-card">
              <div className="stat-label">Total Kampanye</div>
              <div className="stat-value accent">{totalCampaigns}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Sedang Diproses</div>
              <div className="stat-value warning">{activeCampaigns}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Selesai (Completed)</div>
              <div className="stat-value success">{completedCampaigns}</div>
            </div>
          </div>

          {/* Status Skeduler Recipe Labs */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            padding: 16, marginBottom: 20,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12
          }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>⚙️ Status Skeduler Recipe Labs</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>Mengontrol jalannya antrean pembuatan konten resep otomatis di memori.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', padding: '4px 10px', borderRadius: 12,
                background: isSchedulerActive ? 'rgba(46, 204, 113, 0.15)' : 'rgba(235, 77, 75, 0.15)',
                color: isSchedulerActive ? 'var(--success)' : 'var(--danger)',
                border: `1px solid ${isSchedulerActive ? 'rgba(46, 204, 113, 0.3)' : 'rgba(235, 77, 75, 0.3)'}`
              }}>
                {isSchedulerActive ? '🟢 SKEDULER AKTIF' : '🔴 SKEDULER MATI'}
              </span>
              <button
                type="button"
                onClick={toggleGlobalScheduler}
                className={`btn ${isSchedulerActive ? 'btn-danger' : 'btn-success'}`}
                style={{
                  fontSize: '0.8rem', padding: '6px 16px', fontWeight: 600,
                  boxShadow: isSchedulerActive ? '0 0 15px rgba(235, 77, 75, 0.4)' : '0 0 15px rgba(46, 204, 113, 0.4)',
                  border: isSchedulerActive ? '1px solid rgba(235, 77, 75, 0.6)' : '1px solid rgba(46, 204, 113, 0.6)'
                }}
              >
                {isSchedulerActive ? '🛑 STOP SKEDULER' : '▶️ START SKEDULER'}
              </button>
            </div>
          </div>

          {/* System Poller Logger */}
          <div className="card" style={{ padding: '0', background: '#07070a', border: '1px solid var(--border)', marginBottom: '24px' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0b0b12' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: isSchedulerActive ? '#00b894' : '#ef4444', display: 'inline-block', boxShadow: isSchedulerActive ? '0 0 8px #00b894' : '0 0 8px #ef4444' }}></span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>SYSTEM POLLER LOGGER</span>
              </div>
              <button onClick={pollLogs} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>[Refresh Log]</button>
            </div>
            <pre ref={terminalRef} style={{ margin: 0, padding: '20px', background: '#07070a', color: '#20c20e', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', maxHeight: '220px', overflowY: 'auto', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
              {terminalLogs}
            </pre>
          </div>

          {/* Form Card (Collapsible, Default Closed) */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: showConfigForm ? '0 0 16px 0' : 0 }}>
              <span><span className="icon">⚡</span> Konfigurasi Kampanye Resep</span>
              <button
                type="button"
                className={`btn btn-sm ${showConfigForm ? 'btn-secondary' : 'btn-primary'}`}
                onClick={() => setShowConfigForm(!showConfigForm)}
              >
                {showConfigForm ? '✖ Batal / Tutup' : '➕ Buat Kampanye Resep Baru'}
              </button>
            </div>

            {errorMsg && (
              <div style={{ padding: '12px', background: 'var(--danger-glow)', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div style={{ padding: '12px', background: 'var(--success-glow)', border: '1px solid var(--success)', color: 'var(--success)', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
                {successMsg}
              </div>
            )}

            {showConfigForm && (
              <div>
                {/* 1. Selector Tipe Kampanye (Berbasis Kartu seperti Autopilot) */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '10px', fontWeight: '500' }}>
                    Pilih Tipe Kampanye Recipe Labs
                  </label>
                  
                  {campaignType === null ? (
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      <div 
                        className="campaign-card"
                        onClick={() => setCampaignType('static')}
                        style={{
                          cursor: 'pointer',
                          flex: 1,
                          minWidth: '220px',
                          background: 'var(--bg-glass)',
                          border: '1px solid var(--border)',
                          borderRadius: '12px',
                          padding: '20px',
                          transition: 'var(--transition)',
                          boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                        }}
                      >
                        <div className="icon" style={{ fontSize: '2rem', marginBottom: '10px' }}>🖼️</div>
                        <div className="title" style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-primary)' }}>Static Post (Gambar & Teks)</div>
                        <div className="desc" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: '1.4' }}>
                          Membuat teks resep lengkap beserta 4 gambar instruksional AI dan kolase 2x2 grid poster untuk media sosial.
                        </div>
                      </div>

                      <div 
                        className="campaign-card"
                        onClick={() => setCampaignType('video')}
                        style={{
                          cursor: 'pointer',
                          flex: 1,
                          minWidth: '220px',
                          background: 'var(--bg-glass)',
                          border: '1px solid var(--border)',
                          borderRadius: '12px',
                          padding: '20px',
                          transition: 'var(--transition)',
                          boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                        }}
                      >
                        <div className="icon" style={{ fontSize: '2rem', marginBottom: '10px' }}>🎬</div>
                        <div className="title" style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-primary)' }}>Reels Video Storyboard (Naskah & DNA)</div>
                        <div className="desc" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: '1.4' }}>
                          Menyusun storyboard Reels 5-Module secara koheren dengan durasi Hook 4s (Veo Omni) dan klip lainnya 8s, dilengkapi Video DNA.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      background: 'rgba(255,255,255,0.02)', 
                      border: '1px solid var(--accent)', 
                      borderRadius: '12px', 
                      padding: '16px 20px',
                      boxShadow: '0 0 15px var(--accent-glow)',
                      marginBottom: '20px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ fontSize: '2.2rem' }}>
                          {campaignType === 'static' ? '🖼️' : '🎬'}
                        </span>
                        <div>
                          <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                            {campaignType === 'static' ? 'Tipe Aktif: Static Post Campaign' : 'Tipe Aktif: Reels Video Storyboard'}
                          </strong>
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {campaignType === 'static' 
                              ? 'Generasi naskah resep lengkap terintegrasi dengan generator gambar instruksional 4-fase.' 
                              : 'Generasi naskah Reels 5-Module, voice over, Video DNA 30+ parameter, dan hipotesis performa.'}
                          </p>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setCampaignType(null)}
                        className="btn btn-secondary"
                        style={{ padding: '8px 16px', fontSize: '0.78rem', border: '1px solid var(--border)' }}
                      >
                        🔄 Ganti Pilihan Tipe
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. Formulir Tipe Static */}
                {campaignType === 'static' && (
                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <div className="form-group">
                      <label className="form-label">Gunakan Referensi Video Dekonstruksi (Opsional)</label>
                      <select
                        className="form-select"
                        value={sourceDeconstructAssetId}
                        onChange={(e) => {
                          const assetId = e.target.value;
                          setSourceDeconstructAssetId(assetId);
                          if (assetId) {
                            const selected = deconstructedAssets.find(a => a.id === assetId);
                            if (selected && selected.recipe_suggestion) {
                              setCategory('Custom Input');
                              setCustomCategory(selected.recipe_suggestion);
                            }
                          } else {
                            setCategory('Makanan');
                            setCustomCategory('');
                          }
                        }}
                      >
                        <option value="">-- Tanpa Referensi (Buat Baru) --</option>
                        {deconstructedAssets.map(asset => (
                          <option key={asset.id} value={asset.id}>{asset.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Kategori Resep</label>
                      <select
                        className="form-select"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      >
                        {categoryOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    {category === 'Custom Input' && (
                      <div className="form-group">
                        <label className="form-label">Nama Kategori Custom</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Misal: Minuman Herbal, Modern Fusion..."
                          value={customCategory}
                          onChange={(e) => setCustomCategory(e.target.value)}
                        />
                      </div>
                    )}

                    <div className="form-group">
                      <label className="form-label">Visual Style (Fotografi AI)</label>
                      <select
                        className="form-select"
                        value={visualStyle}
                        onChange={(e) => setVisualStyle(e.target.value)}
                      >
                        {visualStyleOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Parent Folder Nextcloud Hub</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="MAKNA_Recipes"
                        value={nextcloudParentFolder}
                        onChange={(e) => setNextcloudParentFolder(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Jumlah Resep</label>
                      <input
                        type="number"
                        className="form-input"
                        min="1"
                        max="10"
                        value={targetCount}
                        onChange={(e) => setTargetCount(e.target.value)}
                      />
                    </div>

                    <div style={{
                      padding: '16px',
                      background: 'var(--bg-glass)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justify: 'space-between',
                      marginBottom: '12px'
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          🎥 Generasi Gambar G-Labs (T2I & Grid Poster)
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {enableGlabs 
                            ? 'ON: Membuat gambar instruksional AI, kolase asimetris sesuai preset pilihan, dan ekspor ke Nextcloud.' 
                            : 'OFF: HANYA membuat teks resep dan prompt T2I (Tanpa memroses pembuatan gambar).'}
                        </div>
                      </div>

                      <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px', cursor: 'pointer', flexShrink: 0 }}>
                        <input
                          type="checkbox"
                          checked={enableGlabs}
                          onChange={(e) => setEnableGlabs(e.target.checked)}
                          style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span style={{
                          position: 'absolute',
                          top: 0, left: 0, right: 0, bottom: 0,
                          backgroundColor: enableGlabs ? 'var(--accent)' : '#3a3a50',
                          transition: 'var(--transition)',
                          borderRadius: '34px'
                        }}>
                          <span style={{
                            position: 'absolute',
                            content: '""',
                            height: '20px',
                            width: '20px',
                            left: enableGlabs ? '26px' : '3px',
                            bottom: '3px',
                            backgroundColor: 'white',
                            transition: 'var(--transition)',
                            borderRadius: '50%'
                          }} />
                        </span>
                      </label>
                    </div>

                    {enableGlabs && (
                      <div style={{
                        padding: '16px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        marginBottom: '12px'
                      }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          🎨 Konfigurasi Kolase Asimetris
                        </div>

                        <div className="form-group" style={{ marginBottom: '12px' }}>
                          <label className="form-label">Jumlah Gambar T2I</label>
                          <select
                            className="select-field"
                            style={{
                              width: '100%',
                              padding: '8px',
                              background: 'var(--bg-input)',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--text)',
                              fontSize: '0.85rem'
                            }}
                            value={imagesPerRecipe}
                            onChange={(e) => setImagesPerRecipe(Number(e.target.value))}
                          >
                            <option value={3}>3 Gambar</option>
                            <option value={4}>4 Gambar (Default)</option>
                            <option value={5}>5 Gambar</option>
                            <option value={6}>6 Gambar</option>
                          </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: '12px' }}>
                          <label className="form-label">Preset Layout Kolase</label>
                          <select
                            className="select-field"
                            style={{
                              width: '100%',
                              padding: '8px',
                              background: 'var(--bg-input)',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--text)',
                              fontSize: '0.85rem'
                            }}
                            value={selectedLayoutId}
                            onChange={(e) => setSelectedLayoutId(e.target.value)}
                          >
                            {imagesPerRecipe === 3 && (
                              <>
                                <option value="3_split_left">Editorial Tri-Split Left</option>
                                <option value="3_split_right">Tri-Split Right Mirror</option>
                                <option value="3_stacked_horizontal">Landscape Cascade</option>
                              </>
                            )}
                            {imagesPerRecipe === 4 && (
                              <>
                                <option value="4_editorial_split">Editorial Split (Default)</option>
                                <option value="4_modern_masonry">Modern Masonry</option>
                                <option value="4_landscape_cascade">Vertical Story Cascade 4</option>
                              </>
                            )}
                            {imagesPerRecipe === 5 && (
                              <>
                                <option value="5_pentagon_grid">Pentagon Asymmetric</option>
                                <option value="5_step_cascade">Story Step-by-Step 5</option>
                                <option value="5_magazine_editorial">Magazine Editorial</option>
                              </>
                            )}
                            {imagesPerRecipe === 6 && (
                              <>
                                <option value="6_magazine_spread">Magazine Hexa-Grid</option>
                                <option value="6_vertical_masonry">Pinterest Masonry Style</option>
                                <option value="6_asymmetric_mosaic">Modern Asymmetric Mosaic</option>
                              </>
                            )}
                          </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '0.8rem' }}>Jarak Celah (Gap): {gridGapSize}px</label>
                            <input
                              type="range"
                              min="0"
                              max="30"
                              step="2"
                              value={gridGapSize}
                              onChange={(e) => setGridGapSize(Number(e.target.value))}
                              style={{ width: '100%', accentColor: 'var(--accent)' }}
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '0.8rem' }}>Sudut Lengkung (Radius): {gridBorderRadius}px</label>
                            <input
                              type="range"
                              min="0"
                              max="40"
                              step="2"
                              value={gridBorderRadius}
                              onChange={(e) => setGridBorderRadius(Number(e.target.value))}
                              style={{ width: '100%', accentColor: 'var(--accent)' }}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '0.8rem' }}>Outer Padding: {gridOuterPadding}px</label>
                            <input
                              type="range"
                              min="0"
                              max="40"
                              step="2"
                              value={gridOuterPadding}
                              onChange={(e) => setGridOuterPadding(Number(e.target.value))}
                              style={{ width: '100%', accentColor: 'var(--accent)' }}
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '0.8rem' }}>Warna Background</label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <input
                                type="color"
                                value={gridBgColor}
                                onChange={(e) => setGridBgColor(e.target.value)}
                                style={{
                                  border: 'none',
                                  width: '28px',
                                  height: '28px',
                                  padding: 0,
                                  background: 'none',
                                  cursor: 'pointer',
                                  borderRadius: '4px'
                                }}
                              />
                              <input
                                type="text"
                                className="form-input"
                                value={gridBgColor}
                                onChange={(e) => setGridBgColor(e.target.value)}
                                style={{ padding: '4px 8px', fontSize: '0.75rem', height: '28px' }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="form-group" style={{ marginBottom: '16px' }}>
                      <label className="form-label">🎯 Target Demografi & Tone Bahasa</label>
                      <select className="form-input" value={targetDemographic} onChange={e => setTargetDemographic(e.target.value)}>
                        <option value="genz_casual">Gen-Z & Milenial Muda (Santai, Gaul, Akrab "Kamu/Lo")</option>
                        <option value="ibu_rumah_tangga">Ibu Rumah Tangga & Keluarga (Ramah, Mengayomi "Bunda/Moms")</option>
                        <option value="professional_executive">Profesional & Worker (Lugas, Refined, Efisien "Anda/Kamu")</option>
                        <option value="hijab_syari_family">Keluarga Hijrah & Syari (Santun, Islami Alami "Bunda/Ukhti")</option>
                        <option value="fitness_health_enthusiast">Penggiat Olahraga & Kesehatan (Motivatif, Energik, Informatif)</option>
                        <option value="custom">Custom Input Bebas...</option>
                      </select>
                      {targetDemographic === 'custom' && (
                        <input
                          type="text"
                          className="form-input"
                          style={{ marginTop: 8 }}
                          placeholder="Contoh: Mahasiswa Rantau yang Hemat"
                          value={targetDemographicCustom}
                          onChange={e => setTargetDemographicCustom(e.target.value)}
                        />
                      )}
                    </div>

                    <div style={{
                      padding: '16px',
                      background: 'var(--bg-glass)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justify: 'space-between'
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          📘 Post Draft ke Facebook Page (Status Pending/Draft)
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {postToFacebook 
                            ? 'ON: Otomatis membuat Draft Postingan di Facebook Page (TIDAK langsung published).' 
                            : 'OFF: Tidak mengirim postingan draft ke Facebook Page.'}
                        </div>
                      </div>

                      <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px', cursor: 'pointer', flexShrink: 0 }}>
                        <input
                          type="checkbox"
                          checked={postToFacebook}
                          onChange={(e) => setPostToFacebook(e.target.checked)}
                          style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span style={{
                          position: 'absolute',
                          top: 0, left: 0, right: 0, bottom: 0,
                          backgroundColor: postToFacebook ? 'var(--accent)' : '#3a3a50',
                          transition: 'var(--transition)',
                          borderRadius: '34px'
                        }}>
                          <span style={{
                            position: 'absolute',
                            content: '""',
                            height: '20px',
                            width: '20px',
                            left: postToFacebook ? '26px' : '3px',
                            bottom: '3px',
                            backgroundColor: 'white',
                            transition: 'var(--transition)',
                            borderRadius: '50%'
                          }} />
                        </span>
                      </label>
                    </div>

                    <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
                        {submitting ? 'Memproses Kampanye...' : '🚀 Mulai Generate Resep'}
                      </button>
                    </div>
                  </form>
                )}

                {/* 3. Formulir Tipe Video Reels (Mengadopsi Tab/Accordion OPC) */}
                {campaignType === 'video' && (
                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                    
                    {/* ACCORDION 1: Basic Creative Strategy */}
                    <div style={{ borderBottom: '1px solid var(--border)' }}>
                      <div 
                        onClick={() => setActiveAccordion(0)} 
                        style={{ padding: '16px 20px', background: activeAccordion === 0 ? 'rgba(59, 130, 246, 0.05)' : 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <span style={{ fontWeight: 600, fontSize: '0.92rem', color: activeAccordion === 0 ? 'var(--accent-light)' : 'var(--text-primary)' }}>1. Basic Creative Strategy</span>
                        <span>{activeAccordion === 0 ? '▲' : '▼'}</span>
                      </div>
                      {activeAccordion === 0 && (
                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(0,0,0,0.1)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                              <label className="form-label">Gunakan Referensi Video Dekonstruksi (Opsional)</label>
                              <select
                                className="form-select"
                                value={sourceDeconstructAssetId}
                                onChange={(e) => {
                                  const assetId = e.target.value;
                                  setSourceDeconstructAssetId(assetId);
                                  if (assetId) {
                                    const selected = deconstructedAssets.find(a => a.id === assetId);
                                    if (selected && selected.recipe_suggestion) {
                                      setCampaignName(`Reels - ${selected.recipe_suggestion}`);
                                      setContentPillar(`Membuat resep berdasarkan video: ${selected.recipe_suggestion}`);
                                    }
                                  } else {
                                    setCampaignName('');
                                    setContentPillar('');
                                  }
                                }}
                              >
                                <option value="">-- Tanpa Referensi (Buat Baru) --</option>
                                {deconstructedAssets.map(asset => (
                                  <option key={asset.id} value={asset.id}>{asset.label}</option>
                                ))}
                              </select>
                            </div>

                            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                              <label className="form-label">🏷️ Nama Akun (Brand Account)</label>
                              <select
                                className="form-select"
                                value={accountName}
                                onChange={e => {
                                  const newAcc = e.target.value;
                                  setAccountName(newAcc);
                                  const now = new Date();
                                  const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
                                  setCampaignName(`[ RECIPE ${dateStr} ] - ${newAcc ? newAcc + ' - ' : ''}`);
                                }}
                              >
                                <option value="">-- Pilih Nama Akun Brand --</option>
                                {brandProfiles.map(bp => (
                                  <option key={bp.id} value={bp.account_name || bp.brand_name}>
                                    {bp.brand_name} ({bp.account_name || bp.brand_name})
                                  </option>
                                ))}
                                <option value="nutribake">nutribake</option>
                                <option value="siasatsehat">siasatsehat</option>
                              </select>
                            </div>

                            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                              <label className="form-label">Nama Kampanye *</label>
                              <input
                                className="form-input"
                                placeholder="Contoh: Reels Resep Siasat Sehat"
                                value={campaignName}
                                onChange={e => setCampaignName(e.target.value)}
                                required
                              />
                            </div>
                            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                              <label className="form-label">Google Spreadsheet ID (Aset Teks/Storage)</label>
                              <input
                                className="form-input"
                                placeholder="Contoh: 1aBcDeFgHiJkLmNoPqRsTuVwXyZ"
                                value={spreadsheetId}
                                onChange={e => setSpreadsheetId(e.target.value)}
                              />
                            </div>
                            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                              <label className="form-label">Bahasa Naskah Voiceover</label>
                              <select 
                                className="form-select" 
                                value={targetLanguage} 
                                onChange={e => setTargetLanguage(e.target.value)}
                              >
                                <option value="id-ID">🇮🇩 Bahasa Indonesia (Lokal)</option>
                                <option value="en-US">🇺🇸 English (Global / US Market)</option>
                              </select>
                            </div>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Pilar Konten / Fokus Kuliner</label>
                            <textarea
                              className="form-input"
                              style={{ minHeight: '60px' }}
                              placeholder="Fokus topik masakan. Contoh: Menu diet tinggi serat rendah kalori, resep sahur praktis 10 menit..."
                              value={contentPillar}
                              onChange={e => setContentPillar(e.target.value)}
                            />
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                              <label className="form-label">Naskah Hook Awal (Klip 1 - Opsional)</label>
                              <input
                                className="form-input"
                                placeholder="Hook suara 4 detik. Contoh: Makanan ini bikin kolesterol lo langsung turun!"
                                value={customHook}
                                onChange={e => setCustomHook(e.target.value)}
                              />
                            </div>
                            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                              <label className="form-label">Brand Profile DNA Kuliner (Opsional)</label>
                              <select
                                className="form-select"
                                value={brandProfileId}
                                onChange={e => setBrandProfileId(e.target.value)}
                              >
                                <option value="">-- Tanpa Brand Profile (Default) --</option>
                                {brandProfiles.map(p => (
                                  <option key={p.id} value={p.id}>{p.brand_name}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Petunjuk Aksi Visual (Visual Action Guideline)</label>
                            <input
                              className="form-input"
                              placeholder="Aktivitas visual detail. Contoh: Mengaduk kuah kental dengan sendok kayu..."
                              value={visualActionGuideline}
                              onChange={e => setVisualActionGuideline(e.target.value)}
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label">Custom Instruction (Gemini)</label>
                            <input
                              className="form-input"
                              placeholder="Instruksi tambahan. Contoh: Selipkan humor ringan, jangan gunakan gula pasir..."
                              value={customInstruction}
                              onChange={e => setCustomInstruction(e.target.value)}
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label">Parent Folder Nextcloud Hub</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="MAKNA_Recipes"
                              value={nextcloudParentFolder}
                              onChange={(e) => setNextcloudParentFolder(e.target.value)}
                            />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                              Folder utama di Nextcloud tempat penyimpanan berkas resep & naskah video.
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ACCORDION 2: Aesthetics & Visual Settings */}
                    <div style={{ borderBottom: '1px solid var(--border)' }}>
                      <div 
                        onClick={() => setActiveAccordion(1)} 
                        style={{ padding: '16px 20px', background: activeAccordion === 1 ? 'rgba(59, 130, 246, 0.05)' : 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <span style={{ fontWeight: 600, fontSize: '0.92rem', color: activeAccordion === 1 ? 'var(--accent-light)' : 'var(--text-primary)' }}>2. Aesthetics & Visual Settings</span>
                        <span>{activeAccordion === 1 ? '▲' : '▼'}</span>
                      </div>
                      {activeAccordion === 1 && (
                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(0,0,0,0.1)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                              <label className="form-label">Narrative Mode</label>
                              <select className="form-select" value={narrativeMode} onChange={e => setNarrativeMode(e.target.value)}>
                                <option value="Storytelling">Storytelling</option>
                                <option value="Promo">Promo</option>
                                <option value="Educational">Edukasi / Tutorial</option>
                              </select>
                            </div>
                            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                              <label className="form-label">Visual Style (Fotografi AI)</label>
                              <select className="form-select" value={visualStyleVideo} onChange={e => setVisualStyleVideo(e.target.value)}>
                                <option value="Food Porn">Food Porn</option>
                                <option value="Macrophotography">Macrophotography</option>
                                <option value="Cinematic Faceless">Cinematic Faceless</option>
                              </select>
                            </div>
                            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                              <label className="form-label">Target Engine Video</label>
                              <select className="form-select" value={targetAi} onChange={e => setTargetAi(e.target.value)}>
                                <option value="Google Veo (8s)">Google Veo (8s)</option>
                                <option value="Veo Omni (4s/8s)">Veo Omni (4s/8s)</option>
                              </select>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                              <label className="form-label">Model Video</label>
                              <select className="form-select" value={videoModel} onChange={e => setVideoModel(e.target.value)}>
                                <option value="veo_31_lite">veo_31_lite</option>
                                <option value="omni_flash">omni_flash</option>
                              </select>
                            </div>
                            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                              <label className="form-label">Aspect Ratio</label>
                              <select className="form-select" value={aspectRatio} onChange={e => setAspectRatio(e.target.value)}>
                                <option value="9:16">9:16 (Vertical Reels/TikTok)</option>
                                <option value="16:9">16:9 (Horizontal)</option>
                              </select>
                            </div>
                            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                              <label className="form-label">Face Visibility</label>
                              <select className="form-select" value={faceVisibility} onChange={e => setFaceVisibility(e.target.value)}>
                                <option value="Faceless">Faceless (Tanpa Wajah / Fokus Produk)</option>
                                <option value="Minimal">Minimal (Wajah hanya di Hook)</option>
                                <option value="Full">Full (Bercerita di depan kamera)</option>
                              </select>
                            </div>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Panjang Voiceover per Klip</label>
                            <input className="form-input" value={wordsPerClip} onChange={e => setWordsPerClip(e.target.value)} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ACCORDION 3: Product Bridging Settings */}
                    <div style={{ borderBottom: '1px solid var(--border)' }}>
                      <div 
                        onClick={() => setActiveAccordion(2)} 
                        style={{ padding: '16px 20px', background: activeAccordion === 2 ? 'rgba(59, 130, 246, 0.05)' : 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <span style={{ fontWeight: 600, fontSize: '0.92rem', color: activeAccordion === 2 ? 'var(--accent-light)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>3. Product Bridging Settings</span>
                          <span style={{ 
                            fontSize: '0.72rem', 
                            padding: '2px 8px', 
                            borderRadius: '4px', 
                            background: isBridgingActive ? 'var(--success-glow)' : 'var(--border)', 
                            color: isBridgingActive ? 'var(--success)' : 'var(--text-muted)'
                          }}>
                            {isBridgingActive ? 'Active' : 'Inactive (Default)'}
                          </span>
                        </span>
                        <span>{activeAccordion === 2 ? '▲' : '▼'}</span>
                      </div>
                      {activeAccordion === 2 && (
                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(0,0,0,0.1)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600' }}>Aktifkan Integrasi Produk Afiliasi</span>
                            <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px', cursor: 'pointer' }}>
                              <input type="checkbox" checked={isBridgingActive} onChange={e => setIsBridgingActive(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                              <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isBridgingActive ? 'var(--accent)' : '#3a3a50', transition: 'var(--transition)', borderRadius: '34px' }}>
                                <span style={{ position: 'absolute', content: '""', height: '20px', width: '20px', left: isBridgingActive ? '26px' : '3px', bottom: '3px', backgroundColor: 'white', transition: 'var(--transition)', borderRadius: '50%' }} />
                              </span>
                            </label>
                          </div>

                          {isBridgingActive && (
                            <>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                                  <label className="form-label">Jumlah Total Klip (Target Clips Count)</label>
                                  <input type="number" className="form-input" value={targetClipsCount} onChange={e => setTargetClipsCount(e.target.value)} />
                                </div>
                                <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                                  <label className="form-label">Bridge at Clip (Posisikan di klip ke-N)</label>
                                  <input type="number" className="form-input" value={bridgeAtClip} onChange={e => setBridgeAtClip(e.target.value)} />
                                </div>
                                <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                                  <label className="form-label">Promotion Style</label>
                                  <select className="form-select" value={promotionStyle} onChange={e => setPromotionStyle(e.target.value)}>
                                    <option value="Softselling">Softselling (Halus & Kontekstual)</option>
                                    <option value="Hardselling">Hardselling (Langsung ke CTA)</option>
                                  </select>
                                </div>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                                  <label className="form-label">Metode Bridging Produk</label>
                                  <select className="form-select" value={bridgingMode} onChange={e => setBridgingMode(e.target.value)}>
                                    <option value="select_existing">Pilih dari Database Produk</option>
                                    <option value="manual">Input Manual Detail Produk</option>
                                  </select>
                                </div>
                                <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                                  <label className="form-label">Visual Mode</label>
                                  <select className="form-select" value={visualMode} onChange={e => setVisualMode(e.target.value)}>
                                    <option value="hybrid_lock">hybrid_lock (Fokus Visual & Teks)</option>
                                    <option value="full_dynamic">full_dynamic</option>
                                  </select>
                                </div>
                              </div>

                              {bridgingMode === 'select_existing' ? (
                                <div className="form-group">
                                  <label className="form-label">Pilih Produk</label>
                                  <select className="form-select" value={targetProductId} onChange={e => setTargetProductId(e.target.value)}>
                                    <option value="">-- Pilih Produk --</option>
                                    {products.map(p => (
                                      <option key={p.id} value={p.id}>{p.product_name} ({p.brand_name || 'N/A'})</option>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                  <div className="form-group">
                                    <label className="form-label">Nama Produk Manual</label>
                                    <input className="form-input" placeholder="Contoh: Blender Bumbu Listrik" value={manualProductName} onChange={e => setManualProductName(e.target.value)} />
                                  </div>
                                  <div className="form-group">
                                    <label className="form-label">Deskripsi Produk</label>
                                    <textarea className="form-input" style={{ minHeight: '60px' }} placeholder="Detail blender multifungsi..." value={manualProductDesc} onChange={e => setManualProductDesc(e.target.value)} />
                                  </div>
                                  <div className="form-group">
                                    <label className="form-label">USP Produk (Unique Selling Point)</label>
                                    <input className="form-input" placeholder="Contoh: Putaran 5000 RPM, mata pisau stainless stell..." value={manualProductUsp} onChange={e => setManualProductUsp(e.target.value)} />
                                  </div>
                                  <div className="form-group">
                                    <label className="form-label">Tautan / URL Shopee/Tokopedia</label>
                                    <input className="form-input" placeholder="https://shopee.co.id/..." value={productUrl} onChange={e => setProductUrl(e.target.value)} />
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ACCORDION 4: Visual Swap Overrides */}
                    <div style={{ borderBottom: '1px solid var(--border)' }}>
                      <div 
                        onClick={() => setActiveAccordion(3)} 
                        style={{ padding: '16px 20px', background: activeAccordion === 3 ? 'rgba(59, 130, 246, 0.05)' : 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <span style={{ fontWeight: 600, fontSize: '0.92rem', color: activeAccordion === 3 ? 'var(--accent-light)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>4. Visual Swap Overrides</span>
                          <span style={{ 
                            fontSize: '0.72rem', 
                            padding: '2px 8px', 
                            borderRadius: '4px', 
                            background: isVsoActive ? 'var(--success-glow)' : 'var(--border)', 
                            color: isVsoActive ? 'var(--success)' : 'var(--text-muted)'
                          }}>
                            {isVsoActive ? 'Active' : 'Inactive (Default)'}
                          </span>
                        </span>
                        <span>{activeAccordion === 3 ? '▲' : '▼'}</span>
                      </div>
                      {activeAccordion === 3 && (
                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(0,0,0,0.1)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600' }}>Aktifkan Karakter & Setting Visual Overrides</span>
                            <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px', cursor: 'pointer' }}>
                              <input type="checkbox" checked={isVsoActive} onChange={e => setIsVsoActive(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                              <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isVsoActive ? 'var(--accent)' : '#3a3a50', transition: 'var(--transition)', borderRadius: '34px' }}>
                                <span style={{ position: 'absolute', content: '""', height: '20px', width: '20px', left: isVsoActive ? '26px' : '3px', bottom: '3px', backgroundColor: 'white', transition: 'var(--transition)', borderRadius: '50%' }} />
                              </span>
                            </label>
                          </div>

                          {isVsoActive && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              <div className="form-group">
                                <label className="form-label">Konsep Karakter (Framing)</label>
                                <select className="form-select" value={characterConcept} onChange={e => setCharacterConcept(e.target.value)}>
                                  <option value="faceless">Faceless (Wajah Terpotong - Fokus Tangan)</option>
                                  <option value="pov">POV (First Person View)</option>
                                  <option value="silhouette">Siluet Bayangan (Aesthetic Shadow)</option>
                                  <option value="stylized_3d">3D Stylized Claymation</option>
                                </select>
                              </div>

                              <div className="form-group">
                                <label className="form-label">Demografi Subjek / Model</label>
                                <select 
                                  className="form-select" 
                                  value={subjectDemographic} 
                                  onChange={e => {
                                    const val = e.target.value;
                                    setSubjectDemographic(val);
                                    setWardrobeStyle('random');
                                    if (val.startsWith('stylized_3d_')) {
                                      setCharacterConcept('stylized_3d');
                                    } else {
                                      setCharacterConcept('faceless');
                                    }
                                  }}
                                >
                                  <option value="syari_classic">Wanita Gamis Syar'iy (Hanya Tangan)</option>
                                  <option value="caucasian_male">Pria Kaukasia (Hanya Tangan)</option>
                                  <option value="stylized_3d_muslimah">Wanita 3D Stylized (Clay Art)</option>
                                  <option value="stylized_3d_male">Pria 3D Stylized (Clay Art)</option>
                                  <option value="stylized_3d_duo">Duo 3D Stylized - 2 Karakter (Clay Art)</option>
                                </select>
                              </div>

                              <div className="form-group">
                                <label className="form-label">Pakaian / Wardrobe</label>
                                <select className="form-select" value={wardrobeStyle} onChange={e => setWardrobeStyle(e.target.value)}>
                                  <option value="random">🎲 Random (Acak)</option>
                                  <option value="sequential">🔄 Sequential (Urut per baris)</option>
                                  {subjectDemographic === 'stylized_3d_muslimah' ? (
                                    <optgroup label="Pakaian 3D Muslimah">
                                      <option value="3d_fem_emerald">Gamis Hijau Emerald 3D</option>
                                      <option value="3d_fem_pastel_pink">Gamis Pastel Pink 3D</option>
                                      <option value="3d_fem_jetblack">Abaya Hitam Legam 3D</option>
                                      <option value="3d_fem_mocca">Gamis Mocca 3D</option>
                                    </optgroup>
                                  ) : subjectDemographic === 'stylized_3d_male' ? (
                                    <optgroup label="Pakaian 3D Pria">
                                      <option value="3d_male_tan_knit">Sweater Tan Rajut 3D</option>
                                      <option value="3d_male_sage_jacket">Jaket Kasual Sage Green 3D</option>
                                      <option value="3d_male_charcoal_tshirt">Kaos Charcoal Katun 3D</option>
                                      <option value="3d_male_terracotta_flannel">Kemeja Flanel Terracotta 3D</option>
                                    </optgroup>
                                  ) : subjectDemographic === 'stylized_3d_duo' ? (
                                    <optgroup label="Harmoni Pakaian Duo Terkoordinasi">
                                      <option value="3d_duo_earth">Tema 1: Earthy Warmth (Tan Sweater & Cream Abaya)</option>
                                      <option value="3d_duo_contrast">Tema 2: Urban Contrast (Terracotta Jacket & Sage Abaya)</option>
                                      <option value="3d_duo_monochrome">Tema 3: Minimalist Monochrome (Off-White T-shirt & Black Abaya)</option>
                                      <option value="3d_duo_pastel">Tema 4: Soft Pastel Harmony (Mint Polo & Lilac Abaya)</option>
                                      <option value="3d_duo_cool">Tema 5: Professional Cool Tones (Grey Flannel & Teal Abaya)</option>
                                    </optgroup>
                                  ) : subjectDemographic === 'caucasian_male' ? (
                                    <optgroup label="Preset Warna Pria Kaukasia">
                                      <option value="male_terracotta">Pria: Terracotta</option>
                                      <option value="male_caramel">Pria: Caramel Latte</option>
                                      <option value="male_khaki_tan">Pria: Khaki / Tan</option>
                                      <option value="male_navy_blue">Pria: Navy Blue</option>
                                      <option value="male_forest_green">Pria: Forest Green</option>
                                      <option value="male_charcoal">Pria: Charcoal Grey</option>
                                      <option value="male_burgundy">Pria: Burgundy Maroon</option>
                                      <option value="male_sage_muted">Pria: Sage Green Muted</option>
                                      <option value="male_steel_blue">Pria: Steel Blue</option>
                                      <option value="male_cloud_dancer">Pria: Off-White (Cloud Dancer)</option>
                                    </optgroup>
                                  ) : (
                                    <>
                                      <optgroup label="1. Earth Tones & Warm Neutrals">
                                        <option value="amber_terracotta">Amber Haze & Terracotta</option>
                                        <option value="mocca_caramel">Mocca, Taupe & Caramel Latte</option>
                                        <option value="warm_grey">Warm Grey</option>
                                      </optgroup>
                                      <optgroup label="2. Muted Pastels (Pastel Refined)">
                                        <option value="sage_muted">Sage Green Muted</option>
                                        <option value="lavender_lilac">Lavender Soft & Soft Lilac</option>
                                        <option value="butter_yellow">Butter Yellow (Butter Cream)</option>
                                      </optgroup>
                                      <optgroup label="3. Modern Cool & Deep Tones">
                                        <option value="teal_navy">Transformative Teal & Navy Blue</option>
                                        <option value="olive_modern">Olive Green Modern</option>
                                        <option value="mahogany_maroon">Mahogany & Maroon</option>
                                      </optgroup>
                                      <optgroup label="4. Netral Klasik Modern">
                                        <option value="cloud_dancer">Cloud Dancer (Off-White Modern)</option>
                                      </optgroup>
                                    </>
                                  )}
                                  <option value="custom">-- Tulis Custom --</option>
                                </select>
                                {wardrobeStyle === 'custom' && (
                                  <input
                                    type="text"
                                    className="form-input"
                                    style={{ marginTop: 8 }}
                                    placeholder={
                                      subjectDemographic.startsWith('stylized_3d_') 
                                        ? "Ketik pakaian 3D kustom..." 
                                        : subjectDemographic === 'caucasian_male' 
                                          ? "Ketik pakaian kustom..." 
                                          : "Ketik warna hijab kustom..."
                                    }
                                    value={wardrobeStyleCustom}
                                    onChange={e => setWardrobeStyleCustom(e.target.value)}
                                  />
                                )}
                              </div>

                              <div className="form-group">
                                <label className="form-label">Pencahayaan & Atmosfer (Lighting Ambiance)</label>
                                <select className="form-select" value={lightingStyle} onChange={e => setLightingStyle(e.target.value)}>
                                  <option value="random">🎲 Random (Acak)</option>
                                  <option value="window_daylight">Soft Window Daylight (Cahaya jendela natural)</option>
                                  <option value="golden_hour">Golden Hour Warm Sunset (Sorot sore keemasan)</option>
                                  <option value="studio_softbox">Clean Professional Studio Softbox</option>
                                  <option value="cyber_neon">Moody Cyberpunk Blue-Pink Neon</option>
                                  <option value="custom">-- Tulis Custom --</option>
                                </select>
                                {lightingStyle === 'custom' && (
                                  <input
                                    type="text"
                                    className="form-input"
                                    style={{ marginTop: 8 }}
                                    placeholder="Ketik gaya pencahayaan..."
                                    value={lightingStyleCustom}
                                    onChange={e => setLightingStyleCustom(e.target.value)}
                                  />
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ACCORDION 5: Workflow & Audio Settings */}
                    <div style={{ borderBottom: 'none' }}>
                      <div 
                        onClick={() => setActiveAccordion(4)} 
                        style={{ padding: '16px 20px', background: activeAccordion === 4 ? 'rgba(59, 130, 246, 0.05)' : 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <span style={{ fontWeight: 600, fontSize: '0.92rem', color: activeAccordion === 4 ? 'var(--accent-light)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>5. Workflow & Audio Settings</span>
                          <span style={{ 
                            fontSize: '0.72rem', 
                            padding: '2px 8px', 
                            borderRadius: '4px', 
                            background: enableTts || enableSocialPost || enableGlabsVideo ? 'var(--success-glow)' : 'var(--border)', 
                            color: enableTts || enableSocialPost || enableGlabsVideo ? 'var(--success)' : 'var(--text-muted)'
                          }}>
                            {enableTts || enableSocialPost || enableGlabsVideo ? 'Active' : 'Inactive (Default)'}
                          </span>
                        </span>
                        <span>{activeAccordion === 4 ? '▲' : '▼'}</span>
                      </div>
                      {activeAccordion === 4 && (
                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(0,0,0,0.1)' }}>
                          
                          {/* TTS Switcher */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <div>
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600' }}>Aktifkan Text-to-Speech (TTS Voice)</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Generate audio suara pengiring untuk Voice Over naskah.</div>
                            </div>
                            <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px', cursor: 'pointer' }}>
                              <input type="checkbox" checked={enableTts} onChange={e => setEnableTts(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                              <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: enableTts ? 'var(--accent)' : '#3a3a50', transition: 'var(--transition)', borderRadius: '34px' }}>
                                <span style={{ position: 'absolute', content: '""', height: '20px', width: '20px', left: enableTts ? '26px' : '3px', bottom: '3px', backgroundColor: 'white', transition: 'var(--transition)', borderRadius: '50%' }} />
                              </span>
                            </label>
                          </div>

                          {enableTts && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingLeft: '12px', borderLeft: '2px solid var(--accent)' }}>
                              <div className="form-group">
                                <label className="form-label">TTS Provider</label>
                                <select className="form-select" value={voiceProvider} onChange={e => setVoiceProvider(e.target.value)}>
                                  <option value="minimax">MiniMax (Dynamic Voice Engine)</option>
                                  <option value="gemini">Gemini Audio (Google Natural Voice)</option>
                                </select>
                              </div>
                              <div className="form-group">
                                <label className="form-label">Voice Persona / Model</label>
                                <select className="form-select" value={voicePersona} onChange={e => setVoicePersona(e.target.value)}>
                                  {voiceProvider === 'gemini' 
                                    ? GEMINI_VOICES.map(v => <option key={v.id} value={v.id}>{v.name} - {v.desc}</option>)
                                    : (targetLanguage === 'en-US' ? MINIMAX_ENGLISH_VOICES : MINIMAX_VOICES).map(v => <option key={v.id} value={v.id}>{v.name} - {v.desc}</option>)
                                  }
                                </select>
                              </div>
                              <div className="form-group">
                                <label className="form-label">Speed ({voiceSpeed}x)</label>
                                <input type="range" min="0.5" max="2.0" step="0.1" className="form-input" value={voiceSpeed} onChange={e => setVoiceSpeed(Number(e.target.value))} style={{ width: '100%' }} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Volume ({voiceVolume})</label>
                                <input type="range" min="0.1" max="2.0" step="0.1" className="form-input" value={voiceVolume} onChange={e => setVoiceVolume(Number(e.target.value))} style={{ width: '100%' }} />
                              </div>
                              {voiceProvider === 'minimax' && (
                                <div className="form-group">
                                  <label className="form-label">MiniMax Model Quality</label>
                                  <select className="form-select" value={ttsModelQuality} onChange={e => setTtsModelQuality(e.target.value)}>
                                    <option value="speech-2.8-turbo">Turbo (speech-2.8-turbo)</option>
                                    <option value="speech-2.8-hd">HD (speech-2.8-hd) - Mendukung Micro-Acting</option>
                                  </select>
                                </div>
                              )}
                            </div>
                          )}

                          {/* G-Labs Video Render Switcher */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginTop: '8px' }}>
                            <div>
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600' }}>Aktifkan Rendering Video G-Labs</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Memicu render visual video Google Veo di latar belakang.</div>
                            </div>
                            <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px', cursor: 'pointer' }}>
                              <input type="checkbox" checked={enableGlabsVideo} onChange={e => setEnableGlabsVideo(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                              <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: enableGlabsVideo ? 'var(--accent)' : '#3a3a50', transition: 'var(--transition)', borderRadius: '34px' }}>
                                <span style={{ position: 'absolute', content: '""', height: '20px', width: '20px', left: enableGlabsVideo ? '26px' : '3px', bottom: '3px', backgroundColor: 'white', transition: 'var(--transition)', borderRadius: '50%' }} />
                              </span>
                            </label>
                          </div>

                          {/* FFmpeg Video Sync Switcher */}
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between', 
                            paddingBottom: '12px',
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            marginTop: '8px',
                            opacity: (!enableTts || !enableGlabsVideo) ? 0.5 : 1
                          }}>
                            <div>
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600' }}>Aktifkan FFmpeg Smart Sync (Video & Audio Merge)</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Gabungkan trek audio TTS dengan klip visual video secara otomatis.</div>
                            </div>
                            <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px', cursor: 'pointer' }}>
                              <input 
                                type="checkbox" 
                                checked={enableFfmpeg} 
                                onChange={e => setEnableFfmpeg(e.target.checked)} 
                                disabled={!enableTts || !enableGlabsVideo} 
                                style={{ opacity: 0, width: 0, height: 0 }} 
                              />
                              <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: enableFfmpeg ? 'var(--accent)' : '#3a3a50', transition: 'var(--transition)', borderRadius: '34px' }}>
                                <span style={{ position: 'absolute', content: '""', height: '20px', width: '20px', left: enableFfmpeg ? '26px' : '3px', bottom: '3px', backgroundColor: 'white', transition: 'var(--transition)', borderRadius: '50%' }} />
                              </span>
                            </label>
                          </div>

                          {enableFfmpeg && enableTts && enableGlabsVideo && (
                            <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: 16, paddingLeft: '12px', borderLeft: '2px solid var(--accent)' }}>
                              <strong style={{ fontSize: '0.9rem', display: 'block' }}>🎬 FFmpeg Video Studio Settings</strong>
                              
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <label className="form-label" style={{ fontSize: '0.8rem' }}>Mode Sinkronisasi Audio-Video</label>
                                <div style={{ display: 'flex', gap: 24, marginTop: 4 }}>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                    <input
                                      type="radio"
                                      name="syncMode"
                                      value="auto"
                                      checked={syncMode === 'auto'}
                                      onChange={() => {
                                        setSyncMode('auto');
                                        setFfmpegSyncOption('smart_sync');
                                      }}
                                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                                    />
                                    <span><b>Auto-Pilot Smart Sync</b> (Sangat Direkomendasikan)</span>
                                  </label>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                    <input
                                      type="radio"
                                      name="syncMode"
                                      value="manual"
                                      checked={syncMode === 'manual'}
                                      onChange={() => {
                                        setSyncMode('manual');
                                        setFfmpegSyncOption('shortest');
                                      }}
                                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                                    />
                                    <span>Kustom Manual (Terbuka untuk Profesional)</span>
                                  </label>
                                </div>

                                {syncMode === 'manual' && (
                                  <div className="form-group" style={{ flex: 1, marginTop: 8 }}>
                                    <label className="form-label">Metode Manual</label>
                                    <select className="form-select" value={ffmpegSyncOption} onChange={e => setFfmpegSyncOption(e.target.value)}>
                                      <option value="shortest">shortest (Potong video mengikuti audio - Default)</option>
                                      <option value="loop">loop (Ulang video jika lebih pendek dari audio)</option>
                                      <option value="stretch">stretch (Ubah kecepatan video mengikuti audio)</option>
                                      <option value="freeze">freeze (Tahan frame terakhir video di akhir)</option>
                                    </select>
                                  </div>
                                )}
                              </div>

                              <div className="form-group">
                                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                  <span>Video Scale (Zoom):</span>
                                  <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{Math.round(ffmpegVideoScale * 100)}%</span>
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <input 
                                    type="range" 
                                    min="1.0" 
                                    max="2.0" 
                                    step="0.05" 
                                    className="form-input" 
                                    value={ffmpegVideoScale} 
                                    onChange={e => setFfmpegVideoScale(Number(e.target.value))} 
                                    style={{ width: '100%', accentColor: 'var(--accent)' }} 
                                  />
                                </div>
                                <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Skala pembesaran video untuk menghindari deteksi hak cipta (100% sd 200%)</small>
                              </div>

                              <div style={{ display: 'flex', gap: 16 }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                    <span>SFX Volume:</span>
                                    <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{Math.round(ffmpegSfxVolume * 100)}%</span>
                                  </label>
                                  <input 
                                    type="range" 
                                    min="0.0" 
                                    max="1.0" 
                                    step="0.05" 
                                    className="form-input" 
                                    value={ffmpegSfxVolume} 
                                    onChange={e => setFfmpegSfxVolume(Number(e.target.value))} 
                                    style={{ width: '100%', accentColor: 'var(--accent)' }} 
                                  />
                                  <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Volume suara efek sekunder (0% sd 100%)</small>
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                    <span>BGM Volume:</span>
                                    <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{Math.round(ffmpegBgmVolume * 100)}%</span>
                                  </label>
                                  <input 
                                    type="range" 
                                    min="0.0" 
                                    max="1.0" 
                                    step="0.05" 
                                    className="form-input" 
                                    value={ffmpegBgmVolume} 
                                    onChange={e => setFfmpegBgmVolume(Number(e.target.value))} 
                                    style={{ width: '100%', accentColor: 'var(--accent)' }} 
                                  />
                                  <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Volume musik latar belakang BGM (0% sd 100%)</small>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Social Posting & FB settings */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginTop: '8px' }}>
                            <div>
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600' }}>Post Draft ke Sosial Media (Facebook Page)</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Kirimkan draf takarir dan teks otomatis setelah naskah video jadi.</div>
                            </div>
                            <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px', cursor: 'pointer' }}>
                              <input type="checkbox" checked={enableSocialPost} onChange={e => setEnableSocialPost(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                              <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: enableSocialPost ? 'var(--accent)' : '#3a3a50', transition: 'var(--transition)', borderRadius: '34px' }}>
                                <span style={{ position: 'absolute', content: '""', height: '20px', width: '20px', left: enableSocialPost ? '26px' : '3px', bottom: '3px', backgroundColor: 'white', transition: 'var(--transition)', borderRadius: '50%' }} />
                              </span>
                            </label>
                          </div>

                          {enableSocialPost && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingLeft: '12px', borderLeft: '2px solid var(--accent)' }}>
                              <strong style={{ fontSize: '0.9rem', display: 'block' }}>📘 Konfigurasi Draf Facebook Page</strong>
                              
                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '6px' }}>Halaman Facebook Target</label>
                                {facebookPages.length === 0 ? (
                                  <div style={{ fontSize: '0.8rem', color: '#ef4444', padding: '8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px' }}>
                                    ⚠️ Belum ada Halaman Facebook yang terhubung. Hubungkan akun di menu Pengaturan.
                                  </div>
                                ) : (
                                  <select
                                    className="form-select"
                                    value={facebookPageId}
                                    onChange={e => setFacebookPageId(e.target.value)}
                                    style={{ width: '100%' }}
                                  >
                                    {facebookPages.map(page => (
                                      <option key={page.id} value={page.id}>{page.name} ({page.category || 'N/A'})</option>
                                    ))}
                                  </select>
                                )}
                              </div>

                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '6px' }}>URL Server Publik untuk Media</label>
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="Contoh: https://domain-publik-anda.com"
                                  value={facebookServerUrl}
                                  onChange={e => setFacebookServerUrl(e.target.value)}
                                  style={{ width: '100%' }}
                                />
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                  Domain publik server ini. Jika kosong, akan menggunakan domain publik global di Pengaturan.
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Submit Bar */}
                    <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="submit" className="btn btn-primary" disabled={submitting} style={{ padding: '12px 30px', fontWeight: 'bold' }}>
                        {submitting ? 'Sedang Memproses Kampanye...' : '🚀 Mulai Generate Storyboard Video'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Table & Details Split / Section */}
          <div className="card">
            <div className="card-title">
              <span className="icon">📋</span> Riwayat Kampanye Resep
            </div>

            {loading ? (
              <p style={{ color: 'var(--text-muted)' }}>Memuat data kampanye...</p>
            ) : campaigns.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>Belum ada kampanye resep yang dibuat.</p>
            ) : (
              <table className="ideas-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textTransform: 'uppercase', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '12px' }}>ID & Tanggal</th>
                    <th style={{ padding: '12px' }}>Kategori</th>
                    <th style={{ padding: '12px' }}>Parent Folder NC</th>
                    <th style={{ padding: '12px' }}>G-Labs Engine</th>
                    <th style={{ padding: '12px' }}>Progress</th>
                    <th style={{ padding: '12px' }}>Status</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => {
                    const isSelected = selectedCampaign === c.id;
                    const catDisplay = c.category === 'Custom Input' ? (c.custom_category || 'Custom') : c.category;
                    const glabsOn = c.enable_glabs !== 0;
                    return (
                      <tr
                        key={c.id}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          background: isSelected ? 'var(--bg-card-hover)' : 'transparent',
                          cursor: 'pointer'
                        }}
                        onClick={() => setSelectedCampaign(c.id)}
                      >
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.id}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleString('id-ID')}</div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{catDisplay}</div>
                          <div style={{ fontSize: '0.75rem', color: c.campaign_type === 'video' ? 'var(--accent-light)' : 'var(--text-muted)' }}>
                            {c.campaign_type === 'video' ? '🎬 Reels Video' : '🖼️ Static Post'}
                          </div>
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                          📁 {c.nextcloud_parent_folder || 'MAKNA_Recipes'}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: glabsOn ? 'var(--accent-glow)' : 'rgba(255,255,255,0.05)',
                            color: glabsOn ? 'var(--accent-light)' : 'var(--text-muted)'
                          }}>
                            {glabsOn ? '🎥 ON' : '⏸️ OFF (Teks Only)'}
                          </span>
                        </td>
                        <td style={{ padding: '12px', fontFamily: 'var(--font-mono)' }}>
                          {c.completed_items} / {c.target_recipe_count} Item
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span className={`stat-value ${c.status === 'completed' ? 'success' : c.status === 'failed' ? 'danger' : 'warning'}`} style={{ fontSize: '0.85rem' }}>
                            {c.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(c.id);
                            }}
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Campaign Detail Modal / Drawer Card */}
          {selectedCampaign && (
            <div className="card" style={{ marginTop: '24px', border: '1px solid var(--accent)' }}>
              <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🔎 Detail Kampanye: {selectedCampaign}</span>
                <button className="btn btn-sm btn-secondary" onClick={() => setSelectedCampaign(null)}>Tutup</button>
              </div>

              {detailLoading ? (
                <p style={{ color: 'var(--text-muted)' }}>Memuat detail resep...</p>
              ) : !campaignDetail ? (
                <p style={{ color: 'var(--text-muted)' }}>Data detail tidak ditemukan.</p>
              ) : (
                <div>
                  {campaignDetail.nextcloud_folder_url && (
                    <div style={{ padding: '12px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', marginBottom: '16px', border: '1px solid var(--border)' }}>
                      <strong>🌐 Link Folder Nextcloud: </strong>
                      <a href={campaignDetail.nextcloud_folder_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-light)', textDecoration: 'underline' }}>
                        {campaignDetail.nextcloud_folder_url}
                      </a>
                    </div>
                  )}

                  <h4 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>Daftar Resep dalam Kampanye:</h4>
                  {campaignDetail.items?.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>Belum ada item resep.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {campaignDetail.items?.map((item, idx) => {
                        const isVideo = campaignDetail.campaign_type === 'video';
                        
                        let promptsObj = {};
                        let storyboardObj = {};
                        let dnaObj = {};
                        let seoObj = {};

                        try { promptsObj = JSON.parse(item.t2i_prompts_json || '{}'); } catch (_) {}
                        try { if (item.video_storyboard_json) storyboardObj = JSON.parse(item.video_storyboard_json); } catch (_) {}
                        try { if (item.video_dna_json) dnaObj = JSON.parse(item.video_dna_json); } catch (_) {}
                        try { if (item.seo_data_json) seoObj = JSON.parse(item.seo_data_json); } catch (_) {}

                        if (isVideo) {
                          return (
                            <div key={item.id} style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                                <h4 style={{ color: 'var(--accent-light)', margin: 0 }}>
                                  #{idx + 1} {item.recipe_title || 'Mengekstrak naskah video...'}
                                </h4>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  {item.fb_post_id && (
                                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(52, 152, 219, 0.15)', color: '#3498db', border: '1px solid rgba(52, 152, 219, 0.4)' }}>
                                      📘 FB Draft #{item.fb_post_id}
                                    </span>
                                  )}
                                  <span className={`stat-value ${item.status === 'completed' ? 'success' : item.status === 'failed' ? 'danger' : 'warning'}`} style={{ fontSize: '0.8rem' }}>
                                    STATUS: {item.status.toUpperCase()}
                                  </span>
                                </div>
                              </div>

                              {/* Visualisasi Pipeline Per Resep */}
                              {renderRecipePipeline(item, campaignDetail)}

                              {/* Video Storyboard (5 Modules Grid/List) */}
                              {Object.keys(storyboardObj).length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                                  <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>🎬 Naskah Storyboard & Prompt Google Veo:</div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    {Object.entries(storyboardObj).map(([mKey, mVal]) => {
                                      if (!mVal) return null;
                                      const copyId = `${item.id}_${mKey}`;
                                      const isCopied = copiedKey === copyId;
                                      return (
                                        <div key={mKey} style={{ background: 'var(--bg-primary)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                                            <span style={{ fontWeight: 700, color: 'var(--warning)', fontSize: '0.82rem' }}>
                                              📹 {mVal.module_name || mKey.toUpperCase()}
                                            </span>
                                            <button
                                              type="button"
                                              className="btn btn-sm btn-secondary"
                                              onClick={() => handleCopyPrompt(copyId, mVal.veo_prompt)}
                                              style={{ fontSize: '0.7rem', padding: '3px 8px' }}
                                            >
                                              {isCopied ? '✓ Tersalin!' : '📋 Copy Veo Prompt'}
                                            </button>
                                          </div>
                                          
                                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                                            <div>
                                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Tujuan & Skenario:</div>
                                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}><strong>Goal:</strong> {mVal.goal || '-'}</div>
                                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}><strong>Visual:</strong> {mVal.visual_scenario || '-'}</div>
                                            </div>
                                            <div>
                                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Spesifikasi Kamera:</div>
                                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>🎥 Angle: {mVal.camera_angle || '-'}</div>
                                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>🎬 Movement: {mVal.camera_movement || '-'}</div>
                                            </div>
                                          </div>

                                          <div style={{ background: 'var(--accent-glow)', padding: '8px 12px', borderRadius: 4, borderLeft: '3px solid var(--accent)', marginBottom: '8px' }}>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--accent-light)', fontWeight: 600 }}>🎙️ Naskah Voice Over (Indonesia):</div>
                                            <div style={{ fontSize: '0.85rem', color: '#fff', fontStyle: 'italic', fontWeight: 500 }}>"{mVal.voice_over || '-'}"</div>
                                          </div>

                                          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Veo Prompt:</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap' }}>{mVal.veo_prompt || '-'}</div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <p style={{ color: 'var(--text-muted)', marginTop: '12px' }}>Naskah storyboard belum terbuat.</p>
                              )}

                              {/* SEO & Performance Tabs/Sections */}
                              {seoObj.facebook_copy && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                                  <div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>🌐 Copywriting & Sosial Media:</div>
                                    <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                      <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--accent-light)' }}>FB Draft Caption:</div>
                                      <div style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 600, marginTop: '4px' }}>Judul: {seoObj.facebook_copy.title || '-'}</div>
                                      <pre style={{
                                        background: 'rgba(0,0,0,0.2)',
                                        padding: '8px',
                                        borderRadius: 4,
                                        fontSize: '0.75rem',
                                        color: 'var(--text-secondary)',
                                        fontFamily: 'var(--font-mono)',
                                        whiteSpace: 'pre-wrap',
                                        maxHeight: '140px',
                                        overflowY: 'auto',
                                        marginTop: '6px'
                                      }}>
                                        {seoObj.facebook_copy.caption || '-'}
                                      </pre>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                                        💬 Komentar Pertama: <em>"{seoObj.facebook_copy.first_comment || '-'}"</em>
                                      </div>
                                    </div>
                                    {seoObj.thumbnail && (
                                      <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginTop: '10px' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--accent-light)' }}>🖼️ Alternatif Teks Thumbnail:</div>
                                        <ol style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', paddingLeft: '16px', margin: '4px 0 0 0' }}>
                                          {seoObj.thumbnail.map((t, idx) => <li key={idx}><strong>{t}</strong></li>)}
                                        </ol>
                                      </div>
                                    )}
                                  </div>

                                  <div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>🧬 Video DNA & Performa:</div>
                                    {dnaObj && (
                                      <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', maxHeight: '180px', overflowY: 'auto' }}>
                                        <table style={{ width: '100%', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                          <tbody>
                                            {Object.entries(dnaObj).map(([k, v]) => (
                                              <tr key={k} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                <td style={{ padding: '3px 0', fontWeight: 600, color: 'var(--text-muted)' }}>{k}</td>
                                                <td style={{ padding: '3px 0', textAlign: 'right', color: '#fff' }}>{String(v)}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                    
                                    {seoObj.performance_hypothesis && (
                                      <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginTop: '10px' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--accent-light)' }}>🧪 Hipotesis Performa:</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                          <strong>Retensi:</strong> {seoObj.performance_hypothesis.retention_reasoning || '-'}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                          <strong>Faktor Risiko:</strong> {seoObj.performance_hypothesis.risk_factors || '-'}
                                        </div>
                                        {seoObj.performance_hypothesis.ab_testing_ideas && (
                                          <div style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: '4px', fontWeight: 600 }}>
                                            🧪 A/B Test: {seoObj.performance_hypothesis.ab_testing_ideas.join(', ')}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Manual Facebook Posting Panel */}
                              <div style={{
                                marginTop: '16px',
                                padding: '12px 16px',
                                background: 'rgba(24, 119, 242, 0.08)',
                                border: '1px solid rgba(24, 119, 242, 0.3)',
                                borderRadius: 'var(--radius-sm)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '12px'
                              }}>
                                <div>
                                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1877f2', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    📘 Integrasi Facebook Page (Draft / Pending)
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {item.fb_post_id ? `Draft tersimpan di Facebook Page (#${item.fb_post_id})` : 'Kirim teks naskah video ini ke tab Drafts di Facebook Page Anda.'}
                                  </div>
                                </div>

                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    type="button"
                                    className="btn btn-sm"
                                    style={{ background: '#1877f2', borderColor: '#1877f2', color: '#fff', fontSize: '0.78rem', padding: '6px 14px', fontWeight: 600, borderRadius: '4px', cursor: 'pointer' }}
                                    disabled={postingFbId === item.id || !item.recipe_markdown_text}
                                    onClick={() => handleManualFbPost(item.id, (campaignDetail?.enable_glabs === 1 && campaignDetail?.nextcloud_folder_url) ? 'photo' : 'text_only')}
                                  >
                                    {postingFbId === item.id ? '⏳ Mengirim Draft...' : ((campaignDetail?.enable_glabs === 1 && campaignDetail?.nextcloud_folder_url) ? '📱 Post Draft Bergambar ke FB' : '📱 Post Draft Teks ke FB')}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // Original static campaign view
                        return (
                          <div key={item.id} style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '8px' }}>
                              <h4 style={{ color: 'var(--accent-light)', margin: 0 }}>
                                #{idx + 1} {item.recipe_title || 'Mengekstrak judul resep...'}
                              </h4>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                {item.fb_post_id && (
                                  <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(52, 152, 219, 0.15)', color: '#3498db', border: '1px solid rgba(52, 152, 219, 0.4)' }}>
                                    📘 FB Draft #{item.fb_post_id}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-sm btn-secondary"
                                  style={{ fontSize: '0.72rem', padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  disabled={postingFbId === item.id || !item.recipe_markdown_text}
                                  onClick={() => handleManualFbPost(item.id, (campaignDetail?.enable_glabs === 1 && campaignDetail?.nextcloud_folder_url) ? 'photo' : 'text_only')}
                                >
                                  {postingFbId === item.id ? '⏳ Kirim Draft...' : ((campaignDetail?.enable_glabs === 1 && campaignDetail?.nextcloud_folder_url) ? '📱 Post Draft Bergambar' : '📱 Post Draft Teks')}
                                </button>
                                <span className={`stat-value ${item.status === 'completed' ? 'success' : item.status === 'failed' ? 'danger' : 'warning'}`} style={{ fontSize: '0.8rem' }}>
                                  STATUS: {item.status.toUpperCase()}
                                </span>
                              </div>
                            </div>

                            {/* Visualisasi Pipeline Per Resep */}
                            {renderRecipePipeline(item, campaignDetail)}

                            {/* Content & Details */}
                            {item.img_grid_path ? (
                              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap', marginTop: '12px' }}>
                                <div style={{ flex: '0 0 220px' }}>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Grid Poster 2x2:</div>
                                  <img
                                    src={item.img_grid_path}
                                    alt="Grid Poster"
                                    style={{ width: '100%', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
                                  />
                                </div>
                                <div style={{ flex: 1, minWidth: '300px' }}>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Pratinjau Resep (.md):</div>
                                  <pre style={{
                                    background: 'var(--bg-primary)',
                                    padding: '12px',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.8rem',
                                    maxHeight: '220px',
                                    overflowY: 'auto',
                                    color: 'var(--text-secondary)',
                                    fontFamily: 'var(--font-mono)',
                                    whiteSpace: 'pre-wrap'
                                  }}>
                                    {item.recipe_markdown_text || 'Teks resep belum tersedia.'}
                                  </pre>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                                <div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Teks Resep (.md):</div>
                                  <pre style={{
                                    background: 'var(--bg-primary)',
                                    padding: '12px',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.8rem',
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    color: 'var(--text-secondary)',
                                    fontFamily: 'var(--font-mono)',
                                    whiteSpace: 'pre-wrap'
                                  }}>
                                    {item.recipe_markdown_text || 'Teks resep belum tersedia.'}
                                  </pre>
                                </div>
                              </div>
                            )}

                            {/* Action Bar Khusus Facebook Posting */}
                            <div style={{
                              marginTop: '16px',
                              padding: '12px 16px',
                              background: 'rgba(24, 119, 242, 0.08)',
                              border: '1px solid rgba(24, 119, 242, 0.3)',
                              borderRadius: 'var(--radius-sm)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '12px'
                            }}>
                              <div>
                                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1877f2', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  📘 Integrasi Facebook Page (Draft / Pending)
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {item.fb_post_id ? `Draft tersimpan di Facebook Page (#${item.fb_post_id})` : 'Kirim teks resep ini ke tab Drafts di Facebook Page Anda.'}
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  style={{ background: '#1877f2', borderColor: '#1877f2', color: '#fff', fontSize: '0.78rem', padding: '6px 14px', fontWeight: 600, borderRadius: '4px', cursor: 'pointer' }}
                                  disabled={postingFbId === item.id || !item.recipe_markdown_text}
                                  onClick={() => handleManualFbPost(item.id, (campaignDetail?.enable_glabs === 1 && campaignDetail?.nextcloud_folder_url) ? 'photo' : 'text_only')}
                                >
                                  {postingFbId === item.id ? '⏳ Mengirim Draft...' : ((campaignDetail?.enable_glabs === 1 && campaignDetail?.nextcloud_folder_url) ? '📱 Post Draft Bergambar ke FB' : '📱 Post Draft Teks ke FB')}
                                </button>
                              </div>
                            </div>

                            {/* 1 Kolom Vertikal Prompt T2I dengan Tombol Copy */}
                            {Object.keys(promptsObj).length > 0 && (
                              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px dashed var(--border)' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--accent-light)', fontWeight: 600, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  📷 Prompt T2I Gambar AI (4 Fase Instruksional):
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                  {Object.entries(promptsObj).map(([k, v]) => {
                                    const copyId = `${item.id}_${k}`;
                                    const isCopied = copiedKey === copyId;
                                    const phaseLabels = {
                                      image_1: 'Fase 1: Raw Ingredients (Bahan Mentah)',
                                      image_2: 'Fase 2: Cooking Process (Proses Memasak)',
                                      image_3: 'Fase 3: Finished Result (Hasil Jadi)',
                                      image_4: 'Fase 4: Plated & Served (Disajikan)'
                                    };

                                    return (
                                      <div key={k} style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--warning)', textTransform: 'uppercase' }}>
                                            {phaseLabels[k] || k}
                                          </span>
                                          <button
                                            className="btn btn-sm btn-secondary"
                                            onClick={() => handleCopyPrompt(copyId, v)}
                                            style={{ fontSize: '0.7rem', padding: '3px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                          >
                                            {isCopied ? '✓ Tersalin!' : '📋 Salin Prompt'}
                                          </button>
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                                          {v}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
