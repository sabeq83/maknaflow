# Implementation Plan — ContentFlow Studio

Tanggal: 22 Oktober 2026 (Asia/Jakarta)
Status: rencana implementasi aplikasi berdasarkan mockup revisi; belum menjalankan implementasi, migrasi, rilis, atau deployment.
Referensi visual: `public/mockup_contentflow_studio.html` (revisi tanpa Bank Ide).
Rencana ini terpisah dari `implementation_plan.md` di root yang digunakan untuk pekerjaan Recipe Labs.

## Hasil yang dituju

Menu `/contentflow-studio` menyediakan kalender bulan berjalan dan tabel untuk merencanakan produksi, memantau mesin campaign existing, mereview hasil, lalu menyetujui penjadwalan melalui Repliz. Konfigurasi memakai form yang sama dengan menu existing. Planner dibuat baru, digenerate, dan dikonsumsi sekali untuk satu batch jadwal; tidak ada Bank Ide atau pemilihan ulang Planner terpakai.

Mockup saat ini hanya menampilkan titik integrasi form existing. Implementasi aplikasi harus benar-benar merender komponen form yang sama di dalam Studio; tombol “Simulasikan Konfigurasi Selesai”, contoh hasil tetap, localStorage demo, dan tautan menu sebagai pengganti konfigurasi tidak dibawa ke aplikasi.

## Keputusan desain yang mengikat

1. Studio adalah orkestrator. Prompt, algoritme, preset, pilihan model, field, default, conditional visibility, upload, validasi, dan perilaku tiap campaign mengikuti kode existing.
2. Form inline yang sekarang berada di page diekstrak secara mekanis menjadi komponen/controller bersama. Menu lama dan Studio memakai implementasi yang sama, bukan dua salinan. Callback submit membedakan simpan konfigurasi Studio dan eksekusi menu lama; validasi/payload domain tetap sama.
3. Content Planner adalah tahap sebelum produksi Pillar dan jalur resep yang memang memakai Planner. RE/Multiplier mengikuti sumber brief masing-masing. Recipe Labs memiliki cabang output aktual di kode, sehingga mapping mengikuti `campaignType` dan payload existing, bukan label demo yang diasumsikan.
4. Seluruh hasil Planner secara default masuk satu batch kalender, satu baris menjadi satu slot. Jika form existing mendukung seleksi sebagian, baris yang tidak dipilih ditandai tidak digunakan dan ikut dikunci; tidak dapat dikonsumsi untuk batch lain.
5. Planner `consumed` tidak bisa di-ingest ulang, digenerate ulang, diedit/regenerate baris, diterapkan research baru, atau dihapus untuk melepaskan identitas pemakaian. Arsip tetap boleh. Retry milik batch/job yang sama melanjutkan checkpoint dan mengembalikan hasil yang sama.
6. Generate Planner dan Generate Content merupakan tindakan berbeda. Produksi berjalan setelah diaktifkan dan waktu produksi tercapai. Publikasi hanya setelah approval hasil akhir.
7. Jadwal produksi terpisah dari target tayang; waktu disimpan UTC dan ditampilkan melalui zona waktu tenant, default Asia/Jakarta. Kalender mengambil bulan/tanggal aktual, bukan Oktober 2026 tetap.
8. Satu konten boleh memiliki banyak akun tujuan; status dan pemulihan publikasi disimpan per akun. Retry tujuan gagal tidak mengirim ulang tujuan yang telah sukses.
9. Approval creative/start frame mengikuti mesin existing. Approval publikasi menyimpan revisi/hash aset akhir, caption, akun, dan target jadwal. Perubahan material memerlukan persetujuan baru.
10. Tidak mengubah generator produksi menjadi dua call. Single-Pass produksi campaign tetap dipertahankan; tahapan Strategic Skeleton/Creative Generator pada Planner merupakan jalur existing tersendiri.

## Dasar kode dan batas reuse

| Area | Sumber existing | Cara reuse |
| --- | --- | --- |
| Generator Planner | `app/content-planner/page.js`, `lib/content-planner-engine.js`, `lib/recipe-planner-engine.js` | Ekstrak form existing; engine dipanggil worker dengan checkpoint |
| Pillar | `app/components/ImportPlannerModal.js`, `lib/pillar-campaign-ingest.js` | Modal dipakai langsung dengan callback capture; ingest row milik batch |
| RE | `app/re-campaigns/page.js`, `app/api/v2/re-campaigns/route.js` | Ekstrak form/controller dan service submit existing |
| Multiplier | `app/multiplier-lab/page.js`, `app/api/v2/multiplier/route.js` | Reuse kombinasi/angle/preset serta worker existing |
| Recipe Labs | `app/recipe-labs/page.js`, `app/api/recipe-labs/route.js` | Ekstrak seluruh cabang form aktual beserta validasi/payload |
| Recipe Planner | `lib/recipe-campaign-ingest.js` | Gunakan jalur existing dengan kontrol aktivasi dan ownership batch |
| Scheduler produksi | `lib/campaign-scheduler.js`, `lib/re-multiplier-worker.js` | Tetap pemilik eksekusi tahap produksi; Studio hanya dispatch/reconcile |
| ContentFlow Hub | `lib/contentflow-ingest.js`, `app/content-flow/page.js` | Aset existing dan tindakan unduh/salin, tanpa library kedua |
| Publikasi | `lib/publishing-repository.js`, `lib/publishing-worker.js`, `lib/repliz-client.js` | Job/attempt/provider lifecycle existing, tanpa worker Repliz baru |
| Content Automation | `lib/content-automation-worker.js`, repository/calendar/retry terkait | Reuse utility waktu/retry dan pola claim; tidak memaksa empat mesin ke kontrak Operator yang hanya menerima Editorial/Product |

Penyempurnaan usulan awal: gunakan tabel dan worker orkestrasi Studio tersendiri dengan helper yang sudah ada. Content Automation memiliki asumsi jadwal berulang dan Operator/Pillar; memperluas kontrak itu untuk seluruh mesin sekaligus berisiko mengubah automation lama. Worker Studio tidak menjalankan ulang tahap TTS/visual/FFmpeg atau publikasi.

## Alur pengguna

### Konten dari RE, Multiplier, atau Recipe Labs

Klik tanggal → pilih campaign → isi form existing di panel Studio → simpan konfigurasi + jadwal produksi/tayang + akun → Draft → Generate Content → Pending → mesin existing → Ready → review hasil → Approve & Schedule → Scheduling → Scheduled → Published.

