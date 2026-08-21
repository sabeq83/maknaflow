# Implementation Plan — YouTube Studio MVP

> Status: Planned; no application code is changed by this document.  
> Product scope: [YouTube Studio MVP](youtube-studio-mvp.md)  
> Product roadmap: [YouTube Studio Roadmap](youtube-studio-roadmap.md)

## 1. Objective

Build the YouTube Studio MVP as a premium, tenant-isolated, multi-channel workspace for **faceless AI YouTube long-form** production. The first release must take an approved episode from strategy and script through scene/VO assembly, final 16:9 render, YouTube private/unlisted draft upload, and one traceable Shorts derivative.

The MVP does not include advanced analytics, public publishing/scheduling, full monetization dashboards, or automatic multi-language dubbing.

## 2. Architecture Decisions Before Coding

### 2.1 Bounded contexts

```text
YouTube Studio UI + API
  ├── Channel / Series / Episode domain (PostgreSQL)
  ├── Planning service (blueprint + script generation)
  ├── Production orchestrator (jobs + artifacts + retry)
  ├── Render adapter (timeline → 16:9 MP4 + subtitles)
  ├── YouTube publishing adapter (OAuth + private/unlisted upload)
  └── Short-form bridge (parent episode → existing short-form workflow)
```

Universe Manager and Visual Identity remain source systems. An episode only stores their IDs, versions, and immutable snapshots at the moment production begins.

### 2.2 Authorization

- Add RBAC menu key `youtube_studio` under `WORKFLOW`.
- Tenant-level menu disable is honored through the existing Sidebar and auth mechanisms.
- API routes use `withTenantContext`; repository queries must receive tenant context from the existing DB/auth boundary, never trust a client-supplied tenant ID.
- Roles: read-only users may view; users with write access can plan/edit; publish requires write access plus the pre-publish approval state. Admin/superadmin behavior follows existing RBAC conventions.

### 2.3 Job model and reliability

- A production run has idempotency keys and granular steps: `plan_scenes`, `generate_assets`, `generate_voice`, `assemble_timeline`, `render_preview`, `render_final`, `subtitle`.
- Render/provider work must run in the existing worker/scheduler execution environment, not in a Next.js request lifecycle.
- Persist state and artifacts after each step; retry only failed retryable steps.
- Store provider/accounting metadata and enforce per-tenant quotas before costly calls.
- Provider selection is an implementation decision validated in a technical spike; adapters prevent domain code from being coupled to a provider.

### 2.4 Multilingual

- Store BCP 47 locale values (for example `id-ID`, `en-US`) rather than a hard-coded language enum limited to Indonesian/English.
- Channel establishes defaults; script/voice/metadata values may override only when the product explicitly permits it.
- Script prompts require locale-native writing, not literal translation.

### 2.5 Release sequence

| Release | Included work | Gate |
|---|---|---|
| R1 Foundation | Schema, RBAC, repository, channel/series/episode UI | Tenant isolation and CRUD tests pass |
| R2 Editorial | Blueprint, script versions, approval gate | No production job can start with an unapproved script |
| R3 Production | Orchestrator, provider adapters, preview/final rendering | Test episode renders with resumable jobs |
| R4 Publishing | Metadata, OAuth, private/unlisted upload, short bridge | Test upload and parent/derivative traceability work |

## 3. Data Model and State Contracts

### 3.1 Tables

