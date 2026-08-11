# Implementation Plan — Product Database Single Entry, CSV Import, dan AI Clean Photo

## 1. Tujuan

Mengubah alur Product Database agar:

1. Penambahan produk tunggal hanya mewajibkan fakta dasar dari pengguna: nama, deskripsi, foto raw, dan keputusan kemasan.
2. Field kreatif/teknis bertanda `**` dibuat oleh Gemini dan tetap dapat ditinjau serta diedit pengguna.
3. Import CSV/XLSX menerima enam kolom bisnis yang disepakati, melakukan deduplikasi tenant-aware, lalu menyimpan data sebelum pekerjaan AI dimulai.
4. Foto raw langsung diedit secara image-to-image oleh Gemini API atau G-Labs tanpa rembg sebagai tahap wajib.
5. Product Database hanya mempunyai dua aset foto operasional: foto Raw dan foto Clean berlatar putih.
6. Kegagalan enrichment atau image generation tidak menghapus data produk dan dapat di-retry.

## 2. Ruang Lingkup

### Termasuk

- Form Add/Edit Single Product.
- Import CSV/XLSX Product Database.
- Validasi client dan server.
- Deduplikasi per tenant.
- Download dan validasi foto raw dari CSV.
- Enrichment Gemini untuk USP, Product Truth, Geometric Truth, prompt clean, prompt T2I kampanye, dan prompt I2V.
- Provider foto `gemini` dan `glabs` melalui satu service abstraction.
- Queue/status, retry, approval, dan tampilan Raw/Clean.
- Migrasi PostgreSQL yang kompatibel dengan data lama.
- Pengujian unit, integration, tenant isolation, dan UI smoke test.

### Tidak termasuk

- Perubahan atau pengembangan scraper produk.
- Deployment production tanpa perintah manual eksplisit.
- Penghapusan `lib/bg-remover.js`; rembg dipertahankan sementara untuk pipeline lama, tetapi tidak dipakai oleh alur baru ini.
- Perombakan engine kampanye di luar penyesuaian pemilihan foto aktif.

## 3. Prinsip Implementasi

- Gunakan PostgreSQL repository tenant-aware; hindari SQL langsung tanpa `tenant_id` pada route/worker produk.
- Simpan produk dan foto raw terlebih dahulu. AI berjalan asynchronous setelah transaksi produk berhasil.
- Saat membuat atau meregenerasi foto Clean, reference input selalu `raw_photo_url`; jangan menggunakan hasil rembg atau clean lama sebagai sumber regenerasi.
- Jangan menimpa aset lama sebelum aset baru selesai divalidasi.
- `raw_photo_url` berarti foto sumber asli dan `clean_photo_url` berarti foto e-commerce profesional berlatar putih.
- `cleaned_photo_url`, `generated_photo_url`, dan `active_photo` diperlakukan sebagai field legacy. Jangan hapus kolomnya pada pekerjaan ini, tetapi jangan lagi menjadikannya bagian model aset baru.
- Untuk compatibility, `cleaned_photo_url` boleh dicerminkan dari `clean_photo_url` pada boundary repository. `generated_photo_url` tidak lagi ditulis oleh pipeline Product Database baru.
- Setelah foto Clean tersedia, semua consumer kampanye/G-Labs harus memakai urutan referensi tunggal: `clean_photo_url` lalu `raw_photo_url`. `photo_url` hanya pointer compatibility (`clean` bila tersedia, selain itu `raw`). Dengan demikian ada dua konteks yang tegas: Raw→Clean untuk pemrosesan foto produk, Clean→Raw untuk pembuatan aset kampanye.
- Endpoint harus melakukan authorization/tenant validation sendiri walaupun UI sudah terproteksi.
- Jangan menebak model Gemini image yang tersedia. Sebelum implementasi provider Gemini, periksa dokumentasi resmi/API model yang berlaku dan gunakan setting `product_photo_gemini_model` dengan fallback yang benar-benar didukung pada environment.
- Ikuti Route Handler App Router berbasis Web `Request`/`FormData`; endpoint mutasi tidak dicache.

## 4. Kontrak Data Pengguna

### 4.1 Single Product

Field wajib dari pengguna:

| Field | DB | Aturan |
|---|---|---|
| Nama Produk | `product_name` | Wajib, trim, 2–250 karakter |
| Deskripsi Produk | `product_description`, `raw_description` | Wajib, trim, minimal 10 karakter |
| Upload Foto Produk | `raw_photo_url` | Wajib untuk create; image raster valid |
| Status Kemasan | `packaging_status` + compatibility `is_in_packaging` | Wajib memilih `packaged` atau `unpackaged` |
| Jenis Kemasan | `packaging_type` | Wajib bila `packaged` |

Field opsional:

- `category`
- `tags`
- `affiliate_link`
- `source_url`
- `packaging_notes`
- pilihan provider (`system_default`, `gemini`, `glabs`)

Field enrichment Gemini (`**`), tidak wajib saat create:

- `unique_selling_point`
- `product_truth`
- `geometric_truth`
- `clean_photo_t2i_prompt`
- `t2i_prompt`
- `i2v_action_prompt`

`t2i_prompt` tetap diperlukan untuk pembuatan visual kampanye oleh G-Labs, tetapi tidak menghasilkan atau menyimpan aset foto ketiga di Product Database. G-Labs menggunakan foto Clean sebagai reference image untuk proses kampanye tersebut.

`photo_url` tidak menjadi input pengguna biasa. Tampilkan hanya sebagai read-only pada Advanced/Debug jika masih diperlukan.

### 4.2 Import CSV/XLSX

Header canonical:

```text
Page
Nama Produk Raw
Deskripsi Produk Raw
Link Produk
URL Foto Produk Raw
Link Aff
```

Aturan:

- `Nama Produk Raw`, `Deskripsi Produk Raw`, dan `URL Foto Produk Raw` wajib per baris.
- `Page`, `Link Produk`, dan `Link Aff` boleh kosong.
- Alias lama tetap diterima untuk backward compatibility.
- Parser menggunakan `xlsx` di server untuk CSV maupun XLSX; jangan membuat parser CSV manual kedua di browser.
- Import mempunyai mode deduplikasi: default `update_missing`; opsi lain `skip_existing`.
- Response menyertakan jumlah `imported`, `updated`, `skipped`, dan daftar error per nomor baris.

## 5. Model Status

Tambahkan status terpisah agar kegagalan satu tahap tidak mengaburkan tahap lain:

```text
import_status:
  completed | failed

enrichment_status:
  pending | processing | completed | needs_review | failed

photo_status:
  pending | downloading | queued | processing | needs_review | approved | failed

photo_provider:
  gemini | glabs
```

Pertahankan `extraction_status` selama masa transisi sebagai compatibility field. Worker baru menjadi sumber status utama, sedangkan nilai compatibility dipetakan sebagai berikut:

| Kondisi baru | `extraction_status` lama |
|---|---|
| enrichment pending/processing | `pending` |
| photo pending/queued | `pending_image` |
| photo processing | `generating_image` |
| seluruh tahap selesai/approved | `completed` |
| kegagalan terminal | `failed` |

## 6. Perubahan Skema Database

Tambahkan kolom pada `product_extractions`:

```sql
page TEXT,
packaging_status TEXT,
packaging_notes TEXT,
import_status TEXT DEFAULT 'completed',
enrichment_status TEXT DEFAULT 'completed',
photo_status TEXT DEFAULT 'approved',
photo_provider TEXT,
photo_task_id TEXT,
photo_error TEXT,
enrichment_error TEXT,
enrichment_reviewed_at TIMESTAMPTZ,
photo_reviewed_at TIMESTAMPTZ,
normalized_source_url TEXT,
raw_photo_sha256 TEXT,
updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
```

Tambahkan index:

```sql
CREATE INDEX ... ON product_extractions(tenant_id, enrichment_status, created_at);
CREATE INDEX ... ON product_extractions(tenant_id, photo_status, created_at);
CREATE INDEX ... ON product_extractions(tenant_id, normalized_source_url);
```

Jangan langsung membuat unique index pada URL sebelum audit data duplikat selesai. Deduplikasi dijalankan transaksional di repository terlebih dahulu.

Backfill dan legacy compatibility:

- `packaging_status = 'packaged'` jika `is_in_packaging = 1`, selain itu `unpackaged` untuk baris lama.
- `photo_task_id = glabs_task_id` untuk task lama yang masih aktif.
- Status lama dipetakan ke status baru tanpa mengubah URL aset.
- Audit dahulu produk legacy yang hanya memiliki `generated_photo_url`. Jika file yang sama juga tercatat sebagai clean, pertahankan `clean_photo_url` sebagai canonical.
- Jangan menghapus atau mengosongkan `generated_photo_url` dan `active_photo` produk lama; keduanya hanya berhenti ditulis/dipakai oleh alur baru.
- `photo_url` diarahkan ke `clean_photo_url` bila clean tersedia, selain itu ke `raw_photo_url`.

## 7. Arsitektur Service

```text
Single/CSV Route
    -> product validator
    -> product repository (tenant-aware transaction)
    -> raw image service
    -> product enrichment worker
    -> product photo service
         -> Gemini provider
         -> G-Labs provider
    -> quality validation
    -> repository update
```

### 7.0 Hasil audit pemakaian foto saat ini

- `lib/scheduler-processors.js` dan `lib/pillar-campaign-ingest.js` telah memprioritaskan foto clean untuk reference G-Labs, kemudian fallback ke raw/photo.
- Prompt contract memakai filename dari `clean_photo_url` sebagai anchor identitas produk.
- `lib/product-bulk-worker.js` saat ini menyimpan satu output G-Labs yang sama ke `photo_url`, `generated_photo_url`, `clean_photo_url`, dan `cleaned_photo_url`; ini adalah duplikasi yang harus dihentikan.
- `lib/sheets-autopilot-worker.js` masih memprioritaskan `generated_photo_url`; resolver ini harus dinormalisasi menjadi `clean_photo_url || raw_photo_url`.
- Beberapa UI/API masih menawarkan tiga tab Raw/Clean/Studio; semuanya harus disederhanakan menjadi Raw/Clean, sementara data legacy tidak dihapus.

