import { pgQuery } from './db-pg.js';
import { getAuthorizedAffiliateBrand } from './affiliate-studio-brand-read-adapter.js';

export async function linkPlannerToProgram(user, brandId, programId, plannerId) {
  if (!user || user.tenantId === '__none__') return false;

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return false;

  const tenantId = user.tenantId;

  // 1. Verify program exists
  const progRows = (await pgQuery(
    `SELECT * FROM affiliate_programs WHERE id = $1 AND tenant_id = $2 AND brand_profile_id = $3`,
    [programId, tenantId, brand.id]
  )).rows;
  if (progRows.length === 0) return false;

  // 2. Verify planner exists and belongs to brand
  const plannerRows = (await pgQuery(
    `SELECT * FROM content_planners WHERE id = $1 AND tenant_id = $2`,
    [plannerId, tenantId]
  )).rows;
  if (plannerRows.length === 0) return false;

  const planner = plannerRows[0];
  if (planner.brand_id !== brand.id && planner.account_name?.toLowerCase() !== brand.name?.toLowerCase()) {
    throw new Error('Planner does not belong to the selected brand profile');
  }

  // 3. Link program and planner
  const linkId = `appl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await pgQuery(
    `INSERT INTO affiliate_program_planners (id, tenant_id, affiliate_program_id, content_planner_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tenant_id, affiliate_program_id, content_planner_id) DO NOTHING`,
    [linkId, tenantId, programId, plannerId]
  );

  // 4. Log audit event
  await logProgramEvent(tenantId, programId, 'planner_linked', user.id, {
    plannerId,
    title: planner.title
  });

  return true;
}

export async function unlinkPlannerFromProgram(user, brandId, programId, plannerId) {
  if (!user || user.tenantId === '__none__') return false;

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return false;

  const tenantId = user.tenantId;

  // 1. Delete links
  await pgQuery(
    `DELETE FROM affiliate_program_planners
     WHERE tenant_id = $1 AND affiliate_program_id = $2 AND content_planner_id = $3`,
    [tenantId, programId, plannerId]
  );

  // 2. Clean up associated row links to keep data clean
  await pgQuery(
    `DELETE FROM affiliate_planner_row_links
     WHERE tenant_id = $1 AND affiliate_program_id = $2 AND content_planner_id = $3`,
    [tenantId, programId, plannerId]
  );

  await logProgramEvent(tenantId, programId, 'planner_unlinked', user.id, { plannerId });

  return true;
}

export async function listLinkedProgramPlanners(user, brandId, programId) {
  if (!user || user.tenantId === '__none__') return [];

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return [];

  const tenantId = user.tenantId;

  const rows = (await pgQuery(
    `SELECT app.id AS link_id, app.created_at AS linked_at, cp.id AS planner_id, cp.title, cp.status, cp.created_at, cp.pillars_json
     FROM affiliate_program_planners app
     JOIN content_planners cp ON cp.tenant_id = app.tenant_id AND cp.id = app.content_planner_id
     WHERE app.tenant_id = $1 AND app.affiliate_program_id = $2
     ORDER BY app.created_at ASC`,
    [tenantId, programId]
  )).rows;

  const result = [];
  for (const row of rows) {
    // Count total rows and linked rows
    const totalResult = (await pgQuery(
      `SELECT COUNT(*)::int AS count FROM content_planner_rows WHERE planner_id = $1`,
      [row.planner_id]
    )).rows[0];

    const linkedResult = (await pgQuery(
      `SELECT COUNT(*)::int AS count FROM affiliate_planner_row_links
       WHERE tenant_id = $1 AND affiliate_program_id = $2 AND content_planner_id = $3`,
      [tenantId, programId, row.planner_id]
    )).rows[0];

    result.push({
      id: row.planner_id,
      linkId: row.link_id,
      title: row.title,
      status: row.status,
      linkedAt: row.linked_at,
      createdAt: row.created_at,
      totalRows: totalResult?.count || 0,
      linkedRows: linkedResult?.count || 0,
      pillars: (() => { try { return JSON.parse(row.pillars_json || '[]'); } catch (_) { return []; } })()
    });
  }

  return result;
}

export async function listAvailableBrandPlanners(user, brandId, programId) {
  if (!user || user.tenantId === '__none__') return [];

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return [];

  const tenantId = user.tenantId;

  const rows = (await pgQuery(
    `SELECT cp.id, cp.title, cp.status, cp.created_at, cp.pillars_json
     FROM content_planners cp
     LEFT JOIN affiliate_program_planners app ON app.tenant_id = cp.tenant_id AND app.affiliate_program_id = $1 AND app.content_planner_id = cp.id
     WHERE cp.tenant_id = $2
       AND (cp.brand_id = $3 OR LOWER(cp.account_name) = LOWER($4))
       AND app.id IS NULL
     ORDER BY cp.created_at DESC`,
    [programId, tenantId, brand.id, brand.name]
  )).rows;

  return rows.map(r => ({
    id: r.id,
    title: r.title,
    status: r.status,
    createdAt: r.created_at,
    pillars: (() => { try { return JSON.parse(r.pillars_json || '[]'); } catch (_) { return []; } })()
  }));
}

export async function getPlannerRowLinks(user, brandId, programId, plannerId) {
  if (!user || user.tenantId === '__none__') return [];

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return [];

  const tenantId = user.tenantId;

  // 1. Fetch all rows of the content planner
  const rows = (await pgQuery(
    `SELECT * FROM content_planner_rows WHERE planner_id = $1 ORDER BY sequence ASC`,
    [plannerId]
  )).rows;

  // 2. Fetch row links
  const links = (await pgQuery(
    `SELECT * FROM affiliate_planner_row_links
     WHERE tenant_id = $1 AND affiliate_program_id = $2 AND content_planner_id = $3`,
    [tenantId, programId, plannerId]
  )).rows;

  const linksMap = new Map(links.map(l => [l.planner_row_id, l]));

  return rows.map(r => {
    const link = linksMap.get(r.id);
    return {
      id: r.id,
      sequence: r.sequence,
      pillar: r.pillar,
      categoryCep: r.category_cep,
      wsMatrix: r.ws_matrix,
      context: r.context,
      hook: r.hook,
      visualAction: r.visual_action,
      videoId: r.video_id,
      product: r.product,
      productId: r.product_id,
      linkId: link?.id || null,
      programProductId: link?.program_product_id || null,
      funnelStage: link?.funnel_stage || null,
      metadata: link?.metadata || {}
    };
  });
}

export async function updatePlannerRowLink(user, brandId, programId, plannerId, rowId, programProductId, funnelStage, metadata = {}) {
  if (!user || user.tenantId === '__none__') return false;

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return false;

  const tenantId = user.tenantId;

  // Verify program and planner connection exists
  const connection = (await pgQuery(
    `SELECT * FROM affiliate_program_planners
     WHERE tenant_id = $1 AND affiliate_program_id = $2 AND content_planner_id = $3`,
    [tenantId, programId, plannerId]
  )).rows;

  if (connection.length === 0) throw new Error('Planner is not linked to this program');

  const linkId = `aprl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  await pgQuery(
    `INSERT INTO affiliate_planner_row_links (id, tenant_id, affiliate_program_id, content_planner_id, planner_row_id, program_product_id, funnel_stage, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (tenant_id, affiliate_program_id, content_planner_id, planner_row_id)
     DO UPDATE SET program_product_id = EXCLUDED.program_product_id, funnel_stage = EXCLUDED.funnel_stage, metadata = EXCLUDED.metadata`,
    [linkId, tenantId, programId, plannerId, rowId, programProductId || null, funnelStage || null, JSON.stringify(metadata)]
  );

  return true;
}

