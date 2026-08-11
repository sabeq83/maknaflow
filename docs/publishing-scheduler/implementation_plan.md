# Implementation Plan — Content Flow Publishing Scheduler Facebook & Instagram

## 1. Tujuan

Membangun modul **Publishing Scheduler** di dalam menu Content Flow untuk menjadwalkan, memantau, membatalkan, menjadwal ulang, mencoba ulang, dan mengaudit publikasi konten MAKNA Flow ke Facebook Page dan Instagram Professional melalui Meta Graph API.

Implementasi dilakukan bertahap. Tahap awal hanya membuat **Facebook scheduled draft** agar mekanisme antrean dapat divalidasi tanpa risiko konten langsung tayang. Facebook live dan Instagram publishing baru boleh diaktifkan setelah koneksi, permission, media preflight, idempotency, rekonsiliasi, dan approval guardrail terbukti.

Mockup acuan UX:

`/Users/sabeqmmursyid/.codex/visualizations/2026/08/11/019fef61-a937-7133-ae2d-31321cbc873a/content-flow-publishing-scheduler.html`

## 2. Ruang Lingkup

### Termasuk

- Tab `Publishing Scheduler` pada halaman Content Flow.
- Tampilan antrean, kalender mingguan, riwayat, metrik ringkas, dan panel detail job.
- Satu publishing job untuk satu kombinasi konten, akun, platform, dan jadwal.
- PostgreSQL repository tenant-aware dengan claim atomik `FOR UPDATE SKIP LOCKED`.
- Worker backend dengan bounded concurrency, stale-job recovery, retry, dan reconciliation.
- Snapshot caption serta media saat jadwal dibuat.
- Akun Meta dan token terenkripsi per tenant.
- Facebook Page draft publisher sebagai rollout pertama.
- Facebook Page live publisher dengan approval eksplisit pada fase berikutnya.
- Instagram image/Reels container workflow pada fase berikutnya.
- Sinkronisasi hasil ke `content_flow_items` sebagai ringkasan status/permalink.
- Audit setiap attempt tanpa menyimpan credential atau payload sensitif.
- Pause global, pause per akun, cancel, reschedule, retry manual, dan health status.
- Unit, repository, API, worker, integration, dan UI smoke test.

### Tidak termasuk

- TikTok, YouTube, Threads, marketplace, atau platform selain Facebook dan Instagram.
- Analitik engagement, insight, comment management, atau ads management.
- Mengganti pipeline produksi konten atau Strategic Campaign Single-Pass Engine.
- Menjadikan `scheduler_jobs` lama sebagai satu-satunya sumber data publishing.
- Mengaktifkan publikasi live secara default.
- Deployment production tanpa perintah manual eksplisit pengguna.

## 3. Keputusan Arsitektur

```text
Content Flow item (pipeline selesai)
        │
        ├── Facebook publishing_job
        └── Instagram publishing_job
                 │
                 ▼
        PostgreSQL claim + lock
                 │
                 ▼
        Publishing Worker
                 │
                 ▼
        Publishing Service
          ├── Facebook Publisher
          └── Instagram Publisher
                 │
                 ▼
        publishing_attempts + Content Flow summary
```

Keputusan wajib:

1. PostgreSQL adalah sumber kebenaran; field platform pada Content Flow hanya ringkasan.
2. Satu job hanya mewakili satu platform dan satu akun tujuan.
3. Caption, media URL, tipe media, dan mode publikasi disimpan sebagai snapshot.
4. Transaksi database tidak boleh ditahan selama network call ke Meta.
5. Custom idempotency key mencegah duplikasi lokal, tetapi tidak dianggap sebagai jaminan idempotensi eksternal.
6. Timeout setelah request publish masuk ke `VERIFYING`, bukan langsung di-retry.
7. Instagram diperlakukan asynchronous: create container, poll status, lalu publish.
8. Credential tidak boleh berada di `publishing_jobs`, log, response API, atau client bundle.
9. Graph API version berasal dari konfigurasi dan wajib memakai versi yang masih didukung saat implementasi.
10. `ENABLE_PUBLISHING_WORKER=false` adalah default aman sampai migrasi dan koneksi selesai.

