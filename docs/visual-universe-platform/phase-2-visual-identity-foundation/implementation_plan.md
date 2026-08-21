# Implementation Plan — Fase 2 Visual Identity Foundation

## 1. Sasaran

Mengubah Visual Swap Overrides (VSO) dari kumpulan pilihan hardcoded dan form yang tersebar menjadi **Visual Identity Foundation** yang:

- memiliki system presets immutable dan user presets tenant-scoped;
- dapat dikelola melalui Visual Identity Studio;
- menggunakan structured configuration dan centralized resolver;
- tetap 100% faceless untuk representasi manusia;
- reusable pada RE Campaign, OPC/Pillar Campaign, Sheets Autopilot, Import Planner, Multiplier Lab, Recipe Labs, dan operator presets;
- menyimpan reference preset serta immutable resolved snapshot pada campaign;
- backward-compatible dengan seluruh `visual_overrides_json` existing.

## 2. Temuan Existing

### 2.1 Preset tersebar

Preset visual berada di `lib/prompts.js` melalui:

- `WARDROBE_PRESETS`;
- `DEMOGRAPHIC_PRESETS`;
- `LIGHTING_PRESETS`;
- mascot universe/art style catalogs.

`lib/visual-override-resolver.js` hanya memusatkan wardrobe resolution. Prompt builders dan workers masih melakukan lookup direct ke constants.

### 2.2 UI terduplikasi

VSO form/state/payload dibangun ulang pada banyak halaman:

- `app/re-campaigns/page.js`;
- `app/pillar-campaigns/page.js`;
- `app/sheets-autopilot/page.js`;
- `app/components/ImportPlannerModal.js`;
- `app/multiplier-lab/page.js`;
- `app/recipe-labs/page.js`;
- `app/settings/presets/page.js`.

Nilai dropdown tidak selalu konsisten antarmodul.

### 2.3 Persistence existing

Campaign menyimpan `visual_overrides_json`. Field ini harus dipertahankan sebagai resolved snapshot. Operator preset menyimpan `visual_swap` sebagai bagian config keseluruhan dan tidak boleh digantikan oleh Visual Identity Preset.

## 3. Keputusan Produk

### 3.1 Nama pengguna

Gunakan label:

```text
Visual Identity
```

Istilah `VSO` tetap dipakai pada compatibility layer, log teknis, dan data legacy.

### 3.2 System dan user presets

- System preset: code-owned, immutable, versioned, tidak tersimpan sebagai row database.
- User preset: database-owned, tenant-scoped, editable, archivable, versioned.
- System preset dapat di-clone menjadi user preset.
- User tidak dapat memakai key system untuk overwrite.

### 3.3 Operator preset bukan Visual Identity preset

Operator preset tetap mencakup creative strategy, visual engine, product bridging, workflow, dan optional visual identity reference/snapshot. Visual Identity preset hanya mendefinisikan identitas visual.

### 3.4 Campaign snapshot

Saat campaign dibuat:

```text
visual_identity_preset_id      = reference ID/key
visual_identity_preset_version = version saat dipilih
visual_overrides_json          = immutable resolved compatibility snapshot
```

Worker dan retry selalu memakai `visual_overrides_json`. Preset reference hanya untuk lineage/display dan pembuatan campaign baru.

## 4. Scope

### 4.1 Termasuk

- schema dan repository user visual identity preset;
- system catalog adapter;
- strict contract dan faceless validator;
- CRUD/clone/archive API;
- centralized resolver;
- Visual Identity Studio pada `/settings/visual-identities`;
- shared selector/editor;
- integrasi pada seluruh campaign creation consumer utama;
- operator preset reference compatibility;
- snapshot dan lineage fields pada campaign utama;
- legacy payload normalization;
- tests, SOT, Dev deployment, release.

### 4.2 Tidak termasuk

- AI `Design with AI` (Fase 3);
- generation/reference image baru (Fase 4);
- visible human face;
- forced migration campaign lama;
- hard delete user preset yang sudah direferensikan;
- perubahan creative/story pipeline di luar visual identity resolution.

