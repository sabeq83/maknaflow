import fs from 'fs';
import { getDb } from '../lib/db.js';
import { execSync } from 'child_process';

async function syncProductsToNode1() {
  console.log('🚀 === STARTING PRODUCT DB SYNC TO NODE 1 === 🚀');

  const localDb = getDb();
  const products = localDb.prepare('SELECT * FROM product_extractions').all();
  console.log(`📦 Found ${products.length} products in local SQLite DB.`);

  fs.writeFileSync('./scratch_products.json', JSON.stringify(products));

  console.log('📡 Copying scratch_products.json to Node 1...');
  execSync('scp ./scratch_products.json makna-ui:~/maknaflow/scratch_products.json', { stdio: 'inherit' });
  fs.unlinkSync('./scratch_products.json');

  console.log('📥 Importing products into Node 1 SQLite DB...');
  const remoteNodeCmd = `
const fs = require('fs');
const db = require('./lib/db').getDb();

try {
  db.exec("ALTER TABLE product_extractions ADD COLUMN brand_id TEXT;");
} catch (e) {}

const products = JSON.parse(fs.readFileSync('./scratch_products.json', 'utf8'));

const columnsInfo = await db.prepare("PRAGMA table_info(product_extractions)").all();
const validCols = columnsInfo.map(c => c.name);

const sample = products[0] || {};
const keysToUse = Object.keys(sample).filter(k => validCols.includes(k));

const colNamesStr = keysToUse.join(', ');
const placeholdersStr = keysToUse.map(() => '?').join(', ');

const stmt = await db.prepare('INSERT OR REPLACE INTO product_extractions (' + colNamesStr + ') VALUES (' + placeholdersStr + ')');

const insertMany = db.transaction((rows) => {
  for (const r of rows) {
    const valArray = keysToUse.map(k => {
      const v = r[k];
      if (v !== null && typeof v === 'object') {
        return JSON.stringify(v);
      }
      return v === undefined ? null : v;
    });
    stmt.run(...valArray);
  }
});

insertMany(products);
console.log('✓ Successfully inserted/updated ' + products.length + ' products on Node 1!');
fs.unlinkSync('./scratch_products.json');
`;

  fs.writeFileSync('./scratch_import_remote.js', remoteNodeCmd);
  execSync('scp ./scratch_import_remote.js makna-ui:~/maknaflow/scratch_import_remote.js', { stdio: 'inherit' });
  fs.unlinkSync('./scratch_import_remote.js');

  execSync('ssh -o ConnectTimeout=10 makna-ui "cd ~/maknaflow && export PATH=/home/sabeqmursyid/.local/bin:$PATH && node scratch_import_remote.js && rm scratch_import_remote.js"', { stdio: 'inherit' });

  console.log('🎉 Product sync to Node 1 complete!');
}

syncProductsToNode1().catch(console.error);
