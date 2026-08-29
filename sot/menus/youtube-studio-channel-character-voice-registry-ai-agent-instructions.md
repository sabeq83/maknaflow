# AI Agent Instruction — Implement YouTube Studio Channel Audio Mode, Character & Voice Registry

## Mission

Implementasikan seluruh rencana berikut sampai tuntas dalam satu continuous execution:

`sot/menus/youtube-studio-channel-character-voice-registry-implementation-plan.md`

Jangan berhenti setelah satu workstream dan jangan meminta prompt baru untuk melanjutkan tahap berikutnya. Berhenti hanya jika terdapat blocker nyata yang tidak dapat diselesaikan secara aman dari repository dan environment yang tersedia.

## Mandatory Product Outcome

Perbaiki multi-speaker YouTube Studio sehingga:

1. Channel menyediakan tepat dua Audio Production Mode: `standalone_tts` dan `native_scene_audio`.
2. Pada `standalone_tts`, provider/model MiniMax atau Google TTS dipindahkan dari Episode ke Channel dan seluruh spoken audio dibuat oleh TTS.
3. Pada `native_scene_audio`, standalone TTS sepenuhnya disabled dan Google Flow via G-Labs membuat narration/dialogue/ambience bersama video.
4. Setiap karakter/narrator mempunyai provider-neutral Voice Identity Profile di Channel.
5. TTS persona, speed, delivery, dan pronunciation ditetapkan per karakter di Channel sebagai TTS binding.
6. Google Flow voice reference/ingredient atau descriptive voice prompt ditetapkan per karakter sebagai binding terpisah.
7. Jangan memperlakukan nama persona Google TTS (`Orus`, `Kore`, dan sejenisnya) sebagai Google Flow voice reference kecuali ada mapping eksplisit yang dibuktikan adapter.
8. Series hanya memilih recurring cast dari Channel Registry.
9. Episode hanya memilih subset cast yang eligible dari Series.
10. AI dilarang dan secara backend tidak mampu menciptakan speaker di luar registry.
11. Narrator wajib menjadi entry eksplisit; jangan auto-create narrator.
12. Hapus hash/random/default persona fallback dari pipeline baru.
13. Approved Script/Production Package menyimpan immutable audio-mode + casting snapshot.
14. Production selalu memakai snapshot, bukan live settings Channel atau legacy Episode fields.
15. Kedua production branch mutually exclusive; native mode tidak boleh diam-diam membuat TTS fallback.
16. Episode lama tetap kompatibel melalui explicit legacy adapter.
17. Tambahkan Audio Experience Profile terpisah: `narrative_dialogue`, `spoken_asmr`, `no_talking_asmr`, dan `mixed_asmr`.
18. Tambahkan Channel Sonic Identity untuk microphone perspective, spatial behavior, trigger palette, forbidden sounds, noise floor, pacing, dan mastering defaults.
19. ASMR bukan production mode ketiga; gunakan compatibility matrix dengan dua Audio Production Mode yang sudah dikunci.

## First Actions — Required

1. Baca `AGENTS.md` sepenuhnya.
2. Baca implementation plan sepenuhnya.
3. Karena project memakai versi Next.js dengan breaking changes, baca dokumentasi relevan di `node_modules/next/dist/docs/` sebelum mengubah route, server/client component, caching, atau request APIs.
4. Audit ulang implementasi Stage A–E dan seluruh penggunaan berikut:

```text
voice_provider
voice_persona
voice_speed
audio_production_mode
audio_prompt
audio_experience
sonic_identity
sound_event
whisper
silence
voice_reference
getSpeakerVoice
speaker_manifest
audio_blocks
recurring_cast
episode_cast
context_snapshot_json
```

5. Audit kontrak aktual G-Labs pada MAKNA Flow dan Windows Worker: payload request, model, I2V/Ingredients, embedded audio, voice reference, output audio stream, errors, retries, dan task metadata.
6. Jangan menyimpulkan kemampuan API dari kemampuan Google Flow web UI. Catat apakah integrasi aktual mendukung `voice_reference` atau hanya descriptive prompt.
7. Periksa worktree. Jangan menimpa perubahan user yang tidak terkait.
8. Jalankan baseline test/build yang relevan dan catat hasilnya.
9. Jika file aktual berbeda dari plan, perbarui seksi file impact dan Before/After pada plan sebelum menulis kode.

