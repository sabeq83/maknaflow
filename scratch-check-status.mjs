import { pgQuery } from './lib/db-pg.js';

async function main() {
  await pgQuery(`SET search_path TO dev;`);
  const r = await pgQuery(`SELECT id, status, last_error_message, published_at, external_permalink FROM publishing_jobs WHERE id = 'pub_1786454466513_f5ec774a';`);
  console.log(r.rows);
}

main().then(() => process.exit(0)).catch(console.error);
