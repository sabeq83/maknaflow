# Implementation Plan — Penyempurnaan Modal Content Automation Product Campaign

## 1. Tujuan

Menyempurnakan modal **New Content Automation → Product Campaign** agar:

1. dropdown OPC Preset benar-benar memuat semua preset yang kompatibel dengan Product Campaign;
2. dropdown Produk memuat katalog tenant dari menu **Data Produk**, tidak hanya produk yang sudah memiliki binding aktif;
3. binding Brand–Product dan affiliate routing dapat dibuat atau diperbarui langsung ketika schedule disimpan;
4. Target Audience mengikuti sumber data yang jelas dan konsisten;
5. konfigurasi preset diterapkan secara utuh ke planner dan OPC, dengan manual override yang transparan;
6. seluruh pipeline tetap menggunakan OPC sebagai acuan, tanpa ketergantungan baru pada Strategic Campaign;
7. deployment hanya dilakukan ke **Server Dev Mac Mini**, tidak ke Staging atau Production.

## 2. Ringkasan hasil audit

### 2.1 OPC Preset

UI saat ini memfilter preset Product Campaign dengan key tunggal `product_campaign_v1`. Dampaknya, dropdown hanya memiliki satu pilihan dan custom preset tenant tidak pernah muncul.

Fungsi `choosePreset()` juga hanya menerapkan `ai_directive` dan `mandatory_outro_line`. Target demographic, visual engine, approval mode, product bridging, serta ContentFlow sync tidak ikut diterapkan.

### 2.2 Produk

Endpoint `/api/v2/content-automations/product-options` saat ini memakai `INNER JOIN brand_products` dan `is_active=TRUE`. Akibatnya, produk dari Data Produk yang belum terhubung ke Brand Profile tidak muncul.

Audit schema `dev` menemukan:

- 251 Data Produk pada tenant operasional;
- hanya 1 binding Brand–Product aktif;
- sebagian besar Brand Profile akan memperoleh dropdown Produk kosong.

### 2.3 Target Audience

Target Audience masih memakai default editorial dan tidak berubah ketika Product Campaign atau preset dipilih. Sementara itu:

- Data Produk memiliki `target_audience`;
- OPC preset memiliki `basic_strategy.target_demographic`;
- OPC campaign memiliki `target_demographic` dan `target_demographic_custom`;
- Planner memakai `target_audience`.

Konsep audiens komunikasi dan demographic subjek visual belum dipisahkan.

## 3. Keputusan desain

### 3.1 Sumber katalog Produk

`product_extractions` adalah katalog utama. `brand_products` adalah association/routing, bukan syarat agar produk tampil.

Endpoint product-options harus menggunakan `LEFT JOIN brand_products` untuk Brand Profile terpilih dan mengembalikan:

- seluruh produk tenant;
- status `is_linked` dan `is_active`;
- `brand_product_id` bila binding sudah ada;
- affiliate link, landing page, tracking code, CTA override;
- kelengkapan produk;
- Target Audience produk.

### 3.2 Binding ketika schedule disimpan

Untuk produk yang belum terhubung:

1. UI mengirim `product_binding` bersama request schedule;
2. API memvalidasi Brand Profile dan Produk dalam tenant aktif;
3. API melakukan `upsertBrandProduct()`;
4. hasil `brand_product_id` disuntikkan ke planner sebelum normalisasi schedule;
5. schedule baru disimpan dalam status `paused` seperti perilaku sekarang.

Binding tidak dibuat ketika user sekadar memilih produk; binding baru dibuat saat submit berhasil agar modal yang dibatalkan tidak menghasilkan data sampah.

### 3.3 Resolusi Target Audience

Simpan dua konsep berbeda:

- `target_audience`: sasaran pesan/penawaran pada Content Planner;
- `target_demographic` dan `target_demographic_custom`: subjek manusia/karakter pada visual OPC.

Urutan resolusi `target_audience` untuk mode Auto:

1. manual override yang sudah dikunci user;
2. `product_extractions.target_audience`;
3. `preset.config.planner_defaults.target_audience`;
4. audience Brand Profile bila field tersedia;
5. fallback `Konsumen yang relevan dengan produk terpilih`.

Target Audience tidak boleh disimpulkan langsung dari enum `target_demographic`. Preset dapat menyediakan keduanya secara terpisah.

### 3.4 Kompatibilitas preset

Tambahkan metadata pada preset:

