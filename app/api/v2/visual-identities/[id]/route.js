import { withTenantContext } from '@/lib/auth';
import { getVisualIdentity, updateVisualIdentity, archiveVisualIdentity } from '@/lib/visual-identity-repository';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, { params }, user) => {
  try {
    const { id } = await params;
    const data = await getVisualIdentity(id);
    if (!data) {
      return new Response(JSON.stringify({ success: false, error: 'Visual Identity preset not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' }
      });
    }
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

export const PUT = withTenantContext(async (req, { params }, user) => {
  try {
    const { id } = await params;
    const body = await req.json();
    const result = await updateVisualIdentity(id, body, user?.id || user?.email || 'system');
    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }
});

export const DELETE = withTenantContext(async (req, { params }, user) => {
  try {
    const { id } = await params;
    await archiveVisualIdentity(id, user?.id || user?.email || 'system');
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }
});
