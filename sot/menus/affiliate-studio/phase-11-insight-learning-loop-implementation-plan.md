# JIT Implementation Plan — Affiliate Studio Fase 11: Insight and Learning Loop

> Status: Executable  
> Parent roadmap: [affiliate-studio-roadmap.md](file:///Users/sabeqmmursyid/_maknaflow-staging/sot/menus/affiliate-studio-roadmap.md)  
> Master orchestrator: [master-execution-orchestrator.md](file:///Users/sabeqmmursyid/_maknaflow-staging/sot/menus/affiliate-studio/master-execution-orchestrator.md)  
> Dependency: Fase 10 Performance Foundation (`v2.25.8`) terilis dan seluruh tes lulus.

## 1. Objective

Menghubungkan data performa kembali ke pipeline kualitatif (insight loop) dengan menghitung korelasi performa konten terhadap parameter kreatif DNA (Hook, CTA, Angle, VFO, dll.) untuk merekomendasikan brief dengan performa terbaik.

## 2. In Scope & Out of Scope

### In Scope
- Insight adapter untuk agregasi rata-rata views/clicks/revenue berdasarkan Hook, Strategic Angle, dan Pillar.
- API Route GET `/api/v2/affiliate-studio/brands/[id]/programs/[programId]/insights`.
- Visual DNA insights panel di dalam tab Performance detail program kampanye.

### Out of Scope
- Auto-updating content planner row directives (hanya visual dashboard insights untuk user).

## 3. Proposed Changes

### Server Layer
- **[NEW] [affiliate-studio-insight-adapter.js](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/affiliate-studio-insight-adapter.js)**: Adapter DNA insights generator.

### API Routes
- **[NEW] [route.js (Insights endpoint)](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/insights/route.js)**: GET insights API endpoint.

### User Interface
- **[MODIFY] [CampaignProgramDetail.js](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/CampaignProgramDetail.js)**: Tampilkan daftar Top Hooks dan Top Angles.
- **[MODIFY] [AffiliateStudio.module.css](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/AffiliateStudio.module.css)**: CSS styles untuk list & cards insights.

## 4. Execution Task List

### 4.1 Adapters & APIs
- [x] Buat insight adapter [`lib/affiliate-studio-insight-adapter.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/affiliate-studio-insight-adapter.js).
- [x] Buat API Route insights [`app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/insights/route.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/v2/affiliate-studio/brands/%5Bid%5D/programs/%5BprogramId%5D/insights/route.js).

### 4.2 UI & Layout Integration
- [x] Modifikasi [`app/affiliate-studio/components/CampaignProgramDetail.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/CampaignProgramDetail.js) untuk memuat dan menampilkan DNA creative insights.
- [x] Tambahkan class CSS di [`app/affiliate-studio/components/AffiliateStudio.module.css`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/AffiliateStudio.module.css).

### 4.3 Verification & Quality Gate
- [x] Buat unit & integration tests `tests/affiliate-studio-insights.test.js`.
- [x] Buat boundary tests `tests/affiliate-studio-phase-11-boundary.test.js`.
- [x] Jalankan all tests & regressions.
- [x] Jalankan `git diff --check`.
- [x] Jalankan `npm run build`.
- [x] Lakukan release patch otomatis `v2.25.9`.

## 5. Verification Plan

### Automated Tests
- `node --experimental-test-module-mocks --test tests/affiliate-studio-insights.test.js`
- `node --experimental-test-module-mocks --test tests/affiliate-studio-phase-11-boundary.test.js`
- Regressions: all tests.

### Manual Verification
- Verifikasi tab performa di program detail memuat daftar korelasi DNA kreatif Hook & Angle terbaik dengan hitungan rata-rata views/revenue yang akurat sesuai data snapshots performa.
