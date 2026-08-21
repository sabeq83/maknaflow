# Implementation Plan — Fase 4 Visual Consistency Assets

## 1. Sasaran

Membangun **Visual Consistency Assets**: registry reference image yang tenant-scoped, versioned, dapat dihasilkan atau diunggah, wajib direview, dan dapat dikunci sebagai approved reference untuk universe, character, location, wardrobe, style, serta Visual Identity.

Tujuan akhirnya:

```text
Universe / Character / Location / Visual Identity
→ generate atau upload reference asset
→ draft asset
→ user review
→ approve version
→ manifest/resolver menggunakan exact approved version
→ campaign menyimpan reference asset snapshot
→ retry/regenerate tetap memakai version yang sama
```

Fase ini tidak membuat pipeline gambar baru yang bersaing. Character AI Image Generation, G-Labs webhook, universe manifest, dan `cartoon-reference-resolver` existing harus direuse dan dimigrasikan secara kompatibel.

## 2. Temuan Existing

### 2.1 Fase 3 selesai

- AI Visual Identity Builder telah dirilis pada `v2.19.0`;
- Visual Identity UI distandardisasi pada `v2.19.1`;
- generation/refinement, compliance, handoff, dan SOT tersedia;
- checklist Fase 3 sudah selesai.

### 2.2 Character reference image sudah ada

Universe Manager saat ini:

- dapat membuat canonical prompt dengan Gemini;
- memanggil `/api/webhook/generate` untuk G-Labs T2I;
- polling `/api/webhook/status` dari client;
- menyimpan hasil ke `reference_image_path` character;
- mendukung upload file manual ke folder:

```text
public/uploads/universe-assets/{universeId}/characters/{characterKey}/v{version}/identity-anchor.ext
```

### 2.3 Reference injection sudah ada

`lib/cartoon-reference-resolver.js` telah menggabungkan:

- character references;
- product references;
- style reference.

`lib/universe-manifests.js` menggunakan:

- `universe_profiles.style_reference_path`;
- `universe_characters.reference_image_path`;
- `universe_locations.reference_image_path`.

### 2.4 Keterbatasan

- hanya satu path per owner;
- tidak ada version history asset yang independen;
- remote G-Labs URL dapat langsung disimpan tanpa managed ingestion;
- tidak ada draft/approved/archive lifecycle;
- tidak ada atomic approval switch;
- tidak ada wardrobe/location/style reference workflow terpadu;
- campaign belum menyimpan exact asset IDs/versions;
- tidak ada preflight completeness sebelum produksi;
- fallback manifest dapat mengarang default path walau file tidak ada.

## 3. Outcome dan Acceptance Criteria

Fase 4 selesai bila:

1. Tersedia registry `visual_reference_assets` tenant-scoped.
2. Owner yang didukung: universe, character, location, visual identity.
3. Asset roles yang didukung: identity, wardrobe, location, visual_style, palette_sheet, character_sheet.
4. User dapat upload reference image.
5. User dapat generate reference image melalui provider existing.
6. Output remote provider di-ingest ke managed storage sebelum dapat di-approve.
7. Generated/uploaded asset berstatus draft dan tidak langsung menjadi active reference.
8. User dapat approve, reject, dan archive version.
9. Maksimal satu approved active asset per tenant + owner + role.
10. Approval baru menonaktifkan approved version lama secara atomik tanpa menghapus history.
11. Approved asset immutable; edit metadata/gambar menghasilkan version baru.
12. Universe manifest dan Visual Identity resolver memilih approved asset terbaru atau exact requested version.
13. Legacy path tetap berfungsi sebagai fallback.
14. Approval melakukan dual-write ke legacy `reference_image_path`/`style_reference_path` untuk rollback compatibility.
15. Campaign baru menyimpan exact reference asset snapshot.
16. Retry/regenerate campaign existing menggunakan snapshot, bukan latest asset.
17. Preflight mendeteksi missing/unapproved/unreachable references sebelum production.
18. Faceless owner tidak dapat menyetujui asset yang secara deklaratif tidak memenuhi policy.
19. Tidak ada hard delete asset approved/referenced.
20. Character AI Image Generation existing termigrasi ke workflow baru tanpa kehilangan kemampuan.

## 4. Scope

### 4.1 Termasuk

- asset registry dan lifecycle;
- managed ingestion untuk upload/provider output;
- generation dispatch/status dengan provider existing;
- character, wardrobe, location, universe style, palette/reference sheet roles;
- asset gallery/editor dalam Universe Manager;
- asset panel pada user Visual Identity presets;
- reference sheet generation prompt contract;
- approval/rejection/archive;
- manifest/resolver integration;
- campaign asset snapshot;
- deterministic preflight;
- legacy fallback/dual-write;
- tests, SOT, Dev deployment, release.

