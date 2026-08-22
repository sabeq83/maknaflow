import { withYouTubeStudioAccess } from '@/lib/auth';
import { 
  getEpisode, 
  getLatestScript, 
  getChannelStrategy,
  getUniverseProfile,
  getVisualIdentityPreset
} from '@/lib/youtube-studio-repository';
import { getGenerationProfile } from '@/lib/youtube-studio-generation-profiles';
import { generateProductionPlan } from '@/lib/youtube-studio-production-planner';
import { 
  createProductionPlanDraft, 
  getProductionPackageByEpisode, 
  getProductionAssets 
} from '@/lib/youtube-studio-production-repository';

export const dynamic = 'force-dynamic';

export const GET = withYouTubeStudioAccess('read', async (req, { params }) => {
  const { id } = await params;
  try {
    const pkg = await getProductionPackageByEpisode(id);
    if (!pkg) {
      return new Response(JSON.stringify({ success: true, data: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
    const assets = await getProductionAssets(pkg.id);
    return new Response(JSON.stringify({ success: true, data: { package: pkg, assets } }), {
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

export const POST = withYouTubeStudioAccess('write', async (req, { params }, user) => {
  const { id } = await params;
  try {
    const episode = await getEpisode(id);
    if (!episode) {
      return new Response(JSON.stringify({ success: false, error: 'Episode not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' }
      });
    }

    if (episode.status !== 'Script Approved' && episode.status !== 'In Production') {
      // Allow generation if script is approved
      const script = await getLatestScript(id);
      if (!script || script.status !== 'approved') {
        return new Response(JSON.stringify({ success: false, error: 'Episode script must be approved first' }), {
          status: 400,
          headers: { 'content-type': 'application/json' }
        });
      }
    }

    const script = await getLatestScript(id);
    const strategy = await getChannelStrategy(episode.channel_id);
    const profile = getGenerationProfile(episode.generation_profile_key);
    if (!profile) {
      return new Response(JSON.stringify({ success: false, error: 'Select a valid generation profile for the episode first' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    const universe = strategy.brief_json?.universe_id ? await getUniverseProfile(strategy.brief_json.universe_id) : null;
    const visualIdentity = strategy.brief_json?.visual_identity_preset_id ? await getVisualIdentityPreset(strategy.brief_json.visual_identity_preset_id) : null;

    // Generate plan
    const plan = await generateProductionPlan({
      episode,
      script,
      profile,
      visualIdentity,
      universe
    });

    const snapshot = {
      strategy_positioning: strategy.config_json?.positioning,
      universe_name: universe?.name || universe?.title,
      visual_identity_name: visualIdentity?.name || visualIdentity?.brand_name
    };

    // Save as draft
    const draft = await createProductionPlanDraft({
      episodeId: id,
      plan,
      snapshot,
      approvedScriptId: script.id,
      actor: user
    });

    const assets = await getProductionAssets(draft.id);

    return new Response(JSON.stringify({ success: true, data: { package: draft, assets } }), {
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
