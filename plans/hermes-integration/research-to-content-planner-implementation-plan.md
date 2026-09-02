# Implementation Plan — Hermes Research → Content Planner Tahap 1–3

## 1. Tujuan

Menghubungkan hasil riset Hermes ke Content Planner tanpa mengubah struktur baku MAKNA. Hermes menghasilkan evidence; MAKNA memvalidasi, membagi, dan mengunci evidence; Gemini mengisi bagian kreatif; setiap planner row menyimpan lineage sumber yang dapat diaudit.

Target akhir:

```text
Hermes Research
→ validated immutable research revision
→ Research-to-Planner Adapter
→ locked distribution + evidence allocation
→ Content Planner Call 1 dan Call 2
→ row-level evidence lineage
→ UI review sumber/risiko
→ manual start-frame review
```

## 2. Prinsip Arsitektur yang Tidak Boleh Dilanggar

1. Content Planner tetap menjadi canonical structure.
2. Hermes tidak menulis langsung ke `content_planners` atau `content_planner_rows`.
3. Research brief dianggap data tidak tepercaya, bukan system instruction.
4. Structure fields dikunci server-side dan tidak boleh ditimpa Gemini:
   - `sequence`;
   - `pillar`;
   - `category_cep`;
   - `vfo`;
   - planner count;
   - Brand/Product identity;
   - preset, platform, review mode, dan publishing policy.
5. Research hanya memengaruhi creative/evidence fields:
   - `content_subject`;
   - `context`;
   - `strategic_angle`;
   - `hook`;
   - `visual_action`;
   - supported educational claims;
   - prohibited claims dan limitations.
6. Tidak ada URL/source/claim baru yang boleh dibuat Gemini.
7. Setiap factual claim yang dipakai harus memiliki source lineage atau berasal dari immutable Product Snapshot.
8. Manual regenerate menggunakan research revision yang sama secara default.
9. Refresh research membuat revision baru dan tidak diam-diam mengubah planner lama.
10. Run `draft_only` tidak boleh membuat publishing intent/job atau Repliz call.
11. Strategic Campaign tetap mengikuti Single-Pass Engine rule yang berlaku; perubahan ini hanya menyentuh tahap Content Planner sebelum campaign ingestion.

## 3. Scope

### In scope

- Product Campaign dan Brand Editorial Content Planner.
- Run-once Hermes dan jalur Operator Worker.
- Persistence research lineage pada planner dan row.
- Deterministic evidence allocation.
- Post-generation validation.
- Regeneration menggunakan frozen research revision.
- Research evidence UI.
- Dev migrations, rollout, smoke, observability, rollback.

### Out of scope

- Publishing approved campaign.
- Auto-approval start frame.
- Posting sosial media.
- Perubahan Staging atau Production.
- Mengganti Content Planner dengan format buatan Hermes.
- Membiarkan Hermes/Gemini menulis database secara langsung.

## 4. Kondisi Kode Saat Ini

Alur yang sudah tersedia:

```text
agent_research_revisions.payload_json
→ dispatchValidatedResearchToOperator()
→ operatorRequest.research_brief
→ processOperatorContentJob()
→ executeContentPlanner(plannerId, researchBrief)
→ buildUntrustedResearchEvidence()
→ Strategic Skeleton Call 1
```

Kekurangan:

- Research hanya menjadi blok teks dalam prompt Call 1.
- Call 2 tidak menerima evidence pack secara eksplisit.
- Planner/row tidak menyimpan Research Revision ID atau source lineage.
- Generated row dapat menimpa distribution fields karena merge generated-over-fallback.
- Manual regenerate kehilangan research context.
- UI execute manual tidak memiliki research revision awareness.
- Validasi research baru memeriksa bentuk, timestamp, HTTPS, dan source references; belum memeriksa reachability, source policy, claim risk, atau kecocokan Product Snapshot.
- Tidak ada adapter deterministik yang membagi insight/angle ke N row.

## 5. Model Data Target

Audit terlebih dahulu storage canonical Content Planner pada runtime Dev. `content-planners` saat ini diakses melalui `getDb()` sedangkan Agent Research memakai PostgreSQL. Jangan membuat dual-write yang tidak konsisten. Pilih satu mekanisme migration canonical dan pastikan compatibility layer serta test schema mengikuti sumber yang sama.

