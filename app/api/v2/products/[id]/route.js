import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import { deleteProduct, getProductById, updateProduct } from '@/lib/product-repository';
import { validateSingleProductUpdate, validateRawProductImage } from '@/lib/product-validation';
import { saveRawProductImage } from '@/lib/product-image-storage';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, { params }) => {
  try {
    const { id } = await params;
    const product = await getProductById(id);
    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }
    // Hanya proxy path lokal; jangan bungkus URL eksternal
    const urlKeys = ['photo_url', 'raw_photo_url', 'clean_photo_url', 'cleaned_photo_url', 'generated_photo_url'];
    for (const key of urlKeys) {
      if (product[key] && !product[key].startsWith('http')) {
        product[key] = `/api/v2/products/image?path=${encodeURIComponent(product[key])}`;
      }
    }
    return NextResponse.json({ success: true, data: product });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status || 500 });
  }
});

export const PUT = withTenantContext(async (req, { params }) => {
  try {
    const { id } = await params;
    const tenantId = getActiveTenantId();
    const contentType = req.headers.get('content-type') || '';

    // Pastikan produk ada dan milik tenant ini
    const existing = await getProductById(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    // ----------------------------------------------------------------
    // Mode multipart (UI edit dengan atau tanpa replace raw photo)
    // ----------------------------------------------------------------
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const productJson = formData.get('product');
      const rawPhotoFile = formData.get('raw_photo');
      const regenerate = formData.get('regenerate') === 'true';

      if (!productJson) {
        return NextResponse.json({ success: false, error: 'Field "product" wajib ada' }, { status: 400 });
      }

      let productInput;
      try {
        productInput = JSON.parse(productJson);
      } catch {
        return NextResponse.json({ success: false, error: 'Field "product" bukan JSON valid' }, { status: 400 });
      }

      const validated = validateSingleProductUpdate({ product: productInput, rawPhoto: rawPhotoFile, regenerate });

      if (Object.keys(validated.errors).length > 0) {
        return NextResponse.json({ success: false, errors: validated.errors }, { status: 400 });
      }

      const updateData = { ...validated.data };

      // Replace raw photo jika ada file baru
      if (validated.rawPhoto) {
        const buffer = Buffer.from(await validated.rawPhoto.arrayBuffer());
        const imgValidation = validateRawProductImage(buffer, validated.rawPhoto.name || '');
        if (!imgValidation.valid) {
          return NextResponse.json({ success: false, error: imgValidation.error }, { status: 400 });
        }
        const saved = await saveRawProductImage({
          tenantId,
          productId: id,
          buffer,
          originalName: validated.rawPhoto.name || 'upload'
        });
        updateData.raw_photo_url = saved.relativePath;
        updateData.photo_url = saved.relativePath;
        updateData.raw_photo_sha256 = saved.sha256;
      }

      // Tandai stale jika identity fields berubah atau regenerate diminta
      const identityChanged = (
        (updateData.product_name && updateData.product_name !== existing.product_name) ||
        (updateData.product_description && updateData.product_description !== existing.product_description) ||
        validated.rawPhoto !== null
      );

      if (regenerate || identityChanged) {
        if (regenerate) {
          // User eksplisit minta regenerate: queue foto baru
          updateData.enrichment_status = 'pending';
          updateData.photo_status = 'pending';
          updateData.extraction_status = 'pending';
        } else {
          // Identity berubah tapi tidak minta regenerate: tandai needs_review
          updateData.enrichment_status = 'needs_review';
          // Jangan otomatis menghapus clean photo lama
        }
      }

      // packaging_status compatibility
      if (updateData.packaging_status === 'packaged') {
        updateData.is_in_packaging = 1;
      } else if (updateData.packaging_status === 'unpackaged') {
        updateData.is_in_packaging = 0;
      }

      // Pastikan allowlist field yang boleh diupdate
      const ALLOWED_UPDATE_FIELDS = new Set([
        'product_name', 'product_description', 'raw_description',
        'unique_selling_point', 'target_audience', 'pain_point_solved',
        'category', 'tags', 'source_url', 'affiliate_link',
        'raw_photo_url', 'raw_photo_sha256', 'photo_url',
        'clean_photo_url', 'cleaned_photo_url',
        'is_in_packaging', 'packaging_status', 'packaging_type', 'packaging_notes',
        'i2v_action_prompt', 't2i_prompt', 'clean_photo_t2i_prompt',
        'product_truth', 'geometric_truth', 'photo_provider',
        'enrichment_status', 'photo_status', 'extraction_status',
        'enrichment_error', 'photo_error', 'page'
      ]);

      const filteredUpdate = {};
      for (const [k, v] of Object.entries(updateData)) {
        if (ALLOWED_UPDATE_FIELDS.has(k)) filteredUpdate[k] = v;
      }

      const updated = await updateProduct(id, filteredUpdate);
      if (!updated) {
        return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: 'Product updated', data: updated });
    }

    // ----------------------------------------------------------------
    // Mode JSON (update ringan atau integrasi legacy)
    // ----------------------------------------------------------------
    const body = await req.json();

    const allowedKeys = [
      'product_name', 'product_description', 'unique_selling_point',
      'target_audience', 'pain_point_solved', 'key_visuals_extracted',
      'category', 'tags', 'photo_url', 'source_url', 'affiliate_link',
      'raw_description', 'raw_photo_url', 'clean_photo_url', 'cleaned_photo_url',
      'generated_photo_url', 'active_photo', 'is_in_packaging', 'packaging_status',
      'packaging_type', 'packaging_notes', 'i2v_action_prompt', 't2i_prompt',
      'clean_photo_t2i_prompt', 'product_truth', 'geometric_truth',
      'enrichment_status', 'photo_status', 'photo_provider', 'photo_task_id',
      'enrichment_error', 'photo_error', 'page'
    ];

    const updateData = {};
    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        updateData[key] = body[key];
      }
    }

    // packaging compatibility
    if (updateData.packaging_status === 'packaged') updateData.is_in_packaging = 1;
    else if (updateData.packaging_status === 'unpackaged') updateData.is_in_packaging = 0;

    const updated = await updateProduct(id, updateData);
    if (!updated) return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    return NextResponse.json({ success: true, message: 'Product updated' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status || 500 });
  }
});

export const DELETE = withTenantContext(async (req, { params }) => {
  try {
    const { id } = await params;
    const deleted = await deleteProduct(id);
    if (!deleted) return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    return NextResponse.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status || 500 });
  }
});
