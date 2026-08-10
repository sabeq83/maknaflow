# Tahap 3.6 — Universe Starter Presets

## Instruksi untuk Antigravity Agent

Kerjakan hanya **Tahap 3.6 — Universe Starter Presets** setelah Tahap 3.5 selesai, stabil, dan seluruh migrasinya tersedia.

Tujuan tahap ini adalah membuat user dapat membangun universe baru dari preset tanpa mengisi Universe Profile, aturan, karakter, dan lokasi satu per satu.

Jangan mengubah arsitektur Universe Manager, Character Reference Lock, Content Planner, atau OPC yang sudah stabil. Jangan melakukan deployment Production.

---

## 1. Target Hasil

Pada halaman **Universe Manager**, ketika user memilih **New Universe**, tampilkan dua pilihan:

```text
Create from Preset
Start from Blank
```

Jika memilih preset, sistem harus:

1. menampilkan daftar preset bawaan;
2. menampilkan ringkasan isi preset;
3. meminta nama universe dan slug milik user;
4. mengkloning Universe Profile;
5. mengkloning starter characters;
6. mengkloning starter locations;
7. membuka universe hasil clone untuk diedit;
8. tidak mengubah system preset asli.

Preset adalah template immutable. Universe hasil clone adalah record tenant biasa dan bebas diedit.

---

## 2. Knowledge Base dan Isolasi Routing

Setiap preset domain wajib memiliki Knowledge Base yang relevan. `knowledge_domain`, `rules_json`, dan depiction policy saja tidak dianggap sebagai Knowledge Base lengkap.

Tambahkan KB domain:

```text
kb/HERBAL_CONTENT_KB.md
kb/KITCHEN_CONTENT_KB.md
kb/HOME_IMPROVEMENT_KB.md
kb/HISTORY_CONTENT_KB.md
kb/ISLAMIC_HISTORY_CONTENT_KB.md
```

Pertahankan KB yang sudah tersedia:

```text
kb/PET_CONTENT_KB.md
kb/CARTOON_UNIVERSE_STORY_ENGINE.md
kb/CARTOON_VISUAL_CONTINUITY_KB.md
kb/universes/PAWVILLE_UNIVERSE_PROFILE.md
```

Tambahkan universe profile KB:

```text
kb/universes/HERBAL_GROVE_UNIVERSE_PROFILE.md
kb/universes/KITCHEN_TOWN_UNIVERSE_PROFILE.md
kb/universes/RUMAH_RAPI_UNIVERSE_PROFILE.md
kb/universes/JEJAK_PERADABAN_ISLAM_UNIVERSE_PROFILE.md
```

Gunakan routing domain terisolasi:

```text
pet_supplies     -> PET_CONTENT_KB
herbal           -> HERBAL_CONTENT_KB
kitchen          -> KITCHEN_CONTENT_KB
home_improvement -> HOME_IMPROVEMENT_KB
history          -> HISTORY_CONTENT_KB
islamic_history  -> HISTORY_CONTENT_KB + ISLAMIC_HISTORY_CONTENT_KB
general          -> tidak memuat domain KB khusus
```

Semua `cartoon_universe` tetap menerima KB bersama:

```text
CARTOON_UNIVERSE_STORY_ENGINE
CARTOON_VISUAL_CONTINUITY_KB
```

Aturan routing wajib:

- `PET_CONTENT_KB` hanya dimuat jika `knowledge_domain = pet_supplies`;
- jangan memuat seluruh domain KB sekaligus;
- universe profile KB hanya dimuat jika slug/profile sesuai;
- hapus fallback yang memasukkan `PAWVILLE_UNIVERSE_PROFILE` ke universe non-PawVille;
- jika profile KB khusus tidak ditemukan, gunakan snapshot database dan KB bersama, bukan PawVille;
- samakan routing Content Planner, OPC prompt builder, regeneration, dan worker terkait;
- buat satu registry/helper routing sebagai sumber kebenaran;
- masukkan KB baru ke mekanisme seed/load KB existing agar tersedia bagi pipeline yang membaca tabel `knowledge_bases`.

Konten minimum setiap domain KB:

- ruang lingkup domain;
- terminologi dan fakta dasar yang aman;
- topik atau masalah yang diperbolehkan;
- batas klaim dan konten terlarang;
- aturan narasi;
- aturan visual domain;
- checklist reviewer.

Ketentuan khusus:

- Herbal: tidak boleh mendiagnosis, menjanjikan kesembuhan, menggantikan tenaga medis, atau memakai klaim keamanan absolut.
- Kitchen: fokus alat, organisasi, penggunaan, dan keselamatan; jangan berubah menjadi KB resep.
- Home Improvement: bedakan perawatan ringan dari kelistrikan, struktur, gas, dan pekerjaan berbahaya.
- History: cegah anakronisme dan bedakan fakta, interpretasi, serta cerita populer.
- Islamic History: selalu memakai History KB ditambah depiction policy, aturan sumber, dan larangan representasi Nabi.

Universe profile KB berisi world bible spesifik: premis, tone, karakter awal, lokasi awal, visual style, aturan kontinuitas, dan hal yang dilarang. Jangan menduplikasi seluruh domain KB di dalam profile KB.

---



## 3. Arsitektur Preset MVP

Gunakan **code-defined system presets** yang versioned, misalnya:

```text
lib/universe-presets.js
```

Jangan membuat tabel database preset atau CRUD preset pada Tahap 3.6.

Setiap preset minimal memiliki kontrak:

```js
{
  key: 'pawville_pet_story',
  version: 1,
  label: 'PawVille Pet Story',
  description: '...',
  icon: '🐾',
  profile: {
    premise: '...',
    tone: '...',
    knowledge_domain: 'pet_supplies',
    universe_type: 'animal',
    depiction_policy: null,
    historical_period: null,
    human_presence: 'none',
    default_visual_style: '...',
    default_aspect_ratio: '9:16',
    default_scene_count: 7,
    default_scene_duration: 8,
    default_story_template: 'pet_problem_solution_7beat',
    cta_personality: '...',
    default_pillars_json: [],
    rules_json: {},
    negative_prompts_json: [],
    style_reference_path: null
  },
  characters: [],
  locations: []
}
```

Gunakan nama field database Tahap 3.5 yang sebenarnya. Jangan memperkenalkan alias baru seperti `visual_style`, `scene_count`, atau `story_template` di layer data preset jika database menggunakan `default_visual_style`, `default_scene_count`, dan `default_story_template`.

---

## 4. System Preset yang Wajib

Sediakan enam preset berikut.

### 4.1 PawVille Pet Story

```text
Key: pawville_pet_story
Universe Type: animal
Knowledge Domain: pet_supplies
Story Template: pet_problem_solution_7beat
Characters: Mochi, Coco, Dr. Paw
Locations: PawVille Town Square, Mochi's House, Dr. Paw's Clinic
Default Scenes: 7
Default Duration: 8
```

Ketentuan:

- Gunakan canonical prompt, forbidden changes, depiction mode, dan reference path PawVille yang sudah tersedia.
- Jangan membuat versi identitas karakter baru.
- Reference path hanya boleh disalin jika file sumber benar-benar tersedia.
- Pertahankan kompatibilitas dengan Character Reference Lock Tahap 2.5.

### 4.2 Herbal Grove

```text
Key: herbal_grove
Universe Type: mascot_object
Knowledge Domain: herbal
Story Template: educational_discovery_7beat
Characters: Jahe Guardian, Kunyit Wisdom, Mint Breeze
Locations: Herbal Garden, Rumah Seduh, Pasar Herbal
Default Scenes: 7
Default Duration: 8
```

Terapkan aturan bahwa konten bersifat edukatif dan tidak boleh menghasilkan klaim medis, diagnosis, jaminan kesembuhan, atau klaim keamanan absolut.

Reuse deskripsi mascot Herbal Universe dari VSO Engine sebagai dasar canonical prompt. Jangan membuat definisi karakter paralel yang bertentangan.

### 4.3 Kitchen Town

```text
Key: kitchen_town
Universe Type: mascot_object
Knowledge Domain: kitchen
Story Template: problem_solution_7beat
Characters: Pan Guardian, Blender Tornado, Spatula Flex
Locations: Cozy Kitchen, Preparation Table, Kitchen Cabinet
Default Scenes: 7
Default Duration: 8
```

