import { withYouTubeStudioAccess } from '@/lib/auth';
import { createChannelSpeaker } from '@/lib/youtube-studio-repository';

export const dynamic = 'force-dynamic';

export const POST = withYouTubeStudioAccess('write', async (req, { params }, user) => {
  const { id } = await params;
  try {
    const input = await req.json();
    const speaker = await createChannelSpeaker(id, input, user);
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
