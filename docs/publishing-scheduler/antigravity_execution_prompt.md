# Prompt Eksekusi Agent AI Antigravity — Publishing Scheduler

Salin seluruh prompt di bawah ini ke Agent AI Antigravity.

---

Implementasikan rencana lengkap berikut:

`docs/publishing-scheduler/implementation_plan.md`

Tujuan pekerjaan adalah menambahkan Publishing Scheduler Facebook dan Instagram ke menu Content Flow MAKNA Flow. Implementasi wajib bertahap dan aman. Jangan langsung mengaktifkan live publishing.

Instruksi wajib:

1. Baca `AGENTS.md` dan seluruh `docs/publishing-scheduler/implementation_plan.md` sebelum mengubah file.
2. Audit working tree terlebih dahulu. Jangan membuang, menimpa, mereset, atau memformat ulang perubahan pengguna yang tidak terkait.
3. Repository menggunakan Next.js 16.2.5 dengan breaking changes. Baca panduan relevan di `node_modules/next/dist/docs/`, khususnya Route Handlers, Server/Client Components, instrumentation, forms, dan caching sebelum menulis kode.
4. Verifikasi versi Graph API, endpoint, permission, App Review requirement, Instagram Professional account requirement, media constraints, dan rate limit terhadap dokumentasi resmi Meta yang berlaku saat implementasi. Jangan memakai asumsi training data dan jangan mempertahankan hard-coded `v19.0`.
5. Ikuti `## Execution Task List` secara kronologis. Setelah setiap tahap benar-benar selesai dan terverifikasi, segera ubah checkbox tahap tersebut dari `- [ ]` menjadi `- [x]` di rencana.
6. Gunakan PostgreSQL sebagai sumber kebenaran. Jangan menjadikan field `facebook_status`/`instagram_status` di Content Flow atau tabel `scheduler_jobs` lama sebagai antrean publishing utama.
7. Semua tabel, repository, API, dan worker harus tenant-aware. Tolak akses lintas tenant dan akun yang tidak diizinkan.
8. Satu job hanya untuk satu platform dan satu account. Facebook dan Instagram dari konten yang sama harus independen.
9. Simpan snapshot caption, media URL, media type, publish mode, account, dan schedule. Perubahan konten setelah scheduling tidak boleh diam-diam mengubah payload job.
10. Simpan waktu sebagai UTC dan tampilkan timezone eksplisit pada UI.
11. Klaim job secara atomik dengan PostgreSQL `FOR UPDATE SKIP LOCKED`. Commit transaksi sebelum network call ke Meta. Jangan menahan koneksi pool selama upload/publish.
12. Terapkan bounded concurrency global dan per account karena `PGPOOL_MAX` staging/dev hanya 3.
13. Terapkan local idempotency unique constraint, tetapi jangan menganggap Meta menjamin idempotensi eksternal. Bila request publish mungkin sudah sampai ke Meta tetapi response tidak diketahui, ubah status menjadi `verifying`; jangan langsung retry.
14. Implementasikan reconciliation menggunakan external container/post ID atau pemeriksaan provider sebelum retry pada hasil ambigu.
15. Implementasikan retry transient dengan exponential backoff dan jitter. Error permanent menjadi `failed`; error yang butuh operator menjadi `needs_review`.
16. Credential Meta disimpan terenkripsi dengan helper AES-256-GCM existing. Token/ciphertext tidak boleh muncul pada response API, browser, log, attempt message, test fixture real, atau source control.
17. Jangan menyimpan access token pada `publishing_jobs` atau `publishing_attempts`.
18. Pertahankan semua caller Facebook lama dalam mode draft. Refactor melalui compatibility adapter diperbolehkan, tetapi Recipe Labs, RE, dan Pillar tidak boleh berubah menjadi live.
19. Fase pertama yang harus berfungsi end-to-end adalah scheduled Facebook draft. Buktikan stabil pada tests/staging sebelum mengerjakan atau mengaktifkan Facebook live.
20. Facebook live harus berada di belakang feature flag dan approval eksplisit. Default tetap disabled.
21. Instagram harus memakai lifecycle container asynchronous: create container, simpan ID, poll readiness, publish, lalu reconciliation. Jangan menganggap satu call langsung selesai.
22. Instagram juga berada di belakang feature flag dan approval sampai pilot dinyatakan aman.
23. Lakukan media preflight sebelum schedule/publish: URL publik tanpa login, HTTPS, MIME benar, ukuran/durasi/dimensi/codec sesuai platform, serta masa hidup URL cukup untuk diproses Meta.
24. UI ditempatkan sebagai view/tab `Publishing Scheduler` di Content Flow dan mengikuti mockup:
    `/Users/sabeqmmursyid/.codex/visualizations/2026/08/11/019fef61-a937-7133-ae2d-31321cbc873a/content-flow-publishing-scheduler.html`
