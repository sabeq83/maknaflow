# Implementation Plan — OPC Start Frame Product Reference Parity

## 1. Tujuan

Memastikan generasi start frame otomatis di akhir Fase 1 dan tombol **Regen** mengirim prompt T2I, foto produk, model, aspect ratio, serta tujuan webhook G-Labs dengan aturan yang sama.

Hasil yang ditargetkan:

1. foto yang dipakai generator sama dengan foto aktif di Product Database;
2. setiap klip yang menampilkan produk wajib membawa image reference;
3. Product Campaign berhenti dengan error yang jelas bila reference wajib tidak tersedia;
4. initial generation tidak boleh diam-diam retry tanpa reference;
5. initial dan Regen memakai satu request builder;
6. payload dapat diaudit tanpa menyimpan Base64 atau secret;
7. seluruh validasi dan deployment hanya dilakukan pada Mac Mini Dev.

## 2. Temuan yang diperbaiki

- Initial generation hanya mengirim reference pada rentang `bridge_at_clip`.
- Product appearance pada prompt/storyboard belum menjadi dasar `reference required`.
- Resolver mengabaikan pointer `active_photo` dan memiliki urutan fallback berbeda dari UI.
- Initial generation mencari webhook Brand Profile berdasarkan nama, sedangkan Regen memakai ID.
- Jalur produksi dapat retry T2I tanpa reference setelah request dengan reference gagal.
- Belum ada fingerprint aman untuk membuktikan reference yang dikirim per task.

## 3. Batasan dan prinsip

- OPC tetap menjadi acuan; jangan menghidupkan kembali Strategic Campaign.
- Product Database adalah sumber canonical foto produk.
- `active_photo` adalah pointer utama; fallback hanya digunakan jika pointer kosong/tidak valid.
- Reference diputuskan per klip dengan metadata eksplisit, bukan hanya posisi bridge.
- Tidak ada provider call pada unit/integration test.
- Pilot flag tetap `false` selama implementasi dan smoke test tanpa persetujuan terpisah.
- Deploy hanya dengan `npm run deploy:macmini-dev` ke UI 5020/API 7020, schema `dev`, `PGPOOL_MAX=3`.
- Dilarang deploy atau memutasi Staging/Production.

## 4. Kontrak perilaku

### 4.1 Resolusi foto

Urutan canonical:

1. kolom yang ditunjuk `active_photo`, jika termasuk allowlist dan file valid;
2. `clean_photo_url`;
3. `cleaned_photo_url`;
4. `generated_photo_url`;
5. `raw_photo_url`;
6. `photo_url`;
7. snapshot/campaign path yang telah tervalidasi.

Resolver menghasilkan:

```js
{
  path,
  mimeType,
  base64DataUrl,
  sourceField,
  sha256,
  exists
}
```

### 4.2 Penentuan klip produk

`requires_product_reference=true` bila salah satu kondisi terpenuhi:

- clip berada pada rentang bridge;
- storyboard/plan memberi `product_visible=true`;
- storyboard/plan memberi `requires_product_reference=true`;
- prompt menyertakan marker product-reference yang dibuat prompt builder.

Keyword bebas pada prompt hanya menjadi warning, bukan penentu utama, agar tidak menghasilkan false positive.

### 4.3 Fail-closed

Untuk Product Campaign:

```text
requires_product_reference=true + reference tidak tersedia
→ jangan kirim webhook
→ status failed/blocked
→ error code PRODUCT_REFERENCE_UNAVAILABLE
```

Request dengan reference yang gagal tidak boleh otomatis diulang tanpa reference.

### 4.4 Audit aman

Audit menyimpan metadata berikut, bukan Base64:

```json
{
  "origin": "phase_1_initial | manual_regen",
  "item_id": 123,
  "clip_index": 3,
  "requires_product_reference": true,
  "reference_count": 1,
  "reference_source_field": "generated_photo_url",
  "reference_sha256": "...",
  "prompt_sha256": "...",
  "request_fingerprint": "...",
  "provider_task_id": "..."
}
```

