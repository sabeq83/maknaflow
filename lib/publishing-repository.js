/**
 * Publishing Scheduler Repository Module
 * Provides tenant-aware PostgreSQL data access for publishing jobs, accounts, attempts, and control plane.
 */

import { getPgPool, pgQuery } from './db-pg.js';
import { sanitizeErrorMessage, validatePlatformMediaContract, validateProviderMediaContract } from './publishing-contract.js';
import crypto from 'crypto';

/**
 * Buat jobs penjadwalan publikasi per platform/target account.
 */
export async function createPublishingJobs({
  tenantId = 'default_tenant',
  userId = null,
  contentId,
  targets = [], // Array of { accountId, platform, scheduledAt, caption, mediaUrl, mediaType, publishMode }
}) {
  if (!contentId) throw new Error('contentId wajib disediakan.');
  if (!Array.isArray(targets) || targets.length === 0) throw new Error('Minimal satu target penjadwalan wajib dipilih.');

  const pool = getPgPool();
  const client = await pool.connect();
  const createdJobs = [];

  try {
    await client.query('BEGIN');

    for (const target of targets) {
      const {
        accountId,
        platform,
        publishMode = 'draft',
        mediaType = 'text_only',
        caption = '',
        mediaUrl = '',
        scheduledAt,
        approvalStatus = (publishMode === 'live' ? 'pending_approval' : 'not_required')
      } = target;

      // Verifikasi account ownership & status
      const accRes = await client.query(`
        SELECT id, platform, status, timezone, provider, provider_account_id FROM publishing_accounts
        WHERE id = $1 AND tenant_id = $2
      `, [accountId, tenantId]);

      if (accRes.rowCount === 0) {
        throw new Error(`Akun publishing '${accountId}' tidak ditemukan untuk tenant ini.`);
      }

      const acc = accRes.rows[0];
      if (acc.status === 'paused') {
        throw new Error(`Akun '${accountId}' sedang dijeda (paused).`);
      }

      if (platform && platform !== acc.platform) {
        throw new Error(`Platform target '${platform}' tidak cocok dengan akun '${accountId}' (${acc.platform}).`);
      }
      const targetPlatform = acc.platform;
      const targetProvider = acc.provider || 'meta';

      validateProviderMediaContract({
        provider: targetProvider,
        platform: targetPlatform,
        mediaType,
        publishMode
      });
      const scheduledIso = new Date(scheduledAt).toISOString();
      const jobId = `pub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const idempotencyKey = `pub_${tenantId}_${contentId}_${accountId}_${new Date(scheduledAt).getTime()}_${publishMode}`;

      // Insert job with idempotency conflict handling
      const insertRes = await client.query(`
        INSERT INTO publishing_jobs (
          id, tenant_id, content_id, account_id, platform,
          publish_mode, media_type, caption_snapshot, media_url_snapshot,
          scheduled_at, status, approval_status, idempotency_key, created_by, provider
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13, $14, $15
        )
        ON CONFLICT (tenant_id, idempotency_key) DO UPDATE
          SET updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        jobId,
        tenantId,
        contentId,
        accountId,
        targetPlatform,
        publishMode,
        mediaType,
        caption,
        mediaUrl,
        scheduledIso,
        approvalStatus === 'pending_approval' ? 'scheduled' : 'scheduled',
        approvalStatus,
        idempotencyKey,
        userId,
        targetProvider
      ]);

      createdJobs.push(insertRes.rows[0]);
    }

    await client.query('COMMIT');
    return createdJobs;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * List publishing jobs dengan pagination dan multi-filter.
 */
