import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { normalizeImportedProductImagePath, validateProductAssetEntryName } from '@/lib/product-import-archive';
import { importProducts } from '@/lib/product-repository';
import AdmZip from 'adm-zip';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const dynamic = 'force-dynamic';

const MAX_ZIP_BYTES = 100 * 1024 * 1024;
const MAX_PRODUCTS = 5000;
const MAX_ASSET_FILES = 10000;
const MAX_EXTRACTED_BYTES = 500 * 1024 * 1024;
const IMAGE_URL_KEYS = ['photo_url', 'raw_photo_url', 'clean_photo_url', 'cleaned_photo_url', 'generated_photo_url'];

function httpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function safeAssetPath(entryName) {
  try {
    return validateProductAssetEntryName(entryName);
  } catch (error) {
    throw httpError(error.message);
  }
}

function normalizeProductImagePaths(product) {
  const normalized = { ...product };
  delete normalized.tenant_id;
  delete normalized.created_at;
  for (const key of IMAGE_URL_KEYS) {
    try {
      normalized[key] = normalizeImportedProductImagePath(normalized[key]);
    } catch (error) {
      throw httpError(error.message);
    }
  }
  return normalized;
}

function stageAssets(zip) {
  const entries = zip.getEntries().filter(entry => !entry.isDirectory && entry.entryName.replace(/\\/g, '/').startsWith('assets/'));
  if (entries.length > MAX_ASSET_FILES) throw httpError(`ZIP melebihi batas ${MAX_ASSET_FILES} aset.`);
  const stagedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'makna-product-import-'));
  let extractedBytes = 0;
  const staged = [];
  try {
    for (const entry of entries) {
      const relative = safeAssetPath(entry.entryName);
      const data = entry.getData();
      extractedBytes += data.length;
      if (extractedBytes > MAX_EXTRACTED_BYTES) throw httpError('Total ukuran aset hasil ekstraksi terlalu besar.');
      const target = path.resolve(stagedRoot, relative);
      if (!target.startsWith(`${stagedRoot}${path.sep}`)) throw httpError('Path aset ZIP keluar dari staging directory.');
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, data, { flag: 'wx' });
      staged.push({ relative, source: target });
    }
    return { root: stagedRoot, files: staged };
  } catch (error) {
    fs.rmSync(stagedRoot, { recursive: true, force: true });
    throw error;
  }
}

function promoteAssets(stagedAssets) {
  const publicRoot = path.resolve(process.cwd(), 'public');
  const promoted = [];
  const warnings = [];
  try {
    for (const file of stagedAssets.files) {
      const target = path.resolve(publicRoot, file.relative);
      if (!target.startsWith(`${publicRoot}${path.sep}`)) throw httpError('Target aset keluar dari public directory.');
      if (fs.existsSync(target)) {
        warnings.push(`Aset sudah ada dan tidak ditimpa: /${file.relative}`);
        continue;
      }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.renameSync(file.source, target);
      promoted.push(target);
    }
    return { promoted, warnings };
  } catch (error) {
    for (const target of promoted.reverse()) fs.rmSync(target, { force: true });
    throw error;
  }
}

function cleanupStagedAssets(stagedAssets) {
  if (stagedAssets?.root) fs.rmSync(stagedAssets.root, { recursive: true, force: true });
}

export async function POST(req) {
  let stagedAssets;
  let promotedAssets = [];
  try {
    const user = getCurrentUser(req);
    if (!user || user.tenantId === '__none__') {
      throw httpError('Unauthorized', user ? 403 : 401);
    }
    const formData = await req.formData();
    const file = formData.get('products_file'); 
    
    if (!file) {
      return NextResponse.json({ success: false, error: 'products_file is required' }, { status: 400 });
    }

    if (typeof file.arrayBuffer !== 'function') throw httpError('products_file harus berupa ZIP.');
    if (file.size > MAX_ZIP_BYTES) throw httpError('Ukuran ZIP melebihi batas 100 MB.', 413);
    const buffer = Buffer.from(await file.arrayBuffer());
    const zip = new AdmZip(buffer);

    const jsonEntry = zip.getEntry("products_payload.json");
    if (!jsonEntry) {
      return NextResponse.json({ success: false, error: 'Invalid file format: products_payload.json not found inside ZIP.' }, { status: 400 });
    }

    let dbPayload;
    try {
      dbPayload = JSON.parse(zip.readAsText(jsonEntry));
    } catch {
      throw httpError('products_payload.json bukan JSON yang valid.');
    }
    if (!Array.isArray(dbPayload.products) || dbPayload.products.length === 0) throw httpError('Payload produk kosong.');
    if (dbPayload.products.length > MAX_PRODUCTS) throw httpError(`Payload melebihi batas ${MAX_PRODUCTS} produk.`);
    const products = dbPayload.products.map(normalizeProductImagePaths);

    stagedAssets = stageAssets(zip);
    const assetResult = promoteAssets(stagedAssets);
    promotedAssets = assetResult.promoted;
    const { importedCount, skippedCount } = await importProducts(products);

    return NextResponse.json({ 
      success: true, 
      message: `Impor selesai! ${importedCount} produk berhasil diimpor, ${skippedCount} produk dilewati (sudah ada).`,
      imported_count: importedCount,
      skipped_count: skippedCount,
      asset_count: promotedAssets.length,
      warnings: assetResult.warnings
    });

  } catch (error) {
    for (const target of promotedAssets.reverse()) fs.rmSync(target, { force: true });
    console.error('[Products Import Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: error.status || 500 });
  } finally {
    cleanupStagedAssets(stagedAssets);
  }
}
