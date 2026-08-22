import { pgQuery } from './lib/db-pg.js';

async function main() {
  await pgQuery('SET search_path TO dev;');
  
  const columnsRes = await pgQuery(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 're_campaigns' AND table_schema = 'dev';
  `);
  
  console.log('Columns in dev.re_campaigns table:');
  console.table(columnsRes.rows.map(c => ({
    column_name: c.column_name,
    data_type: c.data_type,
    is_nullable: c.is_nullable
  })));
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
