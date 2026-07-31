import { NextResponse } from 'next/server';
import { deleteContentFlowBrandItems } from '@/lib/db';
import { pgQuery } from '@/lib/db-pg';
import { getCurrentUser } from '@/lib/auth';

export async function DELETE(request) {
  try {
    const currentUser = getCurrentUser(request);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Akses ditolak: Hanya Admin yang dapat menghapus brand' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const accountName = searchParams.get('account');
    if (!accountName || accountName === 'all') {
      return NextResponse.json({ success: false, error: 'Nama brand tidak valid' }, { status: 400 });
    }

    // 1. Delete brand items from PostgreSQL Node 3 Storage DB
    try {
      await pgQuery('DELETE FROM content_flow_items WHERE account_name = $1;', [accountName]);
    } catch (pgErr) {
      console.warn('[API DELETE Brand PG Error]', pgErr.message);
    }

    // 2. Delete brand items from SQLite Node 1 local DB
    const deletedCount = await deleteContentFlowBrandItems(accountName);

    return NextResponse.json({ success: true, message: `Seluruh konten brand ${accountName} berhasil dihapus (${deletedCount} items)` });
  } catch (error) {
    console.error('[API /api/content-flow/brands DELETE Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
