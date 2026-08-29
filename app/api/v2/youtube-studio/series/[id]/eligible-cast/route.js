import { withYouTubeStudioAccess } from '@/lib/auth';
import { pgQuery } from '@/lib/db-pg';
import { getChannelSpeakers } from '@/lib/youtube-studio-repository';
import { getActiveTenantId } from '@/lib/tenant-context';

export const dynamic = 'force-dynamic';

export const GET = withYouTubeStudioAccess('read', async (req, { params }, user) => {
  const { id } = await params;
  try {
    const tenantId = getActiveTenantId();
    const seriesRes = await pgQuery('SELECT channel_id FROM youtube_series WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    const channelId = seriesRes.rows[0]?.channel_id;
    if (!channelId) {
      return new Response(JSON.stringify({ success: false, error: 'Series not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' }
      });
    }
    const speakers = await getChannelSpeakers(channelId);
    return new Response(JSON.stringify({ success: true, speakers }), {
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
