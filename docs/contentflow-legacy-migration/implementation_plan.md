# Implementation Plan — Migrasi ContentFlow MAKNA Grid ke MAKNA Flow

## 1. Sasaran dan Scope

Memigrasikan metadata dan aset ContentFlow dari MAKNA Grid Node 1 (`100.65.62.63:3000`) ke MAKNA Flow Node 2 (`100.117.59.92:5020`) dengan tenant isolation, dry-run, checksum, collision report, transaksi PostgreSQL, dan rollback berbasis batch.

Sumber aktif:

```text
/home/sabeqmursyid/makna-grid/data/makna_grid.db
table: content_flow_items
total: 598
```

Target aktif:

```text
PostgreSQL maknaflow_staging
table: content_flow_items
existing rows: 50
target tenant: default_tenant
```

### Account yang di-include

| Account legacy | Account target | Estimasi row |
|---|---|---:|
| `nutribake` | `nutribake` | 237 |
| `dapurbotani` | `dapurbotani` | 162 |
| `mealprepid` | `mealprepid` | 96 |
| `siasatsehat` | `siasatsehat` | 17 |
| `umum` | `umum` | 30 |
| **Total kandidat** |  | **542** |

Brand profile `umum` sudah dibuat di MAKNA Flow oleh pengguna.

### Account yang di-exclude

| Kategori | Estimasi row | Alasan |
|---|---:|---|
| `nutriblend` | 36 | Tidak masuk scope |
| `contohbrand` | 6 | Data contoh/dummy |
| Account berbentuk nama campaign | 14 | Tidak dapat dipetakan deterministik |
| **Total exclude** | **56** | Dicatat di manifest, tidak dihapus dari sumber |

Jumlah insert aktual belum ditetapkan sebelum dry-run collision terhadap 50 row target.

## 2. Prinsip Keselamatan

1. Database MAKNA Grid selalu dibuka SQLite `mode=ro`.
2. Tidak ada live `INSERT` dari Node 1 langsung ke PostgreSQL target.
3. Snapshot JSONL dan manifest SHA-256 menjadi sumber migrasi yang immutable.
4. Target dibackup sebelum schema migration dan sebelum merge data.
5. Row target yang sudah ada tidak pernah di-overwrite oleh legacy.
6. Import metadata berjalan dalam satu transaksi PostgreSQL.
7. Semua row import memiliki `tenant_id=default_tenant` dan `migration_batch_id` yang sama.
8. Rollback hanya menghapus row dari batch migrasi dan aset yang tercatat pada manifest batch.
9. Publish status, publish date, permalink, caption, dan timestamps dipertahankan.
10. Aset tidak dianggap berhasil hanya karena metadata berhasil masuk.

## 3. Keputusan Collision

Urutan identifikasi collision:

1. `id` sama;
2. `video_id` sama dalam tenant target;
3. tuple `(source_type, source_campaign_id, source_item_id)` sama;
4. canonical hash isi row sama.

Kebijakan:

- hash sama: `skip_identical`;
- ID/video ID sama tetapi isi berbeda: `target_wins`, row legacy tidak dimasukkan otomatis;
- row legacy tanpa collision: preserve `id` dan `video_id` asli;
- seluruh collision berbeda dimasukkan ke `conflicts.json` untuk review, bukan diam-diam di-rename;
- opsi rename `legacy_grid_<id>` hanya boleh dilakukan pada run lanjutan dengan allowlist collision yang disetujui pengguna.

## 4. Kebijakan Aset

Kondisi seluruh sumber sebelum filter account:

| Kondisi | Jumlah |
|---|---:|
| `url_asset` kosong | 399 |
| Path lokal `/temp/*.mp4` | 175 |
| URL Node 3/Nextcloud | 24 |
| File lokal tersedia | 134, sekitar 730 MB |
| File lokal hilang | 41 |

Dry-run menghitung ulang angka khusus 542 row yang di-include.

Kebijakan hasil:

- file lokal tersedia → copy checksum-aware ke `/uploads/content-flow/legacy/<batch>/<filename>`;
- file lokal hilang → `url_asset=NULL`, `asset_migration_status='missing_at_source'`;
- URL Node 3 valid → URL dipertahankan, status `remote_ok`;
- URL Node 3 gagal diverifikasi → URL disimpan di `legacy_url_asset`, `url_asset=NULL`, status `remote_unreachable`;
- tanpa aset → status `no_asset`;
- path asli selalu disimpan di `legacy_url_asset`.

## 5. Perubahan per File

### 5.1 `[MODIFY] lib/db-pg.js`

#### Code Sebelum (Current/Before)

```javascript
pool.query(`ALTER TABLE content_flow_items ADD COLUMN IF NOT EXISTS catatan TEXT;`)
```

#### Code Sesudah (Proposed/After)

```javascript
async function migrateContentFlowTenantIsolation() {
  await withAdvisoryMigrationLock('contentflow_tenant_v1', async client => {
    await client.query(`
      ALTER TABLE content_flow_items
        ADD COLUMN IF NOT EXISTS tenant_id TEXT,
        ADD COLUMN IF NOT EXISTS migration_source TEXT,
        ADD COLUMN IF NOT EXISTS migration_batch_id TEXT,
        ADD COLUMN IF NOT EXISTS legacy_id TEXT,
        ADD COLUMN IF NOT EXISTS legacy_url_asset TEXT,
        ADD COLUMN IF NOT EXISTS asset_migration_status TEXT
    `);
    await client.query(`
      UPDATE content_flow_items
      SET tenant_id = 'default_tenant'
      WHERE tenant_id IS NULL
    `);
    await client.query(`
      ALTER TABLE content_flow_items
      ALTER COLUMN tenant_id SET DEFAULT 'default_tenant',
      ALTER COLUMN tenant_id SET NOT NULL
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS content_flow_items_tenant_created_idx
      ON content_flow_items (tenant_id, created_at DESC)
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS content_flow_items_tenant_video_uq
      ON content_flow_items (tenant_id, video_id)
    `);
  });
}
```

Sebelum unique index dibuat, migration melakukan preflight duplicate dan berhenti bila ditemukan conflict.

### 5.2 `[MODIFY] scripts/local-staging/setup.js`

#### Code Sebelum (Current/Before)

```javascript
const tenantTables = [
  'users', 'brand_profiles', 'gemini_api_keys', 'content_planners',
  'strategic_campaigns', 'pillar_campaigns', 're_campaigns',
  'instant_campaigns', 'product_extractions', 'ideas', 'knowledge_bases'
];
await client.query(`ALTER TABLE content_flow_items ADD COLUMN IF NOT EXISTS catatan TEXT`);
```

#### Code Sesudah (Proposed/After)

```javascript
const tenantTables = [
  'users', 'brand_profiles', 'gemini_api_keys', 'content_planners',
  'strategic_campaigns', 'pillar_campaigns', 're_campaigns',
  'instant_campaigns', 'product_extractions', 'content_flow_items',
  'ideas', 'knowledge_bases'
];

await applyContentFlowTenantColumns(client);
```

Setup staging baru harus menghasilkan schema yang sama dengan migration runtime.

### 5.3 `[NEW] lib/contentflow-repository.js`

#### Code Sebelum (Current/Before)

```javascript
// Belum ada repository PostgreSQL tenant-scoped.
// Query ContentFlow tersebar di lib/db.js dan route handlers.
```

#### Code Sesudah (Proposed/After)

```javascript
export async function listContentFlowItems(filters = {}) {
  const tenantId = requireOperationalTenant();
  const params = [tenantId];
  const where = ['tenant_id = $1'];
  // Tambahkan filter dengan parameterized SQL.
  // available_accounts dan available_products memakai tenant predicate yang sama.
}

export async function getContentFlowItem(id) {
  return (await pgQuery(
    'SELECT * FROM content_flow_items WHERE id=$1 AND tenant_id=$2',
    [id, requireOperationalTenant()]
  )).rows[0] || null;
}

export async function updateContentFlowItem(id, changes) {
  // Allowlist field + WHERE id AND tenant_id + RETURNING.
}

export async function deleteContentFlowItem(id) {
  // WHERE id AND tenant_id + RETURNING.
}

export async function deleteContentFlowAccount(accountName) {
  // WHERE LOWER(account_name)=LOWER($1) AND tenant_id=$2.
}
```