### 4.2 Tidak termasuk

- otomatis menyetujui hasil AI;
- hard delete file/history;
- pixel-level identity similarity scoring;
- face recognition atau biometric matching;
- video reference generation;
- training/fine-tuning/LoRA;
- multi-provider visual quality benchmarking;
- mengganti G-Labs provider secara menyeluruh;
- production deployment tanpa instruksi eksplisit.

## 5. Domain Model

### 5.1 Owner types

```javascript
owner_type ∈ ['universe', 'character', 'location', 'visual_identity']
```

Owner rules:

- universe → `universe_profiles.id`;
- character → `universe_characters.id`;
- location → `universe_locations.id`;
- visual_identity → user `visual_identity_presets.id`;
- system Visual Identity harus di-clone menjadi user preset sebelum memiliki tenant asset.

### 5.2 Asset roles

```javascript
asset_role ∈ [
  'identity',
  'wardrobe',
  'location',
  'visual_style',
  'palette_sheet',
  'character_sheet'
]
```

Compatibility:

- character + identity → legacy `universe_characters.reference_image_path`;
- location + location → legacy `universe_locations.reference_image_path`;
- universe + visual_style → legacy `universe_profiles.style_reference_path`;
- visual identity roles tidak memiliki legacy column dan hanya memakai registry/snapshot.

### 5.3 Lifecycle

```text
generating → draft → approved → archived
     └────→ failed
draft → rejected
rejected → archived
```

Status enum:

```javascript
status ∈ ['generating', 'draft', 'approved', 'rejected', 'archived', 'failed']
```

Generated/uploaded asset selalu mulai sebagai `draft` setelah managed file siap. `approved` hanya melalui explicit user action.

### 5.4 Immutability

- version number monotonik per owner + role;
- file, checksum, generation prompt, provider lineage, dan owner tidak dapat diubah setelah draft dibuat;
- label/notes boleh disimpan sebagai review metadata, tetapi perubahan visual membuat version baru;
- approved asset tidak dapat di-overwrite;
- archive tidak menghapus file.

## 6. Database Schema

```sql
CREATE TABLE IF NOT EXISTS visual_reference_assets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  universe_id TEXT,
  asset_role TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  source_type TEXT NOT NULL,
  storage_path TEXT,
  public_path TEXT,
  mime_type TEXT,
  byte_size BIGINT,
  sha256 TEXT,
  width INTEGER,
  height INTEGER,
  generation_prompt TEXT,
  negative_prompt TEXT,
  provider TEXT,
  provider_task_id TEXT,
  provider_result_url TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  review_notes TEXT,
  failure_code TEXT,
  failure_message TEXT,
  created_by TEXT,
  approved_by TEXT,
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, owner_type, owner_id, asset_role, version)
);
```

Indexes:

```sql
CREATE INDEX ... ON visual_reference_assets (tenant_id, owner_type, owner_id, asset_role, status);
CREATE UNIQUE INDEX ... ON visual_reference_assets (tenant_id, owner_type, owner_id, asset_role)
  WHERE status = 'approved';
CREATE INDEX ... ON visual_reference_assets (tenant_id, provider_task_id)
  WHERE provider_task_id IS NOT NULL;
```

`source_type ∈ ['upload', 'ai_generated', 'legacy_import']`.

Jangan membuat SQL foreign key polymorphic ke `owner_id`; repository memverifikasi owner secara tenant-scoped sebelum create/read/approve.

## 7. Storage Strategy

### 7.1 Managed path

```text
public/uploads/reference-assets/{tenantSafeId}/{ownerType}/{ownerId}/{role}/v{version}/{sha256-prefix}.{ext}
```

Requirements:

- sanitize setiap path segment;
- server menentukan path, bukan request body;
- allowlist MIME: PNG, JPEG, WEBP;
- verifikasi magic bytes, bukan extension saja;
- limit ukuran file, default 10 MB;
- baca metadata width/height dengan `sharp` existing;
- hitung SHA-256;
- tulis atomik melalui temporary file lalu rename;
- jangan menerima SVG/HTML/executable;
- provider URL wajib di-download server-side dengan timeout dan size limit;
- cegah SSRF: hanya allowlisted provider host/result route atau gunakan provider adapter existing;
- remote URL bukan final approved reference.

### 7.2 Legacy assets

Legacy path tidak dipindahkan paksa. Saat pertama kali dibaca:

- gunakan legacy fallback;
- UI menawarkan `Import as Version 1`;
- optional idempotent migration script membuat registry row `legacy_import` tanpa menghapus file lama.

## 8. Approval Semantics

Approval berjalan dalam transaction dan lock per tenant/owner/role:

1. fetch draft asset tenant-scoped;
2. pastikan file managed tersedia dan checksum cocok;
3. jalankan deterministic preflight;
4. archive/demote current approved asset;
5. mark selected version approved;
6. dual-write legacy path jika mapping tersedia;
7. commit;
8. refresh universe manifest/Visual Identity cache best-effort.

Jika approval gagal, approved version lama tetap aktif.

## 9. Faceless Asset Policy

Deterministic preflight tidak melakukan face recognition. Ia memverifikasi policy/lineage yang dapat dibuktikan:

- owner universe/character depiction policy;
- Visual Identity subject kind/faceless mode;
- generation prompt mengandung mode-specific mandate;
- negative prompt mengandung locked prohibitions;
- role/framing metadata kompatibel;
- user wajib mencentang explicit review attestation:

```text
Saya telah memeriksa gambar dan memastikan tidak ada wajah manusia yang terlihat.
```

Untuk upload human/blank-face asset tanpa generation prompt, attestation wajib. Approval mencatat actor/timestamp/attestation di metadata.

Pixel-level AI visual audit dapat ditambahkan sebagai fase lanjutan atau explicit optional paid check, bukan syarat MVP Fase 4.

## 10. Reference Sheet Generation

### 10.1 Character sheet

Satu gambar sheet dapat memuat panel konsistensi yang tetap faceless:

- identity view yang diperbolehkan;
- back view;
- wardrobe/material detail;
- color palette swatches;
- key accessories;
- forbidden changes text-safe area bila provider mendukung.

Untuk human hands-only, jangan meminta full face/front portrait. Sheet fokus pada hands/forearms, garment, materials, palette, dan back/cropped view.

### 10.2 Palette/style sheet

- color swatches;
- material samples;
- environment fragments;
- lighting examples;
- camera/framing examples tanpa human visible face.

Prompt builder versioned:

```javascript
REFERENCE_ASSET_PROMPT_VERSION = 'visual_reference_asset_v1'
```

Prompt dibangun server-side dari canonical owner data, approved Visual Identity config, dan selected role. User custom instruction hanya data tambahan dengan length limit.

## 11. API

```text
GET    /api/v2/reference-assets?owner_type=&owner_id=&role=&status=
POST   /api/v2/reference-assets/upload
POST   /api/v2/reference-assets/generate
GET    /api/v2/reference-assets/:id
GET    /api/v2/reference-assets/:id/status
POST   /api/v2/reference-assets/:id/approve
POST   /api/v2/reference-assets/:id/reject
DELETE /api/v2/reference-assets/:id          # archive only
POST   /api/v2/reference-assets/preflight
POST   /api/v2/reference-assets/import-legacy
```

Generate flow:

1. validate owner/role;
2. build server prompt;
3. create `generating` asset row with reserved version;
4. dispatch provider task;
5. store provider task ID;
6. status endpoint checks task via provider adapter;
7. when complete, ingest managed file and transition to `draft` idempotently;
8. return asset, never auto-approve.

Status polling endpoint harus idempotent. Dua concurrent completion checks tidak boleh membuat dua files/versions.

## 12. UI

### 12.1 Shared component

```jsx
<ReferenceAssetManager
  ownerType="character"
  ownerId={character.id}
  universeId={universe.id}
  allowedRoles={['identity', 'wardrobe', 'character_sheet']}
  facelessPolicy={...}
/>
```

Features:

- active approved asset;
- version history;
- status badges;
- upload;
- generate;
- prompt preview;
- progress/status;
- draft preview;
- approve with attestation;
- reject/archive;
- compare current approved vs candidate;
- missing/error/legacy states.

### 12.2 Universe Manager

- character: identity, wardrobe, character sheet;
- location: location reference;
- universe profile: visual style/palette sheet;
- replace single raw file field dengan shared manager secara bertahap;
- legacy upload UI tetap fallback sampai migration stabil.

### 12.3 Visual Identity Studio

Hanya user preset:

- wardrobe reference;
- visual style reference;
- palette sheet;
- optional character sheet untuk blank-face 3D.

System preset menampilkan `Clone to add assets`.

## 13. Manifest dan Resolver

### 13.1 Universe manifest

Manifest baru menyertakan asset reference metadata:

```json
{
  "style_reference": {
    "asset_id": "ref_...",
    "version": 2,
    "public_path": "/uploads/...",
    "sha256": "..."
  },
  "characters": {
    "mochi": {
      "identity_reference": {
        "asset_id": "ref_...",
        "version": 3,
        "public_path": "/uploads/..."
      }
    }
  }
}
```

Legacy `identity_reference_path` dan `style_reference_path` tetap diisi.

### 13.2 Visual Identity snapshot

Saat campaign resolution:

```json
{
  "reference_assets": [
    {
      "asset_id": "ref_...",
      "owner_type": "visual_identity",
      "owner_id": "vi_...",
      "role": "visual_style",
      "version": 2,
      "public_path": "/uploads/...",
      "sha256": "..."
    }
  ]
}
```

Snapshot campaign menyimpan exact approved references. Worker tidak mengambil latest asset ketika snapshot sudah ada.

### 13.3 Reference resolver

Resolution priority:

```text
1. exact campaign asset snapshot
2. exact requested asset/version
3. current approved registry asset
4. legacy reference path
5. no reference + explicit preflight warning
```

Hapus perilaku yang membuat fallback path seolah file pasti tersedia. Missing file harus terlihat sebagai warning/error sesuai requirement campaign.

## 14. Preflight

Preflight modes:

```javascript
mode ∈ ['advisory', 'required']
```

Checks:

- owner exists dan tenant-scoped;
- required role mempunyai approved asset;
- exact snapshot asset masih ada;
- managed file exists;
- checksum sesuai;
- MIME/dimensions valid;
- asset status approved;
- faceless prompt/attestation tersedia;
- no duplicate role ambiguity;
- reference count tidak melebihi provider limit;
- character names pada clip dapat di-resolve ke manifest.

Output:

```json
{
  "status": "pass_with_warnings",
  "checks": [],
  "missing": [],
  "warnings": [],
  "resolved_assets": []
}
```

Pada Fase 4:

- existing legacy campaign memakai advisory untuk compatibility;
- campaign baru yang secara eksplisit mengaktifkan visual consistency lock memakai required;
- required preflight gagal sebelum provider dispatch, tidak setelah biaya generation terjadi.

## 15. Perubahan per File

### 15.1 `[NEW] lib/reference-asset-contract.js`

#### Code Sebelum (Current/Before)

```javascript
// Belum ada contract owner/role/status/version/reference snapshot.
```

#### Code Sesudah (Proposed/After)

```javascript
export const REFERENCE_ASSET_PROMPT_VERSION = 'visual_reference_asset_v1';
export const OWNER_TYPES = ['universe', 'character', 'location', 'visual_identity'];
export const ASSET_ROLES = ['identity', 'wardrobe', 'location', 'visual_style', 'palette_sheet', 'character_sheet'];
export const ASSET_STATUSES = ['generating', 'draft', 'approved', 'rejected', 'archived', 'failed'];

export function validateReferenceAssetIntent(input) {}
export function validateOwnerRole(ownerType, role) {}
export function buildReferenceAssetSnapshot(asset) {}
export function validateApprovalAttestation(input, policy) {}
```

### 15.2 `[NEW] lib/reference-asset-repository.js`

#### Code Sebelum (Current/Before)

```javascript
// reference image hanya disimpan sebagai path pada owner row.
```

#### Code Sesudah (Proposed/After)

```javascript
export async function listReferenceAssets(filters) {}
export async function getReferenceAsset(id) {}
export async function reserveReferenceAssetVersion(intent, actor) {}
export async function markReferenceAssetDraft(id, managedFile) {}
export async function markReferenceAssetFailed(id, error) {}
export async function approveReferenceAsset(id, review, actor) {}
export async function rejectReferenceAsset(id, review, actor) {}
export async function archiveReferenceAsset(id, actor) {}
export async function getApprovedReferenceAssets(ownerType, ownerId, roles) {}
export async function getReferenceAssetsBySnapshot(snapshot) {}
```

Approval harus transactional, concurrency-safe, dan dual-write legacy path.

### 15.3 `[NEW] lib/reference-asset-storage.js`

#### Code Sebelum (Current/Before)

```javascript
fs.writeFileSync() langsung menulis upload character berdasarkan filename extension.
```

#### Code Sesudah (Proposed/After)

```javascript
export async function ingestUploadedReference(file, target) {}
export async function ingestProviderReference(url, target, providerContext) {}
export async function verifyManagedReference(asset) {}
export function resolveManagedReferencePath(asset) {}
```

Gunakan MIME magic-byte validation, `sharp`, checksum, size limit, sanitized path, atomic write, timeout, dan SSRF protection.

### 15.4 `[NEW] lib/reference-asset-service.js`

#### Code Sebelum (Current/Before)

```javascript
// Generation/polling/save logic berada di Universe Manager client dan generic webhook.
```

#### Code Sesudah (Proposed/After)

```javascript
export async function uploadReferenceAsset(input, actor) {}
export async function dispatchReferenceAssetGeneration(input, actor) {}
export async function refreshReferenceAssetGeneration(id, actor) {}
export async function approveReferenceAssetVersion(id, review, actor) {}
export async function runReferenceAssetPreflight(input) {}
export async function importLegacyReference(input, actor) {}
```

