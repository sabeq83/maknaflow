# Implementation Plan — Remediasi Folder Google Drive REPLIZ Publishing

## 1. Ringkasan Audit

Audit read-only dilakukan langsung terhadap database dan Google API untuk environment `dev` dan `staging` pada 3 September 2026. Tidak ada setting, token, folder, atau job yang diubah.

| Pemeriksaan | Dev | Staging |
|---|---:|---:|
| OAuth account tersimpan | `sabeq83@gmail.com` | `sabeq83@gmail.com` |
| OAuth account aktual dari `userinfo` | cocok | cocok |
| Refresh token | ada | ada |
| Refresh access token | HTTP 200 | HTTP 200 |
| Scope Drive | `drive.file` | `drive.file` |
| Folder ID | `1fEn2ChMCvBWEc_LiiaxbEpRESjtO5Kg6` | sama |
| Panjang ID / whitespace | 33 / bersih | 33 / bersih |
| `files.get` biasa | 404 `notFound` | 404 `notFound` |
| `files.get` + `supportsAllDrives=true` | 404 `notFound` | 404 `notFound` |

Kesimpulan:

1. Error saat ini **bukan disebabkan token expired**. Kedua refresh token valid dan berhasil menghasilkan access token baru.
2. Error juga bukan semata-mata karena dukungan Shared Drive; hasil tetap 404 saat `supportsAllDrives=true`.
3. Kode meminta scope OAuth `drive.file`. Scope ini hanya memberi akses per-file kepada file/folder yang dibuat aplikasi atau secara eksplisit dipilih/dibagikan ke aplikasi melalui mekanisme seperti Google Picker.
4. Folder dibuat manual di Google Drive. Permission `anyone/editor` adalah ACL untuk pengguna/link, bukan grant per-file kepada OAuth app. Karena itu API sengaja dapat menjawab 404 walaupun folder dapat dibuka di browser oleh manusia.
5. Setting folder disimpan mentah, UI tidak menyediakan pembuatan/pemilihan folder melalui aplikasi, dan error 404 saat ini dipetakan generik sebagai “tidak ditemukan atau tidak dapat diakses”.
6. Cache readiness saat ini satu variabel global, tidak di-key berdasarkan tenant/account/folder. Ini berisiko menampilkan hasil tenant lain pada proses multi-tenant.

Referensi resmi:

- Google menjelaskan `drive.file` sebagai akses untuk file yang dibuat aplikasi atau dibuka/dibagikan kepada aplikasi melalui file picker: https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- Operasi Shared Drive memerlukan `supportsAllDrives=true`: https://developers.google.com/workspace/drive/api/guides/enable-shareddrives
- Permission `anyone` dan role adalah ACL resource; bukan pengganti scope OAuth: https://developers.google.com/workspace/drive/api/guides/manage-sharing

## 2. Keputusan Arsitektur

Gunakan solusi utama berikut:

1. Pertahankan scope least-privilege `drive.file`.
2. MAKNA Flow membuat folder `REPLIZ Publishing` melalui Drive API setelah OAuth berhasil. Karena dibuat oleh aplikasi, folder dapat diakses dengan `drive.file`.
3. Simpan ID hasil API ke `repliz_drive_folder_id` secara atomik untuk tenant aktif.
4. Folder induk tetap private. Hanya file media staging yang diberi `anyone/reader` agar Repliz dapat mengunduhnya.
5. Hapus permission `anyone/editor` dari folder manual setelah folder aplikasi siap; akses edit publik tidak diperlukan dan terlalu luas.

Alternatif yang tidak dipilih untuk tahap ini:

- Google Picker: valid dan tetap cocok dengan `drive.file`, tetapi integrasi UI/API key menambah kompleksitas.
- Scope penuh `drive`: memungkinkan folder manual terlihat, tetapi merupakan restricted scope dan memberi akses jauh lebih luas. Jangan menggunakannya hanya untuk mengatasi satu folder staging.

## 3. Alur Target

```text
Admin connect Google OAuth
  -> Settings membaca email + granted scopes aktual
  -> klik “Buat/Perbaiki Folder REPLIZ Publishing”
  -> server memvalidasi OAuth dan scope drive.file
  -> files.create(folder) melalui OAuth app
  -> files.get + capability check dengan supportsAllDrives=true
  -> simpan folder ID ke tenant aktif
  -> tampilkan folder name, ID, owner account, status writable

Saat scheduling
  -> readiness bypass cache
  -> upload media ke folder aplikasi
  -> permission hanya pada file: anyone/reader
  -> anonymous binary probe
  -> baru kirim URL Drive ke Repliz
```

