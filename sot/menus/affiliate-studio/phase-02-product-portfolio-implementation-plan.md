# Implementation Plan — Affiliate Studio Fase 2: Brand Product Portfolio Projection

> Status: Planned  
> Parent roadmap: `sot/menus/affiliate-studio-roadmap.md`  
> Dependency: Fase 0 Foundation dan Fase 1 Brand Shell sudah dirilis (`v2.23.20` dan `v2.24.0` pada saat plan ini disusun).  
> Mandat: **additive-only, read-only, no duplicate catalog**. Fase ini menyambungkan Product Database existing ke Brand Profile aktif melalui projection baru.

## 1. Objective

Menambahkan view **Products** di dalam Affiliate Studio yang memperlihatkan portfolio produk untuk Brand Profile aktif, termasuk produk linked, unlinked candidate, link source, association state, dan readiness—tanpa membuat database produk kedua dan tanpa mengambil alih fungsi pengelolaan Product Database.

```text
Affiliate Studio Brand Context
    ↓
Products View
    ↓
Read-only Brand Product Projection API
    ├── product_extractions (product truth/source)
    ├── brand_products (brand association/override)
    └── resolveAffiliateLink (resolved link authority)
```

## 2. Current-State Baseline

Fase 2 harus dibangun di atas implementasi aktual berikut:

- `/affiliate-studio?brand=<id>` sudah menjadi canonical Brand context.
- `AffiliateStudioWorkspace` sudah memuat authorized brands dan Overview.
- `AffiliateStudioShell` sudah memiliki tab Products disabled.
- `getAuthorizedAffiliateBrand` sudah menerapkan tenant dan assigned-brand isolation.
- Fase 1 overview sudah menghitung summary `brand_products`.
- Product Database tetap tersedia pada `/products`.
- Existing `brand_products` menyimpan affiliate link, tracking code, landing page, name override, CTA override, notes, dan active state.
- Existing `resolveAffiliateLink` menetapkan precedence: campaign override → brand-product → legacy product → missing.

Agent tidak boleh mengulang atau mengganti baseline tersebut.

## 3. Scope

### 3.1 In scope

- Aktifkan tab Products pada local navigation Affiliate Studio.
- Tambahkan URL view contract `?brand=<id>&view=products` dengan Overview tetap default/backward-compatible.
- Tambahkan read-only Brand Product Portfolio component.
- Tambahkan GET-only portfolio projection API.
- Tambahkan server-only brand-product read adapter baru.
- Tambahkan pure readiness evaluator.
- Tampilkan linked dan unlinked product candidate dari tenant catalog.
- Tampilkan association state: `candidate`, `active`, `inactive`.
- Tampilkan affiliate resolution source: `brand_product`, `legacy_product`, `missing`.
- Tampilkan tracking code dan CTA override dari association existing.
- Tampilkan safe product-truth summary, image readiness, link readiness, association readiness, dan overall readiness.
- Tambahkan search, association filter, readiness filter, category filter, dan pagination/cursor yang bounded.
- Tampilkan summary/facets berdasarkan filter scope yang benar.
- Tambahkan generic deep link ke Product Database existing.
- Tambahkan tests untuk tenant/brand isolation, resolver parity, readiness, filtering, pagination, image paths, GET-only boundary, dan no-write guarantee.

### 3.2 Out of scope

- Create/edit/delete produk.
- Link/unlink/update Brand–Product association.
- Edit affiliate link, tracking code, landing page, CTA override, atau notes.
- Scrape/re-enrich/regenerate/upload foto.
- Product detail drawer dengan mutation controls.
- Mengubah affiliate resolver precedence.
- Mengubah `brand_products` atau `product_extractions` schema.
- Mengubah Product Database UI/API/repository.
- Mengubah campaign product binding.
- Campaign Program dan Planner connection.
- Production launch dan publishing.
- Tabel `affiliate_*`.
- Staging/Production deployment.

