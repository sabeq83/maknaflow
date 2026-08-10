import { withTenantContext } from '@/lib/auth';
import { getUniverseLocations, createUniverseLocation, getUniverseProfile } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  const locations = await getUniverseLocations(id);
  return new Response(JSON.stringify({ success: true, data: locations }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});

export const POST = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  const body = await req.json();
  
  if (!body.name) {
    return new Response(JSON.stringify({ success: false, error: 'Name is required.' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }
  
  const universe = await getUniverseProfile(id);
  if (!universe) {
    return new Response(JSON.stringify({ success: false, error: 'Universe not found.' }), {
      status: 404,
      headers: { 'content-type': 'application/json' }
    });
  }
  
  const locId = uuidv4();
  await createUniverseLocation({ id: locId, universe_id: id, ...body });
  
  return new Response(JSON.stringify({ success: true, id: locId }), {
    status: 201,
    headers: { 'content-type': 'application/json' }
  });
});