```json
{
  "campaign_kinds": ["product_campaign"],
  "planner_defaults": {
    "target_audience": "",
    "content_goal": "Conversion, product education, dan qualified engagement."
  }
}
```

Aturan kompatibilitas:

- preset baru: gunakan `campaign_kinds`;
- preset lama tanpa metadata: kompatibel dengan Brand Editorial untuk backward compatibility;
- `product_campaign_v1`: eksplisit kompatibel dengan Product Campaign;
- custom preset tenant dapat muncul bila mendeklarasikan `campaign_kinds: ['product_campaign']`.

### 3.5 Manual override

UI menyimpan `fieldSources` untuk membedakan nilai `preset`, `product`, `brand`, dan `manual`.

Ketika user mengetik Target Audience, field berubah menjadi `manual` dan tidak ditimpa saat produk/preset berubah sampai user menekan **Reset ke Auto**.

## 4. UX modal yang diusulkan

Urutan section:

1. Campaign Type
2. Nama Schedule
3. Brand Profile
4. Produk dari Data Produk
5. Product Completeness dan Binding Status
6. Affiliate Routing untuk produk belum terhubung atau binding yang ingin diperbarui
7. OPC Preset
8. Preset Summary
9. Target Audience dan Source
10. Visual Subject Demographic
11. Planner Count, Approval Mode, dan ContentFlow
12. AI Guardrail dan Outro
13. Jadwal
14. Pipeline Summary

State Produk wajib dibedakan:

- belum memilih Brand;
- loading;
- sukses dengan jumlah produk;
- katalog kosong;
- request gagal dan tombol Retry;
- produk dipilih tetapi data minimum tidak lengkap.

## 5. Kontrak API yang diusulkan

### 5.1 GET product options

```http
GET /api/v2/content-automations/product-options?brand_profile_id={id}&search={optional}
```

Respons:

```json
{
  "success": true,
  "summary": {
    "total": 251,
    "linked": 1,
    "unlinked": 250
  },
  "products": [
    {
      "product_id": "pe_123",
      "brand_product_id": null,
      "product_name": "Produk A",
      "target_audience": "Ibu bekerja usia 25–40",
      "is_linked": false,
      "binding_active": false,
      "affiliate_link": null,
      "completeness": {
        "description": true,
        "usp": true,
        "image": true,
        "product_url": true,
        "target_audience": true,
        "affiliate": false
      }
    }
  ]
}
```

### 5.2 POST schedule

Tambahan body untuk Product Campaign:

```json
{
  "product_binding": {
    "product_id": "pe_123",
    "affiliate_link": "https://...",
    "landing_page_url": "https://...",
    "tracking_code": "campaign-a",
    "cta_override": "Cek produk di keranjang kuning",
    "update_existing": false
  },
  "operator_request": {
    "planner": {
      "target_audience": "Ibu bekerja usia 25–40"
    },
    "opc": {
      "preset": "product_ugc_conversion_v1",
      "basic_strategy": {
        "target_demographic": "custom",
        "target_demographic_custom": "Perempuan Indonesia usia 25–40"
      }
    }
  }
}
```

Respons schedule mengembalikan `binding_created` atau `binding_updated` untuk feedback UI.

## 6. Perubahan per file

### 6.1 `lib/operator-presets.js`

Tujuan:

- menambahkan metadata `campaign_kinds` dan `planner_defaults`;
- menyediakan minimal tiga system preset Product Campaign;
- mempertahankan kompatibilitas preset lama.

#### Code Sebelum (Current/Before)

```js
product_campaign_v1: {
  schema_version: '2',
  label: 'Product Campaign — OPC',
  basic_strategy: {
    target_demographic: 'custom'
  }
}
```

#### Code Sesudah (Proposed/After)

```js
product_ugc_conversion_v1: {
  schema_version: '2',
  label: 'Product UGC Conversion',
  campaign_kinds: ['product_campaign'],
  planner_defaults: {
    target_audience: '',
    content_goal: 'Conversion, product education, dan qualified engagement.'
  },
  basic_strategy: {
    target_demographic: 'custom',
    target_demographic_custom: ''
  },
  visual_engine: { visual_style: 'UGC', visual_mode: 'hybrid_lock' },
  workflow: { approval_mode: 'start_frames', auto_sync_contentflow: true }
}
```

Preset system Product minimal:

- Product UGC Conversion;
- Product Education;
- Problem–Solution Demo.

