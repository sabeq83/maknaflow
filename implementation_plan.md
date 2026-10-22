# Implementation Plan: Fix Missing `tenant_id` on Recipe Campaigns & Items

Rencana perbaikan ini mengatasi error log server staging:
`[PostgreSQL Query Error] column "tenant_id" does not exist SQL: SELECT tenant_id FROM recipe_campaigns WHERE id = $1`
`[Campaign Scheduler] Error fetching tenantId for runStep: column "tenant_id" does not exist`

### Akar Masalah (Root Cause):
Tabel `recipe_campaigns` dan `recipe_items` di seluruh schema PostgreSQL (`public`, `staging`, `dev`) belum memiliki kolom `tenant_id`. Saat background `campaign-scheduler` menjalankan step kampanye resep, scheduler mengeksekusi query `SELECT tenant_id FROM recipe_campaigns WHERE id = ?` yang memicu error fatal pada PostgreSQL dan mengotori system logs.

---

## 📋 Execution Task List

- [x] **Task 1: Eksekusi Migrasi DDL PostgreSQL pada Schema `public`, `staging`, dan `dev`**
  - [x] Tambahkan kolom `tenant_id TEXT DEFAULT 'default_tenant'` pada `recipe_campaigns` dan `recipe_items` di seluruh schema aktif.
  - [x] Buat index performa `idx_recipe_campaigns_tenant` dan `idx_recipe_items_tenant`.

- [x] **Task 2: Penambahan Auto-Migration pada `lib/db-pg.js`**
  - [x] Daftarkan script auto-migration `ALTER TABLE recipe_campaigns ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default_tenant'` dan `recipe_items`.

- [x] **Task 3: Perbaikan Query dan Persistensi Tenant pada `lib/db.js`**
  - [x] Perbarui `createRecipeCampaign` agar menyertakan kolom `tenant_id` (fallback `'default_tenant'`).
  - [x] Perbarui `createRecipeItem` agar menyertakan kolom `tenant_id` (fallback `'default_tenant'`).
  - [x] Perbarui `getRecipeCampaigns` agar mendukung tenant-scoping dengan fallback `'default_tenant'`.

- [x] **Task 4: Integrasi Tenant Context pada `app/api/recipe-labs/route.js`**
  - [x] Teruskan `tenantId` dari `getActiveTenantId()` saat pembuatan kampanye baru dan pembuatan recipe items.

- [x] **Task 5: Defensive Query Handling pada `lib/campaign-scheduler.js`**
  - [x] Bungkus pemanggilan `SELECT tenant_id FROM recipe_campaigns` dalam blok try-catch dengan fallback `'default_tenant'` agar scheduler kebal terhadap replika lag atau anomali skema.

- [x] **Task 6: Uji Verifikasi Database & Query**
  - [x] Jalankan query verifikasi langsung ke database PostgreSQL untuk memastikan kolom `tenant_id` telah aktif dan query scheduler berjalan tanpa error.

- [ ] **Task 7: Build, Rilis Non-Interaktif & Deployment Mac Mini Dev & Staging**
  - [ ] Verifikasi `npm run build` bebas error.
  - [ ] Jalankan `npm run release-non-interactive` sesuai SOP.
  - [ ] Deploy ke server dev Mac Mini (`npm run deploy:dev:atomic`).
  - [ ] Deploy ke server staging Mac Mini (`npm run deploy:staging`).

---

## 🔍 Before & After Code Snippets

### 1. `lib/db-pg.js` — Auto-Migration `tenant_id` untuk Recipe Tables

#### Code Sebelum (Current/Before):
```javascript
// lib/db-pg.js:L279-L293
    pool.query(`
      ALTER TABLE pillar_campaigns
        ADD COLUMN IF NOT EXISTS target_demographic TEXT,
        ADD COLUMN IF NOT EXISTS target_demographic_custom TEXT,
        ADD COLUMN IF NOT EXISTS clip_duration INTEGER DEFAULT 8;
      ALTER TABLE re_campaigns
        ADD COLUMN IF NOT EXISTS clip_duration INTEGER DEFAULT 8;
      ALTER TABLE sheets_campaigns
        ADD COLUMN IF NOT EXISTS clip_duration INTEGER DEFAULT 8;
      ALTER TABLE recipe_campaigns
        ADD COLUMN IF NOT EXISTS clip_duration INTEGER DEFAULT 8;
    `).catch(err => {
      console.warn('[PostgreSQL Auto-Migration Warning] Gagal migrasi demographic & clip_duration:', err.message);
    });
```

