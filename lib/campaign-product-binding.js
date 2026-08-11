import crypto from 'crypto';
import { pgQuery } from './db-pg.js';
import { resolveAffiliateLink } from './affiliate-resolver.js';

/**
 * Mendapatkan binding produk untuk campaign / campaign item tertentu
 */
export async function getCampaignProductBinding({ tenantId, sourceType, sourceCampaignId, sourceItemId = null }) {
  if (!tenantId) throw new Error('tenantId wajib disediakan.');
  
  const query = `
    SELECT * FROM campaign_product_bindings 
    WHERE tenant_id = $1 
      AND source_type = $2 
      AND source_campaign_id = $3 
      AND COALESCE(source_item_id, '') = COALESCE($4, '')
  `;
  return (await pgQuery(query, [tenantId, sourceType, sourceCampaignId, sourceItemId])).rows[0] || null;
}

/**
 * Membuat atau memperbarui binding produk untuk campaign / campaign item tertentu.
 * Alur ini melakukan resolve affiliate link aktif dan menyimpannya sebagai snapshot.
 */
export async function createOrUpdateCampaignProductBinding({
  tenantId,
  sourceType,
  sourceCampaignId,
  sourceItemId = null,
  brandProfileId,
  productId,
  explicitAffiliateOverride = null,
  affiliateRequired = true
}) {
  if (!tenantId) throw new Error('tenantId wajib disediakan.');
  if (!sourceType) throw new Error('sourceType wajib disediakan.');
  if (!sourceCampaignId) throw new Error('sourceCampaignId wajib disediakan.');
  if (!productId) throw new Error('productId wajib disediakan.');

  // 1. Resolve affiliate link berdasarkan data aktif saat ini
  const resolution = await resolveAffiliateLink({
    tenantId,
    brandProfileId,
    productId,
    explicitOverride: explicitAffiliateOverride,
    allowLegacyFallback: true
  });

  // 2. Jika wajib diisi (affiliateRequired = true) dan statusnya missing, lemparkan error
  if (affiliateRequired && resolution.status === 'missing') {
    throw new Error(`Affiliate link untuk produk "${resolution.productName}" wajib dikonfigurasi.`);
  }

  // 3. Upsert snapshot binding ke database
  const id = crypto.randomUUID();
  const query = `
    INSERT INTO campaign_product_bindings (
      id, tenant_id, source_type, source_campaign_id, source_item_id,
      brand_profile_id, brand_product_id, product_id, product_name_snapshot,
      product_url_snapshot, affiliate_link_snapshot, tracking_code_snapshot,
      affiliate_source, affiliate_status, resolved_at, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
    ON CONFLICT (tenant_id, source_type, source_campaign_id, (COALESCE(source_item_id, '')))
    DO UPDATE SET
      brand_profile_id = EXCLUDED.brand_profile_id,
      brand_product_id = EXCLUDED.brand_product_id,
      product_id = EXCLUDED.product_id,
      product_name_snapshot = EXCLUDED.product_name_snapshot,
      product_url_snapshot = EXCLUDED.product_url_snapshot,
      affiliate_link_snapshot = EXCLUDED.affiliate_link_snapshot,
      tracking_code_snapshot = EXCLUDED.tracking_code_snapshot,
      affiliate_source = EXCLUDED.affiliate_source,
      affiliate_status = EXCLUDED.affiliate_status,
      resolved_at = NOW()
    RETURNING *
  `;

  return (await pgQuery(query, [
    id,
    tenantId,
    sourceType,
    sourceCampaignId,
    sourceItemId || null,
    resolution.brandProfileId,
    resolution.brandProductId,
    resolution.productId,
    resolution.productName,
    resolution.productUrl,
    resolution.affiliateLink,
    resolution.trackingCode,
    resolution.source,
    resolution.status
  ])).rows[0];
}

/**
 * Melakukan resolusi ulang (re-resolve) secara eksplisit untuk mengambil data link aktif terbaru
 */
export async function reResolveCampaignProductBinding({ tenantId, sourceType, sourceCampaignId, sourceItemId = null }) {
  const existing = await getCampaignProductBinding({ tenantId, sourceType, sourceCampaignId, sourceItemId });
  if (!existing) {
    throw new Error('Binding campaign tidak ditemukan, tidak bisa melakukan re-resolve.');
  }

  // Panggil kembali dengan parameter eksistensi tapi paksa resolve ulang
  return createOrUpdateCampaignProductBinding({
    tenantId,
    sourceType,
    sourceCampaignId,
    sourceItemId,
    brandProfileId: existing.brand_profile_id,
    productId: existing.product_id,
    explicitAffiliateOverride: existing.affiliate_source === 'campaign_override' ? existing.affiliate_link_snapshot : null,
    affiliateRequired: false // toleransi link kosong saat update
  });
}
