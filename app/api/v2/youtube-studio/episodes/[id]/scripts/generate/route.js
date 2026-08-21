import { withTenantContext } from '@/lib/auth';
import { getEpisode } from '@/lib/youtube-studio-repository';
import { generateScript } from '@/lib/youtube-studio-planner';
import { pgQuery } from '@/lib/db-pg';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  const episode = await getEpisode(id);
  if (!episode) {
    return new Response(JSON.stringify({ success: false, error: 'Episode not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' }
    });
  }

  const blueprintRes = await pgQuery('SELECT * FROM youtube_episode_blueprints WHERE episode_id = $1 ORDER BY version DESC LIMIT 1', [id]);
  const blueprint = blueprintRes.rows[0];
  if (!blueprint) {
    return new Response(JSON.stringify({ success: false, error: 'Episode blueprint must be generated first' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  const script = await generateScript(episode, blueprint);
  return new Response(JSON.stringify({ success: true, data: script }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});
