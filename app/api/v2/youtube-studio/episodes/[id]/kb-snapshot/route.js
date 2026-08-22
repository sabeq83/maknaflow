/**
 * app/api/v2/youtube-studio/episodes/[id]/kb-snapshot/route.js
 * GET — resolve the effective KB snapshot for an episode (read-only, never modifies)
 */

import { NextResponse } from 'next/server';
import { withYouTubeStudioAccess } from '@/lib/auth';
import { createKbSnapshot } from '@/lib/youtube-studio-kb-repository';
import { pgQuery } from '@/lib/db-pg';
import { getActiveTenantId } from '@/lib/tenant-context';

export const dynamic = 'force-dynamic';

export const GET = withYouTubeStudioAccess('read', async (request, ctx, user) => {
  const { id: episodeId } = ctx.params;
  const { searchParams } = new URL(request.url);
  const stage = searchParams.get('stage') || 'blueprint';

  const tenantId = getActiveTenantId();
  const epRes = await pgQuery(
    'SELECT channel_id, series_id FROM youtube_episodes WHERE id = $1 AND tenant_id = $2',
    [episodeId, tenantId]
  );
  const episode = epRes.rows[0];
  if (!episode) return NextResponse.json({ success: false, error: 'Episode not found' }, { status: 404 });

  const snapshot = await createKbSnapshot({
    channelId: episode.channel_id,
    seriesId: episode.series_id,
    stage,
  });

  return NextResponse.json({ success: true, episode_id: episodeId, stage, snapshot });
});
