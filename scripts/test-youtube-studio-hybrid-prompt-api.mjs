import assert from 'node:assert/strict';

const baseUrl = process.env.YT_SMOKE_BASE_URL || 'http://100.95.245.55:5020';
const token = process.env.YT_SMOKE_TOKEN;
const authCookie = process.env.YT_SMOKE_AUTH_COOKIE;
const channelId = process.env.YT_SMOKE_CHANNEL_ID;
const seriesId = process.env.YT_SMOKE_SERIES_ID;
const targetDurationSeconds = Number(process.env.YT_SMOKE_DURATION_SECONDS || 60);

if ((!token && !authCookie) || !channelId || !seriesId) {
  console.log('⚠️ [SMOKE TEST] Pending runtime credentials:');
  console.log('  YT_SMOKE_TOKEN or YT_SMOKE_AUTH_COOKIE, YT_SMOKE_CHANNEL_ID, or YT_SMOKE_SERIES_ID is missing.');
  console.log('  Automated unit tests have run, smoke test is PENDING credentials.');
  process.exit(0);
}

const headers = {
  'Content-Type': 'application/json',
  ...(authCookie ? { Cookie: authCookie } : { Authorization: `Bearer ${token}` })
};

async function req(url, options = {}) {
  const fullUrl = `${baseUrl}${url}`;
  const response = await fetch(fullUrl, {
    ...options,
    headers: {
      ...headers,
      ...options.headers
    }
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    throw new Error(`Request to ${url} failed with status ${response.status}: ${JSON.stringify(body)}`);
  }
  return body.data || body;
}

async function runSmokeTest() {
  console.log(`🚀 Starting YouTube Studio Hybrid API Smoke Test to: ${baseUrl}...`);

  // 1. Create short unique episode
  const episodeTitle = `Smoke Test [SMOKE] ${Date.now()}`;
  console.log(`  1. Creating planned episode: "${episodeTitle}"`);
  const epRes = await req('/api/v2/youtube-studio/episodes', {
    method: 'POST',
    body: JSON.stringify({
      channel_id: channelId,
      series_id: seriesId,
      title: episodeTitle,
      locale: 'id-ID'
    })
  });
  const episodeId = epRes.id;
  assert.ok(episodeId);
  console.log(`     Episode created with ID: ${episodeId}`);

  // Set default target duration override
  console.log(`  2. Setting episode target duration (${targetDurationSeconds} seconds)...`);
  await req(`/api/v2/youtube-studio/episodes/${episodeId}/duration`, {
    method: 'POST',
    body: JSON.stringify({
      target_duration_seconds: targetDurationSeconds
    })
  });

  // 3. Generate research with the real route contract.
  console.log('  3. Generating research brief (AI)...');
  await req(`/api/v2/youtube-studio/episodes/${episodeId}/research`, { method: 'POST' });

  // 4. Generate blueprint with the real route contract.
  console.log('  4. Generating blueprint (AI)...');
  const blueprintRes = await req(`/api/v2/youtube-studio/episodes/${episodeId}/blueprint/generate`, { method: 'POST' });
  const blueprintId = blueprintRes.id;
  assert.ok(blueprintId, 'Blueprint ID must be returned by blueprint generation');

  // 5. Approve blueprint
  console.log('  5. Approving blueprint...');
  await req(`/api/v2/youtube-studio/episodes/${episodeId}/blueprint/approve`, {
    method: 'POST',
    body: JSON.stringify({ blueprint_id: blueprintId })
  });

  // 6. Generate script
  console.log('  6. Generating script (AI single-pass)...');
  const scriptRes = await req(`/api/v2/youtube-studio/episodes/${episodeId}/scripts/generate`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  const scriptId = scriptRes.id;
  assert.ok(scriptId);

  // 7. Approve script
  console.log('  7. Approving script...');
  await req(`/api/v2/youtube-studio/episodes/${episodeId}/scripts/approve`, {
    method: 'POST',
    body: JSON.stringify({
      script_id: scriptId,
      review_note: 'Approved via automated smoke test'
    })
  });

  // 8. Select generation profile
  console.log('  8. Setting episode generation profile...');
  await req(`/api/v2/youtube-studio/episodes/${episodeId}/generation-profile`, {
    method: 'POST',
    body: JSON.stringify({
      generation_profile_key: 'google_flow_omni_flash'
    })
  });

  // 9. Generate production plan (hybrid mode)
  console.log('  9. Generating Hybrid Production Plan...');
  const planRes = await req(`/api/v2/youtube-studio/episodes/${episodeId}/production-plan`, {
    method: 'POST',
    body: JSON.stringify({
      production_mode: 'hybrid'
    })
  });

  const { package: pkg, assets } = planRes;
  assert.ok(pkg);
  assert.ok(assets);

  console.log('  10. Running assertions on hybrid draft...');
  // Redacted summary validations
  assert.equal(pkg.status, 'draft');
  const planJson = pkg.plan_json;
  assert.equal(planJson.production_mode, 'hybrid');

  const hybridShots = [];
  assets.forEach(asset => {
    if (asset.asset_type === 'generated_visual' && asset.generation_mode === 't2i_i2v') {
      hybridShots.push(asset);
    }
  });

  assert.ok(hybridShots.length >= 1, 'Expected at least 1 t2i_i2v visual asset in hybrid production plan');
  
  for (const shot of hybridShots) {
    assert.ok(shot.t2i_prompt, 't2i_prompt must be present');
    assert.ok(shot.i2v_prompt, 'i2v_prompt must be present');
    assert.ok(shot.t2i_prompt.trim().length > 0);
    assert.ok(shot.i2v_prompt.trim().length > 0);
  }

  // Ensure no approval/render/external jobs were started
  assert.equal(pkg.status, 'draft');
  const jobsRes = await req(`/api/v2/youtube-studio/episodes/${episodeId}/hybrid-production`, {
    method: 'GET'
  });
  const batches = jobsRes.batches || [];
  assert.equal(batches.length, 0, 'No batches should be generated for a draft package');

  console.log('🎉 SMOKE TEST COMPLETED SUCCESSFULLY!');
  console.log(`  Redacted Summary:`);
  console.log(`    - Episode ID: ${episodeId}`);
  console.log(`    - Production Mode: ${planJson.production_mode}`);
  console.log(`    - Generation Profile: ${pkg.generation_profile_key}`);
  console.log(`    - Total Assets: ${assets.length}`);
  console.log(`    - Total Hybrid Shots: ${hybridShots.length}`);
  console.log(`    - Batches Created: 0 (No external jobs launched)`);
}

runSmokeTest().catch(err => {
  console.error('❌ SMOKE TEST FAILED:', err.message);
  process.exit(1);
});
