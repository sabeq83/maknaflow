import pg from 'pg';

const pool = new pg.Pool({
  host: '100.78.186.123',
  port: 5432,
  user: 'makna_user',
  password: 'maknagridpass',
  database: 'maknaflow_db'
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('SET search_path TO staging, public;');
    console.log('🔧 Starting repair for campaign opc_261005_1t11n5 in staging DB...');

    // 1. Fetch universe profile for kio-wonders
    const uRes = await client.query('SELECT * FROM universe_profiles WHERE slug = $1', ['kio-wonders']);
    if (uRes.rows.length === 0) {
      throw new Error('Universe profile kio-wonders not found in staging database!');
    }
    const universe = uRes.rows[0];
    console.log('Found universe profile:', universe.id, universe.name);

    // 2. Fetch universe characters
    const charsRes = await client.query('SELECT * FROM universe_characters WHERE universe_id = $1 ORDER BY id ASC', [universe.id]);
    const charactersMap = {};
    for (const char of charsRes.rows) {
      charactersMap[char.character_key] = {
        character_id: `kio-wonders_${char.character_key}_v${char.version || 1}`,
        display_name: char.name,
        version: char.version || 1,
        identity_reference_path: char.reference_image_path || `/universe-assets/kio-wonders/characters/${char.character_key}/v1/identity-anchor.png`,
        canonical_description: char.canonical_prompt,
        species: char.species,
        role: char.role
      };
    }
    console.log('Characters mapped:', Object.keys(charactersMap));

    // 3. Fetch universe locations
    const locsRes = await client.query('SELECT * FROM universe_locations WHERE universe_id = $1 ORDER BY id ASC', [universe.id]);
    const locationsList = locsRes.rows.map(loc => ({
      location_key: loc.location_key,
      name: loc.name,
      visual_description: loc.visual_description,
      lighting_default: loc.lighting_default,
      props: loc.props
    }));

    // 4. Construct unified universe snapshot
    const universeSnapshot = {
      content_world: 'cartoon_universe',
      knowledge_domain: 'general',
      story_template: 'character_discovery_arc',
      universe_type: 'character_driven',
      human_presence: 'stylized_3d_avatar',
      visual_style: 'stylized_3d_character',
      scene_count: 8,
      scene_duration: 8,
      aspect_ratio: '9:16',
      character_lock_enabled: true,
      character_lock_scope: 'all_character_clips',
      require_character_references: true,
      require_t2i_start_frame: true,
      allow_pure_t2v_for_character_clips: false,
      manifest: {
        universe_profile: 'kio-wonders',
        version: 1,
        characters: charactersMap,
        locations: locationsList
      }
    };
    const snapshotJson = JSON.stringify(universeSnapshot);

    // 5. Update pillar_campaigns
    await client.query(`
      UPDATE pillar_campaigns 
      SET 
        content_world = 'cartoon_universe',
        universe_profile = 'kio-wonders',
        universe_snapshot_json = $1
      WHERE id = 'opc_261005_1t11n5'
    `, [snapshotJson]);
    console.log('✅ Updated pillar_campaigns for opc_261005_1t11n5');

    // 6. Update pillar_campaign_items
    const itemsRes = await client.query('SELECT id, row_creative_payload FROM pillar_campaign_items WHERE campaign_id = $1 ORDER BY id ASC', ['opc_261005_1t11n5']);
    console.log(`Found ${itemsRes.rows.length} items to update...`);

    for (const item of itemsRes.rows) {
      let payload = {};
      try {
        payload = item.row_creative_payload ? JSON.parse(item.row_creative_payload) : {};
      } catch (_) {}

      payload.content_world = 'cartoon_universe';
      payload.universe_profile = 'kio-wonders';
      payload.universe_snapshot_json = snapshotJson;
      payload.story_template = 'character_discovery_arc';
      payload.main_character = 'Kio';
      payload.supporting_characters = 'BIMO';

      // Clean PawVille terminology in story premise if present
      if (payload.story_premise && typeof payload.story_premise === 'string') {
        payload.story_premise = payload.story_premise.replace(/Mochi/gi, 'Kio').replace(/Dr\.?\s*Paw/gi, 'BIMO');
      }

      const updatedPayloadJson = JSON.stringify(payload);
      await client.query('UPDATE pillar_campaign_items SET row_creative_payload = $1 WHERE id = $2', [updatedPayloadJson, item.id]);
      console.log(`✅ Cleaned and updated item ${item.id}`);
    }

    console.log('🎉 Successfully repaired campaign opc_261005_1t11n5 and all items!');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
