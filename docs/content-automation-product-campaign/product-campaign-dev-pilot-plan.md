# Implementation Plan — Product Campaign Dev Pilot (6 Items)

## 1. Tujuan

Memvalidasi Product Campaign secara end-to-end pada Mac Mini Dev menggunakan satu produk nyata dan enam item, setelah seluruh hardening pipeline lulus.

Pilot membuktikan:

1. Content Planner menghasilkan enam item sesuai product snapshot;
2. OPC menghasilkan creative/storyboard dan seluruh start frame;
3. review revision stabil;
4. approval per item dan bulk approval bekerja;
5. TTS, video, FFmpeg, upload, dan ContentFlow berjalan idempotent;
6. retry ContentFlow dapat dilakukan tanpa menduplikasi item;
7. evidence dan biaya provider tercatat;
8. hasil pilot cukup untuk keputusan merge branch ke `main` tanpa otomatis deploy Production.

## 2. Prasyarat wajib

- hardening plan selesai 100%;
- feature flag `enabled=true` dan `pilot_enabled=true` hanya pada tenant Dev;
- PM2 Dev sehat pada UI 5020/API 7020;
- schema `dev`, `PGPOOL_MAX=3`;
- Windows worker/G-Labs sehat;
- storage dan ContentFlow endpoint sehat;
- produk pilot dipilih eksplisit;
- product snapshot lengkap: nama, deskripsi, USP, foto, URL, Target Audience;
- estimasi biaya dan batas maksimum disetujui sebelum provider call;
- tidak ada deploy Staging/Production.

## 3. Safety gate biaya

Pilot runner memiliki tiga mode:

- `inspect`: read-only preflight;
- `dry-run`: membuat rencana dan payload tanpa provider call;
- `execute`: memanggil provider nyata.

`execute` harus mensyaratkan seluruh parameter:

```bash
--confirm-dev-only
--confirm-provider-cost
--max-items 6
--schedule-id <id>
--product-id <id>
```

Tanpa salah satu parameter, runner berhenti sebelum mutation/provider call.

## 4. Strategi approval pilot

Enam item dibagi:

- Item 1–2: approval per item melalui OPC;
- Item 3: hold lalu resume lalu approve;
- Item 4: reject, regenerasi revision, lalu approve revision baru;
- Item 5–6: bulk approval dari Content Automations.

Dengan pembagian ini satu pilot memvalidasi seluruh state machine tanpa membuat campaign tambahan.

## 5. Strategi ContentFlow retry

Jangan sengaja merusak endpoint production-like. Gunakan failure injection Dev yang scoped ke satu item dan satu attempt:

```text
content_automation_dev_fail_once_stage=contentflow
content_automation_dev_fail_once_item=<item-id>
```

Injection hanya tersedia bila:

- `NODE_ENV !== production` atau schema `dev`;
- pilot flag aktif;
- item ID cocok;
- otomatis terhapus setelah satu failure.

## 6. Evidence yang wajib dikumpulkan

Per item:

- planner row ID;
- OPC item ID;
- product snapshot SHA-256;
- review revision/hash;
- start-frame count/checksum;
- approval action/actor/time;
- TTS execution ID;
- video provider task ID;
- FFmpeg execution ID/checksum;
- ContentFlow item ID/idempotency result;
- durations dan retry count;
- provider usage/cost bila tersedia.

Evidence tidak boleh berisi API key, password, token, cookies, atau authorization header.

## 7. Perubahan per file

### 7.1 `scripts/product-campaign-dev-pilot.mjs` — file baru

Tujuan: orchestrator pilot dengan inspect/dry-run/execute gates dan resumability.

#### Code Sebelum (Current/Before)

```js
// Belum ada pilot runner khusus Product Campaign.
```

#### Code Sesudah (Proposed/After)

```js
const options = parsePilotArgs(process.argv.slice(2));
assertDevEnvironment(options);
assertCostConfirmation(options);

const preflight = await inspectPilotDependencies(options);
if (options.mode !== 'execute') return printPilotPlan(preflight);

const state = await loadOrCreatePilotState(options);
await executePilotStateMachine(state, { maxItems: 6 });
await writePilotEvidence(state);
```

