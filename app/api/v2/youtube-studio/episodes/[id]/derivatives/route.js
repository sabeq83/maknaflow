import { withTenantContext } from '@/lib/auth';
import { pgQuery } from '@/lib/db-pg.js';
import { getActiveTenantId } from '@/lib/tenant-context.js';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  const tenantId = getActiveTenantId();
  const res = await pgQuery('SELECT * FROM youtube_episode_short_derivatives WHERE episode_id = $1 AND tenant_id = $2', [id, tenantId]);
  return new Response(JSON.stringify({ success: true, data: res.rows }), { status: 200 });
});

export const POST = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  const tenantId = getActiveTenantId();
  const body = await req.json();

  const derivativeId = `ytsht_${Math.random().toString(36).slice(2, 10)}`;
  const res = await pgQuery(`
    INSERT INTO youtube_episode_short_derivatives (id, tenant_id, episode_id, start_ms, end_ms, status, short_workflow_ref, metadata_json)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
  `, [derivativeId, tenantId, id, body.start_ms || 0, body.end_ms || 30000, 'draft', body.short_workflow_ref || null, JSON.stringify(body.metadata || {})]);

  return new Response(JSON.stringify({ success: true, data: res.rows[0] }), { status: 201 });
});
