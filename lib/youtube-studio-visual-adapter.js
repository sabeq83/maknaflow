import { generateVideo } from './webhook-client.js';

export async function generateVisualShot({ asset, profile }) {
  let modelKey = 'omni_flash';
  if (profile?.key === 'google_flow_veo_3_1_lite') {
    modelKey = 'veo_31_lite';
  }

  const res = await generateVideo({
    prompt: asset.prompt_snapshot || 'Cinematic video shot',
    model: modelKey,
    aspect_ratio: '16:9',
    mode: 'text_to_video'
  });

  return {
    provider_task_id: res.task_id,
    status: 'queued'
  };
}
