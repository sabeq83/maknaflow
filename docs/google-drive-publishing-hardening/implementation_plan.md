# Implementation Plan — Hardening Google Drive untuk Repliz Publishing

## 1. Tujuan

Memperkuat jalur Google Drive yang sudah pernah berhasil di server Dev agar publishing Facebook dan TikTok melalui Repliz tidak pernah menerima URL Nextcloud langsung. Scope ini melaksanakan tujuh usulan berikut:

1. OAuth dan folder preflight sebelum schedule disimpan.
2. Respons `GOOGLE_REAUTH_REQUIRED` dan alur reconnect yang menjaga draft form.
3. Status Google berdasarkan verifikasi aktual, bukan sekadar token tersimpan.
4. Upload Drive wajib selesai sebelum schedule Repliz dibuat.
5. Pemeriksaan ganda: saat submit dan tepat sebelum worker mengeksekusi.
6. Folder khusus serta retensi file staging.
7. Verifikasi download anonim Google Drive sebelum URL dikirim ke Repliz.

## 2. Prinsip Arsitektur

```text
Content Flow scheduling form
  -> POST /publishing/preflight
     -> refresh OAuth
     -> cek folder publishing + capability
  -> POST /publishing/jobs
     -> ulangi readiness check secara server-side
     -> simpan job internal saja

Publishing worker saat due
  -> ulangi OAuth/folder check
  -> download Nextcloud melalui Tailscale
  -> upload ke folder Repliz Publishing di Google Drive
  -> permission anyone/reader
  -> anonymous GET + Range probe
  -> simpan fileId dan URL staging
  -> baru create schedule Repliz
  -> cleanup Drive setelah seluruh lifecycle terminal + retention
```

Tidak ada media proxy atau perubahan Cloudflare dalam scope. File utama tetap di Nextcloud; Google Drive hanya menyimpan salinan staging sementara.

## 3. Kontrak Status dan Error

Status readiness Google:

- `connected`: refresh token valid dan folder publishing dapat ditulis.
- `reauth_required`: refresh token revoked/expired atau `invalid_grant`.
- `folder_missing`: `repliz_drive_folder_id` kosong/tidak ditemukan/trashed.
- `permission_error`: OAuth valid tetapi folder tidak writable atau public permission dilarang.
- `temporarily_unavailable`: timeout, DNS, rate limit, atau error Google 5xx.
- `not_configured`: client credentials atau token belum tersedia.

Error API utama:

```json
{
  "success": false,
  "code": "GOOGLE_REAUTH_REQUIRED",
  "error": "Koneksi Google Drive perlu diperbarui sebelum menjadwalkan konten.",
  "reconnectUrl": "/api/google/auth?returnTo=%2Fcontent-flow%3Fview%3Dpublishing"
}
```

Gunakan HTTP `409` untuk state konfigurasi yang dapat diperbaiki user, `503` untuk gangguan sementara, dan `500` hanya untuk bug/tidak terklasifikasi.

## 4. Perubahan File dan Before/After

### 4.1 `lib/google-auth.js` — verifikasi OAuth nyata

#### Code Sebelum (Current/Before)

```js
export function getGoogleStatus() {
  return {
    credentialsSet: !!(clientId && clientSecret),
    connected: !!tokensStr,
    email: email || null,
  };
}
```

#### Code Sesudah (Proposed/After)

```js
export async function verifyGoogleConnection() {
  try {
    const client = getAuthorizedClient();
    await client.getAccessToken();
    return { state: 'connected', connected: true, email: getSetting('google_email') || null };
  } catch (error) {
    if (isGoogleInvalidGrant(error)) {
      return { state: 'reauth_required', connected: false, code: 'GOOGLE_REAUTH_REQUIRED' };
    }
    return classifyGoogleConnectionFailure(error);
  }
}
```

Ketentuan:

- Access token expired bukan kegagalan jika refresh berhasil.
- Refresh token yang ada harus dipertahankan ketika callback `tokens` hanya memberikan access token baru.
- Jangan menghapus token otomatis saat `invalid_grant`; tandai status agar audit tetap mungkin, lalu overwrite ketika reconnect sukses.
- Sanitasi error Google dan jangan log credential/token.

### 4.2 `lib/publishing-drive-staging.js` — file baru untuk readiness, staging, probe, cleanup

#### Code Sebelum (Current/Before)

```js
// Belum ada service terpusat. Worker memutuskan sendiri apakah upload dilakukan.
```

#### Code Sesudah (Proposed/After)

