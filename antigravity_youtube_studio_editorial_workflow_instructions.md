# Instruksi Agent AI Antigravity — YouTube Studio Fase 1: Editorial Workflow

## Mandat

Implementasikan workflow editorial YouTube Studio saja, berdasarkan:

1. `AGENTS.md`
2. `sot/menus/youtube-studio-editorial-workflow-implementation-plan.md`
3. `sot/menus/youtube-studio-mvp.md`
4. `sot/menus/youtube-studio-implementation-plan.md` sebagai konteks fondasi yang telah ada.

Tujuan fase ini adalah membuat workflow berikut benar-benar berfungsi:

```text
Buat Channel
→ isi Strategy Brief
→ AI menghasilkan Strategy draft
→ user edit/review/activate Strategy
→ buat Content Series
→ AI menghasilkan backlog ide episode
→ user adopt ide atau membuat episode manual
→ episode berstatus Planned
```

Jangan melanjutkan ke Blueprint, Script, TTS, G-Labs, render, YouTube upload, Shorts, analytics, atau monetization pada fase ini.

## Bacaan dan Audit Wajib

1. Baca seluruh `AGENTS.md` sebelum mengubah apa pun.
2. Baca seluruh `sot/menus/youtube-studio-editorial-workflow-implementation-plan.md`.
3. Periksa `git status`; jangan overwrite perubahan existing milik user/agent lain.
4. Sebelum mengubah kode Next.js, baca dokumentasi lokal yang relevan di `node_modules/next/dist/docs/`, khususnya Route Handlers, Dynamic Routes, Client Components, dan navigation/data fetching.
5. Inspeksi implementasi aktual berikut sebelum coding:
   - `app/youtube-studio/components/YouTubeStudioWorkspace.js`
   - `app/api/v2/youtube-studio/**`
   - `lib/youtube-studio-repository.js`
   - `lib/youtube-studio-contract.js`
   - `lib/auth.js`
   - `lib/db-pg.js`
6. Snippet dalam plan adalah arah desain, bukan patch literal. Sesuaikan dengan struktur aktual tanpa melemahkan acceptance criteria.

## Hasil Wajib

- User berizin dapat membuat channel dan langsung memilihnya di workspace.
- User dapat mengisi Strategy Brief: niche, audience, geography, locale, objective, durasi, cadence, Universe, dan Visual Identity.
- AI menghasilkan Channel Strategy draft JSON yang tervalidasi dan locale-aware.
- AI tidak otomatis mengaktifkan strategy; user dapat mengedit lalu menjalankan explicit action **Activate Strategy**.
- Setiap channel hanya memiliki satu active strategy; strategy sebelumnya diarsipkan, bukan dihapus.
- User dapat membuat Content Series hanya bila channel mempunyai active strategy.
- AI dapat membuat backlog idea untuk series aktif.
- User dapat mengadopsi satu idea menjadi tepat satu episode berstatus `Planned`, atau membuat episode manual dengan hasil status sama.
- Pemilihan episode hanya membaca data; tidak boleh meng-generate blueprint atau script secara otomatis.
- Semua akses dan relasi tetap tenant-scoped dan permission-checked di server.

## Aturan Implementasi

### Authorization dan Tenant Isolation

- Tambahkan dan gunakan server-side guard untuk `youtube_studio`; Sidebar visibility tidak cukup.
- Hormati read/write permission dan tenant disabled-menu state.
- Browser tidak boleh menjadi sumber otoritas bagi `tenant_id`, `strategy_id`, atau relasi channel/series.
- Selalu verifikasi rantai ownership: channel → strategy → series → episode idea/episode berada dalam tenant dan channel yang sama.
- GET, create, update, generate, activate, adopt, dan reject wajib tenant-scoped.

### Channel Strategy AI

- Gunakan provider/model Gemini yang telah dipakai aplikasi, serta parser JSON aman yang sudah ada bila sesuai.
- AI menerima brief user dan optional snapshot Universe/Visual Identity yang tervalidasi.
- Output AI harus tervalidasi terhadap schema strategy: positioning, audience persona, content pillars, tone, format, monetization path, CTA, dan risk guardrails.
- Jangan mengizinkan AI mengarang ID Universe/Visual Identity, klaim fakta yang tidak ada di brief, atau mengaktifkan strategy.
- Refinement membuat/memperbarui draft yang dapat ditinjau, bukan mengubah active strategy diam-diam.
- Locale wajib memakai BCP 47 canonicalisation; jangan menghard-code dua bahasa saja.

### Episode Idea dan Episode

- Simpan hasil AI sebagai `youtube_episode_ideas`; jangan langsung menjadikannya episode produksi.
- Idea memiliki status minimal `suggested | adopted | rejected`.
- Adopting idea harus idempotent dan transactional: retry tidak boleh membuat episode kedua.
- Episode manual maupun hasil adopt menggunakan active strategy yang ditentukan server dan berstatus `Planned`.
- Series tidak dapat dibuat tanpa active strategy pada channel yang benar.

### Database

- Tambahkan migration PostgreSQL idempotent menggunakan advisory lock sesuai pola `lib/db-pg.js`.
- Pertahankan strategy aktif yang sudah ada sebagai data legacy; jangan mengubahnya menjadi draft.
- Buat partial unique index atau mekanisme setara agar hanya satu active strategy per tenant/channel.
- Jangan melakukan migration destruktif atau delete data lama.

