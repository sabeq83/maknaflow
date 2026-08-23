import 'server-only';
import { pgQuery } from './db-pg.js';
import { getAuthorizedAffiliateBrand } from './affiliate-studio-brand-read-adapter.js';
import { resolveAffiliateLink } from './affiliate-resolver.js';
import { resolveSafeProductImage } from './affiliate-studio-product-readiness.js';

export async function createCampaignProgram(user, brandId, data) {
  if (!user || user.tenantId === '__none__') return null;

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return null;

  const id = `prog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const tenantId = user.tenantId;

  await pgQuery(
    `INSERT INTO affiliate_programs (
      id, tenant_id, brand_profile_id, name, description, objective,
      target_audience, funnel_mix, start_date, end_date, platforms, kpis,
      production_target, status, created_by, updated_by, target_demographic, ai_directive, mandatory_outro_line
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
    [
      id,
      tenantId,
      brand.id,
      data.name || 'Untitled Campaign Program',
      data.description || null,
      data.objective || null,
      data.targetAudience || null,
      data.funnelMix ? JSON.stringify(data.funnelMix) : null,
      data.startDate || null,
      data.endDate || null,
      data.platforms || [],
      data.kpis || null,
      data.productionTarget || 0,
      'active',
      user.id,
      user.id,
      data.targetDemographic || null,
      data.aiDirective || null,
      data.mandatoryOutroLine || null
    ]
  );

  // Write audit event
  await logProgramEvent(tenantId, id, 'created', user.id, { data });

  return id;
}

export async function updateCampaignProgram(user, brandId, programId, data) {
  if (!user || user.tenantId === '__none__') return null;

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return null;

  const tenantId = user.tenantId;

  // Retrieve existing to assert existence and ownership
  const existing = await getCampaignProgram(user, brand.id, programId);
  if (!existing) return null;

  await pgQuery(
    `UPDATE affiliate_programs
     SET name = $1, description = $2, objective = $3, target_audience = $4,
         funnel_mix = $5, start_date = $6, end_date = $7, platforms = $8,
         kpis = $9, production_target = $10, updated_at = CURRENT_TIMESTAMP, updated_by = $11,
         target_demographic = $12, ai_directive = $13, mandatory_outro_line = $14
     WHERE id = $15 AND tenant_id = $16 AND brand_profile_id = $17`,
    [
      data.name || 'Untitled Campaign Program',
      data.description || null,
      data.objective || null,
      data.targetAudience || null,
      data.funnelMix ? JSON.stringify(data.funnelMix) : null,
      data.startDate || null,
      data.endDate || null,
      data.platforms || [],
      data.kpis || null,
      data.productionTarget || 0,
      user.id,
      data.targetDemographic || null,
      data.aiDirective || null,
      data.mandatoryOutroLine || null,
      programId,
      tenantId,
      brand.id
    ]
  );

  // Write audit event
  await logProgramEvent(tenantId, programId, 'updated', user.id, { data });

  return true;
}

export async function archiveCampaignProgram(user, brandId, programId) {
  if (!user || user.tenantId === '__none__') return null;

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return null;

  const tenantId = user.tenantId;

  const existing = await getCampaignProgram(user, brand.id, programId);
  if (!existing) return null;

  await pgQuery(
    `UPDATE affiliate_programs
     SET status = 'archived', updated_at = CURRENT_TIMESTAMP, updated_by = $1
     WHERE id = $2 AND tenant_id = $3 AND brand_profile_id = $4`,
    [user.id, programId, tenantId, brand.id]
  );

  // Write audit event
  await logProgramEvent(tenantId, programId, 'archived', user.id, {});

  return true;
}

export async function getCampaignProgram(user, brandId, programId) {
  if (!user || user.tenantId === '__none__') return null;

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return null;

  const rows = (await pgQuery(
    `SELECT * FROM affiliate_programs
     WHERE id = $1 AND tenant_id = $2 AND brand_profile_id = $3`,
    [programId, user.tenantId, brand.id]
  )).rows;

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    tenantId: row.tenant_id,
    brandProfileId: row.brand_profile_id,
    name: row.name,
    description: row.description,
    objective: row.objective,
    targetAudience: row.target_audience,
    funnelMix: row.funnel_mix,
    startDate: row.start_date,
    endDate: row.end_date,
    platforms: row.platforms || [],
    kpis: row.kpis,
    productionTarget: row.production_target,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    targetDemographic: row.target_demographic,
    aiDirective: row.ai_directive,
    mandatoryOutroLine: row.mandatory_outro_line
  };
}

