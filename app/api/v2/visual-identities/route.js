import { withTenantContext } from '@/lib/auth';
import { listVisualIdentities, createVisualIdentity } from '@/lib/visual-identity-repository';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, { params }, user) => {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || 'active';
    const data = await listVisualIdentities({ status });
    return new Response(JSON.stringify({ success: true, data }), {
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

export const POST = withTenantContext(async (req, { params }, user) => {
  try {
    const body = await req.json();
    const result = await createVisualIdentity(body, user?.id || user?.email || 'system');
    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 201,
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }
});
