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

- [x] Fase 2A: implementasikan missed-run policy dan retry/backoff content run.
- [x] Fase 2B: implementasikan notification outbox dan provider Telegram pilot.
- [x] Fase 2C: implementasikan calendar view dan run-health UI.
- [ ] Fase 2D: hardening, test, observability, serta pilot Windows.
  - [x] Pipeline hardening Product Campaign: tenant flags, durable start-frame, review state machine, stage ledger, dan redacted structured logging.
  - [x] Integrasikan Content Automation ke Preset Manager dan katalog Product Database canonical; sinkronkan picker Content Planner.
  - [ ] Pilot provider/Windows dijalankan terpisah setelah hardening Dev disetujui.

### Fase 3 — Multi-node dan Governance

- [ ] Implementasikan worker lease/heartbeat multi-node.
- [ ] Implementasikan concurrency, rate limit, dan quota guard tenant.
- [ ] Tambahkan blackout/holiday dan approval bertingkat.
- [ ] Tambahkan analytics pilar dan rekomendasi jadwal.
- [ ] Security/load/failover test dan release terpisah.

## 9. Rekomendasi Eksekusi

Mulai hanya dari Fase 1. Untuk pilot pertama, gunakan satu schedule Nutribake dengan `Run Now`, lalu satu jadwal mingguan. Jangan memulai Fase 2 sebelum minimal dua siklus mingguan berhasil tanpa duplikasi dan tanpa produksi sebelum approval.

## 9A. Implementation Plan Fase 2 — Reliability, Notification, dan Calendar

### 9A.1 Sasaran dan keputusan desain

Fase 2 dilaksanakan sebagai empat patch terpisah supaya setiap perubahan dapat diuji dan di-rollback sendiri:

1. **Fase 2A — Reliability Core:** missed-run policy dan retry/backoff otomatis untuk dispatch content job.
2. **Fase 2B — External Notification:** database outbox, preference/quiet hours, dan Telegram sebagai provider pilot.
3. **Fase 2C — Calendar View:** kalender month/week, detail occurrence, filter schedule/brand/status, dan ringkasan kesehatan run.
4. **Fase 2D — Windows Pilot:** health telemetry, restart-safe test, simulasi downtime, dokumentasi konfigurasi, dan rollout satu tenant.

Keputusan utama:

- Telegram dipilih untuk pilot karena ringan di Windows dan cepat untuk notifikasi approval. Email hanya memakai kontrak adapter yang sama pada fase berikutnya.
- Notifikasi internal yang ada tetap dipertahankan. Pengiriman eksternal menggunakan tabel outbox terpisah agar kegagalan Telegram tidak pernah menggagalkan content run.
- Calendar tidak menyimpan seluruh occurrence masa depan. Server menghitung occurrence secara virtual, lalu menimpanya dengan run aktual agar database tidak membengkak.
- Retry content job dan retry notifikasi dipisahkan. Keduanya mempunyai attempt dan dead-letter sendiri.
- Tautan approval selalu membuka MAKNA dan tetap membutuhkan login Admin. Tidak ada approval token atau storyboard lengkap di Telegram.
- Seluruh query baru wajib tenant-scoped; credential provider tidak boleh masuk ke schedule JSON atau response API.

### 9A.2 State machine yang diusulkan

```text
Content run:
queued -> dispatching -> job_created -> awaiting_approval -> producing -> completed
                   |                         |
                   +-> retry_wait ----------+
                   +-> failed
stale schedule slot -> skipped

Notification outbox:
queued -> sending -> sent
            |-> retry_wait -> sending
            +-> dead_letter
```

Klasifikasi kegagalan:

- `transient`: timeout, koneksi putus, HTTP 429, dan HTTP 5xx; boleh retry otomatis.
- `permanent`: konfigurasi/payload tidak valid, HTTP 400/401/403; langsung gagal atau dead-letter.
- `unknown`: retry sekali, lalu dead-letter agar tidak membuat loop tanpa batas.

Backoff memakai exponential backoff dengan full jitter:

