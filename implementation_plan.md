# Implementation Plan - Hardening Tenant Settings Cache Resilience & Multi-Node Deployment

Memperbaiki keandalan in-memory cache database settings (`lib/db.js`) agar memiliki auto-retry background saat startup dan on-demand lazy load saat endpoint `/api/settings` diakses, kemudian melakukan rilis versi dan deployment atomic ke Dev & Staging di Mac Mini.

## Proposed Changes

### 1. `lib/db.js`
- Menambahkan continuous auto-retry pada startup inisialisasi `loadDbCaches()` jika koneksi awal PostgreSQL mengalami temporary network lag (misal Tailscale handshake).
- Menambahkan `ensureDbCachesLoaded()` agar endpoint async dapat menunggu inisialisasi cache selesai jika belum loaded.
- Memperbarui `getSetting` untuk memicu refresh background jika cache belum terisi.

### 2. `app/api/settings/route.js`
- Menambahkan pemanggilan `ensureDbCachesLoaded()` sebelum membaca setting agar selalu terjamin data database terbaru yang dikembalikan ke browser.

### 3. Release & Atomic Deployment (Dev & Staging)
- Menguji build lokal.
- Menjalankan perintah rilis non-interaktif sesuai SOP.
- Menjalankan deployment atomic ke Mac Mini Dev (Port 5020 & 7020).
- Menjalankan deployment atomic ke Mac Mini Staging (Port 5010 & 7010).
- Memverifikasi HTTP 200, status PM2, dan ketersediaan data Repliz Key di Staging UI.

---

## Code Before & After

### `lib/db.js`

#### Code Sebelum (Current/Before)
```javascript
export let cachesLoaded = false;

export async function loadDbCaches() {
  try {
    // 0. Initialize and migrate User & Permission tables
    await initUserTables(db);

    // 1. Load tenant_settings
    const settings = await dbAll('SELECT tenant_id, setting_key, setting_value FROM tenant_settings', []);
    for (const s of settings) {
      if (!tenantSettingsCache[s.tenant_id]) {
        tenantSettingsCache[s.tenant_id] = {};
      }
      tenantSettingsCache[s.tenant_id][s.setting_key] = s.setting_value;
    }
    // Align settingsCache with default_tenant for backward compatibility
    const defaultSettings = tenantSettingsCache['default_tenant'] || {};
    for (const [k, v] of Object.entries(defaultSettings)) {
      settingsCache[k] = v;
    }
    const { hydrateOperatorPresetCache } = await import('./operator-presets.js');
    for (const [tenantId, values] of Object.entries(tenantSettingsCache)) {
      hydrateOperatorPresetCache(tenantId, values.operator_presets_json || '{}');
    }

    // 2. Load brand_profiles
    const brands = await dbAll('SELECT id, brand_name, tenant_id, nextcloud_parent_folder FROM brand_profiles', []);
    for (const b of brands) {
      const tid = b.tenant_id || 'default_tenant';
      if (b.brand_name) {
        if (!brandProfilesCache[tid]) brandProfilesCache[tid] = {};
        if (!brandProfilesCacheById[tid]) brandProfilesCacheById[tid] = {};
        brandProfilesCache[tid][b.brand_name.toLowerCase()] = b.nextcloud_parent_folder;
        brandProfilesCacheById[tid][b.id] = b.brand_name;
      }
    }

    // 3. Load task routes
    const routes = await dbAll('SELECT task_id, host, port, api_key FROM glabs_task_routes', []);
    for (const r of routes) {
      glabsTaskRoutesCache[r.task_id] = { host: r.host, port: r.port, api_key: r.api_key };
    }
    cachesLoaded = true;
    console.log('[PostgreSQL Cache] Multi-tenant Settings, brand profiles, and task routes cached successfully.');
  } catch (e) {
    console.warn('[PostgreSQL Cache Warning] Failed to load database caches:', e.message);
  }
}

// Automatically load caches at boot unless disabled for testing
if (process.env.DISABLE_STARTUP_DB_CACHES !== 'true') {
  setTimeout(() => {
    loadDbCaches().catch(err => console.error('Failed to load DB caches at startup:', err));
  }, 500);
}
```

