import { NextResponse } from 'next/server';
import { deleteContentFlowItem, updateContentFlowItem, getContentFlowItemById } from '@/lib/contentflow-repository';
import { withTenantContext } from '@/lib/auth';

export const GET = withTenantContext(async (request, { params }, currentUser) => {
  try {
    const resolvedParams = await params;
    const id = resolvedParams?.id || params?.id;
    const item = await getContentFlowItemById(currentUser.tenantId, id);
    if (!item) return NextResponse.json({ success: false, error: 'Content not found' }, { status: 404 });
    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error('[API /api/content-flow/[id] GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});


export const PATCH = withTenantContext(async (request, { params }, currentUser) => {
  try {
    const resolvedParams = await params;
    const id = resolvedParams?.id || params?.id;
    const body = await request.json();

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
});

export const DELETE = withTenantContext(async (request, { params }, currentUser) => {
  try {
    if (currentUser.role !== 'admin') {
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
});