## 5. Structured Contract V1

```json
{
  "schema_version": "1",
  "label": "Muslimah Sage Kitchen",
  "description": "Hands-only modest cooking identity",
  "subject": {
    "kind": "human",
    "faceless_mode": "hands_only",
    "demographic_key": "syari_classic",
    "custom_description": "",
    "character_count": 1
  },
  "wardrobe": {
    "mode": "fixed",
    "preset_key": "sage_muted",
    "custom_description": "",
    "primary_color": "#8A9A7B",
    "secondary_color": "#E8E1D4",
    "material": "matte flowing fabric",
    "sleeve_policy": "wrists_covered",
    "accessories": []
  },
  "environment": {
    "preset_key": "nordic_kitchen",
    "custom_description": "",
    "material_palette": ["white marble", "light oak"],
    "props": ["wooden utensils", "small herbs"],
    "background_density": "balanced"
  },
  "lighting": {
    "preset_key": "window_daylight",
    "custom_description": "",
    "color_temperature": "warm_neutral",
    "contrast": "soft"
  },
  "camera": {
    "framing": "forearms_and_hands",
    "perspective": "third_person",
    "lens_look": "natural_50mm",
    "depth_of_field": "shallow",
    "movement": "subtle_handheld"
  },
  "style": {
    "preset_key": "cinematic_realistic",
    "custom_description": "",
    "aspect_ratio": "9:16"
  },
  "guardrails": {
    "face_visibility": "prohibited",
    "reflection_face": "prohibited",
    "extra_people": "prohibited",
    "identity_drift": "prohibited",
    "wardrobe_drift": "prohibited",
    "required_negative_prompts": []
  }
}
```

## 6. Enum dan Invariant

```javascript
subject.kind ∈ ['human', 'blank_face_3d', 'animal', 'mascot_object']
subject.faceless_mode ∈ [
  'hands_only', 'crop_below_neck', 'back_view',
  'silhouette', 'blank_face_3d', 'first_person_pov', 'not_applicable'
]
wardrobe.mode ∈ ['fixed', 'sequential', 'stable_random', 'custom']
camera.framing ∈ ['hands_closeup', 'forearms_and_hands', 'crop_below_neck', 'back_view', 'full_body_blank_face', 'object_or_animal']
```

Untuk `human` dan `blank_face_3d`:

- face visibility selalu prohibited;
- `not_applicable` dilarang;
- reflection face prohibited;
- mode dan framing harus kompatibel;
- wardrobe/sleeve policy harus eksplisit;
- unknown fields di-strip;
- request tidak boleh mematikan guardrail.

Untuk animal/mascot, `faceless_mode = not_applicable` diperbolehkan. Wajah kartun hewan/maskot tidak dianggap human face.

## 7. Legacy Mapping

Central normalizer menerima dua bentuk:

### Legacy input

```json
{
  "character_concept": "faceless",
  "subject_demographic": "syari_classic",
  "wardrobe_style": "sage_muted",
  "lighting_style": "window_daylight",
  "visual_style_preset": "3d_claymation_cozy"
}
```

### Resolved snapshot output

```json
{
  "schema_version": "visual_identity_snapshot_v1",
  "identity_ref": {
    "id": "uuid-or-system-key",
    "key": "muslimah_sage_kitchen",
    "version": 1,
    "source": "user"
  },
  "structured": {},
  "resolved": {
    "subject_prompt": "...",
    "wardrobe_prompt": "...",
    "environment_prompt": "...",
    "lighting_prompt": "...",
    "camera_prompt": "...",
    "style_prompt": "...",
    "negative_prompt": "..."
  },
  "legacy": {
    "character_concept": "faceless",
    "subject_demographic": "syari_classic",
    "wardrobe_style": "custom",
    "wardrobe_style_custom": "...",
    "lighting_style": "custom",
    "lighting_style_custom": "...",
    "visual_style_preset": "..."
  }
}
```

