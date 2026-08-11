import Database from 'better-sqlite3';
import { pgQuery } from '../lib/db-pg.js';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const SQLITE_DB_PATH = '/Users/sabeqmmursyid/_makna-grid/data/makna_grid.db';
const LOCAL_IMAGES_DIR = '/Users/sabeqmmursyid/_makna-grid/public/uploads/products/';
const REMOTE_DEST = 'masbenu@100.95.245.55:~/maknaflow-dev/public/uploads/products/';

async function runImport() {
  console.log('================================================================');
  console.log('🏁 MEMULAI PROSES IMPOR PRODUK DARI MAKNAGRID KE MAKNAFLOW DEV');
  console.log('================================================================');

  // 1. Validasi Berkas SQLite
  if (!fs.existsSync(SQLITE_DB_PATH)) {
    console.error(`❌ Database SQLite tidak ditemukan pada path: ${SQLITE_DB_PATH}`);
    process.exit(1);
  }

  // 2. Konek ke SQLite
  console.log('🔌 [1/4] Menghubungkan ke SQLite lokal...');
  const db = new Database(SQLITE_DB_PATH);
  
  // 3. Baca Data Produk
  console.log('📖 [2/4] Membaca data dari tabel product_extractions...');
  const rows = db.prepare('SELECT * FROM product_extractions').all();
  console.log(`📋 Ditemukan ${rows.length} produk siap diimpor.`);

  if (rows.length === 0) {
    console.log('⚠️ Tidak ada data produk untuk diimpor.');
    process.exit(0);
  }

  // 4. Impor Data ke PostgreSQL (dev schema)
  console.log('💾 [3/4] Mengimpor data ke PostgreSQL dev.product_extractions...');
  
  const columns = [
    'id', 'input_source', 'is_url', 'product_name', 'product_description',
    'unique_selling_point', 'target_audience', 'pain_point_solved',
    'key_visuals_extracted', 'raw_response', 'created_at', 'category',
    'tags', 'photo_url', 'source_url', 'affiliate_link', 'raw_description',
    'scraped_image_url', 'raw_photo_url', 'clean_photo_url', 'cleaned_photo_url',
    't2i_prompt', 'generated_photo_url', 'active_photo', 'is_in_packaging',
    'packaging_type', 'i2v_action_prompt', 'extraction_status', 'glabs_task_id',
    'clean_photo_t2i_prompt', 'product_truth', 'geometric_truth', 'tenant_id'
  ];

  const valuePlaceholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const updateClause = columns
    .filter(col => col !== 'id')
    .map((col) => `${col} = EXCLUDED.${col}`)
    .join(', ');

  const insertQuery = `
    INSERT INTO dev.product_extractions (${columns.join(', ')})
    VALUES (${valuePlaceholders})
    ON CONFLICT (id)
    DO UPDATE SET ${updateClause}
  `;

  let successCount = 0;
  let failCount = 0;

  for (const row of rows) {
    const values = columns.map(col => {
      if (col === 'tenant_id') return 'default_tenant';
      
      const val = row[col];
      // Tangani nilai Boolean/Integer SQLite ke PostgreSQL secara kompatibel
      if (col === 'is_url' || col === 'is_in_packaging') {
        return val !== undefined && val !== null ? Number(val) : 0;
      }
      
      return val !== undefined && val !== null ? val : null;
    });

    try {
      await pgQuery(insertQuery, values);
      successCount++;
      if (successCount % 50 === 0) {
        console.log(`  Processed ${successCount}/${rows.length} products...`);
      }
    } catch (dbErr) {
      console.error(`  ❌ Gagal mengimpor produk ID: ${row.id} - ${row.product_name || 'Tanpa Nama'}`);
      console.error(`     Error: ${dbErr.message}`);
      failCount++;
    }
  }

  console.log(`\n🎉 Proses Impor Selesai!`);
  console.log(`✅ Berhasil: ${successCount} produk.`);
  if (failCount > 0) {
    console.warn(`⚠️ Gagal: ${failCount} produk (periksa logs di atas).`);
  }

  // 5. Sinkronisasi File Foto Produk
  console.log('\n📡 [4/4] Sinkronisasi berkas foto produk via Rsync...');
  if (fs.existsSync(LOCAL_IMAGES_DIR)) {
    try {
      const rsyncCmd = `rsync -avz --ignore-existing "${LOCAL_IMAGES_DIR}" "${REMOTE_DEST}"`;
      console.log(`🚀 Menjalankan: ${rsyncCmd}`);
      execSync(rsyncCmd, { stdio: 'inherit' });
      console.log('📸 Berkas foto produk berhasil disinkronkan ke server dev!');
    } catch (rsyncErr) {
      console.error('❌ Gagal menjalankan rsync foto produk:', rsyncErr.message);
    }
  } else {
    console.log(`⚠️ Folder foto produk lokal tidak ditemukan: ${LOCAL_IMAGES_DIR}. Sinkronisasi berkas dilewati.`);
  }

  console.log('\n================================================================');
  console.log('✅ SELURUH TAHAPAN IMPOR TELAH SELESAI');
  console.log('================================================================');
}

runImport()
  .catch(console.error)
  .finally(() => process.exit(0));
