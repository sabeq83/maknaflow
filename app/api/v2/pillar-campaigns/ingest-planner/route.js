import { NextResponse } from 'next/server';
import { ingestPlannerToPillarCampaign } from '@/lib/pillar-campaign-ingest';

export async function POST(request) {
  try {
    const { planner_id, selected_row_ids = [], campaign_name, global_settings = {} } = await request.json();
    const result = await ingestPlannerToPillarCampaign({
      plannerId: planner_id,
      selectedRowIds: selected_row_ids,
      campaignName: campaign_name,
      globalSettings: global_settings
    });
    return NextResponse.json({
      success: true,
      campaign_id: result.campaignId,
      campaign_name: result.campaignName,
      ingested_count: result.ingestedCount,
      status: result.status
    });
  } catch (error) {
    console.error('[API /api/v2/pillar-campaigns/ingest-planner POST Error]', error);
    return NextResponse.json(
      { success: false, error: error.message, code: error.code || 'PILLAR_INGEST_FAILED' },
      { status: error.status || 500 }
    );
  }
}
