import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { ZipArchive } from 'archiver';
import fs from 'fs';
import path from 'path';

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const campaignId = url.searchParams.get('campaignId');
    const type = url.searchParams.get('type') || 'RE'; // 'RE' atau 'OPC'

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId parameter is required' }, { status: 400 });
    }

    const db = getDb();
    let campaign = null;
    let items = [];
    let angleVariants = [];

    // 1. Ekstrak Data Berdasarkan Tipe Kampanye
    if (type === 'OPC') {
      campaign = await db.prepare("SELECT * FROM pillar_campaigns WHERE id = ?").get(campaignId);
      items = await db.prepare("SELECT * FROM pillar_campaign_items WHERE campaign_id = ?").all(campaignId);
    } else {
      // Default ke RE Campaign
      campaign = await db.prepare("SELECT * FROM re_campaigns WHERE id = ?").get(campaignId);
      items = await db.prepare("SELECT * FROM re_campaign_items WHERE campaign_id = ?").all(campaignId);
      // Query angle variants if any
      try {
        angleVariants = await db.prepare(`
          SELECT * FROM re_item_angle_variants 
          WHERE re_item_id IN (SELECT id FROM re_campaign_items WHERE campaign_id = ?)
        `).all(campaignId);
      } catch (err) {
        console.warn('[Export] Failed to query angle variants (table may not exist yet):', err.message);
      }
    }

    if (!campaign) {
      return NextResponse.json({ error: `Campaign not found for ID: ${campaignId}` }, { status: 404 });
    }

    // Ekstrak data relasi (Sama untuk OPC dan RE)
    const brandProfile = campaign.brand_profile_id 
      ? await db.prepare("SELECT * FROM brand_profiles WHERE id = ?").get(campaign.brand_profile_id) 
      : null;
    
    const product = campaign.target_product_id 
      ? await db.prepare("SELECT * FROM product_extractions WHERE id = ?").get(campaign.target_product_id) 
      : null;

    const dbPayload = {
      campaign_type: type,
      campaign,
      items,
      angleVariants,
      brandProfile,
      product
    };

    // 2. Siapkan Archiver (ZIP)
    const archive = new ZipArchive({ zlib: { level: 9 } });
      
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', 'application/zip');
    
    const sanitizedCampaignName = campaign.campaign_name.replace(/[^a-zA-Z0-9_-]/g, '_');
    responseHeaders.set('Content-Disposition', `attachment; filename="${sanitizedCampaignName}_${type}.makna"`);

    const stream = new ReadableStream({
      start(controller) {
        archive.on('data', chunk => controller.enqueue(chunk));
        archive.on('end', () => controller.close());
        archive.on('error', err => controller.error(err));
      }
    });

    // 3. Masukkan JSON Payload
    archive.append(JSON.stringify(dbPayload, null, 2), { name: 'database_payload.json' });

    // 4. Masukkan File Fisik yang Berelasi
    for (const item of items) {
      if (item.local_video_path && (item.local_video_path.startsWith('/') || item.local_video_path.startsWith('\\'))) {
        const cleanLocalPath = item.local_video_path.replace(/\\/g, '/').replace(/^\/+/, '');
        const videoFullPath = path.join(process.cwd(), 'public', cleanLocalPath);
        if (fs.existsSync(videoFullPath)) {
          archive.file(videoFullPath, { name: `assets/${cleanLocalPath}` });
        }
      }
      if (item.t2i_start_frame_path && (item.t2i_start_frame_path.startsWith('/') || item.t2i_start_frame_path.startsWith('\\'))) {
        const cleanLocalPath = item.t2i_start_frame_path.replace(/\\/g, '/').replace(/^\/+/, '');
        const startFrameFullPath = path.join(process.cwd(), 'public', cleanLocalPath);
        if (fs.existsSync(startFrameFullPath)) {
          archive.file(startFrameFullPath, { name: `assets/${cleanLocalPath}` });
        }
      }
    }

    if (campaign.product_ref_image_path && (campaign.product_ref_image_path.startsWith('/') || campaign.product_ref_image_path.startsWith('\\'))) {
      const cleanLocalPath = campaign.product_ref_image_path.replace(/\\/g, '/').replace(/^\/+/, '');
      const imgFullPath = path.join(process.cwd(), 'public', cleanLocalPath);
      if (fs.existsSync(imgFullPath)) {
        archive.file(imgFullPath, { name: `assets/${cleanLocalPath}` });
      }
    }

    if (product && product.photo_url && (product.photo_url.startsWith('/') || product.photo_url.startsWith('\\'))) {
      const cleanLocalPath = product.photo_url.replace(/\\/g, '/').replace(/^\/+/, '');
      const imgFullPath = path.join(process.cwd(), 'public', cleanLocalPath);
      if (fs.existsSync(imgFullPath)) {
        archive.file(imgFullPath, { name: `assets/${cleanLocalPath}` });
      }
    }

    archive.finalize();
    return new Response(stream, { headers: responseHeaders });

  } catch (error) {
    console.error('[Export Portability Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
