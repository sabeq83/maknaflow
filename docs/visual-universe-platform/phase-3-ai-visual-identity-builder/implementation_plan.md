# Implementation Plan — Fase 3 AI Visual Identity Builder

## 1. Sasaran

Menambahkan fitur **Design with AI** pada Visual Identity Studio. User cukup memberikan arahan visual dengan bahasa alami dan beberapa pilihan penting; Gemini menghasilkan satu draft Visual Identity terstruktur sesuai contract Fase 2. Server kemudian memvalidasi, menormalisasi, mengunci faceless guardrail, dan menghasilkan compliance report. User wajib meninjau serta dapat mengedit draft sebelum menyimpannya sebagai user preset melalui persistence Fase 2.

Alur target:

```text
Visual Identity Studio
→ Design with AI
→ isi AI Creative Brief
→ satu call Gemini menghasilkan structured draft
→ server validation + deterministic faceless enforcement
→ compliance report
→ editable review
→ Continue in Studio Editor
→ user review/edit final
→ Save melalui API user preset Fase 2
```

## 2. Prasyarat dan Temuan Fase 2 Aktual

Fondasi yang harus digunakan, bukan dibuat ulang:

- `lib/visual-identity-contract.js` menyediakan structured config V1 dan deterministic guardrails;
- `lib/visual-override-resolver.js` menghasilkan `visual_identity_snapshot_v1` serta resolved prompt preview;
- `lib/visual-identity-repository.js` menyediakan tenant-scoped CRUD/versioning;
- `/api/v2/visual-identities` menyediakan create/list;
- `/api/v2/visual-identities/resolve` menyediakan prompt resolution;
- `/settings/visual-identities` adalah Studio/editor existing;
- campaign consumers memakai preset reference dan snapshot semantics Fase 2.

Catatan dokumentasi: checklist Fase 2 pada repository masih menunjukkan sebagian Gate 2B belum dicentang meskipun release `v2.18.12` dan `v2.18.13` sudah ada serta banyak integrasi telah terimplementasi. Sebelum implementasi Fase 3, agent wajib mengaudit fakta aktual, memperbarui checklist Fase 2 berdasarkan bukti, dan mencatat item yang benar-benar belum selesai. Fase 3 tidak boleh dipakai untuk menyamarkan debt Fase 2.

## 3. Outcome dan Acceptance Criteria

Fase 3 selesai bila:

1. Visual Identity Studio mempunyai tombol primary/secondary yang jelas: `✨ Design with AI`.
2. User dapat membuat brief dari natural-language seed dan field terstruktur.
3. Satu generation call menghasilkan label, description, dan structured config V1 lengkap.
4. Gemini output tidak pernah langsung disimpan ke database.
5. Output selalu melewati validator Fase 2 di server.
6. Human/blank-face output selalu faceless; visible-face request ditolak atau dikoreksi secara eksplisit dan dilaporkan.
7. Server menghasilkan compliance report deterministik, bukan meminta Gemini menilai dirinya sendiri.
8. User dapat melihat perbedaan antara instruksi awal, draft AI, dan koreksi guardrail.
9. User dapat mengedit draft di review screen.
10. `Continue in Studio Editor` mengisi editor existing; save tetap memakai API Fase 2.
11. `Regenerate` menghasilkan ulang berdasarkan brief yang sama.
12. `Refine` menerima satu instruksi perubahan dan draft sebelumnya, lalu menghasilkan draft lengkap baru.
13. Refine tidak dapat melemahkan guardrail.
14. Resolved prompt preview memakai resolver Fase 2, bukan prompt versi lain.
15. Tidak ada database migration atau penyimpanan abandoned AI drafts pada Fase 3.
16. Tidak ada provider call dalam automated test.
17. Manual create/edit/clone/archive dan campaign selection Fase 2 tetap berfungsi.

## 4. Scope

### 4.1 Termasuk

