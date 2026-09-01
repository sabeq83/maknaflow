# Implementation Plan — Publish Approved Campaign (Hermes AI Agent × MAKNA Flow)

Menambahkan kemampuan "Publish Approved Campaign" sehingga Hermes AI Agent dapat memilih campaign yang seluruh videonya telah disetujui (manual-approved), membuat preview jadwal multi-video, dan membuat pending publishing plan yang immutable. Final approval dan penciptaan Publishing Jobs tetap berada di bawah kendali manusia melalui MAKNA UI terautentikasi.

## User Review Required

> [!IMPORTANT]
> - **Zero-Privilege Boundary Hermes**: Token Hermes hanya memiliki scope `publishing:read` dan `publishing:plan`. Hermes sama sekali tidak memiliki scope/kewenangan approval (`publishing:approve`) dan tidak memiliki akses langsung ke Repliz credentials atau direct API.
> - **Exact Hash-Locked Approval**: Approval oleh manusia di MAKNA UI mengikat exact `revision` dan `plan_sha256`. Jika ada modifikasi caption/media/urutan setelah preview, approval akan ditolak (`PUBLISHING_PLAN_CHANGED`).
> - **Transaction Atomicity**: Pembuatan N Publishing Jobs untuk N video terpilih dieksekusi dalam satu transaksi database PostgreSQL atomik. Kegagalan pada 1 item membatalkan seluruh batch.
> - **Feature Flag Control**: Fitur dilindungi feature flag `ENABLE_HERMES_CAMPAIGN_PUBLISHING` (default `false` saat deployment awal di Dev).

## Open Questions

None. Persyaratan arsitektur dan batasan keamanan sudah terdefinisi secara presisi pada instruksi.

---

## Proposed Changes

### Database Layer (`lib/db-pg.js`)

#### [MODIFY] [lib/db-pg.js](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/db-pg.js)

Menambahkan migrasi otomatis tabel PostgreSQL yang idempotent:
- `agent_publishing_batches`: Menyimpan batch publishing plan, status (`pending_approval`, `approved`, `scheduled`, `rejected`, `cancelled`, `partial_failure`), revision, plan SHA-256, target account, platform, timezone, idempotency key, dan audit actors.
- `agent_publishing_batch_items`: Menyimpan setiap item video dalam batch, ordered position, snapshot caption & media URL, item SHA-256, scheduled timestamp, dan reference `publishing_job_id`.

Code Sebelum (Current/Before):
```javascript
          CREATE TABLE IF NOT EXISTS agent_publishing_intents (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            run_id TEXT NOT NULL REFERENCES agent_automation_runs(id) ON DELETE CASCADE,
            content_flow_item_id TEXT NOT NULL,
            account_id TEXT NOT NULL,
            platform TEXT NOT NULL,
            publishing_policy_json JSONB NOT NULL DEFAULT '{"mode":"draft_only"}'::jsonb,
            status TEXT NOT NULL DEFAULT 'pending',
            approved_at TIMESTAMPTZ,
            approved_by TEXT,
            payload_sha256 TEXT NOT NULL,
            idempotency_key TEXT NOT NULL,
            scheduled_at TIMESTAMPTZ,
            publishing_job_id TEXT,
            approval_idempotency_key TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, content_flow_item_id, account_id, payload_sha256)
          );
```

