# Implementation Plan — Brand–Product Affiliate Routing hingga Content Flow

## 1. Tujuan

Membangun sistem affiliate MAKNA Flow yang memastikan produk yang sama dapat dipasarkan oleh beberapa Brand Profile dengan affiliate link berbeda, tanpa menduplikasi Product Database dan tanpa mengubah pipeline foto Raw/Clean yang baru selesai.

Hasil akhir:

1. Produk tetap canonical dan dimiliki tenant.
2. Affiliate link aktif disimpan pada relasi Brand Profile–Product.
3. Semua workflow campaign menggunakan satu resolver affiliate terpusat.
4. Kombinasi brand, produk, dan affiliate link disimpan sebagai snapshot campaign/item.
5. Content Flow menerima snapshot yang benar dan tidak mencari link secara ambigu.
6. `product_extractions.affiliate_link` tetap tersedia sementara sebagai legacy fallback.
7. Prompt Studio (`t2i_prompt`) dan Prompt Aksi Video (`i2v_action_prompt`) tidak lagi menjadi bagian input/enrichment Product Database baru.

## 2. Keputusan Arsitektur

### 2.1 Product tetap tenant-owned

Jangan menambahkan `brand_profile_id` langsung ke `product_extractions`. Satu produk dapat digunakan banyak Brand Profile.

Data canonical produk tetap meliputi:

- nama dan deskripsi;
- URL produk asli;
- foto Raw dan Clean;
- kemasan;
- USP;
- Product Truth;
- Geometric Truth;
- status enrichment dan foto.

### 2.2 Brand–Product adalah konfigurasi affiliate aktif

Gunakan tabel junction `brand_products` untuk:

- Brand Profile;
- product;
- affiliate link;
- tracking code;
- override CTA/landing page bila diperlukan;
- status aktif.

### 2.3 Campaign binding adalah snapshot immutable

Gunakan tabel `campaign_product_bindings` agar seluruh tipe campaign memakai kontrak snapshot yang sama tanpa menambah kolom affiliate yang berbeda-beda pada setiap tabel campaign.

### 2.4 Content Flow tidak melakukan re-resolution

Content Flow membaca `affiliate_link_snapshot` dari binding. Lookup lama ke product/planner hanya boleh menjadi fallback selama migrasi dan harus dicatat sebagai legacy telemetry.

### 2.5 Prompt Studio dan Prompt Aksi Video dihentikan

- Hapus kedua field dari form Add/Edit Product dan detail Product Database.
- Gemini enrichment tidak menghasilkan kedua field.
- Create/update/import baru tidak menulis kedua field.
- Jangan drop kolom database pada fase ini karena campaign/data lama mungkin masih menyimpannya.
- Jangan mengosongkan nilai legacy secara massal.
- Consumer lama boleh membaca nilai historis sampai dimigrasikan pada pekerjaan terpisah, tetapi Product Database baru tidak mengelolanya.

## 3. Ruang Lingkup

### Termasuk

- Schema dan repository `brand_products`.
- Schema dan repository `campaign_product_bindings`.
- Resolver affiliate terpusat.
- API association/resolve.
- Product Database association manager.
- Import CSV/XLSX dengan Brand Profile tujuan.
- Shared Brand–Product selector untuk form campaign.
- Integrasi Content Planner, Strategic, OPC/Pillar, RE, Instant, Bridge, Multiplier, Sheets Autopilot, dan Recipe Labs.
- Snapshot affiliate ke Content Flow.
- Migration/reconciliation link legacy.
- Penghentian Prompt Studio dan Prompt Aksi Video pada Product Database baru.
- Tenant isolation, brand access control, audit, tests, build, dan release.

### Tidak termasuk

- Scraping product.
- Perubahan pipeline foto Raw/Clean, Gemini image, atau G-Labs product clean-photo generation.
- Penghapusan fisik kolom `t2i_prompt`, `i2v_action_prompt`, `affiliate_link`, `generated_photo_url`, atau field legacy lain.
- Integrasi click/conversion API marketplace.
- Deployment production tanpa perintah manual eksplisit pengguna.

## 4. Skema Database

### 4.1 `brand_products`

