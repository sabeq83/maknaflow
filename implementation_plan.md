# Implementation Plan — MAKNA Native Content Automation Scheduler

## 1. Sasaran

Membuat scheduler native di MAKNA Flow yang dapat berjalan 24/7 pada server Windows tanpa bergantung pada Codex untuk mengeksekusi jadwal.

Alur target:

```text
Schedule jatuh tempo
→ MAKNA membuat Operator Content Job secara idempotent
→ Content Planner → OPC Storyboard
→ job berhenti di awaiting_approval
→ review.md + revision/checksum tersedia
→ notifikasi dashboard
→ pengguna approve melalui UI MAKNA atau Codex
→ TTS → G-Labs → FFmpeg → upload final
```

Implementasi dibagi menjadi tiga fase. Setiap fase dirilis dan diuji sebelum fase berikutnya dimulai.

## 2. Keputusan Arsitektur

### 2.1 Scheduler database-backed

- PostgreSQL menjadi sumber kebenaran schedule dan run.
- Timer proses hanya membangunkan worker; state tidak bergantung pada memory.
- Worker mengklaim schedule dengan `FOR UPDATE SKIP LOCKED`.
- Slot eksekusi mempunyai unique key `(tenant_id, schedule_id, scheduled_for)`.
- Restart server, retry, atau dua node aktif tidak menghasilkan job ganda.

### 2.2 Memakai Operator workflow yang sudah ada

Scheduler tidak membuat planner/campaign secara langsung. Ia memanggil service internal yang sama dengan `/api/operator/v1/content-jobs`, sehingga tetap memakai:

- kontrak OPC v2;
- preset `nutribake_editorial_v1`;
- tenant isolation;
- idempotency;
- pause `awaiting_approval`;
- review Markdown serta approval revision/checksum.

### 2.3 Approval dan social publishing

- Fase 1 selalu memakai `approval_mode=storyboard`.
- `enable_social_post` wajib `false`.
- Worker schedule hanya bertugas sampai job terdaftar; lifecycle berikutnya ditangani Operator worker dan Campaign Scheduler.
- Approval otomatis tidak disediakan pada pilot.

### 2.4 Waktu dan missed run

- Schedule menyimpan timezone IANA, misalnya `Asia/Jakarta`.
- Database menyimpan `next_run_at` dan `scheduled_for` dalam UTC.
- Perhitungan kalender dilakukan dari timezone schedule agar DST-safe.
- Fase 1 memakai kebijakan `skip`: slot yang terlewat jauh saat server mati tidak di-backfill massal; hanya slot terbaru dalam grace window yang boleh dijalankan.

## 3. Pembagian Fase

## Fase 1 — Pilot Scheduler, Review, dan Dashboard

### Scope

1. Schedule harian, mingguan, dan bulanan.
2. Satu schedule menghasilkan satu Operator content job.
3. Preset OPC + pilar + planner count + instruksi khusus.
4. Wajib pause pada storyboard.
5. Review Markdown dari Operator API.
6. Riwayat run dan notifikasi dashboard.
7. Create, edit, enable/disable, run-now, dan retry manual.
8. Pilot satu schedule Nutribake.

### Di luar scope

- Email, WhatsApp, Telegram, atau Slack.
- Auto-approval.
- Social publishing.
- Holiday calendar.
- Advanced budgeting dan analytics.

### Model data

```sql
content_automation_schedules
  id, tenant_id, name, status
  timezone, frequency, schedule_config_json
  operator_request_json
  missed_run_policy, grace_minutes
  next_run_at, last_run_at
  created_by, created_at, updated_at

content_automation_runs
  id, tenant_id, schedule_id
  scheduled_for, idempotency_key
  operator_job_id, status
  attempt_count, error_code, error_message
  started_at, completed_at, created_at

content_automation_notifications
  id, tenant_id, run_id, type, title, message
  action_url, read_at, created_at
```

### Status schedule/run

