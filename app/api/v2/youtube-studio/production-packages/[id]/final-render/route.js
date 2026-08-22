import { withYouTubeStudioAccess } from '@/lib/auth';
import { getProductionPackage } from '@/lib/youtube-studio-production-repository';
import { pgQuery } from '@/lib/db-pg.js';
import { getDb } from '@/lib/db.js';

export const dynamic = 'force-dynamic';

export const POST = withYouTubeStudioAccess('write', async (req, { params }, user) => {
  const { id } = await params;
  const tenantId = user.tenant_id || 'default_tenant';
  
  try {
    const pkg = await getProductionPackage(id);
    if (!pkg) {
      return new Response(JSON.stringify({ success: false, error: 'Package not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' }
      });
    }

    if (pkg.status !== 'preview_ready') {
      return new Response(JSON.stringify({ success: false, error: 'Final render requires a successful preview first' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    // Queue final render job
    const finalJobId = `ytpj_fnl_${Math.random().toString(36).slice(2, 10)}`;
    const finalIdemp = `idemp_final_render_${pkg.id}_v1`;

    await pgQuery(`
      INSERT INTO youtube_production_jobs (id, tenant_id, production_package_id, job_kind, idempotency_key, status)
      VALUES ($1, $2, $3, 'final_render', $4, 'queued')
      ON CONFLICT (idempotency_key) DO NOTHING
    `, [finalJobId, tenantId, pkg.id, finalIdemp]);

    // Update package status to final_rendering
    await pgQuery(`
      UPDATE youtube_production_packages SET status = 'final_rendering', updated_at = CURRENT_TIMESTAMP WHERE id = $1
    `, [pkg.id]);

    const sqliteDb = getDb();
    sqliteDb.prepare(`
      INSERT INTO scheduler_jobs (queue_name, payload, tenant_id) 
      VALUES ('youtube_production_final', ?, ?)
    `).run(JSON.stringify({ package_id: pkg.id, job_id: finalJobId }), tenantId);

    return new Response(JSON.stringify({ success: true, data: { job_id: finalJobId } }), {
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
