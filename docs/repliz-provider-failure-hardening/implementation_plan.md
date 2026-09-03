# Implementation Plan — Hardening Kegagalan Provider Facebook & TikTok via Repliz

## 1. Tujuan

Memperbaiki diagnosis dan pemulihan kegagalan Facebook/TikTok melalui Repliz setelah jalur Google Drive terbukti sehat. Implementasi harus:

1. membedakan masalah permission/account Facebook dari gangguan internal TikTok/Repliz;
2. menerapkan retry berdasarkan jenis error, bukan satu kebijakan untuk semua error;
3. menyimpan detail provider yang aman dan berguna untuk troubleshooting;
4. menyediakan account health dan tindakan reconnect/retry yang jelas;
5. memastikan jumlah eksekusi tidak melampaui `max_attempts`;
6. tetap fail-closed dan tidak pernah kembali mengirim URL Nextcloud ke Repliz.

## 2. Fakta Audit Staging

Audit dilakukan pada 3 September 2026 terhadap tiga job terbaru untuk konten yang sama.

| Platform | Hasil | Media | Error aktual |
|---|---|---|---|
| Instagram | berhasil | Google Drive, `verified` | — |
| Facebook | gagal | Google Drive, `verified` | Graph API `Unsupported get request`, object tidak tersedia/missing permission |
| TikTok | gagal | Google Drive, `verified` | `internal` |

Fakta tambahan:

- Repliz menerima schedule dan menghasilkan `external_schedule_id` untuk ketiga platform.
- Akun Repliz ketiganya dilaporkan `isConnected=true`.
- Facebook Dapur Botani di Repliz menunjuk Page generated ID `1030799026791337`.
- Error Facebook menyebut object ID lain (`2359835624786236`), sehingga kegagalan terjadi di eksekusi Graph API oleh Repliz, bukan saat MAKNA mengunggah media.
- File TikTok dapat diunduh anonim dan berformat MP4 H.264 High, AAC-LC, 720×1280, sekitar 30 fps, 28 detik, 6,4 MB. Tidak ada bukti media rusak.
- Job terbaru memakai URL `drive.google.com`; error lama `403 Restricted by robots.txt` hanya milik job sebelum remediasi Drive.
- Database memperlihatkan `attempt_count` 4–5 walaupun `max_attempts=3`. Ini menunjukkan semantik attempt/off-by-one dan polling provider bercampur.

Kesimpulan: jangan mengubah arsitektur media/Drive untuk error ini. Fokus pada account permission, provider error telemetry, retry policy, dan lifecycle worker.

## 3. Prinsip Desain

### 3.1 Pisahkan tiga jenis aktivitas

```text
execution attempt  = create/retry operasi provider yang dapat menimbulkan side effect
status poll        = GET schedule, read-only, tidak menghabiskan attempt budget
manual retry       = tindakan admin setelah reconnect/konfirmasi
```

`attempt_count` hanya bertambah untuk execution attempt. Polling status tidak boleh menaikkan attempt count.

### 3.2 Kelas error

- `account_action_required`: token, permission, Page/object access, account disconnected. Tidak auto-retry; status `needs_review`.
- `provider_transient`: TikTok/Repliz `internal`, HTTP 429, 5xx, timeout. Auto-retry dengan backoff dan batas tegas.
- `media_invalid`: provider secara eksplisit memberi `invalid_file_upload`/format invalid. Tidak auto-retry; `needs_review`.
- `request_invalid`: payload/parameter invalid. Tidak auto-retry; `failed`.
- `unknown`: jangan retry agresif; satu retry terbatas lalu `needs_review` atau langsung `needs_review` sesuai bukti.

### 3.3 Retry policy

