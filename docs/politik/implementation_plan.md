# Implementation Plan — Visual Identity Studio v2

**Target:** ContentFlow menu `Settings → Visual Identity`  
**Primary use case:** Wa’y Siyasi  
**Audience:** Agent Antigravity / implementation agent  
**Status:** Ready for implementation after mockup approval  
**Approved UI reference:** `public/mockup_visual_identity_studio_v2.html`  
**Source of truth:** `docs/politik/BRAND_PROFILE_WAY_SIYASI.md` and `docs/politik/POLITICAL_VISUAL_IDENTITY.md`

---

## 1. Objective

Upgrade Visual Identity from a single static combination of subject, wardrobe, environment, camera, and style into a backward-compatible **multi-mode visual language system**.

The implementation must support:

1. Subject identity independently from rendering style.
2. One primary and zero or more supporting visual styles.
3. Narrative-function-to-visual-mode routing per scene.
4. Deterministic prompt fragments for all supported styles.
5. Intentional groups/crowds without weakening the faceless invariant.
6. A built-in `way_siyasi_editorial_system` preset.
7. Existing schema v1 presets, legacy overrides, saved campaigns, and snapshots without manual migration.

The six supported visual styles are:

- `editorial_graphic_novel`
- `isometric_society`
- `symbolic_surrealism`
- `paper_cutout_documentary`
- `shadow_silhouette`
- `clay_political_theater`

Do **not** add these values to `subject.kind`. They are visual-language/rendering modes, not subject types.

---

## 2. Product Decisions

### 2.1 Wa’y Siyasi default configuration

| Concern | Decision |
|---|---|
| Primary style | Editorial Graphic Novel |
| Supporting styles | Isometric Society, Symbolic Surrealism, Paper Cutout Documentary |
| Optional/off styles | Shadow & Silhouette, Clay Political Theater |
| Default subject | Faceless contemporary human |
| Population | Single, group, or intentional crowd |
| Format | Vertical 9:16 |
| Texture | Subtle printed-paper grain + editorial ink |
| Lighting | Soft directional editorial lighting with geometric shadows |
| Palette | Charcoal, off-white, warm gray, muted beige, maximum one accent per scene |
| Scene principle | One primary subject + one primary idea |

### 2.2 Default narrative routing

| Narrative function | Visual mode |
|---|---|
| `hook` | `symbolic_surrealism` |
| `context` | `editorial_graphic_novel` |
| `mechanism` | `isometric_society` |
| `consequence` | `editorial_graphic_novel` |
| `evidence_reveal` | `paper_cutout_documentary` |
| `conclusion` | `symbolic_surrealism` |

### 2.3 Backward compatibility

- Keep the existing top-level blocks: `subject`, `wardrobe`, `environment`, `lighting`, `camera`, `style`, and `guardrails`.
- Add v2 blocks; do not replace v1 blocks.
- Normalize missing v2 blocks with safe defaults.
- Existing schema v1 input must normalize successfully into schema v2.
- Accept existing `visual_identity_snapshot_v1`; do not mutate historical snapshots.
- New snapshots may remain named `visual_identity_snapshot_v1` if changing the envelope would affect downstream consumers. The nested `structured.schema_version` must be `2`.
- No database migration is required because preset configuration is stored in `config_json JSONB`.

---

## 3. Proposed Schema v2

```json
{
  "schema_version": "2",
  "subject": {
    "kind": "human",
    "faceless_mode": "featureless_editorial",
    "demographic_key": "custom",
    "custom_description": "Contemporary Southeast Asian citizens...",
    "character_count": 1,
    "population_mode": "single_group_or_crowd"
  },
  "visual_language": {
    "primary_style": "editorial_graphic_novel",
    "supporting_styles": [
      "isometric_society",
      "symbolic_surrealism",
      "paper_cutout_documentary"
    ],
    "disabled_styles": [
      "shadow_silhouette",
      "clay_political_theater"
    ]
  },
  "mode_routing": {
    "hook": "symbolic_surrealism",
    "context": "editorial_graphic_novel",
    "mechanism": "isometric_society",
    "consequence": "editorial_graphic_novel",
    "evidence_reveal": "paper_cutout_documentary",
    "conclusion": "symbolic_surrealism"
  },
  "rendering": {
    "geometry": "simplified_semi_realistic",
    "textures": ["printed_paper_grain", "editorial_ink"],
    "shadow_style": "strong_geometric",
    "finish": "matte_editorial"
  },
  "composition": {
    "primary_idea_count": 1,
    "primary_subject_count": 1,
    "negative_space": "required",
    "safe_zone": "vertical_social_ui"
  },
  "metaphor_engine": {
    "enabled": true,
    "pattern": "concept_to_object_to_action"
  },
  "guardrails": {
    "face_visibility": "prohibited",
    "reflection_face": "prohibited",
    "unintended_people": "prohibited",
    "intentional_crowd": "allowed_faceless",
    "identity_drift": "prohibited",
    "wardrobe_drift": "prohibited"
  }
}
```

