import { withYouTubeStudioAccess } from '@/lib/auth';
import { getChannel, getChannelDraftStrategy, activateStrategy } from '@/lib/youtube-studio-repository';

export const dynamic = 'force-dynamic';

export const POST = withYouTubeStudioAccess('write', async (req, { params }, user) => {
  const { id } = await params;
  const channel = await getChannel(id);
  if (!channel) {
    return new Response(JSON.stringify({ success: false, error: 'Channel not found' }), { status: 404 });
  }

  const draft = await getChannelDraftStrategy(id);
  if (!draft) {
    return new Response(JSON.stringify({ success: false, error: 'No draft strategy exists to activate' }), { status: 400 });
  }

  try {
    const activeStrategy = await activateStrategy(id, draft.id, user);
    return new Response(JSON.stringify({ success: true, data: activeStrategy }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500 });
  }
});
