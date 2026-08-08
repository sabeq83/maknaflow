import crypto from 'crypto';
import { pgQuery, withPgTransaction } from './db-pg.js';
import { ALL_MENU_KEYS, hashPassword } from './schema/user-schema.js';

function slugify(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function provisionTenant(input, actor) {
  const name = String(input?.name || '').trim();
  const slug = slugify(input?.slug || name);
  const timezone = String(input?.timezone || 'Asia/Jakarta').trim();
  const username = String(input?.admin_username || '').trim().toLowerCase();
  const password = String(input?.admin_password || '');
  if (!name || !slug || !username) throw new Error('Nama tenant, slug, dan username admin wajib diisi.');
  if (password.length < 12) throw new Error('Password admin tenant minimal 12 karakter.');
  const tenantId = `tnt_${slug}_${crypto.randomBytes(3).toString('hex')}`;
  const userId = `usr_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
  return withPgTransaction(async client => {
    const duplicate = await client.query('SELECT 1 FROM tenants WHERE slug = $1', [slug]);
    if (duplicate.rowCount) throw new Error('Slug tenant sudah digunakan.');
    const duplicateUser = await client.query('SELECT 1 FROM users WHERE LOWER(username) = $1', [username]);
    if (duplicateUser.rowCount) throw new Error('Username admin sudah digunakan.');
    const tenantResult = await client.query(`
      INSERT INTO tenants (id, name, slug, timezone, status)
      VALUES ($1, $2, $3, $4, 'active')
      RETURNING id, name, slug, timezone, status, created_at
    `, [tenantId, name, slug, timezone]);
    const adminResult = await client.query(`
      INSERT INTO users (id, tenant_id, username, email, password_hash, role, status)
      VALUES ($1, $2, $3, $4, $5, 'admin', 'active')
      RETURNING id, tenant_id, username, email, role, status
    `, [userId, tenantId, username, input.admin_email || null, hashPassword(password)]);
    for (const menu of ALL_MENU_KEYS) {
      await client.query(`
        INSERT INTO user_menu_permissions (id, user_id, menu_key, can_read, can_write)
        VALUES ($1, $2, $3, 1, 1) ON CONFLICT (user_id, menu_key) DO NOTHING
      `, [`perm_${userId}_${menu.key}`, userId, menu.key]);
    }
    const defaults = { timezone, gemini_model: 'gemini-2.5-flash' };
    for (const [key, value] of Object.entries(defaults)) {
      await client.query(`INSERT INTO tenant_settings (tenant_id, setting_key, setting_value) VALUES ($1, $2, $3) ON CONFLICT (tenant_id, setting_key) DO NOTHING`, [tenantId, key, value]);
    }
    await client.query(`INSERT INTO tenant_audit_events (actor_user_id, tenant_id, event_type, event_json) VALUES ($1, $2, 'tenant.created', $3)`, [actor.id, tenantId, JSON.stringify({ admin_user_id: userId })]);
    return { tenant: tenantResult.rows[0], admin: adminResult.rows[0] };
  });
}

export async function listTenantsWithCounts() {
  const result = await pgQuery(`
    SELECT t.id, t.name, t.slug, t.timezone, t.status, t.disabled_menus, t.created_at, t.updated_at,
      COUNT(DISTINCT u.id)::int user_count,
      COUNT(DISTINCT b.id)::int brand_count,
      COUNT(DISTINCT k.id)::int key_count
    FROM tenants t
    LEFT JOIN users u ON u.tenant_id = t.id
    LEFT JOIN brand_profiles b ON b.tenant_id = t.id
    LEFT JOIN gemini_api_keys k ON k.tenant_id = t.id
    GROUP BY t.id ORDER BY t.created_at
  `);
  return result.rows;
}

export async function updateTenant(tenantId, updates, actor) {
  const allowedStatus = ['active', 'inactive', 'suspended'];
  const status = updates?.status;
  const timezone = updates?.timezone;
  const disabledMenus = updates?.disabled_menus !== undefined ? JSON.stringify(updates.disabled_menus) : null;
  if (status && !allowedStatus.includes(status)) throw new Error('Status tenant tidak valid.');
  return withPgTransaction(async client => {
    const result = await client.query(`
      UPDATE tenants SET
        status = COALESCE($2, status),
        timezone = COALESCE($3, timezone),
        disabled_menus = CASE WHEN $4::jsonb IS NOT NULL THEN $4::jsonb ELSE disabled_menus END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, name, slug, timezone, status, disabled_menus, updated_at
    `, [tenantId, status || null, timezone || null, disabledMenus]);
    if (!result.rowCount) throw new Error('Tenant tidak ditemukan.');
    if (status && status !== 'active') await client.query('DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE tenant_id = $1)', [tenantId]);
    await client.query(`INSERT INTO tenant_audit_events (actor_user_id, tenant_id, event_type, event_json) VALUES ($1, $2, 'tenant.updated', $3)`, [actor.id, tenantId, JSON.stringify({ status, timezone, disabled_menus: updates?.disabled_menus })]);
    return result.rows[0];
  });
}
