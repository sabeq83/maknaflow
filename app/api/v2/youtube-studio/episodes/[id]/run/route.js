import { withTenantContext } from '@/lib/auth';
import { getEpisode, getLatestScript, getChannelStrategy } from '@/lib/youtube-studio-repository';
import { createProductionSnapshot } from '@/lib/youtube-studio-snapshot-service';
import { pgQuery } from '@/lib/db-pg.js';
import { getActiveTenantId } from '@/lib/tenant-context.js';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  const tenantId = getActiveTenantId();

  const episode = await getEpisode(id);
  if (!episode) {
    return new Response(JSON.stringify({ success: false, error: 'Episode not found' }), { status: 404 });
  }

  const script = await getLatestScript(id);
  if (!script || script.status !== 'approved') {
    return new Response(JSON.stringify({ success: false, error: 'Production rejected: episode script is not approved' }), { status: 400 });
  }

  const strategy = await getChannelStrategy(episode.channel_id);
  if (!strategy) {
    return new Response(JSON.stringify({ success: false, error: 'Strategy not found' }), { status: 400 });
  }

  // 1. Create strategy/universe/visual identity snapshot
  await createProductionSnapshot({ episode, strategy });

  // 2. Enqueue render job (Idempotent: Reuse existing queued/running job)
  const idempotencyKey = `yt_prod_${id}_script_${script.id}`;
  const existingJob = await pgQuery(
    'SELECT * FROM youtube_render_jobs WHERE tenant_id = $1 AND idempotency_key = $2',
    [tenantId, idempotencyKey]
  );

  if (existingJob.rows[0]) {
    return new Response(JSON.stringify({ success: true, data: existingJob.rows[0], message: 'Job already exists' }), { status: 200 });
  }

  const jobId = `ytr_${Math.random().toString(36).slice(2, 10)}`;
  const inserted = await pgQuery(`
    INSERT INTO youtube_render_jobs (id, tenant_id, episode_id, job_type, idempotency_key, status)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
  `, [jobId, tenantId, id, 'final', idempotencyKey, 'queued']);

  // Update episode status
  await pgQuery('UPDATE youtube_episodes SET status = \'In Production\' WHERE id = $1', [id]);

  // Enqueue job via central scheduler queue
  const { getDb } = await import('@/lib/db.js');
  const db = getDb();
  await db.prepare('INSERT INTO scheduler_jobs (queue_name, payload, tenant_id) VALUES (?, ?, ?)')
    .run('youtube_production', JSON.stringify({ job_id: jobId }), tenantId);

  return new Response(JSON.stringify({ success: true, data: inserted.rows[0] }), { status: 201 });
});
