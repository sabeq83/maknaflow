import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { withTenantContext } from '@/lib/auth';
import { getExportRecordsByTenant } from '@/lib/recipe-export-records';
import { parseRecipeDescriptionHtml } from '@/lib/recipe-export-helper';

export const GET = withTenantContext(async (req) => {
  try {
    const { getActiveTenantId } = await import('@/lib/tenant-context');
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
        const videoUrl = item.video_url || item.rendered_video_url || '';
        const hasVideo = Boolean(videoUrl || item.video_storyboard_json);
        const videoMutedReady = Boolean(videoUrl && (videoUrl.includes('pub-r2') || videoUrl.includes('_muted.mp4')));

        return {
          id: item.id,
          sourceType: 'labs',
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
          hasVideo,
          videoMutedReady,
          videoR2Url: videoUrl,
          isExported,
          lastExportTarget: lastExport ? lastExport.target_app : null,
          lastExportedAt: lastExport ? lastExport.exported_at : null,
          exportCount: exports.length,
          created_at: item.created_at
        };
      });

      return NextResponse.json({ success: true, data: mapped, source: 'labs' });
    }

    // Source: Campaign (Content Planner with recipe_campaign focus)
    let rows = [];
    try {
      rows = await db.prepare(`
        SELECT cpr.*, cp.name AS planner_name, cp.category AS planner_category, cp.target_audience
        FROM content_planner_rows cpr
        JOIN content_planners cp ON cpr.planner_id = cp.id
        WHERE cp.planner_focus = 'recipe_campaign' 
          AND (cpr.tenant_id = ? OR cpr.tenant_id IS NULL OR cpr.tenant_id = 'default_tenant')
        ORDER BY cpr.created_at DESC, cpr.sequence ASC
      `).all(tenantId);
    } catch (e) {
      console.warn('[API /api/recipes] Failed to query content_planner_rows with JOIN:', e.message);
      try {
        rows = await db.prepare(`
          SELECT * FROM content_planner_rows 
          WHERE recipe_idea_json IS NOT NULL 
          ORDER BY created_at DESC
        `).all();
      } catch (_) {
        rows = [];
      }
    }

    const mapped = rows.map(row => {
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
      const rawText = row.full_recipe_text || idea.recipe_text || '';
      const parsed = parseRecipeDescriptionHtml(rawText);

      // Gunakan data dari parsed HTML atau fallback ke idea JSON
      const summaryText = parsed.summary || idea.summary || idea.hook || '';
      const baseIngredients = parsed.baseIngredients.length > 0
        ? parsed.baseIngredients
        : Array.isArray(idea.base_ingredients) ? idea.base_ingredients : [];
      const ingredientGroups = parsed.ingredientGroups.length > 0
        ? parsed.ingredientGroups
        : Array.isArray(idea.ingredient_groups) ? idea.ingredient_groups : [];
      const directions = parsed.directions.length > 0
        ? parsed.directions
        : Array.isArray(idea.directions) ? idea.directions : [];

      const hasSummary = Boolean(summaryText && summaryText.trim().length > 0);
      const videoUrl = row.video_url || row.final_video_url || row.rendered_video_url || '';
      const hasVideo = Boolean(videoUrl);
      const videoMutedReady = Boolean(videoUrl && (videoUrl.includes('pub-r2') || videoUrl.includes('_muted.mp4')));

      return {
        id: row.id,
        sourceType: 'campaign',
        source: `Recipe Campaign (${row.planner_name || 'Content Planner'} #${row.sequence || 1})`,
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
        hasVideo,
        videoMutedReady,
        videoR2Url: videoUrl,
        isExported,
        lastExportTarget: lastExport ? lastExport.target_app : null,
        lastExportedAt: lastExport ? lastExport.exported_at : null,
        exportCount: exports.length,
        created_at: row.created_at
      };
    });

    return NextResponse.json({ success: true, data: mapped, source: 'campaign' });
  } catch (err) {
    console.error('[API /api/recipes GET Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});
