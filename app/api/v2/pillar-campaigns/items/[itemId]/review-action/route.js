import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { transitionPillarReview } from '@/lib/pillar-campaign-approval';

export const POST = withTenantContext(async (request, { params }, user) => {
  try {
    if (user.role !== 'admin') return NextResponse.json({ success: false, error: 'Hanya Admin tenant yang dapat melakukan review action.' }, { status: 403 });
    const { itemId } = await params;
    const body = await request.json();
    const result = await transitionPillarReview({
      itemId,
      action: body.action,
      reviewRevision: body.review_revision,
      reason: body.reason,
      actorId: user.id,
      idempotencyKey: request.headers.get('idempotency-key') || body.idempotency_key,
      changes: body.action === 'approve' ? body.changes : null
    });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status || 500 });
  }
});
