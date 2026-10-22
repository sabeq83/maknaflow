# Instruksi Eksekusi Antigravity — ContentFlow Studio

## Mandat

Implementasikan ContentFlow Studio sampai siap direview dan digunakan pada Dev/Staging, mengikuti rencana berikut secara berurutan:

- Workspace: `/Users/sabeqmmursyid/_contentflow-staging`
- Rencana utama: `plans/contentflow-studio/implementation_plan.md`
- Referensi visual: `public/mockup_contentflow_studio.html` versi revisi tanpa Bank Ide.
- Repository tujuan: `https://github.com/sabeq83/maknaflow.git`

Kerjakan implementasi aplikasi, bukan sekadar mempercantik mockup. Hasil harus terhubung ke database, form, mesin produksi, aset ContentFlow, dan layanan publikasi existing. Jangan melaporkan selesai apabila salah satu jenis campaign masih berupa placeholder.

Dokumen ini adalah instruksi untuk agen pelaksana. Pembuat dokumen belum menjalankan implementasi, migrasi, rilis, atau deployment Studio.

## Urutan sumber kebenaran

1. Instruksi pengguna dan `AGENTS.md` yang berlaku.
2. Keputusan produk di bawah ini dan keputusan mengikat pada rencana utama.
3. Perilaku/kontrak aktual kode existing untuk konfigurasi dan eksekusi campaign.
4. Mockup revisi untuk struktur visual dan alur orkestrasi.
5. Cuplikan Proposed/After pada rencana sebagai ilustrasi kontrak, bukan kode final.

Penting: mockup standalone tidak memuat form React asli. Panel “Form existing”, tombol simulasi, data demo, contoh enam judul, dan tautan ke menu lama merupakan representasi titik integrasi, bukan desain konfigurasi baru atau implementasi final. Jangan menyalinnya menjadi fitur aplikasi.

Jika contoh Proposed/After menyebut helper seperti `renderExistingForm`, `ingestExistingPillarBundle`, atau `applyExistingResearchRevision`, anggap itu pseudocode. Implementasikan dengan fungsi, import, komponen dan transaksi yang nyata; jangan meninggalkan helper tak terdefinisi, TODO fungsional, return palsu, atau stub sukses.

## Keputusan produk final — wajib dipertahankan

1. Kalender bulan berjalan adalah tampilan awal, dengan pilihan tabel. Tanggal mengikuti waktu aktual tenant.
2. User menambah jadwal produksi dan target tayang sebagai dua waktu berbeda.
3. Konfigurasi campaign harus menggunakan form existing yang sama, termasuk seluruh field, pilihan, default, kondisi, preset, upload, dan validasi yang sudah teruji.
4. Studio merender form bersama secara inline/modal/drawer. Membuka menu lama atau iframe halaman lama tidak memenuhi integrasi form.
5. Jenis utama: Reverse Engineering, Multiplier, Recipe, Pillar Campaign. Cabang gambar/video Recipe harus mengikuti kemampuan aktual kode, bukan asumsi label mockup.
6. Generator Content Planner merupakan tahap persiapan Pillar dan jalur Recipe yang membutuhkan Planner. RE/Multiplier tetap memakai sumber existing masing-masing.
7. **Tidak ada Bank Ide. Tidak ada library hasil Planner yang bisa digunakan berulang.**
8. Planner dibuat baru → digenerate → direview dalam wizard → hasil ditempatkan ke satu batch kalender → Planner terpakai dan terkunci.
9. Planner consumed tidak bisa dipakai lagi dari Studio, menu lama, API langsung, ataupun Operator. Tidak bisa regenerate/mutasi/delete untuk menghindari penguncian. Arsip dan baca histori tetap diperbolehkan.
10. Retry batch/job yang sama melanjutkan checkpoint yang sama. Retry bukan konsumsi baru dan tidak membuat konten/job tambahan.
11. Simpan jadwal menghasilkan Draft. Generate Content mengaktifkan produksi; worker menunggu waktu produksi dan kapasitas mesin existing.
12. Hasil akhir masuk Ready untuk review. Approval creative/start frame mengikuti konfigurasi existing dan berbeda dari approval publikasi hasil akhir.
13. Setelah manusia menyetujui hasil akhir, gunakan layanan publishing existing dengan Repliz. Scheduling, Scheduled, dan Published harus dapat dibedakan.
14. Status publikasi dan pemulihan berlaku per akun. Akun sukses tidak dipublikasikan ulang ketika akun lain gagal.
15. Kegagalan menyediakan retry/reschedule, download aset nyata, copy caption, dan pencatatan upload manual dengan bukti/permalink.
16. Semua warna menggunakan semantic tokens `app/theme.css`; mendukung light/dark. Jangan mengubah token tema global untuk menyesuaikan Studio.

## Langkah awal sebelum menulis kode

