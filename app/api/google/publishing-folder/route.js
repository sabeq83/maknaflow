import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { ensurePublishingDriveFolder } from '@/lib/publishing-drive-staging';

export const POST = withTenantContext(async (request, context, user) => {
  if (user && user.role !== 'admin' && user.role !== 'superadmin') {
    return NextResponse.json({
      success: false,
      error: 'Hanya admin yang dapat mengelola folder Google Drive.'
    }, { status: 403 });
  }

  try {
    const folder = await ensurePublishingDriveFolder();
    return NextResponse.json({
      success: true,
      data: folder
    });
  } catch (error) {
    console.error('[Publishing Folder API Error]:', error);
    return NextResponse.json({
      success: false,
      code: error.code || 'DRIVE_FOLDER_ERROR',
      error: error.message,
      reconnectUrl: error.reconnectUrl || null
    }, { status: error.status || 400 });
  }
});
