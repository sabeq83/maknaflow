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

---

# Rencana Implementasi Perbaikan OPC Start Frame Product Reference v2.14.35

## 1. Tujuan

Memastikan start frame OPC memakai tepat satu foto produk aktif dari Product Database hanya pada klip produk/bridge, dengan payload referensi yang identik antara Phase 1 dan Regen. Perbaikan harus menghilangkan ketergantungan OPC pada resolver legacy `resolveProductBase64()` tanpa mengganggu consumer RE, Bridge Injector, atau IFC yang masih memakainya.

Target perilaku untuk campaign dengan `bridge_at_clip=3` dan `bridge_duration_clips=1`:

- klip 1, 2, dan klip setelah 3 tidak menerima foto produk;
- klip 3 menerima tepat satu foto produk canonical;
- Phase 1 dan Regen klip 3 mempunyai `reference_sha256`, `reference_count`, dan product reference yang identik;
- bila foto canonical tidak tersedia, klip produk gagal secara eksplisit sebelum request dikirim ke G-Labs;
- pergantian `active_photo` di Product Database langsung dipakai oleh request berikutnya.

## 2. Akar Masalah yang Harus Ditutup

1. OPC mempunyai dua resolver foto produk dengan prioritas berbeda. `resolveProductBase64()` memilih `clean_photo_url` lebih dahulu, sedangkan `resolveActiveProductReference()` menghormati `active_photo` dan mengenal `generated_photo_url`.
2. Phase 1 dan Regen menghitung `isBridge` sendiri, lalu memasukkan hasil resolver legacy sebagai `extraReferences`.
3. Sejak v2.14.34, shared builder hanya memakai foto canonical sebagai fallback jika `extraReferences` kosong. Reference legacy yang sudah terisi karena itu mengalahkan foto aktif database.
4. Keputusan product clip tersebar antara bridge range dan metadata AI, sehingga caller dan builder dapat berbeda pendapat.
5. Regression test saat ini hanya memanggil builder langsung. Test tidak mengeksekusi adapter Phase 1 dan Regen, serta integration test bergantung pada campaign yang sudah ada di schema database.

## 3. Desain Perbaikan

### 3.1 Satu keputusan product-reference policy

`resolveProductReferenceRequirement()` menjadi satu-satunya fungsi yang menentukan apakah product reference wajib. Semua angka dinormalisasi dengan pemeriksaan nilai eksplisit, bukan fallback `||`.

Prioritas keputusan:

1. bridge range campaign yang tervalidasi;
2. metadata eksplisit `requires_product_reference === true`;
3. metadata eksplisit `product_visible === true`;
4. selain itu `not_required`.

Hasil resolver harus membawa `bridgeStart`, `bridgeEnd`, dan `reason` agar Phase 1, Regen, test, dan audit menggunakan keputusan yang sama.

### 3.2 Builder menjadi pemilik tunggal foto produk OPC

`buildOpcStartFrameRequest()` sendiri yang:

- memuat produk berdasarkan `target_product_id/product_id`;
- memilih foto melalui `resolveActiveProductReference()`;
- menambahkan foto canonical hanya jika policy mewajibkannya;
- memastikan tepat satu product reference;
- melakukan fail-closed bila product reference wajib tetapi tidak ditemukan.

Caller tidak boleh lagi mengirim product photo melalui `extraReferences`. Parameter tersebut diperjelas menjadi `contextReferences` dan hanya boleh berisi reference non-produk seperti karakter kartun.

### 3.3 Adapter Phase 1 dan Regen tipis

Phase 1 dan Regen hanya mengirim campaign, item, clip index, prompt, origin, dan optional character/context references. Keduanya tidak boleh memuat produk, menjalankan `resolveProductBase64()`, atau menghitung bridge range sendiri.

### 3.4 Audit dan invariants

Audit mencatat policy efektif dan identitas foto canonical tanpa menyimpan Base64:

- `requires_product_reference`;
- `requirement_reason`;
- `reference_count` total;
- `product_reference_count` pada object audit;
- `reference_source_field`;
- `reference_sha256`;
- effective bridge range.

Invariant sebelum provider call:

- product clip: `product_reference_count === 1`;
- non-product clip: `product_reference_count === 0`;
- Base64 tidak pernah masuk audit/log.

Tidak diperlukan migrasi awal untuk kolom baru: metadata tambahan dapat dipakai dalam structured log/test terlebih dahulu, sedangkan kolom audit existing tetap diisi kompatibel.

## 4. Rencana Per File — Before dan After

### `lib/opc-start-frame-contract.js`

**Code Sebelum (Current/Before)**

```js
const bridgeStart = Number(campaign?.bridge_at_clip || 2);
const bridgeEnd = bridgeStart + Math.max(1, Number(campaign?.bridge_duration_clips || 1)) - 1;
const bridge = Number(clipIndex) >= bridgeStart && Number(clipIndex) <= bridgeEnd;
const required = productCampaign && (
  bridge || clip.product_visible === true || clip.requires_product_reference === true
);
```

**Code Sesudah (Proposed/After)**

```js
const normalizedClipIndex = normalizePositiveClipIndex(clipIndex);
const bridgeStart = normalizePositiveClipIndex(campaign?.bridge_at_clip, 2);
const bridgeDuration = normalizeBridgeDuration(campaign?.bridge_duration_clips, 1);
const bridgeEnd = bridgeStart + bridgeDuration - 1;
const bridge = normalizedClipIndex >= bridgeStart && normalizedClipIndex <= bridgeEnd;

const metadataRequired = clip.requires_product_reference === true || clip.product_visible === true;
const required = productCampaign && (bridge || metadataRequired);

return {
  required,
  productCampaign,
  bridge,
  bridgeStart,
  bridgeEnd,
  reason: bridge ? 'bridge_range'
    : clip.requires_product_reference === true ? 'clip_metadata'
    : clip.product_visible === true ? 'product_visible'
    : 'not_required'
};
```

### `lib/opc-start-frame-request.js`

**Code Sebelum (Current/Before)**

```js
export async function buildOpcStartFrameRequest({
  campaign, item, clipIndex, prompt, origin, extraReferences = []
}) {
  const reference = resolveActiveProductReference({ product, fallbackPaths });
  const references = [...extraReferences];
  if (!references.length && requirement.required && reference) {
    references.push(reference.base64DataUrl);
  }
}
```

**Code Sesudah (Proposed/After)**

```js
export async function buildOpcStartFrameRequest({
  campaign, item, clipIndex, prompt, origin, contextReferences = []
}) {
  const requirement = resolveProductReferenceRequirement({ campaign, item, clipIndex });
  const productReference = requirement.required
    ? await resolveCanonicalOpcProductReference({ campaign, item })
    : null;

  if (requirement.required && !productReference) {
    throw new ProductReferenceUnavailableError();
  }

  const references = dedupeReferences([
    ...sanitizeContextReferences(contextReferences),
    ...(productReference ? [productReference.base64DataUrl] : [])
  ]);

  return buildProviderAndAuditPayload({
    references,
    productReference,
    requirement,
    campaign,
    item,
    clipIndex,
    prompt,
    origin
  });
}
```

Catatan implementasi: `reference_sha256` dan fingerprint harus dihitung dari reference yang benar-benar dikirim, bukan sekadar reference yang sempat ditemukan di database.

### `lib/product-reference-resolver.js`

**Code Sebelum (Current/Before)**

```js
export function resolveActiveProductReference({ product, fallbackPaths = [], cwd = process.cwd() }) {
  // memilih active_photo lalu fallback field lain
}
```

**Code Sesudah (Proposed/After)**

```js
export async function resolveCanonicalOpcProductReference({ campaign, item, cwd = process.cwd() }) {
  const productId = campaign?.target_product_id ?? campaign?.product_id ?? null;
  if (!productId) return null;

  const product = await getProductById(productId);
  return resolveActiveProductReference({
    product,
    fallbackPaths: explicitCompatibilityFallbacks(campaign, item),
    cwd
  });
}
```

Jika pemisahan repository dependency diperlukan untuk menghindari circular import, helper orchestration diletakkan di `lib/opc-product-reference.js`, sedangkan resolver file/path tetap murni di file existing.

### `lib/scheduler-processors.js`

**Code Sebelum (Current/Before)**

```js
const productBase64 = await resolveProductBase64(tempCampaign, productData, rowPayload);
const isBridge = cNum >= bridgeAtClip && cNum <= productEndClip;
if (isBridge && productBase64) {
  extraReferences = [productBase64];
}
const built = await buildOpcStartFrameRequest({
  campaign: tempCampaign,
  item,
  clipIndex,
  prompt,
  extraReferences
});
```

**Code Sesudah (Proposed/After)**

```js
const contextReferences = isCartoonWorld
  ? await resolveClipCharacterReferences({ campaign: tempCampaign, item, clipIndex })
  : [];

const built = await buildOpcStartFrameRequest({
  campaign: tempCampaign,
  item: { ...item, new_video_plan_json: JSON.stringify(newVideoPlan) },
  clipIndex,
  prompt,
  origin: 'phase_1_initial',
  contextReferences
});
```

Perubahan hanya pada jalur OPC `processPillarGenerator`. Export `resolveProductBase64()` dipertahankan sementara untuk consumer non-OPC agar scope patch tidak melebar.

### `app/api/v2/pillar-campaigns/items/[itemId]/regenerate-t2i/route.js`

**Code Sebelum (Current/Before)**

```js
const productBase64 = await resolveProductBase64(campaign, productData, rowPayload);
const isBridge = cNum >= bridgeAtClip && cNum <= productEndClip;
if (isBridge && productBase64) {
  resolvedRefs = { allReferences: [productBase64] };
}
const builtRequest = await buildOpcStartFrameRequest({
  campaign, item, clipIndex, prompt: t2i_prompt,
  origin: 'manual_regen',
  extraReferences: resolvedRefs.allReferences
});
```

**Code Sesudah (Proposed/After)**

```js
const contextReferences = isCartoon
  ? await resolveClipCharacterReferences({ campaign, item, clipIndex })
  : [];

const builtRequest = await buildOpcStartFrameRequest({
  campaign,
  item,
  clipIndex,
  prompt: t2i_prompt,
  origin: 'manual_regen',
  contextReferences
});
```

