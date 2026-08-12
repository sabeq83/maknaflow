import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: '100.78.186.123',
  port: 5432,
  user: 'makna_user',
  password: 'maknagridpass',
  database: 'maknaflow_db',
  max: 2,
});

async function main() {
  try {
    console.log('Connecting to PostgreSQL Staging DB...');
    const client = await pool.connect();
    
    // Set schema to staging
    await client.query('SET search_path TO staging;');
    console.log('Schema set to staging.');

    // Query campaign
    const campaignRes = await client.query('SELECT * FROM pillar_campaigns WHERE id = $1', ['opc_260811_pdcvm7']);
    console.log('\n--- Campaign Details ---');
    if (campaignRes.rows.length === 0) {
      console.log('Campaign opc_260811_pdcvm7 not found in staging.pillar_campaigns!');
    } else {
      console.log(JSON.stringify(campaignRes.rows[0], null, 2));
    }

    // Query items
    const itemsRes = await client.query('SELECT * FROM pillar_campaign_items WHERE campaign_id = $1', ['opc_260811_pdcvm7']);
    console.log('\n--- Campaign Items Details ---');
    console.log(`Found ${itemsRes.rows.length} items.`);
    itemsRes.rows.forEach((item, idx) => {
      console.log(`\nItem ${idx + 1}:`);
      console.log(`ID: ${item.id}`);
      console.log(`Generation Status: ${item.generation_status}`);
      console.log(`TTS Status: ${item.tts_status}`);
      console.log(`Visual Status: ${item.visual_status}`);
      console.log(`FFmpeg Status: ${item.ffmpeg_status}`);
      console.log(`Upload Status: ${item.upload_status}`);
      console.log(`Error Message: ${item.error_message}`);
      console.log(`Visual Clip Paths: ${item.visual_clip_paths}`);
      console.log(`FFmpeg Output Path: ${item.ffmpeg_output_path}`);
      
      if (item.result_json) {
        try {
          const resObj = typeof item.result_json === 'string' ? JSON.parse(item.result_json) : item.result_json;
          console.log(`Result JSON voiceover/titles parsed successfully. Clips count: ${resObj?.clips?.length || 0}`);
        } catch (e) {
          console.log('Result JSON parse failed:', e.message);
        }
      }
    });

    // Query system_audit_logs
    const auditRes = await client.query(
      'SELECT * FROM system_audit_logs WHERE reference_id = $1 OR reference_id = $2 ORDER BY created_at DESC LIMIT 10', 
      ['opc_260811_pdcvm7', '213']
    );
    console.log('\n--- System Audit Logs ---');
    console.log(`Found ${auditRes.rows.length} logs.`);
    auditRes.rows.forEach((log) => {
      console.log(JSON.stringify(log, null, 2));
    });

    // Query tts_studio_clips
    const ttsClipsRes = await client.query(
      'SELECT * FROM tts_studio_clips WHERE batch_id = $1 ORDER BY clip_index ASC', 
      ['ttsb_opc_213_1786479956616']
    );
    console.log('\n--- TTS Studio Clips ---');
    console.log(`Found ${ttsClipsRes.rows.length} clips.`);
    ttsClipsRes.rows.forEach((clip) => {
      console.log(JSON.stringify(clip, null, 2));
    });

    client.release();
  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await pool.end();
  }
}

main();
