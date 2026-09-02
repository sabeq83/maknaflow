# Implementation Plan — OPC ReGen Exclusive Reference Lane

## 1. Objective

Menutup gap orchestration yang membuat manual ReGen Start Frame Product Bridge berjalan paralel lintas baris walaupun payload referensinya sudah benar. Implementasi mencakup tujuh perbaikan:

1. memindahkan single ReGen ke durable queue;
2. menerapkan exclusive provider-level image lane;
3. membuat non-product T2I ikut menghormati Product Bridge exclusive lane;
4. menampilkan queued/running state tingkat campaign/lane pada UI;
5. menyimpan output dengan filename revisioned dan immutable;
6. melengkapi audit database dan lifecycle audit;
7. menambahkan concurrency regression test lintas item serta normalisasi pointer foto legacy.

Target alur:

```text
User clicks ReGen on rows 1, 2, 3
          ↓
API validates canonical request and creates durable revisions
          ↓
normal T2I waits for exclusive task / Product Bridge waits for all active T2I
          ↓
one provider task owns the exclusive lane until completed/failed
          ↓
revisioned immutable output is stored and selected as active revision
```

## 2. Incident Baseline

Campaign Dev `opc_260902_lurhc1` membuktikan:

- initial dan manual ReGen item 215–217 clip 3 memakai `clean_photo_url` dan SHA reference yang sama;
- prompt SHA dan request fingerprint initial/ReGen sama per item;
- manual ReGen item 217 clip 3, item 216 clip 3, dan item 215 clip 3 disubmit dalam rentang 12 detik;
- item 217 clip 2 non-product ikut overlap satu detik sebelum Product Bridge;
- hasil ReGen mengalami redesign produk, sedangkan initial yang serial mempertahankan identitas;
- endpoint manual saat ini melakukan submit/poll langsung dan UI hanya mengunci `itemId_clipIdx`.

Baseline ini harus dijadikan fixture/timeline pada regression test. Jangan mengubah kembali named reference, `@tag`, canonical Clean/Raw resolver, atau model `nano_banana_2`.

## 3. Architectural Decisions

### 3.1 One durable path

- Single ReGen, bulk ReGen, dan recovery memakai `pillar_campaign_item_assets` serta `start-frame-worker`.
- Endpoint single ReGen tidak menunggu G-Labs dan mengembalikan HTTP `202` dengan `asset_id`, `revision`, dan status `queued`.
- Initial generation boleh tetap berada di processor saat ini pada fase ini, tetapi wajib memakai service provider-lane yang sama sebelum submit dan selama poll. Target lanjutan dapat memindahkan initial ke durable assets tanpa diperlukan oleh patch ini.
- Tidak boleh ada implementasi kedua untuk resolver foto, base64, named object, `@tag`, model, atau audit request.

### 3.2 Provider lane scope

Lane key diturunkan server-side dari endpoint efektif:

```text
sha256(normalized webhook_host + ':' + webhook_port + ':image')
```

- Jangan masukkan API key ke lane key atau log.
- Brand webhook override menghasilkan lane berbeda bila host/port berbeda.
- Semua OPC start-frame submissions pada lane yang sama harus terdaftar, termasuk initial, single ReGen, bulk ReGen, dan recovery.
- Scope bukan hanya `campaign_item_id`; incident membuktikan item-level isolation tidak cukup.

### 3.3 Shared/exclusive semantics

- T2I biasa memperoleh shared slot.
- Product Bridge/reference-critical memperoleh exclusive slot.
- Exclusive hanya dapat acquired jika tidak ada shared/exclusive owner aktif.
- Shared tidak dapat acquired ketika exclusive owner aktif atau exclusive waiter yang lebih tua sudah antre; aturan waiter mencegah starvation.
- Lease hidup sampai provider task terminal dan diperbarui oleh heartbeat/poll.
- Crash recovery membebaskan lease expired setelah mengecek status durable asset.
- Gunakan transaksi PostgreSQL dan row locking/advisory transaction lock; dilarang check-then-act hanya di JavaScript.
- `/api/health` hanya telemetry tambahan, bukan sumber lock.