Route Handler tetap menggunakan `POST`, `await params`, dan `NextResponse` sesuai dokumentasi Next.js 16.2.5. Perubahan difokuskan pada delegasi business logic ke service bersama.

### `lib/opc-start-frame-audit.js`

**Code Sebelum (Current/Before)**

```js
if (JSON.stringify(audit).includes('base64,')) {
  throw new Error('START_FRAME_AUDIT_CONTAINS_BASE64');
}
await pgQuery('INSERT INTO opc_start_frame_request_audits ...', values);
```

**Code Sesudah (Proposed/After)**

```js
assertSafeStartFrameAudit(audit);
assertReferenceInvariant(audit);
await pgQuery('INSERT INTO opc_start_frame_request_audits ...', values);
```

Invariant dijalankan sebelum provider submission di builder/service; audit recorder mempertahankan pemeriksaan defensif kedua.

### `scripts/test-opc-start-frame-reference.mjs`

**Code Sebelum (Current/Before)**

```js
assert.equal(resolveProductReferenceRequirement({ campaign, item, clipIndex: 3 }).required, true);
assert.match(scheduler, /buildOpcStartFrameRequest/);
assert.match(regen, /origin: 'manual_regen'/);
```

**Code Sesudah (Proposed/After)**

```js
await assertReferenceMatrix({
  bridgeAt: 3,
  duration: 1,
  expectedProductReferenceCounts: [0, 0, 1, 0, 0]
});

await assertPhase1AndRegenParity({
  clipIndex: 3,
  expectedSourceField: 'generated_photo_url',
  expectedProductReferenceCount: 1
});

await assert.rejects(
  () => buildProductClipRequestWithoutPhoto(),
  error => error.code === 'PRODUCT_REFERENCE_UNAVAILABLE'
);
```

Test harus memeriksa `providerRequest.reference_images` dan SHA aktual, bukan regex source code sebagai bukti utama.

### `scripts/test-opc-start-frame-reference-integration.mjs`

**Code Sebelum (Current/Before)**

```js
const campaign = await pgQuery(`
  SELECT * FROM pillar_campaigns
  WHERE target_product_id IS NOT NULL
  ORDER BY created_at DESC LIMIT 1
`);
assert.ok(campaign, 'Campaign Product OPC Dev tidak tersedia.');
```

**Code Sesudah (Proposed/After)**

```js
const fixture = await createIsolatedOpcReferenceFixture({
  tenantId: TEST_TENANT_ID,
  bridgeAtClip: 3,
  bridgeDurationClips: 1,
  activePhoto: 'generated_photo_url'
});

try {
  await assertPersistedInitialAndRegenAuditParity(fixture);
} finally {
  await cleanupIsolatedOpcReferenceFixture(fixture);
}
```

Integration test wajib memakai schema Dev yang eksplisit dan tidak melakukan provider call. Implementasi memilih fixture Product OPC Dev secara read-only agar test tidak membuat atau menghapus data campaign; test menolak berjalan bila `PG_SEARCH_PATH` bukan `dev`.

## 5. Verifikasi

### 5.1 Automated

```bash
npm run test:opc:start-frame-reference
npm run test:opc:start-frame-reference-integration
npm run build
```

Acceptance assertions:

- matrix bridge clip 3 menghasilkan count `[0,0,1,0,...]`;
- reference source mengikuti `active_photo` walaupun `clean_photo_url` lain masih tersedia;
- Phase 1 dan Regen menghasilkan product SHA yang sama;
- mengganti active photo mengubah SHA request berikutnya;
- missing canonical photo pada product clip menghasilkan HTTP 422/error terstruktur;
- non-product clip tidak membawa product reference;
- audit tidak mengandung Base64.

### 5.2 Dev Mac Mini

1. Deploy hanya ke Dev dengan `npm run deploy:macmini-dev`.
2. Buat satu Product Campaign fixture dengan bridge tepat di klip 3.
3. Jalankan Phase 1 dan catat audit klip 1–seluruh klip.
4. Pastikan hanya klip 3 mempunyai satu product SHA.
5. Regen klip 3, lalu pastikan SHA product sama dengan Phase 1.
6. Regen satu non-bridge clip dan pastikan `reference_count` produk tetap nol.
7. Inspeksi visual: produk klip 3 sesuai foto aktif database dan tidak muncul pada klip lain akibat reference leakage.

Deployment Production tidak termasuk scope dan hanya boleh dilakukan setelah perintah manual eksplisit pengguna.

## 6. Strategi Rilis

Setelah unit test, integration test, build, dan Dev smoke test berhasil:

```bash
npm run release-non-interactive -- --type patch \
  --title "Perbaikan Canonical Product Reference OPC" \
  --points "Satukan resolver foto produk Phase 1 dan Regen|Kirim foto canonical hanya pada product clip|Tambah regression matrix dan parity audit"
```

Verifikasi branch `main/local-staging` sesuai workflow repository, tag patch baru, changelog, dan remote GitHub sebelum menyatakan selesai.

## Execution Task List

- [x] Tambahkan test reproduksi v2.14.34: `active_photo` berbeda dari `clean_photo_url` dan bridge di klip 3.
- [x] Normalisasi contract product-reference policy dan effective bridge range.
- [x] Jadikan shared start-frame builder pemilik tunggal canonical product reference OPC.
- [x] Pisahkan context/character references dari product reference.
- [x] Hapus pemakaian `resolveProductBase64()` dari Phase 1 OPC tanpa mengubah consumer non-OPC.
- [x] Hapus pemakaian `resolveProductBase64()` dan perhitungan bridge lokal dari Regen OPC.
- [x] Tambahkan invariant tepat satu product reference pada product clip dan nol pada non-product clip.
- [x] Perkuat audit fingerprint agar merepresentasikan reference yang benar-benar dikirim.
- [x] Ubah unit test menjadi payload matrix dan parity test nyata.
- [x] Ubah integration test menjadi fixture Dev read-only tanpa provider call dan dengan guard schema eksplisit.
- [x] Jalankan unit test dan integration test OPC start-frame.
- [x] Jalankan build Next.js.
- [x] Deploy ke Mac Mini Dev dan lakukan smoke test shared request Phase 1/Regen klip 3 tanpa provider call.
- [x] Verifikasi tidak ada product-reference leakage pada non-bridge clip melalui payload integration test.
- [x] Jalankan release patch non-interaktif dan verifikasi tag/branch remote.

---

# Rencana Implementasi v2.14.36 — Clean Photo sebagai Reference Campaign OPC

## 1. Ringkasan Keputusan

Untuk start frame Product Campaign OPC, istilah **foto produk database** didefinisikan sebagai foto Clean yang ditampilkan dan dikelola oleh pipeline Product Database saat ini. Resolver campaign tidak lagi mengikuti `active_photo` bila field tersebut menunjuk `generated_photo_url` legacy.

Urutan canonical khusus campaign:

```text
clean_photo_url
→ cleaned_photo_url
→ photo_url
→ raw_photo_url
→ fail-closed
```

`generated_photo_url` sengaja tidak menjadi fallback otomatis untuk campaign. Field tersebut adalah aset legacy dan hanya dapat digunakan kembali kelak melalui pilihan operator yang eksplisit, bukan melalui `active_photo` lama.

Perbaikan mempertahankan kontrak v2.14.35:

- hanya bridge/product clip menerima product reference;
- Phase 1 dan Regen memakai builder yang sama;
- gambar dikirim sebagai Base64 Data URI pada `reference_images`;
- tepat satu product reference pada product clip;
- audit tidak menyimpan Base64 atau secret.

## 2. Bukti Reproduksi Item #137

Produk: `Omura Premium Cocoa Powder` (`pe_sync_1781148697786_850`).

```text
active_photo        = generated_photo_url
generated_photo_url = /uploads/products/generated/generated_pe_sync_1781148697786_850.jpg
clean_photo_url     = /uploads/products/default_tenant/clean/clean_default_tenant_pe_sync_1781148697786_850_1786412675863.jpg
photo_url           = sama dengan clean_photo_url
```

Audit v2.14.35 Phase 1 dan Regen klip 3:

```text
reference_source_field = generated_photo_url
reference_sha256       = 98b25fa0f20d96fd811946f3b424b8399ded216221d8592022fbaeb459c14a3c
```

Dengan demikian format Base64 sudah benar, tetapi file yang diubah menjadi Base64 bukan foto Clean yang dilihat operator pada Product Database.

## 3. Scope dan Non-Scope

### Scope

- resolver reference khusus campaign OPC;
- penghapusan override gambar berbasis nama produk pada Mass Production;
- pembuktian SHA file sumber, Base64 payload, dan request outbound;
- regression test dengan kondisi `active_photo=generated_photo_url`;
- Phase 1 dan Regen nyata di Mac Mini Dev menggunakan produk Omura;
- rilis patch setelah hasil visual disetujui.

### Non-Scope

- tidak mengubah pipeline pembuatan foto Raw/Clean;
- tidak menghapus file atau kolom `generated_photo_url`;
- tidak mengubah arti `active_photo` untuk consumer selain campaign OPC;
- tidak memperbaiki PostgreSQL slow-query dalam patch ini;
- tidak deploy Production tanpa perintah manual eksplisit.

## 4. Desain Perbaikan

### 4.1 Resolver campaign dipisahkan dari resolver active-photo umum

Tambahkan resolver bernama eksplisit, misalnya:

```js
resolveCampaignProductReference({ product, fallbackPaths, cwd })
```

Resolver ini hanya memakai kandidat Clean/compatibility/Raw. `resolveActiveProductReference()` tetap tersedia bagi consumer lain agar patch tidak menyebabkan perubahan global tersembunyi.

### 4.2 Product ID menjadi identitas tunggal

Semua pengambilan foto untuk campaign memakai:

```text
campaign.target_product_id
```

Lookup berdasarkan `LOWER(product_name)` dihapus dari jalur foto. Untuk campaign legacy tanpa product ID, request product clip harus gagal dengan error terstruktur, bukan menebak produk berdasarkan nama.