### 7.1 `product-photo-service`

Kontrak provider:

```js
generateCleanProductPhoto({
  product,
  referenceImage,
  prompt,
  aspectRatio: '1:1',
  provider,
  idempotencyKey
})
```

Return normalized:

```js
{
  mode: 'sync' | 'async',
  provider: 'gemini' | 'glabs',
  taskId: null,
  imageBuffer: null,
  remoteFile: null,
  mimeType: null
}
```

- Gemini dapat selesai sinkron dan mengembalikan buffer image.
- G-Labs mengembalikan `task_id` lalu dipoll oleh worker.
- Service menyimpan output hanya setelah MIME, dimensi, dan file integrity lolos.

### 7.2 Prompt clean photo canonical

Gunakan template sistem yang stabil; data produk ditambahkan sebagai konteks:

```text
Edit the supplied reference image into a professional e-commerce product photo.
Preserve the exact product identity, packaging shape, proportions, colors, logo,
label layout, printed text, cap, material, and all visible product details.
Show exactly one product, fully visible and centered, on a seamless pure white
background. Use soft neutral studio lighting and a subtle realistic contact shadow.
Remove people, hands, props, decorations, price tags, watermarks, and surrounding
objects. Do not redesign, relabel, duplicate, crop, distort, blur, or invent any
part of the product.
```

Prompt tidak boleh meminta meja, daun, bunga, dekorasi, atau background lifestyle untuk output clean.

## 8. Perubahan Per File — Before & After

> Potongan berikut adalah kontrak perubahan, bukan salinan penuh file. Agent pelaksana wajib menyesuaikan dengan kode aktual dan menjaga perubahan pengguna yang tidak terkait.

### 8.1 `app/products/page.js`

**Code Sebelum (Current/Before)**

```js
if (!formData.product_name.trim()) {
  showToast('Nama produk wajib diisi!', 'error');
  return;
}

const res = await fetch('/api/v2/products', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(formData)
});
```

Upload foto dilakukan lebih dahulu dengan ID sementara dan field AI ditampilkan seperti input manual biasa.

**Code Sesudah (Proposed/After)**

```js
const errors = validateProductForm({ formData, rawPhotoFile, editingProduct });
if (Object.keys(errors).length) {
  setFormErrors(errors);
  return;
}

const payload = new FormData();
payload.set('product', JSON.stringify(toProductPayload(formData)));
if (rawPhotoFile) payload.set('raw_photo', rawPhotoFile);

const res = await fetch(
  editingProduct ? `/api/v2/products/${editingProduct.id}` : '/api/v2/products',
  { method: editingProduct ? 'PUT' : 'POST', body: payload }
);
```

Perubahan UI:

- Kelompokkan Informasi Dasar, Foto, Kemasan, dan AI Enrichment.
- Nama, deskripsi, foto create, dan status kemasan diberi `required` serta error inline.
- Ganti checkbox kemasan menjadi radio `packaged`/`unpackaged`.
- `packaging_type` muncul dan wajib jika `packaged`.
- Preview foto, replace photo saat edit, dan indikator upload.
- Sembunyikan `Photo URL / Path` di Advanced read-only.
- Field `**` collapsed saat create dengan teks “dibuat otomatis oleh Gemini”.
- Saat edit, field `**` editable dengan badge status dan tombol Retry/Generate ulang.
- Tambahkan pilihan provider dengan default `system_default`.
- Hanya tampilkan tab/preview `Raw` dan `Clean`; hilangkan tab/upload/use-state `Studio` dari Product Database.
- Clean otomatis menjadi reference operasional setelah approved; tidak diperlukan tombol `Use Studio` atau model pemilihan tiga foto.
- Tambahkan tindakan `Simpan` dan `Simpan & Generate Ulang` untuk edit.
- Jika foto/nama/deskripsi/kemasan berubah, tandai enrichment stale; jangan auto-delete output lama.

### 8.2 `app/api/v2/products/route.js`

**Code Sebelum (Current/Before)**

```js
const body = await req.json();
if (!body.product_name) {
  return NextResponse.json({ success: false, error: 'Product Name wajib diisi.' }, { status: 400 });
}
const product = await createProduct(data);
```

**Code Sesudah (Proposed/After)**

```js
const formData = await req.formData();
const input = parseProductMultipart(formData);
const validated = validateSingleProductCreate(input);

const product = await createProductWithRawPhoto({
  data: validated.data,
  rawPhoto: validated.rawPhoto,
  tenantId,
  enqueueEnrichment: true,
  enqueuePhoto: true
});
```

