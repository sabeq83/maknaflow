# Implementation Plan — Fase 1 AI Universe Builder MVP

## 1. Ringkasan

Fase ini menambahkan alur **Build Universe with AI** pada Universe Manager. Pengguna mengisi creative brief ringkas, MAKNA Flow meminta Gemini menghasilkan satu draft universe terstruktur dalam satu call, pengguna meninjau dan mengedit hasilnya, lalu aplikasi menyimpan profile, karakter, dan lokasi secara atomik ke database.

Fitur existing tetap dipertahankan:

- `Create from Preset` tetap tersedia;
- `Start from Blank` diganti label menjadi `Manual Setup`, tetapi perilakunya tetap kompatibel;
- universe yang disimpan tetap memakai tabel `universe_profiles`, `universe_characters`, dan `universe_locations`;
- universe hasil AI langsung dapat dipilih oleh Content Planner dan campaign existing tanpa integration layer baru.

## 2. Outcome dan Acceptance Criteria

Fase 1 dianggap selesai bila:

1. Modal `+ New Universe` menampilkan `Build with AI` sebagai pilihan utama, diikuti `Use a Preset` dan `Manual Setup`.
2. Wizard AI memiliki empat tahap: `Creative Brief`, `Generating`, `Review & Refine`, dan `Save & Activate`.
3. Satu call Gemini menghasilkan profile, characters, locations, rules, negative prompts, dan content pillars dalam JSON terstruktur.
4. Respons Gemini tidak pernah langsung disimpan sebagai universe aktif.
5. Pengguna dapat mengedit draft profile, karakter, dan lokasi sebelum menyimpan.
6. Pengguna dapat menghapus atau menambahkan karakter/lokasi pada draft sebelum menyimpan.
7. Tombol `Regenerate Draft` mengirim brief terbaru kembali ke generator; refinement percakapan parsial tidak termasuk MVP.
8. Server memvalidasi dan menormalisasi brief serta draft; UI bukan boundary keamanan.
9. Penyimpanan profile, seluruh karakter, dan seluruh lokasi berjalan dalam satu transaksi database.
10. Kegagalan satu insert me-roll back seluruh universe sehingga tidak ada profile parsial.
11. Tenant ID selalu berasal dari `withTenantContext()`/query interception, bukan request body.
12. Universe bertipe `human` hanya boleh memakai kebijakan faceless yang valid.
13. Slug dan seluruh `character_key`/`location_key` unik setelah normalisasi.
14. Universe hasil AI muncul di daftar Universe Manager dan dapat dibaca oleh Content Planner/campaign existing.
15. Alur preset dan manual existing tetap lulus regression test.

## 3. Batas Scope

### 3.1 Termasuk dalam Fase 1

- AI Universe Builder wizard;
- satu creative-generation call Gemini per generate/regenerate;
- structured JSON contract;
- deterministic validation, normalization, dan faceless guardrail;
- editable review screen;
- atomic save;
- metadata asal AI di dalam `rules_json.ai_origin`;
- API, service, contract tests, UI states, dokumentasi SOT.

### 3.2 Tidak termasuk dalam Fase 1

- Visual Identity Studio atau user-defined VSO presets;
- AI chat/refinement per karakter atau per lokasi;
- generate/upload reference image;
- penyimpanan draft AI ke database;
- background job/queue untuk generation;
- multi-model comparison;
- perubahan pada Content Planner atau campaign selain regression verification;
- deployment Production.

## 4. Keputusan Arsitektur

### 4.1 Alur data

```text
Universe Manager client
  → POST /api/v2/universe-ai/generate
  → validate creative brief
  → build single-pass prompt
  → Gemini JSON response
  → parse + normalize + validate + enforce guardrails
  → return draft to client only
  → user reviews/edits
  → POST /api/v2/universe-ai/instantiate
  → revalidate complete draft
  → check tenant-scoped slug uniqueness
  → atomic insert profile + characters + locations
  → refresh universe manifest cache
  → return new universe ID
```

### 4.2 Draft tidak disimpan sebelum approval

