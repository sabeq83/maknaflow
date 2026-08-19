# Implementation Plan — Integrasi Repliz ke Content Flow Publishing

## Tujuan

Menggunakan Repliz sebagai provider publishing dari menu Content Flow untuk Facebook, Instagram, TikTok, YouTube, Threads, dan LinkedIn, tanpa menghapus publisher Meta yang sudah ada.

## Keputusan Arsitektur

- Pertahankan `publishing_jobs` sebagai antrean dan sumber status internal MAKNA.
- Tambahkan `provider` (`meta` atau `repliz`) pada akun dan job.
- Satu target akun menghasilkan satu job dan satu `scheduleId` Repliz.
- MAKNA mengirim jadwal ke Repliz segera saat worker memproses job; Repliz menangani waktu publikasinya.
- Kredensial Repliz hanya dibaca server-side dengan HTTP Basic Auth.
- Akun sosial tetap dihubungkan dari Repliz; MAKNA hanya menyinkronkan akun yang sudah terhubung.
- MVP mencakup image/video, schedule, cancel, retry, dan status sync. Album, story, music, collaborator, product tag, dan analytics ditunda.

## Kontrak API Repliz yang Dipakai

- `GET /public/account?page=1&limit=100` — sinkronisasi akun.
- `POST /public/schedule` — membuat jadwal; hasil menyimpan `scheduleId`.
- `GET /public/schedule/{scheduleId}` — rekonsiliasi status.
- `PUT /public/schedule/{scheduleId}/retry` — retry provider.
- `DELETE /public/schedule/{scheduleId}` — pembatalan provider.
- Autentikasi: `Authorization: Basic base64(accessKey:secretKey)`.

Contoh payload video:

```json
{
  "title": "Judul konten",
  "description": "Caption dan hashtag",
  "topic": "",
  "type": "video",
  "medias": [{
    "alt": "",
    "customThumbnail": false,
    "type": "video",
    "thumbnail": "",
    "url": "https://media.example/video.mp4"
  }],
  "additionalInfo": {
    "isAiGenerated": true,
    "isDraft": false
  },
  "accountId": "REPLIZ_ACCOUNT_ID",
  "scheduleAt": "2026-08-20T03:00:00.000Z"
}
```

## Perubahan File dan Before/After

### 1. `lib/repliz-client.js` — file baru

**Code Sebelum (Current/Before)**

```js
// Belum ada adapter Repliz.
```

**Code Sesudah (Proposed/After)**

```js
export async function listReplizAccounts(credentials) {}
export async function createReplizSchedule(credentials, payload) {}
export async function getReplizSchedule(credentials, scheduleId) {}
export async function retryReplizSchedule(credentials, scheduleId) {}
export async function deleteReplizSchedule(credentials, scheduleId) {}
```

Adapter wajib memiliki timeout, respons JSON tervalidasi, error tersanitasi, dan tidak pernah mencatat header Authorization.

### 2. `app/api/settings/route.js`

**Code Sebelum (Current/Before)**

```js
contentflow_api_key: maskSecret(await getSetting('contentflow_api_key'))
```

**Code Sesudah (Proposed/After)**

```js
repliz_api_url: await getSetting('repliz_api_url') || 'https://api.repliz.com',
repliz_access_key: maskSecret(await getSetting('repliz_access_key')),
repliz_secret_key: maskSecret(await getSetting('repliz_secret_key')),
has_repliz_credentials: Boolean(accessKey && secretKey)
```

POST hanya mengganti secret bila nilai baru bukan placeholder/masked value.

### 3. `app/api/settings/test-repliz/route.js` — file baru

**Code Sebelum (Current/Before)**

```js
// Belum ada endpoint pengujian Repliz.
```

**Code Sesudah (Proposed/After)**

```js
export const POST = withTenantContext(async (request, _context, user) => {
  // admin-only; panggil GET /public/account dengan limit kecil
  // kembalikan success, jumlah akun, dan error tersanitasi
});
```

### 4. Halaman Settings yang memuat integrasi publishing

File UI harus ditemukan terlebih dahulu dengan `rg` karena field settings dapat berada di komponen terpisah.

**Code Sebelum (Current/Before)**

```jsx
{/* Belum ada bagian Repliz */}
```

**Code Sesudah (Proposed/After)**

```jsx
<IntegrationCard title="Repliz">
  {/* API URL, Access Key, Secret Key, Save, Test Connection */}
</IntegrationCard>
```

Tampilkan indikator configured/unconfigured; jangan pernah mengirim ulang secret asli ke browser.

### 5. `lib/db-pg.js`

**Code Sebelum (Current/Before)**

