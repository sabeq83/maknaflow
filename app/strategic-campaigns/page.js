'use client';

import Sidebar from '../components/Sidebar';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';

export default function StrategicCampaignDashboard() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState([]);
  const [planners, setPlanners] = useState([]);
  const [products, setProducts] = useState([]);
  const [brandProfiles, setBrandProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState(null);

  // Form Accordion State (0: Basic Strategy, 1: Aesthetics, 2: Product Bridging, 3: VSO)
  const [activeAccordion, setActiveAccordion] = useState(0);

  // Mode Input Selector
  const [inputMode, setInputMode] = useState('manual'); // 'manual' or 'planner_import'
  const [selectedPlannerId, setSelectedPlannerId] = useState('');
  const [plannerRows, setPlannerRows] = useState([]);
  const [selectedRowIds, setSelectedRowIds] = useState([]);

  // ACCORDION 1: Basic Creative Strategy
  const [campaignName, setCampaignName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [productName, setProductName] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [productUsp, setProductUsp] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('id-ID');
  const [targetDemographic, setTargetDemographic] = useState('genz_casual');
  const [targetDemographicCustom, setTargetDemographicCustom] = useState('');
  const [enableAudioSegment, setEnableAudioSegment] = useState(false);
  const [voiceProvider, setVoiceProvider] = useState('minimax');
  const [voicePersona, setVoicePersona] = useState('Indonesian_casual_reporter_vv2');
  const [sfxSetting, setSfxSetting] = useState('without_sfx');
  const [enableVoAudit, setEnableVoAudit] = useState(1);
  const [customInstruction, setCustomInstruction] = useState('akhiran skrip/voiceover : produk ori ada di keranjang ya!');
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [nextcloudParentFolder, setNextcloudParentFolder] = useState('MAKNA_Strategic_Campaigns');

  // ACCORDION 2: Aesthetics & Visual Settings
  const [narrativeMode, setNarrativeMode] = useState('Storytelling');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [targetAi, setTargetAi] = useState('Google Veo (8s)');
  const [videoModel, setVideoModel] = useState('veo_31_lite');
  const [faceVisibility, setFaceVisibility] = useState('Faceless');
  const [targetClipsCount, setTargetClipsCount] = useState(4);
  const [wordsPerClip, setWordsPerClip] = useState('15-16 kata');
  const [visualStyle, setVisualStyle] = useState('Cinematic');
  const [visualMode, setVisualMode] = useState('hybrid_lock');

  // ACCORDION 3: Product Bridging Settings
  const [isBridgingActive, setIsBridgingActive] = useState(true);
  const [bridgeAtClip, setBridgeAtClip] = useState(2);
  const [bridgeDurationClips, setBridgeDurationClips] = useState(1);
  const [promotionStyle, setPromotionStyle] = useState('Softselling');
  const [bridgingMode, setBridgingMode] = useState('manual_input'); // 'select_existing' | 'manual_input' | 'url_extract'
  const [targetProductId, setTargetProductId] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [productFilenameDeclare, setProductFilenameDeclare] = useState('');

  // ACCORDION 4: Visual Swap Overrides (VSO Engine)
  const [isVsoActive, setIsVsoActive] = useState(false);
  const [characterConcept, setCharacterConcept] = useState('faceless');
  const [subjectDemographic, setSubjectDemographic] = useState('syari_classic');
  const [visualStylePreset, setVisualStylePreset] = useState('3d_claymation_cozy');
  const [wardrobeStyle, setWardrobeStyle] = useState('amber_terracotta');
  const [wardrobeStyleCustom, setWardrobeStyleCustom] = useState('');
  const [lightingStyle, setLightingStyle] = useState('window_daylight');
  const [lightingStyleCustom, setLightingStyleCustom] = useState('');

  // Terminal Poller Logs State
  const [terminalLogs, setTerminalLogs] = useState('Menginisialisasi log Strategic Campaign...');
  const [showLogsTerminal, setShowLogsTerminal] = useState(true);
  const [isSchedulerActive, setIsSchedulerActive] = useState(true);
  const terminalRef = useRef(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  useEffect(() => {
    fetchCampaigns();
    fetchPlanners();
    fetchProducts();
    fetchBrandProfiles();
    fetchSchedulerStatus();
    pollLogs();

    const interval = setInterval(pollLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  async function fetchSchedulerStatus() {
    try {
      const res = await fetch('/api/strategic-campaigns/scheduler-control');
      const json = await res.json();
      if (json.success) {
        setIsSchedulerActive(json.isSchedulerActive);
      }
    } catch (_) {}
  }

  async function toggleStrategicScheduler() {
    try {
      const nextStatus = !isSchedulerActive;
      const res = await fetch('/api/strategic-campaigns/scheduler-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedulerStatus: nextStatus })
      });
      const json = await res.json();
      if (json.success) {
        setIsSchedulerActive(nextStatus);
        showToast(`Skeduler Strategic Campaign ${nextStatus ? 'DIAKTIFKAN 🟢' : 'DIMATIKAN 🔴'}`);
      } else {
        showToast('Gagal mengubah status skeduler: ' + (json.error || 'Unknown error'), 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  }

  async function pollLogs() {
    try {
      const res = await fetch(`/api/system-logs?type=strategic&t=${Date.now()}`);
      if (res.ok) {
        const text = await res.text();
        const lines = text.split('\n');
        const last500 = lines.slice(-500).join('\n');
        setTerminalLogs(last500 || 'Belum ada log aktivitas Strategic Campaign.');
      }
    } catch (_) {}
  }

  async function fetchCampaigns() {
    try {
      setLoading(true);
      const res = await fetch('/api/strategic-campaigns');
      const data = await res.json();
      if (data.success) setCampaigns(data.campaigns || []);
    } catch (e) {
      showToast('Gagal memuat kampanye: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchPlanners() {
    try {
      const res = await fetch('/api/content-planner');
      const data = await res.json();
      if (data.success) setPlanners(data.planners || []);
    } catch (e) {}
  }

  async function fetchProducts() {
    try {
      const res = await fetch('/api/product-agent');
      const data = await res.json();
      if (data.success) setProducts(data.data || []);
    } catch (e) {}
  }

  async function fetchBrandProfiles() {
    try {
      const res = await fetch('/api/v2/brand-profiles');
      const data = await res.json();
      if (data.success) setBrandProfiles(data.data || []);
    } catch (e) {}
  }

  async function handleSelectPlanner(plannerId) {
    setSelectedPlannerId(plannerId);
    if (!plannerId) {
      setPlannerRows([]);
      setSelectedRowIds([]);
      setAccountName('');
      return;
    }
    try {
      const res = await fetch(`/api/content-planner/${plannerId}`);
      const data = await res.json();
      if (data.success && data.planner) {
        const pln = data.planner;
        setPlannerRows(pln.rows || []);
        setSelectedRowIds((pln.rows || []).map(r => r.id));
        setProductName(pln.product_name || '');
        setProductDesc(pln.product_description || '');
        setProductUsp(pln.product_usp || '');
        setAccountName(pln.account_name || '');
        setCampaignName(`Strategic Campaign - ${pln.product_name || pln.title}`);

        // Auto-fill Product Bridging fields in Accordion 3
        if (pln.product_id) {
          setBridgingMode('select_existing');
          setTargetProductId(pln.product_id);
        } else {
          setBridgingMode('manual_input');
        }
      }
    } catch (e) {}
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!productName || !productDesc) {
      showToast('Nama Produk dan Deskripsi Wajib Diisi', 'error');
      return;
    }

    try {
      setCreating(true);
      let endpoint = '/api/strategic-campaigns';

      const finalWardrobe = wardrobeStyle === 'custom' ? wardrobeStyleCustom : wardrobeStyle;
      const finalLighting = lightingStyle === 'custom' ? lightingStyleCustom : lightingStyle;

      let payload = {
        campaign_name: campaignName || `Strategic Campaign - ${productName}`,
        input_mode: inputMode,
        product_name: productName,
        product_description: productDesc,
        product_usp: productUsp,
        vso_config: {
          is_vso_active: isVsoActive,
          character_concept: characterConcept,
          subject_demographic: subjectDemographic,
          wardrobe_style: finalWardrobe,
          lighting_style: finalLighting,
          visual_style_preset: visualStylePreset
        },
        workflow_config_json: JSON.stringify({
          target_language: targetLanguage,
          target_demographic: targetDemographic,
          target_demographic_custom: targetDemographicCustom,
          enable_audio_segment: enableAudioSegment ? 1 : 0,
          target_clips_count: parseInt(targetClipsCount, 10),
          is_bridging_active: isBridgingActive ? 1 : 0,
          bridge_at_clip: parseInt(bridgeAtClip, 10),
          bridge_duration_clips: parseInt(bridgeDurationClips, 10),
          promotion_style: promotionStyle,
          bridging_mode: bridgingMode,
          target_product_id: targetProductId,
          manual_product_name: productName,
          manual_product_desc: productDesc,
          manual_product_usp: productUsp,
          product_url: productUrl,
          product_filename_declare: productFilenameDeclare,
          narrative_mode: narrativeMode,
          aspect_ratio: aspectRatio,
          target_ai: targetAi,
          video_model: videoModel,
          face_visibility: faceVisibility,
          words_per_clip: wordsPerClip,
          visual_style: visualStyle,
          visual_mode: visualMode,
          enable_audio_segment: enableAudioSegment ? 1 : 0,
          voice_provider: voiceProvider,
          voice_persona: voicePersona,
          sfx_setting: sfxSetting,
          enable_vo_audit: enableVoAudit,
          custom_instruction: customInstruction,
          account_name: accountName.trim(),
          nextcloud_parent_folder: nextcloudParentFolder.trim()
        }),
        account_name: accountName.trim(),
        nextcloud_parent_folder: nextcloudParentFolder.trim()
      };

      if (inputMode === 'planner_import' && selectedPlannerId) {
        endpoint = '/api/strategic-campaigns/ingest-planner';
        payload.planner_id = selectedPlannerId;
        payload.selected_row_ids = selectedRowIds;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        showToast('Strategic Campaign Berhasil Dibuat!');
        setShowModal(false);
        router.push(`/strategic-campaigns/${data.campaign_id}`);
      } else {
        showToast('Gagal membuat kampanye: ' + data.error, 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteCampaign(id, e) {
    e.stopPropagation();
    if (!confirm('Yakin ingin menghapus Strategic Campaign ini?')) return;
    try {
      const res = await fetch(`/api/strategic-campaigns/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Kampanye berhasil dihapus');
        fetchCampaigns();
      }
    } catch (e) {
      showToast('Gagal menghapus: ' + e.message, 'error');
    }
  }

  return (
    <div className="layout-with-sidebar">
      <Sidebar />

      <main className="main-content" style={{ padding: '32px', background: '#0a0a0c', minHeight: '100vh', color: '#f3f4f6' }}>
        {toast && (
          <div style={{
            position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
            padding: '12px 24px', borderRadius: '8px',
            background: toast.type === 'error' ? '#ef4444' : '#6366f1',
            color: '#fff', fontWeight: 600, boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
          }}>
            {toast.msg}
          </div>
        )}

        {/* Header Block */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>🎯</span> Strategic Campaign Gateway
          </h1>
          <p style={{ color: '#9ca3af', marginTop: '6px', fontSize: '14px', marginBottom: '16px' }}>
            Automated pipeline strategic campaign based on strategic content planner.
          </p>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: '12px 24px',
              backgroundImage: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: 700,
              cursor: 'pointer', boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
              display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px'
            }}
          >
            <span>✨</span> Buat Strategic Campaign Baru
          </button>
        </div>

        {/* STATUS SKEDULER STRATEGIC CAMPAIGN CARD (OPC PARITY) */}
        <div style={{
          background: '#18181b', border: '1px solid #27272a', borderRadius: '12px',
          padding: '16px 20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', flexWrap: 'wrap', gap: '12px'
        }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ⚙️ Status Skeduler Strategic Campaign
            </h3>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0 0' }}>
              Mengontrol jalannya antrean pembuatan video SC secara otomatis.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
              padding: '4px 10px', borderRadius: '12px',
              background: isSchedulerActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: isSchedulerActive ? '#10b981' : '#ef4444',
              border: `1px solid ${isSchedulerActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
            }}>
              {isSchedulerActive ? '🟢 SKEDULER AKTIF' : '🔴 SKEDULER MATI'}
            </span>
            <button
              type="button"
              onClick={toggleStrategicScheduler}
              style={{
                padding: '8px 18px', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '12px',
                background: isSchedulerActive ? '#ef4444' : '#10b981', color: '#fff',
                boxShadow: isSchedulerActive ? '0 0 15px rgba(239, 68, 68, 0.4)' : '0 0 15px rgba(16, 185, 129, 0.4)'
              }}
            >
              {isSchedulerActive ? '🛑 STOP SKEDULER' : '▶️ START SKEDULER'}
            </button>
          </div>
        </div>

        {/* SYSTEM POLLER LOGGER (OPC PARITY) */}
        <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '12px', border: '1px solid #27272a', overflow: 'hidden', marginBottom: '24px' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #27272a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#00b894', display: 'inline-block', boxShadow: '0 0 8px #00b894' }}></span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: '600', color: '#9ca3af' }}>SYSTEM POLLER LOGGER</span>
            </div>
            <button
              type="button"
              onClick={pollLogs}
              style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'monospace' }}
            >
              [Refresh Log]
            </button>
          </div>
          <pre ref={terminalRef} style={{
            margin: 0, padding: '20px', background: '#07070a', color: '#20c20e',
            fontFamily: 'monospace', fontSize: '0.82rem',
            maxHeight: '220px', overflowY: 'auto', lineHeight: '1.5', whiteSpace: 'pre-wrap'
          }}>
            {terminalLogs}
          </pre>
        </div>

        {/* Grid List (1 Vertical Column Stack like OPC) */}
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>Memuat daftar kampanye...</div>
        ) : campaigns.length === 0 ? (
          <div style={{
            padding: '64px 24px', textAlign: 'center', background: '#121318',
            borderRadius: '16px', border: '1px solid #1e2029'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎯</div>
            <h3 style={{ fontSize: '20px', color: '#f3f4f6', marginBottom: '8px' }}>Belum Ada Strategic Campaign</h3>
            <p style={{ color: '#9ca3af', maxWidth: '480px', margin: '0 auto 24px' }}>
              Buat kampanye strategis baru atau impor langsung dari baris Content Planner yang telah Anda buat.
            </p>
            <button
              onClick={() => setShowModal(true)}
              style={{ padding: '10px 20px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
            >
              Buat Kampanye Pertama
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {campaigns.map(c => (
              <div
                key={c.id}
                onClick={() => router.push(`/strategic-campaigns/${c.id}`)}
                style={{
                  background: '#121318', border: '1px solid #27272a', borderRadius: '14px',
                  padding: '20px 24px', cursor: 'pointer', transition: 'all 0.2s ease',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#6366f1'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#27272a'}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
                      background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', textTransform: 'uppercase',
                      border: '1px solid rgba(99, 102, 241, 0.3)'
                    }}>
                      {c.input_mode === 'planner_import' ? 'Planner Import' : 'Manual Entry'}
                    </span>
                    <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#f9fafb', margin: 0 }}>
                      {c.campaign_name}
                    </h3>
                  </div>
                  <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>
                    📦 Produk: <strong style={{ color: '#818cf8' }}>{c.product_name}</strong> | 🎬 <strong>{c.item_count || 0} Strategic Items</strong> | Dibuat: {new Date(c.created_at).toLocaleDateString('id-ID')}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        const res = await fetch(`/api/strategic-campaigns/${c.id}/run`, { method: 'POST' });
                        const data = await res.json();
                        if (data.success) {
                          showToast(`Status kampanye "${c.campaign_name}" diubah menjadi ${data.status}`);
                          fetchCampaigns();
                        }
                      } catch (err) {
                        showToast('Gagal mengubah status: ' + err.message, 'error');
                      }
                    }}
                    style={{
                      padding: '6px 14px', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '12px',
                      background: c.status === 'running' ? '#ef4444' : '#10b981', color: '#fff'
                    }}
                  >
                    {c.status === 'running' ? '⏸ Pause' : (c.status === 'paused' ? '▶ Resume' : '▶ Run')}
                  </button>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#818cf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Buka Workbench →
                  </span>
                  <button
                    onClick={(e) => handleDeleteCampaign(c.id, e)}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }}
                    title="Hapus Kampanye"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal Generator Form (4 Accordions Complete OPC Alignment) */}
        {showModal && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999
          }}>
            <div style={{
              background: '#121318', border: '1px solid #27272a', borderRadius: '16px',
              width: '100%', maxWidth: '780px', maxHeight: '92vh', overflowY: 'auto', padding: '28px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🎯</span> Buat Strategic Campaign Baru
                </h2>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '20px', cursor: 'pointer' }}>✕</button>
              </div>

              <form onSubmit={handleCreate}>
                {/* Top Mode Input Selector */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                  <button
                    type="button"
                    onClick={() => setInputMode('manual')}
                    style={{
                      padding: '12px', borderRadius: '10px', border: inputMode === 'manual' ? '2px solid #6366f1' : '1px solid #27272a',
                      background: inputMode === 'manual' ? 'rgba(99, 102, 241, 0.18)' : '#18181b', color: inputMode === 'manual' ? '#818cf8' : '#9ca3af',
                      fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease'
                    }}
                  >
                    ✍️ Form Manual Produk
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('planner_import')}
                    style={{
                      padding: '12px', borderRadius: '10px', border: inputMode === 'planner_import' ? '2px solid #6366f1' : '1px solid #27272a',
                      background: inputMode === 'planner_import' ? 'rgba(99, 102, 241, 0.18)' : '#18181b', color: inputMode === 'planner_import' ? '#818cf8' : '#9ca3af',
                      fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease'
                    }}
                  >
                    📊 Impor Content Planner
                  </button>
                </div>

                {/* Structured 4 Accordions Stack */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                  
                  {/* ACCORDION 1: Basic Creative Strategy */}
                  <div style={{ background: '#18181b', borderRadius: '10px', border: '1px solid #27272a', overflow: 'hidden' }}>
                    <div
                      onClick={() => setActiveAccordion(0)}
                      style={{
                        padding: '14px 18px', background: activeAccordion === 0 ? 'rgba(99, 102, 241, 0.12)' : '#18181b',
                        color: activeAccordion === 0 ? '#818cf8' : '#f3f4f6', fontWeight: 700, fontSize: '14px',
                        cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}
                    >
                      <span>1. Basic Creative Strategy</span>
                      <span>{activeAccordion === 0 ? '▲' : '▼'}</span>
                    </div>

                    {activeAccordion === 0 && (
                      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {inputMode === 'planner_import' && (
                          <div style={{ background: 'rgba(99, 102, 241, 0.08)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
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
                                <option key={p.id} value={p.id}>{p.title || p.planner_name} ({p.product_name})</option>
                              ))}
                            </select>
                            {selectedPlannerId && plannerRows.length > 0 && (
                              <div style={{ marginTop: '10px' }}>
                                <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 600, marginBottom: '6px' }}>
                                  ✓ Terdeteksi {plannerRows.length} baris strategi konten dari planner master:
                                </div>
                                <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', background: '#09090b', padding: '8px', borderRadius: '6px', border: '1px solid #27272a' }}>
                                  {plannerRows.map(r => (
                                    <div key={r.id} style={{ fontSize: '11px', color: '#d1d5db', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>
                                        {r.sequence}. {r.hook}
                                      </span>
                                      <span style={{ fontSize: '10px', background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                        🔒 {r.video_id || 'Auto Video ID'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div>
                          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span>🏷️ Nama Akun (Brand Account):</span>
                            {inputMode === 'planner_import' && <span style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 600 }}>🔒 Terkunci dari Content Planner</span>}
                          </label>
                          <select
                            className="form-input"
                            value={accountName}
                            disabled={inputMode === 'planner_import'}
                            onChange={e => {
                              const newAcc = e.target.value;
                              setAccountName(newAcc);
                              const now = new Date();
                              const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
                              setCampaignName(`[ SC ${dateStr} ] - ${newAcc ? newAcc + ' - ' : ''}`);
                            }}
                            style={{
                              width: '100%', padding: '10px',
                              background: inputMode === 'planner_import' ? '#18181b' : '#09090b',
                              border: '1px solid #27272a',
                              color: inputMode === 'planner_import' ? '#fbbf24' : '#fff',
                              borderRadius: '8px'
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
                          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Nama Strategic Campaign:</label>
                          <input
                            type="text"
                            value={campaignName}
                            onChange={e => setCampaignName(e.target.value)}
                            placeholder="cth: Strategic Campaign - Nutrimax C-1000"
                            style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                            required
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>📁 Parent Folder Nextcloud (Opsional):</label>
                          <input
                            type="text"
                            value={nextcloudParentFolder}
                            onChange={e => setNextcloudParentFolder(e.target.value)}
                            placeholder="cth: MAKNA_Strategic_Campaigns"
                            style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Bahasa Naskah Voiceover (Script Language):</label>
                          <select
                            value={targetLanguage}
                            onChange={e => setTargetLanguage(e.target.value)}
                            style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                          >
                            <option value="id-ID">🇮🇩 Bahasa Indonesia (Lokal)</option>
                            <option value="en-US">🇺🇸 English (Global / US Market)</option>
                          </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                          <div>
                            <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>🎙 Audio Segment (per Klip):</label>
                            <select
                              value={enableAudioSegment ? 'enabled' : 'disabled'}
                              onChange={e => setEnableAudioSegment(e.target.value === 'enabled')}
                              style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                            >
                              <option value="disabled">❌ Disabled (Default)</option>
                              <option value="enabled">✅ Enabled — Embed Audio Segment</option>
                            </select>
                          </div>

                          <div>
                            <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>🔊 TTS Voice Provider:</label>
                            <select
                              value={voiceProvider}
                              onChange={e => {
                                const prov = e.target.value;
                                setVoiceProvider(prov);
                                if (prov === 'gemini') setVoicePersona('Kore');
                                else setVoicePersona(targetLanguage === 'en-US' ? 'English_causual_narrator_vv1' : 'Indonesian_casual_reporter_vv2');
                              }}
                              style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                            >
                              <option value="minimax">MiniMax Speech</option>
                              <option value="gemini">Google Gemini TTS</option>
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

                        <div>
                          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Nama Produk:</label>
                          <input
                            type="text"
                            value={productName}
                            onChange={e => setProductName(e.target.value)}
                            placeholder="cth: Nutrimax Vitamin C"
                            style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                            required
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Deskripsi Produk:</label>
                          <textarea
                            value={productDesc}
                            onChange={e => setProductDesc(e.target.value)}
                            rows={3}
                            placeholder="Jelaskan manfaat utama produk..."
                            style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                            required
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Unique Selling Point (USP):</label>
                          <input
                            type="text"
                            value={productUsp}
                            onChange={e => setProductUsp(e.target.value)}
                            placeholder="cth: Mengandung 1000mg Vitamin C murni non-acidic"
                            style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                          />
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
                          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Custom Instruction (Opsional):</label>
                          <textarea
                            value={customInstruction}
                            onChange={e => setCustomInstruction(e.target.value)}
                            rows={2}
                            placeholder="Instruksi khusus untuk Gemini AI..."
                            style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                          />
                        </div>

                        {brandProfiles.length > 0 && (
                          <div>
                            <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>🧬 Brand Profile (Opsional):</label>
                            <select
                              value={selectedBrandId}
                              onChange={e => setSelectedBrandId(e.target.value)}
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

                  {/* ACCORDION 2: Aesthetics & Visual Settings */}
                  <div style={{ background: '#18181b', borderRadius: '10px', border: '1px solid #27272a', overflow: 'hidden' }}>
                    <div
                      onClick={() => setActiveAccordion(1)}
                      style={{
                        padding: '14px 18px', background: activeAccordion === 1 ? 'rgba(99, 102, 241, 0.12)' : '#18181b',
                        color: activeAccordion === 1 ? '#818cf8' : '#f3f4f6', fontWeight: 700, fontSize: '14px',
                        cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}
                    >
                      <span>2. Aesthetics & Visual Settings</span>
                      <span>{activeAccordion === 1 ? '▲' : '▼'}</span>
                    </div>

                    {activeAccordion === 1 && (
                      <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Narrative Mode:</label>
                          {inputMode === 'planner_import' ? (
                            <div>
                              <div style={{ padding: '10px 12px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', color: '#10b981', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>✓</span> [Auto-driven per Baris Content Planner]
                              </div>
                              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>Gaya narasi ditarik presisi dari masing-masing adegan planner master.</div>
                            </div>
                          ) : (
                            <select value={narrativeMode} onChange={e => setNarrativeMode(e.target.value)} style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}>
                              <option value="Storytelling">Storytelling (Bercerita / Daily-life)</option>
                              <option value="Problem-Solution">Problem-Solution (Masalah & Solusi)</option>
                              <option value="Educational">Educational (Tutorial / Penjelasan)</option>
                            </select>
                          )}
                        </div>

                        <div>
                          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Aspect Ratio:</label>
                          <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}>
                            <option value="9:16">9:16 (Vertical TikTok/Reels)</option>
                            <option value="16:9">16:9 (Horizontal YouTube)</option>
                            <option value="1:1">1:1 (Square)</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Target AI:</label>
                          <select value={targetAi} onChange={e => setTargetAi(e.target.value)} style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}>
                            <option value="Google Veo (8s)">Google Veo (8s)</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Video Model:</label>
                          <select value={videoModel} onChange={e => setVideoModel(e.target.value)} style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}>
                            <option value="veo_31_lite">Veo 3.1 Lite</option>
                          </select>
                        </div>

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
                            type="number" min="3" max="6"
                            value={targetClipsCount}
                            onChange={e => setTargetClipsCount(Number(e.target.value))}
                            style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                            required
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Jumlah Kata Per Klip:</label>
                          <select value={wordsPerClip} onChange={e => setWordsPerClip(e.target.value)} style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}>
                            <option value="15-16 kata">15-16 kata</option>
                            <option value="17-19 kata">17-19 kata</option>
                            <option value="20-24 kata">20-24 kata</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Visual Style:</label>
                          <select value={visualStyle} onChange={e => setVisualStyle(e.target.value)} style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}>
                            <option value="Cinematic">Cinematic</option>
                            <option value="UGC">UGC</option>
                            <option value="Macrophotography">Macrophotography</option>
                          </select>
                        </div>

                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Visual Mode:</label>
                          <select value={visualMode} onChange={e => setVisualMode(e.target.value)} style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}>
                            <option value="hybrid_lock">Double-Pass Pixel Lock (Banana T2I ➜ Veo 3.1 I2V)</option>
                            <option value="pure_t2v">Pure Text-To-Video (T2V Langsung)</option>
                          </select>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <input
                            type="checkbox"
                            id="bridge_check"
                            checked={isBridgingActive}
                            onChange={e => setIsBridgingActive(e.target.checked)}
                            style={{ width: '18px', height: '18px', accentColor: '#6366f1', cursor: 'pointer' }}
                          />
                          <label htmlFor="bridge_check" style={{ fontSize: '14px', fontWeight: 700, color: '#818cf8', cursor: 'pointer' }}>
                            🔌 Aktifkan Bridging Promosi Produk (Sandwich Protocol)
                          </label>
                        </div>

                        {isBridgingActive && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '4px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                              <div>
                                <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Sisipkan Transisi pada Klip Ke- (X):</label>
                                <input
                                  type="number" min="2" max={targetClipsCount}
                                  value={bridgeAtClip}
                                  onChange={e => setBridgeAtClip(Number(e.target.value))}
                                  style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                                  required
                                />
                              </div>

                              <div>
                                <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Durasi Bridging Produk (Klip):</label>
                                <select
                                  value={bridgeDurationClips}
                                  onChange={e => setBridgeDurationClips(parseInt(e.target.value) || 1)}
                                  style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                                >
                                  <option value="0">0 (Sisa seluruh klip)</option>
                                  <option value="1">1 Klip</option>
                                  <option value="2">2 Klip</option>
                                  <option value="3">3 Klip</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Gaya Promosi:</label>
                              <select value={promotionStyle} onChange={e => setPromotionStyle(e.target.value)} style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}>
                                <option value="Softselling">Softselling (Halus, Menyatu dengan Konten)</option>
                                <option value="Hardsell">Hardsell (Jelas, Langsung Promosi USP)</option>
                                <option value="Education">Education (Review Kinerja Produk Logis)</option>
                              </select>
                            </div>

                            <div>
                              <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Metode Penyertaan Produk:</label>
                              <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: '#f3f4f6' }}>
                                  <input type="radio" name="bridgingModeStrat" value="manual_input" checked={bridgingMode === 'manual_input'} onChange={e => setBridgingMode(e.target.value)} />
                                  Tulis/Auto-load Manual
                                </label>
                                {products.length > 0 && (
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: '#f3f4f6' }}>
                                    <input type="radio" name="bridgingModeStrat" value="select_existing" checked={bridgingMode === 'select_existing'} onChange={e => setBridgingMode(e.target.value)} />
                                    Pilih dari Pustaka
                                  </label>
                                )}
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: '#f3f4f6' }}>
                                  <input type="radio" name="bridgingModeStrat" value="url_extract" checked={bridgingMode === 'url_extract'} onChange={e => setBridgingMode(e.target.value)} />
                                  Ekstrak dari URL
                                </label>
                              </div>
                            </div>

                            {bridgingMode === 'select_existing' && products.length > 0 && (
                              <div>
                                <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Pilih Produk Terdaftar:</label>
                                <select value={targetProductId} onChange={e => setTargetProductId(e.target.value)} style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}>
                                  <option value="">-- Pilih Produk Terdaftar --</option>
                                  {products.map(p => (
                                    <option key={p.id} value={p.id}>{p.brand_name || 'Generik'} - {p.product_name}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {bridgingMode === 'url_extract' && (
                              <div>
                                <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>URL Produk (Tokopedia/Shopee):</label>
                                <input type="url" placeholder="https://tokopedia.link/..." value={productUrl} onChange={e => setProductUrl(e.target.value)} style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }} />
                              </div>
                            )}

                            {visualMode === 'hybrid_lock' && (() => {
                              const activeProd = products.find(p => p.id === targetProductId);
                              const studioPath = activeProd?.generated_photo_url || activeProd?.cleaned_photo_url || activeProd?.clean_photo_url || activeProd?.photo_url || '';
                              const studioName = studioPath ? studioPath.split('/').pop() : (productName ? `${productName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_studio.png` : null);

                              if (inputMode === 'planner_import' || bridgingMode === 'select_existing' || studioName) {
                                return (
                                  <div style={{ padding: '12px 14px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '8px', color: '#818cf8', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '16px' }}>📸</span>
                                    <div>
                                      <div>Foto Studio produk otomatis ditarik dari database:</div>
                                      <code style={{ background: 'rgba(0,0,0,0.3)', padding: '3px 8px', borderRadius: '4px', color: '#a5b4fc', fontSize: '11px', display: 'inline-block', marginTop: '4px' }}>
                                        {studioName || 'foto_studio_terdaftar.png'}
                                      </code>
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <div>
                                  <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Deklarasikan Nama Berkas Objek (Declare Filename):</label>
                                  <input
                                    type="text"
                                    placeholder="Contoh: botol_serum_biru.png"
                                    value={productFilenameDeclare}
                                    onChange={e => setProductFilenameDeclare(e.target.value)}
                                    style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                                  />
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ACCORDION 4: Visual Swap Overrides (VSO Engine) */}
                  <div style={{ background: '#18181b', borderRadius: '10px', border: '1px solid #27272a', overflow: 'hidden' }}>
                    <div
                      onClick={() => setActiveAccordion(3)}
                      style={{
                        padding: '14px 18px', background: activeAccordion === 3 ? 'rgba(99, 102, 241, 0.12)' : '#18181b',
                        color: activeAccordion === 3 ? '#818cf8' : '#f3f4f6', fontWeight: 700, fontSize: '14px',
                        cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}
                    >
                      <span>4. Visual Swap Overrides (VSO Engine)</span>
                      <span>{activeAccordion === 3 ? '▲' : '▼'}</span>
                    </div>

                    {activeAccordion === 3 && (
                      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <input
                            type="checkbox"
                            id="vso_check"
                            checked={isVsoActive}
                            onChange={e => setIsVsoActive(e.target.checked)}
                            style={{ width: '18px', height: '18px', accentColor: '#6366f1', cursor: 'pointer' }}
                          />
                          <label htmlFor="vso_check" style={{ fontSize: '14px', fontWeight: 700, color: '#818cf8', cursor: 'pointer' }}>
                            🎭 Aktifkan Visual Swap Overrides (VSO Engine)
                          </label>
                        </div>

                        {isVsoActive && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                              <div>
                                <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Konsep Karakter (Framing):</label>
                                <select
                                  value={characterConcept}
                                  onChange={e => setCharacterConcept(e.target.value)}
                                  style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                                >
                                  <option value="faceless">Faceless (Wajah Terpotong - Fokus Tangan)</option>
                                  <option value="pov">POV (First Person View)</option>
                                  <option value="silhouette">Siluet Bayangan (Aesthetic Shadow)</option>
                                  <option value="stylized_3d">3D Stylized Claymation</option>
                                  <option value="cartoon_face">Mascot Universe (Cartoon Face)</option>
                                </select>
                              </div>

                              <div>
                                <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Demografi Subjek / Model:</label>
                                <select
                                  value={subjectDemographic}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setSubjectDemographic(val);
                                    setWardrobeStyle('random');
                                    if (val.startsWith('mascot_universe_')) setCharacterConcept('cartoon_face');
                                    else if (val.startsWith('stylized_3d_')) setCharacterConcept('stylized_3d');
                                    else setCharacterConcept('faceless');
                                  }}
                                  style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
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

                            {/* Maskot Visual Style Preset */}
                            {subjectDemographic.startsWith('mascot_universe_') && (
                              <div>
                                <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>🎨 Gaya Estetika Animasi Maskot:</label>
                                <select value={visualStylePreset} onChange={e => setVisualStylePreset(e.target.value)} style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}>
                                  <option value="3d_claymation_cozy">3D Claymation Cozy (Shaun the Sheep Look)</option>
                                  <option value="kawaii_flat_vector">2D Kawaii Flat Vector (Minimalis Jepang)</option>
                                  <option value="ghibli_watercolor">Studio Ghibli Watercolor (Cat Air Magis)</option>
                                </select>
                              </div>
                            )}

                            {/* Wardrobe Style */}
                            {!subjectDemographic.startsWith('mascot_universe_') && (
                              <div>
                                <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Pakaian / Wardrobe Style:</label>
                                <select value={wardrobeStyle} onChange={e => setWardrobeStyle(e.target.value)} style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}>
                                  <option value="random">🎲 Random (Acak)</option>
                                  <option value="sequential">🔄 Sequential (Urut per baris)</option>
                                  {subjectDemographic === 'stylized_3d_muslimah' ? (
                                    <optgroup label="Pakaian 3D Muslimah">
                                      <option value="3d_fem_emerald">Gamis Hijau Emerald 3D</option>
                                      <option value="3d_fem_pastel_pink">Gamis Pastel Pink 3D</option>
                                      <option value="3d_fem_jetblack">Abaya Hitam Legam 3D</option>
                                    </optgroup>
                                  ) : subjectDemographic === 'stylized_3d_male' ? (
                                    <optgroup label="Pakaian 3D Pria">
                                      <option value="3d_male_tan_knit">Sweater Tan Rajut 3D</option>
                                      <option value="3d_male_sage_jacket">Jaket Kasual Sage Green 3D</option>
                                    </optgroup>
                                  ) : subjectDemographic === 'caucasian_male' ? (
                                    <optgroup label="Preset Warna Pria Kaukasia">
                                      <option value="male_terracotta">Pria: Terracotta</option>
                                      <option value="male_caramel">Pria: Caramel Latte</option>
                                      <option value="male_navy_blue">Pria: Navy Blue</option>
                                    </optgroup>
                                  ) : (
                                    <optgroup label="Preset Warna Gamis/Hijau Syar'i">
                                      <option value="amber_terracotta">Amber Haze & Terracotta</option>
                                      <option value="mocca_caramel">Mocca & Caramel Latte</option>
                                      <option value="sage_muted">Sage Green Muted</option>
                                      <option value="cloud_dancer">Cloud Dancer (Off-White Modern)</option>
                                    </optgroup>
                                  )}
                                  <option value="custom">-- Tulis Custom --</option>
                                </select>

                                {wardrobeStyle === 'custom' && (
                                  <input
                                    type="text"
                                    placeholder="Ketik pakaian/hijab kustom..."
                                    value={wardrobeStyleCustom}
                                    onChange={e => setWardrobeStyleCustom(e.target.value)}
                                    style={{ width: '100%', padding: '10px', marginTop: '8px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                                  />
                                )}
                              </div>
                            )}

                            {/* Lighting Style */}
                            <div>
                              <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Pencahayaan / Lighting Style:</label>
                              <select value={lightingStyle} onChange={e => setLightingStyle(e.target.value)} style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}>
                                <option value="window_daylight">Natural Window Daylight (Cahaya Jendela)</option>
                                <option value="warm_indoor">Warm Ambient Indoor (Hangat Rumahan)</option>
                                <option value="studio_bright">Bright Studio Softbox (Terang Studio)</option>
                                <option value="cinematic_mood">Cinematic Mood Lighting (Estetik Sinematik)</option>
                                <option value="custom">-- Tulis Custom --</option>
                              </select>

                              {lightingStyle === 'custom' && (
                                <input
                                  type="text"
                                  placeholder="Ketik pencahayaan kustom..."
                                  value={lightingStyleCustom}
                                  onChange={e => setLightingStyleCustom(e.target.value)}
                                  style={{ width: '100%', padding: '10px', marginTop: '8px', background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '8px' }}
                                />
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    style={{ padding: '10px 18px', background: '#27272a', color: '#9ca3af', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    style={{
                      padding: '12px 24px', backgroundImage: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                      color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
                    }}
                  >
                    {creating ? 'Memproses...' : '✨ Buat Strategic Campaign'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