```sql
CREATE TABLE IF NOT EXISTS brand_products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  brand_profile_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  affiliate_link TEXT,
  tracking_code TEXT,
  landing_page_url TEXT,
  product_name_override TEXT,
  cta_override TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, brand_profile_id, product_id)
);

CREATE INDEX IF NOT EXISTS brand_products_brand_idx
  ON brand_products (tenant_id, brand_profile_id, is_active);

CREATE INDEX IF NOT EXISTS brand_products_product_idx
  ON brand_products (tenant_id, product_id);
```

Repository wajib memvalidasi secara transaksional bahwa `brand_profiles.tenant_id` dan `product_extractions.tenant_id` sama dengan tenant aktif.

### 4.2 `campaign_product_bindings`

```sql
CREATE TABLE IF NOT EXISTS campaign_product_bindings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_campaign_id TEXT NOT NULL,
  source_item_id TEXT,
  brand_profile_id TEXT,
  brand_product_id TEXT,
  product_id TEXT NOT NULL,
  product_name_snapshot TEXT,
  product_url_snapshot TEXT,
  affiliate_link_snapshot TEXT,
  tracking_code_snapshot TEXT,
  affiliate_source TEXT NOT NULL,
  affiliate_status TEXT NOT NULL,
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS campaign_product_bindings_source_uq
  ON campaign_product_bindings (
    tenant_id,
    source_type,
    source_campaign_id,
    COALESCE(source_item_id, '')
  );

CREATE INDEX IF NOT EXISTS campaign_product_bindings_product_idx
  ON campaign_product_bindings (tenant_id, product_id, brand_profile_id);
```

`source_type` yang didukung:

```text
content_planner
strategic
opc
re
instant
bridge
multiplier
sheets_autopilot
recipe
```

### 4.3 Content Flow lineage

Tambahkan pada `content_flow_items`:

```sql
ALTER TABLE content_flow_items
  ADD COLUMN IF NOT EXISTS brand_profile_id TEXT,
  ADD COLUMN IF NOT EXISTS brand_product_id TEXT,
  ADD COLUMN IF NOT EXISTS product_id TEXT,
  ADD COLUMN IF NOT EXISTS affiliate_source TEXT,
  ADD COLUMN IF NOT EXISTS affiliate_status TEXT,
  ADD COLUMN IF NOT EXISTS affiliate_resolved_at TIMESTAMPTZ;
```

`link_affiliate` tetap menjadi snapshot final yang dipakai Content Flow/publishing.

## 5. Kontrak Resolver Affiliate

```js
resolveAffiliateLink({
  tenantId,
  brandProfileId,
  productId,
  explicitOverride = null,
  allowLegacyFallback = true
})
```

Return:

```js
{
  brandProductId,
  brandProfileId,
  productId,
  productName,
  productUrl,
  affiliateLink,
  trackingCode,
  source,
  status,
  resolvedAt
}
```

Precedence:

1. `explicitOverride` valid → `source=campaign_override`, `status=overridden`.
2. `brand_products.affiliate_link` aktif → `source=brand_product`, `status=resolved`.
3. `product_extractions.affiliate_link` saat legacy fallback aktif → `source=legacy_product`, `status=legacy`.
4. Tidak tersedia → `source=missing`, `status=missing`.

Larangan:

- Jangan mengambil link Brand Profile lain.
- Jangan mengambil Content Planner pertama untuk produk sama.
- Jangan resolve menggunakan `account_name` bila `brand_profile_id` tersedia.
- Jangan query product atau brand tanpa tenant filter.
- Jangan menjalankan campaign affiliate bila status `missing`, kecuali pengguna memilih mode non-affiliate.

## 6. Kontrak Campaign Binding

```js
createOrUpdateCampaignProductBinding({
  tenantId,
  sourceType,
  sourceCampaignId,
  sourceItemId = null,
  brandProfileId,
  productId,
  explicitAffiliateOverride = null,
  affiliateRequired = true
})
```

Binding dibuat saat kombinasi Brand Profile dan Product sudah final:

- single campaign: binding pada campaign;
- mass campaign: binding pada setiap item/row;
- binding menyimpan snapshot saat itu;
- update konfigurasi `brand_products` tidak mengubah binding lama;
- re-resolve hanya dilakukan lewat tindakan eksplisit pengguna.

## 7. Perubahan UX Product Database

### Single Product

Form utama tetap menangani data produk dan Raw/Clean. Ubah field affiliate global menjadi:

```text
Default Affiliate Link (Legacy/Fallback)
```

Letakkan pada bagian Advanced/Legacy dengan penjelasan bahwa link khusus Brand Profile lebih diprioritaskan.

