# Implementation Plan — Perbaikan OPC Configuration, Item Integrity, dan Scheduler

## 1. Tujuan

Memperbaiki alur pembuatan Organic Pillar Campaign (OPC) agar:

1. Pilihan akun/Brand Profile, target demografi audiens, dan Visual Swap Overrides tersimpan serta tampil kembali secara benar.
2. Campaign dan seluruh item dibuat secara atomik; tidak ada lagi campaign `running` tanpa item.
3. PostgreSQL memberikan ID otomatis untuk `pillar_campaign_items`.
4. UI menampilkan status scheduler berdasarkan kondisi runtime sebenarnya, bukan hanya setting tenant.
5. Kampanye `opc_260802_zr0a5x` dapat dipulihkan dari planner sumber tanpa kehilangan konfigurasi yang benar.

## 2. Bukti Kondisi Saat Ini

Kampanye `opc_260802_zr0a5x` memiliki:

```text
status                    = running
brand_profile_id          = null
target_demographic        = null
target_demographic_custom = null
visual_overrides_json.subject_demographic = syari_classic
jumlah pillar_campaign_items = 0
```

Schema item saat ini:

```text
pillar_campaign_items.id = BIGINT NOT NULL
column_default           = null
is_identity              = NO
```

Planner sumber dan Brand Profile yang ditemukan:

```text
planner_id       = pln_aa53bbc4
planner_row_id   = row_368ae232
brand_profile_id = 940e766b-76d0-49b7-b6d5-01dfb0041d40
brand_name       = nutribake
```

Staging juga memiliki:

```env
ENABLE_CAMPAIGN_SCHEDULER=false
ENABLE_SCHEDULER_WORKER=false
```

## 3. Keputusan Arsitektur

### 3.1 Identitas brand

- Dropdown utama menyimpan `brand_profile_id`, bukan string nama akun.
- `account_name` tetap disimpan sebagai snapshot agar nama kampanye, folder, export, dan data lama tetap dapat dibaca.
- Opsi hard-coded `nutribake`/`siasatsehat` dihapus setelah Brand Profile tersedia; alias harus berasal dari data tenant.
- API memvalidasi bahwa Brand Profile berada pada tenant aktif.

### 3.2 Demografi audiens dan demografi visual

Keduanya adalah konsep berbeda:

| Field | Fungsi |
|---|---|
| `target_demographic` | Audiens dan tone bahasa naskah, misalnya `ibu_rumah_tangga`. |
| `visual_overrides_json.subject_demographic` | Subjek/model visual, misalnya `syari_classic`. |

UI detail tidak boleh memakai satu field untuk keduanya.

### 3.3 Transaksi campaign bundle

Pembuatan campaign dan item dilakukan dalam satu transaksi PostgreSQL:

```text
BEGIN
  INSERT pillar_campaigns
  INSERT pillar_campaign_items × N
  ASSERT inserted_items = expected_items
COMMIT
```

Jika satu insert gagal, seluruh campaign di-rollback dan API mengembalikan error.

### 3.4 Status scheduler efektif

Status efektif merupakan gabungan empat gate:

```text
process_enabled
  AND worker_enabled
  AND tenant_enabled
  AND runtime_running
```

Toggle UI hanya mengendalikan `tenant_enabled`. Environment gate harus ditampilkan sebagai informasi read-only dan perubahan environment memerlukan restart.

## 4. Tahapan Implementasi

### Tahap A — Schema dan integritas data

- Tambahkan sequence/default untuk `pillar_campaign_items.id` secara idempotent.
- Tambahkan `account_name` dan `source_planner_id` pada `pillar_campaigns`.
- Tambahkan index tenant/campaign yang diperlukan.
- Verifikasi migrasi dapat dijalankan dua kali dan tidak mengubah ID existing.

### Tahap B — Transaksi campaign + items

