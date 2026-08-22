# YouTube Studio — Voice & Audio Guide

> KB Type: `voice_audio_guide`  
> Scope: Channel atau Series  
> Status: Draft template  
> Version: 1.0  
> Primary locale: _Contoh: id-ID_  
> Last reviewed: _YYYY-MM-DD_

## 1. Purpose

Panduan ini menetapkan standar voice-over dan audio untuk video YouTube long-form: persona suara, bahasa, pacing, pelafalan, dialog, musik, SFX, subtitle timing, dan approval VO batch.

Audio harus mendukung struktur editorial dan visual; ia tidak boleh sekadar mengisi ruang kosong.

## 2. Voice Persona

| Field | Definition |
|---|---|
| Persona name | _Nama internal persona_ |
| Voice provider/profile | _Provider dan profile yang disetujui_ |
| Language locale | _BCP 47 locale, contoh: id-ID_ |
| Accent / dialect | _Default atau batasan yang relevan_ |
| Perceived age/energy | _Contoh: dewasa, tenang, ingin tahu_ |
| Narrative role | _Dokumenter / mentor / storyteller / explainer_ |
| Formality | _Santai / profesional / akademik-populer_ |
| Emotional range | _Batas emosi yang diperbolehkan_ |
| Prohibited delivery | _Contoh: terlalu dramatis, robotic, salesy_ |

### Voice persona statement

_Template:_

> Narator terdengar **[sifat utama]**, berbicara kepada **[audience]** dengan gaya **[tone]**, sehingga penonton merasa **[hasil emosional/kognitif]**.

## 3. Language and Localisation

- Script VO harus ditulis natural untuk locale target, bukan hasil translasi literal.
- Nama, istilah, angka, tanggal, mata uang, dan singkatan harus mengikuti kebiasaan pembacaan locale.
- Pertahankan istilah penting dalam bahasa asli bila lebih akurat; tambahkan penjelasan pelafalan atau konteks bila diperlukan.
- Bila satu channel mendukung banyak bahasa, setiap locale memiliki voice persona dan glossary sendiri.
- Jangan mencampur register atau bahasa tanpa alasan editorial yang jelas.

## 4. Pacing and Timing

### Default pacing

| Content mode | Target pace | Notes |
|---|---|---|
| Documentary / history | _Contoh: 125–150 words per minute_ | Beri ruang pada nama/tanggal/konteks |
| Explainer / tutorial | _Contoh: 135–165 words per minute_ | Perjelas langkah dan istilah |
| Reflective storytelling | _Contoh: 115–140 words per minute_ | Gunakan jeda yang disengaja |
| Energetic list / recap | _Contoh: 145–175 words per minute_ | Hindari mengorbankan keterbacaan |

### Timing rules

- Estimasi durasi scene mengikuti speech rate persona, bukan perkiraan kata umum saja.
- Beri jeda untuk angka, nama asing, kutipan, perubahan chapter, dan visual penting.
- Jangan mempercepat VO hanya agar muat target episode; revisi struktur atau chapter bila perlu.
- Bila VO scene lebih panjang dari shot visual, Production Plan menambah/menyusun visual shot; jangan memotong kalimat secara tidak natural.
- TTS batch hanya dibuat setelah start-frame batch terkait disetujui dalam workflow hybrid.

## 5. Pronunciation and Glossary

| Term | Spoken form | Locale | Notes |
|---|---|---|---|
| _Istilah/nama_ | _Cara dibaca_ | _id-ID/en-US/dll._ | _Tekanan, asal, atau alternatif_ |

### Glossary rules

- Masukkan nama tokoh, lokasi, organisasi, produk, istilah teknis, dan singkatan yang sering muncul.
- Gunakan satu pelafalan yang konsisten dalam satu series, kecuali ada alasan linguistik.
- Bila provider TTS mendukung SSML/pronunciation markup, generate markup dari glossary secara terkontrol.
- Jangan menambahkan markup yang tidak didukung provider; simpan pronunciation note terpisah bila perlu.

## 6. Voice-over Script Rules

