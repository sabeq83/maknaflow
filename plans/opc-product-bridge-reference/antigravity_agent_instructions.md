# Antigravity Agent Instructions — OPC Product Bridge Reference Integrity

## Mission

Implementasikan seluruh rencana di `plans/opc-product-bridge-reference/implementation_plan.md` untuk memperbaiki identitas produk pada start frame Product Bridge. Kerjakan sampai test, build, smoke test yang aman, rilis patch, tag, dan push terverifikasi. Jangan memperluas scope ke production deployment.

## Mandatory Reading Before Editing

1. Baca `AGENTS.md` sepenuhnya.
2. Baca `plans/opc-product-bridge-reference/implementation_plan.md` sepenuhnya.
3. Baca `docs/WEBHOOK_INTEGRATION.en.md`, terutama §1, §4, §5.1, §6, §6.1, §7, §9, dan §11.
4. Karena repository memakai Next.js versi dengan breaking changes, baca guide relevan di `node_modules/next/dist/docs/` sebelum mengubah route handler atau page.
5. Periksa `git status` dan pertahankan semua perubahan user yang tidak terkait. Jangan overwrite, stash, reset, checkout, atau menghapusnya.

## Non-Negotiable Product Contract

Pipeline baru hanya mempunyai dua foto kanonis:

```text
raw_photo_url
clean_photo_url
```

`active_photo` hanya pointer dengan nilai kanonis:

```text
raw_photo_url | clean_photo_url
```

Aturan resolve:

```text
explicit Raw   → raw_photo_url
explicit Clean → clean_photo_url
no selection   → clean_photo_url, lalu raw_photo_url
neither exists → fail preflight
```

Jika user secara eksplisit memilih foto tetapi file-nya hilang, fail preflight. Jangan fallback diam-diam karena itu menyembunyikan kerusakan data.

Dilarang memakai `cleaned_photo_url`, `generated_photo_url`, atau `photo_url` dalam resolver Product Bridge baru. Kolom tersebut tetap ada untuk compatibility modul lama dan tidak dihapus dalam task ini.

## Required G-Labs Payload

Gunakan kontrak resmi named reference:

```js
{
  data: 'data:image/png;base64,...',
  category: 'subject',
  name: 'product_truth_<sanitizedProductId>.png'
}
```

Prompt harus menyebut tag penuh:

```text
@product_truth_<sanitizedProductId>
```

Product reference wajib index 0 pada Product Bridge. Character/scene/style references mengikuti setelahnya. Gunakan nama unik; matching G-Labs berbasis substring dan first match wins.

Jangan mengirim field nonstandar seperti `role`, `required`, `priority`, `reference_manifest`, atau expected SHA ke G-Labs. `expected_reference_sha256s` adalah guard internal MAKNA Flow dan tidak boleh masuk JSON body provider.

Object dan string references harus sama-sama didukung. Validator wajib:

- mengambil bytes dari string atau `.data`;
- memvalidasi data URI;
- memvalidasi magic bytes versus MIME;
- menolak decoded image di bawah minimum G-Labs;
- menghitung SHA-256 bytes;
- memvalidasi/sanitasi `name` dan `category`;
- tidak pernah mencetak base64.

## Required Isolation Semantics

Product Bridge adalah `reference_critical`.

Initial generation:

```text
threaded before-bridge tasks → drain sampai terminal
reference-critical bridge task → submit + poll + download sendirian
threaded after-bridge tasks → submit setelah bridge terminal
```

Jika bridge lebih dari satu clip, jalankan clip bridge satu per satu.

Durable bulk regen:

- Tambahkan kolom additive `reference_critical BOOLEAN NOT NULL DEFAULT FALSE` secara idempotent.
- Nilai critical ditentukan server-side dari `resolveProductReferenceRequirement`.
- Critical asset tidak boleh claim/submit jika sibling item masih `processing` atau `provider_processing`.
- Non-critical sibling tidak boleh claim/submit selama critical asset `processing` atau `provider_processing`.
- Isolation gate berlaku hingga task critical terminal, bukan hanya sampai HTTP 202 diterima.
- Scope lock: `tenant_id + campaign_item_id`.
- Gunakan transaksi/claim SQL yang tahan dua worker; check-then-act biasa di JavaScript tidak diterima.

Manual single regen sudah isolated; pertahankan builder bersama dan jangan membuat jalur payload baru.

## Polling and Model Rules

