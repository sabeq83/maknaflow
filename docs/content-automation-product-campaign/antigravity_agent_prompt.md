# Prompt Eksekusi untuk AI Agent Antigravity

Salin seluruh prompt di bawah ini ke AI Agent Antigravity. Jalankan dari root repository MAKNA Flow yang benar.

---

## PROMPT

Anda bertugas mengimplementasikan fitur **Content Automation Product Campaign berbasis OPC** pada repository MAKNA Flow.

### Sumber kebenaran

Baca penuh dan ikuti dokumen berikut sebelum mengubah kode:

```text
docs/content-automation-product-campaign/implementation_plan.md
```

Dokumen tersebut adalah specification dan execution checklist utama. Bila ada perbedaan antara asumsi Anda dan dokumen, ikuti dokumen. Bila ditemukan fakta kode/database yang membuat desain tidak bisa diterapkan secara persis, pertahankan tujuan dan invariant-nya, dokumentasikan deviasi secara jelas, lalu gunakan implementasi paling kompatibel dengan arsitektur existing.

### Koreksi arsitektur yang wajib dipatuhi

- **Strategic Campaign sudah dihapus.**
- Jangan membuat, mengaktifkan kembali, atau merujuk Strategic Campaign sebagai runtime dependency.
- Gunakan **OPC (Organic Pillar Campaign)** sebagai satu-satunya acuan creative dan production pipeline.
- Pertahankan OPC Single-Pass Creative Generation: storyboard, VO, Video DNA, prompt visual, caption, hashtag, dan CTA dihasilkan oleh generator OPC yang sama.
- Generate start frame adalah asset pre-production stage setelah creative output, bukan creative call kedua.

### Outcome yang harus tercapai

Implementasikan alur berikut:

```text
Content Automation schedule/run-now
→ user memilih Product Campaign + Brand Profile + Product
→ capture immutable product/affiliate snapshot
→ Product Content Planner
→ ingest ke OPC
→ OPC single-pass creative generation
→ generate seluruh start frame wajib
→ awaiting approval
→ approval per row di OPC atau Approve All Ready Items di Content Automations
→ TTS
→ video generation
→ FFmpeg
→ upload final
→ automatic idempotent sync ke ContentFlow
```

Brand Editorial Campaign yang sudah ada harus tetap backward-compatible.

### Prosedur kerja wajib

1. Mulai dengan membaca `AGENTS.md` dan instruksi repository.
2. Karena repository menggunakan versi Next.js dengan breaking changes, baca dokumentasi yang relevan di:

   ```text
   node_modules/next/dist/docs/
   ```

   Minimal baca dokumentasi App Router route handlers, server/client components, forms, dan data fetching yang relevan sebelum mengubah file Next.js.

3. Jalankan:

   ```bash
   git status --short
   ```

   Jangan menimpa perubahan user atau perubahan unrelated yang sudah ada.

4. Baca penuh implementation plan dan inspeksi seluruh file target aktual. Jangan mengandalkan snippet saja.
5. Jalankan baseline tests yang relevan sebelum perubahan.
6. Kerjakan sesuai urutan `## Execution Task List`.
7. Setelah setiap task selesai dan terverifikasi, segera ubah checkbox terkait dari `[ ]` menjadi `[x]` di:

   ```text
   docs/content-automation-product-campaign/implementation_plan.md
   ```

8. Jangan menandai task selesai sebelum kode dan verifikasinya benar-benar selesai.
9. Gunakan migration yang idempotent dan backward-compatible. Hindari destructive schema changes.
10. Gunakan service/repository existing; jangan menduplikasi business logic ke route atau UI.

### Invariant implementasi

#### Tenant dan authorization

- Semua product lookup, schedule, run, snapshot, OPC item, asset, approval, dan ContentFlow sync wajib tenant-scoped.
- Jangan menerima `tenant_id` dari request body sebagai sumber otoritatif.
- Bulk approval hanya admin atau permission khusus yang sah.
- Server wajib menghitung ulang eligibility dan review revision.

#### Product Campaign

- Product Campaign wajib memilih Brand Profile dan produk yang terhubung/eligible.
- Product Planner count hanya 6, 12, 18, 24, atau 30.
- Snapshot produk dibuat saat run didispatch, bukan dibaca ulang diam-diam ketika produksi berlanjut.
- Campaign product binding dan affiliate routing harus binding-first.

#### Approval checkpoint

- Manual Product Campaign default memakai `approval_mode=start_frames`.
- Item baru `ready_for_review` jika creative package lengkap dan seluruh start frame wajib selesai.
- Visual mode yang tidak membutuhkan start frame memakai `skipped` secara eksplisit.
- TTS/video/FFmpeg tidak boleh berjalan sebelum current revision di-approve.
- Approval stale revision harus mengembalikan `409`.
- Approval ganda/current revision harus idempotent.
- Partial approval diperbolehkan; item approved boleh diproduksi sementara item lain masih direview.

#### Production dan ContentFlow

- Gunakan idempotency key per item/revision/tahap.
- Failure satu item tidak boleh memblokir item approved lain.
- Automatic ContentFlow sync hanya setelah final media siap.
- ContentFlow retry tidak boleh mengulang FFmpeg atau upstream production.
- Upsert harus stabil dan tidak menghasilkan duplicate item.

#### Compatibility

- Schedule lama tanpa `campaign_kind` dianggap `brand_editorial`.
- Legacy approval mode `storyboard` dinormalisasi menjadi `creative`.
- Preset editorial existing tetap bekerja.
- Social auto-posting tetap off.
- Jangan mengubah perilaku RE, Instant Factory, Bridge, atau Multiplier.