Repository memakai PostgreSQL sebagai satu-satunya source of truth pada MAKNA Flow. Tidak ada dual-write diam-diam ke SQLite legacy.

### 5.4 `[MODIFY] lib/db.js`

#### Code Sebelum (Current/Before)

```javascript
export async function upsertContentFlowItem(item) {
  // INSERT via compatibility wrapper
  // lalu auto-sync kedua kali ke PostgreSQL
}

export async function getContentFlowItems(filters = {}) {
  let sql = `SELECT * FROM content_flow_items WHERE 1=1`;
}
```

#### Code Sesudah (Proposed/After)

```javascript
export async function upsertContentFlowItem(item) {
  const { upsertContentFlowItem: upsert } = await import('./contentflow-repository.js');
  return upsert(item);
}

export async function getContentFlowItems(filters = {}) {
  const { listContentFlowItems } = await import('./contentflow-repository.js');
  return listContentFlowItems(filters);
}
```

Wrapper legacy lain didelegasikan ke repository agar caller internal tetap kompatibel selama refactor.

### 5.5 `[MODIFY] app/api/content-flow/route.js`

#### Code Sebelum (Current/Before)

```javascript
let baseSql = 'FROM content_flow_items WHERE 1=1';
const itemsRes = await pgQuery(sql, params);
const accountsRes = await pgQuery('SELECT DISTINCT account_name FROM content_flow_items');
```

#### Code Sesudah (Proposed/After)

```javascript
const user = getCurrentUser(request);
if (!user || user.tenantId === '__none__') return unauthorized();

const result = await listContentFlowItems({
  sourceType, accountName, productName, pipelineStatus,
  tiktokStatus, facebookStatus, instagramStatus,
  q, page, limit, allowedAccounts: scopedAccounts(user)
});
return NextResponse.json({ success: true, ...result });
```

Fallback SQLite dihapus dari runtime MAKNA Flow agar error PostgreSQL tidak berubah menjadi pembacaan data global.

### 5.6 `[MODIFY] app/api/content-flow/[id]/route.js`

#### Code Sebelum (Current/Before)

```javascript
const sql = `UPDATE content_flow_items SET ... WHERE id = $n RETURNING *`;
await pgQuery('DELETE FROM content_flow_items WHERE id = $1', [id]);
await updateContentFlowPublishStatus(id, body); // dual write
```

#### Code Sesudah (Proposed/After)

```javascript
const user = requireContentFlowUser(request);
const item = await updateContentFlowItem(id, allowedChanges(body, user));
if (!item) return notFound();

// DELETE admin tenant:
const deleted = await deleteContentFlowItem(id);
if (!deleted) return notFound();
```

Semua operasi menggunakan `id + tenant_id`; 404 tidak membocorkan ID tenant lain.

### 5.7 `[MODIFY] app/api/content-flow/brands/route.js`

#### Code Sebelum (Current/Before)

```javascript
await pgQuery('DELETE FROM content_flow_items WHERE account_name = $1', [accountName]);
await deleteContentFlowBrandItems(accountName);
```

#### Code Sesudah (Proposed/After)

```javascript
const user = requireTenantAdmin(request);
const deletedCount = await deleteContentFlowAccount(accountName);
return NextResponse.json({ success: true, deleted_count: deletedCount });
```

Delete account harus tenant-scoped dan tidak dual-write.

### 5.8 `[NEW] scripts/export-legacy-contentflow.mjs`

#### Code Sebelum (Current/Before)

```javascript
// Belum ada exporter read-only dan reproducible.
```

#### Code Sesudah (Proposed/After)