Ketentuan:

- Tetap dukung JSON lama untuk compatibility jika `Content-Type` adalah JSON.
- JSON lama tidak boleh melewati validasi tenant/repository, tetapi aturan foto wajib hanya diterapkan pada mode UI create baru atau versi kontrak baru agar integrasi lama tidak langsung rusak.
- Return HTTP `201` segera setelah produk + raw photo berhasil disimpan dan queue state tercatat.
- Jangan menunggu Gemini/G-Labs di request.
- Response/list Product Database hanya mengekspos dua aset operasional (`raw_photo_url`, `clean_photo_url`), dengan alias legacy bila dibutuhkan consumer lama.
- Jangan membungkus URL eksternal dengan endpoint local image pada GET; hanya path lokal yang diproxy.

### 8.3 `app/api/v2/products/[id]/route.js`

**Code Sebelum (Current/Before)**

```js
const body = await req.json();
const updated = await updateProduct(id, updateData);
```

**Code Sesudah (Proposed/After)**

```js
const input = await parseProductUpdateRequest(req);
const validated = validateSingleProductUpdate(input);
const updated = await updateProductWithOptionalRawPhoto(id, validated, {
  regenerate: input.regenerate === true
});
```

Ketentuan:

- Terima multipart untuk replace raw photo dan JSON untuk update ringan.
- Pastikan ID berada pada tenant aktif.
- `packaging_type` wajib jika `packaged`.
- Perubahan identity fields menandai enrichment/photo `pending` hanya bila pengguna memilih regenerate; selain itu simpan dan tandai `needs_review`.
- Tambahkan field status/error/review ke allowlist repository, bukan allowlist route yang lepas dari schema.

### 8.4 `app/api/v2/products/import-csv/route.js`

**Code Sebelum (Current/Before)**

```js
const rawName = getHeaderVal(row, ['Nama Produk Raw', ...]);
const rawDesc = getHeaderVal(row, ['Deskripsi Produk Raw', ...]);
const rawLink = getHeaderVal(row, ['Link Produk', ...]);
const rawPhoto = getHeaderVal(row, ['URL Foto Produk Raw', ...]);
```

**Code Sesudah (Proposed/After)**

```js
const parsedRows = parseProductSpreadsheet(buffer);
const result = await importProductRows(parsedRows, {
  tenantId,
  duplicateMode: formData.get('duplicate_mode') || 'update_missing',
  photoProvider: formData.get('photo_provider') || 'system_default'
});
```

Parser canonical memetakan:

```js
{
  page,
  product_name,
  product_description,
  source_url,
  raw_photo_source_url,
  affiliate_link,
  source_row_number
}
```

Ketentuan:

- Simpan `Page` dan `Link Aff`.
- Validasi required per baris dan kembalikan error bernomor baris.
- Normalisasi URL sebelum deduplikasi.
- Gunakan repository PostgreSQL tenant-aware dan satu transaksi untuk keputusan deduplikasi/insert/update.
- Jangan menjalankan network download atau AI di dalam transaksi import.
- Produk valid disimpan dengan enrichment/photo pending; worker mengunduh foto kemudian.
- Response tidak boleh menyatakan seluruh file gagal hanya karena beberapa baris invalid.

### 8.5 `lib/product-repository.js`

**Code Sebelum (Current/Before)**

```js
const duplicate = await client.query(`
  SELECT id FROM product_extractions
  WHERE tenant_id = $1 AND (
    id = $2 OR ($3 <> '' AND source_url = $3) OR ($4 <> '' AND input_source = $4)
  ) LIMIT 1
`, [tenantId, product.id, sourceUrl, inputSource]);
```

**Code Sesudah (Proposed/After)**

```js
const duplicate = await findProductDuplicate(client, {
  tenantId,
  normalizedSourceUrl,
  normalizedName,
  page,
  rawPhotoSourceUrl
});

await upsertImportedProduct(client, product, {
  mode: duplicateMode,
  preserveApprovedAssets: true
});
```

Tambahkan repository methods:

- `createProductWithRawPhotoMetadata`
- `findProductDuplicate`
- `importProductRows`
- `claimPendingEnrichmentProducts`
- `claimPendingPhotoProducts`
- `updateProductEnrichmentResult`
- `updateProductPhotoTask`
- `completeProductCleanPhoto`
- `failProductStage`
- `approveProductPhoto`

Gunakan row locking/claim pattern (`FOR UPDATE SKIP LOCKED`) agar dua scheduler tidak memproses produk yang sama.

### 8.6 `lib/product-bulk-worker.js`

**Code Sebelum (Current/Before)**

```js
const pendingProducts = await db.prepare(
  "SELECT * FROM product_extractions WHERE extraction_status = 'pending' LIMIT 10"
).all();

const pendingImageProducts = await db.prepare(
  "SELECT * FROM product_extractions WHERE extraction_status = 'pending_image' LIMIT 5"
).all();
```

**Code Sesudah (Proposed/After)**

