# **BLUEPRINT SISTEM: CONTENT PLANNER WEB APP (SOT)**

## 1. Purpose

This document defines the technical architecture required for a web application to generate a structured Content Planner with the following output columns:

| Pillar | Category CEP | W'S Matrix | Context | VFO | Strategic Angle | Hook | Visual Action | Product |
|---|---|---|---|---|---|---|---|---|

The architecture is designed to use:

- `STRATEGIC_FRAMEWORKS.md` as the strategic knowledge layer.
- `STRATEGIC_DECISION_TREE.md` as the orchestration and decision layer.
- Brand-specific data as the contextual input layer.
- AI generation as the creative execution layer.
- Deterministic validation as the quality-control layer.

The system must prevent the AI from generating planner rows through free improvisation. Every output row must be produced through a controlled decision pipeline.

---

# 2. Core Architecture Principle

The system separates four responsibilities:

```text
KNOWLEDGE
Defines available strategic concepts.

DECISION
Determines which concepts should be selected.

GENERATION
Transforms selected concepts into Hook and Visual Action.

VALIDATION
Checks compatibility, duplication, compliance, and completeness.
```

Main flow:

```text
User Input
    ↓
Brand Context Loader
    ↓
Strategic Candidate Builder
    ↓
Strategic Decision Engine
    ↓
Creative Generation Engine
    ↓
Validation Engine
    ↓
Planner Database
    ↓
Planner Table UI
```

---

# 3. System Layers

## 3.1. Presentation Layer

The frontend provides:

- Brand selector
- Platform selector
- Product selector
- Content pillar selector
- Number of planner rows
- Planner generation button
- Editable planner table
- Lock-column function
- Regenerate-row function
- Regenerate-cell function
- Approve/reject function
- Export to CSV/XLSX
- Save as campaign

Recommended pages:

```text
/planner/create
/planner/{planner_id}
/planner/{planner_id}/edit
/planner/{planner_id}/history
/settings/brands
/settings/products
/settings/pillars
/settings/knowledge-bases
```

---

## 3.2. Application Layer

The application layer controls the workflow.

Main services:

```text
PlannerApplicationService
BrandContextService
StrategicCandidateService
StrategicDecisionService
CreativeGenerationService
ValidationService
SimilarityService
PlannerPersistenceService
ExportService
```

The application layer does not define strategic theory. It only coordinates services.

---

## 3.3. Knowledge Layer

The knowledge layer contains reusable strategic and publishing instructions.

### Core Strategic Knowledge

```text
STRATEGIC_FRAMEWORKS.md
STRATEGIC_DECISION_TREE.md
NARRATIVE_STRUCTURE.md
REALIST_VIRAL_NARRATIVE.md
VISUAL_STYLE_GUIDE.md
PROMPT_SYSTEM.md
```

### Publishing Knowledge

```text
BRAND_VOICE_GUIDE.md
PLATFORM_COPYWRITING_GUIDE.md
CTA_RULES.md
COMPLIANCE_GUIDE.md
SEO_GUIDE.md
```

### Brand-Specific Knowledge

```text
BRAND_PROFILE
CONTENT_PILLARS
PRODUCT_KNOWLEDGE
AUDIENCE_PROFILE
PLATFORM_PROFILE
```

Knowledge sources may be stored as Markdown, database records, or both.

Recommended principle:

```text
Markdown = human-readable source of truth
Database = structured runtime representation
```

---

# 4. Input Contract

The planner generation endpoint receives structured input.

Example:

```json
{
  "brand_id": "nutribake",
  "platform": "tiktok",
  "product_ids": [
    "premium_cocoa_powder"
  ],
  "pillar_ids": [
    "healthy_breakfast",
    "healthy_drinks",
    "healthy_dessert",
    "healthy_lifestyle"
  ],
  "planner_count": 12,
  "selling_intent": "soft_sell",
  "communication_intent": "educate",
  "language": "id-ID",
  "visual_mode": "faceless_hands_only",
  "trend_mode": "optional",
  "diversity_mode": "balanced"
}
```

