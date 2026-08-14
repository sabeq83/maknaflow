import assert from 'node:assert/strict';
import { tenantContext } from '../lib/tenant-context.js';
import { pgQuery, getPgPool } from '../lib/db-pg.js';
import { buildOpcStartFrameRequest } from '../lib/opc-start-frame-request.js';

assert.equal(process.env.PG_SEARCH_PATH, 'dev', 'Integration test wajib dijalankan dengan PG_SEARCH_PATH=dev.');

await tenantContext.run('default_tenant', async () => {
  const campaign = (await pgQuery(`SELECT * FROM pillar_campaigns WHERE tenant_id=$1 AND target_product_id IS NOT NULL AND visual_mode='hybrid_lock' ORDER BY created_at DESC LIMIT 1`, ['default_tenant'])).rows[0];
  assert.ok(campaign, 'Campaign Product OPC Dev tidak tersedia.');
  const item = (await pgQuery(`SELECT i.* FROM pillar_campaign_items i JOIN pillar_campaigns c ON c.id=i.campaign_id WHERE c.tenant_id=$1 AND i.campaign_id=$2 ORDER BY i.id LIMIT 1`, ['default_tenant', campaign.id])).rows[0];
  assert.ok(item, 'Item OPC Dev tidak tersedia.');
  const plan = typeof item.new_video_plan_json === 'string' ? JSON.parse(item.new_video_plan_json || '[]') : item.new_video_plan_json || [];
  const clipIndex = Number(campaign.bridge_at_clip || 2);
  const prompt = plan.find(entry => Number(entry.clip_index) === clipIndex)?.t2i_prompt || 'Product reference parity fixture';
  const initial = await buildOpcStartFrameRequest({ campaign, item, clipIndex, prompt, origin:'phase_1_initial' });
  const regen = await buildOpcStartFrameRequest({ campaign, item, clipIndex, prompt, origin:'manual_regen' });
  const nonBridgeClipIndex = clipIndex === 1 ? Number(campaign.bridge_at_clip) + Math.max(1, Number(campaign.bridge_duration_clips || 1)) : 1;
  const nonBridge = await buildOpcStartFrameRequest({ campaign, item, clipIndex:nonBridgeClipIndex, prompt:'Non bridge reference leak check', origin:'phase_1_initial' });
  assert.equal(initial.audit.request_fingerprint, regen.audit.request_fingerprint);
  assert.equal(initial.audit.reference_sha256, regen.audit.reference_sha256);
  assert.deepEqual(initial.providerRequest.reference_images, regen.providerRequest.reference_images);
  assert.equal(initial.audit.reference_count, 1);
  assert.equal(initial.audit.product_reference_count, 1);
  assert.equal(initial.audit.reference_source_field, 'generated_photo_url');
  assert.ok(Array.isArray(initial.providerRequest.reference_images));
  assert.equal(nonBridge.audit.product_reference_count, 0);
  assert.equal(nonBridge.providerRequest.reference_images, undefined);
  assert.equal((await pgQuery(`SELECT to_regclass('opc_start_frame_request_audits') AS table_name`)).rows[0].table_name, 'opc_start_frame_request_audits');
  console.log(JSON.stringify({ campaign_id:campaign.id, item_id:item.id, clip_index:clipIndex, non_bridge_clip_index:nonBridgeClipIndex, reference_source:initial.audit.reference_source_field, reference_sha256:initial.audit.reference_sha256, request_fingerprint:initial.audit.request_fingerprint }, null, 2));
});
await new Promise(resolve => setTimeout(resolve, 3000));
await getPgPool().end();
console.log('OPC start-frame reference Dev integration test passed without provider call.');
