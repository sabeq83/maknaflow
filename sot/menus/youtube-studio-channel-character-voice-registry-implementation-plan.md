# Implementation Plan — YouTube Studio Channel Character & Voice Registry

> Status: Planned  
> Scope: memperbaiki konsistensi multi-speaker dengan memusatkan karakter, voice identity, dan pilihan metode produksi audio pada Channel  
> Delivery target: **Mac Mini Dev only** (`~/maknaflow-dev`, UI `5020`, API `7020`, schema `dev`)  
> Production deployment: **dilarang** tanpa instruksi manual eksplisit  
> Related baseline: `sot/menus/youtube-studio-multi-speaker-narrative-implementation-plan.md`

## 1. Objective

Mengganti konfigurasi voice tunggal pada Episode dan cast bebas pada Series/Episode menjadi registry yang konsisten dengan dua metode produksi audio:

```text
Channel Audio Production Mode + Character & Voice Registry (source of truth)
→ Series memilih recurring cast
→ Episode memilih episode cast
→ AI hanya memakai allowed speaker IDs
→ approved Script menyimpan casting snapshot
→ Production bercabang ke Standalone TTS atau Native Scene Audio
→ Production memakai snapshot, bukan live Channel settings
```

Channel menyediakan dua pilihan mutually exclusive:

```text
Option 1 — Standalone Voice Track / standalone_tts
Script audio blocks → MiniMax atau Google TTS → voice review → visual → assembly

Option 2 — Native Scene Audio / native_scene_audio
Script audio blocks → audio-aware I2V prompt → Google Flow via G-Labs
→ video dengan embedded narration/dialogue/ambience → audiovisual review → assembly
```

Audio Production Mode menjawab **siapa yang menghasilkan audio**. Format pengalaman audio disimpan sebagai dimensi terpisah:

```text
Audio Experience Profile
├── narrative_dialogue
├── spoken_asmr
├── no_talking_asmr
└── mixed_asmr
```

ASMR bukan production mode ketiga. Native Scene Audio adalah mode yang direkomendasikan untuk ASMR karena spoken whisper, trigger sounds, ambience, dan visual dibuat dalam satu clip. Standalone TTS tetap dapat dipakai untuk `spoken_asmr` hanya jika provider/casting mendukung whisper; trigger sounds tidak boleh dianggap dihasilkan oleh TTS.

Konfigurasi tidak lagi dilakukan pada Episode:

- **Audio Production Mode** ditetapkan pada Channel.
- Untuk `standalone_tts`, **TTS provider** ditetapkan pada Channel dan TTS persona ditetapkan per karakter/narrator.
- Untuk `native_scene_audio`, TTS engine dinonaktifkan dan Google Flow/G-Labs menghasilkan spoken audio bersama video.
- Setiap karakter tetap wajib memiliki **provider-neutral Voice Identity Profile**.
- Setiap karakter mempunyai binding teknis terpisah untuk TTS dan Google Flow.
- Series dan Episode hanya memilih karakter; keduanya tidak boleh membuat persona atau speaker baru.

## 2. Product Decisions Locked

1. Channel adalah authoritative source untuk karakter, narrator, dan voice casting.
2. `speaker_id` stabil, unik per tenant + channel, tidak dapat diganti setelah dipakai.
3. Jumlah karakter dihitung dari registry aktif; tidak disimpan sebagai counter terpisah.
4. Channel mempunyai satu active Audio Production configuration per locale dengan mode `standalone_tts` atau `native_scene_audio`.
5. Kedua mode mutually exclusive untuk spoken audio dalam satu Production Package; native audio tidak boleh menghasilkan standalone TTS job.
6. Setiap speaker mempunyai provider-neutral Voice Identity Profile sebagai identitas suara lintas engine.
7. `standalone_tts` memakai binding persona MiniMax atau Google TTS per karakter + locale.
8. `native_scene_audio` memakai Google Flow voice reference/ingredient bila G-Labs mendukungnya; jika hanya descriptive voice prompt yang tersedia, mode ditandai `experimental_prompt_guided`.
9. Nama persona Google TTS seperti `Orus`/`Kore` tidak boleh diasumsikan sebagai Google Flow voice reference.
10. Perubahan mode/provider memerlukan seluruh binding yang diwajibkan mode baru selesai sebelum konfigurasi dapat diaktifkan.
11. Narrator adalah entry eksplisit bertipe `narrator`, bukan speaker yang otomatis diciptakan resolver.
12. Series hanya dapat memilih subset karakter aktif dari Channel.
13. Episode hanya dapat memilih subset yang diizinkan Series. Tidak ada free-text `speaker_id`.
14. AI tidak boleh menciptakan karakter, narrator, guest, crowd speaker, atau alias baru.
15. Unknown speaker menyebabkan artifact ditolak dengan error terstruktur; tidak ada hash/default persona fallback.
16. Approved artifact dan Production Package menyimpan immutable audio-mode + casting snapshot.
17. Perubahan Channel mode/casting hanya berlaku untuk generation/approval berikutnya; produksi yang sudah memiliki snapshot tetap reproducible.
18. Karakter yang pernah digunakan tidak dihapus permanen; statusnya menjadi `retired`.
19. Universe character binding opsional untuk narrator, tetapi wajib untuk karakter visual yang muncul di scene.
20. Script/audio blocks tetap source of truth untuk kata-kata yang diucapkan dalam kedua mode.
21. Episode lama tetap dapat berjalan melalui compatibility adapter sampai dimigrasikan.
22. Audio Experience Profile terpisah dari Audio Production Mode dan disimpan pada Channel per locale/profile version.
23. `no_talking_asmr` tidak mewajibkan narrator/voice persona aktif dan melarang spoken blocks.
24. `spoken_asmr` mewajibkan minimal satu speaker dengan whisper-capable Voice Identity.
25. `mixed_asmr` mewajibkan minimal satu spoken/whisper block dan satu sound-event block.
26. Silence, breath, ambience, dan sound event adalah first-class audio blocks; AI tidak boleh mengisi silence secara otomatis.
27. Channel ASMR mempunyai Sonic Identity sebagai source of truth untuk microphone perspective, spatial behavior, trigger palette, forbidden sounds, noise floor, dan mastering defaults.

## 3. Configuration Ownership

