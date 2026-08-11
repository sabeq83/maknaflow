import { pgQuery } from './db-pg.js';

/**
 * Validasi skema URL http/https
 */
export function isValidAffiliateUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

/**
 * Menyelesaikan (resolve) affiliate link untuk suatu produk dan brand profile
 * berdasarkan precedence arsitektur.
 *
 * Precedence:
 * 1. Campaign Explicit Override (jika diisi manual oleh user di campaign)
 * 2. Brand-Product Association (link spesifik brand untuk produk tersebut)
 * 3. Legacy Fallback (link global produk di tabel product_extractions)
 * 4. Missing (tidak ditemukan link)
 */
export async function resolveAffiliateLink({
  tenantId,
  brandProfileId,
  productId,
  explicitOverride = null,
  explicitAffiliateOverride = null,
  allowLegacyFallback = true
}) {
  if (!tenantId) {
    throw new Error('tenantId wajib disediakan untuk menyelesaikan affiliate link.');
  }
  if (!productId) {
    throw new Error('productId wajib disediakan untuk menyelesaikan affiliate link.');
  }

  const resolvedAt = new Date().toISOString();

  // 1. Ambil data produk dasar dari DB
  const productRes = await pgQuery(
    'SELECT product_name, input_source, affiliate_link FROM product_extractions WHERE id = $1 AND tenant_id = $2',
    [productId, tenantId]
  );
  const product = productRes.rows[0];
  if (!product) {
    throw new Error(`Produk dengan ID ${productId} tidak ditemukan pada tenant ${tenantId}.`);
  }

  const productName = product.product_name;
  const productUrl = product.input_source || product.source_url || '';

  const formatResult = (link, source, status, brandProductId = null, trackingCode = null) => ({
    brandProductId,
    brandProfileId: brandProfileId || null,
    productId,
    productName,
    productUrl,
    affiliateLink: link || '',
    trackingCode: trackingCode || null,
    source,
    status,
    resolvedAt
  });

  // 2. Precedence 1: Explicit Override
  const finalOverride = explicitOverride || explicitAffiliateOverride;
  if (finalOverride && finalOverride.trim()) {
    const overrideUrl = finalOverride.trim();
    if (!isValidAffiliateUrl(overrideUrl)) {
      throw new Error(`Scheme URL tidak valid (harus diawali http:// atau https://).`);
    }
    return formatResult(overrideUrl, 'campaign_override', 'resolved');
  }

  // 3. Precedence 2: Active Brand-Product Link
  if (brandProfileId) {
    const assocRes = await pgQuery(
      `SELECT id, affiliate_link, tracking_code 
       FROM brand_products 
       WHERE tenant_id = $1 AND brand_profile_id = $2 AND product_id = $3 AND is_active = TRUE`,
      [tenantId, brandProfileId, productId]
    );
    const association = assocRes.rows[0];
    if (association && association.affiliate_link && association.affiliate_link.trim()) {
      const link = association.affiliate_link.trim();
      return formatResult(link, 'brand_product', 'resolved', association.id, association.tracking_code);
    }
  }

  // 4. Precedence 3: Legacy Fallback
  if (allowLegacyFallback && product.affiliate_link && product.affiliate_link.trim()) {
    const link = product.affiliate_link.trim();
    return formatResult(link, 'legacy_product', 'legacy');
  }

  // 5. Precedence 4: Missing
  return formatResult('', 'missing', 'missing');
}
