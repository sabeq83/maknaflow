import { withTenantContext } from '@/lib/auth';
import { runReferenceAssetPreflight } from '@/lib/reference-asset-service';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (req, { params }, user) => {
  try {
    const body = await req.json();
    const result = await runReferenceAssetPreflight(body);
    
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
