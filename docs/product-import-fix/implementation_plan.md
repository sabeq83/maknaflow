# Implementation Plan — Perbaikan Impor ZIP dan Product Repository PostgreSQL

## 1. Sasaran

Memperbaiki kondisi impor ZIP yang menampilkan sukses palsu, memastikan produk tersimpan dan langsung terbaca pada halaman `/products`, serta menutup kebocoran tenant dan risiko penulisan file di luar `public/`.

Kriteria selesai:

- response sukses hanya diberikan bila baris benar-benar masuk database;
- halaman produk membaca `product_extractions`, bukan tabel lama `products`;
- semua operasi produk dibatasi dengan `tenant_id` sesi aktif;
- impor memakai transaksi PostgreSQL nyata;
- ZIP tidak dapat menulis file melalui path traversal;
- duplikat dilaporkan sebagai `skipped`, bukan `imported`;
- kegagalan satu baris membatalkan seluruh batch database;
- tersedia test regresi yang membuktikan kasus sukses, duplikat, rollback, dan isolasi tenant.

## 2. Keputusan Arsitektur

### 2.1 Product repository eksplisit

Jangan menambahkan `product_extractions` ke `isolatedTables` pada `lib/db.js`. Interceptor saat ini tidak alias-aware dan dapat menghasilkan `WHERE tenant_id = ?` pada posisi yang salah untuk query `JOIN`.

Buat repository PostgreSQL khusus yang selalu menerima atau membaca tenant aktif dan menggunakan parameter `$n` secara eksplisit. Repository ini menjadi jalur tunggal untuk list, detail, create, update, delete, dan bulk import produk.

### 2.2 PostgreSQL-only pada runtime aktif

Runtime aplikasi saat ini adalah PostgreSQL. Endpoint impor tidak perlu mempertahankan fallback SQLite `PRAGMA`. Kompatibilitas semu justru menyembunyikan error dan membuat SQL `INSERT OR REPLACE` lolos ke PostgreSQL.

Gunakan `information_schema.columns` hanya untuk menyaring kolom payload lama, lalu gunakan `INSERT ... ON CONFLICT` native PostgreSQL.

### 2.3 Transaksi nyata dan hasil terukur

Gunakan `withPgTransaction(client => ...)`. Nilai `imported_count` berasal dari jumlah row yang dikembalikan `INSERT ... RETURNING id`, bukan dari jumlah iterasi loop.

Kebijakan konflik:

- ID, `source_url`, atau `input_source` yang sudah dimiliki tenant yang sama: `skipped`;
- nilai yang sama pada tenant lain tidak dianggap duplikat;
- error SQL selain konflik yang memang diantisipasi: throw dan rollback seluruh batch.

### 2.4 Keamanan aset ZIP

- Tolak absolute path, segmen `..`, NUL byte, symlink-like entry, dan entry di luar `assets/`.
- Resolve target dengan `path.resolve(publicRoot, relativePath)` dan pastikan hasil tetap berada di bawah `publicRoot`.
- Batasi jumlah produk, jumlah file, ukuran ZIP, total ukuran hasil ekstraksi, dan ekstensi aset gambar.
- Tulis aset ke staging directory sementara terlebih dahulu.
- Setelah transaksi database berhasil, promosikan aset dengan rename; kegagalan aset dilaporkan jelas dan tidak boleh menghasilkan pesan “semua berhasil”.
- Jangan hapus atau overwrite aset lama tanpa backup/restore karena rollback database tidak dapat otomatis me-rollback filesystem.

## 3. Perubahan per File

### 3.1 `[NEW] lib/product-repository.js`

#### Code Sebelum (Current/Before)

```javascript
// File belum ada. Akses produk tersebar antara wrapper legacy dan SQL langsung.
```

#### Code Sesudah (Proposed/After)