#### Code Sesudah (Proposed/After):
```javascript
    pool.query(`
      ALTER TABLE pillar_campaigns
        ADD COLUMN IF NOT EXISTS target_demographic TEXT,
        ADD COLUMN IF NOT EXISTS target_demographic_custom TEXT,
        ADD COLUMN IF NOT EXISTS clip_duration INTEGER DEFAULT 8;
      ALTER TABLE re_campaigns
        ADD COLUMN IF NOT EXISTS clip_duration INTEGER DEFAULT 8;
      ALTER TABLE sheets_campaigns
        ADD COLUMN IF NOT EXISTS clip_duration INTEGER DEFAULT 8;
      ALTER TABLE recipe_campaigns
        ADD COLUMN IF NOT EXISTS clip_duration INTEGER DEFAULT 8,
        ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default_tenant';
      ALTER TABLE recipe_items
        ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default_tenant';
      CREATE INDEX IF NOT EXISTS idx_recipe_campaigns_tenant ON recipe_campaigns (tenant_id);
      CREATE INDEX IF NOT EXISTS idx_recipe_items_tenant ON recipe_items (tenant_id);
    `).catch(err => {
      console.warn('[PostgreSQL Auto-Migration Warning] Gagal migrasi demographic & clip_duration:', err.message);
    });
```

---

### 2. `lib/campaign-scheduler.js` — Defensive Tenant Fetching

#### Code Sebelum (Current/Before):
```javascript
// lib/campaign-scheduler.js:L1116-L1121
    } else if (name.startsWith('recipe_')) {
      const item = await db.prepare("SELECT campaign_id FROM recipe_items WHERE id = ?").get(itemId);
      if (item) {
        const campaign = await db.prepare("SELECT tenant_id FROM recipe_campaigns WHERE id = ?").get(item.campaign_id);
        if (campaign) tenantId = campaign.tenant_id || 'default_tenant';
      }
    }
```

#### Code Sesudah (Proposed/After):
```javascript
    } else if (name.startsWith('recipe_')) {
      const item = await db.prepare("SELECT campaign_id FROM recipe_items WHERE id = ?").get(itemId);
      if (item) {
        try {
          const campaign = await db.prepare("SELECT tenant_id FROM recipe_campaigns WHERE id = ?").get(item.campaign_id);
          if (campaign) tenantId = campaign.tenant_id || 'default_tenant';
        } catch (e) {
          console.warn('[Campaign Scheduler] Warning fetching tenantId for recipe campaign:', e.message);
          tenantId = 'default_tenant';
        }
      }
    }
```

---

### 3. `lib/db.js` — Menyimpan `tenant_id` pada `createRecipeCampaign` & `createRecipeItem`