## 4. Non-Negotiable Data Ownership

| Data | Source of truth | Fase 2 behavior |
|---|---|---|
| Product identity/truth | `product_extractions` | Read-only projection |
| Brand association | `brand_products` | Read-only projection |
| Resolved affiliate link | `resolveAffiliateLink` | Call existing resolver; do not duplicate precedence |
| Product image file | Existing Product Database image pipeline | Render existing safe URL/proxy only |
| Product mutation | Product Database | Generic deep link only |
| Association mutation | Existing Brand–Product API/Product Database | No mutation from Affiliate Studio |
| Campaign snapshot | `campaign_product_bindings` | Not used or changed in Fase 2 |

## 5. URL and Navigation Contract

### 5.1 Canonical URLs

```text
/affiliate-studio?brand=<brand_id>
/affiliate-studio?brand=<brand_id>&view=overview
/affiliate-studio?brand=<brand_id>&view=products
```

- Missing `view` remains Overview for backward compatibility.
- Unknown `view` canonicalizes to Overview.
- Changing brand preserves supported active view.
- Product filters live in URL:

```text
&q=<search>
&association=all|candidate|active|inactive
&readiness=all|ready|needs_review|incomplete
&category=<category>
&cursor=<opaque_cursor>
```

- Changing search/filter resets cursor.
- Overview ignores/removes product-only filters when canonicalized.

### 5.2 Local navigation Fase 2

| Item | State |
|---|---|
| Overview | Enabled |
| Products | Enabled |
| Campaigns | Disabled / Later |
| Planner | Disabled / Later |
| Production | Disabled / Later |
| Publishing | Disabled / Later |
| Performance | Disabled / Later |

Aktivasi Products harus berupa extension kecil pada Shell existing; jangan refactor seluruh shell/navigation.

## 6. Product Projection Contract

### 6.1 Endpoint

`GET /api/v2/affiliate-studio/brands/:id/products`

Supported query:

```text
q
association
readiness
category
cursor
limit (default 24, max 100)
```

### 6.2 Response

```json
{
  "success": true,
  "data": {
    "brand": {
      "id": "brand_id",
      "name": "Siasat Sehat"
    },
    "items": [
      {
        "productId": "product_id",
        "brandProductId": "brand_product_id",
        "displayName": "Brand Override or Product Name",
        "productName": "Original Product Name",
        "category": "Foods",
        "description": "bounded description",
        "uniqueSellingPoint": "bounded USP",
        "targetAudience": "bounded audience",
        "sourceUrl": "https://...",
        "imageUrl": "/api/v2/products/image?path=...",
        "association": {
          "state": "active",
          "isLinked": true,
          "isActive": true
        },
        "affiliate": {
          "link": "https://...",
          "source": "brand_product",
          "status": "resolved",
          "trackingCode": "...",
          "landingPageUrl": "...",
          "ctaOverride": "..."
        },
        "readiness": {
          "overall": "ready",
          "productTruth": "ready",
          "image": "ready",
          "affiliateLink": "ready",
          "association": "ready",
          "reasons": []
        },
        "links": {
          "productDatabase": "/products"
        }
      }
    ],
    "facets": {
      "association": {},
      "readiness": {},
      "categories": []
    },
    "pagination": {
      "limit": 24,
      "nextCursor": null,
      "hasMore": false
    },
    "generatedAt": "2026-08-23T00:00:00.000Z"
  }
}
```

### 6.3 Field safety

API tidak mengembalikan:

- raw AI response;
- full `product_truth`/`geometric_truth` blobs;
- raw descriptions tanpa batas;
- local absolute filesystem paths;
- API keys/tokens;
- association notes bila belum ada use case UI yang disetujui.

Text display fields harus dibatasi panjangnya pada projection layer.

## 7. Association Semantics

```text
candidate
  brand_product_id is null

active
  brand_product_id exists AND is_active = true

inactive
  brand_product_id exists AND is_active = false
```