export async function listPublishingJobs(tenantId = 'default_tenant', filters = {}) {
  const {
    view = 'all', // 'queue', 'calendar', 'history', 'all'
    status,
    platform,
    accountId,
    contentId,
    startDate,
    endDate,
    search,
    limit = 50,
    offset = 0
  } = filters;

  const conditions = ['j.tenant_id = $1'];
  const params = [tenantId];
  let paramIdx = 2;

  if (status && status !== 'all') {
    conditions.push(`j.status = $${paramIdx++}`);
    params.push(status);
  }

  if (platform && platform !== 'all') {
    conditions.push(`j.platform = $${paramIdx++}`);
    params.push(platform);
  }

  if (accountId && accountId !== 'all') {
    conditions.push(`j.account_id = $${paramIdx++}`);
    params.push(accountId);
  }

  if (contentId) {
    conditions.push(`j.content_id = $${paramIdx++}`);
    params.push(contentId);
  }

  if (startDate) {
    conditions.push(`j.scheduled_at >= $${paramIdx++}`);
    params.push(new Date(startDate).toISOString());
  }

  if (endDate) {
    conditions.push(`j.scheduled_at <= $${paramIdx++}`);
    params.push(new Date(endDate).toISOString());
  }

  if (search && search.trim()) {
    conditions.push(`(j.caption_snapshot ILIKE $${paramIdx} OR j.content_id ILIKE $${paramIdx} OR a.display_name ILIKE $${paramIdx})`);
    params.push(`%${search.trim()}%`);
    paramIdx++;
  }

  if (view === 'queue') {
    conditions.push(`j.status IN ('scheduled', 'processing', 'creating_container', 'uploading_media', 'waiting_media', 'publishing', 'verifying', 'retry_wait')`);
  } else if (view === 'history') {
    conditions.push(`j.status IN ('draft_created', 'published', 'failed', 'cancelled')`);
  }

  const whereClause = conditions.join(' AND ');

  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM publishing_jobs j
    LEFT JOIN publishing_accounts a ON j.account_id = a.id
    WHERE ${whereClause}
  `;
  const countRes = await pgQuery(countQuery, params);
  const total = countRes.rows[0]?.total || 0;

  const dataQuery = `
    SELECT 
      j.*,
      a.display_name AS account_name,
      a.timezone AS account_timezone,
      COALESCE(c.campaign_title, c.hook, j.content_id) AS content_title,
      c.url_asset AS content_media_url
    FROM publishing_jobs j
    LEFT JOIN publishing_accounts a ON j.account_id = a.id
    LEFT JOIN content_flow_items c ON (c.video_id = j.content_id AND c.tenant_id = j.tenant_id)
    WHERE ${whereClause}
    ORDER BY 
      CASE WHEN j.status IN ('scheduled', 'processing', 'creating_container', 'uploading_media', 'waiting_media', 'publishing', 'verifying', 'retry_wait') THEN j.scheduled_at END ASC,
      j.created_at DESC
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `;

  const rowsRes = await pgQuery(dataQuery, [...params, limit, offset]);

  // Metrics summary
  const metricsQuery = `
    SELECT
      COUNT(*) FILTER (WHERE status = 'scheduled' AND scheduled_at >= NOW()) AS scheduled_count,
      COUNT(*) FILTER (WHERE status = 'published' AND published_at >= CURRENT_DATE) AS published_today_count,
      COUNT(*) FILTER (WHERE status = 'retry_wait') AS retry_wait_count,
      COUNT(*) FILTER (WHERE status IN ('failed', 'needs_review')) AS needs_action_count
    FROM publishing_jobs
    WHERE tenant_id = $1
  `;
  const metricsRes = await pgQuery(metricsQuery, [tenantId]);
  const metrics = metricsRes.rows[0] || {
    scheduled_count: 0,
    published_today_count: 0,
    retry_wait_count: 0,
    needs_action_count: 0
  };

  return {
    total,
    limit,
    offset,
    items: rowsRes.rows,
    metrics: {
      scheduled: parseInt(metrics.scheduled_count || 0, 10),
      publishedToday: parseInt(metrics.published_today_count || 0, 10),
      retryWait: parseInt(metrics.retry_wait_count || 0, 10),
      needsAction: parseInt(metrics.needs_action_count || 0, 10)
    }
  };
}

/**
 * Detail satu publishing job beserta log attempts.
 */
export async function getPublishingJobById(tenantId = 'default_tenant', jobId) {
  const jobRes = await pgQuery(`
    SELECT 
      j.*,
      a.display_name AS account_name,
      a.facebook_page_id,
      a.instagram_user_id,
      a.timezone AS account_timezone,
      a.status AS account_status,
      COALESCE(c.campaign_title, c.hook, j.content_id) AS content_title,
      c.url_asset AS content_media_url
    FROM publishing_jobs j
    LEFT JOIN publishing_accounts a ON j.account_id = a.id
    LEFT JOIN content_flow_items c ON (c.video_id = j.content_id AND c.tenant_id = j.tenant_id)
    WHERE j.id = $1 AND j.tenant_id = $2
  `, [jobId, tenantId]);

  if (jobRes.rowCount === 0) return null;

  const attemptsRes = await pgQuery(`
    SELECT * FROM publishing_attempts
    WHERE job_id = $1 AND tenant_id = $2
    ORDER BY attempt_number ASC, started_at ASC
  `, [jobId, tenantId]);

  return {
    ...jobRes.rows[0],
    attempts: attemptsRes.rows
  };
}

/**
 * Klaim atomik job yang sudah jatuh tempo dengan `FOR UPDATE SKIP LOCKED`.
 * Transaksi langsung dicommit agar koneksi database tidak tertahan selama network request eksternal.
 */
export async function claimDuePublishingJob(workerId) {
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Cek apakah ada job yang siap diproses dan akunnya tidak dijeda
    const selectSql = `
      SELECT 
        j.id, j.tenant_id, j.content_id, j.account_id, j.platform,
        j.publish_mode, j.media_type, j.caption_snapshot, j.media_url_snapshot,
        j.scheduled_at, j.status, j.approval_status, j.attempt_count, j.max_attempts,
        j.external_container_id, j.external_post_id, j.external_media_status,
        j.external_object_type, j.provider_stage, j.provider_state_json, j.verified_at,
        j.provider, j.external_schedule_id,
        a.token_ciphertext, a.facebook_page_id, a.instagram_user_id,
        a.timezone AS account_timezone, a.provider_account_id
      FROM publishing_jobs j
      JOIN publishing_accounts a ON j.account_id = a.id
      LEFT JOIN publishing_control ctrl ON ctrl.tenant_id = j.tenant_id
      WHERE 
        (ctrl.is_paused IS NOT TRUE)
        AND a.status = 'active'
        AND j.approval_status != 'pending_approval'
        AND j.approval_status != 'rejected'
        AND (
          (j.status = 'scheduled' AND j.scheduled_at <= CURRENT_TIMESTAMP)
          OR (j.status = 'retry_wait' AND j.next_attempt_at <= CURRENT_TIMESTAMP)
          OR (j.status IN ('creating_container', 'uploading_media', 'waiting_media', 'publishing', 'verifying') AND j.next_attempt_at <= CURRENT_TIMESTAMP)
        )
        AND (j.locked_at IS NULL OR j.locked_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes')
      ORDER BY j.scheduled_at ASC
      LIMIT 1
      FOR UPDATE OF j SKIP LOCKED
    `;

    const res = await client.query(selectSql);
    if (res.rowCount === 0) {
      await client.query('COMMIT');
      return null;
    }

    const job = res.rows[0];

    // 2. Tandai job sedang diproses & update locked_at
    await client.query(`
      UPDATE publishing_jobs
      SET 
        status = 'processing',
        locked_at = CURRENT_TIMESTAMP,
        locked_by = $1,
        attempt_count = attempt_count + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [workerId, job.id]);

    await client.query('COMMIT');
    return job;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Catat attempt ke tabel `publishing_attempts`.
 */
export async function appendPublishingAttempt({
  tenantId = 'default_tenant',
  jobId,
  attemptNumber,
  correlationId,
  stage,
  outcome,
  httpStatus = null,
  providerErrorCode = null,
  sanitizedMessage = null,
  externalContainerId = null,
  externalPostId = null,
  startedAt = new Date().toISOString(),
  finishedAt = new Date().toISOString()
}) {
  const attemptId = `att_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  return pgQuery(`
    INSERT INTO publishing_attempts (
      id, tenant_id, job_id, attempt_number, correlation_id,
      stage, outcome, http_status, provider_error_code,
      sanitized_message, external_container_id, external_post_id,
      started_at, finished_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9,
      $10, $11, $12,
      $13, $14
    )
    ON CONFLICT (job_id, attempt_number, stage) DO UPDATE
      SET 
        outcome = EXCLUDED.outcome,
        http_status = EXCLUDED.http_status,
        provider_error_code = EXCLUDED.provider_error_code,
        sanitized_message = EXCLUDED.sanitized_message,
        external_container_id = EXCLUDED.external_container_id,
        external_post_id = EXCLUDED.external_post_id,
        finished_at = EXCLUDED.finished_at
    RETURNING *
  `, [
    attemptId,
    tenantId,
    jobId,
    attemptNumber,
    correlationId || `corr_${Date.now()}`,
    stage,
    outcome,
    httpStatus,
    providerErrorCode,
    sanitizeErrorMessage(sanitizedMessage),
    externalContainerId,
    externalPostId,
    startedAt,
    finishedAt
  ]);
}

/**
 * Perbarui status akhir dan metadata job hasil publikasi.
 */
export async function markPublishingResult(tenantId = 'default_tenant', jobId, {
  status,
  externalContainerId = null,
  externalPostId = null,
  externalPermalink = null,
  lastErrorCode = null,
  lastErrorMessage = null,
  nextAttemptAt = null,
  publishedAt = null,
  externalMediaStatus = null,
  externalObjectType = null,
  providerStage = null,
  providerState = null,
  verifiedAt = null
}) {
  return pgQuery(`
    UPDATE publishing_jobs
    SET 
      status = $1,
      external_container_id = COALESCE($2, external_container_id),
      external_post_id = COALESCE($3, external_post_id),
      external_permalink = COALESCE($4, external_permalink),
      last_error_code = $5,
      last_error_message = $6,
      next_attempt_at = $7,
      published_at = COALESCE($8, published_at),
      locked_at = NULL,
      locked_by = NULL,
      external_media_status = COALESCE($9, external_media_status),
      external_object_type = COALESCE($10, external_object_type),
      provider_stage = COALESCE($11, provider_stage),
      provider_state_json = COALESCE($12::jsonb, provider_state_json),
      verified_at = COALESCE($13, verified_at),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $14 AND tenant_id = $15
    RETURNING *
  `, [
    status,
    externalContainerId,
    externalPostId,
    externalPermalink,
    lastErrorCode,
    sanitizeErrorMessage(lastErrorMessage),
    nextAttemptAt,
    publishedAt,
    externalMediaStatus,
    externalObjectType,
    providerStage,
    providerState ? JSON.stringify(providerState) : null,
    verifiedAt,
    jobId,
    tenantId
  ]);
}

/**
 * Pemulihan pekerjaan stale (hang / crash) yang terkunci melebihi batas waktu.
 */
export async function recoverStalePublishingJobs(staleMinutes = 5) {
  return pgQuery(`
    UPDATE publishing_jobs
    SET 
      status = CASE 
        WHEN external_post_id IS NOT NULL OR external_container_id IS NOT NULL THEN 'verifying'
        WHEN attempt_count >= max_attempts THEN 'failed'
        ELSE 'retry_wait'
      END,
      next_attempt_at = CASE
        WHEN attempt_count < max_attempts THEN CURRENT_TIMESTAMP + INTERVAL '2 minutes'
        ELSE NULL
      END,
      locked_at = NULL,
      locked_by = NULL,
      last_error_code = 'STALE_LOCK_RECOVERY',
      last_error_message = 'Job pulih dari crash atau timeout proses worker.',
      updated_at = CURRENT_TIMESTAMP
    WHERE 
      status IN ('processing', 'creating_container', 'uploading_media', 'waiting_media', 'publishing', 'verifying')
      AND locked_at < CURRENT_TIMESTAMP - ($1 || ' minutes')::INTERVAL
    RETURNING id, tenant_id, status
  `, [String(staleMinutes)]);
}

/**
 * Ubah jadwal job (Reschedule).
 */
export async function reschedulePublishingJob(tenantId = 'default_tenant', jobId, newScheduledAt) {
  const dateObj = new Date(newScheduledAt);
  if (isNaN(dateObj.getTime())) throw new Error('Tanggal baru tidak valid.');

  const res = await pgQuery(`
    UPDATE publishing_jobs
    SET 
      scheduled_at = $1,
      status = 'scheduled',
      next_attempt_at = NULL,
      last_error_code = NULL,
      last_error_message = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND tenant_id = $3 AND status NOT IN ('published', 'processing', 'publishing')
    RETURNING *
  `, [dateObj.toISOString(), jobId, tenantId]);

  if (res.rowCount === 0) {
    throw new Error('Gagal menjadwal ulang. Job mungkin sedang diproses atau sudah published.');
  }

  return res.rows[0];
}

/**
 * Batalkan job (Cancel).
 */
export async function cancelPublishingJob(tenantId = 'default_tenant', jobId, reason = null) {
  const res = await pgQuery(`
    UPDATE publishing_jobs
    SET 
      status = 'cancelled',
      cancelled_at = CURRENT_TIMESTAMP,
      last_error_message = COALESCE($1, 'Dibatalkan oleh pengguna.'),
      locked_at = NULL,
      locked_by = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND tenant_id = $3 AND status NOT IN ('published')
    RETURNING *
  `, [reason, jobId, tenantId]);

  if (res.rowCount === 0) {
    throw new Error('Job tidak dapat dibatalkan atau sudah published.');
  }

  return res.rows[0];
}

/**
 * Manual retry untuk job yang failed / needs_review.
 */
export async function retryPublishingJob(tenantId = 'default_tenant', jobId) {
  const res = await pgQuery(`
    UPDATE publishing_jobs
    SET 
      status = 'scheduled',
      scheduled_at = CURRENT_TIMESTAMP,
      next_attempt_at = NULL,
      attempt_count = 0,
      last_error_code = NULL,
      last_error_message = NULL,
      locked_at = NULL,
      locked_by = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND tenant_id = $2 AND status IN ('failed', 'needs_review', 'cancelled')
    RETURNING *
  `, [jobId, tenantId]);

  if (res.rowCount === 0) {
    throw new Error('Hanya job gagal/dibatalkan yang dapat dicoba ulang secara manual.');
  }

  return res.rows[0];
}

/**
 * Approve job live publishing yang butuh persetujuan.
 */
export async function approvePublishingJob(tenantId = 'default_tenant', jobId, userId) {
  const res = await pgQuery(`
    UPDATE publishing_jobs
    SET 
      approval_status = 'approved',
      approved_by = $1,
      approved_at = CURRENT_TIMESTAMP,
      status = 'scheduled',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND tenant_id = $3 AND approval_status = 'pending_approval'
    RETURNING *
  `, [userId, jobId, tenantId]);

  if (res.rowCount === 0) {
    throw new Error('Job tidak membutuhkan approval atau sudah disetujui sebelumnya.');
  }

  return res.rows[0];
}

/**
 * Dapatkan atau set status kontrol pause/resume global tenant.
 */
export async function getPublishingControl(tenantId = 'default_tenant') {
  const res = await pgQuery(`
    SELECT * FROM publishing_control WHERE tenant_id = $1
  `, [tenantId]);

  if (res.rowCount === 0) {
    return { tenant_id: tenantId, is_paused: false };
  }
  return res.rows[0];
}

export async function setPublishingControl(tenantId = 'default_tenant', { isPaused, pausedBy = null, pauseReason = null }) {
  const res = await pgQuery(`
    INSERT INTO publishing_control (tenant_id, is_paused, paused_at, paused_by, pause_reason, updated_at)
    VALUES ($1, $2, CASE WHEN $2 THEN CURRENT_TIMESTAMP ELSE NULL END, $3, $4, CURRENT_TIMESTAMP)
    ON CONFLICT (tenant_id) DO UPDATE
      SET 
        is_paused = EXCLUDED.is_paused,
        paused_at = EXCLUDED.paused_at,
        paused_by = EXCLUDED.paused_by,
        pause_reason = EXCLUDED.pause_reason,
        updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `, [tenantId, isPaused, pausedBy, pauseReason]);

  return res.rows[0];
}

/**
 * Simpan atau perbarui akun publishing Meta.
 */
export async function savePublishingAccount({
  id = null,
  tenantId = 'default_tenant',
  provider = 'meta',
  platform,
  displayName,
  facebookPageId = null,
  instagramUserId = null,
  linkedFacebookPageId = null,
  tokenCiphertext = null,
  tokenExpiresAt = null,
  permissions = [],
  timezone = 'Asia/Jakarta',
  status = 'active',
  lastVerifiedAt = new Date().toISOString(),
  providerAccountId = null
}) {
  const permsJson = JSON.stringify(permissions || []);

  if (provider === 'repliz') {
    const existingRes = await pgQuery(`
      SELECT id FROM publishing_accounts
      WHERE tenant_id = $1 AND provider = 'repliz' AND provider_account_id = $2
      LIMIT 1
    `, [tenantId, providerAccountId]);

    if (existingRes.rowCount > 0) {
      const existingId = existingRes.rows[0].id;
      const updateRes = await pgQuery(`
        UPDATE publishing_accounts
        SET 
          display_name = $1,
          status = $2,
          timezone = $3,
          last_verified_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4 AND tenant_id = $5
        RETURNING id, tenant_id, platform, display_name, provider, provider_account_id, timezone, status, created_at, updated_at
      `, [displayName, status, timezone, existingId, tenantId]);
      return updateRes.rows[0];
    }

    const accountId = id || `acc_repliz_${platform}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const insertRes = await pgQuery(`
      INSERT INTO publishing_accounts (
        id, tenant_id, provider, platform, display_name,
        provider_account_id, status, timezone, last_verified_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      RETURNING id, tenant_id, platform, display_name, provider, provider_account_id, timezone, status, created_at, updated_at
    `, [accountId, tenantId, provider, platform, displayName, providerAccountId, status, timezone]);

    return insertRes.rows[0];
  }

  // 1. Cek apakah akun dengan kombinasi platform + page/ig id sudah ada (menghindari bug NULL pada PostgreSQL ON CONFLICT)
  const existingRes = await pgQuery(`
    SELECT id FROM publishing_accounts
    WHERE tenant_id = $1 AND platform = $2
      AND facebook_page_id IS NOT DISTINCT FROM $3
      AND instagram_user_id IS NOT DISTINCT FROM $4
    LIMIT 1
  `, [tenantId, platform, facebookPageId, instagramUserId]);

  if (existingRes.rowCount > 0) {
    const existingId = existingRes.rows[0].id;
    const updateRes = await pgQuery(`
      UPDATE publishing_accounts
      SET 
        display_name = $1,
        linked_facebook_page_id = $2,
        token_ciphertext = $3,
        token_expires_at = $4,
        permissions_json = $5,
        timezone = $6,
        status = $7,
        last_verified_at = $8,
        last_error_code = NULL,
        last_error_message = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9 AND tenant_id = $10
      RETURNING id, tenant_id, platform, display_name, facebook_page_id, instagram_user_id, linked_facebook_page_id, token_expires_at, permissions_json, timezone, status, last_verified_at, created_at, updated_at, provider, provider_account_id
    `, [
      displayName,
      linkedFacebookPageId,
      tokenCiphertext,
      tokenExpiresAt,
      permsJson,
      timezone,
      status,
      lastVerifiedAt,
      existingId,
      tenantId
    ]);
    return updateRes.rows[0];
  }

  // 2. Insert baru jika belum ada
  const accountId = id || `acc_${platform}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const insertRes = await pgQuery(`
    INSERT INTO publishing_accounts (
      id, tenant_id, platform, display_name,
      facebook_page_id, instagram_user_id, linked_facebook_page_id,
      token_ciphertext, token_expires_at, permissions_json,
      timezone, status, last_verified_at, updated_at
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7,
      $8, $9, $10,
      $11, $12, $13, CURRENT_TIMESTAMP
    )
    RETURNING id, tenant_id, platform, display_name, facebook_page_id, instagram_user_id, linked_facebook_page_id, token_expires_at, permissions_json, timezone, status, last_verified_at, created_at, updated_at, provider, provider_account_id
  `, [
    accountId,
    tenantId,
    platform,
    displayName,
    facebookPageId,
    instagramUserId,
    linkedFacebookPageId,
    tokenCiphertext,
    tokenExpiresAt,
    permsJson,
    timezone,
    status,
    lastVerifiedAt
  ]);

  return insertRes.rows[0];
}

/**
 * Membersihkan baris akun duplikat lama untuk tenant.
 */
export async function cleanupDuplicatePublishingAccounts(tenantId = null) {
  try {
    const filterSql = tenantId ? 'AND a.tenant_id = $1' : '';
    const params = tenantId ? [tenantId] : [];
    // 1. Cleanup Meta accounts (provider = 'meta')
    await pgQuery(`
      DELETE FROM publishing_accounts a
      USING publishing_accounts b
      WHERE a.id < b.id
        AND a.tenant_id = b.tenant_id
        AND a.provider = b.provider
        AND a.platform = b.platform
        AND a.facebook_page_id IS NOT DISTINCT FROM b.facebook_page_id
        AND a.instagram_user_id IS NOT DISTINCT FROM b.instagram_user_id
        AND a.provider = 'meta'
        ${filterSql}
    `, params);

    // 2. Cleanup Repliz accounts (provider = 'repliz')
    await pgQuery(`
      DELETE FROM publishing_accounts a
      USING publishing_accounts b
      WHERE a.id < b.id
        AND a.tenant_id = b.tenant_id
        AND a.provider = b.provider
        AND a.platform = b.platform
        AND a.provider_account_id = b.provider_account_id
        AND a.provider = 'repliz'
        ${filterSql}
    `, params);
  } catch (err) {
    console.warn('[Publishing Accounts Cleanup Warning]:', err.message);
  }
}

/**
 * List semua akun publishing milik tenant (token ciphertext tidak disertakan untuk keamanan).
 */
export async function listPublishingAccounts(tenantId = 'default_tenant') {
  await cleanupDuplicatePublishingAccounts(tenantId);
  const res = await pgQuery(`
    SELECT 
      id, tenant_id, platform, display_name, facebook_page_id,
      instagram_user_id, linked_facebook_page_id, token_expires_at,
      permissions_json, timezone, status, paused_at, last_verified_at,
      last_error_code, last_error_message, created_at, updated_at,
      provider, provider_account_id
    FROM publishing_accounts
    WHERE tenant_id = $1
    ORDER BY platform ASC, display_name ASC
  `, [tenantId]);

  return res.rows;
}

/**
 * Ambil satu akun publishing. Secara default ciphertext tidak dikembalikan kecuali `includeSecret === true`.
 */
export async function getPublishingAccountById(tenantId = 'default_tenant', accountId, includeSecret = false) {
  const selectCols = includeSecret 
    ? '*' 
    : 'id, tenant_id, platform, display_name, facebook_page_id, instagram_user_id, linked_facebook_page_id, token_expires_at, permissions_json, timezone, status, paused_at, last_verified_at, last_error_code, last_error_message, created_at, updated_at, provider, provider_account_id';

  const res = await pgQuery(`
    SELECT ${selectCols}
    FROM publishing_accounts
    WHERE id = $1 AND tenant_id = $2
  `, [accountId, tenantId]);

  return res.rows[0] || null;
}

/**
 * Update status/pause/error akun publishing.
 */
export async function updatePublishingAccount(tenantId = 'default_tenant', accountId, {
  status,
  displayName,
  timezone,
  lastErrorCode,
  lastErrorMessage
}) {
  const updates = [];
  const params = [accountId, tenantId];
  let pIdx = 3;

  if (status !== undefined) {
    updates.push(`status = $${pIdx++}`);
    params.push(status);
    if (status === 'paused') {
      updates.push(`paused_at = CURRENT_TIMESTAMP`);
    } else if (status === 'active') {
      updates.push(`paused_at = NULL`);
    }
  }

  if (displayName) {
    updates.push(`display_name = $${pIdx++}`);
    params.push(displayName);
  }

  if (timezone) {
    updates.push(`timezone = $${pIdx++}`);
    params.push(timezone);
  }

  if (lastErrorCode !== undefined) {
    updates.push(`last_error_code = $${pIdx++}`);
    params.push(lastErrorCode);
  }

  if (lastErrorMessage !== undefined) {
    updates.push(`last_error_message = $${pIdx++}`);
    params.push(sanitizeErrorMessage(lastErrorMessage));
  }

  updates.push(`updated_at = CURRENT_TIMESTAMP`);

  const res = await pgQuery(`
    UPDATE publishing_accounts
    SET ${updates.join(', ')}
    WHERE id = $1 AND tenant_id = $2
    RETURNING id, tenant_id, platform, display_name, facebook_page_id, instagram_user_id, timezone, status, paused_at, last_verified_at, last_error_code, last_error_message
  `, params);

  return res.rows[0] || null;
}

/**
 * Hapus akun publishing.
 */
export async function deletePublishingAccount(tenantId = 'default_tenant', accountId) {
  const res = await pgQuery(`
    DELETE FROM publishing_accounts
    WHERE id = $1 AND tenant_id = $2
    RETURNING id
  `, [accountId, tenantId]);

  return res.rowCount > 0;
}
