const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

try {
  const envConfig = dotenv.parse(fs.readFileSync(path.join(__dirname, '../.env.staging.local')));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
} catch (e) {
  console.warn('Warning: Could not load .env.staging.local:', e.message);
}

const { getPgPool } = require('../lib/db-pg.js');
const pool = getPgPool();

async function run() {
  const campaignId = 're_260804_2k462r';

  const camp = await pool.query("SELECT * FROM re_campaigns WHERE id = \$1", [campaignId]);
  console.log('=== CAMPAIGN ===');
  console.log(camp.rows);

  const items = await pool.query("SELECT id, campaign_id, scrape_status, analyze_status, tts_status, visual_status, ffmpeg_status, upload_status, workflow_status, drive_link, ffmpeg_output_path FROM re_campaign_items WHERE campaign_id = \$1", [campaignId]);
  console.log('=== ITEMS ===');
  console.log(items.rows);

  const cfItems = await pool.query("SELECT id, source_campaign_id, source_item_id, pipeline_status FROM content_flow_items WHERE source_campaign_id = \$1", [campaignId]);
  console.log('=== CONTENT FLOW ITEMS ===');
  console.log(cfItems.rows);

  process.exit(0);
}
run().catch(console.error);
