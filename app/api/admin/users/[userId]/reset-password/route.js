import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, withTenantContext } from '@/lib/auth';
import { hashPassword } from '@/lib/schema/user-schema';

export const POST = withTenantContext(async (req, { params }, currentUser) => {
  try {
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Akses ditolak. Khusus Admin.' }, { status: 403 });
    }

    const resolvedParams = await Promise.resolve(params);
    const userId = resolvedParams?.userId;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID tidak valid' }, { status: 400 });
    }

    const body = await req.json();
    const { newPassword } = body;

    if (!newPassword || newPassword.trim() === '') {
      return NextResponse.json({ success: false, error: 'Password baru tidak boleh kosong' }, { status: 400 });
    }

    const db = getDb();
    const user = await db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(userId);

    if (!user) {
      return NextResponse.json({ success: false, error: 'User tidak ditemukan' }, { status: 404 });
    }

    if (user.role === 'superadmin' && currentUser.role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Akses ditolak. Tidak dapat mereset password Superadmin.' }, { status: 403 });
    }

    const hashedPassword = hashPassword(newPassword.trim());
    await db.prepare(`
      UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(hashedPassword, userId);

    return NextResponse.json({
      success: true,
      message: `Password untuk user '${user.username}' berhasil diperbarui!`
    });
  } catch (error) {
    console.error('[API Admin Reset Password Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
