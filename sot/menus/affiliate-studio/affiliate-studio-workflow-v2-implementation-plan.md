# Implementation Plan — Affiliate Studio Workflow V2

> Status: Proposed — menunggu approval sebelum eksekusi  
> Repository: `/Users/sabeqmmursyid/_contentflow-staging`  
> Baseline: Affiliate Studio fase 0–12 selesai pada `v2.25.11`  
> Companion instruction: `affiliate-studio-workflow-v2-antigravity-agent-instructions.md`

## 1. Tujuan

Mengubah Affiliate Studio menjadi satu workflow brand-first yang kontinu:

```text
Content Calendar
  → Content Planner
  → Production Workspace
  → ContentFlow Publishing
  → ContentFlow Analytics + Affiliate Performance
  → rekomendasi ke kalender berikutnya
```

User bekerja di satu shell Affiliate Studio. Engine dan tabel legacy tetap menjadi source of truth; Affiliate Studio bertindak sebagai orchestration, projection, dan review workspace.

## 2. Prinsip Arsitektur

1. **Satu lineage end-to-end.** Setiap item harus dapat ditelusuri dari calendar sampai performance.
2. **Reuse, bukan duplikasi.** Content Planner, Pillar production contract, Publishing Scheduler, dan ContentFlow Analytics tidak disalin.
3. **Brand dan tenant selalu eksplisit.** Tidak boleh mengandalkan nama brand sebagai identity utama.
4. **Human approval gate.** Calendar dapat mengirim draft ke Planner; Planner hanya mengirim row approved ke Production.
5. **Idempotent handoff.** Retry tidak boleh membuat planner row, production run, atau publishing job ganda.
6. **Snapshot komersial immutable.** Nama produk, affiliate URL, offer, disclosure, dan CTA yang dipakai produksi disimpan sebagai snapshot.
7. **Progressive adoption.** Existing data dan deep link tetap dapat dibuka selama migrasi.

## 3. Current-State Baseline

### Sudah tersedia

- `AffiliateStudioShell` dengan tab Overview, Products, Content Calendar, Planner, Production, Publishing, dan Performance.
- `AffiliateContentCalendar` untuk membuat jadwal brand editorial/product campaign.
- Sidecar planner: `affiliate_program_planners` dan `affiliate_planner_row_links`.
- Production references: `affiliate_content_runs`, events, launch adapters, dan status reconciliation.
- Publishing projection melalui `affiliate-studio-publishing-adapter.js`.
- Performance snapshot dan insight adapters.
- ContentFlow dengan `PublishingScheduler` dan `ContentFlowAnalytics` yang sudah matang.
- Pillar Campaign memiliki pola campaign workspace dan detail production yang familier bagi user.

### Gap aktual

- Calendar, Planner, Production, Publishing, dan Performance masih terasa sebagai halaman/proyeksi terpisah.
- Production Affiliate Studio masih berupa run table + deep link; belum menjadi workspace storyboard/VO/T2I/I2V.
- Handoff calendar → planner dan planner → production belum memakai satu kontrak lineage yang tegas.
- Publishing masih menampilkan projection per run, belum menyematkan pengalaman ContentFlow Scheduler.
- Performance Affiliate Studio masih ringkasan sederhana dan berpotensi menduplikasi analytics.
- Beberapa lookup masih memakai `brandName/account_name`; canonical identity harus `tenant_id + brand_profile_id`.

## 4. Scope

### In scope

- Menjadikan lima tab pipeline sebagai navigasi utama di Affiliate Studio.
- Batch dispatch calendar items ke Content Planner.
- Review/approval planner rows dan ingest idempotent ke Production.
- Production campaign workspace dengan pola interaksi Pillar Campaign.
- Scene-level projection untuk storyboard, visual plan, VO, T2I, dan I2V.
- Embedded ContentFlow Publishing Scheduler dengan filter brand/program/run.
- Embedded ContentFlow Analytics dengan filter brand/program/product/platform.
- Affiliate metrics: clicks, conversions, revenue, CTR, CVR, EPC, dan revenue per 1.000 views.
- Learning-loop recommendation kembali ke calendar/planner.
- Migration/backfill, audit event, tenant isolation, permission checks, tests, dan docs.

### Out of scope

- Menulis ulang generator Content Planner.
- Menulis ulang worker/render pipeline Pillar Campaign.
- Menulis ulang Publishing Scheduler atau ContentFlow Analytics.
- Mengubah lifecycle platform publishing yang sudah working.
- Menghapus tabel/route legacy dalam release ini.
- Production deployment tanpa instruksi eksplisit user.

