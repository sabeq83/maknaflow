import { NextResponse } from 'next/server';
import { verifyGoogleConnection, disconnectGoogle } from '@/lib/google-auth';
import { getPublishingDriveReadiness } from '@/lib/publishing-drive-staging';

export async function GET() {
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
}

export async function DELETE() {
  try {
    disconnectGoogle();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

