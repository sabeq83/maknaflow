import { withTenantContext } from '@/lib/auth';
import { pgQuery } from '@/lib/db-pg.js';
import { getActiveTenantId } from '@/lib/tenant-context.js';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, { params }, user) => {
  const { id } = await params;
  const tenantId = getActiveTenantId();

  const res = await pgQuery('SELECT * FROM youtube_render_jobs WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  const data = res.rows[0];
  if (!data) {
    return new Response(JSON.stringify({ success: false, error: 'Job not found' }), { status: 404 });
  }

  return new Response(JSON.stringify({ success: true, data }), { status: 200 });
});