```js
export async function verifyPublishingDriveReady() {
  const authState = await verifyGoogleConnection();
  if (!authState.connected) throw toPublishingDriveError(authState);

  const folderId = getSetting('repliz_drive_folder_id');
  const folder = await drive.files.get({
    fileId: folderId,
    fields: 'id,name,mimeType,trashed,capabilities(canAddChildren)'
  });
  assertWritablePublishingFolder(folder.data);
  return { state: 'connected', folderId, folderName: folder.data.name };
}

export async function stageMediaForRepliz(job) {
  await verifyPublishingDriveReady();
  const uploaded = await uploadUrlToPublicDrive(...);
  await verifyAnonymousDriveDownload(uploaded.directDownloadUrl);
  return uploaded;
}
```

Service juga menyediakan `cleanupExpiredPublishingMedia()` dan error codes terstruktur.

### 4.3 `lib/drive-uploader.js` — upload idempoten dan verifikasi anonim

#### Code Sebelum (Current/Before)

```js
const uploaded = await drive.files.create(...);
await drive.permissions.create({
  fileId,
  requestBody: { role: 'reader', type: 'anyone' },
});
return { fileId, directDownloadUrl };
```

#### Code Sesudah (Proposed/After)

```js
export async function uploadUrlToPublicDrive(sourceUrl, filename, folderId, { appProperties } = {}) {
  const existing = await findPublishingUploadByJob(appProperties.jobId, folderId);
  const uploaded = existing || await createDriveUpload(...);
  await ensureAnyoneReaderPermission(uploaded.id);
  return buildDriveUploadResult(uploaded);
}

export async function verifyAnonymousDriveDownload(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { Range: 'bytes=0-1023', 'User-Agent': 'MAKNA-Repliz-Preflight/1.0' },
    signal: AbortSignal.timeout(15000),
  });
  assertAnonymousVideoResponse(response);
}
```

Upload memakai `appProperties` berisi job ID/tenant/content ID yang tidak sensitif untuk mencegah duplikasi setelah crash. Probe menerima `200` atau `206`, menolak halaman HTML/login/virus-confirm yang tidak menghasilkan media valid.

### 4.4 `app/api/google/status/route.js` — status async terverifikasi

#### Code Sebelum (Current/Before)

```js
export async function GET() {
  const status = getGoogleStatus();
  return NextResponse.json({ success: true, data: status });
}
```

#### Code Sesudah (Proposed/After)

```js
export async function GET() {
  const auth = await verifyGoogleConnection();
  const publishingDrive = auth.connected
    ? await getPublishingDriveReadiness()
    : null;
  return NextResponse.json({ success: true, data: { ...auth, publishingDrive } });
}
```

Tambahkan cache singkat in-process maksimal 30–60 detik untuk mencegah Google API dipanggil berulang oleh render UI, tetapi endpoint submit/worker tidak boleh memakai hasil cache.

### 4.5 `app/api/google/auth/route.js` dan `app/api/google/callback/route.js` — reconnect dan safe return

#### Code Sebelum (Current/Before)

```js
const url = getAuthUrl(redirectUri);
return NextResponse.redirect(url);

// callback selalu kembali ke /settings
return NextResponse.redirect(`${origin}/settings?google_connected=true`);
```

#### Code Sesudah (Proposed/After)

```js
const returnTo = normalizeAllowedReturnPath(request.nextUrl.searchParams.get('returnTo'));
const state = signOAuthState({ returnTo, exp: Date.now() + 10 * 60_000 });
return NextResponse.redirect(getAuthUrl(redirectUri, state));

// callback memverifikasi state sebelum redirect
return NextResponse.redirect(`${origin}${state.returnTo}?google_connected=true`);
```

Hanya relative allowlisted paths seperti `/settings` dan `/content-flow?view=publishing` yang diterima. Jangan membuka open redirect. Bila callback sukses, status OAuth dan folder diverifikasi sekali sebelum redirect.

### 4.6 `app/api/v2/publishing/preflight/route.js` — preflight pertama

#### Code Sebelum (Current/Before)

```js
// hanya memeriksa URL media, caption, akun, dan ffprobe
return NextResponse.json({ success: errors.length === 0, errors, warnings });
```

#### Code Sesudah (Proposed/After)

```js
const replizSelected = validAccounts.some(account => account.provider === 'repliz');
if (replizSelected && mediaType !== 'text_only') {
  const driveState = await verifyPublishingDriveReady();
  checks.googleDrive = driveState;
}
return NextResponse.json({ success: errors.length === 0, errors, warnings, checks });
```

