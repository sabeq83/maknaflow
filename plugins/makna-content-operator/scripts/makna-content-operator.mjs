#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const args = process.argv.slice(2);
const command = args.shift();
const option = name => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};
const baseUrl = String(process.env.MAKNA_OPERATOR_BASE_URL || 'http://127.0.0.1:5010').replace(/\/+$/, '');
const token = process.env.MAKNA_OPERATOR_API_TOKEN || '';

async function api(path, { method = 'GET', body, headers = {} } = {}) {
  if (!token) throw new Error('MAKNA_OPERATOR_API_TOKEN belum dikonfigurasi.');
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${payload.code || response.status}: ${payload.error || 'Request gagal'}`);
  return payload;
}

function printJob(payload) {
  const job = payload.job;
  const progress = job.progress || {};
  console.log(`${job.id} | ${job.status} | ${job.current_stage} | ${progress.completed_items || 0}/${progress.total_items || 0}`);
}

async function main() {
  if (command === 'whoami') {
    const result = await api('/api/operator/v1/whoami');
    console.log(`${result.operator.name} | tenant=${result.operator.tenant_id} | scopes=${result.operator.scopes.join(',')}`);
    return;
  }
  if (command === 'create') {
    const file = option('--file');
    if (!file) throw new Error('--file wajib diisi.');
    const body = JSON.parse(await fs.readFile(file, 'utf8'));
    if (body?.production?.enable_social_post === true) throw new Error('Social publishing tidak didukung plugin ini.');
    const key = option('--key') || `makna-${crypto.randomUUID()}`;
    const result = await api('/api/operator/v1/content-jobs', { method: 'POST', body, headers: { 'idempotency-key': key } });
    console.log(`${result.job_id} | ${result.status}${result.reused ? ' | reused' : ''}`);
    return;
  }
  if (command === 'status' || command === 'wait') {
    const jobId = args[0];
    if (!jobId) throw new Error('job-id wajib diisi.');
    do {
      const result = await api(`/api/operator/v1/content-jobs/${jobId}`);
      printJob(result);
      if (command === 'status' || ['completed', 'failed', 'awaiting_approval'].includes(result.job.status)) return;
      await new Promise(resolve => setTimeout(resolve, 5000));
    } while (true);
  }
  if (command === 'approve') {
    const jobId = args[0];
    if (!jobId || !args.includes('--all')) throw new Error('Gunakan approve <job-id> --all setelah approval eksplisit pengguna.');
    const result = await api(`/api/operator/v1/content-jobs/${jobId}/approve`, { method: 'POST', body: { mode: 'approve_unchanged', item_ids: [] } });
    console.log(`${result.approved_count} item disetujui.`);
    return;
  }
  console.log('Commands: whoami | create --file <json> [--key <key>] | status <job> | wait <job> | approve <job> --all');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
