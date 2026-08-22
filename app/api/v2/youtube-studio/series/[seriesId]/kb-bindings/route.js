/**
 * app/api/v2/youtube-studio/series/[seriesId]/kb-bindings/route.js
 * GET  — list KB bindings for a series
 * POST — attach/update/remove a KB binding for a series (override layer)
 */

import { NextResponse } from 'next/server';
import { withYouTubeStudioAccess } from '@/lib/auth';
import { getKbBindings, setKbBinding, removeKbBinding } from '@/lib/youtube-studio-kb-repository';

export const dynamic = 'force-dynamic';

export const GET = withYouTubeStudioAccess('read', async (request, ctx, user) => {
  const { seriesId } = ctx.params;
  const items = await getKbBindings({ scope: 'series', scopeId: seriesId });
  return NextResponse.json({ success: true, items });
});

export const POST = withYouTubeStudioAccess('write', async (request, ctx, user) => {
  const { seriesId } = ctx.params;
  const body = await request.json();
  const { kb_id, is_override, remove, kb_type } = body;

  if (remove) {
    if (!kb_type) return NextResponse.json({ success: false, error: 'kb_type is required to remove' }, { status: 400 });
    const result = await removeKbBinding({ scope: 'series', scopeId: seriesId, kbType: kb_type });
    return NextResponse.json({ success: true, ...result });
  }

  if (!kb_id) return NextResponse.json({ success: false, error: 'kb_id is required' }, { status: 400 });
  const result = await setKbBinding({
    scope: 'series', scopeId: seriesId, kbId: kb_id,
    isOverride: is_override !== false, actor: { username: user?.username || 'system' },
  });
  return NextResponse.json({ success: true, ...result });
});
