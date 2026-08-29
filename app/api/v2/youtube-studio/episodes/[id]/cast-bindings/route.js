import { withYouTubeStudioAccess } from '@/lib/auth';
import { replaceEpisodeCastBindings } from '@/lib/youtube-studio-repository';

export const dynamic = 'force-dynamic';

export const PUT = withYouTubeStudioAccess('write', async (req, { params }, user) => {
  const { id } = await params;
  try {
    const { speaker_ids } = await req.json();
    const bindings = await replaceEpisodeCastBindings(id, speaker_ids, user);
    return new Response(JSON.stringify({ success: true, data: bindings }), {
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
