# Implementation Plan — Content Automation Product Campaign berbasis OPC

## 1. Status Dokumen

- Status: **Disetujui untuk dieksekusi**
- Tanggal: 13 Agustus 2026
- Target aplikasi: MAKNA Flow
- Pipeline acuan: **Organic Pillar Campaign (OPC)**
- Strategic Campaign: **tidak digunakan dan tidak boleh diperkenalkan kembali**
- Target rilis: patch release bertahap setelah seluruh verifikasi berhasil

## 2. Tujuan

Memperluas menu **Content Automations** agar dapat menjadwalkan dan menjalankan dua jenis campaign:

1. Brand Editorial Campaign yang sudah ada.
2. Product Campaign berbasis produk yang dipilih dari master product/brand-product binding.

Alur Product Campaign yang dituju:

```text
Schedule / Run Now
→ snapshot brand + produk + affiliate routing
→ Product Content Planner
→ ingest seluruh row terpilih ke OPC
→ OPC Single-Pass Creative Generation
→ storyboard + VO + Video DNA + social package
→ generate start frame untuk seluruh klip yang memerlukannya
→ awaiting_approval
→ approval per item di OPC ATAU bulk approval di Content Automations
→ TTS
→ video generation
→ FFmpeg
→ upload aset final
→ upsert idempotent ke ContentFlow
→ completed / completed_with_warnings
```

## 3. Prinsip Arsitektur Wajib

### 3.1 OPC adalah satu-satunya pipeline creative

- Jangan membuat atau memanggil Strategic Campaign.
- Jangan menambah service creative kedua.
- Content Automation hanya mengorkestrasi service Product Planner, OPC ingest, OPC generator, OPC approval, OPC production, dan ContentFlow sync yang sama dengan UI utama.

### 3.2 Single-pass creative generation

Dalam satu eksekusi generator OPC per item, hasil harus tetap mencakup:

- storyboard;
- voice-over;
- Video DNA;
- T2I/I2V/T2V prompts;
- caption, hashtag, dan CTA.

Start-frame generation adalah tahap asset pre-production setelah output OPC tersedia. Tahap ini bukan call creative kedua.

### 3.3 Human approval adalah production gate

- Mode manual Product Campaign berhenti setelah semua start frame wajib siap.
- Tidak ada TTS, video generation, atau FFmpeg sebelum revision terkait di-approve.
- Approval harus idempotent dan revision-bound.
- Item berbeda dalam satu campaign boleh berada pada tahap yang berbeda.

### 3.4 Snapshot produk per run

Schedule menyimpan referensi produk, tetapi setiap run mengambil snapshot immutable yang digunakan hingga run selesai. Perubahan master product setelah run dibuat tidak boleh mengubah review artifact run tersebut.

### 3.5 ContentFlow adalah tahap downstream independen

- Kegagalan sync ContentFlow tidak mengulang TTS/video/FFmpeg.
- Retry ContentFlow dilakukan per item.
- Upsert memakai identity stabil dan idempotency key.

### 3.6 Tenant isolation dan authorization

- Semua schedule, run, product lookup, OPC item, approval, asset, audit event, dan ContentFlow sync wajib tenant-scoped.
- Bulk approval hanya untuk admin atau permission khusus `content_automations.approve`.
- Endpoint tidak boleh mempercayai `tenant_id`, eligibility item, atau revision dari browser tanpa validasi ulang.

## 4. Keputusan Scope

### 4.1 Termasuk dalam implementasi

- Pilihan Brand Editorial atau Product Campaign pada form schedule.
- Product selector berdasarkan Brand Profile.
- Product completeness preview.
- Product planner count 6, 12, 18, 24, atau 30.
- Product Campaign system preset.
- Snapshot produk dan affiliate routing per run.
- OPC pre-production sampai seluruh start frame siap.
- Review artifact lengkap dengan start frame.
- Approval per item di OPC.
- Bulk approval item eligible dari Content Automations.
- Partial approval dan progress per tahap.
- TTS → video → FFmpeg setelah approval.
- Auto-sync ContentFlow dan retry terpisah.
- Audit event, notifications, recovery, dan tests.
- Backward compatibility untuk schedule editorial lama.

### 4.2 Tidak termasuk

- Strategic Campaign.
- Social auto-posting.
- Auto-approval berdasarkan AI scoring.
- Multi-product dalam satu planner row.
- Mengubah provider TTS/video yang sudah ada.
- Menghapus aset revision lama secara otomatis.
- Deployment Production tanpa instruksi manual eksplisit.

## 5. Model Status Target

### 5.1 Content Automation run

```text
queued
dispatching
job_created
planning
generating_creative
generating_start_frames
awaiting_approval
partially_approved
producing
syncing_contentflow
completed
completed_with_warnings
failed
skipped
cancelled
```

Status lama tetap dapat dibaca. Migrasi tidak melakukan rewrite agresif terhadap run historis.

### 5.2 OPC item workflow

```text
pending
creative_processing
start_frames_processing
ready_for_review
production_processing
syncing_contentflow
completed
completed_with_warnings
rejected
failed
```

### 5.3 Start frame status

```text
pending | processing | completed | partial | failed | skipped
```