Code Sesudah (Proposed/After):
```javascript
          CREATE TABLE IF NOT EXISTS agent_publishing_intents (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            run_id TEXT NOT NULL REFERENCES agent_automation_runs(id) ON DELETE CASCADE,
            content_flow_item_id TEXT NOT NULL,
            account_id TEXT NOT NULL,
            platform TEXT NOT NULL,
            publishing_policy_json JSONB NOT NULL DEFAULT '{"mode":"draft_only"}'::jsonb,
            status TEXT NOT NULL DEFAULT 'pending',
            approved_at TIMESTAMPTZ,
            approved_by TEXT,
            payload_sha256 TEXT NOT NULL,
            idempotency_key TEXT NOT NULL,
            scheduled_at TIMESTAMPTZ,
            publishing_job_id TEXT,
            approval_idempotency_key TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, content_flow_item_id, account_id, payload_sha256)
          );

          CREATE TABLE IF NOT EXISTS agent_publishing_batches (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            campaign_id TEXT NOT NULL,
            source_kind TEXT NOT NULL DEFAULT 'campaign',
            source_id TEXT NOT NULL,
            revision INTEGER NOT NULL DEFAULT 1,
            platform TEXT NOT NULL,
            account_id TEXT NOT NULL REFERENCES publishing_accounts(id) ON DELETE CASCADE,
            timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
            plan_sha256 TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending_approval',
            idempotency_key TEXT NOT NULL,
            metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_by TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            approved_by TEXT,
            approved_at TIMESTAMPTZ,
            rejected_by TEXT,
            rejected_at TIMESTAMPTZ,
            cancelled_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (tenant_id, idempotency_key)
          );

          CREATE INDEX IF NOT EXISTS agent_publishing_batches_tenant_status_idx
            ON agent_publishing_batches(tenant_id, status);
          CREATE INDEX IF NOT EXISTS agent_publishing_batches_tenant_campaign_idx
            ON agent_publishing_batches(tenant_id, campaign_id);

          CREATE TABLE IF NOT EXISTS agent_publishing_batch_items (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            batch_id TEXT NOT NULL REFERENCES agent_publishing_batches(id) ON DELETE CASCADE,
            position INTEGER NOT NULL,
            content_flow_item_id TEXT NOT NULL,
            caption_snapshot TEXT NOT NULL,
            media_url_snapshot TEXT NOT NULL,
            item_sha256 TEXT NOT NULL,
            scheduled_at TIMESTAMPTZ NOT NULL,
            publishing_job_id TEXT REFERENCES publishing_jobs(id) ON DELETE SET NULL,
            status TEXT NOT NULL DEFAULT 'pending_approval',
            error_code TEXT,
            error_message TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (batch_id, position),
            UNIQUE (batch_id, content_flow_item_id)
          );

          CREATE INDEX IF NOT EXISTS agent_publishing_batch_items_batch_idx
            ON agent_publishing_batch_items(batch_id, position);
          CREATE INDEX IF NOT EXISTS agent_publishing_batch_items_cf_idx
            ON agent_publishing_batch_items(tenant_id, content_flow_item_id);
```

---

### Core Publishing & Contract Layer

#### [MODIFY] [lib/publishing-repository.js](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/publishing-repository.js)

Refactor `createPublishingJobs` menjadi `createPublishingJobsWithClient(client, input)` sehingga caller-owned transaction dapat memanfaatkannya secara aman tanpa commit/rollback prematur.

Code Sebelum (Current/Before):
```javascript
export async function createPublishingJobs({
  tenantId = 'default_tenant',
  userId = null,
  contentId,
  targets = [],
}) {
  if (!contentId) throw new Error('contentId wajib disediakan.');
  if (!Array.isArray(targets) || targets.length === 0) throw new Error('Minimal satu target penjadwalan wajib dipilih.');

  const pool = getPgPool();
  const client = await pool.connect();
  const createdJobs = [];

  try {
    await client.query('BEGIN');
    for (const target of targets) {
      // ... insert publishing_jobs ...
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
```

Code Sesudah (Proposed/After):
```javascript
export async function createPublishingJobsWithClient(client, {
  tenantId = 'default_tenant',
  userId = null,
  contentId,
  targets = [],
}) {
  if (!contentId) throw new Error('contentId wajib disediakan.');
  if (!Array.isArray(targets) || targets.length === 0) throw new Error('Minimal satu target penjadwalan wajib dipilih.');

  const createdJobs = [];
  for (const target of targets) {
    // ... validate account & insert publishing_jobs using client ...
    createdJobs.push(insertRes.rows[0]);
  }
  return createdJobs;
}

export async function createPublishingJobs(params) {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const jobs = await createPublishingJobsWithClient(client, params);
    await client.query('COMMIT');
    return jobs;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

---

#### [NEW] [lib/approved-campaign-publishing-contract.js](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/approved-campaign-publishing-contract.js)

Menyediakan contract normalisasi, validasi slot, kalkulasi tanggal multi-slot timezone-aware, canonical SHA-256 plan hashing, dan error taxonomy.

Code Sebelum (Current/Before):
```javascript
// File belum ada
```

Code Sesudah (Proposed/After):
```javascript
import crypto from 'crypto';