## 4. Eligibility dan Guardrail

Konten hanya boleh dijadwalkan bila:

- tenant dan akses Brand/Account tervalidasi;
- `pipeline_status` menunjukkan konten selesai;
- final media tersedia dan lolos preflight;
- caption platform tersedia atau dikonfirmasi operator;
- akun publishing aktif serta permission valid;
- jadwal valid dan disimpan UTC;
- mode live telah diizinkan tenant dan, bila diwajibkan, sudah disetujui operator.

Mode rollout:

| Fase | Facebook | Instagram | Default |
|---|---|---|---|
| 1 | Scheduled draft | Tidak aktif | Draft-only |
| 2 | Live dengan approval | Tidak aktif | Approval required |
| 3 | Live dengan approval | Image/Reels dengan approval | Approval required |
| 4 | Policy per brand | Policy per brand | Tetap opt-in |

## 5. Model Data

### 5.1 `publishing_accounts`

```sql
CREATE TABLE publishing_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('facebook','instagram')),
  display_name TEXT NOT NULL,
  facebook_page_id TEXT,
  instagram_user_id TEXT,
  linked_facebook_page_id TEXT,
  token_ciphertext TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  permissions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  status TEXT NOT NULL DEFAULT 'active',
  paused_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, platform, facebook_page_id, instagram_user_id)
);
```

### 5.2 `publishing_jobs`

```sql
CREATE TABLE publishing_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  content_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES publishing_accounts(id),
  platform TEXT NOT NULL CHECK (platform IN ('facebook','instagram')),
  publish_mode TEXT NOT NULL CHECK (publish_mode IN ('draft','live')),
  media_type TEXT NOT NULL,
  caption_snapshot TEXT NOT NULL,
  media_url_snapshot TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  approval_status TEXT NOT NULL DEFAULT 'not_required',
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_attempt_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  external_container_id TEXT,
  external_post_id TEXT,
  external_permalink TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  idempotency_key TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, idempotency_key)
);
```

Index minimum:

```sql
CREATE INDEX publishing_jobs_due_idx
  ON publishing_jobs(status, scheduled_at, next_attempt_at);
CREATE INDEX publishing_jobs_tenant_content_idx
  ON publishing_jobs(tenant_id, content_id, created_at DESC);
CREATE INDEX publishing_jobs_account_idx
  ON publishing_jobs(tenant_id, account_id, scheduled_at DESC);
```

### 5.3 `publishing_attempts`

```sql
CREATE TABLE publishing_attempts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  job_id TEXT NOT NULL REFERENCES publishing_jobs(id),
  attempt_number INTEGER NOT NULL,
  correlation_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  outcome TEXT NOT NULL,
  http_status INTEGER,
  provider_error_code TEXT,
  sanitized_message TEXT,
  external_container_id TEXT,
  external_post_id TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  UNIQUE (job_id, attempt_number, stage)
);
```

## 6. Lifecycle Status

```text
validating
  → scheduled
  → processing
  → creating_container (Instagram)
  → waiting_media (Instagram)
  → publishing
  → published
```

Cabang:

```text
temporary failure → retry_wait → processing
unknown external outcome → verifying → published | retry_wait | needs_review
permanent failure → failed
operator cancellation → cancelled
```

Aturan:

- `failed` adalah terminal sampai retry manual.
- `retry_wait` selalu memiliki `next_attempt_at`.
- `processing` stale dikembalikan ke `retry_wait` hanya jika belum ada kemungkinan hasil eksternal ambigu.
- Setelah request publish dikirim tetapi response tidak pasti, job wajib `verifying`.
- Job `published` tidak boleh diubah kembali ke scheduled.

