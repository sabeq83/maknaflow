# Instruksi Antigravity — Multiplier Blueprint × Product

## Mandat

Implementasikan `multiplier_lab_implementation_plan.md` tanpa memperluas scope.

## Urutan Wajib

1. Baca `AGENTS.md` dan plan sepenuhnya.
2. Periksa `git status`; jangan overwrite perubahan user.
3. Baca dokumentasi Next.js relevan di `node_modules/next/dist/docs/`.
4. Audit schema PostgreSQL dan task Multiplier secara read-only.
5. Kerjakan migration → repository → API → worker → UI → test.
6. Update `## Execution Task List` setelah setiap tahap benar-benar selesai.
7. Jalankan lint, test, build, dan smoke test staging.
8. Release patch hanya setelah semua verifikasi lulus.

## Aturan Utama

- Dua mode wajib tersedia:
  - Multi Blueprint → 1 Produk.
  - 1 Blueprint → Multi Produk.
- Satu pasangan `blueprint × produk` sama dengan satu task row.
- Worker tetap serial; dilarang membuat Gemini/G-Labs/Veo paralel.
- Search blueprint mencakup niche, tags, caption, resume viral, dan rekomendasi produk.
- List memakai summary ringan; storyboard lengkap hanya pada detail/preview.
- Payload row wajib memakai `target_product_url`, bukan `url` ambigu.
- Snapshot produk/config disimpan per row agar perubahan library tidak mengubah task berjalan.
- Validasi tenant dan status blueprint di server, bukan hanya UI.
- Pertahankan kompatibilitas payload lama selama migrasi.
- Jangan mengubah prompt, preset, atau desain umum Labs di luar kebutuhan ini.
- Jangan deploy production.

## Bukti Verifikasi Minimum

- Tiga blueprint + satu produk menghasilkan tepat tiga task.
- Satu blueprint + tiga produk menghasilkan tepat tiga task.
- Setiap task membawa produk, bridge, dan konfigurasi yang benar.
- URL produk dari mode mass tidak kosong.
- Blueprint dapat ditemukan lewat `viral_pattern_summary` dan `product_ideas_json`.
- Hanya satu task aktif diproses pada satu waktu.
- Satu row gagal tidak merusak row lainnya.
- Tenant A tidak dapat memakai blueprint/task Tenant B.
- Existing single mode, preset, TTS, G-Labs, dan FFmpeg tidak regression.
- Build berhasil.

## Kontrol Plan

Jika file tambahan perlu diubah, tambahkan dahulu ke plan beserta **Code Sebelum** dan **Code Sesudah**. Jangan mencentang task sebelum diverifikasi.

## Release

```bash
npm run release-non-interactive -- --type patch --title "Multiplier Blueprint Product Workflows" --points "Tambah pencarian dan preview blueprint lengkap|Tambah workflow multi blueprint dan multi produk|Perbaiki task per baris dan antrean serial"
```

Laporkan file, migration, hasil test/build, smoke test, versi, commit, tag, push, dan risiko tersisa. Jangan deploy production.
