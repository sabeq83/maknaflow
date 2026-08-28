# YouTube Studio — Multi-Speaker Narrative Blueprint

> Status: Product & Architecture Blueprint  
> Module: YouTube Studio  
> Context: Faceless AI long-form video  
> Scope: Narration-only, dialogue-driven, dan hybrid narration-dialogue  
> Non-goal awal: photorealistic lip-sync penuh untuk semua karakter  
> Bahasa: Multilingual by design

## 1. Ringkasan

YouTube Studio saat ini memiliki struktur naskah berbasis satu `voiceover` untuk setiap scene. Struktur tersebut cocok untuk video monolog atau narrator-led, tetapi belum mampu merepresentasikan percakapan antara beberapa karakter secara eksplisit.

Blueprint ini memperluas YouTube Studio menjadi sistem narasi multi-speaker yang dapat menghasilkan:

1. **Narration only** — satu narator membawakan seluruh cerita.
2. **Dialogue driven** — cerita terutama bergerak melalui percakapan karakter.
3. **Hybrid narration and dialogue** — narator mengikat cerita, sedangkan karakter menggerakkan konflik, emosi, dan informasi melalui dialog.

Konfigurasi tidak ditempatkan pada satu level saja. Sistem menggunakan inheritance:

```text
Channel Strategy narrative default
→ Series narrative format and recurring cast
→ Episode story setup and cast override
→ Resolved immutable narrative snapshot
→ Research → Blueprint → Script → Production
```

Series menjadi pusat konfigurasi format cerita. Channel menyediakan default, sedangkan episode menyediakan kebutuhan khusus cerita.

---

## 2. Masalah yang Diselesaikan

### 2.1 Keterbatasan saat ini

Kontrak script saat ini menyerupai:

```json
{
  "scene_index": 1,
  "voiceover": "Satu naskah lengkap yang dibaca satu suara.",
  "estimated_duration_seconds": 15,
  "visual_direction": "Visual pendukung"
}
```

Konsekuensinya:

- AI memperlakukan semua teks sebagai monolog;
- tidak ada identitas speaker yang stabil;
- episode hanya memiliki satu `voice_persona`;
- TTS menghasilkan satu aset suara per scene;
- subtitle tidak mengetahui pergantian pembicara;
- production planner tidak mengetahui siapa yang sedang berbicara;
- visual prompt tidak dapat merencanakan reaction shot atau shot-reverse-shot secara konsisten;
- timing percakapan, jeda, interupsi, dan respons emosional tidak dapat dimodelkan.

### 2.2 Target kondisi

Kontrak baru harus merepresentasikan setiap giliran berbicara sebagai unit produksi:

```text
Scene
├── narration block
├── dialogue block: Character A
├── dialogue block: Character B
├── pause / reaction beat
└── transition narration
```

Setiap block memiliki speaker, teks, emosi, delivery, durasi, dan hubungan dengan visual beat.

---

## 3. Prinsip Produk

1. **Series-first narrative design.** Format narasi terutama merupakan identitas program atau serial.
2. **Channel supplies defaults.** Channel menentukan kecenderungan editorial, bukan memaksa semua episode memiliki format identik.
3. **Episode can override before generation.** Episode dapat mengubah intensitas dialog, cast, POV, atau narrator usage sebelum Research dimulai.
4. **Speaker is a first-class entity.** Speaker bukan sekadar nama di dalam teks prompt.
5. **Universe character and voice casting are separate concerns.** Karakter visual berasal dari Universe; casting suara berasal dari konfigurasi naratif.
6. **Dialogue must serve story purpose.** Dialog tidak boleh menjadi percakapan dekoratif yang mengulang narator.
7. **Human approval remains explicit.** Cast, script, voice sample, dan produksi memiliki review gate.
8. **Snapshot for reproducibility.** Production menggunakan narrative/cast snapshot yang immutable.
9. **Multilingual from contract level.** Speaker, pronunciation, locale, subtitle, dan voice selection tidak boleh hard-coded ke Bahasa Indonesia.
10. **No fake capability.** Jika engine belum mendukung lip-sync, UI dan output tidak boleh menyatakan bahwa visual telah lip-synced.

---

## 4. Narrative Modes

### 4.1 `narration_only`

Seluruh cerita disampaikan oleh narator utama.

Contoh penggunaan:

- documentary explainer;
- historical summary;
- educational essay;
- listicle atau investigative narration.

Aturan:

- tepat satu narrator speaker wajib aktif;
- dialogue block tidak digunakan;
- quoted speech tetap dibaca narator kecuali episode mengaktifkan dramatized quote;
- kompatibel dengan script dan produksi lama.

### 4.2 `dialogue_driven`

Cerita terutama digerakkan oleh percakapan karakter.

Contoh penggunaan:

- audio drama;
- fictional mystery;
- mentor–student conversation;
- debate atau interview simulation.

Aturan:

- minimal dua speaker non-narrator;
- narrator opsional dan dibatasi untuk opening, transition, atau closing;
- setiap scene dialog wajib memiliki dramatic purpose;
- tidak boleh ada exposition panjang yang dipindahkan mentah menjadi dialog tidak natural.

### 4.3 `hybrid_narration_dialogue`

Narator mengatur konteks dan transisi; karakter membawa konflik, emosi, atau discovery.

Ini menjadi mode utama yang direkomendasikan untuk faceless AI storytelling karena:

- struktur long-form tetap mudah diikuti;
- dialog menambah dinamika dan variasi audio;
- visual dapat memakai reaction shot/cutaway tanpa memerlukan lip-sync penuh;
- narator dapat menjembatani bagian yang mahal atau sulit divisualisasikan.

### 4.4 Mode opsional masa depan

- `interview_conversation`
- `panel_discussion`
- `first_person_character_story`
- `dramatized_documentary`

