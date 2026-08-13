# Implementation Plan — Integrasi Preset Manager dan Product Database pada Content Automation

Tanggal: 14 Agustus 2026  
Target: MAKNA Flow Content Automation — Product Campaign berbasis OPC  
Deployment: hanya Mac Mini Dev (`~/maknaflow-dev`, UI 5020, API 7020, schema `dev`, `PGPOOL_MAX=3`)  
Di luar scope: Strategic Campaign, provider generation berbayar, deployment Staging/Production, dan merge ke `main`.

## 1. Latar Belakang

Audit menemukan dua ketidaksesuaian sumber data:

1. Content Automation sudah memanggil `/api/v2/operator-presets`, tetapi preset custom lama yang tidak memiliki `campaign_kinds` diperlakukan sebagai `brand_editorial`. Preset Product Campaign lama kemudian hilang dari dropdown karena filter kompatibilitas.
2. Content Automation membaca `product_extractions` melalui endpoint khusus yang mewajibkan Brand Profile lebih dahulu. Content Planner langsung memuat katalog produk sehingga pengguna melihat perilaku berbeda dan menganggap Product Database belum terhubung.

Contoh preset yang terdampak pada Dev:

- `nutribake_4_klip_product_campaign`;
- `dapur_botani_product_campaign_4_klip`.

Keduanya mempunyai konfigurasi product bridging, tetapi tidak mempunyai `campaign_kinds`.

## 2. Sasaran

- Preset Manager menjadi satu-satunya sumber preset OPC untuk semua consumer.
- Preset custom memiliki metadata jenis campaign yang eksplisit.
- Preset lama tetap muncul melalui compatibility inference dan dapat dimigrasikan tanpa kehilangan konfigurasi.
- Content Automation memuat Product Database sejak modal dibuka, tidak menunggu Brand Profile.
- Brand Profile dipakai untuk binding/routing saat Save, bukan sebagai syarat melihat katalog produk.
- Content Planner dan Content Automation memakai kontrak katalog produk yang sama.
- Tenant isolation, approval checkpoint, feature flag, dan pipeline hardening tetap berlaku.

## 3. Keputusan Desain

### 3.1 Sumber preset

Endpoint canonical tetap:

```text
GET /api/v2/operator-presets
```

Setiap preset harus memiliki:

```json
{
  "campaign_kinds": ["brand_editorial"]
}
```

Nilai yang diperbolehkan:

- `brand_editorial`;
- `product_campaign`;
- keduanya.

Preset lama tidak langsung dianggap editorial. Compatibility resolver melakukan inference:

1. `campaign_kinds` eksplisit selalu menang;
2. `product_bridging.is_bridging_active=true` mengindikasikan `product_campaign`;
3. key/label yang mengandung `product_campaign` atau `product campaign` menjadi fallback terakhir;
4. selain itu menjadi `brand_editorial`.

API mengembalikan penanda `campaign_kinds_source: explicit|inferred|system`. Preset Manager menampilkan badge agar Admin dapat memperbaiki preset inferred.

### 3.2 Sumber produk

Endpoint canonical katalog tenant:

```text
GET /api/v2/products?search=&category=&limit=&cursor=
```

Content Planner dan Content Automation harus menggunakan endpoint tersebut. `/api/product-agent` tetap compatibility route untuk proses ekstraksi lama, tetapi tidak lagi menjadi sumber picker baru.

Produk dapat dipilih sebelum Brand Profile. Setelah Brand Profile dipilih, UI memuat binding terpisah:

```text
GET /api/v2/brand-profiles/{brandId}/products?product_id={productId}
```

atau endpoint binding summary ekuivalen. Save Product Campaign tetap mensyaratkan produk dan Brand Profile karena pipeline OPC membutuhkan snapshot brand-product dan affiliate routing.

### 3.3 Urutan form

Urutan modal Product Campaign:

1. Campaign Type;
2. OPC Preset;
3. Produk dari Product Database;
4. Brand Profile;
5. Binding/affiliate routing;
6. audience, visual subject, schedule, dan workflow.

Produk tidak dikosongkan ketika Brand Profile berubah. Yang di-reset hanya `brand_product_id` dan binding fields yang berasal dari brand sebelumnya.

## 4. Perubahan Data dan Migrasi

Tidak diperlukan kolom PostgreSQL baru karena preset custom disimpan pada `tenant_settings.operator_presets_json`.