Draft disimpan di React state. Ini mencegah database dipenuhi generation gagal/ditinggalkan dan menjaga prinsip bahwa AI hanya mengusulkan. Refresh browser memang menghapus draft pada MVP; autosave draft adalah fase terpisah.

### 4.3 Tidak memerlukan migrasi database

Metadata asal generasi disimpan kompatibel di `universe_profiles.rules_json`:

```json
{
  "ai_origin": {
    "source": "ai_universe_builder",
    "prompt_version": "universe_builder_v1",
    "model": "gemini-3.6-flash",
    "generated_at": "2026-08-20T00:00:00.000Z"
  }
}
```

Jangan menyimpan API key, prompt mentah, raw Gemini response, atau data tenant sensitif ke metadata tersebut.

### 4.4 Pemisahan tanggung jawab

- Route handler: auth, parsing request, pemetaan error HTTP.
- `lib/universe-ai-contract.js`: enum, batas panjang, normalisasi, validation error.
- `lib/universe-ai-builder.js`: prompt, Gemini call, parsing, deterministic post-processing.
- `lib/universe-ai-repository.js`: atomic persistence dan uniqueness check.
- Client modal: wizard state dan editable review; tidak memiliki Gemini/API key logic.

### 4.5 Next.js 16.2.5

Ikuti dokumentasi lokal `node_modules/next/dist/docs/`. Route handler menggunakan Web `Request`/`Response`, mutation `POST` tidak di-cache, dan seluruh Gemini/database work tetap server-only. `app/settings/universes/page.js` sudah merupakan Client Component sehingga wizard interaktif dapat dipecah menjadi child Client Component.

## 5. Kontrak Creative Brief

### 5.1 Request generate

```json
{
  "name": "Kitchen Kin",
  "purpose": "Konten edukasi memasak praktis untuk produk dapur",
  "knowledge_domain": "kitchen",
  "universe_type": "mascot_object",
  "target_audience": "Ibu muda Indonesia",
  "premise_seed": "Peralatan dapur hidup dan saling membantu",
  "tone": "warm, witty, premium",
  "visual_direction": "handcrafted 3D clay, warm earth tones",
  "character_count": 3,
  "location_count": 3,
  "content_pillars": ["Tips Memasak", "Kitchen Organization"],
  "special_constraints": "Tidak menampilkan manusia",
  "historical_period": null,
  "freeform_brief": "Universe terasa lokal, hangat, dan tidak kekanak-kanakan."
}
```

### 5.2 Enum dan batas

```javascript
knowledge_domain ∈ [
  'general', 'pet_supplies', 'food_culinary', 'history',
  'islamic_history', 'kitchen', 'home_improvement', 'herbal'
]

universe_type ∈ ['animal', 'mascot_object', 'human']
character_count ∈ 1..5
location_count ∈ 1..5
content_pillars.length ∈ 0..8
name.length ∈ 3..100
freeform_brief.length <= 3000
```

UI boleh menampilkan `Faceless 3D Characters` sebagai pilihan kreatif terpisah, tetapi payload dinormalisasi ke `universe_type: "human"` dengan visual style dan depiction policy faceless yang sesuai.

### 5.3 Field kondisional

- `human` wajib memiliki `depiction_policy` faceless hasil server.
- `historical_period` hanya aktif untuk domain `history`/`islamic_history` atau universe human historis.
- `mascot_object` dan `animal` default `human_presence: none` kecuali brief secara eksplisit membutuhkan tangan faceless; MVP sebaiknya mempertahankan `none`.

## 6. Kontrak Draft Gemini

Gemini wajib mengembalikan satu object JSON:

```json
{
  "profile": {
    "name": "Kitchen Kin",
    "slug": "kitchen-kin",
    "premise": "...",
    "tone": "...",
    "knowledge_domain": "kitchen",
    "universe_type": "mascot_object",
    "human_presence": "none",
    "depiction_policy": null,
    "historical_period": null,
    "default_visual_style": "...",
    "default_aspect_ratio": "9:16",
    "default_scene_count": 7,
    "default_scene_duration": 8,
    "default_story_template": "problem_solution_7beat",
    "cta_personality": "...",
    "default_pillars_json": ["..."],
    "rules_json": {},
    "negative_prompts_json": ["..."]
  },
  "characters": [
    {
      "name": "Piko",
      "character_key": "piko",
      "species": "rice cooker mascot",
      "breed": null,
      "body_shape": "...",
      "fur_color": null,
      "eye_color": "...",
      "wardrobe": "...",
      "personality": "...",
      "movement_style": "...",
      "relative_size": "medium",
      "role": "main_character",
      "depiction_mode": "normal",
      "reference_type": "identity",
      "historical_period": null,
      "canonical_prompt": "...",
      "forbidden_changes_json": ["..."]
    }
  ],
  "locations": [
    {
      "name": "Warm Kitchen",
      "location_key": "warm_kitchen",
      "visual_description": "...",
      "lighting_default": "...",
      "props": "...",
      "historical_period": null,
      "reference_type": "location"
    }
  ]
}
```

Jumlah karakter dan lokasi harus sama dengan brief. Server tidak boleh diam-diam menerima array kosong atau jumlah berlebih.

## 7. Prompt Gemini Single-Pass

Prompt builder wajib memiliki versi eksplisit `UNIVERSE_BUILDER_PROMPT_VERSION = 'universe_builder_v1'` dan memuat:

1. role sebagai world-building director dan production prompt architect;
2. creative brief ter-serialize;
3. enum dan exact JSON schema;
4. karakter harus distinctive dan production-ready;
5. canonical prompt harus mengunci bentuk, material/fur, palette, wardrobe, dan immutable identity traits;
6. lokasi harus konsisten dengan visual bible dan cukup berbeda satu sama lain;
7. rules dan negative prompts harus konkret, bukan slogan generik;
8. larangan memasukkan markdown atau komentar di luar JSON;
9. larangan wajah terlihat untuk seluruh human universe;
10. larangan tokoh historis/agama sensitif digambarkan berwajah;
11. output dalam Bahasa Indonesia untuk copy naratif, sedangkan canonical visual prompt boleh memakai English visual terminology;
12. tidak membuat klaim produk/medis karena generator ini hanya membangun universe.

Gemini membantu kreativitas, tetapi server tetap menambahkan guardrail wajib setelah parsing.

## 8. Guardrail Faceless Deterministik

Untuk `profile.universe_type === 'human'`:

- `human_presence` dipaksa menjadi `allowed`;
- `depiction_policy` tidak boleh kosong;
- setiap karakter hanya boleh memakai `faceless`, `back_view`, `silhouette`, atau `environment_only`;
- mode `normal` ditolak, bukan diperbaiki diam-diam saat save;
- `negative_prompts_json` wajib memuat larangan visible face, facial features, reflection showing face, dan identity drift;
- `canonical_prompt` wajib memuat instruksi faceless yang sesuai mode;
- historical/islamic-history universe mendapat anti-anachronism rule;
- request tidak boleh menyediakan flag untuk mematikan guardrail.

Untuk tipe non-human, enum depiction existing tetap digunakan dan tidak dipaksa faceless.

## 9. UX dan State Machine

### 9.1 Starter choice

```text
Build with AI (Recommended) | Use a Preset | Manual Setup
```

### 9.2 Wizard steps

```text
brief → generating → review → saving → success
                    ↘ error ↗
```

### 9.3 Creative Brief

Field minimum yang visible:

- Universe Name;
- Purpose;
- Knowledge Domain;
- Universe Type;
- Target Audience;
- Premise/Idea;
- Tone;
- Visual Direction;
- Character Count;
- Location Count;
- Content Pillars tag input;
- Special Constraints;
- Historical Period conditional;
- Freeform Brief.

Tombol utama: `Generate Universe Draft`.

### 9.4 Generating

Tampilkan progress copy yang jujur, bukan persentase palsu:

```text
Gemini sedang menyusun world identity, characters, locations, dan continuity rules…
```

