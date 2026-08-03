import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { createProduct, listProducts } from '@/lib/product-repository';

export const dynamic = 'force-dynamic';

function requireOperationalUser(request) {
  const user = getCurrentUser(request);
  if (!user || user.tenantId === '__none__') {
    const error = new Error('Unauthorized');
    error.status = user ? 403 : 401;
    throw error;
  }
  return user;
}

export async function GET(request) {
  try {
    requireOperationalUser(request);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';

    // Fetch all products
    let products = await listProducts({ search, category });

    // Rewrite photo_urls to serve dynamically via API route to bypass Next.js static caching
    products = products.map(p => {
      const updated = { ...p };
      const urlKeys = ['photo_url', 'raw_photo_url', 'clean_photo_url', 'cleaned_photo_url', 'generated_photo_url'];
      for (const key of urlKeys) {
        if (updated[key]) {
          updated[key] = `/api/v2/products/image?path=${encodeURIComponent(updated[key])}`;
        }
      }
      return updated;
    });

    // Get active scraping jobs count
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
}

export async function POST(req) {
  try {
    requireOperationalUser(req);
    const body = await req.json();

    if (!body.product_name) {
      return NextResponse.json({ success: false, error: 'Product Name wajib diisi.' }, { status: 400 });
    }

    const data = {
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
      cleaned_photo_url: body.cleaned_photo_url || body.clean_photo_url || null,
      generated_photo_url: body.generated_photo_url || null,
      active_photo: body.active_photo || 'generated_photo_url',
      is_in_packaging: body.is_in_packaging ? 1 : 0,
      packaging_type: body.packaging_type || null,
      i2v_action_prompt: body.i2v_action_prompt || null,
      t2i_prompt: body.t2i_prompt || null
    };

    const product = await createProduct(data);

    return NextResponse.json({ success: true, id: product.id, data: product }, { status: 201 });
  } catch (error) {
    console.error('Products POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: error.status || 500 });
  }
}
