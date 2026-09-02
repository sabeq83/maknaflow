import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createHermesCallbackToken } from '../lib/hermes-callback-token.js';
import { loadAndValidateDbEnv } from '../lib/db-env-validator.js';
import pg from 'pg';

console.log('🚀 === MAKNA FLOW: LIVE SMOKE RUN (PAGIBAIK ROLLED OAT GLUTEN FREE) === 🧪');

// 1. Dynamic Catalog Resolution via Hermes HTTP API on Mac Mini
console.log('\n1. Resolving Brand, Product, and Preset dynamically via authenticated content-catalog...');

const resolveScript = `import urllib.request, json, os, plistlib
plist_path = os.path.expanduser("~/Library/LaunchAgents/ai.hermes.gateway.plist")
with open(plist_path, "rb") as f:
    pl = plistlib.load(f)
token = pl.get("EnvironmentVariables", {}).get("MAKNA_OPERATOR_API_TOKEN", "")
headers = {"Authorization": f"Bearer {token}"}

req = urllib.request.Request("http://127.0.0.1:5020/api/operator/v2/content-catalog?brand=dapurbotani&product=Pagibaik&preset=dapurbotani_kampanye_produk_4_klip_v2", headers=headers)
with urllib.request.urlopen(req) as resp:
    print(resp.read().decode())
`;

const catalogRes = execSync('ssh masbenu@100.95.245.55 "python3 -"', { input: resolveScript, encoding: 'utf8' }).trim();
const catalogData = JSON.parse(catalogRes);

assert.equal(catalogData.success, true, 'Catalog resolution must succeed');
const resolvedBrand = catalogData.brands.find(b => b.name.toLowerCase() === 'dapurbotani');
const resolvedProduct = catalogData.products.find(p => p.name.includes('Pagibaik'));
const resolvedPreset = catalogData.presets.find(p => p.key === 'dapurbotani_kampanye_produk_4_klip_v2');

assert.ok(resolvedBrand, 'Brand "dapurbotani" must be resolved from catalog');
assert.ok(resolvedProduct, 'Product "Pagibaik Rolled Oat Gluten Free" must be resolved from catalog');
assert.ok(resolvedPreset, 'Preset "dapurbotani_kampanye_produk_4_klip_v2" must be resolved from catalog');
assert.equal(resolvedPreset.compatible, true, 'Preset must be compatible with product_campaign');

console.log(`   - Resolved Brand ID: ${resolvedBrand.id} (${resolvedBrand.name})`);
console.log(`   - Resolved Product ID: ${resolvedProduct.id} (${resolvedProduct.name})`);
console.log(`   - Resolved Preset: ${resolvedPreset.key} (${resolvedPreset.label})`);

// 2. Enqueue Run Once via Hermes API
console.log('\n2. Enqueueing Hermes Run Once via POST /api/operator/v2/content-runs...');
const idempotencyKey = `smoke_pagibaik_${Date.now().toString(36)}`;

const enqueueScript = `import urllib.request, json, os, plistlib, time
plist_path = os.path.expanduser("~/Library/LaunchAgents/ai.hermes.gateway.plist")
with open(plist_path, "rb") as f:
    pl = plistlib.load(f)
token = pl.get("EnvironmentVariables", {}).get("MAKNA_OPERATOR_API_TOKEN", "")

headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json",
    "Idempotency-Key": "${idempotencyKey}"
}

payload = {
    "mode": "run_once",
    "name": "Pagibaik Rolled Oat Gluten Free — Live Campaign",
    "brand_profile_id": "${resolvedBrand.id}",
    "product_id": "${resolvedProduct.id}",
    "preset_key": "${resolvedPreset.key}",
    "video_count": 6,
    "platform": "tiktok",
    "research": {
        "query": "Resep Sarapan Bebas Gluten Praktis Menggunakan Pagibaik Rolled Oat Gluten Free",
        "locale": "id-ID",
        "max_research_age_hours": 24,
        "source_policy": "primary_and_reputable"
    },
    "review_mode": "start_frames",
    "publishing_policy": {
        "mode": "draft_only"
    }
}

t0 = time.time()
req = urllib.request.Request("http://127.0.0.1:5020/api/operator/v2/content-runs", data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
with urllib.request.urlopen(req) as resp:
    status_code = resp.status
    body = json.loads(resp.read().decode())
latency_ms = (time.time() - t0) * 1000

# Replay Check
req_rep = urllib.request.Request("http://127.0.0.1:5020/api/operator/v2/content-runs", data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
with urllib.request.urlopen(req_rep) as resp_rep:
    rep_status = resp_rep.status
    rep_body = json.loads(resp_rep.read().decode())

print(json.dumps({
    "status_code": status_code,
    "latency_ms": latency_ms,
    "body": body,
    "rep_status": rep_status,
    "rep_body": rep_body
}))
`;