```js
const enrichmentJobs = await claimPendingEnrichmentProducts({ limit: 10 });
for (const job of enrichmentJobs) await enrichProduct(job);

const photoJobs = await claimPendingPhotoProducts({ limit: 5 });
for (const job of photoJobs) await processProductPhoto(job);

await pollPendingProductPhotoTasks({ provider: 'glabs', limit: 20 });
```

Ketentuan:

- Worker memproses job bersama tenant ID yang tersimpan; setiap operasi repository menyertakan tenant.
- Pisahkan enrichment metadata, dispatch photo, dan polling.
- Enrichment menerima nama, deskripsi, packaging facts, dan raw image jika tersedia.
- Output JSON terstruktur mencakup USP, truths, clean prompt, T2I campaign prompt, dan I2V prompt.
- Reference photo selalu raw photo lokal/base64.
- Provider di-resolve dari row lalu tenant setting lalu default sistem.
- Retry bounded dengan error message; jangan mengubah produk menjadi hilang/tidak dapat diedit.
- Log tenant-aware dan selaras dengan endpoint pembaca log.

### 8.7 `lib/product-photo-service.js` — file baru

**Code Sebelum (Current/Before)**

```text
Belum ada. Route dan worker memanggil generateImage G-Labs secara langsung.
```

**Code Sesudah (Proposed/After)**

```js
export async function generateCleanProductPhoto(input) {
  const provider = await resolveProductPhotoProvider(input);
  if (provider === 'gemini') return generateWithGemini(input);
  if (provider === 'glabs') return generateWithGlabs(input);
  throw new Error(`Unsupported product photo provider: ${provider}`);
}
```

Service juga menyediakan:

- `buildCleanProductPrompt(product)`
- `resolveRawReferenceImage(product)`
- `validateGeneratedImage(buffer, mimeType)`
- `saveCleanProductPhoto(product, output)`
- normalized errors tanpa mencetak API key/base64 ke log.

### 8.8 `lib/product-photo-providers/gemini.js` — file baru

**Code Sebelum (Current/Before)**

```text
Belum ada provider image output Gemini untuk Product Database.
```

**Code Sesudah (Proposed/After)**

```js
export async function generateWithGemini({ referenceImage, prompt, model }) {
  return executeWithKeyPool(1, async apiKey => {
    // Gunakan SDK/API image generation resmi yang sudah diverifikasi.
    // Kirim prompt + reference image dan ekstrak image part dari response.
    return { mode: 'sync', provider: 'gemini', imageBuffer, mimeType };
  });
}
```

Ketentuan:

- Verifikasi model dan bentuk response terhadap dokumentasi resmi saat implementasi.
- Model berasal dari tenant setting `product_photo_gemini_model`.
- Tangani response tanpa image sebagai kegagalan yang dapat di-retry.
- Jangan menggunakan model text-only untuk mengklaim foto berhasil dibuat.

### 8.9 `lib/product-photo-providers/glabs.js` — file baru

**Code Sebelum (Current/Before)**

```js
const res = await generateImage({ prompt, reference_images, aspect_ratio: '1:1' });
```

**Code Sesudah (Proposed/After)**

```js
export async function generateWithGlabs({ referenceImage, prompt, model }) {
  const response = await generateImage({
    prompt,
    model,
    aspect_ratio: '1:1',
    reference_images: [referenceImage]
  });
  return { mode: 'async', provider: 'glabs', taskId: response.task_id };
}
```

Polling tetap memakai `getTaskStatus`/`getFileUrl`, tetapi hasil dinormalisasi oleh provider dan disimpan oleh service.

### 8.10 `lib/product-validation.js` — file baru

**Code Sebelum (Current/Before)**

```text
Validasi tersebar di UI dan route; server hanya mewajibkan product_name.
```

**Code Sesudah (Proposed/After)**

```js
export function validateSingleProductCreate(input) { /* structured errors */ }
export function validateSingleProductUpdate(input) { /* structured errors */ }
export function validateProductImportRow(row, rowNumber) { /* structured errors */ }
export function validateRawProductImage(file) { /* MIME/size/extension */ }
```

Gunakan dependency validasi yang sudah tersedia; bila menambah dependency baru, jelaskan alasannya dan lockfile harus ikut diperbarui. Validasi file wajib memeriksa magic bytes, bukan hanya ekstensi atau `Content-Type` dari client.

### 8.11 `lib/product-image-storage.js` — file baru

**Code Sebelum (Current/Before)**

```js
fs.writeFileSync(absolutePath, buffer);
await updateProductExtraction(productId, updateData);
```

**Code Sesudah (Proposed/After)**

```js
const staged = await stageValidatedProductImage({ tenantId, productId, file, type: 'raw' });
await attachProductImageInTransaction({ tenantId, productId, staged });
await finalizeStagedProductImage(staged);
```

Ketentuan:

- Nama file tidak memakai nama asli pengguna.
- Lokasi tenant-safe, misalnya `public/uploads/products/<tenant-safe-id>/raw|clean/`.
- Batasi ukuran dan resolusi; normalisasi orientasi EXIF.
- Hitung SHA-256 raw photo.
- Bersihkan staged file jika transaksi database gagal.
- Jangan menghapus aset lama saat replace sebelum commit berhasil.

### 8.12 `app/api/v2/products/image/route.js`

**Code Sebelum (Current/Before)**

```js
const file = formData.get('file');
const productId = formData.get('productId');
fs.writeFileSync(absolutePath, buffer);
await updateProductExtraction(productId, updateData);
```

**Code Sesudah (Proposed/After)**

```js
const product = await getProductById(productId);
if (!product) return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });

const stored = await replaceProductImage({ product, file, type });
return NextResponse.json({ success: true, data: stored });
```

Endpoint ini dipertahankan hanya untuk replace `raw` atau upload manual `clean` setelah produk ada. Tolak tipe `generated/studio` pada kontrak UI baru. Create baru memakai multipart pada `/api/v2/products` sehingga tidak ada lagi update ke ID sementara yang belum tersimpan.

GET image:

- Hanya melayani path lokal yang berada di root upload produk.
- URL HTTP/HTTPS tidak dikirim ke path resolver lokal.
- Kegagalan file sebaiknya return `404`; transparent pixel dapat dipertahankan hanya jika UI lama memang bergantung padanya dan harus diberi header diagnostik.

### 8.13 `app/api/v2/products/regenerate-photos/route.js`

**Code Sebelum (Current/Before)**

```js
let referenceUrl = p.scraped_image_url;
if (p.cleaned_photo_url) {
  referenceUrl = `${req.nextUrl.origin}/api/v2/products/image?path=${encodeURIComponent(p.cleaned_photo_url)}`;
}
const glabsRes = await generateImage(...);
```

**Code Sesudah (Proposed/After)**

```js
const jobs = await queueProductPhotoRegeneration({
  ids,
  provider: body.provider || 'system_default',
  tenantId,
  referenceField: 'raw_photo_url'
});
```

Endpoint hanya mengantrikan. Worker menggunakan service provider. Jangan gunakan clean/rembg lama sebagai reference utama dan jangan melakukan analisis Gemini + dispatch G-Labs secara serial di request.

Hasil regenerasi adalah foto Clean baru. Setelah lolos validasi/review, repository menulis `clean_photo_url`, mirror compatibility `cleaned_photo_url`, dan `photo_url`; jangan menulis `generated_photo_url`.

### 8.14 `lib/sheets-autopilot-worker.js`, `lib/scheduler-processors.js`, dan `lib/pillar-campaign-ingest.js`

**Code Sebelum (Current/Before)**

```js
// Salah satu resolver lama masih mengutamakan generated/studio.
return product.generated_photo_url
  || product.clean_photo_url
  || product.cleaned_photo_url
  || product.photo_url
  || product.raw_photo_url;
```

**Code Sesudah (Proposed/After)**

```js
export function resolveProductReferenceImage(product) {
  return product?.clean_photo_url || product?.raw_photo_url || null;
}
```

Ketentuan:

- Jadikan satu helper resolver sebagai sumber aturan bersama bila dependency graph memungkinkan.
- Semua payload `reference_images` produk menuju G-Labs memakai Clean, lalu Raw hanya sebagai fallback bila clean belum tersedia.
- Jangan gunakan `generated_photo_url`, `active_photo`, atau `photo_url` untuk menentukan reference pada kode baru.
- `cleaned_photo_url` hanya alias legacy; normalisasikan ke `clean_photo_url` di repository/boundary, bukan membuat hierarki ketiga.
- Perubahan ini tidak mencakup refactor scraping; hanya pemilihan reference image produk yang sudah ada.

### 8.15 `lib/db-pg.js`

**Code Sebelum (Current/Before)**

```text
Belum ada migrasi PostgreSQL khusus status pipeline foto produk baru.
```

**Code Sesudah (Proposed/After)**

```sql
SELECT pg_advisory_lock(hashtext('makna_product_photo_pipeline_v1'));
ALTER TABLE product_extractions ADD COLUMN IF NOT EXISTS ...;
CREATE INDEX IF NOT EXISTS ...;
SELECT pg_advisory_unlock(hashtext('makna_product_photo_pipeline_v1'));
```

Gunakan pola migrasi aman repository, backfill idempotent, dan release advisory lock pada `finally`. Tambahkan kolom yang sama ke schema SQLite backup hanya untuk compatibility tooling/local schema generation.

### 8.16 `scripts/local-staging/setup.js`

**Code Sebelum (Current/Before)**

```js
await client.query(`ALTER TABLE product_extractions ADD COLUMN IF NOT EXISTS tenant_id TEXT`);
```

**Code Sesudah (Proposed/After)**

```js
await client.query(`
  ALTER TABLE product_extractions
    ADD COLUMN IF NOT EXISTS page TEXT,
    ADD COLUMN IF NOT EXISTS packaging_status TEXT,
    ...