Mode tersebut sebaiknya dibangun sebagai preset di atas kontrak multi-speaker yang sama, bukan schema terpisah.

---

## 5. Hierarki Konfigurasi

## 5.1 Channel Strategy — Narrative Defaults

Lokasi UI:

```text
Channel Strategy
└── Editorial Identity
    └── Narrative Defaults
```

Tujuan:

- menentukan format default channel;
- mendefinisikan peran narator channel;
- menetapkan rentang dialog yang sesuai brand;
- menetapkan apakah Series/Episode boleh override;
- menyediakan guardrail umum.

Kontrak yang disarankan:

```json
{
  "narrative_defaults": {
    "mode": "hybrid_narration_dialogue",
    "narrator_role": "omniscient_storyteller",
    "narrator_usage": "chapter_open_close",
    "dialogue_ratio_target": 0.35,
    "dialogue_ratio_min": 0.20,
    "dialogue_ratio_max": 0.50,
    "max_speakers_per_scene": 3,
    "allow_series_override": true,
    "allow_episode_override": true,
    "dialogue_guardrails": [
      "Dialogue must advance conflict, reveal character, or deliver information naturally",
      "Narration must not repeat information already established by dialogue"
    ]
  }
}
```

### Channel-level controls

| Control | Pilihan/contoh |
|---|---|
| Default narrative mode | Narration only / Dialogue driven / Hybrid |
| Narrator role | Omniscient / Guide / Investigator / Character narrator |
| Default narrator usage | Full / Chapter boundary / Transition only / None |
| Dialogue intensity | Light / Balanced / Heavy / Custom |
| Max speakers per scene | 2–4 |
| Override policy | Series only / Series + Episode / Locked |
| Dialogue guardrails | Free-form editorial rules |

Channel Strategy tidak menyimpan detail plot atau guest character episode.

## 5.2 Content Series — Narrative Format & Recurring Cast

Lokasi UI:

```text
Content Series
└── Format & Cast
    ├── Narrative Format
    ├── Narrator
    ├── Recurring Cast
    ├── Dialogue Rules
    └── Voice Casting
```

Series adalah sumber konfigurasi utama karena format percakapan biasanya menjadi identitas show.

Kontrak yang disarankan:

```json
{
  "narrative_format": {
    "inherit_channel_default": false,
    "mode": "hybrid_narration_dialogue",
    "dialogue_ratio_min": 0.25,
    "dialogue_ratio_max": 0.45,
    "narrator_usage": "chapter_open_close",
    "max_speakers_per_scene": 2,
    "default_point_of_view": "third_person_omniscient",
    "dialogue_style": "cinematic_natural",
    "allow_episode_override": true
  },
  "recurring_cast": [
    {
      "speaker_id": "narrator",
      "display_name": "Narrator",
      "speaker_role": "narrator",
      "universe_character_key": null,
      "voice_casting_key": "voice_narrator_primary",
      "required": true
    },
    {
      "speaker_id": "detective_arya",
      "display_name": "Arya",
      "speaker_role": "protagonist",
      "universe_character_key": "detective_arya",
      "voice_casting_key": "voice_arya",
      "required": false
    }
  ]
}
```

### Series-level controls

| Control | Fungsi |
|---|---|
| Inherit channel defaults | Menggunakan semua default Channel Strategy |
| Narrative mode | Format dasar seluruh episode series |
| Dialogue ratio range | Guardrail, bukan kuota kalimat kaku |
| Narrator usage | Di mana narrator boleh hadir |
| Recurring cast | Karakter yang dapat digunakan berulang |
| Voice casting | Mapping speaker ke provider/persona suara |
| Dialogue style | Natural, comedic, dramatic, educational, restrained |
| Relationship rules | Hubungan, hierarchy, address terms, recurring tension |
| Catchphrase policy | Diperbolehkan/dibatasi, mencegah repetisi berlebihan |

## 5.3 Episode — Story Setup & Cast Override

Lokasi UI:

```text
Episode
└── Story Setup
    ├── Narrative Format
    ├── Dialogue Intensity
    ├── Point of View
    ├── Episode Cast
    ├── Character Objectives
    └── Special Direction
```

Story Setup harus tersedia setelah episode dibuat dan sebelum AI Research.

Kontrak yang disarankan:

```json
{
  "narrative_override": {
    "mode": "inherit",
    "dialogue_intensity": "balanced",
    "dialogue_ratio_target": null,
    "narrator_usage": "inherit",
    "point_of_view": "inherit",
    "special_direction": "Keep exchanges tense and concise. Narrator must not explain the subtext."
  },
  "episode_cast": [
    {
      "speaker_id": "detective_arya",
      "source": "series",
      "story_role": "protagonist",
      "objective": "Discover why the witness is withholding information"
    },
    {
      "speaker_id": "witness_mira",
      "source": "episode_guest",
      "universe_character_key": "witness_mira",
      "story_role": "witness",
      "objective": "Hide her connection to the victim",
      "voice_casting_key": "voice_mira_guest"
    }
  ]
}
```

### Episode-level controls

- Inherit from Series / Narration only / Dialogue driven / Hybrid.
- Dialogue intensity: Light, Balanced, Heavy, atau Custom.
- Narrator usage override.
- POV: first person, third person limited, omniscient, observer.
- Pilih recurring cast dari Series/Universe.
- Tambahkan guest character.
- Tentukan objective, secret, conflict, dan relationship episode.
- Special direction untuk episode.

### Locking policy

- Story Setup editable pada status `Idea` dan `Planned`.
- Saat AI Research dimulai, resolved narrative configuration disnapshot.
- Perubahan setelah Research harus menampilkan dampak dan meminta regenerate downstream.
- Perubahan cast setelah script approved menginvalidasi script approval, voice assets, visual prompts yang bergantung pada karakter, preview, dan final render.