| Scope | Boleh mengatur | Tidak boleh mengatur |
|---|---|---|
| Channel | audio production mode, Audio Experience, Sonic Identity, TTS/Flow model config, registry karakter, Voice Identity, provider bindings, pronunciation, AI character policy | — |
| Series | memilih recurring cast, role, relationship, narrator usage | membuat speaker/persona/provider baru |
| Episode | memilih cast episode dan episode role/objective | membuat speaker, memilih provider, mengubah persona |
| Script AI | memilih speaker dari allowed roster | menciptakan speaker/alias baru |
| Production | membaca immutable audio/casting snapshot dan mengikuti branch yang dipilih | mencampur dua spoken-audio mode atau membaca live voice settings untuk package approved |

## 4. Target Data Model

Gunakan tabel relasional; jangan menaruh registry operasional yang kaya di `youtube_channel_strategies.config_json`.

### 4.1 `youtube_channel_audio_configs`

```sql
CREATE TABLE youtube_channel_audio_configs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  channel_id TEXT NOT NULL REFERENCES youtube_channels(id) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  audio_production_mode TEXT NOT NULL CHECK (audio_production_mode IN ('standalone_tts', 'native_scene_audio')),
  audio_experience TEXT NOT NULL DEFAULT 'narrative_dialogue' CHECK (audio_experience IN ('narrative_dialogue', 'spoken_asmr', 'no_talking_asmr', 'mixed_asmr')),
  provider TEXT NOT NULL CHECK (provider IN ('minimax', 'google_tts', 'glabs_google_flow')),
  model_key TEXT,
  synthesis_strategy TEXT NOT NULL DEFAULT 'segmented_turns',
  native_voice_capability TEXT CHECK (native_voice_capability IN ('voice_reference', 'descriptive_prompt', 'unavailable')),
  sonic_identity_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'superseded')),
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  activated_by TEXT,
  activated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, channel_id, locale, version)
);
```

Hanya satu versi `active` per channel + locale melalui partial unique index. Constraint/service validation wajib memastikan:

```text
standalone_tts → provider minimax/google_tts
native_scene_audio → provider glabs_google_flow
```

Mode/experience validation matrix:

| Audio experience | Standalone TTS | Native Scene Audio | Voice binding | Sound events |
|---|---:|---:|---:|---:|
| `narrative_dialogue` | supported | supported | required when spoken | optional |
| `spoken_asmr` | conditional/limited | recommended | required, whisper-capable | optional |
| `no_talking_asmr` | invalid | required | not required | required |
| `mixed_asmr` | invalid for full production | required | required, whisper-capable | required |

`standalone_tts + spoken_asmr` hanya dapat diaktifkan bila TTS capability registry menyatakan whisper/delivery control tersedia. Jika tidak, activation ditolak atau user diarahkan ke Native Scene Audio.

### 4.2 `youtube_channel_speakers`

```sql
CREATE TABLE youtube_channel_speakers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  channel_id TEXT NOT NULL REFERENCES youtube_channels(id) ON DELETE CASCADE,
  speaker_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  speaker_type TEXT NOT NULL CHECK (speaker_type IN ('narrator', 'character')),
  universe_character_id TEXT,
  description TEXT,
  voice_identity_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, channel_id, speaker_id)
);
```

### 4.3 `youtube_speaker_voice_castings`

```sql
CREATE TABLE youtube_speaker_voice_castings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  channel_speaker_id TEXT NOT NULL REFERENCES youtube_channel_speakers(id) ON DELETE RESTRICT,
  locale TEXT NOT NULL,
  binding_kind TEXT NOT NULL CHECK (binding_kind IN ('tts', 'flow_native')),
  provider TEXT NOT NULL CHECK (provider IN ('minimax', 'google_tts', 'glabs_google_flow')),
  persona_key TEXT,
  voice_reference_id TEXT,
  descriptive_voice_prompt TEXT,
  speed REAL NOT NULL DEFAULT 1.0,
  delivery_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  pronunciation_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, channel_speaker_id, locale, binding_kind, provider, version)
);
```

Validation binding:

- TTS binding membutuhkan `persona_key` yang valid untuk provider + locale.
- Flow native binding mengutamakan `voice_reference_id`.
- `descriptive_voice_prompt` wajib tersedia sebagai fallback, tetapi tidak boleh dipresentasikan sebagai deterministic voice lock.
- `voice_reference_id` hanya dianggap didukung setelah G-Labs capability probe membuktikan payload reference/ingredient dapat dikirim ke model yang dipilih.

### 4.4 Cast bindings

```sql
CREATE TABLE youtube_series_cast_bindings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  series_id TEXT NOT NULL REFERENCES youtube_series(id) ON DELETE CASCADE,
  channel_speaker_id TEXT NOT NULL REFERENCES youtube_channel_speakers(id) ON DELETE RESTRICT,
  recurring_role TEXT,
  relationship_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  UNIQUE (tenant_id, series_id, channel_speaker_id)
);

CREATE TABLE youtube_episode_cast_bindings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  episode_id TEXT NOT NULL REFERENCES youtube_episodes(id) ON DELETE CASCADE,
  channel_speaker_id TEXT NOT NULL REFERENCES youtube_channel_speakers(id) ON DELETE RESTRICT,
  episode_role TEXT,
  objective TEXT,
  UNIQUE (tenant_id, episode_id, channel_speaker_id)
);
```

### 4.5 Snapshot contract

```json
{
  "schema_version": 1,
  "channel_id": "channel-id",
  "locale": "id-ID",
  "audio_config": {
    "config_id": "audio-config-id",
    "version": 2,
    "audio_production_mode": "native_scene_audio",
    "provider": "glabs_google_flow",
    "model_key": "google_flow_omni_flash",
    "native_voice_capability": "voice_reference"
  },
  "speakers": [
    {
      "speaker_id": "arya",
      "display_name": "Arya",
      "speaker_type": "character",
      "universe_character_id": "universe-character-id",
      "voice_casting_id": "casting-id",
      "voice_casting_version": 3,
      "voice_identity": {
        "language": "id-ID",
        "accent": "neutral Indonesian",
        "timbre": "warm baritone",
        "cadence": "measured"
      },
      "tts_binding": {
        "provider": "minimax",
        "persona_key": "voice-id"
      },
      "flow_binding": {
        "voice_reference_id": "glabs-flow-voice-id",
        "descriptive_voice_prompt": "Adult Indonesian male, warm baritone..."
      },
      "speed": 1,
      "delivery": {},
      "pronunciation": {}
    }
  ],
  "resolved_at": "ISO-8601",
  "source": "channel_registry"
}
```

