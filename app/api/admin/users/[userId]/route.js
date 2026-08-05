import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, withTenantContext } from '@/lib/auth';
import { hashPassword, ALL_MENU_KEYS } from '@/lib/schema/user-schema';

export const PUT = withTenantContext(async (req, { params }, currentUser) => {
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
    const { email, password, role, status, allowedMenuKeys = [], assignedBrandIds = [] } = body;
    if (role && !['user', 'admin'].includes(role)) {
      return NextResponse.json({ success: false, error: 'Role hanya boleh user atau admin.' }, { status: 400 });
    }

    const db = getDb();
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    if (!user) {
      return NextResponse.json({ success: false, error: 'User tidak ditemukan' }, { status: 404 });
    }

    // Update user info
    if (password && password.trim() !== '') {
      const hashedPassword = hashPassword(password.trim());
      await db.prepare(`
        UPDATE users SET email = ?, password_hash = ?, role = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(email || user.email, hashedPassword, role || user.role, status || user.status, userId);
    } else {
      await db.prepare(`
        UPDATE users SET email = ?, role = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(email || user.email, role || user.role, status || user.status, userId);
    }

    // Update menu permissions
    await db.prepare('DELETE FROM user_menu_permissions WHERE user_id = ?').run(userId);
    const insertPerm = await db.prepare(`
      INSERT INTO user_menu_permissions (id, user_id, menu_key, can_read, can_write)
      VALUES (?, ?, ?, 1, 1)
    `);

    const menuKeysToGrant = role === 'admin' ? ALL_MENU_KEYS.map(m => m.key) : allowedMenuKeys;
    for (const key of menuKeysToGrant) {
      insertPerm.run(`perm_${userId}_${key}`, userId, key);
    }

    // Update assigned brands
    await db.prepare('DELETE FROM user_brands WHERE user_id = ?').run(userId);
    const insertBrand = await db.prepare(`
      INSERT INTO user_brands (id, user_id, brand_id)
      VALUES (?, ?, ?)
    `);
    for (const brandId of assignedBrandIds) {
      const tenantBrand = await db.prepare('SELECT id FROM brand_profiles WHERE id = ?').get(brandId);
      if (!tenantBrand) continue;
      insertBrand.run(`ub_${userId}_${brandId}`, userId, brandId);
    }

    return NextResponse.json({
      success: true,
      message: `User ${user.username} berhasil diperbarui`
    });
  } catch (error) {
    console.error('[API Admin User PUT Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const DELETE = withTenantContext(async (req, { params }, currentUser) => {
  try {
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Akses ditolak. Khusus Admin.' }, { status: 403 });
    }

    const resolvedParams = await Promise.resolve(params);
    const userId = resolvedParams?.userId;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID tidak valid' }, { status: 400 });
    }

    const db = getDb();

    // Prevent deleting default admin
    if (userId === 'usr_admin_default') {
      return NextResponse.json({ success: false, error: 'Default Admin tidak dapat dihapus' }, { status: 400 });
    }

    await db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    return NextResponse.json({ success: true, message: 'User berhasil dihapus' });
  } catch (error) {
    console.error('[API Admin User DELETE Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
