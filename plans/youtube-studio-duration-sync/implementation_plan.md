# Implementation Plan — YouTube Studio Narrative–TTS–Timeline Duration Sync

> Status: Planned  
> Target environment: Dev Mac Mini (`5020` UI, `7020` API, PostgreSQL schema `dev`)  
> Recovery target: episode `ytep_3suyq35q` / package `ytpp_qgzuu67x`  
> Production deployment: explicitly out of scope without direct user approval.

## 1. Objective

Membuat durasi naskah, hasil TTS aktual, dan timeline visual YouTube Studio konsisten tanpa memakai `voice_speed` sebagai kompensasi utama. Untuk konten anak, sistem harus menghasilkan kalimat pendek, edukatif, mudah dipahami, serta menyediakan jeda visual yang disengaja.

Alur target:

```text
Audience pacing profile + target duration
→ word/beat budget per scene
→ script generation + duration validation
→ TTS generation
→ ffprobe actual duration calibration
→ duration preflight
→ bounded correction or narration revision
→ timeline-preserving mux
→ ffprobe final output verification
```

## 2. Baseline Evidence

Episode `ytep_3suyq35q` memiliki kondisi berikut pada schema Dev:

| Metric | Nilai |
|---|---:|
| Target episode | 300 detik |
| Planned visual timeline | 302 detik |
| Script | 315 kata / 7 scene |
| TTS provider/persona/speed | Minimax / `Indonesian_casual_reporter_vv2` / `1.0x` |
| Total audio aktual | ±140,93 detik |
| Preview aktual | ±140,97 detik |
| Preview metadata saat ini | 302 detik |

Penyebab terukur:

1. Script hanya 315 kata untuk target lima menit. Pada hasil provider aktual, pembacaan berlangsung sekitar 134 kata/menit dan selesai dalam ±141 detik.
2. `lib/youtube-studio-render-adapter.js` mengirim literal `smart_sync` langsung ke `processVideoMuxing()`.
3. `processVideoMuxing()` tidak menyelesaikan literal itu menjadi strategi sinkronisasi dan selalu memakai `-shortest`; visual setiap scene terpotong mengikuti audio.
4. Metadata `durationSeconds` dihitung dari plan, bukan diukur dari file output, sehingga UI dapat melaporkan 302 detik untuk file 141 detik.

## 3. Product and Architecture Decisions

### 3.1 Recommendation 1 — Script duration budgeting

- Tambahkan `narration_profile` yang memuat audience type, target WPM, pause ratio, sentence length, dan density tolerance.
- Profile awal `kids_educational_id`:
  - target narration: 95–110 kata/menit;
  - 15–25% timeline boleh berupa jeda, dialog visual, SFX, atau reaction beat;
  - kalimat ideal 5–10 kata;
  - satu gagasan edukatif per kalimat;
  - pertanyaan interaktif dan repetition diperbolehkan;
  - CTA maksimal 10% dari total kata.
- Word budget dihitung server-side dari `target_duration_seconds`, target WPM, dan pause ratio.
- Budget dialokasikan per scene berdasarkan `estimated_duration_seconds`, bukan dibagi rata.
- Prompt generator menerima rentang kata per scene dan beat count, bukan hanya target detik.

### 3.2 Recommendation 2 — Pre-production validation

- Tambahkan duration analysis pada script draft dan approval.
- Approval diblok jika predicted narration coverage berada di luar tolerance keras, kecuali pengguna memberikan explicit override note.
- UI menampilkan target timeline, jumlah kata, predicted TTS duration, coverage, serta scene yang underfilled/overfilled.
- Tambahkan aksi `Auto-fit Narration` yang membuat script version baru; jangan menimpa versi approved secara diam-diam.

### 3.3 Recommendation 3 — Actual TTS calibration

- Setelah setiap file TTS selesai, jalankan `ffprobe` dan simpan `duration_seconds` pada `output_asset_json`.
- Simpan ringkasan kalibrasi package: total audio aktual, coverage timeline, scene gaps, dan timestamp.
- Keputusan final menggunakan durasi media aktual, bukan estimasi kata.
- Bila gap kecil, gunakan bounded audio tempo correction; bila gap besar, tandai `narration_revision_required`.
- Tidak boleh melakukan loop audio atau memperlambat suara secara ekstrem.

### 3.4 Recommendation 4 — Timeline-preserving mux

Kontrak mux YouTube Studio:

- Durasi output scene mengikuti planned visual timeline.
- Audio lebih pendek: pertahankan visual; pad audio dengan silence sampai akhir scene.
- Audio sedikit lebih panjang: koreksi tempo dalam batas aman atau extend visual secara terbatas.
- Audio jauh lebih panjang: hentikan assembly dengan error actionable; jangan memotong narasi.
- Audio jauh lebih pendek: assembly tetap boleh dibuat untuk review, tetapi tampilkan warning underfilled.
- `-shortest` tidak boleh memotong timeline YouTube Studio tanpa strategi eksplisit.
- Durasi preview/final selalu diambil dari `ffprobe` file hasil render.

### 3.5 Recommendation 5 — Voice speed as style, not fitting

- `voice_speed` tetap menjadi pilihan kreatif pengguna.
- Tambahkan batas profile, misalnya kids `0.85x–1.10x`.
- Duration fitting hanya boleh mengaplikasikan correction kecil terpisah, misalnya effective tempo `0.92–1.08`, dan nilai tersebut dicatat di metadata.
- Jika kebutuhan correction melewati batas, sistem meminta revisi naskah/timeline.
- UI membedakan `Selected voice speed` dan `Estimated duration correction`.

## 4. Duration Contract

```js
{
  profile_key: 'kids_educational_id',
  target_timeline_seconds: 300,
  target_wpm: 102,
  pause_ratio: 0.20,
  target_word_range: { min: 408, ideal: 435, max: 462 },
  predicted_narration_seconds: 256,
  actual_narration_seconds: 251.4,
  coverage_ratio: 0.838,
  correction_factor: 1.018,
  status: 'ready' // draft_warning | revision_required | ready
}
```

Formula awal:

```text
narrated_seconds = target_timeline_seconds × (1 - pause_ratio)
ideal_words = narrated_seconds × target_wpm / 60
coverage_ratio = actual_audio_seconds / target_timeline_seconds
```

Angka merupakan default profile, bukan konstanta tersebar di UI atau prompt.

## 5. Data Migration

Tambahkan secara idempotent:

```sql
ALTER TABLE youtube_episodes
  ADD COLUMN IF NOT EXISTS narration_profile_key TEXT DEFAULT 'general_id';

ALTER TABLE youtube_production_packages
  ADD COLUMN IF NOT EXISTS duration_analysis_json JSONB;
```

Durasi per asset disimpan dalam `youtube_production_assets.output_asset_json.duration_seconds` agar tidak membutuhkan migrasi kolom baru. Record legacy tetap valid dan dianalisis saat TTS berikutnya dibuat.

## 6. Planned File Changes with Before/After Snippets

### 6.1 `lib/youtube-studio-narration-profiles.js` — new

**Code Sebelum (Current/Before)**

```js
// Belum ada registry pacing dan word-budget berdasarkan audience.
```

**Code Sesudah (Proposed/After)**

```js
const profiles = {
  kids_educational_id: {
    targetWpm: 102,
    pauseRatio: 0.20,
    sentenceWords: { min: 5, max: 10 },
    voiceSpeed: { min: 0.85, max: 1.10 },
    tempoCorrection: { min: 0.92, max: 1.08 }
  }
};

export function getNarrationProfile(key) { /* authoritative lookup */ }
export function calculateNarrationBudget({ targetSeconds, profile }) { /* word range */ }
export function allocateSceneBudgets({ scenes, budget }) { /* weighted allocation */ }
```

### 6.2 `lib/youtube-studio-planner.js`

**Code Sebelum (Current/Before)**

```js
Ketentuan naskah:
- voiceover harus natural, siap dibaca oleh voice-over talent / TTS.
- Jumlah durasi scenes harus mendekati target durasi total.
```

**Code Sesudah (Proposed/After)**

```js
const narrationBudget = calculateNarrationBudget({
  targetSeconds: episode.target_duration_seconds,
  profile: narrationProfile
});

// Prompt includes per-scene word range, short-sentence rules,
// educational beats, pause beats, and CTA word ceiling.
```

Generator harus menghasilkan `narration_beats` per scene agar kalimat pendek tidak berubah menjadi satu paragraf panjang.

### 6.3 `lib/youtube-studio-contract.js`

**Code Sebelum (Current/Before)**

```js
export function validateSceneScript(script, blueprint, targetDuration) {
  // validates structural fields and estimated durations
}
```