Tambahkan panel:

```text
Affiliate Links per Brand Profile

Brand A   https://...A   Active
Brand B   https://...B   Active

[Tambah Brand Profile]
```

Quick-edit affiliate pada kartu produk harus meminta/memakai Brand Profile; jangan lagi diam-diam mengubah link global.

### CSV/XLSX Import

Tambahkan pilihan:

```text
Brand Profile Tujuan
[Brand A]

Perlakuan Link Aff
○ Simpan sebagai link Brand–Product
○ Simpan sebagai legacy default
```

Default adalah `brand_product`. Produk tetap dideduplikasi per tenant; setelah produk dibuat/ditemukan, `Link Aff` di-upsert ke `brand_products`.

Jika Brand Profile tidak dipilih tetapi mode `brand_product`, tolak sebelum import dengan error yang jelas.

## 8. Shared Campaign UI

Buat komponen `BrandProductSelector`:

```js
<BrandProductSelector
  brandProfileId={brandProfileId}
  productId={productId}
  affiliateMode="required"
  allowOverride={canEditAffiliate}
  onResolved={setResolvedBinding}
/>
```

Mode:

```text
required  = link wajib sebelum run/approve
optional  = link boleh kosong
disabled  = editorial/non-product campaign
```

Komponen menampilkan:

- Brand Profile;
- Product;
- foto Clean;
- affiliate link hasil resolve;
- source/status;
- explicit override bila user berizin;
- tombol tambah association jika missing.

## 9. Integrasi Workflow

### Content Planner

- `brand_id` + `product_id` menjadi input resolver.
- `content_planners.affiliate_url` dipertahankan sebagai snapshot compatibility.
- Buat binding `source_type=content_planner`.
- Hapus kebutuhan mengetik affiliate link manual secara default.

### Strategic Campaign

- Normalisasikan `brand_profile_id` dari planner/campaign.
- Gunakan `product_id` dan Brand Profile untuk binding.
- Jika product berbeda per item, buat binding per strategic item.

### OPC/Pillar

- Sudah memiliki `brand_profile_id` dan `target_product_id`.
- Single product campaign membuat binding pada campaign.
- Mass production membuat binding pada `pillar_campaign_items`.

### RE Campaign

- Sudah memiliki `brand_profile_id` dan `target_product_id`.
- Buat binding saat create/approve.
- Item-specific override membuat binding per item.

### Instant Factory

- Workflow baru memakai `brand_profile_id` + product ID.
- Pipeline legacy tanpa brand tetap memakai fallback atau link kosong.

### Bridge Injector

- Single: binding pada campaign.
- Bulk: binding per `bridge_injector_item`.
- `product_url` tidak lagi menjadi satu-satunya identitas produk jika `target_product_id` tersedia.

### Multiplier

- Tambahkan `brand_profile_id`, `product_id`, dan `brand_product_id` ke task/payload.
- `affiliate_url` tetap snapshot compatibility.
- Mass CSV melakukan resolve per row.

### Sheets Autopilot

- `brand_profile_id` menjadi konteks utama.
- `Link Aff` row adalah override snapshot bila diisi.
- Bila kosong, resolve `brand_products`.
- Beri opsi menyimpan override row sebagai association baru.

### Recipe Labs

- Bila campaign memakai produk, gunakan shared selector dan binding.
- Editorial/non-product recipe tidak wajib link.

## 10. Content Flow Canonical Ingest

Setiap adapter campaign menghasilkan payload canonical:

```js
{
  tenantId,
  sourceType,
  sourceCampaignId,
  sourceItemId,
  brandProfileId,
  brandProductId,
  productId,
  productName,
  productUrl,
  affiliateLinkSnapshot,
  affiliateSource,
  affiliateStatus,
  affiliateResolvedAt
}
```

Content Flow menulis:

```js
{
  brand_profile_id: binding.brandProfileId,
  brand_product_id: binding.brandProductId,
  product_id: binding.productId,
  link_affiliate: binding.affiliateLinkSnapshot || '',
  affiliate_source: binding.affiliateSource,
  affiliate_status: binding.affiliateStatus,
  affiliate_resolved_at: binding.affiliateResolvedAt
}
```

Selama migrasi:

- jika binding tidak ada, resolver legacy boleh digunakan;
- log `[Affiliate Legacy Fallback]` dengan tenant/source/campaign/item/product/brand;
- jangan menggunakan subquery Content Planner tanpa Brand Profile;
- setelah coverage binding tercapai, fallback dimatikan untuk campaign baru.

Manual edit Content Flow:

```text
affiliate_source = content_flow_override
affiliate_status = overridden
```

Manual edit tidak mengubah `brand_products` kecuali pengguna secara eksplisit memilih “Simpan juga sebagai link Brand–Product”.

## 11. Perubahan Per File — Before & After

> Agent pelaksana wajib menyesuaikan snippet dengan kode aktual dan menjaga perubahan pengguna yang tidak terkait.

### 11.1 `lib/db-pg.js`, `lib/db.sqlite-backup.js`, `scripts/local-staging/setup.js`

**Code Sebelum (Current/Before)**

```js
// Hanya product photo pipeline migration; belum ada brand_products/bindings.
ALTER TABLE product_extractions ADD COLUMN IF NOT EXISTS packaging_status TEXT;
```

**Code Sesudah (Proposed/After)**

```js
await client.query(`CREATE TABLE IF NOT EXISTS brand_products (...)`);
await client.query(`CREATE TABLE IF NOT EXISTS campaign_product_bindings (...)`);
await client.query(`ALTER TABLE content_flow_items ADD COLUMN IF NOT EXISTS brand_profile_id TEXT, ...`);
```

Gunakan advisory lock runtime migration, idempotent DDL, index, dan schema parity pada local staging/SQLite compatibility.

### 11.2 `lib/brand-product-repository.js` — baru

**Before**

```text
Belum ada association repository.
```

**After**

```js
export async function listBrandProducts({ brandProfileId, includeUnlinked, search }) {}
export async function getBrandProduct({ brandProfileId, productId }) {}
export async function upsertBrandProduct(input) {}
export async function deactivateBrandProduct(input) {}
export async function listProductBrands({ productId }) {}
```

Semua method mengambil tenant dari context dan memvalidasi akses Brand Profile.

### 11.3 `lib/affiliate-resolver.js` — baru

**Before**

```text
Affiliate precedence tersebar pada form, worker, dan contentflow-ingest.
```

**After**

```js
export async function resolveAffiliateLink(input) {
  if (validOverride(input.explicitOverride)) return fromOverride(input);
  const association = await getBrandProduct(input);
  if (association?.affiliate_link) return fromAssociation(association);
  if (input.allowLegacyFallback) return fromLegacyProduct(input);
  return missingResolution(input);
}
```

Tambahkan URL validation dan jangan log nilai secret/query tracking secara berlebihan.

### 11.4 `lib/campaign-product-binding.js` — baru

**Before**

```text
Tidak ada snapshot lintas jenis campaign.
```

**After**

```js
export async function createOrUpdateCampaignProductBinding(input) {}
export async function getCampaignProductBinding(input) {}
export async function reResolveCampaignProductBinding(input) {}
```

`reResolve` hanya untuk tindakan eksplisit dan tidak mengubah Content Flow published.

### 11.5 API brand/product/resolve — baru

**Before**

```text
Belum ada API association.
```

**After**

```text
GET  /api/v2/brand-profiles/:id/products
PUT  /api/v2/brand-profiles/:id/products/:productId
DELETE /api/v2/brand-profiles/:id/products/:productId
GET  /api/v2/products/:id/brands
POST /api/v2/affiliate-links/resolve
```

Seluruh route memakai `withTenantContext`, authorization brand assignment, validation, dan repository; tidak memakai SQL tanpa tenant filter.

### 11.6 `app/products/page.js`

**Code Sebelum (Current/Before)**

```js
affiliate_link: '',
t2i_prompt: '',
i2v_action_prompt: '',
```

Quick-edit:

```js
body: JSON.stringify({ affiliate_link: affiliateLink.trim() })
```

**Code Sesudah (Proposed/After)**

```js
// Affiliate global hanya tampil di Advanced/Legacy.
// Panel association mengambil /api/v2/products/:id/brands.
// Quick edit menyertakan brand_profile_id dan memanggil association API.
```

Hapus Prompt Studio dan Prompt Aksi Video dari state, form, reset, edit mapping, validation, dan display Product Database baru. Jangan hapus nilai legacy database.

### 11.7 `app/api/v2/products/route.js` dan `[id]/route.js`

**Code Sebelum (Current/Before)**

