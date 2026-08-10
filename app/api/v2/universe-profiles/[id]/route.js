import { withTenantContext } from '@/lib/auth';
import { getUniverseProfile, getUniverseCharacters, getUniverseLocations, updateUniverseProfile, archiveUniverseProfile, getUniverseEpisodes, getUniverseProfileBySlug, dbRun } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  const profile = await getUniverseProfile(id);
  if (!profile) {
    return new Response(JSON.stringify({ success: false, error: 'Universe Profile not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' }
    });
  }
  const characters = await getUniverseCharacters(id);
  const locations = await getUniverseLocations(id);
  
  return new Response(JSON.stringify({
    success: true,
    data: {
      ...profile,
      characterCount: characters.length,
      locationCount: locations.length
    }
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});

export const PUT = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  const body = await req.json();
  const profile = await getUniverseProfile(id);
  
  if (!profile) {
    return new Response(JSON.stringify({ success: false, error: 'Universe Profile not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' }
    });
  }

  if (body.slug && body.slug !== profile.slug) {
    const existing = await getUniverseProfileBySlug(body.slug);
    if (existing) {
      return new Response(JSON.stringify({ success: false, error: 'Slug already exists.' }), {
        status: 409,
        headers: { 'content-type': 'application/json' }
      });
    }
  }

  await updateUniverseProfile(id, body);
  
  try {
    const manifests = await import('@/lib/universe-manifests.js');
    if (manifests.refreshManifestCache) {
      await manifests.refreshManifestCache(id);
    }
  } catch (e) {
    // Ignore if module or function doesn't exist yet
  }

  return new Response(JSON.stringify({ success: true, message: 'Universe Profile updated' }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});

export const DELETE = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  const profile = await getUniverseProfile(id);
  
  if (!profile) {
    return new Response(JSON.stringify({ success: false, error: 'Universe Profile not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' }
    });
  }

  const episodes = await getUniverseEpisodes(id);
  if (episodes && episodes.length > 0) {
    await archiveUniverseProfile(id);
  } else {
    await dbRun('DELETE FROM universe_profiles WHERE id = ?', [id]);
  }

  return new Response(JSON.stringify({ success: true, message: 'Universe Profile deleted/archived' }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});