### Kolom baru pada `content_planners`

```sql
research_revision_id TEXT NULL,
research_snapshot_sha256 TEXT NULL,
research_query TEXT NULL,
research_status TEXT NOT NULL DEFAULT 'none',
researched_at TIMESTAMP NULL,
research_source_policy TEXT NULL,
research_schema_version TEXT NULL
```

Allowed `research_status`:

```text
none | pending_validation | validated | partially_verified | rejected | stale
```

### Tabel baru `content_planner_row_evidence`

```sql
CREATE TABLE content_planner_row_evidence (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  planner_id TEXT NOT NULL,
  planner_row_id TEXT NOT NULL,
  research_revision_id TEXT NOT NULL,
  angle_id TEXT NULL,
  insight_ids_json JSON/JSONB NOT NULL DEFAULT '[]',
  source_ids_json JSON/JSONB NOT NULL DEFAULT '[]',
  product_fact_ids_json JSON/JSONB NOT NULL DEFAULT '[]',
  risk_level TEXT NOT NULL DEFAULT 'low',
  evidence_status TEXT NOT NULL DEFAULT 'allocated',
  evidence_snapshot_json JSON/JSONB NOT NULL,
  evidence_sha256 TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, planner_id, planner_row_id)
);
```

Required indexes:

- `(tenant_id, planner_id)`;
- `(tenant_id, research_revision_id)`;
- unique `(tenant_id, planner_id, planner_row_id)`.

Foreign keys harus mengikuti storage canonical yang benar. Bila cross-store foreign key tidak mungkin, simpan immutable IDs + hashes dan tambahkan application-level tenant/lineage validation.

### Source verification metadata

Perluas normalized research source atau simpan verification result terpisah:

```json
{
  "verification_status": "verified|unreachable|rejected|pending",
  "verified_at": "ISO-8601",
  "http_status": 200,
  "content_type": "text/html",
  "authority_class": "primary|reputable_secondary|unknown",
  "final_url": "https://...",
  "content_fingerprint": "sha256"
}
```

Jangan menyimpan full copyrighted page. Simpan metadata, fingerprint, dan kutipan pendek yang tunduk pada batas penggunaan.

## 6. Tahap 1 — Foundation, Locked Structure, dan Lineage

### 6.1 Migration dan repository

Files utama:

- `lib/db-pg.js` dan/atau migration canonical yang ditemukan saat audit;
- `lib/db.js` compatibility layer bila diperlukan;
- file repository baru `lib/content-planner-research-repository.js`.

Repository API yang disarankan:

```js
attachResearchRevisionToPlanner({
  tenantId,
  plannerId,
  researchRevisionId,
  researchSha256,
  researchQuery,
  researchedAt,
  sourcePolicy,
  schemaVersion,
  status
});

replacePlannerRowEvidenceAtomic({
  tenantId,
  plannerId,
  researchRevisionId,
  assignments
});

getPlannerResearchContext({ tenantId, plannerId });
getPlannerRowEvidence({ tenantId, plannerId, rowId });
```

Writes planner rows dan evidence lineage harus atomic. Kegagalan evidence insert harus me-roll back planner row generation, atau planner ditandai `research_status=rejected` tanpa dianggap completed.

### 6.2 Freeze research revision

Pada `dispatchValidatedResearchToOperator()`:

- pilih revision secara deterministik, bukan join semua revision tanpa ordering;
- gunakan latest accepted revision atau revision ID yang ditetapkan Agent Run;
- sertakan `research_revision_id` dan `research_snapshot_sha256` pada Operator Request;
- jangan hanya mengirim raw `research_brief`.

### 6.3 Kunci distribution fields

File:

- `lib/content-planner-contract.js`;
- `lib/content-planner-engine.js`.

#### Code Sebelum (Current/Before)

```js
export function normalizeGeneratedPlannerRows(result, fallbackRows, expectedCount) {
  return Array.from({ length: expectedCount }, (_, index) => ({
    ...(fallbackRows[index] || {}),
    ...(generated[index] || {}),
    sequence: index + 1
  }));
}
```

#### Code Sesudah (Proposed/After)

