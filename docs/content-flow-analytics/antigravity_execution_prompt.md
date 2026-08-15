# Instruksi Eksekusi Antigravity — Content Flow Analytics & Reporting

## Misi

Implementasikan halaman **Analytics & Reporting** sebagai view ketiga pada Content Flow MAKNA Flow berdasarkan:

```text
docs/content-flow-analytics/implementation_plan.md
```

Baca dokumen tersebut seluruhnya sebelum mengubah kode. Dokumen itu adalah spesifikasi utama untuk scope, definisi metrik, kontrak API, keamanan, testing, dan acceptance criteria.

## Aturan Kerja Wajib

1. Baca `AGENTS.md` repository terlebih dahulu dan patuhi seluruh SOP.
2. Karena project menggunakan Next.js `16.2.5` dengan breaking changes, baca dokumentasi yang relevan di `node_modules/next/dist/docs/` sebelum menulis kode, khususnya:
   - `01-app/01-getting-started/05-server-and-client-components.md`
   - `01-app/01-getting-started/06-fetching-data.md`
   - `01-app/01-getting-started/08-caching.md`
   - `01-app/01-getting-started/15-route-handlers.md`
3. Inspeksi implementasi nyata sebelum mengedit:
   - `app/content-flow/page.js`
   - `app/content-flow/PublishingScheduler.js`
   - `app/api/content-flow/route.js`
   - `lib/contentflow-repository.js`
   - `lib/auth.js`
   - `lib/tenant-context.js`
   - `lib/db-pg.js`
   - `app/globals.css`
   - `app/theme.css`
4. PostgreSQL adalah sumber kebenaran. Jangan membuat reporting dari array hasil pagination di browser.
5. Jangan menambahkan dependency chart baru. Gunakan React + SVG/CSS sesuai design system existing.
6. Jangan mengubah data produksi atau status publikasi selama implementasi reporting.
7. Jangan melakukan deployment production. Deployment production hanya boleh dilakukan dengan perintah manual eksplisit pengguna.

## Kontrol Progress Real-Time

Setelah menyelesaikan setiap tahap, segera edit:

```text
docs/content-flow-analytics/implementation_plan.md
```

Ubah checkbox tahap terkait dari:

```markdown
- [ ]
```

menjadi:

```markdown
- [x]
```

Jangan menandai tahap selesai sebelum implementasi dan verifikasi tahap tersebut benar-benar selesai. Jangan menunggu hingga akhir untuk memperbarui semua checkbox sekaligus.

## Urutan Eksekusi

### Tahap 1 — Audit dan Baseline

- Pastikan worktree tidak memiliki perubahan user yang akan tertimpa.
- Audit schema `content_flow_items` pada schema staging.
- Audit nilai unik seluruh status platform dan `pipeline_status`.
- Audit tanggal publish kosong, invalid, serta mismatch status/tanggal.
- Audit tenant dan assigned-brand behavior.
- Catat baseline per tenant yang dipakai untuk validasi manual.
- Jangan menaruh credential atau token dalam log/dokumentasi baru.
- Tandai Tahap 1 selesai.

### Tahap 2 — Reporting Repository

Buat:

```text
lib/contentflow-reporting.js
```

Ketentuan:

- Gunakan `getActiveTenantId()` dan fail closed jika tenant tidak tersedia.
- Scope konsisten dengan Content Library: `nextcloud_url` wajib ada.
- Terapkan `allowedAccounts` di SQL, bukan setelah hasil query diterima.
- Semua value query memakai parameter PostgreSQL.
- Nama bucket/query fragment hanya berasal dari allowlist internal.
- Gunakan `COUNT(DISTINCT video_id)`.
- Bedakan published-any asset dan platform posts.
- Safe-parse kolom tanggal publish TEXT; jangan cast langsung nilai invalid.
- Jangan melakukan query N+1 per brand.
- Kembalikan number JavaScript, bukan string count PostgreSQL.
- Tandai Tahap 2 selesai setelah unit logic dapat diuji.

### Tahap 3 — Route Handler

Buat:

```text
app/api/content-flow/reporting/route.js
```

Ketentuan:

- Bungkus GET dengan `withTenantContext`.
- Validasi enum, format tanggal, urutan tanggal, dan range maksimal 366 hari.
- Admin/superadmin memperoleh scope tenant penuh.
- User biasa hanya memperoleh `assignedBrandNames`.
- Tolak pemilihan brand di luar scope dengan status `403`.
- Gunakan `400` untuk filter invalid.
- Jangan menggunakan cache lintas tenant/user.
- Jangan mengembalikan SQL detail atau stack trace ke client.
- Tandai Tahap 3 selesai setelah route test/inspection lulus.

### Tahap 4 — Komponen Analytics

Buat:

```text
app/content-flow/ContentFlowAnalytics.js
```

Ikuti mockup yang telah disetujui dan token tema existing. Implementasikan:

- Filter rentang waktu.
- Custom date range.
- Dimensi tanggal Produksi/Publish.
- Brand dan pipeline status.
- Tombol Terapkan.
- Enam KPI utama.
- Ready-unpublished sebagai informasi operasional tambahan.
- Grafik produksi vs publikasi.
- Breakdown platform.
- Tabel per brand.
- Banner anomaly.
- Export CSV dari data terfilter.
- Loading skeleton, retryable error, empty state.
- Responsive table dan filter.
- Abort request lama ketika filter baru dijalankan/unmount.
- Accessibility: label input, focus state, table headers, chart title/legend, nilai tekstual.

Jangan menampilkan angka mockup sebagai hard-coded fallback. Bila API gagal, tampilkan error state.

Tandai Tahap 4 selesai setelah UI selesai dan responsive.

