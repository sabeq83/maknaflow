# Instruksi Antigravity — Finalisasi Hermes Run-Once Sampai Operasional

Kerjakan instruksi ini sampai seluruh Definition of Done terbukti. Ini bukan tugas audit atau perbaikan parsial. Jangan berhenti setelah source code, unit test, build, release, atau deploy saja.

Target akhir: Hermes di Mac Mini dapat menerima instruksi run-once, segera mengembalikan Run ID, lalu MAKNA menjalankan riset dan membuat tepat 6 video sampai `awaiting_manual_review`, tanpa membuat publishing schedule/job dan tanpa memanggil Repliz.

Gunakan dokumen utama:

- `plans/hermes-integration/run-once-implementation-plan.md`
- `plans/hermes-integration/antigravity-run-once-remediation-instructions.md`

Instruksi ini menggantikan status selesai yang belum didukung bukti pada kedua dokumen tersebut.

## Batas Kewenangan dan Keselamatan

- Boleh mengubah source, test, konfigurasi Mac Mini **Dev**, skill Hermes, dan proses PM2 Dev.
- Boleh menjalankan tepat satu smoke campaign `draft_only` yang didefinisikan di bawah.
- Dilarang deploy atau mengubah Staging dan Production.
- Dilarang melakukan posting ke TikTok/Instagram/Facebook/YouTube.
- Dilarang menyetujui start frame atau melanjutkan video melewati manual review.
- Dilarang menampilkan token, API key, callback secret, password, atau isi `.env.local` ke log/handoff.
- Jangan menonaktifkan atau menghapus publishing job milik pengguna yang sudah ada. Verifikasi zero-publishing harus run-specific atau memakai delta sebelum/sesudah.
- Jika secret Hermes yang benar tidak dapat ditemukan secara aman, jangan membuat nilai palsu dan jangan menandai selesai. Pertahankan feature flag off dan laporkan blocker persisnya.

## Kondisi Terverifikasi per 1 September 2026

- Source lokal dan Mac Mini Dev sudah `v2.29.7`.
- Skill aktif berada di `~/.hermes/skills/autonomous-ai-agents/makna-content-orchestrator/SKILL.md`, versi `1.1.0`.
- Proses `maknaflow-dev-ui` dan `maknaflow-dev-api` online.
- Operator API yang benar berada pada `http://127.0.0.1:5020`, bukan port 7020.
- Credential dari `~/Library/LaunchAgents/ai.hermes.gateway.plist` berhasil mengakses `whoami` dan `content-catalog` dengan HTTP 200.
- `ENABLE_HERMES_RUN_ONCE` belum tersedia pada environment proses MAKNA Dev.
- `ENABLE_AGENT_AUTOMATION_WORKER` belum tersedia pada environment proses MAKNA Dev.
- `HERMES_API_BASE_URL`, `HERMES_API_KEY`, dan `HERMES_CALLBACK_SECRET` belum terbukti tersedia pada environment proses MAKNA Dev.
- Test gabungan menghasilkan 18 pass, 1 skip, lalu file tetap gagal akibat asynchronous `unhandledRejection` setelah DB test di-skip.
- Checklist plan saat ini salah karena deploy/smoke/zero-publishing sudah dicentang tanpa bukti yang memadai.

## Masalah P0 — Integration Test Tidak Boleh Skip atau Bocor Async Work

Perbaiki `tests/content-run-once.test.js` dan bootstrap database yang terkait.

### Code Sebelum (Current/Before)

```js
} catch (err) {
  if (err.code === 'ECONNREFUSED' || err.message?.includes('connect')) {
    t.skip('Database PostgreSQL tidak tersedia di lingkungan lokal unit test.');
    return;
  }
  throw err;
}
```

Pola tersebut tidak cukup karena import `db-pg.js` memulai migrasi asinkron yang masih berjalan setelah test selesai.

### Code Sesudah (Proposed/After)

Implementasikan salah satu pola yang benar berikut, pilih berdasarkan arsitektur repo:

```js
test('Database Integration: ...', { skip: !hasExplicitIntegrationDbConfig() }, async () => {
  const db = await createIntegrationDbHarness();
  try {
    await db.setup();
    // assertions nyata
  } finally {
    await db.cleanup();
    await db.close();
  }
});
```

atau pisahkan menjadi script integration khusus yang selalu menerima konfigurasi DB eksplisit:

```json
{
  "scripts": {
    "test:content-run-once:unit": "node --test tests/content-run-once.unit.test.js",
    "test:content-run-once:integration": "node scripts/test-content-run-once-integration.mjs"
  }
}
```

Ketentuan wajib:

1. Import unit test tidak boleh memulai auto-migration atau koneksi DB di background.
2. Seluruh promise setup/migration/pool harus di-`await` dan pool harus ditutup.
3. Unit suite lokal boleh tidak memakai DB, tetapi harus benar-benar **pass**, bukan skip yang berakhir unhandled rejection.
4. Integration suite wajib dijalankan terhadap schema `dev` dari Mac Mini atau runner yang mempunyai koneksi ke DB.
5. Integration suite wajib gagal tegas bila konfigurasi integration DB diharapkan tetapi tidak tersedia.
6. Jangan melemahkan assertion atau menangkap semua error hanya agar hijau.

## Masalah P0 — Lengkapi Integration Coverage Nyata

Integration test wajib membuktikan seluruh hal berikut pada fixture tenant unik dan cleanup yang aman:

1. Query Brand Profile tanpa kolom fiktif berhasil.
2. Product lookup tenant-scoped berhasil.
3. Custom tenant preset ter-hydrate dan kompatibel dengan `product_campaign`.
4. Feature flag absent dan `false` menghasilkan `RUN_ONCE_DISABLED`; `true` mengizinkan enqueue.
5. Same idempotency key + same body paralel menghasilkan satu run dan replay.
6. Same idempotency key + different body menghasilkan satu sukses dan satu `409 IDEMPOTENCY_CONFLICT`.
7. Dua idempotency key pada Brand–Product baru memakai satu binding aktual tanpa dangling ID.
8. Injected failure setelah binding/schedule insert me-roll back seluruh mutation request.
9. Enqueue tidak membuat `agent_automation_runs` sebelum immutable snapshot siap.
10. Event order aktual: content run claimed → snapshot siap → agent run scheduled → research dispatched.
11. Create endpoint tidak memanggil Hermes, Gemini, G-Labs, atau Repliz secara inline.
12. Response enqueue sehat `< 2 detik` dan mengembalikan durable Run ID.
13. Status endpoint menjaga tenant isolation dan tidak membocorkan secret/prompt internal.
14. `draft_only` tidak menghasilkan publishing intent/job atau Repliz call.
15. Session run-now serta recurring automation tetap lulus regression test.

Gunakan fixture dengan prefix jelas seperti `test_run_once_*`. Cleanup hanya data fixture tersebut; jangan memakai truncate dan jangan menyentuh data pengguna.

## Masalah P0 — Konfigurasi Dev Harus Persisten

Konfigurasi tidak boleh hanya di-export pada satu shell karena akan hilang setelah PM2 restart/reboot.

Simpan konfigurasi non-secret dan secret melalui mekanisme Dev yang memang dimuat proses Next/PM2. `.env.local` remote tidak ikut `rsync`, jadi lakukan update terarah di `~/maknaflow-dev/.env.local`, pertahankan seluruh nilai lain, dan jangan pernah mencetak file tersebut.

### Code Sebelum (Current/Before)

```dotenv
# Tidak ada ENABLE_HERMES_RUN_ONCE
# Tidak ada ENABLE_AGENT_AUTOMATION_WORKER
# Hermes Runs API/callback readiness belum terbukti
```

### Code Sesudah (Proposed/After)

```dotenv
ENABLE_HERMES_RUN_ONCE=true
ENABLE_AGENT_AUTOMATION_WORKER=true
ENABLE_AGENT_AUTO_PUBLISH=false
HERMES_API_BASE_URL=http://127.0.0.1:8642
HERMES_API_KEY=<nilai valid, jangan ditampilkan>
HERMES_CALLBACK_SECRET=<nilai kuat dan cocok dengan callback verifier, jangan ditampilkan>
```

Catatan:

- Jangan mengarang `HERMES_API_KEY`. Ambil secara aman dari konfigurasi Hermes Runs API/gateway yang aktif, atau lakukan provisioning resmi bila memang belum ada.
- Pastikan UI process `maknaflow-dev-ui` benar-benar membaca konfigurasi tersebut. API Express pada port 7020 bukan tempat endpoint Operator v2.
- Verifikasi environment efektif melalui indikator `PRESENT/ABSENT` atau fingerprint parsial satu arah, bukan nilai secret.
- Restart/graceful reload hanya proses Dev yang diperlukan dengan `--update-env` bila dibutuhkan.
- Setelah restart, verifikasi flag dari environment efektif proses, bukan hanya isi file.
- `ENABLE_AGENT_AUTO_PUBLISH` harus eksplisit `false`.

