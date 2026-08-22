# Instruksi Agent AI Antigravity — YouTube Studio KB Foundation

## Mandat

Implementasikan KB YouTube Studio baru berdasarkan `AGENTS.md` dan `sot/menus/youtube-studio-kb-foundation-implementation-plan.md`.

Jangan memakai, mengimpor, atau menjadikan fallback KB MAKNA Flow lama. KB ini harus independen, versioned, tenant-safe, channel/series-scoped, dan immutable saat disnapshot ke episode.

## Aturan Wajib

- Implementasikan hanya delapan KB type yang ditentukan dalam plan atau type tambahan yang disetujui dengan update plan terlebih dahulu.
- AI hanya membuat draft KB; user review/activate wajib sebelum KB menjadi active.
- Resolve context: tenant → channel KB → series override/extension. Client tidak mengendalikan tenant/scope.
- Research, Blueprint, Script, dan Production Plan memakai KB snapshot yang terbatas/relevan serta menyimpan revision provenance.
- Perubahan KB baru tidak boleh mengubah artifact episode lama.
- Gunakan migration PostgreSQL idempotent/advisory lock dan pertahankan revision history.
- CSS Module semantik + token `app/theme.css`; dilarang inline style/hex/RGB/RGBA pada UI YouTube Studio.
- Jangan membangun T2I/I2V/start frame/TTS/render/publishing dalam tugas KB ini.

## Urutan Eksekusi

1. Baca AGENTS, plan, theme, Next.js docs, dan audit code actual.
2. Implementasikan contract, migration, repository/context resolver.
3. Implementasikan AI KB draft/refine dan APIs tenant-authorized.
4. Tambahkan UI one-column untuk Library, revision, dan bindings.
5. Inject snapshot KB secara bounded ke generator existing.
6. Tambahkan tests dan jalankan build.
7. Deploy hanya Mac Mini Dev, smoke test, update checklist, lalu release SOP.

## Kontrol Progress

Update checkbox `## 4. Execution Task List` pada plan dari `- [ ]` ke `- [x]` hanya sesudah diverifikasi. Tambahkan before/after snippet ke plan sebelum mengedit file yang belum tercantum.

## Verifikasi Minimum

1. Tidak ada KB lama yang terbaca pada YouTube Studio.
2. Active revision unik per scope/type dan history tetap tersedia.
3. Tenant A tidak dapat membaca/mengubah KB Tenant B.
4. Channel/Series inheritance dan snapshot episode stabil.
5. AI draft tidak auto-active.
6. UI semantic/theme aligned dan build/test lulus.

## Deployment: Mac Mini Dev Only

Hanya `npm run deploy:macmini-dev`. Verifikasi pada port 5020/7020. Dilarang deploy staging atau production dan dilarang polling SSH loop.

## Release

Jalankan command release pada plan hanya setelah semua verifikasi selesai. Laporan akhir mencakup revisions/snapshots, tests/build/Dev smoke, release/tag/push, dan pekerjaan tersisa.