- Tulis untuk didengar: kalimat bervariasi, aktif, dan mudah diikuti.
- Satu scene memiliki satu fokus naratif utama.
- Tandai pause, emphasis, pronunciation, dan chapter break secara structured—notasi konsisten.
- Hindari filler, repetisi, hiperbola kosong, dan CTA yang mengganggu payoff.
- Quote harus diberi konteks sumber dan diperlakukan sesuai `research_source_policy`.
- Persetujuan Script tidak otomatis menjadi persetujuan hasil TTS; audio batch tetap perlu review.

### Structured cue example

```text
[pause: 0.4s]
[emphasis: "kata penting"]
[pronounce: "nama" = "cara baca"]
[chapter_break]
```

Gunakan format cue yang didukung provider/adapter aktual. Jika tidak didukung, cues menjadi arahan review/audio editing, bukan teks yang dibacakan.

## 7. Music Direction

| Area | Rule |
|---|---|
| Overall palette | _Contoh: cinematic subtle, warm documentary, minimal ambient_ |
| Intro | _Energi/durasi/mood_ |
| Chapter transition | _Jenis reset audio yang diperbolehkan_ |
| Emotional peak | _Kapan musik boleh naik dan batas intensitas_ |
| Outro | _Cara menutup tanpa mengalahkan CTA_ |
| Prohibited music | _Contoh: terlalu agresif, lirik mengganggu, mood tidak sesuai_ |

### Mixing guardrails

- VO adalah elemen utama; musik/SFX tidak boleh menurunkan kejelasan narasi.
- Volume musik dibedakan antara narration, transition, dan instrumental moment.
- Hindari perubahan volume mendadak tanpa alasan naratif.
- Gunakan asset musik yang mempunyai rights/license jelas.
- Simpan source, license, dan usage location dalam asset manifest.

## 8. Sound Effects and Ambience

### Allowed uses

- Menandai perubahan bab secara halus.
- Memperkuat aksi/lingkungan yang relevan pada visual.
- Menciptakan ambience tanpa menutupi VO.
- Membantu penonton memahami diagram, map, atau text transition.

### Restrictions

- Jangan memakai SFX setiap transisi hanya untuk menjaga perhatian.
- Jangan menggunakan suara yang berlebihan pada topik sensitif atau tragedi.
- Jangan menciptakan kesan bukti/kehadiran yang tidak terjadi dalam sumber asli.
- Hindari SFX yang bertentangan dengan era/lokasi jika konten mengklaim rekonstruksi faktual.

## 9. Subtitle and Accessibility

- Subtitle mengikuti transkrip VO final, bukan draft script lama.
- Gunakan locale subtitle yang sesuai dan pecah baris berdasarkan frasa yang mudah dibaca.
- Tandai speaker bila ada multi-voice/dialogue.
- Informasi audio penting yang tidak disebut VO dapat diberi subtitle/deskripsi bila relevan.
- Jangan menjadikan subtitle sebagai satu-satunya cara memahami informasi penting di layar.

## 10. Audio Review and Approval

### Review per batch/chapter

- [ ] Voice persona sesuai Channel Profile/Series Content Guide.
- [ ] Locale, accent, pronunciation, dan glossary benar.
- [ ] Pacing sesuai audience dan target durasi.
- [ ] Tidak ada bagian terpotong, salah baca, atau artefak TTS.
- [ ] Pause/emphasis mendukung makna narasi.
- [ ] Music/SFX plan tidak mengganggu VO.
- [ ] Batch memiliki status approved sebelum visual generation dependent dimulai.

### Revision policy

- Mengubah teks VO setelah approval memerlukan versi script/audio baru.
- Mengganti voice persona atau locale menginvalidasi batch audio terkait dan assembly preview.
- Mengganti musik/SFX tidak perlu mengulang visual generation kecuali timing berubah.

## 11. AI Context Summary

```text
Voice persona: [summary]
Locale/localisation: [summary]
Pacing target: [summary]
Glossary/pronunciation: [summary]
Script cue rules: [summary]
Music/SFX direction: [summary]
Subtitle/accessibility: [summary]
Audio approval triggers: [summary]
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

