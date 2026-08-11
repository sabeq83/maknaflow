import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import { createProduct, listProducts, updateProduct } from '@/lib/product-repository';
import {
  parseProductMultipart,
  validateSingleProductCreate,
  validateRawProductImage
} from '@/lib/product-validation';
import { saveRawProductImage } from '@/lib/product-image-storage';
import { pgQuery } from '@/lib/db-pg';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';

    let products = await listProducts({ search, category });

    // Rewrite photo_urls: hanya proxy path lokal, jangan bungkus URL eksternal
    products = products.map(p => {
      const updated = { ...p };
      const urlKeys = ['photo_url', 'raw_photo_url', 'clean_photo_url', 'cleaned_photo_url', 'generated_photo_url'];
      for (const key of urlKeys) {
        if (updated[key] && !updated[key].startsWith('http')) {
          updated[key] = `/api/v2/products/image?path=${encodeURIComponent(updated[key])}`;
        }
      }
      return updated;
    });

    // Get active scraping jobs count (SQLite compat)
    let scrapingCount = 0;
    try {
      const db = getDb();
      const row = await db.prepare(`
        SELECT COUNT(*) as count 
        FROM scheduler_jobs 
        WHERE queue_name = 'product_scraper' AND status IN ('pending', 'running')
      `).get();
      scrapingCount = row ? row.count : 0;
    } catch (dbErr) {
      console.error('Error fetching scraping count:', dbErr.message);
    }

    return NextResponse.json({
      success: true,
      data: products,
      scraping_count: scrapingCount
    });
  } catch (error) {
    console.error('Products GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: error.status || 500 });
  }
});

export const POST = withTenantContext(async (req) => {
  try {
    const contentType = req.headers.get('content-type') || '';
    const tenantId = getActiveTenantId();

    // ----------------------------------------------------------------
    // Mode baru: multipart/form-data (UI create baru)
    // ----------------------------------------------------------------
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const parsed = parseProductMultipart(formData);
      const validated = validateSingleProductCreate(parsed);

      if (Object.keys(validated.errors).length > 0) {
        return NextResponse.json({ success: false, errors: validated.errors }, { status: 400 });
      }

      const productData = validated.data;

      // Simpan raw photo terlebih dahulu jika ada
      let rawPhotoRelPath = null;
      if (validated.rawPhoto) {
        const buffer = Buffer.from(await validated.rawPhoto.arrayBuffer());
        const imgValidation = validateRawProductImage(buffer, validated.rawPhoto.name || '');
        if (!imgValidation.valid) {
          return NextResponse.json({ success: false, error: imgValidation.error }, { status: 400 });
        }

        // Buat product ID dulu untuk path
        const { createId } = await import('crypto');
        const productId = productData.id || `pe_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        productData.id = productId;

        const saved = await saveRawProductImage({
          tenantId,
          productId,
          buffer,
          originalName: validated.rawPhoto.name || 'upload'
        });
        rawPhotoRelPath = saved.relativePath;
        productData.raw_photo_url = rawPhotoRelPath;
        productData.photo_url = rawPhotoRelPath; // compatibility pointer
        productData.raw_photo_sha256 = saved.sha256;
      }

      // packaging_status compatibility
      if (productData.packaging_status === 'packaged') {
        productData.is_in_packaging = 1;
      } else if (productData.packaging_status === 'unpackaged') {
        productData.is_in_packaging = 0;
      }

      // Status pipeline untuk produk baru (Opsi B: Generasi foto dipisah, default 'approved')
      productData.enrichment_status = 'pending';
      productData.photo_status = 'approved';
      productData.import_status = 'completed';
      productData.extraction_status = 'pending';

      const product = await createProduct(productData);

      return NextResponse.json({ success: true, id: product.id, data: product }, { status: 201 });
    }

    // ----------------------------------------------------------------
    // Mode legacy: application/json (integrasi lama, aturan foto tidak wajib)
    // ----------------------------------------------------------------
    const body = await req.json();

    if (!body.product_name) {
      return NextResponse.json({ success: false, error: 'Product Name wajib diisi.' }, { status: 400 });
    }

    const data = {
      id: body.id || undefined,
      input_source: body.source_url || 'Manual',
      is_url: body.source_url ? 1 : 0,
      product_name: body.product_name,
      product_description: body.product_description || '',
      unique_selling_point: body.unique_selling_point || '',
      target_audience: body.target_audience || '',
      pain_point_solved: body.pain_point_solved || '',
      key_visuals_extracted: JSON.stringify(body.key_visuals_extracted || []),
      raw_response: body.raw_response || 'Manual entry',
      category: body.category || null,
      tags: body.tags || null,
      photo_url: body.photo_url || null,
      source_url: body.source_url || null,
      affiliate_link: body.affiliate_link || '',
      raw_description: body.raw_description || body.product_description || '',
      raw_photo_url: body.raw_photo_url || null,
      clean_photo_url: body.clean_photo_url || null,
      // cleaned_photo_url mirrors clean untuk compatibility
      cleaned_photo_url: body.cleaned_photo_url || body.clean_photo_url || null,
      // generated_photo_url dipertahankan untuk data lama tetapi tidak ditulis untuk produk baru
      generated_photo_url: body.generated_photo_url || null,
      active_photo: body.active_photo || null,
      is_in_packaging: body.is_in_packaging ? 1 : 0,
      packaging_status: body.packaging_status || (body.is_in_packaging ? 'packaged' : 'unpackaged'),
      packaging_type: body.packaging_type || null,
      i2v_action_prompt: null,
      t2i_prompt: null,
      clean_photo_t2i_prompt: body.clean_photo_t2i_prompt || null,
      product_truth: body.product_truth || null,
      geometric_truth: body.geometric_truth || null,
      enrichment_status: 'pending',
      photo_status: 'approved',
      import_status: 'completed',
      extraction_status: 'pending'
    };

    const product = await createProduct(data);
    return NextResponse.json({ success: true, id: product.id, data: product }, { status: 201 });
  } catch (error) {
    console.error('Products POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: error.status || 500 });
  }
});
