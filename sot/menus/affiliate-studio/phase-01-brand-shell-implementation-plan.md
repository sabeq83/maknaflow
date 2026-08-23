# Implementation Plan — Affiliate Studio Fase 1: Brand-First Application Shell

> Status: Planned — blocked until Fase 0 is implemented, verified, released, and pushed.  
> Parent roadmap: `sot/menus/affiliate-studio-roadmap.md`  
> Dependency: `sot/menus/affiliate-studio/phase-00-foundation-implementation-plan.md`  
> Mandat: **additive-only, read-only projection**. Fase ini menambahkan application shell, Brand Profile switcher, dan Brand Overview; tidak mengambil alih create/edit atau execution dari modul legacy.

## 1. Objective

Menghadirkan route `/affiliate-studio` sebagai application area berbasis Brand Profile yang menampilkan ringkasan operasional read-only dari data existing.

```text
Sidebar permission gate
    ↓
/affiliate-studio shell
    ↓
Authorized Brand Profile switcher
    ↓
Read-only Brand Overview API
    ├── Product summary projection
    ├── Content Planner summary projection
    ├── Campaign summary projection
    └── ContentFlow summary projection
```

Fase ini hanya memberi user satu pintu masuk dan konteks brand. Product, Planner, Campaign, ContentFlow, dan Brand Profile tetap dikelola pada halaman asalnya.

## 2. Prerequisite Gate

Agent wajib menghentikan implementasi apabila salah satu kontrak Fase 0 belum tersedia:

- permission `affiliate_studio` pada `ALL_MENU_KEYS`;
- `affiliate_studio_enabled` default-deny feature flag;
- `withAffiliateStudioAccess`;
- `buildAffiliateStudioCapabilities`;
- metadata-only connector registry;
- focused tests Fase 0 lulus;
- release Fase 0 sudah terdapat pada changelog, Git tag, `main`, dan remote.

Fase 1 tidak boleh mengimplementasikan ulang atau mengubah contract Fase 0 untuk melewati prerequisite.

## 3. Scope

### 3.1 In scope

- Tambahkan menu top-level **Affiliate Studio** yang memakai permission `affiliate_studio`.
- Tambahkan route page `/affiliate-studio`.
- Tambahkan scoped CSS Module Affiliate Studio.
- Tambahkan application shell dengan title, breadcrumb, local navigation, dan active-brand summary.
- Tambahkan Brand Profile switcher berdasarkan brand yang diizinkan untuk current user.
- Sinkronkan brand terpilih ke URL query `?brand=<brand_profile_id>`.
- Tambahkan Brand Overview read-only.
- Tambahkan adapter server-only untuk membaca dan memproyeksikan data existing.
- Tambahkan API list brand authorized dan API overview satu brand.
- Tambahkan summary cards untuk Product, Planner, Campaign, dan ContentFlow.
- Tambahkan source/evidence metadata agar angka overview dapat ditelusuri.
- Tambahkan deep link ke modul legacy tanpa mengubah perilaku halaman tujuan.
- Tambahkan empty, loading, forbidden, disabled, stale, partial, dan error states.
- Tambahkan tests tenant isolation, assigned-brand authorization, projection truthfulness, URL selection, dan forbidden writes/imports.

### 3.2 Out of scope

- Create/edit/delete Brand Profile.
- Product Portfolio detail atau affiliate-link management; milik Fase 2.
- Campaign Program; milik Fase 3.
- Link Content Planner ke Program; milik Fase 4.
- Unified Production Queue; milik Fase 5.
- Launch engine; milik Fase 6.
- Smart Route, Deconstruct intelligence, publishing, performance, dan insight.
- Tabel `affiliate_*`.
- Perubahan schema legacy.
- Perubahan query, form, prompt, worker, scheduler, atau state machine legacy.
- Deployment Staging atau Production.

## 4. UX Contract

### 4.1 Page hierarchy