Required inputs:

- `brand_id`
- `platform`
- `planner_count` (Opsi dropdown: 6, 12, 18, 24, 30 — disesuaikan dengan kelipatan 6 CEP Categories)
- `product_ids` / `product_name` (Mendukung Pencarian/Filtering Produk Database Interaktif)

Optional inputs:

- Selling intent
- Communication intent
- Audience segment
- Campaign objective
- Visual style
- Language
- Trend context
- Product priority
- Pillar distribution
- CEP distribution
- VFO distribution

---

## 4.1. 2-Step Execution Architecture
1. **Penyimpanan Draft (`createDraftContentPlanner`)**:
   - Form modal generator memproses pembuatan *Draft Content Planner* secara instan.
   - Metadata planner (produk, USP, platform, objective, `planner_count`) disimpan ke tabel `content_planners` dengan `status = 'draft'`.
2. **Eksekusi AI Pipeline (`executeContentPlanner`)**:
   - Eksekusi 3-Fase AI Pipeline tidak berjalan otomatis saat submit form, melainkan dipicu secara terpisah via tombol **"🚀 Eksekusi AI Pipeline"** pada kartu (card) planner di Dashboard atau halaman Detail Workbench.
   - Memperbarui `status` planner dari `'draft'` -> `'generating'` -> `'completed'`.

---

## 4.2. Historical Anti-Repetition Memory (HARM)
1. **Compact History Digest Extraction (`getProductHistoryDigest`)**:
   - Mencegah pengulangan ide/konten pada produk yang sama di waktu berbeda (misal: planner 22 Juli vs 27 Juli).
   - Backend mengekstrak riwayat *angles*, *contexts*, dan *hook keywords* 60 baris terbaru untuk produk target.
   - Data riwayat dikompres menjadi rangkuman ringkas (~300 - 500 token) dan diinjeksikan sebagai *Exclusion List* di System Instruction Gemini.
2. **Rotasi Offset CEP & VFO (`buildDistributionPlan`)**:
   - `offsetIndex` dihitung berdasarkan total baris historis produk (`totalRows`).
   - Rotasi CEP & VFO dihitung dengan formula `(i + offsetIndex) % total` sehingga siklus awal fondasi strategi berputar secara kontinu.
3. **Dynamic Temperature Tuning**:
   - Produk baru tanpa riwayat: `temperature = 0.7`.
   - Produk yang sudah memiliki riwayat planner: `temperature = 0.85` untuk mendorong AI mengeksplorasi skenario cerita & metafora baru.

## 4.3. Video ID Generation & Google Sheets Sync Specification
1. **Video ID Naming Convention**:
   - Setiap baris plan mendapatkan kode `video_id` unik yang disimpan ke tabel `content_planner_rows`.
   - Format: `[namaakun]-[12digitalfanumerik]` (Contoh: `sabeq_skincare-k9m2x4p8q3n7`).
   - `namaakun` disanitasi menjadi huruf kecil tanpa spasi atau karakter khusus.

2. **Google Sheets Tab Auto-Sync**:
   - Jika `google_sheet_id` diisi pada parameter planner, backend secara otomatis menuliskan baris plan ke Google Sheet target menggunakan client OAuth2 Google terpusat (`lib/google-auth.js`).
   - **Nama Tab**: Sesuai `account_name` (misal: `sabeq_skincare`). Jika tab belum ada, sistem akan membuatnya secara otonom.
   - **Header Kolom (Persis)**:
     `['ID Video', 'Hook', 'Nama Produk', 'Link Affiliate', 'Link Produk']`
   - **Mode Penulisan**: *Append Mode* (menambahkan baris baru di bawah data existing tanpa menimpa data yang sudah ada).

---

# 5. Runtime Context Assembly

Before generation, the system builds one runtime context object.

Example:

```json
{
  "brand": {},
  "audience": {},
  "products": [],
  "pillars": [],
  "platform": {},
  "strategic_framework": {},
  "decision_tree": {},
  "publishing_rules": {},
  "existing_planner_rows": [],
  "generation_constraints": {}
}
```

The context assembler must only load relevant information.

Example:

```text
If selected product = Premium Cocoa Powder

Load:
- Product attributes
- Product use cases
- Product visual characteristics
- Product prohibited claims
- Compatible pillars
- Compatible formats

Do not load:
- Unrelated products
- Unrelated brand profiles
- Unused platform rules
```

This reduces prompt noise and strategic drift.

---

# 6. Data Model

## 6.1. Brands

```text
brands
- id
- name
- description
- audience_profile_id
- brand_voice_id
- default_platform
- language
- status
- created_at
- updated_at
```

---

## 6.2. Content Pillars

```text
content_pillars
- id
- brand_id
- name
- description
- objective
- allowed_product_categories
- preferred_cep_types
- preferred_vfo_types
- is_active
```

Example:

```json
{
  "id": "healthy_breakfast",
  "brand_id": "nutribake",
  "name": "Healthy Breakfast",
  "objective": "Provide practical healthy breakfast inspiration",
  "preferred_cep_types": [
    "routine_based",
    "problem_solution_based"
  ],
  "preferred_vfo_types": [
    "concrete",
    "instinctive"
  ]
}
```

---

## 6.3. Products

```text
products
- id
- brand_id
- name
- category
- description
- features
- outcomes
- use_cases
- visual_properties
- prohibited_claims
- allowed_pillars
- status
```

Example:

```json
{
  "id": "premium_cocoa_powder",
  "name": "Premium Cocoa Powder",
  "features": [
    "fine cocoa powder",
    "dark brown color",
    "easy to mix"
  ],
  "outcomes": [
    "adds chocolate flavor",
    "creates rich visual color"
  ],
  "use_cases": [
    "oatmeal",
    "smoothie",
    "warm drink",
    "dessert"
  ],
  "visual_properties": [
    "powder fall",
    "brown swirl",
    "macro texture"
  ],
  "prohibited_claims": [
    "cures disease",
    "guarantees weight loss"
  ]
}
```

---

## 6.4. CEP Types

```text
cep_types
- id
- name
- definition
- selection_conditions
- preferred_ws_dimensions
```

Values:

```text
problem_solution_based
routine_based
commitment_based
aspirational_based
opportunistic_based
emotional_based
```

---

## 6.5. W'S Dimensions

```text
ws_dimensions
- id
- name
- description
```

Values:

```text
when
where
with_for_whom
how_feeling
while
with_what
why
trigger
```

---

## 6.6. W'S Matrix Patterns

```text
ws_matrix_patterns
- id
- name
- dimensions
- compatible_cep_types
- context_template
- priority
```

Example:

```json
{
  "id": "when_while",
  "name": "When + While Doing What",
  "dimensions": [
    "when",
    "while"
  ],
  "compatible_cep_types": [
    "routine_based",
    "commitment_based"
  ]
}
```

---

## 6.7. VFO Types

```text
vfo_types
- id
- name
- definition
- selection_conditions
```

Values:

```text
concrete
instinctive
uncharted
aspirational
```

---

## 6.8. Strategic Angles

```text
strategic_angles
- id
- name
- set_type
- psychological_driver
- compatible_vfo_types
- compatible_cep_types
- recommended_narrative_modes
- prohibited_conditions
```

Example:

```json
{
  "id": "the_life_hack",
  "name": "The Life Hack",
  "set_type": "logic_utility",
  "psychological_driver": "efficiency",
  "compatible_vfo_types": [
    "concrete"
  ],
  "compatible_cep_types": [
    "routine_based",
    "problem_solution_based",
    "commitment_based"
  ]
}
```

---

## 6.9. Planner

```text
planners
- id
- brand_id
- platform
- objective
- planner_count
- status
- generation_version
- created_at
- updated_at
```

---

## 6.10. Planner Rows

