# Implementation Plan — Rekonstruksi Deconstruct Lab

## 1. Tujuan

Merekonstruksi Deconstruct Lab menjadi **library URL video berdasarkan niche**. User dapat menyimpan URL tanpa langsung menjalankan AI, memilih beberapa URL, lalu memasukkannya ke antrean dekonstruksi massal yang tetap diproses **satu per satu**.

Hasil dekonstruksi menjadi aset bersama yang dapat diteruskan ke:

- Recipe Labs untuk membuat konsep/resep baru dari pola video.
- Multiplier Labs untuk membuat beberapa angle atau variasi konten.

## 2. Batas Scope

### Termasuk

- Menyimpan satu atau banyak URL tanpa langsung diproses.
- Pengelompokan URL berdasarkan niche.
- Tabel library dengan pencarian, filter, checkbox, dan status.
- Pemilihan massal dan antrean serial.
- Retry URL gagal.
- Tanggal input dan tanggal selesai dekonstruksi.
- Halaman detail per deconstructed asset.
- Aksi `Gunakan Hasil` menuju Recipe Labs atau Multiplier Labs.
- Kompatibilitas data dekonstruksi lama.
- Isolasi data berdasarkan tenant.

### Tidak termasuk

- Mengubah prompt atau kualitas analisis Gemini.
- Menjalankan beberapa dekonstruksi secara paralel.
- Mendesain ulang Recipe Labs atau Multiplier Labs.
- Mengubah pipeline produksi video setelah aset masuk ke kedua Labs.
- Deployment production tanpa instruksi manual eksplisit.

## 3. Kondisi Sistem Saat Ini

1. `app/deconstruct/page.js` berorientasi pada daftar batch berbentuk card.
2. Submit form langsung membuat batch, asset berstatus `pending_download`, dan scheduler job.
3. `processDeconstruct()` mengambil asset pending tertua secara global; `batch_id` dari payload belum membatasi asset yang diambil.
4. Hasil ditampilkan inline dengan expand/collapse pada card batch.
5. Recipe Labs sudah menerima `source_deconstruct_id`.
6. Multiplier Labs sudah menerima `asset_id`.
7. `viral_pattern_summary` sudah tersedia dan cocok menjadi kolom keterangan singkat.
8. Tabel dekonstruksi belum memiliki `niche`, `deconstructed_at`, dan isolasi tenant yang eksplisit.

## 4. Keputusan Arsitektur

### 4.1 Asset sebagai entitas utama

`re_deconstructed_assets` menjadi sumber utama tabel library. Batch tetap digunakan secara internal untuk mencatat satu tindakan “dekonstruksi URL terpilih”, tetapi tidak lagi menjadi tampilan utama halaman.

### 4.2 Status asset

| Status | Makna |
|---|---|
| `saved` | URL tersimpan dan belum masuk antrean |
| `pending_download` | Sudah dipilih dan menunggu giliran |
| `downloading` | Video sedang diunduh |
| `uploading` | Video sedang dikirim ke Gemini |
| `analyzing` | Gemini sedang menganalisis |
| `deconstructed` | Selesai |
| `failed` | Proses gagal dan dapat dicoba ulang |

Data lama dengan status selain `saved` tetap dipertahankan.

### 4.3 Antrean serial

- Satu klik proses massal membuat satu batch internal.
- Hanya ID asset yang dipilih yang dipindahkan dari `saved`/`failed` menjadi `pending_download`.
- Job membawa `batch_id` dan `tenant_id`.
- Worker mengambil satu pending asset di batch dan tenant tersebut.
- Setelah selesai/gagal dan jeda anti-block selesai, worker membuat job berikutnya hanya jika batch yang sama masih memiliki pending asset.
- Tidak ada `Promise.all` untuk proses Gemini.

### 4.4 Kompatibilitas navigasi

- Recipe Labs: `/recipe-labs?source_deconstruct_id={assetId}`
- Multiplier Labs: `/multiplier-lab?asset_id={assetId}`

Jangan menyeragamkan parameter pada fase ini karena kedua halaman sudah memiliki kontrak berbeda.

## 5. Desain UX

### 5.1 Header dan toolbar

- Judul: `Deconstruct Lab`.
- Tombol utama: `+ Simpan URL`.
- Search: URL, keterangan, atau ID.
- Filter niche.
- Filter status: Semua, Belum, Antre, Diproses, Selesai, Gagal.
- Tombol kontekstual: `Dekonstruksi Terpilih (N)`.

