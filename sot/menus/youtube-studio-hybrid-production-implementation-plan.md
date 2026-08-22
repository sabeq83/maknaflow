# Implementation Plan — YouTube Studio Fase 3.5B: Hybrid Production Approval Pipeline

> Status: Planned.  
> Prasyarat: Production Factory Fase 3 dan Generation Profile selesai; KB Foundation sebaiknya active sebelum produksi pertama.  
> Batas: Tidak mencakup YouTube publishing/analytics; fokus kualitas/approval produksi hybrid.

## 1. Objective

Merevisi Production Factory agar long-form memakai mode per-shot yang tepat dan approval berlapis:

```text
Approved Production Plan
→ T2I/I2V/T2V prompt matrix review
→ approve prompt package
→ generate T2I start frames
→ review / replace / regenerate start frames
→ approve start-frame batch
→ generate TTS/VO
→ review / approve VO batch
→ generate I2V and eligible T2V clips
→ preview / selective revision / final render
```

## 2. Generation Modes

| Mode | Use case | Required fields |
|---|---|---|
| `t2i_i2v` | Character/location/object continuity | `t2i_prompt`, `i2v_prompt`, approved start-frame asset |
| `t2v` | Establishing/abstract/atmospheric visuals | `t2v_prompt` |
| `static_asset` | Maps, diagrams, archive still, typography | `asset_spec` |
| `broll` | Library/stock footage | `asset_query` |

Default heuristic: scene with named recurring subject, location, or continuity requirement uses `t2i_i2v`; generic motion can use `t2v`; explanatory visuals use static/broll. User can change mode before prompt-package approval.

## 3. Batch and Approval Model

For long videos, approval operates per chapter or 10–20 shots, configurable per production package.

```text
Prompt package batch: draft → approved
Start-frame batch: queued → reviewing → approved
VO batch: queued → reviewing → approved
Visual-video batch: queued → generating → completed
```

Rejecting/replacing one start frame invalidates only its dependent I2V clip and assemblies. T2V clips do not require a start frame. TTS does not start until user approves the relevant start-frame batch, matching the requested hybrid flow.

## 4. Execution Task List

- [ ] Audit Pillar Campaign hybrid-lock/start-frame contracts, adapter, audit, worker, and checkpoint behavior for reusable patterns—not table/domain coupling.
- [ ] Extend Production Plan contract with generation mode, T2I/I2V/T2V prompts, negative prompt, continuity tokens, batch IDs, and approval dependencies.
- [ ] Add idempotent migrations for prompt packages, start-frame/VO/video batch approval, source asset lineage, and revision invalidation.
- [ ] Implement tenant-scoped hybrid repository, approval state transitions, batch eligibility, and transactional dependency invalidation.
- [ ] Implement AI prompt-matrix generator/refiner informed by KB snapshots and profile capability, with strict mode-specific validation.
- [ ] Build one-column prompt review UI with per-shot mode editing and explicit Prompt Package approval.
- [ ] Reuse/adapt Pillar start-frame provider patterns behind YouTube Studio adapters; generate/review/replace/regenerate start frames.
- [ ] Implement VO batch TTS generation/review/approval; no dummy audio as production output.
- [ ] Implement I2V and T2V video jobs gated by relevant approvals, then connect to existing preview assembly.
- [ ] Add tests for all approval gates, batch isolation, prompt mode validation, selective invalidation, and provider mocks.
- [ ] Run build, focused tests, Dev-only hybrid smoke with a small chapter, then update checklist.

## 5. Planned File Changes

### 5.1 `lib/youtube-studio-contract.js`

**Code Sebelum (Current/Before)**

```js
// Production plan stores one prompt per shot.
```

**Code Sesudah (Proposed/After)**

```js
export const GENERATION_MODES = ['t2i_i2v', 't2v', 'static_asset', 'broll'];
export function validateHybridShot(shot, profile) { /* mode-specific prompt and duration checks */ }
export function assertHybridApprovalTransition(from, to) { /* batch gates */ }
```

### 5.2 `lib/db-pg.js`

**Code Sebelum (Current/Before)**

```sql
youtube_production_assets (... prompt_snapshot ...)
```

**Code Sesudah (Proposed/After)**

```sql
ALTER TABLE youtube_production_assets ADD COLUMN IF NOT EXISTS generation_mode TEXT;
ALTER TABLE youtube_production_assets ADD COLUMN IF NOT EXISTS t2i_prompt TEXT;
ALTER TABLE youtube_production_assets ADD COLUMN IF NOT EXISTS i2v_prompt TEXT;
ALTER TABLE youtube_production_assets ADD COLUMN IF NOT EXISTS t2v_prompt TEXT;
CREATE TABLE IF NOT EXISTS youtube_production_batches (...);
```

Use advisory lock, tenant constraints, audit fields, and non-destructive migration.

### 5.3 `lib/youtube-studio-hybrid-planner.js` — new

**Code Sebelum (Current/Before)**

```js
// No hybrid prompt-matrix generator exists.
```

**Code Sesudah (Proposed/After)**

