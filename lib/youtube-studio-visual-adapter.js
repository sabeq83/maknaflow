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
  let universeId = null;
  let noSoundOverride = false;

  try {
    const { pgQuery } = await import('./db-pg.js');
    
    const pkgRes = await pgQuery('SELECT * FROM youtube_production_packages WHERE id = $1', [asset.production_package_id]);
    const pkg = pkgRes.rows[0];
    const snapshot = pkg?.context_snapshot_json || {};
    const productionMode = snapshot.audio_production_snapshot?.audio_production_mode || 'standalone_tts';

    if (productionMode === 'native_scene_audio') {
      noSoundOverride = true;
      if (pkg?.approved_script_id) {
        const scriptRes = await pgQuery('SELECT script_json FROM youtube_episode_scripts WHERE id = $1', [pkg.approved_script_id]);
        const scriptJson = scriptRes.rows[0]?.script_json || {};
        const scriptScene = scriptJson.scenes?.find(s => s.scene_index === asset.scene_index);
        
        if (scriptScene && scriptScene.audio_blocks && scriptScene.audio_blocks.length > 0) {
          const audioInstructions = [];
          for (const ab of scriptScene.audio_blocks) {
            const casting = snapshot.casting_snapshot?.find(s => s.speaker_id === ab.speaker_id) || {};
            const speakerDesc = casting.display_name || ab.speaker_id;
            const flowBinding = casting.flow_binding || {};
            const voiceSpec = flowBinding.descriptive_voice_prompt || `voice of ${speakerDesc}`;
            
            if (['narration', 'dialogue', 'whisper'].includes(ab.type)) {
              const whisperNote = ab.type === 'whisper' ? 'whispered ' : '';
              audioInstructions.push(`${whisperNote}speech by ${speakerDesc} (${voiceSpec}) saying: "${ab.text}"`);
            } else if (ab.type === 'sound_event') {
              audioInstructions.push(`sound effect of ${ab.text}`);
            } else if (ab.type === 'ambience') {
              audioInstructions.push(`ambient sound of ${ab.text}`);
            }
          }
          if (audioInstructions.length > 0) {
            promptText = `${promptText}. [Audio: ${audioInstructions.join(', ')}]`;
          }
        }
      }
    }

    const episodeId = pkg?.episode_id;
    if (episodeId) {
      const epRes = await pgQuery('SELECT channel_id FROM youtube_episodes WHERE id = $1', [episodeId]);
      const channelId = epRes.rows[0]?.channel_id;
      if (channelId) {
        const stratRes = await pgQuery("SELECT brief_json, universe_id FROM youtube_channel_strategies WHERE channel_id = $1 AND status = 'active'", [channelId]);
        const strat = stratRes.rows[0];
        if (strat) {
          const brief = typeof strat.brief_json === 'string' ? JSON.parse(strat.brief_json) : strat.brief_json;
          universeId = strat.universe_id || brief?.universe_id;
        }
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
    console.warn('[VisualAdapter] Failed to resolve character or audio continuity:', err.message);
  }

  const res = await generateVideo({
    prompt: promptText,
    model: modelKey,
    aspect_ratio: '16:9',
    mode,
    reference_images: reference_images.length > 0 ? reference_images : undefined,
    noSoundOverride
  });

  return {
    provider_task_id: res.task_id,
    status: 'queued'
  };
}
