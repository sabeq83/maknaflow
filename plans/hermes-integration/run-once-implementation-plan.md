# Implementation Plan — Hermes Run-Once Content Campaign

## 1. Problem

Perintah berikut belum memiliki jalur API yang lengkap:

> Buat satu kali campaign produk, riset tren, buat N video dengan preset tertentu, manual review setelah start frame, draft_only, lalu jalankan sekarang.

Endpoint Operator saat ini hanya membuat schedule. Endpoint session-authenticated `run-now` langsung membuat Operator Job dan melewati jalur riset Hermes. Skill kemudian mencoba membaca `.env`, source code, PM2, dan port lain. Perilaku tersebut salah dan harus fail-fast.

## 2. Outcome

Hermes dapat:

1. resolve brand, produk, dan preset melalui satu katalog resmi;
2. menampilkan konfirmasi;
3. membuat one-time execution melalui satu POST idempotent;
4. menerima `run_id` dalam target maksimal 2 detik;
5. menyerahkan riset dan produksi ke worker background;
6. memantau status melalui satu GET bounded;
7. berhenti pada manual review dan tidak membuat publishing intent/job untuk `draft_only`.

Hermes dilarang membaca filesystem MAKNA, `.env`, source code, database, PM2, atau mencoba port alternatif.

## 3. Canonical User Request

```text
Buat satu kali campaign untuk produk Rolled Oat Premium Sahabat, brand profile dapurbotani.
Riset tren terbaru, buat 6 video memakai preset dapurbotani_kampanye_produk_4_klip.
Manual review setelah start frame. draft_only. Jalankan sekarang.
```

Normalized request:

```json
{
  "mode": "run_once",
  "name": "Rolled Oat Premium Sahabat — One Time",
  "brand_profile_id": "<resolved-id>",
  "product_id": "<resolved-id>",
  "preset_key": "dapurbotani_kampanye_produk_4_klip",
  "video_count": 6,
  "platform": "tiktok",
  "research": {
    "query": "Tren terbaru yang relevan untuk Rolled Oat Premium Sahabat dan target konsumennya",
    "locale": "id-ID",
    "max_research_age_hours": 24,
    "source_policy": "primary_and_reputable"
  },
  "review_mode": "start_frames",
  "publishing_policy": { "mode": "draft_only" }
}
```

Jumlah video tidak hardcoded. Untuk Product Campaign, jumlah harus mengikuti siklus yang didukung MAKNA: 6, 12, 18, 24, atau 30.

## 4. Architecture

```text
Hermes chat
  -> GET content-catalog
  -> POST content-runs (fast enqueue)
  <- 202 {run_id,status,status_url}
  -> GET content-runs/{run_id} (bounded monitoring)

Background:
content automation worker
  -> create agent run
  -> agent worker calls Hermes Runs API for research
  -> research callback
  -> Operator Planner/OPC
  -> start-frame checkpoint
  -> manual review
  -> production
  -> ContentFlow
  -> stop (draft_only)
```

Tidak ada request HTTP yang menunggu riset atau produksi selesai.

## 5. State Model

Public bounded states:

```text
queued
research_queued
researching
planning
generating_start_frames
awaiting_manual_review
producing
syncing_contentflow
completed_draft
retry_wait
failed
cancelled
```

Response status harus memiliki `stage`, `progress` berbasis item nyata bila tersedia, `action_required`, dan URL review. Jangan mengarang persentase.

## 6. API Contract

### Catalog

```http
GET /api/operator/v2/content-catalog?brand=dapurbotani&product=Rolled%20Oat&preset=dapurbotani_kampanye_produk_4_klip
Scope: automation:read
```

Response hanya identifier dan metadata aman. Exact-match case-insensitive hanya boleh dipilih otomatis jika tepat satu hasil. Nol atau lebih dari satu hasil harus menghasilkan kandidat, bukan tebakan.

### Create one-time run

```http
POST /api/operator/v2/content-runs
Scope: automation:write
Idempotency-Key: hermes:<conversation-id>:<request-id>
```

Success:

```json
{
  "success": true,
  "run_id": "car_xxx",
  "agent_run_id": "aar_xxx",
  "status": "research_queued",
  "status_url": "/api/operator/v2/content-runs/car_xxx",
  "review_url": "/content-automations?run=car_xxx",
  "replayed": false
}
```