```text
delay = random(0, min(max_backoff, base_backoff * 2^(attempt - 1)))
```

Default pilot: maksimal 3 attempt, base 60 detik, maksimum 15 menit, dan auto-pause setelah 5 kegagalan content run berturut-turut.

### 9A.3 Missed-run policy

Worker harus menghitung semua slot yang jatuh tempo dari `next_run_at` sampai waktu tick saat ini, lalu menerapkan salah satu kebijakan:

- `skip`: slot yang melewati `grace_minutes` dicatat sebagai `skipped`, schedule langsung dimajukan ke occurrence masa depan terdekat.
- `run_latest`: occurrence lama dilewati dan hanya slot terlewat paling baru yang dibuat sebagai run.
- `catch_up`: menjalankan occurrence dari yang paling lama, maksimal `max_catch_up_runs` (default 3) per tick. Sisa occurrence diringkas sebagai skipped agar restart panjang tidak membanjiri Gemini.

Semua policy harus menjamin `next_run_at > now` setelah resolusi, memakai unique key `(tenant_id, schedule_id, scheduled_for)`, dan aman terhadap dua worker melalui transaksi serta `FOR UPDATE SKIP LOCKED`.

### 9A.4 Notification outbox dan preference

Event eksternal pertama:

- storyboard siap approval;
- content run gagal permanen;
- retry habis/dead-letter;
- schedule otomatis pause;
- missed run/skipped (ringkasan, bukan satu pesan per slot);
- content selesai, opsional per schedule.

Preference per schedule meliputi channel aktif, jenis event, quiet hours, timezone, dan target Telegram. Saat quiet hours, pesan tetap masuk outbox tetapi `next_attempt_at` dipindahkan ke akhir quiet hours. Deduplikasi memakai `(tenant_id, event_key, channel)`.

Credential Telegram disimpan tenant-scoped sebagai secret/masked setting. Endpoint baca hanya mengembalikan `configured: true/false` dan chat label, tidak pernah bot token. Tombol **Send Test Notification** tersedia hanya untuk Admin.

### 9A.5 Calendar view

Halaman Content Automations mendapat pilihan tampilan **List | Calendar**. Calendar menyediakan:

- mode month dan week;
- timezone aktif yang selalu terlihat;
- future occurrence dari schedule aktif;
- actual run dengan status `awaiting_approval`, `retry_wait`, `failed`, `skipped`, atau `completed`;
- filter schedule, brand account, dan status;
- panel detail saat event dipilih, termasuk tautan review dan alasan skip/failure.

Implementasi memakai `Intl.DateTimeFormat` dan grid React/CSS internal; tidak menambah library calendar besar pada pilot. API membatasi rentang maksimal 62 hari untuk mencegah ekspansi occurrence berlebihan.

### 9A.5A Admin deletion untuk schedule dan run history

Admin tenant mendapat aksi penghapusan dengan dua tingkat yang sengaja dibedakan:

- **Archive Schedule** tetap menjadi pilihan utama dan dapat dipulihkan; schedule berhenti membuat run baru tetapi seluruh history tetap tersedia.
- **Delete Permanently** menghapus schedule beserta automation run dan notifikasi internal/outbox yang terkait setelah Admin mengetik nama schedule sebagai konfirmasi.
- **Delete Run** hanya menghapus catatan automation run berstatus terminal: `completed`, `failed`, atau `skipped`.
- Run berstatus `queued`, `dispatching`, `retry_wait`, `job_created`, `awaiting_approval`, atau `producing` tidak boleh dihapus. Admin harus menunggu selesai atau membatalkan alur melalui mekanisme khusus yang berbeda.
- Penghapusan automation run tidak menghapus Operator job, campaign OPC, storyboard, video, ataupun aset cloud yang pernah dihasilkan. Relasi hanya dilepas untuk menjaga hasil produksi tetap aman.
- **Clear Run History** mendukung filter schedule, status terminal, dan batas tanggal. UI wajib menampilkan preview jumlah run sebelum konfirmasi final.
- Seluruh purge berjalan dalam transaksi, tenant-scoped, Admin-only, idempotent, dan menulis system audit log sebelum data sumber dihapus.

