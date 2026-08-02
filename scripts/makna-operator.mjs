#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';

function usage() {
  console.log(`MAKNA Operator CLI

Usage:
  npm run operator -- whoami
  npm run operator -- create --file request.json [--key idempotency-key] [--wait]
  npm run operator -- status <job-id> [--watch]
  npm run operator -- approve <job-id> [--all | --items 101,102]

Environment:
  MAKNA_OPERATOR_BASE_URL
  MAKNA_OPERATOR_API_TOKEN`);
}

function readOption(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function configuration() {
  const baseUrl = (process.env.MAKNA_OPERATOR_BASE_URL || 'http://127.0.0.1:5010').replace(/\/+$/, '');
  const token = process.env.MAKNA_OPERATOR_API_TOKEN || '';
  if (!token) throw new Error('MAKNA_OPERATOR_API_TOKEN belum diisi.');
  return { baseUrl, token };
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const { baseUrl, token } = configuration();
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `HTTP ${response.status}`);
    error.code = payload.code;
    throw error;
  }
  return payload;
}

function printStatus(payload) {
  const job = payload.job;
  const progress = job.progress || { completed_items: 0, total_items: 0 };
  console.log(`${job.id} | ${job.status} | ${job.current_stage} | ${progress.completed_items}/${progress.total_items}`);
  if (job.error_message) console.log(`Error: ${job.error_message}`);
  for (const item of job.items || []) {
    if (item.video_final_path || item.nextcloud_url) {
      console.log(`  Item ${item.id}: ${item.video_final_path || '-'} ${item.nextcloud_url || ''}`.trimEnd());
    }
  }
}

async function watch(jobId) {
  let delay = 2000;
  while (true) {
    const payload = await request(`/api/operator/v1/content-jobs/${jobId}`);
    printStatus(payload);
    if (['completed', 'failed', 'awaiting_approval'].includes(payload.job.status)) {
      if (payload.job.status === 'failed') process.exitCode = 1;
      return payload;
    }
    await new Promise(resolve => setTimeout(resolve, delay));
    delay = Math.min(15000, Math.round(delay * 1.5));
  }
}

async function main() {
  const [, , command, ...args] = process.argv;
  if (!command || ['help', '--help', '-h'].includes(command)) {
    usage();
    return;
  }
  if (command === 'create') {
    const filename = readOption(args, '--file');
    if (!filename) throw new Error('--file wajib diisi.');
    const body = JSON.parse(await fs.readFile(filename, 'utf8'));
    const key = readOption(args, '--key') || `operator-${crypto.randomUUID()}`;
    const payload = await request('/api/operator/v1/content-jobs', {
      method: 'POST',
      body,
      headers: { 'idempotency-key': key }
    });
    console.log(`Job ${payload.job_id} diterima (${payload.status})${payload.reused ? ' [reused]' : ''}.`);
    if (args.includes('--wait')) await watch(payload.job_id);
    return;
  }
  if (command === 'whoami') {
    const payload = await request('/api/operator/v1/whoami');
    console.log(`${payload.operator.name} | tenant=${payload.operator.tenant_id} | scopes=${payload.operator.scopes.join(',')}`);
    return;
  }
  if (command === 'status') {
    const jobId = args[0];
    if (!jobId) throw new Error('job-id wajib diisi.');
    if (args.includes('--watch')) await watch(jobId);
    else printStatus(await request(`/api/operator/v1/content-jobs/${jobId}`));
    return;
  }
  if (command === 'approve') {
    const jobId = args[0];
    if (!jobId) throw new Error('job-id wajib diisi.');
    const rawItems = readOption(args, '--items');
    const itemIds = rawItems ? rawItems.split(',').map(Number).filter(Number.isInteger) : [];
    const payload = await request(`/api/operator/v1/content-jobs/${jobId}/approve`, {
      method: 'POST',
      body: { mode: 'approve_unchanged', item_ids: itemIds }
    });
    console.log(`${payload.approved_count} item disetujui.`);
    return;
  }
  usage();
  throw new Error(`Command tidak dikenal: ${command}`);
}

main().catch(error => {
  console.error(`${error.code ? `${error.code}: ` : ''}${error.message}`);
  process.exitCode = 1;
});
