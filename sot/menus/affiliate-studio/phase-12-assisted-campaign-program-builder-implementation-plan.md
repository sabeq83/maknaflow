# JIT Implementation Plan — Affiliate Studio Fase 12: Assisted Campaign Program Builder

> Status: Executable  
> Parent roadmap: [affiliate-studio-roadmap.md](file:///Users/sabeqmmursyid/_maknaflow-staging/sot/menus/affiliate-studio-roadmap.md)  
> Master orchestrator: [master-execution-orchestrator.md](file:///Users/sabeqmmursyid/_maknaflow-staging/sot/menus/affiliate-studio/master-execution-orchestrator.md)  
> Dependency: Fase 11 Insight & Learning Loop (`v2.25.9`) terilis dan seluruh tes lulus.

## 1. Objective

Menutup loop penuh (Full-Loop Orchestration) dengan membangun asisten pembuat program kampanye (Assisted Builder) menggunakan Single-Pass Engine Gemini AI untuk mengusulkan konfigurasi program (name, funnelMix, platforms, target demographic, AI directives) berdasarkan data historis brand dan produk.

## 2. In Scope & Out of Scope

### In Scope
- Adapter AI Assisted Builder memanggil Gemini AI model `gemini-1.5-flash` dengan system instructions khusus.
- API Route POST `/api/v2/affiliate-studio/brands/[id]/programs/suggest`.
- Interactive setup modal setup asisten dan pemicu instant program creation di view program list.

### Out of Scope
- Fine-tuning model khusus (menggunakan zero-shot direct prompt dan schema structures).

## 3. Proposed Changes

### Server Layer
- **[NEW] [affiliate-studio-builder-adapter.js](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/affiliate-studio-builder-adapter.js)**: Call Gemini AI client to formulate suggested campaign configs.

### API Routes
- **[NEW] [route.js (Suggest program endpoint)](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/v2/affiliate-studio/brands/[id]/programs/suggest/route.js)**: POST endpoint.

### User Interface
- **[MODIFY] [BrandCampaignPrograms.js](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/BrandCampaignPrograms.js)**: Tambahkan pemicu modal AI Assistant dan instant creation adoption handler.
- **[MODIFY] [AffiliateStudio.module.css](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/AffiliateStudio.module.css)**: CSS style asisten setup button & overlay.

## 4. Execution Task List

### 4.1 Server Adapters & APIs
- [x] Buat builder adapter [`lib/affiliate-studio-builder-adapter.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/affiliate-studio-builder-adapter.js).
- [x] Buat API Route builder suggest [`app/api/v2/affiliate-studio/brands/[id]/programs/suggest/route.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/v2/affiliate-studio/brands/%5Bid%5D/programs/suggest/route.js).

### 4.2 UI & Layout Integration
- [x] Modifikasi [`app/affiliate-studio/components/BrandCampaignPrograms.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/BrandCampaignPrograms.js) untuk menambahkan pemicu modal AI Assistant.
- [x] Tambahkan class CSS di [`app/affiliate-studio/components/AffiliateStudio.module.css`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/AffiliateStudio.module.css).

### 4.3 Verification & Quality Gate
- [x] Buat unit & integration tests `tests/affiliate-studio-builder.test.js`.
- [x] Buat boundary tests `tests/affiliate-studio-phase-12-boundary.test.js`.
- [x] Jalankan all tests & regressions.
- [x] Jalankan `git diff --check`.
- [x] Jalankan `npm run build`.
- [x] Lakukan release patch otomatis `v2.25.10`.

## 5. Verification Plan

### Automated Tests
- `node --experimental-test-module-mocks --test tests/affiliate-studio-builder.test.js`
- `node --experimental-test-module-mocks --test tests/affiliate-studio-phase-12-boundary.test.js`
- Regressions: all tests.

### Manual Verification
- Klik pemicu AI Assistant di daftar program, verifikasi Gemini AI mengusulkan struktur program kampanye kualitatif lengkap (Name, Funnel, Platforms, Target demographic, AI directives) kemudian tekan Adopt & Create Program untuk memverifikasi program kampanye berhasil dibuat.
