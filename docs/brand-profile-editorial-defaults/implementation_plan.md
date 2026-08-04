# Implementation Plan — Default Brand Editorial pada Brand Profile

## 1. Sasaran

Menambahkan tiga default strategi editorial ke Brand Profile:

1. `Konteks Brand *`;
2. `Tujuan Konten`;
3. `Pilar Konten *`.

Saat pengguna membuat Content Planner dengan fokus `Brand Editorial`, pemilihan Brand Profile akan memuat ketiga nilai tersebut ke modal. Nilai tetap dapat disesuaikan per planner dan disimpan sebagai snapshot di `content_planners`; perubahan Brand Profile berikutnya tidak mengubah planner lama.

## 2. Keputusan Desain

### 2.1 Model data

Kolom baru pada `brand_profiles`:

| Kolom | Tipe | Keterangan |
|---|---|---|
| `editorial_brand_context` | `TEXT` | Default konteks untuk Brand Editorial |
| `editorial_content_goal` | `TEXT` | Default tujuan konten; boleh kosong |
| `editorial_content_pillars_json` | `TEXT DEFAULT '[]'` | Array JSON pilar konten |

Nama memakai prefix `editorial_` agar tidak rancu dengan Brand DNA umum atau nilai snapshot pada `content_planners`.

Kolom awalnya nullable/backward-compatible. Brand Profile lama tetap dapat dibuka. Ketika dibuat atau diedit melalui UI baru, konteks dan minimal satu pilar wajib diisi.

### 2.2 Snapshot, bukan live reference

```text
Brand Profile default
        ↓ hydrate
Modal Brand Editorial
        ↓ pengguna dapat mengubah
content_planners.brand_context/content_goal/pillars_json
```

Generator dan eksekusi planner tetap membaca snapshot dari `content_planners`. Tidak ada pembacaan ulang Brand Profile saat planner lama dieksekusi.

### 2.3 Aturan autofill

- Dropdown Brand Profile dipindahkan ke atas field editorial ketika fokus `brand_editorial`.
- Saat brand dipilih, ketiga default dimuat jika form editorial masih pristine/kosong.
- Jika pengguna sudah mengedit form, pergantian brand tidak boleh menimpa nilai secara diam-diam.
- Tampilkan konfirmasi inline atau tombol `Muat Default Brand Profile` untuk overwrite eksplisit.
- Tampilkan status `Default dari Brand Profile` atau `Disesuaikan untuk planner ini`.
- Jika profil lama belum memiliki default, field tetap kosong dan UI menampilkan petunjuk untuk melengkapi Brand Profile.
- Berpindah ke `product_campaign` tidak menghapus draft editorial selama modal masih terbuka, tetapi payload product tidak memakai nilai editorial.

### 2.4 Validasi

- Konteks wajib untuk penyimpanan profil baru/edit dan planner Brand Editorial; trim; maksimum 4.000 karakter.
- Tujuan opsional; trim; maksimum 2.000 karakter.
- Pilar wajib minimal 1, maksimum 12.
- Setiap pilar maksimum 120 karakter.
- Pilar kosong dan duplikat case-insensitive dibuang.
- JSON tidak valid selalu dinormalisasi menjadi array kosong, tidak menyebabkan halaman crash.

### 2.5 Tenant dan otorisasi

- Semua GET/POST/PUT Brand Profile memerlukan user aktif.
- User `superadmin` tanpa tenant operasional tidak boleh membaca atau mengubah profil tenant.
- Query detail/update menggunakan kombinasi `id + tenant_id`.
- User biasa hanya melihat brand yang ditugaskan; admin tenant dapat mengelola seluruh brand tenant.
- API tidak mempercayai `tenant_id` dari body.

## 3. Perubahan per File

### 3.1 `[MODIFY] lib/db-pg.js`

#### Code Sebelum (Current/Before)