### 5.2 Form Simpan URL

- `Niche` wajib.
- Input manual banyak URL, satu per baris.
- Caption/catatan awal opsional dan mengikuti urutan URL.
- CSV tetap didukung dengan kolom `url`, `caption`, dan opsional `niche`.
- Tombol hanya bertuliskan `Simpan ke Library`; tidak menjalankan AI.
- Tolak URL kosong/tidak valid dan duplikat dalam tenant yang sama.
- Maksimum 50 URL per request seperti batas saat ini.

### 5.3 Tabel library

| Kolom | Perilaku |
|---|---|
| Checkbox | Aktif hanya untuk `saved` dan `failed` |
| ID | UUID dipendekkan untuk tampilan, UUID penuh tersedia pada tooltip/copy |
| Tanggal Input | Format lokal Indonesia |
| URL | Ellipsis, link membuka sumber di tab baru |
| Keterangan | `viral_pattern_summary`; kosong sebelum selesai |
| Niche | Badge |
| Proses | Badge status ramah user |
| Tanggal Dekonstruksi | `deconstructed_at`; kosong sebelum selesai |
| Aksi | `Lihat Detail`; retry melalui selection/action pada status gagal |

Aturan selection:

- `Pilih semua` hanya memilih baris eligible pada halaman/filter aktif.
- Selection dibersihkan setelah enqueue berhasil.
- Asset yang sedang diproses atau selesai tidak dapat dipilih ulang.
- Konfirmasi menampilkan jumlah URL sebelum enqueue.

### 5.4 Halaman detail

Route baru: `/deconstruct/[id]`.

Konten:

- Identitas asset, niche, URL, tanggal, dan status.
- Pipeline download/upload/analyze.
- Pesan error untuk status gagal.
- Tags editor.
- Viral pattern summary.
- Storyboard.
- Product ideas.
- Tombol `Gunakan Hasil` yang membuka dua pilihan:
  - `Buat Versi Baru di Recipe Labs`.
  - `Buat Variasi di Multiplier Labs`.

Untuk asset belum selesai, bagian hasil dan `Gunakan Hasil` dinonaktifkan.

## 6. Kontrak API yang Diusulkan

### `GET /api/v2/deconstruct`

Query:

- `q`
- `niche`
- `status`
- `page`
- `limit`
- `assets=true` tetap didukung untuk kompatibilitas consumer lama dan hanya mengembalikan asset selesai.

Response utama:

```json
{
  "success": true,
  "assets": [],
  "niches": [],
  "pagination": { "page": 1, "limit": 25, "total": 0, "pages": 0 }
}
```

### `POST /api/v2/deconstruct`

Hanya menyimpan asset:

```json
{
  "niche": "Skincare",
  "urls": "https://...\nhttps://...",
  "captions": "caption 1\ncaption 2"
}
```

Response berisi `saved_count`, `duplicate_count`, dan ID yang tersimpan. Endpoint tidak membuat scheduler job.

### `POST /api/v2/deconstruct/process`

```json
{
  "asset_ids": ["uuid-1", "uuid-2"],
  "target_recommendation_count": 3
}
```

Validasi seluruh asset harus milik tenant aktif dan berstatus `saved` atau `failed`. Dalam transaction:

1. Buat batch internal.
2. Kaitkan asset ke batch.
3. Reset field error/temporary yang relevan.
4. Ubah status menjadi `pending_download`.
5. Buat satu scheduler job pertama setelah transaction berhasil.

### `GET /api/v2/deconstruct/assets/[id]`

Mengembalikan satu asset lengkap dan hasil JSON yang sudah diparse.

### `PUT /api/v2/deconstruct/assets/[id]`

Mempertahankan update tags dan mengizinkan metadata aman seperti `niche`. Status dan hasil AI tidak boleh diubah dari browser.

### `DELETE /api/v2/deconstruct/assets/[id]`

Opsional dalam implementasi tahap ini. Jika dibuat, hanya boleh menghapus `saved`, `failed`, atau `deconstructed`; asset aktif tidak boleh dihapus.

## 7. Perubahan Database

Tambahkan migration idempotent PostgreSQL dengan advisory lock:

```sql
ALTER TABLE re_deconstruct_batches
  ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default_tenant';

ALTER TABLE re_deconstructed_assets
  ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
  ADD COLUMN IF NOT EXISTS niche TEXT,
  ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deconstructed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
```

