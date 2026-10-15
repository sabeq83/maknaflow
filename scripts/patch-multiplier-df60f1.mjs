import pkg from 'pg';
const { Client } = pkg;

const PG_HOST = process.env.PGHOST || '100.78.186.123';
const PG_PORT = parseInt(process.env.PGPORT || '5432', 10);
const PG_USER = process.env.PGUSER || 'makna_user';
const PG_PASSWORD = process.env.PGPASSWORD || 'maknagridpass';
const PG_DATABASE = process.env.PGDATABASE || 'maknaflow_db';

const targetBatchId = 'mtb_df60f17a012440f9';
const brandProfileId = '940e766b-76d0-49b7-b6d5-01dfb0041d40';
const accountName = 'nutribake';
const campaignName = '[ MULTIPLIER 20261015 ] - nutribake - Tantangan Diet 7 Hari Tanpa Tepung & Gula Pasir';

async function patchSchema(schemaName) {
  console.log(`\n======================================================`);
  console.log(`🔧 Patching schema: ${schemaName}`);
  console.log(`======================================================`);

  const client = new Client({
    host: PG_HOST,
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASSWORD,
    database: PG_DATABASE
  });

  try {
    await client.connect();
    await client.query(`SET search_path TO ${schemaName}, public;`);

    // 1. Ensure columns exist
    console.log(`📡 Adding columns if not exist...`);
    await client.query(`ALTER TABLE re_multiplier_tasks ADD COLUMN IF NOT EXISTS campaign_name VARCHAR(255);`);
    await client.query(`ALTER TABLE re_multiplier_tasks ADD COLUMN IF NOT EXISTS brand_profile_id VARCHAR(100);`);
    await client.query(`ALTER TABLE re_multiplier_tasks ADD COLUMN IF NOT EXISTS account_name VARCHAR(100);`);
    await client.query(`CREATE INDEX IF NOT EXISTS re_multiplier_tasks_brand_idx ON re_multiplier_tasks (tenant_id, brand_profile_id);`);

    // 2. Check current rows
    const beforeRes = await client.query(`SELECT id, batch_id, row_index, campaign_name, brand_profile_id, account_name FROM re_multiplier_tasks WHERE batch_id = $1 ORDER BY row_index ASC`, [targetBatchId]);
    console.log(`Found ${beforeRes.rows.length} rows for batch ${targetBatchId} in schema ${schemaName}`);

    if (beforeRes.rows.length > 0) {
      // 3. Update rows
      const updateRes = await client.query(`
        UPDATE re_multiplier_tasks
        SET 
          campaign_name = $1,
          brand_profile_id = $2,
          account_name = $3
        WHERE batch_id = $4
      `, [campaignName, brandProfileId, accountName, targetBatchId]);
      console.log(`✓ Updated ${updateRes.rowCount} rows!`);

      // 4. Verify after
      const afterRes = await client.query(`SELECT id, batch_id, row_index, campaign_name, brand_profile_id, account_name FROM re_multiplier_tasks WHERE batch_id = $1 ORDER BY row_index ASC`, [targetBatchId]);
      console.log(`✓ Verification for schema ${schemaName}:`);
      afterRes.rows.forEach(r => {
        console.log(`  Row ${r.row_index}: id=${r.id}, account=${r.account_name}, brand_id=${r.brand_profile_id}, campaign=${r.campaign_name}`);
      });
    } else {
      console.log(`ℹ️ No rows found for batch ${targetBatchId} in schema ${schemaName}`);
    }

  } catch (err) {
    console.error(`❌ Error patching schema ${schemaName}:`, err.message);
  } finally {
    await client.end();
  }
}

async function main() {
  await patchSchema('staging');
  await patchSchema('dev');
  console.log('\n✅ Database patch finished.');
}

main();
