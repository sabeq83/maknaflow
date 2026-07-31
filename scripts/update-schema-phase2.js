import { pgQuery } from '../lib/db-pg.js';

async function main() {
  console.log('🏁 Starting Phase 2 PostgreSQL SaaS Schema Update...');
  try {
    // 1. Create tenants table if not exists
    await pgQuery(`
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ tenants table created/verified');

    // 2. Create tenant_settings table if not exists
    await pgQuery(`
      CREATE TABLE IF NOT EXISTS tenant_settings (
        tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        setting_key TEXT NOT NULL,
        setting_value TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (tenant_id, setting_key)
      );
    `);
    console.log('✓ tenant_settings table created/verified');

    // 3. Insert default tenant if none exists
    const defaultTenantCheck = await pgQuery("SELECT id FROM tenants WHERE id = $1", ['default_tenant']);
    if (defaultTenantCheck.rowCount === 0) {
      await pgQuery("INSERT INTO tenants (id, name) VALUES ($1, $2)", ['default_tenant', 'Default Tenant']);
      console.log('✓ Seeded default_tenant');
    }

    // 4. Alter tables to add tenant_id column
    const tablesToAlter = [
      { name: 'users', cascade: false },
      { name: 'brand_profiles', cascade: true },
      { name: 'gemini_api_keys', cascade: true },
      { name: 'content_planners', cascade: true },
      { name: 'strategic_campaigns', cascade: true },
      { name: 'pillar_campaigns', cascade: true },
      { name: 're_campaigns', cascade: true },
      { name: 'instant_campaigns', cascade: true },
      { name: 'product_extractions', cascade: true },
      { name: 'ideas', cascade: true },
      { name: 'knowledge_bases', cascade: true }
    ];

    for (const table of tablesToAlter) {
      const constraintBehavior = table.cascade ? 'ON DELETE CASCADE' : 'ON DELETE SET NULL';
      try {
        await pgQuery(`
          ALTER TABLE ${table.name} 
          ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ${constraintBehavior};
        `);
        console.log(`✓ Column tenant_id added to table '${table.name}'`);

        // Backfill existing nulls to default_tenant
        const updateRes = await pgQuery(`
          UPDATE ${table.name} 
          SET tenant_id = $1 
          WHERE tenant_id IS NULL;
        `, ['default_tenant']);
        if (updateRes.rowCount > 0) {
          console.log(`✓ Backfilled ${updateRes.rowCount} rows in '${table.name}' with 'default_tenant'`);
        }
      } catch (err) {
        console.error(`❌ Failed to alter table '${table.name}':`, err.message);
      }
    }

    // 5. Add nextcloud_parent_folder and drive_parent_folder to brand_profiles if not exists
    try {
      await pgQuery(`
        ALTER TABLE brand_profiles 
        ADD COLUMN IF NOT EXISTS nextcloud_parent_folder TEXT;
      `);
      await pgQuery(`
        ALTER TABLE brand_profiles 
        ADD COLUMN IF NOT EXISTS drive_parent_folder TEXT;
      `);
      console.log("✓ Parent folder columns verified in 'brand_profiles'");
    } catch (err) {
      console.error("❌ Failed to add folder columns to brand_profiles:", err.message);
    }

    // 6. Migrate global settings to tenant_settings for the default tenant
    const globalSettings = await pgQuery("SELECT key, value FROM settings");
    console.log(`ℹ Found ${globalSettings.rowCount} global settings to migrate`);
    for (const row of globalSettings.rows) {
      await pgQuery(`
        INSERT INTO tenant_settings (tenant_id, setting_key, setting_value)
        VALUES ($1, $2, $3)
        ON CONFLICT (tenant_id, setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value
      `, ['default_tenant', row.key, row.value]);
    }
    console.log("✓ Migrated global settings to default_tenant_settings");

    console.log('🎉 Phase 2 PostgreSQL SaaS Schema Update completed successfully!');
  } catch (error) {
    console.error('💥 Fatal error in Phase 2 Schema Update:', error.message);
  }
}

main();
