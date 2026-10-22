import { pathToFileURL } from 'node:url';
export const campaignFirstDDL = `
 ALTER TABLE content_studio_batches ADD COLUMN IF NOT EXISTS engine_kind TEXT,
 ADD COLUMN IF NOT EXISTS request_hash TEXT;
 ALTER TABLE content_studio_slots ADD COLUMN IF NOT EXISTS output_key TEXT,
 ADD COLUMN IF NOT EXISTS output_snapshot_json JSONB,
 ADD COLUMN IF NOT EXISTS dispatch_owner TEXT,
 ADD COLUMN IF NOT EXISTS lease_until TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS legacy_requires_review BOOLEAN NOT NULL DEFAULT false;
 CREATE UNIQUE INDEX IF NOT EXISTS studio_batch_output_unique ON content_studio_slots(tenant_id,batch_id,output_key) WHERE output_key IS NOT NULL;
 -- Existing batches were forced through Planner with ambiguous production lineage.
 -- Preserve records and consumption; require review, never automatically retry them.
 UPDATE content_studio_slots s SET legacy_requires_review=true
 FROM content_studio_batches b WHERE s.batch_id=b.id AND b.engine_kind IS NULL;
 UPDATE content_studio_batches SET status='paused' WHERE engine_kind IS NULL AND status='active';
`;
export async function migrateCampaignFirst({ schema, apply = false }) {
  if (!['dev', 'staging'].includes(schema) && !/^studio_test_[a-z0-9_]+$/.test(schema || '')) throw Error('Schema dev/staging atau studio_test_* wajib eksplisit. Production ditolak.');
  process.env.DISABLE_AUTO_MIGRATIONS = 'true';
  const { getPgPool } = await import('../lib/db-pg.js');
  const pool = getPgPool(); const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO "${schema}"`);
    const counts = await client.query('SELECT status,COUNT(*)::int count FROM content_studio_batches GROUP BY status');
    console.log(JSON.stringify({ schema, apply, batches: counts.rows }));
    if (apply) { await client.query("SELECT pg_advisory_xact_lock(hashtext('studio_campaign_first_v2'))"); await client.query(campaignFirstDDL); }
    await client.query(apply ? 'COMMIT' : 'ROLLBACK');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); await pool.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
 const args = process.argv.slice(2), schema = args[args.indexOf('--schema') + 1];
 if (args.includes('--apply') && !args.includes(`--confirm-${schema}`)) throw Error('Confirmation schema wajib.');
 await migrateCampaignFirst({ schema, apply: args.includes('--apply') });
}
