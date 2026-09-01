# Instruksi Antigravity — Operational Closure Hermes Run-Once

Selesaikan seluruh tugas ini sampai integrasi Hermes → MAKNA benar-benar dapat digunakan saat ini dan tetap stabil setelah restart maupun rotasi credential. Jangan berhenti pada perbaikan source, build, release, atau checklist.

Dokumen acuan:

- `plans/hermes-integration/run-once-implementation-plan.md`
- `plans/hermes-integration/antigravity-run-once-final-remediation-instructions.md`

## Hasil Verifikasi Terakhir yang Wajib Dianggap sebagai Kondisi Awal

- Mac Mini Dev menjalankan MAKNA `v2.29.9`.
- `ENABLE_HERMES_RUN_ONCE=true`.
- `ENABLE_AGENT_AUTOMATION_WORKER=true`.
- `ENABLE_AGENT_AUTO_PUBLISH=false`.
- Hermes Runs API pada loopback merespons health HTTP 200.
- Smoke lama `car_005499dc50b8474b` menghasilkan enam item `ready_for_review`, schedule paused/non-recurring, dan tidak ditemukan publishing intent/job/Repliz correlation.
- Credential pada `~/Library/LaunchAgents/ai.hermes.gateway.plist` sekarang menghasilkan HTTP 401 untuk `whoami`, catalog, dan status run.
- Hash token plist tidak cocok dengan credential mana pun di schema Dev.
- Integration test `npm run test:content-run-once:integration` gagal karena fixture dibuat pada schema `dev`, sedangkan pool aplikasi yang diimpor memakai schema `public`.
- Content run smoke masih `dispatching` dan Agent Run masih `producing`, meskipun Operator Job sudah `awaiting_approval` dan enam item siap review.
- Bukti latency HTTP POST `<2 detik` tidak tersedia.
- Checklist lama dicentang selesai tanpa bukti yang sah; Execution Task List instruksi final masih kosong.

## Target Akhir

Hermes harus dapat melakukan alur berikut setelah reboot/restart:

1. authenticated `whoami` dan catalog;
2. resolve Brand/Product/Preset;
3. POST run-once dan menerima HTTP 202 + Run ID dalam `<2 detik`;
4. satu research dispatch;
5. tepat enam item sampai manual start-frame review;
6. status API menunjukkan `awaiting_manual_review`, bukan state internal yang tertinggal;
7. nol publishing intent, publishing job, dan Repliz call;
8. schedule tetap non-recurring;
9. credential tetap valid sampai rotasi yang disengaja.

## 1. Perbaiki Manajemen Token Hermes agar Stabil

Token tidak boleh dibuat ulang setiap deploy, migration, smoke test, atau restart. Gunakan satu credential service persisten khusus Hermes pada schema Dev.

### Ketentuan credential

- Nama/identity jelas, misalnya `hermes-macmini-dev`.
- Tenant: tenant Dev yang benar.
- Scope minimum run-once: `automation:read`, `automation:write`.
- Jangan menambahkan publishing scope untuk run-once.
- Database hanya menyimpan SHA-256/token hash sesuai mekanisme Operator Auth; raw token hanya berada pada secret store/config Hermes.
- Raw token tidak boleh masuk git, changelog, Markdown, stdout, shell history, PM2 logs, atau handoff.
- Jangan menggunakan credential fixture/test sebagai credential runtime.
- Cleanup integration test tidak boleh dapat menghapus credential runtime.

### Rotasi atomik yang wajib

Jangan mencabut token lama terlebih dahulu. Terapkan urutan:

1. buat credential/token baru;
2. tulis raw token baru secara aman dan atomik ke `MAKNA_OPERATOR_API_TOKEN` pada plist Hermes;
3. reload LaunchAgent Hermes;
4. jalankan authenticated `whoami` dan catalog memakai proses/config baru;
5. hanya jika keduanya HTTP 200, nonaktifkan credential lama;
6. jika verifikasi gagal, rollback plist ke token lama dan jangan mencabut credential lama.

Jika tidak ada script rotasi resmi, buat script admin yang aman dan idempotent. Script harus hanya mencetak credential ID/status dan hasil HTTP, bukan token.

### Code Sebelum (Current/Before)

```text
plist Hermes berisi MAKNA_OPERATOR_API_TOKEN
hash token tersebut tidak ditemukan di operator_credentials schema Dev
whoami/catalog => HTTP 401
```

### Code Sesudah (Proposed/After)