- TikTok/Repliz internal: maksimum 3 execution attempts total dengan jeda 1, 5, dan 15 menit. Karena attempt pertama terjadi segera, interval retry efektif setelah kegagalan pertama adalah 1 menit lalu 5 menit; 15 menit hanya dipakai bila kebijakan dinaikkan menjadi empat attempt di masa depan.
- Facebook permission/object access: nol auto-retry sampai admin reconnect dan memilih manual retry.
- `retryReplizSchedule()` digunakan bila `external_schedule_id` masih ada. Jangan membuat schedule baru untuk job yang sama kecuali Repliz menyatakan schedule hilang/tidak dapat diretry dan ada keputusan idempotensi eksplisit.
- Polling GET dilakukan terpisah, misalnya 10/20/30 detik, dengan `poll_count`/deadline tersendiri—bukan `attempt_count`.

## 4. Kontrak Error Terstruktur

Format internal yang disanitasi:

```js
{
  code: 'REPLIZ_FACEBOOK_PERMISSION_REQUIRED',
  class: 'account_action_required',
  retryable: false,
  provider: 'repliz',
  platform: 'facebook',
  providerStatus: 'error',
  providerErrorCode: 'OBJECT_OR_PERMISSION_ERROR',
  providerLogId: null,
  message: 'Koneksi Facebook perlu diperbarui di Repliz.',
  action: 'reconnect_account'
}
```

Jangan menyimpan token, Basic Auth header, signed Nextcloud URL, response HTML, atau payload mentah. `provider_state_json` hanya boleh berisi allowlisted field: status, error code, log ID, action, Repliz schedule ID, dan timestamp.

## 5. Perubahan File dan Before/After

### 5.1 `lib/publishing-contract.js` — classifier khusus Repliz

#### Code Sebelum (Current/Before)

```js
export function sanitizeErrorMessage(err) {
  // sanitasi generik
}
```

#### Code Sesudah (Proposed/After)

```js
export function classifyReplizFailure({ platform, status, errorMessage, errorCode, httpStatus }) {
  const normalized = normalizeProviderError(errorMessage, errorCode);
  if (platform === 'facebook' && matchesPermissionOrObjectError(normalized)) {
    return replizFailure('REPLIZ_FACEBOOK_PERMISSION_REQUIRED', 'account_action_required', false, 'reconnect_account');
  }
  if (platform === 'tiktok' && matchesInternalError(normalized, httpStatus)) {
    return replizFailure('REPLIZ_TIKTOK_INTERNAL', 'provider_transient', true, 'retry_later');
  }
  if (matchesInvalidMedia(normalized)) {
    return replizFailure('REPLIZ_MEDIA_INVALID', 'media_invalid', false, 'replace_media');
  }
  return replizFailure('REPLIZ_UNKNOWN_ERROR', 'unknown', false, 'review');
}
```

Classifier wajib pure/deterministik dan memiliki fixtures untuk pesan audit aktual. Jangan mengandalkan bahasa Inggris saja bila Repliz juga mengembalikan code terstruktur.

### 5.2 `lib/repliz-client.js` — error object dan response allowlist

#### Code Sebelum (Current/Before)

```js
if (!res.ok) {
  const errMsg = json?.error || json?.message || `HTTP ${res.status}`;
  throw new Error(errMsg);
}
return json;
```

#### Code Sesudah (Proposed/After)

```js
if (!res.ok) {
  throw toReplizApiError({ response: res, body: json, path });
}
return json;

export function extractReplizScheduleState(response) {
  const schedule = response?.data || response || {};
  return {
    id: stringOrNull(schedule.id || schedule._id || schedule.scheduleId),
    status: normalizeStatus(schedule.status),
    errorMessage: sanitizeErrorMessage(schedule.errorMessage || schedule.error || schedule.failureReason),
    errorCode: stringOrNull(schedule.errorCode || schedule.code),
    providerLogId: stringOrNull(schedule.logId || schedule.log_id),
    postId: normalizePostId(schedule.postId || schedule.externalId),
    account: sanitizeReplizAccount(schedule.account)
  };
}
```