```text
schedule: active | paused | archived
run: queued | dispatching | job_created | awaiting_approval | producing | completed | failed | skipped
```

### Kriteria penerimaan Fase 1

- Windows restart tidak menggandakan run.
- Dua worker tidak dapat mengklaim slot yang sama.
- Schedule Nutribake membuat tujuh planner rows dan berhenti sebelum TTS.
- Dashboard menampilkan badge `awaiting_approval` dan link review.
- `Run Now` memakai idempotency key khusus dan tidak mengubah jadwal berikutnya.
- Retry manual menggunakan run yang sama atau attempt baru yang terhubung, bukan campaign duplikat.
- Social posting tetap nonaktif.

## Fase 2 — Notifikasi Eksternal dan Operasional

### Scope

1. Notification outbox database-backed.
2. Provider pertama: email atau Telegram; dipilih saat fase dimulai.
3. Retry exponential backoff dan dead-letter status.
4. Quiet hours dan notification preference per schedule.
5. Missed-run policy: `skip`, `run_latest`, atau bounded catch-up.
6. Calendar view, run health, filter tenant/brand/status.
7. Pause otomatis bila kegagalan berturut-turut melewati batas.

### Kriteria penerimaan Fase 2

- Kegagalan provider notifikasi tidak menggagalkan content job.
- Notifikasi yang sama tidak terkirim dua kali.
- Pesan hanya berisi ringkasan, revision, dan tautan; bukan storyboard penuh.
- Credential provider tersimpan sebagai tenant setting terenkripsi/secret, bukan dalam schedule JSON.

## Fase 3 — Multi-node, Governance, dan Optimasi

### Scope

1. Worker lease/heartbeat multi-node.
2. Concurrency dan rate limit per tenant.
3. Budget/quota guard untuk Gemini, TTS, dan G-Labs.
4. Blackout date dan holiday calendar.
5. Approval bertingkat.
6. Analytics performa pilar dan rekomendasi jadwal.
7. Round-robin/weighted pillar selection.
8. Audit dan retention policy.

### Kriteria penerimaan Fase 3

- Node failover tidak menggandakan run.
- Tenant yang mencapai quota berhenti sebelum memanggil provider berbayar.
- Approval dan perubahan schedule memiliki audit trail lengkap.
- Rekomendasi tidak mengubah schedule tanpa persetujuan pengguna.

## 4. Rencana Perubahan File — Fase 1

### 4.1 `lib/db-pg.js`

**Code Sebelum (Current/Before)**

```js
// Hanya operator_jobs/operator_job_events.
// Belum ada tabel content automation schedule, run, dan notification.
```

**Code Sesudah (Proposed/After)**

```js
await migrateContentAutomations(pool); // idempotent + advisory lock
```

Migrasi membuat tiga tabel, index due schedule, unique run slot, foreign key, dan check constraint status.

### 4.2 `lib/content-automation-contract.js` — baru

**Code Sebelum (Current/Before)**

```js
// Belum ada validasi schedule native.
```

**Code Sesudah (Proposed/After)**

```js
export function normalizeContentAutomation(input) {
  return {
    name: requireName(input.name),
    timezone: validateIanaTimezone(input.timezone),
    schedule: normalizeCalendarSchedule(input.schedule),
    operator_request: normalizeOperatorContentRequest(input.operator_request),
    missed_run_policy: 'skip',
    grace_minutes: normalizeGrace(input.grace_minutes)
  };
}
```

Validator memaksa `approval_mode=storyboard` dan `enable_social_post=false` pada pilot.

### 4.3 `lib/content-automation-schedule.js` — baru

**Code Sebelum (Current/Before)**

```js
// Belum ada kalkulasi jadwal timezone-aware.
```

**Code Sesudah (Proposed/After)**

```js
export function calculateNextRun({ frequency, config, timezone, after }) {
  // daily | weekly | monthly → UTC timestamp
}
```

