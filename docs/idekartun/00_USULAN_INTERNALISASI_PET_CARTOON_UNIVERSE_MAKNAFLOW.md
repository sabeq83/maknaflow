# Usulan Internalisasi Pet Cartoon Universe ke MAKNA Flow

## 1. Ringkasan Eksekutif

MAKNA Flow dapat dikembangkan agar mampu merencanakan konten kartun berbasis karakter untuk membangun akun yang kelak mempromosikan produk pet supplies. Namun, kebutuhan ini tidak cukup dipenuhi dengan menambahkan pilihan visual style seperti `Cartoon` atau `3D Clay Animation`.

PawVille memiliki dunia, karakter tetap, aturan visual, pola cerita, dan logika integrasi produk sendiri. Karena itu, kapabilitas baru yang disarankan adalah **Content Universe / Story World**, dengan PawVille sebagai preset pertama.

Prinsip utama usulan ini:

1. Memisahkan **tujuan kampanye**, **dunia konten**, **domain pengetahuan**, dan **visual style**.
2. Mempertahankan Content Planner sebagai perencana editorial, bukan langsung menjadi generator produksi lengkap.
3. Memuat KB secara kondisional agar instruksi dunia realistis tidak bertentangan dengan instruksi kartun.
4. Membuat PawVille sebagai universe profile yang reusable, bukan aturan global MAKNA.
5. Menyiapkan fondasi generik agar kelak dapat mendukung universe dan niche lain.

---

## 2. Latar Belakang

Tiga dokumen awal di folder ini menggambarkan konsep akun affiliate pet supplies bernama **PawVille Pet Universe**. Kontennya menggunakan karakter hewan konsisten, cerita ringan, dan produk sebagai solusi alami dalam alur cerita.

Contoh struktur episodenya:

1. Masalah terlihat secara visual.
2. Konflik ringan berkembang.
3. Karakter menemukan penyebab atau kebutuhan.
4. Produk diperkenalkan sebagai solusi.
5. Fungsi produk didemonstrasikan.
6. Masalah mulai terselesaikan.
7. Cerita ditutup secara emosional dengan CTA ringan.

Konsep tersebut cocok untuk membangun audience sebelum melakukan promosi produk secara intensif karena akun mempunyai aset naratif sendiri: karakter, relasi, lokasi, dan serial cerita.

---

## 3. Temuan Audit MAKNA Flow Saat Ini

### 3.1 Content Planner masih berorientasi dunia nyata

Strategic Skeleton saat ini meminta konteks situasi yang realistis berdasarkan W'S Matrix. Creative Generator juga selalu memuat `REALIST_VIRAL_NARRATIVE`, sehingga model cenderung menghasilkan:

- manusia atau aktivitas manusia;
- situasi rumah, kantor, dapur, atau lifestyle nyata;
- konflik eksternal realistis;
- visual action yang ditulis untuk live action atau UGC.

### 3.2 KB visual memiliki konflik dengan kebutuhan kartun

Beberapa instruksi global mengutamakan photorealism dan bahkan memasukkan kata berikut ke negative prompt:

- cartoon;
- illustration;
- 3D render;
- CGI;
- anime.

Jika semua KB tetap dimuat bersama, prompt dapat berisi dua instruksi yang berlawanan: wajib membuat animasi kartun sekaligus dilarang membuat kartun.

### 3.3 Content Planner belum mempunyai konsep universe

Data planner saat ini belum menyimpan:

- content world;
- domain pet supplies;
- universe profile;
- karakter utama dan pendukung;
- aturan anatomi dan kontinuitas karakter;
- lokasi tetap;
- peran produk dalam cerita;
- beat kemunculan produk;
- keberadaan atau larangan manusia.

### 3.4 Output planner masih berada pada level ide

Setiap row planner terutama menghasilkan Strategic Skeleton, hook, dan visual action. Ini tepat untuk kalender konten, tetapi belum sama dengan storyboard tujuh scene, prompt T2I, dan prompt I2V yang dicontohkan dalam dokumen PawVille.

### 3.5 Fondasi mascot sebenarnya sudah ada

