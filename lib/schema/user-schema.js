/**
 * User Schema & RBAC Tables Initialization for MAKNA Grid
 */

import crypto from 'crypto';

export const ALL_MENU_KEYS = [
  { key: 'strategic_campaign', label: 'Strategic Campaign Generator', category: 'Campaign Generator' },
  { key: 'content_planner', label: 'Content Planner Calendar', category: 'Campaign Generator' },
  { key: 'sheets_autopilot', label: 'Sheets Autopilot Mass Engine', category: 'Campaign Generator' },
  { key: 'opc_mass_bridging', label: 'OPC Mass Bridging', category: 'Campaign Generator' },
  { key: 'pillar_campaign', label: 'Organic Pillar Campaign', category: 'Campaign Generator' },
  { key: 'recipe_labs', label: 'Recipe Engine Labs', category: 'Campaign Generator' },
  { key: 'bridge_injector', label: 'Bridge Injector & Multiplier', category: 'Campaign Generator' },
  { key: 'instant_campaign', label: 'Instant Video Campaign', category: 'Campaign Generator' },
  { key: 'product_database', label: 'Product Database', category: 'Campaign Generator' },
  { key: 'tts_studio', label: 'TTS Studio (Gemini & MiniMax)', category: 'Audio Studio' },
  { key: 'ffmpeg_studio', label: 'FFmpeg Smart Sync Studio', category: 'Video Studio' },
  { key: 'brand_profiles', label: 'Brand DNA Profiles (Akun Brand)', category: 'Brand Management' },
  { key: 'video_library', label: 'Media & Video Vault', category: 'Asset Vault' },
  { key: 'system_settings', label: 'Pengaturan System & API Keys', category: 'System Administration' },
  { key: 'edit_link_product', label: 'Edit Link Product', category: 'Data Editing' },
  { key: 'edit_link_affiliate', label: 'Edit Link Affiliate', category: 'Data Editing' },
  { key: 'edit_nama_product', label: 'Edit Nama Product', category: 'Data Editing' }
];

export function hashPassword(password) {
  const salt = 'makna_grid_salt_2026';
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export async function initUserTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_menu_permissions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      menu_key TEXT NOT NULL,
      can_read INTEGER DEFAULT 1,
      can_write INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, menu_key)
    );

    CREATE TABLE IF NOT EXISTS user_brands (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      brand_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, brand_id)
    );
  `);

  // Seed default admin user if no users exist
  const count = await db.prepare('SELECT COUNT(*) as cnt FROM users').get();
  if (count.cnt === 0) {
    const adminId = 'usr_admin_default';
    const adminHash = hashPassword('admin123');

    await db.prepare(`
      INSERT INTO users (id, username, email, password_hash, role, status)
      VALUES (?, 'admin', 'admin@makna.grid', ?, 'admin', 'active')
    `).run(adminId, adminHash);

    // Grant all menu permissions to admin
    const insertPerm = await db.prepare(`
      INSERT INTO user_menu_permissions (id, user_id, menu_key, can_read, can_write)
      VALUES (?, ?, ?, 1, 1)
    `);

    for (const menu of ALL_MENU_KEYS) {
      insertPerm.run(`perm_${adminId}_${menu.key}`, adminId, menu.key);
    }

    console.log('✅ Default Admin user initialized (username: admin / password: admin123)');
  }
}
