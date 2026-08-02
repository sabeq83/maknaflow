import { appendOperatorJobEvent, createOperatorJob } from './db.js';
import { hashOperatorRequest, normalizeOperatorContentRequest } from './operator-content-contract.js';

export async function createOperatorJobFromRequest({ request, idempotencyKey, actor = 'operator' }) {
  const payload = normalizeOperatorContentRequest(request);
  const requestHash = hashOperatorRequest(payload);
  const job = await createOperatorJob({ idempotencyKey, requestHash, requestJson: JSON.stringify(payload) });
  if (!job) throw new Error('Gagal membaca Operator job.');
  if (!job.created && job.request_hash !== requestHash) {
    const error = new Error('Idempotency-Key sudah dipakai untuk payload berbeda.');
    error.code = 'OPERATOR_IDEMPOTENCY_CONFLICT'; error.status = 409; throw error;
  }
  if (job.created) await appendOperatorJobEvent(job.id, 'job_created', { actor });
  return job;
}
