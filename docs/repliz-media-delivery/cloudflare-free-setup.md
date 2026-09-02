# Panduan Cloudflare Free — `media.ast402.my.id`

## Peringatan Sebelum Konfigurasi

Secara teknis Cloudflare Tunnel dapat memetakan `media.ast402.my.id` ke service Next.js lokal. Akan tetapi, Cloudflare menyatakan public-hostname Tunnel pada paket Free, Pro, dan Business tunduk pada pembatasan penyajian video dan large files. Untuk produksi, gunakan Cloudflare Stream, R2 temporary staging, atau origin DNS-only sesuai keputusan arsitektur.

Referensi resmi:

- Tunnel routing: https://developers.cloudflare.com/tunnel/routing/
- Kebijakan video: https://developers.cloudflare.com/fundamentals/reference/policies-compliances/delivering-videos-with-cloudflare/
- Managed robots: https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/
- Free Bot Fight Mode: https://developers.cloudflare.com/bots/plans/free/

Langkah Tunnel di bawah hanya aman disebut PoC sampai aspek service terms diselesaikan.

## 1. Tambahkan Public Hostname

1. Masuk ke Cloudflare Dashboard.
2. Buka **Networking → Tunnels**.
3. Pilih tunnel yang berjalan pada Mac Mini staging.
4. Buka **Routes → Add route → Published application**.
5. Isi hostname: `media.ast402.my.id`.
6. Isi service URL staging: `http://127.0.0.1:5010`.
7. Simpan.
8. Pastikan Cloudflare membuat DNS record menuju `<TUNNEL-ID>.cfargotunnel.com` secara otomatis.

Jangan arahkan hostname langsung ke Node 3. Hanya service proxy Mac Mini yang boleh berbicara ke Nextcloud melalui Tailscale.

## 2. Jangan Gunakan Cloudflare Access untuk Path Media

Repliz tidak dapat menyelesaikan login, OTP, atau service-token flow interaktif. Pastikan `media.ast402.my.id/api/media-proxy` tidak berada di balik Access policy. Authorization dilakukan oleh signed URL aplikasi.

Jika hostname sudah memiliki Access application:

1. Buka **Zero Trust → Access → Applications**.
2. Periksa aplikasi yang mencakup `*.ast402.my.id`.
3. Keluarkan `media.ast402.my.id` dari aplikasi wildcard atau buat arsitektur hostname terpisah.
4. Jangan membuat bypass publik luas untuk aplikasi internal lain.

## 3. Managed `robots.txt`

Cloudflare Managed `robots.txt` tersedia pada semua paket dan dapat menambahkan `Disallow` untuk crawler tertentu, termasuk `meta-externalagent`. Karena endpoint ini ditujukan untuk media ingestion, origin harus menjadi sumber `robots.txt` yang eksplisit dan hasil akhirnya wajib diperiksa.

Di dashboard Cloudflare:

1. Pilih zone `ast402.my.id`.
2. Buka **Security → Settings**.
3. Filter **Bot traffic**.
4. Cari **Set your preference to block training in robots.txt** atau pengaturan managed robots yang setara.
5. Nonaktifkan managed `robots.txt` bila ia menambahkan blok yang konflik terhadap hostname media.
6. Pastikan aplikasi melayani response berikut pada `https://media.ast402.my.id/robots.txt`:

```txt
User-agent: *
Allow: /api/media-proxy
Disallow: /
```

Cloudflare mengelola setting pada level zone, sehingga perubahan dapat memengaruhi hostname lain. Setelah mengubah setting, periksa juga `https://cloud.ast402.my.id/robots.txt` dan hostname web utama. Bila zone utama harus tetap memblokir crawler, origin route harus menghasilkan isi berbeda berdasarkan hostname.

Verifikasi:

```bash
curl -i https://media.ast402.my.id/robots.txt
```

Jangan hanya melihat file source; response final dari edge Cloudflare adalah authority.

## 4. AI Bot Policies dan Bot Fight Mode Free

Pada paket Free:

- Bot Fight Mode bersifat zone-wide dan tidak dapat di-skip dengan custom rule per-path.
- Pengaturan Block AI Bots/AI bot policies dapat memblokir automated agent.
- Robots directive dan bot blocking adalah dua hal berbeda: `Allow` di robots tidak membatalkan WAF/bot challenge.

Untuk PoC:

1. Buka **Security → Settings**.
2. Pastikan kebijakan kategori **Agent** tidak memblokir request ke hostname media.
3. Jika Bot Fight Mode aktif dan Repliz menerima challenge/403, matikan Bot Fight Mode untuk zone selama smoke terkontrol atau jangan gunakan Tunnel proxy pada paket Free.
4. Jangan mengklaim custom Skip rule dapat mengecualikan Bot Fight Mode Free; Cloudflare secara resmi menyatakan fitur ini tidak dapat di-skip.