- Tambahkan repository `createPillarCampaignBundle()` menggunakan `withPgTransaction()`.
- Jalur single, bulk CSV, Import Planner, dan Operator API memakai repository yang sama.
- Response API harus memuat `expected_items` dan `created_items`.
- Hapus penggunaan pseudo-transaction `db.transaction(async () => ...)` pada OPC.

### Tahap C — Propagasi konfigurasi

- Sinkronkan pilihan account dengan Brand Profile ID.
- Teruskan `account_name`, `brand_profile_id`, `target_demographic`, dan custom value pada seluruh jalur.
- Simpan `source_planner_id` ketika campaign berasal dari Content Planner.
- Validasi preset audiens dan VSO sebelum insert.

### Tahap D — UI detail

- Buat label map bersama untuk demografi audiens dan VSO.
- Parse `visual_overrides_json` secara aman.
- Basic Creative Strategy membaca brand snapshot/profile dan target audiens.
- Visual Swap Overrides membaca `subject_demographic`, wardrobe, lighting, dan character concept dari JSON.

### Tahap E — Scheduler observability

- Expose status environment, worker gate, tenant toggle, dan runtime state.
- Tampilkan alasan ketika scheduler tidak efektif.
- Toggle tenant tidak boleh mengklaim “aktif” bila environment/worker mati.
- Setelah kode lolos test, aktifkan campaign scheduler pada local staging pilot dan restart server.

### Tahap F — Pemulihan kampanye terdampak

- Dry-run terhadap `opc_260802_zr0a5x`.
- Gunakan planner `pln_aa53bbc4`, row `row_368ae232`, dan Brand Profile Nutribake yang sudah ditemukan.
- Terapkan `target_demographic=ibu_rumah_tangga` dan pertahankan VSO `syari_classic`.
- Karena campaign saat ini tidak memiliki item, rekonstruksi item dalam transaksi; jangan membuat campaign duplikat.
- Verifikasi minimal satu item `pending`, lalu scheduler memulai generation.

## 5. Perubahan File dan Before/After Code

### 5.1 `lib/db-pg.js`

**Code Sebelum (Current/Before)**

```js
// pillar_campaign_items.id tidak memiliki sequence/default.
// pillar_campaigns tidak memiliki account_name/source_planner_id.
```

**Code Sesudah (Proposed/After)**

```js
await pool.query(`CREATE SEQUENCE IF NOT EXISTS pillar_campaign_items_id_seq`);
await pool.query(`
  ALTER TABLE pillar_campaign_items
  ALTER COLUMN id SET DEFAULT nextval('pillar_campaign_items_id_seq')
`);
await pool.query(`
  ALTER TABLE pillar_campaigns
    ADD COLUMN IF NOT EXISTS account_name TEXT,
    ADD COLUMN IF NOT EXISTS source_planner_id TEXT
`);
```

Sequence di-set ke `MAX(id) + 1` dan migrasi dilindungi advisory lock.

### 5.2 `lib/db.js`

**Code Sebelum (Current/Before)**

```js
await createPillarCampaign(campaign);
await db.transaction(async () => {
  for (const item of items) await createPillarCampaignItem(item);
})();
```

`db.transaction` saat ini hanya mengembalikan callback dan bukan transaksi PostgreSQL nyata.

**Code Sesudah (Proposed/After)**

```js
export async function createPillarCampaignBundle({ campaign, items }) {
  const tenantId = getActiveTenantId();
  return withPgTransaction(async client => {
    await insertPillarCampaign(client, tenantId, campaign);
    const createdItems = await insertPillarCampaignItems(client, campaign.id, items);
    if (createdItems !== items.length) throw new Error('OPC_ITEM_COUNT_MISMATCH');
    return { campaignId: campaign.id, expectedItems: items.length, createdItems };
  });
}
```

`createPillarCampaign()` juga menerima `account_name` dan `source_planner_id` untuk kompatibilitas jalur lain.

### 5.3 `lib/pillar-campaign-ingest.js`

**Code Sebelum (Current/Before)**

