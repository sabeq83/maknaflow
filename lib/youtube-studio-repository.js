import { pgQuery } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';
import { EPISODE_STATES, SCRIPT_STATES } from './youtube-studio-contract.js';

export async function listChannels() {
  const tenantId = getActiveTenantId();
  const res = await pgQuery('SELECT * FROM youtube_channels WHERE tenant_id = $1 ORDER BY name ASC', [tenantId]);
  return res.rows;
}

export async function createChannel(input, actor) {
  const tenantId = getActiveTenantId();
  const id = `ytc_${Math.random().toString(36).slice(2, 10)}`;
  const res = await pgQuery(`
    INSERT INTO youtube_channels (id, tenant_id, name, channel_handle, primary_locale, created_by)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
  `, [id, tenantId, input.name, input.channel_handle || null, input.primary_locale || 'id-ID', actor?.username || 'system']);
  return res.rows[0];
}

export async function getChannel(id) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery('SELECT * FROM youtube_channels WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  return res.rows[0] || null;
}

export async function updateChannelStrategy(channelId, input, actor) {
  const tenantId = getActiveTenantId();
  let strategy = await getChannelStrategy(channelId);
  const strategyId = strategy?.id || `yts_${Math.random().toString(36).slice(2, 10)}`;
  
  const configJson = JSON.stringify(input.config || {});
  const universeSnapshot = input.universe_snapshot_json ? JSON.stringify(input.universe_snapshot_json) : null;
  const visualIdentitySnapshot = input.visual_identity_snapshot_json ? JSON.stringify(input.visual_identity_snapshot_json) : null;

  if (strategy) {
    const res = await pgQuery(`
      UPDATE youtube_channel_strategies
      SET config_json = $1, universe_id = $2, universe_snapshot_json = $3,
          visual_identity_preset_id = $4, visual_identity_version = $5, visual_identity_snapshot_json = $6,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND tenant_id = $8 RETURNING *
    `, [configJson, input.universe_id || null, universeSnapshot,
        input.visual_identity_preset_id || null, input.visual_identity_version || null, visualIdentitySnapshot,
        strategy.id, tenantId]);
    return res.rows[0];
  } else {
    const res = await pgQuery(`
      INSERT INTO youtube_channel_strategies (id, tenant_id, channel_id, config_json, universe_id, universe_snapshot_json,
                                             visual_identity_preset_id, visual_identity_version, visual_identity_snapshot_json, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
    `, [strategyId, tenantId, channelId, configJson, input.universe_id || null, universeSnapshot,
        input.visual_identity_preset_id || null, input.visual_identity_version || null, visualIdentitySnapshot, actor?.username || 'system']);
    return res.rows[0];
  }
}

export async function getChannelStrategy(channelId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery('SELECT * FROM youtube_channel_strategies WHERE channel_id = $1 AND tenant_id = $2 AND status = \'active\'', [channelId, tenantId]);
  return res.rows[0] || null;
}

export async function listSeries(channelId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery('SELECT * FROM youtube_series WHERE channel_id = $1 AND tenant_id = $2 AND status = \'active\' ORDER BY name ASC', [channelId, tenantId]);
  return res.rows;
}

export async function createSeries(input, actor) {
  const tenantId = getActiveTenantId();
  const id = `ytsr_${Math.random().toString(36).slice(2, 10)}`;
  const res = await pgQuery(`
    INSERT INTO youtube_series (id, tenant_id, channel_id, strategy_id, name, pillar, config_json, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
  `, [id, tenantId, input.channel_id, input.strategy_id, input.name, input.pillar || null, JSON.stringify(input.config || {}), actor?.username || 'system']);
  return res.rows[0];
}

export async function listEpisodes(channelId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery('SELECT * FROM youtube_episodes WHERE channel_id = $1 AND tenant_id = $2 ORDER BY created_at DESC', [channelId, tenantId]);
  return res.rows;
}

export async function createEpisode(input, actor) {
  const tenantId = getActiveTenantId();
  const id = `ytep_${Math.random().toString(36).slice(2, 10)}`;
  const res = await pgQuery(`
    INSERT INTO youtube_episodes (id, tenant_id, channel_id, series_id, strategy_id, title, locale, target_duration_seconds, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
  `, [id, tenantId, input.channel_id, input.series_id, input.strategy_id, input.title, input.locale || 'id-ID', input.target_duration_seconds || 600, actor?.username || 'system']);
  return res.rows[0];
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

export async function approveScript(id, actor, reviewNote = null) {
  const tenantId = getActiveTenantId();
  
  await pgQuery('UPDATE youtube_episode_scripts SET status = \'superseded\' WHERE episode_id = (SELECT episode_id FROM youtube_episode_scripts WHERE id = $1) AND tenant_id = $2 AND status = \'approved\'', [id, tenantId]);
  
  const res = await pgQuery(`
    UPDATE youtube_episode_scripts
    SET status = $1, review_note = $2, approved_by = $3, approved_at = CURRENT_TIMESTAMP
    WHERE id = $4 AND tenant_id = $5 RETURNING *
  `, [SCRIPT_STATES.APPROVED, reviewNote, actor?.username || 'system', id, tenantId]);
  
  if (res.rows[0]) {
    await updateEpisodeStatus(res.rows[0].episode_id, EPISODE_STATES.SCRIPT_APPROVED, actor);
  }
  return res.rows[0];
}