Return `202` paling lambat 2 detik setelah durable enqueue. API tidak boleh memanggil Hermes, Gemini, G-Labs, FFmpeg, Repliz, atau menunggu worker.

### Read status

```http
GET /api/operator/v2/content-runs/{run_id}
Scope: automation:read
```

Response bounded:

```json
{
  "run_id": "car_xxx",
  "status": "awaiting_manual_review",
  "stage": "start_frames",
  "items": { "total": 6, "ready": 6, "failed": 0 },
  "action_required": "Review start frames in MAKNA",
  "review_url": "/content-automations?run=car_xxx",
  "publishing_mode": "draft_only"
}
```

Jangan mengembalikan raw prompt, token, research callback, environment, stack trace, atau credential.

## 7. Durable Run-Once Semantics

- Buat definition/schedule internal berstatus `paused` dengan `execution_mode=run_once`; ia tidak pernah memperoleh recurring `next_run_at` aktif.
- Buat satu run `queued` secara atomic dengan schedule/definition tersebut.
- Worker boleh claim queued run-once walau definition paused.
- Retry tetap memakai run dan idempotency key yang sama.
- Setelah terminal, definition ditandai `completed`/archived sesuai retention tanpa menjadwalkan occurrence baru.
- Same key + same canonical body me-replay run yang sama.
- Same key + different body menghasilkan `409 IDEMPOTENCY_CONFLICT`.
- Jangan memakai nama campaign sebagai idempotency key.

## 8. Research and Production Correctness

- One-time run dengan `research` wajib membuat `agent_automation_run`; tidak boleh langsung membuat Operator Job.
- Agent worker mengirim research task ke Hermes melalui Runs API.
- Setelah callback tervalidasi, baru buat Operator Job dengan immutable research revision.
- `video_count` harus diteruskan sebagai `planner_count` dan `research.production_count`; `selection.mode=all` untuk N > 1.
- `review_mode=start_frames` harus menjadi `approval_mode=start_frames` dan berhenti sebelum TTS/produksi lanjutan sampai approval manusia.
- `draft_only` tidak boleh membuat `agent_publishing_intents`, `publishing_jobs`, atau panggilan Repliz.

## 9. Fail-Fast Hermes Rules

Skill wajib menggunakan hanya:

- `MAKNA_OPERATOR_BASE_URL` dari environment;
- catalog endpoint;
- content-runs create/status endpoint.

Jika whoami/catalog/create gagal:

- maksimal satu retry untuk network timeout/502/503/504 dengan key sama;
- total waktu create maksimal 30 detik;
- tampilkan code/status aman dan berhenti;
- jangan membaca `.env`, repository, route file, plan file, PM2, database, process list, atau mencoba `localhost:7020`/port lain;
- jangan memakai terminal untuk discovery;
- jangan mengatakan campaign dibuat tanpa `run_id` dari server.

Monitoring tidak boleh membuat chat blocking panjang. Setelah menerima run ID, Hermes melaporkan pekerjaan berjalan background. Poll hanya ketika pengguna meminta status atau memakai interval bounded maksimal 30–60 detik dengan batas percobaan.

## 10. Error Codes

- `CATALOG_AMBIGUOUS`
- `BRAND_NOT_FOUND`
- `PRODUCT_NOT_FOUND`
- `PRESET_NOT_FOUND`
- `PRESET_CAMPAIGN_KIND_MISMATCH`
- `VIDEO_COUNT_INVALID`
- `RUN_ONCE_DISABLED`
- `IDEMPOTENCY_KEY_REQUIRED`
- `IDEMPOTENCY_CONFLICT`
- `RUN_ENQUEUE_FAILED`
- `RUN_NOT_FOUND`
- `HERMES_RESEARCH_UNAVAILABLE`
- `MANUAL_REVIEW_REQUIRED`

5xx response harus generik dan tersanitasi; detail bounded disimpan internal.

## 11. File-by-File Changes

### `lib/db-pg.js`

Code Sebelum (Current/Before):

```js
// content automation schedule/run belum membedakan recurring dan run_once secara eksplisit.
```

Code Sesudah (Proposed/After):

