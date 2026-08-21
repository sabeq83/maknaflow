# Master Roadmap — MAKNA Visual Universe Platform

## 1. Visi

MAKNA Flow berkembang dari aplikasi dengan preset visual hardcoded menjadi platform yang memungkinkan tenant:

1. membangun story universe dengan AI;
2. membuat visual identity faceless yang reusable;
3. merancang visual identity melalui bahasa alami;
4. menghasilkan, menyetujui, dan mengunci reference assets untuk menjaga konsistensi lintas konten dan campaign.

Platform ini mempunyai dua domain yang berkaitan tetapi tidak digabung:

```text
Universe                              Visual Identity
├─ premise                            ├─ faceless mode
├─ tone                               ├─ subject/character direction
├─ characters                         ├─ wardrobe & color palette
├─ locations                          ├─ environment
├─ story rules                        ├─ lighting & camera
└─ content pillars                    └─ immutable guardrails
          │                                      │
          └──────────── Campaign ────────────────┘
                        │
                        └─ snapshot konfigurasi dan reference versions
```

Universe menjawab **apa dunia dan ceritanya**. Visual Identity menjawab **bagaimana dunia atau campaign divisualisasikan**.

## 2. Status Saat Ini

### Fase 1 — AI Universe Builder MVP: selesai

Kapabilitas yang sudah tersedia:

- creative brief dan tiga AI brief suggestions;
- single-pass Gemini generation untuk profile, karakter, dan lokasi;
- editable review sebelum save;
- strict contract dan faceless guardrail untuk human universe;
- atomic persistence;
- universe langsung kompatibel dengan Content Planner/campaign;
- AI character image generation dan penyimpanan `reference_image_path` dasar.

Dokumen Fase 1:

```text
docs/ai-universe-builder/implementation_plan.md
docs/ai-universe-builder/antigravity_agent_prompt.md
```

Catatan penamaan: release sebelumnya pernah memakai label “Fase 2” untuk Creative Brief Generator. Roadmap ini menggunakan nama kapabilitas sebagai identitas utama agar tidak ambigu.

## 3. Roadmap

| Tahap | Nama kapabilitas | Outcome utama | Dependency |
|---|---|---|---|
| Fase 1 | AI Universe Builder MVP | AI menghasilkan universe draft yang direview dan disimpan atomik | Selesai |
| Fase 2 | Visual Identity Foundation | User-defined reusable visual presets, centralized resolver, campaign snapshot | Fase 1 |
| Fase 3 | AI Visual Identity Builder | Natural-language-to-visual-identity dengan review dan compliance report | Fase 2 |
| Fase 4 | Visual Consistency Assets | Versioned reference assets, approval, prompt injection, preflight | Fase 2–3 |

## 4. Shared Invariants

Invariant berikut berlaku pada seluruh fase dan tidak boleh dilonggarkan oleh UI, AI, preset, atau API request:

### 4.1 Faceless-only human representation

Mode human yang diizinkan:

- `hands_only`;
- `crop_below_neck`;
- `back_view`;
- `silhouette`;
- `blank_face_3d`;
- `first_person_pov` tanpa wajah/refleksi wajah.

Tidak tersedia mode full visible human face. Guardrail minimum:

- no visible face;
- no eyes, nose, or mouth untuk blank-face 3D;
- no reflection showing face;
- no unintended extra person;
- no identity drift;
- no wardrobe drift;
- mode-specific framing mandate.

Guardrail dijalankan secara deterministik di server. AI hanya dapat memperkaya konfigurasi, bukan mematikan aturan.

### 4.2 Tenant isolation

- Semua user preset dan asset tenant-scoped.
- `tenant_id` tidak boleh dipercaya dari request body.
- System preset bersifat global, read-only, immutable, dan versioned di code.
- Slug/key custom preset unik per tenant.

### 4.3 Reference plus immutable snapshot

Objek aktif menyimpan referensi ke preset/version, sedangkan campaign menyimpan resolved snapshot pada saat dibuat:

```text
visual_identity_preset_id + visual_identity_preset_version
visual_overrides_json = immutable resolved snapshot
```

Edit preset tidak boleh mengubah campaign lama. Retry campaign memakai snapshot existing, bukan preset terbaru.

### 4.4 Backward compatibility

- Campaign lama yang hanya mempunyai `visual_overrides_json` tetap berjalan.
- Existing system VSO keys tetap dapat di-resolve.
- Existing operator presets tetap valid.
- Tidak ada destructive migration atau forced rewrite seluruh campaign lama.

### 4.5 Centralized resolution

Seluruh consumer memakai satu contract dan resolver. Tidak boleh ada prompt builder atau worker baru yang membaca constant VSO secara langsung bila shared resolver dapat digunakan.

