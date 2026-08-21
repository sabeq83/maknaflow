import { pgQuery, withPgTransaction } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';
import { EPISODE_STATES, SCRIPT_STATES, normalizeLocale, assertEpisodeTransition } from './youtube-studio-contract.js';

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

export async function approveScript(id, actor, reviewNote = null) {
  const tenantId = getActiveTenantId();
  
  await pgQuery('UPDATE youtube_episode_scripts SET status = \'superseded\' WHERE episode_id = (SELECT episode_id FROM youtube_episode_scripts WHERE id = $1) AND tenant_id = $2 AND status = \'approved\'', [id, tenantId]);
  
  const res = await pgQuery(`
    UPDATE youtube_episode_scripts
    SET status = $1, review_note = $2, approved_by = $3, approved_at = CURRENT_TIMESTAMP
    WHERE id = $4 AND tenant_id = $5 RETURNING *
  `, [SCRIPT_STATES.APPROVED, reviewNote, actor?.username || 'system', id, tenantId]);
  
  if (res.rows[0]) {
    await transitionEpisode(res.rows[0].episode_id, EPISODE_STATES.SCRIPT_APPROVED, actor);
  }
  return res.rows[0];
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

  return await withPgTransaction(async (client) => {
    await client.query('UPDATE youtube_episode_ideas SET status = \'adopted\', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2', [ideaId, tenantId]);
    
    const id = `ytep_${Math.random().toString(36).slice(2, 10)}`;
    const res = await client.query(`
      INSERT INTO youtube_episodes (id, tenant_id, channel_id, series_id, strategy_id, title, locale, target_duration_seconds, status, source_idea_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Planned', $9, $10) RETURNING *
    `, [id, tenantId, idea.channel_id, idea.series_id, idea.strategy_id, idea.title, idea.locale, idea.target_duration_seconds || 600, ideaId, actor?.username || 'system']);
    
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

export async function createPlannedEpisode({ channelId, seriesId, title, locale, sourceIdeaId = null }, actor) {
  const tenantId = getActiveTenantId();

  const channel = await getChannel(channelId);
  if (!channel) throw new Error('Channel not found or unauthorized');

  const strategy = await getChannelStrategy(channelId);
  if (!strategy) throw new Error('Cannot create episode: channel has no active strategy');

  const seriesRes = await pgQuery('SELECT * FROM youtube_series WHERE id = $1 AND channel_id = $2 AND tenant_id = $3', [seriesId, channelId, tenantId]);
  const series = seriesRes.rows[0];
  if (!series) throw new Error('Series not found or channel mismatch');

  const id = `ytep_${Math.random().toString(36).slice(2, 10)}`;
  const res = await pgQuery(`
    INSERT INTO youtube_episodes (id, tenant_id, channel_id, series_id, strategy_id, title, locale, status, source_idea_id, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'Planned', $8, $9) RETURNING *
  `, [id, tenantId, channelId, seriesId, strategy.id, title, locale, actor?.username || 'system', sourceIdeaId]);

  return res.rows[0];
}
