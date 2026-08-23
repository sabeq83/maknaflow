# Affiliate Studio — Master Execution Orchestrator Fase 3–12

> Status: Ready for one-shot execution  
> Baseline release: `v2.25.0 — Affiliate Studio Product Portfolio`  
> Current starting point: Fase 0, 1, dan 2 selesai serta dirilis  
> Execution model: **Just-in-time plan → implement → verify → release → handoff → next phase**  
> User interaction model: satu instruksi awal; berhenti hanya pada hard blocker.

## 1. Purpose

Dokumen ini menggantikan kebutuhan pengguna untuk meminta secara manual:

```text
Buat plan fase N
→ kirim prompt ke agent
→ implementasikan fase N
→ ulangi untuk fase N+1
```

Agent menjalankan Fase 3–12 sebagai satu rangkaian pekerjaan, tetapi tetap menjaga isolation dan release checkpoint per fase.

```text
Fase N
├── Reconcile code aktual
├── Buat implementation plan JIT
├── Implement additive-only
├── Update checklist real-time
├── Verify + regression
├── Release + tag + push
├── Tulis handoff contract
└── Lanjut Fase N+1
```

## 2. Source of Truth Priority

Jika terjadi perbedaan informasi, gunakan urutan authority berikut:

1. Instruksi system/developer/runtime aktif.
2. `AGENTS.md` repository.
3. Implementasi dan schema aktual pada branch aktif.
4. Test aktual yang lulus pada baseline release terakhir.
5. `sot/menus/affiliate-studio/affiliate-studio-execution-state.md`.
6. Master orchestrator ini.
7. `sot/menus/affiliate-studio-roadmap.md`.
8. Implementation plan fase sebelumnya.
9. Design assumptions lama.

Roadmap menentukan intent; code aktual menentukan connection point. Agent tidak boleh memaksa code agar sesuai dengan asumsi lama bila connector additive dapat digunakan.

## 3. Files Managed by the Orchestrator

### 3.1 Permanent control files

```text
sot/menus/affiliate-studio/master-execution-orchestrator.md
sot/menus/affiliate-studio/master-ai-agent-instructions.md
sot/menus/affiliate-studio/affiliate-studio-execution-state.md
```

### 3.2 Just-in-time generated files

Pada awal setiap fase, agent membuat:

```text
phase-03-campaign-program-implementation-plan.md
phase-04-content-planner-connection-implementation-plan.md
phase-05-production-visibility-implementation-plan.md
phase-06-engine-launch-connectors-implementation-plan.md
phase-07-smart-route-implementation-plan.md
phase-08-creative-intelligence-implementation-plan.md
phase-09-publishing-connection-implementation-plan.md
phase-10-performance-foundation-implementation-plan.md
phase-11-learning-loop-implementation-plan.md
phase-12-assisted-program-builder-implementation-plan.md
```

Agent tidak membuat seluruh plan final di depan. Hanya plan fase aktif yang boleh dipromosikan menjadi executable.

## 4. Phase Manifest

| Fase | Nama | Dependency langsung | Output contract utama |
|---:|---|---|---|
| 3 | Campaign Program Domain | Fase 2 | Program, program products, lifecycle, audit, product snapshot |
| 4 | Content Planner Connection | Fase 3 | Planner/program sidecar, row metadata, Brand Calendar, Program Plan |
| 5 | Unified Production Visibility | Fase 4 | Content run lineage, status projection, reconciliation, queue |
| 6 | Engine Launch Connectors | Fase 5 | Preflight, idempotent launch, source reference, deep link |
| 7 | Smart Route Recommendation | Fase 6 | Deterministic routing, optional AI recommendation, user confirmation |
| 8 | Creative Intelligence Connection | Fase 7 | Deconstruct binding, hypothesis, blueprint lifecycle, Multiplier lineage |
| 9 | Publishing Connection | Fase 8 | ContentFlow/publishing projection, preflight, publishing snapshot |
| 10 | Performance Foundation | Fase 9 | Metric contract, snapshots, attribution confidence, import connectors |
| 11 | Insight and Learning Loop | Fase 10 | Evidence-backed insights, accept/reject/archive, draft actions |
| 12 | Assisted Campaign Program Builder | Fase 11 | AI content-mix proposal, Planner draft handoff, approval separation |

