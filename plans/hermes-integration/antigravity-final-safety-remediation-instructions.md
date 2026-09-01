# Instruksi Antigravity — Final Safety Remediation Hermes Run-Once

Perbaiki seluruh temuan independent verification ini sampai test dan bukti aktual benar-benar lulus. Fokus tugas ini adalah keamanan serta keandalan operasional. Setelah seluruh gate lulus, jalankan satu smoke campaign baru yang ditentukan dalam dokumen ini.

Dokumen acuan:

- `plans/hermes-integration/antigravity-run-once-operational-closure-instructions.md`
- `plans/hermes-integration/run-once-operational-closure-report.md`
- `plans/hermes-integration/run-once-implementation-plan.md`

## Kondisi yang Sudah Berhasil dan Harus Dipertahankan

- Dev menjalankan MAKNA `v2.29.10`.
- Credential `opcred_hermes_dev` aktif dan token plist saat ini cocok dengan hash database Dev.
- `whoami`, catalog, dan status smoke menghasilkan HTTP 200.
- Smoke `car_4dd16822ab764f41` memiliki tepat enam item di manual review.
- Publishing intent/job untuk smoke tersebut nol.
- Schedule run-once paused dengan `next_run_at=null`.
- `ENABLE_AGENT_AUTO_PUBLISH=false`.

Jangan merusak atau mengulang smoke lama tersebut. Gunakan sebagai fixture read-only untuk regression verification, lalu buat tepat satu smoke baru sesuai spesifikasi pada bagian Deployment dan Smoke Test.

## Otorisasi Full Auto untuk Antigravity

Pengguna memberikan otorisasi eksplisit kepada Antigravity untuk menyelesaikan tugas ini secara full auto tanpa meminta approval berulang selama tindakan tetap berada dalam batas berikut:

### Tindakan yang sudah diizinkan

- membaca dan mengubah source, test, dokumentasi, serta konfigurasi repository;
- membuat dan memperbarui fixture test yang terisolasi;
- menjalankan seluruh unit, integration, regression test, lint/check, dan build;
- memperbaiki credential Hermes Dev dan menjalankan atomic rotation/rollback;
- memperbarui plist Hermes Dev secara aman tanpa menampilkan secret;
- restart/reload Hermes gateway dan proses PM2 **Dev**;
- deploy berulang ke Mac Mini **Dev** bila diperlukan sampai seluruh gate lulus;
- menjalankan authenticated health check dan query read-only Dev;
- menjalankan tepat satu smoke campaign baru yang didefinisikan di dokumen ini;
- melakukan commit, patch release, tag, dan push sesuai SOP repository;
- memperbaiki kembali kegagalan yang ditemukan dan mengulang test/deploy Dev tanpa meminta instruksi tambahan.

Antigravity harus mengelompokkan operasi yang membutuhkan akses server agar tidak memunculkan approval berkali-kali. Gunakan satu sesi deploy/SSH yang terkontrol bila memungkinkan dan ikuti aturan tanpa polling SSH berulang.

### Batas yang tetap tidak boleh dilanggar

- Tidak boleh deploy, restart, atau mengubah Staging dan Production.
- Tidak boleh melakukan posting ke TikTok, Instagram, Facebook, YouTube, atau platform lain.
- Tidak boleh menyetujui start frame atau melanjutkan smoke melewati manual review.
- Tidak boleh menghapus/mengubah campaign, publishing job, atau data pengguna yang sudah ada.
- Tidak boleh menampilkan atau memasukkan secret ke git/log/report.
- Tidak boleh melakukan tindakan destruktif di luar fixture test unik milik tugas ini.

Selama masih dalam otorisasi di atas, jangan berhenti untuk meminta konfirmasi pengguna. Bila tool/platform secara teknis tetap menampilkan dialog izin sistem, minta satu izin dengan cakupan paling sempit yang cukup, lalu lanjutkan seluruh pekerjaan tanpa pertanyaan tambahan. Hanya berhenti bila penyelesaian membutuhkan pelanggaran batas di atas atau secret/akses eksternal yang benar-benar tidak tersedia.

## 1. Jadikan Rotasi Token Benar-Benar Atomik

File utama:

- `scripts/rotate-hermes-token.mjs`

### Masalah

Implementasi sekarang menimpa `token_hash` credential aktif sebelum plist dan token baru diverifikasi. Bila update plist, restart, atau health check gagal, token lama langsung mati dan Hermes kembali mendapat 401.

### Code Sebelum (Current/Before)

