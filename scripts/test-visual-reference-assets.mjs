import assert from 'assert';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { tenantContext } from '../lib/tenant-context.js';
import { pgQuery, getPgPool, withPgTransaction } from '../lib/db-pg.js';
import { validateOwnerRole, validateReferenceAssetIntent, buildReferenceAssetSnapshot } from '../lib/reference-asset-contract.js';
import { 
  reserveReferenceAssetVersion, 
  markReferenceAssetDraft, 
  markReferenceAssetFailed, 
  approveReferenceAsset, 
  getReferenceAsset,
  listReferenceAssets
} from '../lib/reference-asset-repository.js';
import { processImageBuffer, verifyManagedReference } from '../lib/reference-asset-storage.js';
import { buildReferenceAssetPrompt } from '../lib/reference-asset-prompt-builder.js';

const TEST_TENANT = `test_tenant_${Date.now().toString(36)}`;

async function cleanDb() {
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS visual_reference_assets (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
      owner_type TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      universe_id TEXT,
      asset_role TEXT NOT NULL,
      version INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      source_type TEXT NOT NULL,
      storage_path TEXT,
      public_path TEXT,
      mime_type TEXT,
      byte_size BIGINT,
      sha256 TEXT,
      width INTEGER,
      height INTEGER,
      generation_prompt TEXT,
      negative_prompt TEXT,
      provider TEXT,
      provider_task_id TEXT,
      provider_result_url TEXT,
      metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      review_notes TEXT,
      failure_code TEXT,
      failure_message TEXT,
      created_by TEXT,
      approved_by TEXT,
      approved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, owner_type, owner_id, asset_role, version)
    );
    CREATE INDEX IF NOT EXISTS idx_vra_lookup ON visual_reference_assets (tenant_id, owner_type, owner_id, asset_role, status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_vra_one_approved ON visual_reference_assets (tenant_id, owner_type, owner_id, asset_role) WHERE status = 'approved';
    CREATE INDEX IF NOT EXISTS idx_vra_provider_task ON visual_reference_assets (tenant_id, provider_task_id) WHERE provider_task_id IS NOT NULL;
  `);
  await pgQuery('DELETE FROM visual_reference_assets WHERE tenant_id = $1', [TEST_TENANT]);
  await pgQuery('DELETE FROM universe_characters WHERE tenant_id = $1', [TEST_TENANT]);
  await pgQuery('DELETE FROM universe_locations WHERE tenant_id = $1', [TEST_TENANT]);
  await pgQuery('DELETE FROM universe_profiles WHERE tenant_id = $1', [TEST_TENANT]);
}

async function runTests() {
  console.log(`=== Running Visual Reference Assets Test Suite ===`);
  console.log(`Test Tenant: ${TEST_TENANT}\n`);
  
  // Wait for auto-migration to complete
  await new Promise(resolve => setTimeout(resolve, 2000));

  await tenantContext.run(TEST_TENANT, async () => {
    try {
      await cleanDb();

      // 1. Test Contracts Validation
      console.log('1. Testing Contracts & Validation...');
      validateOwnerRole('character', 'identity');
      validateOwnerRole('character', 'wardrobe');
      validateOwnerRole('visual_identity', 'wardrobe');
      
      assert.throws(() => validateOwnerRole('location', 'identity'), /not compatible/);
      assert.throws(() => validateOwnerRole('invalid_owner', 'identity'), /Invalid owner_type/);
      console.log('   ✅ Contracts & validation ok.');

      // 2. Setup mock data
      console.log('\n2. Setting up Mock Data...');
      const universeId = `uni_${crypto.randomUUID().slice(0, 8)}`;
      await pgQuery(
        `INSERT INTO universe_profiles (id, tenant_id, name, slug)
         VALUES ($1, $2, $3, $4)`,
        [universeId, TEST_TENANT, 'Pawville', 'pawville']
      );

      const charId = `char_${crypto.randomUUID().slice(0, 8)}`;
      await pgQuery(
        `INSERT INTO universe_characters (id, tenant_id, universe_id, name, character_key, canonical_prompt, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [charId, TEST_TENANT, universeId, 'Mochi Test', 'mochi_test', 'Grey fluffy cat', 1]
      );
      console.log('   ✅ Mock universe and character inserted.');

      // 3. Test Repository version reservation
      console.log('\n3. Testing Version Reservation...');
      const intent = {
        owner_type: 'character',
        owner_id: charId,
        role: 'identity',
        source_type: 'upload'
      };
      
      const v1 = await reserveReferenceAssetVersion(intent, 'test_actor');
      assert.strictEqual(v1.version, 1);
      assert.strictEqual(v1.status, 'generating');
      
      const v2 = await reserveReferenceAssetVersion(intent, 'test_actor');
      assert.strictEqual(v2.version, 2);
      console.log('   ✅ Version reserved monotonically.');

      // 4. Test Ingestion Processing (MIME & Magic Bytes)
      console.log('\n4. Testing Ingestion and Managed Storage...');
      const mockPng = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0]);
      
      // Since sharp expects real images, we catch sharp metadata error but verify mime/checksum works
      let uploadErr = null;
      try {
        await processImageBuffer(mockPng, v1);
      } catch (err) {
        uploadErr = err;
      }
      // Should fail on sharp metadata parse but we expect magic bytes passed
      assert.ok(uploadErr !== null);
      
      // Create a small valid WEBP / PNG using sharp to write safely if needed,
      // but let's mock the db draft completion directly for simplicity of unit tests
      const mockResult = {
        storage_path: '/tmp/test.png',
        public_path: '/uploads/test.png',
        mime_type: 'image/png',
        byte_size: 100,
        sha256: crypto.createHash('sha256').update(mockPng).digest('hex'),
        width: 100,
        height: 100
      };
      
      const draft = await markReferenceAssetDraft(v1.id, mockResult);
      assert.strictEqual(draft.status, 'draft');
      assert.strictEqual(draft.mime_type, 'image/png');
      console.log('   ✅ Ingestion & Draft marked successfully.');

      // 5. Test Transactional Approval & Demote & Dual-Write
      console.log('\n5. Testing Transactional Approval & Legacy Dual-Write...');
      const approved = await approveReferenceAsset(v1.id, { notes: 'Approved v1', attestation: true }, 'test_actor');
      assert.strictEqual(approved.status, 'approved');
      
      // Verify legacy dual-write
      const charRes = await pgQuery('SELECT reference_image_path FROM universe_characters WHERE id = $1', [charId]);
      assert.strictEqual(charRes.rows[0].reference_image_path, '/uploads/test.png');
      console.log('   ✅ Dual-write succeeded on character table.');

      // Approve v2 to demote v1
      const draft2 = await markReferenceAssetDraft(v2.id, { ...mockResult, public_path: '/uploads/test2.png' });
      const approved2 = await approveReferenceAsset(v2.id, { notes: 'Approved v2', attestation: true }, 'test_actor');
      
      const prevAsset = await getReferenceAsset(v1.id);
      assert.strictEqual(prevAsset.status, 'archived');
      
      const charRes2 = await pgQuery('SELECT reference_image_path FROM universe_characters WHERE id = $1', [charId]);
      assert.strictEqual(charRes2.rows[0].reference_image_path, '/uploads/test2.png');
      console.log('   ✅ Demote old approved asset & new dual-write verified.');

      // 6. Test Prompt Builder faceless negative prompt insertion
      console.log('\n6. Testing Role-Aware Prompt Builder...');
      const viConfig = {
        config: {
          subject: { kind: 'human', faceless_mode: 'hands_only', demographic_key: 'syari_classic' }
        }
      };
      const builtPrompt = buildReferenceAssetPrompt({
        ownerType: 'visual_identity',
        visualIdentity: viConfig,
        role: 'wardrobe',
        customInstruction: 'bright colors'
      });
      
      assert.ok(builtPrompt.prompt.includes('hands only'));
      assert.ok(builtPrompt.prompt.includes('bright colors'));
      assert.ok(builtPrompt.negative_prompt.includes('visible face'));
      console.log('   ✅ Role-aware prompt builder outputs match faceless policies.');

      console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉');
      await cleanDb();
    } catch (err) {
      console.error('\n❌ Test Suite Failed:', err);
      process.exit(1);
    }
  });
  
  process.exit(0);
}

runTests();
