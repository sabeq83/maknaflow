'use client';

import Sidebar from '../components/Sidebar';
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

  // Asset list and selection
  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');

  // New workflows inputs & states
  const [workflowMode, setWorkflowMode] = useState('multi_blueprint_one_product'); // 'multi_blueprint_one_product' | 'one_blueprint_multi_product'
  const [selectedBlueprintIds, setSelectedBlueprintIds] = useState([]);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [combinationRows, setCombinationRows] = useState([]);
  const [previewAsset, setPreviewAsset] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [nicheFilter, setNicheFilter] = useState('');
  const [niches, setNiches] = useState([]);

  // Queue tasks and monitoring
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [expandedTaskId, setExpandedTaskId] = useState(null);

  // Forms configuration states
  const [productionMode, setProductionMode] = useState('single'); // 'single' or 'mass'
  const [activeAccordion, setActiveAccordion] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const pollingRef = useRef(null);
  const terminalRef = useRef(null);

  // Forms and Scheduler States
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [isSchedulerActive, setIsSchedulerActive] = useState(true);
  const [presets, setPresets] = useState([]);
  const [selectedPresetKey, setSelectedPresetKey] = useState('');
  const [terminalLogs, setTerminalLogs] = useState('');
  const [activeTabs, setActiveTabs] = useState({}); // { [taskId]: 'concept' | 'storyboard' | 'prompts' | 'social' | 'logs' }

  // Single mode product states
  const [productUrl, setProductUrl] = useState('');
  const [affiliateUrl, setAffiliateUrl] = useState('');

  // Mass mode product states
  const [massUrlsText, setMassUrlsText] = useState('');

  // Brand and products from library
  const [accountName, setAccountName] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [brandProfiles, setBrandProfiles] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [products, setProducts] = useState([]);
  const [targetProductId, setTargetProductId] = useState('');

  // 1. Aesthetics & Visual Settings + VSO
  const [narrativeMode, setNarrativeMode] = useState('Storytelling');
  const [visualStyle, setVisualStyle] = useState('Cinematic');
  const [targetAi, setTargetAi] = useState('Google Veo (8s)');
  const [videoModel, setVideoModel] = useState('veo_31_lite');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [faceVisibility, setFaceVisibility] = useState('Faceless');
  const [wordsPerClip, setWordsPerClip] = useState('17-19 kata');

  // Visual Swap Overrides (VSO)
  const [isVsoActive, setIsVsoActive] = useState(false);
  const [characterConcept, setCharacterConcept] = useState('faceless');
  const [subjectDemographic, setSubjectDemographic] = useState('syari_classic');
  const [wardrobeStyle, setWardrobeStyle] = useState('random');
  const [wardrobeStyleCustom, setWardrobeStyleCustom] = useState('');
  const [lightingStyle, setLightingStyle] = useState('random');
  const [lightingStyleCustom, setLightingStyleCustom] = useState('');

  // 2. Product Bridging Settings
  const [isBridgingActive, setIsBridgingActive] = useState(true);
  const [targetClipsCount, setTargetClipsCount] = useState(4);
  const [bridgeAtClip, setBridgeAtClip] = useState(2);
  const [bridgeDurationClips, setBridgeDurationClips] = useState(1);
  const [promotionStyle, setPromotionStyle] = useState('Softselling');
  const [bridgingMode, setBridgingMode] = useState('url_extract'); // default to URL extract for easiest onboarding
  const [manualProductName, setManualProductName] = useState('');
  const [manualProductDesc, setManualProductDesc] = useState('');
  const [manualProductUsp, setManualProductUsp] = useState('');
  const [productRefImage, setProductRefImage] = useState(null);
  const [productFilenameDeclare, setProductFilenameDeclare] = useState('');
  const [visualMode, setVisualMode] = useState('hybrid_lock');

  // 3. Workflow & Audio Settings
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
  const [ffmpegVideoScale, setFfmpegVideoScale] = useState(1.0);
  const [ffmpegSfxVolume, setFfmpegSfxVolume] = useState(0.0);
  const [ffmpegBgmVolume, setFfmpegBgmVolume] = useState(0.0);
  const [enableSocialPost, setEnableSocialPost] = useState(false);
  const [enableVoAudit, setEnableVoAudit] = useState(1); // Default 1 (Yes)

  // Staging / Guardrail overrides (RE equivalence)
  const [nextcloudParentFolder, setNextcloudParentFolder] = useState('/MAKNA_Assets');
  const [targetDemographic, setTargetDemographic] = useState('genz_casual');
  const [targetDemographicCustom, setTargetDemographicCustom] = useState('');
  const [aiDirective, setAiDirective] = useState('');
  const [mandatoryOutroLine, setMandatoryOutroLine] = useState('');
  const [customInstruction, setCustomInstruction] = useState('');

  // Fetch initial library data and active tasks
  useEffect(() => {
    fetchAssets('', '');
    fetchTasks();
    pollLogs();
    fetch('/api/v2/brand-profiles').then(r => r.json()).then(d => { if (d.success) setBrandProfiles(d.data || []); }).catch(() => {});
    fetch('/api/product-agent').then(r => r.json()).then(d => { if (d.success) setProducts(d.data || []); }).catch(() => {});
    fetch('/api/v2/operator-presets').then(r => r.json()).then(d => { if (d.success) setPresets(d.presets || []); }).catch(() => {});
    fetch('/api/v2/deconstruct?limit=1').then(r => r.json()).then(d => { if (d.success) setNiches(d.niches || []); }).catch(() => {});

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

  // Pre-select deconstruction asset from search params
  useEffect(() => {
    if (assets.length > 0 && preSelectedAssetId) {
      setSelectedAssetId(preSelectedAssetId);
      setSelectedBlueprintIds([preSelectedAssetId]);
    }
  }, [assets, preSelectedAssetId]);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  const handleApplyPreset = (presetKey) => {
    setSelectedPresetKey(presetKey);
    const preset = presets.find(p => p.key === presetKey);
    if (!preset || !preset.config) return;
    const config = preset.config;

    // 1. Creative Strategy (basic_strategy)
    if (config.basic_strategy) {
      setNarrativeMode(config.basic_strategy.narrative_mode || 'Storytelling');
      setTargetLanguage(config.basic_strategy.target_language || 'id-ID');
      setEnableVoAudit(config.basic_strategy.enable_vo_audit ?? 1);
      setPromotionStyle(config.basic_strategy.promotion_style || 'Softselling');
    }

    // 2. Aesthetics & Visual (visual_engine)
    if (config.visual_engine) {
      setVisualStyle(config.visual_engine.visual_style || 'Cinematic');
      setVideoModel(config.visual_engine.video_model || 'veo_31_lite');
      setAspectRatio(config.visual_engine.aspect_ratio || '9:16');
      setFaceVisibility(config.visual_engine.face_visibility || 'Faceless');
      setWordsPerClip(config.visual_engine.words_per_clip || '17-19 kata');
      setVisualMode(config.visual_engine.visual_mode || 'hybrid_lock');
      if (config.visual_engine.video_model === 'veo_31_lite') {
        setTargetAi('Google Veo (8s)');
      } else {
        setTargetAi('Google Veo (5s)');
      }
    }

    // 3. Product Bridging (product_bridging)
    if (config.product_bridging) {
      setIsBridgingActive(config.product_bridging.is_bridging_active || false);
      setBridgeAtClip(config.product_bridging.bridge_at_clip || 2);
      setBridgeDurationClips(config.product_bridging.bridge_duration_clips || 1);
    }

    // 4. Visual Swap Overrides (visual_swap)
    if (config.visual_swap) {
      setIsVsoActive(config.visual_swap.is_vso_active || false);
      setCharacterConcept(config.visual_swap.character_concept || 'faceless');
      setSubjectDemographic(config.visual_swap.subject_demographic || 'syari_classic');
      setWardrobeStyle(config.visual_swap.wardrobe_style || 'random');
      setWardrobeStyleCustom(config.visual_swap.wardrobe_style_custom || '');
      setLightingStyle(config.visual_swap.lighting_style || 'random');
      setLightingStyleCustom(config.visual_swap.lighting_style_custom || '');
    }

    // 5. Workflow (workflow)
    if (config.workflow) {
      setEnableTts(config.workflow.enable_tts || false);
      setVoiceProvider(config.basic_strategy?.voice_provider || 'minimax');
      setVoicePersona(config.basic_strategy?.voice_persona || 'Indonesian_professional_anchor_vv2');
      setVoiceSpeed(Number(config.basic_strategy?.voice_speed ?? 1.0));
      setVoiceVolume(Number(config.basic_strategy?.voice_volume ?? 1.0));
      setTtsModelQuality(config.basic_strategy?.tts_model_quality || 'speech-2.8-turbo');
      setEnableGlabs(config.workflow.enable_glabs || false);
      setEnableFfmpeg(config.workflow.enable_ffmpeg || false);
      setFfmpegSyncOption(config.workflow.ffmpeg_sync_option || 'smart_sync');
      setFfmpegVideoScale(Number(config.workflow.ffmpeg_video_scale ?? 1.0));
      setFfmpegSfxVolume(Number(config.workflow.ffmpeg_sfx_volume ?? 0.0));
      setFfmpegBgmVolume(Number(config.workflow.ffmpeg_bgm_volume ?? 0.00));
    }
    showToast(`Preset "${preset.label}" berhasil diterapkan!`);
  };

  async function fetchAssets(query = '', niche = '') {
    setLoadingAssets(true);
    try {
      const res = await fetch(`/api/v2/deconstruct?assets=true&q=${encodeURIComponent(query)}&niche=${encodeURIComponent(niche)}`);
      const data = await res.json();
      if (data.success) {
        setAssets(data.assets || []);
      }
    } catch {
      showToast('Gagal memuat pustaka aset dekonstruksi', 'error');
    } finally {
      setLoadingAssets(false);
    }
  }

  // Generate Combination Rows
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
        .map(url => ({
          target_product_id: null,
          product_name: 'URL: ' + (url.length > 30 ? url.substring(0, 30) + '...' : url),
          target_product_url: url,
          affiliate_url: ''
        }));

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

  const handleViewBlueprintDetail = async (id) => {
    try {
      const res = await fetch(`/api/v2/deconstruct/assets/${id}`);
      const data = await res.json();
      if (data.success) {
        setPreviewAsset(data.asset);
        setShowPreviewModal(true);
      } else {
        showToast('Gagal memuat detail blueprint: ' + data.error, 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  async function fetchTasks(silent = false) {
    if (!silent) setLoadingTasks(true);
    try {
      const res = await fetch('/api/v2/multiplier');
      const data = await res.json();
      if (data.success) {
        setTasks(data.tasks || []);
        if (data.isSchedulerActive !== undefined) {
          setIsSchedulerActive(data.isSchedulerActive);
        }
      }
    } catch {
      if (!silent) showToast('Gagal memuat antrean multiplier', 'error');
    } finally {
      if (!silent) setLoadingTasks(false);
    }
  }

  async function pollLogs() {
    try {
      const res = await fetch(`/api/system-logs?type=multiplier&t=${Date.now()}`);
      if (res.ok) {
        const text = await res.text();
        const lines = text.split('\n');
        const last500 = lines.slice(-500).join('\n');
        setTerminalLogs(last500 || 'Belum ada log aktivitas multiplier.');
      }
    } catch (e) {
      // Ignore network errors on initial log checks
    }
  }

  async function toggleGlobalScheduler() {
    try {
      const res = await fetch('/api/v2/multiplier', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedulerActive: !isSchedulerActive })
      });
      const json = await res.json();
      if (json.success) {
        setIsSchedulerActive(!isSchedulerActive);
        showToast(`Skeduler berhasil ${!isSchedulerActive ? 'diaktifkan' : 'dimatikan'}`);
        pollLogs();
      } else {
        showToast('Gagal mengubah status skeduler: ' + json.error, 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  }

  async function handleToggleTaskStatus(id, currentStatus) {
    const isPaused = currentStatus === 'paused';
    const isFailed = currentStatus === 'failed';
    const newStatus = (isPaused || isFailed) ? 'pending_resolution' : 'paused';

    try {
      const res = await fetch(`/api/v2/multiplier/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Status tugas berhasil diubah menjadi ${newStatus}`);
        fetchTasks(true);
        pollLogs();
      } else {
        showToast('Gagal mengubah status tugas: ' + json.error, 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  }

  function handleCopyTaskSettings(task) {
    try {
      if (task.deconstruct_asset_id) setSelectedAssetId(task.deconstruct_asset_id);
      if (task.target_product_url) setProductUrl(task.target_product_url);
      if (task.affiliate_url) setAffiliateUrl(task.affiliate_url);

      const vso = JSON.parse(task.vso_config_json || '{}');
      if (vso.characterConcept) setCharacterConcept(vso.characterConcept);
      if (vso.subjectDemographic) setSubjectDemographic(vso.subjectDemographic);
      if (vso.wardrobeStyle) setWardrobeStyle(vso.wardrobeStyle);
      if (vso.wardrobeStyleCustom) setWardrobeStyleCustom(vso.wardrobeStyleCustom);
      if (vso.lightingStyle) setLightingStyle(vso.lightingStyle);
      if (vso.lightingStyleCustom) setLightingStyleCustom(vso.lightingStyleCustom);
      setIsVsoActive(Object.keys(vso).length > 0);

      const bridging = JSON.parse(task.bridging_config_json || '{}');
      if (bridging.isBridgingActive !== undefined) setIsBridgingActive(bridging.isBridgingActive);
      if (bridging.targetClipsCount) setTargetClipsCount(bridging.targetClipsCount);
      if (bridging.bridgeAtClip) setBridgeAtClip(bridging.bridgeAtClip);
      if (bridging.bridgeDurationClips) setBridgeDurationClips(bridging.bridgeDurationClips);
      if (bridging.promotionStyle) setPromotionStyle(bridging.promotionStyle);
      if (bridging.bridgingMode) setBridgingMode(bridging.bridgingMode);
      if (bridging.manualProductName) setManualProductName(bridging.manualProductName);
      if (bridging.manualProductDesc) setManualProductDesc(bridging.manualProductDesc);
      if (bridging.manualProductUsp) setManualProductUsp(bridging.manualProductUsp);
      if (bridging.productFilenameDeclare) setProductFilenameDeclare(bridging.productFilenameDeclare);
      if (bridging.visualMode) setVisualMode(bridging.visualMode);
      if (bridging.targetProductId) setTargetProductId(bridging.targetProductId);

      const audio = JSON.parse(task.audio_config_json || '{}');
      if (audio.enableTts !== undefined) setEnableTts(audio.enableTts);
      if (audio.voiceProvider) setVoiceProvider(audio.voiceProvider);
      if (audio.voicePersona) setVoicePersona(audio.voicePersona);
      if (audio.voiceSpeed) setVoiceSpeed(audio.voiceSpeed);
      if (audio.voiceVolume) setVoiceVolume(audio.voiceVolume);
      if (audio.enableFfmpeg !== undefined) setEnableFfmpeg(audio.enableFfmpeg);
      if (audio.ffmpegBgmVolume !== undefined) setFfmpegBgmVolume(audio.ffmpegBgmVolume);
      if (audio.ffmpegBgmPath) setFfmpegBgmPath(audio.ffmpegBgmPath);

      // Open the config form automatically
      setShowConfigForm(true);
      showToast('Konfigurasi tugas berhasil disalin ke form!');
    } catch (e) {
      showToast('Gagal menyalin konfigurasi: ' + e.message, 'error');
    }
  }

  // Handle Form Submission
  async function handleSubmit(e) {
    e.preventDefault();

    if (combinationRows.length === 0) {
      showToast('Tabel tinjauan kombinasi kosong. Silakan buat tinjauan kombinasi terlebih dahulu.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        mode: workflowMode,
        rows: combinationRows.map(row => ({
          deconstruct_asset_id: row.deconstruct_asset_id,
          target_product_id: row.target_product_id,
          target_product_url: row.target_product_url,
          affiliate_url: row.affiliate_url
        })),
        vso_config_json: JSON.stringify({
          narrativeMode,
          visualStyle,
          targetAi,
          videoModel,
          aspectRatio,
          faceVisibility,
          wordsPerClip,
          isVsoActive,
          characterConcept,
          subjectDemographic,
          wardrobeStyle,
          lightingStyle
        }),
        bridging_config_json: JSON.stringify({
          isBridgingActive,
          targetClipsCount,
          bridgeAtClip,
          bridgeDurationClips,
          promotionStyle,
          bridgingMode,
          targetProductId,
          manualProductName,
          manualProductDesc,
          manualProductUsp,
          productUrl,
          visualMode,
          productFilenameDeclare
        }),
        audio_config_json: JSON.stringify({
          enableTts,
          voiceProvider,
          voicePersona,
          voiceSpeed,
          voiceVolume,
          ttsModelQuality,
          enableGlabs,
          enableFfmpeg,
          targetLanguage,
          ffmpegSyncOption,
          ffmpegVideoScale,
          ffmpegSfxVolume,
          ffmpegBgmVolume
        }),
        enable_vo_audit: enableVoAudit ? 1 : 0
      };

      let bodyData;
      let headers = {};
      if (productRefImage) {
        const formData = new FormData();
        formData.append('rows', JSON.stringify(payload.rows));
        formData.append('mode', payload.mode);
        formData.append('vso_config_json', payload.vso_config_json);
        formData.append('bridging_config_json', payload.bridging_config_json);
        formData.append('audio_config_json', payload.audio_config_json);
        formData.append('enable_vo_audit', String(payload.enable_vo_audit));
        formData.append('product_media', productRefImage);
        bodyData = formData;
      } else {
        bodyData = JSON.stringify(payload);
        headers = { 'Content-Type': 'application/json' };
      }

      const res = await fetch('/api/v2/multiplier', {
        method: 'POST',
        headers,
        body: bodyData
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Task Multiplier Lab berhasil didaftarkan.');
        setProductUrl('');
        setAffiliateUrl('');
        setMassUrlsText('');
        setProductRefImage(null);
        setSelectedBlueprintIds([]);
        setSelectedProductIds([]);
        setCombinationRows([]);
        setShowConfigForm(false);
        fetchTasks();
        pollLogs();
      } else {
        showToast(data.error || 'Gagal mendaftarkan task', 'error');
      }
    } catch (err) {
      showToast('Error mengirim data: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // Handle deletion of task
  async function handleDelete(taskId) {
    if (!confirm('Hapus task multiplier ini?')) return;
    try {
      const res = await fetch(`/api/v2/multiplier/${taskId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Task berhasil dihapus');
        if (expandedTaskId === taskId) setExpandedTaskId(null);
        fetchTasks();
        pollLogs();
      }
    } catch {
      showToast('Gagal menghapus task', 'error');
    }
  }

  function getStatusStyle(status) {
    const map = {
      pending_resolution: { color: 'var(--text-muted)', bg: 'var(--surface-interactive)' },
      resolving_product: { color: 'var(--info)', bg: 'rgba(116,185,255,0.15)' },
      remaking: { color: 'var(--info)', bg: 'rgba(116,185,255,0.15)' },
      generating_audio: { color: 'var(--info)', bg: 'rgba(116,185,255,0.15)' },
      generating_visuals: { color: 'var(--info)', bg: 'rgba(116,185,255,0.15)' },
      ffmpeg_muxing: { color: 'var(--info)', bg: 'rgba(116,185,255,0.15)' },
      completed: { color: 'var(--success)', bg: 'var(--success-glow)' },
      failed: { color: 'var(--danger)', bg: 'var(--danger-glow)' },
      paused: { color: 'var(--status-warning)', bg: 'rgba(253, 203, 110, 0.15)' }
    };
    return map[status] || { color: 'var(--text-primary)', bg: 'var(--border-subtle)' };
  }

  return (
    <div className="app-container">
      <Sidebar />

      <main className="main-content">
        <div style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto' }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <h1 className="page-title" style={{ margin: 0, fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                🎛️ Multiplier Lab (Remake Engine)
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 4 }}>
                Suntikkan produk jualan Anda ke dalam blueprint video kompetitor yang sukses secara dinamis.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => fetchTasks()}
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '8px 14px' }}
              >
                🔄 Refresh Antrean
              </button>
            </div>
          </div>

          {/* Global Scheduler Control Card */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: 16,
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                ⚙️ Status Skeduler Multiplier Lab
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                Mengontrol jalannya antrean pembuatan video hasil perkalian (multiplier) secara otomatis.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '4px 10px',
                borderRadius: 12,
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
                  fontSize: '0.8rem',
                  padding: '6px 16px',
                  fontWeight: 600,
                  boxShadow: isSchedulerActive ? '0 0 15px var(--status-danger-soft)' : '0 0 15px var(--status-success-soft)',
                  border: isSchedulerActive ? '1px solid var(--status-danger-soft)' : '1px solid var(--status-success-soft)'
                }}
              >
                {isSchedulerActive ? '🛑 STOP SKEDULER' : '▶️ START SKEDULER'}
              </button>
            </div>
          </div>

          {/* Activity Terminal */}
          <div className="card" style={{ padding: '0', background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: '24px' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--status-success)', display: 'inline-block', boxShadow: '0 0 8px var(--status-success)' }}></span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>SYSTEM POLLER LOGGER</span>
              </div>
              <button
                onClick={pollLogs}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
              >
                [Refresh Log]
              </button>
            </div>
            <pre
              ref={terminalRef}
              style={{
                margin: 0,
                padding: '20px',
                background: 'var(--surface)',
                color: '#20c20e',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.82rem',
                maxHeight: '220px',
                overflowY: 'auto',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap'
              }}
            >
              {terminalLogs}
            </pre>
          </div>

          {/* Stacked Layout: Config Form & Antrean */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Config Form Settings */}
            {!showConfigForm ? (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 0 }}>
                <button
                  type="button"
                  onClick={() => setShowConfigForm(true)}
                  className="btn btn-primary"
                  style={{
                    fontSize: '0.85rem',
                    padding: '10px 20px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 0 15px var(--accent-glow)'
                  }}
                >
                  ➕ New Multiplier Campaign / Buat Remake Baru
                </button>
              </div>
            ) : (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 0 }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>⚙️ Konfigurasi Remake Video</strong>
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

                {/* 0. Brand Account & Campaign Identity */}
                <div style={{ padding: 24, borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">🏷️ Nama Akun (Brand Account)</label>
                    <select
                      className="form-input"
                      value={accountName}
                      onChange={e => {
                        const newAcc = e.target.value;
                        setAccountName(newAcc);
                        const now = new Date();
                        const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
                        setCampaignName(`[ MULTIPLIER ${dateStr} ] - ${newAcc ? newAcc + ' - ' : ''}`);
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

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Nama Kampanye Multiplier</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Contoh: Multiplier Remake v1"
                      value={campaignName}
                      onChange={e => setCampaignName(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">🎛️ Terapkan Preset Kampanye</label>
                    <select
                      className="form-input"
                      value={selectedPresetKey}
                      onChange={e => handleApplyPreset(e.target.value)}
                    >
                      <option value="">-- Tanpa Preset (Atur Manual) --</option>
                      {presets.map(p => (
                        <option key={p.key} value={p.key}>
                          {p.label} {p.is_system ? ' (System)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 1. Blueprint Card Picker with Search */}
                <div style={{ padding: 24, borderBottom: '1px solid var(--border)' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>📹 Pilih Blueprint Video Target</label>
                    
                    <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
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
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, maxHeight: '400px', overflowY: 'auto', padding: 8, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-interactive)' }}>
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

                          return (
                            <div
                              key={a.id}
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
                              onClick={handleToggle}
                            >
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', background: 'var(--overlay-subtle)', padding: '2px 6px', borderRadius: 4, color: 'var(--accent)', fontWeight: 600 }}>
                                    {a.niche || 'Skincare'}
                                  </span>
                                  <input
                                    type={workflowMode === 'multi_blueprint_one_product' ? 'checkbox' : 'radio'}
                                    checked={isSelected}
                                    name="selected_blueprint_radio"
                                    onChange={handleToggle}
                                    onClick={e => e.stopPropagation()}
                                  />
                                </div>
                                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, margin: '8px 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                                  {a.original_caption || 'Blueprint Video'}
                                </h4>
                                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                  🔗 {a.source_url}
                                </p>
                                {a.viral_pattern_summary && (
                                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '6px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    💡 {a.viral_pattern_summary}
                                  </p>
                                )}
                                {a.tags && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                                    {a.tags.split(',').slice(0, 3).map(tag => (
                                      <span key={tag} style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                        #{tag.trim()}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  🎬 {a.scene_count || 0} Scene
                                </span>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ fontSize: '0.7rem', padding: '4px 10px', height: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewBlueprintDetail(a.id);
                                  }}
                                >
                                  Lihat Detail
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {assets.length === 0 && (
                          <div style={{ gridColumn: '1/span 3', padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            Tidak ada blueprint ditemukan.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {workflowMode === 'one_blueprint_multi_product' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontWeight: 700 }}>📦 Pilih Produk dari Pustaka (Multi-Select)</label>
                        <input
                          type="text"
                          className="form-input"
                          style={{ marginBottom: 10, fontSize: '0.8rem' }}
                          placeholder="🔍 Cari produk di pustaka..."
                          value={productSearchQuery}
                          onChange={e => setProductSearchQuery(e.target.value)}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, maxHeight: '200px', overflowY: 'auto', padding: 10, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-interactive)' }}>
                          {products
                            .filter(p => (p.product_name || '').toLowerCase().includes(productSearchQuery.toLowerCase()))
                            .map(p => {
                              const isChecked = selectedProductIds.includes(p.id);
                              const handleToggleProduct = () => {
                                setSelectedProductIds(prev =>
                                  isChecked ? prev.filter(id => id !== p.id) : [...prev, p.id]
                                );
                              };
                              return (
                                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', background: isChecked ? 'var(--status-info-soft)' : 'var(--bg-card)', fontSize: '0.78rem' }}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={handleToggleProduct}
                                  />
                                  <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                                    {p.product_name}
                                  </span>
                                </label>
                              );
                            })}
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontWeight: 700 }}>🔗 Atau Tambah URL Produk Baru (1 Baris per URL)</label>
                        <textarea
                          rows="3"
                          className="form-textarea"
                          placeholder="https://shopee.co.id/product-1&#10;https://shopee.co.id/product-2"
                          value={massUrlsText}
                          onChange={e => setMassUrlsText(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* ACCORDION SECTIONS */}

                {/* Section 1: Basic Creative Strategy */}
                <div style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <div
                    onClick={() => setActiveAccordion(0)}
                    style={{ padding: '16px 24px', background: activeAccordion === 0 ? 'var(--status-info-soft)' : 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>1. Basic Creative Strategy</span>
                    <span>{activeAccordion === 0 ? '▲' : '▼'}</span>
                  </div>
                  {activeAccordion === 0 && (
                    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--overlay-subtle)' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Parent Folder Nextcloud</label>
                        <input
                          className="form-input"
                          placeholder="Contoh: /MAKNA_Assets"
                          value={nextcloudParentFolder}
                          onChange={e => setNextcloudParentFolder(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Bahasa Naskah Voiceover (Script Language)</label>
                        <select
                          className="form-input"
                          value={targetLanguage}
                          onChange={e => setTargetLanguage(e.target.value)}
                        >
                          <option value="id-ID">🇮🇩 Bahasa Indonesia (Lokal)</option>
                          <option value="en-US">🇺🇸 English (Global / US Market)</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">🎯 Target Demografi & Tone Bahasa</label>
                        <select
                          className="form-input"
                          value={targetDemographic}
                          onChange={e => setTargetDemographic(e.target.value)}
                        >
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
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">AI Directive / Guardrail (Staging Override)</label>
                        <textarea
                          className="form-textarea"
                          style={{ minHeight: 60 }}
                          placeholder="Instruksi kontrol AI internal (misal: Bahas brand sebagai ahli kuliner; jangan bahas kompetitor...)"
                          value={aiDirective}
                          onChange={e => setAiDirective(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Mandatory Outro Line (Staging Override)</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Kalimat wajib di akhir klip voiceover (misal: Produk ada di keranjang kuning ya!)"
                          value={mandatoryOutroLine}
                          onChange={e => setMandatoryOutroLine(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Custom Instruction (Opsional)</label>
                        <textarea
                          className="form-textarea"
                          style={{ minHeight: 80 }}
                          placeholder="Instruksi tambahan untuk AI saat menganalisa video ini..."
                          value={customInstruction}
                          onChange={e => setCustomInstruction(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 2: Aesthetics & Visual Settings */}
                <div style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <div
                    onClick={() => setActiveAccordion(1)}
                    style={{ padding: '16px 24px', background: activeAccordion === 1 ? 'var(--status-info-soft)' : 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>2. Aesthetics & Visual Settings</span>
                    <span>{activeAccordion === 1 ? '▲' : '▼'}</span>
                  </div>
                  {activeAccordion === 1 && (
                    <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, background: 'var(--overlay-subtle)' }}>
                      <div className="form-group">
                        <label className="form-label">Narrative Mode</label>
                        <select className="form-input" value={narrativeMode} onChange={e => setNarrativeMode(e.target.value)}>
                          <option value="Storytelling">Storytelling (Daily-life)</option>
                          <option value="Problem-Solution">Problem-Solution</option>
                          <option value="Educational">Educational (Tutorial)</option>
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
                      <div className="form-group">
                        <label className="form-label">Visual Mode</label>
                        <select className="form-input" value={visualMode} onChange={e => setVisualMode(e.target.value)}>
                          <option value="pure_t2v">Pure T2V (Klasik - Text-to-Video untuk semua klip)</option>
                          <option value="hybrid_lock">Hybrid Lock (RE Hybrid & Product Pixel Lock - Double-Pass)</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">AI Engine & Model</label>
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
                        <label className="form-label">Aspect Ratio</label>
                        <select className="form-input" value={aspectRatio} onChange={e => setAspectRatio(e.target.value)}>
                          <option value="9:16">9:16 (Vertical TikTok)</option>
                          <option value="16:9">16:9 (Horizontal YouTube)</option>
                          <option value="1:1">1:1 (Square)</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Face Visibility</label>
                        <select className="form-input" value={faceVisibility} onChange={e => setFaceVisibility(e.target.value)}>
                          <option value="Faceless">Faceless (Fokus Aksi Tangan)</option>
                          <option value="POV">POV (Sudut Pandang Kamera Utama)</option>
                          <option value="Silhouette">Silhouette (Estetik Siluet)</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">Kepadatan Kata per Klip (Words per Clip)</label>
                        <select className="form-input" value={wordsPerClip} onChange={e => setWordsPerClip(e.target.value)}>
                          <option value="15-16 kata">15-16 kata (Cepat, Dinamis)</option>
                          <option value="17-19 kata">17-19 kata (Standar, Berirama)</option>
                          <option value="20-24 kata">20-24 kata (Padat, Edukatif)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 3: Product Bridging Settings */}
                <div style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <div
                    onClick={() => setActiveAccordion(2)}
                    style={{ padding: '16px 24px', background: activeAccordion === 2 ? 'var(--status-info-soft)' : 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>3. Product Bridging Settings</span>
                    <span>{activeAccordion === 2 ? '▲' : '▼'}</span>
                  </div>
                  {activeAccordion === 2 && (
                    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--overlay-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={isBridgingActive}
                            onChange={e => setIsBridgingActive(e.target.checked)}
                          />
                          <span className="slider"></span>
                        </label>
                        <strong>🔌 Aktifkan Bridging Promosi Produk (Sandwich Protocol)</strong>
                      </div>

                      {isBridgingActive && (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                            <div className="form-group">
                              <label className="form-label">Jumlah Klip Video (N)</label>
                              <input
                                type="number"
                                className="form-input"
                                min="3"
                                max="10"
                                value={targetClipsCount}
                                onChange={e => setTargetClipsCount(Number(e.target.value))}
                                required
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Mulai Promosi pada Klip Ke- (X)</label>
                              <input
                                type="number"
                                className="form-input"
                                min="1"
                                max={targetClipsCount}
                                value={bridgeAtClip}
                                onChange={e => setBridgeAtClip(Number(e.target.value))}
                                required
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Durasi Promosi (Jumlah Klip)</label>
                              <input
                                type="number"
                                className="form-input"
                                min="1"
                                max={targetClipsCount - bridgeAtClip + 1}
                                value={bridgeDurationClips}
                                onChange={e => setBridgeDurationClips(Number(e.target.value))}
                                required
                              />
                            </div>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Gaya Promosi</label>
                            <select className="form-input" value={promotionStyle} onChange={e => setPromotionStyle(e.target.value)}>
                              <option value="Softselling">Softselling (Halus)</option>
                              <option value="Hardsell">Hardsell (Jelas, Promosi USP)</option>
                              <option value="Education">Education (Review Logis)</option>
                            </select>
                          </div>
                        </>
                      )}

                      {/* Product DNA Injection Settings (Always visible in Single mode for both direct and bridged placement) */}
                      {productionMode === 'single' && (
                        <>
                          <div className="form-group">
                            <label className="form-label">Metode Penyertaan Produk</label>
                            <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.8rem' }}>
                                <input type="radio" name="bridgingModeMult" value="url_extract" checked={bridgingMode === 'url_extract'} onChange={e => setBridgingMode(e.target.value)} />
                                Ekstrak dari URL
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.8rem' }}>
                                <input type="radio" name="bridgingModeMult" value="select_existing" checked={bridgingMode === 'select_existing'} onChange={e => setBridgingMode(e.target.value)} />
                                Pilih dari Pustaka
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.8rem' }}>
                                <input type="radio" name="bridgingModeMult" value="manual_input" checked={bridgingMode === 'manual_input'} onChange={e => setBridgingMode(e.target.value)} />
                                Tulis Manual
                              </label>
                            </div>
                          </div>

                          {bridgingMode === 'url_extract' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, background: 'var(--bg-secondary)', padding: 16, borderRadius: 8 }}>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">URL Produk (Shopee/Tokopedia)</label>
                                <input
                                  type="url"
                                  className="form-input"
                                  placeholder="https://shopee.co.id/product-url"
                                  value={productUrl}
                                  onChange={e => setProductUrl(e.target.value)}
                                  required={bridgingMode === 'url_extract'}
                                />
                              </div>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Affiliate URL (Opsional)</label>
                                <input
                                  type="url"
                                  className="form-input"
                                  placeholder="https://shope.ee/short-url"
                                  value={affiliateUrl}
                                  onChange={e => setAffiliateUrl(e.target.value)}
                                />
                              </div>
                            </div>
                          )}

                          {bridgingMode === 'select_existing' && (
                            <div className="form-group" style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <div>
                                <label className="form-label">Pilih Produk</label>

                                {/* Search Input for Product Selection */}
                                <input
                                  type="text"
                                  className="form-input"
                                  style={{ marginBottom: 10, fontSize: '0.8rem' }}
                                  placeholder="🔍 Cari produk berdasarkan nama atau brand..."
                                  value={productSearchQuery}
                                  onChange={e => setProductSearchQuery(e.target.value)}
                                />

                                <select className="form-input" value={targetProductId} onChange={e => {
                                  const val = e.target.value;
                                  setTargetProductId(val);
                                  if (val) {
                                    const selProduct = products.find(p => String(p.id) === String(val));
                                    if (selProduct) {
                                      const photoPath = selProduct.photo_url || selProduct.clean_photo_url || selProduct.generated_photo_url || selProduct.raw_photo_url || '';
                                      if (photoPath) {
                                        setProductRefImage(photoPath);
                                        const derivedFilename = selProduct.filename_declare || (selProduct.product_name ? `${selProduct.product_name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_ref.jpg` : 'product_ref.jpg');
                                        setProductFilenameDeclare(derivedFilename);
                                      }
                                    }
                                  }
                                }}>
                                  <option value="">-- Pilih Produk Terdaftar --</option>
                                  {products
                                    .filter(p =>
                                      (p.product_name || '').toLowerCase().includes(productSearchQuery.toLowerCase()) ||
                                      (p.brand_name || '').toLowerCase().includes(productSearchQuery.toLowerCase())
                                    )
                                    .map(p => (
                                      <option key={p.id} value={p.id}>{p.brand_name || 'Generik'} - {p.product_name}</option>
                                    ))
                                  }
                                </select>
                                {targetProductId && productRefImage && (
                                  <div style={{ marginTop: 10, background: 'var(--status-success-soft)', border: '1px solid var(--status-success-soft)', padding: 12, borderRadius: 8 }}>
                                    <div style={{ color: 'var(--status-success)', fontWeight: 600, fontSize: '0.85rem' }}>
                                      ✨ Foto Produk & Deklarasi Mandate 88 Otomatis Terhubung dari Database Produk
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                                      {typeof productRefImage === 'string' && (
                                        <img src={productRefImage} alt="Product Ref" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-color)' }} />
                                      )}
                                      <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                                        <div><b>Nama Berkas Deklarasi:</b> <code>{productFilenameDeclare || 'Auto Generated'}</code></div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {bridgingMode === 'manual_input' && (
                            <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <div className="form-group">
                                <label className="form-label">Nama Produk</label>
                                <input className="form-input" placeholder="Contoh: Makna Brightening Serum" value={manualProductName} onChange={e => setManualProductName(e.target.value)} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Deskripsi Singkat</label>
                                <textarea className="form-textarea" placeholder="Manfaat utama..." value={manualProductDesc} onChange={e => setManualProductDesc(e.target.value)} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Unique Selling Point (USP)</label>
                                <input className="form-input" placeholder="Contoh: Mengandung 10% Niacinamide" value={manualProductUsp} onChange={e => setManualProductUsp(e.target.value)} />
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* Foto Referensi Produk Upload - Tampilkan jika visualMode === 'hybrid_lock' */}
                      {visualMode === 'hybrid_lock' && (
                        <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {bridgingMode === 'select_existing' && targetProductId && productRefImage ? (
                            <div style={{ background: 'var(--status-success-soft)', border: '1px solid var(--border)', padding: 12, borderRadius: 8 }}>
                              <div style={{ color: 'var(--status-success)', fontWeight: 600, fontSize: '0.85rem', marginBottom: 8 }}>
                                🔒 Terkunci dari Database Produk (Reference Image & Filename terikat otomatis)
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                {typeof productRefImage === 'string' && (
                                  <img src={productRefImage} alt="Product Ref" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                                )}
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                                  <div><b>Berkas Deklarasi:</b> <code>{productFilenameDeclare || 'Auto Generated'}</code></div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">📸 Unggah Foto Produk (Reference Image)</label>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={e => setProductRefImage(e.target.files[0])}
                                  className="form-input"
                                />
                                <small style={{ color: 'var(--text-muted)' }}>Foto produk yang akan di-lock penampilannya pada video promosi.</small>
                              </div>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">🏷️ Nama Berkas Gambar Produk (Deklarasi Mandate 88)</label>
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="Contoh: youth_retinol_serum.png"
                                  value={productFilenameDeclare}
                                  onChange={e => setProductFilenameDeclare(e.target.value)}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Tinjauan Kombinasi Section */}
                <div style={{ padding: 24, borderBottom: '1px solid var(--border)', background: 'var(--surface-interactive)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>📊 Tinjauan Kombinasi Blueprint & Produk</strong>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                        Buat tabel kombinasi berdasarkan blueprint dan produk pilihan Anda sebelum melakukan render.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={generateCombinationRows}
                      style={{ fontSize: '0.8rem', padding: '6px 14px', background: 'var(--accent)', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)' }}
                    >
                      ⚡ Buat Tabel Tinjauan
                    </button>
                  </div>

                  {combinationRows.length > 0 ? (
                    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-card)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'var(--overlay-subtle)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                            <th style={{ padding: '10px 12px', fontWeight: 600 }}>No</th>
                            <th style={{ padding: '10px 12px', fontWeight: 600 }}>Blueprint</th>
                            <th style={{ padding: '10px 12px', fontWeight: 600 }}>Produk</th>
                            <th style={{ padding: '10px 12px', fontWeight: 600 }}>Mode Bridge</th>
                            <th style={{ padding: '10px 12px', fontWeight: 600 }}>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {combinationRows.map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: idx < combinationRows.length - 1 ? '1px solid var(--border)' : 'none' }}>
                              <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                              <td style={{ padding: '10px 12px' }}>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.deconstruct_asset_title}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>
                                  {row.deconstruct_asset_url}
                                </div>
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.target_product_name}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>
                                  {row.target_product_url || 'Input Manual / Belum diekstrak'}
                                </div>
                              </td>
                              <td style={{ padding: '10px 12px', textTransform: 'uppercase', color: 'var(--info)', fontWeight: 600 }}>
                                {isBridgingActive ? promotionStyle : 'Direct'}
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <button
                                  type="button"
                                  onClick={() => setCombinationRows(prev => prev.filter((_, i) => i !== idx))}
                                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 600 }}
                                >
                                  Hapus
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 24, border: '2px dashed var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: '0.78rem', background: 'var(--bg-card)' }}>
                      Tinjauan kombinasi belum dibuat. Silakan pilih blueprint dan produk kemudian klik "Buat Tabel Tinjauan".
                    </div>
                  )}
                </div>

                {/* Section 4: Visual Swap Overrides */}
                <div style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <div
                    onClick={() => setActiveAccordion(3)}
                    style={{ padding: '16px 24px', background: activeAccordion === 3 ? 'var(--status-info-soft)' : 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>4. Visual Swap Overrides (VSO)</span>
                    <span>{activeAccordion === 3 ? '▲' : '▼'}</span>
                  </div>
                  {activeAccordion === 3 && (
                    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--overlay-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={isVsoActive}
                            onChange={e => setIsVsoActive(e.target.checked)}
                          />
                          <span className="slider"></span>
                        </label>
                        <strong>🎭 Aktifkan Visual Swap Overrides</strong>
                      </div>

                      {isVsoActive && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                          <div className="form-group">
                            <label className="form-label">Konsep Karakter (Framing)</label>
                            <select className="form-input" value={characterConcept} onChange={e => setCharacterConcept(e.target.value)}>
                              <option value="faceless">Faceless (Fokus Tangan)</option>
                              <option value="pov">POV (First Person View)</option>
                              <option value="silhouette">Siluet Bayangan</option>
                              <option value="stylized_3d">3D Stylized Claymation</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Demografi Subjek / Model</label>
                            <select
                              className="form-input"
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
                            <select className="form-input" value={wardrobeStyle} onChange={e => setWardrobeStyle(e.target.value)}>
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
                                      : "Ketik warna kustom..."
                                }
                                value={wardrobeStyleCustom}
                                onChange={e => setWardrobeStyleCustom(e.target.value)}
                              />
                            )}
                          </div>
                          <div className="form-group">
                            <label className="form-label">Pencahayaan (Lighting)</label>
                            <select className="form-input" value={lightingStyle} onChange={e => setLightingStyle(e.target.value)}>
                              <option value="random">🎲 Random (Acak)</option>
                              <option value="window_daylight">Soft Window Daylight (Cahaya jendela natural)</option>
                              <option value="golden_hour">Golden Hour Warm Sunset (Sorot sore keemasan)</option>
                              <option value="moody_shadow">Moody Cinematic Shadow (Kontras chiaroscuro dramatis)</option>
                              <option value="studio_softbox">Clean Professional Studio Softbox (Sangat bersih)</option>
                              <option value="lab_cold">Clinical Cold White (Putih lab bersih terang)</option>
                              <option value="cyber_neon">Moody Cyberpunk Blue-Pink Neon (Warna glow modern)</option>
                              <option value="candle_warm">Cozy Dim Candlelight Ambiance (Sangat syahdu hangat)</option>
                              <option value="custom">-- Tulis Custom --</option>
                            </select>
                            {lightingStyle === 'custom' && (
                              <input type="text" className="form-input" style={{ marginTop: 8 }} placeholder="Lighting kustom..." value={lightingStyleCustom} onChange={e => setLightingStyleCustom(e.target.value)} />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Section 5: Workflow & Audio Settings */}
                <div style={{ borderBottom: 'none' }}>
                  <div
                    onClick={() => setActiveAccordion(4)}
                    style={{ padding: '16px 24px', background: activeAccordion === 4 ? 'var(--status-info-soft)' : 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>⚙️ 5. Workflow & Audio Settings</span>
                      <span style={{ fontSize: '0.72rem', background: (enableTts || enableGlabs || enableFfmpeg || enableSocialPost) ? 'var(--status-success-soft)' : 'var(--surface-interactive)', color: (enableTts || enableGlabs || enableFfmpeg || enableSocialPost) ? 'var(--status-success)' : 'var(--text-muted)', padding: '2px 6px', borderRadius: 4 }}>
                        {(enableTts || enableGlabs || enableFfmpeg || enableSocialPost) ? 'Active Stages' : 'All Off'}
                      </span>
                    </div>
                    <span>{activeAccordion === 4 ? '▲' : '▼'}</span>
                  </div>
                  {activeAccordion === 4 && (
                    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--overlay-subtle)' }}>

                      {/* Active Stages Checklist */}
                      <div>
                        <label className="form-label" style={{ marginBottom: 10 }}>Tahapan Workflow Aktif</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '500' }}>Enable TTS (Voiceover)</span>
                            <input type="checkbox" checked={enableTts} onChange={e => setEnableTts(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '500' }}>Enable G-Labs (AI Video)</span>
                            <input type="checkbox" checked={enableGlabs} onChange={e => setEnableGlabs(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '500' }}>Enable FFmpeg Muxing</span>
                            <input type="checkbox" checked={enableFfmpeg} onChange={e => setEnableFfmpeg(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '500' }}>Enable Social Draft Post</span>
                            <input type="checkbox" checked={enableSocialPost} onChange={e => setEnableSocialPost(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                          </div>
                        </div>
                      </div>

                      {/* Audio/TTS settings */}
                      {enableTts && (
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                          <label className="form-label" style={{ fontWeight: 600, color: 'var(--accent)' }}>🔊 TTS Audio Engine Settings</label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                            <div>
                              <label className="form-label" style={{ fontSize: '0.78rem' }}>Voice Provider</label>
                              <select className="form-input" value={voiceProvider} onChange={e => setVoiceProvider(e.target.value)}>
                                <option value="minimax">MiniMax VO Engine</option>
                                <option value="gemini">Gemini TTS Engine</option>
                              </select>
                            </div>
                            <div>
                              <label className="form-label" style={{ fontSize: '0.78rem' }}>Voice Persona</label>
                              <select
                                className="form-input"
                                value={voicePersona}
                                onChange={e => setVoicePersona(e.target.value)}
                              >
                                {voiceProvider === 'gemini'
                                  ? GEMINI_VOICES.map(v => <option key={v.id} value={v.id}>{v.name} - {v.desc}</option>)
                                  : (targetLanguage === 'en-US' ? MINIMAX_ENGLISH_VOICES : MINIMAX_VOICES).map(v => <option key={v.id} value={v.id}>{v.name} - {v.desc}</option>)
                                }
                              </select>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                            <div>
                              <label className="form-label" style={{ fontSize: '0.78rem' }}>Speed ({voiceSpeed}x)</label>
                              <input type="range" min="0.5" max="2.0" step="0.1" value={voiceSpeed} onChange={e => setVoiceSpeed(parseFloat(e.target.value))} style={{ width: '100%' }} />
                            </div>
                            <div>
                              <label className="form-label" style={{ fontSize: '0.78rem' }}>Volume ({voiceVolume}x)</label>
                              <input type="range" min="0.0" max="1.0" step="0.1" value={voiceVolume} onChange={e => setVoiceVolume(parseFloat(e.target.value))} style={{ width: '100%' }} />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TikTok Safe Compliance Audit */}
                      <div className="form-group" style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 8, marginBottom: 0, marginTop: 4 }}>
                        <label className="form-label">Audit Kepatuhan TikTok Safe</label>
                        <select
                          className="form-input"
                          value={enableVoAudit}
                          onChange={e => setEnableVoAudit(Number(e.target.value))}
                        >
                          <option value={1}>✅ Yes (Audit Compliance & Render 2 Versi VO)</option>
                          <option value={0}>❌ No (Tanpa Audit Compliance)</option>
                        </select>
                      </div>

                      {/* FFmpeg Video Studio Settings */}
                      {enableFfmpeg && (
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <label className="form-label" style={{ fontWeight: 600, color: 'var(--accent)' }}>🎬 FFmpeg Video Studio Settings</label>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label className="form-label" style={{ fontSize: '0.78rem' }}>Mode Sinkronisasi Audio-Video</label>
                            <div style={{ display: 'flex', gap: 24, marginTop: 2 }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                                <input
                                  type="radio"
                                  name="syncModeReAutopilot"
                                  value="auto"
                                  checked={syncMode === 'auto'}
                                  onChange={() => {
                                    setSyncMode('auto');
                                    setFfmpegSyncOption('smart_sync');
                                  }}
                                  style={{ width: 14, height: 14, cursor: 'pointer' }}
                                />
                                <span><b>Auto-Pilot Smart Sync</b></span>
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                                <input
                                  type="radio"
                                  name="syncModeReAutopilot"
                                  value="manual"
                                  checked={syncMode === 'manual'}
                                  onChange={() => {
                                    setSyncMode('manual');
                                    setFfmpegSyncOption('shortest');
                                  }}
                                  style={{ width: 14, height: 14, cursor: 'pointer' }}
                                />
                                <span>Kustom Manual</span>
                              </label>
                            </div>

                            {syncMode === 'manual' && (
                              <div className="form-group" style={{ flex: 1, marginTop: 6, marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.78rem' }}>Metode Manual</label>
                                <select className="form-input" value={ffmpegSyncOption} onChange={e => setFfmpegSyncOption(e.target.value)}>
                                  <option value="shortest">shortest (Potong video - Default)</option>
                                  <option value="loop">loop (Ulang video)</option>
                                  <option value="stretch">stretch (Ubah kecepatan)</option>
                                  <option value="freeze">freeze (Tahan frame terakhir)</option>
                                </select>
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '0.78rem' }}>BGM Volume</label>
                              <input type="number" min="0" max="1" step="0.05" className="form-input" value={ffmpegBgmVolume} onChange={e => setFfmpegBgmVolume(parseFloat(e.target.value))} />
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '0.78rem' }}>SFX Volume</label>
                              <input type="number" min="0" max="1" step="0.05" className="form-input" value={ffmpegSfxVolume} onChange={e => setFfmpegSfxVolume(parseFloat(e.target.value))} />
                            </div>
                          </div>

                          <div>
                            <label className="form-label" style={{ fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                              <span>Video Scale:</span>
                              <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{Math.round(ffmpegVideoScale * 100)}%</span>
                            </label>
                            <input
                              type="range"
                              min="1.0"
                              max="2.0"
                              step="0.05"
                              className="form-input"
                              value={ffmpegVideoScale}
                              onChange={e => setFfmpegVideoScale(parseFloat(e.target.value))}
                              style={{ width: '100%', padding: 0 }}
                            />
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </div>

                {/* Submit Action */}
                <div style={{ padding: 24, borderTop: '1px solid var(--border)', background: 'var(--overlay-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting}
                    style={{ padding: '12px 24px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                  >
                    {submitting ? (
                      <>
                        <div className="spinner" style={{ width: 14, height: 14, border: '2px solid var(--text-primary)', borderTopColor: 'transparent' }}></div>
                        Mengirim...
                      </>
                    ) : (
                      '🚀 Generate Remake Video'
                    )}
                  </button>
                </div>
              </form>
            </div>
            )}

            {/* Queue Section: Active Task Queue */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px 20px' }}>
                <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)', display: 'block', marginBottom: 2 }}>
                  📋 Antrean Render Multiplier
                </strong>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Total {tasks.length} task terdaftar di database
                </span>
              </div>

              {loadingTasks ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  <div className="spinner" style={{ margin: '0 auto 12px', width: 24, height: 24 }}></div>
                  Memuat data antrean...
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {tasks.map((t, idx) => {
                    const isExpanded = expandedTaskId === t.id;

                    let statusLabel = 'PENDING';
                    let badgeStyle = { background: 'rgba(108, 117, 125, 0.15)', color: 'var(--text-muted)', border: '1px solid rgba(108, 117, 125, 0.3)' };

                    if (t.status === 'completed') {
                      statusLabel = 'COMPLETED';
                      badgeStyle = { background: 'var(--status-success-soft)', color: 'var(--success)', border: '1px solid var(--status-success-soft)' };
                    } else if (t.status === 'failed') {
                      statusLabel = 'FAILED';
                      badgeStyle = { background: 'var(--status-danger-soft)', color: 'var(--danger)', border: '1px solid var(--status-danger-soft)' };
                    } else if (t.status === 'paused') {
                      statusLabel = 'STOPPED';
                      badgeStyle = { background: 'rgba(253, 203, 110, 0.15)', color: 'var(--status-warning)', border: '1px solid rgba(253, 203, 110, 0.3)' };
                    } else if (t.status === 'pending_resolution') {
                      statusLabel = 'PENDING';
                      badgeStyle = { background: 'rgba(108, 117, 125, 0.15)', color: 'var(--text-muted)', border: '1px solid rgba(108, 117, 125, 0.3)' };
                    } else {
                      statusLabel = 'RUNNING';
                      badgeStyle = { background: 'var(--status-info-soft)', color: 'var(--info)', border: '1px solid var(--status-info-soft)' };
                    }

                    let bridgingData = {};
                    try {
                      bridgingData = JSON.parse(t.bridging_config_json || '{}');
                    } catch (e) {}

                    let vsoData = {};
                    try {
                      vsoData = JSON.parse(t.vso_config_json || '{}');
                    } catch (e) {}

                    let audioData = {};
                    try {
                      audioData = JSON.parse(t.audio_config_json || '{}');
                    } catch (e) {}

                    return (
                      <div
                        key={t.id}
                        className="card"
                        style={{ cursor: 'pointer', transition: 'all 0.2s ease', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-sm)' }}
                        onClick={() => setExpandedTaskId(isExpanded ? null : t.id)}
                      >
                        {/* Task Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '1.1rem' }}>🔗</span>
                              <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                                {(() => {
                                  let productSnapshot = {};
                                  try {
                                    productSnapshot = typeof t.product_snapshot_json === 'string' ? JSON.parse(t.product_snapshot_json) : (t.product_snapshot_json || {});
                                  } catch (_) {}
                                  const assetTitle = t.asset_niche || t.asset_caption || 'Blueprint Video';
                                  const productName = productSnapshot.product_name || bridgingData.manualProductName || t.target_product_url || 'Manual Input Product';
                                  const shortId = t.id ? `#${t.id.replace('mtk_', '').slice(0, 4)}` : '';
                                  return `${assetTitle} ➜ ${productName} (${shortId})`;
                                })()}
                              </strong>
                              <span style={{
                                fontSize: '0.68rem',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontWeight: 'bold',
                                textTransform: 'uppercase',
                                ...badgeStyle
                              }}>
                                {statusLabel}
                              </span>
                              {t.is_synced ? (
                                <span style={{
                                  fontSize: '0.68rem',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontWeight: 'bold',
                                  textTransform: 'uppercase',
                                  background: 'rgba(52,211,153,0.15)',
                                  color: 'var(--status-success)',
                                  border: '1px solid rgba(52,211,153,0.3)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  🔗 Synced to ContentFlow
                                </span>
                              ) : null}
                            </div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>ID: {t.id}</span>
                          </div>

                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {t.created_at ? new Date(t.created_at).toLocaleString('id-ID') : ''}
                          </div>
                        </div>

                        {/* Metadata Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                          <div>
                            <strong>Template Blueprint:</strong>{' '}
                            <span style={{ color: 'var(--info)', wordBreak: 'break-all' }}>
                              {t.asset_source_url ? t.asset_source_url.substring(0, 50) + '...' : 'Blueprint Asset'}
                            </span>
                          </div>
                          {t.affiliate_url && (
                            <div>
                              <strong>Affiliate URL:</strong>{' '}
                              <span style={{ color: 'var(--text-muted)', wordBreak: 'break-all' }}>{t.affiliate_url}</span>
                            </div>
                          )}
                          <div>
                            <strong>Metode Bridging:</strong>{' '}
                            <span>{bridgingData.isBridgingActive ? `${bridgingData.promotionStyle || 'Softselling'} (Klip ${bridgingData.bridgeAtClip || 2} dari ${bridgingData.targetClipsCount || 4})` : 'Nonaktif'}</span>
                          </div>
                          <div>
                            <strong>Konfigurasi Visual:</strong>{' '}
                            <span>VSO: {vsoData.isVsoActive ? 'Aktif' : 'Nonaktif'} | {vsoData.aspectRatio || '9:16'} | {vsoData.videoModel || 'veo_31_lite'}</span>
                          </div>
                          <div>
                            <strong>Konfigurasi Audio:</strong>{' '}
                            <span>TTS: {audioData.enableTts ? (audioData.voicePersona || 'Indonesian_SweetGirl') : 'Nonaktif'} | FFmpeg: {audioData.enableFfmpeg ? 'Smart Sync' : 'Nonaktif'}</span>
                          </div>
                        </div>

                        {/* Action Buttons — rata KIRI */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-start', borderTop: '1px solid var(--surface-interactive)', paddingTop: '12px' }} onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => setExpandedTaskId(isExpanded ? null : t.id)}
                            style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                          >
                            🔍 Detail
                          </button>

                          <button
                            onClick={() => handleToggleTaskStatus(t.id, t.status)}
                            className="btn btn-sm"
                            style={{
                              color: (t.status === 'paused' || t.status === 'failed') ? 'var(--success)' : 'var(--danger)',
                              background: (t.status === 'paused' || t.status === 'failed') ? 'var(--status-success-soft)' : 'var(--status-danger-soft)',
                              borderColor: (t.status === 'paused' || t.status === 'failed') ? 'var(--status-success-soft)' : 'var(--status-danger-soft)',
                              fontSize: '0.75rem',
                              padding: '6px 12px'
                            }}
                          >
                            {(t.status === 'paused' || t.status === 'failed') ? '▶️ Resume' : '⏸️ Pause'}
                          </button>

                          {t.asset_source_url && (
                            <a
                              href={t.asset_source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-secondary btn-sm"
                              style={{ textDecoration: 'none', fontSize: '0.75rem', padding: '6px 12px' }}
                            >
                              📊 Template
                            </a>
                          )}

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleCopyTaskSettings(t)}
                            style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                          >
                            📋 Copy
                          </button>

                          <button
                            onClick={() => handleDelete(t.id)}
                            className="btn btn-danger btn-sm"
                            style={{ background: '#dc2626', color: 'var(--text-primary)', borderColor: '#dc2626', fontSize: '0.75rem', padding: '6px 12px' }}
                          >
                            🗑 Hapus
                          </button>
                        </div>

                        {/* Task Detail Expanded */}
                        {isExpanded && (() => {
                          const activeTab = activeTabs[t.id] || 'concept';
                          const handleSelectTab = (tabId) => {
                            setActiveTabs(prev => ({ ...prev, [t.id]: tabId }));
                          };

                          return (
                            <div style={{ padding: '16px 0 0 0', borderTop: '1px solid var(--border)', background: 'transparent', marginTop: '16px' }} onClick={e => e.stopPropagation()}>

                              {/* Visual Player if finished */}
                              {t.status === 'completed' && t.ffmpeg_output_path && (
                                <div style={{ marginBottom: 16 }}>
                                  <video
                                    src={t.ffmpeg_output_path}
                                    controls
                                    style={{ width: '100%', borderRadius: 'var(--radius-sm)', background: '#000', maxHeight: 320 }}
                                  />
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                                    {t.nextcloud_video_url && (
                                      <a
                                        href={t.nextcloud_video_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-secondary"
                                        style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                      >
                                        ☁️ Nextcloud Video
                                      </a>
                                    )}
                                    {t.nextcloud_md_url && (
                                      <a
                                        href={t.nextcloud_md_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-secondary"
                                        style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                      >
                                        📝 Nextcloud Narrative (.md)
                                      </a>
                                    )}
                                    <a
                                      href={t.ffmpeg_output_path}
                                      download
                                      className="btn btn-primary"
                                      style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                                    >
                                      📥 Download Video Final
                                    </a>
                                  </div>
                                </div>
                              )}

                              {/* Tabs Navigation */}
                              <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '16px', overflowX: 'auto' }}>
                                {[
                                  { id: 'concept', label: '💡 Konsep Awal & Produk' },
                                  { id: 'storyboard', label: '📖 Storyboard' },
                                  { id: 'voiceover', label: '🎤 Voiceover' },
                                  { id: 'prompts', label: '🤖 AI Video Prompt' },
                                  { id: 'social', label: '📱 Social Draft' },
                                  { id: 'logs', label: '🖥 System Log' }
                                ].map(tab => (
                                  <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => handleSelectTab(tab.id)}
                                    className="btn"
                                    style={{
                                      fontSize: '0.78rem',
                                      padding: '6px 12px',
                                      borderRadius: 4,
                                      border: activeTab === tab.id ? '1px solid var(--accent)' : '1px solid transparent',
                                      background: activeTab === tab.id ? 'var(--accent-glow)' : 'transparent',
                                      color: activeTab === tab.id ? 'var(--accent-light)' : 'var(--text-secondary)',
                                      fontWeight: activeTab === tab.id ? '600' : 'normal',
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {tab.label}
                                  </button>
                                ))}
                              </div>

                              {/* Tab Content 1: concept */}
                              {activeTab === 'concept' && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>

                                  {/* Left Column: Template Blueprint details */}
                                  <div style={{ background: 'var(--surface-interactive)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <strong style={{ fontSize: '0.85rem', color: 'var(--accent-light)', borderBottom: '1px solid var(--surface-interactive)', paddingBottom: 6 }}>
                                      📹 Detail Template Blueprint
                                    </strong>
                                    <div>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>Tautan Asal</div>
                                      <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                                        {t.asset_source_url ? (
                                          <a href={t.asset_source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info)' }}>
                                            {t.asset_source_url} ↗
                                          </a>
                                        ) : '-'}
                                      </span>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>Tags Aset</div>
                                      <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                                        {(() => {
                                          const matchingAsset = assets.find(a => a.id === t.deconstruct_asset_id);
                                          if (matchingAsset && matchingAsset.tags) {
                                            return matchingAsset.tags.split(',').map((tag, tIdx) => (
                                              <span key={tIdx} style={{ display: 'inline-block', background: 'var(--surface-interactive)', padding: '2px 6px', borderRadius: 4, marginRight: 6, fontSize: '0.7rem' }}>
                                                #{tag.trim()}
                                              </span>
                                            ));
                                          }
                                          return '-';
                                        })()}
                                      </span>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>Visual Style</div>
                                      <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>{vsoData.visualStyle || '-'}</span>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>Narrative Mode</div>
                                      <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>{vsoData.narrativeMode || '-'}</span>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>Face Visibility</div>
                                      <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>{vsoData.faceVisibility || '-'}</span>
                                    </div>
                                  </div>

                                  {/* Right Column: Target Product & Bridging details */}
                                  <div style={{ background: 'var(--surface-interactive)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <strong style={{ fontSize: '0.85rem', color: 'var(--accent-light)', borderBottom: '1px solid var(--surface-interactive)', paddingBottom: 6 }}>
                                      🛍️ Target Produk & Bridging
                                    </strong>
                                    <div>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>Tautan Produk Target</div>
                                      <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                                        {t.target_product_url ? (
                                          <a href={t.target_product_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info)' }}>
                                            {t.target_product_url} ↗
                                          </a>
                                        ) : 'Input Manual'}
                                      </span>
                                    </div>
                                    {t.affiliate_url && (
                                      <div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>Affiliate URL</div>
                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{t.affiliate_url}</span>
                                      </div>
                                    )}
                                    <div>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>Visual Mode</div>
                                      <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                                        {bridgingData.visualMode === 'hybrid_lock' ? 'Double-Pass Pixel Lock (T2I ➜ I2V)' : 'Pure Text-to-Video'}
                                      </span>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>Gaya Promosi</div>
                                      <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                                        {bridgingData.isBridgingActive ? `${bridgingData.promotionStyle || 'Softselling'} (Klip ${bridgingData.bridgeAtClip || 2} durasi ${bridgingData.bridgeDurationClips || 1} klip)` : 'Nonaktif'}
                                      </span>
                                    </div>

                                    {/* Ref Image if present */}
                                    {bridgingData.productRefImagePath && (
                                      <div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>Gambar Referensi Produk</div>
                                        <img
                                          src={bridgingData.productRefImagePath}
                                          alt="Referensi Produk"
                                          style={{ maxWidth: '100%', maxHeight: '100px', borderRadius: 4, border: '1px solid var(--border)' }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Tab Content 2: storyboard */}
                              {activeTab === 'storyboard' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                  {t.remake_storyboard_json ? (
                                    JSON.parse(t.remake_storyboard_json).map((scene, sIdx) => (
                                      <div key={sIdx} style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 6, border: '1px solid var(--surface-interactive)' }}>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                                          Adegan {scene.scene || sIdx + 1}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.4 }}>
                                          <b>Visual:</b> {scene.visual_description}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.4 }}>
                                          <b>Voiceover:</b> "{scene.narration_transcript || scene.voiceover || '-'}"
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                      Storyboard belum digenerate (Status: {t.status.replace('_', ' ')}).
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Tab Content: voiceover */}
                              {activeTab === 'voiceover' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                  {(() => {
                                    const aConfig = JSON.parse(t.audio_config_json || '{}');
                                    return (
                                      <>
                                        <div style={{ background: 'var(--bg-secondary)', padding: 14, borderRadius: 6, border: '1px solid var(--surface-interactive)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                                            🎙️ Voiceover & Sound Settings
                                          </div>
                                          <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                                            <div><b>Status TTS:</b> {aConfig.enableTts ? '⚡ Aktif' : '❌ Nonaktif'}</div>
                                            <div><b>Provider:</b> {aConfig.voiceProvider || 'minimax'}</div>
                                            <div><b>Persona:</b> {aConfig.voicePersona || 'Indonesian_SweetGirl'}</div>
                                            <div><b>Speed:</b> {aConfig.voiceSpeed || 1.0}x</div>
                                          </div>
                                          {aConfig.combined_audio_path && (
                                            <div style={{ marginTop: 8 }}>
                                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Audio Voiceover Gabungan:</div>
                                              <audio controls src={aConfig.combined_audio_path} style={{ width: '100%', height: 36, borderRadius: 4 }} />
                                            </div>
                                          )}
                                        </div>

                                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: 4 }}>
                                          📜 Transkrip Naskah Suara Per Adegan
                                        </div>
                                        {t.remake_storyboard_json ? (
                                          JSON.parse(t.remake_storyboard_json).map((scene, sIdx) => (
                                            <div key={sIdx} style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 6, border: '1px solid var(--surface-interactive)' }}>
                                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--info)', marginBottom: 4 }}>
                                                Adegan {scene.scene || sIdx + 1}
                                              </div>
                                              <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontStyle: 'italic', lineHeight: 1.4 }}>
                                                "{scene.narration_transcript || scene.voiceover || '-'}"
                                              </div>
                                            </div>
                                          ))
                                        ) : (
                                          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                            Transkrip belum tersedia.
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              )}

                              {/* Tab Content 3: prompts */}
                              {activeTab === 'prompts' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                  {t.t2i_i2v_prompts_json ? (
                                    JSON.parse(t.t2i_i2v_prompts_json).map((pObj, pIdx) => (
                                      <div key={pIdx} style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 6, border: '1px solid var(--surface-interactive)' }}>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                                          Klip {pObj.scene || pIdx + 1}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                          {pObj.t2v_prompt && <div><b>T2V Prompt:</b> <span style={{ color: 'var(--text-primary)' }}>{pObj.t2v_prompt}</span></div>}
                                          {pObj.t2i_prompt && <div><b>T2I Prompt:</b> <span style={{ color: 'var(--text-primary)' }}>{pObj.t2i_prompt}</span></div>}
                                          {pObj.i2v_prompt && <div><b>I2V Motion:</b> <span style={{ color: 'var(--text-primary)' }}>{pObj.i2v_prompt}</span></div>}
                                          {!pObj.t2v_prompt && !pObj.t2i_prompt && !pObj.i2v_prompt && <div style={{ color: 'var(--text-muted)' }}>Tidak ada prompt visual untuk klip ini.</div>}
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                      Visual prompts belum digenerate (Status: {t.status.replace('_', ' ')}).
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Tab Content 4: social */}
                              {activeTab === 'social' && (
                                <div>
                                  {t.new_caption ? (
                                    <pre style={{
                                      background: 'var(--bg-secondary)', padding: 16, borderRadius: 6, fontSize: '0.8rem',
                                      color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0,
                                      border: '1px solid var(--surface-interactive)', lineHeight: 1.5
                                    }}>
                                      {t.new_caption}
                                    </pre>
                                  ) : (
                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                      Caption belum digenerate (Status: {t.status.replace('_', ' ')}).
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Tab Content 5: logs */}
                              {activeTab === 'logs' && (
                                <pre style={{
                                  background: 'var(--surface)', padding: '16px', borderRadius: 6, fontSize: '0.78rem',
                                  color: '#20c20e', fontFamily: 'var(--font-mono)', margin: 0,
                                  border: '1px solid var(--border)', maxHeight: '250px', overflowY: 'auto',
                                  lineHeight: 1.5, whiteSpace: 'pre-wrap'
                                }}>
                                  {(() => {
                                    const filtered = terminalLogs
                                      .split('\n')
                                      .filter(line => line.includes(t.id))
                                      .join('\n');
                                    return filtered || `Belum ada log sistem yang tercatat untuk Task ID: ${t.id}.`;
                                  })()}
                                </pre>
                              )}

                              {/* Processing Progress Status */}
                              {t.status !== 'completed' && t.status !== 'failed' && (
                                <div style={{ padding: 12, textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: 6, marginTop: 16 }}>
                                  <div className="spinner" style={{ width: 16, height: 16, margin: '0 auto 8px' }}></div>
                                  <span style={{ fontSize: '0.78rem', color: 'var(--info)' }}>
                                    {t.status === 'pending_resolution' && 'Menunggu antrean resolusi produk...'}
                                    {t.status === 'resolving_product' && 'Mengekstrak DNA & data produk target...'}
                                    {t.status === 'remaking' && 'Menggunakan Gemini AI untuk remake storyboard...'}
                                    {t.status === 'generating_audio' && 'Merender voiceover TTS (MiniMax)...'}
                                    {t.status === 'generating_visuals' && 'Merender visual adegan video (G-Labs)...'}
                                    {t.status === 'ffmpeg_muxing' && 'Menggabungkan audio-video final (FFmpeg)...'}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                  {tasks.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 40, border: '2px dashed var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      Belum ada antrean task multiplier yang dijalankan.
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

        </div>
      </main>

      {/* Blueprint Detail Modal */}
      {showPreviewModal && previewAsset && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1100, padding: 20
        }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
            maxWidth: 800, width: '100%', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  🎬 Detail Blueprint Video
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ID: {previewAsset.id}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewAsset(null);
                }}
                style={{
                  border: 'none', background: 'var(--surface-interactive)', color: 'var(--text-muted)',
                  fontSize: '0.8rem', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border)'
                }}
              >
                ❌ Tutup
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Asset Metadata */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, background: 'var(--surface-interactive)', padding: 16, borderRadius: 8 }}>
                <div>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>URL Sumber</strong>
                  <a href={previewAsset.source_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.82rem', color: 'var(--accent)', wordBreak: 'break-all' }}>
                    {previewAsset.source_url}
                  </a>
                </div>
                <div>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Niche / Kategori</strong>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>{previewAsset.niche || 'General'}</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Pola Viral (Summary)</strong>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{previewAsset.viral_pattern_summary || '-'}</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Tags</strong>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{previewAsset.tags || '-'}</span>
                </div>
              </div>

              {/* Storyboard Detail */}
              <div>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: 12, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                  📖 Storyboard & Scene ({previewAsset.storyboard?.length || 0} Scene)
                </h4>
                {previewAsset.storyboard && previewAsset.storyboard.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {previewAsset.storyboard.map((scene, idx) => (
                      <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: 'var(--bg-secondary)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontWeight: 'bold', fontSize: '0.78rem', color: 'var(--accent)' }}>Scene #{idx + 1}</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>⏱ Durasi: {scene.duration_seconds || scene.duration || 3}s</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '0.78rem' }}>
                          <div>
                            <strong style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Visual Action Prompt:</strong>
                            <p style={{ margin: 0, color: 'var(--text-primary)' }}>{scene.visual_action_prompt || scene.visual_prompt}</p>
                          </div>
                          <div>
                            <strong style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Voice-Over (Script):</strong>
                            <p style={{ margin: 0, color: 'var(--text-primary)', fontStyle: 'italic' }}>"{scene.voiceover_script || scene.voiceover}"</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>Tidak ada data storyboard detail.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Alert */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
          background: toast.type === 'error' ? 'var(--danger)' : 'var(--success)',
          color: 'var(--text-primary)', padding: '12px 24px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600,
          boxShadow: '0 4px 12px var(--overlay-subtle)', display: 'flex', alignItems: 'center', gap: 8
        }}>
          <span>{toast.type === 'error' ? '⚠️' : '✓'}</span>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

export default function MultiplierLabPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-main)', color: 'var(--text-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: 40, height: 40, border: '4px solid var(--border-subtle)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ marginTop: 16, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Memuat Multiplier Lab...</p>
        </div>
      </div>
    }>
      <MultiplierLabPageContent />
    </Suspense>
  );
}