Output lebih dari satu harus dipetakan menjadi slot sebelum aktivasi. Cardinality mengikuti hasil validasi payload existing; tidak diasumsikan satu submit selalu menghasilkan satu video.

### Konten dari Planner

Planner baru → konfigurasi Generator Planner existing → generate satu kali → review hasil di wizard yang sama → konfigurasi produksi melalui ImportPlannerModal existing → distribusi tanggal/jam → simpan batch dan kunci Planner → Generate Content untuk slot pilihan → produksi dan publikasi seperti di atas.

Menutup wizard sebelum konsumsi dapat melanjutkan sesi draft milik batch yang sama. Tidak ada katalog ide atau tombol memakai Planner terpakai. Setelah konsumsi, batal/hapus slot tidak mengembalikan Planner menjadi available.

## State dan aturan pemulihan

| Lapisan | State |
| --- | --- |
| Planner | `draft`, `generating`, `ready`, `reserved`, `consumed`, `failed` |
| Slot produksi | `draft`, `pending`, `in_progress`, `needs_review`, `ready`, `failed`, `cancelled` |
| Target publikasi | `awaiting_approval`, `scheduling`, `scheduled`, `verifying`, `retry_wait`, `published`, `failed`, `manual_published`, `cancelled` |

State di atas merupakan projection Studio; enum mesin existing tidak diubah hanya untuk menyamakan label. `finished` campaign tidak cukup untuk Ready karena pemeriksaan scheduler existing juga menganggap kegagalan sebagai selesai antrean. Ready membutuhkan aset sesuai output contract, caption, dan seluruh tahap wajib sukses/skipped yang valid.

Target tayang terlewat menghasilkan Needs Action; pilih jadwal baru atau Publish Now secara eksplisit. Jangan otomatis menerbitkan setelah approval terlambat. Timeout ambigu provider menjadi Verifying; jangan melakukan blind retry. Upload manual menyimpan akun, permalink/bukti, actor, waktu, dan asal status manual.

## Model data dan transaksi

Migrasi eksplisit menambah tabel berikut dalam schema environment aktif; mengikuti tipe kolom/kunci tabel existing yang diverifikasi saat implementasi.

- `content_studio_batches`: tenant, sumber, konfigurasi versi/snapshot, planner ID, idempotency key, state.
- `content_studio_slots`: tenant, batch, planner row ID bila ada, produksi/tayang UTC, timezone, output contract, activation, source campaign/item ID, contentflow ID, progress/error, revision/hash.
- `content_studio_targets`: slot, account, scheduled time, job ID, status, approval revision, manual evidence.
- `content_studio_approvals`: actor, revision/hash, keputusan, timestamp; immutable.
- `content_studio_events`: checkpoint, correlation, sanitized errors dan audit.
- `content_planner_consumptions`: tenant, planner, owner batch/job, reservation/consumption, snapshot hash. Unique `(tenant_id, planner_id)` berlaku lintas semua entry point.

Unique mapping `(tenant_id, batch_id, planner_row_id)` untuk slot berbasis Planner; unique target `(tenant_id, slot_id, account_id)`. Job produksi memakai deterministic ID dan unique owner/source key. Jangan bergantung pada tombol disabled atau localStorage.

Konsumsi Studio: transaction lock Planner → validasi tenant, complete generation, snapshot dan ownership → insert consumption + batch + seluruh slots/targets → set consumed → commit. Bila transaksi gagal, tidak ada konsumsi/slot parsial. Network/AI tidak dijalankan di dalam transaksi.

Menu lama/Operator yang membuat campaign langsung: reserve owner deterministik dalam transaksi, ingest idempotent, finalize consumption. Crash dipulihkan dengan memeriksa campaign/items/checkpoint milik owner. Reservation tidak dilepas otomatis hanya karena timeout; pastikan tidak ada pekerjaan tercipta sebelum pemulihan. Caller berbeda menerima HTTP 409 `PLANNER_ALREADY_CONSUMED`; caller sama mendapat hasil yang sama. Bukan menyediakan token pengecualian dari body browser.

Backfill: audit `source_planner_id`, relasi Operator, dan sumber recipe existing. Tandai Planner yang terbukti sudah di-ingest sebagai consumed; hubungan ambigu ditandai blocked/requires audit. Jangan menebak konsumsi hanya dari `status=completed` karena itu bisa berarti ide selesai digenerate. Tidak menghapus campaign/Planner lama untuk merapikan histori.

## Scheduler dan integrasi produksi

- Claim due slot secara atomik menggunakan PostgreSQL `FOR UPDATE SKIP LOCKED`, lease/checkpoint, dan koneksi singkat. AI/HTTP dilakukan setelah melepas transaksi. Hormati `PGPOOL_MAX=3` pada Dev/Staging.
- Studio worker memanggil service domain existing, bukan request HTTP ke aplikasi sendiri atau duplikasi handler.
- Untuk Planner, jadwalkan dispatch row/cohort yang waktunya sudah tiba, dengan deterministic campaign/item mapping. Jangan membuat satu campaign running berisi seluruh row masa depan. Bila mesin tertentu mensyaratkan batch serentak, tambah gate waktu pada worker mesin tersebut setelah analisis; itu perubahan scope yang harus dimasukkan ke daftar file beserta before/after sebelum coding.
- Multiplier mempertahankan urutan/konkurensi existing; tidak menjalankan worker paralel kedua untuk task yang sama.
- Reconcile menghubungkan source → ContentFlow item → publikasi. Kegagalan sync tidak meregenerasi video; retry sync saja.
- Pause Studio menghentikan dispatch baru. Tidak membatalkan pekerjaan mesin/provider yang sudah aktif secara diam-diam.

## API yang direncanakan

Gunakan router baru `/api/v2/contentflow-studio`; seluruh endpoint membutuhkan autentikasi, tenant context, dan validasi ownership. Hak review/publish mengikuti policy existing, tidak diasumsikan semua pengguna admin.

| Route | Fungsi |
| --- | --- |
| `GET/POST /batches` | Daftar/buat sesi konfigurasi atau batch |
| `POST /batches/[id]/actions` | Generate Planner, consume hasil, activate selected; action allowlist dan idempotency |
| `GET /calendar` | Projection kalender dengan rentang UTC hasil konversi zona waktu |
| `GET/PATCH /slots/[id]` | Detail dan edit jadwal/config yang diizinkan |
| `POST /slots/[id]/actions` | Retry produksi/sync, cancel, review domain, manual publish; allowlist dan optimistic concurrency |
| `POST /slots/[id]/approve-publish` | Approval final dan durable dispatch ke layanan publishing existing |