```text
Affiliate Studio
└── [Brand Profile Switcher]
    └── Overview
        ├── Brand Snapshot
        ├── Product Summary
        ├── Planner Summary
        ├── Campaign Summary
        ├── ContentFlow Summary
        └── Legacy Module Links
```

### 4.2 Local navigation Fase 1

| Item | State Fase 1 | Behavior |
|---|---|---|
| Overview | Enabled | Menampilkan Brand Overview |
| Planner | Disabled / Coming later | Tidak menavigasi |
| Products | Disabled / Coming later | Tidak menavigasi |
| Campaigns | Disabled / Coming later | Tidak menavigasi |
| Production | Disabled / Coming later | Tidak menavigasi |
| Publishing | Disabled / Coming later | Tidak menavigasi |
| Performance | Disabled / Coming later | Tidak menavigasi |

Jangan membuat placeholder route kosong untuk area fase berikutnya.

### 4.3 Brand selection rules

1. Brand query valid dan authorized → gunakan brand tersebut.
2. Brand query valid tetapi tidak authorized → API mengembalikan `404`, UI tidak membocorkan nama brand.
3. Query tidak ada → pilih brand authorized pertama secara deterministic.
4. Query invalid/stale → ganti dengan brand authorized pertama dan gunakan `router.replace`.
5. User tidak mempunyai brand → tampilkan empty state tanpa menjalankan overview query.
6. Admin melihat seluruh brand tenant; regular user hanya `assignedBrandIds`.
7. Brand selection disimpan pada URL, bukan `localStorage`, agar deep link dan refresh reproducible.

### 4.4 Read-only promise

Affiliate Studio Fase 1 tidak boleh menampilkan button dengan kata:

```text
Create
Generate
Run
Retry
Approve
Publish
Delete
Edit
```

Tindakan yang diperbolehkan hanya:

- mengganti brand;
- refresh overview;
- membuka modul legacy;
- membuka Brand Profile Manager.

## 5. Projection Contract

### 5.1 Response shape

`GET /api/v2/affiliate-studio/brands/:id/overview`

```json
{
  "success": true,
  "data": {
    "brand": {
      "id": "brand_id",
      "name": "Siasat Sehat",
      "toneOfVoice": "...",
      "visualSignature": "...",
      "contentGoal": "...",
      "contentPillars": []
    },
    "summaries": {
      "products": {
        "linked": 12,
        "active": 10,
        "missingAffiliateLink": 2
      },
      "planners": {
        "total": 5,
        "rows": 60,
        "draft": 1
      },
      "campaigns": {
        "total": 9,
        "active": 3,
        "completed": 5,
        "failed": 1,
        "byEngine": {
          "re": 2,
          "pillar": 4,
          "recipe": 3
        }
      },
      "contentFlow": {
        "total": 48,
        "ready": 7,
        "publishedAny": 31,
        "unpublished": 10
      }
    },
    "sources": [],
    "generatedAt": "2026-08-23T00:00:00.000Z",
    "freshness": "live",
    "partial": false,
    "warnings": [],
    "links": {}
  }
}
```

### 5.2 Source traceability

Setiap summary menyertakan source descriptor, bukan raw SQL:

```json
{
  "key": "products",
  "source": "brand_products",
  "scope": "tenant+brand_profile_id",
  "status": "ok"
}
```

Jika satu source gagal dibaca:

- response tetap `200` jika Brand Profile berhasil dan source lain tersedia;
- `partial=true`;
- summary source gagal bernilai `null`, bukan angka `0` palsu;
- warning memiliki stable code tanpa stack trace;
- source status menjadi `unavailable`.

### 5.3 Product projection

Fase 1 hanya menghitung association existing `brand_products`:

- `linked`: seluruh link Brand–Product.
- `active`: `is_active=true`.
- `missingAffiliateLink`: active association tanpa affiliate link.

Fase 1 tidak menghitung kesiapan foto, product truth, atau resolver precedence; itu Fase 2.

