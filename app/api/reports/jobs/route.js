import { NextResponse } from 'next/server';
import { getAuditTrail } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page')) || 1;
  const limit = parseInt(searchParams.get('limit')) || 20;
  const offset = (page - 1) * limit;
  
  const queueFilter = searchParams.get('queue') || null;
  const statusFilter = searchParams.get('status') || null;

  try {
    const data = await getAuditTrail(limit, offset, queueFilter, statusFilter);
    return NextResponse.json({ success: true, ...data, page, limit });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
