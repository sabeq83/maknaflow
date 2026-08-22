import { normalizeLocale } from '@/lib/youtube-studio-contract';
import styles from './YouTubeStudioWorkspace.module.css';

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
  handleFinalRender
}) {

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

      <div className={styles.workspaceLayout}>
        {/* Stage Rail Navigation */}
        <aside className={styles.episodeStageRail} aria-label="Episode Stages">
          {stages.map((stg) => {
            const isCurrent = stg.key === activeStageKey;
            const statusClass = getStatusBadgeClass(stg.status);
            return (
              <button
                key={stg.key}
                type="button"
                className={`${styles.railItem} ${isCurrent ? styles.railItemActive : ''}`}
                disabled={stg.status === 'blocked'}
                onClick={() => onStageChange(stg.key)}
              >
                <div className={styles.railItemHeader}>
                  <span className={styles.railItemLabel}>{stg.label}</span>
                  <span className={`${styles.railStatusBadge} ${statusClass}`}>
                    {getStatusLabel(stg.status)}
                  </span>
                </div>
                {stg.status === 'blocked' && stg.reason && (
                  <span className={styles.railItemReason}>{stg.reason}</span>
                )}
              </button>
            );
          })}
        </aside>

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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ margin: 0 }}>Model Generation Profile Selection</h4>
                {['Script Approved', 'In Production', 'Rendering', 'Ready to Publish', 'Uploaded'].includes(episode.status) ? (
                  <div className={styles.durationControl} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label htmlFor="profile-select" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Choose Model Generation Profile</label>
                    <select 
                      id="profile-select" 
                      className={styles.select} 
                      style={{ maxWidth: '300px' }}
                      value={selectedProfileKey} 
                      onChange={(e) => handleSetGenerationProfile(e.target.value)}
                    >
                      <option value="">-- Select Profile --</option>
                      {profilesList.map(p => (
                        <option key={p.key} value={p.key}>{p.label} ({p.provider})</option>
                      ))}
                    </select>
                    {selectedProfileKey && (
                      <div className={styles.inheritanceHint} style={{ marginTop: '4px', fontSize: '0.8rem' }}>
                        ✓ Profile active. Allowed durations per clip: <strong>{profilesList.find(p => p.key === selectedProfileKey)?.generatedShotDurations.join(', ')}s</strong>.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={styles.prereqNotice}>
                    Generation profile can be configured once the script is Approved. (Prerequisite: Episode must be in 'Script Approved' status).
                  </div>
                )}
              </div>
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
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleGenerateProductionPlan}
                      disabled={isGeneratingPlan}
                    >
                      {isGeneratingPlan ? '⚡ Generating Plan...' : 'Generate AI Production Plan'}
                    </button>
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
                        <span style={{ fontSize: '0.85rem' }}>Package Status: <strong>{activePackage.status.toUpperCase()}</strong></span>
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
                        {activePackage.plan_json?.scenes?.map((scene, idx) => (
                          <div key={idx} style={{ background: 'var(--background)', padding: '12px', borderRadius: '6px', borderLeft: '3px solid var(--accent)', marginTop: '8px' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '4px' }}>Scene {idx + 1} ({scene.narrative_duration_seconds}s)</div>
                            <div style={{ fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>VO: "{scene.voiceover}"</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {scene.shots?.map((shot, shotIdx) => (
                                <div key={shotIdx} style={{ fontSize: '0.8rem', background: 'var(--surface-raised)', padding: '6px 10px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                  <span>🎬 Shot {shotIdx + 1}: [{shot.asset_type}] - <em>"{shot.prompt}"</em></span>
                                  <span style={{ fontWeight: '600' }}>{shot.generation_duration_seconds}s</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {activePackage && activePackage.status !== 'draft' && (
                      <div style={{ marginTop: '12px' }}>
                        <h4 style={{ margin: '0 0 12px 0' }}>Asset &amp; VO Generation Progress</h4>
                        <div className={styles.assetProgress}>
                          {packageAssets.map((asset) => (
                            <div key={asset.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-interactive)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-subtle)', marginBottom: '8px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
                                  {asset.asset_type === 'voiceover' ? '🎙️ Voiceover' : '🎬 Visual Shot'} (Scene {asset.scene_index + 1}{asset.shot_index >= 0 ? `, Shot ${asset.shot_index + 1}` : ''})
                                </span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                  {asset.prompt_snapshot?.substring(0, 80)}...
                                </span>
                                {asset.error_message && (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--status-danger)' }}>
                                    Error: {asset.error_message}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span className={`badge`} style={{ 
                                  background: asset.status === 'succeeded' ? 'var(--status-success-soft)' : asset.status === 'failed' ? 'var(--status-danger-soft)' : 'var(--status-warning-soft)',
                                  color: asset.status === 'succeeded' ? 'var(--status-success)' : asset.status === 'failed' ? 'var(--status-danger)' : 'var(--status-warning)'
                                }}>
                                  {asset.status.toUpperCase()}
                                </span>
                                {asset.status !== 'draft' && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleRegenerateAsset(asset.id)}
                                    style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                                  >
                                    Regenerate
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
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
                          src={activePackage.preview_asset_json.videoAsset} 
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
                          src={activePackage.final_asset_json.videoAsset} 
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
