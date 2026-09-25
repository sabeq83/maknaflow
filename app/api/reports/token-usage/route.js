import { NextResponse } from 'next/server';
import { getMonthlyTokenUsageReport, getRecentAiTransactions, GEMINI_MODEL_RATES, USD_TO_IDR_RATE } from '@/lib/ai-token-meter';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    const userTenantId = user ? (user.tenantId || user.tenant_id) : 'default_tenant';

    const { searchParams } = new URL(request.url);
    let year = searchParams.get('year');
    let month = searchParams.get('month');
    const periodParam = searchParams.get('period'); // e.g. '2026-09'

    if (periodParam && periodParam.includes('-')) {
      const [y, m] = periodParam.split('-');
      year = y;
      month = m;
    }

    const requestedTenant = searchParams.get('tenant_id');
    // Non-superadmin cannot inspect other tenants
    const isSuperadmin = user?.role === 'superadmin';
    let targetTenant = userTenantId;
    if (isSuperadmin && requestedTenant) {
      targetTenant = requestedTenant;
    }

    const report = await getMonthlyTokenUsageReport({
      tenantId: targetTenant,
      year,
      month
    });

    const recentLogs = await getRecentAiTransactions({
      tenantId: targetTenant,
      limit: Number.parseInt(searchParams.get('limit') || '15', 10)
    });

    return NextResponse.json({
      success: true,
      report,
      recentLogs,
      ratesCatalog: GEMINI_MODEL_RATES,
      exchangeRate: USD_TO_IDR_RATE,
      userTenantId
    });
  } catch (err) {
    console.error('[API Token Usage Error]', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Gagal memuat data token usage'
    }, { status: 500 });
  }
}