Tambahkan migrasi idempotent aplikasi:

- baca preset custom setiap tenant;
- resolve campaign kind preset lama;
- tulis `campaign_kinds` hanya bila belum tersedia;
- naikkan `revision` satu kali;
- simpan audit event dengan old/new metadata;
- jangan mengubah system preset atau konfigurasi creative lainnya.

Sediakan dry-run script yang melaporkan:

- tenant;
- preset key;
- hasil inference;
- alasan inference;
- apakah perubahan akan dilakukan.

## 5. Kontrak API

### 5.1 Preset response

```json
{
  "key": "nutribake_4_klip_product_campaign",
  "label": "Nutribake 4 Klip Product Campaign",
  "campaign_kinds": ["product_campaign"],
  "campaign_kinds_source": "inferred",
  "config": {
    "campaign_kinds": ["product_campaign"]
  }
}
```

### 5.2 Product catalog response

```json
{
  "success": true,
  "data": [
    {
      "id": "product-id",
      "product_name": "Nama Produk",
      "product_description": "...",
      "target_audience": "...",
      "unique_selling_point": "...",
      "image_url": "/api/v2/products/image?...",
      "category": "...",
      "completeness": {
        "description": true,
        "image": true,
        "target_audience": true
      }
    }
  ],
  "pagination": {
    "next_cursor": null,
    "has_more": false
  }
}
```

### 5.3 Binding summary

Setelah produk dan brand tersedia:

```json
{
  "is_linked": true,
  "brand_product_id": "binding-id",
  "affiliate_link": "...",
  "landing_page_url": "...",
  "tracking_code": "...",
  "cta_override": "..."
}
```

## 6. Rencana Per File — Code Sebelum dan Sesudah

### 6.1 `lib/operator-presets.js`

Tujuan: compatibility inference menjadi satu sumber kebenaran.

#### Code Sebelum (Current/Before)

```js
export function normalizePresetCampaignKinds(value, { legacyDefault = ['brand_editorial'] } = {}) {
  const kinds = Array.isArray(value) ? [...new Set(value.map(String))] : legacyDefault;
  // ...
}

export function isOperatorPresetCompatible(preset, campaignKind) {
  const config = preset?.config || preset || {};
  return normalizePresetCampaignKinds(config.campaign_kinds).includes(campaignKind);
}
```

#### Code Sesudah (Proposed/After)

```js
export function resolvePresetCampaignKinds(preset) {
  const config = preset?.config || preset || {};
  if (Array.isArray(config.campaign_kinds)) {
    return { kinds: normalizePresetCampaignKinds(config.campaign_kinds), source: 'explicit' };
  }
  if (config.product_bridging?.is_bridging_active === true) {
    return { kinds: ['product_campaign'], source: 'inferred' };
  }
  const identity = `${preset?.key || ''} ${preset?.label || config.label || ''}`.toLowerCase();
  if (/product[ _-]?campaign/.test(identity)) {
    return { kinds: ['product_campaign'], source: 'inferred' };
  }
  return { kinds: ['brand_editorial'], source: 'inferred' };
}
```

`listOperatorPresets`, `isOperatorPresetCompatible`, dan `resolveOperatorPreset` memakai resolver yang sama.

### 6.2 `app/api/v2/operator-presets/route.js`

Tujuan: kontrak GET menyertakan normalized campaign kinds; POST mewajibkan metadata eksplisit.

#### Code Sebelum (Current/Before)

```js
return NextResponse.json({ success: true, presets: listOperatorPresets() });
```

#### Code Sesudah (Proposed/After)

```js
const presets = listOperatorPresets().map(withResolvedCampaignKinds);
return NextResponse.json({ success: true, presets }, {
  headers: { 'Cache-Control': 'no-store' }
});
```

POST/PUT menolak payload baru tanpa `campaign_kinds`, tetapi preset lama tetap dapat dibaca dan diedit.

### 6.3 `app/api/v2/operator-presets/[key]/route.js`

Tujuan: edit preset menyimpan campaign kinds dan revision secara konsisten.

#### Code Sebelum (Current/Before)

```js
const config = normalize(body, current);
all[key] = config;
```

#### Code Sesudah (Proposed/After)

```js
const config = normalize({
  ...body,
  config: {
    ...body.config,
    campaign_kinds: normalizePresetCampaignKinds(body.config.campaign_kinds)
  }
}, current);
all[key] = config;
```

