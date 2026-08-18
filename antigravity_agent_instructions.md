# Instruksi Agent AI Antigravity — Implementasi Deconstruct URL Library

## Mandat

Implementasikan rekonstruksi Deconstruct Lab berdasarkan `deconstruct_lab_implementation_plan.md` di root repository. Jangan memperluas scope di luar URL Library, antrean dekonstruksi serial, detail asset, dan integrasi hasil ke Recipe Labs serta Multiplier Labs.

## Sumber Kebenaran

1. Baca `AGENTS.md` repository sepenuhnya.
2. Baca `deconstruct_lab_implementation_plan.md` sepenuhnya.
3. Sebelum mengubah kode Next.js, baca dokumentasi yang relevan di `node_modules/next/dist/docs/`, khususnya:
   - Route Handlers.
   - Dynamic Routes.
   - `useSearchParams`.
   - Linking and navigation.
4. Inspeksi kode aktual sebelum menerapkan snippet. Snippet dalam plan menunjukkan arah desain, bukan patch literal.

## Hasil yang Wajib Dicapai

- URL dapat disimpan berdasarkan niche tanpa langsung diproses.
- Library ditampilkan sebagai tabel yang dapat dicari dan difilter.
- User dapat memilih beberapa URL dan enqueue sekaligus.
- Worker memproses tepat satu asset per giliran untuk batch dan tenant yang sama.
- Hasil dapat dibuka pada halaman detail.
- Tombol `Gunakan Hasil` menawarkan dua pilihan:
  - Recipe Labs memakai `source_deconstruct_id`.
  - Multiplier Labs memakai `asset_id`.
- Data lama tetap dapat digunakan.
- Tidak ada kebocoran data antar-tenant.

## Aturan Implementasi

### Database

- Gunakan migration PostgreSQL idempotent dan advisory lock mengikuti pola `lib/db-pg.js`.
- Jangan menghapus atau menulis ulang hasil dekonstruksi lama.
- Tambahkan tenant isolation untuk batch dan asset.
- Audit duplikat sebelum mempertimbangkan unique index URL.
- Semua operasi enqueue multi-record wajib transaction.
- Gunakan allowlist field pada dynamic update.

### API

- `POST /api/v2/deconstruct` hanya menyimpan URL sebagai `saved`.
- Jangan membuat scheduler job ketika user hanya menyimpan URL.
- Gunakan endpoint terpisah untuk enqueue massal.
- Pertahankan kompatibilitas `GET ?assets=true`.
- Validasi tenant, status, URL, niche, jumlah item, serta UUID/ID asset.
- Jangan mengembalikan local path atau Gemini URI pada list response.

### Scheduler

- Jangan menggunakan pemilihan pending asset global.
- Wajib scope dengan `batch_id` dan `tenant_id` dari payload job.
- Satu job memproses satu asset.
- Setelah delay anti-block, enqueue job berikutnya hanya untuk batch yang sama.
- Kegagalan satu asset tetap memungkinkan asset berikutnya diproses.
- Catat `deconstructed_at` hanya setelah hasil sukses tersimpan.
- Pastikan operasi async database di-`await`.

### UI

- Halaman utama berorientasi asset library, bukan batch card.
- Pertahankan visual language aplikasi yang sudah ada; jangan membuat design system baru.
- Checkbox hanya aktif untuk `saved` dan `failed`.
- `Pilih semua` berlaku pada baris eligible yang sedang terlihat.
- Jangan mengirim storyboard/product JSON besar pada list endpoint.
- Poll hanya ketika terdapat status antre/aktif dan bersihkan interval pada unmount.
- Di halaman detail, nonaktifkan `Gunakan Hasil` sebelum status `deconstructed`.

### Scope Discipline

- Jangan mengubah prompt Gemini.
- Jangan membuat parallel Gemini processing.
- Jangan redesign Recipe Labs atau Multiplier Labs.
- Jangan melakukan deployment production.
- Jangan melakukan refactor umum yang tidak diperlukan fitur ini.
- Pertahankan perubahan user lain yang sudah ada di worktree.

## Tata Cara Eksekusi

1. Periksa `git status` dan identifikasi perubahan existing milik user.
2. Audit schema database staging secara read-only.
3. Baca dokumentasi Next.js lokal yang relevan.
4. Implementasikan migration dan repository layer terlebih dahulu.
5. Implementasikan API save/list/detail/enqueue.
6. Perbaiki worker serial scoped.
7. Implementasikan tabel library.
8. Implementasikan halaman detail dan `Gunakan Hasil`.
9. Verifikasi preselection pada kedua Labs.
10. Tambahkan test dan jalankan lint/test/build.
11. Lakukan smoke test staging.
12. Jalankan release SOP hanya setelah seluruh verifikasi berhasil.

## Kontrol Progress Wajib

Setelah setiap tahap selesai, segera ubah checkbox terkait pada bagian `## Execution Task List` di `deconstruct_lab_implementation_plan.md` dari:

```md
- [ ] Tahap
```

menjadi:

```md
- [x] Tahap
```

Jangan menandai task selesai sebelum hasilnya benar-benar diverifikasi.

Jika implementasi aktual membutuhkan file tambahan, tambahkan file tersebut ke bagian rencana per-file lengkap dengan **Code Sebelum** dan **Code Sesudah** sebelum mengeditnya.

## Pemeriksaan Minimum

Wajib buktikan hal-hal berikut:

1. Save URL menghasilkan status `saved` dan tidak menambah job.
2. Enqueue dua dari tiga URL tidak memproses URL ketiga.
3. Tidak ada dua asset dalam satu batch yang aktif bersamaan.
4. Queue berikutnya tetap berjalan setelah satu asset gagal.
5. `deconstructed_at` terisi pada sukses.
6. Search/filter/pagination dan selection berjalan konsisten.
7. Detail hasil dapat dibuka.
8. Recipe Labs membuka asset yang tepat.
9. Multiplier Labs membuka asset yang tepat.
10. Tenant A tidak dapat membaca atau enqueue asset Tenant B.
11. Data dekonstruksi lama tetap tampil.
12. Build Next.js berhasil.

## Penanganan Blocker

- Bila schema aktual berbeda dari asumsi plan, hentikan perubahan schema, dokumentasikan perbedaannya, lalu sesuaikan plan sebelum melanjutkan.
- Bila ditemukan perubahan user pada file yang sama, jangan overwrite; integrasikan secara hati-hati atau minta arahan.
- Bila test gagal karena regression di luar scope, pisahkan bukti kegagalan existing dari kegagalan akibat perubahan.
- Bila proses memerlukan deployment production, berhenti dan minta perintah eksplisit pengguna.

## Release Wajib Setelah Verifikasi

Jalankan:

```bash
npm run release-non-interactive -- --type patch --title "Deconstruct URL Library" --points "Tambah library URL berbasis niche|Tambah antrean dekonstruksi massal serial|Tambah detail asset dan integrasi Recipe serta Multiplier Labs"
```

Kemudian verifikasi:

- Versi dan changelog konsisten.
- Commit release berhasil.
- Tag `vX.Y.Z` tersedia di remote.
- Branch `main` tersinkron ke `https://github.com/sabeq83/maknaflow.git`.

Jangan deploy production.

## Format Laporan Akhir

Laporkan secara ringkas:

- Perubahan yang selesai.
- File utama yang diubah.
- Migration yang dijalankan.
- Test/lint/build beserta hasilnya.
- Hasil smoke test.
- Versi release, commit, tag, dan status push.
- Risiko atau pekerjaan tersisa, bila ada.