Service mereuse provider/webhook adapter existing, bukan menyalin HTTP/provider credentials ke UI.

### 15.5 `[NEW] lib/reference-asset-prompt-builder.js`

#### Code Sebelum (Current/Before)

```javascript
// Character prompt dibuat ad hoc; belum ada role-aware reference sheet prompt.
```

#### Code Sesudah (Proposed/After)

```javascript
export function buildReferenceAssetPrompt({ owner, role, visualIdentity, customInstruction }) {
  // Deterministic server prompt, faceless mode rules, canonical identity,
  // wardrobe/palette/location/style locks, negative prompt.
}
```

Prompt generation tidak memerlukan Gemini call bila data canonical sudah cukup. Bila auto-write enrichment tetap digunakan, itu explicit separate action dan tidak berada dalam provider transaction.

### 15.6 `[MODIFY] lib/db-pg.js`

#### Code Sebelum (Current/Before)

```javascript
// Universe owners hanya memiliki satu reference_image_path/style_reference_path.
```

#### Code Sesudah (Proposed/After)

```javascript
const migrateVisualReferenceAssets = async () => {
  // Advisory lock.
  // CREATE TABLE/INDEXES IF NOT EXISTS.
  // No destructive changes to legacy columns.
};
```

### 15.7 `[NEW] app/api/v2/reference-assets/*`

#### Code Sebelum (Current/Before)

```javascript
// Tidak ada domain API untuk reference asset lifecycle.
```

#### Code Sesudah (Proposed/After)

```javascript
// list, detail, upload, generate, status, approve, reject,
// archive, preflight, import-legacy Route Handlers.
```

Semua route memakai `withTenantContext`, owner validation, permission Visual Identity/Universe Manager existing, safe error mapping, dan `force-dynamic`.

### 15.8 `[NEW] app/components/ReferenceAssetManager.js`

#### Code Sebelum (Current/Before)

```jsx
<input type="file" onChange={handleCharFileChange} />
<button onClick={genericWebhookGeneration}>Paint Image (AI)</button>
```

#### Code Sesudah (Proposed/After)

```jsx
<ReferenceAssetManager
  ownerType="character"
  ownerId={character.id}
  universeId={universe.id}
  allowedRoles={['identity', 'wardrobe', 'character_sheet']}
  facelessPolicy={policy}
/>
```

Component memuat gallery/version/review workflow dan tidak menerima arbitrary storage path.

### 15.9 `[MODIFY] app/settings/universes/page.js`

#### Code Sebelum (Current/Before)

```javascript
const pollGlabsImage = async taskId => { /* generic status polling */ };
```

```jsx
<input type="file" onChange={handleCharFileChange} />
<button>🎨 Paint Image (AI)</button>
```

#### Code Sesudah (Proposed/After)

```jsx
<ReferenceAssetManager
  ownerType="character"
  ownerId={selectedCharacter.id}
  universeId={selectedUniverse.id}
  allowedRoles={['identity', 'wardrobe', 'character_sheet']}
/>
```

Tambahkan manager untuk universe style dan location reference. Pertahankan legacy form untuk create-unsaved character: character harus disimpan dahulu sebelum asset dapat dibuat, atau gunakan explicit post-create handoff.

### 15.10 `[MODIFY] app/settings/visual-identities/page.js`

#### Code Sebelum (Current/Before)

```jsx
// Studio mengelola structured text config dan resolved prompt preview saja.
```

#### Code Sesudah (Proposed/After)

```jsx
{editingPreset && !editingPreset.isNew && editingPreset.source === 'user' && (
  <ReferenceAssetManager
    ownerType="visual_identity"
    ownerId={editingPreset.id}
    allowedRoles={['wardrobe', 'visual_style', 'palette_sheet', 'character_sheet']}
  />
)}
```

System preset menunjukkan clone requirement. AI Visual Identity generation tidak otomatis memulai image generation.

### 15.11 `[MODIFY] lib/universe-manifests.js`

#### Code Sebelum (Current/Before)

```javascript
identity_reference_path: char.reference_image_path || `/universe-assets/${profile.slug}/...`
```

#### Code Sesudah (Proposed/After)

```javascript
const approved = approvedAssetMap.character?.[char.id]?.identity;

identity_reference: approved ? buildReferenceAssetSnapshot(approved) : null,
identity_reference_path: approved?.public_path || char.reference_image_path || null
```

Manifest load/cache refresh harus memasukkan approved registry assets secara tenant-aware dan tidak mengarang nonexistent fallback path.

### 15.12 `[MODIFY] lib/cartoon-reference-resolver.js`

#### Code Sebelum (Current/Before)

```javascript
const b64 = fileToBase64(char.identity_reference_path);
```

#### Code Sesudah (Proposed/After)