Lookup berdasarkan nama untuk truth metadata dapat dipertahankan sementara bila tidak memengaruhi pemilihan gambar, tetapi harus diberi warning legacy dan tidak boleh menulis `product_ref_image_path`.

### 4.3 Hilangkan side effect `Fix4`

Blok `Fix4` saat ini:

- mencari produk berdasarkan nama;
- menimpa `tempCampaign.product_ref_image_path`;
- memperbarui `pillar_campaigns.product_ref_image_path` selama Phase 1.

Blok tersebut dihapus. Shared builder membaca Product Database berdasarkan ID pada saat request dibuat. `product_ref_image_path` dipertahankan hanya sebagai compatibility fallback untuk campaign legacy non-linked, bukan sumber utama linked product.

### 4.4 Bukti Base64 sampai batas HTTP

Tambahkan helper aman untuk menghitung SHA dari Data URI yang benar-benar berada dalam `reference_images`:

```js
sha256(decodeBase64DataUri(reference_images[0]))
```

Sebelum `fetch('/api/image/generate')`, verifikasi:

```text
payload reference SHA === resolver file SHA
```

Log/audit hanya menyimpan SHA, MIME type, byte length, source field, dan jumlah reference. Isi Base64 tidak boleh dicatat.

Untuk mode queue, metadata SHA yang sama harus ikut pada job metadata/audit agar jalur direct HTTP dan BullMQ dapat dibandingkan tanpa menyimpan payload di database log.

## 5. Rencana Per File — Before dan After

### `lib/product-reference-resolver.js`

**Code Sebelum (Current/Before)**

```js
function photoCandidates(product, fallbackPaths = []) {
  const active = ACTIVE_PHOTO_FIELDS.includes(product?.active_photo)
    ? product[product.active_photo]
    : null;

  return [
    active,
    product?.clean_photo_url,
    product?.cleaned_photo_url,
    product?.generated_photo_url,
    product?.raw_photo_url,
    product?.photo_url,
    ...fallbackPaths
  ];
}
```

**Code Sesudah (Proposed/After)**

```js
function campaignPhotoCandidates(product, fallbackPaths = []) {
  return uniquePaths([
    product?.clean_photo_url,
    product?.cleaned_photo_url,
    product?.photo_url,
    product?.raw_photo_url,
    ...fallbackPaths
  ]);
}

export function resolveCampaignProductReference(options) {
  return resolveReferenceFromCandidates(
    campaignPhotoCandidates(options.product, options.fallbackPaths),
    options.cwd
  );
}
```

Resolver generic `resolveActiveProductReference()` tidak diubah perilakunya untuk consumer lain.

### `lib/opc-start-frame-request.js`

**Code Sebelum (Current/Before)**

```js
const reference = requirement.required
  ? resolveActiveProductReference({
      product,
      fallbackPaths: [campaign?.product_ref_image_path, row.product_ref_image_path],
      cwd
    })
  : null;
```

**Code Sesudah (Proposed/After)**

```js
const reference = requirement.required
  ? resolveCampaignProductReference({
      product,
      fallbackPaths: productId
        ? []
        : [campaign?.product_ref_image_path, row.product_ref_image_path],
      cwd
    })
  : null;

if (requirement.required && !productId) {
  throw new ProductReferenceUnavailableError(
    'Product clip tidak memiliki target_product_id.'
  );
}
```

Linked campaign tidak boleh jatuh ke snapshot path lama apabila record produk canonical tersedia tetapi foto Clean/Raw hilang.

Audit yang diharapkan untuk item #137:

```text
reference_source_field = clean_photo_url
reference_sha256       = SHA file clean_default_tenant_...jpg
product_reference_count = 1
```

### `lib/scheduler-processors.js`

**Code Sebelum (Current/Before)**

```js
const dbImg = await db.prepare(`
  SELECT clean_photo_url, photo_url
  FROM product_extractions
  WHERE LOWER(product_name) = LOWER(?)
  LIMIT 1
`).get(resolvedProductName);

tempCampaign.product_ref_image_path = dbImg.clean_photo_url;
await db.prepare(`
  UPDATE pillar_campaigns
  SET product_ref_image_path = ?
  WHERE id = ?
`).run(dbImg.clean_photo_url, campaign.id);
```

**Code Sesudah (Proposed/After)**

```js
// Tidak ada lookup atau mutation reference image pada processPillarGenerator.
// Shared OPC start-frame builder memuat foto canonical berdasarkan target_product_id.
```

Jika prompt memerlukan nama file reference, metadata tersebut dibaca berdasarkan `target_product_id` tanpa mengubah campaign dan tanpa memasukkan URL lain ke provider payload.

### `lib/webhook-client.js`

**Code Sebelum (Current/Before)**

```js
if (reference_images) body.reference_images = reference_images;

await fetch(`${submitBaseUrl}/api/image/generate`, {
  method: 'POST',
  headers: submitHeaders,
  body: JSON.stringify(body)
});
```

**Code Sesudah (Proposed/After)**

```js
const referenceMetadata = inspectBase64References(reference_images);
if (reference_images?.length) body.reference_images = reference_images;

logSafeReferenceMetadata({
  model: primaryModel,
  referenceCount: referenceMetadata.length,
  referenceSha256s: referenceMetadata.map(ref => ref.sha256),
  referenceByteLengths: referenceMetadata.map(ref => ref.byteLength)
});

await fetch(`${submitBaseUrl}/api/image/generate`, {
  method: 'POST',
  headers: submitHeaders,
  body: JSON.stringify(body)
});
```

Helper wajib menolak Base64 kosong, MIME tidak cocok dengan magic bytes, dan payload yang SHA-nya berbeda dari metadata builder bila expected SHA disediakan.

### `lib/opc-start-frame-audit.js`

**Code Sebelum (Current/Before)**

```js
reference_source_field,
reference_sha256,
request_fingerprint
```

**Code Sesudah (Proposed/After)**

```js
reference_source_field: 'clean_photo_url',
reference_sha256: sourceFileSha256,
payload_reference_sha256: decodedPayloadSha256,
reference_mime_type: 'image/jpeg',
reference_byte_length: decodedPayloadByteLength
```

Jika tidak ingin migrasi tabel pada patch ini, `payload_reference_sha256` diverifikasi runtime dan structured log terlebih dahulu. Yang wajib adalah assertion equality sebelum provider submit.

### `scripts/test-opc-start-frame-reference.mjs`

**Code Sebelum (Current/Before)**

```js
const product = {
  active_photo: 'generated_photo_url',
  generated_photo_url: '/uploads/active.jpg',
  clean_photo_url: '/uploads/old.jpg'
};

assert.equal(built.audit.reference_source_field, 'generated_photo_url');
```

**Code Sesudah (Proposed/After)**

```js
const product = {
  active_photo: 'generated_photo_url',
  generated_photo_url: '/uploads/generated-legacy.jpg',
  clean_photo_url: '/uploads/clean-current.jpg',
  photo_url: '/uploads/clean-current.jpg'
};

assert.equal(built.audit.reference_source_field, 'clean_photo_url');
assert.equal(built.audit.reference_sha256, sha256(cleanCurrentBytes));
assert.deepEqual(
  decodeReferenceImages(built.providerRequest.reference_images),
  [cleanCurrentBytes]
);
assert.notEqual(built.audit.reference_sha256, sha256(generatedLegacyBytes));
```

Matrix tetap wajib:

```text
bridge_at_clip=3, duration=1 → [0, 0, 1, 0]
```

### `scripts/test-opc-start-frame-reference-integration.mjs`

**Code Sebelum (Current/Before)**

```js
assert.equal(initial.audit.reference_source_field, 'generated_photo_url');
assert.equal(initial.audit.reference_sha256, regen.audit.reference_sha256);
```

**Code Sesudah (Proposed/After)**

```js
assert.equal(product.id, 'pe_sync_1781148697786_850');
assert.equal(product.active_photo, 'generated_photo_url');
assert.equal(initial.audit.reference_source_field, 'clean_photo_url');
assert.equal(initial.audit.reference_sha256, sha256(cleanPhotoFile));
assert.equal(initial.audit.reference_sha256, regen.audit.reference_sha256);
assert.deepEqual(initial.providerRequest.reference_images, regen.providerRequest.reference_images);
assert.equal(nonBridge.providerRequest.reference_images, undefined);
```

Integration test tetap wajib dijalankan dengan `PG_SEARCH_PATH=dev` dan tanpa provider call sebelum smoke test visual.

## 6. Tahapan Verifikasi

### 6.1 Automated gate

```bash
npm run test:opc:start-frame-reference
PG_SEARCH_PATH=dev npm run test:opc:start-frame-reference-integration
npm run build
```

Gate gagal bila:

- `generated_photo_url` terpilih pada fixture Omura;
- SHA decoded Base64 berbeda dari SHA file Clean;
- non-bridge clip membawa product reference;
- Phase 1/Regen menghasilkan source atau SHA berbeda;
- Base64/secret masuk log atau audit.

### 6.2 Dev preflight

Sebelum provider call, tampilkan bukti aman:

```text
product_id
clean_photo_url
source_file_sha256
decoded_base64_sha256
MIME
byte_length
bridge clip
```

`source_file_sha256` wajib sama dengan `decoded_base64_sha256`.

### 6.3 Visual end-to-end — wajib sebelum rilis

Gunakan produk Omura pada Mac Mini Dev:

1. Simpan screenshot/preview foto Clean dari Product Database.
2. Jalankan campaign baru dengan bridge klip 3.
3. Pastikan audit outbound klip 3 menunjukkan `clean_photo_url` dan SHA file Clean.
4. Pastikan klip 1, 2, dan 4 memiliki nol product reference.
5. Inspeksi gambar hasil Phase 1 klip 3 terhadap foto Clean.
6. Klik Regen pada klip 3.
7. Pastikan Regen memakai SHA Clean yang sama.
8. Inspeksi gambar hasil Regen terhadap foto Clean.
9. Jangan merilis bila kemasan/label/warna produk masih berbeda secara material.

Jika payload sudah terbukti Clean tetapi output visual masih salah, masalah dipindahkan ke fidelity model/prompt G-Labs. Pada kondisi tersebut jangan mengubah resolver lagi; evaluasi image-edit mode, reference-strength, named subject binding, atau compositing produk sebagai pekerjaan terpisah.

