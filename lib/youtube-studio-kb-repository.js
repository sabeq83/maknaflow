/**
 * lib/youtube-studio-kb-repository.js
 * YouTube Studio Knowledge Base — Tenant-safe persistence, versioning, scope resolution.
 * No legacy MAKNA Flow KB is imported or referenced.
 */

import { pgQuery, withPgTransaction } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';
import {
  KB_TYPES,
  KB_SCOPES,
  assertKbTransition,
  assertKbTypeScope,
  validateKnowledgeBase,
  normalizeKbSnapshot,
} from './youtube-studio-kb-contract.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function newId(prefix = 'kb') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function now() {
  return new Date().toISOString();
}

// ── KB Document CRUD ───────────────────────────────────────────────────────────

export async function listKnowledgeBases({ scope, scopeId, kbType, status } = {}) {
  const tenantId = getActiveTenantId();
  const conditions = ['k.tenant_id = $1'];
  const params = [tenantId];
  let idx = 2;

  if (scope) { conditions.push(`k.scope = $${idx++}`); params.push(scope); }
  if (scopeId) { conditions.push(`k.scope_id = $${idx++}`); params.push(scopeId); }
  if (kbType) { conditions.push(`k.kb_type = $${idx++}`); params.push(kbType); }
  if (status) { 
    conditions.push(`k.status = $${idx++}`); params.push(status); 
  } else {
    conditions.push("k.status != 'archived'");
  }

  const sql = `
    SELECT k.*, r.id AS active_revision_id, r.revision_number AS active_revision_number
    FROM youtube_knowledge_bases k
    LEFT JOIN youtube_knowledge_base_revisions r
      ON r.kb_id = k.id AND r.status = 'active'
    WHERE ${conditions.join(' AND ')}
    ORDER BY k.updated_at DESC
  `;
  const res = await pgQuery(sql, params);
  return res.rows;
}

export async function getKnowledgeBase(kbId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery(
    'SELECT * FROM youtube_knowledge_bases WHERE id = $1 AND tenant_id = $2',
    [kbId, tenantId]
  );
  return res.rows[0] || null;
}

export async function createKnowledgeBaseDraft({ kbType, scope, scopeId, title, content, actor }) {
  const tenantId = getActiveTenantId();
  assertKbTypeScope(kbType, scope);
  validateKnowledgeBase(kbType, content);

  return await withPgTransaction(async (client) => {
    const kbId = newId('ykb');
    await client.query(`
      INSERT INTO youtube_knowledge_bases (id, tenant_id, kb_type, scope, scope_id, title, status, created_by, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, CURRENT_TIMESTAMP)
    `, [kbId, tenantId, kbType, scope, scopeId, title, actor?.username || 'system']);

    const revId = newId('ykbr');
    await client.query(`
      INSERT INTO youtube_knowledge_base_revisions
        (id, kb_id, tenant_id, revision_number, status, content_json, ai_generated, created_by)
      VALUES ($1, $2, $3, 1, 'draft', $4, false, $5)
    `, [revId, kbId, tenantId, JSON.stringify(content), actor?.username || 'system']);

    const kb = await client.query('SELECT * FROM youtube_knowledge_bases WHERE id = $1', [kbId]);
    const rev = await client.query('SELECT * FROM youtube_knowledge_base_revisions WHERE id = $1', [revId]);
    return { kb: kb.rows[0], revision: rev.rows[0] };
  });
}

