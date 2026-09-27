# Mac Mini Git-Based Atomic Deployment — Dev Pilot

## Scope

Pilot ini hanya untuk Dev: root legacy `/Users/masbenu/maknaflow-dev`, root atomic `/Users/masbenu/maknaflow-dev-atomic`, UI `5020`, API `7020`, schema `dev`, serta PM2 `maknaflow-dev-ui` dan `maknaflow-dev-api`.

Staging dan Production tidak termasuk dalam pilot dan tidak boleh menjadi target script atomic Dev.

## Preflight dan Bootstrap

Pastikan commit tersedia di remote Git, server memiliki akses read-only, Dev legacy sehat, dan `.env.local` tersedia.

```bash
npm run deploy:dev:bootstrap
npm run deploy:dev:bootstrap -- --apply --confirm-dev
```

Bootstrap menyalin `.env.local`, `data/`, `logs/`, `public/uploads/`, `public/temp/`, dan existing `public/*logs*.txt` tanpa delete. Folder legacy tidak dihapus.

## Deploy

```bash
npm run deploy:dev:atomic -- --ref <git-sha>
npm run deploy:dev:atomic -- --ref <git-sha> --apply --confirm-dev
```

Release dibangun dengan `DISABLE_AUTO_MIGRATIONS=true` dan `PG_SEARCH_PATH=dev`. Symlink `current` dipindahkan setelah build berhasil. Sesudah reload PM2, UI dan API diperiksa melalui loop lokal dalam satu sesi SSH.

## Rollback

```bash
npm run deploy:dev:rollback
npm run deploy:dev:rollback -- --apply --confirm-dev
npm run deploy:dev:rollback -- --release <release-id> --apply --confirm-dev
```

## Recovery to Legacy

```bash
cd /Users/masbenu/maknaflow-dev
pm2 startOrGracefulReload ecosystem.macmini.config.cjs --only maknaflow-dev-ui,maknaflow-dev-api --update-env
```

## Verification

- UI: `curl -f http://127.0.0.1:5020/login`
- API: `curl -f http://127.0.0.1:7020/health`
- PM2 cwd harus menunjuk release aktif.
- `current/deployment-manifest.json` harus memuat SHA yang diminta.
- Jumlah mutable runtime files harus konsisten setelah dua deploy dan rollback.

Rollback filesystem tidak mengembalikan schema database. Selama pilot, build tidak menjalankan auto-migration dan runtime hanya menggunakan schema `dev`. Migration destruktif membatalkan pilot.
