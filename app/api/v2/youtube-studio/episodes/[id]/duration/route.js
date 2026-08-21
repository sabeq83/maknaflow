import { withYouTubeStudioAccess } from '@/lib/auth';
import { updateEpisodeDuration } from '@/lib/youtube-studio-repository';

export const dynamic = 'force-dynamic';

export const POST = withYouTubeStudioAccess('write', async (req, { params }, user) => {
  const { id } = await params;
  try {
    const { target_duration_seconds } = await req.json();
    if (!target_duration_seconds) {
      return new Response(JSON.stringify({ success: false, error: 'Duration is required' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }
    const updated = await updateEpisodeDuration(id, target_duration_seconds, user);
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
