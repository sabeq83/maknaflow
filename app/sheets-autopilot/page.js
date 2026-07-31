'use client';

import Sidebar from '../components/Sidebar';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

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

export default function SheetsAutopilotDashboard() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState([]);
  const [submitStatus, setSubmitStatus] = useState('active');
  const [brandProfiles, setBrandProfiles] = useState([]);
  const [products, setProducts] = useState([]);
  
  // Terminal log state
  const [terminalLogs, setTerminalLogs] = useState('Menginisialisasi log terminal autopilot...\n');
  const [isSyncing, setIsSyncing] = useState(false);
  const [storageProvider, setStorageProvider] = useState('gdrive');
  const terminalRef = useRef(null);

  // Accordion toggle states
  const [openAccordions, setOpenAccordions] = useState({
    basic: true,
    aesthetics: false,
    bridging: false,
    overrides: false,
    workflow: false
  });

  // New campaign form state
  const [accountName, setAccountName] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [campaignType, setCampaignType] = useState(null); // Start with no selection
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [gdriveFolderId, setGdriveFolderId] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('id-ID');
  const [targetDemographic, setTargetDemographic] = useState('genz_casual');
  const [targetDemographicCustom, setTargetDemographicCustom] = useState('');
  const [enableAudioSegment, setEnableAudioSegment] = useState(false);
  const [voiceCast, setVoiceCast] = useState([]);

  // Aesthetics & Visual settings
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [targetAi, setTargetAi] = useState('Google Veo (8s)');
  const [videoModel, setVideoModel] = useState('veo_31_lite');
  const [visualMode, setVisualMode] = useState('hybrid_lock');
  const [wordsPerClip, setWordsPerClip] = useState('17-19 kata');
  const [faceVisibility, setFaceVisibility] = useState('Faceless');
  const [visualStyle, setVisualStyle] = useState('Cinematic');
  const [customInstruction, setCustomInstruction] = useState('');
  const [brandProfileId, setBrandProfileId] = useState('');

  // Product Bridging Settings (Default Inactive)
  const [isBridgingActive, setIsBridgingActive] = useState(false);
  const [targetClipsCount, setTargetClipsCount] = useState(4);
  const [bridgeAtClip, setBridgeAtClip] = useState(2);
  const [bridgeDurationClips, setBridgeDurationClips] = useState(1);
  const [bridgingMode, setBridgingMode] = useState('select_existing');
  const [targetProductId, setTargetProductId] = useState('');
  const [promotionStyle, setPromotionStyle] = useState('Softselling');
  const [narrativeMode, setNarrativeMode] = useState('Storytelling');

  // Visual Swap Overrides (Default Inactive)
  const [isVsoActive, setIsVsoActive] = useState(false);
  const [characterConcept, setCharacterConcept] = useState('faceless');
  const [subjectDemographic, setSubjectDemographic] = useState('syari_classic');
  const [wardrobeStyle, setWardrobeStyle] = useState('amber_terracotta');
  const [wardrobeStyleCustom, setWardrobeStyleCustom] = useState('');
  const [lightingStyle, setLightingStyle] = useState('window_daylight');
  const [lightingStyleCustom, setLightingStyleCustom] = useState('');
  const [visualStylePreset, setVisualStylePreset] = useState('3d_claymation_cozy');

  // Workflow & Audio Settings (Default Inactive)
  const [enableTts, setEnableTts] = useState(false);
  const [enableGlabs, setEnableGlabs] = useState(false);
  const [enableFfmpeg, setEnableFfmpeg] = useState(false);
  const [enableSocialPost, setEnableSocialPost] = useState(false);
  const [voiceProvider, setVoiceProvider] = useState('minimax');
  const [voicePersona, setVoicePersona] = useState('Indonesian_professional_anchor_vv2');
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [voiceVolume, setVoiceVolume] = useState(1.0);
  const [ffmpegSyncOption, setFfmpegSyncOption] = useState('smart_sync');
  const [ffmpegVideoScale, setFfmpegVideoScale] = useState(1.0);
  const [ffmpegSfxVolume, setFfmpegSfxVolume] = useState(0.0);
  const [ffmpegBgmVolume, setFfmpegBgmVolume] = useState(0.15);
  const [ttsModelQuality, setTtsModelQuality] = useState('speech-2.8-turbo');
  const [syncMode, setSyncMode] = useState('auto');
  const [isSchedulerActive, setIsSchedulerActive] = useState(true);
  const [expandedCampaignId, setExpandedCampaignId] = useState(null);

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

  // Fetch campaigns and helpers on mount
  useEffect(() => {
    fetchCampaigns();
    fetchBrandProfiles();
    fetchProducts();
    pollLogs();
    fetchSettings();
    
    // Auto-poll terminal logs every 3 seconds
    const interval = setInterval(pollLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  async function fetchSettings() {
    try {
      const res = await fetch('/api/settings');
      const json = await res.json();
      if (json.success && json.data) {
        setStorageProvider(json.data.storage_provider || 'gdrive');
      }
    } catch (e) {
      console.error('Failed to fetch storage settings:', e);
    }
  }

  async function fetchCampaigns() {
    try {
      const res = await fetch('/api/sheets-autopilot');
      const json = await res.json();
      if (json.success) {
        setCampaigns(json.data);
        if (json.isSchedulerActive !== undefined) {
          setIsSchedulerActive(json.isSchedulerActive);
        }
      }
    } catch (e) {
      console.error('Failed to fetch campaigns:', e);
    }
  }

  async function fetchBrandProfiles() {
    try {
      const res = await fetch('/api/v2/brand-profiles');
      const json = await res.json();
      if (json.success) setBrandProfiles(json.data || []);
    } catch (e) {
      console.error('Failed to fetch brand profiles:', e);
    }
  }

  async function fetchProducts() {
    try {
      const res = await fetch('/api/v2/products');
      const json = await res.json();
      if (json.success) setProducts(json.data || []);
    } catch (e) {
      console.error('Failed to fetch products:', e);
    }
  }

  async function pollLogs() {
    try {
      const res = await fetch(`/api/system-logs?type=autopilot&t=${Date.now()}`);
      if (res.ok) {
        const text = await res.text();
        const lines = text.split('\n');
        const last500 = lines.slice(-500).join('\n');
        setTerminalLogs(last500 || 'Belum ada log aktivitas autopilot.');
      }
    } catch (e) {
      // Ignore network errors on initial log checks
    }
  }

  // Trigger Autopilot Sync background execution
  async function triggerSync() {
    setIsSyncing(true);
    setTerminalLogs(prev => prev + '\n[Mesin Autopilot] Memulai sinkronisasi manual secara asinkron...\n');
    try {
      const res = await fetch('/api/sheets-autopilot/sync-worker', { method: 'POST' });
      const json = await res.json();
      alert(json.message);
      pollLogs();
    } catch (e) {
      alert('Gagal memicu poller sync: ' + e.message);
    }
    setIsSyncing(false);
  }

  // Create new campaign
  async function handleCreateCampaign(e) {
    e.preventDefault();

    if (!campaignName || !spreadsheetId || !campaignType) {
      alert('Nama Kampanye, Tipe Kampanye, dan Spreadsheet ID wajib diisi!');
      return;
    }

    const isMascot = subjectDemographic.startsWith('mascot_universe_');
    const computedVisualOverridesJson = isVsoActive ? JSON.stringify({
      character_concept: characterConcept,
      subject_demographic: subjectDemographic,
      visual_style_preset: isMascot ? visualStylePreset : null,
      wardrobe_style: wardrobeStyle,
      wardrobe_style_custom: wardrobeStyle === 'custom' ? wardrobeStyleCustom.trim() : '',
      lighting_style: lightingStyle,
      lighting_style_custom: lightingStyle === 'custom' ? lightingStyleCustom.trim() : ''
    }) : null;

    const payload = {
      status: submitStatus,
      campaign_name: campaignName,
      campaign_type: campaignType,
      spreadsheet_id: spreadsheetId,
      gdrive_folder_id: gdriveFolderId || null,
      target_language: targetLanguage,
      aspect_ratio: aspectRatio,
      target_ai: targetAi,
      video_model: videoModel,
      visual_mode: visualMode,
      words_per_clip: wordsPerClip,
      face_visibility: faceVisibility,
      custom_instruction: customInstruction,
      brand_profile_id: brandProfileId || null,
      is_bridging_active: campaignType === 'IFC'
        ? (parseInt(bridgeDurationClips) > 0 ? 1 : 0)
        : (isBridgingActive ? 1 : 0),
      target_clips_count: parseInt(targetClipsCount),
      bridge_at_clip: parseInt(bridgeAtClip),
      bridge_duration_clips: parseInt(bridgeDurationClips),
      bridging_mode: bridgingMode,
      target_product_id: targetProductId || null,
      promotion_style: promotionStyle,
      narrative_mode: narrativeMode,
      visual_overrides_json: computedVisualOverridesJson,
      enable_tts: enableTts ? 1 : 0,
      enable_glabs: enableGlabs ? 1 : 0,
      enable_ffmpeg: enableFfmpeg ? 1 : 0,
      enable_social_post: enableSocialPost ? 1 : 0,
      voice_provider: voiceProvider,
      voice_persona: voicePersona,
      voice_speed: parseFloat(voiceSpeed),
      voice_volume: parseFloat(voiceVolume),
      ffmpeg_sync_option: ffmpegSyncOption,
      ffmpeg_video_scale: parseFloat(ffmpegVideoScale),
      ffmpeg_sfx_volume: parseFloat(ffmpegSfxVolume),
      ffmpeg_bgm_volume: parseFloat(ffmpegBgmVolume),
      tts_model_quality: ttsModelQuality,
      visual_style: visualStyle,
      enable_audio_segment: enableAudioSegment ? 1 : 0,
      voice_cast_json: voiceCast.length > 0 ? JSON.stringify({ characters: voiceCast }) : null
    };

    try {
      const res = await fetch('/api/sheets-autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        alert('Kampanye Autopilot berhasil didaftarkan!');
        setCampaignName('');
        setSpreadsheetId('');
        setGdriveFolderId('');
        setCampaignType(null); // Reset selection
        setIsBridgingActive(false);
        setTargetClipsCount(4);
        setBridgeAtClip(2);
        setBridgeDurationClips(1);
        setIsVsoActive(false);
        setCharacterConcept('faceless');
        setSubjectDemographic('syari_classic');
        setWardrobeStyle('amber_terracotta');
        setWardrobeStyleCustom('');
        setLightingStyle('window_daylight');
        setLightingStyleCustom('');
        setVisualStyle('Cinematic');
        setEnableAudioSegment(false);
        setVoiceCast([]);
        fetchCampaigns();
        pollLogs();
      } else {
        alert('Gagal membuat kampanye: ' + json.error);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function toggleGlobalScheduler() {
    try {
      const res = await fetch('/api/sheets-autopilot', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedulerStatus: !isSchedulerActive })
      });
      const json = await res.json();
      if (json.success) {
        setIsSchedulerActive(!isSchedulerActive);
        pollLogs();
      } else {
        alert('Gagal mengubah status skeduler: ' + json.error);
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  async function handleToggleCampaignStatus(id, currentStatus) {
    const newStatus = currentStatus === 'draft' ? 'active' : (currentStatus === 'active' ? 'paused' : 'active');
    try {
      const res = await fetch('/api/sheets-autopilot', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus })
      });
      const json = await res.json();
      if (json.success) {
        fetchCampaigns();
        pollLogs();
      } else {
        alert('Gagal mengubah status kampanye: ' + json.error);
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  async function handleCopy(campaign) {
    try {
      const res = await fetch(`/api/sheets-autopilot?id=${campaign.id}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal mengambil data kampanye');
      }

      const c = data.data.campaign;

      setCampaignName(`Copy of ${c.campaign_name}`);
      setCampaignType(c.campaign_type);
      setSpreadsheetId(c.spreadsheet_id);
      setGdriveFolderId(c.gdrive_folder_id || '');
      setTargetLanguage(c.target_language || 'id-ID');
      setAspectRatio(c.aspect_ratio || '9:16');
      setTargetAi(c.target_ai || 'Google Veo (8s)');
      setVideoModel(c.video_model || 'veo_31_lite');
      setVisualMode(c.visual_mode || 'hybrid_lock');
      setWordsPerClip(c.words_per_clip || '17-19 kata');
      setFaceVisibility(c.face_visibility || 'Faceless');
      setCustomInstruction(c.custom_instruction || '');
      setBrandProfileId(c.brand_profile_id || '');
      setIsBridgingActive(c.is_bridging_active === 1);
      setTargetClipsCount(c.target_clips_count || 4);
      setBridgeAtClip(c.bridge_at_clip || 2);
      setBridgeDurationClips(c.bridge_duration_clips || 1);
      setBridgingMode(c.bridging_mode || 'select_existing');
      setTargetProductId(c.target_product_id || '');
      setPromotionStyle(c.promotion_style || 'Softselling');
      setNarrativeMode(c.narrative_mode || 'Storytelling');
      setVisualStyle(c.visual_style || 'Cinematic');
      setEnableTts(c.enable_tts === 1);
      setEnableGlabs(c.enable_glabs === 1);
      setEnableFfmpeg(c.enable_ffmpeg === 1);
      setEnableSocialPost(c.enable_social_post === 1);
      setVoiceProvider(c.voice_provider || 'minimax');
      setVoicePersona(c.voice_persona || 'Indonesian_professional_anchor_vv2');
      setVoiceSpeed(c.voice_speed !== undefined ? c.voice_speed : 1.0);
      setVoiceVolume(c.voice_volume !== undefined ? c.voice_volume : 1.0);
      setFfmpegSyncOption(c.ffmpeg_sync_option || 'smart_sync');
      setFfmpegVideoScale(c.ffmpeg_video_scale !== undefined ? c.ffmpeg_video_scale : 1.0);
      setFfmpegSfxVolume(c.ffmpeg_sfx_volume !== undefined ? c.ffmpeg_sfx_volume : 0.0);
      setFfmpegBgmVolume(c.ffmpeg_bgm_volume !== undefined ? c.ffmpeg_bgm_volume : 0.15);
      setTtsModelQuality(c.tts_model_quality || 'speech-2.8-turbo');
      setSyncMode(c.ffmpeg_sync_option === 'smart_sync' ? 'auto' : 'manual');
      setEnableAudioSegment(c.enable_audio_segment === 1);
      try { setVoiceCast(c.voice_cast_json ? JSON.parse(c.voice_cast_json)?.characters || [] : []); } catch(e) { setVoiceCast([]); }

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
        } catch (e) {
          console.error(e);
        }
      } else {
        setIsVsoActive(false);
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
      alert('Konfigurasi kampanye autopilot berhasil disalin ke form!');
    } catch (err) {
      alert('Gagal menyalin kampanye: ' + err.message);
    }
  }


  async function handleDeleteCampaign(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus kampanye autopilot ini? Semua log pekerjaan terkait akan dihapus.')) return;
    try {
      const res = await fetch(`/api/sheets-autopilot?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        alert('Kampanye berhasil dihapus.');
        fetchCampaigns();
        pollLogs();
      } else {
        alert('Gagal menghapus: ' + json.error);
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  const toggleAccordion = (section) => {
    setOpenAccordions(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-container">
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2>🤖 Google Sheets Autopilot</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                <p style={{ margin: 0 }}>MAKNA v10.5.5 — Asynchronous Batch Poller, JIT Sourcing, & G-Drive Sync</p>
                <span style={{ 
                  fontSize: '0.7rem', 
                  background: isSchedulerActive ? 'rgba(46, 204, 113, 0.15)' : 'rgba(235, 77, 75, 0.15)', 
                  color: isSchedulerActive ? 'var(--success)' : 'var(--danger)', 
                  border: `1px solid ${isSchedulerActive ? 'rgba(46, 204, 113, 0.3)' : 'rgba(235, 77, 75, 0.3)'}`,
                  padding: '2px 8px', 
                  borderRadius: '4px',
                  fontWeight: 'bold'
                }}>
                  {isSchedulerActive ? '🟢 SKEDULER AKTIF' : '🔴 SKEDULER MATI'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button 
                onClick={toggleGlobalScheduler}
                className={`btn ${isSchedulerActive ? 'btn-danger' : 'btn-success'}`}
                style={{
                  boxShadow: isSchedulerActive ? '0 0 15px rgba(235, 77, 75, 0.4)' : '0 0 15px rgba(46, 204, 113, 0.4)',
                  border: isSchedulerActive ? '1px solid rgba(235, 77, 75, 0.6)' : '1px solid rgba(46, 204, 113, 0.6)'
                }}
              >
                {isSchedulerActive ? '🛑 STOP SKEDULER' : '▶️ START SKEDULER'}
              </button>

              <button 
                className={`btn ${isSyncing ? 'btn-secondary' : 'btn-primary'}`}
                onClick={triggerSync}
                disabled={isSyncing}
                style={{
                  boxShadow: '0 0 15px var(--accent-glow)',
                  border: '1px solid var(--accent-light)'
                }}
              >
                {isSyncing ? '⏳ Syncing...' : '🔄 Run Autopilot Sync'}
              </button>
            </div>
          </div>

          {/* Activity Terminal */}
          <div className="card" style={{ padding: '0', background: '#07070a', border: '1px solid var(--border)', marginBottom: '24px' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0b0b12' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#00b894', display: 'inline-block', boxShadow: '0 0 8px #00b894' }}></span>
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
                background: '#07070a', 
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

          {/* Full Page Vertical Stack */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Form Setup Kampanye Baru (Full Width) */}
            <div className="card" style={{ width: '100%' }}>
              <div className="card-title" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '20px' }}>
                <span>🎯 Setup Kampanye Autopilot Baru</span>
              </div>
              
              <form onSubmit={handleCreateCampaign}>
                
                {/* 3 Side-by-side Selector Cards (Hidden when selection is active) */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '10px', fontWeight: '500' }}>
                    Pilih Fitur / Tipe Autopilot
                  </label>
                  
                  {campaignType === null ? (
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      <div 
                        className="campaign-card"
                        onClick={() => setCampaignType('RE')}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="icon" style={{ fontSize: '1.8rem', marginBottom: '8px' }}>🎬</div>
                        <div className="title" style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-primary)' }}>Reverse Engineering (RE)</div>
                        <div className="desc" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Klon & modifikasi video kompetitor</div>
                      </div>

                      <div 
                        className="campaign-card"
                        onClick={() => setCampaignType('OPC')}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="icon" style={{ fontSize: '1.8rem', marginBottom: '8px' }}>🌱</div>
                        <div className="title" style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-primary)' }}>Organic Pillar (OPC)</div>
                        <div className="desc" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Generasi pilar konten & visual JIT</div>
                      </div>

                      <div 
                        className="campaign-card"
                        onClick={() => setCampaignType('IFC')}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="icon" style={{ fontSize: '1.8rem', marginBottom: '8px' }}>🚀</div>
                        <div className="title" style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-primary)' }}>Instant Factory (IFC)</div>
                        <div className="desc" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Produksi massal dari naskah + asset produk</div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Only Show the Selected Card with a Switcher Button */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        background: 'rgba(255,255,255,0.02)', 
                        border: '1px solid var(--accent)', 
                        borderRadius: '12px', 
                        padding: '16px 20px',
                        boxShadow: '0 0 15px var(--accent-glow)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <span style={{ fontSize: '2.2rem' }}>
                            {campaignType === 'RE' ? '🎬' : (campaignType === 'OPC' ? '🌱' : '🚀')}
                          </span>
                          <div>
                            <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                              {campaignType === 'RE' ? 'Reverse Engineering (RE) Active' : (campaignType === 'OPC' ? 'Organic Pillar (OPC) Active' : 'Instant Factory (IFC) Active')}
                            </strong>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {campaignType === 'RE' ? 'Mendekonstruksi narasi viral kompetitor serta mengintegrasikan jembatan promosi produk secara presisi.' : (campaignType === 'OPC' ? 'Menyusun pilar konten strategis dengan visual JIT.' : 'Menerjemahkan database produk langsung menjadi ribuan aset video.')}
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
                    </div>
                  )}

                  {/* Spreadsheet Header Reminder (only shown after selection) */}
                  {campaignType !== null && (
                    <div style={{ 
                      marginTop: '16px', 
                      padding: '12px 16px', 
                      background: 'rgba(255,255,255,0.02)', 
                      borderRadius: '8px', 
                      border: '1px dashed var(--border)',
                      fontSize: '0.8rem'
                    }}>
                      {campaignType === 'RE' && (
                        <p style={{ color: 'var(--text-secondary)' }}>
                          ℹ️ <strong>Kolom Spreadsheet Wajib (Tab: <code>CAMPAIGN_RE</code>):</strong> <br/>
                          <code>url_source</code>, <code>review_status</code> (diisi <em>Approved</em>), <code>Nama Produk</code>, <code>Link Aff</code>, <code>Link Product</code> (opsional untuk bridging).
                        </p>
                      )}
                      {campaignType === 'OPC' && (
                        <p style={{ color: 'var(--text-secondary)' }}>
                          ℹ️ <strong>Kolom Spreadsheet Wajib (Tab: <code>CAMPAIGN_OPC</code>):</strong> <br/>
                          <code>pilar_content</code>, <code>hook</code>, <code>visual_action</code>, <code>review_status</code> (diisi <em>Approved</em>), <code>Nama Produk</code>, <code>Link Product</code>.
                        </p>
                      )}
                      {campaignType === 'IFC' && (
                        <p style={{ color: 'var(--text-secondary)' }}>
                          ℹ️ <strong>Kolom Spreadsheet Wajib (Tab: <code>CAMPAIGN_IFC</code>):</strong> <br/>
                          <code>nama_produk</code>, <code>usp</code>, <code>tautan_gambar_produk</code>, <code>hook_visual_action_custom_instruction</code>, <code>review_status</code> (diisi <em>Approved</em>).
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Form fields appear dynamically after campaignType is chosen */}
                {campaignType !== null && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    
                    {/* Accordion 1: Basic Creative Strategy */}
                    <div className="accordion-item" style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                      <div 
                        className="accordion-header" 
                        onClick={() => toggleAccordion('basic')}
                        style={{ padding: '14px 18px', background: 'var(--bg-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontWeight: '600', fontSize: '0.88rem' }}
                      >
                        <span>📁 1. Basic Creative Strategy</span>
                        <span>{openAccordions.basic ? '▲' : '▼'}</span>
                      </div>
                      {openAccordions.basic && (
                        <div className="accordion-content" style={{ padding: '18px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div>
                            <label className="form-label">🏷️ Nama Akun (Brand Account)</label>
                            <select
                              className="form-input"
                              value={accountName}
                              onChange={e => {
                                const newAcc = e.target.value;
                                setAccountName(newAcc);
                                const now = new Date();
                                const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
                                setCampaignName(`[ AUTOPILOT ${dateStr} ] - ${newAcc ? newAcc + ' - ' : ''}`);
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
                          <div>
                            <label className="form-label">Nama Kampanye</label>
                            <input 
                              type="text" 
                              className="form-input" 
                              placeholder="e.g. Campaign Serum Brightening"
                              value={campaignName} 
                              onChange={e => setCampaignName(e.target.value)} 
                              required
                            />
                          </div>
                          <div>
                            <label className="form-label">Google Spreadsheet ID</label>
                            <input 
                              type="text" 
                              className="form-input" 
                              placeholder="e.g. 1aBcDeFgHiJkLmNoP..."
                              value={spreadsheetId} 
                              onChange={e => setSpreadsheetId(e.target.value)} 
                              required
                            />
                          </div>
                          <div>
                            <label className="form-label">
                              {storageProvider === 'nextcloud' ? 'Parent Folder Nextcloud (Opsional)' : 'Parent Folder ID Google Drive (Opsional)'}
                            </label>
                            <input 
                              type="text" 
                              className="form-input" 
                              placeholder={storageProvider === 'nextcloud' ? "e.g. /MAKNA_Video_Generations" : "Biarkan kosong untuk membuat folder otomatis di root"}
                              value={gdriveFolderId} 
                              onChange={e => setGdriveFolderId(e.target.value)} 
                            />
                            {storageProvider === 'nextcloud' && (
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Tentukan path folder Nextcloud kustom. Jika kosong, folder dengan nama kampanye akan dibuat di bawah path default Nextcloud Anda.
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="form-label">Target Language</label>
                            <select className="form-input" value={targetLanguage} onChange={e => setTargetLanguage(e.target.value)}>
                              <option value="id-ID">Indonesian (Bahasa Indonesia)</option>
                              <option value="en-US">English (US)</option>
                            </select>
                          </div>
                          <div>
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
                          <div>
                            <label className="form-label">🎙 Audio Segment (per Klip)</label>
                            <select
                              className="form-input"
                              value={enableAudioSegment ? 'enabled' : 'disabled'}
                              onChange={e => setEnableAudioSegment(e.target.value === 'enabled')}
                              id="sheets-audio-segment-toggle"
                            >
                              <option value="disabled">❌ Disabled (Default)</option>
                              <option value="enabled">✅ Enabled — Embed Audio Segment per Beat</option>
                            </select>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                              Jika Enabled, prompt LAYER 2 akan menyertakan <code>(Audio Segment: "...")</code> per segmen 2 detik. Optimal untuk mode mascot/kartun.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Accordion 2: Aesthetics & Visual Settings */}
                    <div className="accordion-item" style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                      <div 
                        className="accordion-header" 
                        onClick={() => toggleAccordion('aesthetics')}
                        style={{ padding: '14px 18px', background: 'var(--bg-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontWeight: '600', fontSize: '0.88rem' }}
                      >
                        <span>🎨 2. Aesthetics & Visual Settings</span>
                        <span>{openAccordions.aesthetics ? '▲' : '▼'}</span>
                      </div>
                      {openAccordions.aesthetics && (
                        <div className="accordion-content" style={{ padding: '18px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                              <label className="form-label">Aspect Ratio</label>
                              <select className="form-input" value={aspectRatio} onChange={e => setAspectRatio(e.target.value)}>
                                <option value="9:16">9:16 (Vertical)</option>
                                <option value="1:1">1:1 (Square)</option>
                                <option value="16:9">16:9 (Landscape)</option>
                              </select>
                            </div>
                            <div>
                              <label className="form-label">Target AI Engine</label>
                              <select className="form-input" value={targetAi} onChange={e => setTargetAi(e.target.value)}>
                                <option value="Google Veo (8s)">Google Veo (8s)</option>
                                <option value="Luma Dream Machine">Luma Dream Machine</option>
                                <option value="Kling AI">Kling AI</option>
                              </select>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                              <label className="form-label">Video Model</label>
                              <select className="form-input" value={videoModel} onChange={e => setVideoModel(e.target.value)}>
                                <option value="veo_31_lite">Veo 3.1 Lite</option>
                                <option value="veo_3_1">Veo 3.1 Standard</option>
                              </select>
                            </div>
                            <div>
                              <label className="form-label">Visual Mode</label>
                              <select className="form-input" value={visualMode} onChange={e => setVisualMode(e.target.value)}>
                                <option value="hybrid_lock">Hybrid Lock (Recommended)</option>
                                <option value="pure_t2v">Pure Text-to-Video</option>
                              </select>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                              <label className="form-label">Words Per Clip</label>
                              <select className="form-input" value={wordsPerClip} onChange={e => setWordsPerClip(e.target.value)}>
                                <option value="17-19 kata">17-19 kata</option>
                                <option value="12-15 kata">12-15 kata</option>
                                <option value="10-12 kata">10-12 kata</option>
                              </select>
                            </div>
                            <div>
                              <label className="form-label">Face Visibility</label>
                              <select className="form-input" value={faceVisibility} onChange={e => setFaceVisibility(e.target.value)}>
                                <option value="Faceless">Faceless (No face shown)</option>
                                <option value="POV">First-Person POV</option>
                                <option value="Silhouette">Silhouette</option>
                                <option value="cartoon_face">Cartoon Face (Kartun Ekspresif)</option>
                              </select>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                              <label className="form-label">Total Clips Target</label>
                              <input 
                                type="number" 
                                className="form-input" 
                                value={targetClipsCount}
                                onChange={e => setTargetClipsCount(e.target.value)}
                                min="1"
                              />
                            </div>
                            <div>
                              <label className="form-label">Visual Style</label>
                              <select className="form-input" value={visualStyle} onChange={e => setVisualStyle(e.target.value)}>
                                <option value="Cinematic">Cinematic</option>
                                <option value="UGC">UGC</option>
                                <option value="Macrophotography">Macrophotography</option>
                              </select>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                              <label className="form-label">Narrative Mode</label>
                              <select className="form-input" value={narrativeMode} onChange={e => setNarrativeMode(e.target.value)}>
                                <option value="Storytelling">Storytelling (Bercerita / Daily-life)</option>
                                <option value="Problem-Solution">Problem-Solution (Masalah & Solusi)</option>
                                <option value="Educational">Educational (Tutorial / Penjelasan Ilmiah)</option>
                              </select>
                            </div>
                            <div>
                              <label className="form-label">Brand Profile</label>
                              <select className="form-input" value={brandProfileId} onChange={e => setBrandProfileId(e.target.value)}>
                                <option value="">-- Pilih Brand Profile (Opsional) --</option>
                                {brandProfiles.map(bp => (
                                  <option key={bp.id} value={bp.id}>{bp.brand_name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="form-label">Custom Instruction</label>
                            <textarea 
                              className="form-input" 
                              rows="2" 
                              placeholder="e.g. Masukkan kata 'Viral' di hook adegan"
                              value={customInstruction}
                              onChange={e => setCustomInstruction(e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Accordion 3: Product Reveal / Bridging Settings */}
                    <div className="accordion-item" style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                      <div 
                        className="accordion-header" 
                        onClick={() => toggleAccordion('bridging')}
                        style={{ padding: '14px 18px', background: 'var(--bg-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontWeight: '600', fontSize: '0.88rem' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{campaignType === 'IFC' ? '🔗 3. IFC Product Reveal Settings' : '🔗 3. Product Bridging Settings'}</span>
                          <span style={{ 
                            fontSize: '0.75rem', 
                            background: (campaignType === 'IFC' ? parseInt(bridgeDurationClips) > 0 : isBridgingActive) ? 'var(--success-glow)' : 'var(--border)', 
                            color: (campaignType === 'IFC' ? parseInt(bridgeDurationClips) > 0 : isBridgingActive) ? 'var(--success)' : 'var(--text-muted)', 
                            padding: '2px 6px', 
                            borderRadius: '4px' 
                          }}>
                            {(campaignType === 'IFC' ? parseInt(bridgeDurationClips) > 0 : isBridgingActive) ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <span>{openAccordions.bridging ? '▲' : '▼'}</span>
                      </div>
                      {openAccordions.bridging && (
                        <div className="accordion-content" style={{ padding: '18px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {campaignType !== 'IFC' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                              <label className="switch">
                                <input 
                                  type="checkbox" 
                                  id="is_bridging_active"
                                  checked={isBridgingActive} 
                                  onChange={e => setIsBridgingActive(e.target.checked)} 
                                />
                                <span className="slider round"></span>
                              </label>
                              <label htmlFor="is_bridging_active" style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-primary)', cursor: 'pointer' }}>
                                Aktifkan Product Bridging
                              </label>
                            </div>
                          )}

                          {(campaignType === 'IFC' || isBridgingActive) && (
                            <>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                  <label className="form-label">
                                    {campaignType === 'IFC' ? 'Product Reveal Klip Ke (N)' : 'Bridge at Clip'}
                                  </label>
                                  <input 
                                    type="number" 
                                    className="form-input" 
                                    value={bridgeAtClip}
                                    onChange={e => setBridgeAtClip(e.target.value)}
                                    min="1"
                                  />
                                </div>
                                <div>
                                  <label className="form-label">
                                    {campaignType === 'IFC' ? 'Jumlah Durasi Klip (X)' : 'Bridge Duration (Clips)'}
                                  </label>
                                  <input 
                                    type="number" 
                                    className="form-input" 
                                    value={bridgeDurationClips}
                                    onChange={e => setBridgeDurationClips(e.target.value)}
                                    min="0"
                                    placeholder={campaignType === 'IFC' ? "Isi 0 untuk menonaktifkan produk" : ""}
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="form-label">Promotion Style</label>
                                <select className="form-input" value={promotionStyle} onChange={e => setPromotionStyle(e.target.value)}>
                                  <option value="Softselling">Softselling (Relatable & Solutive)</option>
                                  <option value="Hardsell">Hardsell (Direct & Urgent)</option>
                                  <option value="Education">Education (Informative & Fact-based)</option>
                                </select>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Accordion 4: Visual Swap Overrides (Default Inactive) */}
                    <div className="accordion-item" style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                      <div 
                        className="accordion-header" 
                        onClick={() => toggleAccordion('overrides')}
                        style={{ padding: '14px 18px', background: 'var(--bg-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontWeight: '600', fontSize: '0.88rem' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>⚡ 4. Visual Swap Overrides (VSO)</span>
                          <span style={{ fontSize: '0.75rem', background: isVsoActive ? 'var(--success-glow)' : 'var(--border)', color: isVsoActive ? 'var(--success)' : 'var(--text-muted)', padding: '2px 6px', borderRadius: '4px' }}>
                            {isVsoActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <span>{openAccordions.overrides ? '▲' : '▼'}</span>
                      </div>
                      {openAccordions.overrides && (
                        <div className="accordion-content" style={{ padding: '18px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                            <label className="switch">
                              <input
                                type="checkbox"
                                checked={isVsoActive}
                                onChange={e => setIsVsoActive(e.target.checked)}
                              />
                              <span className="slider round"></span>
                            </label>
                            <label style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-primary)', cursor: 'pointer' }} onClick={() => setIsVsoActive(!isVsoActive)}>
                              Aktifkan Visual Swap Overrides
                            </label>
                          </div>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>
                            Pilih dari preset kurasi MAKNA untuk mengubah estetika visual video kompetitor secara instan tanpa perlu mengetik prompt dari nol.
                          </p>

                          {isVsoActive && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
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

                                <div>
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

                              {/* Gaya Animasi — hanya muncul saat mode Semesta Maskot */}
                              {subjectDemographic.startsWith('mascot_universe_') && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                  <div>
                                    <label className="form-label">🎨 Gaya Estetika Animasi Maskot</label>
                                    <select className="form-input" value={visualStylePreset} onChange={e => setVisualStylePreset(e.target.value)}>
                                      <option value="3d_claymation_cozy">3D Claymation Cozy (Shaun the Sheep Look)</option>
                                      <option value="kawaii_flat_vector">2D Kawaii Flat Vector (Minimalis Jepang)</option>
                                      <option value="ghibli_watercolor">Studio Ghibli Watercolor (Cat Air Magis)</option>
                                    </select>
                                  </div>
                                </div>
                              )}

                              {/* Wardrobe — disembunyikan saat mode Semesta Maskot */}
                              {!subjectDemographic.startsWith('mascot_universe_') && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                  <div>
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
                                        style={{ marginTop: '8px' }}
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

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
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
                                      style={{ marginTop: '8px' }}
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

                    {/* Accordion 5: Workflow & Audio Settings (Default Inactive) */}
                    <div className="accordion-item" style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                      <div 
                        className="accordion-header" 
                        onClick={() => toggleAccordion('workflow')}
                        style={{ padding: '14px 18px', background: 'var(--bg-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontWeight: '600', fontSize: '0.88rem' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>⚙️ 5. Workflow & Audio Settings</span>
                          <span style={{ fontSize: '0.75rem', background: (enableTts || enableGlabs || enableFfmpeg || enableSocialPost) ? 'var(--success-glow)' : 'var(--border)', color: (enableTts || enableGlabs || enableFfmpeg || enableSocialPost) ? 'var(--success)' : 'var(--text-muted)', padding: '2px 6px', borderRadius: '4px' }}>
                            {(enableTts || enableGlabs || enableFfmpeg || enableSocialPost) ? 'Active Stages' : 'All Off'}
                          </span>
                        </div>
                        <span>{openAccordions.workflow ? '▲' : '▼'}</span>
                      </div>
                      {openAccordions.workflow && (
                        <div className="accordion-content" style={{ padding: '18px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          
                          {/* Active Stages Checklist */}
                          <div>
                            <label className="form-label" style={{ marginBottom: '10px' }}>Tahapan Workflow Aktif</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                              
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Enable TTS (Voiceover)</span>
                                <label className="switch">
                                  <input type="checkbox" checked={enableTts} onChange={e => setEnableTts(e.target.checked)} />
                                  <span className="slider round"></span>
                                </label>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Enable G-Labs (AI Video)</span>
                                <label className="switch">
                                  <input type="checkbox" checked={enableGlabs} onChange={e => setEnableGlabs(e.target.checked)} />
                                  <span className="slider round"></span>
                                </label>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Enable FFmpeg Muxing</span>
                                <label className="switch">
                                  <input type="checkbox" checked={enableFfmpeg} onChange={e => setEnableFfmpeg(e.target.checked)} />
                                  <span className="slider round"></span>
                                </label>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Enable Social Draft Post</span>
                                <label className="switch">
                                  <input type="checkbox" checked={enableSocialPost} onChange={e => setEnableSocialPost(e.target.checked)} />
                                  <span className="slider round"></span>
                                </label>
                              </div>

                            </div>
                          </div>

                          {/* Audio settings */}
                          {enableTts && (
                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                              <label className="form-label">TTS Audio Engine Settings</label>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
                                <div>
                                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Voice Provider</label>
                                  <select className="form-input" value={voiceProvider} onChange={e => setVoiceProvider(e.target.value)}>
                                    <option value="minimax">MiniMax VO Engine</option>
                                    <option value="gemini">Gemini TTS Engine</option>
                                  </select>
                                </div>
                                <div>
                                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Voice Persona</label>
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
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' }}>
                                <div>
                                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Speed ({voiceSpeed}x)</label>
                                  <input type="range" min="0.5" max="2.0" step="0.1" value={voiceSpeed} onChange={e => setVoiceSpeed(parseFloat(e.target.value))} style={{ width: '100%' }} />
                                </div>
                                <div>
                                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Volume ({voiceVolume}x)</label>
                                  <input type="range" min="0.0" max="1.0" step="0.1" value={voiceVolume} onChange={e => setVoiceVolume(parseFloat(e.target.value))} style={{ width: '100%' }} />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* FFmpeg Video Studio Settings */}
                          {enableFfmpeg && (
                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <label className="form-label">FFmpeg Video Studio Settings</label>
                              
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>Mode Sinkronisasi Audio-Video</label>
                                <div style={{ display: 'flex', gap: 24, marginTop: 2 }}>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                                    <input
                                      type="radio"
                                      name="syncModeAutopilot"
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
                                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                                    <input
                                      type="radio"
                                      name="syncModeAutopilot"
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
                                  <div className="form-group" style={{ flex: 1, marginTop: 4 }}>
                                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Metode Manual</label>
                                    <select className="form-input" value={ffmpegSyncOption} onChange={e => setFfmpegSyncOption(e.target.value)}>
                                      <option value="shortest">shortest (Potong video - Default)</option>
                                      <option value="loop">loop (Ulang video)</option>
                                      <option value="stretch">stretch (Ubah kecepatan)</option>
                                      <option value="freeze">freeze (Tahan frame terakhir)</option>
                                    </select>
                                  </div>
                                )}
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                  <label className="form-label" style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
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
                                    onChange={e => setFfmpegVideoScale(Number(e.target.value))} 
                                    style={{ width: '100%', accentColor: 'var(--accent)' }} 
                                  />
                                </div>
                                <div>
                                  <label className="form-label" style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
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
                                </div>
                              </div>

                              <div>
                                <label className="form-label" style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
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
                              </div>
                            </div>
                          )}

                        </div>
                      )}
                    </div>

                  </div>
                )}

                {campaignType !== null && (
                  <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                      type="submit"
                      onClick={() => setSubmitStatus('draft')}
                      className="btn btn-secondary"
                      style={{ padding: '10px 24px' }}
                    >
                      💾 Save as Draft
                    </button>
                    <button
                      type="submit"
                      onClick={() => setSubmitStatus('active')}
                      className="btn btn-primary"
                      style={{ padding: '10px 24px' }}
                    >
                      🚀 Buat & Jalankan
                    </button>
                  </div>
                )}

              </form>
            </div>

            {/* List Kampanye Terdaftar (Moved below the form, full width) */}
            <div className="card" style={{ width: '100%' }}>
              <div className="card-title" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '20px' }}>
                <span>📋 Kampanye Autopilot Terdaftar</span>
              </div>

              {campaigns.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Belum ada kampanye sheets autopilot terdaftar.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {campaigns.map(c => {
                    let statusColor = 'var(--text-muted)';
                    let statusBg = 'rgba(255,255,255,0.06)';
                    let statusBorder = 'rgba(255,255,255,0.1)';
                    if (c.status === 'active') { statusColor = 'var(--success)'; statusBg = 'rgba(46,204,113,0.15)'; statusBorder = 'rgba(46,204,113,0.3)'; }
                    else if (c.status === 'paused') { statusColor = '#fdcb6e'; statusBg = 'rgba(253,203,110,0.15)'; statusBorder = 'rgba(253,203,110,0.3)'; }

                    const typeIcon = c.campaign_type === 'RE' ? '🎬' : (c.campaign_type === 'OPC' ? '🌱' : '🚀');

                    return (
                      <div key={c.id} className="card" style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-sm)' }}>
                        {/* Card Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '1.1rem' }}>{typeIcon}</span>
                            <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{c.campaign_name}</strong>
                            <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: 4 }}>{c.campaign_type}</span>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 8, background: statusBg, color: statusColor, border: `1px solid ${statusBorder}` }}>
                              {c.status === 'active' ? 'RUNNING' : (c.status === 'draft' ? 'DRAFT' : 'PAUSED')}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {c.created_at ? new Date(c.created_at).toLocaleString('id-ID') : ''}
                          </div>
                        </div>

                        {/* Metadata Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                          <div><strong>Bahasa:</strong> {c.target_language}</div>
                          <div><strong>Rasio:</strong> {c.aspect_ratio} | {c.target_ai}</div>
                          <div><strong>Bridging:</strong> {c.is_bridging_active === 1 ? `Aktif (Klip ${c.bridge_at_clip})` : 'Nonaktif'}</div>
                          <div><strong>Baris:</strong> <span style={{ color: 'var(--success)' }}>{c.completed_jobs || 0}</span> / {c.total_jobs || 0} selesai, <span style={{ color: 'var(--danger)' }}>{c.failed_jobs || 0} gagal</span></div>
                        </div>

                        {/* Pipeline Status Badges */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                          {[
                            { label: 'Proses', val: c.processing_jobs || 0 },
                            { label: 'Selesai', val: c.completed_jobs || 0 },
                            { label: 'Gagal', val: c.failed_jobs || 0 }
                          ].map((st, idx) => (
                            <span key={idx} style={{
                              padding: '3px 8px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 600,
                              background: idx === 1 && st.val > 0 ? 'rgba(16,185,129,0.15)' : idx === 2 && st.val > 0 ? 'rgba(235,77,75,0.15)' : 'rgba(255,255,255,0.05)',
                              color: idx === 1 && st.val > 0 ? '#10b981' : idx === 2 && st.val > 0 ? 'var(--danger)' : 'var(--text-muted)',
                              border: '1px solid rgba(255,255,255,0.08)'
                            }}>
                              {st.label}: {st.val}
                            </span>
                          ))}
                        </div>

                        {/* Action Buttons — rata KIRI, selalu terlihat */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-start', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
                          <a href={`/sheets-autopilot/${c.id}`} className="btn btn-primary btn-sm" style={{ textDecoration: 'none', fontSize: '0.75rem', padding: '6px 12px' }}>
                            🔍 Detail
                          </a>

                          <button onClick={() => handleToggleCampaignStatus(c.id, c.status)} className="btn btn-sm" style={{ color: c.status === 'active' ? 'var(--danger)' : 'var(--success)', background: c.status === 'active' ? 'rgba(235,77,75,0.1)' : 'rgba(46,204,113,0.1)', borderColor: c.status === 'active' ? 'rgba(235, 77, 75, 0.2)' : 'rgba(46, 204, 113, 0.2)', fontSize: '0.75rem', padding: '6px 12px' }}>
                            {c.status === 'active' ? '⏸ Pause' : '▶ Resume'}
                          </button>

                          <a href={`https://docs.google.com/spreadsheets/d/${c.spreadsheet_id}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none', fontSize: '0.75rem', padding: '6px 12px' }}>
                            📊 Sheet
                          </a>

                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleCopy(c)} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                            📋 Copy
                          </button>

                          <button onClick={() => handleDeleteCampaign(c.id)} className="btn btn-danger btn-sm" style={{ background: '#dc2626', color: '#fff', borderColor: '#dc2626', fontSize: '0.75rem', padding: '6px 12px' }}>
                            🗑 Hapus
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          </div>

        </div>
      </main>

      <style jsx global>{`
        .campaign-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 18px;
          cursor: pointer;
          transition: all 0.3s ease;
          flex: 1;
          min-width: 180px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .campaign-card:hover {
          transform: translateY(-2px);
          border-color: var(--accent-light);
          box-shadow: 0 4px 15px var(--accent-glow);
        }
        .form-label {
          display: block;
          font-size: 0.78rem;
          color: var(--text-secondary);
          margin-bottom: 6px;
          font-weight: 600;
        }
        .form-input {
          width: 100%;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 8px 12px;
          color: var(--text-primary);
          font-size: 0.82rem;
          transition: all var(--transition);
        }
        .form-input:focus {
          border-color: var(--accent);
          background: rgba(255,255,255,0.05);
          outline: none;
        }
        
        /* Premium Toggle Switch Styles */
        .switch {
          position: relative;
          display: inline-block;
          width: 38px;
          height: 20px;
          flex-shrink: 0;
        }
        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: rgba(255, 255, 255, 0.08);
          transition: 0.3s;
          border: 1px solid var(--border);
        }
        .slider:before {
          position: absolute;
          content: "";
          height: 12px;
          width: 12px;
          left: 3px;
          bottom: 3px;
          background-color: var(--text-muted);
          transition: 0.3s;
        }
        input:checked + .slider {
          background-color: var(--accent);
          border-color: var(--accent-light);
        }
        input:checked + .slider:before {
          transform: translateX(18px);
          background-color: #fff;
        }
        .slider.round {
          border-radius: 20px;
        }
        .slider.round:before {
          border-radius: 50%;
        }
        .slider:hover {
          border-color: var(--border-hover);
        }
        input:checked + .slider:hover {
          background-color: var(--accent-light);
        }
      `}</style>
    </div>
  );
}