Legacy consumers dapat membaca `legacy`; migrated consumers menggunakan `resolved`. Selama transition, resolver juga boleh menaruh flattened legacy keys di root bila dibutuhkan konsumen aktual.

## 8. Database

### 8.1 Tabel baru

```sql
CREATE TABLE IF NOT EXISTS visual_identity_presets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
  preset_key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, preset_key)
);
```

Tambahkan check/contract application untuk status `active|archived`. Hard delete tidak disediakan di Fase 2.

### 8.2 Campaign lineage columns

Tambahkan secara idempotent ke tabel campaign yang benar-benar menyimpan VSO:

```sql
visual_identity_preset_id TEXT,
visual_identity_preset_version INTEGER
```

Minimal audit dan implementasikan pada:

- `re_campaigns`;
- `pillar_campaigns`;
- tabel campaign Sheets Autopilot yang menyimpan `visual_overrides_json`.

Jika nama tabel aktual berbeda, dokumentasikan pada plan sebelum implementasi. Jangan membuat kolom pada item table bila snapshot diwarisi dari campaign parent.

## 9. API

```text
GET    /api/v2/visual-identities
POST   /api/v2/visual-identities
GET    /api/v2/visual-identities/:id
PUT    /api/v2/visual-identities/:id
DELETE /api/v2/visual-identities/:id       # archive, bukan hard delete
POST   /api/v2/visual-identities/:id/clone
POST   /api/v2/visual-identities/resolve
```

Rules:

- GET memerlukan authenticated user;
- write/clone/archive mengikuti permission `operator_presets` atau permission khusus `visual_identity_manager` bila ditambahkan konsisten ke menu system;
- system preset `id`/key dapat dibaca/clone, tidak dapat PUT/archive;
- response tidak mengandung filesystem path atau secret;
- archive preset tidak memengaruhi campaign snapshot lama;
- resolve endpoint server-side memvalidasi context dan tidak menerima tenant ID.

## 10. UI — Visual Identity Studio

URL:

```text
/settings/visual-identities
```

Layout:

```text
Visual Identity Studio
[System Presets] [My Presets] [Archived]

Card: label, subject kind, faceless mode, palette, environment, version
Actions: Preview | Clone | Edit | Archive
Primary: + New Visual Identity
```

Editor sections:

1. Identity name and description;
2. Subject and faceless mode;
3. Wardrobe and color palette;
4. Environment;
5. Lighting;
6. Camera;
7. Style;
8. locked guardrails;
9. resolved prompt preview.

Preview harus memperlihatkan teks resolved prompt, bukan menghasilkan gambar pada Fase 2.

## 11. Shared Campaign Component

Buat shared component yang menggantikan form VSO terduplikasi secara bertahap:

```jsx
<VisualIdentitySelector
  value={visualIdentityState}
  onChange={setVisualIdentityState}
  allowLegacyCustom
  campaignKind="re_campaign"
/>
```

Component menyediakan:

- toggle enable;
- system/user preset selector;
- concise preview;
- `Customize for this campaign` yang membuat inline draft/snapshot tanpa mengubah preset;
- legacy custom mode;
- faceless compliance badge;
- loading/error/archived-preset states.

## 12. Resolution Priority

```text
1. Existing campaign visual_overrides_json snapshot
2. Inline campaign customization submitted by user
3. Selected user/system visual identity preset
4. Legacy VSO form payload
5. Existing safe default
```

Retry atau regenerate item existing selalu memakai nomor 1.

## 13. Perubahan per File

### 13.1 `[NEW] lib/visual-identity-contract.js`

#### Code Sebelum (Current/Before)

```javascript
// Belum ada structured Visual Identity contract.
```

#### Code Sesudah (Proposed/After)

```javascript
export const VISUAL_IDENTITY_SCHEMA_VERSION = '1';
export const HUMAN_FACELESS_MODES = ['hands_only', 'crop_below_neck', 'back_view', 'silhouette', 'first_person_pov'];

export function validateAndNormalizeVisualIdentity(input) {
  // Allowlist, enum validation, palette normalization,
  // cross-field framing validation, deterministic guardrail enforcement.
}

export function normalizeLegacyVisualOverrides(input) {
  // Map legacy keys to structured V1 without breaking existing payloads.
}
```

