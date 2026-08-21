import { withTenantContext } from '@/lib/auth';
import { getChannel, getChannelStrategy } from '@/lib/youtube-studio-repository';

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
