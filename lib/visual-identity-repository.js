import crypto from 'crypto';
import { pgQuery } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';
import { validateAndNormalizeVisualIdentity } from './visual-identity-contract.js';
import { listSystemVisualIdentities, getSystemVisualIdentity } from './visual-identity-system-presets.js';

export async function listVisualIdentities({ status = 'active' } = {}) {
  const tenantId = getActiveTenantId();
  
  let userPresets = [];
  if (status === 'all') {
    const res = await pgQuery(
      'SELECT * FROM visual_identity_presets WHERE tenant_id = $1 ORDER BY label ASC',
      [tenantId]
    );
    userPresets = res.rows;
  } else {
    const res = await pgQuery(
      'SELECT * FROM visual_identity_presets WHERE tenant_id = $1 AND status = $2 ORDER BY label ASC',
      [tenantId, status]
    );
    userPresets = res.rows;
  }

  const mappedUser = userPresets.map(row => ({
    id: row.id,
    tenant_id: row.tenant_id,
    preset_key: row.preset_key,
    label: row.label,
    description: row.description,
    status: row.status,
    version: row.version,
    config: row.config_json,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    source: 'user'
  }));

  if (status === 'archived') {
    return mappedUser;
  }

  const systemPresets = listSystemVisualIdentities().map(p => ({
    id: p.key,
    tenant_id: 'system',
    preset_key: p.key,
    label: p.label,
    description: p.description,
    status: 'active',
    version: p.version,
    config: p.config,
    source: 'system'
  }));

  return [...systemPresets, ...mappedUser];
}

export async function getVisualIdentity(idOrKey) {
  const system = getSystemVisualIdentity(idOrKey);
  if (system) {
    return {
      id: system.key,
      tenant_id: 'system',
      preset_key: system.key,
      label: system.label,
      description: system.description,
      status: 'active',
      version: system.version,
      config: system.config,
      source: 'system'
    };
  }

  const tenantId = getActiveTenantId();
  const res = await pgQuery(
    'SELECT * FROM visual_identity_presets WHERE tenant_id = $1 AND (id = $2 OR preset_key = $3)',
    [tenantId, idOrKey, idOrKey]
  );
  if (res.rowCount === 0) return null;
  const row = res.rows[0];
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    preset_key: row.preset_key,
    label: row.label,
    description: row.description,
    status: row.status,
    version: row.version,
    config: row.config_json,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    source: 'user'
  };
}

export async function createVisualIdentity(input, actor) {
  const tenantId = getActiveTenantId();
  const normalizedConfig = validateAndNormalizeVisualIdentity(input.config || {});
  
  const rawLabel = String(input.label || normalizedConfig.label || 'New Visual Identity').trim();
  let presetKey = String(input.preset_key || '').trim().toLowerCase().replace(/[\s_-]+/g, '_');
  if (!presetKey) {
    presetKey = rawLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }
  if (!presetKey) presetKey = `preset_${Date.now().toString(36)}`;

  if (getSystemVisualIdentity(presetKey)) {
    throw new Error(`Preset key "${presetKey}" conflicts with a system preset`);
  }

  const id = `vi_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
  const label = rawLabel;
  const description = String(input.description || normalizedConfig.description || '').trim();

  const res = await pgQuery(
    `INSERT INTO visual_identity_presets 
     (id, tenant_id, preset_key, label, description, config_json, status, version, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, 'active', 1, $7)
     RETURNING *`,
    [id, tenantId, presetKey, label, description, JSON.stringify(normalizedConfig), actor || null]
  );

  const row = res.rows[0];
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    preset_key: row.preset_key,
    label: row.label,
    description: row.description,
    status: row.status,
    version: row.version,
    config: row.config_json,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    source: 'user'
  };
}

export async function updateVisualIdentity(id, input, actor) {
  const preset = await getVisualIdentity(id);
  if (!preset) throw new Error('Visual Identity preset not found');
  if (preset.source === 'system') {
    throw new Error('System presets are immutable and cannot be updated');
  }

  const tenantId = getActiveTenantId();
  const normalizedConfig = validateAndNormalizeVisualIdentity(input.config || preset.config);
  const label = String(input.label || preset.label).trim();
  const description = String(input.description !== undefined ? input.description : preset.description).trim();

  const res = await pgQuery(
    `UPDATE visual_identity_presets
     SET label = $1, description = $2, config_json = $3, version = version + 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $4 AND tenant_id = $5
     RETURNING *`,
    [label, description, JSON.stringify(normalizedConfig), id, tenantId]
  );
  if (res.rowCount === 0) throw new Error('Failed to update preset (not authorized)');
  const row = res.rows[0];
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    preset_key: row.preset_key,
    label: row.label,
    description: row.description,
    status: row.status,
    version: row.version,
    config: row.config_json,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    source: 'user'
  };
}

export async function archiveVisualIdentity(id, actor) {
  const preset = await getVisualIdentity(id);
  if (!preset) throw new Error('Visual Identity preset not found');
  if (preset.source === 'system') {
    throw new Error('System presets are immutable and cannot be archived');
  }

  const tenantId = getActiveTenantId();
  const res = await pgQuery(
    `UPDATE visual_identity_presets
     SET status = 'archived', updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND tenant_id = $2
     RETURNING *`,
    [id, tenantId]
  );
  if (res.rowCount === 0) throw new Error('Failed to archive preset');
  return true;
}

export async function cloneVisualIdentity(idOrSystemKey, overrides = {}, actor) {
  const source = await getVisualIdentity(idOrSystemKey);
  if (!source) throw new Error('Source Visual Identity not found');

  const newLabel = String(overrides.label || `Copy of ${source.label}`).trim();
  const newDescription = String(overrides.description || source.description).trim();
  const mergedConfig = {
    ...source.config,
    ...(overrides.config || {})
  };

  return await createVisualIdentity({
    label: newLabel,
    description: newDescription,
    config: mergedConfig,
    preset_key: overrides.preset_key
  }, actor);
}
