# Implementation Plan — YouTube Studio Fase 3.5A: Knowledge Base Foundation

> Status: Planned.  
> Mandat: Membuat Knowledge Base baru dan mandiri untuk YouTube Studio. Jangan memakai ulang KB MAKNA Flow lama.  
> Batas: Tidak membuat start frame, TTS, visual generation, render, atau publishing.

## 1. Objective

Menyediakan KB versioned, tenant-safe, multi-channel, dan snapshot-able agar AI Research, Blueprint, Script, dan Production Plan long-form konsisten lintas episode tanpa bergantung pada prompt ad-hoc.

```text
Tenant KB Library
→ Channel Profile
→ Series Content Guide
→ Episode context resolver
→ immutable KB snapshot in Research / Blueprint / Script / Production Plan
```

## 2. KB Types

| Type | Scope | Fungsi |
|---|---|---|
| `channel_profile` | Channel | Positioning, audience, language, tone, CTA, forbidden claims, monetization direction |
| `series_content_guide` | Series | Format episode, recurring chapters, playlist pattern, content boundary |
| `longform_editorial_playbook` | Tenant/channel | Hook, retention, pacing, open loops, CTA, chapter architecture |
| `research_source_policy` | Tenant/channel | Source standard, claim confidence, citation, factual uncertainty |
| `visual_continuity_guide` | Channel/series | Character/location rules, visual grammar, palette, framing, lighting, drift prevention |
| `prompt_production_playbook` | Channel/series | T2I/I2V/T2V prompt grammar, continuity tokens, negative prompt policy |
| `voice_audio_guide` | Channel | Voice persona, pronunciation, speech pacing, music/SFX guardrails |
| `rights_disclosure_policy` | Tenant/channel | Asset provenance, disclosure, archival/reuse policy |

Each type uses a structured schema plus optional Markdown narrative. No legacy MAKNA Flow KB is imported automatically.

## 3. KB Lifecycle

```text
Draft → Review → Active → Superseded → Archived
```

- Only one active revision per `(tenant, scope, scope_id, kb_type)`.
- Existing episodes never change when a KB is edited: generation saves the resolved KB revisions and normalized content as an immutable snapshot.
- Channel may attach a default KB set; Series may override/extend relevant types.
- User can create manually or use AI-assisted draft generation; AI draft always requires review/activation.

## 4. Execution Task List

- [ ] Define JSON schemas, required fields, size limits, and lifecycle contract for every KB type.
- [ ] Add idempotent PostgreSQL migration for KB documents, revisions, scope bindings, and snapshot references.
- [ ] Implement tenant-scoped KB repository with create/edit/version/activate/archive and scope inheritance resolution.
- [ ] Implement AI KB drafting/refinement services using only user-provided channel/series context and fresh YouTube Studio schemas.
- [ ] Add permission-checked KB APIs and attachment APIs for Channel/Series.
- [ ] Build one-column semantic CSS UI for KB Library, KB editor, revision review, and Channel/Series attachment.
- [ ] Implement context resolver and immutable snapshot injection into Research, Blueprint, Script, and Production Plan paths.
- [ ] Add validation, tenant isolation, revision, inheritance, snapshot regression, and mocked-AI tests.
- [ ] Run build, focused tests, Dev-only KB workflow smoke test, and update checklist with evidence.

## 5. Planned File Changes

### 5.1 `lib/youtube-studio-kb-contract.js` — new

**Code Sebelum (Current/Before)**

```js
// YouTube Studio KB contract does not exist.
```

**Code Sesudah (Proposed/After)**

```js
export const KB_TYPES = ['channel_profile', 'series_content_guide', /* ... */];
export function validateKnowledgeBase(type, content) { /* type-specific schema */ }
export function assertKbTransition(from, to) { /* lifecycle */ }
```

Use bounded structured fields and Markdown length limits. Reject unknown KB type, malformed content, and client-owned tenant/scope authority.

### 5.2 `lib/db-pg.js`

**Code Sebelum (Current/Before)**

```sql
-- No YouTube Studio Knowledge Base tables exist.
```

**Code Sesudah (Proposed/After)**

```sql
CREATE TABLE IF NOT EXISTS youtube_knowledge_bases (...);
CREATE TABLE IF NOT EXISTS youtube_knowledge_base_revisions (...);
CREATE TABLE IF NOT EXISTS youtube_kb_bindings (...);
```

Use advisory-lock migration, tenant indexes, scope/type/status checks, one-active-revision constraint, and non-destructive history retention.

### 5.3 `lib/youtube-studio-kb-repository.js` — new

**Code Sebelum (Current/Before)**

```js
// No KB persistence or scope-resolution service exists.
```

