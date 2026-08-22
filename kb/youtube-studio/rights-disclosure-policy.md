# YouTube Studio — Rights & Disclosure Policy

> KB Type: `rights_disclosure_policy`  
> Scope: Tenant atau Channel  
> Status: Draft template  
> Version: 1.0  
> AI context language: English  
> Jurisdiction / audience: _Isi negara atau wilayah utama_  
> Last reviewed: _YYYY-MM-DD_

## 1. Purpose

Panduan ini menetapkan standar internal untuk hak penggunaan asset, attribution, synthetic media/AI disclosure, affiliate, sponsorship, dan review sebelum publikasi.

Panduan ini membantu workflow dan dokumentasi produksi. Ini bukan nasihat hukum dan tidak menggantikan kewajiban memeriksa hukum, lisensi, atau kebijakan platform yang berlaku.

## 2. Asset Rights Principles

1. Setiap asset yang masuk production manifest harus memiliki asal/provenance.
2. “Ditemukan di internet” bukan hak penggunaan.
3. Hak penggunaan ditentukan oleh license, agreement, ownership, atau izin yang dapat dibuktikan.
4. AI-generated asset tetap memerlukan review terhadap terms provider, resemblance risk, trademark, dan kebijakan platform.
5. Asset dengan status tidak jelas tidak boleh otomatis masuk final render.
6. Attribution diberikan ketika license, sumber, atau etika editorial mengharuskannya.

## 3. Asset Classification

| Asset type | Examples | Minimum record |
|---|---|---|
| Owned original | Footage, image, audio milik tenant | Owner, creation date, usage scope |
| Licensed stock | Stock photo/video/music/SFX | Provider, asset ID, license type, license proof, usage scope |
| Public domain | Arsip, dokumen, karya public domain | Source institution, public-domain basis, access date |
| Open license | Creative Commons/open data | License version, attribution text, modification/commercial rule |
| User-provided | Upload user/client | Uploader attestation, intended usage, rights status |
| AI-generated | T2I, I2V, T2V, synthetic audio | Provider, model/profile, prompt snapshot, generation timestamp |
| Editorial reference | Screenshot, quote, clip untuk analisis | Source, purpose, limited-use rationale, reviewer decision |

## 4. Asset Manifest Requirements

Setiap asset final/reviewable mencatat:

```text
asset_id
episode / production package / scene / shot reference
asset_type
source_category
source_provider or owner
source_url / asset_id / archive reference
license or usage basis
attribution requirement and final attribution text
creation/access date
modification status
AI provider/model/prompt provenance when relevant
rights_review_status
reviewer and review timestamp
```

### Rights review statuses

| Status | Meaning | Allowed action |
|---|---|---|
| `pending` | Belum cukup informasi | Tidak masuk final render |
| `approved` | Basis penggunaan dicatat dan diterima | Boleh digunakan sesuai scope |
| `needs_attribution` | Boleh digunakan tetapi attribution wajib | Boleh digunakan jika output attribution disiapkan |
| `restricted` | Hanya untuk scope/lokasi/platform tertentu | Sistem harus menegakkan batas scope |
| `rejected` | Tidak boleh digunakan | Blok dari assembly dan final render |

## 5. AI and Synthetic Media Disclosure

### Internal disclosure

Production package mencatat jika asset dibuat/dimodifikasi oleh AI:

- Provider/model/profile.
- Generation mode: T2I, I2V, T2V, synthetic voice, editing assist.
- Prompt/context snapshot yang aman disimpan.
- Human review status.
- Apakah asset merepresentasikan orang, peristiwa, atau lokasi nyata.

### Viewer-facing disclosure

Tentukan kapan disclosure ditampilkan berdasarkan kebijakan platform, konteks, dan risiko penonton salah memahami:

| Situation | Disclosure guideline |
|---|---|
| Rekonstruksi/ilustrasi AI | Jelaskan jika penonton dapat mengira itu footage/foto asli |
| Synthetic voice | Jelaskan bila relevan dengan ekspektasi audience/brand policy |
| Altered realistic event/person | Human review wajib; gunakan disclosure yang jelas atau jangan gunakan |
| Diagram/visual concept AI | Disclosure bila dapat disalahpahami sebagai data/foto asli |
| Generic cinematic background | Ikuti policy channel/platform; tidak perlu mengganggu pengalaman bila tidak misleading |

### Prohibited synthetic uses

- Meniru suara atau rupa orang nyata tanpa hak/izin yang jelas.
- Membuat rekonstruksi realistis yang menyesatkan sebagai rekaman asli.
- Memalsukan bukti, dokumen, kutipan, endorsement, atau testimoni.
- Menggunakan synthetic media untuk mengaburkan status sponsor/affiliate.

## 6. Editorial References, Quotes, and Archives

