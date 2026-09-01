# Implementation Plan — Publish Approved Campaign

## 1. Outcome

Tambahkan kemampuan agar pengguna dapat berkata kepada Hermes:

> N video campaign X sudah saya review dan setujui. Siapkan posting melalui MAKNA ke TikTok akun Y. Jadwalkan 2 video per hari pukul 10.00 dan 18.00 WIB mulai 10 September 2026. Jangan ubah video atau caption. Tampilkan ringkasan dan minta konfirmasi terakhir.

Hermes hanya membuat publishing plan. MAKNA memverifikasi seluruh video yang dipilih benar-benar approved, menampilkan preview final, menerima approval manusia di UI, lalu membuat tepat N Publishing Jobs untuk N video yang dipilih. Hermes tidak menerima credential Repliz dan tidak dapat menyetujui plan miliknya sendiri.

## 2. Safety Boundary

- MAKNA tetap system of record dan schedule authority.
- Hanya video final yang linked ke campaign, berstatus approved, mempunyai media HTTPS, dan belum memiliki active publishing job yang dapat dipilih.
- Satu video menghasilkan satu slot per target account.
- Permanent token Hermes hanya mendapat `publishing:read` dan `publishing:plan`, bukan `publishing:approve`.
- Approval final dilakukan pengguna terautentikasi di MAKNA UI terhadap exact `plan_sha256`.
- Pembuatan job wajib idempotent dan transactional; retry tidak boleh menggandakan posting.
- Tidak ada panggilan langsung dari Hermes ke Repliz.
- Production deployment dan `auto_publish` di luar scope.

## 3. User Flow

1. Pengguna menyelesaikan manual review N video di MAKNA.
2. Pengguna meminta Hermes menjadwalkan campaign, menyebut campaign/run, jumlah atau subset video, platform, account, tanggal mulai, jumlah video per hari, daftar jam, timezone, dan cadence.
3. Hermes mencari campaign dan account melalui Operator API read-only.
4. Hermes meminta preview, lalu menunjukkan seluruh video terpilih dan setiap slot tanggal/jam.
5. Setelah konfirmasi percakapan, Hermes membuat batch berstatus `pending_approval`; belum ada Publishing Job.
6. Hermes memberikan link MAKNA: `/content-flow?publishing_batch=<batch_id>`.
7. Pengguna login ke MAKNA, memeriksa exact revision, lalu klik Approve & Schedule.
8. MAKNA membuat tepat satu job `scheduled/approved` per video secara idempotent.
9. Publishing worker mengirim ke Repliz ketika slot jatuh tempo dan merekonsiliasi status/permalink.

## 4. State Machine

```text
draft -> pending_approval -> approved -> dispatching -> scheduled
  |            |               |             |
cancelled   rejected        cancelled      partial_failure
scheduled -> publishing -> published | failed | verification_required
```

Batch tidak boleh berubah setelah `pending_approval`. Perubahan caption, urutan, account, atau waktu harus membuat revision baru dan membatalkan approval lama.

## 5. API Contract

### Natural-language parsing

Skill harus membedakan tiga nilai berikut:

- `selected_video_count`: total video campaign/subset yang akan dijadwalkan;
- `videos_per_day`: jumlah posting setiap hari;
- `publish_times`: daftar jam dalam satu hari.

Untuk kalimat “N video campaign sudah disetujui; jadwalkan 2 video per hari pukul 10.00 dan 18.00”, total N berasal dari campaign/subset, sedangkan kapasitas harian adalah 2. Jangan menggunakan simbol N yang sama untuk total dan jumlah per hari tanpa klarifikasi.

Jika pengguna berkata “jadwalkan N video per hari pukul 10.00 dan 18.00” dan N bukan 2 atau belum diketahui, Hermes harus bertanya:

> Dengan dua jam yang tersedia, apakah maksud Anda 2 video per hari sampai seluruh N video selesai?

Hermes tidak boleh membuat plan sebelum ambigu ini terselesaikan.

### Operator API untuk Hermes

