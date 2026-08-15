# Implementation Plan — Content Flow Analytics & Reporting

## 1. Ringkasan

Menambahkan view ketiga **Analytics & Reporting** pada halaman Content Flow untuk memantau jumlah aset video, progres produksi, publikasi per platform, backlog distribusi, tren waktu, dan ringkasan per brand.

Implementasi mengikuti arsitektur riil MAKNA Flow:

- Next.js `16.2.5` App Router.
- PostgreSQL melalui `lib/db-pg.js`.
- Tenant aktif melalui `withTenantContext()` dan `getActiveTenantId()`.
- Pembatasan brand non-admin melalui `user.assignedBrandNames`.
- UI Content Flow tetap berupa Client Component karena menggunakan filter dan interaksi browser.
- Data reporting dihitung server-side; browser tidak menerima data lintas tenant atau data brand yang tidak diizinkan.

## 2. Tujuan Produk

Halaman harus menjawab:

1. Berapa total aset video unik dalam rentang waktu?
2. Berapa aset yang selesai dan masih dalam produksi?
3. Berapa aset yang sudah tayang minimal pada satu platform?
4. Berapa aset yang belum pernah tayang?
5. Berapa aset yang sudah terdistribusi lengkap pada TikTok, Facebook, dan Instagram?
6. Berapa publikasi TikTok, Facebook, Instagram, dan YouTube per brand?
7. Brand mana yang memiliki backlog distribusi terbesar?
8. Bagaimana tren produksi dan publikasi sepanjang periode?

## 3. Ruang Lingkup MVP

### Termasuk

- Tab `Analytics & Reporting` di `/content-flow?view=analytics`.
- Filter rentang waktu: 7 hari, 30 hari, bulan ini, bulan lalu, semua data, dan custom.
- Dimensi tanggal: `production` atau `publish`.
- Filter brand dan status produksi.
- KPI:
  - Total aset video.
  - Produksi selesai.
  - Masih produksi.
  - Sudah tayang minimal satu platform.
  - Belum pernah tayang.
  - Distribusi lengkap TikTok + Facebook + Instagram.
- Tren produksi dan publikasi.
- Jumlah Published per platform.
- Ringkasan per brand.
- Indikator anomali status/tanggal publish.
- Export CSV dari breakdown brand yang sedang difilter.
- Loading, empty, error, dan responsive state.
- Tenant isolation dan assigned-brand scoping.

### Tidak termasuk dalam MVP

- Mengubah status publikasi.
- Sinkronisasi data platform eksternal.
- Migrasi kolom tanggal publish dari `TEXT` ke `TIMESTAMPTZ`.
- Scheduled email report.
- Perbandingan antar-tenant.
- Konfigurasi platform target per brand.
- Materialized view atau cache Redis.

## 4. Sumber Data

Tabel utama: `content_flow_items`.

Kolom yang digunakan:

| Kebutuhan | Kolom |
|---|---|
| Tenant | `tenant_id` |
| Brand | `account_name` |
| Identitas aset | `video_id` |
| Tanggal produksi | `production_date`, fallback `created_at` |
| Status produksi | `pipeline_status` |
| TikTok | `tiktok_status`, `tiktok_publish_date`, `permalink_tiktok` |
| Facebook | `facebook_status`, `facebook_publish_date`, `permalink_facebook` |
| Instagram | `instagram_status`, `instagram_publish_date`, `permalink_instagram` |
| YouTube | `youtube_status`, `youtube_publish_date`, `permalink_youtube` |
| Aset tersedia | `nextcloud_url` |

MVP mengikuti scope Content Library existing: hanya record dengan `nextcloud_url` tidak kosong. Ini menjaga angka Analytics konsisten dengan aset yang benar-benar terlihat pada Content Flow.

## 5. Definisi Metrik Kanonikal

Semua perbandingan status harus case-insensitive dan menganggap `NULL` sebagai bukan Published.

