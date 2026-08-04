import { NextResponse } from 'next/server';
import { syncCampaignToContentFlow } from '@/lib/contentflow-ingest';

export async function POST(request, { params }) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams?.id || params?.id;
    const result = await syncCampaignToContentFlow(id);
    return NextResponse.json({ success: true, synced_count: result.synced_count, data: result });
  } catch (error) {
    console.error('[API /v2/pillar-campaigns/[id]/sync-contentflow POST Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

