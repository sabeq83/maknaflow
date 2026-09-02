# Implementation Plan — OPC Product Bridge Reference Integrity

## 1. Objective

Memperbaiki konsistensi identitas produk pada start frame Product Bridge di Pillar Campaign dengan enam perubahan terukur:

1. memakai kontrak foto produk kanonis dua-field (`raw_photo_url` dan `clean_photo_url`);
2. mengirim named reference object dan mengikatnya melalui `@tag` sesuai `docs/WEBHOOK_INTEGRATION.en.md`;
3. mengisolasi task Product Bridge dari task start-frame sibling yang masih aktif;
4. memakai interval polling tetap 4 detik (di dalam rekomendasi G-Labs 3–5 detik);
5. memakai `nano_banana_2` untuk T2I Pillar;
6. menghapus model YouTube tidak valid `imagen_3` dan memakai konfigurasi G-Labs eksplisit dengan fallback `nano_banana_2`.

Target perilaku:

```text
Product DB
  ├─ clean_photo_url (default bila tersedia)
  └─ raw_photo_url   (bila dipilih user atau clean belum tersedia)
           ↓
canonical reference + SHA-256
           ↓
{ data, category: "subject", name: "product_truth_<id>.<ext>" }
           ↓
prompt menyebut @product_truth_<id>
           ↓
reference-critical isolated submit → poll 4s → download
```

## 2. Decisions and Non-Goals

### 2.1 Canonical product-photo contract

- Hanya `clean_photo_url` dan `raw_photo_url` yang boleh dipakai oleh pipeline baru.
- `active_photo` adalah pointer, bukan foto ketiga, dan dinormalisasi ke `clean_photo_url | raw_photo_url`.
- Jika `active_photo` kosong/tidak valid: pilih Clean, kemudian Raw.
- Jika pilihan user menunjuk file yang hilang, fail preflight dengan error terstruktur; jangan diam-diam memakai foto lain.
- `cleaned_photo_url`, `generated_photo_url`, dan `photo_url` tidak dipakai resolver Product Bridge baru.
- Kolom legacy tidak dihapus pada pekerjaan ini karena masih dibaca integrasi lama.

### 2.2 G-Labs reference contract

- String reference tetap diterima untuk backward compatibility.
- Named object resmi yang didukung:

```js
{ data: 'data:image/png;base64,...', category: 'subject', name: 'product_truth_pe_123.png' }
```

- SHA, MIME, byte length, deduplication, dan invariant dihitung dari `reference.data`.
- Nama harus disanitasi, stabil, unik, dan tidak mengandung path.
- Product reference ditempatkan pertama pada Product Bridge.
- Prompt memakai tag penuh yang sama dengan stem filename, misalnya `@product_truth_pe_123`.
- Jangan mengirim field `role`, `reference_manifest`, atau field nonstandar lain ke G-Labs.

### 2.3 Isolation contract

- Manual single regen sudah isolated dan tidak memerlukan global lock baru.
- Initial Pillar generation harus menyelesaikan semua task sebelum bridge, lalu menjalankan setiap Product Bridge clip sendiri sampai terminal, baru melanjutkan task setelah bridge.
- Durable bulk regen menandai asset Product Bridge sebagai `reference_critical` dan tidak boleh menjalankannya bersamaan dengan sibling asset pada campaign item yang sama.
- Isolation dibatasi per `tenant_id + campaign_item_id`; campaign lain tidak perlu ikut berhenti.
- Jangan memakai angka global `/api/health.tasks_running` sebagai lock karena angka itu juga mencakup task campaign/tenant lain.

### 2.4 Polling and model

- Konstanta polling image G-Labs: `GLABS_IMAGE_POLL_INTERVAL_MS = 4000`.
- Tidak memakai random polling; 4 detik deterministik mempermudah test.
- Pillar Product Bridge dan start-frame Pillar lain memakai `nano_banana_2` secara eksplisit.
- YouTube membaca setting G-Labs yang khusus/bersama dan fallback ke `nano_banana_2`; tidak ada `imagen_3`.
- Perubahan tidak menyentuh model video Veo, product Re-Gen Photo provider selection, maupun model image provider non-G-Labs.

## 3. File-by-File Changes

### 3.1 `lib/product-reference-resolver.js`

**Code Sebelum (Current/Before)**

```js
export const ACTIVE_PHOTO_FIELDS = Object.freeze([
  'clean_photo_url', 'cleaned_photo_url', 'generated_photo_url',
  'raw_photo_url', 'photo_url'
]);

function campaignPhotoCandidates(product, fallbackPaths = []) {
  return [
    product?.clean_photo_url,
    product?.cleaned_photo_url,
    product?.photo_url,
    product?.raw_photo_url,
    ...fallbackPaths
  ];
}
```