`skipped` hanya valid jika visual mode item memang tidak membutuhkan start frame.

### 5.4 ContentFlow sync status

```text
pending | processing | completed | retry_wait | failed | skipped
```

## 6. Model Data dan Migrasi

### 6.1 Kolom schedule

Tambahkan kolom eksplisit untuk query/filter tanpa harus membongkar JSON:

```sql
ALTER TABLE content_automation_schedules
  ADD COLUMN IF NOT EXISTS campaign_kind TEXT NOT NULL DEFAULT 'brand_editorial',
  ADD COLUMN IF NOT EXISTS brand_profile_id TEXT,
  ADD COLUMN IF NOT EXISTS product_id TEXT,
  ADD COLUMN IF NOT EXISTS brand_product_id TEXT;

CREATE INDEX IF NOT EXISTS content_automation_schedule_product_idx
  ON content_automation_schedules(tenant_id, campaign_kind, product_id)
  WHERE status <> 'archived';
```

`operator_request_json` tetap menjadi contract snapshot schedule. Kolom eksplisit hanya untuk routing, filtering, dan observability.

### 6.2 Kolom run

```sql
ALTER TABLE content_automation_runs
  ADD COLUMN IF NOT EXISTS campaign_kind TEXT NOT NULL DEFAULT 'brand_editorial',
  ADD COLUMN IF NOT EXISTS product_snapshot_json JSONB,
  ADD COLUMN IF NOT EXISTS review_revision TEXT,
  ADD COLUMN IF NOT EXISTS approved_item_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_item_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contentflow_synced_count INTEGER NOT NULL DEFAULT 0;
```

### 6.3 Kolom OPC item

Tambahkan melalui mekanisme migrasi database yang memang menjadi sumber tabel `pillar_campaign_items`:

```sql
ALTER TABLE pillar_campaign_items
  ADD COLUMN IF NOT EXISTS start_frame_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS start_frame_revision INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS start_frame_expected_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS start_frame_completed_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_revision TEXT,
  ADD COLUMN IF NOT EXISTS approved_revision TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by TEXT,
  ADD COLUMN IF NOT EXISTS contentflow_sync_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS contentflow_sync_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contentflow_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contentflow_item_id TEXT,
  ADD COLUMN IF NOT EXISTS contentflow_error TEXT;
```

Jika `pillar_campaign_items` masih disimpan melalui compatibility layer, agent harus menempatkan kolom tersebut pada canonical storage yang benar dan memperbarui allowlist update pada `lib/db.js`.

### 6.4 Asset per klip

Tambahkan tabel PostgreSQL tenant-scoped:

```sql
CREATE TABLE IF NOT EXISTS pillar_campaign_item_assets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_item_id TEXT NOT NULL,
  clip_index INTEGER NOT NULL,
  asset_type TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  provider_task_id TEXT,
  local_path TEXT,
  vault_url TEXT,
  checksum TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, campaign_item_id, clip_index, asset_type, revision)
);

CREATE INDEX IF NOT EXISTS pillar_campaign_item_assets_lookup_idx
  ON pillar_campaign_item_assets(tenant_id, campaign_item_id, asset_type, status);
```

Jenis asset minimal:

```text
start_frame | audio | video_clip | final_video | thumbnail
```

JSON/path lama tetap diisi untuk backward compatibility selama masa transisi.

### 6.5 Audit event

Gunakan `content_automation_audit_events` yang sudah ada. Event baru:

```text
product_snapshot_captured
preproduction_started
creative_ready
start_frame_submitted
start_frame_completed
start_frame_failed
run_ready_for_review
item_approved_from_opc
campaign_bulk_approved
item_rejected
production_started
contentflow_sync_succeeded
contentflow_sync_failed
review_revision_invalidated
```

## 7. Kontrak Request Target

Contoh Product Campaign schedule:

```json
{
  "name": "Nutribake Product Weekly",
  "campaign_kind": "product_campaign",
  "status": "paused",
  "timezone": "Asia/Jakarta",
  "frequency": "weekly",
  "schedule": { "weekday": 1, "hour": 8, "minute": 0 },
  "operator_request": {
    "planner": {
      "planner_focus": "product_campaign",
      "brand_id": "brand-uuid",
      "product_id": "product-uuid",
      "brand_product_id": "brand-product-uuid",
      "product_name": "Nutribake Brownies",
      "product_description": "Snapshot untuk validasi awal",
      "planner_count": 12,
      "platform": "tiktok",
      "target_audience": "Ibu muda dan keluarga aktif",
      "content_goal": "Awareness dan conversion"
    },
    "selection": { "mode": "all" },
    "opc": {
      "preset": "product_campaign_v1",
      "basic_strategy": {
        "brand_profile_id": "brand-uuid",
        "product_id": "product-uuid",
        "campaign_name": "[Scheduled Product OPC] Nutriba Weekly",
        "ai_directive": "Gunakan klaim produk yang tersedia saja",
        "mandatory_outro_line": ""
      },
      "workflow": {
        "approval_mode": "start_frames",
        "enable_tts": true,
        "enable_glabs": true,
        "enable_ffmpeg": true,
        "enable_social_post": false,
        "auto_sync_contentflow": true
      }
    }
  }
}
```