Index:

```sql
CREATE INDEX IF NOT EXISTS re_deconstruct_assets_library_idx
  ON re_deconstructed_assets (tenant_id, status, niche, created_at DESC);

CREATE INDEX IF NOT EXISTS re_deconstruct_assets_queue_idx
  ON re_deconstructed_assets (tenant_id, batch_id, status, created_at);
```

Duplikat URL dinormalisasi di service layer. Bila unique index diterapkan, gunakan `(tenant_id, source_url)` hanya setelah audit duplikat data lama; jangan menghapus data lama otomatis.

Tambahkan `re_deconstruct_batches` dan `re_deconstructed_assets` ke daftar tabel yang diisolasi tenant pada adapter database.

## 8. Rencana Per File dan Before/After

### 8.1 `lib/db-pg.js`

**Code Sebelum (Current/Before)**

```js
const isolatedTables = [
  'users',
  'brand_profiles',
  // tabel deconstruct belum terdaftar
];
```

**Code Sesudah (Proposed/After)**

```js
const isolatedTables = [
  'users',
  'brand_profiles',
  're_deconstruct_batches',
  're_deconstructed_assets',
];

// Migration idempotent menambah tenant_id, niche, queued_at,
// deconstructed_at, updated_at, dan index library/queue.
```

### 8.2 `lib/db.js`

**Code Sebelum (Current/Before)**

```js
export async function createDeconstructAsset(data) {
  // Asset selalu terhubung ke batch dan default langsung pending_download.
}

export async function getNextPendingDeconstructAsset() {
  // Mengambil pending asset tertua secara global.
}
```

**Code Sesudah (Proposed/After)**

```js
export async function createSavedDeconstructAssets(items, tenantId) {}
export async function listDeconstructAssets(filters, tenantId) {}
export async function getDeconstructAssetById(id, tenantId) {}
export async function enqueueDeconstructAssets(assetIds, options, tenantId) {}
export async function getNextPendingDeconstructAsset(batchId, tenantId) {}
export async function updateDeconstructAsset(id, updates, tenantId) {}
```

Semua daftar field update wajib memakai allowlist agar nama kolom tidak berasal dari input bebas.

### 8.3 `app/api/v2/deconstruct/route.js`

**Code Sebelum (Current/Before)**

```js
await createDeconstructBatch(...);
await createDeconstructAsset(...);
await createJob('re_deconstruct', { batch_id: batchId });
```

**Code Sesudah (Proposed/After)**

```js
// GET: library terfilter dan paginated.
// POST: validasi niche + URL, lalu simpan status `saved`.
// Tidak membuat scheduler job pada operasi simpan.
```

Pertahankan mode `assets=true` agar Multiplier Labs tidak rusak.

### 8.4 `app/api/v2/deconstruct/process/route.js` — file baru

**Code Sebelum (Current/Before)**

```text
File belum ada. Proses selalu terjadi saat batch dibuat.
```

**Code Sesudah (Proposed/After)**

```js
export const POST = withTenantContext(async request => {
  // Validasi asset_ids, enqueue transactionally, buat satu job awal.
});
```

### 8.5 `app/api/v2/deconstruct/assets/[id]/route.js`

**Code Sebelum (Current/Before)**

```js
export const PUT = withTenantContext(async (req, { params }) => {
  await updateDeconstructAsset(id, { tags: body.tags });
});
```

**Code Sesudah (Proposed/After)**

```js
export const GET = withTenantContext(async (req, { params }) => {});
export const PUT = withTenantContext(async (req, { params }) => {
  // Update allowlisted metadata: tags dan niche.
});
```

### 8.6 `lib/scheduler-processors.js`

**Code Sebelum (Current/Before)**

```js
const asset = getNextPendingDeconstructAsset();
// ...
const nextAsset = getNextPendingDeconstructAsset();
```

**Code Sesudah (Proposed/After)**

```js
const { batch_id: batchId, tenant_id: tenantId } = payload;
const asset = await getNextPendingDeconstructAsset(batchId, tenantId);
// ... proses satu asset ...
await updateDeconstructAsset(asset.id, {
  status: 'deconstructed',
  deconstructed_at: new Date(),
}, tenantId);
const nextAsset = await getNextPendingDeconstructAsset(batchId, tenantId);
```

Pastikan seluruh pemanggilan DB di processor di-`await`, cleanup tetap berjalan, dan job berikutnya hanya dibuat untuk batch/tenant yang sama.

