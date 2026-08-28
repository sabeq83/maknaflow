# Master Implementation Plan — YouTube Studio Multi-Speaker Narrative (Stage A–E)

> Status: Planned  
> Blueprint source: `sot/menus/youtube-studio-multi-speaker-narrative-blueprint.md`  
> Scope: narration-only, dialogue-driven, hybrid narration-dialogue, multi-speaker TTS, speaker-aware visual production, dan advanced capability foundation  
> Delivery model: satu continuous implementation task; agent melanjutkan Stage A sampai E tanpa menunggu instruksi baru per stage  
> Deployment target: **Mac Mini Dev only**  
> Production deployment: explicitly prohibited tanpa perintah manual baru

## 1. Objective

Mengubah YouTube Studio dari kontrak monolog:

```text
Scene → one voiceover string → one episode voice → one scene audio
```

menjadi pipeline multi-speaker:

```text
Channel narrative defaults
→ Series format + recurring cast
→ Episode Story Setup override
→ resolved narrative snapshot
→ Research character knowledge
→ Blueprint dialogue beats
→ Script audio_blocks
→ provider-aware multi-speaker TTS
→ speaker-aware visual beats
→ subtitles + preview + final render
```

Mode yang wajib didukung:

- `narration_only`
- `dialogue_driven`
- `hybrid_narration_dialogue`

Backward compatibility narration-only wajib dipertahankan.

## 2. Delivery Stages

| Stage | Nama | Hasil utama |
|---|---|---|
| A | Narrative Configuration Foundation | Channel/Series/Episode settings, cast, resolver, immutable snapshot |
| B | Editorial Intelligence | Research, Blueprint, dan Script schema v2 memahami dialog dan speaker |
| C | Multi-Speaker Audio | MiniMax/Google provider capability, TTS per block, voice review, scene mix, subtitle |
| D | Speaker-Aware Visual Production | Visual beats, speaker focus, reaction coverage, hybrid prompt matrix, preview/render |
| E | Advanced Capability | Optional Google native two-speaker, dubbing foundation, lip-sync capability interface dan feature gates |

Agent harus menyelesaikan stage secara berurutan. Stage berikutnya hanya dimulai setelah automated gate stage sebelumnya lulus. Tidak diperlukan prompt baru dari user untuk melanjutkan.

## 3. Decisions Locked

1. Series adalah pusat konfigurasi narrative format.
2. Channel Strategy menyediakan default dan override policy.
3. Episode menyediakan Story Setup override sebelum Research.
4. Precedence: `episode → series → channel → system narration_only`.
5. Script v2 memakai `audio_blocks` sebagai source of truth.
6. `voiceover` pada script lama dinormalisasi menjadi narrator audio block.
7. Speaker identity terpisah dari voice casting.
8. Universe character menjadi referensi visual; speaker/voice mapping disimpan di Series/Episode.
9. MiniMax T2A menggunakan satu request per speaker turn.
10. Google Gemini TTS menggunakan `segmented_turns` sebagai default.
11. Google native two-speaker hanya optional optimization dan maksimal dua speaker.
12. MVP Stage A–D tidak bergantung pada lip-sync.
13. Stage E tidak boleh memalsukan lip-sync; tanpa provider aktif, capability tampil unavailable.
14. Semua downstream artifact menyimpan resolved narrative, cast, voice, KB, dan provider snapshot.
15. Perubahan narrative/cast/audio menginvalidasi dependency secara selektif dan non-destructive.

## 4. Cross-Cutting Contracts

### 4.1 Narrative mode

```js
export const NARRATIVE_MODES = [
  'narration_only',
  'dialogue_driven',
  'hybrid_narration_dialogue',
];
```

### 4.2 Synthesis strategy

```js
export const TTS_SYNTHESIS_STRATEGIES = [
  'segmented_turns',
  'native_two_speaker',
];
```

### 4.3 Resolved narrative snapshot

```json
{
  "schema_version": 1,
  "resolved_mode": "hybrid_narration_dialogue",
  "dialogue_ratio": { "target": 0.35, "min": 0.25, "max": 0.45 },
  "narrator_usage": "chapter_open_close",
  "point_of_view": "third_person_omniscient",
  "max_speakers_per_scene": 2,
  "speakers": [],
  "guardrails": [],
  "provenance": {},
  "resolved_at": "ISO timestamp"
}
```

### 4.4 Script v2

```json
{
  "schema_version": 2,
  "narrative_mode": "hybrid_narration_dialogue",
  "speaker_manifest": [],
  "scenes": [
    {
      "scene_index": 1,
      "audio_blocks": [
        {
          "block_id": "sc01_ab01",
          "order": 1,
          "type": "dialogue",
          "speaker_id": "character_a",
          "text": "...",
          "emotion": "restrained",
          "delivery": "quiet",
          "pause_before_ms": 0,
          "pause_after_ms": 400,
          "estimated_duration_seconds": 3.2,
          "visual_beat_id": "sc01_vb01"
        }
      ]
    }
  ]
}
```

