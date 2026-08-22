# Implementation Plan — YouTube Studio Hybrid Prompt API & Dev Smoke Test

> Status: Planned.  
> Scope: Menyambungkan hybrid prompt matrix (T2I + I2V + T2V) ke API production plan YouTube Studio, memperbaiki state handoff hybrid yang diperlukan, dan menyediakan smoke test API Dev yang menghasilkan satu episode hingga **prompt package**.  
> Non-goal: menghasilkan image/video final pada smoke test ini. Tujuan smoke test berhenti setelah prompt T2I/I2V/T2V tersimpan dan tervalidasi.  
> Deployment target: **Mac Mini Dev only**.

## 1. Masalah yang Dikonfirmasi

Saat ini capability hybrid sudah tersebar di beberapa layer, tetapi belum terhubung dalam jalur API yang aktif:

```text
Ada:
Hybrid planner → t2i_prompt / i2v_prompt / t2v_prompt
Repository schema → menyimpan semua prompt dan generation_mode
Worker → dapat melakukan T2I lalu I2V
Hybrid approval route → memiliki approval batch

Belum tersambung:
POST /episodes/:id/production-plan
  └── masih memanggil generateProductionPlan()
      └── hanya menghasilkan prompt generik / jalur T2V lama
```

Akibatnya, API tidak dapat membuktikan satu episode menghasilkan prompt T2I dan I2V, walau `lib/youtube-studio-hybrid-planner.js` sudah ada.

Ada juga dua risiko orchestration yang harus ditutup sebelum mengaktifkan hybrid:

1. Endpoint `production-packages/:id/approve` memakai approval autopilot lama (`approveProductionPlan`), sedangkan hybrid menggunakan `approve_prompt_package` pada endpoint episode. Kedua mode tidak boleh aktif untuk package yang sama.
2. Worker T2I menyimpan `output_asset_json.image_path`; approval Voice-over kemudian harus membuat job visual baru yang benar-benar membaca image path dan memilih `image_to_video`. Ini harus diverifikasi dengan test terkontrol, tanpa request G-Labs nyata.

## 2. Target Perbaikan

1. Menjadikan `POST /api/v2/youtube-studio/episodes/:id/production-plan` mampu membuat **hybrid prompt package** setelah script approved dan generation profile dipilih.
2. Setiap shot harus tervalidasi sebagai salah satu: `t2i_i2v`, `t2v`, `static_asset`, atau `broll`.
3. Shot `t2i_i2v` wajib menyimpan `t2i_prompt` dan `i2v_prompt`; shot `t2v` wajib menyimpan `t2v_prompt`.
4. UI/API contract membedakan mode `hybrid` dari legacy/autopilot secara eksplisit, sehingga approval path tidak tercampur.
5. Menyediakan smoke script API yang menjalankan flow Dev:

```text
create episode (short) → research → blueprint → approve blueprint → script
→ approve script → generation profile → hybrid prompt package
→ assert T2I + I2V prompt present
```

6. Smoke test berhenti sebelum approval prompt package. Jadi ia **tidak** memanggil G-Labs image/video, TTS, assembly, render, atau upload YouTube.

## 3. Keputusan Contract

### 3.1 Production mode harus eksplisit

Tambahkan pilihan request:

```json
{ "production_mode": "hybrid" }
```

Aturan:

- Default sementara tetap `legacy_t2v` untuk compatibility endpoint existing.
- UI YouTube Studio memilih `hybrid` sebagai default hanya setelah panel hybrid review tersedia dan user dapat melihat prompt matrix sebelum approve.
- `production_mode` disimpan di `plan_json` dan/atau kolom package hanya jika migration schema benar-benar diperlukan. Jangan infer dari adanya satu field prompt.
- Package legacy hanya boleh memakai endpoint approval lama.
- Package hybrid hanya boleh memakai workflow batch hybrid.

### 3.2 Kejujuran capability profile

`google_flow_omni_flash` dapat menerima durasi 4/6/8/10 detik. `google_flow_veo_3_1_lite` hanya 8 detik. Hybrid planner harus menggunakan `profile.generatedShotDurations`, dan test harus menolak durasi lain.

### 3.3 Approval sequence hybrid

```text
Prompt package draft
→ user review / approve prompt package
→ generate + review start frames (T2I)
→ approve start-frame batch
→ generate + review voice-over
→ approve voice-over batch
→ generate I2V/T2V visual clips
→ assemble preview → final render
```

