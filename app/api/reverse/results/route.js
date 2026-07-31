import { NextResponse } from 'next/server';
import { getAllReverseResults, getReverseResult, deleteReverseResult } from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const result = await getReverseResult(id);
      if (!result) {
        return NextResponse.json({ success: false, error: 'Result not found' }, { status: 404 });
      }
      // Parse JSON fields
      return NextResponse.json({
        success: true,
        data: {
          ...result,
          storyboard: JSON.parse(result.storyboard || '[]'),
          voiceover: JSON.parse(result.voiceover || '[]'),
          t2v_prompts: JSON.parse(result.t2v_prompts || '[]'),
        },
      });
    }

    const results = await getAllReverseResults();
    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    await deleteReverseResult(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
