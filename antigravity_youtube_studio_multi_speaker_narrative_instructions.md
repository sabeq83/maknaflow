# Instruksi Tunggal AI Agent Antigravity — Execute YouTube Studio Multi-Speaker Narrative Stage A–E

## Mandat

Eksekusi seluruh Stage A sampai Stage E secara berurutan dalam satu continuous implementation task. Jangan berhenti setelah satu stage untuk meminta instruksi implementasi baru.

Baca dan patuhi penuh:

1. `AGENTS.md`
2. `sot/menus/youtube-studio-multi-speaker-narrative-blueprint.md`
3. `sot/menus/youtube-studio-multi-speaker-narrative-implementation-plan.md`
4. `sot/menus/youtube-studio-roadmap.md`
5. Plan Fase 2, Fase 3, KB Foundation, Hybrid Production, dan Production Orchestration yang dirujuk master plan.

Tujuan akhir:

```text
Narration-only + dialogue-driven + hybrid narration-dialogue
→ multi-speaker Script v2
→ MiniMax/Google provider-aware TTS
→ voice review and scene mix
→ speaker-aware visual plan
→ preview-ready long-form workflow
→ advanced capabilities safely gated
```

## Continuous Execution Rule

- Stage A selesai dan gate lulus → lanjut Stage B otomatis.
- Stage B selesai dan gate lulus → lanjut Stage C otomatis.
- Stage C selesai dan gate lulus → lanjut Stage D otomatis.
- Stage D selesai dan gate lulus → lanjut Stage E otomatis.
- Jangan menunggu user meminta plan/instruction baru per stage.
- Update checkbox master plan secara real-time setelah setiap task benar-benar selesai dan terverifikasi.
- Jika sebuah task gagal, diagnosis dan perbaiki selama masih dalam scope.
- Hanya berhenti untuk meminta user jika dibutuhkan authority baru, credential/provider baru yang belum tersedia, keputusan produk yang mengubah blueprint secara material, atau external paid generation yang belum diizinkan.

## Mandatory Preparation

1. Baca semua dokumen di atas lengkap, bukan ringkasan parsial.
2. Jalankan `git status --short`; lindungi perubahan user/agent lain.
3. Baca dokumentasi Next.js 16 lokal yang relevan sebelum edit Route Handler/Client Component.
4. Audit code aktif, schema Dev, routes, repositories, planners, duration analyzer, production worker, adapters, renderer, KB resolver, CSS, tests, dan PM2 worker ownership.
5. Audit reusable multi-voice patterns pada Pillar Campaign dan Sheets Autopilot, tetapi jangan coupling ke tabel/ID domain tersebut.
6. Jalankan baseline tests/build yang proporsional sebelum perubahan.

## Product Decisions — Do Not Reopen Silently

- Series adalah pusat narrative format.
- Channel Strategy adalah default/policy.
- Episode Story Setup adalah override sebelum Research.
- Precedence: Episode → Series → Channel → narration-only fallback.
- Script v2 memakai `audio_blocks`; `voiceover` lama dinormalisasi.
- Speaker identity terpisah dari voice casting.
- Universe character menjadi visual identity source.
- MiniMax dialogue = one T2A request per speaker turn.
- Google default = segmented turns.
- Google native dialogue = optional, exactly/up to two speakers according active API contract, feature-gated.
- MVP visual dialogue tidak membutuhkan lip-sync.
- Tanpa lip-sync provider terverifikasi, tampilkan unavailable; jangan simulate success.

## Stage A Instructions

Implementasikan:

- contract/normalizer narrative mode, cast, voice casting;
- idempotent non-destructive migrations;
- resolver dan immutable snapshot/provenance;
- Channel Narrative Defaults;
- Series Format & Cast;
- Episode Story Setup;
- status locking dan impact/invalidation preview;
- tenant/permission enforcement;
- UI one-column + semantic CSS.

Gate: resolver, validation, backward compatibility, tenant isolation, and UI tests pass. Update checklist, then continue.

## Stage B Instructions

Implementasikan:

- KB extensions pada lima KB existing, tanpa KB type baru;
- Research narrative research/knowledge map;
- Blueprint dialogue beats/narrator function;
- Script v2 speaker manifest/audio blocks;
- v1 compatibility normalizer;
- multi-speaker duration/pacing/auto-fit;
- script editor blocks dan approval/invalidation.

Gunakan AI output schema ketat dan server-side validation. AI tidak boleh menciptakan speaker yang tidak ada di resolved cast.

Gate: fixtures untuk ketiga mode, invalid cases, v1 regression, and mocked AI snapshot tests pass. Update checklist, then continue.

## Stage C Instructions

Implementasikan provider capability registry dan default `segmented_turns`.

MiniMax:

- endpoint contract tetap single `voice_id` per request;
- satu audio block = satu request;
- jangan membuat undocumented multi-speaker payload;
- sync untuk granular blocks; async hanya eligible long/bulk flow;
- voice/model/locale/cost/request lineage disnapshot tanpa credential.

Google:

- current single-speaker Gemini TTS tetap backward compatible;
- segmented turns satu request per audio block;
- native two-speaker function boleh ditambahkan tetapi hanya diaktifkan Stage E.

Audio pipeline:

```text
audio block job
→ provider request
→ canonical normalization
→ actual duration probe
→ per-block review
→ ordered scene mix + explicit pauses
→ speaker-aware subtitles
→ VO approval
```

Gunakan durable job, idempotency, bounded concurrency, tenant context, retry/backoff, selective regeneration, and honest statuses.

Gate: provider mocks, voice mapping, selective regen, timing/subtitle, scene mix, and approval-gating tests pass. Update checklist, then continue.

## Stage D Instructions

Implementasikan:

- audio block → visual beat mapping;
- speaker focus/listener/on-screen character fields;
- Universe canonical character + Visual Continuity injection;
- reaction/profile/OTS/cutaway dialogue grammar;
- T2I→I2V continuity selection;
- no-lip-sync validation;
- multi-speaker preview assembly, subtitle/music/SFX alignment;
- selective reassembly and truthful UI status.

Gate: speaker reference, visual coverage, continuity, no-fake-lipsync, selective invalidation, and mocked render tests pass.

Controlled real-provider Dev smoke may run only with explicit user authorization and minimum batch. Without authorization, complete mocked verification and report the exact pending smoke action; do not bypass approval.

Update checklist, then continue Stage E.

## Stage E Instructions

### Google native two-speaker

- support exactly two mapped aliases/voices per eligible group;
- validate model/API capability and input limit;
- retain block lineage;
- changing one turn invalidates whole native group;
- automatic safe fallback to segmented turns on unsupported capability/error;
- opt-in feature flag, default off until Dev verified.

### Dubbing foundation

- locale-specific block/casting snapshot separate from source script/audio;
- preserve source language assets;
- feature flag default off until full quality workflow exists.

### Lip-sync foundation

- implement provider interface, capability read model, request/result lineage, and eligibility checks;
- integrate actual provider only when already configured and explicitly in scope;
- otherwise return unavailable with reason and never enqueue/claim success.

Gate: native payload/fallback, >2 speaker rejection, dubbing isolation, and lip-sync unavailable tests pass.

## Code and Data Safety

- Use `apply_patch` for edits.
- No destructive reset/checkout/delete of user data or unrelated changes.
- Migrations use advisory lock, `IF NOT EXISTS`, tenant-safe constraints/indexes, and no destructive backfill.
- Existing narration-only episodes/scripts/assets remain readable.
- Do not overwrite approved immutable snapshots.
- File/process paths must be validated; no user text interpolated into shell commands.
- Never log API keys, cookies, raw private KB snapshot, or full sensitive transcript.
- No paid external media generation from page load, GET, read model, tests, or automatic migration.

## Next.js and UI

- Follow local Next.js 16 docs, including async route params.
- Preserve one-column vertical YouTube Studio UX.
- CSS Module + semantic classes + `app/theme.css` tokens only.
- No new hex/rgb/rgba/color-mix or inline visual styles.
- Show inheritance source and server-authoritative workflow state.
- Speaker identity cannot rely on color alone.
- Add accessibility labels, keyboard behavior, and ARIA live status.

## Tests and Evidence

Implement all focused tests listed in the master plan. Automated tests use mocked MiniMax, Google, visual, and render providers—no paid calls.

After each stage:

1. run focused tests;
2. run regression tests affected by the stage;
3. update checkboxes with date/evidence;
4. continue to next stage without waiting for user.

Final verification:

- all YouTube focused tests;
- narration-only regression;
- `npm run build`;
- Dev-only deployment;
- authenticated API/UI smoke on Dev within granted provider authority;
- worker/job/status/tenant evidence.

## Deployment Restriction

Only:

```bash
npm run deploy:macmini-dev
```

Do not deploy staging or production. Do not run repeated SSH polling during remote build.

Do not publish/upload YouTube content or run final paid render without explicit user instruction.

## Release

After all implementation, tests, build, Dev deployment, and permitted smoke verification succeed, execute the release command in the master plan and verify commit/tag/push according to `AGENTS.md`.

## Final Report

Report once at the end of the complete A–E task, containing:

- stage-by-stage completion and remaining feature flags;
- migrations and backward compatibility;
- narrative inheritance and Script v2 contract;
- MiniMax/Google strategies actually implemented;
- test/build results;
- controlled Dev smoke evidence without credentials/raw transcript;
- Dev-only deployment confirmation;
- explicit note if real lip-sync remains unavailable due to missing provider;
- release version, commit, tag, push;
- remaining risks or manually authorized next actions.