export async function listCampaignPrograms(user, brandId, filters = {}) {
  if (!user || user.tenantId === '__none__') return [];

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return [];

  const status = filters.status || 'active';
  const params = [user.tenantId, brand.id, status];

  const rows = (await pgQuery(
    `SELECT * FROM affiliate_programs
     WHERE tenant_id = $1 AND brand_profile_id = $2 AND status = $3
     ORDER BY created_at DESC`,
    params
  )).rows;

  return rows.map(row => ({
    id: row.id,
    tenantId: row.tenant_id,
    brandProfileId: row.brand_profile_id,
    name: row.name,
    description: row.description,
    objective: row.objective,
    targetAudience: row.target_audience,
    funnelMix: row.funnel_mix,
    startDate: row.start_date,
    endDate: row.end_date,
    platforms: row.platforms || [],
    kpis: row.kpis,
    productionTarget: row.production_target,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

export async function listCampaignProgramProducts(user, brandId, programId) {
  if (!user || user.tenantId === '__none__') return [];

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return [];

  const rows = (await pgQuery(
    `SELECT * FROM affiliate_program_products
     WHERE tenant_id = $1 AND affiliate_program_id = $2
     ORDER BY created_at ASC`,
    [user.tenantId, programId]
  )).rows;

  return rows.map(row => ({
    id: row.id,
    tenantId: row.tenant_id,
    affiliateProgramId: row.affiliate_program_id,
    productId: row.product_id,
    brandProductId: row.brand_product_id,
    productSnapshot: row.product_snapshot,
    createdAt: row.created_at
  }));
}

export async function addProductsToCampaignProgram(user, brandId, programId, productIds) {
  if (!user || user.tenantId === '__none__' || !productIds || productIds.length === 0) return false;

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return false;

  const tenantId = user.tenantId;

  // Retrieve campaign program to verify exists
  const program = await getCampaignProgram(user, brand.id, programId);
  if (!program) return false;

  for (const productId of productIds) {
    // 1. Fetch live product info and association for snapshotting
    const productRows = (await pgQuery(
      `SELECT pe.*, bp.id AS brand_product_id, bp.product_name_override, bp.cta_override, bp.notes, bp.affiliate_link AS bp_aff_link, bp.tracking_code AS bp_tracking_code
       FROM product_extractions pe
       LEFT JOIN brand_products bp ON bp.tenant_id = pe.tenant_id AND bp.brand_profile_id = $1 AND bp.product_id = pe.id
       WHERE pe.tenant_id = $2 AND pe.id = $3`,
      [brand.id, tenantId, productId]
    )).rows;

    if (productRows.length === 0) continue;

    const row = productRows[0];

    // 2. Resolve live affiliate link data using resolved authority helper
    const linkRes = await resolveAffiliateLink({
      tenantId,
      brandProfileId: brand.id,
      productId,
      campaignId: null
    });

    // 3. Construct bounded snapshot
    const safeImage = resolveSafeProductImage(row);

    const snapshot = {
      productId: row.id,
      brandProductId: row.brand_product_id || null,
      displayName: row.product_name_override || row.product_name,
      productName: row.product_name,
      category: row.category,
      description: row.product_description,
      uniqueSellingPoint: row.unique_selling_point,
      targetAudience: row.target_audience,
      imageUrl: safeImage,
      affiliate: {
        link: linkRes.affiliateLink || null,
        source: linkRes.source || 'missing',
        status: linkRes.status || 'missing',
        trackingCode: linkRes.trackingCode || null,
        ctaOverride: row.cta_override || null
      },
      capturedAt: new Date().toISOString()
    };

    const id = `prog_prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Upsert binding: delete pre-existing and insert fresh to keep immutable snapshot up-to-date
    await pgQuery(
      `DELETE FROM affiliate_program_products WHERE tenant_id = $1 AND affiliate_program_id = $2 AND product_id = $3`,
      [tenantId, programId, productId]
    );

    await pgQuery(
      `INSERT INTO affiliate_program_products (id, tenant_id, affiliate_program_id, product_id, brand_product_id, product_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        tenantId,
        programId,
        productId,
        row.brand_product_id || null,
        JSON.stringify(snapshot)
      ]
    );
  }

  await logProgramEvent(tenantId, programId, 'products_added', user.id, { productIds });

  return true;
}

export async function removeProductsFromCampaignProgram(user, brandId, programId, productIds) {
  if (!user || user.tenantId === '__none__' || !productIds || productIds.length === 0) return false;

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return false;

  const tenantId = user.tenantId;

  const program = await getCampaignProgram(user, brand.id, programId);
  if (!program) return false;

  await pgQuery(
    `DELETE FROM affiliate_program_products
     WHERE tenant_id = $1 AND affiliate_program_id = $2 AND product_id = ANY($3)`,
    [tenantId, programId, productIds]
  );

  await logProgramEvent(tenantId, programId, 'products_removed', user.id, { productIds });

  return true;
}

export async function listCampaignProgramEvents(user, brandId, programId) {
  if (!user || user.tenantId === '__none__') return [];

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return [];

  const rows = (await pgQuery(
    `SELECT * FROM affiliate_program_events
     WHERE tenant_id = $1 AND affiliate_program_id = $2
     ORDER BY created_at DESC
     LIMIT 100`,
    [user.tenantId, programId]
  )).rows;

  return rows.map(row => ({
    id: row.id,
    tenantId: row.tenant_id,
    affiliateProgramId: row.affiliate_program_id,
    eventType: row.event_type,
    actorId: row.actor_id,
    payload: row.payload,
    createdAt: row.created_at
  }));
}

async function logProgramEvent(tenantId, programId, eventType, actorId, payload) {
  const id = `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await pgQuery(
    `INSERT INTO affiliate_program_events (id, tenant_id, affiliate_program_id, event_type, actor_id, payload)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, tenantId, programId, eventType, actorId, JSON.stringify(payload)]
  );
}
