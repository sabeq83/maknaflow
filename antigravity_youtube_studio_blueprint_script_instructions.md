# Instruksi Agent AI Antigravity — YouTube Studio Fase 2: AI Blueprint & Script Approval

## Mandat

Implementasikan fase editorial berikut berdasarkan:

1. `AGENTS.md`
2. `sot/menus/youtube-studio-blueprint-script-implementation-plan.md`
3. `sot/menus/youtube-studio-editorial-workflow-implementation-plan.md`
4. `sot/menus/youtube-studio-editorial-ui-refinement-implementation-plan.md`

Scope tunggal:

```text
Planned Episode → AI Research Brief → AI Blueprint → AI Scene Script → Script Approved
```

AI membuat draft; user melakukan review/edit/approval. Jangan membuat render, G-Labs, TTS, provider video, upload YouTube, Shorts, analytics, atau monetization dalam tugas ini.

## Bacaan dan Audit Wajib

1. Baca `AGENTS.md` sepenuhnya sebelum bekerja.
2. Baca implementation plan fase ini sepenuhnya.
3. Baca dokumentasi Next.js lokal yang relevan untuk Route Handlers, Dynamic Routes, Client Components, dan CSS Modules.
4. Audit code aktual: `lib/youtube-studio-contract.js`, `lib/youtube-studio-repository.js`, `lib/youtube-studio-planner.js`, endpoint blueprint/script existing, `app/youtube-studio/**`, `app/theme.css`, dan `app/globals.css`.
5. Periksa `git status`; jangan overwrite perubahan existing milik user/agent lain.

## Aturan Domain dan AI

- Hanya episode `Planned` yang dapat memulai research.
- Research → Blueprint → Script adalah explicit action. Memilih episode hanya membaca data.
- AI output wajib mengikuti dan lolos validasi kontrak Research Brief, Blueprint, serta Scene Script yang didefinisikan plan.
- Gunakan context resmi: Channel Strategy aktif, Series, Episode, locale, target durasi, Universe snapshot, Visual Identity snapshot, user-supplied sources/constraints.
- Jangan mengarang Universe/Visual Identity ID, sumber faktual, atau klaim sebagai fakta tanpa ditandai risk/source note.
- Blueprint wajib disetujui sebelum script dapat dibuat.
- Script wajib memiliki scene index berurutan, target chapter valid, durasi positif, scene type allowlist, VO, visual direction, subtitle cue, transition, dan audio cue.
- Hanya script yang disetujui boleh mengubah episode menjadi `Script Approved`.
- Jangan memanggil provider visual/audio/video atau membuat job produksi pada fase ini.

## Versioning, State, dan Security

- Semua research, blueprint, dan script bersifat versioned; jangan menimpa versi/histori yang telah direview.
- Supersede/invalidation dijalankan transactional oleh repository ketika upstream artifact berubah.
- Semua state transition memakai shared transition guard; jangan direct-update status episode dari route.
- Seluruh route harus tenant-scoped dan server-side permission checked untuk `youtube_studio` read/write.
- Browser tidak mengendalikan tenant, active strategy, ownership, approval identity, atau authoritative state.
- Simpan context snapshot pada artifact generation untuk reproducibility, tanpa membocorkan secrets/provider credential.

## Aturan UI dan CSS

- Pertahankan workflow satu kolom yang sudah selesai pada Fase 1.
- Tambahkan Blueprint & Script sebagai step berikutnya di bawah Planned Episodes.
- Gunakan section semantic, labels, ARIA live/error status, dan explicit action button.
- Gunakan CSS Module dan class semantik saja.
- Gunakan token `app/theme.css`; jangan memakai inline style, hex/RGB/RGBA/color literal, atau theme baru di `app/youtube-studio/**`.
- Tampilkan dokumen editorial sebagai konten terbaca, bukan raw JSON default. Raw JSON dapat menjadi disclosure/debug opt-in bila benar-benar diperlukan.
- Responsive dan keyboard/focus behavior wajib tetap baik.

## Urutan Eksekusi

1. Audit schema/contract/routes yang ada dan update plan jika ada deviasi penting.
2. Implementasikan contract/state validation dan idempotent database migration.
3. Implementasikan repository versioning, transactions, snapshot, and invalidation.
4. Perbarui AI planner services dengan prompts/output validation yang kaya konteks.
5. Implementasikan API research, blueprint, script generate/list/edit/approve.
6. Bangun UI one-column Research → Blueprint → Script Review.
7. Tambahkan test dan run build.
8. Deploy serta verify **hanya** ke Mac Mini Dev.
9. Update task checklist plan dengan bukti verifikasi.
10. Release mengikuti SOP hanya setelah seluruh acceptance criteria lulus.

## Kontrol Progress

Setelah task selesai dan terbukti, update `## 5. Execution Task List` dalam `sot/menus/youtube-studio-blueprint-script-implementation-plan.md` dari `- [ ]` menjadi `- [x]`.

Jika diperlukan perubahan file di luar bagian `## 6. Planned File Changes`, tambahkan entri lengkap sebelum edit: alasan, Code Sebelum, dan Code Sesudah.

## Acceptance Minimum

1. Research hanya dapat dimulai dari Planned Episode yang tenant-authorized.
2. AI contract invalid ditolak dan tidak menjadi artifact active.
3. User dapat review/edit research, blueprint, dan script tanpa browser `alert()`.
4. Script generation sebelum Blueprint Approved ditolak server-side.
5. Approval/supersede menjaga version history dan state episode yang sah.
6. Scene script tervalidasi terhadap durasi, chapter, index, dan scene type.
7. Episode selection tidak menyebabkan generation request.
8. Semua endpoint baru menolak tenant/user yang tidak berhak.
9. UI tetap one-column, semantic CSS, responsive, dan theme-aligned.
10. Build dan test berhasil, lalu Dev-only smoke workflow lengkap berhasil.

## Deployment: Mac Mini Dev Only

Satu-satunya command deployment yang diizinkan:

```bash
npm run deploy:macmini-dev
```

Verifikasi hanya:

- `http://100.95.245.55:5020/youtube-studio`
- `http://100.95.245.55:7020`

Dilarang menjalankan `deploy:staging`, `deploy:macmini-staging`, `deploy:macmini-prod`, `deploy:production`, `deploy:node1`, atau deployment environment selain Dev. Jangan melakukan polling SSH berulang saat remote build; ikuti SOP `AGENTS.md`.

## Release Setelah Verifikasi

Setelah test dan Dev-only smoke test lulus:

```bash
npm run release-non-interactive -- --type patch --title "YouTube Studio AI Blueprint and Script" --points "Tambah research brief AI dan blueprint episode tervalidasi|Tambah script scene-by-scene dengan approval gate|Tambah versioning editorial dan workflow Script Approved"
```

Release/push tidak memberi izin deploy ke staging atau production.

## Laporan Akhir

Laporkan: checklist selesai, migration/file utama, hasil test/build, bukti workflow Planned → Research → Blueprint → Script Approved, hasil Dev deployment, release/commit/tag/push, serta risiko/pekerjaan yang sengaja ditunda ke Production Factory.