export async function updateKnowledgeBaseDraft({ kbId, title, content, actor }) {
  const tenantId = getActiveTenantId();
  return await withPgTransaction(async (client) => {
    const kbRes = await client.query(
      'SELECT * FROM youtube_knowledge_bases WHERE id = $1 AND tenant_id = $2',
      [kbId, tenantId]
    );
    const kb = kbRes.rows[0];
    if (!kb) throw new Error('KB not found');

    // Get latest revision number
    const latestRevRes = await client.query(
      'SELECT MAX(revision_number) AS max_rev FROM youtube_knowledge_base_revisions WHERE kb_id = $1 AND tenant_id = $2',
      [kbId, tenantId]
    );
    const nextRevNum = (latestRevRes.rows[0]?.max_rev || 0) + 1;

    if (content) validateKnowledgeBase(kb.kb_type, content);

    // Create new revision (old ones remain for history)
    const revId = newId('ykbr');
    await client.query(`
      INSERT INTO youtube_knowledge_base_revisions
        (id, kb_id, tenant_id, revision_number, status, content_json, ai_generated, created_by)
      VALUES ($1, $2, $3, $4, 'draft', $5, false, $6)
    `, [revId, kbId, tenantId, nextRevNum, JSON.stringify(content || {}), actor?.username || 'system']);

    if (title) {
      await client.query(
        'UPDATE youtube_knowledge_bases SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [title, kbId]
      );
    }

    const rev = await client.query('SELECT * FROM youtube_knowledge_base_revisions WHERE id = $1', [revId]);
    return rev.rows[0];
  });
}

// ── Revision Lifecycle ─────────────────────────────────────────────────────────

export async function getKbRevisions(kbId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery(
    'SELECT * FROM youtube_knowledge_base_revisions WHERE kb_id = $1 AND tenant_id = $2 ORDER BY revision_number DESC',
    [kbId, tenantId]
  );
  return res.rows;
}

export async function getActiveKbRevision(kbId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery(
    'SELECT * FROM youtube_knowledge_base_revisions WHERE kb_id = $1 AND tenant_id = $2 AND status = \'active\' LIMIT 1',
    [kbId, tenantId]
  );
  return res.rows[0] || null;
}

export async function activateKbRevision(revisionId, actor) {
  const tenantId = getActiveTenantId();
  return await withPgTransaction(async (client) => {
    const revRes = await client.query(
      'SELECT * FROM youtube_knowledge_base_revisions WHERE id = $1 AND tenant_id = $2',
      [revisionId, tenantId]
    );
    const rev = revRes.rows[0];
    if (!rev) throw new Error('KB revision not found');
    assertKbTransition(rev.status, 'active');

    // Supersede existing active revision for same kb_id
    await client.query(`
      UPDATE youtube_knowledge_base_revisions
      SET status = 'superseded'
      WHERE kb_id = $1 AND tenant_id = $2 AND status = 'active'
    `, [rev.kb_id, tenantId]);

    // Activate this revision
    await client.query(`
      UPDATE youtube_knowledge_base_revisions
      SET status = 'active', activated_by = $1, activated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [actor?.username || 'system', revisionId]);

    // Update parent KB document status
    await client.query(`
      UPDATE youtube_knowledge_bases SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = $1
    `, [rev.kb_id]);

    const updated = await client.query('SELECT * FROM youtube_knowledge_base_revisions WHERE id = $1', [revisionId]);
    return updated.rows[0];
  });
}

export async function archiveKbRevision(revisionId, actor) {
  const tenantId = getActiveTenantId();
  return await withPgTransaction(async (client) => {
    const revRes = await client.query(
      'SELECT * FROM youtube_knowledge_base_revisions WHERE id = $1 AND tenant_id = $2',
      [revisionId, tenantId]
    );
    const rev = revRes.rows[0];
    if (!rev) throw new Error('KB revision not found');
    assertKbTransition(rev.status, 'archived');

    await client.query(`
      UPDATE youtube_knowledge_base_revisions
      SET status = 'archived', archived_by = $1, archived_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [actor?.username || 'system', revisionId]);

    // If no more active revisions for this KB, set parent to archived
    const activeCount = await client.query(
      'SELECT COUNT(*) FROM youtube_knowledge_base_revisions WHERE kb_id = $1 AND status = \'active\'',
      [rev.kb_id]
    );
    if (parseInt(activeCount.rows[0].count) === 0) {
      await client.query(
        'UPDATE youtube_knowledge_bases SET status = \'archived\', updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [rev.kb_id]
      );
    }
    return { archived: true };
  });
}

