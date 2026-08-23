# JIT Implementation Plan — Affiliate Studio Fase 10: Performance Foundation

> Status: Executable  
> Parent roadmap: [affiliate-studio-roadmap.md](file:///Users/sabeqmmursyid/_maknaflow-staging/sot/menus/affiliate-studio-roadmap.md)  
> Master orchestrator: [master-execution-orchestrator.md](file:///Users/sabeqmmursyid/_maknaflow-staging/sot/menus/affiliate-studio/master-execution-orchestrator.md)  
> Dependency: Fase 9 Publishing Connection (`v2.25.7`) terilis dan seluruh tes lulus.

## 1. Objective

Membangun landasan pengukuran kinerja (Performance Foundation) dengan membuat tabel `affiliate_performance_snapshots` untuk melacak metrik performa (views, likes, shares, clicks, conversions, revenue) per konten run, program, brand, dan platform.

## 2. In Scope & Out of Scope

### In Scope
- Skema tabel `affiliate_performance_snapshots`.
- Ingest batch performa snaps melalui API endpoint `POST /api/v2/affiliate-studio/brands/[id]/programs/[programId]/performance`.
- Proyeksi run status ke 'Measured' setelah dikaitkan snapshot kinerja.
- Integrasi tab metrik ringkasan performa pada view detail program.

### Out of Scope
- Sinkronisasi langsung/background scheduler pull dari API metrik platform (menggunakan batch import konektor).

## 3. Proposed Changes

### Server Layer
- **[MODIFY] [db-pg.js](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/db-pg.js)**: Tambahkan table snapshots performa dalam migrasi skema.
- **[NEW] [affiliate-studio-performance-adapter.js](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/affiliate-studio-performance-adapter.js)**: Adapter metrik import dan get summaries.

### API Routes
- **[NEW] [route.js (Performance endpoints)](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/performance/route.js)**: GET summaries / POST batch import endpoints.

### User Interface
- **[MODIFY] [CampaignProgramDetail.js](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/CampaignProgramDetail.js)**: Tambahkan tab Performance and card metrik grid.
- **[MODIFY] [AffiliateStudio.module.css](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/AffiliateStudio.module.css)**: CSS style performance summary panel.

## 4. Execution Task List

### 4.1 Database Schema & Adapters
- [x] Modifikasi schema migrations [`lib/db-pg.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/db-pg.js) untuk menambahkan tabel snapshots performa.
- [x] Buat performance adapter [`lib/affiliate-studio-performance-adapter.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/affiliate-studio-performance-adapter.js).
- [x] Buat API Route performance [`app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/performance/route.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/v2/affiliate-studio/brands/%5Bid%5D/programs/%5BprogramId%5D/performance/route.js).

### 4.2 UI & Layout Integration
- [x] Modifikasi [`app/affiliate-studio/components/CampaignProgramDetail.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/CampaignProgramDetail.js) untuk menampilkan tab Performance.
- [x] Tambahkan class CSS di [`app/affiliate-studio/components/AffiliateStudio.module.css`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/AffiliateStudio.module.css).

### 4.3 Verification & Quality Gate
- [x] Buat unit & integration tests `tests/affiliate-studio-performance.test.js`.
- [x] Buat boundary tests `tests/affiliate-studio-phase-10-boundary.test.js`.
- [x] Jalankan all tests & regressions.
- [x] Jalankan `git diff --check`.
- [x] Jalankan `npm run build`.
- [x] Lakukan release patch otomatis `v2.25.8`.

## 5. Verification Plan

### Automated Tests
- `node --experimental-test-module-mocks --test tests/affiliate-studio-performance.test.js`
- `node --experimental-test-module-mocks --test tests/affiliate-studio-phase-10-boundary.test.js`
- Regressions: all tests.

### Manual Verification
- Pemicu POST data performa via API endpoint, verifikasi jumlah terimpor dan perubahan status runs menjadi 'Measured' serta perubahan summary tab performa di detail program kampanye.