- AI brief form;
- single-pass Gemini generation;
- structured output yang identik dengan Visual Identity config V1;
- deterministic compliance report;
- editable review;
- regenerate;
- one-instruction refinement;
- resolved prompt preview;
- handoff draft ke Studio editor existing;
- error/retry states;
- tests, SOT, Dev deployment, release.

### 4.2 Tidak termasuk

- direct save tanpa user review;
- image/reference asset generation;
- visual reference sheet;
- upload reference images;
- visual similarity scoring;
- persistent AI draft/autosave;
- AI chat history multi-turn;
- campaign-specific AI generation dari campaign forms;
- perubahan schema `visual_identity_presets`;
- visible human faces.

## 5. UX

### 5.1 Entry point

Header Studio:

```text
[✨ Design with AI] [+ Create Manually]
```

`Design with AI` direkomendasikan untuk user yang belum mempunyai detail visual. Manual create tetap tersedia.

### 5.2 Wizard steps

```text
brief → generating → review → handoff_to_editor
  ↑          ↓          ↓
  └────── retry/error ──┘
```

Refinement terjadi dari review:

```text
review → refine instruction → refining → revised review
```

### 5.3 AI Creative Brief

Field minimum:

- `seed`: deskripsi bebas, wajib;
- `purpose`: jenis konten/tujuan;
- `subject_kind`: human, blank-face 3D, animal, mascot object;
- `faceless_mode`: kondisional dan tidak dapat memilih visible face;
- `audience`;
- `mood`;
- `wardrobe_direction`;
- `color_direction`;
- `environment_direction`;
- `lighting_direction`;
- `camera_direction`;
- `style_direction`;
- `aspect_ratio`;
- `special_constraints`;
- `variation_level`: conservative, balanced, adventurous.

Natural-language seed maksimal 3.000 karakter. Field lain memiliki batas panjang server-side.

### 5.4 Review screen

Tampilkan:

- identity label dan description;
- subject/faceless mode;
- wardrobe dan colors;
- environment;
- lighting;
- camera;
- style;
- guardrails;
- resolved prompt preview;
- compliance summary;
- corrections/warnings.

Aksi:

- `Back to Brief`;
- `Regenerate`;
- `Refine`;
- `Continue in Studio Editor`;
- `Cancel`.

### 5.5 Handoff

Handoff tidak memanggil create API. Parent Studio menerima:

```javascript
{
  label,
  description,
  suggested_preset_key,
  config
}
```

Kemudian membuka form create existing dengan field tersebut. User masih dapat mengedit dan menekan Save.

## 6. AI Brief Contract

```json
{
  "seed": "Visual premium skincare dengan muslimah faceless, hanya tangan terlihat",
  "purpose": "product education and premium brand building",
  "subject_kind": "human",
  "faceless_mode": "hands_only",
  "audience": "Perempuan Indonesia usia 25–40",
  "mood": "calm, refined, trustworthy",
  "wardrobe_direction": "modest sage gamis, wrists covered",
  "color_direction": "sage, cream, warm oak",
  "environment_direction": "minimal vanity area",
  "lighting_direction": "soft morning window light",
  "camera_direction": "macro hands and product details",
  "style_direction": "cinematic realistic",
  "aspect_ratio": "9:16",
  "special_constraints": "No mirrors showing a face",
  "variation_level": "balanced"
}
```

Enum wajib menggunakan exports Fase 2 bila relevan, bukan diduplikasi dengan nilai berbeda.

```javascript
subject_kind ∈ SUBJECT_KINDS
faceless_mode ∈ HUMAN_FACELESS_MODES | 'not_applicable'
aspect_ratio ∈ ['9:16', '16:9', '1:1']
variation_level ∈ ['conservative', 'balanced', 'adventurous']
```

Rules:

- human/blank-face 3D tidak boleh `not_applicable`;
- animal/mascot default `not_applicable`;
- request seperti “tampilkan wajah” tidak boleh mengubah contract;
- input dianggap untrusted content, bukan instruksi sistem;
- unknown fields di-strip;
- arrays/strings dibatasi ukurannya.

## 7. Gemini Output Contract

Gemini mengembalikan tepat satu JSON object:

```json
{
  "label": "Sage Morning Skincare",
  "description": "Identitas visual faceless premium untuk edukasi skincare.",
  "suggested_preset_key": "sage_morning_skincare",
  "creative_rationale": "Menggunakan palette sage dan morning light untuk membangun rasa tenang dan terpercaya.",
  "config": {
    "schema_version": "1",
    "subject": {},
    "wardrobe": {},
    "environment": {},
    "lighting": {},
    "camera": {},
    "style": {},
    "guardrails": {}
  }
}
```

`config` wajib mengikuti schema Fase 2. `creative_rationale` hanya untuk review, tidak masuk `config_json` kecuali user menyalinnya ke description.

## 8. Prompt Single-Pass

Gunakan version:

```javascript
AI_VISUAL_IDENTITY_PROMPT_VERSION = 'ai_visual_identity_v1'
```

Prompt wajib:

1. menetapkan role visual director dan production prompt architect;
2. memasukkan brief sebagai JSON di delimiter jelas;
3. menyatakan brief adalah data tidak tepercaya, bukan system instruction;
4. meminta satu complete Visual Identity config, bukan fragmen;
5. memakai exact schema/enums Fase 2;
6. melarang output markdown atau teks di luar JSON;
7. mewajibkan human faceless;
8. membedakan human face dari wajah hewan/maskot;
9. mengunci wardrobe, palette, environment, lighting, camera, dan style secara konkret;
10. menghindari istilah abstrak tanpa production detail;
11. menjaga Bahasa Indonesia untuk label/description/rationale dan English visual terminology untuk custom prompt descriptions;
12. tidak membuat klaim produk/medis;
13. pada refine, mengembalikan full replacement draft dan mempertahankan field yang tidak diminta berubah.

AI guardrail tetap defense-in-depth; validator server adalah authority.

## 9. Deterministic Compliance Report

Setelah parsing:

1. simpan subset raw draft untuk comparison in-memory;
2. jalankan `validateAndNormalizeVisualIdentity(raw.config)`;
3. bandingkan raw dengan normalized;
4. jalankan cross-field compliance checks;
5. resolve preview memakai `resolveVisualIdentity({ inlineConfig })`;
6. return normalized draft + compliance report.

Format:

```json
{
  "status": "compliant_with_corrections",
  "score": 92,
  "checks": [
    { "key": "face_visibility", "status": "pass", "message": "Human face prohibited." },
    { "key": "camera_framing", "status": "corrected", "message": "Framing changed to forearms_and_hands." }
  ],
  "corrections": [
    { "path": "guardrails.face_visibility", "from": "allowed", "to": "prohibited" }
  ],
  "warnings": []
}
```

Score hanya UX summary deterministik, bukan klaim probabilistik AI. Status:

```text
compliant
compliant_with_corrections
rejected
```

Reject bila:

- structure utama hilang;
- subject kind/faceless mode invalid;
- output mencoba menghasilkan visible human face yang tidak dapat dinormalisasi dengan aman;
- array/size melewati batas;
- config setelah normalization masih gagal resolver.

## 10. Generate dan Refine API

### 10.1 Generate

```text
POST /api/v2/visual-identities/ai/generate
```

Request: AI Brief contract.

Response:

```json
{
  "success": true,
  "data": {
    "draft": {},
    "compliance": {},
    "resolved_preview": {},
    "meta": {
      "prompt_version": "ai_visual_identity_v1",
      "model": "gemini-3.6-flash"
    }
  }
}
```

### 10.2 Refine

```text
POST /api/v2/visual-identities/ai/refine
```

Request:

```json
{
  "brief": {},
  "current_draft": {},
  "instruction": "Buat palette lebih premium dan lighting sedikit lebih dramatis."
}
```

Instruction maksimal 1.000 karakter. Current draft divalidasi sebelum dipakai. Response sama dengan generate dan selalu berisi full draft.

### 10.3 Authorization dan error