## 7. Rollback dan Rilis

Tidak melakukan rollback penuh ke v2.14.31. Emergency rollback hanya mengembalikan prioritas pemilihan foto Clean pada jalur OPC, sambil mempertahankan bridge guard dan parity v2.14.35.

Rilis hanya setelah automated gate dan visual end-to-end berhasil:

```bash
npm run release-non-interactive -- --type patch \
  --title "Perbaikan Clean Photo Reference OPC" \
  --points "Gunakan foto Clean untuk Base64 campaign|Hapus override foto berbasis nama produk|Verifikasi SHA payload Phase 1 dan Regen"
```

Deploy otomatis hanya ke Mac Mini Dev. Production tetap memerlukan perintah eksplisit pengguna.

## 7A. Temuan Acceptance Test dan Prompt Identity Lock

Phase 1 nyata item #139 membuktikan payload Clean belum cukup: prompt lama masih menyebut file `generated_*` dan memberi deskripsi generik sehingga provider menggambar ulang label produk.

### `lib/opc-start-frame-request.js`

**Code Sebelum (Current/Before)**

```js
providerRequest: { prompt, reference_images: references }
```

**Code Sesudah (Proposed/After)**

```js
const providerPrompt = reference ? lockProductIdentityPrompt(prompt, product) : prompt;
providerRequest: { prompt: providerPrompt, reference_images: references }
```

Lock menyatakan foto terlampir sebagai satu-satunya visual truth, melarang redesign/relabel/substitution, dan membersihkan petunjuk filename legacy `generated_*`.

### `scripts/test-opc-start-frame-reference.mjs`

**Code Sebelum (Current/Before)**

```js
assert.deepEqual(built.providerRequest.expected_reference_sha256s, [payloadMetadata.sha256]);
```

**Code Sesudah (Proposed/After)**

```js
assert.match(built.providerRequest.prompt, /HIGHEST PRIORITY PRODUCT IDENTITY LOCK/);
assert.doesNotMatch(built.providerRequest.prompt, /generated_product-1\.jpg/);
```

## Execution Task List v2.14.36

- [x] Tambahkan regression fixture Omura dengan `active_photo=generated_photo_url` dan Clean yang berbeda.
- [x] Tambahkan resolver `resolveCampaignProductReference()` dengan prioritas Clean → compatibility → Raw.
- [x] Pastikan `generated_photo_url` tidak menjadi fallback otomatis campaign OPC.
- [x] Migrasikan shared OPC builder dari active-photo resolver ke campaign-photo resolver.
- [ ] Tolak linked Product Campaign tanpa `target_product_id` atau tanpa foto Clean/Raw yang valid.
- [x] Hapus blok `Fix4` lookup gambar berdasarkan nama dan mutation `product_ref_image_path`.
- [x] Pastikan metadata truth lookup tidak dapat mengubah pilihan gambar.
- [x] Tambahkan pemeriksaan MIME, byte length, dan SHA decoded Base64 sebelum HTTP/queue submit.
- [x] Pastikan audit/log hanya menyimpan metadata aman, bukan Base64.
- [x] Perbarui unit test matrix dan assertion bahwa bytes payload sama dengan file Clean.
- [x] Perbarui integration test Dev memakai bukti item #137/produk Omura.
- [x] Jalankan unit test, integration test schema Dev, dan build Next.js.
- [x] Deploy v2.14.36 candidate ke Mac Mini Dev.
- [x] Tambahkan product-identity prompt lock dan hapus petunjuk filename `generated_*` setelah Phase 1 nyata membuktikan output masih generik meski payload Clean.
- [x] Ulangi unit test, build, deploy Dev, Phase 1, dan Regen setelah prompt lock.
- [ ] Jalankan Phase 1 nyata dan verifikasi visual klip 3 terhadap foto Clean.
- [x] Jalankan Regen nyata dan verifikasi visual serta SHA terhadap foto Clean yang sama.
- [x] Verifikasi klip non-bridge tidak membawa product reference.
- [x] Jika visual masih salah meski SHA Clean benar, hentikan rilis dan audit fidelity/mode G-Labs.
- [ ] Jika seluruh acceptance test lulus, jalankan release patch dan verifikasi commit/tag/remote.

### Hasil Acceptance Test Dev

- Regen item #137 dengan Clean SHA `2cf934…3502` menghasilkan kemasan Indonesia Powder/BMI yang dikenali dengan benar.
- Phase 1 item #139 sebelum prompt lock memakai SHA Clean yang sama, tetapi menghasilkan sachet generik `PURE UNSWEETENED COCOA POWDER`.
- Regen item #139 setelah prompt lock menghasilkan kemasan Indonesia Powder/BMI yang benar.
- Phase 1 item #141 setelah prompt lock tetap memakai `clean_photo_url` SHA `2cf934…3502`, tetapi menghasilkan desain sachet cokelat/emas bertuliskan Omura yang bukan kemasan database.
- Kesimpulan: transport Base64 dan resolver sudah benar; image-to-image provider bersifat probabilistik dan prompt lock tidak dapat menjadi jaminan fidelity. Release dihentikan. Perbaikan berikutnya harus memakai deterministic product compositing/identity-preserving render, bukan menambah prompt lagi.

### Keputusan Rilis Pengguna

Pada 14 Agustus 2026 pengguna menyetujui rilis perbaikan parsial karena versi ini telah memastikan Phase 1 dan Regen memakai foto Clean yang benar, serta Regen terbukti dapat memperbaiki sebagian output yang tidak sesuai. Known limitation: hasil G-Labs tetap probabilistik dan Regen tidak dijamin benar pada satu percobaan.

# Rencana Implementasi v2.14.36-R2 — Deterministic Product Compositing (DIBATALKAN)

> **Status: DIBATALKAN atas instruksi pengguna. Seluruh isi seksi ini tidak boleh dieksekusi dan bukan lagi rencana aktif.**

## 1. Sasaran dan Keputusan Arsitektur

Untuk setiap klip bridge/product OPC, G-Labs tidak lagi bertanggung jawab menggambar identitas produk. G-Labs hanya menghasilkan **background plate** tanpa kemasan, label, logo, atau objek produk. Setelah plate selesai diunduh, MAKNA menempelkan cutout yang berasal langsung dari `clean_photo_url` secara lokal menggunakan `sharp`.

```text
Foto Clean database
  → verifikasi MIME + SHA
  → background removal menjadi cutout PNG transparan
  → validasi alpha/bounding box
  → cache berdasarkan source SHA
                                     ┌─ non-bridge → output G-Labs apa adanya
Prompt scene → G-Labs background ────┤
                                     └─ bridge → composite cutout produk → final start frame
```

Konsekuensi desain:

- output bridge tidak pernah menyimpan produk hasil imajinasi provider;
- label, warna, logo, dan artwork berasal dari piksel foto Clean;
- Phase 1, single Regen, bulk/durable Regen, recovery, dan worker memakai finalizer yang sama;
- bila cutout tidak valid, sistem **fail-closed** dan tidak mengganti start frame lama dengan hasil generik;
- compositing hanya berlaku pada clip yang ditentukan `resolveProductReferenceRequirement()`;
- non-bridge tetap menggunakan background plate tanpa product overlay;
- Production tidak disentuh sampai acceptance Dev lulus.

## 2. Strategi Visual Deterministik

### 2.1 Cutout produk

Foto Clean saat ini berupa JPEG berlatar putih karena `createCleanProductShot()` melakukan `flatten()`. Pipeline baru tidak mengubah foto Clean tersebut. Ia membuat aset turunan transparan:

```text
public/uploads/products/cutouts/<tenant>/<product-id>_<source-sha-12>.png
```

Urutan cutout:

1. baca hanya file yang sudah dipilih `resolveCampaignProductReference()`;
2. hitung dan cocokkan SHA sumber;
3. jalankan `@imgly/background-removal-node` menjadi RGBA PNG tanpa `flatten()`;
4. trim area transparan dengan padding aman 2–3%;
5. validasi bahwa empat sudut transparan, bounding box produk masuk batas wajar, dan opaque coverage tidak kosong/seluas kanvas;
6. simpan secara atomik ke cache berdasarkan SHA;
7. bila cache tersedia, validasi manifest sebelum digunakan kembali.

Tidak menggunakan penghapusan warna putih berbasis threshold karena bagian kemasan Omura berwarna putih/silver dan dapat ikut hilang.

### 2.2 Background plate G-Labs

Untuk product clip, shared builder mengubah prompt menjadi scene-only:

```text
Generate the requested environment as a clean background plate.
Reserve an unobstructed product stage in the center-lower area.
Do not generate packaging, sachets, labels, logos, text, hands in front
of the product stage, or any substitute product.
```

Reference foto produk tidak perlu dikirim ke G-Labs pada mode composite karena provider tidak lagi diminta menggambar produk. Foto Clean tetap dibaca dan di-hash sebelum submit untuk mengunci composition contract. Context reference non-produk, misalnya karakter cartoon, tetap dapat dikirim sesuai kontraknya.

### 2.3 Placement dan render

Preset awal: `center_tabletop_v1`.

- output dinormalisasi ke resolusi aspect ratio campaign, default 1080×1920 untuk 9:16;
- background plate memakai `cover` tanpa distorsi;
- cutout memakai `contain`, maksimal 52% lebar dan 58% tinggi frame;
- pusat horizontal 50%; baseline produk 84% tinggi frame;
- shadow dibuat dari alpha cutout yang diblur dan ditempatkan **di belakang** produk;
- cutout produk ditaruh paling akhir sehingga tidak dapat ditimpa tangan/objek generatif;
- output PNG ditulis ke file sementara lalu atomic rename;
- file G-Labs mentah disimpan sebagai diagnostic plate dengan retention terbatas, bukan sebagai `t2i_images_json` final.

Versi preset dan seluruh koordinat masuk composition audit sehingga hasil dapat direproduksi.

## 3. Perubahan File

### 3.1 `lib/opc-product-compositor.js` — file baru

**Code Sebelum (Current/Before)**

