import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';

const {
  isGoogleInvalidGrant,
  classifyGoogleConnectionFailure,
  signOAuthState,
  verifyOAuthState,
  normalizeAllowedReturnPath
} = await import('../lib/google-auth.js');


test('Google Auth: isGoogleInvalidGrant correctly classifies invalid_grant errors', () => {
  assert.equal(isGoogleInvalidGrant(new Error('invalid_grant: Token has been expired or revoked')), true);
  assert.equal(isGoogleInvalidGrant(new Error('Token has been expired or revoked.')), true);
  assert.equal(isGoogleInvalidGrant({ response: { data: { error: 'invalid_grant' } } }), true);
  assert.equal(isGoogleInvalidGrant({ response: { data: { error_description: 'Token has been revoked.' } } }), true);
  assert.equal(isGoogleInvalidGrant({ code: 400, message: 'Bad Request - grant invalid' }), true);

  // Non-invalid-grant errors
  assert.equal(isGoogleInvalidGrant(new Error('ETIMEDOUT: Connection timed out')), false);
  assert.equal(isGoogleInvalidGrant(new Error('403 Forbidden: insufficientPermissions')), false);
  assert.equal(isGoogleInvalidGrant(null), false);
});

test('Google Auth: classifyGoogleConnectionFailure returns deterministic categories', () => {
  const reauth = classifyGoogleConnectionFailure(new Error('invalid_grant: Token revoked'));
  assert.equal(reauth.state, 'reauth_required');
  assert.equal(reauth.connected, false);
  assert.equal(reauth.code, 'GOOGLE_REAUTH_REQUIRED');

  const perm = classifyGoogleConnectionFailure({ status: 403, message: 'insufficientPermissions' });
  assert.equal(perm.state, 'permission_error');
  assert.equal(perm.connected, false);
  assert.equal(perm.code, 'GOOGLE_PERMISSION_ERROR');

  const timeout = classifyGoogleConnectionFailure({ code: 'ETIMEDOUT', message: 'Connection timed out' });
  assert.equal(timeout.state, 'temporarily_unavailable');
  assert.equal(timeout.connected, false);
  assert.equal(timeout.code, 'GOOGLE_TEMPORARILY_UNAVAILABLE');

  const rateLimit = classifyGoogleConnectionFailure({ status: 429, message: 'Too Many Requests' });
  assert.equal(rateLimit.state, 'temporarily_unavailable');
  assert.equal(rateLimit.connected, false);
  assert.equal(rateLimit.code, 'GOOGLE_TEMPORARILY_UNAVAILABLE');

  const unknown = classifyGoogleConnectionFailure(new Error('Something weird happened'));
  assert.equal(unknown.state, 'unknown_error');
  assert.equal(unknown.connected, false);
  assert.equal(unknown.code, 'GOOGLE_UNKNOWN_ERROR');
});

test('Google Auth: signOAuthState and verifyOAuthState handle HMAC signatures safely', () => {
  const payload = { returnTo: '/content-flow?view=publishing', exp: Date.now() + 60000 };
  const signed = signOAuthState(payload);

  assert.ok(typeof signed === 'string');
  assert.ok(signed.includes('.'));

  const verified = verifyOAuthState(signed);
  assert.ok(verified);
  assert.equal(verified.returnTo, '/content-flow?view=publishing');

  // Tampered payload
  const tampered = signed.replace(/^[a-zA-Z0-9_-]+/, 'eyJyZXR1cm5UbyI6Ii9oYWNrZWQifQ');
  assert.equal(verifyOAuthState(tampered), null);

  // Expired payload
  const expiredPayload = { returnTo: '/settings', exp: Date.now() - 1000 };
  const expiredSigned = signOAuthState(expiredPayload);
  assert.equal(verifyOAuthState(expiredSigned), null);

  // Invalid strings
  assert.equal(verifyOAuthState(''), null);
  assert.equal(verifyOAuthState('invalid-no-dot'), null);
  assert.equal(verifyOAuthState(null), null);
});

test('Google Auth: normalizeAllowedReturnPath prevents open redirect attacks', () => {
  assert.equal(normalizeAllowedReturnPath('/settings'), '/settings');
  assert.equal(normalizeAllowedReturnPath('/content-flow?view=publishing'), '/content-flow?view=publishing');
  assert.equal(normalizeAllowedReturnPath('/content-flow'), '/content-flow');

  // Open redirect attempts
  assert.equal(normalizeAllowedReturnPath('https://evil.com'), '/settings');
  assert.equal(normalizeAllowedReturnPath('http://evil.com/settings'), '/settings');
  assert.equal(normalizeAllowedReturnPath('//evil.com/settings'), '/settings');
  assert.equal(normalizeAllowedReturnPath('/admin/unauthorized'), '/settings');
  assert.equal(normalizeAllowedReturnPath(null), '/settings');
  assert.equal(normalizeAllowedReturnPath(undefined), '/settings');
});

test('Google Auth: normalizeGoogleScopes and hasCompatibleDriveScope validate drive scopes', async () => {
  const { normalizeGoogleScopes, hasCompatibleDriveScope } = await import('../lib/google-auth.js');
  
  const scopesList = normalizeGoogleScopes('https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email');
  assert.equal(scopesList.length, 2);
  assert.equal(hasCompatibleDriveScope(scopesList), true);

  const arrayScopes = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets'];
  assert.equal(hasCompatibleDriveScope(arrayScopes), true);

  const missingDrive = ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/spreadsheets'];
  assert.equal(hasCompatibleDriveScope(missingDrive), false);

  assert.equal(normalizeGoogleScopes('').length, 0);
  assert.equal(hasCompatibleDriveScope([]), false);
  assert.equal(hasCompatibleDriveScope(null), false);
});

test('Google Auth: verifyGoogleConnection does not expose sensitive tokens', async () => {
  const { verifyGoogleConnection } = await import('../lib/google-auth.js');
  const status = await verifyGoogleConnection();
  assert.equal(status.accessToken, undefined);
  assert.equal(status.refreshToken, undefined);
  assert.equal(status.clientSecret, undefined);
  assert.ok(Array.isArray(status.grantedScopes));
  assert.equal(typeof status.driveFileScopeGranted, 'boolean');
});

test('Cleanup and close database connections', async () => {
  const { cachesLoaded } = await import('../lib/db.js');
  await cachesLoaded;
  const { closePgPool } = await import('../lib/db-pg.js');
  await closePgPool();
});





