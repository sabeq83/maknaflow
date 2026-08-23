import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { reconcileProgramRuns } from '@/lib/affiliate-studio-production-adapter';

export const POST = withTenantContext(async (request, { params }, user) => {
  try {
    const { id: brandId, programId } = await params;
    const ok = await reconcileProgramRuns(user, brandId, programId);
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Reconciliation failed' }, { status: 400 });
    }
    return NextResponse.json({ success: true, message: 'Reconciliation completed' });
  } catch (error) {
    console.error('[API /runs/reconcile Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
