# Hermes Run-Once Operational Closure & Live Verification Report

**Tanggal Eksekusi**: 1 September 2026  
**Status**: **OPERATIONAL CLOSURE COMPLETED (VERIFIED & CLOSED)**  
**Target Environment**: **Dev Only** (Mac Mini `masbenu@100.95.245.55`, Port 5020 UI & Port 7020 API, PostgreSQL Schema: `dev`)  
**Target Repository**: `https://github.com/sabeq83/maknaflow.git` (Release: `v2.29.10`)  

---

## 1. Executive Summary & Verification Verdict

Seluruh instruksi operasional penutupan integrasi Hermes Run-Once ([antigravity-run-once-operational-closure-instructions.md](file:///Users/sabeqmmursyid/_maknaflow-staging/plans/hermes-integration/antigravity-run-once-operational-closure-instructions.md)) telah diselesaikan dan dibuktikan dengan data aktual secara menyeluruh.

### Ringkasan Pencapaian Operasional:
1. **Perbaikan Otentikasi Hermes (HTTP 401 Solved)**:
   - Kredensial operator persisten `opcred_hermes_dev` telah didaftarkan pada database schema `dev` dengan scope `automation:read,automation:write` untuk tenant `default_tenant`.
   - Token LaunchAgent `ai.hermes.gateway.plist` dirotasi secara atomik.
   - Endpoint `/api/operator/v2/whoami` dan `/api/operator/v2/content-catalog` terbukti mengembalikan status **HTTP 200 OK** dan bertahan melewati restart LaunchAgent.
2. **Perbaikan & Verifikasi Integration Test Schema Dev**:
   - `scripts/test-content-run-once-integration.mjs` diperbaiki dengan penegakan schema `dev` eksplisit (`RUN_ONCE_TEST_SCHEMA=dev`), verifikasi keseragaman `search_path` connection pool, dan **15/15 integration assertions lulus tanpa error**.
3. **Penyelarasan Siklus Hidup (Lifecycle Reconciliation & Self-Healing)**:
   - Mengatasi desinkronisasi antara `agent_automation_runs`, `content_automation_runs`, dan `operator_jobs`.
   - Smoke run lama (`car_005499dc50b8474b`) berhasil di-heal dari stuck status `dispatching` menjadi `awaiting_manual_review` dengan 6 item start frames `ready`.
   - Perhitungan status bounded `buildBoundedContentRunStatus` diperbaiki untuk menghitung item `ready` secara akurat pada review mode `start_frames`.
4. **Eksekusi Live Smoke Run Baru via Jalur Autentikasi Hermes**:
   - Dijalankan smoke run baru: `car_4dd16822ab764f41` dengan brand `dapurbotani`, produk `Rolled Oat Premium Sahabat`, preset `dapurbotani_kampanye_produk_4_klip`, 6 video.
   - Enqueue latency: **77.6 ms** (budget < 2000 ms).
   - Replay idempotency terbukti (`replayed: true` dengan `run_id` yang sama persis).
   - Seluruh 6 item berhasil melewati research dan storyboard generation, menghasilkan start frame, dan mencapai stage `awaiting_manual_review` (`items: { total: 6, ready: 6, failed: 0 }`).
5. **Kepatuhan Guardrails Ketat**:
   - **Draft-only mode dipatuhi 100%**: Tepat 0 `agent_publishing_intents`, 0 `publishing_jobs`, 0 pemanggilan Repliz API / auto-publish.
   - **Isolasi Lingkungan Terjaga**: Staging (Port 5010) dan Production (Port 5000) **TIDAK DISENTUH SAMA SEKALI**.
   - **Zero Secret Leakage**: Tidak ada token mentah, API key, atau password yang terekspos dalam log atau berkas laporan.

---

## 2. Credential Root Cause & Remediation Matrix

### Akar Masalah 401 Unauthorized:
Sebelumnya, token yang terpasang pada LaunchAgent `~/Library/LaunchAgents/ai.hermes.gateway.plist` memiliki hash SHA-256 yang tidak terdaftar dalam tabel `dev.operator_credentials`, sehingga middleware otentikasi `authenticateOperator` menolak request dengan status `401 Unauthorized`.

### Matriks Remediasi Kredensial:
| Parameter | Nilai Aktual Terverifikasi |
| :--- | :--- |
| **Credential ID** | `opcred_hermes_dev` |
| **Tenant ID** | `default_tenant` |
| **Granted Scopes** | `automation:read,automation:write` |
| **Storage Location** | Database PostgreSQL Dev (`100.78.186.123:5432`, schema `dev.operator_credentials`) |
| **LaunchAgent Target** | `~/Library/LaunchAgents/ai.hermes.gateway.plist` (Mac Mini `masbenu@100.95.245.55`) |
| **Hash SHA-256 Verification** | Match 100% antara database dan environment variable LaunchAgent |
| **Tool Rotasi Atomik** | [scripts/rotate-hermes-token.mjs](file:///Users/sabeqmmursyid/_maknaflow-staging/scripts/rotate-hermes-token.mjs) |
| **Health Check Tool** | [scripts/check-hermes-auth.mjs](file:///Users/sabeqmmursyid/_maknaflow-staging/scripts/check-hermes-auth.mjs) |
| **whoami Response** | `HTTP 200` (`actor: "opcred_hermes_dev"`, `tenantId: "default_tenant"`, `scopes: ["automation:read","automation:write"]`) |
| **content-catalog Response** | `HTTP 200` (1 brand `dapurbotani`, 3 product extractions, 2 custom presets) |
| **Restart Survival Test** | `HTTP 200` terkonfirmasi setelah restart LaunchAgent (`launchctl kickstart -k gui/$(id -u)/ai.hermes.gateway`) |

---

## 3. Integration Test Harness & 15-Point Assertion Matrix

Test suite [scripts/test-content-run-once-integration.mjs](file:///Users/sabeqmmursyid/_maknaflow-staging/scripts/test-content-run-once-integration.mjs) dijalankan dengan perintah:
```bash
RUN_ONCE_TEST_SCHEMA=dev node scripts/test-content-run-once-integration.mjs
```

### Hasil Matriks 15 Assertions:
| # | Skenario Pengujian | Hasil Aktual | Status |
| :-: | :--- | :--- | :-: |
| 1 | Verifikasi keseragaman schema `dev` pada direct pool & application pool | Both pools report `search_path: dev` | **PASS** |
| 2 | Inisialisasi isolated tenant fixture tanpa kolom fiktif | Tenant `test_run_once_*` created successfully | **PASS** |
| 3 | Feature flag fail-closed (`false` & absent -> 503, `true` -> allow) | Throws `503 RUN_ONCE_DISABLED` on absent/false | **PASS** |
| 4 | Query brand & product real pada schema Dev | Returns valid entity rows with tenant isolation | **PASS** |
| 5 | Hidrasi custom preset & penolakan preset editorial untuk produk | Throws `PRESET_CAMPAIGN_KIND_MISMATCH` | **PASS** |
| 6 | Enqueue run-once valid & pengukuran budget latensi (< 2000ms) | Enqueue succeeded in 845ms (< 2000ms budget) | **PASS** |
| 7 | Lifecycle sequencing & penundaan pembuatan Agent Run sebelum snapshot | Count agent run = 0 saat enqueue, audit event created | **PASS** |
| 8 | Idempotency Replay (Key sama + Payload sama) | Returns existing `run_id`, `replayed: true` | **PASS** |
| 9 | Idempotency Conflict (Key sama + Payload berbeda) | Throws `409 IDEMPOTENCY_CONFLICT` | **PASS** |
| 10 | Konkurensi binding paralel & single row `brand_products` | Parallel requests share exact 1 binding row | **PASS** |
| 11 | Transactional rollback pada kegagalan mutasi | Mutasi dibatalkan 100% tanpa baris tersisa di DB | **PASS** |
| 12 | Status bounded, akurasi item ready, dan isolasi tenant (404 foreign) | Tenant isolation 404 & redaksi secret verified | **PASS** |
| 13 | Zero publishing intents & publishing jobs untuk mode `draft_only` | Exactly 0 intents & 0 jobs created | **PASS** |
| 14 | Semantik non-recurring schedule (`execution_mode: 'run_once'`, `paused`) | Schedule `paused`, `next_run_at: null` | **PASS** |
| 15 | Teardown bersih isolated fixture & penutupan pool tanpa resource leak | 0 lingering handles, exit code 0 | **PASS** |

---

## 4. State Machine & Reconciliation Evidence

### 1. Self-Healing Smoke Run Lama (`car_005499dc50b8474b`)
- **Sebelum Perbaikan**:
  - `content_automation_runs`: `status: 'dispatching'`, `operator_job_id: null`, `total_item_count: 0`.
  - `agent_automation_runs`: `status: 'producing'`, `operator_job_id: 'opj_bb5f9ed3fe6b429e'`.
  - Bounded status API: `items: { total: 6, ready: 0, failed: 0 }`.
- **Setelah Perbaikan & Reconciliation Tick**:
  - `content_automation_runs`: `status: 'awaiting_approval'`, `operator_job_id: 'opj_bb5f9ed3fe6b429e'`, `total_item_count: 6`.
  - `agent_automation_runs`: `status: 'awaiting_creative_approval'`, `operator_job_id: 'opj_bb5f9ed3fe6b429e'`.
  - Bounded status API: `status: "awaiting_manual_review"`, `stage: "start_frames"`, `items: { total: 6, ready: 6, failed: 0 }`.
- **Idempotency Tick 2**: 0 mutasi database (idempotent).

### 2. Penyelarasan Lifecycle Worker
- File yang dimodifikasi:
  - [lib/content-automation-repository.js](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/content-automation-repository.js): Query `listRunsToReconcile` menggabungkan `agent_automation_runs` dan mencakup status `dispatching`/`planning`.
  - [lib/content-automation-worker.js](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/content-automation-worker.js): `reconcile()` menyinkronkan status dan `effective_operator_job_id`.
  - [lib/agent-automation-worker.js](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/agent-automation-worker.js): Menghubungkan `operator_job_id` ke `content_automation_runs` saat dispatch riset, memperbarui status `awaiting_approval`, dan mengizinkan transisi aman.
  - [lib/agent-automation-contract.js](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/agent-automation-contract.js): Mengizinkan transisi `producing` -> `awaiting_creative_approval`.

---

## 5. Live Smoke Execution Record & Evidence

Smoke run baru dieksekusi melalui HTTP API operator terautentikasi pada server Mac Mini Dev:

### Payload Eksekusi:
```json
{
  "mode": "run_once",
  "name": "Live Smoke Rolled Oat Hermes",
  "brand_profile_id": "df382ce8-2145-4464-ae63-79375ff3aff2",
  "product_id": "pe_rolled_oat_sahabat",
  "preset_key": "dapurbotani_kampanye_produk_4_klip",
  "video_count": 6,
  "platform": "tiktok",
  "research": {
    "query": "Resep Sarapan Praktis dan Sehat Menggunakan Rolled Oat Premium Sahabat"
  },
  "review_mode": "start_frames",
  "publishing_policy": {
    "mode": "draft_only"
  }
}
```

### Bukti Eksekusi Aktual:
| Parameter | Nilai Bukti Aktual |
| :--- | :--- |
| **HTTP Enqueue Response** | `HTTP 202 Accepted` |
| **Enqueue Latency** | **77.6 ms** (target < 2000 ms) |
| **Generated Run ID** | `car_4dd16822ab764f41` |
| **Idempotency Replay** | `HTTP 202 Accepted`, `run_id: "car_4dd16822ab764f41"`, `replayed: true` |
| **Schedule ID** | `cas_e67d8b92f996430b` (`execution_mode: 'run_once'`, `status: 'paused'`, `next_run_at: null`) |
| **Agent Automation Run ID** | `arun_f2a9df634b424501` (`status: 'awaiting_creative_approval'`) |
| **Research Task ID** | `task_arun_f2a9df634b424501` (Research brief revision: `arev_62aba2526a62454a`) |
| **Operator Job ID** | `opj_ae2545d9802f43df` (Campaign: `opc_ae2545_2f43df`) |
| **Operator Job Status** | `awaiting_approval` (Stage: `start_frames`) |
| **Start Frames Count** | Tepat 6 item memiliki visual start frames yang berhasil di-render |
| **Live Bounded Status API** | `HTTP 200 OK` dari `GET /api/operator/v2/content-runs/car_4dd16822ab764f41` |

### JSON Bounded Status Aktual:
```json
{
  "success": true,
  "run_id": "car_4dd16822ab764f41",
  "status": "awaiting_manual_review",
  "stage": "start_frames",
  "items": {
    "total": 6,
    "ready": 6,
    "failed": 0
  },
  "action_required": "Review start frames in MAKNA",
  "review_url": "/content-automations?run=car_4dd16822ab764f41",
  "publishing_mode": "draft_only"
}
```

---

## 6. Environment & Guardrail Verification

### 1. Isolasi Lingkungan & Larangan Akses
- **Dev**: Berjalan pada Port 5020 (UI) & Port 7020 (API) di bawah PM2 (`maknaflow-dev-ui`, `maknaflow-dev-api`). Schema database: `dev`. Seluruh pengujian dan deployment dilakukan **HANYA** pada lingkungan ini.
- **Staging**: Port 5010 (UI) & Port 7010 (API) **TIDAK DISENTUH ATAU DIUBAH**.
- **Production**: Port 5000 (UI) & Port 6000 (API) **TIDAK DISENTUH ATAU DIUBAH**.

### 2. Guardrails Publishing (Draft Only)
- Query `SELECT COUNT(*) FROM agent_publishing_intents WHERE run_id = 'arun_f2a9df634b424501'`: **0**
- Query `SELECT COUNT(*) FROM publishing_jobs WHERE run_id = 'car_4dd16822ab764f41'`: **0**
- Pemanggilan API eksternal Repliz / social publishing: **0**

### 3. Redaksi Secret
- Seluruh token, signing secret, dan kredensial database disanitasi dan tidak pernah ditampilkan dalam bentuk raw token pada git repository, terminal logs, ataupun file laporan ini.

---

## 7. Mandatory Test Gates & Release Artifacts

### Hasil Seluruh Test Gate:
| Test Gate | Perintah | Hasil |
| :--- | :--- | :---: |
| Unit Tests | `node --test tests/content-run-once.test.js tests/agent-automation.test.js tests/hermes-client.test.js` | **18/18 PASS** |
| DB Integration Test | `RUN_ONCE_TEST_SCHEMA=dev node scripts/test-content-run-once-integration.mjs` | **15/15 PASS** |
| Content Automation Test | `npm run test:content-automation` | **PASS** |
| Operator Content Test | `npm run test:operator-content` | **PASS** |
| Publishing Scheduler Test | `npm run test:publishing-scheduler` | **13/13 PASS** |
| Production Build | `npm run build` | **PASS (Exit 0)** |

### Detail Rilis & Git Sync:
- **Versi Rilis**: `v2.29.10`
- **Git Commit**: `090de86` (`release: v2.29.10 — Hermes Run-Once Operational Closure and Live Authentication`)
- **Git Tag**: `v2.29.10` (terunggah ke `https://github.com/sabeq83/maknaflow.git`)
- **Remote Mac Mini Dev**: Berhasil di-deploy dan berjalan aktif pada rilis `v2.29.10`.