### 4.5 Compatibility normalizer

```text
schema v1 scene.voiceover
→ narrator audio_block
→ same validation/duration/production pipeline
```

No destructive rewrite of existing approved scripts is allowed.

## 5. Stage A — Narrative Configuration Foundation

### Goals

- narrative defaults pada Channel Strategy;
- narrative format dan recurring cast pada Series;
- Story Setup dan episode cast override;
- deterministic resolver;
- immutable snapshot/provenance;
- permission, tenant isolation, validation, and invalidation preview.

### UI placement

```text
Channel Strategy → Editorial Identity → Narrative Defaults
Series → Format & Cast
Episode → Story Setup
```

### Stage A gate

1. Resolver precedence test lulus.
2. Invalid speaker/cast/voice config ditolak.
3. Episode lama resolve sebagai `narration_only` tanpa migration data loss.
4. Story Setup terkunci setelah Research dan perubahan downstream memerlukan explicit regeneration confirmation.
5. UI memakai semantic CSS tokens dan tidak hard-code warna.

## 6. Stage B — Editorial Intelligence

### Goals

- Research memiliki conflict opportunity, character knowledge map, dan dialogue risk flags;
- Blueprint memiliki narrator function dan dialogue beats;
- Script v2 menghasilkan audio blocks dengan speaker manifest;
- validator menjaga speaker, locale, ratio, pacing, knowledge ownership, dan factual risks;
- editor menampilkan speaker blocks dan tetap dapat membaca script v1.

### AI rules

- Research tidak menulis dialog final.
- Blueprint menentukan fungsi dialog sebelum Script.
- AI tidak boleh menciptakan speaker di luar resolved cast.
- Dialog harus menggerakkan conflict, reveal, relationship, atau decision.
- Narator tidak mengulang informasi yang sudah jelas dari dialog.
- Factual claims tetap mengikuti Research Source Policy walau diucapkan karakter.

### Stage B gate

1. Narration-only, dialogue-driven, dan hybrid fixtures tervalidasi.
2. Unknown speaker, duplicate block ID, invalid ordering, invalid ratio, dan duration overflow ditolak.
3. Script v1 masih dapat dianalisis, diedit, di-approve, dan diproduksi.
4. Auto-fit menghasilkan version baru dan tidak mengubah information ownership antar speaker.
5. AI mocked tests memastikan resolved snapshot masuk ke Research/Blueprint/Script prompts.

## 7. Stage C — Multi-Speaker Audio

### 7.1 Provider contract

MiniMax:

```text
provider=minimax
strategy=segmented_turns
one audio block → one t2a_v2 request → one voice_id
```

Google:

```text
provider=google_tts
default strategy=segmented_turns
optional strategy=native_two_speaker
model=current Gemini TTS model selected by registry
```

### 7.2 Default production path

```text
Approved Script v2
→ resolve casting snapshot
→ create one durable audio asset/job per audio block
→ MiniMax or Google single-speaker request
→ normalize canonical audio format
→ probe actual duration
→ review per block / speaker / scene
→ concatenate/mix with explicit pauses
→ generate speaker-aware subtitle timing
→ approve VO batch
```

### 7.3 Provider requirements

- capability registry server-side;
- voice ID allowlist per provider/locale;
- provider/model/synthesis strategy snapshot;
- bounded concurrency and provider-specific retry/backoff;
- no credential in logs/snapshots;
- idempotency per `audio_block_id + script_version + casting_version`;
- cost/usage metadata per provider request;
- canonical output before mix, e.g. PCM/WAV settings selected by renderer contract;
- MiniMax async reserved for eligible long-form/bulk use, not multi-speaker request emulation.

### Stage C gate

1. Provider mocks prove correct voice per speaker.
2. MiniMax never receives multiple speaker identities in one request.
3. Google segmented mode generates one request per block.
4. Regenerate one block leaves unrelated block artifacts intact.
5. Actual duration refreshes scene/package timing and subtitle cues.
6. Voice review/approval gates prevent visual generation before VO approval.
7. Scene mix preserves ordered turns and explicit pauses.

## 8. Stage D — Speaker-Aware Visual Production

### Goals

- Production Plan maps audio blocks to visual beats;
- speaker focus/listener reaction/on-screen characters are explicit;
- recurring character prompts resolve through Universe/Visual Continuity snapshot;
- dialogue shot grammar avoids unsupported lip-sync claims;
- hybrid T2I→I2V uses character continuity for recurring characters;
- preview assembly aligns scene audio, visual clips, subtitles, music, and SFX.

### MVP dialogue visual grammar

