# Instruksi AI Agent — YouTube Studio Narrative–TTS–Timeline Duration Sync

Anda bekerja pada repository MAKNA Flow:

```text
/Users/sabeqmmursyid/_maknaflow-staging
```

## Mission

Implementasikan secara end-to-end rencana authoritative berikut:

```text
/Users/sabeqmmursyid/_maknaflow-staging/plans/youtube-studio-duration-sync/implementation_plan.md
```

Tujuannya adalah menyelaraskan word budget, TTS aktual, dan timeline visual YouTube Studio; memperbaiki silent truncation pada mux; serta memulihkan episode `ytep_3suyq35q` setelah implementasi Dev terverifikasi.

## Mandatory Instructions

1. Baca seluruh `AGENTS.md` dan implementation plan sebelum melakukan perubahan.
2. Karena versi Next.js repository memiliki breaking changes, baca panduan relevan di `node_modules/next/dist/docs/` sebelum mengubah route atau convention Next.js.
3. Jalankan `git status --short` terlebih dahulu. Pertahankan semua perubahan pengguna yang tidak terkait.
4. Jangan mengganti atau merusak Single-Pass Strategic Campaign Engine.
5. Jangan deploy Production tanpa instruksi manual eksplisit pengguna.
6. Update `## Execution Task List` secara real-time. Ubah `[ ]` menjadi `[x]` hanya setelah task dan verifikasinya benar-benar selesai.
7. Jangan melakukan mutation episode recovery sebelum migration, unit test, integration test, build, dan deploy Dev berhasil.
8. Semua query/mutation wajib tenant-scoped dan melalui repository/service bila tersedia.
9. Jangan menghapus preview, TTS, visual clip, atau script lama sebelum backup dan verifikasi preview pengganti.
10. Jangan menggunakan `voice_speed` atau FFmpeg stretch ekstrem sebagai jalan pintas duration fitting.

## Required Technical Outcomes

Implementasikan lima outcome berikut:

1. Word/beat budget berbasis audience profile dan target durasi.
2. Duration validation sebelum script approval serta Auto-fit yang membuat version baru.
3. Penyimpanan durasi TTS aktual hasil `ffprobe` per asset.
4. YouTube-specific timeline-preserving mux yang tidak memotong visual ketika audio lebih pendek.
5. Pemisahan creative `voice_speed` dari bounded correction factor.

## Critical Bug to Fix

Current behavior:

```js
await processVideoMuxing({ syncOption: 'smart_sync' });
// processVideoMuxing does not resolve this literal and uses -shortest.
```

Akibatnya episode dengan visual ±302 detik dan audio ±141 detik menghasilkan preview ±141 detik. Implementasikan policy YouTube terpisah; jangan mengubah perilaku consumer muxer generik tanpa regression tests.

## Required Execution Order

1. Audit code, tests, database contract, dan semua consumer muxer.
2. Implement narration profile + pure duration-budget functions beserta unit tests.
3. Implement script analysis/approval/Auto-fit versioning.
4. Implement migration idempotent dan repository changes.
5. Simpan actual TTS durations dan package analysis.
6. Implement serta test timeline-preserving YouTube mux.
7. Implement Duration Health UI dan actionable warnings.
8. Jalankan seluruh relevant tests dan build lokal.
9. Deploy ke Dev dengan `npm run deploy:macmini-dev`; tunggu proses remote build tanpa SSH polling loop.
10. Jalankan Dev smoke tests.
11. Backup lalu pulihkan episode `ytep_3suyq35q` sesuai recovery plan.
12. Verifikasi output dengan `ffprobe`, UI navigation, dan database state.
13. Jalankan release non-interaktif, verify tag/branch push, dan update checklist.

## Episode Recovery Guardrails

Untuk `ytep_3suyq35q`:

- Pertahankan visual clips yang sudah sukses.
- Buat script version baru; jangan overwrite approved script lama.
- Gunakan `kids_educational_id`.
- Target awal 420–485 kata dengan kalimat 5–10 kata dan CTA singkat.
- Mulai dari voice speed `0.9x–1.0x` sesuai pilihan kreatif pengguna.
- Regenerate seluruh TTS hanya setelah script baru disetujui.
- Probe setiap audio dan preview final.
- Target preview final 300–302 detik dengan tolerance ±1 detik dari planned timeline.
- Gap audio menjadi intentional pause/silence, bukan alasan memotong visual.
- Jika actual audio mismatch besar, revisi scene outlier; jangan melakukan tempo correction di luar batas profile.

## Verification Evidence Required

Laporan agent harus menyertakan:

- before/after duration episode;
- jumlah kata dan coverage per scene;
- actual TTS duration per scene dari `ffprobe`;
- planned vs actual preview duration;
- test commands dan exit codes;
- hasil build dan deploy Dev;
- database state akhir episode/package/jobs;
- file yang berubah;
- release version, commit, tag, dan push status;
- warning existing yang tidak terkait dan risiko tersisa.

## Release Command

Setelah seluruh implementasi dan recovery Dev berhasil:

```bash
npm run release-non-interactive -- --type patch --title "YouTube Narrative Timeline Duration Sync" --points "Menambahkan narration budget dan duration validation|Menyimpan durasi TTS aktual dan menjaga timeline saat muxing|Memulihkan episode anak dengan narasi dan preview tersinkron"
```

Jangan menjalankan deployment Production.

## Stop Conditions

Hentikan mutation dan laporkan blocker jika:

- backup episode gagal;
- migration atau tenant isolation test gagal;
- preview lama tidak dapat dipertahankan secara recoverable;
- required media file hilang;
- proposed recovery membutuhkan perubahan kreatif di luar rentang yang disetujui;
- tindakan berikutnya memerlukan Production deployment.

