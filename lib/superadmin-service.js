import crypto from 'crypto';
import { pgQuery, withPgTransaction } from './db-pg.js';
import { hashPassword } from './schema/user-schema.js';

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function validatePassword(password) {
  if (String(password || '').length < 12) {
    throw new Error('Password superadmin minimal 12 karakter.');
  }
}

export async function createSuperadmin({ username, email, password }, { actorUserId = null, bootstrap = false } = {}) {
  const cleanUsername = normalizeUsername(username);
  if (!cleanUsername) throw new Error('Username superadmin wajib diisi.');
  validatePassword(password);
  return withPgTransaction(async client => {
    const existingSuperadmins = await client.query("SELECT COUNT(*)::int count FROM users WHERE role = 'superadmin'");
    if (existingSuperadmins.rows[0].count > 0 && bootstrap) {
      throw new Error('Bootstrap ditolak karena akun superadmin sudah tersedia.');
    }
    if (existingSuperadmins.rows[0].count > 0 && !actorUserId) {
      throw new Error('Pembuatan superadmin tambahan memerlukan superadmin aktif.');
    }
    const duplicate = await client.query('SELECT id FROM users WHERE LOWER(username) = $1 OR ($2::text IS NOT NULL AND LOWER(email) = LOWER($2))', [cleanUsername, email || null]);
    if (duplicate.rowCount > 0) throw new Error('Username atau email sudah digunakan.');
    const id = `usr_super_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
    const result = await client.query(`
      INSERT INTO users (id, tenant_id, username, email, password_hash, role, status)
      VALUES ($1, NULL, $2, $3, $4, 'superadmin', 'active')
      RETURNING id, username, email, role, status
    `, [id, cleanUsername, email || null, hashPassword(password)]);
    await client.query(`
      INSERT INTO tenant_audit_events (actor_user_id, tenant_id, event_type, event_json)
      VALUES ($1, NULL, 'superadmin.created', $2)
    `, [actorUserId, JSON.stringify({ user_id: id, bootstrap })]);
    return result.rows[0];
  });
}

export async function deactivateSuperadmin(id, actorUserId) {
  if (!actorUserId) throw new Error('Actor superadmin wajib diisi.');
  return withPgTransaction(async client => {
    const active = await client.query("SELECT COUNT(*)::int count FROM users WHERE role = 'superadmin' AND status = 'active'");
    const target = await client.query("SELECT id, status FROM users WHERE id = $1 AND role = 'superadmin' FOR UPDATE", [id]);
    if (target.rowCount === 0) throw new Error('Superadmin tidak ditemukan.');
    if (target.rows[0].status === 'active' && active.rows[0].count <= 1) {
      throw new Error('Superadmin aktif terakhir tidak dapat dinonaktifkan.');
    }
    await client.query("UPDATE users SET status = 'inactive', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
    await client.query("DELETE FROM sessions WHERE user_id = $1", [id]);
    await client.query(`INSERT INTO tenant_audit_events (actor_user_id, event_type, event_json) VALUES ($1, 'superadmin.deactivated', $2)`, [actorUserId, JSON.stringify({ user_id: id })]);
    return { id, status: 'inactive' };
  });
}

export async function listSuperadmins() {
  const result = await pgQuery("SELECT id, username, email, role, status, created_at, updated_at FROM users WHERE role = 'superadmin' ORDER BY created_at");
  return result.rows;
}