```text
planner_rows
- id
- planner_id
- sequence
- pillar_id
- cep_type_id
- ws_matrix_pattern_id
- context
- vfo_type_id
- strategic_angle_id
- narrative_mode
- hook
- visual_action
- product_id
- selling_intent
- communication_intent
- validation_status
- similarity_score
- generation_metadata
- is_locked
- created_at
- updated_at
```

---

# 7. Planner Generation Pipeline

## Phase 1 — Pre-Generation Validation

Before AI generation, validate:

- Brand exists.
- Product belongs to brand.
- Product is compatible with selected pillar.
- Planner count is valid.
- Required knowledge bases are active.
- Platform rules are available.
- Content pillars are active.

If validation fails, generation must stop.

---

## Phase 2 — Distribution Planning

Before generating individual rows, create a distribution plan.

Example for 12 rows:

```json
{
  "pillar_distribution": {
    "healthy_breakfast": 3,
    "healthy_drinks": 3,
    "healthy_dessert": 3,
    "healthy_lifestyle": 3
  },
  "cep_distribution": {
    "routine_based": 3,
    "problem_solution_based": 2,
    "emotional_based": 2,
    "aspirational_based": 2,
    "commitment_based": 2,
    "opportunistic_based": 1
  },
  "vfo_distribution": {
    "concrete": 4,
    "instinctive": 3,
    "uncharted": 2,
    "aspirational": 3
  }
}
```

The distribution plan prevents random repetition.

---

## Phase 3 — Strategic Skeleton Generation

Generate only the strategic skeleton first.

Output:

```json
{
  "pillar": "Healthy Breakfast",
  "cep_category": "Routine-Based",
  "ws_matrix": "When + While Doing What",
  "context": "Pukul 06.30 sebelum berangkat kerja",
  "vfo": "Concrete",
  "strategic_angle": "The Life Hack",
  "product": "Premium Cocoa Powder"
}
```

At this phase, do not generate Hook or Visual Action.

---

## Phase 4 — Strategic Skeleton Validation

Validate:

```text
Pillar ↔ Product
Pillar ↔ CEP
CEP ↔ W'S Matrix
W'S Matrix ↔ Context
Product ↔ VFO
VFO ↔ Strategic Angle
CEP ↔ Strategic Angle
```

If one relation is invalid:

```text
Regenerate only the invalid field and its downstream fields.
```

Example:

```text
Invalid VFO
→ regenerate VFO
→ regenerate Strategic Angle
→ regenerate Hook
→ regenerate Visual Action
```

Do not regenerate the entire row unless necessary.

---

## Phase 5 — Creative Generation

After the strategic skeleton is approved, generate:

- Hook
- Visual Action

Creative generation input:

```json
{
  "pillar": "Healthy Breakfast",
  "cep": "Routine-Based",
  "ws_matrix": "When + While Doing What",
  "context": "Pukul 06.30 sebelum berangkat kerja",
  "vfo": "Concrete",
  "strategic_angle": "The Life Hack",
  "product": "Premium Cocoa Powder",
  "platform": "TikTok",
  "brand_voice": {},
  "visual_style": {}
}
```

Creative generation output:

```json
{
  "hook": "Sarapan cokelat cuma 2 menit? Besok pagi wajib coba ini.",
  "visual_action": "Top view oatmeal, susu dituang, lalu Premium Cocoa Powder ditabur hingga membentuk swirl cokelat."
}
```

---

## Phase 6 — Creative Validation

Validate:

### Hook Alignment

The Hook must:

- Reflect Context
- Reflect VFO
- Express Strategic Angle
- Match platform style
- Avoid unsupported claims
- Avoid changing the selected product

### Visual Alignment

The Visual Action must:

- Be physically executable
- Show the selected product
- Demonstrate the selected VFO
- Support the selected Angle
- Follow the selected visual style
- Avoid adding unrelated products
- Avoid violating compliance rules

---

## Phase 7 — Batch Diversity Validation

Compare all rows in the batch.

