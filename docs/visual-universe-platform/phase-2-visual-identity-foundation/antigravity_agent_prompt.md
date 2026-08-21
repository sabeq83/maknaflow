# Prompt Eksekusi Agent Antigravity — Fase 2 Visual Identity Foundation

Salin seluruh bagian di bawah `## PROMPT` ke Agent Antigravity dan jalankan dari root repository MAKNA Flow.

---

## PROMPT

Anda bertugas mengimplementasikan **Fase 2 — Visual Identity Foundation** pada MAKNA Flow.

### Sumber kebenaran

Baca penuh:

```text
docs/visual-universe-platform/master_roadmap.md
docs/visual-universe-platform/phase-2-visual-identity-foundation/implementation_plan.md
```

Implementation plan adalah specification, architecture decision record, test matrix, dan execution checklist utama. Jangan bekerja hanya dari prompt ringkas ini atau snippet. Bila kode/schema aktual berbeda, pertahankan invariant dan outcome, perbarui plan dengan temuan aktual, lalu implementasikan desain paling kompatibel.

### Outcome wajib

Ubah VSO hardcoded menjadi Visual Identity Foundation:

```text
System Visual Identities + Tenant User Visual Identities
                         ↓
              Central Contract/Resolver
                         ↓
        immutable visual_overrides_json snapshot
                         ↓
RE / OPC-Pillar / Sheets / Import / Multiplier / Recipe / Workers
```

User harus dapat membuat, mengedit, clone, preview, dan archive reusable Visual Identity preset melalui `/settings/visual-identities`.

### Invariant keras

1. Human representation tetap faceless-only.
2. Tidak ada full visible human face option di UI, API, preset, atau resolver.
3. Guardrail ditambahkan/dikunci secara deterministik di server; AI/payload tidak dapat mematikannya.
4. Semua user preset tenant-scoped; `tenant_id` request body tidak dipercaya.
5. System preset immutable dan tidak disimpan sebagai editable DB row.
6. Campaign menyimpan preset ID/version dan immutable resolved snapshot.
7. Retry/regenerate campaign existing memakai snapshot, bukan live preset.
8. Campaign legacy yang hanya memiliki `visual_overrides_json` harus tetap berjalan.
9. Operator preset tetap merupakan config campaign lengkap; jangan menggantinya dengan Visual Identity preset.
10. Jangan melakukan forced backfill atau destructive migration.

### Prosedur wajib

1. Baca `AGENTS.md`.
2. Karena Next.js repository memiliki breaking changes, baca relevant local docs di:

   ```text
   node_modules/next/dist/docs/
   ```

   Minimal Route Handlers, Server/Client Components, data mutation/forms, dan error/security docs.
3. Jalankan `git status --short`; jangan menimpa unrelated/user changes.
4. Baca penuh master roadmap dan implementation plan.
5. Audit seluruh file/tabel aktual sebelum mengedit. Verifikasi khusus nama tabel Sheets Autopilot dan seluruh persistence path VSO.
6. Jalankan baseline tests.
7. Kerjakan sesuai urutan `## Execution Task List`.
8. Setelah task benar-benar selesai dan terverifikasi, ubah `[ ]` menjadi `[x]` pada implementation plan.
9. Jika fakta aktual mengubah daftar file/schema, update plan terlebih dahulu dengan before/after snippet yang benar.
10. Gunakan migration idempotent, non-destructive, dan advisory lock.

### Delivery gates

#### Gate 2A — Foundation

- structured contract;
- legacy normalization;
- faceless guardrail;
- system catalog;
- DB migration/repository;
- CRUD/clone/archive/resolve APIs;
- centralized resolver;
- foundation tests.

Jangan mulai migrasi UI luas sebelum Gate 2A stabil.

#### Gate 2B — Studio dan consumers

- Visual Identity Studio;
- shared selector/editor;
- campaign API server-side resolution;
- RE, OPC/Pillar, Sheets, Import Planner, Multiplier, Recipe integration;
- operator preset compatibility;
- worker/prompt/export/regenerate migration;
- regression, build, Dev smoke test.

Fase 2 belum selesai bila hanya Gate 2A yang selesai.

### Contract target

Gunakan structured config V1 dari plan dengan sections:

```text
subject
wardrobe
environment
lighting
camera
style
guardrails
```

Human modes yang diperbolehkan:

```text
hands_only
crop_below_neck
back_view
silhouette
blank_face_3d
first_person_pov
```

Animal/mascot dapat memakai `not_applicable`. Wajah kartun hewan/maskot bukan human face.

Server wajib memvalidasi kompatibilitas mode/framing dan mengunci:

```text
face_visibility = prohibited
reflection_face = prohibited
extra_people = prohibited
identity_drift = prohibited
wardrobe_drift = prohibited
```

### Persistence target

Buat tenant-scoped `visual_identity_presets` untuk user presets. System presets tetap di code.

Tambahkan nullable lineage pada tabel campaign aktual yang menyimpan VSO:

```text
visual_identity_preset_id
visual_identity_preset_version
```

Pertahankan:

```text
visual_overrides_json = immutable resolved snapshot
```

Snapshot harus memiliki identity ref, structured config, resolved prompt parts, dan compatibility legacy mapping. Jangan memuat secret, raw credentials, atau filesystem-internal information.

### API target

```text
GET    /api/v2/visual-identities
POST   /api/v2/visual-identities
GET    /api/v2/visual-identities/:id
PUT    /api/v2/visual-identities/:id
DELETE /api/v2/visual-identities/:id       # archive only
POST   /api/v2/visual-identities/:id/clone
POST   /api/v2/visual-identities/resolve
```

