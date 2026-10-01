# Implementation Plan: Dukungan Page Source pada Deconstruct Lab

## 1. Ringkasan Kebutuhan
Menambahkan fitur identifikasi sumber halaman/kreator (**Page Source**) pada modul **Deconstruct Lab**:
1. **Modal "Simpan URL ke Library"**: Penambahan field input `Page Source` (misal: `@dr.richardlee`, `TikTok Dapur Mama`, `Facebook Fanspage X`) pada input manual dan parsing kolom `page_source` pada mode CSV.
2. **Tabel URL Pustaka**: Penambahan kolom `Page Source` yang diposisikan **sebelum kolom URL** dengan tampilan badge/teks yang rapi dan konsisten dengan token CSS semantik.
3. **Database & API Backend**: Migrasi kolom `page_source TEXT` pada tabel `re_deconstructed_assets`, **backfill data lama menjadi `Siasat Sehat`**, adaptasi fungsi `createSavedDeconstructAssets`, `listDeconstructAssets`, `getDeconstructAssetById`, dan endpoint API `/api/v2/deconstruct` serta `/api/v2/deconstruct/assets/[id]`.

---

## 2. Execution Task List
- [x] **Task 1: Mockup HTML Interaktif**
  - Buat & uji file standalone mockup `public/mockup_deconstruct_page_source.html` untuk memverifikasi tata letak input modal dan posisi kolom sebelum URL baik di mode gelap maupun terang.
- [x] **Task 2: Database Schema, Backfill & Data Layer (`lib/db-pg.js` & `lib/db.js`)**
  - Tambahkan migrasi otomatis `ALTER TABLE re_deconstructed_assets ADD COLUMN IF NOT EXISTS page_source TEXT;` di `lib/db-pg.js`.
  - **Jalankan backfill data existing**: `UPDATE re_deconstructed_assets SET page_source = 'Siasat Sehat' WHERE page_source IS NULL OR page_source = '';` di `lib/db-pg.js`.
  - Update `createSavedDeconstructAssets` di `lib/db.js` agar menerima dan menyimpan `page_source`.
  - Update `listDeconstructAssets` di `lib/db.js` agar menyertakan pencarian `page_source` pada parameter filter query `q`.
  - Update `updateDeconstructAsset` / API PUT untuk mengizinkan perubahan metadata `page_source`.
- [x] **Task 3: Backend API Endpoint (`app/api/v2/deconstruct/route.js` & `app/api/v2/deconstruct/assets/[id]/route.js`)**
  - Adaptasi handler `POST /api/v2/deconstruct` untuk mengekstrak `page_source` dari payload body manual maupun CSV.
  - Adaptasi handler `PUT /api/v2/deconstruct/assets/[id]` untuk mendukung update field `page_source`.
- [x] **Task 4: Antarmuka Frontend Deconstruct (`app/deconstruct/page.js`)**
  - Tambahkan state `pageSourceInput` pada form modal Simpan URL.
  - Tambahkan field input `Page Source` di atas / di dalam modal form simpan URL.
  - Tambahkan parser kolom `page_source` / `source` / `page` / `creator` pada parser CSV `handleCsvUpload`.
  - Ubah susunan tabel pustaka URL: Tempatkan header `<th>Page Source</th>` dan `<td>` persis sebelum kolom `URL`.
- [x] **Task 5: Detail View & Metadata Update (`app/deconstruct/[id]/page.js`)**
  - Tampilkan informasi `Page Source` pada header detail aset dan izinkan pengeditan pada form metadata jika diperlukan.
- [x] **Task 6: Pengujian Unit Test & Verifikasi**
  - Jalankan test suite `tests/deconstruct-library.test.js` untuk memastikan backward-compatibility dan isolasi multi-tenant tetap 100% valid.

---

## 3. Detail File & Snippet Sebelum / Sesudah

### 3.1. `lib/db-pg.js`
Menambahkan auto-migration kolom `page_source` dan backfill nilai default `'Siasat Sehat'` untuk seluruh aset existing pada tabel `re_deconstructed_assets`.

#### Code Sebelum (Current/Before):
```javascript
        await runSafeQuery(`ALTER TABLE re_deconstruct_batches ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default_tenant';`);
        await runSafeQuery(`ALTER TABLE re_deconstructed_assets ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default_tenant';`);
        await runSafeQuery(`ALTER TABLE re_deconstructed_assets ADD COLUMN IF NOT EXISTS niche TEXT;`);
        await runSafeQuery(`ALTER TABLE re_deconstructed_assets ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ;`);
        await runSafeQuery(`ALTER TABLE re_deconstructed_assets ADD COLUMN IF NOT EXISTS deconstructed_at TIMESTAMPTZ;`);
        await runSafeQuery(`ALTER TABLE re_deconstructed_assets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;`);