1. Baca penuh `AGENTS.md`, rencana utama, dan mockup revisi.
2. Baca panduan relevan di `node_modules/next/dist/docs/` untuk route handlers, async params, client/server components dan instrumentation. Jangan mengandalkan API Next.js dari ingatan.
3. Periksa branch, HEAD, remote, status staged/unstaged, serta proses yang sedang berjalan. Catat baseline tanpa menampilkan secret.
4. Workspace dapat berisi pekerjaan pihak lain, termasuk perubahan mockup/rencana yang sudah disetujui. Jangan reset, stash, overwrite, atau commit semuanya secara membabi buta.
5. Isi `plans/contentflow-studio/execution-notes.md` dengan baseline, matriks form/payload, keputusan teknis, hasil test, dan blocker nyata. Sebelum membuat file ini atau file tambahan lain, tambahkan entri Before/After pada rencana utama; untuk file baru gunakan “file belum ada”.
6. Verifikasi seluruh caller submit/ingest, bukan hanya halaman menu utama. Sertakan Operator, Recipe ingest, research apply, dan API edit/regenerate/delete Planner.
7. Jangan memulai migrasi atau ekstraksi form sebelum audit tahap 01 selesai dan dicatat.

## Prosedur pengerjaan per tahap

Ikuti `## Execution Task List` pada rencana utama. Setelah setiap tahap benar-benar selesai, segera tandai `[x]`. Jangan mencentang tahap hanya karena sebagian file dibuat. Beri update singkat berisi hasil, bukti, dan pekerjaan berikutnya. Jika konteks berganti, lanjut dari checkbox/checkpoint terakhir; jangan mengulang pekerjaan atau meminta otorisasi rutin yang sudah diberikan.

### Tahap 01 — Inventarisasi kontrak nyata

Buat matriks per mesin: file form/controller, seluruh field/branch/default, preset, upload, validator, payload JSON/multipart, API/service, status awal, trigger scheduler, jumlah output, review gate, aset akhir, dan sinkronisasi ContentFlow.

Prioritaskan pembacaan:

- `app/content-planner/page.js` dan `[id]/page.js`.
- `app/components/ImportPlannerModal.js`.
- `app/re-campaigns/page.js`, `app/multiplier-lab/page.js`, `app/recipe-labs/page.js`.
- `lib/content-planner-engine.js`, `lib/recipe-planner-engine.js`.
- `lib/pillar-campaign-ingest.js`, `lib/recipe-campaign-ingest.js`, `lib/operator-content-worker.js`.
- Handler create campaign, campaign scheduler, Multiplier worker, ContentFlow ingest.
- `app/api/v2/publishing/jobs/route.js`, repository/worker publishing, dan `lib/repliz-client.js`.

Kriteria selesai: jumlah output, mapping sumber→item, dan jalur aktivasi tiap mesin diketahui; tidak ada konfigurasi baru yang dikarang.

### Tahap 02–03 — Data dan Planner sekali pakai

Implementasikan migration additive eksplisit, kontrak, repository, consumption ledger, dan server-side guard sebelum UI dapat mengaktifkan pekerjaan.

- Unique consumption per tenant+planner; owner batch/job ditentukan server.
- Konsumsi Studio dan penciptaan seluruh slot/target berlangsung atomik dalam satu transaksi.
- Tidak melakukan call AI/HTTP di dalam transaksi atau menahan koneksi sepanjang generasi.
- Untuk caller lama yang membuat campaign langsung, gunakan reserve → ingest idempotent → finalize dengan checkpoint/recovery deterministik.
- Guard mencakup full generate, row edit/regenerate/delete, research apply, ingest Pillar/Recipe, Operator dan delete Planner. Query wajib tenant-scoped.
- Race generate vs consume harus tertutup oleh lease/lock nyata; pengecekan boolean sebelum mutation tidak cukup.
- Retry owner sama mengembalikan output lama; owner lain ditolak 409. Reservation tidak dibuka ulang hanya karena lewat timeout.
- Cancel/archive/hapus slot tidak membebaskan Planner. Ledger dan audit tetap bertahan.
- Backfill consumption hanya dari lineage yang terbukti. Relasi ambigu ditandai untuk audit, tidak dihapus atau ditebak dari status completed.
- Jalankan dry-run dulu, lalu apply pada database pengujian/Dev yang dituju secara eksplisit. Jangan menyentuh schema Production.

Kriteria selesai: dua pemakai bersamaan hanya menghasilkan satu owner/batch, recovery tidak menduplikasi campaign, dan semua mutation bypass tertutup.

### Tahap 04–05 — Reuse form dan service existing

Ekstrak form/controller secara mekanis. Menu lama dan Studio harus menggunakan komponen yang sama. Hindari menyalin JSX lalu membiarkan dua implementasi berkembang sendiri.

