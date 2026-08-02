# Implementation Plan — MAKNA Headless Content Operator

## 1. Tujuan

Menyediakan jalur resmi untuk membuat konten di MAKNA tanpa mengoperasikan halaman web satu per satu. Codex, automation, atau operator terminal mengirim satu job melalui API/CLI; MAKNA tetap memakai engine Content Planner, Organic Pillar Campaign (OPC), campaign scheduler, TTS, visual generator, FFmpeg, dan sinkronisasi Nextcloud yang sudah ada.

Browser tetap tersedia untuk review visual dan fallback, tetapi bukan lagi satu-satunya pintu masuk.

## 2. Keputusan Arsitektur

### 2.1 Bentuk solusi

- Tambahkan **Operator API v1** di dalam aplikasi Next.js.
- Tambahkan **CLI `makna-operator`** sebagai client HTTP untuk Codex/operator; CLI tidak mengakses database secara langsung.
- API bersifat asynchronous: `POST` membuat job dan segera mengembalikan HTTP `202`.
- Worker operator hanya mengorkestrasi tahap planner dan ingest OPC. Produksi video tetap dikerjakan campaign scheduler yang sudah ada.
- Satu `Idempotency-Key` mewakili satu permintaan, sehingga retry tidak membuat planner/kampanye ganda.
- Autentikasi memakai bearer token khusus operator dan tenant dikunci dari konfigurasi server, bukan dipercaya dari body request.
- Posting sosial media tidak termasuk scope versi pertama. Default `enable_social_post=false`.

### 2.2 Alur runtime

```text
Codex / Terminal / Automation
          |
          | POST /api/operator/v1/content-jobs
          v
Auth + Validation + Idempotency
          |
          v
operator_jobs (queued)
          |
          v
Operator Worker
  1. createDraftContentPlanner()
  2. executeContentPlanner()
  3. ingestPlannerToPillarCampaign()
          |
          v
Existing OPC Campaign Scheduler
  Storyboard -> Approval Gate -> TTS -> Visual -> FFmpeg -> Nextcloud
          |
          v
GET /api/operator/v1/content-jobs/:id
  progress + video_final.mp4 + naskah.md + Nextcloud URL
```

### 2.3 Status job

| Status | Arti |
|---|---|
| `queued` | Permintaan diterima dan menunggu worker operator. |
| `planning` | Draft dan baris Content Planner sedang dibuat. |
| `campaign_queued` | Planner sudah di-ingest ke OPC dan scheduler berjalan. |
| `awaiting_approval` | Storyboard/VO siap direview dan menunggu approval. |
| `producing` | TTS, visual, FFmpeg, atau upload sedang berjalan. |
| `completed` | Seluruh item selesai dan aset final tersedia. |
| `failed` | Salah satu tahap gagal setelah mekanisme retry yang ada selesai. |

## 3. Kontrak API v1

### 3.1 Membuat job

`POST /api/operator/v1/content-jobs`

Headers:

```http
Authorization: Bearer <MAKNA_OPERATOR_API_TOKEN>
Idempotency-Key: nutribake-20260803-batch-001
Content-Type: application/json
```

Contoh payload editorial Nutribake:

```json
{
  "planner": {
    "planner_focus": "brand_editorial",
    "title": "Nutribake Editorial Agustus 2026",
    "account_name": "Nutribake",
    "brand_id": "<brand-profile-id>",
    "brand_context": "Akun edukasi healthy food, baking, dan sistem makan praktis.",
    "content_goal": "Membangun authority, saves, shares, dan kebiasaan mengikuti akun.",
    "target_audience": "Perempuan dan keluarga muda urban usia 25-44 tahun yang ingin makan lebih sehat tanpa proses rumit.",
    "pillars": [
      "Healthy Breakfast",
      "Meal Prep System",
      "Healthy Baking",
      "Healthy Ingredients",
      "Smart Kitchen",
      "Healthy Snacks",
      "Healthy Lifestyle Hacks"
    ],
    "pillar_distribution_mode": "balanced",
    "planner_count": 7,
    "platform": "tiktok"
  },
  "selection": {
    "mode": "all"
  },
  "production": {
    "campaign_name": "Nutribake Organic Batch 001",
    "approval_mode": "storyboard",
    "visual_style": "Cinematic",
    "face_visibility": "Faceless",
    "aspect_ratio": "9:16",
    "target_clips_count": 4,
    "enable_tts": true,
    "enable_glabs": true,
    "enable_ffmpeg": true,
    "enable_social_post": false,
    "upload_markdown": true,
    "nextcloud_parent_folder": "/MAKNA_Assets/Nutribake"
  }
}
```

