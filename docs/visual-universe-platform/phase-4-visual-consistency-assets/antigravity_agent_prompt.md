# Prompt Eksekusi Agent Antigravity — Fase 4 Visual Consistency Assets

Salin seluruh bagian di bawah `## PROMPT` ke Agent Antigravity dan jalankan dari root repository MAKNA Flow.

---

## PROMPT

Anda bertugas mengimplementasikan **Fase 4 — Visual Consistency Assets** pada MAKNA Flow.

### Sumber kebenaran

Baca penuh:

```text
docs/visual-universe-platform/master_roadmap.md
docs/visual-universe-platform/phase-2-visual-identity-foundation/implementation_plan.md
docs/visual-universe-platform/phase-3-ai-visual-identity-builder/implementation_plan.md
docs/visual-universe-platform/phase-4-visual-consistency-assets/implementation_plan.md
```

Plan Fase 4 adalah specification, architecture decision record, migration strategy, test matrix, dan execution checklist. Jangan bekerja hanya dari prompt ini atau snippet. Bila kode/schema/provider aktual berbeda, pertahankan invariant/outcome, update plan terlebih dahulu, lalu implementasikan solusi paling kompatibel.

### Outcome wajib

Bangun workflow:

```text
Universe / Character / Location / User Visual Identity
→ upload atau generate reference
→ managed ingestion
→ draft version
→ user review + faceless attestation
→ approve
→ manifest/resolver uses exact version
→ campaign snapshots asset ID/version/path/checksum
→ retry/regenerate remains reproducible
```

### Reuse, jangan duplikasi

Audit dan reuse:

```text
app/settings/universes/page.js
app/api/webhook/generate/route.js
app/api/webhook/status/route.js
app/api/v2/universe-profiles/[id]/characters/[charId]/route.js
lib/universe-manifests.js
lib/cartoon-reference-resolver.js
lib/visual-override-resolver.js
lib/visual-identity-contract.js
lib/visual-identity-repository.js
```

Character AI Image Generation dan G-Labs integration sudah ada. Jangan membuat provider pipeline paralel. Pindahkan orchestration ke reference asset service dan pertahankan compatibility.

### Invariant keras

1. Generated/uploaded asset tidak pernah auto-approved.
2. Satu approved active asset per tenant + owner + role.
3. Approved asset immutable; visual baru berarti version baru.
4. Campaign menyimpan exact asset snapshot.
5. Retry/regenerate memakai snapshot, bukan latest asset.
6. Semua access tenant-scoped; body tenant ID tidak dipercaya.
7. Tidak ada arbitrary filesystem path atau arbitrary URL fetch.
8. Remote provider URL harus di-ingest ke managed storage sebelum approval.
9. Human/blank-face assets tetap faceless dan membutuhkan review attestation.
10. Tidak ada hard delete approved/referenced history.
11. Legacy `reference_image_path` dan `style_reference_path` tetap berfungsi.
12. Approval dual-write compatibility path secara atomik.
13. Required preflight gagal sebelum paid provider dispatch.
14. Tidak ada face recognition/biometric system atau pixel similarity claim pada fase ini.

### Prosedur wajib

1. Baca `AGENTS.md`.
2. Baca Next.js local docs relevan di `node_modules/next/dist/docs/`, khususnya Route Handlers, uploads/forms, Server/Client Components, mutation, security.
3. Jalankan `git status --short`; jangan menimpa unrelated/user changes.
4. Baca seluruh plans/SOT dan target files aktual.
5. Audit provider/webhook contract, storage, manifest, campaign snapshot, dan all reference call sites.
6. Update implementation plan bila nama tabel/file/flow aktual berbeda.
7. Jalankan baseline tests.
8. Kerjakan sesuai `## Execution Task List`.
9. Setelah setiap task selesai dan terverifikasi, ubah `[ ]` menjadi `[x]`.
10. Jangan menandai task berdasarkan kode saja tanpa tests/evidence.