```js
await createPillarCampaign({
  brand_profile_id: globalSettings.brand_profile_id || planner.brand_id || null,
  // target_demographic tidak diteruskan
});
```

**Code Sesudah (Proposed/After)**

```js
await createPillarCampaignBundle({
  campaign: {
    account_name: globalSettings.account_name || planner.account_name,
    brand_profile_id: validatedBrandProfile.id,
    source_planner_id: planner.id,
    target_demographic: globalSettings.target_demographic,
    target_demographic_custom: globalSettings.target_demographic_custom,
    visual_overrides_json: normalizedVisualOverrides
  },
  items
});
```

Jalur idempotent hanya dianggap `reused` jika campaign existing mempunyai item sesuai jumlah yang diharapkan. Campaign kosong menghasilkan kode `OPC_INCOMPLETE_CAMPAIGN`, bukan sukses palsu.

### 5.4 `app/components/ImportPlannerModal.js`

**Code Sebelum (Current/Before)**

```js
onChange={e => {
  setAccountName(e.target.value);
  // selectedBrandId tidak berubah
}}
```

**Code Sesudah (Proposed/After)**

```js
onChange={e => {
  const profile = brandProfiles.find(bp => bp.id === e.target.value);
  setSelectedBrandId(profile?.id || '');
  setAccountName(profile?.account_name || profile?.brand_name || '');
}}
```

Payload mengirim kedua nilai:

```js
global_settings: {
  account_name: accountName,
  brand_profile_id: selectedBrandId,
  target_demographic: targetDemographic,
  target_demographic_custom: targetDemographicCustom
}
```

### 5.5 `app/pillar-campaigns/page.js`

**Code Sebelum (Current/Before)**

```jsx
<option value="nutribake">nutribake</option>
<option value="siasatsehat">siasatsehat</option>
```

Mass production `global_settings` juga belum mengirim account dan target demografi.

**Code Sesudah (Proposed/After)**

```jsx
{brandProfiles.map(profile => (
  <option key={profile.id} value={profile.id}>{profile.brand_name}</option>
))}
```

```js
global_settings: {
  account_name: selectedBrand?.brand_name,
  brand_profile_id: selectedBrand?.id,
  target_demographic: targetDemographic,
  target_demographic_custom: targetDemographicCustom
}
```

Scheduler panel menampilkan status efektif dan alasan jika worker mati.

### 5.6 `app/api/v2/pillar-campaigns/route.js`

**Code Sebelum (Current/Before)**

```js
parsedBody = {
  campaign_name: formData.get('campaign_name'),
  brand_profile_id: formData.get('brand_profile_id') || null
  // account_name diabaikan
};
await createPillarCampaign(...);
await createPillarCampaignItem(...);
```

**Code Sesudah (Proposed/After)**

```js
const accountName = formData.get('account_name');
const brand = await requireTenantBrandProfile(brandProfileId, accountName);
const result = await createPillarCampaignBundle({
  campaign: { ...normalizedCampaign, account_name: brand.accountName, brand_profile_id: brand.id },
  items: [normalizedItem]
});
return NextResponse.json({ campaign_id: result.campaignId, expected_items: 1, created_items: 1 }, { status: 201 });
```

### 5.7 `app/api/v2/pillar-campaigns/bulk/route.js`

**Code Sebelum (Current/Before)**

```js
await createPillarCampaign(globalCampaign);
await db.transaction(async () => {
  for (const row of rows_data) await createPillarCampaignItem(row);
})();
```

**Code Sesudah (Proposed/After)**

```js
const result = await createPillarCampaignBundle({
  campaign: normalizeGlobalSettings(global_settings),
  items: rows_data.map(normalizeBulkItem)
});
return NextResponse.json({
  success: true,
  campaign_id: result.campaignId,
  expected_items: rows_data.length,
  created_items: result.createdItems
}, { status: 201 });
```

### 5.8 `lib/campaign-config-labels.js` — file baru

**Code Sebelum (Current/Before)**

