# Runbook — Content Automation Product Campaign Modal

## Sumber data

- `product_extractions`: katalog utama Data Produk tenant.
- `brand_products`: binding Brand Profile, affiliate routing, tracking, CTA, dan status aktif.
- OPC preset: konfigurasi creative/visual/production; hanya preset dengan `campaign_kinds` sesuai yang muncul.

## Troubleshooting dropdown Produk

1. Pastikan Brand Profile telah dipilih.
2. Periksa `GET /api/v2/content-automations/product-options?brand_profile_id=...`.
3. HTTP 401 berarti sesi login tidak tersedia.
4. HTTP 403/404 berarti Brand Profile bukan milik tenant aktif.
5. Respons sukses harus memuat `summary.total`, termasuk produk berstatus Not linked.
6. Produk tanpa deskripsi diblokir dari Save karena snapshot run mensyaratkan nama dan deskripsi.

## Binding saat Save

- Produk Linked: binding dipakai ulang dan routing tidak ditimpa secara default.
- Centang **Perbarui routing existing** untuk mengubah affiliate/landing/tracking/CTA.
- Produk Not linked: binding aktif dibuat saat schedule berhasil diproses.
- Semua schedule baru tetap disimpan paused.

## Target Audience

Mode Auto memakai urutan Data Produk → OPC preset → Brand → fallback. Ketika field diedit, source menjadi Manual dan tidak ditimpa oleh perubahan preset. Gunakan **Reset ke Auto** untuk kembali ke resolusi otomatis.

Target Audience adalah sasaran pesan planner. Visual Subject adalah demographic yang muncul di visual OPC. Bila Visual Subject `custom`, deskripsi custom wajib diisi.

## Rollback Dev

Redeploy tag aplikasi sebelumnya hanya ke `~/maknaflow-dev`, kemudian reload PM2 Dev. Jangan menghapus binding yang sudah tercipta; binding adalah data domain valid dan dapat dinonaktifkan melalui API Brand Profile bila diperlukan.

## Environment wajib

- UI 5020, API 7020.
- `PG_SEARCH_PATH=dev`.
- `PGPOOL_MAX=3`.
- Dilarang menjalankan deploy Staging atau Production tanpa instruksi eksplisit.
