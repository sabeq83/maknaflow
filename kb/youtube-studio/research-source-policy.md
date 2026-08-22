# YouTube Studio — Research Source Policy

> KB Type: `research_source_policy`  
> Scope: Tenant atau Channel  
> Status: Draft template  
> Version: 1.0  
> Applies to: _Semua series / daftar series tertentu_  
> Primary locale: _Contoh: id-ID_  
> Last reviewed: _YYYY-MM-DD_

## 1. Purpose

Panduan ini menetapkan bagaimana YouTube Studio meneliti, memberi tingkat keyakinan, menggunakan, menyimpan, dan mengungkapkan sumber untuk konten long-form.

Tujuannya bukan menjadikan AI sebagai sumber kebenaran. AI harus memperlakukan sumber sebagai bukti yang perlu dinilai, menandai ketidakpastian, dan meminta review manusia ketika risiko klaim tinggi.

## 2. Source Hierarchy

Urutkan sumber berdasarkan otoritas dan kedekatan dengan fakta yang dibahas.

| Tier | Source type | Contoh | Penggunaan |
|---|---|---|---|
| 1 | Primary source | Dokumen resmi, paper asli, arsip, dataset, rekaman/wawancara asli | Prioritas tertinggi untuk claim inti |
| 2 | Authoritative institution | Universitas, lembaga riset, pemerintah, organisasi profesi | Penjelasan, data, konteks |
| 3 | Reputable secondary analysis | Buku penulis ahli, jurnalistik investigatif bereputasi, review akademik | Interpretasi dan sintesis |
| 4 | Expert commentary | Wawancara pakar yang kredibel dan relevan | Perspektif, bukan satu-satunya bukti |
| 5 | General web/community content | Blog, forum, media sosial, video lain | Hanya discovery lead; wajib diverifikasi ulang |

### Source exclusions

- Sumber anonim tanpa metodologi atau asal yang dapat ditelusuri.
- Konten yang hanya mengulang klaim dari sumber lain tanpa atribusi.
- Screenshot/cuplikan tanpa konteks atau tanggal.
- AI-generated content sebagai bukti faktual.
- Sumber yang tidak dapat diverifikasi untuk claim berisiko tinggi.

## 3. Claim Classification

Setiap claim penting dalam Research Brief diklasifikasikan sebelum masuk Blueprint/Script.

| Claim type | Contoh | Requirement |
|---|---|---|
| Factual | Tanggal, angka, peristiwa, identitas | Sumber Tier 1–3 atau risk flag |
| Interpretive | Mengapa suatu peristiwa penting | Atribusi perspektif dan basis argumen |
| Causal | X menyebabkan Y | Bukti kuat; jangan menyederhanakan korelasi menjadi sebab-akibat |
| Forecast | Prediksi masa depan | Metodologi, ketidakpastian, tanggal, dan disclaimer |
| Advice | Kesehatan, hukum, keuangan, keselamatan | Human review wajib dan sumber otoritatif |
| Opinion | Penilaian/editorial | Harus jelas sebagai opini atau analisis |

## 4. Confidence and Risk Labels

### Confidence

| Label | Meaning | Script treatment |
|---|---|---|
| High | Didukung beberapa sumber kuat atau primary source | Dapat disampaikan sebagai fakta dengan atribusi wajar |
| Medium | Bukti cukup tetapi ada ruang interpretasi | Gunakan bahasa hati-hati dan/atau atribusi |
| Low | Bukti lemah, terbatas, atau tidak konsisten | Jangan jadikan claim inti; perlu review atau dihilangkan |

### Risk

| Label | Trigger | Required action |
|---|---|---|
| Low | Informasi umum, risiko kecil bila kurang presisi | Review editorial normal |
| Medium | Konteks kompleks, angka diperdebatkan, interpretasi sensitif | Tambahkan source note dan reviewer check |
| High | Kesehatan, hukum, finansial, keamanan, reputasi individu, konflik, politik, agama, anak | Human approval wajib sebelum Script Approved |

## 5. Research Brief Requirements

Research Brief minimum harus memuat:

```text
Episode angle
Audience intent
Viewer questions
Keyword/topic cluster
Key claims
  ├── claim text
  ├── claim type
  ├── confidence
  ├── risk
  ├── source references / source note
  └── reviewer action if needed
Editorial risks
Source requests or missing evidence
```