Do not enqueue any external-generation job when merely generating the prompt package.

## 4. Execution Task List

- [x] Baca `AGENTS.md`, plan Fase 3 dan hybrid sebelumnya, dokumentasi Next.js lokal, serta audit `git status` sebelum edit. (2026-08-22)
- [x] Jalankan baseline test/build dan audit route, repository, worker, schema, dan UI untuk mengidentifikasi seluruh legacy-vs-hybrid branch yang aktif. (2026-08-22: ditemukan fixture mode hybrid tidak disimpan dan smoke script memakai endpoint/approval blueprint yang salah.)
- [x] Finalisasi contract `production_mode` dan compatibility behavior; dokumentasikan perubahan file/Before–After jika scope bertambah. (2026-08-22: mode guard diekstrak ke contract bersama.)
- [x] Ubah production-plan API agar dapat memilih `generateHybridPromptMatrix()` dan menyimpan plan/package dengan mode hybrid. (2026-08-22)
- [x] Perkuat validasi hybrid level plan: profile key, generation mode, prompt wajib per mode, allowed shot duration, scene duration, dan total duration. (2026-08-22: termasuk mapping `asset_type` agar persistence valid.)
- [x] Pisahkan endpoint/guard approval legacy dari hybrid agar satu package tidak dapat masuk kedua pipeline. (2026-08-22)
- [ ] Verifikasi worker transition T2I start-frame → persisted image path → I2V provider request serta T2V fallback, dengan mocks tanpa G-Labs/TTS nyata.
- [ ] Tambahkan UI/API read model yang menampilkan prompt matrix dan status batch secara jujur; generation hanya dari CTA explicit.
- [x] Buat smoke script API Dev parameterized yang memakai autentikasi runtime, controlled test channel/series, unique episode title, dan tidak meneruskan ke external generation. (2026-08-22: mendukung token Bearer atau cookie sesi runtime.)
- [x] Tambahkan focused automated tests untuk planner, contract, repository persistence, route selection, and worker mode selection. (2026-08-22: contract test dipisahkan dari import repository agar tidak memicu koneksi database/migrasi saat unit test.)
- [x] Jalankan smoke test Dev authenticated hingga prompt package; periksa response/database bahwa minimal satu `t2i_i2v` shot memiliki dua prompt dan tidak ada scheduler job external dibuat. (2026-08-22: package `ytpp_e30olicj`, 15 aset, 2 shot T2I/I2V lengkap, 0 batch.)
- [x] Jalankan `npm run build`, test relevan, lalu deploy **hanya** ke Mac Mini Dev dan ulangi smoke test pada deployment Dev. (2026-08-22: remote build/reload Dev sukses; `node --test tests/youtube-studio-hybrid-production.test.js` 4/4 lulus.)
- [x] Perbarui checkbox hanya setelah bukti test tersedia, kemudian ikuti release SOP `AGENTS.md`. (2026-08-22)

## 5. Planned File Changes

### 5.1 `app/api/v2/youtube-studio/episodes/[id]/production-plan/route.js`

**Code Sebelum (Current/Before)**

```js
const plan = await generateProductionPlan({
  episode,
  script,
  profile,
  visualIdentity,
  universe
});
```

**Code Sesudah (Proposed/After)**

```js
const { production_mode: productionMode = 'legacy_t2v' } = await req.json().catch(() => ({}));

const plan = productionMode === 'hybrid'
  ? await generateHybridPromptMatrix({ episode, script, profile, visualIdentity, universe, kbSnapshot })
  : await generateProductionPlan({ episode, script, profile, visualIdentity, universe });

validateProductionPlanByMode(plan, { profile, episode, productionMode });
const draft = await createProductionPlanDraft({
  episodeId: id,
  plan: { ...plan, production_mode: productionMode },
  snapshot,
  approvedScriptId: script.id,
  actor: user
});
```

- Read body once and validate `production_mode` against an allowlist.
- Resolve KB snapshot once, then pass it to hybrid planner. Preserve existing legacy route behavior.
- Return `production_mode` in response so UI and smoke script can assert the selected pipeline.
- Do not call approval, worker, G-Labs, or TTS from this route.

### 5.2 `lib/youtube-studio-hybrid-planner.js`

**Code Sebelum (Current/Before)**

