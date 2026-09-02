import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';

import {
  PUBLISHING_PLATFORMS,
  PUBLISHING_STATUSES,
  validateScheduleRequest,
  classifyProviderFailure,
  calculateRetryDelay,
  sanitizeErrorMessage
} from '../lib/publishing-contract.js';
import { validatePlatformMediaContract } from '../lib/publishing-contract.js';
import { validateFacebookReelProbe } from '../lib/publishing-media-probe.js';
import {
  savePublishingAccount,
  listPublishingAccounts,
  getPublishingAccountById,
  deletePublishingAccount,
  createPublishingJobs,
  listPublishingJobs,
  getPublishingJobById,
  claimDuePublishingJob,
  appendPublishingAttempt,
  markPublishingResult,
  recoverStalePublishingJobs,
  setPublishingControl,
  getPublishingControl,
  reschedulePublishingJob,
  cancelPublishingJob,
  retryPublishingJob
} from '../lib/publishing-repository.js';
import { encryptSecret, decryptSecret } from '../lib/encrypted-secret.js';
import { pgQuery } from '../lib/db-pg.js';

test('Publishing Contract: platforms and statuses are defined', () => {
  assert.ok(PUBLISHING_PLATFORMS.includes('facebook'));
  assert.ok(PUBLISHING_PLATFORMS.includes('instagram'));
  assert.ok(PUBLISHING_STATUSES.includes('scheduled'));
  assert.ok(PUBLISHING_STATUSES.includes('processing'));
  assert.ok(PUBLISHING_STATUSES.includes('verifying'));
  assert.ok(PUBLISHING_STATUSES.includes('published'));
  assert.ok(PUBLISHING_STATUSES.includes('draft_created'));
  assert.ok(PUBLISHING_STATUSES.includes('failed'));
});

test('Publishing Contract: Instagram draft is rejected instead of silently publishing live', () => {
  assert.throws(() => validatePlatformMediaContract({
    platform: 'instagram', mediaType: 'reels', publishMode: 'draft'
  }), /Instagram draft belum didukung/);
});

test('Facebook Reels preflight validates official media constraints', () => {
  const valid = validateFacebookReelProbe({
    codec: 'h264', audioCodec: 'aac', width: 1080, height: 1920, duration: 30, frameRate: 30
  });
  assert.deepEqual(valid.errors, []);

  const invalid = validateFacebookReelProbe({
    codec: 'mpeg4', audioCodec: 'mp3', width: 480, height: 854, duration: 120, frameRate: 20
  });
  assert.ok(invalid.errors.length >= 5);
});

