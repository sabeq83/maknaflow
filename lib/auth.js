/**
 * Authentication & Session Management Module for MAKNA Grid (RBAC)
 */

import crypto from 'crypto';
import { getDb } from './db.js';
import { pgQuery } from './db-pg.js';
import { hashPassword, ALL_MENU_KEYS } from './schema/user-schema.js';
import { tenantContext } from './tenant-context.js';

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'makna_session';
const SESSION_DURATION_DAYS = 7;

// Session cache for synchronous lookup
export const activeSessionsCache = {};

export async function loadSessionsCache() {
  try {
    const now = new Date().toISOString();
    const sessions = await pgQuery(`
      SELECT s.token, s.expires_at, u.id, u.username, u.email, u.role, u.status, u.tenant_id
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE s.expires_at > ? AND u.status = 'active'
        AND (u.role = 'superadmin' OR t.status = 'active')
    `.replace('?', '$1'), [now]);

    for (const sess of sessions.rows) {
      const contextTenant = sess.role === 'superadmin' ? '__none__' : (sess.tenant_id || 'default_tenant');
      const userObj = await tenantContext.run(contextTenant, () => buildUserObject(getDb(), sess));
      activeSessionsCache[sess.token] = userObj;
    }
    console.log(`[PostgreSQL Cache] ${Object.keys(activeSessionsCache).length} active user sessions cached successfully.`);
  } catch (e) {
    console.warn('[PostgreSQL Cache Warning] Failed to load sessions cache:', e.message);
  }
}

// Automatically load sessions cache at boot
setTimeout(() => {
  loadSessionsCache().catch(err => console.error('Failed to load sessions cache:', err));
}, 700);

export async function loginUser(username, password) {
  const cleanUsername = (username || '').trim().toLowerCase();
  const cleanPassword = (password || '').trim();

  const userResult = await pgQuery(`
    SELECT u.* FROM users u
    LEFT JOIN tenants t ON u.tenant_id = t.id
    WHERE LOWER(u.username) = $1 AND u.status = 'active'
      AND (u.role = 'superadmin' OR t.status = 'active')
    LIMIT 1
  `, [cleanUsername]);
  const user = userResult.rows[0];
  if (!user) {
    return { success: false, error: 'Username atau password salah' };
  }

  const hashedPassword = hashPassword(cleanPassword);
  if (user.password_hash !== hashedPassword) {
    return { success: false, error: 'Username atau password salah' };
  }

  const session = await createSession(user.id);
  const contextTenant = user.role === 'superadmin' ? '__none__' : (user.tenant_id || 'default_tenant');
  const userObj = await tenantContext.run(contextTenant, () => buildUserObject(getDb(), user));
  activeSessionsCache[session.token] = userObj;
  
  return { success: true, user: userObj, token: session.token, expiresAt: session.expiresAt };
}

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const sessionId = `sess_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await pgQuery(`
    INSERT INTO sessions (id, user_id, token, expires_at)
    VALUES ($1, $2, $3, $4)
  `, [sessionId, userId, token, expiresAt]);

  return { token, expiresAt };
}

export async function destroySession(token) {
  if (!token) return;
  delete activeSessionsCache[token];
  const db = getDb();
  await db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export async function buildUserObject(db, user) {
  if (!user) return null;

  let menuPermissions = [];
  if (user.role === 'admin' || user.role === 'superadmin') {
    menuPermissions = ALL_MENU_KEYS.map(m => m.key);
  } else {
    const rows = await db.prepare(`
      SELECT menu_key FROM user_menu_permissions
      WHERE user_id = ? AND (can_read = 1 OR can_write = 1)
    `).all(user.id);
    menuPermissions = rows.map(r => r.menu_key);
  }

  const assignedBrands = user.role === 'superadmin' ? [] : await db.prepare(`
      SELECT ub.brand_id, bp.brand_name FROM user_brands ub
      LEFT JOIN brand_profiles bp ON ub.brand_id = bp.id AND bp.tenant_id = ?
      WHERE ub.user_id = ?
    `).all(user.tenant_id || 'default_tenant', user.id);
  const brandIds = assignedBrands.map(b => b.brand_id);
  const brandNames = assignedBrands.map(b => b.brand_name).filter(Boolean);

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    tenantId: user.role === 'superadmin' ? '__none__' : (user.tenant_id || 'default_tenant'),
    menuPermissions,
    assignedBrandIds: brandIds,
    assignedBrandNames: brandNames
  };
}

export function getSessionUser(token) {
  if (!token) return null;
  return activeSessionsCache[token] || null;
}

export function getCurrentUser(req) {
  let token = null;

  // 1. Check HTTP Cookies
  const cookiesHeader = req?.headers?.get ? req.headers.get('cookie') : req?.headers?.cookie;
  if (cookiesHeader) {
    const cookies = Object.fromEntries(
      cookiesHeader.split(';').map(c => {
        const [k, v] = c.trim().split('=');
        return [k, decodeURIComponent(v || '')];
      })
    );
    token = cookies[SESSION_COOKIE_NAME];
  }

  // 2. Check Authorization Header fallback
  if (!token) {
    const authHeader = req?.headers?.get ? req.headers.get('authorization') : req?.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  if (token) {
    const userFromToken = getSessionUser(token);
    if (userFromToken) {
      tenantContext.enterWith(userFromToken.tenantId || 'default_tenant');
      return userFromToken;
    }
  }

  return null;
}

export function getDataScope(currentUser, filterUserId = null, filterBrandId = null) {
  if (!currentUser) {
    return { isGlobal: true, userId: null, brandIds: [], tenantId: 'default_tenant' };
  }

  if (currentUser.role === 'superadmin') {
    return {
      isGlobal: false,
      userId: null,
      brandIds: [],
      tenantId: '__none__' // Superadmin has no access to operational data of any tenant
    };
  }

  const tenantId = currentUser.tenantId || 'default_tenant';

  if (currentUser.role === 'admin') {
    return {
      isGlobal: false,
      filterUserId: filterUserId || null,
      filterBrandId: filterBrandId || null,
      brandIds: [],
      tenantId
    };
  }

  return {
    isGlobal: false,
    filterUserId: currentUser.id,
    filterBrandId: filterBrandId || null,
    brandIds: currentUser.assignedBrandIds || [],
    tenantId
  };
}

export function requireSuperadmin(req) {
  const user = getCurrentUser(req);
  if (!user || user.role !== 'superadmin') {
    const error = new Error('Akses ditolak. Khusus Superadmin.');
    error.status = 403;
    throw error;
  }
  return user;
}

export function requireTenantAdmin(req) {
  const user = getCurrentUser(req);
  if (!user || user.role !== 'admin' || !user.tenantId || user.tenantId === '__none__') {
    const error = new Error('Akses ditolak. Khusus Admin Tenant.');
    error.status = 403;
    throw error;
  }
  return user;
}

export function withTenantContext(handler) {
  return async (request, ...args) => {
    try {
      const user = getCurrentUser(request);
      if (!user) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
          status: 401,
          headers: { 'content-type': 'application/json' }
        });
      }
      if (user.tenantId === '__none__') {
        return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
          status: 403,
          headers: { 'content-type': 'application/json' }
        });
      }
      return await tenantContext.run(user.tenantId || 'default_tenant', () => handler(request, ...args, user));
    } catch (err) {
      console.error('[API Wrapper Error]', err);
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: err.status || 500,
        headers: { 'content-type': 'application/json' }
      });
    }
  };
}
