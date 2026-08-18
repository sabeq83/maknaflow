import { NextResponse } from 'next/server';
import { dbRun, getMultiplierTaskById } from '@/lib/db';
import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (req, { params }) => {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const body = await req.json();
    const { storyboard, vsoConfig, bridgingConfig, audioConfig, newCaption } = body;

    const task = await getMultiplierTaskById(id);
    if (!task) {
      return NextResponse.json({ success: false, error: 'Task tidak ditemukan' }, { status: 404 });
    }

    // Map storyboard to prompts structure
    const prompts = (storyboard || []).map((s, idx) => ({
      clip: s.scene || (idx + 1),
      t2i_prompt: s.t2i_prompt || '',
      i2v_prompt: s.i2v_prompt || '',
      t2v_prompt: s.t2v_prompt || s.i2v_prompt || '',
      prompt: s.i2v_prompt || ''
    }));

    await dbRun(`
      UPDATE re_multiplier_tasks
      SET remake_storyboard_json = ?,
          t2i_i2v_prompts_json = ?,
          vso_config_json = ?,
          bridging_config_json = ?,
          audio_config_json = ?,
          new_caption = ?
      WHERE id = ?
    `, [
      JSON.stringify(storyboard || []),
      JSON.stringify(prompts),
      JSON.stringify(vsoConfig || {}),
      JSON.stringify(bridgingConfig || {}),
      JSON.stringify(audioConfig || {}),
      newCaption || '',
      id
    ]);

    return NextResponse.json({ success: true, message: 'Storyboard dan konfigurasi berhasil disimpan.' });

  } catch (error) {
    console.error('[Update Creative Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