---

## 6. Narrative Configuration Resolver

Resolver menghasilkan satu konfigurasi efektif:

```text
System fallback
  narration_only
       ↓
Channel narrative_defaults
       ↓
Series narrative_format + recurring_cast
       ↓
Episode narrative_override + episode_cast
       ↓
Resolved narrative snapshot
```

Contoh hasil resolver:

```json
{
  "schema_version": 1,
  "resolved_mode": "hybrid_narration_dialogue",
  "source": {
    "channel_strategy_id": "yts_xxx",
    "series_id": "ytsr_xxx",
    "episode_id": "ytep_xxx"
  },
  "dialogue_ratio": {
    "target": 0.35,
    "min": 0.25,
    "max": 0.45
  },
  "narrator_usage": "chapter_open_close",
  "point_of_view": "third_person_omniscient",
  "max_speakers_per_scene": 2,
  "speakers": [],
  "guardrails": [],
  "resolved_at": "ISO-8601 timestamp"
}
```

Snapshot disimpan pada:

- Research Brief context snapshot;
- Blueprint context snapshot;
- Script context snapshot;
- Production Package context snapshot.

Artefak lama tetap dapat direproduksi walaupun Channel/Series configuration kemudian berubah.

---

## 7. Speaker & Voice Casting Model

## 7.1 Speaker identity

Speaker adalah identitas naratif stabil.

```json
{
  "speaker_id": "detective_arya",
  "display_name": "Arya",
  "speaker_role": "protagonist",
  "speaker_type": "character",
  "universe_character_key": "detective_arya",
  "language": "id-ID",
  "pronouns": "dia",
  "address_rules": ["Uses formal address with superiors"],
  "speech_traits": ["short sentences", "rarely explains emotion directly"]
}
```

`speaker_id` tidak boleh berasal dari display name bebas karena display name dapat berubah atau diterjemahkan.

## 7.2 Voice casting

Voice casting dipisahkan dari speaker identity:

```json
{
  "voice_casting_key": "voice_arya",
  "speaker_id": "detective_arya",
  "provider": "google_tts",
  "voice_persona": "Zephyr",
  "locale": "id-ID",
  "speed": 0.96,
  "pitch": 0,
  "style": "restrained_confident",
  "pronunciation_lexicon": [
    { "term": "Arunika", "pronunciation": "A-ru-ni-ka" }
  ]
}
```

Aturan:

- satu speaker memiliki satu casting aktif per locale;
- episode boleh override casting untuk guest character;
- perubahan casting tidak mengubah Universe character;
- voice sample harus dapat dipreview sebelum script masuk produksi;
- provider capability divalidasi per locale/persona.
- voice casting tidak boleh mengasumsikan bahwa semua provider menerima banyak speaker dalam satu request;
- provider dan synthesis strategy disnapshot per audio block atau dialogue group;
- `google_tts` pada YouTube Studio saat ini berarti Google Gemini TTS, bukan generic Cloud TTS voice tier.

## 7.3 Narrator

Narrator diperlakukan sebagai speaker khusus:

```json
{
  "speaker_id": "narrator",
  "speaker_type": "narrator",
  "speaker_role": "omniscient_storyteller"
}
```

Satu episode dapat memiliki narrator character, tetapi MVP hanya mengizinkan satu narrator utama untuk menghindari ambiguity.

---

## 8. Research Brief Contract

Research tidak menulis dialog final, tetapi mengidentifikasi kebutuhan dramatik.

Field tambahan:

```json
{
  "narrative_research": {
    "recommended_mode": "hybrid_narration_dialogue",
    "conflict_opportunities": [
      "The witness account contradicts the official timeline"
    ],
    "character_knowledge_map": [
      {
        "speaker_id": "detective_arya",
        "knows": ["official timeline"],
        "does_not_know": ["witness relationship to victim"]
      }
    ],
    "dialogue_risk_flags": [
      "Do not place unverified factual claims in a character's mouth to bypass sourcing"
    ]
  }
}
```

Research factual policy tetap berlaku untuk dialogue. Klaim yang diucapkan karakter tidak otomatis menjadi opini fiksi jika konteks video bersifat factual.

---

## 9. Episode Blueprint Contract

Blueprint menentukan fungsi dialog sebelum script ditulis.

Contoh chapter:

```json
{
  "order": 2,
  "title": "The Conflicting Account",
  "target_duration_seconds": 120,
  "narrative_focus": "Expose a contradiction without resolving it immediately",
  "narrative_plan": {
    "mode": "dialogue_with_narrator_bridge",
    "narrator_function": "Establish location, then exit",
    "dialogue_beats": [
      {
        "beat_order": 1,
        "purpose": "Arya tests Mira's timeline",
        "speakers": ["detective_arya", "witness_mira"],
        "conflict": "Mira gives a technically true but incomplete answer",
        "information_revealed": "Mira saw the victim before midnight",
        "information_withheld": "Mira knew the victim personally",
        "emotional_shift": "controlled → defensive"
      }
    ]
  }
}
```

Validation:

- semua speaker harus ada pada resolved cast;
- jumlah speaker per scene tidak melebihi konfigurasi;
- dialogue beat memiliki purpose dan information movement;
- narrator function mengikuti `narrator_usage`;
- blueprint factual tidak boleh mengubah sourced claim menjadi fabricated dialogue.

---

## 10. Multi-Speaker Script Contract

## 10.1 Struktur utama