```js
export function normalizeGeneratedPlannerRows(result, lockedRows, expectedCount) {
  const generated = extractGeneratedRows(result);
  return Array.from({ length: expectedCount }, (_, index) => {
    const locked = lockedRows[index];
    const creative = generated[index] || {};
    return {
      ...creative,
      sequence: index + 1,
      pillar: locked.pillar,
      category_cep: locked.category_cep,
      vfo: locked.vfo,
      product_reference: locked.product_reference,
      product: locked.product
    };
  });
}
```

Tambahkan `validateLockedPlannerStructure()` yang membandingkan output dengan locked distribution dan menolak count mismatch, missing row, duplicate sequence, atau identity drift.

### 6.4 Persist planner research snapshot

#### Code Sebelum (Current/Before)

```js
await executeContentPlanner(plannerId, request.research_brief);
```

#### Code Sesudah (Proposed/After)

```js
await executeContentPlanner(plannerId, {
  revisionId: request.research_revision_id,
  snapshotSha256: request.research_snapshot_sha256,
  brief: request.research_brief
});
```

`executeContentPlanner()` harus memvalidasi revision ownership, tenant, hash, freshness, dan status sebelum AI call.

### 6.5 Call 1 dan Call 2 menerima evidence

Call 1 menerima bounded evidence untuk membangun subject/context/angle. Call 2 menerima:

- locked skeleton;
- per-row evidence assignment;
- prohibited claims;
- limitations;
- allowed Product Snapshot facts.

Call 2 dilarang menciptakan factual claim/source baru.

### 6.6 Regenerate memakai snapshot yang sama

#### Code Sebelum (Current/Before)

```js
export async function regeneratePlannerRow({ plannerId, rowId, scope, targetField }) {
  // hanya planner + row
}
```

#### Code Sesudah (Proposed/After)

```js
export async function regeneratePlannerRow({ plannerId, rowId, scope, targetField }) {
  const researchContext = await getPlannerResearchContext({ tenantId, plannerId });
  const rowEvidence = await getPlannerRowEvidence({ tenantId, plannerId, rowId });
  // regenerate hanya creative fields memakai frozen evidence
}
```

Regenerate tidak boleh mengganti evidence assignment kecuali action eksplisit `refresh-research` atau `reallocate-evidence` membuat revision baru.

### 6.7 Tahap 1 acceptance

- Struktur baku tidak dapat diubah Gemini.
- Planner menyimpan revision ID/hash.
- Setiap row mempunyai evidence lineage.
- Call 1 dan Call 2 menerima evidence teralokasi.
- Regenerate memakai revision sama.
- Legacy planner tanpa research tetap berfungsi.

## 7. Tahap 2 — Research-to-Planner Adapter dan Evidence Enforcement

### 7.1 Adapter baru

File baru:

- `lib/research-to-planner-adapter.js`;
- `lib/research-evidence-policy.js`;
- `lib/research-source-verifier.js` bila verifikasi dilakukan oleh MAKNA.

Input:

```js
{
  planner,
  lockedDistribution,
  researchRevision,
  productSnapshot,
  plannerHistory
}
```

Output:

```js
{
  researchRevisionId,
  researchSha256,
  plannerEvidenceSummary,
  rowAssignments: [
    {
      sequence,
      angleId,
      insightIds,
      sourceIds,
      productFactIds,
      prohibitedClaims,
      limitations,
      riskLevel,
      evidenceSha256
    }
  ]
}
```

### 7.2 Allocation rules

1. Tepat N assignment untuk N locked row.
2. Setiap recommended angle dipakai maksimal sekali sebelum reuse.
3. Source/insight hanya boleh berasal dari frozen revision.
4. Product fact hanya berasal dari immutable Product Snapshot.
5. High-risk claims tidak boleh masuk creative generation otomatis.
6. Health, medical, allergen, certification, legal, dan comparative superiority claims minimal `high` risk kecuali policy lebih ketat.
7. `prohibited_claims` berlaku untuk semua row.
8. `limitations` ikut ke prompt dan post-validator.
9. Allocation deterministic untuk input/hash sama.
10. History digest mencegah pengulangan angle/context lama.

### 7.3 Source verification