### 4.6 AI review boundary

Output AI selalu menjadi draft. User review/approval diperlukan sebelum preset atau reference menjadi aktif.

## 5. Fase 2 — Visual Identity Foundation

### Outcome

- Visual Identity Studio untuk CRUD user preset;
- system dan user preset dalam satu catalog API;
- structured config untuk character, wardrobe, palette, environment, lighting, camera, dan guardrails;
- centralized resolver menghasilkan legacy-compatible snapshot;
- reusable selector pada campaign forms;
- campaign menyimpan reference ID/version dan immutable snapshot;
- legacy inline VSO tetap dapat dibaca dan diedit sebagai `Custom / Legacy`.

### Delivery gates

#### Gate 2A — Foundation

- contract;
- schema/migration;
- repository/API;
- system catalog adapter;
- centralized resolver;
- compatibility tests.

#### Gate 2B — Studio and consumers

- Visual Identity Studio UI;
- shared selector/editor component;
- RE, OPC/Pillar, Sheets Autopilot, Import Planner, Multiplier, Recipe Labs integration;
- operator preset compatibility;
- regression and Dev smoke test.

Detail:

```text
docs/visual-universe-platform/phase-2-visual-identity-foundation/implementation_plan.md
```

## 6. Fase 3 — AI Visual Identity Builder

### Outcome

User menulis visual direction dengan bahasa alami, Gemini mengembalikan structured draft sesuai contract Fase 2, server menambahkan faceless guardrail dan compliance report, lalu user mengedit dan menyimpan sebagai preset.

### Scope awal

- `Design with AI` pada Visual Identity Studio;
- brief: subject, wardrobe, palette, environment, lighting, camera, mood, constraint;
- satu structured AI call;
- editable review;
- `resolved prompt preview`;
- deterministic faceless compliance report;
- regenerate full draft;
- optional refinement instruction setelah MVP stabil.

### Entry criteria

- contract Fase 2 stabil;
- user preset CRUD stabil;
- resolver dipakai seluruh consumer utama;
- campaign snapshot semantics teruji.

### Exit criteria

- AI tidak dapat menghasilkan/mengaktifkan visible human face;
- output invalid tidak dapat disimpan;
- AI preset dapat dipakai tanpa special-case pada campaign consumer;
- tidak ada API key/provider logic di client.

## 7. Fase 4 — Visual Consistency Assets

### Outcome

Visual identity dan universe mempunyai approved, versioned reference assets yang dapat diinjeksi secara konsisten ke image/video generation serta di-snapshot pada campaign.

### Scope awal

- generic `universe_reference_assets` atau nama domain-neutral yang disepakati;
- owner: universe, character, location, atau visual identity;
- role: identity, wardrobe, location, visual_style, palette/reference_sheet;
- version dan lifecycle `draft`, `approved`, `archived`;
- generate/upload reference;
- approval dan active version selection;
- character reference sheet;
- location/style reference generation;
- prompt/reference injection;
- visual consistency preflight;
- campaign reference-version snapshot;
- lineage provider/prompt/output tanpa secret.

### Existing capability yang harus direuse

Character AI Image Generation dan `reference_image_path` sudah tersedia. Fase 4 memperluas dan memigrasikannya secara kompatibel; tidak membuat pipeline kedua yang bersaing.

### Entry criteria

- Visual Identity IDs dan versions stabil;
- snapshot semantics Fase 2 terbukti;
- AI builder Fase 3 memakai contract yang sama;
- asset storage/provider existing sudah diaudit.

## 8. Dokumen dan Sequencing

Rencana detail dibuat berurutan:

1. master roadmap ini;
2. plan dan prompt Fase 2;
3. implementasi, release, dan audit Fase 2;
4. plan dan prompt Fase 3 berdasarkan hasil aktual;
5. implementasi, release, dan audit Fase 3;
6. plan dan prompt Fase 4 berdasarkan schema/reference pipeline aktual.

Jangan menulis detail final Fase 3–4 berdasarkan asumsi sebelum dependency fase sebelumnya stabil.

## 9. Definition of Platform Complete

Platform dianggap lengkap ketika:

- user dapat membangun universe dan visual identity tanpa mengedit prompt mentah;
- seluruh human representation tetap faceless;
- visual identity reusable lintas campaign;
- campaign lama tetap reproducible melalui snapshot;
- system preset dan user preset menggunakan resolver yang sama;
- AI hanya menghasilkan draft yang tervalidasi;
- approved reference asset menjaga konsistensi karakter, wardrobe, lokasi, dan style;
- seluruh data tenant-scoped, versioned, auditable, dan backward-compatible.