Penghapusan schedule permanen ditolak bila masih ada run non-terminal. Jika tidak ada run aktif, foreign key cascade hanya digunakan untuk tabel automation milik schedule tersebut; data produksi di luar domain automation tidak ikut dihapus.

### 9A.6 Perubahan database

```sql
ALTER TABLE content_automation_schedules
  ADD COLUMN max_catch_up_runs INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN retry_policy_json JSONB NOT NULL DEFAULT '{"max_attempts":3,"base_seconds":60,"max_seconds":900}',
  ADD COLUMN consecutive_failure_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN auto_pause_threshold INTEGER NOT NULL DEFAULT 5;

ALTER TABLE content_automation_runs
  ADD COLUMN next_attempt_at TIMESTAMPTZ,
  ADD COLUMN last_attempt_at TIMESTAMPTZ,
  ADD COLUMN failure_class TEXT,
  ADD COLUMN skip_reason TEXT;

CREATE TABLE content_automation_notification_preferences (...);
CREATE TABLE content_automation_notification_outbox (...);
CREATE UNIQUE INDEX ... ON content_automation_notification_outbox(tenant_id,event_key,channel);
CREATE INDEX ... ON content_automation_notification_outbox(status,next_attempt_at);
```

Migrasi harus additive dan idempotent. Rollback aplikasi cukup mematikan worker Fase 2; kolom/tabel tidak perlu dihapus.

### 9A.7 File dan rancangan perubahan (Before/After)

#### `lib/db-pg.js`

**Code Sebelum (Current/Before)**

```js
CREATE TABLE IF NOT EXISTS content_automation_notifications (...);
```

**Code Sesudah (Proposed/After)**

```js
ALTER TABLE content_automation_schedules ADD COLUMN IF NOT EXISTS max_catch_up_runs INTEGER DEFAULT 3;
ALTER TABLE content_automation_runs ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS content_automation_notification_preferences (...);
CREATE TABLE IF NOT EXISTS content_automation_notification_outbox (...);
```

#### `lib/content-automation-contract.js`

**Code Sebelum (Current/Before)**

```js
missed_run_policy: 'skip',
grace_minutes: Math.min(1440, Math.max(1, Number(merged.grace_minutes || 60)))
```

**Code Sesudah (Proposed/After)**

```js
missed_run_policy: normalizeMissedRunPolicy(merged.missed_run_policy),
grace_minutes: clamp(merged.grace_minutes, 1, 1440),
max_catch_up_runs: clamp(merged.max_catch_up_runs, 1, 10),
retry_policy: normalizeRetryPolicy(merged.retry_policy)
```

#### `lib/content-automation-schedule.js`

**Code Sebelum (Current/Before)**

```js
export function calculateNextRun({ frequency, config, timezone, after = new Date() }) { ... }
```

**Code Sesudah (Proposed/After)**

```js
export function calculateOccurrences({ frequency, config, timezone, from, to, limit }) { ... }
export function calculateNextRun(args) {
  return calculateOccurrences({ ...args, limit: 1 })[0];
}
```

#### `lib/content-automation-missed-runs.js` (baru)

**Code Sebelum (Current/Before)**

```js
// Belum ada; worker selalu mengambil satu next_run_at yang terlambat.
```

**Code Sesudah (Proposed/After)**

```js
export function resolveMissedRuns({ occurrences, policy, graceMinutes, maxCatchUpRuns, now }) {
  return { runnableSlots, skippedSlots, nextRunAt };
}
```

#### `lib/content-automation-retry.js` (baru)

**Code Sebelum (Current/Before)**

```js
// Retry hanya tersedia manual melalui endpoint run.
```

**Code Sesudah (Proposed/After)**

```js
export function classifyAutomationError(error) { ... }
export function calculateBackoff({ attempt, baseSeconds, maxSeconds, random }) { ... }
export function shouldRetry({ failureClass, attempt, maxAttempts }) { ... }
```

