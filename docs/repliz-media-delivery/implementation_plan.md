# Implementation Plan — Repliz Media Delivery untuk Facebook dan TikTok

## 1. Ringkasan

Tujuan perubahan adalah memastikan Repliz tidak pernah menerima URL Nextcloud `cloud.ast402.my.id` secara langsung. File sumber tetap berada di Nextcloud, tetapi URL yang diberikan kepada Repliz harus melewati media delivery layer yang:

- dapat diakses tanpa login oleh Repliz selama waktu terbatas;
- mendukung `GET`, `HEAD`, dan HTTP byte range (`206 Partial Content`);
- tidak diblokir `robots.txt`, Cloudflare Access, atau challenge bot;
- menggunakan signed URL dengan expiry dan scope tenant/job;
- gagal secara tertutup: jika staging media gagal, schedule Repliz tidak dibuat;
- menghasilkan observability yang membedakan kegagalan source, signature, proxy, dan provider.

## 2. Keputusan Arsitektur dan Batas Cloudflare Free

### 2.1 Decision gate wajib sebelum implementasi produksi

Cloudflare mengizinkan pembuatan public hostname Tunnel seperti `media.ast402.my.id` menuju service lokal. Namun dokumentasi resmi Cloudflare menyatakan bahwa traffic video/large files melalui public-hostname Tunnel pada Free, Pro, dan Business tunduk pada pembatasan layanan video. Cloudflare dapat melakukan redirect atau tindakan lain bila aplikasi terlihat menyajikan video atau jumlah besar file besar tanpa layanan yang sesuai.

Referensi:

- https://developers.cloudflare.com/tunnel/routing/
- https://developers.cloudflare.com/fundamentals/reference/policies-compliances/delivering-videos-with-cloudflare/
- https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/
- https://developers.cloudflare.com/waf/feature-interoperability/

Karena itu, pilihan produksi harus diputuskan sebelum coding:

1. **Direkomendasikan untuk Cloudflare Free: R2 temporary staging** — file asli tetap di Nextcloud, salinan sementara di R2 dibuat hanya untuk publishing, diberi expiry maksimal tujuh hari, lalu dibersihkan. R2 memiliki free tier, tetapi memerlukan aktivasi subscription dan tetap dapat menimbulkan biaya di atas kuota.
2. **Cloudflare Stream** — patuh untuk video delivery dan mendukung signed access, tetapi berbayar serta melakukan penyimpanan/transcoding.
3. **DNS-only signed origin** — tidak melewati proxy CDN Cloudflare sehingga tidak terkena pembatasan video Cloudflare, tetapi membutuhkan public ingress yang diamankan dan mengurangi manfaat Tunnel.
4. **Tunnel streaming PoC saja** — dapat diuji dengan `media.ast402.my.id`, tetapi tidak boleh dipromosikan menjadi jalur produksi sebelum kepatuhan service terms dikonfirmasi.

Plan kode di bawah memakai abstraksi `MEDIA_DELIVERY_PROVIDER`. Implementasi awal wajib mendukung `proxy` untuk PoC dan dibuat agar backend `r2` atau `stream` dapat ditambahkan tanpa mengubah kontrak worker.

## 3. Arsitektur Target

```text
Content Flow job
  -> stagePublishingMedia(job)
      -> source Nextcloud melalui Tailscale
      -> provider proxy | r2 | stream
      -> anonymous compatibility probe (HEAD + Range GET)
      -> signed/temporary public URL
  -> createReplizSchedule(media URL hasil staging)
  -> poll Repliz
  -> cleanup media sementara setelah terminal + retention
```

Untuk provider `proxy`:

```text
Repliz
  -> HTTPS media.ast402.my.id/v1/media/<opaque-token>
  -> Cloudflare public hostname (PoC only pada Free)
  -> Next.js Media Route Handler di Mac Mini
  -> Tailscale internal http://100.78.186.123
  -> Nextcloud source stream
```

## 4. Kontrak Keamanan

- Token memakai HMAC-SHA256 dengan secret khusus `MEDIA_PROXY_SIGNING_SECRET`, bukan Base64 URL biasa.
- Payload minimum: `version`, `tenantId`, `jobId`, `sourcePath`, `exp`.
- `sourcePath` hanya boleh pathname dan query dari hostname allowlist; token tidak boleh membawa arbitrary upstream URL.
- Validasi signature memakai constant-time comparison.
- Expiry default 72 jam dan harus melewati waktu schedule plus grace period.
- Hanya `GET` dan `HEAD`; metode lain `405`.
- Forward hanya header `Range` dan header conditional yang memang diperlukan.
- Tolak redirect upstream ke host di luar origin Nextcloud internal.
- Jangan log token, signature, share token Nextcloud, atau query URL penuh.
- Middleware boleh melewati session auth hanya karena endpoint dilindungi signature yang valid.
- Response menggunakan `Content-Disposition: inline`, `X-Content-Type-Options: nosniff`, dan CORS minimal; CORS bukan mekanisme keamanan.

