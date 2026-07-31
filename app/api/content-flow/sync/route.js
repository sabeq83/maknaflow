import { NextResponse } from 'next/server';
import { scanAndSyncExistingCampaigns } from '@/lib/contentflow-ingest';

export async function POST() {
  try {
    const totalSynced = await scanAndSyncExistingCampaigns();
    return NextResponse.json({
      success: true,
      message: `Berhasil memindai dan menyinkronkan ${totalSynced} aset video dari seluruh kampanye database.`,
      synced_count: totalSynced
    });
  } catch (error) {
    console.error('[API /api/content-flow/sync POST Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
