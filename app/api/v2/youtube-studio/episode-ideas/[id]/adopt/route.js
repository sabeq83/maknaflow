import { withYouTubeStudioAccess } from '@/lib/auth';
import { adoptEpisodeIdea } from '@/lib/youtube-studio-repository';

export const dynamic = 'force-dynamic';

export const POST = withYouTubeStudioAccess('write', async (req, { params }, user) => {
  const { id } = await params;
  try {
    const episode = await adoptEpisodeIdea(id, user);
    return new Response(JSON.stringify({ success: true, data: episode }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 400 });
  }
});
