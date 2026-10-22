# Implementation Plan — ContentFlow Studio: Wizard dengan Paritas Konfigurasi

Status: **rencana, belum dieksekusi**. Tanggal: 22 Oktober 2026.
Baseline audit: commit `9ad39ea`, versi aplikasi `2.32.72`. Verifikasi ulang HEAD dan perubahan pengguna saat eksekusi dimulai.

Referensi: `../wizard-configuration-analysis.md` dan `public/mockup_contentflow_studio_wizard.html`.

## Tujuan dan definisi selesai

Semua konfigurasi yang tersedia di menu asal dapat dibuat melalui wizard ContentFlow Studio dengan default, opsi, dependency, preset, unggahan, validasi, dan payload engine yang sama. Sumber kebenaran adalah **form menu asli yang telah berjalan**, bukan komponen Studio ringkas maupun data demo mockup.

Menu asal dan Studio memakai section serta controller konfigurasi bersama. Perbedaannya berada pada presentasi (accordion/form vs wizard) dan orkestrasi (direct submit vs capture untuk penjadwalan). Jadwal, idempotency, pemetaan slot, dan approval merupakan metadata Studio, bukan perubahan arti konfigurasi engine.

Pekerjaan ini mencakup refaktor form asal, wizard Studio, kontrak hasil dan adapter yang diperlukan untuk mempertahankan semua kemampuan konfigurasi. Tidak membuat engine campaign baru, Bank Ide, atau mekanisme publishing kedua.

## Keputusan desain

1. Campaign-first: Pillar, RE, Multiplier, Recipe. Planner hanya pada Pillar, termasuk fokus Brand Editorial/Product Campaign/Recipe Campaign.
2. Planner baru untuk batch ini; consumed atomik saat batch berhasil disimpan sesuai transaksi existing. Membuat atau mereview Planner tidak mengonsumsi Planner. Retry tidak membuat konsumsi/campaign ganda.
3. Ekstrak JSX/controller dari menu asal ke komponen bersama secara bertahap per engine. Jangan membangun ulang field dari JSON inventaris mockup; inventaris dipakai sebagai checklist audit saja.
4. Empat form `campaign-forms` yang sudah ada direkonsiliasi dengan sumber asli; tambah komponen Pillar untuk memisahkan isi form dari modal. API pemanggilan menu lama dipertahankan melalui wrapper.
5. Kontrak konfigurasi per engine bersifat pure: default, normalisasi, validasi, serialisasi, metadata section. UI controller mengurus katalog, state, preset, brand hydration dan unggahan. Import database/secret/provider server tidak boleh masuk bundle client.
6. State konfigurasi ada pada sesi wizard; perpindahan step tidak me-reset nilai atau memicu submit. Penggantian jenis campaign setelah ada isian meminta konfirmasi kehilangan draft. Perubahan mode mengikuti aturan reset asli, dan membatalkan manifest/jadwal turunan yang sudah tidak cocok.
7. Sidebar step hanya membuka langkah yang prasyaratnya valid. Tombol Lanjut memvalidasi bagian aktif, Review/Save memvalidasi seluruh konfigurasi. Error menunjukkan langkah dan field; akses keyboard, label dan fokus harus bekerja.
8. Tombol eksplisit Generate Planner, Generate Angle, atau ekstraksi URL tetap boleh menjalankan operasi asli setelah validasi. Klik Lanjut/Kembali, membuka section atau mengganti layout tidak menjalankan produksi campaign.
9. Konfigurasi sosial pengguna disimpan sebagai niat konfigurasi; dispatch Studio tetap menonaktifkan direct social posting. Review/approval Studio mengatur seluruh tayangan. Jelaskan perilakunya di UI; jangan menyembunyikan perubahan ini di payload.
10. Tidak menambah fitur workflow pada Multiplier yang tidak dimiliki form asal. Recipe Static dan Reels Video Storyboard tetap berbeda; storyboard tanpa video final tetap `needs_review`, bukan `ready`.
11. Semua CSS baru menggunakan semantic tokens `app/theme.css`. Theme pusat, model video, batas kata dan koordinat layout dipakai langsung, tanpa salinan konstanta di komponen baru.
12. Mockup adalah acuan alur dan tata letak. Katalog contoh, contoh preset, simulasi Planner/angle, kalender Oktober tetap, dan navigasi tanpa validasi dari mockup tidak dibawa ke aplikasi produksi.

## Temuan yang harus ditutup lebih dahulu

| Temuan kode saat audit | Pekerjaan wajib |
| --- | --- |
| Menu campaign masih memiliki form inline terpisah dari komponen Studio | Satukan controller, section, dan serializer; hapus duplikasi setelah menu lama lolos regresi |
| Capture RE belum membawa seluruh opsi asli | Lengkapi field dan validator: mode eksekusi, angle multiplier, audit, segment, recipe extraction, VSO, workflow/audio, Hybrid Lock |
| Manifest RE menghitung satu hasil per URL | Audit hasil aktual angle multiplier dan mass upload; tentukan pemetaan setiap artefak tayang tanpa kehilangan varian atau menjalankan produksi ganda |
| Manifest Multiplier memakai kontrak rows tertentu | Verifikasi keluaran empat workflow asli, termasuk editorial/pure storytelling dan angle; jangan memaksa bentuk produk pada jalur non-produk |
| Manifest Recipe menetapkan batas Studio sendiri | Bandingkan batas Recipe Labs yang sebenarnya pada UI/API; gunakan kontrak engine tersebut. Jangan menyamakan batas Recipe Labs dengan Recipe Planner |
| Route batch menerima `productRefImage` hanya untuk RE | Dukung unggahan yang memang ada pada jalur lain dengan validasi dan referensi aset yang tahan sampai jadwal eksekusi |
| API dapat menerima payload tanpa melalui wizard | Validasi lengkap di server, tenant ownership, dan rekonstruksi manifest wajib; jangan mengandalkan validasi UI |