### 8.7 `app/deconstruct/page.js`

**Code Sebelum (Current/Before)**

```jsx
<button>+ New Batch</button>
{/* Batch cards dan expanded result */}
```

**Code Sesudah (Proposed/After)**

```jsx
<button>+ Simpan URL</button>
<DeconstructFilters />
<DeconstructAssetTable />
<button disabled={!selectedIds.size}>
  Dekonstruksi Terpilih ({selectedIds.size})
</button>
```

Gunakan state untuk filter, pagination, selection, modal/form, polling status aktif, dan konfirmasi enqueue. Jangan memuat storyboard besar pada endpoint list.

### 8.8 `app/deconstruct/[id]/page.js` — file baru

**Code Sebelum (Current/Before)**

```text
File belum ada; detail masih dirender inline dalam halaman list.
```

**Code Sesudah (Proposed/After)**

```jsx
<AssetHeader />
<DeconstructPipeline />
<DeconstructResults />
<UseResultMenu
  recipeHref={`/recipe-labs?source_deconstruct_id=${asset.id}`}
  multiplierHref={`/multiplier-lab?asset_id=${asset.id}`}
/>
```

Ikuti dokumentasi dynamic route dan async `params` pada versi Next.js yang terpasang.

### 8.9 `app/recipe-labs/page.js`

**Code Sebelum (Current/Before)**

```js
const deconstructId = params.get('source_deconstruct_id');
```

**Code Sesudah (Proposed/After)**

```js
const deconstructId = params.get('source_deconstruct_id');
// Kontrak tetap; verifikasi asset dari tombol Gunakan Hasil terpilih otomatis.
```

Tidak perlu redesign; hanya perbaiki bila verifikasi menemukan preselection rusak.

### 8.10 `app/multiplier-lab/page.js`

**Code Sebelum (Current/Before)**

```js
const preSelectedAssetId = searchParams.get('asset_id');
```

**Code Sesudah (Proposed/After)**

```js
const preSelectedAssetId = searchParams.get('asset_id');
// Kontrak tetap; verifikasi asset tersedia lalu setSelectedAssetId.
```

Tidak perlu redesign; hanya perbaiki bila verifikasi menemukan preselection rusak.

### 8.11 `app/api/recipe-labs/deconstructed-assets/route.js`

**Code Sebelum (Current/Before)**

```sql
SELECT id, source_url, original_caption, product_ideas_json, created_at, tags
FROM re_deconstructed_assets
WHERE status = 'deconstructed'
```

**Code Sesudah (Proposed/After)**

```sql
SELECT id, source_url, original_caption, product_ideas_json,
       created_at, tags, niche, viral_pattern_summary
FROM re_deconstructed_assets
WHERE status = 'deconstructed'
```

Query wajib tenant-scoped melalui context database.

### 8.12 Test files — file baru sesuai pola test repository

**Code Sebelum (Current/Before)**

```text
Belum ada test khusus URL Library dan enqueue serial Deconstruct Lab.
```

**Code Sesudah (Proposed/After)**

```js
it('menyimpan URL sebagai saved tanpa membuat job', async () => {});
it('hanya enqueue asset milik tenant aktif yang eligible', async () => {});
it('worker mengambil satu asset dari batch dan tenant yang tepat', async () => {});
it('mengisi deconstructed_at setelah sukses', async () => {});
```

## 9. Validasi dan Error Handling

- Trim dan validasi URL dengan `new URL()`; izinkan protokol `http:` dan `https:`.
- Normalisasi URL untuk pemeriksaan duplikat tanpa mengubah URL sumber yang ditampilkan.
- Niche wajib dan memiliki batas panjang yang wajar, misalnya 80 karakter.
- `asset_ids` harus array unik, tidak kosong, dan dibatasi maksimal 50.
- Gunakan transaction untuk batch + perubahan status asset.
- Request campuran tenant atau status tidak eligible harus gagal tanpa partial update.
- Asset aktif tidak boleh dienqueue ulang.
- Kegagalan satu asset tidak menghentikan asset berikutnya.
- Jangan tampilkan path lokal atau URI internal Gemini dalam response list.

## 10. Strategi Polling

- Poll setiap 4–5 detik hanya bila ada asset berstatus antre/aktif pada hasil yang terlihat atau setelah enqueue.
- Hentikan interval ketika tidak ada asset aktif dan saat component unmount.
- Endpoint list mengembalikan data ringan; detail JSON hanya diambil pada halaman detail.

