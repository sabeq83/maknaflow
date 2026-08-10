Kerjakan hanya Tahap 3: Universe Platform.

## Target

PawVille tidak lagi bergantung pada profile file statis dan MAKNA Flow dapat mengelola lebih dari satu universe.

## Pekerjaan

1. Buat tabel tenant-aware:
   - `universe_profiles`
   - `universe_characters`
   - `universe_locations`
   - `universe_episodes`

2. Gunakan PostgreSQL JSONB untuk aturan fleksibel, tetapi simpan field penting sebagai kolom terstruktur.

3. Buat `/settings/universes`:
   - list;
   - create;
   - edit;
   - archive;
   - preview.

Hindari hard delete jika universe sudah dipakai episode.

4. Buat Character Library:
   - canonical prompt;
   - atribut fisik;
   - personality;
   - relative size;
   - reference image;
   - version.

5. Buat Location Library:
   - canonical visual description;
   - lighting;
   - props;
   - reference image;
   - version.

6. Implementasikan Episode Memory:
   - produk;
   - masalah;
   - hook;
   - protagonis;
   - supporting characters;
   - lokasi;
   - resolution pattern;
   - CTA.

Gunakan untuk anti-repetition per tenant dan universe.

7. Migrasikan PawVille dari file profile menjadi seed database secara idempotent.

8. Content Planner mengambil pilihan universe dari database, tetapi tetap menyimpan snapshot profile pada planner/episode.

9. Buat satu universe kedua sederhana untuk membuktikan sistem tidak hardcoded ke PawVille.

10. Dokumentasikan Universe Manager pada SOT yang sesuai.

## Verifikasi

- CRUD tenant-safe;
- PawVille berhasil dimigrasikan;
- universe kedua dapat dipakai;
- episode lama tetap memakai snapshot versi lama;
- anti-repetition bekerja per universe;
- real-world tetap tidak terpengaruh;
- build dan test berhasil.

Setelah verifikasi, jalankan SOP rilis. Jangan deploy production tanpa perintah eksplisit pengguna.