| Method | Endpoint | Scope | Efek |
|---|---|---|---|
| `GET` | `/api/operator/v2/approved-campaigns?search=` | `publishing:read` | Daftar campaign yang eligible |
| `GET` | `/api/operator/v2/approved-campaigns/{id}/preview` | `publishing:read` | Video approved dan kandidat slot |
| `GET` | `/api/operator/v2/publishing-accounts?platform=tiktok` | `publishing:read` | Account ID aman tanpa secret |
| `POST` | `/api/operator/v2/approved-campaigns/{id}/publishing-plans` | `publishing:plan` | Membuat immutable pending plan |
| `GET` | `/api/operator/v2/publishing-plans/{id}` | `publishing:read` | Status batch dan item |

### Human Approval API

| Method | Endpoint | Auth | Efek |
|---|---|---|---|
| `POST` | `/api/v2/publishing-plans/{id}/approve` | Session user + permission publish | Exact-plan approval dan job creation |
| `POST` | `/api/v2/publishing-plans/{id}/reject` | Session user + permission publish | Reject sebelum dispatch |

Body plan:

```json
{
  "platform": "tiktok",
  "account_id": "acc_xxx",
  "start_date": "2026-09-10",
  "publish_time": "18:30",
  "timezone": "Asia/Jakarta",
  "videos_per_day": 2,
  "publish_times": ["10:00", "18:00"],
  "cadence": { "unit": "day", "interval": 1 },
  "content_flow_item_ids": ["video_1", "video_2", "...video_N"]
}
```

POST wajib membawa `Idempotency-Key`. Response memuat `batch_id`, `revision`, `plan_sha256`, item preview, dan `approval_url`.

Approval body:

```json
{
  "revision": 1,
  "plan_sha256": "<exact hash>",
  "confirmation": "APPROVE_AND_SCHEDULE"
}
```

## 6. Data Model

Tambahkan tabel:

- `agent_publishing_batches`: tenant, source campaign/run/job, revision, platform, account, timezone, plan hash, status, created_by, approved_by/timestamps, idempotency.
- `agent_publishing_batch_items`: batch, ordered position, ContentFlow item, immutable media/caption hash, scheduled timestamp, intent/job ID, status.

Constraints minimum:

- unique `(tenant_id, idempotency_key)`;
- unique `(batch_id, position)`;
- unique `(batch_id, content_flow_item_id)`;
- partial unique active job target per `(tenant_id, content_flow_item_id, account_id, platform)`;
- foreign keys tenant-scoped atau service-level tenant checks;
- status and revision checks.

## 7. Eligibility Rules

Resolver campaign wajib membuktikan hubungan melalui server-side chain:

```text
automation/agent run -> operator_job_id -> campaign/planner rows -> ContentFlow items
```

Jangan menerima daftar video arbitrer dari client. `content_flow_item_ids` hanya boleh memilih subset dari hasil resolver.

Setiap item harus:

- manual review approved pada revision terakhir;
- produksi selesai dan bukan placeholder;
- mempunyai final HTTPS media URL;
- platform status belum Scheduled/Published;
- tidak memiliki publishing job/intention aktif untuk target yang sama;
- tenant, campaign, brand, dan product cocok;
- caption telah dibekukan ke plan hash.

## 8. Scheduling Rules

- Hitung slot memakai timezone IANA, kemudian simpan UTC.
- Jumlah item dinamis: minimal 1 dan maksimal 30 per batch, atau batas lebih rendah yang ditemukan aman saat audit.
- `videos_per_day` harus sama dengan jumlah `publish_times`; bila pesan ambigu atau jumlahnya berbeda, Hermes wajib meminta klarifikasi.
- Distribusikan item sesuai urutan immutable ke seluruh slot harian. Contoh N=5 dengan jam 10.00 dan 18.00 menghasilkan 2, 2, lalu 1 posting selama tiga hari.
- DST/offset dihitung per tanggal, bukan menambah 24 jam mentah.
- Tolak tanggal masa lalu; jangan diam-diam mengganti ke “sekarang”.
- Deteksi bentrok account pada window konfigurasi.
- Tampilkan seluruh timestamp lokal dan UTC di preview.

## 9. Atomic Dispatch

Approval transaction:

1. lock batch dan semua item;
2. verifikasi status `pending_approval`, revision, dan hash;
3. revalidate eligibility/media hash/account status;
4. buat/reuse tepat N publishing intent untuk N item;
5. buat/reuse tepat N Publishing Jobs berstatus approved/scheduled;
6. update ContentFlow menjadi Scheduled;
7. tandai batch scheduled dan tulis audit event;
8. commit.

Tidak ada network call Repliz di transaction. Worker melakukan network call setelah commit. Bila sebagian insert gagal, rollback seluruh batch.