export async function getProgramCoverageSummary(user, brandId, programId) {
  if (!user || user.tenantId === '__none__') return null;

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return null;

  const tenantId = user.tenantId;

  // 1. Get targets from program
  const programRows = (await pgQuery(
    `SELECT id, funnel_mix, platforms, production_target FROM affiliate_programs
     WHERE id = $1 AND tenant_id = $2`,
    [programId, tenantId]
  )).rows;
  if (programRows.length === 0) return null;

  const program = programRows[0];
  const targetFunnel = program.funnel_mix || { tofu: 40, mofu: 40, bofu: 20 };
  const targetPlatforms = program.platforms || [];
  const targetVideos = program.production_target || 0;

  // 2. Count actuals from linked row configurations
  const rowLinks = (await pgQuery(
    `SELECT aprl.*, cp.platform FROM affiliate_planner_row_links aprl
     JOIN content_planners cp ON cp.tenant_id = aprl.tenant_id AND cp.id = aprl.content_planner_id
     WHERE aprl.tenant_id = $1 AND aprl.affiliate_program_id = $2`,
    [tenantId, programId]
  )).rows;

  const totalActual = rowLinks.length;
  let tofuCount = 0;
  let mofuCount = 0;
  let bofuCount = 0;

  const platformCounts = {};
  for (const plat of targetPlatforms) {
    platformCounts[plat] = 0;
  }

  // Count products coverage
  const linkedProductIds = new Set();

  for (const link of rowLinks) {
    if (link.funnel_stage === 'TOFU') tofuCount++;
    if (link.funnel_stage === 'MOFU') mofuCount++;
    if (link.funnel_stage === 'BOFU') bofuCount++;

    if (link.program_product_id) {
      linkedProductIds.add(link.program_product_id);
    }

    const plat = link.platform || 'tiktok';
    platformCounts[plat] = (platformCounts[plat] || 0) + 1;
  }

  // Get total program products
  const programProducts = (await pgQuery(
    `SELECT id FROM affiliate_program_products WHERE tenant_id = $1 AND affiliate_program_id = $2`,
    [tenantId, programId]
  )).rows;

  const totalProducts = programProducts.length;
  const linkedProductsCount = linkedProductIds.size;

  return {
    production: {
      target: targetVideos,
      actual: totalActual,
      progressPercent: targetVideos > 0 ? Math.min(100, Math.round((totalActual / targetVideos) * 100)) : 0
    },
    funnel: {
      target: targetFunnel,
      actual: {
        tofu: totalActual > 0 ? Math.round((tofuCount / totalActual) * 100) : 0,
        mofu: totalActual > 0 ? Math.round((mofuCount / totalActual) * 100) : 0,
        bofu: totalActual > 0 ? Math.round((bofuCount / totalActual) * 100) : 0
      },
      counts: {
        tofu: tofuCount,
        mofu: mofuCount,
        bofu: bofuCount
      }
    },
    products: {
      total: totalProducts,
      linked: linkedProductsCount,
      progressPercent: totalProducts > 0 ? Math.min(100, Math.round((linkedProductsCount / totalProducts) * 100)) : 0
    },
    platforms: {
      targets: targetPlatforms,
      actuals: platformCounts
    }
  };
}