### 3.4 Revision and immutability

- Setiap attempt yang menghasilkan provider task mempunyai revision/attempt identity unik.
- Filename memuat item, clip, revision, dan task ID yang disanitasi.
- Jangan overwrite output lama.
- `t2i_images_json` hanya menunjuk output aktif terbaru setelah download sukses dan transaksi DB selesai.
- Output gagal/terlambat tidak boleh menggeser revision aktif yang lebih baru.

### 3.5 UI behavior

- User boleh menekan ReGen pada beberapa baris; semua masuk queue.
- UI menampilkan `Queued`, `Waiting for exclusive lane`, `Generating`, `Downloading`, atau `Completed/Failed`.
- Disable hanya untuk duplicate active request pada item+clip yang sama.
- Campaign/lane banner menjelaskan bahwa Product Bridge dikerjakan satu per satu.
- UI bukan enforcement boundary; API dan worker tetap aman bila request datang dari curl atau node lain.

## 4. Data Model

### 4.1 `glabs_image_lane_leases`

```sql
CREATE TABLE glabs_image_lane_leases (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  lane_key TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('shared', 'exclusive')),
  owner_kind TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  campaign_id TEXT,
  campaign_item_id TEXT,
  asset_id TEXT,
  provider_task_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('waiting', 'active', 'released', 'expired')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acquired_at TIMESTAMPTZ,
  heartbeat_at TIMESTAMPTZ,
  lease_expires_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  release_reason TEXT,
  UNIQUE (lane_key, owner_kind, owner_id)
);
```

Gunakan index parsial untuk waiter dan active lease. Mutual exclusion tetap ditegakkan dalam transaksi service, bukan diasumsikan dari unique constraint sederhana.

### 4.2 Asset lifecycle additions

Tambahkan bila belum tersedia:

```sql
ALTER TABLE pillar_campaign_item_assets
  ADD COLUMN IF NOT EXISTS lane_key TEXT,
  ADD COLUMN IF NOT EXISTS lane_mode TEXT,
  ADD COLUMN IF NOT EXISTS lane_lease_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS download_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ;
```

Status durable yang dipakai:

```text
queued → waiting_lane → processing → provider_processing
→ downloading → completed | failed | retry_wait | superseded
```

## 5. File-by-File Changes

### 5.1 `lib/db-pg.js`

**Code Sebelum (Current/Before)**

```js
ALTER TABLE pillar_campaign_item_assets
  ADD COLUMN IF NOT EXISTS reference_critical BOOLEAN NOT NULL DEFAULT FALSE;
```

**Code Sesudah (Proposed/After)**

```js
await migrateGlabsImageLanes(client); // additive and idempotent

// Creates glabs_image_lane_leases, asset lifecycle columns,
// partial indexes, status compatibility migration, and no destructive rewrite.
```

Migrasi tidak menghapus kolom/data legacy dan aman dijalankan berulang pada Dev/Staging/Production.

### 5.2 `lib/glabs-image-lane-service.js` — new

**Code Sebelum (Current/Before)**

```js
// No provider-level shared/exclusive lane service exists.
```

**Code Sesudah (Proposed/After)**

```js
export function buildGlabsImageLaneKey(webhookOverride) {}
export async function requestImageLane(context) {}
export async function tryAcquireImageLane(leaseId) {}
export async function attachProviderTask(leaseId, taskId) {}
export async function heartbeatImageLane(leaseId) {}
export async function releaseImageLane(leaseId, reason) {}
export async function recoverExpiredImageLanes() {}
export async function getCampaignImageLaneState(campaignId) {}
```

Acquire transaction harus:

1. lock lane namespace dengan PostgreSQL transaction-level advisory lock;
2. expire stale owners secara bounded;
3. menerapkan FIFO waiter priority;
4. menolak exclusive bila owner apa pun aktif;
5. menolak shared bila exclusive aktif atau exclusive waiter lebih tua;
6. mengubah waiter menjadi active secara atomik;
7. tidak menahan koneksi database selama provider task berjalan.

