# Implementation Plan - Perbaikan Tenant Context Multiplier Blueprint

Dokumen ini menganalisis akar masalah kegagalan pembuatan kampanye Multiplier di server Staging untuk tenant `syd_admin` dengan blueprint `1c669d76-b009-4d9a-930a-64c3060e944e` dan menyusun rencana perbaikan komprehensif.

## 1. Analisis Akar Masalah (Root Cause Analysis)

### 1.1 Temuan & Verifikasi Database Staging
1. **User `syd_admin`**:
   - Berada di database PostgreSQL Staging (schema `staging`).
   - Memiliki `tenant_id = 'tnt_sy-dodot_4ba27b'`.
2. **Asset Blueprint `1c669d76-b009-4d9a-930a-64c3060e944e`**:
   - Ada di tabel `re_deconstructed_assets` dengan `tenant_id = 'tnt_sy-dodot_4ba27b'`.
   - URL Sumber: `https://www.facebook.com/reel/1326723122877496/`.
   - Status: Deconstructed.
3. **Mengapa Muncul di Dropdown UI?**:
   - Dropdown blueprint memanggil `GET /api/v2/deconstruct?assets=true`.
   - Endpoint `/api/v2/deconstruct` dibungkus dengan `withTenantContext`, sehingga filter `tenant_id = 'tnt_sy-dodot_4ba27b'` terpasang dengan benar dan asset berhasil dimuat di UI dengan label `"Blueprint s/d 1c669d76-b009-4d9a-930a-64c3060e944e"`.
4. **Titik Kegagalan (The Failure Point)**:
   - Ketika pengguna memilih blueprint ini dan menekan tombol **"⚡ Generate Sudut Pandang AI"** (atau membuat kampanye), frontend memanggil `POST /api/v2/multiplier/generate-angles`.
   - File `app/api/v2/multiplier/generate-angles/route.js` **BELUM DIBUNGKUS** oleh `withTenantContext`.
   - Akibatnya, `tenantContext.getStore()` mengembalikan `undefined`, dan `getActiveTenantId()` jatuh ke fallback `'default_tenant'`.
   - Database interceptor di `lib/db.js` (`interceptQuery`) melihat tabel `re_deconstructed_assets` masuk dalam `isolatedTables` dan secara otomatis menginjeksi klausa:
     ```sql
     AND tenant_id = 'default_tenant'
     ```
   - Hasil query PostgreSQL:
     ```sql
     SELECT id, source_url, ... FROM re_deconstructed_assets WHERE id = '1c669d76-b009-4d9a-930a-64c3060e944e' AND tenant_id = 'default_tenant'
     ```
     mengembalikan `0 baris (kosong)`.
   - Pada `lib/multiplier-angle-generator.js:262`, kondisi `if (blueprintDataList.length === 0)` terpenuhi dan melempar error:
     ```
     Blueprint referensi tidak ditemukan. Pastikan blueprintId valid.
     ```
   - Telah dibuktikan secara empiris: saat dieksekusi dengan `tenantContext = 'default_tenant'`, query mengembalikan `NOT FOUND`. Sedangkan saat dieksekusi dengan `tenantContext = 'tnt_sy-dodot_4ba27b'`, query mengembalikan data blueprint secara sempurna.

---

## 2. Proposed Changes & Code Snippets (Before & After)

### File 1: `app/api/v2/multiplier/generate-angles/route.js`