### 13.2 `[NEW] lib/visual-identity-system-presets.js`

#### Code Sebelum (Current/Before)

```javascript
// System VSO fragments tersebar di lib/prompts.js.
```

#### Code Sesudah (Proposed/After)

```javascript
export const SYSTEM_VISUAL_IDENTITIES = [
  {
    key: 'hands_only_muslimah_sage_kitchen',
    version: 1,
    label: 'Muslimah Sage Kitchen',
    config: { /* structured V1 config */ }
  }
];

export function listSystemVisualIdentities() {}
export function getSystemVisualIdentity(key) {}
```

System catalog harus mengadaptasi preset existing yang benar-benar dipakai agar key legacy tetap dikenal.

### 13.3 `[NEW] lib/visual-identity-repository.js`

#### Code Sebelum (Current/Before)

```javascript
// User visual identities belum tersimpan di database.
```

#### Code Sesudah (Proposed/After)

```javascript
export async function listVisualIdentities({ status = 'active' } = {}) {}
export async function getVisualIdentity(idOrKey) {}
export async function createVisualIdentity(input, actor) {}
export async function updateVisualIdentity(id, input, actor) {}
export async function archiveVisualIdentity(id, actor) {}
export async function cloneVisualIdentity(idOrSystemKey, overrides, actor) {}
```

Seluruh query tenant-scoped melalui context existing. Update menaikkan `version` secara atomik.

### 13.4 `[MODIFY] lib/visual-override-resolver.js`

#### Code Sebelum (Current/Before)

```javascript
export function resolveVisualOverrides({ visualOverrides = {}, itemIndex, stableSeed, rowOverride }) {
  const wardrobe = resolveWardrobe(...);
  return { ...visualOverrides, wardrobe_style: 'custom', wardrobe_style_custom: wardrobe.description };
}
```

#### Code Sesudah (Proposed/After)

```javascript
export async function resolveVisualIdentity({ presetRef, inlineConfig, legacyOverrides, itemContext }) {
  const source = await loadAndNormalizeSource({ presetRef, inlineConfig, legacyOverrides });
  const structured = validateAndNormalizeVisualIdentity(source.config);
  return buildImmutableVisualIdentitySnapshot(structured, source, itemContext);
}

export function resolveVisualIdentitySnapshot(snapshot, itemContext) {
  // Pure/deterministic resolution for workers and retries.
}

export function resolveVisualOverrides(args) {
  // Backward-compatible wrapper during migration.
}
```

### 13.5 `[MODIFY] lib/prompts.js`

#### Code Sebelum (Current/Before)

```javascript
const targetCharacter = DEMOGRAPHIC_PRESETS[vo.subject_demographic] || 'a graceful Muslimah';
const targetWardrobe = WARDROBE_PRESETS[vo.wardrobe_style] || 'modest clothing';
```

#### Code Sesudah (Proposed/After)

```javascript
const resolved = getResolvedVisualPromptParts(config.visual_overrides);

const targetCharacter = resolved.subject_prompt;
const targetWardrobe = resolved.wardrobe_prompt;
const targetEnvironment = resolved.environment_prompt;
const targetLighting = resolved.lighting_prompt;
const targetCamera = resolved.camera_prompt;
const negativePrompt = resolved.negative_prompt;
```

Constants existing boleh dipertahankan sementara sebagai system catalog vocabulary, tetapi prompt builders tidak boleh mengulang lookup logic.

### 13.6 `[MODIFY] lib/db-pg.js`

#### Code Sebelum (Current/Before)

```javascript
// Tidak ada tabel visual_identity_presets atau lineage columns.
```

#### Code Sesudah (Proposed/After)

```javascript
const migrateVisualIdentityFoundation = async () => {
  // Advisory lock.
  // CREATE TABLE IF NOT EXISTS visual_identity_presets.
  // CREATE tenant/key and status indexes.
  // ADD COLUMN IF NOT EXISTS lineage fields ke campaign tables aktual.
};
```

