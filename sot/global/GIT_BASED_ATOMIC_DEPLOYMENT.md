# Source of Truth — Git-Based Atomic Deployment MAKNA Flow

**Status**: Authoritative & Active  
**Effective date**: 28 September 2026  
**Repository**: `https://github.com/sabeq83/maknaflow.git`  
**Server**: Mac Mini `masbenu@100.95.245.55`

## 1. Purpose

Dokumen ini adalah sumber kebenaran untuk deployment berbasis Git dan release atomik MAKNA Flow. Tujuannya adalah memastikan source yang berjalan dapat ditelusuri ke immutable Git SHA, build gagal tidak mengubah aplikasi aktif, data runtime bertahan lintas release, dan rollback dapat dilakukan tanpa build ulang.

## 2. Environment Matrix

| Environment | Atomic root | Legacy root | UI/API | Schema | PM2 apps | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Dev | `~/maknaflow-dev-atomic` | `~/maknaflow-dev` | `5020/7020` | `dev` | `maknaflow-dev-ui`, `maknaflow-dev-api` | Active |
| Staging | `~/maknaflow-staging-atomic` | `~/maknaflow-staging` | `5010/7010` | `staging` | `maknaflow-staging-ui`, `maknaflow-staging-api` | Active |
| Production | Tidak ditetapkan | `~/maknaflow-production` | `5000/6000` | `public` | Production apps | Belum memakai atomic deployment |

Production tidak boleh memakai konfigurasi Dev atau Staging. Migrasi Production memerlukan rencana, validasi, dan instruksi manual eksplisit yang terpisah.

## 3. Canonical Directory Layout

```text
maknaflow-<environment>-atomic/
├── source/                 # Git clone/worktree metadata source
├── releases/
│   └── <UTC>-<git-sha>/    # Immutable source, dependencies, and build artifacts
├── shared/
│   ├── .env.local
│   ├── data/
│   ├── logs/
│   ├── public/uploads/
│   ├── public/temp/
│   └── public-runtime-logs/
└── current -> releases/<active-release>
```

Release harus dianggap immutable setelah aktivasi. Perubahan persistent hanya boleh terjadi melalui path yang terhubung ke `shared/`.

## 4. Deployment Invariants

1. Deploy selalu menerima full 40-character Git SHA; branch name tidak menjadi identitas release aktif.
2. Commit dan tag rilis harus tersedia di remote sebelum server melakukan fetch.
3. Build dijalankan di release baru sebelum symlink `current` dipindahkan.
4. Build menggunakan `DISABLE_AUTO_MIGRATIONS=true` dan schema environment yang benar.
5. Source deployment normal tidak menggunakan `rsync --delete`.
6. Bootstrap dan first-cutover hanya menyalin mutable runtime ke `shared/`; folder legacy tidak dihapus.
7. PM2 harus dimulai ulang dari ecosystem file milik release target. `pm_cwd` wajib sama dengan resolved release path.
8. Aktivasi hanya lulus bila UI dan API mengembalikan HTTP 200 dalam health window.
9. Kegagalan setelah aktivasi mengembalikan `current` dan PM2 ke release sebelumnya atau legacy root.
10. Deploy lock mencegah dua deployment pada environment yang sama berjalan bersamaan.
11. Retention default adalah lima release nonaktif, dengan release aktif dan previous selalu dilindungi.
12. Script Dev/Staging wajib menolak environment Production.

## 5. Canonical Commands

### Dev

```bash
npm run deploy:dev:bootstrap
npm run deploy:dev:bootstrap -- --apply --confirm-dev
npm run deploy:dev:atomic -- --ref <git-sha> --apply --confirm-dev
npm run deploy:dev:rollback -- --apply --confirm-dev
```

`npm run deploy:macmini-dev` merupakan alias/wrapper jalur atomic Dev.

### Staging

```bash
npm run deploy:staging:bootstrap
npm run deploy:staging:bootstrap -- --apply --confirm-staging
npm run deploy:staging -- --ref <git-sha> --apply --confirm-staging
npm run deploy:staging:rollback -- --apply --confirm-staging
```

Gunakan `--release <release-id>` pada perintah rollback untuk memilih release tertentu. `npm run deploy:staging:legacy` hanya untuk recovery terkontrol, bukan deployment normal.

## 6. Deployment Lifecycle

1. Verifikasi worktree bersih dan focused tests/build lulus.
2. Jalankan release non-interaktif; pastikan tag dan commit tersedia di remote `main`.
3. Resolve full Git SHA dari release yang akan dideploy.
4. Jalankan dry-run command tanpa `--apply`.
5. Jalankan command apply dengan confirmation flag environment yang benar.
6. Server mengambil SHA, membuat worktree release, menghubungkan shared paths, memasang dependency, dan membangun Next.js.
7. Pada first cutover, server melakukan delta-sync mutable data dari legacy tanpa delete.
8. Server memindahkan symlink `current`, memulai ulang PM2 dari release target, memvalidasi cwd, lalu menjalankan health loop.
9. Verifikasi manifest, endpoint, PM2 environment, dan jumlah file shared.

## 7. Required Verification

Setelah setiap deploy atau rollback, pastikan:

- `current` menunjuk release yang dimaksud.
- `deployment-manifest.json` mencatat environment, Git SHA, previous release, waktu aktivasi, dan `health: passed`.
- Kedua proses PM2 berstatus `online` dan cwd sama dengan target release.
- `PG_SEARCH_PATH` dan `PGPOOL_MAX` sesuai environment.
- UI dan API mengembalikan HTTP 200.
- File count pada `data`, `logs`, `public/uploads`, dan `public/temp` tidak berkurang tanpa alasan yang tervalidasi.
- Tidak ada proses PM2 environment lain yang dimutasi.

## 8. Rollback and Recovery

Rollback normal memindahkan `current` ke manifest `previous`, memulai PM2 dari target, dan menjalankan health loop. Jika target tidak sehat, mekanisme recovery mengaktifkan kembali release asal.

Folder legacy Dev dan Staging dipertahankan sebagai emergency fallback selama belum ada keputusan dekomisioning. Recovery legacy wajib menghapus hanya dua proses PM2 milik environment terkait, kemudian menjalankan `pm2 start` dari ecosystem legacy. Jangan memakai `startOrGracefulReload` untuk perpindahan direktori karena PM2 dapat mempertahankan cwd lama.

## 9. Database Boundary

Filesystem rollback tidak mengembalikan schema database. Perubahan schema harus additive dan backward-compatible minimal dengan active dan previous release. Migration destruktif tidak boleh digabungkan ke deployment atomic biasa dan membutuhkan prosedur migrasi serta rollback database tersendiri.

## 10. Current Baseline

- Dev pilot tervalidasi pada `v2.32.7`.
- Staging atomic rollout tervalidasi pada `v2.32.8`, termasuk dua deployment, manual rollback, dan reaktivasi release terbaru.
- Production tetap memakai prosedur legacy dan hanya boleh dideploy atas instruksi manual eksplisit pengguna.

Runbook operasional rinci tersedia di:

- `docs/deployment/macmini-atomic-runbook.md`
- `docs/deployment/macmini-staging-atomic-runbook.md`