Response baru:

```json
{
  "success": true,
  "job_id": "opj_...",
  "status": "queued",
  "status_url": "/api/operator/v1/content-jobs/opj_..."
}
```

- Request pertama: HTTP `202`.
- Retry dengan key dan payload sama: mengembalikan job lama, tidak membuat duplikat.
- Key sama dengan payload berbeda: HTTP `409`.

### 3.2 Melihat status

`GET /api/operator/v1/content-jobs/:jobId`

```json
{
  "success": true,
  "job": {
    "id": "opj_...",
    "status": "producing",
    "current_stage": "visuals",
    "planner_id": "cp_...",
    "campaign_id": "opc_...",
    "progress": { "completed_items": 2, "total_items": 7 },
    "items": [
      {
        "id": 101,
        "status": "completed",
        "video_final_path": "/outputs/.../video_final.mp4",
        "nextcloud_url": "http://.../index.php/s/..."
      }
    ]
  }
}
```

GET ini wajib dinamis (`runtime='nodejs'`, `dynamic='force-dynamic'`, `Cache-Control: no-store`) agar status worker tidak tertahan cache.

### 3.3 Approval tanpa browser

`POST /api/operator/v1/content-jobs/:jobId/approve`

```json
{
  "item_ids": [101, 102],
  "mode": "approve_unchanged"
}
```

Endpoint memakai service approval OPC yang sama dengan UI. Versi pertama hanya mendukung `approve_unchanged`; revisi storyboard kompleks tetap bisa dilakukan lewat UI yang sudah ada.

## 4. Validasi dan Guardrail

- `planner` divalidasi memakai contract Content Planner yang sudah ada; aturan product/editorial tidak dibuat ulang.
- `planner_count` dibatasi, awalnya maksimum 30 per job.
- `selection.mode` hanya `all` atau `row_ids`; `row_ids` wajib berasal dari planner yang dibuat job tersebut.
- `approval_mode` hanya `storyboard` atau `none`.
- `enable_social_post` harus `false` pada Operator API v1 untuk memisahkan pembuatan aset dari distribusi sosial.
- Bearer token dibandingkan secara constant-time; token tidak pernah dicatat ke log.
- Tenant berasal dari `MAKNA_OPERATOR_TENANT_ID`, lalu request dijalankan di `tenantContext` yang sesuai.
- API hanya dibuka melalui Tailnet/reverse proxy internal pada fase pilot.
- Semua error eksternal disanitasi di response; detail lengkap tetap masuk server log dan `operator_job_events`.
- Worker mengambil job secara atomik agar dua instance server tidak memproses job yang sama.

## 5. Perubahan File dan Before/After Code

### 5.1 `lib/operator-content-contract.js` — baru

**Code Sebelum (Current/Before)**

```js
// File belum ada. Route harus memahami payload sendiri.
```

**Code Sesudah (Proposed/After)**

```js
export function normalizeOperatorContentRequest(input) {
  const planner = normalizeContentPlannerInput(input?.planner || {});
  const selection = normalizeSelection(input?.selection);
  const production = normalizeProduction(input?.production);
  return { planner, selection, production };
}

export function hashOperatorRequest(payload) {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}
```

Contract ini menjadi satu sumber validasi payload, batas batch, approval mode, dan larangan social posting pada v1.

### 5.2 `lib/operator-auth.js` — baru

**Code Sebelum (Current/Before)**

```js
// Belum ada autentikasi service-to-service khusus operator.
```

**Code Sesudah (Proposed/After)**

