import { authenticateOperator, runAsOperatorTenant } from '@/lib/operator-auth';
import { getOperatorJob } from '@/lib/db';
import { buildOperatorReviewArtifact } from '@/lib/operator-review-artifact';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const identity = await authenticateOperator(request, 'content:read');
    const { jobId } = await params;
    return await runAsOperatorTenant(identity, async () => {
      const job = await getOperatorJob(jobId);
      if (!job) return Response.json({ success: false, code: 'OPERATOR_JOB_NOT_FOUND', error: 'Job tidak ditemukan.' }, { status: 404 });
      const review = await buildOperatorReviewArtifact(job);
      if (!review) return Response.json({ success: false, code: 'OPERATOR_REVIEW_NOT_READY', error: 'Review belum tersedia.' }, { status: 409 });
      return new Response(review.markdown, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `inline; filename="review-${jobId}-${review.revision}.md"`,
          'Cache-Control': 'no-store, max-age=0',
          'X-Review-Revision': review.revision,
          'X-Review-SHA256': review.sha256
        }
      });
    });
  } catch (error) {
    return Response.json({ success: false, code: error.code || 'OPERATOR_REVIEW_FAILED', error: error.status && error.status < 500 ? error.message : 'Gagal membuat review.' }, { status: error.status || 500 });
  }
}
