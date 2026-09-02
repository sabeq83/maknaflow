import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import {
  listOperatorPresets,
  isSystemOperatorPreset,
  getCustomOperatorPresets,
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

function normalize(body, current = {}) {
  const key = String(body.key || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{2,63}$/.test(key)) {
    const e = new Error('Key preset tidak valid.');
    e.status = 400;
    throw e;
  }
  if (isSystemOperatorPreset(key) || PRESET_ALIASES[key]) {
    const e = new Error('Preset sistem tidak dapat ditimpa. Clone dengan key baru.');
    e.status = 409;
    throw e;
  }
  const config = body.config;
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    const e = new Error('Config preset wajib berupa object JSON.');
    e.status = 400;
    throw e;
  }
  return {
    ...config,
    campaign_kinds: normalizePresetCampaignKinds(config.campaign_kinds),
    schema_version: '2',
    label: String(body.label || config.label || key).trim(),
    revision: Number(current.revision || 0) + 1
  };
}

export const GET = withTenantContext(async (_request, _ctx, user) => {
  const tenantPresets = getSetting('operator_presets_json', false) || '{}';
  hydrateOperatorPresetCache(user.tenantId, tenantPresets);
  return NextResponse.json(
    { success: true, presets: listOperatorPresets(user.tenantId) },
    { headers: { 'Cache-Control': 'no-store' } }
  );
});

export const POST = withTenantContext(async (request, _ctx, user) => {
  requireAdmin(user);
  const tenantPresets = getSetting('operator_presets_json', false) || '{}';
  hydrateOperatorPresetCache(user.tenantId, tenantPresets);
  const body = await request.json();
  const all = getCustomOperatorPresets(user.tenantId);
  if (all[body.key]) {
    return NextResponse.json({ success: false, error: 'Key preset sudah ada di tenant ini.' }, { status: 409 });
  }
  const config = normalize(body);
  all[body.key] = config;
  await setSetting('operator_presets_json', JSON.stringify(all));
  hydrateOperatorPresetCache(user.tenantId, all);
  return NextResponse.json({ success: true, key: body.key, preset: config }, { status: 201 });
});
