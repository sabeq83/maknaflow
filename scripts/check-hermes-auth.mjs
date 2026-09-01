import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';

console.log('🩺 === MAKNA FLOW: HERMES AUTH & ENDPOINTS HEALTH CHECK (DEV) === 🧪');

const checkScript = `import urllib.request, json, os, plistlib, hashlib, sys

plist_path = os.path.expanduser("~/Library/LaunchAgents/ai.hermes.gateway.plist")
with open(plist_path, "rb") as f:
    pl = plistlib.load(f)
token = pl.get("EnvironmentVariables", {}).get("MAKNA_OPERATOR_API_TOKEN", "")

headers = {"Authorization": f"Bearer {token}"}

results = {}

# 1. whoami
try:
    whoami_req = urllib.request.Request("http://127.0.0.1:5020/api/operator/v2/whoami", headers=headers)
    with urllib.request.urlopen(whoami_req) as resp:
        results["whoami"] = {"status": resp.status, "body": json.loads(resp.read().decode())}
except Exception as e:
    results["whoami"] = {"error": str(e)}

# 2. catalog
try:
    cat_req = urllib.request.Request("http://127.0.0.1:5020/api/operator/v2/content-catalog?brand=dapurbotani&product=Rolled%20Oat&preset=dapurbotani_kampanye_produk_4_klip", headers=headers)
    with urllib.request.urlopen(cat_req) as resp:
        results["catalog"] = {"status": resp.status, "body": json.loads(resp.read().decode())}
except Exception as e:
    results["catalog"] = {"error": str(e)}

# 3. old smoke status
try:
    status_req = urllib.request.Request("http://127.0.0.1:5020/api/operator/v2/content-runs/car_005499dc50b8474b", headers=headers)
    with urllib.request.urlopen(status_req) as resp:
        results["old_smoke_status"] = {"status": resp.status, "body": json.loads(resp.read().decode())}
except Exception as e:
    results["old_smoke_status"] = {"error": str(e)}

# 4. new smoke status (car_4dd16822ab764f41)
try:
    status_req2 = urllib.request.Request("http://127.0.0.1:5020/api/operator/v2/content-runs/car_4dd16822ab764f41", headers=headers)
    with urllib.request.urlopen(status_req2) as resp:
        results["new_smoke_status"] = {"status": resp.status, "body": json.loads(resp.read().decode())}
except Exception as e:
    results["new_smoke_status"] = {"error": str(e)}

print(json.dumps(results))
`;

const checkRes = execSync('ssh masbenu@100.95.245.55 "python3 -"', { input: checkScript, encoding: 'utf8' }).trim();
const data = JSON.parse(checkRes);

console.log('\n--- HEALTH CHECK RESULTS ---');
console.log('1. whoami:');
console.log(`   - HTTP Status: ${data.whoami?.status || 'FAIL'}`);
console.log(`   - Operator: ${JSON.stringify(data.whoami?.body?.operator || data.whoami?.error)}`);

console.log('\n2. content-catalog:');
console.log(`   - HTTP Status: ${data.catalog?.status || 'FAIL'}`);
console.log(`   - Brands: ${(data.catalog?.body?.brands || []).map(b => b.name).join(', ')}`);
console.log(`   - Products: ${(data.catalog?.body?.products || []).map(p => p.name).join(', ')}`);
console.log(`   - Presets: ${(data.catalog?.body?.presets || []).map(p => p.key).join(', ')}`);

console.log('\n3. old smoke status (car_005499dc50b8474b):');
console.log(`   - HTTP Status: ${data.old_smoke_status?.status || 'FAIL'}`);
console.log(`   - Status: ${data.old_smoke_status?.body?.status}`);
console.log(`   - Stage: ${data.old_smoke_status?.body?.stage}`);
console.log(`   - Items: ${JSON.stringify(data.old_smoke_status?.body?.items)}`);

console.log('\n4. new smoke status (car_4dd16822ab764f41):');
console.log(`   - HTTP Status: ${data.new_smoke_status?.status || 'FAIL'}`);
console.log(`   - Status: ${data.new_smoke_status?.body?.status}`);
console.log(`   - Stage: ${data.new_smoke_status?.body?.stage}`);
console.log(`   - Items: ${JSON.stringify(data.new_smoke_status?.body?.items)}`);
console.log(`   - Action: ${data.new_smoke_status?.body?.action_required}`);
console.log(`   - URL: ${data.new_smoke_status?.body?.review_url}`);
console.log(`   - Mode: ${data.new_smoke_status?.body?.publishing_mode}`);

assert.equal(data.whoami?.status, 200, 'whoami must return HTTP 200');
assert.equal(data.catalog?.status, 200, 'content-catalog must return HTTP 200');
assert.equal(data.old_smoke_status?.status, 200, 'old smoke status must return HTTP 200');
assert.equal(data.new_smoke_status?.status, 200, 'new smoke status must return HTTP 200');
assert.equal(data.new_smoke_status?.body?.status, 'awaiting_manual_review');
assert.equal(data.new_smoke_status?.body?.items?.total, 6);
assert.equal(data.new_smoke_status?.body?.items?.ready, 6);
assert.equal(data.new_smoke_status?.body?.items?.failed, 0);

console.log('\n✅ ALL HERMES AUTH & SMOKE ENDPOINTS ARE VERIFIED HEALTHY (HTTP 200)!');
