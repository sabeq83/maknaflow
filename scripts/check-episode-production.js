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
      const assetRes = await pool.query('SELECT DISTINCT asset_type, COUNT(*) FROM youtube_production_assets WHERE production_package_id = $1 GROUP BY asset_type', [activePkg.id]);
      console.log('Distinct asset types found:');
      for (const row of assetRes.rows) {
        console.log(`- Type: "${row.asset_type}", Count: ${row.count}`);
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
