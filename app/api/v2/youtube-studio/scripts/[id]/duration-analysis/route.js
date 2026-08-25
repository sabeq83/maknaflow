import { withTenantContext } from '@/lib/auth';
import { pgQuery } from '@/lib/db-pg';
import { getEpisode } from '@/lib/youtube-studio-repository';
import { analyzeNarrationDuration } from '@/lib/youtube-studio-contract';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  const scriptRes = await pgQuery('SELECT * FROM youtube_episode_scripts WHERE id = $1', [id]);
  const script = scriptRes.rows[0];
  if (!script) {
    return new Response(JSON.stringify({ success: false, error: 'Script not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' }
    });
  }

  const episode = await getEpisode(script.episode_id);
  const analysis = analyzeNarrationDuration({
    script: script.script_json,
    targetSeconds: episode.target_duration_seconds,
    profileKey: episode.narration_profile_key || 'general_id'
  });

  return new Response(JSON.stringify({ success: true, data: analysis }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});
