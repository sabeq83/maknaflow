import { NextResponse } from 'next/server';
import { tickCloudSync } from '@/lib/cloud-sync-scheduler';

export async function POST() {
  try {
    await tickCloudSync();
    return NextResponse.json({
      success: true,
      message: 'Sinkronisasi instan berhasil dijalankan!'
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