`ReplizApiError` harus membawa HTTP status/code/log ID yang aman tanpa credential. Pertahankan Basic Auth hanya server-side.

### 5.3 `lib/publishing-repository.js` — attempt budget atomik dan account health

#### Code Sebelum (Current/Before)

```sql
SELECT ... FROM publishing_jobs j
WHERE j.status IN ('scheduled', 'retry_wait', 'processing', ...)
FOR UPDATE SKIP LOCKED;

UPDATE publishing_jobs
SET status='processing', attempt_count=attempt_count+1
WHERE id=$2;
```

#### Code Sesudah (Proposed/After)

```sql
SELECT ... FROM publishing_jobs j
WHERE ...
  AND (
    (j.status IN ('scheduled','retry_wait') AND j.attempt_count < j.max_attempts)
    OR (j.status IN ('processing','verifying') AND j.next_attempt_at <= CURRENT_TIMESTAMP)
  )
FOR UPDATE SKIP LOCKED;

UPDATE publishing_jobs
SET attempt_count = CASE
      WHEN $3::boolean THEN attempt_count + 1
      ELSE attempt_count
    END,
    status='processing'
WHERE id=$2
RETURNING *;
```

Lebih baik pisahkan `claimDuePublishingExecution()` dan `claimDuePublishingPoll()` agar semantik tidak ambigu. Keduanya harus atomik, tenant-safe, dan `SKIP LOCKED`.

Tambahkan/update repository API:

```js
recordReplizProviderState(tenantId, jobId, safeState)
recordPublishingAccountHealth(tenantId, accountId, health)
resetJobForManualProviderRetry(tenantId, jobId, { confirmedReconnect })
```

Gunakan kolom yang sudah ada (`provider_state_json`, `provider_error_code`, `last_verified_at`, `last_error_*`) bila cukup. Tambah migrasi hanya jika polling counter/deadline benar-benar memerlukan kolom baru.

### 5.4 `lib/db-pg.js` — migrasi polling terpisah bila diperlukan

#### Code Sebelum (Current/Before)

```sql
attempt_count INTEGER NOT NULL DEFAULT 0,
max_attempts INTEGER NOT NULL DEFAULT 3,
next_attempt_at TIMESTAMPTZ
```

#### Code Sesudah (Proposed/After)

```sql
ALTER TABLE publishing_jobs
  ADD COLUMN IF NOT EXISTS provider_poll_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_poll_deadline TIMESTAMPTZ;
```

Jika repository dapat memisahkan poll tanpa kolom baru, bagian migrasi boleh dihilangkan. Bila ditambahkan, migration harus idempoten dan diterapkan konsisten pada Dev, Staging, dan Production saat deployment yang diotorisasi.

### 5.5 `lib/publishing-worker.js` — lifecycle dan retry berbasis kelas error

#### Code Sebelum (Current/Before)

```js
if (['failed', 'error'].includes(replizStatus)) {
  const errMsg = schedule?.errorMessage || schedule?.error || 'Repliz schedule execution failed';
  throw new Error(errMsg);
}

const classified = classifyProviderFailure(err, err.status || 0, 'processing');
```

#### Code Sesudah (Proposed/After)

```js
if (['failed', 'error'].includes(scheduleState.status)) {
  const failure = classifyReplizFailure({
    platform: job.platform,
    status: scheduleState.status,
    errorMessage: scheduleState.errorMessage,
    errorCode: scheduleState.errorCode,
    httpStatus: scheduleState.httpStatus
  });
  await recordReplizProviderState(job.tenant_id, job.id, toSafeProviderState(scheduleState, failure));
  return applyReplizFailurePolicy(job, failure, context);
}
```

Perilaku wajib:

- Facebook permission → `needs_review`, account diberi `last_error_code`, tidak auto-retry.
- TikTok internal → `retry_wait` hanya bila `attemptNumber < maxAttempts`, dengan backoff platform-specific.
- Polling schedule tidak menambah execution attempt.
- Saat sukses, bersihkan error akun/job yang terkait dan simpan provider state final.
- Attempt log menyimpan `providerErrorCode` dan outcome yang konsisten (`retry_wait`, `needs_review`, `failed`, `published`).
- Google Drive staging yang sudah `verified` direuse; retry schedule tidak mengunggah duplikat.

### 5.6 `app/api/v2/publishing/accounts/route.js` — sinkronisasi health Repliz

#### Code Sebelum (Current/Before)

```js
status: 'active'
```

#### Code Sesudah (Proposed/After)

```js
const health = mapReplizAccountHealth(raw);
await savePublishingAccount({
  ...account,
  status: health.isConnected ? 'active' : 'disconnected',
  lastVerifiedAt: health.checkedAt,
  lastErrorCode: health.errorCode,
  lastErrorMessage: health.message
});
```

Jangan menganggap keberadaan akun berarti sehat. Catat `isConnected`, platform, provider account ID, dan timestamp. Jelaskan bahwa `isConnected=true` tidak membuktikan permission Facebook Page untuk posting.

### 5.7 `app/api/v2/publishing/accounts/[id]/health/route.js` — endpoint health baru

#### Code Sebelum (Current/Before)

```js
// Belum ada endpoint health khusus akun Repliz.
```

#### Code Sesudah (Proposed/After)

```js
export const POST = withTenantContext(async (_request, { params }, user) => {
  requirePublishingAdmin(user);
  const account = await getPublishingAccountById(getActiveTenantId(), (await params).id);
  const remote = await getReplizAccount(credentials, account.provider_account_id);
  const health = await persistReplizAccountHealth(account, remote);
  return NextResponse.json({ success: true, data: health });
});
```

Endpoint hanya admin tenant, tidak mengembalikan credential/provider payload mentah, dan tidak melakukan posting.

### 5.8 `app/api/v2/publishing/jobs/[id]/retry/route.js` — manual retry aman

#### Code Sebelum (Current/Before)

```js
const result = await retryPublishingJob(tenantId, id);
```

#### Code Sesudah (Proposed/After)

```js
const body = await request.json().catch(() => ({}));
const result = await retryPublishingJobWithPolicy(tenantId, id, {
  actorId: user.id,
  confirmedReconnect: body.confirmedReconnect === true
});
```

Untuk `REPLIZ_FACEBOOK_PERMISSION_REQUIRED`, tolak retry dengan HTTP 409 kecuali admin mengonfirmasi reconnect. Tetap lakukan live account health check sebelum queue. Manual retry mereset execution budget secara eksplisit dan membuat audit attempt/event; jangan diam-diam membuat schedule baru.

### 5.9 `app/api/v2/publishing/jobs/[id]/route.js` — sync status lengkap

#### Code Sebelum (Current/Before)

```js
if (replizStatus === 'failed') reconciledStatus = 'failed';
await markPublishingResult(tenantId, id, { status: reconciledStatus });
```

#### Code Sesudah (Proposed/After)

```js
const state = extractReplizScheduleState(res);
const failure = isFailureState(state)
  ? classifyReplizFailure({ platform: job.platform, ...state })
  : null;
await reconcileReplizJobState({ tenantId, job, state, failure });
```

`sync-status` harus menghasilkan status/error yang sama dengan worker dan tidak memiliki classifier duplikat.

### 5.10 `app/content-flow/PublishingScheduler.js` — UX tindakan

#### Code Sebelum (Current/Before)

```jsx
<div>Pesan Kesalahan</div>
<div>{selectedJobDetail.last_error_message}</div>
```

#### Code Sesudah (Proposed/After)

