import { NextResponse } from 'next/server.js';
import { getDb } from '../../../lib/db.js';
import { withTenantContext } from '../../../lib/auth.js';
import { getExportRecordsByTenant } from '../../../lib/recipe-export-records.js';
import { parseRecipeDescriptionHtml } from '../../../lib/recipe-export-helper.js';

export const GET = withTenantContext(async (req) => {
  try {
    const { getActiveTenantId } = await import('../../../lib/tenant-context.js');
    const tenantId = getActiveTenantId() || 'default_tenant';
    const { searchParams } = new URL(req.url);
    const source = searchParams.get('source') || 'labs';

    const db = getDb();

    // Ambil histori record ekspor untuk tenant ini
    let exportRecords = [];
    try {
      exportRecords = await getExportRecordsByTenant(tenantId);
    } catch (_) {}

    const exportMap = new Map();
    for (const rec of exportRecords) {
      if (!exportMap.has(rec.source_item_id)) {
        exportMap.set(rec.source_item_id, []);
      }
      exportMap.get(rec.source_item_id).push(rec);
    }

    if (source === 'labs') {
      let rows = [];
      try {
        rows = await db.prepare(`
          SELECT ri.*, rc.category, rc.custom_category, rc.campaign_name, rc.visual_style
          FROM recipe_items ri
          JOIN recipe_campaigns rc ON ri.campaign_id = rc.id
          WHERE ri.tenant_id = ? OR ri.tenant_id IS NULL OR ri.tenant_id = 'default_tenant'
          ORDER BY ri.created_at DESC
        `).all(tenantId);
      } catch (e) {
        console.warn('[API /api/recipes] Failed to query recipe_items with JOIN:', e.message);
        // Fallback jika JOIN gagal
        try {
          rows = await db.prepare(`SELECT * FROM recipe_items ORDER BY created_at DESC`).all();
        } catch (_) {
          rows = [];
        }
      }

      const mapped = rows.map(item => {
        const exports = exportMap.get(item.id) || [];
        const isExported = exports.length > 0;
        const lastExport = isExported ? exports[0] : null;

        const rawText = item.recipe_markdown_text || '';
        const parsed = parseRecipeDescriptionHtml(rawText);

        const hasSummary = Boolean(parsed.summary && parsed.summary.trim().length > 0);
        const rawVideo = item.video_url || item.rendered_video_url || '';
        const isR2Url = Boolean(rawVideo && (rawVideo.includes('.r2.cloudflarestorage.com') || rawVideo.includes('video.ast402.my.id') || rawVideo.includes('pub-r2')));
        const videoMutedReady = Boolean(isR2Url || (rawVideo && rawVideo.includes('_muted.mp4')));

        return {
          id: item.id,
          sourceType: 'labs',
          origin_type: 'labs',
          origin_label: 'Recipe Labs',
          campaign_id: item.campaign_id ? String(item.campaign_id) : `labs_${item.id}`,
          campaign_name: item.campaign_name || item.category || 'Recipe Labs Studio',
          source: `Recipe Labs (${item.campaign_name || item.category || 'Studio'})`,
          title: item.recipe_title || 'Resep Kuliner Tanpa Judul',
          time: '30 mins',
          category: item.custom_category || item.category || 'Healthy Food',
          image: item.img_grid_path || item.img_4_plated_path || item.img_3_result_path || item.img_1_raw_path || '',
          summary: parsed.summary || '',
          baseIng: parsed.baseIngredients.join('\n'),
          groups: parsed.ingredientGroups || [],
          directions: parsed.directions.join('\n'),
          rawMarkdown: rawText,
          hasSummary,
          hasVideo: Boolean(rawVideo || item.video_storyboard_json),
          hasLocalVideo: Boolean(rawVideo && !rawVideo.startsWith('http')),
          videoMutedReady,
          sourceVideoPath: rawVideo,
          video_url: rawVideo,
          media_url: rawVideo,
          videoR2Url: isR2Url ? rawVideo : '',
          isExported,
          lastExportTarget: lastExport ? lastExport.target_app : null,
          lastExportedAt: lastExport ? lastExport.exported_at : null,
          exportCount: exports.length,
          created_at: item.created_at
        };
      });

      return NextResponse.json({ success: true, data: mapped, source: 'labs' });
    }

    // Source: Campaign (Pillar Campaign Items & Content Planner Rows)
    // 1. Ambil dari pillar_campaign_items dengan filter tenant_id ketat
    let pillarRows = [];
    try {
      pillarRows = await db.prepare(`
        SELECT 
          pci.id,
          pci.campaign_id,
          pci.content_kind,
          pci.row_creative_payload,
          pci.result_json,
          pci.t2i_start_frame_path,
          pci.ffmpeg_output_path,
          pci.drive_link,
          pci.created_at,
          pc.campaign_name,
          pc.content_pillar
        FROM pillar_campaign_items pci
        LEFT JOIN pillar_campaigns pc ON pci.campaign_id = pc.id
        WHERE (pc.tenant_id = ? OR pc.tenant_id = 'default_tenant' OR pc.tenant_id IS NULL)
          AND (pci.content_kind = 'recipe_campaign' 
               OR pci.result_json LIKE '%"recipe":%' 
               OR pci.row_creative_payload LIKE '%recipe_idea%')
        ORDER BY pci.id DESC
        LIMIT 100
      `).all(tenantId);
    } catch (e) {
      console.warn('[API /api/recipes] Failed to query pillar_campaign_items:', e.message);
      pillarRows = [];
    }

    const mappedPillar = (pillarRows || []).map(item => {
      let result = {};
      let payload = {};
      try {
        if (item.result_json) {
          result = typeof item.result_json === 'string' ? JSON.parse(item.result_json) : item.result_json;
        }
      } catch (_) {}
      try {
        if (item.row_creative_payload) {
          payload = typeof item.row_creative_payload === 'string' ? JSON.parse(item.row_creative_payload) : item.row_creative_payload;
        }
      } catch (_) {}

      const recipeObj = result.recipe || {};
      const idea = payload.recipe_idea || {};

      const exports = exportMap.get(item.id) || exportMap.get(`pci_${item.id}`) || [];
      const isExported = exports.length > 0;
      const lastExport = isExported ? exports[0] : null;

      // Ambil judul dari yt_title -> recipe.title -> recipe_idea.title -> payload.title
      const title = result.yt_title || recipeObj.title || idea.recipe_title || idea.title || payload.title || 'Resep Kampanye Pilar';

      const rawMarkdown = result.recipe_text_markdown || result.yt_desc || result.caption || '';
      const parsed = parseRecipeDescriptionHtml(rawMarkdown);

      // Ekstraksi Bahan Terstruktur
      let baseIngredients = parsed.baseIngredients.length > 0 ? parsed.baseIngredients : [];
      if (baseIngredients.length === 0 && Array.isArray(recipeObj.ingredients)) {
        baseIngredients = recipeObj.ingredients.map(ing => {
          if (typeof ing === 'string') return ing;
          const amt = ing.amount ? `${ing.amount} ` : '';
          const u = ing.unit ? `${ing.unit} ` : '';
          return `${amt}${u}${ing.name}`.trim();
        });
      }
      if (baseIngredients.length === 0 && Array.isArray(idea.ingredients)) {
        baseIngredients = idea.ingredients.map(ing => {
          if (typeof ing === 'string') return ing;
          const amt = ing.amount ? `${ing.amount} ` : '';
          const u = ing.unit ? `${ing.unit} ` : '';
          return `${amt}${u}${ing.name}`.trim();
        });
      }

      // Ekstraksi Langkah Terstruktur
      let directions = parsed.directions.length > 0 ? parsed.directions : [];
      if (directions.length === 0 && Array.isArray(recipeObj.steps)) {
        directions = recipeObj.steps.map(s => (typeof s === 'string' ? s : s.instruction)).filter(Boolean);
      }
      if (directions.length === 0 && Array.isArray(idea.steps)) {
        directions = idea.steps.map(s => (typeof s === 'string' ? s : s.instruction)).filter(Boolean);
      }

      const summaryText = parsed.summary || payload.hook || idea.hook || (result.recipe ? result.recipe.summary : '') || '';
      const hasSummary = Boolean(summaryText && summaryText.trim().length > 0);

      const rawVideo = item.ffmpeg_output_path || item.drive_link || '';
      const isR2Url = Boolean(rawVideo && (rawVideo.includes('.r2.cloudflarestorage.com') || rawVideo.includes('video.ast402.my.id') || rawVideo.includes('pub-r2')));
      const videoMutedReady = Boolean(isR2Url || (rawVideo && rawVideo.includes('_muted.mp4')));

      return {
        id: item.id,
        sourceType: 'campaign',
        origin_type: 'pillar',
        origin_label: 'Pillar Campaign (OPC)',
        campaign_id: item.campaign_id || '',
        campaign_name: item.campaign_name || item.content_pillar || 'Pillar Campaign',
        source: `Pillar Campaign (${item.campaign_name || item.content_pillar || 'Pillar'} #${item.id})`,
        title,
        time: recipeObj.cook_minutes ? `${recipeObj.cook_minutes} mins` : (idea.cook_minutes ? `${idea.cook_minutes} mins` : '20 mins'),
        category: payload.category || idea.category || 'Healthy Food',
        image: item.t2i_start_frame_path || '',
        summary: summaryText,
        baseIng: baseIngredients.join('\n'),
        groups: parsed.ingredientGroups || [],
        directions: directions.join('\n'),
        rawMarkdown,
        hasSummary,
        hasVideo: Boolean(rawVideo),
        hasLocalVideo: Boolean(rawVideo && !rawVideo.startsWith('http')),
        videoMutedReady,
        sourceVideoPath: rawVideo,
        video_url: rawVideo,
        media_url: rawVideo,
        videoR2Url: isR2Url ? rawVideo : '',
        isExported,
        lastExportTarget: lastExport ? lastExport.target_app : null,
        lastExportedAt: lastExport ? lastExport.exported_at : null,
        exportCount: exports.length,
        created_at: item.created_at
      };
    });

    // 2. Ambil dari content_planner_rows (Perencanaan awal)
    let plannerRows = [];
    try {
      plannerRows = await db.prepare(`
        SELECT cpr.*, cp.title AS planner_name, cp.target_audience
        FROM content_planner_rows cpr
        JOIN content_planners cp ON cpr.planner_id = cp.id
        WHERE cp.planner_focus = 'recipe_campaign' 
          AND (cpr.tenant_id = ? OR cpr.tenant_id IS NULL OR cpr.tenant_id = 'default_tenant')
        ORDER BY cpr.created_at DESC, cpr.sequence ASC
      `).all(tenantId);
    } catch (e) {
      console.warn('[API /api/recipes] Failed to query content_planner_rows with JOIN:', e.message);
      try {
        plannerRows = await db.prepare(`
          SELECT * FROM content_planner_rows 
          WHERE recipe_idea_json IS NOT NULL 
          ORDER BY created_at DESC
        `).all();
      } catch (_) {
        plannerRows = [];
      }
    }

    const mappedPlanner = (plannerRows || []).map(row => {
      let idea = {};
      try {
        if (row.recipe_idea_json) {
          idea = typeof row.recipe_idea_json === 'string' ? JSON.parse(row.recipe_idea_json) : row.recipe_idea_json;
        }
      } catch (_) {}

      const exports = exportMap.get(row.id) || [];
      const isExported = exports.length > 0;
      const lastExport = isExported ? exports[0] : null;

      const title = idea.recipe_title || idea.title || row.title || 'Resep Kampanye Kuliner';
      const rawText = row.body || row.full_recipe_text || idea.recipe_text || '';
      const parsed = parseRecipeDescriptionHtml(rawText);

      // Gunakan data dari parsed HTML atau fallback ke idea JSON
      const summaryText = parsed.summary || idea.summary || idea.hook || '';
      let baseIngredients = parsed.baseIngredients.length > 0
        ? parsed.baseIngredients
        : Array.isArray(idea.base_ingredients) ? idea.base_ingredients : [];
      if (baseIngredients.length === 0 && Array.isArray(idea.ingredients)) {
        baseIngredients = idea.ingredients.map(ing => {
          if (typeof ing === 'string') return ing;
          const amt = ing.amount ? `${ing.amount} ` : '';
          const u = ing.unit ? `${ing.unit} ` : '';
          return `${amt}${u}${ing.name}`.trim();
        });
      }

      let ingredientGroups = parsed.ingredientGroups.length > 0
        ? parsed.ingredientGroups
        : Array.isArray(idea.ingredient_groups) ? idea.ingredient_groups : [];

      let directions = parsed.directions.length > 0
        ? parsed.directions
        : Array.isArray(idea.directions) ? idea.directions : [];
      if (directions.length === 0 && Array.isArray(idea.steps)) {
        directions = idea.steps.map(s => (typeof s === 'string' ? s : s.instruction)).filter(Boolean);
      }

      const hasSummary = Boolean(summaryText && summaryText.trim().length > 0);
      const rawVideo = row.video_url || row.final_video_url || row.rendered_video_url || '';
      const isR2Url = Boolean(rawVideo && (rawVideo.includes('.r2.cloudflarestorage.com') || rawVideo.includes('video.ast402.my.id') || rawVideo.includes('pub-r2')));
      const videoMutedReady = Boolean(isR2Url || (rawVideo && rawVideo.includes('_muted.mp4')));

      return {
        id: row.id,
        sourceType: 'campaign',
        origin_type: 'planner',
        origin_label: 'Content Planner',
        campaign_id: row.planner_id ? String(row.planner_id) : `pln_${row.id}`,
        campaign_name: row.planner_name || 'Content Planner Kuliner',
        source: `Content Planner (${row.planner_name || 'Planner'} #${row.sequence || 1})`,
        title,
        time: idea.cook_minutes ? `${idea.cook_minutes} mins` : '25 mins',
        category: idea.category || row.planner_category || 'Healthy Food',
        image: row.preview_image || row.thumbnail_url || row.media_url || '',
        summary: summaryText,
        baseIng: baseIngredients.join('\n'),
        groups: ingredientGroups,
        directions: directions.join('\n'),
        rawMarkdown: rawText,
        hasSummary,
        hasVideo: Boolean(rawVideo),
        hasLocalVideo: Boolean(rawVideo && !rawVideo.startsWith('http')),
        videoMutedReady,
        sourceVideoPath: rawVideo,
        video_url: rawVideo,
        media_url: rawVideo,
        videoR2Url: isR2Url ? rawVideo : '',
        isExported,
        lastExportTarget: lastExport ? lastExport.target_app : null,
        lastExportedAt: lastExport ? lastExport.exported_at : null,
        exportCount: exports.length,
        created_at: row.created_at
      };
    });

    // 3. Ambil dari re_multiplier_tasks (Multiplier Lab yang menghasilkan resep)
    let multiplierRows = [];
    try {
      multiplierRows = await db.prepare(`
        SELECT 
          id, batch_id, campaign_name, yt_title, new_caption,
          remake_storyboard_json, ffmpeg_output_path, t2i_images_json, created_at
        FROM re_multiplier_tasks
        WHERE (tenant_id = ? OR tenant_id = 'default_tenant') 
          AND generate_recipe = 1
        ORDER BY created_at DESC
        LIMIT 100
      `).all(tenantId);
    } catch (e) {
      console.warn('[API /api/recipes] Failed to query re_multiplier_tasks with specific columns:', e.message);
      try {
        multiplierRows = await db.prepare(`
          SELECT * FROM re_multiplier_tasks
          WHERE (tenant_id = ? OR tenant_id = 'default_tenant')
          ORDER BY created_at DESC
          LIMIT 100
        `).all(tenantId);
      } catch (_) {
        multiplierRows = [];
      }
    }

    const mappedMultiplier = (multiplierRows || []).map(row => {
      const exports = exportMap.get(row.id) || exportMap.get(`mult_${row.id}`) || [];
      const isExported = exports.length > 0;
      const lastExport = isExported ? exports[0] : null;

      const rawCaption = row.new_caption || '';
      const parsed = parseRecipeDescriptionHtml(rawCaption);

      let images = [];
      try {
        if (row.t2i_images_json) {
          images = typeof row.t2i_images_json === 'string' ? JSON.parse(row.t2i_images_json) : row.t2i_images_json;
        }
      } catch (_) {}
      const firstImage = Array.isArray(images) && images.length > 0 ? images[0] : '';

      const rawVideo = row.ffmpeg_output_path || '';
      const isR2Url = Boolean(rawVideo && (rawVideo.includes('.r2.cloudflarestorage.com') || rawVideo.includes('video.ast402.my.id') || rawVideo.includes('pub-r2')));
      const videoMutedReady = Boolean(isR2Url || (rawVideo && rawVideo.includes('_muted.mp4')));

      const title = row.yt_title || (row.campaign_name ? row.campaign_name.replace(/^\[.*?\]\s*-\s*/, '') : 'Resep Multiplier Lab');
      const hasSummary = Boolean(parsed.summary && parsed.summary.trim().length > 0);

      return {
        id: row.id,
        sourceType: 'campaign',
        origin_type: 'multiplier',
        origin_label: 'Multiplier Lab',
        campaign_id: row.batch_id || (row.campaign_name ? row.campaign_name.replace(/^\[.*?\]\s*-\s*/, '') : `mul_${row.id}`),
        campaign_name: row.campaign_name || row.batch_id || 'Multiplier Batch',
        source: `Multiplier Lab (${row.campaign_name || row.batch_id || 'Batch'} #${row.id})`,
        title,
        time: '15 mins prep | 20 mins cook',
        category: 'Healthy Food',
        image: firstImage,
        summary: parsed.summary || '',
        baseIng: (parsed.baseIngredients || []).join('\n'),
        groups: parsed.ingredientGroups || [],
        directions: (parsed.directions || []).join('\n'),
        rawMarkdown: rawCaption,
        hasSummary,
        hasVideo: Boolean(rawVideo),
        hasLocalVideo: Boolean(rawVideo && !rawVideo.startsWith('http')),
        videoMutedReady,
        sourceVideoPath: rawVideo,
        video_url: rawVideo,
        media_url: rawVideo,
        videoR2Url: isR2Url ? rawVideo : '',
        isExported,
        lastExportTarget: lastExport ? lastExport.target_app : null,
        lastExportedAt: lastExport ? lastExport.exported_at : null,
        exportCount: exports.length,
        created_at: row.created_at
      };
    });

    // Gabungkan: letakkan item Multiplier Lab & Pilar yang telah diproduksi di baris awal
    const combinedCampaign = [...mappedMultiplier, ...mappedPillar, ...mappedPlanner];

    return NextResponse.json({ success: true, data: combinedCampaign, source: 'campaign' });
  } catch (err) {
    console.error('[API /api/recipes GET Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});
