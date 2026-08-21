'use client';

import { useState, useEffect, useRef } from 'react';

export function YouTubeStudioWorkspace() {
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [strategy, setStrategy] = useState(null);
  const [series, setSeries] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [activeTab, setActiveTab] = useState('strategy');
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelLocale, setNewChannelLocale] = useState('id-ID');
  
  // Planners
  const [blueprint, setBlueprint] = useState(null);
  const [latestScript, setLatestScript] = useState(null);
  const [newEpisodeTitle, setNewEpisodeTitle] = useState('');
  const [selectedSeriesId, setSelectedSeriesId] = useState('');
  
  // Production / Render
  const [renderJob, setRenderJob] = useState(null);
  const [isRendering, setIsRendering] = useState(false);
  const pollIntervalRef = useRef(null);

  // Publishing
  const [pubPackage, setPubPackage] = useState({ title: '', description: '', chapters: [], upload_privacy: 'private' });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // Shorts Derivative
  const [derivatives, setDerivatives] = useState([]);
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(30000);

  useEffect(() => {
    fetchChannels();
  }, []);

  useEffect(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  }, []);

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
      console.error(e);
    }
  }

  async function selectChannel(channel) {
    setSelectedChannel(channel);
    setSelectedEpisode(null);
    setBlueprint(null);
    setLatestScript(null);
    setRenderJob(null);
    setUploadResult(null);

    try {
      // 1. Get channel strategy
      const stratRes = await fetch(`/api/v2/youtube-studio/channels/${channel.id}`);
      const stratData = await stratRes.json();
      if (stratData.success) {
        setStrategy(stratData.strategy);
      }

      // 2. Get series
      const seriesRes = await fetch(`/api/v2/youtube-studio/channels/${channel.id}/series`);
      const seriesData = await seriesRes.json();
      if (seriesData.success) {
        setSeries(seriesData.data);
        if (seriesData.data.length > 0) {
          setSelectedSeriesId(seriesData.data[0].id);
        }
      }

      // 3. Get episodes
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
        fetchChannels();
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleCreateEpisode() {
    if (!newEpisodeTitle || !selectedSeriesId || !strategy) return;
    try {
      const res = await fetch('/api/v2/youtube-studio/episodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: selectedChannel.id,
          series_id: selectedSeriesId,
          strategy_id: strategy.id,
          title: newEpisodeTitle,
          locale: selectedChannel.primary_locale
        })
      });
      const data = await res.json();
      if (data.success) {
        setNewEpisodeTitle('');
        selectChannel(selectedChannel);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function selectEpisode(episode) {
    setSelectedEpisode(episode);
    setBlueprint(null);
    setLatestScript(null);
    setRenderJob(null);
    setUploadResult(null);

    try {
      // Fetch latest blueprint
      const bpRes = await fetch(`/api/v2/youtube-studio/episodes/${episode.id}/blueprint/generate`, { method: 'POST' });
      const bpData = await bpRes.json();
      if (bpData.success) {
        setBlueprint(bpData.data);
      }

      // Fetch latest script
      const scRes = await fetch(`/api/v2/youtube-studio/episodes/${episode.id}/scripts/generate`, { method: 'POST' });
      const scData = await scRes.json();
      if (scData.success) {
        setLatestScript(scData.data);
      }

      // Fetch publishing details
      const pubRes = await fetch(`/api/v2/youtube-studio/episodes/${episode.id}/publishing`);
      const pubData = await pubRes.json();
      if (pubData.success && pubData.data) {
        setPubPackage(pubData.data);
      } else {
        setPubPackage({ title: episode.title, description: 'Created using MAKNA Flow YouTube Studio MVP', chapters: [], upload_privacy: 'private' });
      }

      // Fetch derivatives
      const derRes = await fetch(`/api/v2/youtube-studio/episodes/${episode.id}/derivatives`);
      const derData = await derRes.json();
      if (derData.success) {
        setDerivatives(derData.data);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleApproveScript() {
    if (!latestScript) return;
    try {
      const res = await fetch(`/api/v2/youtube-studio/scripts/${latestScript.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_note: 'Approved for production' })
      });
      const data = await res.json();
      if (data.success) {
        selectEpisode({ ...selectedEpisode, status: 'Script Approved' });
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleRunProduction() {
    if (!selectedEpisode) return;
    try {
      setIsRendering(true);
      const res = await fetch(`/api/v2/youtube-studio/episodes/${selectedEpisode.id}/run`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.data) {
        setRenderJob(data.data);
        startPollingRenderJob(data.data.id);
      }
    } catch (e) {
      console.error(e);
    }
  }

  function startPollingRenderJob(jobId) {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/v2/youtube-studio/render-jobs/${jobId}`);
        const data = await res.json();
        if (data.success && data.data) {
          setRenderJob(data.data);
          if (data.data.status === 'succeeded' || data.data.status === 'failed') {
            clearInterval(pollIntervalRef.current);
            setIsRendering(false);
            selectEpisode({ ...selectedEpisode, status: data.data.status === 'succeeded' ? 'Ready to Publish' : 'Idea' });
          }
        }
      } catch (e) {
        console.error(e);
        clearInterval(pollIntervalRef.current);
        setIsRendering(false);
      }
    }, 4000);
  }

  async function handleSavePublishing() {
    if (!selectedEpisode) return;
    try {
      await fetch(`/api/v2/youtube-studio/episodes/${selectedEpisode.id}/publishing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pubPackage)
      });
      alert('Publishing package saved successfully!');
    } catch (e) {
      console.error(e);
    }
  }

  async function handleUploadDraft() {
    if (!selectedEpisode) return;
    try {
      setIsUploading(true);
      const res = await fetch(`/api/v2/youtube-studio/publishing/${selectedEpisode.id}/upload`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.data) {
        setUploadResult(data.data);
        selectEpisode({ ...selectedEpisode, status: 'Uploaded' });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleCreateDerivative() {
    if (!selectedEpisode) return;
    try {
      const res = await fetch(`/api/v2/youtube-studio/episodes/${selectedEpisode.id}/derivatives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_ms: Number(startMs), end_ms: Number(endMs), metadata: { title: `Shorts Cut of ${selectedEpisode.title}` } })
      });
      const data = await res.json();
      if (data.success) {
        // Refresh derivatives list
        const derRes = await fetch(`/api/v2/youtube-studio/episodes/${selectedEpisode.id}/derivatives`);
        const derData = await derRes.json();
        if (derData.success) {
          setDerivatives(derData.data);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div style={{ maxWidth: '1380px', margin: '0 auto', fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, margin: 0 }}>YouTube Studio (MVP)</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>
            Isolated SaaS Multi-Channel operating system.
          </p>
        </div>
      </div>

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
            {channels.map(c => <option key={c.id} value={c.id}>{c.name} (@{c.channel_handle || 'no-handle'})</option>)}
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
            <select 
              value={newChannelLocale}
              onChange={(e) => setNewChannelLocale(e.target.value)}
              style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            >
              <option value="id-ID">id-ID (Indonesian)</option>
              <option value="en-US">en-US (English)</option>
            </select>
            <button onClick={handleCreateChannel} style={{ padding: '10px 20px', background: 'var(--link)', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
              Create
            </button>
          </div>
        </div>
      </div>

      {selectedChannel ? (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
          
          {/* Sidebar Left: Series & Episodes list */}
          <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '8px', margin: '0 0 12px 0' }}>EPISODE PLANNER</h3>
              
              {/* Create Episode form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                <input 
                  type="text" 
                  placeholder="New Episode Title" 
                  value={newEpisodeTitle}
                  onChange={(e) => setNewEpisodeTitle(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '12px' }}
                />
                <select 
                  value={selectedSeriesId} 
                  onChange={(e) => setSelectedSeriesId(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '12px' }}
                >
                  {series.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button onClick={handleCreateEpisode} style={{ padding: '8px 12px', background: 'var(--link)', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                  Add Episode
                </button>
              </div>

              {/* Episodes backlog */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {episodes.map(e => (
                  <div 
                    key={e.id} 
                    onClick={() => selectEpisode(e)}
                    style={{
                      padding: '12px', borderRadius: '8px', border: '1px solid var(--border)',
                      background: selectedEpisode?.id === e.id ? 'var(--accent-glow)' : 'var(--bg-secondary)',
                      cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 700 }}>{e.title}</span>
                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(6, 182, 212, 0.2)', color: 'var(--link)' }}>{e.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Area: Workspace Tab content */}
          <div>
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
              {['strategy', 'editorial', 'production', 'publishing', 'derivatives'].map(tab => (
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
                  {tab}
                </button>
              ))}
            </div>

            {selectedEpisode ? (
              <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>{selectedEpisode.title}</h2>
                  <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', background: 'rgba(6, 182, 212, 0.2)', color: 'var(--link)', fontWeight: 700 }}>{selectedEpisode.status}</span>
                </div>

                {activeTab === 'strategy' && (
                  <div>
                    <h3>Channel Strategy Blueprint</h3>
                    <pre style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', overflowX: 'auto', border: '1px solid var(--border)', fontSize: '12px' }}>
                      {JSON.stringify(strategy, null, 2)}
                    </pre>
                  </div>
                )}

                {activeTab === 'editorial' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                      <h3>1. Episode Blueprint</h3>
                      <pre style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(blueprint?.content_json, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <h3>2. Episode VO Script</h3>
                      <pre style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '12px', whiteSpace: 'pre-wrap', marginBottom: '12px' }}>
                        {JSON.stringify(latestScript?.script_json, null, 2)}
                      </pre>
                      
                      {latestScript?.status === 'draft' && (
                        <button onClick={handleApproveScript} style={{ padding: '10px 20px', background: 'var(--status-success)', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
                          ✓ Approve Script for Production
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'production' && (
                  <div>
                    <h3>Faceless Production Factory</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Enqueues render jobs using FFMPEG muxer and matches audio VO clip tracks.</p>
                    
                    {selectedEpisode.status === 'Script Approved' && (
                      <button onClick={handleRunProduction} disabled={isRendering} style={{ padding: '12px 24px', background: 'var(--link)', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
                        {isRendering ? '⚡ Enqueuing job...' : '🎬 Run Render Assembly'}
                      </button>
                    )}

                    {renderJob && (
                      <div style={{ marginTop: '20px', padding: '16px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span>Render Progress</span>
                          <strong>{renderJob.progress}% ({renderJob.status})</strong>
                        </div>
                        <div style={{ height: '8px', width: '100%', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${renderJob.progress}%`, background: 'var(--link)', transition: 'width 0.4s ease' }} />
                        </div>
                        {renderJob.output_asset_json && renderJob.output_asset_json.videoAsset && (
                          <div style={{ marginTop: '20px' }}>
                            <h4>Render Succeeded Video Preview:</h4>
                            <video src={renderJob.output_asset_json.videoAsset} controls style={{ width: '100%', borderRadius: '12px', border: '1px solid var(--border)' }} />
                            <div style={{ marginTop: '12px' }}>
                              <a href={renderJob.output_asset_json.videoAsset} download style={{ color: 'var(--link)', textDecoration: 'none', fontWeight: 700, marginRight: '16px' }}>📥 Download MP4</a>
                              <a href={renderJob.output_asset_json.subtitleAsset} download style={{ color: 'var(--link)', textDecoration: 'none', fontWeight: 700 }}>📄 Download SRT Subtitles</a>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'publishing' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <h3>YouTube Publishing Package</h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label>Title</label>
                      <input 
                        type="text" 
                        value={pubPackage.title} 
                        onChange={(e) => setPubPackage({ ...pubPackage, title: e.target.value })}
                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label>Description</label>
                      <textarea 
                        rows={6}
                        value={pubPackage.description} 
                        onChange={(e) => setPubPackage({ ...pubPackage, description: e.target.value })}
                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '16px' }}>
                      <button onClick={handleSavePublishing} style={{ padding: '10px 20px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
                        Save Package Settings
                      </button>
                      <button onClick={handleUploadDraft} disabled={isUploading} style={{ padding: '10px 20px', background: 'var(--link)', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
                        {isUploading ? '⚡ Uploading draft...' : '🚀 Publish Private Draft to YouTube'}
                      </button>
                    </div>

                    {uploadResult && (
                      <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid var(--status-success)', borderRadius: '12px', marginTop: '16px' }}>
                        <h4>✓ Video Draft Uploaded successfully!</h4>
                        <p style={{ fontSize: '13px' }}>YouTube Video ID: <strong>{uploadResult.videoId}</strong></p>
                        <a href={uploadResult.studioUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--link)', fontWeight: 700 }}>Open in YouTube Studio ↗</a>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'derivatives' && (
                  <div>
                    <h3>Create Shorts Derivative Clip</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Select timestamp boundaries to bridge this episode to vertical Short-form workflow.</p>
                    
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label>Start (ms)</label>
                        <input type="number" value={startMs} onChange={(e) => setStartMs(e.target.value)} style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label>End (ms)</label>
                        <input type="number" value={endMs} onChange={(e) => setEndMs(e.target.value)} style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                      </div>
                      <button onClick={handleCreateDerivative} style={{ alignSelf: 'flex-end', padding: '10px 20px', background: 'var(--link)', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
                        Create Clip
                      </button>
                    </div>

                    <h4>Clips History:</h4>
                    <ul>
                      {derivatives.map(d => (
                        <li key={d.id} style={{ fontSize: '13px', margin: '4px 0' }}>
                          Derivative ID: <strong>{d.id}</strong> (Range: {d.start_ms}ms - {d.end_ms}ms)
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              </div>
            ) : (
              <div style={{ background: 'var(--bg-card)', padding: '40px', borderRadius: '16px', border: '1px solid var(--border)', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)' }}>Select an episode from the backlog planner list to view options.</p>
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