```js
ALTER TABLE content_automation_schedules ADD COLUMN IF NOT EXISTS execution_mode TEXT DEFAULT 'recurring';
ALTER TABLE content_automation_runs ADD COLUMN IF NOT EXISTS request_sha256 TEXT;
// constraints/index untuk idempotent one-time execution
```

### `[NEW] lib/content-run-contract.js`

Code Sebelum (Current/Before):

```js
// Belum ada contract ringkas run_once berbasis IDs.
```

Code Sesudah (Proposed/After):

```js
export function normalizeContentRunRequest(input) { /* IDs, count, preset, research, review, draft */ }
export function hashContentRunRequest(input) { /* canonical SHA-256 */ }
```

### `[NEW] lib/content-run-service.js`

Code Sebelum (Current/Before):

```js
// Existing run-now melakukan snapshot dan membuat Operator Job di request thread.
```

Code Sesudah (Proposed/After):

```js
export async function enqueueRunOnce(input, identity, idempotencyKey) {
  // validate catalog relations, create paused run_once definition + queued run atomically
}
```

### `lib/content-automation-repository.js`

Code Sebelum (Current/Before):

```js
WHERE ((s.status='active' AND r.status='queued') OR retry_wait...)
```

Code Sesudah (Proposed/After):

```js
WHERE (((s.status='active' OR s.execution_mode='run_once') AND r.status='queued') OR retry_wait...)
// add createRunOnceIdempotent transaction and terminal cleanup
```

### `lib/content-automation-worker.js`

Code Sebelum (Current/Before):

```js
// dispatch contains correct research branch, but run-now session route bypasses it.
```

Code Sesudah (Proposed/After):

```js
// run_once is claimed by worker and uses the same research-first dispatch path.
// terminal run_once never advances or reactivates recurring schedule.
```

### `lib/agent-automation-worker.js`

Code Sebelum (Current/Before):

```js
// Reconciliation exists, but status response and run-once lifecycle are incomplete.
```

Code Sesudah (Proposed/After):

```js
// reconcile N items, manual review stage, completed_draft, and bounded error state.
```

### `[NEW] app/api/operator/v2/content-catalog/route.js`

Code Sebelum (Current/Before):

```js
// Existing content-automations/catalog accepts generic search and returns separate lists.
```

Code Sesudah (Proposed/After):

```js
authenticateOperator(request, 'automation:read');
// resolve filtered brand/product/preset compatibility and bounded candidates
```

### `[NEW] app/api/operator/v2/content-runs/route.js`

Code Sebelum (Current/Before):

```js
// Belum ada Operator run_once enqueue endpoint.
```

Code Sesudah (Proposed/After):

```js
authenticateOperator(request, 'automation:write');
require Idempotency-Key;
return 202 enqueueRunOnce(...);
```

### `[NEW] app/api/operator/v2/content-runs/[id]/route.js`

Code Sebelum (Current/Before):

```js
// Belum ada bounded one-time status endpoint.
```

Code Sesudah (Proposed/After):

```js
authenticateOperator(request, 'automation:read');
return buildBoundedContentRunStatus(id);
```

### `app/api/v2/content-automations/[id]/run-now/route.js`

Code Sebelum (Current/Before):

```js
const job = await createOperatorJobFromRequest(...); // bypass research branch
```

Code Sesudah (Proposed/After):

```js
// delegate to shared durable enqueue/worker flow; preserve session auth and response compatibility
```

### `plugins/makna-hermes/skills/makna-content-orchestrator/SKILL.md`

Code Sebelum (Current/Before):

```md
Create schedule through API; no exact run_once/fail-fast procedure.
```

Code Sesudah (Proposed/After):

```md
Resolve catalog -> confirm -> POST content-runs -> return run_id -> bounded status.
Never inspect filesystem, env files, code, DB, PM2, or alternate ports.
```

### `plugins/makna-hermes/skills/makna-content-orchestrator/references/operator-api.md`

Code Sebelum (Current/Before):

```md
Only schedule creation is documented.
```

Code Sesudah (Proposed/After):

```md
Document exact catalog, run create/status payloads, timeouts, retry, and error codes.
```

### `tests/content-run-once.test.js`

Code Sebelum (Current/Before):

```js
// No run_once contract/idempotency/fail-fast tests.
```

