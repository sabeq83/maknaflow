# Implementation Plan — YouTube Studio Fase 3: Production Factory

> Status: Planned.  
> Prasyarat: Episode memiliki `Script Approved` dan valid `generation_profile_key` dari Fase 2.5.  
> Scope: Production Plan → per-shot asset generation → VO → assembly preview → selective revision → final render. Publishing tetap Fase 4.

## 1. Objective

Mengubah approved editorial script menjadi video YouTube faceless 16:9 yang dapat direview dan dirender melalui pekerjaan durable, tenant-safe, idempotent, dan cost-controlled.

```text
Script Approved + Generation Profile
→ AI Production Plan Draft
→ User approves Production Plan
→ Generate VO and per-shot visual assets
→ Assemble preview
→ User reviews / regenerates selected shot only
→ Final render
→ Ready to Publish
```

## 2. Architecture and Release Sequence

### Fase 3A — Production Plan (no paid generation)

- Translate each approved narrative scene into an asset/shot plan.
- Generated visual shots use allowed duration from selected profile.
- User can edit asset type, prompt, shot order, and allowed duration before approval.
- Validate narrative coverage, duration, profile compatibility, and production cost estimate.

### Fase 3B — Asset Generation and Voice-over

- Create durable jobs per asset/shot and VO segment.
- Route Google Flow profile through the established G-Labs/provider integration behind an adapter.
- Persist provider task ID, prompt snapshot, output asset, cost, error, retry attempt, and provenance.
- Generate only missing/invalidated shots; do not restart whole episode.

### Fase 3C — Assembly, Preview, Revision, and Final Render

- Assemble approved assets, VO, subtitles, music/SFX cues, branding, and chapter markers.
- Produce preview artifact first.
- User can regenerate/reorder/re-edit an individual shot, then reassemble preview.
- Final render is a separate explicit action after preview approval.

## 3. Production Data Model

```text
youtube_production_packages
  id, tenant_id, episode_id, approved_script_id, generation_profile_key,
  plan_json, context_snapshot_json, status,
  approved_by, approved_at, preview_asset_json, final_asset_json,
  created_at, updated_at

youtube_production_assets
  id, tenant_id, production_package_id, scene_index, shot_index,
  asset_type, generation_profile_key, generation_duration_seconds,
  prompt_snapshot, provider_task_id, source_asset_json, output_asset_json,
  status, attempt_count, cost_json, error_code, error_message,
  created_at, updated_at

youtube_production_jobs
  id, tenant_id, production_package_id, asset_id, job_kind,
  idempotency_key, status, progress, payload_snapshot_json,
  error_code, error_message, started_at, completed_at, created_at
```

`youtube_render_jobs` is retained for backwards compatibility; production orchestration must migrate to the new package/job model before the placeholder path is retired.

## 4. State Model

```text
episode:
Script Approved
→ Production Plan Draft
→ Production Plan Approved
→ Generating Assets
→ Assembling Preview
→ Preview Ready
→ Final Rendering
→ Ready to Publish

package:
draft → approved → generating → preview_ready → final_rendering → completed | failed

asset/job:
queued → running → succeeded | retryable_failed | failed | cancelled | superseded
```

No final render before `preview_ready` and explicit user approval. A selective revision invalidates only dependent assembly/final artifacts and preserves prior version history.

## 5. Production Plan Contract

```json
{
  "generation_profile_key": "google_flow_omni_flash",
  "estimated_total_duration_seconds": 720,
  "scenes": [{
    "scene_index": 1,
    "narrative_duration_seconds": 30,
    "voiceover": "Approved narration snapshot",
    "shots": [{
      "shot_index": 1,
      "asset_type": "generated_visual",
      "generation_duration_seconds": 10,
      "prompt": "Visual prompt grounded in Visual Identity snapshot",
      "transition_to_next": "cut"
    }],
    "audio_cue": "subtle ambient bed"
  }]
}
```

Rules:

- `generated_visual` duration is validated against selected profile registry.
- Non-generated assets are not constrained to Flow duration set.
- Generated shots must cover narrative scene duration within configured tolerance; plan may include overlay/B-roll coverage.
- Prompt and provider/profile context are snapshotted at plan approval.
- User cannot modify provider task IDs, cost, output paths, or tenant fields.

## 6. Execution Task List

