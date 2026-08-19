import { NextResponse } from 'next/server';
import { listReplizAccounts } from '@/lib/repliz-client';
import { getCurrentUser, withTenantContext } from '@/lib/auth';
import { isNewSecret } from '@/lib/secret-values';
import { getSetting } from '@/lib/db';

export const POST = withTenantContext(async (request, _context, user) => {
  try {
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Hanya Admin tenant yang dapat menguji credential.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    let { repliz_api_url, repliz_access_key, repliz_secret_key } = body;

    if (!isNewSecret(repliz_access_key)) {
      repliz_access_key = await getSetting('repliz_access_key');
    }
    if (!isNewSecret(repliz_secret_key)) {
      repliz_secret_key = await getSetting('repliz_secret_key');
    }

    if (!repliz_access_key || !repliz_secret_key) {
      return NextResponse.json({ success: false, error: 'Access Key dan Secret Key wajib diisi.' }, { status: 400 });
    }

    const credentials = {
      apiUrl: repliz_api_url || 'https://api.repliz.com',
      accessKey: repliz_access_key,
      secretKey: repliz_secret_key
    };

    const accounts = await listReplizAccounts(credentials);
    return NextResponse.json({
      success: true,
      message: 'Koneksi ke Repliz berhasil!',
      accountCount: accounts.length
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
});