- Pertahankan semua pilihan, upload, preset, kondisi, validasi dan format payload.
- Pisahkan callback capture konfigurasi Studio dari callback submit langsung menu lama.
- Capture konfigurasi Studio tidak boleh menciptakan campaign running atau memicu scheduler sebelum waktunya.
- Ekstrak submit service dari route existing agar worker dapat memanggil layanan domain langsung. Pertahankan response/auth handler lama dan default perilakunya.
- Ekstrak layanan publishing secara penuh: validasi, akun, reconnect, preflight, media staging, create jobs dan sync ContentFlow. Jangan hanya membungkus `createPublishingJobs` sambil melewati gate existing.
- Identifikasi file permission/role aktual dan tambahkan ke plan sebelum mengubahnya.

Kriteria selesai: input sama menghasilkan payload setara dari menu lama dan Studio; regresi tiap cabang form diverifikasi.

### Tahap 06–07 — UI, API dan worker Studio

Implementasikan `/contentflow-studio`, menu/permission, kalender/tabel, wizard Planner satu sesi, jadwal per output, API tenant-aware, dispatch dan reconcile.

- Tidak membawa fixed date, data contoh, localStorage demo, tautan pengganti form, tombol simulasi, atau placeholder ke alur produksi.
- Tidak membuat worker TTS/visual/FFmpeg/publishing baru. Worker Studio hanya dispatch/reconcile mesin existing.
- Claim menggunakan DB atomik; lock proses lokal saja tidak cukup untuk beberapa instance/server.
- Future slot tidak boleh mulai karena campaign induk/batch diaktifkan. Dispatch hanya row/cohort yang sudah due; perubahan gate pada worker existing harus ditambahkan ke plan sebelum coding.
- Mapping output lebih dari satu dibuat eksplisit; satu konfigurasi Multiplier/Recipe/RE tidak selalu berarti satu slot.
- Ready diperoleh dari kesiapan aset akhir dan tahap wajib, bukan sekadar campaign finished.
- Kegagalan sync aset/ContentFlow diulang pada tahap itu saja, tidak meregenerasi video.
- Feature flag default off saat rollout dan tenant pilot membatasi dispatch.
- Content Automation lama tetap bekerja. Reuse helper yang sesuai, jangan memaksa seluruh mesin masuk kontrak recurring Operator lama.

Kriteria selesai: empat keluarga campaign dapat disimpan, diaktifkan, diproses sesuai waktu, dan ditelusuri sampai aset ContentFlow nyata.

### Tahap 08 — Review dan publikasi

- Gunakan review creative domain existing, bukan menyamakan semua approval menjadi satu tombol.
- Preview menampilkan aset nyata dan caption tersimpan. Download/copy memakai data ContentFlow existing.
- Approval publikasi terikat revisi/hash canonical aset+caption+akun+jadwal. User/session/role divalidasi di server.
- Simpan approval dan durable scheduling intent atomik. Crash setelah approval diterima harus bisa melanjutkan intent yang sama.
- Gunakan job ID/idempotency existing; network call provider berada di luar transaksi.
- Published hanya berdasarkan hasil provider terverifikasi. Timeout ambigu tetap Verifying.
- Perubahan material sesudah approval meminta persetujuan revisi baru. Intent lama yang belum dikirim dibatalkan/invalidate; job provider yang sudah diterima direkonsiliasi/cancel melalui kemampuan existing sebelum replacement dibuat. Jangan meninggalkan dua jadwal aktif.
- Jadwal terlewat meminta pilihan reschedule atau Publish Now eksplisit; jangan menerbitkan diam-diam.
- Akun sukses dipertahankan pada partial failure. Upload manual memiliki account, actor, waktu dan permalink/bukti serta asal status manual yang jelas.

Kriteria selesai: approval ganda/restart tidak membuat job tambahan, dan pemulihan satu akun tidak memublikasikan ulang akun lain.

### Tahap 09 — Verifikasi

Utamakan test yang membuktikan invariants, bukan test yang hanya meniru struktur kode.

Wajib mencakup:

1. Concurrent consume, same-owner retry, wrong-owner conflict dan cross-tenant denial.
2. Race generate/mutate/consume serta seluruh bypass dari menu/API/Operator.
3. Recovery setelah reserve, campaign tercipta, approval tersimpan, dan provider merespons tetapi checkpoint belum tersimpan.
4. Produksi sesuai waktu per slot, timezone/batas hari-bulan dan jadwal terlewat.
5. Output readiness gambar/video, sync failure, partial batch dan review gate existing.
6. Stale approval, duplicate approve, partial-account failure, unknown provider outcome dan manual evidence.
7. Regresi payload/form existing serta test Planner, Recipe, Multiplier, Pillar, Operator/Automation dan publishing yang terdampak.
8. Build sesuai script proyek. Catat kegagalan baseline terpisah; jangan menyebut build lulus jika gagal.

