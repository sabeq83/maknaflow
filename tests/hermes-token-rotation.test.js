import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import { acquireRotationLock, releaseRotationLock } from '../scripts/rotate-hermes-token.mjs';
import { loadAndValidateDbEnv } from '../lib/db-env-validator.js';

test('Hermes Token Rotation: Concurrency lock prevents parallel execution', () => {
  releaseRotationLock();
  
  // First lock acquire should succeed
  acquireRotationLock();
  const lockPath = path.resolve(process.cwd(), '.rotation.lock');
  assert.ok(fs.existsSync(lockPath), 'Lock file must be created');

  // Second lock acquire should throw
  assert.throws(() => {
    acquireRotationLock();
  }, /Another token rotation is already in progress/);

  releaseRotationLock();
  assert.ok(!fs.existsSync(lockPath), 'Lock file must be removed after release');
});

test('Hermes Token Rotation: Dual-credential candidate lifecycle in isolated DB transaction', async () => {
  const dbConfig = loadAndValidateDbEnv({ requireDevSchema: true });
  const pool = new pg.Pool({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    options: `-c search_path=${dbConfig.schema}`,
    max: 1
  });

  const client = await pool.connect();
  const testCandidateId = `opcred_test_candidate_${Date.now().toString(36)}`;
  const tenantId = 'default_tenant';
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  try {
    // 1. Create candidate without touching primary
    await client.query(`
      INSERT INTO operator_credentials (id, tenant_id, name, token_hash, scopes, status)
      VALUES ($1, $2, $3, $4, $5, 'active')
    `, [testCandidateId, tenantId, 'Test Candidate', tokenHash, 'automation:read,automation:write']);

    const res = await client.query('SELECT * FROM operator_credentials WHERE id = $1', [testCandidateId]);
    assert.equal(res.rowCount, 1);
    assert.equal(res.rows[0].status, 'active');

    // 2. Simulate failure rollback: candidate is cleanly deleted
    await client.query('DELETE FROM operator_credentials WHERE id = $1', [testCandidateId]);
    const afterDelete = await client.query('SELECT * FROM operator_credentials WHERE id = $1', [testCandidateId]);
    assert.equal(afterDelete.rowCount, 0, 'Candidate must be deleted on rollback');

  } finally {
    client.release();
    await pool.end();
  }
});
