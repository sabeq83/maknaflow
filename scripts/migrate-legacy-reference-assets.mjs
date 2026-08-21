import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getPgPool, pgQuery } from '../lib/db-pg.js';
import { tenantContext } from '../lib/tenant-context.js';
import { importLegacyReference } from '../lib/reference-asset-service.js';

// Parse arguments
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const tenantIndex = args.indexOf('--tenant');
const tenantId = tenantIndex !== -1 ? args[tenantIndex + 1] : null;

if (!tenantId) {
  console.error('Error: Please specify target tenant with --tenant <tenant_id>');
  process.exit(1);
}

console.log(`=== Legacy Reference Asset Migration ===`);
console.log(`Tenant ID: ${tenantId}`);
console.log(`Mode: ${apply ? 'APPLY (Mutations Active)' : 'DRY RUN (Read Only)'}`);
console.log(`========================================\n`);

async function runMigration() {
  await tenantContext.run(tenantId, async () => {
    try {
      // 1. Fetch character references
      const chars = (await pgQuery('SELECT id, name, character_key, reference_image_path FROM universe_characters WHERE tenant_id = $1', [tenantId])).rows;
      console.log(`Found ${chars.length} characters in database.`);
      
      for (const char of chars) {
        if (!char.reference_image_path) continue;
        console.log(`- Character "${char.name}" has legacy path: ${char.reference_image_path}`);
        if (apply) {
          try {
            const imported = await importLegacyReference({
              owner_type: 'character',
              owner_id: char.id,
              role: 'identity'
            }, 'migration_script');
            console.log(`  ✅ Successfully imported character identity! ID: ${imported.id}`);
          } catch (e) {
            console.error(`  ❌ Failed to import: ${e.message}`);
          }
        } else {
          console.log(`  [Dry Run] Would import character identity legacy path.`);
        }
      }

      // 2. Fetch location references
      const locs = (await pgQuery('SELECT id, name, location_key, reference_image_path FROM universe_locations WHERE tenant_id = $1', [tenantId])).rows;
      console.log(`\nFound ${locs.length} locations in database.`);
      
      for (const loc of locs) {
        if (!loc.reference_image_path) continue;
        console.log(`- Location "${loc.name}" has legacy path: ${loc.reference_image_path}`);
        if (apply) {
          try {
            const imported = await importLegacyReference({
              owner_type: 'location',
              owner_id: loc.id,
              role: 'location'
            }, 'migration_script');
            console.log(`  ✅ Successfully imported location reference! ID: ${imported.id}`);
          } catch (e) {
            console.error(`  ❌ Failed to import: ${e.message}`);
          }
        } else {
          console.log(`  [Dry Run] Would import location reference legacy path.`);
        }
      }

      // 3. Fetch universe references
      const profiles = (await pgQuery('SELECT id, name, slug, style_reference_path FROM universe_profiles WHERE tenant_id = $1', [tenantId])).rows;
      console.log(`\nFound ${profiles.length} universe profiles in database.`);
      
      for (const profile of profiles) {
        if (!profile.style_reference_path) continue;
        console.log(`- Profile "${profile.name}" has legacy path: ${profile.style_reference_path}`);
        if (apply) {
          try {
            const imported = await importLegacyReference({
              owner_type: 'universe',
              owner_id: profile.id,
              role: 'visual_style'
            }, 'migration_script');
            console.log(`  ✅ Successfully imported style reference! ID: ${imported.id}`);
          } catch (e) {
            console.error(`  ❌ Failed to import: ${e.message}`);
          }
        } else {
          console.log(`  [Dry Run] Would import style reference legacy path.`);
        }
      }

    } catch (err) {
      console.error('Migration failed:', err.message);
    }
  });

  process.exit(0);
}

runMigration();