Snapshot tidak boleh mengandung credential/API key.

### 4.6 Sonic Identity contract

```json
{
  "schema_version": 1,
  "microphone_perspective": "extreme_close_binaural",
  "spatial_behavior": "slow_left_to_right",
  "noise_floor": "quiet_treated_studio",
  "dynamic_range": "soft_micro_dynamics",
  "pacing": "slow_with_long_pauses",
  "preferred_triggers": ["gentle tapping", "soft brushing"],
  "forbidden_sounds": ["sudden loud impact", "music", "harsh sibilance"],
  "mastering": {
    "target_loudness_lufs": -20,
    "peak_limit_db": -3,
    "preserve_micro_dynamics": true
  }
}
```

Mastering values harus divalidasi dalam safe range dan tidak boleh diterapkan sebagai hard-coded universal values untuk semua channel.

## 5. Backend Workstreams

### 5.0 Mandatory G-Labs capability audit

Sebelum mengaktifkan `native_scene_audio`, agent wajib memeriksa kontrak G-Labs aktual pada Windows Worker/API, bukan berasumsi dari kemampuan UI Google Flow.

Capability probe harus menjawab:

1. Apakah selected G-Labs model menghasilkan embedded audio?
2. Apakah payload menerima `audio_prompt` terstruktur atau hanya prompt plaintext?
3. Apakah payload menerima Google Flow voice reference/ingredient ID?
4. Model mana yang mendukung voice reference, I2V/Ingredients, durasi, dan aspect ratio yang dipakai?
5. Apakah output file benar-benar memiliki audio stream?
6. Bagaimana error audio-generation, retry, cost, dan task status dilaporkan?

Jika voice reference tidak didukung G-Labs, implementasi tetap boleh menyediakan `native_scene_audio` dengan status:

```text
experimental_prompt_guided
Voice consistency is guided, not guaranteed.
```

Jangan memalsukan `voice_reference` atau mengubah nama Google TTS persona menjadi Flow reference.

### 5.1 Provider capability registry

Buat server-side capability registry untuk:

- audio mode + provider/model allowlist;
- persona/voice allowlist atau provider-backed validation;
- locale support;
- model dan synthesis strategy;
- speed range;
- optional preview/test-voice capability;
- native embedded-audio, voice-reference/ingredients, I2V, and clip-duration capability.
- whisper/delivery capability for TTS providers;
- ASMR native-audio, stereo/spatial, and sound-event capability flags where the adapter can verify them.

Provider tidak boleh ditentukan hanya dari nilai dropdown client.

### 5.2 Registry service and repository

Sediakan operasi tenant-scoped:

- list/create/update/retire Channel speaker;
- create draft Channel audio configuration;
- set casting per speaker + locale;
- validate completeness;
- activate audio configuration secara transaksional setelah mode-specific completeness gate;
- list eligible Series/Episode cast;
- build immutable casting snapshot;
- migration report untuk legacy Episode/Series cast.

Activation harus gagal jika ada active cast tanpa binding valid untuk locale dan mode aktif.

### 5.3 Resolver

Resolver baru:

```text
Episode locale
→ active Channel Audio config
→ Channel registry
→ Series binding subset
→ Episode binding subset
→ validate voice completeness
→ resolved narrative + casting snapshot
```

Hapus:

- narrator auto-create;
- persona hash fallback;
- episode `voice_provider`, `voice_persona`, `voice_speed` sebagai source untuk episode baru.

Resolver menghasilkan `audio_production_mode`, provider capability snapshot, dan binding yang relevan. Binding mode lain boleh tersimpan di registry tetapi tidak dipakai oleh package aktif.

Resolver juga menghasilkan `audio_experience` dan immutable `sonic_identity_snapshot`. Untuk `no_talking_asmr`, resolver tidak boleh menyuntik narrator. Untuk experience yang membutuhkan spoken audio, speaker completeness tetap fail-closed.

### 5.4 AI contract enforcement

Validator harus memastikan:

1. `speaker_manifest[].speaker_id` unik dan merupakan subset `allowed_speaker_ids`.
2. Setiap `audio_blocks[].speaker_id` ada dalam manifest dan registry snapshot.
3. Blueprint dialogue speaker, `present_characters`, `speaker_focus`, listener/reaction reference semuanya valid.
4. AI output tidak boleh memperkenalkan alias yang diperlakukan sebagai speaker baru.
5. Unknown speaker menghasilkan `YT_UNKNOWN_SPEAKER` dan satu bounded regeneration attempt; setelah itu fail dengan hasil yang dapat diperbaiki user.

ASMR-specific validation:

- `no_talking_asmr`: hanya `sound_event`, `ambience`, `breath` non-verbal, dan `silence`; `narration`, `dialogue`, dan `whisper` ditolak.
- `spoken_asmr`: minimal satu `whisper` block dan speaker valid dengan whisper-capable identity/binding.
- `mixed_asmr`: minimal satu spoken/whisper block dan satu `sound_event` block.
- `silence` merupakan intentional block dengan duration; planner dilarang mengisinya dengan dialog/SFX tambahan.
- sound event harus menggunakan allowlisted semantic fields dan tidak boleh memperkenalkan sumber suara yang bertentangan dengan `forbidden_sounds`.

Prompt harus membangun contoh dari roster aktual. Hapus contoh nama karakter hard-coded seperti `detective_arya`.

### 5.5 Production snapshot and branch orchestration

Pada Script approval atau paling lambat saat Production Package dibuat:

- simpan audio-mode + casting snapshot ke artifact/package context;
- `standalone_tts`: buat voice asset dari `audio_block_id + script_version + casting_version`;
- `standalone_tts`: worker mengambil TTS provider/persona/speed dari snapshot;
- `native_scene_audio`: jangan membuat TTS/voiceover batch atau standalone voice asset;
- `native_scene_audio`: compile setiap scene/shot menjadi audio-aware I2V payload dan pertahankan embedded audio output;
- regenerate satu block tetap memakai snapshot package yang sama;
- perubahan Channel mode/voice tidak mengubah package yang sudah disetujui.

### 5.6 Audio-aware prompt contract

Jangan hanya menempelkan voice persona ke paragraf I2V. Simpan contract terstruktur:

