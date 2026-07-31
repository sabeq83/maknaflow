import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createStrategicCampaign } from '@/lib/strategic-campaign-engine';

export async function POST(request) {
  try {
    const { planner_id, selected_row_ids = [], campaign_name, vso_config, workflow_config } = await request.json();
    const db = getDb();

    const planner = await db.prepare('SELECT * FROM content_planners WHERE id = ?').get(planner_id);
    if (!planner) {
      return NextResponse.json({ success: false, error: 'Planner tidak ditemukan.' }, { status: 404 });
    }

    let rowIdsToIngest = selected_row_ids;
    if (rowIdsToIngest.length === 0) {
      const allRows = await db.prepare('SELECT id FROM content_planner_rows WHERE planner_id = ?').all(planner_id);
      rowIdsToIngest = allRows.map(r => r.id);
    }

    const result = await createStrategicCampaign({
      campaign_name: campaign_name || `Strategic Campaign - ${planner.product_name}`,
      source_planner_id: planner.id,
      selected_row_ids: rowIdsToIngest,
      input_mode: 'planner_import',
      account_name: planner.account_name,
      brand_profile_id: planner.brand_id || null,
      target_spreadsheet_id: planner.google_sheet_id,
      product_name: planner.product_name,
      product_description: planner.product_description,
      product_usp: planner.product_usp,
      product_ref_image: planner.product_ref_image,
      vso_config,
      workflow_config
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[API Ingest Planner Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
