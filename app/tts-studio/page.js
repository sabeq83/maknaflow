'use client';

import Sidebar from '../components/Sidebar';
import { useEffect, useState } from 'react';
import './studio.css';

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
  { id: 'English_expressive_narrator', name: 'Expressive Narrator', avatar: '🎙️', desc: 'Expressive Narrator' },
  { id: 'English_radiant_girl', name: 'Radiant Girl', avatar: '👩', desc: 'Radiant Girl' },
  { id: 'English_magnetic_voiced_man', name: 'Magnetic Male', avatar: '👨', desc: 'Magnetic-voiced Male' },
  { id: 'English_compelling_lady1', name: 'Compelling Lady', avatar: '👩', desc: 'Compelling Lady' },
  { id: 'English_Aussie_Bloke', name: 'Aussie Bloke', avatar: '👨', desc: 'Aussie Bloke' },
  { id: 'English_captivating_female1', name: 'Captivating Female', avatar: '👩', desc: 'Captivating Female' },
  { id: 'English_Upbeat_Woman', name: 'Upbeat Woman', avatar: '👩', desc: 'Upbeat Woman' },
  { id: 'English_Trustworth_Man', name: 'Trustworthy Man', avatar: '👨', desc: 'Trustworthy Man' },
  { id: 'English_CalmWoman', name: 'Calm Woman', avatar: '👩', desc: 'Calm Woman' },
  { id: 'English_UpsetGirl', name: 'Upset Girl', avatar: '👧', desc: 'Upset Girl' },
  { id: 'English_Gentle-voiced_man', name: 'Gentle-voiced Man', avatar: '👨', desc: 'Gentle-voiced Man' },
  { id: 'English_Whispering_girl', name: 'Whispering Girl', avatar: '👧', desc: 'Whispering girl' },
  { id: 'English_Diligent_Man', name: 'Diligent Man', avatar: '👨', desc: 'Diligent Man' },
  { id: 'English_Graceful_Lady', name: 'Graceful Lady', avatar: '👩', desc: 'Graceful Lady' },
  { id: 'English_ReservedYoungMan', name: 'Reserved Young Man', avatar: '👨', desc: 'Reserved Young Man' },
  { id: 'English_PlayfulGirl', name: 'Playful Girl', avatar: '👧', desc: 'Playful Girl' },
  { id: 'English_ManWithDeepVoice', name: 'Deep Voice Man', avatar: '👨', desc: 'Man With Deep Voice' },
  { id: 'English_MaturePartner', name: 'Mature Partner', avatar: '👨', desc: 'Mature Partner' },
  { id: 'English_FriendlyPerson', name: 'Friendly Guy', avatar: '👨', desc: 'Friendly Guy' },
  { id: 'English_MatureBoss', name: 'Bossy Lady', avatar: '👩', desc: 'Bossy Lady' },
  { id: 'English_Debator', name: 'Male Debater', avatar: '👨', desc: 'Male Debater' },
  { id: 'English_LovelyGirl', name: 'Lovely Girl', avatar: '👧', desc: 'Lovely Girl' },
  { id: 'English_Steadymentor', name: 'Reliable Man', avatar: '👨', desc: 'Reliable Man' },
  { id: 'English_Deep-VoicedGentleman', name: 'Deep Gentleman', avatar: '👨', desc: 'Deep-voiced Gentleman' },
  { id: 'English_Wiselady', name: 'Wise Lady', avatar: '👩', desc: 'Wise Lady' },
  { id: 'English_CaptivatingStoryteller', name: 'Captivating Storyteller', avatar: '📖', desc: 'Captivating Storyteller' },
  { id: 'English_DecentYoungMan', name: 'Decent Young Man', avatar: '👨', desc: 'Decent Young Man' },
  { id: 'English_SentimentalLady', name: 'Sentimental Lady', avatar: '👩', desc: 'Sentimental Lady' },
  { id: 'English_ImposingManner', name: 'Imposing Queen', avatar: '👑', desc: 'Imposing Queen' },
  { id: 'English_SadTeen', name: 'Teen Boy', avatar: '👦', desc: 'Teen Boy' },
  { id: 'English_PassionateWarrior', name: 'Passionate Warrior', avatar: '⚔️', desc: 'Passionate Warrior' },
  { id: 'English_WiseScholar', name: 'Wise Scholar', avatar: '🎓', desc: 'Wise Scholar' },
  { id: 'English_Soft-spokenGirl', name: 'Soft-Spoken Girl', avatar: '👧', desc: 'Soft-Spoken Girl' },
  { id: 'English_SereneWoman', name: 'Serene Woman', avatar: '👩', desc: 'Serene Woman' },
  { id: 'English_ConfidentWoman', name: 'Confident Woman', avatar: '👩', desc: 'Confident Woman' },
  { id: 'English_PatientMan', name: 'Patient Man', avatar: '👨', desc: 'Patient Man' },
  { id: 'English_Comedian', name: 'Comedian', avatar: '🤡', desc: 'Comedian' },
  { id: 'English_BossyLeader', name: 'Bossy Leader', avatar: '👨', desc: 'Bossy Leader' },
  { id: 'English_Strong-WilledBoy', name: 'Strong-Willed Boy', avatar: '👦', desc: 'Strong-Willed Boy' },
  { id: 'English_StressedLady', name: 'Stressed Lady', avatar: '👩', desc: 'Stressed Lady' },
  { id: 'English_AssertiveQueen', name: 'Assertive Queen', avatar: '👑', desc: 'Assertive Queen' },
  { id: 'English_AnimeCharacter', name: 'Female Narrator', avatar: '👩', desc: 'Female Narrator' },
  { id: 'English_Jovialman', name: 'Jovial Man', avatar: '👨', desc: 'Jovial Man' },
  { id: 'English_WhimsicalGirl', name: 'Whimsical Girl', avatar: '👧', desc: 'Whimsical Girl' },
  { id: 'English_Kind-heartedGirl', name: 'Kind-Hearted Girl', avatar: '👧', desc: 'Kind-Hearted Girl' }
];

