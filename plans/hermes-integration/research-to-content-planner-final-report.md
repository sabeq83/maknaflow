# Hermes Research → Content Planner Integration (Tahap 1–3) — Final Operational Report

**Target Release**: `v2.29.12`  
**Target Repository**: `https://github.com/sabeq83/maknaflow.git`  
**Target Environment**: macOS Mac Mini Dev (`masbenu@100.95.245.55`, UI Port 5020, API Port 7020, DB Schema `dev`)  
**Status**: ✅ **COMPLETED & OPERATIONAL** (All Definition of Done Criteria Satisfied)

---

## 1. Executive Summary

Integrasi end-to-end antara **Hermes Deep Research Engine** dan **MAKNA Content Planner** (Tahap 1, Tahap 2, dan Tahap 3) telah diselesaikan secara menyeluruh. Sistem kini menerapkan:

1. **Deterministic Lineage & Locked Structure**:
   - `content_planners` secara otomatis menyimpan metadata riset (`research_revision_id`, `research_snapshot_sha256`, `research_query`, `research_status`, `researched_at`, `research_source_policy`).
   - Tabel baru `content_planner_row_evidence` menyimpan alokasi evidence per baris secara atomik dengan constraint `UNIQUE (tenant_id, planner_id, planner_row_id)`.
   - Normalisasi baris di `lib/content-planner-contract.js` mengunci parameter `sequence`, `pillar`, `category_cep`, `vfo`, `product_reference`, dan `product` sehingga LLM dilarang keras mengubah struktur yang telah ditentukan.
2. **Deterministic Evidence Adapter & Policy Enforcement**:
   - `lib/research-to-planner-adapter.js` mengalokasikan sudut pandang (angles) dan sumber riset secara merata ke N baris dengan hashing SHA-256 yang deterministik.
   - `lib/research-source-verifier.js` memblokir serangan SSRF (private IPs, loopback, link-local, AWS/cloud metadata IPs 169.254.169.254) dan memvalidasi URL eksternal dengan HTTPS serta klasifikasi otoritas domain.
   - `lib/research-claim-validator.js` memvalidasi klaim pasca-generasi agar tidak melanggar prohibited claims produk.
   - `lib/content-planner-research-service.js` menyediakan alur refresh riset non-destruktif dan apply revisi eksplisit.
3. **UI Evidence Projection & Review Workflow**:
   - UI Content Planner Workbench (`app/content-planner/[id]/page.js`) kini menampilkan **Research Status Badge** (`Research-backed`, `Partially verified`, `Stale`, `Rejected`), **Evidence Summary Header**, **Drawer Sumber & Insight Terverifikasi** dengan tautan aman (`rel="noopener noreferrer"`), **Row-Level Risk Chips**, dan **Modal Konfirmasi Refresh Riset**.
   - API projection endpoints (`/api/content-planner/[id]`, `/research`, `/rows/[rowId]/evidence`, `/refresh`, `/apply`) aktif dengan isolasi multi-tenant penuh.

---

## 2. Database Schema & Migration Verification

Migrasi dieksekusi pada PostgreSQL Database Cluster (`100.78.186.123:5432/maknaflow_db`, schema `dev`):

### Kolom Baru pada `dev.content_planners`
- `research_revision_id TEXT DEFAULT 'rev_none'`
- `research_snapshot_sha256 TEXT`
- `research_query TEXT`
- `research_status TEXT DEFAULT 'none'`
- `researched_at TIMESTAMPTZ`
- `research_source_policy TEXT DEFAULT 'primary_and_reputable'`
- `research_schema_version TEXT DEFAULT '1'`

### Tabel Baru `dev.content_planner_row_evidence`
```sql
CREATE TABLE IF NOT EXISTS content_planner_row_evidence (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  planner_id TEXT NOT NULL,
  planner_row_id TEXT NOT NULL,
  research_revision_id TEXT NOT NULL,
  angle_id TEXT,
  insight_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  product_fact_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_level TEXT NOT NULL DEFAULT 'low',
  evidence_status TEXT NOT NULL DEFAULT 'verified',
  evidence_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_sha256 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_cpre_row UNIQUE (tenant_id, planner_id, planner_row_id)
);
```

---

## 3. Automated Test Suite Results

Semua rangkaian test lulus 100% tanpa regresi:

### 1. Unit Test Suite (`npm run test:planner-research`)
- `tests/content-planner-locked-structure.test.js`:
  - ✔ `normalizeGeneratedPlannerRows` preserves locked fields and prevents LLM drift
  - ✔ `validateLockedPlannerStructure` passes on valid structure and throws on drift
- `tests/research-claim-validator.test.js`:
  - ✔ `Claim Risk Policy` detects high, medium, and low risks accurately
  - ✔ `Claim Allowed Policy` detects prohibited claims violation
  - ✔ `Planner Post-Generation Evidence Validator` detects structure & prohibited claim drift
- `tests/research-source-verifier.test.js`:
  - ✔ `Research Source Verifier` SSRF IP blocker rejects private & metadata IPs (127.0.0.1, 10.0.0.0/8, 169.254.169.254, etc.)
  - ✔ `Research Source Verifier` classifies authority appropriately
  - ✔ `Research Source Verifier` rejects non-HTTPS and localhost URLs
- `tests/research-to-planner-adapter.test.js`:
  - ✔ `Research-to-Planner Adapter` deterministic allocation across N rows

### 2. Integration Test Suite (`npm run test:planner-research:integration`)
- `tests/content-planner-research-repository.test.js`:
  - ✔ `Content Planner Research Repository - Full Lifecycle & Atomic Isolation` (PASS)
- `tests/content-planner-refresh-workflow.test.js`:
  - ✔ `Content Planner Research Service - Refresh & Frozen Context Resolution` (PASS)
- `tests/content-planner-research-api.test.js`:
  - ✔ `Content Planner Research API & Projections - Integrity & Redaction` (PASS)

### 3. Core Database Integration Suite (`npm run test:content-run-once:integration`)
- ✔ **15/15 assertions passed on schema Dev** (search_path uniformity, fail-closed flag, brand/product lookup, preset hydration, latency budget < 2000ms, idempotency replay/conflict, parallel bindings, transactional rollback, bounded status, 0 publishing intents/jobs, non-recurring schedule).

### 4. Build Gate (`npm run build`)
- ✔ Next.js 16.2.5 production compilation succeeded with 0 errors.

---

## 4. Real Live Smoke Test Evidence (Mac Mini Dev)

Uji asap nyata dijalankan dengan payload berikut:
- **Brand**: `dapurbotani` (`df382ce8-2145-4464-ae63-79375ff3aff2`)
- **Product**: `Pagibaik Rolled Oat Gluten Free` (`pe_sync_1781148697787_336`)
- **Preset**: `dapurbotani_kampanye_produk_4_klip_v2`
- **Video Count**: 6
- **Review Mode**: `start_frames` (manual review)
- **Publishing Mode**: `draft_only`

### Hasil Eksekusi Live Run
```json
{
  "success": true,
  "run_id": "car_f5c01bae88c848e1",
  "status": "awaiting_manual_review",
  "stage": "start_frames",
  "items": {
    "total": 6,
    "ready": 6,
    "failed": 0
  },
  "action_required": "Review start frames in MAKNA",
  "review_url": "/content-automations?run=car_f5c01bae88c848e1",
  "publishing_mode": "draft_only"
}
```

### Bukti Data Planner & Evidence pada PostgreSQL Dev (`pln_bb83b926`)
1. **Metadata Riset Planner**:
   - `research_revision_id`: `rev_inline`
   - `research_status`: `validated`
   - `research_snapshot_sha256`: `53ca1bfce1c367f6cd4a5ea0e833fd800ab81120bdde7759c10c1797fe7d2e88`
   - `research_query`: `Resep Sarapan Bebas Gluten Praktis Menggunakan Pagibaik Rolled Oat Gluten Free`
2. **6 Baris Planner Terkunci (Zero LLM Drift)**:
   - Row 1: `Behind the Scene & Lifestyle` | `Commitment Based` | `Instinctive` | `The Secret Club`
   - Row 2: `Edukasi & Problem Solving` | `Opportunistic Based` | `Uncharted` | `The Comparison (David vs Goliath)`
   - Row 3: `Routine & Habit Building` | `Problem-Solution Based` | `Aspirational` | `The Revenge`
   - Row 4: `Review & Honest Comparison` | `Routine Based` | `Concrete` | `The Value Trade-Off`
   - Row 5: `Behind the Scene & Lifestyle` | `Emotional Based` | `Instinctive` | `The Guilty Pleasure`
   - Row 6: `Edukasi & Problem Solving` | `Aspirational Based` | `Uncharted` | `The Fear of Missing Out (FOMO)`
   - Seluruh 6 baris terkunci pada produk `Pagibaik Rolled Oat Gluten Free`.