Important:

- `candidate` bukan association dan tidak boleh ditulis otomatis.
- Fase 2 menampilkan seluruh tenant product catalog hanya jika user memang authorized ke Brand Profile aktif.
- Unlinked candidate tidak berarti produk direkomendasikan AI.
- Inactive association tetap ditampilkan ketika filter memungkinkan; jangan menyembunyikan histori association.

## 8. Affiliate Resolution Semantics

Untuk setiap item, gunakan existing `resolveAffiliateLink` dengan:

```js
{
  tenantId: user.tenantId,
  brandProfileId: brandId,
  productId,
  allowLegacyFallback: true
}
```

Fase 2 tidak mempunyai campaign override, sehingga source valid:

```text
brand_product
legacy_product
missing
```

Rules:

- Jangan membaca `brand_products.affiliate_link` lalu mengklaimnya sebagai resolved output tanpa resolver.
- `legacy_product` harus tampil sebagai warning/needs-review, bukan disamarkan sebagai brand-specific link.
- `missing` tidak boleh menghasilkan placeholder URL.
- Invalid stored URL ditampilkan sebagai incomplete/invalid warning; jangan membuat URL dapat diklik.
- Resolution failure satu item menghasilkan item-level warning; list tidak boleh seluruhnya gagal bila aman untuk melanjutkan.

Untuk menghindari N+1 tanpa mengubah resolver, adapter menggunakan bounded page size dan bounded concurrency. Optimasi bulk resolver baru berada di luar Fase 2 karena akan merevisi shared resolver.

## 9. Readiness Contract

### 9.1 Dimensions

```text
productTruth: ready | incomplete
image: ready | incomplete
affiliateLink: ready | needs_review | incomplete
association: ready | needs_review | incomplete
overall: ready | needs_review | incomplete
```

### 9.2 Deterministic rules

Product truth ready jika minimal tersedia:

- product name;
- meaningful description atau structured product truth;
- USP;
- target audience.

Image ready jika terdapat safe active/raw/cleaned/clean photo reference yang dapat diproyeksikan.

Affiliate link:

- `brand_product + valid URL` → ready;
- `legacy_product + valid URL` → needs_review;
- missing/invalid → incomplete.

Association:

- active → ready;
- inactive → needs_review;
- candidate → incomplete.

Overall:

1. Satu dimensi incomplete → `incomplete`.
2. Tidak incomplete tetapi satu dimensi needs_review → `needs_review`.
3. Semua ready → `ready`.

Evaluator readiness harus pure, deterministic, dan tidak menulis data.

## 10. Image Projection Rules

Selection precedence untuk display hanya:

```text
active_photo referenced value
→ cleaned_photo_url / clean_photo_url
→ raw_photo_url
→ photo_url
→ null
```

- Local relative path dibungkus menggunakan existing `/api/v2/products/image?path=` contract.
- HTTP(S) URL dipertahankan jika source existing memang external.
- Absolute filesystem path tidak pernah dikirim ke client.
- Missing image memakai existing `/placeholder-product.png` pada UI, tetapi readiness tetap incomplete.
- Fase 2 tidak memanggil upload, regenerate, or photo worker.

## 11. Product Database Deep-Link Limitation

Product Database saat ini belum mempunyai stable public route `/products/:id` atau query contract yang membuka editor berdasarkan ID.

Karena prinsip no-revision:

- Fase 2 menyediakan link jelas **Open Product Database** ke `/products`.
- Card menampilkan/copy Product ID untuk membantu pencarian manual.
- Jangan membuat `?productId=` atau hash palsu yang tidak dibaca Product Database.
- Direct detail/edit deep link ditunda sampai Product Database menyediakan contract resmi pada roadmap terpisah.

Ini adalah keterbatasan yang sengaja truthful, bukan alasan mengubah Product Database dalam Fase 2.

## 12. Execution Task List

