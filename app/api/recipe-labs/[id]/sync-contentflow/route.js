import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { syncRecipeCampaignToContentFlow } from '@/lib/contentflow-ingest';

export const POST = withTenantContext(async (request, { params }) => {
  try {
    const { id } = await params;
    let itemId = null;
    try {
      const body = await request.json();
      if (body && body.item_id) itemId = body.item_id;
    } catch (_) {}

    const result = await syncRecipeCampaignToContentFlow(id, itemId);
    return NextResponse.json({
      success: true,
      message: `Berhasil menyinkronkan resep ke ContentFlow Hub (${result.synced_count} item).`,
      data: result
    });
  } catch (error) {
    console.error('[API /api/recipe-labs/[id]/sync-contentflow POST Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