```json
{
  "visual_prompt": "...",
  "motion_prompt": "...",
  "audio_prompt": {
    "spoken_language": "id-ID",
    "dialogue": [
      {
        "audio_block_id": "sc01_ab01",
        "speaker_id": "arya",
        "voice_reference_id": "voice_arya",
        "descriptive_voice_prompt": "Adult Indonesian male, warm baritone...",
        "text": "Kita tidak punya banyak waktu.",
        "delivery": "quiet, urgent"
      }
    ],
    "ambience": "quiet room tone with distant rain",
    "sound_effects": ["soft footsteps"],
    "music": "none"
  }
}
```

Audio block types yang wajib didukung:

```js
export const AUDIO_BLOCK_TYPES = [
  'narration',
  'dialogue',
  'whisper',
  'breath',
  'sound_event',
  'ambience',
  'silence'
];
```

Contoh ASMR timeline:

```json
{
  "audio_experience": "mixed_asmr",
  "audio_blocks": [
    {
      "block_id": "sc01_ab01",
      "type": "sound_event",
      "source": "soft_brush",
      "action": "brushes the microphone slowly",
      "intensity": "very_soft",
      "spatial_position": "left_to_right",
      "duration_seconds": 4,
      "continuity_key": "brush_texture_01"
    },
    {
      "block_id": "sc01_ab02",
      "type": "whisper",
      "speaker_id": "asmr_host",
      "text": "Sekarang, tarik napas perlahan.",
      "delivery": "extreme close-mic gentle whisper",
      "duration_seconds": 4
    },
    {
      "block_id": "sc01_ab03",
      "type": "silence",
      "duration_seconds": 2,
      "intent": "rest_and_anticipation"
    }
  ]
}
```

Adapter G-Labs mengompilasi contract ini ke payload aktual. Spoken text harus identik dengan approved Script audio block. Planner wajib memastikan dialog/narasi muat dalam 4/6/8/10 detik sesuai capability profile.

Untuk ASMR, Flow Prompt Compiler wajib menghasilkan natural-language prompt dengan bagian eksplisit untuk microphone perspective, spatial movement, trigger sounds, ambience, dan negative audio constraints. Contoh compiled prompt:

```text
An extreme close-up of a soft makeup brush moving slowly across a dark textured surface.
The movement is deliberate and continuous.

Audio: no talking. Intimate binaural ASMR recorded from an extreme close-microphone
perspective. Produce detailed soft brushing sounds moving gradually from the left ear
to the right ear. Preserve subtle texture and micro-dynamics. Very quiet treated studio.

No narration, no dialogue, no music, no sudden impact, no background hiss, and no
additional sound sources.
```

### 5.7 Mode-specific review and assembly

```text
standalone_tts:
Script → Start Frame → TTS Generation → Voice Review → Visual Generation → Assembly

native_scene_audio:
Script → Start Frame → Audio-aware Prompt Review → Audiovisual Generation
→ Audiovisual Review → Embedded-audio Assembly
```

Untuk native audio:

- subtitle timing diselaraskan melalui ASR/forced alignment setelah generation;
- assembly melakukan loudness normalization dan audio crossfade bila perlu;
- jangan menimpa embedded dialogue dengan silent/external TTS track;
- deteksi missing/corrupt audio stream dan block approval;
- regenerate dialog berarti regenerate audiovisual clip terkait.

## 6. API Contract

Tambahkan endpoint yang tenant-scoped dan memakai `withYouTubeStudioAccess`:

```text
GET    /api/v2/youtube-studio/channels/:id/voice-registry
POST   /api/v2/youtube-studio/channels/:id/speakers
PATCH  /api/v2/youtube-studio/channels/:id/speakers/:speakerId
POST   /api/v2/youtube-studio/channels/:id/speakers/:speakerId/retire
PUT    /api/v2/youtube-studio/channels/:id/audio-config
POST   /api/v2/youtube-studio/channels/:id/audio-config/activate
GET    /api/v2/youtube-studio/channels/:id/audio-capabilities
GET    /api/v2/youtube-studio/channels/:id/sonic-identity
PUT    /api/v2/youtube-studio/channels/:id/sonic-identity
POST   /api/v2/youtube-studio/channels/:id/voice-preview
GET    /api/v2/youtube-studio/series/:id/eligible-cast
PUT    /api/v2/youtube-studio/series/:id/cast-bindings
GET    /api/v2/youtube-studio/episodes/:id/eligible-cast
PUT    /api/v2/youtube-studio/episodes/:id/cast-bindings
```

Response error minimal:

```json
{
  "success": false,
  "error": {
    "code": "YT_AUDIO_BINDING_INCOMPLETE",
    "message": "2 active speakers have no Google Flow voice binding for id-ID.",
    "details": { "speaker_ids": ["arya", "maya"] }
  }
}
```

## 7. UI/UX Plan

### 7.1 Channel

Tambahkan bagian vertikal pada Channel Settings:

```text
Narrative Defaults
Audio Production Mode
  Standalone Voice Track | Native Scene Audio
Audio Experience Profile
  Narrative / Dialogue | Spoken ASMR | No-Talking ASMR | Mixed ASMR
Mode Configuration
  TTS provider/model OR G-Labs/Google Flow model/capability
Voice Consistency Status
  Deterministic TTS | Flow voice reference | Experimental prompt-guided
TTS Configuration (visible only for standalone_tts)
  Locale
  Provider: MiniMax | Google TTS
  Model/quality
  Synthesis strategy
Character & Voice Registry
  Narrator / character card
  Universe character binding
  Provider-neutral Voice Identity
  TTS persona bindings
  Google Flow voice reference / descriptive prompt binding
  Speed, delivery, pronunciation
  Preview voice
AI Character Policy
  Strict registry: locked ON
Sonic Identity (shown for ASMR)
  Microphone perspective
  Spatial behavior
  Trigger palette
  Forbidden sounds
  Noise floor and mastering defaults
```

Saat mode/provider diganti, tampilkan status `Draft — binding completion required`; jangan langsung mengganti konfigurasi aktif. UI harus menjelaskan konsekuensi credit/retry native audio dan tingkat konsistensi voice.

Ketika Audio Experience berubah, tampilkan compatibility/completeness preview. `No-Talking ASMR` menyembunyikan kewajiban narrator tetapi tidak menghapus registry. `Spoken/Mixed ASMR` menampilkan whisper capability dan Sonic Identity completeness.