## Masalah P0 — Verifikasi Hermes Runs API dan Callback

Sebelum mengaktifkan Agent Worker:

1. Pastikan Hermes gateway berjalan dan supervised oleh LaunchAgent.
2. Pastikan MAKNA Dev dapat menjangkau `HERMES_API_BASE_URL` yang diizinkan.
3. Lakukan request health/capability atau request test non-produksi sesuai kontrak Hermes Runs API.
4. Pastikan bearer authentication benar tanpa mencetak token.
5. Pastikan callback success/failure ke MAKNA menggunakan signed, task-bound, expiring token.
6. Uji signature valid diterima; signature invalid/expired/wrong-task ditolak.
7. Pastikan callback bersifat idempotent.
8. Pastikan log MAKNA dan Hermes tidak memuat secret.

Jika Hermes yang terpasang ternyata tidak menyediakan endpoint Runs API yang dibutuhkan, implementasi belum selesai. Perbaiki adapter/configuration sesuai kontrak yang sudah disepakati; jangan menyuruh Hermes melakukan inspeksi filesystem sebagai fallback.

## Periksa Ulang Source Remediasi

Audit kembali minimal:

- `lib/content-run-service.js`
- `lib/content-run-contract.js`
- `lib/content-automation-worker.js`
- `lib/agent-automation-worker.js`
- `lib/hermes-client.js`
- route `app/api/operator/v2/content-runs/**`
- route `app/api/operator/v2/content-catalog/**`
- migration/constraint terkait idempotency dan Brand–Product binding

Pastikan:

- feature flag fail-closed;
- transaction dan advisory lock atomic;
- tenant context tetap aktif saat resolve custom preset;
- error hydration preset tidak disamarkan menjadi preset-not-found bila akar masalahnya DB/configuration failure;
- tidak ada import/helper mati yang tersisa;
- worker ownership tidak race;
- status publik konsisten dari enqueue sampai manual review;
- seluruh jalur `draft_only` memaksa `enable_social_post=false` pada server, bukan mempercayai input pengguna.

Untuk setiap file tambahan yang perlu diedit, tambahkan Code Sebelum dan Code Sesudah ke implementation plan **sebelum** melakukan edit.

## Test Gate Wajib Sebelum Deploy

Jalankan seluruh perintah berikut dan simpan exit code serta jumlah pass/fail/skip:

```bash
node --test tests/content-run-once.test.js tests/agent-automation.test.js tests/hermes-client.test.js
npm run test:content-automation
npm run test:operator-content
npm run test:publishing-scheduler
npm run build
```

Tambahkan/jalankan integration command baru terhadap schema Dev. Hasil yang diterima:

- exit code semua command `0`;
- fail `0`;
- unexpected skip `0`;
- unhandled rejection `0`;
- open handle/background async leak `0`.

Kegagalan koneksi DB lokal bukan bukti bug aplikasi, tetapi juga bukan alasan mencentang integration test. Jalankan suite DB pada Mac Mini/lingkungan yang mempunyai akses DB, sebagaimana diwajibkan instruksi sebelumnya.

## Deployment Dev dan Urutan Aktivasi

1. Pastikan semua source test lulus.
2. Deploy hanya Dev dengan `npm run deploy:macmini-dev`.
3. Tunggu remote build tanpa polling SSH berulang; gunakan satu sesi deploy atau interval tunggu minimal dua menit sesuai SOP.
4. Verifikasi package version remote, health UI 5020, PM2 status, dan log boot.
5. Pertama jalankan dengan `ENABLE_HERMES_RUN_ONCE=false` dan `ENABLE_AGENT_AUTOMATION_WORKER=false`.
6. Buktikan endpoint tanpa autentikasi `401`, scope salah `403`, dan run-once disabled `503/RUN_ONCE_DISABLED`.
7. Verifikasi migration dan integration suite pada schema Dev.
8. Set `ENABLE_HERMES_RUN_ONCE=true`, sementara Agent Worker tetap false.
9. Gunakan fixture aman untuk membuktikan enqueue cepat dan durable tetapi tidak dispatch riset.
10. Cleanup hanya fixture aman tersebut.
11. Setelah Hermes Runs API/callback readiness lulus, set `ENABLE_AGENT_AUTOMATION_WORKER=true` dan reload Dev dengan environment terbaru.
12. Verifikasi log boot menyatakan Agent Automation Worker aktif satu kali, tanpa restart loop dan tanpa duplicate worker.