```javascript
import { getActiveTenantId } from './tenant-context.js';
import { pgQuery, withPgTransaction } from './db-pg.js';

export async function listProducts({ search = '', category = '' } = {}) {
  const tenantId = getActiveTenantId();
  const params = [tenantId];
  const where = ['tenant_id = $1'];

  if (search.trim()) {
    params.push(`%${search.trim()}%`);
    where.push(`(
      product_name ILIKE $${params.length}
      OR unique_selling_point ILIKE $${params.length}
      OR tags ILIKE $${params.length}
    )`);
  }
  if (category.trim()) {
    params.push(category.trim());
    where.push(`LOWER(category) = LOWER($${params.length})`);
  }

  return (await pgQuery(`
    SELECT * FROM product_extractions
    WHERE ${where.join(' AND ')}
    ORDER BY created_at DESC
  `, params)).rows;
}

export async function importProducts(products) {
  const tenantId = getActiveTenantId();
  return withPgTransaction(async client => {
    let importedCount = 0;
    let skippedCount = 0;

    for (const product of products) {
      const duplicate = await client.query(`
        SELECT id FROM product_extractions
        WHERE tenant_id = $1 AND (
          id = $2
          OR (NULLIF($3, '') IS NOT NULL AND source_url = $3)
          OR (NULLIF($4, '') IS NOT NULL AND input_source = $4)
        ) LIMIT 1
      `, [tenantId, product.id, product.source_url || '', product.input_source || '']);

      if (duplicate.rowCount) {
        skippedCount += 1;
        continue;
      }

      const inserted = await client.query(/* INSERT native PostgreSQL + RETURNING id */);
      if (inserted.rowCount !== 1) throw new Error('Produk gagal disimpan.');
      importedCount += 1;
    }

    return { importedCount, skippedCount };
  });
}
```

Catatan implementasi:

- kolom insert dibentuk hanya dari allowlist kolom `product_extractions`;
- `tenant_id`, `created_at`, dan kolom server-managed tidak boleh diambil dari ZIP;
- `tenant_id` selalu berasal dari sesi;
- fungsi detail/update/delete dan pipeline JOIN mengikuti pola filter eksplisit yang sama;
- update field memakai allowlist, bukan nama kolom mentah dari request.

### 3.2 `[MODIFY] lib/db.js`

#### Code Sebelum (Current/Before)

```javascript
const isolatedTables = [
  // ...
  'products',
  // ...
];

export async function getAllProductExtractions() {
  return await dbAll('SELECT * FROM products ORDER BY created_at DESC', []);
}

// create/get/update/delete dan pipeline JOIN juga memakai products.
```

#### Code Sesudah (Proposed/After)

```javascript
const isolatedTables = [
  // hapus entry legacy 'products'; jangan tambahkan product_extractions
];

// Wrapper produk legacy dihapus atau dibuat delegasi ke product-repository.js.
// getStats memakai query repository/count eksplisit dengan tenant_id.
// Pipeline JOIN memakai alias dan tenant predicate eksplisit.
```

Tujuannya bukan hanya mengganti nama tabel, tetapi menghentikan akses produk melalui interceptor tenant yang rapuh.

### 3.3 `[MODIFY] app/api/v2/products/route.js`

#### Code Sebelum (Current/Before)

```javascript
export async function GET(request) {
  let products = await getAllProductExtractions();
  // filter dilakukan di memory
}

export async function POST(req) {
  const body = await req.json();
  await createProductExtraction(data);
}
```

#### Code Sesudah (Proposed/After)

```javascript
export async function GET(request) {
  const user = getCurrentUser(request);
  if (!user || user.tenantId === '__none__') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const products = await listProducts({ search, category });
  return NextResponse.json({ success: true, data: rewriteImageUrls(products) });
}

export async function POST(request) {
  const user = getCurrentUser(request);
  if (!user || user.tenantId === '__none__') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const product = await createProduct(validatedInput);
  return NextResponse.json({ success: true, id: product.id, data: product }, { status: 201 });
}
```

Filter search/category dipindahkan ke SQL agar tidak mengambil seluruh tabel ke memory.

