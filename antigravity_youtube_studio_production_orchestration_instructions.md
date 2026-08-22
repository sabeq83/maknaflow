# Instruksi Agent AI Antigravity — YouTube Studio Production Orchestration

## Mandat

Implementasikan sepenuhnya dan berurutan:

1. `sot/menus/youtube-studio-production-orchestration-implementation-plan.md`
2. `sot/menus/youtube-studio-hybrid-production-implementation-plan.md`
3. `sot/menus/youtube-studio-production-factory-implementation-plan.md`
4. `AGENTS.md`

Tujuan: tombol **Approve & Start Production** pada workflow hybrid harus memulai tahapan yang benar dan dapat diobservasi: job benar-benar dikonsumsi worker, start frame mencapai review, lalu approval berlapis memicu VO, I2V/T2V, preview, dan final render secara aman.

## Fakta Audit yang Tidak Boleh Diabaikan

- `Approve & Start Production` sekarang membuat package `approved` serta row pada `youtube_production_jobs` dan `scheduler_jobs`, tetapi job berhenti `queued`/`pending` dengan attempts `0`.
- Dev `scheduler_config` tidak berisi queue YouTube.
- Scheduler hanya men-tick queue yang terkonfigurasi; queue yang digunakan pipeline (`youtube_production_asset`, `youtube_production_assembly`, `youtube_production_final`) belum dibootstrap.
- UI menyatakan asset generation telah dimulai padahal worker belum meng-claim apa pun.
- Batch hybrid saat ini dibuat langsung `approved`; ini melanggar gate review yang sudah disepakati.
- Jangan menganggap Fase 3 selesai hanya karena prompt package dapat dibuat. Bukti minimum adalah job meninggalkan queue dan mencapai status review yang benar.

## Bacaan dan Audit Wajib

1. Baca `AGENTS.md` lengkap.
2. Baca seluruh plan di atas sebelum edit, termasuk checklist dan before/after snippet.
3. Baca dokumentasi Next.js lokal yang relevan sebelum menyentuh route handler atau component.
4. Audit sebelum edit:
   - `lib/scheduler.js`, `lib/db.js`, `lib/db-pg.js`;
   - `instrumentation.js`, `apps/api/server.js`, `ecosystem.macmini.config.cjs`;
   - `lib/youtube-studio-production-repository.js`, `lib/youtube-studio-production-worker.js`;
   - start-frame, visual, voice, dan render adapters;
   - hybrid-production route dan UI Episode Workspace;
   - schema/migration, current tests, dan `git status --short`.
5. Lindungi perubahan user/agent lain. Jangan reset, delete, atau overwrite perubahan yang tidak terkait.

## Keputusan Implementasi yang Wajib Dipatuhi

- Tetap gunakan PostgreSQL `scheduler_jobs` sebagai durable outbox. Jangan membuat jalur eksekusi langsung di request dan jangan membuat queue kedua.
- Tentukan **satu** consumer owner yang berjalan nyata pada Dev. Jika memakai scheduler global, perbaiki async bootstrap dan daftarkan semua queue YouTube; jika memakai worker khusus, gunakan claim PostgreSQL atomik dan cegah consumer ganda.
- Jangan bergantung pada browser request untuk menjaga worker hidup.
- Queue wajib: `youtube_production_asset`, `youtube_production_assembly`, `youtube_production_final`.
- Bootstrap config bersifat idempotent, tidak auto-create job YouTube, dan tidak menimpa setting operator.
- Semua job payload memuat `tenant_id`; worker wajib masuk tenant context sebelum repository/provider call.
- Job claim harus aman terhadap concurrency (`FOR UPDATE SKIP LOCKED` atau ekivalen atomik), bounded concurrency, retry/backoff, dan graceful shutdown.
- Tidak boleh ada placeholder video yang ditandai sukses untuk static/b-roll. Gunakan source asset valid atau state `review_required`/`blocked` yang jujur.

## State Machine Hybrid

```text
Prompt draft
→ approve prompt package
→ start-frame batch queued → generating → reviewing
→ approve start frame
→ VO batch queued → generating → reviewing
→ approve VO
→ visual batch queued → generating → reviewing/completed
→ preview ready
→ explicit final-render approval
→ Ready to Publish
```

- Approval hanya diterima saat batch sebelumnya `reviewing` dan seluruh requirement persisted lolos.
- Start frame T2I hanya menyimpan reference asset lalu berhenti untuk review.
- TTS berhenti untuk review.
- I2V membutuhkan approved `image_path`; T2V tidak boleh memerlukan image; keduanya hanya dimulai setelah VO approved.
- Repeated approval/retry harus idempotent: tidak membuat duplicate job/batch atau request provider baru.

## UI/API

- Read model hybrid harus memuat package, batch, job summary, per-stage progress/error, next eligible action, dan retry eligibility.
- Gunakan response server sebagai source of truth. Jangan set episode status atau success toast yang mengklaim stage lebih jauh dari yang benar.
- Ubah pesan sukses menjadi tahap aktual, misalnya “Prompt package approved. Start-frame jobs are queued.”
- Gunakan CSS Module dan semantic token `app/theme.css`; tidak ada hex/rgb/rgba/style visual inline baru pada file yang disentuh.
- Semua API tetap permission-gated, tenant-scoped, dan tidak menampilkan credential/raw prompt/KB private.

## Test dan Smoke Dev

1. Tambahkan provider mocks untuk T2I, TTS, I2V/T2V, assembly, dan failure/retry—jangan memakai G-Labs/TTS nyata pada automated test.
2. Test queue bootstrap, worker claim, tenant isolation, approval gates, idempotency, batch recomputation, dan UI/API read model.
3. Dev smoke wajib membuktikan:

```text
approve prompt package
→ scheduler job pending berubah running
→ production job queued berubah running
→ start-frame asset/batch menjadi reviewing
```

4. Gunakan episode kecil dan biaya minimum. Jangan final render, publish, atau upload kecuali ada instruksi manual eksplisit baru dari user.
5. Jangan mengambil credential dari browser, database, log, atau environment pengguna. Terima credential/token hanya sebagai runtime input user; jangan cetak credential/raw prompt.

## Deployment

Hanya boleh:

```bash
npm run deploy:macmini-dev
```

- Dev saja: UI `5020`, App Router API `5020`, database schema `dev`.
- Jangan deploy staging atau production.
- Jangan polling SSH berulang saat remote build; tunggu satu proses deploy selesai.

## Progress, Release, dan Laporan

- Update checkbox di `sot/menus/youtube-studio-production-orchestration-implementation-plan.md` segera setelah setiap tahap benar-benar diverifikasi.
- Jika scope file bertambah, tambahkan file tersebut ke bagian Planned File Changes beserta Code Sebelum/Code Sesudah sebelum mengedit.
- Setelah build, focused tests, dan Dev smoke lulus, jalankan SOP release `AGENTS.md` dengan command yang ada di plan.
- Laporan akhir wajib menyertakan: consumer ownership, file berubah, hasil test/smoke (tanpa credential), evidence state transition, bukti Dev-only deployment, batasan tersisa, versi release/commit/tag/push.