---

## 4. Execution Task List

Agent Antigravity must update this checklist in real time. Change each item to `- [x]` immediately after it is completed and verified.

- [x] Read this plan, the two political brand documents, the approved HTML mockup, and relevant Next.js guides in `node_modules/next/dist/docs/`.
- [x] Record the initial `git status`; preserve unrelated and user-owned changes.
- [x] Add the visual-language catalog and deterministic prompt fragments.
- [x] Upgrade the visual identity contract to schema v2 with v1 normalization.
- [x] Upgrade the central resolver with narrative mode selection and v2 prompt output.
- [x] Upgrade the AI brief/output contract and compliance report.
- [x] Upgrade the single-pass Gemini builder prompt to emit schema v2.
- [x] Add the Wa’y Siyasi system preset.
- [x] Rebuild the AI Visual Identity Builder UI according to the approved mockup.
- [x] Extend the manual Visual Identity editor with v2 controls and resolved preview.
- [x] Add and update unit/integration tests for contract, resolver, preset, AI builder, and regressions.
- [x] Run focused Visual Identity tests and fix all failures.
- [x] Run `npm run build` and fix all build errors.
- [x] Manually verify light/dark mode and the five-step builder against the approved mockup.
- [x] Update this task list so every completed item is checked.
- [x] Run the mandatory non-interactive patch release and verify `main` plus the new tag on the configured remote.

---

## 5. File-by-File Change Plan

### 5.1 New file: `lib/visual-language-catalog.js`

**Purpose:** Keep supported visual styles, labels, descriptions, prompt anchors, compatible camera vocabulary, and negative prompts in one deterministic catalog. Both resolver and UI must consume this catalog.

#### Code Sebelum (Current/Before)

```js
// File does not exist.
// Style behavior is currently embedded as conditionals in visual-override-resolver.js.
```

#### Code Sesudah (Proposed/After)

```js
export const VISUAL_STYLE_KEYS = [
  'editorial_graphic_novel',
  'isometric_society',
  'symbolic_surrealism',
  'paper_cutout_documentary',
  'shadow_silhouette',
  'clay_political_theater'
];

export const VISUAL_LANGUAGE_CATALOG = {
  editorial_graphic_novel: {
    label: 'Editorial Graphic Novel',
    prompt: 'premium editorial political illustration, modern graphic novel aesthetic...',
    negative_prompts: ['photorealistic stock footage', 'news TV composition']
  },
  isometric_society: {
    label: 'Isometric Society',
    prompt: 'isometric miniature society, interconnected institutions and infrastructure...',
    negative_prompts: ['decorative isometric scene without readable system flow']
  }
  // Define all six modes.
};

export const NARRATIVE_FUNCTIONS = [
  'hook', 'context', 'mechanism', 'consequence', 'evidence_reveal', 'conclusion'
];

export function getVisualStyleDefinition(key) {
  return VISUAL_LANGUAGE_CATALOG[key] || VISUAL_LANGUAGE_CATALOG.editorial_graphic_novel;
}
```

**Implementation notes:**

- Do not duplicate the catalog in UI files.
- Do not use copyrighted artist names or living-artist imitation language.
- Prompt fragments must encode visual behavior, not only aesthetic adjectives.

---

### 5.2 Modify: `lib/visual-identity-contract.js`

**Purpose:** Introduce schema v2 while normalizing v1 input safely.

#### Code Sebelum (Current/Before)