#### `lib/content-automation-repository.js`

**Code Sebelum (Current/Before)**

```js
SELECT * FROM content_automation_schedules
WHERE status='active' AND next_run_at<=CURRENT_TIMESTAMP
ORDER BY next_run_at FOR UPDATE SKIP LOCKED LIMIT 1
```

**Code Sesudah (Proposed/After)**

```js
export async function claimDueAutomation(workerId, now) { /* resolve policy atomically */ }
export async function claimRetryableRun(workerId, now) { /* status=retry_wait */ }
export async function recordSkippedSlots(schedule, slots, reason) { ... }
export async function recordRunOutcome(run, outcome) { /* counters + auto-pause */ }
export async function previewSchedulePurge(id) { /* run/notif counts + blockers */ }
export async function purgeSchedule(id, actor) { /* terminal-only, transaction */ }
export async function purgeRun(id, actor) { /* preserve operator job/campaign/assets */ }
export async function previewRunHistoryPurge(filters) { ... }
export async function purgeRunHistory(filters, actor) { ... }
```

#### `app/api/v2/content-automations/[id]/route.js`

**Code Sebelum (Current/Before)**

```js
export async function DELETE(request,{params}) {
  return archiveAutomation(id);
}
```

**Code Sesudah (Proposed/After)**

```js
export async function DELETE(request,{params}) {
  requireAdmin(request);
  // mode=archive tetap default; mode=purge wajib confirmation_name dan preview token.
}
```

#### `app/api/v2/content-automations/runs/[runId]/route.js` (baru)

**Code Sebelum (Current/Before)**

```js
// Belum ada endpoint untuk menghapus satu run history.
```

**Code Sesudah (Proposed/After)**

```js
export async function DELETE(request,{params}) {
  requireAdmin(request);
  // Hanya terminal state; tidak menghapus operator job/campaign/assets.
}
```

#### `app/api/v2/content-automations/run-history/route.js` (baru)

**Code Sebelum (Current/Before)**

```js
// Belum ada preview/bulk purge run history.
```

**Code Sesudah (Proposed/After)**

```js
export async function POST(request) { /* preview counts + signed/short-lived preview token */ }
export async function DELETE(request) { /* apply exact previewed filters transactionally */ }
```

#### `lib/content-automation-worker.js`

**Code Sebelum (Current/Before)**

```js
catch(error) {
  await updateRun(run.id,{status:'failed', ...});
} finally {
  await advanceSchedule(schedule, calculateNextRun(...));
}
```

**Code Sesudah (Proposed/After)**

```js
catch (error) {
  const decision = decideRetry(error, run, schedule.retry_policy_json);
  await recordRunOutcome(run, decision);
}
// Schedule advancement is committed by the missed-run resolver, not blindly in finally.
```

#### `lib/notification-outbox-repository.js` (baru)

**Code Sebelum (Current/Before)**

```js
// Hanya ada notifikasi internal content_automation_notifications.
```

**Code Sesudah (Proposed/After)**

```js
export async function enqueueNotification(event) { ... }
export async function claimNotification(workerId) { /* FOR UPDATE SKIP LOCKED */ }
export async function markNotificationSent(id, providerMessageId) { ... }
export async function rescheduleNotification(id, retryAt, error) { ... }
export async function deadLetterNotification(id, error) { ... }
```

#### `lib/notification-providers/telegram.js` (baru)

**Code Sebelum (Current/Before)**

```js
// Provider eksternal belum ada.
```

**Code Sesudah (Proposed/After)**

```js
export async function sendTelegramNotification({ botToken, chatId, message, actionUrl }) {
  // Timeout, response classification, no secret logging.
}
```

#### `lib/content-automation-notification-worker.js` (baru)

**Code Sebelum (Current/Before)**

```js
// Pengiriman eksternal belum memiliki worker.
```

**Code Sesudah (Proposed/After)**