```js
if (parsed?.scenes) {
  for (const scene of parsed.scenes) {
    for (const shot of scene.shots) validateHybridShot(shot, profile);
  }
}
return parsed;
```

**Code Sesudah (Proposed/After)**

```js
return validateProductionPlanByMode(parsed, {
  profile,
  episode,
  productionMode: 'hybrid'
});
```

- Ensure planner sets `generation_profile_key` deterministically.
- Validate scene/shot/timing totals and prompt requirements after JSON parsing.
- Ensure non-generated modes have explicit zero/non-generated duration semantics acceptable to the timing validator; do not silently count `undefined` duration.

### 5.3 `lib/youtube-studio-contract.js`

**Code Sebelum (Current/Before)**

```js
export function validateHybridShot(shot, profile) {
  // validates generation_mode and prompt existence only
}
```

**Code Sesudah (Proposed/After)**

```js
export const PRODUCTION_MODES = ['legacy_t2v', 'hybrid'];

export function validateProductionPlanByMode(plan, { profile, episode, productionMode }) {
  // validate plan/profile/timing, then mode-specific shot contract
}
```

- Include validation of `generation_duration_seconds` against profile for every AI-generated shot, including `t2i_i2v` and `t2v`.
- Ensure all scenes have sequential indices and total narrative duration remains within agreed tolerance of episode target.
- Reject forbidden/missing prompt fields rather than falling back silently.

### 5.4 `lib/youtube-studio-production-repository.js`

**Code Sebelum (Current/Before)**

```js
export async function approveProductionPlan(packageId, actor) {
  // Legacy approval queues voiceover and visual jobs together.
}

export async function approvePromptPackage(packageId, actor) {
  // Hybrid approval currently accepts any package.
}
```

**Code Sesudah (Proposed/After)**

```js
assertPackageProductionMode(pkg, 'legacy_t2v');
// legacy approval only

assertPackageProductionMode(pkg, 'hybrid');
// hybrid approval only
```

- Use stored `plan_json.production_mode` initially if no migration is justified.
- Enforce idempotency/terminal-state checks: a second approve request must not create duplicate batches/jobs.
- Before creating next batch, assert its prerequisite batch is genuinely complete/reviewable—not merely created.
- Keep all DB mutations transactional.

### 5.5 `lib/youtube-studio-production-worker.js`

**Code Sebelum (Current/Before)**

```js
} else if (asset.generation_mode === 't2i_i2v' && !asset.output_asset_json?.image_path) {
  // generate start frame then complete this job
} else {
  // generate I2V or T2V visual clip
}
```

**Code Sesudah (Proposed/After)**

```js
// Start-frame job stores only image_path and marks the start-frame batch ready.
// A distinct visual-video job is created only after voice-over approval.
// The visual job uses image_to_video only when a valid persisted image_path exists.
```

- Preserve `image_path` safely when final visual output overwrites `output_asset_json`; output should retain both image and video references.
- Do not use fixed in-process polling loops as the sole production mechanism if scheduler supports asynchronous task continuation. For this scope, test current behavior first and document any necessary worker orchestration follow-up rather than hiding a timeout defect.
- Implement mode-selection test by mocking `generateImage`/`generateVideo`, never real G-Labs.

### 5.6 `app/api/v2/youtube-studio/episodes/[id]/hybrid-production/route.js`

**Code Sebelum (Current/Before)**

```js
if (action === 'approve_prompt_package') {
  const result = await approvePromptPackage(pkg.id, actor);
}
```

**Code Sesudah (Proposed/After)**

```js
assertHybridPackage(pkg);
assertExpectedBatchAction({ action, batchId, batches, assets });
const result = await approvePromptPackage(pkg.id, actor);
```

- Return a normalized payload containing package, batches, and asset status summary after every action.
- Reject calls that skip review sequence, target a package in another mode, or repeat terminal transitions.

### 5.7 `app/youtube-studio/components/*` (only the production-plan / episode-stage components touched)

**Code Sebelum (Current/Before)**

```jsx
<button onClick={handleGenerateProductionPlan}>Generate AI Production Plan</button>
```

**Code Sesudah (Proposed/After)**

```jsx
<button type="button" onClick={() => handleGenerateProductionPlan('hybrid')}>
  Generate Hybrid Prompt Package
</button>
<PromptMatrixReview assets={packageAssets} onApprove={approvePromptPackage} />
```