Operasi “repair” harus idempoten. Jika setting menunjuk folder valid, gunakan folder tersebut. Jika tidak valid, cari hanya folder yang dibuat aplikasi dan diberi `appProperties` khusus; jika tidak ada, buat baru. Jangan mengadopsi folder bernama sama secara global karena `drive.file` tidak menjamin aplikasi dapat melihatnya dan nama bukan identitas unik.

## 4. Kontrak Status dan Error

Gunakan kode terstruktur berikut:

- `GOOGLE_REAUTH_REQUIRED`: refresh token revoked/invalid.
- `GOOGLE_DRIVE_SCOPE_MISSING`: token tidak memiliki `drive.file` atau scope Drive yang kompatibel.
- `GOOGLE_DRIVE_FOLDER_NOT_VISIBLE_TO_APP`: folder ID menghasilkan 404 dengan OAuth valid; jelaskan bahwa folder manual/public belum tentu diberi akses ke aplikasi.
- `GOOGLE_DRIVE_FOLDER_INVALID`: resource trashed atau bukan folder.
- `GOOGLE_DRIVE_FOLDER_NOT_WRITABLE`: `canAddChildren=false`.
- `GOOGLE_DRIVE_PUBLIC_SHARING_BLOCKED`: upload berhasil tetapi permission `anyone/reader` ditolak kebijakan akun/domain.
- `GOOGLE_DRIVE_TEMPORARILY_UNAVAILABLE`: 429, timeout, atau Google 5xx.

Respons folder 404 tidak boleh menyuruh reconnect bila refresh token sudah terbukti valid.

## 5. Perubahan File dan Before/After

### 5.1 `lib/google-auth.js` — laporkan scope aktual

#### Code Sebelum (Current/Before)

```js
await client.getAccessToken();
return {
  state: 'connected',
  connected: true,
  credentialsSet: true,
  email: email || null,
  message: 'Koneksi Google aktif dan terverifikasi.'
};
```

#### Code Sesudah (Proposed/After)

```js
const accessToken = await client.getAccessToken();
const tokenInfo = await client.getTokenInfo(accessToken.token);
const grantedScopes = normalizeGoogleScopes(tokenInfo.scopes);
return {
  state: 'connected',
  connected: true,
  credentialsSet: true,
  email: email || null,
  grantedScopes,
  driveFileScopeGranted: hasCompatibleDriveScope(grantedScopes),
  message: 'Koneksi Google aktif dan terverifikasi.'
};
```

Ketentuan: jangan mengembalikan access/refresh token ke UI atau log. Helper scope harus menerima `drive.file` dan scope Drive yang lebih luas bila suatu hari dikonfigurasi secara eksplisit.

### 5.2 `lib/publishing-drive-staging.js` — create/repair dan diagnosis tepat

#### Code Sebelum (Current/Before)

```js
let readinessCache = { timestamp: 0, data: null };

folderRes = await drive.files.get({
  fileId: folderId,
  fields: 'id,name,mimeType,trashed,capabilities(canAddChildren)'
});
```

#### Code Sesudah (Proposed/After)

```js
const readinessCache = new Map();

export async function ensurePublishingDriveFolder() {
  const authState = await verifyGoogleConnection();
  assertCompatibleDriveScope(authState);

  const existing = await findAppCreatedPublishingFolder();
  const folder = existing || await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: 'REPLIZ Publishing',
      mimeType: 'application/vnd.google-apps.folder',
      appProperties: { maknaPurpose: 'repliz-publishing', version: '1' }
    },
    fields: 'id,name,mimeType,trashed,driveId,capabilities(canAddChildren)'
  });
  await setSetting('repliz_drive_folder_id', folder.data.id);
  invalidatePublishingDriveReadiness();
  return assertWritablePublishingFolder(folder.data);
}

const folderRes = await drive.files.get({
  fileId: normalizeDriveFolderId(folderId),
  supportsAllDrives: true,
  fields: 'id,name,mimeType,trashed,driveId,capabilities(canAddChildren,canShare)'
});
```

Ketentuan:

- Cache key minimal: tenant ID + OAuth email + normalized folder ID; atau hilangkan cache bila tenant ID tidak tersedia aman.
- 404 dengan OAuth sehat dipetakan menjadi `GOOGLE_DRIVE_FOLDER_NOT_VISIBLE_TO_APP`, bukan `reauth_required`.
- Pencarian idempoten memakai `appProperties`, `spaces: 'drive'`, `includeItemsFromAllDrives: true`, dan parameter Shared Drive yang relevan.
- Jangan membuat folder publik.
- Simpan setting hanya setelah create dan capability check sukses.

### 5.3 `lib/drive-uploader.js` — dukungan Shared Drive dan fail-closed permission

#### Code Sebelum (Current/Before)

```js
const searchRes = await drive.files.list({ q, fields: 'files(id,name,appProperties)' });
const uploaded = await drive.files.create({ requestBody, media, fields: 'id,webViewLink' });
try {
  await drive.permissions.create({ fileId, requestBody: { role: 'reader', type: 'anyone' } });
} catch (permErr) {
  console.warn('Failed to set public reader permission');
}
```

#### Code Sesudah (Proposed/After)

```js
const searchRes = await drive.files.list({
  q,
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
  fields: 'files(id,name,appProperties)'
});
const uploaded = await drive.files.create({
  supportsAllDrives: true,
  requestBody,
  media,
  fields: 'id,webViewLink'
});
await drive.permissions.create({
  fileId,
  supportsAllDrives: true,
  requestBody: { role: 'reader', type: 'anyone' }
});
```

Jika permission publik gagal, hapus file upload yang baru dibuat bila aman, lalu lempar `GOOGLE_DRIVE_PUBLIC_SHARING_BLOCKED`. Jangan lanjut ke Repliz dengan file private. Terapkan `supportsAllDrives` juga pada cleanup/delete.

### 5.4 `app/api/google/publishing-folder/route.js` — endpoint admin baru

#### Code Sebelum (Current/Before)

```js
// Belum ada endpoint khusus untuk membuat atau memperbaiki folder publishing.
```

#### Code Sesudah (Proposed/After)

```js
export const POST = withTenantContext(async (request, _context, user) => {
  requireTenantAdminUser(user);
  const folder = await ensurePublishingDriveFolder();
  return NextResponse.json({ success: true, data: sanitizeFolderStatus(folder) });
});
```

Endpoint hanya untuk admin tenant, memakai tenant context, tidak menerima arbitrary owner/folder name, dan tidak mengembalikan token. Tambahkan rate/duplicate protection melalui implementasi create-or-reuse idempoten.

### 5.5 `app/api/google/status/route.js` — tenant isolation dan bypass diagnosis

#### Code Sebelum (Current/Before)

```js
export async function GET() {
  const authStatus = await verifyGoogleConnection();
  // ...
}
```

#### Code Sesudah (Proposed/After)

```js
export const GET = withTenantContext(async (_request, _context, user) => {
  requireTenantAdminUser(user);
  const authStatus = await verifyGoogleConnection();
  const publishingDrive = authStatus.connected
    ? await getPublishingDriveReadiness()
    : toDisconnectedDriveStatus(authStatus);
  return NextResponse.json({ success: true, data: { ...authStatus, publishingDrive } });
});
```

GET dan DELETE wajib memakai auth + tenant context. Saat disconnect, hapus hanya OAuth tenant aktif dan invalidasi cache tenant tersebut.

### 5.6 `app/api/settings/route.js` — normalisasi URL/ID

#### Code Sebelum (Current/Before)

```js
if (repliz_drive_folder_id !== undefined) {
  await setSetting('repliz_drive_folder_id', repliz_drive_folder_id);
}
```

#### Code Sesudah (Proposed/After)

```js
if (repliz_drive_folder_id !== undefined) {
  const folderId = normalizeDriveFolderId(repliz_drive_folder_id);
  await setSetting('repliz_drive_folder_id', folderId);
  invalidatePublishingDriveReadiness();
}
```

Terima ID langsung atau URL `drive.google.com/drive/folders/<id>`. Tolak host lain, ID kosong yang tidak disengaja, query berbahaya, dan format invalid dengan HTTP 400.

### 5.7 `app/settings/page.js` — UX yang tidak menyuruh re-login secara keliru

#### Code Sebelum (Current/Before)

