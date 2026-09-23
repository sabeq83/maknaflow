import { NextResponse } from 'next/server';
import { 
  generateDynamicMultiplierAngles, 
  getAvailableNicheKBs, 
  getExcludedAnglesHistory 
} from '@/lib/multiplier-angle-generator';
import { getActiveTenantId } from '@/lib/tenant-context';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const blueprintId = searchParams.get('blueprintId');

    const nicheKBs = getAvailableNicheKBs();
    let excludedHistory = [];
    if (blueprintId) {
      excludedHistory = await getExcludedAnglesHistory(blueprintId);
    }

    return NextResponse.json({
      success: true,
      niche_kbs: nicheKBs,
      excluded_history: excludedHistory
    });
  } catch (error) {
    console.error('[API Multiplier Generate Angles GET Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const tenantId = getActiveTenantId();

    const {
      blueprint_id,
      blueprint_ids,
      mode,
      niche_kb_name,
      angle_count,
      custom_theme
    } = body;

    const angles = await generateDynamicMultiplierAngles({
      blueprintId: blueprint_id,
      blueprintIds: blueprint_ids,
      mode: mode || '1_to_multi',
      nicheKbName: niche_kb_name || 'HERBAL_CONTENT_KB.md',
      angleCount: angle_count || 5,
      customTheme: custom_theme || '',
      tenantId
    });

    return NextResponse.json({
      success: true,
      angles,
      count: angles.length
    });
  } catch (error) {
    console.error('[API Multiplier Generate Angles POST Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
