import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRun, updateRun } from '@/lib/content-automation-repository';
import { appendOperatorJobEvent, getDb, getOperatorJob } from '@/lib/db';
import { buildOperatorReviewArtifact } from '@/lib/operator-review-artifact';
import { approvePillarCampaignItemUnchanged } from '@/lib/pillar-campaign-approval';

export async function POST(request, { params }) {
  try {
    const user = getCurrentUser(request);
    if (!user || user.role !== 'admin') return NextResponse.json({ success: false, error: 'Hanya Admin tenant yang dapat menyetujui campaign.' }, { status: user ? 403 : 401 });
    const { runId } = await params;
    const run = await getRun(runId);
    if (!run || !['awaiting_approval', 'partially_approved'].includes(run.status)) return NextResponse.json({ success: false, error: 'Run tidak sedang menunggu approval.' }, { status: 409 });
    const job = await getOperatorJob(run.operator_job_id);
    const body = await request.json();
    const review = await buildOperatorReviewArtifact(job);
    if (!review || body.review_revision !== review.revision || body.review_sha256 !== review.sha256) {
      return NextResponse.json({ success: false, error: 'Revision review berubah. Buka review terbaru sebelum approval.', review: review ? { revision: review.revision, sha256: review.sha256 } : null }, { status: 409 });
    }
    const requested = new Set((body.item_ids || []).map(Number));
    const db = getDb();
    const eligible = await db.prepare("SELECT id FROM pillar_campaign_items WHERE campaign_id=? AND workflow_status='ready_for_review' ORDER BY id").all(job.campaign_id);
    const targets = requested.size ? eligible.filter(item => requested.has(Number(item.id))) : eligible;
    if (!targets.length) return NextResponse.json({ success: false, error: 'Tidak ada item yang dapat disetujui.' }, { status: 409 });
    const approved = [], blocked = [];
    for (const item of targets) {
      try {
        await approvePillarCampaignItemUnchanged(item.id, { review_revision: review.revision, actor_id: user.id });
        approved.push(item.id);
      } catch (error) {
        blocked.push({ id: item.id, code: error.code, message: error.message });
      }
    }
    const totals = await db.prepare("SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE workflow_status='production_processing' OR approved_revision IS NOT NULL)::int AS approved FROM pillar_campaign_items WHERE campaign_id=?").get(job.campaign_id);
    await updateRun(run.id, { status: Number(totals.approved) < Number(totals.total) ? 'partially_approved' : 'producing', approved_item_count: Number(totals.approved), total_item_count: Number(totals.total), review_revision: review.revision });
    await appendOperatorJobEvent(job.id, 'campaign_approved_from_automation_ui', { actor: user.id, review_revision: review.revision, review_sha256: review.sha256, item_ids: approved, blocked });
    return NextResponse.json({ success: true, approved_count: approved.length, approved_item_ids: approved, blocked, campaign_id: job.campaign_id });
  } catch (error) {
    return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status || 500 });
  }
}