### 7.2 Series

- hapus form free-text `display_name` dan `speaker_id`;
- recurring cast menggunakan selector dari Channel Registry;
- tampilkan Voice Identity dan active-mode binding read-only;
- karakter retired tetap terlihat pada Series lama tetapi tidak dapat dipilih baru.

### 7.3 Episode

- hapus Voice Provider, Voice Persona, dan Voice Speed dari Generation Profile;
- generation profile hanya mengatur visual generation;
- episode cast menggunakan selector dari eligible Series cast;
- tampilkan read-only Voice Cast + Audio Production Mode Summary;
- tampilkan casting snapshot pada review/production.

Gunakan CSS Module dan semantic theme tokens MAKNA Flow. Dilarang menambah warna literal/inline style untuk fitur baru.

## 8. Legacy Migration and Compatibility

Migration harus idempotent dan menghasilkan report, bukan menebak diam-diam.

1. Buat Channel Audio config `standalone_tts` dari voice episode yang paling representatif hanya sebagai **draft**.
2. Seed explicit narrator untuk channel narration-only.
3. Gabungkan recurring/episode cast berdasarkan normalized `speaker_id`.
4. Jika satu `speaker_id` memiliki persona konflik, tandai `requires_manual_resolution`.
5. Episode approved/in-production mempertahankan legacy episode voice melalui immutable `legacy_episode_voice` snapshot.
6. Episode baru tidak boleh memakai legacy fields.
7. Kolom legacy `youtube_episodes.voice_*` jangan langsung di-drop. Jadikan read-only/deprecated dan hapus hanya melalui rencana cleanup terpisah setelah telemetry aman.

## 9. Security, Integrity, and Invalidation

- semua query wajib memiliki `tenant_id` dan ownership chain channel → series → episode;
- API tidak menerima provider/persona yang tidak ada di capability registry;
- tidak ada credential dalam response, log, atau snapshot;
- retire speaker ditolak bila ada draft aktif yang sedang menggunakannya, atau memerlukan explicit impact confirmation;
- perubahan cast sebelum Research menginvalidasi Research ke bawah;
- perubahan cast setelah approval membuat revision baru, tidak memutasi artifact lama;
- perubahan Channel provider/persona tidak melakukan destructive cascade ke package approved.

## 10. Test and Acceptance Gates

### Automated tests

1. CRUD dan tenant isolation Channel registry.
2. Audio mode/provider/model/locale compatibility.
3. Mode/provider switch tidak dapat aktif sebelum seluruh required binding lengkap.
4. Series hanya dapat memilih Channel speaker aktif.
5. Episode hanya dapat memilih eligible Series speaker.
6. Unknown AI speaker ditolak pada Blueprint dan Script.
7. Narrator tidak dibuat otomatis.
8. Missing persona menyebabkan fail-closed, bukan fallback hash.
9. Approved package tidak berubah setelah Channel casting diedit.
10. Legacy narration-only episode tetap dapat diproduksi.
11. MiniMax/Google TTS mock menerima persona yang benar untuk setiap audio block.
12. Native mode tidak membuat TTS jobs dan G-Labs mock menerima audio-aware prompt yang identik dengan approved dialogue.
13. Native output tanpa audio stream ditolak pada audiovisual review.
14. Google TTS persona tidak pernah dipakai sebagai Flow reference tanpa explicit mapping.
15. Prompt-guided mode dilabeli experimental dan voice consistency tidak diklaim deterministic.
16. No-Talking ASMR menolak semua spoken blocks dan tidak mewajibkan narrator.
17. Spoken ASMR menolak activation tanpa whisper-capable speaker binding.
18. Mixed ASMR menolak artifact tanpa spoken/whisper dan sound-event blocks.
19. Silence block dipertahankan sampai prompt/production dan tidak diisi otomatis.
20. Sonic Identity masuk immutable snapshot dan compiled Flow prompt.
21. Assembly ASMR mempertahankan micro-dynamics dan mengikuti mastering snapshot.
22. API authorization dan cross-tenant access ditolak.

### UI acceptance

1. Audio Production Mode dan provider hanya dapat diedit di Channel.
2. TTS persona dan Flow voice binding hanya dapat diedit per karakter di Channel.
3. Episode tidak lagi menampilkan voice editor tunggal.
4. Series/Episode tidak menerima free-text speaker ID.
5. Mode/provider change menunjukkan binding completeness dan capability status.
6. Voice preview tidak menyimpan credential dan menampilkan error provider dengan aman.
7. UI menggunakan satu kolom vertikal, responsive, dan semantic theme CSS.
8. Audio Experience menyediakan Narrative/Dialogue, Spoken ASMR, No-Talking ASMR, dan Mixed ASMR.
9. Sonic Identity hanya menampilkan field relevan dan compatibility status yang jelas.

### API smoke flow on Mac Mini Dev

```text
authenticate
→ create/select channel
→ create draft Audio config: standalone_tts
→ add narrator + 2 characters
→ assign 3 personas
→ activate config
→ bind recurring cast to series
→ bind subset to episode
→ generate Research → Blueprint → Script
→ assert all speaker IDs are registered
→ approve script/start production
→ assert voice jobs use snapshot personas
→ change live Channel persona
→ regenerate one old audio block
→ assert old package still uses old snapshot
→ create/activate native_scene_audio config
→ assert standalone TTS jobs are disabled
→ generate one audio-aware I2V clip through G-Labs
→ assert output contains an audio stream and registered voices only
→ activate no_talking_asmr
→ generate sound-event + silence timeline without narrator
→ assert compiled prompt contains Sonic Identity and negative audio constraints
→ activate mixed_asmr
→ assert whisper voice binding and sound-event completeness
```

## 11. Files and Before/After Code Snippets

Agent wajib memverifikasi ulang lokasi aktual sebelum mengedit. Jika struktur kode berubah, update bagian ini dan `Execution Task List` terlebih dahulu.

### 11.1 `lib/db-pg.js`

**Code Sebelum (Current/Before)**

```js
ALTER TABLE youtube_episodes
  ADD COLUMN IF NOT EXISTS voice_provider TEXT DEFAULT 'google_tts',
  ADD COLUMN IF NOT EXISTS voice_persona TEXT DEFAULT 'Orus';
```

**Code Sesudah (Proposed/After)**

