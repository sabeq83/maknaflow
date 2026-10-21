# Implementation Plan: Recipe Labs Enhancements & Bugfix

Rencana implementasi ini mengatasi 3 kebutuhan utama pada menu **Recipe Labs**:
1. **Bugfix Network Error (`body is not defined`)**: Memperbaiki variabel payload saat pengiriman form kampanye resep.
2. **Filter Pencarian Referensi Video Dekonstruksi**: Menambahkan filter pencarian teks real-time (URL, tag, judul resep, niche) pada pemilihan referensi video dekonstruksi, disertai kartu informasi item terpilih dan tombol reset.
3. **Mockup Preview Preset Layout Kolase Asimetris**: Menampilkan kartu preset visual dan live preview mockup 1:1 interaktif yang langsung mencerminkan layout grid (3, 4, 5, 6 gambar), label slot (Bahan, Proses, Matang, Plating), serta slider gap, radius, dan background color.

---

## 📋 Execution Task List

- [x] **Task 1: Perbaikan Bug `body is not defined` (`app/recipe-labs/page.js`)**
  - [x] Perbaiki referensi objek pengiriman form dari `body.target_demographic` ke `payload.target_demographic` & `payload.target_demographic_custom`.
  - [x] Verifikasi penanganan error submit agar pesan kesalahan jelas dan tidak terjadi ReferenceError.

- [x] **Task 2: Penambahan Field Metadata pada API Aset Dekonstruksi (`app/api/recipe-labs/deconstructed-assets/route.js`)**
  - [x] Tambahkan field `tags`, `niche`, dan `original_caption` pada response JSON agar frontend dapat melakukan pencarian komprehensif multikriteria.

- [x] **Task 3: Implementasi Komponen Filter Pencarian Referensi Video Dekonstruksi (`app/recipe-labs/page.js`)**
  - [x] Tambahkan state `deconstructSearchQuery` dan fungsi filter pencarian pada form Static dan form Video (Accordion 1).
  - [x] Tambahkan input pencarian real-time dengan ikon 🔍, tombol clear `✖`, dan indikator jumlah kecocokan (match count).
  - [x] Tampilkan kartu/badge visual saat ada video yang terpilih lengkap dengan nama resep, URL, niche, tag, dan tombol pembatalan (reset).

- [x] **Task 4: Implementasi Live Mockup Preview Preset Layout Kolase (`app/recipe-labs/page.js`)**
  - [x] Sediakan pemetaan koordinat layout slot dari `lib/core/GridCoordinates.js` untuk 3, 4, 5, dan 6 gambar.
  - [x] Tambahkan kartu preset visual (preset cards) agar pengguna dapat memilih template layout secara visual.
  - [x] Tampilkan container live preview 1:1 interaktif di samping/bawah kontrol kolase yang merender slot gambar secara proporsional sesuai nilai `gridGapSize`, `gridBorderRadius`, `gridOuterPadding`, dan `gridBgColor`.

- [x] **Task 5: Pengujian & Verifikasi**
  - [x] Uji pengiriman form pembuatan kampanye (Static & Video) tanpa error.
  - [x] Uji filter pencarian dengan berbagai kata kunci (judul resep, URL, tagar).
  - [x] Uji responsivitas dan render live preview kolase pada mode Light dan Dark.
  - [x] Jalankan `npm run build` untuk memverifikasi bundle Next.js.

---

## 🔍 Before & After Code Snippets

### 1. `app/recipe-labs/page.js` — Perbaikan Error `body is not defined`

#### Code Sebelum (Current/Before):
```javascript
// app/recipe-labs/page.js:L494-L502
      body.target_demographic = targetDemographic;
      body.target_demographic_custom = targetDemographicCustom;
      const res = await fetch('/api/recipe-labs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
```

#### Code Sesudah (Proposed/After):
```javascript
// app/recipe-labs/page.js
      payload.target_demographic = targetDemographic;
      payload.target_demographic_custom = targetDemographicCustom;
      const res = await fetch('/api/recipe-labs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
```

