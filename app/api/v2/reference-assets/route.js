import { withTenantContext } from '@/lib/auth';
import { listReferenceAssets } from '@/lib/reference-asset-repository';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, { params }, user) => {
  try {
    const url = new URL(req.url);
    const owner_type = url.searchParams.get('owner_type');
    const owner_id = url.searchParams.get('owner_id');
    const role = url.searchParams.get('role');
    const status = url.searchParams.get('status');

    const data = await listReferenceAssets({ owner_type, owner_id, role, status });
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
