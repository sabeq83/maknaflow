import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import { retryPublishingJobWithPolicy } from '@/lib/publishing-repository';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (request, { params }, user) => {
  try {
    const { id } = await params;
    const tenantId = getActiveTenantId();
    const body = await request.json().catch(() => ({}));

    const result = await retryPublishingJobWithPolicy(tenantId, id, {
      actorId: user?.username || user?.id || 'operator',
      confirmedReconnect: body.confirmedReconnect === true
    });

    return NextResponse.json({
      success: true,
      message: 'Job berhasil dijadwalkan ulang untuk dicoba kembali.',
      data: result
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message, code: error.code || null },
      { status: error.status || 400 }
    );
  }
});