- Gunakan material pihak ketiga secara proporsional dan transformasional bila untuk analisis/kritik/konteks editorial.
- Jangan mengandalkan pengecualian hukum tertentu sebagai asumsi otomatis; jika tidak pasti, minta review manusia.
- Batasi kutipan visual/audio ke bagian yang diperlukan untuk tujuan editorial.
- Jangan menampilkan full work, watermark, atau asset berlisensi tanpa dasar penggunaan.
- Distinguish archival original, licensed footage, public-domain material, and AI reconstruction on internal manifest and viewer disclosure bila diperlukan.

## 7. Affiliate, Sponsorship, and Commercial Disclosure

### Affiliate

- Tandai affiliate link di description/pinned comment sesuai policy channel dan platform.
- CTA affiliate harus jujur; jangan membuat klaim hasil atau urgensi palsu.
- Konten editorial dan rekomendasi komersial harus dapat dibedakan secara jelas.

### Sponsorship / paid promotion

- Simpan sponsor/client, deliverable, mandatory disclosure text, restricted claims, and approval contact.
- Gunakan disclosure platform dan viewer-facing disclosure yang sesuai.
- Sponsor tidak boleh mengubah factual claim menjadi misleading tanpa human approval.
- Review untuk konflik kepentingan atau audience suitability.

### Product claims

- Claim performa, harga, availability, health/finance/legal outcome, atau comparison perlu dasar yang dapat ditelusuri.
- Jangan menggunakan mock testimonial sebagai testimonial nyata.
- Gunakan terms, price, and availability date jika claim berpotensi berubah.

## 8. Human Review Triggers

Human approval wajib bila terdapat salah satu kondisi berikut:

- Asset rights status bukan `approved` atau `needs_attribution` dengan output attribution siap.
- Video memakai footage/quote/material editorial pihak ketiga.
- AI visual/voice menyerupai atau merepresentasikan orang nyata/peristiwa sensitif.
- Konten memuat sponsor, affiliate, paid promotion, atau product claim.
- Konten menyentuh health, legal, finance, children, privacy, tragedy, religion, politics, atau reputasi individu.
- Attribution/disclosure tidak dapat ditentukan otomatis.

## 9. Pre-publish Rights and Disclosure Checklist

- [ ] Semua asset final memiliki asset manifest dan rights review status yang valid.
- [ ] Asset `pending`, `restricted` di luar scope, atau `rejected` tidak masuk final render.
- [ ] Attribution yang diperlukan telah disiapkan di description, on-screen, chapter note, atau credits.
- [ ] Disclosure AI/reconstruction tersedia bila visual dapat disalahpahami.
- [ ] Affiliate/sponsor/promotion disclosure telah disetujui.
- [ ] Claim komersial/faktual berisiko telah melalui review yang sesuai.
- [ ] YouTube metadata dan viewer-facing copy tidak menyembunyikan hubungan komersial atau status synthetic media yang relevan.

## 10. AI Behaviour Rules

- AI tidak boleh menyatakan asset “royalty-free”, “public domain”, “fair use”, atau “licensed” tanpa record yang membuktikannya.
- AI tidak boleh membuat attribution, license ID, atau permission record fiktif.
- AI boleh menandai `needs_human_rights_review`, bukan membuat keputusan legal otomatis.
- AI harus mewariskan provenance ketika asset diturunkan, dipotong, dimodifikasi, atau dipakai ulang.
- AI harus memblokir assembly/final render ketika policy menyatakan human review wajib dan belum selesai.

## 11. Escalation Path

```text
Unclear asset/source
→ mark pending
→ request evidence or replacement
→ rights reviewer decision
→ approved / needs attribution / restricted / rejected
→ production or publish gate result
```

| Situation | Escalate to |
|---|---|
| License/ownership unclear | Rights owner or designated reviewer |
| Sensitive synthetic representation | Editorial lead + rights reviewer |
| Sponsor/affiliate claim | Commercial owner + editorial reviewer |
| Potential privacy/reputation harm | Designated legal/privacy reviewer |
| Platform policy uncertainty | Platform policy owner / human operator |

## 12. AI Context Summary

> Machine-facing summary. Complete values in English for consistent rights/disclosure decisions across providers and locales.

```text
Asset rights principles: [summary]
Allowed asset categories: [summary]
Required manifest fields: [summary]
Synthetic media disclosure policy: [summary]
Affiliate/sponsor policy: [summary]
Human review triggers: [summary]
Blocking conditions: [summary]
```

## 13. Review and Activation Record

| Field | Value |
|---|---|
| Drafted by | _User / AI-assisted / operator_ |
| Reviewed by | _Nama atau user ID_ |
| Approved by | _Nama atau user ID_ |
| Activated at | _Timestamp_ |
| Supersedes version | _Versi sebelumnya atau —_ |
| Change summary | _Ringkasan perubahan_ |
