import { NextResponse } from 'next/server';
import { getIdea } from '@/lib/db';
import { buildIdeationExcelBuffer, buildIdeationMarkdown } from '@/lib/export-builder';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const ids = searchParams.get('ids'); // comma-separated idea IDs
    const format = searchParams.get('format'); // 'xlsx' or 'md'
    const productName = searchParams.get('product') || 'Ideation';

    if (!ids || !format) {
      return NextResponse.json({ success: false, error: 'ids and format required' }, { status: 400 });
    }

    const ideaIds = ids.split(',').filter(Boolean);
    const ideas = (await Promise.all(ideaIds.map(id => getIdea(id)))).filter(Boolean);

    if (ideas.length === 0) {
      return NextResponse.json({ success: false, error: 'No ideas found' }, { status: 404 });
    }

    const baseName = productName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);

    if (format === 'xlsx') {
      const buffer = buildIdeationExcelBuffer(ideas, productName);
      return new Response(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="ideation_${baseName}.xlsx"`,
        },
      });
    }

    if (format === 'md') {
      const markdown = buildIdeationMarkdown(ideas, productName);
      return new Response(markdown, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="ideation_${baseName}.md"`,
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Format must be xlsx or md' }, { status: 400 });
  } catch (error) {
    console.error('Ideation download error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