- establishing shot for narrator context;
- profile/medium/over-the-shoulder for speaking character;
- reaction shot for listener;
- cutaway and environmental coverage;
- off-screen dialogue when safer;
- avoid mouth close-up unless lip-sync capability is active.

### Stage D gate

1. Every audio block maps to a valid visual beat/timeline range.
2. Speaker focus references resolved cast.
3. T2I/I2V prompt includes correct canonical character identity.
4. No shot claims lip-sync without active capability and lineage.
5. Selective block/voice change invalidates only dependent timing/render artifacts.
6. Mocked preview assembly succeeds with multiple speaker audio assets.
7. Dev smoke can reach preview with a small controlled episode after explicit user-approved provider actions.

## 9. Stage E — Advanced Capability

Stage E is executed after A–D gates pass, but all features are capability-gated.

### E1. Google native two-speaker

- exactly two speakers per dialogue group;
- adapter sends Google multi-speaker configuration;
- aliases match transcript speaker names;
- combined audio retains lineage to all block IDs;
- changing one turn invalidates entire native group;
- fallback to segmented turns on capability/limit/error;
- native mode is opt-in, never silent automatic migration.

### E2. Multilingual dubbing foundation

- translated/localized audio-block layer separate from source script;
- stable `speaker_id`, new locale-specific casting;
- pronunciation and terminology snapshot per locale;
- timing adaptation without overwriting source-language assets;
- no promise of automatic full dubbing until provider/quality gate is enabled.

### E3. Lip-sync capability interface

- define adapter interface, capability registry, request/result lineage, and selective shot eligibility;
- only approved visible-speaking close-ups are eligible;
- absent configured provider: UI shows unavailable and does not enqueue;
- no placeholder or non-lip-synced result marked as lip-sync success;
- actual provider integration requires separate explicit provider credential/configuration already available in project scope.

### Stage E gate

1. Google native mock validates exact two-speaker payload and fallback.
2. More than two speakers are rejected or routed to segmented turns.
3. Dubbing snapshots preserve original script/audio.
4. Lip-sync unavailable state is honest and non-actionable.
5. Feature flags default off except capability proven by tests and Dev smoke.

## 10. Execution Task List

### Preparation

- [ ] Read `AGENTS.md`, this master plan, blueprint, roadmap, KB foundation, Fase 2/3/3.5 plans, and current git status in full.
- [ ] Read relevant Next.js 16 local documentation before editing Route Handlers or Client Components.
- [ ] Audit current database schema, route contracts, repository, planner, duration analysis, production orchestration, TTS adapters, renderer, KB resolver, UI, tests, and existing multi-voice implementation in Pillar/Sheets pipelines.
- [ ] Record baseline focused tests/build and preserve unrelated user changes.

### Stage A

- [ ] Add narrative/cast/voice contract and backward-compatible normalizers.
- [ ] Add idempotent, non-destructive schema migration for episode narrative override and queryable audio-block lineage fields planned for later stages.
- [ ] Implement narrative resolver with Channel → Series → Episode precedence and provenance.
- [ ] Implement Channel, Series, and Episode APIs for validated narrative configuration and cast.
- [ ] Implement Channel Narrative Defaults, Series Format & Cast, and Episode Story Setup UI.
- [ ] Implement locking/invalidation impact preview and immutable snapshot creation.
- [ ] Add Stage A tests and update this checklist only after evidence passes.

### Stage B

- [ ] Extend KB templates/contracts without creating a new KB type.
- [ ] Extend Research and Blueprint contracts/prompts with character knowledge/dialogue beats.
- [ ] Implement Script schema v2, v1 normalizer, validators, and speaker-aware duration analysis.
- [ ] Update auto-fit, script approval, versioning, and invalidation behavior.
- [ ] Implement speaker-block Script editor/read model and quality checks.
- [ ] Add Stage B tests and update checklist only after evidence passes.

### Stage C

- [ ] Implement TTS provider capability registry and synthesis strategy resolver.
- [ ] Extend voice casting to provider/model/locale/speaker mappings.
- [ ] Create durable audio assets/jobs per audio block with idempotency and tenant context.
- [ ] Implement MiniMax segmented dialogue and Google segmented dialogue.
- [ ] Implement canonical audio normalization, duration probing, ordered scene mix, and speaker-aware subtitles.
- [ ] Implement block/speaker/scene review, regenerate, approve, retry, and status APIs/UI.
- [ ] Add Stage C provider mocks and integration tests without paid external calls.
- [ ] Update checklist only after evidence passes.

### Stage D

