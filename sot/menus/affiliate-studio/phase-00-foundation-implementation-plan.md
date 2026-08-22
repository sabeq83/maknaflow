# Implementation Plan — Affiliate Studio Fase 0: Contract, Boundary, Permission, dan Feature Flag

> Status: Planned  
> Parent roadmap: `sot/menus/affiliate-studio-roadmap.md`  
> Mandat: **additive-only**. Fase ini membangun pagar dan kontrak Affiliate Studio; tidak membuat UI Studio, Campaign Program, koneksi Content Planner, connector engine, atau production run.  
> Legacy freeze: RE, Pillar/OPC, Recipe Labs, Multiplier, Instant Campaign, Product Bridging, Deconstruct, Content Planner, Product Database, ContentFlow, publishing, scheduler, worker, dan prompt tidak boleh direvisi.

## 1. Objective

Membuat fondasi tenant-safe dan permission-gated untuk Affiliate Studio sebelum application shell atau integrasi engine dibangun.

```text
Existing Session + Tenant Context
    ↓
affiliate_studio permission
    ↓
tenant feature flag
    ↓
Affiliate Studio access policy
    ↓
read-only capability contract
    ↓
empty connector registry (no legacy engine imports)
```

Hasil fase ini hanya berupa kontrak server, permission, feature flag, registry kosong, endpoint foundation, dan tests. Tidak ada menu/sidebar atau halaman `/affiliate-studio`; application shell baru dibuat pada Fase 1.

## 2. Scope

### 2.1 In scope

- Permission key `affiliate_studio` pada katalog RBAC existing.
- Tenant feature flag `affiliate_studio_enabled`, default efektif `false` jika setting belum ada.
- Pure access-policy evaluator untuk read/write/admin.
- Wrapper `withAffiliateStudioAccess` yang menyusun auth existing, RBAC, tenant-disabled menu, dan feature flag.
- Kontrak engine type dan normalized status Affiliate Studio.
- Connector registry kosong yang hanya menerima metadata connector valid.
- Read-only endpoint capability/foundation.
- Admin-only endpoint GET/PUT feature flag.
- Audit event ketika feature flag diubah.
- Unit tests untuk contract, transition-free status vocabulary, registry, access policy, dan feature flag parsing.
- Boundary test untuk memastikan foundation tidak mengimpor repository/worker/prompt engine legacy.

### 2.2 Out of scope

- Sidebar/menu Affiliate Studio.
- Route page `/affiliate-studio`.
- Brand switcher dan Brand Overview.
- Tabel `affiliate_*`.
- Campaign Program.
- Content Planner connection.
- Product Portfolio projection.
- Connector RE/Pillar/Recipe/Multiplier/Instant/Bridge.
- Universal Production Queue.
- Smart Route, AI generation, publishing, performance, dan insight.
- Perubahan schema/table legacy.
- Deployment Staging atau Production.

## 3. Architectural Decisions

### 3.1 Permission dan feature flag adalah gate terpisah

Request Affiliate Studio hanya diizinkan apabila seluruh kondisi berikut terpenuhi:

```text
authenticated tenant user
AND tenant_id != __none__
AND menuPermissions includes affiliate_studio
AND tenantDisabledMenus excludes affiliate_studio
AND tenant setting affiliate_studio_enabled == true
AND requested capability is allowed by role/mode
```

- `permission` mengatur user mana yang boleh memakai Studio.
- `tenantDisabledMenus` mempertahankan kontrol Superadmin existing.
- `feature flag` mengatur apakah rollout tenant sudah aktif.
- Admin tenant dapat mengubah flag melalui endpoint foundation.
- Superadmin tetap tidak mendapat akses data operasional tenant sesuai `withTenantContext` existing.

### 3.2 Default-deny rollout

Jika `tenant_settings` tidak memiliki `affiliate_studio_enabled`, nilai efektif adalah `false`. Tidak ada tenant yang aktif otomatis setelah deploy.

### 3.3 Tidak menambah wrapper ke `lib/auth.js`

