import { pgQuery } from './db-pg.js';

/**
 * Resolves real-time engine state, step details, and campaign deep links
 * for content studio slots currently in production or review.
 *
 * @param {Object} slot Slot row object from content_studio_slots
 * @param {string} [tenantId] Active tenant ID
 * @returns {Promise<Object|null>}
 */
export async function resolveLiveEngineState(slot, tenantId = 'default_tenant') {
  if (!slot || !slot.source_campaign_id) return null;
  const kind = slot.batch_engine_kind || slot.source_kind;

  let live = {
    kind: kind || 'unknown',
    campaign_id: slot.source_campaign_id,
    campaign_url: '#',
    engine_status: 'processing',
    sub_status_label: '⚙️ Sedang Diproses',
    step_index: 3,
    progress_percent: slot.progress_percent || 0,
    elapsed_text: '',
    worker_id: slot.worker_id || 'studio-worker',
    details: 'AI Engine sedang memproses pembuatan konten.'
  };

  // Calculate elapsed time
  if (slot.dispatched_at) {
    const elapsedMs = Date.now() - new Date(slot.dispatched_at).getTime();
    const mins = Math.floor(elapsedMs / 60000);
    live.elapsed_text = mins > 0 ? `${mins}m yang lalu` : 'Baru saja';
  }

  try {
    if (kind === 'multiplier') {
      live.campaign_url = `/multiplier-lab/${slot.source_campaign_id}`;
      const res = await pgQuery(
        `SELECT id, status, error_message, ffmpeg_output_path
         FROM re_multiplier_tasks
         WHERE batch_id = $1
         LIMIT 1`,
        [slot.source_campaign_id]
      );
      const task = res.rows[0];
      if (task) {
        live.engine_status = task.status || 'processing';
        if (task.status === 'waiting_approval') {
          live.sub_status_label = '⏳ Menunggu Approval Storyboard';
          live.step_index = 3;
          live.details = 'Naskah AI Voiceover & 10 Parameter DNA video telah digenerate. Menunggu konfirmasi sebelum klip dirender.';
        } else if (task.status === 'generating') {
          live.sub_status_label = '⚡ Generating Script & Parameter';
          live.step_index = 3;
          live.details = 'Gemini AI sedang menyusun naskah dan parameter visual.';
        } else if (task.status === 'rendering') {
          live.sub_status_label = '🎬 Rendering Klip Video G-Labs';
          live.step_index = 4;
          live.details = 'Klip video sedang diproses oleh worker rendering Node 2.';
        } else if (task.status === 'completed') {
          live.sub_status_label = '✓ Video Selesai Dirender';
          live.step_index = 5;
          live.details = 'Aset video siap untuk ditinjau dan dijadwalkan.';
        } else if (task.status === 'failed') {
          live.sub_status_label = '❌ Produksi Gagal';
          live.step_index = 3;
          live.details = task.error_message || 'Terjadi kesalahan saat pemrosesan engine Multiplier.';
        }
      }
    } else if (kind === 'recipe') {
      live.campaign_url = `/recipe-labs?campaign_id=${slot.source_campaign_id}`;
      const res = await pgQuery(
        `SELECT id, status, error_message, ffmpeg_output_path
         FROM recipe_items
         WHERE campaign_id = $1
         LIMIT 1`,
        [slot.source_campaign_id]
      );
      const item = res.rows[0];
      if (item) {
        live.engine_status = item.status || 'processing';
        if (item.status === 'tts_processing') {
          live.sub_status_label = '🎙️ Merender Audio Voiceover TTS';
          live.step_index = 4;
          live.details = 'Sintesis suara naskah resep menggunakan ElevenLabs sedang berjalan.';
        } else if (item.status === 'completed') {
          live.sub_status_label = '✓ Resep & Video Selesai';
          live.step_index = 5;
          live.details = 'Resep dan media telah siap.';
        } else if (item.status === 'failed') {
          live.sub_status_label = '❌ Produksi Gagal';
          live.step_index = 3;
          live.details = item.error_message || 'Gagal dalam pemrosesan resep.';
        } else {
          live.sub_status_label = `⚡ ${item.status || 'Memproses Resep'}`;
          live.step_index = 3;
          live.details = 'AI sedang menganalisis bahan dan langkah memasak.';
        }
      }
    } else if (kind === 're') {
      live.campaign_url = `/re-campaigns/${slot.source_campaign_id}`;
      const res = await pgQuery(
        `SELECT id, analyze_status, tts_status, visual_status, ffmpeg_status, error_message
         FROM re_campaign_items
         WHERE campaign_id = $1
         LIMIT 1`,
        [slot.source_campaign_id]
      );
      const item = res.rows[0];
      if (item) {
        const subStatus = item.ffmpeg_status || item.visual_status || item.tts_status || item.analyze_status || 'processing';
        live.engine_status = subStatus;
        if (subStatus === 'processing' || item.analyze_status === 'processing') {
          live.sub_status_label = '📐 Menganalisis Varian Sudut Properti';
          live.step_index = 3;
          live.details = 'AI Vision sedang mengidentifikasi sudut arsitektur terbaik dari foto aset referensi.';
        } else if (item.tts_status === 'processing') {
          live.sub_status_label = '🎙️ Merender Voiceover RE';
          live.step_index = 4;
          live.details = 'Sintesis audio deskripsi properti sedang berlangsung.';
        } else if (item.ffmpeg_status === 'processing') {
          live.sub_status_label = '🎬 Assembling Video FFmpeg';
          live.step_index = 4;
          live.details = 'Penggabungan visual dan audio properti sedang berlangsung.';
        } else {
          live.sub_status_label = `⚡ RE: ${subStatus}`;
          live.step_index = 3;
          live.details = 'Campaign Real Estate sedang diproses.';
        }
      }
    } else if (kind === 'pillar') {
      live.campaign_url = `/pillar-campaigns/${slot.source_campaign_id}`;
      const res = await pgQuery(
        `SELECT id, workflow_status, status, error_message
         FROM pillar_campaign_items
         WHERE campaign_id = $1
         LIMIT 1`,
        [slot.source_campaign_id]
      );
      const item = res.rows[0];
      if (item) {
        live.engine_status = item.workflow_status || item.status || 'processing';
        live.sub_status_label = `🏛️ Pillar: ${live.engine_status}`;
        live.step_index = 3;
        live.details = 'Campaign Pillar konten sedang berjalan.';
      }
    }
  } catch (err) {
    console.warn('[resolveLiveEngineState Error]:', err.message);
  }

  return live;
}
