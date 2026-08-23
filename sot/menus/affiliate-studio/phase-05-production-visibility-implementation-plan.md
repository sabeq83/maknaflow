# JIT Implementation Plan — Affiliate Studio Fase 5: Unified Production Visibility

> Status: Executable  
> Parent roadmap: [affiliate-studio-roadmap.md](file:///Users/sabeqmmursyid/_maknaflow-staging/sot/menus/affiliate-studio-roadmap.md)  
> Master orchestrator: [master-execution-orchestrator.md](file:///Users/sabeqmmursyid/_maknaflow-staging/sot/menus/affiliate-studio/master-execution-orchestrator.md)  
> Dependency: Fase 4 Content Planner Connection (`v2.25.2`) terilis dan seluruh tes lulus.

## 1. Objective

Menyatukan visibilitas semua production engine existing (RE Campaign, Pillar Campaign, Recipe Labs, Multiplier Lab, Instant Campaign, dan Product Bridging) di dalam dashboard Affiliate Studio melalui adapter, status projector, dan log event terpusat tanpa mengubah state machine engine legacy.

## 2. In Scope & Out of Scope

### In Scope
- Skema database sidecar: `affiliate_content_runs` dan `affiliate_content_run_events`.
- Server adapter read/write methods untuk mendaftarkan run, memproyeksikan status, memetakan deep link, dan melakukan rekonsiliasi.
- API Route:
  - `GET/POST /api/v2/affiliate-studio/brands/[id]/programs/[programId]/runs` (List and create content runs)
  - `POST /api/v2/affiliate-studio/brands/[id]/programs/[programId]/runs/reconcile` (Reconcile program runs statuses)
- UI Integrations:
  - Tampilan tab "Production Queue" di halaman Campaign Program Detail.
  - Tampilan queue list dengan sequence planner, engine badges, normalized status badges, dan timestamp.
  - Tombol rekonsiliasi status dan tautan langsung ke detail engine legacy (deep link).

### Out of Scope
- Mengubah status column dan lifecycle di tabel legacy.
- Scheduler-control masing-masing engine.
- Retry, approval, repair, dan regenerate endpoint legacy.
- Worker produksi dan log engine.

## 3. Database Schema Proposed

```sql
CREATE TABLE IF NOT EXISTS affiliate_content_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  brand_profile_id TEXT NOT NULL,
  affiliate_program_id TEXT NOT NULL REFERENCES affiliate_programs(id) ON DELETE CASCADE,
  content_planner_id TEXT NOT NULL REFERENCES content_planners(id) ON DELETE CASCADE,
  planner_row_id TEXT NOT NULL REFERENCES content_planner_rows(id) ON DELETE CASCADE,
  engine_type TEXT NOT NULL CHECK (engine_type IN ('re', 'pillar', 'recipe', 'multiplier', 'instant', 'bridge')),
  engine_campaign_id TEXT,
  engine_item_id TEXT,
  normalized_status TEXT NOT NULL CHECK (normalized_status IN ('Planned', 'Queued', 'Generating', 'Awaiting Review', 'Producing', 'Rendering', 'Ready', 'Scheduled', 'Published', 'Measured')),
  brand_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  product_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  offer_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_aff_runs_lookup
  ON affiliate_content_runs (tenant_id, brand_profile_id, affiliate_program_id);

CREATE TABLE IF NOT EXISTS affiliate_content_run_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  affiliate_content_run_id TEXT NOT NULL REFERENCES affiliate_content_runs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_aff_run_events_lookup
  ON affiliate_content_run_events (tenant_id, affiliate_content_run_id);
```

## 4. Proposed Changes

### Database Layer
- **[MODIFY] [db-pg.js](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/db-pg.js)**: Tambahkan auto-migration untuk `affiliate_content_runs` dan `affiliate_content_run_events`.

### Server Adapters
- **[NEW] [affiliate-studio-production-adapter.js](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/affiliate-studio-production-adapter.js)**: Menyediakan method `createContentRun`, `listProgramContentRuns`, dan `reconcileProgramRuns`.

### API Routes
- **[NEW] [route.js (Runs endpoint)](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/runs/route.js)**: API GET list runs dan POST register new run reference.
- **[NEW] [route.js (Reconciliation endpoint)](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/runs/reconcile/route.js)**: API POST untuk mentrigger rekonsiliasi manual status run.

### User Interface
- **[NEW] [CampaignProgramRuns.js](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/CampaignProgramRuns.js)**: Component untuk menampilkan queue eksekusi produksi, status normalized, progress bar/details, deep links, dan rekonsiliasi.
- **[MODIFY] [CampaignProgramDetail.js](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/CampaignProgramDetail.js)**: Tambahkan tab "Production Queue" dan me-render `CampaignProgramRuns`.
- **[MODIFY] [AffiliateStudio.module.css](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/AffiliateStudio.module.css)**: Tambahkan style CSS pendukung untuk status badge, table queue, run wrapper, dan tombol rekonsiliasi.

## 5. Execution Task List

### 5.1 Database & Server Layer
- [x] Implementasikan auto-migration Fase 5 di [`lib/db-pg.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/db-pg.js).
- [x] Buat file server adapter [`lib/affiliate-studio-production-adapter.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/affiliate-studio-production-adapter.js).
- [x] Buat API Route list/create runs [`app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/runs/route.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/v2/affiliate-studio/brands/%5Bid%5D/programs/%5BprogramId%5D/runs/route.js).
- [x] Buat API Route reconcile runs [`app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/runs/reconcile/route.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/v2/affiliate-studio/brands/%5Bid%5D/programs/%5BprogramId%5D/runs/reconcile/route.js).

### 5.2 UI & Layout Integration
- [x] Buat component [`app/affiliate-studio/components/CampaignProgramRuns.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/CampaignProgramRuns.js).
- [x] Modifikasi [`app/affiliate-studio/components/CampaignProgramDetail.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/CampaignProgramDetail.js) untuk memuat tab Production dan me-render `CampaignProgramRuns`.
- [x] Tambahkan class CSS di [`app/affiliate-studio/components/AffiliateStudio.module.css`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/AffiliateStudio.module.css) untuk visualisasi queue & status.

### 5.3 Verification & Quality Gate
- [x] Buat berkas unit & integration tests `tests/affiliate-studio-production-visibility.test.js`.
- [x] Buat berkas boundary tests `tests/affiliate-studio-phase-05-boundary.test.js`.
- [x] Jalankan all tests & regressions.
- [x] Jalankan `git diff --check`.
- [x] Jalankan `npm run build`.
- [x] Lakukan release patch otomatis `v2.25.3`.

## 6. Verification Plan

### Automated Tests
- `node --experimental-test-module-mocks --test tests/affiliate-studio-production-visibility.test.js`
- `node --experimental-test-module-mocks --test tests/affiliate-studio-phase-05-boundary.test.js`
- Regressions: all tests.

### Manual Verification
- Uji integrasi tracking status run dan rekonsiliasi manual di dev mac mini server.