- gunakan `withTenantContext`;
- akses selaras dengan permission Visual Identity Studio (`operator_presets` pada implementasi Fase 2);
- mutation tidak di-cache;
- jangan menerima tenant ID;
- jangan log raw brief/response di production;
- error codes:

```text
400 INVALID_AI_VISUAL_BRIEF / INVALID_REFINE_REQUEST
401/403 UNAUTHORIZED / FORBIDDEN
422 INVALID_AI_VISUAL_OUTPUT / FACELESS_POLICY_VIOLATION
429/503 AI_TEMPORARILY_UNAVAILABLE
500 INTERNAL_ERROR
```

## 11. Security dan Cost Controls

- Client disable duplicate generate/refine.
- Server length limits dan strict allowlist.
- Satu Gemini call per explicit generate/refine action.
- Tidak ada automatic call saat field berubah.
- Tidak ada Google Search/tool use.
- Tidak ada reference image generation.
- Jangan expose prompt system, API key, stack trace, atau raw provider response.
- Log hanya event, duration, model, prompt version, outcome, dan safe error code.
- Gunakan key-pool/resilience abstraction existing di `lib/gemini.js`.
- Jika repository memiliki rate-limit primitive, terapkan per user/tenant; jika tidak, dokumentasikan sebagai follow-up dan tetap cegah double-submit.

## 12. Perubahan per File

### 12.1 `[NEW] lib/visual-identity-ai-contract.js`

#### Code Sebelum (Current/Before)

```javascript
// Belum ada contract untuk AI creative brief, AI draft envelope, dan compliance report.
```

#### Code Sesudah (Proposed/After)

```javascript
import {
  SUBJECT_KINDS,
  HUMAN_FACELESS_MODES,
  validateAndNormalizeVisualIdentity
} from './visual-identity-contract.js';

export const AI_VISUAL_IDENTITY_PROMPT_VERSION = 'ai_visual_identity_v1';

export class AiVisualIdentityValidationError extends Error {}

export function validateAiVisualIdentityBrief(input) {}
export function validateAiVisualIdentityDraftEnvelope(input) {}
export function buildVisualIdentityComplianceReport(rawConfig, normalizedConfig) {}
export function normalizeAiVisualIdentityResult(raw, options = {}) {}
```

Jangan mengubah atau menduplikasi authority contract Fase 2. AI contract membungkusnya.

### 12.2 `[NEW] lib/visual-identity-ai-builder.js`

#### Code Sebelum (Current/Before)

```javascript
// Visual Identity belum mempunyai Gemini builder.
```

#### Code Sesudah (Proposed/After)

```javascript
import { getGeminiModel, GEMINI_MODELS } from './gemini.js';
import { parseGeminiJSON } from './json-parser.js';
import { resolveVisualIdentity } from './visual-override-resolver.js';
import {
  AI_VISUAL_IDENTITY_PROMPT_VERSION,
  validateAiVisualIdentityBrief,
  normalizeAiVisualIdentityResult
} from './visual-identity-ai-contract.js';

export function buildAiVisualIdentityPrompt(brief) {}
export function buildAiVisualIdentityRefinePrompt(brief, currentDraft, instruction) {}

export async function generateAiVisualIdentityDraft(input, { modelFactory = getGeminiModel } = {}) {
  // Validate brief, one Gemini call, parse, normalize, compliance, resolve preview.
}

export async function refineAiVisualIdentityDraft(input, { modelFactory = getGeminiModel } = {}) {
  // Validate brief/current draft/instruction, one Gemini call, full replacement result.
}
```

`modelFactory` atau injection setara wajib tersedia agar test tidak memanggil Gemini.

### 12.3 `[NEW] app/api/v2/visual-identities/ai/generate/route.js`

#### Code Sebelum (Current/Before)

```javascript
// Endpoint belum ada.
```

#### Code Sesudah (Proposed/After)

```javascript
import { withTenantContext } from '@/lib/auth';
import { generateAiVisualIdentityDraft } from '@/lib/visual-identity-ai-builder';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (request, _context, user) => {
  requireVisualIdentityAiAccess(user);
  try {
    return Response.json({ success: true, data: await generateAiVisualIdentityDraft(await request.json()) });
  } catch (error) {
    return mapAiVisualIdentityError(error);
  }
});
```