## 10. Observability

Log/event harus menyertakan batch ID, run/campaign ID, item count, platform, account ID, revision, hash prefix, actor, dan state transition—tanpa credential/caption lengkap.

UI menampilkan:

- jumlah eligible/ineligible dan alasannya;
- seluruh video terpilih, thumbnail, caption ringkas, account, dan slot waktunya;
- duplicate/conflict warning;
- status job dan permalink setelah publish;
- tombol retry hanya untuk item failed dan tetap idempotent.

## 11. File-by-File Changes

### `lib/db-pg.js`

Code Sebelum (Current/Before):

```js
// Hanya agent_publishing_intents; belum ada batch immutable berisi N item.
```

Code Sesudah (Proposed/After):

```js
CREATE TABLE IF NOT EXISTS agent_publishing_batches (...);
CREATE TABLE IF NOT EXISTS agent_publishing_batch_items (...);
CREATE UNIQUE INDEX ... ON agent_publishing_batches(tenant_id,idempotency_key);
```

### `[NEW] lib/approved-campaign-publishing-contract.js`

Code Sebelum (Current/Before):

```js
// Belum ada contract multi-video campaign publishing.
```

Code Sesudah (Proposed/After):

```js
export function normalizePublishingPlan(input) { /* account, cadence, timezone, ordered IDs */ }
export function hashPublishingPlan(plan) { /* canonical SHA-256 */ }
```

### `[NEW] lib/approved-campaign-publishing-repository.js`

Code Sebelum (Current/Before):

```js
// Belum ada persistence batch/revision/item.
```

Code Sesudah (Proposed/After):

```js
export async function createPlanIdempotent(...) { /* transaction + conflict */ }
export async function approveAndCreateJobs(...) { /* lock, revalidate, atomic jobs */ }
```

### `[NEW] lib/approved-campaign-publishing-service.js`

Code Sebelum (Current/Before):

```js
// Existing service dispatch satu intent dan satu ContentFlow item.
```

Code Sesudah (Proposed/After):

```js
export async function resolveApprovedCampaign(id) { /* server-side lineage */ }
export async function previewCampaignPlan(input) { /* eligibility + slots */ }
```

### `lib/publishing-repository.js`

Code Sebelum (Current/Before):

```js
export async function createPublishingJobs({ tenantId, contentId, targets }) { ... }
```

Code Sesudah (Proposed/After):

```js
export async function createPublishingJobsWithClient(client, input) { /* reuse transaction */ }
// existing function delegates without breaking callers
```

### `lib/operator-auth.js`

Code Sebelum (Current/Before):

```js
// Scope publishing:read / publishing:plan belum dipakai.
```

Code Sesudah (Proposed/After):

```js
// Exact-scope checks tetap fail closed; legacy credential tidak memperoleh scope baru.
```

### `[NEW] app/api/operator/v2/approved-campaigns/route.js`

Code Sebelum (Current/Before):

```js
// Belum ada discovery campaign approved untuk Hermes.
```

Code Sesudah (Proposed/After):

```js
authenticateOperator(request, 'publishing:read');
return bounded approved campaigns without secrets;
```

### `[NEW] app/api/operator/v2/approved-campaigns/[id]/preview/route.js`

Code Sebelum (Current/Before):

```js
// Belum ada read-only preview slot dinamis.
```

Code Sesudah (Proposed/After):

```js
return previewCampaignPlan({ campaignId, query, tenantId });
```

### `[NEW] app/api/operator/v2/approved-campaigns/[id]/publishing-plans/route.js`

Code Sebelum (Current/Before):

```js
// Belum ada endpoint Hermes untuk pending plan.
```

Code Sesudah (Proposed/After):

```js
authenticateOperator(request, 'publishing:plan');
require Idempotency-Key; create immutable pending_approval batch;
```

### `[NEW] app/api/operator/v2/publishing-accounts/route.js`

Code Sebelum (Current/Before):

```js
// Account endpoint existing memakai session auth.
```

Code Sesudah (Proposed/After):

```js
authenticateOperator(request, 'publishing:read');
return id, label, platform, provider, active only; never credentials;
```

### `[NEW] app/api/operator/v2/publishing-plans/[id]/route.js`

Code Sebelum (Current/Before):

```js
// Hermes belum dapat memonitor batch.
```