### 7.1 Approval mode

Nilai baru:

```text
none         = full auto
creative     = pause setelah creative package, kompatibel dengan perilaku storyboard lama
start_frames = pause setelah seluruh start frame wajib siap
```

Input legacy `storyboard` dinormalisasi menjadi `creative`. Schedule existing tidak rusak.

## 8. Perubahan Backend per Komponen

### 8.1 `lib/content-automation-contract.js`

- Normalisasi `campaign_kind`.
- Pastikan `campaign_kind` konsisten dengan `planner_focus`.
- Product Campaign wajib mempunyai `brand_id`, `product_id`, dan `brand_product_id` bila binding tersedia.
- Validasi count Product Planner melalui contract existing.
- Izinkan approval mode `creative`, `start_frames`, `none`, dan legacy `storyboard`.
- Paksa `auto_sync_contentflow=false` untuk editorial lama kecuali eksplisit.

### 8.2 `lib/operator-content-contract.js`

- Tambahkan normalisasi approval checkpoint.
- `scheduler_pause_at` tidak lagi cukup sebagai representasi checkpoint start frame.
- Tambahkan `preproduction_checkpoint` pada production contract.
- Pertahankan `scheduler_pause_at='tts'` sebagai safety net sampai approval.

### 8.3 `lib/operator-presets.js`

Tambahkan system preset `product_campaign_v1` dengan:

- product-aware narrative;
- product lock dan klaim hanya dari snapshot;
- hybrid-lock sebagai default;
- approval pada start frames;
- TTS/video/FFmpeg aktif setelah approval;
- social posting nonaktif;
- ContentFlow auto-sync aktif.

### 8.4 Product snapshot resolver baru

Tambahkan `lib/content-automation-product-snapshot.js`:

- query tenant-scoped ke `products`, `brand_products`, dan affiliate resolver;
- validasi produk aktif dan terhubung ke brand;
- hasilkan snapshot canonical;
- jangan menyertakan credential/secret;
- hash snapshot untuk audit;
- simpan pada run sebelum Operator job dibuat.

### 8.5 Start-frame orchestration baru

Tambahkan `lib/pillar-start-frame-service.js`:

- menentukan klip yang membutuhkan start frame;
- membuat asset row idempotent per item/clip/revision;
- submit provider task tanpa polling blocking;
- poll task pada scheduler tick;
- download dan checksum hasil;
- mirror path ke `t2i_images_json`/`t2i_start_frame_path` untuk compatibility;
- menghitung aggregate status item;
- mengubah item menjadi `ready_for_review` hanya setelah syarat lengkap.

Endpoint regenerate existing harus memanggil service ini, bukan menyalin logika provider.

### 8.6 `lib/campaign-scheduler.js`

Urutan OPC menjadi:

```text
product sourcing
→ single-pass creative generation
→ start-frame submission/poll
→ approval gate
→ TTS
→ visuals/video
→ FFmpeg
→ ContentFlow sync
```

Scheduler harus tetap non-blocking dan memproses item lain ketika satu item menunggu provider atau review.

### 8.7 `lib/operator-content-worker.js`

- Kenali stage `generating_start_frames`.
- `awaiting_approval` hanya ketika item berada di `ready_for_review`.
- Hitung partial approval tanpa menganggap run gagal.
- Status completed mensyaratkan ContentFlow sync jika auto-sync aktif.
- Auto-approval mode `none` hanya mengeksekusi setelah pre-production checkpoint selesai.

### 8.8 Approval service

Perluas `lib/pillar-campaign-approval.js`:

- require `review_revision`/checksum untuk automation-originated item;
- lock item row selama approval;
- cek start-frame completeness untuk mode `start_frames`;
- simpan actor dan approved revision;
- set status produksi downstream secara atomik;
- idempotent bila revision yang sama sudah approved;
- revision baru menginvalidasi approval lama.

### 8.9 ContentFlow service

Tambahkan adapter `lib/content-automation-contentflow.js` atau perluas `lib/contentflow-ingest.js`:

- sync hanya final item yang approved;
- gunakan campaign product binding sebagai sumber routing;
- idempotency key: `tenant:item:approved_revision:contentflow`;
- simpan response identity;
- klasifikasikan retryable/permanent error;
- jangan reset production status ketika sync gagal.

## 9. Perubahan API

### 9.1 Existing endpoints yang diperluas

```text
GET/POST /api/v2/content-automations
GET/PATCH /api/v2/content-automations/{id}
GET      /api/v2/content-automations/runs/{runId}
GET      /api/v2/content-automations/runs/{runId}/review
POST     /api/v2/content-automations/runs/{runId}/approve
```

`GET /api/v2/content-automations` juga mengembalikan summary/filter metadata, tetapi tidak mengirim seluruh creative JSON untuk setiap run.

### 9.2 Endpoint baru

```text
GET  /api/v2/content-automations/product-options?brand_profile_id=...
POST /api/v2/content-automations/runs/{runId}/retry-preproduction
POST /api/v2/content-automations/runs/{runId}/retry-contentflow
POST /api/v2/pillar-campaigns/items/{itemId}/reject
```

### 9.3 Bulk approval semantics

Request:

```json
{
  "mode": "approve_ready",
  "item_ids": [101, 102],
  "review_revision": "run-revision",
  "review_sha256": "sha256"
}
```

Server wajib:

1. lock run dan item eligible;
2. rebuild review artifact;
3. menolak stale review dengan `409`;
4. approve hanya item `ready_for_review` yang termasuk revision;
5. tidak mengubah item failed/processing/already-approved;
6. mengembalikan `approved`, `skipped`, dan `blocked` per item.

## 10. Perubahan UI

### 10.1 New Schedule modal

Gunakan struktur bertahap dalam satu modal scrollable:

1. Campaign Type.
2. Brand & Product.
3. Planner Configuration.
4. OPC Creative Preset.
5. Approval & Production.
6. Schedule & Reliability.
7. Summary.

Ketika `product_campaign` dipilih:

- sembunyikan field editorial pillars;
- tampilkan product selector;
- tampilkan product snapshot/completeness;
- planner count hanya 6/12/18/24/30;
- default preset `product_campaign_v1`;
- default approval `start_frames`;
- default ContentFlow auto-sync aktif.

### 10.2 Run cards

Tampilkan:

- campaign kind;
- brand/product;
- current stage;
- progress Planner, Creative, Start Frames, Approval, Production, ContentFlow;
- error summary;
- tombol sesuai state.

### 10.3 Run detail/review drawer

Tampilkan aggregate metrics dan daftar item ringkas. Link `Open OPC Review` tetap mengarah ke halaman OPC untuk editing penuh.

### 10.4 Bulk approval dialog

Dialog wajib menampilkan:

- total item;
- ready item;
- item processing/failed;
- start frame count;
- revision/checksum;
- estimasi jumlah TTS/video task;
- penjelasan bahwa produksi dimulai segera.

Teks tombol: **Approve All Ready Items**.

## 11. Observability dan Notification

Notification event baru:

```text
preproduction_failed
awaiting_approval
partially_approved
contentflow_sync_failed
completed_with_warnings
completed
```

Log harus menyertakan `tenant_id`, `run_id`, `operator_job_id`, `campaign_id`, `item_id`, `revision`, dan provider task ID bila relevan. Jangan log token, API key, atau payload produk sensitif.

## 12. Idempotency, Concurrency, dan Recovery

### 12.1 Idempotency keys

```text
automation dispatch : tenant:schedule:scheduled_for
planner/operator    : tenant:run:operator
start frame         : tenant:item:revision:clip:start_frame
tts                 : tenant:item:approved_revision:tts
video               : tenant:item:approved_revision:clip:video
ffmpeg              : tenant:item:approved_revision:ffmpeg
contentflow         : tenant:item:approved_revision:contentflow
```

### 12.2 Locks

- Claim schedule/run memakai `FOR UPDATE SKIP LOCKED`.
- Approval memakai transaction + row lock.
- Asset submit memakai unique constraint.
- ContentFlow upsert memakai stable unique identity.

### 12.3 Restart recovery

- `processing` task dengan provider task ID dilanjutkan dengan polling.
- `processing` tanpa provider task ID melewati stale timeout lalu kembali `retry_wait`.
- Approval yang tersimpan tidak hilang.
- Completed production asset tidak dibuat ulang saat hanya ContentFlow yang gagal.

## 13. Backward Compatibility

- `campaign_kind` schedule lama di-backfill `brand_editorial`.
- `approval_mode='storyboard'` dibaca sebagai `creative`.
- Preset `nutribake_editorial_v1` tetap bekerja.
- Existing `scheduler_pause_at='tts'` tetap dihormati.
- Existing JSON start-frame paths tetap ditulis selama transisi.
- Tidak ada perubahan perilaku RE, Instant Factory, Bridge, atau Multiplier.

## 14. File Impact dan Before/After Snippets

Bagian ini wajib menjadi acuan implementasi. Snippet ringkas menunjukkan perubahan semantik, bukan pengganti pembacaan file aktual.

### 14.1 `app/content-automations/page.js`

**Code Sebelum (Current/Before)**

```js
operator_request: {
  planner: {
    planner_focus: 'brand_editorial',
    title: `${form.account_name} Scheduled Editorial`,
    pillars,
    planner_count: Number(form.planner_count)
  }
}
```

**Code Sesudah (Proposed/After)**

```js
operator_request: {
  planner: form.campaign_kind === 'product_campaign'
    ? buildProductPlannerPayload(form, selectedProduct)
    : buildEditorialPlannerPayload(form, pillars),
  selection: { mode: 'all' },
  opc: buildOpcPayload(form)
}
```

### 14.2 `lib/content-automation-contract.js`

**Code Sebelum (Current/Before)**

```js
if (!['storyboard', 'none'].includes(operatorRequest.production.approval_mode)) {
  throw new ContentAutomationError('Mode approval automation hanya boleh storyboard atau none.');
}
```

**Code Sesudah (Proposed/After)**

```js
const campaignKind = normalizeCampaignKind(input.campaign_kind, operatorRequest.planner.planner_focus);
const approvalMode = normalizeApprovalMode(operatorRequest.production.approval_mode);
assertCampaignPlannerConsistency(campaignKind, operatorRequest.planner);
assertProductAutomationFields(campaignKind, operatorRequest.planner);
```