### 5.4 Planner projection

Planner dihitung menggunakan:

```text
content_planners.brand_id = selected brand ID
OR legacy fallback LOWER(account_name) = LOWER(brand_name)
```

Gunakan distinct planner ID agar record yang memenuhi kedua kondisi tidak dihitung ganda.

### 5.5 Campaign projection

Fase 1 membaca campaign tables yang sudah mempunyai hubungan Brand Profile stabil:

- `re_campaigns`
- `pillar_campaigns`
- `recipe_campaigns`

Engine lain tidak boleh dipaksakan masuk bila belum memiliki lineage brand yang konsisten. Overview wajib menandai coverage sebagai `partial` dan menyebut `CAMPAIGN_ENGINE_COVERAGE_PHASE_1` sampai connector fase berikutnya tersedia.

Status campaign hanya diproyeksikan untuk display summary. Tidak ada update status.

### 5.6 ContentFlow projection

Selection precedence:

```text
content_flow_items.brand_profile_id = selected brand ID
OR, only when brand_profile_id is NULL/empty,
LOWER(content_flow_items.account_name) = LOWER(brand_name)
```

Fallback nama tidak boleh mengambil row yang sudah memiliki `brand_profile_id` berbeda.

`publishedAny` berarti setidaknya satu platform status bernilai `published`. Ini bukan conversion metric.

## 6. Deep-Link Contract

| Target | Link Fase 1 | Context behavior |
|---|---|---|
| Brand Profile Manager | `/settings/brand-profiles` | Generic manager; tidak mengklaim membuka editor brand tertentu |
| Product Database | `/products` | Generic list; brand-scoped portfolio baru Fase 2 |
| Content Planner | `/content-planner` | Generic list; program/brand scoped connection baru Fase 4 |
| RE Campaign | `/re-campaigns` | Generic legacy module |
| Pillar Campaign | `/pillar-campaigns` | Generic legacy module |
| Recipe Labs | `/recipe-labs` | Generic legacy module |
| ContentFlow | `/content-flow?account=<encoded brand name>` | Membawa context yang memang didukung existing flow |

Jangan menambahkan `?brand=` ke halaman legacy yang belum membacanya. Link harus dibentuk server-side dari allowlist path; jangan menerima arbitrary redirect URL dari client.

## 7. Execution Task List

- [ ] Verify Fase 0 code, focused tests, changelog, release commit, Git tag, `main`, and remote sync before editing Fase 1.
- [ ] Re-read `AGENTS.md`, parent roadmap, this plan, Fase 0 actual contracts, Next.js 16.2.5 route/server-client docs, and semantic theme tokens.
- [ ] Audit working tree and record pre-existing user changes; do not modify or release unrelated files.
- [ ] Add the Affiliate Studio Sidebar mapping and navigation item as a minimal permission-gated connection.
- [ ] Implement pure workspace selection/deep-link state helpers.
- [ ] Implement the tenant- and assigned-brand-safe read adapter with independent partial projections.
- [ ] Implement authorized brand-list and brand-overview read-only APIs using Fase 0 access wrapper.
- [ ] Implement the Affiliate Studio page, application shell, Brand switcher, breadcrumb, Overview, and honest coming-later navigation.
- [ ] Implement scoped semantic CSS Module using existing `app/theme.css` tokens only.
- [ ] Add loading, empty, invalid/stale brand, partial source, disabled, forbidden, and API-error states.
- [ ] Add projection, tenant/brand authorization, workspace-state, deep-link, read-only route, and forbidden-import/write tests.
- [ ] Run focused Fase 1 tests and all Fase 0 regression tests.
- [ ] Run existing auth/RBAC smoke, `git diff --check`, and production build.
- [ ] Audit changed paths against the Explicit No-Change List and verify no legacy schema/query/worker/prompt/state machine was revised.
- [ ] Update every checkbox immediately after evidence is obtained.
- [ ] Deploy to Mac Mini Dev only if required for browser smoke; verify `/affiliate-studio` on ports 5020/7020 without SSH polling loops.
- [ ] Execute release SOP after all gates pass and verify changelog, commit, tag, `main`, and remote push.