```js
export async function generateHybridPromptMatrix({ package, kbSnapshot, profile }) {
  // mode/prompt/continuity/batch plan → strict validation
}
```

Generate all three prompt types only when mode needs them. Do not force T2I/I2V on static/broll/T2V shots.

### 5.4 `lib/youtube-studio-start-frame-adapter.js` — new

**Code Sebelum (Current/Before)**

```js
// YouTube Studio does not have an adapter for start-frame operations.
```

**Code Sesudah (Proposed/After)**

```js
export async function generateStartFrame({ asset, profile, tenant }) {}
export async function replaceStartFrame({ asset, uploadedReference, actor }) {}
```

Adapt reusable patterns from `pillar-start-frame-service`, `start-frame-provider-adapter`, and audit/request helpers; do not reuse Pillar tables or IDs.

### 5.5 `lib/youtube-studio-voice-adapter.js` and `lib/youtube-studio-production-worker.js`

**Code Sebelum (Current/Before)**

```js
// Existing worker can proceed directly from production plan toward generation.
```

**Code Sesudah (Proposed/After)**

```js
// TTS jobs require approved start-frame batch.
// I2V jobs require approved start-frame asset; T2V jobs require approved prompt package.
```

Implement batch-gated queues and granular retry without dummy final outputs.

### 5.6 `lib/youtube-studio-visual-adapter.js`

**Code Sebelum (Current/Before)**

```js
generateVideo({ prompt, mode: 'text_to_video' });
```

**Code Sesudah (Proposed/After)**

```js
generateVideo({ prompt: asset.t2v_prompt, mode: 'text_to_video' });
generateVideo({ prompt: asset.i2v_prompt, startFrame: approvedFrame, mode: 'image_to_video' });
```

Route mode server-side after state/provenance validation. Exact provider payload follows existing webhook client contract verified during implementation.

### 5.7 `app/api/v2/youtube-studio/episodes/[id]/hybrid-production/route.js` — new

**Code Sebelum (Current/Before)**

```js
// No hybrid package/batch endpoint exists.
```

**Code Sesudah (Proposed/After)**

```js
export const POST = withYouTubeStudioAccess('write', generateHybridPromptPackage);
export const GET = withYouTubeStudioAccess('read', getHybridProductionState);
```

Add focused routes for prompt approval, start-frame generation/review/replacement/approval, VO approval, and visual-job launch. Every mutating route is state-gated and idempotent.

### 5.8 `app/youtube-studio/components/YouTubeStudioWorkspace.js`

**Code Sebelum (Current/Before)**

```jsx
// Production Plan progresses directly to asset generation/preview.
```

**Code Sesudah (Proposed/After)**

```jsx
<HybridPromptReviewStep />
<StartFrameApprovalStep />
<VoiceApprovalStep />
<VisualGenerationStep />
```

Keep one-column UX. Render batch progress and per-shot actions clearly; no inline styles or literal colors.

### 5.9 `app/youtube-studio/components/YouTubeStudioWorkspace.module.css`

**Code Sebelum (Current/Before)**

```css
/* No hybrid approval components. */
```

**Code Sesudah (Proposed/After)**

```css
.approvalBatch { background: var(--surface-raised); }
.startFrameGrid { display: grid; }
.approvalBlocked { color: var(--status-warning); }
```

Use semantic CSS Module class names and existing theme tokens only.

### 5.10 `scripts/test-youtube-studio-hybrid-production.mjs` — new

**Code Sebelum (Current/Before)**

```js
// No hybrid approval pipeline test exists.
```

**Code Sesudah (Proposed/After)**

```js
test('I2V is rejected until its start frame and VO batch are approved', async () => {});
test('replacing one frame invalidates only dependent I2V and assembly', async () => {});
```

Test mode contract, batch gating, tenant isolation, provider mocks, idempotency, approvals, and selective invalidation.

### 5.11 This plan

Update checklist only after verified work; document any additional file with before/after snippets before editing it.

## 6. Acceptance Criteria

1. Production Plan contains validated mode-specific prompt matrix.
2. User approves prompt package before any generation.
3. T2I frames are generated/reviewed/replaced per batch; I2V cannot start without approved frame.
4. TTS begins only after approved start-frame batch and requires VO approval before video generation.
5. T2V can proceed only for approved eligible shots; static/broll bypass provider correctly.
6. Replacing one start frame invalidates only its I2V/assembly descendants.
7. Pillar patterns are reused through adapters, with no cross-domain table coupling.
8. UI one-column, semantic CSS, accessible, theme-aligned; build/tests/Dev smoke pass.

## 7. Verification and Dev-only Deployment

```bash
npm run build
npm run deploy:macmini-dev
```

Use a small test chapter only. Verify ports 5020/7020. Never deploy staging/production.

## 8. Release

```bash
npm run release-non-interactive -- --type minor --title "YouTube Studio Hybrid Production" --points "Tambah prompt matrix T2I I2V dan T2V|Tambah approval start frame dan VO berbasis batch|Tambah generation visual hybrid dengan selective revision"
```