Gunakan library/runtime timezone yang sudah tersedia; tambahkan dependency hanya jika native `Intl` tidak cukup dan setelah evaluasi.

### 4.4 `lib/content-automation-repository.js` — baru

**Code Sebelum (Current/Before)**

```js
// Query schedule belum tersedia.
```

**Code Sesudah (Proposed/After)**

```js
export async function claimDueAutomation(workerId, now) {
  return withPgTransaction(client => client.query(`
    SELECT * FROM content_automation_schedules
    WHERE status = 'active' AND next_run_at <= $1
    FOR UPDATE SKIP LOCKED LIMIT 1
  `, [now]));
}
```

Repository juga menyediakan CRUD, run history, retry, notification, dan tenant-scoped query.

### 4.5 `lib/operator-job-service.js` — baru/refactor

**Code Sebelum (Current/Before)**

```js
// Route Operator menangani normalize, hash, dan create job secara langsung.
```

**Code Sesudah (Proposed/After)**

```js
export async function createOperatorJobFromRequest({ request, idempotencyKey, actor }) {
  const payload = normalizeOperatorContentRequest(request);
  const requestHash = hashOperatorRequest(payload);
  return createOperatorJob({ idempotencyKey, requestHash, requestJson: JSON.stringify(payload) });
}
```

API Operator dan automation worker memakai service yang sama.

### 4.6 `lib/content-automation-worker.js` — baru

**Code Sebelum (Current/Before)**

```js
// Belum ada due-schedule worker.
```

### 4.11 `lib/content-planner-engine.js`

**Code Sebelum (Current/Before)**

```js
const skeletons = Array.isArray(skeletonResult) ? skeletonResult : skeletonResult.rows;
const finalRows = Array.isArray(creativeResult) ? creativeResult : creativeResult.rows;
```

Jumlah baris sepenuhnya mengikuti respons AI sehingga dapat kurang dari `planner_count`.

**Code Sesudah (Proposed/After)**

```js
const skeletons = normalizeGeneratedPlannerRows(skeletonResult, distributionPlan, count);
const finalRows = normalizeGeneratedPlannerRows(creativeResult, skeletons, count);
```

Engine menambah fallback deterministik dari distribution plan bila Gemini mengembalikan baris kurang, dan memangkas bila respons berlebih. Dengan demikian pilot tujuh pilar selalu menghasilkan tepat tujuh planner rows.

**Code Sesudah (Proposed/After)**

```js
export async function runContentAutomationTick() {
  const schedule = await claimDueAutomation(workerId, new Date());
  if (!schedule) return;
  const run = await createRunForSlot(schedule);
  const job = await tenantContext.run(schedule.tenant_id, () =>
    createOperatorJobFromRequest({
      request: schedule.operator_request_json,
      idempotencyKey: run.idempotency_key,
      actor: `automation:${schedule.id}`
    })
  );
  await linkRunToOperatorJob(run.id, job.id);
}
```

Tick pendek, tidak menunggu storyboard selesai. Reconciler terpisah menyinkronkan status run dengan Operator job dan membuat dashboard notification.

### 4.7 `instrumentation.js`

**Code Sebelum (Current/Before)**

```js
if (backgroundServicesEnabled && process.env.ENABLE_OPERATOR_WORKER !== 'false') {
  startOperatorContentWorker();
}
```

**Code Sesudah (Proposed/After)**

```js
if (backgroundServicesEnabled && process.env.ENABLE_CONTENT_AUTOMATION_WORKER !== 'false') {
  startContentAutomationWorker();
}
```

Worker dapat dinonaktifkan per node. Node Windows utama mengaktifkannya; node UI tambahan dapat mematikannya.

### 4.8 `app/api/operator/v1/content-jobs/route.js`

**Code Sebelum (Current/Before)**

```js
const payload = normalizeOperatorContentRequest(await request.json());
const requestHash = hashOperatorRequest(payload);
const job = await createOperatorJob(...);
```

**Code Sesudah (Proposed/After)**