**Code Sesudah (Proposed/After)**

```js
export const CANONICAL_PRODUCT_PHOTO_FIELDS = Object.freeze([
  'clean_photo_url', 'raw_photo_url'
]);

function resolveCanonicalSelection(product) {
  const selected = product?.active_photo === 'raw_photo_url'
    ? 'raw_photo_url'
    : 'clean_photo_url';
  const fallback = selected === 'clean_photo_url' ? 'raw_photo_url' : null;
  return { selected, fallback };
}

export function resolveCampaignProductReference({ product, cwd }) {
  // Explicit user selection must exist; otherwise fail preflight.
  // Without explicit selection: clean → raw.
}
```

Tambahkan reason/error code yang membedakan `PRODUCT_REFERENCE_MISSING`, `SELECTED_PRODUCT_REFERENCE_MISSING`, dan format image tidak valid.

### 3.2 `app/products/page.js`

**Code Sebelum (Current/Before)**

```js
const colName = tabType === 'raw'
  ? 'raw_photo_url'
  : (tabType === 'cleaned' ? 'cleaned_photo_url' : 'generated_photo_url');
```

**Code Sesudah (Proposed/After)**

```js
const colName = tabType === 'raw' ? 'raw_photo_url' : 'clean_photo_url';
```

UI tetap hanya memiliki Raw dan Clean. Hapus cabang `generated` dari handler aktif, bukan dari migrasi database.

### 3.3 `lib/base64-image-reference.js`

**Code Sebelum (Current/Before)**

```js
export function inspectBase64ImageReference(reference) {
  const match = typeof reference === 'string'
    ? reference.match(DATA_URI_PATTERN)
    : null;
}
```

**Code Sesudah (Proposed/After)**

```js
export function getReferenceData(reference) {
  if (typeof reference === 'string') return reference;
  if (reference && typeof reference === 'object') return reference.data;
  return null;
}

export function inspectBase64ImageReference(reference) {
  const data = getReferenceData(reference);
  // validate data URI, magic bytes, MIME, minimum provider size, SHA-256
  // validate optional category/name without logging base64
}
```

Object name harus memakai basename aman, ekstensi sesuai MIME, dan batas panjang. Pertahankan dukungan string lama.

### 3.4 `lib/opc-start-frame-request.js`

**Code Sebelum (Current/Before)**

```js
const references = uniqueDataReferences([
  ...safeContextReferences,
  ...(reference ? [reference.base64DataUrl] : [])
]);
```

**Code Sesudah (Proposed/After)**

```js
const productTag = `product_truth_${sanitizeTag(product.id)}`;
const productReference = {
  data: reference.base64DataUrl,
  category: 'subject',
  name: `${productTag}.${extensionForMime(reference.mimeType)}`
};

const references = uniqueImageReferences([
  productReference,
  ...safeContextReferences
]);

const providerPrompt = lockProductIdentityPrompt(prompt, product, productTag);
// provider prompt explicitly mentions @${productTag}
```

Audit ditambah metadata aman: `reference_kind`, `reference_name`, `reference_position`, dan `model`, tanpa base64. Fingerprint wajib sama untuk initial dan manual regen jika input sama.

### 3.5 `lib/webhook-client.js`

**Code Sebelum (Current/Before)**

```js
const primaryModel = model || getSetting('webhook_image_model') || 'nano_banana_pro';
const referenceMetadata = inspectBase64ImageReferences(reference_images || []);
```

**Code Sesudah (Proposed/After)**

```js
export const GLABS_IMAGE_MODEL = 'nano_banana_2';
export const GLABS_IMAGE_POLL_INTERVAL_MS = 4000;

const primaryModel = normalizeGlabsImageModel(model || GLABS_IMAGE_MODEL);
const referenceMetadata = inspectBase64ImageReferences(reference_images || []);
```

Normalizer hanya menerima model resmi dokumentasi. Jangan mengubah fallback quota secara rekursif menjadi model yang tidak diminta tanpa audit `requested_model` dan `effective_model`.

### 3.6 `lib/scheduler-processors.js`

**Code Sebelum (Current/Before)**

```js
const t2iPattern = getSetting('webhook_t2i_pattern') || 'threading';
for (let c = 1; c <= targetClips; c++) {
  const t2iResult = await submitStartFrame(c, t2iPromptText);
  submittedTasks.push(...);
}
```

**Code Sesudah (Proposed/After)**

```js
const phases = partitionStartFramesByReferenceCriticality(clips, {
  bridgeStart,
  bridgeDuration
});

await runThreadedAndDrain(phases.beforeBridge);
for (const bridgeClip of phases.referenceCritical) {
  await submitPollAndDownload(bridgeClip, {
    model: 'nano_banana_2',
    pollIntervalMs: GLABS_IMAGE_POLL_INTERVAL_MS
  });
}
await runThreadedAndDrain(phases.afterBridge);
```