```js
t2i_prompt: body.t2i_prompt || null,
i2v_action_prompt: body.i2v_action_prompt || null,
affiliate_link: body.affiliate_link || ''
```

**Code Sesudah (Proposed/After)**

```js
// Multipart create/update baru tidak menerima t2i_prompt atau i2v_action_prompt.
// affiliate_link hanya diterima pada explicit legacy JSON compatibility path.
// Association per brand menggunakan brand_products API.
```

Hapus prompt fields dari allowlist UI multipart. Pertahankan JSON legacy compatibility bila integrasi lama masih bergantung padanya.

### 11.8 `lib/product-bulk-worker.js`

**Code Sebelum (Current/Before)**

```sql
t2i_prompt = NULL,
i2v_action_prompt = NULL
```

**Code Sesudah (Proposed/After)**

```sql
-- Jangan menyentuh field legacy tersebut.
UPDATE product_extractions
SET unique_selling_point = $1,
    product_truth = $2,
    geometric_truth = $3,
    clean_photo_t2i_prompt = $4,
    ...
```

Prompt enrichment hanya menghasilkan USP, Product Truth, Geometric Truth, category, dan clean-photo prompt. Tidak menghasilkan Studio/I2V prompt.

### 11.9 `app/api/v2/products/import-csv/route.js`

**Code Sebelum (Current/Before)**

```js
if (affiliate_link) updates.affiliate_link = affiliate_link;
```

**Code Sesudah (Proposed/After)**

```js
const affiliateMode = formData.get('affiliate_mode') || 'brand_product';
const brandProfileId = formData.get('brand_profile_id');

const product = await importOrUpdateCanonicalProduct(row);
if (affiliateMode === 'brand_product' && row.affiliate_link) {
  await upsertBrandProduct({ brandProfileId, productId: product.id, affiliateLink: row.affiliate_link });
}
```

Keputusan deduplikasi produk tetap berada dalam transaction. Upsert association dilakukan aman setelah product ID diketahui. Jika desain transaksi memungkinkan, keduanya dapat berada pada transaksi PostgreSQL yang sama; network/AI tetap di luar transaksi.

### 11.10 `app/components/BrandProductSelector.js` — baru

**Before**

```text
Setiap form memakai selector brand/product/affiliate sendiri.
```

**After**

```js
export default function BrandProductSelector({
  brandProfileId,
  productId,
  affiliateMode,
  allowOverride,
  onResolved
}) {}
```

Komponen tidak menyimpan campaign. Ia hanya memilih dan menampilkan hasil resolver.

### 11.11 Form/API campaign

File utama:

```text
app/content-planner/page.js
lib/content-planner-engine.js
app/re-campaigns/page.js
app/api/v2/re-campaigns/route.js
app/pillar-campaigns/page.js
app/api/v2/pillar-campaigns/route.js
app/api/v2/instant-factory/route.js
app/api/v2/bridge-injector/route.js
app/api/v2/multiplier/route.js
app/api/sheets-autopilot/route.js
app/api/recipe-labs/route.js
```

**Code Sebelum (Current/Before)**

```js
affiliate_url: formData.get('affiliate_url') || ''
// atau campaign hanya menyimpan brand_profile_id + target_product_id
```

**Code Sesudah (Proposed/After)**

```js
const binding = await createOrUpdateCampaignProductBinding({
  sourceType,
  sourceCampaignId: campaign.id,
  sourceItemId: item?.id || null,
  brandProfileId,
  productId,
  explicitAffiliateOverride,
  affiliateRequired
});
```

API tetap mengisi field affiliate legacy yang diperlukan worker lama dengan `binding.affiliateLinkSnapshot`, bukan input acak/global product.

### 11.12 `lib/contentflow-ingest.js`

**Code Sebelum (Current/Before)**

```js
const linkAffiliate = payload.affiliate_url
  || payload.affiliate_link
  || item.pe_affiliate_link
  || peFallback?.affiliate_link
  || item.cp_affiliate_url
  || '';
```

**Code Sesudah (Proposed/After)**

```js
const binding = await getCampaignProductBinding({
  sourceType,
  sourceCampaignId: item.campaign_id,
  sourceItemId: item.id
});

const affiliate = binding || await resolveLegacyIngestAffiliate(context);
```

Hapus subquery “Content Planner pertama” dan lookup product berdasarkan URL tanpa brand context. Adapter menulis lineage fields ke Content Flow.