---

### 2. `app/api/recipe-labs/deconstructed-assets/route.js` — Menyediakan Tag & Niche untuk Pencarian Frontend

#### Code Sebelum (Current/Before):
```javascript
// app/api/recipe-labs/deconstructed-assets/route.js:L41-L48
      return {
        id: a.id,
        source_url: a.source_url,
        label: displayLabel,
        recipe_suggestion: recipeIdea,
        raw_ideas: parsedIdeas
      };
```

#### Code Sesudah (Proposed/After):
```javascript
// app/api/recipe-labs/deconstructed-assets/route.js
      return {
        id: a.id,
        source_url: a.source_url,
        label: displayLabel,
        recipe_suggestion: recipeIdea,
        tags: a.tags || '',
        niche: a.niche || '',
        original_caption: a.original_caption || '',
        raw_ideas: parsedIdeas
      };
```

---

### 3. `app/recipe-labs/page.js` — Filter Pencarian Referensi Video Dekonstruksi

#### Code Sebelum (Current/Before):
```javascript
// app/recipe-labs/page.js:L926-L951
<div className="form-group">
  <label className="form-label">Gunakan Referensi Video Dekonstruksi (Opsional)</label>
  <select
    className="form-select"
    value={sourceDeconstructAssetId}
    onChange={(e) => {
      const assetId = e.target.value;
      setSourceDeconstructAssetId(assetId);
      if (assetId) {
        const selected = deconstructedAssets.find(a => a.id === assetId);
        if (selected && selected.recipe_suggestion) {
          setCategory('Custom Input');
          setCustomCategory(selected.recipe_suggestion);
        }
      } else {
        setCategory('Makanan');
        setCustomCategory('');
      }
    }}
  >
    <option value="">-- Tanpa Referensi (Buat Baru) --</option>
    {deconstructedAssets.map(asset => (
      <option key={asset.id} value={asset.id}>{asset.label}</option>
    ))}
  </select>
</div>
```

#### Code Sesudah (Proposed/After):
```javascript
// app/recipe-labs/page.js
<div className="form-group">
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <label className="form-label">Gunakan Referensi Video Dekonstruksi (Opsional)</label>
    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
      {filteredDeconstructAssets.length} dari {deconstructedAssets.length} referensi
    </span>
  </div>

  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
    <input
      type="text"
      placeholder="🔍 Cari referensi (judul resep, URL, #tagar, niche)..."
      value={deconstructSearchQuery}
      onChange={(e) => setDeconstructSearchQuery(e.target.value)}
      className="form-control"
      style={{ paddingLeft: '32px', fontSize: '0.84rem' }}
    />
    {deconstructSearchQuery && (
      <button
        type="button"
        onClick={() => setDeconstructSearchQuery('')}
        style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
      >
        ✖
      </button>
    )}
  </div>

  <select
    className="form-select"
    value={sourceDeconstructAssetId}
    onChange={(e) => handleDeconstructSelect(e.target.value)}
  >
    <option value="">-- Tanpa Referensi (Buat Baru) --</option>
    {filteredDeconstructAssets.map(asset => (
      <option key={asset.id} value={asset.id}>
        {asset.recipe_suggestion ? `${asset.recipe_suggestion} — ` : ''}{asset.label}
      </option>
    ))}
  </select>

  {selectedDeconstructAsset && (
    <div style={{ marginTop: '8px', padding: '10px 14px', background: 'var(--surface-interactive)', border: '1px solid var(--action-primary)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--action-primary)' }}>
          🍲 {selectedDeconstructAsset.recipe_suggestion || 'Referensi Terpilih'}
        </div>
        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
          {selectedDeconstructAsset.source_url}
        </div>
      </div>
      <button
        type="button"
        onClick={() => handleDeconstructSelect('')}
        className="btn btn-secondary"
        style={{ fontSize: '0.72rem', padding: '4px 8px' }}
      >
        ✖ Batalkan
      </button>
    </div>
  )}
</div>
```