### Panduan desain kode

- Pisahkan product snapshot resolver, start-frame orchestration, approval transaction, dan ContentFlow sync menjadi service yang dapat dites.
- Endpoint start-frame regenerate/replace harus menggunakan service yang sama dengan automation worker.
- Provider task harus asynchronous/non-blocking: submit, simpan task ID, lalu poll pada tick selanjutnya.
- Pakai unique constraints dan transaction locks untuk menjaga idempotency.
- Isi format legacy start-frame path/JSON selama masa compatibility bila konsumen existing masih membutuhkannya.
- Jangan log secret, API key, token, atau credential affiliate/provider.

### UI yang harus dibuat

Pada `Content Automations`:

1. Campaign Type: Brand Editorial / Product Campaign.
2. Cascading selector Brand Profile → Product.
3. Product completeness/snapshot preview.
4. Product Planner count 6/12/18/24/30.
5. OPC Product Campaign preset.
6. Manual Review after Start Frames / Full Auto.
7. Toggle automatic ContentFlow sync.
8. Run cards dengan progress:

   ```text
   Planner / Creative / Start Frames / Approval / Production / ContentFlow
   ```

9. Link `Open OPC Review`.
10. Tombol `Approve All Ready Items` dengan confirmation dialog revision-safe.
11. Retry failed pre-production dan retry ContentFlow secara terpisah.
12. Empty/loading/error/partial/completed-with-warning states.

Gunakan mockup berikut sebagai referensi visual dan interaction hierarchy, bukan sebagai kode production yang harus disalin mentah:

```text
public/mockups/content-automation-product-campaign.html
```

Pertahankan design system dan komponen aplikasi MAKNA Flow yang sudah ada.

### Test minimum wajib

Tambahkan atau perluas test untuk:

- editorial legacy contract;
- Product Campaign valid/invalid fields;
- cross-tenant product rejection;
- product snapshot immutability;
- start-frame manifest per clip;
- partial start-frame failure dan retry satu clip;
- worker restart recovery;
- no TTS before approval;
- per-row approval;
- bulk partial approval;
- stale revision `409`;
- double/concurrent approval idempotency;
- ContentFlow sync success, duplicate prevention, retry, dan permanent failure;
- ContentFlow retry tidak menjalankan ulang production;
- schedule/run idempotency existing.

### Verifikasi akhir

Lakukan secara proporsional dan berurutan:

1. Unit/contract tests.
2. Integration tests dengan database test atau schema `dev` yang benar.
3. Lint.
4. Production build.
5. Deploy hanya ke **Server Dev Mac Mini** dengan `npm run deploy:macmini-dev`.
6. Verifikasi UI Dev port 5020, API Dev port 7020, PM2 Dev, schema `dev`, dan `PGPOOL_MAX=3`.
7. Smoke test Product Campaign 6 item di Server Dev Mac Mini.
8. Verifikasi per-row OPC approval.
9. Verifikasi bulk approval dari Content Automations.
10. Verifikasi TTS → video → FFmpeg.
11. Verifikasi automatic ContentFlow sync dan retry-only ContentFlow.
12. Jalankan health check environment Dev yang relevan.

### Target deployment wajib

Gunakan hanya target berikut:

```text
SSH host       : masbenu@100.95.245.55
Remote folder  : ~/maknaflow-dev
UI port        : 5020
API port       : 7020
Database schema: dev
PM2 environment: dev
PGPOOL_MAX     : 3
Deploy command : npm run deploy:macmini-dev
```

- Jangan menjalankan `npm run deploy:staging`.
- Jangan menjalankan `node scripts/deploy-macmini.js`.
- Jangan deploy atau rsync ke `~/maknaflow-staging`.
- Jangan mengakses UI 5010/API 7010 sebagai target deployment atau smoke test fitur ini.
- Jangan deploy ke Production tanpa instruksi manual eksplisit.
- Remote build harus mengikuti SOP zero-spam: jangan polling SSH setiap 10–15 detik; tunggu sekitar dua menit sebelum pemeriksaan lanjutan.

Jika test membutuhkan API provider berbayar/eksternal, gunakan mock/fake provider terlebih dahulu. Jangan membuat biaya eksternal tanpa otorisasi yang memang sudah tersedia dalam scope environment.

### Release SOP

Setelah seluruh implementasi dan verifikasi berhasil, lakukan release sesuai `AGENTS.md`:

```bash
npm run release-non-interactive -- --type patch --title "Content Automation Product Campaign" --points "Tambah Product Campaign berbasis OPC|Tambah review setelah start frame|Tambah approval parsial dan auto-sync ContentFlow"
```

Verifikasi version, changelog, commit, tag, push branch `main`, dan push tag. Deployment fitur hanya ke Server Dev Mac Mini. Jangan melakukan deployment ke Server Staging Mac Mini atau Production.

### Kondisi berhenti

Jangan berhenti hanya setelah menulis kode. Tugas selesai hanya jika:

- seluruh acceptance criteria relevan terpenuhi;
- seluruh task checklist ditandai berdasarkan bukti aktual;
- tests/build berhasil atau blocker eksternal didokumentasikan dengan bukti;
- tidak ada regression pada Brand Editorial Content Automation;
- release SOP selesai bila semua verifikasi lulus.

Jika benar-benar diblokir, tuliskan:

1. task checklist yang terdampak;
2. command/test yang dijalankan;
3. error lengkap yang relevan;
4. analisis akar masalah;
5. perubahan yang sudah dibuat;
6. langkah minimal untuk membuka blocker.

Jangan menyamarkan task gagal sebagai selesai.

---

## END PROMPT