### 12.4 `[NEW] app/api/v2/visual-identities/ai/refine/route.js`

#### Code Sebelum (Current/Before)

```javascript
// Endpoint belum ada.
```

#### Code Sesudah (Proposed/After)

```javascript
export const POST = withTenantContext(async (request, _context, user) => {
  requireVisualIdentityAiAccess(user);
  try {
    return Response.json({ success: true, data: await refineAiVisualIdentityDraft(await request.json()) });
  } catch (error) {
    return mapAiVisualIdentityError(error);
  }
});
```

Gunakan shared authorization dan error mapper server-only; boleh dibuat helper kecil bila pola repository mendukung.

### 12.5 `[NEW] app/components/AiVisualIdentityBuilderModal.js`

#### Code Sebelum (Current/Before)

```javascript
// Studio hanya mendukung create/edit manual.
```

#### Code Sesudah (Proposed/After)

```jsx
'use client';

export default function AiVisualIdentityBuilderModal({ onClose, onContinueEditing }) {
  const [step, setStep] = useState('brief');
  const [brief, setBrief] = useState(createDefaultAiVisualBrief());
  const [result, setResult] = useState(null);
  const [refineInstruction, setRefineInstruction] = useState('');

  async function generate() {}
  async function refine() {}

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="ai-visual-identity-title">
      {/* Brief → honest loading → editable review → compliance → handoff */}
    </div>
  );
}
```

Review edits harus menghasilkan local draft yang kembali divalidasi ketika handoff/save. Jangan membuat hidden direct-save action.

### 12.6 `[MODIFY] app/settings/visual-identities/page.js`

#### Code Sebelum (Current/Before)

```jsx
<button className="btn btn-primary" onClick={handleOpenCreate}>+ Create Preset</button>
```

```javascript
const handleOpenCreate = () => {
  setLabel('');
  setDescription('');
  setPresetKey('');
  setConfig(DEFAULT_CONFIG);
  setEditingPreset({ isNew: true });
};
```

#### Code Sesudah (Proposed/After)

```jsx
<button className="btn btn-secondary" onClick={() => setShowAiBuilder(true)}>
  ✨ Design with AI
</button>
<button className="btn btn-primary" onClick={handleOpenCreate}>+ Create Manually</button>
```

```javascript
function handleAiDraftReady(draft) {
  setLabel(draft.label);
  setDescription(draft.description || '');
  setPresetKey(draft.suggested_preset_key || '');
  setConfig(draft.config);
  setEditingPreset({ isNew: true, origin: 'ai' });
  setShowAiBuilder(false);
}
```

Refactor enum/default duplication hanya bila aman dan tertutup test. Jangan memperluas scope menjadi redesign Studio kedua.

### 12.7 `[NEW] scripts/test-ai-visual-identity-builder.mjs`

#### Code Sebelum (Current/Before)

```javascript
// Belum ada AI Visual Identity contract/builder tests.
```

#### Code Sesudah (Proposed/After)

```javascript
// Brief validation, prompt contract, fake model generation/refine,
// output parsing, deterministic corrections, visible-face rejection,
// resolved preview, no persistence, error mapping.
```

Gunakan fake model factory. Jangan melakukan network/provider call.

### 12.8 `[MODIFY] package.json`

#### Code Sebelum (Current/Before)

```json
"test:visual-identity": "node scripts/test-visual-identity-foundation.mjs"
```

#### Code Sesudah (Proposed/After)

```json
"test:visual-identity": "node scripts/test-visual-identity-foundation.mjs",
"test:ai-visual-identity": "node scripts/test-ai-visual-identity-builder.mjs"
```

### 12.9 `[MODIFY] sot/menus/visual-identity-studio.md`

Jika file SOT aktual belum ada karena debt Fase 2, buat file tersebut dan perbarui checklist Fase 2 terlebih dahulu.

#### Code Sebelum (Current/Before)

