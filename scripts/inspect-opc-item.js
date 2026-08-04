import { getDb } from '../lib/db.js';

async function main() {
  const db = getDb();
  try {
    const campaignId = 'opc_260804_opb4zk';
    console.log(`=== Inspecting Campaign ${campaignId} ===`);
    const campaign = await db.prepare('SELECT * FROM pillar_campaigns WHERE id = ? -- tenant_id').get(campaignId);
    console.log('Campaign details:', campaign);

    console.log('\n=== Campaign Items ===');
    const items = await db.prepare('SELECT id, campaign_id, tts_batch_id, ffmpeg_status, upload_status, drive_link, result_json FROM pillar_campaign_items WHERE campaign_id = ? -- tenant_id').all(campaignId);
    for (const item of items) {
      console.log(`Item ID: ${item.id}`);
      console.log(`  ffmpeg_status: ${item.ffmpeg_status}`);
      console.log(`  upload_status: ${item.upload_status}`);
      console.log(`  drive_link   : ${item.drive_link}`);
      console.log(`  result_json length: ${item.result_json ? item.result_json.length : 0}`);
    }
  } catch (err) {
    console.error('Error during inspection:', err);
  }
  process.exit(0);
}

main();
