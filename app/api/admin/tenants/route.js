import { NextResponse } from 'next/server';
import { requireSuperadmin } from '@/lib/auth';
import { listTenantsWithCounts, provisionTenant } from '@/lib/tenant-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    requireSuperadmin(request);
    return NextResponse.json({ success: true, tenants: await listTenantsWithCounts() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status || 500 });
  }
}

export async function POST(request) {
  try {
    const actor = requireSuperadmin(request);
    const result = await provisionTenant(await request.json(), actor);
    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status || 400 });
  }
}