```json
{
  "schema_version": 2,
  "title": "Episode title",
  "narrative_mode": "hybrid_narration_dialogue",
  "estimated_total_duration_seconds": 600,
  "speaker_manifest": [
    {
      "speaker_id": "narrator",
      "display_name": "Narrator",
      "speaker_type": "narrator",
      "voice_casting_key": "voice_narrator_primary"
    },
    {
      "speaker_id": "detective_arya",
      "display_name": "Arya",
      "speaker_type": "character",
      "voice_casting_key": "voice_arya"
    }
  ],
  "scenes": []
}
```

## 10.2 Scene contract

```json
{
  "scene_index": 1,
  "chapter_order": 1,
  "purpose": "Introduce the central contradiction",
  "estimated_duration_seconds": 24,
  "scene_type": "generated_visual",
  "location_key": "old_city_alley",
  "present_characters": ["detective_arya", "witness_mira"],
  "audio_blocks": [],
  "visual_direction": "Cinematic alternating reaction coverage in a dim alley",
  "transition_note": "hard_cut",
  "music_cue": "low suspense bed",
  "sfx_cues": ["distant traffic", "light rain"]
}
```

## 10.3 Audio block contract

```json
{
  "block_id": "sc01_ab01",
  "order": 1,
  "type": "narration",
  "speaker_id": "narrator",
  "text": "Malam itu, gang tua Arunika lebih sunyi dari biasanya.",
  "emotion": "ominous",
  "delivery": "slow_controlled",
  "pause_before_ms": 0,
  "pause_after_ms": 600,
  "estimated_duration_seconds": 5.2,
  "subtitle_cue": "Malam itu, gang tua Arunika lebih sunyi dari biasanya.",
  "visual_beat_id": "sc01_vb01"
}
```

Dialogue block:

```json
{
  "block_id": "sc01_ab02",
  "order": 2,
  "type": "dialogue",
  "speaker_id": "detective_arya",
  "addressed_to": ["witness_mira"],
  "text": "Kau yakin ini tempatnya?",
  "emotion": "suspicious",
  "delivery": "quiet_restrained",
  "subtext": "Arya already suspects Mira is lying",
  "pause_before_ms": 250,
  "pause_after_ms": 400,
  "estimated_duration_seconds": 2.8,
  "subtitle_cue": "Kau yakin ini tempatnya?",
  "visual_beat_id": "sc01_vb02"
}
```

### Allowed block types MVP

- `narration`
- `dialogue`
- `internal_monologue`

Future types:

- `group_dialogue`
- `archival_quote`
- `phone_or_radio`
- `vocal_reaction`

## 10.4 Backward compatibility

Script schema v1:

```json
{ "voiceover": "..." }
```

Dinormalisasi menjadi:

```json
{
  "audio_blocks": [
    {
      "type": "narration",
      "speaker_id": "narrator",
      "text": "..."
    }
  ]
}
```

Selama masa transisi, `voiceover` dapat disimpan sebagai derived plain text untuk preview/search, tetapi bukan sumber kebenaran produksi schema v2.

## 10.5 Script validation

Validator wajib memastikan:

- `schema_version` dikenali;
- `speaker_id` terdaftar pada speaker manifest dan resolved snapshot;
- order block sequential dan `block_id` unik;
- block narration hanya memakai narrator yang sah;
- dialogue memiliki speaker character;
- text tidak kosong dan sesuai locale;
- total estimasi audio + pauses sesuai scene duration dalam tolerance;
- ratio dialog berada dalam guardrail atau memiliki override rationale;
- max speakers per scene dipatuhi;
- narrator tidak menduplikasi dialogue beat;
- scene factual menjaga source/risk flags.

---

## 11. Duration & Pacing Model

Perhitungan lama berbasis seluruh kata `voiceover` harus diperluas per speaker/block.

```text
block duration
= word duration berdasarkan voice profile speaker
+ punctuation pause
+ pause_before
+ pause_after
+ optional reaction beat
```

Setiap voice casting dapat memiliki WPM berbeda:

```json
{
  "speaker_id": "witness_mira",
  "target_wpm": 125,
  "pause_ratio": 0.16,
  "sentence_words": { "min": 4, "max": 15 }
}
```

Scene duration:

```text
Σ audio block predicted duration
+ explicit pauses
+ non-verbal/reaction beats
= target scene duration ± tolerance
```

Auto-fit tidak boleh sekadar menambah kata pada semua block. Strateginya:

1. sesuaikan pause yang aman;
2. ringkas/rewrite block terpanjang;
3. hindari mengubah information ownership antar karakter;
4. pertahankan subtext dan emotional progression;
5. buat script version baru dan invalidasi approval lama.

---

## 12. Production Plan Contract

Production Plan harus speaker-aware.

```json
{
  "scene_index": 1,
  "narrative_duration_seconds": 24,
  "audio_blocks": ["sc01_ab01", "sc01_ab02", "sc01_ab03"],
  "visual_beats": [
    {
      "visual_beat_id": "sc01_vb01",
      "audio_block_ids": ["sc01_ab01"],
      "shot_purpose": "establish location",
      "on_screen_characters": [],
      "speaker_focus": null
    },
    {
      "visual_beat_id": "sc01_vb02",
      "audio_block_ids": ["sc01_ab02"],
      "shot_purpose": "speaker close-up",
      "on_screen_characters": ["detective_arya"],
      "speaker_focus": "detective_arya"
    },
    {
      "visual_beat_id": "sc01_vb03",
      "audio_block_ids": ["sc01_ab03"],
      "shot_purpose": "reaction shot",
      "on_screen_characters": ["witness_mira"],
      "speaker_focus": "witness_mira"
    }
  ]
}
```

Shot grammar untuk MVP tanpa lip-sync:

- narrator: establishing shot, montage, environment, diagram, archive, B-roll;
- speaking character: medium shot, profile, partial silhouette, over-the-shoulder;
- listener: reaction shot;
- dialogue exchange: alternating visual coverage dan cutaways;
- high-risk lip visibility: hindari extreme close-up mulut;
- allow off-screen dialogue ketika continuity/cost lebih aman.

