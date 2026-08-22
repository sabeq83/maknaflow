# Affiliate Studio — Roadmap Produk & Implementasi Additive-Only

> Status: Draft product roadmap  
> Target: MAKNA Flow Staging  
> Hierarki utama: **Tenant → Brand Profile → Campaign Program → Content Planner → Content Run → ContentFlow → Performance**  
> Mandat implementasi: **setiap fase hanya menyambungkan kemampuan yang sudah ada melalui shell, adapter, projection, dan tabel baru; tidak merevisi engine legacy.**

## 1. Ringkasan Produk

**Affiliate Studio** adalah application area MAKNA Flow untuk merencanakan, memproduksi, menerbitkan, dan mengevaluasi konten afiliasi berdasarkan **Brand Profile**.

Jika YouTube Studio menggunakan `Channel → Series → Episode`, maka Affiliate Studio menggunakan:

```text
Brand Profile
└── Campaign Program
    └── Content Planner
        └── Planner Row
            └── Content Run
                └── Existing Production Engine
                    └── ContentFlow Item
                        └── Published Content & Performance
```

Affiliate Studio bukan pengganti RE Campaign, Pillar Campaign, Recipe Labs, Multiplier Lab, Instant Campaign, Product Bridging, Deconstruct Lab, Product Database, Content Planner, atau ContentFlow. Modul ini menjadi **control plane** yang menghubungkan semuanya dalam konteks Brand Profile, sedangkan modul lama tetap menjadi **execution plane**.

## 2. Sasaran Produk

- Menjadikan Brand Profile sebagai konteks kerja tertinggi untuk operasi afiliasi.
- Menjadikan Content Planner sebagai pusat komando editorial setiap brand.
- Mengelompokkan produk, campaign, planner, production run, publishing, dan performance tanpa menduplikasi datanya.
- Memungkinkan satu Campaign Program menggunakan beberapa engine produksi sekaligus.
- Mempertahankan seluruh URL, API, tabel, scheduler, worker, prompt, dan halaman legacy selama pengembangan.
- Menyediakan lineage yang dapat ditelusuri dari tujuan campaign sampai konten terbit.
- Membangun fondasi learning loop tanpa mengganggu pipeline produksi yang sudah stabil.

## 3. Keputusan Produk yang Dikunci

| Area | Keputusan |
|---|---|
| Root hierarchy | Brand Profile |
| Planning core | Existing Content Planner |
| Strategy container | Affiliate Campaign Program |
| Production execution | Existing engines melalui connector |
| Asset operation | Existing ContentFlow |
| Product source | Existing Product Database |
| Product-brand routing | Existing `brand_products` dan affiliate resolver |
| Migration approach | Additive-only dan backward-compatible |
| Legacy navigation | Tetap tersedia sampai parity dan stabilitas terbukti |
| Engine rewrite | Dilarang dalam roadmap Affiliate Studio |
| Data ownership | Data domain tetap dimiliki modul asal |
| Cross-module relation | Reference ID dan immutable snapshot |
| Release strategy | Feature flag per fase, tenant, dan capability |

## 4. Non-Negotiable Architecture Guardrails

### 4.1 Legacy Freeze Boundary

Selama fase pembangunan Affiliate Studio, komponen berikut diperlakukan sebagai **legacy-stable execution engines**:

- Content Planner
- Product Database
- Brand Profile Manager
- RE Campaign
- Pillar Campaign / OPC
- Recipe Labs
- Multiplier Lab
- Instant Campaign
- Product Bridging
- Deconstruct Lab
- Content Automations
- ContentFlow
- Publishing Scheduler
- TTS Studio, Video Studio, G-Labs worker, dan FFmpeg pipeline

Perubahan pada modul tersebut hanya boleh dilakukan apabila terdapat bug independen yang sudah ada sebelum Affiliate Studio, dan harus dipisahkan dari fase Affiliate Studio.

### 4.2 Aturan Additive-Only

Setiap fase wajib mengikuti aturan berikut:

1. Tambahkan namespace baru `/affiliate-studio` dan `/api/v2/affiliate-studio`.
2. Tambahkan tabel baru dengan prefix `affiliate_` bila diperlukan.
3. Baca data legacy melalui repository/adapter baru, bukan memindahkan query atau logika lama.
4. Jalankan engine melalui endpoint atau service contract yang sudah tersedia.
5. Simpan referensi `engine_type`, `engine_campaign_id`, dan `engine_item_id`; jangan menyalin seluruh tabel engine.
6. Gunakan projection untuk menyatukan status; jangan menyeragamkan status di tabel legacy.
7. Gunakan snapshot untuk Brand, Product, Offer, dan Planner saat run dibuat.
8. Jangan mengganti URL halaman atau endpoint legacy.
9. Jangan memindahkan komponen UI legacy ke Affiliate Studio.
10. Setiap fitur baru harus dapat dinonaktifkan tanpa memengaruhi eksekusi modul lama.

### 4.3 Connection Contract

Affiliate Studio hanya diperbolehkan berinteraksi dengan modul lain melalui pola berikut:

```text
Affiliate Studio UI
    ↓
Affiliate Studio API
    ↓
Affiliate Studio Application Service
    ├── Read Adapter → Existing Repository/API
    ├── Launch Adapter → Existing Engine API/Service
    ├── Status Projector → Existing Status Tables
    └── Lineage Writer → New affiliate_* Tables
```

Tidak diperbolehkan:

```text
Affiliate Studio UI
    └── Mengubah langsung tabel atau internal state machine engine legacy
```

## 5. Information Architecture

```text
Affiliate Studio
├── Brand Overview
├── Planner
│   ├── Calendar
│   ├── Backlog
│   ├── Campaign Plans
│   └── AI Planning
├── Products
│   ├── Brand Portfolio
│   ├── Offers & Links
│   └── Product Readiness
├── Campaigns
│   ├── Active Programs
│   ├── Program Detail
│   └── Content Mix
├── Create
│   ├── Smart Route
│   └── Expert Route
├── Intelligence
│   ├── Deconstructed References
│   ├── Blueprint Library
│   └── Winning Patterns
├── Production
├── Publishing
├── Performance
└── Brand Settings
```

Brand switcher menjadi konteks persisten di Affiliate Studio. Semua area membaca `brand_profile_id` aktif, tetapi tidak mengubah cara modul legacy memilih brand.

## 6. Tanggung Jawab Setiap Domain

| Domain | Pertanyaan yang dijawab | Source of truth |
|---|---|---|
| Brand Profile | Siapa kita dan bagaimana kita berkomunikasi? | Existing Brand Profile |
| Product Portfolio | Apa yang dijual dan link mana yang digunakan? | Existing Product Database + `brand_products` |
| Campaign Program | Mengapa dan untuk hasil apa konten dibuat? | New Affiliate Studio domain |
| Content Planner | Apa yang dibuat dan kapan diterbitkan? | Existing Content Planner |
| Production Engine | Bagaimana konten diproduksi? | Existing RE/Pillar/Recipe/Multiplier/Instant/Bridge |
| ContentFlow | Di mana aset berada dan bagaimana status distribusinya? | Existing ContentFlow |
| Performance | Apa yang berhasil? | New snapshots + future connectors |

## 7. Content Planner sebagai Planning Core

Content Planner tetap menjadi source of truth untuk perencanaan editorial. Affiliate Studio tidak membuat planner engine kedua.

### 7.1 Dua konteks tampilan

- **Brand Calendar**: seluruh planner milik Brand Profile aktif.
- **Program Plan**: planner yang terhubung ke satu Affiliate Campaign Program.

### 7.2 Pola integrasi tanpa revisi Planner

Relasi awal disimpan di tabel Affiliate Studio:

```text
affiliate_program_planners
├── affiliate_program_id
├── planner_id
├── brand_profile_id
├── relation_type
└── created_at
```

Relasi planner row disimpan sebagai sidecar:

```text
affiliate_planner_row_links
├── planner_id
├── planner_row_id
├── affiliate_program_id
├── affiliate_program_product_id
├── funnel_stage
├── content_objective
├── recommended_engine
├── assigned_engine
├── creative_hypothesis_id
└── target_publish_at
```

Dengan pola sidecar ini, fase awal tidak perlu menambah kolom pada tabel Content Planner atau mengubah contract generasinya.

### 7.3 Execution lineage

