import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import { verifyGoogleConnection, disconnectGoogle } from '@/lib/google-auth';
import { getPublishingDriveReadiness, invalidatePublishingDriveReadiness } from '@/lib/publishing-drive-staging';

export const GET = withTenantContext(async (_request, _context, user) => {
  try {
    const authStatus = await verifyGoogleConnection();
    let publishingDrive = null;
    if (authStatus.connected) {
      publishingDrive = await getPublishingDriveReadiness();
    } else {
      publishingDrive = {
        state: authStatus.state,
        connected: false,
        error: authStatus.message || 'Akun Google belum terhubung'
      };
    }
    return NextResponse.json({
      success: true,
      data: {
        ...authStatus,
        publishingDrive
      }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const DELETE = withTenantContext(async (_request, _context, user) => {
  if (user && user.role !== 'admin' && user.role !== 'superadmin') {
    return NextResponse.json({
      success: false,
      error: 'Hanya admin yang dapat memutuskan koneksi Google.'
    }, { status: 403 });
  }

  try {
    disconnectGoogle();
    invalidatePublishingDriveReadiness(getActiveTenantId());
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});


