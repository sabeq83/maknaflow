import assert from 'assert';
import { activeSessionsCache } from '../lib/auth.js';
import { tenantContext } from '../lib/tenant-context.js';
import { refreshManifestCache } from '../lib/universe-manifests.js';
import { GET } from '../app/api/v2/cartoon-universe/manifest/route.js';

console.log('🧪 RUNNING CARTOON MANIFEST AVAILABILITY TESTS\n');

const tenantId = 'tnt_sy-dodot_4ba27b';

// Ensure DB cache is fully populated in tenant context
await tenantContext.run(tenantId, async () => {
  await refreshManifestCache();
});

// Mock active session
activeSessionsCache['mock_test_token'] = {
  id: 1,
  username: 'testuser',
  role: 'admin',
  tenantId
};

const authHeader = 'Bearer mock_test_token';

// Mock request for Kio Wonders
const reqKio = {
  url: 'http://localhost/api/v2/cartoon-universe/manifest?profile=kio-wonders',
  headers: {
    get: (name) => (name.toLowerCase() === 'authorization' ? authHeader : null)
  }
};

const resKio = await GET(reqKio);
const dataKio = await resKio.json();

assert(dataKio.success, `Manifest response should succeed, but got: ${JSON.stringify(dataKio)}`);
assert(dataKio.manifest, 'Manifest object should exist');
assert(dataKio.manifest.characters.kio, 'Kio character should exist in manifest');
assert.strictEqual(dataKio.manifest.characters.kio.available, true, 'Kio character with remote reference URL should be available: true');
assert(dataKio.manifest.characters.bimo, 'BIMO character should exist in manifest');
assert.strictEqual(dataKio.manifest.characters.bimo.available, true, 'BIMO character with remote reference URL should be available: true');

console.log('✅ Kio Wonders characters (Kio & BIMO) correctly marked as available: true with remote URLs');

// Mock request for PawVille
const reqPaw = {
  url: 'http://localhost/api/v2/cartoon-universe/manifest?profile=pawville',
  headers: {
    get: (name) => (name.toLowerCase() === 'authorization' ? authHeader : null)
  }
};

const resPaw = await GET(reqPaw);
const dataPaw = await resPaw.json();
assert(dataPaw.success, `PawVille manifest response should succeed, but got: ${JSON.stringify(dataPaw)}`);
assert(dataPaw.manifest.characters.mochi, 'Mochi should exist in PawVille manifest');

console.log('✅ PawVille manifest successfully retrieved');
console.log('\n🎉 ALL CARTOON MANIFEST AVAILABILITY TESTS PASSED!');
process.exit(0);

