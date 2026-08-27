import { useState } from 'react';
import { normalizeLocale } from '@/lib/youtube-studio-contract';
import styles from './YouTubeStudioWorkspace.module.css';

export function ChannelDetailView({
  channel,
  activeStrategy,
  draftStrategy,
  brief,
  setBrief,
  showBriefForm,
  setShowBriefForm,
  isGeneratingStrategy,
  handleGenerateStrategy,
  refineInstruction,
  setRefineInstruction,
  isRefiningStrategy,
  handleRefineStrategy,
  isActivatingStrategy,
  handleActivateStrategy,
  universes,
  visualIdentities,
  showRawActive,
  setShowRawActive,
  showRawDraft,
  setShowRawDraft,
  
  // Series props
  series,
  newSeriesName,
  setNewSeriesName,
  newSeriesPillar,
  setNewSeriesPillar,
  newSeriesDurationMode,
  setNewSeriesDurationMode,
  newSeriesDuration,
  setNewSeriesDuration,
  handleCreateSeries,
  seriesSuggestions,
  setSeriesSuggestions,
  isGeneratingSeriesSuggestions,
  handleGenerateSeriesSuggestions,
  handleAdoptSeriesConcept,
  onOpenSeries,

  // KB props
  kbItems,
  kbLoading,
  kbSelectedId,
  setKbSelectedId,
  kbRevisions,
  setKbRevisions,
  kbShowCreate,
  setKbShowCreate,
  kbCreateType,
  setKbCreateType,
  kbCreateTitle,
  setKbCreateTitle,
  kbCreateScope,
  setKbCreateScope,
  kbCreateBrief,
  setKbCreateBrief,
  kbIsGenerating,
  kbIsUploading,
  kbUploadMode,
  setKbUploadMode,
  kbUploadFile,
  setKbUploadFile,
  newChannelLocale,
  handleSyncTemplates,
  handleLoadKbLibrary,
  handleCreateKbDraft,
  handleUploadKbDraft,
  handleActivateKb,
  handleArchiveKb,
  handleBindKbToChannel
}) {
  const [kbCollapsed, setKbCollapsed] = useState(false);
  const [strategyCollapsed, setStrategyCollapsed] = useState(false);
  const [seriesCollapsed, setSeriesCollapsed] = useState(false);

  function renderStrategyConfig(config, isDraft = false) {
    if (!config) return null;
    const pillars = config.content_pillars || [];
    const persona = config.audience_persona || {};
    const format = config.video_format || {};
    const monetization = config.monetization_path || [];
    const guardrails = config.risk_guardrails || [];
    const showRaw = isDraft ? showRawDraft : showRawActive;
    const setShowRaw = isDraft ? setShowRawDraft : setShowRawActive;

    return (
      <div className={styles.strategyDetails}>
        <div className={styles.strategyGrid}>
          {config.positioning && (
            <div className={styles.strategyCard} style={{ gridColumn: 'span 2' }}>
              <h4 className={styles.strategyLabel}>Positioning & Brand Identity</h4>
              <p className={styles.strategyText} style={{ fontSize: '1.05rem', fontWeight: 600 }}>{config.positioning}</p>
              {config.editorial_tone && (
                <div style={{ marginTop: '8px' }}>
                  <h4 className={styles.strategyLabel} style={{ fontSize: '0.65rem' }}>Tone of Voice</h4>
                  <p className={styles.strategyText} style={{ margin: '2px 0 0 0' }}>{config.editorial_tone}</p>
                </div>
              )}
            </div>
          )}

          {(persona.who || persona.need || persona.geography) && (
            <div className={styles.strategyCard}>
              <h4 className={styles.strategyLabel}>Target Audience & Persona</h4>
              {persona.who && <p className={styles.strategyText}><strong>Target:</strong> {persona.who}</p>}
              {persona.need && <p className={styles.strategyText}><strong>Need:</strong> {persona.need}</p>}
              {persona.geography && <p className={styles.strategyText}><strong>Geography:</strong> {persona.geography}</p>}
            </div>
          )}

          <div className={styles.strategyCard}>
            <h4 className={styles.strategyLabel}>Video Format & Cadence</h4>
            <p className={styles.strategyText}><strong>Duration:</strong> {format.target_duration_seconds ? `${Math.floor(format.target_duration_seconds / 60)}m` : 'N/A'} ({format.target_duration_seconds || 0}s)</p>
            <p className={styles.strategyText}><strong>Cadence:</strong> {format.cadence || 'N/A'}</p>
            {config.cta_strategy && <p className={styles.strategyText} style={{ marginTop: '8px' }}><strong>CTA Strategy:</strong> {config.cta_strategy}</p>}
          </div>
        </div>

        {pillars.length > 0 && (
          <div className={styles.strategyCard}>
            <h4 className={styles.strategyLabel}>Content Pillars</h4>
            <div className={styles.pillarsGrid}>
              {pillars.map((pillar, idx) => (
                <div key={idx} className={styles.pillarItem}>
                  <h5 className={styles.pillarTitle}>{pillar.name}</h5>
                  {pillar.purpose && <p className={styles.pillarPurpose}>{pillar.purpose}</p>}
                  {pillar.example_angles && pillar.example_angles.length > 0 && (
                    <ul className={styles.pillarAngles}>
                      {pillar.example_angles.map((angle, aidx) => (
                        <li key={aidx}>{angle}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={styles.strategyGrid}>
          {monetization.length > 0 && (
            <div className={styles.strategyCard}>
              <h4 className={styles.strategyLabel}>Monetization Paths</h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                {monetization.map((m, idx) => (
                  <span key={idx} className={styles.strategyBadge}>{m}</span>
                ))}
              </div>
            </div>
          )}

          {guardrails.length > 0 && (
            <div className={styles.strategyCard}>
              <h4 className={styles.strategyLabel}>Risk Guardrails</h4>
              <ul className={styles.guardrailsList}>
                {guardrails.map((g, idx) => (
                  <li key={idx}>{g}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div style={{ alignSelf: 'flex-start', marginTop: '8px' }}>
          <button 
            type="button" 
            className={styles.collapsibleToggle} 
            onClick={() => setShowRaw(!showRaw)}
          >
            {showRaw ? 'Hide Raw JSON Configuration' : 'Show Raw JSON Configuration'}
          </button>
          {showRaw && (
            <div className={styles.detailPanel} style={{ marginTop: '10px' }}>
              <pre>{JSON.stringify(config, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.channelDetailView}>
      
      {/* ─── KNOWLEDGE BASE LIBRARY SECTION ───────────────────────────────────── */}
      <section className={styles.kbStep} aria-labelledby="kb-step-title">
        <div 
          className={styles.stepHeader} 
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setKbCollapsed(!kbCollapsed)}
        >
          <h2 id="kb-step-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            Knowledge Base Library <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{kbCollapsed ? '▶' : '▼'}</span>
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} onClick={(e) => e.stopPropagation()}>
            <span className={styles.kbStepBadge}>Channel &amp; Series Context</span>
            <button type="button" className={styles.collapsibleToggle} onClick={() => setKbCollapsed(!kbCollapsed)}>
              {kbCollapsed ? 'Expand' : 'Collapse'}
            </button>
          </div>
        </div>
        
        {!kbCollapsed && (
          <>
            <p className={styles.kbStepDesc}>
              Manage versioned Knowledge Bases for this Channel. Active KBs are automatically injected during research, planning, script-writing, and production stages.
            </p>

        <div className={styles.kbToolbar}>
          <button
            id="kb-load-btn"
            className={styles.btnSecondary}
            disabled={kbLoading}
            onClick={handleLoadKbLibrary}
          >
            {kbLoading ? 'Loading...' : '↻ Load KB Library'}
          </button>
          
          <button
            id="kb-sync-templates-btn"
            className={styles.btnSecondary}
            disabled={kbLoading}
            onClick={handleSyncTemplates}
          >
            🔄 Sync Templates Folder
          </button>

          <button
            id="kb-create-toggle-btn"
            className={styles.btnPrimary}
            onClick={() => setKbShowCreate(!kbShowCreate)}
          >
            {kbShowCreate ? '✕ Cancel' : '+ Create New KB'}
          </button>
        </div>

        {kbShowCreate && (
          <div className={styles.kbCreateForm}>
            <h3 className={styles.kbCreateTitle}>Create New Knowledge Base</h3>
            
            <div className={styles.kbTabContainer}>
              <button
                type="button"
                className={`${styles.kbTab} ${kbUploadMode === 'ai' ? styles.kbTabActive : ''}`}
                onClick={() => setKbUploadMode('ai')}
              >
                ✨ AI Draft Generator
              </button>
              <button
                type="button"
                className={`${styles.kbTab} ${kbUploadMode === 'upload' ? styles.kbTabActive : ''}`}
                onClick={() => setKbUploadMode('upload')}
              >
                📤 Upload &amp; Parse File
              </button>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="kb-type-select">KB TYPE</label>
                <select id="kb-type-select" className={styles.select} value={kbCreateType} onChange={e => setKbCreateType(e.target.value)}>
                  <option value="channel_profile">Channel Profile</option>
                  <option value="series_content_guide">Series Content Guide</option>
                  <option value="longform_editorial_playbook">Editorial Playbook</option>
                  <option value="research_source_policy">Research Source Policy</option>
                  <option value="visual_continuity_guide">Visual Continuity Guide</option>
                  <option value="prompt_production_playbook">Prompt Production Playbook</option>
                  <option value="voice_audio_guide">Voice &amp; Audio Guide</option>
                  <option value="rights_disclosure_policy">Rights &amp; Disclosure Policy</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="kb-scope-select">SCOPE</label>
                <select id="kb-scope-select" className={styles.select} value={kbCreateScope} onChange={e => setKbCreateScope(e.target.value)}>
                  <option value="channel">Channel</option>
                  <option value="series">Series</option>
                  <option value="tenant">Tenant</option>
                </select>
              </div>
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="kb-title-input">KB TITLE</label>
              <input id="kb-title-input" className={styles.input} type="text" placeholder="e.g. Channel Profile MAKNA Flow" value={kbCreateTitle} onChange={e => setKbCreateTitle(e.target.value)} />
            </div>

            {kbUploadMode === 'ai' ? (
              <>
                <div className={styles.formGroup}>
                  <label htmlFor="kb-brief-input">AI CONTEXT BRIEF</label>
                  <textarea
                    id="kb-brief-input"
                    className={styles.textarea}
                    rows={4}
                    placeholder="Describe your channel/series: niche, target audience, voice tone, style, etc."
                    value={kbCreateBrief}
                    onChange={e => setKbCreateBrief(e.target.value)}
                  />
                </div>
                <div className={styles.kbCreateActions}>
                  <button
                    id="kb-ai-draft-btn"
                    className={styles.btnPrimaryLarge}
                    disabled={kbIsGenerating || !kbCreateTitle || !kbCreateBrief}
                    onClick={handleCreateKbDraft}
                  >
                    {kbIsGenerating ? '⏳ Generating Draft...' : '✨ Generate AI Draft'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.formGroup}>
                  <label>UPLOAD KB DOCUMENT (.json, .txt, .md)</label>
                  <div className={styles.kbUploadDropzone}>
                    <input
                      id="kb-file-upload"
                      type="file"
                      accept=".json,.txt,.md"
                      className={styles.kbFileInputHidden}
                      onChange={e => {
                        const file = e.target.files[0];
                        setKbUploadFile(file);
                        if (file) {
                          const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
                          setKbCreateTitle(cleanName);
                        }
                      }}
                    />
                    <label htmlFor="kb-file-upload" className={styles.kbUploadLabel}>
                      <span className={styles.kbUploadIcon}>📁</span>
                      {kbUploadFile ? (
                        <span className={styles.kbUploadFileName}>{kbUploadFile.name} ({(kbUploadFile.size / 1024).toFixed(1)} KB)</span>
                      ) : (
                        <span className={styles.kbUploadInstructions}>Click here to select a file document</span>
                      )}
                    </label>
                  </div>
                  <p className={styles.kbStepDesc} style={{ marginTop: '8px', fontSize: '0.75rem' }}>
                    * Structured JSON is imported directly. TXT/MD files will be processed by AI into the target KB schema.
                  </p>
                </div>
                <div className={styles.kbCreateActions}>
                  <button
                    id="kb-upload-draft-btn"
                    className={styles.btnPrimaryLarge}
                    disabled={kbIsUploading || !kbCreateTitle || !kbUploadFile}
                    onClick={handleUploadKbDraft}
                  >
                    {kbIsUploading ? '⏳ Uploading & Processing...' : '📤 Upload & Create Draft'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {kbItems.length === 0 && !kbLoading && (
          <p className={styles.kbEmptyState}>No Knowledge Bases in library yet. Click "Load KB Library" or create a new one.</p>
        )}
        
        <div className={styles.kbList}>
          {kbItems.map(kb => (
            <div
              key={kb.id}
              className={`${styles.kbCard} ${kbSelectedId === kb.id ? styles.kbCardActive : ''}`}
              onClick={async () => {
                setKbSelectedId(kb.id);
                const res = await fetch(`/api/v2/youtube-studio/knowledge-bases/${kb.id}`);
                const data = await res.json();
                setKbRevisions(data.revisions || []);
              }}
              role="button"
              tabIndex={0}
            >
              <div className={styles.kbCardHeader}>
                <span className={styles.kbTypeTag}>{kb.kb_type?.replace(/_/g, ' ')}</span>
                <span className={`${styles.revisionBadge} ${styles[`kbStatus_${kb.status}`]}`}>{kb.status}</span>
                
                <div className={styles.kbCardHeaderActions} style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                  {kb.status === 'draft' && (
                    <button
                      type="button"
                      className={styles.btnMini}
                      onClick={(e) => handleActivateKb(e, kb)}
                    >
                      ✓ Activate
                    </button>
                  )}
                  {kb.status !== 'archived' && (
                    <button
                      type="button"
                      className={styles.btnMiniDanger}
                      onClick={(e) => handleArchiveKb(e, kb)}
                    >
                      ✕ Archive
                    </button>
                  )}
                </div>
              </div>
              <p className={styles.kbCardTitle}>{kb.title}</p>
              <p className={styles.bindingSummary}>Scope: {kb.scope} · {kb.scope_id}</p>

              {kbSelectedId === kb.id && kbRevisions.length > 0 && (
                <div className={styles.kbRevisionPanel}>
                  <h4 className={styles.kbRevisionTitle}>Revision History</h4>
                  {kbRevisions.map(rev => (
                    <div key={rev.id} className={styles.kbRevisionWrapper}>
                      <div className={styles.kbRevisionRow}>
                        <span className={styles.kbRevNum}>Rev #{rev.revision_number}</span>
                        <span className={`${styles.revisionBadge} ${styles[`kbStatus_${rev.status}`]}`}>{rev.status}</span>
                        {rev.ai_generated && <span className={styles.kbAiBadge}>AI</span>}
                        
                        <div className={styles.kbRevisionActionsGroup}>
                          {(rev.status === 'draft' || rev.status === 'review') && (
                            <button
                              id={`kb-activate-${rev.id}`}
                              className={styles.btnMini}
                              onClick={async (e) => {
                                e.stopPropagation();
                                const res = await fetch(`/api/v2/youtube-studio/knowledge-bases/${kb.id}/activate`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ revision_id: rev.id }),
                                });
                                const data = await res.json();
                                if (data.success) {
                                  // Refresh revisions
                                  const refreshRes = await fetch(`/api/v2/youtube-studio/knowledge-bases/${kb.id}`);
                                  const refreshData = await refreshRes.json();
                                  setKbRevisions(refreshData.revisions || []);
                                  handleLoadKbLibrary();
                                }
                              }}
                            >
                              ✓ Activate
                            </button>
                          )}
                        </div>
                      </div>
                      <pre className={styles.kbContentPreview}>{JSON.stringify(rev.content_json || {}, null, 2)}</pre>
                    </div>
                  ))}

                  {channel && (
                    <button
                      id={`kb-bind-channel-${kb.id}`}
                      className={styles.btnSecondary}
                      style={{ marginTop: '8px' }}
                      onClick={(e) => handleBindKbToChannel(e, kb.id)}
                    >
                      🔗 Bind to Channel
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
          </>
        )}
      </section>

      {/* ─── CHANNEL STRATEGY SECTION ─────────────────────────────────────────── */}
      <section className={styles.workflowStep} aria-labelledby="step-strategy-title">
        <div 
          className={styles.stepHeader} 
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setStrategyCollapsed(!strategyCollapsed)}
        >
          <h2 id="step-strategy-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            Channel AI Strategy <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{strategyCollapsed ? '▶' : '▼'}</span>
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} onClick={(e) => e.stopPropagation()}>
            {(activeStrategy || draftStrategy) && !strategyCollapsed && (
              <button 
                type="button"
                className={styles.collapsibleToggle} 
                onClick={() => setShowBriefForm(!showBriefForm)}
              >
                {showBriefForm ? 'Hide Brief Form' : 'Show/Edit Brief Form'}
              </button>
            )}
            <button type="button" className={styles.collapsibleToggle} onClick={() => setStrategyCollapsed(!strategyCollapsed)}>
              {strategyCollapsed ? 'Expand' : 'Collapse'}
            </button>
          </div>
        </div>

        {!strategyCollapsed && (
          <>

        {showBriefForm && (
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label htmlFor="brief-niche">NICHE / TOPIC</label>
              <input id="brief-niche" className={styles.input} type="text" value={brief.niche} onChange={(e) => setBrief({ ...brief, niche: e.target.value })} placeholder="e.g. AI Automation for Developers" />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="brief-audience">TARGET AUDIENCE</label>
              <input id="brief-audience" className={styles.input} type="text" value={brief.audience} onChange={(e) => setBrief({ ...brief, audience: e.target.value })} placeholder="e.g. Tech professionals and programmers" />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="brief-geography">GEOGRAPHY</label>
              <input id="brief-geography" className={styles.input} type="text" value={brief.geography} onChange={(e) => setBrief({ ...brief, geography: e.target.value })} placeholder="e.g. Indonesia, Southeast Asia" />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="brief-objective">OBJECTIVE</label>
              <select id="brief-objective" className={styles.select} value={brief.objective} onChange={(e) => setBrief({ ...brief, objective: e.target.value })}>
                <option value="AdSense">AdSense Revenue</option>
                <option value="Affiliate">Affiliate Sales</option>
                <option value="Leads">Leads & Digital Products</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="brief-universe">OPTIONAL UNIVERSE CONTEXT</label>
              <select id="brief-universe" className={styles.select} value={brief.universe_id} onChange={(e) => setBrief({ ...brief, universe_id: e.target.value })}>
                <option value="">None Selected</option>
                {universes.map(u => <option key={u.id} value={u.id}>{u.name || u.title}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="brief-visual">OPTIONAL VISUAL IDENTITY CONTEXT</label>
              <select id="brief-visual" className={styles.select} value={brief.visual_identity_preset_id} onChange={(e) => setBrief({ ...brief, visual_identity_preset_id: e.target.value })}>
                <option value="">None Selected</option>
                {visualIdentities.map(vi => <option key={vi.id} value={vi.id}>{vi.name || vi.brand_name}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="brief-duration">DEFAULT VIDEO DURATION</label>
              <select 
                id="brief-duration" 
                className={styles.select} 
                value={brief.default_target_duration_seconds || 600} 
                onChange={(e) => setBrief({ ...brief, default_target_duration_seconds: parseInt(e.target.value, 10) })}
              >
                <option value={300}>5 Menit (300s)</option>
                <option value={480}>8 Menit (480s)</option>
                <option value={600}>10 Menit (600s)</option>
                <option value={720}>12 Menit (720s)</option>
                <option value={900}>15 Menit (900s)</option>
                <option value={1200}>20 Menit (1200s)</option>
                <option value={1800}>30 Menit (1800s)</option>
              </select>
            </div>

            <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleGenerateStrategy}
                disabled={isGeneratingStrategy}
              >
                {isGeneratingStrategy ? '⚡ Generating Draft...' : '🚀 Generate Strategy Draft (AI)'}
              </button>
            </div>
          </div>
        )}

        {activeStrategy && (
          <div className={styles.subSection}>
            <h3 style={{ color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ✓ ACTIVE CHANNEL STRATEGY
            </h3>
            {renderStrategyConfig(activeStrategy.config_json, false)}
          </div>
        )}

        {draftStrategy && (
          <div className={styles.strategyDraftContainer}>
            <h3 style={{ color: 'var(--link)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ✏️ STRATEGY DRAFT (REVIEW REQUIRED)
            </h3>
            
            <div style={{ marginBlock: '12px' }}>
              <button 
                type="button" 
                className="btn btn-success" 
                onClick={handleActivateStrategy}
                disabled={isActivatingStrategy}
              >
                {isActivatingStrategy ? 'Activating...' : 'Activate Strategy'}
              </button>
            </div>

            {renderStrategyConfig(draftStrategy.config_json, true)}

            <div className={styles.formGroup}>
              <label htmlFor="ai-refine">AI Refinement Copilot Instructions</label>
              <div className={styles.buttonRow}>
                <input 
                  id="ai-refine"
                  className={styles.input}
                  type="text" 
                  placeholder="e.g. Focus more on web security content pillars" 
                  value={refineInstruction}
                  onChange={(e) => setRefineInstruction(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleRefineStrategy}
                  disabled={isRefiningStrategy}
                >
                  {isRefiningStrategy ? 'Refining...' : 'Refine'}
                </button>
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </section>

      {/* ─── CONTENT SERIES SECTION ──────────────────────────────────────────── */}
      <section className={styles.workflowStep} aria-labelledby="step-series-title">
        <div 
          className={styles.stepHeader} 
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setSeriesCollapsed(!seriesCollapsed)}
        >
          <h2 id="step-series-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            Content Series <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{seriesCollapsed ? '▶' : '▼'}</span>
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} onClick={(e) => e.stopPropagation()}>
            {activeStrategy && !seriesCollapsed && (
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleGenerateSeriesSuggestions}
                disabled={isGeneratingSeriesSuggestions}
                style={{ padding: '6px 14px', fontSize: '0.8rem' }}
              >
                {isGeneratingSeriesSuggestions ? '⚡ Generating...' : 'Suggest Series Concepts (AI)'}
              </button>
            )}
            <button type="button" className={styles.collapsibleToggle} onClick={() => setSeriesCollapsed(!seriesCollapsed)}>
              {seriesCollapsed ? 'Expand' : 'Collapse'}
            </button>
          </div>
        </div>

        {!seriesCollapsed && (
          <>

        {!activeStrategy ? (
          <div className={styles.prereqNotice}>
            ⚠️ A channel strategy must be active before you can create content series.
          </div>
        ) : (
          <>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="new-series-name">Series Name</label>
                <input 
                  id="new-series-name"
                  className={styles.input}
                  type="text" 
                  placeholder="e.g. Web Hacking 101" 
                  value={newSeriesName}
                  onChange={(e) => setNewSeriesName(e.target.value)}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="new-series-pillar">Pillar Name (Optional)</label>
                <input 
                  id="new-series-pillar"
                  className={styles.input}
                  type="text" 
                  placeholder="e.g. Cyber Security" 
                  value={newSeriesPillar}
                  onChange={(e) => setNewSeriesPillar(e.target.value)}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="new-series-duration-mode">Duration Mode</label>
                <select 
                  id="new-series-duration-mode" 
                  className={styles.select} 
                  value={newSeriesDurationMode} 
                  onChange={(e) => setNewSeriesDurationMode(e.target.value)}
                >
                  <option value="inherit">Inherit Channel default</option>
                  <option value="override">Override Series duration</option>
                </select>
              </div>
              {newSeriesDurationMode === 'override' && (
                <div className={styles.formGroup}>
                  <label htmlFor="new-series-duration">Series Target Duration (s)</label>
                  <input 
                    id="new-series-duration" 
                    className={styles.input} 
                    type="number" 
                    value={newSeriesDuration} 
                    onChange={(e) => setNewSeriesDuration(parseInt(e.target.value, 10))} 
                  />
                </div>
              )}
              <div className={styles.formGroup} style={{ justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleCreateSeries}
                >
                  Create Series
                </button>
              </div>
            </div>

            {seriesSuggestions.length > 0 && (
              <div className={styles.subSection} style={{ borderTop: '1px dashed var(--border-subtle)', paddingTop: '20px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0 }}>AI Series Suggestions</h3>
                  <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.78rem' }} onClick={() => setSeriesSuggestions([])}>Clear Suggestions</button>
                </div>
                <div className={styles.cardsList} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {seriesSuggestions.map((concept, idx) => (
                    <div key={idx} className={styles.ideaCard} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '16px' }}>
                      <div className={styles.ideaCardInfo} style={{ flex: 1 }}>
                        <h4 style={{ margin: '0 0 6px 0' }}>{concept.name}</h4>
                        <p style={{ margin: '0 0 6px 0', fontSize: '0.85rem' }}><strong>Pillar:</strong> {concept.pillar}</p>
                        <p style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{concept.description}</p>
                        {concept.concept_angle && <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}><strong>Angle:</strong> {concept.concept_angle}</p>}
                      </div>
                      <div className={styles.ideaActions} style={{ display: 'flex', alignItems: 'center' }}>
                        <button type="button" className="btn btn-success" onClick={() => handleAdoptSeriesConcept(concept)}>Adopt</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.seriesGrid}>
              {series.map(s => (
                <div 
                  key={s.id} 
                  onClick={() => onOpenSeries(s)}
                  className={styles.seriesCard}
                >
                  <div className={styles.seriesTitle}>{s.name}</div>
                  {s.pillar && <div className={styles.seriesMeta}>Pillar: {s.pillar}</div>}
                  <div className={styles.viewDetailsLink} style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--link)' }}>Open Series Backlog →</div>
                </div>
              ))}
              {series.length === 0 && (
                <div className={styles.prereqNotice} style={{ gridColumn: 'span 3', borderStyle: 'dashed' }}>
                  No content series created yet. Fill the form above to add a series.
                </div>
              )}
            </div>
          </>
        )}
          </>
        )}
      </section>
    </div>
  );
}
