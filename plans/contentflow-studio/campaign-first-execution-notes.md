# Campaign-first execution notes

Baseline: staging e334c8f7b732945c4e967c7214d2cdd9e3df8f8f. Working tree awal hanya rencana koreksi yang belum tracked.

Audit: RE capture mengembalikan {config, productRefImage}, Multiplier capture payload rows/shared_config, Recipe Labs static dan video memakai payload berbeda. ImportPlannerModal belum memiliki callback capture. Claim tidak memeriksa activation; event worker memakai nama argumen yang tidak sesuai repository. Tidak ada daemon Studio di instrumentation baseline.

Mockup diperbarui: pemilihan campaign dahulu. Form existing tetap menjadi sumber konfigurasi.

## Verifikasi sementara
- Migrasi additive: dry-run lalu apply dev/staging; keduanya belum memiliki batch Studio lama. Tidak ada consumption yang dihapus/dibuka.
- Suite campaign-first: empat test passed termasuk transaksi PostgreSQL terisolasi, concurrent create, rollback, consumed conflict, future slot, dan adapter domain nyata RE/Multiplier/Pillar/Recipe dengan retry. Worker AI/provider tidak dijalankan.
- Regresi: Planner locked structure dan Repliz passed. Recipe contract memiliki kegagalan baseline: test mengharapkan count=25 ditolak, tetapi MAX_RECIPE_COUNT=30 pada HEAD sebelum perubahan. File tersebut tidak diubah.
- Recipe Labs video existing menghasilkan storyboard/report; tanpa video final slot masuk needs_review dan tidak bisa dipublish. Jalur video resep final memakai Recipe Planner/Pillar.
- Build awal lulus; build akhir diulang setelah seluruh perubahan terakhir.

## Audit data
Dry-run/apply migrasi Dev dan Staging masing-masing menemukan 0 batch Studio (seluruh tenant pada schema target). Audit tambahan default_tenant pada kedua schema menghasilkan report kosong. Tidak ada repair/regenerate/republish, dan schema public tidak dimutasi.

## Test final
Semua empat adapter domain RE, Multiplier, Pillar, Recipe diuji pada schema studio_test_* dengan scheduler/startup cache off. Same-slot dispatch ulang mengembalikan campaign yang sama. Test data/schema dihapus setelah selesai. Regresi focused Planner/Repliz 10/10 passed. Manual user review belum dilakukan dan publikasi provider nyata tidak dijalankan.

## Kesiapan rilis
Final suite: 4/4 passed (termasuk integrasi PostgreSQL terisolasi empat adapter domain). Focused regression: 10/10 passed. Build produksi lulus dengan background services/migrations dimatikan. Workspace perubahan hanya scope campaign-first; baseline remote main b84312f7953f8951330e1cc5d89958b4f89dbcd5 dan patch v2.32.71 belum tersedia sebelum rilis.

## Rilis dan deployment aktual
- Versi/tag v2.32.71; SHA kode c517f377011b1d5c6e895c826f99b6ebb1407794. Main dan annotated tag remote diverifikasi sebelum deployment.
- Dev: release 20261022T104629Z-c517f377011b; Staging: release 20261022T104746Z-c517f377011b.
- Kedua manifest health=passed, SHA sesuai; UI/API PM2 online dengan pm_cwd resolved release, schema dev/staging sesuai dan PGPOOL_MAX=3. Semua mutable paths menunjuk shared.
- UI /login=200, API /health=200; /contentflow-studio unauthenticated=307 ke login (expected). Flag worker Studio configured true di shared env Dev/Staging. Production tidak diubah/deploy.
- Link review: http://100.95.245.55:5010/contentflow-studio dan http://100.95.245.55:5020/contentflow-studio.
- Manual UI setelah login dan publishing provider nyata belum diuji; tidak ada posting/panggilan AI produksi selama test.
- Final build completed (148/148 routes) dengan warning baseline middleware/proxy dan fallback universe DB pada sandbox lokal; remote build berhasil dengan DB tersedia.

## Batasan yang dipertahankan
Recipe Labs mode video mengikuti output existing berupa storyboard/report. Studio menolak menganggapnya video siap publish; gunakan focus Recipe pada Pillar untuk produksi video akhir. Test lama Recipe mengharapkan 25 ditolak sementara MAX_RECIPE_COUNT HEAD=30; kegagalan baseline dicatat, tidak diubah untuk menghijaukan test.

## Hotfix HTTP wizard button
Penyebab: crypto.randomUUID secure-context-only dipanggil sebelum setShowWizard pada HTTP staging. Ganti dengan createStudioIdempotencyKey: randomUUID bila tersedia, getRandomValues pada HTTP, fallback unik non-auth bila crypto diblokir. Key tetap stabil per sesi submit. Uji absent/throw API dan 1000 fallback keys unik lulus; suite focused 14 passed, 1 DB integration skipped karena tidak ada perubahan DB. Build produksi lulus. Rilis target v2.32.72; tanpa migrasi database.
