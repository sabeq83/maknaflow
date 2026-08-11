import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import {
  getPublishingControl,
  setPublishingControl
} from '@/lib/publishing-repository';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async () => {
  try {
    const tenantId = getActiveTenantId();
    const control = await getPublishingControl(tenantId);
    return NextResponse.json({
      success: true,
      data: control
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status || 500 }
    );
  }
});

export const PATCH = withTenantContext(async (request, user) => {
  try {
    const tenantId = getActiveTenantId();
    const body = await request.json();
    const { isPaused, reason } = body;

    if (typeof isPaused !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Field isPaused (boolean) wajib diisi.' },
        { status: 400 }
      );
    }

    const updated = await setPublishingControl(tenantId, {
      isPaused,
      pausedBy: user?.username || user?.id || 'admin',
      pauseReason: reason || (isPaused ? 'Dijeda oleh pengguna dari dashboard.' : 'Dilanjutkan kembali.')
    });

    return NextResponse.json({
      success: true,
      message: isPaused ? 'Worker publishing berhasil dijeda.' : 'Worker publishing berhasil dilanjutkan.',
      data: updated
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status || 400 }
    );
  }
});
