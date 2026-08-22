# Instruksi Agent AI Antigravity — Hybrid Prompt API & Dev Smoke Test YouTube Studio

## Mandat

Implementasikan plan berikut secara penuh dan berurutan:

- `sot/menus/youtube-studio-hybrid-api-smoke-implementation-plan.md`
- `sot/menus/youtube-studio-hybrid-production-implementation-plan.md`
- `sot/menus/youtube-studio-production-factory-implementation-plan.md`
- `AGENTS.md`

Tujuan: API YouTube Studio harus mampu menghasilkan satu **hybrid prompt package** yang memuat prompt T2I, I2V, dan bila relevan T2V dari script episode yang sudah approved. Setelah itu sediakan smoke test authenticated di Mac Mini Dev yang berhenti pada prompt package—tanpa generate image, TTS, video, render, upload, atau biaya G-Labs.

## Fakta Audit yang Harus Dipertahankan

- `lib/youtube-studio-hybrid-planner.js` sudah dapat menghasilkan `generation_mode`, `t2i_prompt`, `i2v_prompt`, dan `t2v_prompt`.
- `app/api/v2/youtube-studio/episodes/[id]/production-plan/route.js` saat ini masih memanggil planner legacy `generateProductionPlan()`.
- Repository/schema menyimpan field hybrid, worker mempunyai cabang T2I/I2V, dan endpoint hybrid hanya berisi approval action.
- Jangan menyatakan hybrid selesai hanya karena code planner ada. Jalur API aktif, validasi, persistence, approval guard, worker selection, UI review, dan Dev smoke harus dibuktikan.

## Bacaan dan Audit Wajib

1. Baca `AGENTS.md` lengkap.
2. Baca implementation plan ini dan plan yang dirujuk lengkap.
3. Baca dokumentasi Next.js lokal yang relevan sebelum mengubah route handler/Client Component.
4. Audit sebelum edit:
   - `app/api/v2/youtube-studio/episodes/[id]/production-plan/route.js`
   - `app/api/v2/youtube-studio/episodes/[id]/hybrid-production/route.js`
   - `lib/youtube-studio-hybrid-planner.js`
   - `lib/youtube-studio-production-planner.js`
   - `lib/youtube-studio-contract.js`
   - `lib/youtube-studio-production-repository.js`
   - `lib/youtube-studio-production-worker.js`
   - `lib/youtube-studio-visual-adapter.js`
   - relevant UI/API test files.
5. Jalankan `git status --short` dan lindungi perubahan user/agent lain.
6. Jalankan baseline build/test sebelum mulai.

## Aturan Domain dan Safety

- Production mode harus eksplisit: `legacy_t2v` atau `hybrid`. Default existing API harus tetap compatible sebagai `legacy_t2v` sampai UI hybrid review benar-benar tersedia.
- Jangan infer mode hanya dari kosong/tidaknya prompt; persist/read mode secara deterministic di package plan data atau schema yang justified.
- Jalur legacy approval dan hybrid approval harus saling menolak. Satu package tidak boleh dapat antrian dari dua mode.
- Generating prompt package tidak boleh mengenqueue scheduler job, G-Labs, TTS, rendering, atau upload.
- T2I/I2V workflow harus membutuhkan review gate: prompt package → start frame → voice-over → visual video. Jangan melompati approval.
- Worker T2I hanya menyimpan start-frame path. I2V dijalankan oleh job visual yang berbeda setelah voice-over batch approved, menggunakan `image_to_video` dengan path itu. T2V tetap memakai `text_to_video` tanpa reference image.
- Jangan menjalankan request G-Labs nyata pada automated/local test. Gunakan mocks.
- Jangan mengekstrak token/session/cookie/API key dari browser, database, log, atau environment pengguna. Smoke test hanya menerima token sebagai runtime environment variable yang pengguna sediakan.
- Jangan delete data source. Smoke test membuat episode `[SMOKE]` dengan ID unik pada channel/series Dev yang dikontrol dan melaporkan ID-nya untuk archive manual.

## Aturan API dan Validasi

- `POST /episodes/:id/production-plan` menerima body `production_mode`; validasi allowlist dan default legacy safely ketika body kosong.
- Untuk `hybrid`, panggil `generateHybridPromptMatrix()` dan inject KB snapshot yang sesuai stage production.
- Semua hybrid shot harus divalidasi server-side:
  - mode valid;
  - T2I+I2V memiliki `t2i_prompt` + `i2v_prompt`;
  - T2V memiliki `t2v_prompt`;
  - AI generated shot duration sesuai `profile.generatedShotDurations`;
  - total shot duration per scene dan total episode valid;
  - profile key valid/konsisten.
