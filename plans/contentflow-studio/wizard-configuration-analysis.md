# Usulan Wizard ContentFlow Studio — Paritas Konfigurasi Campaign

Tanggal audit: 22 Oktober 2026. Lingkup: membaca kode lokal terbaru, analisis, dan mockup HTML. Belum mengubah React, database, worker, atau deployment.

## Kesimpulan

Bisa dibuat sama dengan konfigurasi menu campaign asal dan ditampilkan sebagai wizard. Yang harus dibagi adalah presentasi form; definisi field, default, dependency, preset, validasi, serializer, dan sumber katalog harus digunakan bersama.

Form Studio saat ini belum dapat dianggap identik. `StudioWorkspace.js` memakai komponen di `campaign-forms/`, tetapi halaman RE, Multiplier, Recipe, dan Content Planner masih memiliki form inline sendiri. Komponen tersebut belum menjadi sumber tunggal untuk menu asal dan Studio. Pillar relatif lebih dekat karena Studio dan halaman Pillar memakai `ImportPlannerModal` yang sama.

Contoh konkret: payload capture `ReCampaignConfigurationForm.js` belum membawa sejumlah opsi yang ada pada form/payload `app/re-campaigns/page.js`, termasuk angle multiplier, audio segment, audit VO, ekstraksi resep, pengaktifan tahapan workflow, dan identitas visual. Mode direct komponen tersebut juga menetapkan `execution_mode` menjadi `full_autopilot`. Mengubah susunan tab menjadi wizard saja belum mengatasi perbedaan tersebut. Validator menu RE juga memiliki pemeriksaan URL extract dan foto/nama file Hybrid Lock yang lebih lengkap.

## Sumber yang diaudit

| Jalur | Sumber form yang menjadi acuan |
| --- | --- |
| Generator Content Planner | `app/content-planner/page.js`, form `handleGenerate`, sekitar baris 999–1869 |
| Pillar | `app/components/ImportPlannerModal.js`; dipakai `app/pillar-campaigns/page.js` dan Studio |
| Reverse Engineering | `app/re-campaigns/page.js`, form `handleCreate` / `handleMassSubmit`, sekitar baris 1066–2180 |
| Multiplier | `app/multiplier-lab/page.js`, form `handleSubmit`, sekitar baris 1204–2480, pemilihan workflow sekitar baris 1120–1185 |
| Recipe Static | `app/recipe-labs/page.js`, sekitar baris 1032–1648 |
| Recipe Video Storyboard | `app/recipe-labs/page.js`, sekitar baris 1653–2543 |
| Visual Identity | `app/components/VisualIdentitySelector.js` |
| Model dan batas kata | `lib/words-per-clip-presets.js` |
| Layout kolase | `lib/core/GridCoordinates.js` |
| Orkestrasi Studio saat ini | `StudioWorkspace.js`, `lib/contentflow-studio-manifest.js`, `lib/contentflow-studio-adapters.js`, `lib/campaign-submission-service.js` |

## Susunan wizard yang diusulkan

Langkah pertama selalu **pilih jenis campaign**. Setelah itu langkah konfigurasi menyesuaikan jalurnya. Tidak semua engine dipaksa memiliki jumlah langkah yang sama. Nama bagian mengikuti menu asal agar mudah dikenali.

| Campaign | Urutan konfigurasi |
| --- | --- |
| Pillar | Generator Content Planner → Review Planner → Basic Creative Strategy & Planner Master → Aesthetics & Visual Settings → Product Bridging → Visual Identity → Workflow & Audio → Jadwal → Review Batch |
| RE | Single/Mass + Mode Eksekusi + Preset → Basic Creative Strategy → Aesthetics & Visual → Product Bridging → Visual Identity → Workflow & Audio → Jadwal → Review Batch |
| Multiplier | Empat Workflow + Blueprint/Produk/Angle + Kombinasi → Basic Creative Strategy → Aesthetics & Visual → Product Bridging → Visual Identity → Jadwal → Review Batch |
| Recipe Static | Jenis Recipe → Kategori/Sumber Referensi → Layout/Komposisi → Pengaturan Produksi → Jadwal → Review Batch |
| Recipe Video | Jenis Recipe → Basic Creative Strategy → Aesthetics & Visual → Product Bridging → Visual Identity → Workflow & Audio → Jadwal → Review Batch |

