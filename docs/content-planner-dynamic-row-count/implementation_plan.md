# Implementation Plan — Dynamic Row Count Content Planner

## 1. Sasaran

Membedakan dasar pemilihan `Jumlah Baris Planner` berdasarkan fokus planner:

- `Product Campaign`: tetap memakai kelipatan enam Category Entry Point (CEP), yaitu `6, 12, 18, 24, 30`.
- `Brand Editorial`: memakai `jumlah pilar × jumlah ide per pilar`, dengan total maksimal 30 baris.

Nilai total tetap disimpan sebagai `content_planners.planner_count` dan diteruskan ke Gemini. Untuk Brand Editorial, Strategic Skeleton wajib membagi setiap pilar secara merata sesuai jumlah ide per pilar.

## 2. Aturan Produk

### 2.1 Product Campaign

Opsi tidak berubah:

| Total | Label |
|---:|---|
| 6 | 1× siklus CEP |
| 12 | 2× siklus CEP — standar |
| 18 | 3× siklus CEP |
| 24 | 4× siklus CEP — massal |
| 30 | 5× siklus CEP — maksimal |

Default: `12`.

### 2.2 Brand Editorial

Rumus:

```text
planner_count = pillar_count × rows_per_pillar
```

Opsi multiplier:

```text
1..floor(30 / pillar_count)
```

Contoh empat pilar:

```text
4 baris  — 1 ide per pilar
8 baris  — 2 ide per pilar (Direkomendasikan)
12 baris — 3 ide per pilar
...
28 baris — 7 ide per pilar
```

Default: `2 ide per pilar`. Karena jumlah pilar dibatasi maksimal 12, default tidak akan melebihi 24 baris.

Jika jumlah pilar berubah, intent `rows_per_pillar` dipertahankan selama masih valid. Jika hasil melebihi 30, multiplier di-clamp ke `floor(30 / pillar_count)` dan UI menampilkan pemberitahuan.

### 2.3 Edge cases

- Tanpa pilar: dropdown disabled dan menampilkan `Masukkan Pilar Konten terlebih dahulu`.
- Satu pilar: opsi 1–30 baris; label tetap berbasis jumlah ide per pilar.
- Dua belas pilar: hanya 12 atau 24 baris.
- Total 30 tidak wajib muncul jika bukan kelipatan jumlah pilar.
- Pergantian Brand Profile yang memuat jumlah pilar berbeda menghitung ulang total berdasarkan multiplier aktif.
- Kembali ke Product Campaign mengembalikan pilihan Product Campaign terakhir, bukan membawa total Brand Editorial.

### 2.4 Distribusi dan Gemini

Untuk Brand Editorial:

1. pilar adalah dimensi pemerataan utama;
2. CEP tetap diputar sebagai variasi konteks;
3. VFO tetap diputar sebagai variasi framing;
4. Gemini menerima Strategic Skeleton yang sudah menentukan pilar setiap baris;
5. prompt menegaskan setiap pilar harus muncul tepat `rows_per_pillar` kali.

Tidak digunakan KPK jumlah pilar dengan enam CEP karena dapat memperbesar batch melewati batas 30.

### 2.5 Distribution mode

Pada implementasi saat ini, `buildDistributionPlan()` membagi pilar round-robin dan belum menerapkan `custom` atau `growth` meskipun opsi tersebut terlihat di UI.

Untuk fase ini:

- `Balanced` menjadi satu-satunya mode aktif Brand Editorial;
- `Custom Weight` dan `Growth Priority` disembunyikan atau disabled dengan label `Segera Hadir`;
- weighted distribution menjadi scope terpisah agar UI tidak menjanjikan perilaku yang belum dijalankan engine.

## 3. Kontrak Validasi

### Product Campaign

```javascript
planner_count ∈ [6, 12, 18, 24, 30]
```

### Brand Editorial

```javascript
pillar_count >= 1
planner_count >= pillar_count
planner_count <= 30
planner_count % pillar_count === 0
rows_per_pillar = planner_count / pillar_count
```

Validasi wajib berjalan ketika:

- draft dibuat;
- draft dieksekusi;
- planner lama/retry dibaca untuk eksekusi;
- request dikirim langsung tanpa UI.

## 4. Perubahan per File

### 4.1 `[MODIFY] lib/content-planner-contract.js`

#### Code Sebelum (Current/Before)

```javascript
export function validatePlannerDraft(params) {
  const focus = normalizePlannerFocus(params.planner_focus);
  // Validasi product/context/pillars.
  return focus;
}

export function buildDistributionPlan(plannerCount, pillarsList, offsetIndex = 0, seedString = '') {
  // Pilar, CEP, dan VFO diputar round-robin.
}
```

#### Code Sesudah (Proposed/After)

```javascript
export const PRODUCT_PLANNER_COUNTS = [6, 12, 18, 24, 30];
export const MAX_PLANNER_COUNT = 30;
export const DEFAULT_PRODUCT_PLANNER_COUNT = 12;
export const DEFAULT_EDITORIAL_ROWS_PER_PILLAR = 2;

export function getBrandEditorialCountOptions(pillarCount) {
  const count = Number(pillarCount) || 0;
  if (count < 1) return [];
  return Array.from({ length: Math.floor(MAX_PLANNER_COUNT / count) }, (_, index) => {
    const rowsPerPillar = index + 1;
    return {
      value: count * rowsPerPillar,
      rowsPerPillar,
      label: `${count * rowsPerPillar} Baris — ${rowsPerPillar} ide per pilar`
    };
  });
}

export function validatePlannerCount(focus, plannerCount, pillars) {
  const count = Number.parseInt(plannerCount, 10);
  if (focus === 'product_campaign') {
    if (!PRODUCT_PLANNER_COUNTS.includes(count)) throw validationError('Jumlah baris Product Campaign harus mengikuti siklus CEP.');
    return { count, rowsPerPillar: null };
  }
  const pillarCount = normalizePillars(pillars).length;
  if (!pillarCount || count < pillarCount || count > MAX_PLANNER_COUNT || count % pillarCount !== 0) {
    throw validationError('Jumlah baris Brand Editorial harus merupakan kelipatan jumlah pilar dan maksimal 30.');
  }
  return { count, rowsPerPillar: count / pillarCount };
}

export function validatePlannerDraft(params) {
  const focus = normalizePlannerFocus(params.planner_focus);
  // Validasi field existing.
  validatePlannerCount(focus, params.planner_count, params.pillars);
  return focus;
}
```

`buildDistributionPlan()` tetap deterministik, tetapi test akan memastikan setiap pilar muncul tepat sama banyak untuk count yang valid.

### 4.2 `[MODIFY] app/content-planner/page.js`

#### Code Sebelum (Current/Before)

```javascript
const [plannerCount, setPlannerCount] = useState(12);
```

```jsx
<select value={plannerCount} onChange={e => setPlannerCount(e.target.value)}>
  <option value="6">6 Baris Plan (1x CEP)</option>
  <option value="12">12 Baris Plan (2x CEP - Standar)</option>
  <option value="18">18 Baris Plan (3x CEP)</option>
  <option value="24">24 Baris Plan (4x CEP - Massal)</option>
  <option value="30">30 Baris Plan (5x CEP - Maksimal)</option>
</select>
```

#### Code Sesudah (Proposed/After)

```javascript
const [productPlannerCount, setProductPlannerCount] = useState(12);
const [editorialRowsPerPillar, setEditorialRowsPerPillar] = useState(2);

const editorialCountOptions = getBrandEditorialCountOptions(pillars.length);
const maxRowsPerPillar = editorialCountOptions.length;
const effectiveRowsPerPillar = Math.min(editorialRowsPerPillar, Math.max(1, maxRowsPerPillar));
const effectivePlannerCount = plannerFocus === 'brand_editorial'
  ? pillars.length * effectiveRowsPerPillar
  : productPlannerCount;
```

