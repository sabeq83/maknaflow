import { withTenantContext } from '@/lib/auth';
import { getUniverseCharacter, updateUniverseCharacter, deleteUniverseCharacter } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, { params }, user) => {
  const { charId } = await params;
  const character = await getUniverseCharacter(charId);
  if (!character) {
    return new Response(JSON.stringify({ success: false, error: 'Character not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' }
    });
  }
  return new Response(JSON.stringify({ success: true, data: character }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});

export const PUT = withTenantContext(async (req, { params }, user) => {
  const { id: universeId, charId } = await params;
  const contentType = req.headers.get('content-type') || '';
  let body = {};

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    const file = formData.get('reference_image');
    for (const [key, value] of formData.entries()) {
      if (key !== 'reference_image') body[key] = value;
    }
    
    if (file && file.size > 0) {
      const char = await getUniverseCharacter(charId);
      if (!char) {
        return new Response(JSON.stringify({ success: false, error: 'Character not found' }), { status: 404 });
      }
      const charKey = body.character_key || char.character_key;
      const version = body.version || char.version || 1;
      const ext = path.extname(file.name) || '.jpg';
      const dirPath = path.join(process.cwd(), 'public', 'uploads', 'universe-assets', universeId, 'characters', charKey, `v${version}`);
      
      fs.mkdirSync(dirPath, { recursive: true });
      const filePath = path.join(dirPath, `identity-anchor${ext}`);
      
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(filePath, buffer);
      
      body.reference_image_path = `/uploads/universe-assets/${universeId}/characters/${charKey}/v${version}/identity-anchor${ext}`;
    }
  } else {
    body = await req.json();
  }

  console.log('PUT Character Request Body:', JSON.stringify(body, null, 2));
  await updateUniverseCharacter(charId, body);
  return new Response(JSON.stringify({ success: true, message: 'Character updated' }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});

export const DELETE = withTenantContext(async (req, { params }, user) => {
  const { charId } = await params;
  await deleteUniverseCharacter(charId);
  return new Response(JSON.stringify({ success: true, message: 'Character deleted' }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});
