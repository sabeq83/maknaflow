import { withTenantContext } from '@/lib/auth';
import { listSeries, createSeries } from '@/lib/youtube-studio-repository';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  const data = await listSeries(id);
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});

export const POST = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  const body = await req.json();
  const result = await createSeries({ ...body, channel_id: id }, user);
  return new Response(JSON.stringify({ success: true, data: result }), {
    status: 201,
    headers: { 'content-type': 'application/json' }
  });
});
