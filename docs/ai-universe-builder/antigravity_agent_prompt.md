# Prompt Eksekusi untuk Agent Antigravity — AI Universe Builder MVP

Salin seluruh bagian di bawah `## PROMPT` ke Agent Antigravity dan jalankan dari root repository MAKNA Flow yang benar.

---

## PROMPT

Anda bertugas mengimplementasikan **Fase 1 — AI Universe Builder MVP** pada repository MAKNA Flow.

### Sumber kebenaran

Baca penuh dan ikuti:

```text
docs/ai-universe-builder/implementation_plan.md
```

Dokumen tersebut adalah specification, architecture decision record, acceptance criteria, dan execution checklist utama. Jangan bekerja hanya dari ringkasan prompt ini. Bila fakta kode aktual berbeda dari snippet, pertahankan outcome dan invariant plan, gunakan pendekatan paling kompatibel, lalu dokumentasikan deviasi pada implementation plan.

### Outcome yang wajib tercapai

Tambahkan alur:

```text
Universe Manager
→ + New Universe
→ Build with AI (primary/recommended)
→ Creative Brief
→ satu call Gemini single-pass
→ strict JSON validation + deterministic guardrail
→ editable Review
→ user approval
→ atomic save profile + characters + locations
→ universe langsung tersedia di Content Planner/campaign existing
```

Pertahankan:

- `Use a Preset` existing;
- form kosong existing dengan label baru `Manual Setup`;
- schema universe existing;
- compatibility dengan Content Planner, campaign, manifest, dan tenant isolation.

### Larangan arsitektur

- Jangan menyimpan hasil Gemini langsung tanpa review pengguna.
- Jangan menyimpan draft AI ke database pada Fase 1.
- Jangan membuat call Gemini terpisah untuk profile, karakter, dan lokasi. Gunakan satu single-pass generation call.
- Jangan memanggil Gemini di dalam database transaction.
- Jangan menaruh API key atau Gemini logic di Client Component.
- Jangan mempercayai validasi UI atau output Gemini sebagai boundary keamanan.
- Jangan menerima `tenant_id` dari request body.
- Jangan mengizinkan wajah terlihat untuk universe bertipe human.
- Jangan menambahkan VSO user presets/Visual Identity Studio; itu Fase 2.
- Jangan melakukan refactor besar pada Universe Manager di luar kebutuhan fitur.
- Jangan deploy ke Staging atau Production.

### Prosedur kerja wajib

1. Baca `AGENTS.md` dan seluruh instruksi repository.
2. Repository memakai Next.js dengan breaking changes. Baca dokumentasi lokal yang relevan di:

   ```text
   node_modules/next/dist/docs/
   ```

   Minimal baca Route Handlers, Server/Client Components, data mutation/forms, dan error handling yang relevan.
3. Jalankan:

   ```bash
   git status --short
   ```

   Jangan menimpa perubahan user atau unrelated changes.
4. Baca penuh implementation plan, SOT Universe Manager, serta seluruh file target aktual.
5. Jalankan baseline test yang relevan sebelum perubahan.
6. Kerjakan sesuai urutan `## Execution Task List`.
7. Setelah setiap task selesai dan terverifikasi, segera ubah checkbox `[ ]` menjadi `[x]` pada:

   ```text
   docs/ai-universe-builder/implementation_plan.md
   ```

8. Jangan menandai task selesai hanya karena kode sudah ditulis.
9. Gunakan `apply_patch` untuk perubahan file manual dan pertahankan formatting existing.
10. Jangan mengubah atau menghapus unrelated user changes.

### File target utama

```text
lib/universe-ai-contract.js                         [NEW]
lib/universe-ai-builder.js                          [NEW]
lib/universe-ai-repository.js                       [NEW]
app/api/v2/universe-ai/generate/route.js            [NEW]
app/api/v2/universe-ai/instantiate/route.js         [NEW]
app/components/AiUniverseBuilderModal.js             [NEW]
app/settings/universes/page.js                       [MODIFY]
scripts/test-ai-universe-builder.mjs                 [NEW]
package.json                                         [MODIFY]
sot/menus/universe-manager.md                        [MODIFY]
docs/ai-universe-builder/implementation_plan.md      [PROGRESS]
```

Boleh menambahkan file test/helper kecil bila benar-benar diperlukan. Jangan memperluas scope tanpa alasan teknis yang didokumentasikan.

### Kontrak implementasi

#### Generate

```text
POST /api/v2/universe-ai/generate
```

- Gunakan `withTenantContext`.
- Validate/normalize creative brief dengan allowlist dan length limit.
- Panggil Gemini melalui abstraction existing di `lib/gemini.js`.
- Gunakan prompt version `universe_builder_v1`.
- Gunakan satu call untuk profile, characters, locations, rules, negative prompts, dan pillars.
- Parse memakai utility existing, lalu lakukan strict contract validation.
- Missing/empty/wrong-shaped Gemini output wajib menghasilkan `422`, bukan fallback universe generik.
- Return draft ke client; jangan insert database.

#### Review

- Wizard mempunyai state `brief`, `generating`, `review`, `saving`, `success`, dan `error` yang jelas.
- Pengguna dapat mengedit profile, karakter, dan lokasi.
- Pengguna dapat menambah/menghapus karakter dan lokasi sebelum save.
- `Regenerate Draft` menjalankan ulang generate berdasarkan brief terbaru.
- Disable duplicate submit.
- Jangan tampilkan raw provider error atau secret.

#### Instantiate

```text
POST /api/v2/universe-ai/instantiate
```