```js
CREATE TABLE IF NOT EXISTS youtube_channel_audio_configs (...);
CREATE TABLE IF NOT EXISTS youtube_channel_speakers (...);
CREATE TABLE IF NOT EXISTS youtube_speaker_voice_castings (...);
CREATE TABLE IF NOT EXISTS youtube_series_cast_bindings (...);
CREATE TABLE IF NOT EXISTS youtube_episode_cast_bindings (...);
// youtube_episodes.voice_* remains legacy-only during compatibility window.
```

### 11.2 `lib/youtube-studio-character-voice-contract.js` (new)

**Code Sebelum (Current/Before)**

```js
// File does not exist.
```

**Code Sesudah (Proposed/After)**

```js
export function validateChannelAudioConfig(input, capabilities) { /* mode-aware, fail closed */ }
export function validateSpeakerInput(input) { /* stable speaker ID */ }
export function validateVoiceBinding(input, audioConfig, capabilities) { /* TTS or Flow */ }
export function validateAllowedSpeakers(artifact, allowedSpeakerIds) { /* strict subset */ }
export function validateAudioExperience(input, capabilities) { /* ASMR matrix */ }
export function validateSonicIdentity(input) { /* semantic and mastering ranges */ }
```

### 11.3 `lib/youtube-studio-tts-capabilities.js` (new if still absent)

**Code Sebelum (Current/Before)**

```js
// No centralized YouTube Studio TTS capability registry.
```

**Code Sesudah (Proposed/After)**

```js
export function getTtsCapabilities(provider) { /* server-side contract */ }
export function validatePersonaForProvider({ provider, persona, locale }) { /* explicit result */ }
export function getNativeAudioCapabilities(profile, glabsCapabilities) { /* embedded audio/reference */ }
```

### 11.4 `lib/youtube-studio-repository.js`

**Code Sebelum (Current/Before)**

```js
SET generation_profile_key = $1,
    voice_provider = $2,
    voice_persona = $3,
    voice_speed = $4
```

**Code Sesudah (Proposed/After)**

```js
SET generation_profile_key = $1
// Voice provider/persona/speed are resolved from Channel casting.

export async function getChannelVoiceRegistry(channelId) { /* tenant scoped */ }
export async function activateChannelAudioConfig(channelId, input, actor) { /* mode-aware transaction */ }
export async function replaceSeriesCastBindings(seriesId, speakerIds, actor) { /* validate */ }
export async function replaceEpisodeCastBindings(episodeId, speakerIds, actor) { /* validate */ }
```

### 11.5 `lib/youtube-studio-narrative-resolver.js`

**Code Sebelum (Current/Before)**

```js
provider: episode.voice_provider || 'google_tts',
persona: episode.voice_persona || 'Orus'
// Non-narrator persona may be selected by speaker-id hash.
```

**Code Sesudah (Proposed/After)**

```js
const casting = await resolveChannelCasting({ channelId, locale, speakerIds });
if (casting.missing.length) throw youtubeStudioError('YT_AUDIO_BINDING_INCOMPLETE');
return {
  ...resolvedNarrative,
  audio_production_mode: casting.audioConfig.audio_production_mode,
  casting_snapshot: casting.snapshot
};
```

### 11.6 `lib/youtube-studio-contract.js`

**Code Sebelum (Current/Before)**

```js
requireString(block, 'speaker_id');
```

**Code Sesudah (Proposed/After)**

```js
requireString(block, 'speaker_id');
assertAllowedSpeaker(block.speaker_id, context.allowedSpeakerIds);
assertManifestContainsSpeaker(script.speaker_manifest, block.speaker_id);
```

### 11.7 `lib/youtube-studio-planner.js`

**Code Sebelum (Current/Before)**

```js
// Prompt says AI must not create a new speaker, but examples contain fixed names.
const parsed = validateSceneScript(result, blueprint, duration);
```

**Code Sesudah (Proposed/After)**

```js
const allowedSpeakers = castingSnapshot.speakers.map(toPromptSpeaker);
const parsed = validateSceneScript(result, blueprint, duration, {
  allowedSpeakerIds: allowedSpeakers.map(item => item.speaker_id)
});
```

### 11.8 `lib/youtube-studio-production-repository.js`

**Code Sebelum (Current/Before)**

```js
context_snapshot_json: { strategy, universe, visual_identity }
```

**Code Sesudah (Proposed/After)**

```js
context_snapshot_json: {
  strategy,
  universe,
  visual_identity,
  narrative_snapshot,
  casting_snapshot,
  audio_production_snapshot,
  sonic_identity_snapshot
}
```

### 11.9 `lib/youtube-studio-production-worker.js`

**Code Sebelum (Current/Before)**

```js
const resolved = await getResolvedNarrativeSnapshot(episode.id);
const voice = getSpeakerVoice(asset.speaker_id, resolved, episode);
```

**Code Sesudah (Proposed/After)**

```js
if (snapshot.audio_production_mode === 'standalone_tts') {
  return generateSnapshotTtsAsset(snapshot, asset);
}
return generateNativeAudiovisualAsset(snapshot, asset.audio_prompt);
```

### 11.10 Channel audio/voice API routes (new)

Files: `app/api/v2/youtube-studio/channels/[id]/voice-registry/**`, `audio-config/**`, dan `audio-capabilities/**` mengikuti route split aktual.

**Code Sebelum (Current/Before)**

```js
// Routes do not exist.
```

**Code Sesudah (Proposed/After)**

```js
export const GET = withYouTubeStudioAccess('read', getRegistryHandler);
export const PUT = withYouTubeStudioAccess('write', updateRegistryHandler);
// Focused routes implement audio mode/config, speaker bindings, capability, activation, and preview.
```

### 11.11 `app/api/v2/youtube-studio/series/[id]/narrative/route.js`

**Code Sebelum (Current/Before)**

```js
cast: config.recurring_cast || []
```

**Code Sesudah (Proposed/After)**

```js
cast_bindings: await replaceSeriesCastBindings(id, body.speaker_ids, user)
```

### 11.12 Episode story/cast API routes

Files: `app/api/v2/youtube-studio/episodes/[id]/story-setup/route.js` dan route cast baru bila dipisah.

**Code Sebelum (Current/Before)**

```js
episode_cast: body.cast
```

**Code Sesudah (Proposed/After)**

