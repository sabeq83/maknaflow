# Antigravity Agent Instructions — Affiliate Studio Workflow V2

## Primary Mandate

Implementasikan `affiliate-studio-workflow-v2-implementation-plan.md` secara bertahap, additive, test-driven, dan checkpointed. Tujuan akhir adalah workflow tunggal Calendar → Planner → Production → Publishing → Performance tanpa menduplikasi engine legacy.

Dokumen implementation plan adalah spesifikasi utama. Jika audit runtime menemukan ketidaksesuaian, jangan diam-diam mengubah scope: catat evidence, perbarui bagian current-state/planned files/contract, lalu lanjut hanya bila perubahan tetap berada dalam mandat.

## Required Reading Order

Pada awal sesi dan setiap context recovery, baca lengkap:

1. `AGENTS.md` dan instruksi repository lain yang berlaku.
2. `sot/global/architecture.md`.
3. `sot/global/SOP_RELEASE_MAKNA_FLOW.md`.
4. `sot/global/CONTENTFLOW_INGESTION_INTEGRATION_KB.md`.
5. `sot/global/publishing-scheduler.md`.
6. `sot/menus/content-planner.md`.
7. `sot/menus/pillar-campaigns.md` dan `sot/menus/STRATEGIC_PILLAR_CAMPAIGN.md`.
8. `docs/content-flow-analytics/implementation_plan.md`.
9. `sot/menus/affiliate-studio/affiliate-studio-execution-state.md`.
10. `sot/menus/affiliate-studio/affiliate-studio-workflow-v2-implementation-plan.md`.
11. Source dan tests aktual yang disebut oleh phase aktif.

Jangan mengandalkan path lama `_maknaflow-staging`; repository aktif adalah `_contentflow-staging`.

## Start Protocol

Sebelum menulis code:

```bash
pwd
git status --short
git branch --show-current
git rev-parse --verify HEAD
git describe --tags --abbrev=0
```

Kemudian:

1. Rekam pre-existing dirty files; semua adalah user-owned.
2. Cocokkan execution state lama dengan Git, tetapi jangan membuka kembali fase 0–12.
3. Set Workflow V2 phase aktif ke `W2-0` pada state baru/section baru.
4. Audit schema, adapters, routes, components, dan tests sebelum finalisasi planned files.
5. Jangan mengedit file yang overlap dengan user-owned changes tanpa strategi aman.

## Execution Order

Eksekusi hanya dalam urutan:

```text
W2-0 Contract Audit
W2-1 Lineage Foundation
W2-2 Calendar → Planner
W2-3 Planner → Production
W2-4 Production Workspace
W2-5 Embedded Publishing
W2-6 Embedded Performance
W2-7 Hardening and Release
```

Jangan memulai phase berikutnya sebelum exit gate phase aktif lulus dan evidence dicatat.

## Non-Negotiable Architecture Rules

1. Content Planner tetap owner generator editorial.
2. Pillar/engine legacy tetap owner storyboard generation, T2I/I2V, VO, render, dan raw state.
3. ContentFlow tetap owner publishing jobs, provider integration, dan platform status.
4. ContentFlow Analytics tetap owner definisi metrics platform.
5. Affiliate Studio hanya orchestration, normalized projection, embedded UI, lineage, affiliate metrics, dan review actions.
6. Jangan copy-paste business logic dari module owner ke namespace Affiliate Studio.
7. Shared refactor harus mempertahankan default props/behavior route existing.
8. Gunakan canonical IDs; nama brand/account hanya display atau compatibility mapping.

## Implementation Discipline

- Prefer file baru dan adapter additive.
- Sebelum memodifikasi shared file, tulis test regresi untuk behavior existing.
- Gunakan transaction dan unique constraint untuk dispatch/ingest idempotency.
- Semua mutation memiliki actor, tenant, brand authorization, idempotency key, dan audit event.
- Semua batch response melaporkan accepted, rejected, existing, dan failed items.
- Jangan menebak mapping lineage. Ambiguous record harus ditandai dan dilewati.
- Jangan membuat placeholder API atau mock data di production route.
- Jangan menyimpan media binary di projection table.
- Jangan log affiliate URL penuh, credential, token, atau sensitive payload.
- Jangan melakukan opportunistic refactor.

## UI Instructions

- Jadikan Calendar, Planner, Production, Publishing, Performance sebagai numbered pipeline tabs.
- Pertahankan Overview dan Products sebagai setup area.
- URL adalah source of truth untuk brand/view/program/run/item selection.
- Production mengikuti mental model Pillar Campaign: campaign header, item list, stage rail, scene inspector.
- Jangan sekadar iframe/deep-link Production. Deep link hanya fallback.
- Publishing dan Performance harus memakai reusable ContentFlow components/services.
- Setiap view wajib memiliki loading, empty, error, stale-data, partial-failure, dan permission-denied state yang layak.
- Pastikan keyboard navigation, focus state, responsive layout, dan readable density.
- Jangan mengubah brand visual language secara menyeluruh dalam scope ini.