Runner tidak menyimpan credential ke evidence dan dapat dilanjutkan berdasarkan `pilot_run_id`.

### 7.2 `lib/product-campaign-pilot-service.js` — file baru

Tujuan: preflight, polling bounded, evidence collection, dan assertion; tidak menggandakan business logic route.

#### Code Sebelum (Current/Before)

```js
// Pilot manual bergantung pada klik dan inspeksi ad-hoc.
```

#### Code Sesudah (Proposed/After)

```js
export async function inspectPilotDependencies(input) { /* read-only */ }
export async function waitForRunStage(runId, expected, timeout) { /* bounded polling */ }
export async function collectPilotEvidence(runId) { /* redacted structured data */ }
export async function assertSixItemOutcome(evidence) { /* acceptance checks */ }
```

### 7.3 `lib/content-automation-dev-failure-injection.js` — file baru

Tujuan: fail-once Dev untuk ContentFlow retry test.

#### Code Sebelum (Current/Before)

```js
// Retry hanya dapat diuji bila provider kebetulan gagal.
```

#### Code Sesudah (Proposed/After)

```js
export async function consumeDevFailureInjection({ tenantId, itemId, stage }) {
  assertDevSchema();
  const injection = await claimMatchingInjection({ tenantId, itemId, stage });
  return Boolean(injection);
}
```

### 7.4 `lib/content-automation-contentflow.js`

Tujuan: hook fail-once sebelum side effect ContentFlow, hanya pada schema Dev.

#### Code Sebelum (Current/Before)

```js
const result = await scanAndSyncExistingCampaigns(campaign.id);
```

#### Code Sesudah (Proposed/After)

```js
if (await consumeDevFailureInjection({ tenantId, itemId: item.id, stage: 'contentflow' })) {
  throw new RetryableContentFlowError('DEV_FAIL_ONCE');
}
const result = await scanAndSyncExistingCampaigns(campaign.id);
```

### 7.5 `app/api/v2/content-automations/dev-pilot/route.js` — file baru

Tujuan: admin-only inspect/status/failure injection, Dev-only.

#### Code Sebelum (Current/Before)

```js
// Belum ada API pilot Dev.
```

#### Code Sesudah (Proposed/After)

```js
export const GET = withTenantContext(async (request, _context, user) => {
  requireAdminAndDev(user);
  return NextResponse.json(await inspectPilotDependencies(parseQuery(request)));
});

export const POST = withTenantContext(async (request, _context, user) => {
  requireAdminAndDev(user);
  return NextResponse.json(await configureOneShotFailure(await request.json()));
});
```

### 7.6 `scripts/test-product-campaign-dev-pilot.mjs` — file baru

Tujuan: memastikan safety gate dan evidence redaction tanpa provider call.

#### Code Sebelum (Current/Before)

```js
// Belum ada test pilot harness.
```

#### Code Sesudah (Proposed/After)

```js
await testRejectsNonDevSchema();
await testRejectsMissingCostConfirmation();
await testCapsItemsAtSix();
await testDryRunHasNoMutation();
await testEvidenceRedaction();
await testResumeFromPilotState();
```

### 7.7 `package.json`

#### Code Sebelum (Current/Before)

```json
"test:product-campaign:hardening-integration": "node scripts/test-product-campaign-hardening-integration.mjs"
```

#### Code Sesudah (Proposed/After)

```json
"pilot:product-campaign:inspect": "node scripts/product-campaign-dev-pilot.mjs --mode inspect",
"pilot:product-campaign:dry-run": "node scripts/product-campaign-dev-pilot.mjs --mode dry-run",
"pilot:product-campaign:execute": "node scripts/product-campaign-dev-pilot.mjs --mode execute",
"test:product-campaign:pilot": "node scripts/test-product-campaign-dev-pilot.mjs"
```

### 7.8 `docs/content-automation-product-campaign/pilot-evidence-template.md` — file baru

Tujuan: format evidence konsisten.

#### Code Sebelum (Current/Before)

```md
Belum ada template evidence pilot.
```

#### Code Sesudah (Proposed/After)

```md
# Product Campaign Dev Pilot Evidence
## Environment and Feature Flags
## Product Snapshot
## Six Item Matrix
## Approval Actions
## TTS / Video / FFmpeg
## ContentFlow Sync and Retry
## Provider Usage and Cost
## Defects and Decision
```

