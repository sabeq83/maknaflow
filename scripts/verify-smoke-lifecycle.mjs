import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';
import pg from 'pg';

const runId = process.argv[2] || 'car_4dd16822ab764f41';
console.log(`🔍 === VERIFYING LIFECYCLE FOR SMOKE RUN "${runId}" (DEV) === 🧪`);

const pool = new pg.Pool({
  host: process.env.PGHOST || '100.78.186.123',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'makna_user',
  password: process.env.PGPASSWORD || 'maknagridpass',
  database: process.env.PGDATABASE || 'maknaflow_db',
  options: '-c search_path=dev',
  max: 3,
  connectionTimeoutMillis: 15000
});

async function verify() {
  const client = await pool.connect();
  try {
    // 1. Content Automation Run
    const contentRunRes = await client.query('SELECT * FROM content_automation_runs WHERE id = $1', [runId]);
    const contentRun = contentRunRes.rows[0];
    console.log('\n1. Content Automation Run:');
    console.log(`   - Status: ${contentRun?.status}`);
    console.log(`   - Operator Job ID: ${contentRun?.operator_job_id}`);
    console.log(`   - Total Item Count: ${contentRun?.total_item_count}`);
    console.log(`   - Schedule ID: ${contentRun?.schedule_id}`);

    // 2. Schedule Non-recurring Check
    const schedRes = await client.query('SELECT execution_mode, status, next_run_at FROM content_automation_schedules WHERE id = $1', [contentRun?.schedule_id]);
    const sched = schedRes.rows[0];
    console.log('\n2. Schedule Non-recurring Status:');
    console.log(`   - Execution Mode: ${sched?.execution_mode}`);
    console.log(`   - Status: ${sched?.status}`);
    console.log(`   - Next Run At: ${sched?.next_run_at}`);
    assert.equal(sched?.execution_mode, 'run_once');
    assert.equal(sched?.status, 'paused');
    assert.equal(sched?.next_run_at, null);

    // 3. Agent Automation Run
    const agentRunRes = await client.query('SELECT * FROM agent_automation_runs WHERE run_id = $1', [runId]);
    const agentRun = agentRunRes.rows[0];
    console.log('\n3. Agent Automation Run:');
    console.log(`   - Agent Run ID: ${agentRun?.id}`);
    console.log(`   - Status: ${agentRun?.status}`);
    console.log(`   - Operator Job ID: ${agentRun?.operator_job_id}`);

    // 4. Research Revision
    const researchRes = await client.query('SELECT id, payload_json FROM agent_research_revisions WHERE run_id = $1', [agentRun?.id]);
    console.log('\n4. Research Revision:');
    console.log(`   - Revisions Count: ${researchRes.rowCount}`);
    if (researchRes.rowCount > 0) {
      console.log(`   - Latest Revision ID: ${researchRes.rows[0].id}`);
    }

    // 5. Operator Job & Items
    if (contentRun?.operator_job_id || agentRun?.operator_job_id) {
      const opJobId = contentRun?.operator_job_id || agentRun?.operator_job_id;
      const { buildOperatorJobStatus } = await import('../lib/operator-content-worker.js');
      const opJob = await buildOperatorJobStatus(opJobId);
      console.log('\n5. Operator Job Status:');
      console.log(`   - Operator Job ID: ${opJob?.id}`);
      console.log(`   - Status: ${opJob?.status}`);
      console.log(`   - Stage: ${opJob?.current_stage}`);
      console.log(`   - Items Count: ${opJob?.items?.length || 0}`);
      (opJob?.items || []).forEach((item, idx) => {
        console.log(`     [Item ${idx + 1}] "${item.title || item.topic}" | Workflow: ${item.workflow_status} | Gen: ${item.generation_status} | StartFrame: ${item.start_frame_url || item.start_frame_status || 'NO'}`);
      });
    }

    // 6. Zero Publishing Intents & Jobs
    const intentsRes = await client.query('SELECT COUNT(*)::int as cnt FROM agent_publishing_intents WHERE run_id = $1', [agentRun?.id]);
    const jobsRes = await client.query('SELECT COUNT(*)::int as cnt FROM publishing_jobs j JOIN agent_publishing_intents i ON i.publishing_job_id = j.id WHERE i.run_id = $1', [agentRun?.id]);
    console.log('\n6. Publishing Guardrails (Zero Publishing for draft_only):');
    console.log(`   - Agent Publishing Intents: ${intentsRes.rows[0].cnt}`);
    console.log(`   - Publishing Jobs: ${jobsRes.rows[0].cnt}`);
    assert.equal(intentsRes.rows[0].cnt, 0);
    assert.equal(jobsRes.rows[0].cnt, 0);

    // 7. Live Bounded Status from Hermes HTTP API
    console.log('\n7. Live Bounded Status via Hermes API (/api/operator/v2/content-runs)...');
    const checkScript = `import urllib.request, json, os, plistlib
plist_path = os.path.expanduser("~/Library/LaunchAgents/ai.hermes.gateway.plist")
with open(plist_path, "rb") as f:
    pl = plistlib.load(f)
token = pl.get("EnvironmentVariables", {}).get("MAKNA_OPERATOR_API_TOKEN", "")
headers = {"Authorization": f"Bearer {token}"}
req = urllib.request.Request("http://127.0.0.1:5020/api/operator/v2/content-runs/${runId}", headers=headers)
with urllib.request.urlopen(req) as resp:
    print(resp.read().decode())
`;
    const hermesApiRes = execSync('ssh masbenu@100.95.245.55 "python3 -"', { input: checkScript, encoding: 'utf8' }).trim();
    const hermesData = JSON.parse(hermesApiRes);
    console.log(JSON.stringify(hermesData, null, 2));

    return { contentRun, agentRun, hermesData };
  } finally {
    client.release();
    await pool.end();
  }
}

verify().catch((err) => {
  console.error('\n❌ VERIFICATION ERROR:', err.message);
  process.exit(1);
});
