import { NextResponse } from 'next/server';
import { getDb, updatePillarCampaignItem, updatePillarCampaign } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function PATCH(request, { params }) {
  try {
    const { itemId } = await params;
    const db = getDb();
    
    // Check if item exists
    const item = await db.prepare('SELECT * FROM pillar_campaign_items WHERE id = ?').get(itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: 'Item tidak ditemukan' }, { status: 404 });
    }

    const contentType = request.headers.get('content-type') || '';
    let creativePayload = {};
    try {
      creativePayload = item.row_creative_payload ? JSON.parse(item.row_creative_payload) : {};
    } catch (_) {}

    let fileUploaded = false;
    let localImagePath = null;
    let safeFilename = null;

    let pilar = null;
    let hook = null;
    let visualAction = null;
    let prodName = null;
    let prodDesc = null;
    let prodUsp = null;
    let prodUrl = null;
    let resetStatus = false;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      pilar = formData.get('content_pillar');
      hook = formData.get('custom_hook');
      visualAction = formData.get('visual_action_guideline');
      prodName = formData.get('product_name');
      prodDesc = formData.get('product_desc');
      prodUsp = formData.get('product_usp');
      prodUrl = formData.get('source_product_url');
      resetStatus = formData.get('reset_status') === 'true';

      const file = formData.get('product_image_file');
      if (file && typeof file !== 'string') {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'products');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const ext = path.extname(file.name) || '.png';
        safeFilename = `opc_manual_${item.campaign_id}_item${item.id}_${Date.now()}${ext}`;
        const filePath = path.join(uploadsDir, safeFilename);
        fs.writeFileSync(filePath, buffer);
        localImagePath = `/uploads/products/${safeFilename}`;
        fileUploaded = true;
      }
    } else {
      const body = await request.json();
      pilar = body.content_pillar;
      hook = body.custom_hook;
      visualAction = body.visual_action_guideline;
      prodName = body.product_name;
      prodDesc = body.product_desc;
      prodUsp = body.product_usp;
      prodUrl = body.source_product_url;
      resetStatus = body.reset_status === true;
      
      if (body.product_ref_image_path) {
        localImagePath = body.product_ref_image_path;
        fileUploaded = true;
      }
    }

    // Update payload values
    if (pilar !== null) creativePayload.content_pillar = pilar;
    if (hook !== null) creativePayload.custom_hook = hook;
    if (visualAction !== null) creativePayload.visual_action_guideline = visualAction;
    if (prodName !== null) creativePayload.product_name = prodName;
    if (prodDesc !== null) creativePayload.product_desc = prodDesc;
    if (prodUsp !== null) creativePayload.product_usp = prodUsp;
    if (prodUrl !== null) creativePayload.source_product_url = prodUrl;
    
    if (fileUploaded) {
      creativePayload.product_ref_image_path = localImagePath;
      if (safeFilename) {
        creativePayload.product_filename_declare = safeFilename;
      }
    }

    const updateFields = {
      row_creative_payload: JSON.stringify(creativePayload)
    };

    if (resetStatus) {
      // Determine next status: if URL is present but product details are missing, run sourcing again.
      let nextStatus = 'pending';
      if (creativePayload.source_product_url && creativePayload.source_product_url.trim() !== '') {
        if (!creativePayload.product_name || creativePayload.product_name.trim() === '' || !creativePayload.product_ref_image_path) {
          nextStatus = 'pending_sourcing';
        }
      }
      // Reset pipeline status flags
      updateFields.generation_status = nextStatus;
      updateFields.result_json = null;
      updateFields.tts_status = 'pending';
      updateFields.tts_batch_id = null;
      updateFields.visual_status = 'pending';
      updateFields.visual_tasks_json = '[]';
      updateFields.visual_clip_paths = null;
      updateFields.ffmpeg_status = 'pending';
      updateFields.ffmpeg_output_path = null;
      updateFields.upload_status = 'pending';
      updateFields.drive_link = null;
      updateFields.social_post_status = 'pending';
      updateFields.social_links_json = null;
      updateFields.retry_count = 0;
    }

    await updatePillarCampaignItem(itemId, updateFields);

    // Make sure campaign status is 'running' if it's currently paused and we did a reset
    if (resetStatus) {
      const campaign = await db.prepare('SELECT * FROM pillar_campaigns WHERE id = ?').get(item.campaign_id);
      if (campaign && campaign.status !== 'running') {
        await updatePillarCampaign(item.campaign_id, { status: 'running' });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Creative payload berhasil diperbarui' + (resetStatus ? ' dan status di-reset ke pending.' : '.'),
      data: {
        row_creative_payload: creativePayload
      }
    });
  } catch (error) {
    console.error('[API Update Creative] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