### UI dan UX

- Refactor workspace secara eksplisit menjadi Channel → AI Strategy → Series → Episodes.
- Tampilkan loading, empty state, validation error, AI generation state, dan actionable server error.
- Pisahkan action user: Generate, Refine, Save Draft, Activate, Generate Ideas, Adopt, Reject, Create Episode.
- Pertahankan visual language aplikasi; jangan membuat design system baru.
- Hapus side effect di `selectEpisode` yang saat ini memanggil endpoint blueprint/script generation.

### Scope Discipline

- Jangan mengubah renderer, worker produksi, G-Labs integration, TTS, publishing service, atau workflow Shorts.
- Jangan menjalankan provider calls dari request jika kontrak runtime aktual tidak aman; gunakan pola service yang sesuai aplikasi.
- Jangan menambah secret/API key atau dependency tanpa kebutuhan yang dibuktikan.
- Jangan deploy production.
- Jangan membuat refactor umum di luar workflow editorial.

## Urutan Eksekusi

1. Audit schema, route, repository, UI, dan authorization aktual.
2. Tambahkan helper permission server-side serta gunakan pada seluruh API workflow editorial.
3. Tambahkan migration follow-up untuk strategy draft/active dan episode idea backlog.
4. Tambahkan/rapikan contract validation dan repository transaction/ownership checks.
5. Implementasikan service AI Channel Strategy dan AI episode idea planner.
6. Implementasikan route generate/refine/save/activate strategy.
7. Implementasikan route generate/list/adopt/reject episode idea.
8. Perbaiki create series dan episode manual agar memakai active strategy yang terverifikasi server-side.
9. Refactor UI workflow dan hilangkan auto-generation pada episode selection.
10. Tambahkan test lalu jalankan migration/test/build/staging smoke test.
11. Jalankan release SOP hanya setelah seluruh acceptance criteria lulus.

## Kontrol Progress Wajib

Setelah satu tahapan benar-benar selesai dan diverifikasi, update checkbox pada bagian `## 4. Execution Task List` dalam:

`sot/menus/youtube-studio-editorial-workflow-implementation-plan.md`

Ubah hanya dari:

```md
- [ ] Tahap
```

menjadi:

```md
- [x] Tahap
```

Jangan menandai selesai hanya karena kode sudah ditulis.

Jika perlu mengubah/menambah file yang belum ada dalam bagian `## 6. Planned File Changes` di plan, tambahkan entri terlebih dahulu. Setiap entri wajib memiliki file path, alasan, **Code Sebelum**, dan **Code Sesudah**.

## Acceptance Test Minimum

1. User tanpa permission `youtube_studio`, atau tenant dengan menu disabled, ditolak di UI dan API.
2. Tenant A tidak dapat membaca/menulis channel, strategy, series, idea, atau episode Tenant B.
3. Channel dapat dibuat lalu segera dipilih tanpa refresh/manual retry.
4. AI strategy draft tervalidasi dan menggunakan locale channel yang sah.
5. Generate AI tidak mengaktifkan strategy; hanya action activate yang melakukannya.
6. Channel tidak memiliki lebih dari satu active strategy.
7. Series tanpa active strategy ditolak.
8. AI episode idea terhubung ke strategy dan series yang benar.
9. Adopt idea satu kali menghasilkan satu episode `Planned`; retry tidak menggandakan episode.
10. Episode manual memakai active strategy yang diputuskan server, bukan `strategy_id` dari client.
11. Memilih episode tidak mengirim request blueprint/script generation.
12. Migration idempotent, test, lint, build Next.js, dan staging smoke test berhasil.

## Penanganan Blocker

- Bila schema/worker/auth aktual berbeda dari plan, dokumentasikan temuan dan update plan sebelum membuat perubahan yang menggeser desain.
- Bila ditemukan perubahan user pada file target, integrasikan secara hati-hati; jangan overwrite.
- Bila AI provider gagal/credential belum tersedia, mock provider pada test dan implementasikan failure state UI/API yang jelas. Jangan memakai credential pribadi atau mengklaim test generation sukses.
- Bila staging DB/network tidak tersedia, pisahkan evidence test unit dari smoke test yang belum dapat dilakukan; jangan mencentang task verifikasi staging.
- Bila pekerjaan membutuhkan deploy production, berhenti dan minta instruksi eksplisit pengguna.

## Release Setelah Semua Verifikasi

Jalankan hanya bila semua acceptance test sudah terbukti:

```bash
npm run release-non-interactive -- --type patch --title "YouTube Studio Editorial Workflow" --points "Tambah AI Channel Strategy dengan review dan activation|Tambah series serta backlog ide episode AI|Tambah workflow episode Planned yang tenant-safe"
```

Verifikasi commit, changelog, tag, dan push sesuai SOP `AGENTS.md`. Jangan deploy production.

## Format Laporan Akhir

Laporkan:

- Checkbox plan yang selesai beserta bukti verifikasi.
- File/migration/API utama yang diubah.
- Hasil test, lint, build, dan staging smoke test.
- Bukti workflow Channel → Strategy → Series → Episode Planned.
- Hal yang sengaja ditunda ke fase Blueprint/Script berikutnya.
- Versi release, commit, tag, dan status push.