**Code Sesudah (Proposed/After)**

```js
export async function resolveEpisodeKnowledgeBase({ channelId, seriesId }) {}
export async function activateKbRevision(revisionId, actor) {}
export async function createKbSnapshot(context) {}
```

Resolve tenant → channel bindings → series overrides deterministically, then return normalized source references plus immutable content snapshot.

### 5.4 `lib/youtube-studio-kb-ai.js` — new

**Code Sebelum (Current/Before)**

```js
// No AI-assisted KB drafting service exists.
```

**Code Sesudah (Proposed/After)**

```js
export async function generateKnowledgeBaseDraft({ type, scope, brief, locale }) {}
export async function refineKnowledgeBaseDraft({ revision, instruction }) {}
```

Use new YouTube Studio schemas only. Do not load, copy, or silently merge legacy MAKNA Flow KB content.

### 5.5 `lib/youtube-studio-planner.js` and `lib/youtube-studio-production-planner.js`

**Code Sebelum (Current/Before)**

```js
// Prompts use Strategy / Universe / Visual Identity context directly.
```

**Code Sesudah (Proposed/After)**

```js
const kbSnapshot = await resolveEpisodeKnowledgeBase({ channelId, seriesId });
// inject relevant typed KB sections and persist snapshot with generated artifact
```

Inject only relevant KB types per generation stage. Avoid sending all KB text blindly; include bounded, structured context and provenance revision IDs.

### 5.6 `app/api/v2/youtube-studio/knowledge-bases/route.js` — new

**Code Sebelum (Current/Before)**

```js
// Route does not exist.
```

**Code Sesudah (Proposed/After)**

```js
export const GET = withYouTubeStudioAccess('read', listKnowledgeBases);
export const POST = withYouTubeStudioAccess('write', createKnowledgeBaseDraft);
```

Add focused revision/refine/activate/archive/bind routes. All use server-side tenant and scope ownership validation.

### 5.7 `app/youtube-studio/components/YouTubeStudioWorkspace.js`

**Code Sebelum (Current/Before)**

```jsx
// Channel Strategy, Series, Episodes, and Production are the workflow areas.
```

**Code Sesudah (Proposed/After)**

```jsx
<section className={styles.knowledgeBaseStep} aria-labelledby="kb-step-title">
  <KnowledgeBaseLibrary />
  <KnowledgeBaseBindings />
</section>
```

Add KB as a compact Channel/Series configuration section, not a separate generic settings maze. Preserve one-column workflow.

### 5.8 `app/youtube-studio/components/YouTubeStudioWorkspace.module.css`

**Code Sebelum (Current/Before)**

```css
/* No KB-specific component classes. */
```

**Code Sesudah (Proposed/After)**

```css
.knowledgeBaseStep { background: var(--surface); }
.revisionStatus { color: var(--status-neutral); }
.bindingSummary { color: var(--text-secondary); }
```

Semantic CSS Module classes and theme tokens only—no inline style or literal colors.

### 5.9 `scripts/test-youtube-studio-kb.mjs` — new

**Code Sebelum (Current/Before)**

```js
// KB contract/revision/snapshot tests do not exist.
```

**Code Sesudah (Proposed/After)**

```js
test('an episode retains the KB revision snapshot used at generation time', async () => {});
```

Test type schemas, active revision uniqueness, scope inheritance, tenant isolation, snapshot immutability, prompt context bounds, and AI mock behavior.

### 5.10 This plan

Update checklist only after evidence-based completion. Add any new file to this section with Code Sebelum/Code Sesudah before editing it.

## 6. Acceptance Criteria

1. No legacy MAKNA Flow KB is imported or used implicitly.
2. User can draft, review, activate, supersede, and archive each new KB type.
3. Channel/Series bindings resolve deterministic KB context with authorized tenant scope.
4. Research, Blueprint, Script, and Production Plan record immutable relevant KB snapshot/revisions.
5. Editing a KB later does not alter an existing episode artifact or its snapshot.
6. AI KB draft requires user activation and validates against type schema.
7. UI stays one-column, semantic CSS, accessible, and theme-aligned.
8. Build/tests/Dev-only smoke pass.

## 7. Verification and Dev-only Deployment

```bash
npm run build
npm run deploy:macmini-dev
```

Verify only `http://100.95.245.55:5020/youtube-studio` and API port `7020`. Do not deploy staging/production.

## 8. Release

```bash
npm run release-non-interactive -- --type minor --title "YouTube Studio Knowledge Base" --points "Tambah KB mandiri versioned untuk Channel dan Series|Tambah snapshot KB pada pipeline editorial dan production|Tambah AI KB drafting dengan approval workflow"
```
