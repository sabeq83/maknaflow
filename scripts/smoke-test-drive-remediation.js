process.env.PG_SEARCH_PATH = process.env.PG_SEARCH_PATH || 'dev';

const { loadDbCaches } = await import('../lib/db.js');
const { ensurePublishingDriveFolder, verifyPublishingDriveReady, invalidatePublishingDriveReadiness } = await import('../lib/publishing-drive-staging.js');
const { verifyGoogleConnection } = await import('../lib/google-auth.js');
const { uploadUrlToPublicDrive, verifyAnonymousDriveDownload } = await import('../lib/drive-uploader.js');
const { closePgPool } = await import('../lib/db-pg.js');
const { google } = await import('googleapis');
const { getAuthorizedClient } = await import('../lib/google-auth.js');


async function main() {
  console.log('=== SMOKE TEST: GOOGLE DRIVE REMEDIATION ===');
  await loadDbCaches();
  
  // 1. Verify Google Connection

  console.log('1. Checking Google OAuth Connection...');
  const authStatus = await verifyGoogleConnection();
  console.log('OAuth Status:', {
    state: authStatus.state,
    connected: authStatus.connected,
    email: authStatus.email,
    driveFileScopeGranted: authStatus.driveFileScopeGranted,
    grantedScopes: authStatus.grantedScopes
  });

  if (!authStatus.connected) {
    console.error('FAIL: Google OAuth is not connected.');
    process.exit(1);
  }

  // 2. Run ensurePublishingDriveFolder
  console.log('\n2. Running ensurePublishingDriveFolder()...');
  const folder = await ensurePublishingDriveFolder();
  console.log('Provisioned Folder Result:', {
    id: folder.id,
    name: folder.name,
    created: folder.created,
    writable: folder.writable
  });

  // 3. Verify Active Readiness
  console.log('\n3. Verifying Active Drive Readiness...');
  invalidatePublishingDriveReadiness();
  const ready = await verifyPublishingDriveReady({ bypassCache: true });
  console.log('Readiness Result:', ready);

  // 4. Test Idempotency
  console.log('\n4. Testing Idempotent ensurePublishingDriveFolder()...');
  const folderSecondCall = await ensurePublishingDriveFolder();
  console.log('Second Call Result:', {
    id: folderSecondCall.id,
    name: folderSecondCall.name,
    created: folderSecondCall.created
  });
  if (folderSecondCall.id !== folder.id || folderSecondCall.created !== false) {
    console.warn('WARNING: Idempotency did not reuse the existing folder!');
  } else {
    console.log('SUCCESS: Idempotency verified, reused existing folder perfectly.');
  }

  // 5. Test Dummy Staging Upload & Anonymous Probe (without external posting)
  console.log('\n5. Testing Staging Upload and Anonymous Probe...');
  const auth = getAuthorizedClient();
  const drive = google.drive({ version: 'v3', auth });
  
  // Upload small test text file
  const testFileRes = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: `smoke_test_${Date.now()}.txt`,
      parents: [folder.id],
      appProperties: { maknaPurpose: 'smoke-test' }
    },
    media: {
      mimeType: 'text/plain',
      body: 'MAKNA Flow Google Drive Staging Remediation Smoke Test'
    },
    fields: 'id, webViewLink'
  });
  const fileId = testFileRes.data.id;
  console.log('Test file created in folder:', fileId);

  // Set public permission
  await drive.permissions.create({
    fileId,
    supportsAllDrives: true,
    requestBody: { role: 'reader', type: 'anyone' }
  });
  console.log('Public permission set.');

  const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  const probeOk = await verifyAnonymousDriveDownload(directUrl);
  console.log('Anonymous download probe result:', probeOk ? 'PASSED (HTTP 200/206)' : 'FAILED');

  // Clean up smoke test file
  await drive.files.delete({ fileId, supportsAllDrives: true });
  console.log('Test file cleaned up from Drive.');

  console.log('\n=== SMOKE TEST FINISHED SUCCESSFULLY ===');
  await closePgPool();
}

main().catch(async (err) => {
  console.error('Smoke test error:', err);
  await closePgPool().catch(() => {});
  process.exit(1);
});