### Delivery gates

#### Gate 4A — Registry dan compatibility

- contract/schema/indexes;
- repository/version/lifecycle;
- secure storage;
- upload;
- legacy import;
- transactional approval/dual-write;
- tests.

#### Gate 4B — Generation dan UI

- role-aware prompts;
- existing provider dispatch/status reuse;
- managed completion ingestion;
- shared ReferenceAssetManager;
- Universe Manager;
- Visual Identity Studio;
- tests.

#### Gate 4C — Snapshot dan preflight

- manifest/resolver registry integration;
- exact campaign asset snapshot;
- retry/regenerate reproducibility;
- advisory/required preflight;
- legacy regression;
- Dev end-to-end smoke tests.

Fase 4 belum selesai bila hanya asset table/gallery dibuat.

### Data model

Buat tenant-scoped `visual_reference_assets` sesuai plan dengan:

```text
owner_type
owner_id
universe_id
asset_role
version
status
source_type
storage_path/public_path
mime/size/checksum/dimensions
generation/provider lineage
metadata/review/failure
actor/timestamps
```

Owner:

```text
universe
character
location
visual_identity
```

Roles:

```text
identity
wardrobe
location
visual_style
palette_sheet
character_sheet
```

Statuses:

```text
generating
draft
approved
rejected
archived
failed
```

Use unique partial index to enforce one approved asset per tenant/owner/role. Verify polymorphic owner tenant in repository.

### Storage security

Implement managed storage:

```text
public/uploads/reference-assets/{tenant}/{ownerType}/{ownerId}/{role}/v{version}/{checksum-prefix}.{ext}
```

Server determines path. Require:

- PNG/JPEG/WEBP allowlist;
- magic-byte validation;
- 10 MB default limit;
- `sharp` metadata;
- SHA-256;
- sanitized segments;
- atomic temp-write/rename;
- no SVG/HTML/executable;
- provider download timeout/size limit;
- provider host/result allowlist or safe provider adapter;
- cleanup partial file on failure.

Never approve a remote URL directly.

### Lifecycle

Upload/generation completion creates draft. Approval transaction:

1. tenant/owner/role validation;
2. managed file/checksum/preflight;
3. faceless attestation where required;
4. demote old approved;
5. approve selected version;
6. dual-write legacy path if mapped;
7. commit;
8. cache refresh best-effort.

If transaction fails, old approved stays active.

### Generation

Use `visual_reference_asset_v1` role-aware prompt builder. Build from canonical character/location/universe/Visual Identity data.

For humans:

- hands-only sheet never requests face/front portrait;
- back/cropped/silhouette/blank-face rules match owner policy;
- negative prompt includes visible face, eyes, nose, mouth, reflection face, identity/wardrobe drift;
- user custom instruction cannot weaken rules.

Use existing G-Labs dispatch/status provider. Status completion must be idempotent and ingest output once. Never auto-approve.

### UI

Build shared `ReferenceAssetManager`:

- approved active card;
- version gallery/history;
- upload/generate;
- prompt preview;
- progress/status;
- draft candidate;
- side-by-side compare current/candidate;
- approval attestation;
- reject/archive;
- errors/legacy/missing states.

Integrate:

- Universe Manager character: identity, wardrobe, character sheet;
- location: location;
- universe: visual style, palette sheet;
- user Visual Identity: wardrobe, visual style, palette sheet, optional character sheet.

System Visual Identity must be cloned before attaching assets. Unsaved character/location/preset must be saved first.

### Manifest/resolver/snapshot

Registry-approved asset takes precedence over legacy path. Exact campaign snapshot takes precedence over latest approved.

Do not fabricate fallback paths. Missing file is warning/error.

Manifest keeps legacy fields plus structured asset metadata. Visual Identity snapshot includes `reference_assets`. Campaign universe snapshot freezes exact asset ID/version/public path/checksum.