`);
```

Staging setup harus menghasilkan schema yang sama dengan runtime migration dan mengisi `tenant_id='default_tenant'` pada baris legacy bila null.

### 8.17 `app/api/settings/route.js` dan `app/settings/page.js`

**Code Sebelum (Current/Before)**

```js
webhook_image_model: await getSetting('webhook_image_model') || 'nano_banana_pro'
```

**Code Sesudah (Proposed/After)**

```js
product_photo_provider: await getSetting('product_photo_provider') || 'glabs',
product_photo_gemini_model: await getSetting('product_photo_gemini_model') || verifiedDefault,
product_photo_glabs_model: await getSetting('product_photo_glabs_model') || webhookImageModel,
product_photo_auto_approve: Number(await getSetting('product_photo_auto_approve') || 0)
```

Tambahkan section Product Photo Processing. Secret Gemini tetap memakai key pool yang ada; jangan membuat input API key duplikat.

### 8.18 `app/api/system-logs/route.js`

**Code Sebelum (Current/Before)**

```js
product_bulk: 'product_bulk_logs.txt'
```

**Code Sesudah (Proposed/After)**

```js
product_bulk: ({ tenantId }) => `product_bulk_logs_${safeTenantId(tenantId)}.txt`
```

Writer dan reader harus memakai konvensi tenant-aware yang sama. Jangan menerima tenant ID bebas dari query string tanpa authorization.

### 8.19 Test files

**Code Sebelum (Current/Before)**

```text
Belum ada coverage menyeluruh untuk kontrak single product + CSV + dual provider.
```

**Code Sesudah (Proposed/After)**

Tambahkan/perbarui:

```text
scripts/test-product-import.mjs
scripts/test-product-single-create.mjs
scripts/test-product-photo-pipeline.mjs
```

Provider test menggunakan fake/stub, bukan API berbayar. Satu smoke test terpisah boleh menggunakan provider nyata hanya bila flag eksplisit disetel.

## 9. Deduplikasi

Normalisasi URL:

- trim;
- lowercase hostname;
- hapus fragment;
- hapus trailing slash yang tidak bermakna;
- urutkan query parameter;
- hapus parameter tracking yang disetujui (`utm_*`, `fbclid`, dan sejenisnya), tetapi jangan hapus parameter identitas produk.

Urutan duplicate match dalam tenant:

1. `normalized_source_url` jika tersedia.
2. Nama ternormalisasi + `page` jika URL produk kosong.
3. Hash file foto setelah download sebagai sinyal tambahan, bukan satu-satunya identitas.

Mode `update_missing`:

- Isi field lama yang kosong.
- Perbarui affiliate link jika CSV memberikan nilai baru.
- Jangan menimpa metadata yang telah direview atau foto approved.
- Jika URL foto raw berubah, tandai photo `needs_review` dan tawarkan regenerate; jangan otomatis menghapus clean photo lama.

## 10. Quality Gate Foto

Validasi minimum sebelum menyimpan canonical `clean_photo_url`:

- MIME raster yang didukung.
- Decode berhasil.
- Dimensi minimum yang dikonfigurasi.
- Aspect ratio wajar dan output tidak kosong.
- Background dominan terang/putih berdasarkan sampling tepi sederhana.
- File memiliki SHA-256 dan ukuran masuk akal.

Pada fase pertama, default `product_photo_auto_approve=0`; hasil masuk `needs_review`. UI menyediakan Raw/Clean compare, Approve, Retry, dan Upload Manual. Pemeriksaan OCR/logo similarity lanjutan dapat menjadi fase berikutnya dan tidak memblokir MVP.

## 11. Acceptance Criteria

### Single Product

- Create ditolak bila nama, deskripsi, foto, atau status kemasan kosong.
- Jika `packaged`, jenis kemasan wajib.
- Produk dan raw photo tersimpan atomik; tidak ada orphan record/file setelah kegagalan.
- Response create tidak menunggu AI.
- Field `**` diisi Gemini secara asynchronous dan dapat diedit.
- Replace raw photo tersedia saat edit.
- Retry tidak menghapus foto clean lama sebelum hasil baru valid.

### CSV/XLSX

- Enam header canonical terbaca, termasuk `Page` dan `Link Aff`.
- Alias lama tetap bekerja.
- Error menampilkan nomor baris dan alasan.
- Duplicate dalam tenant mengikuti mode yang dipilih.
- Tenant A tidak membaca/mengubah/memproses produk Tenant B.
- Import menyimpan data terlebih dahulu lalu worker mengerjakan AI.

### Foto

- Alur baru tidak memanggil `createCleanProductShot`/rembg.
- Raw photo menjadi reference image.
- Gemini dan G-Labs memakai kontrak service yang sama.
- Hasil clean mengisi canonical `clean_photo_url`, mirror compatibility `cleaned_photo_url`, dan pointer `photo_url`.
- `generated_photo_url` dan `active_photo` tidak ditulis atau dipakai oleh pipeline baru.
- Semua reference image produk ke G-Labs menggunakan `clean_photo_url`, dengan fallback `raw_photo_url` hanya bila clean belum tersedia.
- Error provider terlihat dan dapat di-retry.