Beberapa workflow produksi MAKNA sudah mengenal mascot universe dan visual style preset seperti 3D claymation. Fondasi tersebut dapat digunakan kembali. Kekurangan utamanya berada pada tahap perencanaan dan routing KB, bukan semata-mata pada pilihan visual produksi.

---

## 4. Model Konseptual yang Diusulkan

Content Planner perlu membedakan empat dimensi berikut.

### 4.1 Campaign Focus

Menentukan tujuan planner:

- `product_campaign`: berpusat pada satu produk;
- `brand_editorial`: membangun audience, authority, dan engagement akun.

Untuk fase awal pembangunan akun PawVille, mode utama yang disarankan adalah `brand_editorial`. Produk tetap dapat muncul pada sebagian episode melalui metadata product integration.

### 4.2 Content World

Menentukan hukum dunia dan subjek cerita:

- `real_world`: manusia dan lingkungan nyata;
- `real_animal`: hewan nyata tanpa antropomorfisme kuat;
- `cartoon_universe`: dunia fiksi dengan karakter, lokasi, dan continuity bible.

### 4.3 Knowledge Domain

Menentukan pengetahuan vertikal yang diperlukan:

- pet supplies;
- food and culinary;
- beauty;
- parenting;
- home living;
- domain lain pada masa mendatang.

### 4.4 Visual Style

Menentukan tampilan, bukan hukum dunia:

- Cinematic Live Action;
- UGC;
- Cinematic 3D Clay Animation;
- Stylized 3D Animation;
- 2D Storybook;
- Stop Motion;
- visual style lainnya.

Dengan pemisahan ini, `cartoon_universe` dapat menggunakan beberapa visual style tanpa kehilangan identitas cerita dan kontinuitasnya.

---

## 5. Arsitektur Knowledge Base

KB disarankan disusun dalam lapisan berikut:

```text
Global MAKNA KB
├── Strategic Frameworks
├── Brand Voice dan Platform Copywriting
├── CTA dan Compliance
├── Domain KB
│   └── Pet Content KB
├── World Mode KB
│   ├── Real World Narrative
│   ├── Real Animal Narrative
│   └── Cartoon Universe Story Engine
├── Visual Mode KB
│   ├── Realistic Visual Guide
│   └── Cartoon Visual Continuity Guide
└── Universe Profiles
    └── PawVille
        ├── World Bible
        ├── Character Bible
        ├── Location Bible
        ├── Visual Bible
        └── Continuity Rules
```

### 5.1 `PET_CONTENT_KB.md`

KB domain pet sebaiknya memuat:

- kategori kucing, anjing, dan hewan lain yang didukung;
- perilaku observable yang aman digunakan sebagai konflik;
- taxonomy kebutuhan dan kategori pet supplies;
- problem-to-product mapping;
- ide rutinitas dan situasi pemilik/hewan;
- aturan keselamatan;
- larangan diagnosis veteriner tanpa dasar;
- larangan klaim medis dan klaim absolut;
- pilihan wording fungsional yang lebih aman.

KB ini harus dapat dipakai oleh konten hewan nyata maupun kartun.

### 5.2 `CARTOON_UNIVERSE_STORY_ENGINE.md`

KB ini mengatur pola cerita kartun secara generik:

1. Visual Hook.
2. Problem Development.
3. Discovery.
4. Solution Introduction.
5. Product Demonstration.
6. Resolution.
7. Emotional Closing dan CTA.

Aturan tambahannya:

- satu aksi utama per scene;
- cerita tetap terbaca tanpa voice-over;
- konflik tidak terlalu dramatis;
- produk tidak muncul sebelum masalah dipahami;
- produk bukan deus ex machina;
- CTA hanya pada bagian akhir;
- antropomorfisme tidak boleh merusak ciri dasar spesies.

### 5.3 `CARTOON_VISUAL_CONTINUITY_KB.md`

KB ini mengatur:

- character identity lock;
- species dan anatomy lock;
- warna bulu, mata, pakaian, dan aksesori;
- prop dan product geometry lock;
- skala antar-karakter;
- hubungan spasial lokasi;
- ekspresi dan secondary motion;
- camera movement yang aman untuk I2V;
- negative prompt khusus animasi;
- larangan morphing, extra limbs, wardrobe drift, dan style drift.

