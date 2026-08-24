import { withYouTubeStudioAccess } from '@/lib/auth';
import { pgQuery } from '@/lib/db-pg';
import { getChannelStrategy, getChannel } from '@/lib/youtube-studio-repository';
import { generateEpisodeIdeas } from '@/lib/youtube-studio-idea-planner';
import { normalizeLocale } from '@/lib/youtube-studio-contract';

export const dynamic = 'force-dynamic';

export const POST = withYouTubeStudioAccess('write', async (req, { params }, user) => {
  const { id } = await params;
  
  // Fetch series details
  const seriesRes = await pgQuery('SELECT * FROM youtube_series WHERE id = $1 AND tenant_id = $2', [id, user.tenantId]);
  const series = seriesRes.rows[0];
  if (!series) {
    return new Response(JSON.stringify({ success: false, error: 'Series not found' }), { status: 404 });
  }

  // Resolve active strategy
  const strategy = await getChannelStrategy(series.channel_id);
  if (!strategy) {
    return new Response(JSON.stringify({ success: false, error: 'Channel has no active strategy configuration' }), { status: 400 });
  }

  const channel = await getChannel(series.channel_id);
  const locale = normalizeLocale(channel.primary_locale);

  // Generate ideas
  const suggestions = await generateEpisodeIdeas(
    channel,
    strategy,
    series,
    5,
    locale
  );

  const inserted = [];
  for (const sug of suggestions) {
    const ideaId = `ytid_${Math.random().toString(36).slice(2, 10)}`;
    const res = await pgQuery(`
      INSERT INTO youtube_episode_ideas (id, tenant_id, channel_id, series_id, strategy_id, locale, title, angle, content_promise, rationale, target_duration_seconds, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'suggested') RETURNING *
    `, [ideaId, user.tenantId, series.channel_id, series.id, strategy.id, locale, sug.title, sug.angle || null, sug.content_promise || null, sug.rationale || null, sug.target_duration_seconds || 600]);
    inserted.push(res.rows[0]);
  }

  return new Response(JSON.stringify({ success: true, data: inserted }), { status: 200 });
});