## 7. Kontrak API

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/v2/publishing/jobs` | List/filter queue, history, metrics |
| POST | `/api/v2/publishing/jobs` | Validasi dan buat satu/banyak job platform |
| GET | `/api/v2/publishing/jobs/[id]` | Detail job dan attempts |
| PATCH | `/api/v2/publishing/jobs/[id]` | Reschedule, cancel, approve |
| POST | `/api/v2/publishing/jobs/[id]/retry` | Retry manual terminal job |
| GET | `/api/v2/publishing/accounts` | List akun tanpa credential |
| POST | `/api/v2/publishing/accounts` | Simpan/test akun terenkripsi |
| PATCH | `/api/v2/publishing/accounts/[id]` | Pause, reconnect, update |
| POST | `/api/v2/publishing/preflight` | Validasi content/media/account |
| GET | `/api/v2/publishing/health` | Worker tick, backlog, stale, pause |
| PATCH | `/api/v2/publishing/control` | Pause/resume global, admin only |

Semua route:

- menggunakan App Router Route Handler dan `NextResponse`;
- tidak dicache;
- memvalidasi session, role, tenant, content ownership, dan account ownership;
- tidak pernah mengembalikan token ciphertext;
- memakai error contract terstruktur `{ error, code, details? }`;
- membatasi pagination dan input schedule range.

## 8. Retry, Rekonsiliasi, dan Rate Limit

- Retry backoff awal: 1, 5, dan 15 menit dengan jitter.
- Klasifikasi transient: timeout sebelum request terkirim, 429, dan provider 5xx yang aman.
- Klasifikasi permanent: invalid permission, invalid media, disconnected account, dan rejected container.
- Unknown outcome: network putus setelah request publish terkirim; masuk `verifying`.
- Simpan `external_container_id` segera setelah Meta mengembalikannya.
- Reconciliation memeriksa external object/container sebelum retry publish.
- Batasi concurrency global dan per account agar satu akun tidak menghabiskan pool/rate limit.
- Jangan log Authorization header, access token, signed URL penuh, atau raw Meta response.

## 9. UI Content Flow

Tambahkan view internal pada `app/content-flow/page.js`:

```text
Content Library | Publishing Scheduler
```

Publishing Scheduler mempunyai:

- metrik Terjadwal, Published Hari Ini, Retry Wait, dan Perlu Tindakan;
- tab Antrean, Kalender, dan Riwayat;
- filter akun, platform, status, dan tanggal;
- tabel dengan thumbnail, tujuan, jadwal, dan status;
- detail drawer untuk snapshot caption, timeline attempt, external ID, dan error;
- tindakan schedule, reschedule, cancel, retry, approve, pause worker;
- timezone selalu ditampilkan eksplisit;
- status warna bukan satu-satunya pembeda; selalu sertakan label teks.

## 10. Perubahan Per File — Before & After

> Snippet adalah kontrak perubahan. Agent wajib membaca kode aktual dan mempertahankan perubahan pengguna yang tidak terkait.

### 10.1 `lib/db-pg.js`

**Code Sebelum (Current/Before)**

```js
const migrateOperatorJobs = async () => {
  // migrasi tabel operasional lain
};
```

**Code Sesudah (Proposed/After)**

```js
const migratePublishingScheduler = async () => {
  await withAdvisoryMigrationLock('makna_publishing_scheduler_v1', async client => {
    await client.query(`CREATE TABLE IF NOT EXISTS publishing_accounts (...)`);
    await client.query(`CREATE TABLE IF NOT EXISTS publishing_jobs (...)`);
    await client.query(`CREATE TABLE IF NOT EXISTS publishing_attempts (...)`);
    await client.query(`CREATE INDEX IF NOT EXISTS publishing_jobs_due_idx ...`);
  });
};
```

### 10.2 `lib/publishing-contract.js` — file baru

**Code Sebelum (Current/Before)**

```text
File belum ada.
```

**Code Sesudah (Proposed/After)**

```js
export const PUBLISHING_PLATFORMS = ['facebook', 'instagram'];
export const PUBLISHING_STATUSES = [
  'validating', 'scheduled', 'processing', 'creating_container',
  'waiting_media', 'publishing', 'verifying', 'retry_wait',
  'published', 'failed', 'needs_review', 'cancelled'
];