Bagian Multiplier mengikuti kemampuan menu asal; jangan menambahkan halaman workflow/audio yang tidak tersedia pada konfigurasi menu asal. Tahap sumber Multiplier boleh dipecah lagi menjadi beberapa langkah jika terlalu panjang, dengan state dan aturan kombinasi yang sama.

## Aturan yang tetap berlaku

1. Content Planner hanya ada pada jalur Pillar. Fokus Brand Editorial, Product Campaign, dan Recipe Campaign tetap tersedia sesuai Generator Content Planner.
2. Planner dibuat untuk batch bersangkutan. Sesudah berhasil dipakai menjadi campaign, konsumsi atomik tetap mencegah pemakaian ulang. Membuka atau mereview Planner belum berarti consumed. Retry slot yang sama memakai campaign yang telah dibuat, bukan mengonsumsi Planner kedua kali.
3. Tidak ada Bank Ide, katalog Planner untuk pemakaian ulang, atau pengambilan Planner consumed.
4. RE mempertahankan Single/Mass Production, preset, mode eksekusi, angle multiplier, seluruh dependency visual/bridging, identitas visual, workflow/audio, dan validasi aslinya.
5. Multiplier mempertahankan empat pola: 1 blueprint → banyak angle, banyak blueprint → 1 angle, banyak blueprint → 1 produk, dan 1 blueprint → banyak produk. Pemilihan banyak/satu dan pembuatan kombinasi mengikuti pola aktif.
6. Recipe Static dan **Reels Video Storyboard (Naskah & DNA)** tetap dibedakan. Jangan menyebut storyboard sebagai video final siap publish. Adapter Studio saat ini sudah memberi `needs_review` jika storyboard selesai tetapi video final belum tersedia. Produksi video resep melalui jalur Recipe Planner/Pillar tetap terpisah.
7. Mode Full Auto Pilot mengatur pipeline produksi; persetujuan tayang Studio tetap wajib. Pengaturan draft sosial dari menu asal perlu dipetakan secara eksplisit agar tidak melewati approval atau menyebabkan publikasi ganda.
8. Jadwal mulai produksi dan target tayang terpisah; hasil banyak dipetakan menjadi slot individual dengan zona waktu yang terlihat.

## Bentuk implementasi yang disarankan

Ekstrak controller/state dan bagian JSX **dari form menu asal yang aktual**, lalu pakai controller dan section yang sama pada menu asal dan Studio. Hindari membuat definisi form ketiga.

- **Controller per engine:** initial values, dependency, perubahan mode, pemuatan katalog, apply/save preset, upload, validasi, dan pembentukan payload.
- **Section per engine:** bagian-bagian asli form. Menu asal dapat mempertahankan accordion; Studio menampilkannya per langkah.
- **Wizard shell Studio:** stepper, kembali/lanjut, error per langkah, fokus field error, ringkasan, jadwal dan pemetaan slot. Shell tidak mengubah isi konfigurasi engine.
- **Adapter Studio:** menangkap draft konfigurasi yang sama tanpa memanggil direct submit ketika menekan Lanjut. Campaign dieksekusi melalui worker pada jadwalnya. Endpoint dan serializer direct/capture perlu diuji agar field tidak hilang.
- **State tunggal:** nilai tetap ada saat kembali, ganti bagian, atau memakai preset. Field yang tidak aktif ditangani oleh normalizer asli; jangan terkirim tanpa sengaja hanya karena pernah diisi.
- **Preset dan unggahan:** gunakan katalog tenant, aturan role, dan format preset yang sama; unggahan harus tetap tersedia sampai jadwal worker mengeksekusi slot. Jangan menyimpan objek File langsung dalam JSON.
- **Paritas yang dapat diverifikasi:** fixture konfigurasi yang sama menghasilkan payload engine setara dari menu asal dan Studio, kecuali metadata orkestrasi seperti jadwal, batch/slot, idempotency dan approval. Verifikasi khusus multipart, mass upload, konfigurasi kondisional, default dan preset.

