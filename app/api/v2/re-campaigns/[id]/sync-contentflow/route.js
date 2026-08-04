import { NextResponse } from 'next/server';
import { scanAndSyncExistingCampaigns } from '@/lib/contentflow-ingest';

export async function POST(request, { params }) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams?.id || params?.id;
    const syncedCount = await scanAndSyncExistingCampaigns(id);
    return NextResponse.json({ success: true, synced_count: syncedCount });
  } catch (error) {
    console.error('[API /v2/re-campaigns/[id]/sync-contentflow POST Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
