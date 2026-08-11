import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import { pgQuery, withPgTransaction } from '@/lib/db-pg';
import { validateProductImportRow, normalizeProductUrl } from '@/lib/product-validation';

export const dynamic = 'force-dynamic';

// ============================================================
// Logging (tenant-aware)
// ============================================================
function safeTenantId(id) {
  return String(id || 'default').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
}

function appendToLog(message, tenantId) {
  try {
    const logDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(logDir, `product_bulk_logs_${safeTenantId(tenantId)}.txt`);
    const timestamp = new Date().toLocaleString('id-ID');
    fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
  } catch (err) {
    console.error('[Import Logger Error]:', err.message);
  }
}

// ============================================================
// Canonical header mapping
// ============================================================
const HEADER_ALIASES = {
  page: ['page', 'halaman', 'page_number'],
  product_name: ['nama produk raw', 'nama_produk_raw', 'product_name_raw', 'nama produk', 'product_name', 'product name', 'nama'],
  product_description: ['deskripsi produk raw', 'deskripsi_produk_raw', 'product_description_raw', 'deskripsi produk', 'product_description', 'description', 'deskripsi'],
  source_url: ['link produk', 'link_produk', 'link_product', 'product_link', 'source_url', 'url_produk', 'url produk', 'link'],
  raw_photo_source_url: ['url foto produk raw', 'url_foto_produk_raw', 'product_image_url_raw', 'photo_url_raw', 'photo_url', 'product_image_url', 'image_url', 'url foto', 'foto url', 'url gambar'],
  affiliate_link: ['link aff', 'link_aff', 'link affiliate', 'affiliate_link', 'linkaff', 'affiliate link']
};

function normalizeHeaderKey(raw) {
  return String(raw || '').toLowerCase().trim().replace(/[\s_-]+/g, ' ');
}

function mapRowHeaders(rawRow) {
  const mapped = {};
  const rowKeys = Object.keys(rawRow);

  for (const [canonicalKey, aliases] of Object.entries(HEADER_ALIASES)) {
    const normalizedAliases = aliases.map(a => a.toLowerCase().trim().replace(/[\s_-]+/g, ' '));
    for (const rawKey of rowKeys) {
      const normalizedKey = normalizeHeaderKey(rawKey);
      if (normalizedAliases.some(a => normalizedKey === a || normalizedKey.includes(a))) {
        mapped[canonicalKey] = rawRow[rawKey];
        break;
      }
    }
  }
  return mapped;
}

