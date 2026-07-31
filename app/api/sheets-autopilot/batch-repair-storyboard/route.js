import { NextResponse } from 'next/server';
import { getDb, getSheetsCampaign } from '@/lib/db';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function log(msg) {
  const ts = new Date().toLocaleTimeString('id-ID', { hour12: false });
  const line = `[${ts}] [batch-repair-storyboard] ${msg}`;
  console.log(line);
  return line;
}

/**
 * POST /api/sheets-autopilot/batch-repair-storyboard
 *
 * Body:
 * {
 *   campaignId: string,
 *   jobs: [
 *     { jobId: string, clipIndex: number },
 *     ...
 *   ]
 * }
 *
 * Proses tiap item secara berurutan (sequential) dengan jeda 2 detik
 * agar tidak membebani G-Labs Webhook dan Gemini API.
 */
export async function POST(request) {
  const masterLogs = [];
  const addLog = (msg) => { masterLogs.push(log(msg)); };

  try {
    const body = await request.json();
    const { campaignId, jobs } = body;

    if (!campaignId || !Array.isArray(jobs) || jobs.length === 0) {
      return NextResponse.json(
        { error: 'campaignId dan jobs (array) diperlukan' },
        { status: 400 }
      );
    }

    const db = getDb();
    const campaign = await getSheetsCampaign(campaignId);
    if (!campaign) {
      return NextResponse.json({ error: `Campaign ${campaignId} tidak ditemukan` }, { status: 404 });
    }

    addLog(`Memulai batch repair untuk campaign: ${campaignId}`);
    addLog(`Total job yang akan diproses: ${jobs.length}`);

    const results = [];
    const localPort = process.env.PORT || '3000';

    for (let i = 0; i < jobs.length; i++) {
      const { jobId, clipIndex } = jobs[i];
      addLog(`─── [${i + 1}/${jobs.length}] Memproses jobId=${jobId} clipIndex=${clipIndex} ───`);

      // Validasi job ada di DB
      const jobRow = await db.prepare('SELECT id, batch_id, row_index, status FROM sheets_jobs WHERE id = ?').get(jobId);
      if (!jobRow) {
        const errMsg = `Job ${jobId} tidak ditemukan di database. Dilewati.`;
        addLog(`⚠️  ${errMsg}`);
        results.push({ jobId, clipIndex, success: false, error: errMsg });
        continue;
      }

      addLog(`Batch: ${jobRow.batch_id} | Row: ${jobRow.row_index} | Status: ${jobRow.status}`);

      try {
        // Panggil repair-storyboard-clip secara internal
        const repairRes = await fetch(
          `http://127.0.0.1:${localPort}/api/sheets-autopilot/repair-storyboard-clip`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId, clipIndex }),
          }
        );

        const repairJson = await repairRes.json();

        // Forward sub-logs ke master log
        if (repairJson.logs && Array.isArray(repairJson.logs)) {
          repairJson.logs.forEach(l => addLog(`  | ${l}`));
        }

        if (!repairRes.ok || !repairJson.success) {
          const errMsg = repairJson.error || `HTTP ${repairRes.status}`;
          addLog(`❌ Gagal: ${errMsg}`);
          results.push({
            jobId,
            batchId: jobRow.batch_id,
            clipIndex,
            success: false,
            error: errMsg,
          });
        } else {
          addLog(`✅ Sukses! Narasi baru: "${repairJson.newNarration}"`);
          results.push({
            jobId,
            batchId: jobRow.batch_id,
            clipIndex,
            success: true,
            newNarration: repairJson.newNarration,
            driveFolder: repairJson.driveFolder,
          });
        }
      } catch (jobErr) {
        const errMsg = jobErr.message || 'Unknown error';
        addLog(`❌ Error pada job ${jobId}: ${errMsg}`);
        results.push({
          jobId,
          batchId: jobRow.batch_id,
          clipIndex,
          success: false,
          error: errMsg,
        });
      }

      // Jeda 2 detik antar job agar tidak overwhelm API
      if (i < jobs.length - 1) {
        addLog(`Menunggu 2 detik sebelum memproses job berikutnya...`);
        await sleep(2000);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    addLog(`═══ BATCH SELESAI: ${successCount} sukses, ${failCount} gagal dari ${jobs.length} total ═══`);

    return NextResponse.json({
      success: true,
      campaignId,
      totalProcessed: jobs.length,
      successCount,
      failCount,
      results,
      logs: masterLogs,
    });

  } catch (err) {
    console.error('[batch-repair-storyboard] ERROR:', err);
    return NextResponse.json({ error: err.message, logs: masterLogs }, { status: 500 });
  }
}
