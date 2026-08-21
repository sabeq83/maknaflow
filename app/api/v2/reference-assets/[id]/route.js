import { withTenantContext } from '@/lib/auth';
import { getReferenceAsset, archiveReferenceAsset } from '@/lib/reference-asset-repository';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, { params }, user) => {
  try {
    const asset = await getReferenceAsset(params.id);
    if (!asset) {
      return new Response(JSON.stringify({ success: false, error: 'Asset not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ success: true, data: asset }), {
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

export const DELETE = withTenantContext(async (req, { params }, user) => {
  try {
    const result = await archiveReferenceAsset(params.id, user?.id || user?.email || 'user');
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
