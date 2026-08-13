# Runbook — Content Automation Product Campaign Modal

## Sumber data

- `product_extractions`: katalog utama Data Produk tenant.
- `brand_products`: binding Brand Profile, affiliate routing, tracking, CTA, dan status aktif.
- `/api/v2/products`: endpoint katalog produk canonical untuk Content Automation dan Content Planner.
- `product-options`: compatibility wrapper yang menambahkan ringkasan binding bila Brand Profile dipilih; pemuatan katalog tidak bergantung pada Brand Profile.
- OPC preset: konfigurasi creative/visual/production dari Preset Manager. Preset baru wajib menyimpan `campaign_kinds` secara eksplisit.

Preset lama tanpa `campaign_kinds` tetap kompatibel melalui inference deterministik. Jalankan migrasi metadata hanya pada schema target:

```bash
node scripts/migrate-operator-preset-campaign-kinds.mjs
node scripts/migrate-operator-preset-campaign-kinds.mjs --apply
```

Selalu review output dry-run sebelum `--apply`. Untuk perubahan manual, buka `/settings/presets`; badge menunjukkan `explicit`, `inferred`, atau `system`.

## Troubleshooting dropdown Produk

1. Periksa `GET /api/v2/products?limit=50&search=...`; produk harus dapat dimuat tanpa Brand Profile.
2. Bila Brand Profile dipilih, periksa `GET /api/v2/content-automations/product-options?brand_profile_id=...` untuk status binding.
3. HTTP 401 berarti sesi login tidak tersedia.
4. HTTP 403/404 berarti Brand Profile bukan milik tenant aktif.
5. Respons sukses harus memuat `summary.total`, termasuk produk berstatus Not linked.
6. Produk tanpa deskripsi diblokir dari Save karena snapshot run mensyaratkan nama dan deskripsi.

Urutan modal Product Campaign adalah **OPC Preset → Produk → Brand Profile → Binding**. Perubahan Brand Profile tidak boleh menghapus produk yang sudah dipilih.

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

## OPC Start Frame Reference Audit

- Foto aktif ditentukan oleh pointer `active_photo`; Product Picker, initial generation, dan Regen harus memiliki SHA-256 yang sama.
- Initial dan Regen untuk item/clip/prompt yang sama harus menghasilkan `request_fingerprint` identik pada `opc_start_frame_request_audits`.
- `reference_count=1` wajib untuk clip dengan `requires_product_reference=true`.
- Error `PRODUCT_REFERENCE_UNAVAILABLE` harus memperbaiki sumber foto; jangan memaksa pure T2I.
- Audit hanya boleh berisi hash, source field, origin, dan task ID—bukan Base64, prompt penuh, API key, atau cookie.
# Product Campaign Pipeline Hardening

## Feature flags

- `content_automation_product_campaign_enabled`: mengizinkan pembuatan schedule Product Campaign untuk tenant.
- `content_automation_product_campaign_pilot_enabled`: mengizinkan `run-now` dan dispatch scheduler Product Campaign.
- Brand Editorial tidak dipengaruhi kedua flag tersebut.
- Emergency stop: matikan flag pilot lebih dahulu; worker tidak akan membuat operator job baru.

## Durable start-frame worker

Worker menyimpan satu manifest per item, clip, tipe asset, dan revision di `pillar_campaign_item_assets`. Status normal:

`queued → processing → provider_processing → completed`

Kegagalan retryable menjadi `retry_wait`; lease kedaluwarsa dipulihkan otomatis. Maksimal lima attempt sebelum `failed`. Restart service aman karena `provider_task_id`, request, attempt, dan lease tersimpan di PostgreSQL.

## Review actions

Endpoint canonical: `POST /api/v2/pillar-campaigns/items/:itemId/review-action` dengan `action` berupa `approve`, `hold`, `resume`, atau `reject`. Selalu kirim `review_revision` dan header `Idempotency-Key`. `hold` dan `reject` wajib memiliki alasan. Endpoint approve lama tetap menjadi compatibility wrapper.

## Production stage ledger

TTS, video submission, FFmpeg/upload, dan ContentFlow memakai `pillar_campaign_stage_executions`. Idempotency key mengandung tenant, item, stage, dan revision. Jangan menghapus ledger saat recovery; lepaskan lease atau biarkan lease expire.

## Pemeriksaan Dev tanpa provider berbayar

1. Pastikan feature flag enabled/pilot dapat diubah Admin tenant.
2. Pastikan tenant lain tidak ikut berubah.
3. Verifikasi create/run Product Campaign ditolak ketika flag terkait off.
4. Uji hold/resume/reject pada item fixture; jangan approve fixture yang akan memicu provider.
5. Sisipkan asset fixture ber-lease kedaluwarsa lalu jalankan recovery; pastikan menjadi `retry_wait`.
6. Periksa log JSON dan pastikan token/API key ter-redaksi.

## Rollback Dev

1. Matikan `content_automation_product_campaign_pilot_enabled`.
2. Tunggu stage yang sedang claimed selesai atau lease expire.
3. Deploy tag patch sebelumnya ke `~/maknaflow-dev`.
4. Jangan menghapus asset manifest, review action ledger, atau stage execution ledger.
5. Jangan melakukan deployment Staging/Production dalam rangkaian hardening ini.
