# JIT Implementation Plan — Affiliate Studio Fase 9: Publishing Connection

> Status: Executable  
> Parent roadmap: [affiliate-studio-roadmap.md](file:///Users/sabeqmmursyid/_maknaflow-staging/sot/menus/affiliate-studio-roadmap.md)  
> Master orchestrator: [master-execution-orchestrator.md](file:///Users/sabeqmmursyid/_maknaflow-staging/sot/menus/affiliate-studio/master-execution-orchestrator.md)  
> Dependency: Fase 8 Creative Intelligence Connection (`v2.25.6`) terilis dan seluruh tes lulus.

## 1. Objective

Menghubungkan Affiliate Studio ke sistem Publishing Scheduler dan ContentFlow, memproyeksikan status penerbitan (Ready, Scheduled, Published, Failed) ke program runs queue, serta menampilkan deep link ke ContentFlow.

## 2. In Scope & Out of Scope

### In Scope
- Penilaian Publishing Preflight check (affiliate link, disclosure tag, active account, media readiness).
- Penyelarasan/proyeksi status run real-time berdasarkan jobs status di `publishing_jobs`.
- Deep linking dari queue item runs Affiliate Studio ke detail job di ContentFlow.

### Out of Scope
- Penjadwalan langsung/tindakan pemicu (scheduling actions) dari Affiliate Studio UI (dihandle oleh scheduler & ContentFlow).

## 3. Proposed Changes

### Server Layer
- **[NEW] [affiliate-studio-publishing-adapter.js](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/affiliate-studio-publishing-adapter.js)**: Menyediakan method checking preflight dan proyeksi status publishing.

### API Routes
- **[NEW] [route.js (Publishing preflight & status API)](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/runs/[runId]/publishing/route.js)**: API GET endpoint untuk detail preflight & status.

### User Interface
- **[MODIFY] [CampaignProgramRuns.js](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/CampaignProgramRuns.js)**: Tampilkan preflight check indicator dan deep link.
- **[MODIFY] [AffiliateStudio.module.css](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/AffiliateStudio.module.css)**: CSS style indicators.

## 4. Execution Task List

### 4.1 Server Adapters & APIs
- [x] Buat publishing adapter [`lib/affiliate-studio-publishing-adapter.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/affiliate-studio-publishing-adapter.js).
- [x] Buat API Route publishing details [`app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/runs/[runId]/publishing/route.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/v2/affiliate-studio/brands/%5Bid%5D/programs/%5BprogramId%5D/runs/%5BrunId%5D/publishing/route.js).

### 4.2 UI & Layout Integration
- [x] Modifikasi [`app/affiliate-studio/components/CampaignProgramRuns.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/CampaignProgramRuns.js) untuk menambahkan preflight check badges dan deep link.
- [x] Tambahkan class CSS di [`app/affiliate-studio/components/AffiliateStudio.module.css`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/AffiliateStudio.module.css).

### 4.3 Verification & Quality Gate
- [x] Buat unit & integration tests `tests/affiliate-studio-publishing.test.js`.
- [x] Buat boundary tests `tests/affiliate-studio-phase-09-boundary.test.js`.
- [x] Jalankan all tests & regressions.
- [x] Jalankan `git diff --check`.
- [x] Jalankan `npm run build`.
- [x] Lakukan release patch otomatis `v2.25.7`.

## 5. Verification Plan

### Automated Tests
- `node --experimental-test-module-mocks --test tests/affiliate-studio-publishing.test.js`
- `node --experimental-test-module-mocks --test tests/affiliate-studio-phase-09-boundary.test.js`
- Regressions: all tests.

### Manual Verification
- Buka tab "Runs" di UI, verifikasi status runs terupdate otomatis dengan link/badge preflight yang sesuai.
