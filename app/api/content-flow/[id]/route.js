import { NextResponse } from 'next/server';
import { updateContentFlowPublishStatus, getContentFlowItemById, deleteContentFlowItem } from '@/lib/db';
import { pgQuery } from '@/lib/db-pg';
import { getCurrentUser } from '@/lib/auth';

export async function PATCH(request, { params }) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams?.id || params?.id;
    const body = await request.json();

    const currentUser = getCurrentUser(request);
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

    // Try updating PostgreSQL Node 3 first
    let pgUpdatedItem = null;
    try {
      const allowedKeys = [
        'tiktok_status', 'tiktok_publish_date', 'permalink_tiktok',
        'facebook_status', 'facebook_publish_date', 'permalink_facebook',
        'instagram_status', 'instagram_publish_date', 'permalink_instagram',
        'youtube_status', 'youtube_publish_date', 'permalink_youtube',
        'account_name', 'drive_link', 'nextcloud_url', 'url_asset',
        'link_produk', 'link_affiliate', 'nama_produk', 'pipeline_status', 'catatan'
      ];
      const fields = [];
      const values = [];
      for (const key of Object.keys(body)) {
        if (allowedKeys.includes(key) && body[key] !== undefined) {
          values.push(body[key]);
          fields.push(`"${key}" = $${values.length}`);
        }
      }
      if (fields.length > 0) {
        values.push(new Date().toISOString());
        fields.push(`"updated_at" = $${values.length}`);
        values.push(id);
        const sql = `UPDATE content_flow_items SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *;`;
        const pgRes = await pgQuery(sql, values);
        if (pgRes.rows.length > 0) {
          pgUpdatedItem = pgRes.rows[0];
        }
      }
    } catch (pgErr) {
      console.warn('[API /api/content-flow/[id] PATCH] PostgreSQL update error:', pgErr.message);
    }

    // Sync update to SQLite as fallback
    await updateContentFlowPublishStatus(id, body);

    const updatedItem = pgUpdatedItem || await getContentFlowItemById(id);
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

    // 1. Delete from PostgreSQL Node 3 Storage DB
    try {
      await pgQuery('DELETE FROM content_flow_items WHERE id = $1;', [id]);
    } catch (pgErr) {
      console.warn('[API DELETE ContentFlow PG Error]', pgErr.message);
    }

    // 2. Delete from SQLite Node 1 local DB
    await deleteContentFlowItem(id);

    return NextResponse.json({ success: true, message: `Konten ${id} berhasil dihapus` });
  } catch (error) {
    console.error('[API /api/content-flow/[id] DELETE Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