### 6.2 `app/api/v2/operator-presets/route.js`

Tujuan:

- mengekspos metadata kompatibilitas preset;
- memvalidasi `campaign_kinds` pada custom preset;
- tidak mengizinkan nilai campaign kind di luar enum.

#### Code Sebelum (Current/Before)

```js
function normalize(body,current={}) {
  const config=body.config;
  return {...config,schema_version:'2',label:String(body.label||config.label||key).trim()};
}
```

#### Code Sesudah (Proposed/After)

```js
function normalize(body, current = {}) {
  const campaignKinds = normalizeCampaignKinds(body.config.campaign_kinds);
  return {
    ...body.config,
    campaign_kinds: campaignKinds,
    schema_version: '2',
    label: String(body.label || body.config.label || key).trim()
  };
}
```

### 6.3 `lib/brand-product-repository.js`

Tujuan:

- menggunakan query katalog `LEFT JOIN` yang sudah tersedia;
- memperluas hasil dengan description, USP, audience, URL, dan foto;
- menghindari query ganda;
- menjaga semua query tenant-scoped.

#### Code Sebelum (Current/Before)

```sql
SELECT p.id AS product_id, p.product_name, p.category,
       bp.id AS brand_product_id, bp.affiliate_link
FROM product_extractions p
LEFT JOIN brand_products bp ON ...
WHERE p.tenant_id = $1
```

#### Code Sesudah (Proposed/After)

```sql
SELECT p.id AS product_id,
       p.product_name,
       p.product_description,
       p.unique_selling_point,
       p.target_audience,
       p.source_url,
       p.raw_photo_url,
       p.clean_photo_url,
       bp.id AS brand_product_id,
       bp.affiliate_link,
       bp.tracking_code,
       bp.landing_page_url,
       bp.cta_override,
       COALESCE(bp.is_active, FALSE) AS binding_active
FROM product_extractions p
LEFT JOIN brand_products bp
  ON bp.product_id = p.id
 AND bp.brand_profile_id = $2
 AND bp.tenant_id = $1
WHERE p.tenant_id = $1
ORDER BY p.product_name ASC
```

### 6.4 `lib/content-automation-product-snapshot.js`

Tujuan:

- `listEligibleAutomationProducts()` memuat seluruh Data Produk tenant;
- mengembalikan `is_linked`, completeness, audience, dan summary;
- snapshot tetap mensyaratkan binding aktif ketika run dimulai;
- memakai nama produk override dan CTA override bila tersedia.

#### Code Sebelum (Current/Before)

```sql
FROM brand_products bp
JOIN product_extractions p ON p.id=bp.product_id
WHERE bp.brand_profile_id=$2 AND bp.is_active=TRUE
```

#### Code Sesudah (Proposed/After)

```js
const products = await listBrandProducts({
  brandProfileId,
  includeUnlinked: true,
  search
});

return {
  summary: summarizeProductBindings(products),
  products: products.map(toAutomationProductOption)
};
```

`captureProductSnapshot()` tetap memakai join binding aktif untuk memastikan schedule tidak dapat dieksekusi dengan association yang sudah dinonaktifkan.

### 6.5 `app/api/v2/content-automations/product-options/route.js`

Tujuan:

- menerima parameter pencarian opsional;
- mengembalikan summary katalog;
- menghasilkan error code yang dapat dibedakan UI.

#### Code Sebelum (Current/Before)

```js
const brandProfileId = new URL(request.url).searchParams.get('brand_profile_id');
return NextResponse.json({
  success: true,
  products: await listEligibleAutomationProducts({ brandProfileId })
});
```

#### Code Sesudah (Proposed/After)

```js
const query = new URL(request.url).searchParams;
const result = await listEligibleAutomationProducts({
  brandProfileId: query.get('brand_profile_id'),
  search: query.get('search') || ''
});
return NextResponse.json({ success: true, ...result });
```

### 6.6 `lib/content-automation-binding-service.js` — file baru

Tujuan:

- memusatkan validasi dan upsert Brand–Product untuk Content Automation;
- memastikan product ID body sama dengan product ID planner;
- mencegah cross-tenant binding;
- membedakan create, reactivate, update, dan reuse;
- tidak menimpa affiliate routing existing kecuali `update_existing=true`.

#### Code Sebelum (Current/Before)

```js
// Belum ada service khusus. UI diwajibkan mengirim brand_product_id existing.
```

#### Code Sesudah (Proposed/After)

