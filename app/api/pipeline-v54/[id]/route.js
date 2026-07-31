import { NextResponse } from 'next/server';
import { getPipelineAsset, deletePipelineAsset, getAllPipelineAssets } from '@/lib/db';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    
    // Handle /api/pipeline-v54/history
    if (id === 'history') {
      const assets = await getAllPipelineAssets();
      return NextResponse.json({ success: true, data: assets });
    }

    const asset = await getPipelineAsset(id);
    
    if (!asset) {
      return NextResponse.json({ success: false, error: 'Pipeline asset tidak ditemukan' }, { status: 404 });
    }

    // Parse JSON fields
    const result = {
      ...asset,
      all_ideas: safeJsonParse(asset.all_ideas, []),
      selected_idea: safeJsonParse(asset.selected_idea, null),
      audio_blueprint: safeJsonParse(asset.audio_blueprint, null),
      visual_storyboard: safeJsonParse(asset.visual_storyboard, null),
      t2i_prompts: safeJsonParse(asset.t2i_prompts, []),
      i2v_prompts: safeJsonParse(asset.i2v_prompts, []),
      t2v_prompts: safeJsonParse(asset.t2v_prompts, []),
      config: safeJsonParse(asset.config, {}),
      key_visuals_extracted: safeJsonParse(asset.key_visuals_extracted, []),
    };

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await deletePipelineAsset(id);
    return NextResponse.json({ success: true, message: 'Pipeline asset dihapus' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

function safeJsonParse(str, fallback) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}