### Claim rules

- Claim inti tidak boleh hanya didukung Tier 5.
- Claim causal harus menjelaskan batas bukti atau alternatif penjelasan bila relevan.
- Angka harus memiliki satuan, periode, geography, dan sumber.
- Kutipan harus jelas siapa yang mengatakan, kapan, dan dalam konteks apa.
- Jika sumber tidak cukup, AI menyarankan perubahan angle atau menandai `needs_human_research`.

## 6. Citation and Attribution Rules

### Internal production record

Simpan untuk setiap sumber yang dipakai:

| Field | Requirement |
|---|---|
| Title | Judul sumber/dokumen |
| Author or institution | Penulis/penerbit/lembaga |
| Publication date | Tanggal jika tersedia |
| URL or archive reference | Tautan atau referensi arsip |
| Tier | Tier source hierarchy |
| Claims supported | Claim/section yang didukung |
| Accessed date | Tanggal diakses |
| Usage note | Parafrase, angka, kutipan singkat, visual reference |

### Viewer-facing attribution

- Sertakan sumber penting di deskripsi, chapter note, on-screen citation, atau pinned comment sesuai format channel.
- Gunakan atribusi eksplisit untuk kutipan langsung dan data penting.
- Jangan menampilkan daftar sumber panjang yang tidak relevan hanya untuk terlihat kredibel.
- Patuhi batas kutipan dan hak cipta; utamakan parafrase analitis.

## 7. Topic-specific Policies

### History, culture, religion, and identity

- Bedakan fakta, tradisi, interpretasi akademik, dan narasi populer.
- Jangan menyajikan satu perspektif sebagai satu-satunya pandangan bila terdapat perbedaan yang signifikan.
- Gunakan bahasa yang menghormati komunitas dan konteks.

### Health, law, finance, and safety

- Wajib human review sebelum approval.
- Gunakan sumber Tier 1–2 bila tersedia.
- Hindari diagnosis, jaminan hasil, atau instruksi yang dapat membahayakan.
- Sertakan batasan/disclaimer yang proporsional bila diperlukan.

### Technology and current events

- Catat tanggal informasi; produk, kebijakan, dan angka dapat berubah.
- Bedakan pengumuman, eksperimen, rumor, dan produk yang tersedia.
- Gunakan sumber resmi atau primary source untuk spesifikasi/klaim produk.

## 8. AI Behaviour Rules

- AI tidak boleh mengarang URL, kutipan, nama paper, angka, atau institusi.
- AI boleh menyarankan source query, tetapi harus menandainya sebagai `source_request`, bukan source terverifikasi.
- AI wajib memasukkan risk/confidence label pada key claim.
- AI wajib menandai claim high-risk sebagai `requires_human_review`.
- AI tidak boleh mengubah source note yang telah disetujui user tanpa membuat versi baru.
- Bila terdapat konflik sumber, AI merangkum perbedaan dan tidak memilih pemenang tanpa alasan yang dapat ditelusuri.

## 9. Human Review Checklist

Sebelum Blueprint/Script disetujui, reviewer menjawab:

- [ ] Claim inti memiliki sumber/justifikasi yang memadai.
- [ ] Angka, tanggal, nama, dan kutipan telah diperiksa.
- [ ] Bahasa kepastian sesuai strength of evidence.
- [ ] Risiko medium/high telah ditangani atau disetujui secara eksplisit.
- [ ] Tidak ada source/URL/kutipan yang dibuat-buat oleh AI.
- [ ] Attribution viewer-facing telah direncanakan bila diperlukan.
- [ ] Episode tidak melanggar Channel Profile atau Rights & Disclosure Policy.

## 10. AI Context Summary

```text
Source hierarchy: [summary]
Claim classification: [summary]
Confidence/risk rules: [summary]
Citation requirements: [summary]
Topic-specific policy: [summary]
AI prohibitions: [summary]
Human review triggers: [summary]
```

## 11. Review and Activation Record

| Field | Value |
|---|---|
| Drafted by | _User / AI-assisted / operator_ |
| Reviewed by | _Nama atau user ID_ |
| Approved by | _Nama atau user ID_ |
| Activated at | _Timestamp_ |
| Supersedes version | _Versi sebelumnya atau —_ |
| Change summary | _Ringkasan perubahan_ |