```text
credential hermes-macmini-dev: active, minimum scopes, persistent
plist token hash matches exactly one active Dev credential
whoami/catalog => HTTP 200
restart/reboot verification => tetap HTTP 200
```

### Startup preflight dan observability

Tambahkan preflight ringan pada startup Hermes atau wrapper operasional:

- panggil `/api/operator/v2/whoami` satu kali;
- bila 200, log `MAKNA_OPERATOR_AUTH_READY` tanpa credential/token;
- bila 401/403, log error terstruktur `MAKNA_OPERATOR_AUTH_INVALID` dan jangan menjalankan discovery filesystem/DB;
- jangan membuat campaign ketika auth invalid;
- berikan pesan singkat kepada pengguna bahwa integrasi perlu diperbaiki;
- sediakan health-check command read-only yang dapat dijalankan setelah rotasi/restart.

Jangan membuat loop retry agresif. Backoff harus terbatas dan tidak membanjiri log/API.

## 2. Perbaiki Integration Harness Schema Dev

File utama: `scripts/test-content-run-once-integration.mjs`.

### Code Sebelum (Current/Before)

```js
try {
  Object.assign(process.env, loadStagingEnv());
} catch (_) {
  // Use existing environment if staging env file is absent
}

const pgSchema = process.env.PG_SEARCH_PATH || 'dev';
// direct test pool uses pgSchema
// imported db-pg may still initialize with public
```

### Code Sesudah (Proposed/After)

Gunakan konfigurasi integration yang eksplisit sebelum mengimpor service aplikasi:

```js
const integrationSchema = process.env.RUN_ONCE_TEST_SCHEMA;
if (integrationSchema !== 'dev') {
  throw new Error('RUN_ONCE_TEST_SCHEMA=dev wajib untuk Dev integration test');
}

process.env.PG_SEARCH_PATH = integrationSchema;
process.env.ENABLE_HERMES_RUN_ONCE = 'true';

const directPool = createPool({ searchPath: integrationSchema });
const { enqueueRunOnce } = await import('../lib/content-run-service.js');

assert.equal(await currentSchema(directPool), integrationSchema);
assert.equal(await currentSchema(getPgPool()), integrationSchema);
```

Ketentuan:

- Jangan memakai `loadStagingEnv()` untuk test Dev.
- Jangan menangkap error konfigurasi secara diam-diam.
- Jangan memiliki default password/host/database di integration script baru; ambil dari environment yang sudah dikelola server.
- Fail-fast bila schema bukan `dev`.
- Buktikan direct pool dan application pool memakai schema sama sebelum membuat fixture.
- Pastikan semua migration/background promise selesai atau dinonaktifkan pada test harness.
- `finally` harus membersihkan hanya fixture tenant unik dan menutup seluruh pool.
- Exit `0` hanya bila seluruh assertion benar-benar selesai.

## 3. Lengkapi Integration Assertions yang Sebelumnya Belum Ada

Test integration wajib mencakup:

1. feature flag absent/false/true menggunakan service produksi nyata;
2. Brand/Product query nyata pada schema Dev;
3. tenant custom preset hydration dan incompatibility rejection;
4. same key + same body **secara paralel** menghasilkan satu run;
5. same key + different body secara paralel menghasilkan satu sukses dan satu 409;
6. dua key pada Brand–Product baru menggunakan binding ID aktual yang sama;
7. injected failure membuktikan rollback schedule/run/binding/audit;
8. create endpoint tidak memanggil Hermes/Gemini/G-Labs/Repliz inline;
9. event order: content claim → immutable snapshot → Agent Run schedule → Hermes research dispatch;
10. status tenant isolation/redaction;
11. run-specific zero `agent_publishing_intents`;
12. run/content-specific zero `publishing_jobs`;
13. tidak ada Repliz adapter invocation dengan correlation ID test;
14. non-recurring: execution mode run_once, schedule paused, next_run_at null;
15. pool/migration cleanup tanpa warning async setelah exit.

Jangan menandai coverage lengkap bila hanya menghitung publishing intent sebelum worker berjalan.

## 4. Perbaiki Unit Test Feature Flag

File: `tests/content-run-once.test.js`.

### Code Sebelum (Current/Before)

```js
test('Feature flag fail-closed logic function', () => {
  function checkFeatureFlag(flagVal) {
    if (flagVal !== 'true') throw new ContentRunError(...);
  }
  // menguji salinan logika, bukan production code
});
```