### 14.3 `lib/operator-content-contract.js`

**Code Sebelum (Current/Before)**

```js
const approvalMode = input.approval_mode || 'storyboard';
scheduler_pause_at: approvalMode === 'storyboard' ? 'tts' : null
```

**Code Sesudah (Proposed/After)**

```js
const approvalMode = normalizeApprovalMode(input.approval_mode || 'creative');
return {
  approval_mode: approvalMode,
  preproduction_checkpoint: approvalMode === 'start_frames' ? 'start_frames' : 'creative',
  scheduler_pause_at: approvalMode === 'none' ? null : 'tts'
};
```

### 14.4 `lib/operator-presets.js`

**Code Sebelum (Current/Before)**

```js
const PRESETS = {
  nutribake_editorial_v1: { /* editorial only */ }
};
```

**Code Sesudah (Proposed/After)**

```js
const PRESETS = {
  nutribake_editorial_v1: { /* unchanged */ },
  product_campaign_v1: {
    schema_version: '2',
    label: 'Product Campaign — OPC',
    product_bridging: { is_bridging_active: true },
    workflow: {
      approval_mode: 'start_frames',
      auto_sync_contentflow: true,
      enable_social_post: false
    }
  }
};
```

### 14.5 `lib/content-automation-worker.js`

**Code Sebelum (Current/Before)**

```js
if (run.operator_status === 'awaiting_approval') status = 'awaiting_approval';
else if (run.operator_status === 'producing') status = 'producing';
```

**Code Sesudah (Proposed/After)**

```js
status = mapOperatorLifecycleToAutomationRun({
  operatorStatus: run.operator_status,
  operatorStage: run.current_stage,
  approvedCount: run.approved_item_count,
  totalCount: run.total_item_count,
  contentflowSyncedCount: run.contentflow_synced_count
});
```

### 14.6 `lib/operator-content-worker.js`

**Code Sebelum (Current/Before)**

```js
if (items.some(item => item.workflow_status === 'ready_for_review')) return 'approval';
if (items.some(item => item.generation_status !== 'completed')) return 'storyboard';
```

**Code Sesudah (Proposed/After)**

```js
if (items.some(isGeneratingStartFrames)) return 'generating_start_frames';
if (items.some(isReadyForReview)) return getApprovalStage(items);
if (items.some(isSyncingContentFlow)) return 'syncing_contentflow';
if (items.some(item => item.generation_status !== 'completed')) return 'creative';
```

### 14.7 `lib/campaign-scheduler.js`

**Code Sebelum (Current/Before)**

```js
if (currentItem.generation_status === 'completed' && currentItem.tts_status === 'pending') {
  if (currentItem.workflow_status === 'ready_for_review') continue;
  runStep(currentItem.id, 'pillar_tts', processPillarTts, taskKey);
}
```

**Code Sesudah (Proposed/After)**

```js
if (needsStartFramePreproduction(currentItem, campaign)) {
  runStep(currentItem.id, 'pillar_start_frames', processPillarStartFrames, taskKey);
  continue;
}
if (requiresApproval(currentItem, campaign) && !hasApprovedCurrentRevision(currentItem)) {
  continue;
}
if (canStartTts(currentItem, campaign)) {
  runStep(currentItem.id, 'pillar_tts', processPillarTts, taskKey);
}
```

### 14.8 `lib/pillar-campaign-approval.js`

**Code Sebelum (Current/Before)**

```js
workflow_status: 'production_processing',
tts_status: settings.enable_tts ? 'pending' : 'skipped'
```

**Code Sesudah (Proposed/After)**

```js
await approveItemRevisionAtomically({
  itemId,
  actorId,
  reviewRevision,
  requireStartFrames: campaign.approval_mode === 'start_frames',
  downstream: settings
});
```

### 14.9 `lib/db-pg.js`

**Code Sebelum (Current/Before)**

```sql
CREATE TABLE IF NOT EXISTS content_automation_runs (
  ... status TEXT NOT NULL DEFAULT 'queued' ...
);
```

**Code Sesudah (Proposed/After)**

```sql
ALTER TABLE content_automation_runs
  ADD COLUMN IF NOT EXISTS product_snapshot_json JSONB,
  ADD COLUMN IF NOT EXISTS approved_item_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contentflow_synced_count INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS pillar_campaign_item_assets (...);
```

### 14.10 `lib/db.js`

**Code Sebelum (Current/Before)**

```js
const allowedFields = [
  'generation_status', 'result_json', 'tts_status', 'visual_status',
  'workflow_status'
];
```

**Code Sesudah (Proposed/After)**

```js
const allowedFields = [
  ...existingFields,
  'start_frame_status', 'start_frame_revision',
  'review_revision', 'approved_revision', 'approved_at', 'approved_by',
  'contentflow_sync_status', 'contentflow_synced_at', 'contentflow_error'
];
```

### 14.11 `app/api/v2/content-automations/runs/[runId]/approve/route.js`

**Code Sebelum (Current/Before)**

```js
for (const item of items) await approvePillarCampaignItemUnchanged(item.id);
return NextResponse.json({ success: true, approved_count: items.length });
```