- Kembalikan `production_mode` pada API response; jangan tampilkan raw credential/private KB snapshot pada response.
- Guard action hybrid berdasarkan package mode, batch status, and sequence; repeated approval harus idempotent atau ditolak tanpa membuat duplicate jobs.

## UI dan CSS

- Tambahkan pilihan/CTA hybrid hanya pada panel production yang telah memiliki script approved dan generation profile.
- User harus dapat melihat prompt type, prompt text, generation mode, duration, and approval state sebelum melakukan approval.
- Jangan aktifkan approval berikutnya sampai batch sebelumnya benar-benar reviewable/complete.
- CSS harus memakai CSS Module dan token `app/theme.css`; tanpa inline visual style, hex/rgb/rgba/color-mix, theme baru, atau hard-coded visual values pada file yang disentuh.

## Smoke Test Dev

Buat script seperti `scripts/test-youtube-studio-hybrid-prompt-api.mjs` dan package script yang jelas. Input runtime wajib:

```bash
YT_SMOKE_BASE_URL='http://100.95.245.55:5020'
YT_SMOKE_TOKEN='<user-provided-token>'
YT_SMOKE_CHANNEL_ID='<controlled-dev-channel>'
YT_SMOKE_SERIES_ID='<controlled-dev-series>'
```

Flow test:

```text
POST episode short unique
POST research
POST blueprint
POST blueprint approve
POST script
POST script approve
POST generation profile
POST production-plan { production_mode: hybrid }
assert persisted hybrid package has >=1 t2i_i2v shot and non-empty t2i/i2v prompt
assert no approval/render/external generation action was called
```

- Script harus merahasiakan token dan raw prompt dalam output.
- Gunakan episode pendek (60–90 detik) dengan tema yang memerlukan recurring subject/location agar prompt T2I/I2V deterministik.
- Tidak ada smoke test yang menekan approve prompt package, final render, publish, atau upload.
- Jika API credential belum diberikan, selesaikan seluruh automated mocked test/build, lalu laporkan smoke Dev sebagai pending credential—jangan bypass auth.

## Progress Control

- Update checkbox pada `sot/menus/youtube-studio-hybrid-api-smoke-implementation-plan.md` bagian `## 4. Execution Task List` dari `[ ]` ke `[x]` hanya sesudah step diverifikasi.
- Jika file baru perlu diubah, tambahkan dulu ke `## 5. Planned File Changes` dengan alasan serta Code Sebelum/Code Sesudah sebelum edit.

## Verifikasi Wajib

1. Legacy production-plan behavior tetap berjalan tanpa request body/ketika mode legacy.
2. Hybrid plan memiliki prompt T2I dan I2V yang valid serta tersimpan pada asset record.
3. Invalid mode/prompt/duration ditolak dengan error actionable.
4. Legacy approval menolak package hybrid dan hybrid approval menolak package legacy.
5. Worker mock membuktikan start-frame persisted memicu `image_to_video`; T2V tanpa frame memakai `text_to_video`.
6. Tidak ada external job ketika hanya membuat hybrid prompt package.
7. UI prompt review tidak memicu generation otomatis.
8. Focused tests dan `npm run build` lulus.
9. Authenticated Dev smoke berhasil atau secara eksplisit pending hanya karena runtime token belum tersedia.

## Deployment: Dev Only

Satu-satunya deploy yang diizinkan:

```bash
npm run deploy:macmini-dev
```

Verifikasi hanya ke Dev UI `5020` dan API Next.js pada host/port tersebut. Port `7020` bukan pemilik route App Router YouTube Studio.

**Dilarang** deploy staging atau production: jangan jalankan `deploy:staging`, `deploy:macmini-staging`, `deploy:macmini-prod`, `deploy:production`, `deploy:node1`, atau command non-Dev lain.

Jangan lakukan polling SSH berulang ketika remote build berjalan.

## Release dan Laporan Akhir

Setelah semua verification dan Dev smoke berhasil, jalankan SOP release di `AGENTS.md` menggunakan command dalam implementation plan.

Laporan akhir harus memuat:

- daftar file/perubahan dan contract production mode;
- hasil validation and worker tests;
- bukti smoke prompt package (episode ID, mode, profile, number of hybrid shots—tanpa token/raw prompt);
- konfirmasi tidak ada external generation/render/upload selama smoke;
- bukti Dev-only deployment;
- release version, commit, tag, push;
- batasan/risiko yang masih ada.