Verifikasi dilakukan async sebelum planner generation, bukan inline pada enqueue.

Security requirements:

- HTTPS only;
- DNS resolution dan redirect harus menolak loopback, private, link-local, metadata, Tailscale/internal hosts kecuali allowlist khusus;
- redirect dibatasi;
- timeout dan response size dibatasi;
- content type allowlist;
- jangan mengirim secret/cookie;
- jangan mengeksekusi JavaScript halaman;
- simpan metadata verification, bukan full page;
- failure tidak boleh diam-diam dianggap verified.

Policy:

- `primary_only`: semua evidence yang dipakai harus primary verified;
- `primary_and_reputable`: minimal satu primary/reputable verified per factual row;
- `discovery_only`: hanya ide non-faktual; claim faktual tidak boleh dihasilkan.

### 7.4 Claim validator

Tambahkan post-generation validator:

```js
validatePlannerRowsAgainstEvidence({
  rows,
  lockedDistribution,
  evidenceAssignments,
  productSnapshot,
  prohibitedClaims
});
```

Validator memeriksa:

- locked fields;
- count dan sequence;
- source IDs valid;
- no invented URL/source;
- claim-to-source linkage;
- prohibited terms/claims;
- product identity;
- risk policy;
- evidence assignment hash.

Failure behavior:

- satu bounded retry dengan validation feedback;
- bila tetap gagal, planner kembali `draft`/`research_rejected`, tidak membuat campaign;
- audit event menyimpan code dan IDs, bukan full secret/prompt.

### 7.5 Research refresh/versioning

Tambahkan service:

```js
requestPlannerResearchRefresh({ plannerId, queryOverride, actor });
applyPlannerResearchRevision({ plannerId, revisionId, actor });
```

Aturan:

- refresh membuat Agent Research Task baru;
- planner lama tidak berubah sampai revision baru validated dan pengguna/automation policy memilih apply;
- apply membuat planner revision baru atau regenerate eksplisit;
- audit old/new research hash;
- existing approved rows tidak ditimpa diam-diam.

### 7.6 Tahap 2 acceptance

- Allocation deterministic dan tepat N.
- Source verification SSRF-safe.
- Fictitious/unreachable sources ditolak.
- Unsupported health/product claims ditolak.
- Satu row dapat ditelusuri ke insight/source/product facts.
- Retry bounded dan failure tidak membuat campaign parsial.

## 8. Tahap 3 — UI Research Evidence dan Review

Files utama:

- `app/content-planner/[id]/page.js`;
- `app/content-planner/page.js` bila summary badge diperlukan;
- `app/api/content-planner/[id]/route.js`;
- route baru untuk research/evidence/refresh;
- CSS/component yang relevan.

### 8.1 API projection

Extend GET planner detail secara tenant-scoped:

```json
{
  "planner": {
    "research": {
      "revision_id": "arev_xxx",
      "status": "validated",
      "researched_at": "ISO-8601",
      "query": "...",
      "source_policy": "primary_and_reputable",
      "source_count": 5,
      "verified_source_count": 4,
      "snapshot_sha256": "redacted-or-short-display"
    }
  },
  "rows": [
    {
      "id": "row_xxx",
      "evidence": {
        "angle_id": "angle_1",
        "sources": [{ "id": "src_1", "title": "...", "url": "https://...", "verification_status": "verified" }],
        "risk_level": "low"
      }
    }
  ]
}
```

Jangan expose raw prompt, callback token, credential, internal error stack, atau research payload yang belum tervalidasi.

### 8.2 UI planner-level

Tampilkan:

- badge `Research-backed`, `Partially verified`, `Stale`, atau `Rejected`;
- query dan waktu riset;
- jumlah sumber verified/total;
- source policy;
- tombol `Lihat Evidence`;
- tombol `Refresh Research` dengan konfirmasi dampak;
- indikator revision frozen.

### 8.3 UI row-level

Pada setiap row:

- evidence source chips;
- recommended angle/insight lineage;
- risk badge;
- link sumber aman dengan `noopener noreferrer`;
- peringatan unsupported/stale source;
- regenerate menjelaskan bahwa revision tetap sama.

### 8.4 Refresh UX

State:

```text
idle → research_requested → researching → validation → ready_to_apply
→ applied | failed | stale
```

