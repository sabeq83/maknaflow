import { NextResponse } from 'next/server';
import { deleteContentFlowAccount } from '@/lib/contentflow-repository';
import { withTenantContext } from '@/lib/auth';

export const DELETE = withTenantContext(async (request, _context, currentUser) => {
  try {
    if (currentUser.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Akses ditolak: Hanya Admin yang dapat menghapus brand' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const accountName = searchParams.get('account');
    if (!accountName || accountName === 'all') {
      return NextResponse.json({ success: false, error: 'Nama brand tidak valid' }, { status: 400 });
    }

    const deletedCount = await deleteContentFlowAccount(accountName);

    return NextResponse.json({ success: true, message: `Seluruh konten brand ${accountName} berhasil dihapus (${deletedCount} items)` });
  } catch (error) {
    console.error('[API /api/content-flow/brands DELETE Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
