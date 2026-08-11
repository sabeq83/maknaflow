import { pgQuery } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';

export const CONTENT_FLOW_UPDATE_FIELDS = new Set([
  'tiktok_status', 'tiktok_publish_date', 'permalink_tiktok',
  'facebook_status', 'facebook_publish_date', 'permalink_facebook',
  'instagram_status', 'instagram_publish_date', 'permalink_instagram',
  'youtube_status', 'youtube_publish_date', 'permalink_youtube',
  'account_name', 'drive_link', 'nextcloud_url', 'url_asset',
  'link_produk', 'link_affiliate', 'nama_produk', 'pipeline_status', 'catatan',
  'brand_profile_id', 'brand_product_id', 'product_id', 'affiliate_source', 'affiliate_status', 'affiliate_resolved_at'
]);

const CONTENT_FLOW_INSERT_FIELDS = [
  'id', 'source_type', 'source_campaign_id', 'source_item_id', 'account_name',
  'video_id', 'campaign_title', 'hook', 'nama_produk', 'link_affiliate',
  'link_produk', 'caption', 'production_date', 'url_asset', 'drive_link',
  'nextcloud_url', 'pipeline_status', 'tiktok_status', 'tiktok_publish_date',
  'permalink_tiktok', 'facebook_status', 'facebook_publish_date',
  'permalink_facebook', 'instagram_status', 'instagram_publish_date',
  'permalink_instagram', 'youtube_status', 'youtube_publish_date',
  'permalink_youtube', 'catatan', 
  'brand_profile_id', 'brand_product_id', 'product_id', 'affiliate_source', 'affiliate_status', 'affiliate_resolved_at',
  'created_at', 'updated_at'
];

function operationalTenant() {
  const tenantId = getActiveTenantId();
  if (!tenantId || tenantId === '__none__') {
    const error = new Error('Tenant operasional tidak tersedia.');
    error.status = 403;
    throw error;
  }
  return tenantId;
}