### 5.4 PawVille Universe Profile

PawVille sebaiknya disimpan sebagai data/profile, bukan disatukan ke KB global. Isinya antara lain:

- nama dan premis universe;
- tone;
- daftar karakter;
- peran dan hubungan karakter;
- canonical character descriptions;
- lokasi utama;
- visual identity;
- human-presence rule;
- product-integration rule;
- CTA personality;
- daftar episode dan elemen yang pernah digunakan.

---

## 6. Conditional KB Routing

KB tidak boleh lagi selalu digabungkan secara identik untuk semua jenis konten.

### 6.1 Real World

```text
Strategic Frameworks
+ Realist Viral Narrative
+ Realistic Visual Style Guide
+ Brand Voice
+ Platform Copywriting
+ Compliance
+ CTA Rules
```

### 6.2 Real Animal / Pet

```text
Strategic Frameworks
+ Pet Content KB
+ Real Animal Narrative
+ Realistic Visual Style Guide
+ Brand Voice
+ Platform Copywriting
+ Pet Compliance
+ CTA Rules
```

### 6.3 Cartoon Universe

```text
Strategic Frameworks
+ Pet Content KB
+ Cartoon Universe Story Engine
+ Cartoon Visual Continuity KB
+ Selected Universe Profile
+ Brand Voice
+ Platform Copywriting
+ Pet Compliance
+ CTA Rules
```

Jika mode `cartoon_universe` aktif, sistem harus menonaktifkan atau mengganti instruksi berikut:

- `PHOTOREALISTIC RAW`;
- `NO CGI`;
- negative prompt yang melarang cartoon, illustration, atau 3D render;
- keharusan memakai manusia sebagai subjek;
- aturan dunia nyata yang tidak relevan.

Aturan world mode harus memiliki prioritas lebih tinggi daripada default visual global.

---

## 7. Perubahan Content Planner

### 7.1 Input baru

Form Content Planner disarankan menambahkan:

| Input | Fungsi |
|---|---|
| Content World | Memilih real world, real animal, atau cartoon universe |
| Knowledge Domain | Memilih domain seperti pet supplies |
| Universe Profile | Memilih PawVille atau universe lain |
| Main Character | Karakter pusat episode |
| Supporting Characters | Karakter pembantu yang diizinkan |
| Human Presence | Allowed, faceless only, atau none |
| Product Integration | None, incidental, supporting solution, atau primary solution |
| Product Reveal Rule | Menentukan kapan produk boleh terlihat |
| Default Story Format | Contoh: 7 scenes × 8 seconds |

### 7.2 Preset PawVille

Saat PawVille dipilih, sistem dapat mengisi default:

```json
{
  "content_world": "cartoon_universe",
  "knowledge_domain": "pet_supplies",
  "universe_profile": "pawville",
  "visual_style": "cinematic_3d_clay",
  "human_presence": "none",
  "product_reveal_rule": "after_conflict_is_understood",
  "scene_count": 7,
  "scene_duration_seconds": 8,
  "aspect_ratio": "9:16"
}
```

### 7.3 Output setiap planner row

Content Planner tetap menghasilkan ide pada level kalender. Field yang disarankan:

- pillar;
- category CEP;
- W'S Matrix;
- content subject;
- pet problem atau kebutuhan;
- main character;
- supporting characters;
- story premise;
- emotional angle;
- visual hook;
- product role;
- product reveal beat;
- CTA type;
- universe profile ID;
- visual style preset.

Storyboard lengkap belum perlu dihasilkan pada tahap ini agar penggunaan AI tetap efisien.

---

## 8. Hubungan dengan Pipeline Produksi

Alur yang disarankan:

```text
Content Planner
    ↓ memilih ide dan mengunci universe metadata
Strategic/Pillar Campaign
    ↓ mengembangkan 7-beat story dan storyboard
Production Prompt Builder
    ↓ menghasilkan T2I, T2V/I2V, VO, SFX, caption
Renderer/Automation
    ↓ menghasilkan aset dan video
Content Flow
    ↓ review, penjadwalan, dan publikasi
```