- [ ] Verify Fase 0 and Fase 1 actual code, tests, changelog, release commits, tags, branch, and remote sync before editing.
- [ ] Re-read `AGENTS.md`, roadmap, this plan, actual Fase 1 workspace/shell/adapter, local Next.js docs, theme tokens, Product Database contracts, Brand–Product repository, and affiliate resolver.
- [ ] Audit working tree and preserve pre-existing changes, especially any modified test or user-owned file.
- [ ] Implement pure Fase 2 URL/view/filter state helpers while preserving Fase 1 Brand URL compatibility.
- [ ] Implement pure product readiness and safe image projection helpers.
- [ ] Implement the tenant- and assigned-brand-safe server-only Brand Product read adapter with bounded filtering/pagination and resolver parity.
- [ ] Implement GET-only Brand Product Portfolio API using `withAffiliateStudioAccess('read')`.
- [ ] Extend Affiliate Studio Shell minimally to enable Products and display active view in breadcrumb/navigation.
- [ ] Extend Affiliate Studio Workspace minimally to load product data only when Products view is active.
- [ ] Implement the read-only Brand Product Portfolio UI with search, filters, facets, readiness, pagination, loading, empty, partial-item, and error states.
- [ ] Append Fase 2 CSS classes to existing scoped CSS Module without rewriting Fase 1 classes or `app/theme.css`.
- [ ] Add readiness, URL state, adapter isolation, resolver parity, filter, pagination, image safety, API GET-only, no-write, and forbidden-import tests.
- [ ] Run focused Fase 2 tests plus complete Fase 0/Fase 1 regressions.
- [ ] Run existing product catalog/affiliate routing tests, RBAC smoke, `git diff --check`, and production build.
- [ ] Audit changed paths against Explicit No-Change List and confirm no Product Database, resolver, campaign binding, schema, worker, scheduler, or prompt was revised.
- [ ] Update every checkbox immediately after verification evidence is obtained.
- [ ] Deploy only Mac Mini Dev if browser/API smoke is required; do not poll SSH repeatedly.
- [ ] Execute release SOP after every gate passes and verify version, changelog, commit, tag, branch, and remote push without unrelated changes.

## 13. Planned File Changes

### 13.1 `lib/affiliate-studio-workspace-state.js` — minimal additive extension

**Code Sebelum (Current/Before)**

```js
export function buildAffiliateStudioUrl(brandId) {
  if (!brandId) return '/affiliate-studio';
  return `/affiliate-studio?brand=${encodeURIComponent(brandId)}`;
}
```

**Code Sesudah (Proposed/After)**

```js
export const AFFILIATE_STUDIO_VIEWS = Object.freeze(['overview', 'products']);

export function resolveAffiliateStudioView(value) {
  return AFFILIATE_STUDIO_VIEWS.includes(value) ? value : 'overview';
}

export function buildAffiliateStudioUrl(brandId, options = {}) {
  // Preserve Fase 1 default URL, add supported view and bounded product filters.
}

export function parseAffiliateProductFilters(searchParams) {}
```

Ketentuan:

- Existing `buildAffiliateStudioUrl(brandId)` callers tetap menghasilkan URL valid Overview.
- Allowlist view/filter values.
- Unknown query tidak diteruskan.
- Cursor dianggap opaque string dengan maximum length.

### 13.2 `lib/affiliate-studio-product-readiness.js` — new

**Code Sebelum (Current/Before)**

```js
// Affiliate Studio product readiness contract does not exist.
```

**Code Sesudah (Proposed/After)**

```js
export function resolveBrandProductAssociation(row) {}
export function resolveSafeProductImage(row) {}
export function evaluateAffiliateProductReadiness({ product, association, affiliate }) {}
export function normalizeAffiliateProductFilters(input) {}
```

Ketentuan:

- Pure functions only.
- Stable reason codes, not prose-only decisions.
- No network/database/import of Product Database services.
- Never convert missing values into ready state.

