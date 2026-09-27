# Mac Mini Git-Based Atomic Deployment — Staging

## Scope

Deployment ini hanya mengelola Staging: legacy root `/Users/masbenu/maknaflow-staging`, atomic root `/Users/masbenu/maknaflow-staging-atomic`, UI `5010`, API `7010`, schema `staging`, serta PM2 `maknaflow-staging-ui` dan `maknaflow-staging-api`. Production bukan target yang valid.

## Bootstrap

```bash
npm run deploy:staging:bootstrap
npm run deploy:staging:bootstrap -- --apply --confirm-staging
```

Bootstrap menyalin `.env.local`, `data/`, `logs/`, `public/uploads/`, `public/temp/`, dan `public/*logs*.txt` ke `shared/` tanpa menghapus folder legacy.

## Deploy

```bash
npm run deploy:staging -- --ref <immutable-git-sha>
npm run deploy:staging -- --ref <immutable-git-sha> --apply --confirm-staging
```

Build memakai `DISABLE_AUTO_MIGRATIONS=true` dan `PG_SEARCH_PATH=staging`. Setelah build selesai, `current` dipindahkan secara atomik, kedua proses PM2 Staging dimulai dari release target, lalu cwd dan endpoint diverifikasi.

## Rollback

```bash
npm run deploy:staging:rollback
npm run deploy:staging:rollback -- --apply --confirm-staging
npm run deploy:staging:rollback -- --release <release-id> --apply --confirm-staging
```

Rollback menunggu health hingga 60 detik. Jika target gagal sehat, symlink dan proses dikembalikan ke release asal.

## Verification

- `curl -f http://127.0.0.1:5010/login`
- `curl -f http://127.0.0.1:7010/health`
- PM2 `pm_cwd` harus sama dengan target `current`.
- Environment proses harus memuat `PG_SEARCH_PATH=staging` dan `PGPOOL_MAX=3`.
- `current/deployment-manifest.json` harus memuat environment `staging` dan SHA yang diminta.
- Jumlah file runtime di `shared/` tidak boleh berkurang setelah deploy atau rollback.

## Emergency Recovery to Legacy

```bash
cd /Users/masbenu/maknaflow-staging
pm2 delete maknaflow-staging-ui maknaflow-staging-api
pm2 start ecosystem.macmini.config.cjs --only maknaflow-staging-ui,maknaflow-staging-api --update-env
```

Jangan memakai `startOrGracefulReload` untuk perpindahan direktori karena PM2 dapat mempertahankan cwd lama. Folder legacy dipertahankan selama masa pilot.

## Hasil Implementasi 28 September 2026

- Release aktif: `20260927T224951Z-5be7268f7ede`, Git SHA `5be7268f7ede49e17de4ea28c6d1f7f9f4a7ecb7` (`v2.32.8`).
- UI `5010` dan API `7010` mengembalikan HTTP 200.
- Kedua proses PM2 online dengan cwd release aktif, `PG_SEARCH_PATH=staging`, dan `PGPOOL_MAX=3`.
- Dua release immutable berhasil dibuat; rollback ke release pertama dan reaktivasi release terbaru berhasil.
- Shared runtime setelah cutover: `data=2`, `logs=8`, `public/uploads=4491`, dan `public/temp=9736` file.
- Folder legacy tetap tersedia untuk emergency recovery dan Production tidak dimutasi.
