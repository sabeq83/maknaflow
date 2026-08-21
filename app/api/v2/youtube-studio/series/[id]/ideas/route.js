import { withYouTubeStudioAccess } from '@/lib/auth';
import { listEpisodeIdeas } from '@/lib/youtube-studio-repository';

export const dynamic = 'force-dynamic';

export const GET = withYouTubeStudioAccess('read', async (req, { params }, user) => {
  const { id } = await params;
  const data = await listEpisodeIdeas(id);
  return new Response(JSON.stringify({ success: true, data }), { status: 200 });
});