export const PUBLISHING_ERROR_CODES = {
  CAMPAIGN_NOT_FOUND: 'CAMPAIGN_NOT_FOUND',
  CAMPAIGN_NOT_FULLY_APPROVED: 'CAMPAIGN_NOT_FULLY_APPROVED',
  CONTENT_NOT_IN_CAMPAIGN: 'CONTENT_NOT_IN_CAMPAIGN',
  FINAL_MEDIA_NOT_READY: 'FINAL_MEDIA_NOT_READY',
  CONTENT_ALREADY_SCHEDULED: 'CONTENT_ALREADY_SCHEDULED',
  PUBLISHING_ACCOUNT_NOT_FOUND: 'PUBLISHING_ACCOUNT_NOT_FOUND',
  PUBLISHING_SLOT_CONFLICT: 'PUBLISHING_SLOT_CONFLICT',
  PUBLISHING_PLAN_CHANGED: 'PUBLISHING_PLAN_CHANGED',
  PUBLISHING_PLAN_ALREADY_APPROVED: 'PUBLISHING_PLAN_ALREADY_APPROVED',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  HERMES_PUBLISH_APPROVAL_FORBIDDEN: 'HERMES_PUBLISH_APPROVAL_FORBIDDEN',
  HERMES_CAMPAIGN_PUBLISHING_DISABLED: 'HERMES_CAMPAIGN_PUBLISHING_DISABLED',
  INVALID_PUBLISHING_PLAN: 'INVALID_PUBLISHING_PLAN',
  VIDEOS_PER_DAY_MISMATCH: 'VIDEOS_PER_DAY_MISMATCH'
};