## Implementation Rules

### Database and migration

- Gunakan migration PostgreSQL idempotent mengikuti pola repository.
- Semua table/index/query harus tenant-scoped.
- Gunakan transaction untuk activation Channel Audio config dan replacement cast bindings.
- Jangan drop kolom `youtube_episodes.voice_provider`, `voice_persona`, atau `voice_speed` pada perubahan ini; tandai sebagai legacy-only.
- Karakter yang pernah dipakai harus `retired`, bukan hard-delete.
- Jangan menyimpan API key/provider credential pada database snapshot, response, atau log.

### Channel audio-mode behavior

- Channel memiliki satu konfigurasi Audio Production aktif per locale.
- `standalone_tts` hanya memakai MiniMax atau Google TTS sesuai adapter aktual MAKNA Flow.
- `native_scene_audio` hanya memakai G-Labs/Google Flow model yang terbukti menghasilkan embedded audio.
- Audio Experience terpisah dari production mode dan ikut versioning/snapshot Channel.
- Voice Identity netral-provider wajib untuk semua speaker.
- TTS persona per speaker divalidasi terhadap TTS provider + locale aktif.
- Flow binding per speaker memakai voice reference bila capability aktual mendukungnya; selain itu gunakan descriptive prompt dan label `experimental_prompt_guided`.
- Perubahan mode/provider membuat draft baru dan mewajibkan binding lengkap sebelum activation.
- Jangan mengganti konfigurasi aktif secara parsial.
- Sediakan voice preview/reference validation bila adapter mendukungnya; kegagalan tidak boleh membocorkan credential.

Compatibility wajib:

```text
narrative_dialogue → standalone_tts atau native_scene_audio
spoken_asmr → native_scene_audio recommended; standalone_tts hanya jika whisper capability terbukti
no_talking_asmr → native_scene_audio only; narrator/spoken blocks forbidden
mixed_asmr → native_scene_audio only; whisper/spoken + sound event required
```

### Cast hierarchy

Enforce hierarchy berikut di database/service, bukan hanya UI:

```text
Channel active speakers
⊇ Series recurring cast
⊇ Episode cast
⊇ Script speaker manifest/audio blocks
```

- Tolak cross-channel, cross-series, retired, atau unknown speaker.
- Jangan menerima free-text speaker ID pada Series/Episode API baru.
- Universe binding wajib bagi karakter yang harus tampil secara visual; narrator boleh tanpa binding.

### AI enforcement

- Kirim allowed speaker objects dan IDs secara eksplisit ke Research, Blueprint, dan Script.
- Hapus nama contoh karakter hard-coded dari prompt; contoh harus dibangun dari roster aktual atau placeholder schema-safe.
- Validator harus memeriksa manifest, audio blocks, dialogue beats, present characters, speaker focus, listener/reaction references, dan seluruh field speaker-aware lain.
- Unknown speaker: reject dengan error code terstruktur, boleh satu bounded regeneration attempt, lalu fail closed.
- Jangan pernah memperbaiki unknown speaker dengan membuat mapping/persona otomatis.

### Immutable snapshot

- Buat snapshot yang menyimpan Channel Audio config/mode version dan voice binding version setiap speaker.
- Snapshot harus masuk ke approved artifact/Production Package sebelum voice jobs dibuat.
- Idempotency voice asset harus memasukkan audio block, script version, dan casting version.
- Regenerate asset dari package lama harus tetap memakai snapshot lama walaupun Channel telah di-recast.

### Standalone TTS branch

```text
Approved Script → Start Frame → TTS Generation → Voice Review
→ Visual Generation → External-audio Assembly
```

- Generate satu durable TTS asset/job per audio block sesuai strategi yang sudah ditetapkan.
- Provider, persona, speed, dan pronunciation hanya dibaca dari snapshot.
- Pertahankan regenerate/review per block dan subtitle timing dari actual TTS duration.

### Native Scene Audio branch

```text
Approved Script → Start Frame → Audio-aware Prompt Review
→ G-Labs Audiovisual Generation → Audiovisual Review
→ Embedded-audio Assembly
```