```js
episode_cast_bindings: await replaceEpisodeCastBindings(id, body.speaker_ids, user)
```

### 11.13 `app/api/v2/youtube-studio/episodes/[id]/generation-profile/route.js`

**Code Sebelum (Current/Before)**

```js
const { generation_profile_key, voice_provider, voice_persona, voice_speed } = await req.json();
```

**Code Sesudah (Proposed/After)**

```js
const { generation_profile_key } = await req.json();
// Reject voice fields for non-legacy writes.
```

### 11.14 `app/youtube-studio/components/ChannelDetailView.js`

**Code Sebelum (Current/Before)**

```jsx
<NarrativeDefaults mode={navMode} pointOfView={navPOV} dialogueRatio={navRatio} />
```

**Code Sesudah (Proposed/After)**

```jsx
<ChannelAudioProductionMode channelId={channel.id} />
<ChannelAudioExperienceProfile channelId={channel.id} />
<ChannelAudioConfiguration channelId={channel.id} />
<ChannelCharacterVoiceRegistry channelId={channel.id} />
<ChannelSonicIdentity channelId={channel.id} />
<AiCharacterPolicy strictRegistry />
```

### 11.15 New Channel components and semantic CSS

Files: component/CSS module names mengikuti struktur aktual, misalnya `ChannelVoiceRegistry.js` dan `ChannelVoiceRegistry.module.css`.

**Code Sebelum (Current/Before)**

```jsx
// Components do not exist.
```

**Code Sesudah (Proposed/After)**

```jsx
<section className={styles.registrySection}>
  <AudioModeSelector />
  <AudioExperienceSelector />
  <ModeSpecificProviderDraftForm />
  <SpeakerRegistryList />
  <SonicIdentityEditor />
</section>
```

```css
.registrySection {
  background: var(--surface-panel);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
}
```

Token aktual wajib diambil dari theme MAKNA Flow; contoh di atas bukan izin menciptakan token yang tidak ada.

### 11.16 `app/youtube-studio/components/SeriesDetailView.js`

**Code Sebelum (Current/Before)**

```jsx
<input placeholder="Speaker ID" />
<button>Add Cast Member</button>
```

**Code Sesudah (Proposed/After)**

```jsx
<ChannelCastSelector eligibleSpeakers={eligibleSpeakers} selectedIds={recurringSpeakerIds} />
<VoiceCastingSummary readOnly speakers={selectedSpeakers} />
```

### 11.17 `app/youtube-studio/components/EpisodeWorkspace.js`

**Code Sebelum (Current/Before)**

```jsx
const [voiceProvider, setVoiceProvider] = useState(episode.voice_provider || 'google_tts');
const [voicePersona, setVoicePersona] = useState(episode.voice_persona || 'Orus');
const [voiceSpeed, setVoiceSpeed] = useState(episode.voice_speed ?? 1);
```

**Code Sesudah (Proposed/After)**

```jsx
const [eligibleCast, setEligibleCast] = useState([]);
// Visual generation profile remains editable.
<EpisodeCastSelector eligibleCast={eligibleCast} />
<VoiceCastingSummary readOnly snapshot={episode.casting_snapshot} />
<AudioProductionModeSummary readOnly snapshot={episode.audio_production_snapshot} />
```

### 11.18 `app/youtube-studio/components/YouTubeStudioWorkspace.js`

**Code Sebelum (Current/Before)**

```js
body: JSON.stringify({
  generation_profile_key: profileKey,
  voice_provider: voiceProvider,
  voice_persona: voicePersona,
  voice_speed: voiceSpeed
})
```

**Code Sesudah (Proposed/After)**

```js
body: JSON.stringify({ generation_profile_key: profileKey })
```

### 11.19 Tests (new and modified)

Files minimal:

- `tests/youtube-studio-character-voice-contract.test.js`
- `tests/youtube-studio-character-voice-repository.test.js`
- `tests/youtube-studio-narrative-resolver.test.js`
- `tests/youtube-studio-multispeaker-contract.test.js`
- `tests/youtube-studio-production-casting-snapshot.test.js`
- `tests/youtube-studio-native-scene-audio.test.js`
- `tests/youtube-studio-glabs-audio-capabilities.test.js`
- `tests/youtube-studio-asmr-audio-contract.test.js`
- `tests/youtube-studio-sonic-identity.test.js`
- relevant API route/component tests following current project conventions.

**Code Sebelum (Current/Before)**

```js
// No complete strict registry + immutable voice casting suite.
```

**Code Sesudah (Proposed/After)**

```js
it('rejects an AI speaker outside the active Channel registry', async () => { /* ... */ });
it('keeps approved package voice after live Channel recasting', async () => { /* ... */ });
it('does not enqueue TTS jobs in native scene audio mode', async () => { /* ... */ });
it('preserves approved dialogue in the G-Labs audio prompt', async () => { /* ... */ });
it('rejects speech in no-talking ASMR', async () => { /* ... */ });
it('preserves intentional silence and sonic identity in native prompt', async () => { /* ... */ });
```

### 11.20 Hybrid prompt/production contracts and G-Labs adapter

Files aktual wajib ditemukan melalui audit; minimal mencakup `lib/youtube-studio-hybrid-contract.js`, planner/production repository, G-Labs adapter/client, dan asset validation yang menangani `i2v_prompt`.

**Code Sebelum (Current/Before)**

```js
generateVideo({ prompt: asset.i2v_prompt, startFrame, mode: 'image_to_video' });
```

**Code Sesudah (Proposed/After)**

```js
generateVideo({
  prompt: compileVisualAndAudioPrompt(asset),
  audioPrompt: asset.audio_prompt,
  voiceReferences: resolveSupportedVoiceReferences(snapshot),
  preserveEmbeddedAudio: snapshot.audio_production_mode === 'native_scene_audio',
  startFrame,
  mode: 'image_to_video'
});
```

Jika adapter G-Labs aktual hanya menerima plaintext, compiler memasukkan audio direction ke prompt secara deterministik dan capability melaporkan `descriptive_prompt`, bukan `voice_reference`.

### 11.21 Assembly/subtitle pipeline

File aktual wajib ditemukan saat audit karena assembly dapat tersebar pada worker/FFmpeg helper.

**Code Sebelum (Current/Before)**

```js
assembleVideo({ visualClips, externalVoiceTrack, subtitles });
```

**Code Sesudah (Proposed/After)**

