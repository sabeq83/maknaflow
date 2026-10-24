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

      // Bersihkan file fisik start frame lama di disk jika ada
      try {
        const { unlinkSync, existsSync } = await import('fs');
        const path = await import('path');
        const oldImages = [];
        if (item.t2i_images_json) {
          try {
            const parsed = JSON.parse(item.t2i_images_json);
            if (Array.isArray(parsed)) oldImages.push(...parsed);
          } catch (_) {}
        }
        if (item.t2i_start_frame_path) oldImages.push(item.t2i_start_frame_path);

        for (const imgPath of oldImages) {
          if (typeof imgPath === 'string' && imgPath.includes('/uploads/start_frames/')) {
            const rel = imgPath.startsWith('/') ? imgPath.slice(1) : imgPath;
            const fullPath = path.join(process.cwd(), 'public', rel);
            if (existsSync(fullPath)) {
              unlinkSync(fullPath);
            }
          }
        }
      } catch (err) {
        console.warn(`[Trigger Route] Non-fatal cleanup error for item #${itemId}:`, err.message);
      }

      // Bersihkan record asset start frame di database PostgreSQL
      try {
        const { pgQuery } = await import('@/lib/db-pg');
        await pgQuery(
          'DELETE FROM pillar_campaign_item_assets WHERE campaign_item_id = $1 AND asset_type = $2',
          [String(itemId), 'start_frame']
        );
      } catch (err) {
        console.warn(`[Trigger Route] Failed to clean start_frame assets for item #${itemId}:`, err.message);
      }

      updateFields.generation_status = nextStatus;
      updateFields.result_json = null;
      updateFields.new_video_plan_json = null;
      updateFields.video_dna_json = null;
      updateFields.recipe_data_json = null;
      updateFields.recipe_revision = null;

      // Reset Start Frame
      updateFields.t2i_start_frame_path = null;
      updateFields.t2i_images_json = null;
      updateFields.start_frame_status = 'pending';
      updateFields.start_frame_completed_count = 0;
      updateFields.start_frame_expected_count = 0;
      updateFields.regenerate_start_frames_status = null;
      updateFields.regenerate_start_frames_progress = null;

      // Reset Review / Approval Checkpoint
      updateFields.review_revision = null;
      updateFields.approved_revision = null;
      updateFields.approved_at = null;
      updateFields.approved_by = null;
      updateFields.review_state = 'pending_review';
      updateFields.review_reason = null;
      updateFields.review_actor_id = null;
      updateFields.review_state_updated_at = null;

      // Reset Downstream Production Pipeline
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
      updateFields.workflow_status = 'creative_processing';
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

    // Reset workflow status jika sebelumnya sudah completed
    if (item.workflow_status === 'completed' && !updateFields.workflow_status) {
      updateFields.workflow_status = 'production_processing';
    }

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