Pemisahan tanggung jawab:

- **Content Planner:** menentukan apa yang akan dibuat.
- **Campaign Generator:** menentukan bagaimana ceritanya berlangsung.
- **Production Prompt Builder:** menentukan bagaimana setiap scene dirender.

Dengan desain ini, planner tidak menghasilkan tujuh scene untuk seluruh ide yang mungkin tidak pernah diproduksi.

---

## 9. Character dan Universe Continuity

Konten serial membutuhkan memori yang berbeda dari anti-repetition produk.

### 9.1 Canonical Character Identity

Setiap karakter membutuhkan data terstruktur:

- species dan breed;
- body shape;
- fur color dan pattern;
- eye color;
- wardrobe/accessory;
- personality;
- movement style;
- relative size;
- reference image atau character sheet.

### 9.2 Episode Memory

Sistem perlu menyimpan:

- produk yang pernah digunakan;
- masalah dan konteks yang pernah dipakai;
- karakter yang menjadi protagonis;
- kombinasi supporting characters;
- lokasi;
- hook;
- pola resolusi;
- CTA.

Anti-repetition kemudian bekerja per universe, karakter, dan produk—bukan hanya berdasarkan nama produk.

### 9.3 Product Continuity

Produk affiliate tetap harus mengikuti bentuk referensi produk:

- geometri;
- warna;
- komponen;
- posisi fitur utama;
- ukuran relatif terhadap karakter;
- bagian produk yang boleh bergerak.

Logo merek dapat disembunyikan jika diperlukan, tetapi bentuk produk tidak boleh berubah antar-scene.

---

## 10. Pet Safety dan Compliance

Karena kontennya kartun, penonton dapat lebih mudah menganggap hubungan sebab-akibat sebagai fakta. Karena itu, aturan pet compliance tetap wajib.

Hindari alur seperti:

> Air dalam mangkuk diam menyebabkan Mochi lesu, lalu dokter memastikan fountain menyelesaikan masalah kesehatan.

Gunakan perilaku observable:

> Mochi mengendus mangkuk, kehilangan minat, lalu pergi. Aliran air fountain menarik perhatiannya untuk kembali mendekat.

Aturan yang disarankan:

- tidak mendiagnosis kondisi medis;
- tidak menjanjikan kesehatan atau perubahan perilaku secara pasti;
- tidak menggambarkan produk sebagai pengganti dokter hewan;
- tidak menggunakan ketakutan berlebihan;
- membedakan fakta produk dari interpretasi kreatif;
- menggunakan kata seperti `membantu`, `dirancang untuk`, atau `dapat menjadi pilihan`;
- CTA tidak boleh menyamarkan klaim yang belum terverifikasi.

Karakter Dr. Paw lebih aman diposisikan sebagai observer, inventor, atau problem solver. Bila ia tetap beridentitas dokter, dialog dan tindakannya tidak boleh membentuk diagnosis medis tanpa dasar.

---

## 11. Konsolidasi Tiga Dokumen Awal

Ketiga dokumen yang ada saat ini memiliki materi yang baik tetapi sebagian isinya berulang. Struktur jangka panjang yang disarankan:

1. **Pet Cartoon Universe Engine** — aturan generik dan reusable.
2. **PawVille Universe Profile** — world dan character bible khusus PawVille.
3. **Water Fountain Example Campaign** — contoh implementasi satu produk.

Prompt builder tidak sebaiknya disimpan sebagai satu prompt monolitik. Runtime prompt seharusnya dirakit dari modul KB sesuai content world, domain, universe, produk, dan output stage.

---

## 12. Tahapan Implementasi yang Disarankan

### Tahap 1 — MVP World-Aware Planner

- menambahkan Content World dan Knowledge Domain;
- membuat Pet Content KB;
- membuat Cartoon Universe Story Engine;
- membuat Cartoon Visual Continuity KB;
- membuat PawVille Universe Profile;
- menerapkan conditional KB routing;
- menyimpan universe metadata pada planner dan planner row;
- menambahkan preset PawVille di Content Planner.