Semua helper wajib mempertahankan mapping `clipIndex → output path`, error propagation, task-route-aware download, dan audit. Ganti polling 2 detik hanya pada jalur image/start-frame yang termasuk scope; jangan mengubah polling TTS/video secara mekanis.

### 3.7 `app/api/v2/pillar-campaigns/items/[itemId]/regenerate-t2i/route.js`

**Code Sebelum (Current/Before)**

```js
await new Promise(resolve => setTimeout(resolve, 2000));
```

**Code Sesudah (Proposed/After)**

```js
await new Promise(resolve => setTimeout(
  resolve,
  GLABS_IMAGE_POLL_INTERVAL_MS
));
```

Endpoint harus tetap memakai builder bersama; dilarang membuat ulang resolver/base64 lokal.

### 3.8 `lib/db-pg.js`

**Code Sebelum (Current/Before)**

```sql
pillar_campaign_item_assets (... request_json JSONB ...)
```

**Code Sesudah (Proposed/After)**

```sql
ALTER TABLE pillar_campaign_item_assets
  ADD COLUMN IF NOT EXISTS reference_critical BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS pillar_campaign_item_assets_isolation_idx
  ON pillar_campaign_item_assets
  (tenant_id, campaign_item_id, reference_critical, status, next_attempt_at);
```

Migrasi harus idempotent dan mengikuti mekanisme migrasi PostgreSQL yang sudah ada.

### 3.9 `lib/pillar-start-frame-service.js`

**Code Sebelum (Current/Before)**

```js
INSERT INTO pillar_campaign_item_assets (..., request_json)
VALUES (..., $7)
```

**Code Sesudah (Proposed/After)**

```js
const referenceCritical = resolveProductReferenceRequirement({
  campaign, item, clipIndex: clip.clip_index
}).required;

INSERT INTO pillar_campaign_item_assets (..., request_json, reference_critical)
VALUES (..., $7, $8)
```

Nilai critical dihitung server-side dari kontrak bridge, bukan dipercaya dari request browser.

### 3.10 `lib/start-frame-worker.js`

**Code Sebelum (Current/Before)**

```js
for (let index = 0; index < 4; index++) {
  const asset = await claimStartFrameAsset(workerId);
  if (!asset) break;
  await processAsset(asset);
}
```

**Code Sesudah (Proposed/After)**

```js
// Claim rules per campaign_item_id:
// - critical may start only when no sibling is processing/provider_processing;
// - non-critical may not start while critical is processing/provider_processing;
// - once submitted, critical retains the isolation gate until terminal state.
const asset = await claimIsolatedStartFrameAsset(workerId);
```

Polling durable worker tetap 5 detik saat ini dan sudah memenuhi 3–5 detik; pertahankan 5 detik. Tambahkan concurrency test agar dua worker tidak dapat melanggar gate.

### 3.11 `lib/youtube-studio-start-frame-adapter.js`

**Code Sebelum (Current/Before)**

```js
let modelKey = 'imagen_3';
if (profile?.key === 'google_flow_veo_3_1_lite') {
  modelKey = 'imagen_3';
}
```

**Code Sesudah (Proposed/After)**

```js
const configuredModel = await getSetting('webhook_image_model');
const modelKey = normalizeGlabsImageModel(
  profile?.image_model || configuredModel || 'nano_banana_2'
);
```

Jangan menyimpulkan image model dari nama profile video. Tambahkan named character reference `@tag` hanya jika prompt ikut diperbarui dan test membuktikan binding; product fix tidak boleh meregresi character continuity.

### 3.12 Tests and verification scripts

File yang ditambah/diperbarui:

- `scripts/test-opc-start-frame-reference.mjs`
- `scripts/test-opc-start-frame-reference-integration.mjs`
- `tests/base64-image-reference.test.js` (baru bila suite memakai Node test)
- `tests/start-frame-isolation.test.js` (baru)
- `tests/youtube-start-frame-model.test.js` (baru)

**Code Sebelum (Current/Before)**

```js
assert.equal(initial.audit.reference_source_field, 'clean_photo_url');
assert.deepEqual(initial.providerRequest.reference_images,
  regen.providerRequest.reference_images);
```

**Code Sesudah (Proposed/After)**

```js
assert.deepEqual(canonicalFieldsUsed, ['clean_photo_url', 'raw_photo_url']);
assert.equal(productRef.name, `product_truth_${product.id}.png`);
assert.match(initial.providerRequest.prompt, new RegExp(`@product_truth_${product.id}`));
assert.equal(inspectBase64ImageReference(productRef).sha256, expectedSha);
assert.equal(initial.audit.request_fingerprint, regen.audit.request_fingerprint);
assertNoOverlap(referenceCriticalTask, siblingTasks);
assert.equal(youtubeRequest.model, 'nano_banana_2');
assert.doesNotMatch(youtubeSource, /imagen_3/);
```

