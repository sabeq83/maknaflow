import { withYouTubeStudioAccess } from '@/lib/auth';
import { getChannel, getChannelStrategy, getChannelDraftStrategy, createOrUpdateStrategyDraft } from '@/lib/youtube-studio-repository';

export const dynamic = 'force-dynamic';

export const GET = withYouTubeStudioAccess('read', async (req, { params }, user) => {
  const { id } = await params;
  const channel = await getChannel(id);
  if (!channel) {
    return new Response(JSON.stringify({ success: false, error: 'Channel not found' }), { status: 404 });
  }

  const active = await getChannelStrategy(id);
  const draft = await getChannelDraftStrategy(id);

  return new Response(JSON.stringify({ success: true, channel, active, draft }), { status: 200 });
});

export const PATCH = withYouTubeStudioAccess('write', async (req, { params }, user) => {
  const { id } = await params;
  const channel = await getChannel(id);
  if (!channel) {
    return new Response(JSON.stringify({ success: false, error: 'Channel not found' }), { status: 404 });
  }

  const body = await req.json();
  const draft = await createOrUpdateStrategyDraft(id, {
    config: body.config,
    brief: body.brief,
    universe_id: body.universe_id,
    visual_identity_preset_id: body.visual_identity_preset_id
  }, user);

  return new Response(JSON.stringify({ success: true, data: draft }), { status: 200 });
});