### 6.4 `app/settings/presets/page.js`

Tujuan: Admin dapat menentukan consumer preset dan melihat preset inferred.

#### Code Sebelum (Current/Before)

```js
const initialForm = {
  key: '',
  label: '',
  // campaign kind tidak tersedia
};
```

#### Code Sesudah (Proposed/After)

```js
const initialForm = {
  key: '',
  label: '',
  campaign_kinds: ['brand_editorial']
};

<CampaignKindSelector
  value={form.campaign_kinds}
  options={['brand_editorial', 'product_campaign']}
/>
```

List menampilkan badge `Brand Editorial`, `Product Campaign`, `Shared`, serta warning `Inferred — save untuk konfirmasi`.

### 6.5 `scripts/migrate-operator-preset-campaign-kinds.mjs` — file baru

Tujuan: dry-run dan apply migration tenant-scoped.

#### Code Sebelum (Current/Before)

```js
// Tidak ada migrasi metadata campaign_kinds preset lama.
```

#### Code Sesudah (Proposed/After)

```js
const report = await inspectLegacyPresetCampaignKinds();
if (args.apply) await applyLegacyPresetCampaignKinds(report);
console.table(report.map(sanitizeMigrationRow));
```

Script tidak mencetak isi preset lengkap atau setting sensitif.

### 6.6 `lib/product-catalog-service.js` — file baru

Tujuan: normalisasi data picker yang dipakai bersama.

#### Code Sebelum (Current/Before)

```js
// Content Planner memakai /api/product-agent.
// Content Automation memakai listEligibleAutomationProducts(brandProfileId).
```

#### Code Sesudah (Proposed/After)

```js
export async function listProductCatalog({ search, category, cursor, limit }) {
  const rows = await listProducts({ search, category, cursor, limit });
  return rows.map(toProductPickerOption);
}
```

Mapper menghasilkan `id`, nama, deskripsi, USP, audience, image URL, category, dan completeness yang konsisten.

### 6.7 `app/api/v2/products/route.js`

Tujuan: endpoint katalog canonical mendukung picker dan pagination.

#### Code Sebelum (Current/Before)

```js
const search = searchParams.get('search') || '';
const category = searchParams.get('category') || '';
let products = await listProducts({ search, category });
```

#### Code Sesudah (Proposed/After)

```js
const result = await listProductCatalog({
  search: searchParams.get('search') || '',
  category: searchParams.get('category') || '',
  cursor: searchParams.get('cursor'),
  limit: clampLimit(searchParams.get('limit'))
});
return NextResponse.json({ success: true, ...result });
```

Existing consumer `data` tetap didukung agar perubahan backward-compatible.

### 6.8 `app/api/v2/content-automations/product-options/route.js`

Tujuan: compatibility wrapper, bukan katalog terpisah yang wajib brand.

#### Code Sebelum (Current/Before)

```js
listEligibleAutomationProducts({
  brandProfileId: query.get('brand_profile_id'),
  search: query.get('search') || ''
});
```

#### Code Sesudah (Proposed/After)

```js
const catalog = await listProductCatalog({ search, cursor, limit });
const bindings = brandProfileId
  ? await listBindingSummaries({ brandProfileId, productIds: catalog.data.map(p => p.id) })
  : new Map();
return mergeCatalogWithBindings(catalog, bindings);
```

Tanpa `brand_profile_id`, endpoint tetap mengembalikan semua produk tenant.

### 6.9 `lib/content-automation-product-snapshot.js`

Tujuan: memisahkan katalog dari snapshot/binding.

#### Code Sebelum (Current/Before)

```js
export async function listEligibleAutomationProducts({ brandProfileId, search = '' }) {
  if (!brandProfileId) throw new ProductSnapshotError('Brand Profile wajib dipilih.');
  return listBrandProducts({ brandProfileId, includeUnlinked: true, search });
}
```

#### Code Sesudah (Proposed/After)

```js
export async function getAutomationProductBindingSummary({ brandProfileId, productId }) {
  if (!brandProfileId || !productId) return { is_linked: false };
  return resolveBindingSummary({ brandProfileId, productId });
}
```

`captureProductSnapshot` tetap ketat: saat run dimulai, binding aktif wajib ada.

### 6.10 `app/content-automations/ProductPicker.js`