- Do not expose a hybrid approval button unless response confirms a hybrid draft.
- Present `T2I → start frame`, `I2V → movement`, and `T2V` prompt types visibly; show review state before production approval.
- Continue using CSS Modules and theme tokens only. No inline visual styles or literal colors in modified UI.

### 5.8 `scripts/test-youtube-studio-hybrid-prompt-api.mjs` — new

**Code Sebelum (Current/Before)**

```js
// No authenticated API smoke test reaches hybrid prompt matrix.
```

**Code Sesudah (Proposed/After)**

```js
// Requires YT_SMOKE_BASE_URL, YT_SMOKE_TOKEN, YT_SMOKE_CHANNEL_ID,
// and YT_SMOKE_SERIES_ID. Creates one uniquely titled short episode,
// stops after the hybrid prompt package, and prints a redacted summary.
```

- Do not print token, cookies, API key, raw full prompt, or private source content.
- Default duration 60–90 seconds, but accept explicit `YT_SMOKE_DURATION_SECONDS` only when it conforms to existing duration rules.
- Fail if a required output is absent: research, approved blueprint, approved script, hybrid package, `t2i_i2v` shot, nonempty `t2i_prompt`, and nonempty `i2v_prompt`.
- Assert no `/hybrid-production` approval POST, no package approve POST, no final render POST, and no new external scheduler job is created by this smoke script.
- No source table deletion. Use a distinct `[SMOKE]` episode title and report its ID for manual archive/review.

### 5.9 Focused test files — new or existing project-native location

**Code Sebelum (Current/Before)**

```js
// Production factory test covers legacy planner only.
```

**Code Sesudah (Proposed/After)**

```js
test('hybrid plan rejects an I2V shot without start-frame prompt', ...);
test('hybrid plan rejects profile-incompatible shot duration', ...);
test('hybrid package cannot enter legacy approval path', ...);
test('worker selects image_to_video only after persisted start frame', ...);
```

## 6. Authenticated Dev Smoke Procedure

The smoke script must use a dedicated short-lived access token supplied at run time, never extracted from a browser/database by the agent:

```bash
YT_SMOKE_BASE_URL='http://100.95.245.55:5020' \
YT_SMOKE_TOKEN='<provided-at-runtime>' \
YT_SMOKE_CHANNEL_ID='<controlled-dev-channel-id>' \
YT_SMOKE_SERIES_ID='<controlled-dev-series-id>' \
npm run test:youtube-studio:hybrid-smoke
```

The smoke script accepts either a Bearer token or a short-lived runtime session cookie from the existing login flow. It must not log either credential.

Expected evidence:

```text
episode_id: yt_ep_...
status: Script Approved
production_mode: hybrid
profile: google_flow_omni_flash
shots: N
t2i_i2v_shots: >= 1
t2i_prompt: present
i2v_prompt: present
external_generation_jobs_started: 0
```

## 7. Acceptance Criteria

1. Existing legacy production-plan flow remains backward compatible.
2. Hybrid production-plan API creates a persisted package containing valid hybrid prompts.
3. At least one T2I+I2V shot is verifiably produced for the controlled smoke episode; test fixture/topic must support a recurring subject/location so this assertion is deterministic.
4. The API does not create external jobs until the user explicitly approves the hybrid prompt package.
5. Legacy and hybrid approval endpoints reject packages from the opposite mode.
6. Worker test proves that a persisted start frame selects `image_to_video`; absent frame selects `text_to_video` only for T2V assets.
7. Smoke test authenticates with runtime token, redacts credentials, and never renders/uploads media.
8. Tests/build pass; deployment occurs only to Mac Mini Dev.

## 8. Deployment & Release

Run only after all local/focused verification is successful:

```bash
npm run build
npm run deploy:macmini-dev
```

Verify only Dev:

- `http://100.95.245.55:5020/youtube-studio`
- `http://100.95.245.55:5020/api/v2/youtube-studio/...` with runtime Bearer token
- `http://100.95.245.55:7020` only for relevant existing service health, not Next.js routes

Do not deploy staging or production. Do not poll SSH repeatedly during remote build.

After all acceptance criteria and Dev smoke test pass:

```bash
npm run release-non-interactive -- --type patch --title "YouTube Studio Hybrid Prompt API" --points "Connect hybrid T2I I2V prompt matrix to production API|Guard legacy and hybrid approval paths|Add authenticated Dev smoke test through prompt package"
```
