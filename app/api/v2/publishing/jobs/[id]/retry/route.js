import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import { retryPublishingJob } from '@/lib/publishing-repository';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (request, { params }) => {
  try {
    const { id } = await params;
    const tenantId = getActiveTenantId();
    const result = await retryPublishingJob(tenantId, id);

    return NextResponse.json({
      success: true,
      message: 'Job berhasil dijadwalkan ulang untuk dicoba kembali.',
      data: result
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status || 400 }
    );
  }
});