```javascript
const INCLUDE_ACCOUNTS = new Set([
  'nutribake', 'dapurbotani', 'mealprepid', 'siasatsehat', 'umum'
]);

// 1. Buka SQLite dengan mode=ro.
// 2. Normalize account_name ke lowercase.
// 3. Pisahkan included.jsonl dan excluded.jsonl.
// 4. Inventarisasi aset tanpa mengubah sumber.
// 5. Tulis manifest counts + SHA-256.
// 6. Fail jika jumlah included + excluded != total sumber.
```

Exporter dijalankan di Node 1 dari snapshot database yang konsisten, bukan database file yang sedang berubah tanpa backup.

### 5.9 `[NEW] scripts/import-legacy-contentflow.mjs`

#### Code Sebelum (Current/Before)

```javascript
// Belum ada importer dry-run/commit/rollback.
```

#### Code Sesudah (Proposed/After)

```javascript
// Mode wajib:
// --mode dry-run  : validasi manifest, brand, collision, aset; tanpa write.
// --mode commit   : membutuhkan dry-run report hash yang sama.
// --mode rollback : membutuhkan migration_batch_id dan confirmation token.

// commit:
// BEGIN
// CREATE TEMP TABLE legacy_contentflow_stage (...)
// COPY/insert JSONL ke staging
// validasi count, tenant, required fields, collision
// INSERT hanya rows berstatus ready
// COMMIT
```

Commit dihentikan bila brand `umum` atau brand include lain tidak ditemukan pada `brand_profiles` tenant target.

### 5.10 `[NEW] scripts/migrate-legacy-contentflow-assets.mjs`

#### Code Sebelum (Current/Before)

```javascript
// Belum ada transfer aset checksum-aware dan resumable.
```

#### Code Sesudah (Proposed/After)

```javascript
// Membaca asset-manifest.json, bukan scan bebas.
// Copy hanya file allowlisted dengan ekstensi video yang didukung.
// Verifikasi size + SHA-256 sumber/target.
// Tidak overwrite file target yang sudah ada dan berbeda.
// Menghasilkan asset-results.json untuk importer metadata.
```

Transfer dilakukan dalam satu job resumable; bukan loop SSH polling.

### 5.11 `[NEW] scripts/test-contentflow-legacy-migration.mjs`

#### Code Sebelum (Current/Before)

```javascript
// Belum ada regression test migrasi ContentFlow legacy.
```

#### Code Sesudah (Proposed/After)

```javascript
// Test fixture:
// - account include/exclude;
// - normalize Umum -> umum;
// - identical collision skip;
// - divergent collision target_wins;
// - rollback batch;
// - publish status/permalink preserved;
// - tenant A tidak terlihat tenant B;
// - missing/local/remote/no_asset classification;
// - manifest checksum mismatch ditolak.
```

### 5.12 `[MODIFY] package.json`

#### Code Sebelum (Current/Before)

```json
{
  "scripts": {
    "test:product-import": "node scripts/test-product-import.mjs"
  }
}
```

#### Code Sesudah (Proposed/After)

```json
{
  "scripts": {
    "test:product-import": "node scripts/test-product-import.mjs",
    "test:contentflow-migration": "node scripts/test-contentflow-legacy-migration.mjs",
    "contentflow:migration:export": "node scripts/export-legacy-contentflow.mjs",
    "contentflow:migration:import": "node scripts/import-legacy-contentflow.mjs",
    "contentflow:migration:assets": "node scripts/migrate-legacy-contentflow-assets.mjs"
  }
}
```

## 6. Urutan Eksekusi

### Phase A — Target hardening

1. Backup PostgreSQL target.
2. Tambah tenant/migration columns dan index.
3. Buat repository ContentFlow tenant-scoped.
4. Migrasikan GET/PATCH/DELETE/account delete dan internal upsert.
5. Jalankan regression test dan build.
6. Release patch dan deploy Node 2.
7. Smoke test UI ContentFlow sebelum data legacy dimasukkan.

### Phase B — Export dan dry-run

1. Buat snapshot SQLite Node 1 secara konsisten.
2. Export 542 kandidat dan 56 exclude ke artifact immutable.
3. Inventarisasi aset kandidat saja.
4. Transfer artifact manifest ke Node 2.
5. Jalankan importer `--mode dry-run`.
6. Review count: ready, identical, divergent conflict, excluded, missing asset.
7. Minta persetujuan pengguna bila ada divergent conflict.