Tambahkan fixture untuk:

- active Clean;
- active Raw;
- active kosong dengan Clean tersedia;
- Clean tidak tersedia, Raw tersedia;
- explicit selected path hilang;
- named object valid dan MIME mismatch;
- duplicate object dengan data SHA sama;
- beberapa character references plus Product reference pada posisi pertama;
- initial/manual regen parity;
- two-worker isolation;
- model invalid dinormalisasi atau ditolak sesuai kontrak yang dipilih.

## 4. Acceptance Criteria

1. Product Bridge tidak membaca `cleaned_photo_url`, `generated_photo_url`, atau `photo_url`.
2. UI hanya menulis `active_photo=clean_photo_url|raw_photo_url`.
3. Payload Product Bridge memakai object reference bernama dan prompt berisi `@tag` yang cocok.
4. Product reference berada pada index 0 dan SHA payload sama dengan file kanonis.
5. Initial generation dan manual regen menghasilkan fingerprint identik untuk input identik.
6. Tidak ada sibling start-frame task pada item yang sama berstatus provider-active ketika Product Bridge disubmit/diproses.
7. Polling synchronous image memakai 4 detik; durable worker tetap 5 detik.
8. Semua T2I Pillar yang termasuk scope mengirim model `nano_banana_2`.
9. YouTube tidak lagi mengirim `imagen_3` dan model efektifnya tercatat sebagai `nano_banana_2` atau model resmi G-Labs yang dikonfigurasi.
10. Existing string references dan character references tetap valid.
11. Audit/log tidak pernah menyimpan atau mencetak base64.
12. Test unit, integration tanpa provider, lint terkait, dan build lulus.

## 5. Verification Sequence

```bash
node scripts/test-opc-start-frame-reference.mjs
node scripts/test-opc-start-frame-reference-integration.mjs   # dev DB, tanpa provider
npm test -- --runInBand
npm run lint
npm run build
```

Lalu smoke test G-Labs terkontrol:

1. satu produk dengan Raw dan Clean yang mudah dibedakan;
2. set Clean aktif, generate initial Product Bridge;
3. verifikasi audit source=`clean_photo_url`, named reference, model, SHA, dan task isolation;
4. regen clip yang sama tanpa mengubah prompt;
5. bandingkan fingerprint initial/regen;
6. set Raw aktif dan ulangi;
7. verifikasi YouTube character start-frame tetap konsisten dengan model eksplisit;
8. jangan mencetak payload base64 dalam log atau laporan.

## 6. Rollback Strategy

- Feature flag terpisah untuk named reference dan isolation, default aktif setelah smoke lulus.
- Rollback named object dapat kembali ke string `reference.data` tanpa mengubah resolver foto kanonis.
- Rollback isolation hanya mengubah orchestration; task/audit existing tetap sah.
- Migrasi `reference_critical` additive dan tidak perlu dihapus saat rollback.
- Jangan mengembalikan `imagen_3`; fallback rollback tetap model resmi `nano_banana_2`.

## Execution Task List

- [ ] Rekam baseline payload metadata, model efektif, dan overlap task untuk satu fixture Product Bridge.
- [ ] Implementasikan resolver dua-foto kanonis dan perbaiki pointer UI Clean.
- [ ] Tambahkan dukungan reference string/object, validasi nama, MIME, size, SHA, dan dedup.
- [ ] Implementasikan named Product reference index 0 serta binding `@tag` pada builder bersama.
- [ ] Kunci model image Pillar ke `nano_banana_2` dan centralize konstanta polling 4 detik.
- [ ] Refactor initial start-frame orchestration menjadi before-bridge drain → isolated bridge → after-bridge.
- [ ] Tambahkan `reference_critical` idempotent migration dan queue assignment server-side.
- [ ] Terapkan isolation gate pada durable start-frame worker.
- [ ] Ubah single regen ke polling 4 detik tanpa menduplikasi builder.
- [ ] Perbaiki YouTube model resolution dan hapus seluruh penggunaan `imagen_3` pada adapter.
- [ ] Tambahkan/update unit, contract, parity, concurrency, dan model tests.
- [ ] Jalankan test, lint, build, dan smoke G-Labs terkontrol.
- [ ] Perbarui checkbox ini secara real-time setelah setiap tahap selesai.
- [ ] Jalankan rilis patch non-interaktif, verifikasi changelog, tag, branch `main`, dan remote sesuai SOP repository.