**Gate tahap 02:** matriks input → invocation engine → item/varian → artefak akhir → slot harus terbukti untuk setiap mode. Jika satu invocation menghasilkan beberapa output, gunakan identitas invocation bersama dan mapping child/varian yang stabil. Lock/idempotency mengikuti invocation, sementara jadwal/approval mengikuti artefak. Jangan menggandakan N URL × N angle secara tidak sengaja dengan menjalankan multiplier lagi pada setiap slot.

Periksa apakah snapshot dan kolom existing cukup. Target awal tanpa perubahan DDL. Jika hasil audit membuktikan perlunya relasi invocation/varian baru, tambahkan desain dan migrasi konkret beserta before/after ke rencana ini sebelum mengimplementasikannya. Jangan mengorbankan paritas dengan menonaktifkan mode atau mengubah definisi slot secara diam-diam.

## Urutan pengerjaan dan hasil per tahap

### Tahap 01 — Baseline dan matriks paritas

- Periksa Git status, instruksi repo dan panduan Next.js lokal terkait Client Components, forms serta Route Handlers. Catat versi/panduan yang berlaku.
- Lengkapi matriks field: source file/section, nama state, payload key, tipe/default, opsi, required/conditional, preset, sumber katalog, error dan side effect.
- Pisahkan kemampuan form dari kontrol halaman (history, global scheduler, log, administrasi). Kontrol halaman bukan bagian wizard konfigurasi.
- Rekam fixture payload asli secara terkontrol, tanpa credential/data tenant asli. Daftar gap Studio harus eksplisit.
- Hasil: `parity-matrix.md` dan daftar fixture per engine, sebagai pembanding setiap tahap.

### Tahap 02 — Kontrak input, output dan aset

- Audit serializer direct, endpoint asli, submit service, fan-out dan status hasil untuk seluruh cabang.
- Tetapkan pure contract lima jalur (Planner, Pillar, RE, Multiplier, Recipe), kompatibel dengan nama/format payload asli termasuk multipart dan preset versi existing.
- Definisikan invocation/output keys deterministik untuk mass RE, angle multiplier, kombinasi Multiplier, Recipe banyak hasil dan Pillar rows. Simpan metadata varian tanpa memakai index yang berubah ketika sumber diedit.
- Selaraskan manifest client/server, ownership validation dan lifecycle unggahan. File tidak disimpan sebagai objek JSON. Tidak mempercayai path arbitrer atau file tenant lain.
- Unggahan bertahan pada shared runtime sampai produksi selesai/retry; cleanup hanya aset yatim yang terbukti tidak dirujuk. Payload idempotency menggunakan representasi aset deterministik.
- Hasil: kontrak disepakati dalam kode/tests; gap cardinality dan lampiran tertutup sebelum wizard dihubungkan.

### Tahap 03 — Planner dan Pillar

- Pindahkan konfigurasi Generator Content Planner asli ke form bersama: tiga fokus, brand hydration, pilar/distribusi/count, world/universe, sumber produk, recipe strategy dan seluruh validasi.
- Pindahkan isi `ImportPlannerModal` ke `PillarConfigurationForm`; modal tetap wrapper kompatibel untuk menu Pillar lama.
- Controller Pillar dipakai modal dan wizard. Studio menggunakan Planner hasil sesi ini; menu Pillar lama mempertahankan alurnya dengan single-use guard existing.
- Pisahkan konfigurasi, aksi Generate Planner dan Review Planner. Cegah race saat mengganti input/Planner; referensi hasil lama tidak boleh diam-diam dipakai.
- Hasil: direct dan Studio menghasilkan konfigurasi Pillar setara, konsumsi satu kali tetap atomik.

### Tahap 04 — RE

- Ekstrak seluruh bagian asli, termasuk Single/Mass, parser CSV/XLSX, preset/role, Full Auto Pilot/Manual Review, seluruh section dan validasi Hybrid Lock.
- Pertahankan perubahan dependency asli: autopilot mengunci pure T2V/tahapan sesuai menu; perubahan model/durasi menyesuaikan batas kata; bridging dan VSO mengikuti mode.
- Capture memuat seluruh field tanpa hardcode `full_autopilot`. Mass upload mempertahankan override per baris sesuai kontrak asli.
- Verifikasi mapping angle/source/output dari tahap 02 dan perilaku review intermediate pada Manual Review.
- Hasil: opsi RE tidak lagi terpotong saat masuk Studio.

### Tahap 05 — Multiplier

- Ekstrak empat workflow, katalog blueprint, filter niche, pencarian produk, input manual/URL/mass URL, KB, generator angle/topik, pilihan angle/outro, kombinasi dan preset.
- Pertahankan jumlah pilihan blueprint/produk sesuai workflow; setiap perubahan sumber membatalkan kombinasi lama yang tidak valid.
- Ekstrak section strategi, visual, bridging dan identitas yang benar-benar tersedia pada menu asli; pertahankan konfigurasi tingkat baris/shared.
- Hasil: rows capture memiliki arti sama dengan submit menu asal, termasuk jalur non-produk dan gambar acuan.

### Tahap 06 — Recipe