export function normalizePublishingPlanInput(input) { ... }
export function calculateDynamicSlots({ startDate, publishTimes, timezone, count, cadence }) { ... }
export function hashPublishingPlan(plan) { ... }
export function hashBatchItem(item) { ... }
```

---

#### [NEW] [lib/approved-campaign-publishing-repository.js](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/approved-campaign-publishing-repository.js)

Menyediakan query PostgreSQL tenant-scoped untuk:
- `findApprovedCampaign(campaignId, tenantId)`
- `listEligibleCampaigns({ tenantId, search, limit, offset })`
- `findEligibleCampaignItems(campaignId, tenantId)`
- `findPublishingAccountSafe(accountId, tenantId, platform)`
- `listPublishingAccountsSafe({ tenantId, platform })`
- `createPlanIdempotent({ tenantId, idempotencyKey, campaignId, sourceKind, sourceId, platform, accountId, timezone, items, planHash, metadata, createdBy })`
- `getPublishingBatch(batchId, tenantId)`
- `approveAndCreateJobs({ batchId, tenantId, revision, planSha256, approvedBy })`
- `rejectPublishingBatch({ batchId, tenantId, rejectedBy, reason })`

Code Sebelum (Current/Before):
```javascript
// File belum ada
```

Code Sesudah (Proposed/After):
```javascript
import { getPgPool, pgQuery } from './db-pg.js';
import { createPublishingJobsWithClient } from './publishing-repository.js';
// ... implementasi repository tenant-scoped dengan transaksi atomic dan advisory lock ...
```

---

#### [NEW] [lib/approved-campaign-publishing-service.js](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/approved-campaign-publishing-service.js)

Business logic layer yang menghubungkan server-side campaign lineage resolver, preview generator, idempotency handler, dan exact approval orchestration.

Code Sebelum (Current/Before):
```javascript
// File belum ada
```

Code Sesudah (Proposed/After):
```javascript
export async function resolveApprovedCampaign(campaignId, tenantId) { ... }
export async function previewCampaignPlan({ campaignId, tenantId, input }) { ... }
export async function createPendingPublishingPlan({ campaignId, tenantId, input, idempotencyKey, createdBy }) { ... }
export async function executeHumanPlanApproval({ batchId, tenantId, revision, planSha256, user }) { ... }
export async function executeHumanPlanRejection({ batchId, tenantId, user, reason }) { ... }
```

---

### Operator API Layer (`app/api/operator/v2/...`)

#### [NEW] [app/api/operator/v2/approved-campaigns/route.js](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/operator/v2/approved-campaigns/route.js)
Scope: `publishing:read`. Menampilkan daftar campaign yang eligible dan status approved video.

#### [NEW] [app/api/operator/v2/approved-campaigns/[id]/preview/route.js](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/operator/v2/approved-campaigns/[id]/preview/route.js)
Scope: `publishing:read`. Menghasilkan read-only preview jadwal dan slot multi-video.

#### [NEW] [app/api/operator/v2/approved-campaigns/[id]/publishing-plans/route.js](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/operator/v2/approved-campaigns/[id]/publishing-plans/route.js)
Scope: `publishing:plan`. Menerima `Idempotency-Key` dan membuat pending publishing plan (0 Publishing Jobs).

#### [NEW] [app/api/operator/v2/publishing-accounts/route.js](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/operator/v2/publishing-accounts/route.js)
Scope: `publishing:read`. Mengembalikan daftar akun publishing aktif tersanitasi tanpa token atau secret.

#### [NEW] [app/api/operator/v2/publishing-plans/[id]/route.js](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/operator/v2/publishing-plans/[id]/route.js)
Scope: `publishing:read`. Memonitor status batch, item, dan job.

---

### Human Approval & Session API Layer (`app/api/v2/...`)

#### [NEW] [app/api/v2/publishing-plans/[id]/approve/route.js](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/v2/publishing-plans/[id]/approve/route.js)
Auth: Session User via `withTenantContext`. Memvalidasi `revision` dan `plan_sha256`, lalu mengeksekusi atomic creation N Publishing Jobs.

#### [NEW] [app/api/v2/publishing-plans/[id]/reject/route.js](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/v2/publishing-plans/[id]/reject/route.js)
Auth: Session User via `withTenantContext`. Menolak pending batch plan.

#### [NEW] [app/api/v2/publishing-plans/[id]/route.js](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/v2/publishing-plans/[id]/route.js)
Auth: Session User via `withTenantContext`. Mengambil detail batch untuk rendering review panel di MAKNA UI.

---

### UI Layer (`app/content-flow/...`)

#### [NEW] [app/content-flow/PublishingBatchReview.js](file:///Users/sabeqmmursyid/_maknaflow-staging/app/content-flow/PublishingBatchReview.js)
Komponen modal/panel review MAKNA Flow yang menampilkan:
- Ringkasan batch (Campaign, Target Account, Platform, Jadwal Range, Revision, Plan SHA-256)
- Grid kartu video dengan thumbnail HTTPS, caption preview, dan jadwal slot lokal
- Tombol "Approve & Jadwalkan Posting" dan "Tolak / Batalkan"
- Feedback sukses dengan link ke tab antrean jadwal publishing.

#### [MODIFY] [app/content-flow/page.js](file:///Users/sabeqmmursyid/_maknaflow-staging/app/content-flow/page.js)
Mendeteksi query parameter `?publishing_batch=<batch_id>` dan menampilkan modal `PublishingBatchReview`.

Code Sebelum (Current/Before):
```jsx
  const searchParams = useSearchParams();
  const router = useRouter();
  const accountQuery = searchParams.get('account') || 'all';
  const requestedView = searchParams.get('view');
  const initialView = ['library', 'publishing', 'analytics'].includes(requestedView)
    ? requestedView
    : 'library';
```

Code Sesudah (Proposed/After):
```jsx
  const searchParams = useSearchParams();
  const router = useRouter();
  const accountQuery = searchParams.get('account') || 'all';
  const batchIdParam = searchParams.get('publishing_batch') || null;
  const [activeBatchId, setActiveBatchId] = useState(batchIdParam);

  useEffect(() => {
    if (batchIdParam) setActiveBatchId(batchIdParam);
  }, [batchIdParam]);
  // ...
  {activeBatchId && (
    <PublishingBatchReview
      batchId={activeBatchId}
      onClose={() => {
        setActiveBatchId(null);
        const params = new URLSearchParams(searchParams.toString());
        params.delete('publishing_batch');
        router.replace(`/content-flow?${params.toString()}`);
      }}
      onApproved={() => {
        loadContent();
        handleSwitchView('publishing');
      }}
    />
  )}