**Code Sesudah (Proposed/After)**

```js
export function analyzeNarrationDuration({ script, targetSeconds, profile }) {
  return { wordCount, predictedSeconds, coverageRatio, sceneAnalysis, status };
}

export function assertNarrationApprovable(analysis, { allowOverride = false }) {
  // hard failure for severe underfill/overfill unless audited override exists
}
```

### 6.4 `lib/youtube-studio-repository.js`

**Code Sebelum (Current/Before)**

```js
export async function approveScript(id, actor, reviewNote = null) {
  // directly approves and transitions the episode
}
```

**Code Sesudah (Proposed/After)**

```js
export async function approveScript(id, actor, reviewNote = null, options = {}) {
  const analysis = analyzeNarrationDuration(/* approved candidate */);
  assertNarrationApprovable(analysis, options);
  // persist analysis snapshot, approve, then transition
}
```

Tambahkan pembuatan script version baru untuk hasil Auto-fit. Jangan update `script_json` approved secara in-place.

### 6.5 `app/api/v2/youtube-studio/scripts/[id]/approve/route.js`

**Code Sebelum (Current/Before)**

```js
const result = await approveScript(id, user, body.review_note || null);
```

**Code Sesudah (Proposed/After)**

```js
const result = await approveScript(id, user, body.review_note || null, {
  allowDurationOverride: body.allow_duration_override === true,
  overrideReason: body.duration_override_reason
});
```

Override wajib memiliki reason, actor, dan analysis snapshot.

### 6.6 `app/api/v2/youtube-studio/scripts/[id]/duration-analysis/route.js` — new

**Code Sebelum (Current/Before)**

```js
// Endpoint analisis durasi script belum tersedia.
```

**Code Sesudah (Proposed/After)**

```js
export const GET = withYouTubeStudioAccess('read', async (req, { params }) => {
  return Response.json({ success: true, data: await analyzeScriptById((await params).id) });
});
```

Tambahkan `POST .../auto-fit` terpisah atau sibling route yang menghasilkan version baru dengan idempotency key.

### 6.7 `lib/youtube-studio-production-worker.js`

**Code Sebelum (Current/Before)**

```js
const voiceRes = await generateVoiceSegment({ /* provider, persona, speed */ });
outputAssetJson = {
  audio_path: `temp/${filename}`,
  size_bytes: voiceRes.size_bytes
};
```

**Code Sesudah (Proposed/After)**

```js
const durationSeconds = await getMediaDuration(outputPath);
outputAssetJson = {
  audio_path: `temp/${filename}`,
  size_bytes: voiceRes.size_bytes,
  duration_seconds: durationSeconds,
  selected_voice_speed: Number(episode.voice_speed ?? 1)
};

await refreshPackageDurationAnalysis(pkg.id);
```

### 6.8 `lib/youtube-studio-render-adapter.js`

**Code Sebelum (Current/Before)**

```js
await processVideoMuxing({
  videoPath: JSON.stringify(segmentVideoPaths),
  audioPath: segmentAudioPath,
  syncOption: 'smart_sync',
  outputPath: tempClipPath
});

return { durationSeconds: currentTime };
```

**Code Sesudah (Proposed/After)**

```js
await processYouTubeTimelineMux({
  videoPaths: segmentVideoPaths,
  audioPath: segmentAudioPath,
  plannedDurationSeconds: scene.duration,
  durationPolicy: 'preserve_timeline',
  outputPath: tempClipPath
});

const durationSeconds = await getMediaDuration(finalVideoPath);
return { durationSeconds, plannedDurationSeconds: currentTime };
```

Jangan meneruskan literal `smart_sync` ke muxer generik.

### 6.9 `lib/video-studio-processor.js`

**Code Sebelum (Current/Before)**

```js
command.outputOptions([
  // ...
  '-shortest'
]);
```

**Code Sesudah (Proposed/After)**

```js
export async function processYouTubeTimelineMux(config) {
  // video shorter: bounded extension/loop policy
  // audio shorter: apad silence to planned duration
  // audio slightly longer: bounded atempo correction
  // large mismatch: throw DurationMismatchError
  // output duration is explicitly plannedDurationSeconds
}
```

Pertahankan perilaku muxer generik untuk consumer lain; implementasikan policy YouTube sebagai fungsi terpisah agar tidak menimbulkan regresi lintas menu.