```js
export const VISUAL_IDENTITY_SCHEMA_VERSION = '1';
export const SUBJECT_KINDS = ['human', 'blank_face_3d', 'animal', 'mascot_object'];
export const CAMERA_FRAMINGS = [
  'hands_closeup',
  'forearms_and_hands',
  'crop_below_neck',
  'back_view',
  'full_body_blank_face',
  'object_or_animal'
];
```

#### Code Sesudah (Proposed/After)

```js
export const VISUAL_IDENTITY_SCHEMA_VERSION = '2';
export const SUBJECT_KINDS = ['human', 'blank_face_3d', 'animal', 'mascot_object'];
export const HUMAN_FACELESS_MODES = [
  'hands_only', 'crop_below_neck', 'back_view', 'silhouette',
  'first_person_pov', 'blank_face_3d', 'featureless_editorial'
];
export const POPULATION_MODES = ['single', 'group', 'crowd', 'single_group_or_crowd'];
export const CAMERA_FRAMINGS = [
  'hands_closeup', 'forearms_and_hands', 'crop_below_neck', 'back_view',
  'full_body_blank_face', 'object_or_animal', 'editorial_wide',
  'environmental_wide', 'isometric', 'top_down_system',
  'silhouette_profile', 'over_shoulder_faceless', 'extreme_scale_metaphor'
];

const DEFAULT_VISUAL_LANGUAGE = {
  primary_style: 'cinematic_realistic',
  supporting_styles: [],
  disabled_styles: []
};

export function validateAndNormalizeVisualIdentity(input) {
  const sourceVersion = String(input?.schema_version || '1');
  const result = {
    // preserve existing blocks...
    schema_version: VISUAL_IDENTITY_SCHEMA_VERSION,
    visual_language: normalizeVisualLanguage(input.visual_language, input.style),
    mode_routing: normalizeModeRouting(input.mode_routing),
    rendering: normalizeRendering(input.rendering),
    composition: normalizeComposition(input.composition),
    metaphor_engine: normalizeMetaphorEngine(input.metaphor_engine)
  };
  return enforceVisualIdentityInvariants(result, { sourceVersion });
}
```

**Required validation rules:**

- Exactly one `primary_style`.
- Supporting styles must be unique and cannot contain the primary style.
- Every route must reference the primary style or an enabled supporting style.
- Unknown routing values fall back to the primary style.
- `intentional_crowd` may be allowed only with faceless human treatment.
- Replace the meaning of `extra_people` with `unintended_people`; accept the old field as a compatibility alias.
- Preserve locked face/reflection/identity-drift guardrails.
- `normalizeLegacyVisualOverrides()` must keep working.

---

### 5.3 Modify: `lib/visual-override-resolver.js`

**Purpose:** Resolve style and narrative mode deterministically instead of falling back to generic cinematic language.

#### Code Sebelum (Current/Before)

```js
let stylePrompt = 'cinematic style, realistic details';
if (config.style.preset_key === 'cinematic_realistic') {
  stylePrompt = 'cinematic realistic style, highly detailed render';
} else if (config.style.preset_key === '3d_claymation_cozy') {
  stylePrompt = 'cozy 3D claymation style, soft textures, cute render';
}
```

#### Code Sesudah (Proposed/After)

```js
const narrativeFunction = normalizeNarrativeFunction(itemContext.narrativeFunction);
const activeStyleKey = resolveNarrativeStyle(config, narrativeFunction);
const styleDefinition = getVisualStyleDefinition(activeStyleKey);

const stylePrompt = joinPromptFragments([
  styleDefinition.prompt,
  buildRenderingPrompt(config.rendering),
  buildCompositionPrompt(config.composition),
  config.style.custom_description
]);

const resolved = {
  ...existingResolvedFields,
  active_visual_mode: activeStyleKey,
  narrative_function: narrativeFunction,
  visual_language_prompt: stylePrompt,
  mode_prompt: styleDefinition.prompt,
  composition_prompt: buildCompositionPrompt(config.composition),
  metaphor_prompt: buildMetaphorPrompt(config.metaphor_engine, itemContext),
  negative_prompt: buildNegativePrompt(config, styleDefinition)
};
```

**Required behavior:**

- Existing calls without `narrativeFunction` use `visual_language.primary_style`.
- Preserve all current resolved fields to avoid downstream regression.
- Deduplicate negative prompts.
- `itemContext` may include `narrativeFunction`, `concept`, `primaryObject`, and `visualAction`.
- Do not run a second AI call. Resolution must remain deterministic and synchronous after preset loading.