- Ekstrak dua cabang asli. Static: sumber deconstruct, kategori/custom, count, fotografi, toggle image generation, 3–6 gambar, preset layout/koordinat, gap/radius/padding/background, demografi dan brand.
- Video Storyboard: hook/pilar/instruction, visual/model, bridging/produk, VSO, workflow/TTS/FFmpeg/social sesuai form dan endpoint asli.
- Jangan menyalin batas recipe planner ke Recipe Labs; uji batas setiap kontrak secara terpisah.
- Hasil: wizard menyesuaikan cabang; tidak menjanjikan video final dari storyboard saja.

### Tahap 07 — Wizard shell dan integrasi Studio

- Bangun shell stepper, heading, progress, section aktif, footer dan error summary; responsif Light/Dark dan keyboard.
- Urutan mengikuti mockup, dengan section canonical sebagai isinya. Tidak membuka modal Pillar terpisah di tengah wizard.
- Hubungkan controlled draft, loading/error katalog, apply preset, manual data editing, Back/Next, cancel dan retry operasi persiapan.
- Schedule step menampilkan semua output, timezone, akun dan bulk-set jadwal dengan override per output. Simpan jadwal berdasarkan output key, bukan posisi list.
- Review menampilkan konfigurasi efektif, input/sumber, jumlah hasil, mode produksi, jadwal per output dan approval requirement. Tombol edit kembali ke section terkait.
- Pertahankan helper idempotency yang kompatibel HTTP staging. Disable hanya ketika memang invalid/busy, dengan alasan yang terlihat.

### Tahap 08 — Penyimpanan, dispatch dan approval

- Validasi ulang konfigurasi server, rekonstruksi manifest, cek kepemilikan katalog/aset/Planner, jadwal, akun dan idempotency.
- Simpan konfigurasi tanpa kehilangan nested/shared/per-row override; transaksi konsumsi Planner tidak boleh bocor saat request gagal.
- Aset pada batch tersedia untuk worker dan retry setelah restart/deployment. Dispatch menghormati invocation mapping tahap 02 dan menonaktifkan direct social publishing di seluruh nesting.
- Pertahankan Future slots, atomic claim, status production/publishing, approval revision hash dan final-media readiness existing.
- Hasil: Simpan Batch menghasilkan draft, Generate Content mengaktifkan produksi sesuai jadwal, publikasi tetap setelah approval.

### Tahap 09 — Verifikasi

- Uji paritas payload menu asal vs capture dengan fixture beragam, bukan snapshot JSX atau test yang sekadar mencocokkan nama field.
- Uji dependency/preset, parser mass dan override, all-four Multiplier, output cardinality RE angles, Recipe branches/count, Planner focus dan count.
- Uji jalur API yang melewati UI: payload invalid, cross-tenant asset/ID, upload invalid, double-submit, konflik idempotency, source berubah, worker retry/restart dan future slot.
- Uji consumed Planner bersamaan serta rollback transaksi pada schema test terisolasi. Jangan memakai data tenant staging/production untuk fixture.
- Jalankan regresi Studio/Planner/Recipe/approval yang relevan dan production build; catat kegagalan baseline tanpa mengubah expectation hanya agar hijau.
- Review visual/fungsi oleh pengguna pada aplikasi Dev: empat campaign, kembali/lanjut, perubahan mode, preset, upload, error, mobile, Light/Dark dan HTTP. Tidak perlu suite browser berlebihan.
- AI berbayar/publishing nyata bukan bagian tes otomatis; gunakan stub/fixture atau run terkontrol yang memang diperlukan dan diotorisasi.

### Tahap 10 — Dokumentasi dan rilis

- Perbarui SOT: arsitektur shared form, seluruh jalur wizard, batas storyboard, aturan single-use, media lifecycle, idempotency/fan-out dan approval.
- Update execution notes, matriks paritas dan checklist; tandai task selesai hanya setelah verifikasi aktual.
- Ikuti SOP release non-interaktif, selaraskan changelog terbaru, verifikasi main/tag pada remote. Rilis hanya setelah perubahan implementasi terverifikasi; pembuatan rencana ini sendiri tidak memicu rilis.

### Tahap 11 — Deployment Dev lalu Staging

- Gunakan SOT atomic deployment; deploy full SHA yang sudah ada di remote. Dev lebih dahulu, kemudian staging setelah verifikasi Dev.
- Build remote release baru, `DISABLE_AUTO_MIGRATIONS=true`, schema sesuai target dan `PGPOOL_MAX=3`; shared runtime tetap tersambung.
- Verifikasi current/manifest, UI/API, PM2 online/cwd, env target serta ketersediaan aset unggahan lama. Health auth halaman bukan pengganti verifikasi health UI/API.
- Tunggu sesi deployment yang sama tanpa polling SSH loop. Jika health gagal, ikuti rollback atomik; rollback filesystem tidak memulihkan schema.
- Sediakan link manual testing dan catatan release. Deployment Production memerlukan instruksi eksplisit tersendiri.

## Execution Task List

- [x] Tahap 01 — Catat baseline, inventaris field lengkap dan fixture payload asli.
- [x] Tahap 02 — Selesaikan kontrak input/output, cardinality, invocation mapping dan lifecycle aset.
- [x] Tahap 03 — Ekstrak Planner/Pillar dan verifikasi direct/capture serta single-use.
- [x] Tahap 04 — Ekstrak RE lengkap, termasuk mass, mode eksekusi dan angle multiplier.
- [x] Tahap 05 — Ekstrak empat workflow Multiplier dan mapping kombinasi.
- [x] Tahap 06 — Ekstrak Recipe Static/Storyboard dan seluruh dependency.
- [x] Tahap 07 — Implementasikan shell wizard dan hubungkan konfigurasi canonical ke Studio.
- [x] Tahap 08 — Integrasikan validasi server, aset, manifest, dispatch dan approval.
- [x] Tahap 09 — Lulus tes kontrak/integrasi, regresi dan build; aplikasi disiapkan untuk review manual pengguna sesuai SOP.
- [ ] Tahap 10 — Perbarui SOT/notes, rilis dan verifikasi main/tag remote.
- [ ] Tahap 11 — Deploy atomic Dev/Staging dan catat bukti verifikasi.