**Hasil:** Content Planner dapat menghasilkan kalender ide PawVille yang tidak lagi dipaksa mengikuti dunia manusia realistis.

### Tahap 2 — Storyboard dan Production Continuity

- meneruskan universe metadata ke campaign generator;
- membuat story expansion tujuh beat;
- membuat character reference/identity lock;
- membuat location dan product geometry lock;
- menghasilkan prompt T2I dan I2V yang world-aware;
- menambahkan validation untuk continuity, product reveal, dan pet claims.

**Hasil:** Ide terpilih dapat menjadi storyboard serta prompt produksi yang konsisten.

### Tahap 3 — Universe Platform

- membuat Universe Manager;
- membuat Character Library dan Location Library;
- mendukung reference sheet per karakter;
- membuat episode history dan relationship memory;
- mendukung berbagai universe dan niche;
- menyediakan reusable story templates.

**Hasil:** MAKNA Flow menjadi platform serial character content, bukan hanya satu preset PawVille.

---

## 13. Batasan MVP

Untuk menjaga implementasi awal tetap terkendali, MVP tidak perlu langsung mencakup:

- editor visual universe yang kompleks;
- generator karakter otomatis;
- seluruh spesies hewan;
- automatic rendering dari Content Planner;
- percakapan multi-karakter dengan lip-sync;
- branching narrative;
- lebih dari satu universe aktif dalam satu planner.

MVP cukup membuktikan bahwa satu akun PawVille dapat menghasilkan ide editorial dan product campaign yang konsisten, aman, dan dapat diteruskan ke workflow produksi yang ada.

---

## 14. Kriteria Keberhasilan

Implementasi dianggap berhasil bila:

- Content Planner dapat membedakan dunia nyata dan cartoon universe;
- mode PawVille tidak menerima instruksi photorealism yang bertentangan;
- planner menghasilkan masalah pet yang observable dan relevan;
- karakter, lokasi, serta aturan dunia ikut tersimpan pada row;
- produk masuk secara natural setelah konflik dipahami;
- ide editorial tanpa produk tetap dapat dibuat;
- row terpilih dapat dikembangkan menjadi tujuh scene;
- prompt produksi menjaga karakter dan produk tetap konsisten;
- klaim pet supplies lolos compliance;
- workflow dunia nyata yang sudah ada tidak berubah perilakunya.

---

## 15. Keputusan Desain yang Direkomendasikan

1. **Bangun `Cartoon Universe`, bukan `PawVille Mode` yang hardcoded.** PawVille menjadi preset pertamanya.
2. **Pisahkan Content World dari Visual Style.** Kartun adalah hukum dunia dan format naratif, bukan hanya tampilan.
3. **Gunakan conditional KB routing.** Jangan memuat seluruh KB realistis ke prompt kartun.
4. **Simpan PawVille sebagai universe profile.** Karakter dan lokasi harus menjadi data yang dapat digunakan kembali.
5. **Pertahankan Content Planner pada level ide.** Storyboard dan production prompt dibuat setelah ide dipilih.
6. **Gunakan fondasi mascot workflow yang sudah ada.** Hindari membangun pipeline produksi kedua yang terpisah.
7. **Tambahkan pet-specific compliance.** Konten kartun tetap tidak boleh membuat diagnosis atau klaim medis tersirat.

---

## 16. Rekomendasi Akhir

Langkah terbaik adalah menjadikan PawVille sebagai use case pertama dari kapabilitas generik **World-Aware Content Planning**.

Arsitektur ini memungkinkan MAKNA Flow menghasilkan:

- konten manusia di dunia nyata;
- konten hewan realistis;
- serial kartun pet supplies;
- universe karakter lain pada masa mendatang;

tanpa mencampurkan aturan visual dan naratif yang saling bertentangan.

Dengan pendekatan tersebut, PawVille bukan sekadar tambahan visual style, melainkan aset IP konten yang dapat direncanakan, diproduksi, diingat, dan dikembangkan secara konsisten di dalam MAKNA Flow.
