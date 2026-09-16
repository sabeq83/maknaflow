import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { ingestRecipePlannerToPillarCampaign } from '@/lib/recipe-campaign-ingest';

export const POST = withTenantContext(async (request, { params }, user) => {
  try {
    const { id: plannerId } = await params;
    const body = await request.json().catch(() => ({}));
    const { selected_row_ids, selectedRowIds, campaign_name } = body;

    const result = await ingestRecipePlannerToPillarCampaign({
      plannerId,
      selectedRowIds: selected_row_ids || selectedRowIds || [],
      campaignName: campaign_name || null,
      tenantId: user?.tenantId || 'default_tenant'
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('[API /content-planner/:id/ingest-recipe Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
});