Code Sesudah (Proposed/After):

```js
return bounded batch/items/job status with no secrets;
```

### `[NEW] app/api/v2/publishing-plans/[id]/approve/route.js`

Code Sebelum (Current/Before):

```js
// Existing approval hanya satu agent_publishing_intent.
```

Code Sesudah (Proposed/After):

```js
withTenantContext(require publish permission, verify exact revision/hash, atomic create N jobs);
```

### `[NEW] app/api/v2/publishing-plans/[id]/reject/route.js`

Code Sebelum (Current/Before):

```js
// Belum ada rejection batch.
```

Code Sesudah (Proposed/After):

```js
withTenantContext(reject pending batch idempotently and audit actor);
```

### `app/content-flow/page.js`

Code Sebelum (Current/Before):

```jsx
// Belum ada review panel publishing batch dari approval_url.
```

Code Sesudah (Proposed/After):

```jsx
<PublishingBatchReview batchId={searchParams.publishing_batch} />
```

### `plugins/makna-hermes/skills/makna-content-orchestrator/SKILL.md`

Code Sebelum (Current/Before):

```md
Hermes dapat membuat automation, tetapi belum dapat memilih approved campaign.
```

Code Sesudah (Proposed/After):

```md
Parse total video, video per hari, dan daftar jam sebagai nilai terpisah; resolve campaign/account, preview seluruh slot, confirm, create pending plan, return MAKNA approval URL.
Never approve or call Repliz.
```

### `plugins/makna-hermes/skills/makna-content-orchestrator/references/operator-api.md`

Code Sebelum (Current/Before):

```md
Hanya API katalog dan create automation.
```

Code Sesudah (Proposed/After):

```md
Tambahkan discovery, preview, plan creation, monitoring, error/retry examples.
```

### `tests/approved-campaign-publishing.test.js`

Code Sebelum (Current/Before):

```js
// Belum ada batch publishing tests.
```

Code Sesudah (Proposed/After):

```js
test('N approved videos create exactly N unique jobs after exact human approval', ...);
test('Hermes cannot approve its own plan', ...);
test('duplicate retry creates no duplicate job', ...);
test('videos_per_day must equal publish_times length', ...);
```

## 12. Test Matrix

- Contract: 1–30 ordered IDs, videos-per-day, multiple publish times, cadence, timezone, invalid/missing account.
- Eligibility: unapproved, stale revision, missing media, cross-tenant, already scheduled/published.
- Authorization: Hermes read/plan allowed; approve forbidden; legacy token forbidden.
- Idempotency: same key/body replay; same key/different body 409.
- Concurrency: two approvals and two plan creations yield one batch and exactly N jobs.
- Scheduling: N=1, N=5, N=6, and N=30 across one or multiple daily times, including timezone offset edge cases.
- Atomicity: injected failure on any middle item leaves zero jobs.
- Regression: single-item intent and existing Publishing UI/worker remain functional.
- Redaction: no Repliz credentials/operator token in JSON/log/snapshot.
- Build and Dev smoke; no live Repliz call in automated tests.

Commands:

```bash
node --test tests/approved-campaign-publishing.test.js
npm run test:publishing-scheduler
npm run test:content-automation
npm run build
```

## 13. Rollout

1. Deploy Dev with new endpoints disabled by `ENABLE_HERMES_CAMPAIGN_PUBLISHING=false`.
2. Add `publishing:read,publishing:plan` to Hermes Dev credential only.
3. Enable Dev flag and test preview using fixture/known approved campaign.
4. Create pending plan; assert zero jobs and zero Repliz calls before UI approval.
5. Approve against a non-live/draft Repliz target only after explicit user permission.
6. Verify job count equals selected video count, unique slots, ContentFlow Scheduled status, and audit trail.
7. Staging requires separate approval; Production is prohibited without explicit instruction.

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

## Definition of Done

- Hermes can identify an approved campaign, accept a dynamic subset/count, and produce a deterministic N-slot preview.
- Hermes can create only a pending plan, never approve or call Repliz.
- Human approval is bound to exact revision/hash and creates exactly one job per selected video.
- Retry/concurrency cannot duplicate jobs.
- Cross-tenant, unapproved, changed, or already-published content fails closed.
- Existing single-intent publishing and worker behavior do not regress.
- Dev evidence is recorded without secrets; Production remains untouched.
