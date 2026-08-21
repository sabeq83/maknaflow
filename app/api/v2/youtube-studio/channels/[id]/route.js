import { withTenantContext } from '@/lib/auth';
import { getChannel, updateChannelStrategy, getChannelStrategy } from '@/lib/youtube-studio-repository';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  const channel = await getChannel(id);
  if (!channel) {
    return new Response(JSON.stringify({ success: false, error: 'Channel not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' }
    });
  }
  const strategy = await getChannelStrategy(id);
  return new Response(JSON.stringify({ success: true, channel, strategy }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});

export const PUT = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  const body = await req.json();
  const channel = await getChannel(id);
  if (!channel) {
    return new Response(JSON.stringify({ success: false, error: 'Channel not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' }
    });
  }
  const strategy = await updateChannelStrategy(id, body, user);
  return new Response(JSON.stringify({ success: true, strategy }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});
