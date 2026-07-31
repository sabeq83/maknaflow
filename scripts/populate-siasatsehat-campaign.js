import { getDb } from '../lib/db.js';

const CAMPAIGN_ID = 'eef644d9-d74c-4a5a-834f-38c230fd9b21';
const BRAND_NAME = 'siasatsehat';

async function populateSiasatSehat() {
  console.log(`🚀 === POPULATING BRAND ATTR & VIDEO IDs FOR KAMPANYE RE === 🚀`);
  console.log(`Campaign ID : ${CAMPAIGN_ID}`);
  console.log(`Brand Name  : @${BRAND_NAME}\n`);

  const db = getDb();

  // 1. Get Brand Profile ID
  const brand = await db.prepare('SELECT id FROM brand_profiles WHERE LOWER(brand_name) = ?').get(BRAND_NAME);
  if (brand) {
    await db.prepare('UPDATE re_campaigns SET brand_profile_id = ? WHERE id = ?').run(brand.id, CAMPAIGN_ID);
    console.log(`✓ Updated re_campaigns.brand_profile_id = "${brand.id}"`);
  }

  // 2. Get all RE items for this campaign
  const reItems = await db.prepare('SELECT * FROM re_campaign_items WHERE campaign_id = ? ORDER BY id ASC').all(CAMPAIGN_ID);
  console.log(`✓ Found ${reItems.length} RE items in database.`);

  let updatedCount = 0;

  for (let idx = 0; idx < reItems.length; idx++) {
    const item = reItems[idx];
    const seqNum = String(idx + 1).padStart(3, '0');
    const videoId = `RE-SS-${seqNum}`; // Clean video_id format e.g. RE-SS-001

    let storyboard = [];
    let hookTitle = `Konten Kesehatan Herbal #${seqNum}`;
    let namaProduk = 'Resep Herbal & Skincare Alami';
    let captionText = '';

    try {
      if (item.result_json) {
        const parsed = JSON.parse(item.result_json);
        if (Array.isArray(parsed) && parsed.length > 0) {
          storyboard = parsed;
          if (parsed[0].new_vo) {
            hookTitle = parsed[0].new_vo;
          }
          captionText = parsed.map(c => c.new_vo).filter(Boolean).join(' ');
        }
      }
    } catch (e) {}

    // Distinct Niche/Product Names for the 24 items
    const productSamples = [
      'Serum Lidah Buaya & Kelapa', 'Teh Kombucha Herbal', 'Minyak Zaitun Extra Virgin',
      'Madu Hutan Murni', 'Masker Oat & Kunyit', 'Scrub Kopi & Gula Aren',
      'Jus Seledri Detox', 'Infused Water Lemon Mint', 'Sabun Herbal Pepaya',
      'Tonik Rambut Rosela', 'Balsam Aromaterapi Eukaliptus', 'Salep Herbal Pegagan'
    ];
    namaProduk = productSamples[idx % productSamples.length];

    const cfId = `cf_re_${item.id}`;
    const existingCF = await db.prepare('SELECT id FROM content_flow_items WHERE id = ?').get(cfId);

    if (existingCF) {
      await db.prepare(`
        UPDATE content_flow_items SET
          video_id = ?, account_name = ?, campaign_title = ?, hook = ?, nama_produk = ?, caption = ?, source_type = ?
        WHERE id = ?
      `).run(videoId, BRAND_NAME, 'SIASATSEHAT_RE_20260725', hookTitle, namaProduk, captionText, 're', cfId);
    } else {
      await db.prepare(`
        INSERT INTO content_flow_items (
          id, source_type, source_campaign_id, source_item_id, video_id, account_name,
          campaign_title, hook, nama_produk, caption, drive_link, nextcloud_url, pipeline_status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        cfId, 're', CAMPAIGN_ID, String(item.id), videoId, BRAND_NAME,
        'SIASATSEHAT_RE_20260725', hookTitle, namaProduk, captionText,
        item.drive_link || '', 'http://100.78.186.123/', 'Completed',
        new Date().toISOString()
      );
    }

    console.log(`  [${seqNum}] Video ID: ${videoId} | Brand: @${BRAND_NAME} | Hook: "${hookTitle.substring(0, 45)}..."`);
    updatedCount++;
  }

  console.log(`\n🎉 === POPULATION COMPLETED === 🎉`);
  console.log(`Updated ContentFlow Items : ${updatedCount}`);
  console.log(`Format Video ID           : RE-SS-001 s/d RE-SS-${String(updatedCount).padStart(3, '0')}`);
  console.log(`Brand Assigned            : @siasatsehat`);
}

populateSiasatSehat().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