- [ ] Extend Production Plan/hybrid planner with audio block → visual beat mapping.
- [ ] Add speaker focus, listener reaction, on-screen character, and lip-sync eligibility fields.
- [ ] Feed Universe character and Visual Continuity snapshots into prompts/validation.
- [ ] Update render/preview assembly for multi-speaker audio, subtitle, music, SFX, and actual timings.
- [ ] Add selective invalidation/reassembly and UI production status.
- [ ] Add Stage D mocked visual/render tests.
- [ ] Run controlled Dev smoke through preview only after explicit approval for real provider calls.
- [ ] Update checklist only after evidence passes.

### Stage E

- [ ] Implement optional Google native two-speaker adapter, validation, lineage, and segmented fallback.
- [ ] Implement locale-specific dubbing data/snapshot foundation behind disabled-by-default feature flag.
- [ ] Implement lip-sync provider interface and honest unavailable state; integrate a real provider only if already configured and explicitly in scope.
- [ ] Add Stage E tests for two-speaker limit, fallback, dubbing isolation, and lip-sync feature gate.
- [ ] Update checklist only after evidence passes.

### Final verification and delivery

- [ ] Run all YouTube Studio focused tests plus regression tests for existing narration-only production.
- [ ] Run `npm run build` and fix scope-related warnings/errors.
- [ ] Deploy only with `npm run deploy:macmini-dev`.
- [ ] Verify Dev APIs/UI, worker health, tenant isolation, and controlled smoke evidence.
- [ ] Do not deploy staging/production and do not publish/upload YouTube content.
- [ ] Update all completed checkboxes with dates/evidence.
- [ ] Run required release SOP only after implementation and verification complete.

## 11. Planned File Changes — Stage A

Each file listed below must be audited first. If the final implementation selects a different file, add it to this section with Before/After before editing.

### 11.1 `lib/youtube-studio-contract.js`

**Code Sebelum (Current/Before)**

```js
export function validateSceneScript(script) {
  if (!scene.voiceover) throw new Error('voiceover cannot be empty');
}
```

**Code Sesudah (Proposed/After)**

```js
export const NARRATIVE_MODES = [...];
export function normalizeNarrativeConfig(input) {}
export function validateSpeakerManifest(input) {}
export function normalizeScriptToV2(script, snapshot) {}
```

### 11.2 `lib/youtube-studio-narrative-resolver.js` — new

**Code Sebelum (Current/Before)**

```js
// No deterministic Channel → Series → Episode narrative resolver.
```

**Code Sesudah (Proposed/After)**

```js
export function resolveNarrativeConfiguration({ channelStrategy, series, episode }) {
  return { schema_version: 1, resolved_mode, speakers, provenance };
}
```

### 11.3 `lib/db-pg.js`

**Code Sebelum (Current/Before)**

```sql
youtube_episodes (... target_duration_seconds, voice_provider, voice_persona ...)
```

**Code Sesudah (Proposed/After)**

```sql
ALTER TABLE youtube_episodes
  ADD COLUMN IF NOT EXISTS narrative_config_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE youtube_production_assets
  ADD COLUMN IF NOT EXISTS audio_block_id TEXT,
  ADD COLUMN IF NOT EXISTS speaker_id TEXT;
```

Use advisory lock, indexes/constraints where justified, and non-destructive migration.

### 11.4 `lib/youtube-studio-repository.js`

**Code Sebelum (Current/Before)**

```js
createSeries({ config: input.config || {} });
setEpisodeGenerationProfile({ voicePersona: oneEpisodeVoice });
```

**Code Sesudah (Proposed/After)**

```js
saveChannelNarrativeDefaults(...)
saveSeriesNarrativeFormatAndCast(...)
saveEpisodeStorySetup(...)
getResolvedNarrativeSnapshot(...)
```

All writes tenant-scoped, validated, audited, and status-gated.

### 11.5 `app/api/v2/youtube-studio/channels/[id]/strategy/route.js`

**Code Sebelum (Current/Before)**

```js
// Strategy config has no validated narrative_defaults contract.
```

**Code Sesudah (Proposed/After)**

```js
// GET/POST returns and validates narrative_defaults within strategy config.
```

### 11.6 `app/api/v2/youtube-studio/series/[id]/narrative/route.js` — new

**Code Sebelum (Current/Before)**

```js
// No Series Format & Cast API.
```

**Code Sesudah (Proposed/After)**

```js
export const GET = withYouTubeStudioAccess('read', getNarrativeFormat);
export const PATCH = withYouTubeStudioAccess('write', updateNarrativeFormat);
```

### 11.7 `app/api/v2/youtube-studio/episodes/[id]/story-setup/route.js` — new

**Code Sebelum (Current/Before)**

```js
// No Episode Story Setup endpoint.
```

**Code Sesudah (Proposed/After)**

```js
// GET resolved/inherited config; PATCH validated override before Research.
```

### 11.8 `app/youtube-studio/components/ChannelDetailView.js`

**Code Sebelum (Current/Before)**

```jsx
<ToneOfVoice />
```

**Code Sesudah (Proposed/After)**