Paritas 100% ditargetkan pada **kemampuan dan kontrak konfigurasi campaign**, bukan menyamakan tindakan Lanjut dengan direct submit. Review approval, jadwal dan status adalah tanggung jawab Studio.

## Mockup interaktif

File: `public/mockup_contentflow_studio_wizard.html`.

- Wizard untuk keempat jenis campaign, sidebar navigasi langkah, Kembali/Lanjut, isian tersimpan selama sesi halaman.
- Label dan pilihan statis diturunkan dari kontrol JSX form asal, ditambah selector berbasis tombol pada menu asal (fokus Planner, dunia konten, empat workflow Multiplier dan jumlah gambar Recipe).
- Opsi model dan batas kata menggunakan definisi yang disalin dari `words-per-clip-presets`; preset layout dan koordinat kolase disalin dari sumber Recipe.
- Pilihan bridging, audio, identitas, mode produksi, dan cabang Recipe dapat dicoba. Ada simulasi hasil Planner dan angle, review, jadwal, ringkasan, serta penyimpanan batch lokal ke kalender demo.
- Palet menyalin definisi `app/theme.css`; CSS tambahan menggunakan semantic tokens. Mode terang dan gelap tersedia.

**Batas mockup:** ini simulasi UX berbasis inventaris kode, belum komponen produksi bersama dan bukan bukti paritas 100%. Katalog tenant, isi preset, brand hydration, hasil AI, parsing CSV/XLSX, upload, dan submit engine disimulasikan. Validator bisnis engine tidak dijalankan; navigasi langsung ke langkah tersedia untuk mempermudah review desain. Contoh Planner menampilkan tiga baris ilustrasi, bukan menjalankan jumlah permintaan AI. Nilai tidak dipersistenkan melewati reload halaman. Kalender memakai Oktober 2026 sesuai tanggal review. Tidak ada koneksi API atau perubahan data server.

## Kriteria penerimaan sebelum implementasi dinyatakan selesai

- Setiap konfigurasi valid dari menu asal dapat dibuat di Studio dengan opsi, batasan dan preset yang sama.
- Tidak ada pemanggilan engine saat berpindah langkah, dan tidak ada payload yang kehilangan field.
- Jalur Planner hanya untuk Pillar, konsumsi satu kali tetap atomik, retry tidak menduplikasi campaign.
- RE Single/Mass, empat workflow Multiplier, Planner tiga fokus, Recipe Static/Storyboard dan seluruh dependency penting diverifikasi.
- Status `ready` membutuhkan artefak final yang benar; storyboard tanpa video final tidak lolos approval publishing.
- Seluruh publikasi tetap melalui approval Studio, termasuk jika opsi social draft diaktifkan pada konfigurasi sumber.
- UI mengikuti semantic tokens, Light/Dark, perangkat kecil, dan tombol pembuatan batch tetap kompatibel dengan staging HTTP.

## Lampiran: inventaris kontrol sumber untuk mockup

Inventaris ini mencatat kontrol input/select/textarea dan komponen identitas pada rentang form yang diaudit. Selector berbasis tombol dicatat pada pembahasan di atas. Kontrol berulang dan kondisional sengaja tetap tercatat; jumlah kontrol bukan ukuran paritas.

### planner

Sumber: `app/content-planner/page.js`.