```js
export function authenticateOperator(request) {
  const supplied = readBearerToken(request);
  assertConstantTimeMatch(supplied, process.env.MAKNA_OPERATOR_API_TOKEN);
  return { tenantId: process.env.MAKNA_OPERATOR_TENANT_ID || 'default_tenant' };
}

export function runAsOperatorTenant(identity, callback) {
  return tenantContext.run(identity.tenantId, callback);
}
```

### 5.3 `lib/db-pg.js` — migrasi PostgreSQL

**Code Sebelum (Current/Before)**

```js
const migrateContentPlannerDualMode = async () => {
  // migrasi Content Planner yang ada
};
```

**Code Sesudah (Proposed/After)**

```js
const migrateOperatorJobs = async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS operator_jobs (...);`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS
    operator_jobs_tenant_idempotency_uq
    ON operator_jobs (tenant_id, idempotency_key);`);
  await pool.query(`CREATE TABLE IF NOT EXISTS operator_job_events (...);`);
};
```

Kolom utama `operator_jobs`: `id`, `tenant_id`, `idempotency_key`, `request_hash`, `request_json`, `status`, `current_stage`, `planner_id`, `campaign_id`, `result_json`, `error_code`, `error_message`, `locked_at`, `locked_by`, `attempt_count`, `created_at`, dan `updated_at`.

### 5.4 `lib/db.sqlite-backup.js` — parity skema backup

**Code Sebelum (Current/Before)**

```js
// Tidak ada tabel operator_jobs/operator_job_events.
```

**Code Sesudah (Proposed/After)**

```js
db.exec(`
  CREATE TABLE IF NOT EXISTS operator_jobs (...);
  CREATE UNIQUE INDEX IF NOT EXISTS operator_jobs_tenant_idempotency_uq
    ON operator_jobs (tenant_id, idempotency_key);
  CREATE TABLE IF NOT EXISTS operator_job_events (...);
`);
```

Walaupun staging utama memakai PostgreSQL, skema backup dijaga agar kontrak database tidak bercabang.

### 5.5 `lib/db.js` — repository job dan tenant isolation

**Code Sebelum (Current/Before)**

```js
const isolatedTables = [
  'users', 'brand_profiles', 'content_planners', 'pillar_campaigns'
];
```

**Code Sesudah (Proposed/After)**

```js
const isolatedTables = [
  'users', 'brand_profiles', 'content_planners', 'pillar_campaigns',
  'operator_jobs', 'operator_job_events'
];

export async function createOperatorJob(data) { /* idempotent insert */ }
export async function claimNextOperatorJob(workerId) { /* atomic claim */ }
export async function updateOperatorJob(id, updates) { /* allowlist */ }
export async function getOperatorJob(id) { /* tenant scoped */ }
export async function appendOperatorJobEvent(jobId, event) { /* audit */ }
```

Claim PostgreSQL memakai transaksi/row lock (`FOR UPDATE SKIP LOCKED`) melalui helper khusus, bukan pola select-then-update yang race-prone.

### 5.6 `lib/pillar-campaign-ingest.js` — ekstraksi logic OPC

**Code Sebelum (Current/Before)**

```js
// Seluruh fetch planner, mapping campaign, insert item, dan start scheduler
// berada langsung di POST route ingest-planner.
```

**Code Sesudah (Proposed/After)**

```js
export async function ingestPlannerToPillarCampaign({
  plannerId,
  selectedRowIds = [],
  campaignName,
  globalSettings = {}
}) {
  // memakai createPillarCampaign/createPillarCampaignItem yang sudah ada
  return { campaignId, campaignName: finalName, ingestedCount, status };
}
```

Refactor ini tidak mengubah rules editorial, product bridging, narasi, atau scheduler; hanya memindahkan business logic agar UI route dan Operator API memakai fungsi yang sama.

### 5.7 `app/api/v2/pillar-campaigns/ingest-planner/route.js` — adapter route lama

**Code Sebelum (Current/Before)**

```js
export async function POST(request) {
  // sekitar 200 baris business logic ingest
}
```

**Code Sesudah (Proposed/After)**

```js
export async function POST(request) {
  try {
    const body = await request.json();
    const result = await ingestPlannerToPillarCampaign(mapHttpBody(body));
    return NextResponse.json({ success: true, ...toHttpResult(result) });
  } catch (error) {
    return toIngestErrorResponse(error);
  }
}
```

