import { NextResponse } from 'next/server';
import { createJob, getDb } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function normalizeUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    let normalized = parsed.toString().trim();
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    normalized = normalized.replace('://www.', '://');
    return normalized;
  } catch (e) {
    let cleaned = url.trim().split('?')[0].split('#')[0];
    if (cleaned.endsWith('/')) cleaned = cleaned.slice(0, -1);
    return cleaned;
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { urls, csv_data, category, tags, repair_mode = true } = body;

    if (!urls && !csv_data) {
      return NextResponse.json({ success: false, error: 'Masukkan daftar URL produk atau file CSV terlebih dahulu.' }, { status: 400 });
    }

    const db = getDb();
    const allProducts = await db.prepare('SELECT id, input_source, source_url, raw_photo_url, cleaned_photo_url, generated_photo_url, unique_selling_point, packaging_type FROM product_extractions').all();

    const findExistingProduct = (targetUrl) => {
      const normalizedTarget = normalizeUrl(targetUrl);
      return allProducts.find(p => 
        normalizeUrl(p.input_source) === normalizedTarget || 
        normalizeUrl(p.source_url) === normalizedTarget
      );
    };

    const checkMissingComponents = (product) => {
      const rawFileMissing = !product.raw_photo_url || !fs.existsSync(path.join(process.cwd(), 'public', product.raw_photo_url));
      const cleanFileMissing = !product.cleaned_photo_url || !fs.existsSync(path.join(process.cwd(), 'public', product.cleaned_photo_url));
      const studioFileMissing = !product.generated_photo_url || !fs.existsSync(path.join(process.cwd(), 'public', product.generated_photo_url));
      const metadataMissing = !product.unique_selling_point || !product.packaging_type;

      return {
        rawFileMissing,
        cleanFileMissing,
        studioFileMissing,
        metadataMissing,
        anyMissing: rawFileMissing || cleanFileMissing || studioFileMissing || metadataMissing
      };
    };

    let urlsToScrape = [];
    let skippedCount = 0;
    let updatedCount = 0; // CSV affiliate links direct update
    let repairCount = 0; // Existing products enqueued for repair
    let newCount = 0; // Completely new products
    const urlAffiliatesMap = {};

    if (csv_data && Array.isArray(csv_data)) {
      // CSV Flow
      const uniqueCsvRows = [];
      const seenUrls = new Set();
      for (const row of csv_data) {
        if (row.url && !seenUrls.has(row.url)) {
          seenUrls.add(row.url);
          uniqueCsvRows.push(row);
        }
      }

      for (const row of uniqueCsvRows) {
        const url = row.url.trim();
        const affiliate = row.affiliate_link ? row.affiliate_link.trim() : '';
        if (url.startsWith('http://') || url.startsWith('https://')) {
          const existing = findExistingProduct(url);
          if (existing) {
            // Update existing affiliate link directly
            await db.prepare('UPDATE product_extractions SET affiliate_link = ? WHERE id = ?').run(affiliate, existing.id);
            updatedCount++;

            if (repair_mode) {
              const comp = checkMissingComponents(existing);
              if (comp.anyMissing) {
                urlsToScrape.push(url);
                urlAffiliatesMap[url] = affiliate;
                repairCount++;
              }
            }
          } else {
            urlsToScrape.push(url);
            urlAffiliatesMap[url] = affiliate;
            newCount++;
          }
        }
      }
    } else {
      // Manual URLs Flow
      let urlList = [];
      if (Array.isArray(urls)) {
        urlList = urls;
      } else if (typeof urls === 'string') {
        urlList = urls
          .split('\n')
          .map(u => u.trim())
          .filter(u => u.length > 0);
      }

      if (urlList.length === 0) {
        return NextResponse.json({ success: false, error: 'Tidak ada URL valid yang ditemukan.' }, { status: 400 });
      }

      const uniqueUrls = Array.from(new Set(urlList));
      for (const url of uniqueUrls) {
        if (url.startsWith('http://') || url.startsWith('https://')) {
          const existing = findExistingProduct(url);
          if (existing) {
            if (repair_mode) {
              const comp = checkMissingComponents(existing);
              if (comp.anyMissing) {
                urlsToScrape.push(url);
                repairCount++;
              } else {
                skippedCount++;
              }
            } else {
              skippedCount++;
            }
          } else {
            urlsToScrape.push(url);
            newCount++;
          }
        }
      }
    }

    if (urlsToScrape.length === 0) {
      let message = '';
      if (csv_data) {
        message = `Proses selesai. ${updatedCount} link afiliasi produk diperbarui secara instan. Tidak ada produk baru atau data rumpang yang perlu di-scrape.`;
      } else {
        message = `Semua URL produk yang dimasukkan (${skippedCount}) sudah ada di database dan datanya lengkap. Scraping dilewati.`;
      }
      return NextResponse.json({
        success: true,
        message,
        enqueued_count: 0,
        skipped_count: skippedCount,
        updated_count: updatedCount
      });
    }

    // Chunk validUrls into batches of 20 (efficient batching)
    const batchSize = 20;
    let enqueuedCount = 0;
    for (let i = 0; i < urlsToScrape.length; i += batchSize) {
      const chunk = urlsToScrape.slice(i, i + batchSize);
      // Pass the urlAffiliatesMap and repair_mode in the job payload
      await createJob('product_scraper', { 
        urls: chunk, 
        category, 
        tags, 
        url_affiliates_map: urlAffiliatesMap, 
        repair_mode 
      });
      enqueuedCount += chunk.length;
    }

    let message = '';
    if (newCount > 0 && repairCount > 0) {
      message = `${newCount} produk baru dan ${repairCount} produk lama (dalam proses melengkapi data) dimasukkan ke antrean scraping.`;
    } else if (newCount > 0) {
      message = `${newCount} produk baru dimasukkan ke antrean scraping.`;
    } else if (repairCount > 0) {
      message = `${repairCount} produk lama (dalam proses melengkapi data) dimasukkan ke antrean scraping.`;
    }

    if (updatedCount > 0) {
      message += ` (${updatedCount} link afiliasi langsung diperbarui).`;
    }
    if (skippedCount > 0) {
      message += ` (${skippedCount} produk dilewati karena sudah lengkap di database).`;
    }

    return NextResponse.json({ 
      success: true, 
      message, 
      enqueued_count: enqueuedCount,
      skipped_count: skippedCount,
      updated_count: updatedCount,
      new_count: newCount,
      repair_count: repairCount
    });
  } catch (error) {
    console.error('Scrape API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