| Baris | State/kontrol | Label sumber |
| --- | --- | --- |
| 1061 | `knowledgeDomain` | 📚 Domain Pengetahuan: |
| 1089 | `universeProfile` | 🏰 Universe Profile: |
| 1161 | `productSearchQuery` | 🔍 Cari & Pilih Produk dari Database: |
| 1275 | `selectedBrandId` | 🧬 Brand Profile (Akun Brand) *: |
| 1294 | `brandContext` | Konteks Brand *: |
| 1298 | `contentGoal` | Tujuan Konten: |
| 1303 | `pillarDraft` | Pilar Konten *: |
| 1323 | `pillarDistributionMode` | Pilar Konten *: |
| 1338 | `selectedBrandId` | 🧬 Brand Profile (Akun Brand): |
| 1376 | `productSearchQuery` | Cari produk dari katalog tenant (opsional)... |
| 1407 | `recipeProductIds` |  |
| 1527 | `promotionContext` | Sudut Pandang / Konteks Promosi (Opsional): |
| 1540 | `customInstructions` | Instruksi Khusus Tambahan (Opsional): |
| 1574 | `title` | namaakun - YYYYMMDD - 2 Kata nama produk |
| 1589 | `productName` | Nama Produk *: |
| 1601 | `productDesc` | Deskripsi Produk & Manfaat *: |
| 1613 | `productUsp` | USP / Unique Selling Point: |
| 1624 | `promotionContext` | Sudut Pandang / Konteks Promosi (Opsional): |
| 1635 | `customInstructions` | Instruksi Khusus Tambahan (Opsional): |
| 1646 | `isNonAffiliate` | Bukan Produk Affiliate (Kampanye Non-Affiliate) |
| 1663 | `productUrl` | URL Produk: |
| 1673 | `affiliateUrl` | URL Affiliate: |
| 1684 | `productPhotoUrl` | URL Foto Produk: |
| 1699 | `productUrl` | 🔗 URL Produk (Otomatis Ditarik): |
| 1712 | `affiliateUrl` | 🛍️ URL Affiliate Kampanye (Wajib dari DB) : |
| 1736 | `targetAudience` | 🎯 Target Demografi Audiens (Personalitas Hook): |
| 1750 | `customTargetAudience` | 🎯 Target Demografi Audiens (Personalitas Hook): |
| 1763 | `platform` | Platform Target: |
| 1779 | `recipeCount` | Jumlah Baris Planner: |
| 1818 | `editorialRowsPerPillar` | Jumlah Baris Planner: |

### pillar

Sumber: `app/components/ImportPlannerModal.js`.

| Baris | State/kontrol | Label sumber |
| --- | --- | --- |
| 785 | `selectedPresetKey` | 📋 Gunakan Preset: |
| 840 | `selectedPlannerId` | 📊 Pilih Content Planner Master: |
| 929 | `field_929` | #  [  ] |
| 1000 | `field_1000` | 📤 Unggah Foto |
| 1022 | `selectedBrandId` | 🏷️ Nama Akun (Brand Account):  💡 Terisi Otomatis dari Planner |
| 1049 | `campaignName` | Nama Kampanye OPC: |
| 1061 | `narrativeMode` | Mode Narasi: |
| 1075 | `aiDirective` | AI Directive / Guardrail (Staging Override): |
| 1086 | `mandatoryOutroLine` | Mandatory Outro Line (Staging Override): |
| 1097 | `customInstruction` | Custom Instruction (Instruksi Tambahan AI): |
| 1109 | `voiceProvider` | TTS Voice Provider: |
| 1121 | `targetLanguage` | Bahasa Naskah Voiceover: |
| 1133 | `targetDemographic` | 🎯 Target Demografi & Tone Bahasa: |
| 1146 | `targetDemographicCustom` | 🎯 Target Demografi & Tone Bahasa: |
| 1158 | `enableAudioSegment` | Audio Segmenting: |
| 1172 | `sfxSetting` | SFX Setting: |
| 1184 | `enableVoAudit` | Audit Kepatuhan TikTok Safe: |
| 1198 | `nextcloudParentFolder` | 📁 Parent Folder Nextcloud: |
| 1211 | `selectedBrandId` | 🧬 Brand Profile (Opsional): |
| 1253 | `visualStyle` | Visual Style (Gaya Visual): |
| 1273 | `visualMode` | Visual Mode (Metode Generasi): |
| 1297 | `videoModel` | Model Video Veo: |
| 1317 | `clipDuration` | Durasi per Klip Video: |
| 1339 | `faceVisibility` | Face Visibility: |
| 1349 | `targetClipsCount` | Jumlah Klip Video (N): |
| 1362 | `wordsPerClip` | Batasan Kata ( 8 s): |
| 1371 | `aspectRatio` | Aspect Ratio: |
| 1399 | `isBridgingActive` | Aktifkan Product Bridging (Sisipkan Transisi Produk Softselling) |
| 1408 | `bridgeAtClip` | Mulai Bridging Klip Ke: |
| 1421 | `bridgeDurationClips` | Durasi Bridging: |
| 1430 | `bridgingMode` | Metode Penyertaan Produk: |
| 1468 | `isVsoActive` |  |
| 1483 | `visualIdentity` | Visual Identity Settings |
| 1519 | `enableTts` | Enable TTS (Voiceover) |
| 1524 | `enableGlabs` | Enable G-Labs (AI Video) |
| 1529 | `enableFfmpeg` | Enable FFmpeg Muxing |
| 1534 | `enableSocialPost` | Enable Social Draft Post |
| 1547 | `voiceProvider` | Voice Provider: |
| 1558 | `voicePersona` | Voice Persona: |
| 1573 | `voiceSpeed` | Speed ( 1 x): |
| 1577 | `voiceVolume` | Volume ( 1 x): |
| 1592 | `syncMode` | Auto-Pilot Smart Sync |
| 1606 | `syncMode` | Kustom Manual |
| 1624 | `ffmpegSyncOption` | Metode Manual: |
| 1643 | `ffmpegVideoScale` | Video Scale:   % |

