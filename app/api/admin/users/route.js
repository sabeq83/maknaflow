import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, withTenantContext } from '@/lib/auth';
import { hashPassword, ALL_MENU_KEYS } from '@/lib/schema/user-schema';

export const GET = withTenantContext(async (req, _context, currentUser) => {
  try {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
      return NextResponse.json({ success: false, error: 'Akses ditolak. Khusus Admin.' }, { status: 403 });
    }

    const db = getDb();
    const users = await db.prepare(`
      SELECT id, username, email, role, status, created_at, updated_at
      FROM users
      WHERE (role != 'superadmin' OR ? = 'superadmin')
      ORDER BY created_at DESC
    `).all(currentUser.role);

    // Attach menu permissions and assigned brand profiles for each user
    const formattedUsers = await Promise.all(users.map(async u => {
      const perms = await db.prepare(`
        SELECT menu_key, can_read, can_write FROM user_menu_permissions WHERE user_id = ?
      `).all(u.id);

      const brands = await db.prepare(`
        SELECT ub.brand_id, bp.brand_name
        FROM user_brands ub
        JOIN brand_profiles bp ON ub.brand_id = bp.id AND bp.tenant_id = ?
        WHERE ub.user_id = ?
      `).all(currentUser.tenantId, u.id);

      return {
        ...u,
        menuPermissions: perms,
        assignedBrands: brands
      };
    }));

    return NextResponse.json({ success: true, users: formattedUsers, allMenus: ALL_MENU_KEYS });
  } catch (error) {
    console.error('[API Admin Users GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const POST = withTenantContext(async (req, _context, currentUser) => {
  try {
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Akses ditolak. Khusus Admin.' }, { status: 403 });
    }

    const body = await req.json();
    const { username, email, password, role = 'user', allowedMenuKeys = [], assignedBrandIds = [] } = body;

    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Username dan password wajib diisi' }, { status: 400 });
    }
    if (!['user', 'admin'].includes(role)) {
      return NextResponse.json({ success: false, error: 'Role hanya boleh user atau admin.' }, { status: 400 });
    }

    const db = getDb();
    
    // Check if username exists
    const existing = await db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return NextResponse.json({ success: false, error: 'Username sudah digunakan' }, { status: 400 });
    }

    const userId = `usr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const hashedPassword = hashPassword(password);

    await db.prepare(`
      INSERT INTO users (id, username, email, password_hash, role, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).run(userId, username, email || null, hashedPassword, role);

    // Save menu permissions
    const insertPerm = await db.prepare(`
      INSERT INTO user_menu_permissions (id, user_id, menu_key, can_read, can_write)
      VALUES (?, ?, ?, 1, 1)
    `);

    // If role is admin, grant all menus, else grant selected menu keys
    const menuKeysToGrant = role === 'admin' ? ALL_MENU_KEYS.map(m => m.key) : allowedMenuKeys;
    for (const key of menuKeysToGrant) {
      insertPerm.run(`perm_${userId}_${key}`, userId, key);
    }

    // Save assigned brands
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
      message: `User ${username} berhasil dibuat`,
      userId
    });
  } catch (error) {
    console.error('[API Admin Users POST Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
