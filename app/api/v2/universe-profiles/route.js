import { withTenantContext } from '@/lib/auth';
import { getAllUniverseProfiles, createUniverseProfile, getUniverseProfileBySlug } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, params, user) => {
  const profiles = await getAllUniverseProfiles();
  return new Response(JSON.stringify({ success: true, data: profiles }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});

export const POST = withTenantContext(async (req, params, user) => {
  const body = await req.json();
  if (!body.name || !body.slug) {
    return new Response(JSON.stringify({ success: false, error: 'Name and slug are required.' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  const existing = await getUniverseProfileBySlug(body.slug);
  if (existing) {
    return new Response(JSON.stringify({ success: false, error: 'Slug already exists.' }), {
      status: 409,
      headers: { 'content-type': 'application/json' }
    });
  }

  const id = uuidv4();
  await createUniverseProfile({ id, ...body });

  return new Response(JSON.stringify({ success: true, id }), {
    status: 201,
    headers: { 'content-type': 'application/json' }
  });
});