### 5.3 `lib/start-frame-provider-adapter.js`

**Code Sebelum (Current/Before)**

```js
const built = await buildOpcStartFrameRequest(context);
const result = await generateImage(built.providerRequest);
return { taskId: result.task_id };
```

**Code Sesudah (Proposed/After)**

```js
const built = await buildOpcStartFrameRequest(context);
const lease = await requestImageLane({
  mode: built.audit.requires_product_reference ? 'exclusive' : 'shared',
  webhookOverride: built.providerRequest.webhookOverride,
  ownerKind: 'start_frame_asset',
  ownerId: request.assetId,
  ...contextIds
});

if (!lease.acquired) return { status: 'waiting_lane', leaseId: lease.id };
const result = await generateImage(built.providerRequest);
await attachProviderTask(lease.id, result.task_id);
return { status: 'submitted', taskId: result.task_id, leaseId: lease.id };
```

Adapter wajib me-release lease jika submit gagal sebelum task ID terbentuk. Poll terminal me-release lease dengan reason yang sesuai.

### 5.4 `lib/pillar-start-frame-service.js`

**Code Sebelum (Current/Before)**

```sql
-- Isolation only compares sibling.campaign_item_id = c.campaign_item_id
```

**Code Sesudah (Proposed/After)**

```js
export async function queueSingleStartFrameRevision(itemId, clip, options) {}
export async function activateCompletedStartFrame(assetId, localPath) {}

// Asset claiming handles durable row ownership only.
// Provider concurrency is delegated to glabs-image-lane-service.
```

- Server menghitung `reference_critical` dari campaign/item/clip.
- Queue menolak duplicate nonterminal asset untuk item+clip dengan idempotency key.
- Activation memakai transaction dan membandingkan revision agar late result tidak mengganti newer active revision.
- Isolation SQL item-level lama boleh dipertahankan sebagai defense-in-depth, tetapi tidak dianggap provider-level lock.

### 5.5 `lib/start-frame-worker.js`

**Code Sebelum (Current/Before)**

```js
if (!asset.provider_task_id) {
  const submitted = await startFrameProviderAdapter.submit(...);
  // immediately transitions to provider_processing
}
```

**Code Sesudah (Proposed/After)**

```js
if (!asset.provider_task_id) {
  const submitted = await startFrameProviderAdapter.submit({
    assetId: asset.id,
    context: parseJson(asset.request_json).context
  });
  if (submitted.status === 'waiting_lane') {
    return releaseAssetForLaneRetry(asset, submitted.leaseId);
  }
  return markProviderProcessing(asset, submitted);
}

await heartbeatImageLane(asset.lane_lease_id);
const result = await startFrameProviderAdapter.poll(...);
```

Pada terminal success/failure/timeout, release lease dalam `finally` yang idempotent. Recovery worker menjalankan `recoverExpiredImageLanes()` sebelum claim.

### 5.6 `app/api/v2/pillar-campaigns/items/[itemId]/regenerate-t2i/route.js`

**Code Sebelum (Current/Before)**

```js
const builtRequest = await buildOpcStartFrameRequest(...);
const t2iResult = await generateImage(builtRequest.providerRequest);
for (...) {
  await sleep(4000);
  await getTaskStatus(t2iTaskId);
}
// download and overwrite opc_start_frame_<item>_clip_<clip>.png
```

**Code Sesudah (Proposed/After)**

```js
const preflight = await buildOpcStartFrameRequest(...);
const queued = await queueSingleStartFrameRevision(itemId, {
  clip_index: Number(clipIndex),
  context: canonicalContext,
  audit: safePreflightAudit
}, { idempotencyKey });

return NextResponse.json({
  success: true,
  status: 'queued',
  assetId: queued.assetId,
  revision: queued.revision
}, { status: 202 });
```