```sql
platform TEXT NOT NULL CHECK (platform IN ('facebook','instagram')),
token_ciphertext TEXT NOT NULL,
external_post_id TEXT
```

**Code Sesudah (Proposed/After)**

```sql
provider TEXT NOT NULL DEFAULT 'meta' CHECK (provider IN ('meta','repliz')),
platform TEXT NOT NULL CHECK (platform IN
  ('facebook','instagram','threads','tiktok','linkedin','youtube')),
provider_account_id TEXT,
token_ciphertext TEXT,
external_schedule_id TEXT
```

Migrasi harus idempotent, memperbarui constraint lama dengan aman, mempertahankan data Meta, serta menambahkan unique key `(tenant_id, provider, provider_account_id)` untuk akun Repliz.

### 6. `lib/publishing-repository.js`

**Code Sebelum (Current/Before)**

```js
savePublishingAccount({ platform, facebookPageId, instagramUserId, tokenCiphertext })
```

**Code Sesudah (Proposed/After)**

```js
savePublishingAccount({
  provider,
  platform,
  providerAccountId,
  displayName,
  status,
  providerState
})
```

Query list/detail job ikut mengembalikan `provider`, `provider_account_id`, dan `external_schedule_id`.

### 7. `app/api/v2/publishing/accounts/route.js`

**Code Sebelum (Current/Before)**

```js
// sync=1 hanya melakukan auto-sync Facebook/Instagram dari konfigurasi Meta.
```

**Code Sesudah (Proposed/After)**

```js
// GET ?sync=1&provider=repliz
// panggil listReplizAccounts(), upsert akun aktif, tandai akun yang hilang sebagai disconnected
// GET biasa menggabungkan akun Meta dan Repliz
```

Mapping platform hanya menerima enam platform yang didukung endpoint akun Repliz.

### 8. `lib/publishing-contract.js`

**Code Sebelum (Current/Before)**

```js
export const PUBLISHING_PLATFORMS = ['facebook', 'instagram'];
```

**Code Sesudah (Proposed/After)**

```js
export const PUBLISHING_PLATFORMS = [
  'facebook', 'instagram', 'threads', 'tiktok', 'linkedin', 'youtube'
];

export function validateProviderMediaContract({ provider, platform, mediaType, publishMode }) {}
```

Validasi Repliz mengikuti matriks API. MVP mengizinkan image/video; `reels` dinormalisasi menjadi `video`, kecuali Facebook Reels bila dipilih secara eksplisit.

### 9. `lib/publishing-worker.js`

**Code Sebelum (Current/Before)**

```js
// Eksekusi job langsung masuk ke alur Facebook atau Instagram Meta.
```

**Code Sesudah (Proposed/After)**

```js
if (job.provider === 'repliz') {
  return processReplizJob(job);
}
return processMetaJob(job);
```

`processReplizJob` harus:

- memastikan URL media HTTPS dapat diakses Repliz;
- memakai idempotency internal agar retry worker tidak membuat jadwal ganda;
- menyimpan `external_schedule_id` segera setelah create berhasil;
- melakukan rekonsiliasi GET bila hasil create ambigu/timeout;
- memetakan status Repliz ke status internal;
- menyinkronkan hasil ke kolom platform pada `content_flow_items`.

### 10. `app/api/v2/publishing/jobs/[id]/route.js` dan `retry/route.js`

**Code Sebelum (Current/Before)**

```js
// cancel/retry hanya mengubah lifecycle job internal atau jalur Meta.
```

**Code Sesudah (Proposed/After)**

```js
// Untuk provider=repliz dan scheduleId tersedia:
// cancel -> DELETE /public/schedule/{id}
// retry  -> PUT /public/schedule/{id}/retry atau rekreasi terkontrol
```

Perubahan provider dan database harus konsisten; kegagalan remote tidak boleh diam-diam ditandai sukses.

### 11. `app/content-flow/PublishingScheduler.js`

**Code Sebelum (Current/Before)**

```jsx
const unique = json.data.filter(acc => {
  const key = `${acc.platform}_${acc.facebook_page_id || ''}_${acc.instagram_user_id || ''}`;
});
```

**Code Sesudah (Proposed/After)**

```jsx
const key = `${acc.provider}_${acc.platform}_${acc.provider_account_id || acc.id}`;
```

UI juga menambahkan:

- filter/provider badge Meta atau Repliz;
- tombol `Sync Repliz Accounts`;
- platform Threads, TikTok, LinkedIn, dan YouTube;
- matriks tipe media berdasarkan akun terpilih;
- peringatan bahwa URL media harus publik;
- status/schedule ID Repliz pada detail job.

### 12. `app/api/v2/publishing/preflight/route.js`

**Code Sebelum (Current/Before)**

```js
// Pemeriksaan difokuskan pada kontrak Meta dan media.
```

