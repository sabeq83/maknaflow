import { NextResponse } from 'next/server';
import { approvePillarCampaignItem, transitionPillarReview } from '@/lib/pillar-campaign-approval';

import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (request, { params }, user) => {
  try {
    const { itemId } = await params;
    const body = await request.json();
    const result = body.only_save
      ? await approvePillarCampaignItem(itemId, { ...body, actor_id: user.id })
      : await transitionPillarReview({ itemId, action: 'approve', reviewRevision: body.review_revision, actorId: user.id, idempotencyKey: request.headers.get('idempotency-key') || `legacy-approve:${itemId}:${body.review_revision}`, changes: body });
    return NextResponse.json({
      success: true,
      ...result,
      message: result.onlySaved
        ? 'Storyboard draft berhasil disimpan!'
        : 'Pillar campaign item approved and queued for production.'
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status || 500 });
  }
});