Reference priority:

```text
exact campaign snapshot
→ exact requested version
→ current approved registry
→ legacy path
→ missing warning/error
```

### Preflight

Implement deterministic advisory/required preflight checking:

- owner/tenant;
- approved status;
- file/checksum/MIME/dimensions;
- required roles;
- faceless prompt/attestation;
- reference count provider limit;
- clip character mapping;
- exact snapshot availability.

Legacy campaign uses advisory. New explicit consistency lock uses required and blocks before paid dispatch.

Do not claim pixel-level similarity or face detection.

### Legacy migration

Create dry-run-by-default migration script for existing character/location/style paths. Require explicit tenant and `--apply`. Create idempotent `legacy_import` rows. Do not move/delete files or broad-mutate every tenant by default.

### Test minimum

Without live Gemini/G-Labs:

- owner/role/status contract;
- MIME magic bytes/path traversal/size/checksum/dimensions;
- tenant isolation;
- version monotonicity;
- concurrent approval/partial unique invariant;
- approval rollback keeps old version;
- dual-write compatibility;
- legacy import idempotency;
- role-aware faceless prompts;
- fake provider dispatch/status/complete/fail/idempotency;
- never auto-approve;
- manifest registry-first + legacy fallback;
- no fictional fallback path;
- campaign snapshot immutability;
- retry/regenerate exact version;
- advisory/required preflight;
- UI upload/generate/review/attestation/archive;
- regression.

Run:

```bash
npm run test:visual-reference-assets
npm run test:visual-identity
npm run test:ai-visual-identity
npm run test:ai-universe-builder
npm run test:content-planner
node scripts/test-universe-field-mapping.js
node scripts/test-opc-integrity.mjs
npm run build
```

Provider tests use fake adapter/fixtures. Do not spend external credits in automated tests.

### Security/logging

- no tenant authority from body;
- no arbitrary path/URL;
- no SVG active content;
- no base64/signed URL/API key/full prompt in logs;
- log safe asset ID, role, version, provider, duration, outcome, error code;
- audit created/approved actor/time;
- no hard delete.

### Dev deployment

After tests/build pass, deploy only:

```text
Host            : masbenu@100.95.245.55
Folder          : ~/maknaflow-dev
UI/API          : 5020 / 7020
Schema          : dev
PGPOOL_MAX      : 3
PM2 environment : dev
Command         : npm run deploy:macmini-dev
```

Do not deploy Staging/Production. Follow zero-spam remote build; no 10–15 second SSH polling.

Smoke test:

1. import legacy character reference;
2. upload/approve identity v2;
3. verify dual-write and manifest;
4. generate/ingest/review/approve character sheet;
5. location reference;
6. user Visual Identity style/palette asset;
7. create campaign and inspect snapshot;
8. approve vNext, retry old campaign, verify old version;
9. required preflight blocks missing reference before provider call;
10. human approval requires attestation;
11. legacy campaign still works.

### Release

After Gate 4A–4C and Dev smoke tests complete:

```bash
npm run release-non-interactive -- --type minor --title "Visual Consistency Assets" --points "Tambah reference asset registry dan version approval|Tambah character location style reference workflow|Tambah campaign asset snapshot dan production preflight"
```

If repository convention selects patch, document decision before release. Verify version, changelog, commit, tag, branch, and push per `AGENTS.md`.

### Kondisi selesai

Do not stop after schema, API, or UI. Phase 4 is done only when:

- lifecycle/version/approval works transactionally;
- storage is managed and secure;
- generation reuses existing provider;
- legacy compatibility remains;
- campaign exact snapshot is immutable;
- preflight runs before paid dispatch;
- tests/build/Dev smoke pass;
- SOT/roadmap/checklist updated;
- release completed.

If blocked, document checklist, command, error, root cause, completed changes, and minimal unblock step. Never mark failed work complete.

---

## END PROMPT