---

### 5.4 Modify: `lib/visual-identity-ai-contract.js`

**Purpose:** Validate new brief fields and AI schema v2 output.

#### Code Sebelum (Current/Before)

```js
export const AI_VISUAL_IDENTITY_PROMPT_VERSION = 'ai_visual_identity_v1';

const normalized = {
  seed,
  subject_kind,
  faceless_mode,
  audience,
  mood,
  wardrobe_direction,
  color_direction,
  environment_direction,
  lighting_direction,
  camera_direction,
  style_direction
};
```

#### Code Sesudah (Proposed/After)

```js
export const AI_VISUAL_IDENTITY_PROMPT_VERSION = 'ai_visual_identity_v2';

const normalized = {
  ...existingFields,
  population_mode: normalizeEnum(input.population_mode, POPULATION_MODES),
  primary_style: normalizeVisualStyle(input.primary_style),
  supporting_styles: normalizeVisualStyleList(input.supporting_styles),
  mode_routing: normalizeModeRouting(input.mode_routing),
  texture_direction: normalizeText(input.texture_direction),
  composition_direction: normalizeText(input.composition_direction),
  metaphor_direction: normalizeText(input.metaphor_direction)
};
```

**Compliance changes:**

- Keep `face_visibility` and `reflection_face` hard-locked.
- Report invalid or disabled route targets as deterministic corrections.
- Report duplicate styles and primary/supporting collisions.
- Allow an intentional faceless crowd; reject visible faces or identifiable facial detail.
- Do not treat the word “crowd” itself as a face-policy violation.

---

### 5.5 Modify: `lib/visual-identity-ai-builder.js`

**Purpose:** Make the existing one-call AI builder produce the full v2 identity structure.

#### Code Sebelum (Current/Before)

```js
### Enum Specifications (Strictly enforce):
- subject.kind: "human" | "blank_face_3d" | "animal" | "mascot_object"
// ...
"style": {
  "preset_key": "cinematic_realistic",
  "custom_description": "art style details...",
  "aspect_ratio": "9:16"
}
```

#### Code Sesudah (Proposed/After)

```js
### Visual Language Rules
- Never encode rendering style as subject.kind.
- Choose exactly one primary_style.
- Supporting styles must be compatible members of the same visual universe.
- Route narrative functions only to enabled styles.
- Preserve one primary idea per scene.
- Translate abstract concepts with CONCEPT → PHYSICAL OBJECT → VISUAL ACTION.

"visual_language": {
  "primary_style": "editorial_graphic_novel",
  "supporting_styles": ["isometric_society", "symbolic_surrealism"],
  "disabled_styles": ["clay_political_theater"]
},
"mode_routing": {
  "hook": "symbolic_surrealism",
  "context": "editorial_graphic_novel",
  "mechanism": "isometric_society",
  "consequence": "editorial_graphic_novel",
  "evidence_reveal": "paper_cutout_documentary",
  "conclusion": "symbolic_surrealism"
}
```

**Constraints:**

- Retain the Single-Pass/one-model-call behavior.
- AI output is untrusted until normalized by `validateAndNormalizeVisualIdentity()`.
- Refinement must return a complete replacement object and preserve untouched fields.
- Do not hardcode Wa’y Siyasi rules into the generic builder; provide them through the system preset and brief.

---

### 5.6 Modify: `lib/visual-identity-system-presets.js`

**Purpose:** Add a reusable built-in Wa’y Siyasi preset.

#### Code Sebelum (Current/Before)

```js
export const SYSTEM_VISUAL_IDENTITIES = [
  {
    key: 'hands_only_muslimah_sage_kitchen',
    version: 1,
    label: 'Muslimah Sage Kitchen',
    // ...
  }
];
```

#### Code Sesudah (Proposed/After)

