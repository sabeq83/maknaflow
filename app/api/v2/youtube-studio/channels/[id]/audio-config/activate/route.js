import { withYouTubeStudioAccess } from '@/lib/auth';
import { activateChannelAudioConfig } from '@/lib/youtube-studio-repository';

export const dynamic = 'force-dynamic';

export const POST = withYouTubeStudioAccess('write', async (req, { params }, user) => {
  const { id } = await params;
  try {
    const { config_id } = await req.json();
    const config = await activateChannelAudioConfig(id, config_id, user);
    return new Response(JSON.stringify({ success: true, data: config }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    if (err.code === 'YT_AUDIO_BINDING_INCOMPLETE') {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details
        }
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
});