- Jangan membuat voiceover/TTS batch, standalone voice assets, atau TTS jobs.
- Buat `audio_prompt` terstruktur yang membawa exact approved dialogue per audio block, speaker ID, delivery, ambience, dan SFX.
- Adapter mengompilasi visual + motion + audio contract ke payload G-Labs aktual.
- Voice reference hanya dikirim jika capability aktual membuktikannya; jangan invent request field yang tidak didukung.
- Validasi hasil memiliki audio stream yang dapat diputar.
- Jalankan ASR/forced alignment untuk subtitle timing hasil native audio.
- Assembly mempertahankan embedded dialogue, melakukan loudness normalization/crossfade seperlunya, dan tidak menimpanya dengan external TTS.
- Regenerate dialog berarti regenerate audiovisual clip terkait.
- Enforce dialogue-duration fit terhadap 4/6/8/10 detik sesuai generation profile/model capability.

### ASMR and Sonic Identity

- Implementasikan first-class block types: `whisper`, `breath`, `sound_event`, `ambience`, dan `silence`, selain narration/dialogue.
- `silence` adalah intentional timed block; jangan otomatis mengisinya dengan dialog, musik, ambience tambahan, atau SFX.
- `no_talking_asmr` menolak narration/dialogue/whisper dan tidak mewajibkan narrator.
- `spoken_asmr` mewajibkan whisper-capable Voice Identity/binding.
- `mixed_asmr` mewajibkan minimal satu spoken/whisper block dan satu sound event.
- Simpan Sonic Identity tervalidasi dan versioned pada Channel, lalu snapshot ke approved artifact/package.
- Flow Prompt Compiler harus mengubah Sonic Identity dan sound-event timeline menjadi natural-language Google Flow prompt: microphone perspective, stereo/spatial movement, trigger texture, ambience, micro-dynamics, dan negative audio constraints.
- Untuk No-Talking ASMR, compiled prompt harus eksplisit: no narration, no dialogue, no music, no additional sound sources sesuai policy Channel.
- Assembly harus mempertahankan micro-dynamics; jangan menerapkan compression/loudness universal yang menghapus detail ASMR.

### UI

- Pertahankan pola satu kolom vertikal YouTube Studio.
- Channel Settings memuat Audio Production Mode, mode-specific configuration, Character & Voice Registry, dan strict AI policy.
- Channel Settings memuat Audio Experience Profile dan Sonic Identity.
- Tampilkan dua pilihan: `Standalone Voice Track — TTS` dan `Native Scene Audio — Google Flow via G-Labs`.
- Untuk native mode, tampilkan tingkat konsistensi `Flow voice reference` atau `Experimental prompt-guided` berdasarkan capability riil.
- Series dan Episode memakai selector dari eligible registry, bukan input bebas.
- Hapus TTS provider/persona/speed dan audio-mode editor dari Episode Generation Profile dan request payload-nya.
- Episode menampilkan Voice Casting + Audio Production Mode Summary read-only.
- Episode juga menampilkan Audio Experience + Sonic Identity snapshot summary read-only.
- Gunakan CSS Modules dan token theme semantik MAKNA Flow yang memang sudah ada.
- Dilarang menambah warna hard-coded, inline styles, atau token fiktif.
- Semua state wajib memiliki loading, empty, error, disabled, validation, dan success feedback yang jelas.

### Compatibility

- Jangan destructive-rewrite approved Script atau active Production Package.
- Legacy narration-only episode boleh dinormalisasi menjadi explicit narrator + `standalone_tts` snapshot.
- Konflik persona legacy harus masuk migration report `requires_manual_resolution`; jangan memilih persona berdasarkan tebakan mayoritas tanpa terlihat oleh user.
- Episode baru wajib melalui Channel Registry.

## Execution Control

Gunakan seksi `## Execution Task List` pada implementation plan sebagai source of truth pekerjaan.

Setelah setiap task selesai:

1. segera ubah checkbox terkait dari `[ ]` menjadi `[x]`;
2. jangan menandai task selesai sebelum bukti verifikasi tersedia;
3. jika scope/file berubah, update plan dan Before/After snippets;
4. lanjutkan ke task berikutnya tanpa menunggu instruksi user.

## Verification Gates

Minimal jalankan dan buktikan:

- unit tests contract/capability;
- repository and tenant-isolation tests;
- resolver precedence and strict roster tests;
- planner prompt/output validation tests;
- production immutable snapshot tests;
- G-Labs native-audio capability and prompt contract tests;
- embedded audio stream, subtitle alignment, and assembly routing tests;
- ASMR experience matrix, Sonic Identity, sound-event, whisper, and intentional-silence tests;
- legacy compatibility tests;
- relevant API/component tests;
- lint;
- production build.