### 13.3 `lib/affiliate-studio-brand-product-read-adapter.js` — new, server-only

**Code Sebelum (Current/Before)**

```js
// Affiliate Studio Brand Product Portfolio adapter does not exist.
```

**Code Sesudah (Proposed/After)**

```js
import 'server-only';
import { pgQuery } from './db-pg.js';
import { resolveAffiliateLink } from './affiliate-resolver.js';
import { getAuthorizedAffiliateBrand } from './affiliate-studio-brand-read-adapter.js';
import {
  evaluateAffiliateProductReadiness,
  normalizeAffiliateProductFilters,
  resolveBrandProductAssociation,
  resolveSafeProductImage
} from './affiliate-studio-product-readiness.js';

export async function listAffiliateBrandProductPortfolio({ user, brandId, filters }) {}
```

Ketentuan:

- Authorize Brand sebelum query catalog.
- Query selalu `tenant_id=user.tenantId`.
- Use parameterized SQL and stable cursor ordering.
- Left join one association using unique `(tenant_id, brand_profile_id, product_id)`.
- No database writes.
- Resolve affiliate link through existing resolver with bounded concurrency.
- Redact/bound text and local paths.
- Facets tidak boleh bergantung hanya pada current page jika diklaim sebagai catalog-wide facets.
- Unauthorized brand returns not-found.

### 13.4 `app/api/v2/affiliate-studio/brands/[id]/products/route.js` — new

**Code Sebelum (Current/Before)**

```js
// Affiliate Studio Brand Product Portfolio route does not exist.
```

**Code Sesudah (Proposed/After)**

```js
import { NextResponse } from 'next/server';
import { withAffiliateStudioAccess } from '@/lib/affiliate-studio-access';
import { listAffiliateBrandProductPortfolio } from '@/lib/affiliate-studio-brand-product-read-adapter';

export const dynamic = 'force-dynamic';

export const GET = withAffiliateStudioAccess('read', async (request, context, user) => {
  const { id } = await context.params;
  const filters = Object.fromEntries(new URL(request.url).searchParams);
  const data = await listAffiliateBrandProductPortfolio({ user, brandId: id, filters });
  if (!data) return NextResponse.json(
    { success: false, error: 'Brand Profile not found' },
    { status: 404 }
  );
  return NextResponse.json({ success: true, data });
});
```

Ketentuan:

- GET only; POST/PUT/PATCH/DELETE absent.
- Validation errors return stable `400`.
- Unauthorized/cross-tenant Brand returns `404`.
- Do not proxy to mutation-capable legacy brand-product route.

### 13.5 `app/affiliate-studio/components/AffiliateStudioShell.js` — minimal additive extension

**Code Sebelum (Current/Before)**

```jsx
export function AffiliateStudioShell({ brands = [], activeBrand, onBrandChange, children }) {
  const tabs = [
    { label: 'Overview', enabled: true },
    { label: 'Products', enabled: false },
    // ...
  ];
```

**Code Sesudah (Proposed/After)**

```jsx
export function AffiliateStudioShell({
  brands = [], activeBrand, activeView, onBrandChange, onNavigate, children
}) {
  const tabs = [
    { key: 'overview', label: 'Overview', enabled: true },
    { key: 'products', label: 'Products', enabled: true },
    // Future tabs remain disabled.
  ];
```

Ketentuan:

- Breadcrumb sublabel mengikuti active view.
- Enabled tabs use button + `aria-current`.
- Future tabs remain disabled.
- Do not refactor Brand switcher or Fase 1 layout.

### 13.6 `app/affiliate-studio/components/AffiliateStudioWorkspace.js` — minimal additive extension

**Code Sebelum (Current/Before)**

```jsx
<AffiliateStudioShell
  brands={brands}
  activeBrand={activeBrand}
  onBrandChange={(brandId) => {
    router.push(buildAffiliateStudioUrl(brandId));
  }}
>
  <BrandOverview ... />
</AffiliateStudioShell>
```