```jsx
<input
  placeholder="Masukkan Folder ID Google Drive..."
  value={replizDriveFolderId}
  onChange={e => setReplizDriveFolderId(e.target.value)}
/>
```

#### Code Sesudah (Proposed/After)

```jsx
<input
  placeholder="Tempel URL atau Folder ID Google Drive..."
  value={replizDriveFolderId}
  onChange={e => setReplizDriveFolderId(e.target.value)}
/>
<button onClick={createOrRepairPublishingFolder} disabled={!googleStatus.connected || repairingFolder}>
  {repairingFolder ? 'Menyiapkan...' : 'Buat/Perbaiki Folder REPLIZ Publishing'}
</button>
```

Tampilkan secara terpisah:

- OAuth sehat + email akun;
- scope Drive sesuai/tidak;
- folder visible/writable;
- tombol reconnect hanya untuk `GOOGLE_REAUTH_REQUIRED` atau scope yang memang perlu consent ulang;
- tombol create/repair untuk `GOOGLE_DRIVE_FOLDER_NOT_VISIBLE_TO_APP`;
- peringatan agar folder tidak diberi `anyone/editor`.

Setelah create/repair sukses, update field folder ID dan refresh status tanpa reload penuh.

### 5.8 `tests/google-auth-health.test.js` — coverage scope

#### Code Sebelum (Current/Before)

```js
it('reports connected when access token refresh succeeds', async () => {
  // existing assertion
});
```

#### Code Sesudah (Proposed/After)

```js
it('reports granted drive.file scope without exposing tokens', async () => {
  const status = await verifyGoogleConnection();
  expect(status.driveFileScopeGranted).toBe(true);
  expect(status).not.toHaveProperty('accessToken');
  expect(status).not.toHaveProperty('refreshToken');
});
```

Tambahkan kasus missing scope, refresh valid, `invalid_grant`, dan error token-info sementara.

### 5.9 `tests/publishing-drive-staging.test.js` — create/repair, 404, cache tenant

#### Code Sebelum (Current/Before)

```js
it('returns folder not found when files.get fails', async () => {
  // generic 404 assertion
});
```

#### Code Sesudah (Proposed/After)

```js
it('classifies valid OAuth plus folder 404 as not visible to app', async () => {
  await expect(verifyPublishingDriveReady({ bypassCache: true }))
    .rejects.toMatchObject({ code: 'GOOGLE_DRIVE_FOLDER_NOT_VISIBLE_TO_APP' });
});

it('creates one app-owned folder and reuses it on retry', async () => {
  const first = await ensurePublishingDriveFolder();
  const second = await ensurePublishingDriveFolder();
  expect(second.id).toBe(first.id);
  expect(drive.files.create).toHaveBeenCalledTimes(1);
});
```

Tambahkan test: `supportsAllDrives`, appProperties query, trashed/non-folder/read-only, save hanya setelah verify, cache tidak bocor antar-tenant, public permission failure menghentikan pipeline, dan cleanup aman.

### 5.10 `docs/google-drive-publishing-folder-remediation/antigravity_execution_prompt.md` — instruksi eksekusi

#### Code Sebelum (Current/Before)

```md
// Belum ada instruksi khusus untuk remediasi folder manual + drive.file.
```

#### Code Sesudah (Proposed/After)

```md
Implementasikan docs/google-drive-publishing-folder-remediation/implementation_plan.md.
Pertahankan drive.file dan buat folder melalui aplikasi secara idempoten.
```

Dokumen wajib menyertakan bukti audit, guardrail keamanan, urutan test/deploy, dan larangan posting nyata tanpa persetujuan.

## 6. Acceptance Criteria

- Dev dan Staging mendeteksi OAuth `sabeq83@gmail.com` valid tanpa reconnect palsu.
- Tombol create/repair menghasilkan tepat satu folder aplikasi `REPLIZ Publishing` per tenant/account.
- Folder hasil aplikasi lolos `files.get`, bertipe folder, tidak trashed, dan `canAddChildren=true`.
- Folder induk tidak memiliki permission `anyone/editor` yang dibuat aplikasi.
- File media staging mendapat `anyone/reader` dan lolos anonymous binary probe.
- Folder manual yang tidak visible menghasilkan instruksi create/repair, bukan instruksi re-login.
- URL maupun ID input dinormalisasi dan divalidasi.
- Semua operasi Drive relevan mendukung My Drive dan Shared Drive.
- Cache readiness tidak bocor antar-tenant/account/folder.
- Repliz tidak dipanggil bila folder/upload/permission/probe gagal.
- Tidak ada token, secret, atau URL sensitif tercetak pada response/log/test artifact.
- Test unit/integrasi terkait lulus dan production build lulus.
- Smoke test Dev lulus lebih dahulu; deploy Staging hanya setelah itu.
- Tidak ada deployment Production.