### 3.4 `[MODIFY] app/api/v2/products/[id]/route.js`

#### Code Sebelum (Current/Before)

```javascript
const product = await getProductExtraction(id);
await updateProductExtraction(id, body);
await deleteProductExtraction(id);
```

#### Code Sesudah (Proposed/After)

```javascript
const user = getCurrentUser(request);
if (!user || user.tenantId === '__none__') return unauthorized();

const product = await getProductById(id);       // WHERE id=$1 AND tenant_id=$2
const updated = await updateProduct(id, body); // allowlist + tenant predicate
const deleted = await deleteProduct(id);       // transaction + tenant predicate
```

`404` diberikan bila ID tidak ada pada tenant aktif; jangan membocorkan keberadaan ID tenant lain.

### 3.5 `[MODIFY] app/api/v2/products/import/route.js`

#### Code Sebelum (Current/Before)

```javascript
const tableInfo = await db.prepare(`PRAGMA table_info("${tableName}")`).all();
const sql = `INSERT OR REPLACE INTO "${tableName}" (...) VALUES (...)`;

try {
  await db.prepare(sql).run(...values);
} catch (err) {
  console.error(err);
}

importedCount++;
```

#### Code Sesudah (Proposed/After)

```javascript
export async function POST(request) {
  try {
    const user = getCurrentUser(request);
    if (!user || user.tenantId === '__none__') return unauthorized();

    const archive = validateZip(await readBoundedUpload(request));
    const payload = validatePayload(readProductsPayload(archive));
    const stagedAssets = await stageValidatedAssets(archive);

    try {
      const result = await importProducts(payload.products);
      const assetResult = await promoteAssets(stagedAssets);

      return NextResponse.json({
        success: true,
        message: `${result.importedCount} produk berhasil diimpor, ${result.skippedCount} dilewati.`,
        imported_count: result.importedCount,
        skipped_count: result.skippedCount,
        asset_count: assetResult.count,
        warnings: assetResult.warnings
      });
    } finally {
      await cleanupStaging(stagedAssets);
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: publicImportError(error) },
      { status: error.status || 500 }
    );
  }
}
```

Response `success: true` tetap valid ketika semua produk merupakan duplikat, tetapi message wajib menyebut `0 berhasil diimpor` dan jumlah skipped. Payload kosong dikembalikan sebagai `400`.

### 3.6 `[MODIFY] app/api/v2/products/export/route.js`

#### Code Sebelum (Current/Before)

```javascript
products = await db.prepare(
  'SELECT * FROM product_extractions ORDER BY created_at DESC'
).all();
```

#### Code Sesudah (Proposed/After)

```javascript
const user = getCurrentUser(request);
if (!user || user.tenantId === '__none__') return unauthorized();

products = await listProductsForExport(ids);
// repository menambahkan WHERE tenant_id = $1 dan memvalidasi ids.
```

Ekspor harus diperbaiki dalam rilis yang sama karena ZIP ekspor merupakan input untuk endpoint impor dan saat ini belum tenant-scoped.

### 3.7 `[NEW] scripts/test-product-import.mjs`

#### Code Sebelum (Current/Before)

```javascript
// Belum ada test regresi khusus produk/impor.
```

#### Code Sesudah (Proposed/After)

```javascript
// Membuat tenant dan fixture unik.
// Menguji repository dengan transaksi/database staging terisolasi:
// 1. satu produk valid -> imported=1 dan tenant_id benar;
// 2. impor ulang -> imported=0, skipped=1;
// 3. payload invalid -> tidak ada row parsial;
// 4. tenant B tidak dapat membaca/mengubah/menghapus produk tenant A;
// 5. ZIP dengan ../ ditolak;
// 6. error SQL menghasilkan success=false, bukan toast sukses.
// Cleanup fixture pada finally.
```

Tambahkan script berikut ke `package.json`:

```json
{
  "scripts": {
    "test:product-import": "node scripts/test-product-import.mjs"
  }
}
```

