import { withTenantContext } from '@/lib/auth';
import { listChannels, createChannel } from '@/lib/youtube-studio-repository';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, _ctx, user) => {
  const data = await listChannels();
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});

export const POST = withTenantContext(async (req, _ctx, user) => {
  const body = await req.json();
  if (!body.name) {
    return new Response(JSON.stringify({ success: false, error: 'Channel name is required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }
  const result = await createChannel(body, user);
  return new Response(JSON.stringify({ success: true, data: result }), {
    status: 201,
    headers: { 'content-type': 'application/json' }
  });
});