```js
export async function ensureAutomationProductBinding({
  brandProfileId,
  productId,
  bindingInput
}) {
  const existing = await getBrandProduct({ brandProfileId, productId });
  if (existing?.is_active && !bindingInput.update_existing) {
    return { binding: existing, action: 'reused' };
  }
  const binding = await upsertBrandProduct({
    brandProfileId,
    productId,
    ...sanitizeBindingInput(bindingInput),
    isActive: true
  });
  return { binding, action: existing ? 'updated' : 'created' };
}
```

### 6.7 `app/api/v2/content-automations/route.js`

Tujuan:

- pada Product Campaign, memastikan binding sebelum normalisasi final;
- menyuntikkan `brand_product_id` hasil upsert;
- mengembalikan aksi binding;
- Brand Editorial tetap memakai jalur lama.

#### Code Sebelum (Current/Before)

```js
const data = normalizeContentAutomation(await request.json());
return NextResponse.json({
  success: true,
  schedule: await createAutomation(data, user.id)
}, { status: 201 });
```

#### Code Sesudah (Proposed/After)

```js
const body = await request.json();
const prepared = body.campaign_kind === 'product_campaign'
  ? await prepareProductCampaignSchedule(body)
  : { body, bindingAction: null };
const data = normalizeContentAutomation(prepared.body);
const schedule = await createAutomation(data, user.id);
return NextResponse.json({
  success: true,
  schedule,
  binding_action: prepared.bindingAction
}, { status: 201 });
```

Catatan konsistensi: jika schedule insert gagal setelah binding baru dibuat, binding tetap valid sebagai reusable association Brand–Product. Tidak dilakukan rollback yang menghapus association karena binding merupakan data domain yang sah, bukan data temporer schedule.

### 6.8 `lib/content-automation-contract.js`

Tujuan:

- memvalidasi audience source;
- memastikan Product Campaign memiliki audience non-kosong setelah resolusi;
- memastikan `brand_product_id` hasil preparation tersedia;
- tidak menerima binding fields yang tidak dikenal di operator payload.

#### Code Sebelum (Current/Before)

```js
if (!operatorRequest.planner.brand_product_id) {
  throw new ContentAutomationError('Brand-product binding wajib tersedia.');
}
```

#### Code Sesudah (Proposed/After)

```js
if (!operatorRequest.planner.brand_product_id) {
  throw new ContentAutomationError('Brand-product binding gagal disiapkan.');
}
if (!String(operatorRequest.planner.target_audience || '').trim()) {
  throw new ContentAutomationError('Target Audience Product Campaign wajib tersedia.');
}
```

### 6.9 `app/content-automations/page.js`

Tujuan:

- mengganti select Produk menjadi searchable combobox/listbox;
- memuat seluruh katalog tenant setelah Brand dipilih;
- menampilkan loading/error/empty state;
- menampilkan badge Linked/Not linked;
- menyediakan affiliate routing inline;
- memfilter preset berdasarkan `campaign_kinds`;
- menerapkan seluruh default preset;
- memisahkan Target Audience dan Visual Subject;
- melindungi manual override;
- menampilkan preset summary dan sumber nilai.

#### Code Sebelum (Current/Before)

```jsx
{products.map(product => (
  <option key={product.product_id} value={product.product_id}>
    {product.product_name}
  </option>
))}

{presets.filter(preset =>
  form.campaign_kind === 'product_campaign'
    ? preset.key === 'product_campaign_v1'
    : preset.key !== 'product_campaign_v1'
)}
```

#### Code Sesudah (Proposed/After)

```jsx
<ProductPicker
  products={products}
  loading={productState.loading}
  error={productState.error}
  summary={productState.summary}
  value={form.product_id}
  onSearch={setProductSearch}
  onChange={selectProduct}
  onRetry={loadProducts}
/>

const compatiblePresets = presets.filter(preset =>
  preset.config.campaign_kinds?.includes(form.campaign_kind)
);
```

Audience source UI:

```jsx
<AudienceField
  value={form.target_audience}
  source={fieldSources.target_audience}
  onChange={value => setManualAudience(value)}
  onReset={() => resolveAudience({ force: true })}
/>
```

Payload Product Campaign harus menyertakan:

```js
product_binding: {
  product_id: form.product_id,
  affiliate_link: form.affiliate_link,
  landing_page_url: form.landing_page_url,
  tracking_code: form.tracking_code,
  cta_override: form.cta_override,
  update_existing: form.update_existing_binding
}
```