**Code Sesudah (Proposed/After)**

```js
const result = await bulkApproveReadyItems({
  run,
  actor: user,
  requestedItemIds: body.item_ids,
  reviewRevision: body.review_revision,
  reviewSha256: body.review_sha256
});
return NextResponse.json({ success: true, ...result });
```

### 14.12 `app/api/v2/pillar-campaigns/items/[itemId]/regenerate-start-frames/route.js`

**Code Sebelum (Current/Before)**

```js
// Endpoint memiliki submit, polling, download, dan update DB sendiri.
```

**Code Sesudah (Proposed/After)**

```js
const result = await requestStartFrameRegeneration({
  itemId,
  clipIndexes: body.clip_indexes,
  actorId: user.id
});
return NextResponse.json({ success: true, ...result }, { status: 202 });
```

### 14.13 `lib/contentflow-ingest.js`

**Code Sebelum (Current/Before)**

```js
export async function syncCampaignToContentFlow(campaignId) {
  // campaign-level manual sync
}
```

**Code Sesudah (Proposed/After)**

```js
export async function syncApprovedOpcItemToContentFlow({
  itemId,
  approvedRevision,
  idempotencyKey
}) {
  // binding-first item upsert; safe to retry
}
```

### 14.14 `app/api/v2/content-automations/product-options/route.js` — file baru

**Code Sebelum (Current/Before)**

```js
// Belum ada endpoint product options khusus Content Automations.
```

**Code Sesudah (Proposed/After)**

```js
export const GET = withTenantContext(async (request) => {
  const brandProfileId = new URL(request.url).searchParams.get('brand_profile_id');
  return NextResponse.json({
    success: true,
    products: await listEligibleAutomationProducts({ brandProfileId })
  });
});
```

### 14.15 `lib/content-automation-product-snapshot.js` — file baru

**Code Sebelum (Current/Before)**

```js
// Snapshot produk belum menjadi checkpoint automation run.
```

**Code Sesudah (Proposed/After)**

```js
export async function captureProductSnapshot({ tenantId, brandProfileId, productId }) {
  const product = await resolveTenantProduct(...);
  const affiliate = await resolveAffiliateLink(...);
  return Object.freeze(buildCanonicalSnapshot(product, affiliate));
}
```

### 14.16 `lib/pillar-start-frame-service.js` — file baru

**Code Sebelum (Current/Before)**

```js
// Start-frame logic tersebar di endpoint regenerate dan visual worker.
```

**Code Sesudah (Proposed/After)**

```js
export async function processPillarStartFrames(itemId) {
  const manifest = await ensureStartFrameManifest(itemId);
  await submitOrPollPendingAssets(manifest);
  return refreshItemStartFrameAggregate(itemId);
}
```

### 14.17 Test scripts

**Code Sebelum (Current/Before)**

```js
assert.equal(normalized.operator_request.production.scheduler_pause_at, 'tts');
```

**Code Sesudah (Proposed/After)**

```js
assert.equal(normalized.campaign_kind, 'product_campaign');
assert.equal(normalized.operator_request.production.approval_mode, 'start_frames');
assert.equal(normalized.operator_request.production.preproduction_checkpoint, 'start_frames');
```

Test baru minimal:

```text
scripts/test-content-automation-product-contract.mjs
scripts/test-content-automation-product-run.mjs
scripts/test-opc-start-frame-checkpoint.mjs
scripts/test-content-automation-partial-approval.mjs
scripts/test-content-automation-contentflow-sync.mjs
scripts/test-content-automation-product-recovery.mjs
```

## 15. Test Matrix

### 15.1 Contract tests

- Editorial legacy payload tetap valid.
- Product payload tanpa produk ditolak.
- Produk bukan milik tenant/brand ditolak.
- Product count selain 6/12/18/24/30 ditolak.
- Legacy `storyboard` dinormalisasi.
- Social post `true` tetap ditolak.

### 15.2 Pre-production tests

- Hybrid-lock menghasilkan manifest start frame sesuai clip count.
- Pure T2V menghasilkan status `skipped` yang valid.
- Partial provider failure tidak menandai item ready.
- Retry hanya mengulang clip gagal.
- Restart worker melanjutkan task provider yang sudah disubmit.

### 15.3 Approval tests

- Per-item approval memulai produksi item itu saja.
- Bulk approval hanya mengambil item eligible.
- Double approval tidak menggandakan downstream job.
- Stale revision mendapat `409`.
- Edit VO/start frame menginvalidasi revision yang relevan.
- User tanpa permission mendapat `403`.

### 15.4 Production tests

- TTS tidak berjalan sebelum approval.
- Video tidak berjalan sebelum TTS selesai/skipped.
- FFmpeg tidak berjalan sebelum seluruh visual clip selesai/skipped.
- Satu item gagal tidak memblokir item approved lain.

### 15.5 ContentFlow tests

- Binding product menjadi sumber product/affiliate metadata.
- Retry tidak membuat record duplikat.
- Sync failure tidak menghapus final media.
- Retry ContentFlow tidak menjalankan ulang FFmpeg.
- Item final tanpa binding valid berakhir `completed_with_warnings` atau permanent sync error yang terlihat.

### 15.6 Multi-tenant/concurrency tests

