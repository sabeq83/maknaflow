import { withTenantContext } from '@/lib/auth';
import { getEpisode, updateEpisodeStatus } from '@/lib/youtube-studio-repository';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  const data = await getEpisode(id);
  if (!data) {
    return new Response(JSON.stringify({ success: false, error: 'Episode not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' }
    });
  }
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});

export const PATCH = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  const body = await req.json();
  const data = await updateEpisodeStatus(id, body.status, user);
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});