// ── Scope Bindings ─────────────────────────────────────────────────────────────

export async function getKbBindings({ scope, scopeId }) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery(
    'SELECT b.*, k.kb_type, k.title, k.status AS kb_status FROM youtube_kb_bindings b JOIN youtube_knowledge_bases k ON k.id = b.kb_id WHERE b.tenant_id = $1 AND b.scope = $2 AND b.scope_id = $3',
    [tenantId, scope, scopeId]
  );
  return res.rows;
}

export async function setKbBinding({ scope, scopeId, kbId, isOverride = false, actor }) {
  const tenantId = getActiveTenantId();
  return await withPgTransaction(async (client) => {
    const kbRes = await client.query(
      'SELECT * FROM youtube_knowledge_bases WHERE id = $1 AND tenant_id = $2',
      [kbId, tenantId]
    );
    const kb = kbRes.rows[0];
    if (!kb) throw new Error('KB not found for binding');
    assertKbTypeScope(kb.kb_type, scope);

    const bindId = newId('ykbb');
    await client.query(`
      INSERT INTO youtube_kb_bindings (id, tenant_id, scope, scope_id, kb_id, kb_type, is_override, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (tenant_id, scope, scope_id, kb_type) DO UPDATE
        SET kb_id = EXCLUDED.kb_id, is_override = EXCLUDED.is_override
    `, [bindId, tenantId, scope, scopeId, kbId, kb.kb_type, isOverride, actor?.username || 'system']);

    return { bound: true, scope, scopeId, kbType: kb.kb_type };
  });
}

export async function removeKbBinding({ scope, scopeId, kbType }) {
  const tenantId = getActiveTenantId();
  await pgQuery(
    'DELETE FROM youtube_kb_bindings WHERE tenant_id = $1 AND scope = $2 AND scope_id = $3 AND kb_type = $4',
    [tenantId, scope, scopeId, kbType]
  );
  return { removed: true };
}

// ── Context Resolver ───────────────────────────────────────────────────────────

/**
 * Resolve the effective KB set for an episode:
 * 1. Channel bindings (base layer)
 * 2. Series overrides (override layer, replaces channel KB of same type)
 * Returns array of resolved KB entries with active revision content.
 */
export async function resolveEpisodeKnowledgeBase({ channelId, seriesId }) {
  const tenantId = getActiveTenantId();

  async function fetchBindingsWithRevision(scope, scopeId) {
    const res = await pgQuery(`
      SELECT b.kb_type, b.scope, b.scope_id, b.is_override,
             r.id AS revision_id, r.content_json AS content, r.revision_number, r.ai_generated
      FROM youtube_kb_bindings b
      JOIN youtube_knowledge_bases k ON k.id = b.kb_id AND k.tenant_id = b.tenant_id
      JOIN youtube_knowledge_base_revisions r ON r.kb_id = k.id AND r.status = 'active'
      WHERE b.tenant_id = $1 AND b.scope = $2 AND b.scope_id = $3
    `, [tenantId, scope, scopeId]);
    return res.rows;
  }

  const channelKbs = channelId ? await fetchBindingsWithRevision('channel', channelId) : [];
  const seriesKbs  = seriesId  ? await fetchBindingsWithRevision('series',  seriesId)  : [];

  // Series overrides replace channel KB of the same type
  const resolved = {};
  for (const kb of channelKbs) resolved[kb.kb_type] = kb;
  for (const kb of seriesKbs)  resolved[kb.kb_type] = { ...kb, is_override: true };

  return Object.values(resolved);
}

// ── Episode KB Snapshot ────────────────────────────────────────────────────────

/**
 * Create an immutable KB snapshot for a given episode context + generation stage.
 * Returns the snapshot object (bounded by stage-relevant KB types).
 */
export async function createKbSnapshot({ channelId, seriesId, stage }) {
  const resolvedKbs = await resolveEpisodeKnowledgeBase({ channelId, seriesId });
  return normalizeKbSnapshot(resolvedKbs, stage);
}
