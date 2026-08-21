import { withTenantContext } from '@/lib/auth';
import { pgQuery } from '@/lib/db-pg.js';
import { getActiveTenantId } from '@/lib/tenant-context.js';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  const tenantId = getActiveTenantId();

  const res = await pgQuery('SELECT * FROM youtube_publishing_packages WHERE episode_id = $1 AND tenant_id = $2', [id, tenantId]);
  const data = res.rows[0] || null;

  return new Response(JSON.stringify({ success: true, data }), { status: 200 });
});

export const PATCH = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  const tenantId = getActiveTenantId();
  const body = await req.json();

  const existingRes = await pgQuery('SELECT * FROM youtube_publishing_packages WHERE episode_id = $1 AND tenant_id = $2', [id, tenantId]);
  const existing = existingRes.rows[0];

  if (existing) {
    const res = await pgQuery(`
      UPDATE youtube_publishing_packages
      SET title = $1, description = $2, chapters_json = $3, upload_privacy = $4, approval_status = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND tenant_id = $7 RETURNING *
    `, [body.title, body.description, JSON.stringify(body.chapters || []), body.upload_privacy || 'private', body.approval_status || 'draft', existing.id, tenantId]);
    return new Response(JSON.stringify({ success: true, data: res.rows[0] }), { status: 200 });
  } else {
    const newId = `ytpub_${Math.random().toString(36).slice(2, 10)}`;
    const res = await pgQuery(`
      INSERT INTO youtube_publishing_packages (id, tenant_id, episode_id, title, description, chapters_json, upload_privacy, approval_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `, [newId, tenantId, id, body.title, body.description, JSON.stringify(body.chapters || []), body.upload_privacy || 'private', body.approval_status || 'draft']);
    return new Response(JSON.stringify({ success: true, data: res.rows[0] }), { status: 201 });
  }
});
