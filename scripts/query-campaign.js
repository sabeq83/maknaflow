const path = require('path');
const fs = require('fs');

try {
  const envPath = path.join(__dirname, '../.env.staging.local');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[key] = value.trim();
      }
    });
  }
} catch (e) {
  console.warn('Warning: Could not load .env.staging.local:', e.message);
}

const { getPgPool } = require('../lib/db-pg.js');
const pool = getPgPool();

async function run() {
  const campaignId = 're_260804_2k462r';

  const res = await pool.query("SELECT id, source_type, source_campaign_id, source_item_id, video_id, account_name, tenant_id FROM content_flow_items WHERE source_campaign_id = $1", [campaignId]);
  console.log('=== DUPLICATE FINDER ===');
  console.log(res.rows);

  process.exit(0);
}
run().catch(console.error);
