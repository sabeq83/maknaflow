import { getDb } from './db.js';
import { getActiveTenantId } from './tenant-context.js';
import crypto from 'crypto';

let isTableInitialized = false;

export async function initExportRecordsTable() {
  if (isTableInitialized) return;
  const db = getDb();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS recipe_export_records (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      source TEXT NOT NULL,
      source_item_id TEXT NOT NULL,
      recipe_title TEXT,
      target_app TEXT,
      category_name TEXT,
      webadmin_recipe_id TEXT,
      video_url TEXT,
      exported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  isTableInitialized = true;
}

export async function recordRecipeExport({
  source = 'labs',
  sourceItemId = '',
  recipeTitle = '',
  targetApp = 'Android Webadmin',
  categoryName = '',
  webadminRecipeId = null,
  videoUrl = null
}) {
  await initExportRecordsTable();
  const db = getDb();
  const tenantId = getActiveTenantId() || 'default_tenant';
  const id = `exp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  await db.prepare(`
    INSERT INTO recipe_export_records (
      id, tenant_id, source, source_item_id, recipe_title, target_app, category_name, webadmin_recipe_id, video_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    tenantId,
    source,
    sourceItemId,
    recipeTitle || '',
    targetApp || 'Android Webadmin',
    categoryName || '',
    webadminRecipeId ? String(webadminRecipeId) : null,
    videoUrl || null
  );

  return id;
}

export async function getExportRecordsByTenant(tenantId) {
  await initExportRecordsTable();
  const db = getDb();
  const tId = tenantId || getActiveTenantId() || 'default_tenant';
  return await db.prepare(`
    SELECT * FROM recipe_export_records 
    WHERE tenant_id = ? 
    ORDER BY exported_at DESC
  `).all(tId);
}

export async function getExportHistoryForItem(sourceItemId, tenantId) {
  await initExportRecordsTable();
  const db = getDb();
  const tId = tenantId || getActiveTenantId() || 'default_tenant';
  return await db.prepare(`
    SELECT * FROM recipe_export_records 
    WHERE source_item_id = ? AND tenant_id = ? 
    ORDER BY exported_at DESC
  `).all(sourceItemId, tId);
}
