# Master AI Agent Instructions — Affiliate Studio Fase 3–12

## Primary Mandate

Anda adalah execution agent untuk menyelesaikan Affiliate Studio dari Fase 3 sampai Fase 12 dalam satu rangkaian autonomous, checkpointed, dan additive-only.

Anda tidak menunggu pengguna membuat implementation plan atau prompt baru untuk setiap fase. Anda sendiri membuat plan fase aktif secara just-in-time, mengeksekusinya, memverifikasi, merilis, memperbarui state, kemudian lanjut ke fase berikutnya.

## Required Reading Order

Pada awal sesi dan setiap context recovery, baca lengkap:

1. `AGENTS.md`
2. `sot/menus/affiliate-studio/master-execution-orchestrator.md`
3. `sot/menus/affiliate-studio/affiliate-studio-execution-state.md`
4. `sot/menus/affiliate-studio-roadmap.md`
5. implementation plan fase aktif, bila sudah ada
6. implementation plan dan handoff fase terakhir selesai
7. panduan Next.js lokal yang relevan sebelum menulis code Next.js

## Continuous Execution Rule

Gunakan loop berikut:

```text
while next_phase <= 12:
    reconcile repository and previous release
    create or resume active phase plan
    implement active phase
    verify active + previous + relevant legacy behavior
    release/tag/push active phase
    record handoff and update execution state
    next_phase += 1
```

Jangan meminta pengguna mengatakan “lanjut” antara fase jika release gate lulus.

## Just-in-Time Plan Requirements

Setiap plan fase wajib berisi:

- Status dan prerequisite release.
- Objective.
- In scope dan out of scope.
- Actual current-state baseline.
- Domain/schema/API/UI contract.
- Security, tenant, permission, idempotency, dan audit rules.
- Legacy ownership dan connector strategy.
- `## Execution Task List` dengan checkbox kronologis.
- Planned File Changes.
- Code Sebelum dan Code Sesudah untuk setiap modified/new file.
- Explicit No-Change List.
- Test matrix.
- Verification commands aktual.
- Acceptance criteria.
- Rollback strategy.
- Release command.
- Handoff contract ke fase berikutnya.

Jangan memakai placeholder plan yang tidak cukup untuk eksekusi. Jangan membuat plan fase N+1 sebelum fase N memiliki release contract aktual, kecuali hanya menulis catatan handoff pada state.

## Progress Control

- Update checkbox plan segera setelah task selesai dan terverifikasi.
- Update execution state setelah planning selesai, schema/API milestone, UI milestone, test milestone, release, dan phase handoff.
- Jangan menandai task/phase selesai berdasarkan asumsi.
- Jika menambah file di luar plan, tulis Before/After terlebih dahulu.
- Jika context akan berakhir, simpan current task dan exact resume point pada state.

## Additive-Only Enforcement

- Prefer file baru di namespace Affiliate Studio.
- Existing modules diakses melalui adapter/connector/projection/reference/snapshot.
- Jangan memindahkan atau menduplikasi engine logic.
- Jangan mengubah engine prompt/state machine/schema hanya agar UI baru lebih mudah.
- Jangan refactor opportunistic.
- Jangan memperbaiki unrelated legacy issue dalam release fase aktif.
- Bila connector additive tidak memungkinkan, lakukan audit alternatif sebelum menyatakan hard blocker.

## Working Tree Safety

Pada awal setiap fase:

1. Jalankan `git status --short`.
2. Identifikasi file yang sudah dirty sebelum fase aktif.
3. Catat file tersebut pada execution state.
4. Jangan overwrite/stage/commit file user-owned.
5. Jika overlap tak dapat dihindari, hard blocker.

Jangan menggunakan destructive Git commands. Jangan mengubah branch, merge, rebase, atau cherry-pick tanpa authority eksplisit atau SOP release yang jelas.

## Testing Discipline

Setiap fase wajib menjalankan:

1. Focused tests fase aktif.
2. Seluruh Affiliate Studio regressions fase selesai.
3. Relevant legacy regression tests untuk module yang disambungkan.
4. Tenant/assigned-brand/permission isolation tests.
5. Boundary/no-write/no-forbidden-import tests.
6. `git diff --check`.
7. `npm run build`.
8. Dev smoke bila plan menentukannya.

Jangan melemahkan atau menghapus test existing agar fase lulus. Perbaiki code fase aktif atau laporkan hard blocker.

## Release Discipline

- Satu fase = satu release checkpoint.
- Gunakan `npm run release-non-interactive` dengan title/points dari JIT plan.
- Setelah release, verifikasi version, changelog, commit, tag, current branch, dan remote push.
- Jangan memasukkan unrelated dirty files.
- Jangan lanjut ke fase berikutnya sebelum release checkpoint terverifikasi.
- Jangan deploy Production.

## Deployment Rules

- Dev deployment diperbolehkan bila diperlukan plan: `npm run deploy:macmini-dev`.
- Staging deployment hanya bila scope dan user instruction mengizinkan; master flow default tidak memerlukannya.
- Production deployment dilarang tanpa instruksi manual eksplisit user.
- Jangan polling SSH loop. Ikuti SOP timer dua menit untuk remote build.

## Stop Rules

Berhenti hanya untuk hard blocker yang tercantum dalam master orchestrator.

Jangan berhenti untuk:

- meminta implementation plan berikutnya;
- meminta izin lanjut fase berikutnya;
- melaporkan progress biasa;
- membuat adapter/API/component/test dalam scope;
- memperbaiki bug yang Anda perkenalkan sendiri;
- context limit—gunakan state recovery;
- optional item yang aman ditunda.

Ketika hard blocker terjadi:

1. Jangan mulai fase berikutnya.
2. Stabilkan atau rollback perubahan fase aktif.
3. Update state menjadi `blocked`.
4. Catat evidence, alternatives attempted, dan exact decision needed.
5. Berikan satu pertanyaan konkret kepada user.

## Phase Transition Protocol

Setelah Fase N release sukses:

1. Update plan status menjadi Complete.
2. Pastikan semua required checkbox tercentang.
3. Record release/tag/commit.
4. Record actual schema/API/UI/handoff contracts.
5. Record known limitations dan intentionally deferred items.
6. Set state `last_completed_phase=N`.
7. Set `next_phase=N+1`.
8. Set status `planning`.
9. Mulai reconciliation Fase N+1 tanpa prompt user.

## Context Recovery

Jika agent/task terputus, instruksi resume adalah:

```text
Lanjutkan Affiliate Studio berdasarkan master-ai-agent-instructions.md dan affiliate-studio-execution-state.md.
```

Pada resume, jangan mempercayai state secara buta. Cocokkan dengan `git status`, log, tag, changelog, plan checkbox, dan test evidence.

## Final Completion Report

Setelah Fase 12 selesai, laporan akhir harus mencakup:

- release chain Fase 3–12;
- final domain hierarchy;
- schema/tables baru;
- API and connector contracts;
- Content Planner lineage;
- production/publishing/performance learning loop;
- full test/build/Dev smoke evidence;
- tenant/security audit summary;
- Explicit No-Change compliance;
- known limitations/deferred work;
- confirmation no Production deployment occurred;
- execution state marked complete.

## One-Shot Directive

Setelah membaca dokumen ini, langsung jalankan dari `next_phase` pada execution state. Jangan meminta pengguna mengulang mandat.

