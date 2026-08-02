import { NextResponse } from 'next/server';
import { requireSuperadmin } from '@/lib/auth';
import { updateTenant } from '@/lib/tenant-admin';

export const runtime = 'nodejs';

export async function PATCH(request, { params }) {
  try {
    const actor = requireSuperadmin(request);
    const { tenantId } = await params;
    const tenant = await updateTenant(tenantId, await request.json(), actor);
    return NextResponse.json({ success: true, tenant });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status || 400 });
  }
}
