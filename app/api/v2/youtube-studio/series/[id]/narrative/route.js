import { withYouTubeStudioAccess } from '@/lib/auth';
import { saveSeriesNarrativeFormatAndCast } from '@/lib/youtube-studio-repository';
import { pgQuery } from '@/lib/db-pg';
import { getActiveTenantId } from '@/lib/tenant-context';

export const dynamic = 'force-dynamic';

export const GET = withYouTubeStudioAccess('read', async (req, { params }) => {
  const { id } = await params;
  const tenantId = getActiveTenantId();
  const res = await pgQuery('SELECT * FROM youtube_series WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  const series = res.rows[0];
  if (!series) {
    return new Response(JSON.stringify({ success: false, error: 'Series not found' }), { status: 404 });
  }
  const config = series.config_json || {};
  return new Response(JSON.stringify({
    success: true,
    format: config.narrative_format || {},
    cast: config.recurring_cast || []
  }), { status: 200 });
});

export const PATCH = withYouTubeStudioAccess('write', async (req, { params }, user) => {
  const { id } = await params;
  const body = await req.json();
  try {
    const updated = await saveSeriesNarrativeFormatAndCast(id, body.format, body.cast, user);
    return new Response(JSON.stringify({ success: true, data: updated }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 400 });
  }
});
