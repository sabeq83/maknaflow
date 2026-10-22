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

## Rilis
- v2.32.73: b63399ff0d1fda61c0f25013e96c7a3f3c26166f, main/tag remote terverifikasi.
- v2.32.74: d344bc3efd95fb14ed73cf8708da00c3f1367d19, menambahkan guard sesi wizard; main/tag berhasil dipush.
- Dev awal v2.32.73: release 20261022T133325Z-b63399ff0d1f, health passed. Deployment akhir memakai v2.32.74 agar Dev/Staging identik.

## Penyelarasan navigasi wizard
- Tombol Lanjut memeriksa prasyarat bagian aktif (sumber mass RE, nama/URL, bridging/Hybrid Lock, preview kombinasi Multiplier, brief Planner, nama/kategori Recipe dan row Pillar). Submit canonical tetap menjadi validasi akhir bersama menu asal.
- Enter pada langkah antara tidak menjalankan submit campaign. Indikator tahapan luar memakai ID langkah aktual termasuk Review Planner dan Review Batch.
- Form Pillar menunggu detail Planner selesai dimuat sebelum Lanjut tersedia.
- Semua fixture input/handler dan SSR lima form tetap lulus setelah penyelarasan ini.

## Panduan review manual pengguna
1. Buka Studio, Buat Batch, pilih RE: Planner tidak muncul. Coba Single/Mass, preset, mode eksekusi, bridging, VSO dan audio. Lanjut berhenti pada prasyarat yang belum lengkap.
2. Kembali dari Jadwal atau Review ke konfigurasi: isian tetap ada. Edit sumber/kombinasi dan pastikan jadwal tidak berpindah ke sumber lain.
3. Pillar: pilih salah satu dari tiga fokus Planner, Generate Planner secara eksplisit, review hasil dan konfigurasi produksi. Planner dikunci hanya saat batch berhasil disimpan.
4. Multiplier: coba empat workflow dan preview kombinasi, termasuk jalur non-produk; unggah gambar bila relevan. Maksimal 20 kombinasi mengikuti API asal.
5. Recipe: coba Static/kolase 3–6 gambar dengan preset/spacing, serta Reels Video Storyboard. Storyboard/text-only tanpa media tidak dinyatakan siap tayang.
6. Periksa Light/Dark, lebar layar kecil, keyboard Enter dan kembali/lanjut.
7. Setelah memilih waktu dan akun, simpan draft; Generate Content terpisah. Publishing hanya setelah review dan approval. Pengujian AI/publishing nyata dilakukan secara sadar oleh pengguna, bukan bagian fixture otomatis.

## Deployment akhir dan verifikasi

Rilis aktif: **v2.32.75**, Git SHA `1c5ca7734afa1dfa7483a3c2136f68876d75dc17`. Main dan annotated tag v2.32.75 telah diverifikasi menunjuk SHA tersebut sebelum commit bukti dokumentasi.

| Environment | Release ID | UI login | API health | Schema | PGPOOL_MAX | PM2 / cwd / shared |
|---|---|---|---|---|---|---|
| dev | `20261022T134335Z-1c5ca7734afa` | 200 | 200 | dev | 3 | online; cwd resolved ke current; seluruh shared path sesuai |
| staging | `20261022T134448Z-1c5ca7734afa` | 200 | 200 | staging | 3 | online; cwd resolved ke current; seluruh shared path sesuai |

- Build remote Dev dan Staging berhasil sebelum aktivasi; semua 149 routes selesai.
- Halaman Studio tanpa sesi mengembalikan 307 ke login, sesuai perlindungan autentikasi; respons ini tidak diklaim sebagai pengujian interaksi pengguna terautentikasi.
- `.env.local`, data, logs, public/uploads dan public/temp merujuk shared masing-masing environment. Tidak membaca/menyalin nilai secret ke laporan.
- Dev: http://100.95.245.55:5020/contentflow-studio
- Staging: http://100.95.245.55:5010/contentflow-studio
- Script kesehatan cluster: endpoint ContentFlow Node 3 merespons 405 dan webhook G-Labs merespons 501 pada probe GET; ini bukti endpoint merespons, bukan klaim health aplikasi 200. UI/API target Dev/Staging sudah diperiksa terpisah dengan hasil 200.
- Tidak ada deployment Production atau migrasi database. Tidak menjalankan generasi AI/publishing nyata.

Seluruh tahap implementasi agen selesai. Review visual/interaksi oleh pengguna dilakukan melalui link di atas sesuai SOP manual UI; panduan ada pada seksi sebelumnya.