Tujuan: picker bekerja tanpa brand dan menunjukkan kelengkapan produk.

#### Code Sebelum (Current/Before)

```jsx
{products.map(product =>
  <option value={product.product_id}>
    {product.product_name} · {product.is_linked ? 'Linked' : 'Not linked'}
  </option>
)}
```

#### Code Sesudah (Proposed/After)

```jsx
{products.map(product =>
  <option value={product.id}>
    {product.product_name} · {product.category || 'Tanpa kategori'}
  </option>
)}
```

Linked status dipindahkan ke panel Binding karena nilainya bergantung pada Brand Profile.

### 6.11 `app/content-automations/page.js`

Tujuan: reorder modal, fetch katalog independen, dan fetch binding setelah dua pilihan tersedia.

#### Code Sebelum (Current/Before)

```js
async function loadProducts() {
  if (!form.brand_id || form.campaign_kind !== 'product_campaign') {
    setProducts([]);
    return;
  }
  const query = new URLSearchParams({ brand_profile_id: form.brand_id });
  // ...
}
```

#### Code Sesudah (Proposed/After)

```js
async function loadProducts() {
  if (form.campaign_kind !== 'product_campaign') return setProducts([]);
  const query = new URLSearchParams({ search: productSearch, limit: '50' });
  const result = await fetch(`/api/v2/products?${query}`).then(r => r.json());
  setProducts(result.data || []);
}

useEffect(() => {
  if (form.brand_id && form.product_id) loadBindingSummary();
}, [form.brand_id, form.product_id]);
```

Perubahan state:

- `selectProduct` tidak membutuhkan brand;
- `selectBrand` tidak menghapus `product_id`;
- perubahan brand menghapus hanya binding-derived values;
- preset dropdown memiliki link `Kelola di Preset Manager`;
- empty/error/loading state ditampilkan terpisah untuk preset, katalog, dan binding;
- Save memvalidasi preset compatible, produk lengkap, brand, dan binding input.

### 6.12 `app/content-planner/page.js`

Tujuan: migrasi consumer katalog lama ke endpoint canonical.

#### Code Sebelum (Current/Before)

```js
fetch('/api/product-agent')
  .then(r => r.json())
  .then(d => setExistingProducts(d.data || []));
```

#### Code Sesudah (Proposed/After)

```js
fetch('/api/v2/products?limit=50')
  .then(r => r.json())
  .then(d => setExistingProducts(d.data || []));
```

Search server-side dan pagination ditambahkan bila katalog lebih dari limit.

### 6.13 `lib/content-automation-binding-service.js`

Tujuan: binding dibuat/reused saat Save setelah produk dan brand dipilih.

#### Code Sebelum (Current/Before)

```js
if (!brandProfileId || !productId) {
  throw new Error('Brand Profile dan Produk wajib dipilih.');
}
```

#### Code Sesudah (Proposed/After)

```js
assertSelectedProductBelongsToTenant(productId);
assertSelectedBrandBelongsToTenant(brandProfileId);
return ensureAutomationProductBinding({ brandProfileId, productId, bindingInput });
```

Validasi eksplisit memastikan pemilihan produk sebelum brand tidak melemahkan tenant isolation.

### 6.14 Test files

File:

- `scripts/test-operator-presets.mjs` — baru;
- `scripts/test-product-catalog-contract.mjs` — baru;
- `scripts/test-content-automation-product-integration.mjs` — diperluas;
- `scripts/test-content-planner-modes.mjs` — diperluas;
- `package.json` — test scripts.

#### Code Sebelum (Current/Before)

```js
assert.equal(isOperatorPresetCompatible(getOperatorPresetConfig('nutribake_editorial_v1'), 'product_campaign'), false);
```

#### Code Sesudah (Proposed/After)

```js
assert.deepEqual(resolvePresetCampaignKinds(legacyProductPreset), {
  kinds: ['product_campaign'],
  source: 'inferred'
});
assert.equal(catalogWithoutBrand.length > 0, true);
assert.equal(otherTenantProductsVisible, false);
```

### 6.15 `docs/content-automation-product-campaign/runbook.md`

Tujuan: troubleshooting preset/product source dan rollback.

#### Code Sebelum (Current/Before)

```md
1. Pastikan Brand Profile telah dipilih.
2. Periksa product-options dengan brand_profile_id.
```

#### Code Sesudah (Proposed/After)

