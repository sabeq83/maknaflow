# JIT Implementation Plan — Affiliate Studio Fase 6: Engine Launch Connectors

> Status: Executable  
> Parent roadmap: [affiliate-studio-roadmap.md](file:///Users/sabeqmmursyid/_maknaflow-staging/sot/menus/affiliate-studio-roadmap.md)  
> Master orchestrator: [master-execution-orchestrator.md](file:///Users/sabeqmmursyid/_maknaflow-staging/sot/menus/affiliate-studio/master-execution-orchestrator.md)  
> Dependency: Fase 5 Unified Production Visibility (`v2.25.3`) terilis dan seluruh tes lulus.

## 1. Objective

Memungkinkan Affiliate Studio meluncurkan eksekusi campaign produksi secara langsung ke masing-masing engine existing (RE, Pillar, Recipe, Multiplier, Instant, Bridging) melalui adapter launch connector, idempotency keys, dan preflight checks tanpa memodifikasi logika internal engine.

## 2. In Scope & Out of Scope

### In Scope
- Form trigger launch inline pada detail mapping row Content Planner.
- Validasi preflight (Brand, target product, dan resolved affiliate link).
- Idempotency check untuk mencegah double trigger pada baris planner row yang sama.
- API Route:
  - `POST /api/v2/affiliate-studio/brands/[id]/programs/[programId]/runs/launch` (Launch runs target)
- UI Integrations:
  - Dropdown selector engine pendukung dan tombol Launch Campaign.
  - Success message dan immediate listing runs update.

### Out of Scope
- Logika prompts generator atau internal validation masing-masing engine.
- Form lengkap konfigurasi campaign di UI legacy masing-masing engine.

## 3. Database Schema Proposed

N/A (Additive schema data reference sudah tersimpan lengkap pada tabel `affiliate_content_runs` di Fase 5).

## 4. Proposed Changes

### Server Layer
- **[NEW] [affiliate-studio-launch-adapter.js](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/affiliate-studio-launch-adapter.js)**: Menyediakan method `preflightCheck` dan `launchEngineCampaign`.

### API Routes
- **[NEW] [route.js (Launch run endpoint)](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/runs/launch/route.js)**: API POST endpoint untuk memicu preflight check dan meluncurkan engine campaign.

### User Interface
- **[MODIFY] [CampaignProgramPlanners.js](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/CampaignProgramPlanners.js)**: Modifikasi panel mapping baris planner editorial untuk menambahkan tombol **Launch Engine Campaign** beserta picker pilihan engine.
- **[MODIFY] [AffiliateStudio.module.css](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/AffiliateStudio.module.css)**: Tambahkan CSS classes untuk layout launch area row, inline engine switcher, dan trigger button.

## 5. Execution Task List

### 5.1 Server Adapters & APIs
- [x] Buat launch adapter [`lib/affiliate-studio-launch-adapter.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/affiliate-studio-launch-adapter.js).
- [x] Buat API Route launch runs [`app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/runs/launch/route.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/v2/affiliate-studio/brands/%5Bid%5D/programs/%5BprogramId%5D/runs/launch/route.js).

### 5.2 UI & Layout Integration
- [x] Modifikasi [`app/affiliate-studio/components/CampaignProgramPlanners.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/CampaignProgramPlanners.js) untuk menambahkan form launch inline.
- [x] Tambahkan class CSS di [`app/affiliate-studio/components/AffiliateStudio.module.css`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/AffiliateStudio.module.css) untuk styling launch area.

### 5.3 Verification & Quality Gate
- [x] Buat unit & integration tests `tests/affiliate-studio-launch-connectors.test.js`.
- [x] Buat boundary tests `tests/affiliate-studio-phase-06-boundary.test.js`.
- [x] Jalankan all tests & regressions.
- [x] Jalankan `git diff --check`.
- [x] Jalankan `npm run build`.
- [x] Lakukan release patch otomatis `v2.25.4`.

## 6. Verification Plan

### Automated Tests
- `node --experimental-test-module-mocks --test tests/affiliate-studio-launch-connectors.test.js`
- `node --experimental-test-module-mocks --test tests/affiliate-studio-phase-06-boundary.test.js`
- Regressions: all tests.

### Manual Verification
- Uji peluncuran kampanye expert route secara real-time dan verifikasi lineage data pada tabel `affiliate_content_runs`.
