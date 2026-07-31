'use client';

import Sidebar from '../components/Sidebar';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';

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

export default function RECampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('running');
  const [showForm, setShowForm] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [urlsText, setUrlsText] = useState('');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [targetAi, setTargetAi] = useState('Google Veo (8s)');
  const [videoModel, setVideoModel] = useState('veo_31_lite');
  const [customInstruction, setCustomInstruction] = useState('akhiran skrip/voiceover : produk ori ada di keranjang ya!');
  const [toast, setToast] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [brandProfiles, setBrandProfiles] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [filterBrandId, setFilterBrandId] = useState('all');
  const [targetLanguage, setTargetLanguage] = useState('id-ID');
  const [targetDemographic, setTargetDemographic] = useState('genz_casual');
  const [targetDemographicCustom, setTargetDemographicCustom] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  
  // Bridging & Customization States (v5.5)
  const [isBridgingActive, setIsBridgingActive] = useState(false);
  const [targetClipsCount, setTargetClipsCount] = useState(3);
  const [bridgeAtClip, setBridgeAtClip] = useState(2);
  const [bridgeDurationClips, setBridgeDurationClips] = useState(1);
  const [bridgingMode, setBridgingMode] = useState('select_existing');
  const [products, setProducts] = useState([]);
  const [targetProductId, setTargetProductId] = useState('');
  const [manualProductName, setManualProductName] = useState('');
  const [manualProductDesc, setManualProductDesc] = useState('');
  const [manualProductUsp, setManualProductUsp] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [promotionStyle, setPromotionStyle] = useState('Softselling');
  const [narrativeMode, setNarrativeMode] = useState('Storytelling');

  // Audio & Social Settings States (v6.5)
  const [voiceProvider, setVoiceProvider] = useState('gemini');
  const [voicePersona, setVoicePersona] = useState('Kore');
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [voiceVolume, setVoiceVolume] = useState(1.0);
  const [postYoutube, setPostYoutube] = useState(false);
  const [postTiktok, setPostTiktok] = useState(false);
  const [postFacebook, setPostFacebook] = useState(false);
  const [facebookPages, setFacebookPages] = useState([]);
  const [facebookPageId, setFacebookPageId] = useState('');
  const [facebookServerUrl, setFacebookServerUrl] = useState('');
  const [fbDraftMode, setFbDraftMode] = useState('auto');

  // FFmpeg Studio Settings States (v6.6)
  const [ffmpegSyncOption, setFfmpegSyncOption] = useState('smart_sync');
  const [syncMode, setSyncMode] = useState('auto'); // 'auto' or 'manual'
  const [ffmpegVideoScale, setFfmpegVideoScale] = useState(1.0);
  const [ffmpegSfxVolume, setFfmpegSfxVolume] = useState(0.0);
  const [ffmpegBgmVolume, setFfmpegBgmVolume] = useState(0.15);

  // Custom configuration states (v7.5)
  const [wordsPerClip, setWordsPerClip] = useState('17-19 kata');
  const [faceVisibility, setFaceVisibility] = useState('Faceless');
  const [visualStyle, setVisualStyle] = useState('Cinematic');
  const [angleMultiplier, setAngleMultiplier] = useState(0);

  // Accordion active index
  const [activeAccordion, setActiveAccordion] = useState(0);

  // Scheduler & Logger States
  const [isSchedulerActive, setIsSchedulerActive] = useState(true);
  const [terminalLogs, setTerminalLogs] = useState('Menginisialisasi log RE Campaign...');
  const [expandedCampaignId, setExpandedCampaignId] = useState(null);
  const logIntervalRef = useRef(null);
  const terminalRef = useRef(null);

  // Workflow control states (v8.0)
  const [enableTts, setEnableTts] = useState(false);
  const [enableGlabs, setEnableGlabs] = useState(false);
  const [enableFfmpeg, setEnableFfmpeg] = useState(false);
  const [enableSocialPost, setEnableSocialPost] = useState(false);
  const [ttsModelQuality, setTtsModelQuality] = useState('speech-2.8-turbo');
  const [nextcloudParentFolder, setNextcloudParentFolder] = useState('/MAKNA_Assets');
  const [sfxSetting, setSfxSetting] = useState('without_sfx');
  const [enableAudioSegment, setEnableAudioSegment] = useState(false);
  const [voiceCast, setVoiceCast] = useState([]); // [{id, name, gemini_voice_id, minimax_voice_id}]

  const [visualMode, setVisualMode] = useState('hybrid_lock');
  const [productRefImage, setProductRefImage] = useState(null);
  const [productFilenameDeclare, setProductFilenameDeclare] = useState('');

  // Visual Swap Overrides (VSO) states
  const [isVsoActive, setIsVsoActive] = useState(false);
  const [characterConcept, setCharacterConcept] = useState('faceless');
  const [subjectDemographic, setSubjectDemographic] = useState('syari_classic');
  const [wardrobeStyle, setWardrobeStyle] = useState('amber_terracotta');
  const [wardrobeStyleCustom, setWardrobeStyleCustom] = useState('');
  const [lightingStyle, setLightingStyle] = useState('window_daylight');
  const [lightingStyleCustom, setLightingStyleCustom] = useState('');
  const [visualStylePreset, setVisualStylePreset] = useState('3d_claymation_cozy');

  // Mass Campaign states
  const [enableVoAudit, setEnableVoAudit] = useState(1); // 0 = No, 1 = Yes
  const [productionMode, setProductionMode] = useState('single'); // 'single' or 'mass'
  const [parsedRows, setParsedRows] = useState([]);
  const [massUploading, setMassUploading] = useState(false);

  const handleMassFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await import('xlsx');
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { defval: "" });

        const getRowVal = (row, aliases) => {
          for (const alias of aliases) {
            const key = Object.keys(row).find(k => k.trim().toLowerCase() === alias.trim().toLowerCase());
            if (key) return String(row[key]).trim();
          }
          return '';
        };

        const mapped = data.map((row, idx) => {
          return {
            row_number: idx + 1,
            url_source: getRowVal(row, ['url_source', 'url source', 'source_url', 'source url', 'link_video', 'video_link', 'video url', 'video_url']),
            link_product: getRowVal(row, ['link_product', 'link product', 'link produk', 'url produk', 'url product', 'url_product', 'product link', 'product_link'])
          };
        });

        const validMapped = mapped.filter(r => r.url_source);
        if (validMapped.length === 0) {
          showToast('File tidak valid atau tidak memiliki kolom url_source.', 'error');
          return;
        }

        setParsedRows(validMapped);
        showToast(`Berhasil membaca ${validMapped.length} baris dari file.`);
      } catch (err) {
        showToast(`Gagal membaca file: ${err.message}`, 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleMassSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!campaignName.trim()) {
      showToast('Nama Kampanye wajib diisi.', 'error');
      return;
    }
    if (parsedRows.length === 0) {
      showToast('Silakan pilih/unggah file CSV/XLSX terlebih dahulu.', 'error');
      return;
    }

    setMassUploading(true);
    try {
      const global_settings = {
        status: submitStatus,
        enable_vo_audit: enableVoAudit ? 1 : 0,
        aspect_ratio: aspectRatio,
        target_ai: targetAi,
        custom_instruction: customInstruction,
        brand_profile_id: selectedBrandId || null,
        is_bridging_active: isBridgingActive ? 1 : 0,
        target_clips_count: targetClipsCount,
        bridge_at_clip: bridgeAtClip,
        bridge_duration_clips: Number(bridgeDurationClips),
        bridging_mode: bridgingMode,
        promotion_style: promotionStyle,
        narrative_mode: narrativeMode,
        post_youtube_draft: postYoutube ? 1 : 0,
        post_tiktok_draft: postTiktok ? 1 : 0,
        post_facebook_draft: postFacebook ? 1 : 0,
        facebook_page_id: facebookPageId || null,
        facebook_server_url: facebookServerUrl || null,
        voice_provider: voiceProvider,
        voice_persona: voicePersona,
        voice_speed: Number(voiceSpeed),
        voice_volume: Number(voiceVolume),
        ffmpeg_sync_option: ffmpegSyncOption,
        ffmpeg_video_scale: Number(ffmpegVideoScale),
        ffmpeg_sfx_volume: Number(ffmpegSfxVolume),
        ffmpeg_bgm_volume: Number(ffmpegBgmVolume),
        video_model: videoModel,
        words_per_clip: wordsPerClip,
        face_visibility: faceVisibility,
        enable_tts: enableTts ? 1 : 0,
        enable_glabs: enableGlabs ? 1 : 0,
        enable_ffmpeg: enableFfmpeg ? 1 : 0,
        enable_social_post: enableSocialPost ? 1 : 0,
        visual_mode: visualMode,
        angle_multiplier: Number(angleMultiplier),
        visual_overrides_json: isVsoActive ? JSON.stringify({
          character_concept: characterConcept,
          subject_demographic: subjectDemographic,
          visual_style_preset: subjectDemographic.startsWith('mascot_universe_') ? visualStylePreset : null,
          wardrobe_style: wardrobeStyle,
          wardrobe_style_custom: wardrobeStyleCustom,
          lighting_style: lightingStyle,
          lighting_style_custom: lightingStyleCustom
        }) : null,
        tts_model_quality: ttsModelQuality,
        target_language: targetLanguage,
        visual_style: visualStyle,
        nextcloud_parent_folder: nextcloudParentFolder,
        fb_draft_mode: fbDraftMode,
        sfx_setting: sfxSetting,
        enable_audio_segment: enableAudioSegment,
        voice_cast_json: voiceCast.length > 0 ? JSON.stringify({ characters: voiceCast }) : null,
        local_scheduler: syncMode === 'auto' ? 0 : 1,
        scheduler_pause_at: 'tts'
      };

      const res = await fetch('/api/v2/re-campaigns/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_name: campaignName.trim(),
          global_settings,
          rows_data: parsedRows
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan saat memproses bulk request');

      showToast(`RE Mass Campaign "${campaignName}" dengan ${parsedRows.length} baris berhasil dibuat.`);
      setShowForm(false);
      setCampaignName('');
      setParsedRows([]);
      fetchCampaigns();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setMassUploading(false);
    }
  };

  const router = useRouter();

  useEffect(() => {
    if (voiceProvider === 'gemini') {
      setVoicePersona('Kore');
    } else {
      if (targetLanguage === 'en-US') {
        setVoicePersona('English_causual_narrator_vv1');
      } else {
        setVoicePersona('Indonesian_casual_reporter_vv2');
      }
    }
  }, [voiceProvider, targetLanguage]);

  useEffect(() => {
    if (!enableTts || !enableGlabs) {
      setEnableFfmpeg(false);
    }
  }, [enableTts, enableGlabs]);

  useEffect(() => {
    fetchCampaigns();
    fetchSchedulerStatus();
    pollLogs();
    fetch('/api/v2/brand-profiles').then(r => r.json()).then(d => { if (d.success) setBrandProfiles(d.data || []); }).catch(() => {});
    fetch('/api/product-agent').then(r => r.json()).then(d => { if (d.success) setProducts(d.data || []); }).catch(() => {});
    
    // Fetch Facebook Pages & Global Server URL
    fetch('/api/settings/facebook-pages')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.pages) {
          setFacebookPages(d.pages);
          if (d.pages.length > 0) {
            setFacebookPageId(d.pages[0].id);
          }
        }
      })
      .catch(() => {});

    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.fb_server_url) {
          setFacebookServerUrl(d.data.fb_server_url);
        }
      })
      .catch(() => {});

    const interval = setInterval(fetchCampaigns, 10000);
    logIntervalRef.current = setInterval(pollLogs, 3000);
    return () => {
      clearInterval(interval);
      clearInterval(logIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  async function fetchSchedulerStatus() {
    try {
      const res = await fetch('/api/v2/re-campaigns/scheduler-control');
      const data = await res.json();
      if (data.success) setIsSchedulerActive(data.isSchedulerActive);
    } catch (e) {}
  }

  async function pollLogs() {
    try {
      const res = await fetch(`/api/system-logs?type=re&t=${Date.now()}`);
      if (res.ok) {
        const text = await res.text();
        const lines = text.split('\n');
        const last500 = lines.slice(-500).join('\n');
        setTerminalLogs(last500 || 'Belum ada log aktivitas RE Campaign.');
      }
    } catch (e) {}
  }

  async function toggleGlobalScheduler() {
    try {
      const res = await fetch('/api/v2/re-campaigns/scheduler-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedulerStatus: !isSchedulerActive })
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

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function fetchCampaigns() {
    try {
      const res = await fetch('/api/v2/re-campaigns');
      const data = await res.json();
      if (data.campaigns) setCampaigns(data.campaigns);
      if (data.isSchedulerActive !== undefined) setIsSchedulerActive(data.isSchedulerActive);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    const urls = urlsText.split('\n').map(u => u.trim()).filter(Boolean);
    if (!campaignName.trim() || urls.length === 0) {
      showToast('Nama kampanye dan minimal 1 URL diperlukan.', 'error');
      return;
    }

    if (isBridgingActive) {
      if (bridgeAtClip < 2 || bridgeAtClip > targetClipsCount) {
        showToast(`Titik transisi (X) harus berada di antara klip ke-2 hingga ke-${targetClipsCount}.`, 'error');
        return;
      }
      if (bridgingMode === 'select_existing' && !targetProductId) {
        showToast('Silakan pilih produk dari pustaka.', 'error');
        return;
      }
      if (bridgingMode === 'manual_input' && (!manualProductName.trim() || !manualProductDesc.trim())) {
        showToast('Nama produk dan deskripsi wajib diisi untuk input manual.', 'error');
        return;
      }
      if (bridgingMode === 'url_extract' && !productUrl.trim()) {
        showToast('Silakan masukkan URL produk target.', 'error');
        return;
      }
      if (visualMode === 'hybrid_lock' && bridgingMode !== 'url_extract') {
        if (!productRefImage) {
          showToast('Silakan unggah foto produk untuk mode Hybrid Lock.', 'error');
          return;
        }
        if (!productFilenameDeclare.trim()) {
          showToast('Silakan isi nama berkas gambar produk deklarasi.', 'error');
          return;
        }
      }
    }

    setCreating(true);
    try {
      let ephemeral_product_data = null;
      if (isBridgingActive) {
        if (bridgingMode === 'manual_input') {
          ephemeral_product_data = JSON.stringify({
            product_name: manualProductName.trim(),
            product_description: manualProductDesc.trim(),
            unique_selling_point: manualProductUsp.trim()
          });
        } else if (bridgingMode === 'url_extract') {
          ephemeral_product_data = productUrl.trim();
        }
      }

       const formData = new FormData();
      formData.append('campaign_name', campaignName.trim());
      formData.append('enable_vo_audit', enableVoAudit ? '1' : '0');
      formData.append('urls', JSON.stringify(urls));
      formData.append('aspect_ratio', aspectRatio);
      formData.append('target_ai', targetAi);
      formData.append('custom_instruction', customInstruction);
      formData.append('brand_profile_id', selectedBrandId || '');
      formData.append('is_bridging_active', isBridgingActive ? '1' : '0');
      formData.append('target_clips_count', String(targetClipsCount));
      formData.append('bridge_at_clip', String(bridgeAtClip));
      formData.append('bridge_duration_clips', String(bridgeDurationClips));
      formData.append('bridging_mode', bridgingMode);
      formData.append('target_product_id', bridgingMode === 'select_existing' && isBridgingActive ? (targetProductId || '') : '');
      if (ephemeral_product_data) {
        formData.append('ephemeral_product_data', ephemeral_product_data);
      }
      formData.append('promotion_style', isBridgingActive ? promotionStyle : 'Softselling');
      formData.append('narrative_mode', narrativeMode);
      formData.append('post_youtube_draft', '0');
      formData.append('post_tiktok_draft', '0');
      formData.append('post_facebook_draft', enableSocialPost ? '1' : '0');
      formData.append('facebook_page_id', facebookPageId || '');
      formData.append('facebook_server_url', facebookServerUrl || '');
      formData.append('fb_draft_mode', fbDraftMode);
      formData.append('voice_provider', voiceProvider);
      formData.append('voice_persona', voicePersona);
      formData.append('voice_speed', String(voiceSpeed));
      formData.append('voice_volume', String(voiceVolume));
      formData.append('target_language', targetLanguage);
      formData.append('ffmpeg_sync_option', ffmpegSyncOption);
      formData.append('ffmpeg_video_scale', String(ffmpegVideoScale));
      formData.append('ffmpeg_sfx_volume', String(ffmpegSfxVolume));
      formData.append('ffmpeg_bgm_volume', String(ffmpegBgmVolume));
      formData.append('video_model', videoModel);
      formData.append('words_per_clip', wordsPerClip);
      formData.append('face_visibility', faceVisibility);
      formData.append('enable_tts', enableTts ? '1' : '0');
      formData.append('enable_glabs', enableGlabs ? '1' : '0');
      formData.append('enable_ffmpeg', enableFfmpeg ? '1' : '0');
      formData.append('enable_social_post', enableSocialPost ? '1' : '0');
      formData.append('visual_mode', visualMode);
      formData.append('visual_style', visualStyle);
      formData.append('angle_multiplier', String(angleMultiplier));
      formData.append('tts_model_quality', ttsModelQuality);
      formData.append('account_name', accountName);
      formData.append('nextcloud_parent_folder', nextcloudParentFolder);
      formData.append('target_language', targetLanguage);
      formData.append('target_demographic', targetDemographic);
      formData.append('target_demographic_custom', targetDemographicCustom);
      formData.append('target_spreadsheet_id', '');
      formData.append('sfx_setting', sfxSetting);
      formData.append('enable_audio_segment', enableAudioSegment);
      if (voiceCast.length > 0) formData.append('voice_cast_json', JSON.stringify({ characters: voiceCast }));
      
      if (isVsoActive) {
        const isMascot = subjectDemographic.startsWith('mascot_universe_');
        const vsoData = {
          character_concept: characterConcept,
          subject_demographic: subjectDemographic,
          visual_style_preset: isMascot ? visualStylePreset : null,
          wardrobe_style: wardrobeStyle,
          wardrobe_style_custom: wardrobeStyle === 'custom' ? wardrobeStyleCustom.trim() : '',
          lighting_style: lightingStyle,
          lighting_style_custom: lightingStyle === 'custom' ? lightingStyleCustom.trim() : ''
        };
        formData.append('visual_overrides_json', JSON.stringify(vsoData));
      }
      
      formData.append('status', submitStatus);
      
      if (isBridgingActive && visualMode === 'hybrid_lock') {
        if (productRefImage) {
          formData.append('product_media', productRefImage);
        }
        formData.append('product_filename_declare', productFilenameDeclare.trim());
      }

      const res = await fetch('/api/v2/re-campaigns', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(`Campaign "${campaignName}" created successfully.`);
      setCampaignName('');
      setNextcloudParentFolder('MAKNA_Production_Final');
      setSfxSetting('without_sfx');
      setEnableAudioSegment(false);
      setVoiceCast([]);
      setUrlsText('');
      setAspectRatio('9:16');
      setTargetAi('Google Veo (8s)');
      setVideoModel('veo_31_lite');
      setCustomInstruction('');
      setSelectedBrandId('');
      setWordsPerClip('17-19 kata');
      setFaceVisibility('Faceless');
      setVisualStyle('Cinematic');
      setAngleMultiplier(0);

      // Reset Workflow Options
      setEnableTts(false);
      setEnableGlabs(false);
      setEnableFfmpeg(false);
      setEnableSocialPost(false);
      
      // Reset Bridging States
      setIsBridgingActive(false);
      setTargetClipsCount(3);
      setBridgeAtClip(2);
      setBridgeDurationClips(0);
      setBridgingMode('select_existing');
      setTargetProductId('');
      setManualProductName('');
      setManualProductDesc('');
      setManualProductUsp('');
      setProductUrl('');
      setPromotionStyle('Softselling');
      setVoiceProvider('gemini');
      setVoicePersona('Kore');
      setVoiceSpeed(1.0);
      setVoiceVolume(1.0);
      setTargetLanguage('id-ID');
      setPostYoutube(false);
      setVisualMode('hybrid_lock');
      setProductRefImage(null);
      setProductFilenameDeclare('');
      setPostTiktok(false);
      setPostFacebook(false);
      setFacebookPageId(facebookPages.length > 0 ? facebookPages[0].id : '');
      setFbDraftMode('auto');
      // Re-fetch settings for global default server URL
      fetch('/api/settings')
        .then(r => r.json())
        .then(d => {
          if (d.success && d.data?.fb_server_url) {
            setFacebookServerUrl(d.data.fb_server_url);
          }
        })
        .catch(() => {});
      setTtsModelQuality('speech-2.8-turbo');

      // Reset VSO States
      setIsVsoActive(false);
      setCharacterConcept('faceless');
      setSubjectDemographic('syari_classic');
      setWardrobeStyle('amber_terracotta');
      setWardrobeStyleCustom('');
      setLightingStyle('window_daylight');
      setLightingStyleCustom('');

      // Reset FFmpeg States
      setSyncMode('auto');
      setFfmpegSyncOption('smart_sync');
      setFfmpegVideoScale(1.0);
      setFfmpegSfxVolume(0.0);
      setFfmpegBgmVolume(0.15);

      setShowForm(false);
      fetchCampaigns();
      pollLogs();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCreating(false);
    }
  }

  async function toggleStatus(campaign) {
    let nextStatus;
    if (campaign.status === 'draft') {
      nextStatus = 'running';
    } else {
      nextStatus = campaign.status === 'running' ? 'paused' : 'running';
    }
    setProcessingId(campaign.id);
    try {
      const res = await fetch(`/api/v2/re-campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error('Gagal update status');
      showToast(campaign.status === 'draft' ? `Campaign "${campaign.campaign_name}" dimulai!` : `Campaign ${nextStatus === 'running' ? 'dilanjutkan' : 'dijeda'}.`);
      fetchCampaigns();
      pollLogs();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleCopy(campaign) {
    setProcessingId(campaign.id);
    try {
      const res = await fetch(`/api/v2/re-campaigns/${campaign.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil data kampanye');
      
      const c = data.campaign;
      const items = data.items || [];
      
      setCampaignName(`Copy of ${c.campaign_name}`);
      setNextcloudParentFolder(c.nextcloud_parent_folder || 'MAKNA_Production_Final');
      setSfxSetting(c.sfx_setting || 'without_sfx');
      setEnableAudioSegment(c.enable_audio_segment || false);
      try { setVoiceCast(c.voice_cast_json ? JSON.parse(c.voice_cast_json)?.characters || [] : []); } catch(e) { setVoiceCast([]); }
      setUrlsText(items.map(item => item.source_url).join('\n'));
      setAspectRatio(c.aspect_ratio || '9:16');
      setTargetAi(c.target_ai || 'Google Veo (8s)');
      setVideoModel(c.video_model || 'veo_31_lite');
      setCustomInstruction(c.custom_instruction || '');
      setSelectedBrandId(c.brand_profile_id || '');
      setTargetLanguage(c.target_language || 'id-ID');
      setIsBridgingActive(c.is_bridging_active === 1);
      setTargetClipsCount(c.target_clips_count || 5);
      setBridgeAtClip(c.bridge_at_clip || 2);
      setBridgeDurationClips(c.bridge_duration_clips || 0);
      setBridgingMode(c.bridging_mode || 'select_existing');
      setTargetProductId(c.target_product_id || '');
      setPromotionStyle(c.promotion_style || 'Softselling');
      setNarrativeMode(c.narrative_mode || 'Storytelling');
      setPostYoutube(false);
      setPostTiktok(false);
      setPostFacebook(c.post_facebook_draft === 1);
      setEnableSocialPost(c.enable_social_post === 1 || c.post_facebook_draft === 1);
      setFacebookPageId(c.facebook_page_id || (facebookPages.length > 0 ? facebookPages[0].id : ''));
      setFacebookServerUrl(c.facebook_server_url || '');
      setVoiceProvider(c.voice_provider || 'gemini');
      setVoicePersona(c.voice_persona || 'Kore');
      setVoiceSpeed(c.voice_speed !== undefined ? c.voice_speed : 1.0);
      setVoiceVolume(c.voice_volume !== undefined ? c.voice_volume : 1.0);
      setFfmpegSyncOption(c.ffmpeg_sync_option || 'smart_sync');
      setFfmpegVideoScale(c.ffmpeg_video_scale !== undefined ? c.ffmpeg_video_scale : 1.0);
      setFfmpegSfxVolume(c.ffmpeg_sfx_volume !== undefined ? c.ffmpeg_sfx_volume : 0.0);
      setFfmpegBgmVolume(c.ffmpeg_bgm_volume !== undefined ? c.ffmpeg_bgm_volume : 0.15);
      setWordsPerClip(c.words_per_clip || '17-19 kata');
      setFaceVisibility(c.face_visibility || 'Faceless');
      setVisualStyle(c.visual_style || 'Cinematic');
      setAngleMultiplier(c.angle_multiplier || 0);
      setEnableTts(c.enable_tts === 1);
      setEnableGlabs(c.enable_glabs === 1);
      setEnableFfmpeg(c.enable_ffmpeg === 1);
      setEnableSocialPost(c.enable_social_post === 1);
      setTtsModelQuality(c.tts_model_quality || 'speech-2.8-turbo');
      setVisualMode(c.visual_mode || 'hybrid_lock');
      setProductFilenameDeclare(c.product_filename_declare || '');
      setFbDraftMode(c.fb_draft_mode || 'auto');
      
      if (c.visual_overrides_json) {
        try {
          const vso = JSON.parse(c.visual_overrides_json);
          setIsVsoActive(true);
          setCharacterConcept(vso.character_concept || 'faceless');
          setSubjectDemographic(vso.subject_demographic || 'syari_classic');
          setWardrobeStyle(vso.wardrobe_style || 'amber_terracotta');
          setWardrobeStyleCustom(vso.wardrobe_style_custom || '');
          setLightingStyle(vso.lighting_style || 'window_daylight');
          setLightingStyleCustom(vso.lighting_style_custom || '');
        } catch {}
      }
      
      setShowForm(true);
      showToast('Konfigurasi kampanye berhasil disalin ke form.');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setProcessingId(null);
    }
  }

  async function deleteCampaign(id) {
    if (!confirm('Yakin ingin menghapus campaign ini beserta semua antriannya? Tindakan ini tidak bisa dibatalkan.')) return;
    setProcessingId(id);
    try {
      const res = await fetch(`/api/v2/re-campaigns/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menghapus campaign');
      showToast('Campaign berhasil dihapus');
      fetchCampaigns();
      pollLogs();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleImportSubmit(e) {
    e.preventDefault();
    if (!importFile) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('campaign_file', importFile);

      const res = await fetch('/api/campaign-portability/import', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengimpor kampanye');

      showToast(data.message || 'Kampanye berhasil diimpor!');
      setShowImportModal(false);
      setImportFile(null);
      fetchCampaigns();
      pollLogs();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setImporting(false);
    }
  }

  function progressPct(stats) {
    if (!stats || stats.total === 0) return 0;
    return Math.round((stats.analyzed / stats.total) * 100);
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto' }}>
          <div className="page-header">
            <div>
              <h1 className="page-title">🎬 RE Campaign</h1>
              <p className="page-subtitle">Batch Reverse Engineering berbasis kampanye — scrape & analisis otomatis ke Google Sheet baru</p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                className="btn" 
                style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} 
                onClick={() => setShowImportModal(true)}
              >
                📥 Import Campaign (.makna)
              </button>
              <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
                {showForm ? '✕ Tutup Form' : '+ New Campaign'}
              </button>
            </div>
          </div>

        {toast && (
          <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
            {toast.msg}
          </div>
        )}

        {showForm && (
          <div className="card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
            <div className="card-title" style={{ padding: '20px 24px 0 24px', marginBottom: 10 }}><span className="icon">✦</span> New RE Campaign</div>
            <form onSubmit={productionMode === 'mass' ? handleMassSubmit : handleCreate}>
              
              {/* Switcher Tab */}
              <div style={{ display: 'flex', gap: 16, padding: '16px 24px', borderBottom: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.02)' }}>
                <button 
                  type="button" 
                  onClick={() => setProductionMode('single')} 
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: productionMode === 'single' ? 'var(--accent-color)' : 'rgba(255, 255, 255, 0.05)',
                    color: productionMode === 'single' ? '#fff' : 'var(--text-muted)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Single Video Campaign
                </button>
                <button 
                  type="button" 
                  onClick={() => setProductionMode('mass')} 
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: productionMode === 'mass' ? 'var(--accent-color)' : 'rgba(255, 255, 255, 0.05)',
                    color: productionMode === 'mass' ? '#fff' : 'var(--text-muted)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Mass Production (CSV/XLSX)
                </button>
              </div>

              {/* ACCORDION SECTION 1: Basic Creative Strategy */}
              <div style={{ borderBottom: '1px solid var(--border-color)' }}>
                <div 
                  onClick={() => setActiveAccordion(0)} 
                  style={{ padding: '16px 24px', background: activeAccordion === 0 ? 'rgba(59, 130, 246, 0.05)' : 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>1. Basic Creative Strategy</span>
                  <span>{activeAccordion === 0 ? '▲' : '▼'}</span>
                </div>
                {activeAccordion === 0 && (
                  <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">🏷️ Nama Akun (Brand Account)</label>
                      <select
                        className="form-input"
                        value={accountName}
                        onChange={e => {
                          const newAcc = e.target.value;
                          setAccountName(newAcc);
                          const matchingProfile = brandProfiles.find(bp => (bp.account_name || bp.brand_name) === newAcc);
                          if (matchingProfile) {
                            setSelectedBrandId(matchingProfile.id);
                          } else {
                            setSelectedBrandId('');
                          }
                          const now = new Date();
                          const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
                          setCampaignName(`[ RE ${dateStr} ] - ${newAcc ? newAcc + ' - ' : ''}`);
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
                      <label className="form-label">Nama Kampanye</label>
                      <input
                        className="form-input"
                        placeholder={productionMode === 'mass' ? "Contoh: RE Mass Skincare Ramadhan" : "Contoh: Riset Skincare Nov"}
                        value={campaignName}
                        onChange={e => setCampaignName(e.target.value)}
                        required
                      />
                    </div>
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
                       <label className="form-label">🎙 Audio Segment (per Klip)</label>
                       <select
                         className="form-input"
                         value={enableAudioSegment ? 'enabled' : 'disabled'}
                         onChange={e => setEnableAudioSegment(e.target.value === 'enabled')}
                         id="re-audio-segment-toggle"
                       >
                         <option value="disabled">❌ Disabled (Default)</option>
                         <option value="enabled">✅ Enabled — Embed Audio Segment per Beat</option>
                       </select>
                       <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                         Jika Enabled, prompt LAYER 2 akan menyertakan <code>(Audio Segment: "...")</code> per segmen 2 detik. Cocok untuk mode kartun/mascot dengan baked-in audio.
                       </div>
                     </div>
                     {enableAudioSegment && (
                       <div className="form-group" style={{ marginBottom: 0 }}>
                         <label className="form-label">🔊 TTS Voice Provider</label>
                         <select
                           className="form-input"
                           value={voiceProvider}
                           onChange={e => {
                             const prov = e.target.value;
                             setVoiceProvider(prov);
                             if (prov === 'gemini') {
                               setVoicePersona('Kore');
                             } else {
                               if (targetLanguage === 'en-US') {
                                 setVoicePersona('English_causual_narrator_vv1');
                               } else {
                                 setVoicePersona('Indonesian_casual_reporter_vv2');
                               }
                             }
                           }}
                         >
                           <option value="gemini">Google Gemini TTS</option>
                           <option value="minimax">MiniMax Speech</option>
                         </select>
                         <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                           Penyedia TTS untuk sinkronisasi audio dialog per klip.
                         </div>
                       </div>
                     )}
                     <div className="form-group" style={{ marginBottom: 0 }}>
                       <label className="form-label">SFX Setting</label>
                      <select 
                        className="form-input" 
                        value={sfxSetting} 
                        onChange={e => setSfxSetting(e.target.value)}
                      >
                        <option value="without_sfx">🔇 Without SFX (Default)</option>
                        <option value="with_sfx">🔊 With SFX</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Audit Kepatuhan Voiceover (TikTok Safe)</label>
                      <select 
                        className="form-input" 
                        value={enableVoAudit} 
                        onChange={e => setEnableVoAudit(Number(e.target.value))}
                      >
                        <option value={0}>❌ No (Tanpa Audit Kepatuhan)</option>
                        <option value={1}>✅ Yes (Audit Kepatuhan & Tampilkan Dua Versi VO)</option>
                      </select>
                    </div>
                    
                    {productionMode === 'single' ? (
                      <div className="form-group">
                        <label className="form-label">Daftar URL Video (satu per baris)</label>
                        <textarea
                          className="form-textarea"
                          style={{ minHeight: 160 }}
                          placeholder={'https://www.tiktok.com/@user/video/xxx\nhttps://www.instagram.com/reel/xxx'}
                          value={urlsText}
                          onChange={e => setUrlsText(e.target.value)}
                          required
                        />
                        <small style={{ color: 'var(--text-muted)' }}>
                          {urlsText.split('\n').filter(u => u.trim()).length} URL terdeteksi
                        </small>
                      </div>
                    ) : (
                      <div className="form-group">
                        <label className="form-label">Berkas CSV/XLSX Kampanye</label>
                        
                        {/* Drag & Drop Area */}
                        <div 
                          style={{
                            border: '2px dashed var(--border-color)',
                            borderRadius: 8,
                            padding: '32px 24px',
                            textAlign: 'center',
                            background: 'rgba(255, 255, 255, 0.01)',
                            cursor: 'pointer',
                            transition: 'border-color 0.2s ease'
                          }}
                          onDragOver={e => e.preventDefault()}
                          onDrop={e => {
                            e.preventDefault();
                            const files = e.dataTransfer.files;
                            if (files.length > 0) {
                              handleMassFileUpload({ target: { files } });
                            }
                          }}
                          onClick={() => document.getElementById('massFileUploader').click()}
                        >
                          <span style={{ fontSize: '2rem' }}>📂</span>
                          <div style={{ marginTop: 8, fontWeight: 500 }}>Seret & Lepas file .csv atau .xlsx Anda di sini</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--accent-color)', marginTop: 12, padding: '6px 14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 8, maxWidth: 650, display: 'inline-block', lineHeight: 1.4, textAlign: 'left', border: '1px solid rgba(255,255,255,0.05)' }}>
                             💡 <b>Petunjuk RE Massal:</b> Setiap baris wajib memiliki kolom <b>url_source</b> (video referensi) dan <b>link_product</b> (produk target). Tautan akan di-bridge secara dinamis menggunakan cache database.
                             <a 
                               href="/re_mass_template.csv" 
                               download 
                               onClick={(e) => {
                                 e.stopPropagation();
                               }} 
                               style={{ display: 'block', marginTop: 6, color: 'var(--accent-light)', textDecoration: 'underline', fontWeight: 'bold' }}
                             >
                               📥 Unduh Template CSV RE Massal
                             </a>
                           </div>
                          <input 
                            id="massFileUploader" 
                            type="file" 
                            accept=".csv,.xlsx" 
                            onChange={handleMassFileUpload} 
                            style={{ display: 'none' }} 
                          />
                        </div>

                        {parsedRows.length > 0 && (
                          <div style={{ marginTop: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#10b981' }}>✓ Terdeteksi {parsedRows.length} baris video</span>
                              <button type="button" onClick={() => setParsedRows([])} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.8rem', cursor: 'pointer' }}>Hapus Semua</button>
                            </div>
                            
                            {/* Preview Table */}
                            <div className="table-responsive" style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                              <table className="table" style={{ width: '100%', fontSize: '0.8rem' }}>
                                <thead>
                                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ padding: 8, textAlign: 'left' }}>No</th>
                                    <th style={{ padding: 8, textAlign: 'left' }}>URL Source (Video)</th>
                                    <th style={{ padding: 8, textAlign: 'left' }}>Link Product</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {parsedRows.map((row, index) => (
                                    <tr key={index} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                      <td style={{ padding: 8 }}>{index + 1}</td>
                                      <td style={{ padding: 8, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {row.url_source}
                                      </td>
                                      <td style={{ padding: 8, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {row.link_product || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Tidak Ada</span>}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="form-group">
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

              {/* ACCORDION SECTION 2: Aesthetics & Visual Settings */}
              <div style={{ borderBottom: '1px solid var(--border-color)' }}>
                <div 
                  onClick={() => setActiveAccordion(1)} 
                  style={{ padding: '16px 24px', background: activeAccordion === 1 ? 'rgba(59, 130, 246, 0.05)' : 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>2. Aesthetics & Visual Settings</span>
                  <span>{activeAccordion === 1 ? '▲' : '▼'}</span>
                </div>
                {activeAccordion === 1 && (
                  <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="form-group">
                      <label className="form-label">RE Angle Multiplier (RE+AM V8.3)</label>
                      <select 
                        className="form-input" 
                        value={angleMultiplier} 
                        onChange={e => setAngleMultiplier(Number(e.target.value))}
                      >
                        <option value={0}>Nonaktif (Single Angle)</option>
                        <option value={3}>3 Angles (Promo, UGC, Drama)</option>
                        <option value={4}>4 Angles (Promo, UGC, Drama, Expert)</option>
                        <option value={5}>5 Angles (Multi-Strategic)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Narrative Mode</label>
                      <select 
                        className="form-input" 
                        value={narrativeMode} 
                        onChange={e => setNarrativeMode(e.target.value)}
                      >
                        <option value="Storytelling">Storytelling (Bercerita / Daily-life)</option>
                        <option value="Problem-Solution">Problem-Solution (Masalah & Solusi)</option>
                        <option value="Educational">Educational (Tutorial / Penjelasan Ilmiah)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Aspect Ratio</label>
                      <select 
                        className="form-input" 
                        value={aspectRatio} 
                        onChange={e => setAspectRatio(e.target.value)}
                      >
                        <option value="9:16">9:16 (Vertical)</option>
                        <option value="16:9">16:9 (Horizontal)</option>
                        <option value="1:1">1:1 (Square)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Target AI</label>
                      <select 
                        className="form-input" 
                        value={targetAi} 
                        onChange={e => setTargetAi(e.target.value)}
                      >
                        <option value="Google Veo (8s)">Google Veo (8s)</option>
                        <option value="Sora">Sora</option>
                        <option value="Kling AI">Kling AI</option>
                        <option value="Luma Dream Machine">Luma Dream Machine</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Video Model</label>
                      <select 
                        className="form-input" 
                        value={videoModel} 
                        onChange={e => setVideoModel(e.target.value)}
                      >
                        <option value="veo_31_lite">Veo 3.1 Lite</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Face Visibility</label>
                      <select 
                        className="form-input" 
                        value={faceVisibility} 
                        onChange={e => setFaceVisibility(e.target.value)}
                      >
                        <option value="Faceless">Faceless</option>
                        <option value="POV">POV</option>
                        <option value="Silhouette">Silhouette</option>
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
                        onChange={e => {
                          const val = parseInt(e.target.value) || 3;
                          setTargetClipsCount(val);
                          if (isBridgingActive && val < bridgeAtClip) {
                            setBridgeAtClip(val);
                          }
                        }}
                        required
                      />
                      <small style={{ color: 'var(--text-muted)' }}>Batas: 3 - 10</small>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Jumlah Kata Per Klip</label>
                      <select 
                        className="form-input" 
                        value={wordsPerClip} 
                        onChange={e => setWordsPerClip(e.target.value)}
                      >
                        <option value="15-16 kata">15-16 kata</option>
                        <option value="17-19 kata">17-19 kata</option>
                        <option value="20-24 kata">20-24 kata</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Visual Style</label>
                      <select 
                        className="form-input" 
                        value={visualStyle} 
                        onChange={e => setVisualStyle(e.target.value)}
                      >
                        <option value="Cinematic">Cinematic</option>
                        <option value="UGC">UGC</option>
                        <option value="Macrophotography">Macrophotography</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Visual Mode</label>
                      <select
                        className="form-input"
                        value={visualMode}
                        onChange={e => setVisualMode(e.target.value)}
                      >
                        <option value="pure_t2v">Pure T2V (Klasik - Text-to-Video untuk semua klip)</option>
                        <option value="hybrid_lock">Hybrid Lock (RE Hybrid & Product Pixel Lock - Double-Pass)</option>
                      </select>
                      <small style={{ color: 'var(--text-muted)' }}>
                        Hybrid Lock menggunakan Double-Pass (T2I - I2V) mulai dari klip transisi (ke-{bridgeAtClip}) untuk menjaga detail produk.
                      </small>
                    </div>
                  </div>
                )}
              </div>

              {/* ACCORDION SECTION 3: Product Bridging Settings */}
              <div style={{ borderBottom: '1px solid var(--border-color)' }}>
                <div 
                  onClick={() => setActiveAccordion(2)} 
                  style={{ padding: '16px 24px', background: activeAccordion === 2 ? 'rgba(59, 130, 246, 0.05)' : 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>3. Product Bridging Settings</span>
                  <span>{activeAccordion === 2 ? '▲' : '▼'}</span>
                </div>
                {activeAccordion === 2 && (
                  <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={isBridgingActive}
                          onChange={e => {
                            const checked = e.target.checked;
                            setIsBridgingActive(checked);
                            if (checked && targetClipsCount < bridgeAtClip) {
                              setTargetClipsCount(bridgeAtClip);
                            }
                          }}
                        />
                        <span className="slider"></span>
                      </label>
                      <strong style={{ fontSize: '0.95rem' }}>🔌 Aktifkan Bridging Promosi Produk</strong>
                    </div>
                    
                    {isBridgingActive && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="form-group">
                          <label className="form-label">Sisipkan Transisi Promosi pada Klip Ke- (X)</label>
                          <input
                            type="number"
                            className="form-input"
                            min="2"
                            value={bridgeAtClip}
                            onChange={e => {
                              const val = parseInt(e.target.value) || 4;
                              if (val < 2) {
                                showToast('Titik transisi minimal dimulai dari klip ke-2', 'error');
                                setBridgeAtClip(2);
                              } else {
                                setBridgeAtClip(val);
                                if (val > targetClipsCount) {
                                  setTargetClipsCount(val);
                                }
                              }
                            }}
                            required
                          />
                          <small style={{ color: 'var(--text-muted)' }}>Syarat: 2 &le; X &le; N</small>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Durasi Bridging Produk (Klip)</label>
                          <select
                            className="form-input"
                            value={bridgeDurationClips}
                            onChange={e => setBridgeDurationClips(parseInt(e.target.value) || 0)}
                            required={isBridgingActive}
                          >
                            <option value="0">0 (Sisa seluruh klip)</option>
                            <option value="1">1 Klip</option>
                            <option value="2">2 Klip</option>
                            <option value="3">3 Klip</option>
                            <option value="4">4 Klip</option>
                            <option value="5">5 Klip</option>
                          </select>
                          <small style={{ color: 'var(--text-muted)' }}>Jumlah klip berturut-turut yang membahas produk. Nilai 0 berarti membahas produk dari klip transisi sampai selesai.</small>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Gaya Promosi (Promotion Style)</label>
                          <select
                            className="form-input"
                            value={promotionStyle}
                            onChange={e => setPromotionStyle(e.target.value)}
                            required={isBridgingActive}
                          >
                            <option value="Softselling">Softselling (Halus / Storytelling)</option>
                            <option value="Hardsell">Hardsell (Penjualan Agresif / Langsung)</option>
                            <option value="Education">Education (Edukatif / Informatif)</option>
                          </select>
                          <small style={{ color: 'var(--text-muted)' }}>Menentukan gaya narasi voiceover promosi di Zona 3</small>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Metode Penyertaan Produk</label>
                          <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
                              <input
                                type="radio"
                                name="bridgingMode"
                                value="select_existing"
                                checked={bridgingMode === 'select_existing'}
                                onChange={e => setBridgingMode(e.target.value)}
                              />
                              Pilih dari Pustaka
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
                              <input
                                type="radio"
                                name="bridgingMode"
                                value="manual_input"
                                checked={bridgingMode === 'manual_input'}
                                onChange={e => setBridgingMode(e.target.value)}
                              />
                              Tulis Manual
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
                              <input
                                type="radio"
                                name="bridgingMode"
                                value="url_extract"
                                checked={bridgingMode === 'url_extract'}
                                onChange={e => setBridgingMode(e.target.value)}
                              />
                              Ekstrak dari URL
                            </label>
                          </div>
                        </div>

                        {bridgingMode === 'select_existing' && (
                          <div className="form-group">
                            <label className="form-label">Pilih Produk Terdaftar</label>
                            <select
                              className="form-input"
                              value={targetProductId}
                              onChange={e => {
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
                              }}
                              required={isBridgingActive && bridgingMode === 'select_existing'}
                            >
                              <option value="">-- Pilih Produk --</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.product_name}
                                </option>
                              ))}
                            </select>
                            {targetProductId && productRefImage && (
                              <div style={{ marginTop: 10, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: 12, borderRadius: 8 }}>
                                <div style={{ color: '#10b981', fontWeight: 600, fontSize: '0.85rem' }}>
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
                        )}

                        {bridgingMode === 'manual_input' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, background: 'var(--bg-primary)' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Nama Produk</label>
                              <input
                                type="text"
                                className="form-input"
                                placeholder="Contoh: Skintific Moisturizer"
                                value={manualProductName}
                                onChange={e => setManualProductName(e.target.value)}
                                required={isBridgingActive && bridgingMode === 'manual_input'}
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Deskripsi Produk</label>
                              <textarea
                                className="form-textarea"
                                style={{ minHeight: 60 }}
                                placeholder="Deskripsi fungsi dan manfaat produk..."
                                value={manualProductDesc}
                                onChange={e => setManualProductDesc(e.target.value)}
                                required={isBridgingActive && bridgingMode === 'manual_input'}
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Unique Selling Point (USP) (Opsional)</label>
                              <input
                                type="text"
                                className="form-input"
                                placeholder="Contoh: Mengunci kelembaban kulit dalam 10 detik"
                                value={manualProductUsp}
                                onChange={e => setManualProductUsp(e.target.value)}
                              />
                            </div>
                          </div>
                        )}

                        {bridgingMode === 'url_extract' && (
                          <div className="form-group">
                            <label className="form-label">Tempel URL Halaman Produk</label>
                            <input
                              type="url"
                              className="form-input"
                              placeholder="https://shopee.co.id/product-url-here"
                              value={productUrl}
                              onChange={e => setProductUrl(e.target.value)}
                              required={isBridgingActive && bridgingMode === 'url_extract'}
                            />
                            <small style={{ color: 'var(--text-muted)' }}>Sistem akan mengunduh konten dari URL ini dan mengekstrak info produk secara otomatis saat analisis dimulai.</small>
                          </div>
                        )}

                        {isBridgingActive && visualMode === 'hybrid_lock' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, background: 'var(--bg-primary)' }}>
                            {bridgingMode === 'url_extract' ? (
                              <div style={{ padding: '8px 12px', background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.3)', borderRadius: 6, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                                💡 Gambar produk reference akan diekstrak dan diunduh secara otomatis dari URL produk target.
                              </div>
                            ) : (
                              <>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                  <label className="form-label">📸 Unggah Foto Produk (Reference Image)</label>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={e => setProductRefImage(e.target.files?.[0] || null)}
                                    className="form-input"
                                    required={isBridgingActive && visualMode === 'hybrid_lock'}
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
                                    required={isBridgingActive && visualMode === 'hybrid_lock'}
                                  />
                                  <small style={{ color: 'var(--text-muted)' }}>Nama berkas unik untuk identifikasi reference image (e.g. youth_retinol_serum.png).</small>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ACCORDION SECTION 4: Visual Swap Overrides */}
              <div style={{ borderBottom: '1px solid var(--border-color)' }}>
                <div 
                  onClick={() => setActiveAccordion(3)} 
                  style={{ padding: '16px 24px', background: activeAccordion === 3 ? 'rgba(59, 130, 246, 0.05)' : 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>4. Visual Swap Overrides</span>
                  <span>{activeAccordion === 3 ? '▲' : '▼'}</span>
                </div>
                {activeAccordion === 3 && (
                  <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={isVsoActive}
                          onChange={e => setIsVsoActive(e.target.checked)}
                        />
                        <span className="slider"></span>
                      </label>
                      <strong style={{ fontSize: '0.95rem' }}>🎭 Aktifkan Visual Swap Overrides</strong>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                      Pilih dari preset kurasi MAKNA untuk mengubah estetika visual video kompetitor secara instan tanpa perlu mengetik prompt dari nol.
                    </p>

                    {isVsoActive && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', gap: 16 }}>
                          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label className="form-label">Konsep Karakter (Framing)</label>
                            <select 
                              className="form-input" 
                              value={characterConcept} 
                              onChange={e => setCharacterConcept(e.target.value)}
                            >
                              <option value="faceless">Faceless (Wajah Terpotong - Mandate 67)</option>
                              <option value="pov">POV (Sudut Pandang Orang Pertama)</option>
                              <option value="silhouette">Siluet Bayangan (Moody/Mysterious)</option>
                              <option value="stylized_3d">3D Stylized Claymation</option>
                            <option value="cartoon_face">Cartoon Face (Kartun Ekspresif)</option>
                            </select>
                          </div>

                          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label className="form-label">Demografi Subjek / Model</label>
                            <select 
                              className="form-input" 
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

                        {/* Dropdown Gaya Animasi - hanya muncul saat mode Semesta Maskot */}
                        {subjectDemographic.startsWith('mascot_universe_') && (
                          <div style={{ display: 'flex', gap: 16 }}>
                            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                              <label className="form-label">🎨 Gaya Estetika Animasi Maskot</label>
                              <select
                                className="form-input"
                                value={visualStylePreset}
                                onChange={e => setVisualStylePreset(e.target.value)}
                              >
                                <option value="3d_claymation_cozy">3D Claymation Cozy (Shaun the Sheep Look)</option>
                                <option value="kawaii_flat_vector">2D Kawaii Flat Vector (Minimalis Jepang)</option>
                                <option value="ghibli_watercolor">Studio Ghibli Watercolor (Cat Air Magis)</option>
                              </select>
                            </div>
                          </div>
                        )}

                        {/* Wardrobe — disembunyikan saat mode Semesta Maskot */}
                        {!subjectDemographic.startsWith('mascot_universe_') && (
                        <div style={{ display: 'flex', gap: 16 }}>
                          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label className="form-label">Pakaian / Wardrobe</label>
                            <select 
                              className="form-input" 
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
                              <option value="custom">-- Tulis Custom Sendiri --</option>
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
                                required={isVsoActive && wardrobeStyle === 'custom'}
                              />
                            )}
                          </div>
                        </div>
                        )}

                        <div style={{ display: 'flex', gap: 16 }}>
                          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label className="form-label">Pencahayaan & Gaya Sinematik (Lighting Ambiance)</label>
                            <select 
                              className="form-input" 
                              value={lightingStyle} 
                              onChange={e => setLightingStyle(e.target.value)}
                            >
                              <option value="random">🎲 Random (Acak)</option>
                              <option value="window_daylight">Soft Window Daylight (Cahaya jendela natural)</option>
                              <option value="golden_hour">Golden Hour Warm Sunset (Sorot sore keemasan)</option>
                              <option value="moody_shadow">Moody Cinematic Shadow (Kontras chiaroscuro dramatis)</option>
                              <option value="studio_softbox">Clean Professional Studio Softbox (Sangat bersih)</option>
                              <option value="lab_cold">Clinical Cold White (Putih lab bersih terang)</option>
                              <option value="cyber_neon">Moody Cyberpunk Blue-Pink Neon (Warna glow modern)</option>
                              <option value="candle_warm">Cozy Dim Candlelight Ambiance (Sangat syahdu hangat)</option>
                              <option value="custom">-- Tulis Custom Sendiri --</option>
                            </select>
                            {lightingStyle === 'custom' && (
                              <input
                                type="text"
                                className="form-input"
                                style={{ marginTop: 8 }}
                                placeholder="Ketik gaya pencahayaan kustom di sini..."
                                value={lightingStyleCustom}
                                onChange={e => setLightingStyleCustom(e.target.value)}
                                required={isVsoActive && lightingStyle === 'custom'}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>



              <div style={{ display: 'flex', gap: 12, padding: 24, borderTop: '1px solid var(--border-color)' }}>
                <button type="submit" className="btn btn-primary" disabled={creating || massUploading} onClick={() => setSubmitStatus('running')}>
                  {productionMode === 'mass' ? (massUploading ? 'Mengunggah...' : '🚀 Buat & Jalankan Massal') : (creating ? 'Membuat...' : '🚀 Buat & Jalankan')}
                </button>
                <button type="submit" className="btn" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.25)' }} disabled={creating || massUploading} onClick={() => setSubmitStatus('draft')}>
                  {productionMode === 'mass' ? (massUploading ? 'Menyimpan...' : '💾 Save as Draft Massal') : (creating ? 'Menyimpan...' : '💾 Save as Draft')}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Batal
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Status Skeduler Card */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          padding: 16, marginBottom: 20,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12
        }}>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>⚙️ Status Skeduler RE Campaign</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>Mengontrol jalannya antrean pembuatan video RE Campaign secara otomatis.</p>
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
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#00b894', display: 'inline-block', boxShadow: '0 0 8px #00b894' }}></span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>SYSTEM POLLER LOGGER</span>
            </div>
            <button onClick={pollLogs} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>[Refresh Log]</button>
          </div>
          <pre ref={terminalRef} style={{ margin: 0, padding: '20px', background: '#07070a', color: '#20c20e', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', maxHeight: '220px', overflowY: 'auto', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
            {terminalLogs}
          </pre>
        </div>

        {/* Brand Filter Selector */}
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
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>🎬 Daftar Kampanye RE</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>🔍 FILTER BRAND:</span>
            <select
              value={filterBrandId}
              onChange={e => setFilterBrandId(e.target.value)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
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

        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 32, textAlign: 'center' }}>Memuat kampanye...</div>
        ) : campaigns.filter(c => filterBrandId === 'all' || c.brand_profile_id === filterBrandId).length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎬</div>
            <p style={{ color: 'var(--text-muted)' }}>Tidak ada kampanye yang cocok dengan filter brand ini.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {campaigns
              .filter(c => filterBrandId === 'all' || c.brand_profile_id === filterBrandId)
              .map(c => {
                const pct = progressPct(c.stats);
                let statusColor = 'var(--text-muted)';
                let statusBg = 'rgba(255,255,255,0.06)';
                let statusBorder = 'rgba(255,255,255,0.1)';
                if (c.status === 'completed') { statusColor = 'var(--success)'; statusBg = 'rgba(46,204,113,0.15)'; statusBorder = 'rgba(46,204,113,0.3)'; }
                else if (c.status === 'running') { statusColor = '#3b82f6'; statusBg = 'rgba(59,130,246,0.15)'; statusBorder = 'rgba(59,130,246,0.3)'; }
                else if (c.status === 'paused') { statusColor = '#fdcb6e'; statusBg = 'rgba(253,203,110,0.15)'; statusBorder = 'rgba(253,203,110,0.3)'; }

                return (
                  <div key={c.id} className="card" style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-sm)' }}>
                    {/* Card Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            background: c.brand_name ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            border: c.brand_name ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
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
                    {c.stats && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                        <div><strong>Total:</strong> <span style={{ color: 'var(--text-primary)' }}>{c.stats.total}</span></div>
                        <div><strong>Scraped:</strong> <span style={{ color: '#3b82f6' }}>{c.stats.scraped}</span></div>
                        <div><strong>Analyzed:</strong> <span style={{ color: 'var(--success)' }}>{c.stats.analyzed}</span></div>
                      </div>
                    )}

                    {/* Progress Bar */}
                    {c.stats && c.stats.total > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ background: 'var(--bg-secondary)', borderRadius: 4, height: 5, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.4s' }} />
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>{pct}% analyzed</div>
                      </div>
                    )}

                    {/* Action Buttons — rata KIRI, selalu terlihat */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12, flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => router.push(`/re-campaigns/${c.id}`)} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                          🔍 Detail
                        </button>

                        {c.status !== 'completed' && (
                          <button type="button" className={`btn btn-sm ${c.status === 'running' ? 'btn-danger' : 'btn-success'}`} onClick={() => toggleStatus(c)} disabled={processingId === c.id} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                            {c.status === 'draft' ? '▶ Run' : (c.status === 'running' ? '⏸ Pause' : '▶ Resume')}
                          </button>
                        )}

                        {c.target_spreadsheet_id && (
                          <a href={`https://docs.google.com/spreadsheets/d/${c.target_spreadsheet_id}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none', fontSize: '0.75rem', padding: '6px 12px' }}>
                            📊 Sheet
                          </a>
                        )}

                        <a href={`/api/campaign-portability/export?campaignId=${c.id}&type=RE`} className="btn btn-secondary btn-sm" style={{ textDecoration: 'none', fontSize: '0.75rem', padding: '6px 12px' }}>
                          📤 Export
                        </a>

                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleCopy(c)} disabled={processingId === c.id} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                          📋 Copy
                        </button>

                        <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteCampaign(c.id)} disabled={processingId === c.id} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                          🗑 Hapus
                        </button>
                      </div>
                      
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.04)', padding: '2px 8px', borderRadius: '4px' }}>
                        🔑 ID: {c.id}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        </div>

        {/* Modal Import Campaign */}
        {showImportModal && (

          <div className="modal-backdrop" onClick={() => setShowImportModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>📥 Import Campaign (.makna)</h3>
                <button className="modal-close" onClick={() => setShowImportModal(false)}>✕</button>
              </div>
              <div style={{ marginTop: 8 }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: '0.9rem' }}>
                  Unggah berkas <code>.makna</code> untuk memindahkan data kampanye RE atau OPC beserta seluruh aset fisiknya secara otomatis.
                </p>
                <form onSubmit={handleImportSubmit}>
                  <div className="form-group">
                    <label className="form-label">Berkas Kampanye (.makna)</label>
                    <input 
                      type="file" 
                      accept=".makna"
                      className="form-input"
                      onChange={e => setImportFile(e.target.files[0])}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                    <button 
                      type="button" 
                      className="btn" 
                      onClick={() => setShowImportModal(false)}
                      style={{ background: 'transparent', border: '1px solid var(--border)' }}
                    >
                      Batal
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={importing}>
                      {importing ? 'Mengimpor...' : 'Mulai Impor'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