## 8. Planned File Changes

### 8.1 `app/components/Sidebar.js` — minimal existing-file connection

**Code Sebelum (Current/Before)**

```js
const menuKeyMap = {
  '/youtube-studio': 'youtube_studio',
  '/content-flow': 'content_flow',
```

```jsx
{ section: 'WORKFLOW' },
{ label: 'YouTube Studio', href: '/youtube-studio', icon: '▶️' },
{ label: 'RE Campaign', href: '/re-campaigns', icon: '🎬' },
```

**Code Sesudah (Proposed/After)**

```js
const menuKeyMap = {
  '/youtube-studio': 'youtube_studio',
  '/affiliate-studio': 'affiliate_studio',
  '/content-flow': 'content_flow',
```

```jsx
{ section: 'WORKFLOW' },
{ label: 'YouTube Studio', href: '/youtube-studio', icon: '▶️' },
{ label: 'Affiliate Studio', href: '/affiliate-studio', icon: '◆' },
{ label: 'RE Campaign', href: '/re-campaigns', icon: '🎬' },
```

Ketentuan:

- Jangan mengubah filtering, ordering algorithm, auth fetch, disabled state, atau markup item existing.
- Menu memakai permission dan `tenantDisabledMenus` existing.
- Feature flag server tetap menjadi authority; menu permission bukan pengganti flag.
- Jangan memindahkan menu legacy ke sub-navigation pada Fase 1.

### 8.2 `lib/affiliate-studio-workspace-state.js` — new

**Code Sebelum (Current/Before)**

```js
// Affiliate Studio workspace state helpers do not exist.
```

**Code Sesudah (Proposed/After)**

```js
export function resolveActiveAffiliateBrand({ brands, requestedBrandId }) {}
export function buildAffiliateStudioUrl(brandId) {}
export function buildAffiliateLegacyLinks(brand) {}
```

Ketentuan:

- Pure functions only.
- Selection deterministic dan tidak menggunakan `localStorage`.
- `buildAffiliateLegacyLinks` memakai path allowlist.
- Encode brand name untuk ContentFlow account query.
- Unknown/missing brand menghasilkan explicit resolution reason.

### 8.3 `lib/affiliate-studio-brand-read-adapter.js` — new, server-only

**Code Sebelum (Current/Before)**

```js
// Affiliate Studio brand projection adapter does not exist.
```

**Code Sesudah (Proposed/After)**

```js
import 'server-only';
import { pgQuery } from './db-pg.js';
import { getDb } from './db.js';
import { buildAffiliateLegacyLinks } from './affiliate-studio-workspace-state.js';

export async function listAuthorizedAffiliateBrands(user) {}
export async function getAuthorizedAffiliateBrand(user, brandId) {}
export async function getAffiliateBrandOverview({ user, brandId }) {}
```

Internal projection functions:

```js
async function projectProductSummary(context) {}
async function projectPlannerSummary(context) {}
async function projectCampaignSummary(context) {}
async function projectContentFlowSummary(context) {}
```

Ketentuan:

- Tenant ID berasal dari `user.tenantId`; tidak menerima tenant ID dari request.
- Admin dapat membaca seluruh brand tenant.
- Regular user hanya brand dalam `assignedBrandIds`.
- Unauthorized brand dikembalikan sebagai not-found agar tidak ada enumeration leak.
- Gunakan parameterized query.
- Jalankan projections secara independen agar satu source failure menjadi partial response.
- Jangan mengimpor UI, route handler, worker, scheduler, prompt, atau engine service.
- Jangan menulis ke database.
- Jangan mengembalikan secret Brand Profile seperti `webhook_api_key`.

### 8.4 `app/api/v2/affiliate-studio/brands/route.js` — new

