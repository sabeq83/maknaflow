'use client';

import Sidebar from '../components/Sidebar';
import ImportPlannerModal from '../components/ImportPlannerModal';
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

export default function OrganicPillarPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('running');
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showPlannerModal, setShowPlannerModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);

  // Scheduler & Logger States
  const [isSchedulerActive, setIsSchedulerActive] = useState(true);
  const [terminalLogs, setTerminalLogs] = useState('Menginisialisasi log OPC...');
  const [expandedCampaignId, setExpandedCampaignId] = useState(null);
  const logIntervalRef = useRef(null);
  const terminalRef = useRef(null);

  // V8.6 Mass Production States
  const [productionMode, setProductionMode] = useState('single'); // 'single' or 'mass'
  const [parsedRows, setParsedRows] = useState([]);
  const [uploadingImages, setUploadingImages] = useState({}); // { rowIndex: boolean }
  const [manualImages, setManualImages] = useState({}); // { rowIndex: { filePath, filename } }

  // Accordion active index
  const [activeAccordion, setActiveAccordion] = useState(0);

  // Section 1: Basic Creative Strategy
  const [accountName, setAccountName] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [contentPillar, setContentPillar] = useState('');
  const [customHook, setCustomHook] = useState('');
  const [visualActionGuideline, setVisualActionGuideline] = useState('');
  const [customInstruction, setCustomInstruction] = useState('akhiran skrip/voiceover : produk ori ada di keranjang ya!');
  const [brandProfiles, setBrandProfiles] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [filterBrandId, setFilterBrandId] = useState('all');

  // Section 2: Aesthetics & Visual Settings
  const [narrativeMode, setNarrativeMode] = useState('Storytelling');
  const [visualStyle, setVisualStyle] = useState('Cinematic');
  const [targetAi, setTargetAi] = useState('Google Veo (8s)');
  const [videoModel, setVideoModel] = useState('veo_31_lite');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [faceVisibility, setFaceVisibility] = useState('Faceless');
  const [wordsPerClip, setWordsPerClip] = useState('17-19 kata');

  // Section 3: Product Bridging Settings
  const [isBridgingActive, setIsBridgingActive] = useState(false);
  const [targetClipsCount, setTargetClipsCount] = useState(4);
  const [bridgeAtClip, setBridgeAtClip] = useState(2);
  const [bridgeDurationClips, setBridgeDurationClips] = useState(1);
  const [promotionStyle, setPromotionStyle] = useState('Softselling');
  const [bridgingMode, setBridgingMode] = useState('select_existing');
  const [products, setProducts] = useState([]);
  const [targetProductId, setTargetProductId] = useState('');
  const [manualProductName, setManualProductName] = useState('');
  const [manualProductDesc, setManualProductDesc] = useState('');
  const [manualProductUsp, setManualProductUsp] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [productRefImage, setProductRefImage] = useState(null);
  const [productRefImagePath, setProductRefImagePath] = useState(null);
  const [productFilenameDeclare, setProductFilenameDeclare] = useState('');
  const [visualMode, setVisualMode] = useState('hybrid_lock');

  // Section 4: Visual Swap Overrides
  const [isVsoActive, setIsVsoActive] = useState(false);
  const [characterConcept, setCharacterConcept] = useState('faceless');
  const [subjectDemographic, setSubjectDemographic] = useState('syari_classic');
  const [wardrobeStyle, setWardrobeStyle] = useState('amber_terracotta');
  const [wardrobeStyleCustom, setWardrobeStyleCustom] = useState('');
  const [lightingStyle, setLightingStyle] = useState('window_daylight');
  const [lightingStyleCustom, setLightingStyleCustom] = useState('');
  const [visualStylePreset, setVisualStylePreset] = useState('3d_claymation_cozy');

  // Section 5: Workflow & Audio Settings
  const [enableTts, setEnableTts] = useState(false);
  const [voiceProvider, setVoiceProvider] = useState('minimax');
  const [voicePersona, setVoicePersona] = useState('Indonesian_SweetGirl');
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [voiceVolume, setVoiceVolume] = useState(1.0);
  const [enableGlabs, setEnableGlabs] = useState(false);
  const [enableFfmpeg, setEnableFfmpeg] = useState(true);
  const [enableSocialPost, setEnableSocialPost] = useState(false);
  const [postYoutube, setPostYoutube] = useState(false);
  const [ttsModelQuality, setTtsModelQuality] = useState('speech-2.8-turbo');
  const [nextcloudParentFolder, setNextcloudParentFolder] = useState('/MAKNA_Assets');
  const [sfxSetting, setSfxSetting] = useState('without_sfx');
  const [enableAudioSegment, setEnableAudioSegment] = useState(false);
  const [voiceCast, setVoiceCast] = useState([]);
  const [enableVoAudit, setEnableVoAudit] = useState(1); // 0 = No, 1 = Yes
  const [postTiktok, setPostTiktok] = useState(false);
  const [postFacebook, setPostFacebook] = useState(false);
  const [facebookPages, setFacebookPages] = useState([]);
  const [facebookPageId, setFacebookPageId] = useState('');
  const [facebookServerUrl, setFacebookServerUrl] = useState('');
  const [fbDraftMode, setFbDraftMode] = useState('auto');
  const [uploadMarkdown, setUploadMarkdown] = useState(true);
  const [uploadSpreadsheet, setUploadSpreadsheet] = useState(true);
  const [targetLanguage, setTargetLanguage] = useState('id-ID');
  const [targetDemographic, setTargetDemographic] = useState('genz_casual');
  const [targetDemographicCustom, setTargetDemographicCustom] = useState('');

  const [syncMode, setSyncMode] = useState('auto');
  const [ffmpegSyncOption, setFfmpegSyncOption] = useState('smart_sync');
  const [ffmpegVideoScale, setFfmpegVideoScale] = useState(1.0);
  const [ffmpegSfxVolume, setFfmpegSfxVolume] = useState(0.0);
  const [ffmpegBgmVolume, setFfmpegBgmVolume] = useState(0.0);

  const router = useRouter();

  useEffect(() => {
    if (!enableTts || !enableGlabs) {
      setEnableFfmpeg(false);
    }
  }, [enableTts, enableGlabs]);

  useEffect(() => {
    const today = new Date();
    const yy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yy}${mm}${dd}`;
    const accStr = accountName ? `${accountName} - ` : '';
    setCampaignName(`[OPC ${dateStr}] - ${accStr}`);
  }, [accountName]);

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
      const res = await fetch('/api/v2/pillar-campaigns/scheduler-control');
      const data = await res.json();
      if (data.success) setIsSchedulerActive(data.isSchedulerActive);
    } catch (e) {}
  }

  async function pollLogs() {
    try {
      const res = await fetch(`/api/system-logs?type=opc&t=${Date.now()}`);
      if (res.ok) {
        const text = await res.text();
        const lines = text.split('\n');
        const last500 = lines.slice(-500).join('\n');
        setTerminalLogs(last500 || 'Belum ada log aktivitas OPC.');
      }
    } catch (e) {}
  }

  async function toggleGlobalScheduler() {
    try {
      const res = await fetch('/api/v2/pillar-campaigns/scheduler-control', {
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
      const res = await fetch('/api/v2/pillar-campaigns');
      const data = await res.json();
      if (data.campaigns) setCampaigns(data.campaigns);
      if (data.isSchedulerActive !== undefined) setIsSchedulerActive(data.isSchedulerActive);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function downloadTemplate() {
    const headers = [
      "Pilar Konten",
      "Hook",
      "Visual Action (Macro)",
      "Nama Produk",
      "Deskripsi Produk",
      "USP Produk",
      "Custom Instruction",
      "URL Produk Shopee/Toped (Otomatis)",
      "Tautan Gambar Produk (Opsional Manual)"
    ];
    const row1 = [
      "Pentingnya Skin Barrier",
      "Muka merah perih bukan karena jerawat!",
      "Mengoleskan krim di tangan, fokus ke tekstur.",
      "Ceramide Gel",
      "Pelembab untuk memperbaiki skin barrier.",
      "5X Ceramide, meredakan kemerahan 24 jam.",
      "Gunakan bahasa gaul Jakarta.",
      "",
      ""
    ];
    const row2 = [
      "Kesalahan Cuci Muka",
      "Stop cuci muka pakai sabun mandi!",
      "Air mengalir di wastafel estetik, busa melimpah.",
      "",
      "",
      "",
      "Jangan sebutkan harga.",
      "https://shopee.co.id/Skintific-5x-Ceramide-Low-pH-Cleanser-80ml",
      ""
    ];
    const csvContent = "\uFEFF" + [headers, row1, row2].map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "opc_mass_production_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
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
          const normalizedRow = {};
          for (const key of Object.keys(row)) {
            normalizedRow[key.trim().toLowerCase()] = row[key];
          }
          for (const alias of aliases) {
            const normalizedAlias = alias.trim().toLowerCase();
            if (normalizedRow[normalizedAlias] !== undefined) {
              return String(normalizedRow[normalizedAlias]).trim();
            }
          }
          return '';
        };

        const mapped = data.map((row, idx) => {
          return {
            row_number: idx + 1,
            content_pillar: getRowVal(row, ['Pilar Konten', 'pilar_content', 'pilar content', 'content_pillar', 'content pillar', 'topik', 'topic', 'pilar']),
            custom_hook: getRowVal(row, ['Hook', 'custom_hook', 'naskah hook', 'naskah_hook']),
            visual_action_guideline: getRowVal(row, ['Visual Action (Macro)', 'Visual Action', 'visual_action', 'visual_action_guideline', 'panduan visual']),
            product_name: getRowVal(row, ['Nama Produk', 'product_name', 'nama_produk', 'product name', 'nama produk']),
            product_desc: getRowVal(row, ['Deskripsi Produk', 'product_desc', 'product_description', 'deskripsi_produk', 'deskripsi produk', 'product description']),
            product_usp: getRowVal(row, ['USP Produk', 'product_usp', 'usp', 'usp_produk', 'usp produk']),
            custom_instruction: getRowVal(row, ['Custom Instruction', 'custom_instruction', 'instruksi custom']),
            source_product_url: getRowVal(row, ['URL Produk Shopee/Toped (Otomatis)', 'source_product_url', 'url_produk', 'product_url', 'url produk', 'link product', 'link_product', 'link produk', 'url produk', 'url product', 'url_product', 'product link', 'product_link']),
            product_image_url: getRowVal(row, ['Tautan Gambar Produk (Opsional Manual)', 'product_image_url', 'image_url', 'tautan_gambar', 'tautan_gambar_produk', 'tautan gambar produk', 'tautan gambar', 'product image url', 'product_image_url'])
          };
        });
        
        setParsedRows(mapped);
        showToast(`Berhasil membaca ${mapped.length} baris dari file.`);
      } catch (err) {
        showToast(`Gagal membaca file: ${err.message}`, 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleRowImageChange = async (rowIndex, file) => {
    if (!file) return;
    setUploadingImages(prev => ({ ...prev, [rowIndex]: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/v2/pillar-campaigns/bulk/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setManualImages(prev => ({
        ...prev,
        [rowIndex]: {
          filePath: data.filePath,
          filename: data.filename
        }
      }));
      showToast(`Gambar untuk baris #${rowIndex + 1} berhasil diunggah.`);
    } catch (err) {
      showToast(`Gagal mengunggah gambar: ${err.message}`, 'error');
    } finally {
      setUploadingImages(prev => ({ ...prev, [rowIndex]: false }));
    }
  };

  async function handleCreate(e) {
    e.preventDefault();

    if (!campaignName.trim()) {
      showToast('Nama Kampanye wajib diisi.', 'error');
      return;
    }

    if (productionMode === 'mass') {
      if (parsedRows.length === 0) {
        showToast('Unggah file matriks konten terlebih dahulu.', 'error');
        return;
      }
      
      if (isBridgingActive) {
        for (const row of parsedRows) {
          const hasUrl = row.source_product_url && row.source_product_url.trim() !== '';
          
          if (!hasUrl) {
            // Manual input row: all fields must be complete, and image uploaded/linked if hybrid_lock
            const hasManualName = row.product_name && row.product_name.trim() !== '';
            const hasManualDesc = row.product_desc && row.product_desc.trim() !== '';
            const hasManualUsp = row.product_usp && row.product_usp.trim() !== '';
            const manualImage = manualImages[row.row_number - 1];
            const hasImageUrl = row.product_image_url && row.product_image_url.trim() !== '';

            if (!hasManualName || !hasManualDesc || !hasManualUsp) {
              showToast(`Baris #${row.row_number} diinput secara manual tetapi data produk belum lengkap (Nama, Deskripsi, dan USP wajib diisi).`, 'error');
              return;
            }

            if (visualMode === 'hybrid_lock' && !manualImage && !hasImageUrl) {
              showToast(`Baris #${row.row_number} diinput secara manual tetapi belum memiliki Gambar Produk untuk mode Hybrid Lock (Unggah gambar via UI atau lampirkan URL gambar di CSV).`, 'error');
              return;
            }
          }
        }
      }

      setCreating(true);
      try {
        const finalRows = parsedRows.map((row, idx) => {
          const manualImage = manualImages[idx];
          return {
            ...row,
            product_ref_image_path: manualImage ? manualImage.filePath : null,
            product_filename_declare: manualImage ? manualImage.filename : null,
            product_image_url: row.product_image_url || ''
          };
        });

        const isMascot = subjectDemographic.startsWith('mascot_universe_');
        const vsoData = isVsoActive ? {
          character_concept: characterConcept,
          subject_demographic: subjectDemographic,
          visual_style_preset: isMascot ? visualStylePreset : null,
          wardrobe_style: wardrobeStyle,
          wardrobe_style_custom: wardrobeStyle === 'custom' ? wardrobeStyleCustom.trim() : '',
          lighting_style: lightingStyle,
          lighting_style_custom: lightingStyle === 'custom' ? lightingStyleCustom.trim() : ''
        } : null;

        const global_settings = {
          status: submitStatus,
          custom_instruction: customInstruction,
          brand_profile_id: selectedBrandId || null,
          narrative_mode: narrativeMode,
          visual_style: visualStyle,
          face_visibility: faceVisibility,
          is_bridging_active: isBridgingActive,
          target_clips_count: targetClipsCount,
          bridge_at_clip: bridgeAtClip,
          bridging_mode: 'select_existing',
          aspect_ratio: aspectRatio,
          target_ai: targetAi,
          video_model: videoModel,
          visual_mode: visualMode,
          visual_overrides_json: vsoData ? JSON.stringify(vsoData) : null,
          enable_tts: enableTts,
          enable_glabs: enableGlabs,
          enable_ffmpeg: enableFfmpeg,
          enable_social_post: enableSocialPost,
          upload_markdown: uploadMarkdown,
          upload_spreadsheet: uploadSpreadsheet,
          voice_provider: voiceProvider,
          voice_persona: voicePersona,
          tts_model_quality: ttsModelQuality,
          words_per_clip: wordsPerClip,
          voice_speed: voiceSpeed,
          voice_volume: voiceVolume,
          target_language: targetLanguage,
          local_scheduler: 1,
          ffmpeg_sync_option: ffmpegSyncOption,
          ffmpeg_video_scale: ffmpegVideoScale,
          ffmpeg_sfx_volume: ffmpegSfxVolume,
          ffmpeg_bgm_volume: ffmpegBgmVolume,
          target_spreadsheet_id: '',
          nextcloud_parent_folder: nextcloudParentFolder.trim(),
          bridge_duration_clips: Number(bridgeDurationClips),
          enable_vo_audit: enableVoAudit ? 1 : 0
        };

        const res = await fetch('/api/v2/pillar-campaigns/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaign_name: campaignName.trim(),
            global_settings,
            rows_data: finalRows
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        showToast(`OPC Mass Campaign "${campaignName}" dengan ${finalRows.length} video berhasil dibuat.`);
        
        setCampaignName('');
        setParsedRows([]);
        setManualImages({});
        setShowForm(false);
        fetchCampaigns();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setCreating(false);
      }
      return;
    }

    if (!contentPillar.trim() || !customHook.trim() || !visualActionGuideline.trim()) {
      showToast('Nama Kampanye, Pilar Konten, Hook, dan Visual Action wajib diisi.', 'error');
      return;
    }

    if (isBridgingActive) {
      if (bridgeAtClip < 2 || bridgeAtClip > targetClipsCount) {
        showToast(`Titik transisi harus berada di antara klip ke-2 hingga ke-${targetClipsCount}.`, 'error');
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
      if (visualMode === 'hybrid_lock') {
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
      formData.append('account_name', accountName.trim());
      formData.append('content_pillar', contentPillar.trim());
      formData.append('custom_hook', customHook.trim());
      formData.append('visual_action_guideline', visualActionGuideline.trim());
      formData.append('custom_instruction', customInstruction);
      formData.append('brand_profile_id', selectedBrandId || '');
      formData.append('narrative_mode', narrativeMode);
      formData.append('visual_style', visualStyle);
      formData.append('face_visibility', faceVisibility);
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
      formData.append('post_youtube_draft', '0');
      formData.append('post_tiktok_draft', '0');
      formData.append('post_facebook_draft', enableSocialPost ? '1' : '0');
      formData.append('facebook_page_id', facebookPageId || '');
      formData.append('facebook_server_url', facebookServerUrl || '');
      formData.append('fb_draft_mode', fbDraftMode);
      formData.append('voice_provider', voiceProvider);
      formData.append('voice_persona', voicePersona);
      formData.append('aspect_ratio', aspectRatio);
      formData.append('target_ai', targetAi);
      formData.append('video_model', videoModel);
      formData.append('words_per_clip', wordsPerClip);
      formData.append('enable_tts', enableTts ? '1' : '0');
      formData.append('enable_glabs', enableGlabs ? '1' : '0');
      formData.append('enable_ffmpeg', enableFfmpeg ? '1' : '0');
      formData.append('enable_social_post', enableSocialPost ? '1' : '0');
      formData.append('upload_markdown', uploadMarkdown ? '1' : '0');
      formData.append('upload_spreadsheet', uploadSpreadsheet ? '1' : '0');
      formData.append('visual_mode', visualMode);
      formData.append('tts_model_quality', ttsModelQuality);
      formData.append('voice_speed', String(voiceSpeed));
      formData.append('voice_volume', String(voiceVolume));
      formData.append('target_language', targetLanguage);
      formData.append('target_demographic', targetDemographic);
      formData.append('target_demographic_custom', targetDemographicCustom);
      formData.append('ffmpeg_sync_option', ffmpegSyncOption);
      formData.append('ffmpeg_video_scale', String(ffmpegVideoScale));
      formData.append('ffmpeg_sfx_volume', String(ffmpegSfxVolume));
      formData.append('ffmpeg_bgm_volume', String(ffmpegBgmVolume));
      formData.append('nextcloud_parent_folder', nextcloudParentFolder);
      formData.append('target_spreadsheet_id', '');
      formData.append('sfx_setting', sfxSetting);
      formData.append('enable_audio_segment', enableAudioSegment);
      if (voiceCast.length > 0) formData.append('voice_cast_json', JSON.stringify({ characters: voiceCast }));
      formData.append('enable_vo_audit', enableVoAudit ? '1' : '0');

      formData.append('status', submitStatus);

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

      if (isBridgingActive && visualMode === 'hybrid_lock') {
        if (productRefImage) {
          formData.append('product_media', productRefImage);
        } else if (productRefImagePath) {
          formData.append('product_ref_image_path', productRefImagePath);
        }
        formData.append('product_filename_declare', productFilenameDeclare.trim());
      }

      const res = await fetch('/api/v2/pillar-campaigns', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(`OPC Campaign "${campaignName}" berhasil didaftarkan.`);
      
      // Reset Form fields
      setCampaignName('');
      setNextcloudParentFolder('MAKNA_Production_Final');
      setSfxSetting('without_sfx');
      setEnableAudioSegment(false);
      setVoiceCast([]);
      setContentPillar('');
      setCustomHook('');
      setVisualActionGuideline('');
      setCustomInstruction('');
      setSelectedBrandId('');
      
      setIsBridgingActive(false);
      setProductRefImage(null);
      setProductRefImagePath(null);
      setProductFilenameDeclare('');
      setIsVsoActive(false);
      setEnableGlabs(false);
      setEnableTts(false);
      setUploadMarkdown(false);
      setUploadSpreadsheet(false);
      setTtsModelQuality('speech-2.8-turbo');
      setTargetLanguage('id-ID');
      setEnableSocialPost(false);
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
      const res = await fetch(`/api/v2/pillar-campaigns/${campaign.id}`, {
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
      const res = await fetch(`/api/v2/pillar-campaigns/${campaign.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil data kampanye');

      const c = data.campaign;
      const items = data.items || [];

      setCampaignName(`Copy of ${c.campaign_name}`);
      setNextcloudParentFolder(c.nextcloud_parent_folder || 'MAKNA_Production_Final');
      setSfxSetting(c.sfx_setting || 'without_sfx');
      setEnableAudioSegment(c.enable_audio_segment || false);
      try { setVoiceCast(c.voice_cast_json ? JSON.parse(c.voice_cast_json)?.characters || [] : []); } catch(e) { setVoiceCast([]); }
      setCustomInstruction(c.custom_instruction || '');
      setSelectedBrandId(c.brand_profile_id || '');
      setNarrativeMode(c.narrative_mode || 'Storytelling');
      setVisualStyle(c.visual_style || 'Cinematic');
      setTargetAi(c.target_ai || 'Google Veo (8s)');
      setVideoModel(c.video_model || 'veo_31_lite');
      setAspectRatio(c.aspect_ratio || '9:16');
      setFaceVisibility(c.face_visibility || 'Faceless');
      setWordsPerClip(c.words_per_clip || '17-19 kata');

      setIsBridgingActive(c.is_bridging_active === 1);
      setTargetClipsCount(c.target_clips_count || 4);
      setBridgeAtClip(c.bridge_at_clip || 2);
      setBridgeDurationClips(c.bridge_duration_clips !== undefined ? c.bridge_duration_clips : 1);
      setPromotionStyle(c.promotion_style || 'Softselling');
      setBridgingMode(c.bridging_mode || 'select_existing');
      setTargetProductId(c.target_product_id || '');
      
      setManualProductName(c.product_name || '');
      setManualProductDesc(c.product_desc || '');
      setManualProductUsp(c.product_usp || '');
      setProductUrl(c.source_product_url || '');
      setVisualMode(c.visual_mode || 'hybrid_lock');
      setProductRefImagePath(c.product_ref_image_path || null);
      setProductFilenameDeclare(c.product_filename_declare || '');

      setVoiceProvider(c.voice_provider || 'minimax');
      setVoicePersona(c.voice_persona || 'Indonesian_SweetGirl');
      setVoiceSpeed(c.voice_speed !== undefined ? c.voice_speed : 1.0);
      setVoiceVolume(c.voice_volume !== undefined ? c.voice_volume : 1.0);
      setEnableTts(c.enable_tts === 1);
      setEnableGlabs(c.enable_glabs === 1);
      setEnableFfmpeg(c.enable_ffmpeg === 1);
      setEnableSocialPost(c.enable_social_post === 1 || c.post_facebook_draft === 1);
      setPostYoutube(false);
      setPostTiktok(false);
      setPostFacebook(c.post_facebook_draft === 1);
      setFacebookPageId(c.facebook_page_id || (facebookPages.length > 0 ? facebookPages[0].id : ''));
      setFacebookServerUrl(c.facebook_server_url || '');
      setFbDraftMode(c.fb_draft_mode || 'auto');
      setTtsModelQuality(c.tts_model_quality || 'speech-2.8-turbo');
      setUploadMarkdown(c.upload_markdown === 1);
      setUploadSpreadsheet(c.upload_spreadsheet === 1);
      setTargetLanguage(c.target_language || 'id-ID');

      setFfmpegSyncOption(c.ffmpeg_sync_option || 'smart_sync');
      setFfmpegVideoScale(c.ffmpeg_video_scale !== undefined ? c.ffmpeg_video_scale : 1.0);
      setFfmpegSfxVolume(c.ffmpeg_sfx_volume !== undefined ? c.ffmpeg_sfx_volume : 0.0);
      setFfmpegBgmVolume(c.ffmpeg_bgm_volume !== undefined ? c.ffmpeg_bgm_volume : 0.15);

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
        } catch (e) {}
      } else {
        setIsVsoActive(false);
      }

      if (c.is_mass_production === 1) {
        setProductionMode('mass');
        const mapped = items.map(item => {
          try {
            const payload = JSON.parse(item.row_creative_payload);
            return {
              row_number: payload.row_number,
              content_pillar: payload.content_pillar || '',
              custom_hook: payload.custom_hook || '',
              visual_action_guideline: payload.visual_action_guideline || '',
              product_name: payload.product_name || '',
              product_desc: payload.product_desc || '',
              product_usp: payload.product_usp || '',
              custom_instruction: payload.custom_instruction || '',
              source_product_url: payload.source_product_url || '',
              product_image_url: payload.product_image_url || ''
            };
          } catch (e) {
            return null;
          }
        }).filter(Boolean);
        setParsedRows(mapped);

        const imageMap = {};
        items.forEach((item, idx) => {
          try {
            const payload = JSON.parse(item.row_creative_payload);
            if (payload.product_ref_image_path) {
              imageMap[idx] = {
                filePath: payload.product_ref_image_path,
                filename: payload.product_filename_declare || 'product_image.png'
              };
            }
          } catch (e) {}
        });
        setManualImages(imageMap);
      } else {
        setProductionMode('single');
        setContentPillar(c.content_pillar || '');
        setCustomHook(c.custom_hook || '');
        setVisualActionGuideline(c.visual_action_guideline || '');
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
    if (!confirm('Yakin ingin menghapus kampanye organik ini beserta item di dalamnya?')) return;
    setProcessingId(id);
    try {
      const res = await fetch(`/api/v2/pillar-campaigns/${id}`, { method: 'DELETE' });
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

  function renderProgressBar(stats) {
    if (!stats || stats.total === 0) return null;
    const items = [
      { name: 'Generated', count: stats.generated, color: '#3b82f6' },
      { name: 'Audio', count: stats.tts_completed, color: '#ec4899' },
      { name: 'Visual', count: stats.visual_completed, color: '#10b981' }
    ];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 180 }}>
        {items.map((it, idx) => {
          const pct = Math.min(100, Math.round((it.count / stats.total) * 100));
          return (
            <div key={idx} style={{ fontSize: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span>{it.name}</span>
                <span>{pct}%</span>
              </div>
              <div style={{ height: 4, background: 'var(--border-color)', borderRadius: 2, marginTop: 2, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: it.color, borderRadius: 2 }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto' }}>
          <div className="page-header">
            <div>
              <h1 className="page-title">🌱 Organic Pillar Campaign</h1>
              <p className="page-subtitle">Rancang storyboard & video organik sandwich (Hook ➜ Product Bridge ➜ Educational Value)</p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                className="btn" 
                style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)', border: '1px solid #6366f1', color: '#ffffff', fontWeight: 600 }} 
                onClick={() => setShowPlannerModal(true)}
              >
                📋 Import Content Planner
              </button>
              <button 
                className="btn" 
                style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} 
                onClick={() => setShowImportModal(true)}
              >
                📥 Import Campaign (.makna)
              </button>
              <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
                {showForm ? '✕ Tutup Form' : '+ New OPC Campaign'}
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
              <div style={{ padding: '20px 24px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--accent-color)' }}>✦</span> Konfigurasi Baru Organic Pillar Campaign
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>MAKNA V8.5 Sandwich Protocol</div>
              </div>

              <form onSubmit={handleCreate}>
                
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
                            setCampaignName(`[ OPC ${dateStr} ] - ${newAcc ? newAcc + ' - ' : ''}`);
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
                          placeholder="Contoh: [OPC 20260725] - nutribake - "
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
                        <label className="form-label">🎙 Audio Segment (per Klip)</label>
                        <select
                          className="form-input"
                          value={enableAudioSegment ? 'enabled' : 'disabled'}
                          onChange={e => setEnableAudioSegment(e.target.value === 'enabled')}
                          id="opc-audio-segment-toggle"
                        >
                          <option value="disabled">❌ Disabled (Default)</option>
                          <option value="enabled">✅ Enabled — Embed Audio Segment per Beat</option>
                        </select>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Jika Enabled, prompt LAYER 2 akan menyertakan <code>(Audio Segment: "...")</code> per segmen 2 detik.
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
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Custom Instruction (Opsional)</label>
                        <textarea
                          className="form-textarea"
                          style={{ minHeight: 80 }}
                          placeholder="Instruksi tambahan untuk Gemini AI (misal: Hindari kata 'guys', gunakan gaya bahasa ilmiah...)"
                          value={customInstruction}
                          onChange={e => setCustomInstruction(e.target.value)}
                        />
                      </div>
                      
                      {productionMode === 'single' && (
                        <>
                          <div className="form-group">
                            <label className="form-label">Pilar Konten (Content Pillar)</label>
                            <textarea
                              className="form-textarea"
                              style={{ minHeight: 80 }}
                              placeholder="Topik edukasi/pilar kreatif. Contoh: Pentingnya double cleansing untuk kulit berminyak, mitos sabun muka berbusa..."
                              value={contentPillar}
                              onChange={e => setContentPillar(e.target.value)}
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Naskah Hook Awal (Klip 1)</label>
                            <textarea
                              className="form-textarea"
                              style={{ minHeight: 80 }}
                              placeholder="Hook pembuka video. Contoh: Jangan pernah cuci muka pakai sabun ini kalau ga mau kulit lo ngelupas!"
                              value={customHook}
                              onChange={e => setCustomHook(e.target.value)}
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Panduan Aksi Visual (Visual Action Guideline)</label>
                            <textarea
                              className="form-textarea"
                              style={{ minHeight: 80 }}
                              placeholder="Panduan adegan visual umum. Contoh: Wanita berhijab menunjukkan wajah berminyak, menuangkan toner ke kapas..."
                              value={visualActionGuideline}
                              onChange={e => setVisualActionGuideline(e.target.value)}
                              required
                            />
                          </div>
                        </>
                      )}

                      {productionMode === 'mass' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Upload Matriks Konten (.csv / .xlsx)</span>
                            <button 
                              type="button" 
                              onClick={downloadTemplate}
                              className="btn" 
                              style={{ 
                                padding: '6px 12px', 
                                fontSize: '0.8rem', 
                                background: 'rgba(59, 130, 246, 0.1)', 
                                color: 'var(--accent-color)', 
                                border: '1px solid var(--accent-color)' 
                              }}
                            >
                              📥 Download Template .csv
                            </button>
                          </div>
                          
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
                                handleFileUpload({ target: { files } });
                              }
                            }}
                            onClick={() => document.getElementById('massFileUploader').click()}
                          >
                            <span style={{ fontSize: '2rem' }}>📂</span>
                            <div style={{ marginTop: 8, fontWeight: 500 }}>Seret & Lepas file .csv atau .xlsx Anda di sini</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--accent-color)', marginTop: 12, padding: '6px 14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 8, maxWidth: 650, display: 'inline-block', lineHeight: 1.4, textAlign: 'left', border: '1px solid rgba(255,255,255,0.05)' }}>
                               💡 <b>Petunjuk OPC Massal:</b> Setiap baris wajib memiliki kolom <b>Pilar Konten</b>, <b>Hook</b>, <b>Visual Action</b>, dan <b>link_product</b> (untuk JIT Sourcing otomatis, pengunduhan gambar produk, & optimasi AI). Format ini diselaraskan dengan Sheets Autopilot agar berkas dapat digunakan secara kompatibel.
                               <a 
                                 href="/opc_mass_template.csv" 
                                 download 
                                 onClick={(e) => e.stopPropagation()} 
                                 style={{ display: 'block', marginTop: 6, color: 'var(--accent-light)', textDecoration: 'underline', fontWeight: 'bold' }}
                                >
                                 📥 Unduh Template CSV OPC Massal
                               </a>
                             </div>
                            <input 
                              id="massFileUploader" 
                              type="file" 
                              accept=".csv,.xlsx" 
                              onChange={handleFileUpload} 
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
                              <div className="table-responsive" style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                                <table className="table" style={{ width: '100%', fontSize: '0.8rem' }}>
                                  <thead>
                                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                      <th style={{ padding: 8 }}>No</th>
                                      <th style={{ padding: 8 }}>Pilar Konten</th>
                                      <th style={{ padding: 8 }}>Hook</th>
                                      <th style={{ padding: 8 }}>Visual Action</th>
                                      {isBridgingActive && <th style={{ padding: 8 }}>Produk / URL</th>}
                                      {isBridgingActive && visualMode === 'hybrid_lock' && <th style={{ padding: 8 }}>Foto Produk</th>}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {parsedRows.map((row, idx) => {
                                      const hasUrl = row.source_product_url && row.source_product_url.trim() !== '';
                                      const hasManual = row.product_name && row.product_name.trim() !== '';
                                      const manualImg = manualImages[idx];
                                      return (
                                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                          <td style={{ padding: 8, textAlign: 'center' }}>{row.row_number}</td>
                                          <td style={{ padding: 8 }}>{row.content_pillar}</td>
                                          <td style={{ padding: 8 }}>{row.custom_hook}</td>
                                          <td style={{ padding: 8 }}>{row.visual_action_guideline}</td>
                                          {isBridgingActive && (
                                            <td style={{ padding: 8 }}>
                                              {hasUrl ? (
                                                <span style={{ color: 'var(--accent-color)', wordBreak: 'break-all' }}>{row.source_product_url}</span>
                                              ) : hasManual ? (
                                                <div>
                                                  <strong>{row.product_name}</strong>
                                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.product_desc.slice(0, 30)}...</div>
                                                </div>
                                              ) : (
                                                <span style={{ color: '#ef4444' }}>Tidak ada produk</span>
                                              )}
                                            </td>
                                          )}
                                          {isBridgingActive && visualMode === 'hybrid_lock' && (
                                            <td style={{ padding: 8 }}>
                                              {hasUrl ? (
                                                <span style={{ color: 'var(--text-muted)' }}>Auto JIT Sourcing</span>
                                              ) : hasManual ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                  {row.product_image_url && row.product_image_url.trim() !== '' ? (
                                                    <span style={{ color: '#10b981', fontWeight: 600 }} title={row.product_image_url}>✓ Dari URL CSV</span>
                                                  ) : manualImg ? (
                                                    <span style={{ color: '#10b981', fontWeight: 600 }}>✓ {manualImg.filename}</span>
                                                  ) : (
                                                    <input 
                                                      type="file" 
                                                      accept="image/*" 
                                                      disabled={uploadingImages[idx]}
                                                      onChange={e => handleRowImageChange(idx, e.target.files[0])} 
                                                      style={{ width: 130, fontSize: '0.75rem' }}
                                                    />
                                                  )}
                                                  {uploadingImages[idx] && <small style={{ color: 'var(--text-muted)' }}>Uploading...</small>}
                                                </div>
                                              ) : (
                                                <span style={{ color: 'var(--text-muted)' }}>-</span>
                                              )}
                                            </td>
                                          )}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

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
                        <label className="form-label">Narrative Mode</label>
                        <select className="form-input" value={narrativeMode} onChange={e => setNarrativeMode(e.target.value)}>
                          <option value="Storytelling">Storytelling (Bercerita / Daily-life)</option>
                          <option value="Problem-Solution">Problem-Solution (Masalah & Solusi)</option>
                          <option value="Educational">Educational (Tutorial / Penjelasan Ilmiah)</option>
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
                          max="6"
                          value={targetClipsCount}
                          onChange={e => setTargetClipsCount(Number(e.target.value))}
                          required
                        />
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
                      <div className="form-group">
                        <label className="form-label">Visual Mode</label>
                        <select className="form-input" value={visualMode} onChange={e => setVisualMode(e.target.value)}>
                          <option value="hybrid_lock">Double-Pass Pixel Lock (Nano Banana Pro T2I ➜ Veo 3.1 I2V)</option>
                          <option value="pure_t2v">Pure Text-To-Video (T2V Langsung)</option>
                        </select>
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
                            onChange={e => setIsBridgingActive(e.target.checked)}
                          />
                          <span className="slider"></span>
                        </label>
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
                              required
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label">Durasi Bridging Produk (Klip)</label>
                            <select
                              className="form-input"
                              value={bridgeDurationClips}
                              onChange={e => setBridgeDurationClips(parseInt(e.target.value) || 1)}
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
                            <label className="form-label">Gaya Promosi</label>
                            <select className="form-input" value={promotionStyle} onChange={e => setPromotionStyle(e.target.value)}>
                              <option value="Softselling">Softselling (Halus, Menyatu dengan Konten)</option>
                              <option value="Hardsell">Hardsell (Jelas, Langsung Promosi USP)</option>
                              <option value="Education">Education (Review Kinerja Produk Secara Logis)</option>
                            </select>
                          </div>

                          {productionMode === 'single' && (
                            <>
                              <div className="form-group">
                                <label className="form-label">Metode Penyertaan Produk</label>
                                <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                    <input type="radio" name="bridgingModeOpc" value="select_existing" checked={bridgingMode === 'select_existing'} onChange={e => setBridgingMode(e.target.value)} />
                                    Pilih dari Pustaka
                                  </label>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                    <input type="radio" name="bridgingModeOpc" value="manual_input" checked={bridgingMode === 'manual_input'} onChange={e => setBridgingMode(e.target.value)} />
                                    Tulis Manual
                                  </label>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                    <input type="radio" name="bridgingModeOpc" value="url_extract" checked={bridgingMode === 'url_extract'} onChange={e => setBridgingMode(e.target.value)} />
                                    Ekstrak dari URL
                                  </label>
                                </div>
                              </div>

                              {bridgingMode === 'select_existing' && (
                                <div className="form-group">
                                  <label className="form-label">Pilih Produk</label>
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
                                    {products.map(p => (
                                      <option key={p.id} value={p.id}>{p.brand_name || 'Generik'} - {p.product_name}</option>
                                    ))}
                                  </select>
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
                                    <textarea className="form-textarea" placeholder="Manfaat utama produk..." value={manualProductDesc} onChange={e => setManualProductDesc(e.target.value)} />
                                  </div>
                                  <div className="form-group">
                                    <label className="form-label">Unique Selling Point (USP)</label>
                                    <input className="form-input" placeholder="Contoh: Mengandung 10% Niacinamide murni tanpa iritasi" value={manualProductUsp} onChange={e => setManualProductUsp(e.target.value)} />
                                  </div>
                                </div>
                              )}

                              {bridgingMode === 'url_extract' && (
                                <div className="form-group">
                                  <label className="form-label">URL Produk</label>
                                  <input className="form-input" type="url" placeholder="https://tokopedia.link/... atau shopee.co.id/..." value={productUrl} onChange={e => setProductUrl(e.target.value)} />
                                </div>
                              )}
                            </>
                          )}

                          {/* Pixel Lock Image Upload */}
                          {visualMode === 'hybrid_lock' && productionMode === 'single' && (
                            <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                              {bridgingMode === 'select_existing' && targetProductId ? (
                                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: 12, borderRadius: 8 }}>
                                  <div style={{ color: '#10b981', fontWeight: 600, fontSize: '0.85rem' }}>
                                    ✨ Foto Produk & Deklarasi Mandate 88 Otomatis Terhubung dari Database Produk
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                                    {typeof productRefImage === 'string' && productRefImage && (
                                      <img src={productRefImage} alt="Product Ref" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-color)' }} />
                                    )}
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                                      <div><b>Nama Berkas Deklarasi:</b> <code>{productFilenameDeclare || 'Auto Generated'}</code></div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                  <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Foto Referensi Produk</label>
                                    <input 
                                      type="file" 
                                      className="form-input" 
                                      accept="image/*" 
                                      onChange={e => setProductRefImage(e.target.files[0])}
                                    />
                                  </div>
                                  <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Deklarasikan Nama Berkas (Declare Filename)</label>
                                    <input 
                                      type="text" 
                                      className="form-input" 
                                      placeholder="Contoh: botol_serum_biru.png" 
                                      value={productFilenameDeclare} 
                                      onChange={e => setProductFilenameDeclare(e.target.value)}
                                    />
                                    <small style={{ color: 'var(--text-muted)' }}>Gunakan nama unik ini sebagai pengenal objek dalam prompt visual</small>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* ACCORDION SECTION 4: Visual Swap Overrides */}
                <div style={{ borderBottom: 'none' }}>
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
                        <strong>🎭 Aktifkan Visual Swap Overrides</strong>
                      </div>

                      {isVsoActive && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div className="form-group">
                              <label className="form-label">Konsep Karakter (Framing)</label>
                              <select className="form-input" value={characterConcept} onChange={e => setCharacterConcept(e.target.value)}>
                                <option value="faceless">Faceless (Wajah Terpotong - Fokus Tangan)</option>
                                <option value="pov">POV (First Person View)</option>
                                <option value="silhouette">Siluet Bayangan (Aesthetic Shadow)</option>
                                <option value="stylized_3d">3D Stylized Claymation</option>
                                <option value="cartoon_face">Mascot Universe (Cartoon Face)</option>
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

                             {/* Gaya Animasi — hanya muncul saat mode Semesta Maskot */}
                             {subjectDemographic.startsWith('mascot_universe_') && (
                               <div className="form-group">
                                 <label className="form-label">🎨 Gaya Estetika Animasi Maskot</label>
                                 <select className="form-input" value={visualStylePreset} onChange={e => setVisualStylePreset(e.target.value)}>
                                   <option value="3d_claymation_cozy">3D Claymation Cozy (Shaun the Sheep Look)</option>
                                   <option value="kawaii_flat_vector">2D Kawaii Flat Vector (Minimalis Jepang)</option>
                                   <option value="ghibli_watercolor">Studio Ghibli Watercolor (Cat Air Magis)</option>
                                 </select>
                               </div>
                             )}

                             {/* Wardrobe — disembunyikan saat mode Semesta Maskot */}
                             {!subjectDemographic.startsWith('mascot_universe_') && (
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
                                           : "Ketik warna hijab kustom..."
                                     }
                                     value={wardrobeStyleCustom}
                                     onChange={e => setWardrobeStyleCustom(e.target.value)}
                                   />
                                 )}
                               </div>
                             )}

                            <div className="form-group">
                              <label className="form-label">Pencahayaan & Atmosfer (Lighting Ambiance)</label>
                              <select className="form-input" value={lightingStyle} onChange={e => setLightingStyle(e.target.value)}>
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
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Form Footer */}
                <div style={{ padding: '16px 24px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <button type="button" className="btn" onClick={() => setShowForm(false)} style={{ background: '#27272a', color: '#9ca3af', border: '1px solid #3f3f46', borderRadius: '8px', padding: '10px 18px', fontWeight: 600 }}>Batal</button>
                  <button type="submit" className="btn btn-primary" disabled={creating} onClick={() => setSubmitStatus('running')}>
                    {creating ? 'Membuat...' : '🚀 Buat & Jalankan'}
                  </button>
                  <button type="submit" className="btn" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.25)' }} disabled={creating} onClick={() => setSubmitStatus('draft')}>
                    {creating ? 'Menyimpan...' : '💾 Save as Draft'}
                  </button>
                </div>

              </form>
            </div>
          )}

          {/* Status Skeduler Card */}
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
                ⚙️ Status Skeduler Organic Pillar Campaign
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                Mengontrol jalannya antrean pembuatan video OPC secara otomatis.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                padding: '4px 10px', borderRadius: 12,
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
              <button
                onClick={pollLogs}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
              >
                [Refresh Log]
              </button>
            </div>
            <pre ref={terminalRef} style={{
              margin: 0, padding: '20px', background: '#07070a', color: '#20c20e',
              fontFamily: 'var(--font-mono)', fontSize: '0.82rem',
              maxHeight: '220px', overflowY: 'auto', lineHeight: '1.5', whiteSpace: 'pre-wrap'
            }}>
              {terminalLogs}
            </pre>
          </div>

          {/* ACCORDION CAMPAIGN LIST */}
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
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>🎬 Daftar Kampanye OPC</div>
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
            <div style={{ color: 'var(--text-muted)', padding: 32, textAlign: 'center' }}>Memuat riwayat kampanye...</div>
          ) : campaigns.filter(c => filterBrandId === 'all' || c.brand_profile_id === filterBrandId).length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🌱</div>
              <p style={{ color: 'var(--text-muted)' }}>Tidak ada kampanye yang cocok dengan filter brand ini.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {campaigns
                .filter(c => filterBrandId === 'all' || c.brand_profile_id === filterBrandId)
                .map(c => {
                  const isExpanded = expandedCampaignId === c.id;
                  let statusColor = 'var(--text-muted)';
                  let statusBg = 'rgba(255,255,255,0.06)';
                  let statusBorder = 'rgba(255,255,255,0.1)';
                  if (c.status === 'completed') { statusColor = 'var(--success)'; statusBg = 'rgba(46,204,113,0.15)'; statusBorder = 'rgba(46,204,113,0.3)'; }
                  else if (c.status === 'running') { statusColor = '#3b82f6'; statusBg = 'rgba(59,130,246,0.15)'; statusBorder = 'rgba(59,130,246,0.3)'; }
                  else if (c.status === 'paused') { statusColor = '#fdcb6e'; statusBg = 'rgba(253,203,110,0.15)'; statusBorder = 'rgba(253,203,110,0.3)'; }

                  return (
                    <div
                      key={c.id}
                      className="card"
                      style={{ cursor: 'pointer', transition: 'all 0.2s ease', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-sm)' }}
                      onClick={() => router.push(`/pillar-campaigns/${c.id}`)}
                    >
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
                            <span style={{ fontSize: '1.1rem' }}>🌱</span>
                            <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{c.campaign_name}</strong>
                            {c.is_mass_production === 1 && <span style={{ fontSize: '0.65rem', background: 'var(--accent)', color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>MASS</span>}
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 8, background: statusBg, color: statusColor, border: `1px solid ${statusBorder}` }}>
                              {c.status}
                            </span>
                          </div>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(c.created_at).toLocaleString('id-ID')}
                        </div>
                      </div>

                      {/* Metadata Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                        <div><strong>Jumlah Konten:</strong> {c.stats ? c.stats.total : 0}</div>
                        <div><strong>Progress:</strong> {c.stats ? c.stats.generated : 0}/{c.stats ? c.stats.total : 0} Video Selesai</div>
                      </div>

                      {/* Pipeline Status Badges */}
                      {c.stats && c.stats.total > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                          {[
                            { label: 'Generate', count: c.stats.generated, total: c.stats.total },
                            { label: 'TTS', count: c.stats.tts_completed, total: c.stats.total },
                            { label: 'AI Visual', count: c.stats.visual_completed, total: c.stats.total }
                          ].map((st, idx) => {
                            const pct = c.stats.total > 0 ? Math.round((st.count / st.total) * 100) : 0;
                            const isDone = pct === 100;
                            return (
                              <span key={idx} style={{
                                padding: '3px 8px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 600,
                                background: isDone ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                                color: isDone ? '#10b981' : 'var(--text-muted)',
                                border: `1px solid ${isDone ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)'}`
                              }}>
                                {isDone ? '✓ ' : ''}{st.label} {pct}%
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Action Buttons — rata KIRI, selalu terlihat */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12, flexWrap: 'wrap', gap: 10 }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => router.push(`/pillar-campaigns/${c.id}`)}
                            style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                          >
                            🔍 Detail
                          </button>

                          {c.status !== 'completed' && (
                            <button
                              type="button"
                              className={`btn btn-sm ${c.status === 'running' ? 'btn-danger' : 'btn-success'}`}
                              onClick={() => toggleStatus(c)}
                              disabled={processingId !== null}
                              style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                            >
                              {c.status === 'draft' ? '▶ Run' : (c.status === 'running' ? '⏸ Pause' : '▶ Resume')}
                            </button>
                          )}

                          {c.target_spreadsheet_id && (
                            <a
                              href={`https://docs.google.com/spreadsheets/d/${c.target_spreadsheet_id}`}
                              target="_blank" rel="noopener noreferrer"
                              className="btn btn-secondary btn-sm"
                              style={{ textDecoration: 'none', fontSize: '0.75rem', padding: '6px 12px' }}
                            >
                              📊 Sheet
                            </a>
                          )}

                          <a
                            href={`/api/campaign-portability/export?campaignId=${c.id}&type=OPC`}
                            className="btn btn-secondary btn-sm"
                            style={{ textDecoration: 'none', fontSize: '0.75rem', padding: '6px 12px' }}
                          >
                            📤 Export
                          </a>

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleCopy(c)}
                            disabled={processingId !== null}
                            style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                          >
                            📋 Copy
                          </button>

                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => deleteCampaign(c.id)}
                            disabled={processingId !== null}
                            style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                          >
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
                      style={{ background: '#27272a', color: '#9ca3af', border: '1px solid #3f3f46', borderRadius: '8px', padding: '10px 18px', fontWeight: 600 }}
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

        <ImportPlannerModal
          isOpen={showPlannerModal}
          onClose={() => setShowPlannerModal(false)}
          onSuccess={(res) => {
            if (res.status === 'draft') {
              showToast(`Draf kampanye OPC "${res.campaign_name}" (${res.ingested_count} video) berhasil disimpan dari Content Planner.`);
            } else {
              showToast(`Kampanye OPC "${res.campaign_name}" (${res.ingested_count} video) berhasil dibuat & dijalankan dari Content Planner.`);
            }
            fetchCampaigns();
            pollLogs();
          }}
        />

      </main>
    </div>
  );
}
