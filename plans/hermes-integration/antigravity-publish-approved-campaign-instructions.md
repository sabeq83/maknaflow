# Instruksi Antigravity — Implement Publish Approved Campaign

Kerjakan implementasi berdasarkan:

`plans/hermes-integration/publish-approved-campaign-implementation-plan.md`

## Objective

Tambahkan kemampuan “publish approved campaign” sehingga Hermes dapat memilih campaign yang seluruh videonya sudah manual-approved, membuat preview jadwal multi-video, dan membuat pending publishing plan. Approval final serta penciptaan Publishing Jobs tetap dilakukan manusia melalui MAKNA UI. Hermes tidak boleh mempunyai kewenangan approve dan tidak boleh memanggil Repliz.

## Non-Negotiable Rules

1. Baca `AGENTS.md` dan dokumentasi Next.js lokal yang relevan sebelum mengubah route.
2. Ikuti `## Execution Task List` dalam implementation plan dan ubah checkbox menjadi `[x]` segera setelah setiap tahap benar-benar selesai.
3. Jangan mengubah Strategic Campaign Single-Pass Engine.
4. Jangan mengakses atau menampilkan secret Repliz/operator/Hermes.
5. Semua query harus tenant-scoped.
6. Jangan percaya daftar ContentFlow ID dari client; intersect dengan server-side campaign lineage.
7. Hermes permanent credential hanya boleh mendapat `publishing:read,publishing:plan`.
8. Human approval wajib session-authenticated dan mengikat exact `revision + plan_sha256`.
9. Tidak boleh ada Publishing Job sebelum approval manusia.
10. Approval N item harus atomic dan idempotent. Kegagalan satu insert berarti nol job.
11. Jangan melakukan network call Repliz di dalam transaksi.
12. Jangan deploy Production. Jangan mengaktifkan `auto_publish`.

## Required Implementation Sequence

1. Audit dan dokumentasikan hubungan nyata antara agent/content automation run, operator job/campaign/planner rows, dan semua ContentFlow items.
2. Bila lineage belum deterministik, tambahkan foreign-key/reference metadata yang eksplisit; jangan memakai pencocokan nama.
3. Bekukan schema batch/items, state machine, canonical hashing, eligibility, dan error codes.
4. Implement migration idempotent.
5. Implement contract, repository, resolver/service, lalu API routes.
6. Refactor `createPublishingJobs` agar dapat memakai transaction client tanpa merusak caller lama.
7. Implement ContentFlow approval UI.
8. Update skill Hermes dan reference API: resolve → preview → confirmation → pending plan → approval URL → monitor.
   Parser skill wajib memisahkan `selected_video_count`, `videos_per_day`, dan `publish_times`. Dengan jam 10.00 dan 18.00, kapasitas default adalah dua video per hari; bila kata “N per hari” ambigu, Hermes wajib bertanya sebelum mutation.
9. Tambahkan tests sebelum smoke.
10. Jalankan test/build yang tercantum dalam plan.
11. Deploy hanya ke Dev dengan feature flag default off.
12. Verifikasi unauthorized, wrong scope, disabled flag, cross-tenant, duplicate, dan plan-without-jobs.
13. Aktifkan flag Dev hanya setelah checks lulus dan lakukan read-only preview.
14. Jangan melakukan approval smoke yang dapat menyentuh Repliz tanpa izin eksplisit pengguna.
15. Setelah verifikasi berhasil, jalankan SOP release patch, push, tag, dan verifikasi.

## Required Error Codes

Minimal gunakan error stabil:

- `CAMPAIGN_NOT_FOUND`
- `CAMPAIGN_NOT_FULLY_APPROVED`
- `CONTENT_NOT_IN_CAMPAIGN`
- `FINAL_MEDIA_NOT_READY`
- `CONTENT_ALREADY_SCHEDULED`
- `PUBLISHING_ACCOUNT_NOT_FOUND`
- `PUBLISHING_SLOT_CONFLICT`
- `PUBLISHING_PLAN_CHANGED`
- `PUBLISHING_PLAN_ALREADY_APPROVED`
- `IDEMPOTENCY_CONFLICT`
- `HERMES_PUBLISH_APPROVAL_FORBIDDEN`

Pesan API 5xx harus tersanitasi.

## Acceptance Tests

Implementasi belum selesai sebelum terbukti:

- N video approved menghasilkan tepat N slot dan N job.
- Jumlah video dinamis minimal 1 dan maksimal 30; tidak boleh hardcoded enam.
- Dua jam harian menghasilkan dua slot per hari. Jika `videos_per_day` tidak sama dengan jumlah jam, request harus meminta klarifikasi atau ditolak.
- N=5 pada pukul 10.00 dan 18.00 harus tersebar 2+2+1 selama tiga hari tanpa slot duplikat.
- Video ketujuh atau video tenant lain ditolak.
- Satu video unapproved membuat batch gagal/ditandai tidak eligible; tidak boleh diam-diam dilewati tanpa preview jelas.
- Hermes dapat preview dan create pending plan tetapi mendapat 403 pada approval.
- Pending plan menghasilkan nol Publishing Jobs.
- Exact human approval menghasilkan jumlah job yang sama dengan jumlah video terpilih.
- Dua approval paralel tetap menghasilkan N, bukan 2N job.
- Retry dengan key/body sama me-replay; body berbeda menghasilkan 409.
- Perubahan media/caption setelah preview membuat approval gagal karena hash mismatch.
- Failure pada item mana pun me-rollback seluruh job batch.
- Existing single publishing intent tetap lulus.
- Tidak ada secret di response, log, test fixture, changelog, atau Git.

## Safe Handoff

Di akhir, laporkan:

- release version, commit, dan tag;
- file yang berubah;
- hasil test/build;
- Dev URL dan feature-flag state;
- batch/run/job IDs smoke yang aman;
- bukti job count sebelum dan sesudah approval;
- batasan tersisa;
- konfirmasi tertulis bahwa Production dan auto-publish tidak disentuh.

Jika menemukan konflik arsitektur atau lineage tidak dapat dibuktikan, berhenti sebelum mutation dan laporkan bukti teknisnya. Jangan membuat workaround berbasis nama, urutan UI, atau direct Repliz call.
