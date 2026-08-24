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

    const epRes = await pool.query('SELECT * FROM youtube_episodes WHERE id = $1', [epId]);
    const ep = epRes.rows[0];
    console.log(`Episode status: ${ep.status}`);
    
    const scriptRes = await pool.query('SELECT * FROM youtube_episode_scripts WHERE episode_id = $1', [epId]);
    if (scriptRes.rows.length > 0) {
      const script = scriptRes.rows[0];
      console.log(`Script found. ID: ${script.id}, Status: ${script.status}`);
    } else {
      console.log('No script found for this episode');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