Kontrak response route lama dipertahankan untuk mencegah regresi UI.

### 5.8 `lib/pillar-campaign-approval.js` — ekstraksi approval OPC

**Code Sebelum (Current/Before)**

```js
// Mapping storyboard, VO, campaign settings, dan status produksi berada
// langsung di route items/[itemId]/approve.
```

**Code Sesudah (Proposed/After)**

```js
export async function approvePillarCampaignItem(itemId, changes) {
  const normalized = normalizeApprovalPayload(changes);
  // simpan plan/DNA, update campaign, lanjutkan workflow_status
  return { itemId, workflowStatus: 'production_processing' };
}

export async function approvePillarCampaignItemUnchanged(itemId) {
  const draft = await loadGeneratedDraft(itemId);
  return approvePillarCampaignItem(itemId, draft);
}
```

### 5.9 `app/api/v2/pillar-campaigns/items/[itemId]/approve/route.js` — adapter approval lama

**Code Sebelum (Current/Before)**

```js
export async function POST(req, { params }) {
  // business logic approval lengkap berada di route
}
```

**Code Sesudah (Proposed/After)**

```js
export async function POST(req, { params }) {
  const { itemId } = await params;
  const result = await approvePillarCampaignItem(itemId, await req.json());
  return NextResponse.json({ success: true, ...result });
}
```

### 5.10 `lib/operator-content-worker.js` — worker orkestrasi baru

**Code Sebelum (Current/Before)**

```js
// Belum ada worker yang menghubungkan planner -> OPC sebagai satu job.
```

**Code Sesudah (Proposed/After)**

```js
export function startOperatorContentWorker() {
  return startSingletonInterval('operator-content', async () => {
    const job = await claimNextOperatorJob(workerId);
    if (job) await processOperatorContentJob(job);
    await reconcileActiveOperatorJobs();
  });
}

async function processOperatorContentJob(job) {
  const draft = await createDraftContentPlanner(job.request.planner);
  await executeContentPlanner(draft.planner_id);
  const campaign = await ingestPlannerToPillarCampaign(toIngestInput(job));
  await attachPlannerAndCampaign(job.id, draft.planner_id, campaign.campaignId);
}
```

Worker memiliki lock, timeout lock, retry terbatas hanya untuk tahap orkestrasi, dan resume berdasarkan `planner_id`/`campaign_id` agar restart server tidak membuat data ganda.

### 5.11 `instrumentation.js` — boot worker

**Code Sebelum (Current/Before)**

```js
if (backgroundServicesEnabled && campaignSchedulerEnabled) {
  startCampaignScheduler();
}
```

**Code Sesudah (Proposed/After)**

```js
if (backgroundServicesEnabled && process.env.ENABLE_OPERATOR_WORKER !== 'false') {
  const { startOperatorContentWorker } = await import('./lib/operator-content-worker.js');
  startOperatorContentWorker();
}
```

Worker hanya berjalan di runtime Node.js dan mengikuti master switch background service yang sudah ada.

### 5.12 `app/api/operator/v1/content-jobs/route.js` — create endpoint baru

**Code Sebelum (Current/Before)**

```js
// Endpoint belum ada.
```

**Code Sesudah (Proposed/After)**

```js
export const runtime = 'nodejs';

export async function POST(request) {
  const identity = authenticateOperator(request);
  return runAsOperatorTenant(identity, async () => {
    const payload = normalizeOperatorContentRequest(await request.json());
    const job = await createIdempotentOperatorJob({
      key: requireIdempotencyKey(request),
      payload
    });
    return NextResponse.json(toAcceptedResponse(job), { status: job.created ? 202 : 200 });
  });
}
```

### 5.13 `app/api/operator/v1/content-jobs/[jobId]/route.js` — status endpoint baru

**Code Sebelum (Current/Before)**

```js
// Endpoint belum ada.
```

**Code Sesudah (Proposed/After)**

```js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const identity = authenticateOperator(request);
  const { jobId } = await params;
  return runAsOperatorTenant(identity, async () =>
    noStoreJson(await getOperatorJobStatus(jobId))
  );
}
```

