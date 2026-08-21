'use client';

import { useState, useEffect } from 'react';
import { normalizeLocale } from '@/lib/youtube-studio-contract';
import styles from './YouTubeStudioWorkspace.module.css';

export function YouTubeStudioWorkspace() {
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  
  // Strategy
  const [activeStrategy, setActiveStrategy] = useState(null);
  const [draftStrategy, setDraftStrategy] = useState(null);
  const [brief, setBrief] = useState({
    niche: '',
    audience: '',
    geography: '',
    objective: 'AdSense',
    universe_id: '',
    visual_identity_preset_id: '',
    brand_constraints: '',
    forbidden_claims: ''
  });
  const [refineInstruction, setRefineInstruction] = useState('');
  const [isGeneratingStrategy, setIsGeneratingStrategy] = useState(false);
  const [isRefiningStrategy, setIsRefiningStrategy] = useState(false);
  const [isActivatingStrategy, setIsActivatingStrategy] = useState(false);
  const [showBriefForm, setShowBriefForm] = useState(true);

  // Pre-requisites for Brief
  const [universes, setUniverses] = useState([]);
  const [visualIdentities, setVisualIdentities] = useState([]);

  // Series
  const [series, setSeries] = useState([]);
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [newSeriesName, setNewSeriesName] = useState('');
  const [newSeriesPillar, setNewSeriesPillar] = useState('');

  // Ideas Backlog
  const [ideas, setIdeas] = useState([]);
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);

  // Episodes
  const [episodes, setEpisodes] = useState([]);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [newEpisodeTitle, setNewEpisodeTitle] = useState('');
  const [newEpisodeDuration, setNewEpisodeDuration] = useState(600);

  // General state
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelLocale, setNewChannelLocale] = useState('id-ID');
  const [errorMsg, setErrorMsg] = useState('');
  const [notice, setNotice] = useState(null); // { tone: 'success'|'info'|'danger', message: '...' }
  const [showRawActive, setShowRawActive] = useState(false);
  const [showRawDraft, setShowRawDraft] = useState(false);

  useEffect(() => {
    fetchChannels();
    fetchBriefPresets();
  }, []);

  // Update showBriefForm automatically if strategy changes
  useEffect(() => {
    if (activeStrategy || draftStrategy) {
      setShowBriefForm(false);
    } else {
      setShowBriefForm(true);
    }
  }, [activeStrategy, draftStrategy]);

  // Alert/notice helper
  function triggerNotice(tone, message) {
    setNotice({ tone, message });
    // Auto-clear notice after 6 seconds
    setTimeout(() => {
      setNotice(current => current && current.message === message ? null : current);
    }, 6000);
  }

  async function fetchBriefPresets() {
    try {
      const uRes = await fetch('/api/v2/universe-profiles');
      const uData = await uRes.json();
      if (uData.success) setUniverses(uData.data || []);

      const viRes = await fetch('/api/v2/visual-identities');
      const viData = await viRes.json();
      if (viData.success) setVisualIdentities(viData.data || []);
    } catch (e) {
      console.error('Failed to load brief presets', e);
    }
  }

  async function fetchChannels() {
    try {
      const res = await fetch('/api/v2/youtube-studio/channels');
      const data = await res.json();
      if (data.success && data.data) {
        setChannels(data.data);
        if (data.data.length > 0) {
          selectChannel(data.data[0]);
        }
      }
    } catch (e) {
      setErrorMsg('Failed to load channels.');
    }
  }

  async function selectChannel(channel) {
    setSelectedChannel(channel);
    setSeries([]);
    setSelectedSeries(null);
    setIdeas([]);
    setEpisodes([]);
    setSelectedEpisode(null);
    setActiveStrategy(null);
    setDraftStrategy(null);
    setErrorMsg('');
    setNotice(null);

    if (!channel) return;

    try {
      // 1. Fetch active and draft strategy
      const res = await fetch(`/api/v2/youtube-studio/channels/${channel.id}/strategy`);
      const data = await res.json();
      if (data.success) {
        setActiveStrategy(data.active);
        setDraftStrategy(data.draft);
        if (data.draft?.brief_json) {
          setBrief(data.draft.brief_json);
        }
      }

      // 2. Fetch series
      const seriesRes = await fetch(`/api/v2/youtube-studio/channels/${channel.id}/series`);
      const seriesData = await seriesRes.json();
      if (seriesData.success) {
        setSeries(seriesData.data);
        if (seriesData.data.length > 0) {
          await selectSeries(seriesData.data[0]);
        }
      }

      // 3. Fetch episodes
      const epRes = await fetch(`/api/v2/youtube-studio/episodes?channel_id=${channel.id}`);
      const epData = await epRes.json();
      if (epData.success) {
        setEpisodes(epData.data);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Failed to select channel.');
    }
  }

  async function handleCreateChannel() {
    if (!newChannelName) return;
    setErrorMsg('');
    setNotice(null);
    try {
      const res = await fetch('/api/v2/youtube-studio/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newChannelName, primary_locale: newChannelLocale })
      });
      const data = await res.json();
      if (data.success) {
        const created = data.data;
        setNewChannelName('');
        // Add new channel and select immediately (POST direct-response path)
        setChannels(current => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
        await selectChannel(created);
        triggerNotice('success', `Channel "${created.name}" created and selected!`);
      } else {
        setErrorMsg(data.error || 'Failed to create channel.');
      }
    } catch (e) {
      setErrorMsg('Failed to create channel.');
    }
  }

  async function handleGenerateStrategy() {
    setErrorMsg('');
    setNotice(null);
    setIsGeneratingStrategy(true);
    try {
      const res = await fetch(`/api/v2/youtube-studio/channels/${selectedChannel.id}/strategy/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief })
      });
      const data = await res.json();
      if (data.success) {
        setDraftStrategy(data.data);
        triggerNotice('success', 'Strategy draft generated! Review details below.');
      } else {
        setErrorMsg(data.error || 'Failed to generate strategy.');
      }
    } catch (e) {
      setErrorMsg('AI generation failed.');
    } finally {
      setIsGeneratingStrategy(false);
    }
  }

  async function handleRefineStrategy() {
    if (!refineInstruction) return;
    setErrorMsg('');
    setNotice(null);
    setIsRefiningStrategy(true);
    try {
      const res = await fetch(`/api/v2/youtube-studio/channels/${selectedChannel.id}/strategy/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: refineInstruction })
      });
      const data = await res.json();
      if (data.success) {
        setDraftStrategy(data.data);
        setRefineInstruction('');
        triggerNotice('success', 'Strategy draft refined based on your feedback!');
      } else {
        setErrorMsg(data.error || 'Failed to refine strategy.');
      }
    } catch (e) {
      setErrorMsg('AI refinement failed.');
    } finally {
      setIsRefiningStrategy(false);
    }
  }

  async function handleSaveStrategyDraftManual(updatedConfig) {
    setErrorMsg('');
    setNotice(null);
    try {
      const res = await fetch(`/api/v2/youtube-studio/channels/${selectedChannel.id}/strategy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: updatedConfig,
          brief,
          universe_id: brief.universe_id,
          visual_identity_preset_id: brief.visual_identity_preset_id
        })
      });
      const data = await res.json();
      if (data.success) {
        setDraftStrategy(data.data);
        triggerNotice('success', 'Draft strategy saved successfully!');
      } else {
        setErrorMsg(data.error || 'Failed to save draft.');
      }
    } catch (e) {
      setErrorMsg('Failed to save manual changes.');
    }
  }

  async function handleActivateStrategy() {
    if (!draftStrategy) return;
    setErrorMsg('');
    setNotice(null);
    setIsActivatingStrategy(true);
    try {
      const res = await fetch(`/api/v2/youtube-studio/channels/${selectedChannel.id}/strategy/activate`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setActiveStrategy(data.data);
        setDraftStrategy(null);
        triggerNotice('success', 'Strategy activated successfully! You can now create content series.');
      } else {
        setErrorMsg(data.error || 'Failed to activate strategy.');
      }
    } catch (e) {
      setErrorMsg('Activation request failed.');
    } finally {
      setIsActivatingStrategy(false);
    }
  }

  async function selectSeries(item) {
    setSelectedSeries(item);
    setIdeas([]);
    setErrorMsg('');

    if (!item) return;

    try {
      const res = await fetch(`/api/v2/youtube-studio/series/${item.id}/ideas`);
      const data = await res.json();
      if (data.success) {
        setIdeas(data.data);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Failed to load series backlog.');
    }
  }

  async function handleCreateSeries() {
    if (!newSeriesName || !selectedChannel) return;
    setErrorMsg('');
    setNotice(null);
    try {
      const res = await fetch(`/api/v2/youtube-studio/channels/${selectedChannel.id}/series`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSeriesName, pillar: newSeriesPillar })
      });
      const data = await res.json();
      if (data.success) {
        const created = data.data;
        setNewSeriesName('');
        setNewSeriesPillar('');
        setSeries(current => [...current, created]);
        await selectSeries(created);
        triggerNotice('success', `Content series "${created.name}" created!`);
      } else {
        setErrorMsg(data.error || 'Failed to create series.');
      }
    } catch (e) {
      setErrorMsg('Failed to create content series.');
    }
  }

  async function handleGenerateEpisodeIdeas() {
    if (!selectedSeries) return;
    setErrorMsg('');
    setNotice(null);
    setIsGeneratingIdeas(true);
    try {
      const res = await fetch(`/api/v2/youtube-studio/series/${selectedSeries.id}/ideas/generate`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setIdeas(data.data);
        triggerNotice('success', 'AI Episode suggestions generated successfully.');
      } else {
        setErrorMsg(data.error || 'Failed to generate ideas.');
      }
    } catch (e) {
      setErrorMsg('Failed to run ideation backlog builder.');
    } finally {
      setIsGeneratingIdeas(false);
    }
  }

  async function handleAdoptIdea(ideaId) {
    setErrorMsg('');
    setNotice(null);
    try {
      const res = await fetch(`/api/v2/youtube-studio/episode-ideas/${ideaId}/adopt`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        // Refresh ideas list and episodes list
        if (selectedSeries) await selectSeries(selectedSeries);
        // Refresh channel episodes list
        const epRes = await fetch(`/api/v2/youtube-studio/episodes?channel_id=${selectedChannel.id}`);
        const epData = await epRes.json();
        if (epData.success) {
          setEpisodes(epData.data);
        }
        triggerNotice('success', 'Episode adopted successfully as Planned!');
      } else {
        setErrorMsg(data.error || 'Failed to adopt idea.');
      }
    } catch (e) {
      setErrorMsg('Adoption request failed.');
    }
  }

  async function handleRejectIdea(ideaId) {
    setErrorMsg('');
    setNotice(null);
    try {
      const res = await fetch(`/api/v2/youtube-studio/episode-ideas/${ideaId}/reject`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        if (selectedSeries) await selectSeries(selectedSeries);
        triggerNotice('success', 'Episode idea rejected and archived.');
      } else {
        setErrorMsg(data.error || 'Failed to reject idea.');
      }
    } catch (e) {
      setErrorMsg('Rejection request failed.');
    }
  }

  async function handleCreateEpisodeManual() {
    if (!newEpisodeTitle || !selectedSeries) return;
    setErrorMsg('');
    setNotice(null);
    try {
      const res = await fetch('/api/v2/youtube-studio/episodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: selectedChannel.id,
          series_id: selectedSeries.id,
          title: newEpisodeTitle,
          locale: selectedChannel.primary_locale
        })
      });
      const data = await res.json();
      if (data.success) {
        setNewEpisodeTitle('');
        // Refresh episodes backlog
        const epRes = await fetch(`/api/v2/youtube-studio/episodes?channel_id=${selectedChannel.id}`);
        const epData = await epRes.json();
        if (epData.success) {
          setEpisodes(epData.data);
        }
        triggerNotice('success', `Manual episode "${newEpisodeTitle}" planned successfully!`);
      } else {
        setErrorMsg(data.error || 'Failed to create episode.');
      }
    } catch (e) {
      setErrorMsg('Failed to manually plan episode.');
    }
  }

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
          {/* Core Positioning */}
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

          {/* Target Audience */}
          {(persona.who || persona.need || persona.geography) && (
            <div className={styles.strategyCard}>
              <h4 className={styles.strategyLabel}>Target Audience & Persona</h4>
              {persona.who && <p className={styles.strategyText}><strong>Target:</strong> {persona.who}</p>}
              {persona.need && <p className={styles.strategyText}><strong>Need:</strong> {persona.need}</p>}
              {persona.geography && <p className={styles.strategyText}><strong>Geography:</strong> {persona.geography}</p>}
            </div>
          )}

          {/* Format & Cadence */}
          <div className={styles.strategyCard}>
            <h4 className={styles.strategyLabel}>Video Format & Cadence</h4>
            <p className={styles.strategyText}><strong>Duration:</strong> {format.target_duration_seconds ? `${Math.floor(format.target_duration_seconds / 60)}m` : 'N/A'} ({format.target_duration_seconds || 0}s)</p>
            <p className={styles.strategyText}><strong>Cadence:</strong> {format.cadence || 'N/A'}</p>
            {config.cta_strategy && <p className={styles.strategyText} style={{ marginTop: '8px' }}><strong>CTA Strategy:</strong> {config.cta_strategy}</p>}
          </div>
        </div>

        {/* Content Pillars */}
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

        {/* Monetization & Guardrails */}
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

        {/* Toggle Raw JSON block */}
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

  // Stepper logic
  let activeStep = 1;
  if (selectedChannel) {
    activeStep = 2;
    if (activeStrategy) {
      activeStep = 3;
      if (selectedSeries) {
        activeStep = 4;
      }
    }
  }

  return (
    <div className={styles.workspace}>
      {/* Title Header */}
      <header className={styles.titleHeader}>
        <h1>YouTube Studio (Editorial Phase)</h1>
        <p>AI strategist copilot & backlog generator.</p>
      </header>

      {/* Dismissible Non-Blocking Notice Region */}
      {notice && (
        <div className={`${styles.statusNotice} ${styles[notice.tone]}`} role="status" aria-live="polite">
          <span>{notice.message}</span>
          <button type="button" className={styles.noticeClose} onClick={() => setNotice(null)} aria-label="Close message">×</button>
        </div>
      )}

      {errorMsg && (
        <div className={`${styles.statusNotice} ${styles.danger}`} role="alert">
          <span><strong>Error:</strong> {errorMsg}</span>
          <button type="button" className={styles.noticeClose} onClick={() => setErrorMsg('')} aria-label="Close message">×</button>
        </div>
      )}

      {/* Step Stepper Navigation */}
      <nav className={styles.stepper} aria-label="Progress Stepper">
        <div className={`${styles.step} ${activeStep === 1 ? styles.stepActive : ''} ${activeStep > 1 ? styles.stepCompleted : ''}`}>
          <span className={styles.stepNumber}>1</span>
          <span>Channel Setup</span>
        </div>
        <div className={styles.stepConnector}></div>
        <div className={`${styles.step} ${activeStep === 2 ? styles.stepActive : ''} ${activeStep > 2 ? styles.stepCompleted : ''}`}>
          <span className={styles.stepNumber}>2</span>
          <span>AI Strategy</span>
        </div>
        <div className={styles.stepConnector}></div>
        <div className={`${styles.step} ${activeStep === 3 ? styles.stepActive : ''} ${activeStep > 3 ? styles.stepCompleted : ''}`}>
          <span className={styles.stepNumber}>3</span>
          <span>Content Series</span>
        </div>
        <div className={styles.stepConnector}></div>
        <div className={`${styles.step} ${activeStep === 4 ? styles.stepActive : ''}`}>
          <span className={styles.stepNumber}>4</span>
          <span>Episode Planning</span>
        </div>
      </nav>

      {/* STEP 1: Channel Switcher & Creation */}
      <section className={styles.workflowStep} aria-labelledby="step-channel-title">
        <div className={styles.stepHeader}>
          <h2 id="step-channel-title">Step 1: Select Channel Profile</h2>
        </div>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="channel-select">SELECT CHANNEL</label>
            <select 
              id="channel-select"
              className={styles.select}
              value={selectedChannel?.id || ''} 
              onChange={(e) => {
                const found = channels.find(c => c.id === e.target.value);
                selectChannel(found);
              }}
            >
              <option value="" disabled={channels.length > 0}>-- Select Channel --</option>
              {channels.map(c => <option key={c.id} value={c.id}>{c.name} ({normalizeLocale(c.primary_locale)})</option>)}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="new-channel-name">ADD NEW CHANNEL</label>
            <div className={styles.buttonRow}>
              <input 
                id="new-channel-name"
                className={styles.input}
                type="text" 
                placeholder="Channel Name" 
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
              />
              <input 
                aria-label="New Channel Locale"
                className={styles.input}
                type="text" 
                placeholder="Locale (e.g. id-ID)" 
                value={newChannelLocale}
                onChange={(e) => setNewChannelLocale(e.target.value)}
                style={{ width: '130px' }}
              />
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={handleCreateChannel}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* STEP 2: Channel AI Strategy */}
      <section className={styles.workflowStep} aria-labelledby="step-strategy-title">
        <div className={styles.stepHeader}>
          <h2 id="step-strategy-title">Step 2: Channel AI Strategy</h2>
          {selectedChannel && (activeStrategy || draftStrategy) && (
            <button 
              type="button"
              className={styles.collapsibleToggle} 
              onClick={() => setShowBriefForm(!showBriefForm)}
            >
              {showBriefForm ? 'Collapse Brief Form' : 'Show/Edit Brief Form'}
            </button>
          )}
        </div>

        {!selectedChannel ? (
          <div className={styles.prereqNotice}>
            Please select or create a Channel in Step 1 to manage its AI Strategy.
          </div>
        ) : (
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

            {/* Display Active Strategy */}
            {activeStrategy && (
              <div className={styles.subSection}>
                <h3 style={{ color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ✓ ACTIVE CHANNEL STRATEGY
                </h3>
                {renderStrategyConfig(activeStrategy.config_json, false)}
              </div>
            )}

            {/* Display Draft Strategy Review */}
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

      {/* STEP 3: Content Series */}
      <section className={styles.workflowStep} aria-labelledby="step-series-title">
        <div className={styles.stepHeader}>
          <h2 id="step-series-title">Step 3: Content Series</h2>
        </div>

        {!selectedChannel ? (
          <div className={styles.prereqNotice}>
            Please select or create a Channel in Step 1.
          </div>
        ) : !activeStrategy ? (
          <div className={styles.prereqNotice}>
            ⚠️ A channel strategy must be active before you can create content series. Please complete Step 2.
          </div>
        ) : (
          <>
            {/* Create Series Form */}
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

            {/* List Series */}
            <div className={styles.seriesGrid}>
              {series.map(s => (
                <div 
                  key={s.id} 
                  onClick={() => selectSeries(s)}
                  className={`${styles.seriesCard} ${selectedSeries?.id === s.id ? styles.seriesCardActive : ''}`}
                >
                  <div className={styles.seriesTitle}>{s.name}</div>
                  {s.pillar && <div className={styles.seriesMeta}>Pillar: {s.pillar}</div>}
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
      </section>

      {/* STEP 4: Episodes & Ideas Backlog */}
      <section className={styles.workflowStep} aria-labelledby="step-episodes-title">
        <div className={styles.stepHeader}>
          <h2 id="step-episodes-title">Step 4: Episode Backlog & Editorial Planning</h2>
        </div>

        {!selectedChannel || !activeStrategy ? (
          <div className={styles.prereqNotice}>
            Please complete Step 1 & 2 before starting episode planning.
          </div>
        ) : !selectedSeries ? (
          <div className={styles.prereqNotice}>
            ⚠️ Please select a Content Series in Step 3 to access backlog ideas and planned episodes.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* Sub-section 1: AI Episode Ideas Backlog */}
            <div className={styles.subSection} style={{ borderTop: 'none', paddingTop: 0 }}>
              <div className={styles.subSectionHeader}>
                <h3>AI Episode Suggestion Backlog: {selectedSeries.name}</h3>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleGenerateEpisodeIdeas} 
                  disabled={isGeneratingIdeas}
                >
                  {isGeneratingIdeas ? '⚡ Generating Backlog...' : 'Suggest Episode Ideas (AI)'}
                </button>
              </div>

              <div className={styles.cardsList}>
                {ideas.map(idea => (
                  <div key={idea.id} className={styles.ideaCard}>
                    <div className={styles.ideaCardInfo}>
                      <h4>{idea.title}</h4>
                      {idea.angle && <p><strong>Angle:</strong> {idea.angle}</p>}
                      {idea.content_promise && <p><strong>Promise:</strong> {idea.content_promise}</p>}
                      {idea.rationale && <p><strong>Rationale:</strong> {idea.rationale}</p>}
                    </div>
                    
                    <div className={styles.ideaActions}>
                      <span className={styles.badge}>{idea.status}</span>
                      {idea.status === 'suggested' && (
                        <div className={styles.buttonRow}>
                          <button 
                            type="button" 
                            className="btn btn-success" 
                            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                            onClick={() => handleAdoptIdea(idea.id)}
                          >
                            Adopt
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                            onClick={() => handleRejectIdea(idea.id)}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {ideas.length === 0 && (
                  <div className={styles.prereqNotice} style={{ borderStyle: 'dashed' }}>
                    No AI suggestions generated yet. Click "Suggest Episode Ideas" to generate.
                  </div>
                )}
              </div>
            </div>

            {/* Sub-section 2: Planned Episodes Backlog */}
            <div className={styles.subSection}>
              <div className={styles.subSectionHeader}>
                <h3>Planned Episodes Backlog</h3>
                <div className={styles.buttonRow}>
                  <input 
                    aria-label="Manual Episode Title"
                    className={styles.input}
                    type="text" 
                    placeholder="Manual Episode Title" 
                    value={newEpisodeTitle}
                    onChange={(e) => setNewEpisodeTitle(e.target.value)}
                  />
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={handleCreateEpisodeManual}
                  >
                    Plan Episode
                  </button>
                </div>
              </div>

              <div className={styles.cardsList}>
                {episodes.map(ep => (
                  <div 
                    key={ep.id} 
                    onClick={() => setSelectedEpisode(ep)}
                    className={`${styles.episodeCard} ${selectedEpisode?.id === ep.id ? styles.episodeCardActive : ''}`}
                  >
                    <div className={styles.episodeInfo}>
                      <h4>{ep.title}</h4>
                      <div className={styles.episodeMeta}>
                        <span>Locale: {normalizeLocale(ep.locale)}</span>
                        <span>Duration: {ep.target_duration_seconds}s</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                      <span className={styles.badge} style={{ background: 'var(--status-success-soft)', color: 'var(--status-success)' }}>
                        {ep.status}
                      </span>
                      {ep.source_idea_id && <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Adopted from Idea</span>}
                    </div>
                  </div>
                ))}

                {episodes.length === 0 && (
                  <div className={styles.prereqNotice} style={{ borderStyle: 'dashed' }}>
                    No planned episodes backlog found. Adopt suggestions or add manually.
                  </div>
                )}
              </div>

              {selectedEpisode && (
                <div className={styles.subSection}>
                  <h3>Episode Detail View (Read-Only)</h3>
                  <div className={styles.detailPanel}>
                    <pre>{JSON.stringify(selectedEpisode, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </section>
    </div>
  );
}
