import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

async function upsertRow(db, tableName, rowData) {
  if (!rowData) return;
  try {
    const tableInfo = await db.prepare(`PRAGMA table_info("${tableName}")`).all();
    const validColumns = new Set(tableInfo.map(col => col.name));
    
    const keys = Object.keys(rowData).filter(k => validColumns.has(k));
    if (keys.length === 0) return;
    
    const columns = keys.map(k => `"${k}"`).join(', ');
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(k => rowData[k]);
    const sql = `INSERT OR REPLACE INTO "${tableName}" (${columns}) VALUES (${placeholders})`;
    await db.prepare(sql).run(...values);
  } catch (err) {
    console.error(`[Import DB Error] Failed to upsert row into ${tableName}:`, err.message);
  }
}

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('products_file'); 
    
    if (!file) {
      return NextResponse.json({ success: false, error: 'products_file is required' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const zip = new AdmZip(buffer);

    const jsonEntry = zip.getEntry("products_payload.json");
    if (!jsonEntry) {
      return NextResponse.json({ success: false, error: 'Invalid file format: products_payload.json not found inside ZIP.' }, { status: 400 });
    }

    const dbPayload = JSON.parse(zip.readAsText(jsonEntry));
    const products = dbPayload.products || [];

    // 1. Extract physical image files from ZIP under assets/
    const assetEntries = zip.getEntries().filter(entry => {
      const normalizedName = entry.entryName.replace(/\\/g, '/');
      return normalizedName.startsWith('assets/') && !entry.isDirectory;
    });

    for (const entry of assetEntries) {
      const normalizedName = entry.entryName.replace(/\\/g, '/');
      const relativePath = normalizedName.replace(/^assets\//, '');
      const targetPath = path.join(process.cwd(), 'public', relativePath);
      
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, entry.getData());
    }

    let importedCount = 0;
    let skippedCount = 0;

    const db = getDb();

    await db.transaction(async () => {
      for (const product of products) {
        let exists = false;
        
        // 2. Check if source URL already exists in database (input_source or source_url)
        const urlsToCheck = [];
        if (product.input_source && product.input_source !== 'Manual') {
          urlsToCheck.push(product.input_source.trim());
        }
        if (product.source_url) {
          urlsToCheck.push(product.source_url.trim());
        }
        
        for (const url of urlsToCheck) {
          if (url) {
            const row = await db.prepare('SELECT id FROM product_extractions WHERE input_source = ? OR source_url = ?').get(url, url);
            if (row) {
              exists = true;
              break;
            }
          }
        }
        
        // 3. Prevent primary key collisions by checking product ID
        if (!exists && product.id) {
          const row = await db.prepare('SELECT id FROM product_extractions WHERE id = ?').get(product.id);
          if (row) {
            exists = true;
          }
        }

        if (exists) {
          skippedCount++;
          continue;
        }

        // 4. Normalize all image paths in product to forward slashes
        const urlKeys = ['photo_url', 'raw_photo_url', 'clean_photo_url', 'cleaned_photo_url', 'generated_photo_url'];
        for (const key of urlKeys) {
          if (product[key]) {
            let normalized = product[key].replace(/\\/g, '/');
            if (!normalized.startsWith('/')) {
              normalized = '/' + normalized;
            }
            product[key] = normalized;
          }
        }

        // 5. Upsert data to local sqlite database
        await upsertRow(db, 'product_extractions', product);
        importedCount++;
      }
    })();

    return NextResponse.json({ 
      success: true, 
      message: `Impor selesai! ${importedCount} produk berhasil diimpor, ${skippedCount} produk dilewati (sudah ada).`,
      imported_count: importedCount,
      skipped_count: skippedCount
    });

  } catch (error) {
    console.error('[Products Import Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