`withAffiliateStudioAccess` dibuat pada file baru dan menyusun `withTenantContext` existing. Ini menghindari revisi berulang pada core auth setiap fase.

### 3.4 Registry Fase 0 tidak menjalankan engine

Connector registry hanya menyimpan descriptor/capability metadata. Registry tidak boleh mengimpor:

- `scheduler-processors.js`
- `campaign-scheduler.js`
- `re-multiplier-worker.js`
- `prompts.js`
- repository campaign legacy
- route handler legacy

Executable launch/read connectors baru ditambahkan pada Fase 5–6.

### 3.5 Next.js 16.2.5 conventions

- Gunakan App Router `route.js` di bawah `app/api`.
- Route handler bersifat dynamic karena membaca session dan database.
- Gunakan `NextResponse` dan wrapper auth server-side.
- Jangan meletakkan `route.js` dan `page.js` pada segment yang sama.
- Tidak ada Client Component pada Fase 0.

## 4. Public Contracts

### 4.1 Engine types

```text
re
pillar
recipe
multiplier
instant
product_bridge
deconstruct
```

`deconstruct` terdaftar sebagai source/intelligence capability, bukan production launcher pada Fase 0.

### 4.2 Normalized statuses

```text
planned
queued
generating
awaiting_review
producing
rendering
ready
scheduled
published
measured
failed
cancelled
```

Daftar ini hanya vocabulary projection. Fase 0 tidak memetakan atau mengubah status legacy.

### 4.3 Access modes

```text
read
write
admin
```

- `read`: user/admin dengan permission, tenant aktif, feature flag aktif.
- `write`: sama dengan read; disiapkan sebagai contract untuk fase berikutnya.
- `admin`: hanya role `admin` pada tenant aktif.

### 4.4 Foundation endpoint

`GET /api/v2/affiliate-studio/capabilities`

Response sukses:

```json
{
  "success": true,
  "data": {
    "module": "affiliate_studio",
    "phase": 0,
    "enabled": true,
    "engineTypes": ["re", "pillar", "recipe", "multiplier", "instant", "product_bridge", "deconstruct"],
    "normalizedStatuses": ["planned", "queued", "generating", "awaiting_review", "producing", "rendering", "ready", "scheduled", "published", "measured", "failed", "cancelled"],
    "connectors": []
  }
}
```

Endpoint tidak mengembalikan data brand, product, planner, campaign, atau ContentFlow.

### 4.5 Feature flag endpoint

- `GET /api/v2/affiliate-studio/feature-flags`
- `PUT /api/v2/affiliate-studio/feature-flags`

PUT body:

```json
{
  "enabled": true
}
```

PUT hanya untuk admin tenant. Endpoint feature flag memakai `withTenantContext`, bukan `withAffiliateStudioAccess`, agar admin tetap dapat mengaktifkan modul ketika flag masih `false`.

## 5. Execution Task List

- [ ] Re-read `AGENTS.md`, parent roadmap, this plan, and relevant Next.js 16.2.5 route/server-component documentation before editing.
- [ ] Add the `affiliate_studio` RBAC menu key without changing existing permission keys or migration behavior.
- [ ] Implement the Affiliate Studio contract with frozen engine types, normalized statuses, access modes, and validation helpers.
- [ ] Implement tenant feature-flag read/write helpers with default-deny parsing.
- [ ] Implement the pure access-policy evaluator and `withAffiliateStudioAccess` wrapper by composing `withTenantContext`.
- [ ] Implement the metadata-only connector registry with duplicate/type/capability validation and no legacy engine imports.
- [ ] Implement audit writing for feature-flag changes using the existing `tenant_audit_events` table.
- [ ] Add the read-only capabilities route and admin-only feature-flag GET/PUT route.
- [ ] Add contract, access, registry, flag, tenant-boundary, and forbidden-import tests.
- [ ] Run focused tests, existing auth/RBAC smoke, `git diff --check`, and production build.
- [ ] Update every completed checkbox immediately after its verification evidence is obtained.
- [ ] Confirm no legacy table, page, route, prompt, worker, scheduler, or engine repository was changed.
- [ ] Run release SOP only after all verification gates pass; verify commit, tag, branch, and remote sync.