```js
// Belum ada finalizer produk deterministik.
// Call site langsung fs.writeFileSync(startFrameLocalPath, imgBuffer).
```

**Code Sesudah (Proposed/After)**

```js
export async function finalizeOpcStartFrame({
  campaign, item, clipIndex, backgroundBuffer, outputPath, origin
}) {
  const requirement = resolveProductReferenceRequirement({ campaign, item, clipIndex });
  if (!requirement.required) return writeBackgroundAtomically(backgroundBuffer, outputPath);

  const source = await resolveRequiredCampaignProductSource(campaign);
  const cutout = await getOrCreateProductCutout(source);
  const result = await compositeProductPlate({
    backgroundBuffer,
    cutoutPath: cutout.path,
    preset: 'center_tabletop_v1'
  });
  await writeAtomically(outputPath, result.buffer);
  await recordCompositionAudit({ ...result.audit, origin, clipIndex });
  return result;
}
```

Modul ini menjadi satu-satunya tempat yang boleh memfinalisasi start frame OPC. Ia menangani normalisasi orientasi, cutout cache, alpha validation, resize, shadow, composite, hash, atomic write, dan fail-closed.

### 3.2 `lib/opc-start-frame-request.js`

**Code Sebelum (Current/Before)**

```js
const providerPrompt = reference ? lockProductIdentityPrompt(prompt, product) : prompt;
providerRequest: {
  prompt: providerPrompt,
  reference_images: reference ? [reference.base64DataUrl] : undefined
}
```

**Code Sesudah (Proposed/After)**

```js
const composition = requirement.required
  ? buildProductCompositionContract({ product, reference, preset: 'center_tabletop_v1' })
  : null;
const providerPrompt = composition
  ? buildBackgroundPlatePrompt(prompt, composition.preset)
  : prompt;

return {
  providerRequest: {
    prompt: providerPrompt,
    reference_images: contextReferences.length ? contextReferences : undefined
  },
  composition,
  audit
};
```

Product Data URI tidak lagi dikirim ke image generator pada composite mode. Contract tetap membawa source path, SHA, MIME, product ID, dan preset secara internal untuk finalizer; data ini tidak dimasukkan ke HTTP body G-Labs.

### 3.3 `lib/bg-remover.js`

**Code Sebelum (Current/Before)**

```js
await sharp(transparentBuffer)
  .flatten({ background: { r: 255, g: 255, b: 255 } })
  .jpeg({ quality: 90 })
  .toFile(finalOutputPath);
```

**Code Sesudah (Proposed/After)**

```js
export async function createTransparentProductCutout(inputBuffer) {
  const transparentBlob = await removeBackground(toImageBlob(inputBuffer), { model: 'medium' });
  return sharp(Buffer.from(await transparentBlob.arrayBuffer()))
    .ensureAlpha()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}
```

Fungsi Clean lama tetap kompatibel. Fungsi baru tidak melakukan flatten dan tidak mengeksekusi command string dari input yang tidak tervalidasi.

### 3.4 `lib/scheduler-processors.js`

**Code Sebelum (Current/Before)**

```js
const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
fs.writeFileSync(startFrameLocalPath, imgBuffer);
t2iImagePaths[c - 1] = relativeStartFramePath;
```

**Code Sesudah (Proposed/After)**

```js
const backgroundBuffer = Buffer.from(await imgResponse.arrayBuffer());
await finalizeOpcStartFrame({
  campaign: tempCampaign,
  item,
  clipIndex: c,
  backgroundBuffer,
  outputPath: startFrameLocalPath,
  origin: 'phase_1_initial'
});
t2iImagePaths[c - 1] = relativeStartFramePath;
```

Semua write path OPC—sequential, threading, production recovery, dan jalur kompatibilitas—wajib dialihkan. Write path RE/IFC tidak diubah.

### 3.5 `app/api/v2/pillar-campaigns/items/[itemId]/regenerate-t2i/route.js`

**Code Sebelum (Current/Before)**

```js
const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
fs.writeFileSync(startFrameLocalPath, imgBuffer);
```

**Code Sesudah (Proposed/After)**

```js
const backgroundBuffer = Buffer.from(await imgResponse.arrayBuffer());
await finalizeOpcStartFrame({
  campaign, item, clipIndex, backgroundBuffer,
  outputPath: startFrameLocalPath,
  origin: 'manual_regen'
});
```

Database hanya di-update setelah composite dan audit berhasil. Jika cutout/composite gagal, endpoint mengembalikan error terstruktur dan mempertahankan file serta URL start frame sebelumnya.

### 3.6 `app/api/v2/pillar-campaigns/items/[itemId]/regenerate-start-frames/route.js`

**Code Sebelum (Current/Before)**

```js
request: { prompt, model, aspect_ratio, webhookOverride }
```

**Code Sesudah (Proposed/After)**

```js
request: {
  context: { campaignId: campaign.id, itemId: item.id, clipIndex, prompt, origin: 'bulk_regen' }
}
```

Durable Regen tidak lagi melewati shared builder. Snapshot contract yang aman disimpan dalam `request_json`; Base64 dan API key tidak disimpan di tabel antrean.

### 3.7 `lib/start-frame-provider-adapter.js` dan `lib/start-frame-worker.js`

**Code Sebelum (Current/Before)**

```js
await fs.writeFile(path.join(directory, filename), providerBuffer);
```

**Code Sesudah (Proposed/After)**

```js
const backgroundBuffer = Buffer.from(await response.arrayBuffer());
await finalizeOpcStartFrame({
  campaign, item, clipIndex: asset.clip_index,
  backgroundBuffer, outputPath, origin: 'bulk_regen'
});
```

Adapter mengembalikan task metadata tanpa secret. Worker memuat campaign/item dalam tenant context, memfinalisasi composite, baru kemudian menandai asset `completed`.

### 3.8 `lib/db-pg.js` dan `lib/opc-start-frame-composition-audit.js` — file audit baru

**Code Sebelum (Current/Before)**

```sql
-- Audit request hanya membuktikan payload/provider request.
```

**Code Sesudah (Proposed/After)**

