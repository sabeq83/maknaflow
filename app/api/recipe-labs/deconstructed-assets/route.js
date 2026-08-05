import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

import { withTenantContext } from '@/lib/auth';

export const GET = withTenantContext(async () => {
  try {
    const db = getDb();
    // Ambil aset yang sudah selesai didekonstruksi
    const assets = await db.prepare(`
      SELECT id, source_url, original_caption, product_ideas_json, created_at, tags
      FROM re_deconstructed_assets
      WHERE status = 'deconstructed'
      ORDER BY created_at DESC
    `).all();

    // Map data untuk UI dropdown yang ramah pengguna
    const formattedAssets = assets.map(a => {
      let tagsStr = a.tags ? a.tags.split(',').map(t => '#' + t.trim()).join(' ') : '';
      let shortUrl = a.source_url;
      // Strip protocol for cleaner look
      shortUrl = shortUrl.replace(/https?:\/\/(www\.)?/, '');
      if (shortUrl.length > 50) {
        shortUrl = shortUrl.substring(0, 50) + '...';
      }

      const displayLabel = tagsStr ? `${shortUrl} (${tagsStr})` : shortUrl;
      
      let parsedIdeas = {};
      try {
        parsedIdeas = JSON.parse(a.product_ideas_json || '{}');
      } catch (_) {}

      // Ekstrak nama produk/resep potensial dari ide produk
      const lowIdeas = parsedIdeas.low_ticket || [];
      const highIdeas = parsedIdeas.high_ticket || [];
      const recipeIdea = lowIdeas.find(i => i.category?.toLowerCase().includes('food') || i.category?.toLowerCase().includes('beverage'))?.product_name ||
                         highIdeas.find(i => i.category?.toLowerCase().includes('food'))?.product_name ||
                         'Resep Berdasarkan Video';

      return {
        id: a.id,
        source_url: a.source_url,
        label: displayLabel,
        recipe_suggestion: recipeIdea,
        raw_ideas: parsedIdeas
      };
    });

    return NextResponse.json({ success: true, data: formattedAssets });
  } catch (error) {
    console.error('[API /api/recipe-labs/deconstructed-assets GET Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
