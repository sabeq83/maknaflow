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
    console.log('🔧 Injecting canonical T2I prompts for Item 1595 in staging DB...');

    // 1. Fetch universe characters for Kio Wonders
    const uRes = await client.query('SELECT * FROM universe_profiles WHERE slug = $1', ['kio-wonders']);
    const universe = uRes.rows[0];
    const charsRes = await client.query('SELECT * FROM universe_characters WHERE universe_id = $1 ORDER BY id ASC', [universe.id]);
    
    const charactersMap = {};
    for (const c of charsRes.rows) {
      charactersMap[c.character_key] = c.canonical_prompt;
      charactersMap[c.name.toLowerCase()] = c.canonical_prompt;
    }
    console.log('Canonical prompts loaded for:', Object.keys(charactersMap));

    // 2. Fetch Item 1595
    const itemRes = await client.query('SELECT id, result_json, new_video_plan_json FROM pillar_campaign_items WHERE id = 1595');
    const item = itemRes.rows[0];
    if (!item) throw new Error('Item 1595 not found');

    let resultJson = typeof item.result_json === 'string' ? JSON.parse(item.result_json) : (item.result_json || {});
    let videoPlan = typeof item.new_video_plan_json === 'string' ? JSON.parse(item.new_video_plan_json) : (item.new_video_plan_json || []);

    const storyboard = resultJson.storyboard || [];
    const t2iPrompts = resultJson.t2i_prompts || [];

    // Helper to enrich prompt
    function enrich(sceneChars, promptText, actionText) {
      let t2i = promptText || '';
      const chars = Array.isArray(sceneChars) && sceneChars.length > 0
        ? sceneChars
        : ['kio', 'bimo'].filter(name => (actionText || t2i).toLowerCase().includes(name));

      const canonsToInject = [];
      for (const k of chars) {
        const canon = charactersMap[k.toLowerCase().replace(/[\s\.]+/g, '_')] || charactersMap[k.toLowerCase()];
        if (canon && !t2i.includes(canon) && !canonsToInject.includes(canon)) {
          canonsToInject.push(canon);
        }
      }
      if (canonsToInject.length > 0) {
        t2i = `${canonsToInject.join(', ')}, ${t2i}`;
      }
      return t2i;
    }

    // Enrich videoPlan
    const updatedPlan = (videoPlan.length > 0 ? videoPlan : storyboard).map((clip, idx) => {
      const scene = storyboard[idx] || {};
      const origT2i = clip.t2i_prompt || (t2iPrompts[idx]?.prompt) || clip.visual_prompt || scene.visual_prompt || '';
      const finalT2i = enrich(scene.characters, origT2i, clip.visual_action || scene.visual_description);
      return {
        ...clip,
        clip_index: clip.clip_index || (idx + 1),
        t2i_prompt: finalT2i
      };
    });

    // Enrich resultJson.t2i_prompts
    resultJson.t2i_prompts = updatedPlan.map(p => ({
      clip: p.clip_index,
      prompt: p.t2i_prompt
    }));

    // Update DB
    await client.query(
      'UPDATE pillar_campaign_items SET result_json = $1, new_video_plan_json = $2 WHERE id = 1595',
      [JSON.stringify(resultJson), JSON.stringify(updatedPlan)]
    );

    console.log('✅ Successfully injected canonical T2I prompts to Item 1595!');
    console.log('Sample Clip 2 Prompt Excerpt:');
    console.log(updatedPlan[1]?.t2i_prompt.slice(0, 300) + '...');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