### re

Sumber: `app/re-campaigns/page.js`.

| Baris | State/kontrol | Label sumber |
| --- | --- | --- |
| 1166 | `selectedPresetKey` | 📋 Gunakan Preset: |
| 1212 | `accountName` | 🏷️ Nama Akun (Brand Account) |
| 1239 | `campaignName` | Nama Kampanye |
| 1249 | `nextcloudParentFolder` | Parent Folder Nextcloud |
| 1259 | `targetLanguage` | Bahasa Naskah Voiceover (Script Language) |
| 1270 | `targetDemographic` | 🎯 Target Demografi & Tone Bahasa |
| 1283 | `targetDemographicCustom` | 🎯 Target Demografi & Tone Bahasa |
| 1295 | `enableAudioSegment` | 🎙 Audio Segment (per Klip) |
| 1311 | `voiceProvider` | 🔊 TTS Voice Provider |
| 1338 | `sfxSetting` | SFX Setting |
| 1349 | `enableVoAudit` | Audit Kepatuhan Voiceover (TikTok Safe) |
| 1362 | `urlsText` | Daftar URL Video (satu per baris) |
| 1414 | `field_1414` | Berkas CSV/XLSX Kampanye |
| 1463 | `generateRecipe` |  |
| 1480 | `aiDirective` | AI Directive / Guardrail (Staging Override) |
| 1490 | `mandatoryOutroLine` | Mandatory Outro Line (Staging Override) |
| 1500 | `customInstruction` | Custom Instruction (Opsional) |
| 1525 | `angleMultiplier` | RE Angle Multiplier (RE+AM V8.3) |
| 1538 | `narrativeMode` | Narrative Mode |
| 1550 | `aspectRatio` | Aspect Ratio |
| 1562 | `targetAi` | Target AI |
| 1575 | `videoModel` | Video Model |
| 1594 | `clipDuration` | Durasi per Klip |
| 1613 | `faceVisibility` | Face Visibility |
| 1626 | `targetClipsCount` | Jumlah Klip Video (N) |
| 1645 | `wordsPerClip` | Jumlah Kata Per Klip ( 8 s) |
| 1657 | `visualStyle` | Visual Style |
| 1676 | `visualMode` | Visual Mode |
| 1709 | `isBridgingActive` |  |
| 1729 | `bridgeAtClip` | Sisipkan Transisi Promosi pada Klip Ke- (X) |
| 1753 | `bridgeDurationClips` | Durasi Bridging Produk (Klip) |
| 1771 | `promotionStyle` | Gaya Promosi (Promotion Style) |
| 1788 | `bridgingMode` | Pilih dari Pustaka |
| 1798 | `bridgingMode` | Tulis Manual |
| 1808 | `bridgingMode` | Ekstrak dari URL |
| 1823 | `targetProductId` | Pilih Produk Terdaftar |
| 1872 | `manualProductName` | Nama Produk |
| 1883 | `manualProductDesc` | Deskripsi Produk |
| 1894 | `manualProductUsp` | Unique Selling Point (USP) (Opsional) |
| 1908 | `productUrl` | Tempel URL Halaman Produk |
| 1930 | `productRefImage` | 📸 Unggah Foto Produk (Reference Image) |
| 1941 | `productFilenameDeclare` | 🏷️ Nama Berkas Gambar Produk (Deklarasi Mandate 88) |
| 1979 | `isVsoActive` |  |
| 1995 | `visualIdentity` | Visual Identity Settings |
| 2030 | `enableTts` | Enable TTS (Voiceover) |
| 2035 | `enableGlabs` | Enable G-Labs (AI Video) |
| 2040 | `enableFfmpeg` | Enable FFmpeg Muxing |
| 2045 | `enableSocialPost` | Enable Social Draft Post |
| 2058 | `voiceProvider` | Voice Provider |
| 2065 | `voicePersona` | Voice Persona |
| 2080 | `voiceSpeed` | Speed ( 1 x) |
| 2084 | `voiceVolume` | Volume ( 1 x) |
| 2099 | `syncMode` | Auto-Pilot Smart Sync |
| 2113 | `syncMode` | Kustom Manual |
| 2131 | `ffmpegSyncOption` | Metode Manual |
| 2146 | `ffmpegVideoScale` | Video Scale:   % |