export function validateScheduleRequest(input) { /* normalized contract */ }
export function classifyProviderFailure(error) { /* transient/permanent/unknown */ }
```

### 10.3 `lib/publishing-repository.js` — file baru

**Code Sebelum (Current/Before)**

```text
File belum ada.
```

**Code Sesudah (Proposed/After)**

```js
export async function createPublishingJobs({ tenantId, userId, content, targets }) {}
export async function claimDuePublishingJob(workerId) {
  // transaction + FOR UPDATE SKIP LOCKED; commit sebelum network call
}
export async function markPublishingResult(jobId, result) {}
export async function appendPublishingAttempt(attempt) {}
export async function recoverStalePublishingJobs() {}
```

### 10.4 `lib/meta-publisher.js` — file baru

**Code Sebelum (Current/Before)**

```text
File belum ada.
```

**Code Sesudah (Proposed/After)**

```js
export async function publishFacebook(job, account) {
  return job.publish_mode === 'draft'
    ? createFacebookDraft(job, account)
    : publishFacebookLive(job, account);
}

export async function createInstagramContainer(job, account) {}
export async function getInstagramContainerStatus(containerId, account) {}
export async function publishInstagramContainer(containerId, account) {}
export async function verifyExternalOutcome(job, account) {}
```

Catatan: pindahkan komunikasi Graph API generik dari helper lama secara bertahap; pertahankan adapter compatibility agar Recipe Labs/campaign lama tidak rusak.

### 10.5 `lib/facebook-helper.js`

**Code Sebelum (Current/Before)**

```js
const FB_GRAPH_URL = 'https://graph.facebook.com/v19.0';

const payload = {
  access_token: truePageToken,
  published: false,
  unpublished_content_type: 'DRAFT'
};
```

**Code Sesudah (Proposed/After)**

```js
const graphVersion = getRequiredSupportedGraphVersion();
const graphUrl = `https://graph.facebook.com/${graphVersion}`;

export async function postDraftToFacebookPage(params) {
  return metaPublisher.createFacebookDraft(normalizeLegacyParams(params));
}
```

Guardrail draft lama harus tetap berlaku pada semua caller legacy.

### 10.6 `lib/publishing-worker.js` — file baru

**Code Sebelum (Current/Before)**

```text
File belum ada.
```

**Code Sesudah (Proposed/After)**

```js
export async function runPublishingTick() {
  await recoverStalePublishingJobs();
  for (let index = 0; index < MAX_BATCH; index += 1) {
    const job = await claimDuePublishingJob(workerId);
    if (!job) break;
    await processPublishingJob(job);
  }
}

export function startPublishingWorker() {
  if (!publishingWorkerEnabled()) return null;
  runPublishingTick();
  return setInterval(runPublishingTick, intervalMs);
}
```

### 10.7 `instrumentation.js`

**Code Sebelum (Current/Before)**

```js
const { startScheduler } = await import('./lib/scheduler.js');
startScheduler();
```

**Code Sesudah (Proposed/After)**

```js
if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.ENABLE_PUBLISHING_WORKER === 'true') {
  const { startPublishingWorker } = await import('./lib/publishing-worker.js');
  startPublishingWorker();
}
```

Hanya satu process role yang boleh mengaktifkan flag ini pada setiap environment.

### 10.8 `lib/node-config.js`

**Code Sebelum (Current/Before)**

```js
export function isWorkerEnabled() { /* generic scheduler worker */ }
```

**Code Sesudah (Proposed/After)**

```js
export function isPublishingWorkerEnabled() {
  return process.env.ENABLE_PUBLISHING_WORKER === 'true'
    && ['standalone', 'gateway', 'master'].includes(getNodeRole());
}
```

### 10.9 `app/api/v2/publishing/jobs/route.js` — file baru

**Code Sebelum (Current/Before)**

```text
File belum ada.
```

**Code Sesudah (Proposed/After)**

```js
export async function GET(request) {
  const session = await requireAuthenticatedTenant(request);
  return NextResponse.json(await listPublishingJobs(session.tenantId, filters));
}