```

#### Code Sesudah (Proposed/After):
```javascript
        await runSafeQuery(`ALTER TABLE re_deconstruct_batches ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default_tenant';`);
        await runSafeQuery(`ALTER TABLE re_deconstructed_assets ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default_tenant';`);
        await runSafeQuery(`ALTER TABLE re_deconstructed_assets ADD COLUMN IF NOT EXISTS page_source TEXT;`);
        await runSafeQuery(`UPDATE re_deconstructed_assets SET page_source = 'Siasat Sehat' WHERE page_source IS NULL OR page_source = '';`);
        await runSafeQuery(`ALTER TABLE re_deconstructed_assets ADD COLUMN IF NOT EXISTS niche TEXT;`);
        await runSafeQuery(`ALTER TABLE re_deconstructed_assets ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ;`);
        await runSafeQuery(`ALTER TABLE re_deconstructed_assets ADD COLUMN IF NOT EXISTS deconstructed_at TIMESTAMPTZ;`);
        await runSafeQuery(`ALTER TABLE re_deconstructed_assets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;`);
```

---

### 3.2. `lib/db.js`
Menyimpan `page_source` pada saat insert URL dan menyertakan `page_source` dalam pencarian filter.

#### Code Sebelum (Current/Before):
```javascript
export async function createSavedDeconstructAssets(items, niche, tenantId) {
  let savedCount = 0;
  let duplicateCount = 0;
  const savedIds = [];

  await withPgTransaction(async () => {
    for (const item of items) {
      const existing = await dbGet(
        'SELECT id FROM re_deconstructed_assets WHERE tenant_id = ? AND source_url = ? LIMIT 1',
        [tenantId, item.url]
      );
      if (existing) {
        duplicateCount++;
        continue;
      }
      const id = crypto.randomUUID();
      await dbRun(
        'INSERT INTO re_deconstructed_assets (id, tenant_id, source_url, original_caption, status, niche) VALUES (?, ?, ?, ?, ?, ?)',
        [id, tenantId, item.url, item.caption || null, 'saved', niche]
      );
      savedIds.push(id);
      savedCount++;
    }
  });
  return { savedCount, duplicateCount, savedIds };
}
```

#### Code Sesudah (Proposed/After):
```javascript
export async function createSavedDeconstructAssets(items, niche, tenantId) {
  let savedCount = 0;
  let duplicateCount = 0;
  const savedIds = [];

  await withPgTransaction(async () => {
    for (const item of items) {
      const existing = await dbGet(
        'SELECT id FROM re_deconstructed_assets WHERE tenant_id = ? AND source_url = ? LIMIT 1',
        [tenantId, item.url]
      );
      if (existing) {
        duplicateCount++;
        continue;
      }
      const id = crypto.randomUUID();
      await dbRun(
        'INSERT INTO re_deconstructed_assets (id, tenant_id, source_url, page_source, original_caption, status, niche) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, tenantId, item.url, item.page_source || null, item.caption || null, 'saved', niche]
      );
      savedIds.push(id);
      savedCount++;
    }
  });
  return { savedCount, duplicateCount, savedIds };
}
```

Dan pada `listDeconstructAssets`:
#### Code Sebelum (Current/Before):
```javascript
  if (q) {
    query += ' AND (source_url LIKE ? OR original_caption LIKE ? OR viral_pattern_summary LIKE ?)';
    const likeVal = `%${q}%`;
    params.push(likeVal, likeVal, likeVal);
  }
```

#### Code Sesudah (Proposed/After):
```javascript
  if (q) {
    query += ' AND (source_url LIKE ? OR page_source LIKE ? OR original_caption LIKE ? OR viral_pattern_summary LIKE ?)';
    const likeVal = `%${q}%`;
    params.push(likeVal, likeVal, likeVal, likeVal);
  }
```

---

### 3.3. `app/api/v2/deconstruct/route.js`
Parsing `page_source` pada saat import batch / manual.

#### Code Sebelum (Current/Before):
```javascript
    if (body.csv_data && Array.isArray(body.csv_data)) {
      items = body.csv_data
        .filter(row => row.url && row.url.trim())
        .map(row => ({
          url: row.url.trim(),
          caption: (row.caption || '').trim() || null,
        }));
    } else if (body.urls) {
      const urls = body.urls
        .split('\n')
        .map(u => u.trim())
        .filter(u => u.length > 0);

      const captions = body.captions
        ? body.captions.split('\n').map(c => c.trim())
        : [];

      items = urls.map((url, i) => ({
        url,
        caption: captions[i] || null,
      }));
    }