```javascript
const bpNewCols = [
  'storage_provider TEXT',
  'nextcloud_target_folder TEXT',
  'drive_target_folder TEXT',
  'drive_glabs_folder_id TEXT',
  'webhook_host TEXT',
  'webhook_port TEXT',
  'webhook_api_key TEXT'
];
```

#### Code Sesudah (Proposed/After)

```javascript
const bpNewCols = [
  'storage_provider TEXT',
  'nextcloud_target_folder TEXT',
  'drive_target_folder TEXT',
  'drive_glabs_folder_id TEXT',
  'webhook_host TEXT',
  'webhook_port TEXT',
  'webhook_api_key TEXT',
  'editorial_brand_context TEXT',
  'editorial_content_goal TEXT',
  "editorial_content_pillars_json TEXT DEFAULT '[]'"
];
```

Migration dijalankan idempotent. Default `[]` diterapkan untuk row lama yang null agar pembacaan konsisten.

### 3.2 `[MODIFY] scripts/local-staging/setup.js`

#### Code Sebelum (Current/Before)

```javascript
await client.query(`ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS nextcloud_parent_folder TEXT`);
await client.query(`ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS drive_parent_folder TEXT`);
```

#### Code Sesudah (Proposed/After)

```javascript
await client.query(`ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS editorial_brand_context TEXT`);
await client.query(`ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS editorial_content_goal TEXT`);
await client.query(`ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS editorial_content_pillars_json TEXT DEFAULT '[]'`);
await client.query(`UPDATE brand_profiles SET editorial_content_pillars_json='[]' WHERE editorial_content_pillars_json IS NULL`);
```

Setup baru dan runtime migration harus menghasilkan schema yang identik.

### 3.3 `[NEW] lib/brand-editorial-defaults.js`

#### Code Sebelum (Current/Before)

```javascript
// Normalisasi dan validasi default editorial belum tersedia.
```

#### Code Sesudah (Proposed/After)

```javascript
export function normalizeEditorialPillars(value) {
  // Parse array/string JSON, trim, dedupe case-insensitive,
  // maksimal 12 item dan 120 karakter per item.
}

export function normalizeBrandEditorialDefaults(input) {
  return {
    editorial_brand_context: String(input.editorial_brand_context || '').trim(),
    editorial_content_goal: String(input.editorial_content_goal || '').trim(),
    editorial_content_pillars_json: JSON.stringify(normalizeEditorialPillars(input.editorial_content_pillars_json))
  };
}

export function validateBrandEditorialDefaults(input) {
  // Konteks dan minimal satu pilar wajib ketika create/update melalui UI baru.
}
```

Normalizer dipakai API dan test agar kontrak tidak bergantung pada implementasi UI.

### 3.4 `[MODIFY] lib/db.js`

#### Code Sebelum (Current/Before)

```javascript
const fields = [
  'id', 'brand_name', 'tone_of_voice', 'visual_signature',
  'raw_guideline_text', 'guideline_filename',
  'storage_provider', 'nextcloud_target_folder', 'drive_target_folder',
  'drive_glabs_folder_id', 'webhook_host', 'webhook_port', 'webhook_api_key'
];

return await dbAll(
  'SELECT id, brand_name, tone_of_voice, visual_signature, guideline_filename, created_at, storage_provider, webhook_host FROM brand_profiles ORDER BY created_at DESC',
  []
);
```

#### Code Sesudah (Proposed/After)

```javascript
const fields = [
  'id', 'brand_name', 'tone_of_voice', 'visual_signature',
  'raw_guideline_text', 'guideline_filename',
  'storage_provider', 'nextcloud_target_folder', 'drive_target_folder',
  'drive_glabs_folder_id', 'webhook_host', 'webhook_port', 'webhook_api_key',
  'editorial_brand_context', 'editorial_content_goal',
  'editorial_content_pillars_json'
];

return await dbAll(`
  SELECT id, brand_name, tone_of_voice, visual_signature,
         editorial_brand_context, editorial_content_goal,
         editorial_content_pillars_json,
         guideline_filename, created_at, storage_provider, webhook_host
  FROM brand_profiles
  ORDER BY created_at DESC