## 5. Information Architecture

Tab utama:

1. **Content Calendar** — create, edit, validate, batch send.
2. **Planner** — AI output, coverage, review, approve, send to production.
3. **Production** — campaign list, content items, scene inspector, generation state.
4. **Publishing** — embedded scheduler, preflight, calendar/board, status.
5. **Performance** — analytics, affiliate funnel, content/product insights.

Overview dan Products tetap tersedia sebagai brand setup, tetapi bukan bagian dari numbered pipeline.

URL contract:

```text
/affiliate-studio?brand={brandId}&view=calendar
/affiliate-studio?brand={brandId}&view=planner&program={programId}
/affiliate-studio?brand={brandId}&view=production&program={programId}&run={runId}&item={itemId}
/affiliate-studio?brand={brandId}&view=publishing&program={programId}
/affiliate-studio?brand={brandId}&view=performance&program={programId}
```

Semua filter harus shareable dan dipulihkan setelah refresh/back-forward.

## 6. Canonical Lineage Contract

```text
affiliate_calendar_item.id
  → content_planner.id
  → content_planner_row.id
  → affiliate_content_run.id
  → engine campaign/item id
  → content_flow_item.id / video_id
  → publishing_job.id
  → publication/platform post id
  → performance snapshot
```

Canonical reference minimum per content item:

```json
{
  "tenantId": "...",
  "brandProfileId": "...",
  "affiliateProgramId": "...",
  "calendarItemId": "...",
  "contentPlannerId": "...",
  "plannerRowId": "...",
  "contentRunId": "...",
  "engineType": "pillar",
  "engineCampaignId": "...",
  "engineItemId": "...",
  "contentFlowItemId": "...",
  "publishingJobId": "..."
}
```

Identity tidak boleh diturunkan hanya dari title, sequence, product name, atau account name.

## 7. Data Model

Lakukan audit schema aktual sebelum migration. Reuse kolom/tabel existing bila semantiknya sama.

### 7.1 Calendar dispatch fields

Tambahkan hanya bila belum tersedia:

```sql
ALTER TABLE affiliate_content_schedules
  ADD COLUMN IF NOT EXISTS brand_profile_id TEXT,
  ADD COLUMN IF NOT EXISTS affiliate_program_id TEXT,
  ADD COLUMN IF NOT EXISTS content_planner_id TEXT,
  ADD COLUMN IF NOT EXISTS dispatch_status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispatch_idempotency_key TEXT;
```

Allowed `dispatch_status`: `draft`, `ready`, `dispatching`, `planned`, `failed`, `cancelled`.

### 7.2 Unified lineage sidecar

Gunakan sidecar agar tabel engine legacy tidak perlu diubah:

```sql
CREATE TABLE IF NOT EXISTS affiliate_content_lineage (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  brand_profile_id TEXT NOT NULL,
  affiliate_program_id TEXT,
  calendar_item_id TEXT,
  content_planner_id TEXT,
  planner_row_id TEXT,
  affiliate_content_run_id TEXT,
  engine_type TEXT,
  engine_campaign_id TEXT,
  engine_item_id TEXT,
  content_flow_item_id TEXT,
  publishing_job_id TEXT,
  platform_publication_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
  product_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  offer_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_affiliate_lineage_planner_row
  ON affiliate_content_lineage (tenant_id, planner_row_id)
  WHERE planner_row_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_affiliate_lineage_brand_program
  ON affiliate_content_lineage (tenant_id, brand_profile_id, affiliate_program_id);
```

### 7.3 Production scene projection

Jangan menyalin media. Simpan hanya normalized projection dan references:

```sql
CREATE TABLE IF NOT EXISTS affiliate_production_scene_projection (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  affiliate_content_run_id TEXT NOT NULL,
  engine_scene_id TEXT,
  sequence INTEGER NOT NULL,
  normalized_stage TEXT NOT NULL,
  storyboard_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  visual_plan_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  voiceover_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  t2i_prompt_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  i2v_prompt_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  asset_refs_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_updated_at TIMESTAMPTZ,
  projected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, affiliate_content_run_id, sequence)
);
```

Jika engine sudah memiliki semua field yang dapat dibaca efisien, projection boleh dihitung read-time. Keputusan wajib didokumentasikan setelah audit query dan volume.

## 8. API Contract

Semua endpoint menggunakan auth existing, tenant context, assigned-brand authorization, validation, structured error, dan audit log.

### Calendar → Planner

