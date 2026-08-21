import { withTenantContext } from '@/lib/auth';
import { uploadYouTubeDraft } from '@/lib/youtube-studio-publishing-service';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (req, { params }, user) => {
  const { episodeId } = await params;
  const result = await uploadYouTubeDraft({ episodeId, actor: user });
  return new Response(JSON.stringify({ success: true, data: result }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});
