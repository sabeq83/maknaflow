import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb, updateReCampaign } from '../../../../../../lib/db';

import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (request, { params }) => {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Campaign ID is required' }, { status: 400 });
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ success: false, error: 'Content type must be multipart/form-data' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('product_media');
    const productFilenameDeclare = formData.get('product_filename_declare') || 'product_reference.png';

    if (!file || typeof file === 'string') {
      return NextResponse.json({ success: false, error: 'No image file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'products');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const ext = path.extname(file.name) || '.png';
    const filename = `product_ref_${id}_${Date.now()}${ext}`;
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, buffer);
    const productRefImagePath = `/uploads/products/${filename}`;

    const db = getDb();

    // 1. Get old image path if it exists to delete it (optional cleanup)
    const oldCampaign = await db.prepare('SELECT product_ref_image_path FROM re_campaigns WHERE id = ?').get(id);
    if (oldCampaign?.product_ref_image_path) {
      const oldAbsolutePath = path.join(process.cwd(), 'public', oldCampaign.product_ref_image_path);
      if (fs.existsSync(oldAbsolutePath)) {
        try {
          fs.unlinkSync(oldAbsolutePath);
        } catch (e) {
          console.warn(`[Replace Image] Failed to delete old image file: ${oldAbsolutePath}`, e.message);
        }
      }
    }

    // 2. Update DB
    await updateReCampaign(id, {
      product_ref_image_path: productRefImagePath,
      product_filename_declare: productFilenameDeclare
    });

    // 3. Clean up old start frames associated with this campaign
    const items = await db.prepare("SELECT id FROM re_campaign_items WHERE campaign_id = ?").all(id);
    const itemIds = items.map(item => item.id);
    const startFramesDir = path.join(process.cwd(), 'public', 'uploads', 'start_frames');

    if (fs.existsSync(startFramesDir) && itemIds.length > 0) {
      const files = fs.readdirSync(startFramesDir);
      
      // Load all associated variants
      const placeholders = itemIds.map(() => '?').join(',');
      const variants = await db.prepare(`SELECT id FROM re_item_angle_variants WHERE re_item_id IN (${placeholders})`).all(...itemIds);
      const variantIds = variants.map(v => v.id);

      for (const file of files) {
        const isItemFrame = itemIds.some(itemId => file.startsWith(`start_frame_${itemId}_`));
        const isVariantFrame = variantIds.some(vId => file.startsWith(`start_frame_variant_${vId}_`));

        if (isItemFrame || isVariantFrame) {
          try {
            fs.unlinkSync(path.join(startFramesDir, file));
            console.log(`[Replace Image Cleanup] Deleted old start frame file: ${file}`);
          } catch (e) {
            console.warn(`[Replace Image Cleanup] Failed to delete file: ${file}`, e.message);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Product image updated successfully',
      product_ref_image_path: productRefImagePath
    });

  } catch (error) {
    console.error('[Replace Image Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
