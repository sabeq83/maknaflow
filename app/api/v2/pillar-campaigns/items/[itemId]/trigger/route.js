import { NextResponse } from 'next/server';
import { getDb, updatePillarCampaignItem, updatePillarCampaign } from '@/lib/db';

import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (request, { params }) => {
  try {
    const { itemId } = await params;
    const { step } = await request.json(); // 'generate', 'tts', 'tts_remux', 'visuals', 'ffmpeg', 'social'

    if (!['generate', 'tts', 'tts_remux', 'visuals', 'ffmpeg', 'social'].includes(step)) {
      return NextResponse.json({ success: false, error: 'Step tidak valid' }, { status: 400 });
    }

    const db = getDb();
    const item = await db.prepare('SELECT * FROM pillar_campaign_items WHERE id = ?').get(itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: 'Item tidak ditemukan' }, { status: 404 });
    }

    const updateFields = {};

    if (step === 'generate') {
      let nextStatus = 'pending';
      try {
        if (item.row_creative_payload) {
          const payload = JSON.parse(item.row_creative_payload);
          if (payload.source_product_url && payload.source_product_url.trim() !== '') {
            nextStatus = 'pending_sourcing';
          }
        }
      } catch (_) {}

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
    } else if (step === 'tts_remux') {
      let visualPaths = [];
      try { visualPaths = JSON.parse(item.visual_clip_paths || '[]'); } catch (_) {}
      if (item.visual_status !== 'completed' || !Array.isArray(visualPaths) || visualPaths.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Video G-Labs belum lengkap. TTS & Re-mux hanya dapat dijalankan jika visual berstatus completed.'
        }, { status: 409 });
      }
      updateFields.workflow_status = 'production_processing';
      updateFields.tts_status = 'pending';
      updateFields.tts_batch_id = null;
      // visual_status, visual_tasks_json, dan visual_clip_paths sengaja dipertahankan.
      updateFields.ffmpeg_status = 'pending';
      updateFields.ffmpeg_output_path = null;
      updateFields.upload_status = 'pending';
      updateFields.drive_link = null;
      updateFields.social_post_status = 'pending';
      updateFields.social_links_json = null;
    } else if (step === 'tts') {
      updateFields.tts_status = 'pending';
      updateFields.tts_batch_id = null;
      updateFields.visual_status = 'pending';
      updateFields.visual_clip_paths = null;
      updateFields.ffmpeg_status = 'pending';
      updateFields.ffmpeg_output_path = null;
      updateFields.upload_status = 'pending';
      updateFields.drive_link = null;
      updateFields.social_post_status = 'pending';
      updateFields.social_links_json = null;
    } else if (step === 'visuals') {
      updateFields.visual_status = 'pending';
      updateFields.visual_clip_paths = null;
    } else if (step === 'ffmpeg') {
      updateFields.ffmpeg_status = 'pending';
      updateFields.ffmpeg_output_path = null;
      updateFields.upload_status = 'pending';
      updateFields.drive_link = null;
      updateFields.social_post_status = 'pending';
      updateFields.social_links_json = null;
    } else if (step === 'social') {
      updateFields.social_post_status = 'pending';
      updateFields.social_links_json = null;
    }

    // Reset retry count on manual trigger
    updateFields.retry_count = 0;

    // Update item status in DB
    await updatePillarCampaignItem(itemId, updateFields);

    // Make sure the campaign status is 'running' so the scheduler doesn't skip it
    const campaign = await db.prepare('SELECT * FROM pillar_campaigns WHERE id = ?').get(item.campaign_id);
    if (campaign && campaign.status !== 'running') {
      await updatePillarCampaign(item.campaign_id, { status: 'running' });
    }

    return NextResponse.json({
      success: true,
      message: step === 'tts_remux'
        ? `TTS baru dan re-mux dijadwalkan untuk item #${itemId}. Video G-Labs tetap dipertahankan.`
        : `Berhasil memicu kembali langkah ${step.toUpperCase()} untuk item #${itemId}. Scheduler akan segera memproses.`
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