---

### 4. `app/recipe-labs/page.js` — Visual Mockup Preview Preset Layout Kolase

#### Code Sebelum (Current/Before):
```javascript
// app/recipe-labs/page.js:L1100-L1145
<div className="form-group" style={{ marginBottom: '12px' }}>
  <label className="form-label">Preset Layout Kolase</label>
  <select
    className="select-field"
    value={selectedLayoutId}
    onChange={(e) => setSelectedLayoutId(e.target.value)}
  >
    {imagesPerRecipe === 4 && (
      <>
        <option value="4_editorial_split">Editorial Split (Default)</option>
        <option value="4_modern_masonry">Modern Masonry</option>
        <option value="4_landscape_cascade">Vertical Story Cascade 4</option>
      </>
    )}
    ...
  </select>
</div>
```

#### Code Sesudah (Proposed/After):
```javascript
// app/recipe-labs/page.js
// Penambahan Live Preview Box 1:1 + Preset Cards Selector
<div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) 280px', gap: '20px', marginTop: '12px' }}>
  <div>
    <label className="form-label">Preset Layout Kolase</label>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', marginBottom: '14px' }}>
      {availableLayouts.map(preset => (
        <div
          key={preset.id}
          onClick={() => setSelectedLayoutId(preset.id)}
          style={{
            padding: '8px',
            borderRadius: 'var(--radius-sm)',
            border: selectedLayoutId === preset.id ? '2px solid var(--action-primary)' : '1px solid var(--border-subtle)',
            background: selectedLayoutId === preset.id ? 'var(--surface-hover)' : 'var(--surface-interactive)',
            cursor: 'pointer',
            textAlign: 'center'
          }}
        >
          {/* Miniature 12-grid preview */}
          <div style={{ width: '100%', aspectRatio: '1/1', position: 'relative', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', marginBottom: '6px' }}>
            {preset.slots.map(s => (
              <div key={s.id} style={{
                position: 'absolute',
                left: `${(s.x / 12) * 100}%`,
                top: `${(s.y / 12) * 100}%`,
                width: `calc(${(s.w / 12) * 100}% - 2px)`,
                height: `calc(${(s.h / 12) * 100}% - 2px)`,
                background: s.color || 'var(--action-primary)',
                borderRadius: '2px'
              }} />
            ))}
          </div>
          <div style={{ fontSize: '0.74rem', fontWeight: 600 }}>{preset.name}</div>
        </div>
      ))}
    </div>
  </div>

  {/* Live 1:1 WYSIWYG Preview Box */}
  <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
    <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '10px' }}>
      📱 Live Preview Kolase (1:1)
    </div>
    <div
      style={{
        width: '240px',
        height: '240px',
        backgroundColor: gridBgColor,
        borderRadius: `${gridBorderRadius * 0.4}px`,
        padding: `${gridOuterPadding * 0.4}px`,
        position: 'relative'
      }}
    >
      {currentLayoutSlots.map(slot => (
        <div
          key={slot.id}
          style={{
            position: 'absolute',
            left: `calc(${gridOuterPadding * 0.4}px + ${(slot.x / 12) * 100}% + ${(gridGapSize * 0.4) / 2}px)`,
            top: `calc(${gridOuterPadding * 0.4}px + ${(slot.y / 12) * 100}% + ${(gridGapSize * 0.4) / 2}px)`,
            width: `calc(${(slot.w / 12) * 100}% - ${gridGapSize * 0.4}px)`,
            height: `calc(${(slot.h / 12) * 100}% - ${gridGapSize * 0.4}px)`,
            background: slot.gradient,
            borderRadius: `${gridBorderRadius * 0.4}px`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px',
            color: '#fff',
            fontSize: '0.62rem',
            textAlign: 'center'
          }}
        >
          <span style={{ fontWeight: 800 }}>#{slot.id}</span>
          <span style={{ fontSize: '0.58rem' }}>{slot.label}</span>
        </div>
      ))}
    </div>
  </div>
</div>
```