```js
const job = await createOperatorJobFromRequest({
  request: await request.json(),
  idempotencyKey,
  actor: identity.actor
});
```

### 4.9 `app/api/v2/content-automations/route.js` — baru

**Code Sebelum (Current/Before)**

```js
// Belum ada CRUD API automation.
```

**Code Sesudah (Proposed/After)**

```js
export async function GET() { /* list tenant schedules */ }
export async function POST(request) { /* validate + create */ }
```

### 4.10 `app/api/v2/content-automations/[id]/route.js` — baru

**Code Sebelum (Current/Before)**

```js
// Belum ada detail/update/archive schedule.
```

**Code Sesudah (Proposed/After)**

```js
export async function GET() {}
export async function PATCH() {}
export async function DELETE() {} // soft archive
```

### 4.11 Action API — baru

File:

- `app/api/v2/content-automations/[id]/run-now/route.js`
- `app/api/v2/content-automations/[id]/toggle/route.js`
- `app/api/v2/content-automations/runs/[runId]/retry/route.js`
- `app/api/v2/content-automations/notifications/route.js`

**Code Sebelum (Current/Before)**

```js
// Belum ada action endpoint.
```

**Code Sesudah (Proposed/After)**

```js
await requireTenantPermission(request, 'content_automation');
return performIdempotentAction(...);
```

### 4.12 `app/content-automations/page.js` — baru

**Code Sebelum (Current/Before)**

```jsx
// Belum ada UI automation.
```

**Code Sesudah (Proposed/After)**

```jsx
<AutomationList />
<AutomationEditor />
<RunHistory />
<AwaitingApprovalBadge />
```

Editor Fase 1 berisi:

- nama dan status;
- brand/preset;
- timezone;
- daily/weekly/monthly schedule;
- pilar dan jumlah planner;
- instruksi khusus;
- konfigurasi workflow read-only: approval storyboard, social post off;
- review konfigurasi efektif sebelum simpan.

### 4.13 `app/components/Sidebar.js`

**Code Sebelum (Current/Before)**

```js
const navItems = [
  { label: 'Content Planner', href: '/content-planner' }
];
```

**Code Sesudah (Proposed/After)**

```js
{ label: 'Content Automations', href: '/content-automations', icon: '⏱️' }
```

Tambahkan permission key `content_automation`; admin mendapat akses sesuai kebijakan tenant.

### 4.14 `.env.example` dan `.env.staging.local.example`

**Code Sebelum (Current/Before)**

```env
# Belum ada gate worker automation.
```

**Code Sesudah (Proposed/After)**

```env
ENABLE_CONTENT_AUTOMATION_WORKER=true
CONTENT_AUTOMATION_INTERVAL_MS=15000
CONTENT_AUTOMATION_LEASE_MS=60000
```

## 5. Verifikasi Fase 1

### Unit test

- validasi timezone dan kalender daily/weekly/monthly;
- next-run melewati pergantian bulan/tahun;
- invalid day-of-month policy;
- contract memaksa approval dan social off;
- idempotency key stabil untuk slot sama;
- slot berbeda menghasilkan key berbeda.

### Integration test PostgreSQL

- create/update/pause/archive tenant-scoped;
- dua claim paralel hanya menghasilkan satu run;
- retry tidak membuat campaign ganda;
- restart simulation mengambil schedule due yang belum selesai;
- cross-tenant access ditolak.

### Staging pilot

1. Buat schedule Nutribake weekly.
2. Gunakan `nutribake_editorial_v1`, tujuh pilar, `wardrobe=sequential`.
3. Jalankan `Run Now`.
4. Pastikan Operator job mencapai `awaiting_approval`.
5. Pastikan TTS/G-Labs/FFmpeg belum berjalan.
6. Unduh review Markdown dan cocokkan revision/checksum.
7. Approve satu pilot setelah persetujuan eksplisit pengguna.
8. Pastikan produksi dan upload final selesai.