## 4. Urutan Implementasi

1. Tambahkan regression test yang mereproduksi sukses palsu dan tenant leak.
2. Buat product repository PostgreSQL dengan tenant predicate eksplisit.
3. Migrasikan GET/POST/detail/update/delete/export ke repository.
4. Tulis ulang impor ZIP memakai transaksi nyata dan SQL PostgreSQL native.
5. Tambahkan validasi ZIP dan staging aset.
6. Jalankan test, lint/build yang tersedia, lalu smoke test staging.
7. Rilis patch, push, deploy Node 2 sekali, dan verifikasi database serta UI.

## 5. Verification Plan

### Automated

```bash
npm run test:product-import
npm run staging:check
npm run build
```

Verifikasi tambahan terhadap adapter:

- tidak ada lagi `FROM products`, `INTO products`, atau `JOIN products` pada flow produk;
- tidak ada `PRAGMA` atau `INSERT OR REPLACE` pada route impor runtime;
- tidak ada query `product_extractions` baru tanpa tenant predicate, kecuali maintenance script yang memang eksplisit global.

### Database

Sebelum impor, catat count tenant aktif. Setelah impor fixture berisi `N` produk baru:

```sql
SELECT tenant_id, COUNT(*)
FROM product_extractions
GROUP BY tenant_id;
```

Count tenant aktif harus bertambah tepat `N`; tenant lain tidak berubah.

### Manual Staging Node 2

1. Login sebagai admin tenant biasa.
2. Impor ZIP satu kali: toast menunjukkan jumlah masuk dan produk muncul setelah refresh otomatis.
3. Impor ZIP yang sama: toast menunjukkan `0` masuk dan seluruhnya skipped.
4. Login tenant lain: produk tidak terlihat.
5. Impor ZIP rusak/path traversal: UI menampilkan error dan count database tidak berubah.

## 6. Rollout dan Recovery

- Tidak perlu migrasi destruktif; tabel canonical tetap `product_extractions`.
- Sebelum deploy, backup tabel `product_extractions` dan direktori aset produk.
- Deploy Node 2 memakai satu invocation `npm run deploy:node2-wsl`.
- Jika smoke test gagal, rollback release/tag aplikasi; tidak ada schema change yang perlu dibalik.
- Produk dari dua percobaan gagal sebelumnya tidak perlu dibersihkan karena pemeriksaan database menunjukkan tidak ada row yang tersimpan.

## Execution Task List

- [x] Tambahkan test reproduksi sukses palsu, rollback, duplicate, dan tenant isolation.
- [x] Buat `lib/product-repository.js` dengan query PostgreSQL native dan tenant predicate eksplisit.
- [x] Migrasikan `app/api/v2/products/route.js` ke repository dan autentikasi tenant.
- [x] Migrasikan `app/api/v2/products/[id]/route.js` ke repository dan allowlist update.
- [x] Migrasikan `app/api/v2/products/export/route.js` agar tenant-scoped.
- [x] Tulis ulang `app/api/v2/products/import/route.js` dengan transaksi nyata dan penghitung berbasis `rowCount`.
- [x] Tambahkan validasi ukuran, payload, ekstensi, serta proteksi ZIP path traversal.
- [x] Hapus/delegasikan wrapper produk legacy dan perbaiki `getStats` serta pipeline JOIN.
- [x] Jalankan `npm run test:product-import`.
- [x] Jalankan `npm run staging:check` dan `npm run build`.
- [x] Audit query produk dengan `rg` untuk referensi tabel legacy dan query tanpa tenant scope.
- [x] Jalankan rilis patch non-interaktif sesuai SOP repository.
- [x] Pastikan branch `main` dan tag rilis berhasil terunggah ke remote.
- [x] Deploy Node 2 menggunakan `npm run deploy:node2-wsl` satu kali.
- [ ] Verifikasi impor pertama, impor duplikat, count PostgreSQL, dan visibilitas UI Node 2.