### Tahap 5 — Integrasi Content Flow

Modifikasi:

```text
app/content-flow/page.js
```

Ketentuan:

- Tambahkan `analytics` sebagai nilai view sah.
- Tambahkan tab `Analytics & Reporting`.
- Sinkronkan view ke query string memakai router API yang sesuai Next.js versi terpasang.
- Pertahankan parameter `account` ketika berpindah tab.
- Jangan merusak preload Scheduler.
- Hindari fetch Library yang tidak diperlukan ketika Analytics aktif jika refactor aman dilakukan.
- Jangan mengubah behavior edit/delete/sync Content Library.
- Tandai Tahap 5 selesai setelah semua tab dapat dinavigasi dan direfresh.

### Tahap 6 — Testing

Buat:

```text
tests/contentflow-reporting.test.js
```

Wajib menguji:

- Tenant isolation.
- Assigned-brand isolation.
- Empty assigned brand fail closed.
- Admin tenant-wide scope.
- Invalid enum/date/range.
- Asia/Jakarta boundary.
- `COUNT(DISTINCT video_id)`.
- Published-any vs platform posts.
- Ready-unpublished.
- Fully-distributed TT + FB + IG.
- Publish dimension menghitung platform berdasarkan tanggalnya sendiri.
- Invalid publish date menjadi anomaly dan tidak crash.
- Empty dataset.
- Semua count pada response berupa number.

Gunakan test fixture tenant khusus dan bersihkan hanya fixture yang dibuat oleh test. Jangan menghapus data existing.

Tandai Tahap 6 selesai setelah test baru lulus.

### Tahap 7 — Verifikasi Teknis

Jalankan:

```bash
node --test tests/contentflow-reporting.test.js
npm run test:publishing-scheduler
npm run staging:build
```

Jika ada kegagalan:

- Cari akar masalah.
- Perbaiki implementasi, bukan menonaktifkan assertion.
- Jalankan ulang test yang relevan.
- Pastikan tidak ada secret, SQL detail, atau data lintas tenant dalam response/log.
- Review diff akhir untuk perubahan di luar scope.
- Tandai Tahap 7 selesai hanya setelah seluruh verifikasi lulus.

### Tahap 8 — Verifikasi Manual Staging

- Jalankan environment staging sesuai SOP repository.
- Login sebagai admin dan minimal satu user brand-scoped.
- Verifikasi `/content-flow?view=analytics`.
- Cocokkan KPI dan breakdown dengan query read-only PostgreSQL tenant yang sama.
- Uji seluruh filter, URL refresh, back/forward, CSV, mobile, empty, dan error state.
- Pastikan Library dan Publishing Scheduler tetap berfungsi.
- Jangan melakukan polling SSH loop.
- Tandai Tahap 8 selesai.

### Tahap 9 — Dokumentasi dan Final Review

- Perbarui implementation plan bila ada keputusan implementasi yang berbeda dan jelaskan alasannya.
- Pastikan seluruh acceptance criteria terpenuhi.
- Pastikan checkbox diperbarui real-time.
- Pastikan tidak ada TODO kritis atau mock data tersisa.
- Tandai Tahap 9 selesai.

### Tahap 10 — Release dan Git Sync

Setelah semua test dan verifikasi berhasil, jalankan:

```bash
npm run release-non-interactive -- --type patch --title "Content Flow Analytics Reporting" --points "Menambahkan dashboard statistik produksi dan publikasi Content Flow|Menambahkan reporting tenant-aware per brand dan platform|Menambahkan filter waktu grafik anomali data dan export CSV"
```

Kemudian verifikasi:

```text
- versi package sesuai changelog terbaru
- changelog telah diperbarui
- commit release terbentuk
- tag vX.Y.Z terbentuk dan ter-push
- branch main ter-push
- remote adalah https://github.com/sabeq83/maknaflow.git
```

Tandai Tahap 10 selesai hanya setelah release dan push benar-benar berhasil.

## Guardrail Definisi Metrik

Jangan mengubah definisi berikut tanpa persetujuan pengguna:

```text
Total Aset             = video_id unik dalam scope
Published Any          = minimal satu platform berstatus Published
Never Published        = tidak ada platform berstatus Published
Ready Unpublished      = pipeline Completed dan belum Published di platform mana pun
Fully Distributed      = TikTok + Facebook + Instagram berstatus Published
Platform Posts         = jumlah Published pada platform masing-masing
```

YouTube tetap tampil sebagai platform tetapi belum menjadi syarat Fully Distributed pada MVP.

## Kondisi Berhenti dan Eskalasi

Hentikan eksekusi dan minta keputusan pengguna bila:

- Ditemukan kebutuhan mengubah data existing secara destruktif.
- Definisi “aset tersedia” harus berbeda dari scope Content Library (`nextcloud_url`).
- Diperlukan deployment production.
- Diperlukan perubahan platform target Fully Distributed.
- Ada perubahan schema database yang tidak dapat dilakukan backward-compatible.
- Worktree user memiliki perubahan yang bertabrakan langsung dengan file target.

Jangan berhenti hanya karena implementasi sulit. Lakukan diagnosis dan alternatif aman terlebih dahulu.

## Definition of Done

Pekerjaan selesai hanya jika:

1. Seluruh acceptance criteria pada implementation plan terpenuhi.
2. Seluruh checkbox `Execution Task List` sudah `[x]` berdasarkan bukti nyata.
3. Test reporting lulus.
4. Test Publishing Scheduler existing lulus.
5. Build staging lulus.
6. Manual staging verification selesai.
7. Tenant dan assigned-brand isolation terbukti.
8. Release patch, changelog, commit, tag, dan push berhasil.
9. Tidak ada deployment production tanpa perintah eksplisit.