```jsx
<ProviderFailureCard failure={selectedJobDetail.provider_failure}>
  {failure.action === 'reconnect_account' && (
    <a href={REPLIZ_ACCOUNTS_URL} target="_blank" rel="noopener noreferrer">
      Buka Repliz untuk reconnect
    </a>
  )}
  <button onClick={() => refreshAccountHealth(accountId)}>Periksa koneksi akun</button>
  <button onClick={() => retryJob(jobId, { confirmedReconnect })}>Retry</button>
</ProviderFailureCard>
```

UX wajib menampilkan:

- kategori masalah dalam bahasa sederhana;
- schedule ID Repliz yang aman disalin untuk support;
- jumlah execution attempt `x / max` terpisah dari polling;
- waktu retry berikutnya;
- tombol reconnect membuka dashboard Repliz, bukan mengklaim MAKNA dapat memperbaiki OAuth provider;
- konfirmasi admin sebelum retry Facebook permission error;
- TikTok internal menyarankan tunggu/retry, lalu support bila habis.

### 5.11 `tests/repliz-client.test.js` — parsing dan redaction

#### Code Sebelum (Current/Before)

```js
test('Repliz Client: redacts credentials on API error', async () => { ... });
```

#### Code Sesudah (Proposed/After)

```js
test('extracts provider code and log_id while redacting credentials', () => {
  const state = extractReplizScheduleState(fixture);
  assert.equal(state.providerLogId, 'safe-log-id');
  assert.doesNotMatch(JSON.stringify(state), /access-token|Basic /);
});
```

Tambahkan fixtures untuk nested response, `_id`, `errorMessage`, TikTok `internal`, invalid JSON, 401, timeout, dan secret di error body.

### 5.12 `tests/publishing-scheduler.test.js` — policy dan batas attempt

#### Code Sebelum (Current/Before)

```js
assert.equal(retried.attempt_count, 0);
```

#### Code Sesudah (Proposed/After)

```js
test('Facebook permission error moves to needs_review without automatic retry', async () => { ... });
test('TikTok internal retries with backoff and stops exactly at max_attempts', async () => { ... });
test('provider polling never increments execution attempt_count', async () => { ... });
test('manual retry requires reconnect confirmation for account errors', async () => { ... });
```

Gunakan fixture audit aktual yang sudah disanitasi. Test wajib membuktikan total klaim eksekusi tidak pernah melebihi `max_attempts`, termasuk dua worker paralel.

## 6. Acceptance Criteria

- Facebook `Unsupported get request`/missing permission menjadi `REPLIZ_FACEBOOK_PERMISSION_REQUIRED` dan `needs_review`.
- Facebook error tidak auto-retry sebelum tindakan admin.
- TikTok `internal` menjadi `REPLIZ_TIKTOK_INTERNAL` dan memakai backoff terbatas.
- Attempt count tidak pernah melebihi `max_attempts`; polling tidak dihitung sebagai attempt.
- Repliz schedule ID, provider code, dan log ID tersimpan jika tersedia tanpa credential.
- Account sync memakai `isConnected` aktual dan menyimpan `last_verified_at`.
- UI menjelaskan tindakan: reconnect, health check, retry, atau hubungi support.
- Manual retry tenant-safe, admin-only, diaudit, dan tidak membuat schedule duplikat.
- Retry mereuse Google Drive media staging yang sudah verified.
- Tidak ada jalur fallback ke `cloud.ast402.my.id`.
- Seluruh unit/integration tests terkait lulus.
- Build Next.js lulus.
- Smoke Dev memakai mock/sandbox dan tidak membuat post nyata.
- Smoke Staging real hanya dilakukan setelah persetujuan pengguna karena menghasilkan posting eksternal.
- Production tidak dideploy tanpa instruksi eksplisit.

## 7. Verifikasi

```bash
node --test tests/repliz-client.test.js tests/google-auth-health.test.js
npm run test:publishing-scheduler
npm run build
```

