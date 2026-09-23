import assert from 'assert';
import { resolveWebhookEndpoint } from '../lib/webhook-client.js';

console.log('--- Testing Webhook Endpoint Resolver ---');

// Test 1: Fallback to Global Settings when no override provided
const ep1 = resolveWebhookEndpoint(null);
assert.ok(ep1.baseUrl.startsWith('http://'), 'Base URL must start with http://');
assert.ok(!ep1.baseUrl.includes('undefined') && !ep1.baseUrl.includes('null'), 'Base URL must not have undefined/null');
assert.ok(!isNaN(parseInt(ep1.port, 10)), 'Port must be a valid integer');
console.log('✅ Test 1 Passed: Default endpoint resolved:', ep1.baseUrl);

// Test 2: Invalid port string ('admin') in brand override must be ignored and fallback to numeric port
const ep2 = resolveWebhookEndpoint({
  webhook_host: '',
  webhook_port: 'admin',
  webhook_api_key: 'password123'
});
assert.ok(!ep2.baseUrl.includes('admin'), 'Base URL must not contain non-numeric string admin');
assert.equal(ep2.port, ep1.port, 'Port must fallback to global port');
console.log('✅ Test 2 Passed: Non-numeric port "admin" safely ignored ->', ep2.baseUrl);

// Test 3: Brand override with empty host must fallback completely to Global Settings
const ep3 = resolveWebhookEndpoint({
  webhook_host: '   ',
  webhook_port: '9999',
  webhook_api_key: 'some_key'
});
assert.equal(ep3.host, ep1.host, 'Host must fallback to global host when override host is empty');
assert.equal(ep3.port, ep1.port, 'Port must fallback to global port when override host is empty');
console.log('✅ Test 3 Passed: Empty override host fallback ->', ep3.baseUrl);

// Test 4: Host with http:// prefix and trailing slashes must be cleanly sanitized
const ep4 = resolveWebhookEndpoint({
  webhook_host: 'http://100.117.59.92:8765/',
  webhook_port: '8765'
});
assert.equal(ep4.host, '100.117.59.92', 'Host should strip protocol and trailing slash');
assert.equal(ep4.baseUrl, 'http://100.117.59.92:8765', 'Base URL must be valid format');
console.log('✅ Test 4 Passed: Sanitized host prefix & slash ->', ep4.baseUrl);

// Test 5: Valid custom override must be respected
const ep5 = resolveWebhookEndpoint({
  webhook_host: '100.117.59.92',
  webhook_port: '9000',
  webhook_api_key: 'custom_secret'
});
assert.equal(ep5.host, '100.117.59.92');
assert.equal(ep5.port, '9000');
assert.equal(ep5.apiKey, 'custom_secret');
assert.equal(ep5.baseUrl, 'http://100.117.59.92:9000');
console.log('✅ Test 5 Passed: Valid custom override respected ->', ep5.baseUrl);

console.log('🎉 ALL 5 Webhook Endpoint Resolver Tests Passed!');
process.exit(0);
