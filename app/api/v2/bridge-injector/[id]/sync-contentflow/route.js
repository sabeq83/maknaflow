import { NextResponse } from 'next/server';
import { syncBridgeCampaignToContentFlow } from '@/lib/contentflow-ingest';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID kampanye wajib disertakan.' }, { status: 400 });
    }

    const result = await syncBridgeCampaignToContentFlow(id);
    return NextResponse.json({
      success: true,
      message: `Kampanye berhasil disinkronkan ke ContentFlow! (${result.synced_count} video)`,
      data: result
    });
  } catch (error) {
    console.error('[Bridge Injector Sync ContentFlow POST Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
