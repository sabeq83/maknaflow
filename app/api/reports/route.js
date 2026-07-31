import { NextResponse } from 'next/server';
import { getJobReports, getApiKeyStats, cleanupOldJobs, getActiveCampaignsStats, listGlabsTasks } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { queueStats, globalStats } = await getJobReports();
    const { totalCapacity, totalUsed } = await getApiKeyStats();

    // Trigger cleanup asynchronously
    Promise.resolve().then(async () => {
      try {
        await cleanupOldJobs();
      } catch (err) {
        console.error('[Reports Cleanup Error]', err);
      }
    });

    const { activeReCampaigns, activeGlabsCampaigns } = await getActiveCampaignsStats();

    const activeCampaigns = [
      ...activeReCampaigns.map(c => ({
        type: 're',
        id: c.id,
        name: c.campaign_name || 'Unnamed RE Campaign',
        status: c.status,
        progress: {
          total: c.total_items || 0,
          downloaded: c.total_downloaded || 0,
          analyzed: c.total_analyzed || 0
        }
      })),
      ...activeGlabsCampaigns.map(c => ({
        type: 'glabs',
        id: c.id,
        name: `GLabs Batch: ${c.id}`,
        status: c.status,
        progress: {
          batch: c.current_batch || 'Starting'
        }
      }))
    ];

    const glabsTasks = await listGlabsTasks(50, 0);

    const successRate = globalStats.total_completed / ((globalStats.total_completed + globalStats.total_failed) || 1);

    return NextResponse.json({
      success: true,
      executiveSummary: {
        apiPool: { used: totalUsed, total: totalCapacity },
        successRate: isNaN(successRate) ? 0 : successRate,
        avgProcessingTimeSec: globalStats.avg_processing_time_sec || 0,
        totalJobs: globalStats.total_jobs || 0
      },
      queueMonitor: queueStats,
      activeCampaigns,
      glabsTasks
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
