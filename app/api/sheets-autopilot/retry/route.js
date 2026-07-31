import { NextResponse } from 'next/server';
import { getDb, getSheetsCampaign } from '@/lib/db';
import { getAuthorizedClient } from '@/lib/google-auth';
import { google } from 'googleapis';
import { updateCell } from '@/lib/sheets-autopilot-worker';

export async function POST(request) {
  try {
    const { campaignId, rowIndex, force } = await request.json();

    if (!campaignId || !rowIndex) {
      return NextResponse.json({ success: false, error: 'Parameters campaignId and rowIndex are required' }, { status: 400 });
    }

    const db = getDb();
    const campaign = await getSheetsCampaign(campaignId);
    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 });
    }

    if (force === true) {
      // 1. Get associated sheets_jobs IDs to clean up glabs_tasks (Force Reset)
      const jobs = await db.prepare('SELECT id FROM sheets_jobs WHERE campaign_id = ? AND row_index = ?').all(campaignId, rowIndex);
      const jobIds = jobs.map(j => j.id);

      // 2. Perform DB deletion within a transaction
      await db.transaction(async () => {
        if (jobIds.length > 0) {
          const placeholders = jobIds.map(() => '?').join(', ');
          await db.prepare(`DELETE FROM glabs_tasks WHERE item_id IN (${placeholders})`).run(...jobIds);
        }
        await db.prepare('DELETE FROM sheets_jobs WHERE campaign_id = ? AND row_index = ?').run(campaignId, rowIndex);
      })();
    }

    // 3. Update Google Sheet cell (reset pipeline_status to empty/blank)
    const auth = getAuthorizedClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const sheetName = campaign.campaign_type === 'RE' ? 'CAMPAIGN_RE' : (campaign.campaign_type === 'OPC' ? 'CAMPAIGN_OPC' : 'CAMPAIGN_IFC');

    // Retrieve headers first to get column index of pipeline_status
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: campaign.spreadsheet_id,
      range: `'${sheetName}'!A1:Z1`
    });
    const rows = response.data.values;
    if (rows && rows.length > 0) {
      const headers = rows[0].map(h => h.trim().toLowerCase());
      const pipelineStatusIdx = headers.indexOf('pipeline_status');
      if (pipelineStatusIdx !== -1) {
        await updateCell(sheets, campaign.spreadsheet_id, sheetName, pipelineStatusIdx, rowIndex, '');
      }
    }

    return NextResponse.json({
      success: true,
      message: `Pekerjaan baris #${rowIndex} telah berhasil direset dan siap diproses ulang.`
    });

  } catch (err) {
    console.error('Error in Sheets Autopilot retry API:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