**Code Sesudah (Proposed/After)**

```jsx
const activeView = resolveAffiliateStudioView(searchParams?.get('view'));
const productFilters = parseAffiliateProductFilters(searchParams);

<AffiliateStudioShell
  brands={brands}
  activeBrand={activeBrand}
  activeView={activeView}
  onBrandChange={(brandId) => router.push(buildAffiliateStudioUrl(brandId, { view: activeView }))}
  onNavigate={(view) => router.push(buildAffiliateStudioUrl(activeBrand?.id, { view }))}
>
  {activeView === 'overview' && <BrandOverview ... />}
  {activeView === 'products' && <BrandProductPortfolio ... />}
</AffiliateStudioShell>
```

Ketentuan:

- Do not fetch Overview while Products view is active.
- Product fetch uses AbortController/stale-response protection.
- Preserve authorized brand behavior.
- Filter changes update URL and reset cursor.
- No mutation callbacks.

### 13.7 `app/affiliate-studio/components/BrandProductPortfolio.js` — new

**Code Sebelum (Current/Before)**

```jsx
// Brand Product Portfolio UI does not exist.
```

**Code Sesudah (Proposed/After)**

```jsx
'use client';

import Link from 'next/link';
import styles from './AffiliateStudio.module.css';

export function BrandProductPortfolio({
  data, filters, loading, error,
  onFiltersChange, onLoadMore, onRefresh
}) {
  // Read-only filters, facets, product cards/table, readiness, and generic Product DB link.
}
```

Ketentuan:

- Search submit/debounce bounded; no request per keystroke without control.
- Cards show association, affiliate source, readiness dimensions, and safe image.
- Missing affiliate link not clickable.
- Link source displayed explicitly.
- Product ID can be copied but not edited.
- No association/product mutation buttons.

### 13.8 `app/affiliate-studio/components/AffiliateStudio.module.css` — append-only Fase 2 classes

**Code Sebelum (Current/Before)**

```css
.engineSplit {
  /* Existing Fase 1 final class. */
}
```

**Code Sesudah (Proposed/After)**

```css
/* Fase 2 — Brand Product Portfolio */
.portfolioToolbar { /* semantic tokens */ }
.portfolioGrid { /* responsive layout */ }
.productCard { background: var(--surface); border: 1px solid var(--border-subtle); }
.readinessReady { color: var(--status-success); }
.readinessReview { color: var(--status-warning); }
.readinessIncomplete { color: var(--status-danger); }
.associationCandidate { color: var(--status-neutral); }
```

Ketentuan:

- Append new classes; do not rewrite Fase 1 CSS.
- Existing literal/theme issues, if any, are outside Fase 2 and must not be opportunistically fixed.
- New Fase 2 classes use existing semantic tokens only; no hex/RGB/RGBA/inline visual style.
- Do not modify `app/theme.css`.

### 13.9 `tests/affiliate-studio-product-readiness.test.js` — new

**Code Sebelum (Current/Before)**

```js
// Product readiness tests do not exist.
```

**Code Sesudah (Proposed/After)**

```js
test('active association with brand link truth and image is ready', () => {});
test('legacy affiliate fallback is needs_review', () => {});
test('candidate association is incomplete', () => {});
test('missing image or truth is incomplete', () => {});
test('absolute filesystem image paths are never exposed', () => {});
```

### 13.10 `tests/affiliate-studio-product-portfolio.test.js` — new

**Code Sebelum (Current/Before)**

```js
// Brand Product Portfolio integration tests do not exist.
```

**Code Sesudah (Proposed/After)**

```js
test('portfolio is tenant and assigned-brand isolated', async () => {});
test('linked and unlinked products are not duplicated', async () => {});
test('affiliate result matches existing resolver', async () => {});
test('filters and stable pagination do not duplicate or skip fixtures', async () => {});
test('inactive association remains visible when requested', async () => {});
```

