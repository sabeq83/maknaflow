import crypto from 'crypto';
import { getPgPool, pgQuery, withPgTransaction } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';
import { initUserTables } from './schema/user-schema.js';

// PostgreSQL helper classes and functions for SQLite compatibility
export function sqliteToPgQuery(sql) {
  let index = 1;
  let target = sql;
  
  // 1. Translate INSERT OR REPLACE
  target = target.replace(/INSERT OR REPLACE INTO (\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/ig, (m, table, cols, vals) => {
    const colArr = cols.split(',').map(c => c.trim());
    let conflictCol = 'id';
    const tblLower = table.toLowerCase();
    if (tblLower === 'settings') conflictCol = 'key';
    else if (tblLower === 'glabs_task_routes') conflictCol = 'task_id';
    else if (tblLower === 'glabs_tasks') conflictCol = 'task_id';
    else if (tblLower === 'scheduler_config') conflictCol = 'queue_name';
    else if (tblLower === 'api_key_usages') conflictCol = 'date, key_id';
    
    const updates = colArr.filter(c => c !== conflictCol).map(c => `${c} = EXCLUDED.${c}`).join(', ');
    return `INSERT INTO ${table} (${cols}) VALUES (${vals}) ON CONFLICT (${conflictCol}) DO UPDATE SET ${updates}`;
  });
  
  // 2. Translate INSERT OR IGNORE
  target = target.replace(/INSERT OR IGNORE INTO (\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/ig, (m, table, cols, vals) => {
    let conflictCol = 'id';
    const tblLower = table.toLowerCase();
    if (tblLower === 'gemini_api_keys') conflictCol = 'api_key';
    else if (tblLower === 'scheduler_config') conflictCol = 'queue_name';
    return `INSERT INTO ${table} (${cols}) VALUES (${vals}) ON CONFLICT (${conflictCol}) DO NOTHING`;
  });
  
  // 3. Replace ? with $1, $2...
  target = target.replace(/\?/g, () => `$${index++}`);
  
  return target;
}

export function translateNamedParams(sql, params) {
  if (params && params.length === 1 && typeof params[0] === 'object' && params[0] !== null && !Array.isArray(params[0])) {
    const obj = params[0];
    const matches = sql.match(/@(\w+)/g);
    if (matches) {
      let index = 1;
      let translatedSql = sql;
      const flatParams = [];
      for (const match of matches) {
        const key = match.substring(1);
        flatParams.push(obj[key] !== undefined ? obj[key] : null);
        translatedSql = translatedSql.replace(match, `?`);
      }
      return { sql: translatedSql, params: flatParams };
    }
  }
  return { sql, params };
}

export function interceptQuery(sql, params) {
  let { sql: targetSql, params: targetParams } = translateNamedParams(sql, params);
  const tenantId = getActiveTenantId();

  const isolatedTables = [
    'users',
    'brand_profiles',
    'gemini_api_keys',
    'content_planners',
    'strategic_campaigns',
    'pillar_campaigns',
    'operator_jobs',
    'operator_job_events',
    're_campaigns',
    'instant_campaigns',
    'ideas',
    'knowledge_bases',
    'bridge_injector_campaigns',
    'universe_profiles',
    'universe_characters',
    'universe_locations',
    'universe_episodes'
  ];

  let matchesTable = false;
  for (const table of isolatedTables) {
    const tableRegex = new RegExp(`\\b${table}\\b`, 'i');
    if (tableRegex.test(targetSql)) {
      matchesTable = true;
      break;
    }
  }

  if (!matchesTable || tenantId === '__none__') {
    return { sql: targetSql, params: targetParams };
  }

  if (targetSql.toLowerCase().includes('tenant_id')) {
    return { sql: targetSql, params: targetParams };
  }

  const insertRegex = /INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i;
  if (insertRegex.test(targetSql)) {
    targetSql = targetSql.replace(insertRegex, (m, table, cols, vals) => {
      return `INSERT INTO ${table} (${cols}, tenant_id) VALUES (${vals}, ?)`;
    });
    targetParams.push(tenantId);
    return { sql: targetSql, params: targetParams };
  }

  const selectOrUpdateOrDeleteRegex = /^\s*(SELECT|UPDATE|DELETE)\b/i;
  if (selectOrUpdateOrDeleteRegex.test(targetSql)) {
    const suffixRegex = /\b(ORDER\s+BY|LIMIT|GROUP\s+BY|HAVING|OFFSET|UNION)\b/i;
    const matchSuffix = targetSql.match(suffixRegex);

    let queryPart = targetSql;
    let suffixPart = '';

    if (matchSuffix) {
      const idx = targetSql.search(suffixRegex);
      queryPart = targetSql.substring(0, idx);
      suffixPart = targetSql.substring(idx);
    }

    if (/\bWHERE\b/i.test(queryPart)) {
      queryPart = queryPart + ' AND tenant_id = ?';
    } else {
      queryPart = queryPart + ' WHERE tenant_id = ?';
    }

    targetSql = `${queryPart.trimEnd()} ${suffixPart.trimStart()}`;
    const suffixPlaceholderCount = (suffixPart.match(/\?/g) || []).length;
    if (suffixPlaceholderCount > 0) {
      targetParams.splice(targetParams.length - suffixPlaceholderCount, 0, tenantId);
    } else {
      targetParams.push(tenantId);
    }
  }

  return { sql: targetSql, params: targetParams };
}

export async function dbAll(sql, params = []) {
  const { sql: finalSql, params: finalParams } = interceptQuery(sql, params);
  const res = await pgQuery(sqliteToPgQuery(finalSql), finalParams);
  return res.rows;
}

export async function dbGet(sql, params = []) {
  const { sql: finalSql, params: finalParams } = interceptQuery(sql, params);
  const res = await pgQuery(sqliteToPgQuery(finalSql), finalParams);
  return res.rows[0] || null;
}

export async function dbRun(sql, params = []) {
  const { sql: finalSql, params: finalParams } = interceptQuery(sql, params);
  const res = await pgQuery(sqliteToPgQuery(finalSql), finalParams);
  return { changes: res.rowCount, rowCount: res.rowCount };
}

class PgStatement {
  constructor(sql) {
    this.sql = sql;
  }
  async all(...params) {
    const finalParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    return dbAll(this.sql, finalParams);
  }
  async get(...params) {
    const finalParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    return dbGet(this.sql, finalParams);
  }
  async run(...params) {
    const finalParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    return dbRun(this.sql, finalParams);
  }
}

// Caches for synchronous access
export const settingsCache = {}; // Global/legacy settings fallback
export const tenantSettingsCache = {}; // { tenantId: { key: value } }
export const brandProfilesCache = {}; // { tenantId: { brandName: nextcloudFolder } }
export const brandProfilesCacheById = {}; // { tenantId: { brandId: brandName } }
export const glabsTaskRoutesCache = {};

export async function loadDbCaches() {
  try {
    // 0. Initialize and migrate User & Permission tables
    await initUserTables(db);

    // 1. Load tenant_settings
    const settings = await dbAll('SELECT tenant_id, setting_key, setting_value FROM tenant_settings', []);
    for (const s of settings) {
      if (!tenantSettingsCache[s.tenant_id]) {
        tenantSettingsCache[s.tenant_id] = {};
      }
      tenantSettingsCache[s.tenant_id][s.setting_key] = s.setting_value;
    }
    // Align settingsCache with default_tenant for backward compatibility
    const defaultSettings = tenantSettingsCache['default_tenant'] || {};
    for (const [k, v] of Object.entries(defaultSettings)) {
      settingsCache[k] = v;
    }
    const { hydrateOperatorPresetCache } = await import('./operator-presets.js');
    for (const [tenantId, values] of Object.entries(tenantSettingsCache)) {
      hydrateOperatorPresetCache(tenantId, values.operator_presets_json || '{}');
    }

    // 2. Load brand_profiles
    const brands = await dbAll('SELECT id, brand_name, tenant_id, nextcloud_parent_folder FROM brand_profiles', []);
    for (const b of brands) {
      const tid = b.tenant_id || 'default_tenant';
      if (b.brand_name) {
        if (!brandProfilesCache[tid]) brandProfilesCache[tid] = {};
        if (!brandProfilesCacheById[tid]) brandProfilesCacheById[tid] = {};
        brandProfilesCache[tid][b.brand_name.toLowerCase()] = b.nextcloud_parent_folder;
        brandProfilesCacheById[tid][b.id] = b.brand_name;
      }
    }

    // 3. Load task routes
    const routes = await dbAll('SELECT task_id, host, port, api_key FROM glabs_task_routes', []);
    for (const r of routes) {
      glabsTaskRoutesCache[r.task_id] = { host: r.host, port: r.port, api_key: r.api_key };
    }
    console.log('[PostgreSQL Cache] Multi-tenant Settings, brand profiles, and task routes cached successfully.');
  } catch (e) {
    console.warn('[PostgreSQL Cache Warning] Failed to load database caches:', e.message);
  }
}

// Automatically load caches at boot
setTimeout(() => {
  loadDbCaches().catch(err => console.error('Failed to load DB caches at startup:', err));
}, 500);

export function getBrandProfileByNameSync(brandName) {
  if (!brandName) return null;
  const tenantId = getActiveTenantId();
  const folder = brandProfilesCache[tenantId]?.[brandName.toLowerCase()] || brandProfilesCache['default_tenant']?.[brandName.toLowerCase()];
  return folder ? { nextcloud_target_folder: folder } : null;
}

export function getBrandNameByIdSync(id) {
  const tenantId = getActiveTenantId();
  return brandProfilesCacheById[tenantId]?.[id] || brandProfilesCacheById['default_tenant']?.[id] || null;
}

export function getGlabsTaskRouteSync(taskId) {
  return glabsTaskRoutesCache[taskId] || null;
}

export function getGlabsTaskRouteByFilenameSync(filename) {
  if (!filename) return null;
  for (const taskId of Object.keys(glabsTaskRoutesCache)) {
    if (filename.toLowerCase().includes(taskId.toLowerCase())) {
      return glabsTaskRoutesCache[taskId];
    }
  }
  return null;
}

const db = {
  prepare: (sql) => new PgStatement(sql),
  transaction: (fn) => fn,
  exec: async (sql) => {
    return await pgQuery(sql, []);
  }
};

export function getDb() {
  return db;
}

const OPERATOR_JOB_UPDATE_FIELDS = new Set([
  'status', 'current_stage', 'planner_id', 'campaign_id', 'result_json',
  'error_code', 'error_message', 'locked_at', 'locked_by', 'attempt_count',
  'next_attempt_at'
]);

export async function createOperatorJob({ idempotencyKey, requestHash, requestJson }) {
  const tenantId = getActiveTenantId();
  const id = `opj_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
  const inserted = await pgQuery(`
    INSERT INTO operator_jobs (
      id, tenant_id, idempotency_key, request_hash, request_json
    ) VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
    RETURNING *
  `, [id, tenantId, idempotencyKey, requestHash, requestJson]);
  if (inserted.rows[0]) return { ...inserted.rows[0], created: true };
  const existing = await pgQuery(
    'SELECT * FROM operator_jobs WHERE tenant_id = $1 AND idempotency_key = $2',
    [tenantId, idempotencyKey]
  );
  return existing.rows[0] ? { ...existing.rows[0], created: false } : null;
}

export async function getOperatorJob(id) {
  const tenantId = getActiveTenantId();
  const result = await pgQuery(
    'SELECT * FROM operator_jobs WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  );
  return result.rows[0] || null;
}

export async function listActiveOperatorJobs() {
  const tenantId = getActiveTenantId();
  const result = await pgQuery(`
    SELECT * FROM operator_jobs
    WHERE tenant_id = $1
      AND status IN ('campaign_queued', 'awaiting_approval', 'producing')
    ORDER BY created_at ASC
  `, [tenantId]);
  return result.rows;
}

export async function updateOperatorJob(id, updates) {
  const tenantId = getActiveTenantId();
  const entries = Object.entries(updates).filter(([key]) => OPERATOR_JOB_UPDATE_FIELDS.has(key));
  if (entries.length === 0) return getOperatorJob(id);
  const fields = entries.map(([key], index) => `${key} = $${index + 1}`);
  const values = entries.map(([, value]) => value);
  values.push(id, tenantId);
  const result = await pgQuery(`
    UPDATE operator_jobs
    SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $${values.length - 1} AND tenant_id = $${values.length}
    RETURNING *
  `, values);
  return result.rows[0] || null;
}

export async function appendOperatorJobEvent(jobId, eventType, event = {}) {
  const tenantId = getActiveTenantId();
  await pgQuery(`
    INSERT INTO operator_job_events (tenant_id, job_id, event_type, event_json)
    VALUES ($1, $2, $3, $4)
  `, [tenantId, jobId, eventType, JSON.stringify(event)]);
}

export async function claimNextOperatorJob(workerId) {
  const tenantId = getActiveTenantId();
  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');
    const selected = await client.query(`
      SELECT * FROM operator_jobs
      WHERE tenant_id = $1 AND status = 'queued' AND locked_at IS NULL
        AND (next_attempt_at IS NULL OR next_attempt_at <= CURRENT_TIMESTAMP)
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `, [tenantId]);
    const job = selected.rows[0];
    if (!job) {
      await client.query('COMMIT');
      return null;
    }
    const claimed = await client.query(`
      UPDATE operator_jobs
      SET status = 'planning', current_stage = 'planner', locked_at = CURRENT_TIMESTAMP,
          locked_by = $1, next_attempt_at = NULL,
          attempt_count = attempt_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND tenant_id = $3
      RETURNING *
    `, [workerId, job.id, tenantId]);
    await client.query('COMMIT');
    return claimed.rows[0] || null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function recoverStaleOperatorJobs(timeoutMs = 300000) {
  const tenantId = getActiveTenantId();
  const result = await pgQuery(`
    UPDATE operator_jobs
    SET status = 'queued', current_stage = 'queued', locked_at = NULL, locked_by = NULL,
        next_attempt_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE tenant_id = $1 AND status = 'planning'
      AND locked_at < CURRENT_TIMESTAMP - ($2::text || ' milliseconds')::interval
    RETURNING id
  `, [tenantId, Math.max(1000, Number(timeoutMs) || 300000)]);
  return result.rows.map(row => row.id);
}


export async function getAllKnowledgeBases() {
  const db = getDb();
  return await dbAll('SELECT id, name, file_type, file_size, created_at FROM knowledge_bases ORDER BY created_at DESC', []);
}

export async function getAllKnowledgeBasesWithContent() {
  const db = getDb();
  return await dbAll('SELECT * FROM knowledge_bases ORDER BY created_at ASC', []);
}

export async function getKnowledgeBase(id) {
  const db = getDb();
  return await dbGet('SELECT * FROM knowledge_bases WHERE id = ?', [id]);
}

export async function getKnowledgeBasesByIds(ids) {
  const db = getDb();
  const placeholders = ids.map(() => '?').join(',');
  return db.prepare(`SELECT * FROM knowledge_bases WHERE id IN (${placeholders})`).all(...ids);
}

export async function createKnowledgeBase({ id, name, content, file_type, file_size }) {
  const db = getDb();
  return db.prepare(
    'INSERT INTO knowledge_bases (id, name, content, file_type, file_size) VALUES (?, ?, ?, ?, ?)'
  ).run(id, name, content, file_type, file_size);
}

export async function deleteKnowledgeBase(id) {
  const db = getDb();
  return await dbRun('DELETE FROM knowledge_bases WHERE id = ?', [id]);
}

export async function getAllIdeas() {
  const db = getDb();
  return await dbAll('SELECT * FROM ideas ORDER BY tanggal_dibuat DESC', []);
}

export async function getIdea(id) {
  const db = getDb();
  return await dbGet('SELECT * FROM ideas WHERE id = ?', [id]);
}

export async function getIdeasByProduct(productName) {
  const db = getDb();
  return await dbAll('SELECT * FROM ideas WHERE product_name = ? ORDER BY tanggal_dibuat DESC', [productName]);
}

export async function createIdea(idea) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO ideas (id, topik, konteks_cep, category_cep, cep, sub_cep_matrix, vfo, key_messages, kb_digunakan, jumlah_klip,
      narrative_mode, visual_style, words_per_clip, target_ai, face_visibility, aspect_ratio,
      instruksi_tambahan, product_name, product_description, target_audience, jumlah_ide, prompt_output_format, raw_response, status)
    VALUES (@id, @topik, @konteks_cep, @category_cep, @cep, @sub_cep_matrix, @vfo, @key_messages, @kb_digunakan, @jumlah_klip,
      @narrative_mode, @visual_style, @words_per_clip, @target_ai, @face_visibility, @aspect_ratio,
      @instruksi_tambahan, @product_name, @product_description, @target_audience, @jumlah_ide, @prompt_output_format, @raw_response, @status)
  `);
  return await stmt.run([idea]);
}

export async function updateIdea(id, updates) {
  const db = getDb();
  const existing = getIdea(id);
  return await dbRun('UPDATE ideas SET topik = ?, category_cep = ?, cep = ?, sub_cep_matrix = ?, konteks_cep = ?, vfo = ?, key_messages = ?, kb_digunakan = ?, jumlah_klip = ?, narrative_mode = ?, visual_style = ?, words_per_clip = ?, target_ai = ?, face_visibility = ?, aspect_ratio = ?, instruksi_tambahan = ?, product_name = ?, product_description = ?, target_audience = ?, jumlah_ide = ?, prompt_output_format = ?, raw_response = ?, status = ? WHERE id = ?', [
    updates.topik !== undefined ? updates.topik : existing.topik,
    updates.category_cep !== undefined ? updates.category_cep : existing.category_cep,
    updates.cep !== undefined ? updates.cep : existing.cep,
    updates.sub_cep_matrix !== undefined ? updates.sub_cep_matrix : existing.sub_cep_matrix,
    updates.konteks_cep !== undefined ? updates.konteks_cep : existing.konteks_cep,
    updates.vfo !== undefined ? updates.vfo : existing.vfo,
    updates.key_messages !== undefined ? updates.key_messages : existing.key_messages,
    updates.kb_digunakan !== undefined ? updates.kb_digunakan : existing.kb_digunakan,
    updates.jumlah_klip !== undefined ? updates.jumlah_klip : existing.jumlah_klip,
    updates.narrative_mode !== undefined ? updates.narrative_mode : existing.narrative_mode,
    updates.visual_style !== undefined ? updates.visual_style : existing.visual_style,
    updates.words_per_clip !== undefined ? updates.words_per_clip : existing.words_per_clip,
    updates.target_ai !== undefined ? updates.target_ai : existing.target_ai,
    updates.face_visibility !== undefined ? updates.face_visibility : existing.face_visibility,
    updates.aspect_ratio !== undefined ? updates.aspect_ratio : existing.aspect_ratio,
    updates.instruksi_tambahan !== undefined ? updates.instruksi_tambahan : existing.instruksi_tambahan,
    updates.product_name !== undefined ? updates.product_name : existing.product_name,
    updates.product_description !== undefined ? updates.product_description : existing.product_description,
    updates.target_audience !== undefined ? updates.target_audience : existing.target_audience,
    updates.jumlah_ide !== undefined ? updates.jumlah_ide : existing.jumlah_ide,
    updates.prompt_output_format !== undefined ? updates.prompt_output_format : existing.prompt_output_format,
    updates.raw_response !== undefined ? updates.raw_response : existing.raw_response,
    updates.status !== undefined ? updates.status : existing.status,
    id
  ]);
}

export async function updateIdeaStatus(id, status) {
  const db = getDb();
  return await dbRun('UPDATE ideas SET status = ? WHERE id = ?', [status, id]);
}

export async function deleteIdea(id) {
  const db = getDb();
  await dbRun('DELETE FROM assets WHERE idea_id = ?', [id]);
  return await dbRun('DELETE FROM ideas WHERE id = ?', [id]);
}

export async function getAssetsByIdeaId(ideaId) {
  const db = getDb();
  return await dbAll('SELECT * FROM assets WHERE idea_id = ? ORDER BY tanggal_dibuat DESC', [ideaId]);
}

export async function getAsset(assetId) {
  const db = getDb();
  return await dbGet('SELECT * FROM assets WHERE asset_id = ?', [assetId]);
}

export async function createAsset(asset) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO assets (asset_id, idea_id, storyboard, t2i_prompts, i2v_prompts, t2v_prompts,
      tiktok_caption, ig_caption, yt_title, yt_desc, raw_response)
    VALUES (@asset_id, @idea_id, @storyboard, @t2i_prompts, @i2v_prompts, @t2v_prompts,
      @tiktok_caption, @ig_caption, @yt_title, @yt_desc, @raw_response)
  `);
  return await stmt.run([asset]);
}

export async function updateAssetPrompts(assetId, t2iPrompts, i2vPrompts, additionalRawResponse) {
  const db = getDb();
  const currentAsset = await dbGet('SELECT raw_response FROM assets WHERE asset_id = ?', [assetId]);
  const newRawResponse = (currentAsset ? currentAsset.raw_response : '') + '\\n\\n' + additionalRawResponse;
  
  const stmt = db.prepare(`
    UPDATE assets 
    SET t2i_prompts = ?, i2v_prompts = ?, raw_response = ?
    WHERE asset_id = ?
  `);
  return await stmt.run([t2iPrompts, i2vPrompts, newRawResponse, assetId]);
}

export async function getAllAssets() {
  const db = getDb();
  return await dbAll(`
    SELECT a.*, i.topik, i.product_name 
    FROM assets a 
    LEFT JOIN ideas i ON a.idea_id = i.id 
    ORDER BY a.tanggal_dibuat DESC
  `, []);
}

export function getSetting(key) {
  const tenantId = getActiveTenantId();
  if (tenantSettingsCache[tenantId] && tenantSettingsCache[tenantId][key] !== undefined) {
    return tenantSettingsCache[tenantId][key];
  }
  if (tenantSettingsCache['default_tenant'] && tenantSettingsCache['default_tenant'][key] !== undefined) {
    return tenantSettingsCache['default_tenant'][key];
  }
  return settingsCache[key] || null;
}

export async function setSetting(key, value) {
  const tenantId = getActiveTenantId();
  if (!tenantSettingsCache[tenantId]) {
    tenantSettingsCache[tenantId] = {};
  }
  tenantSettingsCache[tenantId][key] = String(value);

  if (tenantId === 'default_tenant') {
    settingsCache[key] = String(value);
  }

  return await dbRun(
    'INSERT INTO tenant_settings (tenant_id, setting_key, setting_value) VALUES (?, ?, ?) ON CONFLICT (tenant_id, setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value',
    [tenantId, key, String(value)]
  );
}

export async function getStats() {
  const db = getDb();

  let contentReadyCount = 0;
  try {
    const res = db.prepare('SELECT COUNT(*) as count FROM content_flow_items').get();
    contentReadyCount = res ? res.count : 0;
  } catch (e) {}

  let activeCampaignCount = 0;
  try {
    const pillarCount = db.prepare('SELECT COUNT(*) as count FROM pillar_campaigns').get()?.count || 0;
    const stratCount = db.prepare('SELECT COUNT(*) as count FROM strategic_campaigns').get()?.count || 0;
    activeCampaignCount = pillarCount + stratCount;
  } catch (e) {}

  let productCount = 0;
  try {
    const res = await dbGet('SELECT COUNT(*) as count FROM product_extractions WHERE tenant_id = ?', [getActiveTenantId()]);
    productCount = res ? res.count : 0;
  } catch (e) {}

  let recentItems = [];
  try {
    recentItems = await dbAll(`
      SELECT id, video_id, account_name, hook, nama_produk, tiktok_status, facebook_status, instagram_status, drive_link, nextcloud_url, url_asset, created_at
      FROM content_flow_items
      ORDER BY created_at DESC
      LIMIT 5
    `, []);
  } catch (e) {}

  let platformStats = { tiktokPct: 0, fbPct: 0, igPct: 0 };
  if (contentReadyCount > 0) {
    try {
      const tiktokPub = db.prepare("SELECT COUNT(*) as count FROM content_flow_items WHERE tiktok_status = 'Published'").get()?.count || 0;
      const fbPub = db.prepare("SELECT COUNT(*) as count FROM content_flow_items WHERE facebook_status = 'Published'").get()?.count || 0;
      const igPub = db.prepare("SELECT COUNT(*) as count FROM content_flow_items WHERE instagram_status = 'Published'").get()?.count || 0;

      platformStats = {
        tiktokPct: Math.round((tiktokPub / contentReadyCount) * 100),
        fbPct: Math.round((fbPub / contentReadyCount) * 100),
        igPct: Math.round((igPub / contentReadyCount) * 100)
      };
    } catch (e) {}
  }

  let kbCount = 0;
  try {
    kbCount = db.prepare('SELECT COUNT(*) as count FROM knowledge_bases').get()?.count || 0;
  } catch (e) {}

  return {
    contentReadyCount,
    activeCampaignCount,
    productCount,
    recentItems,
    platformStats,
    kbCount
  };
}

export async function createReverseResult(data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO reverse_results (id, source_type, source_url, video_filename, custom_instruction,
      aspect_ratio, target_ai, prompt_output_format, storyboard, voiceover, t2v_prompts,
      tiktok_caption, ig_caption, yt_title, yt_desc, raw_response)
    VALUES (@id, @source_type, @source_url, @video_filename, @custom_instruction,
      @aspect_ratio, @target_ai, @prompt_output_format, @storyboard, @voiceover, @t2v_prompts,
      @tiktok_caption, @ig_caption, @yt_title, @yt_desc, @raw_response)
  `);
  return await stmt.run([data]);
}

