# Implementation Plan — Operator OPC Terstruktur, Wardrobe Sequence, Review Markdown, dan Preset

## 1. Tujuan

Menyelaraskan MAKNA Content Operator dengan empat accordion konfigurasi OPC di UI, memperbaiki perilaku wardrobe `sequential`, dan menyediakan review storyboard berbasis artefak Markdown agar Codex tidak perlu menyalin storyboard lengkap ke percakapan sebelum approval.

Hasil yang dituju:

1. Request Operator memakai schema OPC yang eksplisit, tervalidasi, dan identik dengan field UI.
2. `wardrobe_style=sequential` benar-benar merotasi preset pakaian secara deterministik antar-item planner.
3. Saat job mencapai `awaiting_approval`, web app otomatis membuat snapshot Markdown khusus review tanpa memulai produksi atau sinkronisasi aset final.
4. Status Operator hanya mengembalikan ringkasan singkat, URL review, checksum/revisi, dan status approval.
5. Codex memberikan tautan `.md` kepada pengguna; isi lengkap hanya ditampilkan bila pengguna memintanya.
6. Preset tenant, misalnya `Nutribake Editorial`, ditambahkan setelah schema dan sequence tervalidasi.

## 2. Hasil Analisis

### 2.1 Empat accordion OPC yang sebenarnya

Konfigurasi di `ImportPlannerModal` terdiri dari:

1. **Basic Creative Strategy & Planner Master**
2. **Aesthetics & Visual Engine Settings**
3. **Product Bridging Settings**
4. **Visual Swap Overrides**

Operator API sekarang memakai satu object `production` yang diteruskan secara longgar ke ingest OPC. Hanya beberapa field umum yang divalidasi. Enum, kombinasi model/durasi, bentuk VSO, serta nilai empat accordion belum mempunyai kontrak formal.

### 2.2 Wardrobe `sequential`

UI sudah menyediakan:

```jsx
<option value="random">🎲 Random (Acak)</option>
<option value="sequential">🔄 Sequential (Urut per baris)</option>
```

Namun worker saat ini hanya menangani:

```js
if (rowWardrobeColor) {
  // override eksplisit dari baris
} else if (rowVsoData.wardrobe_style === 'random') {
  const selectedPresetKey = keys[job.row_index % keys.length];
  // ubah menjadi custom wardrobe
}
```

Tidak ada cabang `sequential`. Bahkan implementasi bernama `random` sekarang memakai modulo indeks sehingga hasilnya deterministik/berurutan, bukan acak. Jika nilai `sequential` dibiarkan, lookup preset tidak menemukannya dan dapat jatuh ke fallback generik `modest clothing`.

Keputusan:

- `sequential`: rotasi deterministik berdasarkan urutan item campaign, bukan ID database dan bukan urutan klip.
- `random`: pilih preset secara pseudo-random yang stabil menggunakan hash `campaign_id:item_id`; retry item tidak mengganti pakaian.
- Override warna pada baris planner tetap memiliki prioritas tertinggi.
- Rotasi dibatasi pada katalog wardrobe yang kompatibel dengan `subject_demographic` agar preset pria, wanita syar'i, 3D, dan duo tidak tercampur.
- Satu item/video memakai satu wardrobe yang konsisten untuk semua klipnya. Warna berbeda diterapkan antar-item/content plan, bukan antar-klip, untuk menjaga kontinuitas karakter.
- Preset terpilih disimpan pada item/result sebagai `resolved_visual_overrides`, sehingga storyboard, T2I, I2V, retry, dan audit memakai nilai yang sama.

Urutan prioritas:

```text
row wardrobe override
  > resolved_visual_overrides existing (retry)
  > sequential/random resolver
  > wardrobe preset eksplisit
  > fallback demografi
```

### 2.3 Review Markdown dan pemakaian token Codex

Menampilkan storyboard lengkap di chat memang memakai token input/output dan memperbesar konteks percakapan. Mengunggah `.md` lalu meminta Codex membaca dan menyalin seluruh isinya juga tetap boros; perpindahan format tidak menghilangkan token jika kontennya tetap dimasukkan ke chat/model.

Desain hemat token:

1. Web app membangun Markdown saat seluruh item mencapai `ready_for_review`.
2. Markdown disimpan sebagai **review artifact**, terpisah dari upload aset final.
3. Operator API mengembalikan metadata kecil:
   - `review_url`
   - `review_revision`
   - `review_sha256`
   - jumlah item/klip
   - judul/hook singkat per item
   - warning validasi
4. Codex hanya menampilkan ringkasan dan tautan, bukan isi lengkap.
5. Pengguna membaca `.md` di browser/Nextcloud, lalu menyetujui revisi tersebut.
6. Approval harus menyertakan `review_revision` atau checksum. Jika storyboard berubah, API menolak approval lama dengan `409 REVIEW_REVISION_MISMATCH`.

Catatan: endpoint export Markdown OPC saat ini tidak cocok untuk review otomatis karena selain membuat Markdown, endpoint tersebut juga memanggil sinkronisasi aset dan dapat membuat/mengisi spreadsheet. Generator Markdown-nya dapat dipakai ulang, tetapi alur review harus menjadi fungsi/endpoint terpisah tanpa side effect produksi.

### 2.4 Preset

Preset baru ditambahkan setelah schema Operator stabil. Preset menyimpan konfigurasi empat accordion, bukan pilar atau instruksi kampanye. Pilar, jumlah planner, dan instruksi khusus tetap berada di request agar setiap kampanye fleksibel.

Preset harus tenant-scoped, versioned, dan dapat dioverride per request:

```text
defaults global
  < tenant preset
  < request override
```

Preset awal `nutribake_editorial_v1`:

- brand editorial, tanpa product bridging
- Brand Profile Nutribake direferensikan dengan ID/slug tenant, bukan nama bebas
- target demographic `ibu_rumah_tangga`
- VSO aktif, `subject_demographic=syari_classic`
- `wardrobe_style=sequential`
- field lain memakai nilai yang memang tersedia di UI/kontrak OPC

## 3. Desain Kontrak Operator

Request tetap kompatibel dengan struktur `planner`, `selection`, dan `production`, tetapi `production` dinormalisasi menjadi empat group eksplisit:

```json
{
  "planner": {
    "planner_focus": "brand_editorial",
    "planner_count": 7,
    "pillars": [],
    "platform": "tiktok"
  },
  "selection": { "mode": "all" },
  "opc": {
    "preset": "nutribake_editorial_v1",
    "basic_strategy": {},
    "visual_engine": {},
    "product_bridging": {},
    "visual_swap": {},
    "workflow": {}
  }
}
```

Untuk kompatibilitas, payload lama `production` diterima selama masa transisi dan dinormalisasi ke `opc`. Response mencantumkan `contract_version` dan warning deprecation.

Validasi utama:

- enum narrative, demographic, provider, bahasa, visual style/mode, model, face visibility, words-per-clip, aspect ratio, dan VSO;
- `clip_duration=10` hanya valid untuk `omni_flash`;
- bridging editorial tanpa produk eksplisit ditolak;
- VSO wardrobe harus kompatibel dengan demografi;
- `enable_social_post=true` tetap ditolak;
- approval mode hanya `storyboard` atau `none` sesuai guardrail API v1.

## 4. Alur Review dan Approval

```text
Create job
  → Content Planner
  → OPC storyboard ready
  → resolve wardrobe per item
  → build immutable review Markdown snapshot
  → awaiting_approval + review URL/revision/checksum
  → pengguna membaca file
  → approve(job, revision/checksum)
  → TTS → G-Labs → FFmpeg → upload final
```

Review Markdown memuat:

- identitas campaign dan konfigurasi efektif empat accordion;
- pilar, hook, content subject, dan narrative mode per item;
- storyboard, VO, T2V/T2I/I2V prompt;
- resolved wardrobe dan VSO per item;
- caption/CTA/hashtag;
- warning validator;
- revision, waktu pembuatan, dan SHA-256.

Tidak ada secret, API key, path internal sensitif, atau raw log di artefak.

## 5. Perubahan File dan Before/After Code

### 5.1 `lib/operator-content-contract.js`

**Code Sebelum (Current/Before)**

```js
return {
  planner: normalizePlanner(input.planner || {}),
  selection: normalizeSelection(input.selection || {}),
  production: normalizeProduction(input.production || {})
};
```

**Code Sesudah (Proposed/After)**

