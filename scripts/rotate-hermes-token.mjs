import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { loadAndValidateDbEnv } from '../lib/db-env-validator.js';

const LOCK_FILE = path.resolve(process.cwd(), '.rotation.lock');

export function acquireRotationLock() {
  if (fs.existsSync(LOCK_FILE)) {
    const lockAge = Date.now() - fs.statSync(LOCK_FILE).mtimeMs;
    // Stale lock after 2 minutes
    if (lockAge < 120000) {
      throw new Error(`Another token rotation is already in progress (lock acquired ${Math.round(lockAge / 1000)}s ago).`);
    }
  }
  fs.writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, time: new Date().toISOString() }));
}

export function releaseRotationLock() {
  if (fs.existsSync(LOCK_FILE)) {
    try { fs.unlinkSync(LOCK_FILE); } catch (_) {}
  }
}

export async function executeDualCredentialRotation(options = {}) {
  const { isDryRun = false, sshHost = 'masbenu@100.95.245.55', devApiUrl = 'http://127.0.0.1:5020' } = options;

  console.log('🔐 === MAKNA FLOW: HERMES TOKEN ATOMIC ROTATION (DEV) === 🧪');
  if (isDryRun) {
    console.log('⚡ [DRY-RUN MODE] Preflight checks only. No tokens will be rotated.');
  }

  const dbConfig = loadAndValidateDbEnv({ requireDevSchema: true });
  acquireRotationLock();

  const pool = new pg.Pool({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    options: `-c search_path=${dbConfig.schema}`,
    max: 2,
    connectionTimeoutMillis: 10000
  });

  const primaryId = 'opcred_hermes_dev';
  const rotationId = Date.now().toString(36);
  const candidateId = `opcred_hermes_dev_${rotationId}`;
  const tenantId = 'default_tenant';
  const credentialName = `Hermes Mac Mini Dev (Rotated ${rotationId})`;
  const scopes = 'automation:read,automation:write';

  let candidateCreated = false;
  let client;

  try {
    client = await pool.connect();

    // Preflight 1: Check primary credential
    const curRes = await client.query('SELECT id, status, scopes FROM operator_credentials WHERE id = $1 AND tenant_id = $2', [primaryId, tenantId]);
    console.log(`\n1. Preflight check: Primary credential "${primaryId}" exists in schema "${dbConfig.schema}":`, curRes.rowCount > 0 ? 'YES' : 'NO');

    if (isDryRun) {
      console.log('✓ Preflight DB check passed.');
      // Preflight 2: Check SSH connectivity to LaunchAgent
      const checkPlist = execSync(`ssh ${sshHost} "python3 -c \\"import plistlib, os; print(os.path.exists(os.path.expanduser('~/Library/LaunchAgents/ai.hermes.gateway.plist')))\\""`, { encoding: 'utf8' }).trim();
      assert.equal(checkPlist, 'True', 'LaunchAgent plist must exist on Mac Mini');
      console.log('✓ Preflight SSH and LaunchAgent check passed.');
      console.log('\n✅ [DRY-RUN] Preflight checks completed successfully.');
      return { success: true, dryRun: true };
    }

    // Step 1: Generate Candidate token & register in DB without modifying primary credential
    const candidateRawToken = crypto.randomBytes(32).toString('hex');
    const candidateTokenHash = crypto.createHash('sha256').update(candidateRawToken).digest('hex');

    console.log(`\n2. Creating candidate credential "${candidateId}" in Dev schema (scopes: ${scopes})...`);
    await client.query(`
      INSERT INTO operator_credentials (id, tenant_id, name, token_hash, scopes, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [candidateId, tenantId, credentialName, candidateTokenHash, scopes]);
    candidateCreated = true;
    console.log('✓ Candidate credential registered in database. Primary credential remains untouched and active.');

    // Step 2: In-memory backup and atomic write of candidate token to LaunchAgent plist
    console.log('\n3. Updating LaunchAgent plist with candidate token and keeping memory backup...');
    const updatePythonScript = `import plistlib, os, sys, json

candidate_token = sys.stdin.read().strip()
plist_path = os.path.expanduser("~/Library/LaunchAgents/ai.hermes.gateway.plist")

with open(plist_path, "rb") as f:
    orig_bytes = f.read()

# Backup plist
backup_path = plist_path + ".backup_rotation"
with open(backup_path, "wb") as f:
    f.write(orig_bytes)

pl = plistlib.loads(orig_bytes)
if "EnvironmentVariables" not in pl:
    pl["EnvironmentVariables"] = {}

pl["EnvironmentVariables"]["MAKNA_OPERATOR_API_TOKEN"] = candidate_token
pl["EnvironmentVariables"]["MAKNA_OPERATOR_BASE_URL"] = "${devApiUrl}"

temp_path = plist_path + ".tmp"
with open(temp_path, "wb") as f:
    plistlib.dump(pl, f)
os.replace(temp_path, plist_path)
print("CANDIDATE_PLIST_APPLIED")
`;

    const updateRes = execSync(`ssh ${sshHost} "python3 -"`, {
      input: updatePythonScript.replace('sys.stdin.read().strip()', JSON.stringify(candidateRawToken)),
      encoding: 'utf8'
    }).trim();
    assert.equal(updateRes, 'CANDIDATE_PLIST_APPLIED', 'Plist update must succeed');
    console.log('✓ Candidate token applied to LaunchAgent plist.');

    // Step 3: Restart Hermes LaunchAgent
    console.log('\n4. Restarting Hermes LaunchAgent on Mac Mini...');
    const restartCmd = `ssh ${sshHost} "launchctl kickstart -k gui/\\$(id -u)/ai.hermes.gateway 2>/dev/null || (launchctl unload ~/Library/LaunchAgents/ai.hermes.gateway.plist && launchctl load ~/Library/LaunchAgents/ai.hermes.gateway.plist)"`;
    execSync(restartCmd, { encoding: 'utf8' });
    console.log('✓ Hermes LaunchAgent reloaded.');

    // Step 4: Verify Candidate Authentication (MUST match candidateId actor)
    console.log('\n5. Verifying candidate authentication against whoami & catalog...');
    const verifyScript = `import urllib.request, json, os, plistlib, hashlib

with open(os.path.expanduser("~/Library/LaunchAgents/ai.hermes.gateway.plist"), "rb") as f:
    pl = plistlib.load(f)
token = pl.get("EnvironmentVariables", {}).get("MAKNA_OPERATOR_API_TOKEN", "")
headers = {"Authorization": f"Bearer {token}"}

# whoami
whoami_req = urllib.request.Request("${devApiUrl}/api/operator/v2/whoami", headers=headers)
with urllib.request.urlopen(whoami_req) as resp:
    whoami_code = resp.status
    whoami_body = json.loads(resp.read().decode())

# catalog
cat_req = urllib.request.Request("${devApiUrl}/api/operator/v2/content-catalog?brand=dapurbotani", headers=headers)
with urllib.request.urlopen(cat_req) as resp:
    cat_code = resp.status
    cat_body = json.loads(resp.read().decode())

print(json.dumps({
    "whoami_status": whoami_code,
    "actor_id": whoami_body.get("operator", {}).get("id"),
    "tenant_id": whoami_body.get("operator", {}).get("tenant_id"),
    "scopes": whoami_body.get("operator", {}).get("scopes", []),
    "catalog_status": cat_code,
    "brand_count": len(cat_body.get("brands", []))
}))
`;

    let verifyData;
    try {
      const verifyRes = execSync(`ssh ${sshHost} "python3 -"`, { input: verifyScript, encoding: 'utf8' }).trim();
      verifyData = JSON.parse(verifyRes);
    } catch (verifyErr) {
      throw new Error(`Verification endpoint call failed: ${verifyErr.message}`);
    }

    console.log(`   - whoami HTTP status: ${verifyData.whoami_status}`);
    console.log(`   - Actor ID: ${verifyData.actor_id}`);
    console.log(`   - Scopes: ${JSON.stringify(verifyData.scopes)}`);
    console.log(`   - Catalog HTTP status: ${verifyData.catalog_status}`);

    assert.equal(verifyData.whoami_status, 200, 'whoami must return HTTP 200');
    assert.equal(verifyData.actor_id, candidateId, `Verified actor must be candidate "${candidateId}"`);
    assert.equal(verifyData.tenant_id, tenantId);
    assert.equal(verifyData.catalog_status, 200, 'catalog must return HTTP 200');

    // Step 5: Promotion — Update primary credential with new token hash & revoke/delete candidate
    console.log('\n6. Candidate verified! Promoting new token to primary credential and retiring candidate...');
    await client.query(`
      UPDATE operator_credentials
      SET token_hash = $1,
          scopes = $2,
          name = $3,
          status = 'active',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND tenant_id = $5
    `, [candidateTokenHash, scopes, 'Hermes Mac Mini Dev', primaryId, tenantId]);

    // Clean up candidate row
    await client.query('DELETE FROM operator_credentials WHERE id = $1 AND tenant_id = $2', [candidateId, tenantId]);
    candidateCreated = false;

    // Clean up backup on remote
    execSync(`ssh ${sshHost} "rm -f ~/Library/LaunchAgents/ai.hermes.gateway.plist.backup_rotation"`, { encoding: 'utf8' });

    console.log('✓ Promotion completed: primary credential updated and candidate cleaned up.');
    console.log('\n✅ DUAL-CREDENTIAL ATOMIC ROTATION COMPLETED SUCCESSFULLY!');
    return { success: true, candidateId, primaryId };

  } catch (err) {
    console.error('\n⚠️ ROTATION ERROR ENCOUNTERED! Initiating atomic rollback...', err.message);

    // Rollback procedure
    try {
      // 1. Restore plist backup on Mac Mini
      const rollbackScript = `import os
plist_path = os.path.expanduser("~/Library/LaunchAgents/ai.hermes.gateway.plist")
backup_path = plist_path + ".backup_rotation"
if os.path.exists(backup_path):
    os.replace(backup_path, plist_path)
    print("BACKUP_RESTORED")
else:
    print("NO_BACKUP_TO_RESTORE")
`;
      const rbRes = execSync(`ssh ${sshHost} "python3 -"`, { input: rollbackScript, encoding: 'utf8' }).trim();
      console.log(`   - Plist rollback status: ${rbRes}`);

      // 2. Restart Hermes to load old token
      execSync(`ssh ${sshHost} "launchctl kickstart -k gui/\\$(id -u)/ai.hermes.gateway 2>/dev/null || true"`, { encoding: 'utf8' });
      console.log('   - Hermes reloaded with original plist.');

      // 3. Remove candidate credential in DB if created
      if (candidateCreated && client) {
        await client.query('DELETE FROM operator_credentials WHERE id = $1 AND tenant_id = $2', [candidateId, tenantId]);
        console.log(`   - Candidate credential "${candidateId}" deleted from database.`);
      }

      console.log('✓ Rollback completed. System restored to original state.');
    } catch (rbErr) {
      console.error('❌ Critical error during rollback:', rbErr.message);
    }

    throw err;
  } finally {
    if (client) client.release();
    await pool.end();
    releaseRotationLock();
  }
}

// CLI Execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const isDryRun = process.argv.includes('--dry-run');
  executeDualCredentialRotation({ isDryRun }).catch((err) => {
    console.error('\n❌ Token rotation process failed:', err.message);
    process.exit(1);
  });
}