Ketentuan:

- Use unique fixture tenant/product/brand IDs.
- Seed required parent tenant rows before dependent fixtures.
- Cleanup only exact fixture IDs in dependency order.
- Do not edit pre-existing Fase 1 test files to make Fase 2 pass.

### 13.11 `tests/affiliate-studio-phase-02-boundary.test.js` — new

**Code Sebelum (Current/Before)**

```js
// Fase 2 boundary test does not exist.
```

**Code Sesudah (Proposed/After)**

```js
test('portfolio API exports GET only', () => {});
test('portfolio UI contains no mutation action', () => {});
test('Fase 2 does not import product workers or campaign binding mutation', () => {});
test('Fase 2 does not add schema or modify frozen modules', () => {});
```

### 13.12 `sot/menus/affiliate-studio/phase-02-product-portfolio-implementation-plan.md` — this file

**Code Sebelum (Current/Before)**

```md
<!-- Fase 2 implementation plan does not exist. -->
```

**Code Sesudah (Proposed/After)**

```md
## 12. Execution Task List
- [ ] ...
```

Jika file tambahan diperlukan, tambahkan entry Before/After sebelum mengeditnya. Bila file termasuk Explicit No-Change List, hentikan dan minta keputusan user.

## 14. Explicit No-Change List

```text
app/products/**
app/settings/brand-profiles/**
app/content-planner/**
app/re-campaigns/**
app/pillar-campaigns/**
app/recipe-labs/**
app/multiplier-lab/**
app/instant-factory/**
app/product-bridge-inject/**
app/deconstruct/**
app/content-flow/**
app/youtube-studio/**
app/api/v2/products/**
app/api/v2/brand-profiles/**
app/api/content-planner/**
app/api/v2/re-campaigns/**
app/api/v2/pillar-campaigns/**
app/api/recipe-labs/**
app/api/v2/multiplier/**
app/api/v2/deconstruct/**
lib/product-repository.js
lib/product-catalog-service.js
lib/product-validation.js
lib/product-image-storage.js
lib/product-bulk-worker.js
lib/product-photo-service.js
lib/brand-product-repository.js
lib/affiliate-resolver.js
lib/campaign-product-binding.js
lib/auth.js
lib/db.js
lib/db-pg.js
lib/prompts.js
lib/scheduler-processors.js
lib/campaign-scheduler.js
lib/content-planner-*.js
lib/contentflow-*.js
app/components/Sidebar.js
app/theme.css
```

Allowed existing Fase 1 extensions:

```text
lib/affiliate-studio-workspace-state.js
app/affiliate-studio/components/AffiliateStudioShell.js
app/affiliate-studio/components/AffiliateStudioWorkspace.js
app/affiliate-studio/components/AffiliateStudio.module.css
```

Do not modify a dirty pre-existing file unless it is explicitly required by this plan and ownership is clear. At plan creation time, `tests/affiliate-studio-brand-projection.test.js` had an uncommitted change; treat it as user-owned and do not stage/release it with Fase 2 unless the user separately authorizes ownership.

## 15. Test Matrix

| Area | Scenario | Expected |
|---|---|---|
| Prerequisite | Fase 0/1 missing or regressions fail | Stop |
| View URL | Missing view | Overview |
| View URL | `products` | Products active |
| View URL | Unknown view | Canonical Overview |
| Brand change | Products active | Preserve Products view |
| Authorization | Cross-tenant brand | 404 |
| Authorization | Unassigned brand | 404 |
| Association | No brand_product row | candidate |
| Association | active row | active |
| Association | inactive row | inactive |
| Resolver | Brand link exists | brand_product |
| Resolver | Only legacy link exists | legacy_product + needs_review |
| Resolver | No link | missing + incomplete |
| Truth | Missing required truth | incomplete |
| Image | Local relative path | Existing image proxy URL |
| Image | Absolute filesystem path | Redacted/null |
| Search | Name/category/USP query | Bounded expected matches |
| Filter | association/readiness/category | Correct subset |
| Pagination | Multiple pages | Stable, no duplicates/skips |
| Facets | Catalog-wide claim | Not limited to current page |
| API method | POST/PUT/PATCH/DELETE | 405/no export |
| UI | Missing link | Not clickable |
| UI | Product mutation | No controls |
| Legacy | Product Database | Unchanged |
| Legacy | Resolver/binding | Unchanged |