25. UI minimum: metrics, Antrean, Kalender, Riwayat, filter, detail job/attempt, schedule, reschedule, cancel, retry, approval, account health, dan global pause.
26. Status harus mempunyai label teks; jangan hanya mengandalkan warna. Pastikan desktop dan mobile usable.
27. Pause/resume global disimpan persisten di database dan hanya admin. Pause tidak boleh menghapus atau menandai gagal job terjadwal.
28. Content Flow menerima summary status, publish date, dan permalink setelah sukses, tetapi audit canonical tetap di tabel publishing.
29. Jangan mengubah Strategic Campaign Single-Pass Engine atau menambahkan Call 2.
30. Jangan menambah TikTok, YouTube, analytics, ads, comments, atau scope lain.
31. Jangan deploy production tanpa perintah manual eksplisit pengguna.

Urutan eksekusi minimum:

1. Jalankan baseline tests dan catat kegagalan yang sudah ada sebelum perubahan.
2. Implementasikan schema, index, contract, dan repository beserta tenant/concurrency tests.
3. Implementasikan encrypted account storage dan permission/account verification.
4. Implementasikan preflight, schedule API, snapshots, idempotency, listing/detail, cancel/reschedule, dan audit attempts.
5. Implementasikan Facebook draft publisher melalui abstraction dan compatibility adapter.
6. Implementasikan worker, health, global/account pause, retry, stale recovery, verifying, dan reconciliation.
7. Implementasikan UI Content Flow sesuai mockup.
8. Jalankan pilot/smoke test Facebook draft dengan worker feature flag.
9. Baru setelah seluruh Facebook draft acceptance test lulus, implementasikan Facebook live di belakang approval/flag.
10. Implementasikan Instagram container workflow di belakang approval/flag.
11. Perbarui SoT, runbook, implementation checklist, regression tests, dan build.
12. Review final diff dan lakukan release sesuai SOP.

Validasi minimum yang wajib dibuktikan:

- Competing worker hanya mengklaim satu job satu kali.
- Unique schedule/idempotency tidak menghasilkan duplicate job.
- Unknown external outcome masuk `verifying`, bukan publish ulang.
- Stale recovery aman setelah process restart.
- Wrong tenant/account ditolak.
- Token tidak bocor dalam API, log, UI, error, atau git diff.
- Legacy Facebook integrations tetap draft-only.
- Facebook scheduled draft menghasilkan satu external draft ID.
- Instagram menyimpan container ID dan menunggu status siap sebelum publish.
- UTC/timezone benar termasuk pergantian tanggal.
- Cancel/reschedule/retry mengikuti lifecycle dan tidak menghapus audit.
- Content Flow summary hanya berubah setelah hasil canonical diketahui.
- UI queue/calendar/history/detail dan mobile smoke test lulus.
- Seluruh tests relevan dan `npm run build` lulus.

Definition of Done:

- Semua acceptance criteria pada rencana terpenuhi dengan bukti test.
- Semua checkbox tahap yang benar-benar selesai sudah `[x]`; jangan mencentang tahap yang belum diuji.
- SoT `sot/global/publishing-scheduler.md` dan blueprint Facebook diperbarui.
- Feature flag default tetap aman; live Facebook dan Instagram tidak aktif otomatis.
- Tidak ada secret, access token, signed URL sensitif, base64 media, dump DB, atau runtime log ikut commit.
- `git diff` ditinjau dan perubahan tetap scoped.
- Setelah verifikasi berhasil, jalankan SOP release non-interaktif patch:

```bash
npm run release-non-interactive -- --type patch --title "Content Flow Publishing Scheduler" --points "Menambahkan antrean dan kalender publishing tenant-aware|Menambahkan Facebook draft scheduler dan fondasi Instagram yang aman|Menambahkan audit retry rekonsiliasi dan monitoring publishing"
```

- Setelah release, verifikasi version, `sot/global/changelog.md`, commit, tag `vX.Y.Z`, branch `main`, dan remote `https://github.com/sabeq83/maknaflow.git` sudah sinkron.
- Jangan berhenti setelah menulis kode. Lanjutkan sampai tests, build, smoke validation, documentation, checklist, diff review, release, tag, dan push selesai kecuali benar-benar diblokir credential Meta, approval eksternal, atau instruksi production.

Mulai dengan menampilkan ringkasan audit baseline dan urutan file yang akan disentuh, lalu langsung kerjakan scope yang sudah disetujui tanpa meminta konfirmasi tambahan. Jika credential Meta tidak tersedia, selesaikan seluruh implementasi dengan mocked provider dan tandai hanya pilot eksternal sebagai blocked; jangan menebak credential.

---
