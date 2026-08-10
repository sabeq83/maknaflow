# Tahap 3.5 — Human Claymation Universe Support

## Instruksi untuk Antigravity Agent

Kerjakan hanya **Tahap 3.5 — Human Claymation Universe Support** setelah implementasi Tahap 3 selesai dan stabil.

Tujuannya adalah memperluas Universe Manager agar mendukung universe manusia bergaya claymation, misalnya channel editorial sejarah Islam, tanpa mengubah arsitektur utama Tahap 3.

Jangan melebar ke generator karakter otomatis, multi-character lip-sync, branching narrative, multi-reference manager, visual editor kompleks, atau deployment Production.

---

## 1. Target Hasil

User dapat membuat universe berikut melalui Universe Manager:

```text
Nama: Jejak Peradaban Islam
Tipe: Human Claymation
Knowledge Domain: Islamic History
Content Focus: Brand Editorial
Produk: Tidak ada
```

Universe harus dapat digunakan pada Content Planner dan OPC dengan Character Reference Lock, Location Reference, universe snapshot, depiction policy, historical period, dan Episode Memory.

---

## 2. Perluasan Universe Profile

Tambahkan field berikut pada `universe_profiles`:

```text
universe_type
depiction_policy
historical_period
```

Nilai `universe_type`:

```text
mascot_object
animal
human
```

Ketentuan:

- `depiction_policy` berisi aturan penggambaran manusia atau tokoh sensitif dan boleh kosong untuk universe non-manusia.
- `historical_period` berisi periode default universe, misalnya `Abad ke-7 sampai abad ke-15`.
- Semua field baru harus memiliki default aman dan backward-compatible.
- Gunakan pola migrasi repository yang berlaku, seperti `ADD COLUMN IF NOT EXISTS`.

---

## 3. Perluasan Character Library

Tambahkan field:

```text
historical_period
depiction_mode
reference_type
```

Nilai `depiction_mode`:

```text
normal
faceless
back_view
silhouette
environment_only
```

Nilai `reference_type`:

```text
identity
wardrobe
```

Ketentuan:

- Untuk MVP, satu karakter tetap hanya memiliki satu reference image utama.
- `reference_type` hanya menjadi klasifikasi; jangan membuat sistem multi-image.
- Atribut hewan seperti `species`, `breed`, `fur_color`, dan `eye_color` harus opsional.
- Karakter manusia menggunakan `body_description`, `signature_accessory`, `personality`, `role`, `canonical_prompt`, dan `reference_image_path`.

---

## 4. Perluasan Location Library

Tambahkan field:

```text
historical_period
reference_type
```

Nilai `reference_type`:

```text
location
visual_style
```

Untuk MVP, pertahankan satu reference image per location record. Jangan membuat multi-reference manager.

---

## 5. Knowledge Domain

Pastikan Universe Manager menyediakan pilihan:

```text
general
pet_supplies
food_culinary
history
islamic_history
```

Field ini hanya digunakan untuk klasifikasi dan routing prompt. Jangan membuat knowledge base sejarah otomatis pada Tahap 3.5.

---

## 6. Perubahan Universe Manager UI

Pada form Universe tambahkan:

```text
Universe Type
Knowledge Domain
Historical Period
Depiction Policy
```

Perilaku UI:

- Jika `universe_type = human`, tampilkan `Historical Period` dan `Depiction Policy`.
- Untuk tipe lain, kedua field boleh disembunyikan atau tetap opsional.
- Pertahankan pola form sederhana dari Tahap 3.

Pada Character Library, tampilkan `Historical Period`, `Depiction Mode`, dan `Reference Type`. Jangan mewajibkan atribut hewan untuk karakter manusia.

Pada Location Library, tampilkan `Historical Period` dan `Reference Type`.

---

## 7. Integrasi Snapshot dan Prompt

Pastikan data berikut masuk ke universe snapshot ketika Content Planner di-import ke OPC:

```text
universe_type
knowledge_domain
historical_period
depiction_policy
character.depiction_mode
character.historical_period
character.reference_type
location.historical_period
location.reference_type
```

Ketika membuat storyboard, T2I prompt, atau regeneration prompt:

- `depiction_policy` wajib diteruskan sebagai aturan keras;
- `historical_period` wajib menjaga pakaian, arsitektur, benda, dan teknologi sesuai zaman;
- `depiction_mode` wajib diterapkan pada karakter terkait;
- Character Reference Lock tetap digunakan jika identity reference tersedia;
- Location Reference tetap digunakan jika tersedia;
- Product Bridging tidak boleh aktif untuk konten Brand Editorial tanpa produk.

---

