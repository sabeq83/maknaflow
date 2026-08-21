import { withTenantContext } from '@/lib/auth';
import { getEpisode, getChannelStrategy, getLatestResearchBrief, saveResearchBrief } from '@/lib/youtube-studio-repository';
import { generateResearchBrief } from '@/lib/youtube-studio-planner';
import { pgQuery } from '@/lib/db-pg';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  const brief = await getLatestResearchBrief(id);
  return new Response(JSON.stringify({ success: true, data: brief }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});

export const POST = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  const episode = await getEpisode(id);
  if (!episode) {
    return new Response(JSON.stringify({ success: false, error: 'Episode not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' }
    });
  }

  const strategy = await getChannelStrategy(episode.channel_id);
  
  let universe = null;
  if (strategy?.universe_id) {
    const uRes = await pgQuery('SELECT * FROM universe_profiles WHERE id = $1', [strategy.universe_id]);
    universe = uRes.rows[0];
  }
  let visualIdentity = null;
  if (strategy?.visual_identity_preset_id) {
    const viRes = await pgQuery('SELECT * FROM visual_identities WHERE id = $1', [strategy.visual_identity_preset_id]);
    visualIdentity = viRes.rows[0];
  }

  try {
    const generated = await generateResearchBrief(episode, strategy, universe, visualIdentity);
    const saved = await saveResearchBrief(id, generated, user);
    return new Response(JSON.stringify({ success: true, data: saved }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
});
