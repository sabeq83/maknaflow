import { NextResponse } from 'next/server';
import { getAllAssets, getAssetsByIdeaId } from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const ideaId = searchParams.get('idea_id');

    let assets;
    if (ideaId) {
      assets = await getAssetsByIdeaId(ideaId);
    } else {
      assets = await getAllAssets();
    }

    // Parse JSON fields
    const parsed = assets.map(a => ({
      ...a,
      storyboard: a.storyboard ? JSON.parse(a.storyboard) : [],
      t2i_prompts: a.t2i_prompts ? JSON.parse(a.t2i_prompts) : [],
      i2v_prompts: a.i2v_prompts ? JSON.parse(a.i2v_prompts) : [],
    }));

    return NextResponse.json({ success: true, data: parsed });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