- Synchronous G-Labs image polling: tepat 4000 ms.
- Durable start-frame worker yang sudah 5 detik tetap 5 detik.
- Jangan mengubah polling TTS/video atau loop lain yang kebetulan memakai 2000 ms.
- Pillar T2I model: `nano_banana_2`.
- YouTube start-frame: model resmi G-Labs dari konfigurasi eksplisit, fallback `nano_banana_2`.
- Hapus `imagen_3` dari YouTube adapter; dokumentasi menyatakan unknown image model diam-diam fallback, sehingga nama invalid tidak boleh dipertahankan.
- Jangan menginfer image model dari profile video Veo.

## Implementation Discipline

1. Update `## Execution Task List` pada implementation plan dari `[ ]` menjadi `[x]` segera setelah setiap tahap selesai.
2. Gunakan shared helpers; jangan biarkan scheduler initial, single regen, dan durable worker mempunyai resolver foto/payload masing-masing.
3. Pertahankan tenant context, brand webhook override, task route, SHA audit, and download routing.
4. Audit/log hanya boleh mencatat metadata aman: source field, sanitized name, reference index, SHA, MIME, byte length, requested/effective model, task ID, dan origin.
5. Jangan mengubah Single-Pass Strategic Campaign architecture.
6. Jangan deploy ke Production. Dev/Staging deploy hanya jika diperlukan oleh smoke test dan sesuai instruksi user/SOP.
7. Jangan menggunakan SSH polling loop.

## Required Tests

Minimal test matrix:

1. active Clean memilih `clean_photo_url`;
2. active Raw memilih `raw_photo_url`;
3. active kosong memilih Clean;
4. Clean kosong memilih Raw;
5. explicit selected file hilang menghasilkan preflight failure;
6. legacy fields berisi file tetapi Raw/Clean kosong tetap failure;
7. reference string valid tetap diterima;
8. named object valid diterima dan SHA dihitung dari `.data`;
9. MIME mismatch, malformed name, dan image terlalu kecil ditolak;
10. product named reference berada di index 0;
11. prompt memiliki `@tag` yang persis cocok;
12. character references tetap ikut setelah product reference;
13. initial versus manual regen parity;
14. bridge clip tidak overlap dengan sibling tasks;
15. dua worker tidak dapat menembus isolation gate;
16. polling sync bernilai 4000 ms;
17. Pillar model `nano_banana_2`;
18. YouTube model valid dan source tidak lagi mengandung `imagen_3`;
19. tidak ada base64 di audit/log.

Jalankan verifikasi proporsional:

```bash
node scripts/test-opc-start-frame-reference.mjs
node scripts/test-opc-start-frame-reference-integration.mjs
npm test -- --runInBand
npm run lint
npm run build
```

Jika integration test memerlukan DB/tunnel yang tidak tersedia, catat sebagai environment blocker secara presisi tetapi tetap jalankan seluruh unit/contract test yang tidak memerlukan jaringan. Jangan menyatakan integration lulus jika tidak dijalankan.

## G-Labs Smoke Test Evidence

Untuk smoke test provider, simpan bukti tanpa base64:

```text
campaign_id
campaign_item_id
clip_index
origin
reference_source_field
reference_name
reference_position
reference_sha256
reference_mime_type
reference_byte_length
requested_model
effective_model
provider_task_id
sibling_active_count_at_submit
```

Uji initial dan manual regen dengan produk/prompt sama. Fingerprint wajib sama. Lakukan satu uji active Clean dan satu active Raw. Jangan menilai “identik” hanya dari status completed; inspeksi output secara visual dan sertakan path hasil pada laporan lokal.

## Completion and Release

Setelah seluruh verifikasi yang tersedia berhasil:

1. pastikan perubahan hanya menyentuh scope;
2. perbarui changelog;
3. jalankan:

```bash
npm run release-non-interactive -- --type patch --title "Perbaiki Referensi Product Bridge" --points "Gunakan referensi produk Raw/Clean kanonis dan named @tag G-Labs|Isolasi task Product Bridge dan selaraskan polling serta model image"
```

4. verifikasi versi, commit, tag `vX.Y.Z`, branch `main`, dan remote `https://github.com/sabeq83/maknaflow.git`;
5. jangan deploy Production;
6. laporan akhir wajib membedakan: implemented, verified locally, verified against DB, verified against G-Labs, released, pushed, serta hal yang belum dapat diverifikasi.