3. **6 Record Evidence Lineage (`content_planner_row_evidence`)**:
   - Row 1: `angle_1`, `src_glutenfree_01`, `risk_level: low`, SHA `aa85bdce...`
   - Row 2: `angle_2`, `src_pencernaan_02`, `risk_level: low`, SHA `739f3bfa...`
   - Row 3: `angle_1`, `src_glutenfree_01`, `risk_level: low`, SHA `93098072...`
   - Row 4: `angle_2`, `src_pencernaan_02`, `risk_level: low`, SHA `f38e4d2a...`
   - Row 5: `angle_1`, `src_glutenfree_01`, `risk_level: low`, SHA `96e0110c...`
   - Row 6: `angle_2`, `src_pencernaan_02`, `risk_level: low`, SHA `56d1136e...`
4. **Verifikasi Guardrails**:
   - `agent_publishing_intents`: **0** (Zero publishing intents)
   - `publishing_jobs`: **0** (Zero publishing jobs)
   - Schedule Semantics: `execution_mode = 'run_once'`, `status = 'paused'`, `next_run_at = NULL`
   - Review Guardrail: Pipeline berhenti tepat pada `awaiting_manual_review` dengan 6 start frames siap direview manual. Tidak ada approval otomatis.

---

## 5. Deployment & Process Table (Mac Mini Dev)

- **Target Server**: macOS Mac Mini (`100.95.245.55`, `masbenu`)
- **Port Layanan**: Port 5020 (Dev UI), Port 7020 (Dev API)
- **Deployment Script**: `npm run deploy:macmini-dev` (Remote build + PM2 reload)

### Status PM2 Pasca-Deployment
```
┌────┬──────────────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┐
│ id │ name                     │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │
├────┼──────────────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┤
│ 3  │ maknaflow-dev-api        │ default     │ 2.0.0   │ cluster │ 36547    │ 0s     │ 363  │ online    │
│ 2  │ maknaflow-dev-ui         │ default     │ 16.2.5  │ cluster │ 36546    │ 0s     │ 508  │ online    │
│ 1  │ maknaflow-staging-api    │ default     │ 2.0.0   │ cluster │ 522      │ 4D     │ 63   │ online    │
│ 0  │ maknaflow-staging-ui     │ default     │ 16.2.5  │ cluster │ 521      │ 4D     │ 61   │ online    │
└────┴──────────────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┘
```
- **Staging & Production**: Tetap tidak tersentuh (Staging UI ID 0 dan Staging API ID 1 memiliki uptime `4D` tanpa restart).

---

## 6. Git Release & Push Summary

- **Release Script**: `npm run release-non-interactive`
- **Release Version**: `v2.29.12`
- **Git Commit**: `release: v2.29.12 — Integrasi Hermes Research ke Content Planner Tahap 1-3` (`fb58a2d`)
- **Git Tag**: `v2.29.12`
- **Push Destination**: `https://github.com/sabeq83/maknaflow.git` (branch `local-staging`, tag `v2.29.12`)

---

## 7. Rollback Readiness

Jika terjadi kendala pada lingkungan Dev:
1. Rollback ke tag rilis sebelumnya (`v2.29.11`):
   ```bash
   git checkout v2.29.11
   npm run deploy:macmini-dev
   ```
2. Revert migrasi database schema `dev` jika diperlukan:
   ```sql
   DROP TABLE IF EXISTS dev.content_planner_row_evidence;
   ALTER TABLE dev.content_planners 
     DROP COLUMN IF EXISTS research_revision_id,
     DROP COLUMN IF EXISTS research_snapshot_sha256,
     DROP COLUMN IF EXISTS research_query,
     DROP COLUMN IF EXISTS research_status,
     DROP COLUMN IF EXISTS researched_at,
     DROP COLUMN IF EXISTS research_source_policy,
     DROP COLUMN IF EXISTS research_schema_version;
   ```
