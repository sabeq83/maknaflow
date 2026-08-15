import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { parseAndValidateReportingFilters, getContentFlowReporting } from '@/lib/contentflow-reporting';

export const GET = withTenantContext(async (request, _context, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const filters = parseAndValidateReportingFilters(searchParams);

    const isFullAccess = user.role === 'admin' || user.role === 'superadmin';
    const allowedAccounts = isFullAccess ? undefined : (user.assignedBrandNames || []);

    if (!isFullAccess) {
      if (!allowedAccounts || allowedAccounts.length === 0) {
        return NextResponse.json(
          { success: false, error: 'User tidak memiliki akses ke brand apa pun.' },
          { status: 403 }
        );
      }

      if (filters.account && filters.account !== 'all') {
        const reqAccountLower = filters.account.toLowerCase();
        const hasAccess = allowedAccounts.some(b => String(b).toLowerCase() === reqAccountLower);
        if (!hasAccess) {
          return NextResponse.json(
            { success: false, error: `Akses ditolak untuk brand '${filters.account}'.` },
            { status: 403 }
          );
        }
      }
    }

    const result = await getContentFlowReporting({ ...filters, allowedAccounts });
    return NextResponse.json({ success: true, filters, ...result });
  } catch (error) {
    const status = error.status && Number.isInteger(error.status) ? error.status : 500;
    return NextResponse.json(
      { success: false, error: error.message || 'Terjadi kesalahan pada server reporting.' },
      { status }
    );
  }
});
