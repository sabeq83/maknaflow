import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';
import pg from 'pg';

console.log('🔐 === MAKNA FLOW: HERMES TOKEN ATOMIC ROTATION (DEV) === 🧪');

const pgHost = process.env.PGHOST || '100.78.186.123';
const pgPort = Number(process.env.PGPORT || 5432);
const pgUser = process.env.PGUSER || 'makna_user';
const pgPassword = process.env.PGPASSWORD || 'maknagridpass';
const pgDatabase = process.env.PGDATABASE || 'maknaflow_db';
const pgSchema = process.env.PG_SEARCH_PATH || 'dev';

const pool = new pg.Pool({
  host: pgHost,
  port: pgPort,
  user: pgUser,
  password: pgPassword,
  database: pgDatabase,
  options: `-c search_path=${pgSchema}`,
  max: 3,
  connectionTimeoutMillis: 15000
});

async function rotateToken() {
  const credentialId = 'opcred_hermes_dev';
  const tenantId = 'default_tenant';
  const credentialName = 'Hermes Mac Mini Dev';
  const scopes = 'automation:read,automation:write';

  // 1. Generate new cryptographically secure raw token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  console.log(`\n1. Registering persistent credential "${credentialId}" in Dev schema (scopes: ${scopes})...`);
  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO operator_credentials (id, tenant_id, name, token_hash, scopes, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE
      SET token_hash = EXCLUDED.token_hash,
          scopes = EXCLUDED.scopes,
          status = 'active',
          updated_at = CURRENT_TIMESTAMP
    `, [credentialId, tenantId, credentialName, tokenHash, scopes]);

    console.log('✓ Credential registered successfully in Dev database.');
  } finally {
    client.release();
    await pool.end();
  }

  // 2. Safely update MAKNA_OPERATOR_API_TOKEN in LaunchAgent plist on Mac Mini via SSH stdin
  console.log('\n2. Updating Hermes LaunchAgent plist on Mac Mini via secure atomic write...');
  const remotePythonScript = `import plistlib, os, sys, json

token = sys.stdin.read().strip()
plist_path = os.path.expanduser("~/Library/LaunchAgents/ai.hermes.gateway.plist")
with open(plist_path, "rb") as f:
    pl = plistlib.load(f)

if "EnvironmentVariables" not in pl:
    pl["EnvironmentVariables"] = {}

pl["EnvironmentVariables"]["MAKNA_OPERATOR_API_TOKEN"] = token
pl["EnvironmentVariables"]["MAKNA_OPERATOR_BASE_URL"] = "http://127.0.0.1:5020"

# Atomic write
temp_path = plist_path + ".tmp"
with open(temp_path, "wb") as f:
    plistlib.dump(pl, f)
os.replace(temp_path, plist_path)
print("PLIST_UPDATED")
`;

  const updateRes = execSync('ssh masbenu@100.95.245.55 "python3 -"', {
    input: remotePythonScript.replace('sys.stdin.read().strip()', JSON.stringify(rawToken)),
    encoding: 'utf8'
  }).trim();
  assert.equal(updateRes, 'PLIST_UPDATED');
  console.log('✓ LaunchAgent plist updated atomically.');

  // 3. Reload LaunchAgent
  console.log('\n3. Reloading Hermes LaunchAgent on Mac Mini...');
  const reloadCmd = 'ssh masbenu@100.95.245.55 "launchctl kickstart -k gui/\\$(id -u)/ai.hermes.gateway 2>/dev/null || (launchctl unload ~/Library/LaunchAgents/ai.hermes.gateway.plist && launchctl load ~/Library/LaunchAgents/ai.hermes.gateway.plist)"';
  execSync(reloadCmd, { encoding: 'utf8' });
  console.log('✓ LaunchAgent reloaded.');

  // 4. Verify whoami, content-catalog, and health via Python script on Mac Mini
  console.log('\n4. Verifying Hermes authentication against MAKNA Dev (port 5020)...');
  const verifyScript = `import urllib.request, json, os, plistlib, hashlib

with open(os.path.expanduser("~/Library/LaunchAgents/ai.hermes.gateway.plist"), "rb") as f:
    pl = plistlib.load(f)
token = pl.get("EnvironmentVariables", {}).get("MAKNA_OPERATOR_API_TOKEN", "")
token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

headers = {"Authorization": f"Bearer {token}"}

# whoami
whoami_req = urllib.request.Request("http://127.0.0.1:5020/api/operator/v2/whoami", headers=headers)
with urllib.request.urlopen(whoami_req) as resp:
    whoami_code = resp.status
    whoami_body = json.loads(resp.read().decode())

# catalog
cat_req = urllib.request.Request("http://127.0.0.1:5020/api/operator/v2/content-catalog?brand=dapurbotani&product=Rolled%20Oat&preset=dapurbotani_kampanye_produk_4_klip", headers=headers)
with urllib.request.urlopen(cat_req) as resp:
    cat_code = resp.status
    cat_body = json.loads(resp.read().decode())

print(json.dumps({
    "whoami_status": whoami_code,
    "whoami_operator": whoami_body.get("operator", {}),
    "catalog_status": cat_code,
    "catalog_brand_count": len(cat_body.get("brands", [])),
    "catalog_product_count": len(cat_body.get("products", [])),
    "catalog_preset_count": len(cat_body.get("presets", []))
}))
`;

  const verifyRes = execSync('ssh masbenu@100.95.245.55 "python3 -"', { input: verifyScript, encoding: 'utf8' }).trim();
  const verifyData = JSON.parse(verifyRes);

  console.log('\n--- VERIFICATION RESULT ---');
  console.log(`- whoami HTTP status: ${verifyData.whoami_status}`);
  console.log(`- whoami Actor: ${verifyData.whoami_operator.id}`);
  console.log(`- whoami Tenant: ${verifyData.whoami_operator.tenant_id}`);
  console.log(`- whoami Scopes: ${JSON.stringify(verifyData.whoami_operator.scopes)}`);
  console.log(`- catalog HTTP status: ${verifyData.catalog_status}`);
  console.log(`- catalog brands found: ${verifyData.catalog_brand_count}`);
  console.log(`- catalog products found: ${verifyData.catalog_product_count}`);
  console.log(`- catalog presets found: ${verifyData.catalog_preset_count}`);

  assert.equal(verifyData.whoami_status, 200);
  assert.equal(verifyData.catalog_status, 200);
  assert.equal(verifyData.whoami_operator.tenant_id, tenantId);
  assert.deepEqual(verifyData.whoami_operator.scopes, ['automation:read', 'automation:write']);

  console.log('\n✅ HERMES OPERATOR TOKEN ROTATION COMPLETED SUCCESSFULLY!');
}

rotateToken().catch((err) => {
  console.error('\n❌ TOKEN ROTATION FAILED:', err.message);
  process.exit(1);
});