### 6.10 `app/youtube-studio/components/EpisodeWorkspace.js`

**Code Sebelum (Current/Before)**

```jsx
<label>TTS Voice Speed ({voiceSpeed}x)</label>
```

**Code Sesudah (Proposed/After)**

```jsx
<DurationHealthCard
  targetSeconds={analysis.targetTimelineSeconds}
  predictedSeconds={analysis.predictedNarrationSeconds}
  actualSeconds={analysis.actualNarrationSeconds}
  coverageRatio={analysis.coverageRatio}
/>
<label>Selected Voice Style Speed ({voiceSpeed}x)</label>
```

Tampilkan warning sebelum Regenerate TTS/Assembly dan tombol Auto-fit hanya pada Scene Plan/Script Review.

### 6.11 `lib/db-pg.js`

**Code Sebelum (Current/Before)**

```js
// youtube_episodes belum memiliki narration_profile_key.
// youtube_production_packages belum memiliki duration_analysis_json.
```

**Code Sesudah (Proposed/After)**

```js
await migrateYouTubeNarrationDurationSync(client); // advisory lock + idempotent ALTER
```

### 6.12 Tests — new and updated

**Code Sebelum (Current/Before)**

```js
// Belum ada coverage untuk word budget, actual TTS duration, atau timeline-preserving mux.
```

**Code Sesudah (Proposed/After)**

```js
test('kids profile allocates bounded per-scene word budgets', () => {});
test('severe underfill blocks approval without audited override', () => {});
test('short audio is padded without shortening the visual timeline', async () => {});
test('preview duration is measured from output media', async () => {});
test('large mismatch requests narration revision', async () => {});
```

Target files:

- `test/youtube-studio-narration-budget.test.js`
- `test/youtube-studio-duration-contract.test.js`
- `test/youtube-studio-timeline-mux.test.js`
- existing YouTube Studio API/UI smoke tests as applicable.

## 7. Episode Recovery Plan — `ytep_3suyq35q`

Recovery dilakukan setelah code fix terdeploy ke Dev.

### 7.1 Backup and audit

1. Export episode, latest approved script, package, assets, TTS job history, dan preview metadata ke JSON di folder diagnostic non-versioned.
2. Catat checksum script version dan file preview lama.
3. Jangan menghapus visual clips yang sudah berhasil.

### 7.2 Select narration profile

Set `narration_profile_key = 'kids_educational_id'` melalui repository/service tenant-scoped, bukan SQL manual jika endpoint recovery sudah tersedia.

### 7.3 Rewrite as a new script version

Gunakan visual timeline yang sudah ada. Target awal:

| Scene | Timeline | Target kata | Direction |
|---|---:|---:|---|
| 1 | 30s | 45–50 | Hook sederhana + pertanyaan |
| 2 | 46s | 65–75 | Risiko mainan berantakan, bahasa anak |
| 3 | 40s | 55–65 | Rencana merapikan dalam langkah kecil |
| 4 | 50s | 70–80 | Aksi karakter + counting/repetition |
| 5 | 50s | 70–80 | Pelajaran kategorisasi mainan |
| 6 | 46s | 65–75 | Kebersihan dan kerja sama |
| 7 | 40s | 50–60 | Resolusi + recap + CTA singkat |

Total awal: 420–485 kata. Kalibrasi aktual menentukan apakah perlu satu iterasi lagi. Jangan memaksa 100% timeline berisi suara; sisakan reaction beat dan SFX yang disengaja.

### 7.4 Regenerate and calibrate

1. Approve script version baru setelah duration analysis lulus.
2. Simpan pilihan Minimax persona atau persona baru yang disetujui pengguna.
3. Gunakan speed kreatif `0.9x–1.0x` sebagai starting point.
4. Regenerate semua TTS.
5. Tunggu seluruh voice asset `completed`, kemudian ukur setiap file.
6. Target coverage awal: 75–90% per scene; gap tersisa merupakan intentional pause.
7. Bila scene di luar tolerance, revisi hanya scene tersebut dan buat version/audit baru.

### 7.5 Reassemble and verify

1. Trigger assembly satu kali.
2. Verifikasi output dengan `ffprobe`: target 300–302 detik, tolerance maksimum ±1 detik dari planned timeline.
3. Pastikan audio tidak terpotong, visual tidak dipangkas ke ±141 detik, dan silence hanya berada pada gap yang direncanakan.
4. Pastikan UI berpindah ke Assemble & Review dan menampilkan actual duration.
5. Pertahankan preview lama sampai preview baru lulus QA; setelah itu archive reference lama secara recoverable.

