import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { normalizeContentAutomation } from '@/lib/content-automation-contract';
import { createAutomation, createAutomationAuditEvent, listAutomations, listNotifications, listRuns } from '@/lib/content-automation-repository';
import { prepareProductCampaignSchedule } from '@/lib/content-automation-binding-service';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (request, _context, user) => {
  try {
    return NextResponse.json({
      success: true,
      schedules: await listAutomations(),
      runs: await listRuns(),
      notifications: await listNotifications()
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: e.status || 500 });
  }
});

export const POST = withTenantContext(async (request, _context, user) => {
  try {
    const body = await request.json();
    const prepared = body.campaign_kind === 'product_campaign' ? await prepareProductCampaignSchedule(body) : { body, bindingAction: null, binding: null };
    const data = normalizeContentAutomation(prepared.body);
    const schedule = await createAutomation(data, user.id);
    if (prepared.binding) await createAutomationAuditEvent({ tenantId: user.tenantId, actor: user.id, type: `product_binding_${prepared.bindingAction}`, scheduleId: schedule.id, event: { brand_profile_id: data.brand_profile_id, product_id: data.product_id, brand_product_id: prepared.binding.id } });
    return NextResponse.json({ success: true, schedule, binding_action: prepared.bindingAction }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ success: false, code: e.code, error: e.message }, { status: e.status || 500 });
  }
});
