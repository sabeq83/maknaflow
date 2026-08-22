import { withYouTubeStudioAccess } from '@/lib/auth';
import { approveProductionPlan } from '@/lib/youtube-studio-production-repository';

export const dynamic = 'force-dynamic';

export const POST = withYouTubeStudioAccess('write', async (req, { params }, user) => {
  const { id } = await params;
  try {
    const pkg = await approveProductionPlan(id, user);
    return new Response(JSON.stringify({ success: true, data: pkg }), {
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
