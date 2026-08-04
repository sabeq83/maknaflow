import { NextResponse } from 'next/server';
import { deleteContentFlowItem, updateContentFlowItem } from '@/lib/contentflow-repository';
import { getCurrentUser } from '@/lib/auth';

export async function PATCH(request, { params }) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams?.id || params?.id;
    const body = await request.json();

    const currentUser = getCurrentUser(request);
    if (!currentUser || currentUser.tenantId === '__none__') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: currentUser ? 403 : 401 });
    }
    const userRole = currentUser ? currentUser.role : 'user';
    const permissions = currentUser && Array.isArray(currentUser.menuPermissions) ? currentUser.menuPermissions : [];

    // RBAC Permissions check for data editing fields
    if (body.link_produk !== undefined && userRole !== 'admin' && !permissions.includes('edit_link_product')) {
      return NextResponse.json({ success: false, error: 'Akses ditolak: Anda tidak memiliki izin untuk mengubah Link Product' }, { status: 403 });
    }
    if (body.link_affiliate !== undefined && userRole !== 'admin' && !permissions.includes('edit_link_affiliate')) {
      return NextResponse.json({ success: false, error: 'Akses ditolak: Anda tidak memiliki izin untuk mengubah Link Affiliate' }, { status: 403 });
    }
    if (body.nama_produk !== undefined && userRole !== 'admin' && !permissions.includes('edit_nama_product')) {
      return NextResponse.json({ success: false, error: 'Akses ditolak: Anda tidak memiliki izin untuk mengubah Nama Product' }, { status: 403 });
    }

    const updatedItem = await updateContentFlowItem(id, body);
    if (!updatedItem) return NextResponse.json({ success: false, error: 'Content not found' }, { status: 404 });
    return NextResponse.json({ success: true, item: updatedItem });
  } catch (error) {
    console.error('[API /api/content-flow/[id] PATCH Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const currentUser = getCurrentUser(request);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Akses ditolak: Hanya Admin yang dapat menghapus konten' }, { status: 403 });
    }

    const resolvedParams = await params;
    const id = resolvedParams?.id || params?.id;

    const deleted = await deleteContentFlowItem(id);
    if (!deleted) return NextResponse.json({ success: false, error: 'Content not found' }, { status: 404 });

    return NextResponse.json({ success: true, message: `Konten ${id} berhasil dihapus` });
  } catch (error) {
    console.error('[API /api/content-flow/[id] DELETE Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