**Code Sebelum (Current/Before)**

```js
// Authorized Affiliate Studio brand list route does not exist.
```

**Code Sesudah (Proposed/After)**

```js
import { NextResponse } from 'next/server';
import { withAffiliateStudioAccess } from '@/lib/affiliate-studio-access';
import { listAuthorizedAffiliateBrands } from '@/lib/affiliate-studio-brand-read-adapter';

export const dynamic = 'force-dynamic';

export const GET = withAffiliateStudioAccess('read', async (_request, _context, user) =>
  NextResponse.json({ success: true, data: await listAuthorizedAffiliateBrands(user) })
);
```

Ketentuan:

- GET only.
- Minimal fields: `id`, `name`, optional display metadata.
- No secret or raw guideline payload.

### 8.5 `app/api/v2/affiliate-studio/brands/[id]/overview/route.js` — new

**Code Sebelum (Current/Before)**

```js
// Affiliate Studio brand overview route does not exist.
```

**Code Sesudah (Proposed/After)**

```js
import { NextResponse } from 'next/server';
import { withAffiliateStudioAccess } from '@/lib/affiliate-studio-access';
import { getAffiliateBrandOverview } from '@/lib/affiliate-studio-brand-read-adapter';

export const dynamic = 'force-dynamic';

export const GET = withAffiliateStudioAccess('read', async (_request, context, user) => {
  const { id } = await context.params;
  const data = await getAffiliateBrandOverview({ user, brandId: id });
  if (!data) return NextResponse.json(
    { success: false, error: 'Brand Profile not found' },
    { status: 404 }
  );
  return NextResponse.json({ success: true, data });
});
```

Ketentuan:

- `params` di-await sesuai Next.js version lokal.
- GET only.
- Unauthorized cross-brand request → 404.
- Partial source failure → truthful partial payload, bukan total failure atau fake zero.

### 8.6 `app/affiliate-studio/page.js` — new

**Code Sebelum (Current/Before)**

```jsx
// Affiliate Studio page does not exist.
```

**Code Sesudah (Proposed/After)**

```jsx
import { Suspense } from 'react';
import Sidebar from '../components/Sidebar';
import { AffiliateStudioWorkspace } from './components/AffiliateStudioWorkspace';
import styles from './components/AffiliateStudio.module.css';

export default function AffiliateStudioPage() {
  return (
    <div className="layout-with-sidebar">
      <Sidebar />
      <main className="main-content">
        <div className="page-container">
          <Suspense fallback={<div className={styles.loadingState}>Loading Affiliate Studio...</div>}>
            <AffiliateStudioWorkspace />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
```

Ketentuan:

- Page tetap Server Component; interactivity dibatasi pada Workspace client boundary.
- Jangan memakai inline style.
- Jangan query database langsung dari page.

### 8.7 `app/affiliate-studio/components/AffiliateStudioWorkspace.js` — new

**Code Sebelum (Current/Before)**

```jsx
// Affiliate Studio client workspace does not exist.
```

**Code Sesudah (Proposed/After)**

```jsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { resolveActiveAffiliateBrand } from '@/lib/affiliate-studio-workspace-state';
import { AffiliateStudioShell } from './AffiliateStudioShell';
import { BrandOverview } from './BrandOverview';

export function AffiliateStudioWorkspace() {
  // Load authorized brands, resolve URL selection, then load overview.
}
```

Ketentuan:

- Abort or ignore stale overview response when brand changes rapidly.
- Preserve last successful brand list during overview refresh.
- Do not use optimistic counts.
- `router.replace` only when canonicalizing invalid/missing query.
- Distinguish 403 disabled/access state from 404 stale brand and 500 source error.

### 8.8 `app/affiliate-studio/components/AffiliateStudioShell.js` — new

**Code Sebelum (Current/Before)**

```jsx
// Affiliate Studio shell does not exist.
```

**Code Sesudah (Proposed/After)**