```markdown
Visual Identity Studio mendukung system/user preset dan editor manual.
```

#### Code Sesudah (Proposed/After)

```markdown
Visual Identity Studio juga mendukung Design with AI: single-pass draft,
deterministic compliance report, refinement, review, dan handoff ke editor.
Output AI tidak disimpan tanpa persetujuan user.
```

Dokumentasikan endpoint, prompt version, input/output contract, cost controls, faceless invariant, error codes, dan batas Fase 3.

### 12.10 `[MODIFY] docs/visual-universe-platform/master_roadmap.md`

#### Code Sebelum (Current/Before)

```markdown
| Fase 3 | AI Visual Identity Builder | Natural-language-to-visual-identity ... | Fase 2 |
```

#### Code Sesudah (Proposed/After)

```markdown
| Fase 3 | AI Visual Identity Builder | Natural-language-to-visual-identity dengan review dan compliance | In progress/Complete |
```

Update status hanya berdasarkan bukti aktual.

## 13. Validation Detail

### 13.1 Allowlist dan limits

- label 3–100;
- description maksimal 500;
- rationale maksimal 1.000;
- suggested key dinormalisasi seperti repository Fase 2;
- seed maksimal 3.000;
- refine instruction maksimal 1.000;
- custom descriptions maksimal 1.000 per field;
- palette/accessories/props/negative prompts memiliki maximum item count dan string length;
- subject character count dibatasi sesuai contract produk, bukan angka arbitrer AI.

### 13.2 Output completeness

Reject bila `label`, `config.subject`, `wardrobe`, `environment`, `lighting`, `camera`, atau `style` hilang. Defaults Fase 2 boleh melengkapi optional leaf fields, tetapi tidak boleh menyamarkan output kosong sebagai AI design berhasil.

### 13.3 Faceless intent handling

Jika seed meminta visible face untuk human:

- jangan meneruskan kebijakan tersebut sebagai allowed config;
- generator tetap menghasilkan faceless alternative paling dekat;
- compliance report menampilkan correction/warning jelas;
- bila permintaan inti tidak dapat dipenuhi tanpa visible face, return `422 FACELESS_POLICY_VIOLATION` dengan saran memilih animal/mascot atau faceless mode.

## 14. Test Matrix

### Contract

- valid human hands-only brief;
- valid blank-face 3D brief;
- valid animal and mascot brief;
- missing/oversized seed;
- invalid subject/faceless combination;
- visible-face request handling;
- unknown fields stripped;
- refine missing instruction/current draft;
- malicious prompt-injection text treated as data.

### Builder dengan fake Gemini

- exact full draft parsed;
- markdown-wrapped JSON still parsed by existing parser;
- incomplete output rejected;
- invalid enum rejected/corrected according to contract;
- human guardrail weakening corrected and reported;
- framing corrected and reported;
- resolved preview matches Fase 2 resolver;
- one model call per action;
- refinement preserves unmodified fields in returned full draft;
- provider 429/503 mapping.

### API

- authentication/permission;
- no tenant override;
- safe error response;
- generate/refine happy path with injected fake service where test architecture allows;
- no raw response/stack leak;
- mutation no-store/dynamic behavior.

### UI/manual

- Design with AI entry point;
- conditional faceless mode;
- duplicate submit disabled;
- loading/error/retry;
- compliance corrections visible;
- review fields editable;
- refine/regenerate;
- handoff populates manual editor;
- cancel does not persist;
- save uses existing Fase 2 create API;
- mobile and keyboard basics.

### Regression

```bash
npm run test:ai-visual-identity
npm run test:visual-identity
npm run test:operator-presets
npm run test:operator-content
npm run test:ai-universe-builder
npm run build
```

Tambahkan test lain bila audit Fase 2 menemukan consumer yang berisiko. Automated tests tidak boleh menggunakan Gemini live.

## 15. Observability

Safe events:

```text
ai_visual_identity.generate.started
ai_visual_identity.generate.succeeded
ai_visual_identity.generate.failed
ai_visual_identity.refine.started
ai_visual_identity.refine.succeeded
ai_visual_identity.refine.failed
ai_visual_identity.handoff_to_editor
```