```md
1. Katalog produk harus dapat dimuat tanpa Brand Profile.
2. Brand Profile hanya menentukan binding/routing.
3. Preset inferred harus dikonfirmasi melalui Preset Manager.
```

## 7. Urutan Implementasi

### Fase A — Kontrak preset

1. Tambahkan resolver campaign kinds pure-function.
2. Tambahkan unit tests legacy/product/editorial/shared.
3. Normalisasi response API.
4. Tambahkan campaign kind selector dan badge Preset Manager.
5. Buat dry-run migration dan review hasil Dev.
6. Apply migration hanya ke schema Dev setelah report benar.

### Fase B — Shared product catalog

1. Buat catalog mapper/service.
2. Perluas endpoint `/api/v2/products` secara backward-compatible.
3. Ubah product-options menjadi compatibility wrapper tanpa brand requirement.
4. Tambahkan batch binding summary agar tidak N+1 query.
5. Tambahkan pagination dan tenant isolation tests.

### Fase C — Content Automation UI

1. Muat preset dan katalog secara independen.
2. Reorder modal.
3. Pisahkan state product selection dan brand binding.
4. Tambahkan loading/error/empty states.
5. Pertahankan target audience resolution: manual → product → preset → brand → fallback.
6. Pastikan Save menghasilkan/reuse `brand_product_id` seperti sebelumnya.

### Fase D — Content Planner convergence

1. Ganti source picker ke `/api/v2/products`.
2. Pertahankan kompatibilitas payload planner.
3. Uji pencarian, pemilihan, dan autofill existing product.

### Fase E — Verifikasi dan Dev deployment

1. Jalankan unit/integration/multi-tenant tests.
2. Jalankan build.
3. Deploy hanya `npm run deploy:macmini-dev`.
4. Smoke test UI dengan pilot flag tetap off.
5. Verifikasi schema `dev`, port 5020/7020, `PGPOOL_MAX=3`.
6. Jalankan patch release pada branch kerja, bukan `main`.

## 8. Test Matrix

| Area | Skenario | Ekspektasi |
|---|---|---|
| Preset | System Product Campaign | Muncul di Product Campaign |
| Preset | Custom explicit product | Muncul di Product Campaign |
| Preset | Legacy product bridging aktif | Muncul sebagai inferred product |
| Preset | Legacy editorial | Tidak muncul di Product Campaign |
| Preset | Shared preset | Muncul di kedua jenis campaign |
| Preset | Tenant A custom preset | Tidak terlihat Tenant B |
| Product | Modal dibuka tanpa brand | Katalog produk langsung tersedia |
| Product | Search nama/kategori | Hasil server-side sesuai |
| Product | Produk Tenant A | Tidak terlihat Tenant B |
| Binding | Pilih produk lalu brand | Binding summary dimuat |
| Binding | Ganti brand | Produk tetap, binding di-reset/reload |
| Binding | Produk unlinked | Binding dibuat saat Save |
| Binding | Produk linked | Binding existing dipakai ulang |
| Audience | Product memiliki audience | Product audience digunakan |
| Audience | Product kosong, preset terisi | Preset audience digunakan |
| Regression | Brand Editorial | Tidak terdampak |
| Regression | Content Planner existing product | Tetap dapat generate planner |
| Security | Request lintas tenant | HTTP 403/404 tanpa kebocoran data |

## 9. Acceptance Criteria

- Dropdown OPC Preset menampilkan semua preset Product Campaign dari Preset Manager, termasuk preset lama yang berhasil diinferensikan.
- Admin dapat mengatur campaign applicability preset dari Preset Manager tanpa mengedit JSON manual.
- Product Picker memuat katalog tenant sebelum Brand Profile dipilih.
- Pemilihan Brand Profile tidak menghapus produk yang sudah dipilih.
- Binding/routing terlihat setelah produk dan brand tersedia.
- Content Planner dan Content Automation membaca endpoint katalog canonical yang sama.
- Tidak ada preset atau produk lintas tenant.
- Product Campaign feature flag dan pilot flag tetap bekerja.
- Tidak ada provider berbayar yang dipanggil selama smoke test.
- Build dan Dev deployment sehat; Staging/Production tidak disentuh.

## 10. Risiko dan Mitigasi

