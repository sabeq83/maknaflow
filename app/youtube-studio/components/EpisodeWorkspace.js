import { normalizeLocale } from '@/lib/youtube-studio-contract';
import styles from './YouTubeStudioWorkspace.module.css';
import { RegistryCastSelector } from './RegistryCastSelector';
import { useState, useEffect } from 'react';

function DurationHealthCard({ scriptId, episode, onAutoFitSuccess }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFitting, setIsFitting] = useState(false);

  const fetchAnalysis = async () => {
    try {
      const res = await fetch(`/api/v2/youtube-studio/scripts/${scriptId}/duration-analysis`);
      const data = await res.json();
      if (data.success) {
        setAnalysis(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, [scriptId]);

  const handleAutoFit = async () => {
    setIsFitting(true);
    try {
      const res = await fetch(`/api/v2/youtube-studio/scripts/${scriptId}/auto-fit`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success && onAutoFitSuccess) {
        onAutoFitSuccess(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsFitting(false);
    }
  };

  if (loading) return <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading duration analysis...</div>;
  if (!analysis) return null;

  const coveragePct = Math.round(analysis.coverage_ratio * 100);
  const isOk = analysis.status === 'ready';
  const isWarning = analysis.status === 'draft_warning';
  const isDanger = analysis.status === 'revision_required';

  const cardStyle = {
    background: isOk ? 'rgba(16, 185, 129, 0.05)' : isWarning ? 'rgba(245, 158, 11, 0.05)' : 'rgba(239, 68, 68, 0.05)',
    border: `1px solid ${isOk ? 'rgba(16, 185, 129, 0.2)' : isWarning ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px'
  };

  return (
    <div style={cardStyle}>
      <h5 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
        <span>⏱️ Duration &amp; Pacing Health</span>
        <span style={{
          fontSize: '0.75rem',
          padding: '2px 8px',
          borderRadius: '4px',
          background: isOk ? 'var(--status-success)' : isWarning ? 'var(--status-warning)' : 'var(--status-danger)',
          color: 'var(--text-primary)'
        }}>
          {analysis.status.replace('_', ' ').toUpperCase()}
        </span>
      </h5>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        <div>Target Duration: <strong>{analysis.target_timeline_seconds}s</strong></div>
        <div>Predicted Duration: <strong>{analysis.predicted_narration_seconds}s</strong></div>
        <div>Total Words: <strong>{analysis.total_words}</strong> (Ideal: ~{Math.round(analysis.target_timeline_seconds * (1 - analysis.pause_ratio) * analysis.target_wpm / 60)})</div>
        <div>WPM Pacing: <strong>{analysis.target_wpm} WPM</strong> ({episode.narration_profile_key || 'general_id'})</div>
        <div style={{ gridColumn: 'span 2' }}>
          Pacing Coverage: <strong>{coveragePct}%</strong>
          <div style={{ background: 'rgba(255,255,255,0.1)', height: '8px', borderRadius: '4px', marginTop: '6px', overflow: 'hidden' }}>
            <div style={{
              background: isOk ? 'var(--status-success)' : isWarning ? 'var(--status-warning)' : 'var(--status-danger)',
              height: '100%',
              width: `${Math.min(100, coveragePct)}%`
            }} />
          </div>
        </div>
      </div>

      {(isWarning || isDanger) && (
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ margin: 0, fontSize: '0.8rem', color: isWarning ? 'var(--status-warning)' : 'var(--status-danger)' }}>
            {isDanger 
              ? '⚠️ Severe narrative coverage gap! The audio and timeline durations deviate too far. Please use Auto-fit or manually adjust the script before approval.'
              : '⚠️ Moderate coverage discrepancy. Verify the spacing is intentional.'}
          </p>
          <button
            type="button"
            className="btn btn-warning"
            onClick={handleAutoFit}
            disabled={isFitting}
            style={{ fontSize: '0.8rem', padding: '6px 12px', width: 'fit-content' }}
          >
            {isFitting ? 'Fitting Narration Pacing...' : '✨ Auto-fit Narration to Timeline'}
          </button>
        </div>
      )}
    </div>
  );
}

const GEMINI_VOICES = [
  { id: 'Kore', name: 'Kore (Female)', avatar: '👩', desc: 'Standard Female (Skincare/Cosmetic)' },
  { id: 'Fenrir', name: 'Fenrir (Male)', avatar: '🧔', desc: 'Deep/Heavy Male (Otomotif/High-End)' },
  { id: 'Puck', name: 'Puck (Male)', avatar: '👦', desc: 'Ceria, Playful (Makanan/Promo Kilat)' },
  { id: 'Charon', name: 'Charon (Male)', avatar: '👨', desc: 'Formal, News Style (Review Tech/Finansial)' },
  { id: 'Leda', name: 'Leda (Female)', avatar: '👵', desc: 'Hangat, Ramah (Edukasi/Ibu Anak)' },
  { id: 'Zephyr', name: 'Zephyr (Male)', avatar: '🧔', desc: 'Kasual, Santai (Storytelling/Daily Vlog)' },
  { id: 'Orus', name: 'Orus (Male)', avatar: '🧔', desc: 'Tegas, Optimis (Motivasi/Online Course)' },
  { id: 'Aoede', name: 'Aoede (Female)', avatar: '👩‍🎨', desc: 'Artistik, Ekspresif (Fashion/Seni)' },
  { id: 'Callirrhoe', name: 'Callirrhoe (Female)', avatar: '👩‍💼', desc: 'Berenergi, Dinamis (Olahraga/Lifestyle)' },
  { id: 'Autonoe', name: 'Autonoe (Female)', avatar: '👩‍🎓', desc: 'Dewasa, Profesional (Bisnis/Corporate)' },
  { id: 'Enceladus', name: 'Enceladus (Male)', avatar: '👨‍🎤', desc: 'Misterius, Berat (Teaser/Trailer)' }
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
  { id: 'English_expressive_narrator', name: 'Expressive Narrator', avatar: '🎙️', desc: 'Expressive Narrator (Recommended)' },
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
  { id: 'English_WhimsicalGirl', name: 'Whimsical Girl', avatar: '👧', desc: 'Whimsical Girl (Recommended for Kids)' },
  { id: 'English_Kind-heartedGirl', name: 'Kind-Hearted Girl', avatar: '👧', desc: 'Kind-Hearted Girl (Recommended for Kids)' }
];

const getMediaUrl = (pathString) => {
  if (!pathString) return '';
  // Absolute URL — keep as-is (backward-compat for existing external video paths)
  if (pathString.startsWith('http://') || pathString.startsWith('https://')) return pathString;
  // Already a root-relative path
  if (pathString.startsWith('/')) return pathString;
  // Relative path — prepend /
  return `/${pathString}`;
};

function ScenePlanConfig({ episode, profilesList, selectedProfileKey, handleSetGenerationProfile }) {
  const [profileKey, setProfileKey] = useState(selectedProfileKey || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState(null);

  useEffect(() => {
    if (selectedProfileKey) {
      setProfileKey(selectedProfileKey);
    }
  }, [selectedProfileKey]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveNotice(null);
    try {
      await handleSetGenerationProfile(profileKey);
      setSaveNotice({ type: 'success', msg: '✓ Visual generation profile saved. Audio settings inherit from Channel.' });
    } catch (e) {
      setSaveNotice({ type: 'error', msg: 'Failed to save configuration.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h4 style={{ margin: 0 }}>Visual Generation Settings</h4>

      {/* Lip-Sync Capability Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 69, 58, 0.05)', border: '1px solid rgba(255, 69, 58, 0.15)', padding: '10px 14px', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--status-danger)' }}>
        <span style={{ fontSize: '1rem' }}>⚠️</span>
        <span><strong>Wav2Lip Lip-Sync:</strong> Currently disabled on dev-mini node (Requires Central Cluster GPU Node validation).</span>
      </div>
      
      {['Script Approved', 'In Production', 'Rendering', 'Ready to Publish', 'Uploaded'].includes(episode.status) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="profile-select" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Choose Model Generation Profile</label>
            <select 
              id="profile-select" 
              className={styles.select} 
              style={{ maxWidth: '400px', background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text)' }}
              value={profileKey} 
              onChange={(e) => setProfileKey(e.target.value)}
            >
              <option value="">-- Select Profile --</option>
              {profilesList.map(p => (
                <option key={p.key} value={p.key}>{p.label} ({p.provider})</option>
              ))}
            </select>
            {profileKey && (
              <div className={styles.inheritanceHint} style={{ marginTop: '4px', fontSize: '0.8rem' }}>
                ✓ Profile active. Allowed durations per clip: <strong>{profilesList.find(p => p.key === profileKey)?.generatedShotDurations.join(', ')}s</strong>.
              </div>
            )}
          </div>

          <div className={styles.inheritanceHint}>Audio production mode, provider, personas, and Sonic Identity are inherited from Channel Settings.</div>

          {saveNotice && (
            <div style={{ 
              padding: '10px 14px', 
              borderRadius: '6px', 
              fontSize: '0.85rem', 
              background: saveNotice.type === 'success' ? 'var(--status-success-soft)' : 'var(--status-danger-soft)', 
              color: saveNotice.type === 'success' ? 'var(--status-success)' : 'var(--status-danger)',
              border: saveNotice.type === 'success' ? '1px solid var(--status-success-soft)' : '1px solid var(--status-danger-soft)'
            }}>
              {saveNotice.msg}
            </div>
          )}

          <div style={{ display: 'flex', justifycontent: 'flex-end', marginTop: '8px' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isSaving || !profileKey}
              onClick={handleSave}
              style={{ padding: '8px 20px', fontWeight: 600 }}
            >
              {isSaving ? 'Saving...' : '✓ Save Config & Voice Settings'}
            </button>
          </div>

        </div>
      ) : (
        <div className={styles.prereqNotice}>
          Model generation profile and voice settings can be configured once the script is Approved. (Prerequisite: Episode must be in 'Script Approved' status).
        </div>
      )}
    </div>
  );
}

export function EpisodeWorkspace({
  episode,
  stages,
  activeStageKey,
  onStageChange,
  
  // Research props
  research,
  isGeneratingResearch,
  handleGenerateResearch,
  overrideEpDuration,
  setOverrideEpDuration,
  handleOverrideEpisodeDuration,
  
  // Blueprint props
  blueprint,
  isGeneratingBlueprint,
  handleGenerateBlueprint,
  isApprovingBlueprint,
  handleApproveBlueprint,
  
  // Script props
  script,
  isGeneratingScript,
  handleGenerateScript,
  isApprovingScript,
  handleApproveScript,
  refreshEditorialData,
  
  // Profile props
  profilesList,
  selectedProfileKey,
  handleSetGenerationProfile,
  
  // Production props
  activePackage,
  packageAssets,
  isGeneratingPlan,
  handleGenerateProductionPlan,
  isApprovingPlan,
  handleApproveProductionPlan,
  handleRegenerateAsset,
  handleGenerateI2V,
  
  // Review props
  isRenderingFinal,
  handleFinalRender,

  // Assembly props
  handleTriggerAssembly,
  isTriggeringAssembly,
  assemblyJob,

  // Custom play & bulk TTS props
  playingAssetId,
  handleTogglePlayVO,
  handleBulkRegenerateTTS
}) {
  const [activeAccordionSceneIdx, setActiveAccordionSceneIdx] = useState(0);
  const [activeVisualTab, setActiveVisualTab] = useState('start-frames'); // 'start-frames' | 'videos'
  const [videoModal, setVideoModal] = useState(null); // { src, title } | null

  // Stage A Multi-speaker states
  const [storySetup, setStorySetup] = useState(null);
  const [resolvedNarrative, setResolvedNarrative] = useState(null);
  const [loadingStorySetup, setLoadingStorySetup] = useState(true);
  const [isSavingStorySetup, setIsSavingStorySetup] = useState(false);

  const [overrideMode, setOverrideMode] = useState('inherit');
  const [overrideIntensity, setOverrideIntensity] = useState('balanced');
  const [overridePOV, setOverridePOV] = useState('inherit');
  const [overrideUsage, setOverrideUsage] = useState('inherit');
  const [specialDirection, setSpecialDirection] = useState('');
  const [episodeCast, setEpisodeCast] = useState([]);

  useEffect(() => {
    if (!episode?.id) return;
    const loadStorySetup = async () => {
      setLoadingStorySetup(true);
      try {
        const res = await fetch(`/api/v2/youtube-studio/episodes/${episode.id}/story-setup`);
        const data = await res.json();
        if (data.success) {
          setStorySetup(data.story_setup);
          setResolvedNarrative(data.resolved);

          const override = data.story_setup?.narrative_override || {};
          setOverrideMode(override.mode || 'inherit');
          setOverrideIntensity(override.dialogue_intensity || 'balanced');
          setOverridePOV(override.point_of_view || 'inherit');
          setOverrideUsage(override.narrator_usage || 'inherit');
          setSpecialDirection(override.special_direction || '');
          setEpisodeCast(data.story_setup?.episode_cast || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingStorySetup(false);
      }
    };
    loadStorySetup();
  }, [episode?.id]);

  const handleSaveStorySetup = async () => {
    setIsSavingStorySetup(true);
    try {
      const res = await fetch(`/api/v2/youtube-studio/episodes/${episode.id}/story-setup`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          override: {
            mode: overrideMode,
            dialogue_intensity: overrideIntensity,
            point_of_view: overridePOV,
            narrator_usage: overrideUsage,
            special_direction: specialDirection
          },
          cast: episodeCast
        })
      });
      const data = await res.json();
      if (data.success) {
        setStorySetup(data.data.narrative_config_json);
        setResolvedNarrative(data.resolved);
        alert('Story Setup saved successfully!');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingStorySetup(false);
    }
  };

  // Close modal on Escape key
  useEffect(() => {
    if (!videoModal) return;
    const handler = (e) => { if (e.key === 'Escape') setVideoModal(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [videoModal]);

  const activeStage = stages.find(s => s.key === activeStageKey) || stages[0];

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'complete': return styles.badgeComplete;
      case 'active': return styles.badgeActive;
      case 'assembling': return styles.badgeActive; // Use active styling for assembling
      case 'blocked': return styles.badgeBlocked;
      case 'coming_next': return styles.badgeComingNext;
      default: return styles.badgePending;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'complete': return '✓ Done';
      case 'active': return '● Active';
      case 'assembling': return '⚡ Muxing...';
      case 'blocked': return '🔒 Locked';
      case 'coming_next': return '✨ Soon';
      default: return '○ Pending';
    }
  };

  // Helper renderers
  function renderResearchBrief(brief) {
    if (!brief) return null;
    const data = brief.content_json;
    return (
      <div className={styles.editorialDocument}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 className={styles.strategyLabel} style={{ fontSize: '0.8rem' }}>Research Brief (v{brief.version})</h4>
          <span className={styles.reviewStatus} style={{ background: 'var(--status-success-soft)', color: 'var(--status-success)' }}>
            {brief.status}
          </span>
        </div>
        
        {data.episode_angle && (
          <div>
            <h5 className={styles.strategyLabel} style={{ fontSize: '0.65rem', marginTop: '8px' }}>Episode Angle & Narrative Hook</h5>
            <p className={styles.strategyText}>{data.episode_angle}</p>
          </div>
        )}

        {data.audience_intent && (
          <div>
            <h5 className={styles.strategyLabel} style={{ fontSize: '0.65rem', marginTop: '8px' }}>Audience Intent</h5>
            <p className={styles.strategyText}>{data.audience_intent}</p>
          </div>
        )}

        {data.viewer_questions && data.viewer_questions.length > 0 && (
          <div>
            <h5 className={styles.strategyLabel} style={{ fontSize: '0.65rem', marginTop: '8px' }}>Key Viewer Questions</h5>
            <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {data.viewer_questions.map((q, idx) => <li key={idx}>{q}</li>)}
            </ul>
          </div>
        )}

        {data.key_claims && data.key_claims.length > 0 && (
          <div>
            <h5 className={styles.strategyLabel} style={{ fontSize: '0.65rem', marginTop: '8px' }}>Key Factual Claims & Risks</h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              {data.key_claims.map((claimObj, idx) => (
                <div key={idx} style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '10px' }}>
                  <p className={styles.strategyText} style={{ fontWeight: 600 }}>{claimObj.claim}</p>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', fontSize: '0.72rem' }}>
                    <span className={styles.badge} style={{ 
                      background: claimObj.risk === 'high' ? 'var(--status-danger-soft)' : claimObj.risk === 'medium' ? 'var(--status-warning-soft)' : 'var(--status-success-soft)',
                      color: claimObj.risk === 'high' ? 'var(--status-danger)' : claimObj.risk === 'medium' ? 'var(--status-warning)' : 'var(--status-success)'
                    }}>
                      Risk: {claimObj.risk}
                    </span>
                    {claimObj.source_note && <span style={{ color: 'var(--text-muted)' }}>Source: {claimObj.source_note}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderBlueprint(bp) {
    if (!bp) return null;
    const data = bp.content_json;
    return (
      <div className={styles.editorialDocument}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 className={styles.strategyLabel} style={{ fontSize: '0.8rem' }}>Video Blueprint (v{bp.version})</h4>
          <span className={styles.reviewStatus} style={{ 
            background: bp.status === 'approved' ? 'var(--status-success-soft)' : 'var(--status-info-soft)', 
            color: bp.status === 'approved' ? 'var(--status-success)' : 'var(--link)' 
          }}>
            {bp.status}
          </span>
        </div>

        {data.content_promise && (
          <div>
            <h5 className={styles.strategyLabel} style={{ fontSize: '0.65rem', marginTop: '8px' }}>Content Promise (First 5 Seconds)</h5>
            <p className={styles.strategyText} style={{ fontWeight: 600, color: 'var(--link)' }}>"{data.content_promise}"</p>
          </div>
        )}

        {data.hook && (
          <div>
            <h5 className={styles.strategyLabel} style={{ fontSize: '0.65rem', marginTop: '8px' }}>Hook Script ({data.hook.target_duration_seconds}s)</h5>
            <p className={styles.strategyText} style={{ fontStyle: 'italic' }}>{data.hook.text}</p>
          </div>
        )}

        {data.chapters && data.chapters.length > 0 && (
          <div>
            <h5 className={styles.strategyLabel} style={{ fontSize: '0.65rem', marginTop: '8px' }}>Chapters Timing & Narrative Flow</h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              {data.chapters.map((ch, idx) => (
                <div key={idx} style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    <span>{ch.order}. {ch.title}</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{ch.target_duration_seconds}s</span>
                  </div>
                  {ch.narrative_focus && <p className={styles.strategyText} style={{ fontSize: '0.82rem', marginTop: '4px', color: 'var(--text-secondary)' }}>{ch.narrative_focus}</p>}
                  {ch.retention_moment && <p className={styles.strategyText} style={{ fontSize: '0.8rem', marginTop: '4px', color: 'var(--text-muted)' }}><strong>Retention:</strong> {ch.retention_moment}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {data.cta && (
          <div>
            <h5 className={styles.strategyLabel} style={{ fontSize: '0.65rem', marginTop: '8px' }}>Outro CTA Strategy ({data.cta.placement})</h5>
            <p className={styles.strategyText}>{data.cta.text}</p>
          </div>
        )}

        {bp.status === 'draft' && (
          <div style={{ marginTop: '12px' }}>
            <button 
              type="button" 
              className="btn btn-success" 
              onClick={handleApproveBlueprint}
              disabled={isApprovingBlueprint}
            >
              {isApprovingBlueprint ? 'Approving Blueprint...' : '✓ Approve Blueprint Draft'}
            </button>
          </div>
        )}
      </div>
    );
  }

  function renderScript(script) {
    if (!script) return null;
    const data = script.script_json;
    const scenes = data.scenes || [];
    return (
      <div className={styles.editorialDocument}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 className={styles.strategyLabel} style={{ fontSize: '0.8rem' }}>Scene Script (v{script.version})</h4>
          <span className={styles.reviewStatus} style={{ 
            background: script.status === 'approved' ? 'var(--status-success-soft)' : 'var(--status-info-soft)', 
            color: script.status === 'approved' ? 'var(--status-success)' : 'var(--link)' 
          }}>
            {script.status}
          </span>
        </div>

        {data.title && (
          <div style={{ marginBottom: '8px' }}>
            <h5 className={styles.strategyLabel} style={{ fontSize: '0.65rem', marginTop: '8px' }}>Script Title</h5>
            <p className={styles.strategyText} style={{ fontWeight: 600 }}>{data.title}</p>
          </div>
        )}

        <div className={styles.sceneList} style={{ marginTop: '12px' }}>
          {scenes.map((scene, idx) => (
            <div key={idx} className={styles.sceneItem}>
              <div className={styles.sceneHeader}>
                <span>Scene {scene.scene_index} (Chapter {scene.chapter_order || idx + 1})</span>
                <span className={styles.badge} style={{ background: 'var(--surface-interactive)', color: 'var(--link)', border: '1px solid var(--border-subtle)' }}>
                  {scene.scene_type}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{scene.estimated_duration_seconds}s</span>
              </div>
              
              <div>
                <h6 className={styles.strategyLabel} style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Voice-Over / Audio Blocks</h6>
                {scene.audio_blocks && scene.audio_blocks.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                    {scene.audio_blocks.map((ab, abIdx) => (
                      <div key={abIdx} style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', borderLeft: ab.type === 'narration' ? '3px solid var(--link)' : '3px solid var(--status-success)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{ab.speaker_id} ({ab.type})</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{ab.emotion} | {ab.delivery}</span>
                        </div>
                        <p className={styles.strategyText} style={{ fontStyle: 'italic', margin: 0, color: 'var(--text-primary)' }}>"{ab.text}"</p>
                        {ab.pause_after_ms > 0 && (
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '4px' }}>⏸ Pause: {ab.pause_after_ms}ms</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.strategyText} style={{ fontStyle: 'italic', color: 'var(--text-primary)' }}>{scene.voiceover}</p>
                )}
              </div>

              <div>
                <h6 className={styles.strategyLabel} style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Visual Direction</h6>
                <p className={styles.strategyText} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{scene.visual_direction}</p>
              </div>

              {(scene.subtitle_cue || scene.transition_note || scene.audio_cue) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '0.75rem', marginTop: '6px', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-subtle)', paddingTop: '6px' }}>
                  {scene.subtitle_cue && <span><strong>Subtitle:</strong> "{scene.subtitle_cue}"</span>}
                  {scene.transition_note && <span><strong>Transition:</strong> {scene.transition_note}</span>}
                  {scene.audio_cue && <span><strong>Audio:</strong> {scene.audio_cue}</span>}
                </div>
              )}
            </div>
          ))}
        </div>

        {script.status === 'draft' && (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <DurationHealthCard 
              scriptId={script.id} 
              episode={episode} 
              onAutoFitSuccess={async () => {
                if (refreshEditorialData) {
                  await refreshEditorialData();
                }
              }} 
            />
            <button 
              type="button" 
              className="btn btn-success" 
              style={{
                backgroundColor: 'var(--status-success)',
                borderColor: 'var(--status-success)',
                color: '#ffffff',
                fontWeight: '600',
                padding: '10px 20px',
                boxShadow: '0 4px 12px var(--status-success-soft)',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.target.style.filter = 'brightness(0.9)';
              }}
              onMouseLeave={(e) => {
                e.target.style.filter = 'none';
              }}
              onClick={handleApproveScript}
              disabled={isApprovingScript}
            >
              {isApprovingScript ? 'Approving Script...' : '✓ Approve Voice-Over Script Draft'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
    <div className={styles.episodeWorkspace}>
      <div className={styles.workspaceHeader}>
        <h2>{episode.title}</h2>
        <span className={styles.kbStepBadge}>Status: {episode.status}</span>
      </div>

      <div className={styles.workspaceLayoutOneColumn}>
        {/* Stage Rail Navigation on top */}
        <nav className={styles.stageRailHorizontal} aria-label="Episode Stages">
          {stages.map((stg) => {
            const isCurrent = stg.key === activeStageKey;
            const statusClass = getStatusBadgeClass(stg.status);
            return (
              <button
                key={stg.key}
                type="button"
                className={`${styles.railItemHorizontal} ${isCurrent ? styles.railItemHorizontalActive : ''}`}
                disabled={stg.status === 'blocked'}
                onClick={() => onStageChange(stg.key)}
              >
                <div className={styles.railItemHeader}>
                  <span className={styles.railItemLabel} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    {stg.key === 'assemble-review' && stg.status === 'assembling' && (
                      <svg className={styles.spinner} style={{ animation: 'spin 1.5s linear infinite', width: '11px', height: '11px', color: 'var(--accent-light)' }} viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="30 30" />
                      </svg>
                    )}
                    {stg.label}
                  </span>
                  <span className={`${styles.railStatusBadge} ${statusClass}`}>
                    {getStatusLabel(stg.status)}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Active Stage Panel */}
        <main className={styles.stagePanel}>
          <div className={styles.stagePanelHeader}>
            <h3>{activeStage.label}</h3>
          </div>

          <div className={styles.stagePanelContent}>
            {/* 1. Brief & Research */}
            {activeStageKey === 'research' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', fontSize: '0.85rem' }}>
                  <div>
                    Resolved Target Duration: <strong>{episode.target_duration_seconds} seconds</strong> 
                    <span className={styles.inheritanceHint} style={{ marginLeft: '6px', color: 'var(--text-secondary)' }}>
                      (Source: {episode.duration_source})
                    </span>
                  </div>
                  {episode.status === 'Planned' && (
                    <div className={styles.durationControl} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <label htmlFor="ep-duration-override">Override (s):</label>
                      <input 
                        id="ep-duration-override" 
                        className={styles.input} 
                        type="number" 
                        style={{ width: '80px', padding: '4px 8px' }} 
                        value={overrideEpDuration} 
                        onChange={(e) => setOverrideEpDuration(e.target.value)} 
                      />
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                        onClick={handleOverrideEpisodeDuration}
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>

                {/* Story Setup Panel */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '16px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '1.05rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📖 Episode Story Setup &amp; Cast Overrides
                  </h4>
                  {loadingStorySetup ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading story setup...</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ flex: '1 1 150px' }}>
                          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>NARRATIVE MODE</label>
                          <select className={styles.select} value={overrideMode} onChange={e => setOverrideMode(e.target.value)} disabled={episode.status !== 'Planned' && episode.status !== 'Idea'}>
                            <option value="inherit">Inherit ({resolvedNarrative?.resolved_mode || 'narration_only'})</option>
                            <option value="narration_only">Narration Only</option>
                            <option value="dialogue_driven">Dialogue Driven</option>
                            <option value="hybrid_narration_dialogue">Hybrid</option>
                          </select>
                        </div>
                        <div style={{ flex: '1 1 150px' }}>
                          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>DIALOGUE INTENSITY</label>
                          <select className={styles.select} value={overrideIntensity} onChange={e => setOverrideIntensity(e.target.value)} disabled={episode.status !== 'Planned' && episode.status !== 'Idea'}>
                            <option value="light">Light</option>
                            <option value="balanced">Balanced</option>
                            <option value="heavy">Heavy</option>
                          </select>
                        </div>
                        <div style={{ flex: '1 1 150px' }}>
                          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>POINT OF VIEW</label>
                          <select className={styles.select} value={overridePOV} onChange={e => setOverridePOV(e.target.value)} disabled={episode.status !== 'Planned' && episode.status !== 'Idea'}>
                            <option value="inherit">Inherit ({resolvedNarrative?.point_of_view || 'third_person_omniscient'})</option>
                            <option value="first_person">First Person</option>
                            <option value="third_person_limited">Third Person Limited</option>
                            <option value="third_person_omniscient">Third Person Omniscient</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>SPECIAL NARRATIVE INSTRUCTIONS</label>
                        <textarea 
                          className={styles.textarea} 
                          rows={2} 
                          placeholder="e.g. Keep exchanges tense and concise. Narrator must not explain the subtext." 
                          value={specialDirection} 
                          onChange={e => setSpecialDirection(e.target.value)}
                          disabled={episode.status !== 'Planned' && episode.status !== 'Idea'}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>EPISODE CAST &amp; ROLES</label>
                        <RegistryCastSelector scope="episodes" id={episode.id} disabled={episode.status !== 'Planned' && episode.status !== 'Idea'} />
                        {false && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {episodeCast.map((c, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '4px' }}>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>{c.display_name}</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>({c.speaker_id})</span>
                              <span style={{ fontSize: '0.7rem', padding: '1px 4px', background: 'var(--status-neutral)', borderRadius: '3px' }}>{c.story_role}</span>
                              {(episode.status === 'Planned' || episode.status === 'Idea') && (
                                <button 
                                  type="button" 
                                  className={styles.btnMiniDanger} 
                                  style={{ marginLeft: 'auto' }}
                                  onClick={() => {
                                    setEpisodeCast(episodeCast.filter((_, i) => i !== idx));
                                  }}
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          ))}
                          
                          {(episode.status === 'Planned' || episode.status === 'Idea') && (
                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                              <input id="new-ep-cast-name" className={styles.input} type="text" placeholder="Name" style={{ flex: 1, padding: '4px 8px', fontSize: '0.8rem' }} />
                              <input id="new-ep-cast-id" className={styles.input} type="text" placeholder="speaker_id" style={{ flex: 1, padding: '4px 8px', fontSize: '0.8rem' }} />
                              <input id="new-ep-cast-role" className={styles.input} type="text" placeholder="Role (e.g. witness)" style={{ flex: 1, padding: '4px 8px', fontSize: '0.8rem' }} />
                              <button 
                                type="button" 
                                className="btn btn-secondary" 
                                style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                                onClick={() => {
                                  const nameEl = document.getElementById('new-ep-cast-name');
                                  const idEl = document.getElementById('new-ep-cast-id');
                                  const roleEl = document.getElementById('new-ep-cast-role');
                                  if (!nameEl?.value || !idEl?.value) return;
                                  setEpisodeCast([
                                    ...episodeCast,
                                    { speaker_id: idEl.value.trim(), display_name: nameEl.value.trim(), story_role: roleEl.value.trim() || 'supporting', speaker_type: 'character' }
                                  ]);
                                  nameEl.value = '';
                                  idEl.value = '';
                                  roleEl.value = '';
                                }}
                              >
                                Add
                              </button>
                            </div>
                          )}
                        </div>
                        )}
                      </div>

                      {(episode.status === 'Planned' || episode.status === 'Idea') && (
                        <button 
                          type="button" 
                          className="btn btn-success" 
                          style={{ width: 'fit-content', padding: '6px 16px', fontSize: '0.8rem', marginTop: '4px' }}
                          onClick={handleSaveStorySetup}
                          disabled={isSavingStorySetup}
                        >
                          {isSavingStorySetup ? 'Saving...' : 'Save Story Setup'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                  <h4 style={{ margin: 0 }}>AI Research &amp; Background</h4>
                  {!research && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleGenerateResearch}
                      disabled={isGeneratingResearch || episode.status !== 'Planned'}
                    >
                      {isGeneratingResearch ? '⚡ Researching...' : 'Start AI Research'}
                    </button>
                  )}
                </div>

                {research ? (
                  renderResearchBrief(research)
                ) : (
                  <div className={styles.prereqNotice}>
                    Research brief has not been generated yet. Click "Start AI Research" above to begin. (Prerequisite: Episode must be in 'Planned' status).
                  </div>
                )}
              </div>
            )}

            {/* 2. Blueprint */}
            {activeStageKey === 'blueprint' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0 }}>Timing &amp; Narrative Blueprint</h4>
                  {research && !blueprint && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleGenerateBlueprint}
                      disabled={isGeneratingBlueprint}
                    >
                      {isGeneratingBlueprint ? '⚡ Generating Blueprint...' : 'Generate AI Blueprint'}
                    </button>
                  )}
                </div>
                {blueprint ? (
                  renderBlueprint(blueprint)
                ) : (
                  <div className={styles.prereqNotice}>
                    Blueprint draft is not yet generated. (Prerequisite: Research brief must be completed).
                  </div>
                )}
              </div>
            )}

            {/* 3. Script */}
            {activeStageKey === 'script' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0 }}>Voice-Over &amp; Visual Direction Script</h4>
                  {blueprint && blueprint.status === 'approved' && !script && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleGenerateScript}
                      disabled={isGeneratingScript}
                    >
                      {isGeneratingScript ? '⚡ Generating Script...' : 'Generate AI Script'}
                    </button>
                  )}
                </div>
                {script ? (
                  renderScript(script)
                ) : (
                  <div className={styles.prereqNotice}>
                    Voice-over script is not yet generated. (Prerequisite: Blueprint must be Approved).
                  </div>
                )}
              </div>
            )}

            {/* 4. Scene Plan / Profile Selection */}
            {activeStageKey === 'scene-plan' && (
              <ScenePlanConfig
                episode={episode}
                profilesList={profilesList}
                selectedProfileKey={selectedProfileKey}
                handleSetGenerationProfile={handleSetGenerationProfile}
              />
            )}

            {/* 5. Start Frames */}
            {activeStageKey === 'start-frames' && (
              <div className={styles.prereqNotice} style={{ borderStyle: 'dashed' }}>
                <span style={{ fontSize: '2rem' }}>✨</span>
                <h4>Start Frames Stage — Coming Next</h4>
                <p>Hybrid asset approval & start frame reference lock workflows will be integrated in future phases.</p>
              </div>
            )}

            {/* 6. Video Production */}
            {activeStageKey === 'video-production' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0 }}>AI Production Plan</h4>
                  {episode.generation_profile_key && !activePackage && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleGenerateProductionPlan('legacy_t2v')}
                        disabled={isGeneratingPlan}
                      >
                        {isGeneratingPlan ? '⚡ Generating...' : 'Generate Plan (Legacy T2V)'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleGenerateProductionPlan('hybrid')}
                        disabled={isGeneratingPlan}
                      >
                        {isGeneratingPlan ? '⚡ Generating...' : 'Generate Plan (Hybrid T2I/I2V)'}
                      </button>
                    </div>
                  )}
                </div>

                {!episode.generation_profile_key ? (
                  <div className={styles.prereqNotice}>
                    Select a model generation profile first. (Prerequisite: Generation Profile Selection).
                  </div>
                ) : !activePackage ? (
                  <div className={styles.prereqNotice}>
                    No production plan generated yet. Click the button to start.
                  </div>
                ) : (
                  <>
                    <div className={styles.productionPlan} style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--surface-raised)', padding: '16px', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '0.85rem' }}>
                            Package Status: <strong>{activePackage.status.toUpperCase()}</strong> (Mode: <strong>{activePackage.plan_json?.production_mode || 'legacy_t2v'}</strong>)
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            🎙️ TTS Voice: <strong>{episode.voice_provider === 'google_tts' ? 'Google TTS' : 'Minimax API'}</strong> (Persona: <strong>{episode.voice_persona}</strong>)
                          </span>
                          {activePackage.status === 'draft' && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: '2px' }}>
                              💡 Konfigurasi Voice Provider &amp; Persona dapat diubah di tab <strong>Scene Plan</strong> sebelum menyetujui rencana produksi.
                            </span>
                          )}
                        </div>
                        {activePackage.status === 'draft' && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleApproveProductionPlan}
                            disabled={isApprovingPlan}
                          >
                            {isApprovingPlan ? '⚡ Approving...' : 'Approve & Start Production'}
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <h5 style={{ margin: 0, fontSize: '0.9rem' }}>Visual &amp; Voice Assets Blueprint:</h5>
                        {activePackage.plan_json?.scenes?.map((scene, idx) => {
                          const isActive = activeAccordionSceneIdx === idx;
                          return (
                            <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', background: 'rgba(255,255,255,0.01)', marginTop: '8px', transition: 'all 0.2s ease' }}>
                              <div 
                                onClick={() => setActiveAccordionSceneIdx(isActive ? -1 : idx)}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--surface-raised)', cursor: 'pointer', borderLeft: '3px solid var(--accent)', userSelect: 'none' }}
                              >
                                <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>🎬 Scene {idx + 1} ({scene.narrative_duration_seconds}s)</span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{isActive ? '▲' : '▼'}</span>
                              </div>
                              {isActive && (
                                <div style={{ background: 'var(--background)', padding: '16px', borderLeft: '3px solid var(--accent)', borderTop: '1px solid var(--border)' }}>
                                  <div style={{ fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px', background: 'var(--surface-raised)', padding: '10px', borderRadius: '4px' }}>VO: "{scene.voiceover}"</div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {scene.shots?.map((shot, shotIdx) => (
                                      <div key={shotIdx} style={{ fontSize: '0.8rem', background: 'var(--surface-raised)', padding: '8px 10px', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <span>🎬 Shot {shotIdx + 1}: <strong>[{shot.generation_mode || shot.asset_type}]</strong> - <em>"{shot.prompt || 'Visual Clip'}"</em></span>
                                          <span style={{ fontWeight: '600' }}>{shot.generation_duration_seconds}s</span>
                                        </div>
                                        {shot.t2i_prompt && (
                                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--background)', padding: '4px 8px', borderRadius: '4px', marginTop: '2px' }}>
                                            <strong>T2I (Start Frame):</strong> {shot.t2i_prompt}
                                          </div>
                                        )}
                                        {shot.i2v_prompt && (
                                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--background)', padding: '4px 8px', borderRadius: '4px', marginTop: '2px' }}>
                                            <strong>I2V (Animation):</strong> {shot.i2v_prompt}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {activePackage && activePackage.status !== 'draft' && (
                      <div style={{ marginTop: '12px' }}>
                        <h4 style={{ margin: '0 0 12px 0' }}>Asset &amp; VO Generation Progress</h4>
                        <div className={styles.assetProgress} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          
                          {/* Segment 1: Voiceover List */}
                          {packageAssets.filter(a => a.asset_type === 'voiceover').length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <h5 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>🎙️ Voiceover Audio Tracks</h5>
                                <button
                                  type="button"
                                  className={styles.btnPremiumRegen}
                                  onClick={handleBulkRegenerateTTS}
                                  style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                                >
                                  <svg style={{ width: '10px', height: '10px', marginRight: '4px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                                  </svg>
                                  Regenerate All TTS
                                </button>
                              </div>
                              {packageAssets.filter(a => a.asset_type === 'voiceover').map((asset) => (
                                <div key={asset.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-raised)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span>Scene {asset.scene_index + 1} Voiceover</span>
                                      {asset.speaker_id && (
                                        <span style={{ fontSize: '0.72rem', padding: '1px 6px', background: 'var(--surface-interactive)', color: 'var(--link)', borderRadius: '4px', border: '1px solid var(--border-subtle)', fontWeight: 600 }}>
                                          🎙️ {asset.speaker_id}
                                        </span>
                                      )}
                                      {asset.audio_block_id && (
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                          [{asset.audio_block_id}]
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>"{asset.prompt_snapshot?.substring(0, 100)}..."</div>
                                    {asset.error_message && (
                                      <div style={{ fontSize: '0.7rem', color: 'var(--status-danger)', marginTop: '4px' }}>Error: {asset.error_message}</div>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span className={
                                      asset.status === 'succeeded' ? `${styles.premiumBadge} ${styles.premiumBadgeSucceeded}` :
                                      asset.status === 'failed' ? `${styles.premiumBadge} ${styles.premiumBadgeFailed}` :
                                      `${styles.premiumBadge} ${styles.premiumBadgeQueued}`
                                    }>
                                      {(asset.status === 'queued' || asset.status === 'pending') && (
                                        <svg className={styles.spinner} style={{ animation: 'spin 1.5s linear infinite', width: '10px', height: '10px' }} viewBox="0 0 24 24" fill="none">
                                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="30 30" />
                                        </svg>
                                      )}
                                      {asset.status.toUpperCase()}
                                    </span>
                                    
                                    {(asset.status === 'succeeded' || asset.status === 'failed') && (
                                      <button
                                        type="button"
                                        className={styles.btnPremiumRegen}
                                        onClick={() => handleRegenerateAsset(asset.id)}
                                        style={{ padding: '3px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                      >
                                        <svg style={{ width: '9px', height: '9px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                                        </svg>
                                        Regen
                                      </button>
                                    )}

                                    {asset.status === 'succeeded' && asset.output_asset_json?.audio_path && (
                                      <button
                                        type="button"
                                        onClick={() => handleTogglePlayVO(asset)}
                                        style={{
                                          width: '28px',
                                          height: '28px',
                                          borderRadius: '50%',
                                          background: playingAssetId === asset.id ? 'var(--accent)' : 'rgba(255, 255, 255, 0.05)',
                                          border: '1px solid rgba(255, 255, 255, 0.1)',
                                          color: 'var(--text)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          cursor: 'pointer',
                                          fontSize: '0.75rem',
                                          transition: 'all 0.2s',
                                          padding: 0
                                        }}
                                        title={playingAssetId === asset.id ? 'Pause' : 'Play Voiceover'}
                                      >
                                        {playingAssetId === asset.id ? '⏸' : '▶'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Segment 2: Visual Gallery Grid — Tabbed */}
                          {packageAssets.filter(a => a.asset_type !== 'voiceover').length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <h5 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>🎬 Video &amp; Image Assets</h5>

                              {/* Sub-tab selector */}
                              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '0' }}>
                                {[
                                  { key: 'start-frames', label: '🖼️ Start Frames (T2I)' },
                                  { key: 'videos', label: '🎬 Video Clips (I2V / T2V)' }
                                ].map(tab => (
                                  <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setActiveVisualTab(tab.key)}
                                    style={{
                                      padding: '7px 16px',
                                      background: 'none',
                                      border: 'none',
                                      borderBottom: activeVisualTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
                                      color: activeVisualTab === tab.key ? 'var(--text)' : 'var(--text-muted)',
                                      fontWeight: activeVisualTab === tab.key ? 700 : 400,
                                      cursor: 'pointer',
                                      fontSize: '0.78rem',
                                      transition: 'all 0.2s',
                                      marginBottom: '-1px'
                                    }}
                                  >
                                    {tab.label}
                                  </button>
                                ))}
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px', marginTop: '4px' }}>
                                {packageAssets.filter(a => a.asset_type !== 'voiceover').map((asset) => {
                                  const hasImage = !!asset.output_asset_json?.image_path;
                                  const hasVideo = !!asset.output_asset_json?.video_path;
                                  const isT2iI2v = asset.generation_mode === 't2i_i2v';

                                  return (
                                    <div key={asset.id} style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                                      {/* Media Preview */}
                                      <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: 'var(--canvas)', overflow: 'hidden' }}>
                                        {activeVisualTab === 'start-frames' ? (
                                          // 🖼️ START FRAMES TAB
                                          hasImage ? (
                                            <img
                                              src={getMediaUrl(asset.output_asset_json.image_path)}
                                              alt="Start Frame"
                                              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                          ) : asset.status === 'failed' ? (
                                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--status-danger)', background: 'rgba(239,68,68,0.05)' }}>
                                              <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                                              <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>T2I Failed</span>
                                            </div>
                                          ) : (
                                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                              <svg className={styles.spinner} style={{ animation: 'spin 1.5s linear infinite', width: '20px', height: '20px', color: 'var(--link)', marginBottom: '8px' }} viewBox="0 0 24 24" fill="none">
                                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="30 30" />
                                              </svg>
                                              <span style={{ fontSize: '0.7rem' }}>Generating T2I...</span>
                                            </div>
                                          )
                                        ) : (
                                          // 🎬 VIDEO CLIPS TAB
                                          hasVideo ? (
                                            <div
                                              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                                              onClick={() => setVideoModal({
                                                src: getMediaUrl(asset.output_asset_json.video_path),
                                                title: `Scene ${asset.scene_index + 1}, Shot ${asset.shot_index + 1}`
                                              })}
                                            >
                                              <video
                                                src={getMediaUrl(asset.output_asset_json.video_path)}
                                                muted
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                                              />
                                              {/* Play button overlay */}
                                              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)', transition: 'background 0.2s' }}>
                                                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', transition: 'transform 0.2s' }}>
                                                  <svg viewBox="0 0 24 24" fill="var(--canvas)" width="18" height="18">
                                                    <polygon points="7,4 21,12 7,20"/>
                                                  </svg>
                                                </div>
                                              </div>
                                            </div>
                                          ) : hasImage ? (
                                            // Start frame ready but video not yet generated
                                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                                              <img
                                                src={getMediaUrl(asset.output_asset_json.image_path)}
                                                alt="Start Frame Locked"
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.45 }}
                                              />
                                              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>🖼️ Start Frame Ready</span>
                                                <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)' }}>Video not yet generated</span>
                                              </div>
                                            </div>
                                          ) : asset.status === 'failed' ? (
                                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--status-danger)', background: 'rgba(239,68,68,0.05)' }}>
                                              <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                                              <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>I2V Failed</span>
                                            </div>
                                          ) : (
                                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                              <svg className={styles.spinner} style={{ animation: 'spin 1.5s linear infinite', width: '20px', height: '20px', color: 'var(--link)', marginBottom: '8px' }} viewBox="0 0 24 24" fill="none">
                                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="30 30" />
                                              </svg>
                                              <span style={{ fontSize: '0.7rem' }}>Animating I2V...</span>
                                            </div>
                                          )
                                        )}

                                        {/* Status Badge Overlay */}
                                        <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10 }}>
                                          <span className={
                                            asset.status === 'succeeded' ? `${styles.premiumBadge} ${styles.premiumBadgeSucceeded}` :
                                            asset.status === 'failed' ? `${styles.premiumBadge} ${styles.premiumBadgeFailed}` :
                                            `${styles.premiumBadge} ${styles.premiumBadgeQueued}`
                                          }>
                                            {asset.status.toUpperCase()}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Card Footer */}
                                      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                          <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Scene {asset.scene_index + 1}, Shot {asset.shot_index + 1}</div>
                                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={asset.prompt_snapshot}>
                                            {activeVisualTab === 'start-frames'
                                              ? (asset.t2i_prompt || asset.prompt_snapshot)
                                              : (asset.i2v_prompt || asset.prompt_snapshot)}
                                          </div>
                                          {asset.error_message && (
                                            <div style={{ fontSize: '0.68rem', color: 'var(--status-danger)' }}>Error: {asset.error_message}</div>
                                          )}
                                        </div>

                                        {/* Action Buttons */}
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                                          {activeVisualTab === 'start-frames' ? (
                                            // Start Frame: Regen T2I
                                            asset.status !== 'draft' && (
                                              <button
                                                type="button"
                                                className={styles.btnPremiumRegen}
                                                onClick={() => handleRegenerateAsset(asset.id)}
                                                title="Regenerate Start Frame (T2I)"
                                              >
                                                <svg style={{ width: '10px', height: '10px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                                                </svg>
                                                Regen Start Frame
                                              </button>
                                            )
                                          ) : (
                                            // Video Clips: context-aware I2V buttons
                                            <>
                                              {hasImage && !hasVideo && isT2iI2v && (
                                                // Primary: generate video from existing start frame
                                                <button
                                                  type="button"
                                                  onClick={() => handleGenerateI2V(asset.id)}
                                                  style={{
                                                    fontSize: '0.7rem',
                                                    padding: '5px 12px',
                                                    fontWeight: 700,
                                                    background: 'linear-gradient(135deg, var(--accent) 0%, var(--status-neutral) 100%)',
                                                    border: 'none',
                                                    color: 'var(--text-primary)',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    boxShadow: '0 0 10px var(--status-neutral-soft)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                  }}
                                                >
                                                  ⚡ Generate Video (I2V)
                                                </button>
                                              )}
                                              {hasVideo && isT2iI2v && (
                                                // Regen video without touching start frame
                                                <button
                                                  type="button"
                                                  className={styles.btnPremiumRegen}
                                                  onClick={() => handleGenerateI2V(asset.id)}
                                                  title="Re-animate video (keeps start frame image)"
                                                >
                                                  <svg style={{ width: '10px', height: '10px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                                                  </svg>
                                                  Regen Video (I2V)
                                                </button>
                                              )}
                                              {!isT2iI2v && asset.status !== 'draft' && (
                                                // T2V mode: full regenerate
                                                <button
                                                  type="button"
                                                  className={styles.btnPremiumRegen}
                                                  onClick={() => handleRegenerateAsset(asset.id)}
                                                >
                                                  <svg style={{ width: '10px', height: '10px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                                                  </svg>
                                                  Regen Video (T2V)
                                                </button>
                                              )}
                                              {!hasImage && !hasVideo && (
                                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px 0' }}>Waiting for Start Frame...</span>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Assemble & Preview CTA ── */}
            {activeStageKey === 'video-production' && activePackage && ['generating', 'preview_ready', 'completed'].includes(activePackage.status) && (() => {
              const hasVideo = packageAssets.some(
                a => a.asset_type !== 'voiceover' && a.status === 'succeeded' && a.output_asset_json?.video_path
              );
              const hasVO = packageAssets.some(
                a => a.asset_type === 'voiceover' && a.status === 'succeeded'
              );
              const succeededVisual = packageAssets.filter(
                a => a.asset_type !== 'voiceover' && a.status === 'succeeded'
              ).length;
              const failedVisual = packageAssets.filter(
                a => a.asset_type !== 'voiceover' && a.status === 'failed'
              ).length;
              const isProcessing = isTriggeringAssembly || (assemblyJob && ['queued', 'running'].includes(assemblyJob.status));

              return hasVideo && hasVO ? (
                <div style={{
                  marginTop: '20px',
                  padding: '20px 24px',
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.05))',
                  border: '1px solid rgba(99,102,241,0.25)',
                  borderRadius: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '0.95rem', marginBottom: '6px' }}>
                        🎬 Siap untuk Assembly?
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                        <strong style={{ color: 'var(--accent-light)' }}>{succeededVisual} shot</strong> berhasil &nbsp;·&nbsp;
                        {failedVisual > 0 && (
                          <span><strong style={{ color: 'var(--status-danger)' }}>{failedVisual} failed</strong> akan diganti placeholder &nbsp;·&nbsp;</span>
                        )}
                        Video dan audio akan digabungkan menjadi preview timeline.
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ whiteSpace: 'nowrap', minWidth: '180px', padding: '11px 20px', fontWeight: '700' }}
                      onClick={handleTriggerAssembly}
                      disabled={isProcessing}
                    >
                      {isProcessing ? '⚡ Processing...' : '🎞️ Assemble & Preview'}
                    </button>
                  </div>

                  {/* Centered dramatic processing spinner */}
                  {isProcessing && (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '24px 0 8px',
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                      animation: 'fadeIn 0.4s ease'
                    }}>
                      <style>{`
                        @keyframes spin {
                          to { transform: rotate(360deg); }
                        }
                        @keyframes fadeIn {
                          from { opacity: 0; transform: translateY(8px); }
                          to { opacity: 1; transform: translateY(0); }
                        }
                      `}</style>
                      <div style={{
                        width: '58px',
                        height: '58px',
                        borderRadius: '50%',
                        border: '3px solid rgba(34, 211, 238, 0.08)',
                        borderTopColor: 'var(--accent-light)',
                        borderLeftColor: 'var(--accent-light)',
                        animation: 'spin 0.9s cubic-bezier(0.53, 0.21, 0.29, 0.88) infinite',
                        boxShadow: '0 0 15px rgba(34, 211, 238, 0.25)',
                        position: 'relative',
                        marginBottom: '16px'
                      }} />
                      <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>
                        Mengeksekusi Muxing Audio &amp; Video Timeline...
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '440px', lineHeight: '1.45' }}>
                        ffmpeg sedang menggabungkan semua visual clips dengan track voiceover di GPU Node. Proses ini memerlukan waktu sekitar 30-45 detik.
                      </div>
                    </div>
                  )}
                </div>
              ) : null;
            })()}

            {/* 7. Assemble & Review */}
            {activeStageKey === 'assemble-review' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h4 style={{ margin: 0 }}>Timeline Assembly &amp; Review</h4>
                  {activePackage && (
                    <span style={{
                      padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '700',
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                      background: activePackage.status === 'completed'
                        ? 'var(--status-success-soft)' : 'var(--status-info-soft)',
                      color: activePackage.status === 'completed' ? 'var(--status-success)' : 'var(--status-info)',
                      border: `1px solid ${ activePackage.status === 'completed'
                        ? 'var(--status-success-soft)' : 'var(--status-info-soft)' }`
                    }}>
                      {activePackage.status === 'completed' ? '✓ Completed' : 'Preview Ready'}
                    </span>
                  )}
                </div>

                {activePackage && ['preview_ready', 'final_rendering', 'completed'].includes(activePackage.status) ? (
                  <>
                    {/* Stats row */}
                    {(() => {
                      const succeededV = packageAssets.filter(a => a.asset_type !== 'voiceover' && a.status === 'succeeded').length;
                      const failedV = packageAssets.filter(a => a.asset_type !== 'voiceover' && a.status === 'failed').length;
                      const durationSec = activePackage.preview_asset_json?.durationSeconds || 0;
                      const mm = String(Math.floor(durationSec / 60)).padStart(2, '0');
                      const ss = String(Math.floor(durationSec % 60)).padStart(2, '0');
                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                          {[{
                            label: 'Durasi', value: `${mm}:${ss}`, color: 'var(--accent-light)'
                          }, {
                            label: 'Scenes', value: [...new Set(packageAssets.map(a => a.scene_index))].length, color: 'var(--status-neutral)'
                          }, {
                            label: 'Shots Sukses', value: succeededV, color: 'var(--status-success)'
                          }, {
                            label: failedV > 0 ? 'Placeholder' : 'Render', value: failedV > 0 ? failedV : '720p', color: failedV > 0 ? 'var(--status-danger)' : 'var(--status-success)'
                          }].map((s, i) => (
                            <div key={i} style={{
                              background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)',
                              borderRadius: '10px', padding: '12px 14px'
                            }}>
                              <div style={{ fontSize: '0.68rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                                {s.label}
                              </div>
                              <div style={{ fontSize: '1.3rem', fontWeight: '700', fontFamily: 'monospace', color: s.color }}>
                                {s.value}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Preview Video Player */}
                    {activePackage.preview_asset_json && (
                      <div style={{
                        background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)',
                        borderRadius: '14px', overflow: 'hidden',
                        ...(activePackage.status === 'completed' ? { opacity: 0.7 } : {})
                      }}>
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)',
                          background: 'rgba(255,255,255,0.02)'
                        }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--status-info)', display: 'inline-block' }} />
                            Timeline Preview
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              yt_preview_{activePackage.id?.slice(-8)}.mp4
                            </span>
                            <a
                              href={getMediaUrl(activePackage.preview_asset_json.videoAsset)}
                              download={`yt_preview_${activePackage.id?.slice(-8)}.mp4`}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '600',
                                border: '1px solid var(--status-info-soft)', background: 'var(--status-info-soft)',
                                color: 'var(--status-info)', textDecoration: 'none', cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                            >
                              ⬇ Download
                            </a>
                          </div>
                        </div>
                        <video
                          src={getMediaUrl(activePackage.preview_asset_json.videoAsset)}
                          controls
                          width="100%"
                          style={{ display: 'block', background: 'var(--canvas)' }}
                        />
                      </div>
                    )}

                    {/* Final Video Player */}
                    {activePackage.status === 'completed' && activePackage.final_asset_json && (
                      <div style={{
                        background: 'var(--surface-raised)',
                        border: '1px solid rgba(74,222,128,0.25)',
                        borderRadius: '14px', overflow: 'hidden',
                        boxShadow: '0 0 20px rgba(74,222,128,0.07)'
                      }}>
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '10px 16px', borderBottom: '1px solid rgba(74,222,128,0.15)',
                          background: 'rgba(74,222,128,0.05)'
                        }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--status-success)', display: 'inline-block' }} />
                            ✓ Final YouTube Video
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              yt_final_{activePackage.id?.slice(-8)}.mp4
                            </span>
                            <a
                              href={getMediaUrl(activePackage.final_asset_json.videoAsset)}
                              download={`yt_final_${activePackage.id?.slice(-8)}.mp4`}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '600',
                                border: '1px solid rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.1)',
                                color: 'var(--status-success)', textDecoration: 'none', cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                            >
                              ⬇ Download
                            </a>
                          </div>
                        </div>
                        <video
                          src={getMediaUrl(activePackage.final_asset_json.videoAsset)}
                          controls
                          width="100%"
                          style={{ display: 'block', background: 'var(--canvas)' }}
                        />
                      </div>
                    )}

                    {/* Video Final download */}
                    {activePackage.status === 'completed' && activePackage.final_asset_json?.videoAsset && (
                      <div style={{
                        background: 'var(--surface-raised)', border: '1px solid rgba(74,222,128,0.25)',
                        borderRadius: '12px', padding: '12px 16px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
                        boxShadow: '0 0 15px rgba(74,222,128,0.05)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '34px', height: '34px', borderRadius: '8px', flexShrink: 0,
                            background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px'
                          }}>🎬</div>
                          <div>
                            <div style={{ fontSize: '0.84rem', fontWeight: '600', color: 'var(--status-success)' }}>Video Final (MP4)</div>
                            <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                              yt_final_{activePackage.id?.slice(-8)}.mp4
                            </div>
                          </div>
                        </div>
                        <a
                          href={getMediaUrl(activePackage.final_asset_json.videoAsset)}
                          download={`yt_final_${activePackage.id?.slice(-8)}.mp4`}
                          style={{
                            padding: '7px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '600',
                            border: '1px solid rgba(74,222,128,0.35)', background: 'rgba(74,222,128,0.1)',
                            color: 'var(--status-success)', textDecoration: 'none', whiteSpace: 'nowrap',
                            transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: '5px'
                          }}
                        >
                          ⬇ Download Video Final
                        </a>
                      </div>
                    )}

                    {/* Subtitle download */}
                    {activePackage.preview_asset_json?.subtitleAsset && (
                      <div style={{
                        background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)',
                        borderRadius: '12px', padding: '12px 16px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '34px', height: '34px', borderRadius: '8px', flexShrink: 0,
                            background: 'var(--status-info-soft)', border: '1px solid var(--border-subtle)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px'
                          }}>📄</div>
                          <div>
                            <div style={{ fontSize: '0.84rem', fontWeight: '600' }}>Subtitle / Transcript (SRT)</div>
                            <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                              {activePackage.preview_asset_json.subtitleAsset}
                            </div>
                          </div>
                        </div>
                        <a
                          href={getMediaUrl(activePackage.preview_asset_json.subtitleAsset)}
                          download
                          style={{
                            padding: '7px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '600',
                            border: '1px solid var(--status-info-soft)', background: 'var(--status-info-soft)',
                            color: 'var(--status-info)', textDecoration: 'none', whiteSpace: 'nowrap',
                            transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: '5px'
                          }}
                        >
                          ⬇ Download SRT
                        </a>
                      </div>
                    )}

                    {/* Action: Final Render button */}
                    {activePackage.status === 'preview_ready' && (
                      <div style={{
                        padding: '18px 22px',
                        background: 'linear-gradient(135deg, rgba(8,145,178,0.08), rgba(99,102,241,0.06))',
                        border: '1px solid rgba(8,145,178,0.2)',
                        borderRadius: '14px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px'
                      }}>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '0.9rem', marginBottom: '5px' }}>🎬 Lanjut ke Final Render?</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5', maxWidth: '480px' }}>
                            Preview sudah tersedia. Klik <strong>Final Render Video</strong> untuk menghasilkan
                            video final berkualitas penuh yang siap di-upload ke YouTube.
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={handleFinalRender}
                          disabled={isRenderingFinal}
                          style={{ whiteSpace: 'nowrap', minWidth: '170px', padding: '11px 20px', fontWeight: '700' }}
                        >
                          {isRenderingFinal ? '⚡ Rendering...' : '🎞️ Final Render Video'}
                        </button>
                      </div>
                    )}

                    {/* Rendering in progress */}
                    {activePackage.status === 'final_rendering' && (
                      <div className={styles.prereqNotice}>
                        ⚡ Final video render sedang berjalan di server... (Please wait).
                      </div>
                    )}

                    {/* Completed banner */}
                    {activePackage.status === 'completed' && (
                      <div style={{
                        padding: '18px 22px',
                        background: 'linear-gradient(135deg, rgba(74,222,128,0.09), rgba(16,185,129,0.06))',
                        border: '1px solid rgba(74,222,128,0.25)',
                        borderRadius: '14px',
                        display: 'flex', alignItems: 'center', gap: '16px'
                      }}>
                        <div style={{
                          width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                          background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px'
                        }}>🎉</div>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '0.92rem', color: 'var(--status-success)' }}>
                            Video fully compiled — ready to publish!
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                            Video final tersimpan di server. Lanjut ke tahap Publishing untuk upload ke YouTube.
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className={styles.prereqNotice}>
                    Preview belum tersedia. Klik <strong>"🎞️ Assemble &amp; Preview"</strong> di tahap Video Production.
                  </div>
                )}
              </div>
            )}

            {/* 8. Packaging */}
            {activeStageKey === 'packaging' && (
              <div className={styles.prereqNotice} style={{ borderStyle: 'dashed' }}>
                <span style={{ fontSize: '2rem' }}>✨</span>
                <h4>SEO &amp; Thumbnail Packaging — Coming Next</h4>
                <p>Title variations generator, thumbnail compositor, and metadata description compiler will be integrated in future phases.</p>
              </div>
            )}

            {/* 9. Publish */}
            {activeStageKey === 'publish' && (
              <div className={styles.prereqNotice} style={{ borderStyle: 'dashed' }}>
                <span style={{ fontSize: '2rem' }}>✨</span>
                <h4>YouTube Publisher Hub — Coming Next</h4>
                <p>Direct scheduled upload integration with YouTube API channels will be available in future phases.</p>
              </div>
            )}

            {/* Bottom Navigation Buttons */}
            {(() => {
              const currentIdx = stages.findIndex(s => s.key === activeStageKey);
              if (currentIdx === -1) return null;

              let prevStage = null;
              for (let i = currentIdx - 1; i >= 0; i--) {
                if (stages[i].status !== 'blocked') {
                  prevStage = stages[i];
                  break;
                }
              }

              let nextStage = null;
              for (let i = currentIdx + 1; i < stages.length; i++) {
                if (stages[i].status !== 'blocked') {
                  nextStage = stages[i];
                  break;
                }
              }

              return (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '40px',
                  paddingTop: '20px',
                  borderTop: '1px solid var(--border-subtle)',
                  gap: '16px'
                }}>
                  {prevStage ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer'
                      }}
                      onClick={() => onStageChange(prevStage.key)}
                    >
                      ← Back to {prevStage.label}
                    </button>
                  ) : (
                    <div />
                  )}

                  {nextStage && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer'
                      }}
                      onClick={() => onStageChange(nextStage.key)}
                    >
                      Next to {nextStage.label} →
                    </button>
                  )}
                </div>
              );
            })()}

          </div>
        </main>
      </div>
    </div>

    {/* ── Video Lightbox Modal ── */}
    {videoModal && (
      <div
        className={styles.videoModalOverlay}
        onClick={() => setVideoModal(null)}
      >
        <div
          className={styles.videoModalBox}
          onClick={e => e.stopPropagation()}
        >
          <button
            className={styles.videoModalClose}
            onClick={() => setVideoModal(null)}
            aria-label="Close video"
          >
            ✕
          </button>
          {videoModal.title && (
            <div className={styles.videoModalTitle}>{videoModal.title}</div>
          )}
          <div className={styles.videoModalPlayer}>
            <video
              src={videoModal.src}
              controls
              autoPlay
            />
          </div>
        </div>
      </div>
    )}
    </>
  );
}
