# Implementation Plan — Affiliate Studio Fase 3: Campaign Program Domain

> Status: Executable  
> Parent roadmap: [affiliate-studio-roadmap.md](file:///Users/sabeqmmursyid/_maknaflow-staging/sot/menus/affiliate-studio-roadmap.md)  
> Master orchestrator: [master-execution-orchestrator.md](file:///Users/sabeqmmursyid/_maknaflow-staging/sot/menus/affiliate-studio/master-execution-orchestrator.md)  
> Dependency: Fase 2 Brand Product Portfolio (`v2.25.0`) terilis dan seluruh tes lulus.

## 1. Objective

Menambahkan container strategi komersial baru bernama **Campaign Program** di atas Content Planner dan engine produksi. Campaign Program memungkinkan pengguna mendefinisikan target promosi, objektif, audiens, periode, platform, KPI, target kuantitas produksi, serta mengaitkan produk-produk dari portofolio brand beserta snapshot informasi produk dan resolved affiliate link-nya.

## 2. In Scope & Out of Scope

### 2.1 In Scope
- Penambahan skema database relasional baru (`affiliate_programs`, `affiliate_program_products`, `affiliate_program_events`) secara additive-only.
- Implementasi API endpoint untuk orkestrasi program (list, create, detail, update, archive, and manage product references).
- Pembuatan server-side adapter `lib/affiliate-studio-campaign-program-adapter.js` dengan proteksi tenant & brand isolation.
- Integrasi menu tab "Campaigns" pada `AffiliateStudioShell` dan penanganan routing view query parameter `?view=campaigns` dan `?view=campaigns&program=<id>`.
- Client-side components untuk menampilkan daftar program, formulir pembuatan/edit program, detail program, pengelolaan daftar produk terikat, serta event audit trail.
- Bounded snapshots capturing untuk product data (displayName, original productName, description, USP, category, imageUrl, resolved affiliate link, resolved trackingCode/override) saat produk dikaitkan ke program.
- focused unit, integration, and boundary tests.

### 2.2 Out of Scope
- Eksekusi peluncuran engine produksi (RE, OPC, Multiplier, Recipe, dll.) otomatis.
- Modifikasi skema atau record pada Content Planner legacy.
- Modifikasi skema atau record pada Product Database legacy.
- Modifikasi skema atau record pada ContentFlow.
- Autopilot generation campaign program.

## 3. Database Schema Contract (Additive)

Tiga tabel baru ditambahkan pada pool bootstrap `lib/db-pg.js`:

```sql
CREATE TABLE IF NOT EXISTS affiliate_programs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  brand_profile_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  objective TEXT,
  target_audience TEXT,
  funnel_mix JSONB,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  platforms TEXT[],
  kpis TEXT,
  production_target INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS affiliate_programs_tenant_brand_idx
  ON affiliate_programs (tenant_id, brand_profile_id);

CREATE TABLE IF NOT EXISTS affiliate_program_products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  affiliate_program_id TEXT NOT NULL REFERENCES affiliate_programs(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  brand_product_id TEXT,
  product_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS affiliate_program_products_program_idx
  ON affiliate_program_products (tenant_id, affiliate_program_id);

CREATE TABLE IF NOT EXISTS affiliate_program_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  affiliate_program_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS affiliate_program_events_program_idx
  ON affiliate_program_events (tenant_id, affiliate_program_id);
```

## 4. API & URL Routes Contract

### 4.1 URL Parameters
- `/affiliate-studio?brand=<brand_id>&view=campaigns` — Daftar program untuk brand.
- `/affiliate-studio?brand=<brand_id>&view=campaigns&program=<program_id>` — Halaman detail & edit program.

### 4.2 Endpoint API
- `GET /api/v2/affiliate-studio/brands/[id]/programs` — List campaign programs.
- `POST /api/v2/affiliate-studio/brands/[id]/programs` — Create campaign program.
- `GET /api/v2/affiliate-studio/brands/[id]/programs/[programId]` — Get program detail.
- `PUT /api/v2/affiliate-studio/brands/[id]/programs/[programId]` — Update campaign program.
- `DELETE /api/v2/affiliate-studio/brands/[id]/programs/[programId]` — Archive program.
- `POST /api/v2/affiliate-studio/brands/[id]/programs/[programId]/products` — Bind products list (captures snapshots).
- `DELETE /api/v2/affiliate-studio/brands/[id]/programs/[programId]/products` — Unbind products list.

## 5. Execution Task List

### 5.1 Database & Server Layer
- [ ] Tambahkan auto-migration skema database Fase 3 pada [`lib/db-pg.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/db-pg.js).
- [ ] Buat file server adapter [`lib/affiliate-studio-campaign-program-adapter.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/affiliate-studio-campaign-program-adapter.js).
- [ ] Buat API Route Handler list & create [`app/api/v2/affiliate-studio/brands/[id]/programs/route.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/v2/affiliate-studio/brands/%5Bid%5D/programs/route.js).
- [ ] Buat API Route Handler detail/update/archive [`app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/route.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/v2/affiliate-studio/brands/%5Bid%5D/programs/%5BprogramId%5D/route.js).
- [ ] Buat API Route Handler product binding & snapshotted capture [`app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/products/route.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/api/v2/affiliate-studio/brands/%5Bid%5D/programs/%5BprogramId%5D/products/route.js).

### 5.2 UI & Navigation Integration
- [ ] Modifikasi [`app/affiliate-studio/components/AffiliateStudioShell.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/AffiliateStudioShell.js) untuk mengaktifkan tab "Campaigns".
- [ ] Modifikasi [`app/affiliate-studio/components/AffiliateStudioWorkspace.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/AffiliateStudioWorkspace.js) untuk memuat data program & conditional rendering views.
- [ ] Buat component UI list & creation [`app/affiliate-studio/components/BrandCampaignPrograms.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/BrandCampaignPrograms.js).
- [ ] Buat component UI detail & products snapshots management [`app/affiliate-studio/components/CampaignProgramDetail.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/CampaignProgramDetail.js).
- [ ] Modifikasi [`app/affiliate-studio/components/AffiliateStudio.module.css`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/AffiliateStudio.module.css) untuk menyematkan kelas-kelas CSS program container.

### 5.3 Verification & Quality Gate
- [ ] Buat berkas unit & integration tests [`tests/affiliate-studio-campaign-program.test.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/tests/affiliate-studio-campaign-program.test.js).
- [ ] Buat berkas boundary tests [`tests/affiliate-studio-phase-03-boundary.test.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/tests/affiliate-studio-phase-03-boundary.test.js).
- [ ] Jalankan focused tests & regression matrix.
- [ ] Jalankan existing regressions (catalog, binding, auth/RBAC).
- [ ] Jalankan `git diff --check`.
- [ ] Jalankan `npm run build`.
- [ ] Jalankan release SOP otomatis minor v2.26.0.

## 6. Planned File Changes (Before & After Code Snippets)

### 6.1 [MODIFY] [lib/db-pg.js](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/db-pg.js)
#### Code Sebelum (Current)
```javascript
        console.log('[PostgreSQL] Brand–Product Affiliate Routing migration completed.');
      } catch (err) {
        console.warn('[PostgreSQL Auto-Migration Warning] Brand–Product Affiliate Routing migration:', err.message);
      } finally {
        if (client) { try { await client.query('SELECT pg_advisory_unlock_all()'); } catch(_) {} client.release(); }
      }
    };
    migrateBrandProductAffiliateRouting();
```
#### Code Sesudah (Proposed)
```javascript
        console.log('[PostgreSQL] Brand–Product Affiliate Routing migration completed.');
      } catch (err) {
        console.warn('[PostgreSQL Auto-Migration Warning] Brand–Product Affiliate Routing migration:', err.message);
      } finally {
        if (client) { try { await client.query('SELECT pg_advisory_unlock_all()'); } catch(_) {} client.release(); }
      }
    };
    migrateBrandProductAffiliateRouting();

    const migrateAffiliateStudioCampaignProgram = async () => {
      let client;
      try {
        client = await pool.connect();
        await client.query(`SELECT pg_advisory_lock(hashtext('makna_affiliate_studio_campaign_program_v1'));`);

        await client.query(`
          CREATE TABLE IF NOT EXISTS affiliate_programs (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            brand_profile_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            objective TEXT,
            target_audience TEXT,
            funnel_mix JSONB,
            start_date TIMESTAMPTZ,
            end_date TIMESTAMPTZ,
            platforms TEXT[],
            kpis TEXT,
            production_target INTEGER,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT,
            updated_by TEXT
          );
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS affiliate_programs_tenant_brand_idx
            ON affiliate_programs (tenant_id, brand_profile_id);
        `);

        await client.query(`
          CREATE TABLE IF NOT EXISTS affiliate_program_products (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            affiliate_program_id TEXT NOT NULL REFERENCES affiliate_programs(id) ON DELETE CASCADE,
            product_id TEXT NOT NULL,
            brand_product_id TEXT,
            product_snapshot JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS affiliate_program_products_program_idx
            ON affiliate_program_products (tenant_id, affiliate_program_id);
        `);

        await client.query(`
          CREATE TABLE IF NOT EXISTS affiliate_program_events (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            affiliate_program_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            actor_id TEXT,
            payload JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS affiliate_program_events_program_idx
            ON affiliate_program_events (tenant_id, affiliate_program_id);
        `);

        console.log('[PostgreSQL] Affiliate Studio Campaign Program migration completed.');
      } catch (err) {
        console.warn('[PostgreSQL Auto-Migration Warning] Affiliate Studio Campaign Program migration:', err.message);
      } finally {
        if (client) { try { await client.query('SELECT pg_advisory_unlock_all()'); } catch(_) {} client.release(); }
      }
    };
    migrateAffiliateStudioCampaignProgram();