Disable duplicate submit. Sediakan cancel UI hanya untuk menutup modal; request server yang sudah berjalan tidak dijanjikan benar-benar dibatalkan pada MVP.

### 9.5 Review

Gunakan card/accordion:

- Universe Profile;
- Characters;
- Locations;
- Story & Continuity Rules;
- Content Pillars & Negative Prompts.

Pengguna dapat mengubah seluruh field yang akan disimpan, kecuali metadata `ai_origin`. Tampilkan warning faceless pada universe human. Tombol:

- `Back to Brief`;
- `Regenerate Draft`;
- `Save Universe`.

### 9.6 Error states

Bedakan pesan:

- `400`: brief/draft tidak valid;
- `401/403`: akses tidak sah;
- `409`: slug sudah digunakan;
- `422`: Gemini output dapat diparse tetapi gagal contract/guardrail;
- `429/503`: Gemini/quota sementara, dapat retry;
- `500`: unexpected persistence/generation failure.

Jangan menampilkan raw stack trace, API key, atau raw provider response di UI.

## 10. API Contract

### 10.1 Generate draft

```text
POST /api/v2/universe-ai/generate
Content-Type: application/json
```

Success:

```json
{
  "success": true,
  "data": {
    "draft": {},
    "meta": {
      "prompt_version": "universe_builder_v1",
      "model": "gemini-3.6-flash"
    }
  }
}
```

Route wajib memakai `withTenantContext`, body size/field length validation, dan `dynamic = 'force-dynamic'`.

### 10.2 Instantiate approved draft

```text
POST /api/v2/universe-ai/instantiate
Content-Type: application/json
```

Request:

```json
{
  "draft": {},
  "generation_meta": {
    "prompt_version": "universe_builder_v1",
    "model": "gemini-3.6-flash"
  }
}
```

Server mengabaikan metadata yang tidak di-allowlist dan menghasilkan `generated_at` sendiri.

Success:

```json
{
  "success": true,
  "id": "uuid",
  "slug": "kitchen-kin"
}
```

## 11. Perubahan per File

### 11.1 `[NEW] lib/universe-ai-contract.js`

#### Code Sebelum (Current/Before)

```javascript
// File belum ada. Validasi universe AI belum memiliki kontrak terpusat.
```

#### Code Sesudah (Proposed/After)

```javascript
export const UNIVERSE_BUILDER_PROMPT_VERSION = 'universe_builder_v1';
export const UNIVERSE_TYPES = ['animal', 'mascot_object', 'human'];
export const FACELESS_MODES = ['faceless', 'back_view', 'silhouette', 'environment_only'];

export class UniverseAiValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'UniverseAiValidationError';
    this.details = details;
  }
}

export function validateUniverseBrief(input) {
  // Allowlist fields, validate enums/counts/lengths, return normalized brief.
}

export function validateAndNormalizeUniverseDraft(input, options = {}) {
  // Validate exact profile/character/location contract, normalize keys,
  // ensure unique keys, enforce counts and deterministic faceless rules.
}
```

### 11.2 `[NEW] lib/universe-ai-builder.js`

#### Code Sebelum (Current/Before)

```javascript
// File belum ada. Universe Manager belum memanggil Gemini.
```

#### Code Sesudah (Proposed/After)

```javascript
import { getGeminiModel, GEMINI_MODELS } from './gemini.js';
import { parseGeminiJSON } from './json-parser.js';
import {
  UNIVERSE_BUILDER_PROMPT_VERSION,
  validateUniverseBrief,
  validateAndNormalizeUniverseDraft
} from './universe-ai-contract.js';

export function buildUniverseGenerationPrompt(brief) {
  return `...single-pass schema-bound universe builder prompt...`;
}

export async function generateUniverseDraft(input) {
  const brief = validateUniverseBrief(input);
  const model = await getGeminiModel();
  const result = await model.generateContent(buildUniverseGenerationPrompt(brief));
  const parsed = parseGeminiJSON(result.response.text());
  const draft = validateAndNormalizeUniverseDraft(parsed, {
    expectedCharacterCount: brief.character_count,
    expectedLocationCount: brief.location_count
  });
  return {
    draft,
    meta: {
      prompt_version: UNIVERSE_BUILDER_PROMPT_VERSION,
      model: GEMINI_MODELS.PRIMARY
    }
  };
}
```