Tambahkan regression assertions berikut:

```text
unknown AI speaker → rejected
missing persona → production blocked
provider switch with incomplete recast → activation blocked
mode switch with incomplete bindings → activation blocked
Series speaker outside Channel → rejected
Episode speaker outside Series → rejected
Channel persona changed after approval → old package unchanged
native scene audio → no TTS jobs created
native audio prompt dialogue → exact match with approved Script
native output without audio stream → review blocked
Google TTS persona without explicit mapping → never used as Flow reference
no-talking ASMR with speech → rejected
spoken ASMR without whisper-capable voice → activation blocked
mixed ASMR without sound event → rejected
intentional silence → preserved through prompt and production
Sonic Identity change after approval → old package unchanged
legacy narration-only episode → still producible
```

## Deployment and API Smoke Test

Deployment hanya ke server Dev Mac Mini:

```bash
npm run deploy:macmini-dev
```

Target:

```text
SSH: masbenu@100.95.245.55
Directory: ~/maknaflow-dev
UI: 5020
API: 7020
DB schema: dev
PM2: ecosystem.macmini.config.cjs --env dev
```

Dilarang deploy ke Staging atau Production. Jangan menjalankan SSH polling loop. Tunggu remote build dengan interval sesuai SOP, lalu lakukan satu health verification.

Smoke test harus menggunakan API dan membuktikan kedua branch:

1. Channel Audio config dapat dibuat dan diaktifkan.
2. Narrator dan minimal dua karakter mempunyai Voice Identity dan binding berbeda.
3. Series/Episode binding menerima karakter valid dan menolak karakter liar.
4. Research → Blueprint → Script hanya menghasilkan registered speakers.
5. `standalone_tts`: Start Production membuat voice jobs dengan persona sesuai snapshot.
6. Setelah live Channel persona diubah, regenerate package TTS lama tetap memakai persona snapshot lama.
7. `native_scene_audio`: Start Production tidak membuat TTS job dan mengirim audio-aware I2V prompt ke G-Labs.
8. Output native mempunyai embedded audio; narration/dialogue berasal dari registered speakers.
9. Jika G-Labs hanya mendukung descriptive prompt, UI/API melaporkan experimental prompt-guided secara jujur.
10. Perubahan live Channel mode/binding tidak memutasi package native yang telah approved.
11. `no_talking_asmr` menghasilkan sound-event timeline tanpa narrator dan compiled prompt membawa negative spoken-audio constraints.
12. `spoken_asmr` memakai whisper-capable registered speaker.
13. `mixed_asmr` menghasilkan whisper/spoken dan sound event dalam clip yang valid.
14. Intentional silence dan Sonic Identity terbukti masuk snapshot/prompt serta tidak hilang saat assembly.

Jangan menampilkan password, token, cookie, API key, atau credential dalam dokumentasi/log hasil.

## Release and Git Sync

Setelah seluruh gate berhasil:

1. review diff dan pastikan perubahan user yang tidak terkait tetap utuh;
2. perbarui changelog/version sesuai SOP repository;
3. jalankan release non-interaktif patch dengan judul dan poin yang akurat;
4. verifikasi commit, tag, branch `main`, dan remote sync;
5. jangan melakukan Production deployment.

## Final Report

Laporkan secara ringkas tetapi berbukti:

- perubahan schema dan migration;
- API/contract baru;
- lokasi Audio Production Mode, TTS provider/persona, Voice Identity, dan Flow binding setelah perubahan;
- enforcement AI speaker registry;
- strategi legacy compatibility;
- immutable audio-mode/casting snapshot behavior;
- hasil capability audit G-Labs dan apakah voice consistency reference-based atau prompt-guided;
- bukti kedua production branch dan embedded audio validation;
- bukti Audio Experience/Sonic Identity serta smoke test Spoken, No-Talking, dan Mixed ASMR;
- test/lint/build results;
- API smoke episode/package IDs dan assertion hasil tanpa credential;
- deployment Dev dan PM2 health;
- release commit/tag;
- konfirmasi bahwa Staging dan Production tidak disentuh.

Jangan menyatakan selesai apabila salah satu Definition of Done atau verification gate masih gagal.
