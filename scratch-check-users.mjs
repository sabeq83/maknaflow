import { pgQuery } from './lib/db-pg.js';

async function main() {
  await pgQuery(`SET search_path TO dev;`);

  const users = await pgQuery(`SELECT id, username, email, role FROM users;`);
  console.log('=== Users in dev schema ===', users.rows);
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