```js
await client.query(`
  INSERT INTO operator_credentials (...)
  VALUES (...)
  ON CONFLICT (id) DO UPDATE
  SET token_hash = EXCLUDED.token_hash,
      status = 'active'
`, [...]);

// baru setelah itu plist diperbarui dan diverifikasi
```

### Code Sesudah (Proposed/After)

Gunakan dual-credential rotation:

```js
const candidateId = `opcred_hermes_dev_${rotationId}`;

// 1. Buat candidate credential baru; credential lama tetap aktif.
await createCandidateCredential(candidateId, newTokenHash, minimumScopes);

// 2. Backup nilai plist lama di memory dengan permission aman.
// 3. Atomic replace plist memakai token candidate.
// 4. Restart Hermes.
// 5. whoami + catalog harus HTTP 200 dan actor harus candidateId.
// 6. Baru setelah sukses: nonaktifkan credential lama.
// 7. Bila gagal: restore plist lama, restart, hapus/nonaktifkan candidate,
//    lalu buktikan credential lama kembali HTTP 200.
```

Ketentuan wajib:

1. Credential lama tidak boleh diubah/dinonaktifkan sebelum candidate berhasil.
2. Verifikasi harus memastikan actor/credential ID adalah candidate, bukan sekadar HTTP 200 dari token lain.
3. Rollback harus mencakup database, plist, dan restart Hermes.
4. Jalankan rotasi dengan lock agar dua rotasi paralel tidak terjadi.
5. Hanya satu credential runtime menjadi primary setelah sukses; credential lama berstatus revoked/inactive sesuai schema.
6. Jangan mencetak raw token, hash, isi plist, atau secret.
7. Script harus exit non-zero bila satu tahap gagal.
8. Tambahkan `--dry-run` yang hanya melakukan preflight tanpa membuat token.

Tambahkan integration test untuk:

- success rotation;
- kegagalan update plist;
- kegagalan restart;
- kandidat menghasilkan 401;
- rollback mengembalikan token lama ke HTTP 200;
- dua eksekusi paralel tidak menghasilkan dua primary credential.

Gunakan fixture credential terisolasi untuk failure injection. Jangan merusak credential Hermes runtime ketika mengetes jalur gagal.

## 2. Kembalikan Agent Worker Menjadi Fail-Closed

File:

- `instrumentation.js`

### Code Sebelum (Current/Before)

```js
if (backgroundServicesEnabled && process.env.ENABLE_AGENT_AUTOMATION_WORKER !== 'false') {
  startAgentAutomationWorker();
}
```

### Code Sesudah (Proposed/After)

```js
if (backgroundServicesEnabled && process.env.ENABLE_AGENT_AUTOMATION_WORKER === 'true') {
  startAgentAutomationWorker();
}
```

Tambahkan test nyata terhadap bootstrap decision:

- variable absent → worker tidak start;
- empty → tidak start;
- `false` → tidak start;
- `1` → tidak start;
- `true` → start tepat sekali;
- dua kali register/start tidak membuat interval worker ganda.

Jangan hanya menguji salinan kondisi di test. Ekstrak helper produksi murni bila diperlukan dan pastikan `instrumentation.js` memakainya.

## 3. Hapus Aktivasi Agent Worker dari Staging

File:

- `ecosystem.macmini.config.cjs`

### Code Sebelum (Current/Before)

Blok Staging dan Dev sama-sama memiliki:

```js
ENABLE_AGENT_AUTOMATION_WORKER: 'true',
```

### Code Sesudah (Proposed/After)

```js
// Staging: jangan set true; absent atau explicit false
ENABLE_AGENT_AUTOMATION_WORKER: 'false',

// Dev saja
ENABLE_AGENT_AUTOMATION_WORKER: 'true',
```

Ketentuan:

- Jangan deploy atau restart Staging.
- Perubahan config memastikan deployment Staging berikutnya tidak mengaktifkan worker tanpa rollout terpisah.
- Dev harus tetap aktif setelah deploy Dev.
- Production tidak boleh disentuh.
- Tambahkan static/config test yang memastikan hanya Dev bernilai true, sedangkan Staging/Production false atau absent.

## 4. Integration Suite Harus Keluar Alami

File utama:

- `scripts/test-content-run-once-integration.mjs`
- `lib/db-pg.js` atau migration bootstrap terkait bila diperlukan.

### Masalah

Suite mencetak 15/15 lulus, tetapi proses tetap menggantung lebih dari satu menit pada teardown dan harus dihentikan manual. Dengan demikian exit code 0 serta klaim zero resource leak belum benar.