```text
GET  /api/v2/affiliate-studio/brands/[id]/calendar
POST /api/v2/affiliate-studio/brands/[id]/calendar/dispatch
GET  /api/v2/affiliate-studio/brands/[id]/calendar/dispatches/[dispatchId]
```

`POST dispatch` menerima `calendarItemIds[]`, optional `affiliateProgramId`, dan `Idempotency-Key`. Response mengembalikan satu planner, mapping item→row, accepted/rejected items, dan status.

### Planner → Production

```text
GET  /api/v2/affiliate-studio/brands/[id]/planners/[plannerId]
POST /api/v2/affiliate-studio/brands/[id]/planners/[plannerId]/approve
POST /api/v2/affiliate-studio/brands/[id]/planners/[plannerId]/ingest-production
```

Ingest hanya menerima row approved. Retry dengan key sama mengembalikan run existing.

### Production workspace

```text
GET  /api/v2/affiliate-studio/brands/[id]/production
GET  /api/v2/affiliate-studio/brands/[id]/production/runs/[runId]
GET  /api/v2/affiliate-studio/brands/[id]/production/runs/[runId]/scenes
POST /api/v2/affiliate-studio/brands/[id]/production/runs/[runId]/reconcile
POST /api/v2/affiliate-studio/brands/[id]/production/runs/[runId]/actions/[action]
```

Action allowlist hanya meneruskan operasi yang memang tersedia di engine: generate/regenerate/review/approve/render. Jangan membuat state transition baru di Affiliate Studio.

### Publishing dan Performance

Gunakan endpoint ContentFlow existing. Tambahkan facade hanya jika diperlukan untuk canonical `brandProfileId` → `account_name` mapping atau affiliate metrics. Facade dilarang menduplikasi query/business rules existing.

## 9. UI Component Plan

### Shared

- `AffiliatePipelineTabs.js` — numbered stage navigation + count/status.
- `AffiliateWorkflowContext.js` — URL-derived brand/program/run/item selection.
- `AffiliateLineageBreadcrumb.js` — calendar → planner → production → publishing.
- `WorkflowEmptyState`, `WorkflowErrorState`, dan `WorkflowSkeleton`.

### Calendar

- Pertahankan `AffiliateContentCalendar`.
- Tambahkan readiness validation, multi-select, batch bar, dispatch result, retry, dan lineage badge.
- Jangan membuat planner secara implisit untuk item invalid.

### Planner

- Brand-level planner list dan selected planner workspace.
- Coverage cards: funnel, product, platform, schedule.
- Row table: hook, topic, funnel, product, format, approval, production state.
- Bulk approve dan ingest selected approved rows.

### Production

- `AffiliateProductionWorkspace.js` mengikuti interaction model Pillar Campaign:
  - campaign header;
  - KPI readiness;
  - content item list;
  - normalized stage rail;
  - scene inspector;
  - tabs Storyboard, Visual Plan, VO, T2I, I2V, Assets;
  - safe engine actions;
  - deep link sebagai fallback.
- Reuse component/presenter Pillar bila coupling aman; bila tidak, ekstrak presentational primitives tanpa memindahkan engine ownership.

### Publishing

- Bungkus `PublishingScheduler` agar menerima filter terkunci/terkontrol:
  - `brandProfileId`, resolved `accountName`, `affiliateProgramId`, `contentRunIds`.
- Semua scheduling action tetap melalui service dan endpoint ContentFlow.
- Tampilkan lineage dan affiliate preflight: product link, disclosure, account, media.

### Performance

- Bungkus `ContentFlowAnalytics` dengan controlled filters.
- Gabungkan analytics platform dan affiliate metrics pada server projection.
- Tambahkan comparison by content, product, funnel, platform, dan campaign.
- Recommendation bersifat advisory; tidak mengubah calendar otomatis.

## 10. Normalized Status Model

```text
Calendar: Draft → Ready → Dispatched
Planner: Planning → Review → Approved → Ingested
Production: Queued → Storyboard → VO → Visual Prompts → Generating → Rendering → Ready
Publishing: Preflight → Scheduled → Publishing → Published | Failed
Performance: Collecting → Measured
```

Setiap normalized status harus memiliki mapper terdokumentasi dari raw status engine. Status raw tidak diubah.

## 11. Security, Audit, dan Reliability