### 11.13 `app/content-flow/page.js` dan `app/api/content-flow/[id]/route.js`

**Code Sebelum (Current/Before)**

```js
link_affiliate: item.link_affiliate || ''
```

**Code Sesudah (Proposed/After)**

```text
Tampilkan Brand Profile, Product, Affiliate Source, dan Status.
Manual edit mengubah snapshot Content Flow menjadi source=content_flow_override.
```

Tambahkan opsi terpisah “Simpan juga ke Brand–Product” hanya untuk user berizin.

### 11.14 Tests

**Before**

```text
Belum ada test Brand A/Brand B dengan produk sama.
```

**After**

Tambahkan:

```text
scripts/test-brand-product-affiliate.mjs
scripts/test-campaign-product-binding.mjs
scripts/test-contentflow-affiliate-routing.mjs
```

Gunakan tenant dan brand fixture terisolasi; jangan memanggil provider AI berbayar.

## 12. Migrasi Legacy

### Tahap compatibility

- Pertahankan `product_extractions.affiliate_link`.
- Resolver boleh fallback dan memberi status `legacy`.
- Campaign baru selalu mencoba association lebih dahulu.

### Reconciliation UI/report

Tampilkan produk yang memiliki link global tetapi belum memiliki association:

```text
Product | Legacy Link | Brand Tujuan | Status | Action
```

Tindakan:

- Hubungkan ke satu Brand Profile;
- salin ke beberapa Brand Profile;
- abaikan;
- tandai bukan affiliate product.

### Enforcement

- Campaign affiliate baru wajib association atau explicit override.
- Legacy fallback hanya untuk histori lama.
- Quick-edit global disembunyikan.
- Jangan drop kolom legacy pada rilis ini.

## 13. Security dan Authorization

- Semua association/binding wajib tenant-scoped.
- Pengguna hanya melihat Brand Profile yang tercantum di `user_brands`, kecuali admin tenant.
- Validate URL scheme `http/https`.
- Jangan mengizinkan `javascript:`, `data:`, atau scheme lain.
- Jangan mengekspos affiliate links brand lain melalui product-list API umum.
- Campaign create harus memverifikasi akses user ke Brand Profile dan Product.
- Re-resolution dan bulk update membutuhkan permission affiliate edit.
- Catat audit untuk perubahan association, override campaign, dan override Content Flow.

## 14. Acceptance Criteria

### Product Database

- Produk yang sama tetap satu record tenant.
- Brand A dan Brand B mempunyai link berbeda untuk produk sama.
- Raw/Clean photo dan enrichment tidak diduplikasi.
- Prompt Studio dan Prompt Aksi Video tidak tampil atau dihasilkan oleh Product Database baru.
- Nilai prompt legacy tidak dihapus destruktif.

### CSV

- Import dengan Brand A menyimpan Link A ke association Brand A.
- Import produk sama dengan Brand B tidak menduplikasi produk dan menyimpan Link B.
- Mode legacy harus dipilih eksplisit.

### Campaign

- Semua form produk menampilkan hasil resolver affiliate.
- Brand A menghasilkan Link A; Brand B menghasilkan Link B.
- Mass campaign menyimpan binding per item.
- Campaign affiliate tidak dapat run/approve jika link missing.
- Campaign non-affiliate tetap dapat berjalan.

### Content Flow

- `link_affiliate` berasal dari binding snapshot.
- Content Flow tidak mengambil planner pertama atau global product link secara default.
- Perubahan association tidak mengubah Content Flow lama.
- Manual override hanya mengubah item tersebut kecuali user memilih update association.
- Lineage brand/product/source/status tersimpan.

### Isolation dan regression

- Tidak ada akses lintas tenant atau Brand Profile assignment.
- Product photo pipeline, enrichment, regenerate, export, dan scraper tidak rusak.
- Build Next.js berhasil.
- Seluruh test lama dan baru lulus.

## 15. Strategi Test

1. Unit: URL validation, resolver precedence, missing/legacy/override states.
2. Repository: tenant isolation, same product across two brands, deactivate association.
3. Binding: single campaign, item binding, immutable snapshot, explicit re-resolve.
4. API: unauthorized brand, wrong-tenant product, association CRUD, resolve preview.
5. CSV: Brand A/Brand B same product; partial row errors; legacy mode.
6. Campaign integration: Content Planner, OPC, RE, Bridge, Multiplier, Sheets.
7. Content Flow: binding snapshot, legacy fallback telemetry, manual override.
8. UI smoke: association manager, selector, missing-link guard, lineage display.
9. Regression: Product Database pipeline tests, Content Flow tests, build.

