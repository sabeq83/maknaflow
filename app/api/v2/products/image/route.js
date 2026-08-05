import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { updateProductExtraction } from '@/lib/db';
import { withTenantContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const relativePath = searchParams.get('path');

    if (!relativePath) {
      return NextResponse.json({ success: false, error: 'path parameter is required' }, { status: 400 });
    }

    // 1. Resolve base directory
    const baseDir = path.join(process.cwd(), 'public', 'uploads', 'products');

    // 2. Sanitize input path to prevent directory traversal
    // Convert backslashes to forward slashes and replace duplicate slashes
    let cleanPath = relativePath.replace(/\\/g, '/');
    cleanPath = cleanPath.replace(/\/+/g, '/');

    // Strip leading slash if present
    if (cleanPath.startsWith('/')) {
      cleanPath = cleanPath.slice(1);
    }

    // Strip prefixes like "public/" or "uploads/products/"
    if (cleanPath.startsWith('public/')) {
      cleanPath = cleanPath.slice(7);
    }
    if (cleanPath.startsWith('uploads/products/')) {
      cleanPath = cleanPath.slice(17);
    }

    // Protect against path traversal (e.g. ".." patterns)
    const resolvedPath = path.resolve(path.join(baseDir, cleanPath));

    // Security check: ensure the resolved path starts with baseDir
    if (!resolvedPath.startsWith(baseDir)) {
      return NextResponse.json({ success: false, error: 'Unauthorized path traversal access' }, { status: 403 });
    }

    // 3. Check if file exists on disk
    if (!fs.existsSync(resolvedPath)) {
      // Fallback: serve a 1x1 transparent GIF pixel
      const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      return new NextResponse(pixel, {
        headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'public, max-age=3600' },
      });
    }

    // 4. Determine content-type based on extension
    const ext = path.extname(resolvedPath).toLowerCase();
    let contentType = 'image/jpeg';
    if (ext === '.png') {
      contentType = 'image/png';
    } else if (ext === '.gif') {
      contentType = 'image/gif';
    } else if (ext === '.webp') {
      contentType = 'image/webp';
    } else if (ext === '.svg') {
      contentType = 'image/svg+xml';
    }

    // 5. Read file and serve
    const fileBuffer = fs.readFileSync(resolvedPath);
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // cache for 1 day
      },
    });
  } catch (error) {
    console.error('[Products Image API Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const POST = withTenantContext(async (request) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const productId = formData.get('productId');
    const type = formData.get('type'); // 'raw', 'cleaned', 'generated'

    if (!file || !productId || !type) {
      return NextResponse.json({ success: false, error: 'Missing file, productId, or type' }, { status: 400 });
    }

    // Validate type
    const validTypes = ['raw', 'cleaned', 'generated'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ success: false, error: 'Invalid type parameter' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save to disk
    const typeSubdir = type === 'cleaned' ? 'clean' : type;
    const targetDir = path.join(process.cwd(), 'public', 'uploads', 'products', typeSubdir);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    let ext = path.extname(file.name || '').toLowerCase();
    if (!ext) ext = '.png'; // default fallback
    const filename = `${type}_${productId}_${Date.now()}${ext}`;
    const absolutePath = path.join(targetDir, filename);

    fs.writeFileSync(absolutePath, buffer);

    const relativePath = `/uploads/products/${typeSubdir}/${filename}`;

    // Update SQLite database fields
    const updateData = {};
    if (type === 'raw') {
      updateData.raw_photo_url = relativePath;
      updateData.photo_url = relativePath;
      updateData.active_photo = 'raw_photo_url';
    } else if (type === 'cleaned') {
      updateData.clean_photo_url = relativePath;
      updateData.cleaned_photo_url = relativePath;
      updateData.photo_url = relativePath;
      updateData.active_photo = 'cleaned_photo_url';
    } else if (type === 'generated') {
      updateData.generated_photo_url = relativePath;
      updateData.photo_url = relativePath;
      updateData.active_photo = 'generated_photo_url';
    }

    await updateProductExtraction(productId, updateData);

    return NextResponse.json({ 
      success: true, 
      message: 'Product image updated successfully',
      relativePath 
    });
  } catch (error) {
    console.error('[Products Image API POST Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