Check:

- Duplicate hook
- Similar opening phrase
- Duplicate context
- Duplicate strategic angle
- Duplicate visual action
- Excessive CEP repetition
- Excessive product usage
- Excessive pillar repetition

Recommended thresholds:

```text
Hook semantic similarity > 0.85
→ regenerate Hook

Context semantic similarity > 0.90
→ regenerate Context and downstream fields

Visual Action similarity > 0.85
→ regenerate Visual Action

Same Angle repeated more than configured quota
→ select another compatible Angle
```

---

## Phase 8 — Persistence

Save:

- User input
- Strategic skeleton
- Final output
- Validation result
- AI model version
- Prompt version
- Knowledge-base version
- Regeneration history
- Similarity score

This makes the planner auditable and reproducible.

---

# 8. AI Call Architecture

Recommended architecture uses three AI calls.

## AI Call 1 — Strategic Skeleton Generator

Purpose:

```text
Generate:
- Pillar
- CEP
- W'S Matrix
- Context
- VFO
- Strategic Angle
- Product
```

Constraints:

- Must follow Strategic Framework.
- Must follow Strategic Decision Tree.
- Must return strict JSON.
- Must not generate Hook.
- Must not generate Visual Action.

---

## AI Call 2 — Creative Generator

Purpose:

```text
Generate:
- Hook
- Visual Action
```

Constraints:

- Strategic skeleton is locked.
- AI may not replace CEP, VFO, Angle, Pillar, or Product.
- Must apply brand, platform, narrative, and visual rules.

---

## AI Call 3 — Reviewer

Purpose:

```text
Review:
- Strategic compatibility
- Hook alignment
- Visual feasibility
- Compliance
- Duplication
```

Output:

```json
{
  "status": "pass",
  "issues": [],
  "fields_to_regenerate": []
}
```

Failure example:

```json
{
  "status": "fail",
  "issues": [
    {
      "field": "hook",
      "reason": "Hook does not express The Life Hack angle."
    }
  ],
  "fields_to_regenerate": [
    "hook"
  ]
}
```

---

# 9. Deterministic Rules vs AI Responsibilities

## Deterministic Code Must Handle

- Valid IDs
- Product-to-pillar compatibility
- CEP-to-W'S compatibility
- VFO-to-angle compatibility
- Quota distribution
- Duplicate counting
- Required columns
- JSON schema
- Row order
- Save/update/delete
- Export
- Locking fields
- Validation status

## AI Must Handle

- Natural-language context
- Strategic interpretation
- Hook writing
- Visual-action writing
- Cultural adaptation
- Platform adaptation
- Controlled variation

The AI must not be responsible for database integrity.

---

# 10. API Design

## Generate Planner

```http
POST /api/planners
```

Request:

```json
{
  "brand_id": "nutribake",
  "platform": "tiktok",
  "product_ids": ["premium_cocoa_powder"],
  "pillar_ids": [
    "healthy_breakfast",
    "healthy_drinks",
    "healthy_dessert",
    "healthy_lifestyle"
  ],
  "planner_count": 12
}
```

Response:

```json
{
  "planner_id": "pln_001",
  "status": "generating"
}
```

---

## Get Planner

```http
GET /api/planners/{planner_id}
```

---

## Regenerate Row

```http
POST /api/planners/{planner_id}/rows/{row_id}/regenerate
```

Request:

```json
{
  "scope": "row",
  "locked_fields": [
    "pillar",
    "product"
  ]
}
```

---

## Regenerate Field

```http
POST /api/planners/{planner_id}/rows/{row_id}/regenerate-field
```

Request:

```json
{
  "field": "hook"
}
```

---

## Validate Planner

```http
POST /api/planners/{planner_id}/validate
```

---

## Export Planner

```http
GET /api/planners/{planner_id}/export?format=xlsx
```

Supported formats:

```text
csv
xlsx
json
markdown
```

---

# 11. Output Schema

The AI must return strict JSON.