Approval dan enqueue intent harus atomik. Jika layanan publishing gagal sesudah approval tersimpan, lanjutkan intent yang sama melalui checkpoint; jangan membuat job baru. Service publishing bersama mempertahankan preflight, health akun, staging media, validasi platform, idempotency, dan sync status ContentFlow yang sekarang berada di route existing.

## Execution Task List

- [x] 00. Baca mockup revisi, entry point Planner/campaign/publishing, dan dokumentasi Next.js lokal yang relevan; tulis rencana terpisah ini.
- [x] 01. Inventarisasi seluruh field, branch form, submit payload, validasi, preset/upload, cardinality output dan trigger scheduler; dokumentasikan matriks kesetaraan form lama vs shared.
- [x] 02. Tambah migration eksplisit, contract, repository Studio, dan Planner consumption dengan unique constraints/tenant ownership; verifikasi backfill melalui dry-run.
- [x] 03. Terapkan guard Planner sekali pakai di engine, ingest Pillar/Recipe, edit/delete row, research apply, dan seluruh pemanggil Operator/menu lama; verifikasi concurrent consume dan crash recovery.
- [x] 04. Ekstrak form/controller existing untuk Planner, RE, Multiplier, Recipe Labs dan callback ImportPlannerModal; menu lama tetap memakai shared code yang sama.
- [x] 05. Ekstrak service submit existing untuk RE/Multiplier/Recipe dan publishing; pertahankan perilaku endpoint lama dan seluruh validation/preflight.
- [x] 06. Implementasikan `/contentflow-studio`, sidebar/permission, kalender/tabel, wizard Planner sekali pakai, form existing inline dan jadwal per output. Gunakan semantic tokens `app/theme.css`.
- [x] 07. Implementasikan API Studio, batch consumption, adapter domain, worker dispatch/reconcile dan recovery. Produksi future slot tidak boleh mulai lebih awal.
- [x] 08. Integrasikan review creative existing, preview aset final, approval revision/hash, target Repliz, reschedule/retry per akun, download/copy dan bukti upload manual.
- [x] 09. Jalankan test kontrak/transaksi/integrasi yang relevan, regresi menu existing, build, dan verifikasi manual UI light/dark bersama pengguna.
- [x] 10. Dokumentasikan operasi, migrasi/rollback, lakukan rilis dan Git sync wajib setelah verifikasi; pastikan commit/tag remote benar.
- [x] 11. Saat tahap rollout dijalankan, deploy Dev lalu Staging berdasarkan full remote SHA dan SOT atomic; verifikasi health/PM2/schema/pool/shared. Production menunggu instruksi eksplisit terpisah.

Setelah setiap tahap selesai, ubah checkbox tahap menjadi `[x]` di file ini. Tambahkan file/dependensi baru beserta before/after sebelum memodifikasinya. Jangan menandai implementasi selesai hanya karena dokumen rencana selesai.

## Verifikasi dan kriteria penerimaan

1. Menu lama dan Studio menghasilkan payload yang setara untuk input yang sama, mencakup seluruh cabang form, upload, preset, produk/brand binding, dan mode non-product.
2. Tidak ada Bank Ide atau selector Planner consumed di Studio. Dua request/tab berbeda tidak bisa memakai Planner sama; retry owner sama tidak menambah campaign/slot.
3. Generate ulang, row edit/delete, research apply, ingest dari menu lama/Operator ditolak setelah consumed; tenant lain tidak dapat membaca/mengubah konsumsi.
4. Race generate vs consume tidak dapat mengubah rows saat konsumsi. Reservation crash tidak membuka reuse. Bukti konsumsi bertahan sesudah cancel/archive/restart.
5. Setiap output memiliki slot dan waktu produksi/tayang; future slot tidak diproses oleh scheduler existing sebelum waktunya. Restart melanjutkan checkpoint yang sama.
6. Ready hanya setelah output yang akan diterbitkan tersedia. Recipe gambar/video mengikuti contract sebenarnya; tanpa media wajib tidak dapat di-approve.
7. Caption/aset berubah setelah approval → approval baru diperlukan; double-click approve dan worker restart tidak menambah job. Approval produksi tidak dianggap approval publishing.
8. Facebook sukses + Instagram gagal tetap mempertahankan Facebook; reconnect/retry hanya target gagal. Ambiguous timeout tidak langsung diulang. Status Published membutuhkan hasil provider; manual diberi asal status berbeda.
9. Batas hari/bulan WIB, bulan pendek, akun berbeda timezone, jadwal terlewat, antrean pause dan backlog diuji dengan clock terkontrol.
10. Seluruh route memiliki tenant guard, ownership join, input validation dan redaksi secret; kredensial tidak dimasukkan dalam snapshot/form/log.
11. Test existing relevan: publishing scheduler, Planner contract/research, Pillar approval/ingest, Recipe pipeline/contract, Multiplier workflows, ContentFlow status preservation, Content Automation/Operator. Pilih test yang benar-benar terdampak; kegagalan baseline dilaporkan terpisah.
12. UI manual melalui link Dev/Staging: tambah jadwal tiap jenis, wizard Planner, calendar/table filter, progres/review, approval, error recovery, light/dark, keyboard dan lebar layar kecil. Tidak memerlukan suite browser otomatis berlebihan.

Test baru yang wajib: consumption concurrency, row ownership, crash checkpoints, per-slot due dispatch, readiness mapping dan approval/publishing idempotency. Test baru tidak sekadar memeriksa struktur komponen.

## Rilis dan rollout

Dokumen rencana ini tidak menjalankan rilis/deploy. Setelah implementasi terverifikasi, ikuti SOP rilis proyek. Audit working tree karena `scripts/release.js` memakai `git add -A`; jangan menyertakan pekerjaan lain. Jika perlu, gunakan checkout rilis bersih berisi commit scope Studio lalu jalankan release non-interaktif di sana. Cocokkan versi package dan changelog terbaru di repository serta rujukan lokal; jangan menurunkan versi mengikuti salinan rujukan yang lebih lama.

```bash
npm run release-non-interactive -- --type patch --title "ContentFlow Studio" --points "Orkestrasi campaign dengan form existing|Planner sekali pakai dan approval publikasi"
```

Verifikasi branch `main` dan tag `vX.Y.Z` benar-benar tersedia di target remote. Worker Studio dikendalikan feature flag environment dan tenant pilot, default off selama rollout. Migrasi eksplisit additive pada schema target; remote build menggunakan `DISABLE_AUTO_MIGRATIONS=true`. Jangan mengandalkan auto-migration untuk rilis Studio.

