import { NextResponse } from 'next/server.js';
import { withTenantContext } from '../../../../lib/auth.js';
import { getDb } from '../../../../lib/db.js';
import { buildRecipeDescriptionHtml } from '../../../../lib/recipe-export-helper.js';

export const POST = withTenantContext(async (req) => {
  try {
    const body = await req.json();
    const {
      recipeId,
      sourceType,
      originType,
      title,
      time,
      category,
      summary,
      baseIngredients,
      ingredientGroups = [],
      directions,
      t2iPrompt43,
      coverImageUrl,
      videoR2Url
    } = body;

    if (!recipeId) {
      return NextResponse.json({ success: false, error: 'recipeId wajib diisi.' }, { status: 400 });
    }

    const db = getDb();
    const fullHtml = buildRecipeDescriptionHtml({
      summary: summary || '',
      baseIngredients: typeof baseIngredients === 'string' ? baseIngredients.split('\n') : (baseIngredients || []),
      ingredientGroups: Array.isArray(ingredientGroups) ? ingredientGroups : [],
      directions: typeof directions === 'string' ? directions.split('\n') : (directions || [])
    });

    let updated = false;

    // 1. Resep dari Labs Studio (tabel recipe_items)
    if (sourceType === 'labs') {
      try {
        const res = await db.prepare(`
          UPDATE recipe_items
          SET recipe_title = ?, recipe_markdown_text = ?,
              img_grid_path = COALESCE(?, img_grid_path)
          WHERE id = ?
        `).run(title || 'Resep Kuliner', fullHtml, coverImageUrl || null, recipeId);
        updated = res?.changes > 0 || true;
      } catch (e) {
        console.warn('[Save Recipe Labs Warning]:', e.message);
      }
    } 
    // 2. Resep dari Pillar Campaign (tabel pillar_campaign_items)
    else if (originType === 'pillar' || sourceType === 'campaign') {
      const item = await db.prepare('SELECT result_json FROM pillar_campaign_items WHERE id = ?').get(recipeId);
      if (item) {
        let parsed = {};
        try { parsed = JSON.parse(item.result_json || '{}'); } catch (_) {}
        parsed.recipe = {
          title: title || parsed.recipe?.title || 'Resep Kuliner',
          cook_minutes: time ? (parseInt(time) || 20) : (parsed.recipe?.cook_minutes || 20),
          summary: summary || parsed.recipe?.summary || '',
          ingredients: typeof baseIngredients === 'string' 
            ? baseIngredients.split('\n').filter(Boolean) 
            : (baseIngredients || parsed.recipe?.ingredients || []),
          ingredient_groups: ingredientGroups,
          steps: typeof directions === 'string' 
            ? directions.split('\n').filter(Boolean) 
            : (directions || parsed.recipe?.steps || []),
          t2i_prompt_4_3: t2iPrompt43 || parsed.recipe?.t2i_prompt_4_3 || ''
        };
        const res = await db.prepare(`
          UPDATE pillar_campaign_items
          SET result_json = ?,
              ffmpeg_output_path = COALESCE(?, ffmpeg_output_path),
              t2i_start_frame_path = COALESCE(?, t2i_start_frame_path)
          WHERE id = ?
        `).run(JSON.stringify(parsed), videoR2Url || null, coverImageUrl || null, recipeId);
        updated = res.changes > 0;
      }
    }
    // 3. Fallback generic check jika originType tidak spesifik
    if (!updated) {
      // Coba periksa di recipe_items
      const labItem = await db.prepare('SELECT id FROM recipe_items WHERE id = ?').get(recipeId);
      if (labItem) {
        await db.prepare(`
          UPDATE recipe_items
          SET recipe_title = ?, recipe_markdown_text = ?,
              video_url = COALESCE(?, video_url),
              img_grid_path = COALESCE(?, img_grid_path)
          WHERE id = ?
        `).run(title || 'Resep Kuliner', fullHtml, videoR2Url || null, coverImageUrl || null, recipeId);
        updated = true;
      } else {
        // Coba periksa di pillar_campaign_items
        const pillarItem = await db.prepare('SELECT id, result_json FROM pillar_campaign_items WHERE id = ?').get(recipeId);
        if (pillarItem) {
          let parsed = {};
          try { parsed = JSON.parse(pillarItem.result_json || '{}'); } catch (_) {}
          parsed.recipe = {
            ...(parsed.recipe || {}),
            title: title || parsed.recipe?.title,
            summary: summary || parsed.recipe?.summary,
            t2i_prompt_4_3: t2iPrompt43 || parsed.recipe?.t2i_prompt_4_3
          };
          await db.prepare(`
            UPDATE pillar_campaign_items
            SET result_json = ?,
                ffmpeg_output_path = COALESCE(?, ffmpeg_output_path),
                t2i_start_frame_path = COALESCE(?, t2i_start_frame_path)
            WHERE id = ?
          `).run(JSON.stringify(parsed), videoR2Url || null, coverImageUrl || null, recipeId);
          updated = true;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Data resep berhasil disimpan ke database.',
      updated
    });
  } catch (err) {
    console.error('[API /api/recipes/save Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});