```js
const opc = normalizeOpcConfig(input.opc || migrateLegacyProduction(input.production));
return {
  contract_version: '2',
  planner: normalizePlanner(input.planner || {}),
  selection: normalizeSelection(input.selection || {}),
  opc,
  production: flattenOpcForIngest(opc)
};
```

Tambahkan validator per accordion dan validator lintas-field.

### 5.2 `lib/operator-presets.js` (baru)

**Code Sebelum (Current/Before)**

```js
// Belum ada registry/resolver preset Operator OPC.
```

**Code Sesudah (Proposed/After)**

```js
export async function resolveOperatorPreset(tenantId, presetKey, overrides) {
  const preset = await getTenantPreset(tenantId, presetKey);
  return deepMerge(defaultOpcConfig(), preset.config, overrides);
}
```

Resolver memvalidasi versi schema, kepemilikan tenant, Brand Profile, dan tidak mengizinkan preset mengaktifkan social posting.

### 5.3 `lib/visual-override-resolver.js` (baru)

**Code Sebelum (Current/Before)**

```js
// Resolusi random berada inline dan sequential belum diimplementasikan.
```

**Code Sesudah (Proposed/After)**

```js
export function resolveWardrobe({ mode, subjectDemographic, itemIndex, stableSeed, rowOverride }) {
  const catalog = getCompatibleWardrobes(subjectDemographic);
  if (rowOverride) return resolveExplicitWardrobe(rowOverride, catalog);
  if (mode === 'sequential') return catalog[itemIndex % catalog.length];
  if (mode === 'random') return catalog[stableHash(stableSeed) % catalog.length];
  return resolveExplicitWardrobe(mode, catalog);
}
```

Tambahkan unit test untuk rotasi, kestabilan retry, kompatibilitas demografi, dan prioritas row override.

### 5.4 `lib/sheets-autopilot-worker.js`

**Code Sebelum (Current/Before)**

```js
} else if (rowVsoData && rowVsoData.wardrobe_style === 'random') {
  const selectedPresetKey = keys[job.row_index % keys.length];
  rowVsoData.wardrobe_style = 'custom';
  rowVsoData.wardrobe_style_custom = WARDROBE_PRESETS[selectedPresetKey];
}
```

**Code Sesudah (Proposed/After)**

```js
const resolvedVso = resolveVisualOverrides({
  campaign,
  item: job,
  itemIndex: job.row_index - 2,
  rowWardrobeColor
});
await persistResolvedVisualOverrides(job.id, resolvedVso);
```

Gunakan resolver yang sama pada storyboard generation dan G-Labs agar tidak terjadi perbedaan pakaian antar-tahap.

### 5.5 `lib/export-builder.js`

**Code Sebelum (Current/Before)**

```js
export function buildPillarBatchMarkdownContent(campaign, items) {
  // export campaign untuk storage/sync
}
```

**Code Sesudah (Proposed/After)**

```js
export function buildPillarReviewMarkdown({ campaign, items, revision, checksum }) {
  // Snapshot review lengkap, deterministic, tanpa side effect.
}
```

Builder export lama dipertahankan. Builder review baru mempunyai urutan field stabil agar checksum konsisten.

### 5.6 `lib/operator-review-artifact.js` (baru)

**Code Sebelum (Current/Before)**

```js
// Belum ada lifecycle artefak review Operator.
```

**Code Sesudah (Proposed/After)**

```js
export async function ensureOperatorReviewArtifact(job, campaign, items) {
  const sourceHash = hashReviewSource(campaign, items);
  const markdown = buildPillarReviewMarkdown({ campaign, items, revision, sourceHash });
  return saveImmutableReviewArtifact({ job, markdown, sourceHash });
}
```

Artefak dapat disimpan ke Nextcloud review folder atau endpoint download terautentikasi. Kegagalan upload tidak boleh memulai produksi; job tetap review-pending dengan error yang jelas dan dapat di-retry.

### 5.7 `lib/operator-content-worker.js`

**Code Sebelum (Current/Before)**

```js
if (items.some(item => item.workflow_status === 'ready_for_review')) return 'approval';
```

```js
return {
  id: item.id,
  workflow_status: item.workflow_status,
  caption: result.tiktok_caption || result.ig_caption || result.caption || null
};
```

**Code Sesudah (Proposed/After)**