## 6. Planned File Changes

### 6.1 `lib/schema/user-schema.js` — minimal existing-file addition

**Code Sebelum (Current/Before)**

```js
// WORKFLOW
{ key: 'youtube_studio', label: 'YouTube Studio (Long-form AI)', category: 'WORKFLOW' },
{ key: 're_campaign', label: 'RE Campaign', category: 'WORKFLOW' },
```

**Code Sesudah (Proposed/After)**

```js
// WORKFLOW
{ key: 'youtube_studio', label: 'YouTube Studio (Long-form AI)', category: 'WORKFLOW' },
{ key: 'affiliate_studio', label: 'Affiliate Studio (Brand Commerce OS)', category: 'WORKFLOW' },
{ key: 're_campaign', label: 'RE Campaign', category: 'WORKFLOW' },
```

Ketentuan:

- Jangan mengubah atau mengurutkan ulang key existing.
- Jangan memberikan permission otomatis kepada regular user.
- Admin mendapatkan key melalui behavior `ALL_MENU_KEYS` existing.
- Menu Sidebar baru ditunda ke Fase 1.

### 6.2 `lib/affiliate-studio-contract.js` — new

**Code Sebelum (Current/Before)**

```js
// Affiliate Studio domain contract does not exist.
```

**Code Sesudah (Proposed/After)**

```js
export const AFFILIATE_STUDIO_PERMISSION = 'affiliate_studio';

export const AFFILIATE_ENGINE_TYPES = Object.freeze([
  're', 'pillar', 'recipe', 'multiplier',
  'instant', 'product_bridge', 'deconstruct'
]);

export const AFFILIATE_NORMALIZED_STATUSES = Object.freeze([
  'planned', 'queued', 'generating', 'awaiting_review',
  'producing', 'rendering', 'ready', 'scheduled',
  'published', 'measured', 'failed', 'cancelled'
]);

export const AFFILIATE_ACCESS_MODES = Object.freeze(['read', 'write', 'admin']);

export function assertAffiliateEngineType(value) {}
export function assertAffiliateAccessMode(value) {}
export function buildAffiliateStudioCapabilities(connectors = []) {}
```

Ketentuan:

- Arrays harus frozen dan hasil capability tidak boleh mengekspos mutable internal registry state.
- Unknown engine type/access mode harus menghasilkan typed error dengan `code` dan `status=400`.
- Jangan menambahkan status-transition engine pada Fase 0.

### 6.3 `lib/affiliate-studio-feature-flags.js` — new

**Code Sebelum (Current/Before)**

```js
// Affiliate Studio feature flag helpers do not exist.
```

**Code Sesudah (Proposed/After)**

```js
import { pgQuery } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';

export const AFFILIATE_STUDIO_FLAG_KEY = 'affiliate_studio_enabled';

export function parseAffiliateStudioFlag(value) {
  return String(value).toLowerCase() === 'true';
}

export async function getAffiliateStudioFlags(tenantId = getActiveTenantId()) {}
export async function saveAffiliateStudioFlags(input, user) {}
```

Ketentuan:

- Validate tenant ID and reject `__none__`.
- Missing row, `null`, empty string, atau value selain literal `true` efektif `false`.
- PUT hanya menerima boolean; string `"true"` dari request body ditolak agar tidak ada coercion ambigu.
- Upsert hanya ke `tenant_settings`; jangan menambah kolom `tenants`.

### 6.4 `lib/affiliate-studio-access.js` — new

**Code Sebelum (Current/Before)**

```js
// Affiliate Studio-specific access policy does not exist.
```

**Code Sesudah (Proposed/After)**

