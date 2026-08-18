import { NextResponse } from 'next/server';
import { enqueueDeconstructAssets } from '@/lib/db';
import { getActiveTenantId } from '@/lib/tenant-context';
import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (request) => {
  try {
    const body = await request.json();
    const { asset_ids, target_recommendation_count = 3 } = body;
    const tenantId = getActiveTenantId();

    if (!asset_ids || !Array.isArray(asset_ids) || asset_ids.length === 0) {
      return NextResponse.json({ success: false, error: 'asset_ids wajib berupa array dan tidak kosong' }, { status: 400 });
    }

    if (asset_ids.length > 50) {
      return NextResponse.json({ success: false, error: 'Maksimum 50 URL dapat dienqueue sekaligus' }, { status: 400 });
    }

    const batchId = await enqueueDeconstructAssets(asset_ids, { target_recommendation_count }, tenantId);

    return NextResponse.json({
      success: true,
      batch_id: batchId,
      enqueued_count: asset_ids.length
    });
  } catch (error) {
    console.error('[Deconstruct Process API] POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
