import { withTenantContext } from '@/lib/auth';
import { getUniverseEpisodes, getEpisodeDigest } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  const episodes = await getUniverseEpisodes(id);
  const digest = await getEpisodeDigest(id);
  
  return new Response(JSON.stringify({
    success: true,
    data: {
      episodes,
      digest
    }
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});
