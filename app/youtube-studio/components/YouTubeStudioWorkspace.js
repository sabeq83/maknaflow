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
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isApprovingPlan, setIsApprovingPlan] = useState(false);
  const [isRenderingFinal, setIsRenderingFinal] = useState(false);

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
        if (data.data.length > 0) {
          selectChannel(data.data[0]);
        }
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

  async function loadEpisodeEditorialData(episodeId) {
    if (!episodeId) return;
    try {
      // 1. Fetch Research Brief
      const rRes = await fetch(`/api/v2/youtube-studio/episodes/${episodeId}/research`);
      const rData = await rRes.json();
      if (rData.success) {
        setSelectedEpisodeResearch(rData.data);
      } else {
        setSelectedEpisodeResearch(null);
      }

      // 2. Fetch Blueprint
      const bRes = await fetch(`/api/v2/youtube-studio/episodes/${episodeId}/blueprint/approve`);
      const bData = await bRes.json();
      if (bData.success) {
        setSelectedEpisodeBlueprint(bData.data);
      } else {
        setSelectedEpisodeBlueprint(null);
      }

      // 3. Fetch Script
      const sRes = await fetch(`/api/v2/youtube-studio/episodes/${episodeId}/scripts/approve`);
      const sData = await sRes.json();
      if (sData.success) {
        setSelectedEpisodeScript(sData.data);
      } else {
        setSelectedEpisodeScript(null);
      }

      // 4. Fetch Production Plan package
      const pRes = await fetch(`/api/v2/youtube-studio/episodes/${episodeId}/production-plan`);
      const pData = await pRes.json();
      if (pData.success && pData.data) {
        setActivePackage(pData.data.package);
        setPackageAssets(pData.data.assets || []);
      } else {
        setActivePackage(null);
        setPackageAssets([]);
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

  async function handleGenerateProductionPlan() {
    if (!selectedEpisode) return;
    setErrorMsg('');
    setNotice(null);
    setIsGeneratingPlan(true);
    try {
      const res = await fetch(`/api/v2/youtube-studio/episodes/${selectedEpisode.id}/production-plan`, {
        method: 'POST'
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
    try {
      const res = await fetch(`/api/v2/youtube-studio/production-packages/${activePackage.id}/approve`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setActivePackage(data.data);
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

  useEffect(() => {
    let interval;
    if (selectedEpisode && activePackage && ['generating', 'approved', 'final_rendering'].includes(activePackage.status)) {
      interval = setInterval(async () => {
        try {
          const pRes = await fetch(`/api/v2/youtube-studio/episodes/${selectedEpisode.id}/production-plan`);
          const pData = await pRes.json();
          if (pData.success && pData.data) {
            setActivePackage(pData.data.package);
            setPackageAssets(pData.data.assets || []);
            if (pData.data.package.status === 'preview_ready' || pData.data.package.status === 'completed') {
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
  }, [activePackage, selectedEpisode, selectedChannel]);

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
      const res = await fetch('/api/v2/youtube-studio/series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: selectedChannel.id,
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
        await selectSeries(created);
        setSeriesSuggestions([]);
        triggerNotice('success', `AI pitched series "${created.name}" adopted successfully!`);
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

  async function handleSetGenerationProfile(profileKey) {
    if (!selectedEpisode) return;
    setSelectedProfileKey(profileKey);
    setErrorMsg('');
    setNotice(null);
    if (!profileKey) return;
    try {
      const res = await fetch(`/api/v2/youtube-studio/episodes/${selectedEpisode.id}/generation-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generation_profile_key: profileKey })
      });
      const data = await res.json();
      if (data.success) {
        setSelectedEpisode(prev => ({
          ...prev,
          generation_profile_key: data.data.generation_profile_key
        }));
        await refreshEpisodesList();
        triggerNotice('success', 'Generation profile saved successfully!');
      } else {
        setErrorMsg(data.error || 'Failed to set generation profile.');
      }
    } catch (e) {
      setErrorMsg('Failed to set generation profile.');
    }
  }

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

      {/* ─── KB LIBRARY SECTION (Fase 3.5A) ───────────────────────────────────── */}
      <section className={styles.kbStep} aria-labelledby="kb-step-title">
        <div className={styles.stepHeader}>
          <h2 id="kb-step-title">Knowledge Base Library</h2>
          <span className={styles.kbStepBadge}>Channel &amp; Series Context</span>
        </div>
        <p className={styles.kbStepDesc}>
          Kelola KB versioned untuk Channel dan Series. AI membuat draft — Anda yang approve. KB aktif diinjeksikan secara otomatis ke Research, Blueprint, Script, dan Production Plan.
        </p>

        {/* KB Filters & List */}
        <div className={styles.kbToolbar}>
          <button
            id="kb-load-btn"
            className={styles.btnSecondary}
            disabled={kbLoading}
            onClick={async () => {
              setKbLoading(true);
              try {
                const res = await fetch('/api/v2/youtube-studio/knowledge-bases');
                const data = await res.json();
                setKbItems(data.items || []);
              } catch (e) { setErrorMsg('Gagal memuat KB Library'); }
              setKbLoading(false);
            }}
          >
            {kbLoading ? 'Memuat...' : '↻ Muat KB Library'}
          </button>
          <button
            id="kb-create-toggle-btn"
            className={styles.btnPrimary}
            onClick={() => setKbShowCreate(v => !v)}
          >
            {kbShowCreate ? '✕ Batal' : '+ Buat KB Baru'}
          </button>
        </div>

        {/* Create KB Form */}
        {kbShowCreate && (
          <div className={styles.kbCreateForm}>
            <h3 className={styles.kbCreateTitle}>Buat Knowledge Base Baru</h3>
            
            {/* Tab Container */}
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
                <label htmlFor="kb-type-select">TIPE KB</label>
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
              <label htmlFor="kb-title-input">JUDUL KB</label>
              <input id="kb-title-input" className={styles.input} type="text" placeholder="e.g. Channel Profile MAKNA Flow" value={kbCreateTitle} onChange={e => setKbCreateTitle(e.target.value)} />
            </div>

            {kbUploadMode === 'ai' ? (
              <>
                <div className={styles.formGroup}>
                  <label htmlFor="kb-brief-input">BRIEF KONTEKS UNTUK AI</label>
                  <textarea
                    id="kb-brief-input"
                    className={styles.textarea}
                    rows={4}
                    placeholder="Deskripsikan channel/series Anda: niche, audience, tone, visual style, dll."
                    value={kbCreateBrief}
                    onChange={e => setKbCreateBrief(e.target.value)}
                  />
                </div>
                <div className={styles.kbCreateActions}>
                  <button
                    id="kb-ai-draft-btn"
                    className={styles.btnPrimaryLarge}
                    disabled={kbIsGenerating || !kbCreateTitle || !kbCreateBrief}
                    onClick={async () => {
                      if (!selectedChannel && kbCreateScope === 'channel') {
                        setErrorMsg('Pilih channel terlebih dahulu'); return;
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
                        setNotice({ tone: 'success', message: `KB draft "${data.kb?.title}" berhasil dibuat oleh AI. Review dan activate sebelum digunakan.` });
                        setKbShowCreate(false);
                        setKbCreateTitle(''); setKbCreateBrief('');
                        // Refresh list
                        const listRes = await fetch('/api/v2/youtube-studio/knowledge-bases');
                        const listData = await listRes.json();
                        setKbItems(listData.items || []);
                      } catch (e) { setErrorMsg('Gagal membuat KB: ' + e.message); }
                      setKbIsGenerating(false);
                    }}
                  >
                    {kbIsGenerating ? '⏳ AI Sedang Membuat Draft...' : '✨ Generate AI Draft'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.formGroup}>
                  <label>UNGGAH DOKUMEN KB (.json, .txt, .md)</label>
                  <div className={styles.kbUploadDropzone}>
                    <input
                      id="kb-file-upload"
                      type="file"
                      accept=".json,.txt,.md"
                      className={styles.kbFileInputHidden}
                      onChange={e => setKbUploadFile(e.target.files[0])}
                    />
                    <label htmlFor="kb-file-upload" className={styles.kbUploadLabel}>
                      <span className={styles.kbUploadIcon}>📁</span>
                      {kbUploadFile ? (
                        <span className={styles.kbUploadFileName}>{kbUploadFile.name} ({(kbUploadFile.size / 1024).toFixed(1)} KB)</span>
                      ) : (
                        <span className={styles.kbUploadInstructions}>Klik di sini untuk memilih file dokumen</span>
                      )}
                    </label>
                  </div>
                  <p className={styles.kbStepDesc} style={{ marginTop: 'var(--space-2)', fontSize: '0.75rem' }}>
                    * File .json harus sesuai schema terstruktur. File .txt / .md akan diproses oleh AI untuk diselaraskan dengan skema target.
                  </p>
                </div>
                <div className={styles.kbCreateActions}>
                  <button
                    id="kb-upload-draft-btn"
                    className={styles.btnPrimaryLarge}
                    disabled={kbIsUploading || !kbCreateTitle || !kbUploadFile}
                    onClick={async () => {
                      if (!selectedChannel && kbCreateScope === 'channel') {
                        setErrorMsg('Pilih channel terlebih dahulu'); return;
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
                              // direct JSON import
                              const parsedContent = JSON.parse(fileContent);
                              payload.content = parsedContent;
                              payload.aiAssisted = false;
                            } else {
                              // txt/md AI extraction
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

                            setNotice({ tone: 'success', message: `KB draft dari file "${data.kb?.title}" berhasil diimport. Review dan activate sebelum digunakan.` });
                            setKbShowCreate(false);
                            setKbCreateTitle(''); setKbUploadFile(null);
                            
                            // Refresh list
                            const listRes = await fetch('/api/v2/youtube-studio/knowledge-bases');
                            setKbItems((await listRes.json()).items || []);
                          } catch (e) { setErrorMsg('Gagal parsing file: ' + e.message); }
                        };
                        fileReader.readAsText(kbUploadFile);
                      } catch (e) { setErrorMsg('Gagal membaca file: ' + e.message); }
                      setKbIsUploading(false);
                    }}
                  >
                    {kbIsUploading ? '⏳ Sedang Mengunggah &amp; Memproses...' : '📤 Upload &amp; Buat Draft'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* KB List */}
        {kbItems.length === 0 && !kbLoading && (
          <p className={styles.kbEmptyState}>Belum ada Knowledge Base. Klik "Muat KB Library" atau buat baru.</p>
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
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          const detailRes = await fetch(`/api/v2/youtube-studio/knowledge-bases/${kb.id}`);
                          const detailData = await detailRes.json();
                          const latestRev = detailData.revisions?.[0];
                          if (!latestRev) {
                            setErrorMsg('Tidak ada revisi draft ditemukan.'); return;
                          }
                          const res = await fetch(`/api/v2/youtube-studio/knowledge-bases/${kb.id}/activate`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ revision_id: latestRev.id }),
                          });
                          const data = await res.json();
                          if (data.success) {
                            setNotice({ tone: 'success', message: `Knowledge Base "${kb.title}" berhasil diaktifkan.` });
                            const listRes = await fetch('/api/v2/youtube-studio/knowledge-bases');
                            setKbItems((await listRes.json()).items || []);
                          } else { setErrorMsg(data.error); }
                        } catch (err) { setErrorMsg('Gagal aktivasi: ' + err.message); }
                      }}
                    >
                      ✓ Activate
                    </button>
                  )}
                  
                  {kb.status !== 'archived' && (
                    <button
                      type="button"
                      className={styles.btnMiniDanger}
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm('Apakah Anda yakin ingin mengarsipkan (menghapus) dokumen KB ini?')) return;
                        try {
                          const detailRes = await fetch(`/api/v2/youtube-studio/knowledge-bases/${kb.id}`);
                          const detailData = await detailRes.json();
                          const latestRev = detailData.revisions?.[0];
                          if (!latestRev) {
                            setErrorMsg('Tidak ada revisi ditemukan.'); return;
                          }
                          const res = await fetch(`/api/v2/youtube-studio/knowledge-bases/${kb.id}/archive`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ revision_id: latestRev.id }),
                          });
                          const data = await res.json();
                          if (data.success) {
                            setNotice({ tone: 'success', message: `Knowledge Base "${kb.title}" berhasil diarsipkan.` });
                            const listRes = await fetch('/api/v2/youtube-studio/knowledge-bases');
                            setKbItems((await listRes.json()).items || []);
                            setKbSelectedId(null);
                          } else { setErrorMsg(data.error); }
                        } catch (err) { setErrorMsg('Gagal mengarsipkan: ' + err.message); }
                      }}
                    >
                      ✕ Archive
                    </button>
                  )}
                </div>
              </div>
              <p className={styles.kbCardTitle}>{kb.title}</p>
              <p className={styles.bindingSummary}>Scope: {kb.scope} · {kb.scope_id}</p>

              {/* Revision actions */}
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
                          {rev.status === 'draft' || rev.status === 'review' ? (
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
                                  setNotice({ tone: 'success', message: 'KB revision activated.' });
                                  const refreshRes = await fetch(`/api/v2/youtube-studio/knowledge-bases/${kb.id}`);
                                  const refreshData = await refreshRes.json();
                                  setKbRevisions(refreshData.revisions || []);
                                  // Refresh list
                                  const listRes = await fetch('/api/v2/youtube-studio/knowledge-bases');
                                  setKbItems((await listRes.json()).items || []);
                                } else { setErrorMsg(data.error); }
                              }}
                            >
                              ✓ Activate
                            </button>
                          ) : null}
                          {rev.status !== 'archived' ? (
                            <button
                              id={`kb-archive-${rev.id}`}
                              className={styles.btnMiniDanger}
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!confirm('Apakah Anda yakin ingin mengarsipkan (menghapus) revisi KB ini?')) return;
                                const res = await fetch(`/api/v2/youtube-studio/knowledge-bases/${kb.id}/archive`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ revision_id: rev.id }),
                                });
                                const data = await res.json();
                                if (data.success) {
                                  setNotice({ tone: 'success', message: 'Revisi KB berhasil diarsipkan.' });
                                  const refreshRes = await fetch(`/api/v2/youtube-studio/knowledge-bases/${kb.id}`);
                                  const refreshData = await refreshRes.json();
                                  setKbRevisions(refreshData.revisions || []);
                                  // Refresh list
                                  const listRes = await fetch('/api/v2/youtube-studio/knowledge-bases');
                                  setKbItems((await listRes.json()).items || []);
                                } else { setErrorMsg(data.error); }
                              }}
                            >
                              ✕ Archive
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {/* Content Preview Block */}
                      <pre className={styles.kbContentPreview}>
                        {JSON.stringify(rev.content_json || {}, null, 2)}
                      </pre>
                    </div>
                  ))}

                  {/* Channel Binding */}
                  {selectedChannel && (
                    <button
                      id={`kb-bind-channel-${kb.id}`}
                      className={styles.btnSecondary}
                      style={{ marginTop: 'var(--space-2)' }}
                      onClick={async (e) => {
                        e.stopPropagation();
                        const res = await fetch(`/api/v2/youtube-studio/channels/${selectedChannel.id}/kb-bindings`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ kb_id: kb.id }),
                        });
                        const data = await res.json();
                        if (data.success) setNotice({ tone: 'success', message: `KB "${kb.title}" diikat ke channel.` });
                        else setErrorMsg(data.error);
                      }}
                    >
                      🔗 Bind ke Channel
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

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
          {selectedChannel && activeStrategy && (
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={handleGenerateSeriesSuggestions}
              disabled={isGeneratingSeriesSuggestions}
            >
              {isGeneratingSeriesSuggestions ? '⚡ Generating...' : 'Suggest Series Concepts (AI)'}
            </button>
          )}
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

            {/* AI Pitched Series Concepts */}
            {seriesSuggestions.length > 0 && (
              <div className={styles.subSection} style={{ borderTop: '1px dashed var(--border-subtle)', paddingTop: '20px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0 }}>Saran Konsep Series (AI Suggestions)</h3>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                    <h3 style={{ margin: 0 }}>Editorial Workflow: {selectedEpisode.title}</h3>
                    <span className={styles.badge} style={{ background: 'var(--status-success-soft)', color: 'var(--status-success)', fontSize: '0.8rem', padding: '4px 10px' }}>
                      Status: {selectedEpisode.status}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', margin: '12px 0', fontSize: '0.85rem' }}>
                    <div>
                      Resolved Duration: <strong>{selectedEpisode.target_duration_seconds} detik</strong> 
                      <span className={styles.inheritanceHint} style={{ marginLeft: '6px', color: 'var(--text-secondary)' }}>
                        (Source: {selectedEpisode.duration_source})
                      </span>
                    </div>
                    {selectedEpisode.status === 'Planned' && (
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

                  {/* Section 5.1: Research Brief */}
                  <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, fontSize: '1rem' }}>Step 5.1: AI Research & Background</h4>
                      {!selectedEpisodeResearch && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={handleGenerateResearch}
                          disabled={isGeneratingResearch || selectedEpisode.status !== 'Planned'}
                        >
                          {isGeneratingResearch ? '⚡ Researching...' : 'Start AI Research'}
                        </button>
                      )}
                    </div>
                    {selectedEpisodeResearch ? (
                      renderResearchBrief(selectedEpisodeResearch)
                    ) : (
                      <div className={styles.prereqNotice}>
                        Research brief is not yet generated. Click "Start AI Research" above to begin. (Prerequisite: Episode must be in 'Planned' status).
                      </div>
                    )}
                  </div>

                  {/* Section 5.2: Video Blueprint */}
                  <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px dashed var(--border-subtle)', paddingTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, fontSize: '1rem' }}>Step 5.2: Timing & Narrative Blueprint</h4>
                      {selectedEpisodeResearch && !selectedEpisodeBlueprint && (
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
                    {selectedEpisodeBlueprint ? (
                      renderBlueprint(selectedEpisodeBlueprint)
                    ) : (
                      <div className={styles.prereqNotice}>
                        Blueprint draft is not yet generated. (Prerequisite: Research brief must be completed).
                      </div>
                    )}
                  </div>

                  {/* Section 5.3: Voice-Over Script */}
                  <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px dashed var(--border-subtle)', paddingTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, fontSize: '1rem' }}>Step 5.3: Voice-Over & Visual Direction Script</h4>
                      {selectedEpisodeBlueprint && selectedEpisodeBlueprint.status === 'approved' && !selectedEpisodeScript && (
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
                    {selectedEpisodeScript ? (
                      renderScript(selectedEpisodeScript)
                    ) : (
                      <div className={styles.prereqNotice}>
                        Voice-over script is not yet generated. (Prerequisite: Blueprint must be Approved).
                      </div>
                    )}
                  </div>

                  {/* Step 6: Model Generation Profile Selection */}
                  <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px dashed var(--border-subtle)', paddingTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, fontSize: '1rem' }}>Step 6: Model Generation Profile Selection</h4>
                    </div>
                    {selectedEpisode.status === 'Script Approved' ? (
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

                  {/* Step 7: AI Production Plan */}
                  <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px dashed var(--border-subtle)', paddingTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, fontSize: '1rem' }}>Step 7: AI Production Plan</h4>
                      {selectedEpisode.generation_profile_key && !activePackage && (
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

                    {!selectedEpisode.generation_profile_key ? (
                      <div className={styles.prereqNotice}>
                        Select a model generation profile first. (Prerequisite: Generation Profile Selection).
                      </div>
                    ) : !activePackage ? (
                      <div className={styles.prereqNotice}>
                        No production plan generated yet. Click the button to start.
                      </div>
                    ) : (
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

                        {/* Plan Details */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <h5 style={{ margin: 0, fontSize: '0.9rem' }}>Visual & Voice Assets Blueprint:</h5>
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
                    )}
                  </div>

                  {/* Step 8: Asset & VO Generation Progress */}
                  {activePackage && activePackage.status !== 'draft' && (
                    <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px dashed var(--border-subtle)', paddingTop: '20px' }}>
                      <h4 style={{ margin: 0, fontSize: '1rem' }}>Step 8: Asset & VO Generation Progress</h4>
                      <div className={styles.assetProgress} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {packageAssets.map((asset, idx) => (
                          <div key={asset.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-raised)', padding: '10px 14px', borderRadius: '6px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
                                {asset.asset_type === 'voiceover' ? '🎙️ Voiceover' : '🎬 Visual Shot'} (Scene {asset.scene_index + 1}{asset.shot_index >= 0 ? `, Shot ${asset.shot_index + 1}` : ''})
                              </span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {asset.prompt_snapshot?.substring(0, 80)}...
                              </span>
                              {asset.error_message && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--error)' }}>
                                  Error: {asset.error_message}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span className={`badge badge-${asset.status === 'succeeded' ? 'success' : asset.status === 'failed' ? 'danger' : 'warning'}`} style={{ fontSize: '0.75rem' }}>
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

                  {/* Step 9: Preview & Final Render */}
                  {activePackage && ['preview_ready', 'final_rendering', 'completed'].includes(activePackage.status) && (
                    <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px dashed var(--border-subtle)', paddingTop: '20px' }}>
                      <h4 style={{ margin: 0, fontSize: '1rem' }}>Step 9: Preview & Final Render</h4>
                      
                      {/* Preview Player */}
                      {activePackage.preview_asset_json && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Timeline Preview</label>
                          <video 
                            src={activePackage.preview_asset_json.videoAsset} 
                            controls 
                            width="100%" 
                            style={{ borderRadius: '8px', border: '1px solid var(--border-subtle)', background: '#000' }}
                          />
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Subtitles track generated: <code>{activePackage.preview_asset_json.subtitleAsset}</code>
                          </span>
                        </div>
                      )}

                      {/* Final Render Player */}
                      {activePackage.status === 'completed' && activePackage.final_asset_json && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                          <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--success)' }}>✓ Final YouTube Video</label>
                          <video 
                            src={activePackage.final_asset_json.videoAsset} 
                            controls 
                            width="100%" 
                            style={{ borderRadius: '8px', border: '1px solid var(--success)', background: '#000' }}
                          />
                          <div className={styles.inheritanceHint} style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 'bold' }}>
                            🎉 Video is compiled and ready to publish!
                          </div>
                        </div>
                      )}

                      {/* Trigger Final Render Actions */}
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
                          ⚡ Final video is rendering on GPU Node... (Please wait).
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}
            </div>

          </div>
        )}
      </section>
    </div>
  );
}
