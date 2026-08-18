# Implementation Plan — Multiplier Lab Blueprint × Product

## Tujuan

Mendukung dua workflow:

1. **Multi Blueprint → 1 Produk**: beberapa konsep viral untuk memasarkan satu produk.
2. **1 Blueprint → Multi Produk**: satu konsep viral dibuat ulang untuk beberapa produk.

Setiap pasangan `blueprint × produk` menjadi satu baris task dan tetap diproses serial.

## Scope

- Pencarian blueprint berdasarkan keyword pada URL, niche, tags, caption, resume viral, dan produk rekomendasi.
- Hasil pencarian berbentuk card dengan preview lengkap.
- Selection satu/banyak blueprint sesuai mode.
- Selection satu/banyak produk sesuai mode.
- Review tabel kombinasi sebelum generate.
- Task per baris dan batch grouping.
- Mempertahankan konfigurasi VSO, bridge, audio, TTS, G-Labs, dan FFmpeg saat ini.
- Tidak mengubah prompt Multiplier atau membuat worker paralel.

## UX

### Mode A — Multi Blueprint → 1 Produk

```text
Cari keyword → pilih beberapa blueprint → pilih satu produk
→ konfigurasi bersama → review kombinasi → generate per baris
```

### Mode B — 1 Blueprint → Multi Produk

```text
Cari keyword → pilih satu blueprint → pilih beberapa produk/URL
→ konfigurasi bersama → review kombinasi → generate per baris
```

### Preview Blueprint

Setiap card menampilkan:

- URL, niche, tags, tanggal dekonstruksi.
- `viral_pattern_summary` sebagai resume.
- Hook/ringkasan storyboard.
- Jumlah scene.
- Produk rekomendasi dari `product_ideas_json`.
- Tombol `Lihat Detail`.
- Checkbox/radio sesuai mode.

### Review Table

Kolom: nomor, blueprint, produk, mode bridge, bridge clip, output video, dan aksi hapus baris.

Tombol final: `Generate N Video Baru`.

## Model Data dan API

### Search Blueprint

`GET /api/v2/deconstruct?assets=true&q=...&limit=20`

Endpoint mengembalikan summary ringan; pencarian mencakup metadata dan teks hasil dekonstruksi. Storyboard lengkap hanya dimuat saat preview/detail dibuka.

### Submit Multiplier

Pertahankan `POST /api/v2/multiplier`, tetapi gunakan payload rows eksplisit:

```json
{
  "mode": "multi_blueprint_one_product",
  "rows": [
    {
      "deconstruct_asset_id": "asset-1",
      "target_product_id": "product-1",
      "target_product_url": "https://...",
      "affiliate_url": "https://..."
    }
  ],
  "shared_config": {
    "vso": {},
    "bridging": {},
    "audio": {}
  }
}
```

Server membuat satu `batch_id`, lalu satu task per row dalam transaction. Batas awal: maksimal 20 row per submit.

### Perbaikan Wajib Existing Mass Mode

UI saat ini membuat `{ url, affiliate_url }`, sedangkan API membaca `target_product_url`/`product_url`. Normalisasi kontrak menjadi `target_product_url` agar URL tidak hilang.

## Perubahan Per File

### `app/multiplier-lab/page.js`

**Code Sebelum**

```jsx
<input placeholder="Cari blueprint berdasarkan URL atau tag" />
<select value={selectedAssetId}>...</select>
```

**Code Sesudah**

```jsx
<WorkflowModeSelector />
<BlueprintSearchResults selectionMode={mode} />
<ProductSelector selectionMode={mode} />
<CombinationReviewTable rows={generatedRows} />
<button>Generate {generatedRows.length} Video Baru</button>
```

Pertahankan accordion konfigurasi yang ada. Bentuk kombinasi diturunkan dari selection, bukan diedit sebagai teks mentah.

### `app/api/v2/deconstruct/route.js`

**Code Sebelum**

```js
if (searchParams.get('assets') === 'true') {
  // Mengembalikan semua asset selesai.
}
```

**Code Sesudah**

```js
// assets=true mendukung q, niche, limit, dan cursor/page.
// Response berisi summary, viral_pattern_summary, scene_count,
// recommended_products, niche, tags, dan deconstructed_at.
```

Query wajib tenant-scoped dan parameterized.

### `app/api/v2/multiplier/route.js`

**Code Sebelum**

```js
const rowProductUrl = row.target_product_url || row.product_url || '';
```