Saat eksekusi: ubah checkbox masing-masing tahap menjadi `[x]` segera setelah seluruh hasil dan gate tahapnya terpenuhi. Update notes berisi bukti, bukan hanya pernyataan selesai. Semua checkbox tetap kosong pada tahap perencanaan ini.

## File yang dimodifikasi: Code Sebelum / Code Sesudah

Potongan Before di bawah diambil dari baseline. Potongan After menggambarkan antarmuka yang diusulkan, **bukan patch siap tempel**; seluruh field/handler asli harus diekstrak pada tahap engine masing-masing. Nama helper dapat dirapikan saat eksekusi tanpa mengubah kontrak. File tambahan yang kemudian terbukti perlu harus dicatat dengan before/after sebelum diedit.

### `lib/campaign-configuration/planner.js`

Kontrak pure, aman diimpor client/server. Reuse validator/preset existing; jangan menambah default atau opsi baru. Isi section kosong di snippet hanya ilustrasi lokasi, tidak boleh menjadi implementasi final.

**Code Sebelum (Current/Before)**

```js
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```js
export const plannerSections = /* bagian dari form asli */ [];
export function createPlannerDraft(initialValues) { /* default asli */ }
export function validatePlannerDraft(draft, context) { /* aturan asli */ }
export function serializePlannerDraft(draft, context) { /* payload asli */ }
```

### `lib/campaign-configuration/pillar.js`

Kontrak pure, aman diimpor client/server. Reuse validator/preset existing; jangan menambah default atau opsi baru. Isi section kosong di snippet hanya ilustrasi lokasi, tidak boleh menjadi implementasi final.

**Code Sebelum (Current/Before)**

```js
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```js
export const pillarSections = /* bagian dari form asli */ [];
export function createPillarDraft(initialValues) { /* default asli */ }
export function validatePillarDraft(draft, context) { /* aturan asli */ }
export function serializePillarDraft(draft, context) { /* payload asli */ }
```

### `lib/campaign-configuration/re.js`

Kontrak pure, aman diimpor client/server. Reuse validator/preset existing; jangan menambah default atau opsi baru. Isi section kosong di snippet hanya ilustrasi lokasi, tidak boleh menjadi implementasi final.

**Code Sebelum (Current/Before)**

```js
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```js
export const reSections = /* bagian dari form asli */ [];
export function createReDraft(initialValues) { /* default asli */ }
export function validateReDraft(draft, context) { /* aturan asli */ }
export function serializeReDraft(draft, context) { /* payload asli */ }
```

### `lib/campaign-configuration/multiplier.js`

Kontrak pure, aman diimpor client/server. Reuse validator/preset existing; jangan menambah default atau opsi baru. Isi section kosong di snippet hanya ilustrasi lokasi, tidak boleh menjadi implementasi final.

**Code Sebelum (Current/Before)**

```js
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```js
export const multiplierSections = /* bagian dari form asli */ [];
export function createMultiplierDraft(initialValues) { /* default asli */ }
export function validateMultiplierDraft(draft, context) { /* aturan asli */ }
export function serializeMultiplierDraft(draft, context) { /* payload asli */ }
```

### `lib/campaign-configuration/recipe.js`

Kontrak pure, aman diimpor client/server. Reuse validator/preset existing; jangan menambah default atau opsi baru. Isi section kosong di snippet hanya ilustrasi lokasi, tidak boleh menjadi implementasi final.

**Code Sebelum (Current/Before)**

