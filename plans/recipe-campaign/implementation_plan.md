# Implementation Plan — Recipe Campaign MAKNA Flow (Finalized & Aligned with Mockup)

Rencana implementasi tipe konten ketiga **`recipe_campaign` (Recipe Campaign)** yang diintegrasikan 100% ke dalam menu **Content Planner MAKNA Flow** (`/content-planner` dan `/content-planner/[id]`) sesuai dengan **Mockup Interaktif Standar** yang telah disetujui.

> [!IMPORTANT]
> **Standar Desain & Integritas Fitur:**
> 1. **100% Memakai Semantic CSS Design Tokens dari `app/theme.css`:** Tidak ada hardcoded hex/rgb (`#1e293b`, `#0f172a`, dll). Sepenuhnya menggunakan `var(--surface)`, `var(--surface-raised)`, `var(--surface-interactive)`, `var(--border-subtle)`, `var(--text-primary)`, `var(--status-neutral)`, `var(--status-info)`, `var(--status-success)`, `var(--status-warning)`, dll., yang adaptif sempurna di **Light Mode ☀️** dan **Dark Mode 🌙**.
> 2. **Integrasi Menu Asli Content Planner:** Tidak membuat halaman atau menu terpisah. Recipe Campaign menjadi opsi fokus ke-3 di dalam modal `✨ Generator Content Planner Baru` dengan alur **Save as Draft (`💾 Simpan Draft Planner`) → Eksekusi AI Pipeline (`🚀 Eksekusi AI Pipeline`)**.
> 3. **Kelengkapan Parameter Form:** Form mencakup seluruh parameter standar: Multi-Select Produk Katalog, Kategori Kuliner (`masakan`, `minuman`, `dessert`, `kue`), **Target Demografi Audiens** (Gen-Z, Ibu Rumah Tangga, Profesional, Syari, Fitness, Custom), Konteks Promosi, Instruksi Khusus, Platform Target, dan Jumlah Resep (1–20).
> 4. **Mandat Teks Resep Lengkap:** Menghasilkan naskah resep canonical terstruktur, tombol *Salin Teks Resep Lengkap (Plain Text)*, ekspor Markdown, start frame review dengan gate invalidasi revisi stale, hingga snapshot publishing media sosial tanpa pemotongan diam-diam.

---

## User Review & Mockup Interaktif Acuan