### multiplier

Sumber: `app/multiplier-lab/page.js`.

| Baris | State/kontrol | Label sumber |
| --- | --- | --- |
| 1214 | `assetSearchQuery` | 📹 Pilih Blueprint Video Target ( Pilih Satu ) |
| 1222 | `nicheFilter` | 📹 Pilih Blueprint Video Target ( Pilih Satu ) |
| 1376 | `campaignType` | 🎯 2. Tipe Kampanye & Target Konten |
| 1408 | `campaignType` | 🎯 2. Tipe Kampanye & Target Konten |
| 1450 | `selectedNicheKb` | 📚 Knowledge Base Konteks Niche: |
| 1477 | `angleCount` | 🔢 Jumlah Angle Dinamis (3 – 20): |
| 1527 | `customAngleTheme` | 🎯 Arah Tema Khusus / Topik Panduan (Opsional - Biarkan Kosong Agar AI Eksplorasi Penuh): |
| 1666 | `selectedAngleIds` | 🎯 2. Tipe Kampanye & Target Konten |
| 1742 | `editorialOutro` | ✍️ Atau Tulis Manual Pesan Moral / Closing Outro (Opsional): |
| 1767 | `bridgingMode` | Pilih dari Pustaka |
| 1771 | `bridgingMode` | Tulis Manual |
| 1775 | `bridgingMode` | Ekstrak dari URL |
| 1783 | `productSearchQuery` | Pilih Produk ( Bisa Pilih Banyak ) |
| 1815 | `isSelected` | Pilih Produk ( Bisa Pilih Banyak ) |
| 1840 | `productUrl` | URL Detail Produk Tokopedia/Shopee |
| 1844 | `affiliateUrl` | URL Affiliate Rekomendasi (Opsional) |
| 1853 | `manualProductName` | Nama Produk |
| 1858 | `manualProductDesc` | Deskripsi USP Produk |
| 1862 | `manualProductUsp` | Keywords / Hashtags Produk |
| 1872 | `bridgingMode` | Pilih Banyak dari Pustaka |
| 1876 | `bridgingMode` | Daftar URL Produk Massal |
| 1884 | `productSearchQuery` | Pilih Produk ( Bisa Pilih Banyak ) |
| 1918 | `isSelected` | Pilih Produk ( Bisa Pilih Banyak ) |
| 1942 | `massUrlsText` | Daftar URL Produk Massal (Satu URL per Baris, Format: `url_produk/url_affiliate_opsional`) |
| 2008 | `selectedPresetKey` | 📋 Gunakan Preset: |
| 2052 | `selectedBrandId` | 🏷️ Nama Akun (Brand Account) |
| 2074 | `campaignName` | Nama Kampanye |
| 2085 | `nextcloudParentFolder` | Parent Folder Nextcloud |
| 2096 | `targetLanguage` | Bahasa Naskah Voiceover (Script Language) |
| 2104 | `targetDemographic` | 🎯 Target Demografi & Tone Bahasa |
| 2113 | `targetDemographicCustom` | 🎯 Target Demografi & Tone Bahasa |
| 2126 | `enableAudioSegment` | 🎙 Audio Segment (per Klip) |
| 2134 | `sfxSetting` | SFX Setting |
| 2142 | `enableVoAudit` | Audit Kepatuhan Voiceover (TikTok Safe) |
| 2152 | `generateRecipe` |  |
| 2170 | `aiDirective` | AI Directive / Guardrail (Staging Override) |
| 2181 | `mandatoryOutroLine` | Mandatory Outro Line (Staging Override) |
| 2192 | `customInstruction` | Custom Instruction (Opsional) |
| 2217 | `narrativeMode` | Narrative Mode |
| 2227 | `aspectRatio` | Aspect Ratio |
| 2236 | `targetAi` | Target AI |
| 2243 | `videoModel` | Video Model |
| 2263 | `clipDuration` | Durasi per Klip |
| 2283 | `faceVisibility` | Face Visibility |
| 2293 | `targetClipsCount` | Jumlah Klip Video (N) |
| 2305 | `wordsPerClip` | Jumlah Kata Per Klip ( 8 s) |
| 2314 | `visualStyle` | Visual Style |
| 2323 | `visualMode` | Visual Mode |
| 2344 | `isBridgingActive` | is Bridging Active |
| 2357 | `bridgeAtClip` | Sisipkan Transisi Promosi pada Klip Ke- (X) |
| 2369 | `bridgeDurationClips` | Durasi Bridging Produk (Klip) |
| 2380 | `promotionStyle` | Gaya Promosi |
| 2404 | `field_2404` | field_2404 |
| 2437 | `isVsoActive` |  |
| 2450 | `visualIdentity` | Visual Identity Settings |

