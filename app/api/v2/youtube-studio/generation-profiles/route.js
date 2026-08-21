import { withYouTubeStudioAccess } from '@/lib/auth';
import { listPublicGenerationProfiles } from '@/lib/youtube-studio-generation-profiles';

export const dynamic = 'force-dynamic';

export const GET = withYouTubeStudioAccess('read', async () => {
  return new Response(JSON.stringify({ success: true, data: listPublicGenerationProfiles() }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});
