import { generateVideo } from './webhook-client.js';

export async function generateVisualShot({ asset, profile }) {
  if (process.env.NODE_ENV === 'test') {
    return {
      provider_task_id: 'task_mock_vis_123',
      status: 'queued'
    };
  }

  let modelKey = 'omni_flash';
  if (profile?.key === 'google_flow_veo_3_1_lite') {
    modelKey = 'veo_31_lite';
  }

  const isI2v = asset.generation_mode === 't2i_i2v' && asset.output_asset_json?.image_path;
  let promptText = isI2v ? (asset.i2v_prompt || asset.prompt_snapshot) : (asset.t2v_prompt || asset.prompt_snapshot || 'Cinematic video shot');
  const mode = isI2v ? 'image_to_video' : 'text_to_video';
  const reference_images = isI2v ? [asset.output_asset_json.image_path] : [];

  // Inject character canonical prompt for visual continuity
  try {
    const { pgQuery } = await import('./db-pg.js');
    
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
      // Resolve subjects
      let subjects = asset.source_asset_json?.subjects || [];
      if (subjects.length === 0) {
        const allCharsRes = await pgQuery('SELECT character_key, name FROM universe_characters WHERE universe_id = $1', [universeId]);
        for (const charRow of allCharsRes.rows) {
          if (promptText.toLowerCase().includes(charRow.name.toLowerCase())) {
            subjects.push(charRow.character_key);
          }
        }
      }

      // Retrieve canonical prompts
      for (const subKey of subjects) {
        const charRes = await pgQuery('SELECT * FROM universe_characters WHERE universe_id = $1 AND character_key = $2', [universeId, subKey]);
        const char = charRes.rows[0];
        if (char?.canonical_prompt && !promptText.includes(char.canonical_prompt)) {
          promptText = `${char.canonical_prompt}, ${promptText}`;
        }
      }
    }
  } catch (err) {
    console.warn('[VisualAdapter] Failed to resolve character continuity:', err.message);
  }

  const res = await generateVideo({
    prompt: promptText,
    model: modelKey,
    aspect_ratio: '16:9',
    mode,
    reference_images: reference_images.length > 0 ? reference_images : undefined
  });

  return {
    provider_task_id: res.task_id,
    status: 'queued'
  };
}
