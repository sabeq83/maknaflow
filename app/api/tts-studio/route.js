import { NextResponse } from 'next/server';
import { createTtsBatch, createTtsClip, updateTtsClip } from '@/lib/db';
import { generateMinimaxVO } from '@/lib/minimax-tts';
import { callGeminiTtsApi } from '@/lib/gemini';
import { convertPcmToWav } from '@/lib/audio-helper';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { source_type, source_ref_id, provider_active, voice_persona, speed, volume, clips, batch_id, regenerate_clip_index, gemini_8s, tts_model_quality } = await req.json();

    const tempDir = path.join(process.cwd(), 'public', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // ===== PATH A: Single Clip Regeneration =====
    if (batch_id && regenerate_clip_index !== undefined) {
      const i = Number(regenerate_clip_index);
      const text = clips[0]; // The text of the clip to regenerate
      const ext = provider_active === 'minimax' ? 'mp3' : 'wav';
      const outputFileName = `tts_studio_${batch_id}_clip_${i}.${ext}`;
      const localPath = path.join(tempDir, outputFileName);
      const publicPath = `/temp/${outputFileName}`;

      const clipId = `ttsc_${Date.now()}_${i}`;

      // Update status to processing
      // We will delete the old clip index record and insert a new one, or just update the existing one.
      // Let's perform an UPDATE on the clip if it exists, or insert it.
      const { getDb } = await import('@/lib/db');
      const db = getDb();
      const existing = await db.prepare('SELECT id FROM tts_studio_clips WHERE batch_id = ? AND clip_index = ?').get(batch_id, i);

      let finalClipId = clipId;
      if (existing) {
        finalClipId = existing.id;
        await db.prepare('UPDATE tts_studio_clips SET status = "processing", audio_path = ? WHERE id = ?').run(publicPath, finalClipId);
      } else {
        await createTtsClip({
          id: clipId,
          batch_id: batchId,
          clip_index: i,
          source_text: text,
          audio_path: publicPath,
          status: 'processing'
        });
      }

      // Retrieve model quality from the batch record if not provided directly
      let modelQuality = tts_model_quality;
      if (!modelQuality && batch_id) {
        const { getDb } = await import('@/lib/db');
        const db = getDb();
        const batchRecord = await db.prepare('SELECT tts_model_quality FROM tts_studio_batches WHERE id = ?').get(batch_id);
        if (batchRecord) {
          modelQuality = batchRecord.tts_model_quality;
        }
      }
      if (!modelQuality) {
        modelQuality = 'speech-2.8-turbo';
      }

      try {
        if (provider_active === 'minimax') {
          await generateMinimaxVO(text, voice_persona, localPath, { speed, volume, model: modelQuality });
        } else if (provider_active === 'gemini' && gemini_8s) {
          const { generateGeminiExact8sAudio } = await import('@/lib/gemini-8s-tts');
          await generateGeminiExact8sAudio(text, voice_persona, localPath);
        } else {
          const rawPcm = await callGeminiTtsApi(text, voice_persona, { speed, volume });
          const wavBuffer = convertPcmToWav(rawPcm, 24000);
          fs.writeFileSync(localPath, wavBuffer);
        }

        await updateTtsClip(finalClipId, { status: 'completed' });
        return NextResponse.json({
          success: true,
          clip: {
            id: finalClipId,
            clip_index: i,
            source_text: text,
            audio_path: publicPath,
            status: 'completed'
          }
        });
      } catch (err) {
        console.error(`Gagal melakukan regenerasi pada klip ke-${i} di batch ${batch_id}:`, err);
        await updateTtsClip(finalClipId, { status: 'failed' });
        return NextResponse.json({
          success: false,
          error: err.message,
          clip: {
            id: finalClipId,
            clip_index: i,
            source_text: text,
            audio_path: publicPath,
            status: 'failed'
          }
        }, { status: 500 });
      }
    }

    // ===== PATH B: Standard Batch Synthesis =====
    if (!clips || !Array.isArray(clips) || clips.length === 0) {
      return NextResponse.json({ success: false, error: 'Input clips wajib dikirim dalam format array' }, { status: 400 });
    }

    const batchId = `ttsb_${Date.now()}`;
    
    // 1. Save main batch record
    await createTtsBatch({
      id: batchId,
      source_type: source_type || 'manual',
      source_ref_id: source_ref_id || null,
      provider_active: provider_active || 'gemini',
      voice_persona: voice_persona,
      config_speed: speed !== undefined ? Number(speed) : 1.0,
      config_volume: volume !== undefined ? Number(volume) : 1.0,
      tts_model_quality: tts_model_quality || 'speech-2.8-turbo'
    });

    const generatedClips = [];

    // 2. Sequential processing per clip
    for (let i = 0; i < clips.length; i++) {
      const clipId = `ttsc_${Date.now()}_${i}`;
      const text = clips[i];
      const ext = provider_active === 'minimax' ? 'mp3' : 'wav';
      const outputFileName = `tts_studio_${batchId}_clip_${i}.${ext}`;
      const localPath = path.join(tempDir, outputFileName);
      const publicPath = `/temp/${outputFileName}`;

      // Insert pending/processing clip
      await createTtsClip({
        id: clipId,
        batch_id: batchId,
        clip_index: i,
        source_text: text,
        audio_path: publicPath,
        status: 'processing'
      });

      try {
        if (provider_active === 'minimax') {
          await generateMinimaxVO(text, voice_persona, localPath, { speed, volume, model: tts_model_quality || 'speech-2.8-turbo' });
        } else if (provider_active === 'gemini' && gemini_8s) {
          const { generateGeminiExact8sAudio } = await import('@/lib/gemini-8s-tts');
          await generateGeminiExact8sAudio(text, voice_persona, localPath);
        } else {
          // Gemini: call and convert PCM to WAV
          const rawPcm = await callGeminiTtsApi(text, voice_persona, { speed, volume });
          const wavBuffer = convertPcmToWav(rawPcm, 24000);
          fs.writeFileSync(localPath, wavBuffer);
        }

        // Mark as completed
        await updateTtsClip(clipId, { status: 'completed' });
        generatedClips.push({
          id: clipId,
          clip_index: i,
          source_text: text,
          audio_path: publicPath,
          status: 'completed'
        });
      } catch (err) {
        console.error(`Gagal melakukan TTS pada klip ke-${i} di batch ${batchId}:`, err);
        await updateTtsClip(clipId, { status: 'failed' });
        generatedClips.push({
          id: clipId,
          clip_index: i,
          source_text: text,
          audio_path: publicPath,
          status: 'failed',
          error: err.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      batchId,
      clips: generatedClips
    });

  } catch (error) {
    console.error('Error handling TTS Studio POST:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