**Code Sesudah (Proposed/After)**

```js
// Validasi per provider/platform, HEAD/range-check URL media,
// content-type, HTTPS, durasi akses URL, caption, dan akun connected.
```

### 13. `tests/publishing-scheduler.test.js` dan `tests/repliz-client.test.js`

**Code Sebelum (Current/Before)**

```js
// Belum ada mock kontrak Repliz.
```

**Code Sesudah (Proposed/After)**

```js
test('maps Content Flow video into Repliz schedule payload', () => {});
test('does not duplicate schedule after ambiguous timeout', () => {});
test('maps Repliz status to publishing job and Content Flow', () => {});
test('redacts Basic Auth credentials from errors', () => {});
```

## Status Mapping

| Repliz | MAKNA |
|---|---|
| draft/pending/scheduled | `scheduled` |
| processing/publishing | `processing` |
| published/success | `published` |
| failed/error | `failed` atau `retry_wait` berdasarkan klasifikasi |
| cancelled/deleted | `cancelled` |
| status tak dikenal | `needs_review` |

Nama status aktual wajib diverifikasi dari respons akun Repliz pengguna sebelum finalisasi mapping.

## Guardrails

- Jangan hard-code Access Key atau Secret Key.
- Jangan mengekspos secret lewat client component, log, error, test fixture, atau Git.
- Jangan mengubah Single-Pass Strategic Campaign Engine.
- Jangan menghapus jalur Meta yang sudah berjalan.
- Jangan deploy production tanpa instruksi eksplisit.
- Semua operasi harus tenant-scoped.
- Gunakan timeout, retry backoff, dan sanitasi error.
- Hindari schedule ganda ketika network timeout terjadi setelah Repliz menerima request.

## Execution Task List

- [ ] Baca panduan Next.js yang relevan di `node_modules/next/dist/docs/` sebelum mengubah route atau UI.
- [ ] Catat baseline `git status` dan jangan menyentuh perubahan pengguna yang tidak terkait.
- [ ] Verifikasi paket Repliz minimal Premium dan uji `GET /public/account` dengan credential nyata tanpa mencetak secret.
- [x] Implement `lib/repliz-client.js` beserta sanitasi dan timeout.
- [x] Tambahkan settings Repliz, masking secret, dan endpoint test connection.
- [x] Tambahkan UI konfigurasi Repliz pada Settings.
- [x] Buat migrasi PostgreSQL idempotent untuk provider, platform, account ID, dan schedule ID.
- [x] Perluas repository akun/job agar provider-aware dan tenant-safe.
- [x] Implementasikan sinkronisasi akun Repliz.
- [x] Perluas kontrak platform/media dan preflight.
- [x] Implementasikan create/reconcile/cancel/retry Repliz pada worker dan API job.
- [x] Perbarui UI Publishing Scheduler untuk akun dan platform Repliz.
- [x] Tambahkan unit/integration tests dengan mock HTTP; jangan memakai akun riil dalam tes otomatis.
- [x] Jalankan `npm run test:publishing-scheduler` dan tes Repliz.
- [ ] Jalankan lint/build yang relevan dan perbaiki seluruh regresi.
- [ ] Lakukan smoke test staging: sync account, schedule test, status sync, retry, dan cancel.
- [ ] Perbarui checkbox dokumen ini menjadi `[x]` segera setelah setiap tahap selesai.
- [ ] Setelah verifikasi berhasil, jalankan SOP release non-interaktif patch dengan judul dan changelog yang sesuai.
- [ ] Verifikasi branch `main` dan tag rilis sudah terunggah ke remote yang benar.

## Acceptance Criteria

- Admin dapat menyimpan dan menguji kredensial Repliz tanpa secret bocor.
- Akun Repliz tampil di Content Flow dengan provider dan platform yang benar.
- Satu konten dapat dijadwalkan ke beberapa akun lintas platform.
- Setiap target menghasilkan satu job dan paling banyak satu schedule aktif di Repliz.
- Status, error, cancel, dan retry terlihat dari Content Flow.
- Status published memperbarui kolom platform terkait pada `content_flow_items`.
- Jalur Meta lama dan seluruh tes existing tetap lulus.
- Media yang tidak dapat diakses publik gagal di preflight sebelum dikirim ke Repliz.

## Rollout

1. Feature flag `REPLIZ_PUBLISHING_ENABLED=false` secara default.
2. Aktifkan di development untuk satu akun uji.
3. Aktifkan staging dan lakukan posting privat/draft bila platform mendukung.
4. Pantau duplicate schedule, error rate, dan status lag selama minimal satu siklus jadwal.
5. Production hanya setelah perintah manual eksplisit pengguna.
