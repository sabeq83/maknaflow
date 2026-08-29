import { withYouTubeStudioAccess } from '@/lib/auth';
import { getTtsCapabilities } from '@/lib/youtube-studio-tts-capabilities';

export const dynamic = 'force-dynamic';

export const GET = withYouTubeStudioAccess('read', async (req, { params }, user) => {
  try {
    const minimax = getTtsCapabilities('minimax');
    const googleTts = getTtsCapabilities('google_tts');
    const glabsFlow = getTtsCapabilities('glabs_google_flow');
    return new Response(JSON.stringify({ success: true, capabilities: { minimax, googleTts, glabsFlow } }), {
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
