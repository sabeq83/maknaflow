import { pgQuery, withPgTransaction } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';
import { EPISODE_STATES, SCRIPT_STATES, normalizeLocale, assertEpisodeTransition, resolveEpisodeDuration, normalizeTargetDuration, analyzeNarrationDuration, assertNarrationApprovable } from './youtube-studio-contract.js';
import { getGenerationProfile } from './youtube-studio-generation-profiles.js';
import { validateChannelAudioConfig, validateSpeakerInput, validateVoiceCasting, validateSonicIdentity } from './youtube-studio-character-voice-contract.js';
import { getTtsCapabilities } from './youtube-studio-tts-capabilities.js';


export async function listChannels() {
  const tenantId = getActiveTenantId();
  const res = await pgQuery('SELECT * FROM youtube_channels WHERE tenant_id = $1 ORDER BY name ASC', [tenantId]);
  return res.rows;
}

export async function createChannel(input, actor) {
  const tenantId = getActiveTenantId();
  const id = `ytc_${Math.random().toString(36).slice(2, 10)}`;
  const locale = normalizeLocale(input.primary_locale || 'id-ID');
  const res = await pgQuery(`
    INSERT INTO youtube_channels (id, tenant_id, name, channel_handle, primary_locale, created_by)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
  `, [id, tenantId, input.name, input.channel_handle || null, locale, actor?.username || 'system']);
  return res.rows[0];
}

export async function getChannel(id) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery('SELECT * FROM youtube_channels WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  return res.rows[0] || null;
}

export async function createOrUpdateStrategyDraft(channelId, input, actor) {
  const tenantId = getActiveTenantId();
  const channel = await getChannel(channelId);
  if (!channel) throw new Error('Channel not found or unauthorized');

  const resDraft = await pgQuery('SELECT * FROM youtube_channel_strategies WHERE channel_id = $1 AND tenant_id = $2 AND status = \'draft\'', [channelId, tenantId]);
  const draft = resDraft.rows[0];

  const strategyId = draft?.id || `yts_${Math.random().toString(36).slice(2, 10)}`;
  const configJson = JSON.stringify(input.config || {});
  const briefJson = JSON.stringify(input.brief || {});
  
  if (draft) {
    const res = await pgQuery(`
      UPDATE youtube_channel_strategies
      SET config_json = $1, brief_json = $2, universe_id = $3,
          visual_identity_preset_id = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5 AND tenant_id = $6 RETURNING *
    `, [configJson, briefJson, input.universe_id || null, input.visual_identity_preset_id || null, draft.id, tenantId]);
    return res.rows[0];
  } else {
    const res = await pgQuery(`
      INSERT INTO youtube_channel_strategies (id, tenant_id, channel_id, config_json, brief_json, status, universe_id, visual_identity_preset_id, created_by)
      VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, $8) RETURNING *
    `, [strategyId, tenantId, channelId, configJson, briefJson, input.universe_id || null, input.visual_identity_preset_id || null, actor?.username || 'system']);
    return res.rows[0];
  }
}

export async function getChannelStrategy(channelId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery('SELECT * FROM youtube_channel_strategies WHERE channel_id = $1 AND tenant_id = $2 AND status = \'active\'', [channelId, tenantId]);
  return res.rows[0] || null;
}

export async function getChannelDraftStrategy(channelId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery('SELECT * FROM youtube_channel_strategies WHERE channel_id = $1 AND tenant_id = $2 AND status = \'draft\'', [channelId, tenantId]);
  return res.rows[0] || null;
}

export async function activateStrategy(channelId, draftId, actor) {
  const tenantId = getActiveTenantId();
  
  const draftRes = await pgQuery('SELECT * FROM youtube_channel_strategies WHERE id = $1 AND channel_id = $2 AND tenant_id = $3 AND status = \'draft\'', [draftId, channelId, tenantId]);
  const draft = draftRes.rows[0];
  if (!draft) throw new Error('Draft strategy not found or unauthorized');

  return await withPgTransaction(async (client) => {
    // Archive previous active strategy
    await client.query(`
      UPDATE youtube_channel_strategies
      SET status = 'archived', updated_at = CURRENT_TIMESTAMP
      WHERE channel_id = $1 AND tenant_id = $2 AND status = 'active'
    `, [channelId, tenantId]);

    // Activate the current draft
    const res = await client.query(`
      UPDATE youtube_channel_strategies
      SET status = 'active', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND tenant_id = $2 RETURNING *
    `, [draftId, tenantId]);

    return res.rows[0];
  });
}

export async function listSeries(channelId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery('SELECT * FROM youtube_series WHERE channel_id = $1 AND tenant_id = $2 AND status = \'active\' ORDER BY name ASC', [channelId, tenantId]);
  return res.rows;
}

export async function createSeries(input, actor) {
  const tenantId = getActiveTenantId();
  
  const channel = await getChannel(input.channel_id);
  if (!channel) throw new Error('Channel not found or unauthorized');

  const strategy = await getChannelStrategy(input.channel_id);
  if (!strategy) throw new Error('Cannot create series: channel has no active strategy');

  const id = `ytsr_${Math.random().toString(36).slice(2, 10)}`;
  const res = await pgQuery(`
    INSERT INTO youtube_series (id, tenant_id, channel_id, strategy_id, name, pillar, config_json, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
  `, [id, tenantId, input.channel_id, strategy.id, input.name, input.pillar || null, JSON.stringify(input.config || {}), actor?.username || 'system']);
  return res.rows[0];
}

