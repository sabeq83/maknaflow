import { withTenantContext } from '@/lib/auth';
import { uploadReferenceAsset } from '@/lib/reference-asset-service';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (req, { params }, user) => {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const owner_type = formData.get('owner_type');
    const owner_id = formData.get('owner_id');
    const role = formData.get('role');
    const universe_id = formData.get('universe_id') || null;

    if (!file) {
      return new Response(JSON.stringify({ success: false, error: 'No file uploaded' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    const result = await uploadReferenceAsset({
      owner_type,
      owner_id,
      role,
      universe_id
    }, fileBuffer, user?.id || user?.email || 'user');

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