UI tidak boleh otomatis overwrite row. Tampilkan diff ringkas sebelum apply:

- sumber baru/hilang;
- angle berubah;
- risk berubah;
- row yang perlu regenerate.

### 8.5 Accessibility dan responsive

- keyboard accessible;
- badge tidak hanya dibedakan warna;
- source title terpotong aman dengan full accessible label;
- mobile layout tidak memaksa tabel lebar;
- loading/error/empty states lengkap.

### 8.6 Tahap 3 acceptance

- User dapat melihat sumber setiap row.
- User dapat membedakan verified/stale/rejected.
- Regenerate memakai evidence lama secara default.
- Refresh tidak mengubah row tanpa apply.
- UI tidak membocorkan secret/raw prompt.

## 9. Before/After per File Utama

### `lib/agent-automation-worker.js`

Before:

```js
research_brief: parse(run.research_brief)
```

After:

```js
research_revision_id: revision.id,
research_snapshot_sha256: revision.payload_sha256,
research_brief: validatedBrief
```

### `lib/operator-content-worker.js`

Before:

```js
await executeContentPlanner(plannerId, request.research_brief);
```

After:

```js
await executeContentPlanner(plannerId, {
  revisionId: request.research_revision_id,
  snapshotSha256: request.research_snapshot_sha256,
  brief: request.research_brief
});
```

### `lib/content-planner-engine.js`

Before:

```js
${buildUntrustedResearchEvidence(researchBrief)}
```

After:

```js
const evidencePlan = await allocateResearchEvidence(...);
const rows = lockPlannerStructure(generatedRows, distributionPlan);
validatePlannerRowsAgainstEvidence({ rows, evidencePlan, productSnapshot });
await persistRowsAndEvidenceAtomic(...);
```

### `lib/hermes-research-contract.js`

Before:

```js
// validates shape, source IDs, HTTPS, timestamps
```

After:

```js
// validates shape plus normalized insight/angle IDs,
// source verification metadata, risk classification, and policy result
```

### `app/api/content-planner/[id]/execute/route.js`

Before:

```js
executeContentPlanner(id);
```

After:

```js
executeContentPlanner(id, await resolveFrozenPlannerResearchContext(id, tenantId));
```

Manual planner tanpa research tetap boleh berjalan sesuai explicit mode `research_mode=none`.

### `app/api/content-planner/[id]/route.js`

Before:

```js
return { planner, rows };
```

After:

```js
return { planner: projectPlannerWithResearch(planner), rows: attachEvidenceProjection(rows) };
```

### `app/content-planner/[id]/page.js`

Before:

```text
Planner rows tanpa research provenance.
```

After:

```text
Planner research badge + source drawer + row evidence chips + refresh/apply workflow.
```

Untuk setiap file tambahan yang ditemukan saat audit, tambahkan Before/After snippet ke plan sebelum mengeditnya.

## 10. API dan Error Contract

Suggested endpoints:

```text
GET  /api/content-planner/{id}/research
GET  /api/content-planner/{id}/rows/{rowId}/evidence
POST /api/content-planner/{id}/research/refresh
POST /api/content-planner/{id}/research/{revisionId}/apply
```

Error codes:

```text
RESEARCH_REVISION_NOT_FOUND
RESEARCH_REVISION_TENANT_MISMATCH
RESEARCH_REVISION_HASH_MISMATCH
RESEARCH_STALE
RESEARCH_SOURCE_UNVERIFIED
RESEARCH_SOURCE_REJECTED
RESEARCH_POLICY_UNSATISFIED
RESEARCH_CLAIM_UNSUPPORTED
RESEARCH_HIGH_RISK_CLAIM
PLANNER_STRUCTURE_DRIFT
PLANNER_EVIDENCE_PERSIST_FAILED
RESEARCH_REFRESH_ALREADY_RUNNING
```

Semua routes tenant-scoped, authenticated, no-store untuk mutable status, dan tidak mengembalikan secret.

## 11. Feature Flags dan Rollout Dev

Gunakan fail-closed flags:

```dotenv
ENABLE_RESEARCH_PLANNER_ADAPTER=false
ENABLE_RESEARCH_EVIDENCE_ENFORCEMENT=false
ENABLE_RESEARCH_PLANNER_UI=false
```