```js
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```js
export const recipeSections = /* bagian dari form asli */ [];
export function createRecipeDraft(initialValues) { /* default asli */ }
export function validateRecipeDraft(draft, context) { /* aturan asli */ }
export function serializeRecipeDraft(draft, context) { /* payload asli */ }
```

### `app/components/campaign-forms/PlannerConfigurationForm.js`

Pertahankan props kompatibilitas yang masih dipakai caller lama; API After disingkat. State controller tidak boleh hilang karena section unmount.

**Code Sebelum (Current/Before)**

```js
export default function PlannerConfigurationForm({
  mode = 'direct', // 'direct' | 'capture'
  initialValues = {},
  onCapture = null,
  onSuccess = null,
  onCancel = null,
  isInline = false
}) {
```

**Code Sesudah (Proposed/After)**

```js
export function usePlannerController(options) {
  // State, katalog, preset dan handler diekstrak dari menu asal.
}
export default function PlannerConfigurationForm({
  mode = 'direct', layout = 'accordion', activeSection,
  draft, onDraftChange, onCapture, onSuccess, onCancel
}) {
  // Section canonical yang sama untuk menu asal dan Studio.
  // Lanjut tidak memanggil direct submit.
}
```

### `app/components/campaign-forms/ReCampaignConfigurationForm.js`

Pertahankan props kompatibilitas yang masih dipakai caller lama; API After disingkat. State controller tidak boleh hilang karena section unmount.

**Code Sebelum (Current/Before)**

```js
export default function ReCampaignConfigurationForm({
  mode = 'direct', // 'direct' | 'capture'
  initialValues = {},
  onCapture = null,
  onSuccess = null,
  onCancel = null,
  isInline = false
}) {
```

**Code Sesudah (Proposed/After)**

```js
export function useReCampaignController(options) {
  // State, katalog, preset dan handler diekstrak dari menu asal.
}
export default function ReCampaignConfigurationForm({
  mode = 'direct', layout = 'accordion', activeSection,
  draft, onDraftChange, onCapture, onSuccess, onCancel
}) {
  // Section canonical yang sama untuk menu asal dan Studio.
  // Lanjut tidak memanggil direct submit.
}
```

### `app/components/campaign-forms/MultiplierConfigurationForm.js`

Pertahankan props kompatibilitas yang masih dipakai caller lama; API After disingkat. State controller tidak boleh hilang karena section unmount.

**Code Sebelum (Current/Before)**

```js
export default function MultiplierConfigurationForm({
  mode = 'direct', // 'direct' | 'capture'
  initialValues = {},
  onCapture = null,
  onSuccess = null,
  onCancel = null,
  isInline = false
}) {
```

**Code Sesudah (Proposed/After)**

```js
export function useMultiplierController(options) {
  // State, katalog, preset dan handler diekstrak dari menu asal.
}
export default function MultiplierConfigurationForm({
  mode = 'direct', layout = 'accordion', activeSection,
  draft, onDraftChange, onCapture, onSuccess, onCancel
}) {
  // Section canonical yang sama untuk menu asal dan Studio.
  // Lanjut tidak memanggil direct submit.
}
```

### `app/components/campaign-forms/RecipeLabsConfigurationForm.js`

Pertahankan props kompatibilitas yang masih dipakai caller lama; API After disingkat. State controller tidak boleh hilang karena section unmount.

**Code Sebelum (Current/Before)**

```js
export default function RecipeLabsConfigurationForm({
  mode = 'direct', // 'direct' | 'capture'
  initialValues = {},
  onCapture = null,
  onSuccess = null,
  onCancel = null,
  isInline = false
}) {
```

**Code Sesudah (Proposed/After)**

```js
export function useRecipeLabsController(options) {
  // State, katalog, preset dan handler diekstrak dari menu asal.
}
export default function RecipeLabsConfigurationForm({
  mode = 'direct', layout = 'accordion', activeSection,
  draft, onDraftChange, onCapture, onSuccess, onCancel
}) {
  // Section canonical yang sama untuk menu asal dan Studio.
  // Lanjut tidak memanggil direct submit.
}
```

### `app/components/campaign-forms/PillarConfigurationForm.js`

**Code Sebelum (Current/Before)**

```js
// File belum ada. Isi form saat ini berada di ImportPlannerModal.
```

**Code Sesudah (Proposed/After)**

```js
export function usePillarController(options) { /* ekstraksi controller modal */ }
export default function PillarConfigurationForm({
  planner, layout = 'accordion', activeSection,
  draft, onDraftChange, onCapture, onSuccess, onCancel
}) { /* section canonical tanpa overlay/modal */ }
```

### `app/content-planner/page.js`

Pindahkan handler aktual bersama controller; nama callback After ilustratif. Pertahankan refresh daftar, toast, izin preset, query prefill dan perilaku halaman asal. History/log/global scheduler tidak dipindah ke wizard.

**Code Sebelum (Current/Before)**

```js
<form onSubmit={handleGenerate}>
  {/* Seluruh konfigurasi masih inline pada halaman asal. */}
</form>
```

**Code Sesudah (Proposed/After)**

```js
<PlannerConfigurationForm
  mode="direct"
  layout="accordion"
  onSuccess={handleCampaignCreated}
  onCancel={closeConfiguration}
/>
```

### `app/re-campaigns/page.js`

Pindahkan handler aktual bersama controller; nama callback After ilustratif. Pertahankan refresh daftar, toast, izin preset, query prefill dan perilaku halaman asal. History/log/global scheduler tidak dipindah ke wizard.

**Code Sebelum (Current/Before)**

```js
<form onSubmit={productionMode === 'mass' ? handleMassSubmit : handleCreate}>
  {/* Seluruh konfigurasi masih inline pada halaman asal. */}
</form>
```

**Code Sesudah (Proposed/After)**

```js
<ReCampaignConfigurationForm
  mode="direct"
  layout="accordion"
  onSuccess={handleCampaignCreated}
  onCancel={closeConfiguration}
/>
```

### `app/multiplier-lab/page.js`

Pindahkan handler aktual bersama controller; nama callback After ilustratif. Pertahankan refresh daftar, toast, izin preset, query prefill dan perilaku halaman asal. History/log/global scheduler tidak dipindah ke wizard.

**Code Sebelum (Current/Before)**

```js
<form onSubmit={handleSubmit}>
  {/* Seluruh konfigurasi masih inline pada halaman asal. */}
</form>
```

**Code Sesudah (Proposed/After)**

```js
<MultiplierConfigurationForm
  mode="direct"
  layout="accordion"
  onSuccess={handleCampaignCreated}
  onCancel={closeConfiguration}
/>
```

### `app/recipe-labs/page.js`

Before merangkum dua blok asli; event handler harus diperiksa kembali saat ekstraksi. Pilihan cabang dan handler hasil tetap mengikuti menu asal.

**Code Sebelum (Current/Before)**

```js
{campaignType === 'static' && (
  <form onSubmit={handleSubmit}>{/* Form Static asli */}</form>
)}
{campaignType === 'video' && (
  <form onSubmit={handleSubmit}>{/* Form Storyboard asli */}</form>
)}
```

**Code Sesudah (Proposed/After)**

```js
<RecipeLabsConfigurationForm
  mode="direct"
  layout="accordion"
  initialValues={{ campaignType }}
  onSuccess={handleCampaignCreated}
/>
```

### `app/components/ImportPlannerModal.js`

Wrapper tetap menangani modal dan pemilihan Planner pada menu lama; Studio menggunakan form inline dengan Planner hasil sesinya.

**Code Sebelum (Current/Before)**

```js
export default function ImportPlannerModal({
  isOpen,
  onClose,
  initialPlannerId = '',
  onSuccess,
  onConfigurationSubmit = null
}) {
```

**Code Sesudah (Proposed/After)**

```js
// Signature publik tetap kompatibel.
<PillarConfigurationForm
  planner={planner}
  layout="accordion"
  onCapture={onConfigurationSubmit}
  onSuccess={onSuccess}
  onCancel={onClose}
/>
```

### `app/components/contentflow-studio/StudioCampaignWizard.js`

Shell sendiri tidak mendefinisikan field/default campaign. Tidak ada nested form; hanya satu pemilik submit/keyboard Enter.

**Code Sebelum (Current/Before)**

```js
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```js
'use client';
export default function StudioCampaignWizard({ onClose, onSaved }) {
  // Sesi draft persisten per wizard, section controller canonical,
  // validasi step/full, schedule mapping, review dan commit.
}
```

### `lib/contentflow-studio-wizard-steps.js`

**Code Sebelum (Current/Before)**

```js
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```js
export function getStudioWizardSteps({ engineKind, draft }) {
  // Pilih campaign → section canonical sesuai branch → jadwal → review.
  // Generator/Review Planner hanya untuk engine pillar.
}
export function getInvalidatedOutputs(previousDraft, nextDraft) {
  // Pertahankan jadwal output yang identitasnya tidak berubah.
}
```

### `app/components/contentflow-studio/StudioWorkspace.js`

Pindahkan hanya state/handler creation ke shell. Calendar, table, drawer review, aktivasi batch, approval dan helper HTTP idempotency dipertahankan.

**Code Sebelum (Current/Before)**

```js
{showWizard && wizardStep===3 && selectedEngine==='pillar' && createdPlanner &&
  <ImportPlannerModal isOpen initialPlannerId={createdPlanner.id}
    onClose={()=>setWizardStep(1)} onConfigurationSubmit={handleEngineCapture} />}
// Cabang wizard/modal dan form lain di-render terpisah.
```

**Code Sesudah (Proposed/After)**

```js
{showWizard && (
  <StudioCampaignWizard
    onClose={() => setShowWizard(false)}
    onSaved={handleStudioBatchSaved}
  />
)}
```

### `lib/contentflow-studio-manifest.js`

After bergantung bukti tahap 02. Model output harus sesuai artefak asli termasuk angle. Gunakan kontrak engine untuk validasi/batas, tetap kompatibel dengan batch tersimpan.

**Code Sebelum (Current/Before)**

```js
outputs = urls.map((source, index) => {
  // Satu output RE per URL pada implementasi saat audit.
  return { outputKey: `re:${index}`, /* snapshot source */ };
});
```

**Code Sesudah (Proposed/After)**

```js
const invocationPlan = buildCampaignInvocationPlan(engineKind, payload, rows);
return invocationPlan.outputs.map(output => ({
  outputKey: output.stableKey,
  snapshot: output.snapshot,
  mediaType: output.mediaType
}));
```

### `lib/contentflow-studio-batch-service.js`

Tetap server-authoritative, transactional dan idempotent; dukung bentuk legacy yang masih valid. Simpan konfigurasi user serta effective execution policy secara jelas.

**Code Sebelum (Current/Before)**

```js
const config = engineKind === 'pillar'
  ? (enginePayload.global_settings || enginePayload) : enginePayload;
const outputs = buildOutputManifest(engineKind, config, rows);
```

**Code Sesudah (Proposed/After)**

```js
const config = validateAndNormalizeEnginePayload({
  engineKind, enginePayload, executionContext: 'studio'
});
await validateOwnedCampaignReferences(client, tenantId, config);
const outputs = buildOutputManifest(engineKind, config, rows);
```

### `lib/contentflow-studio-assets.js`

Reuse mekanisme upload asli yang relevan. Per-engine/per-row attachment mapping diputuskan tahap 02. Tidak mengubah limit/MIME engine secara ad-hoc.

**Code Sebelum (Current/Before)**

```js
// File belum ada; pemrosesan gambar RE inline di route batch.
```

**Code Sesudah (Proposed/After)**

```js
export async function stageStudioAssets({ tenantId, engineKind, form, input }) {
  // Validasi seperti sumber asli, binding aset ke tenant/output,
  // simpan di shared runtime; kembalikan referensi deterministik.
}
export async function validateStudioAssetReferences(context) {
  // Tolak path/tenant/ref tidak sah, tanpa menghapus aset aktif.
}
```

### `app/api/v2/contentflow-studio/batches/route.js`

Pertahankan JSON existing dan nama multipart lama sebagai kompatibilitas. Urutan normalisasi/hash staging harus deterministik; cleanup failure tidak boleh menghapus file yang sudah direferensikan.

**Code Sebelum (Current/Before)**

```js
const image = form.get('productRefImage');
if (image && typeof image.arrayBuffer === 'function') {
  if (input.engineKind !== 're' || image.size > 10 * 1024 * 1024)
    throw Object.assign(Error('Upload gambar tidak valid atau terlalu besar.'), { status:400 });
  // Konversi dan penyimpanan gambar inline.
}
```

**Code Sesudah (Proposed/After)**

```js
const staged = await stageStudioAssets({
  tenantId: getActiveTenantId(), engineKind: input.engineKind, form, input
});
input = staged.input;
const data = await createStudioBatchAtomically({
  ...input, tenantId: getActiveTenantId(), actorId: user?.id || user?.username
});
```

### `lib/campaign-submission-service.js`

Jangan mengubah default lama secara global tanpa karakterisasi direct route. Selaraskan perilaku menu asal dan shared service; engine single-pass tetap dipertahankan.

**Code Sebelum (Current/Before)**

```js
angle_multiplier: payload.angle_multiplier !== undefined ? Number(payload.angle_multiplier) : 0,
enable_vo_audit: payload.enable_vo_audit !== undefined ? Number(payload.enable_vo_audit) : 0,
enable_audio_segment: payload.enable_audio_segment !== undefined ? Number(payload.enable_audio_segment) : 0,
```

**Code Sesudah (Proposed/After)**

```js
const config = normalizeCampaignSubmission(engineKind, payload);
// Gunakan field/default canonical tanpa menghilangkan false/0.
// Simpan mode/override asli dan kembalikan identitas hasil sesuai
// invocation/output mapping yang telah diverifikasi.
```

### `lib/contentflow-studio-adapters.js`

Pertahankan semua penekanan social posting termasuk nested audio/config_json. Jangan menandai Storyboard tanpa video final sebagai ready. Jika lock/repository/worker perlu berubah, tambahkan before/after file terkait setelah audit tahap 02.

**Code Sebelum (Current/Before)**

```js
const safeConfig = { ...config, enable_social_post: 0, post_to_facebook: 0,
  post_facebook_draft: 0, post_youtube_draft: 0, post_tiktok_draft: 0,
  auto_sync_contentflow: 1 };
// RE dispatch memakai urls: [snapshot.source].
```

**Code Sesudah (Proposed/After)**

```js
const safeConfig = applyStudioExecutionPolicy(config);
const result = await dispatchCanonicalInvocation({
  tenantId, invocation: snapshot.invocation, config: safeConfig
});
// Mapping hasil slot, retry/idempotency dan lock sesuai invocation,
// bukan produksi ulang seluruh konfigurasi pada setiap varian.
```

### `tests/contentflow-studio-wizard-parity.test.mjs`

Tambah kasus lima kontrak, preset, assets, mass, Recipe count dan output cardinality. Fixtures generik; tanpa secret asli atau format credential scanner.

**Code Sebelum (Current/Before)**

```js
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```js
test('canonical direct and Studio capture preserve RE conditional options', () => {
  // Fixture dari payload asli; cek tipe/default/false/0/per-row overrides.
});
test('all Multiplier workflows retain their source and output mappings', () => {
  // Bandingkan input dan hasil yang berbeda, bukan salinan implementasi.
});
```

### `tests/contentflow-studio-wizard-integration.test.mjs`

Buktikan server menolak payload lintas tenant/invalid meski UI dilewati; uji Planner consumption failure rollback dan future slot.

**Code Sebelum (Current/Before)**

```js
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```js
test('atomic batch creation persists canonical config and owned assets', async () => {
  // Schema test terisolasi; engine/provider stub.
});
test('shared invocation retries do not duplicate output production', async () => {
  // Uji konkurensi, per-slot result mapping dan approval gate.
});
```

### `sot/menus/contentflow-studio.md`

Before bersifat ringkasan bagian dokumen existing, bukan klaim bahwa judul literalnya sama. Perbaiki klaim lama tentang shared form dengan bukti hasil ekstraksi.

**Code Sebelum (Current/Before)**

```md
# ContentFlow Studio

<!-- Dokumen saat ini menjelaskan form shared dan alur Studio existing. -->
```

**Code Sesudah (Proposed/After)**

```md
## Konfigurasi Campaign Melalui Wizard

Form dan controller canonical dipakai bersama menu asal dan Studio.
Planner hanya untuk Pillar dan sekali pakai. Produksi dan publishing
mengikuti jadwal, mapping output serta approval Studio.

<!-- Dokumentasikan branch, paritas, upload, retry dan batas storyboard. -->
```

### `plans/contentflow-studio/wizard-parity/parity-matrix.md`

**Code Sebelum (Current/Before)**

```md
<!-- File belum ada. -->
```

**Code Sesudah (Proposed/After)**

```md
| Engine / mode | Source field | Default / options | Validator | Payload | Output / assets | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
<!-- Isi semua field dari sumber asli, bukan hanya field yang sudah ada di Studio. -->
```

### `plans/contentflow-studio/wizard-parity/execution-notes.md`

**Code Sebelum (Current/Before)**

```md
<!-- File belum ada. -->
```

**Code Sesudah (Proposed/After)**

```md
# Execution Notes

## Baseline
## Per-stage evidence and decisions
## Contract and integration results
## Release SHA and deployment verification
## Manual review and known limitations
```

### `plans/contentflow-studio/wizard-parity/implementation_plan.md`

Hanya setelah tahap benar-benar selesai; contoh ini tidak menandakan tahap 01 telah dikerjakan.

**Code Sebelum (Current/Before)**

```md
- [ ] Tahap 01 — Catat baseline, inventaris field lengkap dan fixture payload asli.
```

**Code Sesudah (Proposed/After)**

```md
- [x] Tahap 01 — Catat baseline, inventaris field lengkap dan fixture payload asli.
```

## Sumber yang digunakan tanpa rencana perubahan

`app/theme.css`, `VisualIdentitySelector.js`, `words-per-clip-presets.js`, `core/GridCoordinates.js`, validator Planner/Recipe existing, `content-planner-consumption.js`, dan helper HTTP idempotency tetap dipakai. Jika audit menemukan perubahan di sumber tersebut diperlukan, catat alasan serta before/after lebih dulu. Hal yang sama berlaku route campaign direct, repository/worker, SOT global/changelog dan file metadata rilis yang diperbarui script rilis resmi.

Tidak membuat migrasi database hanya karena ada wizard. Jangan mengganti engine Strategic Campaign menjadi dua panggilan AI.

## Matriks verifikasi minimum

| Area | Kasus bermakna | Bukti selesai |
| --- | --- | --- |
| Shared configuration | default, preset, custom, conditional, false/0 | Serializer direct/capture setara pada fixture yang sama |
| Planner/Pillar | tiga fokus, count, world/universe, row selection | Validasi asli dan one-time consume tetap benar |
| RE | single/mass, autopilot/manual, angles, bridging 3 mode, Hybrid Lock | Full payload, kardinalitas dan retry tanpa duplikasi |
| Multiplier | empat workflow, non-produk, mass URL, angle regenerate | Kombinasi valid dan jadwal mengikuti output stabil |
| Recipe | static layout 3–6, tanpa image, storyboard, count boundary | Preview benar, seluruh opsi tersimpan, final readiness benar |
| Assets | staged image, per-output refs, restart, ownership | File tersedia saat worker berjalan, referensi invalid ditolak |
| Orchestration | save draft, activate, due/future, retry, approval revision | Tidak ada produksi sebelum waktunya atau publish tanpa approval |
| Compatibility | menu asal, batch lama, multipart lama, HTTP staging | Tidak ada regresi alur yang sudah dipakai |
| UI | light/dark, kecil, keyboard, Back/Next, error/cancel | Pengguna bisa meninjau dan menyelesaikan setiap branch |
| Release | build, remote main/tag, atomic Dev/Staging | SHA, manifest, health, PM2 cwd/env/shared tercatat |

## Kriteria serah terima

1. Matriks paritas terisi dan seluruh gap awal tertutup, bukan sekadar semua input terlihat.
2. Satu sumber section/controller/serializer untuk setiap jalur, digunakan menu asal dan Studio.
3. Konfigurasi tidak hilang ketika berpindah langkah; unggahan, hasil persiapan dan jadwal tidak salah terhubung setelah perubahan sumber.
4. Setiap artefak final memiliki mapping slot yang benar; konfigurasi angle/mass tidak menyebabkan duplikasi.
5. Planner single-use, tenant isolation, approval dan batas storyboard terbukti tetap berlaku.
6. Semua verifikasi tercatat; dokumentasi, release dan deployment sesuai SOP. Production tetap menunggu instruksi eksplisit.

Estimasi tahap tidak dinyatakan sebagai durasi pasti sebelum audit kardinalitas dan lampiran selesai. Tahap 02 adalah penentu kompleksitas backend; tahap 03–06 dikerjakan dan diverifikasi satu per satu sebelum integrasi akhir.

## Amendment eksekusi — ekstraksi canonical

Controller beserta JSX menu asal direlokasi utuh ke file campaign-forms dan route menjadi wrapper direct. Pure module per-engine memuat boundary normalisasi/validasi server; controller tetap berdampingan JSX agar preset dan dependency asli tidak terpecah atau direkonstruksi. Capture hanya merender form yang sama dengan wizard section; shell/history direct dipertahankan. Ini menggantikan usulan hook bernama terpisah, tanpa mengubah tujuan satu sumber konfigurasi. RE angle invocation/ordinal disimpan di output_snapshot_json existing; tidak membutuhkan DDL.

## Amendment support files


### `app/components/campaign-forms/CampaignConfigurationWizard.js`

Code Sebelum (Current/Before):

```
File belum ada pada baseline.
```

Code Sesudah (Proposed/After):

```
export default function CampaignConfigurationWizard(props) { /* canonical form presentation, guarded navigation */ }
```

### `app/components/campaign-forms/campaign-wizard.css`

Code Sebelum (Current/Before):

```
File belum ada pada baseline.
```

Code Sesudah (Proposed/After):

```
.campaign-wizard { color: var(--text-primary); background: var(--surface); }
```

### `lib/campaign-configuration/capture.js`

Code Sebelum (Current/Before):

```
File belum ada pada baseline.
```

Code Sesudah (Proposed/After):

```
export function captureCanonicalFormData(form) { /* preserve payload and separate File */ }
```

### `lib/campaign-configuration/index.js`

Code Sebelum (Current/Before):

```
File belum ada pada baseline.
```

Code Sesudah (Proposed/After):

```
export function validateAndNormalizeEnginePayload(engine, payload) { /* shared boundary */ }
```

### `app/api/v2/contentflow-studio/assets/route.js`

Code Sebelum (Current/Before):

```
File belum ada pada baseline.
```

Code Sesudah (Proposed/After):

```
export const POST = withTenantContext(async request => { /* tenant-owned image staging */ });
```

### `tests/fixtures/contentflow-studio-canonical-controls.json`

Code Sebelum (Current/Before):

```
File belum ada pada baseline.
```

Code Sesudah (Proposed/After):

```
{ "planner": [], "pillar": [], "re": [], "multiplier": [], "recipe": [] }
```

Audit lanjutan endpoint: Multiplier asli membatasi 20 kombinasi; pertahankan batas tersebut. RE endpoint asli tidak membatasi jumlah URL, sehingga batas tambahan Studio 100 dihapus. Recipe Labs UI membatasi 10 pada kontrol, API mengizinkan sampai 20; keduanya dipertahankan sesuai lapisannya.