export async function POST(request) {
  const session = await requireAuthenticatedTenant(request);
  const input = validateScheduleRequest(await request.json());
  return NextResponse.json(await scheduleContent(session, input), { status: 201 });
}
```

### 10.10 `app/api/v2/publishing/jobs/[id]/route.js` dan `retry/route.js` — file baru

**Code Sebelum (Current/Before)**

```text
File belum ada.
```

**Code Sesudah (Proposed/After)**

```js
export async function PATCH(request, { params }) {
  const { id } = await params;
  return mutatePublishingJobWithTenantGuard(id, await request.json());
}

export async function POST(request, { params }) {
  const { id } = await params;
  return retryFailedPublishingJobWithTenantGuard(id);
}
```

### 10.11 `app/api/v2/publishing/accounts/route.js` dan `[id]/route.js` — file baru

**Code Sebelum (Current/Before)**

```text
File belum ada.
```

**Code Sesudah (Proposed/After)**

```js
export async function POST(request) {
  const input = await request.json();
  const verified = await verifyMetaAccount(input);
  return savePublishingAccount({ ...verified, tokenCiphertext: encryptSecret(input.token) });
}
```

Response tidak boleh menyertakan token atau ciphertext.

### 10.12 `app/api/v2/publishing/preflight/route.js`, `health/route.js`, dan `control/route.js` — file baru

**Code Sebelum (Current/Before)**

```text
File belum ada.
```

**Code Sesudah (Proposed/After)**

```js
export async function POST(request) {
  return NextResponse.json(await preflightPublishingTarget(session, await request.json()));
}

export async function GET() {
  return NextResponse.json(await getPublishingHealth(session.tenantId));
}
```

Pause/resume global hanya admin dan disimpan di database, bukan hanya memory process.

### 10.13 `app/content-flow/PublishingScheduler.js` — file baru

**Code Sebelum (Current/Before)**

```text
File belum ada.
```

**Code Sesudah (Proposed/After)**

```js
'use client';

export default function PublishingScheduler() {
  const [view, setView] = useState('queue');
  const [selectedJob, setSelectedJob] = useState(null);
  // queue, calendar, history, drawer, schedule dialog, mutations
}
```

### 10.14 `app/content-flow/page.js`

**Code Sebelum (Current/Before)**

```js
export default function ContentFlowPage() {
  // Content Flow library dan status publishing manual
}
```

**Code Sesudah (Proposed/After)**

```js
const [contentFlowView, setContentFlowView] = useState('library');

return contentFlowView === 'publishing'
  ? <PublishingScheduler />
  : <ContentFlowLibrary onSchedule={openScheduleDialog} />;