Jangan memakai fallback object generik dari `parseGeminiJSON` sebagai draft valid; contract validator harus menolaknya bila `profile`, `characters`, atau `locations` hilang.

### 11.3 `[NEW] lib/universe-ai-repository.js`

#### Code Sebelum (Current/Before)

```javascript
// File belum ada. Preset instantiate melakukan SQL transaction di route handler.
```

#### Code Sesudah (Proposed/After)

```javascript
import { withPgTransaction } from './db-pg.js';
import { v4 as uuidv4 } from 'uuid';

export async function instantiateAiUniverse(draft, generationMeta) {
  return withPgTransaction(async client => {
    // Revalidate draft before persistence.
    // Check tenant-scoped slug uniqueness within the same transaction.
    // Insert universe_profiles, universe_characters, universe_locations.
    // Merge immutable ai_origin into rules_json.
    // Return new universe ID and slug.
  });
}
```

Repository wajib mengikuti mekanisme tenant context existing. Jangan menerima atau menyisipkan `tenant_id` dari body. Gunakan pola transaction yang telah terbukti pada preset instantiate, tetapi pindahkan business logic keluar dari route.

### 11.4 `[NEW] app/api/v2/universe-ai/generate/route.js`

#### Code Sebelum (Current/Before)

```javascript
// Endpoint belum ada.
```

#### Code Sesudah (Proposed/After)

```javascript
import { withTenantContext } from '@/lib/auth';
import { generateUniverseDraft } from '@/lib/universe-ai-builder';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async request => {
  try {
    const body = await request.json();
    const data = await generateUniverseDraft(body);
    return Response.json({ success: true, data });
  } catch (error) {
    return mapUniverseAiError(error);
  }
});
```

### 11.5 `[NEW] app/api/v2/universe-ai/instantiate/route.js`

#### Code Sebelum (Current/Before)

```javascript
// Endpoint belum ada.
```

#### Code Sesudah (Proposed/After)

```javascript
import { withTenantContext } from '@/lib/auth';
import { validateAndNormalizeUniverseDraft } from '@/lib/universe-ai-contract';
import { instantiateAiUniverse } from '@/lib/universe-ai-repository';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async request => {
  try {
    const body = await request.json();
    const draft = validateAndNormalizeUniverseDraft(body.draft);
    const created = await instantiateAiUniverse(draft, body.generation_meta);
    return Response.json({ success: true, ...created }, { status: 201 });
  } catch (error) {
    return mapUniverseAiError(error);
  }
});
```

### 11.6 `[NEW] app/components/AiUniverseBuilderModal.js`

#### Code Sebelum (Current/Before)

```javascript
// File belum ada. Starter picker dan seluruh form saat ini inline di page.js.
```

#### Code Sesudah (Proposed/After)

```jsx
'use client';

export default function AiUniverseBuilderModal({ onClose, onCreated }) {
  const [step, setStep] = useState('brief');
  const [brief, setBrief] = useState(initialBrief);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');

  async function generateDraft() {
    setStep('generating');
    // POST /api/v2/universe-ai/generate
    // On success: setDraft and setStep('review').
  }

  async function saveUniverse() {
    setStep('saving');
    // POST /api/v2/universe-ai/instantiate with reviewed draft.
    // On success: notify parent and close.
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="ai-universe-title">
      {/* Brief form, honest loading state, editable review, errors, save */}
    </div>
  );
}
```

Gunakan responsive layout, label eksplisit, focus management dasar, tombol disabled saat request, dan jangan mengandalkan warna saja untuk menyatakan error/status.

### 11.7 `[MODIFY] app/settings/universes/page.js`

#### Code Sebelum (Current/Before)