```text
Campaign Program
    ↓
Existing Planner
    ↓
Existing Planner Row + Affiliate Sidecar
    ↓
Affiliate Content Run
    ↓
Existing Engine Campaign/Item
    ↓
Existing ContentFlow Item
```

## 8. Domain Model Baru

### 8.1 Entitas minimum

- `affiliate_programs`
- `affiliate_program_products`
- `affiliate_program_planners`
- `affiliate_planner_row_links`
- `affiliate_content_runs`
- `affiliate_content_run_events`
- `affiliate_creative_hypotheses`
- `affiliate_performance_snapshots`
- `affiliate_insights`

### 8.2 Prinsip kepemilikan data

```text
affiliate_programs
    owns strategy and commercial objective

content_planners
    owns editorial plan

re_campaigns / pillar_campaigns / recipe_campaigns / multiplier tasks / instant campaigns
    own production execution

content_flow_items
    owns asset distribution state

affiliate_content_runs
    owns cross-module lineage and normalized projection only
```

### 8.3 Universal content run reference

```json
{
  "id": "run_uuid",
  "tenant_id": "tenant_uuid",
  "brand_profile_id": "brand_uuid",
  "affiliate_program_id": "program_uuid",
  "planner_id": "planner_uuid",
  "planner_row_id": "row_uuid",
  "engine_type": "pillar",
  "engine_campaign_id": "existing_campaign_id",
  "engine_item_id": "existing_item_id",
  "normalized_status": "producing",
  "brand_snapshot_json": {},
  "product_snapshot_json": {},
  "offer_snapshot_json": {}
}
```

`normalized_status` hanyalah projection Affiliate Studio. Status asli engine tidak diubah.

## 9. Normalized Lifecycle

Affiliate Studio menampilkan lifecycle lintas engine berikut:

```text
Planned → Queued → Generating → Awaiting Review → Producing
→ Rendering → Ready → Scheduled → Published → Measured
```

Status projector memetakan status legacy ke status di atas secara read-only. Mapping disimpan di connector, bukan di worker lama.

## 10. Roadmap Implementasi per Fase

## Fase 0 — Contract, Boundary, dan Feature Flag

**Tujuan:** mengunci batas arsitektur sebelum membuat UI atau integrasi.

### Penambahan

- Definisikan permission `affiliate_studio`.
- Definisikan feature flag Affiliate Studio pada level tenant.
- Tambahkan kontrak domain, daftar `engine_type`, normalized lifecycle, dan error contract.
- Tambahkan registry connector tanpa implementasi engine.
- Tambahkan dokumentasi ownership data dan legacy freeze boundary.
- Tambahkan contract tests yang memastikan connector tidak menulis ke internal state engine.

### Yang tidak disentuh

- Seluruh halaman legacy.
- Seluruh API legacy.
- Scheduler, worker, prompt, dan state machine produksi.
- Schema Content Planner dan ContentFlow.

### Kriteria selesai

- Affiliate Studio dapat diaktifkan/dimatikan tanpa efek ke menu lain.
- Daftar engine dan kontrak status tervalidasi.
- Boundary test mencegah dependency langsung dari UI baru ke repository internal legacy.

## Fase 1 — Brand-First Application Shell

**Tujuan:** menghadirkan Affiliate Studio sebagai application area tanpa mengambil alih fungsi modul lama.

### Penambahan

- Tambahkan route `/affiliate-studio`.
- Tambahkan shell, local navigation, breadcrumb, dan Brand Profile switcher.
- Tambahkan halaman Brand Overview read-only.
- Buat `brand-profile-read-adapter` untuk membaca Brand Profile existing.
- Tampilkan ringkasan produk, planner, campaign, dan ContentFlow melalui projection API.
- Tambahkan deep link ke halaman legacy dengan Brand context bila didukung.

### Yang tidak disentuh

- Brand Profile Manager tetap menjadi tempat create/edit Brand Profile.
- Product Database tetap menjadi tempat create/edit produk.
- Content Planner tetap menjadi tempat create/edit planner.
- Tidak ada tombol eksekusi engine di fase ini.

### Kriteria selesai

- User dapat memilih Brand Profile dan melihat overview terisolasi tenant.
- Seluruh angka overview dapat ditelusuri ke data existing.
- Deep link tidak mengubah perilaku halaman tujuan.
- Menonaktifkan feature flag menghilangkan shell tanpa mengganggu modul lain.

