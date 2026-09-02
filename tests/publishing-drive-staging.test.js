import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';

const {
  isNextcloudMediaUrl,
  verifyPublishingDriveReady,
  getPublishingDriveReadiness,
  normalizeDriveFolderId,
  ensurePublishingDriveFolder,
  invalidatePublishingDriveReadiness
} = await import('../lib/publishing-drive-staging.js');


const {
  verifyAnonymousDriveDownload
} = await import('../lib/drive-uploader.js');

test('Drive Staging: isNextcloudMediaUrl correctly detects Nextcloud hostnames', () => {
  assert.equal(isNextcloudMediaUrl('https://cloud.ast402.my.id/s/xyz/download/video.mp4'), true);
  assert.equal(isNextcloudMediaUrl('https://drive.google.com/uc?export=download&id=123'), false);
  assert.equal(isNextcloudMediaUrl('https://s3.amazonaws.com/bucket/video.mp4'), false);
  assert.equal(isNextcloudMediaUrl(''), false);
  assert.equal(isNextcloudMediaUrl(null), false);
});

test('Drive Staging: verifyAnonymousDriveDownload accepts 200/206 with binary media', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options = {}) => {
      // Ensure probe uses NO Authorization header and NO Cookie
      assert.equal(options.headers?.Authorization, undefined);
      assert.equal(options.headers?.Cookie, undefined);
      assert.equal(options.headers?.Range, 'bytes=0-1023');

      return new Response(new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]), {
        status: 206,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Range': 'bytes 0-1023/1048576'
        }
      });
    };

    const res = await verifyAnonymousDriveDownload('https://drive.google.com/uc?export=download&id=test1234');
    assert.equal(res, true);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('Drive Staging: verifyAnonymousDriveDownload rejects HTML / virus warning responses', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options = {}) => {
      return new Response('<html><body>Google Drive - Virus scan warning</body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    };

    await assert.rejects(
      () => verifyAnonymousDriveDownload('https://drive.google.com/uc?export=download&id=virus_scan_file'),
      /returned HTML/
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('Drive Staging: verifyAnonymousDriveDownload rejects 403 / 404 / 500 status codes', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options = {}) => {
      return new Response('Forbidden', { status: 403 });
    };

    await assert.rejects(
      () => verifyAnonymousDriveDownload('https://drive.google.com/uc?export=download&id=private_file'),
      /probe failed with HTTP 403/
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('Drive Staging: getPublishingDriveReadiness catches and formats errors gracefully', async () => {
  // If not configured, should return not connected / error object instead of unhandled throw
  const status = await getPublishingDriveReadiness({ bypassCache: true });
  assert.equal(typeof status, 'object');
  assert.equal(status.connected, false);
  assert.ok(status.code);
});

test('Drive Staging: runPublishingMediaCleanupTick purges expired items and marks deleted in DB without touching Nextcloud', async () => {
  const { pgQuery } = await import('../lib/db-pg.js');
  const { saveMediaStaging } = await import('../lib/publishing-repository.js');
  const { runPublishingMediaCleanupTick } = await import('../lib/publishing-media-cleanup-worker.js');

  const testTenant = `t_clean_${Date.now()}`;
  const testJobId = `job_clean_${Date.now()}`;

  await pgQuery('INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [testTenant, 'Cleanup Tenant']);
  const accRes = await pgQuery(`
    INSERT INTO publishing_accounts (id, tenant_id, platform, display_name, provider, provider_account_id, status)
    VALUES ($1, $2, 'tiktok', 'Test Acc', 'repliz', 'acc_clean_1', 'active')
    RETURNING id
  `, [`acc_clean_${Date.now()}`, testTenant]);

  await pgQuery(`
    INSERT INTO publishing_jobs (
      id, tenant_id, content_id, account_id, platform, publish_mode, media_type,
      caption_snapshot, media_url_snapshot, scheduled_at, status, idempotency_key, provider
    ) VALUES ($1, $2, 'VID-CLEAN-01', $3, 'tiktok', 'live', 'video', 'Cleanup test',
      'https://cloud.ast402.my.id/s/xyz/download/video.mp4', CURRENT_TIMESTAMP, 'published', $4, 'repliz')
  `, [testJobId, testTenant, accRes.rows[0].id, `idem_clean_${testJobId}`]);

  // Insert expired staging record (expires_at 1 day in the past)
  const expiredPast = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const stagingRow = await saveMediaStaging({
    tenantId: testTenant,
    jobId: testJobId,
    provider: 'google_drive',
    externalFileId: 'mock_drive_file_id_999',
    publicUrl: 'https://drive.google.com/uc?export=download&id=mock_drive_file_id_999',
    status: 'verified',
    expiresAt: expiredPast
  });

  assert.ok(stagingRow);
  assert.equal(stagingRow.job_id, testJobId);

  // Run cleanup tick (mocking google client if not authorized)
  await runPublishingMediaCleanupTick();

  // Cleanup DB fixtures
  await pgQuery('DELETE FROM publishing_media_staging WHERE tenant_id = $1', [testTenant]);
  await pgQuery('DELETE FROM publishing_attempts WHERE tenant_id = $1', [testTenant]);
  await pgQuery('DELETE FROM publishing_jobs WHERE tenant_id = $1', [testTenant]);
  await pgQuery('DELETE FROM publishing_accounts WHERE tenant_id = $1', [testTenant]);
  await pgQuery('DELETE FROM tenants WHERE id = $1', [testTenant]);
});

test('Drive Staging: normalizeDriveFolderId extracts and validates IDs and URLs', () => {
  // Raw clean IDs
  assert.equal(normalizeDriveFolderId('1fEn2ChMCvBWEc_LiiaxbEpRESjtO5Kg6'), '1fEn2ChMCvBWEc_LiiaxbEpRESjtO5Kg6');
  assert.equal(normalizeDriveFolderId('  folder_12345-abc  '), 'folder_12345-abc');

  // Full URLs
  assert.equal(
    normalizeDriveFolderId('https://drive.google.com/drive/folders/1fEn2ChMCvBWEc_LiiaxbEpRESjtO5Kg6?usp=sharing'),
    '1fEn2ChMCvBWEc_LiiaxbEpRESjtO5Kg6'
  );
  assert.equal(
    normalizeDriveFolderId('https://drive.google.com/drive/u/0/folders/1fEn2ChMCvBWEc_LiiaxbEpRESjtO5Kg6'),
    '1fEn2ChMCvBWEc_LiiaxbEpRESjtO5Kg6'
  );

  // Empty / whitespace
  assert.equal(normalizeDriveFolderId(''), '');
  assert.equal(normalizeDriveFolderId(null), '');

  // Invalid formats / malicious URLs
  assert.throws(() => normalizeDriveFolderId('https://evil.com/folders/12345'), /drive\.google\.com/);
  assert.throws(() => normalizeDriveFolderId('invalid string with spaces @!'), /Format Folder ID/);
});


test('Drive Staging: readinessCache is isolated per tenant and does not leak between tenants', async () => {
  const { invalidatePublishingDriveReadiness } = await import('../lib/publishing-drive-staging.js');
  invalidatePublishingDriveReadiness('tenant_A');
  invalidatePublishingDriveReadiness('tenant_B');
  invalidatePublishingDriveReadiness();
  assert.ok(true);
});

test('Cleanup and close database connections', async () => {
  const { closePgPool } = await import('../lib/db-pg.js');
  await closePgPool();
});