```jsx
{plannerFocus === 'product_campaign' ? (
  <select value={productPlannerCount} onChange={...}>
    {/* Opsi CEP existing */}
  </select>
) : (
  <select
    disabled={pillars.length === 0}
    value={effectiveRowsPerPillar}
    onChange={event => setEditorialRowsPerPillar(Number(event.target.value))}
  >
    {editorialCountOptions.map(option => (
      <option key={option.rowsPerPillar} value={option.rowsPerPillar}>
        {option.label}{option.rowsPerPillar === 2 ? ' (Direkomendasikan)' : ''}
      </option>
    ))}
  </select>
)}
```

Payload memakai total terhitung:

```javascript
{
  planner_count: effectivePlannerCount
}
```

Ketika jumlah pilar bertambah dan multiplier harus di-clamp, tampilkan notice non-blocking. Dropdown `pillar_distribution_mode` untuk Brand Editorial hanya menampilkan `Balanced`; opsi lain disabled atau disembunyikan.

### 4.3 `[MODIFY] lib/content-planner-engine.js`

#### Code Sebelum (Current/Before)

```javascript
const focus = validatePlannerDraft({ ...params, planner_focus });
const normalizedPillars = normalizePillars(pillars);
const count = parseInt(planner_count, 10) || 12;
```

```javascript
const count = parseInt(planner_count, 10) || 12;
const distributionPlan = buildDistributionPlan(count, pillars, offsetIndex, seed);
```

#### Code Sesudah (Proposed/After)

```javascript
const focus = validatePlannerDraft({ ...params, planner_focus });
const normalizedPillars = normalizePillars(pillars);
const { count, rowsPerPillar } = validatePlannerCount(focus, planner_count, normalizedPillars);
```

```javascript
const { count, rowsPerPillar } = validatePlannerCount(focus, planner_count, pillars);
const distributionPlan = buildDistributionPlan(count, pillars, offsetIndex, seed);
```

Tambahan instruksi prompt Brand Editorial:

```text
- Jumlah Pilar: ${pillars.length}
- Ide per Pilar: ${rowsPerPillar}
- Total Baris: ${count}
- Setiap pilar WAJIB muncul tepat ${rowsPerPillar} kali.
- Jangan menambah, menghapus, mengganti nama, atau mengubah distribusi pilar dari Strategic Skeleton.
```

Engine memvalidasi ulang planner tersimpan sebelum mengubah status menjadi `generating`. Planner invalid harus gagal dengan error validasi dan tidak meninggalkan status menggantung.

### 4.4 `[NEW] scripts/test-content-planner-counts.mjs`

#### Code Sebelum (Current/Before)

```javascript
// Belum ada regression test khusus dynamic row count.
```

#### Code Sesudah (Proposed/After)

```javascript
// Product Campaign:
// - menerima 6,12,18,24,30;
// - menolak nilai lain dan >30.

// Brand Editorial:
// - opsi selalu kelipatan pillar_count;
// - opsi terakhir <=30;
// - default 2 ide per pilar;
// - zero pillar menghasilkan opsi kosong;
// - count non-kelipatan dan >30 ditolak;
// - perubahan jumlah pilar mempertahankan/clamp multiplier;
// - buildDistributionPlan membagi setiap pilar tepat rows_per_pillar;
// - offset/history tidak merusak pemerataan dalam satu batch;
// - normalizeGeneratedPlannerRows menjaga jumlah output persis count.
```

Test tabel utama:

| Pilar | Opsi yang diharapkan |
|---:|---|
| 1 | 1..30 |
| 3 | 3,6,9,…,30 |
| 4 | 4,8,12,…,28 |
| 7 | 7,14,21,28 |
| 10 | 10,20,30 |
| 12 | 12,24 |

### 4.5 `[MODIFY] package.json`

#### Code Sebelum (Current/Before)

```json
{
  "scripts": {
    "test:brand-editorial-defaults": "node scripts/test-brand-editorial-defaults.mjs"
  }
}
```

#### Code Sesudah (Proposed/After)

```json
{
  "scripts": {
    "test:brand-editorial-defaults": "node scripts/test-brand-editorial-defaults.mjs",
    "test:content-planner-counts": "node scripts/test-content-planner-counts.mjs"
  }
}
```

## 5. Urutan Implementasi

### Phase A — Kontrak

