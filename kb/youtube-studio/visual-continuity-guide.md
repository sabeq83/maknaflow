# YouTube Studio — Visual Continuity Guide

> KB Type: `visual_continuity_guide`  
> Scope: Channel atau Series  
> Status: Draft template  
> Version: 1.0  
> AI context language: English  
> Parent Visual Identity: _Tautkan preset aktif bila tersedia_  
> Aspect ratio default: `16:9`  
> Last reviewed: _YYYY-MM-DD_

## 1. Purpose

Panduan ini menjaga konsistensi visual long-form ketika satu episode terdiri dari banyak shot dan diproduksi melalui kombinasi T2I→I2V, T2V, B-roll, map, diagram, text overlay, dan arsip.

Panduan ini tidak menggantikan Visual Identity Studio. Ia menerjemahkan identitas visual menjadi aturan produksi yang dapat digunakan AI dan reviewer per episode/shot.

## 2. Visual Identity Summary

| Area | Definition |
|---|---|
| Core visual style | _Contoh: cinematic documentary, editorial illustration, clean explainer_ |
| Primary mood | _Contoh: curious, reflective, authoritative, warm_ |
| Colour direction | _Palet/kontras/saturation yang diinginkan_ |
| Lighting direction | _Contoh: natural soft daylight, dramatic warm key light_ |
| Texture/material | _Contoh: archival paper, polished 3D, realistic film grain_ |
| Realism level | _Photorealistic / stylized / illustration / mixed_ |
| Forbidden aesthetic | _Contoh: plastic CGI, oversaturated neon, generic stock look_ |

## 3. Subject Continuity

### Recurring characters, people, or mascots

| Subject ID | Canonical description | Immutable attributes | Allowed variation | Reference asset |
|---|---|---|---|---|
| _character_01_ | _Penampilan, usia, pose/energy, role_ | _Ciri yang tidak boleh berubah_ | _Wardrobe/action yang boleh berubah_ | _Asset/preset ID_ |

### Objects and symbols

| Object ID | Meaning | Canonical appearance | Usage rule |
|---|---|---|---|
| _object_01_ | _Makna editorial_ | _Material, colour, scale_ | _Kapan harus/may be used_ |

### Subject rules

- Subject yang memiliki `Subject ID` wajib menggunakan reference/continuity token pada T2I dan I2V.
- Jangan mengubah gender, usia, spesies, pakaian utama, proporsi, atau era tanpa alasan naratif yang tercatat.
- Jika tidak ada reference asset yang cukup, tandai shot sebagai `requires_reference_review` sebelum generation.
- Hindari wajah/identitas orang nyata kecuali kebijakan channel dan hak penggunaan mengizinkan.

## 4. Location and World Continuity

| Location ID | Canonical description | Lighting/time | Recurring props | Reference asset |
|---|---|---|---|---|
| _location_01_ | _Arsitektur, skala, periode, ambience_ | _Isi_ | _Isi_ | _Asset/preset ID_ |

### World rules

- Periode sejarah, geografi, arsitektur, dan objek budaya harus sesuai dengan `research_source_policy` bila diklaim faktual.
- Lokasi yang sama perlu mempertahankan layout, era, mood, dan visual anchor kecuali script menyatakan perubahan.
- Establishing shot harus memperjelas waktu/tempat sebelum detail close-up bila audience membutuhkannya.
- Jangan mencampur era, lokasi, atau simbol budaya secara dekoratif tanpa justifikasi.

## 5. Cinematography Grammar

### Preferred framing

| Purpose | Preferred framing | Notes |
|---|---|---|
| Establish context | Wide / aerial / environmental | Perjelas skala dan tempat |
| Explain detail | Medium / close-up / insert | Satu ide visual per shot |
| Emotional focus | Close-up / slow push-in | Gunakan seperlunya |
| Compare concepts | Split/diagram/map | Prioritaskan keterbacaan |
| Transition | Match cut / map move / motivated cut | Hindari transisi acak |

### Camera and motion rules

- Camera motion harus mendukung makna: reveal, follow, push-in, pull-back, pan, orbit, atau static hold.
- Hindari motion terus-menerus tanpa alasan.
- Jangan memakai lebih dari satu gerakan kamera dominan dalam shot pendek kecuali diperlukan.
- Untuk I2V, gerakan harus konsisten dengan start frame: tidak mengubah subjek utama secara tiba-tiba.
- Untuk T2V, prompt perlu menyatakan subjek, aksi, framing, gerakan kamera, dan mood.