## 5. Perubahan File dan Before/After

### 5.1 `lib/media-delivery.js` — file baru

#### Code Sebelum (Current/Before)

```js
// File belum ada. Resolusi URL saat ini tertanam di publishing-worker.js.
```

#### Code Sesudah (Proposed/After)

```js
export async function stagePublishingMedia(job) {
  const provider = process.env.MEDIA_DELIVERY_PROVIDER || 'proxy';
  const source = parseAllowedNextcloudSource(job.media_url_snapshot);

  const result = provider === 'proxy'
    ? await createSignedProxyMedia(job, source)
    : await stageToConfiguredObjectProvider(provider, job, source);

  await assertProviderCanFetch(result.publicUrl);
  return result;
}
```

Modul mengembalikan `{ provider, publicUrl, expiresAt, cleanupRef }` dan melempar error terklasifikasi seperti `MEDIA_SOURCE_INVALID`, `MEDIA_PROXY_CONFIG_MISSING`, `MEDIA_STAGING_FAILED`, atau `MEDIA_PUBLIC_PROBE_FAILED`.

### 5.2 `lib/media-proxy-token.js` — file baru

#### Code Sebelum (Current/Before)

```js
// File belum ada. Endpoint lama hanya menerima URL yang di-encode Base64URL.
```

#### Code Sesudah (Proposed/After)

```js
export function signMediaToken(claims, secret) {
  const payload = encodeCanonicalClaims(claims);
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyMediaToken(token, secret, now = Date.now()) {
  // parse, constant-time verify, validate exp, tenant/job/sourcePath
  return claims;
}
```

Tambahkan batas panjang token dan schema validation tanpa dependency baru jika memungkinkan.

### 5.3 `app/api/media-proxy/route.js` — modifikasi

#### Code Sebelum (Current/Before)

```js
const encodedUrl = searchParams.get('url');
targetUrl = Buffer.from(encodedUrl, 'base64url').toString('utf-8');
const upstream = await fetch(internalUrl, { method: 'GET' });
return new NextResponse(upstream.body, { status: 200, headers: responseHeaders });
```

#### Code Sesudah (Proposed/After)

```js
export async function GET(request) {
  return serveSignedMedia(request, { headOnly: false });
}

export async function HEAD(request) {
  return serveSignedMedia(request, { headOnly: true });
}

async function serveSignedMedia(request, { headOnly }) {
  const claims = verifyMediaToken(request.nextUrl.searchParams.get('token'), signingSecret);
  const range = request.headers.get('range');
  const upstream = await fetch(buildInternalUrl(claims.sourcePath), {
    method: headOnly ? 'HEAD' : 'GET',
    headers: range ? { Range: range } : {},
    redirect: 'manual',
  });
  return relayUpstreamResponse(upstream, { headOnly });
}
```

Relay wajib mempertahankan status `200`/`206`, `Content-Type`, `Content-Length`, `Content-Range`, `Accept-Ranges`, `ETag`, dan `Last-Modified`. Error eksternal harus generik dan tidak membocorkan internal URL.

### 5.4 `lib/publishing-worker.js` — modifikasi

#### Code Sebelum (Current/Before)

```js
try {
  const resolvedMediaUrl = await ensurePublicMediaUrl(job);
  // create Repliz schedule
} catch (err) {
  console.error(`ensurePublicMediaUrl error: ${err.message} — fallback ke URL original`);
  return mediaUrl;
}
```

#### Code Sesudah (Proposed/After)

```js
const staged = await stagePublishingMedia(job);
await markPublishingResult(job.tenant_id, job.id, {
  media_url_snapshot: staged.publicUrl,
  provider_stage: 'media_ready',
  provider_state_json: { ...state, mediaDelivery: redactDeliveryState(staged) },
});

// Hanya dipanggil sesudah anonymous HEAD dan Range probe lolos.
await createReplizSchedule(credentials, buildPayload(job, staged.publicUrl));
```

Hapus fallback ke URL Nextcloud. Catat attempt `media_staging` sebelum `repliz_request`. Jangan hitung polling status sebagai retry eksekusi.

### 5.5 `app/api/v2/publishing/preflight/route.js` — modifikasi

