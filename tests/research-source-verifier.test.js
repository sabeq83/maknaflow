import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPrivateOrReservedIp,
  classifyDomainAuthority,
  verifyResearchSource
} from '../lib/research-source-verifier.js';

test('Research Source Verifier - SSRF IP blocker rejects private & metadata IPs', () => {
  // Private & Loopback IPv4
  assert.equal(isPrivateOrReservedIp('127.0.0.1'), true);
  assert.equal(isPrivateOrReservedIp('10.0.0.5'), true);
  assert.equal(isPrivateOrReservedIp('172.16.1.1'), true);
  assert.equal(isPrivateOrReservedIp('172.31.255.255'), true);
  assert.equal(isPrivateOrReservedIp('192.168.1.100'), true);
  assert.equal(isPrivateOrReservedIp('169.254.169.254'), true); // AWS/Cloud metadata
  assert.equal(isPrivateOrReservedIp('100.64.0.1'), true); // Carrier grade / Tailscale

  // Public IPv4
  assert.equal(isPrivateOrReservedIp('8.8.8.8'), false);
  assert.equal(isPrivateOrReservedIp('1.1.1.1'), false);
  assert.equal(isPrivateOrReservedIp('151.101.1.140'), false);

  // IPv6 Loopback & link-local
  assert.equal(isPrivateOrReservedIp('::1'), true);
  assert.equal(isPrivateOrReservedIp('fe80::1'), true);
});

test('Research Source Verifier - Classifies authority appropriately', () => {
  assert.equal(classifyDomainAuthority('who.int'), 'primary');
  assert.equal(classifyDomainAuthority('kemkes.go.id'), 'primary');
  assert.equal(classifyDomainAuthority('healthline.com'), 'reputable_secondary');
  assert.equal(classifyDomainAuthority('kompas.com'), 'reputable_secondary');
  assert.equal(classifyDomainAuthority('randomblog123.xyz'), 'unknown');
});

test('Research Source Verifier - Rejects non-HTTPS and localhost URLs', async () => {
  const httpRes = await verifyResearchSource('http://example.com/test');
  assert.equal(httpRes.verification_status, 'rejected');
  assert.match(httpRes.error, /non-HTTPS/);

  const localRes = await verifyResearchSource('https://localhost:3000/test');
  assert.equal(localRes.verification_status, 'rejected');

  const fileRes = await verifyResearchSource('file:///etc/passwd');
  assert.equal(fileRes.verification_status, 'rejected');
});