```js
export async function runNotificationTick() { /* claim -> adapter -> sent/retry/dead */ }
export function startContentAutomationNotificationWorker() { ... }
export function getNotificationRuntime() { ... }
```

#### `instrumentation.js`

**Code Sebelum (Current/Before)**

```js
startContentAutomationWorker();
```

**Code Sesudah (Proposed/After)**

```js
startContentAutomationWorker();
if (process.env.ENABLE_CONTENT_AUTOMATION_NOTIFICATIONS !== 'false') {
  startContentAutomationNotificationWorker();
}
```

#### `app/api/v2/content-automations/calendar/route.js` (baru)

**Code Sebelum (Current/Before)**

```js
// Belum ada endpoint calendar.
```

**Code Sesudah (Proposed/After)**

```js
export async function GET(request) {
  // Validate auth, timezone, from/to <= 62 days; return virtual occurrences + actual runs.
}
```

#### `app/api/v2/content-automations/notification-settings/route.js` (baru)

**Code Sebelum (Current/Before)**

```js
// Belum ada endpoint preference/provider.
```

**Code Sesudah (Proposed/After)**

```js
export async function GET(request) { /* masked admin-safe settings */ }
export async function PUT(request) { /* admin-only, tenant-scoped */ }
```

#### `app/api/v2/content-automations/notification-settings/test/route.js` (baru)

**Code Sebelum (Current/Before)**

```js
// Belum ada test notification.
```

**Code Sesudah (Proposed/After)**

```js
export async function POST(request) {
  // Admin-only; enqueue test event through the same outbox, never direct-send.
}
```

#### `app/content-automations/page.js`

**Code Sebelum (Current/Before)**

```jsx
<section className="card"><h3>Schedules</h3>...</section>
<section className="card"><h3>Run History</h3>...</section>
```

**Code Sesudah (Proposed/After)**

```jsx
<ViewToggle value={view} options={['list', 'calendar']} />
{view === 'calendar' ? <AutomationCalendar events={events} /> : <AutomationList />}
<NotificationSettings adminOnly maskedCredentials />
<RunHealthSummary />
<AdminDeleteActions previewBeforePurge typedConfirmation />
```

#### `app/api/v2/system-health/route.js`

**Code Sebelum (Current/Before)**

```js
contentAutomation: getContentAutomationRuntime()
```

**Code Sesudah (Proposed/After)**

```js
contentAutomation: await getContentAutomationHealth(),
notificationWorker: await getNotificationHealth()
// due count, retry_wait, dead_letter, last tick/error, auto-paused schedules
```

#### `.env.staging.local.example`

**Code Sebelum (Current/Before)**

```dotenv
ENABLE_CONTENT_AUTOMATION_WORKER=true
```

**Code Sesudah (Proposed/After)**

```dotenv
ENABLE_CONTENT_AUTOMATION_WORKER=true
ENABLE_CONTENT_AUTOMATION_NOTIFICATIONS=true
CONTENT_AUTOMATION_INTERVAL_MS=15000
CONTENT_AUTOMATION_NOTIFICATION_INTERVAL_MS=10000
MAKNA_PUBLIC_BASE_URL=http://100.117.59.92:5020
```

#### `scripts/test-content-automation.mjs`

**Code Sebelum (Current/Before)**

```js
// Fase 1: contract, schedule calculation, CRUD/claim, manual retry.
```

**Code Sesudah (Proposed/After)**

```js
// Tambah unit test policy skip/run_latest/catch_up, DST, error classification,
// deterministic backoff, max attempts, auto-pause, and occurrence expansion.
```

#### `scripts/test-content-automation-phase2.mjs` (baru)

**Code Sebelum (Current/Before)**

```js
// Belum ada integration test Fase 2.
```

**Code Sesudah (Proposed/After)**

```js
// PostgreSQL integration: concurrent claims, downtime simulation, outbox dedupe,
// quiet hours, dead-letter, tenant isolation, calendar overlay, restart recovery.
```

#### `package.json`

**Code Sebelum (Current/Before)**