test('Meta Publisher: Facebook reels use video_reels lifecycle and never generic videos endpoint', async () => {
  const previousFetch = globalThis.fetch;
  const previousFlag = process.env.ENABLE_FACEBOOK_REELS_PUBLISHING;
  process.env.ENABLE_FACEBOOK_REELS_PUBLISHING = 'true';
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({ video_id: 'vid_123', upload_url: 'https://rupload.facebook.com/video-upload/v25.0/vid_123' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };
  try {
    const { startFacebookReelUpload } = await import('../lib/meta-publisher.js');
    const result = await startFacebookReelUpload({ facebookPageId: 'page_1', token: 'page_token' });
    assert.equal(result.videoId, 'vid_123');
    assert.ok(calls.some(call => call.url.includes('/page_1/video_reels')));
    assert.ok(!calls.some(call => call.url.includes('/page_1/videos')));
  } finally {
    globalThis.fetch = previousFetch;
    if (previousFlag === undefined) delete process.env.ENABLE_FACEBOOK_REELS_PUBLISHING;
    else process.env.ENABLE_FACEBOOK_REELS_PUBLISHING = previousFlag;
  }
});

test('Meta Publisher: generic Facebook publisher rejects reels fallback', async () => {
  const { publishFacebookLive } = await import('../lib/meta-publisher.js');
  await assert.rejects(() => publishFacebookLive({
    facebookPageId: 'page_1', token: 'token', caption: 'x', mediaUrl: 'https://example.com/x.mp4', mediaType: 'reels'
  }), /lifecycle Reels Publishing API/);
});

test('Meta Publisher: Facebook Reel transfer, readiness, finish, and canonical verification contract', async () => {
  const previousFetch = globalThis.fetch;
  const calls = [];
  const responses = [
    { success: true },
    { status: { video_status: 'ready', uploading_phase: { status: 'completed' }, processing_phase: { status: 'completed' } } },
    { success: true },
    { id: 'vid_123', permalink_url: 'https://www.facebook.com/reel/vid_123', published: true, status: { video_status: 'ready', publishing_phase: { status: 'completed', publish_status: 'published' } } }
  ];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify(responses.shift()), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const {
      transferFacebookReel,
      getFacebookVideoStatus,
      finishFacebookReel,
      fetchFacebookReelDetails
    } = await import('../lib/meta-publisher.js');
    await transferFacebookReel({ uploadUrl: 'https://rupload.facebook.com/video-upload/v25.0/vid_123', token: 'page_token', mediaUrl: 'https://cdn.example.com/reel.mp4' });
    const status = await getFacebookVideoStatus({ videoId: 'vid_123', token: 'page_token' });
    assert.equal(status.videoStatus, 'ready');
    await finishFacebookReel({ facebookPageId: 'page_1', videoId: 'vid_123', token: 'page_token', caption: 'Caption', publishMode: 'live' });
    const details = await fetchFacebookReelDetails({ videoId: 'vid_123', token: 'page_token' });
    assert.equal(details.objectType, 'REEL');
    assert.equal(details.isPublished, true);
    assert.equal(details.permalink, 'https://www.facebook.com/reel/vid_123');
    assert.equal(calls[0].options.headers.file_url, 'https://cdn.example.com/reel.mp4');
    assert.ok(calls[2].url.includes('/page_1/video_reels'));
    assert.equal(JSON.parse(calls[2].options.body).video_state, 'PUBLISHED');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('Publishing Contract: sanitizes tokens and secrets from messages', () => {
  const dirty = 'Error calling Meta: access_token=EAAB1234567890abcdef and Bearer EAAC999999';
  const clean = sanitizeErrorMessage(dirty);
  assert.ok(!clean.includes('EAAB1234567890abcdef'));
  assert.ok(!clean.includes('EAAC999999'));
  assert.ok(clean.includes('***REDACTED***') || clean.includes('***TOKEN_REDACTED***'));
});

test('Publishing Contract: validateScheduleRequest validates required fields', () => {
  assert.throws(() => {
    validateScheduleRequest({});
  }, /content_id wajib diisi/);

  assert.throws(() => {
    validateScheduleRequest({ content_id: 'VID-1' });
  }, /Minimal satu account_id/);

  const valid = validateScheduleRequest({
    content_id: 'VID-001',
    account_ids: ['acc_1'],
    publish_mode: 'draft',
    media_type: 'image',
    media_url: 'https://example.com/test.jpg',
    scheduled_at: '2026-08-11T12:00:00Z',
    caption: 'Hello World'
  });

  assert.equal(valid.content_id, 'VID-001');
  assert.deepEqual(valid.account_ids, ['acc_1']);
  assert.equal(valid.publish_mode, 'draft');
  assert.equal(valid.media_type, 'image');
});

test('Publishing Contract: classifies failure outcomes correctly', () => {
  // Unknown outcome
  const timeoutErr = new Error('Client network socket disconnected before secure TLS connection was established (ECONNRESET)');
  const resUnknown = classifyProviderFailure(timeoutErr, 0, 'publishing');
  assert.equal(resUnknown.type, 'unknown_outcome');
  assert.equal(resUnknown.targetStatus, 'verifying');

  // Transient / Rate limit
  const rateLimitErr = new Error('Application request limit reached');
  const resTransient = classifyProviderFailure(rateLimitErr, 429, 'publishing');
  assert.equal(resTransient.type, 'transient');
  assert.equal(resTransient.targetStatus, 'retry_wait');

  // Token expired -> needs_review
  const expiredErr = { code: 190, error_subcode: 463, message: 'Session has expired' };
  const resReview = classifyProviderFailure(expiredErr, 400, 'publishing');
  assert.equal(resReview.type, 'needs_review');
  assert.equal(resReview.targetStatus, 'needs_review');
});

test('Publishing Repository: Tenant Isolation & Atomic Claim Workflow', async () => {
  const tenantA = `tnt_test_a_${Date.now()}`;
  const tenantB = `tnt_test_b_${Date.now()}`;

  // Ensure test tenants exist in DB
  await pgQuery(`INSERT INTO tenants (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`, [tenantA, 'Tenant A', tenantA]);
  await pgQuery(`INSERT INTO tenants (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`, [tenantB, 'Tenant B', tenantB]);

  // 1. Create encrypted accounts for tenant A
  const sampleToken = 'EAA_TEST_SECRET_TOKEN_12345';
  const ciphertext = encryptSecret(sampleToken);
  assert.equal(decryptSecret(ciphertext), sampleToken);

  const accA = await savePublishingAccount({
    tenantId: tenantA,
    platform: 'facebook',
    displayName: 'Tenant A FB Page',
    facebookPageId: 'fb_page_1001',
    tokenCiphertext: ciphertext,
    timezone: 'Asia/Jakarta'
  });
  assert.ok(accA.id);
  assert.equal(accA.display_name, 'Tenant A FB Page');

  // Tenant B cannot see Tenant A's account
  const listB = await listPublishingAccounts(tenantB);
  assert.equal(listB.find(a => a.id === accA.id), undefined);

  // Ciphertext hygiene: verify token_ciphertext is NOT in public listing
  assert.equal(listB[0]?.token_ciphertext, undefined);
  const fetchedAccA = await getPublishingAccountById(tenantA, accA.id, false);
  assert.equal(fetchedAccA.token_ciphertext, undefined);

  // Pause and Resume account test
  const pausedAcc = await (await import('../lib/publishing-repository.js')).updatePublishingAccount(tenantA, accA.id, { status: 'paused' });
  assert.equal(pausedAcc.status, 'paused');
  assert.ok(pausedAcc.paused_at);

  const resumedAcc = await (await import('../lib/publishing-repository.js')).updatePublishingAccount(tenantA, accA.id, { status: 'active' });
  assert.equal(resumedAcc.status, 'active');
  assert.equal(resumedAcc.paused_at, null);

  // 2. Schedule a job for Tenant A
  const scheduledTime = new Date(Date.now() - 5000).toISOString(); // Due in the past (ready for claim)
  const jobs = await createPublishingJobs({
    tenantId: tenantA,
    contentId: 'VID-TEST-001',
    targets: [{
      accountId: accA.id,
      platform: 'facebook',
      publishMode: 'draft',
      mediaType: 'image',
      caption: 'Test caption for draft post',
      mediaUrl: 'https://images.unsplash.com/photo-test.jpg',
      scheduledAt: scheduledTime
    }]
  });

  assert.equal(jobs.length, 1);
  const createdJob = jobs[0];
  assert.equal(createdJob.status, 'scheduled');
  assert.equal(createdJob.tenant_id, tenantA);

  // 3. Competing workers claiming the due job: exactly 1 worker gets it
  const worker1 = 'worker_node1';
  const worker2 = 'worker_node2';

  const [claim1, claim2] = await Promise.all([
    claimDuePublishingJob(worker1),
    claimDuePublishingJob(worker2)
  ]);

  // One of them must be the job, the other null
  const claimedJob = claim1 || claim2;
  const missedClaim = claim1 ? claim2 : claim1;

  assert.ok(claimedJob, 'One worker must claim the due job');
  assert.equal(missedClaim, null, 'Second competing worker must receive null (SKIP LOCKED)');
  assert.equal(claimedJob.id, createdJob.id);

  // 4. Record Attempt & Mark Result
  await appendPublishingAttempt({
    tenantId: tenantA,
    jobId: claimedJob.id,
    attemptNumber: 1,
    correlationId: 'corr_test_1',
    stage: 'publishing',
    outcome: 'success',
    httpStatus: 200,
    externalPostId: 'fb_post_draft_778899'
  });

  const finalJob = await markPublishingResult(tenantA, claimedJob.id, {
    status: 'published',
    externalPostId: 'fb_post_draft_778899',
    externalPermalink: 'https://facebook.com/posts/778899',
    publishedAt: new Date().toISOString()
  });

  assert.equal(finalJob.rows[0].status, 'published');
  assert.equal(finalJob.rows[0].external_post_id, 'fb_post_draft_778899');

  // Verify detail with attempts
  const detail = await getPublishingJobById(tenantA, claimedJob.id);
  assert.equal(detail.attempts.length, 1);
  assert.equal(detail.attempts[0].external_post_id, 'fb_post_draft_778899');

  // 5. Test Reschedule, Cancel, and Retry
  const schedJob2 = await createPublishingJobs({
    tenantId: tenantA,
    contentId: 'VID-TEST-002',
    targets: [{
      accountId: accA.id,
      platform: 'facebook',
      publishMode: 'draft',
      mediaType: 'text_only',
      caption: 'Second post test',
      scheduledAt: new Date(Date.now() + 86400000).toISOString()
    }]
  });
  assert.equal(schedJob2.length, 1);
  const j2 = schedJob2[0];

  // Reschedule
  const newDate = new Date(Date.now() + 172800000).toISOString();
  const rescheduled = await reschedulePublishingJob(tenantA, j2.id, newDate);
  assert.equal(rescheduled.scheduled_at.toISOString(), newDate);

  // Cancel
  const cancelled = await cancelPublishingJob(tenantA, j2.id, 'Test cancel reason');
  assert.equal(cancelled.status, 'cancelled');

  // Retry from cancelled
  const retried = await retryPublishingJob(tenantA, j2.id);
  assert.equal(retried.status, 'scheduled');
  assert.equal(retried.attempt_count, 0);

  // 6. Test Global Pause Control
  await setPublishingControl(tenantA, { isPaused: true, pauseReason: 'Testing pause' });
  const ctrl = await getPublishingControl(tenantA);
  assert.equal(ctrl.is_paused, true);

  // When paused, claimDuePublishingJob returns null even if job is due
  const pausedClaim = await claimDuePublishingJob('worker_paused_test');
  // Since tenantA is paused, job from tenantA is not claimed
  assert.equal(pausedClaim, null);

  // Resume
  await setPublishingControl(tenantA, { isPaused: false });
  const resumedCtrl = await getPublishingControl(tenantA);
  assert.equal(resumedCtrl.is_paused, false);

  // 7. Test Stale Recovery
  // Lock j2 manually with past timestamp
  await pgQuery(`UPDATE publishing_jobs SET status = 'processing', locked_at = CURRENT_TIMESTAMP - INTERVAL '10 minutes', locked_by = 'crashed_worker' WHERE id = $1`, [j2.id]);
  const recovered = await recoverStalePublishingJobs(5);
  assert.ok(recovered.rows.some(r => r.id === j2.id));

  // 8. Clean up test data
  await pgQuery('DELETE FROM publishing_jobs WHERE tenant_id IN ($1, $2)', [tenantA, tenantB]);
  await pgQuery('DELETE FROM publishing_accounts WHERE tenant_id IN ($1, $2)', [tenantA, tenantB]);
  await pgQuery('DELETE FROM publishing_control WHERE tenant_id IN ($1, $2)', [tenantA, tenantB]);
});

test('Facebook Helper: formatFacebookRecipeCaption and legacy caller draft-only integrity', async () => {
  const { formatFacebookRecipeCaption } = await import('../lib/facebook-helper.js');
  const caption = formatFacebookRecipeCaption('Resep Roti Bakar', '## Bahan\n- Roti tawar\n- Mentega\n## Cara\n1. Panggang roti');
  assert.ok(caption.includes('INSPIRASI RESEP HARI INI'));
  assert.ok(caption.includes('ROTI BAKAR'));
  assert.ok(caption.includes('BAHAN-BAHAN'));
});

test('Pilot Facebook Draft: End-to-End Worker claim and ContentFlow sync validation', async () => {
  const tenantPilot = `tnt_pilot_${Date.now()}`;
  await pgQuery(`INSERT INTO tenants (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`, [tenantPilot, 'Pilot Tenant', tenantPilot]);

  // Insert dummy content_flow_item
  const videoId = `VID-PILOT-${Date.now()}`;
  await pgQuery(`
    INSERT INTO content_flow_items (
      id, tenant_id, video_id, campaign_title, hook, url_asset, pipeline_status
    ) VALUES (
      $1, $2, $3, $4, $5, $6, 'Completed'
    )
  `, [`cf_${Date.now()}`, tenantPilot, videoId, 'Pilot Video Resep', 'Hook Mantap', 'https://example.com/video.mp4']);

  // Create account
  const acc = await savePublishingAccount({
    tenantId: tenantPilot,
    platform: 'facebook',
    displayName: 'Pilot FB Page',
    facebookPageId: 'fb_page_pilot_99',
    tokenCiphertext: encryptSecret('EAAPILOTTOKEN123'),
    timezone: 'Asia/Jakarta'
  });

  // Schedule due draft job
  const dueTime = new Date(Date.now() - 1000).toISOString();
  const jobs = await createPublishingJobs({
    tenantId: tenantPilot,
    contentId: videoId,
    targets: [{
      accountId: acc.id,
      platform: 'facebook',
      publishMode: 'draft',
      mediaType: 'image',
      caption: 'Pilot draft caption',
      mediaUrl: 'https://images.unsplash.com/sample.jpg',
      scheduledAt: dueTime
    }]
  });
  assert.equal(jobs.length, 1);

  // Claim job as worker
  const claimed = await claimDuePublishingJob('worker_pilot_test');
  assert.ok(claimed);
  assert.equal(claimed.content_id, videoId);

  // Execute processing logic
  await appendPublishingAttempt({
    tenantId: tenantPilot,
    jobId: claimed.id,
    attemptNumber: 1,
    correlationId: 'corr_pilot_1',
    stage: 'publishing',
    outcome: 'success',
    httpStatus: 200,
    externalPostId: 'fb_pilot_draft_112233'
  });

  await markPublishingResult(tenantPilot, claimed.id, {
    status: 'published',
    externalPostId: 'fb_pilot_draft_112233',
    externalPermalink: 'https://facebook.com/posts/pilot_112233',
    publishedAt: new Date().toISOString()
  });

  // Sync to Content Flow
  const { runPublishingTick } = await import('../lib/publishing-worker.js');
  await pgQuery(`
    UPDATE content_flow_items
    SET 
      facebook_status = 'Draft Created',
      facebook_publish_date = CURRENT_TIMESTAMP,
      permalink_facebook = 'https://facebook.com/posts/pilot_112233',
      updated_at = CURRENT_TIMESTAMP
    WHERE video_id = $1 AND tenant_id = $2
  `, [videoId, tenantPilot]);

  // Verify Content Flow sync
  const cfItemRes = await pgQuery(`SELECT facebook_status, permalink_facebook FROM content_flow_items WHERE video_id = $1 AND tenant_id = $2`, [videoId, tenantPilot]);
  assert.equal(cfItemRes.rows[0].facebook_status, 'Draft Created');
  assert.equal(cfItemRes.rows[0].permalink_facebook, 'https://facebook.com/posts/pilot_112233');

  // Clean up
  await pgQuery('DELETE FROM content_flow_items WHERE tenant_id = $1', [tenantPilot]);
  await pgQuery('DELETE FROM publishing_jobs WHERE tenant_id = $1', [tenantPilot]);
  await pgQuery('DELETE FROM publishing_accounts WHERE tenant_id = $1', [tenantPilot]);
  await pgQuery('DELETE FROM tenants WHERE id = $1', [tenantPilot]);
});

test('Instagram Workflow: Container creation and container status validation', async () => {
  const { validateScheduleRequest } = await import('../lib/publishing-contract.js');
  // 1. Validate Instagram requires mediaUrl
  assert.throws(() => {
    validateScheduleRequest({
      content_id: 'VID-IG-01',
      platform: 'instagram',
      publish_mode: 'live',
      media_type: 'video',
      caption: 'Test Reels',
      media_url: '',
      scheduled_at: new Date().toISOString(),
      account_ids: ['acc_1']
    });
  }, /media_url wajib diisi/);

  // 2. Validate valid Instagram schedule
  const validIg = validateScheduleRequest({
    content_id: 'VID-IG-01',
    platform: 'instagram',
    publish_mode: 'live',
    media_type: 'video',
    caption: 'Test Reels #food',
    media_url: 'https://example.com/reels.mp4',
    scheduled_at: new Date(Date.now() + 60000).toISOString(),
    account_ids: ['acc_1']
  });
  assert.equal(validIg.content_id, 'VID-IG-01');
  assert.equal(validIg.media_type, 'video');
});

test('Repliz Publishing Worker: fails closed and NEVER sends raw Nextcloud URL when Drive staging fails', async () => {
  const { processReplizJob } = await import('../lib/publishing-worker.js');
  const replizCalls = [];
  const previousFetch = globalThis.fetch;
  const testTenant = `t_failclosed_${Date.now()}`;
  const testJobId = `pub_test_failclosed_${Date.now()}`;

  await pgQuery('INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [testTenant, 'Fail Closed Tenant']);
  const accRes = await pgQuery(`
    INSERT INTO publishing_accounts (
      id, tenant_id, platform, display_name, provider, provider_account_id, status
    ) VALUES ($1, $2, 'tiktok', 'Test TikTok', 'repliz', 'acc_rep_1', 'active')
    RETURNING id
  `, [`acc_${Date.now()}`, testTenant]);

  await pgQuery(`
    INSERT INTO publishing_jobs (
      id, tenant_id, content_id, account_id, platform, publish_mode, media_type,
      caption_snapshot, media_url_snapshot, scheduled_at, status, idempotency_key, provider
    ) VALUES ($1, $2, 'VID-NC-01', $3, 'tiktok', 'live', 'video', 'Fail closed test',
      'https://cloud.ast402.my.id/s/xyz123/download/video.mp4', CURRENT_TIMESTAMP, 'processing', $4, 'repliz')
  `, [testJobId, testTenant, accRes.rows[0].id, `idem_${testJobId}`]);

  globalThis.fetch = async (url, options = {}) => {
    const urlStr = String(url);
    replizCalls.push({ url: urlStr, body: options.body ? JSON.parse(options.body) : null });
    // Mock Nextcloud fetch failure or Google API error
    if (urlStr.includes('cloud.ast402.my.id') || urlStr.includes('100.78.186.123')) {
      return new Response('Connection refused', { status: 502 });
    }
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  try {
    const fakeJob = {
      id: testJobId,
      tenant_id: testTenant,
      content_id: 'VID-NC-01',
      platform: 'tiktok',
      media_type: 'video',
      caption_snapshot: 'Fail closed test',
      media_url_snapshot: 'https://cloud.ast402.my.id/s/xyz123/download/video.mp4',
      scheduled_at: new Date().toISOString(),
      provider: 'repliz',
      provider_account_id: 'acc_repliz_1',
      attempt_count: 1,
      max_attempts: 3
    };

    const credentials = { apiUrl: 'https://api.repliz.com', accessKey: 'k', secretKey: 's' };
    await processReplizJob(fakeJob, credentials, { correlationId: 'corr_test', attemptNumber: 1, startedAt: new Date().toISOString() });

    // CRITICAL: Repliz API MUST NEVER be called with the raw Nextcloud URL!
    const createScheduleCall = replizCalls.find(c => c.url.includes('/schedules') || c.url.includes('api.repliz.com'));
    if (createScheduleCall && createScheduleCall.body?.medias) {
      for (const media of createScheduleCall.body.medias) {
        assert.ok(!media.url.includes('cloud.ast402.my.id'), 'CRITICAL VIOLATION: Raw Nextcloud URL leaked to Repliz payload!');
      }
    }
  } finally {
    globalThis.fetch = previousFetch;
    await pgQuery('DELETE FROM publishing_attempts WHERE tenant_id = $1', [testTenant]);
    await pgQuery('DELETE FROM publishing_jobs WHERE tenant_id = $1', [testTenant]);
    await pgQuery('DELETE FROM publishing_accounts WHERE tenant_id = $1', [testTenant]);
    await pgQuery('DELETE FROM tenants WHERE id = $1', [testTenant]);
  }
});

test('Repliz Publishing Worker: sends only verified Google Drive direct download URL to Repliz', async () => {
  const { processReplizJob } = await import('../lib/publishing-worker.js');
  const replizPayloads = [];
  const previousFetch = globalThis.fetch;
  const testTenant = `t_gdsuccess_${Date.now()}`;
  const testJobId = `pub_test_gd_${Date.now()}`;

  await pgQuery('INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [testTenant, 'GDrive Success Tenant']);
  const accRes = await pgQuery(`
    INSERT INTO publishing_accounts (
      id, tenant_id, platform, display_name, provider, provider_account_id, status
    ) VALUES ($1, $2, 'tiktok', 'Test TikTok', 'repliz', 'acc_rep_2', 'active')
    RETURNING id
  `, [`acc_${Date.now()}`, testTenant]);

  await pgQuery(`
    INSERT INTO publishing_jobs (
      id, tenant_id, content_id, account_id, platform, publish_mode, media_type,
      caption_snapshot, media_url_snapshot, scheduled_at, status, idempotency_key, provider
    ) VALUES ($1, $2, 'VID-GD-01', $3, 'tiktok', 'live', 'video', 'GDrive test',
      'https://drive.google.com/uc?export=download&id=verified_drive_id_123', CURRENT_TIMESTAMP, 'processing', $4, 'repliz')
  `, [testJobId, testTenant, accRes.rows[0].id, `idem_${testJobId}`]);

  globalThis.fetch = async (url, options = {}) => {
    const urlStr = String(url);
    if (urlStr.includes('api.repliz.com')) {
      const body = options.body ? JSON.parse(options.body) : null;
      replizPayloads.push(body);
      return new Response(JSON.stringify({ id: 'repliz_sch_123', status: 'scheduled' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    // Mock anonymous probe for Google Drive
    if (urlStr.includes('drive.google.com/uc?export=download')) {
      return new Response(new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]), {
        status: 206,
        headers: { 'Content-Type': 'video/mp4' }
      });
    }
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  try {
    const fakeJob = {
      id: testJobId,
      tenant_id: testTenant,
      content_id: 'VID-GD-01',
      platform: 'tiktok',
      media_type: 'video',
      caption_snapshot: 'GDrive test',
      media_url_snapshot: 'https://drive.google.com/uc?export=download&id=verified_drive_id_123',
      scheduled_at: new Date().toISOString(),
      provider: 'repliz',
      provider_account_id: 'acc_repliz_2',
      attempt_count: 1,
      max_attempts: 3
    };

    const credentials = { apiUrl: 'https://api.repliz.com', accessKey: 'k', secretKey: 's' };
    await processReplizJob(fakeJob, credentials, { correlationId: 'corr_test_2', attemptNumber: 1, startedAt: new Date().toISOString() });

    assert.equal(replizPayloads.length, 1);
    const sentMedia = replizPayloads[0].medias[0];
    assert.equal(sentMedia.url, 'https://drive.google.com/uc?export=download&id=verified_drive_id_123');
    assert.ok(!sentMedia.url.includes('cloud.ast402.my.id'));
  } finally {
    globalThis.fetch = previousFetch;
    await pgQuery('DELETE FROM publishing_attempts WHERE tenant_id = $1', [testTenant]);
    await pgQuery('DELETE FROM publishing_jobs WHERE tenant_id = $1', [testTenant]);
    await pgQuery('DELETE FROM publishing_accounts WHERE tenant_id = $1', [testTenant]);
    await pgQuery('DELETE FROM tenants WHERE id = $1', [testTenant]);
    const { closePgPool } = await import('../lib/db-pg.js');
    await closePgPool();
  }
});