Status aggregator membaca status item OPC yang sudah ada dan mengembalikan stage, progress, error ringkas, `ffmpeg_output_path`, `drive_link`/Nextcloud URL, dan caption dari `result_json`.

### 5.14 `app/api/operator/v1/content-jobs/[jobId]/approve/route.js` — approval endpoint baru

**Code Sebelum (Current/Before)**

```js
// Endpoint belum ada.
```

**Code Sesudah (Proposed/After)**

```js
export async function POST(request, { params }) {
  const identity = authenticateOperator(request);
  const { jobId } = await params;
  const command = normalizeOperatorApproval(await request.json());
  return runAsOperatorTenant(identity, async () => {
    const result = await approveOperatorJobItems(jobId, command);
    return NextResponse.json({ success: true, ...result });
  });
}
```

### 5.15 `scripts/makna-operator.mjs` — CLI baru

**Code Sebelum (Current/Before)**

```js
// Belum ada client headless untuk MAKNA content production.
```

**Code Sesudah (Proposed/After)**

```js
// create --file request.json [--wait]
// status <job-id> [--watch]
// approve <job-id> [--all|--items 101,102]

const client = new MaknaOperatorClient({
  baseUrl: process.env.MAKNA_OPERATOR_BASE_URL,
  token: process.env.MAKNA_OPERATOR_API_TOKEN
});
```

CLI menampilkan ringkasan progress, memakai exponential backoff untuk `--watch`, tidak mencetak token, dan keluar dengan exit code non-zero jika job gagal.

### 5.16 `scripts/test-operator-content.mjs` — test contract dan orchestration baru

**Code Sebelum (Current/Before)**

```js
// Belum ada regression test Operator API.
```

**Code Sesudah (Proposed/After)**

```js
await testUnauthorizedRequest();
await testInvalidEditorialPayload();
await testIdempotentCreate();
await testIdempotencyConflict();
await testTenantIsolation();
await testPlannerToOpcOrchestration();
await testApprovalUnchanged();
await testStatusAggregation();
await testRestartResumeWithoutDuplication();
```

Test AI/visual berat menggunakan stubs/fixtures; smoke test staging terpisah memakai satu item nyata.

### 5.17 `package.json` — command operator dan test

**Code Sebelum (Current/Before)**

```json
{
  "scripts": {
    "test:content-planner": "node scripts/test-content-planner-modes.mjs"
  }
}
```

**Code Sesudah (Proposed/After)**

```json
{
  "scripts": {
    "operator": "node scripts/makna-operator.mjs",
    "test:operator-content": "node scripts/test-operator-content.mjs"
  }
}
```

Script yang sudah ada tetap dipertahankan; snippet hanya menunjukkan penambahan.

### 5.18 `.env.staging.local.example` — konfigurasi contoh

**Code Sebelum (Current/Before)**

```dotenv
# Belum ada konfigurasi Operator API.
```

**Code Sesudah (Proposed/After)**

```dotenv
MAKNA_OPERATOR_API_TOKEN=replace-with-long-random-secret
MAKNA_OPERATOR_TENANT_ID=default_tenant
MAKNA_OPERATOR_BASE_URL=http://127.0.0.1:5010
ENABLE_OPERATOR_WORKER=true
OPERATOR_WORKER_INTERVAL_MS=3000
OPERATOR_JOB_LOCK_TIMEOUT_MS=300000
```

Token nyata hanya berada di `.env.staging.local`/secret manager dan tidak masuk Git.

### 5.19 `sot/global/operator-api.md` — dokumentasi operasional baru

**Code Sebelum (Current/Before)**

```md
Dokumentasi Operator API belum ada.
```

**Code Sesudah (Proposed/After)**

```md
# MAKNA Operator API v1

## Authentication
## Create Content Job
## Inspect Progress
## Approve Storyboard
## CLI Usage
## Error Codes and Recovery
## Security and Token Rotation
```

### 5.20 `middleware.js` — delegasi auth Operator API

**Code Sebelum (Current/Before)**

```js
if (!sessionToken && pathname.startsWith('/api/')) {
  return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
}
```