```js
export const SYSTEM_VISUAL_IDENTITIES = [
  // Existing presets remain unchanged.
  {
    key: 'way_siyasi_editorial_system',
    version: 1,
    label: 'Wa’y Siyasi — Editorial System',
    description: 'Faceless political education through editorial, isometric, and symbolic modes.',
    config: {
      schema_version: '2',
      subject: {
        kind: 'human',
        faceless_mode: 'featureless_editorial',
        demographic_key: 'custom',
        population_mode: 'single_group_or_crowd',
        custom_description: 'Contemporary Southeast Asian citizens...'
      },
      visual_language: {
        primary_style: 'editorial_graphic_novel',
        supporting_styles: [
          'isometric_society',
          'symbolic_surrealism',
          'paper_cutout_documentary'
        ],
        disabled_styles: ['shadow_silhouette', 'clay_political_theater']
      },
      mode_routing: WAY_SIYASI_DEFAULT_ROUTING
      // Include rendering, composition, metaphor, camera, and guardrail blocks.
    }
  }
];
```

**Important:** Use typographic `Wa’y Siyasi` only for labels. Keep ASCII-safe `way_siyasi_editorial_system` for keys.

---

### 5.7 Modify: `app/components/AiVisualIdentityBuilderModal.js`

**Purpose:** Replace the single long form with the approved five-step interactive builder.

#### Code Sebelum (Current/Before)

```js
const [step, setStep] = useState('brief');
const [brief, setBrief] = useState({
  seed: '',
  purpose: '',
  subject_kind: 'human',
  faceless_mode: 'hands_only',
  // one flat form...
});
```

#### Code Sesudah (Proposed/After)

```js
const BUILDER_STEPS = [
  'foundation',
  'subject_system',
  'visual_language',
  'mode_routing',
  'review'
];

const [activeStep, setActiveStep] = useState(0);
const [brief, setBrief] = useState(createDefaultVisualIdentityBrief());

function setStyleRole(styleKey, role) {
  setBrief(current => applyExclusivePrimaryStyle(current, styleKey, role));
}

function updateRoute(narrativeFunction, styleKey) {
  setBrief(current => applyValidatedRoute(current, narrativeFunction, styleKey));
}
```

**Required UI behavior:**

- Follow `public/mockup_visual_identity_studio_v2.html` closely.
- Five clickable steps with Back/Continue navigation.
- Style cards have `Primary`, `Supporting`, and `Off` states.
- Selecting a new primary demotes the old primary to supporting.
- Route selects list only enabled styles.
- Disabling a routed style repairs affected routes to the primary style.
- Live summary shows subject, primary style, enabled modes, aspect ratio, and resolved prompt.
- Generate remains one Gemini request.
- Review still supports refine and “Continue Editing”.
- All colors must use semantic tokens from `app/theme.css`; no hex, RGB, or ad-hoc palette literals.
- The modal remains a Client Component because it uses state and event handlers.

---

### 5.8 Modify: `app/settings/visual-identities/page.js`

**Purpose:** Extend manual editing and preset cards so v2 identities are understandable outside the AI modal.

#### Code Sebelum (Current/Before)

```js
const SUBJECT_KINDS = ['human', 'blank_face_3d', 'animal', 'mascot_object'];
// Editor sections:
// Subject → Wardrobe → Environment → Lighting → Camera → Art Style → Guardrails
```

#### Code Sesudah (Proposed/After)

```js
import {
  VISUAL_LANGUAGE_CATALOG,
  NARRATIVE_FUNCTIONS
} from '../../../lib/visual-language-catalog';

// Editor sections:
// Foundation → Subject System → Visual Language → Mode Routing
// → Rendering & Composition → Existing advanced controls → Guardrails

function updateVisualLanguage(styleKey, role) {
  setConfig(current => updateStyleRole(current, styleKey, role));
}
```

**Required UI changes:**

- Preset cards show primary style plus supporting-style chips.
- Add a distinct “Multi-mode” badge when supporting styles exist.
- Display routing summary in the detail/editor view.
- Keep existing advanced subject/wardrobe/environment controls for compatibility.
- Present lifestyle-oriented controls as “Advanced” rather than the primary workflow for editorial presets.
- The Wa’y Siyasi system preset is read-only but cloneable, consistent with existing system presets.
- Maintain responsive behavior and semantic CSS tokens.

---

### 5.9 Modify: `scripts/test-visual-identity-foundation.mjs`

**Purpose:** Cover normalization, routing, resolver output, system preset, tenant isolation, and old-schema regressions.

#### Code Sebelum (Current/Before)