- [ ] Audit existing placeholder render worker, G-Labs routes/processors, TTS service, scheduler queue, asset storage, and quota patterns; document provider adapter decision.
- [ ] Extend contracts and state machine for production-package, asset, job, preview, final render, selective invalidation, and cost guards.
- [ ] Add idempotent schema migration for production packages/assets/jobs and append-only artifact/provenance fields.
- [ ] Implement tenant-scoped production repository transactions, idempotency, job claim/lease, and per-tenant/profile concurrency/quota checks.
- [ ] Implement AI Production Plan generator from approved script + generation profile, plus server validation and human approval workflow.
- [ ] Build one-column Production Plan UI with explicit generate/edit/approve controls and valid generated-shot duration choices.
- [ ] Implement provider-neutral visual generation adapter routed to the existing G-Labs/Google Flow integration and TTS adapter for VO.
- [ ] Implement durable per-shot/per-VO worker jobs, retry classification, cancellation, cost telemetry, and asset provenance.
- [ ] Implement timeline assembly, subtitle generation, music/SFX/branding application, and preview artifact output.
- [ ] Implement preview review, selected-shot regeneration, dependency invalidation, and explicit final-render action.
- [ ] Retire/bypass placeholder visual clip behavior only after real adapter path is verified; preserve legacy job compatibility.
- [ ] Add contract, repository, API, worker, provider-mock, tenant-isolation, retry/idempotency, and end-to-end production tests.
- [ ] Run build, focused tests, Dev-only production smoke using a dedicated test channel/project, then update checklist with evidence.

## 7. Planned File Changes

### 7.1 `lib/youtube-studio-contract.js`

**Code Sebelum (Current/Before)**

```js
export function validateProductionShotPlan(scene, profile) {
  // validates profile duration capability only
}
```

**Code Sesudah (Proposed/After)**

```js
export function validateProductionPlan(plan, { profile, episodeDuration }) { /* scene/shot coverage */ }
export function assertProductionTransition(from, to) { /* package lifecycle */ }
export function classifyProductionFailure(error) { /* retryable or terminal */ }
```

Extend validators without trusting client-side plan fields. Keep generation-profile capabilities in the registry service.

### 7.2 `lib/db-pg.js`

**Code Sebelum (Current/Before)**

```sql
youtube_production_packages (
  scene_manifest_json, voice_manifest_json, subtitle_asset_json, status
)
```

**Code Sesudah (Proposed/After)**

```sql
ALTER TABLE youtube_production_packages ADD COLUMN IF NOT EXISTS plan_json JSONB;
ALTER TABLE youtube_production_packages ADD COLUMN IF NOT EXISTS generation_profile_key TEXT;
CREATE TABLE IF NOT EXISTS youtube_production_assets (...);
CREATE TABLE IF NOT EXISTS youtube_production_jobs (...);
```

Use advisory lock, tenant/status/index constraints, unique idempotency keys, and safe migration/backfill. Do not delete old render records.

### 7.3 `lib/youtube-studio-production-repository.js` — new

**Code Sebelum (Current/Before)**

```js
// Production package, asset, and job operations are mixed into the old render worker.
```

**Code Sesudah (Proposed/After)**

```js
export async function createProductionPlanDraft({ episodeId, plan, snapshot, actor }) {}
export async function approveProductionPlan(packageId, actor) {}
export async function claimProductionJob({ workerId }) {}
export async function invalidateShotAndAssemblies(assetId, actor) {}
```

All write paths resolve tenant ownership server-side, use transactions, and persist audit/cost state.

### 7.4 `lib/youtube-studio-production-planner.js` — new

**Code Sebelum (Current/Before)**

```js
// Approved script is not yet expanded into an editable production plan.
```

**Code Sesudah (Proposed/After)**

```js
export async function generateProductionPlan({ episode, script, profile, visualIdentity, universe }) {
  // AI plan → validateProductionPlan → return, never enqueue provider work
}
```

Prompt must produce only allowed generated-shot durations for profile. It must distinguish generated visual, B-roll, diagram, map, text overlay, and archive-style assets.

### 7.5 `lib/youtube-studio-visual-adapter.js` — new

**Code Sebelum (Current/Before)**

```js
// Worker associates every scene with templates/placeholder_16_9.mp4.
```

**Code Sesudah (Proposed/After)**

```js
export async function generateVisualShot({ asset, profile, tenant }) {
  // route profile to G-Labs/Google Flow; return provider task and output metadata
}
```

Use existing G-Labs integration through a provider-neutral adapter. No prompt/provider call is performed from API routes.

### 7.6 `lib/youtube-studio-voice-adapter.js` — new

**Code Sebelum (Current/Before)**

```js
// Existing production worker calls Gemini TTS directly and falls back to dummy audio.
```

**Code Sesudah (Proposed/After)**

```js
export async function generateVoiceSegment({ text, locale, persona, tenant }) {
  // real TTS result/provenance; explicit failure, never dummy final audio
}
```

Use the existing approved TTS service/provider; mock audio only in automated tests, never in Dev production workflow.

### 7.7 `lib/youtube-studio-production-worker.js`

**Code Sebelum (Current/Before)**

```js
const visualClips = scenes.map(() => ({ video_path: 'templates/placeholder_16_9.mp4' }));
```

**Code Sesudah (Proposed/After)**

```js
export async function processProductionJob(jobId) {
  // claim → adapter call/poll → persist asset → trigger only dependent work
}
```

Replace placeholder behavior incrementally after adapter verification. Separate visual, voice, assembly, and final-render jobs; no monolithic request/worker execution.

### 7.8 `lib/youtube-studio-render-adapter.js`