## 6. Scene Type Rules

| Scene type | Function | Continuity requirement |
|---|---|---|
| `generated_visual` | Rekonstruksi/cerita/visual original | Ikuti subject, location, and cinematography rules |
| `broll` | Dukungan kontekstual | Relevan secara literal/editorial; jangan generik semata |
| `diagram` | Menjelaskan hubungan/data | Utamakan clarity dan label; mengikuti visual palette |
| `map` | Menjelaskan lokasi/pergerakan/waktu | Akurat, readable, dan tidak mengklaim presisi yang tidak ada |
| `text_overlay` | Menekankan fakta/quote/transition | Ringkas, aksesibel, dan tidak mengulang VO penuh |
| `archive_style` | Menampilkan konteks masa lalu | Bedakan rekonstruksi dari arsip asli; patuhi rights policy |

## 7. T2I, I2V, and T2V Continuity Rules

### T2I start-frame

- Sertakan canonical subject/location description, framing, lighting, style, and negative constraints.
- Gunakan reference asset bila subject/location memiliki ID.
- Start frame wajib direview untuk shot dengan character, lokasi berulang, atau objek penting.
- Jangan membuat start frame yang memuat teks kecil/rumit kecuali memang perlu dibaca.

### I2V

- I2V prompt meneruskan frame yang telah disetujui; jangan mendeskripsikan ulang subjek dengan atribut yang bertentangan.
- Tentukan aksi, camera motion, durasi, dan continuity constraint secara eksplisit.
- Batasi perubahan besar dalam satu clip; gunakan shot tambahan bila terjadi perubahan tempat/waktu/subjek.

### T2V

- Gunakan untuk establishing shot, abstraksi, atmosphere, atau shot yang tidak bergantung pada visual anchor spesifik.
- T2V prompt harus tetap membawa global style tokens, aspect ratio, pacing, dan negative constraints.
- Jangan gunakan T2V untuk recurring character/location jika T2I→I2V lebih aman bagi kontinuitas.

## 8. Visual Drift Prevention

### Required continuity tokens

_Isi token/prompt fragments yang harus ditambahkan otomatis bila relevan._

```text
Style tokens: [ ... ]
Character tokens: [ ... ]
Location tokens: [ ... ]
Lighting tokens: [ ... ]
Negative tokens: [ ... ]
```

### Drift checks before approval

- [ ] Subject sesuai canonical description/reference.
- [ ] Lokasi/era sesuai script dan research context.
- [ ] Palette, lighting, realism level, dan texture sesuai style.
- [ ] Framing/motion mendukung VO dan scene purpose.
- [ ] Tidak ada artefak visual, anatomi, teks, logo, atau simbol yang tidak diinginkan.
- [ ] Start frame dan I2V continuity tidak bertentangan.
- [ ] Asset memiliki provenance dan status rights yang sesuai.

## 9. Transition and Assembly Rules

- Transisi harus dimotivasi oleh narasi: waktu, tempat, sebab-akibat, perbandingan, atau pertanyaan baru.
- Hindari menggunakan efek transisi mencolok sebagai pengganti struktur cerita.
- Pertahankan colour/motion coherence antar shot dalam satu chapter.
- Gunakan chapter card, map, diagram, atau text overlay untuk reset visual yang disengaja.
- Bila narrative scene lebih panjang dari satu generated shot, susun shot sequence yang memiliki progression visual.

## 10. Accessibility and Safety

- Text overlay harus memiliki kontras dan durasi baca yang cukup.
- Informasi penting dalam visual juga dijelaskan VO atau subtitle bila memungkinkan.
- Hindari imagery yang berisiko memicu, stereotip, eksploitasi, atau menyesatkan.
- Visual rekonstruksi, synthetic media, dan archive-style mengikuti `rights_disclosure_policy`.
- Human review wajib untuk shot yang berisiko tinggi, menampilkan orang nyata, atau merepresentasikan peristiwa sensitif.

## 11. AI Context Summary

> Machine-facing summary. Complete canonical visual descriptions, tokens, and constraints in English for consistent T2I, I2V, and T2V prompts.

```text
Global style: [summary]
Subject continuity: [IDs + canonical tokens]
Location continuity: [IDs + canonical tokens]
Cinematography grammar: [summary]
Scene type rules: [summary]
T2I/I2V/T2V rules: [summary]
Negative constraints: [summary]
Drift review criteria: [summary]
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