`reauth_required`, folder missing, dan permission error adalah blocking error. Gangguan sementara juga blocking tetapi menampilkan opsi coba lagi, bukan reconnect.

### 4.7 `app/api/v2/publishing/jobs/route.js` — gate sebelum penyimpanan schedule

#### Code Sebelum (Current/Before)

```js
const validated = validateScheduleRequest(rawBody);
const createdJobs = await createPublishingJobs(...);
```

#### Code Sesudah (Proposed/After)

```js
const validated = validateScheduleRequest(rawBody);
const selectedAccounts = await getPublishingAccountsForSchedule(tenantId, validated.account_ids);
if (requiresDriveStaging(selectedAccounts, validated.media_type)) {
  await verifyPublishingDriveReady({ bypassCache: true });
}
const createdJobs = await createPublishingJobs(...);
```

Backend tidak mempercayai hasil preflight UI. Jika readiness gagal, tidak ada row `publishing_jobs` yang dibuat dan Content Flow tidak diubah menjadi `Scheduled`.

### 4.8 `lib/publishing-worker.js` — preflight kedua dan fail-closed

#### Code Sebelum (Current/Before)

```js
const resolvedMediaUrl = await ensurePublicMediaUrl(job);
// bila upload error, ensurePublicMediaUrl mengembalikan URL Nextcloud asli
await createReplizSchedule(credentials, payload);
```

#### Code Sesudah (Proposed/After)

```js
const staged = await stageMediaForRepliz(job);
await recordPublishingMediaStaging(job, staged);
await markPublishingResult(job.tenant_id, job.id, {
  media_url_snapshot: staged.directDownloadUrl,
  provider_stage: 'media_staged',
});
await createReplizSchedule(credentials, buildReplizPayload(job, staged.directDownloadUrl));
```

Ketentuan:

- Hapus fallback raw Nextcloud.
- `GOOGLE_REAUTH_REQUIRED` menghasilkan `needs_review`, bukan retry tanpa batas.
- Google 429/5xx/timeout menghasilkan bounded `retry_wait` tanpa membuat schedule Repliz.
- Catat attempt `google_drive_preflight`, `media_upload`, dan `anonymous_media_probe`.
- Jangan upload ulang bila `fileId` staging yang sama telah terverifikasi.

### 4.9 `lib/db-pg.js` dan `lib/publishing-repository.js` — metadata dan retensi

#### Code Sebelum (Current/Before)

```sql
-- Tidak ada tabel lifecycle file staging Drive.
```

#### Code Sesudah (Proposed/After)

```sql
CREATE TABLE IF NOT EXISTS publishing_media_staging (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  job_id TEXT NOT NULL REFERENCES publishing_jobs(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google_drive')),
  external_file_id TEXT NOT NULL,
  public_url TEXT NOT NULL,
  status TEXT NOT NULL,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, job_id, provider)
);
```

Repository menyediakan create/update/find/claim-cleanup. URL yang disimpan harus disanitasi bila kelak mengandung secret; Drive file ID bukan OAuth credential tetapi tetap tidak perlu ditampilkan luas.

### 4.10 `app/content-flow/PublishingScheduler.js` — UX reconnect tanpa kehilangan draft

#### Code Sebelum (Current/Before)

```js
const res = await fetch('/api/v2/publishing/jobs', ...);
if (!json.success) showToast(`Gagal menjadwalkan: ${json.error}`);
```

#### Code Sesudah (Proposed/After)

```js
if (json.code === 'GOOGLE_REAUTH_REQUIRED') {
  persistScheduleDraft(scheduleForm);
  setGoogleReconnect({ open: true, reconnectUrl: json.reconnectUrl });
  return;
}
```

Dialog:

- menjelaskan bahwa refresh token dicabut/kedaluwarsa;
- tombol `Hubungkan Ulang Google` dan `Batal`;
- menyimpan draft secara session-scoped, bukan local storage permanen;
- memulihkan modal dan form setelah callback kembali;
- membedakan tombol reconnect, pilih folder, dan coba lagi sesuai error code.

Submit wajib menjalankan preflight otomatis; tombol preflight manual tetap tersedia untuk diagnosis.

### 4.11 `app/settings/page.js` — status Google yang jujur dan folder publishing

#### Code Sebelum (Current/Before)

```js
setGoogleStatus({ connected: data.data.connected, email: data.data.userEmail || null });
// UI hanya menampilkan Connected / Not Connected
```

#### Code Sesudah (Proposed/After)

```js
setGoogleStatus({
  state: data.data.state,
  connected: data.data.connected,
  email: data.data.email,
  publishingDrive: data.data.publishingDrive,
});
```