export async function getAllReverseResults() {
  const db = getDb();
  return await dbAll('SELECT id, source_type, source_url, video_filename, aspect_ratio, target_ai, custom_instruction, prompt_output_format, tanggal_dibuat FROM reverse_results ORDER BY tanggal_dibuat DESC', []);
}

export async function getReverseResult(id) {
  const db = getDb();
  return await dbGet('SELECT * FROM reverse_results WHERE id = ?', [id]);
}

export async function deleteReverseResult(id) {
  const db = getDb();
  return await dbRun('DELETE FROM reverse_results WHERE id = ?', [id]);
}

export async function createProductExtraction(data) {
  const { createProduct } = await import('./product-repository.js');
  return createProduct(data);
}

export async function getProductExtraction(id) {
  const { getProductById } = await import('./product-repository.js');
  return getProductById(id);
}

export async function getAllProductExtractions() {
  const { listProducts } = await import('./product-repository.js');
  return listProducts();
}

export async function updateProductExtraction(id, data) {
  const { updateProduct } = await import('./product-repository.js');
  return updateProduct(id, data);
}

export async function deleteProductExtraction(id) {
  const { deleteProduct } = await import('./product-repository.js');
  return deleteProduct(id);
}

export async function createPipelineAsset(data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO pipeline_assets (id, product_id, selected_idea, all_ideas, hot_trend_detected,
      audio_blueprint, visual_storyboard, t2i_prompts, i2v_prompts, t2v_prompts,
      tiktok_caption, ig_caption, yt_title, yt_desc,
      config, raw_responses, current_stage, status)
    VALUES (@id, @product_id, @selected_idea, @all_ideas, @hot_trend_detected,
      @audio_blueprint, @visual_storyboard, @t2i_prompts, @i2v_prompts, @t2v_prompts,
      @tiktok_caption, @ig_caption, @yt_title, @yt_desc,
      @config, @raw_responses, @current_stage, @status)
  `);
  return await stmt.run([data]);
}

export async function updatePipelineAsset(id, updates) {
  const db = getDb();
  const fields = [];
  const values = [];
  for (const [key, val] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(val);
  }
  values.push(id);
  return db.prepare(`UPDATE pipeline_assets SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export async function getPipelineAsset(id) {
  const tenantId = getActiveTenantId();
  const result = await pgQuery(`
    SELECT pa.*, pe.product_name, pe.product_description, pe.unique_selling_point, 
           pe.target_audience, pe.pain_point_solved, pe.key_visuals_extracted
    FROM pipeline_assets pa
    JOIN product_extractions pe ON pa.product_id = pe.id AND pe.tenant_id = $2
    WHERE pa.id = $1
  `, [id, tenantId]);
  return result.rows[0] || null;
}

export async function getAllPipelineAssets() {
  const result = await pgQuery(`
    SELECT pa.id, pa.product_id, pa.hot_trend_detected, pa.current_stage, pa.status, pa.created_at,
           pe.product_name
    FROM pipeline_assets pa
    JOIN product_extractions pe ON pa.product_id = pe.id AND pe.tenant_id = $1
    ORDER BY pa.created_at DESC
  `, [getActiveTenantId()]);
  return result.rows;
}

export async function deletePipelineAsset(id) {
  const db = getDb();
  return await dbRun('DELETE FROM pipeline_assets WHERE id = ?', [id]);
}

export async function createVideoLibraryEntry(entry) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO video_library (id, source_type, source_url, filename, local_path,
      file_size, mime_type, thumbnail_path, status, error_note, tags)
    VALUES (@id, @source_type, @source_url, @filename, @local_path,
      @file_size, @mime_type, @thumbnail_path, @status, @error_note, @tags)
  `);
  return await stmt.run([entry]);
}

export async function getAllVideoLibrary(search) {
  const db = getDb();
  if (search) {
    return db.prepare(`SELECT * FROM video_library WHERE filename LIKE ? OR tags LIKE ? ORDER BY created_at DESC`)
      .all(`%${search}%`, `%${search}%`);
  }
  return await dbAll('SELECT * FROM video_library ORDER BY created_at DESC', []);
}

export async function getVideoById(id) {
  const db = getDb();
  return await dbGet('SELECT * FROM video_library WHERE id = ?', [id]);
}

export async function updateVideoStatus(id, status, errorNote) {
  const db = getDb();
  return await dbRun('UPDATE video_library SET status = ?, error_note = ? WHERE id = ?', [status, errorNote || null, id]);
}

export async function updateVideoLibraryEntry(id, updates) {
  const db = getDb();
  const fields = [];
  const values = [];
  for (const [key, val] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(val);
  }
  values.push(id);
  return db.prepare(`UPDATE video_library SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export async function deleteVideoFromLibrary(id) {
  const db = getDb();
  return await dbRun('DELETE FROM video_library WHERE id = ?', [id]);
}

export async function getVideoLibraryStorageUsage() {
  const db = getDb();
  const result = db.prepare('SELECT COALESCE(SUM(file_size), 0) as total_bytes, COUNT(*) as total_files FROM video_library WHERE status = ?').get('ready');
  return result;
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

export async function addApiKey(keyName, apiKey, tier = 'FREE', dailyLimit = 20) {
  const tenantId = getActiveTenantId();
  const result = await pgQuery(`
    INSERT INTO gemini_api_keys (tenant_id, key_name, api_key, tier, daily_limit)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (tenant_id, api_key) DO NOTHING
    RETURNING id
  `, [tenantId, keyName, apiKey, tier, dailyLimit]);
  return { changes: result.rowCount, rowCount: result.rowCount };
}

// --- Manual Override for addApiKeysBulk ---
export async function addApiKeysBulk(keysArray) {
  const tenantId = getActiveTenantId();
  let added = 0;
  let duplicates = 0;
  const failures = [];
  for (const item of keysArray) {
    try {
      const res = await pgQuery(
        `INSERT INTO gemini_api_keys (tenant_id, key_name, api_key, tier, daily_limit)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tenant_id, api_key) DO NOTHING`,
        [tenantId, item.key_name, item.api_key, item.tier || 'FREE', item.daily_limit || 20]
      );
      if (res.rowCount > 0) added++;
      else duplicates++;
    } catch (e) {
      failures.push({ key_name: item.key_name, code: e.code || 'DB_ERROR' });
    }
  }
  return { added, duplicates, failures };
}

export async function getAllApiKeys() {
  const today = getTodayStr();
  const tenantId = getActiveTenantId();
  const result = await pgQuery(`
    SELECT k.*, COALESCE(u.used_count, 0) as used_today
    FROM gemini_api_keys k
    LEFT JOIN api_key_usages u ON k.id = u.key_id AND u.date = $1
    WHERE k.tenant_id = $2
    ORDER BY k.id ASC
  `, [today, tenantId]);
  return result.rows;
}

export async function getApiKey(id) {
  const db = getDb();
  return await dbGet('SELECT * FROM gemini_api_keys WHERE id = ?', [id]);
}

export async function updateApiKey(id, updates) {
  const db = getDb();
  const fields = [];
  const values = [];
  for (const [key, val] of Object.entries(updates)) {
    if (['key_name', 'api_key', 'tier', 'daily_limit', 'is_active'].includes(key)) {
      fields.push(`${key} = ?`);
      values.push(val);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  return db.prepare(`UPDATE gemini_api_keys SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export async function deleteApiKey(id) {
  const db = getDb();
  await dbRun('DELETE FROM api_key_usages WHERE key_id = ?', [id]);
  return await dbRun('DELETE FROM gemini_api_keys WHERE id = ?', [id]);
}

export async function getAvailableApiKey(cost = 1, excludedIds = []) {
  const db = getDb();
  const today = getTodayStr();
  const tenantId = getActiveTenantId();
  let query = `
    SELECT k.id, k.key_name, k.api_key, k.tier, k.daily_limit,
           COALESCE(u.used_count, 0) as used_today
    FROM gemini_api_keys k
    LEFT JOIN api_key_usages u ON k.id = u.key_id AND u.date = ?
    WHERE k.tenant_id = ?
      AND k.is_active = 1
      AND (k.daily_limit - COALESCE(u.used_count, 0)) >= ?
  `;
  const params = [today, tenantId, cost];
  if (excludedIds && excludedIds.length > 0) {
    const placeholders = excludedIds.map(() => '?').join(',');
    query += ` AND k.id NOT IN (${placeholders})`;
    params.push(...excludedIds);
  }
  query += ` ORDER BY COALESCE(u.used_count, 0) ASC, k.id ASC LIMIT 1`;
  const key = await dbGet(query, params);
  return key || null;
}

export async function incrementKeyUsage(keyId, cost = 1) {
  const db = getDb();
  const today = getTodayStr();
  db.prepare(`
    INSERT INTO api_key_usages (date, key_id, used_count)
    VALUES (?, ?, ?)
    ON CONFLICT(date, key_id) DO UPDATE SET used_count = api_key_usages.used_count + ?
  `).run(today, keyId, cost, cost);
}

export async function markKeyExhausted(keyId) {
  const db = getDb();
  const today = getTodayStr();
  const key = await dbGet('SELECT daily_limit FROM gemini_api_keys WHERE id = ?', [keyId]);
  if (!key) return;
  db.prepare(`
    INSERT INTO api_key_usages (date, key_id, used_count)
    VALUES (?, ?, ?)
    ON CONFLICT(date, key_id) DO UPDATE SET used_count = ?
  `).run(today, keyId, key.daily_limit, key.daily_limit);
}

export async function markApiKeyStatus(keyId, status = 'ACTIVE', isActive = 1) {
  const db = getDb();
  return await dbRun('UPDATE gemini_api_keys SET status = ?, is_active = ? WHERE id = ?', [status, isActive, keyId]);
}

export async function deleteInvalidApiKeys() {
  const tenantId = getActiveTenantId();
  const invalidKeys = await dbAll("SELECT id FROM gemini_api_keys WHERE tenant_id = ? AND (is_active = 0 OR status IN ('INVALID', 'REVOKED'))", [tenantId]);
  if (!invalidKeys || invalidKeys.length === 0) {
    return { deletedCount: 0 };
  }
  const ids = invalidKeys.map(k => k.id);
  const placeholders = ids.map(() => '?').join(',');
  await dbRun(`DELETE FROM api_key_usages WHERE key_id IN (${placeholders})`, ids);
  const res = await dbRun(`DELETE FROM gemini_api_keys WHERE tenant_id = ? AND id IN (${placeholders})`, [tenantId, ...ids]);
  return { deletedCount: res.changes };
}

export async function getPoolSummary() {
  const today = getTodayStr();
  const tenantId = getActiveTenantId();
  const queryResult = await pgQuery(`
    SELECT
      COUNT(*) as total_keys,
      SUM(CASE WHEN k.is_active = 1 THEN 1 ELSE 0 END) as active_keys,
      SUM(CASE WHEN k.is_active = 1 THEN k.daily_limit ELSE 0 END) as total_capacity,
      SUM(CASE WHEN k.is_active = 1 THEN COALESCE(u.used_count, 0) ELSE 0 END) as total_used
    FROM gemini_api_keys k
    LEFT JOIN api_key_usages u ON k.id = u.key_id AND u.date = $1
    WHERE k.tenant_id = $2
  `, [today, tenantId]);
  const result = queryResult.rows[0] || {};
  return {
    ...result,
    remaining: (result.total_capacity || 0) - (result.total_used || 0),
  };
}

export async function createJob(queueName, payload = null) {
  const db = getDb();
  return db.prepare(
    'INSERT INTO scheduler_jobs (queue_name, payload) VALUES (?, ?)'
  ).run(queueName, payload ? JSON.stringify(payload) : null);
}

export async function createDelayedJob(queueName, payload, runAt) {
  const db = getDb();
  return db.prepare(
    'INSERT INTO scheduler_jobs (queue_name, payload, run_at) VALUES (?, ?, ?)'
  ).run(queueName, payload ? JSON.stringify(payload) : null, runAt);
}

// --- Manual Override for claimNextJob ---
export async function claimNextJob(queueName) {
  const now = new Date().toISOString();
  const query = `
    UPDATE scheduler_jobs
    SET status = 'running', started_at = CURRENT_TIMESTAMP, attempts = attempts + 1
    WHERE id = (
      SELECT id FROM scheduler_jobs
      WHERE queue_name = $1 AND status = 'pending' AND run_at <= $2
      ORDER BY run_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
  `;
  const res = await pgQuery(query, [queueName, now]);
  return res.rows[0] || null;
}

export async function completeJob(jobId, result = null) {
  const db = getDb();
  const now = new Date().toISOString();
  return await dbRun(
    'UPDATE scheduler_jobs SET status = ?, result = ?, error_note = NULL, completed_at = ? WHERE id = ?'
  , ['completed', result ? JSON.stringify(result) : null, now, jobId]);
}

export async function failJob(jobId, errorNote) {
  const db = getDb();
  const now = new Date().toISOString();
  // Check if we should retry
  const job = await dbGet('SELECT attempts, max_attempts FROM scheduler_jobs WHERE id = ?', [jobId]);
  if (job && job.attempts < job.max_attempts) {
    // Retry: set back to pending with a 60s delay
    const retryAt = new Date(Date.now() + 60_000).toISOString();
    return await dbRun(
      'UPDATE scheduler_jobs SET status = ?, error_note = ?, run_at = ? WHERE id = ?'
    , ['pending', errorNote, retryAt, jobId]);
  }
  // Max retries reached: mark as failed
  return await dbRun(
    'UPDATE scheduler_jobs SET status = ?, error_note = ?, completed_at = ? WHERE id = ?'
  , ['failed', errorNote, now, jobId]);
}

export async function getJobStats(queueName = null) {
  const db = getDb();
  const where = queueName ? 'WHERE queue_name = ?' : '';
  const args = queueName ? [queueName] : [];
  const stats = db.prepare(`
    SELECT
      queue_name,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM scheduler_jobs ${where}
    GROUP BY queue_name
  `).all(...args);
  return stats;
}

export async function getRecentJobs(queueName, limit = 20) {
  const db = getDb();
  return await dbAll(
    'SELECT * FROM scheduler_jobs WHERE queue_name = ? ORDER BY created_at DESC LIMIT ?'
  , [queueName, limit]);
}

export async function getJobsCompletedToday(queueName) {
  const db = getDb();
  const today = getTodayStr();
  return db.prepare(`
    SELECT COUNT(*) as count FROM scheduler_jobs
    WHERE queue_name = ? AND status = 'completed'
    AND date(completed_at) = ?
  `).get(queueName, today).count;
}

export async function getSchedulerConfig(queueName) {
  const db = getDb();
  let config = await dbGet('SELECT * FROM scheduler_config WHERE queue_name = ?', [queueName]);
  if (!config && DEFAULT_CONFIGS[queueName]) {
    const def = DEFAULT_CONFIGS[queueName];
    db.prepare(`
      INSERT OR IGNORE INTO scheduler_config (queue_name, is_enabled, mode, interval_minutes, jobs_per_day, window_start, window_end)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(queueName, def.is_enabled, def.mode, def.interval_minutes, def.jobs_per_day, def.window_start, def.window_end);
    config = await dbGet('SELECT * FROM scheduler_config WHERE queue_name = ?', [queueName]);
  }
  return config;
}

export async function getAllSchedulerConfigs() {
  const db = getDb();
  // Ensure all default configs exist
  for (const [name, def] of Object.entries(DEFAULT_CONFIGS)) {
    db.prepare(`
      INSERT OR IGNORE INTO scheduler_config (queue_name, is_enabled, mode, interval_minutes, jobs_per_day, window_start, window_end)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, def.is_enabled, def.mode, def.interval_minutes, def.jobs_per_day, def.window_start, def.window_end);
  }
  return await dbAll('SELECT * FROM scheduler_config ORDER BY queue_name ASC', []);
}

export async function updateSchedulerConfig(queueName, updates) {
  const db = getDb();
  // Ensure row exists first
  getSchedulerConfig(queueName);
  const fields = [];
  const values = [];
  for (const [key, val] of Object.entries(updates)) {
    if (['is_enabled', 'mode', 'interval_minutes', 'jobs_per_day', 'window_start', 'window_end'].includes(key)) {
      fields.push(`${key} = ?`);
      values.push(val);
    }
  }
  if (fields.length === 0) return;
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(queueName);
  return db.prepare(`UPDATE scheduler_config SET ${fields.join(', ')} WHERE queue_name = ?`).run(...values);
}

export async function createReCampaign({
  id,
  campaign_name,
  execution_mode = 'manual_review',
  status = 'running',
  aspect_ratio = '9:16',
  target_ai = 'Google Veo (8s)',
  custom_instruction = '',
  brand_profile_id = null,
  is_bridging_active = 0,
  target_clips_count = 5,
  bridge_at_clip = 2,
  bridge_duration_clips = 0,
  bridging_mode = 'select_existing',
  target_product_id = null,
  ephemeral_product_data = null,
  promotion_style = 'Softselling',
  narrative_mode = 'Storytelling',
  post_youtube_draft = 0,
  post_tiktok_draft = 0,
  post_facebook_draft = 0,
  voice_provider = 'gemini',
  voice_persona = 'Kore',
  voice_speed = 1.0,
  voice_volume = 1.0,
  ffmpeg_sync_option = 'shortest',
  ffmpeg_video_scale = 1.0,
  ffmpeg_sfx_volume = 0.0,
  ffmpeg_bgm_volume = 0.15,
  video_model = 'veo_31_lite',
  local_scheduler = 0,
  words_per_clip = '17-19 kata',
  face_visibility = 'Faceless',
  enable_tts = 1,
  enable_glabs = 0,
  enable_ffmpeg = 1,
  enable_social_post = 1,
  visual_mode = 'pure_t2v',
  product_ref_image_path = null,
  product_filename_declare = null,
  angle_multiplier = 0,
  visual_overrides_json = null,
  tts_model_quality = 'speech-2.8-turbo',
  target_language = 'id-ID',
  visual_style = 'Cinematic',
  nextcloud_parent_folder = 'MAKNA_Production_Final',
  fb_draft_mode = 'auto',
  target_spreadsheet_id = null,
  sfx_setting = 'without_sfx',
  enable_vo_audit = 0,
  enable_audio_segment = 0,
  voice_cast_json = null,
  target_demographic = null,
  target_demographic_custom = null,
  ai_directive = null,
  mandatory_outro_line = null
}) {
  const db = getDb();
  return db.prepare(`
    INSERT INTO re_campaigns (
      id, campaign_name, execution_mode, status, aspect_ratio, target_ai, custom_instruction, brand_profile_id,
      is_bridging_active, target_clips_count, bridge_at_clip, bridge_duration_clips, bridging_mode, target_product_id, ephemeral_product_data, promotion_style, narrative_mode,
      post_youtube_draft, post_tiktok_draft, post_facebook_draft, voice_provider, voice_persona, voice_speed, voice_volume,
      ffmpeg_sync_option, ffmpeg_video_scale, ffmpeg_sfx_volume, ffmpeg_bgm_volume, video_model, local_scheduler,
      words_per_clip, face_visibility, enable_tts, enable_glabs, enable_ffmpeg, enable_social_post,
      visual_mode, product_ref_image_path, product_filename_declare, angle_multiplier, visual_overrides_json, tts_model_quality, target_language, visual_style,
      nextcloud_parent_folder, fb_draft_mode, target_spreadsheet_id, sfx_setting, enable_vo_audit, enable_audio_segment, voice_cast_json,
      target_demographic, target_demographic_custom, ai_directive, mandatory_outro_line
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, campaign_name, execution_mode, status, aspect_ratio, target_ai, custom_instruction, brand_profile_id,
    is_bridging_active, target_clips_count, bridge_at_clip, bridge_duration_clips, bridging_mode, target_product_id, ephemeral_product_data, promotion_style, narrative_mode,
    post_youtube_draft, post_tiktok_draft, post_facebook_draft, voice_provider, voice_persona, voice_speed, voice_volume,
    ffmpeg_sync_option, ffmpeg_video_scale, ffmpeg_sfx_volume, ffmpeg_bgm_volume, video_model, local_scheduler,
    words_per_clip, face_visibility, enable_tts, enable_glabs, enable_ffmpeg, enable_social_post,
    visual_mode, product_ref_image_path, product_filename_declare, angle_multiplier, visual_overrides_json, tts_model_quality, target_language, visual_style,
    nextcloud_parent_folder, fb_draft_mode, target_spreadsheet_id, sfx_setting, enable_vo_audit,
    enable_audio_segment, voice_cast_json, target_demographic, target_demographic_custom, ai_directive, mandatory_outro_line
  );
}

export async function getReCampaign(id) {
  const db = getDb();
  return await dbGet(`
    SELECT c.*, b.brand_name 
    FROM re_campaigns c
    LEFT JOIN brand_profiles b ON c.brand_profile_id = b.id
    WHERE c.id = ? AND c.tenant_id = ?
  `, [id, getActiveTenantId()]);
}

export async function listReCampaigns() {
  const db = getDb();
  return await dbAll(`
    SELECT c.*, b.brand_name 
    FROM re_campaigns c
    LEFT JOIN brand_profiles b ON c.brand_profile_id = b.id
    WHERE c.tenant_id = ?
    ORDER BY c.created_at DESC
  `, [getActiveTenantId()]);
}

export async function updateReCampaign(id, updates) {
  const db = getDb();
  const allowed = [
    'execution_mode', 'status', 'target_spreadsheet_id', 'target_markdown_url', 'local_scheduler',
    'scheduler_pause_at', 'enable_tts', 'enable_glabs', 'enable_ffmpeg', 'enable_social_post',
    'angle_multiplier', 'visual_overrides_json', 'tts_model_quality', 'target_language',
    'product_ref_image_path', 'product_filename_declare',
    'voice_provider', 'voice_persona', 'voice_speed', 'voice_volume',
    'ffmpeg_sync_option', 'ffmpeg_video_scale', 'ffmpeg_sfx_volume', 'ffmpeg_bgm_volume',
    'enable_vo_audit',
    'bridge_duration_clips', 'visual_style',
    'post_youtube_draft', 'post_tiktok_draft', 'post_facebook_draft',
    'facebook_page_id', 'facebook_server_url', 'nextcloud_parent_folder', 'fb_draft_mode', 'sfx_setting',
    'narrative_mode',
    'enable_audio_segment', 'voice_cast_json', 'ai_directive', 'mandatory_outro_line'
  ];
  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  return db.prepare(`UPDATE re_campaigns SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

// --- Manual Override for deleteReCampaign ---
export async function deleteReCampaign(id) {
  await pgQuery('DELETE FROM re_campaign_items WHERE campaign_id = $1', [id]);
  await pgQuery('DELETE FROM re_campaigns WHERE id = $1', [id]);
}

// --- Manual Override for addReCampaignItems ---
export async function addReCampaignItems(campaignId, items) {
  for (const item of items) {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed) {
        await pgQuery('INSERT INTO re_campaign_items (campaign_id, source_url, product_url) VALUES ($1, $2, $3)', [campaignId, trimmed, null]);
      }
    } else if (item && typeof item === 'object') {
      const trimmedUrl = item.source_url?.trim();
      const trimmedProductUrl = item.product_url?.trim() || null;
      if (trimmedUrl) {
        await pgQuery('INSERT INTO re_campaign_items (campaign_id, source_url, product_url) VALUES ($1, $2, $3)', [campaignId, trimmedUrl, trimmedProductUrl]);
      }
    }
  }
}

export async function getNextPendingScrapeItem() {
  const db = getDb();
  return await dbGet(
    "SELECT i.* FROM re_campaign_items i JOIN re_campaigns c ON i.campaign_id = c.id WHERE i.scrape_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 0 ORDER BY i.id ASC LIMIT 1"
  , []);
}

export async function getNextPendingAnalyzeItem() {
  const db = getDb();
  return await dbGet(
    "SELECT i.* FROM re_campaign_items i JOIN re_campaigns c ON i.campaign_id = c.id WHERE i.scrape_status = 'downloaded' AND i.analyze_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 0 ORDER BY i.id ASC LIMIT 1"
  , []);
}

export async function getNextPendingReTtsItem() {
  const db = getDb();
  return await dbGet(
    "SELECT i.* FROM re_campaign_items i JOIN re_campaigns c ON i.campaign_id = c.id WHERE i.analyze_status = 'analyzed' AND i.tts_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 0 ORDER BY i.id ASC LIMIT 1"
  , []);
}

export async function getNextPendingReGlabsItem() {
  const db = getDb();
  return db.prepare(
    "SELECT i.* FROM re_campaign_items i JOIN re_campaigns c ON i.campaign_id = c.id WHERE (i.tts_status = 'completed' OR i.tts_status = 'skipped') AND i.visual_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 0 ORDER BY i.id ASC LIMIT 1"
  ).get();
}

export async function getNextPendingReFfmpegItem() {
  const db = getDb();
  return await dbGet(
    "SELECT i.* FROM re_campaign_items i JOIN re_campaigns c ON i.campaign_id = c.id WHERE i.visual_status = 'completed' AND i.ffmpeg_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 0 ORDER BY i.id ASC LIMIT 1"
  , []);
}

export async function getNextPendingSocialPostItem() {
  const db = getDb();
  return db.prepare(
    "SELECT i.* FROM re_campaign_items i JOIN re_campaigns c ON i.campaign_id = c.id WHERE (i.ffmpeg_status = 'completed' OR i.ffmpeg_status = 'skipped') AND i.social_post_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 0 ORDER BY i.id ASC LIMIT 1"
  ).get();
}

export async function checkAndUpdateCampaignCompletion(campaignId) {
  const db = getDb();
  const campaign = await dbGet('SELECT * FROM re_campaigns WHERE id = ?', [campaignId]);
  if (!campaign || campaign.status === 'completed') return;

  const items = await dbAll('SELECT * FROM re_campaign_items WHERE campaign_id = ?', [campaignId]);
  if (items.length === 0) return;

  const actualNeedsSocial = campaign.enable_social_post === 1 || campaign.post_facebook_draft === 1 || campaign.post_youtube_draft === 1 || campaign.post_tiktok_draft === 1;

  const allFinished = items.every(item => {
    // If it failed at any stage, it is finished (no further progress possible)
    if (
      item.scrape_status === 'failed' ||
      item.analyze_status === 'failed' ||
      item.tts_status === 'failed' ||
      item.visual_status === 'failed' ||
      item.ffmpeg_status === 'failed' ||
      (actualNeedsSocial && item.social_post_status === 'failed')
    ) {
      return true;
    }

    // Otherwise, check for success state of each enabled stage
    const scrapeSuccess = item.scrape_status === 'downloaded' || item.scrape_status === 'skipped' || item.scrape_status === 'ready' || !item.scrape_status;
    if (!scrapeSuccess) return false;

    const analyzeSuccess = item.analyze_status === 'analyzed' || item.analyze_status === 'skipped' || !item.analyze_status;
    if (!analyzeSuccess) return false;

    const ttsSuccess = item.tts_status === 'completed' || item.tts_status === 'skipped';
    if (!ttsSuccess) return false;

    const visualSuccess = item.visual_status === 'completed' || item.visual_status === 'skipped';
    if (!visualSuccess) return false;

    const ffmpegSuccess = item.ffmpeg_status === 'completed' || item.ffmpeg_status === 'skipped';
    if (!ffmpegSuccess) return false;

    if (actualNeedsSocial) {
      return item.social_post_status === 'completed' || item.social_post_status === 'skipped';
    }

    return true;
  });

  if (allFinished) {
    const hasRetryableFailures = items.some(item => {
      const isFailed = item.scrape_status === 'failed' ||
                       item.analyze_status === 'failed' ||
                       item.tts_status === 'failed' ||
                       item.visual_status === 'failed' ||
                       item.ffmpeg_status === 'failed' ||
                       (actualNeedsSocial && item.social_post_status === 'failed');
      const retryCount = item.retry_count !== undefined ? Number(item.retry_count) : 0;
      return isFailed && retryCount < 3;
    });

    if (!hasRetryableFailures) {
      await dbRun("UPDATE re_campaigns SET status = 'completed' WHERE id = ?", [campaignId]);
      console.log(`[DB Monitor] Campaign ${campaignId} marked as completed.`);
    } else {
      console.log(`[DB Monitor] Campaign ${campaignId} has failed items but keeping 'running' for auto-retry.`);
    }
  }
}

export async function updateReCampaignItem(id, updates) {
  const db = getDb();
  const allowed = [
    'scrape_status', 'local_video_path', 'analyze_status', 'result_json',
    'tts_status', 'tts_batch_id', 'visual_status', 'visual_tasks_json', 
    'visual_clip_paths', 'ffmpeg_status', 'ffmpeg_output_path', 
    'upload_status', 'drive_link', 'social_post_status', 'social_links_json',
    'retry_count', 't2i_start_frame_path',
    'original_deconstruction_json', 'new_video_plan_json', 'video_dna_json',
    't2i_images_json', 'workflow_status',
    'regenerate_start_frames_status', 'regenerate_start_frames_progress'
  ];
  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  const result = db.prepare(`UPDATE re_campaign_items SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  // Trigger completion check automatically
  try {
    const item = await dbGet('SELECT campaign_id FROM re_campaign_items WHERE id = ?', [id]);
    if (item && item.campaign_id) {
      checkAndUpdateCampaignCompletion(item.campaign_id);
    }
  } catch (e) {
    console.error('[DB] Auto completion check failed:', e);
  }

  return result;
}

export async function listReCampaignItems(campaignId) {
  const db = getDb();
  return await dbAll(
    'SELECT * FROM re_campaign_items WHERE campaign_id = ? ORDER BY id ASC'
  , [campaignId]);
}

export async function getReCampaignStats(campaignId) {
  const db = getDb();
  return db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN scrape_status = 'downloaded' THEN 1 ELSE 0 END) as scraped,
      SUM(CASE WHEN analyze_status = 'analyzed' THEN 1 ELSE 0 END) as analyzed,
      SUM(CASE WHEN scrape_status = 'failed' THEN 1 ELSE 0 END) as scrape_failed,
      SUM(CASE WHEN analyze_status = 'failed' THEN 1 ELSE 0 END) as analyze_failed
    FROM re_campaign_items WHERE campaign_id = ?
  `).get(campaignId);
}

export async function createAngleVariant(variant) {
  const db = getDb();
  return db.prepare(`
    INSERT INTO re_item_angle_variants (
      id, re_item_id, angle_name, angle_category, matrix_strategy_used,
      system_targeting, voice_persona_assigned, angle_description, visual_tasks_json,
      tts_status, visual_status, ffmpeg_status, upload_status
    ) VALUES (
      @id, @re_item_id, @angle_name, @angle_category, @matrix_strategy_used,
      @system_targeting, @voice_persona_assigned, @angle_description, @visual_tasks_json,
      'pending', 'pending', 'pending', 'pending'
    )
  `).run(variant);
}

export async function getAngleVariantsForItem(itemId) {
  const db = getDb();
  return await dbAll('SELECT * FROM re_item_angle_variants WHERE re_item_id = ? ORDER BY created_at ASC', [itemId]);
}

export async function updateAngleVariant(id, updates) {
  const db = getDb();
  const allowed = [
    'tts_status', 'tts_batch_id', 'visual_status', 'visual_clip_paths',
    'ffmpeg_status', 'ffmpeg_output_path', 'upload_status', 'drive_link',
    'visual_tasks_json', 'glabs_task_ids'
  ];
  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  return db.prepare(`UPDATE re_item_angle_variants SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export async function createGlabsCampaign({ id, source_spreadsheet_id, target_drive_folder_id }) {
  const db = getDb();
  return db.prepare(
    'INSERT INTO glabs_campaigns (id, source_spreadsheet_id, target_drive_folder_id) VALUES (?, ?, ?)'
  ).run(id, source_spreadsheet_id, target_drive_folder_id);
}

export async function listGlabsCampaigns() {
  const db = getDb();
  return await dbAll('SELECT * FROM glabs_campaigns ORDER BY created_at DESC', []);
}

export async function getGlabsCampaign(id) {
  const db = getDb();
  return await dbGet('SELECT * FROM glabs_campaigns WHERE id = ?', [id]);
}

export async function updateGlabsCampaign(id, updates) {
  const db = getDb();
  const allowed = ['status', 'current_batch'];
  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  return db.prepare(`UPDATE glabs_campaigns SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export async function getJobReports() {
  const db = getDb();
  const queueStats = db.prepare(`
    SELECT queue_name, status, COUNT(*) as count 
    FROM scheduler_jobs 
    GROUP BY queue_name, status
  `).all();

  const globalStats = db.prepare(`
    SELECT 
      COUNT(*) as total_jobs,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as total_completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed,
      AVG(CASE WHEN status = 'completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL 
          THEN (julianday(completed_at) - julianday(started_at)) * 86400 ELSE NULL END) as avg_processing_time_sec
    FROM scheduler_jobs
  `).get();

  return { queueStats, globalStats };
}

export async function getApiKeyStats() {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const keysCount = db.prepare('SELECT COUNT(*) as count FROM gemini_api_keys WHERE is_active = 1').get().count;
  const totalCapacity = keysCount * 1500; // Asumsi 1500 request per hari per key
  
  const totalUsed = db.prepare(`
    SELECT SUM(used_count) as total_used 
    FROM api_key_usages 
    WHERE date = ?
  `).get(today).total_used || 0;

  return { totalCapacity, totalUsed };
}

export async function getActiveCampaignsStats() {
  const db = getDb();
  
  // RE Campaigns
  const activeReCampaigns = db.prepare(`
    SELECT c.*, 
           COUNT(i.id) as total_items,
           SUM(CASE WHEN i.scrape_status = 'downloaded' THEN 1 ELSE 0 END) as total_downloaded,
           SUM(CASE WHEN i.analyze_status = 'analyzed' THEN 1 ELSE 0 END) as total_analyzed
    FROM re_campaigns c
    LEFT JOIN re_campaign_items i ON c.id = i.campaign_id
    WHERE c.status IN ('active', 'running', 'pending')
    GROUP BY c.id
  `).all();

  // G Labs Campaigns
  const activeGlabsCampaigns = await dbAll(`
    SELECT * FROM glabs_campaigns
    WHERE status = 'active'
  `, []);

  return { activeReCampaigns, activeGlabsCampaigns };
}

export async function getAuditTrail(limit = 50, offset = 0, queueFilter = null, statusFilter = null) {
  const db = getDb();
  let query = 'SELECT * FROM scheduler_jobs WHERE 1=1';
  const params = [];
  
  if (queueFilter && queueFilter !== 'all') {
    query += ' AND queue_name = ?';
    params.push(queueFilter);
  }
  if (statusFilter && statusFilter !== 'all') {
    query += ' AND status = ?';
    params.push(statusFilter);
  }
  
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
  const total = await dbGet(countQuery, params).count;

  query += ' ORDER BY COALESCE(completed_at, started_at, created_at) DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  const jobs = await dbAll(query, params);
  
  return { total, jobs };
}

export async function cleanupOldJobs() {
  const db = getDb();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return await dbRun(`
    DELETE FROM scheduler_jobs 
    WHERE status = 'completed' AND completed_at < ?
  `, [sevenDaysAgo]);
}

export async function retryJob(jobId) {
  const db = getDb();
  return await dbRun(`
    UPDATE scheduler_jobs 
    SET status = 'pending', attempts = 0, error_note = NULL, started_at = NULL, completed_at = NULL, run_at = ? 
    WHERE id = ?
  `, [new Date().toISOString(), jobId]);
}

// --- Manual Override for createInstantCampaign ---
export async function createInstantCampaign(campaignData, configData) {
  const isMassProd = campaignData.is_mass_production !== undefined ? campaignData.is_mass_production : 0;
  const localSched = campaignData.local_scheduler !== undefined ? campaignData.local_scheduler : 0;
  const initialStatus = campaignData.status || 'pending';

  const brandProfileId = campaignData.brand_profile_id || null;
  const enableGlabs = campaignData.enable_glabs !== undefined ? campaignData.enable_glabs : 0;
  const enableTts = campaignData.enable_tts !== undefined ? campaignData.enable_tts : 1;
  const enableFfmpeg = campaignData.enable_ffmpeg !== undefined ? campaignData.enable_ffmpeg : 1;
  const enableSocialPost = campaignData.enable_social_post !== undefined ? campaignData.enable_social_post : 1;
  const postYoutube = campaignData.post_youtube_draft !== undefined ? campaignData.post_youtube_draft : 0;
  const postTiktok = campaignData.post_tiktok_draft !== undefined ? campaignData.post_tiktok_draft : 0;
  const postFacebook = campaignData.post_facebook_draft !== undefined ? campaignData.post_facebook_draft : 0;
  const isBridgingActive = campaignData.is_bridging_active !== undefined ? campaignData.is_bridging_active : 0;
  const bridgeAtClip = campaignData.bridge_at_clip !== undefined ? campaignData.bridge_at_clip : 2;
  const visualMode = campaignData.visual_mode || 'hybrid_lock';

  await pgQuery(`
    INSERT INTO instant_campaigns (
      id, product_name, product_description, product_source_type, product_media_path, product_url, status, 
      is_mass_production, local_scheduler, brand_profile_id, enable_glabs, enable_tts, enable_ffmpeg, 
      enable_social_post, post_youtube_draft, post_tiktok_draft, post_facebook_draft, 
      is_bridging_active, bridge_at_clip, visual_mode
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
  `, [
    campaignData.id, campaignData.product_name, campaignData.product_description, campaignData.product_source_type,
    campaignData.product_media_path, campaignData.product_url, initialStatus, isMassProd, localSched,
    brandProfileId, enableGlabs, enableTts, enableFfmpeg, enableSocialPost, postYoutube, postTiktok,
    postFacebook, isBridgingActive, bridgeAtClip, visualMode
  ]);

  await pgQuery(`
    INSERT INTO instant_campaign_configs (campaign_id, narrative_mode, visual_style, words_per_clip, target_ai_engine, face_visibility, aspect_ratio, total_clips, voice_persona, speed_control, custom_instruction, target_language)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
  `, [
    campaignData.id, configData.narrative_mode, configData.visual_style, configData.words_per_clip,
    configData.target_ai_engine, configData.face_visibility, configData.aspect_ratio, configData.total_clips,
    configData.voice_persona, configData.speed_control, configData.custom_instruction, configData.target_language || 'id-ID'
  ]);
}

export async function updateInstantCampaignStatus(id, status) {
  const db = getDb();
  return await dbRun('UPDATE instant_campaigns SET status = ? WHERE id = ?', [status, id]);
}

export async function saveInstantCampaignOutput(outputId, campaignId, unifiedJson, errorLog = null) {
  const db = getDb();
  return db.prepare(`
    INSERT INTO instant_campaign_outputs (id, campaign_id, unified_production_json, error_log)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET 
      unified_production_json = excluded.unified_production_json,
      error_log = excluded.error_log
  `).run(outputId, campaignId, unifiedJson, errorLog);
}

export async function getInstantCampaign(id) {
  const db = getDb();
  const campaign = await dbGet('SELECT * FROM instant_campaigns WHERE id = ?', [id]);
  if (!campaign) return null;
  
  const config = await dbGet('SELECT * FROM instant_campaign_configs WHERE campaign_id = ?', [id]);
  const output = await dbGet('SELECT * FROM instant_campaign_outputs WHERE campaign_id = ?', [id]);
  
  return { ...campaign, config, output };
}

export async function getAllInstantCampaigns() {
  const db = getDb();
  return await dbAll('SELECT * FROM instant_campaigns ORDER BY created_at DESC', []);
}

// --- Manual Override for deleteInstantCampaign ---
export async function deleteInstantCampaign(id) {
  await pgQuery('DELETE FROM instant_campaign_items WHERE campaign_id = $1', [id]);
  await pgQuery('DELETE FROM instant_campaign_outputs WHERE campaign_id = $1', [id]);
  await pgQuery('DELETE FROM instant_campaign_configs WHERE campaign_id = $1', [id]);
  await pgQuery('DELETE FROM instant_campaigns WHERE id = $1', [id]);
}

export async function updateInstantCampaign(id, updates) {
  const db = getDb();
  const fields = [];
  const values = [];
  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(value);
  }
  values.push(id);
  return db.prepare(`UPDATE instant_campaigns SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export async function createBrandProfile(data) {
  if (data.webhook_api_key && data.webhook_api_key.startsWith('••••••••')) {
    data.webhook_api_key = '';
  }
  const db = getDb();
  const fields = [
    'id', 'brand_name', 'tone_of_voice', 'visual_signature', 'raw_guideline_text', 'guideline_filename',
    'storage_provider', 'nextcloud_target_folder', 'drive_target_folder', 'drive_glabs_folder_id',
    'webhook_host', 'webhook_port', 'webhook_api_key', 'editorial_brand_context',
    'editorial_content_goal', 'editorial_content_pillars_json'
  ];
  const placeholders = fields.map(() => '?').join(', ');
  const values = fields.map(f => data[f] !== undefined ? data[f] : (f === 'tone_of_voice' ? 'Kasual/Gaul' : ''));
  values[0] = data.id; // ensure correct ID mapping
  
  return db.prepare(
    `INSERT INTO brand_profiles (${fields.join(', ')}) VALUES (${placeholders})`
  ).run(...values);
}

export async function getAllBrandProfiles() {
  const db = getDb();
  return await dbAll('SELECT id, brand_name, tone_of_voice, visual_signature, editorial_brand_context, editorial_content_goal, editorial_content_pillars_json, guideline_filename, created_at, storage_provider, webhook_host FROM brand_profiles ORDER BY created_at DESC', []);
}

export async function getBrandProfile(id) {
  const db = getDb();
  return await dbGet('SELECT * FROM brand_profiles WHERE id = ?', [id]);
}

export async function updateBrandProfile(id, data) {
  if (data.webhook_api_key && data.webhook_api_key.startsWith('••••••••')) {
    delete data.webhook_api_key;
  }
  const db = getDb();
  const allowedFields = [
    'brand_name', 'tone_of_voice', 'visual_signature', 'raw_guideline_text', 'guideline_filename',
    'storage_provider', 'nextcloud_target_folder', 'drive_target_folder', 'drive_glabs_folder_id',
    'webhook_host', 'webhook_port', 'webhook_api_key', 'editorial_brand_context',
    'editorial_content_goal', 'editorial_content_pillars_json'
  ];
  const fields = [];
  const values = [];
  for (const [key, val] of Object.entries(data)) {
    if (allowedFields.includes(key) && val !== undefined) {
      fields.push(`${key} = ?`);
      values.push(val);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  return db.prepare(`UPDATE brand_profiles SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export async function deleteBrandProfile(id) {
  const db = getDb();
  // FK ON DELETE SET NULL will clear references in re_campaigns and instant_campaigns
  await dbRun('DELETE FROM brand_profiles WHERE id = ?', [id]);
}

export async function saveGlabsTaskRoute(taskId, host, port, apiKey) {
  const db = getDb();
  try {
    db.prepare(`
      INSERT OR REPLACE INTO glabs_task_routes (task_id, host, port, api_key)
      VALUES (?, ?, ?, ?)
    `).run(taskId, host, port, apiKey);
  } catch (e) {
    console.error('[DB] Failed to save G-Labs task route:', e.message);
  }
}

export async function getGlabsTaskRoute(taskId) {
  const db = getDb();
  try {
    return await dbGet('SELECT * FROM glabs_task_routes WHERE task_id = ?', [taskId]);
  } catch (e) {
    return null;
  }
}

export async function createFfmpegStudioJob(job) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO ffmpeg_studio_jobs (
      id, video_source_type, video_path, audio_source_type, audio_path,
      sync_option, bgm_path, bgm_volume, sfx_volume, video_scale, output_path, status, error_log
    )
    VALUES (
      @id, @video_source_type, @video_path, @audio_source_type, @audio_path,
      @sync_option, @bgm_path, @bgm_volume, @sfx_volume, @video_scale, @output_path, @status, @error_log
    )
  `);
  return await stmt.run([job]);
}

export async function getFfmpegStudioJob(id) {
  const db = getDb();
  return await dbGet('SELECT * FROM ffmpeg_studio_jobs WHERE id = ?', [id]);
}

export async function getAllFfmpegStudioJobs() {
  const db = getDb();
  return await dbAll('SELECT * FROM ffmpeg_studio_jobs ORDER BY created_at DESC', []);
}

export async function updateFfmpegStudioJob(id, updates) {
  const db = getDb();
  const fields = [];
  const values = [];
  for (const [key, val] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(val);
  }
  values.push(id);
  return db.prepare(`UPDATE ffmpeg_studio_jobs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export async function getPendingFfmpegStudioJob() {
  const db = getDb();
  return await dbGet("SELECT * FROM ffmpeg_studio_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1", []);
}

export async function hasActiveFfmpegStudioJob() {
  const db = getDb();
  const active = await dbGet("SELECT id FROM ffmpeg_studio_jobs WHERE status = 'processing' LIMIT 1", []);
  return !!active;
}

export async function createTtsBatch(batch) {
  const db = getDb();
  const payload = {
    tts_model_quality: 'speech-2.8-turbo',
    ...batch
  };
  const stmt = db.prepare(`
    INSERT INTO tts_studio_batches (id, source_type, source_ref_id, provider_active, voice_persona, config_speed, config_volume, tts_model_quality)
    VALUES (@id, @source_type, @source_ref_id, @provider_active, @voice_persona, @config_speed, @config_volume, @tts_model_quality)
  `);
  return await stmt.run([payload]);
}

export async function createTtsClip(clip) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO tts_studio_clips (id, batch_id, clip_index, source_text, audio_path, status)
    VALUES (@id, @batch_id, @clip_index, @source_text, @audio_path, @status)
  `);
  return await stmt.run([clip]);
}

export async function updateTtsClip(clipId, updates) {
  const db = getDb();
  const fields = [];
  const values = [];
  for (const [key, val] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(val);
  }
  values.push(clipId);
  return db.prepare(`UPDATE tts_studio_clips SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export async function getTtsBatchWithClips(batchId) {
  const db = getDb();
  const batch = await dbGet('SELECT * FROM tts_studio_batches WHERE id = ?', [batchId]);
  if (!batch) return null;
  const clips = await dbAll('SELECT * FROM tts_studio_clips WHERE batch_id = ? ORDER BY clip_index ASC', [batchId]);
  return { ...batch, clips };
}

export async function listTtsBatches() {
  const db = getDb();
  return await dbAll('SELECT * FROM tts_studio_batches ORDER BY created_at DESC', []);
}

export async function getCompletedTtsBatches() {
  const db = getDb();
  const batches = await dbAll(`
    SELECT DISTINCT b.* FROM tts_studio_batches b
    JOIN tts_studio_clips c ON b.id = c.batch_id
    WHERE c.status = 'completed'
    ORDER BY b.created_at DESC
  `, []);
  
  return await Promise.all(batches.map(async b => {
    const clips = await dbAll("SELECT * FROM tts_studio_clips WHERE batch_id = ? AND status = 'completed' ORDER BY clip_index ASC", [b.id]);
    return { ...b, clips };
  }));
}

export async function deleteTtsBatch(batchId) {
  const db = getDb();
  await dbRun('DELETE FROM tts_studio_clips WHERE batch_id = ?', [batchId]);
  return await dbRun('DELETE FROM tts_studio_batches WHERE id = ?', [batchId]);
}

export async function insertGlabsTask(arg1, campaign_id, item_id, clip_index, prompt, status, video_url) {
  const db = getDb();
  let task_id;
  if (typeof arg1 === 'object' && arg1 !== null) {
    task_id = arg1.task_id;
    campaign_id = arg1.campaign_id;
    item_id = arg1.item_id;
    clip_index = arg1.clip_index;
    prompt = arg1.prompt;
    status = arg1.status;
    video_url = arg1.video_url;
  } else {
    task_id = arg1;
  }

  // Use INSERT OR REPLACE to allow updating item_id and other details when task is reused
  return db.prepare(`
    INSERT OR REPLACE INTO glabs_tasks (task_id, campaign_id, item_id, clip_index, prompt, status, video_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(task_id || null, campaign_id || null, item_id || null, clip_index || null, prompt || null, status || 'processing', video_url || null);
}

export async function updateGlabsTaskStatus(taskId, status, videoUrl = null) {
  const db = getDb();
  const now = new Date().toISOString();
  if (videoUrl) {
    return await dbRun(`
      UPDATE glabs_tasks
      SET status = ?, video_url = ?, completed_at = ?
      WHERE task_id = ?
    `, [status, videoUrl, now, taskId]);
  } else {
    return await dbRun(`
      UPDATE glabs_tasks
      SET status = ?, completed_at = ?
      WHERE task_id = ?
    `, [status, now, taskId]);
  }
}

export async function getGlabsTask(taskId) {
  const db = getDb();
  return await dbGet('SELECT * FROM glabs_tasks WHERE task_id = ?', [taskId]);
}

export async function listGlabsTasks(limit = 50, offset = 0) {
  const db = getDb();
  return await dbAll(`
    SELECT t.*, c.campaign_name, i.source_url
    FROM glabs_tasks t
    LEFT JOIN re_campaigns c ON t.campaign_id = c.id
    LEFT JOIN re_campaign_items i ON t.item_id = i.id
    ORDER BY t.created_at DESC
    LIMIT ? OFFSET ?
  `, [limit, offset]);
}

export async function createRecommJob({ id, campaign_name, source_urls_json, target_recommendations_count }) {
  const db = getDb();
  return db.prepare(`
    INSERT INTO re_plus_recomm_jobs (id, campaign_name, source_urls_json, target_recommendations_count, status)
    VALUES (?, ?, ?, ?, 'pending')
  `).run(id, campaign_name, source_urls_json, target_recommendations_count || 3);
}

export async function getRecommJob(id) {
  const db = getDb();
  return await dbGet('SELECT * FROM re_plus_recomm_jobs WHERE id = ?', [id]);
}

export async function listRecommJobs() {
  const db = getDb();
  return await dbAll('SELECT * FROM re_plus_recomm_jobs ORDER BY created_at DESC', []);
}

export async function deleteRecommJob(id) {
  const db = getDb();
  return await dbRun('DELETE FROM re_plus_recomm_jobs WHERE id = ?', [id]);
}

export async function getRecommOutputsForJob(jobId) {
  const db = getDb();
  return await dbAll('SELECT * FROM re_plus_recomm_outputs WHERE recomm_job_id = ? ORDER BY created_at ASC', [jobId]);
}

export async function getRecommOutput(id) {
  const db = getDb();
  return await dbGet('SELECT * FROM re_plus_recomm_outputs WHERE id = ?', [id]);
}

export async function createRecommOutput({ id, recomm_job_id, source_url, video_deconstruction_json, recommended_product_name, short_description, unique_selling_point, scraped_image_url, local_image_path }) {
  const db = getDb();
  return db.prepare(`
    INSERT INTO re_plus_recomm_outputs (id, recomm_job_id, source_url, video_deconstruction_json, recommended_product_name, short_description, unique_selling_point, scraped_image_url, local_image_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, recomm_job_id, source_url, video_deconstruction_json, recommended_product_name, short_description, unique_selling_point, scraped_image_url, local_image_path);
}

export async function updateRecommOutput(id, updates) {
  const db = getDb();
  const existing = getRecommOutput(id);
  if (!existing) return null;

  return await dbRun(`
    UPDATE re_plus_recomm_outputs
    SET recommended_product_name = ?,
        short_description = ?,
        unique_selling_point = ?,
        local_image_path = ?,
        is_selected_by_user = ?
    WHERE id = ?
  `, [
    updates.recommended_product_name !== undefined ? updates.recommended_product_name : existing.recommended_product_name,
    updates.short_description !== undefined ? updates.short_description : existing.short_description,
    updates.unique_selling_point !== undefined ? updates.unique_selling_point : existing.unique_selling_point,
    updates.local_image_path !== undefined ? updates.local_image_path : existing.local_image_path,
    updates.is_selected_by_user !== undefined ? updates.is_selected_by_user : existing.is_selected_by_user,
    id
  ]);
}

export async function createPillarCampaign(campaign) {
  const db = getDb();
  const data = {
    id: campaign.id,
    account_name: campaign.account_name || null,
    execution_mode: campaign.execution_mode || 'manual_review',
    source_planner_id: campaign.source_planner_id || null,
    campaign_name: campaign.campaign_name,
    status: campaign.status || 'pending',
    content_pillar: campaign.content_pillar,
    custom_hook: campaign.custom_hook,
    visual_action_guideline: campaign.visual_action_guideline,
    custom_instruction: campaign.custom_instruction || '',
    ai_directive: campaign.ai_directive || '',
    mandatory_outro_line: campaign.mandatory_outro_line || '',
    brand_profile_id: campaign.brand_profile_id || null,
    narrative_mode: campaign.narrative_mode || 'Storytelling',
    visual_style: campaign.visual_style || 'Cinematic',
    face_visibility: campaign.face_visibility || 'Faceless',
    is_bridging_active: campaign.is_bridging_active !== undefined ? campaign.is_bridging_active : 0,
    target_clips_count: campaign.target_clips_count !== undefined ? campaign.target_clips_count : 4,
    bridge_at_clip: campaign.bridge_at_clip !== undefined ? campaign.bridge_at_clip : 2,
    bridge_duration_clips: campaign.bridge_duration_clips !== undefined ? campaign.bridge_duration_clips : 1,
    bridging_mode: campaign.bridging_mode || 'select_existing',
    target_product_id: campaign.target_product_id || null,
    ephemeral_product_data: campaign.ephemeral_product_data || null,
    aspect_ratio: campaign.aspect_ratio || '9:16',
    target_ai: campaign.target_ai || 'Google Veo (8s)',
    video_model: campaign.video_model || 'veo_31_lite',
    visual_mode: campaign.visual_mode || 'hybrid_lock',
    product_ref_image_path: campaign.product_ref_image_path || null,
    product_filename_declare: campaign.product_filename_declare || null,
    visual_overrides_json: campaign.visual_overrides_json || null,
    enable_tts: campaign.enable_tts !== undefined ? campaign.enable_tts : 0,
    enable_glabs: campaign.enable_glabs !== undefined ? campaign.enable_glabs : 0,
    enable_ffmpeg: campaign.enable_ffmpeg !== undefined ? campaign.enable_ffmpeg : 0,
    enable_social_post: campaign.enable_social_post !== undefined ? campaign.enable_social_post : 0,
    post_facebook_draft: campaign.post_facebook_draft !== undefined ? campaign.post_facebook_draft : 0,
    facebook_page_id: campaign.facebook_page_id || null,
    facebook_server_url: campaign.facebook_server_url || null,
    upload_markdown: campaign.upload_markdown !== undefined ? campaign.upload_markdown : 0,
    upload_spreadsheet: campaign.upload_spreadsheet !== undefined ? campaign.upload_spreadsheet : 0,
    target_spreadsheet_id: campaign.target_spreadsheet_id || null,
    target_markdown_url: campaign.target_markdown_url || null,
    local_scheduler: campaign.local_scheduler !== undefined ? campaign.local_scheduler : 0,
    scheduler_pause_at: campaign.scheduler_pause_at || null,
    voice_provider: campaign.voice_provider || 'minimax',
    voice_persona: campaign.voice_persona || 'Indonesian_casual_reporter_vv2',
    words_per_clip: campaign.words_per_clip || '17-19 kata',
    is_mass_production: campaign.is_mass_production !== undefined ? campaign.is_mass_production : 0,
    tts_model_quality: campaign.tts_model_quality || 'speech-2.8-turbo',
    voice_speed: campaign.voice_speed !== undefined ? campaign.voice_speed : 1.0,
    voice_volume: campaign.voice_volume !== undefined ? campaign.voice_volume : 1.0,
    target_language: campaign.target_language || 'id-ID',
    ffmpeg_sync_option: campaign.ffmpeg_sync_option || 'smart_sync',
    ffmpeg_video_scale: campaign.ffmpeg_video_scale !== undefined ? campaign.ffmpeg_video_scale : 1.0,
    ffmpeg_sfx_volume: campaign.ffmpeg_sfx_volume !== undefined ? campaign.ffmpeg_sfx_volume : 0.0,
    ffmpeg_bgm_volume: campaign.ffmpeg_bgm_volume !== undefined ? campaign.ffmpeg_bgm_volume : 0.15,
    nextcloud_parent_folder: campaign.nextcloud_parent_folder || 'MAKNA_Production_Final',
    fb_draft_mode: campaign.fb_draft_mode || 'auto',
    sfx_setting: campaign.sfx_setting || 'without_sfx',
    enable_vo_audit: campaign.enable_vo_audit !== undefined ? campaign.enable_vo_audit : 0,
    enable_audio_segment: campaign.enable_audio_segment !== undefined ? campaign.enable_audio_segment : 0,
    voice_cast_json: campaign.voice_cast_json || null,
    target_demographic: campaign.target_demographic || null,
    target_demographic_custom: campaign.target_demographic_custom || null
  };
  return db.prepare(`
    INSERT INTO pillar_campaigns (
      id, account_name, source_planner_id, campaign_name, status, execution_mode, content_pillar, custom_hook, visual_action_guideline, custom_instruction, ai_directive, mandatory_outro_line, brand_profile_id,
      narrative_mode, visual_style, face_visibility, is_bridging_active, target_clips_count, bridge_at_clip, bridge_duration_clips, bridging_mode,
      target_product_id, ephemeral_product_data, aspect_ratio, target_ai, video_model, visual_mode, product_ref_image_path,
      product_filename_declare, visual_overrides_json, enable_tts, enable_ffmpeg, enable_social_post,
      post_facebook_draft, facebook_page_id, facebook_server_url,
      voice_provider, voice_persona, words_per_clip, enable_glabs, upload_markdown, upload_spreadsheet, target_spreadsheet_id, target_markdown_url,
      local_scheduler, scheduler_pause_at, is_mass_production, tts_model_quality, voice_speed, voice_volume, target_language,
      ffmpeg_sync_option, ffmpeg_video_scale, ffmpeg_sfx_volume, ffmpeg_bgm_volume, nextcloud_parent_folder, fb_draft_mode, sfx_setting, enable_vo_audit, enable_audio_segment, voice_cast_json,
      target_demographic, target_demographic_custom
    ) VALUES (
      @id, @account_name, @source_planner_id, @campaign_name, @status, @execution_mode, @content_pillar, @custom_hook, @visual_action_guideline, @custom_instruction, @ai_directive, @mandatory_outro_line, @brand_profile_id,
      @narrative_mode, @visual_style, @face_visibility, @is_bridging_active, @target_clips_count, @bridge_at_clip, @bridge_duration_clips, @bridging_mode,
      @target_product_id, @ephemeral_product_data, @aspect_ratio, @target_ai, @video_model, @visual_mode, @product_ref_image_path,
      @product_filename_declare, @visual_overrides_json, @enable_tts, @enable_ffmpeg, @enable_social_post,
      @post_facebook_draft, @facebook_page_id, @facebook_server_url,
      @voice_provider, @voice_persona, @words_per_clip, @enable_glabs, @upload_markdown, @upload_spreadsheet, @target_spreadsheet_id, @target_markdown_url,
      @local_scheduler, @scheduler_pause_at, @is_mass_production, @tts_model_quality, @voice_speed, @voice_volume, @target_language,
      @ffmpeg_sync_option, @ffmpeg_video_scale, @ffmpeg_sfx_volume, @ffmpeg_bgm_volume, @nextcloud_parent_folder, @fb_draft_mode, @sfx_setting, @enable_vo_audit, @enable_audio_segment, @voice_cast_json,
      @target_demographic, @target_demographic_custom
    )
  `).run(data);
}

export async function createPillarCampaignBundle({ campaign, items }) {
  const normalizedItems = Array.isArray(items) ? items : [];
  if (normalizedItems.length === 0) throw new Error('OPC_ITEMS_REQUIRED');
  return withPgTransaction(async () => {
    await createPillarCampaign(campaign);
    let createdItems = 0;
    for (const item of normalizedItems) {
      const result = await createPillarCampaignItem({ ...item, campaign_id: campaign.id });
      createdItems += Number(result?.changes || result?.rowCount || 0);
    }
    if (createdItems !== normalizedItems.length) {
      throw new Error(`OPC_ITEM_COUNT_MISMATCH:${createdItems}/${normalizedItems.length}`);
    }
    return { campaignId: campaign.id, expectedItems: normalizedItems.length, createdItems };
  });
}

export async function getPillarCampaign(id) {
  const db = getDb();
  return await dbGet(`
    SELECT c.*, b.brand_name 
    FROM pillar_campaigns c
    LEFT JOIN brand_profiles b ON c.brand_profile_id = b.id
    WHERE c.id = ? AND c.tenant_id = ?
  `, [id, getActiveTenantId()]);
}

export async function listPillarCampaigns() {
  const db = getDb();
  return await dbAll(`
    SELECT c.*, b.brand_name 
    FROM pillar_campaigns c
    LEFT JOIN brand_profiles b ON c.brand_profile_id = b.id
    WHERE c.tenant_id = ?
    ORDER BY c.created_at DESC
  `, [getActiveTenantId()]);
}

export async function updatePillarCampaign(id, updates) {
  const db = getDb();
  const allowed = [
    'status', 'execution_mode', 'enable_glabs', 'enable_tts', 'enable_ffmpeg', 'enable_social_post',
    'upload_markdown', 'upload_spreadsheet', 'target_spreadsheet_id', 'target_markdown_url',
    'local_scheduler', 'scheduler_pause_at', 'tts_model_quality', 'voice_speed', 'voice_volume',
    'target_language', 'post_facebook_draft', 'facebook_page_id', 'facebook_server_url',
    'nextcloud_parent_folder', 'fb_draft_mode', 'bridge_duration_clips', 'sfx_setting', 'enable_vo_audit',
    'enable_audio_segment', 'voice_cast_json'
  ];
  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  return db.prepare(`UPDATE pillar_campaigns SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

// --- Manual Override for deletePillarCampaign ---
export async function deletePillarCampaign(id) {
  await pgQuery('DELETE FROM pillar_campaign_items WHERE campaign_id = $1', [id]);
  await pgQuery('DELETE FROM pillar_campaigns WHERE id = $1', [id]);
}

export async function createPillarCampaignItem(item) {
  const db = getDb();
  return db.prepare(`
    INSERT INTO pillar_campaign_items (campaign_id, row_creative_payload, generation_status) VALUES (?, ?, ?)
  `).run(
    item.campaign_id,
    item.row_creative_payload !== undefined ? item.row_creative_payload : null,
    item.generation_status !== undefined ? item.generation_status : 'pending'
  );
}

export async function getPillarCampaignItem(id) {
  const db = getDb();
  return await dbGet('SELECT * FROM pillar_campaign_items WHERE id = ?', [id]);
}

export async function listPillarCampaignItems(campaignId) {
  const db = getDb();
  return await dbAll('SELECT * FROM pillar_campaign_items WHERE campaign_id = ? ORDER BY id ASC', [campaignId]);
}

export async function checkAndUpdatePillarCampaignCompletion(campaignId) {
  const db = getDb();
  const campaign = await dbGet('SELECT * FROM pillar_campaigns WHERE id = ?', [campaignId]);
  if (!campaign || campaign.status === 'completed') return;

  const items = await dbAll('SELECT * FROM pillar_campaign_items WHERE campaign_id = ?', [campaignId]);
  if (items.length === 0) return;

  const actualNeedsSocial = campaign.enable_social_post === 1 || campaign.post_facebook_draft === 1 || campaign.post_youtube_draft === 1 || campaign.post_tiktok_draft === 1;

  const allFinished = items.every(item => {
    if (
      item.generation_status === 'failed' ||
      item.tts_status === 'failed' ||
      item.visual_status === 'failed' ||
      item.ffmpeg_status === 'failed' ||
      (actualNeedsSocial && item.social_post_status === 'failed')
    ) {
      return true;
    }

    const generationSuccess = item.generation_status === 'completed';
    if (!generationSuccess) return false;

    const ttsSuccess = item.tts_status === 'completed' || item.tts_status === 'skipped';
    if (!ttsSuccess) return false;

    const visualSuccess = item.visual_status === 'completed' || item.visual_status === 'skipped';
    if (!visualSuccess) return false;

    const ffmpegSuccess = item.ffmpeg_status === 'completed' || item.ffmpeg_status === 'skipped';
    if (!ffmpegSuccess) return false;

    if (actualNeedsSocial) {
      return item.social_post_status === 'completed' || item.social_post_status === 'skipped';
    }

    return true;
  });

  if (allFinished) {
    const hasRetryableFailures = items.some(item => {
      const isFailed = item.generation_status === 'failed' ||
                       item.tts_status === 'failed' ||
                       item.visual_status === 'failed' ||
                       item.ffmpeg_status === 'failed' ||
                       (actualNeedsSocial && item.social_post_status === 'failed');
      const retryCount = item.retry_count !== undefined ? Number(item.retry_count) : 0;
      return isFailed && retryCount < 3;
    });

    if (!hasRetryableFailures) {
      await dbRun("UPDATE pillar_campaigns SET status = 'completed' WHERE id = ?", [campaignId]);
      console.log(`[DB Monitor] Pillar Campaign ${campaignId} marked as completed.`);
    }
  }
}

export async function updatePillarCampaignItem(id, updates) {
  const db = getDb();
  const allowed = [
    'generation_status', 'result_json', 'tts_status', 'tts_batch_id', 
    'visual_status', 'visual_tasks_json', 'visual_clip_paths', 
    'ffmpeg_status', 'ffmpeg_output_path', 'upload_status', 'drive_link', 
    'social_post_status', 'social_links_json', 't2i_start_frame_path', 'retry_count',
    'row_creative_payload', 'new_video_plan_json', 'video_dna_json', 't2i_images_json',
    'workflow_status', 'regenerate_start_frames_status', 'regenerate_start_frames_progress'
  ];
  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  const result = db.prepare(`UPDATE pillar_campaign_items SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  try {
    const item = await dbGet('SELECT campaign_id FROM pillar_campaign_items WHERE id = ?', [id]);
    if (item && item.campaign_id) {
      checkAndUpdatePillarCampaignCompletion(item.campaign_id);
    }
  } catch (e) {
    console.error('[DB] Auto completion check failed for pillar:', e);
  }

  return result;
}

export async function getStrategicCampaignItem(id) {
  const db = getDb();
  return await dbGet('SELECT * FROM strategic_campaign_items WHERE id = ?', [id]);
}

export async function listStrategicCampaignItems(campaignId) {
  const db = getDb();
  return await dbAll('SELECT * FROM strategic_campaign_items WHERE campaign_id = ? ORDER BY sequence ASC, id ASC', [campaignId]);
}

export async function checkAndUpdateStrategicCampaignCompletion(campaignId) {
  const db = getDb();
  const campaign = await dbGet('SELECT * FROM strategic_campaigns WHERE id = ?', [campaignId]);
  if (!campaign || campaign.status === 'completed') return;

  const items = await dbAll('SELECT * FROM strategic_campaign_items WHERE campaign_id = ?', [campaignId]);
  if (items.length === 0) return;

  const actualNeedsSocial = campaign.enable_social_post === 1 || campaign.post_facebook_draft === 1 || campaign.post_youtube_draft === 1 || campaign.post_tiktok_draft === 1;

  const allFinished = items.every(item => {
    if (
      item.generation_status === 'failed' ||
      item.tts_status === 'failed' ||
      item.visual_status === 'failed' ||
      item.ffmpeg_status === 'failed' ||
      (actualNeedsSocial && item.social_post_status === 'failed')
    ) {
      return true;
    }

    const generationSuccess = item.generation_status === 'completed';
    if (!generationSuccess) return false;

    const ttsSuccess = item.tts_status === 'completed' || item.tts_status === 'skipped';
    if (!ttsSuccess) return false;

    const visualSuccess = item.visual_status === 'completed' || item.visual_status === 'skipped';
    if (!visualSuccess) return false;

    const ffmpegSuccess = item.ffmpeg_status === 'completed' || item.ffmpeg_status === 'skipped';
    if (!ffmpegSuccess) return false;

    if (actualNeedsSocial) {
      return item.social_post_status === 'completed' || item.social_post_status === 'skipped';
    }

    return true;
  });

  if (allFinished) {
    const hasRetryableFailures = items.some(item => {
      const isFailed = item.generation_status === 'failed' ||
                       item.tts_status === 'failed' ||
                       item.visual_status === 'failed' ||
                       item.ffmpeg_status === 'failed' ||
                       (actualNeedsSocial && item.social_post_status === 'failed');
      const retryCount = item.retry_count !== undefined ? Number(item.retry_count) : 0;
      return isFailed && retryCount < 3;
    });

    if (!hasRetryableFailures) {
      await dbRun("UPDATE strategic_campaigns SET status = 'completed' WHERE id = ?", [campaignId]);
      console.log(`[DB Monitor] Strategic Campaign ${campaignId} marked as completed.`);
    }
  }
}

export async function updateStrategicCampaignItem(id, updates) {
  const db = getDb();
  const allowed = [
    'generation_status', 'tts_status', 'tts_batch_id', 
    'visual_status', 'visual_tasks_json', 'visual_clip_paths', 
    'ffmpeg_status', 'ffmpeg_output_path', 'upload_status', 'drive_link', 
    'social_post_status', 'social_links_json', 'retry_count', 'error_message',
    'creative_package_json', 'publishing_package_json', 'final_package_json', 'workflow_status', 'video_dna_json'
  ];
  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  const result = db.prepare(`UPDATE strategic_campaign_items SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  try {
    const item = await dbGet('SELECT campaign_id FROM strategic_campaign_items WHERE id = ?', [id]);
    if (item && item.campaign_id) {
      checkAndUpdateStrategicCampaignCompletion(item.campaign_id);
    }
  } catch (e) {
    console.error('[DB] Auto completion check failed for strategic campaign item:', e);
  }

  return result;
}

export async function getNextPendingPillarSourcingItem() {
  const db = getDb();
  return await dbGet(
    "SELECT i.* FROM pillar_campaign_items i JOIN pillar_campaigns c ON i.campaign_id = c.id WHERE i.generation_status = 'pending_sourcing' AND c.status = 'running' AND c.local_scheduler = 0 ORDER BY i.id ASC LIMIT 1"
  , []);
}

export async function getNextPendingPillarGeneratorItem() {
  const db = getDb();
  return await dbGet(
    "SELECT i.* FROM pillar_campaign_items i JOIN pillar_campaigns c ON i.campaign_id = c.id WHERE i.generation_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 0 ORDER BY i.id ASC LIMIT 1"
  , []);
}

export async function getNextPendingPillarTtsItem() {
  const db = getDb();
  return await dbGet(
    "SELECT i.* FROM pillar_campaign_items i JOIN pillar_campaigns c ON i.campaign_id = c.id WHERE i.generation_status = 'completed' AND i.tts_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 0 ORDER BY i.id ASC LIMIT 1"
  , []);
}

export async function getNextPendingPillarGlabsItem() {
  const db = getDb();
  return db.prepare(
    "SELECT i.* FROM pillar_campaign_items i JOIN pillar_campaigns c ON i.campaign_id = c.id WHERE (i.tts_status = 'completed' OR i.tts_status = 'skipped') AND i.visual_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 0 ORDER BY i.id ASC LIMIT 1"
  ).get();
}

export async function getNextPendingPillarFfmpegItem() {
  const db = getDb();
  return await dbGet(
    "SELECT i.* FROM pillar_campaign_items i JOIN pillar_campaigns c ON i.campaign_id = c.id WHERE i.visual_status = 'completed' AND i.ffmpeg_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 0 ORDER BY i.id ASC LIMIT 1"
  , []);
}

export async function getNextPendingPillarSocialPostItem() {
  const db = getDb();
  return db.prepare(
    "SELECT i.* FROM pillar_campaign_items i JOIN pillar_campaigns c ON i.campaign_id = c.id WHERE (i.ffmpeg_status = 'completed' OR i.ffmpeg_status = 'skipped') AND i.social_post_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 0 ORDER BY i.id ASC LIMIT 1"
  ).get();
}

export async function createSystemAuditLog({ severity_level = 'WARNING', module_name, reference_id = null, error_message, human_resolution_hint = null }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO system_audit_logs (severity_level, module_name, reference_id, error_message, human_resolution_hint)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = await stmt.run([severity_level, module_name, reference_id, error_message, human_resolution_hint]);

  // Auto-trim: Hapus log lama jika lebih dari 500 baris
  try {
    await db.exec(`
      DELETE FROM system_audit_logs 
      WHERE id NOT IN (SELECT id FROM system_audit_logs ORDER BY id DESC LIMIT 500)
    `);
  } catch (e) {
    console.error('[DB] Auto trim system_audit_logs failed:', e);
  }

  return result;
}

export async function listSystemAuditLogs(includeResolved = false) {
  const db = getDb();
  if (includeResolved) {
    return await dbAll("SELECT * FROM system_audit_logs ORDER BY id DESC", []);
  } else {
    return await dbAll("SELECT * FROM system_audit_logs WHERE is_resolved = 0 ORDER BY id DESC", []);
  }
}

export async function resolveSystemAuditLog(id) {
  const db = getDb();
  return await dbRun("UPDATE system_audit_logs SET is_resolved = 1 WHERE id = ?", [id]);
}

export async function clearResolvedSystemAuditLogs() {
  const db = getDb();
  return db.exec("DELETE FROM system_audit_logs WHERE is_resolved = 1");
}

export async function createInstantCampaignItem({ campaign_id, row_creative_payload, generation_status = 'pending' }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO instant_campaign_items (campaign_id, row_creative_payload, generation_status)
    VALUES (?, ?, ?)
  `);
  return await stmt.run([campaign_id, row_creative_payload, generation_status]);
}

export async function listInstantCampaignItems(campaignId) {
  const db = getDb();
  return await dbAll('SELECT * FROM instant_campaign_items WHERE campaign_id = ? ORDER BY id ASC', [campaignId]);
}

export async function getInstantCampaignItem(id) {
  const db = getDb();
  return await dbGet('SELECT * FROM instant_campaign_items WHERE id = ?', [id]);
}

export async function checkAndUpdateInstantCampaignCompletion(campaignId) {
  const db = getDb();
  const campaign = await dbGet('SELECT * FROM instant_campaigns WHERE id = ?', [campaignId]);
  if (!campaign || campaign.status === 'completed') return;

  const items = await dbAll('SELECT * FROM instant_campaign_items WHERE campaign_id = ?', [campaignId]);
  if (items.length === 0) return;

  const config = await dbGet('SELECT * FROM instant_campaign_configs WHERE campaign_id = ?', [campaignId]);
  
  const enableSocialPost = campaign.enable_social_post !== undefined ? campaign.enable_social_post : 0;
  const actualNeedsSocial = enableSocialPost === 1 || campaign.post_facebook_draft === 1 || campaign.post_youtube_draft === 1 || campaign.post_tiktok_draft === 1;

  const allFinished = items.every(item => {
    if (
      item.generation_status === 'failed' ||
      item.tts_status === 'failed' ||
      item.visual_status === 'failed' ||
      item.ffmpeg_status === 'failed' ||
      (actualNeedsSocial && item.social_post_status === 'failed')
    ) {
      return true;
    }

    const generationSuccess = item.generation_status === 'completed';
    if (!generationSuccess) return false;

    const ttsSuccess = item.tts_status === 'completed' || item.tts_status === 'skipped';
    if (!ttsSuccess) return false;

    const visualSuccess = item.visual_status === 'completed' || item.visual_status === 'skipped';
    if (!visualSuccess) return false;

    const ffmpegSuccess = item.ffmpeg_status === 'completed' || item.ffmpeg_status === 'skipped';
    if (!ffmpegSuccess) return false;

    if (actualNeedsSocial) {
      return item.social_post_status === 'completed' || item.social_post_status === 'skipped';
    }

    return true;
  });

  if (allFinished) {
    const hasRetryableFailures = items.some(item => {
      const isFailed = item.generation_status === 'failed' ||
                       item.tts_status === 'failed' ||
                       item.visual_status === 'failed' ||
                       item.ffmpeg_status === 'failed' ||
                       (actualNeedsSocial && item.social_post_status === 'failed');
      const retryCount = item.retry_count !== undefined ? Number(item.retry_count) : 0;
      return isFailed && retryCount < 3;
    });

    if (!hasRetryableFailures) {
      await dbRun("UPDATE instant_campaigns SET status = 'completed' WHERE id = ?", [campaignId]);
      console.log(`[DB Monitor] Instant Campaign ${campaignId} marked as completed.`);
    }
  }
}

export async function updateInstantCampaignItem(id, updates) {
  const db = getDb();
  const allowed = [
    'generation_status', 'result_json', 'tts_status', 'tts_batch_id', 
    'visual_status', 'visual_tasks_json', 'visual_clip_paths', 
    'ffmpeg_status', 'ffmpeg_output_path', 'upload_status', 'drive_link', 
    'social_post_status', 'social_links_json', 'retry_count',
    'row_creative_payload'
  ];
  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  const result = db.prepare(`UPDATE instant_campaign_items SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  try {
    const item = await dbGet('SELECT campaign_id FROM instant_campaign_items WHERE id = ?', [id]);
    if (item && item.campaign_id) {
      checkAndUpdateInstantCampaignCompletion(item.campaign_id);
    }
  } catch (e) {
    console.error('[DB] Auto completion check failed for instant campaign:', e);
  }

  return result;
}

export async function getNextPendingInstantSourcingItem() {
  const db = getDb();
  return await dbGet(
    "SELECT i.* FROM instant_campaign_items i JOIN instant_campaigns c ON i.campaign_id = c.id WHERE i.generation_status = 'pending_sourcing' AND c.status = 'running' AND c.local_scheduler = 1 ORDER BY i.id ASC LIMIT 1"
  , []);
}

export async function getNextPendingInstantGeneratorItem() {
  const db = getDb();
  return await dbGet(
    "SELECT i.* FROM instant_campaign_items i JOIN instant_campaigns c ON i.campaign_id = c.id WHERE i.generation_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 1 ORDER BY i.id ASC LIMIT 1"
  , []);
}

export async function getNextPendingInstantTtsItem() {
  const db = getDb();
  return await dbGet(
    "SELECT i.* FROM instant_campaign_items i JOIN instant_campaigns c ON i.campaign_id = c.id WHERE i.generation_status = 'completed' AND i.tts_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 1 ORDER BY i.id ASC LIMIT 1"
  , []);
}

export async function getNextPendingInstantGlabsItem() {
  const db = getDb();
  return db.prepare(
    "SELECT i.* FROM instant_campaign_items i JOIN instant_campaigns c ON i.campaign_id = c.id WHERE (i.tts_status = 'completed' OR i.tts_status = 'skipped') AND i.visual_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 1 ORDER BY i.id ASC LIMIT 1"
  ).get();
}

export async function getNextPendingInstantFfmpegItem() {
  const db = getDb();
  return await dbGet(
    "SELECT i.* FROM instant_campaign_items i JOIN instant_campaigns c ON i.campaign_id = c.id WHERE i.visual_status = 'completed' AND i.ffmpeg_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 1 ORDER BY i.id ASC LIMIT 1"
  , []);
}

export async function getNextPendingInstantSocialPostItem() {
  const db = getDb();
  return db.prepare(
    "SELECT i.* FROM instant_campaign_items i JOIN instant_campaigns c ON i.campaign_id = c.id WHERE (i.ffmpeg_status = 'completed' OR i.ffmpeg_status = 'skipped') AND i.social_post_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 1 ORDER BY i.id ASC LIMIT 1"
  ).get();
}

export async function createSheetsCampaign(campaign) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO sheets_campaigns (
      id, campaign_name, campaign_type, target_language, spreadsheet_id, gdrive_folder_id,
      aspect_ratio, target_ai, video_model, visual_mode, words_per_clip, face_visibility,
      custom_instruction, brand_profile_id, visual_overrides_json, is_bridging_active,
      target_clips_count, bridge_at_clip, bridge_duration_clips, bridging_mode,
      target_product_id, promotion_style, narrative_mode, enable_tts, enable_glabs, enable_ffmpeg,
      enable_social_post, voice_provider, voice_persona, voice_speed, voice_volume,
      ffmpeg_sync_option, ffmpeg_video_scale, ffmpeg_sfx_volume, ffmpeg_bgm_volume,
      tts_model_quality, status, visual_style, enable_audio_segment, voice_cast_json
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  return await stmt.run([
    campaign.id, campaign.campaign_name, campaign.campaign_type, campaign.target_language || 'id-ID',
    campaign.spreadsheet_id, campaign.gdrive_folder_id || null,
    campaign.aspect_ratio || '9:16', campaign.target_ai || 'Google Veo (8s)',
    campaign.video_model || 'veo_31_lite', campaign.visual_mode || 'hybrid_lock',
    campaign.words_per_clip || '17-19 kata', campaign.face_visibility || 'Faceless',
    campaign.custom_instruction || '', campaign.brand_profile_id || null,
    campaign.visual_overrides_json || null, campaign.is_bridging_active || 0,
    campaign.target_clips_count || 4, campaign.bridge_at_clip || 2,
    campaign.bridge_duration_clips || 1, campaign.bridging_mode || 'select_existing',
    campaign.target_product_id || null, campaign.promotion_style || 'Softselling',
    campaign.narrative_mode || 'Storytelling',
    campaign.enable_tts || 0, campaign.enable_glabs || 0, campaign.enable_ffmpeg || 0,
    campaign.enable_social_post || 0, campaign.voice_provider || 'minimax',
    campaign.voice_persona || 'Professional Anchor', campaign.voice_speed || 1.0,
    campaign.voice_volume || 1.0, campaign.ffmpeg_sync_option || 'smart_sync',
    campaign.ffmpeg_video_scale || 1.0, campaign.ffmpeg_sfx_volume || 0.0,
    campaign.ffmpeg_bgm_volume || 0.15, campaign.tts_model_quality || 'speech-2.8-turbo',
    campaign.status || 'active', campaign.visual_style || 'Cinematic',
    campaign.enable_audio_segment || 0, campaign.voice_cast_json || null
  ]);
}

export async function getSheetsCampaigns() {
  const db = getDb();
  return db.prepare(`
    SELECT c.*, 
      (SELECT COUNT(*) FROM sheets_jobs j WHERE campaign_id = c.id AND j.id = (
        SELECT id FROM sheets_jobs WHERE campaign_id = j.campaign_id AND row_index = j.row_index ORDER BY created_at DESC LIMIT 1
      )) as total_jobs,
      (SELECT COUNT(*) FROM sheets_jobs j WHERE campaign_id = c.id AND status = 'completed' AND j.id = (
        SELECT id FROM sheets_jobs WHERE campaign_id = j.campaign_id AND row_index = j.row_index ORDER BY created_at DESC LIMIT 1
      )) as completed_jobs,
      (SELECT COUNT(*) FROM sheets_jobs j WHERE campaign_id = c.id AND status = 'failed' AND j.id = (
        SELECT id FROM sheets_jobs WHERE campaign_id = j.campaign_id AND row_index = j.row_index ORDER BY created_at DESC LIMIT 1
      )) as failed_jobs,
      (SELECT COUNT(*) FROM sheets_jobs j WHERE campaign_id = c.id AND status = 'processing' AND j.id = (
        SELECT id FROM sheets_jobs WHERE campaign_id = j.campaign_id AND row_index = j.row_index ORDER BY created_at DESC LIMIT 1
      )) as processing_jobs
    FROM sheets_campaigns c
    ORDER BY c.created_at DESC
  `).all();
}

export async function getSheetsCampaign(id) {
  const db = getDb();
  return await dbGet('SELECT * FROM sheets_campaigns WHERE id = ?', [id]);
}

export async function deleteSheetsCampaign(id) {
  const db = getDb();
  return await dbRun('DELETE FROM sheets_campaigns WHERE id = ?', [id]);
}

export async function updateSheetsCampaignStatus(id, status) {
  const db = getDb();
  return await dbRun('UPDATE sheets_campaigns SET status = ? WHERE id = ?', [status, id]);
}

export async function createSheetsJob(job) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO sheets_jobs (
      id, campaign_id, batch_id, row_index, url_or_topic, status, storyboard, voiceover,
      local_video_path, local_audio_path, gdrive_folder_url, retry_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  return await stmt.run([
    job.id, job.campaign_id, job.batch_id, job.row_index, job.url_or_topic, job.status || 'pending',
    job.storyboard || null, job.voiceover || null, job.local_video_path || null,
    job.local_audio_path || null, job.gdrive_folder_url || null, job.retry_count || 0
  ]);
}

export async function getSheetsJobs(campaignId) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM sheets_jobs j
    WHERE campaign_id = ? AND j.id = (
      SELECT id FROM sheets_jobs
      WHERE campaign_id = j.campaign_id AND row_index = j.row_index
      ORDER BY created_at DESC LIMIT 1
    )
    ORDER BY row_index ASC
  `).all(campaignId);
}

export async function getSheetsJob(id) {
  const db = getDb();
  return await dbGet('SELECT * FROM sheets_jobs WHERE id = ?', [id]);
}

export async function updateSheetsJobStatus(id, updates) {
  const db = getDb();
  const fields = [];
  const values = [];
  for (const key of Object.keys(updates)) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  return db.prepare(`UPDATE sheets_jobs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export async function createDeconstructBatch(data) {
  const db = getDb();
  db.prepare(`
    INSERT INTO re_deconstruct_batches (id, batch_name, target_recommendation_count, total_videos)
    VALUES (?, ?, ?, ?)
  `).run(data.id, data.batch_name, data.target_recommendation_count, data.total_videos);
  return data.id;
}

export async function createDeconstructAsset(data) {
  const db = getDb();
  db.prepare(`
    INSERT INTO re_deconstructed_assets (id, batch_id, source_url, original_caption)
    VALUES (?, ?, ?, ?)
  `).run(data.id, data.batch_id, data.source_url, data.original_caption || null);
}

export async function getDeconstructBatches() {
  const db = getDb();
  return await dbAll(`
    SELECT id, batch_name, target_recommendation_count, status, total_videos, processed_videos, created_at
    FROM re_deconstruct_batches
    ORDER BY created_at DESC
  `, []);
}

export async function getDeconstructBatchById(id) {
  const db = getDb();
  const batch = await dbGet('SELECT * FROM re_deconstruct_batches WHERE id = ?', [id]);
  if (!batch) return null;
  const assets = await dbAll('SELECT * FROM re_deconstructed_assets WHERE batch_id = ? ORDER BY created_at ASC', [id]);
  return { ...batch, assets };
}

export async function deleteDeconstructBatch(id) {
  const db = getDb();
  await dbRun('DELETE FROM re_deconstructed_assets WHERE batch_id = ?', [id]);
  await dbRun('DELETE FROM re_deconstruct_batches WHERE id = ?', [id]);
}

export async function getNextPendingDeconstructAsset() {
  const db = getDb();
  return await dbGet(`
    SELECT a.*, b.target_recommendation_count
    FROM re_deconstructed_assets a
    JOIN re_deconstruct_batches b ON a.batch_id = b.id
    WHERE a.status = 'pending_download'
    ORDER BY a.created_at ASC
    LIMIT 1
  `, []);
}

export async function updateDeconstructAsset(id, updates) {
  const db = getDb();
  const fields = [];
  const values = [];
  for (const key of Object.keys(updates)) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  return db.prepare(`UPDATE re_deconstructed_assets SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export async function updateDeconstructBatchProgress(batchId) {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as cnt FROM re_deconstructed_assets WHERE batch_id = ?').get(batchId).cnt;
  const processed = db.prepare("SELECT COUNT(*) as cnt FROM re_deconstructed_assets WHERE batch_id = ? AND status IN ('deconstructed', 'failed')").get(batchId).cnt;
  const newStatus = processed >= total ? 'completed' : 'processing';
  await dbRun('UPDATE re_deconstruct_batches SET processed_videos = ?, status = ? WHERE id = ?', [processed, newStatus, batchId]);
  return { total, processed, status: newStatus };
}

export async function createMultiplierTask(data) {
  const db = getDb();
  db.prepare(`
    INSERT INTO re_multiplier_tasks (
      id, deconstruct_asset_id, target_product_url, affiliate_url,
      vso_config_json, bridging_config_json, audio_config_json, status, enable_vo_audit
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id,
    data.deconstruct_asset_id,
    data.target_product_url || null,
    data.affiliate_url || null,
    data.vso_config_json || null,
    data.bridging_config_json || null,
    data.audio_config_json || null,
    data.status || 'pending_resolution',
    data.enable_vo_audit !== undefined ? Number(data.enable_vo_audit) : 1
  );
  return data.id;
}

export async function getMultiplierTasks() {
  const db = getDb();
  return await dbAll(`
    SELECT t.*, a.source_url as asset_source_url
    FROM re_multiplier_tasks t
    LEFT JOIN re_deconstructed_assets a ON t.deconstruct_asset_id = a.id
    ORDER BY t.created_at DESC
  `, []);
}

export async function getMultiplierTaskById(id) {
  const db = getDb();
  return await dbGet(`
    SELECT t.*, a.source_url as asset_source_url, a.original_storyboard_json
    FROM re_multiplier_tasks t
    LEFT JOIN re_deconstructed_assets a ON t.deconstruct_asset_id = a.id
    WHERE t.id = ?
  `, [id]);
}

export async function deleteMultiplierTask(id) {
  const db = getDb();
  await dbRun('DELETE FROM re_multiplier_tasks WHERE id = ?', [id]);
}

export async function updateMultiplierTask(id, updates) {
  const db = getDb();
  const fields = [];
  const values = [];
  for (const key of Object.keys(updates)) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  return db.prepare(`UPDATE re_multiplier_tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export async function getNextPendingMultiplierTask() {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM re_multiplier_tasks
    WHERE status IN ('pending_resolution', 'resolving_product', 'remaking', 'generating_audio', 'generating_visuals', 'ffmpeg_muxing')
    ORDER BY created_at ASC
    LIMIT 1
  `).get();
}

export async function createRecipeCampaign(data) {
  const db = getDb();
  db.prepare(`
    INSERT INTO recipe_campaigns (
      id, category, custom_category, visual_style, nextcloud_parent_folder, post_to_facebook, enable_glabs, target_recipe_count, images_per_recipe, selected_layout_id, grid_gap_size, grid_border_radius, grid_outer_padding, grid_bg_color, status, campaign_type, brand_profile_id, spreadsheet_id, config_json, source_deconstruct_asset_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id,
    data.category,
    data.custom_category || null,
    data.visual_style || 'Food Porn',
    data.nextcloud_parent_folder || 'MAKNA_Recipes',
    data.post_to_facebook !== undefined ? Number(data.post_to_facebook) : 0,
    data.enable_glabs !== undefined ? Number(data.enable_glabs) : 1,
    data.target_recipe_count || 1,
    data.images_per_recipe || 4,
    data.selected_layout_id || '4_editorial_split',
    data.grid_gap_size !== undefined ? Number(data.grid_gap_size) : 12,
    data.grid_border_radius !== undefined ? Number(data.grid_border_radius) : 16,
    data.grid_outer_padding !== undefined ? Number(data.grid_outer_padding) : 16,
    data.grid_bg_color || '#0d0d12',
    data.status || 'processing',
    data.campaign_type || 'static',
    data.brand_profile_id || null,
    data.spreadsheet_id || null,
    data.config_json || null,
    data.source_deconstruct_asset_id || null
  );
  return data.id;
}

export async function getRecipeCampaigns() {
  const db = getDb();
  return db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM recipe_items i WHERE i.campaign_id = c.id) as total_items,
      (SELECT COUNT(*) FROM recipe_items i WHERE i.campaign_id = c.id AND i.status = 'completed') as completed_items
    FROM recipe_campaigns c
    ORDER BY c.created_at DESC
  `).all();
}

export async function getRecipeCampaignById(id) {
  const db = getDb();
  return await dbGet(`SELECT * FROM recipe_campaigns WHERE id = ?`, [id]);
}

export async function updateRecipeCampaign(id, updates) {
  const db = getDb();
  const fields = [];
  const values = [];
  for (const key of Object.keys(updates)) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  return db.prepare(`UPDATE recipe_campaigns SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export async function deleteRecipeCampaign(id) {
  const db = getDb();
  await dbRun(`DELETE FROM recipe_campaigns WHERE id = ?`, [id]);
}

export async function createRecipeItem(data) {
  const db = getDb();
  db.prepare(`
    INSERT INTO recipe_items (
      id, campaign_id, recipe_title, recipe_markdown_text, t2i_prompts_json, status
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    data.id,
    data.campaign_id,
    data.recipe_title || null,
    data.recipe_markdown_text || null,
    data.t2i_prompts_json || null,
    data.status || 'pending_gemini'
  );
  return data.id;
}

export async function getRecipeItemsByCampaign(campaignId) {
  const db = getDb();
  return await dbAll(`SELECT * FROM recipe_items WHERE campaign_id = ? ORDER BY created_at ASC`, [campaignId]);
}

export async function getRecipeItemById(id) {
  const db = getDb();
  return await dbGet(`SELECT * FROM recipe_items WHERE id = ?`, [id]);
}

export async function updateRecipeItem(id, updates) {
  const db = getDb();
  const fields = [];
  const values = [];
  for (const key of Object.keys(updates)) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  return db.prepare(`UPDATE recipe_items SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export async function cleanupStaleJobs() {
  const db = getDb();
  const result = await dbRun(`
    UPDATE scheduler_jobs 
    SET status = 'pending', started_at = NULL 
    WHERE status = 'running'
  `, []);
  console.log(`[DB Boot Cleanup] Berhasil memulihkan ${result.changes} pekerjaan yang tertahan.`);
}

export async function retryReCampaignItem(itemId) {
  const db = getDb();
  const item = await dbGet('SELECT * FROM re_campaign_items WHERE id = ?', [itemId]);
  if (!item) return false;

  const updates = { retry_count: 0 };
  if (item.scrape_status === 'failed') updates.scrape_status = 'pending';
  else if (item.analyze_status === 'failed') updates.analyze_status = 'pending';
  else if (item.tts_status === 'failed') updates.tts_status = 'pending';
  else if (item.visual_status === 'failed') {
    updates.visual_status = 'pending';
    updates.visual_tasks_json = null;
  }
  else if (item.ffmpeg_status === 'failed') updates.ffmpeg_status = 'pending';
  else if (item.upload_status === 'failed') updates.upload_status = 'pending';
  else if (item.social_post_status === 'failed') updates.social_post_status = 'pending';

  const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = Object.values(updates);
  await dbRun(`UPDATE re_campaign_items SET ${fields} WHERE id = ?`, [...values, itemId]);

  // Set campaign status back to running to ensure scheduler picks it up
  await dbRun(`UPDATE re_campaigns SET status = 'running' WHERE id = ?`, [item.campaign_id]);

  return true;
}

export async function resetReCampaignItem(itemId) {
  const db = getDb();
  const item = await dbGet('SELECT campaign_id FROM re_campaign_items WHERE id = ?', [itemId]);
  if (!item) return false;

  await dbRun(`
    UPDATE re_campaign_items SET
      scrape_status = 'pending',
      analyze_status = 'pending',
      tts_status = 'pending',
      visual_status = 'pending',
      ffmpeg_status = 'pending',
      upload_status = 'pending',
      social_post_status = 'pending',
      workflow_status = 'ready_for_review',
      retry_count = 0,
      tts_batch_id = null,
      visual_clip_paths = null,
      ffmpeg_output_path = null,
      visual_tasks_json = null,
      t2i_images_json = null,
      t2i_start_frame_path = null,
      original_deconstruction_json = null,
      new_video_plan_json = null,
      video_dna_json = null,
      result_json = null,
      drive_link = null,
      social_links_json = null
    WHERE id = ?
  `, [itemId]);

  // Set campaign status back to running to ensure scheduler picks it up
  await dbRun(`UPDATE re_campaigns SET status = 'running' WHERE id = ?`, [item.campaign_id]);

  return true;
}

export async function upsertContentFlowItem(item) {
  const { upsertContentFlowItem: upsert } = await import('./contentflow-repository.js');
  const saved = await upsert(item);
  return saved?.id || null;
}

async function legacyUpsertContentFlowItem(item) {
  const db = getDb();
  const id = item.id || `cf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO content_flow_items (
      id, source_type, source_campaign_id, source_item_id, account_name, video_id,
      campaign_title, hook, nama_produk, link_affiliate, link_produk, caption,
      production_date, url_asset, drive_link, nextcloud_url, pipeline_status,
      tiktok_status, tiktok_publish_date, permalink_tiktok,
      facebook_status, facebook_publish_date, permalink_facebook,
      instagram_status, instagram_publish_date, permalink_instagram,
      youtube_status, youtube_publish_date, permalink_youtube,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      account_name = CASE WHEN EXCLUDED.account_name IS NOT NULL AND LENGTH(EXCLUDED.account_name) > 0 AND EXCLUDED.account_name != 'Umum' THEN EXCLUDED.account_name ELSE content_flow_items.account_name END,
      video_id = CASE WHEN EXCLUDED.video_id IS NOT NULL AND LENGTH(EXCLUDED.video_id) > 0 THEN EXCLUDED.video_id ELSE content_flow_items.video_id END,
      campaign_title = CASE WHEN EXCLUDED.campaign_title IS NOT NULL AND LENGTH(EXCLUDED.campaign_title) > 0 THEN EXCLUDED.campaign_title ELSE content_flow_items.campaign_title END,
      hook = CASE WHEN EXCLUDED.hook IS NOT NULL AND LENGTH(EXCLUDED.hook) > 0 THEN EXCLUDED.hook ELSE content_flow_items.hook END,
      nama_produk = CASE WHEN EXCLUDED.nama_produk IS NOT NULL AND LENGTH(EXCLUDED.nama_produk) > 0 AND EXCLUDED.nama_produk != 'Umum' THEN EXCLUDED.nama_produk ELSE content_flow_items.nama_produk END,
      link_affiliate = CASE WHEN EXCLUDED.link_affiliate IS NOT NULL AND LENGTH(EXCLUDED.link_affiliate) > 0 THEN EXCLUDED.link_affiliate ELSE content_flow_items.link_affiliate END,
      link_produk = CASE WHEN EXCLUDED.link_produk IS NOT NULL AND LENGTH(EXCLUDED.link_produk) > 0 THEN EXCLUDED.link_produk ELSE content_flow_items.link_produk END,
      caption = CASE WHEN EXCLUDED.caption IS NOT NULL AND LENGTH(EXCLUDED.caption) > 0 THEN EXCLUDED.caption ELSE content_flow_items.caption END,
      url_asset = CASE WHEN EXCLUDED.url_asset IS NOT NULL AND LENGTH(EXCLUDED.url_asset) > 0 THEN EXCLUDED.url_asset ELSE content_flow_items.url_asset END,
      drive_link = CASE WHEN EXCLUDED.drive_link IS NOT NULL AND LENGTH(EXCLUDED.drive_link) > 0 THEN EXCLUDED.drive_link ELSE content_flow_items.drive_link END,
      nextcloud_url = CASE WHEN EXCLUDED.nextcloud_url IS NOT NULL AND LENGTH(EXCLUDED.nextcloud_url) > 0 THEN EXCLUDED.nextcloud_url ELSE content_flow_items.nextcloud_url END,
      pipeline_status = CASE WHEN EXCLUDED.pipeline_status IS NOT NULL AND LENGTH(EXCLUDED.pipeline_status) > 0 THEN EXCLUDED.pipeline_status ELSE content_flow_items.pipeline_status END,
      updated_at = EXCLUDED.updated_at
  `);

  await stmt.run([
    id,
    item.source_type || 'opc',
    item.source_campaign_id || null,
    item.source_item_id || null,
    item.account_name || 'Umum',
    item.video_id || `VID-${Date.now().toString(36).toUpperCase()}`,
    item.campaign_title || '',
    item.hook || '',
    item.nama_produk || '',
    item.link_affiliate || '',
    item.link_produk || '',
    item.caption || '',
    item.production_date || now,
    item.url_asset || '',
    item.drive_link || '',
    item.nextcloud_url || '',
    item.pipeline_status || 'Completed',
    item.tiktok_status || 'Not Published',
    item.tiktok_publish_date || null,
    item.permalink_tiktok || null,
    item.facebook_status || 'Not Published',
    item.facebook_publish_date || null,
    item.permalink_facebook || null,
    item.instagram_status || 'Not Published',
    item.instagram_publish_date || null,
    item.permalink_instagram || null,
    item.youtube_status || 'Not Published',
    item.youtube_publish_date || null,
    item.permalink_youtube || null,
    item.created_at || now,
    now
  ]);

  // Auto-sync to PostgreSQL Storage Node 3 (non-blocking but returns promise)
  let pgPromise = null;
  try {
    pgPromise = pgQuery(`
      INSERT INTO content_flow_items (
        id, source_type, source_campaign_id, source_item_id, account_name, video_id,
        campaign_title, hook, nama_produk, link_affiliate, link_produk, caption,
        production_date, url_asset, drive_link, nextcloud_url, pipeline_status,
        tiktok_status, facebook_status, instagram_status, youtube_status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      ON CONFLICT (id) DO UPDATE SET
        account_name = CASE WHEN EXCLUDED.account_name IS NOT NULL AND LENGTH(EXCLUDED.account_name) > 0 AND EXCLUDED.account_name != 'Umum' THEN EXCLUDED.account_name ELSE content_flow_items.account_name END,
        video_id = CASE WHEN EXCLUDED.video_id IS NOT NULL AND LENGTH(EXCLUDED.video_id) > 0 THEN EXCLUDED.video_id ELSE content_flow_items.video_id END,
        campaign_title = CASE WHEN EXCLUDED.campaign_title IS NOT NULL AND LENGTH(EXCLUDED.campaign_title) > 0 THEN EXCLUDED.campaign_title ELSE content_flow_items.campaign_title END,
        hook = CASE WHEN EXCLUDED.hook IS NOT NULL AND LENGTH(EXCLUDED.hook) > 0 THEN EXCLUDED.hook ELSE content_flow_items.hook END,
        nama_produk = CASE WHEN EXCLUDED.nama_produk IS NOT NULL AND LENGTH(EXCLUDED.nama_produk) > 0 AND EXCLUDED.nama_produk != 'Umum' THEN EXCLUDED.nama_produk ELSE content_flow_items.nama_produk END,
        link_affiliate = CASE WHEN EXCLUDED.link_affiliate IS NOT NULL AND LENGTH(EXCLUDED.link_affiliate) > 0 THEN EXCLUDED.link_affiliate ELSE content_flow_items.link_affiliate END,
        link_produk = CASE WHEN EXCLUDED.link_produk IS NOT NULL AND LENGTH(EXCLUDED.link_produk) > 0 THEN EXCLUDED.link_produk ELSE content_flow_items.link_produk END,
        caption = CASE WHEN EXCLUDED.caption IS NOT NULL AND LENGTH(EXCLUDED.caption) > 0 THEN EXCLUDED.caption ELSE content_flow_items.caption END,
        url_asset = CASE WHEN EXCLUDED.url_asset IS NOT NULL AND LENGTH(EXCLUDED.url_asset) > 0 THEN EXCLUDED.url_asset ELSE content_flow_items.url_asset END,
        drive_link = CASE WHEN EXCLUDED.drive_link IS NOT NULL AND LENGTH(EXCLUDED.drive_link) > 0 THEN EXCLUDED.drive_link ELSE content_flow_items.drive_link END,
        nextcloud_url = CASE WHEN EXCLUDED.nextcloud_url IS NOT NULL AND LENGTH(EXCLUDED.nextcloud_url) > 0 THEN EXCLUDED.nextcloud_url ELSE content_flow_items.nextcloud_url END,
        pipeline_status = CASE WHEN EXCLUDED.pipeline_status IS NOT NULL AND LENGTH(EXCLUDED.pipeline_status) > 0 THEN EXCLUDED.pipeline_status ELSE content_flow_items.pipeline_status END,
        updated_at = EXCLUDED.updated_at;
    `, [
      id, item.source_type || 'opc', item.source_campaign_id || null, String(item.source_item_id || ''),
      item.account_name || 'Umum', item.video_id || `VID-${Date.now().toString(36).toUpperCase()}`,
      item.campaign_title || '', item.hook || '', item.nama_produk || 'Umum', item.link_affiliate || '', item.link_produk || '',
      item.caption || '', item.production_date || now, item.url_asset || '', item.drive_link || '', item.nextcloud_url || '',
      item.pipeline_status || 'Completed', item.tiktok_status || 'Not Published', item.facebook_status || 'Not Published',
      item.instagram_status || 'Not Published', item.youtube_status || 'Not Published', item.created_at || now, now
    ]).catch(err => console.error('[DB PG Sync Error]', err.message));
  } catch (err) {
    console.error('[DB PG Connection/Sync Exception]', err);
  }

  return pgPromise ? pgPromise.then(() => id) : Promise.resolve(id);
}

export async function getContentFlowItems(filters = {}) {
  const { listContentFlowItems } = await import('./contentflow-repository.js');
  return listContentFlowItems(filters);
}

async function legacyGetContentFlowItems(filters = {}) {
  const db = getDb();
  let sql = `SELECT * FROM content_flow_items WHERE 1=1`;
  const params = [];

  if (filters.allowedAccounts && Array.isArray(filters.allowedAccounts)) {
    if (filters.allowedAccounts.length > 0) {
      const placeholders = filters.allowedAccounts.map(() => 'LOWER(?)').join(',');
      sql += ` AND LOWER(account_name) IN (${placeholders})`;
      params.push(...filters.allowedAccounts);
    } else {
      sql += ` AND 1=0`; // User has no assigned brand permissions
    }
  }

  if (filters.sourceType && filters.sourceType !== 'all') {
    sql += ` AND source_type = ?`;
    params.push(filters.sourceType);
  }
  if (filters.accountName && filters.accountName !== 'all') {
    sql += ` AND LOWER(account_name) = LOWER(?)`;
    params.push(filters.accountName);
  }
  if (filters.productName && filters.productName !== 'all') {
    sql += ` AND nama_produk = ?`;
    params.push(filters.productName);
  }
  if (filters.pipelineStatus && filters.pipelineStatus !== 'all') {
    sql += ` AND pipeline_status = ?`;
    params.push(filters.pipelineStatus);
  }
  if (filters.tiktokStatus && filters.tiktokStatus !== 'Semua') {
    sql += ` AND tiktok_status = ?`;
    params.push(filters.tiktokStatus);
  }
  if (filters.facebookStatus && filters.facebookStatus !== 'Semua') {
    sql += ` AND facebook_status = ?`;
    params.push(filters.facebookStatus);
  }
  if (filters.instagramStatus && filters.instagramStatus !== 'Semua') {
    sql += ` AND instagram_status = ?`;
    params.push(filters.instagramStatus);
  }
  if (filters.q && filters.q.trim()) {
    const qStr = `%${filters.q.trim()}%`;
    sql += ` AND (video_id LIKE ? OR hook LIKE ? OR nama_produk LIKE ? OR campaign_title LIKE ? OR caption LIKE ?)`;
    params.push(qStr, qStr, qStr, qStr, qStr);
  }

  sql += ` ORDER BY created_at ASC`;

  const page = parseInt(filters.page || '1', 10);
  const limit = parseInt(filters.limit || '20', 10);
  const offset = (page - 1) * limit;

  // Get total count
  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
  const totalCountRes = await dbGet(countSql, params);
  const totalItems = totalCountRes ? totalCountRes.count : 0;
  const totalPages = Math.ceil(totalItems / limit) || 1;

  sql += ` LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const items = await dbAll(sql, params);

  // Distinct account list & product list
  const accountsRes = await dbAll(`SELECT DISTINCT account_name FROM content_flow_items WHERE account_name IS NOT NULL AND account_name != ''`, []);
  let accounts = accountsRes.map(a => a.account_name);
  if (filters.allowedAccounts && Array.isArray(filters.allowedAccounts)) {
    accounts = accounts.filter(a => filters.allowedAccounts.includes(a));
  }

  const productsRes = await dbAll(`SELECT DISTINCT nama_produk FROM content_flow_items WHERE nama_produk IS NOT NULL AND nama_produk != ''`, []);
  const products = productsRes.map(p => p.nama_produk);

  return {
    items,
    total_items: totalItems,
    current_page: page,
    total_pages: totalPages,
    available_accounts: accounts,
    available_products: products
  };
}

export async function updateContentFlowPublishStatus(id, updateData) {
  const { updateContentFlowItem } = await import('./contentflow-repository.js');
  return Boolean(await updateContentFlowItem(id, updateData));
}

export async function getContentFlowItemById(id) {
  const { getContentFlowItem } = await import('./contentflow-repository.js');
  return getContentFlowItem(id);
}

export async function deleteContentFlowItem(id) {
  const { deleteContentFlowItem: remove } = await import('./contentflow-repository.js');
  return (await remove(id)) ? 1 : 0;
}

export async function deleteContentFlowBrandItems(accountName) {
  const { deleteContentFlowAccount } = await import('./contentflow-repository.js');
  return deleteContentFlowAccount(accountName);
}

// ═══════════════════════════════════════════════════════════
// Universe Platform CRUD (Tahap 3)
// ═══════════════════════════════════════════════════════════

export async function createUniverseProfile(data) {
  const id = data.id || `univ_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const fields = ['id', 'name', 'slug', 'premise', 'tone', 'knowledge_domain', 'human_presence',
    'default_visual_style', 'default_aspect_ratio', 'default_scene_count', 'default_scene_duration',
    'default_story_template', 'cta_personality', 'default_pillars_json', 'rules_json',
    'negative_prompts_json', 'style_reference_path', 'status', 'version'];
  const values = [
    id, data.name, data.slug, data.premise || null, data.tone || null,
    data.knowledge_domain || 'general', data.human_presence || 'none',
    data.default_visual_style || 'cinematic_3d_clay', data.default_aspect_ratio || '9:16',
    data.default_scene_count || 7, data.default_scene_duration || 8,
    data.default_story_template || 'pet_problem_solution_7beat', data.cta_personality || null,
    JSON.stringify(data.default_pillars_json || data.default_pillars || []),
    JSON.stringify(data.rules_json || {}),
    JSON.stringify(data.negative_prompts_json || []),
    data.style_reference_path || null, data.status || 'active', data.version || 1
  ];
  const placeholders = fields.map(() => '?').join(', ');
  await dbRun(`INSERT INTO universe_profiles (${fields.join(', ')}) VALUES (${placeholders})`, values);
  return { id, ...data };
}

export async function getAllUniverseProfiles(statusFilter = 'active') {
  if (statusFilter === 'all') {
    return dbAll('SELECT * FROM universe_profiles ORDER BY name ASC', []);
  }
  return dbAll('SELECT * FROM universe_profiles WHERE status = ? ORDER BY name ASC', [statusFilter]);
}

export async function getUniverseProfile(id) {
  return dbGet('SELECT * FROM universe_profiles WHERE id = ?', [id]);
}

export async function getUniverseProfileBySlug(slug) {
  return dbGet('SELECT * FROM universe_profiles WHERE slug = ?', [slug]);
}

export async function updateUniverseProfile(id, data) {
  const allowedFields = ['name', 'slug', 'premise', 'tone', 'knowledge_domain', 'human_presence',
    'default_visual_style', 'default_aspect_ratio', 'default_scene_count', 'default_scene_duration',
    'default_story_template', 'cta_personality', 'default_pillars_json', 'rules_json',
    'negative_prompts_json', 'style_reference_path', 'status', 'version'];
  const jsonFields = ['default_pillars_json', 'rules_json', 'negative_prompts_json'];
  const updates = [];
  const values = [];
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(jsonFields.includes(field) ? JSON.stringify(data[field]) : data[field]);
    }
  }
  if (updates.length === 0) return null;
  updates.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);
  return dbRun(`UPDATE universe_profiles SET ${updates.join(', ')} WHERE id = ?`, values);
}

export async function archiveUniverseProfile(id) {
  return dbRun(`UPDATE universe_profiles SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
}

// --- Universe Characters CRUD ---

export async function createUniverseCharacter(data) {
  const id = data.id || `uchar_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const fields = ['id', 'universe_id', 'name', 'character_key', 'species', 'breed',
    'body_shape', 'fur_color', 'eye_color', 'wardrobe', 'personality', 'movement_style',
    'relative_size', 'role', 'canonical_prompt', 'forbidden_changes_json',
    'reference_image_path', 'version'];
  const values = [
    id, data.universe_id, data.name, data.character_key,
    data.species || null, data.breed || null, data.body_shape || null,
    data.fur_color || null, data.eye_color || null, data.wardrobe || null,
    data.personality || null, data.movement_style || null,
    data.relative_size || 'medium', data.role || 'supporting',
    data.canonical_prompt, JSON.stringify(data.forbidden_changes_json || []),
    data.reference_image_path || null, data.version || 1
  ];
  const placeholders = fields.map(() => '?').join(', ');
  await dbRun(`INSERT INTO universe_characters (${fields.join(', ')}) VALUES (${placeholders})`, values);
  return { id, ...data };
}

export async function getUniverseCharacters(universeId) {
  return dbAll('SELECT * FROM universe_characters WHERE universe_id = ? ORDER BY name ASC', [universeId]);
}

export async function getUniverseCharacter(id) {
  return dbGet('SELECT * FROM universe_characters WHERE id = ?', [id]);
}

export async function updateUniverseCharacter(id, data) {
  const allowedFields = ['name', 'character_key', 'species', 'breed', 'body_shape',
    'fur_color', 'eye_color', 'wardrobe', 'personality', 'movement_style',
    'relative_size', 'role', 'canonical_prompt', 'forbidden_changes_json',
    'reference_image_path', 'version'];
  const jsonFields = ['forbidden_changes_json'];
  const updates = [];
  const values = [];
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(jsonFields.includes(field) ? JSON.stringify(data[field]) : data[field]);
    }
  }
  if (updates.length === 0) return null;
  updates.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);
  return dbRun(`UPDATE universe_characters SET ${updates.join(', ')} WHERE id = ?`, values);
}

export async function deleteUniverseCharacter(id) {
  return dbRun('DELETE FROM universe_characters WHERE id = ?', [id]);
}

// --- Universe Locations CRUD ---

export async function createUniverseLocation(data) {
  const id = data.id || `uloc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const fields = ['id', 'universe_id', 'name', 'location_key', 'visual_description',
    'lighting_default', 'props', 'reference_image_path', 'version'];
  const values = [
    id, data.universe_id, data.name, data.location_key,
    data.visual_description || null, data.lighting_default || null,
    data.props || null, data.reference_image_path || null, data.version || 1
  ];
  const placeholders = fields.map(() => '?').join(', ');
  await dbRun(`INSERT INTO universe_locations (${fields.join(', ')}) VALUES (${placeholders})`, values);
  return { id, ...data };
}

export async function getUniverseLocations(universeId) {
  return dbAll('SELECT * FROM universe_locations WHERE universe_id = ? ORDER BY name ASC', [universeId]);
}

export async function updateUniverseLocation(id, data) {
  const allowedFields = ['name', 'location_key', 'visual_description',
    'lighting_default', 'props', 'reference_image_path', 'version'];
  const updates = [];
  const values = [];
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(data[field]);
    }
  }
  if (updates.length === 0) return null;
  updates.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);
  return dbRun(`UPDATE universe_locations SET ${updates.join(', ')} WHERE id = ?`, values);
}

export async function deleteUniverseLocation(id) {
  return dbRun('DELETE FROM universe_locations WHERE id = ?', [id]);
}

// --- Universe Episodes (Memory & Anti-Repetition) ---

export async function createUniverseEpisode(data) {
  const id = data.id || `uep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const fields = ['id', 'universe_id', 'planner_row_id', 'campaign_item_id',
    'product_used', 'problem_used', 'main_character', 'supporting_characters',
    'location', 'hook_keywords', 'resolution_pattern', 'cta_used'];
  const values = [
    id, data.universe_id, data.planner_row_id || null, data.campaign_item_id || null,
    data.product_used || null, data.problem_used || null,
    data.main_character || null, data.supporting_characters || null,
    data.location || null, data.hook_keywords || null,
    data.resolution_pattern || null, data.cta_used || null
  ];
  const placeholders = fields.map(() => '?').join(', ');
  await dbRun(`INSERT INTO universe_episodes (${fields.join(', ')}) VALUES (${placeholders})`, values);
  return { id, ...data };
}

export async function getUniverseEpisodes(universeId, limit = 50) {
  return dbAll('SELECT * FROM universe_episodes WHERE universe_id = ? ORDER BY created_at DESC LIMIT ?', [universeId, limit]);
}

export async function getEpisodeDigest(universeId) {
  const episodes = await dbAll(
    'SELECT product_used, problem_used, main_character, hook_keywords, resolution_pattern, cta_used FROM universe_episodes WHERE universe_id = ? ORDER BY created_at DESC LIMIT 30',
    [universeId]
  );
  if (!episodes || episodes.length === 0) return null;
  const usedProducts = [...new Set(episodes.map(e => e.product_used).filter(Boolean))];
  const usedProblems = [...new Set(episodes.map(e => e.problem_used).filter(Boolean))];
  const usedHooks = [...new Set(episodes.map(e => e.hook_keywords).filter(Boolean))];
  const usedResolutions = [...new Set(episodes.map(e => e.resolution_pattern).filter(Boolean))];
  const usedCtas = [...new Set(episodes.map(e => e.cta_used).filter(Boolean))];
  return {
    total_episodes: episodes.length,
    used_products: usedProducts,
    used_problems: usedProblems,
    used_hooks: usedHooks,
    used_resolutions: usedResolutions,
    used_ctas: usedCtas
  };
}