```sql
CREATE TABLE IF NOT EXISTS opc_start_frame_composition_audits (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_item_id TEXT NOT NULL,
  clip_index INTEGER NOT NULL,
  origin TEXT NOT NULL,
  source_sha256 TEXT NOT NULL,
  cutout_sha256 TEXT NOT NULL,
  background_sha256 TEXT NOT NULL,
  output_sha256 TEXT NOT NULL,
  preset_version TEXT NOT NULL,
  placement_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

Audit tidak menyimpan Base64, gambar, filesystem absolut, prompt penuh, atau credential.

### 3.9 Test baru dan pembaruan test

File:

- `scripts/test-opc-product-compositor.mjs` — baru;
- `scripts/test-opc-start-frame-reference.mjs`;
- `scripts/test-opc-start-frame-reference-integration.mjs`.

**Code Sebelum (Current/Before)**

```js
assert.deepEqual(providerRequest.expected_reference_sha256s, [cleanSha]);
```

**Code Sesudah (Proposed/After)**

```js
assert.equal(built.composition.source_sha256, cleanSha);
assert.equal(built.providerRequest.reference_images, undefined);
assert.equal(composite.audit.source_sha256, cleanSha);
assert.equal(composite.audit.preset_version, 'center_tabletop_v1');
assertProductPixelsDerivedFromCutout(composite.output, composite.cutout, composite.placement);
```

Fixture mencakup Omura, non-bridge, landscape/portrait background, cache hit, cache korup, cutout invalid, atomic-write failure, single Regen, bulk Regen, dan Phase 1 parity.

## 4. Failure Handling dan Rollback

### Fail-closed

- foto Clean/Raw tidak ditemukan → `PRODUCT_REFERENCE_UNAVAILABLE`;
- background removal gagal → `PRODUCT_CUTOUT_FAILED`;
- alpha/bounding box tidak valid → `PRODUCT_CUTOUT_INVALID`;
- composite gagal → `PRODUCT_COMPOSITE_FAILED`;
- output tidak memiliki audit source/cutout/output SHA → jangan update database;
- start frame lama tidak dihapus atau ditimpa sampai file baru selesai dan lolos validasi.

### Feature flag

Tambahkan tenant setting:

```text
opc_product_composite_mode = off | shadow | enforce
```

- `off`: rollback operasional ke perilaku lama tanpa menghapus kode;
- `shadow`: menghasilkan composite diagnostic tetapi UI masih memakai output lama, khusus verifikasi awal;
- `enforce`: composite menjadi satu-satunya output bridge yang boleh disimpan.

Dev dimulai dari `shadow`, lalu `enforce` setelah fixture Omura lulus. Release harus memakai default `enforce` untuk product campaign dan `off` untuk non-product campaign.

## 5. Acceptance Criteria

### Automated

1. Hanya clip bridge mempunyai composition contract.
2. Provider request bridge tidak membawa product Base64 dan prompt melarang provider membuat produk.
3. Source SHA audit sama dengan SHA `clean_photo_url` database.
4. Cutout cache key berubah ketika foto Clean berubah.
5. Output final mengandung cutout yang sama pada placement yang tercatat.
6. Phase 1, single Regen, bulk Regen, worker retry, dan production recovery menghasilkan finalizer fingerprint yang sama.
7. Non-bridge output byte-identical dengan normalized provider plate dan tidak memiliki composition audit.
8. Kegagalan cutout/composite mempertahankan start frame lama.
9. Tidak ada Base64/secret di log, DB audit, atau durable `request_json`.

### Visual Dev — Omura

1. Gunakan campaign `opc_260814_kwngx7` dan produk `pe_sync_1781148697786_850`.
2. Bandingkan foto Clean, cached cutout, raw G-Labs plate, dan final composite secara berdampingan.
3. Final clip 3 harus mempertahankan logo Indonesia Powder, panel BMI, ilustrasi cocoa, warna silver/cokelat, serta geometri kemasan.
4. Background plate tidak boleh berisi produk generik atau teks kemasan lain.
5. Produk tidak boleh tertutup tangan/objek dan tidak boleh tampak melayang; shadow harus konsisten.
6. Phase 1 dan Regen boleh memiliki background berbeda, tetapi cutout produk dan placement preset harus sama.
7. Clip 1, 2, dan 4 tidak boleh memuat overlay produk.

## 6. Urutan Rilis

1. Implementasi dan unit test lokal.
2. Integration test schema Dev.
3. Deploy candidate ke Mac Mini Dev dengan mode `shadow`.
4. Periksa empat artefak Omura dan composition audit.
5. Ubah Dev ke `enforce`, jalankan Phase 1 serta single/bulk Regen nyata.
6. Jalankan build dan cluster health check.
7. Hanya bila seluruh acceptance lulus, jalankan patch release non-interaktif dan deploy ulang Dev.
8. Staging/Production tidak dideploy tanpa instruksi pengguna; Production tetap memerlukan persetujuan eksplisit.

## Execution Task List — Deterministic Product Compositing

- [ ] Tambahkan setting `opc_product_composite_mode` dengan nilai `off|shadow|enforce`.
- [ ] Implementasikan transparent cutout tanpa flatten dan cache berdasarkan source SHA.
- [ ] Tambahkan alpha, bounding-box, MIME, dan cache-manifest validation.
- [ ] Implementasikan `finalizeOpcStartFrame()` dengan preset `center_tabletop_v1`, shadow, hash, dan atomic write.
- [ ] Ubah shared request builder agar product clip meminta background plate dan membawa internal composition contract.
- [ ] Pastikan product Base64 tidak lagi dikirim ke G-Labs pada composite mode.
- [ ] Migrasikan Phase 1 sequential dan threading ke shared finalizer.
- [ ] Migrasikan production recovery/compatibility write path OPC ke shared finalizer.
- [ ] Migrasikan single Regen ke shared finalizer dan pertahankan file lama saat gagal.
- [ ] Perbaiki bulk/durable Regen agar membawa campaign/item context tanpa Base64/secret.
- [ ] Migrasikan start-frame worker ke shared finalizer dalam tenant context.
- [ ] Tambahkan composition audit table dan safe audit writer.
- [ ] Tambahkan unit fixture Omura dan test pixel provenance/placement.
- [ ] Tambahkan test cache hit, cache invalid, cutout invalid, dan atomic rollback.
- [ ] Tambahkan parity test Phase 1, single Regen, bulk Regen, recovery, dan worker.
- [ ] Jalankan unit test, integration test Dev, dan Next.js build.
- [ ] Deploy candidate ke Mac Mini Dev dalam mode `shadow`.
- [ ] Verifikasi foto Clean, cutout, raw plate, final composite, dan seluruh SHA audit Omura.
- [ ] Aktifkan mode `enforce` di Dev dan jalankan Phase 1 nyata.
- [ ] Jalankan single Regen dan bulk Regen nyata di Dev.
- [ ] Verifikasi klip non-bridge tidak mempunyai overlay produk.
- [ ] Jalankan cluster health check.
- [ ] Jika seluruh acceptance lulus, release patch dan verifikasi commit/tag/remote.

---

# Implementation Plan — Perbaikan FFprobe Preflight Facebook Reel di Mac Mini Staging

## 1. Ringkasan Masalah

Preflight Facebook Reel gagal di Mac Mini Staging dengan `ENOENT` karena `lib/publishing-media-probe.js` mengeksekusi `ffprobe.path` secara langsung. Saat dibundel oleh Next.js, nilai tersebut mengarah ke:

```text
/Users/masbenu/maknaflow-staging/.next/server/chunks/bin/darwin/arm64/ffprobe
```

Pemeriksaan server membuktikan path hasil bundling itu tidak ada, sedangkan dua binary yang valid tersedia:

```text
/opt/homebrew/bin/ffprobe
/Users/masbenu/maknaflow-staging/node_modules/ffprobe-static/bin/darwin/arm64/ffprobe
```

Perbaikan harus membuat resolusi binary independen dari struktur internal `.next`, fail-fast dengan pesan yang jelas, dan dipakai konsisten oleh seluruh pemrosesan media.

## 2. Ruang Lingkup

1. Tambahkan resolver FFprobe bersama yang dapat diuji tanpa melakukan spawn.
2. Gunakan resolver pada preflight Publishing Scheduler.
3. Hilangkan resolver duplikat dari Video Studio dan Smart Sync.
4. Tetapkan `FFPROBE_PATH=/opt/homebrew/bin/ffprobe` secara eksplisit pada PM2 Mac Mini.
5. Tambahkan regression test untuk urutan fallback dan kasus path `.next` hilang.
6. Verifikasi lokal, deploy Dev, lalu deploy Staging dan ulangi preflight Facebook Reel.

Perubahan tidak mencakup algoritma validasi metadata Reel, lifecycle Meta Publishing API, maupun instalasi ulang FFmpeg.

## 3. Rancangan Perubahan per File

### 3.1 `lib/ffprobe-path.js` — file baru

**Code Sebelum (Current/Before)**

```js
// Belum ada resolver FFprobe bersama.
// Setiap modul menentukan path sendiri atau memakai ffprobe.path langsung.
```

**Code Sesudah (Proposed/After)**

```js
import fs from 'node:fs';
import path from 'node:path';
import ffprobe from 'ffprobe-static';

export function resolveFfprobePath({
  envPath = process.env.FFPROBE_PATH,
  platform = process.platform,
  arch = process.arch,
  cwd = process.cwd(),
  staticPath = ffprobe.path,
  existsSync = fs.existsSync
} = {}) {
  const executable = platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
  const candidates = [
    envPath,
    platform === 'darwin' && arch === 'arm64' ? '/opt/homebrew/bin/ffprobe' : null,
    path.join(cwd, 'node_modules', 'ffprobe-static', 'bin', platform, arch, executable),
    staticPath
  ].filter(Boolean);

  const resolved = candidates.find(candidate => existsSync(candidate));
  if (!resolved) throw new Error(`FFprobe binary tidak ditemukan. Kandidat: ${candidates.join(', ')}`);
  return resolved;
}
```

Implementasi final juga menormalisasi path virtual `/ROOT`, membuang kandidat duplikat, dan memvalidasi bahwa target merupakan file yang dapat dieksekusi. `FFPROBE_PATH` yang diisi tetapi invalid harus menghasilkan error konfigurasi eksplisit, bukan diam-diam memakai binary lain.

### 3.2 `lib/publishing-media-probe.js`

**Code Sebelum (Current/Before)**

```js
import ffprobe from 'ffprobe-static';

const { stdout } = await execFileAsync(ffprobe.path, [
  '-v', 'error',
  // ...
]);
```

**Code Sesudah (Proposed/After)**

```js
import { resolveFfprobePath } from './ffprobe-path.js';

const ffprobePath = resolveFfprobePath();
const { stdout } = await execFileAsync(ffprobePath, [
  '-v', 'error',
  // ...
]);
```

Resolver dipanggil ketika probe dijalankan sehingga perubahan environment pada startup/test dapat terbaca, dan error menyebut masalah konfigurasi FFprobe tanpa mengekspos data sensitif.

### 3.3 `lib/video-studio-processor.js`

**Code Sebelum (Current/Before)**

```js
function getFfprobePath() {
  if (process.env.FFPROBE_PATH) return process.env.FFPROBE_PATH;
  // Homebrew, /ROOT, dan node_modules fallback lokal...
}

const ffprobePath = getFfprobePath();
ffmpeg.setFfprobePath(ffprobePath);
```

**Code Sesudah (Proposed/After)**

```js
import { resolveFfprobePath } from './ffprobe-path.js';

ffmpeg.setFfprobePath(resolveFfprobePath());
```

Perilaku existing dipertahankan, tetapi sumber resolusi menjadi satu dan konsisten dengan preflight.

### 3.4 `lib/smart-sync-engine.js`

**Code Sebelum (Current/Before)**

```js
function getFfprobePath() {
  // Resolver kedua yang menduplikasi Video Studio.
}

ffmpeg.setFfprobePath(getFfprobePath());
```

**Code Sesudah (Proposed/After)**

```js
import { resolveFfprobePath } from './ffprobe-path.js';

ffmpeg.setFfprobePath(resolveFfprobePath());
```

### 3.5 `ecosystem.macmini.config.cjs`

**Code Sebelum (Current/Before)**

```js
env_staging: {
  NODE_ENV: 'production',
  APP_ENV: 'staging',
  // FFPROBE_PATH belum ditetapkan.
}
```

**Code Sesudah (Proposed/After)**

```js
env_staging: {
  NODE_ENV: 'production',
  APP_ENV: 'staging',
  FFPROBE_PATH: '/opt/homebrew/bin/ffprobe',
}
```

Nilai yang sama ditambahkan pada environment UI Dev Mac Mini karena route preflight berjalan di proses Next.js UI. API process dapat diberi nilai yang sama untuk konsistensi, tetapi bukan dependency langsung route tersebut.

### 3.6 `tests/ffprobe-path.test.js` — file baru

**Code Sebelum (Current/Before)**

```js
// Belum ada regression test untuk resolusi binary FFprobe.
```

**Code Sesudah (Proposed/After)**

```js
test('memprioritaskan FFPROBE_PATH yang valid', () => { /* ... */ });
test('memakai Homebrew arm64 pada Mac Mini', () => { /* ... */ });
test('fallback ke ffprobe-static dalam node_modules', () => { /* ... */ });
test('tidak memilih path .next yang tidak ada', () => { /* ... */ });
test('gagal dengan pesan diagnostik jika binary tidak ditemukan', () => { /* ... */ });
```

Test menggunakan dependency injection `existsSync` sehingga tidak bergantung pada OS mesin test dan tidak menjalankan proses eksternal.

### 3.7 `tests/publishing-scheduler.test.js`

**Code Sebelum (Current/Before)**

```js
test('Facebook Reels preflight validates official media constraints', () => {
  // Hanya menguji hasil validasi metadata.
});
```

**Code Sesudah (Proposed/After)**

```js
test('Facebook Reels preflight validates official media constraints', () => {
  // Validasi metadata tetap dipertahankan.
});