Karena setting tersebut zone-wide, opsi yang lebih aman adalah R2/Stream daripada menurunkan proteksi seluruh `ast402.my.id`.

## 5. WAF Custom Rules

Jangan membuat rule `Allow all` untuk seluruh hostname. Jika tersedia custom rules, batasi ekspresi pada hostname, path, dan metode:

```txt
(http.host eq "media.ast402.my.id"
 and starts_with(http.request.uri.path, "/api/media-proxy")
 and http.request.method in {"GET" "HEAD"})
```

Tujuan rule hanya menghindari custom challenge yang dibuat sendiri. Signature tetap diverifikasi aplikasi. Pada paket Free, rule ini tidak dapat melewati Bot Fight Mode.

Tambahkan block rule untuk metode selain `GET` dan `HEAD` bila kuota custom rule memungkinkan:

```txt
(http.host eq "media.ast402.my.id"
 and starts_with(http.request.uri.path, "/api/media-proxy")
 and not http.request.method in {"GET" "HEAD"})
```

Action: **Block**.

## 6. Cache dan Transformasi

- Jangan cache signed URL lintas tenant/job secara agresif.
- Jangan aktifkan HTML/browser challenge pada response video.
- Jangan aktifkan image/video transformation otomatis.
- Pertahankan query string karena memuat token/signature.
- Jangan membuat cache rule yang mengabaikan query string.

## 7. Environment Staging

Set pada environment runtime Mac Mini, bukan di Git:

```dotenv
MEDIA_DELIVERY_PROVIDER=proxy
PUBLIC_MEDIA_PROXY_URL=https://media.ast402.my.id
MEDIA_PROXY_ALLOWED_HOSTS=cloud.ast402.my.id
NEXTCLOUD_INTERNAL_BASE=http://100.78.186.123
MEDIA_PROXY_SIGNING_SECRET=<hasil openssl rand -hex 32>
MEDIA_PROXY_TOKEN_TTL_SECONDS=259200
```

Restart hanya service staging setelah build/deploy resmi. Jangan menerapkan konfigurasi pada production tanpa perintah eksplisit.

## 8. Smoke Test Eksternal

Gunakan satu signed URL test yang tidak dicetak ke log permanen.

```bash
curl -i https://media.ast402.my.id/robots.txt
curl -I '<SIGNED_MEDIA_URL>'
curl -i -H 'Range: bytes=0-1023' '<SIGNED_MEDIA_URL>' -o /tmp/media-range.bin
```

Hasil wajib:

- robots: `200 text/plain` dan path media diizinkan;
- HEAD: `200`, `Content-Type: video/mp4`, `Content-Length` valid;
- Range: `206 Partial Content`, `Content-Range: bytes 0-1023/...`, file 1024 byte;
- token rusak: `403`;
- token expired: `403` atau `410`;
- tidak ada `cf-mitigated: challenge` atau HTML challenge page;
- hostname/URL Nextcloud tidak muncul pada payload Repliz.

## 9. Troubleshooting

### Response HTML atau `cf-mitigated: challenge`

Periksa Bot Fight Mode, AI bot policy, Security Events, Browser Integrity Check, dan custom WAF rules. Pada Free, Bot Fight Mode tidak dapat dikecualikan per-path.

### `403 Restricted by robots.txt`

Ambil `https://media.ast402.my.id/robots.txt` dari jaringan luar dan pastikan Cloudflare tidak menambahkan managed block. Pastikan payload Repliz benar-benar memakai hostname media, bukan `cloud.ast402.my.id`.

### `200` untuk full GET tetapi Repliz gagal

Uji `HEAD` dan byte range. Downloader video sering membutuhkan `Content-Length`, `Accept-Ranges`, `206`, dan `Content-Range` yang konsisten.

### `502` atau timeout

Periksa konektivitas Mac Mini ke `100.78.186.123` melalui Tailscale, link share Nextcloud, dan timeout upstream. Jangan fallback ke URL publik Nextcloud.

## 10. Checklist Cloudflare

- [ ] Hostname `media.ast402.my.id` terdaftar pada tunnel yang benar.
- [ ] Service URL hanya menunjuk staging `127.0.0.1:5010` selama uji staging.
- [ ] Tidak ada Cloudflare Access pada media endpoint.
- [ ] Managed robots tidak menambahkan blok yang konflik.
- [ ] Response edge `/robots.txt` telah diverifikasi.
- [ ] AI bot policy tidak memblokir agent yang dibutuhkan.
- [ ] Bot Fight Mode Free dievaluasi dengan smoke Repliz nyata.
- [ ] Tidak ada rule yang mengabaikan query string token.
- [ ] `GET`, `HEAD`, dan `Range` lulus dari jaringan eksternal.
- [ ] Decision gate service terms selesai sebelum rollout produksi.
