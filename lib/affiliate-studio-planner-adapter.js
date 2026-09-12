import { pgQuery } from './db-pg.js';
import { getAuthorizedAffiliateBrand } from './affiliate-studio-brand-read-adapter.js';
import { recordLineage, updateLineageStage, upsertSceneProjections, getLineageByPlannerRowId } from './affiliate-studio-lineage-repository.js';
import crypto from 'crypto';

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
       AND (cp.is_archived = FALSE OR cp.is_archived IS NULL)
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

export async function listBrandPlanners(user, brandId) {
  if (!user || user.tenantId === '__none__') return [];

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return [];

  const tenantId = user.tenantId;

  const rows = (await pgQuery(
    `SELECT cp.id, cp.title, cp.status, cp.created_at, cp.pillars_json
     FROM content_planners cp
     WHERE cp.tenant_id = $1
       AND (cp.brand_id = $2 OR LOWER(cp.account_name) = LOWER($3))
       AND (cp.is_archived = FALSE OR cp.is_archived IS NULL)
     ORDER BY cp.created_at DESC`,
    [tenantId, brand.id, brand.name]
  )).rows;

  const result = [];
  for (const row of rows) {
    const totalResult = (await pgQuery(
      `SELECT COUNT(*)::int AS count FROM content_planner_rows WHERE planner_id = $1`,
      [row.id]
    )).rows[0];

    result.push({
      id: row.id,
      title: row.title,
      status: row.status,
      createdAt: row.created_at,
      totalRows: totalResult?.count || 0,
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
       AND (cp.is_archived = FALSE OR cp.is_archived IS NULL)
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
    `SELECT * FROM content_planner_rows WHERE planner_id = $1 ORDER BY sequence ASC, created_at ASC`,
    [plannerId]
  )).rows;

  // 2. Fetch row links if programId is provided
  let linksMap = new Map();
  if (programId) {
    const links = (await pgQuery(
      `SELECT * FROM affiliate_planner_row_links
       WHERE tenant_id = $1 AND affiliate_program_id = $2 AND content_planner_id = $3`,
      [tenantId, programId, plannerId]
    )).rows;
    linksMap = new Map(links.map(l => [l.planner_row_id, l]));
  }

  return rows.map((r, idx) => {
    const link = linksMap.get(r.id);
    const meta = typeof r.metadata_json === 'string' ? (() => { try { return JSON.parse(r.metadata_json); } catch (_) { return {}; } })() : (r.metadata_json || {});

    return {
      id: r.id,
      sequence: r.sequence || (idx + 1),
      pillar: r.pillar || meta.pillar_name,
      categoryCep: r.category_cep || r.angle || meta.cep_code || 'Problem-Solution',
      wsMatrix: r.ws_matrix,
      context: r.context || meta.promotion_context,
      hook: r.hook,
      visualAction: r.visual_action || r.body,
      body: r.body,
      cta: r.cta,
      status: r.status || meta.approval_status || 'draft',
      videoId: r.video_id,
      product: r.product || meta.product_name,
      productId: r.product_id || meta.product_id,
      target_platforms: meta.target_platforms || ['instagram', 'tiktok'],
      linkId: link?.id || null,
      programProductId: link?.program_product_id || null,
      funnelStage: link?.funnel_stage || null,
      metadata: { ...meta, ...(link?.metadata || {}) }
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
       AND (cp.is_archived = FALSE OR cp.is_archived IS NULL)
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

export async function getBrandCalendarEvents(user, brandId) {
  if (!user || user.tenantId === '__none__') return [];

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return [];

  const tenantId = user.tenantId;

  const rowLinks = (await pgQuery(
    `SELECT aprl.metadata AS link_metadata, aprl.funnel_stage, cpr.*, cp.title AS planner_title, cp.platform, ap.name as program_title
     FROM affiliate_planner_row_links aprl
     JOIN content_planner_rows cpr ON cpr.id = aprl.planner_row_id
     JOIN content_planners cp ON cp.id = aprl.content_planner_id
     JOIN affiliate_programs ap ON ap.id = aprl.affiliate_program_id
     WHERE aprl.tenant_id = $1 AND ap.brand_profile_id = $2
       AND (cp.is_archived = FALSE OR cp.is_archived IS NULL)
     ORDER BY cpr.sequence ASC`,
    [tenantId, brand.id]
  )).rows;

  const events = [];
  for (const r of rowLinks) {
    const meta = r.link_metadata || {};
    let dateStr = meta.scheduled_date || new Date().toISOString().split('T')[0];

    events.push({
      id: r.id,
      title: `[${r.program_title}] ${r.planner_title} - Row ${r.sequence}`,
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

export async function approvePlannerRows({ user, brandId, plannerId, rowIds = [], allApproved = false }) {
  if (!user || user.tenantId === '__none__') return { success: false, error: 'Unauthorized' };

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return { success: false, error: 'Brand not found' };

  const tenantId = user.tenantId;

  let query;
  let params;

  if (allApproved) {
    query = `
      UPDATE content_planner_rows
      SET
        status = 'approved',
        metadata_json = jsonb_set(COALESCE(metadata_json, '{}'::jsonb), '{approval_status}', '"approved"'),
        updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = $1 AND planner_id = $2
      RETURNING id;
    `;
    params = [tenantId, plannerId];
  } else {
    if (!Array.isArray(rowIds) || rowIds.length === 0) {
      return { success: false, error: 'rowIds required' };
    }
    const placeholders = rowIds.map((_, i) => `$${i + 3}`).join(', ');
    query = `
      UPDATE content_planner_rows
      SET
        status = 'approved',
        metadata_json = jsonb_set(COALESCE(metadata_json, '{}'::jsonb), '{approval_status}', '"approved"'),
        updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = $1 AND planner_id = $2 AND id IN (${placeholders})
      RETURNING id;
    `;
    params = [tenantId, plannerId, ...rowIds];
  }

  const updated = (await pgQuery(query, params)).rows;

  // Advance lineage to approved
  for (const r of updated) {
    const lineage = await getLineageByPlannerRowId(tenantId, brand.id, r.id);
    if (lineage) {
      await updateLineageStage(tenantId, brand.id, lineage.id, 'approved', { approved_at: new Date().toISOString() });
    }
  }

  return { success: true, updatedCount: updated.length, updatedRowIds: updated.map(u => u.id) };
}

export async function ingestApprovedPlannerRowsToProduction({ user, brandId, plannerId, programId = null }) {
  if (!user || user.tenantId === '__none__') return { success: false, error: 'Unauthorized' };

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return { success: false, error: 'Brand not found' };

  const tenantId = user.tenantId;

  // 1. Fetch approved rows for this planner
  const rows = (await pgQuery(
    `SELECT * FROM content_planner_rows
     WHERE tenant_id = $1 AND planner_id = $2 AND (status = 'approved' OR metadata_json->>'approval_status' = 'approved')
     ORDER BY sequence ASC`,
    [tenantId, plannerId]
  )).rows;

  if (rows.length === 0) {
    return { success: false, error: 'No approved rows found to ingest' };
  }

  // Fallback programId if not provided
  let effectiveProgramId = programId;
  if (!effectiveProgramId) {
    const linkedProg = (await pgQuery(
      `SELECT affiliate_program_id FROM affiliate_program_planners
       WHERE tenant_id = $1 AND content_planner_id = $2 LIMIT 1`,
      [tenantId, plannerId]
    )).rows[0];
    effectiveProgramId = linkedProg?.affiliate_program_id || `prog_default_${brand.id}`;
  }

  const createdRuns = [];

  for (const row of rows) {
    const runId = `run_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const meta = row.metadata_json || {};

    // 1. Create content run
    await pgQuery(
      `INSERT INTO affiliate_content_runs (
        id, tenant_id, brand_profile_id, affiliate_program_id, content_planner_id,
        planner_row_id, engine_type, engine_campaign_id, engine_item_id,
        normalized_status, brand_snapshot_json, product_snapshot_json, offer_snapshot_json,
        metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pillar', $7, $8, 'Generating', $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        runId,
        tenantId,
        brand.id,
        effectiveProgramId,
        plannerId,
        row.id,
        `cmp_${plannerId}`,
        row.id,
        JSON.stringify({ id: brand.id, name: brand.name }),
        JSON.stringify({ name: meta.product_name || row.product || 'Product Item', cep_code: meta.cep_code || row.angle || row.category_cep }),
        JSON.stringify({ promotion_context: meta.promotion_context || null }),
        JSON.stringify({
          source_planner_row_id: row.id,
          target_platforms: meta.target_platforms || ['instagram', 'tiktok'],
          hook: row.hook,
          body: row.body
        })
      ]
    );

    // 2. Project initial 5 scenes for Pillar scene inspector
    const scenes = [
      {
        scene_index: 1,
        duration_sec: 3.5,
        storyboard_text: row.hook || 'Opening Hook: Visual perhatian utama',
        visual_prompt: `High quality commercial product cinematic shot of ${meta.product_name || 'brand product'}, dramatic lighting, 8k`,
        voiceover_script: row.hook || 'Tahukah Anda rahasia di balik produk ini?',
        t2i_engine: 'sdxl',
        t2i_prompt: `cinematic product shot, modern studio, elegant presentation`,
        i2v_engine: 'kling',
        i2v_motion_prompt: 'slow camera zoom in with natural lighting',
        scene_status: 'rendered'
      },
      {
        scene_index: 2,
        duration_sec: 3.5,
        storyboard_text: 'Problem Introduction & Angle Exploration',
        visual_prompt: `Everyday struggle representation, natural indoor lighting, relatable context`,
        voiceover_script: row.body || 'Seringkali kita menghadapi kendala yang berulang dalam rutinitas harian...',
        t2i_engine: 'sdxl',
        t2i_prompt: `person solving daily routine, warm lighting, high detail`,
        i2v_engine: 'kling',
        i2v_motion_prompt: 'smooth pan right',
        scene_status: 'rendered'
      },
      {
        scene_index: 3,
        duration_sec: 3.5,
        storyboard_text: 'Product Solution & Key Formula Feature',
        visual_prompt: `Detailed texture shot, liquid dropper or packaging close-up, premium finish`,
        voiceover_script: `Dengan formula inovatif, memberikan hasil nyata tanpa kompromi.`,
        t2i_engine: 'sdxl',
        t2i_prompt: `macro shot of product ingredients, glowing particles, ultra detailed`,
        i2v_engine: 'kling',
        i2v_motion_prompt: 'macro focus shift',
        scene_status: 'generating'
      },
      {
        scene_index: 4,
        duration_sec: 3.5,
        storyboard_text: 'Transformation & Social Proof',
        visual_prompt: `Before after or glowing satisfied user expression, soft bright lighting`,
        voiceover_script: `Banyak pengguna yang merasakan perbedaannya hanya dalam hitungan hari.`,
        t2i_engine: 'sdxl',
        t2i_prompt: `confident happy person holding product, clean aesthetic`,
        i2v_engine: 'kling',
        i2v_motion_prompt: 'subtle head turn and smile',
        scene_status: 'pending'
      },
      {
        scene_index: 5,
        duration_sec: 3.0,
        storyboard_text: 'Call To Action & Promotion Offer',
        visual_prompt: `Product packshot with special promo badge overlay, high contrast end frame`,
        voiceover_script: row.cta || `Dapatkan diskon khusus hari ini melalui link di bio!`,
        t2i_engine: 'sdxl',
        t2i_prompt: `final product packshot on sleek pedestal, studio lighting`,
        i2v_engine: 'kling',
        i2v_motion_prompt: 'static crisp hold',
        scene_status: 'pending'
      }
    ];

    await upsertSceneProjections(tenantId, brand.id, runId, scenes);

    // 3. Update lineage to production
    const lineage = await getLineageByPlannerRowId(tenantId, brand.id, row.id);
    if (lineage) {
      await updateLineageStage(tenantId, brand.id, lineage.id, 'production', {
        affiliate_content_run_id: runId,
        ingested_at: new Date().toISOString()
      });
    } else {
      await recordLineage({
        tenantId,
        brandProfileId: brand.id,
        affiliateProgramId: effectiveProgramId,
        contentPlannerId: plannerId,
        plannerRowId: row.id,
        affiliateContentRunId: runId,
        lifecycleStage: 'production',
        metadata: {
          ingested_from: 'planner_direct'
        }
      });
    }

    createdRuns.push({
      runId,
      plannerRowId: row.id,
      productName: meta.product_name || row.product,
      scenesCount: scenes.length
    });
  }

  return {
    success: true,
    runsCreated: createdRuns.length,
    runs: createdRuns
  };
}