UI menampilkan `Connected`, `Reconnect Required`, `Folder Belum Dipilih`, atau `Permission Error`, tombol reconnect langsung, dan readiness folder `Repliz Publishing`.

### 4.12 `lib/publishing-media-cleanup-worker.js` — file baru

#### Code Sebelum (Current/Before)

```js
// Belum ada cleanup lifecycle untuk file Google Drive staging.
```

#### Code Sesudah (Proposed/After)

```js
export async function runPublishingMediaCleanupTick() {
  const item = await claimExpiredPublishingMedia();
  if (!item || !isParentJobTerminal(item)) return;
  await drive.files.delete({ fileId: item.external_file_id });
  await markPublishingMediaDeleted(item.id);
}
```

Default retention 14 hari setelah terminal. Cleanup idempoten; `404` Drive diperlakukan sudah terhapus. File Nextcloud tidak pernah disentuh.

### 4.13 Tests

File: `tests/google-auth-health.test.js` (baru), `tests/publishing-drive-staging.test.js` (baru), dan `tests/publishing-scheduler.test.js` (modifikasi).

#### Code Sebelum (Current/Before)

```js
// Belum ada regression test untuk revoked refresh token, Drive gate, atau anonymous probe.
```

#### Code Sesudah (Proposed/After)

```js
test('expired access token is refreshed and remains connected', async () => {});
test('invalid_grant maps to GOOGLE_REAUTH_REQUIRED', async () => {});
test('missing or trashed publishing folder blocks schedule creation', async () => {});
test('Drive upload and anonymous probe happen before Repliz schedule', async () => {});
test('upload/probe failure never falls back to raw Nextcloud URL', async () => {});
test('staging upload is idempotent across worker retry', async () => {});
test('cleanup deletes Drive copy but never Nextcloud source', async () => {});
test('OAuth returnTo rejects external redirects', async () => {});
```

### 4.14 `.env.staging.local.example` — konfigurasi non-secret dan retention

#### Code Sebelum (Current/Before)

```dotenv
GOOGLE_INTEGRATION_ENABLED=false
```

#### Code Sesudah (Proposed/After)

```dotenv
GOOGLE_INTEGRATION_ENABLED=true
NEXTCLOUD_INTERNAL_BASE=http://100.78.186.123
PUBLISHING_DRIVE_RETENTION_DAYS=14
PUBLISHING_MEDIA_CLEANUP_INTERVAL_MS=3600000
```

`repliz_drive_folder_id` tetap disimpan melalui Settings/tenant settings. OAuth client secret dan tokens tidak boleh masuk contoh maupun Git.

### 4.15 `sot/global/changelog.md` — diperbarui setelah implementasi

#### Code Sebelum (Current/Before)

```md
# Changelog

## V2.29.19 — ...
```

#### Code Sesudah (Proposed/After)

```md
# Changelog

## V<versi-release> — Harden Google Drive Staging untuk Repliz (...)
- OAuth dan folder readiness gate sebelum scheduling
- Upload serta anonymous media probe fail-closed
- Reconnect UX dan cleanup file staging Drive
```

Versi aktual ditentukan oleh release script setelah seluruh verifikasi selesai.

## 5. Detail Tujuh Tahap Fungsional

### Usulan 1 — Preflight sebelum scheduling

Preflight memanggil refresh OAuth dan `drive.files.get` terhadap `repliz_drive_folder_id`. Capability `canAddChildren`, MIME folder, dan `trashed=false` wajib terpenuhi.

### Usulan 2 — Reconnect UX

API mengembalikan error code stabil. UI menyimpan draft di `sessionStorage`, membuka OAuth reconnect, lalu memulihkan form setelah callback aman.

### Usulan 3 — Status koneksi aktual

Status Settings tidak boleh menggunakan `Boolean(tokens)`. Status harus berdasarkan refresh/API check terakhir beserta timestamp dan state terklasifikasi.

### Usulan 4 — Upload sebelum Repliz

Schedule internal MAKNA boleh disimpan setelah preflight, tetapi schedule eksternal Repliz baru boleh dibuat setelah Drive upload dan probe sukses.

### Usulan 5 — Double preflight

Check pertama memberi feedback cepat kepada user. Check kedua di worker mencegah token/folder berubah selama menunggu waktu tayang.

### Usulan 6 — Folder dan retention

Gunakan folder khusus `Repliz Publishing`. Salinan Drive diberi metadata job dan dihapus default 14 hari setelah terminal. Source Nextcloud tidak diubah.

