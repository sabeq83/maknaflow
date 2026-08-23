# JIT Implementation Plan — Affiliate Studio Fase 8: Creative Intelligence Connection

> Status: Executable  
> Parent roadmap: [affiliate-studio-roadmap.md](file:///Users/sabeqmmursyid/_maknaflow-staging/sot/menus/affiliate-studio-roadmap.md)  
> Master orchestrator: [master-execution-orchestrator.md](file:///Users/sabeqmmursyid/_maknaflow-staging/sot/menus/affiliate-studio/master-execution-orchestrator.md)  
> Dependency: Fase 7 Smart Route Recommendation (`v2.25.5`) terilis dan seluruh tes lulus.

## 1. Objective

Menghubungkan parameter kreatif dan target audiens dari program kampanye Affiliate Studio (target demographic, target persona, AI directive, mandatory outro line) agar disalurkan secara otomatis ke parameter payload peluncuran engine legacy (RE, Pillar, Recipe, dll.) melalui Launch Connectors.

## 2. In Scope & Out of Scope

### In Scope
- Penarikan otomatis target persona, target demografi, mandatory outro lines, dan AI directive dari data program.
- Penerusan parameter kreatif program tersebut ke tabel engine legacy saat memicu peluncuran run.

### Out of Scope
- Sinkronisasi manual Knowledge Base di luar domain parameter program kampanye Affiliate Studio.

## 3. Proposed Changes

### Server Layer
- **[MODIFY] [affiliate-studio-launch-adapter.js](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/affiliate-studio-launch-adapter.js)**: Modifikasi `launchEngineCampaign` untuk memetakan dan menyisipkan parameter kreatif dari program kampanye ke tabel campaign engine legacy.

## 4. Execution Task List

### 4.1 Server Adapters & APIs
- [x] Modifikasi launch adapter [`lib/affiliate-studio-launch-adapter.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/affiliate-studio-launch-adapter.js) untuk memetakan parameter kreatif.

### 4.2 Verification & Quality Gate
- [x] Buat unit & integration tests `tests/affiliate-studio-creative-intelligence.test.js`.
- [x] Buat boundary tests `tests/affiliate-studio-phase-08-boundary.test.js`.
- [x] Jalankan all tests & regressions.
- [x] Jalankan `git diff --check`.
- [x] Jalankan `npm run build`.
- [x] Lakukan release patch otomatis `v2.25.6`.

## 5. Verification Plan

### Automated Tests
- `node --experimental-test-module-mocks --test tests/affiliate-studio-creative-intelligence.test.js`
- `node --experimental-test-module-mocks --test tests/affiliate-studio-phase-08-boundary.test.js`
- Regressions: all tests.

### Manual Verification
- Jalankan trigger launch campaign pada server dev mini, verifikasi data parameter kreatif program sukses terkirim dan disimpan di tabel campaign engine legacy.