```jsx
{pickerMode === 'choice' && (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
    <button onClick={() => setPickerMode('grid')}>Create from Preset</button>
    <button onClick={() => setShowForm(true)}>Start from Blank</button>
  </div>
)}
```

#### Code Sesudah (Proposed/After)

```jsx
{pickerMode === 'choice' && (
  <div className="universe-starter-grid">
    <button onClick={() => setShowAiBuilder(true)}>
      Build with AI <span>Recommended</span>
    </button>
    <button onClick={() => setPickerMode('grid')}>Use a Preset</button>
    <button onClick={openManualForm}>Manual Setup</button>
  </div>
)}

{showAiBuilder && (
  <AiUniverseBuilderModal
    onClose={() => setShowAiBuilder(false)}
    onCreated={async created => {
      await fetchUniverses();
      showToast(`Universe '${created.name}' berhasil dibuat.`);
    }}
  />
)}
```

Pertahankan seluruh behavior preset/manual existing. Jangan melakukan refactor besar page di luar kebutuhan integrasi modal.

### 11.8 `[NEW] scripts/test-ai-universe-builder.mjs`

#### Code Sebelum (Current/Before)

```javascript
// Test contract belum ada.
```

#### Code Sesudah (Proposed/After)

```javascript
import assert from 'node:assert/strict';
import {
  validateUniverseBrief,
  validateAndNormalizeUniverseDraft
} from '../lib/universe-ai-contract.js';

// Valid animal, mascot, and faceless-human drafts.
// Invalid enums/counts/lengths.
// Duplicate normalized keys.
// Human normal-face rejection.
// Required negative prompts and policy.
// Malformed/missing Gemini output rejection.
```

Test ini tidak boleh memanggil Gemini berbayar. Tambahkan injectable generator/model atau test prompt/contract secara lokal.

### 11.9 `[MODIFY] package.json`

#### Code Sebelum (Current/Before)

```json
{
  "scripts": {
    "test:content-planner": "node scripts/test-content-planner-modes.mjs"
  }
}
```

#### Code Sesudah (Proposed/After)

```json
{
  "scripts": {
    "test:content-planner": "node scripts/test-content-planner-modes.mjs",
    "test:ai-universe-builder": "node scripts/test-ai-universe-builder.mjs"
  }
}
```

### 11.10 `[MODIFY] sot/menus/universe-manager.md`

#### Code Sebelum (Current/Before)

```markdown
User dapat membuat universe baru dari 6 System Preset bawaan atau dari blank form secara manual.
```

#### Code Sesudah (Proposed/After)

```markdown
User dapat membuat universe melalui Build with AI, System Preset, atau Manual Setup.
Build with AI menghasilkan draft single-pass yang wajib direview sebelum disimpan secara atomik.
```

Dokumentasikan input brief, output contract, faceless guardrail, endpoint, error states, metadata AI, dan batas MVP.

## 12. Validasi dan Normalisasi Detail

### 12.1 Slug/key

```javascript
slugify('Warm Kitchen!') === 'warm-kitchen'
keyify('Warm Kitchen!') === 'warm_kitchen'
```

- slug kosong setelah normalisasi ditolak;
- duplicate key setelah normalisasi ditolak dengan lokasi error jelas;
- server melakukan normalisasi ulang ketika save;
- slug uniqueness harus tenant-scoped;
- `name`, slug, dan key tidak boleh digunakan sebagai raw SQL identifier.

### 12.2 JSON fields

Sebelum persistence:

- `default_pillars_json`: array string unik;
- `rules_json`: plain object, bukan array;
- `negative_prompts_json`: array string unik;
- `forbidden_changes_json`: array string unik;
- batasi kedalaman/ukuran data agar payload AI tidak membengkak;
- abaikan unknown fields, jangan meneruskannya ke SQL.

### 12.3 Defaults

Gunakan defaults yang kompatibel:

```javascript
default_aspect_ratio = '9:16'
default_scene_count = 7
default_scene_duration = 8
status = 'active'
version = 1
reference_image_path = null
```