```json
"test:content-automation": "node scripts/test-content-automation.mjs"
```

**Code Sesudah (Proposed/After)**

```json
"test:content-automation": "node scripts/test-content-automation.mjs",
"test:content-automation:phase2": "node scripts/test-content-automation-phase2.mjs"
```

### 9A.8 API contract ringkas

```text
GET  /api/v2/content-automations/calendar?from=&to=&timezone=&schedule_id=&status=
GET  /api/v2/content-automations/notification-settings
PUT  /api/v2/content-automations/notification-settings
POST /api/v2/content-automations/notification-settings/test
DELETE /api/v2/content-automations/:id?mode=archive|purge
DELETE /api/v2/content-automations/runs/:runId
POST   /api/v2/content-automations/run-history        # preview purge
DELETE /api/v2/content-automations/run-history        # confirmed purge
```

Response calendar membedakan `source: schedule | run`, membawa `scheduled_for`, `status`, `schedule_id`, `brand_account`, dan action URL yang sudah tenant-scoped. Endpoint calendar dan settings tidak pernah mengembalikan operator request lengkap atau credential.

### 9A.9 Acceptance criteria

- Downtime 24 jam dengan policy `skip`, `run_latest`, dan `catch_up` menghasilkan outcome yang sesuai tanpa campaign duplikat.
- Dua worker bersamaan tidak mengeksekusi slot maupun outbox item yang sama.
- Error transient mengikuti backoff dan berhenti pada max attempt; error auth/validation tidak diulang tanpa guna.
- Kegagalan Telegram tidak mengubah status content run.
- Event yang sama maksimal terkirim satu kali secara logis; provider timeout ambigu tercatat untuk audit.
- Quiet hours memakai timezone schedule/tenant dan menggeser pengiriman tanpa menghilangkan pesan.
- Calendar menampilkan occurrence virtual serta run aktual secara konsisten pada rentang DST dan maksimal 62 hari.
- Hanya Admin dapat mengubah/test credential; token tidak muncul di response, UI, maupun log.
- Auto-pause menghasilkan audit event, notifikasi internal, dan notifikasi eksternal.
- Worker restart pada Windows melanjutkan `retry_wait`/outbox tanpa reset manual.
- User non-Admin tidak dapat menghapus schedule maupun run history.
- Schedule dengan run non-terminal tidak dapat dipurge dan UI menampilkan blocker yang jelas.
- Delete run/clear history tidak menghapus Operator job, campaign, storyboard, video, atau aset cloud.
- Bulk purge hanya menghapus kumpulan yang sama dengan preview dan menghasilkan audit record tenant-scoped.

### 9A.10 Execution Task List Fase 2

#### Fase 2A — Reliability Core

- [x] Tambahkan schema additive untuk retry, missed run, counters, dan indexes.
- [x] Perluas contract schedule untuk `skip`, `run_latest`, `catch_up`, grace, limit, dan retry policy.
- [x] Implementasikan occurrence expansion dan resolver missed-run yang timezone-safe.
- [x] Refactor atomic claim agar schedule advancement tidak lagi dilakukan membabi buta di `finally`.
- [x] Implementasikan klasifikasi error, exponential backoff, retry claim, dan max attempts.
- [x] Implementasikan consecutive failure counter dan auto-pause threshold.
- [x] Ubah DELETE schedule menjadi Admin-only dengan mode archive default dan purge permanen berkonfirmasi.
- [x] Tambahkan preview blocker/count sebelum permanent schedule purge.
- [x] Tambahkan Admin delete untuk satu terminal run tanpa menghapus hasil campaign/produksi.
- [x] Tambahkan preview dan bulk clear run history berdasarkan schedule/status terminal/rentang tanggal.
- [x] Tambahkan audit log dan regression test tenant isolation serta perlindungan non-terminal run.
- [ ] Tambahkan unit/integration test Fase 2A selesai; rilis patch tertunda karena approval Git tidak tersedia.

#### Fase 2B — External Notification

