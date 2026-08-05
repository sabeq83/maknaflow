import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  createDeconstructBatch,
  createDeconstructAsset,
  getDeconstructBatches,
  createJob,
  getDb
} from '@/lib/db';

/**
 * GET /api/v2/deconstruct
 * List all deconstruct batches or completed assets
 */
import { withTenantContext } from '@/lib/auth';

export const GET = withTenantContext(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('assets') === 'true') {
      const db = getDb();
      const assets = await db.prepare("SELECT * FROM re_deconstructed_assets WHERE status = 'deconstructed' ORDER BY created_at DESC").all();
      return NextResponse.json({ success: true, assets });
    }
    const batches = await getDeconstructBatches();
    return NextResponse.json({ success: true, batches });
  } catch (error) {
    console.error('[Deconstruct API] GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

/**
 * POST /api/v2/deconstruct
 * Create a new deconstruct batch
 * Body: { batch_name, urls: string (newline separated), captions?: string (newline separated), target_recommendation_count?: number }
 * OR: { batch_name, csv_data: [{ url, caption }], target_recommendation_count?: number }
 */
export const POST = withTenantContext(async (request) => {
  try {
    const body = await request.json();
    const { batch_name, target_recommendation_count = 3 } = body;

    if (!batch_name || !batch_name.trim()) {
      return NextResponse.json({ success: false, error: 'Nama batch wajib diisi' }, { status: 400 });
    }

    // Parse URLs: support both manual input (newline string) and CSV data (array)
    let items = [];

    if (body.csv_data && Array.isArray(body.csv_data)) {
      // CSV mode: [{ url, caption }]
      items = body.csv_data
        .filter(row => row.url && row.url.trim())
        .map(row => ({
          url: row.url.trim(),
          caption: (row.caption || '').trim() || null,
        }));
    } else if (body.urls) {
      // Manual mode: newline-separated URLs
      const urls = body.urls
        .split('\n')
        .map(u => u.trim())
        .filter(u => u.length > 0);

      const captions = body.captions
        ? body.captions.split('\n').map(c => c.trim())
        : [];

      items = urls.map((url, i) => ({
        url,
        caption: captions[i] || null,
      }));
    }

    if (items.length === 0) {
      return NextResponse.json({ success: false, error: 'Setidaknya satu URL video wajib diisi' }, { status: 400 });
    }

    if (items.length > 50) {
      return NextResponse.json({ success: false, error: 'Maksimum 50 URL per batch' }, { status: 400 });
    }

    // Create batch
    const batchId = uuidv4();
    await createDeconstructBatch({
      id: batchId,
      batch_name: batch_name.trim(),
      target_recommendation_count: Number(target_recommendation_count) || 3,
      total_videos: items.length,
    });

    // Create assets
    for (const item of items) {
      await createDeconstructAsset({
        id: uuidv4(),
        batch_id: batchId,
        source_url: item.url,
        original_caption: item.caption,
      });
    }

    // Trigger scheduler
    await createJob('re_deconstruct', { batch_id: batchId });

    return NextResponse.json({
      success: true,
      batch_id: batchId,
      queued_count: items.length,
    });

  } catch (error) {
    console.error('[Deconstruct API] POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