## 6. Deployment Windows 24/7

- Jalankan MAKNA sebagai Windows Service menggunakan service wrapper yang dipilih saat deployment.
- Jalankan satu node dengan `ENABLE_CONTENT_AUTOMATION_WORKER=true` pada Fase 1.
- Gunakan PostgreSQL server, bukan database lokal file.
- Service memakai auto-restart dan delayed start setelah network siap.
- Health endpoint melaporkan:
  - worker enabled/running;
  - last tick;
  - last claimed schedule;
  - due schedule count;
  - stale run count;
  - last error.
- Codex tidak perlu terpasang pada PC Windows.

## 7. Rollout dan Rollback

### Rollout

1. Rilis Fase 1 dengan worker default off pada production.
2. Jalankan migrasi dan test CRUD.
3. Aktifkan worker hanya pada staging.
4. Jalankan pilot Nutribake.
5. Aktifkan pada Windows production untuk satu schedule.
6. Observasi minimal dua siklus sebelum menambah schedule.

### Rollback

- Set `ENABLE_CONTENT_AUTOMATION_WORKER=false` dan restart service.
- Schedule/run tetap tersimpan; tidak dihapus.
- Operator job yang sudah dibuat tetap dapat direview/diteruskan.
- Tidak ada rollback schema destruktif pada Fase 1.

## 8. Execution Task List

### Fase 1 — Pilot

- [x] Finalisasi schema dan state machine automation.
- [x] Tambahkan migrasi PostgreSQL idempotent.
- [x] Implementasikan contract dan kalkulasi timezone schedule.
- [x] Implementasikan repository tenant-scoped dan atomic claim.
- [x] Refactor pembuatan Operator job menjadi shared service.
- [x] Implementasikan dispatcher dan status reconciler worker.
- [x] Tambahkan worker boot gate dan health metadata.
- [x] Implementasikan CRUD/action/notification API.
- [x] Implementasikan halaman Content Automations dan permission menu.
- [x] Tambahkan unit dan integration test.
- [x] Build, restart, dan smoke test staging.
- [x] Buat pilot schedule Nutribake dan verifikasi pause review.
- [x] Perbarui checkbox progress secara real-time.
- [x] Jalankan release patch serta verifikasi remote main/tag.

### Fase 2 — Notifikasi Eksternal

- [ ] Pilih provider pilot dan desain credential handling.
- [ ] Implementasikan notification outbox + backoff.
- [ ] Implementasikan quiet hours dan preference.
- [ ] Tambahkan missed-run policy lanjutan.
- [ ] Tambahkan calendar/run-health UI.
- [ ] Test, staging pilot, dan release terpisah.

### Fase 3 — Multi-node dan Governance

- [ ] Implementasikan worker lease/heartbeat multi-node.
- [ ] Implementasikan concurrency, rate limit, dan quota guard tenant.
- [ ] Tambahkan blackout/holiday dan approval bertingkat.
- [ ] Tambahkan analytics pilar dan rekomendasi jadwal.
- [ ] Security/load/failover test dan release terpisah.

## 9. Rekomendasi Eksekusi

Mulai hanya dari Fase 1. Untuk pilot pertama, gunakan satu schedule Nutribake dengan `Run Now`, lalu satu jadwal mingguan. Jangan memulai Fase 2 sebelum minimal dua siklus mingguan berhasil tanpa duplikasi dan tanpa produksi sebelum approval.

## 10. Patch Fase 1.1 — Directive, Preset Manager, dan UI Automation

### Sasaran

1. Pisahkan arahan internal AI dari kalimat outro yang benar-benar diucapkan.
2. Cegah kebocoran directive ke VO, CTA, caption, dan prompt visual.
3. Reparasi kampanye `opc_37ca39_e74aff` tanpa menjalankan produksi.
4. Jadikan preset OPC tenant-scoped dan dapat dikelola Admin.
5. Rapikan Content Automations: sidebar, satu kolom, modal New Schedule, tombol konsisten, dan approval kampanye terpisah.

