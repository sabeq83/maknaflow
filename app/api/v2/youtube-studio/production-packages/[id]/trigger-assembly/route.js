import { withYouTubeStudioAccess } from '@/lib/auth';
import { triggerAssemblyManually } from '@/lib/youtube-studio-production-repository';

export const dynamic = 'force-dynamic';

export const POST = withYouTubeStudioAccess('write', async (req, { params }, user) => {
  const { id } = await params;
  try {
    const result = await triggerAssemblyManually(id);
    return Response.json({ success: true, data: result });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
});
