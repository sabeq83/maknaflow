import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { deleteProduct, getProductById, updateProduct } from '@/lib/product-repository';

export const dynamic = 'force-dynamic';

function requireOperationalUser(request) {
  const user = getCurrentUser(request);
  if (!user || user.tenantId === '__none__') {
    const error = new Error('Unauthorized');
    error.status = user ? 403 : 401;
    throw error;
  }
}

export async function GET(req, { params }) {
  try {
    requireOperationalUser(req);
    const { id } = await params;
    const product = await getProductById(id);
    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }
    const urlKeys = ['photo_url', 'raw_photo_url', 'clean_photo_url', 'cleaned_photo_url', 'generated_photo_url'];
    for (const key of urlKeys) {
      if (product[key]) {
        product[key] = `/api/v2/products/image?path=${encodeURIComponent(product[key])}`;
      }
    }
    return NextResponse.json({ success: true, data: product });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status || 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    requireOperationalUser(req);
    const { id } = await params;
    const body = await req.json();
    
    // We clean/validate keys we want to allow updating
    const allowedKeys = [
      'product_name',
      'product_description',
      'unique_selling_point',
      'target_audience',
      'pain_point_solved',
      'key_visuals_extracted',
      'category',
      'tags',
      'photo_url',
      'source_url',
      'affiliate_link',
      'raw_description',
      'raw_photo_url',
      'clean_photo_url',
      'cleaned_photo_url',
      'generated_photo_url',
      'active_photo',
      'is_in_packaging',
      'packaging_type',
      'i2v_action_prompt',
      't2i_prompt',
      'product_truth',
      'geometric_truth'
    ];
    
    const updateData = {};
    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        updateData[key] = body[key];
      }
    }
    
    const updated = await updateProduct(id, updateData);
    if (!updated) return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    return NextResponse.json({ success: true, message: 'Product updated' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status || 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    requireOperationalUser(req);
    const { id } = await params;
    const deleted = await deleteProduct(id);
    if (!deleted) return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    return NextResponse.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status || 500 });
  }
}
