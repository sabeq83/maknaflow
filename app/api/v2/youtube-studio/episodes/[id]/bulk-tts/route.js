import { withYouTubeStudioAccess } from '@/lib/auth';
import { invalidateAllVoiceoverAssets } from '@/lib/youtube-studio-production-repository';

export const dynamic = 'force-dynamic';

export const POST = withYouTubeStudioAccess('write', async (req, { params }, user) => {
  const { id } = await params;
  try {
    const result = await invalidateAllVoiceoverAssets(id, user);
    return new Response(JSON.stringify({ success: true, count: result.count }), {
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