```js
const normalized = validateAndNormalizeVisualIdentity(validConfig);
assert.equal(normalized.subject.kind, 'human');
assert.equal(normalized.guardrails.face_visibility, 'prohibited');
```

#### Code Sesudah (Proposed/After)

```js
const normalized = validateAndNormalizeVisualIdentity(validConfig);
assert.equal(normalized.schema_version, '2');
assert.equal(normalized.subject.kind, 'human');
assert.equal(normalized.guardrails.face_visibility, 'prohibited');
assert.ok(normalized.visual_language.primary_style);

const waySiyasi = getSystemVisualIdentity('way_siyasi_editorial_system');
assert.equal(waySiyasi.config.visual_language.primary_style, 'editorial_graphic_novel');

const mechanism = await resolveVisualIdentity({
  presetRef: 'way_siyasi_editorial_system',
  itemContext: { narrativeFunction: 'mechanism' }
});
assert.equal(mechanism.resolved.active_visual_mode, 'isometric_society');
```

**Minimum new test cases:**

- v1 input normalizes to v2.
- Existing legacy mapper output remains valid.
- Duplicate supporting styles are removed.
- Primary/supporting collision is repaired.
- Invalid/disabled routing falls back to primary.
- Hook, mechanism, evidence, and conclusion resolve to expected Wa’y Siyasi modes.
- Intentional crowd does not weaken faceless rules.
- Negative prompts are deduplicated.
- Existing repository tenant-isolation tests continue to pass.

---

### 5.10 Modify: `scripts/test-ai-visual-identity-builder.mjs`

**Purpose:** Verify the v2 AI envelope, one-call behavior, refinement, and compliance corrections.

#### Code Sebelum (Current/Before)

```js
const mockOutputEnvelope = {
  label: 'Sage Morning Skincare',
  config: {
    schema_version: '1',
    style: { preset_key: 'cinematic_realistic', aspect_ratio: '9:16' }
  }
};
```

#### Code Sesudah (Proposed/After)

```js
const mockOutputEnvelope = {
  label: 'Wa’y Siyasi Editorial System',
  config: {
    schema_version: '2',
    visual_language: {
      primary_style: 'editorial_graphic_novel',
      supporting_styles: ['isometric_society', 'symbolic_surrealism'],
      disabled_styles: []
    },
    mode_routing: {
      hook: 'symbolic_surrealism',
      context: 'editorial_graphic_novel',
      mechanism: 'isometric_society',
      consequence: 'editorial_graphic_novel',
      evidence_reveal: 'editorial_graphic_novel',
      conclusion: 'symbolic_surrealism'
    }
  }
};
```

**Minimum new test cases:**

- Exactly one Gemini `generateContent()` call.
- Complete v2 output parses and resolves.
- Missing primary style is rejected or corrected deterministically.
- Disabled route target is corrected and reported.
- Refinement preserves unmodified v2 blocks.
- Face-visibility bypass is still rejected.
- Intentional faceless crowd output is accepted.
- Prompt explicitly separates subject kind from visual style.

---

## 6. Files Explicitly Out of Scope

Do not modify these unless a failing test proves it is necessary:

- `lib/visual-identity-repository.js` — JSONB storage already supports v2.
- `app/api/v2/visual-identities/route.js` — repository normalization is sufficient.
- `app/api/v2/visual-identities/[id]/route.js` — no new transport behavior required.
- PostgreSQL schema/bootstrap in `lib/db-pg.js` — no new column is needed.
- Campaign pipelines unrelated to resolved prompt consumption.
- Production deployment scripts.

If a change outside scope becomes necessary, document the reason in this file before editing it.

---

## 7. Prompt Assembly Contract

The final resolved prompt must assemble layers in this order:

1. Aspect ratio and output format.
2. Active visual mode prompt.
3. Subject/population and faceless treatment.
4. Scene-specific content.
5. Environment/system relationship.
6. Rendering, texture, palette, and lighting.
7. Composition and safe-zone constraints.
8. Metaphor instruction when enabled.
9. Negative prompt.

Example:

```text
(VERTICAL 9:16)
[VISUAL MODE] Isometric miniature society rendered as sophisticated editorial illustration...
[SUBJECT] Faceless simplified citizens; intentional group composition allowed...
[SCENE] Food distribution chain from farm to distributor to market to consumer...
[RENDERING] Restrained editorial palette, geometric shadows, subtle printed-paper grain...
[COMPOSITION] One primary idea, readable spatial flow, social UI safe zones...
[NEGATIVE] Visible facial features, stock-footage realism, decorative system without readable flow...
```