### 7.9 `docs/content-automation-product-campaign/pilot-runs/<pilot-id>.md` — generated artifact

Tujuan: laporan aktual pilot, tanpa secret.

#### Code Sebelum (Current/Before)

```md
Belum ada hasil pilot.
```

#### Code Sesudah (Proposed/After)

```md
Status: PASS | CONDITIONAL PASS | FAIL
Pilot Run ID: ...
Schedule ID: ...
Product ID: ...
Items: 6/6
Outstanding defects: ...
Recommendation: merge | fix-and-repeat | stop
```

### 7.10 `docs/content-automation-product-campaign/implementation_plan.md`

Tujuan: menutup checklist utama berdasarkan evidence, bukan asumsi.

#### Code Sebelum (Current/Before)

```md
- [ ] Jalankan product pilot 6 item di Server Dev Mac Mini.
- [ ] Verifikasi approval per item OPC.
- [ ] Verifikasi bulk approval Content Automations.
- [ ] Verifikasi TTS → video → FFmpeg.
- [ ] Verifikasi automatic ContentFlow sync dan retry.
```

#### Code Sesudah (Proposed/After)

```md
- [x] Jalankan product pilot 6 item di Server Dev Mac Mini. *(Evidence: pilot-runs/<id>.md)*
- [x] Verifikasi approval per item OPC.
- [x] Verifikasi bulk approval Content Automations.
- [x] Verifikasi TTS → video → FFmpeg.
- [x] Verifikasi automatic ContentFlow sync dan retry.
```

Checklist hanya ditandai `[x]` jika evidence menyatakan PASS untuk tahap terkait.

## 8. Tahapan pilot

### Tahap 0 — Inspect

- verifikasi Dev environment;
- cek feature flags;
- cek provider/worker/storage/ContentFlow;
- inventaris kandidat produk lengkap;
- tidak ada mutation.

### Tahap 1 — Dry-run

- bentuk payload schedule enam item;
- validasi preset, audience, approval mode, product snapshot;
- estimasi jumlah provider calls;
- tetapkan batas biaya;
- tidak ada provider call.

### Tahap 2 — Create paused schedule

- buat atau pilih schedule pilot paused;
- simpan `pilot_run_id` dan snapshot awal;
- verifikasi idempotency keys;
- schedule tidak diaktifkan berkala.

### Tahap 3 — Generate sampai review

- `run-now` satu kali;
- planner enam item;
- OPC creative;
- start frames;
- tunggu status `awaiting_approval` dengan timeout bounded;
- kumpulkan checksum/revision.

### Tahap 4 — Approval matrix

- approve Item 1–2 per item;
- hold/resume/approve Item 3;
- reject/regenerate/approve Item 4;
- bulk approve Item 5–6;
- verifikasi tidak ada duplicate production execution.

### Tahap 5 — Production

- tunggu TTS enam item;
- tunggu video provider;
- tunggu FFmpeg/upload;
- validasi output playable dan checksum;
- tidak social post.

### Tahap 6 — ContentFlow

- lima item sync normal;
- satu item mengalami Dev fail-once;
- jalankan retry ContentFlow;
- verifikasi tepat enam ContentFlow item tanpa duplicate.

### Tahap 7 — Evidence dan cleanup

- archive schedule pilot setelah selesai;
- matikan pilot flag;
- hapus failure injection yang tersisa;
- jangan menghapus output/evidence sebelum keputusan;
- catat biaya dan defect.

## 9. Acceptance criteria

### PASS

- enam planner/OPC items;
- seluruh start frame sesuai expected count;
- stale/rejected revision tidak diproduksi;
- semua approval action sesuai matrix;
- tepat satu successful execution per item/stage/revision;
- enam output FFmpeg valid;
- enam ContentFlow items unik;
- fail-once ContentFlow pulih melalui retry;
- tidak ada secret pada log/evidence;
- tidak ada deploy atau mutation Staging/Production.

### CONDITIONAL PASS

- provider eksternal gagal terminal tetapi retry/recovery aplikasi terbukti benar;
- defect minor UI tidak memengaruhi integritas pipeline;
- wajib ada issue dan keputusan repeat parsial.