Route tidak mengimpor `generateImage`, `getTaskStatus`, `getFileUrl`, `fs`, atau menulis file hasil.

### 5.7 `lib/scheduler-processors.js`

**Code Sebelum (Current/Before)**

```js
const t2iResult = await submitStartFrame(clipIndex, promptText);
await pollAndDownload(t2iResult.task_id);
```

**Code Sesudah (Proposed/After)**

```js
const execution = await withGlabsImageLane({
  mode: requiresProductReference ? 'exclusive' : 'shared',
  ownerKind: 'pillar_initial',
  ownerId: `${item.id}:${clipIndex}:${generationAttempt}`,
  webhookOverride
}, async lane => {
  const result = await submitStartFrame(...);
  await attachProviderTask(lane.id, result.task_id);
  return pollDownloadAndAudit(result.task_id, lane);
});
```

Pertahankan before-bridge drain → isolated bridge → after-bridge. Provider lane melindungi dari task campaign/item lain. Heartbeat dilakukan selama polling dan release selalu idempotent.

### 5.8 `app/pillar-campaigns/[id]/page.js`

**Code Sebelum (Current/Before)**

```js
const taskKey = `${item.id}_${clipIdx}`;
setRegeneratingT2I(prev => ({ ...prev, [taskKey]: true }));
await fetch('/regenerate-t2i'); // waits until image completed
```

**Code Sesudah (Proposed/After)**

```js
const response = await fetch('/regenerate-t2i', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': crypto.randomUUID()
  },
  body: JSON.stringify(...)
});

// 202: display durable asset status from campaign detail polling.
// Keep other clicks queueable; disable only duplicate active item+clip.
```

Tambahkan campaign-level banner dan status per clip. Jangan membuat timer polling lebih agresif dari interval UI existing; gunakan campaign detail refresh yang sudah tersedia.

### 5.9 Campaign detail API/repository used by `app/pillar-campaigns/[id]/page.js`

**Code Sebelum (Current/Before)**

```js
// Response exposes item.regenerate_start_frames_status/progress,
// but not latest per-clip durable asset/lane state.
```

**Code Sesudah (Proposed/After)**

```js
item.start_frame_asset_states = [
  {
    clip_index,
    revision,
    status,
    reference_critical,
    lane_status,
    created_at,
    completed_at,
    error_code,
    error_message
  }
];
campaign.image_lane_state = {
  has_exclusive_active,
  exclusive_waiting_count,
  shared_active_count
};
```

Jangan expose host, port, API key, base64, atau raw internal request JSON.

### 5.10 Start-frame storage path in `lib/start-frame-worker.js` and initial save helper

**Code Sebelum (Current/Before)**

```js
const filename = `opc_start_frame_${itemId}_clip_${clipIndex}.png`;
```

**Code Sesudah (Proposed/After)**

```js
const filename = buildRevisionedStartFrameFilename({
  itemId,
  clipIndex,
  revision,
  providerTaskId,
  extension: detectedExtension
});
// opc_start_frame_215_clip_3_r2_e8aff610.png
```

Tambahkan shared filename/path helper. Verifikasi MIME dari response bytes; jangan selalu memberi `.png` pada JPEG/WEBP. Aktivasi DB hanya setelah atomic file write sukses.

### 5.11 `lib/opc-start-frame-audit.js` and audit migration in `lib/db-pg.js`

**Code Sebelum (Current/Before)**

```js
INSERT (... reference_sha256, prompt_sha256,
  request_fingerprint, provider_task_id)
```

**Code Sesudah (Proposed/After)**

```js
await createStartFrameRequestAudit({
  ...safeAudit,
  lifecycle_status: 'prepared',
  lane_key,
  lane_mode
});

await updateStartFrameRequestAudit(auditId, {
  lifecycle_status: 'submitted',
  provider_task_id,
  lane_wait_started_at,
  lane_acquired_at,
  sibling_active_count_at_submit
});
```

Kolom additive:

```text
reference_name, reference_position, reference_mime_type,
reference_byte_length, requested_model, effective_model,
lane_key, lane_mode, lane_wait_started_at, lane_acquired_at,
sibling_active_count_at_submit, lifecycle_status,
provider_submitted_at, provider_completed_at
```

Audit dibuat sebelum submit agar failed submission tetap tercatat. Tidak boleh ada base64, API key, atau prompt plaintext.

### 5.12 `app/api/v2/products/[id]/route.js` and `app/products/page.js`

**Code Sebelum (Current/Before)**

```js
active_photo: body.active_photo
```

Legacy rows dapat berisi:

```text
active_photo=generated_photo_url, generated_photo_url=NULL
```

**Code Sesudah (Proposed/After)**

```js
const activePhoto = normalizeCanonicalActivePhoto(body.active_photo);
// Only clean_photo_url | raw_photo_url
```

- UI hanya mengirim dua nilai kanonis.
- API menolak nilai active baru di luar enum.
- Read path dapat menormalisasi legacy invalid ke Clean bila tersedia, kemudian Raw.
- Sediakan script migrasi data idempotent; jangan langsung `UPDATE` production saat test.

### 5.13 `scripts/normalize-product-active-photo.mjs` — new

**Code Sebelum (Current/Before)**

```js
// No bounded dry-run normalization script.
```

**Code Sesudah (Proposed/After)**

```js
// Default dry-run; requires --apply and explicit --schema.
// Invalid/legacy pointer → clean_photo_url if present, else raw_photo_url.
// Prints counts and product IDs only; no image bytes or credentials.
```

Script harus tenant-aware, transactional, dan tidak dijalankan pada Production tanpa instruksi manual eksplisit.

### 5.14 Tests

Files:

- `tests/glabs-image-lane-service.test.js` — new
- `tests/start-frame-isolation.test.js` — extend
- `tests/opc-single-regen-queue.test.js` — new
- `tests/start-frame-revision-storage.test.js` — new
- `tests/opc-start-frame-audit.test.js` — extend/new
- `tests/product-active-photo-contract.test.js` — new
- `scripts/test-opc-start-frame-reference-integration.mjs` — extend

**Code Sebelum (Current/Before)**

```js
assert.equal(bridge.required, true);
// No assertion that manual ReGen bypasses direct provider calls.
// No cross-item overlap timeline.
```

**Code Sesudah (Proposed/After)**

```js
await enqueue('215:3:exclusive');
await enqueue('217:2:shared');
await enqueue('217:3:exclusive');
await enqueue('216:3:exclusive');

assert.equal(maxExclusiveConcurrency, 1);
assert.equal(overlapBetweenExclusiveAndAnyTask, 0);
assert.equal(singleRegenRouteDirectProviderCalls, 0);
assertRevisionFilesAreUniqueAndLateResultsCannotWin();
```

Wajib menguji dua process/worker claims terhadap PostgreSQL transaction semantics, lease expiry/recovery, FIFO exclusive waiter, submit failure, provider failure, timeout, duplicate idempotency key, dan restart recovery.

## 6. API Contract

### ReGen request

```http
POST /api/v2/pillar-campaigns/items/:itemId/regenerate-t2i
Idempotency-Key: <uuid>
Content-Type: application/json

{
  "clipIndex": 3,
  "t2i_prompt": "..."
}
```

### Accepted response

```json
{
  "success": true,
  "status": "queued",
  "assetId": "pcia_...",
  "revision": 2,
  "referenceCritical": true
}
```

### Duplicate active response

Return existing asset id idempotently for the same idempotency key. For a different key targeting the same active item+clip, return `409` with existing asset metadata or coalesce explicitly; do not create two concurrent revisions ambiguously.

## 7. Acceptance Criteria