- Tenant A tidak dapat memilih produk tenant B.
- Dua worker tidak submit start frame yang sama.
- Dua request bulk approval bersamaan hanya menghasilkan satu approval per revision.
- Schedule run idempotency existing tetap berfungsi.

## 16. Verifikasi UI

- Desktop 1440px dan laptop 1280px.
- Mobile minimum 390px untuk observability dasar; editing OPC penuh boleh tetap diarahkan ke halaman detail.
- Keyboard focus, label form, dialog focus trap, dan contrast.
- Loading, empty, partial, failed, stale revision, dan completed-with-warning states.
- Tidak ada horizontal overflow pada New Schedule modal.

## 17. Deployment dan Rollout

### 17.1 Target deployment wajib: Server Dev Mac Mini

Deployment dan smoke test implementasi ini hanya boleh dilakukan ke lingkungan berikut:

```text
Host SSH       : masbenu@100.95.245.55
Folder         : ~/maknaflow-dev
UI             : port 5020
API            : port 7020
Database schema: dev
PM2 config     : ecosystem.macmini.config.cjs --env dev
PGPOOL_MAX     : 3
Deploy command : npm run deploy:macmini-dev
```

Aturan deployment:

- Gunakan remote build melalui `npm run deploy:macmini-dev` atau `node scripts/deploy-macmini-dev.js`.
- **Dilarang menjalankan `npm run deploy:staging` atau `node scripts/deploy-macmini.js`.**
- **Dilarang deploy ke Server Staging Mac Mini** (`~/maknaflow-staging`, UI 5010, API 7010, schema `staging`).
- **Dilarang deploy ke Production** tanpa perintah manual eksplisit pengguna.
- Selama remote build, jangan membuat polling SSH berulang. Tunggu satu interval sekitar dua menit sebelum pemeriksaan hasil berikutnya.
- Setelah deploy Dev berhasil, verifikasi PM2 Dev, health endpoint UI/API Dev, serta koneksi schema `dev`.

### 17.2 Feature flag

Gunakan tenant setting:

```text
content_automation_product_campaign_enabled
```

Default `false` saat migrasi pertama. Aktifkan hanya pada lingkungan **Dev Mac Mini** setelah contract/data migration test berhasil.

### 17.3 Rollout

1. Migrasi schema dengan feature flag off.
2. Selesaikan contract, read compatibility, start-frame service, dan tests secara lokal.
3. Jalankan lint, test, dan production build lokal.
4. Deploy ke **Server Dev Mac Mini** dengan `npm run deploy:macmini-dev`.
5. Verifikasi UI `:5020`, API `:7020`, PM2 Dev, dan schema `dev`.
6. Aktifkan Product Campaign UI hanya di Dev.
7. Pilot satu produk × 6 item di Dev.
8. Uji approval per item di Dev.
9. Uji bulk approval di Dev.
10. Uji ContentFlow sync/retry dari environment Dev.
11. Naikkan pilot ke 12 item setelah pilot 6 item lulus.
12. Jangan deploy ke Staging Mac Mini.
13. Production hanya setelah instruksi manual eksplisit pengguna.

### 17.4 Rollback

- Matikan feature flag untuk mencegah schedule Product Campaign baru.
- Pause schedule Product Campaign aktif.
- Jangan menghapus run, OPC campaign, asset, atau product binding.
- Worker tetap menyelesaikan item yang sudah approved bila aman.
- Schema tambahan dibiarkan kompatibel; rollback tidak melakukan destructive migration.

## 18. Release dan Git Sync

Setelah implementasi dan seluruh verifikasi lulus:

```bash
npm run release-non-interactive -- --type patch --title "Content Automation Product Campaign" --points "Tambah Product Campaign berbasis OPC|Tambah review setelah start frame|Tambah approval parsial dan auto-sync ContentFlow"
```

Lalu verifikasi:

- versi dan changelog konsisten;
- commit/tag release berhasil;
- branch `main` dan tag `vX.Y.Z` telah terunggah ke target repository;
- tidak melakukan deployment Production tanpa instruksi eksplisit.

## 19. Definition of Done

- User dapat membuat Product Campaign schedule dari produk yang valid.
- Run mengambil snapshot produk dan membuat Product Planner.
- Planner row di-ingest ke OPC tanpa Strategic Campaign.
- OPC menghasilkan creative package single-pass.
- Seluruh start frame wajib selesai sebelum review.
- Approval per item dan bulk approval bekerja secara revision-safe.
- TTS/video/FFmpeg hanya berjalan setelah approval.
- Final item auto-sync ke ContentFlow secara idempotent.
- Retry granular dan restart recovery teruji.
- Editorial schedule lama tetap bekerja.
- Feature flag, audit, notification, tenant isolation, dan permission teruji.
- Build, lint, unit/integration test, serta smoke test **Server Dev Mac Mini** berhasil.
- Release SOP selesai.

## 20. Execution Task List

Checklist ini wajib diperbarui real-time oleh agent pelaksana. Ubah `[ ]` menjadi `[x]` segera setelah setiap tahap benar-benar selesai dan terverifikasi.

### A. Baseline dan desain