// ============================================================
// Import handler
// ============================================================
export const POST = withTenantContext(async (req) => {
  const tenantId = getActiveTenantId();
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const duplicateMode = formData.get('duplicate_mode') || 'update_missing'; // 'update_missing' | 'skip_existing'
    const photoProvider = formData.get('photo_provider') || 'system_default';
    const brandProfileId = formData.get('brand_profile_id') || null;
    const affiliateMode = formData.get('affiliate_mode') || 'brand_product'; // 'brand_product' | 'legacy_product'

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

    appendToLog(`========================================================================`, tenantId);
    appendToLog(`[INPUT] Impor CSV/Excel: ${rawRows.length} baris ditemukan. Mode: ${duplicateMode}, Provider: ${photoProvider}, Brand: ${brandProfileId || 'None'}, AffMode: ${affiliateMode}`, tenantId);

    // Map headers ke canonical
    const parsedRows = rawRows.map((rawRow, idx) => {
      const mapped = mapRowHeaders(rawRow);
      return {
        ...mapped,
        source_row_number: idx + 2 // +2 karena baris 1 adalah header
      };
    });

    // Validasi per baris (tidak membatalkan seluruh import)
    const validRows = [];
    const rowErrors = [];
    for (const row of parsedRows) {
      const validation = validateProductImportRow(row, row.source_row_number);
      if (validation.valid) {
        validRows.push(validation.data);
      } else {
        rowErrors.push({ row: row.source_row_number, errors: validation.errors });
      }
    }

    if (validRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Tidak ada baris valid dalam file',
        row_errors: rowErrors
      }, { status: 400 });
    }

    // Simpan dalam transaksi — tidak ada AI/network di dalam transaksi
    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    await withPgTransaction(async (client) => {
      // Validasi Brand Profile jika disuplai
      if (brandProfileId) {
        const brandRes = await client.query('SELECT id FROM brand_profiles WHERE id = $1 AND tenant_id = $2', [brandProfileId, tenantId]);
        if (brandRes.rowCount === 0) {
          throw new Error(`Brand Profile dengan ID ${brandProfileId} tidak ditemukan.`);
        }
      }

      for (const row of validRows) {
        const {
          product_name, product_description, source_url,
          raw_photo_source_url, affiliate_link, page, source_row_number
        } = row;

        const normalizedUrl = source_url ? normalizeProductUrl(source_url) : null;
        const normalizedName = product_name.toLowerCase().trim();

        // Cek duplikat dalam tenant
        const dupResult = await client.query(`
          SELECT id, raw_photo_url, clean_photo_url, photo_status, enrichment_status
          FROM product_extractions
          WHERE tenant_id = $1
            AND (
              ($2 IS NOT NULL AND normalized_source_url = $2)
              OR (LOWER(TRIM(product_name)) = $3)
            )
          LIMIT 1
        `, [tenantId, normalizedUrl, normalizedName]);

        if (dupResult.rowCount > 0) {
          const dup = dupResult.rows[0];

          if (duplicateMode === 'skip_existing') {
            // Tetap re-map link ke brand profile jika modenya skip_existing tetapi link disuplai
            if (affiliate_link && brandProfileId && affiliateMode === 'brand_product') {
              const brandProductId = crypto.randomUUID();
              await client.query(`
                INSERT INTO brand_products (
                  id, tenant_id, brand_profile_id, product_id, affiliate_link, is_active, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
                ON CONFLICT (tenant_id, brand_profile_id, product_id) DO UPDATE SET
                  affiliate_link = EXCLUDED.affiliate_link,
                  is_active = TRUE,
                  updated_at = NOW()
              `, [brandProductId, tenantId, brandProfileId, dup.id, affiliate_link.trim()]);
            }
            skippedCount++;
            continue;
          }

          // update_missing: isi field yang kosong, perbarui affiliate link
          const updates = {};
          if (!dup.raw_photo_url && raw_photo_source_url) {
            updates.raw_photo_source_url = raw_photo_source_url;
            updates.photo_status = 'approved';
            updates.extraction_status = 'pending';
          }
          if (page) updates.page = page;
          if (!dup.raw_photo_url && product_description) {
            updates.product_description = product_description;
            updates.raw_description = product_description;
          }

          // Pemetaan affiliate link pada mode update
          if (affiliate_link) {
            if (brandProfileId && affiliateMode === 'brand_product') {
              const brandProductId = crypto.randomUUID();
              await client.query(`
                INSERT INTO brand_products (
                  id, tenant_id, brand_profile_id, product_id, affiliate_link, is_active, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
                ON CONFLICT (tenant_id, brand_profile_id, product_id) DO UPDATE SET
                  affiliate_link = EXCLUDED.affiliate_link,
                  is_active = TRUE,
                  updated_at = NOW()
              `, [brandProductId, tenantId, brandProfileId, dup.id, affiliate_link.trim()]);
            } else {
              updates.affiliate_link = affiliate_link.trim();
            }
          }

          if (Object.keys(updates).length > 0) {
            // Jangan timpa foto yang sudah approved
            const updateEntries = Object.entries(updates);
            const sets = updateEntries.map(([k], i) => `${k} = $${i + 3}`).join(', ');
            await client.query(
              `UPDATE product_extractions SET ${sets}, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
              [dup.id, tenantId, ...updateEntries.map(([, v]) => v)]
            );
            updatedCount++;
          } else {
            updatedCount++; // Dihitung updated karena link brand profil mungkin ter-update
          }
          continue;
        }

        // Insert produk baru — data disimpan dulu, AI dikerjakan oleh worker
        const productId = crypto.randomUUID();
        const isUrl = (source_url && source_url.startsWith('http')) ? 1 : 0;
        const legacyAffLink = (affiliate_link && (!brandProfileId || affiliateMode === 'legacy_product')) ? affiliate_link.trim() : null;

        await client.query(`
          INSERT INTO product_extractions (
            id, tenant_id, input_source, is_url, product_name, product_description, raw_description,
            source_url, normalized_source_url, scraped_image_url, raw_photo_url,
            affiliate_link, page, photo_provider,
            enrichment_status, photo_status, import_status, extraction_status,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11,
            $12, $13, $14,
            'pending', 'approved', 'completed', 'pending',
            NOW(), NOW()
          )
        `, [
          productId,
          tenantId,
          source_url || 'CSV Import',
          isUrl,
          product_name,
          product_description,
          product_description,
          source_url || null,
          normalizedUrl,
          raw_photo_source_url || null,  // scraped_image_url untuk backward compat
          null,                           // raw_photo_url diisi worker setelah download
          legacyAffLink,
          page || null,
          photoProvider !== 'system_default' ? photoProvider : null
        ]);

        // Hubungkan brand link untuk produk baru jika opsinya menyala
        if (affiliate_link && brandProfileId && affiliateMode === 'brand_product') {
          const brandProductId = crypto.randomUUID();
          await client.query(`
            INSERT INTO brand_products (
              id, tenant_id, brand_profile_id, product_id, affiliate_link, is_active, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
          `, [brandProductId, tenantId, brandProfileId, productId, affiliate_link.trim()]);
        }

        importedCount++;
      }
    });

    appendToLog(`[SUCCESS] Import selesai: ${importedCount} baru, ${updatedCount} diperbarui, ${skippedCount} dilewati. ${rowErrors.length} baris error.`, tenantId);

    return NextResponse.json({
      success: true,
      message: `Import selesai! ${importedCount} produk baru, ${updatedCount} diperbarui, ${skippedCount} dilewati.`,
      imported: importedCount,
      updated: updatedCount,
      skipped: skippedCount,
      row_errors: rowErrors
    });

  } catch (error) {
    console.error('[Products Import CSV Error]:', error);
    appendToLog(`[ERROR] Import gagal: ${error.message}`, tenantId);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
