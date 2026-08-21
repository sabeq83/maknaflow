import { withTenantContext } from '@/lib/auth';
import { getEpisode, getChannelStrategy } from '@/lib/youtube-studio-repository';
import { generateBlueprint } from '@/lib/youtube-studio-planner';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  const episode = await getEpisode(id);
  if (!episode) {
    return new Response(JSON.stringify({ success: false, error: 'Episode not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' }
    });
  }

  const strategy = await getChannelStrategy(episode.channel_id);
  if (!strategy) {
    return new Response(JSON.stringify({ success: false, error: 'Channel strategy not configured' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  const blueprint = await generateBlueprint(episode, strategy);
  return new Response(JSON.stringify({ success: true, data: blueprint }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});