```jsx
<NarrativeDefaultsEditor value={strategy.narrative_defaults} />
```

### 11.9 `app/youtube-studio/components/SeriesDetailView.js`

**Code Sebelum (Current/Before)**

```jsx
// Series details do not expose narrative format or recurring cast.
```

**Code Sesudah (Proposed/After)**

```jsx
<SeriesFormatAndCastEditor series={series} universe={universe} />
```

### 11.10 `app/youtube-studio/components/EpisodeWorkspace.js`

**Code Sebelum (Current/Before)**

```jsx
// Episode begins with Research/Blueprint; no Story Setup.
```

**Code Sesudah (Proposed/After)**

```jsx
<StorySetupPanel resolved={resolvedNarrative} editable={canEditStorySetup} />
```

### 11.11 `app/youtube-studio/components/YouTubeStudioWorkspace.module.css`

**Code Sebelum (Current/Before)**

```css
/* No semantic narrative/cast/speaker component classes. */
```

**Code Sesudah (Proposed/After)**

```css
.narrativeSettings {}
.castRoster {}
.speakerBlock {}
.inheritedValue {}
```

Only use variables/tokens from `app/theme.css`; no literal color values or new inline visual styles.

## 12. Planned File Changes — Stage B

### 12.1 `lib/youtube-studio-planner.js`

**Code Sebelum (Current/Before)**

```js
"voiceover": "naskah voiceover lengkap untuk dibaca"
```

**Code Sesudah (Proposed/After)**

```js
// Research: narrative_research
// Blueprint: narrative_plan.dialogue_beats
// Script v2: speaker_manifest + scenes[].audio_blocks
```

Pass resolved narrative and bounded KB snapshot explicitly.

### 12.2 `app/api/v2/youtube-studio/episodes/[id]/research/route.js`

**Code Sebelum (Current/Before)**

```js
generateResearchBrief(episode, strategy, universe, visualIdentity)
```

**Code Sesudah (Proposed/After)**

```js
generateResearchBrief(episode, strategy, universe, visualIdentity, resolvedNarrative)
```

Persist immutable narrative provenance in Research context snapshot.

### 12.3 `app/api/v2/youtube-studio/episodes/[id]/blueprint/generate/route.js`

**Code Sebelum (Current/Before)**

```js
generateBlueprint(episode, strategy, research, universe, visualIdentity)
```

**Code Sesudah (Proposed/After)**

```js
generateBlueprint(episode, strategy, research, universe, visualIdentity, resolvedNarrative)
```

### 12.4 `app/api/v2/youtube-studio/episodes/[id]/scripts/generate/route.js`

**Code Sebelum (Current/Before)**

```js
generateScript(episode, blueprint, research, universe, visualIdentity)
```

**Code Sesudah (Proposed/After)**

```js
generateScript(episode, blueprint, research, universe, visualIdentity, resolvedNarrative)
```

### 12.5 `lib/youtube-studio-narration-profiles.js`

**Code Sebelum (Current/Before)**

```js
calculateNarrationBudget({ targetSeconds, profile })
```

**Code Sesudah (Proposed/After)**

```js
calculateAudioBlockBudget({ block, speakerVoiceProfile, pauses })
calculateMultiSpeakerSceneBudget({ blocks, cast, targetSeconds })
```

### 12.6 `lib/youtube-studio-repository.js` — script approval/auto-fit section

**Code Sebelum (Current/Before)**

```js
// Auto-fit only rewrites scene.voiceover.
```

**Code Sesudah (Proposed/After)**

```js
// Auto-fit creates v2 script version and preserves speaker knowledge/subtext ownership.
```

### 12.7 `app/youtube-studio/components/EpisodeWorkspace.js` — Script section

**Code Sebelum (Current/Before)**

```jsx
<p>{scene.voiceover}</p>
```

**Code Sesudah (Proposed/After)**

```jsx
<AudioBlockList blocks={scene.audio_blocks} speakers={script.speaker_manifest} />
```

### 12.8 `lib/youtube-studio-kb-contract.js`

**Code Sebelum (Current/Before)**

```js
// Existing KB schemas have general tone/voice/character fields.
```

**Code Sesudah (Proposed/After)**

```js
// Validate optional narrative defaults, dialogue rules, casting, and shot grammar additions.
```

### 12.9 `lib/youtube-studio-kb-ai.js`

**Code Sebelum (Current/Before)**

```js
// KB AI templates do not request structured multi-speaker guidance.
```

**Code Sesudah (Proposed/After)**

```js
// Channel/Series/Editorial/Voice/Visual KB generation includes multi-speaker fields.
```

### 12.10 Existing KB Markdown files

Files:

- `kb/youtube-studio/channel-profile.md`
- `kb/youtube-studio/series-content-guide.md`
- `kb/youtube-studio/longform-editorial-playbook.md`
- `kb/youtube-studio/voice-audio-guide.md`
- `kb/youtube-studio/visual-continuity-guide.md`

**Code Sebelum (Current/Before)**

```md
General narrative, voice, and character guidance.
```

**Code Sesudah (Proposed/After)**

```md
Add narrative mode, dialogue purpose, recurring cast, speaker casting,
knowledge ownership, reaction-shot grammar, and no-lip-sync rules.
```

Keep existing bilingual convention and do not create a ninth KB type.

## 13. Planned File Changes — Stage C

### 13.1 `lib/youtube-studio-tts-capabilities.js` — new

**Code Sebelum (Current/Before)**

```js
// No provider capability registry.
```

**Code Sesudah (Proposed/After)**

```js
export function getTtsProviderCapabilities({ provider, model, locale }) {}
export function resolveSynthesisStrategy({ requested, speakers, capabilities }) {}
```

### 13.2 `lib/youtube-studio-voice-adapter.js`

**Code Sebelum (Current/Before)**

```js
generateVoiceSegment({ text, provider, persona, outputPath })
```

**Code Sesudah (Proposed/After)**

```js
generateAudioBlock({ block, speaker, casting, providerSnapshot, outputPath })
generateNativeTwoSpeakerGroup({ blocks, speakers, providerSnapshot, outputPath })
```

### 13.3 `lib/minimax-tts.js`

**Code Sebelum (Current/Before)**

```js
generateMinimaxVO(text, voicePersona, outputPath, config)
```

**Code Sesudah (Proposed/After)**

```js
// Preserve single-speaker API; expose sanitized request metadata and capability-safe options.
// One dialogue block remains one MiniMax request.
```

Do not add undocumented native multi-speaker payload.

### 13.4 `lib/gemini.js`

**Code Sebelum (Current/Before)**

```js
callGeminiTtsApi(text, voicePersona, config) // single voiceConfig
```

**Code Sesudah (Proposed/After)**

```js
callGeminiTtsApi(...) // backward compatible single speaker
callGeminiMultiSpeakerTtsApi({ transcript, speakerVoices, direction })
```

Native function remains unused unless Stage E feature flag/capability enables it.

### 13.5 `lib/youtube-studio-production-repository.js`

**Code Sebelum (Current/Before)**

```js
// One voiceover production asset per scene using scene.voiceover.
```

**Code Sesudah (Proposed/After)**

```js
// One audio asset/job per audio_block_id with speaker/casting/provider snapshot.
```

### 13.6 `lib/youtube-studio-production-worker.js`

**Code Sebelum (Current/Before)**

```js
const voiceProvider = episode.voice_provider;
const voicePersona = episode.voice_persona;
generateVoiceSegment({ text: asset.prompt_snapshot, ... });
```

**Code Sesudah (Proposed/After)**

```js
const casting = resolveAssetCasting(asset, packageSnapshot);
await generateAudioBlock({ block, speaker, casting, providerSnapshot, outputPath });
await normalizeAndProbeAudio(outputPath);
await recomputeSceneAudioState(asset.production_package_id, asset.scene_index);
```

### 13.7 `lib/youtube-studio-audio-assembly.js` — new

**Code Sebelum (Current/Before)**

```js
// No dedicated ordered multi-speaker scene audio assembler.
```

**Code Sesudah (Proposed/After)**

```js
export async function assembleSceneDialogueTrack({ blocks, assets, pauses, mixRules }) {}
```

Use safe process execution APIs; do not interpolate untrusted text/path into shell strings.

### 13.8 `app/api/v2/youtube-studio/episodes/[id]/voice-production/route.js` — new

**Code Sebelum (Current/Before)**

```js
// Existing hybrid endpoint exposes batch actions but no audio-block read model.
```

**Code Sesudah (Proposed/After)**

```js
// GET speaker/block/batch state; POST explicit generate/retry/approve actions.
```

### 13.9 `app/api/v2/youtube-studio/production-assets/[id]/regenerate/route.js`

**Code Sebelum (Current/Before)**

```js
// Generic asset regeneration.
```

**Code Sesudah (Proposed/After)**

```js
// Audio-block-aware selective regeneration and dependency invalidation.
```

### 13.10 `app/youtube-studio/components/EpisodeWorkspace.js` — Voice section

**Code Sebelum (Current/Before)**

```jsx
// One episode provider/persona and one scene voice asset card.
```

**Code Sesudah (Proposed/After)**

```jsx
<VoiceCastPanel />
<AudioBlockReviewList />
<SceneDialoguePreview />
```

### 13.11 `lib/youtube-studio-render-adapter.js`

**Code Sebelum (Current/Before)**

```js
// Scene voiceover text / one voice track assumption.
```

**Code Sesudah (Proposed/After)**

