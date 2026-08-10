import { withTenantContext } from '@/lib/auth';
import { getUniverseCharacters, createUniverseCharacter, getUniverseProfile } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  const characters = await getUniverseCharacters(id);
  return new Response(JSON.stringify({ success: true, data: characters }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});

export const POST = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  const body = await req.json();
  
  if (!body.name || !body.character_key || !body.canonical_prompt) {
    return new Response(JSON.stringify({ success: false, error: 'Name, character_key, and canonical_prompt are required.' }), {
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
  
  const charId = uuidv4();
  await createUniverseCharacter({ id: charId, universe_id: id, ...body });
  
  return new Response(JSON.stringify({ success: true, id: charId }), {
    status: 201,
    headers: { 'content-type': 'application/json' }
  });
});