## 16. Verification Commands

### 16.1 Focused Fase 2

```bash
node --test tests/affiliate-studio-product-readiness.test.js tests/affiliate-studio-product-portfolio.test.js tests/affiliate-studio-phase-02-boundary.test.js
```

### 16.2 Fase 0/1 regressions

```bash
node --test tests/affiliate-studio-foundation.test.js tests/affiliate-studio-boundary.test.js tests/affiliate-studio-brand-shell.test.js tests/affiliate-studio-brand-projection.test.js tests/affiliate-studio-phase-01-boundary.test.js
```

### 16.3 Existing product/affiliate regressions

```bash
node scripts/test-product-catalog-contract.mjs
node scripts/test-campaign-product-binding.mjs
```

Run any additional existing affiliate resolver test discovered during audit; do not invent a command for a missing file.

### 16.4 Static/build

```bash
git diff --check
npm run build
```

### 16.5 Optional Dev smoke

```bash
npm run deploy:macmini-dev
```

Verify only Dev ports 5020/7020:

- Overview remains unchanged.
- Products tab and brand switching.
- linked/unlinked/inactive filters.
- link source and readiness.
- search/pagination.
- missing image/link states.
- regular user assigned-brand isolation.

Do not deploy Staging/Production and do not use repeated SSH polling loops.

## 17. Acceptance Criteria

1. Fase 0 and Fase 1 regressions remain green.
2. Products is an enabled Affiliate Studio view; future tabs remain disabled.
3. Existing Overview URL and behavior remain backward-compatible.
4. Product list is tenant- and assigned-brand-safe.
5. Linked, unlinked candidate, and inactive products are not duplicated.
6. Affiliate link/source matches existing resolver output.
7. Legacy fallback is visibly marked needs-review.
8. Readiness is deterministic and dimensioned.
9. Missing/unsafe image never exposes absolute filesystem path.
10. Search/filter/pagination are bounded and stable.
11. API is GET-only and UI has no product/association mutations.
12. Product Database remains the source of truth and is unchanged.
13. Campaign binding and affiliate resolver remain unchanged.
14. No schema/table/migration is added.
15. No Explicit No-Change file is modified.
16. Focused tests, Fase regressions, product/affiliate regressions, diff check, and build pass.

## 18. Rollback Strategy

1. Set `affiliate_studio_enabled=false` for immediate tenant-level disable.
2. Code rollback removes Products activation, component, API, adapter, and readiness helper.
3. No database rollback is required.
4. Product Database and Brand–Product associations remain untouched.
5. Fase 1 Overview remains independently usable after removing Fase 2.

## 19. Release SOP

After all gates pass:

```bash
npm run release-non-interactive -- --type minor --title "Affiliate Studio Product Portfolio" --points "Tambah Brand Product Portfolio read-only di Affiliate Studio|Tambah readiness dan affiliate source berdasarkan resolver existing|Tambah filter pagination tenant isolation dan product boundary tests"
```

Verify version, changelog, release commit, tag, current branch, and remote push. Do not stage or release unrelated dirty files.

## 20. Handoff to Fase 3

Fase 3 may reference selected products from this projection when creating new Campaign Program records, but must not turn Fase 2 into a mutation surface. The stable handoff contract is:

```text
brand_profile_id
product_id
brand_product_id (nullable)
affiliate resolution display metadata
readiness snapshot display metadata
```

Campaign Program persistence and product snapshots belong to Fase 3.

