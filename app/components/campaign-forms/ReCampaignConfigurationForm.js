'use client';

import { useState, useEffect } from 'react';
import VisualIdentitySelector from '../VisualIdentitySelector';
import { VIDEO_MODELS } from '@/lib/words-per-clip-presets';

const MINIMAX_VOICES = [
  { id: 'Indonesian_casual_reporter_vv2', name: 'Casual Reporter (Male)', avatar: '👨', desc: 'Laki-laki (Casual Reporter - Vv2)' },
  { id: 'Indonesian_compelling_storyteller_vv2', name: 'Compelling Storyteller (Male)', avatar: '👨', desc: 'Laki-laki (Storyteller - Vv2)' },
  { id: 'Indonesian_expressive_podcaster_vv2', name: 'Expressive Podcaster (Male)', avatar: '👨', desc: 'Laki-laki (Podcaster - Vv2)' },
  { id: 'Indonesian_energetic_streamer_vv2', name: 'Energetic Streamer (Male)', avatar: '👨', desc: 'Laki-laki (Streamer - Vv2)' },
  { id: 'Indonesian_intellectual_commentator_vv2', name: 'Intellectual Commentator (Female)', avatar: '👩', desc: 'Perempuan (Commentator - Vv2)' },
  { id: 'Indonesian_professional_anchor_vv2', name: 'Professional Anchor (Female)', avatar: '👩', desc: 'Perempuan (Anchor - Vv2)' },
  { id: 'Indonesian_crisp_reporter_vv2', name: 'Crisp Reporter (Female)', avatar: '👩', desc: 'Perempuan (Crisp Reporter - Vv2)' }
];