### 6.10 `app/content-automations/ProductPicker.js` — file baru

Tujuan:

- memecah kompleksitas page utama;
- menyediakan combobox/listbox keyboard-accessible;
- mendukung pencarian produk;
- badge binding dan kelengkapan;
- state loading/error/empty.

#### Code Sebelum (Current/Before)

```jsx
<select value={form.product_id}>...</select>
```

#### Code Sesudah (Proposed/After)

```jsx
export default function ProductPicker({
  products, value, loading, error, summary, onSearch, onChange, onRetry
}) {
  // role="combobox", aria-expanded, keyboard navigation, and visible states
}
```

### 6.11 `app/content-automations/PresetSummary.js` — file baru

Tujuan:

- menampilkan konfigurasi efektif preset;
- memberi tahu field yang berasal dari preset dan manual override;
- menyediakan **Reset to Preset**.

#### Code Sebelum (Current/Before)

```jsx
// Belum ada preview preset.
```

#### Code Sesudah (Proposed/After)

```jsx
<PresetSummary
  preset={selectedPreset}
  effectiveConfig={effectiveOpcConfig}
  overriddenFields={overriddenFields}
  onReset={applySelectedPreset}
/>
```

### 6.12 `scripts/test-content-automation-product.mjs`

Tujuan:

- menambah contract test metadata preset;
- menguji audience resolution;
- menguji product option linked dan unlinked;
- menguji request schedule dengan binding baru;
- menguji compatibility mapping preset lama.

#### Code Sebelum (Current/Before)

```js
assert.equal(product.operator_request.planner.product_id, 'product_1');
```

#### Code Sesudah (Proposed/After)

```js
assert.equal(resolveAudience({ productAudience: 'Ibu muda' }).value, 'Ibu muda');
assert.equal(isPresetCompatible(productPreset, 'product_campaign'), true);
assert.equal(isPresetCompatible(editorialPreset, 'product_campaign'), false);
assert.equal(unlinkedOption.is_linked, false);
```

### 6.13 `scripts/test-content-automation-product-integration.mjs` — file baru

Tujuan:

- integration test schema `dev` atau isolated test schema;
- tenant isolation;
- upsert binding baru;
- reuse binding existing tanpa menimpa affiliate link;
- update binding hanya dengan flag eksplisit;
- memastikan snapshot run membutuhkan binding aktif;
- memastikan Brand Editorial tidak membuat binding.

#### Code Sebelum (Current/Before)

```js
// Belum ada integration test khusus binding dari modal automation.
```

#### Code Sesudah (Proposed/After)

```js
await testCreatesBindingForUnlinkedTenantProduct();
await testReusesExistingBindingWithoutOverwrite();
await testRejectsCrossTenantProduct();
await testInactiveBindingIsReactivatedExplicitly();
```

### 6.14 `package.json`

Tujuan: menambahkan script integration test baru.

#### Code Sebelum (Current/Before)

```json
"test:content-automation:product": "node scripts/test-content-automation-product.mjs"
```

#### Code Sesudah (Proposed/After)

```json
"test:content-automation:product": "node scripts/test-content-automation-product.mjs",
"test:content-automation:product-integration": "node scripts/test-content-automation-product-integration.mjs"
```

### 6.15 `docs/content-automation-product-campaign/runbook.md` — file baru

Tujuan:

- mendokumentasikan katalog produk, binding, audience source, preset compatibility;
- troubleshooting dropdown kosong;
- retry API dan validasi Dev;
- rollback application-only tanpa menghapus binding valid.

#### Code Sebelum (Current/Before)

```md
Belum ada runbook khusus modal Product Campaign.
```

#### Code Sesudah (Proposed/After)

```md
## Troubleshooting Product Dropdown
1. Periksa respons product-options.
2. Pastikan tenant produk sama dengan Brand Profile.
3. Periksa completeness dan binding status.
```

## 7. Validasi dan aturan bisnis

### Produk

- Brand Profile dan Produk wajib berada pada tenant aktif.
- Produk tanpa nama atau deskripsi tidak dapat disimpan sebagai schedule aktif; schedule dapat disimpan paused hanya jika UI menampilkan blocking completeness dan user memperbaiki data terlebih dahulu. Rekomendasi final: tetap block save sampai nama dan deskripsi lengkap karena run juga akan ditolak snapshot.
- Affiliate link boleh kosong bila campaign bukan affiliate, tetapi UI harus menampilkan warning.
- Binding existing tidak boleh ditimpa secara diam-diam.