Migration wajib idempotent, non-destructive, dan menggunakan advisory lock.

### 13.7 `[MODIFY] lib/db.js`

#### Code Sebelum (Current/Before)

```javascript
// Campaign CRUD hanya meneruskan visual_overrides_json.
```

#### Code Sesudah (Proposed/After)

```javascript
// Campaign create/update allowlist meneruskan:
visual_identity_preset_id,
visual_identity_preset_version,
visual_overrides_json
```

Jangan mengubah arti `visual_overrides_json`: field tetap snapshot yang digunakan worker.

### 13.8 `[NEW] app/api/v2/visual-identities/route.js` dan dynamic routes

#### Code Sebelum (Current/Before)

```javascript
// API belum ada.
```

#### Code Sesudah (Proposed/After)

```javascript
export const GET = withTenantContext(async request => {
  return Response.json({ success: true, data: await listVisualIdentityCatalog() });
});

export const POST = withTenantContext(async (request, _params, user) => {
  requireVisualIdentityWrite(user);
  return Response.json({ success: true, data: await createVisualIdentity(await request.json(), user) }, { status: 201 });
});
```

Tambahkan `[id]/route.js`, `[id]/clone/route.js`, dan `resolve/route.js` sesuai kontrak API.

### 13.9 `[NEW] app/settings/visual-identities/page.js`

#### Code Sebelum (Current/Before)

```javascript
// Visual Identity Studio belum ada.
```

#### Code Sesudah (Proposed/After)

```jsx
'use client';

export default function VisualIdentityStudioPage() {
  // Catalog tabs, create/edit/clone/archive,
  // structured editor, guardrail lock display, prompt preview.
}
```

### 13.10 `[NEW] app/components/VisualIdentitySelector.js`

#### Code Sebelum (Current/Before)

```javascript
// VSO state dan controls diduplikasi pada setiap campaign form.
```

#### Code Sesudah (Proposed/After)

```jsx
export default function VisualIdentitySelector({ value, onChange, allowLegacyCustom = true }) {
  // Fetch catalog, select preset, preview, inline customization,
  // emit preset reference + resolved/legacy-compatible payload intent.
}
```

### 13.11 `[MODIFY] app/components/Sidebar.js`

#### Code Sebelum (Current/Before)

```javascript
{ label: 'Preset Manager', href: '/settings/presets', icon: '🎛️' },
{ label: 'Universe Manager', href: '/settings/universes', icon: '🏰' },
```

#### Code Sesudah (Proposed/After)

```javascript
{ label: 'Preset Manager', href: '/settings/presets', icon: '🎛️' },
{ label: 'Visual Identity', href: '/settings/visual-identities', icon: '🎨' },
{ label: 'Universe Manager', href: '/settings/universes', icon: '🏰' },
```

Tambahkan permission mapping konsisten. Reuse `operator_presets` pada MVP bila menambah permission baru akan memperluas scope tenant admin secara tidak proporsional; dokumentasikan keputusan.

### 13.12 `[MODIFY] Campaign creation consumers`

Target:

```text
app/re-campaigns/page.js
app/pillar-campaigns/page.js
app/sheets-autopilot/page.js
app/components/ImportPlannerModal.js
app/multiplier-lab/page.js
app/recipe-labs/page.js
```

#### Code Sebelum (Current/Before)

```jsx
const [subjectDemographic, setSubjectDemographic] = useState('syari_classic');
const [wardrobeStyle, setWardrobeStyle] = useState('amber_terracotta');
// Repeated dropdowns...

visual_overrides_json: JSON.stringify({
  character_concept,
  subject_demographic,
  wardrobe_style,
  lighting_style
})
```

#### Code Sesudah (Proposed/After)

```jsx
const [visualIdentity, setVisualIdentity] = useState(createEmptyVisualIdentitySelection());

<VisualIdentitySelector value={visualIdentity} onChange={setVisualIdentity} />
```