```text
is_tiktok_published   = LOWER(COALESCE(tiktok_status, '')) = 'published'
is_facebook_published = LOWER(COALESCE(facebook_status, '')) = 'published'
is_instagram_published= LOWER(COALESCE(instagram_status, '')) = 'published'
is_youtube_published  = LOWER(COALESCE(youtube_status, '')) = 'published'
```

| Metrik | Definisi |
|---|---|
| `total_assets` | `COUNT(DISTINCT video_id)` dalam scope |
| `completed_assets` | aset dengan `pipeline_status = Completed` |
| `in_production_assets` | aset dengan `pipeline_status = In Production` |
| `published_any_assets` | Published pada minimal satu platform |
| `never_published_assets` | tidak Published pada platform mana pun |
| `fully_distributed_assets` | Published pada TikTok, Facebook, dan Instagram; YouTube belum menjadi target wajib |
| `ready_unpublished_assets` | Completed tetapi belum Published di platform mana pun |
| `platform_posts` | jumlah aset berstatus Published pada platform bersangkutan |
| `coverage_percent` | `published_any_assets / total_assets * 100` |

`Published Assets` berbeda dari `Platform Posts`: satu video yang tayang di tiga platform dihitung satu Published Asset dan tiga Platform Posts.

## 6. Semantik Rentang Waktu

Parameter API:

```text
date_dimension=production|publish
date_from=YYYY-MM-DD
date_to=YYYY-MM-DD
timezone=Asia/Jakarta
```

Aturan:

- Batas waktu menggunakan interval `[date_from 00:00, date_to + 1 hari 00:00)` dalam zona `Asia/Jakarta`.
- `production`: scope aset memakai `COALESCE(production_date, created_at)`.
- `publish`: sebuah aset masuk scope jika minimal satu tanggal publish valid berada dalam periode.
- Saat `publish`, hitungan platform hanya menghitung platform yang tanggal publish-nya berada dalam periode, bukan semua status historis aset tersebut.
- Tanggal publish yang kosong atau tidak valid tidak boleh menyebabkan query gagal.
- Nilai `date_from` dan `date_to` wajib divalidasi di route sebelum diteruskan ke repository.
- Maksimum custom range MVP: 366 hari.

Karena kolom `*_publish_date` masih `TEXT`, repository harus memakai ekspresi konversi aman. Jangan melakukan cast langsung terhadap seluruh kolom.

## 7. Kontrak API

### Endpoint

```http
GET /api/content-flow/reporting
```

Query parameters:

```text
range=7d|30d|this_month|last_month|all|custom
date_dimension=production|publish
date_from=YYYY-MM-DD
date_to=YYYY-MM-DD
account=all|<brand>
pipeline_status=all|Completed|In Production
```

Response:

```json
{
  "success": true,
  "filters": {
    "date_dimension": "production",
    "date_from": "2026-07-25",
    "date_to": "2026-08-14",
    "account": "all",
    "pipeline_status": "all",
    "timezone": "Asia/Jakarta"
  },
  "summary": {
    "total_assets": 1223,
    "completed_assets": 531,
    "in_production_assets": 692,
    "published_any_assets": 394,
    "never_published_assets": 829,
    "ready_unpublished_assets": 137,
    "fully_distributed_assets": 248
  },
  "platforms": {
    "tiktok": 260,
    "facebook": 394,
    "instagram": 251,
    "youtube": 0
  },
  "timeline": [
    { "period": "2026-08-14", "produced": 66, "published": 54 }
  ],
  "brands": [
    {
      "brand": "nutribake",
      "total_assets": 445,
      "published_any_assets": 143,
      "never_published_assets": 302,
      "tiktok": 142,
      "facebook": 143,
      "instagram": 131,
      "youtube": 0,
      "coverage_percent": 32.13
    }
  ],
  "anomalies": {
    "published_without_date": 0,
    "date_without_published_status": 3,
    "invalid_publish_date": 0,
    "total": 3
  },
  "available_accounts": ["nutribake", "dapurbotani"]
}
```

