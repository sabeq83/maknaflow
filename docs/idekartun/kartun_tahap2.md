Kerjakan hanya Tahap 2: Storyboard dan Production Continuity.

Prasyarat: Tahap 1 sudah terverifikasi dan metadata universe sudah bertahan dari Content Planner sampai import OPC.

## Target

Row Content Planner terpilih dapat dikembangkan oleh pipeline OPC menjadi tujuh beat dan prompt produksi yang world-aware.

## Pekerjaan

1. Teruskan metadata berikut ke campaign dan setiap campaign item:
   - `content_world`
   - `universe_profile_id`
   - `universe_snapshot_json`
   - `story_template`
   - karakter dan lokasi
   - `product_role`
   - `product_reveal_beat`

2. Jangan memakai `Pet-Story-Arc` sebagai satu-satunya detektor cartoon.
   - `content_world` menentukan hukum dunia.
   - `story_template` menentukan pola cerita.
   - `narrative_mode` tetap dapat berupa storytelling, educational, comedy, dan lainnya.

3. Implementasikan template `pet_problem_solution_7beat`:
   - Beat 1: visual hook;
   - Beat 2: problem development;
   - Beat 3: discovery;
   - Beat 4: solution introduction bila memakai produk;
   - Beat 5: demonstration bila memakai produk;
   - Beat 6: resolution;
   - Beat 7: emotional closing dan CTA.

4. Untuk editorial tanpa produk, Beat 4–5 harus tetap menjadi perkembangan cerita, bukan memunculkan produk fiktif.

5. Tambahkan ke setiap prompt scene:
   - character identity lock;
   - relative size lock;
   - location continuity lock;
   - product geometry lock jika produk digunakan;
   - human-presence rule;
   - visual-style rule dari snapshot universe.

6. Negative prompt harus world-aware:
   - jangan melarang cartoon/CGI pada cartoon universe;
   - pertahankan aturan realistis pada real-world.

7. Reuse sistem mascot/VSO dan prompt builder yang sudah ada. Jangan membuat renderer atau pipeline baru.

8. Tambahkan continuity validator untuk:
   - nama dan atribut karakter;
   - lokasi;
   - kemunculan produk;
   - reveal beat;
   - CTA;
   - klaim pet/medis;
   - larangan manusia.

## Verifikasi

Uji minimal:

- satu episode editorial PawVille tanpa produk;
- satu episode PawVille soft integration;
- satu PawVille product campaign;
- satu campaign real-world sebagai regression test;
- semua episode menghasilkan tepat tujuh beat;
- metadata universe tidak hilang;
- character/product lock muncul pada prompt scene;
- negative prompt sesuai world mode.

Jangan lanjut ke Tahap 3. Setelah verifikasi dan rilis sesuai SOP, berhenti dan berikan laporan.