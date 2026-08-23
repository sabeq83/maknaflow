import 'server-only';
import { pgQuery } from './db-pg.js';
import { resolveAffiliateLink } from './affiliate-resolver.js';
import { getAuthorizedAffiliateBrand } from './affiliate-studio-brand-read-adapter.js';
import {
  evaluateAffiliateProductReadiness,
  normalizeAffiliateProductFilters,
  resolveBrandProductAssociation,
  resolveSafeProductImage
} from './affiliate-studio-product-readiness.js';

export async function listAffiliateBrandProductPortfolio({ user, brandId, filters }) {
  if (!user || user.tenantId === '__none__') {
    return null;
  }

  // 1. Authorize Brand
  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return null;

  // 2. Normalize Filters
  const normalized = normalizeAffiliateProductFilters(filters);
  const params = [user.tenantId, brand.id];
  const where = ['pe.tenant_id = $1'];

  // Search q
  if (normalized.q) {
    params.push(`%${normalized.q}%`);
    const qIdx = params.length;
    where.push(`(pe.product_name ILIKE $${qIdx} OR pe.product_description ILIKE $${qIdx} OR pe.unique_selling_point ILIKE $${qIdx} OR pe.target_audience ILIKE $${qIdx} OR bp.product_name_override ILIKE $${qIdx})`);
  }

  // Category
  if (normalized.category) {
    params.push(normalized.category);
    const catIdx = params.length;
    where.push(`LOWER(pe.category) = LOWER($${catIdx})`);
  }

  // Association
  if (normalized.association === 'candidate') {
    where.push('bp.id IS NULL');
  } else if (normalized.association === 'active') {
    where.push('bp.id IS NOT NULL AND bp.is_active = TRUE');
  } else if (normalized.association === 'inactive') {
    where.push('bp.id IS NOT NULL AND bp.is_active = FALSE');
  }

  // Readiness
  if (normalized.readiness === 'ready') {
    where.push(`
      pe.product_name IS NOT NULL AND pe.product_name != '' AND
      pe.product_description IS NOT NULL AND pe.product_description != '' AND
      pe.unique_selling_point IS NOT NULL AND pe.unique_selling_point != '' AND
      pe.target_audience IS NOT NULL AND pe.target_audience != '' AND
      (pe.photo_url IS NOT NULL OR pe.clean_photo_url IS NOT NULL OR pe.cleaned_photo_url IS NOT NULL OR pe.generated_photo_url IS NOT NULL OR pe.raw_photo_url IS NOT NULL) AND
      bp.id IS NOT NULL AND bp.is_active = TRUE AND
      bp.affiliate_link IS NOT NULL AND bp.affiliate_link != ''
    `);
  } else if (normalized.readiness === 'needs_review') {
    where.push(`
      pe.product_name IS NOT NULL AND pe.product_name != '' AND
      pe.product_description IS NOT NULL AND pe.product_description != '' AND
      pe.unique_selling_point IS NOT NULL AND pe.unique_selling_point != '' AND
      pe.target_audience IS NOT NULL AND pe.target_audience != '' AND
      (pe.photo_url IS NOT NULL OR pe.clean_photo_url IS NOT NULL OR pe.cleaned_photo_url IS NOT NULL OR pe.generated_photo_url IS NOT NULL OR pe.raw_photo_url IS NOT NULL) AND
      bp.id IS NOT NULL AND
      ((bp.is_active = FALSE) OR (bp.is_active = TRUE AND (bp.affiliate_link IS NULL OR bp.affiliate_link = '') AND pe.affiliate_link IS NOT NULL AND pe.affiliate_link != ''))
    `);
  } else if (normalized.readiness === 'incomplete') {
    where.push(`
      (
        pe.product_name IS NULL OR pe.product_name = '' OR
        pe.product_description IS NULL OR pe.product_description = '' OR
        pe.unique_selling_point IS NULL OR pe.unique_selling_point = '' OR
        pe.target_audience IS NULL OR pe.target_audience = '' OR
        (pe.photo_url IS NULL AND pe.clean_photo_url IS NULL AND pe.cleaned_photo_url IS NULL AND pe.generated_photo_url IS NULL AND pe.raw_photo_url IS NULL) OR
        bp.id IS NULL OR
        ((bp.id IS NULL OR bp.is_active = FALSE OR bp.affiliate_link IS NULL OR bp.affiliate_link = '') AND (pe.affiliate_link IS NULL OR pe.affiliate_link = ''))
      )
    `);
  }

  // Cursor Pagination
  if (normalized.cursor) {
    params.push(normalized.cursor);
    const cursorIdx = params.length;
    where.push(`pe.id > $${cursorIdx}`);
  }

  // Limit limit+1
  params.push(normalized.limit + 1);
  const limitIdx = params.length;

  const query = `
    SELECT 
      pe.id AS product_id,
      pe.product_name,
      pe.product_description,
      pe.unique_selling_point,
      pe.target_audience,
      pe.category,
      pe.active_photo,
      pe.cleaned_photo_url,
      pe.clean_photo_url,
      pe.generated_photo_url,
      pe.raw_photo_url,
      pe.photo_url,
      pe.affiliate_link AS legacy_affiliate_link,
      pe.input_source,
      bp.id AS brand_product_id,
      bp.affiliate_link,
      bp.tracking_code,
      bp.landing_page_url,
      bp.product_name_override,
      bp.cta_override,
      bp.notes,
      bp.is_active
    FROM product_extractions pe
    LEFT JOIN brand_products bp ON pe.id = bp.product_id AND bp.brand_profile_id = $2 AND bp.tenant_id = $1
    WHERE ${where.join(' AND ')}
    ORDER BY pe.id ASC
    LIMIT $${limitIdx}
  `;

  const rows = (await pgQuery(query, params)).rows;
  const hasMore = rows.length > normalized.limit;
  const pageRows = rows.slice(0, normalized.limit);

  // 3. Resolve Affiliate Link & Readiness for Page Items
  const items = [];
  for (const row of pageRows) {
    const affiliate = await resolveAffiliateLink({
      tenantId: user.tenantId,
      brandProfileId: brand.id,
      productId: row.product_id,
      allowLegacyFallback: true
    });

    const association = resolveBrandProductAssociation(row);
    const product = {
      product_name: row.product_name || '',
      product_description: row.product_description || '',
      unique_selling_point: row.unique_selling_point || '',
      target_audience: row.target_audience || '',
      active_photo: row.active_photo,
      cleaned_photo_url: row.cleaned_photo_url,
      clean_photo_url: row.clean_photo_url,
      generated_photo_url: row.generated_photo_url,
      raw_photo_url: row.raw_photo_url,
      photo_url: row.photo_url
    };

    const readiness = evaluateAffiliateProductReadiness({
      product,
      association,
      affiliate
    });

    const limitLength = (val, max = 150) => {
      if (typeof val !== 'string') return '';
      return val.length > max ? val.slice(0, max) + '...' : val;
    };

    items.push({
      productId: row.product_id,
      brandProductId: row.brand_product_id || null,
      displayName: row.product_name_override || row.product_name || '',
      productName: row.product_name || '',
      category: row.category || 'Uncategorized',
      description: limitLength(row.product_description, 120),
      uniqueSellingPoint: limitLength(row.unique_selling_point, 80),
      targetAudience: limitLength(row.target_audience, 80),
      sourceUrl: row.input_source || '',
      imageUrl: resolveSafeProductImage(row),
      association,
      affiliate: {
        link: affiliate.affiliateLink,
        source: affiliate.source,
        status: affiliate.status,
        trackingCode: row.tracking_code || null,
        landingPageUrl: row.landing_page_url || null,
        ctaOverride: row.cta_override || null
      },
      readiness,
      links: {
        productDatabase: '/products'
      }
    });
  }

  // 4. Catalog-wide Facets
  const facetParams = [user.tenantId, brand.id];
  const facetWhere = ['pe.tenant_id = $1'];
  if (normalized.q) {
    facetParams.push(`%${normalized.q}%`);
    const qIdx = facetParams.length;
    facetWhere.push(`(pe.product_name ILIKE $${qIdx} OR pe.product_description ILIKE $${qIdx} OR pe.unique_selling_point ILIKE $${qIdx} OR pe.target_audience ILIKE $${qIdx} OR bp.product_name_override ILIKE $${qIdx})`);
  }

  const facetsRes = await pgQuery(`
    SELECT 
      pe.category,
      pe.product_name,
      pe.product_description,
      pe.unique_selling_point,
      pe.target_audience,
      pe.active_photo,
      pe.cleaned_photo_url,
      pe.clean_photo_url,
      pe.generated_photo_url,
      pe.raw_photo_url,
      pe.photo_url,
      pe.affiliate_link AS legacy_affiliate_link,
      bp.id AS brand_product_id,
      bp.affiliate_link,
      bp.is_active
    FROM product_extractions pe
    LEFT JOIN brand_products bp ON pe.id = bp.product_id AND bp.brand_profile_id = $2 AND bp.tenant_id = $1
    WHERE ${facetWhere.join(' AND ')}
  `, facetParams);

  const categoriesMap = new Map();
  const associationCounts = { candidate: 0, active: 0, inactive: 0 };
  const readinessCounts = { ready: 0, needs_review: 0, incomplete: 0 };

  for (const fRow of facetsRes.rows) {
    const cat = fRow.category ? fRow.category.trim() : 'Uncategorized';
    categoriesMap.set(cat, (categoriesMap.get(cat) || 0) + 1);

    if (normalized.category && fRow.category?.toLowerCase() !== normalized.category.toLowerCase()) {
      continue;
    }

    const assoc = resolveBrandProductAssociation(fRow);
    associationCounts[assoc.state]++;

    let affiliateSource = 'missing';
    let affiliateLinkVal = '';
    if (fRow.brand_product_id && fRow.affiliate_link && fRow.affiliate_link.trim() !== '' && (fRow.is_active === true || fRow.is_active === 1)) {
      affiliateSource = 'brand_product';
      affiliateLinkVal = fRow.affiliate_link;
    } else if (fRow.legacy_affiliate_link && fRow.legacy_affiliate_link.trim() !== '') {
      affiliateSource = 'legacy_product';
      affiliateLinkVal = fRow.legacy_affiliate_link;
    }

    const readiness = evaluateAffiliateProductReadiness({
      product: fRow,
      association: assoc,
      affiliate: { link: affiliateLinkVal, source: affiliateSource }
    });
    readinessCounts[readiness.overall]++;
  }

  const categories = Array.from(categoriesMap.entries()).map(([name, count]) => ({ name, count }));

  return {
    brand: {
      id: brand.id,
      name: brand.name
    },
    items,
    facets: {
      association: associationCounts,
      readiness: readinessCounts,
      categories
    },
    pagination: {
      limit: normalized.limit,
      nextCursor: hasMore && items.length > 0 ? items[items.length - 1].productId : null,
      hasMore
    },
    generatedAt: new Date().toISOString()
  };
}