```js
import { withTenantContext } from './auth.js';
import { getAffiliateStudioFlags } from './affiliate-studio-feature-flags.js';
import {
  AFFILIATE_STUDIO_PERMISSION,
  assertAffiliateAccessMode
} from './affiliate-studio-contract.js';

export function evaluateAffiliateStudioAccess({ user, flags, mode }) {}

export function withAffiliateStudioAccess(mode, handler) {
  assertAffiliateAccessMode(mode);
  return withTenantContext(async (request, context, user) => {
    const flags = await getAffiliateStudioFlags(user.tenantId);
    const decision = evaluateAffiliateStudioAccess({ user, flags, mode });
    if (!decision.allowed) return Response.json(
      { success: false, error: decision.message, code: decision.code },
      { status: decision.status }
    );
    return handler(request, context, user, { flags });
  });
}
```

Ketentuan:

- Pure evaluator harus dapat diuji tanpa database/session.
- Evaluation order harus deterministic: disabled menu → missing permission → feature disabled → admin role.
- Jangan menambah atau mengubah `withYouTubeStudioAccess`.
- Jangan mengizinkan caller mengirim tenant ID.

### 6.5 `lib/affiliate-studio-connector-registry.js` — new

**Code Sebelum (Current/Before)**

```js
// Affiliate Studio connector registry does not exist.
```

**Code Sesudah (Proposed/After)**

```js
import { assertAffiliateEngineType } from './affiliate-studio-contract.js';

const descriptors = new Map();

export function registerAffiliateConnectorDescriptor(descriptor) {}
export function listAffiliateConnectorDescriptors() {}
export function resetAffiliateConnectorRegistryForTests() {}
```

Descriptor Fase 0:

```json
{
  "engineType": "pillar",
  "label": "Pillar Campaign",
  "capabilities": ["read", "launch"],
  "phase": 6
}
```

Ketentuan:

- Registry production mulai kosong.
- Descriptor tidak boleh membawa function handler, repository, worker, atau route.
- Duplicate `engineType` ditolak.
- Capability allowlist Fase 0: `read`, `launch`, `status`, `deep_link`, `source`.
- Test-only reset tidak dipanggil oleh runtime application code.

### 6.6 `lib/affiliate-studio-audit.js` — new

**Code Sebelum (Current/Before)**

```js
// Affiliate Studio audit helper does not exist.
```

**Code Sesudah (Proposed/After)**

```js
import { pgQuery } from './db-pg.js';

export async function recordAffiliateStudioAuditEvent({
  tenantId, actorUserId, eventType, event
}) {
  return pgQuery(
    `INSERT INTO tenant_audit_events
      (actor_user_id, tenant_id, event_type, event_json)
     VALUES ($1, $2, $3, $4)`,
    [actorUserId, tenantId, eventType, JSON.stringify(event || {})]
  );
}
```

Ketentuan:

- Gunakan tabel audit existing; tidak membuat schema baru.
- Jangan pernah menyimpan session token, API key, credential, atau raw request headers.
- Event flag: `affiliate_studio.feature_flag_updated`.

### 6.7 `app/api/v2/affiliate-studio/capabilities/route.js` — new

**Code Sebelum (Current/Before)**

```js
// Affiliate Studio capabilities route does not exist.
```

**Code Sesudah (Proposed/After)**

```js
import { NextResponse } from 'next/server';
import { withAffiliateStudioAccess } from '@/lib/affiliate-studio-access';
import { buildAffiliateStudioCapabilities } from '@/lib/affiliate-studio-contract';
import { listAffiliateConnectorDescriptors } from '@/lib/affiliate-studio-connector-registry';

export const dynamic = 'force-dynamic';

export const GET = withAffiliateStudioAccess('read', async () =>
  NextResponse.json({
    success: true,
    data: buildAffiliateStudioCapabilities(listAffiliateConnectorDescriptors())
  })
);
```

Ketentuan:

- GET only.
- No brand/product/planner/campaign query.
- Response tidak menyertakan internal paths atau stack traces.

### 6.8 `app/api/v2/affiliate-studio/feature-flags/route.js` — new

**Code Sebelum (Current/Before)**

```js
// Affiliate Studio feature flag route does not exist.
```

**Code Sesudah (Proposed/After)**