```js
assembleVideo({
  visualClips,
  audioSource: mode === 'native_scene_audio' ? 'embedded' : 'external_tts',
  normalizeLoudness: true,
  subtitles: mode === 'native_scene_audio' ? alignedSubtitles : ttsSubtitles
});
```

## 12. Execution Task List

- [x] Re-read this plan, `AGENTS.md`, relevant Next.js docs under `node_modules/next/dist/docs/`, and current YouTube Studio code before editing.
- [x] Record baseline tests, lint/build status, active schema behavior, and affected legacy data shape.
- [x] Audit the real G-Labs/Windows Worker request and response contract for embedded audio, audio prompt, voice reference/Ingredients, model support, and audio-stream output.
- [x] Record a capability decision: deterministic Flow voice reference or `experimental_prompt_guided`; never infer support from Google Flow web UI alone.
- [ ] Update this plan if actual files/contracts differ; preserve the product decisions above.
- [x] Implement idempotent PostgreSQL migrations and indexes for Channel Audio config, speakers, voice identities/bindings, Series bindings, and Episode bindings.
- [x] Implement audio-mode capability registry for TTS and G-Labs native audio plus strict validation contracts.
- [x] Implement Audio Experience contract for narrative/dialogue, Spoken ASMR, No-Talking ASMR, and Mixed ASMR.
- [x] Implement validated/versioned Channel Sonic Identity and immutable snapshot contract.
- [x] Implement tenant-scoped repository/service functions and transactional Audio config activation.
- [x] Implement Channel registry, Audio Production Mode/configuration, activation, preview, capability, and eligible-cast APIs.
- [x] Implement Series and Episode cast binding APIs with ownership and lifecycle validation.
- [x] Refactor narrative resolver to use Channel registry and remove narrator/hash persona invention.
- [x] Add strict allowed-speaker enforcement to Research/Blueprint/Script prompts and validators.
- [x] Add immutable narrative + audio-mode + casting snapshot to Script approval/Production Package.
- [x] Refactor production orchestrator into mutually exclusive `standalone_tts` and `native_scene_audio` branches.
- [x] Refactor TTS worker to resolve provider/persona/speed only from package snapshot.
- [x] Implement structured audio-aware I2V prompt contract and deterministic G-Labs compiler.
- [x] Extend Script/Production contracts with whisper, breath, sound-event, ambience, and intentional-silence blocks.
- [x] Extend Flow Prompt Compiler with ASMR microphone, spatial, trigger, ambience, and negative-audio directions.
- [x] Implement G-Labs native audio generation with voice reference only when capability is proven; otherwise expose prompt-guided experimental behavior.
- [ ] Implement audiovisual review, embedded-audio validation, ASR/forced subtitle alignment, loudness normalization, and assembly routing for native audio.
- [ ] Implement legacy migration/compatibility adapter with conflict reporting and no destructive data loss.
- [x] Add two-option Audio Production Mode selector at Channel: Standalone TTS or Native Scene Audio.
- [x] Add Channel Audio Experience selector and mode/experience compatibility preview.
- [x] Add Channel Sonic Identity editor with semantic theme CSS and safe mastering validation.
- [x] Move TTS provider/model settings UI to Channel and show it only for Standalone TTS.
- [x] Move provider-neutral Voice Identity plus TTS persona/speed/delivery/pronunciation UI per character to Channel Registry.
- [x] Add Google Flow voice reference/descriptive prompt binding per character and truthful consistency/capability status.
- [x] Replace Series free-text cast UI with Channel Registry selector.
- [x] Replace Episode free-text cast UI with eligible Series selector and read-only casting summary.
- [x] Remove TTS provider/persona/speed editor and request payload from Episode Generation Profile.
- [x] Apply existing semantic MAKNA Flow CSS tokens; remove any new inline/literal color styling.
- [ ] Add unit, repository, API, resolver, planner, production snapshot, native audio/G-Labs, assembly, and compatibility tests.
- [x] Run targeted tests, full relevant test suite, lint, and production build. *(14 targeted assertions and production build pass; repository has no lint script.)*
- [x] Deploy **only** to Mac Mini Dev using `npm run deploy:macmini-dev`.
- [ ] Run both API smoke branches against Dev ports `5020/7020`, including embedded audio-stream and immutable snapshot regression.
- [ ] Run API smoke cases for Spoken, No-Talking, and Mixed ASMR, including silence preservation and Sonic Identity prompt assertions.
- [x] Verify PM2 health/logs without SSH polling loops and record evidence.
- [x] Update this task list from `[ ]` to `[x]` immediately after every completed step.
- [ ] After verification succeeds, follow repository release/git-sync SOP with an appropriate patch release.
- [x] Confirm no Staging or Production deployment occurred.

## 13. Definition of Done

Pekerjaan selesai hanya jika:

1. Channel adalah satu-satunya UI write authority untuk Audio Production Mode, provider, Voice Identity, TTS persona, dan Flow voice binding.
2. Kedua mode tersedia dan mutually exclusive: `standalone_tts` atau `native_scene_audio`.
3. Audio Experience tersedia sebagai dimensi terpisah: Narrative/Dialogue, Spoken ASMR, No-Talking ASMR, dan Mixed ASMR.
4. Setiap karakter aktif mempunyai binding valid untuk locale, mode, dan experience Channel aktif.
5. Series dan Episode hanya memilih karakter terdaftar.
6. AI output dengan speaker tidak terdaftar ditolak oleh backend contract.
7. Tidak ada automatic narrator atau hash persona fallback pada pipeline baru.
8. Standalone mode membuat TTS jobs; native mode tidak membuat TTS jobs dan mempertahankan embedded audio.
9. ASMR memakai validated Sonic Identity dan first-class sound/whisper/silence timeline.
10. No-Talking ASMR berjalan tanpa narrator; Mixed ASMR menegakkan spoken + sound event completeness.
11. Production memakai immutable audio-mode + experience + casting + Sonic Identity snapshot.
12. Flow voice consistency dilabeli sesuai kemampuan riil G-Labs; Google TTS persona tidak disamakan dengan Flow reference.
13. Episode legacy tetap kompatibel tanpa silent destructive migration.
14. Semua automated gate lulus.
15. API smoke test Dev membuktikan multi-persona dan ASMR pada kedua production branch yang kompatibel.
16. Deployment hanya dilakukan ke Mac Mini Dev.
