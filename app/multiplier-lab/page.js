'use client';

import Sidebar from '../components/Sidebar';
import VisualIdentitySelector from '../components/VisualIdentitySelector';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

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

function MultiplierLabPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preSelectedAssetId = searchParams.get('asset_id');

  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [workflowMode, setWorkflowMode] = useState('multi_blueprint_one_product'); // 'multi_blueprint_one_product' | 'one_blueprint_multi_product'
  const [selectedBlueprintIds, setSelectedBlueprintIds] = useState([]);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [combinationRows, setCombinationRows] = useState([]);
  const [nicheFilter, setNicheFilter] = useState('');
  const [niches, setNiches] = useState([]);
  const [selectedBlueprintForModal, setSelectedBlueprintForModal] = useState(null);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedProductForModal, setSelectedProductForModal] = useState(null);
  const [presets, setPresets] = useState([]);
  const [selectedPresetKey, setSelectedPresetKey] = useState('');
  const [showPresetSaveModal, setShowPresetSaveModal] = useState(false);
  const [newPresetLabel, setNewPresetLabel] = useState('');
  const [newPresetKey, setNewPresetKey] = useState('');
  const [visualStylePreset, setVisualStylePreset] = useState('3d_claymation_cozy');

  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [campaigns, setCampaigns] = useState([]);

  const [productionMode, setProductionMode] = useState('single');
  const [activeAccordion, setActiveAccordion] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const pollingRef = useRef(null);
  const terminalRef = useRef(null);

  const [showConfigForm, setShowConfigForm] = useState(false);
  const [isSchedulerActive, setIsSchedulerActive] = useState(true);
  const [terminalLogs, setTerminalLogs] = useState('');

  const [productUrl, setProductUrl] = useState('');
  const [affiliateUrl, setAffiliateUrl] = useState('');
  const [massUrlsText, setMassUrlsText] = useState('');

  const [brandProfiles, setBrandProfiles] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [filterBrandId, setFilterBrandId] = useState('all');
  const [products, setProducts] = useState([]);
  const [campaignName, setCampaignName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [enableAudioSegment, setEnableAudioSegment] = useState(false);
  const [sfxSetting, setSfxSetting] = useState('without_sfx');
  const [targetProductId, setTargetProductId] = useState('');

  const [narrativeMode, setNarrativeMode] = useState('Storytelling');
  const [visualStyle, setVisualStyle] = useState('Cinematic');
  const [targetAi, setTargetAi] = useState('Google Veo (8s)');
  const [videoModel, setVideoModel] = useState('veo_31_lite');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [faceVisibility, setFaceVisibility] = useState('Faceless');
  const [wordsPerClip, setWordsPerClip] = useState('17-19 kata');

  const [isVsoActive, setIsVsoActive] = useState(false);
  const [visualIdentity, setVisualIdentity] = useState({
    preset_id: 'hands_only_muslimah_sage_kitchen',
    inline_config: null,
    visual_overrides_json: null
  });
  const [characterConcept, setCharacterConcept] = useState('faceless');
  const [subjectDemographic, setSubjectDemographic] = useState('syari_classic');
  const [wardrobeStyle, setWardrobeStyle] = useState('random');
  const [wardrobeStyleCustom, setWardrobeStyleCustom] = useState('');
  const [lightingStyle, setLightingStyle] = useState('random');
  const [lightingStyleCustom, setLightingStyleCustom] = useState('');

  const [isBridgingActive, setIsBridgingActive] = useState(true);
  const [targetClipsCount, setTargetClipsCount] = useState(4);
  const [bridgeAtClip, setBridgeAtClip] = useState(2);
  const [bridgeDurationClips, setBridgeDurationClips] = useState(1);
  const [promotionStyle, setPromotionStyle] = useState('Softselling');
  const [bridgingMode, setBridgingMode] = useState('url_extract');
  const [manualProductName, setManualProductName] = useState('');
  const [manualProductDesc, setManualProductDesc] = useState('');
  const [manualProductUsp, setManualProductUsp] = useState('');
  const [productRefImage, setProductRefImage] = useState(null);
  const [productFilenameDeclare, setProductFilenameDeclare] = useState('');
  const [visualMode, setVisualMode] = useState('hybrid_lock');

  const [enableTts, setEnableTts] = useState(true);
  const [voiceProvider, setVoiceProvider] = useState('minimax');
  const [voicePersona, setVoicePersona] = useState('Indonesian_casual_reporter_vv2');
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [voiceVolume, setVoiceVolume] = useState(1.0);
  const [ttsModelQuality, setTtsModelQuality] = useState('speech-2.8-turbo');
  const [enableGlabs, setEnableGlabs] = useState(true);
  const [enableFfmpeg, setEnableFfmpeg] = useState(true);
  const [targetLanguage, setTargetLanguage] = useState('id-ID');
  const [ffmpegSyncOption, setFfmpegSyncOption] = useState('smart_sync');
  const [syncMode, setSyncMode] = useState('auto');
  const [ffmpegVideoScale, setFfmpegVideoScale] = useState(1.1);
  const [ffmpegSfxVolume, setFfmpegSfxVolume] = useState(0.0);
  const [ffmpegBgmVolume, setFfmpegBgmVolume] = useState(0.0);
  const [enableSocialPost, setEnableSocialPost] = useState(false);
  const [enableVoAudit, setEnableVoAudit] = useState(1);

  const [nextcloudParentFolder, setNextcloudParentFolder] = useState('/MAKNA_Assets');
  const [targetDemographic, setTargetDemographic] = useState('genz_casual');
  const [targetDemographicCustom, setTargetDemographicCustom] = useState('');
  const [aiDirective, setAiDirective] = useState('');
  const [mandatoryOutroLine, setMandatoryOutroLine] = useState('');
  const [customInstruction, setCustomInstruction] = useState('');

  const fetchProducts = async (search = '') => {
    try {
      const res = await fetch(`/api/v2/products?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.data || []);
      }
    } catch (err) {
      console.error('Fetch products error:', err);
    }
  };

  const fetchPresets = () => {
    fetch('/api/v2/operator-presets')
      .then(r => r.json())
      .then(d => {
        if (d.success) setPresets(d.presets || []);
      })
      .catch(() => {});
  };

  const applyPresetToForm = (preset) => {
    if (!preset || !preset.config) return;
    const config = preset.config;

    // Accordion 1: Basic Creative Strategy
    if (config.basic_strategy) {
      setNarrativeMode(config.basic_strategy.narrative_mode || 'Storytelling');
      setVoiceProvider(config.basic_strategy.voice_provider || 'minimax');
      setVoicePersona(config.basic_strategy.voice_persona || 'Kore');
      setVoiceSpeed(Number(config.basic_strategy.voice_speed ?? 1.0));
      setVoiceVolume(Number(config.basic_strategy.voice_volume ?? 1.0));
      setTtsModelQuality(config.basic_strategy.tts_model_quality || 'speech-2.8-turbo');
      setTargetLanguage(config.basic_strategy.target_language || 'id-ID');
      setTargetDemographic(config.basic_strategy.target_demographic || 'genz_casual');
      setTargetDemographicCustom(config.basic_strategy.target_demographic_custom || '');
      setCustomInstruction(config.basic_strategy.custom_instruction || '');
      setAiDirective(config.basic_strategy.ai_directive || '');
      setMandatoryOutroLine(config.basic_strategy.mandatory_outro_line || '');
      setSfxSetting(config.basic_strategy.sfx_setting || 'without_sfx');
      setEnableAudioSegment(config.basic_strategy.enable_audio_segment || false);
      setEnableVoAudit(config.basic_strategy.enable_vo_audit ?? 1);
      setNextcloudParentFolder(config.basic_strategy.nextcloud_parent_folder || '/MAKNA_Assets');
      setPromotionStyle(config.basic_strategy.promotion_style || 'Softselling');
    }

    // Accordion 2: Aesthetics & Visual Settings
    if (config.visual_engine) {
      setVisualStyle(config.visual_engine.visual_style || 'Cinematic');
      setVisualMode(config.visual_engine.visual_mode || 'pure_t2v');
      setVideoModel(config.visual_engine.video_model || 'veo_31_lite');
      setFaceVisibility(config.visual_engine.face_visibility || 'Faceless');
      setTargetClipsCount(config.visual_engine.target_clips_count || 4);
      setWordsPerClip(config.visual_engine.words_per_clip || '17-19 kata');
      setAspectRatio(config.visual_engine.aspect_ratio || '9:16');
      if (config.visual_engine.video_model === 'veo_31_lite') {
        setTargetAi('Google Veo (8s)');
      } else {
        setTargetAi('Google Veo (5s)');
      }
    }

    // Accordion 3: Product Bridging Settings
    if (config.product_bridging) {
      setIsBridgingActive(config.product_bridging.is_bridging_active || false);
      setBridgeAtClip(config.product_bridging.bridge_at_clip || 2);
      setBridgeDurationClips(config.product_bridging.bridge_duration_clips || 1);
    }

    // Accordion 4: Visual Swap Overrides (VSO)
    if (config.visual_swap) {
      setIsVsoActive(config.visual_swap.is_vso_active || false);
      setVisualIdentity({
        preset_id: config.visual_swap.visual_identity_preset_id || 'hands_only_muslimah_sage_kitchen',
        inline_config: config.visual_swap.visual_identity_inline_config || null,
        visual_overrides_json: config.visual_swap.visual_overrides_json || null
      });
      setCharacterConcept(config.visual_swap.character_concept || 'faceless');
      setSubjectDemographic(config.visual_swap.subject_demographic || 'syari_classic');
      setWardrobeStyle(config.visual_swap.wardrobe_style || 'random');
      setWardrobeStyleCustom(config.visual_swap.wardrobe_style_custom || '');
      setLightingStyle(config.visual_swap.lighting_style || 'random');
      setLightingStyleCustom(config.visual_swap.lighting_style_custom || '');
      setVisualStylePreset(config.visual_swap.visual_style_preset || '3d_claymation_cozy');
    }

    // Workflow Settings
    if (config.workflow) {
      setEnableTts(config.workflow.enable_tts || false);
      setEnableGlabs(config.workflow.enable_glabs || false);
      setEnableFfmpeg(config.workflow.enable_ffmpeg || false);
      setEnableSocialPost(config.workflow.enable_social_post || false);
      setFfmpegSyncOption(config.workflow.ffmpeg_sync_option || 'smart_sync');
      setFfmpegVideoScale(Number(config.workflow.ffmpeg_video_scale ?? 1.0));
      setFfmpegSfxVolume(Number(config.workflow.ffmpeg_sfx_volume ?? 0.0));
      setFfmpegBgmVolume(Number(config.workflow.ffmpeg_bgm_volume ?? 0.0));
    }
  };

  const handleSaveAsPreset = async (e) => {
    e.preventDefault();
    if (!newPresetLabel.trim() || !newPresetKey.trim()) {
      showToast('Label dan Key preset wajib diisi.', 'error');
      return;
    }

    const presetConfig = {
      basic_strategy: {
        narrative_mode: narrativeMode,
        voice_provider: voiceProvider,
        voice_persona: voicePersona,
        voice_speed: Number(voiceSpeed),
        voice_volume: Number(voiceVolume),
        tts_model_quality: ttsModelQuality,
        target_language: targetLanguage,
        target_demographic: targetDemographic,
        target_demographic_custom: targetDemographicCustom,
        custom_instruction: customInstruction,
        ai_directive: aiDirective,
        mandatory_outro_line: mandatoryOutroLine,
        sfx_setting: sfxSetting,
        enable_audio_segment: enableAudioSegment,
        enable_vo_audit: enableVoAudit ? 1 : 0,
        nextcloud_parent_folder: nextcloudParentFolder,
        promotion_style: promotionStyle
      },
      visual_engine: {
        visual_style: visualStyle,
        visual_mode: visualMode,
        video_model: videoModel,
        face_visibility: faceVisibility,
        target_clips_count: targetClipsCount,
        words_per_clip: wordsPerClip,
        aspect_ratio: aspectRatio
      },
      product_bridging: {
        is_bridging_active: isBridgingActive,
        bridge_at_clip: bridgeAtClip,
        bridge_duration_clips: Number(bridgeDurationClips)
      },
      visual_swap: {
        is_vso_active: isVsoActive,
        character_concept: characterConcept,
        subject_demographic: subjectDemographic,
        wardrobe_style: wardrobeStyle,
        wardrobe_style_custom: wardrobeStyleCustom,
        lighting_style: lightingStyle,
        lighting_style_custom: lightingStyleCustom,
        visual_style_preset: visualStylePreset,
        visual_identity_preset_id: isVsoActive ? visualIdentity.preset_id : null,
        visual_identity_inline_config: isVsoActive && visualIdentity.preset_id === 'inline' ? visualIdentity.inline_config : null,
        visual_overrides_json: isVsoActive && visualIdentity.preset_id === 'custom' ? visualIdentity.visual_overrides_json : null
      },
      workflow: {
        enable_tts: enableTts,
        enable_glabs: enableGlabs,
        enable_ffmpeg: enableFfmpeg,
        enable_social_post: enableSocialPost,
        ffmpeg_sync_option: ffmpegSyncOption,
        ffmpeg_video_scale: Number(ffmpegVideoScale),
        ffmpeg_sfx_volume: Number(ffmpegSfxVolume),
        ffmpeg_bgm_volume: Number(ffmpegBgmVolume)
      }
    };

    try {
      const res = await fetch('/api/v2/operator-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: newPresetKey.trim().toLowerCase(),
          label: newPresetLabel.trim(),
          config: presetConfig
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(`Preset "${newPresetLabel}" berhasil disimpan.`);
      setShowPresetSaveModal(false);
      setNewPresetLabel('');
      setNewPresetKey('');
      fetchPresets();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  useEffect(() => {
    fetchAssets('', '');
    fetchTasks();
    pollLogs();
    fetch('/api/v2/brand-profiles').then(r => r.json()).then(d => { if (d.success) setBrandProfiles(d.data || []); }).catch(() => {});
    fetch('/api/v2/deconstruct?limit=1').then(r => r.json()).then(d => { if (d.success) setNiches(d.niches || []); }).catch(() => {});
    fetchProducts('');
    fetchPresets();

    pollingRef.current = setInterval(() => {
      fetchTasks(true);
    }, 5000);

    const logInterval = setInterval(pollLogs, 3000);

    return () => {
      clearInterval(pollingRef.current);
      clearInterval(logInterval);
    };
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  useEffect(() => {
    if (assets.length > 0 && preSelectedAssetId) {
      setSelectedAssetId(preSelectedAssetId);
    }
  }, [assets, preSelectedAssetId]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAssets = async (query = '', niche = '') => {
    setLoadingAssets(true);
    try {
      const res = await fetch(`/api/v2/deconstruct?assets=true&q=${encodeURIComponent(query)}&niche=${encodeURIComponent(niche)}`);
      const data = await res.json();
      if (data.success) {
        setAssets(data.assets || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAssets(false);
    }
  };

  const generateCombinationRows = () => {
    let rows = [];
    const selectedBlueprints = assets.filter(a => selectedBlueprintIds.includes(a.id));

    if (workflowMode === 'multi_blueprint_one_product') {
      if (selectedBlueprintIds.length === 0) {
        showToast('Pilih setidaknya satu blueprint video', 'error');
        return;
      }
      
      let singleProduct = {};
      if (bridgingMode === 'select_existing') {
        const prod = products.find(p => p.id === targetProductId);
        if (!prod) {
          showToast('Pilih produk dari pustaka terlebih dahulu', 'error');
          return;
        }
        singleProduct = {
          target_product_id: targetProductId,
          product_name: prod.product_name,
          target_product_url: prod.source_url || '',
          affiliate_url: affiliateUrl || ''
        };
      } else if (bridgingMode === 'url_extract') {
        if (!productUrl) {
          showToast('Masukkan URL produk terlebih dahulu', 'error');
          return;
        }
        singleProduct = {
          target_product_id: null,
          product_name: 'URL Extract Product',
          target_product_url: productUrl,
          affiliate_url: affiliateUrl || ''
        };
      } else {
        if (!manualProductName) {
          showToast('Masukkan nama produk terlebih dahulu', 'error');
          return;
        }
        singleProduct = {
          target_product_id: null,
          product_name: manualProductName,
          target_product_url: '',
          affiliate_url: affiliateUrl || ''
        };
      }

      for (const bp of selectedBlueprints) {
        rows.push({
          deconstruct_asset_id: bp.id,
          deconstruct_asset_url: bp.source_url,
          deconstruct_asset_title: bp.niche || bp.original_caption || bp.id,
          target_product_id: singleProduct.target_product_id,
          target_product_name: singleProduct.product_name,
          target_product_url: singleProduct.target_product_url,
          affiliate_url: singleProduct.affiliate_url
        });
      }
    } else {
      if (!selectedAssetId) {
        showToast('Pilih satu blueprint video terlebih dahulu', 'error');
        return;
      }
      const singleBp = assets.find(a => a.id === selectedAssetId);
      if (!singleBp) return;

      const libProducts = products.filter(p => selectedProductIds.includes(p.id)).map(p => ({
        target_product_id: p.id,
        product_name: p.product_name,
        target_product_url: p.source_url || '',
        affiliate_url: ''
      }));

      const textareaUrls = massUrlsText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(url => {
          let cleanUrl = url;
          let cleanAff = '';
          if (url.includes('|')) {
            const parts = url.split('|');
            cleanUrl = parts[0].trim();
            cleanAff = parts[1].trim();
          }
          return {
            target_product_id: null,
            product_name: 'URL: ' + (cleanUrl.length > 30 ? cleanUrl.substring(0, 30) + '...' : cleanUrl),
            target_product_url: cleanUrl,
            affiliate_url: cleanAff
          };
        });

      const allProducts = [...libProducts, ...textareaUrls];
      if (allProducts.length === 0) {
        showToast('Pilih setidaknya satu produk dari pustaka atau masukkan URL produk massal', 'error');
        return;
      }

      for (const prod of allProducts) {
        rows.push({
          deconstruct_asset_id: singleBp.id,
          deconstruct_asset_url: singleBp.source_url,
          deconstruct_asset_title: singleBp.niche || singleBp.original_caption || singleBp.id,
          target_product_id: prod.target_product_id,
          target_product_name: prod.product_name,
          target_product_url: prod.target_product_url,
          affiliate_url: prod.affiliate_url
        });
      }
    }

    setCombinationRows(rows);
    showToast('Tabel review kombinasi berhasil dibuat!');
  };

  const fetchTasks = async (isPoll = false) => {
    if (!isPoll) setLoadingTasks(true);
    try {
      const res = await fetch('/api/v2/multiplier');
      const data = await res.json();
      if (data.success) {
        setTasks(data.tasks || []);
        setIsSchedulerActive(data.isSchedulerActive);
        
        // Group tasks into campaigns (batches)
        const groups = {};
        data.tasks.forEach(t => {
          const bid = t.batch_id || `single_${t.id}`;
          if (!groups[bid]) {
            let brandName = '';
            let productTitle = '';
            try {
              const snap = t.product_snapshot_json ? (typeof t.product_snapshot_json === 'string' ? JSON.parse(t.product_snapshot_json) : t.product_snapshot_json) : null;
              brandName = snap?.product_name || '';
            } catch (_) {}

            groups[bid] = {
              id: bid,
              brand_profile_id: t.brand_profile_id || 'default_tenant',
              brand_name: t.brand_name || brandName || 'default_tenant',
              campaign_name: t.new_caption ? t.new_caption.slice(0, 50) : `Multiplier Campaign ${bid.slice(4, 10)}`,
              created_at: t.created_at,
              status: t.status,
              tasks: [],
              stats: { total: 0, completed: 0, failed: 0, processing: 0, paused: 0 }
            };
          }
          groups[bid].tasks.push(t);
          groups[bid].stats.total++;
          if (t.status === 'completed') {
            groups[bid].stats.completed++;
          } else if (t.status === 'failed') {
            groups[bid].stats.failed++;
          } else if (t.status === 'paused') {
            groups[bid].stats.paused++;
          } else {
            groups[bid].stats.processing++;
          }
        });

        // Determine aggregated campaign status
        const campaignList = Object.values(groups).map(g => {
          let overallStatus = 'running';
          if (g.stats.completed === g.stats.total) {
            overallStatus = 'completed';
          } else if (g.stats.processing > 0) {
            overallStatus = 'running';
          } else if (g.stats.failed > 0) {
            overallStatus = 'failed';
          } else if (g.stats.paused > 0) {
            overallStatus = 'paused';
          }
          
          return { ...g, status: overallStatus };
        });

        setCampaigns(campaignList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!isPoll) setLoadingTasks(false);
    }
  };

  const pollLogs = async () => {
    try {
      const res = await fetch(`/api/system-logs?type=multiplier&t=${Date.now()}`);
      const text = await res.text();
      setTerminalLogs(text);
    } catch (_) {}
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSubmitting(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/v2/products/image', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setProductRefImage(data.filePath);
        setProductFilenameDeclare(data.fileName);
        showToast('Foto produk berhasil diunggah.');
      } else {
        showToast(data.error || 'Gagal mengunggah foto.', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (combinationRows.length === 0) {
      showToast('Tabel tinjauan kombinasi kosong. Silakan buat tinjauan kombinasi terlebih dahulu.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const dbProduct = targetProductId ? products.find(p => p.id === targetProductId) : null;
      const dbPhotoUrl = dbProduct ? (dbProduct.cleaned_photo_url || dbProduct.clean_photo_url || dbProduct.raw_photo_url) : null;

      const payload = {
        mode: workflowMode,
        rows: combinationRows.map(row => ({
          deconstruct_asset_id: row.deconstruct_asset_id,
          target_product_id: row.target_product_id,
          target_product_url: row.target_product_url,
          affiliate_url: row.affiliate_url
        })),
        vso_config_json: JSON.stringify({
          narrativeMode, visualStyle, targetAi, videoModel, aspectRatio, faceVisibility, wordsPerClip,
          isVsoActive, characterConcept, subjectDemographic, wardrobeStyle, wardrobeStyleCustom, lightingStyle, lightingStyleCustom
        }),
        bridging_config_json: JSON.stringify({
          isBridgingActive, targetClipsCount, bridgeAtClip, bridgeDurationClips, promotionStyle, bridgingMode,
          manualProductName, manualProductDesc, manualProductUsp, productUrl, visualMode
        }),
        audio_config_json: JSON.stringify({
          enableTts, voiceProvider, voicePersona, voiceSpeed, voiceVolume, ttsModelQuality,
          enableGlabs, enableFfmpeg, targetLanguage, ffmpegSyncOption, syncMode,
          ffmpegVideoScale, ffmpegSfxVolume, ffmpegBgmVolume, enableSocialPost,
          nextcloudParentFolder, targetDemographic, targetDemographicCustom, aiDirective,
          mandatoryOutroLine, customInstruction
        }),
        enable_vo_audit: enableVoAudit ? 1 : 0,
        product_ref_image_path: dbPhotoUrl || productRefImage
      };

      const res = await fetch('/api/v2/multiplier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Kampanye Multiplier baru berhasil didaftarkan!');
        setShowConfigForm(false);
        setProductUrl('');
        setAffiliateUrl('');
        setMassUrlsText('');
        setProductRefImage(null);
        setSelectedBlueprintIds([]);
        setSelectedProductIds([]);
        setCombinationRows([]);
        fetchTasks();
      } else {
        showToast(data.error || 'Gagal mendaftarkan kampanye.', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleGlobalScheduler = async () => {
    try {
      const res = await fetch('/api/v2/multiplier', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_scheduler' })
      });
      const data = await res.json();
      if (data.success) {
        setIsSchedulerActive(data.isActive);
        showToast(`Status Scheduler berhasil diubah menjadi: ${data.isActive ? 'AKTIF' : 'NONAKTIF'}`);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const toggleStatus = async (campaign) => {
    let action = 'resume';
    if (campaign.status === 'running') {
      action = 'pause';
    } else if (campaign.status === 'failed') {
      action = 'retry_failed';
    }

    try {
      const res = await fetch('/api/v2/multiplier', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, batchId: campaign.id })
      });
      const data = await res.json();
      if (data.success) {
        const msg = action === 'pause' 
          ? 'Berhasil menjeda kampanye' 
          : (action === 'retry_failed' ? 'Berhasil memicu ulang tugas yang gagal' : 'Berhasil melanjutkan kampanye');
        showToast(msg);
        fetchTasks();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const deleteCampaign = async (batchId) => {
    if (!confirm('Apakah Anda yakin ingin menghapus seluruh kampanye beserta tugas di dalamnya?')) return;
    try {
      const res = await fetch(`/api/v2/multiplier?batchId=${batchId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Kampanye berhasil dihapus.');
        fetchTasks();
      } else {
        showToast(data.error || 'Gagal menghapus kampanye.', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const filteredCampaigns = campaigns.filter(c => filterBrandId === 'all' || c.brand_profile_id === filterBrandId);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              🧬 Multiplier Lab & Remake Engine
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: 4 }}>
              Duplikasi & rekonstruksi massal video konten performa tinggi untuk katalog produk Anda.
            </p>
          </div>
          <button
            onClick={() => setShowConfigForm(!showConfigForm)}
            className="btn btn-primary"
            style={{ fontWeight: 600, padding: '10px 20px', borderRadius: 8, fontSize: '0.88rem' }}
          >
            {showConfigForm ? '📂 Tutup Form Kreasi' : '⚡ Buat Kampanye Baru'}
          </button>
        </div>

        {toast && (
          <div style={{
            position: 'fixed', top: 20, right: 20, zIndex: 9999,
            padding: '12px 24px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600,
            background: toast.type === 'error' ? 'var(--status-danger-soft)' : 'var(--status-success-soft)',
            border: `1px solid ${toast.type === 'error' ? 'var(--danger)' : 'var(--success)'}`,
            color: 'var(--text-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}>
            {toast.message}
          </div>
        )}

        {/* Creation Config Form */}
        {showConfigForm && (
          <div className="card" style={{ marginBottom: 28, border: '1px solid var(--border)', background: 'var(--bg-card)', padding: 0 }}>
            
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>⚙️ Konfigurasi Kampanye Multiplier Baru</strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', gap: 6, background: 'var(--overlay-subtle)', padding: 3, borderRadius: 6 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setWorkflowMode('multi_blueprint_one_product');
                      setProductionMode('single'); // backward sync
                      setSelectedBlueprintIds([]);
                      setSelectedProductIds([]);
                      setCombinationRows([]);
                    }}
                    style={{
                      border: 'none', background: workflowMode === 'multi_blueprint_one_product' ? 'var(--accent)' : 'transparent',
                      color: 'var(--text-primary)', fontSize: '0.72rem', fontWeight: 600, padding: '5px 10px', borderRadius: 4, cursor: 'pointer'
                    }}
                  >
                    Multi Blueprint → 1 Produk
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWorkflowMode('one_blueprint_multi_product');
                      setProductionMode('mass'); // backward sync
                      setSelectedBlueprintIds([]);
                      setSelectedProductIds([]);
                      setCombinationRows([]);
                    }}
                    style={{
                      border: 'none', background: workflowMode === 'one_blueprint_multi_product' ? 'var(--accent)' : 'transparent',
                      color: 'var(--text-primary)', fontSize: '0.72rem', fontWeight: 600, padding: '5px 10px', borderRadius: 4, cursor: 'pointer'
                    }}
                  >
                    1 Blueprint → Multi Produk
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfigForm(false)}
                  style={{
                    border: 'none',
                    background: 'var(--surface-interactive)',
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    padding: '5px 10px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    border: '1px solid var(--border)'
                  }}
                >
                  ❌ Tutup Form
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
              
              {/* 1. Blueprint Card Picker with Search */}
              <div style={{ padding: 24, borderBottom: '1px solid var(--border)' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                    📹 Pilih Blueprint Video Target ({workflowMode === 'multi_blueprint_one_product' ? 'Bisa Pilih Banyak' : 'Pilih Satu'})
                  </label>
                  
                  <div style={{ display: 'flex', gap: 12, marginBottom: 12, marginTop: 8 }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: '0.8rem', flex: 2 }}
                      placeholder="🔍 Cari blueprint berdasarkan URL, niche, tags, resume..."
                      value={assetSearchQuery}
                      onChange={e => setAssetSearchQuery(e.target.value)}
                    />
                    <select
                      className="form-input"
                      style={{ fontSize: '0.8rem', flex: 1 }}
                      value={nicheFilter}
                      onChange={e => setNicheFilter(e.target.value)}
                    >
                      <option value="">-- Semua Niche --</option>
                      {niches.map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => fetchAssets(assetSearchQuery, nicheFilter)}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                    >
                      Cari
                    </button>
                  </div>

                  {loadingAssets ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto 8px' }}></div>
                      Memuat blueprint...
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, maxHeight: '350px', overflowY: 'auto', padding: 8, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-interactive)' }}>
                      {assets.map(a => {
                        const isSelected = workflowMode === 'multi_blueprint_one_product'
                          ? selectedBlueprintIds.includes(a.id)
                          : selectedAssetId === a.id;
                        
                        const handleToggle = () => {
                          if (workflowMode === 'multi_blueprint_one_product') {
                            setSelectedBlueprintIds(prev =>
                              prev.includes(a.id) ? prev.filter(id => id !== a.id) : [...prev, a.id]
                            );
                          } else {
                            setSelectedAssetId(a.id);
                          }
                        };

                        const shortUrl = a.source_url ? (a.source_url.length > 25 ? a.source_url.replace(/https?:\/\/(www\.)?/, '').substring(0, 22) + '...' : a.source_url.replace(/https?:\/\/(www\.)?/, '')) : 'Source URL';

                        return (
                          <div
                            key={a.id}
                            onClick={handleToggle}
                            style={{
                              background: isSelected ? 'var(--status-info-soft)' : 'var(--bg-card)',
                              border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                              borderRadius: 8,
                              padding: 14,
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              gap: 10,
                              transition: 'all 0.2s ease',
                              boxShadow: isSelected ? '0 0 10px rgba(0, 120, 255, 0.1)' : 'none'
                            }}
                          >
                            <div style={{ display: 'flex', justify: 'space-between', alignItems: 'flex-start' }}>
                              <span style={{ fontSize: '0.62rem', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                                niche: {a.niche || 'General'}
                              </span>
                              <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--border)', background: isSelected ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justify: 'center', fontSize: '0.6rem', color: '#fff', fontWeight: 'bold' }}>
                                {isSelected && '✓'}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {a.original_caption || 'Blueprint s/d ' + a.id}
                              </div>
                              {a.source_url && (
                                <a
                                  href={a.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  style={{ fontSize: '0.72rem', color: 'var(--accent-light)', textDecoration: 'underline', marginTop: 4, display: 'inline-block' }}
                                >
                                  {shortUrl} ➔
                                </a>
                              )}
                              {a.viral_pattern_summary && (
                                <div
                                  title={a.viral_pattern_summary}
                                  style={{
                                    fontSize: '0.74rem',
                                    color: 'var(--text-secondary)',
                                    background: 'rgba(9, 14, 26, 0.3)',
                                    padding: '6px 8px',
                                    borderRadius: 4,
                                    borderLeft: '3px solid var(--accent)',
                                    marginTop: 8,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    lineHeight: '1.4',
                                    cursor: 'help'
                                  }}
                                >
                                  🧠 Insights: {a.viral_pattern_summary}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: 8, marginTop: 4 }}>
                              <span>📋 {a.original_storyboard_json ? JSON.parse(a.original_storyboard_json).length : 0} adegan | ⏱️ {a.duration_seconds || '0'}s</span>
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  setSelectedBlueprintForModal(a);
                                }}
                                style={{ background: 'transparent', border: 'none', color: 'var(--accent-light)', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                              >
                                🔍 Detail Blueprint
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Product Selection */}
              <div style={{ padding: 24, borderBottom: '1px solid var(--border)' }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem', display: 'block', marginBottom: 8 }}>
                  📦 Pilih Produk Jualan ({workflowMode === 'multi_blueprint_one_product' ? 'Pilih Satu' : 'Bisa Pilih Banyak'})
                </label>

                {workflowMode === 'multi_blueprint_one_product' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.8rem' }}>
                        <input type="radio" name="bridgingModeM" value="select_existing" checked={bridgingMode === 'select_existing'} onChange={e => setBridgingMode(e.target.value)} />
                        Pilih dari Pustaka
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.8rem' }}>
                        <input type="radio" name="bridgingModeM" value="manual_input" checked={bridgingMode === 'manual_input'} onChange={e => setBridgingMode(e.target.value)} />
                        Tulis Manual
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.8rem' }}>
                        <input type="radio" name="bridgingModeM" value="url_extract" checked={bridgingMode === 'url_extract'} onChange={e => setBridgingMode(e.target.value)} />
                        Ekstrak dari URL
                      </label>
                    </div>

                    {bridgingMode === 'select_existing' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', gap: 12 }}>
                          <input
                            type="text"
                            placeholder="🔍 Cari produk..."
                            value={productSearchQuery}
                            onChange={e => setProductSearchQuery(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                fetchProducts(productSearchQuery);
                              }
                            }}
                            className="form-input"
                            style={{ fontSize: '0.8rem', flex: 2 }}
                          />
                          <button
                            type="button"
                            onClick={() => fetchProducts(productSearchQuery)}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                          >
                            Cari
                          </button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, maxHeight: 150, overflowY: 'auto', padding: 10, background: 'var(--surface-interactive)', borderRadius: 6, border: '1px solid var(--border)' }}>
                          {products.map(p => {
                            const isSelected = targetProductId === p.id;
                            const selectProduct = () => {
                              setTargetProductId(isSelected ? '' : p.id);
                            };
                            return (
                              <div key={p.id} onClick={selectProduct} style={{ padding: 8, background: isSelected ? 'var(--status-info-soft)' : 'var(--bg-card)', border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                                  <input type="radio" checked={isSelected} readOnly style={{ pointerEvents: 'none' }} />
                                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{p.product_name}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={e => {
                                    e.stopPropagation();
                                    setSelectedProductForModal(p);
                                  }}
                                  style={{ background: 'transparent', border: 'none', color: 'var(--accent-light)', fontSize: '0.72rem', cursor: 'pointer', padding: 0, flexShrink: 0 }}
                                  title="Detail Produk"
                                >
                                  🔍 Detail
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {bridgingMode === 'url_extract' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div className="form-group">
                          <label className="form-label">URL Detail Produk Tokopedia/Shopee</label>
                          <input type="url" value={productUrl} onChange={e => setProductUrl(e.target.value)} placeholder="https://shopee.co.id/product-name" className="form-input" />
                        </div>
                        <div className="form-group">
                          <label className="form-label">URL Affiliate Rekomendasi (Opsional)</label>
                          <input type="url" value={affiliateUrl} onChange={e => setAffiliateUrl(e.target.value)} placeholder="https://shope.ee/xxxxx" className="form-input" />
                        </div>
                      </div>
                    )}

                    {bridgingMode === 'manual_input' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div className="form-group">
                          <label className="form-label">Nama Produk</label>
                          <input type="text" value={manualProductName} onChange={e => setManualProductName(e.target.value)} placeholder="Nama produk jualan" className="form-input" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                          <div className="form-group">
                            <label className="form-label">Deskripsi USP Produk</label>
                            <textarea value={manualProductDesc} onChange={e => setManualProductDesc(e.target.value)} placeholder="Keunggulan produk jualan Anda" className="form-input" rows={2} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Keywords / Hashtags Produk</label>
                            <input type="text" value={manualProductUsp} onChange={e => setManualProductUsp(e.target.value)} placeholder="Contoh: cokelat, sehat, organik" className="form-input" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.8rem' }}>
                        <input type="radio" name="massProductMode" value="select_existing" checked={bridgingMode === 'select_existing'} onChange={e => setBridgingMode(e.target.value)} />
                        Pilih Banyak dari Pustaka
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.8rem' }}>
                        <input type="radio" name="massProductMode" value="url_extract" checked={bridgingMode === 'url_extract'} onChange={e => setBridgingMode(e.target.value)} />
                        Daftar URL Produk Massal
                      </label>
                    </div>

                    {bridgingMode === 'select_existing' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', gap: 12 }}>
                          <input
                            type="text"
                            placeholder="🔍 Cari produk..."
                            value={productSearchQuery}
                            onChange={e => setProductSearchQuery(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                fetchProducts(productSearchQuery);
                              }
                            }}
                            className="form-input"
                            style={{ fontSize: '0.8rem', flex: 2 }}
                          />
                          <button
                            type="button"
                            onClick={() => fetchProducts(productSearchQuery)}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                          >
                            Cari
                          </button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, maxHeight: 150, overflowY: 'auto', padding: 10, background: 'var(--surface-interactive)', borderRadius: 6, border: '1px solid var(--border)' }}>
                          {products.map(p => {
                            const isSelected = selectedProductIds.includes(p.id);
                            const toggleProduct = () => {
                              setSelectedProductIds(prev =>
                                prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                              );
                            };
                            return (
                              <div key={p.id} onClick={toggleProduct} style={{ padding: 8, background: isSelected ? 'var(--status-info-soft)' : 'var(--bg-card)', border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                                  <input type="checkbox" checked={isSelected} readOnly style={{ pointerEvents: 'none' }} />
                                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{p.product_name}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={e => {
                                    e.stopPropagation();
                                    setSelectedProductForModal(p);
                                  }}
                                  style={{ background: 'transparent', border: 'none', color: 'var(--accent-light)', fontSize: '0.72rem', cursor: 'pointer', padding: 0, flexShrink: 0 }}
                                  title="Detail Produk"
                                >
                                  🔍 Detail
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {bridgingMode === 'url_extract' && (
                      <div className="form-group">
                        <label className="form-label">Daftar URL Produk Massal (Satu URL per Baris, Format: `url_produk|url_affiliate_opsional`)</label>
                        <textarea
                          className="form-input"
                          rows={4}
                          value={massUrlsText}
                          onChange={e => setMassUrlsText(e.target.value)}
                          placeholder="https://tokopedia.com/product-a|https://tokopedia.link/aff-a&#10;https://shopee.co.id/product-b"
                          style={{ fontFamily: 'monospace' }}
                        />
                      </div>
                    )}
                  </div>
                )}
                
                <div style={{ marginTop: 16 }}>
                  <button type="button" onClick={generateCombinationRows} className="btn btn-secondary" style={{ width: '100%', padding: '10px 14px', fontWeight: 700 }}>
                    ⚡ Buat Tabel Tinjauan Kombinasi (Review Table)
                  </button>
                </div>
              </div>

              {/* 3. Combination Review Table */}
              {combinationRows.length > 0 && (
                <div style={{ padding: 24, borderBottom: '1px solid var(--border)' }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem', display: 'block', marginBottom: 8 }}>
                    📋 Tinjauan Kombinasi Kampanye Yang Akan Dibuat ({combinationRows.length} Baris)
                  </label>
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
                    <table className="ideas-table" style={{ width: '100%', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--overlay-subtle)', borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: 8 }}>Blueprint</th>
                          <th style={{ padding: 8 }}>Produk</th>
                          <th style={{ padding: 8 }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {combinationRows.map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: 8 }}>{row.deconstruct_asset_title}</td>
                            <td style={{ padding: 8 }}>{row.target_product_name}</td>
                            <td style={{ padding: 8 }}>
                              <button
                                type="button"
                                onClick={() => setCombinationRows(prev => prev.filter((_, i) => i !== idx))}
                                style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 'bold' }}
                              >
                                Hapus
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 4. Accordion Configs (OPC Aligned) */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>

                {/* PRESET SELECTOR */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'rgba(59, 130, 246, 0.02)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent)' }}>📋 Gunakan Preset:</span>
                    <select
                      value={selectedPresetKey}
                      onChange={(e) => {
                        const key = e.target.value;
                        setSelectedPresetKey(key);
                        const preset = presets.find(p => p.key === key);
                        if (preset) applyPresetToForm(preset);
                      }}
                      className="form-input"
                      style={{ maxWidth: 300, background: 'var(--surface-interactive)', color: 'var(--text-color)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', outline: 'none' }}
                    >
                      <option value="">-- Buat dari Awal (Tanpa Preset) --</option>
                      {presets.map(p => (
                        <option key={p.key} value={p.key}>{p.label}{p.is_system ? ' (System)' : ''}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewPresetLabel('');
                      setNewPresetKey('');
                      setShowPresetSaveModal(true);
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '6px 12px', fontSize: '13px', background: 'var(--surface-interactive)', color: 'var(--text-color)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    💾 Simpan Form sebagai Preset
                  </button>
                </div>

                {/* Accordion 1: Basic Creative Strategy */}
                <div style={{ borderBottom: '1px solid var(--border)' }}>
                  <div
                    onClick={() => setActiveAccordion(activeAccordion === 0 ? -1 : 0)}
                    style={{ padding: '16px 24px', background: activeAccordion === 0 ? 'var(--status-info-soft)' : 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>📋 1. Basic Creative Strategy</span>
                    <span>{activeAccordion === 0 ? '▲' : '▼'}</span>
                  </div>
                  {activeAccordion === 0 && (
                    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div className="form-group">
                        <label className="form-label">🏷️ Nama Akun (Brand Account)</label>
                        <select
                          className="form-input"
                          value={selectedBrandId}
                          onChange={e => {
                            const matchingProfile = brandProfiles.find(bp => bp.id === e.target.value);
                            const newAcc = matchingProfile?.brand_name || '';
                            setSelectedBrandId(matchingProfile?.id || '');
                            setAccountName(newAcc);
                            const now = new Date();
                            const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
                            setCampaignName(`[ MULTIPLIER ${dateStr} ] - ${newAcc ? newAcc + ' - ' : ''}`);
                          }}
                        >
                          <option value="">-- Pilih Nama Akun Brand --</option>
                          {brandProfiles.map(bp => (
                            <option key={bp.id} value={bp.id}>{bp.brand_name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Nama Kampanye</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Nama kampanye"
                          value={campaignName}
                          onChange={e => setCampaignName(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Parent Folder Nextcloud</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="/MAKNA_Assets"
                          value={nextcloudParentFolder}
                          onChange={e => setNextcloudParentFolder(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Bahasa Naskah Voiceover (Script Language)</label>
                        <select className="form-input" value={targetLanguage} onChange={e => setTargetLanguage(e.target.value)}>
                          <option value="id-ID">🇮🇩 Bahasa Indonesia (Lokal)</option>
                          <option value="en-US">🇺🇸 English (Global / US Market)</option>
                        </select>
                      </div>

                      <div className="form-group">
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

                      <div className="form-group">
                        <label className="form-label">🎙 Audio Segment (per Klip)</label>
                        <select className="form-input" value={enableAudioSegment ? 'enabled' : 'disabled'} onChange={e => setEnableAudioSegment(e.target.value === 'enabled')}>
                          <option value="disabled">❌ Disabled (Default)</option>
                          <option value="enabled">✅ Enabled — Embed Audio Segment per Beat</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">SFX Setting</label>
                        <select className="form-input" value={sfxSetting} onChange={e => setSfxSetting(e.target.value)}>
                          <option value="without_sfx">🔇 Without SFX (Default)</option>
                          <option value="with_sfx">🔊 With SFX</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Audit Kepatuhan Voiceover (TikTok Safe)</label>
                        <select className="form-input" value={enableVoAudit} onChange={e => setEnableVoAudit(Number(e.target.value))}>
                          <option value={0}>❌ No (Tanpa Audit Kepatuhan)</option>
                          <option value={1}>✅ Yes (Audit Kepatuhan & Tampilkan Dua Versi VO)</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">AI Directive / Guardrail (Staging Override)</label>
                        <textarea
                          className="form-input"
                          style={{ minHeight: 60 }}
                          placeholder="Instruksi kontrol AI internal..."
                          value={aiDirective}
                          onChange={e => setAiDirective(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Mandatory Outro Line (Staging Override)</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Kalimat wajib di akhir klip voiceover..."
                          value={mandatoryOutroLine}
                          onChange={e => setMandatoryOutroLine(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Custom Instruction (Opsional)</label>
                        <textarea
                          className="form-input"
                          style={{ minHeight: 80 }}
                          placeholder="Instruksi tambahan untuk Gemini AI..."
                          value={customInstruction}
                          onChange={e => setCustomInstruction(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Accordion 2: Aesthetics & Visual Settings */}
                <div style={{ borderBottom: '1px solid var(--border)' }}>
                  <div
                    onClick={() => setActiveAccordion(activeAccordion === 1 ? -1 : 1)}
                    style={{ padding: '16px 24px', background: activeAccordion === 1 ? 'var(--status-info-soft)' : 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>🎨 2. Aesthetics & Visual Settings</span>
                    <span>{activeAccordion === 1 ? '▲' : '▼'}</span>
                  </div>
                  {activeAccordion === 1 && (
                    <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div className="form-group">
                        <label className="form-label">Narrative Mode</label>
                        <select className="form-input" value={narrativeMode} onChange={e => setNarrativeMode(e.target.value)}>
                          <option value="Storytelling">Storytelling (Bercerita / Daily-life)</option>
                          <option value="Problem-Solution">Problem-Solution (Masalah & Solusi)</option>
                          <option value="Educational">Educational (Tutorial / Penjelasan Ilmiah)</option>
                          <option value="Pet-Story-Arc">🐾 Pet Story Arc (7-Beat Cartoon Universe)</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Aspect Ratio</label>
                        <select className="form-input" value={aspectRatio} onChange={e => setAspectRatio(e.target.value)}>
                          <option value="9:16">9:16 (Vertical TikTok/Reels)</option>
                          <option value="16:9">16:9 (Horizontal YouTube)</option>
                          <option value="1:1">1:1 (Square)</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Target AI</label>
                        <select className="form-input" value={targetAi} onChange={e => setTargetAi(e.target.value)}>
                          <option value="Google Veo (8s)">Google Veo (8s)</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Video Model</label>
                        <select className="form-input" value={videoModel} onChange={e => setVideoModel(e.target.value)}>
                          <option value="veo_31_lite">Veo 3.1 Lite</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Face Visibility</label>
                        <select className="form-input" value={faceVisibility} onChange={e => setFaceVisibility(e.target.value)}>
                          <option value="Faceless">Faceless (Tanpa Wajah - Fokus Aksi Tangan)</option>
                          <option value="POV">POV (Sudut Pandang Kamera Utama)</option>
                          <option value="Silhouette">Silhouette (Estetik Siluet)</option>
                          <option value="cartoon_face">Cartoon Face (Kartun Ekspresif)</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Jumlah Klip Video (N)</label>
                        <input
                          type="number"
                          className="form-input"
                          min="3"
                          max="10"
                          value={targetClipsCount}
                          onChange={e => setTargetClipsCount(Number(e.target.value))}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Jumlah Kata Per Klip</label>
                        <select className="form-input" value={wordsPerClip} onChange={e => setWordsPerClip(e.target.value)}>
                          <option value="15-16 kata">15-16 kata</option>
                          <option value="17-19 kata">17-19 kata</option>
                          <option value="20-24 kata">20-24 kata</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Visual Style</label>
                        <select className="form-input" value={visualStyle} onChange={e => setVisualStyle(e.target.value)}>
                          <option value="Cinematic">Cinematic</option>
                          <option value="UGC">UGC</option>
                          <option value="Macrophotography">Macrophotography</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">Visual Mode</label>
                        <select className="form-input" value={visualMode} onChange={e => setVisualMode(e.target.value)}>
                          <option value="hybrid_lock">Double-Pass Pixel Lock (Nano Banana Pro T2I ➜ Veo 3.1 I2V)</option>
                          <option value="pure_t2v">Pure Text-To-Video (T2V Langsung)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Accordion 3: Product Bridging Settings */}
                <div style={{ borderBottom: '1px solid var(--border)' }}>
                  <div
                    onClick={() => setActiveAccordion(activeAccordion === 2 ? -1 : 2)}
                    style={{ padding: '16px 24px', background: activeAccordion === 2 ? 'var(--status-info-soft)' : 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>🔌 3. Product Bridging Settings</span>
                    <span>{activeAccordion === 2 ? '▲' : '▼'}</span>
                  </div>
                  {activeAccordion === 2 && (
                    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <input
                          type="checkbox"
                          checked={isBridgingActive}
                          onChange={e => setIsBridgingActive(e.target.checked)}
                          style={{ width: 18, height: 18, cursor: 'pointer' }}
                        />
                        <strong>🔌 Aktifkan Bridging Promosi Produk (Sandwich Protocol)</strong>
                      </div>

                      {isBridgingActive && (
                        <>
                          <div className="form-group">
                            <label className="form-label">Sisipkan Transisi Promosi pada Klip Ke- (X)</label>
                            <input
                              type="number"
                              className="form-input"
                              min="2"
                              max={targetClipsCount}
                              value={bridgeAtClip}
                              onChange={e => setBridgeAtClip(Number(e.target.value))}
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label">Durasi Bridging Produk (Klip)</label>
                            <select className="form-input" value={bridgeDurationClips} onChange={e => setBridgeDurationClips(Number(e.target.value))}>
                              <option value="0">0 (Sisa seluruh klip)</option>
                              <option value="1">1 Klip</option>
                              <option value="2">2 Klip</option>
                              <option value="3">3 Klip</option>
                              <option value="4">4 Klip</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Gaya Promosi</label>
                            <select className="form-input" value={promotionStyle} onChange={e => setPromotionStyle(e.target.value)}>
                              <option value="Softselling">Softselling (Halus, Menyatu dengan Konten)</option>
                              <option value="Hardsell">Hardsell (Jelas, Langsung Promosi USP)</option>
                              <option value="Education">Education (Review Kinerja Produk Secara Logis)</option>
                            </select>
                          </div>

                          {visualMode === 'hybrid_lock' && (() => {
                            const dbProduct = targetProductId ? products.find(p => p.id === targetProductId) : null;
                            const dbPhotoUrl = dbProduct ? (dbProduct.cleaned_photo_url || dbProduct.clean_photo_url || dbProduct.raw_photo_url) : null;

                            return (
                              <div style={{ background: 'var(--overlay-subtle)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                                <h4 style={{ margin: '0 0 10px', fontSize: '0.85rem', fontWeight: 700 }}>📸 Foto Acuan Produk (Optional)</h4>
                                {dbPhotoUrl ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'rgba(9, 14, 26, 0.4)', padding: 10, borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                                    <img src={dbPhotoUrl} alt="Db Ref" style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)' }} />
                                    <div>
                                      <div style={{ fontSize: '0.78rem', color: 'var(--success)', fontWeight: 600 }}>🔒 Terkunci (Menggunakan Foto Pustaka)</div>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Produk: {dbProduct.product_name}</div>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} id="product-ref-upload-acc" />
                                    <button type="button" className="btn btn-secondary" onClick={() => document.getElementById('product-ref-upload-acc').click()} style={{ fontSize: '0.8rem' }}>
                                      📤 Pilih Foto Produk
                                    </button>
                                    {productFilenameDeclare && (
                                      <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>
                                        ✓ Terunggah: {productFilenameDeclare}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Accordion 4: Visual Swap Overrides (VSO) */}
                <div style={{ borderBottom: '1px solid var(--border)' }}>
                  <div
                    onClick={() => setActiveAccordion(activeAccordion === 3 ? -1 : 3)}
                    style={{ padding: '16px 24px', background: activeAccordion === 3 ? 'var(--status-info-soft)' : 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>🎭 4. Visual Swap Overrides (VSO)</span>
                    <span>{activeAccordion === 3 ? '▲' : '▼'}</span>
                  </div>
                  {activeAccordion === 3 && (
                    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <input
                          type="checkbox"
                          checked={isVsoActive}
                          onChange={e => setIsVsoActive(e.target.checked)}
                          style={{ width: 18, height: 18, cursor: 'pointer' }}
                        />
                        <strong>🎭 Aktifkan Visual Swap Overrides</strong>
                      </div>

                      {isVsoActive && (
                        <VisualIdentitySelector
                          value={visualIdentity}
                          onChange={setVisualIdentity}
                          allowLegacyCustom={true}
                          campaignKind="multiplier_campaign"
                        />
                      )}
                    </div>
                  )}
                </div>

              </div>

              {/* Action Form Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid var(--border)', padding: 24 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowConfigForm(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? '⏳ Mendaftarkan...' : '🚀 Daftarkan Kampanye'}
                </button>
              </div>

            </form>
          </div>
        )}

        {/* Global Scheduler Controller */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          padding: 16, marginBottom: 20,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12
        }}>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>⚙️ Status Skeduler Multiplier Lab</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>Mengontrol jalannya rendering video kampanye remake secara terpusat.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', padding: '4px 10px', borderRadius: 12,
              background: isSchedulerActive ? 'var(--status-success-soft)' : 'var(--status-danger-soft)',
              color: isSchedulerActive ? 'var(--success)' : 'var(--danger)',
              border: `1px solid ${isSchedulerActive ? 'var(--status-success-soft)' : 'var(--status-danger-soft)'}`
            }}>
              {isSchedulerActive ? '🟢 SKEDULER AKTIF' : '🔴 SKEDULER MATI'}
            </span>
            <button
              type="button"
              onClick={toggleGlobalScheduler}
              className={`btn ${isSchedulerActive ? 'btn-danger' : 'btn-success'}`}
              style={{
                fontSize: '0.8rem', padding: '6px 16px', fontWeight: 600,
                boxShadow: isSchedulerActive ? '0 0 15px var(--status-danger-soft)' : '0 0 15px var(--status-success-soft)',
                border: isSchedulerActive ? '1px solid var(--status-danger-soft)' : '1px solid var(--status-success-soft)'
              }}
            >
              {isSchedulerActive ? '🛑 STOP SKEDULER' : '▶️ START SKEDULER'}
            </button>
          </div>
        </div>

        {/* System Logs */}
        <div className="card" style={{ padding: '0', background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: '24px' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--status-success)', display: 'inline-block', boxShadow: '0 0 8px var(--status-success)' }}></span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>SYSTEM POLLER LOGGER (MULTIPLIER)</span>
            </div>
            <button onClick={pollLogs} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>[Refresh Log]</button>
          </div>
          <pre ref={terminalRef} style={{ margin: 0, padding: '20px', background: 'var(--surface)', color: '#20c20e', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', maxHeight: '180px', overflowY: 'auto', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
            {terminalLogs}
          </pre>
        </div>

        {/* Brand filter and campaigns header */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 20px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>🎬 Daftar Kampanye Multiplier ({filteredCampaigns.length})</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>🔍 FILTER BRAND:</span>
            <select
              value={filterBrandId}
              onChange={e => setFilterBrandId(e.target.value)}
              style={{
                background: 'var(--surface-interactive)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600
              }}
            >
              <option value="all">Semua Brand</option>
              {brandProfiles.map(bp => (
                <option key={bp.id} value={bp.id}>{bp.brand_name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Campaigns rendering cards */}
        {loadingTasks ? (
          <div style={{ color: 'var(--text-muted)', padding: 32, textAlign: 'center' }}>Memuat kampanye...</div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎬</div>
            <p style={{ color: 'var(--text-muted)' }}>Tidak ada kampanye yang cocok dengan filter brand ini.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filteredCampaigns.map(c => {
              const pct = Math.round((c.stats.completed / c.stats.total) * 100) || 0;
              let statusColor = 'var(--text-muted)';
              let statusBg = 'var(--surface-interactive)';
              let statusBorder = 'var(--border-subtle)';
              if (c.status === 'completed') { statusColor = 'var(--success)'; statusBg = 'var(--status-success-soft)'; statusBorder = 'var(--status-success-soft)'; }
              else if (c.status === 'running') { statusColor = 'var(--status-info)'; statusBg = 'var(--status-info-soft)'; statusBorder = 'var(--status-info-soft)'; }
              else if (c.status === 'paused') { statusColor = 'var(--status-warning)'; statusBg = 'rgba(253,203,110,0.15)'; statusBorder = 'rgba(253,203,110,0.3)'; }
              else if (c.status === 'failed') { statusColor = 'var(--danger)'; statusBg = 'var(--status-danger-soft)'; statusBorder = 'var(--status-danger-soft)'; }

              return (
                <div key={c.id} className="card" style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-sm)' }}>
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          background: c.brand_name ? 'rgba(168, 85, 247, 0.15)' : 'var(--surface-interactive)',
                          border: c.brand_name ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid var(--border-subtle)',
                          color: c.brand_name ? '#d8b4fe' : 'var(--text-muted)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          🏷️ Brand: {c.brand_name || 'Tidak Ditentukan'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1.1rem' }}>🎬</span>
                        <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{c.campaign_name}</strong>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 8, background: statusBg, color: statusColor, border: `1px solid ${statusBorder}` }}>
                          {c.status}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(c.created_at).toLocaleString('id-ID')}
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                    <div><strong>Total Item:</strong> <span style={{ color: 'var(--text-primary)' }}>{c.stats.total}</span></div>
                    <div><strong>Selesai Render:</strong> <span style={{ color: 'var(--success)' }}>{c.stats.completed}</span></div>
                    <div><strong>Gagal:</strong> <span style={{ color: 'var(--danger)' }}>{c.stats.failed}</span></div>
                    <div><strong>Dalam Antrean:</strong> <span style={{ color: 'var(--status-info)' }}>{c.stats.processing}</span></div>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: 4, height: 5, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>{pct}% complete</div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--surface-interactive)', paddingTop: 12, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => router.push(`/multiplier-lab/${c.id}`)} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                        🔍 Detail Kampanye
                      </button>

                      {c.status !== 'completed' && (
                        <button
                          type="button"
                          className={`btn btn-sm ${c.status === 'running' ? 'btn-danger' : (c.status === 'failed' ? 'btn-warning' : 'btn-success')}`}
                          onClick={() => toggleStatus(c)}
                          style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                        >
                          {c.status === 'running' ? '⏸ Pause' : (c.status === 'failed' ? '🔄 Retry Failed' : '▶ Resume')}
                        </button>
                      )}

                      <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteCampaign(c.id)} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                        🗑 Hapus
                      </button>
                    </div>

                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', background: 'var(--surface-interactive)', padding: '2px 8px', borderRadius: '4px' }}>
                      🔑 ID Batch: {c.id}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedBlueprintForModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(0, 0, 0, 0.85)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(8px)'
            }}
            onClick={() => setSelectedBlueprintForModal(null)}
          >
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                width: '90%',
                maxWidth: '850px',
                maxHeight: '85vh',
                borderRadius: 12,
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)'
              }}
              onClick={e => e.stopPropagation()}
            >
              <div
                style={{
                  padding: '20px 24px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(17, 27, 45, 0.8)'
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      background: 'rgba(45, 212, 191, 0.12)',
                      color: 'var(--accent)',
                      padding: '2px 6px',
                      borderRadius: 4,
                      marginBottom: 4,
                      display: 'inline-block'
                    }}
                  >
                    Niche: {selectedBlueprintForModal.niche || 'General'}
                  </span>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                    📄 Detail Blueprint: {selectedBlueprintForModal.original_caption?.slice(0, 60) || ('Blueprint #' + selectedBlueprintForModal.id)}
                  </h3>
                </div>
                <button
                  type="button"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '1.5rem',
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedBlueprintForModal(null)}
                >
                  &times;
                </button>
              </div>

              <div style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* 1. AI Insights block */}
                {selectedBlueprintForModal.viral_pattern_summary && (
                  <div
                    style={{
                      background: 'linear-gradient(135deg, rgba(45,212,191,0.06) 0%, rgba(45,212,191,0.01) 100%)',
                      border: '1px solid rgba(45,212,191,0.2)',
                      borderLeft: '4px solid var(--accent)',
                      padding: '16px 20px',
                      borderRadius: 8
                    }}
                  >
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.88rem', color: 'var(--accent-light)' }}>
                      🧠 AI Viral Pattern & Insights
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {selectedBlueprintForModal.viral_pattern_summary}
                    </p>
                  </div>
                )}

                {/* 2. Detailed Storyboard Table */}
                {(() => {
                  let storyboard = [];
                  try {
                    storyboard = JSON.parse(selectedBlueprintForModal.original_storyboard_json || '[]');
                  } catch (_) {}

                  if (storyboard.length === 0) return null;

                  return (
                    <div>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        📋 Detailed Storyboard ({storyboard.length} Scenes)
                      </h4>
                      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                        <table className="ideas-table" style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: 'var(--overlay-subtle)' }}>
                              <th style={{ padding: 10, textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Scene</th>
                              <th style={{ padding: 10, textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Visual Description</th>
                              <th style={{ padding: 10, textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Emotional Hook</th>
                              <th style={{ padding: 10, textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Camera Technique</th>
                            </tr>
                          </thead>
                          <tbody>
                            {storyboard.map((scene, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <td style={{ padding: 10, fontWeight: 700, borderBottom: '1px solid var(--border-subtle)' }}>{scene.scene || idx + 1}</td>
                                <td style={{ padding: 10, borderBottom: '1px solid var(--border-subtle)' }}>{scene.visual_description}</td>
                                <td style={{ padding: 10, borderBottom: '1px solid var(--border-subtle)' }}>
                                  {scene.emotional_hook ? scene.emotional_hook.split(',').map((hook, hi) => (
                                    <span
                                      key={hi}
                                      style={{
                                        fontSize: '0.65rem',
                                        padding: '2px 6px',
                                        borderRadius: 4,
                                        background: 'rgba(253, 203, 110, 0.1)',
                                        color: 'var(--warning)',
                                        border: '1px solid rgba(253, 203, 110, 0.15)',
                                        marginRight: 4,
                                        display: 'inline-block',
                                        marginTop: 2
                                      }}
                                    >
                                      {hook.trim()}
                                    </span>
                                  )) : '—'}
                                </td>
                                <td style={{ padding: 10, borderBottom: '1px solid var(--border-subtle)' }}>{scene.camera_technique || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* 3. Voice Narration Audio Transcript */}
                {(() => {
                  let storyboard = [];
                  try {
                    storyboard = JSON.parse(selectedBlueprintForModal.original_storyboard_json || '[]');
                  } catch (_) {}

                  const narrationScenes = storyboard.filter(s => s.narration_transcript || s.voiceover || s.narration);
                  if (narrationScenes.length === 0) return null;

                  return (
                    <div style={{ padding: '16px 20px', background: 'var(--surface-interactive)', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12 }}>
                        🎙️ Voice Narration Audio Transcript
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {narrationScenes.map((s, si) => (
                          <div key={si} style={{ fontSize: '0.82rem', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <span
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.7rem',
                                color: 'var(--accent-light)',
                                background: 'var(--overlay-subtle)',
                                padding: '2px 6px',
                                borderRadius: 3,
                                flexShrink: 0
                              }}
                            >
                              Scene {s.scene || si + 1}
                            </span>
                            <span style={{ color: 'var(--text-primary)', fontStyle: 'italic' }}>
                              "{s.narration_transcript || s.voiceover || s.narration}"
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* 4. E-commerce Concepts */}
                {(() => {
                  let lowTicket = [];
                  let highTicket = [];
                  try {
                    const parsedIdeas = JSON.parse(selectedBlueprintForModal.product_ideas_json || '{}');
                    lowTicket = parsedIdeas.low_ticket || [];
                    highTicket = parsedIdeas.high_ticket || [];
                  } catch (_) {}

                  if (lowTicket.length === 0 && highTicket.length === 0) return null;

                  return (
                    <div>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        💡 E-commerce Product Concept Recommendations
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                        {lowTicket.length > 0 && (
                          <div style={{ background: 'rgba(74,222,128,0.02)', border: '1px solid var(--status-success-soft)', padding: 16, borderRadius: 8 }}>
                            <strong style={{ color: 'var(--success)', fontSize: '0.8rem', display: 'block', marginBottom: 10 }}>
                              💚 Low Ticket Concepts
                            </strong>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {lowTicket.map((prod, idx) => (
                                <div key={idx} style={{ fontSize: '0.78rem', borderBottom: idx < lowTicket.length - 1 ? '1px solid var(--border-subtle)' : 'none', paddingBottom: idx < lowTicket.length - 1 ? 8 : 0 }}>
                                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{prod.product_name}</div>
                                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: '2px 0 4px' }}>
                                    Category: {prod.category} | Search Query: <code style={{ color: 'var(--accent)' }}>{prod.marketplace_search_query}</code>
                                  </div>
                                  <div style={{ color: 'var(--text-secondary)' }}>{prod.reason}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {highTicket.length > 0 && (
                          <div style={{ background: 'rgba(245,158,11,0.02)', border: '1px solid var(--status-warning-soft)', padding: 16, borderRadius: 8 }}>
                            <strong style={{ color: 'var(--warning)', fontSize: '0.8rem', display: 'block', marginBottom: 10 }}>
                              🔥 High Ticket Concepts
                            </strong>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {highTicket.map((prod, idx) => (
                                <div key={idx} style={{ fontSize: '0.78rem', borderBottom: idx < highTicket.length - 1 ? '1px solid var(--border-subtle)' : 'none', paddingBottom: idx < highTicket.length - 1 ? 8 : 0 }}>
                                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{prod.product_name}</div>
                                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: '2px 0 4px' }}>
                                    Category: {prod.category} | Search Query: <code style={{ color: 'var(--accent)' }}>{prod.marketplace_search_query}</code>
                                  </div>
                                  <div style={{ color: 'var(--text-secondary)' }}>{prod.reason}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
        {selectedProductForModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(0, 0, 0, 0.85)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(8px)'
            }}
            onClick={() => setSelectedProductForModal(null)}
          >
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                width: '90%',
                maxWidth: '760px',
                maxHeight: '85vh',
                borderRadius: 12,
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)'
              }}
              onClick={e => e.stopPropagation()}
            >
              <div
                style={{
                  padding: '20px 24px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(17, 27, 45, 0.8)'
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      background: 'rgba(108, 92, 231, 0.15)',
                      color: '#a855f7',
                      padding: '2px 6px',
                      borderRadius: 4,
                      marginBottom: 4,
                      display: 'inline-block'
                    }}
                  >
                    Kategori: {selectedProductForModal.category || 'General'}
                  </span>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                    🍫 Detail Produk: {selectedProductForModal.product_name}
                  </h3>
                </div>
                <button
                  type="button"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '1.5rem',
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedProductForModal(null)}
                >
                  &times;
                </button>
              </div>

              <div style={{ padding: 24, overflowY: 'auto' }}>
                {(() => {
                  const displayPhotoUrl = selectedProductForModal.cleaned_photo_url || selectedProductForModal.clean_photo_url || selectedProductForModal.raw_photo_url;
                  
                  let uspPoints = [];
                  if (selectedProductForModal.usp_points_json) {
                    try {
                      uspPoints = JSON.parse(selectedProductForModal.usp_points_json);
                    } catch (_) {}
                  } else if (selectedProductForModal.raw_usp) {
                    try {
                      uspPoints = JSON.parse(selectedProductForModal.raw_usp);
                    } catch (_) {
                      uspPoints = [selectedProductForModal.raw_usp];
                    }
                  }

                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
                      
                      {/* Left: Image preview & chemical metadata */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ width: '100%', height: 240, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--overlay-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {displayPhotoUrl ? (
                            <img src={displayPhotoUrl} alt="Product Ref" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Belum ada foto produk</div>
                          )}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', background: 'var(--overlay-subtle)', padding: 8, borderRadius: 4 }}>
                          Wadah: <strong>{selectedProductForModal.packaging_type || 'Tanpa Wadah'}</strong> | Terbuka: <strong>{selectedProductForModal.is_in_packaging ? 'Di dalam Wadah' : 'Terbuka'}</strong>
                        </div>
                      </div>

                      {/* Right: Description & features */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                          <strong style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Deskripsi Produk</strong>
                          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            {selectedProductForModal.product_description || selectedProductForModal.raw_description || 'Tidak ada deskripsi produk.'}
                          </p>
                        </div>

                        {selectedProductForModal.product_truth && (
                          <div style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid var(--status-warning-soft)', padding: '12px 16px', borderRadius: 6, borderLeft: '4px solid var(--status-warning)' }}>
                            <strong style={{ fontSize: '0.78rem', color: 'var(--status-warning)', display: 'block', marginBottom: 4 }}>🛡️ Fakta Produk (Product Truth)</strong>
                            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                              {selectedProductForModal.product_truth}
                            </p>
                          </div>
                        )}

                        {uspPoints.length > 0 && (
                          <div>
                            <strong style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Keunggulan Utama (USP Points)</strong>
                            <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {uspPoints.map((pt, idx) => (
                                <li key={idx}>{pt}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {selectedProductForModal.source_url && (
                            <div style={{ display: 'flex', alignItems: 'center', justify: 'space-between', background: 'var(--overlay-subtle)', padding: '8px 12px', borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>🛒 Toko Sumber</span>
                              <a href={selectedProductForModal.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--accent-light)' }}>Buka Store ➔</a>
                            </div>
                          )}
                          {selectedProductForModal.affiliate_link && (
                            <div style={{ display: 'flex', alignItems: 'center', justify: 'space-between', background: 'var(--overlay-subtle)', padding: '8px 12px', borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>🔗 Affiliate Link</span>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <code style={{ fontSize: '0.7rem', color: 'var(--status-warning)' }}>{selectedProductForModal.affiliate_link}</code>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(selectedProductForModal.affiliate_link);
                                    alert('Affiliate link berhasil disalin!');
                                  }}
                                  style={{ background: 'var(--surface-interactive)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)', fontSize: '0.65rem', cursor: 'pointer', padding: '2px 6px', borderRadius: 3 }}
                                >
                                  Salin
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
        {showPresetSaveModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(0,0,0,0.8)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(4px)'
            }}
          >
            <form
              onSubmit={handleSaveAsPreset}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                width: '100%',
                maxWidth: '400px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                borderRadius: 12,
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>💾 Simpan sebagai Preset</h3>
                <button
                  type="button"
                  onClick={() => setShowPresetSaveModal(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
                >
                  &times;
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">Nama / Label Preset</label>
                <input
                  type="text"
                  placeholder="Contoh: Hijab Softsell Veo"
                  value={newPresetLabel}
                  onChange={e => {
                    setNewPresetLabel(e.target.value);
                    const k = e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '_')
                      .replace(/(^_+|_+$)/g, '');
                    setNewPresetKey(k);
                  }}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Key Preset (Unique ID)</label>
                <input
                  type="text"
                  placeholder="contoh_hijab_softsell"
                  value={newPresetKey}
                  onChange={e => setNewPresetKey(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowPresetSaveModal(false)}
                  className="btn btn-secondary"
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  Simpan Preset
                </button>
              </div>
            </form>
          </div>
        )}

        </div>
      </main>
    </div>
  );
}

export default function MultiplierLabPage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Memuat Halaman...</div>}>
      <MultiplierLabPageContent />
    </Suspense>
  );
}
