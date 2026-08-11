# SoT: MAKNA Flow Multi-Tenant Publishing Scheduler

## 1. Ikhtisar & Arsitektur
Publishing Scheduler adalah mesin penjadwalan dan penerbitan konten media sosial (Facebook Page Draft/Live dan Instagram Container Workflow) yang beroperasi secara aman, multi-tenant aware, resilient terhadap kegagalan jaringan, dan terintegrasi langsung dengan database PostgreSQL pusat MAKNA Grid.

### Komponen Utama:
1. **Contract & Policy Layer** (`lib/publishing-contract.js`):
   - Validasi struktur request penjadwalan (content ID, accounts, platform, media type, ISO 8601 UTC timestamp).
   - Sanitasi token (`***TOKEN_REDACTED***`) dan kredensial dari log/error.
   - Klasifikasi kegagalan provider (transient -> retry wait, unknown outcome -> verifying, permanent -> failed / needs review).
   - Perhitungan delay retry dengan Exponential Backoff + Jitter.
2. **Repository Layer** (`lib/publishing-repository.js`):
   - Tabel PostgreSQL: `publishing_accounts`, `publishing_jobs`, `publishing_attempts`, `publishing_control`.
   - Klaim job atomik dengan `SELECT ... FOR UPDATE SKIP LOCKED` dalam transaksi terpisah untuk mencegah resource lock pada pool database (`PGPOOL_MAX=3`).
   - Idempotency key conflict resolution `(tenant_id, idempotency_key)` untuk mencegah duplikasi penerbitan.
3. **Meta Publisher Engine** (`lib/meta-publisher.js`):
   - Meta Graph API `v22.0`.
   - Facebook Draft creation (default safe guardrail: `published: false, unpublished_content_type: 'DRAFT'`).
   - Facebook Live publishing (dilindungi feature flag `ENABLE_FACEBOOK_LIVE=true` dan status approval).
   - Instagram Container lifecycle: `createInstagramContainer` -> `getInstagramContainerStatus` polling -> `publishInstagramContainer`.
4. **Encrypted Secret Storage** (`lib/encrypted-secret.js`):
   - Token akun Meta disimpan dalam bentuk ciphertext terenkripsi AES-256-GCM.
   - Tidak ada plain token yang diekspos melalui API response atau log runtime.
5. **Background Worker & Health Control** (`lib/publishing-worker.js`, `instrumentation.js`, `lib/node-config.js`):
   - Dijalankan jika `ENABLE_PUBLISHING_WORKER=true`.
   - Mendukung jeda global per tenant (`is_paused`) via `publishing_control`.
   - Sinkronisasi ringkasan hasil (`facebook_status`, `permalink_facebook`, dll) ke `content_flow_items`.

---

## 2. API Endpoints

| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/v2/publishing/accounts` | Daftar akun publikasi terdaftar per tenant (token disanitasi). |
| `POST` | `/api/v2/publishing/accounts` | Daftarkan / perbarui akun Meta (verifikasi token otomatis). |
| `GET` | `/api/v2/publishing/accounts/[id]` | Detail satu akun publikasi. |
| `PATCH` | `/api/v2/publishing/accounts/[id]` | Pause / aktifkan akun publikasi. |
| `DELETE` | `/api/v2/publishing/accounts/[id]` | Hapus akun publikasi. |
| `POST` | `/api/v2/publishing/preflight` | Preflight check URL media, format MIME, caption, dan kesiapan akun. |
| `GET` | `/api/v2/publishing/jobs` | Daftar antrean (`view=queue`), riwayat (`view=history`), atau metrik. |
| `POST` | `/api/v2/publishing/jobs` | Jadwalkan konten ke satu atau banyak akun publikasi. |
| `GET` | `/api/v2/publishing/jobs/[id]` | Detail satu job lengkap dengan audit attempts & error log. |
| `PATCH` | `/api/v2/publishing/jobs/[id]` | Reschedule (`action: reschedule`), cancel (`action: cancel`), atau approve. |
| `POST` | `/api/v2/publishing/jobs/[id]/retry` | Manual retry untuk job yang gagal atau dibatalkan. |
| `GET` | `/api/v2/publishing/health` | Status kesehatan worker, backlog queue, retry wait, dan paused state. |
| `GET` / `PATCH` | `/api/v2/publishing/control` | Baca atau jeda/lanjutkan worker publishing secara global per tenant. |

---

## 3. SOP Operasional & Monitoring

1. **Jeda Darurat (Emergency Pause)**:
   - Jika terjadi insiden API provider atau maintenance, operator dapat menekan tombol **"⏸️ Pause Worker"** di Content Flow Publishing Scheduler atau memanggil `PATCH /api/v2/publishing/control` dengan `{ "isPaused": true }`.
2. **Kondisi `VERIFYING` (Unknown Outcome)**:
   - Jika terjadi network reset / socket timeout saat pemanggilan publish, job dipindahkan ke status `verifying`. Worker tidak akan langsung melakukan retry untuk menghindari duplikasi draft/posting di Meta Business Suite.
3. **Stale Recovery**:
   - Job yang terhenti dalam status `processing` lebih dari 5 menit (misal server restart tiba-tiba) secara otomatis direcovery oleh worker tick ke antrean `retry_wait` atau `verifying`.

---

## 4. Runbook Pengujian

Jalankan test suite publishing scheduler:
```bash
npm run test:publishing-scheduler
```
Test suite mencakup:
- Validasi Contract, status, dan platform
- Sanitasi token dari error message
- Validasi payload & timezone
- Provider failure classification (transient vs unknown vs permanent)
- Multi-tenant isolation & competing worker atomic claim (`FOR UPDATE SKIP LOCKED`)
- Facebook helper legacy caller draft-only integrity
- End-to-end pilot Facebook draft & Content Flow synchronization
- Instagram container validation