```js
// Use approved scene audio mix + actual block timings + speaker subtitle cues.
```

## 14. Planned File Changes — Stage D

### 14.1 `lib/youtube-studio-production-planner.js`

**Code Sebelum (Current/Before)**

```js
// Converts scene.voiceover into generic visual shots.
```

**Code Sesudah (Proposed/After)**

```js
// Maps audio_blocks to visual_beats with speaker_focus/listener/on_screen_characters.
```

### 14.2 `lib/youtube-studio-hybrid-planner.js`

**Code Sebelum (Current/Before)**

```js
"voiceover": "naskah narasi scene"
```

**Code Sesudah (Proposed/After)**

```js
"audio_block_ids": ["sc01_ab01"],
"speaker_focus": "character_a",
"listener_focus": "character_b",
"on_screen_characters": ["character_a"],
"lip_sync_requested": false
```

### 14.3 `lib/youtube-studio-contract.js` — production validation

**Code Sebelum (Current/Before)**

```js
// Validates shots against narrative_duration_seconds.
```

**Code Sesudah (Proposed/After)**

```js
// Also validates visual beat coverage, speaker/cast references, and lip-sync capability.
```

### 14.4 `lib/youtube-studio-start-frame-adapter.js`

**Code Sebelum (Current/Before)**

```js
// Resolves general subjects/character continuity.
```

**Code Sesudah (Proposed/After)**

```js
// Resolves speaker focus, listener reaction, present characters, emotion, and canonical prompts.
```

### 14.5 `lib/youtube-studio-visual-adapter.js`

**Code Sebelum (Current/Before)**

```js
generateVisualShot({ asset, profile })
```

**Code Sesudah (Proposed/After)**

```js
generateVisualShot({ asset, profile, visualBeat, characterSnapshot, lipSyncCapability })
```

### 14.6 `lib/youtube-studio-render-adapter.js` — preview/final section

**Code Sebelum (Current/Before)**

```js
// Assembly uses scene-level voiceover assumptions.
```

**Code Sesudah (Proposed/After)**

```js
// Assembly consumes approved scene mix, block timings, visual beat ranges, subtitles, music, SFX.
```

### 14.7 `app/youtube-studio/components/EpisodeWorkspace.js` — Production section

**Code Sebelum (Current/Before)**

```jsx
// Shows VO/visual assets without speaker-aware visual beat lineage.
```

**Code Sesudah (Proposed/After)**

```jsx
<VisualBeatTimeline />
<SpeakerFocusBadge />
<DialogueCoverageWarnings />
```

## 15. Planned File Changes — Stage E

### 15.1 `lib/youtube-studio-google-multispeaker-adapter.js` — new

**Code Sebelum (Current/Before)**

```js
// No native Google two-speaker dialogue adapter.
```

**Code Sesudah (Proposed/After)**

```js
export async function generateTwoSpeakerDialogue({ blocks, castings, direction, outputPath }) {}
```

Exactly two aliases/voices; validate input limits and fall back safely.

### 15.2 `lib/youtube-studio-dubbing.js` — new

**Code Sebelum (Current/Before)**

```js
// No locale-specific dubbing layer.
```

**Code Sesudah (Proposed/After)**

```js
export function createDubbingDraft({ sourceScript, targetLocale, terminology, castings }) {}
```

Foundation only unless feature flag and quality workflow are explicitly enabled.

### 15.3 `lib/youtube-studio-lipsync-adapter.js` — new

**Code Sebelum (Current/Before)**

```js
// No lip-sync capability interface.
```

**Code Sesudah (Proposed/After)**

```js
export function getLipSyncCapability() { return { available: false, reason: 'provider_not_configured' }; }
export async function generateLipSync(input) { /* only when verified provider exists */ }
```

### 15.4 `app/api/v2/youtube-studio/episodes/[id]/advanced-audio/route.js` — new

**Code Sebelum (Current/Before)**

```js
// No capability read model for native dialogue/dubbing/lip-sync.
```

**Code Sesudah (Proposed/After)**

```js
// GET capabilities; POST only explicit feature-gated actions.
```

### 15.5 `app/youtube-studio/components/EpisodeWorkspace.js` — Advanced section

**Code Sebelum (Current/Before)**

```jsx
// No advanced capability status.
```

**Code Sesudah (Proposed/After)**

```jsx
<AdvancedNarrativeCapabilities
  googleNativeDialogue={capabilities.googleNativeDialogue}
  dubbing={capabilities.dubbing}
  lipSync={capabilities.lipSync}
/>
```

Unavailable capabilities must be visibly unavailable, not silently simulated.

## 16. Planned Tests

### New focused test files