1. Tambahkan konstanta, generator opsi, dan validator count pada contract.
2. Tambahkan test matriks jumlah pilar dan batas 30.
3. Verifikasi pemerataan `buildDistributionPlan()` termasuk dengan history offset.

### Phase B — UI

1. Pisahkan state Product Campaign dan Brand Editorial.
2. Buat dropdown dinamis berdasarkan jumlah pilar.
3. Pertahankan multiplier ketika pilar atau Brand Profile berubah.
4. Clamp multiplier dan tampilkan notice bila melewati 30.
5. Nonaktifkan dropdown saat belum ada pilar.
6. Tampilkan Balanced sebagai mode distribusi yang benar-benar aktif.

### Phase C — Engine dan Gemini

1. Validasi count saat draft dibuat.
2. Validasi ulang saat draft dieksekusi.
3. Pastikan status tidak berubah menjadi `generating` sebelum validasi lulus.
4. Tambahkan jumlah pilar/ide per pilar pada prompt Gemini.
5. Pertahankan exact output normalization.

### Phase D — Verifikasi dan rilis

1. Jalankan test count baru dan regression test Brand Editorial.
2. Jalankan build Next.js.
3. Rilis patch dan sinkronkan `local-staging`, `main`, serta tag.
4. Deploy Node 2 dengan single-pass deployment.
5. Smoke test UI menggunakan beberapa jumlah pilar tanpa menjalankan AI.
6. Jalankan satu planner Brand Editorial kecil yang disetujui untuk memverifikasi payload Gemini dan distribusi output.

## 6. Acceptance Criteria

- Product Campaign tetap menawarkan `6,12,18,24,30` berbasis CEP.
- Brand Editorial menampilkan seluruh kelipatan jumlah pilar yang tidak melebihi 30.
- Label menunjukkan total dan jumlah ide per pilar.
- Default Brand Editorial adalah dua ide per pilar.
- Mengubah jumlah pilar mempertahankan multiplier bila valid dan melakukan clamp bila perlu.
- Tidak ada pilihan ketika pilar kosong.
- Request manual dengan count tidak valid ditolak backend.
- Setiap pilar muncul tepat `rows_per_pillar` kali pada skeleton.
- Prompt Gemini memuat total, jumlah pilar, dan jumlah ide per pilar.
- Output akhir selalu memiliki jumlah baris sesuai `planner_count`.
- Product Campaign dan planner lama yang valid tidak mengalami regresi.

## 7. Rollback

- Tidak ada perubahan schema; rollback cukup mengembalikan UI, contract, dan engine ke versi sebelumnya.
- Nilai `planner_count` yang sudah tersimpan tetap kompatibel karena tipenya tidak berubah.
- Planner Brand Editorial baru yang count-nya bukan kelipatan enam tetap dapat dipertahankan; jika rollback dilakukan, hindari mengeksekusi planner tersebut melalui engine lama sampai fitur dipulihkan.

## Execution Task List

- [x] Tambahkan konstanta dan generator opsi dynamic planner count.
- [x] Tambahkan validator Product Campaign dan Brand Editorial.
- [x] Tambahkan regression test matriks pillar/count/batas 30.
- [x] Pisahkan state count Product Campaign dan Brand Editorial di modal.
- [x] Implementasikan dropdown Brand Editorial berbasis ide per pilar.
- [x] Implementasikan persist multiplier dan clamp saat pilar berubah.
- [x] Nonaktifkan count saat pilar kosong dan tampilkan notice yang jelas.
- [x] Batasi mode distribusi Brand Editorial ke Balanced yang aktif.
- [x] Validasi count saat create draft dan execute planner.
- [x] Pastikan validasi execute berjalan sebelum status `generating`.
- [x] Tambahkan instruksi distribusi pilar pada prompt Gemini.
- [x] Jalankan test count, regression Brand Editorial, dan build.
- [ ] Rilis patch dan sinkronkan `local-staging`, `main`, serta tag.
- [ ] Deploy Node 2 dengan single-pass deployment.
- [ ] Smoke test UI beberapa variasi jumlah pilar.
- [ ] Jalankan satu planner kecil untuk verifikasi integrasi Gemini setelah persetujuan biaya eksekusi.
