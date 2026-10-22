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
