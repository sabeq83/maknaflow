import { pgQuery } from '../lib/db-pg.js';

async function verify() {
  console.log('🔍 Menjalankan Verifikasi Status Akun & Jadwal Posting FB...');
  const schemas = ['staging', 'dev'];

  for (const schema of schemas) {
    console.log(`\n=== VERIFIKASI SCHEMA: ${schema} ===`);

    // 1. Cek akun Facebook
    const accs = await pgQuery(`
      SELECT id, tenant_id, platform, provider, display_name, status, last_error_code
      FROM ${schema}.publishing_accounts
      WHERE platform = 'facebook'
    `);
    console.log(`Akun Facebook (${accs.rows.length} akun):`);
    console.table(accs.rows);

    // 2. Cek status jobs Facebook
    const jobs = await pgQuery(`
      SELECT pj.id, pj.tenant_id, pj.platform, pj.status, pj.scheduled_at, pj.attempt_count,
             pa.display_name as account_name
      FROM ${schema}.publishing_jobs pj
      LEFT JOIN ${schema}.publishing_accounts pa ON pa.id = pj.account_id
      WHERE pj.platform = 'facebook'
      ORDER BY pj.scheduled_at ASC
    `);
    console.log(`Total Facebook Jobs: ${jobs.rows.length}`);
    console.table(jobs.rows.slice(0, 15));
  }
}

verify()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