Story template harus dipilih dari allowlist yang cocok dengan domain, bukan teks arbitrer Gemini.

## 13. Atomic Persistence dan Concurrency

Dalam transaction:

1. validasi ulang draft;
2. cek slug tenant-scoped;
3. insert profile;
4. insert seluruh karakter;
5. insert seluruh lokasi;
6. commit;
7. setelah commit, refresh manifest cache best-effort.

Unique index database tetap menjadi final concurrency protection. Bila dua request memakai slug sama, request kalah mengembalikan `409`, bukan `500` generik.

Jangan memanggil Gemini di dalam database transaction.

## 14. Test Matrix

### 14.1 Contract/unit

- brief animal valid;
- brief mascot valid;
- brief human valid;
- missing name/purpose/premise;
- unknown domain/type;
- character/location count 0 dan >5;
- oversized freeform input;
- valid full draft;
- missing profile/characters/locations;
- wrong array counts;
- duplicate normalized character keys;
- duplicate normalized location keys;
- malformed JSON field type;
- human character `normal` ditolak;
- faceless negative prompts/policy terjaga;
- unknown fields tidak dipersist;
- prompt mencantumkan version, exact count, dan faceless mandate.

### 14.2 API/integration

- unauthenticated/unauthorized request ditolak;
- tenant context tidak dapat dioverride dari body;
- successful generate memakai fake Gemini result;
- provider error dipetakan tanpa membocorkan secret;
- invalid Gemini output menghasilkan `422`;
- instantiate successful menyimpan 1 profile + N character + N location;
- failure pada character/location insert me-roll back profile;
- duplicate slug menghasilkan `409`;
- tenant berbeda dapat memakai slug sama jika policy existing mengizinkan;
- manifest dapat dibaca setelah create.

### 14.3 UI/manual

- tiga pilihan starter muncul dan AI menjadi primary;
- field historical bersifat kondisional;
- double-click generate/save tidak membuat request ganda;
- loading, retryable error, validation error, save success;
- review edits terkirim ke instantiate;
- add/delete character/location;
- mobile layout tidak overflow;
- keyboard focus dan close dialog;
- preset create tetap bekerja;
- manual create/edit tetap bekerja.

### 14.4 Regression

```bash
npm run test:ai-universe-builder
node scripts/test-universe-field-mapping.js
npm run test:content-planner
npm run build
```

Tambahkan lint bila repository menyediakan command lint yang valid; jangan mengarang command yang tidak ada.

## 15. Observability dan Keamanan

- Log event: generation started/succeeded/failed dan instantiate succeeded/failed.
- Log tenant/user ID hanya mengikuti standar existing dan jangan log brief penuh bila berpotensi sensitif.
- Jangan log raw Gemini response pada production.
- Jangan expose model API key ke Client Component.
- Error response memakai stable error code, misalnya `INVALID_BRIEF`, `INVALID_AI_OUTPUT`, `SLUG_CONFLICT`, `AI_TEMPORARILY_UNAVAILABLE`.
- Endpoint mutation wajib melalui `withTenantContext`.
- Batasi satu request generation aktif per modal pada client; rate limiting server global adalah follow-up bila belum ada primitive existing.

## 16. Deployment dan Release

Setelah seluruh test/build berhasil:

1. Deploy hanya ke Dev Mac Mini:

   ```bash
   npm run deploy:macmini-dev
   ```

2. Target Dev:

   ```text
   UI             : 5020
   API            : 7020
   Folder         : ~/maknaflow-dev
   Schema         : dev
   PGPOOL_MAX     : 3
   PM2 environment: dev
   ```

3. Ikuti zero-spam mode. Jangan polling SSH setiap 10–15 detik; tunggu sekitar dua menit sebelum pemeriksaan lanjutan.
4. Smoke test satu mascot universe dan satu human faceless universe.
5. Pastikan keduanya muncul di Content Planner.
6. Jangan deploy Staging atau Production tanpa instruksi eksplisit pengguna.
7. Setelah verifikasi selesai, jalankan SOP release patch dari `AGENTS.md`:

   ```bash
   npm run release-non-interactive -- --type patch --title "AI Universe Builder MVP" --points "Tambah AI Universe Builder single-pass|Tambah review dan atomic save universe|Tambah faceless guardrail untuk human universe"
   ```