### FAIL

- duplicate charge/task/output;
- approval gate terlewati;
- cross-tenant leakage;
- output ContentFlow duplicate;
- revision stale diproduksi;
- mutation ke Staging/Production;
- biaya melewati cap tanpa stop.

## 10. Keputusan Git setelah pilot

Pilot PASS tidak otomatis memberi izin deploy Production.

Urutan keputusan:

1. verifikasi branch dan tag rilis pilot;
2. review evidence dan defect;
3. bila disetujui, merge/push branch kerja ke `main`;
4. tetap **tidak deploy Production** tanpa perintah eksplisit terpisah.

## 11. Execution Task List

### A. Persiapan harness

- [ ] Pastikan hardening plan selesai dan deployed ke Dev.
- [ ] Implementasikan inspect/dry-run/execute runner.
- [ ] Implementasikan preflight/evidence service.
- [ ] Implementasikan Dev fail-once injection.
- [ ] Implementasikan admin-only Dev pilot endpoint.
- [ ] Tambahkan safety/redaction/resume tests.
- [ ] Tambahkan package scripts dan evidence template.

### B. Preflight read-only

- [ ] Verifikasi host/folder/port/schema/pool Dev.
- [ ] Verifikasi PM2 UI/API dan worker dependencies.
- [ ] Verifikasi feature flags Dev.
- [ ] Verifikasi provider, storage, dan ContentFlow health.
- [ ] Pilih kandidat produk lengkap.
- [ ] Hitung estimasi provider calls dan cost cap.

### C. Persetujuan sebelum biaya

- [ ] Presentasikan produk, preset, call estimate, dan cost cap kepada pengguna.
- [ ] Dapatkan konfirmasi eksplisit untuk provider cost.
- [ ] Pastikan `--confirm-dev-only` dan `--confirm-provider-cost` tersedia.
- [ ] Jangan lanjut execute tanpa konfirmasi.

### D. Dry-run

- [ ] Jalankan dry-run enam item tanpa mutation/provider call.
- [ ] Validasi payload planner/OPC/product snapshot.
- [ ] Validasi approval matrix dan timeout.
- [ ] Simpan dry-run evidence.

### E. Execute tahap 1

- [ ] Buat/pilih schedule pilot paused.
- [ ] Jalankan `run-now` tepat satu kali.
- [ ] Verifikasi enam planner/OPC items.
- [ ] Tunggu creative dan start frames sampai review.
- [ ] Verifikasi checksum, count, dan review revision.

### F. Approval matrix

- [ ] Approve Item 1–2 per item OPC.
- [ ] Hold/resume/approve Item 3.
- [ ] Reject/regenerate/approve Item 4.
- [ ] Bulk approve Item 5–6 dari Content Automations.
- [ ] Verifikasi stage execution tidak duplicate.

### G. Production dan ContentFlow

- [ ] Verifikasi TTS enam item.
- [ ] Verifikasi video enam item.
- [ ] Verifikasi FFmpeg/upload enam item.
- [ ] Verifikasi lima ContentFlow sync normal.
- [ ] Inject fail-once ContentFlow untuk satu item Dev.
- [ ] Jalankan retry dan verifikasi tepat enam ContentFlow items unik.

### H. Evidence dan cleanup

- [ ] Generate redacted pilot evidence report.
- [ ] Catat provider usage/cost dan durations.
- [ ] Archive schedule pilot.
- [ ] Matikan pilot flag.
- [ ] Bersihkan failure injection tersisa.
- [ ] Perbarui checklist utama hanya untuk evidence yang PASS.
- [ ] Konfirmasi tidak ada deploy/mutation Staging atau Production.

### I. Release dan keputusan main

- [ ] Jalankan tests dan production build final.
- [ ] Deploy final hanya ke Mac Mini Dev bila ada fix pilot.
- [ ] Jalankan release patch dan push branch kerja.
- [ ] Review PASS/CONDITIONAL PASS/FAIL bersama pengguna.
- [ ] Merge/push ke `main` hanya setelah keputusan eksplisit.
- [ ] Jangan deploy Production tanpa perintah manual eksplisit.