```text
youtube_channels
  id, tenant_id, name, channel_handle, status, primary_locale,
  youtube_account_ref, created_by, created_at, updated_at

youtube_channel_strategies
  id, tenant_id, channel_id, status, config_json,
  universe_id, universe_snapshot_json,
  visual_identity_preset_id, visual_identity_version, visual_identity_snapshot_json,
  created_by, created_at, updated_at

youtube_series
  id, tenant_id, channel_id, strategy_id, name, pillar, config_json,
  status, created_by, created_at, updated_at

youtube_episodes
  id, tenant_id, channel_id, series_id, strategy_id, title, locale,
  target_duration_seconds, priority, target_publish_at, status,
  production_snapshot_json, created_by, created_at, updated_at

youtube_episode_blueprints
  id, tenant_id, episode_id, content_json, version, status, created_by, created_at

youtube_episode_scripts
  id, tenant_id, episode_id, blueprint_id, locale, script_json,
  version, status, review_note, approved_by, approved_at, created_by, created_at

youtube_production_packages
  id, tenant_id, episode_id, approved_script_id, scene_manifest_json,
  voice_manifest_json, subtitle_asset_json, status, created_at, updated_at

youtube_render_jobs
  id, tenant_id, episode_id, production_package_id, job_type, idempotency_key,
  status, progress, input_snapshot_json, output_asset_json,
  error_code, error_message, cost_json, started_at, completed_at, created_at

youtube_publishing_packages
  id, tenant_id, episode_id, title, description, chapters_json, thumbnail_asset_json,
  upload_privacy, approval_status, youtube_video_id, youtube_studio_url,
  upload_status, error_message, created_at, updated_at

youtube_episode_short_derivatives
  id, tenant_id, episode_id, start_ms, end_ms, status, short_workflow_ref,
  metadata_json, created_at, updated_at
```

Required indexes include tenant-scoped channel/series/episode listing, episode status, due/retryable render jobs, unique `(tenant_id, idempotency_key)`, and unique version per parent document.

### 3.2 State machines

```text
episode:
Idea → Planned → Script Draft → Script Approved → In Production
→ Rendering → Ready to Publish → Uploaded → Archived

script:
draft → in_review → approved | rejected | superseded

render job:
queued → running → succeeded | retryable_failed | failed | cancelled

publishing package:
draft → approved → uploading → uploaded | failed
```

No API may skip an invalid transition. A rejected script returns the episode to `Script Draft`; a failed upload keeps the rendered asset and approved package intact.

## 4. Execution Task List

- [ ] Confirm provider architecture through a bounded technical spike: AI script, TTS, visual/video generation, storage, FFmpeg/render worker, and YouTube OAuth/upload.
- [ ] Add RBAC menu key, sidebar route, tenant disable behavior, and page-level/API-level authorization for `youtube_studio`.
- [ ] Add PostgreSQL migrations, indexes, constraints, and idempotent migration tests for all MVP YouTube Studio tables.
- [ ] Implement tenant-scoped contracts and repositories for channel, strategy, series, episode, blueprint, script, render job, publishing package, and derivative.
- [ ] Implement Channel Strategy/Series/Episode API routes and create the YouTube Studio workspace UI.
- [ ] Implement multilingual blueprint/script generation, versioning, review, and approval gate.
- [ ] Implement Universe and Visual Identity snapshot resolver for production start.
- [ ] Implement durable production queue/orchestrator and provider adapters with quota, artifact, logging, retry, and cancellation behavior.
- [ ] Implement timeline assembly, subtitles, preview/final render, in-app preview, selective scene regeneration, and final approval.
- [ ] Implement publishing package editor, pre-publish checklist, secure YouTube connection, and private/unlisted upload.
- [ ] Implement the parent episode → short-form derivative bridge and derivative status visibility.
- [ ] Add unit, repository, route, authorization, job-state, integration, and end-to-end acceptance tests.
- [ ] Run staging verification, publish a test private/unlisted video, verify tenant isolation, then execute the required release procedure.

## 5. Planned File Changes

Exact filenames for provider-specific adapters may be adjusted only after the technical spike. The domain contract, database schema, authorization boundary, and acceptance criteria must not be weakened without updating this plan.

### 5.1 `lib/schema/user-schema.js`

**Code Sebelum (Current/Before)**

```js
{ key: 'instant_campaign', label: 'Instant Video Campaign', category: 'WORKFLOW' },
{ key: 'multiplier_lab', label: 'Multiplier Lab', category: 'WORKFLOW' },
```

**Code Sesudah (Proposed/After)**

```js
{ key: 'youtube_studio', label: 'YouTube Studio (Long-form AI)', category: 'WORKFLOW' },
{ key: 'instant_campaign', label: 'Instant Video Campaign', category: 'WORKFLOW' },
```

Add the permission to the central registry so admin seed/grants, user management, and tenant-disabled-menu controls recognize it.