- [x] Tambahkan preference dan notification outbox tenant-scoped.
- [x] Implementasikan outbox claim, dedupe, quiet hours, retry, dan dead-letter.
- [x] Implementasikan adapter Telegram tanpa mencatat token ke log.
- [x] Tambahkan API Admin untuk masked settings dan test notification via outbox.
- [x] Hubungkan event awaiting approval, failed, skipped summary, completed opsional, dan auto-pause.
- [x] Tambahkan runtime health notification worker dan boot gate.
- [x] Uji provider fake, timeout ambigu, 429/5xx, 401, dan tenant isolation; build berhasil.
- [ ] Rilis patch Fase 2A/2B tertunda karena approval Git tidak tersedia sampai 8 Agustus 2026.

#### Fase 2C — Calendar dan Run Health

- [x] Tambahkan calendar query service serta endpoint rentang maksimal 62 hari.
- [x] Implementasikan month/week grid tanpa dependency calendar baru.
- [x] Tambahkan filter schedule, brand, status, timezone, dan detail event.
- [x] Tambahkan run-health cards untuk due, retry wait, failed, dead-letter, dan auto-paused.
- [x] Uji responsive layout, akses role, timezone/DST, dan rilis patch.

#### Fase 2D — Windows Pilot

- [x] Pastikan port staging `5020` listen dan health endpoint dapat diakses dari node Windows.
- [x] Konfigurasikan base URL dan worker flags tanpa menaruh bot token di file repository.
- [x] Jalankan simulasi service mati, missed run, restart, retry, dan outbox recovery.
- [x] Jalankan pilot satu schedule Nutribake dalam mode `run_latest` dan approval storyboard.
- [ ] Observasi minimal dua occurrence tanpa duplikasi atau produksi sebelum approval.
- [x] Dokumentasikan rollback flags, lakukan release final Fase 2, dan verifikasi main/tag remote.

### 9A.11 Rollout dan rollback

Urutan rollout: migrasi additive dengan kedua worker off, aktifkan Fase 2A untuk satu schedule, aktifkan Telegram test outbox, aktifkan calendar read-only, kemudian jalankan simulasi downtime. Rollback dilakukan dengan:

```dotenv
ENABLE_CONTENT_AUTOMATION_NOTIFICATIONS=false
ENABLE_CONTENT_AUTOMATION_WORKER=false
```

Menonaktifkan notification worker tidak menghapus outbox. Menonaktifkan content automation worker tidak membatalkan operator job yang sudah dibuat. Setelah perbaikan, worker dapat diaktifkan kembali dan melanjutkan item `retry_wait` yang belum melewati batas attempt.

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

## 12. Patch Fase 1.2 — Security dan Regression Hardening

### Sasaran

1. Hilangkan credential database dari source dan beri pagar pengaman pada sinkronisasi database.
2. Pastikan semua secret Settings tidak tertimpa nilai masked dan hanya dapat dikelola Admin tenant.
3. Selesaikan pemisahan `ai_directive`, legacy `custom_instruction`, dan `mandatory_outro_line` tanpa duplikasi prompt.
4. Pastikan kegagalan auto-trim PostgreSQL benar-benar tertangkap.

### File dan Before/After

#### `app/api/settings/route.js`

**Code Sebelum (Current/Before)**

```js
webhook_api_key: await getSetting('webhook_api_key')
  ? '••••••••' + await getSetting('webhook_api_key').slice(-6) : '';
if (gemini_api_key) await setSetting('gemini_api_key', gemini_api_key);
```

**Code Sesudah (Proposed/After)**

```js
const user = requireSettingsAdmin(request);
const settings = await loadSettingsOnce();
webhook_api_key: maskSecret(settings.webhook_api_key);
if (isNewSecret(gemini_api_key)) await setSetting('gemini_api_key', gemini_api_key);
```

#### `lib/db.js`

**Code Sebelum (Current/Before)**

```js
db.exec(`DELETE FROM system_audit_logs ...`);
ai_directive: campaign.ai_directive || campaign.custom_instruction || '';
```

