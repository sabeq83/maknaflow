import crypto from 'crypto';
import { getDb } from './db.js';
import { buildPillarReviewMarkdown } from './export-builder.js';

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export async function buildOperatorReviewArtifact(job) {
  if (!job?.campaign_id) return null;
  const db = getDb();
  const campaign = await db.prepare('SELECT * FROM pillar_campaigns WHERE id = ?').get(job.campaign_id);
  if (!campaign) return null;
  const items = await db.prepare('SELECT * FROM pillar_campaign_items WHERE campaign_id = ? ORDER BY id').all(job.campaign_id);
  let request = {};
  try { request = typeof job.request_json === 'string' ? JSON.parse(job.request_json) : (job.request_json || {}); } catch (_) {}
  const source = JSON.stringify({
    product_snapshot: request.product_snapshot || null,
    items: items.map(item => ({ id: item.id, result_json: item.result_json, row_creative_payload: item.row_creative_payload,
      new_video_plan_json: item.new_video_plan_json, video_dna_json: item.video_dna_json,
      t2i_images_json: item.t2i_images_json, start_frame_status: item.start_frame_status,
      start_frame_revision: item.start_frame_revision }))
  });
  const sha256 = digest(source);
  const revision = sha256.slice(0, 12);
  const markdown = buildPillarReviewMarkdown(campaign, items, { revision });
  for (const item of items.filter(value => value.workflow_status === 'ready_for_review')) {
    if (item.review_revision !== revision) await db.prepare('UPDATE pillar_campaign_items SET review_revision=? WHERE id=?').run(revision, item.id);
  }
  return {
    revision,
    sha256,
    markdown: markdown.replace('calculated-after-render', sha256),
    url: `/api/operator/v1/content-jobs/${job.id}/review`,
    item_count: items.length,
    start_frame_count: items.reduce((sum,item)=>sum+Number(item.start_frame_completed_count||0),0),
    product_snapshot: request.product_snapshot || null,
    item_summaries: items.map(item=>({id:item.id,workflow_status:item.workflow_status,start_frame_status:item.start_frame_status,start_frame_completed_count:Number(item.start_frame_completed_count||0),start_frame_expected_count:Number(item.start_frame_expected_count||0)})),
    clip_count: items.reduce((sum, item) => {
      try { return sum + (JSON.parse(item.result_json || '{}').storyboard || []).length; } catch (_) { return sum; }
    }, 0)
  };
}