Rollout mengikuti `sot/global/GIT_BASED_ATOMIC_DEPLOYMENT.md`: Dev `5020/7020`, Staging `5010/7010`, full SHA remote, build worktree release baru, health dan rollback symlink/PM2. Pool Dev/Staging maksimal 3. Periksa current/manifest, HTTP 200 UI/API, PM2 online dan `pm_cwd`, `PG_SEARCH_PATH`, shared paths. Tunggu deployment pada sesi yang sama, tanpa loop SSH rapat.

Rollback aplikasi mematikan dispatch Studio dan menyimpan tabel consumption/events/job IDs agar pekerjaan aktif dapat direkonsiliasi. Tidak menghapus consumption atau mengulang publishing. Rollback filesystem bukan rollback database. Tidak deploy Production tanpa perintah eksplisit.

## Before & After Code Snippets

Cuplikan Current/Before berasal dari kode saat rencana dibuat. Cuplikan Proposed/After menunjukkan kontrak/perubahan yang diusulkan, bukan patch lengkap yang siap dijalankan. Import, nama helper, signature DB transaction, dan path form baru difinalkan saat tahap inventarisasi. Semua file yang direncanakan disentuh tercantum di bawah; tambahkan entri sebelum scope bertambah.

### 01. `app/components/Sidebar.js`

Tambahkan menu dan permission yang mengikuti pola aplikasi; jangan hanya menyembunyikan UI tanpa guard API.

**Code Sebelum (Current/Before)**

```jsx
const menuKeyMap = {
  '/youtube-studio': 'youtube_studio',
  '/affiliate-studio': 'affiliate_studio',
  '/content-flow': 'content_flow',
  '/instant-factory': 'instant_campaign',
  '/re-campaigns': 're_campaign',
  '/pillar-campaigns': 'pillar_campaign',
```

**Code Sesudah (Proposed/After)**

```jsx
const menuKeyMap = {
  '/contentflow-studio': 'contentflow_studio',
  // mappings existing tetap dipertahankan
};
// Tambahkan nav item dan daftarkan permission Studio melalui mekanisme role existing.
```

### 02. `app/content-planner/page.js`

Menu lama menjadi pemakai form bersama. Bukan mengganti dengan field demo atau membuat definisi form kedua.

**Code Sebelum (Current/Before)**

```jsx
  async function handleGenerate(e) {
    e.preventDefault();
    if (plannerFocus === 'product_campaign') {
      if (!productName || !productDesc) {
        showToast('Nama Produk dan Deskripsi Wajib Diisi', 'error');
        return;
      }
```

**Code Sesudah (Proposed/After)**

```jsx
// Komponen bersama diekstrak dari form/controller pada halaman ini.
<PlannerConfigurationForm
  onSubmit={existingMenuSubmit}
  onSuccess={refreshExistingList}
/>
// Semua field, branch, default, validasi dan payload tetap dari form existing.
```

### 03. `app/components/campaign-forms/PlannerConfigurationForm.js`

Cuplikan konseptual; renderExistingForm mewakili pemindahan JSX/controller aktual, bukan generic form baru.

**Code Sebelum (Current/Before)**