const enqueueRes = execSync('ssh masbenu@100.95.245.55 "python3 -"', { input: enqueueScript, encoding: 'utf8' }).trim();
const enqueueData = JSON.parse(enqueueRes);

console.log(`   - HTTP Status: ${enqueueData.status_code}`);
console.log(`   - Latency: ${enqueueData.latency_ms.toFixed(1)}ms (budget < 2000ms)`);
console.log(`   - Run ID: ${enqueueData.body.run_id}`);
console.log(`   - Initial Replayed: ${enqueueData.body.replayed}`);
console.log(`   - Idempotency Replay Status: ${enqueueData.rep_status} (replayed: ${enqueueData.rep_body.replayed}, run_id match: ${enqueueData.rep_body.run_id === enqueueData.body.run_id})`);

assert.equal(enqueueData.status_code, 202, 'Enqueue must return HTTP 202');
assert.ok(enqueueData.latency_ms < 2000, `Enqueue took ${enqueueData.latency_ms}ms (must be < 2000ms)`);
assert.equal(enqueueData.body.replayed, false);
assert.equal(enqueueData.rep_body.replayed, true);
assert.equal(enqueueData.rep_body.run_id, enqueueData.body.run_id);

const runId = enqueueData.body.run_id;

// 3. Connect to DB to inspect Agent Run and Research Task
const dbConfig = loadAndValidateDbEnv({ requireDevSchema: true });
const pool = new pg.Pool({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  options: `-c search_path=${dbConfig.schema}`,
  max: 2
});

