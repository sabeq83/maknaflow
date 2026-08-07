import { NextResponse } from 'next/server';
import { getDb, updateReCampaignItem, updateReCampaign } from '@/lib/db';

import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (request, { params }) => {
  try {
    const { itemId } = await params;
    const { step } = await request.json(); // 'generate', 'tts', 'visuals', 'ffmpeg', 'social'

    if (!['generate', 'tts', 'visuals', 'ffmpeg', 'social'].includes(step)) {
      return NextResponse.json({ success: false, error: 'Step tidak valid' }, { status: 400 });
    }

    const db = getDb();
    const item = await db.prepare('SELECT * FROM re_campaign_items WHERE id = ?').get(itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: 'Item tidak ditemukan' }, { status: 404 });
    }

    const updateFields = {};

    if (step === 'generate') {
      updateFields.scrape_status = 'downloaded'; // Keep reference video downloaded
      updateFields.analyze_status = 'pending';
      updateFields.result_json = null;
      updateFields.original_deconstruction_json = null;
      updateFields.new_video_plan_json = null;
      updateFields.video_dna_json = null;
      updateFields.t2i_images_json = null;
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
      updateFields.workflow_status = 'pending';
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
      updateFields.workflow_status = 'pending';
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
    if (item.workflow_status === 'completed') {
      updateFields.workflow_status = 'pending';
    }

    // Update item status in DB
    await updateReCampaignItem(itemId, updateFields);

    // Make sure the campaign status is 'running' so the scheduler doesn't skip it
    const campaign = await db.prepare('SELECT * FROM re_campaigns WHERE id = ?').get(item.campaign_id);
    if (campaign && campaign.status !== 'running') {
      await updateReCampaign(item.campaign_id, { status: 'running' });
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil memicu kembali langkah ${step.toUpperCase()} untuk item #${itemId}. Scheduler akan segera memproses.`
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
