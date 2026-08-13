import crypto from 'crypto';
import { pgQuery } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';

export class ProductSnapshotError extends Error {
  constructor(message, status = 400, code = 'PRODUCT_SNAPSHOT_INVALID') {
    super(message); this.status = status; this.code = code;
  }
}

export async function listEligibleAutomationProducts({ brandProfileId }) {
  const tenantId = getActiveTenantId();
  if (!brandProfileId) throw new ProductSnapshotError('Brand Profile wajib dipilih.');
  const result = await pgQuery(`
    SELECT p.id AS product_id,bp.id AS brand_product_id,p.product_name,p.product_description,
      p.unique_selling_point,p.source_url,p.raw_photo_url,p.clean_photo_url,p.category,
      bp.affiliate_link,bp.tracking_code,bp.landing_page_url,bp.is_active
    FROM brand_products bp
    JOIN product_extractions p ON p.id=bp.product_id AND p.tenant_id=bp.tenant_id
    JOIN brand_profiles b ON b.id=bp.brand_profile_id AND b.tenant_id=bp.tenant_id
    WHERE bp.tenant_id=$1 AND bp.brand_profile_id=$2 AND bp.is_active=TRUE
    ORDER BY p.product_name`, [tenantId, brandProfileId]);
  return result.rows.map(row => ({
    ...row,
    image_url: row.clean_photo_url || row.raw_photo_url || null,
    completeness: {
      description: Boolean(row.product_description), image: Boolean(row.clean_photo_url || row.raw_photo_url),
      product_url: Boolean(row.source_url || row.landing_page_url), affiliate: Boolean(row.affiliate_link)
    }
  }));
}

export async function captureProductSnapshot({ brandProfileId, productId, brandProductId }) {
  const tenantId = getActiveTenantId();
  const result = await pgQuery(`
    SELECT p.id AS product_id,bp.id AS brand_product_id,b.id AS brand_profile_id,b.brand_name,
      p.product_name,p.product_description,p.unique_selling_point,p.source_url,
      p.raw_photo_url,p.clean_photo_url,p.product_truth,p.geometric_truth,p.packaging_type,
      bp.affiliate_link,bp.tracking_code,bp.landing_page_url
    FROM brand_products bp
    JOIN product_extractions p ON p.id=bp.product_id AND p.tenant_id=bp.tenant_id
    JOIN brand_profiles b ON b.id=bp.brand_profile_id AND b.tenant_id=bp.tenant_id
    WHERE bp.tenant_id=$1 AND bp.brand_profile_id=$2 AND bp.product_id=$3
      AND bp.id=$4 AND bp.is_active=TRUE LIMIT 1`, [tenantId, brandProfileId, productId, brandProductId]);
  const row = result.rows[0];
  if (!row) throw new ProductSnapshotError('Produk tidak aktif atau tidak terhubung ke Brand Profile tenant ini.', 404, 'PRODUCT_BINDING_NOT_FOUND');
  if (!row.product_name || !row.product_description) throw new ProductSnapshotError('Nama dan deskripsi produk wajib lengkap.');
  const snapshot = {
    tenant_id: tenantId, brand_profile_id: row.brand_profile_id, brand_name: row.brand_name,
    product_id: row.product_id, brand_product_id: row.brand_product_id,
    product_name: row.product_name, product_description: row.product_description,
    product_usp: row.unique_selling_point || '', product_url: row.landing_page_url || row.source_url || '',
    product_image_url: row.clean_photo_url || row.raw_photo_url || '', affiliate_link: row.affiliate_link || '',
    tracking_code: row.tracking_code || '', product_truth: row.product_truth || '',
    geometric_truth: row.geometric_truth || '', packaging_type: row.packaging_type || '',
    captured_at: new Date().toISOString()
  };
  return { ...snapshot, sha256: crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex') };
}

export function applyProductSnapshotToOperatorRequest(request, snapshot) {
  return {
    ...request,
    planner: {
      ...request.planner,
      brand_id: snapshot.brand_profile_id, product_id: snapshot.product_id,
      brand_product_id: snapshot.brand_product_id, account_name: snapshot.brand_name,
      product_name: snapshot.product_name, product_description: snapshot.product_description,
      product_usp: snapshot.product_usp, product_url: snapshot.product_url,
      product_photo_url: snapshot.product_image_url
    },
    product_snapshot: snapshot
  };
}