Fokus pada alat dapur, organisasi, keamanan penggunaan, dan problem-solving. Jangan mencampurnya dengan domain resep `food_culinary`.

Reuse deskripsi mascot Kitchen Universe dari VSO Engine.

### 4.4 Rumah Rapi

```text
Key: rumah_rapi
Universe Type: mascot_object
Knowledge Domain: home_improvement
Story Template: problem_solution_7beat
Characters: Vacuum Hunter, Broom Sweeper, Storage Box Keeper
Locations: Living Room, Storage Room, Laundry Area
Default Scenes: 7
Default Duration: 8
```

Fokus pada kebersihan, penataan, perawatan, dan perbaikan ringan rumah. Hindari instruksi kelistrikan atau pekerjaan berbahaya tanpa peringatan keselamatan.

Reuse deskripsi mascot Home Living Universe dari VSO Engine.

### 4.5 Jejak Peradaban Islam

```text
Key: jejak_peradaban_islam
Universe Type: human
Knowledge Domain: islamic_history
Story Template: historical_explainer_7beat
Characters: Pemandu Fiktif, Tokoh Historis Generik
Locations: Baghdad Abbasiyah, Andalusia
Default Scenes: 7
Default Duration: 8
Historical Period: Abad ke-7 sampai abad ke-15
```

Gunakan depiction policy Tahap 3.5:

```text
Dilarang memvisualisasikan Nabi Muhammad ﷺ dan para nabi. Tokoh sensitif
harus direpresentasikan melalui lingkungan, benda, jejak perjalanan,
siluet dari belakang, atau narasi tanpa menampilkan wajah. Jangan membuat
kutipan, dialog, atau peristiwa sejarah tanpa dasar sumber. Hindari
anakronisme pakaian, arsitektur, benda, dan teknologi. Konflik tidak boleh
ditampilkan secara sadis atau eksplisit.
```

Ketentuan karakter:

- Pemandu Fiktif: `depiction_mode = normal`;
- Tokoh Historis Generik: `depiction_mode = faceless`;
- jangan membuat representasi Nabi atau tokoh yang dilarang depiction policy.

Jika seed Tahap 3.5 sudah menyediakan data yang sama, jadikan data tersebut sebagai sumber atau samakan secara eksplisit. Jangan memelihara dua definisi yang mudah drift.

### 4.6 General Clay Story

```text
Key: general_clay_story
Universe Type: human
Knowledge Domain: general
Story Template: general_story_7beat
Characters: kosong
Locations: kosong
Default Scenes: 7
Default Duration: 8
```

Preset ini menjadi starting point fleksibel untuk universe manusia non-sejarah.

---

## 5. API Preset

Tambahkan endpoint read-only:

```text
GET /api/v2/universe-presets
GET /api/v2/universe-presets/[key]
```

Respons tidak boleh mengekspos path filesystem absolut.

Tambahkan endpoint instantiate:

```text
POST /api/v2/universe-presets/[key]/instantiate
```

Payload minimal:

```json
{
  "name": "Nama Universe User",
  "slug": "nama-universe-user"
}
```

Perilaku wajib:

- gunakan `withTenantContext`;
- validasi preset key;
- validasi dan normalisasi slug;
- tolak slug yang sudah digunakan tenant;
- generate ID baru untuk profile, setiap character, dan setiap location;
- semua child record harus mengarah ke universe ID baru;
- jangan menerima profile, characters, rules, atau locations mentah dari browser;
- sumber data clone harus berasal dari registry preset server;
- lakukan clone secara atomik/transactional;
- jika salah satu insert gagal, jangan meninggalkan universe parsial;
- kembalikan ID universe hasil clone.

Jangan membuat endpoint edit/delete untuk system preset.

---

## 6. Asset dan Reference Image

Aturan reference:

- Preset boleh menunjuk asset bawaan yang memang tersedia di `public/universe-assets`.
- Jangan menyatakan reference tersedia hanya berdasarkan string path; periksa keberadaan file.
- Jika asset tidak tersedia, simpan `reference_image_path = null`.
- UI hasil clone harus menampilkan `Reference belum tersedia`.
- User dapat mengunggah reference melalui Character atau Location Library setelah clone.
- Jangan menghasilkan gambar secara otomatis.
- Jangan menyalin binary image per tenant pada Tahap 3.6; shared immutable system asset boleh direferensikan oleh hasil clone.
- Penggantian reference oleh user harus menulis path milik universe hasil clone, bukan menimpa shared system asset.

---

## 7. Universe Manager UI

Saat tombol **New Universe** diklik, tampilkan pilihan:

```text
[ Create from Preset ] [ Start from Blank ]
```

### Alur Create from Preset

1. Tampilkan card enam preset.
2. Card berisi icon, label, deskripsi, universe type, knowledge domain, jumlah karakter, dan jumlah lokasi.
3. User memilih satu card.
4. Tampilkan preview ringkas:
   - tone;
   - visual style;
   - story template;
   - pillars;
   - starter characters;
   - starter locations;
   - safety atau depiction policy jika ada.
5. User mengisi `Universe Name` dan `Slug`.
6. Klik **Create Universe**.
7. Panggil endpoint instantiate.
8. Refresh daftar universe.
9. Pilih universe hasil clone dan buka halaman detailnya.

### Alur Start from Blank

Pertahankan form manual Tahap 3.5 tanpa regresi.

UI harus tetap sederhana dan mengikuti style Universe Manager yang sudah ada. Jangan membuat wizard multi-halaman.

---

## 8. Hubungan Preset dengan VSO

Empat universe VSO lama tetap dipertahankan untuk kompatibilitas.

Aturan integrasi:

- preset adalah jalur pembuatan universe permanen di Universe Manager;
- VSO tetap menjadi visual override/preset lama;
- jangan menjadikan VSO sebagai database universe user;
- reuse definisi mascot yang relevan untuk canonical prompt preset;
- hindari copy-paste definisi karakter ke banyak file;
- jangan menghapus opsi VSO lama pada Tahap 3.6.

Universe hasil preset harus dapat dipilih secara dinamis di Content Planner dan tidak membutuhkan VSO aktif untuk bekerja.

---

## 9. Snapshot dan Versi Preset

Saat instantiate, simpan metadata asal preset di `rules_json` tanpa menambah kolom database baru:

```json
{
  "preset_origin": {
    "key": "kitchen_town",
    "version": 1
  }
}
```

Metadata ini hanya untuk audit. Universe hasil clone tidak boleh menerima perubahan otomatis ketika system preset diperbarui.

Jika preset berubah di masa depan, naikkan `version`. Jangan memodifikasi universe user yang sudah dibuat.

---

## 10. Validasi dan Keamanan

Pastikan:

- tenant tidak dapat membaca atau mengubah universe tenant lain;
- slug unik per tenant;
- preset key hanya berasal dari allowlist registry;
- tidak ada arbitrary filesystem path dari request;
- tidak ada arbitrary JSON rules dari request instantiate;
- jumlah child record sesuai preset;
- kegagalan clone menghasilkan rollback;
- tombol submit memiliki loading state dan mencegah double submit;
- request ganda tidak menghasilkan universe parsial atau duplikat slug.

---

## 11. Verifikasi Wajib

Lakukan minimal pengujian berikut:

1. Registry mengembalikan tepat enam preset aktif.
2. Detail preset tidak mengekspos filesystem path absolut.
3. Clone PawVille membuat tiga karakter dan tiga lokasi.
4. Clone Herbal Grove memakai domain `herbal`.
5. Clone Kitchen Town memakai domain `kitchen`.
6. Clone Rumah Rapi memakai domain `home_improvement`.
7. Clone Jejak Peradaban Islam membawa depiction policy dan depiction mode.
8. Clone General Clay Story berhasil tanpa karakter dan lokasi.
9. Setiap clone menghasilkan ID profile dan child yang baru.
10. Slug duplikat ditolak.
11. Preset key tidak valid ditolak.
12. Simulasi kegagalan child insert tidak meninggalkan profile parsial.
13. Shared reference asset tidak tertimpa ketika user mengganti reference.
14. Pet Supplies hanya memuat Pet KB.
15. Herbal hanya memuat Herbal KB dan KB cartoon bersama.
16. Kitchen hanya memuat Kitchen KB dan KB cartoon bersama.
17. Home Improvement hanya memuat Home Improvement KB dan KB cartoon bersama.
18. Islamic History memuat History KB, Islamic History KB, dan KB cartoon bersama.
19. General tidak memuat domain KB khusus.
20. Universe non-PawVille tidak menerima PawVille Universe Profile.
21. Missing universe profile KB tidak melakukan fallback ke PawVille.
22. Universe hasil clone muncul di Content Planner.
23. Universe hasil clone dapat di-import ke OPC.
24. Snapshot tetap membawa field Tahap 3.5.
25. PawVille dan Character Reference Lock Tahap 2.5 tetap berjalan.
26. Alur Start from Blank tetap berjalan.
27. Test Tahap 3 dan 3.5 tetap lulus.
28. Build verification berhasil.