### Code Sebelum (Current/Before)

```js
await directPool.end();
if (appPoolRef) await appPoolRef.end();
console.log('All connection pools closed');
// background auto-migrations/timer masih hidup
```

### Code Sesudah (Proposed/After)

Implementasikan test-aware migration lifecycle, misalnya:

```js
process.env.DISABLE_AUTO_MIGRATIONS = 'true';

// atau
const migrationHandle = await startMigrations();
await migrationHandle.done;
await migrationHandle.close();
```

Pilih pola yang sesuai arsitektur, dengan syarat:

1. Integration test tidak memulai puluhan migration fire-and-forget.
2. Bila migration dibutuhkan, semuanya dapat di-`await`.
3. Semua pool, interval, timeout, listener, dan worker ditutup di `finally`.
4. Jangan menggunakan `process.exit(0)` untuk menyamarkan open handle.
5. Jalankan test dengan timeout eksternal 60 detik; proses harus keluar sendiri jauh sebelum timeout.
6. Capture exit code aktual `0`.
7. Setelah selesai tidak boleh ada fixture `test_run_once_*` tersisa.
8. Tidak boleh ada `unhandledRejection`, deprecation akibat concurrent query, atau async activity setelah test selesai.

Tambahkan diagnostic hanya bila aman, misalnya daftar jenis active handles tanpa detail secret, dan pastikan hasil akhirnya nol handle aplikasi yang tertinggal.

## 5. Hilangkan Default Credential Database dari Script Admin/Test

Audit minimal:

- `scripts/rotate-hermes-token.mjs`
- `scripts/test-content-run-once-integration.mjs`
- `scripts/verify-smoke-lifecycle.mjs`
- `scripts/test-operator-content.mjs`
- script Hermes/run-once lain yang baru ditambahkan.

### Code Sebelum (Current/Before)

```js
const pgHost = process.env.PGHOST || '100.x.x.x';
const pgUser = process.env.PGUSER || '...';
const pgPassword = process.env.PGPASSWORD || '...';
const pgDatabase = process.env.PGDATABASE || '...';
```

### Code Sesudah (Proposed/After)

