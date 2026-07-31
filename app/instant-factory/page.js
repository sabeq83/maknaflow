"use client";

import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import { VOICE_PERSONAS } from '@/lib/voice-personas';
import { useRouter } from 'next/navigation';

export default function InstantFactoryPage() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('running');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('storyboard');
  const [inputMode, setInputMode] = useState('manual');
  const [toast, setToast] = useState(null);

  // Mass Production Mode state variables
  const [productionMode, setProductionMode] = useState('single'); // 'single' or 'mass'
  const [activeAccordion, setActiveAccordion] = useState(0);
  const [parsedRows, setParsedRows] = useState([]);
  const [uploadingImages, setUploadingImages] = useState({});
  const [manualImages, setManualImages] = useState({});

  // Global settings for Mass Campaign
  const [accountName, setAccountName] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [narrativeMode, setNarrativeMode] = useState('Storytelling');
  const [visualStyle, setVisualStyle] = useState('UGC');
  const [faceVisibility, setFaceVisibility] = useState('Faceless');
  const [targetAiEngine, setTargetAiEngine] = useState('Google Veo (8s)');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [voicePersona, setVoicePersona] = useState('Aoede');
  const [totalClips, setTotalClips] = useState(4);
  const [wordsPerClip, setWordsPerClip] = useState(12);
  const [speedControl, setSpeedControl] = useState(2.5);
  const [customInstruction, setCustomInstruction] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('id-ID');
  const [enableVoAudit, setEnableVoAudit] = useState(1); // Default 1 (Yes)
  
  // Bridging & Visual mode settings
  const [isBridgingActive, setIsBridgingActive] = useState(false);
  const [bridgeAtClip, setBridgeAtClip] = useState(2);
  const [visualMode, setVisualMode] = useState('hybrid_lock');

  // Automation flags
  const [enableTts, setEnableTts] = useState(true);
  const [enableGlabs, setEnableGlabs] = useState(true);
  const [enableFfmpeg, setEnableFfmpeg] = useState(true);
  const [enableSocialPost, setEnableSocialPost] = useState(false);
  const [postYoutube, setPostYoutube] = useState(false);
  const [postTiktok, setPostTiktok] = useState(false);
  const [postFacebook, setPostFacebook] = useState(false);

  const copyToClipboard = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setToast({ msg: `${label} copied!`, type: 'success' });
    setTimeout(() => setToast(null), 3000);
  };

  const [history, setHistory] = useState([]);
  const [currentCampaignId, setCurrentCampaignId] = useState(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [brandProfiles, setBrandProfiles] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState('');

  // Scheduler & Logger
  const [isSchedulerActive, setIsSchedulerActive] = useState(true);
  const [terminalLogs, setTerminalLogs] = useState('Menginisialisasi log Instant Factory...');
  const [expandedCampaignId, setExpandedCampaignId] = useState(null);
  const logIntervalRef = useRef(null);
  const terminalRef = useRef(null);

  useEffect(() => {
    fetchHistory();
    fetchSchedulerStatus();
    pollLogs();
    fetch('/api/v2/brand-profiles').then(r => r.json()).then(d => { if (d.success) setBrandProfiles(d.data || []); }).catch(() => {});
    logIntervalRef.current = setInterval(pollLogs, 5000);
    return () => clearInterval(logIntervalRef.current);
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  async function fetchSchedulerStatus() {
    try {
      const res = await fetch('/api/scheduler/control');
      const data = await res.json();
      if (data.success) setIsSchedulerActive(data.data.running);
    } catch (e) {}
  }

  async function pollLogs() {
    try {
      const res = await fetch(`/api/system-logs?type=instant&t=${Date.now()}`);
      if (res.ok) {
        const text = await res.text();
        const lines = text.split('\n');
        const last500 = lines.slice(-500).join('\n');
        setTerminalLogs(last500 || 'Belum ada log aktivitas Instant Factory.');
      }
    } catch (e) {}
  }

  async function toggleGlobalScheduler() {
    const action = isSchedulerActive ? 'stop' : 'start';
    try {
      const res = await fetch('/api/scheduler/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const json = await res.json();
      if (json.success) {
        setIsSchedulerActive(!isSchedulerActive);
        setToast({ msg: `Skeduler berhasil ${!isSchedulerActive ? 'diaktifkan' : 'dimatikan'}`, type: 'success' });
        setTimeout(() => setToast(null), 3000);
        pollLogs();
      }
    } catch (e) {}
  }

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/v2/instant-factory/history');
      const data = await res.json();
      if (data.success) {
        setHistory(data.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const viewHistoryItem = async (id) => {
    const histItem = history.find(h => h.id === id || String(h.id) === String(id));
    if (histItem && histItem.is_mass_production) {
      router.push(`/instant-factory/${id}`);
      return;
    }
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/v2/instant-factory/${id}`);
      const data = await res.json();
      if (data.success && data.data.parsed_json) {
        setResult(data.data.parsed_json);
        setCurrentCampaignId(data.data.id);
        setToast({ msg: 'History loaded!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        setError('Failed to load or parse history data.');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteHistoryItem = async (id) => {
    if (!confirm('Hapus riwayat ini secara permanen?')) return;
    try {
      const res = await fetch(`/api/v2/instant-factory/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchHistory();
        setToast({ msg: 'History deleted!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
        pollLogs();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopy = async (id) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/v2/instant-factory/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil data kampanye');

      const c = data.campaign;
      const items = data.items || [];

      if (c.is_mass_production === 1) {
        setProductionMode('mass');
        setCampaignName(`Copy of ${c.campaign_name || 'Mass Production'}`);
        setNarrativeMode(c.narrative_mode || 'Storytelling');
        setVisualStyle(c.visual_style || 'UGC');
        setFaceVisibility(c.face_visibility || 'Faceless');
        setTargetAiEngine(c.target_ai_engine || 'Google Veo (8s)');
        setAspectRatio(c.aspect_ratio || '9:16');
        setVoicePersona(c.voice_persona || 'Aoede');
        setTotalClips(c.total_clips || 4);
        setWordsPerClip(c.words_per_clip || 12);
        setSpeedControl(c.speed_control || 2.5);
        setCustomInstruction(c.custom_instruction || '');
        setTargetLanguage(c.target_language || 'id-ID');
        setIsBridgingActive(c.is_bridging_active === 1);
        setBridgeAtClip(c.bridge_at_clip || 2);
        setVisualMode(c.visual_mode || 'hybrid_lock');
        setSelectedBrandId(c.brand_profile_id || '');

        setEnableTts(c.enable_tts === 1);
        setEnableGlabs(c.enable_glabs === 1);
        setEnableFfmpeg(c.enable_ffmpeg === 1);
        setEnableSocialPost(c.enable_social_post === 1);
        setPostYoutube(c.post_youtube_draft === 1);
        setPostTiktok(c.post_tiktok_draft === 1);
        setPostFacebook(c.post_facebook_draft === 1);

        const mapped = items.map(item => {
          try {
            const payload = JSON.parse(item.row_creative_payload);
            return {
              row_number: payload.row_number,
              product_name: payload.product_name || '',
              product_desc: payload.product_desc || '',
              product_image_url: payload.product_image_url || '',
              custom_hook: payload.custom_hook || '',
              visual_action_guideline: payload.visual_action_guideline || '',
              custom_instruction: payload.custom_instruction || ''
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
        setInputMode(c.product_url ? 'url' : 'manual');
        setFormData({
          product_name: c.product_name ? `Copy of ${c.product_name}` : '',
          product_description: c.product_description || '',
          product_url: c.product_url || '',
          product_media: null, // file object
          narrative_mode: c.narrative_mode || 'Storytelling',
          visual_style: c.visual_style || 'UGC',
          face_visibility: c.face_visibility || 'Faceless',
          aspect_ratio: c.aspect_ratio || '9:16',
          total_clips: c.total_clips || 4,
          voice_persona: c.voice_persona || 'Aoede',
          speed_control: c.speed_control || 2.5,
          words_per_clip: c.words_per_clip || 12,
          custom_instruction: c.custom_instruction || '',
          target_language: c.target_language || 'id-ID'
        });
        setSelectedBrandId(c.brand_profile_id || '');
      }

      setResult(null); // Clear result view to show input forms
      setToast({ msg: 'Konfigurasi kampanye disalin ke form!', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRegenerateTab = async (targetTab) => {
    if (!currentCampaignId) return;
    setIsRegenerating(true);
    try {
      const res = await fetch('/api/v2/instant-factory/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: currentCampaignId, targetTab })
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
        setToast({ msg: 'Berhasil diregenerate!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        throw new Error(data.error);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setIsRegenerating(false);
    }
  };

  const [formData, setFormData] = useState({
    product_name: '',
    product_description: '',
    product_url: '',
    product_media: null,
    narrative_mode: 'Storytelling',
    visual_style: 'UGC',
    face_visibility: 'Faceless',
    aspect_ratio: '9:16',
    total_clips: 4,
    voice_persona: 'Aoede',
    speed_control: 2.5,
    words_per_clip: 12,
    custom_instruction: '',
    target_language: 'id-ID'
  });

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'product_media') {
      setFormData(prev => ({ ...prev, [name]: files[0] }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const formPayload = new FormData();
      Object.keys(formData).forEach(key => {
        if (formData[key] !== null && formData[key] !== undefined) {
          formPayload.append(key, formData[key]);
        }
      });
      if (selectedBrandId) {
        formPayload.append('brand_profile_id', selectedBrandId);
      }
      formPayload.append('status', submitStatus);
      formPayload.append('enable_vo_audit', enableVoAudit ? '1' : '0');

      const res = await fetch('/api/v2/instant-factory', {
        method: 'POST',
        body: formPayload,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Terjadi kesalahan saat memproses data.');
      }

      if (data.status === 'draft') {
        setToast({ msg: 'Campaign saved as draft!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
        setResult(null);
        setFormData({
          product_name: '',
          product_description: '',
          product_url: '',
          product_media: null,
          narrative_mode: 'Storytelling',
          visual_style: 'UGC',
          face_visibility: 'Faceless',
          aspect_ratio: '9:16',
          total_clips: 4,
          voice_persona: 'Aoede',
          speed_control: 2.5,
          words_per_clip: 12,
          custom_instruction: '',
          target_language: 'id-ID'
        });
        setSelectedBrandId('');
      } else {
        setResult(data.data);
        setCurrentCampaignId(data.campaignId);
      }
      fetchHistory(); // Refresh history after new generation
      pollLogs();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      "Nama Produk",
      "Deskripsi",
      "Tautan Gambar Produk",
      "Hook",
      "Ide Visual",
      "Custom Instruction"
    ];
    const row1 = [
      "Skintific Moisturizer",
      "Pelembab 5X Ceramide untuk memperbaiki skin barrier, meredakan kemerahan 24 jam.",
      "https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?q=80&w=400",
      "Kalian yang skin barriernya rusak, buruan merapat!",
      "Tangan sedang mengoleskan gel transparan ke pipi secara merata.",
      "Gunakan nada bicara yang santai dan penuh edukasi."
    ];
    const row2 = [
      "Wardah Sunscreen",
      "Sunscreen gel SPF 30 PA+++ dengan double protection.",
      "",
      "Matahari makin terik, jangan skip produk satu ini!",
      "Model menyemprotkan sunscreen ke wajah yang segar.",
      ""
    ];
    const csvContent = "\uFEFF" + [headers, row1, row2].map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "ifc_mass_production_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
        
        const mapped = data.map((row, idx) => {
          return {
            row_number: idx + 1,
            product_name: row['Nama Produk'] || row['nama_produk'] || row['product_name'] || '',
            product_desc: row['Deskripsi'] || row['deskripsi'] || row['product_desc'] || row['Deskripsi Produk'] || '',
            product_image_url: row['Tautan Gambar Produk'] || row['product_image_url'] || row['url_foto_produk'] || '',
            custom_hook: row['Hook'] || row['hook'] || row['custom_hook'] || '',
            visual_action_guideline: row['Ide Visual'] || row['ide_visual'] || row['visual_action'] || row['visual_action_guideline'] || '',
            custom_instruction: row['Custom Instruction'] || row['custom_instruction'] || ''
          };
        });
        
        setParsedRows(mapped);
        setToast({ msg: `Berhasil membaca ${mapped.length} baris dari file.`, type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } catch (err) {
        setError(`Gagal membaca file: ${err.message}`);
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
      const res = await fetch('/api/v2/instant-factory/bulk/upload', {
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
      setToast({ msg: `Gambar untuk baris #${rowIndex + 1} berhasil diunggah.`, type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setError(`Gagal mengunggah gambar: ${err.message}`);
    } finally {
      setUploadingImages(prev => ({ ...prev, [rowIndex]: false }));
    }
  };

  const handleMassSubmit = async (e) => {
    e.preventDefault();
    if (!campaignName.trim()) {
      setError('Nama Kampanye wajib diisi.');
      return;
    }
    if (parsedRows.length === 0) {
      setError('Unggah file matriks konten terlebih dahulu.');
      return;
    }

    if (isBridgingActive) {
      if (bridgeAtClip < 2 || bridgeAtClip > totalClips) {
        setError(`Titik transisi harus berada di antara klip ke-2 hingga ke-${totalClips}.`);
        return;
      }
      for (const row of parsedRows) {
        const hasUrl = row.product_image_url && row.product_image_url.trim() !== '';
        
        if (!hasUrl) {
          const hasManualName = row.product_name && row.product_name.trim() !== '';
          const hasManualDesc = row.product_desc && row.product_desc.trim() !== '';
          const manualImage = manualImages[row.row_number - 1];

          if (!hasManualName || !hasManualDesc) {
            setError(`Baris #${row.row_number} diinput secara manual tetapi data produk belum lengkap (Nama dan Deskripsi wajib diisi).`);
            return;
          }

          if (visualMode === 'hybrid_lock' && !manualImage) {
            setError(`Baris #${row.row_number} diinput secara manual tetapi belum memiliki Gambar Produk untuk mode Hybrid Lock (Unggah gambar via UI atau lampirkan URL gambar di CSV).`);
            return;
          }
        }
      }
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);

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

      const global_settings = {
        status: submitStatus,
        brand_profile_id: selectedBrandId || null,
        narrative_mode: narrativeMode,
        visual_style: visualStyle,
        face_visibility: faceVisibility,
        target_ai_engine: targetAiEngine,
        aspect_ratio: aspectRatio,
        voice_persona: voicePersona,
        total_clips: totalClips,
        words_per_clip: wordsPerClip,
        speed_control: speedControl,
        custom_instruction: customInstruction,
        target_language: targetLanguage,
        is_bridging_active: isBridgingActive,
        bridge_at_clip: bridgeAtClip,
        visual_mode: visualMode,
        enable_tts: enableTts,
        enable_glabs: enableGlabs,
        enable_ffmpeg: enableFfmpeg,
        enable_social_post: enableSocialPost,
        post_youtube_draft: postYoutube,
        post_tiktok_draft: postTiktok,
        post_facebook_draft: postFacebook,
        enable_vo_audit: enableVoAudit
      };

      const res = await fetch('/api/v2/instant-factory/bulk', {
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

      setToast({ msg: `Batch Mass Production "${campaignName}" berhasil didaftarkan!`, type: 'success' });
      setTimeout(() => setToast(null), 3000);
      
      setCampaignName('');
      setParsedRows([]);
      setManualImages({});
      fetchHistory();
      pollLogs();
      
      router.push(`/instant-factory/${data.campaign_id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const safeRender = (val) => {
    if (typeof val === 'object' && val !== null) {
      return val.mood || val.tone || val.action || val.description || JSON.stringify(val);
    }
    return val;
  };

  const handleStoryboardChange = (idx, segmentType, field, value) => {
    setResult(prev => {
      const newResult = { ...prev };
      newResult.production_storyboard = [...newResult.production_storyboard];
      newResult.production_storyboard[idx] = { ...newResult.production_storyboard[idx] };
      newResult.production_storyboard[idx][segmentType] = { ...newResult.production_storyboard[idx][segmentType] };
      newResult.production_storyboard[idx][segmentType][field] = value;
      return newResult;
    });
  };

  const handleAssetChange = (field, value) => {
    setResult(prev => ({
      ...prev,
      distribution_assets: {
        ...prev.distribution_assets,
        [field]: value
      }
    }));
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-container">
          <header className="page-header">
            <h2>🚀 V5 Instant Factory</h2>
            <p>The Ultra-Compact 1-Stage AI Production Pipeline</p>
          </header>

          {error && (
            <div className="card" style={{ borderLeft: '4px solid var(--danger)', marginBottom: '24px' }}>
              <strong style={{ color: 'var(--danger)' }}>Error:</strong> {error}
            </div>
          )}

          {isProcessing ? (
            <div className="card loading-overlay">
              <div className="spinner"></div>
              <h3 style={{ color: 'var(--text-primary)', marginTop: '16px' }}>Manufacturing Instant Production Blueprint...</h3>
              <p className="loading-text" style={{ textAlign: 'center', maxWidth: '400px' }}>
                Analysing Product, Writing Scripts, and Generating AI Prompts in One Unified Step.<br/><br/>
                <strong style={{ color: 'var(--accent-light)' }}>(Estimasi Selesai: 15-20 Detik)</strong>
              </p>
            </div>
          ) : result ? (
            <div className="workspace-editor">
              <div className="card" style={{ borderLeft: '4px solid var(--success)', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--success)' }}>✅ <strong>Blueprint Berhasil Dibuat!</strong> (Single API Stage Selesai)</span>
                <button onClick={() => setResult(null)} className="btn btn-secondary btn-sm">Buat Baru</button>
              </div>

              {/* STRATEGY PREVIEW */}
              <div className="card" style={{ marginBottom: '24px' }}>
                <div className="card-title">🧠 Core Campaign Concept</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="scene-field">
                    <div className="scene-field-label">USP</div>
                    <div className="scene-field-value">{result.campaign_strategy?.unique_selling_point}</div>
                  </div>
                  <div className="scene-field">
                    <div className="scene-field-label">Hook Strategy</div>
                    <div className="scene-field-value">{result.campaign_strategy?.core_campaign_concept?.hook_strategy}</div>
                  </div>
                  <div className="scene-field">
                    <div className="scene-field-label">Category Entry Point (CEP)</div>
                    <div className="scene-field-value">
                      <strong>{result.campaign_strategy?.core_campaign_concept?.cep_type}</strong><br/>
                      {result.campaign_strategy?.core_campaign_concept?.situation_context}
                    </div>
                  </div>
                  <div className="scene-field">
                    <div className="scene-field-label">VFO Matrix</div>
                    <div className="scene-field-value">{result.campaign_strategy?.core_campaign_concept?.vfo_matrix}</div>
                  </div>
                  <div className="scene-field" style={{ gridColumn: '1 / -1' }}>
                    <div className="scene-field-label">Target Audience</div>
                    <div className="scene-field-value">{result.campaign_strategy?.target_audience_profile}</div>
                  </div>
                </div>
              </div>

              {/* TABS */}
              <div className="tabs">
                {['storyboard', 'voiceover', 't2i_prompts', 'i2v_prompts', 'social_copy'].map(tab => (
                  <button 
                    key={tab} 
                    onClick={() => setActiveTab(tab)}
                    className={`tab ${activeTab === tab ? 'active' : ''}`}
                  >
                    {tab.replace('_', ' ').toUpperCase()}
                  </button>
                ))}
              </div>

              {/* TAB CONTENTS */}
              <div className="tab-content">
                {activeTab === 'storyboard' && (
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table className="ideas-table">
                      <thead>
                        <tr>
                          <th>Scene</th>
                          <th>Visual Action</th>
                          <th>Camera Movement</th>
                          <th>Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.production_storyboard?.map((scene, idx) => (
                          <tr key={idx}>
                            <td style={{ textAlign: 'center' }}>
                              <span className="scene-number">{scene.scene_number}</span>
                            </td>
                            <td>{safeRender(scene.visual_segment?.visual_action)}</td>
                            <td>{safeRender(scene.visual_segment?.camera_movement)}</td>
                            <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{safeRender(scene.duration)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'voiceover' && (
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginBottom: '8px' }}>
                      <button className="btn btn-sm btn-primary" disabled={isRegenerating || !currentCampaignId} onClick={() => handleRegenerateTab('voiceover')}>
                        {isRegenerating ? '🔄 Regenerating...' : '🔄 Regenerate Voiceovers'}
                      </button>
                      <button className="btn btn-sm btn-secondary" onClick={() => copyToClipboard(
                        result.production_storyboard?.map((s) => `Scene ${s.scene_number}: ${s.audio_segment?.voiceover_text}`).join('\n\n'),
                        'All Voiceovers'
                      )}>📋 Copy All Voiceovers</button>
                    </div>
                    {result.production_storyboard?.map((scene, idx) => (
                      <div key={idx} className="scene-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <div>
                            <span className="scene-number">Scene {scene.scene_number}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                              {scene.audio_segment?.word_count} words | Mood: {safeRender(scene.audio_segment?.audio_mood)}
                            </span>
                          </div>
                          <button className="btn btn-sm btn-secondary" onClick={() => copyToClipboard(scene.audio_segment?.voiceover_text, `Voiceover Scene ${scene.scene_number}`)}>Copy</button>
                        </div>
                        <textarea 
                          className="form-textarea" 
                          value={scene.audio_segment?.voiceover_text || ''} 
                          onChange={(e) => handleStoryboardChange(idx, 'audio_segment', 'voiceover_text', e.target.value)}
                          style={{ fontSize: '1.05rem', color: 'var(--text-primary)', lineHeight: '1.6', width: '100%' }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 't2i_prompts' && (
                  <div style={{ display: 'grid', gap: '20px' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginBottom: '8px' }}>
                      <button className="btn btn-sm btn-primary" disabled={isRegenerating || !currentCampaignId} onClick={() => handleRegenerateTab('t2i_prompts')}>
                        {isRegenerating ? '🔄 Regenerating...' : '🔄 Regenerate T2I'}
                      </button>
                      <button className="btn btn-sm btn-secondary" onClick={() => copyToClipboard(
                        result.production_storyboard?.map((s) => `--- Scene ${s.scene_number} ---\n${s.ai_generation_prompts?.t2i_prompt_plaintext}`).join('\n\n'),
                        'All T2I Prompts'
                      )}>📋 Copy All T2I Prompts</button>
                    </div>
                    {result.production_storyboard?.map((scene, idx) => (
                      <div key={idx} className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <div className="scene-number">Scene {scene.scene_number} - T2I Prompt</div>
                          <button className="btn btn-sm btn-secondary" onClick={() => copyToClipboard(scene.ai_generation_prompts?.t2i_prompt_plaintext, `T2I Prompt Scene ${scene.scene_number}`)}>Copy</button>
                        </div>
                        <textarea 
                          className="form-textarea prompt-block" 
                          value={scene.ai_generation_prompts?.t2i_prompt_plaintext || ''} 
                          onChange={(e) => handleStoryboardChange(idx, 'ai_generation_prompts', 't2i_prompt_plaintext', e.target.value)}
                          style={{ width: '100%', minHeight: '120px' }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'i2v_prompts' && (
                  <div style={{ display: 'grid', gap: '20px' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginBottom: '8px' }}>
                      <button className="btn btn-sm btn-primary" disabled={isRegenerating || !currentCampaignId} onClick={() => handleRegenerateTab('i2v_prompts')}>
                        {isRegenerating ? '🔄 Regenerating...' : '🔄 Regenerate I2V'}
                      </button>
                      <button className="btn btn-sm btn-secondary" onClick={() => copyToClipboard(
                        result.production_storyboard?.map((s) => `--- Scene ${s.scene_number} ---\n${s.ai_generation_prompts?.i2v_prompt_plaintext}`).join('\n\n'),
                        'All I2V Prompts'
                      )}>📋 Copy All I2V Prompts</button>
                    </div>
                    {result.production_storyboard?.map((scene, idx) => (
                      <div key={idx} className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <div className="scene-number">Scene {scene.scene_number} - I2V Prompt</div>
                          <button className="btn btn-sm btn-secondary" onClick={() => copyToClipboard(scene.ai_generation_prompts?.i2v_prompt_plaintext, `I2V Prompt Scene ${scene.scene_number}`)}>Copy</button>
                        </div>
                        <textarea 
                          className="form-textarea prompt-block" 
                          value={scene.ai_generation_prompts?.i2v_prompt_plaintext || ''} 
                          onChange={(e) => handleStoryboardChange(idx, 'ai_generation_prompts', 'i2v_prompt_plaintext', e.target.value)}
                          style={{ width: '100%', minHeight: '120px' }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'social_copy' && (
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginBottom: '8px' }}>
                      <button className="btn btn-sm btn-primary" disabled={isRegenerating || !currentCampaignId} onClick={() => handleRegenerateTab('social_copy')}>
                        {isRegenerating ? '🔄 Regenerating...' : '🔄 Regenerate Copy'}
                      </button>
                      <button className="btn btn-sm btn-secondary" onClick={() => copyToClipboard(
                        `INSTAGRAM:\n${result.distribution_assets?.instagram_caption}\n\nTIKTOK:\n${result.distribution_assets?.tiktok_caption}\n\nYOUTUBE SHORTS:\nTitle: ${result.distribution_assets?.youtube_shorts_title}\nDesc: ${result.distribution_assets?.youtube_shorts_desc}`,
                        'All Social Copy'
                      )}>📋 Copy All Social Copy</button>
                    </div>
                    <div className="caption-block">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div className="caption-label" style={{ color: '#E1306C', margin: 0 }}>📷 Instagram Reels</div>
                        <button className="btn btn-sm btn-secondary" onClick={() => copyToClipboard(result.distribution_assets?.instagram_caption, 'IG Caption')}>Copy</button>
                      </div>
                      <textarea 
                        className="form-textarea caption-text" 
                        value={result.distribution_assets?.instagram_caption || ''} 
                        onChange={(e) => handleAssetChange('instagram_caption', e.target.value)}
                        style={{ width: '100%', minHeight: '100px' }}
                      />
                    </div>
                    <div className="caption-block">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div className="caption-label" style={{ color: 'var(--text-primary)', margin: 0 }}>🎵 TikTok</div>
                        <button className="btn btn-sm btn-secondary" onClick={() => copyToClipboard(result.distribution_assets?.tiktok_caption, 'TikTok Caption')}>Copy</button>
                      </div>
                      <textarea 
                        className="form-textarea caption-text" 
                        value={result.distribution_assets?.tiktok_caption || ''} 
                        onChange={(e) => handleAssetChange('tiktok_caption', e.target.value)}
                        style={{ width: '100%', minHeight: '100px' }}
                      />
                    </div>
                    <div className="caption-block">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div className="caption-label" style={{ color: '#FF0000', margin: 0 }}>▶️ YouTube Shorts</div>
                        <button className="btn btn-sm btn-secondary" onClick={() => copyToClipboard(`Title: ${result.distribution_assets?.youtube_shorts_title}\nDesc: ${result.distribution_assets?.youtube_shorts_desc}`, 'YouTube Copy')}>Copy</button>
                      </div>
                      <div className="scene-field" style={{ marginBottom: '12px' }}>
                        <div className="scene-field-label">Title</div>
                        <input 
                          type="text"
                          className="form-input scene-field-value" 
                          value={result.distribution_assets?.youtube_shorts_title || ''} 
                          onChange={(e) => handleAssetChange('youtube_shorts_title', e.target.value)}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div className="scene-field">
                        <div className="scene-field-label">Description</div>
                        <textarea 
                          className="form-textarea caption-text" 
                          value={result.distribution_assets?.youtube_shorts_desc || ''} 
                          onChange={(e) => handleAssetChange('youtube_shorts_desc', e.target.value)}
                          style={{ width: '100%', minHeight: '100px' }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              {/* Tabs Switcher for Production Mode */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', background: 'var(--bg-glass)', padding: '4px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <button type="button" onClick={() => setProductionMode('single')} style={{ flex: 1, padding: '12px', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'var(--font-sans)', background: productionMode === 'single' ? 'var(--accent)' : 'none', color: productionMode === 'single' ? '#fff' : 'var(--text-secondary)', transition: 'all 0.2s ease' }}>🎥 Single Video Campaign</button>
                <button type="button" onClick={() => setProductionMode('mass')} style={{ flex: 1, padding: '12px', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'var(--font-sans)', background: productionMode === 'mass' ? 'var(--accent)' : 'none', color: productionMode === 'mass' ? '#fff' : 'var(--text-secondary)', transition: 'all 0.2s ease' }}>🏭 Mass Production (CSV/XLSX)</button>
              </div>

              {productionMode === 'single' ? (
                <form onSubmit={handleSubmit} className="card">
                  {/* BAGIAN 1: IDENTITAS PRODUK */}
                  <div style={{ marginBottom: '32px' }}>
                    <div className="card-title">1. Identitas Produk</div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
                      Ekstrak data produk secara otomatis dari URL landing page atau input manual.
                    </p>
                    
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: 'var(--bg-glass)', padding: '4px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      <button type="button" onClick={() => setInputMode('manual')} style={{ flex: 1, padding: '8px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'var(--font-sans)', background: inputMode === 'manual' ? 'var(--accent)' : 'none', color: inputMode === 'manual' ? '#fff' : 'var(--text-secondary)' }}>📝 Input Manual</button>
                      <button type="button" onClick={() => setInputMode('url')} style={{ flex: 1, padding: '8px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'var(--font-sans)', background: inputMode === 'url' ? 'var(--accent)' : 'none', color: inputMode === 'url' ? '#fff' : 'var(--text-secondary)' }}>🔗 Scrape URL</button>
                    </div>

                    <div className="form-group" style={{ marginBottom: '16px' }}>
                      <label className="form-label">🏷️ Nama Akun (Brand Account)</label>
                      <select
                        className="form-select"
                        value={accountName}
                        onChange={e => {
                          const newAcc = e.target.value;
                          setAccountName(newAcc);
                          const now = new Date();
                          const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
                          setCampaignName(`[ IFC ${dateStr} ] - ${newAcc ? newAcc + ' - ' : ''}`);
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

                    <div className="form-group" style={{ marginBottom: '16px' }}>
                      <label className="form-label">Bahasa Naskah Voiceover (Script Language)</label>
                      <select name="target_language" value={formData.target_language} onChange={handleChange} className="form-select">
                        <option value="id-ID">🇮🇩 Bahasa Indonesia (Lokal)</option>
                        <option value="en-US">🇺🇸 English (Global / US Market)</option>
                      </select>
                    </div>

                    {inputMode === 'url' ? (
                      <div className="form-group">
                        <label className="form-label">URL Landing Page Produk *</label>
                        <input type="url" name="product_url" required={inputMode === 'url'} value={formData.product_url} onChange={handleChange} placeholder="https://example.com/product-page" className="form-input" />
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>AI akan otomatis mengunjungi website ini untuk menganalisis produk Anda secara langsung.</div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Nama Produk *</label>
                          <input type="text" name="product_name" required={inputMode === 'manual'} value={formData.product_name} onChange={handleChange} className="form-input" />
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Deskripsi / Manfaat Utama Produk *</label>
                          <textarea name="product_description" required={inputMode === 'manual'} value={formData.product_description} onChange={handleChange} placeholder="Tulis detail USP produk Anda..." className="form-textarea" />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Upload Foto Produk (Opsional)</label>
                          <div className="upload-area" style={{ padding: '20px' }}>
                            <input type="file" name="product_media" accept="image/*" onChange={handleChange} style={{ color: 'var(--text-secondary)' }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* BAGIAN 1.5: BRAND PERSONALIZATION */}
                  {brandProfiles.length > 0 && (
                    <div style={{ marginBottom: '32px' }}>
                      <div className="card-title">✨ Brand Personalization</div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
                        Pilih profil brand Anda untuk auto-adaptasi gaya visual, narasi, dan prompt.
                      </p>
                      <div className="form-group">
                        <label className="form-label">Brand Profile</label>
                        <select className="form-select" value={selectedBrandId} onChange={e => setSelectedBrandId(e.target.value)}>
                          <option value="">-- Tanpa Brand (Generik) --</option>
                          {brandProfiles.map(bp => (
                            <option key={bp.id} value={bp.id}>
                              🧬 {bp.brand_name} ({bp.tone_of_voice})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* BAGIAN 2: CONFIGURATION & CREATIVE SETTINGS */}
                  <div style={{ marginBottom: '32px' }}>
                    <div className="card-title">2. Creative Settings</div>
                    <hr style={{ border: 'none', borderTop: '1px solid var(--border)', marginBottom: '20px' }} />
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div className="form-group">
                        <label className="form-label">Narrative Mode</label>
                        <select name="narrative_mode" value={formData.narrative_mode} onChange={handleChange} className="form-select">
                          <option value="Storytelling">Storytelling</option>
                          <option value="Hard Sell">Hard Sell</option>
                          <option value="ASMR Review">ASMR Review</option>
                          <option value="Edu-Marketing">Edu-Marketing</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Visual Style</label>
                        <select name="visual_style" value={formData.visual_style} onChange={handleChange} className="form-select">
                          <option value="UGC">UGC</option>
                          <option value="Cinematic">Cinematic</option>
                          <option value="Symmetrical">Symmetrical</option>
                          <option value="Fast/Viral">Fast/Viral</option>
                          <option value="Investigative Documentary">Investigative Documentary</option>
                          <option value="Macrophotography">Macrophotography</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Face Visibility</label>
                        <select name="face_visibility" value={formData.face_visibility} onChange={handleChange} className="form-select">
                          <option value="Faceless">Faceless</option>
                          <option value="POV">POV</option>
                          <option value="Silhouette">Silhouette</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Target AI Engine</label>
                        <select name="target_ai_engine" value={formData.target_ai_engine} onChange={handleChange} className="form-select">
                          <option value="Google Veo (8s)">Google Veo (8s)</option>
                          <option value="Kling AI (5s)">Kling AI (5s)</option>
                          <option value="Runway Gen-3 (10s)">Runway Gen-3 (10s)</option>
                          <option value="Sora (Max 60s)">Sora (Max 60s)</option>
                          <option value="Minimax">Minimax</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Aspect Ratio</label>
                        <select name="aspect_ratio" value={formData.aspect_ratio} onChange={handleChange} className="form-select">
                          <option value="9:16">9:16 Vertical Short</option>
                          <option value="16:9">16:9 Horizontal</option>
                          <option value="1:1">1:1 Square</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Voice Persona</label>
                        <select name="voice_persona" value={formData.voice_persona} onChange={handleChange} className="form-select">
                          {VOICE_PERSONAS.map(vp => (
                            <option key={vp.id} value={vp.id}>
                              {vp.alias} ({vp.id}) - {vp.gender} | {vp.description}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Total Klip</label>
                        <input type="number" name="total_clips" value={formData.total_clips} onChange={handleChange} min="2" max="12" className="form-input" />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Words per Clip</label>
                        <input type="number" name="words_per_clip" value={formData.words_per_clip} onChange={handleChange} min="5" max="30" className="form-input" />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Speed Control (Words/sec)</label>
                        <input type="number" step="0.1" name="speed_control" value={formData.speed_control} onChange={handleChange} min="1.0" max="4.0" className="form-input" />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Audit Kepatuhan TikTok Safe</label>
                        <select
                          className="form-select"
                          value={enableVoAudit}
                          onChange={e => setEnableVoAudit(Number(e.target.value))}
                        >
                          <option value={1}>✅ Yes (Audit Compliance & Render 2 Versi VO)</option>
                          <option value={0}>❌ No (Tanpa Audit Compliance)</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Custom Instructions / Guardrails</label>
                        <textarea name="custom_instruction" value={formData.custom_instruction} onChange={handleChange} placeholder="Catatan tambahan untuk mengontrol AI..." className="form-textarea" />
                      </div>
                    </div>
                  </div>

                   <div style={{ textAlign: 'center', marginTop: '32px', display: 'flex', justifyContent: 'center', gap: '16px' }}>
                    <button type="submit" disabled={isProcessing} className="btn btn-primary" onClick={() => setSubmitStatus('running')}>
                      {isProcessing ? 'Manufacturing...' : '🚀 Generate Production Blueprint'}
                    </button>
                    <button type="submit" disabled={isProcessing} className="btn" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.25)' }} onClick={() => setSubmitStatus('draft')}>
                      {isProcessing ? 'Saving...' : '💾 Save as Draft'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleMassSubmit} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '20px 24px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 600, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: 'var(--accent)' }}>✦</span> Konfigurasi Baru Instant Factory Mass Production
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>MAKNA IFC Mass Sandwich Protocol</div>
                  </div>

                  {/* ACCORDION SECTION 0: Basic Creative Strategy */}
                  <div style={{ borderBottom: '1px solid var(--border)' }}>
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
                            className="form-select"
                            value={accountName}
                            onChange={e => {
                              const newAcc = e.target.value;
                              setAccountName(newAcc);
                              const now = new Date();
                              const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
                              setCampaignName(`[ IFC ${dateStr} ] - ${newAcc ? newAcc + ' - ' : ''}`);
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

                        <div style={{ display: 'flex', gap: 16 }}>
                          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label className="form-label">Nama Kampanye *</label>
                            <input
                              className="form-input"
                              placeholder="Contoh: IFC Mass Skincare Juni"
                              value={campaignName}
                              onChange={e => setCampaignName(e.target.value)}
                              required
                            />
                          </div>
                          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label className="form-label">Bahasa Naskah Voiceover *</label>
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

                        {/* File upload area */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Upload Matriks Konten (.csv / .xlsx) *</span>
                            <button 
                              type="button" 
                              onClick={downloadTemplate}
                              className="btn btn-sm btn-secondary" 
                              style={{ 
                                padding: '6px 12px', 
                                fontSize: '0.8rem'
                              }}
                            >
                              📥 Download Template .csv
                            </button>
                          </div>
                          
                          <div 
                            style={{
                              border: '2px dashed var(--border)',
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
                            onClick={() => document.getElementById('ifcMassFileUploader').click()}
                          >
                            <span style={{ fontSize: '2rem' }}>📂</span>
                            <div style={{ marginTop: 8, fontWeight: 500 }}>Seret & Lepas file .csv atau .xlsx Anda di sini</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>atau klik untuk menelusuri dari komputer Anda</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: 12, padding: '6px 14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 8, maxWidth: 650, display: 'inline-block', lineHeight: 1.4, textAlign: 'left', border: '1px solid rgba(255,255,255,0.05)' }}>
                               💡 <b>Petunjuk IFC Massal:</b> Setiap baris wajib memiliki <b>Tautan Gambar Produk</b> (berupa link gambar langsung untuk auto-download) <u>ATAU</u> diisi <b>secara manual lengkap</b> (Nama Produk, Deskripsi, dan Foto Produk di bawah ini jika mode Hybrid Lock).
                             </div>
                            <input 
                              id="ifcMassFileUploader" 
                              type="file" 
                              accept=".csv,.xlsx" 
                              onChange={handleFileUpload} 
                              style={{ display: 'none' }} 
                            />
                          </div>

                          {parsedRows.length > 0 && (
                            <div style={{ marginTop: 16 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--success)' }}>✓ Terdeteksi {parsedRows.length} baris produk</span>
                                <button type="button" onClick={() => { setParsedRows([]); setManualImages({}); }} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', fontSize: '0.8rem', cursor: 'pointer' }}>Hapus Semua</button>
                              </div>
                              
                              <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                                <table className="ideas-table" style={{ width: '100%', fontSize: '0.8rem', margin: 0 }}>
                                  <thead>
                                    <tr style={{ background: 'var(--bg-glass)', borderBottom: '1px solid var(--border)' }}>
                                      <th style={{ padding: 8 }}>No</th>
                                      <th style={{ padding: 8 }}>Nama Produk</th>
                                      <th style={{ padding: 8 }}>Deskripsi / USP</th>
                                      <th style={{ padding: 8 }}>Hook</th>
                                      <th style={{ padding: 8 }}>Ide Visual</th>
                                      {isBridgingActive && visualMode === 'hybrid_lock' && <th style={{ padding: 8 }}>Foto Produk</th>}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {parsedRows.map((row, idx) => {
                                      const hasUrl = row.product_image_url && (row.product_image_url.startsWith('http://') || row.product_image_url.startsWith('https://'));
                                      const hasManual = row.product_name && row.product_name.trim() !== '';
                                      const manualImg = manualImages[idx];
                                      return (
                                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                          <td style={{ padding: 8, textAlign: 'center' }}>{row.row_number}</td>
                                          <td style={{ padding: 8 }}>{row.product_name}</td>
                                          <td style={{ padding: 8 }}>{row.product_desc}</td>
                                          <td style={{ padding: 8 }}>{row.custom_hook}</td>
                                          <td style={{ padding: 8 }}>{row.visual_action_guideline}</td>
                                          {isBridgingActive && visualMode === 'hybrid_lock' && (
                                            <td style={{ padding: 8 }}>
                                              {hasUrl ? (
                                                <span style={{ color: 'var(--text-secondary)' }}>Auto JIT Sourcing</span>
                                              ) : hasManual ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                  {manualImg ? (
                                                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ {manualImg.filename}</span>
                                                  ) : (
                                                    <input 
                                                      type="file" 
                                                      accept="image/*" 
                                                      disabled={uploadingImages[idx]}
                                                      onChange={e => handleRowImageChange(idx, e.target.files[0])} 
                                                      style={{ width: 130, fontSize: '0.75rem' }}
                                                    />
                                                  )}
                                                  {uploadingImages[idx] && <small style={{ color: 'var(--text-secondary)' }}>Uploading...</small>}
                                                </div>
                                              ) : (
                                                <span style={{ color: 'var(--text-secondary)' }}>-</span>
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

                        {brandProfiles.length > 0 && (
                          <div className="form-group">
                            <label className="form-label">🧬 Brand Profile (Opsional)</label>
                            <select
                              className="form-select"
                              value={selectedBrandId}
                              onChange={e => setSelectedBrandId(e.target.value)}
                            >
                              <option value="">-- Tanpa Brand (Generik) --</option>
                              {brandProfiles.map(bp => (
                                <option key={bp.id} value={bp.id}>
                                  {bp.brand_name} ({bp.tone_of_voice})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="form-group">
                          <label className="form-label">Custom Instruction / Guardrails (Global)</label>
                          <textarea 
                            value={customInstruction} 
                            onChange={e => setCustomInstruction(e.target.value)} 
                            placeholder="Instruksi tambahan yang berlaku untuk seluruh video..." 
                            className="form-textarea" 
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ACCORDION SECTION 1: Aesthetics & Visual Settings */}
                  <div style={{ borderBottom: '1px solid var(--border)' }}>
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
                          <select className="form-select" value={narrativeMode} onChange={e => setNarrativeMode(e.target.value)}>
                            <option value="Storytelling">Storytelling</option>
                            <option value="Hard Sell">Hard Sell</option>
                            <option value="ASMR Review">ASMR Review</option>
                            <option value="Edu-Marketing">Edu-Marketing</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Visual Style</label>
                          <select className="form-select" value={visualStyle} onChange={e => setVisualStyle(e.target.value)}>
                            <option value="UGC">UGC</option>
                            <option value="Cinematic">Cinematic</option>
                            <option value="Symmetrical">Symmetrical</option>
                            <option value="Fast/Viral">Fast/Viral</option>
                            <option value="Investigative Documentary">Investigative Documentary</option>
                            <option value="Macrophotography">Macrophotography</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Face Visibility</label>
                          <select className="form-select" value={faceVisibility} onChange={e => setFaceVisibility(e.target.value)}>
                            <option value="Faceless">Faceless</option>
                            <option value="POV">POV</option>
                            <option value="Silhouette">Silhouette</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Target AI Engine</label>
                          <select className="form-select" value={targetAiEngine} onChange={e => setTargetAiEngine(e.target.value)}>
                            <option value="Google Veo (8s)">Google Veo (8s)</option>
                            <option value="Kling AI (5s)">Kling AI (5s)</option>
                            <option value="Runway Gen-3 (10s)">Runway Gen-3 (10s)</option>
                            <option value="Sora (Max 60s)">Sora (Max 60s)</option>
                            <option value="Minimax">Minimax</option>
                          </select>
                        </div>
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                          <label className="form-label">Aspect Ratio</label>
                          <select className="form-select" value={aspectRatio} onChange={e => setAspectRatio(e.target.value)}>
                            <option value="9:16">9:16 Vertical Short</option>
                            <option value="16:9">16:9 Horizontal</option>
                            <option value="1:1">1:1 Square</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ACCORDION SECTION 2: Product Bridging Settings */}
                  <div style={{ borderBottom: '1px solid var(--border)' }}>
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
                          <input
                            type="checkbox"
                            checked={isBridgingActive}
                            onChange={e => setIsBridgingActive(e.target.checked)}
                            style={{ width: 18, height: 18, cursor: 'pointer' }}
                          />
                          <strong>🔌 Aktifkan Bridging Promosi Produk (Sandwich Protocol)</strong>
                        </div>

                        {isBridgingActive && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div className="form-group">
                              <label className="form-label">Jumlah Klip Video (N)</label>
                              <input
                                type="number"
                                className="form-input"
                                min="2"
                                max="12"
                                value={totalClips}
                                onChange={e => setTotalClips(Number(e.target.value))}
                                required
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Sisipkan Transisi Promosi pada Klip Ke- (X)</label>
                              <input
                                type="number"
                                className="form-input"
                                min="2"
                                max={totalClips}
                                value={bridgeAtClip}
                                onChange={e => setBridgeAtClip(Number(e.target.value))}
                                required
                              />
                            </div>
                            <div className="form-group" style={{ gridColumn: 'span 2' }}>
                              <label className="form-label">Visual Mode</label>
                              <select className="form-select" value={visualMode} onChange={e => setVisualMode(e.target.value)}>
                                <option value="hybrid_lock">Double-Pass Pixel Lock (Nano Banana Pro T2I + Veo I2V)</option>
                                <option value="pure_t2v">Pure Text-To-Video (T2V Direct)</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ACCORDION SECTION 3: Workflow & Audio Settings */}
                  <div style={{ borderBottom: '1px solid var(--border)' }}>
                    <div 
                      onClick={() => setActiveAccordion(3)} 
                      style={{ padding: '16px 24px', background: activeAccordion === 3 ? 'rgba(59, 130, 246, 0.05)' : 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>4. Workflow & Audio Settings</span>
                      <span>{activeAccordion === 3 ? '▲' : '▼'}</span>
                    </div>
                    {activeAccordion === 3 && (
                      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                          <div className="form-group">
                            <label className="form-label">Voice Persona</label>
                            <select className="form-select" value={voicePersona} onChange={e => setVoicePersona(e.target.value)}>
                              {VOICE_PERSONAS.map(vp => (
                                <option key={vp.id} value={vp.id}>
                                  {vp.alias} ({vp.id}) - {vp.gender}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Speed Control (Words/sec)</label>
                            <input type="number" step="0.1" className="form-input" min="1.0" max="4.0" value={speedControl} onChange={e => setSpeedControl(parseFloat(e.target.value))} />
                          </div>
                          <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label className="form-label">Words per Clip</label>
                            <input type="number" className="form-input" min="5" max="30" value={wordsPerClip} onChange={e => setWordsPerClip(parseInt(e.target.value))} />
                          </div>
                        </div>

                        {/* Pipeline stages checkboxes */}
                        <div style={{ background: 'var(--bg-glass)', padding: 16, borderRadius: 8, border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                            <input type="checkbox" checked={enableTts} onChange={e => setEnableTts(e.target.checked)} />
                            <span>🔊 Enable Audio TTS</span>
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                            <input type="checkbox" checked={enableGlabs} onChange={e => setEnableGlabs(e.target.checked)} />
                            <span>🎬 Enable Video Gen (G-Labs)</span>
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                            <input type="checkbox" checked={enableFfmpeg} onChange={e => setEnableFfmpeg(e.target.checked)} />
                            <span>🎛️ Enable FFmpeg Muxing</span>
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                            <input type="checkbox" checked={enableSocialPost} onChange={e => setEnableSocialPost(e.target.checked)} />
                            <span>🚀 Enable Auto Social Post</span>
                          </label>
                        </div>

                        {enableSocialPost && (
                          <div style={{ background: 'rgba(230,126,34,0.05)', padding: 16, borderRadius: 8, border: '1px dashed var(--warning)', display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                            <strong>Destinasi Publikasi:</strong>
                            <div style={{ display: 'flex', gap: 20 }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                <input type="checkbox" checked={postYoutube} onChange={e => setPostYoutube(e.target.checked)} />
                                <span>YouTube Shorts Draft</span>
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                <input type="checkbox" checked={postTiktok} onChange={e => setPostTiktok(e.target.checked)} />
                                <span>TikTok Draft</span>
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                <input type="checkbox" checked={postFacebook} onChange={e => setPostFacebook(e.target.checked)} />
                                <span>Facebook Reels Draft</span>
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'center', padding: '32px 0 24px', display: 'flex', justifyContent: 'center', gap: '16px' }}>
                    <button type="submit" disabled={isProcessing} className="btn btn-primary" onClick={() => setSubmitStatus('running')}>
                      {isProcessing ? 'Launching...' : `🚀 Launch Mass Production Batch (${parsedRows.length} Videos)`}
                    </button>
                    <button type="submit" disabled={isProcessing} className="btn" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.25)' }} onClick={() => setSubmitStatus('draft')}>
                      {isProcessing ? 'Saving...' : '💾 Save as Draft'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Pipeline History - Scheduler Card + Logger + Accordion */}
          {history.length > 0 && !result && (
            <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card-title"><span className="icon">📜</span> Instant Factory History</div>

              {/* Status Skeduler Card */}
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                padding: 16,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12
              }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>⚙️ Status Skeduler Instant Factory</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>Mengontrol jalannya antrean pembuatan video secara otomatis.</p>
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
              <div style={{ padding: '0', background: '#07070a', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
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

              {/* Expandable Card Campaign List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {history.map(item => {
                  let statusColor = 'var(--text-muted)';
                  let statusBg = 'rgba(255,255,255,0.06)';
                  let statusBorder = 'rgba(255,255,255,0.1)';
                  if (item.status === 'completed') { statusColor = 'var(--success)'; statusBg = 'rgba(46,204,113,0.15)'; statusBorder = 'rgba(46,204,113,0.3)'; }
                  else if (item.status === 'running') { statusColor = '#3b82f6'; statusBg = 'rgba(59,130,246,0.15)'; statusBorder = 'rgba(59,130,246,0.3)'; }
                  else if (item.status === 'draft') { statusColor = '#a0aec0'; statusBg = 'rgba(108,117,125,0.12)'; statusBorder = 'rgba(108,117,125,0.25)'; }

                  return (
                    <div key={item.id} className="card" style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-sm)' }}>
                      {/* Card Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '1.1rem' }}>🏭</span>
                          <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{item.product_name || 'Unknown'}</strong>
                          {item.is_mass_production === 1 && (
                            <span style={{ fontSize: '0.65rem', background: 'var(--accent)', color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>MASS</span>
                          )}
                          <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: 4 }}>
                            {item.product_source_type ? item.product_source_type.toUpperCase() : 'TEXT'}
                          </span>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 8, background: statusBg, color: statusColor, border: `1px solid ${statusBorder}` }}>
                            {item.status.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(item.created_at).toLocaleString('id-ID')}
                        </div>
                      </div>

                      {/* Metadata */}
                      {item.product_url && (
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                          <strong>URL:</strong> <span style={{ color: 'var(--info)', wordBreak: 'break-all' }}>{item.product_url.length > 80 ? item.product_url.slice(0, 80) + '…' : item.product_url}</span>
                        </div>
                      )}

                      {/* Action Buttons — rata KIRI, selalu terlihat */}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-start', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => viewHistoryItem(item.id)} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>🔍 Detail</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleCopy(item.id)} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>📋 Copy</button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteHistoryItem(item.id)} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>🗑 Hapus</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