**Code Sesudah (Proposed/After)**

```js
if (pathname.startsWith('/api/operator/v1/')) {
  return NextResponse.next(); // route memvalidasi bearer token operator
}
```

Pengecualian hanya melewati session-cookie middleware. Semua route Operator v1 tetap menolak request tanpa bearer token melalui `operator-auth.js`.

### 5.21 `lib/db.js` — perbaikan helper tanggal API key pool

**Code Sebelum (Current/Before)**

```js
export async function getAllApiKeys() {
  const today = getTodayStr(); // helper tidak tersedia pada adapter PostgreSQL
}
```

**Code Sesudah (Proposed/After)**

```js
function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}
```

Smoke test Operator menemukan helper yang hanya ada pada SQLite backup. Penambahan parity ini mencegah `ReferenceError` saat Content Planner mengakses Gemini key pool pada PostgreSQL.

## 6. Tahapan Rilis

### Phase 1 — MVP internal

- Operator API create/status.
- Idempotency dan tenant isolation.
- Worker planner -> OPC.
- CLI create/status/watch.
- Approval mode `none` untuk smoke test dan `storyboard` untuk pilot aman.

### Phase 2 — Headless approval

- Ekstraksi service approval.
- Endpoint/CLI `approve_unchanged`.
- Audit event approval.

### Phase 3 — Hardening

- Token rotation/multiple service identities bila diperlukan.
- Rate limiting di reverse proxy.
- Dashboard read-only untuk job operator bila volume penggunaan meningkat.
- Webhook completion opsional agar automation tidak perlu polling.

## 7. Strategi Pengujian

1. **Contract tests**: payload valid/invalid, batas batch, mode editorial/product.
2. **Security tests**: tanpa token, token salah, tenant berbeda, token tidak bocor di log.
3. **Idempotency tests**: retry identik, conflict payload, concurrent duplicate request.
4. **Repository tests**: atomic claim, stale lock recovery, event ordering.
5. **Regression tests**: UI Content Planner dan route ingest/approval lama menghasilkan kontrak response yang sama.
6. **Worker tests**: restart setelah planner dibuat dan setelah campaign dibuat tidak menduplikasi data.
7. **Status tests**: setiap kombinasi status OPC dipetakan benar ke status job.
8. **Build verification**: test Content Planner lama, test operator, dan `npm run build`.
9. **Staging smoke test**: satu planner editorial Nutribake berisi satu item sampai `video_final.mp4` dan `naskah.md` tersinkron ke Nextcloud; social posting tetap mati.

## 8. Acceptance Criteria

- Satu perintah CLI dapat membuat job content production tanpa membuka browser.
- Request langsung menerima `job_id`; proses panjang tidak menahan koneksi HTTP.
- Retry request tidak membuat planner, campaign, atau item ganda.
- Job dapat dilanjutkan dengan aman setelah restart server.
- Status menunjukkan tahap dan progress per item serta error yang actionable.
- Pilot dengan approval mode berhenti setelah storyboard siap dan hanya lanjut setelah approval.
- Output selesai memperlihatkan path/link aset final dan caption/naskah.
- Route UI Content Planner, ingest OPC, dan approval lama tetap berfungsi.
- API tidak dapat diakses tanpa token dan tidak dapat melintasi tenant.
- Operator API v1 tidak memposting ke sosial media.

## 9. Execution Task List

Checklist ini wajib diperbarui real-time saat eksekusi dimulai.

