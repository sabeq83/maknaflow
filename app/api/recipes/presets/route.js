import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getSetting, setSetting } from '@/lib/db';

export const GET = withTenantContext(async () => {
  try {
    const raw = getSetting('recipe_exporter_presets');
    let presets = null;
    if (raw) {
      try {
        presets = JSON.parse(raw);
      } catch (_) {}
    }
    return NextResponse.json({ success: true, presets });
  } catch (err) {
    console.error('[API /api/recipes/presets GET Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});

export const POST = withTenantContext(async (req) => {
  try {
    const body = await req.json();
    const { presets } = body;
    if (!presets || typeof presets !== 'object') {
      return NextResponse.json({ success: false, error: 'Format presets tidak valid.' }, { status: 400 });
    }
    await setSetting('recipe_exporter_presets', JSON.stringify(presets));
    return NextResponse.json({ success: true, message: 'Preset Webadmin berhasil disimpan untuk tenant ini.' });
  } catch (err) {
    console.error('[API /api/recipes/presets POST Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});
