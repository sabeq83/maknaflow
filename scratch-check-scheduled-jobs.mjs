import { getPgPool } from './lib/db-pg.js';

async function checkScheduledJobs() {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO dev;`);

    const jobsRes = await client.query(`
      SELECT 
        id, content_id, platform, publish_mode, media_type,
        media_url_snapshot, scheduled_at, status, attempt_count, created_at
      FROM publishing_jobs
      ORDER BY scheduled_at ASC;
    `);

    console.log(`=== Found ${jobsRes.rowCount} Publishing Jobs in dev schema ===`);
    console.table(jobsRes.rows);

    const controlRes = await client.query(`
      SELECT * FROM publishing_controls;
    `);
    console.log(`=== Publishing Controls in dev schema ===`);
    console.table(controlRes.rows);

  } finally {
    client.release();
    process.exit(0);
  }
}

checkScheduledJobs().catch(console.error);