```

---

### Hermes Skill & References (`plugins/makna-hermes/...`)

#### [MODIFY] [plugins/makna-hermes/skills/makna-content-orchestrator/SKILL.md](file:///Users/sabeqmmursyid/_maknaflow-staging/plugins/makna-hermes/skills/makna-content-orchestrator/SKILL.md)
Update instruksi parsing:
- Membedakan `selected_video_count`, `videos_per_day`, dan `publish_times`.
- Meminta klarifikasi jika terjadi ambiguitas (misal N video per hari dengan 2 slot jam).
- Menjalankan alur: discovery -> preview -> konfirmasi pengguna -> create pending plan -> berikan URL approval MAKNA (`/content-flow?publishing_batch=<batch_id>`).
- Menegaskan Hermes dilarang approve atau memanggil Repliz.

#### [MODIFY] [plugins/makna-hermes/skills/makna-content-orchestrator/references/operator-api.md](file:///Users/sabeqmmursyid/_maknaflow-staging/plugins/makna-hermes/skills/makna-content-orchestrator/references/operator-api.md)
Dokumentasikan spesifikasi teknis endpoint baru, payload JSON, dan error taxonomy.

---

### Automated Tests (`tests/approved-campaign-publishing.test.js`)

#### [NEW] [tests/approved-campaign-publishing.test.js](file:///Users/sabeqmmursyid/_maknaflow-staging/tests/approved-campaign-publishing.test.js)
Menguji seluruh matriks:
1. Normalisasi dan kalkulasi slot dinamis N=1, N=5, N=6, N=30 (2+2+1 over 3 days).
2. Deteksi error `VIDEOS_PER_DAY_MISMATCH` jika `videos_per_day !== publish_times.length`.
3. Deterministic canonical SHA-256 hashing.
4. Lineage verification dan tenant scoping.
5. Ineligible / unapproved item validation.
6. Hermes token restricted to `publishing:read,publishing:plan` (403 on approve endpoint).
7. Legacy operator token restriction.
8. Idempotency test (same key/body replay; same key/different body 409).
9. Atomic creation of exactly N jobs on exact human approval.
10. Rollback on item failure (0 jobs created).
11. Hash mismatch rejection after preview.
12. Redaction: no secrets or credentials leaked.

---

## Execution Task List

- [ ] Audit exact lineage from automation/agent run to all selected ContentFlow items.
- [ ] Freeze batch schema, eligibility rules, state machine, hashes, and error taxonomy.
- [ ] Add idempotent PostgreSQL migration and tenant-scoped repository.
- [ ] Implement canonical contract and timezone-aware slot calculation.
- [ ] Implement campaign resolver and read-only preview.
- [ ] Implement Operator discovery, account, plan-create, and status endpoints.
- [ ] Keep Hermes credential limited to `publishing:read,publishing:plan`.
- [ ] Implement session-authenticated exact revision/hash approval and rejection.
- [ ] Refactor Publishing Jobs creation to support caller-owned transaction.
- [ ] Add ContentFlow batch review UI and audit visibility.
- [ ] Update Hermes skill and API reference.
- [ ] Add unit, authorization, concurrency, atomicity, and regression tests.
- [ ] Run build and legacy publishing tests until successful.
- [ ] Deploy Dev with feature flag off; verify unauthorized and disabled behavior.
- [ ] Enable Dev and run read-only preview smoke.
- [ ] Obtain explicit permission before any non-live approval smoke.
- [ ] Confirm no Production deployment and no `auto_publish` change.
- [ ] Run patch release, push tag/branch, and verify clean worktree.

---

## Verification Plan

### Automated Tests
```bash
node --test tests/approved-campaign-publishing.test.js
npm run test:publishing-scheduler
npm run test:content-automation
npm run build
```

### Manual Verification
1. Verifikasi route operator v2 mengembalikan 401 tanpa token, 403 jika scope tidak cukup.
2. Verifikasi pending plan menghasilkan 0 publishing jobs sebelum approval.
3. Verifikasi approval endpoint menghasilkan tepat N publishing jobs berstatus approved/scheduled.
4. Verifikasi Dev deployment dengan feature flag default off.
