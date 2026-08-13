import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { createAutomationAuditEvent } from '@/lib/content-automation-repository';
import { getProductCampaignFlags, saveProductCampaignFlags } from '@/lib/content-automation-feature-flags';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (_request, _context, user) =>
  NextResponse.json({ success: true, flags: await getProductCampaignFlags(user.tenantId) })
);

export const PUT = withTenantContext(async (request, _context, user) => {
  try {
    if (user.role !== 'admin') return NextResponse.json({ success: false, error: 'Hanya Admin tenant yang dapat mengubah feature flag.' }, { status: 403 });
    const previous = await getProductCampaignFlags(user.tenantId);
    const flags = await saveProductCampaignFlags(await request.json(), user);
    await createAutomationAuditEvent({ tenantId: user.tenantId, actor: user.id, type: 'product_campaign_feature_flags_updated', event: { previous, current: flags } });
    return NextResponse.json({ success: true, flags });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status || 500 });
  }
});
