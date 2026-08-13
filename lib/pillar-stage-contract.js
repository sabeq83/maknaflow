export function buildStageIdempotencyKey({ tenantId, itemId, stage, revision = 1 }) {
  if (!tenantId || !itemId || !stage) throw new Error('tenantId, itemId, dan stage wajib diisi.');
  return `opc-stage:${tenantId}:${itemId}:${stage}:r${revision}`;
}
