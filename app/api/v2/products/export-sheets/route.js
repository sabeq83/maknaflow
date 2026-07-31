import { NextResponse } from 'next/server';
import { getDb, getSetting } from '@/lib/db';
import { google } from 'googleapis';
import { getAuthorizedClient } from '@/lib/google-auth';
import { getOrCreateRootFolder, getOrCreateFolderInFolder } from '@/lib/drive-uploader';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';

async function findUploadedFile(drive, filename, folderId) {
  try {
    const res = await drive.files.list({
      q: `name='${filename}' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id,webViewLink)',
      spaces: 'drive',
    });
    if (res.data.files && res.data.files.length > 0) {
      return res.data.files[0];
    }
  } catch (err) {
    console.error(`[Search File Drive] Failed for ${filename}:`, err.message);
  }
  return null;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { ids } = body;

    const db = getDb();
    let products = [];

    if (ids && Array.isArray(ids) && ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      products = await db.prepare(`SELECT * FROM product_extractions WHERE id IN (${placeholders}) ORDER BY created_at DESC`).all(...ids);
    } else {
      products = await db.prepare('SELECT * FROM product_extractions ORDER BY created_at DESC').all();
    }

    if (products.length === 0) {
      return NextResponse.json({ success: false, error: 'Tidak ada data produk yang terpilih untuk diekspor.' }, { status: 400 });
    }

    // 1. Authenticate with Google
    let auth;
    try {
      auth = getAuthorizedClient();
    } catch (authErr) {
      return NextResponse.json({ 
        success: false, 
        error: 'Google Account belum terhubung. Silakan hubungkan akun Google Anda terlebih dahulu di menu Settings.' 
      }, { status: 401 });
    }

    const drive = google.drive({ version: 'v3', auth });
    const sheets = google.sheets({ version: 'v4', auth });

    // 2. Setup Google Drive target folder for photos
    const photoFolderName = await getSetting('drive_product_photo_folder') || '_fotoproduk';
    const rootId = await getOrCreateRootFolder(drive, 'MAKNA Assets');
    const photoFolderId = await getOrCreateFolderInFolder(photoFolderName, rootId);

    const spreadsheetRows = [];

    // 3. Process products and upload photos
    for (const product of products) {
      let drivePhotoUrl = '';
      let imageBuffer = null;
      let filename = `product_photo_${product.id}.png`;
      let mimeType = 'image/png';

      // Determine photo source
      if (product.photo_url) {
        if (product.photo_url.startsWith('/')) {
          // Local file
          const imgFullPath = path.join(process.cwd(), 'public', product.photo_url);
          if (fs.existsSync(imgFullPath)) {
            imageBuffer = fs.readFileSync(imgFullPath);
            filename = path.basename(product.photo_url);
            // Simple extension mapping
            if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) mimeType = 'image/jpeg';
            else if (filename.endsWith('.webp')) mimeType = 'image/webp';
          }
        } else if (product.photo_url.startsWith('http://') || product.photo_url.startsWith('https://')) {
          // Remote URL
          try {
            const dlRes = await fetch(product.photo_url);
            if (dlRes.ok) {
              imageBuffer = Buffer.from(await dlRes.arrayBuffer());
              const contentType = dlRes.headers.get('content-type');
              if (contentType) mimeType = contentType;
              // Extract name if possible
              const parts = product.photo_url.split('/');
              const lastPart = parts[parts.length - 1].split('?')[0];
              if (lastPart && lastPart.includes('.')) {
                filename = lastPart;
              }
            }
          } catch (dlErr) {
            console.error(`[Export Sheets] Failed to download photo_url: ${product.photo_url}`, dlErr.message);
          }
        }
      }

      // Fallback to scraped_image_url if no photo_url found
      if (!imageBuffer && product.scraped_image_url && (product.scraped_image_url.startsWith('http://') || product.scraped_image_url.startsWith('https://'))) {
        try {
          const dlRes = await fetch(product.scraped_image_url);
          if (dlRes.ok) {
            imageBuffer = Buffer.from(await dlRes.arrayBuffer());
            const contentType = dlRes.headers.get('content-type');
            if (contentType) mimeType = contentType;
            const parts = product.scraped_image_url.split('/');
            const lastPart = parts[parts.length - 1].split('?')[0];
            if (lastPart && lastPart.includes('.')) {
              filename = lastPart;
            }
          }
        } catch (dlErr) {
          console.error(`[Export Sheets] Failed to download scraped_image_url: ${product.scraped_image_url}`, dlErr.message);
        }
      }

      // Upload image to Drive if present
      if (imageBuffer) {
        // Prevent duplicates: search by name
        const existingFile = await findUploadedFile(drive, filename, photoFolderId);
        if (existingFile) {
          drivePhotoUrl = existingFile.webViewLink || `https://drive.google.com/file/d/${existingFile.id}/view`;
        } else {
          try {
            const uploaded = await drive.files.create({
              requestBody: {
                name: filename,
                parents: [photoFolderId],
              },
              media: {
                mimeType,
                body: Readable.from(imageBuffer),
              },
              fields: 'id,webViewLink',
            });

            // Set public permission so anyone with link can view the image
            try {
              await drive.permissions.create({
                fileId: uploaded.data.id,
                requestBody: { role: 'reader', type: 'anyone' },
              });
            } catch (_) {}

            drivePhotoUrl = uploaded.data.webViewLink || `https://drive.google.com/file/d/${uploaded.data.id}/view`;
          } catch (uploadErr) {
            console.error(`[Export Sheets] Failed uploading ${filename} to Drive:`, uploadErr.message);
          }
        }
      }

      // 4. Format USP to single line
      let formattedUsp = '';
      if (product.unique_selling_point) {
        const rawUsp = product.unique_selling_point;
        let points = [];
        if (rawUsp.startsWith('-') || rawUsp.includes('\n')) {
          points = rawUsp.split('\n').map(l => l.replace(/^-\s*/, '').trim()).filter(Boolean);
        } else {
          try {
            const parsed = JSON.parse(rawUsp);
            points = Array.isArray(parsed) ? parsed : [parsed];
          } catch (e) {
            points = [rawUsp];
          }
        }
        formattedUsp = points.join('; ');
      }

      // Add to rows
      spreadsheetRows.push([
        product.product_name || '',
        formattedUsp,
        product.affiliate_link || '',
        product.source_url || product.input_source || '',
        drivePhotoUrl
      ]);
    }

    // 5. Create new Google Spreadsheet
    const titleDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    const createRes = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: `MAKNA Product Export - ${titleDate}`
        },
        sheets: [
          {
            properties: {
              title: 'Products'
            }
          }
        ]
      }
    });

    const spreadsheetId = createRes.data.spreadsheetId;
    const spreadsheetUrl = createRes.data.spreadsheetUrl;

    // Append Header and Rows
    const headers = ['Nama Produk', 'USP', 'URL Affiliate', 'URL Produk', 'URL Gambar Produk'];
    const finalValues = [headers, ...spreadsheetRows];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Products!A1',
      valueInputOption: 'RAW',
      requestBody: {
        values: finalValues
      }
    });

    // Make spreadsheet viewable by anyone with link
    try {
      await drive.permissions.create({
        fileId: spreadsheetId,
        requestBody: { role: 'reader', type: 'anyone' },
      });
    } catch (_) {}

    return NextResponse.json({
      success: true,
      spreadsheetId,
      spreadsheetUrl
    });

  } catch (error) {
    console.error('[Export Sheets API Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