## API and Database Rules

- Validasi route params dan body dengan contract yang eksplisit.
- Gunakan existing response envelope dan error conventions.
- Selalu verifikasi resource chain:

```text
tenant → brand → program → planner → row → run → engine item → content flow item → publishing job
```

- Gunakan `SELECT ... FOR UPDATE` atau mekanisme repository equivalent untuk critical idempotent handoff.
- Backfill harus dry-run capable dan menghasilkan summary: scanned, linked, skipped, ambiguous, failed.
- Migration harus additive dan aman dieksekusi ulang.
- Dilarang drop/rename destructive pada workflow ini.

## Tests Required per Phase

Untuk setiap phase runtime:

1. Focused unit tests.
2. API/repository integration tests.
3. Tenant and assigned-brand isolation tests.
4. Idempotency/concurrency tests untuk mutation.
5. Boundary tests untuk forbidden writes/imports.
6. Relevant Affiliate Studio regressions.
7. Relevant owner-module regressions.
8. `git diff --check`.
9. `npm run build` sebelum release checkpoint.

Tidak boleh menghapus, skip, atau melemahkan test agar build lulus.

## Verification Commands

Gunakan command aktual dari `package.json`. Minimum final gate:

```bash
node --experimental-test-module-mocks --test --test-concurrency=1 tests/affiliate-studio-workflow-v2-*.test.js
node --experimental-test-module-mocks --test --test-concurrency=1 tests/affiliate-studio-*.test.js
npm run test:publishing-scheduler
git diff --check
npm run build
```

Tambahkan tests Content Planner, Pillar, ContentFlow Analytics, dan database yang relevan berdasarkan touched files.

## Progress and State Control

Setelah setiap milestone:

- Update checkbox plan hanya setelah evidence ada.
- Catat exact files, schema, API contracts, tests, dan known limitations.
- Catat resume point yang spesifik sebelum context handoff.
- Jangan menandai phase complete karena code terlihat benar.
- Setelah compaction/restart, reconcile state dengan Git dan test evidence.

Recommended state block:

```yaml
workflow: affiliate-studio-v2
status: planning|implementing|verifying|released|blocked|complete
current_phase: W2-0
current_task: exact task
baseline_head: exact SHA
last_verified_head: exact SHA
pre_existing_dirty_files: []
phase_owned_files: []
tests_passed: []
blocked: false
blocker: null
production_deployment_authorized: false
```

## Release Rules

- Satu runtime phase = satu recoverable release checkpoint.
- Reconcile version/tag/branch sebelum menentukan next version.
- Stage hanya phase-owned files.
- Jalankan release command sesuai SOP dan verifikasi commit, tag, branch, remote, changelog, serta clean/expected worktree.
- Jangan deploy Production.
- Development smoke sesuai SOP diperbolehkan.
- Staging hanya jika user atau plan yang telah disetujui secara eksplisit mengizinkan.

## Hard Blockers

Berhenti dan minta keputusan user hanya bila:

- Required change harus merusak atau mengganti owner engine legacy.
- Dirty user-owned file overlap dan tidak dapat dihindari.
- Ditemukan konflik identity/tenant yang membuat data mutation berisiko salah brand.
- Migration memerlukan destructive data operation.
- Permission/credential/external dependency tidak tersedia setelah safe alternatives habis.
- Acceptance criteria memerlukan Product/Staging deployment yang belum diotorisasi.

Sebelum berhenti, catat evidence, alternatives attempted, rollback/stabilization state, dan satu keputusan spesifik yang dibutuhkan.

## Do Not Stop For

- Membuat adapter, route, migration additive, component, atau test yang berada dalam plan.
- Bug yang diperkenalkan oleh implementation sendiri.
- Context limit; tulis resume point dan lanjutkan setelah recovery.
- Test failure yang dapat diperbaiki tanpa scope expansion.
- Optional polish yang aman ditunda.

## Phase Completion Report

Setiap phase report harus mencakup:

- outcome;
- files/schema/API/UI yang benar-benar berubah;
- test/build evidence;
- tenant/idempotency/boundary evidence;
- no-change compliance;
- known limitations;
- release/tag/commit bila applicable;
- exact next phase.

## Final Completion Criteria

Jangan menyatakan Workflow V2 selesai sampai:

- lineage Calendar→Performance dapat dibuktikan untuk representative item;
- dispatch dan ingest idempotent;
- Production scene workspace berfungsi;
- Publishing dan Performance parity dengan ContentFlow lulus;
- existing routes tidak regresi;
- seluruh acceptance criteria dan final gate lulus;
- SOT/execution state/release evidence diperbarui;
- dipastikan tidak ada Production deployment.

## One-Shot Start Directive

Setelah membaca instruksi ini, mulai W2-0. Audit dahulu, perbarui implementation plan dengan current-state dan planned files aktual, lalu implementasikan phase demi phase tanpa meminta prompt “lanjut”, kecuali hard blocker di atas terjadi.
