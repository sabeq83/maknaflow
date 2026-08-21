# Instruksi Agent AI Antigravity — YouTube Studio Fase 2.5: Duration & Generation Profiles

## Mandat

Implementasikan Fase 2.5 berdasarkan:

1. `AGENTS.md`
2. `sot/menus/youtube-studio-duration-generation-profile-implementation-plan.md`
3. Dokumen Fase 1 dan Fase 2 YouTube Studio yang relevan.

Tujuan:

```text
Default duration Channel → override Series → override Episode
→ editorial AI memakai resolved duration
→ Script Approved memilih Generation Profile
→ future production plan hanya memakai generated-shot duration valid
```

Jangan menjalankan Google Flow/G-Labs, TTS, render, upload, atau membuat production job pada fase ini.

## Aturan Produk Wajib

- `600` detik hanya fallback data legacy, tidak boleh menjadi nilai produk yang dipaksakan dalam UI atau prompt baru.
- Duration hierarchy: Channel Strategy → Series → Episode. Server menghitung dan menyimpan resolved duration plus source.
- User memilih default duration di Channel Strategy, optional override pada Series, dan optional override pada Episode sebelum research dimulai.
- Narrative scene duration berbeda dari generated visual shot duration.
- Satu scene naratif dapat memiliki beberapa generated shots untuk menutupi durasi VO.
- Google Flow Omni Flash menerima generated shot 4/6/8/10 detik; Veo 3.1 Lite hanya 8 detik.
- Capability model harus berasal dari registry server-side, bukan conditional hard-coded di UI atau prompt.
- B-roll, diagram, map, text overlay, dan archive style tidak dibatasi capability duration Google Flow.

## Security, Contract, dan Database

- Seluruh route tetap tenant-scoped serta server-side permission checked untuk `youtube_studio`.
- Browser tidak boleh mengatur `duration_source`, generation profile validity, tenant, atau hierarchy authorization.
- Tambahkan migration PostgreSQL idempotent dengan advisory lock; jangan menghapus data lama.
- Existing record 600s dapat tetap ada tetapi harus ditandai/dianggap legacy fallback, bukan overwritten tanpa alasan.
- Validasi invalid duration/profile di server dan jangan melakukan silent fallback.
- Generation profile public API tidak boleh membocorkan API key, quota, provider secret, atau routing internal.

## UI dan CSS

- Pertahankan one-column workflow yang sudah ada.
- Tambahkan duration controls sebagai bagian Channel Strategy, Series, dan Episode; jangan membuat dashboard atau tab baru.
- Setelah Script Approved, tampilkan profile selector dengan prerequisite yang jelas untuk state sebelumnya.
- Gunakan CSS Module dan class semantik.
- Gunakan token `app/theme.css` saja. Dilarang inline style, hex/RGB/RGBA/color literal, atau hard-coded visual design values pada `app/youtube-studio/**`.
- Semua form harus labelled, accessible, responsive, dan memiliki error/success state non-blocking.

## Urutan Eksekusi

1. Audit semua fallback/prompt/UI duration `600` dan update plan bila ada file tambahan.
2. Tambahkan contract duration hierarchy, profile registry, dan shot validator.
3. Tambahkan migration/backfill serta repository transaction server-side.
4. Update Strategy/Series/Idea/Blueprint/Script services agar memakai resolved duration.
5. Tambahkan capability/profile/duration API routes.
6. Update one-column UI dan CSS Module.
7. Tambahkan unit/integration tests; pastikan tidak ada provider generation call.
8. Jalankan build dan deploy ke Mac Mini Dev saja.
9. Update checklist plan berdasarkan bukti.
10. Jalankan release SOP setelah seluruh verification lulus.

## Kontrol Progress

Update checkbox pada `## 5. Execution Task List` di `sot/menus/youtube-studio-duration-generation-profile-implementation-plan.md` dari `- [ ]` menjadi `- [x]` hanya setelah benar-benar terverifikasi.

Jika perlu menambah file di luar `## 6. Planned File Changes`, tambahkan entri path, alasan, Code Sebelum, dan Code Sesudah sebelum mengedit file itu.

## Acceptance Minimum

1. Duration Channel, Series, Episode mengikuti hierarchy dan source yang terlihat jelas.
2. AI prompts menerima resolved duration, bukan literal 600.
3. Episode idea/manual/adopt menggunakan duration terotorisasi yang benar.
4. Profile registry mengembalikan Omni Flash `[4,6,8,10]` dan Veo 3.1 Lite `[8]`.
5. Server menolak generated-shot duration/profile invalid.
6. Non-generated assets tidak dipaksa ke batasan Flow.
7. Tidak ada job/provider generation pada fase ini.
8. UI one-column, CSS semantik, theme aligned, responsive, dan accessible.
9. Build/test/Dev-only smoke test berhasil.

## Deployment: Mac Mini Dev Only

Satu-satunya deploy command yang diizinkan:

```bash
npm run deploy:macmini-dev
```

Verifikasi hanya:

- `http://100.95.245.55:5020/youtube-studio`
- `http://100.95.245.55:7020`

Dilarang menjalankan deployment staging atau production, termasuk `deploy:staging`, `deploy:macmini-staging`, `deploy:macmini-prod`, `deploy:production`, atau `deploy:node1`. Jangan polling SSH berulang saat remote build.

## Release Setelah Verifikasi

```bash
npm run release-non-interactive -- --type patch --title "YouTube Studio Flexible Duration Profiles" --points "Tambah hierarchy durasi Channel Series dan Episode|Tambah generation profile Google Flow berbasis capability|Validasi durasi generated shot sebelum Production Factory"
```

Release/push tidak mengizinkan staging atau production deployment.

## Laporan Akhir

Laporkan task checklist selesai, migration/file utama, hasil test/build, bukti duration inheritance dan validasi profile, bukti Dev deployment, release/commit/tag/push, serta pekerjaan yang ditunda untuk Fase 3A Production Plan.