`, []);
```

Allowlist update ikut menyertakan ketiga kolom. Query tetap melalui tenant-aware DB wrapper dan tidak menerima `tenant_id` dari payload.

### 3.5 `[MODIFY] app/api/v2/brand-profiles/route.js`

#### Code Sebelum (Current/Before)

```javascript
export async function GET() {
  const profiles = await getAllBrandProfiles();
  return NextResponse.json({ success: true, data: profiles });
}

export async function POST(req) {
  const body = await req.json();
  await createBrandProfile({
    id,
    brand_name: body.brand_name,
    visual_signature: body.visual_signature
  });
}
```

#### Code Sesudah (Proposed/After)

```javascript
export async function GET(req) {
  const user = requireTenantUser(req);
  const profiles = await tenantContext.run(user.tenantId, () =>
    getAuthorizedBrandProfiles(user)
  );
  return NextResponse.json({ success: true, data: profiles });
}

export async function POST(req) {
  const user = requireTenantAdmin(req);
  const body = await req.json();
  const editorial = validateBrandEditorialDefaults(body);
  await tenantContext.run(user.tenantId, () => createBrandProfile({
    ...pickAllowedBrandFields(body),
    ...editorial
  }));
}
```

Route Handler tetap dinamis karena memakai request/session dan database. Error validasi mengembalikan `400`, unauthorized `401`, dan tenant tanpa akses `403/404` tanpa membocorkan keberadaan ID.

### 3.6 `[MODIFY] app/api/v2/brand-profiles/[id]/route.js`

#### Code Sebelum (Current/Before)

```javascript
const profile = await getBrandProfile(id);
await updateBrandProfile(id, body);
await deleteBrandProfile(id);
```

#### Code Sesudah (Proposed/After)

```javascript
const user = requireTenantUser(req);
const profile = await getAuthorizedBrandProfile(id, user);

const user = requireTenantAdmin(req);
const editorial = validateBrandEditorialDefaults(body);
await updateAuthorizedBrandProfile(id, user, {
  ...pickAllowedBrandFields(body),
  ...editorial
});
```

GET menghormati assignment brand user. PUT/DELETE hanya admin tenant dan selalu menggunakan predicate tenant.

### 3.7 `[MODIFY] app/api/brand-profiles/route.js`

#### Code Sebelum (Current/Before)

```javascript
SELECT id, brand_name, tone_of_voice, visual_signature,
       color_palette, forbidden_elements, brand_slogan_or_cta,
       guideline_filename, created_at
FROM brand_profiles
```

#### Code Sesudah (Proposed/After)

```javascript
SELECT id, brand_name, tone_of_voice, visual_signature,
       color_palette, forbidden_elements, brand_slogan_or_cta,
       editorial_brand_context, editorial_content_goal,
       editorial_content_pillars_json,
       guideline_filename, created_at
FROM brand_profiles
```

Endpoint kompatibilitas juga tenant-scoped dan mengembalikan bentuk default editorial yang sama agar caller lama tidak memiliki kontrak berbeda.

### 3.8 `[MODIFY] app/settings/brand-profiles/page.js`

#### Code Sebelum (Current/Before)

```javascript
const emptyForm = {
  brand_name: '',
  tone_of_voice: 'Kasual/Gaul',
  visual_signature: '',
  // integration fields
};
```

```jsx
<div className="form-group">
  <label className="form-label">Visual Signature *</label>
  <textarea name="visual_signature" />
</div>
```

#### Code Sesudah (Proposed/After)

```javascript
const emptyForm = {
  brand_name: '',
  tone_of_voice: 'Kasual/Gaul',
  visual_signature: '',
  editorial_brand_context: '',
  editorial_content_goal: '',
  editorial_content_pillars: [],
  // integration fields
};
```