test('publishing media probe memakai resolver FFprobe, bukan path bundle Next.js', async () => {
  // Spawn/invoker diinjeksi atau dimock dan path executable diverifikasi.
});
```

Jika injeksi executor ke `probePublishingMedia` membuat API produksi lebih kompleks, assertion integrasi diletakkan seluruhnya pada `tests/ffprobe-path.test.js` dan test scheduler tetap tidak diubah.

## 4. Strategi Error Handling

- `FFPROBE_PATH` terkonfigurasi tetapi tidak valid: preflight gagal dengan pesan konfigurasi yang spesifik.
- Homebrew tidak tersedia: resolver mencoba binary paket `ffprobe-static` berdasarkan platform/architecture runtime.
- Path `ffprobe-static` hasil bundling menunjuk `.next/server/chunks` tetapi file tidak ada: kandidat ditolak sebelum `spawn`, lalu resolver menggunakan kandidat valid lain atau memberi error diagnostik.
- Timeout dan kegagalan membaca URL media tetap memakai mekanisme preflight yang sekarang.
- Tidak ada penyalinan binary manual ke `.next`, karena direktori tersebut merupakan output build yang tidak stabil.

## 5. Acceptance Criteria

1. Unit test resolver dan Publishing Scheduler lulus.
2. `npm run build` berhasil tanpa error baru terkait FFprobe.
3. Setelah deploy Dev, proses PM2 menerima `FFPROBE_PATH=/opt/homebrew/bin/ffprobe`.
4. Preflight Facebook Reel Dev berhasil membaca codec, audio, dimensi, durasi, dan frame rate.
5. Setelah deploy Staging, tidak ada lagi spawn ke `.next/server/chunks/bin/darwin/arm64/ffprobe`.
6. Preflight Staging menggunakan `/opt/homebrew/bin/ffprobe` dan mengembalikan hasil validasi metadata.
7. PM2 Staging UI/API tetap online dan endpoint UI/API memberi HTTP 200.
8. Video Studio dan Smart Sync tetap dapat membaca metadata setelah memakai resolver bersama.

## 6. Urutan Implementasi dan Rilis

1. Implementasikan resolver bersama dan unit test.
2. Migrasikan preflight, Video Studio, dan Smart Sync ke resolver bersama.
3. Tambahkan environment FFprobe pada konfigurasi PM2 Mac Mini.
4. Jalankan targeted test, test scheduler, dan build.
5. Deploy ke Mac Mini Dev, verifikasi environment PM2 dan lakukan preflight nyata.
6. Jalankan release patch non-interaktif sesuai SOP repo.
7. Deploy ke Mac Mini Staging setelah Dev lulus.
8. Ulangi preflight Facebook Reel di Staging dan periksa log PM2 serta health endpoint.
9. Production tidak disentuh tanpa instruksi eksplisit pengguna.

## Execution Task List — FFprobe Preflight Mac Mini

- [x] Tambahkan `lib/ffprobe-path.js` dengan urutan resolver yang deterministik.
- [x] Validasi `FFPROBE_PATH` dan executable candidate secara fail-fast.
- [x] Tangani path virtual `/ROOT` dan path bundle `.next` yang hilang.
- [x] Ubah `lib/publishing-media-probe.js` memakai resolver bersama.
- [x] Migrasikan `lib/video-studio-processor.js` ke resolver bersama.
- [x] Migrasikan `lib/smart-sync-engine.js` ke resolver bersama.
- [x] Tambahkan `FFPROBE_PATH` pada environment PM2 Mac Mini Staging dan Dev.
- [x] Tambahkan regression test resolver FFprobe.
- [x] Tambahkan atau sesuaikan test integrasi Publishing Scheduler bila diperlukan.
- [x] Jalankan targeted unit test dan `tests/publishing-scheduler.test.js`.
- [x] Jalankan Next.js production build.
- [x] Deploy ke Mac Mini Dev dan verifikasi resolver FFprobe runtime, PM2, serta health endpoint.
- [ ] Jalankan preflight Facebook Reel nyata melalui sesi pengguna Dev.
- [x] Perbarui checklist ini setelah setiap tahap selesai.
- [x] Jalankan patch release non-interaktif dan verifikasi commit/tag/remote.
- [ ] Deploy ke Mac Mini Staging.
- [ ] Verifikasi PM2, UI 5010, API 7010, dan path FFprobe runtime.
- [ ] Jalankan ulang preflight Facebook Reel Staging sampai metadata berhasil dibaca.
- [x] Pastikan Production tidak dideploy tanpa instruksi eksplisit.

---

# Implementation Plan — Tenant-Safe OPC Product Ingest dan Repair `opc_260815_ir4y96`

## 1. Tujuan

1. Memperbaiki bug Planner → OPC yang mengabaikan `planner.product_id` lalu memilih produk bernama sama dari tenant lain.
2. Menjadikan tenant/product/binding validation sebagai syarat wajib sebelum campaign Product OPC dibuat.
3. Menyamakan perilaku Phase 1, single Regen, dan durable/bulk Regen agar selalu memakai canonical product reference builder.
4. Memperbaiki data campaign Staging `opc_260815_ir4y96` secara transaksional dan dapat diaudit.
5. Meregenerasi hanya bridge clip 3 yang invalid, tanpa mengulang clip 1, 2, dan 4.

## 2. Fakta Audit dan Target Repair

Data valid:

```text
Campaign tenant       : default_tenant
Campaign              : opc_260815_ir4y96
Planner               : pln_65839439
Planner product_id    : pe_sync_1781148697786_165
Brand Profile         : df382ce8-2145-4464-ae63-79375ff3aff2 (dapurbotani)
Brand-product binding : 8c4e2a22-f880-4970-8d37-ff69b0026c55 (aktif)
Foto Clean            : /uploads/products/clean/clean_pe_sync_1781148697786_165.jpg
```

Data campaign yang salah:

```text
target_product_id     : 292f7423-9096-45b8-bf74-07273d02171a
product tenant        : tnt_sy-dodot_4ba27b
campaign bindings     : tidak ada
```

Semua item `371–382` harus dianggap belum mempunyai bridge clip 3 yang terbukti valid. Item `372–382` gagal membuat clip 3; item `371` mempunyai hasil durable regen tanpa audit canonical product reference sehingga clip 3 revision tersebut juga harus diganti.

## 3. Perubahan Kode

### 3.1 `lib/pillar-campaign-ingest.js`

**Code Sebelum (Current/Before)**

```js
const explicitProductId = globalSettings.target_product_id || null;
let targetProdId = explicitProductId || (!isEditorial ? planner.target_product_id : null) || null;

if (targetProdId) {
  product = await db.prepare('SELECT * FROM product_extractions WHERE id = ?').get(targetProdId);
} else if (!isEditorial && planner.product_name) {
  product = await db.prepare(
    'SELECT * FROM product_extractions WHERE LOWER(product_name) = LOWER(?) LIMIT 1'
  ).get(planner.product_name);
}
```

**Code Sesudah (Proposed/After)**

```js
const tenantId = planner.tenant_id || getActiveTenantId();
const explicitProductId = globalSettings.target_product_id || null;
let targetProdId = explicitProductId || (!isEditorial ? planner.product_id : null) || null;

if (targetProdId) {
  product = await getProductById(targetProdId);
  if (!product) {
    throw new PillarCampaignIngestError(
      'Produk Planner tidak ditemukan pada tenant aktif.',
      422,
      'OPC_PRODUCT_TENANT_MISMATCH'
    );
  }
} else if (!isEditorial && planner.product_name) {
  product = await db.prepare(
    'SELECT * FROM product_extractions WHERE tenant_id = ? AND LOWER(product_name) = LOWER(?) LIMIT 1'
  ).get(tenantId, planner.product_name);
}
```

Tambahkan invariant sebelum `createPillarCampaignBundle()`:

```js
assertOpcProductLineage({ tenantId, planner, brandProfile, product, brandProductBinding });
```

Untuk Product Campaign, kegagalan `campaign_product_bindings` menjadi fatal dan transaksi pembuatan bundle dibatalkan. Tidak boleh lagi hanya dicatat sebagai `[OPC Ingest Binding Warning]`.

### 3.2 `lib/opc-product-lineage.js` — file baru

**Code Sebelum (Current/Before)**

```js
// Belum ada satu validator canonical untuk tenant lineage OPC.
```

**Code Sesudah (Proposed/After)**

```js
export async function resolveAndValidateOpcProductLineage({
  planner,
  explicitProductId,
  brandProfileId
}) {
  const tenantId = getActiveTenantId();
  const productId = explicitProductId || planner.product_id;
  const product = await getProductById(productId);
  if (!product) throw new OpcProductTenantMismatchError(productId, tenantId);

  const brand = await getBrandProfileByTenant(brandProfileId, tenantId);
  const binding = await getActiveBrandProduct({ tenantId, brandProfileId, productId });
  if (!brand || !binding) throw new OpcProductBindingUnavailableError();

  return { tenantId, product, brand, binding };
}
```

Validator tidak melakukan fallback lintas tenant dan tidak memilih produk hanya berdasarkan nama jika `planner.product_id` tersedia.

### 3.3 `app/api/v2/pillar-campaigns/items/[itemId]/regenerate-t2i/route.js`

**Code Sebelum (Current/Before)**

```js
} catch (error) {
  return NextResponse.json({ success: false, error: error.message }, { status: 500 });
}
```

**Code Sesudah (Proposed/After)**

```js
} catch (error) {
  return NextResponse.json({
    success: false,
    code: error.code || 'OPC_REGEN_FAILED',
    error: error.message
  }, { status: error.status || 500 });
}
```

Setelah file berhasil disimpan, route juga memanggil `recordCompletedStartFrameAsset()` agar single Regen mempunyai checkpoint asset yang sama dengan worker durable.

### 3.4 `app/api/v2/pillar-campaigns/items/[itemId]/regenerate-start-frames/route.js`

**Code Sebelum (Current/Before)**

```js
request: {
  prompt: clip.t2i_prompt,
  model,
  aspect_ratio: campaign.aspect_ratio || '9:16',
  webhookOverride: brandProfile || undefined
}
```

**Code Sesudah (Proposed/After)**

```js
context: {
  campaignId: campaign.id,
  itemId: item.id,
  clipIndex: Number(clip.clip_index),
  prompt: clip.t2i_prompt,
  origin: 'bulk_regen'
}
```

Route menjalankan canonical preflight seluruh context sebelum menulis antrean. Bila clip 3 tidak memiliki reference valid, request ditolak HTTP 422 dan tidak ada revision parsial yang dibuat.

### 3.5 `lib/pillar-start-frame-service.js`

**Code Sebelum (Current/Before)**

```js
await queueStartFrameRevision(itemId, clips);
// Revision selalu menganggap clips.length sebagai seluruh expected asset.
```

**Code Sesudah (Proposed/After)**

```js
await queueStartFrameRevision(itemId, clips, {
  expectedCount: campaign.target_clips_count,
  carryForwardCompleted: true
});
```

Partial repair clip 3 membuat revision baru, menyalin checkpoint clip 1, 2, dan 4 yang valid ke revision tersebut, lalu hanya mengantrekan clip 3. Aggregate tetap `4/4` setelah repair selesai.

### 3.6 `lib/start-frame-provider-adapter.js`

**Code Sebelum (Current/Before)**

```js
const built = context
  ? await buildOpcStartFrameRequest(context)
  : { providerRequest: request, audit: request?.audit || null };