- **Mockup HTML Interaktif:** [public/mockup_recipe_campaign.html](file:///Users/sabeqmmursyid/_contentflow-staging/public/mockup_recipe_campaign.html)
- **Local Live URL:** `http://localhost:5055/mockup_recipe_campaign`
- **Theme Stylesheet:** [public/recipe-theme.css](file:///Users/sabeqmmursyid/_contentflow-staging/public/recipe-theme.css) (Semantic Tokens `app/theme.css`)

---

## Execution Task List

Agent **WAJIB** memperbarui status checkbox menjadi `[x]` segera setelah setiap tahapan selesai diimplementasikan dan diverifikasi:

- [x] **Task 01: Audit Kontrak Database & Migration Idempotent**
  - Menambahkan kolom `recipe_config_json` dan `products_snapshot_json` pada `content_planners`, `recipe_idea_json` dan `recipe_revision` pada `content_planner_rows`, serta kolom resep pada `content_flows` di [lib/db-pg.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/db-pg.js).
- [x] **Task 02: Validasi Kontrak Data & Helper Recipe**
  - Membuat [lib/recipe-campaign-contract.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/recipe-campaign-contract.js) dan mendaftarkan `recipe_campaign` pada [lib/content-planner-contract.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/content-planner-contract.js).
- [x] **Task 03: Engine Generator N-Ide Recipe Planner & Lifecycle Draft**
  - Mengimplementasikan alur *Save as Draft* dan *Execute AI Generator* (Single-Pass Gemini AI) pada [lib/recipe-planner-engine.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/recipe-planner-engine.js) dan integrasi dispatch di [lib/content-planner-engine.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/content-planner-engine.js).
- [x] **Task 04: UI Modal Generator Content Planner (`app/content-planner/page.js`)**
  - Menambahkan fokus `recipe_campaign` pada modal `✨ Generator Content Planner Baru`, integrasi multi-select produk katalog, kategori kuliner, target demografi audiens lengkap, dan tombol *💾 Simpan Draft Planner* serta rendering kartu draft pada dashboard.
- [x] **Task 05: Ingest Idempotent Recipe ke Pipeline Produksi OPC**
  - Mengimplementasikan [lib/recipe-campaign-ingest.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/recipe-campaign-ingest.js) dan endpoint [app/api/content-planner/[id]/ingest-recipe/route.js](file:///Users/sabeqmmursyid/_contentflow-staging/app/api/content-planner/[id]/ingest-recipe/route.js) dengan lineage produk per item.
- [x] **Task 06: Single-Pass Detail Creative Generator & Formatter Resep Lengkap**
  - Mengimplementasikan formatter naskah resep (Markdown & Plain Text) di [lib/recipe-social-package.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/recipe-social-package.js) dan adapter [lib/recipe-production-adapter.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/recipe-production-adapter.js).
- [x] **Task 07: Start Frame Checkpoint, Invalidation & Approval Gate**
  - Mengintegrasikan gate penahanan Fase 2 di [lib/pillar-start-frame-service.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/pillar-start-frame-service.js) dan [lib/campaign-scheduler.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/campaign-scheduler.js).
- [x] **Task 08: UI Workbench Detail Planner (`app/content-planner/[id]/page.js`)**
  - Menampilkan tabel baris resep dan drawer detail produksi 4 tab (*Resep Lengkap*, *Storyboard/VO*, *Start Frames Review*, *Paket Sosial*) lengkap dengan tombol salin plain text dan ekspor.
- [x] **Task 09: Integrasi ContentFlow & Social Media Publishing Snapshot**
  - Update [lib/contentflow-ingest.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/contentflow-ingest.js) dan [lib/contentflow-repository.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/contentflow-repository.js) untuk menyimpan resep lengkap ke `caption_snapshot`.
- [x] **Task 10: Unit & Integration Testing Suite**
  - Menjalankan `tests/recipe-campaign-contract.test.js`, `tests/recipe-campaign-ingest.test.js`, `tests/recipe-campaign-pipeline.test.js`, dan `tests/recipe-social-package.test.js`.
- [x] **Task 11: Regression Check & Production Readiness Verification**
  - Memastikan `brand_editorial` dan `product_campaign` tetap berfungsi normal dan `npm run build` berhasil 100%.
- [x] **Task 12: Rilis SOP & Git Sync**
  - Menjalankan perintah non-interaktif `npm run release-non-interactive` sesuai SOP MAKNA Flow.

---

## Proposed Changes & Code Before / After

### 1. Database Schema & Migration

#### [MODIFY] [lib/db-pg.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/db-pg.js)
**Deskripsi:** Menambahkan kolom JSONB untuk konfigurasi resep, snapshot produk, ide baris resep, revisi, dan teks resep lengkap di tabel `content_flows`.

**Code Sebelum (Current/Before), sekitar baris 87:**
```sql
          ALTER TABLE content_planners
            ADD COLUMN IF NOT EXISTS planner_focus TEXT DEFAULT 'product_campaign',
            ADD COLUMN IF NOT EXISTS brand_context TEXT,
            ADD COLUMN IF NOT EXISTS content_goal TEXT,
            ADD COLUMN IF NOT EXISTS pillars_json TEXT DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS pillar_distribution_mode TEXT DEFAULT 'balanced',
            ADD COLUMN IF NOT EXISTS promotion_context TEXT,
            ADD COLUMN IF NOT EXISTS custom_instructions TEXT,
            ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS metadata_json JSONB DEFAULT '{}'::jsonb;
```

**Code Sesudah (Proposed/After):**
```sql
          ALTER TABLE content_planners
            ADD COLUMN IF NOT EXISTS planner_focus TEXT DEFAULT 'product_campaign',
            ADD COLUMN IF NOT EXISTS brand_context TEXT,
            ADD COLUMN IF NOT EXISTS content_goal TEXT,
            ADD COLUMN IF NOT EXISTS pillars_json TEXT DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS pillar_distribution_mode TEXT DEFAULT 'balanced',
            ADD COLUMN IF NOT EXISTS promotion_context TEXT,
            ADD COLUMN IF NOT EXISTS custom_instructions TEXT,
            ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS metadata_json JSONB DEFAULT '{}'::jsonb,
            ADD COLUMN IF NOT EXISTS recipe_config_json JSONB DEFAULT '{}'::jsonb,
            ADD COLUMN IF NOT EXISTS products_snapshot_json JSONB DEFAULT '[]'::jsonb;

          ALTER TABLE content_planner_rows
            ADD COLUMN IF NOT EXISTS recipe_idea_json JSONB,
            ADD COLUMN IF NOT EXISTS recipe_revision INTEGER DEFAULT 1;

          ALTER TABLE content_flows
            ADD COLUMN IF NOT EXISTS recipe_text_markdown TEXT,
            ADD COLUMN IF NOT EXISTS recipe_text_plain TEXT,
            ADD COLUMN IF NOT EXISTS recipe_payload_json JSONB,
            ADD COLUMN IF NOT EXISTS social_media_package_json JSONB,
            ADD COLUMN IF NOT EXISTS content_kind TEXT DEFAULT 'generic',
            ADD COLUMN IF NOT EXISTS recipe_revision INTEGER DEFAULT 1;
```

---

### 2. Contract & Engine

#### [MODIFY] [lib/content-planner-contract.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/content-planner-contract.js)
**Deskripsi:** Mendaftarkan `recipe_campaign` sebagai fokus planner yang valid dan validasi jumlah 1–20.

**Code Sebelum (Current/Before), sekitar baris 8:**
```js
export function normalizePlannerFocus(value) {
  const focus = value || 'product_campaign';
  if (!['product_campaign', 'brand_editorial'].includes(focus)) {
    const error = new Error('Fokus planner tidak valid.');
    error.code = 'CONTENT_PLANNER_VALIDATION';
    throw error;
  }
  return focus;
}
```

**Code Sesudah (Proposed/After):**
```js
export const PLANNER_FOCI = ['brand_editorial', 'product_campaign', 'recipe_campaign'];

export function normalizePlannerFocus(value) {
  const focus = value || 'product_campaign';
  if (!PLANNER_FOCI.includes(focus)) {
    const error = new Error('Fokus planner tidak valid.');
    error.code = 'CONTENT_PLANNER_VALIDATION';
    throw error;
  }
  return focus;
}
```

---

#### [NEW] [lib/recipe-campaign-contract.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/recipe-campaign-contract.js)
**Deskripsi:** Definisi kategori canonical, validasi draft planner, dan kontrak canonical recipe.

**Code Sesudah (Proposed/After):**
```js
export const RECIPE_CATEGORIES = ['masakan', 'minuman', 'dessert', 'kue'];
export const DEFAULT_RECIPE_COUNT = 5;
export const MIN_RECIPE_COUNT = 1;
export const MAX_RECIPE_COUNT = 20;

export function validateRecipePlannerDraft({ category, count, productIds, targetAudience }) {
  if (!RECIPE_CATEGORIES.includes(category)) {
    throw new Error(`Kategori resep '${category}' tidak valid.`);
  }
  const parsedCount = parseInt(count, 10);
  if (isNaN(parsedCount) || parsedCount < MIN_RECIPE_COUNT || parsedCount > MAX_RECIPE_COUNT) {
    throw new Error(`Jumlah resep harus berupa integer ${MIN_RECIPE_COUNT}–${MAX_RECIPE_COUNT}.`);
  }
  if (!Array.isArray(productIds) || productIds.length === 0) {
    throw new Error('Minimal satu produk katalog harus dipilih.');
  }
  return { category, count: parsedCount, productIds, targetAudience: targetAudience || 'genz_casual' };
}
```

---

#### [MODIFY] [lib/content-planner-engine.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/content-planner-engine.js)
**Deskripsi:** Dispatching pembuatan draft, eksekusi, dan regenerasi baris khusus `recipe_campaign`.

**Code Sebelum (Current/Before), sekitar baris 320:**
```js
export async function executeContentPlanner(plannerId, researchInput = null) {
  const db = getDb();
  const planner = await db.prepare('SELECT * FROM content_planners WHERE id = ?').get(plannerId);
  if (!planner) {
    throw new Error('Planner tidak ditemukan.');
  }
```

**Code Sesudah (Proposed/After):**
```js
export async function executeContentPlanner(plannerId, researchInput = null) {
  const db = getDb();
  const planner = await db.prepare('SELECT * FROM content_planners WHERE id = ?').get(plannerId);
  if (!planner) {
    throw new Error('Planner tidak ditemukan.');
  }
  if (planner.planner_focus === 'recipe_campaign') {
    const { executeRecipePlanner } = await import('./recipe-planner-engine.js');
    return executeRecipePlanner({ planner });
  }
```

---

#### [NEW] [lib/recipe-planner-engine.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/recipe-planner-engine.js)
**Deskripsi:** Generator N ide resep single-pass AI dengan integrasi produk natural, rotasi 1 produk per resep, estimasi waktu, porsi, dan target demografi audiens.

**Code Sesudah (Proposed/After):**
```js
import { executeWithKeyPool } from './gemini.js';
import { parseGeminiJSON } from './json-parser.js';
import { getDb } from './db.js';

export async function executeRecipePlanner({ planner }) {
  // 1x AI Call menghasilkan tepat N ide resep terstruktur
  // Memetakan target demografi audiens ke persona & hook
  // Persist ke tabel content_planner_rows dengan recipe_idea_json & recipe_revision = 1
}

export async function regenerateRecipeIdea({ planner, rowId, userInstructions }) {
  // Regenerasi baris tunggal dengan mempertahankan constraint produk dan kategori
}
```

---

### 3. UI Content Planner Dashboard & Modal (`app/content-planner/page.js`)

#### [MODIFY] [app/content-planner/page.js](file:///Users/sabeqmmursyid/_contentflow-staging/app/content-planner/page.js)
**Deskripsi:** Menambahkan tombol fokus ke-3 `🍳 Recipe Campaign`, form dinamis multi-produk, kategori kuliner, target demografi audiens lengkap, tombol *💾 Simpan Draft Planner*, dan kartu dashboard dengan tombol *🚀 Eksekusi AI Pipeline*.

**Code Sebelum (Current/Before), sekitar baris 945:**
```jsx
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {[
                      ['brand_editorial', '🧩 Brand Editorial', 'Berbasis brand, audiens, dan pilar. Produk tidak wajib.'],
                      ['product_campaign', '📦 Product Campaign', 'Berpusat pada satu produk tertentu.']
                    ].map(([value, label, desc]) => (
                      <button key={value} type="button" onClick={() => setPlannerFocus(value)} style={{
                        padding: '12px', textAlign: 'left', borderRadius: '10px', cursor: 'pointer',
                        border: plannerFocus === value ? '1px solid var(--status-neutral)' : '1px solid var(--border-subtle)',
                        background: plannerFocus === value ? 'var(--status-neutral-soft)' : 'var(--bg-secondary)', color: 'var(--text-primary)'
                      }}>
                        <div style={{ fontWeight: 700, marginBottom: '4px' }}>{label}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{desc}</div>
                      </button>
                    ))}
                  </div>
```

**Code Sesudah (Proposed/After):**
```jsx
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    {[
                      ['brand_editorial', '🧩 Brand Editorial', 'Berbasis brand, audiens & pilar.'],
                      ['product_campaign', '📦 Product Campaign', 'Berpusat pada satu produk tunggal.'],
                      ['recipe_campaign', '🍳 Recipe Campaign', 'Resep kuliner dengan integrasi produk natural.']
                    ].map(([value, label, desc]) => (
                      <button key={value} type="button" onClick={() => setPlannerFocus(value)} style={{
                        padding: '12px', textAlign: 'left', borderRadius: '10px', cursor: 'pointer',
                        border: plannerFocus === value ? '1px solid var(--status-neutral)' : '1px solid var(--border-subtle)',
                        background: plannerFocus === value ? 'var(--status-neutral-soft)' : 'var(--surface)', color: 'var(--text-primary)',
                        transition: 'all 0.15s ease'
                      }}>
                        <div style={{ fontWeight: 700, marginBottom: '4px', fontSize: '13px' }}>{label}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.3 }}>{desc}</div>
                      </button>
                    ))}
                  </div>
```

---

### 4. UI Content Planner Workbench & Detail Drawer (`app/content-planner/[id]/page.js`)

#### [MODIFY] [app/content-planner/[id]/page.js](file:///Users/sabeqmmursyid/_contentflow-staging/app/content-planner/[id]/page.js)
**Deskripsi:** Menampilkan kolom resep pada tabel baris workbench, tombol *🚀 Ingest ke OPC Studio*, dan drawer produksi 4 tab (*Resep Lengkap*, *Storyboard/VO*, *Start Frames Review*, *Paket Sosial*) dengan tombol *📋 Salin Resep Lengkap (Plain Text)* dan *💾 Ekspor Markdown*.

**Code Sebelum (Current/Before), sekitar baris 40:**
```jsx
  async function handleExecute() {
    try {
      setExecuting(true);
      showToast('Memulai 3-Fase AI Pipeline...');
      const res = await fetch(`/api/content-planner/${plannerId}/execute`, { method: 'POST' });
      const data = await res.json();
```

**Code Sesudah (Proposed/After):**
```jsx
  async function handleExecute() {
    try {
      setExecuting(true);
      showToast(planner?.planner_focus === 'recipe_campaign'
        ? 'Menjalankan Gemini AI Recipe Generator...'
        : 'Memulai 3-Fase AI Pipeline...');
      const res = await fetch(`/api/content-planner/${plannerId}/execute`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Content Planner Berhasil Tergenerate! 🍳');
        fetchPlannerDetail();
      }
```

---

### 5. Creative Production Adapter & Full Recipe Text Formatter

#### [NEW] [lib/recipe-social-package.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/recipe-social-package.js)
**Deskripsi:** Formatter deterministik untuk mengonversi canonical JSON resep menjadi teks Markdown, Plain Text, dan Caption media sosial lengkap dengan resep.

**Code Sesudah (Proposed/After):**
```js
export function formatRecipeTextMarkdown(recipe) {
  let md = `# ${recipe.title}\n\nPorsi: ${recipe.servings} | Waktu: ${recipe.prep_minutes + recipe.cook_minutes} Menit\n\n## Bahan-Bahan:\n`;
  recipe.ingredients.forEach(i => {
    md += `- ${i.amount} ${i.unit} ${i.name}\n`;
  });
  md += `\n## Cara Membuat:\n`;
  recipe.steps.forEach((s, idx) => {
    md += `${idx + 1}. ${s.instruction}\n`;
  });
  if (recipe.tips?.length) {
    md += `\n## Tips Chef:\n${recipe.tips.map(t => `- ${t}`).join('\n')}\n`;
  }
  return md;
}

export function formatRecipeTextPlain(recipe) {
  let text = `${recipe.title.toUpperCase()}\nPorsi: ${recipe.servings} | Waktu: ${recipe.prep_minutes + recipe.cook_minutes} Menit\n\nBAHAN-BAHAN:\n`;
  recipe.ingredients.forEach(i => {
    text += `• ${i.amount} ${i.unit} ${i.name}\n`;
  });
  text += `\nCARA MEMBUAT:\n`;
  recipe.steps.forEach((s, idx) => {
    text += `${idx + 1}. ${s.instruction}\n`;
  });
  if (recipe.tips?.length) {
    text += `\nTIPS:\n${recipe.tips.map(t => `• ${t}`).join('\n')}\n`;
  }
  return text;
}
```

---

#### [NEW] [lib/recipe-production-adapter.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/recipe-production-adapter.js)
**Deskripsi:** Generator Single-Pass detail produksi (Resep Canonical, Storyboard, VO, T2I/I2V prompts, Video DNA, Paket Sosial) dan pemetaan ke format OPC item.

**Code Sesudah (Proposed/After):**
```js
export async function processRecipeCampaignCreative({ item, campaign, job }) {
  // 1x API call Gemini AI menghasilkan paket lengkap
  // Validasi kelengkapan resep (porsi, takaran bahan, langkah runtut)
  // Menjadwalkan start frame T2I & menyimpan result_json dengan content_kind = 'recipe_campaign'
}
```

---

### 6. Start Frame Checkpoint & Approval Gate

#### [MODIFY] [lib/pillar-start-frame-service.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/pillar-start-frame-service.js)
**Deskripsi:** Memastikan Fase 2 terkunci jika frame belum lengkap (3/4) atau revisi berubah (stale approval).

**Code Sebelum (Current/Before), sekitar baris 20:**
```js
export async function finalizeStartFrameCheckpoint(itemId, { paths = null, revision: requestedRevision = null } = {}) {
  const db = getDb();
  const item = await db.prepare('SELECT * FROM pillar_campaign_items WHERE id=?').get(itemId);
  if (!item) throw new Error('OPC item tidak ditemukan.');
```

**Code Sesudah (Proposed/After):**
```js
export async function finalizeStartFrameCheckpoint(itemId, { paths = null, revision: requestedRevision = null } = {}) {
  const db = getDb();
  const item = await db.prepare('SELECT * FROM pillar_campaign_items WHERE id=?').get(itemId);
  if (!item) throw new Error('OPC item tidak ditemukan.');

  const imagePaths = paths || parseJson(item.t2i_images_json, []);
  const scenes = parseJson(item.result_json, {}).scenes || [];
  const expectedCount = scenes.length || 4;
  const isComplete = imagePaths.length >= expectedCount && imagePaths.every(Boolean);

  // Jika item adalah recipe_campaign, status ready_for_review hanya diberikan jika frame lengkap
  if (item.content_kind === 'recipe_campaign' && !isComplete) {
    return { ready: false, status: 'incomplete_frames', expectedCount, actualCount: imagePaths.length };
  }
```

---

### 7. ContentFlow & Social Media Publishing

#### [MODIFY] [lib/contentflow-ingest.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/contentflow-ingest.js)
**Deskripsi:** Mengalirkan naskah resep lengkap dan caption terformat ke `content_flows`.

**Code Sebelum (Current/Before), sekitar baris 470:**
```js
      const caption = social.caption || social.tiktok_caption || payload.caption || (result.social_media_package && result.social_media_package.caption) || result.tiktok_caption || '';
      const rawDriveLink = item.drive_link || result.drive_link || '';
```

**Code Sesudah (Proposed/After):**
```js
      const isRecipe = result.content_kind === 'recipe_campaign' || payload.content_kind === 'recipe_campaign';
      const caption = isRecipe && result.social_media_package?.caption_with_recipe
        ? result.social_media_package.caption_with_recipe
        : (social.caption || social.tiktok_caption || payload.caption || result.tiktok_caption || '');
```

---

## Verification Plan

### Automated Tests
```bash
# 1. Contract & validation tests (Category, count, target audience)
node --test tests/recipe-campaign-contract.test.js

# 2. Ingest & idempotency tests (Tenant isolation & product lineage)
node --test tests/recipe-campaign-ingest.test.js

# 3. Pipeline approval gate & stale revision tests
node --test tests/recipe-campaign-pipeline.test.js

# 4. Social package full recipe text & snapshot tests
node --test tests/recipe-social-package.test.js

# 5. Core regression tests & production build verification
node --test tests/content-planner-locked-structure.test.js
npm run build
```

### Manual Verification
- Uji interaktif live preview: `http://localhost:5055/mockup_recipe_campaign`
- Uji alur *Simpan Draft* → *Eksekusi AI* → *Salin Resep* → *Review Start Frame* → *Approve Fase 2* → *ContentFlow*.
- Uji adaptibilitas tema Light & Dark Mode.
