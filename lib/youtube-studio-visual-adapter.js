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
  const prompt = isI2v ? (asset.i2v_prompt || asset.prompt_snapshot) : (asset.t2v_prompt || asset.prompt_snapshot || 'Cinematic video shot');
  const mode = isI2v ? 'image_to_video' : 'text_to_video';
  const reference_images = isI2v ? [asset.output_asset_json.image_path] : undefined;

  const res = await generateVideo({
    prompt,
    model: modelKey,
    aspect_ratio: '16:9',
    mode,
    reference_images
  });

  return {
    provider_task_id: res.task_id,
    status: 'queued'
  };
}
