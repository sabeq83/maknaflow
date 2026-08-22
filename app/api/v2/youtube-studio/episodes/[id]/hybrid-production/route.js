/**
 * app/api/v2/youtube-studio/episodes/[id]/hybrid-production/route.js
 * GET  — get current hybrid production state (package, batches, assets)
 * POST — handle pipeline actions: approve_prompt_package, approve_start_frame_batch, approve_voiceover_batch
 */

import { NextResponse } from 'next/server';
import { withYouTubeStudioAccess } from '@/lib/auth';
import {
  getProductionPackageByEpisode,
  getProductionAssets,
  getBatches,
  approvePromptPackage,
  approveStartFrameBatch,
  approveVoiceoverBatch,
} from '@/lib/youtube-studio-production-repository';

export const dynamic = 'force-dynamic';

export const GET = withYouTubeStudioAccess('read', async (request, ctx, user) => {
  const { id: episodeId } = await ctx.params;

  const pkg = await getProductionPackageByEpisode(episodeId);
  if (!pkg) {
    return NextResponse.json({ success: true, active: false, message: 'No production draft for this episode yet' });
  }

  const assets = await getProductionAssets(pkg.id);
  const batches = await getBatches(pkg.id);

  return NextResponse.json({
    success: true,
    active: true,
    package: pkg,
    assets,
    batches
  });
});

export const POST = withYouTubeStudioAccess('write', async (request, ctx, user) => {
  const { id: episodeId } = await ctx.params;
  const body = await request.json();
  const { action, batch_id } = body;

  const pkg = await getProductionPackageByEpisode(episodeId);
  if (!pkg) {
    return NextResponse.json({ success: false, error: 'Production package not found' }, { status: 404 });
  }

  const { assertPackageProductionMode } = await import('@/lib/youtube-studio-production-repository');
  try {
    assertPackageProductionMode(pkg, 'hybrid');
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 400 });
  }

  const actor = { username: user?.username || 'system' };

  try {
    if (action === 'approve_prompt_package') {
      const result = await approvePromptPackage(pkg.id, actor);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'approve_start_frame_batch') {
      if (!batch_id) return NextResponse.json({ success: false, error: 'batch_id is required' }, { status: 400 });
      const result = await approveStartFrameBatch(batch_id, actor);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'approve_voiceover_batch') {
      if (!batch_id) return NextResponse.json({ success: false, error: 'batch_id is required' }, { status: 400 });
      const result = await approveVoiceoverBatch(batch_id, actor);
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ success: false, error: `Invalid action: ${action}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
});