## 5. Global Architectural Invariants

Aturan berikut berlaku untuk seluruh Fase 3–12:

1. Affiliate Studio adalah **control plane**.
2. Existing modules tetap menjadi **execution plane** dan source of truth.
3. Setiap fase menyambung melalui adapter, connector, projection, sidecar, snapshot, atau reference.
4. Jangan memindahkan code legacy ke namespace Affiliate Studio.
5. Jangan mengubah route legacy agar Affiliate Studio dapat bekerja bila deep link/adapter baru cukup.
6. Jangan menyeragamkan status dengan mengubah tabel engine; gunakan normalized projection.
7. Jangan menulis tenant ID dari payload client; gunakan authenticated server context.
8. Semua record baru tenant-scoped dan memiliki audit fields.
9. Semua launch/import/reconciliation harus idempotent.
10. Immutable snapshot digunakan untuk data yang harus reproducible.
11. Feature flag `affiliate_studio_enabled` tetap menjadi emergency kill switch.
12. Product Database, Content Planner, engine, ContentFlow, dan publishing tetap dapat digunakan tanpa Affiliate Studio.
13. Tidak ada deployment Production tanpa instruksi manual eksplisit pengguna.

## 6. Per-Phase Just-in-Time Planning Protocol

Sebelum coding Fase N, agent wajib:

1. Baca state file dan pastikan `next_phase=N`.
2. Verifikasi release/tag fase sebelumnya.
3. Jalankan focused regression fase sebelumnya.
4. Audit working tree dan catat file user-owned.
5. Baca panduan Next.js lokal yang relevan sebelum menulis code Next.js.
6. Audit actual files, APIs, tables, contracts, tests, dan navigation yang akan disambungkan.
7. Buat implementation plan fase aktif.
8. Sertakan `## Execution Task List` dengan checkbox kronologis.
9. Sertakan Code Sebelum/Code Sesudah untuk setiap file yang akan dimodifikasi.
10. Untuk file baru, Code Sebelum menyatakan file belum ada.
11. Sertakan Explicit No-Change List.
12. Sertakan schema/API/UI/test/rollback/release contract.
13. Sertakan dependency dan handoff untuk fase berikutnya.
14. Update state menjadi `planning`, lalu `implementing` setelah plan lengkap.

Agent tidak perlu meminta persetujuan user atas plan apabila plan tetap di dalam roadmap, additive-only boundary, dan tidak memenuhi hard-blocker criteria.

## 7. Per-Phase Implementation Protocol

1. Implementasikan hanya fase aktif.
2. Perbarui checkbox plan segera setelah task selesai dan terverifikasi.
3. Perbarui `affiliate-studio-execution-state.md` setelah milestone material.
4. Bila memerlukan file yang belum ada di plan, tambahkan Before/After terlebih dahulu.
5. Bila file berada di Explicit No-Change List, jangan edit; evaluasi connector alternatif.
6. Jangan melakukan cleanup/refactor opportunistic.
7. Pertahankan backward compatibility semua fase sebelumnya.
8. Tambahkan focused tests dan boundary tests fase aktif.
9. Jalankan regression seluruh Affiliate Studio yang sudah selesai.
10. Jalankan regression modul legacy yang disentuh melalui connector.
11. Jalankan `git diff --check` dan production build.
12. Dev smoke dilakukan bila UI/API/runtime integration membutuhkan bukti.

## 8. Per-Phase Release Gate

Fase hanya boleh berstatus complete apabila:

- seluruh required task checkbox selesai;
- focused tests lulus;
- previous-phase regressions lulus;
- relevant legacy regressions lulus;
- tenant/permission/boundary tests lulus;
- `git diff --check` lulus;
- production build lulus;
- Dev smoke lulus bila diwajibkan plan;
- Explicit No-Change audit bersih;
- unrelated dirty files tidak ikut stage/commit;
- release command sukses;
- changelog, version, release commit, tag, branch, dan remote push terverifikasi.

Setelah release:

1. Catat release/tag/commit pada execution state.
2. Catat actual handoff contract.
3. Tandai fase selesai.
4. Set `next_phase=N+1`.
5. Lanjut otomatis tanpa meminta prompt baru.

## 9. Hard Blockers — Agent Must Stop

Agent hanya berhenti dan meminta keputusan user apabila:

1. Penyelesaian membutuhkan deployment Production.
2. Diperlukan destructive migration, drop, mass delete, atau irreversible rewrite.
3. Diperlukan breaking change pada contract fase yang sudah dirilis.
4. Semua alternatif connector additive telah habis dan engine legacy harus direvisi secara material.
5. Dirty file user overlap dengan file wajib fase aktif dan ownership tidak dapat dipisahkan.
6. Regression existing gagal sebelum perubahan fase aktif dan menghalangi verifikasi.
7. Diperlukan keputusan produk yang mengubah hierarchy/roadmap secara material.
8. Diperlukan credential, external approval, atau authority yang tidak tersedia.
9. Release/tag/push tetap gagal setelah diagnosis dan retry aman.
10. Schema aktual bertentangan dengan prerequisite sehingga ada risiko korupsi/cross-tenant leak.

Laporan blocker harus memuat:

```text
Current phase
Exact blocker
Evidence/command output summary
Safe alternatives attempted
Files changed so far
Rollback status
Decision required from user
```

## 10. Non-Blockers — Agent Must Continue

Agent tidak boleh berhenti hanya karena:

- implementation plan fase berikutnya belum ada;
- perlu membuat adapter/component/API/test baru yang sesuai roadmap;
- perlu memperbarui checklist atau state file;
- build atau test membutuhkan waktu;
- Dev deployment membutuhkan remote build;
- perlu membuat migration additive/idempotent yang sudah berada dalam scope fase;
- perlu memperbaiki bug yang diperkenalkan oleh perubahan fase aktif;
- context window hampir habis;
- satu source projection dapat dibuat partial secara truthful;
- optional enhancement harus ditunda.

Jika context hampir habis, lakukan Context Recovery Protocol lalu lanjut.

## 11. Context Recovery Protocol

Sebelum turn/context berakhir:

1. Simpan state aktual pada `affiliate-studio-execution-state.md`.
2. Catat current task, last verified task, commands run, pending files, dan blocker jika ada.
3. Pastikan implementation plan checkbox mencerminkan kondisi aktual.
4. Jangan menandai fase complete bila release gate belum lulus.

Saat dimulai kembali:

1. Baca `AGENTS.md`.
2. Baca master orchestrator dan master AI instructions.
3. Baca execution state.
4. Baca plan fase aktif.
5. Audit git status/log/tag.
6. Verifikasi last recorded evidence yang mudah berubah.
7. Lanjut dari `current_task`; jangan restart fase yang sudah selesai.

Prompt recovery tunggal untuk pengguna:

```text
Lanjutkan eksekusi Affiliate Studio berdasarkan master-ai-agent-instructions.md dan affiliate-studio-execution-state.md.
```

## 12. Phase-Specific Guardrails

### Fase 3 — Campaign Program Domain

- Tabel baru additive dengan prefix `affiliate_`.
- Tidak memicu engine atau membuat Planner.
- Program product mereferensikan existing product/brand association dan menyimpan snapshot bounded.
- Archive tidak menghapus produk/planner/campaign/content asset.

### Fase 4 — Content Planner Connection