### 5.2 `app/components/Sidebar.js`

**Code Sebelum (Current/Before)**

```js
const menuKeyMap = {
  '/instant-factory': 'instant_campaign',
  // no YouTube Studio route
};
```

**Code Sesudah (Proposed/After)**

```js
const menuKeyMap = {
  '/youtube-studio': 'youtube_studio',
  '/instant-factory': 'instant_campaign',
};

// WORKFLOW
{ label: 'YouTube Studio', href: '/youtube-studio', icon: '▶️' },
```

Use the existing permission and tenant-disabled rendering path; do not create a separate client-only entitlement implementation.

### 5.3 `lib/db-pg.js`

**Code Sebelum (Current/Before)**

```js
const migrateVisualIdentityFoundation = async () => {
  // visual_identity_presets migration
};
migrateVisualIdentityFoundation();
```

**Code Sesudah (Proposed/After)**

```js
const migrateYouTubeStudioMvp = async () => {
  // advisory lock + CREATE TABLE IF NOT EXISTS + indexes + constraints
};
migrateYouTubeStudioMvp();
```

Create all MVP tables and constraints in an idempotent advisory-lock migration. JSON columns hold variable creative/provider payloads; core queryable fields remain relational.

### 5.4 `lib/youtube-studio-contract.js` — new

**Code Sebelum (Current/Before)**

```js
// No YouTube Studio input/state contract exists.
```

**Code Sesudah (Proposed/After)**

```js
export function normalizeChannel(input) { /* validates locale and strategy defaults */ }
export function assertEpisodeTransition(from, to) { /* rejects invalid workflow jumps */ }
export function normalizePublishingPackage(input) { /* private | unlisted only for MVP */ }
```

This is the single validation and state-machine boundary shared by APIs, repositories, and workers.

### 5.5 `lib/youtube-studio-repository.js` — new

**Code Sebelum (Current/Before)**

```js
// No tenant-scoped YouTube Studio persistence layer exists.
```

**Code Sesudah (Proposed/After)**

```js
export async function createChannel(input, actor) { /* tenant-scoped insert */ }
export async function createEpisode(input, actor) { /* strategy/series validation */ }
export async function approveScript(id, actor, note) { /* atomic status update */ }
```

Repository functions must follow existing tenant context patterns and never accept `tenant_id` from page form payloads.

### 5.6 `lib/youtube-studio-snapshot-service.js` — new

**Code Sebelum (Current/Before)**

```js
// Strategy, Universe, and Visual Identity snapshots are not composed for episodes.
```

**Code Sesudah (Proposed/After)**

```js
export async function createProductionSnapshot({ episode, strategy }) {
  return { strategy, universe, visualIdentity, createdAt: new Date().toISOString() };
}
```

Resolve Universe/Visual Identity through their authoritative services and store immutable output when production begins.

### 5.7 `lib/youtube-studio-planner.js` — new

**Code Sebelum (Current/Before)**

```js
// No long-form backlog, blueprint, or locale-aware script service exists.
```

**Code Sesudah (Proposed/After)**

```js
export async function generateBlueprint(context) { /* chapters, hooks, duration */ }
export async function generateScript({ blueprint, locale, strategy }) { /* scene VO JSON */ }
```

Prompts require output schema validation, citation/risk fields, natural locale writing, and duration estimates. Do not reuse short-form prompt contracts unchanged.

### 5.8 `lib/youtube-studio-production-worker.js` — new

**Code Sebelum (Current/Before)**

```js
// No durable YouTube long-form production worker exists.
```

**Code Sesudah (Proposed/After)**

```js
export async function processYouTubeRenderJob(jobId) {
  // claim → validate approved script → generate artifacts → persist each step → render
}
```

Implement worker-safe orchestration, idempotency, quota check, retryability classification, and artifact manifests. It must be invoked by the established background execution path, not route handlers directly.

### 5.9 `lib/youtube-studio-render-adapter.js` — new

**Code Sebelum (Current/Before)**

```js
// No provider-neutral adapter for long-form timeline rendering exists.
```

**Code Sesudah (Proposed/After)**