Provider/AI menggunakan mock/fixture pada test otomatis. Jangan menerbitkan posting nyata, menjalankan kampanye berbayar, atau mengonsumsi kuota produksi hanya untuk smoke tanpa instruksi pengujian nyata dari pengguna. Manual UI review dilakukan melalui link aplikasi, mencakup light/dark dan layar kecil; tidak memerlukan browser automation berlebihan.

Kriteria selesai: hasil test/build tercatat, tidak ada kegagalan yang belum dijelaskan, dan link review manual tersedia. Verifikasi teknis agen tidak boleh dicatat sebagai persetujuan manual pengguna.

### Tahap 10–11 — Rilis dan rollout

Ikuti SOP `AGENTS.md` serta `sot/global/GIT_BASED_ATOMIC_DEPLOYMENT.md` sepenuhnya.

- Verifikasi perubahan scope Studio dan pekerjaan lain sebelum rilis. Script rilis memakai `git add -A`; gunakan checkout rilis bersih bila diperlukan agar tidak memasukkan perubahan unrelated.
- Jalankan rilis non-interaktif setelah verifikasi berhasil. Nomor versi mengikuti package/changelog/riwayat remote aktual, bukan ditebak dari dokumen.
- Pastikan commit ada pada `main` remote dan tag rilis yang tepat sudah diunggah ke repository tujuan. Jangan force-push untuk memaksakan riwayat.
- Deploy Dev lalu Staging dengan full SHA yang sudah di remote; build di worktree release baru, `DISABLE_AUTO_MIGRATIONS=true`, schema environment tepat, pool maksimal 3.
- Migrasi eksplisit additive dijalankan pada schema target sesuai runbook; tidak otomatis menyapu semua schema.
- Feature flag tetap off sampai migration dan smoke selesai; aktifkan hanya tenant pilot untuk review, bukan seluruh tenant sekaligus.
- Verifikasi current/manifest, UI/API HTTP 200, PM2 online, pm_cwd resolved release, PG_SEARCH_PATH, PGPOOL_MAX dan shared paths.
- Tunggu sesi deployment yang sama; tidak membuat polling SSH loop rapat.
- Rollback dispatch/UI tidak menghapus consumption, intent atau riwayat provider. Reconcile job in-flight; jangan mengulang publish.
- **Dilarang deploy Production tanpa perintah eksplisit pengguna.**

Jika tahap membutuhkan review manual pengguna yang belum dilakukan, catat “menunggu review pengguna”, jangan tandai seluruh task selesai dan jangan mengarang approval. Tetap lanjutkan pekerjaan independen yang aman dan sudah diotorisasi.

## Disiplin scope, secret dan pelaporan

- Sebelum mengubah file yang belum ada di rencana, tambahkan alasan serta Code Sebelum/Code Sesudah. Jangan menganggap 44 entri awal sebagai daftar yang pasti lengkap.
- Jangan memperbaiki fitur unrelated selama ekstraksi. Jika menemukan dependency wajib, catat dan masukkan scope secara eksplisit.
- Jangan memasukkan secret nyata ke source, dokumentasi, mockup, fixture, log, URL atau commit. Gunakan environment/penyimpanan existing; dummy netral bila diperlukan.
- Jangan mengubah Strategic Campaign Single-Pass Engine atau tuning prompt/model untuk menyelesaikan integrasi UI.
- Jangan menandai mockup sebagai implementasi aplikasi. Jangan melaporkan “terintegrasi” jika masih membuka menu lama untuk konfigurasi, menggunakan sample output, atau menggunakan status lokal tanpa DB.
- Jika terhalang, berikan blocker spesifik, bukti non-secret, pekerjaan yang sudah selesai dan langkah terkecil berikutnya. Jangan meninggalkan tahap setengah jadi tanpa catatan.

## Format laporan akhir wajib

1. Ringkasan perilaku yang sudah bekerja dan jenis campaign yang telah diverifikasi.
2. Tautan aplikasi Dev/Staging serta cara mencoba Planner sekali pakai sampai publikasi.
3. Matriks tahap `[x]/[ ]`, sisa pekerjaan dan blocker.
4. File utama dan perubahan kontrak/migrasi, termasuk schema yang benar-benar disentuh.
5. Hasil test/build/manual review yang benar-benar dijalankan; bedakan otomatis, manual agen, dan review pengguna.
6. Versi, commit SHA, tag, verifikasi remote main/tag, dan hasil deployment/health bila sudah dilakukan.
7. Flag pilot yang aktif, batasan operasional dan langkah rollback.

Jangan mengklaim tujuan selesai sebelum invariants Planner sekali pakai, reuse form nyata, due scheduling, approval akhir dan publikasi per akun terverifikasi.
