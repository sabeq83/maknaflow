import { NextResponse } from 'next/server';
import { authenticateOperator } from '@/lib/operator-auth';
import { listOperatorPresets } from '@/lib/operator-presets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await authenticateOperator(request, 'content:read');
    return NextResponse.json({ success: true, presets: listOperatorPresets() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ success: false, code: error.code || 'OPERATOR_PRESETS_FAILED', error: error.status && error.status < 500 ? error.message : 'Gagal membaca preset.' }, { status: error.status || 500 });
  }
}
