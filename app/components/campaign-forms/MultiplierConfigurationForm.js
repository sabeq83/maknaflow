'use client';

import { useState, useEffect, useRef } from 'react';
import VisualIdentitySelector from '../VisualIdentitySelector';
import { getWordsPerClipOptions, getDefaultWordsPerClip, VIDEO_MODELS } from '@/lib/words-per-clip-presets';

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

export default function MultiplierConfigurationForm({
  mode = 'direct', // 'direct' | 'capture'
  initialValues = {},
  onCapture = null,
  onSuccess = null,
  onCancel = null,
  isInline = false
}) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeAccordion, setActiveAccordion] = useState(0);

  // Workflow & assets
  const [workflowMode, setWorkflowMode] = useState(initialValues.workflowMode || 'multi_blueprint_one_product');
  const [campaignType, setCampaignType] = useState(initialValues.campaignType || 'editorial');
  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [selectedBlueprintIds, setSelectedBlueprintIds] = useState(initialValues.selectedBlueprintIds || []);
  const [selectedProductIds, setSelectedProductIds] = useState(initialValues.selectedProductIds || []);
  const [products, setProducts] = useState([]);
  const [brandProfiles, setBrandProfiles] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState(initialValues.selectedBrandId || '');
  const [accountName, setAccountName] = useState(initialValues.accountName || '');
  const [campaignName, setCampaignName] = useState(initialValues.campaignName || '');
  const [editorialTopic, setEditorialTopic] = useState(initialValues.editorialTopic || '');
  const [editorialOutro, setEditorialOutro] = useState(initialValues.editorialOutro || '');

  // Combinations
  const [combinationRows, setCombinationRows] = useState(initialValues.combinationRows || []);
  const [targetProductId, setTargetProductId] = useState(initialValues.targetProductId || '');
  const [productUrl, setProductUrl] = useState(initialValues.productUrl || '');
  const [affiliateUrl, setAffiliateUrl] = useState(initialValues.affiliateUrl || '');
  const [productRefImage, setProductRefImage] = useState(initialValues.productRefImage || null);

  // Dynamic Angles
  const [selectedNicheKb, setSelectedNicheKb] = useState('HERBAL_CONTENT_KB.md');
  const [availableNicheKBs, setAvailableNicheKBs] = useState([]);
  const [angleCount, setAngleCount] = useState(5);
  const [customAngleTheme, setCustomAngleTheme] = useState('');
  const [generatedAngles, setGeneratedAngles] = useState([]);
  const [selectedAngleIds, setSelectedAngleIds] = useState(new Set());
  const [generatingAngles, setGeneratingAngles] = useState(false);

  // Accordion 1: Strategy
  const [narrativeMode, setNarrativeMode] = useState(initialValues.narrativeMode || 'Storytelling');
  const [promotionStyle, setPromotionStyle] = useState(initialValues.promotionStyle || 'Softselling');
  const [targetDemographic, setTargetDemographic] = useState(initialValues.targetDemographic || 'genz_casual');
  const [targetDemographicCustom, setTargetDemographicCustom] = useState('');
  const [customInstruction, setCustomInstruction] = useState(initialValues.customInstruction || '');
  const [aiDirective, setAiDirective] = useState(initialValues.aiDirective || '');
  const [mandatoryOutroLine, setMandatoryOutroLine] = useState(initialValues.mandatoryOutroLine || '');
  const [generateRecipe, setGenerateRecipe] = useState(Boolean(initialValues.generateRecipe));
  const [enableVoAudit, setEnableVoAudit] = useState(initialValues.enableVoAudit ?? 1);

  // Accordion 2: Visual Engine
  const [visualStyle, setVisualStyle] = useState(initialValues.visualStyle || 'Cinematic');
  const [targetAi, setTargetAi] = useState(initialValues.targetAi || 'Google Veo (8s)');
  const [videoModel, setVideoModel] = useState(initialValues.videoModel || 'veo_31_lite');
  const [clipDuration, setClipDuration] = useState(initialValues.clipDuration || 8);
  const [aspectRatio, setAspectRatio] = useState(initialValues.aspectRatio || '9:16');
  const [faceVisibility, setFaceVisibility] = useState(initialValues.faceVisibility || 'Faceless');
  const [wordsPerClip, setWordsPerClip] = useState(initialValues.wordsPerClip || '17-19 kata');
  const [isVsoActive, setIsVsoActive] = useState(Boolean(initialValues.isVsoActive));
  const [visualIdentity, setVisualIdentity] = useState(initialValues.visualIdentity || {
    preset_id: 'hands_only_muslimah_sage_kitchen',
    inline_config: null,
    visual_overrides_json: null
  });
  const [characterConcept, setCharacterConcept] = useState('faceless');
  const [subjectDemographic, setSubjectDemographic] = useState('syari_classic');
  const [wardrobeStyle, setWardrobeStyle] = useState('random');
  const [lightingStyle, setLightingStyle] = useState('random');

  // Accordion 3: Bridging
  const [isBridgingActive, setIsBridgingActive] = useState(initialValues.isBridgingActive !== false);
  const [targetClipsCount, setTargetClipsCount] = useState(initialValues.targetClipsCount || 4);
  const [bridgeAtClip, setBridgeAtClip] = useState(initialValues.bridgeAtClip || 2);
  const [bridgeDurationClips, setBridgeDurationClips] = useState(initialValues.bridgeDurationClips || 1);
  const [bridgingMode, setBridgingMode] = useState(initialValues.bridgingMode || 'url_extract');
  const [manualProductName, setManualProductName] = useState(initialValues.manualProductName || '');
  const [manualProductDesc, setManualProductDesc] = useState(initialValues.manualProductDesc || '');
  const [manualProductUsp, setManualProductUsp] = useState(initialValues.manualProductUsp || '');
  const [visualMode, setVisualMode] = useState(initialValues.visualMode || 'hybrid_lock');

  // Accordion 4: Audio & Post
  const [enableTts, setEnableTts] = useState(initialValues.enableTts !== false);
  const [voiceProvider, setVoiceProvider] = useState(initialValues.voiceProvider || 'minimax');
  const [voicePersona, setVoicePersona] = useState(initialValues.voicePersona || 'Indonesian_casual_reporter_vv2');
  const [voiceSpeed, setVoiceSpeed] = useState(initialValues.voiceSpeed || 1.0);
  const [voiceVolume, setVoiceVolume] = useState(initialValues.voiceVolume || 1.0);
  const [ttsModelQuality, setTtsModelQuality] = useState(initialValues.ttsModelQuality || 'speech-2.8-turbo');
  const [enableGlabs, setEnableGlabs] = useState(initialValues.enableGlabs !== false);
  const [enableFfmpeg, setEnableFfmpeg] = useState(initialValues.enableFfmpeg !== false);
  const [targetLanguage, setTargetLanguage] = useState(initialValues.targetLanguage || 'id-ID');
  const [ffmpegSyncOption, setFfmpegSyncOption] = useState(initialValues.ffmpegSyncOption || 'smart_sync');
  const [syncMode, setSyncMode] = useState(initialValues.syncMode || 'auto');
  const [ffmpegVideoScale, setFfmpegVideoScale] = useState(initialValues.ffmpegVideoScale || 1.1);
  const [ffmpegSfxVolume, setFfmpegSfxVolume] = useState(initialValues.ffmpegSfxVolume || 0.0);
  const [ffmpegBgmVolume, setFfmpegBgmVolume] = useState(initialValues.ffmpegBgmVolume || 0.0);
  const [enableSocialPost, setEnableSocialPost] = useState(Boolean(initialValues.enableSocialPost));
  const [enableAudioSegment, setEnableAudioSegment] = useState(Boolean(initialValues.enableAudioSegment));
  const [sfxSetting, setSfxSetting] = useState(initialValues.sfxSetting || 'without_sfx');
  const [nextcloudParentFolder, setNextcloudParentFolder] = useState(initialValues.nextcloudParentFolder || '/MAKNA_Assets');

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    try {
      setLoadingAssets(true);
      const [resAssets, resProds, resBrands, resKbs] = await Promise.all([
        fetch('/api/v2/deconstruct?status=completed').then(r => r.json()).catch(() => ({ assets: [] })),
        fetch('/api/v2/products').then(r => r.json()).catch(() => ({ data: [] })),
        fetch('/api/brand-profiles').then(r => r.json()).catch(() => ({ profiles: [] })),
        fetch('/api/v2/niche-kbs').then(r => r.json()).catch(() => ({ success: true, files: ['HERBAL_CONTENT_KB.md'] }))
      ]);

      if (resAssets?.assets) setAssets(resAssets.assets);
      if (resProds?.data) setProducts(resProds.data);
      if (resBrands?.profiles) setBrandProfiles(resBrands.profiles);
      if (resKbs?.files) setAvailableNicheKBs(resKbs.files);
    } catch (e) {
      console.error('Failed to load initial data for Multiplier form', e);
    } finally {
      setLoadingAssets(false);
    }
  }

  // Auto-generate combination rows if selectedBlueprintIds and products change
  const handleGeneratePreviewRows = () => {
    const isPureStory = campaignType === 'editorial' ||
      workflowMode === 'one_blueprint_multi_angle' ||
      workflowMode === 'multi_blueprint_one_angle';

    let rows = [];
    if (workflowMode === 'multi_blueprint_one_product') {
      if (selectedBlueprintIds.length === 0) {
        setErrorMsg('Pilih minimal 1 blueprint dekonstruksi.');
        return;
      }
      rows = selectedBlueprintIds.map((bId, idx) => ({
        deconstruct_asset_id: bId,
        target_product_id: targetProductId || null,
        target_product_url: productUrl || null,
        affiliate_url: affiliateUrl || null,
        campaign_type: isPureStory ? 'pure_storytelling' : 'product_campaign',
        editorial_topic: editorialTopic.trim() || `Variasi Blueprint #${idx + 1}`,
        editorial_outro: editorialOutro.trim()
      }));
    } else if (workflowMode === 'one_blueprint_multi_product') {
      if (selectedBlueprintIds.length === 0) {
        setErrorMsg('Pilih 1 blueprint dekonstruksi utama.');
        return;
      }
      if (selectedProductIds.length === 0) {
        setErrorMsg('Pilih minimal 1 produk target.');
        return;
      }
      const bId = selectedBlueprintIds[0];
      rows = selectedProductIds.map(pId => {
        const p = products.find(prod => prod.id === pId);
        return {
          deconstruct_asset_id: bId,
          target_product_id: pId,
          target_product_url: p?.product_url || null,
          affiliate_url: p?.affiliate_url || null,
          campaign_type: 'product_campaign',
          editorial_topic: editorialTopic.trim() || p?.name || 'Multi-Product',
          editorial_outro: editorialOutro.trim()
        };
      });
    } else if (workflowMode === 'one_blueprint_multi_angle' || workflowMode === 'multi_blueprint_one_angle') {
      const activeAngles = generatedAngles.filter(a => selectedAngleIds.has(a.id));
      if (activeAngles.length === 0) {
        setErrorMsg('Pilih minimal 1 angle yang telah di-generate.');
        return;
      }
      const bId = selectedBlueprintIds[0] || null;
      rows = activeAngles.map(angle => ({
        deconstruct_asset_id: bId,
        target_product_id: null,
        campaign_type: 'pure_storytelling',
        editorial_topic: angle.title || angle.hook_text || 'Angle Story',
        editorial_outro: editorialOutro.trim(),
        angle_title: angle.title,
        hook_type: angle.hook_type,
        hook_text: angle.hook_text,
        target_persona: angle.target_persona,
        emotional_trigger: angle.emotional_trigger,
        cta_type: angle.cta_type,
        niche_kb_name: selectedNicheKb
      }));
    }

    setCombinationRows(rows);
    setErrorMsg('');
  };

  const buildPayload = () => {
    const isPureStory = campaignType === 'editorial' || 
                        workflowMode === 'one_blueprint_multi_angle' || 
                        workflowMode === 'multi_blueprint_one_angle' ||
                        (combinationRows.length > 0 && combinationRows.every(r => r.campaign_type === 'pure_storytelling'));

    const dbProduct = targetProductId ? products.find(p => p.id === targetProductId) : null;
    const dbPhotoUrl = dbProduct ? (dbProduct.cleaned_photo_url || dbProduct.clean_photo_url || dbProduct.raw_photo_url) : null;
    const cleanCampaignName = campaignName.trim() || `[ MULTIPLIER ] - ${accountName ? accountName + ' - ' : ''}${editorialTopic.trim() || 'Kampanye Multiplier'}`;

    return {
      mode: workflowMode,
      campaign_name: cleanCampaignName,
      brand_profile_id: selectedBrandId || null,
      account_name: accountName || null,
      initial_status: 'pending_resolution',
      status: 'pending_resolution',
      rows: (combinationRows.length > 0 ? combinationRows : [{
        deconstruct_asset_id: selectedBlueprintIds[0] || null,
        target_product_id: targetProductId || null,
        target_product_url: productUrl || null,
        affiliate_url: affiliateUrl || null,
        campaign_name: cleanCampaignName,
        brand_profile_id: selectedBrandId || null,
        account_name: accountName || null,
        campaign_type: isPureStory ? 'pure_storytelling' : 'product_campaign',
        status: 'pending_resolution',
        editorial_topic: editorialTopic.trim(),
        editorial_outro: editorialOutro.trim()
      }]).map(row => ({
        ...row,
        campaign_name: cleanCampaignName,
        brand_profile_id: selectedBrandId || null,
        account_name: accountName || null,
        campaign_type: row.campaign_type || (isPureStory ? 'pure_storytelling' : 'product_campaign')
      })),
      vso_config_json: JSON.stringify({
        narrativeMode, visualStyle, targetAi, videoModel, clipDuration, aspectRatio, faceVisibility, wordsPerClip,
        isVsoActive, characterConcept, subjectDemographic, wardrobeStyle, lightingStyle,
        visualIdentity,
        visual_identity_preset_id: isVsoActive ? visualIdentity?.preset_id : null,
        visual_identity_inline_config: isVsoActive && visualIdentity?.preset_id === 'inline' ? visualIdentity.inline_config : null,
        visual_overrides_json: isVsoActive && visualIdentity?.preset_id === 'custom' ? visualIdentity.visual_overrides_json : null
      }),
      bridging_config_json: JSON.stringify({
        campaign_name: cleanCampaignName,
        account_name: accountName || null,
        brandName: accountName || null,
        brand_profile_id: selectedBrandId || null,
        campaign_type: isPureStory ? 'pure_storytelling' : 'product_campaign',
        isBridgingActive: isPureStory ? false : isBridgingActive,
        targetClipsCount, bridgeAtClip, bridgeDurationClips, promotionStyle, bridgingMode,
        manualProductName: isPureStory ? '' : manualProductName,
        manualProductDesc: isPureStory ? '' : manualProductDesc,
        manualProductUsp: isPureStory ? '' : manualProductUsp,
        productUrl: isPureStory ? '' : productUrl,
        visualMode,
        editorialTopic: editorialTopic.trim(),
        editorialOutro: editorialOutro.trim(),
        generate_recipe: generateRecipe ? 1 : 0
      }),
      audio_config_json: JSON.stringify({
        campaignName: cleanCampaignName,
        accountName: accountName || null,
        brandProfileId: selectedBrandId || null,
        enableTts, voiceProvider, voicePersona, voiceSpeed, voiceVolume, ttsModelQuality,
        enableGlabs, enableFfmpeg, targetLanguage, ffmpegSyncOption, syncMode,
        ffmpegVideoScale, ffmpegSfxVolume, ffmpegBgmVolume, enableSocialPost,
        nextcloudParentFolder, targetDemographic, targetDemographicCustom, aiDirective,
        mandatoryOutroLine: editorialOutro.trim() || mandatoryOutroLine, customInstruction,
        enableAudioSegment, sfxSetting
      }),
      enable_vo_audit: enableVoAudit ? 1 : 0,
      generate_recipe: generateRecipe ? 1 : 0,
      product_ref_image_path: isPureStory ? null : (dbPhotoUrl || productRefImage)
    };
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setErrorMsg('');

    if (combinationRows.length === 0) {
      handleGeneratePreviewRows();
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
      const res = await fetch('/api/v2/multiplier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        if (onSuccess) onSuccess(data);
      } else {
        setErrorMsg(data.error || 'Gagal mendaftarkan kampanye Multiplier.');
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
            ⚙️ Konfigurasi Engine Multiplier Lab
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Gandakan blueprint dan kombinasikan dengan produk atau variasi angle secara massal.
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

      {/* Mode Workflow Selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Mode Alur Kerja Multiplier
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
          {[
            { id: 'multi_blueprint_one_product', label: '1 Produk × N Blueprint', desc: 'Satu produk diuji pada berbagai gaya blueprint video' },
            { id: 'one_blueprint_multi_product', label: '1 Blueprint × N Produk', desc: 'Satu gaya video diterapkan ke katalog banyak produk' },
            { id: 'one_blueprint_multi_angle', label: '1 Blueprint × N Angle', desc: 'Cerita/editorial berganti angle hook dari Niche KB' },
            { id: 'multi_blueprint_one_angle', label: '1 Angle × N Blueprint', desc: 'Satu angle cerita dieksplorasi di aneka struktur visual' },
          ].map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => { setWorkflowMode(opt.id); setCombinationRows([]); }}
              style={{
                padding: '10px 12px',
                textAlign: 'left',
                borderRadius: '8px',
                border: workflowMode === opt.id ? '2px solid var(--action-primary)' : '1px solid var(--border)',
                background: workflowMode === opt.id ? 'var(--surface-interactive)' : 'var(--surface)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{opt.label}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Basic Metadata */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
            Nama Kampanye
          </label>
          <input
            type="text"
            value={campaignName}
            onChange={e => setCampaignName(e.target.value)}
            placeholder="Contoh: Multiplier Batch Skincare Q4"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem'
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
            Nama Akun / Brand
          </label>
          <input
            type="text"
            value={accountName}
            onChange={e => setAccountName(e.target.value)}
            placeholder="Nama Akun IG / TikTok"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem'
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
            Brand Profile
          </label>
          <select
            value={selectedBrandId}
            onChange={e => setSelectedBrandId(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem'
            }}
          >
            <option value="">-- Tanpa Brand Profile Khusus --</option>
            {brandProfiles.map(b => (
              <option key={b.id} value={b.id}>{b.name || b.brand_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Blueprint Selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Blueprint Deconstruct Terpilih ({selectedBlueprintIds.length})
          </label>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {assets.length} blueprint tersedia
          </span>
        </div>
        <div style={{
          maxHeight: '140px',
          overflowY: 'auto',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '8px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '6px',
          background: 'var(--surface)'
        }}>
          {loadingAssets ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '12px' }}>Memuat blueprint...</div>
          ) : assets.length === 0 ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '12px' }}>Belum ada blueprint dekonstruksi tersimpan.</div>
          ) : (
            assets.map(a => {
              const isChecked = selectedBlueprintIds.includes(a.id);
              return (
                <label
                  key={a.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    background: isChecked ? 'var(--surface-interactive)' : 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    color: 'var(--text-primary)'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedBlueprintIds([...selectedBlueprintIds, a.id]);
                      } else {
                        setSelectedBlueprintIds(selectedBlueprintIds.filter(id => id !== a.id));
                      }
                    }}
                  />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.recipe_suggestion || a.label || a.source_url || a.id.slice(0, 8)}
                  </span>
                </label>
              );
            })
          )}
        </div>
      </div>

      {/* Accordions */}
      <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
        {[
          {
            title: '1. Strategi Narasi & Kreatif',
            render: () => (
              <div style={{ padding: '14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Gaya Narasi</label>
                  <select
                    value={narrativeMode}
                    onChange={e => setNarrativeMode(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
                  >
                    <option value="Storytelling">Storytelling</option>
                    <option value="Problem-Solution">Problem-Solution</option>
                    <option value="Curiosity-Hook">Curiosity-Hook</option>
                    <option value="Direct-Pitch">Direct-Pitch</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Demografi Sasaran</label>
                  <select
                    value={targetDemographic}
                    onChange={e => setTargetDemographic(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
                  >
                    <option value="genz_casual">Gen Z Kasual</option>
                    <option value="millennial_work">Millennial Pekerja</option>
                    <option value="emak_komunitas">Ibu Rumah Tangga / Emak</option>
                    <option value="general_broad">Umum / Semua Kalangan</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Promosi</label>
                  <select
                    value={promotionStyle}
                    onChange={e => setPromotionStyle(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
                  >
                    <option value="Softselling">Softselling</option>
                    <option value="Hardselling">Hardselling</option>
                    <option value="Organic Review">Organic Review</option>
                  </select>
                </div>
              </div>
            )
          },
          {
            title: '2. Visual Engine & Identitas Karakter',
            render: () => (
              <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Model Video AI</label>
                    <select
                      value={videoModel}
                      onChange={e => setVideoModel(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
                    >
                      {VIDEO_MODELS.map(m => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Rasio Aspek</label>
                    <select
                      value={aspectRatio}
                      onChange={e => setAspectRatio(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
                    >
                      <option value="9:16">9:16 (Reels/TikTok)</option>
                      <option value="16:9">16:9 (Landscape YouTube)</option>
                      <option value="1:1">1:1 (Square)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Gaya Visual</label>
                    <select
                      value={visualStyle}
                      onChange={e => setVisualStyle(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
                    >
                      <option value="Cinematic">Cinematic Realistis</option>
                      <option value="Hyper-realistic Documentary">Dokumenter Realistis</option>
                      <option value="3D Claymation Cozy">3D Claymation Cozy</option>
                      <option value="Anime / Ghibli Style">Anime / Estetika Seni</option>
                    </select>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={isVsoActive}
                      onChange={e => setIsVsoActive(e.target.checked)}
                    />
                    <span>Aktifkan Visual Identity / Karakter Konsisten (VSO)</span>
                  </label>
                  {isVsoActive && (
                    <div style={{ marginTop: '10px' }}>
                      <VisualIdentitySelector
                        value={visualIdentity}
                        onChange={setVisualIdentity}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          },
          {
            title: '3. Audio, TTS & Rendering',
            render: () => (
              <div style={{ padding: '14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Voice Provider</label>
                  <select
                    value={voiceProvider}
                    onChange={e => setVoiceProvider(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
                  >
                    <option value="minimax">MiniMax (Ekspresif)</option>
                    <option value="gemini">Google Gemini TTS</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Persona Suara</label>
                  <select
                    value={voicePersona}
                    onChange={e => setVoicePersona(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
                  >
                    {(voiceProvider === 'gemini' ? GEMINI_VOICES : MINIMAX_VOICES).map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={enableGlabs} onChange={e => setEnableGlabs(e.target.checked)} />
                    Generate Video (G-Labs)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={enableFfmpeg} onChange={e => setEnableFfmpeg(e.target.checked)} />
                    Stitch Video (FFmpeg)
                  </label>
                </div>
              </div>
            )
          }
        ].map((acc, index) => (
          <div key={index} style={{ borderBottom: index < 2 ? '1px solid var(--border)' : 'none' }}>
            <button
              type="button"
              onClick={() => setActiveAccordion(activeAccordion === index ? -1 : index)}
              style={{
                width: '100%',
                padding: '12px 14px',
                textAlign: 'left',
                background: activeAccordion === index ? 'var(--surface-interactive)' : 'var(--surface)',
                border: 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.88rem',
                color: 'var(--text-primary)'
              }}
            >
              <span>{acc.title}</span>
              <span>{activeAccordion === index ? '▲' : '▼'}</span>
            </button>
            {activeAccordion === index && acc.render()}
          </div>
        ))}
      </div>

      {/* Row Generation trigger & Preview Table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleGeneratePreviewRows}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            🔄 Sinkronkan Kombinasi Baris ({combinationRows.length})
          </button>
        </div>

        {combinationRows.length > 0 && (
          <div style={{
            maxHeight: '160px',
            overflowY: 'auto',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            fontSize: '0.78rem'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--surface-subtle)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '6px 10px' }}>#</th>
                  <th style={{ padding: '6px 10px' }}>Blueprint ID</th>
                  <th style={{ padding: '6px 10px' }}>Topik / Angle</th>
                  <th style={{ padding: '6px 10px' }}>Tipe</th>
                </tr>
              </thead>
              <tbody>
                {combinationRows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '6px 10px' }}>{i + 1}</td>
                    <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{(r.deconstruct_asset_id || '-').slice(0, 10)}</td>
                    <td style={{ padding: '6px 10px' }}>{r.editorial_topic}</td>
                    <td style={{ padding: '6px 10px' }}>{r.campaign_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
                ? 'Gunakan Konfigurasi Multiplier'
                : '🚀 Daftarkan Kampanye Multiplier')}
        </button>
      </div>
    </div>
  );
}