Metadata aman:

- tenant/user identifier sesuai logging policy existing;
- prompt version;
- model;
- duration;
- compliance status;
- safe error code.

Jangan log seed penuh, refine instruction penuh, raw Gemini response, config sensitif, atau API key.

## 16. Deployment dan Release

Setelah tests/build berhasil, deploy hanya ke Dev Mac Mini:

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

1. generate human hands-only identity;
2. generate blank-face 3D identity;
3. generate mascot identity;
4. submit visible-face request dan verifikasi correction/rejection;
5. refine palette/lighting;
6. handoff ke editor, edit manual, save;
7. pilih saved identity pada satu RE/OPC draft dan verifikasi resolved preview;
8. manual Visual Identity creation tetap berfungsi.

Release:

```bash
npm run release-non-interactive -- --type minor --title "AI Visual Identity Builder" --points "Tambah Design with AI untuk Visual Identity|Tambah compliance report dan faceless enforcement|Tambah AI refinement dan handoff ke Studio editor"
```

Gunakan minor karena kapabilitas user-facing baru. Bila convention repository memilih patch, catat keputusan dalam plan sebelum release.

## 17. Definition of Done

- seluruh acceptance criteria terpenuhi;
- output AI tidak pernah dipersist tanpa editor review/save;
- faceless invariant terbukti melalui contract dan smoke test;
- generate/refine memakai satu call per action;
- compliance report deterministik;
- resolved preview memakai resolver Fase 2;
- tests/build/Dev smoke test lulus;
- Fase 2 regression tidak muncul;
- SOT dan master roadmap diperbarui;
- release SOP selesai.

## Execution Task List

- [ ] 1. Baca `AGENTS.md`, master roadmap, plan Fase 2, SOT, Next.js docs lokal, dan seluruh file target aktual.
- [ ] 2. Audit status Fase 2 terhadap checklist yang masih terbuka; perbarui berdasarkan bukti atau selesaikan blocker relevan sebelum Fase 3.
- [ ] 3. Jalankan `git status --short` dan baseline tests Visual Identity, operator presets/content, AI Universe, dan build relevan.
- [ ] 4. Finalkan AI brief/output/refine contracts dan limits berdasarkan exports contract Fase 2.
- [ ] 5. Implementasikan `visual-identity-ai-contract.js` dan deterministic compliance report.
- [ ] 6. Tambahkan unit tests contract, faceless correction/rejection, prompt injection, dan compliance diff.
- [ ] 7. Implementasikan versioned generate/refine prompt builders serta injectable Gemini service.
- [ ] 8. Tambahkan fake-model tests untuk generation, refinement, parser, call count, provider errors, dan resolved preview.
- [ ] 9. Implementasikan generate/refine Route Handlers dengan auth, safe error mapping, dan no-store behavior.
- [ ] 10. Implementasikan `AiVisualIdentityBuilderModal` untuk brief, loading, review, compliance, regenerate, refine, dan handoff.
- [ ] 11. Integrasikan `Design with AI` ke Visual Identity Studio tanpa mengubah persistence Fase 2.
- [ ] 12. Tambahkan UI/API integration tests yang layak dan verifikasi cancel tidak menyimpan draft.
- [ ] 13. Perbarui SOT Visual Identity Studio serta master roadmap berdasarkan status aktual.
- [ ] 14. Jalankan seluruh targeted tests, security/log inspection, dan production build.
- [ ] 15. Deploy hanya ke Dev Mac Mini dan selesaikan seluruh smoke test human/blank-face/mascot/refine/handoff.
- [ ] 16. Jalankan release non-interaktif dan verifikasi version, changelog, commit, tag, branch, dan push.

> Ubah checkbox menjadi `[x]` segera setelah task benar-benar selesai dan terverifikasi. Jangan menandai task berdasarkan asumsi atau menyembunyikan debt Fase 2 sebagai pekerjaan Fase 3.