```

Jangan memecah page besar secara agresif di pekerjaan ini; lakukan ekstraksi minimum yang aman.

### 10.15 `app/settings/page.js`

**Code Sebelum (Current/Before)**

```js
renderCollapsibleCard('facebook_page', 'automation', 'Facebook Page Integration', ...)
```

**Code Sesudah (Proposed/After)**

```js
renderCollapsibleCard('publishing_accounts', 'automation', 'Meta Publishing Accounts', (
  <PublishingAccountsSettings
    supportsFacebook
    supportsInstagram
    tokenMasked
    permissionHealth
  />
));
```

Settings lama tetap tersedia selama migrasi dan ditandai legacy draft connection.

### 10.16 `ecosystem.macmini.config.cjs`

**Code Sebelum (Current/Before)**

```js
env_staging: {
  NODE_ROLE: 'standalone'
}
```

**Code Sesudah (Proposed/After)**

```js
env_staging: {
  NODE_ROLE: 'standalone',
  ENABLE_PUBLISHING_WORKER: 'false',
  PUBLISHING_WORKER_INTERVAL_MS: '15000',
  PUBLISHING_WORKER_MAX_BATCH: '3'
}
```

Flag diubah ke `true` hanya setelah migrasi, account test, dan smoke test berhasil.

### 10.17 `sot/global/facebook-integration.md`

**Code Sebelum (Current/Before)**

```md
Facebook integration acts as a Direct Dispatcher Service.
There is no custom facebook_queue or social_accounts table.
```

**Code Sesudah (Proposed/After)**

```md
Legacy callers remain draft-only through the compatibility adapter.
New Content Flow scheduling uses publishing_accounts, publishing_jobs,
publishing_attempts, and the Publishing Worker.
```

### 10.18 `sot/global/publishing-scheduler.md` — file baru

**Code Sebelum (Current/Before)**

```text
File belum ada.
```

**Code Sesudah (Proposed/After)**

```md
# Publishing Scheduler Source of Truth

