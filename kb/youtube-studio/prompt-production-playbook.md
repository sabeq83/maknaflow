# YouTube Studio — Prompt Production Playbook

> KB Type: `prompt_production_playbook`  
> Scope: Channel atau Series  
> Status: Draft template  
> Version: 1.0  
> Depends on: `visual_continuity_guide`, `voice_audio_guide`, and Generation Profile  
> Last reviewed: _YYYY-MM-DD_

## 1. Purpose

Panduan ini menetapkan cara AI membuat, memvalidasi, dan meninjau prompt produksi untuk video long-form hybrid:

```text
T2I start frame → I2V visual continuity
T2V visual motion independent
Static asset / diagram / map
B-roll asset query
```

Prompt harus menghasilkan instruksi produksi yang spesifik, konsisten, aman, dan sesuai generation profile—bukan sekadar deskripsi visual yang puitis.

## 2. Prompt Package Contract

Setiap shot menerima salah satu `generation_mode` berikut:

| Mode | Digunakan ketika | Required output |
|---|---|---|
| `t2i_i2v` | Subject, lokasi, atau objek perlu konsisten | `t2i_prompt`, `i2v_prompt`, negative constraints, continuity tokens |
| `t2v` | Establishing, atmosfer, abstraksi, atau shot tanpa anchor spesifik | `t2v_prompt`, negative constraints, global style tokens |
| `static_asset` | Diagram, map, timeline, quotation card, archival still | `asset_spec` |
| `broll` | Footage/library asset yang tersedia atau dicari | `asset_query`, usage criteria |

### Required shared fields

```text
scene_index
shot_index
scene purpose
generation_mode
generation profile key (if provider generation)
target duration
aspect ratio
visual identity reference
continuity tokens
negative constraints
source/provenance requirement
```

## 3. Prompt Construction Order

Gunakan urutan berikut agar prompt mudah diinspeksi dan direvisi:

```text
1. Shot purpose
2. Subject or focal object
3. Action or visual event
4. Location / environment / time
5. Framing and camera perspective
6. Camera motion (for video)
7. Lighting, mood, texture, realism
8. Continuity tokens and reference constraints
9. Aspect ratio and composition constraint
10. Negative constraints
```

Jangan mencampur instruksi yang bertentangan, terlalu banyak subject utama, atau meminta perubahan tempat/waktu/subjek yang besar di satu visual clip pendek.

## 4. T2I Start-Frame Playbook

### When to use

Gunakan T2I saat shot membutuhkan anchor visual yang dapat direview sebelum I2V, terutama untuk:

- recurring character, narrator avatar, atau mascot;
- lokasi yang muncul berulang;
- objek/produk/simbol penting;
- adegan sejarah/rekonstruksi yang memerlukan kontrol komposisi;
- visual pembuka chapter yang menjadi referensi beberapa I2V shot.

### T2I prompt template

```text
[SHOT PURPOSE].
Focal subject: [canonical subject/object description].
Action/pose: [clear single moment].
Environment: [canonical location, era, atmosphere].
Composition: [wide/medium/close], [subject placement], 16:9 landscape.
Lighting and mood: [direction].
Visual style: [Visual Continuity Guide tokens].
Continuity: [character/location/reference asset tokens].
Avoid: [negative constraints].
```

### T2I review criteria

- Subject, location, era, and visual style match the guide.
- Composition gives I2V enough room for intended motion.
- Important text is not embedded in generated image unless explicitly required.
- No anatomy, identity, logo, cultural, or safety issue is visible.
- Frame is approved, regenerated, or manually replaced before I2V begins.

## 5. I2V Playbook

### When to use

Gunakan I2V hanya dengan start frame yang approved atau approved user-supplied reference.

### I2V prompt template

```text
Continue from the approved start frame.
Primary action: [one clear action or reveal].
Camera motion: [slow push-in / pan / orbit / static hold / tracking].
Preserve: [subject identity, wardrobe, object shape, location, lighting, composition anchor].
Do not introduce: [new subject/location/era/text/logo/change].
Mood and pacing: [direction].
Duration: [valid profile duration] seconds, 16:9 landscape.
```

### I2V rules

- Satu I2V clip fokus pada satu aksi/perubahan utama.
- Jangan menggunakan prompt yang mengubah atribut start frame yang wajib dipertahankan.
- Durasi harus valid terhadap Generation Profile.
- Bila VO membutuhkan durasi lebih panjang, buat beberapa I2V shot, bukan satu prompt yang terlalu kompleks.
- Jika start frame diganti, invalidate I2V yang bergantung padanya dan minta review ulang.

