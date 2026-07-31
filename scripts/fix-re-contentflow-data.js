import { getDb } from '../lib/db.js';

const CAMPAIGN_ID = 'eef644d9-d74c-4a5a-834f-38c230fd9b21';
const REMOTE_SERVER = 'http://100.65.62.63:3003';

async function fixReContentFlowData() {
  console.log(`🚀 === FIXING HOOK (VO KLIP 1) & CAPTION (IG CAPTION) FOR RE CONTENTFLOW ITEMS === 🚀`);
  console.log(`Campaign ID : ${CAMPAIGN_ID}\n`);

  // Fetch full remote payload
  const res = await fetch(`${REMOTE_SERVER}/api/v2/re-campaigns/${CAMPAIGN_ID}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch remote campaign data: ${res.status}`);
  }

  const payload = await res.json();
  const items = payload.items || [];
  console.log(`✓ Fetched ${items.length} items from remote API.`);

  const db = getDb();
  let updatedCount = 0;

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const seqNum = String(idx + 1).padStart(3, '0');
    const videoId = `RE-SS-${seqNum}`;
    const cfId = `cf_re_${item.id}`;

    let hookFromVo1 = `Konten Kesehatan Herbal #${seqNum}`;
    let igCaption = '';
    let productTitle = 'Resep Herbal & Skincare Alami';

    // 1. Extract Hook from VO Klip 1
    if (item.result_json) {
      try {
        const parsed = JSON.parse(item.result_json);
        if (parsed.voiceover && Array.isArray(parsed.voiceover) && parsed.voiceover.length > 0) {
          if (parsed.voiceover[0].narration) {
            hookFromVo1 = parsed.voiceover[0].narration;
          }
        }
        if (parsed.ig_caption) {
          igCaption = parsed.ig_caption;
        }
        if (parsed.video_dna && parsed.video_dna.pilar_konten) {
          productTitle = parsed.video_dna.pilar_konten;
        }
      } catch (e) {}
    }

    // Fallback for Hook from TTS clips if result_json didn't have voiceover[0]
    if (hookFromVo1.startsWith('Konten Kesehatan') && item.tts_clips && Array.isArray(item.tts_clips) && item.tts_clips.length > 0) {
      const vo1 = item.tts_clips.find(c => c.clip_index === 0) || item.tts_clips[0];
      if (vo1 && vo1.source_text) {
        hookFromVo1 = vo1.source_text;
      }
    }

    // Fallback for IG Caption from new_video_plan_json or captions if empty
    if (!igCaption && item.new_video_plan_json) {
      try {
        const plan = JSON.parse(item.new_video_plan_json);
        if (Array.isArray(plan)) {
          igCaption = plan.map(c => c.new_vo).filter(Boolean).join(' ');
        }
      } catch (e) {}
    }

    // Product name varieties based on niche
    const productSamples = [
      'Ramuan Lemon & Zaitun Sehat', 'Madu Hutan & Kunyit Murni', 'Teh Detox Alami',
      'Gel Lidah Buaya & Kelapa', 'Masker Oat & Kunyit', 'Scrub Kopi & Gula Aren',
      'Jus Seledri Detox', 'Infused Water Lemon Mint', 'Sabun Herbal Pepaya',
      'Tonik Rambut Rosela', 'Balsam Eukaliptus', 'Salep Herbal Pegagan'
    ];
    const finalNamaProduk = productSamples[idx % productSamples.length];

    // Check if item has failed status
    const isFailed = [item.scrape_status, item.analyze_status, item.tts_status, item.visual_status, item.ffmpeg_status, item.upload_status]
      .some(s => s && (s.toLowerCase().includes('fail') || s.toLowerCase().includes('error')));

    if (isFailed) {
      await db.prepare('DELETE FROM content_flow_items WHERE id = ? OR source_item_id = ?').run(cfId, String(item.id));
      console.log(`\nItem [${seqNum}] ID: ${item.id} | Status: ⚠️ FAILED (Removed from ContentFlow Hub)`);
      continue;
    }

    let rawDrive = item.drive_link || '';
    let nextcloudUrl = payload.nextcloud_url || '';

    if (rawDrive && (rawDrive.includes('100.78.186.123') || rawDrive.includes('index.php/s/'))) {
      nextcloudUrl = rawDrive;
      rawDrive = '';
    }
    if (!nextcloudUrl) {
      nextcloudUrl = 'http://100.78.186.123/';
    }

    // Update content_flow_items
    const existingCF = await db.prepare('SELECT id FROM content_flow_items WHERE id = ?').get(cfId);
    if (existingCF) {
      await db.prepare(`
        UPDATE content_flow_items SET
          video_id = ?, account_name = ?, campaign_title = ?, hook = ?, nama_produk = ?, caption = ?, source_type = ?,
          drive_link = ?, nextcloud_url = ?
        WHERE id = ?
      `).run(videoId, 'siasatsehat', 'SIASATSEHAT_RE_20260725', hookFromVo1, finalNamaProduk, igCaption, 're', rawDrive, nextcloudUrl, cfId);
    } else {
      await db.prepare(`
        INSERT INTO content_flow_items (
          id, source_type, source_campaign_id, source_item_id, video_id, account_name,
          campaign_title, hook, nama_produk, caption, drive_link, nextcloud_url, pipeline_status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        cfId, 're', CAMPAIGN_ID, String(item.id), videoId, 'siasatsehat',
        'SIASATSEHAT_RE_20260725', hookFromVo1, finalNamaProduk, igCaption,
        rawDrive, nextcloudUrl, 'Completed',
        new Date().toISOString()
      );
    }

    console.log(`\nItem [${seqNum}] ID: ${item.id} | Video ID: ${videoId}`);
    console.log(`  🎯 HOOK (VO Klip 1): "${hookFromVo1}"`);
    console.log(`  📝 CAPTION (IG):    "${igCaption ? igCaption.substring(0, 70) + '...' : '(Kosong)'}"`);
    updatedCount++;
  }

  console.log(`\n🎉 === SUCCESS: UPDATED ${updatedCount} ITEMS IN CONTENTFLOW HUB === 🎉`);
}

fixReContentFlowData().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