```json
{
  "planner_rows": [
    {
      "pillar_id": "healthy_breakfast",
      "pillar": "Healthy Breakfast",
      "cep_category_id": "routine_based",
      "cep_category": "Routine-Based",
      "ws_matrix_id": "when_while",
      "ws_matrix": "When + While Doing What",
      "context": "Pukul 06.30 sebelum berangkat kerja",
      "vfo_id": "concrete",
      "vfo": "Concrete",
      "strategic_angle_id": "the_life_hack",
      "strategic_angle": "The Life Hack",
      "hook": "Sarapan cokelat cuma 2 menit? Besok pagi wajib coba ini.",
      "visual_action": "Top view oatmeal, susu dituang, lalu Premium Cocoa Powder ditabur hingga membentuk swirl cokelat.",
      "product_id": "premium_cocoa_powder",
      "product": "Premium Cocoa Powder"
    }
  ]
}
```

No additional prose is allowed in the AI response.

---

# 12. Planner Table UI

Required columns:

```text
Pillar
Category CEP
W'S Matrix
Context
VFO
Strategic Angle
Hook
Visual Action
Product
```

Optional operational columns:

```text
Status
Validation
Similarity Score
Locked Fields
Generation Version
Actions
```

Row actions:

```text
Edit
Lock
Regenerate Hook
Regenerate Visual
Regenerate Strategy
Duplicate
Delete
Approve
```

---

# 13. Regeneration Logic

Regeneration follows dependency direction.

```text
Pillar
    ↓
CEP
    ↓
W'S Matrix
    ↓
Context
    ↓
VFO
    ↓
Strategic Angle
    ↓
Narrative Mode
    ↓
Hook
    ↓
Visual Action
```

Rules:

```text
Change Pillar
→ regenerate all downstream fields.

Change CEP
→ regenerate W'S Matrix, Context, VFO, Angle, Hook, Visual.

Change Context
→ review Hook and Visual.

Change VFO
→ regenerate Angle, Hook, Visual.

Change Strategic Angle
→ regenerate Hook and Visual.

Change Hook
→ Visual may remain unchanged if still aligned.

Change Product
→ regenerate VFO, Angle, Hook, Visual.
```

Locked fields cannot be changed by regeneration.

---

# 14. Knowledge-Base Loading Strategy

Do not send all KB files in every AI call.

Use scoped loading.

## Strategic Skeleton Call

Load:

```text
STRATEGIC_FRAMEWORKS
STRATEGIC_DECISION_TREE
BRAND_PROFILE
CONTENT_PILLARS
PRODUCT_KNOWLEDGE
AUDIENCE_PROFILE
```

## Creative Call

Load:

```text
Selected strategic skeleton
NARRATIVE_STRUCTURE
REALIST_VIRAL_NARRATIVE
VISUAL_STYLE_GUIDE
BRAND_VOICE
PLATFORM_COPYWRITING
COMPLIANCE
```

## Caption Call

Load:

```text
Approved planner row
BRAND_VOICE
PLATFORM_COPYWRITING
CTA_RULES
SEO_GUIDE
COMPLIANCE
```

This reduces token usage and prevents conflicting instructions.

---

# 15. Prompt-Version Management

Every prompt must have a version.

```text
planner_strategy_v1
planner_creative_v1
planner_review_v1
```

Store:

```text
prompt_versions
- id
- name
- version
- system_prompt
- output_schema
- status
- created_at
```

Every planner row must record the prompt version used.

---

# 16. Knowledge-Base Version Management

Store KB metadata:

```text
knowledge_bases
- id
- name
- version
- category
- file_path
- parsed_content
- status
- checksum
- created_at
```

Planner generation must save:

```json
{
  "knowledge_versions": {
    "strategic_framework": "47.9.6",
    "strategic_decision_tree": "1.0",
    "brand_voice": "1.0",
    "compliance": "1.0"
  }
}
```

This makes past planner outputs reproducible.

---

# 17. Failure Handling

## Invalid JSON

