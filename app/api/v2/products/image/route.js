import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import { getProductById, updateProduct } from '@/lib/product-repository';
import { saveRawProductImage, saveCleanProductImage, validateRawProductImage } from '@/lib/product-image-storage';

export const dynamic = 'force-dynamic';

// Base dir untuk keamanan path traversal check
const BASE_PRODUCTS_DIR = path.join(process.cwd(), 'public', 'uploads', 'products');

export const GET = withTenantContext(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const relativePath = searchParams.get('path');

    if (!relativePath) {
      return NextResponse.json({ success: false, error: 'path parameter is required' }, { status: 400 });
    }

    // Tolak URL eksternal — jangan proxy URL HTTP/HTTPS
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
      return NextResponse.json({ success: false, error: 'External URLs are not proxied by this endpoint' }, { status: 400 });
    }

    // Sanitize path
    let cleanPath = relativePath.replace(/\\/g, '/').replace(/\/+/g, '/');
    if (cleanPath.startsWith('/')) cleanPath = cleanPath.slice(1);
    if (cleanPath.startsWith('public/')) cleanPath = cleanPath.slice(7);
    if (cleanPath.startsWith('uploads/products/')) cleanPath = cleanPath.slice(17);

    // Security: cek path traversal
    const resolvedPath = path.resolve(path.join(BASE_PRODUCTS_DIR, cleanPath));
    if (!resolvedPath.startsWith(BASE_PRODUCTS_DIR)) {
      return NextResponse.json({ success: false, error: 'Unauthorized path' }, { status: 403 });
    }

    if (!fs.existsSync(resolvedPath)) {
      // Fallback: transparent pixel dengan header diagnostik
      const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      return new NextResponse(pixel, {
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-cache',
          'X-Image-Missing': 'true'
        },
      });
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    const contentTypeMap = { '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
    const contentType = contentTypeMap[ext] || 'image/jpeg';

    const fileBuffer = fs.readFileSync(resolvedPath);
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('[Products Image GET Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const POST = withTenantContext(async (request) => {
  try {
    const tenantId = getActiveTenantId();
    const formData = await request.formData();
    const file = formData.get('file');
    const productId = formData.get('productId');
    const type = formData.get('type'); // 'raw' atau 'clean'

    if (!file || !productId || !type) {
      return NextResponse.json({ success: false, error: 'Missing file, productId, or type' }, { status: 400 });
    }

    // Pada pipeline baru: hanya 'raw' dan 'clean' yang valid
    // 'generated' dan 'studio' tidak lagi diterima
    const validTypes = ['raw', 'clean'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({
        success: false,
        error: `Tipe "${type}" tidak valid. Gunakan "raw" atau "clean".`
      }, { status: 400 });
    }

    // Pastikan produk ada dan milik tenant ini
    const product = await getProductById(productId);
    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validasi magic bytes
    const { valid, mimeType, error: imgError } = validateRawProductImage(buffer, file.name || '');
    if (!valid) {
      return NextResponse.json({ success: false, error: imgError }, { status: 400 });
    }

    let stored;
    const updateData = {};

    if (type === 'raw') {
      stored = await saveRawProductImage({ tenantId, productId, buffer, originalName: file.name || 'upload' });
      updateData.raw_photo_url = stored.relativePath;
      updateData.photo_url = stored.relativePath;
      updateData.raw_photo_sha256 = stored.sha256;
      // Setelah replace raw, tandai foto perlu review
      updateData.photo_status = 'needs_review';
    } else if (type === 'clean') {
      stored = await saveCleanProductImage({ tenantId, productId, buffer, mimeType });
      updateData.clean_photo_url = stored.relativePath;
      updateData.cleaned_photo_url = stored.relativePath; // mirror compatibility
      updateData.photo_url = stored.relativePath;
      updateData.photo_status = 'needs_review';
    }

    await updateProduct(productId, updateData);

    return NextResponse.json({
      success: true,
      message: 'Product image updated successfully',
      relativePath: stored.relativePath,
      type
    });
  } catch (error) {
    console.error('[Products Image POST Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
