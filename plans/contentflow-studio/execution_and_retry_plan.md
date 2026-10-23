# Rencana Implementasi: Perbaikan Eksekusi Batch/Slot, Penanganan Konten Overdue & Mekanisme Retry ContentFlow Studio

## 1. Analisis & Jawaban: Penanganan 5 Konten yang Sudah Lewat Jam Produksinya

### Kondisi Real di Database Dev Saat Ini (Waktu Acuan: 23 Oktober 2026, 10:45 WIB):
1. **Slot 1 (Multiplier)**: Jadwal Prod: `22/10 05:05` (Lewat 29 jam), Jadwal Tayang: `23/10 05:05` (Lewat 5 jam).
2. **Slot 1 (Recipe)**: Jadwal Prod: `22/10 05:13` (Lewat 29 jam), Jadwal Tayang: `23/10 05:13` (Lewat 5 jam).
3. **Slot 1 (Real Estate)**: Jadwal Prod: `23/10 05:25` (Lewat 5 jam), Jadwal Tayang: `24/10 05:16` (Besok / Masa Depan).
4. **Slot 2 (Multiplier)**: Jadwal Prod: `23/10 05:05` (Lewat 5 jam), Jadwal Tayang: `24/10 05:05` (Besok / Masa Depan).
5. **Slot 3 (Multiplier)**: Jadwal Prod: `24/10 05:05` (Besok / Masa Depan), Jadwal Tayang: `25/10 05:05` (Lusa).

---

### Bagaimana Mesin Worker Menangani Konten yang Jam Produksinya Lewat?
1. **Logika Standar Background Worker (`claimDueStudioSlot`)**:
   Query SQL yang digunakan oleh worker untuk mengambil antrean adalah:
   ```sql
   WHERE s.activation_status = 'active'
     AND s.stage_status = 'pending'
     AND s.scheduled_production_at <= CURRENT_TIMESTAMP
   ```
   **Kesimpulan Teknis**: Bagi 4 konten yang `scheduled_production_at`-nya sudah di masa lampau, begitu batch/slot diaktifkan (`stage_status='pending'`, `activation_status='active'`), sistem menganggapnya sebagai **Overdue / Due Now (Jatuh Tempo Seketika)**. Worker AI akan **langsung memprioritaskan dan memproduksinya detik itu juga** (tidak tertahan).

2. **Penanganan Jadwal Tayang (`scheduled_publish_at`) yang Sudah Lewat (Slot 1 Multiplier & Slot 1 Recipe)**:
   - **Produksi Video**: Tetap berhasil diproses dan dirender menjadi aset MP4 & script.
   - **Publikasi ke Sosmed**: Karena status awal posting adalah `awaiting_approval`, konten **TIDAK AKAN** terposting sembarangan ke sosmed.
   - **Fitur Penyelamat di UI**:
     - User dapat memanfaatkan form **"Reschedule Jadwal Tayang"** di modal slot detail untuk memajukan jadwal tayang ke jam/hari berikutnya (misal sore ini jam 15:00 WIB atau besok pagi).
     - Atau, jika ingin diposting saat itu juga, user bisa langsung mengklik **"Publikasikan Sekarang"** setelah video selesai dirender.

---

