import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getTaskStatus, getFileUrl } from '@/lib/webhook-client';
import { logToBridgeInjector } from '@/lib/bridge-injector-logger';
import fs from 'fs';
import path from 'path';

async function downloadFile(url, destPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buffer);
}

import { withTenantContext } from '@/lib/auth';

export const GET = withTenantContext(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaignId');

    if (!campaignId) {
      return NextResponse.json({ success: false, error: 'campaignId wajib disertakan.' }, { status: 400 });
    }

    const db = getDb();
    const campaign = await db.prepare('SELECT status FROM bridge_injector_campaigns WHERE id = ?').get(campaignId);

    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Kampanye tidak ditemukan.' }, { status: 404 });
    }

    const output = await db.prepare('SELECT * FROM bridge_injector_outputs WHERE campaign_id = ?').get(campaignId);
    let updated = false;
    let newStatus = campaign.status;

    // POLLING T2I (Start Frame Image)
    if (campaign.status === 'polling_t2i' && output?.clip2_t2i_task_id) {
      logToBridgeInjector(`[${campaignId}] Memeriksa status render T2I di G-Labs untuk Task ID: ${output.clip2_t2i_task_id}...`);
      const statusResult = await getTaskStatus(output.clip2_t2i_task_id);
      const taskStatus = (statusResult?.status || '').toLowerCase();

      if (taskStatus === 'completed') {
        const files = statusResult.results || statusResult.files || [];
        let imageFile = files.find(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.webp')) || files[0];

        if (imageFile) {
          if (imageFile.startsWith('http://') || imageFile.startsWith('https://')) {
            imageFile = imageFile.split('/').pop();
          }
          const downloadUrl = getFileUrl(imageFile);
          const ext = imageFile.split('.').pop() || 'png';
          
          const safeFilename = `clip2_start_frame.${ext}`;
          const localRelPath = `/uploads/bridge-injector/${campaignId}/${safeFilename}`;
          const localAbsPath = path.join(process.cwd(), 'public', 'uploads', 'bridge-injector', campaignId, safeFilename);

          logToBridgeInjector(`[${campaignId}] Task T2I selesai di G-Labs! Mengunduh berkas gambar: ${downloadUrl}`);
          await downloadFile(downloadUrl, localAbsPath);

          await db.prepare(`
            UPDATE bridge_injector_outputs 
            SET clip2_t2i_image_path = ? 
            WHERE campaign_id = ?
          `).run(localRelPath, campaignId);

          await db.prepare(`
            UPDATE bridge_injector_campaigns 
            SET status = 'waiting_user' 
            WHERE id = ?
          `).run(campaignId);

          newStatus = 'waiting_user';
          updated = true;
          logToBridgeInjector(`[${campaignId}] Gambar Start Frame sukses disimpan ke lokal: ${localRelPath}`);
        }
      } else if (taskStatus === 'failed') {
        await db.prepare("UPDATE bridge_injector_campaigns SET status = 'failed' WHERE id = ?").run(campaignId);
        newStatus = 'failed';
        updated = true;
        logToBridgeInjector(`[${campaignId}] [ERROR] Task T2I ${output.clip2_t2i_task_id} dilaporkan GAGAL oleh G-Labs.`);
      }
    }

    // POLLING I2V (Video Clip)
    if (campaign.status === 'generating_i2v' && output?.clip2_i2v_task_id) {
      logToBridgeInjector(`[${campaignId}] Memeriksa status render I2V di G-Labs untuk Task ID: ${output.clip2_i2v_task_id}...`);
      const statusResult = await getTaskStatus(output.clip2_i2v_task_id);
      const taskStatus = (statusResult?.status || '').toLowerCase();

      if (taskStatus === 'completed') {
        const files = statusResult.results || statusResult.files || [];
        let videoFile = files.find(f => f.endsWith('.mp4') || f.endsWith('.mkv')) || files[0];

        if (videoFile) {
          if (videoFile.startsWith('http://') || videoFile.startsWith('https://')) {
            videoFile = videoFile.split('/').pop();
          }
          const downloadUrl = getFileUrl(videoFile);
          
          const safeFilename = 'clip2_video.mp4';
          const localRelPath = `/uploads/bridge-injector/${campaignId}/${safeFilename}`;
          const localAbsPath = path.join(process.cwd(), 'public', 'uploads', 'bridge-injector', campaignId, safeFilename);

          logToBridgeInjector(`[${campaignId}] Task I2V selesai di G-Labs! Mengunduh berkas video: ${downloadUrl}`);
          await downloadFile(downloadUrl, localAbsPath);

          await db.prepare(`
            UPDATE bridge_injector_outputs 
            SET clip2_video_path = ? 
            WHERE campaign_id = ?
          `).run(localRelPath, campaignId);

          await db.prepare(`
            UPDATE bridge_injector_campaigns 
            SET status = 'completed' 
            WHERE id = ?
          `).run(campaignId);

          newStatus = 'completed';
          updated = true;
          logToBridgeInjector(`[${campaignId}] Video Clip sukses diunduh ke lokal: ${localRelPath}`);
          
          // [INTEGRITY CHECK] Trigger downstream sync script to rebuild dynamic scheduler bindings if needed
          try {
            const { startCampaignScheduler } = await import('@/lib/campaign-scheduler');
            startCampaignScheduler();
          } catch (schErr) {
            logToBridgeInjector(`[${campaignId}] [WARNING] Gagal memicu startCampaignScheduler: ${schErr.message}`);
          }
        }
      } else if (taskStatus === 'failed') {
        await db.prepare("UPDATE bridge_injector_campaigns SET status = 'failed' WHERE id = ?").run(campaignId);
        newStatus = 'failed';
        updated = true;
        logToBridgeInjector(`[${campaignId}] [ERROR] Task I2V ${output.clip2_i2v_task_id} dilaporkan GAGAL oleh G-Labs.`);
      }
    }

    // Ambil data terbaru jika ada pembaruan
    const finalCampaign = updated ? await db.prepare('SELECT * FROM bridge_injector_campaigns WHERE id = ?').get(campaignId) : campaign;
    const finalOutput = updated ? await db.prepare('SELECT * FROM bridge_injector_outputs WHERE campaign_id = ?').get(campaignId) : output;

    return NextResponse.json({
      success: true,
      data: {
        status: newStatus,
        campaign: finalCampaign,
        output: finalOutput
      }
    });

  } catch (error) {
    console.error('[Bridge Injector Poll GET Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
