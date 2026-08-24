import { normalizeLocale } from '@/lib/youtube-studio-contract';
import styles from './YouTubeStudioWorkspace.module.css';
import { useState, useEffect } from 'react';

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

const getMediaUrl = (pathString) => {
  if (!pathString) return '';
  if (pathString.startsWith('/')) return pathString;
  return `/${pathString}`;
};

function ScenePlanConfig({ episode, profilesList, selectedProfileKey, handleSetGenerationProfile }) {
  const [profileKey, setProfileKey] = useState(selectedProfileKey || '');
  const [voiceProvider, setVoiceProvider] = useState(episode.voice_provider || 'google_tts');
  const [voicePersona, setVoicePersona] = useState(episode.voice_persona || 'Orus');
  const [isSaving, setIsSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState(null);

  useEffect(() => {
    if (selectedProfileKey) {
      setProfileKey(selectedProfileKey);
    }
  }, [selectedProfileKey]);

  useEffect(() => {
    if (episode.voice_provider) {
      setVoiceProvider(episode.voice_provider);
    }
    if (episode.voice_persona) {
      setVoicePersona(episode.voice_persona);
    }
  }, [episode]);

  const activeVoices = voiceProvider === 'minimax' ? MINIMAX_VOICES : GEMINI_VOICES;

  useEffect(() => {
    const isValid = activeVoices.some(v => v.id === voicePersona);
    if (!isValid && activeVoices.length > 0) {
      setVoicePersona(activeVoices[0].id);
    }
  }, [voiceProvider]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveNotice(null);
    try {
      await handleSetGenerationProfile(profileKey, voiceProvider, voicePersona);
      setSaveNotice({ type: 'success', msg: '✓ Configuration and voice settings saved successfully!' });
    } catch (e) {
      setSaveNotice({ type: 'error', msg: 'Failed to save configuration.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h4 style={{ margin: 0 }}>Model Generation &amp; Voice Settings</h4>
      
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

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '200px' }}>
              <label htmlFor="voice-provider-select" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Voice Provider</label>
              <select 
                id="voice-provider-select" 
                className={styles.select} 
                style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text)' }}
                value={voiceProvider} 
                onChange={(e) => setVoiceProvider(e.target.value)}
              >
                <option value="google_tts">Google TTS</option>
                <option value="minimax">Minimax API</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 2, minWidth: '300px' }}>
              <label htmlFor="voice-persona-select" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Voice Persona</label>
              <select 
                id="voice-persona-select" 
                className={styles.select} 
                style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text)' }}
                value={voicePersona} 
                onChange={(e) => setVoicePersona(e.target.value)}
              >
                {activeVoices.map(v => (
                  <option key={v.id} value={v.id}>{v.avatar} {v.name} - {v.desc}</option>
                ))}
              </select>
            </div>
          </div>

          {saveNotice && (
            <div style={{ 
              padding: '10px 14px', 
              borderRadius: '6px', 
              fontSize: '0.85rem', 
              background: saveNotice.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
              color: saveNotice.type === 'success' ? '#34d399' : '#f87171',
              border: saveNotice.type === 'success' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
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
  
  // Review props
  isRenderingFinal,
  handleFinalRender,

  // Custom play & bulk TTS props
  playingAssetId,
  handleTogglePlayVO,
  handleBulkRegenerateTTS
}) {
  const [activeAccordionSceneIdx, setActiveAccordionSceneIdx] = useState(0);

  const activeStage = stages.find(s => s.key === activeStageKey) || stages[0];

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'complete': return styles.badgeComplete;
      case 'active': return styles.badgeActive;
      case 'blocked': return styles.badgeBlocked;
      case 'coming_next': return styles.badgeComingNext;
      default: return styles.badgePending;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'complete': return '✓ Done';
      case 'active': return '● Active';
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
                <h6 className={styles.strategyLabel} style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Voice-Over / Narration</h6>
                <p className={styles.strategyText} style={{ fontStyle: 'italic', color: 'var(--text-primary)' }}>{scene.voiceover}</p>
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
          <div style={{ marginTop: '16px' }}>
            <button 
              type="button" 
              className="btn btn-success" 
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
                  <span className={styles.railItemLabel}>{stg.label}</span>
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
                                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Scene {asset.scene_index + 1} Voiceover</div>
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
                                    {asset.status !== 'draft' && (
                                      <button
                                        type="button"
                                        className={styles.btnPremiumRegen}
                                        onClick={() => handleRegenerateAsset(asset.id)}
                                      >
                                        <svg style={{ width: '11px', height: '11px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                                        </svg>
                                        Regenerate
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Segment 2: Visual Gallery Grid */}
                          {packageAssets.filter(a => a.asset_type !== 'voiceover').length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <h5 style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>🎬 Video &amp; Image Assets</h5>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                                {packageAssets.filter(a => a.asset_type !== 'voiceover').map((asset) => (
                                  <div key={asset.id} style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                                    <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#000', overflow: 'hidden' }}>
                                      {asset.status === 'succeeded' && asset.output_asset_json ? (
                                        asset.output_asset_json.video_path ? (
                                          <video 
                                            src={getMediaUrl(asset.output_asset_json.video_path)} 
                                            controls 
                                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                                          />
                                        ) : asset.output_asset_json.image_path ? (
                                          <img 
                                            src={getMediaUrl(asset.output_asset_json.image_path)} 
                                            alt="Start Frame" 
                                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                                          />
                                        ) : (
                                          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>No Media Path</div>
                                        )
                                      ) : asset.status === 'failed' ? (
                                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--status-danger)', background: 'rgba(239, 68, 68, 0.05)' }}>
                                          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                                          <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>Failed</span>
                                        </div>
                                      ) : (
                                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                          <svg className={styles.spinner} style={{ animation: 'spin 1.5s linear infinite', width: '20px', height: '20px', color: 'var(--link)', marginBottom: '8px' }} viewBox="0 0 24 24" fill="none">
                                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="30 30" />
                                          </svg>
                                          <span style={{ fontSize: '0.7rem' }}>Generating...</span>
                                        </div>
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

                                    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, justifyContent: 'space-between' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Scene {asset.scene_index + 1}, Shot {asset.shot_index + 1}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={asset.prompt_snapshot}>
                                          {asset.prompt_snapshot}
                                        </div>
                                        {asset.error_message && (
                                          <div style={{ fontSize: '0.68rem', color: 'var(--status-danger)' }}>
                                            Error: {asset.error_message}
                                          </div>
                                        )}
                                      </div>

                                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                                        {asset.status !== 'draft' && (
                                          <button
                                            type="button"
                                            className={styles.btnPremiumRegen}
                                            onClick={() => handleRegenerateAsset(asset.id)}
                                          >
                                            <svg style={{ width: '10px', height: '10px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                                            </svg>
                                            Regenerate
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
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

            {/* 7. Assemble & Review */}
            {activeStageKey === 'assemble-review' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ margin: 0 }}>Timeline Assembly &amp; Preview</h4>
                {activePackage && ['preview_ready', 'final_rendering', 'completed'].includes(activePackage.status) ? (
                  <>
                    {activePackage.preview_asset_json && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Timeline Preview Player</label>
                        <video 
                          src={getMediaUrl(activePackage.preview_asset_json.videoAsset)} 
                          controls 
                          width="100%" 
                          style={{ borderRadius: '8px', border: '1px solid var(--border-subtle)', background: '#000' }}
                        />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Subtitles: <code>{activePackage.preview_asset_json.subtitleAsset}</code>
                        </span>
                      </div>
                    )}

                    {activePackage.status === 'completed' && activePackage.final_asset_json && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--status-success)' }}>✓ Final YouTube Video</label>
                        <video 
                          src={getMediaUrl(activePackage.final_asset_json.videoAsset)} 
                          controls 
                          width="100%" 
                          style={{ borderRadius: '8px', border: '1px solid var(--status-success)', background: '#000' }}
                        />
                        <div className={styles.inheritanceHint} style={{ fontSize: '0.85rem', color: 'var(--status-success)', fontWeight: 'bold' }}>
                          🎉 Video is fully compiled and ready to publish!
                        </div>
                      </div>
                    )}

                    {activePackage.status === 'preview_ready' && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleFinalRender}
                        disabled={isRenderingFinal}
                        style={{ alignSelf: 'flex-start' }}
                      >
                        {isRenderingFinal ? '⚡ Rendering...' : 'Final Render Video'}
                      </button>
                    )}

                    {activePackage.status === 'final_rendering' && (
                      <div className={styles.prereqNotice}>
                        ⚡ Final video render is in progress on GPU Node... (Please wait).
                      </div>
                    )}
                  </>
                ) : (
                  <div className={styles.prereqNotice}>
                    Video rendering preview is not ready. (Prerequisite: Production Plan Approved and shots compiled).
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

          </div>
        </main>
      </div>
    </div>
  );
}
