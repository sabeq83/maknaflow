import pkg from 'pg';
const { Pool } = pkg;

async function run() {
  const pool = new Pool({
    host: '100.78.186.123',
    port: 5432,
    user: 'makna_user',
    password: 'maknagridpass',
    database: 'maknaflow_db',
  });

  console.log('=== ATTEMPTS TODAY (2026-09-10) ===');
  const attempts = await pool.query(`
    SELECT id, tenant_id, job_id, attempt_number, stage, outcome, http_status, provider_error_code, sanitized_message, started_at, finished_at
    FROM staging.publishing_attempts 
    WHERE started_at >= '2026-09-10T00:00:00Z'
    ORDER BY started_at ASC
  `);
  console.log('Attempts Count:', attempts.rows.length);
  console.log('Attempts Details:', JSON.stringify(attempts.rows, null, 2));

  if (attempts.rows.length > 0) {
    const jobIds = [...new Set(attempts.rows.map(a => a.job_id))];
    const jobs = await pool.query(`
      SELECT id, tenant_id, account_id, platform, media_type, status, scheduled_at, last_error_code, last_error_message, provider_stage, provider_state_json
      FROM staging.publishing_jobs 
      WHERE id = ANY($1::text[])
    `, [jobIds]);
    console.log('Matching Jobs Details:', JSON.stringify(jobs.rows, null, 2));
  }

  console.log('=== ALL FB JOBS IN STAGING ===');
  const allFb = await pool.query(`
    SELECT id, tenant_id, account_id, platform, media_type, status, scheduled_at, last_error_code, last_error_message, provider_stage, external_schedule_id
    FROM staging.publishing_jobs
    WHERE platform = 'facebook'
    ORDER BY scheduled_at ASC
  `);
  console.log('Total FB Jobs count:', allFb.rows.length);
  for (const j of allFb.rows) {
    console.log(`[${j.tenant_id}] ${j.id} | ${j.scheduled_at.toISOString()} | status: ${j.status} | err: ${j.last_error_code || '-'} | msg: ${j.last_error_message || '-'}`);
  }

  console.log('=== ACCOUNTS IN STAGING ===');
  const accs = await pool.query(`
    SELECT id, tenant_id, platform, provider_account_id, is_active, status_reason, last_health_check_at, error_count
    FROM staging.publishing_accounts
  `);
  console.log('Accounts:', JSON.stringify(accs.rows, null, 2));

  await pool.end();
}

run().catch(console.error);
