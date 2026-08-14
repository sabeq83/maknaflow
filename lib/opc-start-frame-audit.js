import crypto from 'crypto';
import { pgQuery } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';

export async function recordStartFrameRequestAudit(audit, providerTaskId = null) {
  if (JSON.stringify(audit).includes('base64,')) throw new Error('START_FRAME_AUDIT_CONTAINS_BASE64');
  if (audit.requires_product_reference && audit.product_reference_count !== 1) throw new Error('OPC_PRODUCT_REFERENCE_AUDIT_INVARIANT_FAILED');
  if (!audit.requires_product_reference && Number(audit.product_reference_count || 0) !== 0) throw new Error('OPC_PRODUCT_REFERENCE_LEAK_AUDIT_INVARIANT_FAILED');
  if (audit.requires_product_reference && audit.reference_sha256 !== audit.payload_reference_sha256) throw new Error('OPC_PRODUCT_REFERENCE_SHA_MISMATCH');
  await pgQuery(`INSERT INTO opc_start_frame_request_audits
    (id,tenant_id,campaign_id,campaign_item_id,clip_index,origin,requires_product_reference,requirement_reason,reference_count,reference_source_field,reference_sha256,prompt_sha256,request_fingerprint,provider_task_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
  [`osfra_${crypto.randomUUID().replaceAll('-','').slice(0,20)}`,getActiveTenantId(),audit.campaign_id,audit.campaign_item_id,audit.clip_index,audit.origin,audit.requires_product_reference,audit.requirement_reason,audit.reference_count,audit.reference_source_field,audit.reference_sha256,audit.prompt_sha256,audit.request_fingerprint,providerTaskId]);
}