```

#### Code Sesudah (Proposed/After):
```javascript
    const defaultPageSource = (body.page_source && body.page_source.trim()) ? body.page_source.trim() : null;

    if (body.csv_data && Array.isArray(body.csv_data)) {
      items = body.csv_data
        .filter(row => row.url && row.url.trim())
        .map(row => ({
          url: row.url.trim(),
          page_source: (row.page_source || '').trim() || defaultPageSource,
          caption: (row.caption || '').trim() || null,
        }));
    } else if (body.urls) {
      const urls = body.urls
        .split('\n')
        .map(u => u.trim())
        .filter(u => u.length > 0);

      const captions = body.captions
        ? body.captions.split('\n').map(c => c.trim())
        : [];

      items = urls.map((url, i) => ({
        url,
        page_source: defaultPageSource,
        caption: captions[i] || null,
      }));
    }
```

---

### 3.4. `app/deconstruct/page.js`
Menambahkan input Page Source pada modal dan kolom Page Source sebelum URL pada tabel.

#### Code Sebelum (Current/Before - Modal Form):
```javascript
              <form onSubmit={handleSaveUrls}>
                {/* Niche Input */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Niche Konten (Opsional - Kosongkan untuk Deteksi Otomatis)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Skincare, Gadget, Kuliner"
                    value={nicheInput}
                    onChange={(e) => setNicheInput(e.target.value)}
                    style={{ ... }}
                  />
                </div>
```

#### Code Sesudah (Proposed/After - Modal Form):
```javascript
              <form onSubmit={handleSaveUrls}>
                {/* Page Source Input (Baru) */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Page Source / Sumber Konten (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: @dr.richardlee, TikTok Resep Bunda, FB Page X"
                    value={pageSourceInput}
                    onChange={(e) => setPageSourceInput(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--surface-interactive)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: 10,
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Niche Input */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Niche Konten (Opsional - Kosongkan untuk Deteksi Otomatis)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Skincare, Gadget, Kuliner"
                    value={nicheInput}
                    onChange={(e) => setNicheInput(e.target.value)}
                    style={{ ... }}
                  />
                </div>
```

#### Code Sebelum (Current/Before - Tabel Head & Body):
```javascript
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        disabled={eligibleAssets.length === 0}
                      />
                    </th>
                    <th>URL</th>
                    <th style={{ width: 130 }}>Niche</th>
                    <th style={{ width: 110 }}>Proses</th>
                    <th style={{ width: 220 }}>Keterangan</th>
                    <th style={{ width: 140 }}>Tgl Input</th>
                    <th style={{ width: 140 }}>Tgl Analisis</th>
                    <th style={{ width: 100, textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => {
                    const statusOpt = getStatusStyle(asset.status);
                    const isEligible = ['saved', 'failed'].includes(asset.status);
                    return (
                      <tr key={asset.id} style={{ opacity: ['downloading', 'uploading', 'analyzing'].includes(asset.status) ? 0.85 : 1 }}>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(asset.id)}
                            onChange={(e) => handleSelectOne(asset.id, e.target.checked)}
                            disabled={!isEligible}
                          />
                        </td>
                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <a
                            href={asset.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--accent-light)', textDecoration: 'none', fontWeight: 500 }}
                          >
                            {asset.source_url.replace(/https?:\/\/(www\.)?/, '')}
                          </a>
                        </td>
```

#### Code Sesudah (Proposed/After - Tabel Head & Body):
```javascript
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        disabled={eligibleAssets.length === 0}
                      />
                    </th>
                    <th style={{ width: 150 }}>Page Source</th>
                    <th>URL</th>
                    <th style={{ width: 130 }}>Niche</th>
                    <th style={{ width: 110 }}>Proses</th>
                    <th style={{ width: 220 }}>Keterangan</th>
                    <th style={{ width: 140 }}>Tgl Input</th>
                    <th style={{ width: 140 }}>Tgl Analisis</th>
                    <th style={{ width: 100, textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => {
                    const statusOpt = getStatusStyle(asset.status);
                    const isEligible = ['saved', 'failed'].includes(asset.status);
                    return (
                      <tr key={asset.id} style={{ opacity: ['downloading', 'uploading', 'analyzing'].includes(asset.status) ? 0.85 : 1 }}>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(asset.id)}
                            onChange={(e) => handleSelectOne(asset.id, e.target.checked)}
                            disabled={!isEligible}
                          />
                        </td>
                        <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{
                            display: 'inline-block',
                            background: 'var(--surface-interactive)',
                            color: 'var(--text-primary)',
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            border: '1px solid var(--border-subtle)',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }} title={asset.page_source || '—'}>
                            {asset.page_source ? `🏷️ ${asset.page_source}` : '—'}
                          </span>
                        </td>
                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <a
                            href={asset.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--accent-light)', textDecoration: 'none', fontWeight: 500 }}
                          >
                            {asset.source_url.replace(/https?:\/\/(www\.)?/, '')}
                          </a>
                        </td>
```