## 2. Mockup HTML Interaktif
Sesuai SOP, simulasi interaktif telah dibuat di:
👉 **[public/mockup_contentflow_execution_retry.html](file:///Users/sabeqmmursyid/_contentflow-staging/public/mockup_contentflow_execution_retry.html)**
*(Mendemonstrasikan aktivasi batch v3, eksekusi instan slot overdue, tombol retry manual, dan penyesuaian jadwal tayang).*

---

## ## Execution Task List

- [x] **Task 1: Perbaiki Guard `config_version` pada API Batch Actions**
  - File: `app/api/v2/contentflow-studio/batches/[id]/actions/route.js`
  - Izinkan `config_version = 3` (schema baru yang saat ini digunakan di server dev).
- [x] **Task 2: Tambahkan Aksi `dispatch_now` dan Force Trigger pada API Slot Actions**
  - File: `app/api/v2/contentflow-studio/slots/[id]/actions/route.js`
  - Mendukung eksekusi langsung dari status `draft` atau antre ulang dari status manapun.
- [x] **Task 3: Aktifkan Worker Studio di PM2 Ecosystem & Instrumentation**
  - File: `ecosystem.macmini.config.cjs` & `instrumentation.js`
  - Pasang environment variable `ENABLE_CONTENTFLOW_STUDIO: 'true'` untuk environment Dev & Staging.
- [x] **Task 4: Tambahkan Tombol Eksekusi Cepat & Banner Overdue pada UI Studio**
  - File: `app/components/contentflow-studio/StudioWorkspace.js`
  - Tambahkan tombol `⚡ Eksekusi Sekarang` pada baris tabel slot berstatus `draft`.
  - Tambahkan tombol `🔄 Retry AI` langsung di baris tabel untuk slot `failed`.
  - Sediakan tombol eksekusi dan penyesuaian jadwal tayang di modal slot detail.
- [ ] **Task 5: Verifikasi di Server Dev & Aktivasi 5 Konten Eksisting**
  - Build dan reload PM2 dev (`maknaflow-dev-ui` & `maknaflow-dev-api`).
  - Verifikasi aktivasi 3 batch dan perhatikan antrean 5 slot terproses oleh worker.

---

## 3. Before & After Code Snippets

### File 1: `app/api/v2/contentflow-studio/batches/[id]/actions/route.js`

#### Code Sebelum (Current/Before):
```javascript
// Baris 12-14:
const batch = (await client.query('SELECT * FROM content_studio_batches WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [id,tenantId])).rows[0];
if (!batch) throw Object.assign(Error('Batch tidak ditemukan.'), { status:404 });
if (!batch.engine_kind || batch.config_version !== 2) throw Object.assign(Error('Batch legacy membutuhkan review.'), { status:409 });
```

#### Code Sesudah (Proposed/After):
```javascript
// Mendukung config_version 2 maupun 3 (schema modern ContentFlow Studio):
const batch = (await client.query('SELECT * FROM content_studio_batches WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [id,tenantId])).rows[0];
if (!batch) throw Object.assign(Error('Batch tidak ditemukan.'), { status:404 });
if (!batch.engine_kind || (batch.config_version !== 2 && batch.config_version !== 3)) {
  throw Object.assign(Error('Batch legacy membutuhkan review.'), { status:409 });
}
```

---

### File 2: `app/api/v2/contentflow-studio/slots/[id]/actions/route.js`

#### Code Sebelum (Current/Before):
```javascript
// Hanya menangani 'retry_production' dan 'reschedule':
if (action === 'retry_production') {
  const updateRes = await pgQuery(`
    UPDATE content_studio_slots
    SET stage_status = 'pending',
        error_message = NULL,
        progress_percent = 0,
        dispatched_at = NULL,
        completed_at = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND tenant_id = $2
    RETURNING *
  `, [id, tenantId]);
  ...
}
```

#### Code Sesudah (Proposed/After):
```javascript
// Menambahkan penanganan 'dispatch_now' untuk slot draft/overdue:
if (action === 'dispatch_now' || action === 'retry_production') {
  // Pastikan batch induk juga aktif jika sebelumnya masih draft
  await pgQuery(
    `UPDATE content_studio_batches SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2 AND status = 'draft'`,
    [slot.batch_id, tenantId]
  );

  const updateRes = await pgQuery(`
    UPDATE content_studio_slots
    SET stage_status = 'pending',
        activation_status = 'active',
        scheduled_production_at = LEAST(scheduled_production_at, CURRENT_TIMESTAMP),
        error_message = NULL,
        progress_percent = 0,
        dispatched_at = NULL,
        completed_at = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND tenant_id = $2
    RETURNING *
  `, [id, tenantId]);
  
  const updatedSlot = updateRes.rows[0];
  ...
}
```

---

### File 3: `ecosystem.macmini.config.cjs`

#### Code Sebelum (Current/Before):
```javascript
// Baris 128-135 (maknaflow-dev-ui env):
env: {
  NODE_ENV: 'production',
  APP_ENV: 'development',
  NODE_ROLE: 'standalone',
  PORT: 5020,
  HOSTNAME: '0.0.0.0',
  TZ: 'Asia/Jakarta',
  MAKNA_SCHEDULER: '1',
  ENABLE_PUBLISHING_WORKER: 'true',
  ENABLE_AGENT_AUTOMATION_WORKER: 'true',
  ENABLE_FACEBOOK_LIVE: 'true',
  ENABLE_FACEBOOK_REELS_PUBLISHING: 'true',
  FFPROBE_PATH: '/opt/homebrew/bin/ffprobe',
  PG_SEARCH_PATH: 'dev',
  PGPOOL_MAX: '3',
},
```

#### Code Sesudah (Proposed/After):
```javascript
// Menambahkan ENABLE_CONTENTFLOW_STUDIO: 'true':
env: {
  NODE_ENV: 'production',
  APP_ENV: 'development',
  NODE_ROLE: 'standalone',
  PORT: 5020,
  HOSTNAME: '0.0.0.0',
  TZ: 'Asia/Jakarta',
  MAKNA_SCHEDULER: '1',
  ENABLE_PUBLISHING_WORKER: 'true',
  ENABLE_CONTENTFLOW_STUDIO: 'true',
  ENABLE_AGENT_AUTOMATION_WORKER: 'true',
  ENABLE_FACEBOOK_LIVE: 'true',
  ENABLE_FACEBOOK_REELS_PUBLISHING: 'true',
  FFPROBE_PATH: '/opt/homebrew/bin/ffprobe',
  PG_SEARCH_PATH: 'dev',
  PGPOOL_MAX: '3',
},
```

---

### File 4: `app/components/contentflow-studio/StudioWorkspace.js`

#### Code Sebelum (Current/Before):
```javascript
// Baris 741-773 (Aksi Tabel Slot):
<td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
  <button
    type="button"
    onClick={() => openSlot(s.id, 'log')}
    style={{ ... }}
  >
    📜 Log
  </button>
  <button
    type="button"
    onClick={() => openSlot(s.id, 'details')}
    style={{ ... }}
  >
    Tinjau
  </button>
</td>
```

#### Code Sesudah (Proposed/After):
```javascript
// Baris 741-773 (Aksi Tabel Slot):
<td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
  {s.stage_status === 'draft' && (
    <button
      type="button"
      onClick={() => handleDispatchNow(s.id)}
      style={{
        padding: '4px 10px',
        borderRadius: '6px',
        border: 'none',
        background: 'var(--action-primary)',
        color: 'var(--on-action-primary)',
        cursor: 'pointer',
        fontSize: '0.78rem',
        fontWeight: 600,
        marginRight: '6px'
      }}
      title="Mulai eksekusi antrean worker sekarang"
    >
      ⚡ Eksekusi
    </button>
  )}
  {s.stage_status === 'failed' && (
    <button
      type="button"
      onClick={() => handleQuickRetry(s.id)}
      style={{
        padding: '4px 10px',
        borderRadius: '6px',
        border: '1px solid var(--status-danger)',
        background: 'var(--status-danger-soft)',
        color: 'var(--status-danger)',
        cursor: 'pointer',
        fontSize: '0.78rem',
        fontWeight: 600,
        marginRight: '6px'
      }}
      title="Ulangi produksi AI"
    >
      🔄 Retry
    </button>
  )}
  <button
    type="button"
    onClick={() => openSlot(s.id, 'log')}
    style={{ ... }}
  >
    📜 Log
  </button>
  <button
    type="button"
    onClick={() => openSlot(s.id, 'details')}
    style={{ ... }}
  >
    Tinjau
  </button>
</td>
```
