import { NextResponse } from 'next/server';
import { testNextcloudConnection } from '@/lib/nextcloud-helper';
import { withTenantContext } from '@/lib/auth';
import { getSetting } from '@/lib/db';
import { isNewSecret } from '@/lib/secret-values';

export const POST = withTenantContext(async (request, _context, user) => {
  try {
    if (user.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Hanya Admin tenant yang dapat menguji credential.' }, { status: 403 });
    }
    const { url, username, password } = await request.json();
    const resolvedPassword = isNewSecret(password) ? password : await getSetting('nextcloud_app_password');

    if (!url || !username || !resolvedPassword) {
      return NextResponse.json({ success: false, message: 'URL, Username, dan Password wajib diisi.' }, { status: 400 });
    }

    const result = await testNextcloudConnection(url, username, resolvedPassword);
    
    if (result.success) {
      return NextResponse.json({ success: true, message: 'Koneksi ke Nextcloud berhasil.' });
    } else {
      return NextResponse.json({ success: false, message: result.message });
    }
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
});
