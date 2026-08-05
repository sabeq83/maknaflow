import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';

export const dynamic = 'force-dynamic';

function getHeaderVal(row, aliases) {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const cleanAlias = alias.toLowerCase().trim().replace(/[\s_-]+/g, '');
    for (const key of keys) {
      const cleanKey = key.toLowerCase().trim().replace(/[\s_-]+/g, '');
      if (cleanKey === cleanAlias || cleanKey.includes(cleanAlias)) {
        return row[key];
      }
    }
  }
  return null;
}

function appendToLog(message) {
  try {
    const logDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const tenantId = getActiveTenantId();
    const logPath = path.join(logDir, `product_bulk_logs_${tenantId}.txt`);
    const timestamp = new Date().toLocaleString('id-ID');
    fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
  } catch (err) {
    console.error('[Import Logger Error]:', err.message);
  }
}

export const POST = withTenantContext(async (req) => {
  try {
    const formData = await req.formData();
    const file = formData.get('file'); 
    
    if (!file) {
      return NextResponse.json({ success: false, error: 'File is required' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet);

    if (rawRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Berkas CSV/Excel kosong' }, { status: 400 });
    }

    const db = getDb();
    let importedCount = 0;
    let skippedCount = 0;

    appendToLog(`========================================================================`);
    appendToLog(`[INPUT] Impor massal CSV/Excel dipicu. Menemukan ${rawRows.length} baris data raw.`);

    await db.transaction(async () => {
      for (const row of rawRows) {
        // Map synonyms
        const rawName = getHeaderVal(row, ['Nama Produk Raw', 'nama_produk_raw', 'product_name_raw', 'Nama Produk', 'product_name', 'product name']);
        const rawDesc = getHeaderVal(row, ['Deskripsi Produk Raw', 'deskripsi_produk_raw', 'product_description_raw', 'Deskripsi Produk', 'product_description', 'description', 'deskripsi']);
        const rawLink = getHeaderVal(row, ['Link Produk', 'link_produk', 'link_product', 'product_link', 'source_url', 'url_produk', 'url produk']);
        const rawPhoto = getHeaderVal(row, ['URL Foto Produk Raw', 'url_foto_produk_raw', 'product_image_url_raw', 'photo_url_raw', 'photo_url', 'product_image_url', 'image_url', 'url foto']);

        if (!rawName || rawName.trim().length === 0) {
          skippedCount++;
          continue;
        }

        // Prevent duplicates based on source_url or product_name
        let exists = false;
        if (rawLink && rawLink.trim().startsWith('http')) {
          const matched = await db.prepare('SELECT id FROM product_extractions WHERE source_url = ? OR input_source = ?').get(rawLink.trim(), rawLink.trim());
          if (matched) exists = true;
        } else {
          const matched = await db.prepare('SELECT id FROM product_extractions WHERE product_name = ?').get(rawName.trim());
          if (matched) exists = true;
        }

        if (exists) {
          skippedCount++;
          continue;
        }

        const id = `pe_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const isUrl = (rawLink && rawLink.trim().startsWith('http')) ? 1 : 0;
        const inputSource = rawLink || 'Manual';

        await db.prepare(`
          INSERT INTO product_extractions (
            id, input_source, is_url, product_name, product_description, raw_description,
            source_url, scraped_image_url, raw_photo_url, extraction_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `).run(
          id,
          inputSource,
          isUrl,
          rawName.trim(),
          rawDesc ? rawDesc.trim() : '',
          rawDesc ? rawDesc.trim() : '',
          rawLink ? rawLink.trim() : '',
          rawPhoto ? rawPhoto.trim() : '',
          rawPhoto ? rawPhoto.trim() : ''
        );

        importedCount++;
      }
    })();

    appendToLog(`[SUCCESS] Impor selesai. ${importedCount} produk masuk antrean 'pending', ${skippedCount} baris dilewati (kosong atau duplikat).`);

    return NextResponse.json({ 
      success: true, 
      message: `Impor CSV raw selesai! ${importedCount} produk ditambahkan ke antrean, ${skippedCount} produk dilewati.`,
      imported_count: importedCount,
      skipped_count: skippedCount
    });

  } catch (error) {
    console.error('[Products Import CSV Error]:', error);
    appendToLog(`[ERROR] Impor massal gagal: ${error.message}`);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
