import { withTenantContext } from '@/lib/auth';
import { getEpisode, getChannelStrategy, getLatestResearchBrief, saveScriptDraft } from '@/lib/youtube-studio-repository';
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

  const bpRes = await pgQuery('SELECT * FROM youtube_episode_blueprints WHERE episode_id = $1 AND status = \'approved\'', [id]);
  const approvedBp = bpRes.rows[0];
  if (!approvedBp) {
    return new Response(JSON.stringify({ success: false, error: 'An approved blueprint is required before a script can be generated.' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  const research = await getLatestResearchBrief(id);
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

  const snapshot = {
    strategy_id: strategy?.id,
    universe_id: strategy?.universe_id,
    universe_snapshot: universe,
    visual_identity_preset_id: strategy?.visual_identity_preset_id,
    visual_identity_snapshot: visualIdentity,
    blueprint_id: approvedBp.id
  };

  try {
    const generated = await generateScript(episode, approvedBp.content_json, research?.content_json, universe, visualIdentity);
    const saved = await saveScriptDraft(id, approvedBp.id, generated, snapshot, user);

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