```js
if (readyItems.length) {
  const review = await ensureOperatorReviewArtifact(job, campaign, items);
  await updateOperatorJob(job.id, {
    status: 'awaiting_approval',
    review_url: review.url,
    review_revision: review.revision,
    review_sha256: review.sha256
  });
}
```

Status item hanya membawa ringkasan pendek; `result_json` lengkap tidak dikirim pada endpoint status.

### 5.8 `app/api/operator/v1/content-jobs/[jobId]/route.js`

**Code Sebelum (Current/Before)**

```js
return NextResponse.json({ success: true, job: publicJob });
```

**Code Sesudah (Proposed/After)**

```js
return NextResponse.json({
  success: true,
  job: {
    ...publicJob,
    review: sanitizeReviewMetadata(publicJob.review),
    items: publicJob.items.map(toCompactReviewSummary)
  }
});
```

Tambahkan `detail=full` hanya bila benar-benar diperlukan dan tetap terlindungi scope `content:read`.

### 5.9 `app/api/operator/v1/content-jobs/[jobId]/review/route.js` (baru)

**Code Sebelum (Current/Before)**

```js
// Belum ada endpoint review artifact khusus Operator.
```

**Code Sesudah (Proposed/After)**

```js
export async function GET(request, { params }) {
  const identity = await authenticateOperator(request, 'content:read');
  return runAsOperatorTenant(identity, () => streamReviewMarkdown(params.jobId));
}
```

Endpoint memakai `Content-Type: text/markdown`, `Content-Disposition: inline`, `Cache-Control: no-store`, tenant isolation, dan tidak mengandung token pada URL.

### 5.10 `app/api/operator/v1/content-jobs/[jobId]/approve/route.js`

**Code Sebelum (Current/Before)**

```js
const approval = normalizeOperatorApproval(await request.json());
```

**Code Sesudah (Proposed/After)**

```js
const approval = normalizeOperatorApproval(await request.json());
assertReviewRevision(job, approval.review_revision, approval.review_sha256);
```

Approval tanpa revisi hanya diizinkan sementara untuk client v1 dengan warning; setelah masa transisi menjadi wajib.

### 5.11 `plugins/makna-content-operator/scripts/makna-content-operator.mjs`

**Code Sebelum (Current/Before)**

```js
console.log(`${job.id} | ${job.status} | ${job.current_stage}`);
```

**Code Sesudah (Proposed/After)**

```js
printCompactJob(job);
if (job.review) console.log(`Review: ${job.review.url} | revision=${job.review.revision}`);
```

Tambahkan:

```bash
makna-content-operator review <job-id> [--save <file>]
makna-content-operator approve <job-id> --revision <revision> --all
makna-content-operator presets
```

Perintah `review` secara default hanya mencetak URL/metadata. `--save` mengunduh file lokal tanpa mencetak isi ke terminal/chat.

### 5.12 `plugins/makna-content-operator/skills/content-operator/SKILL.md`

**Code Sebelum (Current/Before)**

```md
If status is awaiting_approval, summarize the storyboard/result.
```

**Code Sesudah (Proposed/After)**

```md
If status is awaiting_approval, show the compact summary and review Markdown link.
Do not reproduce the full storyboard unless the user explicitly requests it.
Approve only the exact review revision explicitly approved by the user.
```

### 5.13 Database migration (`lib/db-pg.js` / schema Operator)

**Code Sebelum (Current/Before)**

```sql
-- operator_jobs belum menyimpan review revision/checksum/url.
-- belum ada tenant-scoped OPC presets.
```

**Code Sesudah (Proposed/After)**

```sql
ALTER TABLE operator_jobs
  ADD COLUMN IF NOT EXISTS contract_version TEXT DEFAULT '1',
  ADD COLUMN IF NOT EXISTS review_revision INTEGER,
  ADD COLUMN IF NOT EXISTS review_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS review_url TEXT,
  ADD COLUMN IF NOT EXISTS review_source_hash TEXT;

CREATE TABLE IF NOT EXISTS operator_opc_presets (
  tenant_id TEXT NOT NULL,
  preset_key TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  config_json JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (tenant_id, preset_key)
);
```

Resolved VSO disimpan pada item menggunakan kolom JSON yang sesuai; jika kolom khusus diperlukan, migrasi dibuat idempotent.

## 6. Strategi Kompatibilitas