Password, API key, cookie, authorization header, Base64, dan full prompt tidak boleh masuk audit/log.

## 5. Perubahan per file

### 5.1 `lib/product-reference-resolver.js` — file baru

#### Code Sebelum (Current/Before)

```js
// Resolusi foto tersebar di Product Picker, ingest, generator, dan Regen.
```

#### Code Sesudah (Proposed/After)

```js
export async function resolveActiveProductReference({ product, fallbackPaths = [] }) {
  const candidates = buildActivePhotoCandidates(product, fallbackPaths);
  const resolved = await findFirstValidImage(candidates);
  return resolved ? { ...resolved, sha256: hashFile(resolved.absolutePath) } : null;
}
```

Resolver harus tenant-safe, menangani `/api/v2/products/image?path=...`, path relatif/absolut yang diizinkan, MIME berdasarkan magic bytes, dan menolak path traversal.

### 5.2 `lib/product-catalog-service.js`

#### Code Sebelum (Current/Before)

```js
const value = row.clean_photo_url || row.raw_photo_url || row.generated_photo_url || row.photo_url || null;
```

#### Code Sesudah (Proposed/After)

```js
const value = resolveActiveProductPhotoPath(row);
```

Product Picker dan generator harus menunjuk foto aktif yang sama.

### 5.3 `lib/opc-start-frame-request.js` — file baru

#### Code Sebelum (Current/Before)

```js
// Initial generation dan Regen merakit payload secara terpisah.
```

#### Code Sesudah (Proposed/After)

```js
export async function buildOpcStartFrameRequest({ campaign, item, clipIndex, prompt, origin }) {
  const requirement = resolveProductReferenceRequirement({ campaign, item, clipIndex, prompt });
  const reference = await resolveCampaignProductReference({ campaign, item });
  if (requirement.required && !reference) throw productReferenceUnavailable();
  return {
    providerRequest: {
      prompt,
      model: resolveImageModel(),
      aspect_ratio: campaign.aspect_ratio || '9:16',
      reference_images: requirement.required ? [reference.base64DataUrl] : undefined,
      webhookOverride: await resolveBrandWebhookById(campaign.brand_profile_id)
    },
    audit: buildSafeRequestAudit({ requirement, reference, prompt, origin })
  };
}
```

Builder juga mempertahankan resolver character/universe untuk Cartoon OPC tanpa mengurangi product reference.

### 5.4 `lib/pillar-campaign-ingest.js`

#### Code Sebelum (Current/Before)

```js
refImage = product.clean_photo_url || product.cleaned_photo_url || product.raw_photo_url || refImage;
```

#### Code Sesudah (Proposed/After)

```js
const reference = await resolveActiveProductReference({ product, fallbackPaths: [refImage] });
refImage = reference?.path || null;
```

Snapshot campaign menyimpan path dan source field foto yang benar pada saat ingest.

### 5.5 `lib/scheduler-processors.js`

#### Code Sebelum (Current/Before)

```js
reference_images: (isBridge && productBase64) ? [productBase64] : undefined
```

dan:

```js
console.warn('Retrying without references...');
t2iImageUrl = await runT2I([]);
```

#### Code Sesudah (Proposed/After)

```js
const { providerRequest, audit } = await buildOpcStartFrameRequest({
  campaign: tempCampaign, item, clipIndex: c, prompt: t2iPromptText, origin: 'phase_1_initial'
});
const result = await generateImage(providerRequest);
await recordStartFrameRequestAudit({ ...audit, providerTaskId: result.task_id });
```

Untuk Product Campaign, hapus fallback tanpa reference. Editorial non-product tetap mengikuti aturan kompatibilitas yang ada.

### 5.6 `app/api/v2/pillar-campaigns/items/[itemId]/regenerate-t2i/route.js`

#### Code Sebelum (Current/Before)