### File dan Code Sebelum/Sesudah

#### `lib/prompts.js`

**Code Sebelum (Current/Before)**

```js
CUSTOM INSTRUCTIONS FROM USER: custom_instruction
MANDATORY: klip terakhir wajib mengucapkan custom_instruction
```

**Code Sesudah (Proposed/After)**

```js
AI DIRECTIVE: ai_directive // internal, never quote
MANDATORY OUTRO: mandatory_outro_line // spoken only when explicitly set
```

#### `lib/pillar-campaign-ingest.js` dan `lib/db.js`

**Code Sebelum (Current/Before)**

```js
custom_instruction: planner.brand_context
```

**Code Sesudah (Proposed/After)**

```js
ai_directive: globalSettings.ai_directive || planner.brand_context
mandatory_outro_line: globalSettings.mandatory_outro_line || ''
```

#### `lib/db-pg.js`

**Code Sebelum (Current/Before)**

```sql
-- pillar_campaigns belum memiliki ai_directive dan mandatory_outro_line
```

**Code Sesudah (Proposed/After)**

```sql
ALTER TABLE pillar_campaigns ADD COLUMN IF NOT EXISTS ai_directive TEXT;
ALTER TABLE pillar_campaigns ADD COLUMN IF NOT EXISTS mandatory_outro_line TEXT;
```

#### `lib/ai-directive.js` dan `lib/scheduler-processors.js`

**Code Sebelum (Current/Before)**

```js
const parsed = parseGeminiJSON(result);
```

**Code Sesudah (Proposed/After)**

```js
const parsed = sanitizeAiDirectiveLeak(parseGeminiJSON(result), aiDirective);
```

#### `scripts/repair-ai-directive-leak.mjs`

**Code Sebelum (Current/Before)**

```js
// Belum ada reparasi campaign awaiting_approval yang sudah terdampak.
```

**Code Sesudah (Proposed/After)**

```js
await repairCampaignVoiceover(campaignId); // result, original/safe VO, dan video plan
```

#### `lib/operator-presets.js` dan `app/api/v2/operator-presets/*`

**Code Sebelum (Current/Before)**

```js
const PRESETS = { nutribake_editorial_v1: {...} };
// read-only, global, hard-coded
```

**Code Sesudah (Proposed/After)**

```js
// Built-in immutable + custom tenant presets from tenant setting cache.
listOperatorPresets();
saveOperatorPreset();
deleteOperatorPreset();
```

#### `app/content-automations/page.js`

**Code Sebelum (Current/Before)**

```jsx
<main><TwoColumnGrid><AlwaysVisibleForm/><Schedules/></TwoColumnGrid></main>
```

**Code Sesudah (Proposed/After)**

```jsx
<><Sidebar/><main><Header actions/><OneColumnSections/><ScheduleModal/><PresetModal/></main></>
```

#### `app/api/v2/content-automations/runs/[runId]/approve/route.js`

**Code Sebelum (Current/Before)**

```js
// Approval seluruh campaign hanya tersedia melalui Operator bearer API.
```

**Code Sesudah (Proposed/After)**

```js
// UI-session Admin approval dengan revision/checksum terbaru dan audit event.
```

### Execution Task List Fase 1.1

- [x] Tambahkan migration dan mapping `ai_directive`/`mandatory_outro_line`.
- [x] Perbaiki prompt dan tambahkan sanitizer beserta unit test.
- [x] Reparasi campaign pilot serta verifikasi revision berubah.
- [x] Implementasikan tenant preset storage dan Admin CRUD API.
- [x] Refactor UI Automation menjadi sidebar + satu kolom + modal.
- [x] Tambahkan aksi review dan approve entire campaign yang terpisah dari Run Now/Aktifkan.
- [x] Jalankan test, build, restart, dan smoke test staging.
- [x] Jalankan release patch dan verifikasi remote main/tag.