## 8. API and UI Acceptance Criteria

- Script 315 kata untuk target 300 detik ditandai severe underfill sebelum approval.
- Profile anak menghasilkan kalimat pendek dan budget kata per scene.
- Save voice speed/persona tetap bekerja dan Regenerate TTS memakai setting terbaru.
- Setiap TTS asset memiliki `duration_seconds` hasil probe.
- Assembly tidak memotong timeline ketika audio lebih pendek.
- Mismatch besar menghasilkan error actionable, bukan silent stretch ekstrem.
- Preview metadata sama dengan durasi file aktual dalam tolerance 0,5 detik.
- UI menampilkan planned, predicted, actual, coverage, dan correction secara berbeda.
- Auto-fit menghasilkan script version baru dengan audit trail.
- Semua query dan mutation tenant-scoped.

## 9. Test and Verification Matrix

1. Unit: budget formula dan scene allocation.
2. Unit: kids sentence/CTA constraints dan approval thresholds.
3. Unit: tempo correction bounds.
4. Integration: TTS completion menyimpan actual duration.
5. Integration: audio 20s + visual 40s menghasilkan output 40s.
6. Integration: audio 41s + visual 40s memakai bounded correction.
7. Integration: audio 70s + visual 40s gagal dengan `narration_revision_required`.
8. Regression: muxer generic Video Studio tidak berubah perilakunya.
9. API: duration analysis, Auto-fit idempotency, approval override audit.
10. Dev smoke: episode recovery lengkap dan file preview diprobe.
11. `npm run build` dan test suite relevan harus exit 0; warning existing dicatat terpisah.

## 10. Rollout and Rollback

- Gunakan feature flag `youtube_narration_duration_sync` untuk UI/approval guard jika diperlukan.
- Deploy Dev dahulu; jangan mutasi episode sebelum migration dan tests lulus.
- Recovery episode memakai new script version dan new TTS jobs sehingga dapat diaudit.
- Rollback code tidak menghapus kolom JSON baru.
- Bila assembly baru gagal, kembalikan pointer preview ke asset lama; jangan menghapus file lama selama verifikasi.
- Production deployment membutuhkan perintah manual eksplisit pengguna.

## 11. Execution Task List

- [ ] Audit seluruh consumer `processVideoMuxing()` dan pastikan perubahan YouTube tidak mengubah workflow lain.
- [ ] Implement narration profile registry dan unit tests.
- [ ] Implement word/beat budgeting pada script prompt dan duration contract.
- [ ] Tambahkan analysis endpoint, approval guard, audited override, dan Auto-fit versioning.
- [ ] Tambahkan migration `narration_profile_key` dan `duration_analysis_json` secara idempotent.
- [ ] Simpan actual TTS duration hasil ffprobe dan refresh package analysis.
- [ ] Implement YouTube-specific timeline-preserving mux tanpa silent truncation.
- [ ] Ukur final preview duration dari file output, bukan plan.
- [ ] Tambahkan Duration Health UI dan bedakan creative speed dari correction factor.
- [ ] Jalankan unit, integration, regression, build, dan Dev smoke tests.
- [ ] Backup episode `ytep_3suyq35q` dan aset terkait sebelum recovery.
- [ ] Buat script version anak-anak yang baru dengan budget per scene.
- [ ] Regenerate TTS, ukur actual duration, dan revisi scene outlier bila perlu.
- [ ] Reassemble episode dan verifikasi preview 300–302 detik serta audio lengkap.
- [ ] Perbarui checklist ini secara real-time beserta bukti test/deploy.
- [ ] Jalankan release patch, verifikasi commit/tag/push, dan laporkan hasil; jangan deploy production.

## 12. Definition of Done

- Kelima rekomendasi telah diimplementasikan dan diuji.
- Episode recovery menghasilkan preview yang durasinya mengikuti timeline dan narasinya sesuai profile anak.
- Tidak ada pemotongan visual tersembunyi oleh `-shortest`.
- Tidak ada speed/stretch ekstrem untuk menutupi naskah yang salah ukuran.
- Actual duration tersimpan dan terlihat di UI.
- Test/build/Dev smoke lulus.
- Checklist, changelog, version, commit, tag, dan push telah selesai sesuai SOP.