- Semua query wajib scoped oleh `tenant_id` dan authorized `brand_profile_id`.
- Verifikasi parent-child ownership untuk program, planner, row, run, scene, dan job.
- Mutation wajib permission checked dan audit logged.
- Idempotency wajib pada dispatch dan production ingest.
- Concurrent dispatch/ingest dilindungi transaction + unique constraint.
- Jangan expose affiliate URL/token/credential di log.
- Partial failure mengembalikan per-item result; jangan rollback item yang sudah sukses jika contract batch bersifat partial.
- Reconciliation tidak boleh mengubah raw engine state.

## 12. Implementation Phases

### W2-0 — Audit dan contract freeze

- [ ] Reconcile branch, HEAD, tag, dirty files, migration state, dan existing tests.
- [ ] Audit schema/calendar/planner/run/content-flow/publishing/performance contracts.
- [ ] Catat reuse decision dan forbidden-change list.
- [ ] Finalisasi lineage, statuses, permissions, dan API payloads.

Exit gate: contract tests ditulis dan plan diperbarui dengan file aktual.

### W2-1 — Lineage foundation

- [ ] Implement additive migration/backfill.
- [ ] Buat `affiliate-studio-lineage-repository.js` dan validator.
- [ ] Tambahkan idempotency + audit events.
- [ ] Backfill existing planner/run/ContentFlow references yang dapat dibuktikan; ambiguous records dilaporkan, bukan ditebak.

Exit gate: tenant/idempotency/backfill tests lulus.

### W2-2 — Calendar → Planner

- [ ] Tambahkan readiness contract dan batch selection UI.
- [ ] Implement dispatch service/API transaction.
- [ ] Create/reuse planner dan mapping row secara idempotent.
- [ ] Tambahkan dispatch progress/error/retry UI.

Exit gate: batch dispatch menghasilkan planner rows tepat satu kali.

### W2-3 — Planner → Production

- [ ] Tambahkan approval state/action bila belum canonical.
- [ ] Implement ingest approved rows ke `affiliate_content_runs` + engine launch contract.
- [ ] Persist immutable product/offer/directive snapshots.
- [ ] Tambahkan bulk approve/ingest UI.

Exit gate: hanya approved row masuk Production dan retry tidak menggandakan run.

### W2-4 — Production workspace

- [ ] Audit/extract presentational pattern dari Pillar Campaign.
- [ ] Implement campaign header, content item list, stage rail, dan scene inspector.
- [ ] Implement normalized scene projection/reconciliation.
- [ ] Wire safe action adapters dan deep-link fallback.
- [ ] Responsive + keyboard navigation + loading/error/empty states.

Exit gate: storyboard, visual plan, VO, T2I, dan I2V dapat direview dalam Affiliate Studio tanpa menyalin engine.

### W2-5 — Embedded Publishing

- [ ] Refactor `PublishingScheduler` menjadi reusable controlled component tanpa regresi `/content-flow`.
- [ ] Resolve canonical brand/program filters.
- [ ] Tampilkan preflight, calendar/board, schedule, retry, dan platform status.
- [ ] Persist ContentFlow lineage saat ingest/publishing job dibuat.

Exit gate: tindakan dari Affiliate Studio dan ContentFlow memakai service yang sama serta hasilnya identik.

### W2-6 — Embedded Performance dan learning loop

- [ ] Refactor `ContentFlowAnalytics` menjadi reusable controlled component.
- [ ] Gabungkan platform metrics dengan affiliate snapshots.
- [ ] Implement KPI, trends, breakdowns, attribution confidence, export.
- [ ] Implement advisory recommendations ke calendar/planner.

Exit gate: angka Affiliate Studio sama dengan ContentFlow untuk filter ekuivalen.

### W2-7 — Hardening, rollout, dan release

- [ ] Full regression, build, accessibility, responsive, URL-state, and error-state checks.
- [ ] Feature flags per phase dan rollback validation.
- [ ] Staging smoke hanya setelah user mengizinkan deployment staging.
- [ ] Update SOT, execution state, changelog, dan operator runbook.

Exit gate: release checkpoint terverifikasi; tidak ada Production deployment.

## 13. Planned File Changes

Final list ditentukan pada W2-0. Expected changes:

### New

- `lib/affiliate-studio-lineage-repository.js`
- `lib/affiliate-studio-calendar-dispatch-service.js`
- `lib/affiliate-studio-production-workspace-adapter.js`
- `app/affiliate-studio/components/AffiliatePipelineTabs.js`
- `app/affiliate-studio/components/AffiliateProductionWorkspace.js`
- `app/affiliate-studio/components/AffiliateSceneInspector.js`
- API routes di namespace `/api/v2/affiliate-studio/...`
- focused dan boundary tests `tests/affiliate-studio-workflow-v2-*.test.js`

