import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const oldDbPath = '/Users/sabeqmmursyid/_maknagen/data/makna.db';
const newDbPath = path.join(process.cwd(), 'data', 'maknaflow.db');

const oldUploadDir = '/Users/sabeqmmursyid/_maknagen/public/uploads/products';
const newUploadDir = path.join(process.cwd(), 'public', 'uploads', 'products');

async function migrateProducts() {
  console.log('🚀 === START PRODUCT MIGRATION FROM _maknagen === 🚀');

  if (!fs.existsSync(oldDbPath)) {
    console.error(`❌ Old database not found at ${oldDbPath}`);
    process.exit(1);
  }

  const oldDb = new Database(oldDbPath);
  const newDb = new Database(newDbPath);

  // 1. Ensure target uploads directory exists
  if (!fs.existsSync(newUploadDir)) {
    fs.mkdirSync(newUploadDir, { recursive: true });
  }

  // 2. Fetch products from old database
  const oldProducts = oldDb.prepare('SELECT * FROM product_extractions').all();
  console.log(`📦 Found ${oldProducts.length} products in _maknagen database.`);

  if (oldProducts.length === 0) {
    console.log('⚠️ No products to migrate.');
    return;
  }

  // Get column names from table info
  const colsInfo = newDb.prepare('PRAGMA table_info(product_extractions)').all();
  const colNames = colsInfo.map(c => c.name);

  const placeholders = colNames.map(() => '?').join(', ');
  const sql = `INSERT OR REPLACE INTO product_extractions (${colNames.join(', ')}) VALUES (${placeholders})`;
  const insertStmt = newDb.prepare(sql);

  let insertedCount = 0;

  const insertTransaction = newDb.transaction((products) => {
    for (const prod of products) {
      const values = colNames.map(col => prod[col] !== undefined ? prod[col] : null);
      insertStmt.run(...values);
      insertedCount++;
    }
  });

  insertTransaction(oldProducts);
  console.log(`✅ Successfully migrated ${insertedCount} products to MAKNA Flow database!`);

  // 3. Copy image assets from _maknagen to _maknaflow
  if (fs.existsSync(oldUploadDir)) {
    const files = fs.readdirSync(oldUploadDir);
    console.log(`🖼️ Copying ${files.length} product images to ${newUploadDir}...`);
    let copiedFiles = 0;
    for (const file of files) {
      const srcFile = path.join(oldUploadDir, file);
      const destFile = path.join(newUploadDir, file);
      if (fs.statSync(srcFile).isFile() && !fs.existsSync(destFile)) {
        fs.copyFileSync(srcFile, destFile);
        copiedFiles++;
      }
    }
    console.log(`📸 Copied ${copiedFiles} new image files to public/uploads/products.`);
  }

  // 4. Verify total products in new database
  const finalCount = newDb.prepare('SELECT count(*) as count FROM product_extractions').get();
  console.log(`🎉 Final product count in MAKNA Grid DB: ${finalCount.count}`);
}

migrateProducts().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
