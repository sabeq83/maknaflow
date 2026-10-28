import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (req) => {
  try {
    const body = await req.json();
    const {
      endpointUrl,
      syncToken,
      recipeTitle,
      recipeTime,
      categoryName,
      recipeDescriptionHtml,
      videoUrl,
      imageUrl,
      action = 'push_recipe'
    } = body;

    if (!endpointUrl || !endpointUrl.trim()) {
      return NextResponse.json({ success: false, error: 'Endpoint URL webadmin wajib diisi.' }, { status: 400 });
    }

    // Action Ping API
    if (action === 'ping') {
      const formData = new FormData();
      formData.append('action', 'ping');
      if (syncToken) formData.append('sync_token', syncToken);

      const pingRes = await fetch(endpointUrl, {
        method: 'POST',
        headers: syncToken ? { 'X-Sync-Token': syncToken } : {},
        body: formData
      });

      const pingData = await pingRes.json().catch(() => ({}));
      return NextResponse.json({
        success: pingRes.ok && pingData.success,
        status: pingRes.status,
        data: pingData,
        message: pingData.message || (pingRes.ok ? 'Endpoint online' : `HTTP ${pingRes.status}`)
      });
    }

    // Action Push Recipe
    if (!recipeTitle || !recipeTitle.trim()) {
      return NextResponse.json({ success: false, error: 'Judul resep (recipeTitle) tidak boleh kosong.' }, { status: 400 });
    }

    const formData = new FormData();
    formData.append('action', 'push_recipe');
    if (syncToken) formData.append('sync_token', syncToken);
    formData.append('recipe_title', recipeTitle.trim());
    formData.append('recipe_time', recipeTime || '30 mins');
    formData.append('category_name', categoryName || 'Air Fryer');
    formData.append('recipe_description', recipeDescriptionHtml || '');
    if (videoUrl) {
      formData.append('video_url', videoUrl.trim());
      formData.append('content_type', 'Url');
    } else {
      formData.append('content_type', 'Post');
    }

    // Handle Image: jika ada imageUrl (4:3 Cover), ambil gambarnya dan sertakan sebagai file
    if (imageUrl) {
      try {
        const imgRes = await fetch(imageUrl);
        if (imgRes.ok) {
          const imgBuffer = await imgRes.arrayBuffer();
          const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
          const blob = new Blob([imgBuffer], { type: contentType });
          formData.append('recipe_image', blob, `cover_4_3_${Date.now()}.jpg`);
        } else {
          formData.append('recipe_image_url', imageUrl);
        }
      } catch (err) {
        formData.append('recipe_image_url', imageUrl);
      }
    }

    const pushRes = await fetch(endpointUrl, {
      method: 'POST',
      headers: syncToken ? { 'X-Sync-Token': syncToken } : {},
      body: formData
    });

    const pushData = await pushRes.json().catch(() => ({}));

    if (!pushRes.ok || !pushData.success) {
      return NextResponse.json({
        success: false,
        error: pushData.error || `HTTP ${pushRes.status}: Gagal push ke webadmin target.`,
        data: pushData
      }, { status: pushRes.status || 500 });
    }

    // Rekam audit trail ekspor resep ke database & update tabel sumber
    try {
      const { recordRecipeExport } = await import('@/lib/recipe-export-records');
      await recordRecipeExport({
        source: body.source || 'labs',
        sourceItemId: body.sourceItemId || body.id || '',
        recipeTitle: recipeTitle.trim(),
        targetApp: body.targetApp || body.targetAppName || 'Android Webadmin',
        categoryName: categoryName || '',
        webadminRecipeId: pushData.recipe_id || pushData.id || null,
        videoUrl: videoUrl || null
      });

      // Update data resep final dan media ke tabel sumber database
      const { getDb } = await import('@/lib/db');
      const db = getDb();
      const itemId = body.sourceItemId || body.id;
      if (itemId) {
        if (body.source === 'labs') {
          try {
            await db.prepare(`
              UPDATE recipe_items
              SET recipe_title = ?, recipe_markdown_text = ?,
                  img_grid_path = COALESCE(?, img_grid_path)
              WHERE id = ?
            `).run(recipeTitle.trim(), recipeDescriptionHtml || '', imageUrl || null, itemId);
          } catch (e) {
            console.warn('[Push Webadmin Labs Update Warning]:', e.message);
          }
        } else if (body.source === 'campaign' || body.originType === 'pillar') {
          const item = await db.prepare('SELECT result_json FROM pillar_campaign_items WHERE id = ?').get(itemId);
          if (item) {
            let parsed = {};
            try { parsed = JSON.parse(item.result_json || '{}'); } catch (_) {}
            parsed.recipe = {
              ...(parsed.recipe || {}),
              title: recipeTitle.trim(),
              is_exported: true,
              last_export_target: body.targetApp || 'Android Webadmin',
              last_exported_at: new Date().toISOString()
            };
            await db.prepare(`
              UPDATE pillar_campaign_items
              SET result_json = ?,
                  ffmpeg_output_path = COALESCE(?, ffmpeg_output_path),
                  t2i_start_frame_path = COALESCE(?, t2i_start_frame_path)
              WHERE id = ?
            `).run(JSON.stringify(parsed), videoUrl || null, imageUrl || null, itemId);
          }
        }
      }
    } catch (auditErr) {
      console.warn('[Audit/Sync Warning] Gagal mengupdate data sumber resep:', auditErr.message);
    }

    return NextResponse.json({
      success: true,
      recipeId: pushData.recipe_id || pushData.id,
      message: pushData.message || 'Resep berhasil disinkronkan ke webadmin.',
      data: pushData
    });

  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});