## 7. Strategi Verifikasi dan Deployment

1. Jalankan test terarah:

```bash
npm test -- tests/google-auth-health.test.js tests/publishing-drive-staging.test.js
npm run test:publishing-scheduler
```

2. Jalankan lint/type checks yang tersedia dan `npm run build`.
3. Deploy Dev dengan `npm run deploy:macmini-dev`.
4. Di UI Dev, klik create/repair lalu pastikan status folder hijau. Gunakan media dummy kecil untuk menguji upload + anonymous probe; jangan membuat posting Facebook/TikTok nyata.
5. Deploy Staging dengan `npm run deploy:staging` setelah Dev lulus.
6. Ulangi create/repair pada Staging karena setting per environment/schema. Folder yang sama boleh dipakai hanya bila memang visible terhadap OAuth app; default yang lebih aman adalah menyimpan hasil folder aplikasi yang tervalidasi.
7. Jangan polling SSH tiap 10–15 detik selama remote build; ikuti SOP repository.
8. Production hanya dengan instruksi eksplisit pengguna.
9. Setelah seluruh verifikasi berhasil, ikuti SOP rilis repository:

```bash
npm run release-non-interactive -- --type patch --title "Perbaiki akses folder Drive Repliz" --points "Buat folder publishing melalui OAuth app|Diagnosa folder drive.file secara tepat|Isolasi cache dan dukung Shared Drive"
```

## Execution Task List

- [ ] Baca `AGENTS.md`, guide Route Handler Next.js lokal, plan, dan prompt Antigravity seluruhnya.
- [ ] Simpan snapshot audit Dev/Staging yang sudah disanitasi; jangan simpan token/secret.
- [ ] Tambahkan helper scope dan status OAuth tanpa mengekspos credential.
- [ ] Implementasikan normalisasi Drive folder URL/ID dan unit test.
- [ ] Implementasikan `ensurePublishingDriveFolder()` idempoten dengan `appProperties`.
- [ ] Klasifikasikan 404 sebagai folder tidak visible ke app bila OAuth sehat.
- [ ] Ubah readiness cache menjadi tenant/account/folder scoped dan tambahkan invalidation.
- [ ] Tambahkan `supportsAllDrives` pada get/list/create/permission/delete yang relevan.
- [ ] Jadikan kegagalan public-reader permission sebagai blocking/fail-closed.
- [ ] Tambahkan endpoint admin tenant untuk create/repair folder.
- [ ] Lindungi endpoint status/disconnect dengan auth dan tenant context.
- [ ] Perbarui Settings UI untuk create/repair dan pesan remediasi spesifik.
- [ ] Tambahkan seluruh unit/integration tests pada acceptance criteria.
- [ ] Jalankan test terarah, publishing scheduler suite, dan build lokal.
- [ ] Deploy dan smoke test Dev tanpa posting eksternal nyata.
- [ ] Deploy dan smoke test Staging tanpa posting eksternal nyata.
- [ ] Minta admin menghapus `anyone/editor` dari folder manual lama setelah folder baru tervalidasi.
- [ ] Perbarui changelog, jalankan release non-interaktif, dan verifikasi commit/tag/push.
- [ ] Laporkan file berubah, hasil test/build/smoke, folder ID tersanitasi, versi/tag, risiko tersisa, dan rollback point.

## 8. Rollback

- Rollback kode ke tag rilis sebelumnya.
- Kembalikan `repliz_drive_folder_id` ke nilai sebelumnya hanya bila folder lama benar-benar lolos API readiness; jangan sekadar karena link browser dapat dibuka.
- Folder/file baru tidak dihapus otomatis saat rollback. Identifikasi melalui `appProperties.maknaPurpose` dan hapus manual setelah memastikan tidak direferensikan job aktif.
- Source media Nextcloud tidak pernah diubah atau dihapus oleh remediasi ini.
