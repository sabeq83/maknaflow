# YouTube Studio — Channel Profile

> KB Type: `channel_profile`  
> Scope: Per Channel YouTube  
> Status: Draft template  
> Version: 1.0  
> Owner: _Belum ditetapkan_  
> Primary locale: _Contoh: id-ID_  
> Last reviewed: _YYYY-MM-DD_

## 1. Identitas Channel

| Field | Nilai |
|---|---|
| Nama channel | _Isi nama channel_ |
| Handle YouTube | `_@handle` |
| One-line positioning | _Satu kalimat yang menjelaskan nilai unik channel_ |
| Kategori utama | _Edukasi / Dokumenter / Tutorial / Storytelling / lainnya_ |
| Target geography | _Negara atau wilayah utama_ |
| Bahasa utama | _BCP 47 locale, contoh: id-ID_ |
| Bahasa tambahan | _Opsional_ |
| Target durasi default | _Contoh: 12 menit / 720 detik_ |
| Frekuensi upload | _Contoh: 1 episode per minggu_ |

## 2. Positioning dan Janji Konten

### Positioning statement

_Template:_

> Channel ini membantu **[target penonton]** memahami atau mencapai **[hasil/transformasi]** melalui **[format atau sudut pandang khas]**, dengan gaya **[tone]**.

### Content promise

- Penonton selalu mendapatkan: _isi nilai utama_.
- Channel tidak sekadar membahas: _daftar hal generik yang dihindari_.
- Setiap episode harus menjawab: _pertanyaan/manfaat inti bagi penonton_.

### Differentiators

1. _Pembeda 1_
2. _Pembeda 2_
3. _Pembeda 3_

## 3. Target Audience

| Dimension | Definition |
|---|---|
| Siapa mereka | _Demografi atau tahap kehidupan yang relevan_ |
| Kebutuhan utama | _Masalah, rasa ingin tahu, atau tujuan mereka_ |
| Pengetahuan awal | _Beginner / intermediate / advanced_ |
| Motivasi menonton | _Belajar, hiburan, mengambil keputusan, inspirasi, dll._ |
| Hambatan | _Apa yang membuat topik terasa sulit/tidak menarik bagi mereka_ |
| Bahasa/nuansa budaya | _Pilihan bahasa dan konteks lokal yang perlu dihormati_ |
| Harapan setelah video | _Outcome yang diharapkan penonton_ |

### Audience exclusions

_Sebutkan audiens yang bukan fokus agar AI tidak membuat positioning terlalu lebar._

- _Contoh: profesional ahli yang mencari analisis teknis tingkat lanjut._

## 4. Editorial Direction

### Pillars

| Pillar | Tujuan | Contoh angle | Tidak termasuk |
|---|---|---|---|
| _Pillar 1_ | _Tujuan_ | _Contoh_ | _Batasan_ |
| _Pillar 2_ | _Tujuan_ | _Contoh_ | _Batasan_ |
| _Pillar 3_ | _Tujuan_ | _Contoh_ | _Batasan_ |

### Tone of voice

- Karakter narasi: _Contoh: hangat, kredibel, ingin tahu, tenang._
- Tingkat formalitas: _Santai / profesional / akademik-populer._
- Pacing: _Cepat / sedang / reflektif._
- Perspektif: _Orang ketiga / narator dokumenter / mentor._
- Gunakan: _kata/jenis frasa yang dianjurkan._
- Hindari: _kata/jenis frasa yang tidak sesuai._

### Editorial guardrails

- Jangan membuat klaim faktual tanpa sumber atau penanda ketidakpastian.
- Jangan menggunakan judul/thumbnail yang menjanjikan sesuatu yang tidak diberikan video.
- Jangan menyederhanakan konteks budaya, agama, sejarah, kesehatan, hukum, atau keuangan secara menyesatkan.
- _Tambahkan guardrail spesifik channel._

## 5. Narrative Format

### Default episode structure

```text
Hook (0–60 detik)
→ Context / question
→ Chaptered explanation or story
→ Retention moments / pattern interrupts
→ Key takeaway
→ CTA + next-video bridge
```

### Format rules

- Target chapter count: _Contoh: 4–6 chapter._
- Hook requirement: _Apa yang harus dijanjikan/dibuktikan di awal._
- Retention rule: _Contoh: ubah ritme/visual setiap 20–40 detik bila sesuai topik._
- CTA rule: _Jenis CTA, lokasi, dan frekuensi._
- Outro rule: _Bagaimana episode menghubungkan penonton ke video berikutnya._

## 6. Visual, Voice, dan Production Defaults

> Detail teknis yang lebih dalam berada pada `visual_continuity_guide`, `prompt_production_playbook`, dan `voice_audio_guide`. Bagian ini hanya menyimpan default channel.

| Area | Default |
|---|---|
| Visual Identity preset | _Pilih preset atau kosongkan_ |
| Universe reference | _Pilih Universe atau kosongkan_ |
| Aspect ratio | `16:9` |
| Generation profile default | _Contoh: google_flow_omni_flash_ |
| Voice persona | _Nama/persona voice yang disetujui_ |
| Voice locale | _Contoh: id-ID_ |
| Subtitle language | _Locale subtitle default_ |
| Music direction | _Contoh: cinematic subtle, non-distracting_ |

## 7. Growth dan Monetization Direction

| Area | Direction |
|---|---|
| Primary objective | _Authority / AdSense / affiliate / leads / product / sponsor_ |
| CTA primary | _Subscribe / playlist / newsletter / product / lainnya_ |
| CTA secondary | _Opsional_ |
| Playlist strategy | _Nama/pola playlist yang perlu dibangun_ |
| Repurpose strategy | _Jenis Shorts yang diturunkan dari episode panjang_ |
| Monetization boundaries | _Disclosure, affiliate policy, sponsor policy_ |

## 8. Prohibited Content and Claims

- _Klaim atau topik yang tidak boleh dibuat AI._
- _Framing sensasional/clickbait yang dilarang._
- _Jenis sumber yang tidak diterima._
- _Kata atau konsep yang harus mendapatkan human review._

## 9. AI Context Summary

> Bagian ini adalah ringkasan singkat yang dapat diinjeksi ke prompt AI. Isi hanya setelah seluruh bagian di atas disetujui.

```text
Channel: [nama]
Positioning: [one-line positioning]
Audience: [audience summary]
Locale: [locale]
Default duration: [seconds]
Tone: [tone]
Content pillars: [pillar names]
Narrative format: [summary]
Visual/voice defaults: [summary]
Editorial guardrails: [summary]
CTA direction: [summary]
```

## 10. Review and Activation Record

| Field | Value |
|---|---|
| Drafted by | _User / AI-assisted / operator_ |
| Reviewed by | _Nama atau user ID_ |
| Approved by | _Nama atau user ID_ |
| Activated at | _Timestamp_ |
| Supersedes version | _Versi sebelumnya atau —_ |
| Change summary | _Ringkasan perubahan_ |

