import { NextResponse } from 'next/server';
import { authenticateOperator } from '@/lib/operator-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const identity = await authenticateOperator(request);
    return NextResponse.json({ success: true, operator: { id: identity.actor, name: identity.name, tenant_id: identity.tenantId, scopes: identity.scopes } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status || 500 });
  }
}