Semua angka dikirim sebagai number, bukan string PostgreSQL.

## 8. Keamanan dan Isolasi Data

1. Route wajib dibungkus `withTenantContext`.
2. Repository wajib memulai parameter dengan `operationalTenant()`.
3. Non-admin hanya boleh melihat `assignedBrandNames`.
4. Jika user tidak memiliki assigned brand, query harus menghasilkan scope kosong (`FALSE`), bukan membuka semua data.
5. `account` yang diminta non-admin harus berada dalam assigned brand. Pilihan di luar scope harus menghasilkan `403` atau hasil kosong secara konsisten; rekomendasi: `403` agar salah konfigurasi terlihat.
6. Tidak boleh menerima nama kolom, sort expression, atau SQL fragment dari query string.
7. Tanggal, enum, dan panjang range harus divalidasi sebelum query.
8. CSV dibuat dari response yang sudah tenant-scoped; jangan menambahkan endpoint export yang melewati repository guard.

## 9. Desain UI

View mengikuti mockup yang telah disetujui:

1. Tab:
   - Content Library
   - Publishing Scheduler
   - Analytics & Reporting
2. Filter bar.
3. Enam KPI cards.
4. Grafik Produksi vs Publikasi.
5. Grafik/daftar Publikasi per Platform.
6. Tabel Ringkasan Brand.
7. Banner anomali data.

Gunakan token tema existing dari `app/theme.css`/`app/globals.css`; jangan menambahkan warna global baru bila token yang sesuai sudah tersedia.

Grafik MVP dibuat dengan SVG/CSS internal React tanpa dependency chart tambahan. Berikan `<title>`, label, legenda, dan nilai tekstual agar tetap dapat dipahami tanpa warna.

## 10. Perubahan File dan Before/After Snippets

### 10.1 `lib/contentflow-reporting.js` — file baru

#### Code Sebelum (Current/Before)

```js
// File belum ada.
```

#### Code Sesudah (Proposed/After)

```js
import { pgQuery } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';

export const REPORTING_DATE_DIMENSIONS = new Set(['production', 'publish']);
export const REPORTING_PIPELINE_STATUSES = new Set(['all', 'Completed', 'In Production']);

export async function getContentFlowReporting({
  dateDimension,
  dateFrom,
  dateToExclusive,
  accountName,
  pipelineStatus,
  allowedAccounts
}) {
  const tenantId = getActiveTenantId();
  if (!tenantId || tenantId === '__none__') {
    const error = new Error('Tenant operasional tidak tersedia.');
    error.status = 403;
    throw error;
  }

  // Bangun satu normalized CTE tenant-aware, parameterized, dan aman
  // terhadap nilai tanggal publish TEXT yang invalid. Gunakan CTE tersebut
  // untuk summary, platforms, timeline, brands, anomalies, dan facets.
  return { summary, platforms, timeline, brands, anomalies, available_accounts };
}
```

Catatan implementasi:

- Ekstrak builder scope agar seluruh subquery memakai WHERE yang identik.
- Gunakan `COUNT(DISTINCT video_id)` untuk metrik aset.
- Hindari `SELECT *`.
- Gunakan query agregasi terbatas; jangan melakukan N+1 per brand.
- Timeline memakai bucket harian untuk rentang sampai 45 hari, mingguan sampai 180 hari, dan bulanan di atasnya.
- Pertimbangkan menjalankan summary/platform/brand/anomaly secara paralel setelah normalized SQL dan params disiapkan.

### 10.2 `app/api/content-flow/reporting/route.js` — file baru

#### Code Sebelum (Current/Before)

```js
// File belum ada.
```

#### Code Sesudah (Proposed/After)

```js
import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getContentFlowReporting } from '@/lib/contentflow-reporting';

export const GET = withTenantContext(async (request, _context, user) => {
  try {
    const filters = parseAndValidateReportingFilters(new URL(request.url).searchParams);
    const allowedAccounts = user.role === 'admin' || user.role === 'superadmin'
      ? undefined
      : user.assignedBrandNames;

    const result = await getContentFlowReporting({ ...filters, allowedAccounts });
    return NextResponse.json({ success: true, filters, ...result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status || 500 }
    );
  }
});
```