export async function getProgramCalendarEvents(user, brandId, programId) {
  if (!user || user.tenantId === '__none__') return [];

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return [];

  const tenantId = user.tenantId;

  // Fetch all rows from linked planners with their row link overrides
  const rowLinks = (await pgQuery(
    `SELECT aprl.metadata AS link_metadata, aprl.funnel_stage, cpr.*, cp.title AS planner_title, cp.platform
     FROM affiliate_planner_row_links aprl
     JOIN content_planner_rows cpr ON cpr.id = aprl.planner_row_id
     JOIN content_planners cp ON cp.id = aprl.content_planner_id
     WHERE aprl.tenant_id = $1 AND aprl.affiliate_program_id = $2
     ORDER BY cpr.sequence ASC`,
    [tenantId, programId]
  )).rows;

  const events = [];
  const programRows = (await pgQuery(
    `SELECT start_date FROM affiliate_programs WHERE id = $1 AND tenant_id = $2`,
    [programId, tenantId]
  )).rows;

  const progStartDate = programRows[0]?.start_date ? new Date(programRows[0].start_date) : new Date();

  for (const r of rowLinks) {
    const meta = r.link_metadata || {};
    // Calculate scheduled date: either explicitly assigned or sequence-offset days from program start date
    let dateStr = meta.scheduled_date;
    if (!dateStr) {
      const offsetDays = (r.sequence - 1) * 2; // e.g. every 2 days
      const d = new Date(progStartDate);
      d.setDate(d.getDate() + offsetDays);
      dateStr = d.toISOString().split('T')[0];
    }

    events.push({
      id: r.id,
      title: `${r.planner_title} - Row ${r.sequence}`,
      date: dateStr,
      platform: r.platform || 'tiktok',
      funnelStage: r.funnel_stage || 'TOFU',
      category: r.category_cep,
      wsMatrix: r.ws_matrix,
      context: r.context,
      hook: r.hook,
      visualAction: r.visual_action,
      product: r.product
    });
  }

  return events;
}

async function logProgramEvent(tenantId, programId, eventType, actorId, payload) {
  const id = `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await pgQuery(
    `INSERT INTO affiliate_program_events (id, tenant_id, affiliate_program_id, event_type, actor_id, payload)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, tenantId, programId, eventType, actorId, JSON.stringify(payload)]
  );
}