```js
import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import {
  getAffiliateStudioFlags,
  saveAffiliateStudioFlags
} from '@/lib/affiliate-studio-feature-flags';
import { recordAffiliateStudioAuditEvent } from '@/lib/affiliate-studio-audit';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (_request, _context, user) => {});
export const PUT = withTenantContext(async (request, _context, user) => {});
```

Ketentuan:

- GET dan PUT hanya role `admin`.
- PUT validates exact `{ enabled: boolean }` shape; unknown keys ditolak.
- Capture `previous` dan `current` pada audit event.
- Endpoint tetap dapat dipakai ketika flag saat ini `false`.

### 6.9 `tests/affiliate-studio-foundation.test.js` — new

**Code Sebelum (Current/Before)**

```js
// Affiliate Studio foundation tests do not exist.
```

**Code Sesudah (Proposed/After)**

```js
import test from 'node:test';
import assert from 'node:assert/strict';

test('feature flag is default-deny', () => {});
test('access requires permission, tenant enablement, and non-disabled menu', () => {});
test('admin access mode rejects regular users', () => {});
test('connector registry rejects duplicate and unknown engines', () => {});
test('capabilities return immutable copies and an empty phase-0 registry', () => {});
```

Ketentuan:

- Unit tests tidak membutuhkan production credential atau network.
- Test pure functions before route-level smoke.
- Reset registry after every test that mutates it.

### 6.10 `tests/affiliate-studio-boundary.test.js` — new

**Code Sebelum (Current/Before)**

```js
// Additive-only boundary regression test does not exist.
```