### Regression

- Product list, edit, delete, dan export tetap bekerja dengan dua aset Raw/Clean.
- Campaign yang membaca foto produk mendapat urutan reference konsisten `Clean → Raw`.
- Data `generated_photo_url` legacy tetap tersimpan tetapi tidak tampil sebagai aset ketiga di Product Database.
- Build Next.js berhasil.
- Tidak ada perubahan pada scraping flow.

## 12. Strategi Pengujian

1. Unit: header aliases, URL normalization, validation, prompt builder, provider response normalization.
2. Repository integration: tenant isolation, duplicate modes, row claim concurrency, stage completion/failure.
3. API integration: JSON legacy, multipart create, multipart edit, partial CSV failure, invalid image.
4. Worker integration: enrichment success/failure, Gemini sync result, G-Labs async polling, retry exhaustion.
5. UI smoke: required errors, packaging conditional field, preview/replace, enrichment badges, Raw/Clean tabs.
6. Regression: `npm run test:product-import`, test baru, lalu `npm run build` atau `npm run staging:build` sesuai environment.
7. Setelah verifikasi lokal berhasil, jalankan cluster health bila memang menguji layanan 3-node.

## 13. Rollout dan Compatibility

1. Jalankan migrasi idempotent.
2. Deploy code dengan provider default `glabs` agar perilaku awal dekat dengan sistem saat ini.
3. Aktifkan form multipart baru.
4. Aktifkan CSV parser/repository baru.
5. Uji Gemini provider pada subset produk dan review manual.
6. Baru izinkan pengguna memilih Gemini sebagai default.
7. Jangan menghapus rembg sampai semua pipeline lama yang memakainya dimigrasikan pada pekerjaan terpisah.

Rollback aplikasi cukup mengembalikan code; kolom baru bersifat additive dan tidak perlu dihapus. Jangan menghapus aset hasil baru saat rollback.

## 14. Execution Task List

> Agent pelaksana WAJIB memperbarui checkbox ini dari `- [ ]` menjadi `- [x]` segera setelah setiap tahap selesai, bukan sekaligus di akhir.

- [x] Tambahkan migrasi PostgreSQL, SQLite compatibility schema, dan staging setup untuk kolom/index baru.
- [x] Tambahkan product validation, URL normalization, dan raw image validation tests.
- [x] Refactor repository menjadi tenant-aware untuk create, import, dedupe, claim, status, retry, dan approval.
- [x] Implementasikan storage Raw/Clean yang aman dan atomik.
- [x] Implementasikan `product-photo-service` beserta Gemini dan G-Labs providers.
- [x] Refactor bulk worker menjadi enrichment stage, photo stage, dan G-Labs polling yang tenant-aware.
- [x] Refactor Single Product POST/PUT menjadi multipart-safe dengan JSON legacy compatibility.
- [x] Perbarui UI Add/Edit Single Product, required fields, packaging radio, photo preview/replace, AI section, dan provider selection.
- [x] Refactor CSV/XLSX import untuk enam kolom, row errors, duplicate modes, dan queue-after-save.
- [x] Refactor regenerate photo endpoint agar hanya queue dan selalu memakai raw reference.
- [x] Normalisasikan seluruh consumer kampanye/G-Labs agar memilih reference `clean_photo_url || raw_photo_url`, termasuk Sheets Autopilot.
- [x] Selaraskan log writer/reader per tenant dan status UI polling.
- [x] Tambahkan setting provider/model/auto-approve tanpa menduplikasi penyimpanan Gemini API key.
- [x] Tambahkan test single create, CSV import, tenant isolation, provider stub, retry, dan photo field semantics.
- [x] Jalankan seluruh test terkait dan build; perbaiki semua regression.
- [x] Uji manual Raw/Clean, approve/retry, edit replace photo, reference G-Labs Clean→Raw, dan partial CSV errors.
- [x] Perbarui dokumentasi/changelog dan tandai semua acceptance criteria yang telah terbukti.
- [x] Setelah verifikasi berhasil, jalankan SOP `release-non-interactive` patch, lalu verifikasi commit, tag, branch `main`, dan remote target.
- [x] Jangan deploy production; deploy dev/staging hanya bila diminta atau termasuk instruksi eksekusi pengguna.

## 15. Definition of Done

Pekerjaan selesai hanya bila seluruh acceptance criteria telah diuji, seluruh checkbox relevan sudah `[x]`, build berhasil, tidak ada akses lintas tenant, Product Database hanya menampilkan/mengelola Raw dan Clean, semua consumer G-Labs memakai Clean→Raw, tidak ada rembg pada alur baru, dan prosedur release repository berhasil sesuai `AGENTS.md`.