#### Code Sebelum (Current/Before)

```js
const headRes = await fetch(cleanUrl, { method: 'HEAD' });
if (!headRes.ok && headRes.status !== 405) {
  warnings.push('Server media tidak dapat dijangkau');
}
```

#### Code Sesudah (Proposed/After)

```js
const staged = await stagePublishingMediaPreview({ tenantId, mediaUrl: cleanUrl, scheduledAt });
const probe = await probePublicMediaContract(staged.publicUrl, {
  requireHead: true,
  requireRange: mediaType === 'video' || mediaType === 'reels',
});
if (!probe.ok) errors.push(probe.message);
```

Preflight harus menjadi error, bukan warning, bila provider target tidak dapat mengambil media secara anonim.

### 5.6 `app/robots.txt/route.js` — file baru

#### Code Sebelum (Current/Before)

```txt
# Tidak ada origin robots route khusus media.ast402.my.id.
```

#### Code Sesudah (Proposed/After)

```js
export function GET(request) {
  const host = request.headers.get('host')?.split(':')[0];
  if (host === 'media.ast402.my.id') {
    return new Response('User-agent: *\nAllow: /api/media-proxy\nDisallow: /\n', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  return new Response('User-agent: *\nDisallow: /\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
```

Catatan: robots hanya deklarasi crawler, bukan authorization. Security tetap berasal dari signature dan expiry.

### 5.7 `middleware.js` — modifikasi

#### Code Sebelum (Current/Before)

```js
pathname.startsWith('/api/media-proxy') || // public
```

#### Code Sesudah (Proposed/After)

```js
pathname.startsWith('/api/media-proxy') || // signed public media endpoint
pathname === '/robots.txt' ||
```

Middleware tidak memvalidasi token; Route Handler tetap menjadi authority validasi.

### 5.8 `.env.staging.local.example` — modifikasi

#### Code Sebelum (Current/Before)

```dotenv
MAKNA_PUBLIC_BASE_URL=http://127.0.0.1:5010
```

#### Code Sesudah (Proposed/After)

```dotenv
MAKNA_PUBLIC_BASE_URL=http://127.0.0.1:5010
MEDIA_DELIVERY_PROVIDER=proxy
PUBLIC_MEDIA_PROXY_URL=https://media.ast402.my.id
MEDIA_PROXY_ALLOWED_HOSTS=cloud.ast402.my.id
NEXTCLOUD_INTERNAL_BASE=http://100.78.186.123
MEDIA_PROXY_SIGNING_SECRET=replace_with_openssl_rand_hex_32
MEDIA_PROXY_TOKEN_TTL_SECONDS=259200
```

Secret aktual hanya disimpan di environment server, tidak pernah di-commit.

### 5.9 `tests/media-proxy.test.js` — file baru

#### Code Sebelum (Current/Before)

```js
// Belum ada test khusus media proxy.
```

#### Code Sesudah (Proposed/After)

```js
test('signed token rejects tampering and expiry', () => {});
test('proxy forwards HEAD without response body', () => {});
test('proxy relays byte range as 206 with Content-Range', () => {});
test('proxy rejects redirect and non-whitelisted source', () => {});
test('proxy never logs token or Nextcloud share URL', () => {});
```

### 5.10 `tests/publishing-scheduler.test.js` — modifikasi

#### Code Sebelum (Current/Before)

```js
// Belum ada assertion bahwa URL Nextcloud tidak boleh diteruskan ke Repliz.
```

#### Code Sesudah (Proposed/After)

```js
test('Repliz jobs never receive raw Nextcloud URLs', async () => {});
test('media staging failure prevents Repliz schedule creation', async () => {});
test('successful staging persists the resolved public URL', async () => {});
test('provider polling does not consume execution retry budget', async () => {});
```

### 5.11 `sot/global/changelog.md` — modifikasi saat implementasi selesai

#### Code Sebelum (Current/Before)

```md
# Changelog

## V2.29.19 — ...
```

#### Code Sesudah (Proposed/After)

```md
# Changelog

## V2.29.20 — Harden Repliz Media Delivery (...)
- Signed expiring media URLs dan byte-range proxy
- Fail-closed staging sebelum schedule Repliz
- Preflight dan observability media delivery
```

Nomor aktual harus dihitung oleh release script dari versi terbaru pada saat eksekusi.

## 6. Panduan Cloudflare Free

Panduan operasional lengkap berada di `docs/repliz-media-delivery/cloudflare-free-setup.md`. Hal penting:

- `media.ast402.my.id` boleh dibuat dalam zone `ast402.my.id`.
- Public hostname Tunnel hanya untuk PoC karena pembatasan video/large-file Cloudflare.
- Jangan pasang Cloudflare Access pada media path.
- Pada Free plan, Bot Fight Mode tidak dapat di-skip per-path. Bila menyebabkan challenge terhadap Repliz, matikan Bot Fight Mode untuk zone atau pindah ke delivery provider yang cocok.
- Managed `robots.txt` dapat menambahkan blok crawler. Matikan managed robots untuk zone bila menimpa kebutuhan media, lalu serve robots origin yang eksplisit.
- Pengaturan zone memengaruhi seluruh hostname; verifikasi `robots.txt` aktual untuk hostname media setelah setiap perubahan.

## 7. Strategi Migrasi Job Gagal

1. Jangan mengulang schedule Repliz lama dengan URL Nextcloud yang sudah tersimpan.
2. Setelah delivery provider lolos smoke test, buat signed/temporary URL baru per job.
3. Buat schedule Repliz baru dengan idempotency key baru yang ditautkan ke job asal.
4. Tandai schedule lama sebagai superseded/cancelled bila API mengizinkan.
5. Mulai dari satu video NutriBake ke Facebook dan TikTok.
6. Verifikasi status provider, permalink, dan tidak ada request ke `cloud.ast402.my.id` dari Repliz.

## 8. Verification Matrix

| Pemeriksaan | Hasil wajib |
|---|---|
| `GET /robots.txt` pada hostname media | `Allow` untuk path media, tanpa blok efektif yang konflik |
| Anonymous `HEAD` signed URL | `200`, content type dan length benar |
| Anonymous `Range: bytes=0-1023` | `206`, `Content-Range`, tepat 1024 byte |
| Token dimodifikasi | `403` |
| Token expired | `410` atau `403` konsisten |
| URL source host lain | `403` sebelum fetch |
| Nextcloud internal unreachable | `502/504`, schedule Repliz tidak dibuat |
| Facebook Repliz smoke | media berhasil diambil dan dipublish |
| TikTok Repliz smoke | bukan error `internal`, hasil terminal terverifikasi |
| Log audit | tanpa token, secret, atau Nextcloud share URL |

## 9. Rollback

- Pause publishing worker sebelum rollout/rollback.
- Rollback aplikasi ke tag sebelumnya bila proxy menghasilkan error.
- Jangan mengaktifkan fallback raw Nextcloud.
- Provider sementara dapat dialihkan ke `r2`/`stream` melalui konfigurasi setelah implementasinya tersedia.
- Job yang belum dikirim ke Repliz dapat dijadwalkan ulang; schedule eksternal yang sudah dibuat direkonsiliasi sebelum tindakan baru.

## 10. Execution Task List

- [ ] Tahap 0 — Konfirmasi pilihan provider produksi (`r2`, `stream`, atau origin DNS-only); tandai Tunnel proxy sebagai PoC bila tetap menggunakan Cloudflare Free.
- [ ] Tahap 1 — Buat secret media proxy, konfigurasi hostname/environment, dan pastikan tidak ada secret masuk Git.
- [ ] Tahap 2 — Implementasikan token signing/verification dan unit test tamper/expiry.
- [ ] Tahap 3 — Implementasikan delivery abstraction dan provider `proxy` dengan SSRF guard.
- [ ] Tahap 4 — Upgrade Route Handler dengan `GET`, `HEAD`, byte range, safe headers, timeout, dan redacted logging.
- [ ] Tahap 5 — Implementasikan hostname-aware `robots.txt` dan middleware public routing.
- [ ] Tahap 6 — Integrasikan worker secara fail-closed serta attempt stage `media_staging`.
- [ ] Tahap 7 — Perkuat publishing preflight dengan anonymous HEAD dan Range probe.
- [ ] Tahap 8 — Tambahkan regression tests agar raw Nextcloud URL tidak pernah masuk payload Repliz.
- [ ] Tahap 9 — Jalankan unit test publishing, build Next.js, dan security smoke lokal.
- [ ] Tahap 10 — Konfigurasi Cloudflare sesuai panduan dan verifikasi response dari jaringan eksternal.
- [ ] Tahap 11 — Deploy ke staging dengan `npm run deploy:staging`, tunggu remote build sesuai SOP tanpa polling SSH berulang.
- [ ] Tahap 12 — Jalankan smoke satu video Facebook dan TikTok serta audit Repliz/DB/log.
- [ ] Tahap 13 — Migrasikan job gagal setelah smoke sukses dan approval operasional.
- [ ] Tahap 14 — Update changelog, jalankan release non-interaktif patch, dan verifikasi branch/tag remote.