| Risiko | Mitigasi |
|---|---|
| Inference salah mengklasifikasikan preset lama | Dry-run report, reason field, Admin confirmation badge |
| Migrasi menimpa preset custom | Hanya isi field yang absent; simpan old/new audit; revision increment |
| Katalog besar membuat modal lambat | Debounced server search, limit/cursor, jangan load semua foto penuh |
| Binding stale saat brand berubah | Reset hanya binding state dan refetch berdasarkan pasangan product-brand |
| Consumer lama rusak karena response berubah | Pertahankan field `data` dan compatibility wrapper |
| Produk lintas tenant | Semua query wajib memakai active tenant dan integration isolation test |

## 11. Rollback

1. Matikan `content_automation_product_campaign_pilot_enabled`.
2. Redeploy tag Dev sebelumnya ke `~/maknaflow-dev`.
3. Kembalikan UI ke endpoint compatibility bila katalog canonical bermasalah.
4. Jangan hapus `campaign_kinds` hasil migrasi; metadata tersebut aman dan dapat diperbaiki melalui Preset Manager.
5. Jangan menghapus binding yang sudah valid.
6. Tidak ada rollback schema destruktif.

## 12. Execution Task List

### A. Baseline dan audit

- [x] Catat branch, HEAD, dan dirty files.
- [x] Baca dokumentasi Next.js lokal yang relevan sebelum coding.
- [x] Snapshot preset custom per tenant dan hasil inference dry-run.
- [x] Snapshot jumlah produk, brand, dan binding pada schema Dev.
- [x] Jalankan baseline Preset, Product, Content Planner, Content Automation, dan OPC tests.

### B. Preset Manager integration

- [x] Implementasikan resolver campaign kinds dengan compatibility inference.
- [x] Normalisasi GET/POST/PUT API preset.
- [x] Tambahkan campaign kind selector di Preset Manager.
- [x] Tambahkan badge explicit/inferred/system pada daftar preset.
- [x] Buat dry-run/apply migration script.
- [x] Jalankan dry-run dan review hasil Dev.
- [x] Apply migrasi metadata hanya ke Dev.
- [x] Tambahkan preset compatibility dan tenant-isolation tests.

### C. Shared Product Database

- [x] Implementasikan shared product catalog mapper/service.
- [x] Perluas `/api/v2/products` dengan search/pagination contract.
- [x] Jadikan product-options compatibility wrapper tanpa kewajiban brand.
- [x] Implementasikan batch binding summary.
- [x] Tambahkan catalog, completeness, pagination, dan tenant-isolation tests.

### D. Content Automation UI

- [x] Muat produk tanpa menunggu Brand Profile.
- [x] Ubah urutan field menjadi Preset → Produk → Brand → Binding.
- [x] Pisahkan product state dan binding state.
- [x] Pertahankan produk saat Brand Profile berubah.
- [x] Tambahkan link ke Preset Manager dan Product Database.
- [x] Tambahkan loading/error/empty/retry states.
- [x] Verifikasi audience resolution dan preset application.
- [x] Verifikasi Save/reuse/create binding.

### E. Content Planner convergence

- [x] Ganti product picker Content Planner ke endpoint canonical.
- [x] Tambahkan debounced server search/pagination.
- [x] Pertahankan autofill dan payload planner existing.
- [x] Jalankan Content Planner regression tests.

### F. Verifikasi

- [x] Jalankan `git diff --check`.
- [x] Jalankan preset unit/integration tests.
- [x] Jalankan product catalog unit/integration tests.
- [x] Jalankan Content Automation Product Campaign tests.
- [x] Jalankan OPC dan Content Planner regressions.
- [x] Jalankan multi-tenant isolation tests pada schema Dev.
- [x] Jalankan production build.
- [x] Perbarui runbook dan checklist utama.

### G. Deploy Dev dan release

- [x] Deploy hanya dengan `npm run deploy:macmini-dev`.
- [x] Verifikasi PM2 Dev online.
- [x] Verifikasi UI 5020, API 7020, schema `dev`, dan pool 3.
- [x] Smoke test Preset Manager, Product Picker, binding, dan Save paused tanpa provider call.
- [x] Pastikan pilot flag tetap off selama smoke test.
- [x] Konfirmasi tidak ada deployment Staging/Production.
- [x] Jalankan release patch non-interactive.
- [x] Verifikasi commit, tag, dan push branch kerja.
- [x] Jangan merge/push `main` tanpa instruksi lanjutan pengguna.
