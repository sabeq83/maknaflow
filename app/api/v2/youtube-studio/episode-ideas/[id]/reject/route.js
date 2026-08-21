import { withYouTubeStudioAccess } from '@/lib/auth';
import { rejectEpisodeIdea } from '@/lib/youtube-studio-repository';

export const dynamic = 'force-dynamic';

export const POST = withYouTubeStudioAccess('write', async (req, { params }, user) => {
  const { id } = await params;
  const result = await rejectEpisodeIdea(id);
  if (!result) {
    return new Response(JSON.stringify({ success: false, error: 'Episode idea not found or not in suggested state' }), { status: 400 });
  }
  return new Response(JSON.stringify({ success: true, data: result }), { status: 200 });
});
