import { withTenantContext } from '@/lib/auth';
import { approveBlueprint, getLatestBlueprint } from '@/lib/youtube-studio-repository';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  const latest = await getLatestBlueprint(id);
  return new Response(JSON.stringify({ success: true, data: latest }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});

export const POST = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  try {
    const { blueprint_id } = await req.json();
    if (!blueprint_id) {
      return new Response(JSON.stringify({ success: false, error: 'Blueprint ID is required' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }
    
    const approved = await approveBlueprint(blueprint_id, user);
    return new Response(JSON.stringify({ success: true, data: approved }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
});