## 6. T2V Playbook

### When to use

Gunakan T2V untuk visual yang tidak membutuhkan start-frame continuity, misalnya:

- establishing shot;
- landscape/environmental atmosphere;
- visualisasi konsep abstrak;
- transisi waktu/tempat;
- motion texture atau insert yang tidak memuat subject berulang.

### T2V prompt template

```text
[SHOT PURPOSE].
Scene: [single clear environment/event].
Focal visual: [subject or phenomenon].
Camera framing and motion: [direction].
Lighting, mood, and visual style: [tokens].
Pacing: [calm / energetic / reflective].
16:9 landscape, [valid profile duration] seconds.
Avoid: [negative constraints].
```

### T2V rules

- Jangan gunakan T2V untuk recurring character/location yang membutuhkan anchor kuat bila T2I→I2V tersedia.
- Jangan meminta sequence multi-location atau multi-action dalam satu short clip.
- Prompt harus menyatakan framing dan motion, bukan hanya subjek.
- Durasi harus valid terhadap Generation Profile.

## 7. Static Asset Playbook

### Asset specification fields

```text
asset type: diagram | map | timeline | quote card | archival still | typography
editorial purpose
data/source reference
required labels and language
layout hierarchy
visual style tokens
accessibility text / VO support
rights/disclosure requirement
```

### Rules

- Map, diagram, dan timeline mengutamakan kejelasan sebelum dekorasi.
- Semua angka, nama, tanggal, dan quote mengikuti `research_source_policy`.
- Generated text di image tidak digunakan untuk informasi kritis; compose text secara deterministik saat assembly bila memungkinkan.
- Asset harus memiliki source/provenance atau ditandai sebagai ilustrasi/reconstruction.

## 8. B-roll Query Playbook

### Query template

```text
Subject: [what is visible]
Action: [what happens]
Environment: [place/time]
Shot type: [wide/medium/close/detail]
Mood: [tone]
Exclusions: [irrelevant/generic/unsafe material]
Rights requirement: [licensed / owned / approved source]
```

### Selection rules

- B-roll harus memperjelas VO, bukan sekadar mengisi durasi.
- Jangan gunakan footage yang menyesatkan secara waktu/tempat/subjek.
- Catat asset source, license/rights status, dan penggunaan dalam manifest.
- Jika B-roll tidak memenuhi continuity/rights requirement, ubah ke generated/static asset atau minta user asset.

## 9. Negative Constraints

### Global negative constraints

_Isi sesuai Channel Profile dan Visual Continuity Guide._

```text
No unreadable text, logos, watermarks, distorted anatomy, duplicate limbs,
unintended faces, incorrect era, inconsistent wardrobe, visual noise,
oversaturated colors, generic stock-video appearance.
```

### Shot-specific negative constraints

- Sertakan batasan yang hanya relevan pada shot tersebut.
- Jangan membuat daftar larangan yang panjang tetapi tidak relevan; gunakan constraint yang dapat dievaluasi reviewer.
- Jika constraint berkaitan dengan hak, keselamatan, atau individu nyata, tandai human review.

## 10. Prompt Review Checklist

Sebelum Prompt Package disetujui:

- [ ] Mode produksi sesuai fungsi visual.
- [ ] Prompt memiliki subject, action, environment, framing, style, dan negative constraints yang cukup.
- [ ] T2I/I2V dipakai untuk continuity-critical shot.
- [ ] I2V tidak bertentangan dengan start frame yang akan dipakai.
- [ ] T2V tidak memuat perubahan kompleks yang lebih cocok menjadi beberapa shot.
- [ ] Durasi generated shot valid terhadap Generation Profile.
- [ ] Static/B-roll asset memiliki requirement source/provenance.
- [ ] Prompt tidak memasukkan klaim visual yang bertentangan dengan Research/Visual Continuity Guide.

## 11. AI Context Summary

```text
Generation mode selection rules: [summary]
T2I prompt grammar: [summary]
I2V prompt grammar: [summary]
T2V prompt grammar: [summary]
Static/B-roll rules: [summary]
Continuity tokens: [summary]
Negative constraints: [summary]
Prompt review criteria: [summary]
```

## 12. Review and Activation Record

| Field | Value |
|---|---|
| Drafted by | _User / AI-assisted / operator_ |
| Reviewed by | _Nama atau user ID_ |
| Approved by | _Nama atau user ID_ |
| Activated at | _Timestamp_ |
| Supersedes version | _Versi sebelumnya atau —_ |
| Change summary | _Ringkasan perubahan_ |