**Code Sebelum (Current/Before)**

```js
export async function renderLongForm({ timeline, job }) {
  // merge placeholder clips and write SRT directly
}
```

**Code Sesudah (Proposed/After)**

```js
export async function assemblePreview({ productionPackage }) {}
export async function renderFinal({ productionPackage }) {}
```

Consume approved asset manifest only. Create separate preview/final artifacts and subtitle/manifest metadata. Use safe artifact storage path and tenant authorization.

### 7.9 `lib/scheduler.js`

**Code Sebelum (Current/Before)**

```js
youtube_production: async payload => processYouTubeRenderJob(payload.job_id)
```

**Code Sesudah (Proposed/After)**

```js
youtube_production_asset: async payload => processProductionJob(payload.job_id),
youtube_production_assembly: async payload => assembleProductionPreview(payload.package_id),
youtube_production_final: async payload => renderProductionFinal(payload.package_id)
```

Register granular queues with existing scheduler conventions and ensure unsupported jobs fail visibly without retry loops.

### 7.10 `app/api/v2/youtube-studio/episodes/[id]/production-plan/route.js` — new

**Code Sebelum (Current/Before)**

```js
// Production plan route does not exist.
```

**Code Sesudah (Proposed/After)**

```js
export const POST = withYouTubeStudioAccess('write', generateOrSaveProductionPlan);
export const GET = withYouTubeStudioAccess('read', getProductionPlan);
```

Add focused routes for plan approval, asset status, selected-shot regeneration, preview approval, and final render. Every paid action gets server-generated idempotency key and state precondition.

### 7.11 `app/youtube-studio/components/YouTubeStudioWorkspace.js`

**Code Sebelum (Current/Before)**

```jsx
// Generation Profile is the final visible production-adjacent control.
```

**Code Sesudah (Proposed/After)**

```jsx
<section className={styles.workflowStep} aria-labelledby="production-step-title">
  <ProductionPlanStep />
  <AssetProgressStep />
  <PreviewReviewStep />
</section>
```

Keep one-column workflow. Provide an explicit plan approval before generation and explicit preview/final approval. Do not expose provider secrets/cost internals or use inline styles.

### 7.12 `app/youtube-studio/components/YouTubeStudioWorkspace.module.css`

**Code Sebelum (Current/Before)**

```css
/* Editorial workflow styles only. */
```

**Code Sesudah (Proposed/After)**

```css
.productionPlan { background: var(--surface-raised); }
.assetProgress { color: var(--text-secondary); }
.previewPlayer { border: 1px solid var(--border-subtle); }
```

Use semantic CSS Module classes and MAKNA Flow theme tokens only: no inline style, literal color, or visual hardcoding.

### 7.13 `scripts/test-youtube-studio-production-factory.mjs` — new

**Code Sebelum (Current/Before)**

```js
// No end-to-end production factory contract/worker mock test exists.
```

**Code Sesudah (Proposed/After)**

```js
test('Omni Flash plan creates only valid 4/6/8/10-second generated-shot jobs', async () => {});
test('regenerating one shot invalidates only dependent preview/final artifacts', async () => {});
```

Mock providers and storage; include tenant isolation, retries, idempotency, quota denial, preview-before-final, and no placeholder/dummy final output tests.

### 7.14 This plan

Update checkbox only after verified completion. Add before/after documentation to this section before touching any unplanned file.

## 8. Acceptance Criteria

1. Only a `Script Approved` episode with valid generation profile can generate a Production Plan.
2. Production Plan obeys profile shot capability and covers narrative duration without invalid visual jobs.
3. User can edit/review/approve plan before paid generation starts.
4. Each shot/VO job is tenant-scoped, idempotent, observable, retryable where safe, and cost/quota guarded.
5. The real adapter replaces placeholder visuals for verified production runs; no dummy audio/video is emitted as final output.
6. A failed asset retries or surfaces failure without recreating completed assets.
7. Preview is built before final render; final action requires user approval.
8. Selected-shot regeneration invalidates only dependent assembly/final outputs.
9. Preview/final artifacts, subtitles, manifest, provider provenance, and error history are preserved with tenant-safe access.
10. UI remains one-column, semantic CSS Module based, responsive, and theme-aligned.
11. Build, mocked tests, and Dev-only live smoke test pass.

## 9. Verification and Dev-only Deployment

Run focused tests plus:

```bash
npm run build
npm run deploy:macmini-dev
```

Smoke test a small, dedicated test episode/channel on Mac Mini Dev only:

- UI: `http://100.95.245.55:5020/youtube-studio`
- API: `http://100.95.245.55:7020`

Do not use staging/production. Do not poll SSH repeatedly during remote build.

## 10. Release

After all verification succeeds:

```bash
npm run release-non-interactive -- --type minor --title "YouTube Studio Production Factory" --points "Tambah production plan AI berbasis profile Google Flow|Tambah asset dan VO jobs tenant-safe dengan preview render|Tambah selective shot revision dan final render workflow"
```

