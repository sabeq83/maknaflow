import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function POST(req, { params }) {
  try {
    const resolvedParams = await params;
    const { id: campaignId, itemId } = resolvedParams;
    const body = await req.json().catch(() => ({}));
    const step = body.step || 'visuals';

    const db = getDb();
    const item = await db.prepare("SELECT * FROM strategic_campaign_items WHERE id = ?").get(itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: 'Item tidak ditemukan' }, { status: 404 });
    }

    const campaign = await db.prepare("SELECT * FROM strategic_campaigns WHERE id = ?").get(campaignId);

    if (step === 'visuals') {
      // Selective retry for G-Labs visuals:
      // Only clear task_id for scenes that don't have a valid local clip file downloaded!
      const scenes = await db.prepare("SELECT * FROM strategic_campaign_scenes WHERE campaign_item_id = ? ORDER BY scene_number ASC").all(itemId);
      
      let resetCount = 0;
      const clearTaskStmt = await db.prepare("UPDATE strategic_campaign_scenes SET task_id = NULL WHERE id = ?");

      for (const sc of scenes) {
        let hasValidClip = false;
        if (sc.local_clip_path) {
          const absClipPath = path.join(process.cwd(), 'public', sc.local_clip_path);
          if (fs.existsSync(absClipPath)) {
            hasValidClip = true;
          }
        }

        if (!hasValidClip) {
          await clearTaskStmt.run(sc.id);
          resetCount++;
        }
      }

      await db.prepare(`
        UPDATE strategic_campaign_items 
        SET visual_status = 'pending', visual_tasks_json = '[]', error_message = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(itemId);

      if (campaign && campaign.status !== 'running') {
        await db.prepare("UPDATE strategic_campaigns SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(campaignId);
      }

      return NextResponse.json({
        success: true,
        message: `Visual G-Labs di-retry. ${resetCount} adegan yang error/belum selesai akan diproses ulang. Adegan yang sudah ada file video tetap dipertahankan.`,
        reset_scenes_count: resetCount
      });
    } else if (step === 'tts') {
      await db.prepare(`
        UPDATE strategic_campaign_items 
        SET tts_status = 'pending', error_message = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(itemId);

      if (campaign && campaign.status !== 'running') {
        await db.prepare("UPDATE strategic_campaigns SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(campaignId);
      }

      return NextResponse.json({
        success: true,
        message: 'Tahap Voiceover TTS berhasil di-retry.'
      });
    } else if (step === 'ffmpeg') {
      await db.prepare(`
        UPDATE strategic_campaign_items 
        SET ffmpeg_status = 'pending', error_message = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(itemId);

      if (campaign && campaign.status !== 'running') {
        await db.prepare("UPDATE strategic_campaigns SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(campaignId);
      }

      return NextResponse.json({
        success: true,
        message: 'Tahap Render FFmpeg berhasil di-retry.'
      });
    } else if (step === 'regenerate_start_frames') {
      await db.prepare("UPDATE strategic_campaign_scenes SET start_frame_path = NULL WHERE campaign_item_id = ?").run(itemId);

      // Run T2I Start Frame generation directly in background (DOES NOT CALL GEMINI AI / DOES NOT OVERWRITE STORYBOARD)
      import('@/lib/scheduler-processors').then(({ processStrategicStartFrames }) => {
        processStrategicStartFrames(itemId).catch(err => {
          console.error(`[Strategic Start Frame Error] Item #${itemId}:`, err.message);
        });
      });

      return NextResponse.json({
        success: true,
        message: 'Regenerate Start Frame (T2I) dipicu. Gambar Start Frame akan diproses ke Webhook G-Labs (Naskah & Storyboard tetap dipertahankan).'
      });
    } else if (step === 'generator') {
      await db.prepare(`
        UPDATE strategic_campaign_items 
        SET generation_status = 'pending', error_message = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(itemId);

      if (campaign && campaign.status !== 'running') {
        await db.prepare("UPDATE strategic_campaigns SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(campaignId);
      }

      return NextResponse.json({
        success: true,
        message: 'Tahap Storyboard & Script Generator berhasil di-retry.'
      });
    } else if (step === 'social') {
      await db.prepare(`
        UPDATE strategic_campaign_items 
        SET social_post_status = 'pending', error_message = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(itemId);

      if (campaign && campaign.status !== 'running') {
        await db.prepare("UPDATE strategic_campaigns SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(campaignId);
      }

      return NextResponse.json({
        success: true,
        message: 'Tahap Social Posting berhasil di-retry.'
      });
    }

    return NextResponse.json({ success: false, error: 'Step tidak valid' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