```javascript
const exact = resolveExactReferenceFromCampaignSnapshot(assetSnapshot, char.character_id, 'identity');
const reference = exact || char.identity_reference || legacyPathReference(char.identity_reference_path);
const b64 = loadVerifiedReference(reference);
```

Return provenance metadata bersama reference list agar logs/preflight dapat menjelaskan asset ID/version yang digunakan. Jangan log base64.

### 15.13 `[MODIFY] lib/visual-override-resolver.js`

#### Code Sebelum (Current/Before)

```javascript
const snapshot = {
  schema_version: 'visual_identity_snapshot_v1',
  identity_ref: identityRef,
  structured: config,
  resolved: {},
  legacy: {}
};
```

#### Code Sesudah (Proposed/After)

```javascript
const referenceAssets = await getApprovedReferenceAssetSnapshots('visual_identity', identityRef.id);

const snapshot = {
  schema_version: 'visual_identity_snapshot_v1',
  identity_ref: identityRef,
  structured: config,
  reference_assets: referenceAssets,
  resolved: {},
  legacy: {}
};
```

Existing snapshot tidak di-upgrade dengan latest assets pada retry.

### 15.14 `[MODIFY] lib/pillar-campaign-ingest.js` dan campaign creation routes`

Target minimal:

```text
lib/pillar-campaign-ingest.js
app/api/v2/re-campaigns/route.js
app/api/v2/re-campaigns/bulk/route.js
app/api/v2/pillar-campaigns/route.js
app/api/v2/pillar-campaigns/bulk/route.js
app/api/sheets-autopilot/route.js
```

#### Code Sebelum (Current/Before)

```javascript
visual_overrides_json: JSON.stringify(identityResult.snapshot)
```

#### Code Sesudah (Proposed/After)

```javascript
const identitySnapshot = await resolveVisualIdentitySubmission(...);
const referenceSnapshot = await buildCampaignReferenceAssetSnapshot({
  universeId,
  visualIdentitySnapshot: identitySnapshot.snapshot
});

visual_overrides_json: JSON.stringify({
  ...identitySnapshot.snapshot,
  reference_assets: referenceSnapshot.visualIdentityAssets
}),
universe_snapshot_json: mergeUniverseAssetSnapshot(existingUniverseSnapshot, referenceSnapshot.universeAssets)
```

Gunakan column existing yang tepat setelah audit; jangan menambahkan duplicated snapshot column tanpa kebutuhan.

### 15.15 `[MODIFY] scheduler/regenerate consumers`

Target minimal:

```text
lib/scheduler-processors.js
lib/sheets-autopilot-worker.js
app/api/v2/pillar-campaigns/items/[itemId]/regenerate-t2i/route.js
```

#### Code Sebelum (Current/Before)

```javascript
resolveClipReferenceImages({ universeSnapshot, clipCharacters, productReference })
```

#### Code Sesudah (Proposed/After)

```javascript
const preflight = await runReferenceAssetPreflight({ campaign, item, clip, mode });
if (preflight.blocking) throw new ReferencePreflightError(preflight);

resolveClipReferenceImages({
  universeSnapshot,
  visualIdentitySnapshot,
  referenceAssetSnapshot: preflight.resolved_assets,
  clipCharacters,
  productReference
});
```

Legacy campaign memakai advisory fallback; new consistency-lock campaign memakai required mode.

### 15.16 `[NEW] scripts/migrate-legacy-reference-assets.mjs`

#### Code Sebelum (Current/Before)

```javascript
// Legacy reference paths belum memiliki registry rows.
```

#### Code Sesudah (Proposed/After)

```javascript
// Dry-run default.
// Scan tenant-scoped universe/style/character/location legacy paths.
// Validate file, checksum, infer role, create idempotent legacy_import v1 rows.
// Never delete or rewrite file in migration mode.
```

Require explicit `--apply` dan tenant target. Jangan memakai broad all-tenant mutation sebagai default.

### 15.17 `[NEW] scripts/test-visual-reference-assets.mjs`

#### Code Sebelum (Current/Before)

```javascript
// Belum ada test lifecycle/version/preflight/snapshot.
```

#### Code Sesudah (Proposed/After)

```javascript
// Contract, storage validation, repository lifecycle, concurrent approval,
// dual-write, manifest fallback, snapshot immutability, preflight, tenant isolation.
```

Provider generation menggunakan fake adapter/server fixture.

### 15.18 `[MODIFY] package.json`

#### Code Sebelum (Current/Before)

```json
"test:ai-visual-identity": "node scripts/test-ai-visual-identity-builder.mjs"
```

#### Code Sesudah (Proposed/After)

```json
"test:ai-visual-identity": "node scripts/test-ai-visual-identity-builder.mjs",
"test:visual-reference-assets": "node scripts/test-visual-reference-assets.mjs",
"migrate:legacy-reference-assets": "node scripts/migrate-legacy-reference-assets.mjs"
```