8. Verifikasi changelog, version, commit, tag, branch `main`, dan tag telah terunggah ke target repository.

## 17. Risiko dan Mitigasi

| Risiko | Mitigasi |
|---|---|
| Gemini menghasilkan schema menyimpang | response JSON mode + parser + strict contract validator |
| AI membuat karakter berwajah pada human universe | deterministic server-side faceless rejection/guardrail |
| Universe tersimpan parsial | single PostgreSQL transaction |
| Duplicate slug karena concurrent request | pre-check + database unique index + map unique violation ke 409 |
| UI page semakin besar | wizard dipisah ke `AiUniverseBuilderModal.js` |
| Gemini outage/quota | retryable status dan regenerate; jangan menyimpan draft gagal |
| Regression preset/manual | scope UI minimal + regression tests |
| Content Planner gagal membaca AI universe | tetap memakai schema universe existing dan manifest refresh |

## 18. Definition of Done

- Seluruh acceptance criteria terpenuhi.
- Seluruh checkbox execution task list relevan ditandai berdasarkan bukti aktual.
- Test contract, integration yang tersedia, regression, dan build lulus.
- Smoke test Dev berhasil untuk mascot dan faceless-human universe.
- Tidak ada secret/raw response Gemini dalam log atau client bundle.
- Dokumentasi SOT diperbarui.
- Release SOP selesai setelah verifikasi berhasil.

## Execution Task List

- [x] 1. Baca `AGENTS.md`, dokumentasi Next.js lokal yang relevan, SOT Universe Manager, dan seluruh file target aktual.
- [x] 2. Jalankan `git status --short` dan baseline regression test Universe Manager/Content Planner tanpa menimpa perubahan unrelated.
- [x] 3. Implementasikan `lib/universe-ai-contract.js` beserta enum, normalization, strict validation, dan faceless guardrail.
- [x] 4. Tambahkan contract tests dan script `test:ai-universe-builder`; jalankan hingga lulus.
- [x] 5. Implementasikan versioned single-pass prompt dan Gemini generation service di `lib/universe-ai-builder.js`.
- [x] 6. Implementasikan atomic persistence service di `lib/universe-ai-repository.js` dengan slug conflict handling.
- [x] 7. Implementasikan `POST /api/v2/universe-ai/generate` dan error mapping yang aman.
- [x] 8. Implementasikan `POST /api/v2/universe-ai/instantiate` dan revalidation sebelum save.
- [x] 9. Implementasikan `AiUniverseBuilderModal` empat tahap beserta editable review dan state lengkap.
- [x] 10. Integrasikan modal ke Universe Manager; ubah `Start from Blank` menjadi `Manual Setup` tanpa regression preset/manual.
- [x] 11. Tambahkan API/integration tests dengan fake Gemini serta rollback, conflict, tenant, dan invalid-output cases.
- [x] 12. Perbarui `sot/menus/universe-manager.md` agar kontrak dan batas MVP menjadi source of truth.
- [x] 13. Jalankan seluruh test AI Universe Builder, field mapping, Content Planner regression, dan pemeriksaan keamanan log/client.
- [x] 14. Jalankan production build dan perbaiki seluruh error yang terkait perubahan.
- [x] 15. Deploy hanya ke Dev Mac Mini dan lakukan smoke test mascot + human faceless serta pemilihan di Content Planner.
- [x] 16. Jalankan release patch non-interaktif, lalu verifikasi changelog, version, commit, tag, dan push.

> Setiap task hanya boleh diubah menjadi `[x]` setelah implementasi dan verifikasi task tersebut benar-benar selesai. Jika implementasi menyimpang dari plan karena fakta kode aktual, dokumentasikan alasan dan solusi kompatibelnya di dokumen ini sebelum menandai task selesai.