Catatan implementasi:

- Parser tanggal diletakkan pada module repository/helper yang dapat diuji tanpa Next runtime.
- Jangan meng-cache lintas user/tenant.
- Gunakan response `400` untuk parameter invalid, `403` untuk scope yang tidak diizinkan.

### 10.3 `app/content-flow/ContentFlowAnalytics.js` — file baru

#### Code Sebelum (Current/Before)

```js
// File belum ada.
```

#### Code Sesudah (Proposed/After)

```js
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export default function ContentFlowAnalytics({ accountQuery = 'all' }) {
  const [filters, setFilters] = useState(createInitialFilters(accountQuery));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReport = useCallback(async (signal) => {
    const response = await fetch(`/api/content-flow/reporting?${buildQuery(filters)}`, { signal });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Gagal memuat reporting.');
    setReport(payload);
  }, [filters]);

  useEffect(() => {
    const controller = new AbortController();
    loadReport(controller.signal).finally(() => setLoading(false));
    return () => controller.abort();
  }, [loadReport]);

  return <section aria-label="Content Flow Analytics">{/* filter, KPI, chart, table */}</section>;
}
```

Catatan implementasi:

- Debounce tidak diperlukan karena filter memakai select/date dan request dapat dijalankan saat tombol Terapkan ditekan.
- Batalkan request lama dengan `AbortController`.
- Export CSV harus menangani escaping quote, comma, dan newline.
- Tampilkan skeleton tanpa layout shift.
- Empty state tidak boleh terlihat sebagai error.
- Tabel memiliki horizontal scroll pada viewport kecil.

### 10.4 `app/content-flow/page.js` — dimodifikasi

#### Code Sebelum (Current/Before)

```js
import PublishingScheduler from './PublishingScheduler';

const initialView = searchParams.get('view') === 'publishing' ? 'publishing' : 'library';

{mainView === 'publishing' ? (
  <PublishingScheduler
    initialPreloadItem={schedulePreloadItem}
    onBackToLibrary={() => { setMainView('library'); setSchedulePreloadItem(null); }}
  />
) : (
  <>{/* Content Library */}</>
)}
```

#### Code Sesudah (Proposed/After)

```js
import PublishingScheduler from './PublishingScheduler';
import ContentFlowAnalytics from './ContentFlowAnalytics';

const requestedView = searchParams.get('view');
const initialView = ['library', 'publishing', 'analytics'].includes(requestedView)
  ? requestedView
  : 'library';

// Tambahkan tombol ketiga pada contentflow-view-tabs:
<button onClick={() => setMainView('analytics')}>
  <span>⌁ Analytics & Reporting</span>
</button>

{mainView === 'publishing' ? (
  <PublishingScheduler
    initialPreloadItem={schedulePreloadItem}
    onBackToLibrary={() => { setMainView('library'); setSchedulePreloadItem(null); }}
  />
) : mainView === 'analytics' ? (
  <ContentFlowAnalytics accountQuery={accountQuery} />
) : (
  <>{/* Content Library existing tidak diubah */}</>
)}
```

Catatan implementasi:

- Sinkronkan perubahan tab ke URL melalui `router.replace()` agar refresh/back-forward mempertahankan view dan account.
- Jangan memuat endpoint Library saat view Analytics aktif bila datanya tidak dipakai.
- Jangan mengubah workflow Scheduler dan modal Library.

### 10.5 `tests/contentflow-reporting.test.js` — file baru

#### Code Sebelum (Current/Before)

```js
// File belum ada.
```

#### Code Sesudah (Proposed/After)

