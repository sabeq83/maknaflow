# JIT Implementation Plan — Affiliate Studio Fase 4: Content Planner Connection

> Status: Executable  
> Parent roadmap: [affiliate-studio-roadmap.md](file:///Users/sabeqmmursyid/_maknaflow-staging/sot/menus/affiliate-studio-roadmap.md)  
> Master orchestrator: [master-execution-orchestrator.md](file:///Users/sabeqmmursyid/_maknaflow-staging/sot/menus/affiliate-studio/master-execution-orchestrator.md)  
> Dependency: Fase 3 Campaign Program Domain (`v2.25.1`) terilis dan seluruh tes lulus.

## 1. Objective

Menghubungkan **Content Planner** ke **Campaign Program** melalui relasi sidecar (`affiliate_program_planners` dan `affiliate_planner_row_links`). Ini memungkinkan Content Planner menjadi pusat komando editorial dengan mengaitkan rencana editorial ke program kampanye komersial, memperlihatkan calendar brand, timeline program, status visual coverage summary berdasarkan funnel mix, produk, platform, dan jadwal, tanpa mengubah struktur tabel planner legacy.

## 2. In Scope & Out of Scope

### In Scope
- Skema database sidecar (`affiliate_program_planners` dan `affiliate_planner_row_links`).
- Server adapter read/write untuk planner connection dan row metadata mapping.
- API Route:
  - `GET/POST /api/v2/affiliate-studio/brands/[id]/programs/[programId]/planners` (Link/List program planners)
  - `DELETE /api/v2/affiliate-studio/brands/[id]/programs/[programId]/planners/[plannerId]` (Unlink program planner)
  - `GET/PUT /api/v2/affiliate-studio/brands/[id]/programs/[programId]/planners/[plannerId]/rows` (Fetch and configure row level associations)
- UI Integrations:
  - Tampilan Brand Calendar & Program Plan di Affiliate Studio.
  - Coverage summary (funnel mix target vs actual, product coverage, platform coverage).
  - Tindakan **Link Existing Planner** & **Unlink Planner**.
  - Tindakan **Open in Content Planner** (deep link ke planner asli).

### Out of Scope
- Mengubah generator AI atau validator Content Planner.
- Mengubah schema `content_planners` or `content_planner_rows`.
- Mengubah sinkronisasi Sheets atau ContentFlow legacy.

## 3. Database Schema Proposed

```sql
CREATE TABLE IF NOT EXISTS affiliate_program_planners (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  affiliate_program_id TEXT NOT NULL REFERENCES affiliate_programs(id) ON DELETE CASCADE,
  content_planner_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, affiliate_program_id, content_planner_id)
);

CREATE INDEX IF NOT EXISTS idx_aff_prog_planners_lookup
  ON affiliate_program_planners (tenant_id, affiliate_program_id);

CREATE TABLE IF NOT EXISTS affiliate_planner_row_links (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  affiliate_program_id TEXT NOT NULL REFERENCES affiliate_programs(id) ON DELETE CASCADE,
  content_planner_id TEXT NOT NULL,
  planner_row_id TEXT NOT NULL,
  program_product_id TEXT REFERENCES affiliate_program_products(id) ON DELETE SET NULL,
  funnel_stage TEXT CHECK (funnel_stage IN ('TOFU', 'MOFU', 'BOFU')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, affiliate_program_id, content_planner_id, planner_row_id)
);

CREATE INDEX IF NOT EXISTS idx_aff_planner_row_links_lookup
  ON affiliate_planner_row_links (tenant_id, affiliate_program_id, content_planner_id);
```

## 4. Proposed Changes

### Database Layer
- **[MODIFY] [db-pg.js](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/db-pg.js)**: Tambahkan auto-migration untuk `affiliate_program_planners` dan `affiliate_planner_row_links`.

### Server Adapters
- **[NEW] [affiliate-studio-planner-adapter.js](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/affiliate-studio-planner-adapter.js)**: Menyediakan method link/unlink planner, configure row links, fetch calendar & program timeline, dan hitung coverage summary.

### API Routes
- **[NEW] [route.js (Planners Connection)](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/planners/route.js)**: Endpoint GET list linked planners & POST link new planner.
- **[NEW] [route.js (Planner Link Detail)](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/planners/[plannerId]/route.js)**: Endpoint DELETE unlink planner.
- **[NEW] [route.js (Row Links)](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/planners/[plannerId]/rows/route.js)**: Endpoint GET list row links & PUT update row mappings.

### User Interface
- **[NEW] [CampaignProgramPlanners.js](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/CampaignProgramPlanners.js)**: Component untuk menampilkan content planners yang terhubung, coverage summary, calendar grid, dan dialog linking.
- **[MODIFY] [CampaignProgramDetail.js](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/CampaignProgramDetail.js)**: Tambahkan submenu/tab lokal "Content Plan" di samping "Associated Products".
- **[MODIFY] [AffiliateStudio.module.css](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/AffiliateStudio.module.css)**: Tambahkan style calendar, progress bars, dan tables.

## 5. Execution Task List

### 5.1 Database & Server Layer
- [x] Implementasikan auto-migration Fase 4 di [`lib/db-pg.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/db-pg.js).
- [x] Buat file server adapter [`lib/affiliate-studio-planner-adapter.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/affiliate-studio-planner-adapter.js).
- [x] Buat API Route link/list planners [`app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/planners/route.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/v2/affiliate-studio/brands/%5Bid%5D/programs/%5BprogramId%5D/planners/route.js).
- [x] Buat API Route unlink planner [`app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/planners/[plannerId]/route.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/v2/affiliate-studio/brands/%5Bid%5D/programs/%5BprogramId%5D/planners/%5BplannerId%5D/route.js).
- [x] Buat API Route row links [`app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/planners/[plannerId]/rows/route.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/v2/affiliate-studio/brands/%5Bid%5D/programs/%5BprogramId%5D/planners/%5BplannerId%5D/rows/route.js).

### 5.2 UI & Layout Integration
- [x] Buat component [`app/affiliate-studio/components/CampaignProgramPlanners.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/CampaignProgramPlanners.js).
- [x] Modifikasi [`app/affiliate-studio/components/CampaignProgramDetail.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/CampaignProgramDetail.js) untuk memuat tab Content Plan dan me-render `CampaignProgramPlanners`.
- [x] Tambahkan class CSS di [`app/affiliate-studio/components/AffiliateStudio.module.css`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/AffiliateStudio.module.css) untuk visualisasi calendar & summary.

### 5.3 Verification & Quality Gate
- [x] Buat berkas unit & integration tests [`tests/affiliate-studio-planner-connection.test.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/tests/affiliate-studio-planner-connection.test.js).
- [x] Buat berkas boundary tests [`tests/affiliate-studio-phase-04-boundary.test.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/tests/affiliate-studio-phase-04-boundary.test.js).
- [x] Jalankan all tests & regressions.
- [x] Jalankan `git diff --check`.
- [x] Jalankan `npm run build`.
- [ ] Lakukan release patch otomatis `v2.25.2`.

## 6. Verification Plan

### Automated Tests
- `node --experimental-test-module-mocks --test tests/affiliate-studio-planner-connection.test.js`
- `node --experimental-test-module-mocks --test tests/affiliate-studio-phase-04-boundary.test.js`
- Regressions: all tests.

### Manual Verification
- Uji integrasi linking content planners dan visual coverage calendar di dev mac mini server.
