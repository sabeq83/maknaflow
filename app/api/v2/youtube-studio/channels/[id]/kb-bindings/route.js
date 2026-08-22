/**
 * app/api/v2/youtube-studio/channels/[id]/kb-bindings/route.js
 * GET  — list KB bindings for a channel
 * POST — attach/update/remove a KB binding for a channel
 */

import { NextResponse } from 'next/server';
import { withYouTubeStudioAccess } from '@/lib/auth';
import { getKbBindings, setKbBinding, removeKbBinding } from '@/lib/youtube-studio-kb-repository';

export const dynamic = 'force-dynamic';

export const GET = withYouTubeStudioAccess('read', async (request, ctx, user) => {
  const { id: channelId } = ctx.params;
  const items = await getKbBindings({ scope: 'channel', scopeId: channelId });
  return NextResponse.json({ success: true, items });
});

export const POST = withYouTubeStudioAccess('write', async (request, ctx, user) => {
  const { id: channelId } = ctx.params;
  const body = await request.json();
  const { kb_id, is_override, remove, kb_type } = body;

  if (remove) {
    if (!kb_type) return NextResponse.json({ success: false, error: 'kb_type is required to remove' }, { status: 400 });
    const result = await removeKbBinding({ scope: 'channel', scopeId: channelId, kbType: kb_type });
    return NextResponse.json({ success: true, ...result });
  }

  if (!kb_id) return NextResponse.json({ success: false, error: 'kb_id is required' }, { status: 400 });
  const result = await setKbBinding({
    scope: 'channel', scopeId: channelId, kbId: kb_id,
    isOverride: is_override || false, actor: { username: user?.username || 'system' },
  });
  return NextResponse.json({ success: true, ...result });
});