### Usulan 7 — Anonymous download probe

Probe tidak membawa OAuth header/cookie, mengikuti redirect secara terbatas, meminta byte range awal, memeriksa MIME dan bukan HTML. URL baru boleh dikirim ke Repliz setelah probe lulus.

## 6. Verifikasi

| Skenario | Hasil wajib |
|---|---|
| Access token expired, refresh token valid | refresh otomatis; schedule dapat dilanjutkan |
| Refresh token revoked | `409 GOOGLE_REAUTH_REQUIRED`; tidak ada job tersimpan |
| Folder ID kosong/trashed | blocking error; UI mengarahkan ke Settings |
| Folder read-only | `GOOGLE_DRIVE_PERMISSION_ERROR` |
| Nextcloud internal gagal | tidak ada upload dan tidak ada schedule Repliz |
| Upload Drive sukses, permission gagal | cleanup/best-effort orphan handling; schedule Repliz tidak dibuat |
| Anonymous probe gagal | schedule Repliz tidak dibuat |
| Worker crash setelah upload | retry memakai file yang sama, tidak menggandakan upload |
| Facebook smoke | Repliz menerima hanya URL Drive dan publish terverifikasi |
| TikTok smoke | Repliz menerima hanya URL Drive dan publish terverifikasi |
| Retention lewat | salinan Drive dihapus; source Nextcloud tetap ada |

## 7. Rollout dan Migrasi Job Gagal

1. Reconnect akun Google staging dan verifikasi email yang benar.
2. Pilih/buat folder `Repliz Publishing`, simpan `repliz_drive_folder_id`.
3. Jalankan readiness dan upload smoke tanpa Repliz.
4. Deploy ke staging saja.
5. Buat satu job baru Facebook dan satu TikTok dengan video yang sama.
6. Audit payload/media URL, status Repliz, permalink, DB, dan log.
7. Job gagal lama tidak boleh memakai tombol retry lama jika external schedule sudah menyimpan URL Nextcloud. Buat schedule pengganti yang ditautkan ke job lama atau reset hanya lewat prosedur migrasi terkontrol.
8. Production tidak boleh dideploy tanpa perintah eksplisit user.

## 8. Rollback

- Pause publishing worker.
- Rollback aplikasi ke tag sebelumnya.
- Pertahankan larangan fallback URL Nextcloud walaupun rollout dibatalkan.
- Salinan Drive orphan dicatat dan dibersihkan melalui script/worker idempoten.
- Rekonsiliasi external schedule sebelum membuat pengganti agar tidak terjadi double post.

## 9. Execution Task List

- [ ] Tahap 1 — Tambahkan error contract dan verifikasi OAuth aktual di `lib/google-auth.js` beserta unit tests.
- [ ] Tahap 2 — Implementasikan `publishing-drive-staging` untuk folder readiness, upload idempoten, permission, dan anonymous probe.
- [ ] Tahap 3 — Ubah Google status API dan Settings UI agar menampilkan state nyata serta aksi reconnect/folder.
- [ ] Tahap 4 — Implementasikan safe OAuth `returnTo` dan pemulihan form setelah reconnect.
- [ ] Tahap 5 — Tambahkan Google Drive readiness pada preflight API dan scheduling POST sebelum row job dibuat.
- [ ] Tahap 6 — Integrasikan preflight kedua dan fail-closed Drive staging pada publishing worker sebelum Repliz API.
- [ ] Tahap 7 — Tambahkan tabel/repository lifecycle staging dan cleanup worker dengan retention 14 hari.
- [ ] Tahap 8 — Implementasikan UX Content Flow untuk blocking error, reconnect, retry, dan draft preservation.
- [ ] Tahap 9 — Tambahkan seluruh unit/integration regression tests, termasuk larangan raw Nextcloud URL.
- [ ] Tahap 10 — Jalankan test publishing, test baru, lint/check yang tersedia, dan Next.js build.
- [ ] Tahap 11 — Reconnect Google staging, konfigurasi folder khusus, lalu lakukan readiness/upload/anonymous probe smoke.
- [ ] Tahap 12 — Deploy staging dengan remote build sesuai SOP dan tanpa polling SSH berulang.
- [ ] Tahap 13 — Jalankan smoke Facebook dan TikTok serta verifikasi tidak ada double post atau raw Nextcloud URL.
- [ ] Tahap 14 — Migrasikan job gagal lama hanya setelah smoke sukses dan approval operasional.
- [ ] Tahap 15 — Update changelog, jalankan release patch non-interaktif, dan verifikasi branch/tag remote.

