import { withTenantContext } from '@/lib/auth';
import { listEpisodes, createEpisode } from '@/lib/youtube-studio-repository';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, _ctx, user) => {
  const url = new URL(req.url);
  const channelId = url.searchParams.get('channel_id');
  if (!channelId) {
    return new Response(JSON.stringify({ success: false, error: 'channel_id parameter is required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }
  const data = await listEpisodes(channelId);
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});

export const POST = withTenantContext(async (req, _ctx, user) => {
  const body = await req.json();
  if (!body.channel_id || !body.series_id || !body.strategy_id || !body.title) {
    return new Response(JSON.stringify({ success: false, error: 'Missing required parameters' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }
  const result = await createEpisode(body, user);
  return new Response(JSON.stringify({ success: true, data: result }), {
    status: 201,
    headers: { 'content-type': 'application/json' }
  });
});
