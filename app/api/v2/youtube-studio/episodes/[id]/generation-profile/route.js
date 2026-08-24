import { withYouTubeStudioAccess } from '@/lib/auth';
import { setEpisodeGenerationProfile } from '@/lib/youtube-studio-repository';

export const dynamic = 'force-dynamic';

export const POST = withYouTubeStudioAccess('write', async (req, { params }, user) => {
  const { id } = await params;
  try {
    const { generation_profile_key, voice_provider, voice_persona } = await req.json();
    if (!generation_profile_key) {
      return new Response(JSON.stringify({ success: false, error: 'Profile key is required' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }
    const updated = await setEpisodeGenerationProfile(id, {
      profileKey: generation_profile_key,
      voiceProvider: voice_provider,
      voicePersona: voice_persona
    }, user);
    return new Response(JSON.stringify({ success: true, data: updated }), {
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
