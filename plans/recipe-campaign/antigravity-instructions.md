# Instruksi Agent Antigravity — Recipe Campaign MAKNA Flow

Baca dan jalankan [implementation_plan.md](./implementation_plan.md) sebagai spesifikasi utama. Working directory: `/Users/sabeqmmursyid/_contentflow-staging`. Target repo: `https://github.com/sabeq83/maknaflow.git`.

## Mandat

Implementasikan tipe ketiga **Recipe Campaign**: planner produk → N ide resep → detail kreatif + start frame (Fase 1) → review pengguna → animasi + TTS + FFmpeg/muxing (Fase 2) → ContentFlow → scheduling sosial media.

**Persyaratan pengguna yang wajib:** hasil resep harus disertai **teks resep lengkap untuk posting sosial media**. Jangan berhenti pada storyboard, VO, ringkasan, atau caption promosi. Teks resep memuat judul, porsi, bahan dengan takaran/satuan, langkah memasak, waktu, dan tips yang relevan. Simpan canonical recipe terstruktur beserta Markdown/plain text; bawa sampai ContentFlow, preview posting, ekspor, dan snapshot caption target publikasi.

## Urutan pertama: audit singkat lalu mockup HTML

1. Baca `AGENTS.md` aktual, cek `git status`, dan jangan menimpa perubahan pengguna. Baca panduan Next.js relevan di `node_modules/next/dist/docs/` sebelum kode Next.js.
2. Cocokkan bukti kode dalam rencana dengan checkout. Semua After snippet adalah sketsa desain, bukan kode yang boleh langsung ditempel. Periksa schema, kontrak worker, queue, dan publishing path.
3. **Terlebih dahulu buat `public/mockup_recipe_campaign.html` sebelum menulis/mengubah React/Next.js aplikasi.** Mockup standalone, interaktif, dengan data dummy dan tidak memanggil layanan berbayar atau posting nyata.
4. Simulasikan form multi-produk, kategori, jumlah, simpan draft, generate N ide, edit/pilih row, ingest, teks resep lengkap, storyboard/VO, frame review/regenerate, approve Fase 2, video placeholder, dan scheduling. Sertakan gagal/retry, approval stale, frame kurang, serta caption terlalu panjang.
5. Gunakan token dari `app/theme.css` untuk seluruh warna dan shadow. Muat tema lewat preview server/alias yang benar-benar bekerja, tanpa hardcoded hex/rgb. Light/dark harus dapat diperiksa.
6. Tampilkan preview dan URL lokal aktual kepada pengguna. **Tunggu persetujuan mockup sebelum implementasi aplikasi berdasarkan desain itu.** Dasarnya adalah SOP Mockup HTML pada `AGENTS.md`: “Tunjukkan dan simulasikan hasil mockup interaktif tersebut kepada pengguna terlebih dahulu ... sebelum tahap coding.” Catat feedback dan persetujuan pada rencana. Jangan menganggap permintaan membuat rencana sebagai persetujuan UI.
7. Saat menunggu, lanjutkan hanya inspeksi read-only atau perbaikan dokumen/mockup. Jangan melewati gate melalui perubahan backend produksi yang sudah mengunci desain belum direview.

## Keputusan implementasi yang harus diikuti

- `planner_focus=recipe_campaign`; dua tipe lama tetap berfungsi.
- MVP: 1–20 resep, default 5; kategori masakan/minuman/dessert/kue. Validasi integer secara ketat.
- Planner dapat memilih banyak produk; MVP merotasi satu produk utama per resep. Gunakan array ID agar perluasan kombinasi tetap mudah. Jangan menjanjikan kombinasi multi-produk dalam satu resep pada MVP.
- Reuse Content Planner, Culinary Sequence Engine/KB, pipeline OPC, start-frame checkpoint, dan ContentFlow. Jangan membangun mesin animasi/TTS/muxing/scheduler paralel.
- Buat adapter recipe khusus; jalur legacy Recipe Labs video saat ini berhenti di ekspor dokumen dan tidak boleh dianggap sudah menghasilkan video.
- Satu request logis untuk N ide planner; satu request detail produksi per resep untuk seluruh paket kreatif. Retry kegagalan diperbolehkan secara terbatas. Jangan menghidupkan Call 2 kreatif yang deprecated.
- Produk per item/scene serta foto referensinya mengalahkan default campaign. Validasi ID produk milik tenant dan dari pilihan planner. Jangan mengandalkan pencocokan nama produk.
- Integrasikan produk pada aksi memasak yang masuk akal; jangan memaksa affiliate insert terpisah atau menciptakan claim.
- Output scene harus mencakup T2I start-frame prompt, I2V motion prompt, VO, durasi, recipe-step mapping, dan product mapping. Adapter mengubahnya ke format worker yang benar-benar dipakai.
- Gate backend wajib menghentikan I2V/TTS/muxing sampai semua frame siap dan approval revisi terbaru tersimpan. Disabled button saja tidak cukup.
- Regenerasi/edit yang memengaruhi resep, VO, visual, atau frame harus membuat approval terkait stale. I2V wajib memakai file dan revisi yang disetujui.
- Ingest dan retry posting harus idempotent termasuk concurrent requests; gunakan constraint/transaction, bukan sekadar lookup sebelum insert.
- Pertahankan tenant isolation, retry checkpoint, dan lineage planner-row → production item → ContentFlow → publishing job.
- Pakai `source_type=opc` untuk transport MVP dan discriminator `content_kind=recipe_campaign`. Jangan mengubah source routing tanpa implementasi end-to-end.
- Jadwal publikasi hasil termasuk scope. Recurring automation untuk pembuatan planner baru bukan scope; consumer yang belum mendukung recipe harus menolak/memfilter secara jelas.