Visual prompt menggunakan:

- Universe character canonical prompt;
- current wardrobe/location continuity;
- `speaker_focus` dan listener state;
- emotion dan subtext dari audio block;
- shot purpose;
- visual identity snapshot.

---

## 13. TTS & Audio Production

## 13.1 Provider capability findings

### MiniMax Speech T2A

Berdasarkan kontrak resmi endpoint yang dipakai MAKNA Flow:

- synchronous HTTP menggunakan `POST /v1/t2a_v2`;
- async menggunakan `POST /v1/t2a_async_v2`;
- satu request memiliki satu object `voice_setting` dan satu `voice_id`;
- dua endpoint tersebut tidak mendokumentasikan native multi-speaker configuration;
- synchronous text dibatasi kurang dari 10.000 karakter dan streaming direkomendasikan di atas 3.000 karakter;
- asynchronous text mendukung sampai 50.000 karakter, atau text file sampai 1.000.000 karakter;
- pause dapat diarahkan dengan marker `<#x#>`;
- async dapat menghasilkan sentence-level subtitle information untuk input file.

Referensi resmi:

- [MiniMax Text to Speech T2A HTTP](https://platform.minimax.io/docs/api-reference/speech-t2a-http)
- [MiniMax Create Speech Generation Task](https://platform.minimax.io/docs/api-reference/speech-t2a-async-create)

Implikasi untuk dialogue:

```text
Dialogue block Speaker A
→ MiniMax request dengan voice_id A

Dialogue block Speaker B
→ MiniMax request dengan voice_id B

Audio blocks
→ normalize → add pauses → concatenate/mix by timeline
```

Jadi MiniMax **mendukung produksi dialog melalui orchestration per speaker turn**, bukan native multiple voices dalam satu request berdasarkan dua endpoint resmi tersebut.

Untuk YouTube Studio, synchronous HTTP direkomendasikan sebagai default per audio block karena:

- granular review dan regenerate;
- satu block biasanya jauh di bawah limit;
- provider result dapat langsung dipetakan ke `audio_block_id`;
- failure satu character turn tidak menggagalkan seluruh chapter.

Async MiniMax digunakan untuk:

- narration block yang sangat panjang;
- bulk generation setelah semua dialogue/voice casting approved;
- kebutuhan file/subtitle output provider;
- fallback workload yang melampaui batas synchronous.

Async tidak boleh dipakai untuk menggabungkan banyak karakter ke satu `voice_id`.

### Google Gemini TTS

Google Gemini TTS secara resmi mendukung:

- single-speaker synthesis;
- native multi-speaker dialogue;
- maksimal dua speaker berbeda dalam satu native multi-speaker request;
- mapping speaker alias ke prebuilt voice;
- direction melalui natural-language prompt untuk style, tone, accent, pace, dan emotion/delivery;
- structured dialogue turns pada Cloud Text-to-Speech Gemini-TTS.

Referensi resmi:

- [Gemini API speech generation](https://ai.google.dev/gemini-api/docs/speech-generation)
- [Google Cloud Gemini-TTS](https://cloud.google.com/text-to-speech/docs/gemini-tts)
- [MultiSpeakerVoiceConfig](https://cloud.google.com/text-to-speech/docs/reference/rest/Shared.Types/MultiSpeakerVoiceConfig)

Current MAKNA audit:

```text
google_tts
→ callGeminiTtsApi()
→ gemini-2.5-flash-preview-tts:generateContent
→ speechConfig.voiceConfig.prebuiltVoiceConfig
→ one voice per request
```

Model yang digunakan sudah merupakan Gemini TTS model yang memiliki capability multi-speaker, tetapi adapter YouTube Studio saat ini hanya memakai `voiceConfig` single speaker. Native multi-speaker membutuhkan adapter/payload terpisah dengan dua speaker alias dan dua voice mappings.

### Provider capability matrix

| Capability | MiniMax T2A v2 | Google Gemini TTS |
|---|---|---|
| Single speaker per request | Ya | Ya |
| Native multi-speaker request | Tidak terdokumentasi pada dua endpoint yang dipakai | Ya, tepat/maksimal dua speaker sesuai API surface |
| Dialogue lebih dari dua karakter | Ya, melalui request per block | Ya, melalui request per block; native request tetap maksimal dua |
| Voice per character | Ya, pilih `voice_id` per request | Ya, voice per request atau dua voice pada native dialogue |
| Granular regenerate per turn | Sangat sesuai | Sangat sesuai dalam segmented mode |
| Native conversational prosody | Terbatas pada hasil per-turn dan direction yang tersedia | Didukung pada native two-speaker dialogue |
| Long async synthesis | Ya | Jangan diasumsikan; mengikuti model/API Google yang dipilih |
| Explicit pause | MiniMax pause marker atau timeline assembly | Prompt/audio tags atau timeline assembly |
| Recommended MVP mode | `segmented_turns` | `segmented_turns`; native two-speaker sebagai optimization opsional |

## 13.2 Provider-agnostic synthesis strategies

Sistem mendukung dua strategy:

### `segmented_turns`

```text
1 audio block
→ 1 provider request
→ 1 speaker voice
→ 1 reviewable audio asset
```

Ini menjadi default lintas provider karena:

- bekerja pada MiniMax dan Google;
- mendukung narrator + lebih dari dua karakter;
- memungkinkan regenerate satu baris dialog;
- actual duration tersedia per block;
- subtitle timing dan visual beat dependency lebih presisi;
- provider dapat diganti per speaker jika diperlukan;
- kegagalan dan biaya dapat diaudit per block.

Trade-off:

- natural conversational flow harus dibangun lewat pause, room tone, loudness normalization, dan scene mix;
- pergantian turn menambah jumlah API call;
- prosody antar turn perlu quality review.

### `native_two_speaker`

```text
Dialogue group dengan tepat dua speaker
→ satu Google Gemini multi-speaker request
→ satu combined performance asset
```

Strategy ini hanya eligible jika:

- provider capability menyatakan native multi-speaker;
- tepat dua speaker digunakan dalam dialogue group;
- semua block telah approved;
- panjang input memenuhi batas provider;
- user menerima bahwa regenerate satu turn dapat menginvalidasi seluruh combined group;
- result memiliki timing/segmentation yang cukup untuk subtitle dan visual alignment, atau sistem menjalankan alignment terpisah.

Native two-speaker bukan default MVP karena combined output mengurangi granularitas revision dan portability ke MiniMax. Ia merupakan quality/cost optimization yang dapat dipilih per dialogue group setelah baseline segmented pipeline stabil.

## 13.3 TTS provider capability contract

```json
{
  "provider": "google_tts",
  "model": "gemini-2.5-flash-preview-tts",
  "capabilities": {
    "single_speaker": true,
    "native_multi_speaker": true,
    "native_multi_speaker_max": 2,
    "segmented_dialogue": true,
    "async_long_form": false,
    "prompted_delivery": true,
    "explicit_pause_control": true
  },
  "supported_synthesis_strategies": [
    "segmented_turns",
    "native_two_speaker"
  ]
}
```

MiniMax example:

```json
{
  "provider": "minimax",
  "model": "speech-2.8-hd",
  "capabilities": {
    "single_speaker": true,
    "native_multi_speaker": false,
    "native_multi_speaker_max": 1,
    "segmented_dialogue": true,
    "async_long_form": true,
    "prompted_delivery": false,
    "explicit_pause_control": true
  },
  "supported_synthesis_strategies": [
    "segmented_turns"
  ]
}
```

`prompted_delivery: false` pada contract MiniMax berarti MAKNA tidak boleh mengandalkan field emotion bebas sebagai capability API yang terjamin oleh dua endpoint yang dirujuk. Emotion tetap merupakan creative direction dan dapat dipetakan ke voice choice, speed, pitch, pause, atau capability MiniMax lain hanya setelah didukung dokumentasi/model yang dipilih.

Resolver provider harus menolak:

- `native_two_speaker` pada MiniMax;
- lebih dari dua speaker dalam Google native group;
- voice ID yang tidak valid untuk provider/locale;
- strategy yang tidak didukung model aktif;
- mixing output dengan sample rate/channel tidak ternormalisasi.

## 13.4 Asset granularity

Satu audio asset dibuat per audio block, bukan satu scene penuh:

```text
youtube_audio_asset
├── production_package_id
├── scene_index
├── audio_block_id
├── speaker_id
├── voice_casting_snapshot
├── text_snapshot
├── provider_task_id
├── output_asset
├── predicted_duration
├── actual_duration
├── status
└── review metadata
```

## 13.5 Voice generation flow

```text
Approved multi-speaker script
→ resolve voice casting snapshot
→ resolve provider capability and synthesis strategy
→ generate TTS per audio block or eligible Google two-speaker group
→ normalize loudness
→ measure actual duration
→ assemble scene dialogue track
→ user reviews by speaker/scene
→ approve VO batch
```

User dapat:

- play per block;
- play full scene;
- regenerate one block;
- replace voice casting before approval;
- adjust delivery/emotion/speed;
- edit pronunciation;
- approve per batch/chapter.

Mengganti satu block hanya menginvalidasi:

- block audio;
- scene audio mix;
- subtitle timing block;
- dependent preview/final render.

Tidak menginvalidasi visual jika durasi aktual masih dalam tolerance dan speaker/character tidak berubah.

Untuk `native_two_speaker`, mengubah satu turn menginvalidasi seluruh dialogue group audio, alignment, subtitle timing, scene mix, dan dependent render.

## 13.6 Mixing

- loudness target konsisten antar speaker;
- ducking musik mengikuti dialogue/narration activity;
- pause tidak dipotong otomatis;
- room tone/SFX dapat menyambungkan potongan TTS;
- character voice tidak boleh berganti persona di tengah episode tanpa explicit creative reason.
- semua provider output dinormalisasi ke canonical production format sebelum scene assembly;
- segmented turns menggunakan timeline pause sebagai source of truth, bukan silence yang muncul tidak deterministik dari provider;
- native Google dialogue disimpan sebagai combined performance asset dengan lineage ke seluruh `audio_block_id` yang tercakup.

---

## 14. Subtitle Contract

Subtitle berasal dari audio blocks dan timing aktual.

```json
{
  "audio_block_id": "sc01_ab02",
  "speaker_id": "detective_arya",
  "speaker_label": "Arya",
  "start_ms": 5800,
  "end_ms": 8600,
  "text": "Kau yakin ini tempatnya?",
  "display_speaker_label": false
}
```

Aturan:

- speaker label configurable per channel/series;
- label disarankan untuk off-screen dialogue atau accessibility;
- subtitle localisation tidak boleh mengganti speaker identity;
- reading speed divalidasi per locale;
- overlapping dialogue tidak masuk MVP awal kecuali renderer mendukung multi-line timing dengan aman.

---

## 15. Approval Workflow

```text
Story Setup Draft
→ Resolve Narrative Configuration
→ Research Review
→ Blueprint Review
→ Script & Dialogue Review
→ Voice Casting Review
→ Script Approved
→ TTS Batch Generate
→ Multi-Speaker VO Review
→ Visual Production
→ Preview Review
→ Final Render
```

### Script review checks

- apakah setiap speaker terdengar berbeda;
- apakah dialog menggerakkan cerita;
- apakah narrator mengulang dialog;
- apakah character knowledge konsisten;
- apakah emosi berkembang secara natural;
- apakah factual claims memiliki source/risk handling;
- apakah dialogue ratio sesuai format;
- apakah pronunciation dan names benar.

### Voice review checks

- speaker–voice cocok;
- pronunciation benar;
- emotion/delivery sesuai;
- volume konsisten;
- actual duration sesuai timeline;
- tidak ada clipping atau silence abnormal.

---

## 16. UI Information Architecture

## 16.1 Channel Strategy

```text
Editorial Identity
├── Tone of Voice
├── Narrative Defaults
│   ├── Default Narrative Mode
│   ├── Narrator Role
│   ├── Narrator Usage
│   ├── Dialogue Intensity
│   └── Override Policy
└── Editorial Guardrails
```

## 16.2 Series

```text
Series Overview
├── Concept & Pillar
├── Format & Cast
│   ├── Narrative Format
│   ├── Recurring Cast
│   ├── Voice Casting
│   ├── Dialogue Rules
│   └── Relationship Rules
├── Episode Template
└── Publishing Cadence
```

## 16.3 Episode

```text
Episode Workspace
├── 1. Story Setup
│   ├── Narrative Override
│   ├── Episode Cast
│   └── Character Objectives
├── 2. Research
├── 3. Blueprint
├── 4. Script
│   ├── Scene list
│   ├── Speaker-colored audio blocks
│   └── Dialogue quality checks
├── 5. Voice Casting & VO
├── 6. Visual Production
├── 7. Preview & Render
└── 8. Publishing
```

### Script editor representation

Setiap block ditampilkan vertikal:

```text
[Narrator]  ominous · slow
Malam itu, kota lebih sunyi dari biasanya.

[Arya]  suspicious · restrained
Kau yakin ini tempatnya?

[Mira]  afraid · hesitant
Aku melihatnya masuk. Tapi tidak pernah keluar.
```

Speaker menggunakan semantic identity token, bukan warna literal yang disimpan dalam data.

---

## 17. KB Integration

Tidak diperlukan KB type baru. Perluasan dilakukan pada KB yang sudah ada.

### Channel Profile

Tambahkan:

- default narrative mode;
- narrator role and usage;
- allowed dialogue intensity;
- override policy;
- channel-wide dialogue guardrails.

### Series Content Guide

Tambahkan:

- narrative format;
- recurring cast;
- relationship rules;
- dialogue ratio range;
- recurring dialogue pattern;
- catchphrase/repetition policy.

### Long-form Editorial Playbook

Tambahkan:

- dialogue purpose taxonomy;
- exposition and subtext rules;
- character knowledge consistency;
- factual dialogue policy;
- anti-repetition checks.

### Voice & Audio Guide

Tambahkan:

- speaker casting matrix;
- voice differentiation;
- emotion/delivery vocabulary;
- pronunciation lexicon;
- loudness/mixing rules;
- speaker-labelled subtitle policy.

### Visual Continuity Guide

Tambahkan:

- speaker-to-Universe-character mapping;
- dialogue shot grammar;
- reaction shot rules;
- wardrobe/location continuity;
- no-lip-sync framing guidance.

Resolved KB snapshot harus masuk ke Research, Blueprint, Script, dan Production Plan.

---

## 18. AI Prompting Responsibilities

### Research AI

- mengidentifikasi conflict opportunity;
- membuat character knowledge map;
- menandai factual dialogue risks;
- tidak menulis dialogue final.

### Blueprint AI

- menentukan narrator function per chapter;
- menentukan dialogue beats, speakers, conflict, reveal, withheld information, emotional shift;
- memvalidasi cast terhadap resolver.

### Script AI

- menghasilkan audio blocks;
- menjaga voice distinction dan relationship rules;
- menjaga locale dan pronunciation;
- menghitung pacing per voice profile;
- tidak membuat speaker baru tanpa manifest.

### Production Planner AI

- menghubungkan audio blocks ke visual beats;
- memilih speaker focus/listener reaction;
- memilih T2I→I2V untuk recurring character continuity;
- menghindari visual lip-sync claim jika capability tidak tersedia.

---

## 19. Data & Versioning Direction

Blueprint ini tidak mengharuskan semua data menjadi kolom baru. Arah yang disarankan:

- Channel Strategy: simpan `narrative_defaults` pada `config_json`.
- Series: simpan `narrative_format` dan recurring cast pada `config_json`.
- Episode: tambahkan `narrative_config_json` atau field JSON khusus agar override dapat divalidasi/versioned dengan jelas.
- Script: gunakan `script_json.schema_version = 2`.
- Production Package: simpan resolved narrative dan voice casting snapshots pada `context_snapshot_json`.
- Production assets: audio block identity harus tersimpan sebagai field yang dapat di-query; jangan hanya disembunyikan dalam prompt text.

Semua schema baru memiliki:

- `schema_version`;
- validator;
- normalizer backward compatibility;
- snapshot provenance;
- migration non-destructive;
- audit field untuk perubahan cast/voice.

---

## 20. Invalidation Rules

| Perubahan | Artefak yang harus diinvalidasi |
|---|---|
| Narrative mode sebelum Research | Belum ada downstream artifact |
| Narrative mode setelah Research | Research recommendation, Blueprint, Script, Production |
| Episode cast setelah Blueprint | Blueprint dialogue plan, Script, voice/visual production |
| Speaker voice persona setelah Script Approved | Voice assets, scene mix, subtitle timing, preview/final |
| Dialogue text | Audio block, subtitle block, scene mix, preview/final |
| Speaker identity pada block | Audio, speaker-focused visual prompt, subtitle, preview/final |
| Emotion/delivery only | Audio block dan dependent mix/render |
| Voice speed dengan perubahan timing | Audio, subtitle timing, dependent visual alignment, preview/final |

Invalidation harus selektif dan tidak menghapus artifact lama. Artifact lama ditandai superseded untuk audit.

---

## 21. MVP Scope

### Termasuk MVP

- tiga narrative modes;
- hierarchy Channel → Series → Episode;
- resolved immutable narrative snapshot;
- recurring cast dari Universe;
- guest character episode;
- multi-speaker script `audio_blocks`;
- satu voice casting per speaker/locale;
- provider capability registry untuk MiniMax dan Google Gemini TTS;
- TTS per block dengan strategy `segmented_turns` sebagai default lintas provider;
- MiniMax dialogue melalui satu T2A request per speaker turn;
- Google dialogue melalui satu TTS request per speaker turn;
- speaker-aware subtitles;
- reaction/cutaway/over-the-shoulder visual planning;
- review/regenerate per audio block;
- backward compatibility narration-only;
- multilingual contract.

### Tidak termasuk MVP

- automatic photorealistic lip-sync;
- overlapping dialogue;
- improvisational conversation generation during render;
- crowd dialogue dengan speaker tidak terbatas;
- real human actor voice cloning;
- live podcast/interview ingestion;
- automatic dubbing penuh ke banyak bahasa dalam satu production package.
- ketergantungan wajib pada native Google two-speaker synthesis;

Native Google two-speaker dialogue dapat diuji sebagai capability opsional setelah MVP segmented pipeline stabil, tetapi bukan acceptance dependency MVP.

### Rekomendasi MVP default

```text
Mode: hybrid_narration_dialogue
Narrator: chapter opening/closing
Dialogue ratio: 25–40%
Max speakers per scene: 2
Recurring speaking characters per episode: 2–4
Lip-sync: disabled
Visual grammar: reaction, profile, OTS, cutaway
TTS strategy: segmented_turns
MiniMax: one request per audio block
Google: one request per audio block; native two-speaker optional
```

---

## 22. Future Extensions

1. Selective lip-sync per approved close-up.
2. Multilingual dubbing dengan stable speaker identity.
3. Voice performance variants dan A/B review.
4. Interview/panel presets.
5. Character relationship memory linting lintas episode.
6. Dialogue originality and repetitiveness scoring.
7. Emotion-aware music/SFX orchestration.
8. Automatic visual shot-reverse-shot continuity validation.
9. Speaker-specific subtitle styling presets.
10. Cost estimator per speaker/block/provider.

---

## 23. Acceptance Criteria Tingkat Produk

1. User dapat menetapkan default narrative mode pada Channel Strategy.
2. Series dapat inherit atau override default dan menyimpan recurring cast/voice casting.
3. Episode dapat inherit atau override format sebelum Research dan memilih episode cast.
4. Resolver menghasilkan snapshot deterministik dengan provenance.
5. Research dan Blueprint memahami conflict, character knowledge, dan dialogue purpose.
6. Script dapat memuat narration serta dialogue blocks dengan speaker valid.
7. Narration-only script lama tetap dapat dibaca dan diproduksi.
8. Duration analysis menghitung voice profile serta pause per block.
9. TTS menghasilkan suara berbeda sesuai casting dan dapat direview per block.
10. Production Plan menghubungkan speaker/audio block ke visual beat.
11. Subtitle mengikuti speaker dan actual audio timing.
12. Perubahan cast/text/voice menginvalidasi hanya artifact yang bergantung.
13. UI tidak menjanjikan lip-sync ketika capability belum tersedia.
14. Seluruh konfigurasi, prompt, schema, dan UI contract mendukung multilingual.

---

## 24. Keputusan yang Dikunci oleh Blueprint

1. Series adalah pusat konfigurasi narrative format.
2. Channel Strategy menyediakan default dan policy inheritance.
3. Episode menyediakan Story Setup override sebelum Research.
4. Script schema menggunakan `audio_blocks`, bukan satu `voiceover` sebagai sumber kebenaran.
5. Speaker identity dipisahkan dari voice casting.
6. Universe character menjadi referensi visual karakter; Series/Episode memetakan karakter ke speaker dan suara.
7. MVP mendukung multi-speaker audio dan cinematic dialogue coverage tanpa full lip-sync.
8. KB lama YouTube Studio diperluas; tidak membuat KB type baru.
9. Semua tahap menyimpan resolved narrative/cast snapshot.
10. Human approval diperlukan untuk script dan multi-speaker VO sebelum produksi visual final.
11. MiniMax dialogue menggunakan orchestration per speaker turn karena endpoint T2A v2 yang digunakan hanya mengonfigurasi satu `voice_id` per request.
12. Google Gemini TTS dapat memakai native two-speaker dialogue, tetapi segmented turns tetap default agar revision, timing, dan fallback provider konsisten.

---

## 25. Recommended Delivery Sequence

```text
Stage A — Narrative Configuration Foundation
Channel defaults → Series format/cast → Episode Story Setup → resolver/snapshot

Stage B — Editorial Intelligence
Research character knowledge → Blueprint dialogue beats → Script audio_blocks

Stage C — Multi-Speaker Audio
Provider capability resolution → voice casting → segmented TTS per block
→ optional Google native two-speaker group → review → scene audio assembly → subtitles

Stage D — Speaker-Aware Visual Production
Visual beats → reaction/dialogue shot grammar → continuity → preview

Stage E — Advanced Capability
Selective lip-sync → multilingual dubbing → dialogue analytics
```

Implementation plan harus dibuat terpisah setelah blueprint ini disetujui agar migration, API, UI, worker, testing, dan deployment dapat dipecah menjadi tahapan yang aman dan dapat diverifikasi.
