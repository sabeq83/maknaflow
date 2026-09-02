import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import {
  getCustomOperatorPresets,
  isSystemOperatorPreset,
  hydrateOperatorPresetCache,
  normalizePresetCampaignKinds,
  PRESET_ALIASES
} from '@/lib/operator-presets';
import { getSetting, setSetting } from '@/lib/db';

export const dynamic = 'force-dynamic';

function requireAdmin(user) {
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    const e = new Error('Hanya Admin tenant yang dapat mengelola preset.');
    e.status = 403;
    throw e;
  }
  return user;
}

export const PUT = withTenantContext(async (request, { params }, user) => {
  requireAdmin(user);
  const tenantPresets = getSetting('operator_presets_json', false) || '{}';
  hydrateOperatorPresetCache(user.tenantId, tenantPresets);
  const { key } = await params;
  if (isSystemOperatorPreset(key) || PRESET_ALIASES[key]) {
    return NextResponse.json(
      { success: false, error: 'Preset master sistem tidak dapat diedit langsung. Silakan clone terlebih dahulu.' },
      { status: 409 }
    );
  }
  const all = getCustomOperatorPresets(user.tenantId);
  const current = all[key];
  if (!current) {
    return NextResponse.json(
      { success: false, error: 'Preset kustom tidak ditemukan di tenant ini.' },
      { status: 404 }
    );
  }
  const body = await request.json();
  const config = body.config;
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return NextResponse.json({ success: false, error: 'Config wajib object JSON.' }, { status: 400 });
  }
  all[key] = {
    ...config,
    campaign_kinds: normalizePresetCampaignKinds(config.campaign_kinds),
    schema_version: '2',
    label: String(body.label || config.label || key).trim(),
    revision: Number(current.revision || 0) + 1
  };
  await setSetting('operator_presets_json', JSON.stringify(all));
  hydrateOperatorPresetCache(user.tenantId, all);
  return NextResponse.json({ success: true, preset: all[key] });
});

export const DELETE = withTenantContext(async (_request, { params }, user) => {
  requireAdmin(user);
  const tenantPresets = getSetting('operator_presets_json', false) || '{}';
  hydrateOperatorPresetCache(user.tenantId, tenantPresets);
  const { key } = await params;
  if (isSystemOperatorPreset(key) || PRESET_ALIASES[key]) {
    return NextResponse.json(
      { success: false, error: 'Preset sistem tidak dapat dihapus.' },
      { status: 409 }
    );
  }
  const all = getCustomOperatorPresets(user.tenantId);
  if (!all[key]) {
    return NextResponse.json(
      { success: false, error: 'Preset tidak ditemukan di tenant ini.' },
      { status: 404 }
    );
  }
  delete all[key];
  await setSetting('operator_presets_json', JSON.stringify(all));
  hydrateOperatorPresetCache(user.tenantId, all);
  return NextResponse.json({ success: true });
});