**Code Sesudah (Proposed/After)**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('phase-0 foundation does not import legacy execution internals', () => {
  const forbidden = [
    'scheduler-processors', 'campaign-scheduler',
    're-multiplier-worker', './prompts'
  ];
  // Scan only Affiliate Studio foundation runtime files.
});
```

Ketentuan:

- Scan explicit file allowlist; jangan scan seluruh repository.
- Test harus gagal jika foundation mengimpor worker/prompt/scheduler legacy.
- Test tidak melarang import shared auth, tenant context, dan PostgreSQL adapter.

### 6.11 `sot/menus/affiliate-studio/phase-00-foundation-implementation-plan.md` — this file

**Code Sebelum (Current/Before)**

```md
<!-- Fase 0 implementation plan does not exist. -->
```

**Code Sesudah (Proposed/After)**

```md
## 5. Execution Task List
- [ ] ...
```

Update checkbox hanya setelah task terkait selesai dan bukti verifikasinya tersedia. Bila implementasi membutuhkan file di luar daftar ini, tambahkan file tersebut beserta Code Sebelum/Code Sesudah **sebelum** mengeditnya.

## 7. Explicit No-Change List

File/directory berikut tidak boleh diubah pada Fase 0:

```text
app/components/Sidebar.js
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
lib/prompts.js
lib/scheduler-processors.js
lib/campaign-scheduler.js
lib/re-multiplier-worker.js
lib/content-planner-*.js
lib/contentflow-*.js
lib/product-*.js
lib/brand-product-repository.js
lib/affiliate-resolver.js
lib/db.js
lib/db-pg.js
```

Pengecualian hanya jika build menemukan bug existing yang menghalangi verifikasi; hentikan scope Affiliate Studio, dokumentasikan blocker, dan minta keputusan user. Jangan memperbaikinya diam-diam di fase ini.

## 8. Test Matrix

| Area | Skenario | Expected |
|---|---|---|
| Contract | Engine type valid | Accepted |
| Contract | Engine type unknown | 400 typed error |
| Contract | Access mode unknown | 400 typed error |
| Feature flag | Setting missing | `enabled=false` |
| Feature flag | Literal `true` | `enabled=true` |
| Feature flag | String body instead of boolean | 400 |
| Access | Unauthenticated | 401 from existing wrapper |
| Access | Superadmin operational request | 403 from existing wrapper |
| Access | Tenant menu disabled | 403 |
| Access | User permission missing | 403 |
| Access | Feature flag disabled | 403 |
| Access | All read gates pass | Allowed |
| Access | Regular user requests admin mode | 403 |
| Registry | Empty boot registry | `[]` |
| Registry | Duplicate engine descriptor | Rejected |
| Registry | Function/handler in descriptor | Rejected |
| API | Capabilities while disabled | 403 |
| API | Capabilities while enabled | 200, no operational data |
| API | Feature flag PUT by regular user | 403 |
| API | Feature flag PUT by admin | 200 + audit event |
| Boundary | Forbidden legacy import | Test fails |

## 9. Verification Commands

### 9.1 Focused unit tests

```bash
node --test tests/affiliate-studio-foundation.test.js tests/affiliate-studio-boundary.test.js
```

### 9.2 Existing RBAC regression

```bash
node scripts/test-auth-rbac.js
```

### 9.3 Static and build verification

```bash
git diff --check
npm run build
```

### 9.4 Optional Dev-only API smoke

Setelah build lulus dan hanya bila environment Dev tersedia:

```bash
npm run deploy:macmini-dev
```

Verifikasi pada Dev UI port `5020` dan API port `7020`. Jangan deploy Staging atau Production. Selama remote build, jangan menjalankan polling SSH loop; ikuti SOP timer dua menit.

## 10. Acceptance Criteria

1. `affiliate_studio` muncul pada katalog permission tanpa mengubah key existing.
2. Tenant tanpa setting Affiliate Studio tetap disabled.
3. Admin tenant dapat membaca dan mengubah feature flag serta menghasilkan audit event.
4. User hanya dapat membaca capabilities apabila auth, tenant, permission, disabled-menu, dan flag gate lulus.
5. Superadmin tidak memperoleh operational tenant context.
6. Capability response hanya berisi kontrak Fase 0 dan registry kosong.
7. Registry menolak unknown engine, duplicate descriptor, dan executable handler.
8. Tidak ada import dari Affiliate Studio foundation menuju engine worker/prompt/scheduler legacy.
9. Tidak ada perubahan pada file Explicit No-Change List.
10. Focused tests, RBAC regression, `git diff --check`, dan production build lulus.
11. Feature flag dapat dikembalikan ke `false` tanpa memengaruhi modul legacy.
12. Fase 1 dapat membangun shell hanya dengan memakai access/capability contract Fase 0.

## 11. Rollback Strategy

Rollback operasional utama:

1. Set `affiliate_studio_enabled=false` untuk tenant.
2. Karena Fase 0 belum mempunyai UI/menu, tidak ada route page yang perlu dialihkan.
3. Endpoint capabilities otomatis menolak akses ketika flag false.
4. Permission key yang belum diberikan kepada user tidak memberi efek pada menu existing.
5. File foundation dapat direvert tanpa rollback database karena hanya menggunakan `tenant_settings` dan `tenant_audit_events` existing.

Tidak diperlukan drop table, data migration reversal, atau perubahan engine.

## 12. Release SOP

Setelah seluruh checklist dan verification gate lulus:

```bash
npm run release-non-interactive -- --type patch --title "Affiliate Studio Foundation" --points "Tambah kontrak dan boundary additive-only Affiliate Studio|Tambah permission dan tenant feature flag default-deny|Tambah capability API registry kosong dan regression tests"
```

Setelah command selesai, verifikasi:

- version dan changelog terbarui;
- release commit tercipta;
- tag `vX.Y.Z` tersedia;
- branch `main` dan tag terunggah ke `https://github.com/sabeq83/maknaflow.git`;
- working tree hanya menyisakan perubahan user yang sudah ada sebelum tugas.

## 13. Handoff ke Fase 1

Fase 1 hanya boleh dimulai setelah Fase 0 dirilis dan kontrak aktual dicatat. Fase 1 menggunakan:

- `withAffiliateStudioAccess('read', ...)`
- `buildAffiliateStudioCapabilities(...)`
- `affiliate_studio_enabled`
- permission `affiliate_studio`

Fase 1 tidak boleh mengubah kembali vocabulary engine/status/access kecuali ditemukan kontradiksi yang dibuktikan oleh test. Perubahan kontrak harus dibuat backward-compatible.

