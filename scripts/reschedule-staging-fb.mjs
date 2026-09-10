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

  console.log('--- 1. MERESET STATUS AKUN DI STAGING.PUBLISHING_ACCOUNTS ---');
  const accUpdate = await pool.query(`
    UPDATE staging.publishing_accounts
    SET 
      status = 'active',
      last_error_code = NULL,
      last_error_message = NULL,
      last_verified_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE provider = 'repliz'
    RETURNING id, tenant_id, platform, display_name, status
  `);
  console.log(`Updated ${accUpdate.rowCount} accounts to active:`);
  for (const a of accUpdate.rows) {
    console.log(`- [${a.platform}] ${a.display_name} (${a.id}) -> ${a.status}`);
  }

  console.log('\n--- 2. MENCARI JOB FB DENGAN STATUS NEEDS_REVIEW DI STAGING ---');
  const needsReviewJobs = await pool.query(`
    SELECT id, tenant_id, account_id, platform, scheduled_at, status, last_error_code
    FROM staging.publishing_jobs
    WHERE platform = 'facebook' AND status = 'needs_review'
    ORDER BY scheduled_at ASC
  `);
  console.log(`Found ${needsReviewJobs.rowCount} FB jobs in needs_review:`);
  
  // Waktu mulai: hari ini 10 Sept 2026 jam 09:09:00 WIB (02:09:00 UTC)
  // Jeda 2 jam per slot postingan
  let baseTime = new Date('2026-09-10T02:09:00.000Z'); // 09:09 WIB
  
  for (let i = 0; i < needsReviewJobs.rows.length; i++) {
    const job = needsReviewJobs.rows[i];
    // Slot waktu berikutnya
    const newScheduledAt = new Date(baseTime.getTime() + i * 2 * 60 * 60 * 1000);
    
    await pool.query(`
      UPDATE staging.publishing_jobs
      SET 
        status = 'scheduled',
        scheduled_at = $1,
        next_attempt_at = $1,
        attempt_count = 0,
        last_error_code = NULL,
        last_error_message = NULL,
        provider_stage = NULL,
        external_schedule_id = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [newScheduledAt.toISOString(), job.id]);

    console.log(`- Rescheduled ${job.id} (${job.tenant_id}) -> ${newScheduledAt.toISOString()} (WIB: ${new Date(newScheduledAt.getTime() + 7*3600*1000).toISOString().replace('T', ' ').slice(0, 19)})`);
  }

  console.log('\n--- 3. VERIFIKASI STATUS SELURUH JOB FB DI STAGING ---');
  const allFb = await pool.query(`
    SELECT id, tenant_id, scheduled_at, status, last_error_code
    FROM staging.publishing_jobs
    WHERE platform = 'facebook'
    ORDER BY scheduled_at ASC
  `);
  console.log(`Total Staging FB Jobs: ${allFb.rowCount}`);
  const summary = allFb.rows.reduce((acc, j) => { acc[j.status] = (acc[j.status] || 0) + 1; return acc; }, {});
  console.log('Status Breakdown:', summary);

  await pool.end();
}

run().catch(console.error);