### 15.19 `[NEW] sot/global/visual-reference-assets.md` dan `[MODIFY] related SOT`

Related:

```text
sot/menus/universe-manager.md
sot/menus/visual-identity-studio.md
sot/global/vso-engine.md
docs/visual-universe-platform/master_roadmap.md
```

#### Code Sebelum (Current/Before)

```markdown
Reference image direpresentasikan sebagai satu path per character/location/style.
```

#### Code Sesudah (Proposed/After)

```markdown
Reference assets tenant-scoped, versioned, reviewed, approved, snapshotted,
dan resolved dengan legacy fallback serta faceless attestation.
```

## 16. Migration Strategy

### Gate 4A — Registry dan compatibility

1. schema/contract/repository/storage;
2. upload + legacy import;
3. lifecycle/approval/dual-write;
4. manifest registry-first + legacy fallback;
5. tests.

### Gate 4B — Generation dan UI

1. provider dispatch/status/managed ingestion;
2. prompt builder/reference sheets;
3. shared manager;
4. Universe Manager and Visual Identity Studio integration;
5. tests.

### Gate 4C — Snapshot dan preflight

1. campaign snapshot creation;
2. scheduler/regenerate exact reference resolution;
3. advisory/required preflight;
4. backward compatibility;
5. Dev end-to-end smoke test.

Fase 4 belum selesai hanya dengan asset gallery atau database table.

## 17. Test Matrix

### Contract/storage

- valid owner/role combinations;
- invalid system Visual Identity ownership;
- MIME magic-byte validation;
- PNG/JPEG/WEBP accepted;
- SVG/HTML/executable rejected;
- size limit;
- checksum/dimensions;
- sanitized path/no traversal;
- atomic write cleanup on failure;
- provider URL SSRF/timeout/oversize rejection.

### Repository/lifecycle

- tenant isolation;
- monotonically increasing versions;
- one active approved per owner/role;
- concurrent approvals deterministic;
- failed approval preserves old approved;
- approved asset immutable;
- reject/archive semantics;
- no hard delete;
- legacy dual-write mapping;
- system preset cannot own tenant asset.

### Generation

- role-aware prompt;
- human hands-only sheet never requests face;
- blank-face 3D negative prompt;
- fake provider dispatch/status/completion/failure;
- completion idempotency;
- managed ingestion before draft;
- never auto-approve.

### Manifest/resolver/snapshot

- approved registry takes priority;
- exact campaign snapshot takes priority over latest approved;
- legacy path fallback;
- missing legacy path warning, no fictional path;
- campaign created with v1 keeps v1 after v2 approval;
- retry/regenerate keeps snapshot;
- character + product + style reference ordering/dedup;
- no base64 logging.

### Preflight

- required role pass/fail;
- checksum/file missing;
- unapproved asset rejected;
- faceless prompt/attestation;
- provider reference count limit;
- advisory legacy behavior;
- required new campaign blocks before provider dispatch.

### UI

- upload/generate/progress;
- version gallery;
- compare candidate/current;
- attestation required;
- approve/reject/archive;
- system Visual Identity clone message;
- unsaved character save-first behavior;
- loading/error/empty/legacy states;
- responsive/keyboard basics.

### Regression

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

Automated tests tidak boleh memanggil Gemini/G-Labs live.

## 18. Security dan Observability

Security:

- no tenant ID authority from body;
- owner tenant verification on every operation;
- no arbitrary filesystem path;
- no arbitrary provider URL fetch;
- upload MIME/size/path validation;
- safe filenames;
- no SVG active content;
- permission parity with Universe/Visual Identity Manager;
- actor/approval audit;
- no hard delete.

Safe logs:

```text
reference_asset.uploaded
reference_asset.generation.dispatched
reference_asset.generation.completed
reference_asset.generation.failed
reference_asset.approved
reference_asset.rejected
reference_asset.archived
reference_asset.preflight.completed
```

Log asset ID, role, version, provider, duration, status, safe error code. Jangan log base64, signed URLs, API keys, full prompt sensitif, atau filesystem absolute path.

## 19. Deployment dan Release

Deploy hanya ke Dev Mac Mini setelah tests/build lulus:

```text
Host            : masbenu@100.95.245.55
Folder          : ~/maknaflow-dev
UI/API          : 5020 / 7020
Schema          : dev
PGPOOL_MAX      : 3
PM2 environment : dev
Command         : npm run deploy:macmini-dev
```

Ikuti zero-spam remote build. Jangan deploy Staging/Production tanpa instruksi eksplisit.

Smoke test minimum:

1. import satu legacy character reference;
2. upload identity v2, review, approve;
3. verify legacy column dual-write dan manifest refresh;
4. generate character sheet dengan G-Labs, ingest managed, approve;
5. upload location reference;
6. create style/palette asset pada user Visual Identity;
7. create campaign dan inspect exact asset snapshot;
8. approve newer asset, retry old campaign, verify old version retained;
9. required preflight blocks missing asset before paid dispatch;
10. human faceless approval requires attestation;
11. legacy campaign remains operational.

Release:

```bash
npm run release-non-interactive -- --type minor --title "Visual Consistency Assets" --points "Tambah reference asset registry dan version approval|Tambah character location style reference workflow|Tambah campaign asset snapshot dan production preflight"
```

Gunakan minor karena schema dan user-facing capability baru. Bila convention repository memilih patch, dokumentasikan keputusan sebelum release.

## 20. Definition of Done

- Gate 4A, 4B, dan 4C selesai;
- approved asset lifecycle transactional dan versioned;
- managed ingestion aman;
- legacy paths tetap kompatibel;
- campaign exact snapshot immutable;
- retry/regenerate memakai version yang sama;
- required preflight berjalan sebelum provider dispatch;
- faceless attestation/policy terjaga;
- tests/build/Dev smoke test lulus;
- SOT/roadmap diperbarui;
- release SOP selesai.

## Execution Task List

- [ ] 1. Baca `AGENTS.md`, roadmap, plan Fase 1–3, SOT, Next.js docs lokal, dan seluruh reference/provider/manifest consumer aktual.
- [ ] 2. Jalankan `git status --short` serta baseline tests Universe, Visual Identity, AI Visual Identity, OPC, dan build.
- [ ] 3. Audit G-Labs webhook/provider contract, asset storage behavior, campaign universe snapshot columns, dan seluruh reference injection call sites; perbarui plan bila berbeda.
- [ ] 4. Finalkan owner/role/status/source/snapshot contracts dan faceless approval requirements.
- [ ] 5. Implementasikan idempotent `visual_reference_assets` migration dan indexes.
- [ ] 6. Implementasikan tenant-scoped repository, version reservation, lifecycle, transactional approval, dan dual-write compatibility.
- [ ] 7. Implementasikan secure managed storage untuk upload/provider output beserta checksum/dimensions/MIME/path protection.
- [ ] 8. Tambahkan contract/storage/repository tests dan selesaikan Gate 4A foundation tests.
- [ ] 9. Implementasikan legacy import dry-run/apply script serta idempotency tests.
- [ ] 10. Implementasikan role-aware reference asset prompt builder dengan faceless mandates.
- [ ] 11. Implementasikan upload/generate/status/approve/reject/archive/preflight/import APIs dan safe error mapping.
- [ ] 12. Implementasikan fake-provider tests untuk dispatch, polling completion, managed ingestion, failure, dan idempotency.
- [ ] 13. Implementasikan shared `ReferenceAssetManager` dengan version gallery, compare, review, attestation, dan lifecycle actions.
- [ ] 14. Integrasikan character/location/universe-style asset workflows ke Universe Manager dan migrasikan Paint Image existing.
- [ ] 15. Integrasikan wardrobe/style/palette/character-sheet assets ke user Visual Identity Studio.
- [ ] 16. Selesaikan Gate 4B UI/generation tests tanpa provider live.
- [ ] 17. Integrasikan registry approved assets ke universe manifests dengan exact metadata dan legacy fallback.
- [ ] 18. Integrasikan Visual Identity approved assets ke immutable snapshot tanpa mengubah existing campaign retry snapshots.
- [ ] 19. Tambahkan campaign universe/reference snapshot creation pada RE, OPC/Pillar, Sheets, dan ingest paths aktual.
- [ ] 20. Integrasikan exact snapshot resolution dan advisory/required preflight ke scheduler, regenerate, dan worker consumers.
- [ ] 21. Tambahkan concurrency, snapshot immutability, retry, preflight, manifest, resolver, dan legacy regression tests.
- [ ] 22. Perbarui SOT Visual Reference Assets, Universe Manager, Visual Identity Studio, VSO Engine, dan master roadmap.
- [ ] 23. Jalankan seluruh targeted tests, security/log inspection, migration dry-run, dan production build.
- [ ] 24. Deploy hanya ke Dev Mac Mini dan selesaikan seluruh Gate 4C smoke tests.
- [ ] 25. Jalankan release non-interaktif dan verifikasi version, changelog, commit, tag, branch, dan push.

> Ubah checkbox menjadi `[x]` hanya setelah task benar-benar selesai dan terverifikasi. Jangan menyimpan output provider sebagai approved tanpa review, jangan menimpa asset approved, dan jangan menghapus compatibility path sebelum seluruh consumer termigrasi.

