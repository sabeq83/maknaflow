/**
 * app/api/v2/youtube-studio/knowledge-bases/[id]/activate/route.js
 * POST — activate a KB revision (requires revision_id in body)
 */

import { NextResponse } from 'next/server';
import { withYouTubeStudioAccess } from '@/lib/auth';
import { activateKbRevision } from '@/lib/youtube-studio-kb-repository';

export const dynamic = 'force-dynamic';

export const POST = withYouTubeStudioAccess('write', async (request, ctx, user) => {
  const body = await request.json();
  const { revision_id } = body;
  if (!revision_id) {
    return NextResponse.json({ success: false, error: 'revision_id is required' }, { status: 400 });
  }
  const result = await activateKbRevision(revision_id, { username: user?.username || 'system' });
  return NextResponse.json({ success: true, revision: result });
});