- Request lama `production` tetap berjalan dan diberi warning deprecation.
- Preset opsional; request tanpa preset memakai default saat ini.
- UI tetap mengirim field existing selama adaptor kontrak belum dipakai UI.
- Export Markdown existing tidak diubah perilakunya; review artifact memakai jalur baru.
- Job existing tanpa review revision tetap dapat dibaca.
- Approval lama diberi masa transisi, tetapi plugin baru selalu mengirim revision/checksum.

## 7. Pengujian dan Kriteria Penerimaan

### Unit

- seluruh enum accordion diterima/ditolak sesuai pilihan UI;
- `omni_flash + 10s` valid, model lain + 10s ditolak;
- sequence menghasilkan warna berbeda dan berulang setelah katalog habis;
- retry menghasilkan wardrobe identik;
- random stabil namun tidak mengikuti pola sequence;
- katalog wardrobe sesuai demografi;
- checksum Markdown stabil untuk data sama dan berubah jika storyboard berubah;
- preset merge tidak mengaktifkan social posting.

### Integrasi

- buat job Nutribake 7 pilar dengan preset editorial;
- semua item memiliki resolved wardrobe berbeda sesuai sequence;
- job berhenti di `awaiting_approval` sebelum TTS;
- endpoint status berukuran ringkas dan tidak membawa prompt/storyboard penuh;
- review URL membuka Markdown lengkap;
- tidak ada video/aset final yang disinkronkan saat review dibuat;
- approval revisi benar melanjutkan produksi;
- approval revisi lama ditolak `409`;
- TTS, G-Labs, FFmpeg, dan upload final tetap berjalan setelah approval.

### Target efisiensi token

- respons status review maksimal berisi metadata dan ringkasan satu baris per item;
- Codex tidak membaca isi `.md` kecuali diminta;
- prompt operasional berikutnya cukup menyebut preset, pilar, jumlah ide, dan instruksi khusus;
- ukur perbandingan ukuran payload status sebelum/sesudah dan tetapkan batas regresi.

## 8. Execution Task List

- [x] Dokumentasikan schema empat accordion dan matriks enum/kompatibilitas dari UI OPC.
- [x] Gunakan review revision/checksum dinamis dan resolved VSO di result agar tidak membutuhkan migrasi state review baru.
- [x] Implementasikan resolver wardrobe kompatibel untuk explicit, sequential, dan stable-random.
- [x] Ganti logika wardrobe inline pada generator OPC dan G-Labs dengan resolver bersama.
- [x] Tambahkan unit test resolver wardrobe dan verifikasi konsistensi retry.
- [x] Implementasikan kontrak Operator v2 serta adaptor payload `production` lama.
- [x] Tambahkan validasi lintas-field dan error code yang dapat ditindaklanjuti.
- [x] Implementasikan builder Markdown review deterministic tanpa side effect.
- [x] Implementasikan streaming artefak review tenant-scoped melalui endpoint terautentikasi.
- [x] Integrasikan metadata review ke status worker saat `awaiting_approval`.
- [x] Ringkaskan response status Operator dan tambahkan metadata review.
- [x] Ikat approval ke revision/checksum artefak review.
- [x] Tambahkan perintah CLI `review`, approval revision, dan daftar preset.
- [x] Perbarui skill plugin agar default-nya link-first dan hemat token.
- [x] Tambahkan preset built-in `nutribake_editorial_v1` setelah seluruh validator lulus.
- [x] Jalankan unit, integration contract, build, dan smoke review job staging existing.
- [x] Verifikasi job tetap `awaiting_approval` dan review tidak memulai produksi.
- [x] Jalankan SOP release patch, push `main`, push tag, dan verifikasi remote.

## 9. Keputusan Produk yang Direkomendasikan

1. Gunakan `sequential` untuk Nutribake agar warna pakaian berbeda secara terprediksi antar-konten.
2. Pertahankan wardrobe konsisten di seluruh klip dalam satu video.
3. Gunakan review Markdown sebagai default; chat hanya menampilkan ringkasan dan tautan.
4. Jangan memakai endpoint export/sync final untuk membuat review.
5. Wajibkan approval revision/checksum untuk mencegah race condition atau approval terhadap storyboard lama.
6. Tambahkan preset hanya sesudah kontrak v2 dan resolver sequence selesai, agar preset tidak membakukan bug yang ada.