Do not require a second AI call to select the mode. The upstream planner/storyboard may supply `narrativeFunction`; otherwise the resolver uses the primary style.

---

## 8. Verification Commands

Run in this order:

```bash
npm run test:visual-identity
npm run test:ai-visual-identity
npm run build
```

If the integration test requires staging DB access, use the repository’s existing staging environment loader. Do not embed credentials or API keys in tests, scripts, fixtures, documentation, or placeholders.

Manual verification:

1. Open `/settings/visual-identities`.
2. Launch AI Visual Identity Studio Builder.
3. Confirm all five steps match the approved mockup flow.
4. Load or select Wa’y Siyasi.
5. Change the primary style and verify the previous primary becomes supporting.
6. Disable a routed style and verify its routes fall back to the primary style.
7. Verify live prompt changes with route selections.
8. Save, reopen, clone, and archive a user preset.
9. Verify the system preset is read-only and cloneable.
10. Verify light mode, dark mode, desktop, and narrow viewport.
11. Confirm existing lifestyle/clay presets still resolve as before.

---

## 9. Acceptance Criteria

Implementation is complete only when all statements are true:

- Schema v1 and legacy inputs normalize without errors.
- The six visual styles are represented as visual-language modes, never subject kinds.
- Exactly one primary style is enforced.
- Narrative routes can reference only enabled modes.
- Wa’y Siyasi’s default scene routing resolves deterministically.
- All six styles have explicit prompt fragments and negative prompts.
- Intentional groups/crowds work while human faces remain prohibited.
- Existing resolver fields are preserved for downstream consumers.
- Gemini generation/refinement remains one call per operation.
- System preset `way_siyasi_editorial_system` is available and cloneable.
- AI Builder and manual editor follow the approved UX.
- UI uses only semantic CSS tokens and works in light/dark mode.
- Focused tests pass.
- Production build passes.
- No real secret, secret-shaped placeholder, or credential is committed.
- `implementation_plan.md` has an up-to-date checked task list.

---

## 10. Mandatory Agent Antigravity Instructions

1. Work from the repository root and read `AGENTS.md` before editing.
2. Read the relevant local Next.js documentation before changing App Router code. Do not rely on remembered Next.js behavior.
3. Treat the approved mockup as the UX contract, but implement it with existing ContentFlow components and semantic CSS tokens.
4. Use `apply_patch` for code and documentation edits.
5. Preserve all unrelated working-tree changes. Never reset, checkout, clean, or overwrite user work.
6. Do not add the six visual styles to `SUBJECT_KINDS`.
7. Do not introduce a database migration unless objective evidence shows JSONB storage is insufficient.
8. Do not introduce a second Gemini call. The builder and Strategic Campaign architecture remain single-pass.
9. Keep safety normalization deterministic and server-side. Client validation is only a usability layer.
10. Do not hardcode colors. Use semantic tokens defined by `app/theme.css`.
11. Do not place credentials or real-looking secret strings in code, tests, fixtures, prompts, docs, or UI placeholders.
12. Update `## Execution Task List` after every completed stage—not only at the end.
13. Do not deploy to production. Production deployment requires a separate explicit user instruction.
14. After successful verification, run the mandatory release command:

```bash
npm run release-non-interactive -- --type patch --title "Visual Identity Studio v2" --points "Tambah multi-mode visual language dan narrative routing|Tambah preset editorial Wa’y Siyasi|Pertahankan kompatibilitas preset Visual Identity lama"
```

15. Verify the release tag and `main` were pushed to `https://github.com/sabeq83/maknaflow.git`.
16. Final report must list changed files, tests/build results, release version/tag, push verification, remaining risks, and explicitly state that production was not deployed.

---

## 11. Stop Conditions

Stop and ask the user before proceeding if:

- The approved mockup must be materially redesigned.
- Implementing v2 requires destructive migration of existing presets.
- A production deployment is requested implicitly rather than explicitly.
- Existing unrelated changes overlap the same lines and cannot be preserved safely.
- The agent finds that a second AI call is unavoidable; explain why before changing the architecture.