## Teks resep: Definition of Done khusus

- [ ] Gemini menghasilkan resep lengkap terstruktur pada single-pass detail produksi.
- [ ] Formatter menyelaraskan resep canonical, Markdown, plain text, dan caption dengan resep.
- [ ] Resep tersimpan permanen bersama revisi; tidak hanya file ekspor atau hasil transient.
- [ ] Pengguna dapat melihat, mengedit, menyalin, dan mengekspor resep lengkap.
- [ ] ContentFlow menerima seluruh teks resep dan paket sosial, bukan hanya caption pendek.
- [ ] Default draft posting menyertakan resep; caption pendek adalah pilihan eksplisit.
- [ ] Batas panjang platform/provider diperiksa berdasarkan integrasi aktual. Tidak ada truncation diam-diam pada bahan atau langkah.
- [ ] Preview sama dengan `caption_snapshot` yang dijadwalkan dan teks pada payload provider.
- [ ] Edit setelah scheduling tidak mengubah snapshot job lama diam-diam; revisi/penjadwalan ulang harus jelas.
- [ ] Test end-to-end bermock membuktikan bahan, takaran, dan langkah tetap utuh sampai payload publikasi.

## Kontrol pelaksanaan

Perbarui **Execution Task List** pada `implementation_plan.md` setelah setiap tahap selesai, lengkap dengan bukti singkat. Jangan mencentang pekerjaan belum dijalankan. Jika scope/path berubah, perbarui rencana dan **Before/After untuk setiap file yang akan dimodifikasi terlebih dahulu**. Jangan menyebut rencana ini telah mengimplementasikan fitur.

Gunakan `rg` untuk penelusuran. Sebelum memodifikasi service besar, cari titik extension paling kecil. Jangan merefaktor keseluruhan `scheduler-processors.js` atau mengganti jalur dua tipe konten lama hanya untuk fitur ini.

## Pengujian dan penyerahan

Setelah persetujuan mockup dan implementasi:

1. Test kontrak jumlah/kategori, output kurang dari N, resep tidak lengkap, dan produk di luar pilihan.
2. Test tenant isolation, concurrent ingest, produk per item, dan recovery/retry.
3. Test approval gate dan invalidation; buktikan I2V memakai frame yang disetujui.
4. Test teks resep dari generator sampai mocked publishing payload; test caption panjang dan manual override.
5. Jalankan regression planner/campaign existing serta build menggunakan script aktual repo.
6. Sediakan link aplikasi/mockup untuk pengujian UI manual light/dark; tidak perlu headless browser berlebihan.
7. Jangan mempublikasikan ke akun sosial nyata untuk tes tanpa instruksi eksplisit. Catat smoke test AI/media yang dijalankan dan biaya/jumlah item bila tersedia.
8. Perbarui SoT relevan dan buat `implementation-report.md` berisi hasil, test, keterbatasan, versi, commit/tag, dan status deploy. Laporan baru harus ditambahkan pada rencana dengan Before/After sebelum dibuat.

## Rilis dan deployment

Setelah kode selesai dan verifikasi lulus, ikuti SOP rilis `AGENTS.md` tanpa menunggu instruksi tambahan: periksa release script, jalankan release non-interaktif dengan versi yang selaras changelog, lalu verifikasi `main` dan tag terunggah ke remote target. Jangan force-push atau memasukkan perubahan pengguna yang tidak terkait.

**Dilarang deploy production otomatis.** Production hanya setelah perintah manual eksplisit pengguna. Untuk lingkungan yang diotorisasi, gunakan script remote-build resmi, schema/pool sesuai lingkungan, serta hindari polling SSH loop. Jangan menyalin kredensial ke dokumen, log, atau laporan.

## Respons pertama yang diharapkan

Sampaikan bahwa Anda akan mulai dari inspeksi singkat dan mockup HTML. Setelah mockup siap, berikan link nyata, jelaskan alur yang bisa dicoba termasuk teks resep untuk posting, lalu minta review sesuai SOP. Jangan langsung mengklaim fitur sudah selesai dan jangan mulai implementasi React sebelum gate review terpenuhi.
