import { withTenantContext } from '@/lib/auth';
import { updateUniverseLocation, deleteUniverseLocation } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const PUT = withTenantContext(async (req, { params }, user) => {
  const { locId } = await params;
  const body = await req.json();
  await updateUniverseLocation(locId, body);
  return new Response(JSON.stringify({ success: true, message: 'Location updated' }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});

export const DELETE = withTenantContext(async (req, { params }, user) => {
  const { locId } = await params;
  await deleteUniverseLocation(locId);
  return new Response(JSON.stringify({ success: true, message: 'Location deleted' }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});