```jsx
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```jsx
export default function PlannerConfigurationForm({ onSubmit, onSuccess }) {
  // Pindahkan state, handler, upload/preset dan JSX existing tanpa mendesain ulang.
  // Existing menu: submit langsung. Studio: callback capture konfigurasi.
  // Jalankan validator domain existing sebelum memanggil callback.
  return renderExistingForm({ onSubmit, onSuccess });
}
```

### 04. `app/re-campaigns/page.js`

Menu lama menjadi pemakai form bersama. Bukan mengganti dengan field demo atau membuat definisi form kedua.

**Code Sebelum (Current/Before)**

```jsx
  async function handleCreate(e) {
    e.preventDefault();
    const urls = urlsText.split('\n').map(u => u.trim()).filter(Boolean);
    if (!campaignName.trim() || urls.length === 0) {
      showToast('Nama kampanye dan minimal 1 URL diperlukan.', 'error');
      return;
    }
```

**Code Sesudah (Proposed/After)**

```jsx
// Komponen bersama diekstrak dari form/controller pada halaman ini.
<ReCampaignConfigurationForm
  onSubmit={existingMenuSubmit}
  onSuccess={refreshExistingList}
/>
// Semua field, branch, default, validasi dan payload tetap dari form existing.
```

### 05. `app/components/campaign-forms/ReCampaignConfigurationForm.js`

Cuplikan konseptual; renderExistingForm mewakili pemindahan JSX/controller aktual, bukan generic form baru.

**Code Sebelum (Current/Before)**

```jsx
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```jsx
export default function ReCampaignConfigurationForm({ onSubmit, onSuccess }) {
  // Pindahkan state, handler, upload/preset dan JSX existing tanpa mendesain ulang.
  // Existing menu: submit langsung. Studio: callback capture konfigurasi.
  // Jalankan validator domain existing sebelum memanggil callback.
  return renderExistingForm({ onSubmit, onSuccess });
}
```

### 06. `app/multiplier-lab/page.js`

Menu lama menjadi pemakai form bersama. Bukan mengganti dengan field demo atau membuat definisi form kedua.

**Code Sebelum (Current/Before)**

```jsx
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (combinationRows.length === 0) {
      showToast('Tabel tinjauan kombinasi kosong. Silakan buat tinjauan kombinasi terlebih dahulu.', 'error');
      return;
    }
```

**Code Sesudah (Proposed/After)**

```jsx
// Komponen bersama diekstrak dari form/controller pada halaman ini.
<MultiplierConfigurationForm
  onSubmit={existingMenuSubmit}
  onSuccess={refreshExistingList}
/>
// Semua field, branch, default, validasi dan payload tetap dari form existing.
```

### 07. `app/components/campaign-forms/MultiplierConfigurationForm.js`

Cuplikan konseptual; renderExistingForm mewakili pemindahan JSX/controller aktual, bukan generic form baru.

**Code Sebelum (Current/Before)**

```jsx
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```jsx
export default function MultiplierConfigurationForm({ onSubmit, onSuccess }) {
  // Pindahkan state, handler, upload/preset dan JSX existing tanpa mendesain ulang.
  // Existing menu: submit langsung. Studio: callback capture konfigurasi.
  // Jalankan validator domain existing sebelum memanggil callback.
  return renderExistingForm({ onSubmit, onSuccess });
}
```

### 08. `app/recipe-labs/page.js`

Menu lama menjadi pemakai form bersama. Bukan mengganti dengan field demo atau membuat definisi form kedua.

**Code Sebelum (Current/Before)**

```jsx
  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const isVideo = campaignType === 'video';

```

**Code Sesudah (Proposed/After)**

```jsx
// Komponen bersama diekstrak dari form/controller pada halaman ini.
<RecipeLabsConfigurationForm
  onSubmit={existingMenuSubmit}
  onSuccess={refreshExistingList}
/>
// Semua field, branch, default, validasi dan payload tetap dari form existing.
```

### 09. `app/components/campaign-forms/RecipeLabsConfigurationForm.js`

Cuplikan konseptual; renderExistingForm mewakili pemindahan JSX/controller aktual, bukan generic form baru.

**Code Sebelum (Current/Before)**

```jsx
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```jsx
export default function RecipeLabsConfigurationForm({ onSubmit, onSuccess }) {
  // Pindahkan state, handler, upload/preset dan JSX existing tanpa mendesain ulang.
  // Existing menu: submit langsung. Studio: callback capture konfigurasi.
  // Jalankan validator domain existing sebelum memanggil callback.
  return renderExistingForm({ onSubmit, onSuccess });
}
```

### 10. `app/components/ImportPlannerModal.js`

Reuse langsung konfigurasi Pillar; perubahan callback tidak boleh melewati validasi atau default existing.

**Code Sebelum (Current/Before)**

```jsx
export default function ImportPlannerModal({
  isOpen,
  onClose,
  initialPlannerId = '',
  onSuccess
}) {
  const [planners, setPlanners] = useState([]);
```

**Code Sesudah (Proposed/After)**

```jsx
export default function ImportPlannerModal({
  isOpen, onClose, initialPlannerId = '', onSuccess,
  onConfigurationSubmit = null, // Studio menerima payload tanpa memulai campaign.
}) {
  // Form existing tetap sama; guarded planner list menyaring consumed.
  // Jalur submit normal tetap menggunakan service ingest existing.
}
```

### 11. `lib/content-planner-engine.js`

Guard ditempatkan sebelum cabang Recipe dan sebelum rows dapat diganti; race generation vs consume harus diselesaikan oleh lease/transaction, bukan assert tanpa lock.

**Code Sebelum (Current/Before)**

```javascript
export async function executeContentPlanner(plannerId, researchInput = null) {
  const db = getDb();
  const planner = await db.prepare('SELECT * FROM content_planners WHERE id = ?').get(plannerId);
  if (!planner) {
    throw new Error('Planner tidak ditemukan.');
  }

```

**Code Sesudah (Proposed/After)**

```javascript
export async function executeContentPlanner(plannerId, researchInput = null) {
  return withPlannerGenerationLease(plannerId, async planner => {
    // Helper tenant-scoped atomik menolak reserved/consumed dan generation serentak.
    // Pipeline Planner existing, termasuk cabang Recipe, tetap dijalankan di sini.
  });
}
// regeneratePlannerRow memakai mutation lease/ownership guard yang sama.
```

### 12. `lib/content-planner-research-service.js`

Tolak apply pada Planner consumed; research tidak menjadi jalur regenerate tersembunyi. Mapping HTTP conflict dijaga di API.

**Code Sebelum (Current/Before)**

```javascript
export async function applyPlannerResearchRevision({
  plannerId,
  revisionId,
  actor = 'user',
  tenantId = 'default_tenant'
}) {
  if (!plannerId || !revisionId) {
```

**Code Sesudah (Proposed/After)**

```javascript
export async function applyPlannerResearchRevision(input) {
  await assertPlannerResearchApplicationAllowed(input);
  // Panggil executeContentPlanner existing; lease di engine tetap otoritatif.
  return applyExistingResearchRevision(input);
}
```

### 13. `lib/pillar-campaign-ingest.js`

Guard berlaku pada pemanggil menu lama, Studio dan Operator. Retry owner sama diterima, owner berbeda ditolak. Default aktivasi menu lama tetap; Studio memilih dispatch due.

**Code Sebelum (Current/Before)**

```javascript
export async function ingestPlannerToPillarCampaign({
  plannerId,
  selectedRowIds = [],
  campaignName,
  globalSettings = {},
  campaignId: requestedCampaignId = null
}) {
```

**Code Sesudah (Proposed/After)**

```javascript
export async function ingestPlannerToPillarCampaign(input) {
  return withPlannerConsumptionOwner(input, async ownership => {
    // Validasi tenant, snapshot/hash dan row subset milik owner.
    // createPillarCampaignBundle existing; ID deterministik milik owner.
    // Studio membuat hanya row/cohort due, tanpa membuka konsumsi baru.
    return ingestExistingPillarBundle(input, ownership);
  });
}
```

### 14. `lib/recipe-campaign-ingest.js`

Jalur Recipe khusus harus menjalankan aturan consumption yang sama dan tidak otomatis mengaktifkan semua row masa depan.

**Code Sebelum (Current/Before)**

```javascript
export async function ingestRecipePlannerToPillarCampaign({
  plannerId,
  selectedRowIds = [],
  campaignName = null,
  tenantId = null
}) {
  if (!plannerId) throw new Error('planner_id wajib diisi.');
```

**Code Sesudah (Proposed/After)**

```javascript
export async function ingestRecipePlannerToPillarCampaign(input) {
  return withPlannerConsumptionOwner(input, ownership =>
    ingestExistingRecipeBundle({ ...input, ownership })
  );
}
// Deterministic ID + kontrol aktivasi; start scheduler hanya setelah job due diaktifkan.
```

### 15. `lib/operator-content-worker.js`

Menjaga retry Operator compatible dengan aturan single-use, termasuk best_one/seleksi row dan crash sebelum job.campaign_id terisi.

**Code Sebelum (Current/Before)**

```javascript
    let campaignId = job.campaign_id;
    if (!campaignId) {
      campaignId = deterministicCampaignId(job.id);
      let selectedRowIds = request.selection?.mode === 'row_ids' ? request.selection.row_ids : [];
      if (request.selection?.mode === 'best_one') {
        const bestRow = await db.prepare(
          'SELECT id FROM content_planner_rows WHERE planner_id = ? ORDER BY sequence ASC, id ASC LIMIT 1'
```

**Code Sesudah (Proposed/After)**

```javascript
let campaignId = job.campaign_id;
if (!campaignId) {
  // Owner dibentuk server dari tenant + job.id, bukan dari request browser.
  const ownership = await reservePlannerForOperatorJob(job);
  // Ingest existing dengan ownership; recovery mengembalikan campaign yang sama.
  campaignId = await resumeOrCreateOwnedCampaign(job, ownership);
}
```

### 16. `app/api/content-planner/[id]/rows/[rowId]/route.js`

Tutup mutation entry point langsung. Error code konflik dipertahankan dalam HTTP response, bukan selalu 500.

**Code Sebelum (Current/Before)**

```javascript
export const PATCH = withTenantContext(async (request, { params }, user) => {
  try {
    const { id: plannerId, rowId } = await params;
    const body = await request.json();
    const db = getDb();

    const existingRow = await db.prepare('SELECT * FROM content_planner_rows WHERE id = ? AND planner_id = ?').get(rowId, plannerId);
```

**Code Sesudah (Proposed/After)**

```javascript
export const PATCH = withTenantContext(async (request, { params }) => {
  const { id: plannerId, rowId } = await params;
  return mutatePlannerRowWithLease({ plannerId, rowId, request });
});
// POST regenerate dan DELETE menggunakan guard lease/ownership yang sama.
// Tenant dan planner_id wajib pada SELECT/UPDATE/DELETE; consumed -> 409.
```

### 17. `app/api/content-planner/[id]/route.js`

Konsumsi tidak hilang dengan delete/unarchive. Archive tidak mengubah usage state.

**Code Sebelum (Current/Before)**

```javascript
export const PATCH = withTenantContext(async (request, { params }, user) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const db = getDb();

    const planner = await db.prepare('SELECT id, is_archived FROM content_planners WHERE id = ?').get(id);
```

**Code Sesudah (Proposed/After)**

```javascript
// GET memproyeksikan usage status tanpa membocorkan batch tenant lain.
export const PATCH = withTenantContext(archiveOrUpdateOwnedPlanner);
export const DELETE = withTenantContext(deleteOnlyUnconsumedPlanner);
// Arsip consumed diizinkan; hard delete/reuse consumed ditolak 409.
// Query join tenant/owner tetap wajib.
```

### 18. `app/api/content-planner/[id]/execute/route.js`

Service guard otoritatif; route meneruskan conflict status yang benar.

**Code Sebelum (Current/Before)**

```javascript
export const POST = withTenantContext(async (request, { params }, user) => {
  try {
    const { id } = await params;
    const result = await executeContentPlanner(id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[API /content-planner/[id]/execute POST Error]', error);
```

**Code Sesudah (Proposed/After)**

```javascript
export const POST = withTenantContext(async (request, { params }) => {
  try { return NextResponse.json(await executeContentPlanner((await params).id)); }
  catch (error) { return plannerErrorResponse(error); }
});
// PLANNER_ALREADY_CONSUMED dan PLANNER_BUSY -> 409, tenant denial -> 403/404.
```

### 19. `app/api/content-planner/[id]/research/[revisionId]/apply/route.js`

Gunakan tenant dari context, pertahankan body/response existing dan mapping 409 consumption.

**Code Sebelum (Current/Before)**

```javascript
export const POST = withTenantContext(async (request, { params }, user) => {
  try {
    const { id: plannerId, revisionId } = await params;
    const tenantId = user?.tenantId || 'default_tenant';

    const result = await applyPlannerResearchRevision({
      plannerId,
```

**Code Sesudah (Proposed/After)**

```javascript
export const POST = withTenantContext(async (request, { params }) => {
  try { return await applyOwnedPlannerResearch(await params); }
  catch (error) { return plannerErrorResponse(error); }
});
```

### 20. `app/content-planner/[id]/page.js`

Indikator UI melengkapi guard server, bukan pengganti guard.

**Code Sebelum (Current/Before)**

```jsx
'use client';

import Sidebar from '../../components/Sidebar';
import ImportPlannerModal from '../../components/ImportPlannerModal';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

```

**Code Sesudah (Proposed/After)**

```jsx
'use client';
// Gunakan projected usage state dari API.
// Consumed: tampilkan badge Terpakai dan riwayat batch; nonaktifkan generate,
// regenerate, edit/delete row, apply research dan ingest ulang.
// Arsip dan baca histori tetap tersedia; server tetap memvalidasi semuanya.
```

### 21. `app/api/v2/re-campaigns/route.js`

Ekstrak implementasi submit domain existing beserta seluruh side effect yang relevan; endpoint lama tetap backwards compatible.

**Code Sebelum (Current/Before)**

```javascript
export const POST = withTenantContext(async (request, _context, user) => {
  try {
    const contentType = request.headers.get('content-type') || '';
    let parsedBody = {};
    let urls = [];
    let productRefImagePath = null;
    let productFilenameDeclare = null;
```

**Code Sesudah (Proposed/After)**

```javascript
// Handler mempertahankan auth, format JSON/multipart dan response existing.
// Delegasikan create/validate/binding/enqueue ke campaign-submission-service.
// Jalur Studio memanggil service domain yang sama dengan ID deterministik.
// Jangan memanggil endpoint ini lewat localhost dari worker.
```

### 22. `app/api/v2/multiplier/route.js`

Ekstrak implementasi submit domain existing beserta seluruh side effect yang relevan; endpoint lama tetap backwards compatible.

**Code Sebelum (Current/Before)**

```javascript
export const POST = withTenantContext(async (request) => {
  try {
    const contentType = request.headers.get('content-type') || '';
    let parsedBody = {};
    let productRefImagePath = null;
    const batchTaskId = generateCampaignId('mul');

```

**Code Sesudah (Proposed/After)**

```javascript
// Handler mempertahankan auth, format JSON/multipart dan response existing.
// Delegasikan create/validate/binding/enqueue ke campaign-submission-service.
// Jalur Studio memanggil service domain yang sama dengan ID deterministik.
// Jangan memanggil endpoint ini lewat localhost dari worker.
```

### 23. `app/api/recipe-labs/route.js`

Ekstrak implementasi submit domain existing beserta seluruh side effect yang relevan; endpoint lama tetap backwards compatible.

**Code Sebelum (Current/Before)**

```javascript
export const POST = withTenantContext(async (request) => {
  try {
    const { getActiveTenantId } = await import('@/lib/tenant-context');
    const tenantId = getActiveTenantId() || 'default_tenant';
    const body = await request.json();
    const { 
      category, 
```

**Code Sesudah (Proposed/After)**

```javascript
// Handler mempertahankan auth, format JSON/multipart dan response existing.
// Delegasikan create/validate/binding/enqueue ke campaign-submission-service.
// Jalur Studio memanggil service domain yang sama dengan ID deterministik.
// Jangan memanggil endpoint ini lewat localhost dari worker.
```

### 24. `app/api/v2/publishing/jobs/route.js`

Shared service mempertahankan validasi/preflight/reconnect/Drive staging/ContentFlow sync, bukan hanya memanggil createPublishingJobs.

**Code Sebelum (Current/Before)**

```javascript
export const POST = withTenantContext(async (request, user) => {
  try {
    const tenantId = getActiveTenantId();
    const rawBody = await request.json();
    const validated = validateScheduleRequest(rawBody);

    const targets = validated.account_ids.map(accId => ({
```

**Code Sesudah (Proposed/After)**

```javascript
export const POST = withTenantContext(async (request, user) => {
  const result = await submitPublishingSchedule({
    tenantId: getActiveTenantId(), userId: user?.id,
    body: await request.json(),
  });
  return NextResponse.json(result);
});
```

### 25. `instrumentation.js`

Studio worker default off, tenant pilot tetap diperiksa sebelum claim/dispatch; tidak membuat worker Repliz kedua.

**Code Sebelum (Current/Before)**

```javascript
    if (backgroundServicesEnabled && process.env.ENABLE_CONTENT_AUTOMATION_WORKER !== 'false') {
      try {
        const { startContentAutomationWorker } = await import('./lib/content-automation-worker.js');
        startContentAutomationWorker();
      } catch (err) {
        console.error('❌ Failed to start Content Automation Worker:', err.message);
      }
```

**Code Sesudah (Proposed/After)**

```javascript
if (backgroundServicesEnabled && process.env.ENABLE_CONTENTFLOW_STUDIO === 'true') {
  const { startStudioWorker } = await import('./lib/contentflow-studio-worker.js');
  startStudioWorker();
}
// Boot scheduler/automation existing tetap dipertahankan.
```

### 26. `app/contentflow-studio/page.js`

Halaman utama mengikuti app layout/Sidebar dan menggunakan API Studio.

**Code Sebelum (Current/Before)**

```jsx
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```jsx
'use client';
export default function ContentFlowStudioPage() {
  return <StudioWorkspace />;
}
// Kalender/tabel + wizard inline menggunakan shared forms existing.
// Tidak ada Bank Ide, demo state, fixed dates atau form simulasi.
```

### 27. `app/components/contentflow-studio/StudioWorkspace.js`

Komponen orkestrasi UI; rincian file pecahan ditambahkan ke plan sebelum dibuat bila diperlukan.

**Code Sebelum (Current/Before)**

```jsx
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```jsx
'use client';
// Kalender/tabel, filter, detail produksi/review/publikasi, wizard satu sesi.
// Seluruh style memakai semantic CSS tokens app/theme.css.
// Pilih domain form shared, tampilkan runtime progress dari API.
export default function StudioWorkspace() { /* implementasi setelah ekstraksi */ }
```

### 28. `lib/contentflow-studio-contract.js`

Pisahkan state projection Studio dari enum domain existing.

**Code Sebelum (Current/Before)**

```javascript
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```javascript
export function validateStudioSchedule(input) {
  // validasi tenant timezone, production_at < publish_at, akun dan output mapping;
  // field konfigurasi campaign divalidasi validator existing.
}
export function projectStudioStatus(source, targets) {
  // ready bukan sekadar campaign finished; multi-account boleh partial.
}
```

### 29. `lib/contentflow-studio-repository.js`

Transaksi singkat dan unique constraints; network/AI di luar transaksi.

**Code Sebelum (Current/Before)**

```javascript
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```javascript
export async function consumePlannerIntoBatch(input) {
  // BEGIN; lock tenant-owned planner; reject generation/reservation/consumed conflict;
  // insert consumption + batch + slots + targets; freeze snapshot; COMMIT.
}
export async function claimDueStudioSlot(workerId) {
  // SELECT ... FOR UPDATE SKIP LOCKED; claim + checkpoint; COMMIT.
}
```

### 30. `lib/content-planner-consumption.js`

Satu mekanisme ownership digunakan semua entry point, bukan flag UI.

**Code Sebelum (Current/Before)**

```javascript
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```javascript
export async function withPlannerGenerationLease(plannerId, work) { /* claim, execute, finalize */ }
export async function withPlannerConsumptionOwner(input, ingest) { /* reserve, resume, finalize */ }
export async function assertPlannerResearchApplicationAllowed(input) { /* tenant + lease */ }
// Helpers mutation/Operator owner berada di service ini; owner browser tidak dipercaya.
```

### 31. `lib/campaign-submission-service.js`

Adapter shared submit untuk RE/Multiplier/Recipe; per-engine helper dapat tetap dipisah internal tanpa duplikasi.

**Code Sebelum (Current/Before)**

```javascript
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```javascript
export async function submitExistingCampaign({ kind, payload, files, owner }) {
  // Pindahkan validation/create/binding dari handler domain existing.
  // Existing caller: perilaku awal tetap. Studio: deterministic owner dan activation gate.
}
// Tidak menulis ulang prompt atau konfigurasi AI.
```

### 32. `lib/contentflow-studio-adapters.js`

Normalisasi progres/kesiapan tanpa mengambil alih pemrosesan produksi.

**Code Sebelum (Current/Before)**

```javascript
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```javascript
export async function dispatchStudioSlot(slot) {
  // Pilih mesin berdasarkan output/form contract existing.
  // Ingest row Planner hanya dari snapshot/owner batch.
  // Resume deterministic campaign/task yang sama; jangan dispatch dua kali.
}
export async function reconcileStudioSlot(slot) { /* source -> assets -> target jobs */ }
```

### 33. `lib/contentflow-studio-worker.js`

Distributed ownership diselesaikan DB, tidak hanya globalThis lock.

**Code Sebelum (Current/Before)**

```javascript
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```javascript
export async function runStudioTick() {
  // Recover checkpoint, claim due slots, dispatch adapter, reconcile.
  // Batasi concurrency; gunakan gate global background services dan tenant pilot.
}
export function startStudioWorker() { /* guarded single interval per process */ }
```

### 34. `lib/publishing-submission-service.js`

Studio dan endpoint lama memakai jalur provider yang sama.

**Code Sebelum (Current/Before)**

```javascript
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```javascript
export async function submitPublishingSchedule(input) {
  // Ekstrak alur penuh route publishing/jobs existing, termasuk preflight.
  // Gunakan repository/worker existing, sanitasi error dan idempotency.
}
```

### 35. `lib/contentflow-studio-publishing.js`

Tidak memakai approval creative sebagai izin publikasi, dan tidak kehilangan intent setelah crash.

**Code Sebelum (Current/Before)**

```javascript
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```javascript
export async function approveStudioPublication(input) {
  // Lock slot+targets; compare asset/caption/schedule revision hash;
  // persist immutable approval + durable scheduling intent atomically.
}
export async function resumeStudioPublishing(intent) {
  // submitPublishingSchedule; checkpoint job IDs, retry only failed targets.
}
```

### 36. `app/api/v2/contentflow-studio/batches/route.js`

Daftar/buat batch atau sesi Planner. Mengikuti dokumentasi Next.js lokal: params async, response error bersanitasi.

**Code Sebelum (Current/Before)**

```javascript
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```javascript
// Methods: GET, POST; auth + tenant context mandatory.
export const POST = withTenantContext(async (request, context) => {
  const params = context?.params ? await context.params : {};
  // Validate request, check ownership/role, call shared service.
  // Mutations require idempotency key + expected revision where applicable.
});
```

### 37. `app/api/v2/contentflow-studio/batches/[id]/actions/route.js`

Action generate Planner, consume batch, activate slots. Mengikuti dokumentasi Next.js lokal: params async, response error bersanitasi.

**Code Sebelum (Current/Before)**

```javascript
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```javascript
// Methods: POST; auth + tenant context mandatory.
export const POST = withTenantContext(async (request, context) => {
  const params = context?.params ? await context.params : {};
  // Validate request, check ownership/role, call shared service.
  // Mutations require idempotency key + expected revision where applicable.
});
```

### 38. `app/api/v2/contentflow-studio/calendar/route.js`

Projection kalender rentang waktu/tenant. Mengikuti dokumentasi Next.js lokal: params async, response error bersanitasi.

**Code Sebelum (Current/Before)**

```javascript
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```javascript
// Methods: GET; auth + tenant context mandatory.
export const GET = withTenantContext(async (request, context) => {
  const params = context?.params ? await context.params : {};
  // Validate request, check ownership/role, call shared service.
  // Mutations require idempotency key + expected revision where applicable.
});
```

### 39. `app/api/v2/contentflow-studio/slots/[id]/route.js`

Detail/edit dengan revision guard. Mengikuti dokumentasi Next.js lokal: params async, response error bersanitasi.

**Code Sebelum (Current/Before)**

```javascript
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```javascript
// Methods: GET, PATCH; auth + tenant context mandatory.
export const PATCH = withTenantContext(async (request, context) => {
  const params = context?.params ? await context.params : {};
  // Validate request, check ownership/role, call shared service.
  // Mutations require idempotency key + expected revision where applicable.
});
```

### 40. `app/api/v2/contentflow-studio/slots/[id]/actions/route.js`

Retry/cancel/review domain/manual publish dengan action allowlist. Mengikuti dokumentasi Next.js lokal: params async, response error bersanitasi.

**Code Sebelum (Current/Before)**

```javascript
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```javascript
// Methods: POST; auth + tenant context mandatory.
export const POST = withTenantContext(async (request, context) => {
  const params = context?.params ? await context.params : {};
  // Validate request, check ownership/role, call shared service.
  // Mutations require idempotency key + expected revision where applicable.
});
```

### 41. `app/api/v2/contentflow-studio/slots/[id]/approve-publish/route.js`

Approval hasil akhir dan durable scheduling intent. Mengikuti dokumentasi Next.js lokal: params async, response error bersanitasi.

**Code Sebelum (Current/Before)**

```javascript
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```javascript
// Methods: POST; auth + tenant context mandatory.
export const POST = withTenantContext(async (request, context) => {
  const params = context?.params ? await context.params : {};
  // Validate request, check ownership/role, call shared service.
  // Mutations require idempotency key + expected revision where applicable.
});
```

### 42. `scripts/migrate-contentflow-studio.mjs`

Migrasi additive eksplisit dan resumable; build remote menonaktifkan auto migrations.

**Code Sebelum (Current/Before)**

```javascript
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```javascript
// Default dry-run; --apply hanya pada environment/schema yang dinyatakan.
// Tambah tabel Studio dan unique consumption; gunakan advisory lock migration.
// Audit/backfill proven source_planner_id/Operator/Recipe ownership.
// Unknown lineage -> blocked audit; jangan hapus data lama.
// Tidak dijalankan oleh next build.
```

### 43. `tests/contentflow-studio.test.js`

Suite meaningful untuk risiko orkestrasi. Nama runner/fixture mengikuti test repository saat implementasi.

**Code Sebelum (Current/Before)**

```javascript
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```javascript
// Contract + transaction integration fixtures dengan data sintetis.
// Concurrent consume, same-owner retry, cross-tenant denial, crash recovery,
// future slot gate, readiness, stale approval dan partial-account publishing.
// Provider/AI dimock; API key hanya env, tanpa credential literal.
```

### 44. `sot/menus/contentflow-studio.md`

Dokumentasi diupdate setelah perilaku final terverifikasi.

**Code Sebelum (Current/Before)**

```markdown
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```markdown
# ContentFlow Studio
// Alur pengguna, referensi form existing, state mapping, Planner single-use,
// operasi worker, retry/recovery, feature flags dan runbook migrasi/rollback.
### 45. `plans/contentflow-studio/execution-notes.md`

Catatan eksekusi, baseline, matriks audit kontrak, keputusan teknis, dan verifikasi.

**Code Sebelum (Current/Before)**

```markdown
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```markdown
# Execution Notes — ContentFlow Studio
// Baseline git/lingkungan, inventarisasi kontrak 4 mesin & publishing, keputusan teknis, log pengujian.
```

## File yang dipakai tanpa perubahan awal

`app/theme.css`, `lib/publishing-worker.js`, `lib/repliz-client.js`, `lib/publishing-repository.js`, `lib/campaign-scheduler.js`, `lib/re-multiplier-worker.js`, `lib/scheduler-processors.js`, `lib/recipe-planner-engine.js`, dan ContentFlow ingest dipakai lewat kontrak existing. Jika gate due/readiness membutuhkan perubahan pada file tersebut, perlu perluasan plan dengan before/after terlebih dahulu.

File `package.json`, lockfile dan `sot/global/changelog.md` berubah saat prosedur rilis, bukan tahap dokumentasi ini. Before/after versi dan entry changelog wajib dicatat setelah nomor versi aktual diverifikasi; nomor versi tidak diprediksi sekarang.