```js
const productBase64 = resolveProductBase64(campaign, productData, rowPayload);
// route menghitung isBridge dan references sendiri
```

#### Code Sesudah (Proposed/After)

```js
const { providerRequest, audit } = await buildOpcStartFrameRequest({
  campaign, item, clipIndex, prompt: t2i_prompt, origin: 'manual_regen'
});
const result = await generateImage(providerRequest);
await recordStartFrameRequestAudit({ ...audit, providerTaskId: result.task_id });
```

Route tetap melakukan update revision/path seperti sekarang, tetapi tidak lagi memiliki resolver payload sendiri.

### 5.7 `lib/start-frame-provider-adapter.js`

#### Code Sebelum (Current/Before)

```js
const result = await generateImage(request);
```

#### Code Sesudah (Proposed/After)

```js
const built = request.providerRequest || await buildOpcStartFrameRequest(request.context);
const result = await generateImage(built);
```

Durable worker menggunakan kontrak payload yang sama dan tidak menyimpan Base64 pada `request_json`.

### 5.8 `lib/pillar-start-frame-service.js`

#### Code Sebelum (Current/Before)

```js
request_json: JSON.stringify(clip.request || {})
```

#### Code Sesudah (Proposed/After)

```js
request_json: JSON.stringify({
  context: { campaignId, itemId, clipIndex, prompt, origin },
  audit: safeAuditWithoutBase64
})
```

Manifest harus menyimpan context/fingerprint aman dan membangun ulang reference dari Product Database ketika worker mengeksekusi task.

### 5.9 `lib/webhook-client.js`

#### Code Sebelum (Current/Before)

```js
if (reference_images) body.reference_images = reference_images;
```

#### Code Sesudah (Proposed/After)

```js
validateImageReferences(reference_images);
if (reference_images?.length) body.reference_images = reference_images;
structuredLog('info', 'glabs_image_request_submitted', safeRequestMetadata);
```

Validasi memastikan reference berupa data URL gambar valid. Logging hanya menyimpan count/hash/fingerprint, bukan isi reference atau secret.

### 5.10 `lib/db-pg.js`

#### Code Sebelum (Current/Before)

```sql
-- Belum ada audit request T2I start frame yang konsisten.
```

#### Code Sesudah (Proposed/After)

```sql
CREATE TABLE IF NOT EXISTS opc_start_frame_request_audits (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_item_id TEXT NOT NULL,
  clip_index INTEGER NOT NULL,
  origin TEXT NOT NULL,
  requires_product_reference BOOLEAN NOT NULL,
  reference_count INTEGER NOT NULL,
  reference_source_field TEXT,
  reference_sha256 TEXT,
  prompt_sha256 TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  provider_task_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Tambahkan index tenant/campaign/item dan repository tenant-scoped. Migrasi harus idempotent dan diterapkan hanya ke schema Dev.

### 5.11 `scripts/test-opc-start-frame-reference.mjs` — file baru

#### Code Sebelum (Current/Before)

```js
// Belum ada parity test initial vs Regen.
```

#### Code Sesudah (Proposed/After)

```js
await testActivePhotoPointerWins();
await testProductClipRequiresReference();
await testNonProductClipMayOmitReference();
await testMissingRequiredReferenceFailsClosed();
await testInitialAndRegenFingerprintsMatch();
await testNoFallbackWithoutReference();
await testTenantIsolation();
await testAuditRedactsBase64AndSecrets();
```

Gunakan fake provider; test tidak boleh menghubungi G-Labs.

### 5.12 `package.json`

#### Code Sebelum (Current/Before)

```json
"test:content-automation:hardening": "node scripts/test-content-automation-hardening.mjs"
```

#### Code Sesudah (Proposed/After)

```json
"test:opc:start-frame-reference": "node scripts/test-opc-start-frame-reference.mjs"
```

### 5.13 `docs/content-automation-product-campaign/runbook.md`

#### Code Sebelum (Current/Before)

```md
Belum ada prosedur membandingkan payload initial dan Regen.
```

#### Code Sesudah (Proposed/After)

```md
## OPC Start Frame Reference Audit

