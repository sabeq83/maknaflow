/**
 * User Schema & RBAC Tables Initialization for MAKNA Grid
 */

import crypto from 'crypto';

export const ALL_MENU_KEYS = [
  // PLANNING
  { key: 'content_planner', label: 'Content Planner Calendar', category: 'PLANNING' },
  { key: 'product_database', label: 'Product Database', category: 'PLANNING' },
  { key: 'deconstruct_lab', label: 'Deconstruct Lab', category: 'PLANNING' },
  { key: 'operator_presets', label: 'Preset Manager', category: 'PLANNING' },
  { key: 'brand_profiles', label: 'Brand DNA Profiles (Akun Brand)', category: 'PLANNING' },
  { key: 'universe_manager', label: 'Universe Manager (Story & Mascots)', category: 'PLANNING' },

  // WORKFLOW
  { key: 'youtube_studio', label: 'YouTube Studio (Long-form AI)', category: 'WORKFLOW' },
  { key: 'affiliate_studio', label: 'Affiliate Studio (Brand Commerce OS)', category: 'WORKFLOW' },
  { key: 're_campaign', label: 'RE Campaign', category: 'WORKFLOW' },
  { key: 'pillar_campaign', label: 'Organic Pillar Campaign', category: 'WORKFLOW' },
  { key: 'sheets_autopilot', label: 'Sheets Autopilot Mass Engine', category: 'WORKFLOW' },
  { key: 'recipe_labs', label: 'Recipe Engine Labs', category: 'WORKFLOW' },
  { key: 'instant_campaign', label: 'Instant Video Campaign', category: 'WORKFLOW' },
  { key: 'multiplier_lab', label: 'Multiplier Lab', category: 'WORKFLOW' },
  { key: 'product_bridging', label: 'Product Bridging', category: 'WORKFLOW' },

  // PUBLISHING
  { key: 'content_flow', label: 'ContentFlow Hub', category: 'PUBLISHING' },
  { key: 'content_automations', label: 'Content Automations', category: 'PUBLISHING' },

  // TOOLS
  { key: 'ffmpeg_studio', label: 'FFmpeg Smart Sync Studio', category: 'TOOLS' },
  { key: 'tts_studio', label: 'TTS Studio (Gemini & MiniMax)', category: 'TOOLS' },
  { key: 'video_library', label: 'Media & Video Vault', category: 'TOOLS' },

  // SYSTEM
  { key: 'system_health', label: 'System Health', category: 'SYSTEM' },
  { key: 'system_settings', label: 'Pengaturan System & API Keys', category: 'SYSTEM' },

  // DATA EDITING
  { key: 'edit_link_product', label: 'Edit Link Product', category: 'DATA EDITING' },
  { key: 'edit_link_affiliate', label: 'Edit Link Affiliate', category: 'DATA EDITING' },
  { key: 'edit_nama_product', label: 'Edit Nama Product', category: 'DATA EDITING' }
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

  // Migration of legacy menu permission keys to new split keys (v2.2.157)
  try {
    const migrations = [
      { oldKey: 'content_planner', newKeys: ['content_automations', 'content_flow'] },
      { oldKey: 'opc_mass_bridging', newKeys: ['re_campaign', 'deconstruct_lab'] },
      { oldKey: 'bridge_injector', newKeys: ['multiplier_lab', 'product_bridging'] },
      { oldKey: 'system_settings', newKeys: ['system_health'] }
    ];

    for (const mig of migrations) {
      // Find all users who have the old permission
      const usersWithOldPerm = await db.prepare("SELECT user_id FROM user_menu_permissions WHERE menu_key = ?").all(mig.oldKey);
      for (const u of usersWithOldPerm) {
        for (const newKey of mig.newKeys) {
          const id = `perm_${u.user_id}_${newKey}`;
          // Use INSERT OR IGNORE / ON CONFLICT to avoid duplicate key violations
          await db.prepare("INSERT OR IGNORE INTO user_menu_permissions (id, user_id, menu_key, can_read, can_write) VALUES (?, ?, ?, 1, 1)").run(id, u.user_id, newKey);
        }
      }
    }
    // Clean up legacy unused key 'strategic_campaign'
    await db.prepare("DELETE FROM user_menu_permissions WHERE menu_key = ?").run('strategic_campaign');
  } catch (e) {
    console.warn('[DB Migration Warning] Failed to migrate user menu permissions:', e.message);
  }
}
