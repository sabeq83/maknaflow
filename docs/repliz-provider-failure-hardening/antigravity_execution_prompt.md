# Instruksi Agen Antigravity — Hardening Facebook & TikTok via Repliz

Implementasikan seluruh rencana di:

`docs/repliz-provider-failure-hardening/implementation_plan.md`

## Objective

Perbaiki diagnosis, retry policy, telemetry, account health, dan UX kegagalan Facebook/TikTok via Repliz. Jangan mengubah solusi Google Drive karena media staging terbaru sudah verified dan Instagram berhasil menggunakan video yang sama.

## Fakta Audit Wajib

- Job terbaru Facebook, Instagram, dan TikTok semuanya memakai URL Google Drive yang verified.
- Instagram berhasil.
- Facebook gagal di Repliz/Graph API dengan `Unsupported get request` dan indikasi missing permission/object access.
- TikTok gagal dengan `internal`.
- File TikTok valid: MP4 H.264/AAC, 720×1280, sekitar 30 fps, 28 detik, 6,4 MB.
- Ketiga account Repliz dilaporkan `isConnected=true`; ini tidak membuktikan permission Page/posting masih valid.
- `attempt_count` ditemukan 4–5 sementara `max_attempts=3`.
- Error robots.txt hanya berasal dari job lama sebelum Drive remediation.

## Aturan Wajib

1. Baca `AGENTS.md`, implementation plan, dan prompt ini seluruhnya.
2. Baca dokumentasi Next.js lokal di `node_modules/next/dist/docs/` sebelum mengubah Route Handler.
3. Update `## Execution Task List` secara real-time; jangan menandai tahap yang belum terbukti.
4. Gunakan `apply_patch` dan pertahankan perubahan user yang tidak terkait.
5. Jangan mengubah scope OAuth Google, folder Drive, media proxy, Cloudflare, atau Tailscale.
6. Jangan pernah fallback ke URL Nextcloud untuk Repliz.
7. Pisahkan execution attempt dari GET polling. Polling tidak boleh menghabiskan retry budget.
8. Tegakkan maksimum attempt secara atomik di query claim, aman terhadap worker paralel.
9. Gunakan attempt number 1-based dalam log/UI.
10. Facebook permission/object error harus `needs_review`, non-retryable otomatis, dengan tindakan reconnect.
11. TikTok `internal` boleh retry terbatas dengan backoff; berhenti tepat saat budget habis.
12. Manual retry untuk account-action error memerlukan admin, tenant context, health check, dan konfirmasi bahwa reconnect telah dilakukan.
13. Reuse `external_schedule_id` dan media staging verified. Jangan membuat schedule/file duplikat saat retry.
14. Simpan hanya provider state allowlisted. Jangan simpan/log token, Basic Auth, client secret, signed URL, atau response mentah.
15. Tombol reconnect membuka dashboard/flow Repliz yang benar; jangan mengklaim MAKNA dapat memperbarui token Facebook/TikTok sendiri.
16. Jangan retry, delete, atau membuat schedule/post nyata selama implementasi dan smoke tanpa persetujuan eksplisit pengguna.
17. Jangan deploy Production.

## Error Mapping Minimum

| Kondisi | Code | Class | Auto-retry | Status |
|---|---|---|---:|---|
| Facebook object/missing permission | `REPLIZ_FACEBOOK_PERMISSION_REQUIRED` | `account_action_required` | tidak | `needs_review` |
| TikTok/Repliz `internal`, 5xx, timeout | `REPLIZ_TIKTOK_INTERNAL` | `provider_transient` | ya, terbatas | `retry_wait` lalu `needs_review` |
| Invalid upload/media | `REPLIZ_MEDIA_INVALID` | `media_invalid` | tidak | `needs_review` |
| Invalid payload | `REPLIZ_REQUEST_INVALID` | `request_invalid` | tidak | `failed` |
| Unknown | `REPLIZ_UNKNOWN_ERROR` | `unknown` | tidak agresif | `needs_review` |

## File Minimum

- `lib/publishing-contract.js`
- `lib/repliz-client.js`
- `lib/publishing-repository.js`
- `lib/publishing-worker.js`
- `lib/db-pg.js` hanya bila polling memerlukan kolom baru
- `app/api/v2/publishing/accounts/route.js`
- `app/api/v2/publishing/accounts/[id]/health/route.js`
- `app/api/v2/publishing/jobs/[id]/retry/route.js`
- `app/api/v2/publishing/jobs/[id]/route.js`
- `app/content-flow/PublishingScheduler.js`
- `tests/repliz-client.test.js`
- `tests/publishing-scheduler.test.js`

Jika solusi lebih kecil memenuhi kontrak tanpa migrasi, jangan menambah kolom yang tidak diperlukan. Namun pemisahan attempt dan poll wajib dapat dibuktikan oleh test.

## Test Wajib

- Classifier memakai fixture pesan Facebook audit aktual.
- TikTok `internal` menjadi transient dan menggunakan backoff.
- Facebook permission tidak auto-retry.
- Claim dua worker paralel tidak melewati `max_attempts`.
- Polling tidak menaikkan `attempt_count`.
- Manual retry permission error ditolak tanpa reconnect confirmation.
- Retry memakai schedule ID dan Drive file lama.
- Account health menyimpan `isConnected` dan timestamp dengan benar.
- Provider log ID tersimpan jika tersedia.
- Semua token/secret ter-redact dari error, state, response API, dan log.
- Tenant A tidak dapat membaca/mengubah job/account tenant B.

Jalankan:

```bash
node --test tests/repliz-client.test.js tests/google-auth-health.test.js
PG_SEARCH_PATH=dev DISABLE_AUTO_MIGRATIONS=true DISABLE_STARTUP_DB_CACHES=true ENABLE_BACKGROUND_SERVICES=false npm run test:publishing-scheduler
npm run build
```

Jangan menjalankan integration test dengan schema default `public`.

## Deployment

1. Verifikasi lokal/unit.
2. Integration test hanya di schema Dev dengan fixture cleanup.
3. Deploy Dev: `npm run deploy:macmini-dev`.
4. Smoke account health/classifier tanpa membuat post.
5. Deploy Staging: `npm run deploy:staging`.
6. Berhenti dan minta persetujuan pengguna sebelum retry/post nyata.
7. Ikuti SOP remote build; jangan polling SSH setiap 10–15 detik.
8. Jangan deploy Production.

## Release

Setelah seluruh verifikasi yang diizinkan lulus:

```bash
npm run release-non-interactive -- --type patch --title "Harden kegagalan Facebook dan TikTok via Repliz" --points "Klasifikasikan error provider secara actionable|Pisahkan retry execution dari polling|Tambah account health dan retry aman"
```

Verifikasi commit, tag, dan push ke remote resmi.

## Laporan Akhir

Laporkan:

- file yang berubah;
- mapping error final;
- bukti attempt tidak melebihi budget;
- bukti polling tidak menambah attempt;
- hasil test/build;
- hasil smoke Dev/Staging tanpa post nyata;
- apakah ada migration;
- versi, commit, tag, dan push;
- langkah user untuk reconnect Facebook/TikTok;
- risiko tersisa dan rollback point.