export async function listContentFlowItems(filters = {}) {
  const params = [operationalTenant()];
  const where = ['tenant_id = $1'];
  const add = (value, expression) => {
    params.push(value);
    where.push(expression.replaceAll('$n', `$${params.length}`));
  };

  if (Array.isArray(filters.allowedAccounts)) {
    if (!filters.allowedAccounts.length) where.push('FALSE');
    else add(filters.allowedAccounts.map(value => value.toLowerCase()), 'LOWER(account_name) = ANY($n::text[])');
  }
  if (filters.sourceType && filters.sourceType !== 'all') add(filters.sourceType, 'source_type = $n');
  if (filters.accountName && filters.accountName !== 'all') add(filters.accountName, 'LOWER(account_name) = LOWER($n)');
  if (filters.productName && filters.productName !== 'all') add(filters.productName, 'nama_produk = $n');
  if (filters.pipelineStatus && filters.pipelineStatus !== 'all') add(filters.pipelineStatus, 'pipeline_status = $n');
  if (filters.tiktokStatus && filters.tiktokStatus !== 'Semua') add(filters.tiktokStatus, 'tiktok_status = $n');
  if (filters.facebookStatus && filters.facebookStatus !== 'Semua') add(filters.facebookStatus, 'facebook_status = $n');
  if (filters.instagramStatus && filters.instagramStatus !== 'Semua') add(filters.instagramStatus, 'instagram_status = $n');
  if (filters.q?.trim()) add(`%${filters.q.trim()}%`, '(video_id ILIKE $n OR hook ILIKE $n OR nama_produk ILIKE $n OR campaign_title ILIKE $n OR caption ILIKE $n)');

  const page = Math.max(1, Number.parseInt(filters.page || '1', 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(filters.limit || '50', 10) || 50));
  const baseWhere = where.join(' AND ');
  const totalItems = Number((await pgQuery(`SELECT COUNT(*) AS count FROM content_flow_items WHERE ${baseWhere}`, params)).rows[0].count);
  params.push(limit, (page - 1) * limit);
  const items = (await pgQuery(
    `SELECT * FROM content_flow_items WHERE ${baseWhere} ORDER BY created_at ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )).rows;

  const facetParams = [operationalTenant()];
  let facetScope = 'tenant_id = $1';
  if (Array.isArray(filters.allowedAccounts)) {
    if (!filters.allowedAccounts.length) facetScope += ' AND FALSE';
    else {
      facetParams.push(filters.allowedAccounts.map(value => value.toLowerCase()));
      facetScope += ' AND LOWER(account_name) = ANY($2::text[])';
    }
  }
  const accounts = (await pgQuery(
    `SELECT DISTINCT LOWER(account_name) AS account_name FROM content_flow_items WHERE ${facetScope} AND account_name IS NOT NULL AND account_name <> '' ORDER BY account_name`,
    facetParams
  )).rows.map(row => row.account_name);
  const products = (await pgQuery(
    `SELECT DISTINCT nama_produk FROM content_flow_items WHERE ${facetScope} AND nama_produk IS NOT NULL AND nama_produk <> '' ORDER BY nama_produk`,
    facetParams
  )).rows.map(row => row.nama_produk);

  return { items, total_items: totalItems, current_page: page, total_pages: Math.ceil(totalItems / limit) || 1, available_accounts: accounts, available_products: products };
}

export async function upsertContentFlowItem(item) {
  const now = new Date().toISOString();
  const normalized = {
    ...item,
    id: item.id || `cf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    source_type: item.source_type || 'opc',
    account_name: String(item.account_name || 'umum').toLowerCase(),
    video_id: item.video_id || `VID-${Date.now().toString(36).toUpperCase()}`,
    pipeline_status: item.pipeline_status || 'Completed',
    tiktok_status: item.tiktok_status || 'Not Published',
    facebook_status: item.facebook_status || 'Not Published',
    instagram_status: item.instagram_status || 'Not Published',
    youtube_status: item.youtube_status || 'Not Published',
    created_at: item.created_at || now,
    updated_at: now
  };
  const fields = CONTENT_FLOW_INSERT_FIELDS.filter(field => normalized[field] !== undefined);
  const columns = [...fields, 'tenant_id'];
  const values = [...fields.map(field => normalized[field]), operationalTenant()];
  const placeholders = values.map((_, index) => `$${index + 1}`);
  const mutable = fields.filter(field => !['id', 'created_at'].includes(field));
  const updates = [...mutable.map(field => `${field}=EXCLUDED.${field}`), 'tenant_id=EXCLUDED.tenant_id'].join(', ');
  return (await pgQuery(
    `INSERT INTO content_flow_items (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT (id) DO UPDATE SET ${updates} RETURNING *`,
    values
  )).rows[0] || null;
}

export async function getContentFlowItem(id) {
  return (await pgQuery('SELECT * FROM content_flow_items WHERE id=$1 AND tenant_id=$2', [id, operationalTenant()])).rows[0] || null;
}

export async function updateContentFlowItem(id, changes) {
  const entries = Object.entries(changes).filter(([key, value]) => CONTENT_FLOW_UPDATE_FIELDS.has(key) && value !== undefined);
  if (!entries.length) return getContentFlowItem(id);
  const values = entries.map(([, value]) => value);
  const sets = entries.map(([key], index) => `${key}=$${index + 1}`);
  values.push(new Date().toISOString(), id, operationalTenant());
  sets.push(`updated_at=$${values.length - 2}`);
  return (await pgQuery(
    `UPDATE content_flow_items SET ${sets.join(', ')} WHERE id=$${values.length - 1} AND tenant_id=$${values.length} RETURNING *`,
    values
  )).rows[0] || null;
}

export async function deleteContentFlowItem(id) {
  return (await pgQuery('DELETE FROM content_flow_items WHERE id=$1 AND tenant_id=$2 RETURNING id', [id, operationalTenant()])).rows[0] || null;
}

export async function deleteContentFlowAccount(accountName) {
  return (await pgQuery('DELETE FROM content_flow_items WHERE LOWER(account_name)=LOWER($1) AND tenant_id=$2', [accountName, operationalTenant()])).rowCount;
}