```javascript
const resolvedIdentity = await resolveVisualIdentityForSubmission(visualIdentity);

visual_identity_preset_id: resolvedIdentity.identity_ref?.id || null,
visual_identity_preset_version: resolvedIdentity.identity_ref?.version || null,
visual_overrides_json: resolvedIdentity.snapshot
  ? JSON.stringify(resolvedIdentity.snapshot)
  : null
```

Jika client tidak boleh menjadi resolver otoritatif, kirim selection intent dan lakukan resolution di API route. Server output-lah yang disimpan.

### 13.13 `[MODIFY] Campaign APIs`

Target minimal:

```text
app/api/v2/re-campaigns/route.js
app/api/v2/re-campaigns/bulk/route.js
app/api/v2/pillar-campaigns/route.js
app/api/v2/pillar-campaigns/bulk/route.js
app/api/sheets-autopilot/route.js
```

#### Code Sebelum (Current/Before)

```javascript
visual_overrides_json: visual_overrides_json || null
```

#### Code Sesudah (Proposed/After)

```javascript
const identity = await resolveVisualIdentitySubmission({
  preset_id: body.visual_identity_preset_id,
  inline_config: body.visual_identity_inline_config,
  legacy_overrides_json: body.visual_overrides_json
});

visual_identity_preset_id: identity.ref?.id || null,
visual_identity_preset_version: identity.ref?.version || null,
visual_overrides_json: identity.snapshot ? JSON.stringify(identity.snapshot) : null
```

API adalah authoritative resolution boundary.

### 13.14 `[MODIFY] Worker/prompt consumers`

Target:

```text
lib/scheduler-processors.js
lib/sheets-autopilot-worker.js
lib/pillar-campaign-ingest.js
lib/culinary-sequence-engine.js
lib/export-builder.js
app/api/v2/pillar-campaigns/items/[itemId]/regenerate-t2i/route.js
```

#### Code Sebelum (Current/Before)

```javascript
const targetCharacter = DEMOGRAPHIC_PRESETS[visualOverrides.subject_demographic];
const targetWardrobe = WARDROBE_PRESETS[visualOverrides.wardrobe_style];
```

#### Code Sesudah (Proposed/After)

```javascript
const visualIdentity = resolveVisualIdentitySnapshot(
  parseVisualOverrides(campaign.visual_overrides_json),
  itemContext
);

// Prompt/export/regenerate uses visualIdentity.resolved.*.
```

Fallback legacy normalization wajib tersedia sehingga campaign lama tetap berjalan.

### 13.15 `[MODIFY] lib/operator-presets.js`, `lib/operator-content-contract.js`, dan `app/settings/presets/page.js`

#### Code Sebelum (Current/Before)

```javascript
visual_swap: {
  is_vso_active: true,
  subject_demographic: 'syari_classic',
  wardrobe_style: 'sequential'
}
```

#### Code Sesudah (Proposed/After)

```javascript
visual_swap: {
  is_vso_active: true,
  visual_identity_preset_key: 'hands_only_muslimah_sage_kitchen',
  inline_overrides: null
}
```

Normalizer tetap menerima legacy `visual_swap`. Preset Manager memakai shared selector/editor dan menyimpan reference intent, bukan campaign snapshot.

### 13.16 `[NEW] scripts/test-visual-identity-foundation.mjs`

#### Code Sebelum (Current/Before)

```javascript
// Belum ada test contract/resolver khusus Visual Identity.
```

#### Code Sesudah (Proposed/After)

```javascript
// Contract, legacy mapping, deterministic resolution, faceless enforcement,
// system/user catalog, versioning, snapshot immutability, archive behavior.
```

### 13.17 `[MODIFY] package.json`

#### Code Sebelum (Current/Before)

```json
"test:ai-universe-builder": "node scripts/test-ai-universe-builder.mjs"
```

#### Code Sesudah (Proposed/After)

```json
"test:ai-universe-builder": "node scripts/test-ai-universe-builder.mjs",
"test:visual-identity": "node scripts/test-visual-identity-foundation.mjs"
```

