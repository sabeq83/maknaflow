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
    await pool.query('SET search_path TO dev');
    const assetId = 'ytpa_vo_cn2q39kr';
    const res = await pool.query('SELECT id, status, output_asset_json, created_at, updated_at FROM youtube_production_assets WHERE id = $1', [assetId]);
    if (res.rows.length > 0) {
      console.log('Asset details:', JSON.stringify(res.rows[0], null, 2));
    } else {
      console.log('Asset not found');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
