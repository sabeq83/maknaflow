/**
 * lib/youtube-studio-start-frame-adapter.js
 * YouTube Studio Start Frame Adapter — Fase 3.5B
 * Handles start-frame generation (T2I) and local caching.
 * Independent adapter without coupling to Pillar campaigns.
 */

import { generateImage, getTaskStatus } from './webhook-client.js';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const transport = url.startsWith('https') ? https : http;

    transport.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file: status code ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(destPath);
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

export async function generateStartFrame({ asset, profile }) {
  if (process.env.NODE_ENV === 'test') {
    return {
      provider_task_id: 'task_mock_sf_123',
      status: 'queued'
    };
  }

  let modelKey = 'imagen_3'; // default image model
  if (profile?.key === 'google_flow_veo_3_1_lite') {
    modelKey = 'imagen_3';
  }

  let promptText = asset.t2i_prompt || asset.prompt_snapshot || 'Cinematic landscape photo';
  const references = [];

  try {
    const { pgQuery } = await import('./db-pg.js');
    const { fileToBase64 } = await import('./cartoon-reference-resolver.js');

    // 1. Resolve universe_id for this asset
    let universeId = null;
    const pkgRes = await pgQuery('SELECT episode_id FROM youtube_production_packages WHERE id = $1', [asset.production_package_id]);
    const episodeId = pkgRes.rows[0]?.episode_id;
    if (episodeId) {
      const epRes = await pgQuery('SELECT channel_id FROM youtube_episodes WHERE id = $1', [episodeId]);
      const channelId = epRes.rows[0]?.channel_id;
      if (channelId) {
        const stratRes = await pgQuery('SELECT brief_json FROM youtube_channel_strategies WHERE channel_id = $1', [channelId]);
        const brief = typeof stratRes.rows[0]?.brief_json === 'string' ? JSON.parse(stratRes.rows[0].brief_json) : stratRes.rows[0]?.brief_json;
        universeId = brief?.universe_id;
      }
    }

    if (universeId) {
      // 2. Resolve subjects
      let subjects = asset.source_asset_json?.subjects || [];
      if (subjects.length === 0) {
        const allCharsRes = await pgQuery('SELECT character_key, name FROM universe_characters WHERE universe_id = $1', [universeId]);
        for (const charRow of allCharsRes.rows) {
          if (promptText.toLowerCase().includes(charRow.name.toLowerCase())) {
            subjects.push(charRow.character_key);
          }
        }
      }

      // 3. Retrieve character references and canonical prompts
      for (const subKey of subjects) {
        const charRes = await pgQuery('SELECT * FROM universe_characters WHERE universe_id = $1 AND character_key = $2', [universeId, subKey]);
        const char = charRes.rows[0];
        if (char) {
          if (char.canonical_prompt) {
            promptText = `${char.canonical_prompt}, ${promptText}`;
          }
          if (char.reference_image_path) {
            const b64 = fileToBase64(char.reference_image_path);
            if (b64) {
              references.push(b64);
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[StartFrameAdapter] Failed to resolve character continuity:', err.message);
  }

  // Call webhook client generateImage
  const res = await generateImage({
    prompt: promptText,
    model: modelKey,
    aspect_ratio: '16:9',
    reference_images: references.length > 0 ? references : undefined
  });

  if (!res || !res.task_id) {
    throw new Error('Image generator provider did not return task_id');
  }

  return {
    provider_task_id: res.task_id,
    status: 'queued'
  };
}

export async function pollStartFrame(taskId, assetId) {
  if (process.env.NODE_ENV === 'test') {
    const filename = `start_frame_${assetId}.png`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'start_frames');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const destPath = path.join(uploadDir, filename);
    if (!fs.existsSync(destPath)) {
      fs.writeFileSync(destPath, 'mock_png_buffer');
    }
    return {
      status: 'completed',
      output_asset_json: {
        image_path: `/uploads/start_frames/${filename}`,
        size_bytes: 100
      }
    };
  }

  const result = await getTaskStatus(taskId);
  const status = String(result?.status || '').toLowerCase();

  if (status === 'failed') {
    return {
      status: 'failed',
      error_message: result.error || result.message || 'Provider image task failed.'
    };
  }

  if (status !== 'completed') {
    return { status: 'pending' };
  }

  // Task completed, download start frame locally
  const files = result.results || result.files || [];
  let fileUrl = files[0];
  if (!fileUrl) {
    return {
      status: 'failed',
      error_message: 'Provider finished but did not return any image file'
    };
  }

  const filename = `start_frame_${assetId}.png`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'start_frames');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const destPath = path.join(uploadDir, filename);
  await downloadFile(fileUrl, destPath);

  return {
    status: 'completed',
    output_asset_json: {
      image_path: `/uploads/start_frames/${filename}`,
      size_bytes: fs.statSync(destPath).size
    }
  };
}