```js
// Label tersebar dan preset baru tidak dikenali halaman detail.
```

**Code Sesudah (Proposed/After)**

```js
export const AUDIENCE_DEMOGRAPHIC_LABELS = {
  ibu_rumah_tangga: 'Ibu Rumah Tangga & Keluarga',
  genz_casual: 'Gen-Z & Milenial Muda',
  professional_executive: 'Profesional & Worker',
  hijab_syari_family: 'Keluarga Hijrah & Syari',
  fitness_health_enthusiast: 'Penggiat Olahraga & Kesehatan'
};

export const SUBJECT_DEMOGRAPHIC_LABELS = {
  syari_classic: "Wanita Gamis Syar'i (Hanya Tangan)",
  caucasian_male: 'Pria Kaukasia (Hanya Tangan)'
};
```

### 5.9 `app/pillar-campaigns/[id]/page.js`

**Code Sebelum (Current/Before)**

```jsx
{getDemographicLabel(campaign.target_demographic, campaign.target_demographic_custom)}
// Dipakai juga pada Demografi Subjek / Model.
```

**Code Sesudah (Proposed/After)**

```js
const visualOverrides = safeParseVisualOverrides(campaign.visual_overrides_json);
```

```jsx
<span>{getAudienceDemographicLabel(campaign.target_demographic, campaign.target_demographic_custom)}</span>
<span>{getSubjectDemographicLabel(visualOverrides.subject_demographic, visualOverrides.subject_demographic_custom)}</span>
```

Brand ditampilkan dengan fallback:

```jsx
{campaign.account_name || campaign.brand_name || 'Tidak Ditentukan'}
```

### 5.10 `lib/campaign-scheduler.js`

**Code Sebelum (Current/Before)**

```js
export function isCampaignSchedulerRunning() {
  return state.isRunning;
}
```

**Code Sesudah (Proposed/After)**

```js
export function getCampaignSchedulerRuntimeStatus() {
  return {
    running: state.isRunning,
    active_tasks: state.activeTasks.size,
    last_tick_at: state.lastTickAt,
    last_error: state.lastError
  };
}
```

Tick mencatat waktu dan error terakhir tanpa mengekspos secret.

### 5.11 `app/api/v2/pillar-campaigns/scheduler-control/route.js`

**Code Sebelum (Current/Before)**

```js
return NextResponse.json({ success: true, isSchedulerActive });
```

**Code Sesudah (Proposed/After)**

```js
return NextResponse.json({
  success: true,
  scheduler: {
    process_enabled: process.env.ENABLE_CAMPAIGN_SCHEDULER !== 'false',
    worker_enabled: isWorkerEnabled(),
    tenant_enabled: await getSetting('opc_campaigns_scheduler_active') !== 'false',
    runtime_running: getCampaignSchedulerRuntimeStatus().running,
    effective_active: processEnabled && workerEnabled && tenantEnabled && runtimeRunning,
    restart_required: !processEnabled || !workerEnabled
  }
});
```

POST hanya mengubah tenant toggle dan mengembalikan status efektif terbaru.

### 5.12 `.env.staging.local.example` dan `.env.staging.local`

**Code Sebelum (Current/Before)**

```env
ENABLE_CAMPAIGN_SCHEDULER=false
ENABLE_SCHEDULER_WORKER=false
```

**Code Sesudah (Proposed/After)**

```env
ENABLE_CAMPAIGN_SCHEDULER=true
ENABLE_SCHEDULER_WORKER=true
```

Perubahan `.env.staging.local` dilakukan hanya setelah schema/item test lulus. Production mengikuti node topology dan tidak otomatis mengaktifkan worker di semua node.

### 5.13 `scripts/repair-opc-campaign.mjs` — file baru

**Code Sebelum (Current/Before)**

```js
// Tidak ada alat pemulihan campaign yatim.
```

**Code Sesudah (Proposed/After)**

