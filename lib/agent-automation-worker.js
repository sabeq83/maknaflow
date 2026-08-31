import os from 'os';
import { pgQuery } from './db-pg.js';
import { tenantContext } from './tenant-context.js';
import { structuredLog } from './structured-logger.js';
import { createHermesRun } from './hermes-client.js';
import { attachHermesRun, transitionAgentRun, appendAgentRunEvent } from './agent-automation-repository.js';
import { createOperatorJobFromRequest } from './operator-job-service.js';

const state = globalThis.__agentAutomationWorkerState || {
  interval: null,
  running: false,
  lastTick: null,
  lastError: null
};
globalThis.__agentAutomationWorkerState = state;

export async function dispatchDueHermesResearch() {
  const tenantId = tenantContext.getActiveTenantId();
  const dueRuns = await pgQuery(`
    SELECT r.*, s.name as schedule_name, s.operator_request_json
    FROM agent_automation_runs r
    JOIN content_automation_schedules s ON s.id = r.schedule_id
    WHERE r.tenant_id = $1 AND r.status = 'scheduled'
  `, [tenantId]);

  for (const run of dueRuns.rows) {
    try {
      const taskId = `task_${run.id}`;
      const hermesConfig = {
        baseUrl: process.env.HERMES_API_BASE_URL || 'http://127.0.0.1:8642',
        apiKey: process.env.HERMES_API_SERVER_KEY || 'test-key',
        timeoutMs: Number(process.env.HERMES_REQUEST_TIMEOUT_MS || 30000)
      };

      const hermesPayload = {
        task_id: taskId,
        callback_url: `${process.env.MAKNA_OPERATOR_BASE_URL || 'http://127.0.0.1:5020'}/api/operator/v2/research-tasks/${taskId}/complete`,
        prompt: `Lakukan riset web terperinci tentang tren terkini untuk topik yang sesuai.`
      };

      const hermesRes = await createHermesRun(hermesConfig, hermesPayload, run.idempotency_key);
      await attachHermesRun(run.id, hermesRes.id, taskId);
      await appendAgentRunEvent(run.id, 'hermes_research_dispatched', { hermes_run_id: hermesRes.id, task_id: taskId });
    } catch (err) {
      structuredLog('error', 'agent_worker_dispatch_research_failed', { run_id: run.id, error: err.message });
    }
  }
}

export async function dispatchValidatedResearchToOperator() {
  const tenantId = tenantContext.getActiveTenantId();
  const runs = await pgQuery(`
    SELECT r.*, rev.payload_json as research_brief, s.operator_request_json
    FROM agent_automation_runs r
    JOIN agent_research_revisions rev ON rev.run_id = r.id
    JOIN content_automation_schedules s ON s.id = r.schedule_id
    WHERE r.tenant_id = $1 AND r.status = 'research_ready'
  `, [tenantId]);

  for (const run of runs.rows) {
    try {
      const parsedRequest = typeof run.operator_request_json === 'string'
        ? JSON.parse(run.operator_request_json)
        : run.operator_request_json;

      const operatorRequest = {
        ...parsedRequest,
        research_brief: typeof run.research_brief === 'string' ? JSON.parse(run.research_brief) : run.research_brief
      };

      const job = await createOperatorJobFromRequest({
        request: operatorRequest,
        idempotencyKey: `${run.idempotency_key}:operator`,
        actor: `agent_automation:${run.id}`
      });

      await transitionAgentRun(run.id, 'research_ready', 'planning', { operator_job_id: job.id });
      await appendAgentRunEvent(run.id, 'operator_job_created', { job_id: job.id });
    } catch (err) {
      structuredLog('error', 'agent_worker_operator_dispatch_failed', { run_id: run.id, error: err.message });
    }
  }
}

export async function runAgentAutomationTick() {
  if (state.running) return;
  state.running = true;
  state.lastTick = new Date().toISOString();
  try {
    const tenants = await pgQuery('SELECT DISTINCT tenant_id FROM agent_automation_runs WHERE status IN (\'scheduled\', \'research_ready\')');
    for (const { tenant_id: tenantId } of tenants.rows) {
      await tenantContext.run(tenantId, async () => {
        await dispatchDueHermesResearch();
        await dispatchValidatedResearchToOperator();
      });
    }
  } catch (err) {
    state.lastError = err.message;
    structuredLog('error', 'agent_automation_worker_tick_failed', { error: err.message });
  } finally {
    state.running = false;
  }
}

export function startAgentAutomationWorker() {
  if (state.interval) return state.interval;
  const ms = Math.max(5000, Number(process.env.AGENT_AUTOMATION_INTERVAL_MS || 15000));
  runAgentAutomationTick();
  state.interval = setInterval(runAgentAutomationTick, ms);
  console.log(`⏱️ Agent Automation Worker started (${ms}ms).`);
  return state.interval;
}