### Modify

- `lib/db-pg.js`
- `lib/affiliate-studio-workspace-state.js`
- `app/affiliate-studio/components/AffiliateStudioShell.js`
- `app/affiliate-studio/components/AffiliateStudioWorkspace.js`
- `app/affiliate-studio/components/AffiliateContentCalendar.js`
- `app/affiliate-studio/components/AffiliateStudio.module.css`
- `app/content-flow/PublishingScheduler.js`
- `app/content-flow/ContentFlowAnalytics.js`

Refactor ContentFlow hanya untuk controlled props/reusability; default behavior route existing harus tetap sama.

## 14. Explicit No-Change List

- Raw lifecycle/state machine production engines.
- Content Planner generation prompt dan validator, kecuali contract audit membuktikan blocker dan plan diperbarui dahulu.
- Publishing provider integrations, token handling, retry policy, FFmpeg preflight semantics.
- ContentFlow analytics metric definitions.
- Existing route behavior untuk `/content-planner`, `/pillar-campaigns`, dan `/content-flow`.
- Product catalog canonical ownership.
- Production deployment configuration.

## 15. Test Matrix

| Area | Required evidence |
|---|---|
| Lineage | create, update, backfill, ambiguous skip, uniqueness |
| Tenant/RBAC | cross-tenant denial, unassigned brand denial, mutation permission |
| Calendar dispatch | validation, partial failure, duplicate retry, concurrency |
| Planner approval | approved-only ingest, immutable snapshot, duplicate retry |
| Production | raw→normalized status mapping, scene order, stale projection, actions allowlist |
| Publishing | controlled filters, preflight parity, ContentFlow regression |
| Performance | metric parity, zero denominator, timezone/range, attribution confidence |
| UI | URL restore, loading/error/empty, keyboard, responsive, brand switch |
| Boundary | no forbidden imports/writes, no duplicated engines, no secret logging |

Required commands minimum:

```bash
node --experimental-test-module-mocks --test --test-concurrency=1 tests/affiliate-studio-workflow-v2-*.test.js
node --experimental-test-module-mocks --test --test-concurrency=1 tests/affiliate-studio-*.test.js
npm run test:publishing-scheduler
git diff --check
npm run build
```

Tambahkan focused legacy tests berdasarkan file yang benar-benar disentuh.

## 16. Acceptance Criteria

- User dapat membuat calendar brief dan mengirim beberapa item ke satu planner.
- User dapat meninjau, menyetujui, dan meng-ingest planner rows tanpa duplikasi.
- Production menampilkan storyboard, visual plan, VO, T2I, I2V, asset, dan progress per content item.
- UI Production terasa konsisten dengan Pillar Campaign tanpa memindahkan engine ownership.
- Publishing Scheduler dapat digunakan dari Affiliate Studio dengan scope brand/program yang benar.
- Performance menunjukkan angka ContentFlow yang sama plus affiliate funnel metrics.
- Setiap item dapat ditelusuri end-to-end.
- Existing Content Planner, Pillar Campaign, ContentFlow Publishing, dan Analytics tidak regresi.
- Cross-tenant/cross-brand access ditolak.
- Build lulus dan Production tidak dideploy.

## 17. Rollback Strategy

- Feature flag per stage: `affiliate_workflow_v2`, `affiliate_production_workspace`, `affiliate_embedded_publishing`, `affiliate_embedded_performance`.
- Existing tabs/components tetap tersedia sebagai fallback selama satu release window.
- Migration additive; rollback aplikasi cukup mematikan flag.
- Jangan drop tabel/kolom pada rollback awal.
- Bila shared ContentFlow component regresi, restore default wrapper dan matikan embedded feature tanpa menghapus data lineage.

## 18. Release Strategy

- Satu checkpoint release untuk setiap W2 phase yang mengubah runtime.
- Jangan menyertakan unrelated dirty files.
- Gunakan title/points aktual setelah implementasi; jangan menebak version sebelum melihat baseline terbaru.
- Development smoke diperbolehkan sesuai SOP.
- Staging/Production deployment memerlukan authority sesuai repository SOP; Production selalu eksplisit.

## 19. Definition of Done

Workflow V2 dianggap selesai hanya bila seluruh acceptance criteria memiliki evidence, seluruh checkbox implementasi terverifikasi, SOT dan state diperbarui, release chain tercatat, dan tidak ada placeholder/mock-only path pada runtime utama.
