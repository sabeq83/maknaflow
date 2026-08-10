import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { withTenantContext } from '@/lib/auth';

export const GET = withTenantContext(async (request, { params }, user) => {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';

    const db = getDb();
    const planner = await db.prepare('SELECT * FROM content_planners WHERE id = ?').get(id);
    if (!planner) {
      return NextResponse.json({ success: false, error: 'Planner tidak ditemukan.' }, { status: 404 });
    }

    const rows = await db.prepare('SELECT * FROM content_planner_rows WHERE planner_id = ? ORDER BY sequence ASC').all(id);

    const filename = `${planner.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${planner.id}`;

    if (format === 'json') {
      return new NextResponse(JSON.stringify({ planner, rows }, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}.json"`
        }
      });
    }

    if (format === 'markdown' || format === 'md') {
      let md = `# ${planner.title}\n\n`;
      md += `**Fokus:** ${planner.planner_focus || 'product_campaign'}\n`;
      md += planner.planner_focus === 'brand_editorial'
        ? `**Konteks Brand:** ${planner.brand_context || ''}\n`
        : `**Produk:** ${planner.product_name}\n**Deskripsi:** ${planner.product_description}\n`;
      md += `**Platform:** ${planner.platform}\n`;
      md += `**Dibuat:** ${planner.created_at}\n\n`;
      md += `---\n\n`;
      md += `| # | Pillar | Category CEP | W'S Matrix | Context | VFO | Strategic Angle | Hook | Visual Action | Content Subject | Product Reference | CTA | Main Character | Story Premise | Pet Problem |\n`;
      md += `|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;

      rows.forEach((r, idx) => {
        const cleanHook = r.hook.replace(/\|/g, '\\|').replace(/\n/g, ' ');
        const cleanVisual = r.visual_action.replace(/\|/g, '\\|').replace(/\n/g, ' ');
        const cleanContext = r.context.replace(/\|/g, '\\|').replace(/\n/g, ' ');
        md += `| ${idx + 1} | ${r.pillar} | ${r.category_cep} | ${r.ws_matrix} | ${cleanContext} | ${r.vfo} | ${r.strategic_angle} | ${cleanHook} | ${cleanVisual} | ${r.content_subject || r.context} | ${r.product_reference || r.product || ''} | ${r.cta_type || ''} | ${r.main_character || ''} | ${r.story_premise || ''} | ${r.pet_problem || ''} |\n`;
      });

      return new NextResponse(md, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}.md"`
        }
      });
    }

    // Default: CSV format
    const headers = [
      'Sequence',
      'Pillar',
      'Category CEP',
      'W\'S Matrix',
      'Context',
      'VFO',
      'Strategic Angle',
      'Hook',
      'Visual Action',
      'Content Subject',
      'Product Reference',
      'Commercial Intent',
      'CTA Type',
      'Main Character',
      'Supporting Characters',
      'Story Premise',
      'Pet Problem',
      'Product Role',
      'Product Reveal Beat',
      'Universe Profile'
    ];

    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""';
      const escaped = String(str).replace(/"/g, '""');
      return `"${escaped}"`;
    };

    let csvContent = headers.join(',') + '\n';
    rows.forEach((r, idx) => {
      const rowArr = [
        idx + 1,
        r.pillar,
        r.category_cep,
        r.ws_matrix,
        r.context,
        r.vfo,
        r.strategic_angle,
        r.hook,
        r.visual_action,
        r.content_subject || r.context,
        r.product_reference || r.product || '',
        r.commercial_intent || '',
        r.cta_type || '',
        r.main_character || '',
        r.supporting_characters || '',
        r.story_premise || '',
        r.pet_problem || '',
        r.product_role || '',
        r.product_reveal_beat || '',
        r.universe_profile || ''
      ];
      csvContent += rowArr.map(escapeCsv).join(',') + '\n';
    });

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.csv"`
      }
    });

  } catch (error) {
    console.error('[API /content-planner/[id]/export GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