#### Code Sebelum (Current/Before)
```javascript
import { NextResponse } from 'next/server';
import { 
  generateDynamicMultiplierAngles, 
  getAvailableNicheKBs, 
  getExcludedAnglesHistory 
} from '@/lib/multiplier-angle-generator';
import { getActiveTenantId } from '@/lib/tenant-context';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const blueprintId = searchParams.get('blueprintId');

    const nicheKBs = getAvailableNicheKBs();
    let excludedHistory = [];
    if (blueprintId) {
      excludedHistory = await getExcludedAnglesHistory(blueprintId);
    }

    return NextResponse.json({
      success: true,
      niche_kbs: nicheKBs,
      excluded_history: excludedHistory
    });
  } catch (error) {
    console.error('[API Multiplier Generate Angles GET Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const tenantId = getActiveTenantId();

    const {
      blueprint_id,
      blueprint_ids,
      mode,
      niche_kb_name,
      angle_count,
      custom_theme
    } = body;

    const angles = await generateDynamicMultiplierAngles({
      blueprintId: blueprint_id,
      blueprintIds: blueprint_ids,
      mode: mode || '1_to_multi',
      nicheKbName: niche_kb_name || null,
      angleCount: angle_count || 5,
      customTheme: custom_theme || '',
      tenantId
    });

    return NextResponse.json({
      success: true,
      angles,
      count: angles.length
    });
  } catch (error) {
    console.error('[API Multiplier Generate Angles POST Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

#### Code Sesudah (Proposed/After)
```javascript
import { NextResponse } from 'next/server';
import { 
  generateDynamicMultiplierAngles, 
  getAvailableNicheKBs, 
  getExcludedAnglesHistory 
} from '@/lib/multiplier-angle-generator';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';