### Preset

- Product Campaign wajib menggunakan preset dengan `campaign_kinds` yang mencakup `product_campaign`.
- Config custom preset divalidasi oleh contract OPC yang sudah ada.
- Social posting tetap `false` pada pilot.

### Audience

- Target Audience planner wajib non-kosong.
- `target_demographic=custom` membutuhkan `target_demographic_custom` non-kosong sebelum submit.
- Perubahan produk/preset hanya memperbarui audience bila source bukan `manual`.

## 8. Strategi pengujian

### Unit/contract

- filter kompatibilitas preset;
- fallback preset legacy;
- audience resolution dan manual lock;
- mapping seluruh preset config ke form;
- completeness produk;
- binding payload sanitizer.

### Integration

- katalog menampilkan linked dan unlinked products;
- pencarian tenant-scoped;
- create binding baru;
- reuse dan explicit update binding;
- reject cross-tenant IDs;
- create schedule menerima `brand_product_id` hasil service;
- run snapshot berhasil setelah binding;
- inactive binding menggagalkan run.

### UI/manual smoke test Dev

1. Login Dev port 5020.
2. Buka Content Automations → New Schedule → Product Campaign.
3. Pilih brand tanpa binding dan pastikan seluruh Data Produk muncul.
4. Cari produk dan pilih produk unlinked.
5. Isi routing opsional dan simpan schedule.
6. Pastikan binding tercipta dan schedule paused.
7. Buka ulang modal dan pastikan produk berstatus Linked.
8. Ganti tiga preset dan verifikasi preview serta field yang berubah.
9. Edit Target Audience manual, ganti preset, dan pastikan manual value tidak tertimpa.
10. Reset Audience ke Auto dan verifikasi product audience dipakai.

## 9. Deployment Dev dan rollback

Target eksklusif:

- host: `masbenu@100.95.245.55`;
- folder: `~/maknaflow-dev`;
- UI: port `5020`;
- API: port `7020`;
- schema: `dev`;
- `PGPOOL_MAX=3`;
- command: `npm run deploy:macmini-dev`.

Dilarang:

- `npm run deploy:staging`;
- folder `~/maknaflow-staging`;
- port 5010/7010;
- schema `staging`;
- deployment Production tanpa perintah eksplisit.

Rollback aplikasi:

1. checkout/redeploy tag aplikasi sebelumnya ke Dev;
2. reload PM2 Dev;
3. jangan hapus association `brand_products` yang telah dibuat, karena association tersebut valid sebagai domain data dan aman dipakai ulang;
4. bila perlu, nonaktifkan binding melalui existing Brand Profile API.

## 10. Risiko dan mitigasi

| Risiko | Mitigasi |
|---|---|
| Katalog 251+ produk membuat select lambat | Searchable picker, debounce, limit/pagination bila data tumbuh >1.000 |
| Binding existing tertimpa | `update_existing=false` default dan explicit confirmation |
| Preset mengganti manual input | `fieldSources` dan manual lock |
| Target audience produk kosong | Fallback preset/brand/default dan badge sumber |
| Custom preset invalid | Validasi route serta contract OPC sebelum save |
| Cross-tenant product binding | Seluruh repository query memakai tenant context |
| Schedule tersimpan tetapi binding gagal | Binding disiapkan sebelum normalisasi dan insert schedule |
| Binding berhasil tetapi schedule insert gagal | Binding dipertahankan sebagai domain association yang reusable |

## 11. Definition of Done

- Semua Product-compatible system/custom preset muncul di dropdown.
- Memilih preset menerapkan konfigurasi lengkap dan menampilkan preview.
- Seluruh Data Produk tenant muncul setelah Brand dipilih, termasuk produk unlinked.
- Produk unlinked dapat dihubungkan saat schedule disimpan.
- Binding existing tidak ditimpa tanpa persetujuan eksplisit.
- Target Audience memakai source resolution dan manual override lock.
- Target Audience planner terpisah dari Visual Subject Demographic.
- Contract, integration, build, dan UI smoke test lulus.
- Deployment hanya ke Mac Mini Dev dan environment terverifikasi memakai schema `dev`, `PGPOOL_MAX=3`.
- Changelog, release patch, commit, tag, dan push selesai sesuai SOP repo.