**Code Sesudah**

```js
// Validasi rows eksplisit.
// Buat batch + task per row secara transactional.
// Snapshot config dan identitas produk pada setiap task.
```

Pertahankan kompatibilitas payload lama sementara UI baru dimigrasikan.

### `lib/db.js`

**Code Sebelum**

```js
export async function createMultiplierTask(data) {}
export async function getNextPendingMultiplierTask() {}
```

**Code Sesudah**

```js
export async function createMultiplierBatchWithTasks(batch, rows) {}
export async function getNextPendingMultiplierTask() {}
```

Tambahkan penyimpanan `batch_id`, `target_product_id`, `row_index`, dan snapshot produk/config. Gunakan transaction dan tenant scope.

### `lib/db-pg.js`

**Code Sebelum**

```js
// Schema re_multiplier_tasks belum memuat grouping dan metadata row lengkap.
```

**Code Sesudah**

```sql
ALTER TABLE re_multiplier_tasks
  ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
  ADD COLUMN IF NOT EXISTS batch_id TEXT,
  ADD COLUMN IF NOT EXISTS target_product_id TEXT,
  ADD COLUMN IF NOT EXISTS row_index INTEGER,
  ADD COLUMN IF NOT EXISTS product_snapshot_json JSONB;
```

Tambahkan index queue `(tenant_id, status, created_at)` dan batch `(tenant_id, batch_id, row_index)` secara idempotent.

### `lib/re-multiplier-worker.js`

**Code Sebelum**

```js
const task = getNextPendingMultiplierTask();
```

**Code Sesudah**

```js
const task = await getNextPendingMultiplierTask();
// Satu invocation memproses satu row.
// Product resolver memakai snapshot/target_product_id/URL milik row.
```

Jangan menambahkan parallel processing. Kegagalan satu row tidak boleh menghapus row lain.

### Test baru

**Code Sebelum**

```text
Belum ada test kombinasi blueprint × produk.
```

**Code Sesudah**

```js
it('membuat N task dari N blueprint dan satu produk', async () => {});
it('membuat N task dari satu blueprint dan N produk', async () => {});
it('mempertahankan target_product_url tiap row', async () => {});
it('memproses task secara serial', async () => {});
```

## Validasi

- Blueprint harus `deconstructed` dan milik tenant aktif.
- Produk wajib tersedia melalui ID library, URL valid, atau input manual lengkap.
- Mode A: minimal satu blueprint dan tepat satu produk.
- Mode B: tepat satu blueprint dan minimal satu produk.
- Kombinasi duplikat dihapus sebelum submit.
- Maksimum 20 kombinasi per submit.
- Konfirmasi biaya/jumlah video sebelum generate.

## Acceptance Criteria

- Keyword menemukan blueprint melalui resume dan rekomendasi produk, bukan hanya URL/tags.
- User dapat mereview blueprint sebelum memilih.
- Kedua mode menghasilkan kombinasi yang benar.
- Setiap kombinasi menghasilkan satu task dengan produk dan konfigurasi yang benar.
- URL produk massal tidak hilang.
- Worker tetap menjalankan satu row per giliran.
- Existing preset dan workflow video tetap berfungsi.
- Data antar-tenant terisolasi.
- Test dan build lulus.

## Execution Task List

- [ ] Baca dokumentasi Next.js lokal dan audit schema/task terbaru.
- [ ] Tambahkan migration idempotent dan tenant/index fields Multiplier.
- [ ] Implementasikan blueprint search summary server-side.
- [ ] Implementasikan batch + row transaction pada repository/API.
- [ ] Perbaiki kontrak URL produk massal.
- [ ] Implementasikan dua workflow mode dan card preview blueprint.
- [ ] Implementasikan multi-product picker dan combination review table.
- [ ] Pastikan worker menggunakan data produk per row dan tetap serial.
- [ ] Tambahkan test kedua kombinasi, tenant, failure, dan serial queue.
- [ ] Jalankan lint, test, build, dan smoke test staging.
- [ ] Update checkbox ini real-time selama implementasi.
- [ ] Setelah verifikasi berhasil, jalankan release patch sesuai SOP repository.

## Release

```bash
npm run release-non-interactive -- --type patch --title "Multiplier Blueprint Product Workflows" --points "Tambah pencarian dan preview blueprint lengkap|Tambah workflow multi blueprint dan multi produk|Perbaiki task per baris dan antrean serial"
```

Jangan deploy production tanpa perintah manual eksplisit.
