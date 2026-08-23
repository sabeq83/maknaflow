# JIT Implementation Plan — Affiliate Studio Fase 7: Smart Route Recommendation

> Status: Executable  
> Parent roadmap: [affiliate-studio-roadmap.md](file:///Users/sabeqmmursyid/_maknaflow-staging/sot/menus/affiliate-studio-roadmap.md)  
> Master orchestrator: [master-execution-orchestrator.md](file:///Users/sabeqmmursyid/_maknaflow-staging/sot/menus/affiliate-studio/master-execution-orchestrator.md)  
> Dependency: Fase 6 Engine Launch Connectors (`v2.25.4`) terilis dan seluruh tes lulus.

## 1. Objective

Menyediakan fitur rekomendasi cerdas (Smart Route Recommendation) berbasis heuristik/AI untuk menyarankan production engine (RE, Pillar, Recipe, Multiplier, Instant, Bridging) yang paling optimal bagi setiap baris content planner berdasarkan pilar, category_cep, funnel_stage, dan data target product.

## 2. In Scope & Out of Scope

### In Scope
- Heuristik penganalisis pilar, category, funnel stage, dan product snapshots.
- API Route:
  - `GET /api/v2/affiliate-studio/brands/[id]/programs/[programId]/runs/recommend` (Fetch engine recommendation)
- UI Integrations:
  - Tombol Recommend di samping dropdown engine.
  - Modal hasil rekomendasi dengan confidence score dan detail reasoning.
  - Auto-select engine terplilih di dropdown setelah direkomendasikan.

### Out of Scope
- Integrasi ke LLM API eksternal (menggunakan heuristic rule terprogram yang cepat dan andal).

## 3. Database Schema Proposed

N/A (Menggunakan tabel audit trail `affiliate_program_events` yang sudah dibuat di Fase 3).

## 4. Proposed Changes

### Server Layer
- **[NEW] [affiliate-studio-recommendation-adapter.js](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/affiliate-studio-recommendation-adapter.js)**: Menyediakan method `getSmartRouteRecommendation`.

### API Routes
- **[NEW] [route.js (Recommendation endpoint)](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/runs/recommend/route.js)**: API GET endpoint untuk mengambil rekomendasi engine.

### User Interface
- **[MODIFY] [CampaignProgramPlanners.js](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/CampaignProgramPlanners.js)**: Modifikasi UI planner rows untuk render tombol Recommend dan modal popup rekomendasi.
- **[MODIFY] [AffiliateStudio.module.css](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/AffiliateStudio.module.css)**: Tambahkan CSS classes pendukung styling modal dan tombol recomend.

## 5. Execution Task List

### 5.1 Server Adapters & APIs
- [x] Buat recommendation adapter [`lib/affiliate-studio-recommendation-adapter.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/affiliate-studio-recommendation-adapter.js).
- [x] Buat API Route recommendation runs [`app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/runs/recommend/route.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/v2/affiliate-studio/brands/%5Bid%5D/programs/%5BprogramId%5D/runs/recommend/route.js).

### 5.2 UI & Layout Integration
- [x] Modifikasi [`app/affiliate-studio/components/CampaignProgramPlanners.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/CampaignProgramPlanners.js) untuk menambahkan tombol modal rekomendasi.
- [x] Tambahkan class CSS di [`app/affiliate-studio/components/AffiliateStudio.module.css`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/AffiliateStudio.module.css) untuk styling modal rekomendasi.

### 5.3 Verification & Quality Gate
- [x] Buat unit & integration tests `tests/affiliate-studio-recommendations.test.js`.
- [x] Buat boundary tests `tests/affiliate-studio-phase-07-boundary.test.js`.
- [x] Jalankan all tests & regressions.
- [x] Jalankan `git diff --check`.
- [x] Jalankan `npm run build`.
- [x] Lakukan release patch otomatis `v2.25.5`.

## 6. Verification Plan

### Automated Tests
- `node --experimental-test-module-mocks --test tests/affiliate-studio-recommendations.test.js`
- `node --experimental-test-module-mocks --test tests/affiliate-studio-phase-07-boundary.test.js`
- Regressions: all tests.

### Manual Verification
- Klik tombol "Recommend" pada salah satu baris planner di UI dev macmini server, verifikasi kecocokan hasil heuristik dan log audit event.
