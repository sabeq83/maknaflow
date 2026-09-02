# Instruksi untuk Agen Antigravity — Google Drive Repliz Hardening

Implementasikan seluruh rencana pada:

`docs/google-drive-publishing-hardening/implementation_plan.md`

## Objective

Pastikan Facebook dan TikTok via Repliz selalu menerima URL Google Drive yang sudah lolos anonymous download probe. Sistem harus mendeteksi OAuth revoked sebelum schedule disimpan, meminta user reconnect, mengulangi check ketika worker due, dan tidak pernah fallback ke URL Nextcloud mentah.

## Konteks Audit Staging

- Google refresh token saat audit menghasilkan `invalid_grant: Token has been expired or revoked`.
- `repliz_drive_folder_id` belum tersedia di staging.
- Job Facebook gagal dengan `403 Restricted by robots.txt`.
- Job TikTok berpasangan gagal dengan `internal`.
- Semua job tersebut tetap membawa URL `cloud.ast402.my.id`.
- File Nextcloud dapat diambil dari Mac Mini melalui URL internal dengan HTTP 200.
- Jalur upload Google Drive pernah sukses di server Dev.

## Aturan Wajib

1. Baca `AGENTS.md` dan implementation plan seluruhnya sebelum mengubah kode.
2. Baca guide Next.js relevan di `node_modules/next/dist/docs/` sebelum menyentuh Route Handler.
3. Scope hanya Google Drive hardening. Jangan membangun media proxy, R2, Stream, atau konfigurasi Cloudflare.
4. Jangan pernah mengirim URL Nextcloud mentah ke Repliz.
5. Jangan menganggap access token expired sebagai reauth jika refresh token masih berhasil.
6. `invalid_grant`/revoked refresh token harus menjadi `GOOGLE_REAUTH_REQUIRED` dan menghentikan scheduling.
7. Preflight UI tidak dipercaya; endpoint POST scheduling dan worker wajib melakukan check sendiri.
8. External schedule Repliz hanya dibuat setelah upload, public permission, dan anonymous probe sukses.
9. Jangan log OAuth token, client secret, URL share Nextcloud lengkap, atau credential Repliz.
10. Jangan deploy production.
11. Jangan retry/migrasikan job gagal lama atau membuat posting nyata sebelum tahap smoke dan authority yang sesuai.
12. Gunakan `apply_patch` dan pertahankan perubahan user yang tidak terkait.

## Kontrol Progress

Ikuti `## Execution Task List` secara kronologis. Setelah setiap tahap benar-benar selesai, segera ubah checkbox tahap tersebut dari `- [ ]` menjadi `- [x]` di implementation plan. Jangan menandai test, deploy, smoke, migrasi, atau release sebelum bukti keberhasilannya tersedia.

## Detail Implementasi Kritis

- Gunakan `await oauthClient.getAccessToken()` atau operasi Google resmi yang memicu refresh.
- Setelah refresh, lakukan `drive.files.get` pada `repliz_drive_folder_id` dengan field minimal.
- Pertahankan refresh token lama ketika Google hanya mengembalikan access token baru.
- Map error Google secara deterministik: reauth, folder missing, permission, transient, unknown.
- Upload memakai identity job pada `appProperties` untuk idempotency.
- Anonymous probe sama sekali tidak boleh memakai OAuth header atau cookie.
- Probe harus mengikuti redirect secara aman, menerima `200/206`, memvalidasi MIME, dan menolak HTML/login page.
- Simpan file ID agar retry tidak upload ulang.
- Cleanup hanya menghapus salinan Google Drive setelah retention dan parent job terminal; tidak boleh menyentuh Nextcloud.
- OAuth `returnTo` wajib ditandatangani atau divalidasi allowlist untuk mencegah open redirect.
- Draft scheduling disimpan hanya di `sessionStorage` dan dibersihkan setelah submit sukses/cancel eksplisit.

## Acceptance Criteria

- Refresh token valid memperbarui access token tanpa meminta login.
- Revoked token menghasilkan modal reconnect sebelum job dibuat.
- Missing/trashed/read-only folder memblokir scheduling dengan pesan spesifik.
- Worker mengulangi readiness check tepat sebelum staging.
- Repliz mock tidak pernah menerima `cloud.ast402.my.id`.
- Upload/probe failure tidak membuat external schedule.
- Retry worker tidak menghasilkan file Drive duplikat.
- Settings menunjukkan status aktual, bukan hanya keberadaan token.
- Semua test baru dan `npm run test:publishing-scheduler` lulus.
- Next.js production build lulus.
- Smoke staging Facebook dan TikTok menunjukkan URL Drive dan hasil terminal terverifikasi.
- Cleanup test membuktikan source Nextcloud tidak dihapus.

## Deployment dan Release

1. Verifikasi lokal dahulu.
2. Konfigurasi/reconnect Google staging melalui UI; jangan memasukkan token ke command atau log.
3. Deploy hanya staging memakai `npm run deploy:staging`.
4. Ikuti SOP remote build. Jangan polling SSH setiap 10–15 detik; tunggu sesuai mekanisme yang ditentukan repository.
5. Jangan deploy production tanpa instruksi manual eksplisit user.
6. Setelah staging smoke sukses, update changelog dan jalankan:

```bash
npm run release-non-interactive -- --type patch --title "Harden Google Drive Staging untuk Repliz" --points "Tambah OAuth dan folder readiness gate|Pastikan upload dan anonymous probe sebelum Repliz|Tambah reconnect UX dan cleanup staging Drive"
```

7. Verifikasi branch `main` dan tag baru ada di remote resmi.

## Laporan Akhir

Sertakan:

- file yang berubah;
- state OAuth/folder sebelum dan sesudah;
- hasil seluruh test dan build;
- bukti anonymous Drive probe tanpa membocorkan URL/token;
- ID job smoke yang aman ditampilkan dan hasil Facebook/TikTok;
- status migrasi job lama;
- risiko tersisa dan rollback point;
- versi, commit, tag, dan hasil push.
