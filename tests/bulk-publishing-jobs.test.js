import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';

import {
  savePublishingAccount,
  createPublishingJobs,
  listPublishingJobs
} from '../lib/publishing-repository.js';
import { pgQuery } from '../lib/db-pg.js';

test('Bulk Publishing: Staggered Scheduling & Database Sync for 5 Items', async (t) => {
  const tenantId = `tnt_bulk_${Date.now()}`;
  const userId = 'usr_test_bulk_admin';

  // 1. Setup mock publishing accounts (TikTok & Instagram)
  const accTk = await savePublishingAccount({
    tenantId,
    platform: 'tiktok',
    provider: 'repliz',
    displayName: 'TikTok Kuliner ID',
    providerAccountId: 'rep_tk_01',
    status: 'active'
  });

  const accIg = await savePublishingAccount({
    tenantId,
    platform: 'instagram',
    provider: 'repliz',
    displayName: 'IG Kuliner ID',
    providerAccountId: 'rep_ig_01',
    status: 'active'
  });

  const accountIds = [accTk.id, accIg.id];

  // 2. Setup 5 mock content items in content_flow_items
  const contentIds = ['VD-TEST-B01', 'VD-TEST-B02', 'VD-TEST-B03', 'VD-TEST-B04', 'VD-TEST-B05'];

  for (let i = 0; i < contentIds.length; i++) {
    const cid = contentIds[i];
    await pgQuery(
      `INSERT INTO content_flow_items (
        id, video_id, hook, caption, url_asset, tenant_id, pipeline_status,
        tiktok_status, instagram_status, facebook_status, youtube_status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'Completed', 'Unposted', 'Unposted', 'Unposted', 'Unposted')
      ON CONFLICT DO NOTHING`,
      [`cf_${tenantId}_${i}`, cid, `Hook for ${cid}`, `Caption for ${cid}`, `https://storage.example.com/${cid}.mp4`, tenantId]
    );
  }

  // 3. Simulate Bulk Scheduling Strategy:
  // Target date: 13 Oktober 2026, 10:00 WIB (03:00:00 UTC) with 120-minute interval
  const baseTimeUtc = new Date('2026-10-13T03:00:00.000Z');
  const allCreatedJobs = [];

  for (let idx = 0; idx < contentIds.length; idx++) {
    const cid = contentIds[idx];
    const itemScheduledAt = new Date(baseTimeUtc.getTime() + idx * 120 * 60 * 1000).toISOString();

    const targets = accountIds.map(accId => ({
      accountId: accId,
      publishMode: 'live',
      mediaType: 'reels',
      caption: `Caption video ${cid} #fyp #kuliner`,
      mediaUrl: `https://storage.example.com/${cid}.mp4`,
      scheduledAt: itemScheduledAt,
      approvalStatus: 'pending_approval',
      isAiGenerated: true
    }));

    const created = await createPublishingJobs({
      tenantId,
      userId,
      contentId: cid,
      targets
    });

    allCreatedJobs.push(...created);

    // Auto-sync status ContentFlow ke 'Scheduled'
    const platforms = [...new Set(created.map(j => j.platform).filter(Boolean))];
    const platformColumnMap = {
      facebook: 'facebook_status',
      instagram: 'instagram_status',
      tiktok: 'tiktok_status',
      youtube: 'youtube_status'
    };
    for (const p of platforms) {
      const col = platformColumnMap[p];
      if (col) {
        await pgQuery(
          `UPDATE content_flow_items SET ${col} = 'Scheduled', updated_at = CURRENT_TIMESTAMP WHERE video_id = $1 AND tenant_id = $2`,
          [cid, tenantId]
        );
      }
    }
  }

  // Assertions: 5 items x 2 accounts = 10 jobs created
  assert.equal(allCreatedJobs.length, 10);

  // Verify timestamps are staggered at 2-hour intervals on 13 Oktober 2026
  const tkJobs = allCreatedJobs.filter(j => j.account_id === accTk.id);
  assert.equal(tkJobs.length, 5);
  assert.equal(tkJobs[0].scheduled_at.toISOString(), '2026-10-13T03:00:00.000Z');
  assert.equal(tkJobs[1].scheduled_at.toISOString(), '2026-10-13T05:00:00.000Z');
  assert.equal(tkJobs[2].scheduled_at.toISOString(), '2026-10-13T07:00:00.000Z');
  assert.equal(tkJobs[3].scheduled_at.toISOString(), '2026-10-13T09:00:00.000Z');
  assert.equal(tkJobs[4].scheduled_at.toISOString(), '2026-10-13T11:00:00.000Z');

  // Verify all items have status 'Scheduled' in content_flow_items
  for (const cid of contentIds) {
    const checkDb = await pgQuery(
      `SELECT tiktok_status, instagram_status FROM content_flow_items WHERE video_id = $1 AND tenant_id = $2`,
      [cid, tenantId]
    );
    assert.equal(checkDb.rowCount, 1);
    assert.equal(checkDb.rows[0].tiktok_status, 'Scheduled');
    assert.equal(checkDb.rows[0].instagram_status, 'Scheduled');
  }

  // 4. Verify listPublishingJobs returns the newly scheduled jobs for this tenant
  const fetchedJobs = await listPublishingJobs(tenantId, { limit: 50 });
  assert.equal(fetchedJobs.total, 10);
  assert.equal(fetchedJobs.items.length, 10);

  // 5. Cleanup test data
  await pgQuery(`DELETE FROM publishing_jobs WHERE tenant_id = $1`, [tenantId]);
  await pgQuery(`DELETE FROM publishing_accounts WHERE tenant_id = $1`, [tenantId]);
  await pgQuery(`DELETE FROM content_flow_items WHERE tenant_id = $1`, [tenantId]);
  
  process.exit(0);
});

