import { withYouTubeStudioAccess } from '@/lib/auth';
import { 
  getEpisode, 
  getLatestScript, 
  getChannelStrategy
} from '@/lib/youtube-studio-repository';
import { getUniverseProfile, getUniverseCharacters, getUniverseLocations } from '@/lib/db';
import { getVisualIdentity } from '@/lib/visual-identity-repository';
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
    const { getLatestAssemblyJob } = await import('@/lib/youtube-studio-production-repository');
    const assets = await getProductionAssets(pkg.id);
    const assemblyJob = await getLatestAssemblyJob(pkg.id);
    return new Response(JSON.stringify({ success: true, data: { package: pkg, assets, assemblyJob } }), {
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

    let universe = null;
    const universeId = strategy.brief_json?.universe_id;
    if (universeId) {
      const profile = await getUniverseProfile(universeId);
      if (profile) {
        const characters = await getUniverseCharacters(universeId) || [];
        const locations = await getUniverseLocations(universeId) || [];
        universe = { profile, characters, locations };
      }
    }
    const visualIdentity = strategy.brief_json?.visual_identity_preset_id ? await getVisualIdentity(strategy.brief_json.visual_identity_preset_id) : null;

    let productionMode = 'legacy_t2v';
    try {
      const body = await req.json();
      if (body?.production_mode) {
        productionMode = body.production_mode;
      }
    } catch (e) {}

    if (productionMode !== 'legacy_t2v' && productionMode !== 'hybrid') {
      return new Response(JSON.stringify({ success: false, error: 'Invalid production mode' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    let plan;
    if (productionMode === 'hybrid') {
      const { createKbSnapshot } = await import('@/lib/youtube-studio-kb-repository');
      const { generateHybridPromptMatrix } = await import('@/lib/youtube-studio-hybrid-planner');
      const kbSnapshot = await createKbSnapshot({
        channelId: episode.channel_id,
        seriesId: episode.series_id,
        stage: 'production'
      });
      
      plan = await generateHybridPromptMatrix({
        episode,
        script,
        profile,
        visualIdentity,
        universe,
        kbSnapshot
      });
    } else {
      plan = await generateProductionPlan({
        episode,
        script,
        profile,
        visualIdentity,
        universe
      });
    }

    // Validate using the unified contract resolver
    const { validateProductionPlanByMode } = await import('@/lib/youtube-studio-contract');
    validateProductionPlanByMode(plan, { profile, episode, productionMode });

    const snapshot = {
      strategy_positioning: strategy.config_json?.positioning,
      universe_name: universe?.name || universe?.title,
      visual_identity_name: visualIdentity?.name || visualIdentity?.brand_name
    };

    // Save as draft
    const draft = await createProductionPlanDraft({
      episodeId: id,
      plan: { ...plan, production_mode: productionMode },
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