export default function TTSStudioPage() {
  const [sourceType, setSourceType] = useState('manual');
  const [manualText, setManualText] = useState('');
  
  const [campaignData, setCampaignData] = useState({ autopilot: [], instant: [] });
  const [selectedAutopilotCamp, setSelectedAutopilotCamp] = useState('');
  const [selectedAutopilotItem, setSelectedAutopilotItem] = useState('');
  const [selectedInstantCamp, setSelectedInstantCamp] = useState('');
  
  const [apiProvider, setApiProvider] = useState('minimax');
  const [targetLanguage, setTargetLanguage] = useState('id-ID');
  const [voicePersona, setVoicePersona] = useState('Indonesian_casual_reporter_vv2');
  const [ttsModelQuality, setTtsModelQuality] = useState('speech-2.8-turbo');
  const [speed, setSpeed] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [gemini8sControl, setGemini8sControl] = useState(true);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentBatchId, setCurrentBatchId] = useState('');
  const [generatedClips, setGeneratedClips] = useState([]);
  
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchCampaignData();
  }, []);

  useEffect(() => {
    if (apiProvider === 'gemini') {
      setVoicePersona('Kore');
    } else {
      if (targetLanguage === 'en-US') {
        setVoicePersona('English_expressive_narrator');
      } else {
        setVoicePersona('Indonesian_casual_reporter_vv2');
      }
    }
  }, [apiProvider, targetLanguage]);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function fetchCampaignData() {
    setLoadingCampaigns(true);
    try {
      const res = await fetch('/api/tts-studio/campaign-data');
      const data = await res.json();
      if (data.success) {
        setCampaignData(data.data);
      } else {
        showToast('Gagal memuat data kampanye', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Koneksi bermasalah', 'error');
    } finally {
      setLoadingCampaigns(false);
    }
  }

  // Helper to get active clips to render/preview
  function getActiveClips() {
    if (sourceType === 'manual') {
      return manualText.split('\n\n').map(t => t.trim()).filter(Boolean);
    }
    if (sourceType === 'autopilot') {
      const camp = campaignData.autopilot.find(c => c.campaign_id === selectedAutopilotCamp);
      const item = camp?.items.find(i => i.item_id === Number(selectedAutopilotItem));
      return item ? item.clips : [];
    }
    if (sourceType === 'instant') {
      const camp = campaignData.instant.find(c => c.campaign_id === selectedInstantCamp);
      return camp ? camp.clips : [];
    }
    return [];
  }

  // Get display text for ref source
  function getSourceRefId() {
    if (sourceType === 'autopilot') return selectedAutopilotItem;
    if (sourceType === 'instant') return selectedInstantCamp;
    return null;
  }

  async function handleSynthesisSubmit(e) {
    e.preventDefault();
    const clips = getActiveClips();
    if (clips.length === 0) {
      showToast('Naskah kosong! Silakan tulis naskah atau pilih kampanye.', 'error');
      return;
    }

    setIsGenerating(true);
    setCurrentBatchId('');
    
    // Set temporary pending UI deck
    setGeneratedClips(
      clips.map((text, idx) => ({
        clip_index: idx,
        source_text: text,
        audio_path: '',
        status: 'pending'
      }))
    );

    try {
      const res = await fetch('/api/tts-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: sourceType,
          source_ref_id: getSourceRefId(),
          provider_active: apiProvider,
          voice_persona: voicePersona,
          speed,
          volume,
          clips,
          gemini_8s: gemini8sControl,
          tts_model_quality: ttsModelQuality
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast('Sintesis batch suara selesai!');
        setCurrentBatchId(data.batchId);
        setGeneratedClips(data.clips);
      } else {
        showToast(data.error || 'Gagal merender audio batch.', 'error');
        setGeneratedClips([]);
      }
    } catch (err) {
      console.error(err);
      showToast('Gagal merender audio batch.', 'error');
      setGeneratedClips([]);
    } finally {
      setIsGenerating(false);
    }
  }

  // Single clip regeneration
  async function handleRegenerateClip(idx) {
    const targetClip = generatedClips[idx];
    if (!targetClip || !currentBatchId) return;

    // Set UI index status to processing
    const updatedClips = [...generatedClips];
    updatedClips[idx] = { ...targetClip, status: 'processing' };
    setGeneratedClips(updatedClips);

    try {
      const res = await fetch('/api/tts-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: currentBatchId,
          regenerate_clip_index: idx,
          provider_active: apiProvider,
          voice_persona: voicePersona,
          speed,
          volume,
          clips: [targetClip.source_text],
          gemini_8s: gemini8sControl,
          tts_model_quality: ttsModelQuality
        })
      });

      const data = await res.json();
      if (data.success && data.clip) {
        showToast(`Klip ${idx + 1} berhasil dirender ulang!`);
        const finalClips = [...generatedClips];
        finalClips[idx] = data.clip;
        setGeneratedClips(finalClips);
      } else {
        showToast(data.error || 'Gagal merender ulang klip.', 'error');
        const finalClips = [...generatedClips];
        finalClips[idx] = { ...targetClip, status: 'failed' };
        setGeneratedClips(finalClips);
      }
    } catch (err) {
      console.error(err);
      showToast('Gagal merender ulang klip.', 'error');
      const finalClips = [...generatedClips];
      finalClips[idx] = { ...targetClip, status: 'failed' };
      setGeneratedClips(finalClips);
    }
  }

  const activeClipsPreview = getActiveClips();
  const currentVoices = apiProvider === 'gemini' 
    ? GEMINI_VOICES 
    : (targetLanguage === 'en-US' ? MINIMAX_ENGLISH_VOICES : MINIMAX_VOICES);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="tts-studio-container">
          
          {/* PANEL KIRI: SELECTOR SUMBER DAN KONFIGURASI */}
          <div className="tts-control-panel">
            <h2>🎙️ TTS Standalone Studio</h2>
            
            <form onSubmit={handleSynthesisSubmit}>
              
              {/* 1. Pemilihan Sumber Teks */}
              <div className="tts-section">
                <h3>1. Sumber Naskah Voiceover</h3>
                
                <div className="source-tabs">
                  <button
                    type="button"
                    className={`tab-btn ${sourceType === 'manual' ? 'active' : ''}`}
                    onClick={() => setSourceType('manual')}
                  >
                    Input Tulis Manual
                  </button>
                  <button
                    type="button"
                    className={`tab-btn ${sourceType === 'autopilot' ? 'active' : ''}`}
                    onClick={() => setSourceType('autopilot')}
                  >
                    Ambil dari Autopilot
                  </button>
                  <button
                    type="button"
                    className={`tab-btn ${sourceType === 'instant' ? 'active' : ''}`}
                    onClick={() => setSourceType('instant')}
                  >
                    Instant Factory
                  </button>
                </div>

                {sourceType === 'manual' && (
                  <div className="source-content" id="source-manual-input">
                    <label>Ketik Naskah (Pisahkan paragraf per klip menggunakan baris kosong double):</label>
                    <textarea
                      placeholder="Paragraf klip ke-1...&#10;&#10;Paragraf klip ke-2..."
                      value={manualText}
                      onChange={e => setManualText(e.target.value)}
                    ></textarea>
                  </div>
                )}

                {sourceType === 'autopilot' && (
                  <div className="source-content" id="source-db-select">
                    <label>Pilih Kampanye Autopilot:</label>
                    <select
                      id="db-campaign-dropdown"
                      value={selectedAutopilotCamp}
                      onChange={e => {
                        setSelectedAutopilotCamp(e.target.value);
                        setSelectedAutopilotItem('');
                      }}
                    >
                      <option value="">-- Pilih Kampanye --</option>
                      {campaignData.autopilot.map(camp => (
                        <option key={camp.campaign_id} value={camp.campaign_id}>
                          {camp.campaign_name}
                        </option>
                      ))}
                    </select>

                    {selectedAutopilotCamp && (
                      <>
                        <label>Pilih Item Draft Video:</label>
                        <select
                          id="db-item-dropdown"
                          value={selectedAutopilotItem}
                          onChange={e => setSelectedAutopilotItem(e.target.value)}
                        >
                          <option value="">-- Pilih Draft Item --</option>
                          {campaignData.autopilot
                            .find(c => c.campaign_id === selectedAutopilotCamp)
                            ?.items.map(item => (
                              <option key={item.item_id} value={item.item_id}>
                                ID: {item.item_id} - {item.source_url.split('/').pop() || 'Video Link'}
                              </option>
                            ))}
                        </select>
                      </>
                    )}

                    {activeClipsPreview.length > 0 && (
                      <div className="clips-preview-box">
                        {activeClipsPreview.map((clipText, idx) => (
                          <div key={idx} className="clip-preview-item">
                            <strong>Klip {idx + 1}:</strong> {clipText}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {sourceType === 'instant' && (
                  <div className="source-content">
                    <label>Pilih Kampanye Instan:</label>
                    <select
                      value={selectedInstantCamp}
                      onChange={e => setSelectedInstantCamp(e.target.value)}
                    >
                      <option value="">-- Pilih Kampanye Instan --</option>
                      {campaignData.instant.map(camp => (
                        <option key={camp.campaign_id} value={camp.campaign_id}>
                          {camp.product_name} ({camp.campaign_id})
                        </option>
                      ))}
                    </select>

                    {activeClipsPreview.length > 0 && (
                      <div className="clips-preview-box">
                        {activeClipsPreview.map((clipText, idx) => (
                          <div key={idx} className="clip-preview-item">
                            <strong>Klip {idx + 1}:</strong> {clipText}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Pemilihan API Provider & Persona */}
              <div className="tts-section">
                <h3>2. Mesin TTS & Karakter Suara</h3>
                
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Pilih Penyedia API:
                </label>
                <select
                  id="api-provider-select"
                  value={apiProvider}
                  onChange={e => setApiProvider(e.target.value)}
                >
                  <option value="minimax">MiniMax AI (Premium MP3)</option>
                  <option value="gemini">Gemini TTS Engine (WAV)</option>
                </select>

                {apiProvider === 'minimax' && (
                  <div style={{ marginTop: '12px' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      Kualitas Model (MiniMax):
                    </label>
                    <select
                      id="tts-model-quality-select"
                      value={ttsModelQuality}
                      onChange={e => setTtsModelQuality(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '0.88rem' }}
                    >
                      <option value="speech-2.8-turbo">Turbo (speech-2.8-turbo)</option>
                      <option value="speech-2.8-hd">HD (speech-2.8-hd) - Mendukung Micro-Acting</option>
                    </select>

                    {ttsModelQuality === 'speech-2.8-hd' && (
                      <div className="info-box-acting" style={{ marginTop: '10px', fontSize: '0.75rem', color: '#0984e3', background: 'rgba(9, 132, 227, 0.08)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(9, 132, 227, 0.2)', lineHeight: 1.4 }}>
                        💡 <b>HD Model Actings Active:</b> Anda bisa menyisipkan tag emosi/jeda dalam naskah: <code>(breath)</code>, <code>(sighs)</code>, <code>(laughs)</code>, <code>(chuckle)</code>, <code>(emm)</code>, <code>(lip-smacking)</code>, atau jeda <code>&lt;#1.5#&gt;</code> (detik).
                      </div>
                    )}

                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '12px', marginBottom: '8px' }}>
                      Target Bahasa (MiniMax):
                    </label>
                    <select
                      value={targetLanguage}
                      onChange={e => {
                        const lang = e.target.value;
                        setTargetLanguage(lang);
                        if (lang === 'en-US') {
                          setVoicePersona('English_expressive_narrator');
                        } else {
                          setVoicePersona('Indonesian_casual_reporter_vv2');
                        }
                      }}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '0.88rem' }}
                    >
                      <option value="id-ID">Bahasa Indonesia (id-ID)</option>
                      <option value="en-US">English (en-US)</option>
                    </select>
                  </div>
                )}

                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Pilih Persona Suara:
                </label>
                <div className="voice-persona-grid" id="persona-selector-container">
                  {currentVoices.map(voice => (
                    <div
                      key={voice.id}
                      className={`persona-card ${voicePersona === voice.id ? 'active' : ''}`}
                      onClick={() => setVoicePersona(voice.id)}
                      title={voice.desc}
                    >
                      <div className="persona-avatar">{voice.avatar}</div>
                      <strong>{voice.name}</strong>
                      <span className="persona-id">{voice.id.replace('Indonesian_', '').replace('English_', '')}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Konfigurasi Kontrol Audio-Physics */}
              <div className="tts-section">
                <h3>3. Penyelarasan Dinamika Suara</h3>
                
                <div className="range-control">
                  <label>Kecepatan Pembacaan (Speed): <span>{speed.toFixed(1)}x</span></label>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={speed}
                    onChange={e => setSpeed(parseFloat(e.target.value))}
                  />
                </div>

                <div className="range-control">
                  <label>Volume: <span>{volume.toFixed(1)}x</span></label>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.1"
                    value={volume}
                    onChange={e => setVolume(parseFloat(e.target.value))}
                  />
                </div>

                {apiProvider === 'gemini' && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      <input
                        type="checkbox"
                        checked={gemini8sControl}
                        onChange={e => setGemini8sControl(e.target.checked)}
                        style={{ width: 16, height: 16, cursor: 'pointer' }}
                      />
                      <span>⏱️ <b>Native 8s Duration Control</b></span>
                    </label>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginLeft: 24 }}>
                      Mengatur pacing secara kognitif agar pas berdurasi 8.0 detik secara alami.
                    </span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="glowing-btn-tts"
                disabled={isGenerating || activeClipsPreview.length === 0}
              >
                {isGenerating ? '⏳ Sedang Sintesis Batch...' : '🎙️ Mulai Sintesis Batch Suara'}
              </button>

            </form>
          </div>

          {/* PANEL KANAN: TRACK DECK PLAYER & ACTIONS */}
          <div className="tts-track-panel">
            <h2>🎵 Audio Deck Controller</h2>
            
            <div className="batch-summary-info">
              <span>Batch ID: <strong style={{ color: 'var(--accent-light)' }}>{currentBatchId || '-'}</strong></span>
              <span>Klip Terdeteksi: <strong style={{ color: 'var(--accent-light)' }}>{generatedClips.length}</strong></span>
            </div>

            <div className="track-list" id="track-list-container">
              {generatedClips.length > 0 ? (
                generatedClips.map((clip, idx) => (
                  <div
                    key={clip.clip_index}
                    className={`track-item ${
                      clip.status === 'completed'
                        ? 'completed'
                        : clip.status === 'processing' || clip.status === 'pending'
                        ? 'processing'
                        : 'failed'
                    }`}
                  >
                    <div className="track-num">Klip {Number(clip.clip_index) + 1}</div>
                    <div className="track-text">"{clip.source_text}"</div>
                    
                    {clip.status === 'completed' && clip.audio_path && (
                      <div className="track-player">
                        <audio key={clip.audio_path} controls src={clip.audio_path}></audio>
                      </div>
                    )}

                    {clip.status === 'processing' && (
                      <div style={{ color: 'var(--warning)', fontSize: '0.78rem' }}>
                        ⏳ Sedang merender audio klip...
                      </div>
                    )}

                    {clip.status === 'failed' && (
                      <div style={{ color: 'var(--danger)', fontSize: '0.78rem' }}>
                        ✗ Gagal merender: {clip.error || 'Unknown error'}
                      </div>
                    )}

                    <div className="track-actions">
                      <button
                        className="action-btn re-gen-btn"
                        onClick={() => handleRegenerateClip(idx)}
                        disabled={isGenerating || clip.status === 'processing'}
                      >
                        🔄 Render Ulang
                      </button>
                      
                      {clip.status === 'completed' && clip.audio_path && (
                        <a
                          className="action-btn download-btn"
                          href={clip.audio_path}
                          download={`tts_clip_${currentBatchId}_${idx + 1}.${apiProvider === 'minimax' ? 'mp3' : 'wav'}`}
                        >
                          📥 Unduh
                        </a>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="deck-empty">
                  <div className="deck-empty-icon">🎧</div>
                  <p>Belum ada audio batch yang dirender.</p>
                  <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>Konfigurasi naskah di panel kiri dan klik "Mulai Sintesis" untuk memulai.</p>
                </div>
              )}
            </div>

          </div>

        </div>
      </main>

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