## Fase 2 — Brand Product Portfolio Projection

**Tujuan:** menampilkan Product Database dalam konteks Brand Profile tanpa membuat database produk kedua.

### Penambahan

- Buat `brand-product-read-adapter` di namespace Affiliate Studio.
- Tampilkan produk linked/unlinked berdasarkan existing `brand_products`.
- Tampilkan affiliate link source, tracking code, CTA override, dan readiness status.
- Tambahkan filter candidate, active, missing-link, dan inactive sebagai metadata Affiliate Studio.
- Tambahkan link menuju detail/edit produk pada Product Database legacy.
- Tambahkan readiness projection: product truth, image, affiliate link, dan brand association.

### Yang tidak disentuh

- Product extraction schema dan worker.
- Existing affiliate resolver precedence.
- Existing UI Product Database.
- Campaign product binding logic.

### Kriteria selesai

- Tidak ada duplikasi record produk.
- Portfolio selalu mencerminkan perubahan di Product Database.
- Affiliate link yang ditampilkan sama dengan hasil resolver existing.

## Fase 3 — Campaign Program Domain

**Tujuan:** menambahkan container strategi komersial di atas Content Planner dan engine produksi.

### Penambahan

- Tambahkan `affiliate_programs` dan `affiliate_program_products`.
- Sediakan create, edit, archive, dan detail Campaign Program.
- Simpan objective, audience, funnel mix, periode, platform, KPI, dan production target.
- Hubungkan produk existing melalui reference dan snapshot.
- Tambahkan Program Overview serta content mix target.
- Tambahkan audit trail program pada tabel event baru.

### Yang tidak disentuh

- Tidak membuat RE/Pillar/Recipe/Multiplier campaign otomatis.
- Tidak mengubah Content Planner.
- Tidak mengubah Product Database.
- Tidak mengubah ContentFlow.

### Kriteria selesai

- Program dapat dibuat tanpa memicu production engine.
- Program dapat menghubungkan beberapa produk existing.
- Mengarsipkan program tidak menghapus planner, campaign, produk, atau aset legacy.

## Fase 4 — Content Planner Connection

**Tujuan:** menjadikan Content Planner pusat komando editorial melalui relasi sidecar.

### Penambahan

- Tambahkan `affiliate_program_planners`.
- Tambahkan `affiliate_planner_row_links`.
- Buat read adapter untuk planner list, detail, row, dan calendar.
- Tampilkan Brand Calendar dan Program Plan di Affiliate Studio.
- Sediakan tindakan **Link Existing Planner**.
- Sediakan tindakan **Open in Content Planner** untuk edit penuh.
- Tambahkan metadata program, funnel, objective, dan engine recommendation pada sidecar.
- Tambahkan coverage summary berdasarkan funnel, produk, platform, dan jadwal.

### Yang tidak disentuh

- Generator dan validator Content Planner.
- Schema planner dan planner rows.
- Route create/edit/execute Content Planner.
- Sync Google Sheets dan ContentFlow milik Planner.

### Kriteria selesai

- Planner existing dapat ditautkan ke program tanpa migrasi data.
- Satu planner dapat dilihat dalam konteks brand dan program.
- Edit di Content Planner langsung tercermin pada projection Affiliate Studio.
- Menghapus link tidak menghapus planner asli.

## Fase 5 — Unified Production Visibility

**Tujuan:** menyatukan visibilitas semua engine tanpa mengubah cara engine bekerja.

### Penambahan

- Tambahkan `affiliate_content_runs` dan `affiliate_content_run_events`.
- Implementasikan read connector per engine:
  - RE Campaign connector
  - Pillar Campaign connector
  - Recipe Labs connector
  - Multiplier Lab connector
  - Instant Campaign connector
  - Product Bridging connector
- Implementasikan normalized status projector.
- Tampilkan unified Production Queue.
- Tambahkan deep link ke detail engine legacy untuk repair, approval, atau retry.
- Tambahkan reconciliation job yang membaca status engine dan memperbarui projection.

### Yang tidak disentuh

- Status column dan lifecycle di tabel legacy.
- Scheduler-control masing-masing engine.
- Retry, approval, repair, dan regenerate endpoint legacy.
- Worker produksi dan log engine.