- [x] Bekukan kontrak request/response/error Operator API v1 dan fixture Nutribake.
- [x] Tambahkan contract normalizer, stable request hash, dan unit test validasi.
- [x] Tambahkan bearer auth constant-time, tenant binding, dan security tests.
- [x] Tambahkan skema `operator_jobs`/`operator_job_events` pada PostgreSQL dan SQLite backup.
- [x] Tambahkan repository job, atomic claim, idempotency, audit event, dan stale-lock recovery.
- [x] Ekstrak business logic ingest planner ke `lib/pillar-campaign-ingest.js` tanpa mengubah kontrak route lama.
- [x] Implementasikan worker planner -> execute -> OPC beserta restart-safe checkpoints.
- [x] Boot worker melalui `instrumentation.js` dengan environment guard.
- [x] Implementasikan `POST /api/operator/v1/content-jobs`.
- [x] Implementasikan `GET /api/operator/v1/content-jobs/[jobId]` dan status aggregator no-store.
- [x] Delegasikan `/api/operator/v1/*` dari session middleware ke bearer auth Operator API.
- [x] Perbaiki parity helper tanggal Gemini key pool pada adapter PostgreSQL.
- [x] Implementasikan CLI `create`, `status`, dan `--watch`.
- [x] Jalankan regression test route Content Planner/ingest lama.
- [x] Ekstrak business logic approval OPC tanpa mengubah kontrak UI lama.
- [x] Implementasikan approval endpoint dan CLI `approve`.
- [x] Tambahkan dokumentasi SOT dan contoh environment tanpa secret nyata.
- [x] Jalankan `npm run test:content-planner` dan `npm run test:operator-content`.
- [x] Jalankan `npm run build` dan perbaiki seluruh error build yang terkait perubahan.
- [ ] Jalankan smoke test staging satu item Nutribake hingga output Nextcloud, tanpa social posting.
- [x] Perbarui seluruh checkbox sesuai hasil eksekusi dan catat bukti verifikasi.
- [x] Jalankan rilis patch non-interaktif, verifikasi changelog, tag, branch `main`, dan remote GitHub.

## 10. Verification Evidence

- `npm run test:content-planner`: lulus.
- `npm run test:operator-content`: lulus.
- `npm run build`: lulus; warning lama repository tetap tercatat dan tidak berasal dari Operator API.
- Staging migration: tabel `operator_jobs` dan `operator_job_events` berhasil dibuat pada PostgreSQL lokal.
- HTTP auth smoke: tanpa token menghasilkan `401 OPERATOR_UNAUTHORIZED`.
- HTTP validation smoke: payload tidak valid menghasilkan `400 CONTENT_PLANNER_VALIDATION`.
- HTTP idempotency smoke: retry payload identik mengembalikan job yang sama dengan `reused=true`.
- HTTP conflict smoke: key sama dan payload berbeda menghasilkan `409 OPERATOR_IDEMPOTENCY_CONFLICT`.
- Job smoke Nutribake: job `opj_eefda0b99f234a01` diterima dan diklaim worker, lalu gagal di tahap AI karena API key staging tidak valid/kuota tidak tersedia.
- Output `video_final.mp4`/Nextcloud belum dapat diverifikasi karena staging belum memiliki Brand Profile Nutribake, konfigurasi Nextcloud/G-Labs, dan Gemini key valid.

## 11. Risiko dan Mitigasi

| Risiko | Mitigasi |
|---|---|
| Dua instance mengklaim job yang sama | Atomic claim dengan `FOR UPDATE SKIP LOCKED`, lock owner, dan unique idempotency index. |
| Server restart di tengah orkestrasi | Simpan checkpoint `planner_id` dan `campaign_id`; worker selalu resume, bukan mengulang tahap selesai. |
| Perubahan refactor merusak UI lama | Route lama menjadi adapter tipis dengan response contract tetap dan regression test. |
| API internal terekspos | Bearer token, tenant binding, Tailnet/reverse-proxy allowlist, token rotation, tanpa CORS publik. |
| Approval tanpa browser melewatkan review | Default pilot `approval_mode=storyboard`; `approve_unchanged` eksplisit dan tercatat di audit event. |
| Job status tidak sinkron dengan worker video | Status aggregator membaca tabel OPC sebagai source of truth, bukan menyimpan salinan semua status. |
| Pembuatan dan posting sosial tercampur | `enable_social_post=false` dipaksa pada v1; distribusi sosial tetap workflow terpisah. |

## 12. Estimasi Implementasi

- Phase 1 MVP internal: 2–3 hari kerja efektif.
- Phase 2 headless approval: 1 hari kerja.
- Phase 3 hardening dan smoke test produksi: 1–2 hari kerja.

Estimasi dapat berubah terutama karena durasi smoke test AI/video dan kondisi worker eksternal, bukan karena endpoint API-nya.