export default function ReCampaignConfigurationForm({
  mode = 'direct', // 'direct' | 'capture'
  initialValues = {},
  onCapture = null,
  onSuccess = null,
  onCancel = null,
  isInline = false
}) {
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form states
  const [campaignName, setCampaignName] = useState(initialValues.campaignName || '');
  const [accountName, setAccountName] = useState(initialValues.accountName || '');
  const [urlsText, setUrlsText] = useState(initialValues.urlsText || '');
  const [aspectRatio, setAspectRatio] = useState(initialValues.aspectRatio || '9:16');
  const [targetAi, setTargetAi] = useState(initialValues.targetAi || 'Google Veo (8s)');
  const [videoModel, setVideoModel] = useState(initialValues.videoModel || 'veo_31_lite');
  const [clipDuration, setClipDuration] = useState(initialValues.clipDuration || 8);
  const [customInstruction, setCustomInstruction] = useState(initialValues.customInstruction || 'akhiran skrip/voiceover : produk ori ada di keranjang ya!');
  const [aiDirective, setAiDirective] = useState(initialValues.aiDirective || '');
  const [mandatoryOutroLine, setMandatoryOutroLine] = useState(initialValues.mandatoryOutroLine || '');
  const [brandProfiles, setBrandProfiles] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState(initialValues.selectedBrandId || '');
  const [targetLanguage, setTargetLanguage] = useState(initialValues.targetLanguage || 'id-ID');
  const [targetDemographic, setTargetDemographic] = useState(initialValues.targetDemographic || 'genz_casual');

  // Bridging states
  const [isBridgingActive, setIsBridgingActive] = useState(initialValues.isBridgingActive || false);
  const [targetClipsCount, setTargetClipsCount] = useState(initialValues.targetClipsCount || 3);
  const [bridgeAtClip, setBridgeAtClip] = useState(initialValues.bridgeAtClip || 2);
  const [bridgeDurationClips, setBridgeDurationClips] = useState(initialValues.bridgeDurationClips || 1);
  const [bridgingMode, setBridgingMode] = useState(initialValues.bridgingMode || 'select_existing');
  const [products, setProducts] = useState([]);
  const [targetProductId, setTargetProductId] = useState(initialValues.targetProductId || '');
  const [manualProductName, setManualProductName] = useState(initialValues.manualProductName || '');
  const [manualProductDesc, setManualProductDesc] = useState(initialValues.manualProductDesc || '');
  const [manualProductUsp, setManualProductUsp] = useState(initialValues.manualProductUsp || '');
  const [productUrl, setProductUrl] = useState(initialValues.productUrl || '');
  const [promotionStyle, setPromotionStyle] = useState(initialValues.promotionStyle || 'Softselling');
  const [narrativeMode, setNarrativeMode] = useState(initialValues.narrativeMode || 'Storytelling');

  // Audio & Visual states
  const [voiceProvider, setVoiceProvider] = useState(initialValues.voiceProvider || 'minimax');
  const [voicePersona, setVoicePersona] = useState(initialValues.voicePersona || 'Indonesian_casual_reporter_vv2');
  const [voiceSpeed, setVoiceSpeed] = useState(initialValues.voiceSpeed || 1.0);
  const [voiceVolume, setVoiceVolume] = useState(initialValues.voiceVolume || 1.0);
  const [wordsPerClip, setWordsPerClip] = useState(initialValues.wordsPerClip || '17-19 kata');
  const [faceVisibility, setFaceVisibility] = useState(initialValues.faceVisibility || 'Faceless');
  const [visualStyle, setVisualStyle] = useState(initialValues.visualStyle || 'Cinematic');
  const [visualMode, setVisualMode] = useState(initialValues.visualMode || 'pure_t2v');
  const [productRefImage, setProductRefImage] = useState(null);
  const [productFilenameDeclare, setProductFilenameDeclare] = useState('');
  const [nextcloudParentFolder, setNextcloudParentFolder] = useState(initialValues.nextcloudParentFolder || 'MAKNA_Production_Final');

  // Accordion active index
  const [activeTab, setActiveTab] = useState('basic');

  useEffect(() => {
    fetch('/api/v2/brand-profiles')
      .then(r => r.json())
      .then(d => { if (d.success) setBrandProfiles(d.data || []); })
      .catch(() => {});
    fetch('/api/product-agent')
      .then(r => r.json())
      .then(d => { if (d.success) setProducts(d.data || []); })
      .catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');

    const urls = urlsText.split('\n').map(u => u.trim()).filter(Boolean);
    if (!campaignName.trim() || urls.length === 0) {
      setErrorMsg('Nama kampanye dan minimal 1 URL referensi video diperlukan.');
      return;
    }

    if (isBridgingActive) {
      if (bridgeAtClip < 2 || bridgeAtClip > targetClipsCount) {
        setErrorMsg(`Titik transisi (X) harus berada di antara klip ke-2 hingga ke-${targetClipsCount}.`);
        return;
      }
      if (bridgingMode === 'select_existing' && !targetProductId) {
        setErrorMsg('Silakan pilih produk dari pustaka.');
        return;
      }
      if (bridgingMode === 'manual_input' && (!manualProductName.trim() || !manualProductDesc.trim())) {
        setErrorMsg('Nama produk dan deskripsi wajib diisi untuk input manual.');
        return;
      }
    }

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

    const configData = {
      campaign_name: campaignName.trim(),
      urls,
      urlsText,
      account_name: accountName.trim(),
      brand_profile_id: selectedBrandId || null,
      aspect_ratio: aspectRatio,
      target_ai: targetAi,
      video_model: videoModel,
      clip_duration: Number(clipDuration),
      words_per_clip: wordsPerClip,
      face_visibility: faceVisibility,
      visual_style: visualStyle,
      visual_mode: visualMode,
      target_language: targetLanguage,
      target_demographic: targetDemographic,
      custom_instruction: customInstruction,
      ai_directive: aiDirective,
      mandatory_outro_line: mandatoryOutroLine,
      is_bridging_active: isBridgingActive ? 1 : 0,
      target_clips_count: Number(targetClipsCount),
      bridge_at_clip: Number(bridgeAtClip),
      bridge_duration_clips: Number(bridgeDurationClips),
      bridging_mode: bridgingMode,
      target_product_id: bridgingMode === 'select_existing' && isBridgingActive ? (targetProductId || null) : null,
      ephemeral_product_data,
      promotion_style: promotionStyle,
      narrative_mode: narrativeMode,
      voice_provider: voiceProvider,
      voice_persona: voicePersona,
      voice_speed: Number(voiceSpeed),
      voice_volume: Number(voiceVolume),
      nextcloud_parent_folder: nextcloudParentFolder,
      product_filename_declare: productFilenameDeclare
    };

    if (mode === 'capture' && onCapture) {
      onCapture({ config: configData, productRefImage });
      return;
    }

    // Direct submit via FormData
    setCreating(true);
    try {
      const formData = new FormData();
      Object.entries(configData).forEach(([key, value]) => {
        if (key === 'urls') {
          formData.append('urls', JSON.stringify(value));
        } else if (value !== null && value !== undefined) {
          formData.append(key, String(value));
        }
      });
      if (productRefImage) {
        formData.append('product_media', productRefImage);
      }
      formData.append('status', 'running');
      formData.append('execution_mode', 'full_autopilot');

      const res = await fetch('/api/v2/re-campaigns', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat RE campaign');

      if (onSuccess) onSuccess(data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setCreating(false);
    }
  }

  const formElement = (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {errorMsg && (
        <div style={{
          padding: '12px 16px', background: 'var(--status-danger-soft)', border: '1px solid var(--status-danger)',
          borderRadius: '10px', color: 'var(--status-danger)', fontSize: '13px'
        }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
        {[
          ['basic', '📋 Brief & URLs'],
          ['visual', '🎨 Visual & Model'],
          ['bridging', '🌉 Product Bridging'],
          ['audio', '🎙️ Audio & Voice']
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            style={{
              padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
              background: activeTab === key ? 'var(--action-primary)' : 'var(--surface-interactive)',
              color: activeTab === key ? 'var(--on-action-primary, #ffffff)' : 'var(--text-primary)'
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* TAB 1: BASIC */}
      {activeTab === 'basic' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
              Nama Kampanye RE:
            </label>
            <input
              type="text"
              value={campaignName}
              onChange={e => setCampaignName(e.target.value)}
              placeholder="Contoh: RE - Ide Konten Viral Skincare"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '10px',
                background: 'var(--input-bg, var(--surface))', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '14px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
              URL Video Referensi (1 per baris):
            </label>
            <textarea
              rows={4}
              value={urlsText}
              onChange={e => setUrlsText(e.target.value)}
              placeholder="https://www.tiktok.com/@user/video/...\nhttps://www.instagram.com/reel/..."
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '10px',
                background: 'var(--input-bg, var(--surface))', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '14px'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                Brand Profile (Opsional):
              </label>
              <select
                value={selectedBrandId}
                onChange={e => setSelectedBrandId(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '10px',
                  background: 'var(--input-bg, var(--surface))', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '14px'
                }}
              >
                <option value="">-- Pilih Brand Profile --</option>
                {brandProfiles.map(b => (
                  <option key={b.id} value={b.id}>{b.brand_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                Parent Folder Nextcloud:
              </label>
              <input
                type="text"
                value={nextcloudParentFolder}
                onChange={e => setNextcloudParentFolder(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '10px',
                  background: 'var(--input-bg, var(--surface))', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '14px'
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: VISUAL */}
      {activeTab === 'visual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                Model Video:
              </label>
              <select
                value={videoModel}
                onChange={e => setVideoModel(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '10px',
                  background: 'var(--input-bg, var(--surface))', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '14px'
                }}
              >
                <option value="veo_31_lite">Google Veo 3.1 Lite</option>
                <option value="veo_31_standard">Google Veo 3.1 Standard</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                Rasio Aspek:
              </label>
              <select
                value={aspectRatio}
                onChange={e => setAspectRatio(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '10px',
                  background: 'var(--input-bg, var(--surface))', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '14px'
                }}
              >
                <option value="9:16">9:16 (Vertikal / Reels / TikTok)</option>
                <option value="16:9">16:9 (Landscape / YouTube)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                Gaya Visual:
              </label>
              <select
                value={visualStyle}
                onChange={e => setVisualStyle(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '10px',
                  background: 'var(--input-bg, var(--surface))', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '14px'
                }}
              >
                <option value="Cinematic">Cinematic</option>
                <option value="Photorealistic">Photorealistic</option>
                <option value="Vibrant UGC">Vibrant UGC</option>
                <option value="Claymation 3D">Claymation 3D</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                Face Visibility:
              </label>
              <select
                value={faceVisibility}
                onChange={e => setFaceVisibility(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '10px',
                  background: 'var(--input-bg, var(--surface))', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '14px'
                }}
              >
                <option value="Faceless">Faceless (Tanpa Wajah)</option>
                <option value="POV">POV (Sudut Pandang Pertama)</option>
                <option value="Silhouette">Siluet</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BRIDGING */}
      {activeTab === 'bridging' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="re-bridging-active"
              checked={isBridgingActive}
              onChange={e => setIsBridgingActive(e.target.checked)}
            />
            <label htmlFor="re-bridging-active" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
              Aktifkan Product Bridging (Sponsorship / Affiliate)
            </label>
          </div>

          {isBridgingActive && (
            <div style={{ padding: '12px', background: 'var(--surface-interactive)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Pilih Produk Pustaka:
                </label>
                <select
                  value={targetProductId}
                  onChange={e => setTargetProductId(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: '8px',
                    background: 'var(--input-bg, var(--surface))', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)'
                  }}
                >
                  <option value="">-- Pilih Produk --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.product_name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Muncul Pada Klip Ke-:
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={targetClipsCount}
                    value={bridgeAtClip}
                    onChange={e => setBridgeAtClip(Number(e.target.value))}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: '8px',
                      background: 'var(--input-bg, var(--surface))', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Gaya Promosi:
                  </label>
                  <select
                    value={promotionStyle}
                    onChange={e => setPromotionStyle(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: '8px',
                      background: 'var(--input-bg, var(--surface))', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)'
                    }}
                  >
                    <option value="Softselling">Softselling (Halus)</option>
                    <option value="Hardselling">Hardselling (Langsung)</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: AUDIO */}
      {activeTab === 'audio' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
              Pengisi Suara (Voice Persona):
            </label>
            <select
              value={voicePersona}
              onChange={e => setVoicePersona(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '10px',
                background: 'var(--input-bg, var(--surface))', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '14px'
              }}
            >
              {MINIMAX_VOICES.map(v => (
                <option key={v.id} value={v.id}>{v.avatar} {v.name} - {v.desc}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
              Instruksi Tambahan (Outro / Call to Action):
            </label>
            <input
              type="text"
              value={mandatoryOutroLine}
              onChange={e => setMandatoryOutroLine(e.target.value)}
              placeholder="Contoh: Yuk klik link di bio sekarang juga!"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '10px',
                background: 'var(--input-bg, var(--surface))', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '14px'
              }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1, padding: '12px', background: 'var(--surface)', color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)', borderRadius: '10px', fontWeight: 600, cursor: 'pointer'
            }}
          >
            Batal
          </button>
        )}
        <button
          type="submit"
          disabled={creating}
          style={{
            flex: 2, padding: '12px', background: 'var(--action-primary)', color: 'var(--on-action-primary, #ffffff)',
            border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
          }}
        >
          {creating ? '⏳ Memproses...' : (mode === 'capture' ? '✅ Konfirmasi Konfigurasi RE' : '🚀 Jalankan RE Campaign')}
        </button>
      </div>
    </form>
  );

  if (isInline) return formElement;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--overlay-backdrop)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '16px',
        width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '28px',
        boxShadow: 'var(--shadow-modal)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            🎬 Konfigurasi RE Campaign
          </h2>
          {onCancel && (
            <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}>✕</button>
          )}
        </div>
        {formElement}
      </div>
    </div>
  );
}