### Kriteria selesai

- Satu queue dapat menampilkan run lintas engine.
- Status projection tidak dapat mengubah status engine.
- Semua tindakan teknis membuka atau memanggil contract resmi modul asal.
- Reconciliation aman dijalankan ulang dan idempotent.

## Fase 6 — Expert Route Launch Connectors

**Tujuan:** memungkinkan Affiliate Studio meluncurkan engine existing tanpa memindahkan form atau logika bisnisnya.

### Penambahan

- Tambahkan halaman **Create → Expert Route**.
- User memilih planner row, produk, dan engine.
- Launch connector membentuk payload melalui contract engine existing.
- Engine tetap membuat campaign/item di tabelnya sendiri.
- Affiliate Studio hanya menyimpan reference dan snapshots pada `affiliate_content_runs`.
- Tambahkan idempotency key agar satu planner row tidak terpicu ganda.
- Tambahkan preflight yang memeriksa Brand, Product, affiliate link, dan requirement engine.

### Yang tidak disentuh

- Form lengkap pada halaman engine lama.
- Validation dan default internal engine.
- Prompt builder.
- Pipeline Single-Pass OPC.
- Scheduler dan production worker.

### Kriteria selesai

- Run yang diluncurkan dari Affiliate Studio identik dengan run dari endpoint resmi engine.
- Failure connector tidak meninggalkan campaign ganda.
- User tetap dapat menyelesaikan atau memperbaiki run dari UI legacy.

## Fase 7 — Smart Route Recommendation

**Tujuan:** merekomendasikan engine berdasarkan tujuan tanpa mengambil alih engine execution.

### Penambahan

- Tambahkan deterministic routing rules sebagai default.
- Tambahkan AI recommendation opsional di atas rule result.
- Tampilkan alasan rekomendasi dan requirement yang belum terpenuhi.
- User wajib mengonfirmasi engine sebelum launch.
- Simpan recommendation snapshot dan keputusan user.
- Tambahkan pilihan:
  - Pillar untuk edukasi dan soft-selling
  - RE untuk adaptasi referensi
  - Multiplier untuk scale blueprint
  - Recipe untuk konten kuliner
  - Instant untuk produksi cepat
  - Product Bridging untuk injeksi produk

### Yang tidak disentuh

- Tidak membuat universal prompt baru untuk menggantikan prompt engine.
- Tidak mengubah output contract engine.
- Tidak mengubah planner generation logic.

### Kriteria selesai

- Rekomendasi dapat dijelaskan dan dioverride user.
- Engine menerima payload melalui connector Fase 6.
- Menonaktifkan AI tetap menyisakan routing deterministik.

## Fase 8 — Creative Intelligence Connection

**Tujuan:** menghubungkan Deconstruct dan Multiplier ke brand/program tanpa memindahkan kedua modul tersebut.

### Penambahan

- Buat read adapter Deconstruct Library.
- Tambahkan sidecar binding `brand_profile_id`, program, product category, dan review state.
- Tambahkan `affiliate_creative_hypotheses`.
- Tampilkan blueprint lifecycle: discovered, reviewed, approved, tested, winner, retired.
- Sediakan tindakan **Open in Deconstruct Lab**.
- Sediakan tindakan **Scale with Multiplier** melalui launch connector resmi.
- Simpan lineage dari source asset ke multiplier runs.

### Yang tidak disentuh

- Deconstruct prompt dan multimodal worker.
- Deconstruct scheduler.
- Multiplier worker dan task schema.
- Original storyboard dan product ideas output.

### Kriteria selesai

- Satu deconstructed asset dapat diklasifikasikan per brand tanpa mengubah asset asli.
- Multiplier run dapat ditelusuri ke blueprint, program, planner row, dan produk.
- Menghapus sidecar tidak menghapus aset Deconstruct.

## Fase 9 — Publishing Connection

**Tujuan:** menampilkan kesiapan dan status publishing dalam konteks brand/program.

### Penambahan

- Buat ContentFlow read adapter dan publishing status projector.
- Hubungkan content run dengan ContentFlow item melalui existing identifiers/bindings.
- Tampilkan Ready, Scheduled, Published, dan Failed per brand/program.
- Tambahkan deep link ke ContentFlow dan Publishing Scheduler.
- Tambahkan preflight projection untuk affiliate link, disclosure, account, dan media readiness.
- Tambahkan immutable publishing snapshot pada run.

