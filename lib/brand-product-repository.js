import crypto from 'crypto';
import { pgQuery } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';

function activeTenantId() {
  const tenantId = getActiveTenantId();
  if (!tenantId || tenantId === '__none__') {
    const error = new Error('Tenant operasional tidak tersedia.');
    error.status = 403;
    throw error;
  }
  return tenantId;
}

/**
 * Validasi apakah brand profile dan produk ada di tenant yang sama
 */
async function validateTenantContext(brandProfileId, productId = null) {
  const tenantId = activeTenantId();

  // Validasi Brand Profile
  const brand = (await pgQuery(
    'SELECT id FROM brand_profiles WHERE id = $1 AND tenant_id = $2',
    [brandProfileId, tenantId]
  )).rows[0];
  
  if (!brand) {
    const error = new Error('Brand Profile tidak ditemukan di tenant aktif.');
    error.status = 403;
    throw error;
  }

  // Validasi Produk (jika ada)
  if (productId) {
    const product = (await pgQuery(
      'SELECT id FROM product_extractions WHERE id = $1 AND tenant_id = $2',
      [productId, tenantId]
    )).rows[0];
    
    if (!product) {
      const error = new Error('Produk tidak ditemukan di tenant aktif.');
      error.status = 404;
      throw error;
    }
  }

  return tenantId;
}

/**
 * Mendapatkan semua produk dengan status link ke Brand Profile tertentu
 */
export async function listBrandProducts({ brandProfileId, includeUnlinked = false, search = '' }) {
  const tenantId = await validateTenantContext(brandProfileId);
  
  const params = [tenantId, brandProfileId];
  let query = '';

  if (includeUnlinked) {
    query = `
      SELECT p.id AS product_id, p.product_name, p.category, p.raw_photo_url, p.clean_photo_url, p.packaging_type, p.packaging_status,
             bp.id AS brand_product_id, bp.affiliate_link, bp.tracking_code, bp.landing_page_url, bp.is_active
      FROM product_extractions p
      LEFT JOIN brand_products bp 
        ON p.id = bp.product_id AND bp.brand_profile_id = $2 AND bp.tenant_id = $1
      WHERE p.tenant_id = $1
    `;
  } else {
    query = `
      SELECT p.id AS product_id, p.product_name, p.category, p.raw_photo_url, p.clean_photo_url, p.packaging_type, p.packaging_status,
             bp.id AS brand_product_id, bp.affiliate_link, bp.tracking_code, bp.landing_page_url, bp.is_active
      FROM product_extractions p
      INNER JOIN brand_products bp 
        ON p.id = bp.product_id AND bp.brand_profile_id = $2 AND bp.tenant_id = $1
      WHERE p.tenant_id = $1 AND bp.is_active = TRUE
    `;
  }

  if (search.trim()) {
    params.push(`%${search.trim()}%`);
    query += ` AND (p.product_name ILIKE $3 OR p.category ILIKE $3)`;
  }

  query += ' ORDER BY p.product_name ASC';
  return (await pgQuery(query, params)).rows;
}

/**
 * Mendapatkan detail link Brand-Product
 */
export async function getBrandProduct({ brandProfileId, productId }) {
  const tenantId = await validateTenantContext(brandProfileId, productId);
  return (await pgQuery(
    'SELECT * FROM brand_products WHERE tenant_id = $1 AND brand_profile_id = $2 AND product_id = $3',
    [tenantId, brandProfileId, productId]
  )).rows[0] || null;
}

/**
 * Membuat atau memperbarui hubungan Brand-Product
 */
export async function upsertBrandProduct({
  brandProfileId,
  productId,
  affiliateLink,
  trackingCode = null,
  landingPageUrl = null,
  productNameOverride = null,
  ctaOverride = null,
  notes = null,
  isActive = true
}) {
  const tenantId = await validateTenantContext(brandProfileId, productId);
  const id = crypto.randomUUID();

  return (await pgQuery(
    `INSERT INTO brand_products (
      id, tenant_id, brand_profile_id, product_id, affiliate_link, tracking_code, 
      landing_page_url, product_name_override, cta_override, notes, is_active, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    ON CONFLICT (tenant_id, brand_profile_id, product_id) DO UPDATE SET
      affiliate_link = EXCLUDED.affiliate_link,
      tracking_code = COALESCE(EXCLUDED.tracking_code, brand_products.tracking_code),
      landing_page_url = COALESCE(EXCLUDED.landing_page_url, brand_products.landing_page_url),
      product_name_override = COALESCE(EXCLUDED.product_name_override, brand_products.product_name_override),
      cta_override = COALESCE(EXCLUDED.cta_override, brand_products.cta_override),
      notes = COALESCE(EXCLUDED.notes, brand_products.notes),
      is_active = EXCLUDED.is_active,
      updated_at = NOW()
    RETURNING *`,
    [
      id, tenantId, brandProfileId, productId, affiliateLink || null, trackingCode,
      landingPageUrl, productNameOverride, ctaOverride, notes, isActive
    ]
  )).rows[0];
}

/**
 * Menonaktifkan hubungan Brand-Product
 */
export async function deactivateBrandProduct({ brandProfileId, productId }) {
  const tenantId = await validateTenantContext(brandProfileId, productId);
  return (await pgQuery(
    `UPDATE brand_products 
     SET is_active = FALSE, updated_at = NOW() 
     WHERE tenant_id = $1 AND brand_profile_id = $2 AND product_id = $3 
     RETURNING *`,
    [tenantId, brandProfileId, productId]
  )).rows[0] || null;
}

/**
 * Mendapatkan semua brand yang terhubung ke satu produk
 */
export async function listProductBrands({ productId }) {
  const tenantId = activeTenantId();
  return (await pgQuery(
    `SELECT bp.id AS brand_product_id, bp.brand_profile_id, bp.affiliate_link, bp.is_active,
            b.brand_name
     FROM brand_products bp
     INNER JOIN brand_profiles b ON bp.brand_profile_id = b.id AND bp.tenant_id = b.tenant_id
     WHERE bp.product_id = $1 AND bp.tenant_id = $2
     ORDER BY b.brand_name ASC`,
    [productId, tenantId]
  )).rows[0] ? (await pgQuery(
    `SELECT bp.id AS brand_product_id, bp.brand_profile_id, bp.affiliate_link, bp.is_active,
            b.brand_name
     FROM brand_products bp
     INNER JOIN brand_profiles b ON bp.brand_profile_id = b.id AND bp.tenant_id = b.tenant_id
     WHERE bp.product_id = $1 AND bp.tenant_id = $2
     ORDER BY b.brand_name ASC`,
    [productId, tenantId]
  )).rows : [];
}
