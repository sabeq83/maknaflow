/**
 * scripts/backfill-download-videos.mjs
 * One-shot script: Download existing video assets stored as external URLs
 * to local storage and update the DB with the relative path.
 *
 * Run: node scripts/backfill-download-videos.mjs
 */

import { pgQuery } from '../lib/db-pg.js';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const transport = url.startsWith('https') ? https : http;
    transport.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }
      const file = fs.createWriteStream(destPath);
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function main() {
  console.log('🎬 Backfill: Download external video assets to local storage\n');

  // Find all succeeded visual assets with external video_path
  const res = await pgQuery(`
    SELECT id, scene_index, shot_index, output_asset_json
    FROM dev.youtube_production_assets
    WHERE asset_type != 'voiceover'
      AND status = 'succeeded'
      AND output_asset_json->>'video_path' LIKE 'http%'
    ORDER BY scene_index, shot_index
  `);

  if (res.rows.length === 0) {
    console.log('✅ No assets with external video URLs found. Nothing to do.');
    process.exit(0);
  }

  console.log(`Found ${res.rows.length} asset(s) with external video URLs:\n`);

  const uploadDir = path.join(projectRoot, 'public', 'uploads', 'videos');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(`📁 Created directory: ${uploadDir}`);
  }

  let success = 0;
  let failed = 0;

  for (const row of res.rows) {
    const assetId = row.id;
    const oj = row.output_asset_json;
    const externalUrl = oj.video_path;

    console.log(`⬇️  Scene ${row.scene_index} Shot ${row.shot_index} — ${externalUrl}`);

    try {
      const filename = `yt_video_${assetId}.mp4`;
      const destPath = path.join(uploadDir, filename);
      const localPath = `/uploads/videos/${filename}`;

      await downloadFile(externalUrl, destPath);

      const sizeBytes = fs.statSync(destPath).size;
      console.log(`   ✅ Downloaded ${(sizeBytes / 1024 / 1024).toFixed(2)} MB → ${localPath}`);

      // Update DB
      const newOj = { ...oj, video_path: localPath };
      await pgQuery(
        `UPDATE dev.youtube_production_assets SET output_asset_json = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [JSON.stringify(newOj), assetId]
      );
      console.log(`   📝 DB updated.\n`);
      success++;
    } catch (err) {
      console.error(`   ❌ Failed: ${err.message}\n`);
      failed++;
    }
  }

  console.log(`\n✅ Done — ${success} downloaded, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
