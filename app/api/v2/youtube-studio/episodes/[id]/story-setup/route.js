import { withYouTubeStudioAccess } from '@/lib/auth';
import { saveEpisodeStorySetup, getResolvedNarrativeSnapshot, getEpisode } from '@/lib/youtube-studio-repository';

export const dynamic = 'force-dynamic';

export const GET = withYouTubeStudioAccess('read', async (req, { params }) => {
  const { id } = await params;
  try {
    const episode = await getEpisode(id);
    if (!episode) {
      return new Response(JSON.stringify({ success: false, error: 'Episode not found' }), { status: 404 });
    }
    const resolved = await getResolvedNarrativeSnapshot(id);
    return new Response(JSON.stringify({
      success: true,
      story_setup: episode.narrative_config_json || {},
      resolved
    }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 400 });
  }
});

export const PATCH = withYouTubeStudioAccess('write', async (req, { params }, user) => {
  const { id } = await params;
  const body = await req.json();
  try {
    const updated = await saveEpisodeStorySetup(id, body.override, body.cast, user);
    const resolved = await getResolvedNarrativeSnapshot(id);
    return new Response(JSON.stringify({ success: true, data: updated, resolved }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 400 });
  }
});