export const GET = withTenantContext(async (req, context, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const blueprintId = searchParams.get('blueprintId');
    const tenantId = user?.tenant_id || getActiveTenantId();

    const nicheKBs = getAvailableNicheKBs();
    let excludedHistory = [];
    if (blueprintId) {
      excludedHistory = await getExcludedAnglesHistory(blueprintId, tenantId);
    }

    return NextResponse.json({
      success: true,
      niche_kbs: nicheKBs,
      excluded_history: excludedHistory
    });
  } catch (error) {
    console.error('[API Multiplier Generate Angles GET Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const POST = withTenantContext(async (req, context, user) => {
  try {
    const body = await req.json();
    const tenantId = user?.tenant_id || getActiveTenantId();

    const {
      blueprint_id,
      blueprint_ids,
      mode,
      niche_kb_name,
      angle_count,
      custom_theme
    } = body;

    const angles = await generateDynamicMultiplierAngles({
      blueprintId: blueprint_id,
      blueprintIds: blueprint_ids,
      mode: mode || '1_to_multi',
      nicheKbName: niche_kb_name || null,
      angleCount: angle_count || 5,
      customTheme: custom_theme || '',
      tenantId
    });

    return NextResponse.json({
      success: true,
      angles,
      count: angles.length
    });
  } catch (error) {
    console.error('[API Multiplier Generate Angles POST Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
```

---

### File 2: `lib/multiplier-angle-generator.js`

#### Code Sebelum (Current/Before)
```javascript
export async function getExcludedAnglesHistory(blueprintId) {
  if (!blueprintId) return [];
  const db = getDb();
  try {
    let rows = [];
    try {
      rows = await db.prepare(
        `SELECT bridging_config_json, new_caption, remake_storyboard_json 
         FROM re_multiplier_tasks 
         WHERE deconstruct_asset_id = ? 
         ORDER BY created_at DESC LIMIT 30`
      ).all(blueprintId);
...

export async function generateDynamicMultiplierAngles({
  blueprintId,
  blueprintIds = [],
  mode = '1_to_multi', // '1_to_multi' | 'multi_to_1'
  nicheKbName = null, // dynamic fallback to detected Blueprint anchor KB if null
  angleCount = 5,
  customTheme = '',
  tenantId = 'default_tenant'
}) {
  const db = getDb();
  const kbDir = path.join(process.cwd(), 'kb');
...
  let blueprintDataList = [];
  if (mode === 'multi_to_1' && blueprintIds && blueprintIds.length > 0) {
    const placeholders = blueprintIds.map(() => '?').join(',');
    blueprintDataList = await db.prepare(
      `SELECT id, source_url, source_url AS original_video_url, original_storyboard_json, viral_pattern_summary, original_caption, core_problem, core_solution, target_audience_pain_point, created_at 
       FROM re_deconstructed_assets WHERE id IN (${placeholders})`
    ).all(...blueprintIds);
  } else if (blueprintId) {
    const bp = await db.prepare(
      `SELECT id, source_url, source_url AS original_video_url, original_storyboard_json, viral_pattern_summary, original_caption, core_problem, core_solution, target_audience_pain_point, created_at 
       FROM re_deconstructed_assets WHERE id = ?`
    ).get(blueprintId);
    if (bp) blueprintDataList = [bp];
  }

  if (blueprintDataList.length === 0) {
    throw new Error('Blueprint referensi tidak ditemukan. Pastikan blueprintId valid.');
  }
```

#### Code Sesudah (Proposed/After)
```javascript
import { tenantContext, getActiveTenantId } from './tenant-context.js';

function sanitizeBlueprintId(id) {
  if (!id || typeof id !== 'string') return id;
  const match = id.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return match ? match[0] : id.trim();
}

export async function getExcludedAnglesHistory(blueprintId, tenantId) {
  const cleanId = sanitizeBlueprintId(blueprintId);
  if (!cleanId) return [];
  const effectiveTenantId = tenantId || getActiveTenantId();

  return tenantContext.run(effectiveTenantId, async () => {
    const db = getDb();
    try {
      let rows = [];
      try {
        rows = await db.prepare(
          `SELECT bridging_config_json, new_caption, remake_storyboard_json 
           FROM re_multiplier_tasks 
           WHERE deconstruct_asset_id = ? 
           ORDER BY created_at DESC LIMIT 30`
        ).all(cleanId);
...

export async function generateDynamicMultiplierAngles({
  blueprintId,
  blueprintIds = [],
  mode = '1_to_multi',
  nicheKbName = null,
  angleCount = 5,
  customTheme = '',
  tenantId = 'default_tenant'
}) {
  const effectiveTenantId = tenantId || getActiveTenantId();

  return tenantContext.run(effectiveTenantId, async () => {
    const db = getDb();
    const kbDir = path.join(process.cwd(), 'kb');

    const cleanBpId = sanitizeBlueprintId(blueprintId);
    const cleanBpIds = (blueprintIds || []).map(sanitizeBlueprintId).filter(Boolean);

    // 2. Fetch Blueprint Assets Data First
    let blueprintDataList = [];
    if (mode === 'multi_to_1' && cleanBpIds.length > 0) {
      const placeholders = cleanBpIds.map(() => '?').join(',');
      blueprintDataList = await db.prepare(
        `SELECT id, source_url, source_url AS original_video_url, original_storyboard_json, viral_pattern_summary, original_caption, core_problem, core_solution, target_audience_pain_point, created_at 
         FROM re_deconstructed_assets WHERE id IN (${placeholders})`
      ).all(...cleanBpIds);
    } else if (cleanBpId) {
      const bp = await db.prepare(
        `SELECT id, source_url, source_url AS original_video_url, original_storyboard_json, viral_pattern_summary, original_caption, core_problem, core_solution, target_audience_pain_point, created_at 
         FROM re_deconstructed_assets WHERE id = ?`
      ).get(cleanBpId);
      if (bp) blueprintDataList = [bp];
    }

    if (blueprintDataList.length === 0) {
      throw new Error('Blueprint referensi tidak ditemukan. Pastikan blueprintId valid.');
    }
...
```

---

## 3. Execution Task List

- [x] **Task 1**: Update `app/api/v2/multiplier/generate-angles/route.js` untuk membungkus `GET` dan `POST` dengan `withTenantContext`.
- [x] **Task 2**: Update `lib/multiplier-angle-generator.js` dengan isolasi `tenantContext.run` dan sanitasi ID regex defensif.
- [x] **Task 3**: Jalankan automated test suite `tests/multiplier-angle-generator.test.js` untuk memverifikasi tidak ada regresi fungsional.
- [x] **Task 4**: Lakukan rilis non-interaktif dan deploy ke server Staging sesuai SOP Mac Mini Atomic Deployment.
- [x] **Task 5**: Konfirmasi hasil pengujian di staging.
