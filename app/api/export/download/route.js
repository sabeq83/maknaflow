import { NextResponse } from 'next/server';
import { getReverseResult, getAsset } from '@/lib/db';
import { buildExcelBuffer, buildMarkdownContent } from '@/lib/export-builder';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const format = searchParams.get('format'); // 'xlsx' or 'md'
    const source = searchParams.get('source'); // 'reverse' or 'production'

    if (!id || !format) {
      return NextResponse.json({ success: false, error: 'id and format required' }, { status: 400 });
    }

    // Fetch result
    let result;
    if (source === 'production') {
      // Use getAsset but also fetch idea info for product_name
      const asset = await getAsset(id);
      if (asset) {
        const { getIdea } = await import('@/lib/db');
        const idea = asset.idea_id ? await getIdea(asset.idea_id) : null;
        const storyboard = JSON.parse(asset.storyboard || '[]');
        result = {
          ...asset,
          storyboard,
          voiceover: storyboard.map((s, i) => ({
            scene: s.scene || i + 1,
            narration: s.narration || '',
            duration: s.duration || '',
          })),
          t2i_prompts: JSON.parse(asset.t2i_prompts || '[]'),
          i2v_prompts: JSON.parse(asset.i2v_prompts || '[]'),
          product_name: idea?.product_name || 'Production Asset',
          source_type: 'production',
        };
      }
    } else {
      result = await getReverseResult(id);
      if (result) {
        result.storyboard = JSON.parse(result.storyboard || '[]');
        result.voiceover = JSON.parse(result.voiceover || '[]');
        result.t2v_prompts = JSON.parse(result.t2v_prompts || '[]');
      }
    }

    if (!result) {
      return NextResponse.json({ success: false, error: 'Result not found' }, { status: 404 });
    }

    const baseName = (result.video_filename || result.product_name || 'export')
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 50);

    if (format === 'xlsx') {
      const buffer = buildExcelBuffer(result);
      return new Response(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${baseName}.xlsx"`,
        },
      });
    }

    if (format === 'md') {
      const markdown = buildMarkdownContent(result);
      return new Response(markdown, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="${baseName}.md"`,
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Format must be xlsx or md' }, { status: 400 });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