```jsx
import styles from './AffiliateStudio.module.css';

export function AffiliateStudioShell({ brands, activeBrand, onBrandChange, children }) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>...</header>
      <nav className={styles.localNavigation} aria-label="Affiliate Studio Navigation">...</nav>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
```

Ketentuan:

- Native labelled `<select>` untuk Brand switcher pada fase awal.
- Breadcrumb: `Affiliate Studio / <Brand Name> / Overview`.
- Coming-later tabs menggunakan disabled buttons dan accessible label.
- Jangan menggunakan clickable `<span>` untuk navigation.

### 8.9 `app/affiliate-studio/components/BrandOverview.js` — new

**Code Sebelum (Current/Before)**

```jsx
// Affiliate Studio Brand Overview does not exist.
```

**Code Sesudah (Proposed/After)**

```jsx
import Link from 'next/link';
import styles from './AffiliateStudio.module.css';

export function BrandOverview({ overview, loading, error, onRefresh }) {
  // Render brand snapshot, truthful summary cards, warnings, freshness, and legacy links.
}
```

Ketentuan:

- `null` partial metric tampil sebagai `Unavailable`, bukan `0`.
- Summary card menyebut scope/coverage.
- Show `generatedAt` and partial warning.
- Legacy links use server-provided allowlisted URLs.
- Refresh diperbolehkan; no create/edit/run actions.

### 8.10 `app/affiliate-studio/components/AffiliateStudio.module.css` — new

**Code Sebelum (Current/Before)**

```css
/* Affiliate Studio scoped styles do not exist. */
```

**Code Sesudah (Proposed/After)**

```css
.shell { display: grid; gap: 1rem; }
.header { background: var(--surface); border: 1px solid var(--border-subtle); }
.localNavigation { display: flex; gap: .5rem; }
.summaryCard { background: var(--surface-raised); border: 1px solid var(--border-subtle); }
.partialWarning { background: var(--status-warning-soft); color: var(--status-warning); }
.loadingState { color: var(--text-muted); }
```

Ketentuan:

- Semantic token dari `app/theme.css` only.
- Dilarang literal hex, `rgb`, `rgba`, hard-coded shadow, atau page-specific gradient.
- Responsive untuk viewport sempit.
- Jangan menambah token Affiliate Studio ke `app/theme.css` pada Fase 1.

### 8.11 `tests/affiliate-studio-brand-shell.test.js` — new

**Code Sebelum (Current/Before)**

```js
// Affiliate Studio brand shell tests do not exist.
```

**Code Sesudah (Proposed/After)**

```js
import test from 'node:test';
import assert from 'node:assert/strict';

test('requested authorized brand wins', () => {});
test('missing or stale brand resolves deterministically', () => {});
test('ContentFlow is the only legacy link receiving supported brand context', () => {});
test('partial metric remains unavailable instead of becoming zero', () => {});
```

Ketentuan:

- Pure state and projection-shape tests run without network.
- Test URL encoding and allowlisted links.
- Test empty brand list.

### 8.12 `tests/affiliate-studio-brand-projection.test.js` — new

**Code Sebelum (Current/Before)**

```js
// Affiliate Studio brand projection integration tests do not exist.
```

**Code Sesudah (Proposed/After)**

```js
test('admin sees only brands from the active tenant', async () => {});
test('regular user sees only assigned brands', async () => {});
test('unauthorized brand overview is not found', async () => {});
test('planner ID and account-name fallback do not double count', async () => {});
test('ContentFlow fallback never captures a row owned by another brand ID', async () => {});
```

Ketentuan:

- Gunakan isolated test tenant IDs.
- Cleanup hanya fixture IDs yang dibuat test.
- Jangan menghapus data tenant lain.
- Bila test integration membutuhkan database, jangan memasukkan credential ke file.

### 8.13 `tests/affiliate-studio-phase-01-boundary.test.js` — new

**Code Sebelum (Current/Before)**

```js
// Affiliate Studio Fase 1 boundary test does not exist.
```

