import { NextResponse } from 'next/server';
import { authenticateOperator, runAsOperatorTenant } from '@/lib/operator-auth';
import { normalizeOperatorApproval } from '@/lib/operator-content-contract';
import { appendOperatorJobEvent, getDb, getOperatorJob } from '@/lib/db';
import { approvePillarCampaignItemUnchanged } from '@/lib/pillar-campaign-approval';
import { buildOperatorReviewArtifact } from '@/lib/operator-review-artifact';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  try {
    const identity = await authenticateOperator(request, 'content:approve');
    const { jobId } = await params;
    const command = normalizeOperatorApproval(await request.json());
    return await runAsOperatorTenant(identity, async () => {
      const job = await getOperatorJob(jobId);
      if (!job) return NextResponse.json({ success: false, code: 'OPERATOR_JOB_NOT_FOUND', error: 'Job tidak ditemukan.' }, { status: 404 });
      if (!job.campaign_id) return NextResponse.json({ success: false, code: 'OPERATOR_CAMPAIGN_NOT_READY', error: 'Campaign belum tersedia.' }, { status: 409 });
      const review = await buildOperatorReviewArtifact(job);
      if (!review || !command.review_revision || command.review_revision !== review.revision || (command.review_sha256 && command.review_sha256 !== review.sha256)) {
        return NextResponse.json({
          success: false,
          code: 'REVIEW_REVISION_MISMATCH',
          error: 'Revision review tidak cocok atau belum diberikan. Baca ulang artefak review terbaru sebelum approval.',
          review: review ? { revision: review.revision, sha256: review.sha256, url: review.url } : null
        }, { status: 409 });
      }
      const db = getDb();
      const campaignItems = await db.prepare('SELECT id, workflow_status FROM pillar_campaign_items WHERE campaign_id = ? ORDER BY id').all(job.campaign_id);
      const requested = command.item_ids.length ? new Set(command.item_ids) : null;
      const targets = campaignItems.filter(item =>
        item.workflow_status === 'ready_for_review' && (!requested || requested.has(Number(item.id)))
      );
      if (!targets.length) {
        return NextResponse.json({ success: false, code: 'OPERATOR_NO_APPROVABLE_ITEMS', error: 'Tidak ada item ready_for_review yang cocok.' }, { status: 409 });
      }
      for (const item of targets) await approvePillarCampaignItemUnchanged(item.id);
      await appendOperatorJobEvent(job.id, 'items_approved', {
        actor: identity.actor,
        review_revision: review.revision,
        review_sha256: review.sha256,
        item_ids: targets.map(item => item.id)
      });
      return NextResponse.json({ success: true, approved_count: targets.length, item_ids: targets.map(item => item.id) });
    });
  } catch (error) {
    console.error('[Operator API] Approval failed:', error.code || error.name, error.message);
    return NextResponse.json({
      success: false,
      code: error.code || 'OPERATOR_APPROVAL_FAILED',
      error: error.status && error.status < 500 ? error.message : 'Approval gagal diproses.'
    }, { status: error.status || 500 });
  }
}