```js
// Default dry-run:
npm run repair:opc -- --campaign opc_260802_zr0a5x

// Apply eksplisit setelah preview disetujui:
npm run repair:opc -- --campaign opc_260802_zr0a5x --apply
```

Script memverifikasi tenant, campaign kosong, planner/row sumber, Brand Profile, konfigurasi demografi/VSO, lalu membuat item menggunakan transaksi bundle. Script idempotent dan menolak apply jika item sudah tersedia.

### 5.14 `scripts/test-opc-integrity.mjs` — file baru

**Code Sebelum (Current/Before)**

```js
// Belum ada regression test integritas OPC multi-tenant.
```

**Code Sesudah (Proposed/After)**

```js
await testItemIdentitySequence();
await testCampaignRollbackWhenItemFails();
await testBrandAndAudiencePropagation();
await testVisualSubjectLabel();
await testSchedulerEffectiveStatus();
await testCrossTenantBrandRejected();
```

## 6. Strategi Verifikasi

1. Jalankan migrasi dua kali dan pastikan sequence tetap valid.
2. Buat campaign single dan pastikan tepat satu item tersimpan.
3. Buat campaign bulk 3 baris dan pastikan tepat tiga item tersimpan.
4. Paksa kegagalan item kedua dan pastikan campaign serta item pertama ikut rollback.
5. Import planner dengan Nutribake, `ibu_rumah_tangga`, dan `syari_classic`.
6. Pastikan API detail mengembalikan Brand Profile, target audiens, dan VSO yang berbeda.
7. Pastikan UI menampilkan:
   - `nutribake`
   - `Ibu Rumah Tangga & Keluarga`
   - `Wanita Gamis Syar'i (Hanya Tangan)`
8. Pastikan scheduler API tidak mengklaim aktif ketika environment gate mati.
9. Aktifkan scheduler staging, restart, dan pastikan `effective_active=true` serta `last_tick_at` berubah.
10. Dry-run lalu repair `opc_260802_zr0a5x`; pastikan item terbentuk dan generation bergerak dari `pending`.
11. Jalankan regression Content Planner, Operator API, build, dan staging smoke check.

## 7. Strategi Rilis

- Patch release setelah seluruh test dan repair staging berhasil.
- Changelog mencatat schema item identity, OPC atomic bundle, configuration propagation, VSO display, dan scheduler observability.
- Verifikasi `origin/main`, tag rilis, dan staging version setelah restart.

## Execution Task List

- [x] Tambahkan migrasi identity sequence item OPC dan metadata campaign.
- [x] Implementasikan repository transaksi nyata campaign + items.
- [x] Migrasikan jalur OPC single ke campaign bundle atomik.
- [x] Migrasikan jalur OPC bulk ke campaign bundle atomik.
- [x] Migrasikan Import Planner/Operator ingest ke campaign bundle atomik.
- [x] Perbaiki sinkronisasi dropdown account dengan Brand Profile ID.
- [x] Propagasikan account dan target demografi pada seluruh jalur OPC.
- [x] Tambahkan shared label map audiens dan subjek visual.
- [x] Perbaiki halaman detail agar membaca VSO dari JSON yang benar.
- [x] Tambahkan scheduler runtime observability dan effective status API.
- [x] Perbaiki panel/toggle scheduler agar menampilkan alasan yang jujur.
- [x] Tambahkan regression test OPC identity, rollback, konfigurasi, tenant, dan scheduler.
- [x] Jalankan test, build, dan smoke test staging.
- [x] Aktifkan campaign scheduler pada local staging pilot dan restart.
- [x] Jalankan dry-run pemulihan `opc_260802_zr0a5x`.
- [x] Terapkan pemulihan setelah hasil dry-run diverifikasi.
- [x] Verifikasi campaign memiliki item dan pipeline mulai berjalan.
- [x] Perbarui checkbox secara real-time selama eksekusi.
- [ ] Jalankan patch release serta sinkronisasi `main` dan tag sesuai SOP.