- Periksa request fingerprint initial dan Regen.
- Pastikan reference SHA-256 sama dengan foto aktif Product Database.
- Error `PRODUCT_REFERENCE_UNAVAILABLE` harus diperbaiki; jangan dipaksa pure T2I.
```

### 5.14 `docs/content-automation-product-campaign/implementation_plan.md`

#### Code Sebelum (Current/Before)

```md
- [ ] Jalankan product pilot 6 item di Server Dev Mac Mini.
```

#### Code Sesudah (Proposed/After)

```md
- [ ] Selesaikan parity image reference initial/Regen sebelum pilot provider 6 item.
- [ ] Jalankan product pilot 6 item di Server Dev Mac Mini.
```

Pilot 6 item tetap diblokir sampai parity test dan satu-item smoke test dinyatakan PASS.

## 6. Tahapan implementasi

### Fase A — Baseline dan evidence

- snapshot satu kampanye Product Campaign Dev terbaru;
- catat foto aktif, source field, SHA-256, bridge range, dan prompt hash;
- tambahkan fake provider capture untuk membuktikan payload tanpa biaya;
- jangan menggunakan output visual subjektif sebagai satu-satunya acceptance evidence.

### Fase B — Canonical resolver

- implementasikan resolver foto aktif;
- samakan Product Picker, ingest, generator, Regen, dan worker;
- validasi file, MIME, tenant, dan path traversal;
- tambahkan unit tests.

### Fase C — Shared request builder

- implementasikan requirement per clip;
- gunakan Brand Profile ID;
- satukan initial, Regen, dan worker;
- terapkan fail-closed dan hapus reference-dropping fallback untuk Product Campaign.

### Fase D — Audit dan database

- tambah tabel/repository audit tenant-scoped;
- simpan hash/fingerprint dan provider task ID;
- verifikasi tidak ada Base64/secret/full prompt pada DB atau log.

### Fase E — Verifikasi aman

- unit/contract/integration/regression tests;
- `git diff --check`;
- production build lokal;
- deploy hanya ke Mac Mini Dev;
- smoke test fake/captured request initial versus Regen;
- pastikan pilot flag tetap off.

### Fase F — One-item provider validation

Tahap ini membutuhkan persetujuan biaya eksplisit terpisah:

1. pilih satu produk dan satu product-visible clip;
2. tampilkan foto aktif, reference hash, prompt hash, model, dan estimasi biaya;
3. berhenti dan minta approval;
4. setelah disetujui, jalankan satu initial generation;
5. Regen hanya bila diperlukan untuk parity comparison;
6. bandingkan request fingerprint dan hasil visual;
7. jangan lanjut pilot 6 item sebelum hasil PASS.

## 7. Acceptance criteria

### PASS teknis tanpa provider

- foto UI, ingest, initial, Regen, dan worker memiliki source field/SHA-256 sama;
- initial dan Regen menghasilkan request fingerprint identik untuk input yang sama;
- semua product-visible clip memiliki satu product reference;
- missing reference menghasilkan `PRODUCT_REFERENCE_UNAVAILABLE` sebelum webhook;
- tidak ada fallback tanpa reference untuk Product Campaign;
- audit tenant-scoped dan bebas secret/Base64;
- seluruh regression dan build lulus.

### PASS provider satu item

- G-Labs menerima `reference_images` dengan hash yang diharapkan;
- produk pada output mempertahankan identitas kemasan utama;
- initial dan Regen tidak berbeda pada request contract;
- tidak ada mutation/deploy Staging atau Production.

### FAIL

- reference tidak terkirim pada product-visible clip;
- foto yang dikirim berbeda dari foto aktif;
- request diam-diam turun menjadi pure T2I;
- initial dan Regen memakai webhook/payload berbeda;
- secret/Base64 tersimpan pada audit;
- terjadi cross-tenant reference atau mutation non-Dev.

## 8. Rollback

1. Matikan pilot flag bila sempat diaktifkan untuk validasi berbayar.
2. Deploy tag patch sebelumnya hanya ke `~/maknaflow-dev`.
3. Audit table boleh dipertahankan karena bersifat additive dan tidak mengandung secret.
4. Jangan menghapus output/evidence; tandai request sebagai superseded bila perlu.
5. Jangan melakukan rollback atau deployment pada Staging/Production.

## 9. Execution Task List

### A. Audit baseline

- [x] Catat branch, HEAD, dan dirty files.
- [x] Baca dokumentasi Next.js lokal untuk Route Handler.
- [x] Snapshot campaign/item/product Dev tanpa mutation.
- [x] Hitung SHA-256 foto aktif dan foto yang dipakai generator saat ini.
- [x] Tambahkan baseline fake-provider payload capture.

### B. Canonical product reference

- [x] Implementasikan `product-reference-resolver`.
- [x] Terapkan resolver pada Product Catalog.
- [x] Terapkan resolver pada OPC ingest.
- [x] Tambahkan MIME/path traversal/missing-file tests.
- [x] Tambahkan active-photo dan tenant-isolation tests.

### C. Initial/Regen parity

- [x] Implementasikan shared OPC start-frame request builder.
- [x] Tambahkan metadata `product_visible/requires_product_reference` pada plan clip.
- [x] Gunakan builder pada initial Fase 1.
- [x] Gunakan builder pada Regen.
- [x] Gunakan builder pada durable start-frame worker.
- [x] Resolusi webhook Brand Profile hanya berdasarkan ID.
- [x] Hapus fallback tanpa reference untuk Product Campaign.
- [x] Terapkan `PRODUCT_REFERENCE_UNAVAILABLE` fail-closed.

### D. Auditability

- [x] Tambahkan migrasi audit idempotent.
- [x] Tambahkan repository audit tenant-scoped.
- [x] Simpan prompt/reference hash, fingerprint, origin, dan task ID.
- [x] Pastikan log/DB tidak menyimpan Base64 atau secret.

### E. Tests dan dokumentasi

- [x] Tambahkan parity/safety/redaction tests.
- [x] Jalankan OPC, Product Catalog, Content Automation, dan hardening regressions.
- [x] Jalankan integration test pada schema Dev tanpa provider.
- [x] Jalankan `git diff --check`.
- [x] Jalankan production build lokal.
- [x] Perbarui runbook dan checklist utama.

### F. Deploy dan smoke test Dev

- [x] Deploy hanya dengan `npm run deploy:macmini-dev`.
- [x] Verifikasi PM2 Dev online, UI 5020, API 7020.
- [x] Verifikasi schema `dev` dan `PGPOOL_MAX=3`.
- [x] Bandingkan captured initial/Regen request fingerprint tanpa provider.
- [x] Pastikan pilot flag tetap off.
- [x] Konfirmasi tidak ada deploy/mutation Staging/Production.

### G. Persetujuan provider satu item

- [ ] Presentasikan produk, clip, foto/hash, prompt hash, model, dan cost cap.
- [ ] Dapatkan persetujuan eksplisit sebelum provider call.
- [ ] Jalankan satu initial start frame pada Dev.
- [ ] Verifikasi payload audit dan identitas produk.
- [ ] Jalankan Regen hanya jika dibutuhkan untuk perbandingan.
- [ ] Putuskan PASS/fix-and-repeat sebelum pilot 6 item.

### H. Release

- [ ] Jalankan patch release non-interactive setelah verifikasi aman selesai.
- [ ] Verifikasi commit, tag, dan push branch kerja.
- [ ] Jangan merge/push `main` tanpa instruksi eksplisit.
- [ ] Jangan deploy Production tanpa perintah manual eksplisit.