**Code Sesudah (Proposed/After)**

```js
test('phase-01 APIs expose GET only', () => {});
test('phase-01 runtime does not import legacy workers, prompts, or schedulers', () => {});
test('phase-01 UI contains no production action labels', () => {});
test('phase-01 changed paths do not include frozen modules', () => {});
```

Ketentuan:

- Scan explicit Affiliate Studio file allowlist.
- Do not scan node_modules or unrelated user files.
- Boundary test may read route source to verify no POST/PUT/PATCH/DELETE export.

### 8.14 `sot/menus/affiliate-studio/phase-01-brand-shell-implementation-plan.md` — this file

**Code Sebelum (Current/Before)**

```md
<!-- Fase 1 implementation plan does not exist. -->
```

**Code Sesudah (Proposed/After)**

```md
## 7. Execution Task List
- [ ] ...
```

Jika implementasi membutuhkan file lain, agent harus menambahkan entri Before/After ke plan sebelum file tersebut diedit.

## 9. Explicit No-Change List

Fase 1 dilarang mengubah:

```text
app/settings/brand-profiles/**
app/content-planner/**
app/products/**
app/re-campaigns/**
app/pillar-campaigns/**
app/recipe-labs/**
app/multiplier-lab/**
app/instant-factory/**
app/product-bridge-inject/**
app/deconstruct/**
app/content-flow/**
app/youtube-studio/**
app/api/content-planner/**
app/api/v2/products/**
app/api/v2/brand-profiles/**
app/api/v2/re-campaigns/**
app/api/v2/pillar-campaigns/**
app/api/recipe-labs/**
app/api/v2/multiplier/**
app/api/v2/deconstruct/**
lib/auth.js
lib/db.js
lib/db-pg.js
lib/prompts.js
lib/scheduler-processors.js
lib/campaign-scheduler.js
lib/re-multiplier-worker.js
lib/content-planner-*.js
lib/contentflow-*.js
lib/product-*.js
lib/brand-product-repository.js
lib/affiliate-resolver.js
app/theme.css
```

Allowed existing-file edit:

```text
app/components/Sidebar.js
```

Allowed Fase 0 files hanya boleh diubah untuk bug yang dibuktikan oleh failing Fase 0 regression test. Jika itu terjadi, hentikan Fase 1, dokumentasikan bukti, dan minta keputusan user.

## 10. Test Matrix

| Area | Scenario | Expected |
|---|---|---|
| Prerequisite | Fase 0 contract missing | Stop, no fallback implementation |
| Feature flag | Tenant flag false | Affiliate API 403; no operational data |
| Sidebar | Permission missing | Menu hidden |
| Sidebar | Tenant menu disabled | Existing disabled behavior |
| Brands API | Admin tenant | All and only tenant brands |
| Brands API | Regular user | Assigned brands only |
| Overview API | Unauthorized brand ID | 404 |
| Overview API | Cross-tenant brand ID | 404 |
| Brand selection | Valid query | Selected |
| Brand selection | Missing query | First authorized brand + canonical URL |
| Brand selection | Stale query | First authorized brand + canonical URL |
| Brand selection | No brands | Honest empty state |
| Products | Missing affiliate link | Counted only from active association |
| Planner | ID + name both match | Counted once |
| Campaign | Unsupported engines | Partial coverage warning |
| ContentFlow | Matching different brand ID + same name | Excluded |
| Projection | One source fails | 200 partial, metric `null` |
| Deep links | Unsupported brand context | Generic route, no fake query |
| Deep links | ContentFlow | Encoded `account` query |
| UI | Future navigation | Disabled and honest |
| UI | Action surface | No create/edit/run/publish controls |
| API methods | POST/PUT/PATCH/DELETE | 405/no export |
| Boundary | Legacy execution imports | Test fails |

## 11. Verification Commands

### 11.1 Focused Fase 1 tests