```js
const required = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment: ${key}`);
}
```

Ketentuan:

- Tidak ada password/token/API key default dalam source.
- Schema harus eksplisit `dev` untuk script Dev dan diverifikasi sebelum mutation.
- Script harus menolak schema `public` atau `staging`.
- Jangan mencetak connection string atau password.
- Gunakan loader Dev resmi bila tersedia; jangan memakai staging loader.

## 6. Tambahkan Auth Preflight yang Benar

Script manual `check-hermes-auth.mjs` belum sama dengan startup preflight.

Tambahkan preflight pada proses Hermes/wrapper resminya:

1. satu kali `whoami` sebelum menerima job MAKNA;
2. 200 + scope benar → log `MAKNA_OPERATOR_AUTH_READY`;
3. 401/403 → log `MAKNA_OPERATOR_AUTH_INVALID`, jangan membuat campaign;
4. timeout/network error → log `MAKNA_OPERATOR_UNAVAILABLE`;
5. tidak boleh melakukan discovery filesystem, source, PM2, DB, atau port alternatif;
6. retry terbatas dengan exponential backoff;
7. log tidak mengandung token/header Authorization;
8. health status dapat diperiksa tanpa membuat campaign.

Tambahkan test untuk 200, 401, 403, timeout, malformed response, redaction, dan bounded retry.

## 7. Koreksi Operational Closure Report

File:

- `plans/hermes-integration/run-once-operational-closure-report.md`

Perbaiki bukti yang tidak sesuai schema. `publishing_jobs` tidak memiliki kolom `run_id`.

### Code Sebelum (Current/Before)

```sql
SELECT COUNT(*) FROM publishing_jobs
WHERE run_id = 'car_4dd16822ab764f41';
```

### Code Sesudah (Proposed/After)

```sql
SELECT COUNT(*)
FROM publishing_jobs j
JOIN agent_publishing_intents i ON i.publishing_job_id = j.id
WHERE i.run_id = $1;
```

Gunakan Agent Run ID sebagai parameter sesuai schema. Koreksi laporan agar hanya memuat command dan hasil yang benar-benar dijalankan.

Tambahkan pada report:

- integration suite sebelumnya sempat menggantung;
- hasil sesudah perbaikan lengkap dengan durasi dan exit code;
- bukti token rotation success dan failure rollback;
- hasil auth preflight setelah restart;
- konfigurasi Staging tetap inactive tanpa melakukan deploy/restart Staging;
- hasil smoke baru: resolved Brand/Product/Preset IDs, Run ID, Agent Run ID, Research Task ID, Operator Job/Campaign ID, latency, replay, event ordering, enam item, dan bounded status;
- bukti run-specific zero publishing intent/job/Repliz dan schedule non-recurring untuk smoke baru;
- residual risk yang sebenarnya.

## 8. Test Gate Wajib

Jalankan minimal:

```bash
node --test tests/content-run-once.test.js tests/agent-automation.test.js tests/hermes-client.test.js
RUN_ONCE_TEST_SCHEMA=dev npm run test:content-run-once:integration
npm run test:content-automation
npm run test:operator-content
npm run test:publishing-scheduler
npm run build
```

Tambahkan test khusus:

```bash
npm run test:hermes-token-rotation
npm run test:agent-worker-bootstrap
npm run test:hermes-auth-preflight
```

Jika nama script berbeda, dokumentasikan nama aktual pada report.

Acceptance test:

- semua exit code 0;
- unexpected skip 0;
- integration process keluar alami <60 detik;
- open handle/background async leak 0;
- worker absent/false tidak start;
- token rotation failure rollback terbukti;
- Staging config tidak mengaktifkan Agent Worker;
- build berhasil.

## 9. Deployment, Verifikasi, dan Smoke Test Baru

1. Deploy hanya Mac Mini Dev dengan SOP remote build.
2. Jangan deploy/restart Staging atau Production.
3. Verifikasi Dev memakai patch release baru.
4. Verifikasi PM2 Dev online dan restart count stabil.
5. Verifikasi effective flags Dev:
   - `ENABLE_HERMES_RUN_ONCE=true`;
   - `ENABLE_AGENT_AUTOMATION_WORKER=true`;
   - `ENABLE_AGENT_AUTO_PUBLISH=false`.
6. Restart Hermes gateway satu kali.
7. Verifikasi authenticated `whoami`, catalog, dan status smoke lama tetap HTTP 200.
8. Verifikasi actor `opcred_hermes_dev` atau primary credential baru, tenant `default_tenant`, dan scope minimum.
9. Jalankan reconciliation read-only/status check terhadap `car_4dd16822ab764f41`:
   - status `awaiting_manual_review`;
   - total 6, ready 6, failed 0;
   - publishing intent 0;
   - publishing job 0;
   - schedule paused/non-recurring.
10. Setelah seluruh safety/test/deployment gate lulus, jalankan tepat satu smoke campaign baru melalui credential dan jalur API yang sama dengan Hermes.

### Spesifikasi Smoke Baru

- Product: `Pagibaik Rolled Oat Gluten Free`.
- Brand profile: `dapurbotani`.
- Preset: `dapurbotani_kampanye_produk_4_klip_v2`.
- Mode: `run_once`.
- Video count: `6`.
- Research: aktif, terbaru, dan relevan dengan produk.
- Platform context: TikTok.
- Review mode: manual review setelah start frame.
- Publishing policy: `draft_only`.
- Publishing target/account: kosong; jangan membuat target posting.

Brand Profile ID, Product ID, dan validitas preset harus di-resolve terlebih dahulu melalui authenticated `content-catalog`; jangan hardcode ID dan jangan mencari melalui filesystem/database sebagai fallback alur Hermes. Jika catalog tidak menemukan entitas persis tersebut, perbaiki catalog/preset configuration pada Dev dalam scope tugas ini, kemudian ulangi catalog resolution. Jangan mengganti dengan produk atau preset lain.

### Acceptance Evidence Smoke Baru

1. POST menggunakan Idempotency-Key unik dan mengembalikan HTTP 202.
2. Latency enqueue dari sisi pemanggil `<2 detik`.
3. Response memiliki Run ID baru dan `replayed=false`.
4. Replay body/key yang sama menghasilkan Run ID sama dan `replayed=true`.
5. Research dispatch terjadi tepat satu kali.
6. Operator Campaign menghasilkan tepat enam item.
7. Keenam item memiliki start frame siap dan berhenti di `awaiting_manual_review`.
8. Jangan menyetujui satu pun start frame dan jangan melanjutkan ke produksi video final.
9. Content Run, Agent Run, Operator Job, jumlah item, dan status API konsisten.
10. Schedule `execution_mode=run_once`, `status=paused`, dan `next_run_at=null`.
11. Run-specific publishing intent count = 0.
12. Publishing job count melalui relasi schema yang benar = 0.
13. Repliz/social publishing correlation count = 0.
14. Tidak ada posting ke platform mana pun.

Smoke ini telah diotorisasi pengguna dan tidak memerlukan permintaan approval tambahan. Antigravity tetap wajib berhenti pada manual review.

## 10. Release dan Checklist

- Buka kembali item checklist yang terkait safety remediation.
- Tambahkan Before/After snippet untuk file tambahan sebelum mengedit.
- Perbarui checkbox secara real-time berdasarkan bukti.
- Buat patch release baru melalui SOP repository setelah seluruh gate lulus.
- Push commit dan tag, lalu verifikasi remote.
- Deploy patch hanya ke Dev.
- Pastikan worktree bersih.

## Execution Task List

- [ ] Buka kembali checklist safety yang belum terbukti.
- [ ] Ubah rotasi token menjadi dual-credential atomic rotation.
- [ ] Tambahkan rollback database/plist/restart untuk kegagalan rotasi.
- [ ] Tambahkan lock dan test rotasi paralel.
- [ ] Kembalikan Agent Worker menjadi fail-closed.
- [ ] Tambahkan test bootstrap worker absent/false/true dan single interval.
- [ ] Nonaktifkan Agent Worker pada konfigurasi Staging tanpa deploy/restart Staging.
- [ ] Tambahkan config isolation test Dev vs Staging/Production.
- [ ] Hilangkan seluruh default credential database dari script baru.
- [ ] Perbaiki migration/pool lifecycle agar integration suite keluar alami.
- [ ] Buktikan integration suite exit 0 dalam <60 detik tanpa open handle.
- [ ] Tambahkan startup auth preflight dan bounded retry.
- [ ] Tambahkan test auth preflight serta secret redaction.
- [ ] Koreksi query dan klaim bukti pada operational closure report.
- [ ] Jalankan seluruh test gate dan build.
- [ ] Buat patch release dan push commit/tag.
- [ ] Deploy hanya ke Dev.
- [ ] Restart Hermes dan verifikasi auth tetap HTTP 200.
- [ ] Verifikasi smoke lama tetap 6 item manual review dan zero-publishing.
- [ ] Resolve catalog untuk brand `dapurbotani`, produk `Pagibaik Rolled Oat Gluten Free`, dan preset `dapurbotani_kampanye_produk_4_klip_v2`.
- [ ] Jalankan tepat satu smoke baru yang diotorisasi dengan 6 item dan `draft_only`.
- [ ] Buktikan enqueue HTTP 202 <2 detik dan idempotency replay Run ID yang sama.
- [ ] Buktikan satu research dispatch dan tepat 6 start frame berhenti di manual review.
- [ ] Buktikan zero publishing intent/job/Repliz serta schedule non-recurring untuk smoke baru.
- [ ] Konfirmasi tidak ada approval start frame, posting, deploy Staging, atau deploy Production.
- [ ] Serahkan report final dengan command, exit code, durasi, dan residual risk aktual.

## Definition of Done

Pekerjaan hanya selesai bila:

- rotasi token tidak pernah mematikan token lama sebelum token baru terverifikasi;
- failure injection membuktikan rollback menjaga token lama tetap HTTP 200;
- worker hanya aktif pada nilai eksplisit `true`;
- konfigurasi Staging/Production tidak mengaktifkan Agent Worker;
- integration suite keluar sendiri <60 detik dengan exit 0;
- tidak ada credential database hardcoded di script yang disentuh;
- startup auth preflight nyata tersedia dan teruji;
- seluruh unit/integration/regression/build lulus;
- Dev memakai release patch terbaru dan tetap sehat setelah restart;
- smoke lama tetap manual-review, enam item, zero-publishing, non-recurring;
- smoke baru memakai produk `Pagibaik Rolled Oat Gluten Free`, brand `dapurbotani`, dan preset `dapurbotani_kampanye_produk_4_klip_v2`;
- smoke baru HTTP 202 <2 detik, idempotent, satu research dispatch, dan tepat enam item siap manual review;
- smoke baru menghasilkan nol publishing intent, nol publishing job, nol Repliz call, serta tidak recurring;
- laporan menggunakan query sesuai schema dan tidak melebihkan bukti;
- Staging dan Production tidak disentuh.

Jika satu kondisi belum terpenuhi, jangan menyatakan tugas selesai.