- [x] Catat `git status` dan pertahankan perubahan user yang tidak terkait.
- [x] Baca dokumentasi Next.js lokal yang relevan sebelum mengubah route/page.
- [x] Jalankan baseline contract/unit tests Content Automation dan OPC.
- [x] Konfirmasi canonical storage `pillar_campaign_items` dan product tables.
- [ ] Tetapkan feature flag serta compatibility mapping `storyboard → creative`.

### B. Database dan repository

- [x] Tambahkan migrasi schedule/run product metadata.
- [x] Tambahkan migrasi OPC item pre-production/approval/ContentFlow status.
- [x] Tambahkan tabel asset per klip dan index.
- [x] Perbarui DB allowlist serta serializers.
- [x] Tambahkan repository query tenant-scoped dan transaction helpers.
- [x] Verifikasi migrasi idempotent pada database kosong dan schema `dev` yang sudah ada.

### C. Contract dan preset

- [x] Implementasikan `campaign_kind` normalization.
- [x] Implementasikan product field/count validation.
- [x] Implementasikan approval mode `creative/start_frames/none` plus legacy mapping.
- [x] Tambahkan `product_campaign_v1` OPC preset.
- [x] Tambahkan contract tests editorial dan product.

### D. Product lookup dan snapshot

- [x] Implementasikan eligible product options service.
- [x] Implementasikan endpoint product options tenant-scoped.
- [x] Implementasikan immutable run product snapshot.
- [x] Integrasikan campaign product binding/affiliate snapshot.
- [ ] Tambahkan audit event dan tests cross-tenant.

### E. OPC start-frame checkpoint

- [x] Implementasikan asset manifest per clip/revision.
- [ ] Implementasikan submit/poll/download/checksum non-blocking.
- [x] Implementasikan aggregate start-frame status.
- [x] Integrasikan tahap start frame ke OPC scheduler sebelum approval.
- [ ] Refactor endpoint regenerate/replace agar memakai service bersama.
- [ ] Tambahkan partial failure dan restart recovery tests.

### F. Approval

- [x] Implementasikan review artifact yang mencakup product snapshot dan start frames.
- [x] Implementasikan approval transaction/revision lock per item.
- [x] Implementasikan bulk approve eligible items.
- [x] Implementasikan partial approval lifecycle dan metrics.
- [ ] Implementasikan reject/hold semantics.
- [ ] Tambahkan stale revision, double-click, dan concurrent approval tests.

### G. Production dan ContentFlow

- [x] Pastikan production gate memerlukan approved revision.
- [ ] Tambahkan idempotency downstream TTS/video/FFmpeg.
- [x] Implementasikan item-level ContentFlow sync.
- [x] Implementasikan retry/backoff ContentFlow independen.
- [x] Implementasikan completed/completed-with-warnings semantics.
- [ ] Tambahkan ContentFlow duplicate/retry/failure tests.

### H. UI Content Automations

- [x] Tambahkan campaign type selector.
- [x] Tambahkan cascading Brand Profile → Product selector.
- [x] Tambahkan product completeness card.
- [x] Tambahkan Product Planner count dan OPC preset defaults.
- [x] Tambahkan start-frame approval mode dan ContentFlow toggle.
- [x] Tambahkan multi-stage run progress.
- [x] Tambahkan run detail/review drawer.
- [x] Tambahkan bulk approval confirmation dialog.
- [x] Tambahkan retry pre-production dan ContentFlow actions.
- [ ] Verifikasi accessibility dan responsive states.

### I. Observability dan operasional

- [x] Tambahkan audit events baru.
- [ ] Tambahkan notification events baru.
- [ ] Tambahkan structured log context tanpa secret.
- [ ] Tambahkan feature flag dan admin control.
- [ ] Dokumentasikan runbook retry/rollback.

### J. Verifikasi dan rilis

- [x] Jalankan lint dan test suite relevan. *(Tidak ada script lint; seluruh suite kontrak/integrasi relevan lulus.)*
- [x] Jalankan production build.
- [x] Deploy ke Server Dev Mac Mini dengan `npm run deploy:macmini-dev`.
- [x] Verifikasi remote build dan PM2 Dev tanpa polling SSH berulang.
- [x] Verifikasi UI Dev port 5020 dan API Dev port 7020.
- [x] Verifikasi seluruh query memakai database schema `dev` dan `PGPOOL_MAX=3`.
- [x] Selesaikan parity image reference initial/Regen sebelum pilot provider 6 item.
- [ ] Jalankan product pilot 6 item di Server Dev Mac Mini.
- [ ] Verifikasi approval per item OPC.
- [ ] Verifikasi bulk approval Content Automations.
- [ ] Verifikasi TTS → video → FFmpeg.
- [ ] Verifikasi automatic ContentFlow sync dan retry.
- [x] Jalankan health check environment Dev yang relevan.
- [x] Konfirmasi tidak ada deployment ke folder/port/schema Staging Mac Mini.
- [x] Perbarui changelog dan dokumentasi operasional.
- [x] Jalankan release non-interactive patch.
- [ ] Verifikasi commit, tag, dan push `main`.
- [x] Jangan deploy ke Server Staging Mac Mini.
- [x] Jangan deploy Production tanpa perintah manual eksplisit.