#### Code Sesudah (Proposed/After)
```javascript
export let cachesLoaded = false;
let loadDbCachesPromise = null;

export async function loadDbCaches() {
  try {
    // 0. Initialize and migrate User & Permission tables
    await initUserTables(db);

    // 1. Load tenant_settings
    const settings = await dbAll('SELECT tenant_id, setting_key, setting_value FROM tenant_settings', []);
    for (const s of settings) {
      if (!tenantSettingsCache[s.tenant_id]) {
        tenantSettingsCache[s.tenant_id] = {};
      }
      tenantSettingsCache[s.tenant_id][s.setting_key] = s.setting_value;
    }
    // Align settingsCache with default_tenant for backward compatibility
    const defaultSettings = tenantSettingsCache['default_tenant'] || {};
    for (const [k, v] of Object.entries(defaultSettings)) {
      settingsCache[k] = v;
    }
    const { hydrateOperatorPresetCache } = await import('./operator-presets.js');
    for (const [tenantId, values] of Object.entries(tenantSettingsCache)) {
      hydrateOperatorPresetCache(tenantId, values.operator_presets_json || '{}');
    }

    // 2. Load brand_profiles
    const brands = await dbAll('SELECT id, brand_name, tenant_id, nextcloud_parent_folder FROM brand_profiles', []);
    for (const b of brands) {
      const tid = b.tenant_id || 'default_tenant';
      if (b.brand_name) {
        if (!brandProfilesCache[tid]) brandProfilesCache[tid] = {};
        if (!brandProfilesCacheById[tid]) brandProfilesCacheById[tid] = {};
        brandProfilesCache[tid][b.brand_name.toLowerCase()] = b.nextcloud_parent_folder;
        brandProfilesCacheById[tid][b.id] = b.brand_name;
      }
    }

    // 3. Load task routes
    const routes = await dbAll('SELECT task_id, host, port, api_key FROM glabs_task_routes', []);
    for (const r of routes) {
      glabsTaskRoutesCache[r.task_id] = { host: r.host, port: r.port, api_key: r.api_key };
    }
    cachesLoaded = true;
    console.log('[PostgreSQL Cache] Multi-tenant Settings, brand profiles, and task routes cached successfully.');
  } catch (e) {
    console.warn('[PostgreSQL Cache Warning] Failed to load database caches:', e.message);
    throw e;
  }
}

export async function ensureDbCachesLoaded() {
  if (cachesLoaded) return;
  if (!loadDbCachesPromise) {
    loadDbCachesPromise = loadDbCaches().catch(err => {
      loadDbCachesPromise = null;
      throw err;
    });
  }
  return loadDbCachesPromise;
}

// Automatically load caches at boot with auto-retry resilience
if (process.env.DISABLE_STARTUP_DB_CACHES !== 'true') {
  let retryCount = 0;
  const scheduleStartupCacheLoad = (delayMs = 500) => {
    setTimeout(async () => {
      try {
        await loadDbCaches();
      } catch (err) {
        retryCount++;
        const nextDelay = Math.min(30000, 2000 * Math.pow(1.5, Math.min(retryCount, 6)));
        console.warn(`[PostgreSQL Cache] Retrying cache load in ${Math.round(nextDelay / 1000)}s (attempt ${retryCount})...`);
        scheduleStartupCacheLoad(nextDelay);
      }
    }, delayMs);
  };
  scheduleStartupCacheLoad(500);
}
```

---

### `app/api/settings/route.js`

#### Code Sebelum (Current/Before)
```javascript
export const GET = withTenantContext(async (request, _context, user) => {
  try {
    if (user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Hanya Admin tenant yang dapat mengelola credential.' }, { status: 403 });
    }
    const tenantId = user.tenantId || user.tenant_id || 'default_tenant';
    const apiKey = await getSetting('gemini_api_key', false);
```

#### Code Sesudah (Proposed/After)
```javascript
export const GET = withTenantContext(async (request, _context, user) => {
  try {
    if (user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Hanya Admin tenant yang dapat mengelola credential.' }, { status: 403 });
    }
    const { ensureDbCachesLoaded } = await import('@/lib/db');
    await ensureDbCachesLoaded().catch(() => {});
    const tenantId = user.tenantId || user.tenant_id || 'default_tenant';
    const apiKey = await getSetting('gemini_api_key', false);
```

---

## Execution Task List
- [x] Task 1: Terapkan patch resilience auto-retry & `ensureDbCachesLoaded` pada `lib/db.js` & `app/api/settings/route.js`
- [x] Task 2: Verifikasi build lokal dan jalankan pengujian unit
- [ ] Task 3: Eksekusi rilis non-interaktif sesuai SOP (`npm run release-non-interactive`)
- [ ] Task 4: Deploy atomic ke Mac Mini Dev Server & verifikasi
- [ ] Task 5: Deploy atomic ke Mac Mini Staging Server & verifikasi UI/API Settings