### Yang tidak disentuh

- ContentFlow ingestion.
- Publishing repository dan worker.
- Account connection dan scheduler controls.
- Platform-specific publishing API.

### Kriteria selesai

- Status Affiliate Studio konsisten dengan ContentFlow.
- Affiliate Studio tidak dapat menandai konten published tanpa bukti dari source system.
- Retry dan repair tetap dijalankan oleh modul publishing existing.

## Fase 10 — Performance Foundation

**Tujuan:** membangun lineage dan snapshots untuk pengukuran tanpa mengubah pipeline produksi.

### Penambahan

- Tambahkan `affiliate_performance_snapshots`.
- Definisikan metric contract lintas platform.
- Hubungkan snapshot dengan brand, program, planner row, run, product, offer, hook, CTA, dan blueprint.
- Tambahkan manual/CSV import sebagai konektor awal bila API platform belum tersedia.
- Tampilkan content, product, program, dan creative performance.
- Tandai data sebagai measured, partial, stale, atau unavailable.

### Yang tidak disentuh

- Existing reports.
- Existing ContentFlow reporting.
- Publishing pipeline.
- Production engine.

### Kriteria selesai

- Semua metric mempunyai source, captured_at, dan attribution confidence.
- Tidak ada metric yang diklaim sebagai conversion tanpa sumber terverifikasi.
- Import ulang bersifat idempotent.

## Fase 11 — Insight dan Learning Loop

**Tujuan:** mengubah performance snapshots menjadi rekomendasi yang dapat ditinjau user.

### Penambahan

- Tambahkan `affiliate_insights`.
- Buat comparison engine untuk hook, angle, blueprint, CTA, engine, produk, dan platform.
- Tampilkan recommendation dengan evidence dan confidence.
- Tambahkan tindakan:
  - Make Variants
  - Apply to Another Product
  - Add to Planner
  - Retire Angle
  - Mark as Winner
- Semua tindakan menghasilkan draft/sidecar baru; tidak mengubah campaign lama.

### Yang tidak disentuh

- Tidak melakukan auto-rewrite Brand Profile.
- Tidak mengubah prompt/preset engine secara otomatis.
- Tidak menjalankan production tanpa approval user.
- Tidak mengubah histori planner atau performance.

### Kriteria selesai

- Insight selalu memiliki evidence link.
- User dapat menerima, menolak, atau mengarsipkan insight.
- Accepted insight membuat draft baru melalui connector yang sudah tersedia.

## Fase 12 — Assisted Campaign Program Builder

**Tujuan:** membantu user menyusun program dan planner draft dengan seluruh connection layer yang sudah stabil.

### Penambahan

- Tambahkan tindakan **Build Content Plan**.
- AI membaca Brand snapshot, linked products, objective, funnel target, approved blueprint, capacity, dan history.
- AI menghasilkan proposal content mix dan draft planner rows.
- Draft dibuat melalui contract resmi Content Planner atau import contract yang tersedia.
- User meninjau dan menyetujui sebelum planner atau run dibuat.
- Tambahkan anti-duplication berdasarkan planner/history projection.

### Yang tidak disentuh

- Tidak mengganti Content Planner AI engine.
- Tidak menulis langsung ke tabel planner tanpa service contract.
- Tidak memicu engine saat plan baru dibuat.
- Tidak mengubah run yang sudah berjalan.

### Kriteria selesai

- Proposal dapat diedit sebelum disimpan.
- Draft planner dapat dibuka dan dikelola penuh di Content Planner.
- Production hanya berjalan setelah approval terpisah.

## 11. Connector Registry

Setiap connector wajib mengimplementasikan contract minimum:

```text
getCapabilities()
preflight(input)
launch(input, idempotencyKey)
getSourceReference(sourceId)
getProjectedStatus(sourceId)
getDeepLink(sourceId)
```

Read-only connector cukup mengimplementasikan:

```text
list(filters)
get(id)
getProjectedStatus(id)
getDeepLink(id)
```

Setiap connector memiliki test suite sendiri dan tidak boleh mengimpor komponen UI legacy.