1. Single ReGen endpoint makes zero direct calls to G-Labs and zero output file writes.
2. Three rapid Product Bridge ReGen clicks across three items become durable queued assets.
3. Only one exclusive owner exists per effective G-Labs image lane.
4. No shared T2I overlaps an active exclusive Product Bridge on the same lane.
5. Initial generation obeys the same provider lane, not only its local before/bridge/after partition.
6. Lease remains active from before provider submit through completed/failed/timeout and download transition as designed.
7. Crash/stale lease recovery is bounded and does not permit duplicate provider submit.
8. UI shows queued/waiting/generating state without holding a request for up to 160 seconds.
9. Every output filename is revisioned and immutable.
10. Late completion cannot replace a newer active revision.
11. Audit stores named reference/model/lane/lifecycle metadata without base64 or secrets.
12. Canonical reference, `@tag`, reference index 0, SHA guard, polling 4/5 seconds, and `nano_banana_2` remain unchanged.
13. New writes to `active_photo` are only `clean_photo_url` or `raw_photo_url`.
14. All unit, DB concurrency, integration, lint, and build verification pass.
15. Dev smoke reproducing the incident timeline produces serialized provider task timestamps and faithful product identity.

## 8. Verification Sequence

```bash
node --test tests/glabs-image-lane-service.test.js
node --test tests/start-frame-isolation.test.js
node --test tests/opc-single-regen-queue.test.js
node --test tests/start-frame-revision-storage.test.js
node --test tests/opc-start-frame-audit.test.js
node --test tests/product-active-photo-contract.test.js
node scripts/test-opc-start-frame-reference.mjs
node scripts/test-opc-start-frame-reference-integration.mjs
npm test -- --runInBand
npm run lint
npm run build
```

Dev smoke:

1. buat atau gunakan campaign non-production dengan tiga item Product Bridge;
2. klik ReGen ketiganya dengan cepat dan satu non-product ReGen;
3. verifikasi API segera mengembalikan `202`;
4. verifikasi database menunjukkan FIFO wait dan tidak ada overlap;
5. verifikasi provider task submit timestamps serial;
6. inspeksi hasil visual terhadap Clean photo;
7. verifikasi setiap revision tetap tersedia;
8. jangan gunakan campaign user aktif tanpa persetujuan dan jangan deploy Production.

## 9. Rollback

- Schema additive tetap dibiarkan.
- Feature flag dapat menghentikan campaign-level UI queue state, tetapi tidak boleh mengaktifkan kembali direct synchronous ReGen secara diam-diam.
- Jika lane service bermasalah, pause start-frame worker dan tampilkan actionable failure; jangan fallback ke concurrent direct provider calls.
- Revisioned files aman dipertahankan.
- Named reference, canonical resolver, and `nano_banana_2` tidak ikut rollback.

## Execution Task List

- [ ] Rekam baseline test dari timeline incident `opc_260902_lurhc1` tanpa menyimpan base64.
- [ ] Tambahkan migrasi table/index provider lane dan lifecycle asset secara idempotent.
- [ ] Implementasikan shared/exclusive lane service dengan transaction lock, FIFO, lease, heartbeat, dan recovery.
- [ ] Integrasikan lane service ke provider adapter dan durable worker.
- [ ] Ubah single ReGen menjadi durable `202 queued` dengan idempotency dan tanpa direct provider call.
- [ ] Integrasikan initial Pillar generation/recovery ke provider lane yang sama.
- [ ] Pastikan shared non-product dan exclusive Product Bridge saling memblokir sesuai kontrak.
- [ ] Tambahkan campaign/clip queue state pada detail API dan UI.
- [ ] Implementasikan immutable revisioned filenames dan transaction-safe activation.
- [ ] Lengkapi audit schema serta prepared/submitted/terminal lifecycle writes.
- [ ] Normalisasi kontrak `active_photo` pada UI/API dan buat dry-run migration script.
- [ ] Tambahkan seluruh unit, concurrency, integration, recovery, and regression tests.
- [ ] Jalankan test, lint, build, dan Dev provider smoke terkontrol.
- [ ] Perbarui checklist ini menjadi `[x]` segera setelah setiap tahap selesai.
- [ ] Jalankan release patch non-interaktif serta verifikasi changelog, commit, tag, branch `main`, dan remote sesuai SOP.

