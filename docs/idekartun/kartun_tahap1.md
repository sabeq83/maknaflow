Kerjakan hanya Tahap 1: World-Aware Content Planner PawVille MVP.

## Target

Content Planner dapat membuat ide:

- `real_world` seperti perilaku lama;
- `real_animal`;
- `cartoon_universe` dengan PawVille sebagai preset pertama.

Storyboard lengkap dan prompt produksi belum dikerjakan pada tahap ini.

## 1. Kontrak data

Buat kontrak/validator terpusat untuk:

- `content_world`
  - `real_world`
  - `real_animal`
  - `cartoon_universe`
- `knowledge_domain`
  - `general`
  - `pet_supplies`
- `universe_profile_id`
- `story_template`
  - default PawVille: `pet_problem_solution_7beat`
- `human_presence`
  - `allowed`
  - `faceless_only`
  - `none`

Gunakan allowlist. Jangan menerima identifier/path KB langsung dari request.

## 2. Knowledge Base

Buat:

- `kb/PET_CONTENT_KB.md`
- `kb/CARTOON_UNIVERSE_STORY_ENGINE.md`
- `kb/CARTOON_VISUAL_CONTINUITY_KB.md`
- `kb/universes/PAWVILLE_UNIVERSE_PROFILE.md`

Pisahkan dengan jelas:

- pet domain knowledge;
- aturan cerita kartun generik;
- aturan kontinuitas visual generik;
- karakter, lokasi, dan identitas khusus PawVille.

Jangan menyalin prompt contoh menjadi prompt runtime monolitik.

## 3. Conditional KB routing

Implementasikan routing KB per AI stage pada Content Planner:

- strategic/skeleton;
- creative generator;
- reviewer.

Jangan hanya mengganti KB AI Call 1.

Untuk `cartoon_universe`:

- muat Pet KB;
- muat Cartoon Story Engine;
- muat Cartoon Visual Continuity;
- muat universe profile terpilih;
- jangan muat instruksi photorealistic/realist narrative yang bertentangan;
- jangan menghasilkan negative instruction yang melarang cartoon, CGI, atau 3D render.

Untuk `real_world`, pertahankan komposisi KB dan perilaku lama.

Utamakan API terpusat seperti:

- `getPlannerStrategicKB(worldContext)`
- `getPlannerCreativeKB(worldContext)`
- `getPlannerReviewerKB(worldContext)`

Jangan mengganti semua caller lama dari `getStitchedMasterKB()` jika tidak diperlukan.

## 4. Database PostgreSQL

Aplikasi aktif memakai PostgreSQL. Implementasikan migrasi idempotent pada mekanisme PostgreSQL yang benar, bukan migrasi SQLite lama.

Tambahkan metadata planner:

- `content_world`
- `knowledge_domain`
- `universe_profile_id`
- `story_template`
- `universe_snapshot_json` sebagai JSONB bila sesuai arsitektur database

Tambahkan metadata row minimal:

- `main_character`
- `supporting_characters`
- `location_key`
- `story_premise`
- `pet_problem`
- `product_role`
- `product_reveal_beat`
- `universe_profile_id`
- `story_template`
- `human_presence`
- `universe_snapshot_json`

Pastikan tenant isolation tetap berlaku.

`universe_snapshot_json` harus menyimpan snapshot konfigurasi yang dipakai saat planner dibuat, agar output lama tidak berubah ketika profile diperbarui.

## 5. UI Content Planner

Tambahkan input sederhana:

- Content World;
- Knowledge Domain;
- Universe Profile, hanya saat cartoon universe.

Saat PawVille dipilih, isi default:

- `knowledge_domain = pet_supplies`
- `story_template = pet_problem_solution_7beat`
- `human_presence = none`
- visual preset PawVille
- tujuh scene × delapan detik sebagai metadata untuk tahap produksi berikutnya

Jangan memaksa seluruh episode menggunakan produk.

## 6. Aturan output planner

Planner tetap menghasilkan ide kalender, bukan storyboard lengkap.

Untuk cartoon universe, row harus memiliki:

- karakter utama;
- karakter pendukung;
- lokasi;
- premis;
- masalah pet yang observable;
- peran produk;
- beat pengenalan produk;
- metadata universe.

Dukung tiga pola:

1. Editorial:
   - `product_role = none`
   - `product_reveal_beat = none`
2. Soft integration:
   - produk muncul setelah konflik dipahami, Beat 4 atau 5
3. Product campaign:
   - produk sebagai solusi dan demonstrasi, tanpa klaim medis

Karakter Dr. Paw tidak boleh melakukan diagnosis medis.

## 7. Propagasi metadata

Pastikan field baru tidak hilang pada:

- validator dan normalizer;
- INSERT planner dan row;
- API create/detail;
- edit/regenerate row;
- export;
- tampilan detail planner.

Pada tahap ini, teruskan metadata minimal sampai jalur import Planner → OPC, tetapi jangan implementasikan storyboard atau prompt T2I/I2V.

## 8. Verifikasi wajib

Tambahkan test deterministik untuk:

- KB cartoon tidak memuat larangan cartoon/CGI;
- KB real-world tetap sama seperti sebelumnya;
- identifier universe yang tidak dikenal ditolak;
- metadata bertahan setelah disimpan dan dibaca kembali;
- metadata bertahan sampai payload import OPC;
- editorial tanpa produk tidak dipaksa menghasilkan produk;
- tenant isolation tetap aman.

Lakukan smoke test:

- generate planner PawVille;
- generate planner real-world;
- pastikan real-world tidak mengalami regresi.

Jangan lanjut ke Tahap 2. Setelah Tahap 1 terverifikasi dan dirilis sesuai SOP, berhenti dan berikan laporan.