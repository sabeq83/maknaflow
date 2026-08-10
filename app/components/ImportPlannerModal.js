'use client';

import { useState, useEffect } from 'react';
import { resolvePlannerInstructions } from '@/lib/prompt-instructions';

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

export default function ImportPlannerModal({
  isOpen,
  onClose,
  initialPlannerId = '',
  onSuccess
}) {
  const [planners, setPlanners] = useState([]);
  const [selectedPlannerId, setSelectedPlannerId] = useState(initialPlannerId);
  const [planner, setPlanner] = useState(null);
  const [rows, setRows] = useState([]);
  const [selectedRowIds, setSelectedRowIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatusTarget, setSubmitStatusTarget] = useState('running');
  const [activeAccordion, setActiveAccordion] = useState(0);

  // Form State Aligning with Mass OPC & SC
  const [campaignName, setCampaignName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [brandProfiles, setBrandProfiles] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [nextcloudParentFolder, setNextcloudParentFolder] = useState('/MAKNA_Assets');
  const [customInstruction, setCustomInstruction] = useState('');
  const [aiDirective, setAiDirective] = useState('Konten edukasi brand; jangan mengarang atau membahas produk tertentu.');
  const [mandatoryOutroLine, setMandatoryOutroLine] = useState('jangan lupa follow dan komen mau ya!');

  // Accordion 1: Strategy & Compliance
  const [narrativeMode, setNarrativeMode] = useState('auto'); // 'auto' | 'Storytelling' | 'Promo Hard Sell' | 'Educational Review'
  const [sfxSetting, setSfxSetting] = useState('without_sfx');
  const [enableVoAudit, setEnableVoAudit] = useState(1);
  const [enableAudioSegment, setEnableAudioSegment] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('id-ID');
  const [voiceProvider, setVoiceProvider] = useState('minimax');

  // Product Data from Planner
  const [productName, setProductName] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [productUsp, setProductUsp] = useState('');
  const [productRefImage, setProductRefImage] = useState('');

  // Accordion 2: Aesthetics & Veo Engine Settings
  const [visualStyle, setVisualStyle] = useState('Cinematic');
  const [targetAi, setTargetAi] = useState('Google Veo (8s)');
  const [videoModel, setVideoModel] = useState('veo_31_lite');
  const [clipDuration, setClipDuration] = useState(8); // 4, 6, 8, 10
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [targetDemographic, setTargetDemographic] = useState('genz_casual');
  const [targetDemographicCustom, setTargetDemographicCustom] = useState('');
  const [faceVisibility, setFaceVisibility] = useState('Faceless'); // 'Faceless' | 'POV' | 'Silhouette' | 'cartoon_face'
  const [targetClipsCount, setTargetClipsCount] = useState(3); // Isian bebas number
  const [wordsPerClip, setWordsPerClip] = useState('20-22 kata');
  const [visualMode, setVisualMode] = useState('pure_t2v'); // 'hybrid_lock' | 'pure_t2v'
  const [executionMode, setExecutionMode] = useState('full_autopilot');
  const [enableTts, setEnableTts] = useState(true);
  const [enableGlabs, setEnableGlabs] = useState(true);
  const [enableFfmpeg, setEnableFfmpeg] = useState(true);
  const [enableSocialPost, setEnableSocialPost] = useState(false);
  const [voicePersona, setVoicePersona] = useState('Indonesian_casual_reporter_vv2');
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [voiceVolume, setVoiceVolume] = useState(1.0);
  const [syncMode, setSyncMode] = useState('auto');
  const [ffmpegSyncOption, setFfmpegSyncOption] = useState('smart_sync');
  const [ffmpegVideoScale, setFfmpegVideoScale] = useState(1.0);

  // Accordion 3: Product Bridging Settings
  const [isBridgingActive, setIsBridgingActive] = useState(true);
  const [bridgeAtClip, setBridgeAtClip] = useState(2); // Isian bebas number
  const [bridgeDurationClips, setBridgeDurationClips] = useState(1);
  const [bridgingMode, setBridgingMode] = useState('manual_input'); // 'manual_input' | 'select_existing' | 'url_extract'

  // Accordion 4: Visual Swap Overrides (100% Copy Persis dari Mass OPC app/pillar-campaigns/page.js)
  const [isVsoActive, setIsVsoActive] = useState(false);
  const [characterConcept, setCharacterConcept] = useState('faceless');
  const [subjectDemographic, setSubjectDemographic] = useState('syari_classic');
  const [wardrobeStyle, setWardrobeStyle] = useState('amber_terracotta');
  const [wardrobeStyleCustom, setWardrobeStyleCustom] = useState('');
  const [lightingStyle, setLightingStyle] = useState('window_daylight');
  const [lightingStyleCustom, setLightingStyleCustom] = useState('');
  const [visualStylePreset, setVisualStylePreset] = useState('3d_claymation_cozy');

  // Campaign Presets States
  const [presets, setPresets] = useState([]);
  const [selectedPresetKey, setSelectedPresetKey] = useState('');
  const [showPresetSaveModal, setShowPresetSaveModal] = useState(false);
  const [newPresetLabel, setNewPresetLabel] = useState('');
  const [newPresetKey, setNewPresetKey] = useState('');
  const [user, setUser] = useState(null);

  // States for Character Reference Lock (Tahap 2.5)
  const [manifest, setManifest] = useState(null);
  const [characterStatuses, setCharacterStatuses] = useState({});

  useEffect(() => {
    if (planner && planner.content_world === 'cartoon_universe') {
      const profile = planner.universe_profile || 'pawville';
      fetch(`/api/v2/cartoon-universe/manifest?profile=${profile}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.manifest) {
            setManifest(data.manifest);
            const statuses = {};
            Object.keys(data.manifest.characters).forEach(key => {
              const char = data.manifest.characters[key];
              statuses[key] = {
                available: char.available,
                previewUrl: char.identity_reference_path,
                version: char.version
              };
            });
            setCharacterStatuses(statuses);
            
            // Force visual_mode to hybrid_lock
            setVisualMode('hybrid_lock');
          }
        })
        .catch(err => console.error('[ImportPlannerModal] Fetch manifest error:', err));
    } else {
      setManifest(null);
      setCharacterStatuses({});
    }
  }, [planner]);

  const getUsedCharacters = () => {
    if (!planner || !rows || rows.length === 0) return [];
    const selectedRows = rows.filter(r => selectedRowIds.includes(r.id));
    const used = new Set();
    selectedRows.forEach(r => {
      if (r.main_character) {
        const clean = r.main_character.trim().toLowerCase();
        if (clean === 'mochi') used.add('mochi');
        else if (clean === 'dr. paw' || clean === 'dr paw') used.add('dr_paw');
        else if (clean === 'coco') used.add('coco');
        else if (clean === 'boba') used.add('boba');
        else if (clean === 'tofu') used.add('tofu');
      }
      if (r.supporting_characters) {
        r.supporting_characters.split(',').forEach(c => {
          const clean = c.trim().toLowerCase();
          if (clean === 'mochi') used.add('mochi');
          else if (clean === 'dr. paw' || clean === 'dr paw') used.add('dr_paw');
          else if (clean === 'coco') used.add('coco');
          else if (clean === 'boba') used.add('boba');
          else if (clean === 'tofu') used.add('tofu');
        });
      }
    });
    return Array.from(used);
  };

  const handleUploadCharacterRef = async (charKey, file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('universe_profile', planner.universe_profile || 'pawville');
    formData.append('character_id', charKey);
    
    try {
      const res = await fetch('/api/v2/cartoon-universe/manifest', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setCharacterStatuses(prev => ({
          ...prev,
          [charKey]: {
            ...prev[charKey],
            available: true,
            previewUrl: data.path
          }
        }));
      } else {
        alert('Gagal mengunggah gambar referensi: ' + data.error);
      }
    } catch (err) {
      alert('Error: ' + err.message);
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

    // Accordion 1: Strategy & Compliance
    if (config.basic_strategy) {
      setNarrativeMode(config.basic_strategy.narrative_mode || 'auto');
      setVoiceProvider(config.basic_strategy.voice_provider || 'minimax');
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
    }

    // Accordion 2: Aesthetics & Veo Engine Settings
    if (config.visual_engine) {
      setVisualStyle(config.visual_engine.visual_style || 'Cinematic');
      setVisualMode(executionMode === 'full_autopilot' ? 'pure_t2v' : (config.visual_engine.visual_mode || 'pure_t2v'));
      setVideoModel(config.visual_engine.video_model || 'veo_31_lite');
      setFaceVisibility(config.visual_engine.face_visibility || 'Faceless');
      setTargetClipsCount(Number(config.visual_engine.target_clips_count ?? 3));
      setWordsPerClip(config.visual_engine.words_per_clip || '20-22 kata');
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
      setCharacterConcept(config.visual_swap.character_concept || 'faceless');
      setSubjectDemographic(config.visual_swap.subject_demographic || 'syari_classic');
      setWardrobeStyle(config.visual_swap.wardrobe_style || 'amber_terracotta');
      setWardrobeStyleCustom(config.visual_swap.wardrobe_style_custom || '');
      setLightingStyle(config.visual_swap.lighting_style || 'window_daylight');
      setLightingStyleCustom(config.visual_swap.lighting_style_custom || '');
      setVisualStylePreset(config.visual_swap.visual_style_preset || '3d_claymation_cozy');
    }
  };

  const handleSaveAsPreset = async (e) => {
    e.preventDefault();
    if (!newPresetLabel.trim() || !newPresetKey.trim()) {
      alert('Label dan Key preset wajib diisi.');
      return;
    }

    const presetConfig = {
      basic_strategy: {
        narrative_mode: narrativeMode,
        voice_provider: voiceProvider,
        voice_persona: 'Kore',
        voice_speed: 1.0,
        voice_volume: 1.0,
        tts_model_quality: 'speech-2.8-turbo',
        target_language: targetLanguage,
        target_demographic: targetDemographic,
        target_demographic_custom: targetDemographicCustom,
        custom_instruction: customInstruction,
        ai_directive: aiDirective,
        mandatory_outro_line: mandatoryOutroLine,
        sfx_setting: sfxSetting,
        enable_audio_segment: enableAudioSegment,
        enable_vo_audit: enableVoAudit,
        nextcloud_parent_folder: nextcloudParentFolder,
        promotion_style: 'Softselling'
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
        visual_style_preset: visualStylePreset
      },
      workflow: {
        enable_tts: true,
        enable_glabs: true,
        enable_ffmpeg: true,
        enable_social_post: false,
        upload_markdown: true,
        upload_spreadsheet: true,
        ffmpeg_sync_option: 'smart_sync',
        ffmpeg_video_scale: 1.0,
        ffmpeg_sfx_volume: 0.0,
        ffmpeg_bgm_volume: 0.0,
        facebook_page_id: '',
        facebook_server_url: ''
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

      alert(`Preset "${newPresetLabel}" berhasil disimpan.`);
      setShowPresetSaveModal(false);
      setNewPresetLabel('');
      setNewPresetKey('');
      fetchPresets();
    } catch (err) {
      alert(err.message);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPlanners();
      fetchBrandProfiles();
      fetchPresets();

      fetch('/api/auth/me')
        .then(r => r.json())
        .then(u => {
          if (u.authenticated) setUser(u.user);
        })
        .catch(() => {});

      if (initialPlannerId) {
        setSelectedPlannerId(initialPlannerId);
        loadPlannerDetail(initialPlannerId);
      }
    }
  }, [isOpen, initialPlannerId]);

  async function fetchPlanners() {
    try {
      const res = await fetch('/api/content-planner');
      const data = await res.json();
      if (data.success) {
        setPlanners(data.planners || []);
      }
    } catch (e) {
      console.error('[ImportPlannerModal] Fetch planners error:', e);
    }
  }

  async function fetchBrandProfiles() {
    try {
      const res = await fetch('/api/v2/brand-profiles');
      if (res.ok) {
        const data = await res.json();
        setBrandProfiles(data.data || []);
      }
    } catch (_) {}
  }

  useEffect(() => {
    if (!planner || brandProfiles.length === 0) return;
    const match = planner.brand_id
      ? brandProfiles.find(profile => profile.id === planner.brand_id)
      : brandProfiles.find(profile => profile.brand_name?.trim().toLowerCase() === planner.account_name?.trim().toLowerCase());
    if (match) {
      setSelectedBrandId(match.id);
      setAccountName(match.brand_name);
      if (match.nextcloud_target_folder) {
        setNextcloudParentFolder(match.nextcloud_target_folder);
      }
    }
  }, [planner, brandProfiles]);

  async function loadPlannerDetail(id) {
    if (!id) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/content-planner/${id}`);
      const data = await res.json();
      if (data.success && data.planner) {
        const p = data.planner;
        setPlanner(p);
        const rList = p.rows || [];
        setRows(rList);
        setSelectedRowIds(rList.map(r => r.id));
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
        const acc = p.account_name || 'Umum';
        setCampaignName(`[ OPC ${dateStr} ] - ${acc} - ${p.title || p.product_name || ''}`);
        setAccountName(acc);
        setProductName(p.product_name || '');
        setProductDesc(p.product_description || '');
        setProductUsp(p.product_usp || '');
        setProductRefImage(p.product_ref_image || p.product_photo_url || '');
        if (p.planner_focus === 'brand_editorial') {
          setIsBridgingActive(false);
        } else {
          setIsBridgingActive(true);
        }
        setCustomInstruction('');
        setAiDirective('Konten edukasi brand; jangan mengarang atau membahas produk tertentu.');
        const instructions = resolvePlannerInstructions(p);
        setMandatoryOutroLine(instructions.mandatoryOutroLine || 'jangan lupa follow dan komen mau ya!');
        if (p.target_audience) {
          setTargetDemographic(p.target_audience);
        }

        if (p.brand_id) setSelectedBrandId(p.brand_id);
      }
    } catch (e) {
      console.error('[ImportPlannerModal] Load planner detail error:', e);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectPlanner(id) {
    setSelectedPlannerId(id);
    if (id) loadPlannerDetail(id);
    else {
      setPlanner(null);
      setRows([]);
      setSelectedRowIds([]);
      setAccountName('');
      setProductName('');
      setProductDesc('');
      setProductUsp('');
      setProductRefImage('');
      setCustomInstruction('');
      setAiDirective('');
      setMandatoryOutroLine('');
    }
  }

  function toggleRowSelection(rowId) {
    setSelectedRowIds(prev =>
      prev.includes(rowId) ? prev.filter(id => id !== rowId) : [...prev, rowId]
    );
  }

  function toggleAllRows() {
    if (selectedRowIds.length === rows.length) {
      setSelectedRowIds([]);
    } else {
      setSelectedRowIds(rows.map(r => r.id));
    }
  }

  async function handleSubmit(e, targetStatus = 'running') {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedPlannerId) {
      alert('Pilih Content Planner terlebih dahulu');
      return;
    }
    if (selectedRowIds.length === 0) {
      alert('Pilih setidaknya 1 baris strategi konten untuk di-ingest');
      return;
    }

    if (planner && planner.content_world === 'cartoon_universe') {
      const usedChars = getUsedCharacters();
      const missing = usedChars.filter(charKey => {
        const status = characterStatuses[charKey];
        return !status || !status.available;
      });
      if (missing.length > 0) {
        alert(`Produksi diblokir: Karakter wajib berikut belum memiliki reference image kanonis: ${missing.map(m => m.toUpperCase()).join(', ')}.`);
        return;
      }
    }

    try {
      setSubmitting(true);
      setSubmitStatusTarget(targetStatus);
      const payload = {
        planner_id: selectedPlannerId,
        selected_row_ids: selectedRowIds,
        campaign_name: campaignName,
        global_settings: {
          status: targetStatus,
          execution_mode: executionMode,
          brand_profile_id: selectedBrandId || null,
          account_name: accountName || null,
          custom_instruction: customInstruction,
          ai_directive: aiDirective,
          mandatory_outro_line: mandatoryOutroLine,
          narrative_mode: narrativeMode,
          visual_style: visualStyle,
          target_ai: videoModel === 'omni_flash' ? 'Google Veo Omni Flash' : targetAi,
          video_model: videoModel,
          clip_duration: Number(clipDuration),
          aspect_ratio: aspectRatio,
          face_visibility: faceVisibility,
          target_clips_count: Number(targetClipsCount),
          words_per_clip: wordsPerClip,
          visual_mode: planner?.content_world === 'cartoon_universe' ? 'hybrid_lock' : (executionMode === 'full_autopilot' ? 'pure_t2v' : visualMode),
          scheduler_pause_at: executionMode === 'full_autopilot' ? null : 'tts',
          is_bridging_active: isBridgingActive ? 1 : 0,
          bridge_at_clip: Number(bridgeAtClip),
          bridge_duration_clips: Number(bridgeDurationClips),
          bridging_mode: bridgingMode,
          product_ref_image_path: productRefImage || null,
          enable_vo_audit: enableVoAudit,
          enable_audio_segment: enableAudioSegment ? 1 : 0,
          sfx_setting: sfxSetting,
          voice_provider: voiceProvider,
          target_language: targetLanguage,
          target_demographic: targetDemographic,
          target_demographic_custom: targetDemographicCustom,
          nextcloud_parent_folder: nextcloudParentFolder.trim(),
          enable_tts: enableTts ? 1 : 0,
          enable_glabs: enableGlabs ? 1 : 0,
          enable_ffmpeg: enableFfmpeg ? 1 : 0,
          enable_social_post: enableSocialPost ? 1 : 0,
          voice_persona: voicePersona,
          voice_speed: voiceSpeed,
          voice_volume: voiceVolume,
          ffmpeg_sync_option: ffmpegSyncOption,
          ffmpeg_video_scale: Number(ffmpegVideoScale),
          ffmpeg_sfx_volume: 0.0,
          ffmpeg_bgm_volume: 0.0,
          target_spreadsheet_id: '',
          visual_overrides_json: isVsoActive ? JSON.stringify({
            is_vso_active: true,
            character_concept: characterConcept,
            subject_demographic: subjectDemographic,
            wardrobe_style: wardrobeStyle === 'custom' ? wardrobeStyleCustom : wardrobeStyle,
            lighting_style: lightingStyle === 'custom' ? lightingStyleCustom : lightingStyle,
            visual_style_preset: visualStylePreset
          }) : null
        }
      };

      const res = await fetch('/api/v2/pillar-campaigns/ingest-planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        if (onSuccess) onSuccess({ ...data, status: targetStatus });
        onClose();
      } else {
        alert('Gagal mengimpor planner: ' + (data.error || 'Terjadi kesalahan'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999
    }}>
      <div style={{
        background: '#121318', border: '1px solid #27272a', borderRadius: '16px',
        width: '100%', maxWidth: '820px', maxHeight: '92vh', overflowY: 'auto', padding: '28px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)', color: '#f3f4f6'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🌱</span> Impor Content Planner ke Organic Pillar (OPC)
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '20px', cursor: 'pointer' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Top Mode Header Banner */}
          <div style={{
            padding: '12px 16px', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: '10px', marginBottom: '16px', color: '#818cf8', fontWeight: 700, fontSize: '13px',
            display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <span>📊 Mode Impor Content Planner Master ke Engine Produksi Autopilot OPC</span>
          </div>

          {/* EXECUTION MODE SWITCHER (Full Auto Pilot vs Manual Review) */}
          <div style={{ padding: '16px 20px', border: '1px solid #27272a', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.015)', marginBottom: '20px' }}>
            <label style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: '#f3f4f6', fontWeight: 700 }}>
              <span>🚀 Mode Eksekusi Pipeline:</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              <div 
                onClick={() => {
                  setExecutionMode('full_autopilot');
                  setVisualMode('pure_t2v');
                }}
                style={{
                  border: `1px solid ${executionMode === 'full_autopilot' ? '#10b981' : '#27272a'}`,
                  background: executionMode === 'full_autopilot' ? 'rgba(16, 185, 129, 0.08)' : '#18181b',
                  borderRadius: 8,
                  padding: '12px 16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: executionMode === 'full_autopilot' ? '#10b981' : '#fff' }}>
                    🤖 Mode Full Auto Pilot
                  </span>
                  {executionMode === 'full_autopilot' && <span style={{ fontSize: '0.75rem', background: '#10b981', color: '#fff', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>Aktif</span>}
                </div>
                <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: 0, lineHeight: 1.4 }}>
                  Otomatis jalan penuh dari Storyboard ➔ TTS ➔ G-Labs Video ➔ FFmpeg tanpa jeda review. Visual mode dikunci ke Pure Text-to-Video.
                </p>
              </div>

              <div 
                onClick={() => setExecutionMode('manual_review')}
                style={{
                  border: `1px solid ${executionMode === 'manual_review' ? '#f59e0b' : '#27272a'}`,
                  background: executionMode === 'manual_review' ? 'rgba(245, 158, 11, 0.08)' : '#18181b',
                  borderRadius: 8,
                  padding: '12px 16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: executionMode === 'manual_review' ? '#f59e0b' : '#fff' }}>
                    👁️ Mode Manual Review (Fase 1 & 2)
                  </span>
                  {executionMode === 'manual_review' && <span style={{ fontSize: '0.75rem', background: '#f59e0b', color: '#000', padding: '2px 8px', borderRadius: 12 }}>Aktif</span>}
                </div>
                <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: 0, lineHeight: 1.4 }}>
                  Fase 1 Discovery berhenti untuk review storyboard & naskah. Fase 2 produksi dijalankan manual setelah persetujuan.
                </p>
              </div>
            </div>
          </div>

          {/* PRESET SELECTOR */}
          <div style={{ padding: '16px 24px', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: '20px' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#818cf8' }}>📋 Gunakan Preset:</span>
              <select 
                value={selectedPresetKey} 
                onChange={(e) => {
                  const key = e.target.value;
                  setSelectedPresetKey(key);
                  const preset = presets.find(p => p.key === key);
                  if (preset) applyPresetToForm(preset);
                }}
                style={{ maxWidth: 300, background: '#09090b', color: '#fff', border: '1px solid #27272a', borderRadius: 8, padding: '8px 12px', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
              >
                <option value="">-- Buat dari Awal (Tanpa Preset) --</option>
                {presets.map(p => (
                  <option key={p.key} value={p.key}>{p.label}{p.is_system ? ' (System)' : ''}</option>
                ))}
              </select>
            </div>
            {user?.role === 'admin' && (
              <button
                type="button"
                onClick={() => {
                  setNewPresetLabel('');
                  setNewPresetKey('');
                  setShowPresetSaveModal(true);
                }}
                style={{ padding: '8px 12px', fontSize: '12px', background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid #27272a', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
              >
                💾 Simpan Form sebagai Preset
              </button>
            )}
          </div>

          {/* Structured 4 Accordions Stack */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            
            {/* ACCORDION 1: Basic Creative Strategy & Planner Master */}
            <div style={{ background: '#18181b', borderRadius: '10px', border: '1px solid #27272a', overflow: 'hidden' }}>
              <div
                onClick={() => setActiveAccordion(0)}
                style={{
                  padding: '14px 18px', background: activeAccordion === 0 ? 'rgba(99, 102, 241, 0.12)' : '#18181b',
                  color: activeAccordion === 0 ? '#818cf8' : '#f3f4f6', fontWeight: 700, fontSize: '14px',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <span>1. Basic Creative Strategy & Planner Master</span>
                <span>{activeAccordion === 0 ? '▲' : '▼'}</span>
              </div>

              {activeAccordion === 0 && (
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {!initialPlannerId && (
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#818cf8', display: 'block', marginBottom: '6px' }}>
                        📊 Pilih Content Planner Master:
                      </label>
                      <select
                        value={selectedPlannerId}
                        onChange={(e) => handleSelectPlanner(e.target.value)}
                        style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px', fontSize: '13px' }}
                      >
                        <option value="">-- Pilih Content Planner --</option>
                        {planners.map(p => (
                          <option key={p.id} value={p.id}>{p.title || p.planner_name} ({p.planner_focus === 'brand_editorial' ? 'Brand Editorial' : p.product_name})</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {loading ? (
                    <div style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', padding: '12px' }}>Memuat detail planner...</div>
                  ) : planner && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {/* Product Visual Verification Card */}
                      <div style={{
                        padding: '12px 14px', borderRadius: '10px',
                        background: 'rgba(6, 78, 59, 0.25)', border: '1px solid rgba(16, 185, 129, 0.4)',
                        display: 'flex', gap: '12px', alignItems: 'center'
                      }}>
                        <div style={{
                          width: '72px', height: '72px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0,
                          background: '#18181b', border: '1px solid #27272a', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {productRefImage ? (
                            <img
                              src={productRefImage.startsWith('http') || productRefImage.startsWith('/api/') ? productRefImage : `/api/v2/products/image?path=${encodeURIComponent(productRefImage)}`}
                              alt={productName || 'Product'}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <span style={{ fontSize: '24px' }}>📦</span>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <span style={{
                              fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                              background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)'
                            }}>
                              ✓ Verified Clean Photo
                            </span>
                            <span style={{ fontSize: '11px', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {productRefImage ? productRefImage.split('/').pop() : 'Tanpa foto clean'}
                            </span>
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {planner.planner_focus === 'brand_editorial' ? 'Brand Editorial — produk tidak wajib' : (productName || planner.product_name || 'Tanpa Nama Produk')}
                          </div>
                          <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {productUsp || productDesc || planner.product_description || 'Visual produk terverifikasi untuk proses pembuatan kampanye.'}
                          </div>
                        </div>
                      </div>

                      {/* Selected Planner Rows List */}
                      <div style={{ background: 'rgba(99, 102, 241, 0.08)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                            📋 Baris Planner ({selectedRowIds.length} dari {rows.length} terpilih) | Platform: {planner.platform?.toUpperCase()}
                          </span>
                          <button
                            type="button"
                            onClick={toggleAllRows}
                            style={{ background: '#334155', border: 'none', color: '#38bdf8', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
                          >
                            {selectedRowIds.length === rows.length ? 'Batal Pilih Semua' : 'Pilih Semua Row'}
                          </button>
                        </div>

                        <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', background: '#09090b', padding: '8px', borderRadius: '6px', border: '1px solid #27272a' }}>
                          {rows.map(r => (
                            <label key={r.id} style={{ fontSize: '12px', color: '#d1d5db', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={selectedRowIds.includes(r.id)}
                                onChange={() => toggleRowSelection(r.id)}
                              />
                              <span style={{ fontWeight: 600, color: '#818cf8' }}>#{r.sequence} [{r.pillar}]</span>
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{r.hook}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Character Reference Lock Section */}
                      {manifest && (
                        <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>🔒</span> Character Reference Lock (v{manifest.version})
                            </span>
                            <span style={{ fontSize: '10px', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                              Wajib Aktif
                            </span>
                          </div>
                          
                          <p style={{ fontSize: '11px', color: '#cbd5e1', margin: 0, lineHeight: 1.4 }}>
                            Reference karakter digunakan untuk membuat start frame setiap klip. Reference ini bukan start frame final.
                          </p>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                            {getUsedCharacters().map(charKey => {
                              const char = manifest.characters[charKey];
                              if (!char) return null;
                              const status = characterStatuses[charKey];
                              const isAvailable = status?.available;
                              const previewUrl = status?.previewUrl;

                              return (
                                <div key={charKey} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#09090b', padding: '10px', borderRadius: '8px', border: '1px solid #27272a' }}>
                                  <div style={{ width: '48px', height: '48px', borderRadius: '6px', overflow: 'hidden', background: '#18181b', border: '1px solid #27272a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    {isAvailable && previewUrl ? (
                                      <img src={previewUrl.startsWith('http') || previewUrl.startsWith('/universe-assets/') ? previewUrl : `/universe-assets/${previewUrl}`} alt={char.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                      <span style={{ fontSize: '20px' }}>❓</span>
                                    )}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>{char.display_name}</span>
                                      <span style={{ fontSize: '10px', color: '#9ca3af' }}>v{char.version}</span>
                                      <span style={{
                                        fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px',
                                        background: isAvailable ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                        color: isAvailable ? '#34d399' : '#f87171',
                                        border: isAvailable ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)'
                                      }}>
                                        {isAvailable ? 'Tersedia kanonis ✅' : 'Belum Tersedia ⚠️'}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {char.canonical_description}
                                    </div>
                                  </div>
                                  <div>
                                    <label style={{ display: 'inline-block', background: '#27272a', color: '#fff', fontSize: '11px', fontWeight: 600, padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', border: '1px solid #3f3f46' }}>
                                      📤 {isAvailable ? 'Ganti Foto' : 'Unggah Foto'}
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleUploadCharacterRef(charKey, e.target.files[0])}
                                        style={{ display: 'none' }}
                                      />
                                    </label>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label style={{ fontSize: '12px', color: '#9ca3af', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span>🏷️ Nama Akun (Brand Account):</span>
                      <span style={{ fontSize: '11px', color: '#818cf8', fontWeight: 600 }}>💡 Terisi Otomatis dari Planner</span>
                    </label>
                    <select
                      value={selectedBrandId}
                      onChange={e => {
                        const profile = brandProfiles.find(item => item.id === e.target.value);
                        const newAcc = profile?.brand_name || '';
                        setSelectedBrandId(profile?.id || '');
                        setAccountName(newAcc);
                        const now = new Date();
                        const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
                        setCampaignName(`[ OPC ${dateStr} ] - ${newAcc ? newAcc + ' - ' : ''}`);
                      }}
                      style={{
                        width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a',
                        color: '#fff', borderRadius: '8px'
                      }}
                    >
                      <option value="">-- Pilih Nama Akun Brand --</option>
                      {brandProfiles.map(bp => (
                        <option key={bp.id} value={bp.id}>
                          {bp.brand_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Nama Kampanye OPC:</label>
                    <input
                      type="text"
                      value={campaignName}
                      onChange={e => setCampaignName(e.target.value)}
                      placeholder="cth: [OPC Planner] Kampanye Produk"
                      style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Mode Narasi:</label>
                    <select
                      value={narrativeMode}
                      onChange={e => setNarrativeMode(e.target.value)}
                      style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                    >
                      <option value="auto">✨ Auto-Detect dari Content Planner (Rekomendasi)</option>
                      <option value="Storytelling">Storytelling (Bercerita / Vlog)</option>
                      <option value="Promo Hard Sell">Promo Hard Sell (Langsung Penawaran)</option>
                      <option value="Educational Review">Educational Review (Edukasi & Ulasan)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>AI Directive / Guardrail (Staging Override):</label>
                    <textarea
                      value={aiDirective}
                      onChange={e => setAiDirective(e.target.value)}
                      rows={2}
                      placeholder="Instruksi kontrol AI internal..."
                      style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px', fontSize: '12px', resize: 'vertical' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Mandatory Outro Line (Staging Override):</label>
                    <input
                      type="text"
                      value={mandatoryOutroLine}
                      onChange={e => setMandatoryOutroLine(e.target.value)}
                      placeholder="Kalimat wajib di akhir klip voiceover..."
                      style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Custom Instruction (Instruksi Tambahan AI):</label>
                    <textarea
                      value={customInstruction}
                      onChange={e => setCustomInstruction(e.target.value)}
                      rows={3}
                      placeholder="Instruksi tambahan untuk prompt generator AI..."
                      style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px', fontSize: '12px', resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>TTS Voice Provider:</label>
                      <select
                        value={voiceProvider}
                        onChange={e => setVoiceProvider(e.target.value)}
                        style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                      >
                        <option value="minimax">MiniMax AI Voice (Indonesian)</option>
                        <option value="gemini">Gemini Live TTS</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Bahasa Naskah Voiceover:</label>
                      <select
                        value={targetLanguage}
                        onChange={e => setTargetLanguage(e.target.value)}
                        style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                      >
                        <option value="id-ID">Bahasa Indonesia (id-ID)</option>
                        <option value="en-US">English (en-US)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: '#818cf8', fontWeight: 700, display: 'block', marginBottom: '6px' }}>🎯 Target Demografi & Tone Bahasa:</label>
                      <select
                        value={targetDemographic}
                        onChange={e => setTargetDemographic(e.target.value)}
                        style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
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
                          placeholder="Contoh: Mahasiswa Rantau yang Hemat"
                          value={targetDemographicCustom}
                          onChange={e => setTargetDemographicCustom(e.target.value)}
                          style={{ width: '100%', marginTop: '6px', padding: '8px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                        />
                      )}
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Audio Segmenting:</label>
                      <select
                        value={enableAudioSegment ? 'enabled' : 'disabled'}
                        onChange={e => setEnableAudioSegment(e.target.value === 'enabled')}
                        style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                      >
                        <option value="disabled">Disabled (Single VO File)</option>
                        <option value="enabled">Enabled (Segment Per Clip)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>SFX Setting:</label>
                      <select
                        value={sfxSetting}
                        onChange={e => setSfxSetting(e.target.value)}
                        style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                      >
                        <option value="without_sfx">🔇 Without SFX (Default)</option>
                        <option value="with_sfx">🔊 With SFX</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Audit Kepatuhan TikTok Safe:</label>
                      <select
                        value={enableVoAudit}
                        onChange={e => setEnableVoAudit(Number(e.target.value))}
                        style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                      >
                        <option value={1}>✅ Yes (Audit Compliance & Render 2 Versi VO)</option>
                        <option value={0}>❌ No (Tanpa Audit Compliance)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>📁 Parent Folder Nextcloud:</label>
                      <input
                        type="text"
                        value={nextcloudParentFolder}
                        onChange={e => setNextcloudParentFolder(e.target.value)}
                        placeholder="cth: /MAKNA_Assets"
                        style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                      />
                    </div>
                  </div>

                  {brandProfiles.length > 0 && (
                    <div>
                      <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>🧬 Brand Profile (Opsional):</label>
                      <select
                        value={selectedBrandId}
                        onChange={e => {
                          const profile = brandProfiles.find(item => item.id === e.target.value);
                          setSelectedBrandId(profile?.id || '');
                          setAccountName(profile?.brand_name || '');
                          if (profile?.nextcloud_target_folder) {
                            setNextcloudParentFolder(profile.nextcloud_target_folder);
                          }
                        }}
                        style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                      >
                        <option value="">-- Tanpa Brand (Generik) --</option>
                        {brandProfiles.map(bp => (
                          <option key={bp.id} value={bp.id}>{bp.brand_name} ({bp.tone_of_voice})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ACCORDION 2: Aesthetics & Visual Engine Settings */}
            <div style={{ background: '#18181b', borderRadius: '10px', border: '1px solid #27272a', overflow: 'hidden' }}>
              <div
                onClick={() => setActiveAccordion(1)}
                style={{
                  padding: '14px 18px', background: activeAccordion === 1 ? 'rgba(99, 102, 241, 0.12)' : '#18181b',
                  color: activeAccordion === 1 ? '#818cf8' : '#f3f4f6', fontWeight: 700, fontSize: '14px',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <span>2. Aesthetics & Visual Engine Settings</span>
                <span>{activeAccordion === 1 ? '▲' : '▼'}</span>
              </div>

              {activeAccordion === 1 && (
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Visual Style (Gaya Visual):</label>
                      <select value={visualStyle} onChange={e => setVisualStyle(e.target.value)} style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}>
                        <option value="Cinematic">Cinematic</option>
                        <option value="UGC">UGC</option>
                        <option value="Macrophotography">Macrophotography</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: '#9ca3af', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span>Visual Mode (Metode Generasi):</span>
                        {planner?.content_world === 'cartoon_universe' ? (
                          <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 700 }}>
                            🔒 Terkunci Hybrid Lock (Wajib Cartoon)
                          </span>
                        ) : executionMode === 'full_autopilot' && (
                          <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>
                            🔒 Terkunci Pure T2V
                          </span>
                        )}
                      </label>
                      <select 
                        value={planner?.content_world === 'cartoon_universe' ? 'hybrid_lock' : (executionMode === 'full_autopilot' ? 'pure_t2v' : visualMode)} 
                        onChange={e => setVisualMode(e.target.value)} 
                        disabled={executionMode === 'full_autopilot' || planner?.content_world === 'cartoon_universe'}
                        style={{ 
                          width: '100%', 
                          padding: '10px', 
                          background: '#09090b', 
                          border: '1px solid #27272a', 
                          color: '#fff', 
                          borderRadius: '8px',
                          opacity: executionMode === 'full_autopilot' ? 0.7 : 1,
                          cursor: executionMode === 'full_autopilot' ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <option value="hybrid_lock">Double-Pass Pixel Lock (Nano Banana Pro T2I ➜ Veo 3.1 I2V)</option>
                        <option value="pure_t2v">Pure Text-To-Video (T2V Langsung)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Model Video Veo:</label>
                      <select
                        value={videoModel}
                        onChange={e => {
                          const mod = e.target.value;
                          setVideoModel(mod);
                          if (mod !== 'omni_flash' && clipDuration === 10) setClipDuration(8);
                        }}
                        style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                      >
                        <option value="veo_31_lite">Google Veo 3.1 Lite (Standar Cepat)</option>
                        <option value="veo_31_fast">Google Veo 3.1 Fast</option>
                        <option value="veo_31_quality">Google Veo 3.1 Quality (Kualitas Tinggi)</option>
                        <option value="veo_31_lite_relaxed">Google Veo 3.1 Relaxed</option>
                        <option value="omni_flash">⚡ Google Veo Omni Flash (Support 10s Clip)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Durasi per Klip Video:</label>
                      <select
                        value={clipDuration}
                        onChange={e => setClipDuration(Number(e.target.value))}
                        style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                      >
                        <option value={4}>4s per klip</option>
                        <option value={6}>6s per klip</option>
                        <option value={8}>8s per klip (Default)</option>
                        {videoModel === 'omni_flash' && (
                          <option value={10}>10s per klip (Khusus Omni Flash)</option>
                        )}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Face Visibility:</label>
                      <select value={faceVisibility} onChange={e => setFaceVisibility(e.target.value)} style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}>
                        <option value="Faceless">Faceless (Tanpa Wajah - Fokus Aksi Tangan)</option>
                        <option value="POV">POV (Sudut Pandang Utama)</option>
                        <option value="Silhouette">Silhouette (Siluet Estetik)</option>
                        <option value="cartoon_face">Cartoon Face (Kartun Ekspresif)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Jumlah Klip Video (N):</label>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        value={targetClipsCount}
                        onChange={e => setTargetClipsCount(Number(e.target.value))}
                        style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                        required
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Batasan Kata per Klip:</label>
                      <select value={wordsPerClip} onChange={e => setWordsPerClip(e.target.value)} style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}>
                        <option value="20-22 kata">20-22 kata (Default)</option>
                        <option value="17-19 kata">17-19 kata</option>
                        <option value="15-16 kata">15-16 kata</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Aspect Ratio:</label>
                      <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}>
                        <option value="9:16">9:16 (Vertical TikTok/Reels)</option>
                        <option value="16:9">16:9 (Horizontal YouTube)</option>
                        <option value="1:1">1:1 (Square Feed)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ACCORDION 3: Product Bridging Settings */}
            <div style={{ background: '#18181b', borderRadius: '10px', border: '1px solid #27272a', overflow: 'hidden' }}>
              <div
                onClick={() => setActiveAccordion(2)}
                style={{
                  padding: '14px 18px', background: activeAccordion === 2 ? 'rgba(99, 102, 241, 0.12)' : '#18181b',
                  color: activeAccordion === 2 ? '#818cf8' : '#f3f4f6', fontWeight: 700, fontSize: '14px',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <span>3. Product Bridging Settings</span>
                <span>{activeAccordion === 2 ? '▲' : '▼'}</span>
              </div>

              {activeAccordion === 2 && (
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#f3f4f6', fontWeight: 600 }}>
                    <input type="checkbox" checked={isBridgingActive} onChange={e => setIsBridgingActive(e.target.checked)} />
                    Aktifkan Product Bridging (Sisipkan Transisi Produk Softselling)
                  </label>

                  {isBridgingActive && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                        <div>
                          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Mulai Bridging Klip Ke:</label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={bridgeAtClip}
                            onChange={e => setBridgeAtClip(Number(e.target.value))}
                            style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                            required
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Durasi Bridging:</label>
                          <select value={bridgeDurationClips} onChange={e => setBridgeDurationClips(Number(e.target.value))} style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}>
                            <option value={1}>1 Klip</option>
                            <option value={2}>2 Klip</option>
                            <option value={0}>0 (Sisa Seluruh Klip)</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Metode Penyertaan Produk:</label>
                          <select value={bridgingMode} onChange={e => setBridgingMode(e.target.value)} style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}>
                            <option value="manual_input">📸 Autofetch dari Content Planner Master</option>
                            <option value="select_existing">📦 Pilih Produk Terdaftar</option>
                            <option value="url_extract">🔗 Extract dari URL Marketplace</option>
                          </select>
                        </div>
                      </div>

                      {/* Autofetch Visual Status Badge */}
                      <div style={{ padding: '12px 14px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', color: '#10b981', fontSize: '12px' }}>
                        <div style={{ fontWeight: 700, marginBottom: '2px' }}>✓ Data & Foto Studio Produk Terhubung ke Content Planner:</div>
                        <div>• Produk: <b>{productName || 'Mengikuti Planner'}</b></div>
                        <div>• Foto Ref: <b>{productRefImage || 'Tersedia di Planner Master'}</b></div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ACCORDION 4: Visual Swap Overrides (100% Copy Persis dari Mass OPC app/pillar-campaigns/page.js) */}
            <div style={{ background: '#18181b', borderRadius: '10px', border: '1px solid #27272a', overflow: 'hidden' }}>
              <div
                onClick={() => setActiveAccordion(3)}
                style={{
                  padding: '14px 18px', background: activeAccordion === 3 ? 'rgba(99, 102, 241, 0.12)' : '#18181b',
                  color: activeAccordion === 3 ? '#818cf8' : '#f3f4f6', fontWeight: 700, fontSize: '14px',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <span>4. Visual Swap Overrides</span>
                <span>{activeAccordion === 3 ? '▲' : '▼'}</span>
              </div>

              {activeAccordion === 3 && (
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input
                      type="checkbox"
                      id="vsoToggleModal"
                      checked={isVsoActive}
                      onChange={e => setIsVsoActive(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="vsoToggleModal" style={{ cursor: 'pointer', fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                      🎭 Aktifkan Visual Swap Overrides
                    </label>
                  </div>

                  {isVsoActive && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Konsep Karakter (Framing)</label>
                          <select
                            style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                            value={characterConcept}
                            onChange={e => setCharacterConcept(e.target.value)}
                          >
                            <option value="faceless">Faceless (Wajah Terpotong - Fokus Tangan)</option>
                            <option value="pov">POV (First Person View)</option>
                            <option value="silhouette">Siluet Bayangan (Aesthetic Shadow)</option>
                            <option value="stylized_3d">3D Stylized Claymation</option>
                            <option value="cartoon_face">Mascot Universe (Cartoon Face)</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Demografi Subjek / Model</label>
                          <select
                            style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                            value={subjectDemographic}
                            onChange={e => {
                              const val = e.target.value;
                              setSubjectDemographic(val);
                              setWardrobeStyle('random');
                              if (val.startsWith('mascot_universe_')) {
                                setCharacterConcept('cartoon_face');
                              } else if (val.startsWith('stylized_3d_')) {
                                setCharacterConcept('stylized_3d');
                              } else {
                                setCharacterConcept('faceless');
                              }
                            }}
                          >
                            <optgroup label="── Manusia Terpercaya ──">
                              <option value="syari_classic">Wanita Gamis Syar'iy (Hanya Tangan)</option>
                              <option value="caucasian_male">Pria Kaukasia (Hanya Tangan)</option>
                              <option value="stylized_3d_muslimah">Wanita 3D Stylized (Clay Art)</option>
                              <option value="stylized_3d_male">Pria 3D Stylized (Clay Art)</option>
                              <option value="stylized_3d_duo">Duo 3D Stylized - 2 Karakter (Clay Art)</option>
                            </optgroup>
                            <optgroup label="── Semesta Maskot Otonom ──">
                              <option value="mascot_universe_herbal">🌿 Semesta Herbal (Jahe, Kunyit, Mint...)</option>
                              <option value="mascot_universe_kitchen">🍳 Semesta Dapur (Wajan, Blender, Tomat...)</option>
                              <option value="mascot_universe_home_living">🏠 Semesta Rumah (Vacuum, Sofa, Lampu...)</option>
                              <option value="mascot_universe_pet">🐾 Semesta Hewan Peliharaan (Kucing, Anjing...)</option>
                            </optgroup>
                          </select>
                        </div>
                      </div>

                      {/* Gaya Animasi — hanya muncul saat mode Semesta Maskot */}
                      {subjectDemographic.startsWith('mascot_universe_') && (
                        <div>
                          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>🎨 Gaya Estetika Animasi Maskot</label>
                          <select
                            style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                            value={visualStylePreset}
                            onChange={e => setVisualStylePreset(e.target.value)}
                          >
                            <option value="3d_claymation_cozy">3D Claymation Cozy (Shaun the Sheep Look)</option>
                            <option value="kawaii_flat_vector">2D Kawaii Flat Vector (Minimalis Jepang)</option>
                            <option value="ghibli_watercolor">Studio Ghibli Watercolor (Cat Air Magis)</option>
                          </select>
                        </div>
                      )}

                      {/* Wardrobe — disembunyikan saat mode Semesta Maskot */}
                      {!subjectDemographic.startsWith('mascot_universe_') && (
                        <div>
                          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Pakaian / Wardrobe</label>
                          <select
                            style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                            value={wardrobeStyle}
                            onChange={e => setWardrobeStyle(e.target.value)}
                          >
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
                              style={{ width: '100%', marginTop: '8px', padding: '8px 10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '6px', fontSize: '12px' }}
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
                      )}

                      <div>
                        <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Pencahayaan & Atmosfer (Lighting Ambiance)</label>
                        <select
                          style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                          value={lightingStyle}
                          onChange={e => setLightingStyle(e.target.value)}
                        >
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
                            style={{ width: '100%', marginTop: '8px', padding: '8px 10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '6px', fontSize: '12px' }}
                            placeholder="Ketik pencahayaan kustom..."
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

            {/* ACCORDION 5: Workflow & Video Studio Settings */}
            <div style={{ background: '#18181b', borderRadius: '10px', border: '1px solid #27272a', overflow: 'hidden' }}>
              <div
                onClick={() => setActiveAccordion(4)}
                style={{
                  padding: '14px 18px', background: activeAccordion === 4 ? 'rgba(99, 102, 241, 0.12)' : '#18181b',
                  color: activeAccordion === 4 ? '#818cf8' : '#f3f4f6', fontWeight: 700, fontSize: '14px',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <span>5. Alur Kerja Produksi & Post-Processing (Workflow Settings)</span>
                <span>{activeAccordion === 4 ? '▲' : '▼'}</span>
              </div>

              {activeAccordion === 4 && (
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* Active Stages Checklist */}
                  <div>
                    <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '8px' }}>Tahapan Workflow Aktif:</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                      
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#09090b', padding: '10px 12px', borderRadius: '8px', border: '1px solid #27272a' }}>
                        <span style={{ fontSize: '12px', color: '#fff', fontWeight: 500 }}>Enable TTS (Voiceover)</span>
                        <input type="checkbox" checked={enableTts} onChange={e => setEnableTts(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#09090b', padding: '10px 12px', borderRadius: '8px', border: '1px solid #27272a' }}>
                        <span style={{ fontSize: '12px', color: '#fff', fontWeight: 500 }}>Enable G-Labs (AI Video)</span>
                        <input type="checkbox" checked={enableGlabs} onChange={e => setEnableGlabs(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#09090b', padding: '10px 12px', borderRadius: '8px', border: '1px solid #27272a' }}>
                        <span style={{ fontSize: '12px', color: '#fff', fontWeight: 500 }}>Enable FFmpeg Muxing</span>
                        <input type="checkbox" checked={enableFfmpeg} onChange={e => setEnableFfmpeg(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#09090b', padding: '10px 12px', borderRadius: '8px', border: '1px solid #27272a' }}>
                        <span style={{ fontSize: '12px', color: '#fff', fontWeight: 500 }}>Enable Social Draft Post</span>
                        <input type="checkbox" checked={enableSocialPost} onChange={e => setEnableSocialPost(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                      </div>

                    </div>
                  </div>

                  {/* Audio settings */}
                  {enableTts && (
                    <div style={{ borderTop: '1px solid #27272a', paddingTop: '14px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 700, color: '#818cf8', display: 'block', marginBottom: '8px' }}>🔊 TTS Audio Engine Settings</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '4px' }}>Voice Provider:</label>
                          <select 
                            style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px', fontSize: '13px' }}
                            value={voiceProvider} 
                            onChange={e => setVoiceProvider(e.target.value)}
                          >
                            <option value="minimax">MiniMax VO Engine</option>
                            <option value="gemini">Gemini TTS Engine</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '4px' }}>Voice Persona:</label>
                          <select 
                            style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px', fontSize: '13px' }}
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
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' }}>
                        <div>
                          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '4px' }}>Speed ({voiceSpeed}x):</label>
                          <input type="range" min="0.5" max="2.0" step="0.1" value={voiceSpeed} onChange={e => setVoiceSpeed(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#6366f1' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '4px' }}>Volume ({voiceVolume}x):</label>
                          <input type="range" min="0.0" max="1.0" step="0.1" value={voiceVolume} onChange={e => setVoiceVolume(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#6366f1' }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* FFmpeg Video Studio Settings */}
                  {enableFfmpeg && (
                    <div style={{ borderTop: '1px solid #27272a', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 700, color: '#818cf8' }}>🎬 FFmpeg Video Studio Settings</label>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', color: '#9ca3af' }}>Mode Sinkronisasi Audio-Video:</label>
                        <div style={{ display: 'flex', gap: '20px', marginTop: '2px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#fff' }}>
                            <input
                              type="radio"
                              name="syncModePlanner"
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
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#fff' }}>
                            <input
                              type="radio"
                              name="syncModePlanner"
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
                          <div style={{ marginTop: '6px' }}>
                            <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '4px' }}>Metode Manual:</label>
                            <select 
                              style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px', fontSize: '13px' }}
                              value={ffmpegSyncOption} 
                              onChange={e => setFfmpegSyncOption(e.target.value)}
                            >
                              <option value="shortest">shortest (Potong video - Default)</option>
                              <option value="loop">loop (Ulang video)</option>
                              <option value="stretch">stretch (Ubah kecepatan)</option>
                              <option value="freeze">freeze (Tahan frame terakhir)</option>
                            </select>
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={{ fontSize: '12px', color: '#9ca3af', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span>Video Scale:</span>
                          <span style={{ color: '#818cf8', fontWeight: 'bold' }}>{Math.round(ffmpegVideoScale * 100)}%</span>
                        </label>
                        <input 
                          type="range" 
                          min="1.0" 
                          max="2.0" 
                          step="0.05" 
                          value={ffmpegVideoScale} 
                          onChange={e => setFfmpegVideoScale(parseFloat(e.target.value))} 
                          style={{ width: '100%', accentColor: '#6366f1' }} 
                        />
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>

          </div>

          {/* Bottom Action Footer Bar (Controls at the bottom, matching SC & OPC) */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 18px',
                background: '#27272a',
                color: '#9ca3af',
                border: '1px solid #3f3f46',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Batal
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={(e) => handleSubmit(e, 'draft')}
              style={{
                padding: '10px 20px',
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#818cf8',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                borderRadius: '10px',
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer'
              }}
            >
              {submitting && submitStatusTarget === 'draft' ? 'Menyimpan Draf...' : '💾 Save as Draft'}
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={(e) => handleSubmit(e, 'running')}
              style={{
                padding: '12px 24px',
                backgroundImage: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
              }}
            >
              {submitting && submitStatusTarget === 'running' ? 'Memproses Ingest...' : '✨ Ingest & Launch OPC Campaign'}
            </button>
          </div>
        </form>

        {showPresetSaveModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <form onSubmit={handleSaveAsPreset} style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', width: '100%', maxWidth: '400px', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#fff' }}>💾 Simpan sebagai Preset</h3>
                <button type="button" onClick={() => setShowPresetSaveModal(false)} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 0 }}>
                <label style={{ fontSize: '13px', color: '#a1a1aa' }}>Nama Preset (Label)</label>
                <input 
                  type="text" 
                  value={newPresetLabel} 
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewPresetLabel(val);
                    setNewPresetKey(val.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''));
                  }} 
                  placeholder="Contoh: Wardah Brightening v1"
                  style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px', fontSize: '13px' }}
                  required 
                />
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 0 }}>
                <label style={{ fontSize: '13px', color: '#a1a1aa' }}>Key Preset (Unique ID)</label>
                <input 
                  type="text" 
                  value={newPresetKey} 
                  onChange={(e) => setNewPresetKey(e.target.value.toLowerCase().replace(/[^a-z0-9_-]+/g, ''))} 
                  placeholder="Contoh: wardah_brightening_v1"
                  style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px', fontSize: '13px' }}
                  required 
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button type="button" onClick={() => setShowPresetSaveModal(false)} style={{ background: '#27272a', color: '#9ca3af', border: '1px solid #3f3f46', borderRadius: '6px', padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}>Batal</button>
                <button type="submit" style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}>Simpan Preset</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