Test database harus dijalankan dengan `PG_SEARCH_PATH=dev`, `DISABLE_AUTO_MIGRATIONS=true`, `DISABLE_STARTUP_DB_CACHES=true`, dan `ENABLE_BACKGROUND_SERVICES=false`. Jangan menjalankan test integrasi dengan default schema `public`.

Urutan deploy:

1. verifikasi lokal/unit tanpa network side effect;
2. jalankan integration test pada schema Dev dengan fixture yang selalu dibersihkan;
3. deploy Dev memakai `npm run deploy:macmini-dev`;
4. smoke account health dan classifier tanpa posting;
5. deploy Staging memakai `npm run deploy:staging`;
6. jangan retry schedule Facebook/TikTok nyata tanpa persetujuan pengguna;
7. jangan deploy Production.

## 8. Rollback

- Rollback kode ke tag sebelum hardening.
- Migrasi kolom polling bersifat additive; tidak perlu dihapus saat rollback.
- Jangan menghapus schedule Repliz atau file Drive ketika rollback kode.
- Job `needs_review` tetap terminal-safe dan dapat ditangani manual.
- Jangan mengubah status job historis secara massal tanpa preview dan persetujuan.

## Execution Task List

- [ ] Baca `AGENTS.md`, guide Route Handler Next.js lokal, plan, dan prompt Antigravity seluruhnya.
- [ ] Simpan fixtures audit Facebook/TikTok yang sudah disanitasi tanpa token/media URL privat.
- [ ] Implementasikan `classifyReplizFailure()` beserta unit test deterministik.
- [ ] Implementasikan `ReplizApiError` dan `extractReplizScheduleState()` dengan redaction.
- [ ] Pisahkan execution claim dari provider poll atau implementasikan semantik setara yang terbukti aman.
- [ ] Tegakkan `attempt_count < max_attempts` secara atomik dan perbaiki nomor attempt menjadi 1-based.
- [ ] Tambahkan provider poll counter/deadline bila diperlukan dan migrasi idempoten.
- [ ] Simpan provider state allowlisted serta provider error/log ID.
- [ ] Implementasikan policy Facebook permission → `needs_review` tanpa auto-retry.
- [ ] Implementasikan policy TikTok internal → backoff terbatas dan terminal setelah budget habis.
- [ ] Pastikan retry mereuse external schedule dan media Drive; tidak membuat duplikat.
- [ ] Implementasikan account health mapping dan persistence.
- [ ] Tambahkan endpoint account health admin-only dan tenant-safe.
- [ ] Harden endpoint manual retry dengan health gate, reconnect confirmation, dan audit.
- [ ] Satukan classifier worker dan endpoint `sync-status`.
- [ ] Tambahkan UX error card, reconnect link, health check, retry, attempt/poll display, dan support ID.
- [ ] Tambahkan seluruh test client, classifier, concurrency, retry budget, tenant isolation, dan redaction.
- [ ] Jalankan test unit serta integration pada schema Dev dengan environment aman.
- [ ] Jalankan build dan catat warning yang tidak terkait secara terpisah.
- [ ] Deploy Dev dan lakukan smoke tanpa posting eksternal.
- [ ] Deploy Staging tanpa menjalankan retry/post nyata.
- [ ] Minta persetujuan pengguna sebelum smoke posting Facebook/TikTok nyata.
- [ ] Setelah semua verifikasi lulus, update changelog dan jalankan release non-interaktif patch.
- [ ] Verifikasi commit, tag, branch remote, serta laporkan risiko dan rollback point.

## 9. Release

Setelah semua acceptance criteria non-production terpenuhi:

```bash
npm run release-non-interactive -- --type patch --title "Harden kegagalan Facebook dan TikTok via Repliz" --points "Klasifikasikan error provider secara actionable|Pisahkan retry execution dari polling|Tambah account health dan retry aman"
```

Verifikasi tag dan branch remote resmi. Deployment Production tetap memerlukan instruksi manual eksplisit.
