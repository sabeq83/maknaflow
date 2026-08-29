import { withYouTubeStudioAccess } from '@/lib/auth';
import { pgQuery } from '@/lib/db-pg';
import { getSeriesCastBindings } from '@/lib/youtube-studio-repository';

export const dynamic = 'force-dynamic';

export const GET = withYouTubeStudioAccess('read', async (req, { params }, user) => {
  const { id } = await params;
  try {
    const epRes = await pgQuery('SELECT series_id FROM youtube_episodes WHERE id = $1', [id]);
    const seriesId = epRes.rows[0]?.series_id;
    if (!seriesId) {
      return new Response(JSON.stringify({ success: false, error: 'Episode not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' }
      });
    }
    const speakers = await getSeriesCastBindings(seriesId);
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
