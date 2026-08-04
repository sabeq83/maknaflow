import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { normalizeContentAutomation } from '@/lib/content-automation-contract';
import { createAutomation, listAutomations, listNotifications, listRuns } from '@/lib/content-automation-repository';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (request, user) => {
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

export const POST = withTenantContext(async (request, user) => {
  try {
    const data = normalizeContentAutomation(await request.json());
    return NextResponse.json({ success: true, schedule: await createAutomation(data, user.id) }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ success: false, code: e.code, error: e.message }, { status: e.status || 500 });
  }
});