```bash
node --test tests/affiliate-studio-brand-shell.test.js tests/affiliate-studio-brand-projection.test.js tests/affiliate-studio-phase-01-boundary.test.js
```

### 11.2 Fase 0 regressions

```bash
node --test tests/affiliate-studio-foundation.test.js tests/affiliate-studio-boundary.test.js
```

### 11.3 Existing RBAC regression

```bash
node scripts/test-auth-rbac.js
```

### 11.4 Static and build verification

```bash
git diff --check
npm run build
```

### 11.5 Optional Dev-only smoke

```bash
npm run deploy:macmini-dev
```

Verify only:

- `http://100.95.245.55:5020/affiliate-studio`
- API port `7020`
- permission-hidden state;
- flag-disabled state;
- admin brand list;
- regular-user assigned-brand isolation;
- brand URL refresh/deep link;
- partial warning behavior.

Jangan deploy Staging/Production dan jangan polling SSH loop selama remote build.

## 12. Acceptance Criteria

1. Fase 0 tetap lulus tanpa contract revision.
2. Sidebar menampilkan Affiliate Studio hanya melalui permission/tenant-disabled behavior existing.
3. Server tetap menolak API ketika tenant feature flag disabled.
4. `/affiliate-studio` mempunyai shell, breadcrumb, local navigation, dan Brand switcher.
5. Admin hanya melihat brand tenant aktif; regular user hanya assigned brands.
6. Cross-tenant/cross-brand enumeration mengembalikan 404 tanpa nama brand.
7. URL `?brand=` mereproduksi selected brand setelah refresh.
8. Overview menampilkan Product, Planner, Campaign, dan ContentFlow secara read-only.
9. Angka mempunyai source descriptor dan timestamp.
10. Source failure menghasilkan `partial=true` dan `null`, bukan angka nol palsu.
11. Campaign coverage Fase 1 secara eksplisit mengaku partial.
12. Deep link tidak mengirim query parameter yang tidak didukung modul legacy.
13. Tidak ada create/edit/generate/run/retry/approve/publish/delete action.
14. Tidak ada tabel/kolom/migration baru.
15. Tidak ada file Explicit No-Change List yang berubah.
16. Focused tests, Fase 0 regressions, RBAC smoke, `git diff --check`, dan build lulus.

## 13. Rollback Strategy

1. Set `affiliate_studio_enabled=false` pada tenant.
2. API overview dan brand list kembali 403 melalui Fase 0 gate.
3. Jika diperlukan code rollback, hapus nav item/mapping Affiliate Studio dan file baru Fase 1.
4. Tidak ada database rollback karena tidak ada schema/data domain baru.
5. Semua modul legacy tetap tersedia melalui URL dan sidebar lama.

Rollback tidak memerlukan perubahan RE, Pillar, Recipe, Multiplier, Planner, Product Database, atau ContentFlow.

## 14. Release SOP

Setelah seluruh checklist dan verification gate lulus:

```bash
npm run release-non-interactive -- --type minor --title "Affiliate Studio Brand Shell" --points "Tambah application shell Affiliate Studio berbasis Brand Profile|Tambah overview read-only Product Planner Campaign dan ContentFlow|Tambah assigned-brand isolation truthful projection dan deep links legacy"
```

Verifikasi setelah release:

- version dan changelog terbarui;
- release commit tercipta;
- tag `vX.Y.Z` tersedia;
- branch `main` dan tag terunggah ke `https://github.com/sabeq83/maknaflow.git`;
- unrelated user changes tidak ikut commit.

## 15. Handoff ke Fase 2

Fase 2 memakai:

- active Brand Profile URL context dari Fase 1;
- `listAuthorizedAffiliateBrands` dan authorization rules;
- Brand shell/local navigation;
- Product summary projection source metadata.

Fase 2 menambahkan Brand Product Portfolio sebagai view baru tanpa memindahkan Product Database. Fase 2 tidak boleh mengubah selection semantics atau overview response secara breaking.