### Code Sesudah (Proposed/After)

Ekstrak helper produksi murni atau uji entry point produksi dengan dependency terisolasi:

```js
export function assertHermesRunOnceEnabled(env = process.env) {
  if (env.ENABLE_HERMES_RUN_ONCE !== 'true') {
    throw new ContentRunError(...);
  }
}
```

Test harus mengimpor helper yang benar-benar dipanggil `enqueueRunOnce`. Jangan menduplikasi implementasi dalam test.

## 5. Sinkronkan Lifecycle Status

Perbaiki kondisi smoke lama dan lifecycle untuk run baru:

- Operator Job `awaiting_approval` + seluruh N item `ready_for_review` harus memproyeksikan status publik `awaiting_manual_review`.
- Content run tidak boleh tertinggal selamanya di `dispatching`.
- Agent Run tidak boleh tertinggal di `producing` bila boundary manual review sudah tercapai.
- Perbarui durable status/reconciliation secara idempotent, bukan hanya tampilan status endpoint.
- `total_item_count` harus menjadi N aktual, bukan tetap 0.
- Jangan menandai run completed sebelum review/production memang selesai; gunakan state manual-review yang eksplisit sesuai kontrak.
- Reconcile harus mencakup run yang sudah terlanjur tertinggal seperti `car_005499dc50b8474b`, tanpa menduplikasi job atau melanjutkan setelah manual review.

Tambahkan test bahwa satu tick reconciliation mengoreksi state dan tick kedua tidak membuat mutation tambahan.

## 6. Perbaiki dan Verifikasi Credential Sekarang

Setelah perubahan token management siap:

1. resolve/create credential runtime Hermes Dev yang persisten;
2. rotasi atomik sesuai prosedur di atas;
3. reload Hermes gateway;
4. verifikasi credential efektif proses, bukan hanya isi plist;
5. authenticated `whoami` = 200;
6. authenticated catalog = 200;
7. authenticated status smoke lama = 200;
8. restart Hermes gateway satu kali;
9. ulangi ketiga request dan pastikan tetap 200;
10. verifikasi scope minimum dan tenant benar tanpa menampilkan token.

## 7. Test Gate Wajib

Jalankan dan laporkan exit code sebenarnya:

```bash
node --test tests/content-run-once.test.js tests/agent-automation.test.js tests/hermes-client.test.js
npm run test:content-run-once:integration
npm run test:content-automation
npm run test:operator-content
npm run test:publishing-scheduler
npm run build
```

Hasil wajib:

- semua exit code 0;
- fail 0;
- unexpected skip 0;
- unhandled rejection 0;
- integration suite berjalan pada schema Dev;
- tidak ada test yang hanya menyalin logika produksi.

## 8. Deploy Hanya Dev

- Ikuti SOP remote build Mac Mini.
- Jangan melakukan polling SSH berulang setiap beberapa detik.
- Deploy hanya dengan `npm run deploy:macmini-dev`.
- Jangan deploy Staging atau Production.
- Setelah deploy, verifikasi versi, PM2 online, restart count stabil, worker boot tepat satu kali, dan environment efektif.
- Pastikan `ENABLE_HERMES_RUN_ONCE=true`, `ENABLE_AGENT_AUTOMATION_WORKER=true`, `ENABLE_AGENT_AUTO_PUBLISH=false` tetap persisten setelah reload.

## 9. Smoke Ulang End-to-End dari Jalur Hermes

Smoke lama boleh digunakan untuk menguji reconciliation, tetapi bukti operasional final harus memakai **satu Run ID baru** yang dibuat melalui jalur autentikasi yang sama dengan Hermes.

Payload bisnis:

- Brand: `dapurbotani`, resolve ID dari catalog.
- Product: `Rolled Oat Premium Sahabat`, resolve ID dari catalog.
- Preset: `dapurbotani_kampanye_produk_4_klip`.
- Video count: 6.
- Research aktif.
- Review: start frames/manual review.
- Publishing: `draft_only`.
- Platform context: TikTok tanpa target posting.

Ketentuan:

1. ukur HTTP POST dari sisi pemanggil Hermes dengan monotonic timer;
2. simpan latency dan HTTP status tanpa token;
3. wajib HTTP 202 dan `<2 detik`;
4. ulangi body + idempotency key sama dan buktikan Run ID sama;
5. monitor bounded status endpoint, bukan filesystem/DB discovery oleh Hermes;
6. tunggu tepat enam item `ready_for_review`;
7. jangan approve start frame;
8. pastikan status API `awaiting_manual_review`;
9. buktikan research dispatch tepat satu;
10. buktikan total item count 6;
11. buktikan zero publishing intent/job/Repliz correlation;
12. buktikan schedule paused, next_run_at null;
13. jangan posting ke platform apa pun.

