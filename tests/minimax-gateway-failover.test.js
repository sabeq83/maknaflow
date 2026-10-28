import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { generateMinimaxVO, MINIMAX_GATEWAY_POOL } from '../lib/minimax-tts.js';
import { setSetting } from '../lib/db.js';

test('MINIMAX_GATEWAY_POOL has official global endpoints with primary api.minimax.io', () => {
  assert.ok(Array.isArray(MINIMAX_GATEWAY_POOL), 'MINIMAX_GATEWAY_POOL must be an array');
  assert.ok(MINIMAX_GATEWAY_POOL.length >= 3, 'Must have at least 3 fallback gateways');
  assert.equal(MINIMAX_GATEWAY_POOL[0], 'https://api.minimax.io/v1/t2a_v2', 'Primary gateway must be api.minimax.io');
  assert.ok(MINIMAX_GATEWAY_POOL.includes('https://api.minimaxi.chat/v1/t2a_v2'), 'Should include api.minimaxi.chat');
  assert.ok(MINIMAX_GATEWAY_POOL.includes('https://api-uw.minimax.io/v1/t2a_v2'), 'Should include api-uw.minimax.io fallback');
});

test('generateMinimaxVO automatically fails over to second gateway when first gateway returns 503', async (t) => {
  // Set dummy API key in settings
  setSetting('minimax_api_key', 'TEST_DUMMY_MINIMAX_KEY_FOR_TESTS');

  let server1Calls = 0;
  let server2Calls = 0;

  // Server 1 simulates 503 Service Temporarily Unavailable
  const server1 = http.createServer((req, res) => {
    server1Calls++;
    res.writeHead(503, { 'Content-Type': 'text/html' });
    res.end('<html><head><title>503 Service Temporarily Unavailable</title></head><body>nginx</body></html>');
  });

  // Server 2 simulates healthy response
  const server2 = http.createServer((req, res) => {
    server2Calls++;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      base_resp: { status_code: 0, status_msg: 'success' },
      data: { audio: '4d414b4e41464c4f57' } // Hex string for 'MAKNAFLOW'
    }));
  });

  await new Promise(resolve => server1.listen(0, '127.0.0.1', resolve));
  await new Promise(resolve => server2.listen(0, '127.0.0.1', resolve));

  const port1 = server1.address().port;
  const port2 = server2.address().port;

  const url1 = `http://127.0.0.1:${port1}/v1/t2a_v2`;
  const url2 = `http://127.0.0.1:${port2}/v1/t2a_v2`;

  const tempOutputFile = path.join(os.tmpdir(), `test_failover_${Date.now()}.mp3`);

  t.after(() => {
    server1.close();
    server2.close();
    if (fs.existsSync(tempOutputFile)) {
      fs.unlinkSync(tempOutputFile);
    }
  });

  // Execute TTS with custom gateway pool
  const result = await generateMinimaxVO('Halo selamat pagi', 'Wise_Old_Man', tempOutputFile, {
    gatewayPool: [url1, url2]
  });

  assert.equal(server1Calls, 1, 'Server 1 should have been called once and failed with 503');
  assert.equal(server2Calls, 1, 'Server 2 should have been called once and succeeded');
  assert.equal(result, tempOutputFile, 'Should return output path string');
  assert.ok(fs.existsSync(tempOutputFile), 'Generated audio file must exist');

  const content = fs.readFileSync(tempOutputFile, 'utf-8');
  assert.equal(content, 'MAKNAFLOW', 'Content should match hex decoded buffer');
});

test('generateMinimaxVO throws meaningful error when all gateways return 503', async (t) => {
  setSetting('minimax_api_key', 'TEST_DUMMY_MINIMAX_KEY_FOR_TESTS');

  const server = http.createServer((req, res) => {
    res.writeHead(503, { 'Content-Type': 'text/html' });
    res.end('<html><head><title>503 Service Unavailable</title></head></html>');
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const badUrl = `http://127.0.0.1:${port}/v1/t2a_v2`;

  const tempOutputFile = path.join(os.tmpdir(), `test_all_fail_${Date.now()}.mp3`);

  t.after(() => {
    server.close();
    if (fs.existsSync(tempOutputFile)) {
      fs.unlinkSync(tempOutputFile);
    }
  });

  await assert.rejects(
    async () => {
      await generateMinimaxVO('Test error', 'Wise_Old_Man', tempOutputFile, {
        gatewayPool: [badUrl]
      });
    },
    /MiniMax API HTTP error! status: 503/,
    'Should throw error indicating HTTP 503'
  );
});