## 8. Seed Universe untuk Pengujian

Buat satu seed universe minimal:

```text
Name: Jejak Peradaban Islam
Slug: jejak-peradaban-islam
Universe Type: human
Knowledge Domain: islamic_history
Historical Period: Abad ke-7 sampai abad ke-15
Visual Style: cinematic 3D claymation, handcrafted matte clay texture,
warm historical lighting, respectful educational atmosphere
Human Presence: allowed
Default Aspect Ratio: 9:16
Default Scene Count: 7
Default Scene Duration: 8
Story Template: historical_explainer_7beat
Tone: hangat, reflektif, edukatif, tidak sensasional
CTA Personality: mengajak audiens mempelajari sejarah lebih lanjut
```

Gunakan `depiction_policy`:

```text
Dilarang memvisualisasikan Nabi Muhammad ﷺ dan para nabi. Tokoh sensitif
harus direpresentasikan melalui lingkungan, benda, jejak perjalanan,
siluet dari belakang, atau narasi tanpa menampilkan wajah. Jangan membuat
kutipan, dialog, atau peristiwa sejarah tanpa dasar sumber. Hindari
anakronisme pakaian, arsitektur, benda, dan teknologi. Konflik tidak boleh
ditampilkan secara sadis atau eksplisit.
```

Seed minimal:

- satu karakter pemandu fiktif dengan `depiction_mode = normal`;
- satu karakter historis generik dengan `depiction_mode = faceless`;
- dua lokasi historis;
- reference image boleh kosong dan UI harus menandainya belum tersedia.

Jangan membuat atau mengarang representasi visual Nabi maupun tokoh yang dilarang oleh depiction policy.

---

## 9. Kompatibilitas Wajib

Pastikan perubahan tidak merusak:

- PawVille;
- Character Reference Lock Tahap 2.5;
- Semesta Herbal;
- Semesta Dapur;
- Semesta Rumah;
- Semesta Hewan;
- universe records lama;
- alur Brand Editorial tanpa produk.

---

## 10. Verifikasi

Lakukan pengujian minimal:

1. Membuat universe bertipe `human`.
2. Menyimpan dan mengedit depiction policy.
3. Membuat karakter manusia tanpa atribut hewan.
4. Membuat karakter dengan mode `faceless`.
5. Membuat lokasi dengan historical period.
6. Memastikan universe muncul di Content Planner.
7. Memastikan snapshot OPC membawa seluruh field baru.
8. Memastikan prompt menyertakan depiction policy dan historical period.
9. Memastikan Brand Editorial tidak mengaktifkan Product Bridging.
10. Memastikan PawVille tetap berjalan.
11. Menjalankan test Tahap 2.5 dan Tahap 3 yang sudah ada.
12. Menjalankan build verification.

---

## Execution Task List

- [ ] Audit implementasi Tahap 3 dan identifikasi file yang perlu diubah.
- [ ] Perbarui implementation plan dengan Code Sebelum dan Code Sesudah.
- [ ] Tambahkan migrasi field Universe Profile.
- [ ] Tambahkan migrasi field Character Library.
- [ ] Tambahkan migrasi field Location Library.
- [ ] Perbarui CRUD dan API serialization.
- [ ] Perbarui Universe Manager UI.
- [ ] Integrasikan field baru ke Content Planner dan OPC snapshot.
- [ ] Integrasikan depiction policy, historical period, dan depiction mode ke prompt.
- [ ] Tambahkan seed `Jejak Peradaban Islam`.
- [ ] Jalankan compatibility test PawVille dan empat universe VSO.
- [ ] Jalankan seluruh test relevan dan build verification.
- [ ] Perbarui dokumentasi SOT Universe Manager.
- [ ] Jalankan prosedur rilis repository sesuai SOP.

Centang setiap item hanya setelah pekerjaan tersebut benar-benar selesai.

---

## 11. Batasan Tahap 3.5

Tahap ini tidak mencakup:

- generator karakter otomatis;
- generator location reference otomatis;
- multi-image reference manager;
- multi-character lip-sync;
- branching narrative;
- pencarian atau verifikasi sumber sejarah otomatis;
- visual universe editor kompleks;
- deployment Production.

---

## 12. Laporan Akhir

Setelah selesai, laporkan:

```text
- File yang diubah
- Migrasi database
- Field baru
- Integrasi prompt dan snapshot
- Seed universe yang dibuat
- Hasil pengujian
- Hasil build
- Versi/tag rilis
- Risiko atau pekerjaan lanjutan
```

Berhenti setelah implementasi, pengujian, dokumentasi, dan prosedur rilis repository selesai. Jangan melanjutkan ke scope lain.

