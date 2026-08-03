# Content Automation Fase 2D — Windows Pilot Runbook

## Target

- Node: Windows Worker / WSL 2 (`vibe-server`, `100.117.59.92`)
- Web: `http://100.117.59.92:5020`
- API lokal WSL: `http://127.0.0.1:7020/health`
- Branch deployment: `local-staging`
- Process manager: PM2, satu instance UI agar worker automation tunggal

## Konfigurasi wajib

```dotenv
ENABLE_BACKGROUND_SERVICES=true
ENABLE_OPERATOR_WORKER=true
ENABLE_CONTENT_AUTOMATION_WORKER=true
CONTENT_AUTOMATION_INTERVAL_MS=15000
ENABLE_CONTENT_AUTOMATION_NOTIFICATIONS=true
CONTENT_AUTOMATION_NOTIFICATION_INTERVAL_MS=10000
STAGING_WEB_ORIGIN=http://100.117.59.92:5020
MAKNA_PUBLIC_BASE_URL=http://100.117.59.92:5020
```

Bot token Telegram hanya disimpan melalui **Notification Settings** sebagai tenant secret terenkripsi. Token tidak boleh ditulis ke repository, `.env.staging.local.example`, PM2 config, atau runbook.

## Deployment dan health check

```bash
npm run deploy:node2-wsl
```

Deployment harus satu kali panggilan SSH. Sukses mensyaratkan port `5020` listen, Web UI merespons, `/api/v2/system-health` merespons, dan PM2 menampilkan proses UI/API online.

Pemeriksaan dari Windows/cluster:

```powershell
Test-NetConnection 100.117.59.92 -Port 5020
Invoke-WebRequest http://100.117.59.92:5020/api/v2/system-health -UseBasicParsing
```

## Pilot Nutribake

- Satu schedule tenant `default_tenant`.
- `missed_run_policy=run_latest`, timezone `Asia/Jakarta`.
- Preset `nutribake_editorial_v1`, tujuh pilar, tujuh planner rows.
- `approval_mode=storyboard` dan `enable_social_post=false` wajib tetap terkunci.
- Jalankan satu `Run Now`, lalu observasi dua occurrence kalender.
- Setiap occurrence harus menghasilkan paling banyak satu `(schedule_id, scheduled_for)` dan berhenti di `awaiting_approval` sebelum TTS/G-Labs/FFmpeg.

## Recovery test

```bash
npm run test:content-automation:phase2d
```

Test mencakup downtime/missed slot `run_latest`, competing claim, retry run yang sama, stale notification claim, dan outbox recovery.

## Rollback

Matikan kedua worker dan restart PM2:

```dotenv
ENABLE_CONTENT_AUTOMATION_NOTIFICATIONS=false
ENABLE_CONTENT_AUTOMATION_WORKER=false
```

```bash
pm2 restart maknaflow-staging-ui --update-env
```

Rollback tidak menghapus schedule, run, atau outbox. Operator job yang sudah dibuat tetap tersedia untuk review. Setelah perbaikan, aktifkan flag kembali; item `retry_wait` dilanjutkan tanpa reset manual.