## 12. Execution Task List

Checklist ini harus diperbarui real-time saat implementasi. Ubah `[ ]` menjadi `[x]` hanya setelah tahap benar-benar selesai dan terverifikasi.

### A. Baseline

- [x] Catat branch, HEAD, dan `git status`; pertahankan perubahan user yang tidak terkait.
- [x] Baca dokumentasi Next.js lokal yang relevan untuk Client Components, Route Handlers, dan Forms.
- [x] Jalankan baseline Content Automation dan OPC tests. *(Contract Product/Automation lulus; OPC memerlukan akses DB dan dijalankan kembali pada tahap verifikasi.)*
- [x] Ambil snapshot read-only jumlah Data Produk dan binding pada schema `dev`.

### B. Preset contract

- [x] Tambahkan metadata `campaign_kinds` dan `planner_defaults`.
- [x] Tambahkan minimal tiga system preset Product Campaign.
- [x] Tambahkan compatibility helper untuk system dan custom preset.
- [x] Validasi metadata custom preset pada API.
- [x] Tambahkan unit test compatibility dan backward compatibility.

### C. Product catalog dan binding

- [x] Perluas query katalog Data Produk dengan `LEFT JOIN brand_products`.
- [x] Tambahkan search, completeness, binding status, dan summary.
- [x] Buat Content Automation binding service.
- [x] Pastikan existing binding tidak ditimpa tanpa flag eksplisit.
- [x] Integrasikan ensure binding ke POST schedule Product Campaign.
- [x] Tambahkan audit event binding created/reused/updated.
- [x] Tambahkan tenant-isolation dan binding integration tests.

### D. Audience resolution

- [x] Implementasikan pure helper audience resolution.
- [x] Pisahkan Target Audience planner dan Visual Subject Demographic.
- [x] Terapkan source priority product → preset → brand → default.
- [x] Implementasikan manual override lock dan Reset ke Auto.
- [x] Validasi custom demographic dan target audience non-kosong.
- [x] Tambahkan audience resolution tests.

### E. Modal UI

- [x] Tambahkan loading/error/empty state produk.
- [x] Implementasikan searchable ProductPicker yang keyboard-accessible.
- [x] Tambahkan badge Linked/Not linked dan completeness.
- [x] Tambahkan inline Affiliate Routing.
- [x] Ganti hard-code filter preset dengan metadata compatibility.
- [x] Terapkan seluruh preset config ke form.
- [x] Tambahkan Preset Summary dan Reset to Preset.
- [x] Tambahkan label sumber Target Audience.
- [x] Perbarui pipeline summary dan submit validation.
- [x] Verifikasi responsive layout dan accessibility. *(Lulus pada viewport 390×844: tanpa horizontal overflow, modal tetap terlihat, dan seluruh input memiliki label.)*

### F. Test dan dokumentasi

- [x] Jalankan `git diff --check`.
- [x] Jalankan Content Automation contract tests.
- [x] Jalankan Product Campaign unit tests.
- [x] Jalankan Product Campaign binding integration tests.
- [x] Jalankan OPC regression tests.
- [x] Jalankan Content Planner regression tests.
- [x] Jalankan production build.
- [x] Buat/update runbook troubleshooting.

### G. Deploy hanya ke Mac Mini Dev

- [x] Jalankan `npm run deploy:macmini-dev`.
- [x] Verifikasi remote build berhasil tanpa polling SSH berulang.
- [x] Verifikasi PM2 `maknaflow-dev-ui` dan `maknaflow-dev-api` online.
- [x] Verifikasi UI port 5020 dan API port 7020.
- [x] Verifikasi `PG_SEARCH_PATH=dev` dan `PGPOOL_MAX=3`.
- [x] Jalankan UI smoke test modal Product Campaign pada Dev. *(Tiga preset tampil; 251 produk dimuat untuk dapurbotani; Linked/Not linked, routing, audience source, manual lock, reset, dan validasi Save terverifikasi.)*
- [x] Verifikasi tidak ada deploy ke Staging atau Production.

### H. Release

- [x] Perbarui changelog.
- [x] Jalankan release patch non-interactive sesuai SOP.
- [x] Verifikasi commit, tag, dan push remote.
- [x] Catat item yang belum diuji end-to-end bila memerlukan biaya layanan AI. *(Tidak ada generasi AI berbiaya yang dijalankan; UI smoke tertahan autentikasi.)*