## 12. Compatibility Matrix

| Modul existing | Fase koneksi | Mode awal | Kepemilikan tetap |
|---|---:|---|---|
| Brand Profile | 1 | Read + deep link | Brand Profile Manager |
| Product Database | 2 | Read + deep link | Product Database |
| Content Planner | 4 | Read + sidecar link | Content Planner |
| RE Campaign | 5–6 | Read status + launch | RE Campaign |
| Pillar Campaign | 5–6 | Read status + launch | Pillar Campaign |
| Recipe Labs | 5–6 | Read status + launch | Recipe Labs |
| Multiplier Lab | 5–6, 8 | Read status + launch | Multiplier Lab |
| Instant Campaign | 5–6 | Read status + launch | Instant Campaign |
| Product Bridging | 5–6 | Read status + launch | Product Bridging |
| Deconstruct Lab | 8 | Read + sidecar + deep link | Deconstruct Lab |
| ContentFlow | 9 | Read + lineage | ContentFlow |
| Publishing Scheduler | 9 | Read + deep link | Publishing module |
| Reports | 10 | Read where compatible | Reports module |

## 13. Verification Gate per Fase

Setiap fase wajib lulus seluruh gate berikut sebelum fase selanjutnya:

1. **Legacy smoke test:** alur create/run/retry modul yang dihubungkan tetap lulus.
2. **No schema mutation:** tidak ada ALTER pada tabel legacy untuk kebutuhan Affiliate Studio.
3. **No route replacement:** endpoint dan URL legacy tetap tersedia.
4. **Feature flag isolation:** Affiliate Studio off menghasilkan perilaku sistem lama yang identik.
5. **Tenant isolation:** seluruh query baru terikat `tenant_id`.
6. **Brand isolation:** projection tidak mencampur Brand Profile.
7. **Idempotency:** launch, reconciliation, dan import aman dijalankan ulang.
8. **Truthful status:** normalized status selalu dapat ditelusuri ke source status.
9. **Deep-link recovery:** user dapat membuka modul asal untuk operasi lanjutan.
10. **Rollback safety:** tabel/route baru dapat dinonaktifkan tanpa rollback engine legacy.

## 14. Definition of Done Affiliate Studio

Affiliate Studio dinyatakan matang ketika:

- User dapat memilih Brand Profile dan melihat seluruh operasi afiliasinya.
- Product Portfolio berasal dari Product Database existing tanpa duplikasi.
- Campaign Program dapat menghubungkan produk dan Content Planner.
- Content Planner tetap menjadi planning source of truth.
- Planner row dapat meluncurkan beberapa engine melalui connector resmi.
- Production Queue menampilkan status lintas engine secara truthful.
- ContentFlow dan publishing dapat ditelusuri dari program dan planner row.
- Performance dapat ditelusuri kembali ke brand, produk, offer, hook, blueprint, dan engine.
- Seluruh halaman dan pipeline legacy tetap dapat digunakan secara independen.
- Tidak ada fase yang membutuhkan rewrite engine sebelumnya untuk melanjutkan fase berikutnya.

## 15. Future Scope di Luar Roadmap Awal

- Marketplace commission connectors.
- Affiliate link health monitoring otomatis.
- Offer versioning dan expiry automation.
- Budget dan cost attribution per content run.
- Autonomous allocation berdasarkan kapasitas produksi.
- Controlled autopilot yang tetap menggunakan connector dan approval policy.

Fitur future tersebut hanya boleh dimulai setelah Fase 0–12 stabil dan tidak boleh digunakan sebagai alasan untuk merevisi engine legacy.

## 16. Prinsip Penutup

```text
Affiliate Studio coordinates.
Content Planner plans.
Existing engines produce.
ContentFlow operates assets.
Publishing distributes.
Performance teaches.
```

Roadmap ini sengaja memisahkan **orkestrasi baru** dari **mesin produksi lama**. Setiap fase menambahkan kemampuan baru melalui connection layer yang dapat diuji, dinonaktifkan, dan dirilis secara independen. Dengan demikian Affiliate Studio dapat berkembang tanpa siklus revisi berulang terhadap RE, Pillar, Recipe, Multiplier, Content Planner, atau ContentFlow.