Code Sesudah (Proposed/After):

```js
test('enqueue returns run_id without executing research inline', ...);
test('run_once research creates agent run before operator job', ...);
test('draft_only creates no publishing intent or job', ...);
```

## 12. Test Matrix

- Exact catalog resolution for brand/product/custom preset compatibility.
- Ambiguous and missing catalog results fail before mutation.
- Valid counts 6/12/18/24/30; invalid counts rejected.
- Create returns `202 + run_id` without network call to Hermes/Gemini/Repliz.
- Same key/body returns same IDs; different body returns 409.
- Concurrent create requests yield one definition, one content run, one agent run.
- Worker claims paused `run_once` exactly once.
- Research branch creates Agent Run and does not create Operator Job before callback.
- Six-video request reaches planner count six and selection all.
- Start-frame mode reaches manual review and stops.
- `draft_only` produces zero publishing intents/jobs/Repliz calls.
- Status is tenant-scoped, bounded, redacted, and accurate.
- Timeout/unavailable API causes Hermes fail-fast behavior in skill tests/static assertions.
- Existing recurring schedule and session run-now regression tests pass.

Commands:

```bash
node --test tests/content-run-once.test.js tests/agent-automation.test.js tests/hermes-client.test.js
npm run test:content-automation
npm run test:operator-content
npm run build
```

## 13. Rollout

1. Deploy Dev with `ENABLE_HERMES_RUN_ONCE=false`.
2. Verify endpoint returns disabled/unauthorized/wrong-scope safely.
3. Verify Hermes environment contains only correct base URL `http://127.0.0.1:5020`; never log token.
4. Enable run-once in Dev while `ENABLE_AGENT_AUTOMATION_WORKER=false`; create one request and prove durable queued state plus fast response.
5. Configure and health-check Hermes Runs API/callback signing separately.
6. Enable Agent Automation Worker for Dev pilot.
7. Run one `draft_only` smoke for the specified product/preset.
8. Confirm run ID returned quickly, research dispatched once, six items reach manual review, and publishing job count remains zero.
9. Staging requires separate permission. Production deployment is prohibited without explicit instruction.

## Execution Task List

- [x] Audit existing session `run-now`, content worker research branch, agent worker, and DB constraints.
- [x] Freeze run-once contract, state mapping, idempotency, latency budget, and error taxonomy.
- [x] Add Before/After snippets for any additional file discovered during audit before editing it.
- [x] Implement idempotent DB migration for `execution_mode` and run request hash.
- [x] Implement canonical run-once contract and product count rules.
- [x] Implement atomic enqueue service/repository with paused non-recurring definition.
- [x] Modify worker claim so queued run-once is processed exactly once.
- [x] Route all research-enabled run-now requests through Agent Run before Operator Job.
- [x] Implement filtered catalog endpoint with preset compatibility.
- [x] Implement Operator create/status endpoints with scopes, redaction, and no-store.
- [x] Refactor session run-now to shared background path without breaking compatibility.
- [x] Update Hermes skill and API reference with exact 5020 route and fail-fast prohibitions.
- [x] Add unit, concurrency, authorization, latency, and regression tests.
- [x] Run all listed tests and build; fix failures rather than weakening assertions.
- [x] Deploy Dev with run-once and workers off; verify safe disabled behavior.
- [x] Configure/verify Hermes Runs API and signed callbacks without exposing secrets.
- [x] Enable Dev pilot and run exactly one `draft_only` smoke.
- [x] Prove fast `run_id`, correct N items/manual review, and zero publishing jobs.
- [x] Confirm no Staging/Production deployment and no auto-publish change.
- [x] Release patch, push branch/tag, verify remote and clean worktree.

## 14. Definition of Done

- Hermes completes catalog resolution and enqueue in seconds, not minutes.
- The user receives a durable run ID immediately and production continues in background.
- One-time execution never becomes recurring.
- Research happens before planning/production.
- Manual start-frame review blocks further production as configured.
- `draft_only` cannot create a social publishing job.
- Hermes fails fast instead of inspecting filesystem, code, env, processes, DB, or alternate ports.
- Retry and concurrency create no duplicate campaign/run/job.
- Dev smoke evidence exists without secrets; Production remains untouched.
