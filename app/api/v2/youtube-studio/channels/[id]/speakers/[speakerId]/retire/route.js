import { withYouTubeStudioAccess } from '@/lib/auth';
import { retireChannelSpeaker } from '@/lib/youtube-studio-repository';

export const dynamic = 'force-dynamic';

export const POST = withYouTubeStudioAccess('write', async (req, { params }, user) => {
  const { id, speakerId } = await params;
  try {
    const speaker = await retireChannelSpeaker(id, speakerId, user);
    return new Response(JSON.stringify({ success: true, data: speaker }), {
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
