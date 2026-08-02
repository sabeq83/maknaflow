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
  const source = JSON.stringify(items.map(item => ({ id: item.id, result_json: item.result_json, row_creative_payload: item.row_creative_payload })));
  const sha256 = digest(source);
  const revision = sha256.slice(0, 12);
  const markdown = buildPillarReviewMarkdown(campaign, items, { revision });
  return {
    revision,
    sha256,
    markdown: markdown.replace('calculated-after-render', sha256),
    url: `/api/operator/v1/content-jobs/${job.id}/review`,
    item_count: items.length,
    clip_count: items.reduce((sum, item) => {
      try { return sum + (JSON.parse(item.result_json || '{}').storyboard || []).length; } catch (_) { return sum; }
    }, 0)
  };
}