- Gunakan sidecar; jangan ALTER planner tables jika sidecar cukup.
- Planner tetap source of truth.
- Link/unlink tidak menghapus Planner.
- Edit penuh tetap melalui Content Planner.

### Fase 5 — Unified Production Visibility

- Read connectors dan normalized status projection only.
- Jangan mengubah state machine engine.
- Reconciliation idempotent dan tidak memicu production.
- Repair/retry tetap di modul asal.

### Fase 6 — Engine Launch Connectors

- Gunakan service/endpoint contract resmi engine.
- Idempotency key wajib.
- Preflight sebelum launch.
- Engine menyimpan campaign/item pada tabelnya sendiri.

### Fase 7 — Smart Route

- Deterministic rules adalah baseline.
- AI recommendation optional dan explainable.
- User confirmation sebelum launch.
- Jangan membuat universal prompt pengganti prompt engine.

### Fase 8 — Creative Intelligence

- Deconstruct asset tetap dimiliki Deconstruct Lab.
- Binding dan lifecycle disimpan sebagai sidecar.
- Multiplier dijalankan melalui Fase 6 connector.
- Lineage source blueprint wajib.

### Fase 9 — Publishing Connection

- ContentFlow/publishing tetap source of truth.
- Published status harus mempunyai bukti source.
- Retry/repair tetap pada publishing module.
- Snapshot publishing immutable.

### Fase 10 — Performance Foundation

- Metric memiliki source, captured_at, unit, dan attribution confidence.
- Tidak mengklaim conversion tanpa verified source.
- Import idempotent.
- Existing reports tidak diganti.

### Fase 11 — Learning Loop

- Insight selalu memiliki evidence references dan confidence.
- User dapat accept/reject/archive.
- Accepted action menghasilkan draft baru, bukan rewrite histori.
- Tidak auto-edit Brand Profile atau engine preset.

### Fase 12 — Assisted Program Builder

- AI menghasilkan proposal, bukan langsung menjalankan production.
- Planner draft dibuat melalui contract resmi Planner.
- Approval plan dan approval production terpisah.
- Anti-duplication menggunakan history projection.

## 13. Release Version Guidance

- Gunakan `minor` untuk fase yang menambah application domain/view/capability besar.
- Gunakan `patch` hanya untuk foundation/repair kecil yang tidak memperluas capability user secara besar.
- Release title dan points ditentukan dalam JIT plan berdasarkan hasil aktual.
- Jangan membuat satu release gabungan Fase 3–12.
- Setiap fase harus mempunyai release/tag sendiri agar rollback dan audit jelas.

## 14. Completion Definition

Master execution selesai apabila:

- Fase 3–12 semua berstatus complete;
- setiap fase memiliki implementation plan aktual dan checklist final;
- setiap fase memiliki release/tag/commit terverifikasi;
- execution state berstatus `complete`;
- seluruh Affiliate Studio regression suite lulus;
- relevant legacy regression suite lulus;
- final production build lulus;
- tidak ada Production deployment tanpa instruksi user;
- final report merangkum release chain, contracts, tests, deferred items, dan known limitations.

## 15. One-Shot Start Command

Pengguna cukup mengirim ini satu kali kepada AI agent:

```text
Jalankan Affiliate Studio Fase 3–12 secara berurutan berdasarkan:
- AGENTS.md
- sot/menus/affiliate-studio/master-execution-orchestrator.md
- sot/menus/affiliate-studio/master-ai-agent-instructions.md
- sot/menus/affiliate-studio/affiliate-studio-execution-state.md

Buat implementation plan setiap fase secara just-in-time, implementasikan, verifikasi, release/tag/push, perbarui execution state, lalu lanjut otomatis ke fase berikutnya. Jangan berhenti untuk meminta plan/prompt berikutnya. Berhenti hanya pada hard blocker yang didefinisikan master orchestrator. Dilarang deployment Production tanpa instruksi manual eksplisit saya.
```