## 10. Checklist dan Evidence Discipline

Buka kembali semua item yang belum terbukti pada:

- `plans/hermes-integration/run-once-implementation-plan.md`
- `plans/hermes-integration/antigravity-run-once-final-remediation-instructions.md`

Tambahkan seksi `## Execution Task List` pada implementation plan bila berubah, dan perbarui checkbox secara real-time. Jangan mencentang berdasarkan klaim atau changelog.

Simpan handoff evidence non-secret pada file baru:

`plans/hermes-integration/run-once-operational-closure-report.md`

Report wajib memuat:

- release/commit/tag;
- file dan akar masalah tiap fix;
- semua test command + exit code + pass/fail/skip;
- schema integration yang benar;
- credential ID, tenant, scopes, status, dan hash-match boolean tanpa token/hash;
- whoami/catalog/status HTTP sebelum dan sesudah restart;
- PM2/worker state;
- Run ID/Agent Run ID/Research Task ID/Operator Job ID smoke baru;
- POST latency dan replay result;
- event ordering;
- jumlah item dan status;
- publishing intent/job/Repliz correlation count;
- schedule execution mode/status/next_run_at;
- konfirmasi Staging/Production tidak disentuh;
- residual blockers.

## Execution Task List

- [ ] Buka kembali checklist yang tidak didukung bukti.
- [ ] Perbaiki integration harness agar application pool dan fixture sama-sama memakai schema Dev.
- [ ] Hilangkan silent fallback dan default credential database dari integration script.
- [ ] Lengkapi concurrency, rollback, event-order, publishing job, dan Repliz assertions.
- [ ] Ubah unit test feature flag agar menguji helper produksi nyata.
- [ ] Perbaiki durable lifecycle reconciliation dan total item count.
- [ ] Reconcile smoke lama tanpa melanjutkan melewati manual review.
- [ ] Implementasikan credential Hermes persisten dan prosedur rotasi atomik.
- [ ] Tambahkan startup auth preflight dan health-check aman.
- [ ] Rotasi/perbaiki token Hermes Dev dan buktikan whoami/catalog/status HTTP 200.
- [ ] Restart Hermes dan buktikan credential tetap valid.
- [ ] Jalankan seluruh unit, integration, regression test, dan build dengan exit 0.
- [ ] Deploy hanya ke Mac Mini Dev.
- [ ] Verifikasi flag, worker, PM2, Hermes API, dan callback setelah deploy.
- [ ] Jalankan satu smoke baru melalui jalur autentikasi Hermes.
- [ ] Buktikan HTTP 202 <2 detik dan idempotency replay.
- [ ] Buktikan satu research dispatch, enam item, dan awaiting manual review.
- [ ] Buktikan zero publishing intent/job/Repliz dan non-recurring schedule.
- [ ] Buat patch release, push commit/tag, dan verifikasi Dev memakai release tersebut.
- [ ] Tulis operational closure report lengkap tanpa secret.
- [ ] Konfirmasi Staging dan Production tidak disentuh.

## Definition of Done

Tugas hanya selesai jika semua kondisi berikut benar secara bersamaan:

- token plist cocok dengan tepat satu active credential Dev;
- credential bertahan setelah restart Hermes;
- whoami, catalog, dan status endpoint HTTP 200;
- integration test schema Dev benar-benar lulus;
- seluruh test/build exit 0 tanpa unexpected skip;
- lifecycle durable mencapai manual-review state yang konsisten;
- smoke baru HTTP 202 dalam `<2 detik`;
- replay tidak menduplikasi run/research/campaign;
- tepat enam item siap manual review;
- tidak ada approval otomatis;
- publishing intent/job/Repliz count untuk smoke adalah 0;
- schedule non-recurring;
- auto-publish tetap false;
- Dev memakai release final dan proses stabil;
- Staging/Production tidak disentuh;
- evidence report tersedia dan sesuai data nyata.

Jika salah satu gagal, jangan menyatakan selesai dan jangan meminta pengguna mencoba Hermes. Perbaiki akar masalah, ulangi test serta verifikasi yang relevan sampai semua Definition of Done terpenuhi.