export async function listEpisodes(channelId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery('SELECT * FROM youtube_episodes WHERE channel_id = $1 AND tenant_id = $2 ORDER BY created_at DESC', [channelId, tenantId]);
  return res.rows;
}

export async function getEpisode(id) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery('SELECT * FROM youtube_episodes WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  return res.rows[0] || null;
}

export async function updateEpisodeStatus(id, status, actor) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery('UPDATE youtube_episodes SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3 RETURNING *', [status, id, tenantId]);
  return res.rows[0];
}

export async function getLatestScript(episodeId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery('SELECT * FROM youtube_episode_scripts WHERE episode_id = $1 AND tenant_id = $2 ORDER BY version DESC LIMIT 1', [episodeId, tenantId]);
  return res.rows[0] || null;
}

export async function transitionEpisode(id, nextState, actor) {
  const tenantId = getActiveTenantId();
  return await withPgTransaction(async (client) => {
    const resEp = await client.query('SELECT status FROM youtube_episodes WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [id, tenantId]);
    const ep = resEp.rows[0];
    if (!ep) throw new Error('Episode not found or unauthorized');
    
    assertEpisodeTransition(ep.status, nextState);
    
    const res = await client.query('UPDATE youtube_episodes SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3 RETURNING *', [nextState, id, tenantId]);
    return res.rows[0];
  });
}

import { getGeminiModel } from './gemini.js';
import { parseGeminiJSON } from './json-parser.js';

export async function approveScript(id, actor, reviewNote = null, options = {}) {
  const tenantId = getActiveTenantId();
  
  const scriptRes = await pgQuery('SELECT * FROM youtube_episode_scripts WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  const scriptRecord = scriptRes.rows[0];
  if (!scriptRecord) throw new Error('Script not found');

  const episode = await getEpisode(scriptRecord.episode_id);
  if (!episode) throw new Error('Episode not found');

  const analysis = analyzeNarrationDuration({
    script: scriptRecord.script_json,
    targetSeconds: episode.target_duration_seconds,
    profileKey: episode.narration_profile_key || 'general_id'
  });

  assertNarrationApprovable(analysis, {
    allowOverride: options.allowDurationOverride === true
  });

  await pgQuery('UPDATE youtube_episode_scripts SET status = \'superseded\' WHERE episode_id = $1 AND tenant_id = $2 AND status = \'approved\'', [scriptRecord.episode_id, tenantId]);
  
  const auditDetails = {
    analysis,
    override_reason: options.overrideReason || null,
    override_approved: options.allowDurationOverride === true
  };

  const res = await pgQuery(`
    UPDATE youtube_episode_scripts
    SET status = $1, review_note = $2, approved_by = $3, approved_at = CURRENT_TIMESTAMP,
        context_snapshot_json = COALESCE(context_snapshot_json, '{}'::jsonb) || $4::jsonb
    WHERE id = $5 AND tenant_id = $6 RETURNING *
  `, [SCRIPT_STATES.APPROVED, reviewNote, actor?.username || 'system', JSON.stringify({ duration_analysis: auditDetails }), id, tenantId]);
  
  if (res.rows[0]) {
    await transitionEpisode(res.rows[0].episode_id, EPISODE_STATES.SCRIPT_APPROVED, actor);
  }
  return res.rows[0];
}

export async function autoFitScript(scriptId, actor) {
  const tenantId = getActiveTenantId();
  const scriptRes = await pgQuery('SELECT * FROM youtube_episode_scripts WHERE id = $1 AND tenant_id = $2', [scriptId, tenantId]);
  const scriptRecord = scriptRes.rows[0];
  if (!scriptRecord) throw new Error('Script not found');

  const episode = await getEpisode(scriptRecord.episode_id);
  const profileKey = episode.narration_profile_key || 'general_id';
  
  const analysis = analyzeNarrationDuration({
    script: scriptRecord.script_json,
    targetSeconds: episode.target_duration_seconds,
    profileKey
  });

  if (analysis.status === 'ready') {
    return scriptRecord; // Already fits perfectly
  }

  const isV2 = scriptRecord.script_json?.schema_version === 2;

  const model = await getGeminiModel();
  const prompt = isV2 ? `
    Anda adalah YouTube Video Editor & Scriptwriter.
    Tugas Anda adalah memodifikasi naskah voiceover agar durasi pembacaannya (TTS) pas dengan durasi visual per scene.
    Naskah Asli (Script v2):
    ${JSON.stringify(scriptRecord.script_json, null, 2)}

    Analysis Durasi Naskah Saat Ini:
    ${JSON.stringify(analysis, null, 2)}

    Ubah bidang "text" (dan subtitle_cue yang bersangkutan) di dalam array "audio_blocks" per scene sehingga jumlah kata mengikuti target ideal/pacing.
    Jangan mengubah block_id, speaker_id, type, visual_direction, scene_index, purpose, transition_note, atau structural fields lainnya.
    Hanya tambahkan/kurangi kata pada "text" (dan update "subtitle_cue" agar sama dengan "text") agar sesuai target.

    Kembalikan output JSON dengan skema script yang persis sama.
  ` : `
    Anda adalah YouTube Video Editor & Scriptwriter.
    Tugas Anda adalah memodifikasi naskah voiceover agar durasi pembacaannya (TTS) pas dengan durasi visual per scene.
    Naskah Asli (Script v1):
    ${JSON.stringify(scriptRecord.script_json, null, 2)}

    Analysis Durasi Naskah Saat Ini:
    ${JSON.stringify(analysis, null, 2)}

    Ubah bidang "voiceover" per scene sehingga jumlah kata mengikuti target ideal/pacing.
    Jangan mengubah visual_direction, scene_index, purpose, transition_note, atau structural fields lainnya.
    Hanya tambahkan/kurangi kata pada "voiceover" agar sesuai target.

    Kembalikan output JSON dengan skema script yang persis sama.
  `;

  const result = await model.generateContent(prompt);
  const rewrittenJson = parseGeminiJSON(result.response.text());
  
  // Validate rewritten script
  validateSceneScript(rewrittenJson, null, episode.target_duration_seconds);

  // Save as new version
  return await withPgTransaction(async (client) => {
    const latestRes = await client.query('SELECT version FROM youtube_episode_scripts WHERE episode_id = $1 AND tenant_id = $2 ORDER BY version DESC LIMIT 1', [scriptRecord.episode_id, tenantId]);
    const latest = latestRes.rows[0];
    const nextVer = latest ? latest.version + 1 : 1;
    const newId = `ytsc_${Math.random().toString(36).slice(2, 10)}`;

    const res = await client.query(`
      INSERT INTO youtube_episode_scripts (id, tenant_id, episode_id, blueprint_id, locale, script_json, version, status, context_snapshot_json, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9) RETURNING *
    `, [newId, tenantId, scriptRecord.episode_id, scriptRecord.blueprint_id, scriptRecord.locale, JSON.stringify(rewrittenJson), nextVer, JSON.stringify({ auto_fit_parent: scriptId }), actor?.username || 'system']);
    
    return res.rows[0];
  });
}


// Research brief operations
export async function getLatestResearchBrief(episodeId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery('SELECT * FROM youtube_episode_research_briefs WHERE episode_id = $1 AND tenant_id = $2 ORDER BY version DESC LIMIT 1', [episodeId, tenantId]);
  return res.rows[0] || null;
}

export async function listResearchBriefVersions(episodeId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery('SELECT * FROM youtube_episode_research_briefs WHERE episode_id = $1 AND tenant_id = $2 ORDER BY version DESC', [episodeId, tenantId]);
  return res.rows;
}

export async function saveResearchBrief(episodeId, contentJson, actor) {
  const tenantId = getActiveTenantId();
  
  return await withPgTransaction(async (client) => {
    // Check episode exists and ownership
    const epRes = await client.query('SELECT status FROM youtube_episodes WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [episodeId, tenantId]);
    const ep = epRes.rows[0];
    if (!ep) throw new Error('Episode not found or unauthorized');

    // Assert transition to RESEARCHING
    assertEpisodeTransition(ep.status, EPISODE_STATES.RESEARCHING);

    const latestRes = await client.query('SELECT version FROM youtube_episode_research_briefs WHERE episode_id = $1 AND tenant_id = $2 ORDER BY version DESC LIMIT 1', [episodeId, tenantId]);
    const latest = latestRes.rows[0];
    const nextVer = latest ? latest.version + 1 : 1;
    const id = `ytrb_${Math.random().toString(36).slice(2, 10)}`;
    
    // Insert new version
    const res = await client.query(`
      INSERT INTO youtube_episode_research_briefs (id, tenant_id, episode_id, content_json, version, status, created_by)
      VALUES ($1, $2, $3, $4, $5, 'approved', $6) RETURNING *
    `, [id, tenantId, episodeId, JSON.stringify(contentJson), nextVer, actor?.username || 'system']);
    
    // Update episode status
    await client.query('UPDATE youtube_episodes SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3', [EPISODE_STATES.RESEARCHING, episodeId, tenantId]);
    return res.rows[0];
  });
}

// Blueprint operations
export async function getLatestBlueprint(episodeId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery('SELECT * FROM youtube_episode_blueprints WHERE episode_id = $1 AND tenant_id = $2 ORDER BY version DESC LIMIT 1', [episodeId, tenantId]);
  return res.rows[0] || null;
}

export async function listBlueprintVersions(episodeId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery('SELECT * FROM youtube_episode_blueprints WHERE episode_id = $1 AND tenant_id = $2 ORDER BY version DESC', [episodeId, tenantId]);
  return res.rows;
}

export async function saveBlueprintDraft(episodeId, contentJson, snapshotJson, actor) {
  const tenantId = getActiveTenantId();
  
  return await withPgTransaction(async (client) => {
    const epRes = await client.query('SELECT status FROM youtube_episodes WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [episodeId, tenantId]);
    const ep = epRes.rows[0];
    if (!ep) throw new Error('Episode not found or unauthorized');

    assertEpisodeTransition(ep.status, EPISODE_STATES.BLUEPRINT_DRAFT);

    const latestRes = await client.query('SELECT version FROM youtube_episode_blueprints WHERE episode_id = $1 AND tenant_id = $2 ORDER BY version DESC LIMIT 1', [episodeId, tenantId]);
    const latest = latestRes.rows[0];
    const nextVer = latest ? latest.version + 1 : 1;
    const id = `ytbp_${Math.random().toString(36).slice(2, 10)}`;

    const res = await client.query(`
      INSERT INTO youtube_episode_blueprints (id, tenant_id, episode_id, content_json, version, status, context_snapshot_json, created_by)
      VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7) RETURNING *
    `, [id, tenantId, episodeId, JSON.stringify(contentJson), nextVer, JSON.stringify(snapshotJson), actor?.username || 'system']);
    
    await client.query('UPDATE youtube_episodes SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3', [EPISODE_STATES.BLUEPRINT_DRAFT, episodeId, tenantId]);
    return res.rows[0];
  });
}

export async function approveBlueprint(blueprintId, actor) {
  const tenantId = getActiveTenantId();
  const bpRes = await pgQuery('SELECT * FROM youtube_episode_blueprints WHERE id = $1 AND tenant_id = $2', [blueprintId, tenantId]);
  const bp = bpRes.rows[0];
  if (!bp) throw new Error('Blueprint not found or unauthorized');

  return await withPgTransaction(async (client) => {
    const epRes = await client.query('SELECT status FROM youtube_episodes WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [bp.episode_id, tenantId]);
    const ep = epRes.rows[0];
    if (!ep) throw new Error('Episode not found or unauthorized');

    assertEpisodeTransition(ep.status, EPISODE_STATES.BLUEPRINT_APPROVED);

    // Supersede previously approved blueprint for this episode
    await client.query('UPDATE youtube_episode_blueprints SET status = \'superseded\' WHERE episode_id = $1 AND tenant_id = $2 AND status = \'approved\'', [bp.episode_id, tenantId]);
    
    // Approve current blueprint
    const updated = await client.query(`
      UPDATE youtube_episode_blueprints 
      SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND tenant_id = $3 RETURNING *
    `, [actor?.username || 'system', blueprintId, tenantId]);

    // Invalidate dependent scripts
    await client.query('UPDATE youtube_episode_scripts SET status = \'superseded\' WHERE episode_id = $1 AND tenant_id = $2 AND status IN (\'draft\', \'approved\')', [bp.episode_id, tenantId]);

    // Update episode status
    await client.query('UPDATE youtube_episodes SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3', [EPISODE_STATES.BLUEPRINT_APPROVED, bp.episode_id, tenantId]);
    return updated.rows[0];
  });
}

// Script operations
export async function listScriptVersions(episodeId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery('SELECT * FROM youtube_episode_scripts WHERE episode_id = $1 AND tenant_id = $2 ORDER BY version DESC', [episodeId, tenantId]);
  return res.rows;
}

export async function saveScriptDraft(episodeId, blueprintId, contentJson, snapshotJson, actor) {
  const tenantId = getActiveTenantId();
  
  const epRes = await pgQuery('SELECT locale, status FROM youtube_episodes WHERE id = $1 AND tenant_id = $2', [episodeId, tenantId]);
  const ep = epRes.rows[0];
  if (!ep) throw new Error('Episode not found or unauthorized');

  return await withPgTransaction(async (client) => {
    assertEpisodeTransition(ep.status, EPISODE_STATES.SCRIPT_DRAFT);

    const latestRes = await client.query('SELECT version FROM youtube_episode_scripts WHERE episode_id = $1 AND tenant_id = $2 ORDER BY version DESC LIMIT 1', [episodeId, tenantId]);
    const latest = latestRes.rows[0];
    const nextVer = latest ? latest.version + 1 : 1;
    const id = `ytsc_${Math.random().toString(36).slice(2, 10)}`;

    const res = await client.query(`
      INSERT INTO youtube_episode_scripts (id, tenant_id, episode_id, blueprint_id, locale, script_json, version, status, context_snapshot_json, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9) RETURNING *
    `, [id, tenantId, episodeId, blueprintId, ep.locale || 'id-ID', JSON.stringify(contentJson), nextVer, JSON.stringify(snapshotJson), actor?.username || 'system']);
    
    await client.query('UPDATE youtube_episodes SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3', [EPISODE_STATES.SCRIPT_DRAFT, episodeId, tenantId]);
    return res.rows[0];
  });
}

export async function listEpisodeIdeas(seriesId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery('SELECT * FROM youtube_episode_ideas WHERE series_id = $1 AND tenant_id = $2 ORDER BY created_at DESC', [seriesId, tenantId]);
  return res.rows;
}

export async function adoptEpisodeIdea(ideaId, actor) {
  const tenantId = getActiveTenantId();
  
  const ideaRes = await pgQuery('SELECT * FROM youtube_episode_ideas WHERE id = $1 AND tenant_id = $2', [ideaId, tenantId]);
  const idea = ideaRes.rows[0];
  if (!idea) throw new Error('Episode idea not found or unauthorized');

  if (idea.status === 'adopted') {
    const existing = await pgQuery('SELECT * FROM youtube_episodes WHERE source_idea_id = $1 AND tenant_id = $2', [ideaId, tenantId]);
    if (existing.rows[0]) return existing.rows[0];
  }
  if (idea.status !== 'suggested') throw new Error('Only suggested ideas can be adopted');

  const strategy = await getChannelStrategy(idea.channel_id);
  const seriesRes = await pgQuery('SELECT * FROM youtube_series WHERE id = $1 AND tenant_id = $2', [idea.series_id, tenantId]);
  const series = seriesRes.rows[0];

  // Resolve target duration hierarchy
  const resolved = resolveEpisodeDuration({
    channelStrategy: strategy,
    series: series,
    episodeOverride: idea.target_duration_seconds
  });

  return await withPgTransaction(async (client) => {
    await client.query('UPDATE youtube_episode_ideas SET status = \'adopted\', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2', [ideaId, tenantId]);
    
    const id = `ytep_${Math.random().toString(36).slice(2, 10)}`;
    const res = await client.query(`
      INSERT INTO youtube_episodes (id, tenant_id, channel_id, series_id, strategy_id, title, locale, target_duration_seconds, duration_source, status, source_idea_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Planned', $10, $11) RETURNING *
    `, [id, tenantId, idea.channel_id, idea.series_id, idea.strategy_id, idea.title, idea.locale, resolved.target_duration_seconds, resolved.duration_source, ideaId, actor?.username || 'system']);
    
    return res.rows[0];
  });
}

export async function rejectEpisodeIdea(ideaId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery(`
    UPDATE youtube_episode_ideas
    SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND tenant_id = $2 AND status = 'suggested' RETURNING *
  `, [ideaId, tenantId]);
  return res.rows[0] || null;
}

export async function createPlannedEpisode({ channelId, seriesId, title, locale, sourceIdeaId = null, targetDurationOverride = null }, actor) {
  const tenantId = getActiveTenantId();

  const channel = await getChannel(channelId);
  if (!channel) throw new Error('Channel not found or unauthorized');

  const strategy = await getChannelStrategy(channelId);
  if (!strategy) throw new Error('Cannot create episode: channel has no active strategy');

  const seriesRes = await pgQuery('SELECT * FROM youtube_series WHERE id = $1 AND channel_id = $2 AND tenant_id = $3', [seriesId, channelId, tenantId]);
  const series = seriesRes.rows[0];
  if (!series) throw new Error('Series not found or channel mismatch');

  // Resolve target duration hierarchy
  const resolved = resolveEpisodeDuration({
    channelStrategy: strategy,
    series: series,
    episodeOverride: targetDurationOverride
  });

  const id = `ytep_${Math.random().toString(36).slice(2, 10)}`;
  const res = await pgQuery(`
    INSERT INTO youtube_episodes (id, tenant_id, channel_id, series_id, strategy_id, title, locale, target_duration_seconds, duration_source, status, source_idea_id, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Planned', $10, $11) RETURNING *
  `, [id, tenantId, channelId, seriesId, strategy.id, title, locale, resolved.target_duration_seconds, resolved.duration_source, sourceIdeaId, actor?.username || 'system']);

  return res.rows[0];
}

export async function updateEpisodeDuration(episodeId, newDuration, actor) {
  const tenantId = getActiveTenantId();
  const ep = await getEpisode(episodeId);
  if (!ep) throw new Error('Episode not found');
  if (ep.status !== 'Planned') throw new Error('Duration can only be modified before starting AI Research.');
  const normalized = normalizeTargetDuration(newDuration);
  const res = await pgQuery(`
    UPDATE youtube_episodes
    SET target_duration_seconds = $1, duration_source = 'episode', updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND tenant_id = $3 RETURNING *
  `, [normalized, episodeId, tenantId]);
  return res.rows[0];
}

export async function setEpisodeGenerationProfile(episodeId, profileKeyOrObj, actor) {
  const tenantId = getActiveTenantId();
  const ep = await getEpisode(episodeId);
  if (!ep) throw new Error('Episode not found');
  if (ep.status !== 'Script Approved') throw new Error('Generation profile can only be selected after the script is approved.');

  let key, voiceProvider = 'google_tts', voicePersona = 'Orus', voiceSpeed = 1.0;
  if (typeof profileKeyOrObj === 'object' && profileKeyOrObj !== null) {
    key = profileKeyOrObj.profileKey;
    voiceProvider = profileKeyOrObj.voiceProvider || 'google_tts';
    voicePersona = profileKeyOrObj.voicePersona || 'Orus';
    voiceSpeed = profileKeyOrObj.voiceSpeed !== undefined ? Number(profileKeyOrObj.voiceSpeed) : 1.0;
  } else {
    key = profileKeyOrObj;
  }

  const profile = getGenerationProfile(key);
  if (!profile) throw new Error('Invalid generation profile key');
  
  const res = await pgQuery(`
    UPDATE youtube_episodes
    SET generation_profile_key = $1, voice_provider = $2, voice_persona = $3, voice_speed = $4, updated_at = CURRENT_TIMESTAMP
    WHERE id = $5 AND tenant_id = $6 RETURNING *
  `, [profile.key, voiceProvider, voicePersona, voiceSpeed, episodeId, tenantId]);
  return res.rows[0];
}

export async function saveChannelNarrativeDefaults(channelId, narrativeDefaults, actor) {
  const tenantId = getActiveTenantId();
  const active = await getChannelStrategy(channelId);
  if (!active) throw new Error('Active channel strategy not found');

  const config = active.config_json || {};
  config.narrative_defaults = narrativeDefaults;

  const res = await pgQuery(`
    UPDATE youtube_channel_strategies
    SET config_json = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND tenant_id = $3 RETURNING *
  `, [JSON.stringify(config), active.id, tenantId]);
  return res.rows[0];
}

export async function saveSeriesNarrativeFormatAndCast(seriesId, format, cast, actor) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery('SELECT * FROM youtube_series WHERE id = $1 AND tenant_id = $2', [seriesId, tenantId]);
  const series = res.rows[0];
  if (!series) throw new Error('Series not found');

  const config = series.config_json || {};
  config.narrative_format = format;
  config.recurring_cast = cast;

  const updateRes = await pgQuery(`
    UPDATE youtube_series
    SET config_json = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND tenant_id = $3 RETURNING *
  `, [JSON.stringify(config), seriesId, tenantId]);
  return updateRes.rows[0];
}

export async function saveEpisodeStorySetup(episodeId, override, cast, actor) {
  const tenantId = getActiveTenantId();
  const ep = await getEpisode(episodeId);
  if (!ep) throw new Error('Episode not found');
  if (['Researching', 'Blueprint Draft', 'Script Draft', 'Script Approved'].includes(ep.status)) {
    throw new Error('Episode story setup is locked during or after generation.');
  }

  const narrativeConfig = {
    narrative_override: override,
    episode_cast: cast
  };

  const res = await pgQuery(`
    UPDATE youtube_episodes
    SET narrative_config_json = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND tenant_id = $3 RETURNING *
  `, [JSON.stringify(narrativeConfig), episodeId, tenantId]);
  return res.rows[0];
}

import { resolveNarrativeConfiguration } from './youtube-studio-narrative-resolver.js';

export async function getResolvedNarrativeSnapshot(episodeId) {
  const tenantId = getActiveTenantId();
  const episode = await getEpisode(episodeId);
  if (!episode) throw new Error('Episode not found');

  const seriesRes = await pgQuery('SELECT * FROM youtube_series WHERE id = $1 AND tenant_id = $2', [episode.series_id, tenantId]);
  const series = seriesRes.rows[0];

  const strategy = await getChannelStrategy(episode.channel_id);

  return resolveNarrativeConfiguration({ channelStrategy: strategy, series, episode });
}

// Channel Speakers operations
export async function getChannelSpeakers(channelId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery(`
    SELECT * FROM youtube_channel_speakers 
    WHERE channel_id = $1 AND tenant_id = $2 AND status = 'active'
    ORDER BY display_name ASC
  `, [channelId, tenantId]);
  return res.rows;
}

export async function getChannelSpeaker(channelId, speakerId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery(`
    SELECT * FROM youtube_channel_speakers 
    WHERE channel_id = $1 AND speaker_id = $2 AND tenant_id = $3
  `, [channelId, speakerId, tenantId]);
  return res.rows[0] || null;
}

export async function createChannelSpeaker(channelId, input, actor) {
  const tenantId = getActiveTenantId();
  const validated = validateSpeakerInput(input);

  const existing = await getChannelSpeaker(channelId, validated.speaker_id);
  if (existing) {
    if (existing.status === 'retired') {
      const res = await pgQuery(`
        UPDATE youtube_channel_speakers
        SET display_name = $1, speaker_type = $2, universe_character_id = $3, 
            description = $4, voice_identity_json = $5, status = 'active', updated_at = CURRENT_TIMESTAMP
        WHERE id = $6 RETURNING *
      `, [validated.display_name, validated.speaker_type, validated.universe_character_id, validated.description, JSON.stringify(validated.voice_identity_json), existing.id]);
      return res.rows[0];
    }
    throw new Error(`Speaker ID "${validated.speaker_id}" already exists and is active`);
  }

  const id = `ytcs_${Math.random().toString(36).slice(2, 10)}`;
  const res = await pgQuery(`
    INSERT INTO youtube_channel_speakers (
      id, tenant_id, channel_id, speaker_id, display_name, speaker_type, 
      universe_character_id, description, voice_identity_json, status, created_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10) RETURNING *
  `, [id, tenantId, channelId, validated.speaker_id, validated.display_name, validated.speaker_type, validated.universe_character_id, validated.description, JSON.stringify(validated.voice_identity_json), actor?.username || 'system']);
  
  return res.rows[0];
}

export async function updateChannelSpeaker(channelId, speakerId, input, actor) {
  const tenantId = getActiveTenantId();
  const validated = validateSpeakerInput({ ...input, speaker_id: speakerId });
  
  const res = await pgQuery(`
    UPDATE youtube_channel_speakers
    SET display_name = $1, speaker_type = $2, universe_character_id = $3, 
        description = $4, voice_identity_json = $5, updated_at = CURRENT_TIMESTAMP
    WHERE channel_id = $6 AND speaker_id = $7 AND tenant_id = $8 RETURNING *
  `, [validated.display_name, validated.speaker_type, validated.universe_character_id, validated.description, JSON.stringify(validated.voice_identity_json), channelId, speakerId, tenantId]);
  
  return res.rows[0] || null;
}

export async function retireChannelSpeaker(channelId, speakerId, actor) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery(`
    UPDATE youtube_channel_speakers
    SET status = 'retired', updated_at = CURRENT_TIMESTAMP
    WHERE channel_id = $1 AND speaker_id = $2 AND tenant_id = $3 RETURNING *
  `, [channelId, speakerId, tenantId]);
  
  return res.rows[0] || null;
}

// Voice castings operations
export async function getSpeakerVoiceCastings(channelSpeakerId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery(`
    SELECT * FROM youtube_speaker_voice_castings 
    WHERE channel_speaker_id = $1 AND tenant_id = $2 AND status = 'active'
  `, [channelSpeakerId, tenantId]);
  return res.rows;
}

export async function saveSpeakerVoiceCasting(channelSpeakerId, locale, input, actor) {
  const tenantId = getActiveTenantId();
  
  const speakerRes = await pgQuery(`SELECT * FROM youtube_channel_speakers WHERE id = $1 AND tenant_id = $2`, [channelSpeakerId, tenantId]);
  const speaker = speakerRes.rows[0];
  if (!speaker) throw new Error('Speaker not found');

  const validated = validateVoiceCasting(input);

  return await withPgTransaction(async (client) => {
    await client.query(`
      UPDATE youtube_speaker_voice_castings
      SET status = 'retired', updated_at = CURRENT_TIMESTAMP
      WHERE channel_speaker_id = $1 AND locale = $2 AND binding_kind = $3 AND provider = $4 AND tenant_id = $5 AND status = 'active'
    `, [channelSpeakerId, locale, validated.binding_kind, validated.provider, tenantId]);

    const id = `ytvc_${Math.random().toString(36).slice(2, 10)}`;
    const res = await client.query(`
      INSERT INTO youtube_speaker_voice_castings (
        id, tenant_id, channel_speaker_id, locale, binding_kind, provider, 
        persona_key, voice_reference_id, descriptive_voice_prompt, speed, 
        delivery_json, pronunciation_json, status, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active', $13) RETURNING *
    `, [
      id, tenantId, channelSpeakerId, locale, validated.binding_kind, validated.provider,
      validated.persona_key, validated.voice_reference_id, validated.descriptive_voice_prompt,
      validated.speed, JSON.stringify(validated.delivery_json), JSON.stringify(validated.pronunciation_json),
      actor?.username || 'system'
    ]);

    return res.rows[0];
  });
}

// Audio configuration operations
export async function getChannelAudioConfig(channelId, locale = 'id-ID') {
  const tenantId = getActiveTenantId();
  const res = await pgQuery(`
    SELECT * FROM youtube_channel_audio_configs 
    WHERE channel_id = $1 AND locale = $2 AND tenant_id = $3 AND status = 'active'
  `, [channelId, locale, tenantId]);
  return res.rows[0] || null;
}

export async function getChannelDraftAudioConfig(channelId, locale = 'id-ID') {
  const tenantId = getActiveTenantId();
  const res = await pgQuery(`
    SELECT * FROM youtube_channel_audio_configs 
    WHERE channel_id = $1 AND locale = $2 AND tenant_id = $3 AND status = 'draft'
  `, [channelId, locale, tenantId]);
  return res.rows[0] || null;
}

export async function createDraftChannelAudioConfig(channelId, input, actor) {
  const tenantId = getActiveTenantId();
  const locale = input.locale || 'id-ID';
  const validated = validateChannelAudioConfig(input);

  const activeConfig = await getChannelAudioConfig(channelId, locale);
  const nextVer = activeConfig ? activeConfig.version + 1 : 1;

  const draftConfig = await getChannelDraftAudioConfig(channelId, locale);

  if (draftConfig) {
    const res = await pgQuery(`
      UPDATE youtube_channel_audio_configs
      SET audio_production_mode = $1, audio_experience = $2, provider = $3, 
          model_key = $4, synthesis_strategy = $5, native_voice_capability = $6,
          sonic_identity_json = $7, updated_at = CURRENT_TIMESTAMP
      WHERE id = $8 AND tenant_id = $9 RETURNING *
    `, [
      validated.audio_production_mode, validated.audio_experience, validated.provider,
      validated.model_key, validated.synthesis_strategy, validated.native_voice_capability,
      JSON.stringify(validated.sonic_identity_json), draftConfig.id, tenantId
    ]);
    return res.rows[0];
  }

  const id = `ytac_${Math.random().toString(36).slice(2, 10)}`;
  const res = await pgQuery(`
    INSERT INTO youtube_channel_audio_configs (
      id, tenant_id, channel_id, locale, audio_production_mode, audio_experience, 
      provider, model_key, synthesis_strategy, native_voice_capability, 
      sonic_identity_json, status, version, created_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'draft', $12, $13) RETURNING *
  `, [
    id, tenantId, channelId, locale, validated.audio_production_mode, validated.audio_experience,
    validated.provider, validated.model_key, validated.synthesis_strategy, validated.native_voice_capability,
    JSON.stringify(validated.sonic_identity_json), nextVer, actor?.username || 'system'
  ]);

  return res.rows[0];
}

export async function activateChannelAudioConfig(channelId, configId, actor) {
  const tenantId = getActiveTenantId();

  const configRes = await pgQuery(`
    SELECT * FROM youtube_channel_audio_configs 
    WHERE id = $1 AND channel_id = $2 AND tenant_id = $3
  `, [configId, channelId, tenantId]);
  const config = configRes.rows[0];
  if (!config) throw new Error('Audio configuration not found');
  if (config.status !== 'draft') throw new Error('Only draft configurations can be activated');

  const locale = config.locale;

  const speakers = await getChannelSpeakers(channelId);
  const activeSpeakers = speakers.filter(s => s.status === 'active');

  const incompleteSpeakers = [];
  const mode = config.audio_production_mode;
  const provider = config.provider;

  for (const speaker of activeSpeakers) {
    const castings = await getSpeakerVoiceCastings(speaker.id);
    const localeCasting = castings.find(c => c.locale === locale && c.provider === provider);
    
    if (!localeCasting) {
      incompleteSpeakers.push(speaker.speaker_id);
    } else {
      if (mode === 'standalone_tts' && localeCasting.binding_kind !== 'tts') {
        incompleteSpeakers.push(speaker.speaker_id);
      }
      if (mode === 'native_scene_audio' && localeCasting.binding_kind !== 'flow_native') {
        incompleteSpeakers.push(speaker.speaker_id);
      }
    }
  }

  if (incompleteSpeakers.length > 0) {
    const error = new Error(`${incompleteSpeakers.length} active speakers have no valid voice binding for locale "${locale}" and mode "${mode}"`);
    error.code = 'YT_AUDIO_BINDING_INCOMPLETE';
    error.details = { speaker_ids: incompleteSpeakers };
    throw error;
  }

  return await withPgTransaction(async (client) => {
    await client.query(`
      UPDATE youtube_channel_audio_configs
      SET status = 'superseded', updated_at = CURRENT_TIMESTAMP
      WHERE channel_id = $1 AND locale = $2 AND tenant_id = $3 AND status = 'active'
    `, [channelId, locale, tenantId]);

    const res = await client.query(`
      UPDATE youtube_channel_audio_configs
      SET status = 'active', activated_by = $1, activated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND tenant_id = $3 RETURNING *
    `, [actor?.username || 'system', configId, tenantId]);

    return res.rows[0];
  });
}

// Sonic Identity operations
export async function getChannelSonicIdentity(channelId) {
  const activeConfig = await getChannelAudioConfig(channelId);
  return activeConfig?.sonic_identity_json || {};
}

export async function updateChannelSonicIdentity(channelId, sonicIdentityInput, actor) {
  const tenantId = getActiveTenantId();
  const validated = validateSonicIdentity(sonicIdentityInput);

  const activeConfig = await getChannelAudioConfig(channelId);
  if (!activeConfig) throw new Error('Active audio config is required to set Sonic Identity');

  const res = await pgQuery(`
    UPDATE youtube_channel_audio_configs
    SET sonic_identity_json = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND tenant_id = $3 RETURNING *
  `, [JSON.stringify(validated), activeConfig.id, tenantId]);

  return res.rows[0];
}

// Series Cast Bindings
export async function replaceSeriesCastBindings(seriesId, speakerIds, actor) {
  const tenantId = getActiveTenantId();

  return await withPgTransaction(async (client) => {
    await client.query(`
      DELETE FROM youtube_series_cast_bindings 
      WHERE series_id = $1 AND tenant_id = $2
    `, [seriesId, tenantId]);

    const bindings = [];
    for (const speakerId of speakerIds) {
      const speakerRes = await client.query(`
        SELECT id FROM youtube_channel_speakers 
        WHERE id = $1 AND tenant_id = $2 AND status = 'active'
      `, [speakerId, tenantId]);
      
      const speaker = speakerRes.rows[0];
      if (!speaker) throw new Error(`Speaker "${speakerId}" not found or retired in Channel Registry`);

      const id = `ytsr_cb_${Math.random().toString(36).slice(2, 10)}`;
      const res = await client.query(`
        INSERT INTO youtube_series_cast_bindings (id, tenant_id, series_id, channel_speaker_id)
        VALUES ($1, $2, $3, $4) RETURNING *
      `, [id, tenantId, seriesId, speaker.id]);
      bindings.push(res.rows[0]);
    }
    return bindings;
  });
}

export async function getSeriesCastBindings(seriesId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery(`
    SELECT cs.*, b.recurring_role, b.relationship_json FROM youtube_series_cast_bindings b
    JOIN youtube_channel_speakers cs ON b.channel_speaker_id = cs.id
    WHERE b.series_id = $1 AND b.tenant_id = $2
  `, [seriesId, tenantId]);
  return res.rows;
}

// Episode Cast Bindings
export async function replaceEpisodeCastBindings(episodeId, speakerIds, actor) {
  const tenantId = getActiveTenantId();
  const episode = await getEpisode(episodeId);
  if (!episode) throw new Error('Episode not found');

  return await withPgTransaction(async (client) => {
    await client.query(`
      DELETE FROM youtube_episode_cast_bindings 
      WHERE episode_id = $1 AND tenant_id = $2
    `, [episodeId, tenantId]);

    const bindings = [];
    for (const speakerId of speakerIds) {
      const seriesCastRes = await client.query(`
        SELECT cs.id FROM youtube_series_cast_bindings b
        JOIN youtube_channel_speakers cs ON b.channel_speaker_id = cs.id
        WHERE b.series_id = $1 AND cs.id = $2 AND b.tenant_id = $3
      `, [episode.series_id, speakerId, tenantId]);

      const seriesCast = seriesCastRes.rows[0];
      if (!seriesCast) {
        throw new Error(`Speaker "${speakerId}" is not in the Series recurring cast registry`);
      }

      const id = `ytep_cb_${Math.random().toString(36).slice(2, 10)}`;
      const res = await client.query(`
        INSERT INTO youtube_episode_cast_bindings (id, tenant_id, episode_id, channel_speaker_id)
        VALUES ($1, $2, $3, $4) RETURNING *
      `, [id, tenantId, episodeId, speakerId]);
      bindings.push(res.rows[0]);
    }
    return bindings;
  });
}

export async function getEpisodeCastBindings(episodeId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery(`
    SELECT cs.*, b.episode_role, b.objective FROM youtube_episode_cast_bindings b
    JOIN youtube_channel_speakers cs ON b.channel_speaker_id = cs.id
    WHERE b.episode_id = $1 AND b.tenant_id = $2
  `, [episodeId, tenantId]);
  return res.rows;
}