Urutan:

1. Deploy migration + code dengan semua flag false.
2. Jalankan migration/schema verification dan legacy regression.
3. Aktifkan adapter di Dev; enforcement/UI masih false.
4. Jalankan fixture adapter dan lineage integration.
5. Aktifkan evidence enforcement di Dev.
6. Jalankan source/claim/security tests.
7. Aktifkan UI di Dev.
8. Jalankan UI/API smoke.
9. Jalankan satu end-to-end Hermes smoke `draft_only` setelah seluruh gate lulus.

Manual Content Planner lama harus tetap berjalan ketika research mode none atau flags off.

## 12. Test Strategy

### Unit

- locked structure cannot be overwritten;
- exact N distribution;
- deterministic allocation/hash;
- insight/source reference integrity;
- risk classification;
- prohibited claim detection;
- frozen revision selection;
- Call 2 receives row evidence;
- regenerate reuses revision;
- source verifier SSRF/redirect/timeout/size protections;
- API projection redaction.

### DB integration

- migration idempotency;
- planner/revision tenant isolation;
- atomic planner row + evidence persistence;
- rollback injected failure;
- refresh revision does not overwrite old planner;
- apply revision audit;
- legacy planner without research;
- cleanup and natural process exit.

### Worker integration

- Hermes callback validated once;
- latest accepted revision selected deterministically;
- duplicate callback idempotent;
- invalid/stale/unverified brief never creates Operator Job;
- valid brief creates one Operator Job;
- retry creates no duplicate planner/campaign.

### UI/E2E

- badge/source drawer/row chips;
- stale/rejected states;
- refresh diff and explicit apply;
- regenerate same revision;
- mobile/accessibility;
- no secret/raw prompt in network payload.

### Regression

- Content Planner manual Product Campaign;
- Brand Editorial;
- run-now;
- recurring automation;
- Operator Content;
- start-frame approval;
- ContentFlow sync;
- publishing scheduler;
- build.

## 13. Real Hermes Smoke — Dev Only

Smoke wajib menggunakan Hermes Runs API nyata. Dilarang membuat `research_brief` atau callback token secara manual dalam smoke script.

Spesifikasi:

- Brand: `dapurbotani`;
- Product: `Pagibaik Rolled Oat Gluten Free`;
- Preset: `dapurbotani_kampanye_produk_4_klip_v2`;
- Count: 6;
- Research: latest/relevant, source policy `primary_and_reputable`;
- Review: manual after start frames;
- Publishing: `draft_only`.

Evidence:

- Run ID, Hermes Run ID, Research Task/Revision ID;
- real callback event correlated to Hermes Run;
- verified source metadata;
- planner ID + research revision/hash;
- exactly six rows with locked structure;
- row evidence lineage and source IDs;
- Call 1/Call 2 audit without raw prompt;
- six start frames awaiting manual review;
- zero publishing/Repliz;
- non-recurring schedule.

Jangan approve start frame dan jangan posting.

## 14. Observability

Structured events:

```text
research_revision_attached
research_source_validation_started/completed/failed
planner_evidence_allocated
planner_structure_locked
planner_evidence_validation_failed
planner_rows_evidence_persisted
planner_research_refresh_requested/completed/failed
planner_research_revision_applied
```

Metrics:

- research-to-planner latency;
- verified source ratio;
- rejected claim count;
- structure drift rejection count;
- evidence allocation failures;
- refresh/apply success rate;
- planner rows by risk level.

Logs hanya IDs/counts/status/hash prefix aman; jangan full prompt, token, atau raw secret.

## 15. Rollback

1. Set UI flag false.
2. Set enforcement flag false.
3. Set adapter flag false.
4. Restart hanya Dev.
5. Legacy planner kembali memakai flow lama.
6. Jangan drop kolom/tabel; pertahankan lineage untuk audit.
7. Jangan menghapus research revision atau planner rows pengguna.
8. Bila smoke gagal, hentikan sebelum campaign ingestion bila memungkinkan dan tandai run failed dengan error code spesifik.

## 16. Release dan Deployment