### 13.18 `[NEW] sot/menus/visual-identity-studio.md` dan `[MODIFY] sot/global/vso-engine.md`

#### Code Sebelum (Current/Before)

```markdown
VSO dijelaskan sebagai preset mapper hardcoded.
```

#### Code Sesudah (Proposed/After)

```markdown
Visual Identity Studio mengelola system/user presets, structured contract,
faceless invariant, centralized resolution, campaign reference, dan snapshot compatibility.
```

## 14. Migration Strategy

1. Tambahkan tabel dan nullable lineage columns.
2. Deploy contract/resolver dengan legacy support.
3. Jangan backfill campaign lama.
4. Campaign baru menyimpan snapshot V1.
5. Worker menerima snapshot V1 maupun legacy JSON.
6. Migrasikan consumer UI satu per satu.
7. Setelah semua consumer stabil, direct constant lookup ditandai deprecated tetapi belum dihapus pada fase ini.

Rollback aplikasi tetap memungkinkan karena `visual_overrides_json` baru membawa legacy-compatible section/root keys.

## 15. Test Matrix

### Contract/resolver

- semua subject kind valid;
- semua human faceless mode valid;
- visible face/invalid framing ditolak;
- request tidak dapat mengubah locked guardrails;
- hex palette dan arrays dinormalisasi;
- unknown fields di-strip;
- legacy human, stylized 3D, mascot, random/sequential wardrobe mapping;
- stable random deterministic berdasarkan seed;
- snapshot V1 idempotent saat di-resolve ulang.

### Repository/API

- list merges system + tenant user presets;
- cross-tenant read/update/archive ditolak;
- system preset immutable;
- clone system/user sukses;
- duplicate key conflict;
- update increments version;
- archive hides from active selector tetapi detail/snapshot lama tetap dapat dibaca;
- tenant ID body override diabaikan;
- resolve invalid config menghasilkan 400/422.

### Campaign compatibility

- legacy RE/Pillar/Sheets campaign tetap diproses;
- new preset selection menyimpan ID/version/snapshot;
- retry memakai snapshot lama setelah preset diubah;
- archive preset tidak merusak campaign existing;
- inline customization tidak mengubah preset;
- bulk routes menerapkan snapshot sama per campaign;
- item regenerate memakai parent snapshot;
- exports menampilkan identity label/ref dan resolved values.

### UI

- system/my/archived tabs;
- create/edit/clone/archive;
- locked guardrails terlihat;
- preview resolved prompt;
- selector loading/error/empty/archived;
- preset and legacy custom flows;
- responsive dan keyboard basics;
- semua consumer utama menghasilkan payload server-resolved.

### Regression commands

```bash
npm run test:visual-identity
npm run test:operator-presets
npm run test:operator-content
npm run test:content-planner
npm run test:ai-universe-builder
node scripts/test-opc-integrity.mjs
npm run build
```

Tambahkan targeted integration tests sesuai database dev/test. Jangan memanggil provider berbayar.

## 16. Delivery Gates

### Gate 2A — Foundation complete

- contract, schema, repository, system catalog, resolver, APIs;
- legacy tests lulus;
- belum wajib mengubah seluruh consumer UI.

### Gate 2B — Consumer migration complete

- Studio dan shared selector selesai;
- seluruh consumer utama memakai API resolver;
- workers membaca snapshot V1 dan legacy;
- build dan Dev smoke test lulus.

Release patch boleh dilakukan per gate bila repository SOP dan risiko perubahan mengharuskannya. Jangan menandai Fase 2 selesai hanya setelah Gate 2A.

## 17. Deployment dan Release

Setelah test/build berhasil:

```text
Target          : Dev Mac Mini only
Folder          : ~/maknaflow-dev
UI/API          : 5020 / 7020
Schema          : dev
PGPOOL_MAX      : 3
Deploy command  : npm run deploy:macmini-dev
```

Ikuti zero-spam mode dan jangan deploy Staging/Production tanpa instruksi eksplisit.

Smoke test:

1. create human hands-only preset;
2. clone system preset;
3. create mascot preset;
4. use preset in RE and OPC/Pillar;
5. edit preset, verify old campaign snapshot unchanged;
6. archive preset, retry old campaign succeeds;
7. verify legacy campaign succeeds;
8. verify visible-human-face config rejected.

Release akhir:

```bash
npm run release-non-interactive -- --type minor --title "Visual Identity Foundation" --points "Tambah Visual Identity Studio dan user presets|Pusatkan resolver visual dan faceless guardrail|Tambah immutable campaign snapshot dan legacy compatibility"
```

Gunakan `minor` karena memperkenalkan kapabilitas user-facing dan schema baru. Jika maintainer memilih patch sesuai convention repository, dokumentasikan keputusan sebelum release.

## 18. Definition of Done

- Gate 2A dan 2B selesai;
- seluruh acceptance/test matrix relevan lulus;
- tidak ada visible-face escape path untuk human identity;
- campaign lama dan operator preset lama tetap berjalan;
- campaign baru menyimpan reference dan immutable snapshot;
- workers tidak bergantung pada preset live untuk retry;
- SOT diperbarui;
- Dev smoke test dan release SOP selesai.

## Execution Task List

- [x] 1. Baca `AGENTS.md`, master roadmap, Next.js local docs, SOT VSO, dan seluruh target file aktual.
- [x] 2. Jalankan `git status --short` serta baseline tests operator preset/content, OPC, RE, planner, dan build relevan.
- [x] 3. Inventarisasi tabel campaign aktual dan dokumentasikan final lineage column targets pada plan ini.
- [x] 4. Implementasikan structured contract, enum, normalization, legacy mapping, dan deterministic faceless guardrail.
- [x] 5. Implementasikan system visual identity catalog dengan legacy key compatibility.
- [x] 6. Tambahkan idempotent database migration untuk user presets dan nullable campaign lineage columns.
- [x] 7. Implementasikan tenant-scoped repository, version increment, clone, dan archive semantics.
- [x] 8. Implementasikan catalog CRUD/clone/archive/resolve APIs dan authorization.
- [x] 9. Refactor centralized resolver untuk structured snapshot V1 dan legacy wrapper.
- [x] 10. Tambahkan contract/repository/API tests; selesaikan Gate 2A dan catat bukti test.
- [ ] 11. Migrasikan prompt builders dan worker consumers ke snapshot resolver dengan legacy fallback.
- [ ] 12. Implementasikan Visual Identity Studio dan navigation/permission mapping.
- [ ] 13. Implementasikan shared Visual Identity Selector dengan preset, inline customization, dan legacy mode.
- [ ] 14. Integrasikan selector dan server resolution ke RE Campaign create/bulk.
- [ ] 15. Integrasikan selector dan server resolution ke Pillar/OPC create/bulk serta Import Planner.
- [ ] 16. Integrasikan selector dan server resolution ke Sheets Autopilot, Multiplier Lab, dan Recipe Labs.
- [ ] 17. Integrasikan operator presets dan Preset Manager ke visual identity reference dengan legacy compatibility.
- [ ] 18. Perbarui export/detail/regenerate consumers agar memakai snapshot parent dan menampilkan lineage.
- [ ] 19. Tambahkan integration/regression tests untuk snapshot immutability, retry, archive, bulk, dan legacy campaign.
- [ ] 20. Perbarui SOT Visual Identity Studio dan VSO Engine serta tandai direct constant lookup sebagai deprecated.
- [ ] 21. Jalankan seluruh targeted tests dan production build; perbaiki regression terkait.
- [ ] 22. Deploy hanya ke Dev Mac Mini dan selesaikan seluruh smoke test Gate 2B.
- [ ] 23. Jalankan release non-interaktif dan verifikasi version, changelog, commit, tag, branch, dan push.

> Setelah menyelesaikan setiap task, segera ubah checkbox menjadi `[x]`. Jangan menandai task selesai tanpa kode dan bukti verifikasi. Bila target file/schema berbeda dari asumsi plan, perbarui bagian terkait sebelum implementasi berlanjut.