```js
export async function renderLongForm({ timeline, outputPreset, job }) {
  return { videoAsset, subtitleAsset, durationSeconds, providerMetadata };
}
```

Use the selected provider/FFmpeg capability behind this adapter. Output must be 16:9 MP4 plus subtitle asset and provenance metadata.

### 5.10 `lib/youtube-studio-publishing-service.js` — new

**Code Sebelum (Current/Before)**

```js
// Existing code uploads campaign drafts but has no long-form package/approval model.
```

**Code Sesudah (Proposed/After)**

```js
export async function uploadYouTubeDraft({ packageId, actor }) {
  // validate approved checklist → upload private/unlisted → persist video id/studio URL
}
```

Reuse the existing Google authentication primitives where compatible, but create an explicit long-form publishing package and retain upload failure state.

### 5.11 `app/api/v2/youtube-studio/channels/route.js` — new

**Code Sebelum (Current/Before)**

```js
// Route does not exist.
```

**Code Sesudah (Proposed/After)**

```js
export const GET = withTenantContext(async () => listChannels());
export const POST = withTenantContext(async (req, _ctx, user) => createChannel(await req.json(), user));
```

Add tenant-authenticated route patterns consistent with Visual Identity APIs. Child routes will cover channel strategy, series, episodes, blueprint/scripts, production jobs, publishing packages, and derivatives.

### 5.12 `app/api/v2/youtube-studio/episodes/[id]/run/route.js` — new

**Code Sebelum (Current/Before)**

```js
// Route does not exist.
```

**Code Sesudah (Proposed/After)**

```js
export const POST = withTenantContext(async (_req, { params }, user) => {
  return enqueueProductionForApprovedEpisode(params.id, user);
});
```

This endpoint only enqueues/returns the durable job; it does not perform generation or rendering synchronously.

### 5.13 `app/api/v2/youtube-studio/publishing/[episodeId]/upload/route.js` — new

**Code Sebelum (Current/Before)**

```js
// Route does not exist.
```

**Code Sesudah (Proposed/After)**

```js
export const POST = withTenantContext(async (_req, { params }, user) => {
  return uploadYouTubeDraft({ episodeId: params.episodeId, actor: user });
});
```

Validate package approval, final artifact, and `private|unlisted` privacy before invoking the publishing service.

### 5.14 `app/youtube-studio/page.js` — new

**Code Sebelum (Current/Before)**

```js
// Page does not exist.
```

**Code Sesudah (Proposed/After)**

```jsx
export default function YouTubeStudioPage() {
  return <YouTubeStudioWorkspace />;
}
```

Provide channel switcher, pipeline overview, series/episode workspace, script approval, production status, preview, publishing package, and derivative visibility. Split complex UI into local components rather than a single oversized client file.

### 5.15 `app/youtube-studio/components/YouTubeStudioWorkspace.js` — new

**Code Sebelum (Current/Before)**

```js
// Component does not exist.
```

**Code Sesudah (Proposed/After)**

```jsx
export function YouTubeStudioWorkspace() {
  // fetch tenant-scoped domain data; render channel, planner, production, publishing tabs
}
```

Implement loading/error/empty states and enforce user capability checks in UI only as a convenience—the API remains authoritative.

### 5.16 `lib/google-auth.js`

**Code Sebelum (Current/Before)**

```js
// Google credentials are used by existing integrations without a long-form channel binding contract.
```

**Code Sesudah (Proposed/After)**

```js
export async function getAuthorizedYouTubeClient({ tenantId, channelId }) {
  // resolve only the credential binding permitted for that tenant/channel
}
```

Extend only after verifying the current OAuth/token persistence model. Never expose refresh/access tokens through YouTube Studio API responses.

### 5.17 `lib/scheduler-processors.js`

**Code Sebelum (Current/Before)**

```js
// Contains campaign-specific YouTube draft posting paths.
```

**Code Sesudah (Proposed/After)**

```js
// Register/dispatch YouTube Studio production and publishing jobs through dedicated services.
```

Wire background dispatch to the new worker without embedding long-form domain logic into existing campaign processors. If a separate queue runner proves safer in the technical spike, create it and leave this file unchanged; record that deviation in this plan.