```js
import test from 'node:test';
import assert from 'node:assert/strict';

test('reporting filter rejects an invalid date range', () => {
  assert.throws(() => parseReportingFilters(/* invalid range */));
});

test('published asset and platform post use different definitions', () => {
  // Satu video published di tiga kanal = 1 published asset, 3 platform posts.
});

test('assigned brand scope cannot read another brand', async () => {
  // Verifikasi WHERE account scope tetap diterapkan bersama tenant_id.
});

test('invalid text publish date does not fail aggregation', async () => {
  // Nilai legacy invalid masuk anomaly, bukan exception.
});
```

Test minimum:

- Tenant isolation.
- Empty assigned brands.
- Admin all-brand scope.
- Brand case normalization.
- Invalid enum dan tanggal.
- Custom range lebih dari 366 hari.
- Production-date boundary.
- Publish-date boundary dan timezone Asia/Jakarta.
- Published-any, never-published, ready-unpublished, fully-distributed.
- Platform counts.
- Timeline bucketing.
- Anomaly counts.
- Numeric response types.
- Empty dataset.

## 11. Strategi Query

Gunakan normalized CTE, secara konseptual:

```sql
WITH normalized AS (
  SELECT
    tenant_id,
    video_id,
    LOWER(account_name) AS brand,
    pipeline_status,
    COALESCE(production_date, created_at) AS produced_at,
    LOWER(COALESCE(tiktok_status, '')) = 'published' AS tiktok_published,
    LOWER(COALESCE(facebook_status, '')) = 'published' AS facebook_published,
    LOWER(COALESCE(instagram_status, '')) = 'published' AS instagram_published,
    LOWER(COALESCE(youtube_status, '')) = 'published' AS youtube_published,
    /* safe parsed publish timestamps */
    tiktok_published_at,
    facebook_published_at,
    instagram_published_at,
    youtube_published_at
  FROM content_flow_items
  WHERE tenant_id = $1
    AND nextcloud_url IS NOT NULL
    AND nextcloud_url <> ''
    /* assigned brand + selected filters */
), scoped AS (
  SELECT * FROM normalized
  WHERE /* date_dimension-specific period */
)
SELECT /* aggregate */ FROM scoped;
```

Jangan memakai interpolasi string untuk nilai filter. Interpolasi hanya boleh digunakan untuk fragment SQL yang dipilih dari allowlist internal, misalnya bucket `day/week/month`.

## 12. Index dan Performa

Gunakan index existing terlebih dahulu:

```text
content_flow_items_tenant_created_idx
content_flow_items_tenant_video_uq
```

Target awal:

- Response p95 di staging di bawah 800 ms untuk satu tenant.
- Maksimum enam query agregasi per request.
- Tidak ada query per brand.
- Payload normal di bawah 150 KB.

Jangan membuat index baru sebelum `EXPLAIN (ANALYZE, BUFFERS)` menunjukkan kebutuhan. Jika dibutuhkan, rencanakan migration terpisah dan aman untuk:

```sql
(tenant_id, production_date)
(tenant_id, LOWER(account_name), production_date)
```

## 13. Verifikasi

### Automated

```bash
node --test tests/contentflow-reporting.test.js
npm run test:publishing-scheduler
npm run staging:build
```

### Manual staging

1. Login sebagai admin dan user brand-scoped.
2. Buka `/content-flow?view=analytics`.
3. Bandingkan summary dengan query PostgreSQL tenant yang sama.
4. Uji semua preset tanggal dan custom range.
5. Uji `production` dan `publish` date dimension.
6. Uji brand filter dari query URL sidebar.
7. Pastikan user satu brand tidak melihat facet atau data brand lain.
8. Uji desktop, tablet, dan mobile.
9. Uji CSV pada nilai brand dengan comma/quote.
10. Pastikan tab Library dan Publishing Scheduler tidak regresi.

### Data baseline staging saat perencanaan

Baseline seluruh tenant pada 15 Agustus 2026 hanya untuk sanity check, bukan expected value test permanen:

```text
Total video_id unik       1.223
Completed                   531
In Production               692
Published minimal 1 kanal   394
Belum pernah Published      829
TikTok Published            260
Facebook Published          394
Instagram Published         251
YouTube Published             0
```

