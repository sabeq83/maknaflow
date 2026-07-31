import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ZipArchive } from 'archiver';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const idsParam = url.searchParams.get('ids');

    const db = getDb();
    let products = [];

    if (idsParam) {
      const ids = idsParam.split(',').map(id => id.trim()).filter(Boolean);
      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        products = await db.prepare(`SELECT * FROM product_extractions WHERE id IN (${placeholders}) ORDER BY created_at DESC`).all(...ids);
      } else {
        products = await db.prepare('SELECT * FROM product_extractions ORDER BY created_at DESC').all();
      }
    } else {
      products = await db.prepare('SELECT * FROM product_extractions ORDER BY created_at DESC').all();
    }

    // 1. Prepare ZipArchive
    const archive = new ZipArchive({ zlib: { level: 9 } });

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', 'application/zip');
    responseHeaders.set('Content-Disposition', `attachment; filename="products_export_${Date.now()}.zip"`);

    const stream = new ReadableStream({
      start(controller) {
        archive.on('data', chunk => controller.enqueue(chunk));
        archive.on('end', () => controller.close());
        archive.on('error', err => controller.error(err));
      }
    });

    // 2. Insert products JSON payload
    const dbPayload = {
      version: '9.0',
      exported_at: new Date().toISOString(),
      products
    };
    archive.append(JSON.stringify(dbPayload, null, 2), { name: 'products_payload.json' });

    // 3. Insert product photo assets
    const addedFiles = new Set();
    for (const product of products) {
      const urlKeys = ['photo_url', 'raw_photo_url', 'clean_photo_url', 'cleaned_photo_url', 'generated_photo_url'];
      for (const key of urlKeys) {
        const pUrl = product[key];
        if (pUrl && (pUrl.startsWith('/') || pUrl.startsWith('\\'))) {
          const cleanLocalPath = pUrl.replace(/\\/g, '/').replace(/^\/+/, '');
          const imgFullPath = path.join(process.cwd(), 'public', cleanLocalPath);
          if (fs.existsSync(imgFullPath) && !addedFiles.has(pUrl)) {
            addedFiles.add(pUrl);
            archive.file(imgFullPath, { name: `assets/${cleanLocalPath}` });
          }
        }
      }
    }

    archive.finalize();
    return new Response(stream, { headers: responseHeaders });

  } catch (error) {
    console.error('[Products Export Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