```

### 6.2 [MODIFY] [app/affiliate-studio/components/AffiliateStudioShell.js](file:///Users/sabeqmmursyid/_maknaflow-staging/app/affiliate-studio/components/AffiliateStudioShell.js)
#### Code Sebelum (Current)
```javascript
  const localNavItems = [
    { key: 'overview', label: 'Overview', disabled: false },
    { key: 'products', label: 'Products', disabled: false },
    { key: 'campaigns', label: 'Campaigns', disabled: true },
    { key: 'planner', label: 'Planner', disabled: true },
    { key: 'production', label: 'Production', disabled: true },
    { key: 'publishing', label: 'Publishing', disabled: true },
    { key: 'performance', label: 'Performance', disabled: true }
  ];
```
#### Code Sesudah (Proposed)
```javascript
  const localNavItems = [
    { key: 'overview', label: 'Overview', disabled: false },
    { key: 'products', label: 'Products', disabled: false },
    { key: 'campaigns', label: 'Campaigns', disabled: false },
    { key: 'planner', label: 'Planner', disabled: true },
    { key: 'production', label: 'Production', disabled: true },
    { key: 'publishing', label: 'Publishing', disabled: true },
    { key: 'performance', label: 'Performance', disabled: true }
  ];
```

## 7. Explicit No-Change List
Legacy modules yang beku pada Fase 3:
- [`lib/product-catalog-service.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/product-catalog-service.js)
- [`lib/campaign-product-binding.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/campaign-product-binding.js)
- [`lib/affiliate-resolver.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/affiliate-resolver.js)
- [`app/products/page.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/app/products/page.js) (Product Database)
- [`lib/auth.js`](file:///Users/sabeqmmursyid/_maknaflow-staging/lib/auth.js)

## 8. Verification Gate & Rollback Strategy
- Focused native node tests: `node --experimental-test-module-mocks --test tests/affiliate-studio-campaign-program.test.js`
- Boundary validation tests: `node --experimental-test-module-mocks --test tests/affiliate-studio-phase-03-boundary.test.js`
- Regression test runner: `node --experimental-test-module-mocks --test tests/...` (all tests)
- Rollback: Menonaktifkan route baru, drop/archive baru di database, dan menghapus references.