---

## Execution Task List

- [ ] Audit implementasi final Tahap 3.5 dan catat nama field/API aktual.
- [ ] Buat atau perbarui implementation plan dengan Code Sebelum dan Code Sesudah.
- [ ] Buat lima domain KB baru dengan batas, safety rule, dan reviewer checklist.
- [ ] Buat empat universe profile KB baru.
- [ ] Tambahkan domain dan universe KB ke mekanisme seed/load KB existing.
- [ ] Buat registry/helper routing KB sebagai sumber kebenaran.
- [ ] Batasi `PET_CONTENT_KB` hanya untuk domain `pet_supplies`.
- [ ] Hapus fallback PawVille untuk universe non-PawVille.
- [ ] Samakan routing KB pada Content Planner, OPC, regeneration, dan worker terkait.
- [ ] Definisikan kontrak registry system preset.
- [ ] Implementasikan enam system preset.
- [ ] Reuse definisi mascot VSO tanpa membuat sumber identitas yang bertentangan.
- [ ] Implementasikan API list dan detail preset.
- [ ] Implementasikan API instantiate dengan validasi tenant dan slug.
- [ ] Implementasikan transaksi clone profile, characters, dan locations.
- [ ] Implementasikan aturan shared asset dan reference path.
- [ ] Tambahkan metadata `preset_origin` dan version ke `rules_json`.
- [ ] Tambahkan pilihan Create from Preset dan Start from Blank.
- [ ] Tambahkan preset cards dan preview ringkas.
- [ ] Implementasikan loading, error, dan double-submit protection.
- [ ] Verifikasi integrasi Content Planner, OPC, snapshot, dan Character Reference Lock.
- [ ] Jalankan seluruh test Tahap 2.5, 3, 3.5, dan 3.6.
- [ ] Jalankan build verification.
- [ ] Perbarui SOT Universe Manager.
- [ ] Jalankan prosedur rilis repository sesuai SOP.

Centang setiap task hanya setelah benar-benar selesai.

---

## 12. Batasan Tahap 3.6

Tahap ini tidak mencakup:

- CRUD system preset;
- user-created custom preset;
- menyimpan universe user sebagai preset;
- marketplace preset;
- import/export preset;
- generator karakter atau lokasi otomatis;
- pembuatan reference image otomatis;
- multi-image reference manager;
- perubahan otomatis terhadap universe lama ketika preset diperbarui;
- Knowledge Base Manager atau editor KB baru;
- riset sejarah otomatis atau jaminan kebenaran sumber;
- penghapusan VSO lama;
- deployment Production.

---

## 13. Laporan Akhir

Setelah selesai, laporkan:

```text
- File yang diubah
- Struktur registry preset
- Endpoint yang ditambahkan
- Enam preset yang tersedia
- Strategi transaksi dan rollback
- Strategi shared reference asset
- Knowledge Base yang dibuat
- Matrix routing KB per domain dan universe
- Bukti bahwa PawVille KB tidak bocor ke universe lain
- Hasil integrasi Content Planner dan OPC
- Hasil pengujian
- Hasil build
- Versi/tag rilis
- Risiko atau pekerjaan lanjutan
```

Berhenti setelah implementasi, pengujian, dokumentasi, dan prosedur rilis repository selesai. Jangan melanjutkan ke scope lain.
