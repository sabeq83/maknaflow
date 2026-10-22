import crypto from 'node:crypto';
import { pgQuery, withPgTransaction } from './db-pg.js';
import { tenantContext } from './tenant-context.js';
import { submitReCampaign, submitMultiplierCampaign, submitRecipeCampaign } from './campaign-submission-service.js';
import { validateEngineSource, studioError } from './contentflow-studio-manifest.js';

export async function dispatchSlotProduction(slot) {
  const tenantId = slot.tenant_id;
  const engine = slot.batch_engine_kind;
  const sourceKind = slot.source_kind;
  validateEngineSource({ engineKind: engine, sourceKind, plannerId: engine === 'pillar' ? slot.batch_source_id : null });
  const config = slot.batch_config || {};
  const snapshot = slot.output_snapshot_json;
  if (!snapshot || slot.legacy_requires_review) throw studioError('Mapping legacy membutuhkan review.', 'STUDIO_LEGACY_REVIEW', 409);
  return tenantContext.run(tenantId, () => withPgTransaction(async client => {
    // Hold only DB work: provider/AI production happens later in existing schedulers.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`studio-dispatch:${slot.id}`]);
    const current = (await client.query('SELECT * FROM content_studio_slots WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [slot.id, tenantId])).rows[0];
    if (!current || current.stage_status === 'cancelled') throw studioError('Slot tidak tersedia.', 'STUDIO_SLOT_UNAVAILABLE', 409);
    if (current.source_campaign_id && current.source_item_id) return { campaignId: current.source_campaign_id, campaignItemId: current.source_item_id };
    const safeConfig = { ...config, enable_social_post: 0, post_to_facebook: 0, post_facebook_draft: 0, post_youtube_draft: 0, post_tiktok_draft: 0, auto_sync_contentflow: 1 };
    let result;
    if (engine === 'pillar') {
      const { ingestPlannerToPillarCampaign } = await import('./pillar-campaign-ingest.js');
      const campaignId = 'opc_studio_' + crypto.createHash('sha256').update(slot.id).digest('hex').slice(0,24);
      const res = await ingestPlannerToPillarCampaign({ plannerId: slot.batch_source_id, selectedRowIds: [slot.planner_row_id], campaignId,
        campaignName: slot.title, globalSettings: { ...safeConfig, status: 'running' }, consumptionOwner: slot.batch_id });
      const items = await client.query('SELECT id FROM pillar_campaign_items WHERE campaign_id=$1', [res.campaignId]);
      result = { campaign_id: res.campaignId, source_item_id: items.rows.length === 1 ? String(items.rows[0].id) : null };
    } else if (engine === 're') {
      result = await submitReCampaign({ tenantId, executionOwner: slot.id, payload: { ...safeConfig, urls: [snapshot.source] } });
    } else if (engine === 'multiplier') {
      // Keep the exact combination and shared config; only suppress direct social posting.
      const audio = typeof safeConfig.audio_config_json === 'string' ? JSON.parse(safeConfig.audio_config_json) : safeConfig.audio_config_json || {};
      result = await submitMultiplierCampaign({ tenantId, executionOwner: slot.id, payload: { ...safeConfig, shared_config:safeConfig.shared_config?{...safeConfig.shared_config,audio:{...safeConfig.shared_config.audio,enableSocialPost:false}}:undefined, audio_config_json: JSON.stringify({ ...audio, enableSocialPost: false }), rows: [{ ...snapshot.row, id: undefined }] } });
    } else if (engine === 'recipe') {
      const cfg = typeof safeConfig.config_json === 'string' ? JSON.parse(safeConfig.config_json) : safeConfig.config_json;
      result = await submitRecipeCampaign({ tenantId, executionOwner: slot.id, payload: { ...safeConfig, config_json: cfg ? { ...cfg, enable_social_post: false } : null, target_recipe_count: 1 } });
    }
    if (!result?.campaign_id || !result?.source_item_id) throw studioError('Engine tidak menghasilkan campaign/item yang valid.', 'STUDIO_DISPATCH_EMPTY_RESULT', 422);
    await client.query(`UPDATE content_studio_slots SET source_campaign_id=$1,source_item_id=$2,stage_status='in_progress',lease_until=NULL,error_message=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=$3 AND tenant_id=$4`, [result.campaign_id, result.source_item_id, slot.id, tenantId]);
    return { campaignId: result.campaign_id, campaignItemId: result.source_item_id };
  }));
}

export async function reconcileSlotProgress(slot) {
  const source = { pillar: 'opc', re: 're', multiplier: 'multiplier', recipe: 'recipe' }[slot.batch_engine_kind];
  if (!source || !slot.source_campaign_id || !slot.source_item_id) return { status: 'in_progress' };
  const table = { pillar: 'pillar_campaign_items', re: 're_campaign_items', multiplier: 're_multiplier_tasks', recipe: 'recipe_items' }[slot.batch_engine_kind];
  const parentKey = slot.batch_engine_kind==='multiplier' ? 'batch_id' : 'campaign_id';
  const item = (await pgQuery(`SELECT * FROM ${table} WHERE id::text=$1 AND ${parentKey}=$2`, [String(slot.source_item_id), slot.source_campaign_id])).rows[0];
  const cf = (await pgQuery(`SELECT * FROM content_flow_items WHERE tenant_id=$1 AND source_type=$2 AND source_campaign_id=$3 AND source_item_id=$4 LIMIT 1`, [slot.tenant_id, source, slot.source_campaign_id, String(slot.source_item_id)])).rows[0];
  const asset = slot.output_media_type==='image' ? item?.img_grid_path : item?.ffmpeg_output_path || item?.nextcloud_video_url;
  const finalAsset = asset && asset !== 'skipped';
  if (cf?.pipeline_status === 'Completed' && cf.url_asset && cf.caption && finalAsset) {
    await pgQuery(`UPDATE content_studio_slots SET stage_status='ready',contentflow_id=$1,final_media_url=$2,final_caption=$3,lease_until=NULL,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=$4 AND tenant_id=$5`, [cf.video_id || cf.id, asset, cf.caption, slot.id, slot.tenant_id]);
    return { status: 'ready', mediaUrl: asset };
  }
  if(slot.batch_engine_kind==='recipe' && slot.output_media_type==='video' && item?.status==='completed' && !finalAsset) {
    await pgQuery("UPDATE content_studio_slots SET stage_status='needs_review',error_message='Recipe Labs telah menghasilkan storyboard. Video final belum tersedia; produksi video resep memakai jalur Recipe Planner/Pillar.',updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND tenant_id=$2",[slot.id,slot.tenant_id]);
    return {status:'needs_review'};
  }
  if (item && (item.status === 'failed' || ['generation_status','visual_status','tts_status','ffmpeg_status','scrape_status','analyze_status'].some(k => item[k] === 'failed'))) {
    await pgQuery("UPDATE content_studio_slots SET stage_status='failed',error_message='Tahap produksi gagal. Review campaign sumber sebelum retry.',updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND tenant_id=$2", [slot.id, slot.tenant_id]);
    return { status: 'failed' };
  }
  if (item?.workflow_status === 'ready_for_review') {
    await pgQuery("UPDATE content_studio_slots SET stage_status='needs_review',updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND tenant_id=$2", [slot.id, slot.tenant_id]);
    return { status: 'needs_review' };
  }
  return { status: 'in_progress' };
}
