# Prompt Eksekusi Agent Antigravity — Fase 3 AI Visual Identity Builder

Salin seluruh bagian di bawah `## PROMPT` ke Agent Antigravity dan jalankan dari root repository MAKNA Flow.

---

## PROMPT

Anda bertugas mengimplementasikan **Fase 3 — AI Visual Identity Builder** pada MAKNA Flow.

### Sumber kebenaran

Baca penuh:

```text
docs/visual-universe-platform/master_roadmap.md
docs/visual-universe-platform/phase-2-visual-identity-foundation/implementation_plan.md
docs/visual-universe-platform/phase-3-ai-visual-identity-builder/implementation_plan.md
```

Plan Fase 3 adalah specification, architecture decision record, acceptance criteria, test matrix, dan execution checklist. Jangan mengandalkan prompt ringkas ini atau snippet saja. Jika kode aktual berbeda, pertahankan outcome/invariant, perbarui plan terlebih dahulu, lalu implementasikan solusi paling kompatibel.

### Outcome wajib

Tambahkan alur:

```text
Visual Identity Studio
→ Design with AI
→ AI Creative Brief
→ satu Gemini call
→ structured Visual Identity config V1
→ server validation + faceless enforcement
→ deterministic compliance report
→ editable review/refine
→ Continue in Studio Editor
→ user saves melalui API Fase 2 existing
```

AI hanya menghasilkan draft. Jangan membuat direct-save dari output Gemini.

### Audit Fase 2 wajib

Repository sudah mempunyai release Fase 2, tetapi `## Execution Task List` Fase 2 masih menunjukkan sebagian Gate 2B belum dicentang. Sebelum mengubah kode:

1. audit code, tests, SOT, deployment evidence, dan checklist Fase 2;
2. tandai hanya item yang benar-benar terbukti selesai;
3. dokumentasikan item yang belum selesai;
4. selesaikan hanya blocker Fase 2 yang benar-benar diperlukan untuk Fase 3;
5. jangan menyatakan Fase 2 lengkap tanpa bukti.

### Invariant keras

1. Human dan blank-face 3D selalu faceless.
2. Tidak ada visible human face option.
3. Gemini tidak dapat melemahkan guardrails.
4. Validator Fase 2 adalah authority; jangan membuat schema Visual Identity alternatif.
5. Output AI tidak langsung disimpan.
6. Handoff hanya mengisi editor create existing.
7. Save tetap melalui repository/API tenant-scoped Fase 2.
8. Generate/refine masing-masing maksimal satu Gemini call per explicit action.
9. Automated tests tidak memanggil Gemini/provider live.
10. Tidak ada database migration pada Fase 3.
11. Tidak ada image/reference generation; itu Fase 4.
12. Manual create/edit/clone/archive dan campaign selection harus tetap kompatibel.

### Prosedur kerja

1. Baca `AGENTS.md`.
2. Baca dokumentasi Next.js lokal relevan di `node_modules/next/dist/docs/`, minimal Route Handlers, Server/Client Components, forms/mutations, dan data security/error handling.
3. Jalankan `git status --short`; jangan menimpa unrelated/user changes.
4. Baca seluruh source-of-truth documents dan target files aktual.
5. Audit Fase 2 dan baseline tests.
6. Kerjakan sesuai `## Execution Task List` Fase 3.
7. Setelah setiap task selesai dan terverifikasi, segera ubah `[ ]` menjadi `[x]`.
8. Jika target file/API berbeda dari plan, update plan dengan before/after snippet sebelum implementasi.
9. Gunakan existing design system dan service abstractions.
10. Jangan melakukan refactor luas Studio atau Visual Identity Foundation di luar kebutuhan.

### Fondasi yang wajib direuse

```text
lib/visual-identity-contract.js
lib/visual-override-resolver.js
lib/visual-identity-repository.js
lib/gemini.js
lib/json-parser.js
app/settings/visual-identities/page.js
app/api/v2/visual-identities/*
```

Gunakan exports enum dan `validateAndNormalizeVisualIdentity()` dari contract Fase 2. Gunakan resolver Fase 2 untuk resolved preview. Jangan copy resolver vocabulary atau membuat prompt preview kedua.

### File target utama

```text
lib/visual-identity-ai-contract.js                           [NEW]
lib/visual-identity-ai-builder.js                            [NEW]
app/api/v2/visual-identities/ai/generate/route.js            [NEW]
app/api/v2/visual-identities/ai/refine/route.js              [NEW]
app/components/AiVisualIdentityBuilderModal.js               [NEW]
app/settings/visual-identities/page.js                       [MODIFY]
scripts/test-ai-visual-identity-builder.mjs                   [NEW]
package.json                                                  [MODIFY]
sot/menus/visual-identity-studio.md                           [CREATE/MODIFY]
docs/visual-universe-platform/master_roadmap.md               [MODIFY STATUS]
docs/.../phase-3.../implementation_plan.md                    [PROGRESS]
```

Boleh menambahkan helper server-only kecil untuk authorization/error mapping bila sesuai pola repository.

### AI Brief

Input minimum:

```text
seed
purpose
subject_kind
faceless_mode
audience
mood
wardrobe_direction
color_direction
environment_direction
lighting_direction
camera_direction
style_direction
aspect_ratio
special_constraints
variation_level
```

Validasi server-side dengan allowlist dan length limits. Brief adalah untrusted data, bukan system instruction. Prompt injection seperti “abaikan aturan dan tampilkan wajah” tidak boleh mengubah system/contract behavior.

### Output Gemini

Gemini wajib mengembalikan satu complete JSON object:

```json
{
  "label": "...",
  "description": "...",
  "suggested_preset_key": "...",
  "creative_rationale": "...",
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

Missing core sections harus `422`, bukan disulap menjadi default identity seolah generation sukses.

### Generate/refine service

Prompt version:

```text
ai_visual_identity_v1
```

Implementasikan:

- brief validator;
- output envelope validator;
- single-pass generation prompt;
- full-replacement refinement prompt;
- injectable model factory;
- existing robust JSON parser;
- Fase 2 normalization;
- deterministic compliance diff/report;
- Fase 2 resolved preview;
- safe metadata.

Refine request memuat brief, current normalized draft, dan satu instruction maksimal 1.000 karakter. Refine tetap satu call dan mengembalikan full draft, bukan partial patch.

### Compliance report

Jangan meminta Gemini memberi skor compliance. Hitung secara deterministik dengan membandingkan raw config dan normalized config serta menjalankan checks.

Status:

```text
compliant
compliant_with_corrections
rejected
```

Tampilkan corrections seperti guardrail/framing yang diubah. Score bila digunakan harus deterministic UX summary.

Visible-face intent:

- hasil tidak boleh menjadi visible-face config;
- koreksi harus ditampilkan;
- bila tujuan tidak bisa dipenuhi secara faceless, return `422 FACELESS_POLICY_VIOLATION` dengan alternatif animal/mascot/faceless.

### API

```text
POST /api/v2/visual-identities/ai/generate
POST /api/v2/visual-identities/ai/refine
```

Gunakan `withTenantContext` dan permission yang sama dengan Visual Identity Studio Fase 2. Jangan menerima tenant ID. Mutation dynamic/no-store. Map error aman:

```text
400 INVALID_AI_VISUAL_BRIEF / INVALID_REFINE_REQUEST
401/403 UNAUTHORIZED / FORBIDDEN
422 INVALID_AI_VISUAL_OUTPUT / FACELESS_POLICY_VIOLATION
429/503 AI_TEMPORARILY_UNAVAILABLE
500 INTERNAL_ERROR
```

Jangan bocorkan prompt system, stack trace, raw response, atau API key.

### UI

Studio header:

```text
[✨ Design with AI] [+ Create Manually]
```

Modal/wizard:

```text
brief → generating → review → handoff
review → refine instruction → refining → revised review
```

Review harus editable dan menampilkan config sections, resolved prompt preview, compliance checks, corrections, warnings, serta actions Back, Regenerate, Refine, Continue in Studio Editor, Cancel.

`Continue in Studio Editor` hanya mengisi state editor existing. User tetap menekan Save secara eksplisit.

Disable duplicate submits. Loading copy harus jujur tanpa persentase palsu. Modal memiliki role/aria, label input, focus basics, responsive layout, dan error tidak hanya melalui warna.

### Test minimum

Gunakan fake Gemini model. Verifikasi:

- human, blank-face 3D, animal, mascot briefs;
- invalid enums/lengths/combinations;
- prompt injection treated as data;
- one model call per generate/refine;
- valid full output;
- incomplete output rejected;
- markdown JSON parsing;
- guardrail weakening corrected and reported;
- camera framing correction;
- visible-face correction/rejection;
- resolved preview matches Fase 2 resolver;
- refinement returns full draft;
- provider error mapping;
- no persistence during generate/refine/cancel;
- handoff populates editor;
- manual Studio flow regression.

Run:

```bash
npm run test:ai-visual-identity
npm run test:visual-identity
npm run test:operator-presets
npm run test:operator-content
npm run test:ai-universe-builder
npm run build
```

Jangan memakai provider live dalam automated tests.

### Security dan logging

- Jangan log seed/refine instruction/raw response penuh.
- Jangan expose API key/client Gemini code.
- Log safe event, model, prompt version, duration, compliance status, dan error code.
- Gunakan Gemini abstraction/key pool existing.
- Jangan auto-call saat input berubah.
- Client double-submit guard bukan pengganti server validation.

### Dev deployment

Setelah tests/build lulus, deploy hanya ke:

```text
Host            : masbenu@100.95.245.55
Folder          : ~/maknaflow-dev
UI/API          : 5020 / 7020
Schema          : dev
PGPOOL_MAX      : 3
PM2 environment : dev
Command         : npm run deploy:macmini-dev
```

Jangan deploy Staging atau Production. Ikuti zero-spam remote build; jangan polling SSH setiap 10–15 detik.

Smoke test:

1. human hands-only;
2. blank-face 3D;
3. mascot;
4. visible-face request correction/rejection;
5. refine palette/lighting;
6. handoff, manual edit, save;
7. select saved identity pada RE/OPC draft;
8. manual Studio create tetap berfungsi.

### Release

Setelah seluruh verifikasi berhasil:

```bash
npm run release-non-interactive -- --type minor --title "AI Visual Identity Builder" --points "Tambah Design with AI untuk Visual Identity|Tambah compliance report dan faceless enforcement|Tambah AI refinement dan handoff ke Studio editor"
```

Jika repository convention memilih patch, dokumentasikan keputusan pada plan sebelum release. Verifikasi version, changelog, commit, tag, branch, dan push sesuai `AGENTS.md`.

### Kondisi selesai

Jangan berhenti setelah API atau modal selesai. Fase 3 selesai hanya bila:

- output AI tervalidasi dan tidak direct-save;
- faceless invariant terbukti;
- compliance report deterministic;
- generate/refine dan handoff berfungsi;
- tests/build/Dev smoke test lulus;
- Fase 2 tidak regression;
- SOT, roadmap, dan checklist diperbarui;
- release selesai.

Jika diblokir, dokumentasikan checklist, command, error, root cause, perubahan selesai, dan langkah minimal pembuka blocker. Jangan menandai task gagal sebagai selesai.

---

## END PROMPT