```

**Code Sesudah (Proposed/After)**

```js
if (!request?.context) {
  throw new StartFrameContextRequiredError();
}
const built = await buildOpcStartFrameRequest(resolvedContext);
```

Untuk asset OPC baru, raw provider request tanpa campaign/item context ditolak. Compatibility hanya boleh dipertahankan untuk asset legacy yang sudah memiliki provider task sebelum rilis, bukan submission baru.

### 3.7 `scripts/repair-opc-product-lineage.mjs` — file baru

**Code Sebelum (Current/Before)**

```js
// Tidak ada repair command terkontrol untuk cross-tenant OPC campaign.
```

**Code Sesudah (Proposed/After)**

```bash
node scripts/repair-opc-product-lineage.mjs \
  --schema staging \
  --campaign opc_260815_ir4y96 \
  --expected-old-product 292f7423-9096-45b8-bf74-07273d02171a \
  --new-product pe_sync_1781148697786_165 \
  --dry-run
```

Apply memerlukan flag tambahan eksplisit:

```bash
--apply --confirm-campaign opc_260815_ir4y96
```

Script menggunakan satu transaksi dan `SELECT ... FOR UPDATE`. Script berhenti tanpa perubahan kecuali seluruh assertion berikut benar:

1. schema tepat `staging`;
2. campaign tepat `opc_260815_ir4y96` dan tenant `default_tenant`;
3. old product ID masih sama dengan hasil audit;
4. planner `pln_65839439` memakai `pe_sync_1781148697786_165`;
5. produk baru berada di `default_tenant` dan file Clean valid;
6. Brand Profile dapurbotani berada di tenant yang sama;
7. brand-product binding `8c4e2a22-f880-4970-8d37-ff69b0026c55` masih aktif;
8. item campaign tepat `371–382` dan belum berubah sejak dry-run.

Transaksi apply:

```sql
UPDATE pillar_campaigns
SET target_product_id = 'pe_sync_1781148697786_165',
    product_ref_image_path = '/uploads/products/clean/clean_pe_sync_1781148697786_165.jpg'
WHERE id = 'opc_260815_ir4y96'
  AND tenant_id = 'default_tenant'
  AND target_product_id = '292f7423-9096-45b8-bf74-07273d02171a';
```

Script juga:

- memperbarui `row_creative_payload.product_ref_image_path` hanya untuk 12 item target;
- membuat `campaign_product_bindings` per item menggunakan binding aktif dapurbotani;
- tidak menghapus start frame lama;
- menandai clip 3 lama sebagai superseded melalui revision baru;
- mengantrekan hanya clip 3 dengan canonical context `origin: campaign_data_repair`;
- mencatat snapshot before/after dan ID asset revision baru ke audit output tanpa menyimpan Base64.

### 3.8 Test baru dan pembaruan test

File:

- `scripts/test-opc-product-lineage.mjs` — baru;
- `scripts/test-opc-start-frame-reference.mjs`;
- test route/durable start-frame yang relevan.

**Code Sebelum (Current/Before)**

```js
// Tidak ada fixture dua tenant dengan produk bernama sama.
```

**Code Sesudah (Proposed/After)**

```js
test('planner product_id menang atas lookup nama', ...);
test('fallback nama selalu tenant-scoped', ...);
test('explicit cross-tenant product ditolak sebelum campaign dibuat', ...);
test('binding failure membatalkan seluruh OPC bundle', ...);
test('bulk regen clip bridge selalu membawa satu product reference', ...);
test('partial revision membawa forward clip non-target', ...);
test('single dan bulk regen menghasilkan reference SHA yang sama', ...);
test('repair dry-run tidak mengubah database', ...);
test('repair apply idempotent dan menolak expected-old mismatch', ...);
```

## 4. Prosedur Repair Campaign Staging

1. Pause campaign `opc_260815_ir4y96` agar scheduler tidak membuat percobaan baru selama repair.
2. Ambil snapshot read-only campaign, planner, product, binding, 12 item, asset revision, dan audit reference.
3. Jalankan repair script `--dry-run`; simpan ringkasan jumlah row yang akan berubah.
4. Implementasikan dan verifikasi patch di lokal.
5. Deploy patch ke Mac Mini Dev dan jalankan fixture cross-tenant.
6. Release patch sesuai SOP.
7. Deploy patch ke Mac Mini Staging.
8. Jalankan kembali dry-run dan bandingkan dengan snapshot awal.
9. Jalankan repair `--apply` satu kali dalam transaksi.
10. Pastikan campaign menunjuk produk default dan mempunyai 12 binding item.
11. Jalankan worker untuk revision repair clip 3.
12. Verifikasi setiap item `371–382` mempunyai clip 3 baru dengan:

```text
requires_product_reference = true
requirement_reason          = bridge_range
reference_count             = 1
reference_source_field      = clean_photo_url
reference_sha256            = payload_reference_sha256
origin                      = campaign_data_repair
```

13. Pastikan clip 1, 2, dan 4 tidak berubah checksum.
14. Pastikan seluruh item kembali `start_frame_status=completed`, `4/4`, dan status review konsisten.
15. Resume campaign hanya setelah seluruh acceptance criteria lulus.

## 5. Rollback

- Code rollback melalui revert rilis patch jika regression terjadi.
- Data repair tidak menghapus asset lama; revision sebelum repair tetap tersedia sebagai evidence.
- Sebelum apply, script menyimpan snapshot JSON tanpa secret di lokasi audit terkontrol.
- Jika queue/provider gagal, campaign tetap menunjuk produk default yang benar; hanya revision clip 3 ditandai failed dan dapat diretry.
- Mengembalikan old cross-tenant product ID bukan rollback yang valid. Rollback hanya membatalkan revision baru, bukan memulihkan relasi data yang sudah terbukti salah.

## 6. Acceptance Criteria

1. Planner `pln_65839439` tetap menunjuk `pe_sync_1781148697786_165`.
2. Campaign `opc_260815_ir4y96` menunjuk produk yang sama dan tenant seluruh lineage adalah `default_tenant`.
3. Terdapat binding valid untuk seluruh item `371–382`.
4. Tidak ada lookup produk berdasarkan nama tanpa tenant filter.
5. Cross-tenant explicit product ID ditolak sebelum campaign/item dibuat.
6. Initial, single Regen, bulk Regen, recovery, dan repair memakai builder yang sama.
7. Seluruh clip 3 mempunyai satu Clean reference dan audit SHA yang cocok.
8. Clip 1, 2, dan 4 mempunyai nol product reference dan checksum tidak berubah selama repair.
9. Tidak ada provider submission raw tanpa context.
10. Campaign tidak berada pada `ready_for_review` ketika checkpoint start frame masih partial.
11. Dev test, build, deployment, dan health check lulus sebelum Staging dimutasi.
12. Production tidak disentuh tanpa instruksi eksplisit.

## Execution Task List — OPC Tenant Lineage dan Campaign Repair

- [x] Implementasikan canonical OPC product-lineage validator.
- [x] Ubah ingest agar memakai `planner.product_id`.
- [x] Tenant-scope seluruh fallback lookup produk berdasarkan nama.
- [x] Jadikan product/binding validation fatal sebelum bundle dibuat.
- [x] Tambahkan error code `OPC_PRODUCT_TENANT_MISMATCH` dan `OPC_PRODUCT_BINDING_UNAVAILABLE`.
- [x] Perbaiki single Regen agar mempertahankan HTTP status/error code dan asset checkpoint.
- [x] Ubah bulk Regen menjadi canonical context request.
- [x] Tolak submission OPC durable tanpa context.
- [x] Implementasikan partial revision dengan carry-forward asset non-target.
- [x] Tambahkan regression fixture dua tenant dengan produk bernama sama.
- [x] Tambahkan parity test initial/single/bulk/recovery/repair.
- [x] Implementasikan repair script dengan `--dry-run`, `--apply`, dan confirmation guard.
- [x] Jalankan repair dry-run lokal/fixture.
- [x] Jalankan seluruh targeted test dan Next.js production build.
- [x] Deploy serta verifikasi patch di Mac Mini Dev.
- [x] Jalankan release patch non-interaktif dan verifikasi commit/tag/remote.
- [x] Deploy patch ke Mac Mini Staging setelah Dev lulus.
- [x] Pause campaign `opc_260815_ir4y96` sebelum repair data.
- [x] Ambil snapshot before-repair Staging.
- [x] Jalankan Staging dry-run dan verifikasi expected row count.
- [x] Apply repair transaksional pada campaign `opc_260815_ir4y96`.
- [x] Verifikasi target product dan 12 campaign bindings.
- [x] Antrekan ulang hanya clip 3 item `371–382` dengan canonical context.
- [x] Verifikasi 12 audit SHA clip 3 dan checksum clip non-target.
- [x] Verifikasi seluruh item kembali completed `4/4` dan review state konsisten.
- [x] Resume campaign setelah acceptance criteria lulus.
- [x] Pastikan tidak ada deployment atau mutasi Production.