## 14. Acceptance Criteria

- Analytics tampil sebagai tab ketiga Content Flow dan URL dapat dibagikan.
- Semua data tenant-aware dan assigned-brand-aware.
- Filter tanggal menghasilkan batas periode yang konsisten di Asia/Jakarta.
- Total aset memakai `video_id` unik.
- Published-any tidak menjumlahkan platform.
- Platform posts dihitung per platform.
- Ready-unpublished hanya menghitung aset Completed yang belum tayang.
- Publish-date invalid tidak menjatuhkan endpoint.
- Grafik dan tabel memiliki nilai tekstual serta responsive.
- CSV sama dengan breakdown brand pada filter aktif.
- Empty/error/loading state tersedia.
- Test baru, test scheduler existing, dan build lulus.
- Release patch, changelog, tag, branch `main`, dan push remote berhasil sesuai SOP repository.

## 15. Risiko dan Mitigasi

| Risiko | Mitigasi |
|---|---|
| Kolom publish date berupa TEXT | Safe parser dan anomaly count; migrasi tipe ditunda |
| Angka lintas tab berbeda | Analytics mengikuti scope `nextcloud_url` Content Library dan definisi terdokumentasi |
| Kebocoran data brand | Scope tenant dan assigned brands dibangun di repository, bukan UI |
| Query agregasi lambat | Single-pass CTE, tanpa N+1, ukur dengan EXPLAIN sebelum index |
| Published tetapi tanggal kosong | Status tetap menentukan historical published; anomaly ditampilkan |
| Refresh mengembalikan tab Library | Sinkronkan `view=analytics` ke URL |
| Double fetch pada pergantian filter | Apply button + AbortController |

## Execution Task List

- [x] Tahap 1 — Audit ulang schema staging, sample nilai status/tanggal, tenant scope, dan baseline per tenant sebelum menyentuh kode.
- [x] Tahap 2 — Implementasikan parser/validator filter dan repository `lib/contentflow-reporting.js` dengan normalized CTE serta parameterized query.
- [x] Tahap 3 — Tambahkan endpoint tenant-aware `app/api/content-flow/reporting/route.js` dengan assigned-brand scoping.
- [x] Tahap 4 — Tambahkan komponen `app/content-flow/ContentFlowAnalytics.js` sesuai mockup: filter, KPI, timeline, platform, tabel brand, anomaly, loading/error/empty, CSV, responsive.
- [x] Tahap 5 — Integrasikan tab Analytics dan sinkronisasi URL pada `app/content-flow/page.js` tanpa regresi Library/Scheduler.
- [x] Tahap 6 — Tambahkan `tests/contentflow-reporting.test.js` untuk definisi metrik, filter, tanggal, anomaly, dan isolasi tenant/brand.
- [x] Tahap 7 — Jalankan test reporting, test Publishing Scheduler, dan build staging; perbaiki seluruh kegagalan.
- [x] Tahap 8 — Jalankan verifikasi manual pada staging dan cocokkan hasil dengan query PostgreSQL tenant yang sama.
- [x] Tahap 9 — Perbarui dokumentasi bila implementasi menyimpang secara sah dari rencana, lalu tandai seluruh checklist selesai secara real-time.
- [x] Tahap 10 — Jalankan release patch non-interaktif, verifikasi changelog, commit, tag, branch `main`, dan push ke `https://github.com/sabeq83/maknaflow.git`.

## 16. Perintah Rilis Wajib Setelah Verifikasi

```bash
npm run release-non-interactive -- --type patch --title "Content Flow Analytics Reporting" --points "Menambahkan dashboard statistik produksi dan publikasi Content Flow|Menambahkan reporting tenant-aware per brand dan platform|Menambahkan filter waktu grafik anomali data dan export CSV"
```

Deployment production tidak termasuk dalam rencana ini dan tidak boleh dilakukan tanpa perintah eksplisit pengguna.
