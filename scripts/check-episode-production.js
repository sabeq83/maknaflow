import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: '100.78.186.123',
  port: 5432,
  database: 'maknaflow_db',
  user: 'makna_user',
  password: 'maknagridpass',
  ssl: false
});

async function check() {
  try {
    const epId = 'ytep_3suyq35q';
    await pool.query('SET search_path TO dev');

    const pkgRes = await pool.query('SELECT * FROM youtube_production_packages WHERE episode_id = $1', [epId]);
    const activePkg = pkgRes.rows.find(p => p.status !== 'archived');
    
    if (activePkg) {
      const assetRes = await pool.query('SELECT id, asset_type, status, output_asset_json FROM youtube_production_assets WHERE production_package_id = $1 AND status = \'succeeded\' LIMIT 5', [activePkg.id]);
      console.log('Sample succeeded assets output_asset_json:');
      for (const row of assetRes.rows) {
        console.log(`\n- ID: ${row.id}, Type: ${row.asset_type}`);
        console.log(`  JSON:`, JSON.stringify(row.output_asset_json, null, 2));
      }
    } else {
      console.log('No active production package found.');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
