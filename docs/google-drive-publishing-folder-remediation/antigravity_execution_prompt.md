# Instruksi Agen Antigravity — Remediasi Folder Google Drive REPLIZ Publishing

Implementasikan seluruh rencana pada:

`docs/google-drive-publishing-folder-remediation/implementation_plan.md`

## Objective

Perbaiki kegagalan folder Google Drive di Dev dan Staging tanpa memperluas OAuth ke scope Drive penuh. Pertahankan `drive.file`, buat atau gunakan ulang folder `REPLIZ Publishing` melalui OAuth app secara idempoten, simpan ID yang tervalidasi per tenant, dan berikan diagnosis yang tepat bila folder manual tidak visible kepada aplikasi.

## Fakta Audit yang Tidak Boleh Diabaikan

- Dev dan Staging memakai OAuth account aktual `sabeq83@gmail.com`.
- Keduanya memiliki refresh token dan refresh berhasil dengan HTTP 200.
- Scope aktual keduanya memuat `https://www.googleapis.com/auth/drive.file`.
- Folder ID saat ini adalah `1fEn2ChMCvBWEc_LiiaxbEpRESjtO5Kg6`, panjang 33 tanpa whitespace.
- `files.get` menghasilkan 404 `notFound` pada kedua environment.
- `files.get` dengan `supportsAllDrives=true` juga tetap 404.
- Maka jangan mendiagnosis kasus ini sebagai token expired atau sekadar missing Shared Drive flag.
- Folder dibuat manual dan dibagikan `anyone/editor`. ACL publik itu bukan grant per-file kepada OAuth app dengan scope `drive.file`.

## Aturan Wajib

1. Baca `AGENTS.md`, implementation plan, dan file ini seluruhnya sebelum mengubah kode.
2. Sebelum mengubah Next.js Route Handler, baca guide relevan di `node_modules/next/dist/docs/` karena versi Next.js repository memiliki breaking changes.
3. Ikuti `## Execution Task List` berurutan. Ubah checkbox menjadi `[x]` segera setelah tahap benar-benar selesai, bukan di akhir secara massal.
4. Pertahankan OAuth scope `drive.file`. Jangan menambah `drive`/`drive.readonly` tanpa keputusan baru dari pengguna.
5. Solusi utama adalah folder yang dibuat aplikasi dengan `files.create`, bukan folder publik manual.
6. Create/repair wajib idempoten menggunakan `appProperties`, bukan hanya nama folder.
7. Folder induk tidak boleh dibuat public. Hanya file staging yang boleh mendapat `anyone/reader`.
8. Jangan membuat permission `anyone/editor` pada folder atau file.
9. Jika permission `anyone/reader` pada file ditolak, hentikan pipeline dan jangan panggil Repliz.
10. Tambahkan `supportsAllDrives=true` serta parameter list yang relevan pada seluruh operasi Drive yang menyentuh publishing media.
11. Semua endpoint status, create/repair, dan disconnect harus memakai autentikasi admin + tenant context.
12. Readiness cache harus terisolasi minimal berdasarkan tenant, account, dan folder ID. Pastikan invalidation setelah OAuth callback, disconnect, perubahan setting, dan create/repair.
13. Jangan log atau mengembalikan access token, refresh token, client secret, credential Repliz, atau URL Nextcloud bertanda tangan.
14. Gunakan `apply_patch`; jangan menimpa perubahan user yang tidak terkait.
15. Jangan deploy Production.
16. Jangan membuat schedule/post Facebook, TikTok, Instagram, atau platform nyata saat smoke tanpa persetujuan eksplisit pengguna.

## Semantik Error

- Token refresh gagal `invalid_grant` → `GOOGLE_REAUTH_REQUIRED`.
- Token sehat tetapi folder 404 → `GOOGLE_DRIVE_FOLDER_NOT_VISIBLE_TO_APP` dan tawarkan create/repair.
- Scope kompatibel tidak ada → `GOOGLE_DRIVE_SCOPE_MISSING` dan tawarkan consent ulang.
- Resource bukan folder/trashed → `GOOGLE_DRIVE_FOLDER_INVALID`.
- `canAddChildren=false` → `GOOGLE_DRIVE_FOLDER_NOT_WRITABLE`.
- Permission publik pada file ditolak → `GOOGLE_DRIVE_PUBLIC_SHARING_BLOCKED`.
- 429/timeout/5xx → `GOOGLE_DRIVE_TEMPORARILY_UNAVAILABLE`.

Jangan menggabungkan seluruh error Drive menjadi “file not found”. Jangan menyuruh user reconnect untuk 404 bila token refresh dan userinfo berhasil.

## Implementasi Minimum

- `lib/google-auth.js`: laporkan granted scope yang disanitasi.
- `lib/publishing-drive-staging.js`: normalize ID, verify, create/repair, appProperties, tenant-safe cache, error mapping.
- `lib/drive-uploader.js`: Shared Drive flags, public reader fail-closed, cleanup aman.
- `app/api/google/publishing-folder/route.js`: POST create/repair khusus admin tenant.
- `app/api/google/status/route.js`: auth + tenant context dan status diagnosis.
- `app/api/settings/route.js`: parsing URL/ID dan cache invalidation.
- `app/settings/page.js`: tombol create/repair, status email/scope/folder, pesan yang tepat.
- Test sesuai seluruh acceptance criteria pada implementation plan.

## Verifikasi

1. Mock Drive API untuk membuktikan create hanya sekali dan retry reuse folder yang sama.
2. Buktikan 404 dengan token sehat tidak memicu reconnect.
3. Buktikan cache tenant A tidak dapat terbaca tenant B.
4. Buktikan setiap operasi penting mengirim Shared Drive flags.
5. Buktikan permission failure menghentikan panggilan Repliz.
6. Jalankan:

```bash
npm test -- tests/google-auth-health.test.js tests/publishing-drive-staging.test.js
npm run test:publishing-scheduler
npm run build
```

7. Deploy Dev dahulu dengan `npm run deploy:macmini-dev`.
8. Smoke Dev: create/repair, verify folder, upload dummy kecil, anonymous binary probe. Jangan posting nyata.
9. Baru deploy Staging dengan `npm run deploy:staging` dan ulangi smoke yang sama.
10. Ikuti SOP remote build dan jangan polling SSH berulang tiap 10–15 detik.

## Keamanan Folder

Setelah folder aplikasi tervalidasi, beri tahu user untuk menghapus akses `anyone/editor` dari folder manual lama. Folder publishing tidak perlu public. Repliz hanya memerlukan file media staging yang dapat dibaca anonim (`anyone/reader`). Jika kebijakan Google menolak public file sharing, tampilkan error eksplisit; jangan melemahkan keamanan folder sebagai workaround.

## Release

Setelah test, build, Dev smoke, dan Staging smoke benar-benar lulus, jalankan SOP release repository:

```bash
npm run release-non-interactive -- --type patch --title "Perbaiki akses folder Drive Repliz" --points "Buat folder publishing melalui OAuth app|Diagnosa folder drive.file secara tepat|Isolasi cache dan dukung Shared Drive"
```

Verifikasi branch dan tag pada remote resmi. Jangan menandai checkbox release sebelum push terbukti sukses.

## Laporan Akhir

Laporkan:

- root cause yang dikonfirmasi;
- file yang berubah;
- hasil test/build;
- hasil smoke Dev dan Staging tanpa token/URL sensitif;
- status folder visible/writable dan anonymous probe;
- bukti tidak ada posting eksternal nyata;
- versi, commit, tag, dan push;
- risiko tersisa dan rollback point.
