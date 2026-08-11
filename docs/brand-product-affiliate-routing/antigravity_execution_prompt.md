# Prompt Eksekusi untuk AI Agent Antigravity

Salin seluruh prompt berikut ke Antigravity:

---

Implementasikan rencana lengkap pada:

`docs/brand-product-affiliate-routing/implementation_plan.md`

Konteks penting: Product Database baru saja selesai diperbarui dengan Single Product multipart, CSV/XLSX tenant-aware, foto Raw/Clean, Gemini/G-Labs clean-photo provider, enrichment/photo status, dan worker PostgreSQL tenant-aware. Jangan membongkar atau mengulang implementasi tersebut. Tugas ini menambahkan Brand–Product affiliate routing dan snapshot hingga Content Flow.

Instruksi wajib:

1. Baca `AGENTS.md`, lalu baca seluruh `implementation_plan.md` sebelum mengubah kode.
2. Versi Next.js repository memiliki breaking changes; baca panduan terkait di `node_modules/next/dist/docs/` sebelum menulis Route Handler atau form.
3. Audit working tree terlebih dahulu. Jangan membuang atau menimpa perubahan pengguna yang tidak terkait.
4. Ikuti `## Execution Task List` secara kronologis. Setelah setiap tahap benar-benar selesai, segera ubah checkbox tahap itu dari `- [ ]` menjadi `- [x]` di dokumen rencana.
5. Jangan mengembangkan atau mengubah scraping product.
6. Jangan mengubah fondasi foto Raw/Clean, rembg policy, Gemini/G-Labs photo provider, atau clean-photo worker kecuali penyesuaian minimal yang benar-benar diperlukan oleh compile/test.
7. Product tetap tenant-owned. Jangan menambahkan `brand_profile_id` langsung sebagai ownership tunggal pada `product_extractions`.
8. Implementasikan relasi many-to-many melalui `brand_products` dan snapshot lintas workflow melalui `campaign_product_bindings`.
9. Semua query wajib tenant-aware. Brand Profile dan Product harus divalidasi berada dalam tenant sama, dan user hanya boleh mengakses Brand Profile assignment yang dimilikinya.
10. Gunakan satu affiliate resolver terpusat dengan precedence: explicit campaign override → active Brand–Product link → legacy product fallback → missing.
11. Jangan pernah mengambil affiliate link Brand Profile lain, Content Planner pertama, atau product URL match tanpa tenant/brand context.
12. Campaign affiliate baru tidak boleh run/approve bila link missing. Campaign non-affiliate tetap boleh berjalan.
13. Simpan snapshot immutable pada campaign/item binding. Mengubah `brand_products.affiliate_link` tidak boleh mengubah campaign atau Content Flow lama.
14. Mass campaign wajib mempunyai binding per item/row bila produk atau override dapat berbeda.
15. Content Flow harus binding-first. Legacy fallback hanya selama migrasi dan wajib menghasilkan telemetry yang jelas.
16. Pertahankan `content_flow_items.link_affiliate` sebagai snapshot final serta tambahkan lineage brand/product/source/status.
17. Manual edit Content Flow menjadi `content_flow_override`; jangan otomatis mengubah Brand–Product association.
18. Pertahankan `product_extractions.affiliate_link` untuk compatibility, tetapi ubah UI menjadi Legacy/Default dan pindahkan link baru ke association bila Brand Profile tersedia.
19. CSV Product Database harus meminta Brand Profile tujuan untuk mode `brand_product`; produk yang sama tidak boleh diduplikasi ketika diimpor untuk Brand A dan Brand B.
20. Prompt Studio (`t2i_prompt`) dan Prompt Aksi Video (`i2v_action_prompt`) sudah tidak diperlukan. Hapus keduanya dari UI dan kontrak Product Database baru, serta jangan hasilkan/ubah keduanya pada enrichment baru. Jangan drop kolom atau menghapus nilai legacy secara massal.
21. Jangan menambah scope integrasi click/conversion marketplace.
22. Jangan deploy production tanpa perintah manual eksplisit.

Urutan validasi minimum:

- Jalankan baseline test sebelum perubahan.
- Unit test resolver precedence dan URL validation.
- Repository test tenant isolation dan akses Brand Profile.
- Test produk sama untuk Brand A/Link A dan Brand B/Link B.
- Test campaign binding single, mass item, immutable snapshot, dan explicit re-resolve.
- Test API association/resolve termasuk wrong tenant dan unauthorized brand.
- Test CSV Brand A lalu Brand B tanpa duplikasi produk.
- Integration test Content Planner, OPC, RE, Strategic, Instant, Bridge, Multiplier, Sheets Autopilot, dan Recipe Labs sesuai mode produknya.
- Test Content Flow menerima snapshot, bukan global product/planner-first link.
- Test manual Content Flow override tidak mengubah association.
- Test Prompt Studio/Prompt Aksi Video tidak lagi tampil/dihasilkan pada Product Database baru.
- Jalankan seluruh regression test Product Database dan Content Flow.
- Jalankan build Next.js sesuai environment.
- Review `git diff`, cek tidak ada secret, base64 image, credential, atau file log runtime yang ikut commit.

Definition of Done:

- Produk sama dapat dipakai Brand A dan Brand B dengan affiliate link berbeda tanpa duplikasi produk.
- Seluruh campaign produk baru menggunakan resolver dan binding snapshot.
- Content Flow membawa affiliate link yang sesuai Brand Profile.
- Tidak ada lookup affiliate lintas tenant/brand atau planner-first ambigu.
- Prompt Studio dan Prompt Aksi Video tidak lagi menjadi bagian Product Database baru.
- Seluruh acceptance criteria terbukti, checkbox relevan `[x]`, tests/build lulus.
- Setelah verifikasi berhasil, jalankan SOP release non-interaktif patch dari `AGENTS.md`, lalu verifikasi version, changelog, commit, tag, branch main, dan push ke remote target.
- Jangan berhenti setelah menulis kode; lanjutkan sampai test, build, diff review, checklist, dan release selesai kecuali benar-benar diblokir credential/approval eksternal.

Mulai dengan membaca rencana dan menampilkan ringkasan file/tahap, lalu langsung kerjakan tanpa meminta konfirmasi tambahan untuk perubahan yang sudah tercakup.

---