### Phase C — Asset transfer dan commit

1. Transfer aset allowlisted serta verifikasi SHA-256.
2. Backup PostgreSQL target tepat sebelum commit.
3. Jalankan import dengan hash dry-run yang disetujui.
4. Verifikasi count dan distribusi.
5. Smoke test UI dan pemutaran sampel aset.
6. Simpan manifest, report, dan rollback token.

## 7. Verification Plan

### Automated

```bash
npm run test:contentflow-migration
npm run test:tenant-api-smoke
npm run staging:check
npm run build
```

### Dry-run invariants

```text
source_total = included + excluded = 598
included_expected_before_collision = 542
excluded_expected = 56
ready + skip_identical + conflict_divergent = 542
```

### Target invariants

- seluruh row baru memiliki `tenant_id=default_tenant`;
- tidak ada duplicate `(tenant_id, video_id)`;
- row existing target tidak berubah hash;
- status/permalink sosial sama dengan snapshot;
- account target hanya lima account include;
- jumlah file copied sama dengan `asset-results.json`;
- tidak ada `url_asset=/temp/...` setelah commit;
- rollback preview count sama dengan jumlah row batch.

### Manual UI

- filter account: nutribake, dapurbotani, mealprepid, siasatsehat, umum;
- filter source: OPC, RE, Strategic;
- filter Completed/In Production;
- pencarian video ID dan campaign;
- update catatan/status publish satu item;
- play/download sampel aset lokal dan URL Nextcloud;
- login tenant lain dan pastikan data tidak terlihat.

## 8. Rollback

```sql
BEGIN;
DELETE FROM content_flow_items
WHERE tenant_id = 'default_tenant'
  AND migration_batch_id = $1
  AND migration_source = 'makna_grid_node1';
COMMIT;
```

Setelah database rollback, hapus hanya aset yang tercantum pada manifest batch dan masih memiliki checksum yang sama. File target yang sudah ada sebelum migrasi tidak boleh dihapus.

## Execution Task List

- [x] Ambil backup PostgreSQL target dan catat checksum/restore command.
- [x] Tambahkan schema tenant dan metadata migrasi ContentFlow.
- [x] Tambahkan preflight duplicate sebelum unique index.
- [x] Buat `lib/contentflow-repository.js` tenant-scoped.
- [x] Delegasikan wrapper ContentFlow legacy di `lib/db.js` ke repository.
- [x] Migrasikan GET `/api/content-flow` dan hapus fallback SQLite runtime.
- [x] Migrasikan PATCH/DELETE `/api/content-flow/[id]` ke tenant-scoped repository.
- [x] Migrasikan DELETE `/api/content-flow/brands` ke tenant-scoped repository.
- [x] Tambahkan regression test tenant, collision, manifest, dan rollback.
- [x] Jalankan seluruh automated verification Phase A.
- [ ] Rilis patch dan sinkronkan branch `main` serta tag.
- [ ] Deploy hardening ke Node 2 dengan single-pass deployment.
- [ ] Smoke test ContentFlow target sebelum migrasi data.
- [ ] Buat snapshot read-only SQLite MAKNA Grid Node 1.
- [ ] Export JSONL: 542 kandidat include dan 56 row exclude.
- [ ] Buat manifest metadata/aset beserta SHA-256.
- [ ] Verifikasi brand profile target termasuk `umum`.
- [ ] Jalankan dry-run collision terhadap 50 row target existing.
- [ ] Review dan setujui report collision sebelum commit.
- [ ] Transfer serta verifikasi aset kandidat secara resumable.
- [ ] Ambil backup target final sebelum data commit.
- [ ] Commit metadata import menggunakan approved dry-run hash.
- [ ] Verifikasi count, tenant, status, permalink, dan asset status.
- [ ] Jalankan smoke test UI filter/search/edit dan pemutaran aset.
- [ ] Simpan manifest final, report, backup reference, dan rollback token.
