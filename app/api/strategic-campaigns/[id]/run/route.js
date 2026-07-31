import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { writeLogToFile, logContextStorage } from '@/lib/console-hook';
import { processStrategicGenerator } from '@/lib/scheduler-processors';
import path from 'path';

export async function POST(req, { params }) {
  try {
    const resolvedParams = await params;
    const campaignId = resolvedParams.id;
    const body = await req.json().catch(() => ({}));

    const db = getDb();
    const campaign = await db.prepare("SELECT * FROM strategic_campaigns WHERE id = ?").get(campaignId);
    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Kampanye tidak ditemukan' }, { status: 404 });
    }

    let nextStatus = body.status;
    if (!nextStatus) {
      nextStatus = campaign.status === 'running' ? 'paused' : 'running';
    }

    await db.prepare("UPDATE strategic_campaigns SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(nextStatus, campaignId);

    const logFile = path.join(process.cwd(), 'public', 'strategic_campaign_logs.txt');
    writeLogToFile(logFile, `[Status Campaign] Kampanye ${campaignId} (${campaign.campaign_name}) diubah statusnya menjadi ${nextStatus.toUpperCase()}.`);

    // Trigger immediate background AI Ideation (Call 1 Single-Pass Engine) if status set to 'running'
    if (nextStatus === 'running') {
      const itemsToProcess = await db.prepare(`
        SELECT id FROM strategic_campaign_items 
        WHERE campaign_id = ? AND (generation_status = 'pending' OR workflow_status = 'ready_for_call_1' OR workflow_status = 'draft')
        ORDER BY sequence ASC
      `).all(campaignId);

      if (itemsToProcess.length > 0) {
        console.log(`🚀 [Run Campaign Trigger] Instantly launching Single-Pass AI Engine for ${itemsToProcess.length} items...`);
        
        // Execute background queue non-blocking
        (async () => {
          await logContextStorage.run(logFile, async () => {
            for (const item of itemsToProcess) {
              try {
                console.log(`[Run Campaign Trigger] Processing item #${item.id} via Gemini AI Single-Pass Engine...`);
                await processStrategicGenerator({ item_id: item.id }, { id: -1 });
              } catch (itemErr) {
                console.error(`[Run Campaign Trigger] Error item #${item.id}:`, itemErr.message);
              }
            }
          });
        })().catch(err => console.error('[Run Campaign Trigger Background Error]', err));
      }
    }

    return NextResponse.json({
      success: true,
      status: nextStatus,
      message: `Status kampanye berhasil diubah menjadi ${nextStatus}`
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