### recipeStatic

Sumber: `app/recipe-labs/page.js`.

| Baris | State/kontrol | Label sumber |
| --- | --- | --- |
| 1043 | `deconstructSearchQuery` | 🔍 |
| 1080 | `sourceDeconstructAssetId` | source Deconstruct Asset Id |
| 1139 | `category` | Kategori Resep |
| 1153 | `customCategory` | Nama Kategori Custom |
| 1165 | `visualStyle` | Visual Style (Fotografi AI) |
| 1178 | `nextcloudParentFolder` | Parent Folder Nextcloud Hub |
| 1189 | `targetCount` | Jumlah Resep |
| 1221 | `enableGlabs` |  |
| 1378 | `selectedLayoutId` | selected Layout Id |
| 1411 | `gridGapSize` | Celah (Gap):  12 px |
| 1427 | `gridBorderRadius` | Radius:  16 px |
| 1445 | `gridOuterPadding` | Padding:  16 px |
| 1459 | `gridBgColor` | Warna Latar Grid |
| 1473 | `gridBgColor` | Warna Latar Grid |
| 1591 | `targetDemographic` | 🎯 Target Demografi & Tone Bahasa |
| 1600 | `targetDemographicCustom` | 🎯 Target Demografi & Tone Bahasa |
| 1624 | `brandProfileId` | 🏷️ Nama Akun (Brand Profile DNA Kuliner) |

### recipeVideo

Sumber: `app/recipe-labs/page.js`.