## Smoke Campaign Final yang Diizinkan

Jalankan tepat satu smoke nyata berikut setelah seluruh gate di atas lulus:

- Brand profile: `dapurbotani` — resolve ID dari authenticated catalog, jangan hardcode ID.
- Product: `Rolled Oat Premium Sahabat` — resolve ID dari authenticated catalog, jangan hardcode ID.
- Preset: `dapurbotani_kampanye_produk_4_klip`.
- `video_count`: `6`.
- Mode: `run_once`.
- Research: aktif dan relevan dengan produk.
- Review: `start_frames` / manual review.
- Publishing policy: `draft_only`.
- Platform context: TikTok, tetapi **tanpa publishing target dan tanpa posting**.
- Gunakan Idempotency-Key unik yang dicatat aman.

Ukur dan buktikan:

1. POST mengembalikan HTTP 202 dalam `< 2 detik`.
2. Response berisi satu durable `run_id`.
3. Pengulangan request dengan key/body sama mereplay Run ID yang sama dan tidak membuat duplikat.
4. Research task dibuat tepat satu kali.
5. Event ordering sesuai lifecycle yang dibekukan.
6. Tepat 6 item dibuat untuk campaign tersebut.
7. Semua item mencapai batas `awaiting_manual_review` setelah start frame.
8. Jangan approve satu pun start frame.
9. Tidak ada publishing intent/job yang berhubungan dengan Run ID/campaign ID tersebut.
10. Tidak ada Repliz request untuk Run ID/campaign ID tersebut.
11. Tidak ada recurring schedule aktif; definisi internal run-once tetap paused/non-recurring dan `next_run_at` null.

Gunakan batas waktu masuk akal. Enqueue harus cepat, tetapi produksi enam start frame memang berjalan di background dan boleh memerlukan waktu. Monitor dengan status endpoint berinterval wajar, bukan membuat Hermes membaca source/env/process/DB.

## Cara Membuktikan Zero Publishing dengan Aman

Jangan mengklaim “jumlah seluruh tabel nol” karena mungkin ada publishing job pengguna lain.

Gunakan salah satu bukti run-specific berikut:

```sql
SELECT COUNT(*) FROM agent_publishing_intents
WHERE tenant_id = $1 AND agent_run_id = $2;
```

dan query relasi publishing job yang benar menurut schema aktual melalui `agent_run_id`, campaign ID, content item ID, atau correlation metadata. Jika schema tidak memiliki relasi langsung, ambil snapshot ID/count tenant sebelum smoke dan sesudah smoke lalu buktikan tidak ada row baru yang berkorelasi dengan campaign tersebut. Jangan mengubah data.

Periksa log adapter Repliz menggunakan correlation/run ID; jangan hanya berasumsi dari database.

## Skill Hermes

Sinkronkan skill hasil akhir ke:

`~/.hermes/skills/autonomous-ai-agents/makna-content-orchestrator/`

Verifikasi:

- versi skill terbaru;
- base URL `http://127.0.0.1:5020`;
- hanya `automation:read` dan `automation:write` untuk run-once;
- publishing scopes hanya untuk fitur publishing;
- fail-fast maksimal 30 detik;
- tidak ada instruksi inspeksi source, `.env`, PM2, database, atau mencoba port alternatif;
- Hermes cukup melakukan catalog → POST run → tampilkan Run ID/status URL → monitor bounded status.

Restart/reload Hermes gateway hanya bila diperlukan dan verifikasi proses kembali sehat.

## Perbaiki Checklist yang Salah

Pada `plans/hermes-integration/run-once-implementation-plan.md`, ubah kembali item yang belum terbukti menjadi `[ ]`. Centang satu per satu secara real-time hanya setelah bukti aktual tersedia.

Minimal item berikut harus dibuka kembali sekarang:

- test + build;
- deploy/configuration readiness;
- Dev pilot smoke;
- tepat N item/manual review;
- zero publishing;
- release final.

Jangan menghapus histori. Tambahkan catatan singkat bahwa checklist v2.29.7 dibuka kembali setelah independent verification menemukan test failure dan konfigurasi Dev belum aktif.

## Release dan Git Sync

Setelah seluruh test, deployment, dan smoke berhasil:

1. Pastikan worktree hanya berisi perubahan tugas ini.
2. Buat patch release berikutnya melalui SOP `release-non-interactive`.
3. Judul release harus menyatakan finalisasi operasional Hermes Run-Once.
4. Push branch/main dan tag sesuai SOP repository.
5. Deploy release final tersebut hanya ke Dev bila release dibuat setelah deploy awal.
6. Verifikasi versi remote sama dengan release/tag final.
7. Pastikan worktree bersih.
8. Jangan deploy Staging atau Production.

## Execution Task List

- [ ] Buka kembali checklist lama yang belum memiliki bukti.
- [ ] Tambahkan Before/After snippet untuk semua file baru yang akan diubah.
- [ ] Pisahkan unit dan DB integration lifecycle agar tidak ada background migration leak.
- [ ] Pastikan unit suite lulus tanpa fail dan tanpa unexpected skip.
- [ ] Tambahkan dan luluskan DB integration coverage lengkap pada schema Dev.
- [ ] Tambahkan rollback, concurrency, event-ordering, latency, dan zero-publishing assertions nyata.
- [ ] Audit ulang atomicity, tenant preset hydration, worker ownership, dan server-enforced `draft_only`.
- [ ] Jalankan seluruh regression test dan build dengan exit code 0.
- [ ] Deploy source hanya ke Mac Mini Dev.
- [ ] Verifikasi disabled-state security sebelum aktivasi.
- [ ] Pasang konfigurasi Dev secara persisten tanpa membocorkan secret.
- [ ] Verifikasi Hermes Runs API, authentication, signed callback, dan idempotency.
- [ ] Aktifkan run-once dahulu, lalu Agent Worker setelah readiness lulus.
- [ ] Verifikasi PM2/worker sehat dan tidak restart loop.
- [ ] Sinkronkan dan validasi skill Hermes terbaru.
- [ ] Jalankan tepat satu smoke campaign yang diizinkan.
- [ ] Buktikan enqueue <2 detik, satu research dispatch, tepat 6 item, dan manual-review stop.
- [ ] Buktikan nol publishing intent/job/Repliz call untuk smoke tersebut.
- [ ] Buktikan tidak ada recurring schedule aktif untuk run-once.
- [ ] Buat patch release final, push commit/tag, dan verifikasi Dev memakai versi final.
- [ ] Konfirmasi Staging dan Production tidak disentuh.
- [ ] Serahkan evidence report lengkap dan jujur.

## Definition of Done — Semua Wajib Lulus

Pekerjaan hanya boleh dinyatakan selesai bila:

- seluruh test command exit `0`;
- integration test DB benar-benar dijalankan dan tidak skip;
- build berhasil;
- Dev memakai release final;
- run-once dan Agent Worker aktif secara persisten;
- auto-publish eksplisit off;
- Hermes Runs API dan callback terbukti sehat;
- skill Hermes aktif dan sesuai kontrak;
- satu smoke campaign menghasilkan tepat 6 item dan berhenti pada manual review;
- enqueue <2 detik;
- idempotency replay tidak menduplikasi run/research/campaign;
- smoke menghasilkan nol publishing intent, nol publishing job, dan nol Repliz call;
- run-once tidak menjadi recurring schedule;
- tidak ada secret pada log atau laporan;
- Staging dan Production tidak disentuh;
- checklist dan handoff sesuai bukti aktual.

Jika salah satu poin gagal, pekerjaan belum selesai. Perbaiki akar masalah, ulangi test terkait, deploy ulang Dev bila perlu, lalu ulangi verifikasi. Jangan meminta pengguna mencoba Hermes sebelum seluruh Definition of Done terpenuhi.

## Format Handoff Wajib

Berikan laporan akhir dengan bagian berikut:

1. **Ringkasan hasil:** selesai/belum selesai.
2. **Fix per temuan:** akar masalah, perubahan, file/line.
3. **Test evidence:** command, exit code, pass/fail/skip.
4. **Deployment evidence:** release, commit, tag, versi Dev, PM2 status/restart count.
5. **Configuration readiness:** hanya `PRESENT/ABSENT`, jangan nilai secret.
6. **Hermes readiness:** endpoint/callback/auth hasil dan latency.
7. **Smoke evidence:** Run ID, Agent Run ID, Research Task ID, Campaign/Operator Job ID, jumlah item, status terakhir, event ordering.
8. **Safety evidence:** publishing intent/job/Repliz delta dan bukti non-recurring.
9. **Scope confirmation:** Staging/Production tidak disentuh dan auto-publish tetap off.
10. **Residual risks/blockers:** tulis `none` hanya bila benar-benar tidak ada.

