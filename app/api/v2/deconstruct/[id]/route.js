import { NextResponse } from 'next/server';
import {
  getDeconstructBatchById,
  deleteDeconstructBatch,
} from '@/lib/db';
import { withTenantContext } from '@/lib/auth';

/**
 * GET /api/v2/deconstruct/[id]
 * Get batch detail with all assets
 */
export const GET = withTenantContext(async (request, { params }) => {
  try {
    const { id } = await params;
    const batch = await getDeconstructBatchById(id);

    if (!batch) {
      return NextResponse.json({ success: false, error: 'Batch tidak ditemukan' }, { status: 404 });
    }

    // Parse JSON fields for each asset
    const assets = (batch.assets || []).map(asset => {
      let storyboard = [];
      let productIdeas = {};
      try { storyboard = JSON.parse(asset.original_storyboard_json || '[]'); } catch {}
      try { productIdeas = JSON.parse(asset.product_ideas_json || '{}'); } catch {}
      return {
        ...asset,
        storyboard,
        product_ideas: productIdeas,
      };
    });

    return NextResponse.json({
      success: true,
      batch: {
        id: batch.id,
        batch_name: batch.batch_name,
        target_recommendation_count: batch.target_recommendation_count,
        status: batch.status,
        total_videos: batch.total_videos,
        processed_videos: batch.processed_videos,
        created_at: batch.created_at,
      },
      assets,
    });

  } catch (error) {
    console.error('[Deconstruct API] GET detail error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

/**
 * DELETE /api/v2/deconstruct/[id]
 * Delete a batch and all its assets
 */
export const DELETE = withTenantContext(async (request, { params }) => {
  try {
    const { id } = await params;
    await deleteDeconstructBatch(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Deconstruct API] DELETE error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
