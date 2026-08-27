'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { normalizeLocale } from '@/lib/youtube-studio-contract';
import { resolveEpisodeStages } from '@/lib/youtube-studio-workspace-state';

import { YouTubeStudioShell } from './YouTubeStudioShell';
import { ChannelsView } from './ChannelsView';
import { ChannelDetailView } from './ChannelDetailView';
import { SeriesDetailView } from './SeriesDetailView';
import { EpisodeWorkspace } from './EpisodeWorkspace';
import { ProductionQueue } from './ProductionQueue';
import { PublishingHub } from './PublishingHub';
import { AnalyticsPlaceholder } from './AnalyticsPlaceholder';

import styles from './YouTubeStudioWorkspace.module.css';

export function YouTubeStudioWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const view = searchParams.get('view') || 'channels';
  const stage = searchParams.get('stage') || 'research';

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
    forbidden_claims: '',
    default_target_duration_seconds: 600
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

  // Phase 2 Editorial States
  const [selectedEpisodeResearch, setSelectedEpisodeResearch] = useState(null);
  const [selectedEpisodeBlueprint, setSelectedEpisodeBlueprint] = useState(null);
  const [selectedEpisodeScript, setSelectedEpisodeScript] = useState(null);
  const [isGeneratingResearch, setIsGeneratingResearch] = useState(false);
  const [isGeneratingBlueprint, setIsGeneratingBlueprint] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isApprovingBlueprint, setIsApprovingBlueprint] = useState(false);
  const [isApprovingScript, setIsApprovingScript] = useState(false);

  // Step 3 AI Suggestions
  const [seriesSuggestions, setSeriesSuggestions] = useState([]);
  const [isGeneratingSeriesSuggestions, setIsGeneratingSeriesSuggestions] = useState(false);

  // Phase 2.5 Duration & Profiles States
  const [newSeriesDurationMode, setNewSeriesDurationMode] = useState('inherit');
  const [newSeriesDuration, setNewSeriesDuration] = useState(600);
  const [overrideEpDuration, setOverrideEpDuration] = useState('');
  const [profilesList, setProfilesList] = useState([]);
  const [selectedProfileKey, setSelectedProfileKey] = useState('');

  // Phase 3 Production Factory States
  const [activePackage, setActivePackage] = useState(null);
  const [packageAssets, setPackageAssets] = useState([]);
  const [assemblyJob, setAssemblyJob] = useState(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isApprovingPlan, setIsApprovingPlan] = useState(false);
  const [isRenderingFinal, setIsRenderingFinal] = useState(false);
  const [isTriggeringAssembly, setIsTriggeringAssembly] = useState(false);

  // Phase 3.5A KB Foundation States
  const [kbItems, setKbItems] = useState([]);
  const [kbLoading, setKbLoading] = useState(false);
  const [kbSelectedId, setKbSelectedId] = useState(null);
  const [kbRevisions, setKbRevisions] = useState([]);
  const [kbShowCreate, setKbShowCreate] = useState(false);
  const [kbCreateType, setKbCreateType] = useState('channel_profile');
  const [kbCreateTitle, setKbCreateTitle] = useState('');
  const [kbCreateScope, setKbCreateScope] = useState('channel');
  const [kbCreateBrief, setKbCreateBrief] = useState('');
  const [kbIsGenerating, setKbIsGenerating] = useState(false);
  const [kbBindings, setKbBindings] = useState([]);
  const [kbUploadMode, setKbUploadMode] = useState('ai'); // 'ai' or 'upload'
  const [kbUploadFile, setKbUploadFile] = useState(null);
  const [kbIsUploading, setKbIsUploading] = useState(false);

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

  // Navigation helper
  function navigate(viewName, chId = null, serId = null, epId = null, stgKey = null) {
    const params = new URLSearchParams();
    params.set('view', viewName);
    if (chId) params.set('channel', chId);
    if (serId) params.set('series', serId);
    if (epId) params.set('episode', epId);
    if (stgKey) params.set('stage', stgKey);
    router.push(`/youtube-studio?${params.toString()}`);
  }

  // URL state synchronization
  useEffect(() => {
    if (channels.length === 0) return;

    const urlView = searchParams.get('view') || 'channels';
    const urlChannelId = searchParams.get('channel');
    const urlSeriesId = searchParams.get('series');
    const urlEpisodeId = searchParams.get('episode');

    // 1. Sync Channel selection
    if (urlChannelId) {
      if (!selectedChannel || selectedChannel.id !== urlChannelId) {
        const foundCh = channels.find(c => c.id === urlChannelId);
        if (foundCh) {
          selectChannel(foundCh);
        }
      }
    } else {
      if (selectedChannel) {
        setSelectedChannel(null);
        setSeries([]);
        setSelectedSeries(null);
        setEpisodes([]);
        setSelectedEpisode(null);
        setActiveStrategy(null);
        setDraftStrategy(null);
      }
    }

    // 2. Sync Series selection
    if (urlSeriesId) {
      if (series.length > 0) {
        if (!selectedSeries || selectedSeries.id !== urlSeriesId) {
          const foundSer = series.find(s => s.id === urlSeriesId);
          if (foundSer) {
            selectSeries(foundSer);
          }
        }
      }
    } else {
      if (selectedSeries) {
        setSelectedSeries(null);
        setIdeas([]);
      }
    }

    // 3. Sync Episode selection
    if (urlEpisodeId) {
      if (episodes.length > 0) {
        if (!selectedEpisode || selectedEpisode.id !== urlEpisodeId) {
          const foundEp = episodes.find(e => e.id === urlEpisodeId);
          if (foundEp) {
            setSelectedEpisode(foundEp);
          }
        }
      }
    } else {
      if (selectedEpisode) {
        setSelectedEpisode(null);
      }
    }
  }, [searchParams, channels, series, episodes]);

  async function fetchBriefPresets() {
    try {
      const uRes = await fetch('/api/v2/universe-profiles');
      const uData = await uRes.json();
      if (uData.success) setUniverses(uData.data || []);

      const viRes = await fetch('/api/v2/visual-identities');
      const viData = await viRes.json();
      if (viData.success) setVisualIdentities(viData.data || []);

      const pRes = await fetch('/api/v2/youtube-studio/generation-profiles');
      const pData = await pRes.json();
      if (pData.success) setProfilesList(pData.data || []);
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
      }
    } catch (e) {
      setErrorMsg('Failed to load channels.');
    }
  }

  async function refreshEpisodesList() {
    if (!selectedChannel) return;
    try {
      const epRes = await fetch(`/api/v2/youtube-studio/episodes?channel_id=${selectedChannel.id}`);
      const epData = await epRes.json();
      if (epData.success) {
        setEpisodes(epData.data);
      }
    } catch (e) {
      console.error('Failed to refresh episodes list', e);
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
        setChannels(current => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
        triggerNotice('success', `Channel "${created.name}" created!`);
        navigate('channel', created.id);
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
        body: JSON.stringify({ 
          name: newSeriesName, 
          pillar: newSeriesPillar,
          config: {
            duration_mode: newSeriesDurationMode,
            target_duration_seconds: newSeriesDurationMode === 'override' ? newSeriesDuration : null
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        const created = data.data;
        setNewSeriesName('');
        setNewSeriesPillar('');
        setSeries(current => [...current, created]);
        triggerNotice('success', `Content series "${created.name}" created!`);
        navigate('series', selectedChannel.id, created.id);
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
        if (selectedSeries) await selectSeries(selectedSeries);
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

  async function loadEpisodeEditorialData(episodeId) {
    if (!episodeId) return;
    try {
      const rRes = await fetch(`/api/v2/youtube-studio/episodes/${episodeId}/research`);
      const rData = await rRes.json();
      if (rData.success) {
        setSelectedEpisodeResearch(rData.data);
      } else {
        setSelectedEpisodeResearch(null);
      }

      const bRes = await fetch(`/api/v2/youtube-studio/episodes/${episodeId}/blueprint/approve`);
      const bData = await bRes.json();
      if (bData.success) {
        setSelectedEpisodeBlueprint(bData.data);
      } else {
        setSelectedEpisodeBlueprint(null);
      }

      const sRes = await fetch(`/api/v2/youtube-studio/episodes/${episodeId}/scripts/approve`);
      const sData = await sRes.json();
      if (sData.success) {
        setSelectedEpisodeScript(sData.data);
      } else {
        setSelectedEpisodeScript(null);
      }

      const pRes = await fetch(`/api/v2/youtube-studio/episodes/${episodeId}/production-plan`);
      const pData = await pRes.json();
      if (pData.success && pData.data) {
        setActivePackage(pData.data.package);
        setPackageAssets(pData.data.assets || []);
        setAssemblyJob(pData.data.assemblyJob || null);
      } else {
        setActivePackage(null);
        setPackageAssets([]);
        setAssemblyJob(null);
      }
    } catch (e) {
      setErrorMsg('Failed to load editorial workflow data.');
    }
  }

  useEffect(() => {
    if (selectedEpisode) {
      loadEpisodeEditorialData(selectedEpisode.id);
      setOverrideEpDuration(selectedEpisode.target_duration_seconds || '');
      setSelectedProfileKey(selectedEpisode.generation_profile_key || '');
    } else {
      setSelectedEpisodeResearch(null);
      setSelectedEpisodeBlueprint(null);
      setSelectedEpisodeScript(null);
      setOverrideEpDuration('');
      setSelectedProfileKey('');
      setActivePackage(null);
      setPackageAssets([]);
    }
  }, [selectedEpisode]);

  async function handleGenerateResearch() {
    if (!selectedEpisode) return;
    setErrorMsg('');
    setNotice(null);
    setIsGeneratingResearch(true);
    try {
      const res = await fetch(`/api/v2/youtube-studio/episodes/${selectedEpisode.id}/research`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setSelectedEpisodeResearch(data.data);
        await refreshEpisodesList();
        setSelectedEpisode(prev => ({ ...prev, status: 'Researching' }));
        triggerNotice('success', 'AI Research Brief generated successfully.');
      } else {
        setErrorMsg(data.error || 'Failed to generate research brief.');
      }
    } catch (e) {
      setErrorMsg('Failed to generate research brief.');
    } finally {
      setIsGeneratingResearch(false);
    }
  }

  async function handleGenerateBlueprint() {
    if (!selectedEpisode) return;
    setErrorMsg('');
    setNotice(null);
    setIsGeneratingBlueprint(true);
    try {
      const res = await fetch(`/api/v2/youtube-studio/episodes/${selectedEpisode.id}/blueprint/generate`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setSelectedEpisodeBlueprint(data.data);
        await refreshEpisodesList();
        setSelectedEpisode(prev => ({ ...prev, status: 'Blueprint Draft' }));
        triggerNotice('success', 'AI Blueprint Draft generated successfully.');
      } else {
        setErrorMsg(data.error || 'Failed to generate blueprint.');
      }
    } catch (e) {
      setErrorMsg('Failed to generate blueprint.');
    } finally {
      setIsGeneratingBlueprint(false);
    }
  }

  async function handleApproveBlueprint() {
    if (!selectedEpisode || !selectedEpisodeBlueprint) return;
    setErrorMsg('');
    setNotice(null);
    setIsApprovingBlueprint(true);
    try {
      const res = await fetch(`/api/v2/youtube-studio/episodes/${selectedEpisode.id}/blueprint/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blueprint_id: selectedEpisodeBlueprint.id })
      });
      const data = await res.json();
      if (data.success) {
        setSelectedEpisodeBlueprint(data.data);
        await refreshEpisodesList();
        setSelectedEpisode(prev => ({ ...prev, status: 'Blueprint Approved' }));
        setSelectedEpisodeScript(null);
        triggerNotice('success', 'Blueprint approved successfully!');
      } else {
        setErrorMsg(data.error || 'Failed to approve blueprint.');
      }
    } catch (e) {
      setErrorMsg('Failed to approve blueprint.');
    } finally {
      setIsApprovingBlueprint(false);
    }
  }

  async function handleGenerateScript() {
    if (!selectedEpisode) return;
    setErrorMsg('');
    setNotice(null);
    setIsGeneratingScript(true);
    try {
      const res = await fetch(`/api/v2/youtube-studio/episodes/${selectedEpisode.id}/scripts/generate`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setSelectedEpisodeScript(data.data);
        await refreshEpisodesList();
        setSelectedEpisode(prev => ({ ...prev, status: 'Script Draft' }));
        triggerNotice('success', 'AI Script Draft generated successfully.');
      } else {
        setErrorMsg(data.error || 'Failed to generate script.');
      }
    } catch (e) {
      setErrorMsg('Failed to generate script.');
    } finally {
      setIsGeneratingScript(false);
    }
  }

  async function handleApproveScript() {
    if (!selectedEpisode || !selectedEpisodeScript) return;
    setErrorMsg('');
    setNotice(null);
    setIsApprovingScript(true);
    try {
      const res = await fetch(`/api/v2/youtube-studio/episodes/${selectedEpisode.id}/scripts/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script_id: selectedEpisodeScript.id })
      });
      const data = await res.json();
      if (data.success) {
        setSelectedEpisodeScript(data.data);
        await refreshEpisodesList();
        setSelectedEpisode(prev => ({ ...prev, status: 'Script Approved' }));
        triggerNotice('success', 'Script approved! Episode is ready for production.');
      } else {
        setErrorMsg(data.error || 'Failed to approve script.');
      }
    } catch (e) {
      setErrorMsg('Failed to approve script.');
    } finally {
      setIsApprovingScript(false);
    }
  }

  async function handleGenerateProductionPlan(mode = 'legacy_t2v') {
    if (!selectedEpisode) return;
    setErrorMsg('');
    setNotice(null);
    setIsGeneratingPlan(true);
    try {
      const res = await fetch(`/api/v2/youtube-studio/episodes/${selectedEpisode.id}/production-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ production_mode: mode })
      });
      const data = await res.json();
      if (data.success) {
        setActivePackage(data.data.package);
        setPackageAssets(data.data.assets || []);
        triggerNotice('success', 'AI Production Plan Draft generated successfully.');
      } else {
        setErrorMsg(data.error || 'Failed to generate Production Plan.');
      }
    } catch (e) {
      setErrorMsg('Failed to generate Production Plan.');
    } finally {
      setIsGeneratingPlan(false);
    }
  }

  async function handleApproveProductionPlan() {
    if (!selectedEpisode || !activePackage) return;
    setErrorMsg('');
    setNotice(null);
    setIsApprovingPlan(true);
    const mode = activePackage.plan_json?.production_mode || 'legacy_t2v';
    try {
      let res;
      if (mode === 'hybrid') {
        res = await fetch(`/api/v2/youtube-studio/episodes/${selectedEpisode.id}/hybrid-production`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'approve_prompt_package' })
        });
      } else {
        res = await fetch(`/api/v2/youtube-studio/production-packages/${activePackage.id}/approve`, {
          method: 'POST'
        });
      }
      const data = await res.json();
      if (data.success) {
        // Fetch updated draft
        const planRes = await fetch(`/api/v2/youtube-studio/episodes/${selectedEpisode.id}/production-plan`);
        const planData = await planRes.json();
        if (planData.success && planData.data) {
          setActivePackage(planData.data.package);
          setPackageAssets(planData.data.assets || []);
        }
        await refreshEpisodesList();
        setSelectedEpisode(prev => ({ ...prev, status: 'In Production' }));
        triggerNotice('success', 'Production Plan approved! Asset generation has started.');
      } else {
        setErrorMsg(data.error || 'Failed to approve Production Plan.');
      }
    } catch (e) {
      setErrorMsg('Failed to approve Production Plan.');
    } finally {
      setIsApprovingPlan(false);
    }
  }

  const [playingAudio, setPlayingAudio] = useState(null);
  const [playingAssetId, setPlayingAssetId] = useState(null);

  const getMediaUrl = (pathString) => {
    if (!pathString) return '';
    if (pathString.startsWith('/')) return pathString;
    return `/${pathString}`;
  };

  const handleTogglePlayVO = (asset) => {
    const audioUrl = getMediaUrl(asset.output_asset_json?.audio_path);
    if (!audioUrl) return;

    if (playingAssetId === asset.id) {
      if (playingAudio) {
        playingAudio.pause();
        setPlayingAudio(null);
        setPlayingAssetId(null);
      }
    } else {
      if (playingAudio) {
        playingAudio.pause();
      }
      const newAudio = new Audio(audioUrl);
      newAudio.play();
      newAudio.onended = () => {
        setPlayingAudio(null);
        setPlayingAssetId(null);
      };
      setPlayingAudio(newAudio);
      setPlayingAssetId(asset.id);
    }
  };

  async function handleBulkRegenerateTTS() {
    setErrorMsg('');
    setNotice(null);
    try {
      const res = await fetch(`/api/v2/youtube-studio/episodes/${selectedEpisode.id}/bulk-tts`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        const pRes = await fetch(`/api/v2/youtube-studio/episodes/${selectedEpisode.id}/production-plan`);
        const pData = await pRes.json();
        if (pData.success && pData.data) {
          setActivePackage(pData.data.package);
          setPackageAssets(pData.data.assets || []);
        }
        triggerNotice('success', `Bulk TTS regeneration scheduled successfully (${data.count} tracks).`);
      } else {
        setErrorMsg(data.error || 'Failed to trigger bulk TTS regeneration.');
      }
    } catch (e) {
      setErrorMsg('Failed to trigger bulk TTS regeneration.');
    }
  }

  async function handleRegenerateAsset(assetId) {
    setErrorMsg('');
    setNotice(null);
    try {
      const res = await fetch(`/api/v2/youtube-studio/production-assets/${assetId}/regenerate`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        const pRes = await fetch(`/api/v2/youtube-studio/episodes/${selectedEpisode.id}/production-plan`);
        const pData = await pRes.json();
        if (pData.success && pData.data) {
          setActivePackage(pData.data.package);
          setPackageAssets(pData.data.assets || []);
        }
        triggerNotice('success', 'Asset regeneration scheduled successfully.');
      } else {
        setErrorMsg(data.error || 'Failed to regenerate asset.');
      }
    } catch (e) {
      setErrorMsg('Failed to regenerate asset.');
    }
  }

  async function handleGenerateI2V(assetId) {
    setErrorMsg('');
    setNotice(null);
    try {
      const res = await fetch(`/api/v2/youtube-studio/production-assets/${assetId}/generate-i2v`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        const pRes = await fetch(`/api/v2/youtube-studio/episodes/${selectedEpisode.id}/production-plan`);
        const pData = await pRes.json();
        if (pData.success && pData.data) {
          setActivePackage(pData.data.package);
          setPackageAssets(pData.data.assets || []);
        }
        triggerNotice('success', 'Video animation (I2V) job queued successfully.');
      } else {
        setErrorMsg(data.error || 'Failed to queue I2V job.');
      }
    } catch (e) {
      setErrorMsg('Failed to queue I2V job.');
    }
  }

  async function handleFinalRender() {
    if (!selectedEpisode || !activePackage) return;
    setErrorMsg('');
    setNotice(null);
    setIsRenderingFinal(true);
    try {
      const res = await fetch(`/api/v2/youtube-studio/production-packages/${activePackage.id}/final-render`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        const pRes = await fetch(`/api/v2/youtube-studio/episodes/${selectedEpisode.id}/production-plan`);
        const pData = await pRes.json();
        if (pData.success && pData.data) {
          setActivePackage(pData.data.package);
          setPackageAssets(pData.data.assets || []);
        }
        triggerNotice('success', 'Final rendering started.');
      } else {
        setErrorMsg(data.error || 'Failed to trigger final render.');
      }
    } catch (e) {
      setErrorMsg('Failed to trigger final render.');
    } finally {
      setIsRenderingFinal(false);
    }
  }

  async function handleTriggerAssembly() {
    if (!selectedEpisode || !activePackage) return;
    setErrorMsg('');
    setNotice(null);
    setIsTriggeringAssembly(true);
    try {
      const res = await fetch(
        `/api/v2/youtube-studio/production-packages/${activePackage.id}/trigger-assembly`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (data.success) {
        triggerNotice('success', '🎬 Assembly job antri! Preview timeline akan segera tersedia.');
        // Refresh package state after a short delay
        setTimeout(async () => {
          const pRes = await fetch(`/api/v2/youtube-studio/episodes/${selectedEpisode.id}/production-plan`);
          const pData = await pRes.json();
          if (pData.success && pData.data) {
            setActivePackage(pData.data.package);
            setPackageAssets(pData.data.assets || []);
            setAssemblyJob(pData.data.assemblyJob || null);
          }
        }, 2000);
      } else {
        setErrorMsg(data.error || 'Gagal trigger assembly.');
      }
    } catch (e) {
      setErrorMsg('Gagal trigger assembly.');
    } finally {
      setIsTriggeringAssembly(false);
    }
  }

  useEffect(() => {
    let interval;
    const hasActiveAssemblyJob = assemblyJob && ['queued', 'running'].includes(assemblyJob.status);
    if (
      selectedEpisode &&
      activePackage &&
      (['generating', 'approved', 'final_rendering'].includes(activePackage.status) || hasActiveAssemblyJob)
    ) {
      interval = setInterval(async () => {
        try {
          const pRes = await fetch(`/api/v2/youtube-studio/episodes/${selectedEpisode.id}/production-plan`);
          const pData = await pRes.json();
          if (pData.success && pData.data) {
            setActivePackage(pData.data.package);
            setPackageAssets(pData.data.assets || []);
            setAssemblyJob(pData.data.assemblyJob || null);
            if (pData.data.package.status === 'preview_ready' || pData.data.package.status === 'completed') {
              // Auto-redirect to assemble-review tab when package becomes preview_ready and user is on video-production stage
              if (stage === 'video-production' && pData.data.package.status === 'preview_ready') {
                navigate('episode', selectedChannel?.id, selectedSeries?.id, selectedEpisode.id, 'assemble-review');
              }

              await refreshEpisodesList();
              const epRes = await fetch(`/api/v2/youtube-studio/episodes?channel_id=${selectedChannel.id}`);
              const epData = await epRes.json();
              if (epData.success) {
                setEpisodes(epData.data);
                const updated = epData.data.find(e => e.id === selectedEpisode.id);
                if (updated) setSelectedEpisode(updated);
              }
            }
          }
        } catch (e) {
          console.error('Polling error', e);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [activePackage, assemblyJob?.status, selectedEpisode, selectedChannel, selectedSeries, stage]);

  async function handleGenerateSeriesSuggestions() {
    if (!selectedChannel) return;
    setErrorMsg('');
    setNotice(null);
    setIsGeneratingSeriesSuggestions(true);
    try {
      const res = await fetch(`/api/v2/youtube-studio/channels/${selectedChannel.id}/series/ideas/generate`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setSeriesSuggestions(data.data);
        triggerNotice('success', 'AI Series concept pitches generated successfully.');
      } else {
        setErrorMsg(data.error || 'Failed to suggest series concepts.');
      }
    } catch (e) {
      setErrorMsg('Failed to suggest series concepts.');
    } finally {
      setIsGeneratingSeriesSuggestions(false);
    }
  }

  async function handleAdoptSeriesConcept(concept) {
    if (!selectedChannel) return;
    setErrorMsg('');
    setNotice(null);
    try {
      const res = await fetch(`/api/v2/youtube-studio/channels/${selectedChannel.id}/series`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: concept.name,
          pillar: concept.pillar,
          config: {
            description: concept.description,
            concept_angle: concept.concept_angle
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        const created = data.data;
        setSeries(current => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
        setSeriesSuggestions([]);
        triggerNotice('success', `AI pitched series "${created.name}" adopted successfully!`);
        navigate('series', selectedChannel.id, created.id);
      } else {
        setErrorMsg(data.error || 'Failed to adopt series.');
      }
    } catch (e) {
      setErrorMsg('Failed to adopt series.');
    }
  }

  async function handleOverrideEpisodeDuration() {
    if (!selectedEpisode) return;
    setErrorMsg('');
    setNotice(null);
    try {
      const res = await fetch(`/api/v2/youtube-studio/episodes/${selectedEpisode.id}/duration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_duration_seconds: parseInt(overrideEpDuration, 10) })
      });
      const data = await res.json();
      if (data.success) {
        setSelectedEpisode(prev => ({ 
          ...prev, 
          target_duration_seconds: data.data.target_duration_seconds, 
          duration_source: data.data.duration_source 
        }));
        await refreshEpisodesList();
        triggerNotice('success', 'Episode target duration updated successfully!');
      } else {
        setErrorMsg(data.error || 'Failed to update duration.');
      }
    } catch (e) {
      setErrorMsg('Failed to update duration.');
    }
  }

  async function handleSetGenerationProfile(profileKey, voiceProvider, voicePersona, voiceSpeed) {
    if (!selectedEpisode) return;
    setSelectedProfileKey(profileKey);
    setErrorMsg('');
    setNotice(null);
    if (!profileKey) return;
    try {
      const res = await fetch(`/api/v2/youtube-studio/episodes/${selectedEpisode.id}/generation-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          generation_profile_key: profileKey,
          voice_provider: voiceProvider,
          voice_persona: voicePersona,
          voice_speed: voiceSpeed
        })
      });
      const data = await res.json();
      if (data.success) {
        setSelectedEpisode(prev => ({
          ...prev,
          generation_profile_key: data.data.generation_profile_key,
          voice_provider: data.data.voice_provider,
          voice_persona: data.data.voice_persona,
          voice_speed: data.data.voice_speed
        }));
        await refreshEpisodesList();
        triggerNotice('success', 'Generation profile and voice settings saved successfully!');
      } else {
        setErrorMsg(data.error || 'Failed to set generation profile.');
        throw new Error(data.error || 'Failed to save');
      }
    } catch (e) {
      setErrorMsg('Failed to set generation profile.');
      throw e;
    }
  }

  // KB Handlers
  async function handleLoadKbLibrary() {
    setKbLoading(true);
    try {
      const res = await fetch(`/api/v2/youtube-studio/knowledge-bases?t=${Date.now()}`);
      const data = await res.json();
      setKbItems(data.items || []);
    } catch (e) { setErrorMsg('Failed to load KB Library'); }
    setKbLoading(false);
  }

  async function handleSyncTemplates() {
    if (!confirm('Do you want to automatically load all KB templates from the local folder "kb/youtube-studio/"?')) return;
    setKbLoading(true);
    try {
      const res = await fetch('/api/v2/youtube-studio/knowledge-bases/sync-templates', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        triggerNotice('success', `Successfully synced ${data.count} local KB templates as Draft.`);
        const listRes = await fetch(`/api/v2/youtube-studio/knowledge-bases?t=${Date.now()}`);
        setKbItems((await listRes.json()).items || []);
      } else { setErrorMsg(data.error); }
    } catch (e) { setErrorMsg('Failed to sync templates: ' + e.message); }
    setKbLoading(false);
  }

  async function handleCreateKbDraft() {
    if (!selectedChannel && kbCreateScope === 'channel') {
      setErrorMsg('Select a channel first'); return;
    }
    setKbIsGenerating(true);
    try {
      const scopeId = kbCreateScope === 'channel' ? selectedChannel?.id
        : kbCreateScope === 'series' ? selectedSeries?.id
        : 'tenant';
      const res = await fetch('/api/v2/youtube-studio/knowledge-bases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kbType: kbCreateType,
          scope: kbCreateScope,
          scopeId,
          title: kbCreateTitle,
          brief: { description: kbCreateBrief },
          locale: newChannelLocale || 'id-ID',
          aiAssisted: true,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      triggerNotice('success', `KB draft "${data.kb?.title}" generated successfully by AI.`);
      setKbShowCreate(false);
      setKbCreateTitle(''); setKbCreateBrief('');
      handleLoadKbLibrary();
    } catch (e) { setErrorMsg('Failed to create KB draft: ' + e.message); }
    setKbIsGenerating(false);
  }

  async function handleUploadKbDraft() {
    if (!selectedChannel && kbCreateScope === 'channel') {
      setErrorMsg('Select a channel first'); return;
    }
    setKbIsUploading(true);
    try {
      const fileReader = new FileReader();
      fileReader.onload = async (event) => {
        try {
          const fileContent = event.target.result;
          const scopeId = kbCreateScope === 'channel' ? selectedChannel?.id
            : kbCreateScope === 'series' ? selectedSeries?.id
            : 'tenant';

          let payload = {
            kbType: kbCreateType,
            scope: kbCreateScope,
            scopeId,
            title: kbCreateTitle,
            locale: newChannelLocale || 'id-ID'
          };

          if (kbUploadFile.name.endsWith('.json')) {
            const parsedContent = JSON.parse(fileContent);
            payload.content = parsedContent;
            payload.aiAssisted = false;
          } else {
            payload.brief = { description: fileContent };
            payload.aiAssisted = true;
          }

          const res = await fetch('/api/v2/youtube-studio/knowledge-bases', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.error);

          triggerNotice('success', `KB draft from file "${data.kb?.title}" imported successfully.`);
          setKbShowCreate(false);
          setKbCreateTitle(''); setKbUploadFile(null);
          handleLoadKbLibrary();
        } catch (e) { setErrorMsg('Failed parsing file: ' + e.message); }
      };
      fileReader.readAsText(kbUploadFile);
    } catch (e) { setErrorMsg('Failed reading file: ' + e.message); }
    setKbIsUploading(false);
  }

  async function handleActivateKb(e, kb) {
    e.stopPropagation();
    try {
      const detailRes = await fetch(`/api/v2/youtube-studio/knowledge-bases/${kb.id}`);
      const detailData = await detailRes.json();
      const latestRev = detailData.revisions?.[0];
      if (!latestRev) {
        setErrorMsg('No draft revisions found.'); return;
      }
      const res = await fetch(`/api/v2/youtube-studio/knowledge-bases/${kb.id}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision_id: latestRev.id }),
      });
      const data = await res.json();
      if (data.success) {
        triggerNotice('success', `Knowledge Base "${kb.title}" activated successfully.`);
        handleLoadKbLibrary();
      } else { setErrorMsg(data.error); }
    } catch (err) { setErrorMsg('Activation failed: ' + err.message); }
  }

  async function handleArchiveKb(e, kb) {
    e.stopPropagation();
    if (!confirm('Are you sure you want to archive this KB document?')) return;
    try {
      const detailRes = await fetch(`/api/v2/youtube-studio/knowledge-bases/${kb.id}`);
      const detailData = await detailRes.json();
      const latestRev = detailData.revisions?.[0];
      if (!latestRev) {
        setErrorMsg('No revisions found.'); return;
      }
      const res = await fetch(`/api/v2/youtube-studio/knowledge-bases/${kb.id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision_id: latestRev.id }),
      });
      const data = await res.json();
      if (data.success) {
        triggerNotice('success', `Knowledge Base "${kb.title}" archived.`);
        handleLoadKbLibrary();
        setKbSelectedId(null);
      } else { setErrorMsg(data.error); }
    } catch (err) { setErrorMsg('Archiving failed: ' + err.message); }
  }

  async function handleBindKbToChannel(e, kbId) {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/v2/youtube-studio/channels/${selectedChannel.id}/kb-bindings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kb_id: kbId }),
      });
      const data = await res.json();
      if (data.success) triggerNotice('success', 'KB bound to channel successfully.');
      else setErrorMsg(data.error);
    } catch (e) { setErrorMsg('Binding request failed.'); }
  }

  // Views rendering
  const stages = resolveEpisodeStages({
    episode: selectedEpisode,
    research: selectedEpisodeResearch,
    blueprint: selectedEpisodeBlueprint,
    script: selectedEpisodeScript,
    productionPackage: activePackage,
    assemblyJob: assemblyJob
  });

  return (
    <div className={styles.workspace}>
      <header className={styles.titleHeader}>
        <h1>YouTube Studio</h1>
        <p>AI strategist copilot &amp; backlog generator.</p>
      </header>

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

      <YouTubeStudioShell
        activeView={view}
        selectedChannel={selectedChannel}
        selectedSeries={selectedSeries}
        selectedEpisode={selectedEpisode}
        onNavigate={navigate}
      >
        {view === 'channels' && (
          <ChannelsView
            channels={channels}
            newChannelName={newChannelName}
            setNewChannelName={setNewChannelName}
            newChannelLocale={newChannelLocale}
            setNewChannelLocale={setNewChannelLocale}
            onCreateChannel={handleCreateChannel}
            onOpenChannel={(c) => navigate('channel', c.id)}
          />
        )}

        {view === 'channel' && selectedChannel && (
          <ChannelDetailView
            channel={selectedChannel}
            activeStrategy={activeStrategy}
            draftStrategy={draftStrategy}
            brief={brief}
            setBrief={setBrief}
            showBriefForm={showBriefForm}
            setShowBriefForm={setShowBriefForm}
            isGeneratingStrategy={isGeneratingStrategy}
            handleGenerateStrategy={handleGenerateStrategy}
            refineInstruction={refineInstruction}
            setRefineInstruction={setRefineInstruction}
            isRefiningStrategy={isRefiningStrategy}
            handleRefineStrategy={handleRefineStrategy}
            isActivatingStrategy={isActivatingStrategy}
            handleActivateStrategy={handleActivateStrategy}
            universes={universes}
            visualIdentities={visualIdentities}
            showRawActive={showRawActive}
            setShowRawActive={setShowRawActive}
            showRawDraft={showRawDraft}
            setShowRawDraft={setShowRawDraft}
            
            // Series props
            series={series}
            newSeriesName={newSeriesName}
            setNewSeriesName={setNewSeriesName}
            newSeriesPillar={newSeriesPillar}
            setNewSeriesPillar={setNewSeriesPillar}
            newSeriesDurationMode={newSeriesDurationMode}
            setNewSeriesDurationMode={setNewSeriesDurationMode}
            newSeriesDuration={newSeriesDuration}
            setNewSeriesDuration={setNewSeriesDuration}
            handleCreateSeries={handleCreateSeries}
            seriesSuggestions={seriesSuggestions}
            setSeriesSuggestions={setSeriesSuggestions}
            isGeneratingSeriesSuggestions={isGeneratingSeriesSuggestions}
            handleGenerateSeriesSuggestions={handleGenerateSeriesSuggestions}
            handleAdoptSeriesConcept={handleAdoptSeriesConcept}
            onOpenSeries={(s) => navigate('series', selectedChannel.id, s.id)}

            // KB props
            kbItems={kbItems}
            kbLoading={kbLoading}
            kbSelectedId={kbSelectedId}
            setKbSelectedId={setKbSelectedId}
            kbRevisions={kbRevisions}
            setKbRevisions={setKbRevisions}
            kbShowCreate={kbShowCreate}
            setKbShowCreate={setKbShowCreate}
            kbCreateType={kbCreateType}
            setKbCreateType={setKbCreateType}
            kbCreateTitle={kbCreateTitle}
            setKbCreateTitle={setKbCreateTitle}
            kbCreateScope={kbCreateScope}
            setKbCreateScope={setKbCreateScope}
            kbCreateBrief={kbCreateBrief}
            setKbCreateBrief={setKbCreateBrief}
            kbIsGenerating={kbIsGenerating}
            kbIsUploading={kbIsUploading}
            kbUploadMode={kbUploadMode}
            setKbUploadMode={setKbUploadMode}
            kbUploadFile={kbUploadFile}
            setKbUploadFile={setKbUploadFile}
            newChannelLocale={newChannelLocale}
            handleSyncTemplates={handleSyncTemplates}
            handleLoadKbLibrary={handleLoadKbLibrary}
            handleCreateKbDraft={handleCreateKbDraft}
            handleUploadKbDraft={handleUploadKbDraft}
            handleActivateKb={handleActivateKb}
            handleArchiveKb={handleArchiveKb}
            handleBindKbToChannel={handleBindKbToChannel}
          />
        )}

        {view === 'series' && selectedSeries && (
          <SeriesDetailView
            series={selectedSeries}
            ideas={ideas}
            episodes={episodes}
            newEpisodeTitle={newEpisodeTitle}
            setNewEpisodeTitle={setNewEpisodeTitle}
            isGeneratingIdeas={isGeneratingIdeas}
            handleGenerateEpisodeIdeas={handleGenerateEpisodeIdeas}
            handleAdoptIdea={handleAdoptIdea}
            handleRejectIdea={handleRejectIdea}
            handleCreateEpisodeManual={handleCreateEpisodeManual}
            onOpenEpisode={(ep) => navigate('episode', ep.channel_id, ep.series_id, ep.id, 'research')}
            selectedChannel={selectedChannel}
          />
        )}

        {view === 'episode' && selectedEpisode && (
          <EpisodeWorkspace
            episode={selectedEpisode}
            stages={stages}
            activeStageKey={stage}
            onStageChange={(stgKey) => navigate('episode', selectedChannel?.id, selectedSeries?.id, selectedEpisode.id, stgKey)}
            
            // Research props
            research={selectedEpisodeResearch}
            isGeneratingResearch={isGeneratingResearch}
            handleGenerateResearch={handleGenerateResearch}
            overrideEpDuration={overrideEpDuration}
            setOverrideEpDuration={setOverrideEpDuration}
            handleOverrideEpisodeDuration={handleOverrideEpisodeDuration}
            
            // Blueprint props
            blueprint={selectedEpisodeBlueprint}
            isGeneratingBlueprint={isGeneratingBlueprint}
            handleGenerateBlueprint={handleGenerateBlueprint}
            isApprovingBlueprint={isApprovingBlueprint}
            handleApproveBlueprint={handleApproveBlueprint}
            
            // Script props
            script={selectedEpisodeScript}
            isGeneratingScript={isGeneratingScript}
            handleGenerateScript={handleGenerateScript}
            isApprovingScript={isApprovingScript}
            handleApproveScript={handleApproveScript}
            refreshEditorialData={async () => await loadEpisodeEditorialData(selectedEpisode.id)}
            
            // Profile props
            profilesList={profilesList}
            selectedProfileKey={selectedProfileKey}
            handleSetGenerationProfile={handleSetGenerationProfile}
            
            // Production props
            activePackage={activePackage}
            packageAssets={packageAssets}
            isGeneratingPlan={isGeneratingPlan}
            handleGenerateProductionPlan={handleGenerateProductionPlan}
            isApprovingPlan={isApprovingPlan}
            handleApproveProductionPlan={handleApproveProductionPlan}
            handleRegenerateAsset={handleRegenerateAsset}
            handleGenerateI2V={handleGenerateI2V}
            
            // Custom play & bulk TTS props
            playingAssetId={playingAssetId}
            handleTogglePlayVO={handleTogglePlayVO}
            handleBulkRegenerateTTS={handleBulkRegenerateTTS}
            
            handleTriggerAssembly={handleTriggerAssembly}
            isTriggeringAssembly={isTriggeringAssembly}
            assemblyJob={assemblyJob}

            // Review props
            isRenderingFinal={isRenderingFinal}
            handleFinalRender={handleFinalRender}
          />
        )}

        {view === 'production' && (
          <ProductionQueue
            episodes={episodes}
            onOpenEpisode={(ep) => navigate('episode', ep.channel_id, ep.series_id, ep.id, 'research')}
          />
        )}

        {view === 'publishing' && (
          <PublishingHub
            episodes={episodes}
            onOpenEpisode={(ep) => navigate('episode', ep.channel_id, ep.series_id, ep.id, 'research')}
          />
        )}

        {view === 'analytics' && <AnalyticsPlaceholder />}
      </YouTubeStudioShell>
    </div>
  );
}
