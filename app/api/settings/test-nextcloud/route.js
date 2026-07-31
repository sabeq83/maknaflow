import { NextResponse } from 'next/server';
import { testNextcloudConnection } from '@/lib/nextcloud-helper';

export async function POST(request) {
  try {
    const { url, username, password } = await request.json();

    if (!url || !username || !password) {
      return NextResponse.json({ success: false, message: 'URL, Username, dan Password wajib diisi.' }, { status: 400 });
    }

    const result = await testNextcloudConnection(url, username, password);
    
    if (result.success) {
      return NextResponse.json({ success: true, message: 'Koneksi ke Nextcloud berhasil.' });
    } else {
      return NextResponse.json({ success: false, message: result.message });
    }
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
