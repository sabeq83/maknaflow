# Execution Notes — Wizard Parity

## Baseline
- HEAD 9ad39ea, v2.32.72. Tidak ada perubahan tracked; analisis/mockup/rencana sebelumnya masih untracked.
- Panduan Next.js lokal use-client dibaca.
- Inventaris kontrol source tercatat di parity-matrix.md.

## Keputusan ekstraksi
- Relokasi controller dan JSX menu asal secara utuh ke komponen canonical, halaman route menjadi wrapper direct. Ini menjaga handler/field/preset persis satu sumber dan menghindari rekonstruksi 1.000+ baris form. Presentasi direct tetap mempertahankan shell/history existing; capture hanya merender konfigurasi dengan wizard section.
- Controller dan validasi asli tetap berdekatan dengan JSX; pure module khusus normalisasi/server/manifest dipakai sebagai boundary. Tidak memisahkan setiap setter ke hook baru bila hanya menambah indirection tanpa manfaat paritas.
- RE angles memakai snapshot JSON invocation key + ordinal variant; kolom existing mencukupi, tanpa DDL. Lock invocation mencegah parent ganda. Mapping child deterministik disimpan setelah child tersedia.

## Tahap 01
Selesai audit baseline, inventaris sumber dan mapping handler/payload. Bukti: parity-matrix.md dan kode baseline pada Git.

## Tahap 02–08: implementasi
- Lima form/controller direlokasi dari menu asli; route lama wrapper direct. Studio memakai section yang sama dan mempertahankan mounted controller saat ke jadwal/review.
- Semua kontrol input, onChange, min/max, required, upload dan VSO dibandingkan AST terhadap fixture baseline (urutan deklarasi diabaikan karena form menjadi variabel JSX). Lima jalur lolos.
- SSR capture kelima jalur berhasil, 4.7K/4.1K/10.3K/3.2K/10.5K karakter HTML; tanpa efek browser/API.
- RE FormData tetap utuh, string 0/false dinormalisasi, voice_cast dan execution_mode tersimpan. Multi-angle memakai satu invocation parent per URL + ordinal child yang dipin ke variant ID; waktu produksi per group disamakan.
- Kebijakan approval menonaktifkan seluruh social draft termasuk nested config tanpa mengubah konfigurasi user.
- Temuan lama: upload Multiplier mengirim file tanpa productId/type ke endpoint produk yang mensyaratkannya. Dialihkan ke endpoint aset tenant-owned dengan staging persisten dan validasi gambar.
- UI baru memakai semantic CSS; warna literal style pada form sumber yang direlokasi dimigrasikan ke tokens. Nilai warna latar kolase adalah parameter konten existing dan dipertahankan, bukan warna tema UI.
- Production build pertama lolos 149 routes. Peringatan DB/GC startup akibat jaringan sandbox, bukan compile failure.

## Kontrol pengujian
- Tes lama contentflow-studio.test/e2e memiliki import side-effect dan tidak digunakan untuk mutasi schema existing. Percobaan awal dalam sandbox berhenti karena jaringan ditolak.
- Tes integrasi dijalankan dengan ENABLE_BACKGROUND_SERVICES=false, NODE_ROLE=ui, auto migrations/caches off, schema sementara dari struktur dev tanpa data. Ini juga mencegah ingest Pillar menjalankan scheduler selama tes.

## Hasil verifikasi backend
- Tes integrasi campaign-first lama: 5/5 lulus pada schema sementara, background services off.
- Tes integrasi wizard baru: 1/1 lulus. Membuktikan 3 slot varian berbagi parent campaign/item yang sama pada dispatch bersamaan, retry create idempotent, referensi tenant lain ditolak, flag social dipadamkan saat dispatch, execution mode/audio segment tetap ada, link produk bulk dipertahankan, dan slot mendapat variant/media yang berbeda.
- Tes fixture varian diperbaiki agar mengisi kolom wajib angle_category, matrix_strategy_used, system_targeting, voice_persona_assigned dan visual_tasks_json sesuai schema asli; bukan perubahan logika produksi.
- Unit/kontrak: 15 lulus, 1 integrasi dilewati pada run offline (DB case dijalankan terpisah dengan hasil di atas).
- Review visual pengguna tetap dilakukan pada link Dev/Staging setelah deployment; tidak diklaim sebagai review pengguna yang sudah terjadi.

## Verifikasi final sebelum rilis
- Kontrak/paritas baru: 11/11 passed.
- Integrasi campaign-first + wizard: 6/6 passed, schema sementara dibersihkan pada finally.
- Kelima capture form lolos SSR; seluruh kontrol/onChange/min/max/required terhadap baseline lolos.
- Build produksi 149 routes lulus. Peringatan middleware deprecation dan fallback DB saat build merupakan kondisi existing; bukan alasan mengklaim tes UI pengguna selesai.
- git diff --check bersih. Main remote masih baseline 9ad39ea saat preflight.
- Tidak ada migrasi database atau perubahan pipeline Strategic Campaign.

## Review pengguna
Pengguna dapat menguji langsung melalui link Dev/Staging sesudah deployment. Pemeriksaan visual/interaksi dengan akun nyata dan produksi AI/publishing nyata belum dinyatakan sudah dilakukan oleh pengguna.

## Pemeriksaan sebelum aktivasi
Ditemukan race pada respons Generate Planner bila wizard ditutup dan batch baru dibuka sebelum request lama selesai. Ditambahkan epoch sesi wizard: hasil/error/finally request lama diabaikan, dan penutupan wizard diblokir selama commit batch. Ini mencegah respons lama mengganti Planner atau menutup wizard batch baru.