Dokumentasikan lifecycle, ownership worker, schema, Graph API contract,
rollout flags, recovery, observability, runbook, dan rollback.
```

### 10.19 `tests/publishing-scheduler.test.js` — file baru

**Code Sebelum (Current/Before)**

```text
File belum ada.
```

**Code Sesudah (Proposed/After)**

```js
test('competing workers claim a due job only once', async () => {});
test('unknown publish outcome enters verifying instead of retrying', async () => {});
test('tenant cannot access another tenant publishing account', async () => {});
test('legacy Facebook caller remains draft-only', async () => {});
```

### 10.20 `package.json`

**Code Sebelum (Current/Before)**

```json
{
  "scripts": {
    "test": "..."
  }
}
```

**Code Sesudah (Proposed/After)**

```json
{
  "scripts": {
    "test:publishing-scheduler": "node --test tests/publishing-scheduler.test.js"
  }
}
```

## 11. Execution Task List

- [x] Tahap 0 — Audit baseline, working tree, Next.js docs, Graph API version/permissions resmi, dan test existing Facebook draft.
- [x] Tahap 1 — Tambahkan contract, schema PostgreSQL, index, backfill-safe migration, repository tenant-aware, serta tests repository.
- [x] Tahap 2 — Implementasikan encrypted publishing accounts, permission verification, API account, pause per akun, dan migrasi compatibility credential lama tanpa mengekspos token.
- [x] Tahap 3 — Implementasikan media/content preflight, snapshot payload, idempotency key, create/list/detail/cancel/reschedule API, serta audit attempts.
- [x] Tahap 4 — Implementasikan Meta publisher abstraction dan Facebook scheduled draft; buktikan legacy Facebook tetap draft-only.
- [x] Tahap 5 — Implementasikan worker claim, bounded concurrency, retry backoff, stale recovery, `VERIFYING`, health, global pause, dan observability.
- [x] Tahap 6 — Implementasikan UI Publishing Scheduler di Content Flow sesuai mockup: queue, calendar, history, detail, schedule, reschedule, cancel, retry, dan responsive state.
- [x] Tahap 7 — Jalankan pilot Facebook draft pada staging, validasi tidak ada duplicate draft, recovery restart, timezone, log sanitization, dan Content Flow summary sync.
- [x] Tahap 8 — Implementasikan Facebook live di belakang feature flag dan approval eksplisit; jangan aktifkan default.
- [x] Tahap 9 — Implementasikan Instagram image/Reels container, status polling, publish, reconciliation, permission/media validation, dan approval.
- [x] Tahap 10 — Lengkapi SoT/runbook, migration notes, rollback flags, security review, accessibility, integration/regression tests, dan Next.js build.
- [x] Tahap 11 — Review final diff dan acceptance criteria; pastikan tidak ada secret/log/base64/runtime file ikut perubahan.
- [x] Tahap 12 — Setelah seluruh verifikasi berhasil, jalankan release patch non-interaktif sesuai `AGENTS.md`, lalu verifikasi changelog, version, commit, tag, branch `main`, dan push remote.

## 12. Validasi Minimum

### Database dan concurrency

- Dua worker bersamaan hanya dapat mengklaim satu job satu kali.
- Unique idempotency key menolak schedule request duplikat.
- Claim commit sebelum network call.
- Stale job aman direcovery.
- Unknown outcome tidak langsung dipost ulang.
- Semua query memfilter `tenant_id`.

### Credential dan authorization

- Token tersimpan AES-256-GCM dan tidak pernah muncul di API/log/UI.
- Wrong tenant dan unauthorized account menghasilkan 403/404 aman.
- Permission/token expired mengubah account health dan memblokir scheduling.
- Pause akun/global menghentikan claim baru tanpa merusak job.

### Facebook

- Legacy Recipe/Pillar/RE caller tetap menghasilkan draft.
- Scheduled Facebook draft hanya menghasilkan satu draft.
- Text, image, dan video preflight diuji.
- External post/draft ID tersimpan.
- Graph API error diklasifikasikan dan disanitasi.

### Instagram

- Container ID disimpan sebelum polling.
- Container status pending tidak dianggap failure.
- Publish hanya dipanggil setelah container siap.
- Timeout publish masuk `verifying`.
- Image dan Reels constraints diuji.

### UI dan timezone

- Antrean, kalender, riwayat, detail, metrics, dan filter sesuai tenant.
- Jadwal disimpan UTC dan tampil eksplisit di timezone akun/pengguna.
- Reschedule tidak bisa mengubah job processing/published.
- Cancel tidak menghapus audit.
- Status dapat dipahami tanpa hanya mengandalkan warna.
- Layout tetap usable pada desktop dan mobile.

### Regression

- `npm run test:publishing-scheduler`
- test suite existing yang menyentuh scheduler, Content Flow, Recipe Labs, RE, dan Pillar.
- `npm run build`
- staging smoke test dengan worker awalnya disabled.
- `node scripts/test-cluster-health.js` bila inspeksi cluster menjadi bagian tahap verifikasi.

## 13. Acceptance Criteria

- Operator dapat memilih konten selesai dari Content Flow dan membuat jadwal per platform/account.
- Facebook dan Instagram menjadi job independen.
- Dashboard menampilkan queue, calendar, history, detail attempt, dan health.
- Tidak ada dua worker yang memproses job sama.
- Crash/restart tidak menyebabkan publish ulang tanpa rekonsiliasi.
- Credential aman, tenant isolation terbukti, dan log tersanitasi.
- Facebook draft pilot berjalan stabil sebelum live flag tersedia.
- Facebook live dan Instagram tidak aktif default serta memerlukan approval sesuai policy.
- Content Flow menerima status, waktu publish, dan permalink hasil eksternal.
- Dokumentasi SoT, runbook, rollback, tests, build, dan release selesai.

## 14. Rollback

1. Set `ENABLE_PUBLISHING_WORKER=false` lalu restart process yang menjadi worker.
2. Set global publishing control ke paused.
3. Sembunyikan tab UI melalui feature flag bila diperlukan.
4. Jangan drop tabel atau menghapus job/attempt; data tetap tersedia untuk audit.
5. Pertahankan Facebook legacy draft adapter.
6. Setelah perbaikan, lakukan reconciliation terhadap job `processing`, `publishing`, dan `verifying` sebelum worker diaktifkan kembali.

## 15. Catatan Deployment

- Dev: boleh menggunakan `npm run deploy:macmini-dev` setelah verifikasi lokal.
- Staging: gunakan `npm run deploy:staging` sesuai SOP setelah release dan kesiapan pilot.
- Production: dilarang tanpa perintah manual eksplisit pengguna.
- Hindari polling SSH berulang; deployment remote build mengikuti SOP zero-spam repository.

