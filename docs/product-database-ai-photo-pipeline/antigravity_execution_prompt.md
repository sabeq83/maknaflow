# Prompt Eksekusi untuk AI Agent Antigravity

Salin seluruh prompt di bawah ini ke agent Antigravity:

---

Anda bekerja pada repository MAKNA Flow. Implementasikan seluruh rencana pada:

`docs/product-database-ai-photo-pipeline/implementation_plan.md`

Tujuan utamanya adalah memperbaiki Add/Edit Single Product dan Import CSV/XLSX Product Database, lalu membuat pipeline enrichment Gemini serta clean product photo melalui provider Gemini API atau G-Labs tanpa rembg pada alur baru.

Instruksi wajib:

1. Baca `AGENTS.md` repository dan patuhi seluruh instruksinya.
2. Karena versi Next.js repository memiliki breaking changes, baca dokumentasi yang relevan di `node_modules/next/dist/docs/` sebelum menulis kode Route Handler/form.
3. Baca seluruh `implementation_plan.md` sebelum melakukan perubahan.
4. Audit working tree terlebih dahulu. Jangan menimpa atau membuang perubahan pengguna yang tidak terkait.
5. Kerjakan task secara kronologis mengikuti section `## Execution Task List`.
6. Setiap satu tahap selesai, segera edit `implementation_plan.md` dan ubah checkbox tahap tersebut dari `- [ ]` menjadi `- [x]`. Jangan menunggu sampai akhir.
7. Sebelum mengimplementasikan provider Gemini image, verifikasi dokumentasi resmi dan model/API yang benar-benar tersedia. Jangan menggunakan model text-only atau mengarang nama model. Catat keputusan model dan SDK pada dokumen rencana.
8. Jangan mengembangkan atau mengubah scraping product. Jangan menghapus `lib/bg-remover.js`; cukup pastikan alur Single Product dan CSV baru tidak memanggil rembg.
9. Saat membuat/meregenerasi foto Clean, gunakan `raw_photo_url` sebagai input AI dan jangan memakai output rembg/clean lama. Setelah Clean tersedia, generator kampanye G-Labs menggunakan `clean_photo_url`, dengan Raw hanya sebagai fallback. Jangan tertukar antara dua konteks tersebut.
10. Product Database baru hanya mempunyai dua aset operasional: Raw dan Clean. Canonical field-nya `raw_photo_url` dan `clean_photo_url`. `cleaned_photo_url`, `generated_photo_url`, dan `active_photo` adalah legacy compatibility; jangan hapus data lama, tetapi jangan lagi tampilkan atau tulis `generated_photo_url`/`active_photo` pada pipeline baru.
11. Semua consumer kampanye dan payload reference produk ke G-Labs harus memakai urutan `clean_photo_url || raw_photo_url`. Audit dan perbaiki pengecualian seperti resolver Sheets Autopilot yang masih memprioritaskan generated/studio.
12. Semua query Product Database, import, worker, polling, retry, dan approval harus tenant-aware. Gunakan repository PostgreSQL dan row claim concurrency yang aman.
13. Perbaiki bug upload single product saat ini: jangan update ID sementara sebelum record produk ada. Buat create multipart yang atomik/draft-safe dan sediakan replace raw photo ketika edit.
14. Validasi wajib harus ada di client dan server: nama, deskripsi, raw photo create, status kemasan, serta jenis kemasan bila packaged.
15. Field bertanda `**` bukan required user input. Gemini mengisi USP, Product Truth, Geometric Truth, clean prompt, T2I campaign prompt, dan I2V prompt secara asynchronous; hasil tetap editable/reviewable. T2I campaign prompt tidak berarti menyimpan foto ketiga di Product Database.
16. CSV/XLSX canonical harus mendukung: `Page`, `Nama Produk Raw`, `Deskripsi Produk Raw`, `Link Produk`, `URL Foto Produk Raw`, `Link Aff`, termasuk alias lama dan error per nomor baris.
17. Network download dan AI tidak boleh dijalankan di dalam transaksi import. Simpan data dahulu, lalu queue/worker memprosesnya.
18. Provider Gemini dan G-Labs harus berada di balik kontrak service yang sama dan dapat diuji dengan stub tanpa biaya API.
19. Kegagalan AI tidak boleh menghapus produk atau aset lama. Simpan error terstruktur dan sediakan retry.
20. Jangan deploy production tanpa perintah manual eksplisit.

Urutan verifikasi minimum:

- Unit tests validator, parser, normalizer, prompt, provider response.
- Integration tests repository/deduplikasi/tenant isolation/row claim.
- API tests multipart single create/edit dan partial CSV import.
- Worker tests Gemini sync, G-Labs async polling, failure, dan retry.
- UI smoke untuk required fields, conditional packaging, photo preview/replace, enrichment status, Raw/Clean, approve/retry.
- Integration test memastikan seluruh reference produk ke G-Labs memilih Clean, lalu Raw hanya sebagai fallback.
- Jalankan test Product Database yang sudah ada.
- Jalankan build Next.js sesuai environment repository.
- Periksa `git diff` dan pastikan tidak ada secret/base64 image/log sensitif masuk commit.

Definition of Done:

- Semua acceptance criteria pada plan terbukti lewat test atau verifikasi manual yang dicatat.
- Seluruh checkbox relevan pada Execution Task List sudah `[x]`.
- Build berhasil dan tidak ada regression Product Database.
- Tidak ada akses lintas tenant.
- Alur baru tidak memakai rembg.
- Setelah seluruh verifikasi berhasil, jalankan SOP release non-interaktif patch dari `AGENTS.md`, verifikasi changelog/version/commit/tag/push ke repository target, dan laporkan hasilnya.
- Jangan berhenti setelah menulis kode: lanjutkan sampai test, build, review diff, pembaruan checklist, dan release selesai, kecuali benar-benar diblokir oleh credential/approval eksternal.

Mulai dengan membaca rencana dan menampilkan ringkasan singkat file yang akan diubah, lalu langsung eksekusi tanpa meminta konfirmasi tambahan untuk perubahan yang sudah tercakup dalam rencana.

---