```jsx
<section aria-labelledby="brand-editorial-defaults">
  <h3 id="brand-editorial-defaults">Default Brand Editorial</h3>
  <textarea name="editorial_brand_context" required />
  <textarea name="editorial_content_goal" />
  <PillarChips value={formData.editorial_content_pillars} maxItems={12} />
</section>
```

UI upload guideline tidak mengarang ketiga default. Jika extractor belum mendukungnya, hasil upload mengisi Brand DNA lama dan pengguna melengkapi default editorial sebelum save.

### 3.9 `[MODIFY] app/content-planner/page.js`

#### Code Sebelum (Current/Before)

```jsx
{plannerFocus === 'brand_editorial' && <>
  <textarea value={brandContext} onChange={...} />
  <textarea value={contentGoal} onChange={...} />
  <PillarInputs value={pillars} />
</>}

<select value={selectedBrandId} onChange={...}>
  {/* Brand Profile berada setelah field editorial */}
</select>
```

#### Code Sesudah (Proposed/After)

```javascript
const [editorialSource, setEditorialSource] = useState('empty');
const [editorialDirty, setEditorialDirty] = useState(false);

function applyBrandEditorialDefaults(profile, { force = false } = {}) {
  if (editorialDirty && !force) return setPendingEditorialProfile(profile);
  setBrandContext(profile.editorial_brand_context || '');
  setContentGoal(profile.editorial_content_goal || '');
  setPillars(parseEditorialPillars(profile.editorial_content_pillars_json));
  setEditorialSource('profile');
  setEditorialDirty(false);
}
```

```jsx
{plannerFocus === 'brand_editorial' && (
  <>
    <BrandProfileSelect onChange={handleBrandEditorialSelect} />
    <EditorialSourceStatus source={editorialSource} />
    <EditorialFields onDirty={() => setEditorialDirty(true)} />
    <button type="button" onClick={() => applyBrandEditorialDefaults(selectedBrand, { force: true })}>
      Muat ulang default Brand Profile
    </button>
  </>
)}
```

Untuk `product_campaign`, dropdown Brand Profile tetap tersedia di posisi yang relevan tanpa memuat default editorial. Payload planner tetap memakai field snapshot yang sudah ada:

```javascript
{
  brand_context: brandContext.trim(),
  content_goal: contentGoal.trim(),
  pillars,
  brand_id: selectedBrandId || null
}
```

### 3.10 `[MODIFY] lib/content-planner-contract.js`

#### Code Sebelum (Current/Before)

```javascript
export function normalizePillars(value) {
  // dedupe dan slice(0, 20)
}
```

#### Code Sesudah (Proposed/After)

```javascript
export function normalizePillars(value) {
  return normalizeEditorialPillars(value);
}

export function validatePlannerDraft(params) {
  // Brand Editorial: context <= 4000, goal <= 2000,
  // 1..12 pilar, masing-masing <= 120 karakter.
}
```

Kontrak planner dan Brand Profile memakai batas yang sama sehingga UI tidak dapat mengirim nilai yang kemudian dipotong berbeda oleh engine.

### 3.11 `[NEW] scripts/test-brand-editorial-defaults.mjs`

#### Code Sebelum (Current/Before)

```javascript
// Belum ada regression test default Brand Editorial.
```

#### Code Sesudah (Proposed/After)

```javascript
// Test:
// - normalisasi trim/dedupe/case-insensitive;
// - invalid JSON menjadi [];
// - batas jumlah dan panjang;
// - create/read/update tiga default;
// - tenant A tidak dapat membaca/mengubah brand tenant B;
// - user hanya melihat assigned brand;
// - hydration menghasilkan nilai modal yang benar;
// - dirty guard menolak silent overwrite;
// - planner menyimpan snapshot dan tidak berubah setelah profil diedit;
// - Brand Profile lama tanpa default tetap dapat dibaca.
```

### 3.12 `[MODIFY] package.json`

#### Code Sebelum (Current/Before)

```json
{
  "scripts": {
    "test:contentflow-migration": "node scripts/test-contentflow-legacy-migration.mjs"
  }
}
```