### 5.18 Test files — new

**Code Sebelum (Current/Before)**

```js
// No YouTube Studio automated tests exist.
```

**Code Sesudah (Proposed/After)**

```js
describe('YouTube Studio tenant isolation', () => {
  it('does not return another tenant channel or episode');
});
```

Add tests under the repository's existing test convention after confirming the test runner. Required suites: contract/state transitions, repository tenant isolation, API auth, production idempotency/retry, publishing validation, and end-to-end happy path using mocked providers.

## 6. API Surface (MVP)

| Method | Route | Responsibility |
|---|---|---|
| GET/POST | `/api/v2/youtube-studio/channels` | List/create tenant channels |
| GET/PATCH | `/api/v2/youtube-studio/channels/:id` | Detail/update/archive channel and strategy |
| GET/POST | `/api/v2/youtube-studio/channels/:id/series` | List/create series |
| GET/POST | `/api/v2/youtube-studio/episodes` | List/create episode/backlog item |
| GET/PATCH | `/api/v2/youtube-studio/episodes/:id` | Episode detail/update/status |
| POST | `/api/v2/youtube-studio/episodes/:id/blueprint/generate` | Generate blueprint |
| POST | `/api/v2/youtube-studio/episodes/:id/scripts/generate` | Generate a draft script version |
| POST | `/api/v2/youtube-studio/scripts/:id/approve` | Approve/reject script |
| POST | `/api/v2/youtube-studio/episodes/:id/run` | Enqueue production run |
| GET | `/api/v2/youtube-studio/render-jobs/:id` | Poll job/artifact status |
| PATCH | `/api/v2/youtube-studio/episodes/:id/publishing` | Edit package/checklist/approval |
| POST | `/api/v2/youtube-studio/publishing/:episodeId/upload` | Upload private/unlisted draft |
| POST | `/api/v2/youtube-studio/episodes/:id/derivatives` | Create Shorts derivative |

All mutations require actor/audit context, structured error responses, and idempotency where they can trigger paid external work.

## 7. Verification Plan

### Automated

- Migration is idempotent and creates all foreign keys/indexes/check constraints.
- Tenant A cannot read/mutate Channel/Episode/Job owned by Tenant B.
- User without `youtube_studio` cannot access UI route or API route.
- Invalid state transitions and production without approved script return a structured 4xx error.
- Production job duplicate request returns/reuses the same idempotent run.
- Mocked provider failure is persisted as retryable/non-retryable correctly.
- Upload rejects missing/unchecked package items and allows only private/unlisted in MVP.
- A derivative is always linked to an accessible parent episode.

### Staging acceptance

1. Create two channels in one tenant, with distinct locale and Visual Identity.
2. Create a series and episode; generate, edit, and approve a script.
3. Run production to preview; regenerate one scene; render final.
4. Create publishing package and upload a test private/unlisted draft.
5. Create one Shorts derivative and verify its parent link.
6. Attempt cross-tenant and unauthorized access; confirm denial.
7. Verify that job/artifact/error logs are intelligible and secrets are absent.

## 8. Operational Rollout

- Enable menu/permission only for an internal pilot tenant first.
- Configure conservative per-tenant generation/render quota and alerting before pilot execution.
- Use a dedicated test YouTube channel for the first private/unlisted upload.
- Monitor production job latency, failures, provider cost, and storage growth.
- Do not enable public publish or scheduling within the MVP rollout.
- After acceptance succeeds, run repository tests and then follow the mandatory release, tag, and push SOP in `AGENTS.md`.

## 9. Open Technical Inputs Required During Execution

These are implementation choices, not product-scope blockers, and must be resolved in the Fase 0 technical spike:

1. Existing queue/worker mechanism that best supports durable long-running render tasks.
2. Final visual/video generation provider and its retry/cost/capability profile.
3. Artifact storage location, retention period, signed access approach, and final-video file size limit.
4. Whether the existing Google OAuth token model supports channel-specific bindings or needs extension.
5. Exact test runner and strategy for provider mocking.

No provider credential, quota, or secret is to be committed into source, migration, fixture, or Markdown documentation.