**Code Sesudah (Proposed/After)**

```js
await db.exec(`DELETE FROM system_audit_logs ...`);
ai_directive: campaign.ai_directive || '';
```

#### `lib/secret-values.js` (baru)

**Code Sebelum (Current/Before)**

```js
// Masking secret tersebar di route dan tidak konsisten.
```

**Code Sesudah (Proposed/After)**

```js
export function maskSecret(value) { ... }
export function isNewSecret(value) { ... }
```

#### `lib/prompt-instructions.js` (baru)

**Code Sebelum (Current/Before)**

```js
// Legacy custom instruction dan outro belum dinormalisasi terpusat.
```

**Code Sesudah (Proposed/After)**

```js
export function resolvePromptInstructions(input) {
  return { aiDirective, mandatoryOutroLine };
}
```

#### `lib/prompts.js`

**Code Sebelum (Current/Before)**

```js
const aiDirective = config.ai_directive || config.custom_instruction || '';
// custom_instruction dapat muncul lagi pada blok prompt berikutnya.
```

**Code Sesudah (Proposed/After)**

```js
const { aiDirective, mandatoryOutroLine } = resolvePromptInstructions(config);
// Tepat satu blok directive dan satu aturan outro eksplisit.
```

#### `app/components/ImportPlannerModal.js`

**Code Sebelum (Current/Before)**

```js
setAiDirective('');
setMandatoryOutroLine('');
```

**Code Sesudah (Proposed/After)**

```js
const instructions = resolvePlannerInstructions(planner);
setAiDirective(instructions.aiDirective);
setMandatoryOutroLine(instructions.mandatoryOutroLine);
```

#### `app/api/settings/test-nextcloud/route.js`

**Code Sebelum (Current/Before)**

```js
const { password } = await request.json();
```

**Code Sesudah (Proposed/After)**

```js
requireAdmin(request);
const password = isNewSecret(input) ? input : await getSetting('nextcloud_app_password');
```

#### `scripts/sync-local-db-to-server.js`

**Code Sebelum (Current/Before)**

```js
const REMOTE_DB = { user: '...', pass: 'hardcoded', name: '...' };
pg_dump --clean --if-exists ...;
```

**Code Sesudah (Proposed/After)**

```js
const config = loadRequiredEnvironment();
requireExplicitConfirmationFlags(config);
// Dump default non-destructive; destructive restore requires an explicit flag and backup.
```

#### `scripts/test-phase-1-2.mjs` (baru)

**Code Sebelum (Current/Before)**

```js
// Belum ada regression test khusus masked secrets dan instruction resolution.
```

**Code Sesudah (Proposed/After)**

```js
assertMaskedSecretsAreIgnored();
assertLegacyOutroIsExtractedOnce();
assertDirectiveNeverBecomesOutro();
```

#### `package.json`

**Code Sebelum (Current/Before)**

```json
"test:content-automation": "node scripts/test-content-automation.mjs"
```

**Code Sesudah (Proposed/After)**

```json
"test:phase-1-2": "node scripts/test-phase-1-2.mjs"
```

### Execution Task List Fase 1.2

- [x] Lindungi endpoint Settings dengan role Admin dan masking helper yang konsisten.
- [x] Perbaiki pembacaan webhook key serta seluruh masked secret overwrite.
- [x] Perbaiki `await db.exec()` pada auto-trim audit log.
- [x] Pisahkan penyimpanan directive dari legacy custom instruction.
- [x] Normalisasi directive/outro untuk OPC dan seluruh RE prompt builder.
- [x] Pertahankan directive/outro saat mengimpor Content Planner.
- [x] Hilangkan credential hardcoded dan tambahkan safety gate sinkronisasi database.
- [x] Tambahkan serta jalankan regression test Fase 1.2.
- [x] Jalankan build dan staging verification.
- [x] Jalankan release patch dan verifikasi branch/tag remote.
- [x] Jangan mengerjakan Fase 2A sampai ada perintah pengguna.