| Baris | State/kontrol | Label sumber |
| --- | --- | --- |
| 1677 | `deconstructSearchQuery` | 🔍 |
| 1714 | `sourceDeconstructAssetId` | source Deconstruct Asset Id |
| 1773 | `accountName` | 🏷️ Nama Akun (Brand Account) |
| 1797 | `campaignName` | Nama Kampanye * |
| 1807 | `spreadsheetId` | Google Spreadsheet ID (Aset Teks/Storage) |
| 1816 | `targetLanguage` | Bahasa Naskah Voiceover |
| 1829 | `contentPillar` | Pilar Konten / Fokus Kuliner |
| 1841 | `customHook` | Naskah Hook Awal (Klip 1 - Opsional) |
| 1850 | `brandProfileId` | Brand Profile DNA Kuliner (Opsional) |
| 1865 | `visualActionGuideline` | Petunjuk Aksi Visual (Visual Action Guideline) |
| 1875 | `customInstruction` | Custom Instruction (Gemini) |
| 1885 | `nextcloudParentFolder` | Parent Folder Nextcloud Hub |
| 1914 | `narrativeMode` | Narrative Mode |
| 1922 | `visualStyleVideo` | Visual Style (Fotografi AI) |
| 1930 | `targetAi` | Target Engine Video |
| 1940 | `videoModel` | Model Video |
| 1948 | `aspectRatio` | Aspect Ratio |
| 1955 | `faceVisibility` | Face Visibility |
| 1965 | `wordsPerClip` | Panjang Voiceover per Klip |
| 1996 | `isBridgingActive` |  |
| 2008 | `targetClipsCount` | Jumlah Total Klip (Target Clips Count) |
| 2012 | `bridgeAtClip` | Bridge at Clip (Posisikan di klip ke-N) |
| 2016 | `promotionStyle` | Promotion Style |
| 2026 | `bridgingMode` | Metode Bridging Produk |
| 2033 | `visualMode` | Visual Mode |
| 2043 | `targetProductId` | Pilih Produk |
| 2054 | `manualProductName` | Nama Produk Manual |
| 2058 | `manualProductDesc` | Deskripsi Produk |
| 2062 | `manualProductUsp` | USP Produk (Unique Selling Point) |
| 2066 | `productUrl` | Tautan / URL Shopee/Tokopedia |
| 2103 | `isVsoActive` |  |
| 2112 | `characterConcept` | Konsep Karakter (Framing) |
| 2122 | `subjectDemographic` | Demografi Subjek / Model |
| 2146 | `wardrobeStyle` | Pakaian / Wardrobe |
| 2209 | `wardrobeStyleCustom` | Pakaian / Wardrobe |
| 2228 | `lightingStyle` | Pencahayaan & Atmosfer (Lighting Ambiance) |
| 2237 | `lightingStyleCustom` | Pencahayaan & Atmosfer (Lighting Ambiance) |
| 2283 | `enableTts` |  |
| 2294 | `voiceProvider` | TTS Provider |
| 2301 | `voicePersona` | Voice Persona / Model |
| 2310 | `voiceSpeed` | Speed ( 1 x) |
| 2314 | `voiceVolume` | Volume ( 1 ) |
| 2319 | `ttsModelQuality` | MiniMax Model Quality |
| 2335 | `enableGlabsVideo` |  |
| 2357 | `enableFfmpeg` |  |
| 2378 | `syncMode` | Auto-Pilot Smart Sync (Sangat Direkomendasikan) |
| 2392 | `syncMode` | Kustom Manual (Terbuka untuk Profesional) |
| 2410 | `ffmpegSyncOption` | Metode Manual |
| 2426 | `ffmpegVideoScale` | Video Scale (Zoom):   % |
| 2446 | `ffmpegSfxVolume` | SFX Volume:   % |
| 2463 | `ffmpegBgmVolume` | BGM Volume:   % |
| 2486 | `enableSocialPost` |  |
| 2504 | `facebookPageId` | Halaman Facebook Target |
| 2519 | `facebookServerUrl` | URL Server Publik untuk Media |

### identity

Sumber: `app/components/VisualIdentitySelector.js`.

| Baris | State/kontrol | Label sumber |
| --- | --- | --- |
| 242 | `field_242` | Select Preset |
| 292 | `field_292` | Legacy Demographic |
| 307 | `field_307` | Wardrobe Mode / Key |
| 325 | `field_325` | Custom Wardrobe Prompt |