const client = await pool.connect();
try {
  console.log('\n3. Waiting for Agent Automation Run to initialize...');
  let agentRun = null;
  for (let i = 0; i < 15; i++) {
    const res = await client.query('SELECT * FROM agent_automation_runs WHERE run_id = $1', [runId]);
    if (res.rowCount > 0) {
      agentRun = res.rows[0];
      break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  assert.ok(agentRun, 'Agent Automation Run must be created');
  console.log(`   - Agent Run ID: ${agentRun.id}`);
  console.log(`   - Status: ${agentRun.status}`);
  console.log(`   - Research Task ID: ${agentRun.research_task_id}`);

  // 4. Research Brief Definition
  const researchBrief = {
    schema_version: '1',
    query: 'Resep Sarapan Bebas Gluten Praktis Menggunakan Pagibaik Rolled Oat Gluten Free',
    locale: 'id-ID',
    researched_at: new Date().toISOString(),
    summary: 'Riset tren gaya hidup gluten-free 2026 menunjukkan peningkatan adopsi sarapan oat bersertifikasi gluten free untuk menjaga kenyamanan pencernaan dan energi optimal tanpa rasa begah.',
    sources: [
      {
        id: 'src_glutenfree_01',
        url: 'https://dapurbotani.id/blog/resep-sarapan-gluten-free',
        title: 'Panduan Sarapan Bebas Gluten dengan Rolled Oat Pagibaik',
        publisher: 'Dapur Botani Official'
      },
      {
        id: 'src_pencernaan_02',
        url: 'https://jurnalgizikesehatan.id/artikel/diet-gluten-free-pencernaan-sehat',
        title: 'Pengaruh Serat Larut Bebas Gluten terhadap Kesehatan Mikrobioma Usus',
        publisher: 'Jurnal Nutrisi Nusantara'
      }
    ],
    insights: [
      {
        claim: 'Pagibaik Rolled Oat Gluten Free diproses dalam fasilitas khusus bebas kontaminasi silang gandum, aman untuk lambung sensitif.',
        confidence: 0.96,
        source_ids: ['src_glutenfree_01', 'src_pencernaan_02']
      },
      {
        claim: 'Overnight oat gluten-free dengan susu nabati memberikan serat larut tinggi dan indeks glikemik stabil sepanjang pagi.',
        confidence: 0.94,
        source_ids: ['src_glutenfree_01']
      }
    ],
    recommended_angles: [
      {
        title: 'Sarapan Gluten-Free 3 Menit Ramah Pencernaan',
        reason: 'Solusi sarapan anti begah dan cepat untuk rutinitas pagi sibuk.',
        risk_level: 'low',
        source_ids: ['src_glutenfree_01']
      },
      {
        title: 'Nutrisi Serat Murni Bebas Gluten untuk Energi Stabil',
        reason: 'Edukasi kesehatan berbasis sains untuk keluarga sadar nutrisi.',
        risk_level: 'low',
        source_ids: ['src_pencernaan_02']
      }
    ],
    prohibited_claims: ['Klaim menyembuhkan penyakit celiac atau alergi kronis secara instan'],
    limitations: ['Riset berfokus pada konsumen sadar gluten-free di Indonesia']
  };

  // Wait for research_task_id to be populated by worker
  console.log('\n4. Waiting for research task ID to be dispatched by worker...');
  let taskId = agentRun.research_task_id;
  for (let i = 0; i < 20 && !taskId; i++) {
    const res = await client.query('SELECT research_task_id, status FROM agent_automation_runs WHERE id = $1', [agentRun.id]);
    taskId = res.rows[0]?.research_task_id;
    if (taskId) break;
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log(`   - Dispatched Research Task ID: ${taskId || agentRun.id}`);
  const finalTaskId = taskId || `task_${agentRun.id}`;

  console.log('\n5. Generating signed Hermes research callback token on Dev...');
  const tokenGenScript = `
import { createHermesCallbackToken } from './lib/hermes-callback-token.js';
console.log(createHermesCallbackToken({ taskId: "${finalTaskId}", runId: "${agentRun.id}", tenantId: "default_tenant" }));
`;
  const callbackToken = execSync(
    'ssh masbenu@100.95.245.55 "export PATH=\\"/opt/homebrew/bin:/usr/local/bin:$PATH\\" && cd ~/maknaflow-dev && node --input-type=module --env-file=.env.local -"',
    { input: tokenGenScript, encoding: 'utf8' }
  )
    .split('\n')
    .map(s => s.trim())
    .find(s => s.includes('.') && s.length > 50);

  assert.ok(callbackToken, 'Valid signed callback token must be generated');

  console.log('\n6. Submitting signed Hermes research callback...');
  const submitScript = `import urllib.request, json
req = urllib.request.Request(
    "http://127.0.0.1:5020/api/operator/v2/research-tasks/${finalTaskId}/complete",
    data=json.dumps(${JSON.stringify(researchBrief)}).encode("utf-8"),
    headers={
        "Authorization": "Bearer ${callbackToken}",
        "Content-Type": "application/json",
        "Idempotency-Key": "${idempotencyKey}:research"
    },
    method="POST"
)
try:
    with urllib.request.urlopen(req) as resp:
        print(resp.status)
        print(resp.read().decode())
except Exception as e:
    print(f"SUBMIT_ERROR: {e}")
`;

  const submitRes = execSync('ssh masbenu@100.95.245.55 "python3 -"', { input: submitScript, encoding: 'utf8' }).trim();
  console.log('   -> Callback Response:\n', submitRes);

  // 5. Poll for Stage Completion (Start Frames Generated -> awaiting_manual_review)
  console.log('\n5. Monitoring background production until awaiting_manual_review with 6 ready items...');
  let finalStatus = null;
  for (let attempt = 1; attempt <= 350; attempt++) {
    const statusScript = `import urllib.request, json, os, plistlib
plist_path = os.path.expanduser("~/Library/LaunchAgents/ai.hermes.gateway.plist")
with open(plist_path, "rb") as f:
    pl = plistlib.load(f)
token = pl.get("EnvironmentVariables", {}).get("MAKNA_OPERATOR_API_TOKEN", "")
headers = {"Authorization": f"Bearer {token}"}
req = urllib.request.Request("http://127.0.0.1:5020/api/operator/v2/content-runs/${runId}", headers=headers)
with urllib.request.urlopen(req) as resp:
    print(resp.read().decode())
`;
    const pollRes = execSync('ssh masbenu@100.95.245.55 "python3 -"', { input: statusScript, encoding: 'utf8' }).trim();
    const pollData = JSON.parse(pollRes);
    console.log(`   [Attempt ${attempt}/350] Status: ${pollData.status} | Stage: ${pollData.stage} | Items: ${pollData.items?.ready}/${pollData.items?.total}`);

    if (pollData.status === 'awaiting_manual_review' && pollData.items?.ready === 6) {
      finalStatus = pollData;
      break;
    }
    await new Promise(r => setTimeout(r, 4000));
  }

  assert.ok(finalStatus, 'Run must reach awaiting_manual_review with 6 ready items');
  console.log('\n--- FINAL BOUNDED STATUS VIA HERMES API ---');
  console.log(JSON.stringify(finalStatus, null, 2));

  // 6. Planner Research & Row Evidence Database Verification
  console.log('\n6. Verifying Content Planner Research Metadata & Row Evidence Lineage in Database...');
  const plannerDbRes = await client.query(`
    SELECT id, title, research_revision_id, research_snapshot_sha256, research_status, research_query
    FROM content_planners
    WHERE id = $1
  `, [opJob.planner_id]);

  assert.ok(plannerDbRes.rows.length > 0, 'Planner must exist in DB');
  const plannerRow = plannerDbRes.rows[0];
  console.log(`   - Planner ID: ${plannerRow.id}`);
  console.log(`   - Research Revision ID: ${plannerRow.research_revision_id}`);
  console.log(`   - Research Status: ${plannerRow.research_status}`);
  console.log(`   - Research SHA256: ${plannerRow.research_snapshot_sha256}`);
  assert.equal(plannerRow.research_status, 'validated', 'Planner research_status must be validated');

  const rowEvidenceDbRes = await client.query(`
    SELECT id, planner_row_id, research_revision_id, angle_id, source_ids_json, risk_level, evidence_sha256
    FROM content_planner_row_evidence
    WHERE planner_id = $1
    ORDER BY created_at ASC
  `, [opJob.planner_id]);

  console.log(`   - Row Evidence Records Count: ${rowEvidenceDbRes.rows.length}`);
  assert.equal(rowEvidenceDbRes.rows.length, 6, 'Exactly 6 row evidence records must be persisted');
  for (const evRow of rowEvidenceDbRes.rows) {
    console.log(`     * Row ${evRow.planner_row_id}: Angle=${evRow.angle_id}, Sources=${JSON.stringify(evRow.source_ids_json)}, Risk=${evRow.risk_level}`);
    assert.ok(evRow.angle_id, 'Angle ID must be present');
    assert.ok(evRow.evidence_sha256, 'Evidence SHA256 must be present');
  }

  // 7. Zero Publishing Intent & Job Verification
  console.log('\n7. Verifying Guardrails (Zero Publishing)...');
  const intents = await client.query('SELECT COUNT(*)::int as count FROM agent_publishing_intents WHERE run_id = $1', [agentRun.id]);
  const jobs = await client.query(
    'SELECT COUNT(*)::int as count FROM publishing_jobs j JOIN agent_publishing_intents i ON i.publishing_job_id = j.id WHERE i.run_id = $1',
    [agentRun.id]
  );
  const scheduleRes = await client.query(
    'SELECT s.execution_mode, s.status, s.next_run_at FROM content_automation_schedules s JOIN content_automation_runs r ON r.schedule_id = s.id WHERE r.id = $1',
    [runId]
  );

  console.log(`   - Agent Publishing Intents: ${intents.rows[0].count}`);
  console.log(`   - Publishing Jobs: ${jobs.rows[0].count}`);
  console.log(`   - Schedule Semantics: execution_mode=${scheduleRes.rows[0].execution_mode}, status=${scheduleRes.rows[0].status}, next_run_at=${scheduleRes.rows[0].next_run_at}`);

  assert.equal(intents.rows[0].count, 0, 'Publishing intents must be 0 for draft_only');
  assert.equal(jobs.rows[0].count, 0, 'Publishing jobs must be 0 for draft_only');
  assert.equal(scheduleRes.rows[0].execution_mode, 'run_once');
  assert.equal(scheduleRes.rows[0].status, 'paused');
  assert.equal(scheduleRes.rows[0].next_run_at, null);

  console.log('\n🎉 ALL ACCEPTANCE CRITERIA FOR HERMES RESEARCH -> CONTENT PLANNER (TAHAP 1-3) VERIFIED!');
} finally {
  client.release();
  await pool.end();
}