Action:

```text
Retry once using JSON repair prompt.
If still invalid, mark generation as failed.
```

## Strategic Incompatibility

Action:

```text
Regenerate only invalid strategic fields.
```

## Compliance Failure

Action:

```text
Regenerate Hook and/or Visual Action.
Do not change approved strategy unless required.
```

## Duplicate Output

Action:

```text
Inject excluded contexts, angles, and phrases.
Regenerate only duplicated fields.
```

## AI Timeout

Action:

```text
Save partial planner.
Mark unfinished rows as pending.
Allow manual retry.
```

---

# 18. Recommended Generation Sequence

For a 21-row planner:

```text
1. Validate input.
2. Build pillar distribution.
3. Build CEP distribution.
4. Build VFO distribution.
5. Generate 21 strategic skeletons.
6. Validate all skeletons.
7. Repair invalid skeletons.
8. Generate Hooks and Visual Actions.
9. Validate creative outputs.
10. Run batch similarity check.
11. Regenerate duplicates.
12. Save final planner.
13. Display table.
```

---

# 19. Minimum Viable Product

The first implementation only needs:

```text
Brand selector
Product selector
Pillar selector
Planner count
Strategic skeleton generator
Hook generator
Visual Action generator
Validation
Planner table
CSV export
```

MVP services:

```text
PlannerService
AIService
ValidationService
DatabaseService
ExportService
```

Do not build trend analysis, vector search, analytics feedback, or automatic content production in the first version.

---

# 20. Future Expansion

After the planner module is stable, it can feed:

```text
Planner Row
    ↓
Storyboard Generator
    ↓
Scene Generator
    ↓
T2I / I2V / T2V Prompt Generator
    ↓
Voice-Over Generator
    ↓
Caption Generator
    ↓
Publishing Scheduler
    ↓
Analytics Feedback
    ↓
Strategic Optimization
```

Future database connection:

```text
planner_rows.id
→ storyboard.planner_row_id
→ scenes.storyboard_id
→ generated_assets.scene_id
→ published_posts.generated_asset_id
→ analytics.published_post_id
```

This preserves traceability from strategy to performance.

---

# 21. Final Architecture

```text
┌──────────────────────────────────────────────┐
│                  FRONTEND                    │
│ Input Form | Planner Table | Edit | Export   │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│              APPLICATION LAYER               │
│ PlannerApplicationService                    │
│ DistributionService                          │
│ RegenerationService                          │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│             STRATEGIC ENGINE                 │
│ Strategic Framework                          │
│ Strategic Decision Tree                      │
│ Compatibility Matrix                         │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│              AI GENERATION LAYER             │
│ Strategic Skeleton Generator                 │
│ Hook Generator                               │
│ Visual Action Generator                      │
│ Reviewer                                     │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│              VALIDATION LAYER                │
│ Schema | Compatibility | Compliance          │
│ Similarity | Diversity | Feasibility         │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│                 DATA LAYER                   │
│ Brands | Pillars | Products | Planners       │
│ Planner Rows | KB Versions | Prompt Versions │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│                   OUTPUT                     │
│ Planner Table | CSV | XLSX | JSON | Markdown │
└──────────────────────────────────────────────┘
```

---

# 22. Final Responsibility Map

| Component | Responsibility |
|---|---|
| Strategic Framework | Defines CEP, VFO, Intent, Angles, Narrative foundations, and strategic theory. |
| Strategic Decision Tree | Defines execution order, selection logic, and dependencies. |
| Brand Data | Defines brand, audience, pillars, and products. |
| Planner Engine | Coordinates strategic selection and generation. |
| AI Generator | Produces context, Hook, and Visual Action within locked constraints. |
| Validator | Checks structure, compatibility, compliance, diversity, and feasibility. |
| Database | Stores inputs, outputs, versions, and history. |
| Frontend | Allows users to generate, review, edit, lock, regenerate, and export planners. |

The planner must be treated as a structured strategic artifact, not as a free-form AI response.