Use existing auth/tenant primitives. System preset write/archive ditolak. User update menaikkan version. Archive tidak merusak snapshot lama.

### Resolver target

`lib/visual-override-resolver.js` menjadi authoritative resolver dan menyediakan:

- resolve selected preset/inline/legacy submission;
- build immutable snapshot;
- resolve existing snapshot deterministically per item;
- legacy wrapper untuk consumer yang belum dimigrasikan.

Resolution priority:

```text
existing campaign snapshot
→ inline campaign customization
→ selected visual identity preset
→ legacy VSO payload
→ safe default
```

Jangan membaca live preset ketika retry/regenerate campaign lama.

### UI target

Tambahkan menu dan halaman:

```text
/settings/visual-identities
```

Studio minimum:

- System Presets / My Presets / Archived;
- create/edit/clone/archive;
- subject/faceless mode;
- wardrobe, colors, material, sleeves, accessories;
- environment, material palette, props;
- lighting;
- camera/framing;
- style/aspect ratio;
- locked guardrails;
- resolved text prompt preview.

Tidak ada AI generation atau reference image generation pada Fase 2.

Buat shared `VisualIdentitySelector` untuk campaign forms. Server tetap authoritative saat membentuk snapshot; client hanya mengirim selection/inline intent.

### Consumer target

Audit dan migrasikan minimal:

```text
app/re-campaigns/page.js
app/pillar-campaigns/page.js
app/sheets-autopilot/page.js
app/components/ImportPlannerModal.js
app/multiplier-lab/page.js
app/recipe-labs/page.js
app/settings/presets/page.js

app/api/v2/re-campaigns/route.js
app/api/v2/re-campaigns/bulk/route.js
app/api/v2/pillar-campaigns/route.js
app/api/v2/pillar-campaigns/bulk/route.js
app/api/sheets-autopilot/route.js

lib/prompts.js
lib/scheduler-processors.js
lib/sheets-autopilot-worker.js
lib/pillar-campaign-ingest.js
lib/culinary-sequence-engine.js
lib/export-builder.js
lib/operator-presets.js
lib/operator-content-contract.js
```

Jangan hanya mengubah UI. Seluruh server create/bulk paths harus resolve dan menyimpan snapshot secara konsisten.

### Backward compatibility

- Legacy JSON dengan `subject_demographic`, `wardrobe_style`, `lighting_style`, dan `visual_style_preset` harus tetap dikenali.
- Legacy random/sequential wardrobe harus tetap deterministic.
- Existing system mascot keys harus tetap resolve.
- Existing operator presets tetap valid tanpa rewrite.
- Existing campaign detail/export/regenerate tetap bekerja.
- Direct constant lookup boleh dipertahankan sebagai deprecated compatibility vocabulary, tetapi business resolution baru harus terpusat.

### Test minimum

Tanpa provider berbayar, verifikasi:

- contract/enum/cross-field validation;
- all human faceless modes;
- visible face escape attempts rejected;
- locked guardrails cannot be weakened;
- legacy mapping human/stylized/mascot;
- deterministic sequential/stable-random resolution;
- system/user catalog merge;
- tenant isolation;
- system immutability;
- clone/update version/archive;
- duplicate key conflict;
- campaign ID/version/snapshot persistence;
- snapshot immutability after preset edit;
- retry after preset archive;
- legacy campaign processing;
- bulk route consistency;
- item regenerate uses parent snapshot;
- operator preset compatibility;
- Studio and selector states;
- build.

Run at minimum:

```bash
npm run test:visual-identity
npm run test:operator-presets
npm run test:operator-content
npm run test:content-planner
npm run test:ai-universe-builder
node scripts/test-opc-integrity.mjs
npm run build
```

Tambahkan integration tests dengan schema dev/test yang aman. Jangan menghapus data existing secara luas.

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

Jangan deploy Staging atau Production. Ikuti zero-spam remote-build rule; jangan polling SSH setiap 10–15 detik.

Smoke test:

1. create human hands-only preset;
2. verify visible face invalid;
3. clone system preset;
4. create mascot preset;
5. use identities in RE and OPC/Pillar;
6. edit preset and verify old campaign snapshot unchanged;
7. archive preset and retry old campaign;
8. run one legacy campaign path;
9. inspect lineage and export/detail output.

### Release

Setelah Gate 2A dan 2B serta Dev smoke test selesai:

```bash
npm run release-non-interactive -- --type minor --title "Visual Identity Foundation" --points "Tambah Visual Identity Studio dan user presets|Pusatkan resolver visual dan faceless guardrail|Tambah immutable campaign snapshot dan legacy compatibility"
```

Jika convention repository mengharuskan patch, dokumentasikan alasan di implementation plan sebelum release. Verifikasi version, changelog, commit, tag, branch, dan push sesuai `AGENTS.md`.

### Kondisi berhenti

Jangan berhenti setelah menulis schema/API atau hanya menyelesaikan Studio. Fase selesai hanya bila:

- Gate 2A dan 2B selesai;
- seluruh consumer utama termigrasi;
- legacy campaign tetap berjalan;
- snapshot immutability terbukti;
- faceless escape path tidak ada;
- tests/build/Dev smoke test lulus;
- SOT dan checklist diperbarui;
- release selesai.

Jika diblokir, tuliskan task, command, error, root cause, perubahan yang selesai, dan langkah minimal pembuka blocker. Jangan menandai task gagal sebagai selesai.

---

## END PROMPT