#### Code Sesudah (Proposed/After)

```json
{
  "scripts": {
    "test:contentflow-migration": "node scripts/test-contentflow-legacy-migration.mjs",
    "test:brand-editorial-defaults": "node scripts/test-brand-editorial-defaults.mjs"
  }
}
```

## 4. Urutan Implementasi

### Phase A — Schema dan kontrak

1. Backup PostgreSQL staging.
2. Tambahkan tiga kolom secara idempotent pada runtime migration dan setup staging.
3. Buat normalizer/validator shared.
4. Perluas persistence Brand Profile.

### Phase B — API dan tenant safety

1. Tambahkan autentikasi eksplisit pada endpoint Brand Profile v2 dan kompatibilitas.
2. Terapkan tenant predicate dan assignment brand.
3. Tambahkan validasi create/update serta response field baru.

### Phase C — UI

1. Tambahkan seksi Default Brand Editorial pada Brand Profile Manager.
2. Pindahkan Brand Profile selector ke awal blok Brand Editorial.
3. Implementasikan hydration, dirty guard, reload default, dan status sumber.
4. Pertahankan snapshot payload planner yang sekarang.

### Phase D — Verifikasi dan rilis

1. Jalankan regression test baru dan test Content Planner terkait.
2. Jalankan build Next.js.
3. Rilis patch, push `local-staging`, `main`, dan tag.
4. Deploy Node 2 menggunakan single-pass deployment.
5. Smoke test create/edit profile dan create planner Brand Editorial.

## 5. Acceptance Criteria

- Brand Profile baru/edit dapat menyimpan dan memuat tiga default editorial.
- Profil lama tanpa default tidak menyebabkan error.
- Memilih Brand Profile pada Brand Editorial memuat konteks, tujuan, dan pilar.
- Input manual tidak pernah ditimpa tanpa tindakan eksplisit.
- Planner menyimpan snapshot ketiga nilai.
- Mengedit Brand Profile setelah planner dibuat tidak mengubah planner lama.
- Pilar tersimpan sebagai JSON valid, unik, dan sesuai batas.
- User tidak dapat membaca/mengubah default brand tenant lain atau brand yang tidak ditugaskan.
- Product Campaign tidak berubah perilakunya.
- Build dan regression test lulus.

## 6. Rollback

- Rollback aplikasi: kembalikan UI/API ke versi sebelumnya; kolom tambahan aman dibiarkan karena additive.
- Rollback data: restore backup hanya jika migration schema menyebabkan kegagalan luas; tidak diperlukan untuk sekadar membatalkan fitur.
- Jangan drop kolom saat rollback normal agar data default editorial yang sudah dimasukkan pengguna tidak hilang.

## Execution Task List

- [x] Ambil backup PostgreSQL target dan catat checksum/restore command.
- [x] Tambahkan tiga kolom default editorial di runtime migration.
- [x] Sinkronkan schema `scripts/local-staging/setup.js`.
- [x] Buat normalizer dan validator default editorial.
- [x] Perluas create/list/get/update Brand Profile.
- [x] Hardening autentikasi, tenant predicate, dan brand assignment pada API.
- [x] Tambahkan seksi Default Brand Editorial pada Brand Profile Manager.
- [x] Implementasikan hydration pada modal Brand Editorial.
- [x] Implementasikan dirty guard dan tombol muat ulang default.
- [x] Pastikan planner tetap menyimpan snapshot, bukan live reference.
- [x] Tambahkan regression test normalisasi, tenant, hydration, dan snapshot.
- [x] Jalankan automated verification dan build.
- [x] Rilis patch dan sinkronkan `local-staging`, `main`, serta tag.
- [x] Deploy Node 2 dengan single-pass deployment.
- [ ] Smoke test UI create/edit Brand Profile dan create Brand Editorial planner (regression backend Node 2 lulus; sesi browser belum login dan kredensial staging environment ditolak).
