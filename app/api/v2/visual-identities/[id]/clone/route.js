import { withTenantContext } from '@/lib/auth';
import { cloneVisualIdentity } from '@/lib/visual-identity-repository';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (req, { params }, user) => {
  try {
    const { id } = await params;
    const body = await req.json();
    const result = await cloneVisualIdentity(id, body, user?.id || user?.email || 'system');
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
