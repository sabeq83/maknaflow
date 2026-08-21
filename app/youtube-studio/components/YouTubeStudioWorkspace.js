'use client';

import { useState, useEffect } from 'react';
import { normalizeLocale } from '@/lib/youtube-studio-contract';

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
  const [strategyTab, setStrategyTab] = useState('view'); // 'view' or 'brief'
  const [isGeneratingStrategy, setIsGeneratingStrategy] = useState(false);
  const [isRefiningStrategy, setIsRefiningStrategy] = useState(false);
  const [isActivatingStrategy, setIsActivatingStrategy] = useState(false);

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
  const [activeTab, setActiveTab] = useState('strategy'); // 'strategy' | 'series' | 'ideas' | 'episodes'
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelLocale, setNewChannelLocale] = useState('id-ID');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchChannels();
    fetchBriefPresets();
  }, []);

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
          selectSeries(seriesData.data[0]);
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
    }
  }

  async function handleCreateChannel() {
    if (!newChannelName) return;
    try {
      const res = await fetch('/api/v2/youtube-studio/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newChannelName, primary_locale: newChannelLocale })
      });
      const data = await res.json();
      if (data.success) {
        setNewChannelName('');
        // Re-load channels and select the newly created one
        const reRes = await fetch('/api/v2/youtube-studio/channels');
        const reData = await reRes.json();
        if (reData.success && reData.data) {
          setChannels(reData.data);
          const newlyCreated = reData.data.find(c => c.name === newChannelName) || reData.data[reData.data.length - 1];
          selectChannel(newlyCreated);
        }
      }
    } catch (e) {
      setErrorMsg('Failed to create channel.');
    }
  }

  async function handleGenerateStrategy() {
    setErrorMsg('');
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
        setStrategyTab('view');
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
        alert('Draft strategy saved successfully!');
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
    setIsActivatingStrategy(true);
    try {
      const res = await fetch(`/api/v2/youtube-studio/channels/${selectedChannel.id}/strategy/activate`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setActiveStrategy(data.data);
        setDraftStrategy(null);
        alert('Channel strategy has been successfully activated!');
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

    try {
      const res = await fetch(`/api/v2/youtube-studio/series/${item.id}/ideas`);
      const data = await res.json();
      if (data.success) {
        setIdeas(data.data);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleCreateSeries() {
    if (!newSeriesName || !selectedChannel) return;
    setErrorMsg('');
    try {
      const res = await fetch(`/api/v2/youtube-studio/channels/${selectedChannel.id}/series`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSeriesName, pillar: newSeriesPillar })
      });
      const data = await res.json();
      if (data.success) {
        setNewSeriesName('');
        setNewSeriesPillar('');
        selectChannel(selectedChannel);
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
    setIsGeneratingIdeas(true);
    try {
      const res = await fetch(`/api/v2/youtube-studio/series/${selectedSeries.id}/ideas/generate`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setIdeas(data.data);
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
    try {
      const res = await fetch(`/api/v2/youtube-studio/episode-ideas/${ideaId}/adopt`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        // Refresh ideas list and episodes backlog
        selectSeries(selectedSeries);
        selectChannel(selectedChannel);
        alert('Episode adopted successfully as Planned!');
      } else {
        setErrorMsg(data.error || 'Failed to adopt idea.');
      }
    } catch (e) {
      setErrorMsg('Adoption request failed.');
    }
  }

  async function handleRejectIdea(ideaId) {
    setErrorMsg('');
    try {
      const res = await fetch(`/api/v2/youtube-studio/episode-ideas/${ideaId}/reject`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        selectSeries(selectedSeries);
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
        selectChannel(selectedChannel);
        alert('Manual episode planned successfully!');
      } else {
        setErrorMsg(data.error || 'Failed to create episode.');
      }
    } catch (e) {
      setErrorMsg('Failed to manually plan episode.');
    }
  }

  return (
    <div style={{ maxWidth: '1380px', margin: '0 auto', fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, margin: 0 }}>YouTube Studio (Editorial Phase)</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>
            AI strategist copilot & backlog generator.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', borderRadius: '8px', color: '#f87171', marginBottom: '20px', fontSize: '13px' }}>
          <strong>Error:</strong> {errorMsg}
        </div>
      )}

      {/* Row 1: Channel Switcher and Creation */}
      <div style={{
        background: 'var(--bg-card)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)',
        display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>SELECT CHANNEL</label>
          <select 
            value={selectedChannel?.id || ''} 
            onChange={(e) => selectChannel(channels.find(c => c.id === e.target.value))}
            style={{ padding: '10px 16px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', width: '220px' }}
          >
            {channels.map(c => <option key={c.id} value={c.id}>{c.name} ({normalizeLocale(c.primary_locale)})</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>ADD NEW CHANNEL</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="Channel Name" 
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            />
            <input 
              type="text" 
              placeholder="Locale (e.g. id-ID)" 
              value={newChannelLocale}
              onChange={(e) => setNewChannelLocale(e.target.value)}
              style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', width: '150px' }}
            />
            <button onClick={handleCreateChannel} style={{ padding: '10px 20px', background: 'var(--link)', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
              Create
            </button>
          </div>
        </div>
      </div>

      {selectedChannel ? (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
          
          {/* Left Panel: Content Series List */}
          <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '8px', margin: '0 0 12px 0' }}>CONTENT SERIES</h3>
              
              {activeStrategy ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  <input 
                    type="text" 
                    placeholder="Series Name" 
                    value={newSeriesName}
                    onChange={(e) => setNewSeriesName(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '12px' }}
                  />
                  <input 
                    type="text" 
                    placeholder="Pillar Name (Optional)" 
                    value={newSeriesPillar}
                    onChange={(e) => setNewSeriesPillar(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '12px' }}
                  />
                  <button onClick={handleCreateSeries} style={{ padding: '8px 12px', background: 'var(--link)', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                    Create Series
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '10px', borderRadius: '8px', marginBottom: '16px' }}>
                  ⚠️ Strategy must be activated before creating a Content Series.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {series.map(s => (
                  <div 
                    key={s.id} 
                    onClick={() => selectSeries(s)}
                    style={{
                      padding: '12px', borderRadius: '8px', border: '1px solid var(--border)',
                      background: selectedSeries?.id === s.id ? 'var(--accent-glow)' : 'var(--bg-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 700 }}>{s.name}</div>
                    {s.pillar && <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Pillar: {s.pillar}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel: Workflow Tabs */}
          <div>
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
              {['strategy', 'ideas', 'episodes'].map(tab => (
                <button 
                  key={tab} 
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '10px 20px', border: 'none', background: 'transparent',
                    borderBottom: activeTab === tab ? '3px solid var(--link)' : 'none',
                    color: activeTab === tab ? 'var(--link)' : 'var(--text-muted)',
                    cursor: 'pointer', fontWeight: 700, textTransform: 'uppercase', fontSize: '12px'
                  }}
                >
                  {tab === 'strategy' ? 'Channel Strategy' : tab === 'ideas' ? 'Backlog Ideas' : 'Planned Episodes'}
                </button>
              ))}
            </div>

            {/* TAB 1: Channel Strategy */}
            {activeTab === 'strategy' && (
              <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                  <button onClick={() => setStrategyTab('view')} style={{ padding: '6px 12px', borderRadius: '4px', background: strategyTab === 'view' ? 'var(--link)' : 'var(--bg-secondary)', color: strategyTab === 'view' ? '#fff' : 'var(--text-primary)', border: 'none', cursor: 'pointer', fontSize: '12px' }}>View Strategy</button>
                  <button onClick={() => setStrategyTab('brief')} style={{ padding: '6px 12px', borderRadius: '4px', background: strategyTab === 'brief' ? 'var(--link)' : 'var(--bg-secondary)', color: strategyTab === 'brief' ? '#fff' : 'var(--text-primary)', border: 'none', cursor: 'pointer', fontSize: '12px' }}>Brief & AI Assistant</button>
                </div>

                {strategyTab === 'brief' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3>Channel Strategy Brief</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 700 }}>NICHE / TOPIC</label>
                        <input type="text" value={brief.niche} onChange={(e) => setBrief({ ...brief, niche: e.target.value })} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} placeholder="e.g. AI Automation for Developers" />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 700 }}>TARGET AUDIENCE</label>
                        <input type="text" value={brief.audience} onChange={(e) => setBrief({ ...brief, audience: e.target.value })} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} placeholder="e.g. Tech professionals and programmers" />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 700 }}>GEOGRAPHY</label>
                        <input type="text" value={brief.geography} onChange={(e) => setBrief({ ...brief, geography: e.target.value })} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} placeholder="e.g. Indonesia, Southeast Asia" />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 700 }}>OBJECTIVE</label>
                        <select value={brief.objective} onChange={(e) => setBrief({ ...brief, objective: e.target.value })} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                          <option value="AdSense">AdSense Revenue</option>
                          <option value="Affiliate">Affiliate Sales</option>
                          <option value="Leads">Leads & Digital Products</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 700 }}>OPTIONAL UNIVERSE CONTEXT</label>
                        <select value={brief.universe_id} onChange={(e) => setBrief({ ...brief, universe_id: e.target.value })} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                          <option value="">None Selected</option>
                          {universes.map(u => <option key={u.id} value={u.id}>{u.name || u.title}</option>)}
                        </select>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 700 }}>OPTIONAL VISUAL IDENTITY CONTEXT</label>
                        <select value={brief.visual_identity_preset_id} onChange={(e) => setBrief({ ...brief, visual_identity_preset_id: e.target.value })} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                          <option value="">None Selected</option>
                          {visualIdentities.map(vi => <option key={vi.id} value={vi.id}>{vi.name || vi.brand_name}</option>)}
                        </select>
                      </div>
                    </div>

                    <button onClick={handleGenerateStrategy} disabled={isGeneratingStrategy} style={{ padding: '12px 24px', background: 'var(--link)', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
                      {isGeneratingStrategy ? '⚡ Generating Draft...' : '🚀 Generate Strategy Draft (AI)'}
                    </button>
                  </div>
                )}

                {strategyTab === 'view' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                      <h4 style={{ margin: '0 0 8px 0', color: 'var(--status-success)', fontSize: '14px' }}>✓ ACTIVE CHANNEL STRATEGY</h4>
                      {activeStrategy ? (
                        <pre style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '12px', overflowX: 'auto' }}>
                          {JSON.stringify(activeStrategy.config_json, null, 2)}
                        </pre>
                      ) : (
                        <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-muted)' }}>
                          No active strategy configuration found for this channel.
                        </div>
                      )}
                    </div>

                    {draftStrategy && (
                      <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '20px' }}>
                        <h4 style={{ margin: '0 0 8px 0', color: 'var(--link)', fontSize: '14px' }}>✏️ STRATEGY DRAFT (REVIEW REQUIRED)</h4>
                        
                        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                          <button onClick={handleActivateStrategy} disabled={isActivatingStrategy} style={{ padding: '10px 20px', background: 'var(--status-success)', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
                            {isActivatingStrategy ? 'Activating...' : 'Activate Strategy'}
                          </button>
                        </div>

                        <pre style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '12px', overflowX: 'auto', marginBottom: '16px' }}>
                          {JSON.stringify(draftStrategy.config_json, null, 2)}
                        </pre>

                        <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <h5 style={{ margin: 0, fontSize: '12px' }}>AI Refinement Copilot</h5>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input 
                              type="text" 
                              placeholder="e.g. Focus more on web security content pillars" 
                              value={refineInstruction}
                              onChange={(e) => setRefineInstruction(e.target.value)}
                              style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                            />
                            <button onClick={handleRefineStrategy} disabled={isRefiningStrategy} style={{ padding: '8px 16px', background: 'var(--link)', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
                              {isRefiningStrategy ? 'Refining...' : 'Refine'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Backlog Ideas */}
            {activeTab === 'ideas' && (
              <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                {selectedSeries ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <h3 style={{ margin: 0 }}>Backlog Ideas: {selectedSeries.name}</h3>
                      <button onClick={handleGenerateEpisodeIdeas} disabled={isGeneratingIdeas} style={{ padding: '10px 20px', background: 'var(--link)', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
                        {isGeneratingIdeas ? '⚡ Generating Backlog...' : 'Suggest Episode Ideas (AI)'}
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {ideas.map(idea => (
                        <div key={idea.id} style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                          <div style={{ flex: 1 }}>
                            <h4 style={{ margin: '0 0 4px 0', fontSize: '13px' }}>{idea.title}</h4>
                            {idea.angle && <p style={{ margin: '4px 0', fontSize: '12px', color: 'var(--text-muted)' }}><strong>Angle:</strong> {idea.angle}</p>}
                            {idea.content_promise && <p style={{ margin: '4px 0', fontSize: '12px', color: 'var(--text-muted)' }}><strong>Promise:</strong> {idea.content_promise}</p>}
                            {idea.rationale && <p style={{ margin: '4px 0', fontSize: '12px', color: 'var(--text-muted)' }}><strong>Rationale:</strong> {idea.rationale}</p>}
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '120px' }}>
                            <span style={{ alignSelf: 'flex-end', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(6, 182, 212, 0.2)', color: 'var(--link)' }}>{idea.status}</span>
                            {idea.status === 'suggested' && (
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button onClick={() => handleAdoptIdea(idea.id)} style={{ padding: '6px 10px', background: 'var(--status-success)', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>Adopt</button>
                                <button onClick={() => handleRejectIdea(idea.id)} style={{ padding: '6px 10px', background: 'var(--border)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>Reject</button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {ideas.length === 0 && (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No ideas generated yet. Click the button above to draft.</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Please select a content series on the left sidebar to access backlog ideas.</div>
                )}
              </div>
            )}

            {/* TAB 3: Planned Episodes */}
            {activeTab === 'episodes' && (
              <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                  <h3 style={{ margin: 0 }}>Planned Episodes Backlog</h3>
                  {selectedSeries ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="text" 
                        placeholder="Manual Episode Title" 
                        value={newEpisodeTitle}
                        onChange={(e) => setNewEpisodeTitle(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '12px', width: '220px' }}
                      />
                      <button onClick={handleCreateEpisodeManual} style={{ padding: '8px 12px', background: 'var(--link)', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                        Create Manual Episode
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Select series to add episode manually</span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {episodes.map(ep => (
                    <div 
                      key={ep.id} 
                      onClick={() => setSelectedEpisode(ep)}
                      style={{
                        padding: '16px', borderRadius: '12px', border: '1px solid var(--border)',
                        background: selectedEpisode?.id === ep.id ? 'var(--accent-glow)' : 'var(--bg-secondary)',
                        cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}
                    >
                      <div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '13px' }}>{ep.title}</h4>
                        <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          <span>Locale: {normalizeLocale(ep.locale)}</span>
                          <span>Duration: {ep.target_duration_seconds}s</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(6, 182, 212, 0.2)', color: 'var(--link)', fontWeight: 700 }}>{ep.status}</span>
                        {ep.source_idea_id && <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Adopted from Idea</span>}
                      </div>
                    </div>
                  ))}

                  {episodes.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No planned episodes backlog found. Adopt ideas or add manually.</div>
                  )}
                </div>

                {selectedEpisode && (
                  <div style={{ borderTop: '1px solid var(--border)', marginTop: '20px', paddingTop: '20px' }}>
                    <h4>Episode Detail View (Read-Only)</h4>
                    <pre style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '12px' }}>
                      {JSON.stringify(selectedEpisode, null, 2)}
                    </pre>
                  </div>
                )}

              </div>
            )}

          </div>

        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', padding: '40px', borderRadius: '16px', border: '1px solid var(--border)', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>No channels configured. Please add a new channel to start strategy composition.</p>
        </div>
      )}
    </div>
  );
}