## 11. Verifikasi

### Automated

- Lint file yang berubah.
- Test repository terkait DB/API/scheduler.
- Build Next.js penuh.
- Jalankan test baru untuk save, list/filter, enqueue, tenant boundary, serial worker, success, failure, dan retry.

### Manual staging

1. Simpan tiga URL dalam satu niche; pastikan tidak ada job berjalan.
2. Pastikan ketiganya muncul dengan status `Belum`.
3. Pilih URL 1 dan 3, lalu enqueue.
4. Pastikan hanya satu URL berada pada tahap aktif dalam satu waktu.
5. Pastikan URL 2 tetap `Belum`.
6. Pastikan URL berikutnya berjalan setelah URL sebelumnya selesai/gagal dan delay selesai.
7. Pastikan keterangan serta tanggal dekonstruksi muncul setelah sukses.
8. Buka detail dan validasi storyboard/product ideas.
9. Klik Recipe Labs dan pastikan asset otomatis terpilih.
10. Klik Multiplier Labs dan pastikan asset otomatis terpilih.
11. Uji retry untuk status gagal.
12. Uji dua tenant dan pastikan asset tidak bocor antar-tenant.

## 12. Acceptance Criteria

- Menyimpan URL tidak mengonsumsi Gemini dan tidak membuat job dekonstruksi.
- User dapat mengelompokkan dan memfilter URL berdasarkan niche.
- Tabel menampilkan seluruh kolom yang disepakati.
- Hanya asset terpilih yang masuk antrean.
- Pemrosesan tetap satu asset per giliran.
- Worker tidak mengambil asset dari batch atau tenant lain.
- Asset selesai memiliki `viral_pattern_summary` dan `deconstructed_at`.
- Detail dapat dibuka dari tabel.
- `Gunakan Hasil` menyediakan Recipe Labs dan Multiplier Labs dengan preselection benar.
- Data dan flow lama tetap dapat dibaca.
- Build dan test lulus.

## 13. Risiko dan Mitigasi

| Risiko | Mitigasi |
|---|---|
| Worker mengambil antrean lain | Scope query dengan `batch_id` + `tenant_id` |
| URL tersimpan ikut terproses | Status awal wajib `saved` |
| Double enqueue | Transaction + validasi status eligible |
| Kebocoran antar-tenant | Kolom tenant, adapter isolation, test boundary |
| Payload list terlalu berat | Pisahkan list summary dan detail JSON |
| Data lama kehilangan akses | Backfill default tenant dan pertahankan status lama |
| Consumer Labs rusak | Pertahankan `assets=true` dan query parameter yang ada |

## 14. Execution Task List

- [ ] Audit final schema staging dan data duplikat sebelum migration.
- [ ] Baca dokumentasi Next.js lokal untuk Route Handlers, dynamic routes, dan search params.
- [ ] Tambahkan migration idempotent dan tenant isolation.
- [ ] Implementasikan repository/service URL Library dan query queue scoped.
- [ ] Ubah API utama menjadi save/list tanpa auto-process.
- [ ] Tambahkan endpoint enqueue massal.
- [ ] Perluas endpoint detail asset dan metadata update.
- [ ] Perbaiki processor agar serial per batch dan tenant serta mencatat tanggal selesai.
- [ ] Rekonstruksi halaman utama menjadi toolbar + tabel library.
- [ ] Buat halaman detail asset dan menu `Gunakan Hasil`.
- [ ] Verifikasi integrasi Recipe Labs dan Multiplier Labs.
- [ ] Tambahkan automated tests.
- [ ] Jalankan lint/test/build dan perbaiki seluruh regression.
- [ ] Jalankan smoke test pada staging sesuai checklist.
- [ ] Perbarui checkbox task secara real-time selama implementasi.
- [ ] Setelah seluruh verifikasi berhasil, jalankan SOP release non-interaktif patch, push `main` dan tag, lalu verifikasi remote.

## 15. Release

Setelah implementasi dan verifikasi berhasil:

```bash
npm run release-non-interactive -- --type patch --title "Deconstruct URL Library" --points "Tambah library URL berbasis niche|Tambah antrean dekonstruksi massal serial|Tambah detail asset dan integrasi Recipe serta Multiplier Labs"
```

Deployment production tidak termasuk dan dilarang tanpa perintah manual eksplisit pengguna.
