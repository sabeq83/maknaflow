import crypto from 'crypto';
import { pgQuery, withPgTransaction } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';

export const PRODUCT_IMPORT_COLUMNS = Object.freeze([
  'id', 'input_source', 'is_url', 'product_name', 'product_description',
  'unique_selling_point', 'target_audience', 'pain_point_solved',
  'key_visuals_extracted', 'raw_response', 'category', 'tags', 'photo_url',
  'source_url', 'affiliate_link', 'raw_description', 'scraped_image_url',
  'raw_photo_url', 'clean_photo_url', 'cleaned_photo_url', 't2i_prompt',
  'generated_photo_url', 'active_photo', 'is_in_packaging', 'packaging_type',
  'i2v_action_prompt', 'extraction_status', 'glabs_task_id',
  'clean_photo_t2i_prompt', 'product_truth', 'geometric_truth'
]);

export const PRODUCT_UPDATE_COLUMNS = new Set(PRODUCT_IMPORT_COLUMNS.filter(column => column !== 'id'));

function activeTenantId() {
  const tenantId = getActiveTenantId();
  if (!tenantId || tenantId === '__none__') {
    const error = new Error('Tenant operasional tidak tersedia.');
    error.status = 403;
    throw error;
  }
  return tenantId;
}

export async function listProducts({ search = '', category = '' } = {}) {
  const params = [activeTenantId()];
  const where = ['tenant_id = $1'];
  if (search.trim()) {
    params.push(`%${search.trim()}%`);
    where.push(`(product_name ILIKE $${params.length} OR unique_selling_point ILIKE $${params.length} OR tags ILIKE $${params.length})`);
  }
  if (category.trim()) {
    params.push(category.trim());
    where.push(`LOWER(category) = LOWER($${params.length})`);
  }
  return (await pgQuery(`SELECT * FROM product_extractions WHERE ${where.join(' AND ')} ORDER BY created_at DESC`, params)).rows;
}

export async function listProductsForExport(ids = []) {
  const tenantId = activeTenantId();
  if (!ids.length) {
    return (await pgQuery('SELECT * FROM product_extractions WHERE tenant_id = $1 ORDER BY created_at DESC', [tenantId])).rows;
  }
  return (await pgQuery(
    'SELECT * FROM product_extractions WHERE tenant_id = $1 AND id = ANY($2::text[]) ORDER BY created_at DESC',
    [tenantId, ids]
  )).rows;
}

export async function countProducts() {
  const row = (await pgQuery('SELECT COUNT(*)::int AS count FROM product_extractions WHERE tenant_id = $1', [activeTenantId()])).rows[0];
  return row?.count || 0;
}

export async function getProductById(id) {
  return (await pgQuery('SELECT * FROM product_extractions WHERE id = $1 AND tenant_id = $2', [id, activeTenantId()])).rows[0] || null;
}

export async function createProduct(data) {
  const tenantId = activeTenantId();
  const row = { ...data, id: data.id || crypto.randomUUID() };
  const keys = PRODUCT_IMPORT_COLUMNS.filter(key => row[key] !== undefined);
  const columns = [...keys, 'tenant_id'];
  const values = [...keys.map(key => row[key]), tenantId];
  const placeholders = values.map((_, index) => `$${index + 1}`);
  return (await pgQuery(
    `INSERT INTO product_extractions (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
    values
  )).rows[0];
}

export async function updateProduct(id, updates) {
  const entries = Object.entries(updates).filter(([key]) => PRODUCT_UPDATE_COLUMNS.has(key));
  if (!entries.length) return getProductById(id);
  const values = entries.map(([, value]) => value);
  const sets = entries.map(([key], index) => `${key} = $${index + 1}`);
  values.push(id, activeTenantId());
  return (await pgQuery(
    `UPDATE product_extractions SET ${sets.join(', ')} WHERE id = $${values.length - 1} AND tenant_id = $${values.length} RETURNING *`,
    values
  )).rows[0] || null;
}

export async function deleteProduct(id) {
  const tenantId = activeTenantId();
  return withPgTransaction(async client => {
    const product = (await client.query(
      'SELECT id FROM product_extractions WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
      [id, tenantId]
    )).rows[0];
    if (!product) return null;
    await client.query('DELETE FROM pipeline_assets WHERE product_id = $1', [id]);
    return (await client.query(
      'DELETE FROM product_extractions WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    )).rows[0] || null;
  });
}

function normalizedImportRow(product) {
  const row = {};
  for (const key of PRODUCT_IMPORT_COLUMNS) {
    if (product[key] !== undefined && product[key] !== null) row[key] = product[key];
  }
  if (!row.product_name || !String(row.product_name).trim()) {
    const error = new Error('Setiap produk wajib memiliki product_name.');
    error.status = 400;
    throw error;
  }
  row.product_name = String(row.product_name).trim();
  row.id = row.id ? String(row.id) : crypto.randomUUID();
  return row;
}

export async function importProducts(products) {
  const tenantId = activeTenantId();
  return withPgTransaction(async client => {
    let importedCount = 0;
    let skippedCount = 0;
    for (const sourceProduct of products) {
      const product = normalizedImportRow(sourceProduct);
      const sourceUrl = String(product.source_url || '').trim();
      const inputSource = product.input_source === 'Manual' ? '' : String(product.input_source || '').trim();
      const duplicate = await client.query(`
        SELECT id FROM product_extractions
        WHERE tenant_id = $1 AND (
          id = $2
          OR ($3 <> '' AND source_url = $3)
          OR ($4 <> '' AND input_source = $4)
        ) LIMIT 1
      `, [tenantId, product.id, sourceUrl, inputSource]);
      if (duplicate.rowCount) {
        skippedCount += 1;
        continue;
      }

      const globalIdCollision = await client.query('SELECT 1 FROM product_extractions WHERE id = $1 LIMIT 1', [product.id]);
      if (globalIdCollision.rowCount) product.id = crypto.randomUUID();

      const keys = PRODUCT_IMPORT_COLUMNS.filter(key => product[key] !== undefined);
      const columns = [...keys, 'tenant_id'];
      const values = [...keys.map(key => product[key]), tenantId];
      const placeholders = values.map((_, index) => `$${index + 1}`);
      const inserted = await client.query(
        `INSERT INTO product_extractions (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
        values
      );
      if (inserted.rowCount !== 1) throw new Error(`Produk ${product.product_name} gagal disimpan.`);
      importedCount += 1;
    }
    return { importedCount, skippedCount };
  });
}