- `tests/youtube-studio-narrative-resolver.test.js`
- `tests/youtube-studio-multispeaker-contract.test.js`
- `tests/youtube-studio-multispeaker-planner.test.js`
- `tests/youtube-studio-tts-capabilities.test.js`
- `tests/youtube-studio-multispeaker-audio.test.js`
- `tests/youtube-studio-speaker-visual-plan.test.js`
- `tests/youtube-studio-advanced-narrative.test.js`

**Code Sebelum (Current/Before)**

```js
// No complete A–E multi-speaker regression suite.
```

**Code Sesudah (Proposed/After)**

```js
// Pure contract tests + mocked provider/worker/render integration tests.
// No real MiniMax/Google/G-Labs paid request in automated tests.
```

### Required regression coverage

- existing narration-only episode;
- script v1 normalization;
- existing single-voice MiniMax;
- existing single-voice Google;
- Fase 3 production approval/orchestration;
- tenant isolation;
- duplicate approval/job idempotency;
- selective invalidation;
- multilingual locale validation.

## 17. API & Security Requirements

- All routes use existing YouTube Studio permission gates.
- All queries include tenant scope.
- IDs from Channel/Series/Episode/Universe are validated as belonging to the same tenant/context.
- Do not accept provider/model capability claims from client.
- Do not log API keys, auth cookies, raw private KB snapshots, or full sensitive transcripts.
- Provider payload errors returned to UI must be sanitized but retain trace/correlation ID.
- File paths and FFmpeg inputs are server-resolved and validated.
- No shell interpolation with user-controlled text or unresolved path.
- All provider actions require explicit eligible workflow action; opening/reviewing a page never generates paid media.

## 18. UI & CSS Requirements

- Preserve the one-column vertical Episode Workspace.
- Use semantic components and CSS Module classes.
- Use `app/theme.css` variables only for visual colors/surfaces/borders/status.
- No new hard-coded hex/rgb/rgba/color-mix or inline visual styling.
- Inherited values show their source: Channel, Series, or Episode.
- Status messages reflect actual server state.
- Speaker identity must not rely on color alone; include name/role/icon/text.
- Keyboard navigation and ARIA labels/live status are required.
- Long speaker lists and audio blocks require collapsible chapter/scene grouping, not horizontal dashboards.

## 19. Verification Strategy

### Automated

```bash
node --test tests/youtube-studio-narrative-resolver.test.js
node --test tests/youtube-studio-multispeaker-contract.test.js
node --test tests/youtube-studio-multispeaker-planner.test.js
node --test tests/youtube-studio-tts-capabilities.test.js
node --test tests/youtube-studio-multispeaker-audio.test.js
node --test tests/youtube-studio-speaker-visual-plan.test.js
node --test tests/youtube-studio-advanced-narrative.test.js
npm run build
```

Use project-native commands if test organization changes; document exact evidence in this plan.

### Dev smoke sequence

```text
Create controlled short episode
→ resolve hybrid narrative setup
→ Research
→ Blueprint with dialogue beat
→ Script v2 with narrator + 2 characters
→ approve script
→ generate TTS blocks only after explicit approval
→ review scene mix/subtitles
→ approve VO
→ generate minimal visual batch only after explicit approval
→ assemble preview
→ stop before final render/publish unless explicitly authorized
```

Smoke evidence must report IDs/counts/statuses, never credentials or raw full prompts/transcripts.

## 20. Deployment & Release

Only allowed deployment:

```bash
npm run deploy:macmini-dev
```

Do not run staging/production deployment commands. Do not poll SSH repeatedly during remote build.

After all Stage A–E implementation within available capability scope, regression tests, build, Dev deployment, and smoke verification are complete:

```bash
npm run release-non-interactive -- --type minor --title "YouTube Studio Multi-Speaker Narrative" --points "Add Channel Series Episode narrative inheritance and multi-speaker scripts|Add MiniMax and Google provider-aware dialogue audio production|Add speaker-aware visual planning and advanced capability gates"
```

If lip-sync provider is unavailable, Stage E is considered complete only for the honest capability interface/gate—not for actual lip-sync generation. Document this explicitly in the release report.

## 21. Definition of Done

1. User configures defaults at Channel, format/cast at Series, override/cast at Episode.
2. Resolver produces deterministic immutable snapshot with provenance.
3. Research/Blueprint/Script produce consistent multi-speaker structure.
4. Script v1 narration-only remains supported.
5. MiniMax and Google segmented turns work through provider mocks and controlled Dev verification.
6. Each speaker/block is independently reviewable and regenerable.
7. Scene mix and subtitle timing use actual audio artifacts.
8. Visual plan knows speaker/listener/on-screen characters and avoids false lip-sync.
9. Preview assembly supports approved multi-speaker episode.
10. Google native two-speaker path is optional and safely falls back.
11. Dubbing/lip-sync capabilities are feature-gated and honest.
12. Tests/build pass, Dev-only deployment succeeds, checklist/evidence are current, and release SOP completes.