#### Code Sebelum (Current/Before):
```javascript
// lib/db.js:L3374-L3403
export async function createRecipeCampaign(data) {
  const db = getDb();
  db.prepare(`
    INSERT INTO recipe_campaigns (
      id, category, custom_category, visual_style, nextcloud_parent_folder, post_to_facebook, enable_glabs, target_recipe_count, images_per_recipe, selected_layout_id, grid_gap_size, grid_border_radius, grid_outer_padding, grid_bg_color, status, campaign_type, brand_profile_id, spreadsheet_id, config_json, source_deconstruct_asset_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id,
    data.category,
    data.custom_category || null,
    data.visual_style || 'Food Porn',
    data.nextcloud_parent_folder || 'MAKNA_Recipes',
    data.post_to_facebook !== undefined ? Number(data.post_to_facebook) : 0,
    data.enable_glabs !== undefined ? Number(data.enable_glabs) : 1,
    data.target_recipe_count || 1,
    data.images_per_recipe || 4,
    data.selected_layout_id || '4_editorial_split',
    data.grid_gap_size !== undefined ? Number(data.grid_gap_size) : 12,
    data.grid_border_radius !== undefined ? Number(data.grid_border_radius) : 16,
    data.grid_outer_padding !== undefined ? Number(data.grid_outer_padding) : 16,
    data.grid_bg_color || '#0d0d12',
    data.status || 'processing',
    data.campaign_type || 'static',
    data.brand_profile_id || null,
    data.spreadsheet_id || null,
    data.config_json || null,
    data.source_deconstruct_asset_id || null
  );
  return data.id;
}
```

#### Code Sesudah (Proposed/After):
```javascript
export async function createRecipeCampaign(data) {
  const db = getDb();
  db.prepare(`
    INSERT INTO recipe_campaigns (
      id, category, custom_category, visual_style, nextcloud_parent_folder, post_to_facebook, enable_glabs, target_recipe_count, images_per_recipe, selected_layout_id, grid_gap_size, grid_border_radius, grid_outer_padding, grid_bg_color, status, campaign_type, brand_profile_id, spreadsheet_id, config_json, source_deconstruct_asset_id, tenant_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id,
    data.category,
    data.custom_category || null,
    data.visual_style || 'Food Porn',
    data.nextcloud_parent_folder || 'MAKNA_Recipes',
    data.post_to_facebook !== undefined ? Number(data.post_to_facebook) : 0,
    data.enable_glabs !== undefined ? Number(data.enable_glabs) : 1,
    data.target_recipe_count || 1,
    data.images_per_recipe || 4,
    data.selected_layout_id || '4_editorial_split',
    data.grid_gap_size !== undefined ? Number(data.grid_gap_size) : 12,
    data.grid_border_radius !== undefined ? Number(data.grid_border_radius) : 16,
    data.grid_outer_padding !== undefined ? Number(data.grid_outer_padding) : 16,
    data.grid_bg_color || '#0d0d12',
    data.status || 'processing',
    data.campaign_type || 'static',
    data.brand_profile_id || null,
    data.spreadsheet_id || null,
    data.config_json || null,
    data.source_deconstruct_asset_id || null,
    data.tenant_id || 'default_tenant'
  );
  return data.id;
}
```

---

### 4. `app/api/recipe-labs/route.js` — Memasukkan `tenant_id` saat POST & GET

#### Code Sebelum (Current/Before):
```javascript
// app/api/recipe-labs/route.js:L50-L83
    await createRecipeCampaign({
      id: campaignId,
      category,
      custom_category: category === 'Custom Input' ? custom_category : null,
      visual_style: visual_style || 'Food Porn',
      nextcloud_parent_folder: nextcloud_parent_folder ? nextcloud_parent_folder.trim() : 'MAKNA_Recipes',
      post_to_facebook: post_to_facebook !== undefined ? (post_to_facebook ? 1 : 0) : 0,
      enable_glabs: enable_glabs !== undefined ? (enable_glabs ? 1 : 0) : 1,
      target_recipe_count: count,
      images_per_recipe: images_per_recipe !== undefined ? Number(images_per_recipe) : 4,
      selected_layout_id: selected_layout_id || '4_editorial_split',
      grid_gap_size: grid_gap_size !== undefined ? Number(grid_gap_size) : 12,
      grid_border_radius: grid_border_radius !== undefined ? Number(grid_border_radius) : 16,
      grid_outer_padding: grid_outer_padding !== undefined ? Number(grid_outer_padding) : 16,
      grid_bg_color: grid_bg_color || '#0d0d12',
      status: 'processing',
      campaign_type: campaign_type || 'static',
      brand_profile_id: brand_profile_id || null,
      spreadsheet_id: spreadsheet_id || null,
      config_json: config_json ? (typeof config_json === 'string' ? config_json : JSON.stringify(config_json)) : null,
      source_deconstruct_asset_id: source_deconstruct_asset_id || null
    });

    const createdItemIds = [];
    for (let i = 0; i < count; i++) {
      const itemId = `rcitem_${campaignId}_${i + 1}`;
      await createRecipeItem({
        id: itemId,
        campaign_id: campaignId,
        status: 'pending_gemini'
      });
      createdItemIds.push(itemId);
    }
```

#### Code Sesudah (Proposed/After):
```javascript
    const { getActiveTenantId } = await import('@/lib/tenant-context');
    const tenantId = getActiveTenantId() || 'default_tenant';

    await createRecipeCampaign({
      id: campaignId,
      tenant_id: tenantId,
      category,
      custom_category: category === 'Custom Input' ? custom_category : null,
      visual_style: visual_style || 'Food Porn',
      nextcloud_parent_folder: nextcloud_parent_folder ? nextcloud_parent_folder.trim() : 'MAKNA_Recipes',
      post_to_facebook: post_to_facebook !== undefined ? (post_to_facebook ? 1 : 0) : 0,
      enable_glabs: enable_glabs !== undefined ? (enable_glabs ? 1 : 0) : 1,
      target_recipe_count: count,
      images_per_recipe: images_per_recipe !== undefined ? Number(images_per_recipe) : 4,
      selected_layout_id: selected_layout_id || '4_editorial_split',
      grid_gap_size: grid_gap_size !== undefined ? Number(grid_gap_size) : 12,
      grid_border_radius: grid_border_radius !== undefined ? Number(grid_border_radius) : 16,
      grid_outer_padding: grid_outer_padding !== undefined ? Number(grid_outer_padding) : 16,
      grid_bg_color: grid_bg_color || '#0d0d12',
      status: 'processing',
      campaign_type: campaign_type || 'static',
      brand_profile_id: brand_profile_id || null,
      spreadsheet_id: spreadsheet_id || null,
      config_json: config_json ? (typeof config_json === 'string' ? config_json : JSON.stringify(config_json)) : null,
      source_deconstruct_asset_id: source_deconstruct_asset_id || null
    });

    const createdItemIds = [];
    for (let i = 0; i < count; i++) {
      const itemId = `rcitem_${campaignId}_${i + 1}`;
      await createRecipeItem({
        id: itemId,
        campaign_id: campaignId,
        tenant_id: tenantId,
        status: 'pending_gemini'
      });
      createdItemIds.push(itemId);
    }
```
