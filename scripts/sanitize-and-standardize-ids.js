const { pgQuery } = require('../lib/db-pg');
const { getDb } = require('../lib/db');

function formatVideoId({ accountName, modulePrefix = 're', campaignId = '', sequence = 1 }) {
  const accountSlug = (accountName || 'umum')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');

  const modPrefix = (modulePrefix || 're').toLowerCase().trim();

  let campaignHash = '66b4d6';
  if (campaignId) {
    const cleanId = String(campaignId).replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (cleanId.length >= 6) {
      campaignHash = cleanId.substring(0, 6);
    } else {
      campaignHash = cleanId.padEnd(6, '0');
    }
  }

  const paddedSeq = String(sequence).padStart(2, '0');
  return `${accountSlug}_${modPrefix}_${campaignHash}_${paddedSeq}`;
}

async function sanitizeAndStandardizeIds() {
  console.log('🚀 [Sanitize Script] Standardizing Campaign & Video IDs across MAKNA Grid...');

  const sqliteDb = getDb();

  // 1. Fetch all content_flow_items from PostgreSQL Node 3
  const pgRes = await pgQuery('SELECT * FROM content_flow_items ORDER BY created_at ASC;');
  const items = pgRes.rows;

  console.log(`📦 [Sanitize Script] Found ${items.length} total items in PostgreSQL Node 3 content_flow_items.`);

  // Group items by account_name & source_campaign_id to assign sequential numbers per campaign
  const campaignCounters = {};
  let updatedCount = 0;

  for (const item of items) {
    const accountName = item.account_name || 'umum';
    const sourceType = item.source_type || 're';
    const campaignId = item.source_campaign_id || 'general';

    const groupKey = `${accountName}_${sourceType}_${campaignId}`;
    if (!campaignCounters[groupKey]) {
      campaignCounters[groupKey] = 0;
    }
    campaignCounters[groupKey]++;

    const sequence = campaignCounters[groupKey];
    const newVideoId = formatVideoId({
      accountName: accountName,
      modulePrefix: sourceType,
      campaignId: campaignId,
      sequence: sequence
    });

    // Update PostgreSQL Node 3
    await pgQuery(
      'UPDATE content_flow_items SET video_id = $1, updated_at = NOW() WHERE id = $2;',
      [newVideoId, item.id]
    );

    // Update SQLite
    try {
      sqliteDb.prepare('UPDATE content_flow_items SET video_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;')
        .run(newVideoId, item.id);
    } catch (_) {}

    updatedCount++;
    console.log(`  [Item ${updatedCount}/${items.length}] Old: "${item.video_id}" ➔ New Standardized: "${newVideoId}" (Account: ${accountName})`);
  }

  console.log(`\n🎉 [Sanitize Success] Successfully standardized ${updatedCount} video_id records across PostgreSQL Node 3 & SQLite!`);
  process.exit(0);
}

sanitizeAndStandardizeIds().catch(err => {
  console.error('❌ [Sanitize Error]', err);
  process.exit(1);
});