- Patch release per tahap atau satu minor release bila perubahan schema/UI dianggap fitur signifikan; pilih sesuai SOP repository.
- Jalankan release hanya setelah seluruh test tahap tersebut lulus.
- Push commit/tag sesuai SOP.
- Deploy hanya Mac Mini Dev dengan remote build.
- Jangan deploy/restart/mengubah Staging atau Production.
- Tidak boleh polling SSH cepat; gunakan satu sesi deploy atau interval minimal dua menit.
- Setelah tahap terakhir, worktree harus bersih dan Dev version harus sama dengan tag final.

## Execution Task List

### Audit dan desain final

- [ ] Audit canonical storage Content Planner dan Agent Research pada runtime Dev.
- [ ] Bekukan schema, error contract, feature flags, dan ownership transaksi.
- [ ] Tambahkan Before/After snippet untuk setiap file tambahan sebelum edit.

### Tahap 1

- [ ] Implement migration planner research metadata dan row evidence table.
- [ ] Implement repository tenant-scoped dan atomic persistence.
- [ ] Freeze deterministic Research Revision ID/hash pada Operator Request.
- [ ] Kunci sequence/pillar/CEP/VFO/product identity server-side.
- [ ] Persist research lineage pada planner dan setiap row.
- [ ] Kirim evidence pack ke Call 1 dan Call 2.
- [ ] Ubah regenerate agar memakai frozen revision/evidence yang sama.
- [ ] Luluskan unit, DB integration, worker, dan legacy regression Tahap 1.
- [ ] Deploy Tahap 1 hanya ke Dev dengan flags awal false lalu adapter true.

### Tahap 2

- [ ] Implement deterministic Research-to-Planner Adapter.
- [ ] Implement SSRF-safe source verification dan source policy.
- [ ] Implement claim risk classification serta Product Snapshot allowlist.
- [ ] Implement post-generation evidence/structure validator.
- [ ] Implement bounded retry dan failure atomicity.
- [ ] Implement refresh/apply revision workflow dan audit.
- [ ] Luluskan security, claim, source, concurrency, rollback, dan regression tests.
- [ ] Deploy Tahap 2 hanya ke Dev dan aktifkan enforcement setelah gate lulus.

### Tahap 3

- [ ] Extend tenant-scoped planner detail/evidence APIs.
- [ ] Implement planner research badge dan evidence summary.
- [ ] Implement row evidence chips/source drawer/risk state.
- [ ] Implement refresh status, diff, dan explicit apply UX.
- [ ] Implement accessible responsive loading/error/empty states.
- [ ] Luluskan UI/E2E/redaction/regression tests.
- [ ] Deploy Tahap 3 hanya ke Dev dan aktifkan UI flag.

### Final verification

- [ ] Jalankan seluruh test gate dan build dengan exit 0 serta unexpected skip 0.
- [ ] Jalankan satu real Hermes smoke tanpa fabricated callback/research.
- [ ] Buktikan exact 6 locked planner rows dengan evidence lineage.
- [ ] Buktikan six start frames berhenti di manual review.
- [ ] Buktikan zero publishing intent/job/Repliz dan non-recurring schedule.
- [ ] Verifikasi rollback flags dan legacy planner.
- [ ] Buat release/tag final, deploy hanya Dev, dan verifikasi worktree bersih.
- [ ] Tulis final evidence report tanpa secret.
- [ ] Konfirmasi Staging dan Production tidak disentuh.

## 17. Definition of Done

Semua wajib benar:

- Research Hermes tervalidasi dan immutable.
- Struktur Content Planner tidak dapat diubah Gemini.
- Planner dan row memiliki research/source lineage.
- Call 1 dan Call 2 memakai evidence teralokasi.
- Unsupported/high-risk claims ditolak sesuai policy.
- Source verifier aman dari SSRF dan fabricated/unreachable source.
- Regenerate memakai revision sama; refresh membuat revision baru.
- UI menampilkan evidence/risk tanpa secret.
- Legacy planner tetap berfungsi.
- Semua test/build lulus.
- Real Hermes smoke menghasilkan enam row/start frame manual review tanpa fabricated callback.
- Zero publishing dan non-recurring terbukti.
- Dev memakai release final, worktree bersih.
- Staging/Production tidak disentuh.