## 16. Rollout

1. Deploy additive schema/repositories/resolver with fallback aktif.
2. Tambahkan Product Database association manager dan reconciliation.
3. Migrasikan Content Planner, OPC, RE, dan Bridge terlebih dahulu.
4. Migrasikan Strategic, Instant, Multiplier, Sheets, dan Recipe.
5. Ubah Content Flow menjadi binding-first dengan fallback telemetry.
6. Audit persentase campaign baru yang sudah mempunyai binding.
7. Aktifkan enforcement untuk campaign baru setelah coverage memadai.
8. Jangan deploy production tanpa instruksi manual eksplisit.

Rollback code aman karena schema additive. Jangan menghapus association/binding atau snapshot Content Flow saat rollback.

## 17. Execution Task List

> Agent pelaksana WAJIB memperbarui checkbox ini secara real-time: ubah `- [ ]` menjadi `- [x]` segera setelah tahap benar-benar selesai.

- [ ] Audit working tree, baca `AGENTS.md`, dan baca dokumentasi Next.js lokal yang relevan.
- [ ] Catat baseline test Product Database dan Content Flow sebelum perubahan.
- [ ] Tambahkan schema/migrasi `brand_products`, `campaign_product_bindings`, dan Content Flow lineage.
- [ ] Tambahkan repository Brand–Product dengan tenant/brand authorization tests.
- [ ] Tambahkan affiliate resolver dan seluruh precedence/status tests.
- [ ] Tambahkan campaign binding repository dan immutable snapshot tests.
- [ ] Tambahkan API association, product-brands, dan resolve preview.
- [ ] Hapus Prompt Studio dan Prompt Aksi Video dari UI/kontrak Product Database baru tanpa menghapus data legacy.
- [ ] Ubah enrichment worker agar tidak menyentuh atau menghasilkan `t2i_prompt`/`i2v_action_prompt`.
- [ ] Tambahkan association manager pada Product Database dan pindahkan quick-edit ke konteks Brand Profile.
- [ ] Perbarui CSV import dengan Brand Profile tujuan dan affiliate mode.
- [ ] Buat shared `BrandProductSelector` beserta missing-link guard.
- [ ] Integrasikan Content Planner dan simpan binding/snapshot compatibility.
- [ ] Integrasikan OPC/Pillar single dan mass item bindings.
- [ ] Integrasikan RE Campaign single/item bindings.
- [ ] Integrasikan Strategic Campaign bindings.
- [ ] Integrasikan Instant Factory bindings.
- [ ] Integrasikan Bridge Injector single/bulk bindings.
- [ ] Integrasikan Multiplier single/mass bindings.
- [ ] Integrasikan Sheets Autopilot row bindings.
- [ ] Integrasikan Recipe Labs untuk mode product affiliate.
- [ ] Refactor `contentflow-ingest` menjadi binding-first dan hapus lookup ambigu.
- [ ] Tambahkan lineage/status/override UX pada Content Flow.
- [ ] Tambahkan reconciliation report untuk affiliate link legacy.
- [ ] Jalankan unit/integration/API/UI smoke tests dan perbaiki seluruh failure.
- [ ] Jalankan seluruh regression tests terkait dan build Next.js.
- [ ] Review diff, cek tenant isolation, secret exposure, dan perubahan di luar scope.
- [ ] Perbarui dokumentasi/changelog dan tandai acceptance criteria yang terbukti.
- [ ] Setelah verifikasi berhasil, jalankan SOP release non-interaktif patch serta verifikasi version, changelog, commit, tag, main, dan remote.
- [ ] Jangan deploy production; deploy dev/staging hanya jika diminta pengguna.

## 18. Definition of Done

Selesai hanya bila seluruh campaign produk baru menggunakan resolver/binding, Brand A dan Brand B terbukti membawa link masing-masing untuk produk sama, Content Flow menerima snapshot yang benar, tidak ada akses lintas tenant/brand, Prompt Studio dan Prompt Aksi Video hilang dari Product Database baru, seluruh test/build lulus, checklist diperbarui, dan release repository berhasil sesuai `AGENTS.md`.