- Gunakan `withTenantContext`.
- Revalidate seluruh reviewed draft di server.
- Ignore unknown/untrusted fields.
- Normalisasi slug, character keys, dan location keys.
- Check tenant-scoped slug uniqueness.
- Insert profile, characters, dan locations dalam satu PostgreSQL transaction.
- Roll back seluruh hasil bila satu insert gagal.
- Map unique conflict ke HTTP `409`.
- Merge immutable `rules_json.ai_origin` dari allowlisted server metadata.
- Refresh universe manifest cache setelah commit secara best-effort.

### Faceless invariant

Untuk seluruh universe `human`:

- visible human face dilarang;
- `depiction_policy` wajib;
- depiction character hanya `faceless`, `back_view`, `silhouette`, atau `environment_only`;
- `normal` harus ditolak ketika save;
- negative prompts wajib melarang visible face, facial features, reflection showing face, dan identity drift;
- canonical prompt harus memuat instruksi faceless sesuai depiction mode;
- historical/islamic-history menambahkan anti-anachronism rule;
- tidak ada request flag untuk mematikan guardrail.

Guardrail ini wajib deterministic di server. Prompt Gemini saja tidak cukup.

### UI

Pada starter picker tampilkan:

```text
Build with AI (Recommended) | Use a Preset | Manual Setup
```

Creative Brief minimum:

- Universe Name;
- Purpose;
- Knowledge Domain;
- Universe Type;
- Target Audience;
- Premise/Idea;
- Tone;
- Visual Direction;
- Character Count 1–5;
- Location Count 1–5;
- Content Pillars;
- Special Constraints;
- Historical Period conditional;
- Freeform Brief.

Review minimum:

- Universe Profile;
- Characters;
- Locations;
- Story & Continuity Rules;
- Content Pillars & Negative Prompts;
- faceless warning untuk human universe;
- Back, Regenerate, dan Save actions.

Pertahankan visual language aplikasi existing. Pastikan responsive, keyboard-accessible secara dasar, memiliki `role="dialog"`, `aria-modal`, label input, focus behavior, dan error tidak dinyatakan melalui warna saja.

### Status/error contract

Gunakan status dan stable error code yang konsisten:

```text
400 INVALID_BRIEF / INVALID_DRAFT
401/403 authentication/authorization
409 SLUG_CONFLICT
422 INVALID_AI_OUTPUT / FACELESS_POLICY_VIOLATION
429/503 AI_TEMPORARILY_UNAVAILABLE
500 INTERNAL_ERROR
```

Jangan bocorkan stack trace, API key, prompt mentah, atau raw Gemini response.

### Test minimum wajib

Tambahkan test tanpa call Gemini berbayar untuk:

- valid animal, mascot, dan human brief;
- enum/count/length invalid;
- malformed atau incomplete Gemini draft;
- exact character/location count;
- duplicate normalized keys;
- human `normal` depiction rejection;
- faceless policy/negative prompts;
- unknown field stripping;
- prompt version dan single-pass contract;
- tenant body override rejection;
- provider error mapping;
- atomic success;
- rollback pada insert failure;
- slug conflict `409`;
- preset/manual regression;
- universe hasil AI dapat dibaca oleh manifest/Content Planner.

Gunakan fake/injected Gemini response untuk test. Jangan membuat biaya provider eksternal untuk automated tests.

### Verifikasi

Jalankan secara proporsional:

```bash
npm run test:ai-universe-builder
node scripts/test-universe-field-mapping.js
npm run test:content-planner
npm run build
```

Jika ada test integration database yang ditambahkan, jalankan terhadap environment test/dev yang benar dan jangan menghapus data existing secara luas.

### Deployment Dev

Setelah tests dan build berhasil, deploy hanya ke:

```text
SSH host       : masbenu@100.95.245.55
Remote folder  : ~/maknaflow-dev
UI port        : 5020
API port       : 7020
Database schema: dev
PM2 environment: dev
PGPOOL_MAX     : 3
Deploy command : npm run deploy:macmini-dev
```

- Jangan menjalankan `npm run deploy:staging`.
- Jangan deploy ke `~/maknaflow-staging`.
- Jangan deploy Production tanpa perintah manual eksplisit.
- Ikuti zero-spam mode: jangan polling SSH setiap 10–15 detik; tunggu sekitar dua menit sebelum pemeriksaan lanjutan.

Smoke test Dev minimum:

1. Generate, review, edit, dan save satu `mascot_object` universe.
2. Generate, review, edit, dan save satu `human` faceless universe.
3. Pastikan guardrail menolak human character `normal`.
4. Pastikan kedua universe muncul di Universe Manager dan dapat dipilih di Content Planner.
5. Pastikan Create from Preset dan Manual Setup masih bekerja.

### Release SOP

Setelah seluruh implementasi dan verifikasi berhasil, jalankan:

```bash
npm run release-non-interactive -- --type patch --title "AI Universe Builder MVP" --points "Tambah AI Universe Builder single-pass|Tambah review dan atomic save universe|Tambah faceless guardrail untuk human universe"
```

Verifikasi version, changelog, commit, tag, push branch `main`, dan push tag ke repository target sesuai `AGENTS.md`.

### Kondisi selesai

Jangan berhenti setelah menulis kode. Tugas selesai hanya bila:

- acceptance criteria terpenuhi;
- checklist diperbarui berdasarkan bukti aktual;
- tests dan build berhasil, atau blocker eksternal terdokumentasi lengkap;
- Dev smoke test berhasil;
- preset/manual tidak regression;
- release SOP selesai setelah seluruh verifikasi lulus.

Jika diblokir, dokumentasikan:

1. checklist yang terdampak;
2. command/test yang dijalankan;
3. error relevan;
4. root cause;
5. perubahan yang sudah dibuat;
6. langkah minimal untuk membuka blocker.

Jangan menyamarkan task gagal sebagai selesai dan jangan menandai checkbox yang belum terverifikasi.

---

## END PROMPT
