# Implementation Plan: Penambahan Tombol Copy Aset pada Halaman Detil Multiplier Lab

Usulan ini merespons kebutuhan pengguna untuk menambahkan tombol **Salin (Copy)** pada 3 aset utama kampanye di **Multiplier Lab** (halaman detil `/multiplier-lab/[id]`):
1. **Naskah Voiceover (VO)**
2. **Prompt T2I Start Frame (Pixel Lock)**
3. **Prompt I2V (Motion Prompt)**

Implementasi ini diselaraskan dengan pola antarmuka pada menu **Pilar Campaign** (`/pillar-campaigns/[id]`), menggunakan feedback visual interaktif (`Tersalin ✓`), semantic CSS design tokens dari `app/theme.css`, serta penambahan bar aksi **Bulk Copy** untuk menyalin seluruh alur dalam 1 klik.

---

## 🎨 Mockup HTML Standalone untuk Simulasi & Review

Sesuai SOP, simulasi interaktif standalone HTML telah dibuat dan dapat langsung diuji secara lokal:
- **File Mockup:** [public/mockup_multiplier_copy_assets.html](file:///Users/sabeqmmursyid/_contentflow-staging/public/mockup_multiplier_copy_assets.html)
- **URL Akses Lokal:** `http://localhost:5020/mockup_multiplier_copy_assets.html` (atau port dev yang sedang aktif)
- **Fitur Simulasi di Mockup:**
  - Tombol Salin per Klip pada VO, Aksi Visual, T2I, dan I2V.
  - Efek transisi warna hijau lembut (`var(--status-success-soft)`) dan teks berubah menjadi `✓ Tersalin` selama 2 detik.
  - Floating Toast Notification konfirmasi penyalinan.
  - Toolbar **Salin Cepat Seluruh Alur (Bulk Copy Toolbar)** untuk menyalin gabungan seluruh scene ke clipboard.
  - Tombol toggle Dark Mode & Light Mode universal.

---

## 📋 Execution Task List

- [x] **Task 1: Penambahan State & Helper Clipboard pada Detail Multiplier Lab**
  - [x] Tambahkan state `copySuccess` (`{ [key]: boolean }`) pada [app/multiplier-lab/[id]/page.js](file:///Users/sabeqmmursyid/_contentflow-staging/app/multiplier-lab/[id]/page.js).
  - [x] Implementasikan helper `handleCopy(text, key, label)` dengan dukungan `navigator.clipboard.writeText` dan fallback `document.execCommand('copy')` jika clipboard API tidak diizinkan.
  - [x] Tambahkan feedback visual reset otomatis setelah 2000ms dan integrasi dengan `showToast`.

- [x] **Task 2: Penambahan Tombol Salin Per Klip (VO, T2I Start Frame, I2V Motion)**
  - [x] Perbarui baris label **Naskah Voiceover (VO)** pada [app/multiplier-lab/[id]/page.js](file:///Users/sabeqmmursyid/_contentflow-staging/app/multiplier-lab/[id]/page.js) menjadi header fleksibel dengan tombol `[📋 Salin VO]`.
  - [x] Perbarui label "Prompt T2I" menjadi **Prompt T2I Start Frame (Pixel Lock)** dengan tombol `[📋 Salin Prompt T2I]`.
  - [x] Perbarui label "Prompt I2V" menjadi **Prompt I2V (Motion Prompt)** dengan tombol `[📋 Salin Prompt I2V]`.
  - [x] Pastikan seluruh tombol menggunakan semantic tokens (`var(--surface)`, `var(--status-success-soft)`, `var(--border-strong)`).

- [x] **Task 3: Penambahan Toolbar Salin Cepat Seluruh Alur (Bulk Copy Toolbar)**
  - [x] Tambahkan bar ringkas di atas daftar klip storyboard pada [app/multiplier-lab/[id]/page.js](file:///Users/sabeqmmursyid/_contentflow-staging/app/multiplier-lab/[id]/page.js).
  - [x] Sediakan 3 tombol aksi cepat:
    1. `🎙️ Salin Seluruh Naskah VO`: Menggabungkan naskah VO klip 1 s.d. N terformat rapi.
    2. `🖼️ Salin Semua Prompt T2I`: Menggabungkan prompt T2I start frame seluruh klip.
    3. `🎬 Salin Semua Prompt I2V`: Menggabungkan motion prompt I2V seluruh klip.

- [x] **Task 4: Pengujian & Verifikasi Kompatibilitas UI**
  - [x] Verifikasi fungsi penyalinan clipboard teks tunggal maupun bulk.
  - [x] Pastikan tidak ada regresi pada fungsi inline-editing storyboard textarea yang sudah ada.
  - [x] Verifikasi tampilan di mode Dark dan Light.

---

## 🔍 Before & After Code Snippets

### File: `app/multiplier-lab/[id]/page.js`

#### 1. Penambahan State & Clipboard Handler
##### Code Sebelum (Current/Before):
```javascript
// app/multiplier-lab/[id]/page.js:L186-L191
  // Regeneration and replacement loadings
  const [batchRegeneratingSF, setBatchRegeneratingSF] = useState({}); // { [taskId]: boolean }
  const [regeneratingT2I, setRegeneratingT2I] = useState({}); // { [`${taskId}_${clipIndex}`]: boolean }
  const [replacingSF, setReplacingSF] = useState({}); // { [`${taskId}_${clipIndex}`]: boolean }
  const [actionLoading, setActionLoading] = useState({}); // { [taskId]: boolean }

  const pollingRef = useRef(null);
```

##### Code Sesudah (Proposed/After):
```javascript
// app/multiplier-lab/[id]/page.js:L186-L230
  // Regeneration and replacement loadings
  const [batchRegeneratingSF, setBatchRegeneratingSF] = useState({}); // { [taskId]: boolean }
  const [regeneratingT2I, setRegeneratingT2I] = useState({}); // { [`${taskId}_${clipIndex}`]: boolean }
  const [replacingSF, setReplacingSF] = useState({}); // { [`${taskId}_${clipIndex}`]: boolean }
  const [actionLoading, setActionLoading] = useState({}); // { [taskId]: boolean }
  const [copySuccess, setCopySuccess] = useState({}); // { [key]: boolean }

  const handleCopy = (text, key, label = 'Aset') => {
    if (!text || !text.trim()) {
      showToast(`${label} masih kosong atau belum tersedia.`, 'error');
      return;
    }
    const applySuccess = () => {
      setCopySuccess(prev => ({ ...prev, [key]: true }));
      showToast(`${label} berhasil disalin!`);
      setTimeout(() => {
        setCopySuccess(prev => ({ ...prev, [key]: false }));
      }, 2000);
    };

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(applySuccess).catch(() => fallbackCopy(text, key, label));
    } else {
      fallbackCopy(text, key, label);
    }
  };

  const fallbackCopy = (text, key, label) => {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopySuccess(prev => ({ ...prev, [key]: true }));
      showToast(`${label} berhasil disalin!`);
      setTimeout(() => {
        setCopySuccess(prev => ({ ...prev, [key]: false }));
      }, 2000);
    } catch (_) {
      showToast('Gagal menyalin ke clipboard', 'error');
    }
  };

  const pollingRef = useRef(null);
```

---

#### 2. Penambahan Toolbar Salin Cepat & Tombol Copy pada Baris Klip Storyboard
##### Code Sebelum (Current/Before):
```javascript
// app/multiplier-lab/[id]/page.js:L1399-L1458
  {/* Clips edit rows */}
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    {storyboard.map((clip, cidx) => (
      <div key={cidx} style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--surface-interactive)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent-light)', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
          🎬 Klip #{cidx + 1}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Naskah Voiceover (VO)</label>
            <textarea
              value={clip.narration || ''}
              onChange={(e) => {
                const updated = [...storyboard];
                updated[cidx].narration = e.target.value;
                setEditedStoryboards(prev => ({ ...prev, [task.id]: updated }));
              }}
              rows={2}
              style={{ width: '100%', padding: 10, fontSize: '0.82rem', background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6 }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Aksi Visual</label>
            <textarea
              value={clip.visual_description || ''}
              onChange={(e) => {
                const updated = [...storyboard];
                updated[cidx].visual_description = e.target.value;
                setEditedStoryboards(prev => ({ ...prev, [task.id]: updated }));
              }}
              rows={2}
              style={{ width: '100%', padding: 10, fontSize: '0.82rem', background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6 }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Prompt T2I</label>
            <textarea
              value={clip.t2i_prompt || ''}
              onChange={(e) => {
                const updated = [...storyboard];
                updated[cidx].t2i_prompt = e.target.value;
                setEditedStoryboards(prev => ({ ...prev, [task.id]: updated }));
              }}
              rows={2}
              style={{ width: '100%', padding: 10, fontSize: '0.8rem', background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6 }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Prompt I2V</label>
            <textarea
              value={clip.i2v_prompt || ''}
              onChange={(e) => {
                const updated = [...storyboard];
                updated[cidx].i2v_prompt = e.target.value;
                setEditedStoryboards(prev => ({ ...prev, [task.id]: updated }));
              }}
              rows={2}
              style={{ width: '100%', padding: 10, fontSize: '0.8rem', background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6 }}
            />
          </div>
        </div>
      </div>
    ))}
  </div>
```

##### Code Sesudah (Proposed/After):
```javascript
// app/multiplier-lab/[id]/page.js:L1399-L1535
  {/* Bulk Copy Toolbar */}
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    background: 'var(--surface-interactive)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '10px 14px'
  }}>
    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
      ⚡ Salin Cepat Seluruh Alur:
    </span>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button
        type="button"
        className="btn btn-secondary"
        style={{ padding: '3px 8px', fontSize: '0.7rem' }}
        onClick={() => {
          const bulkVo = storyboard.map((c, i) => `[Klip ${i + 1} VO]\n${c.narration || ''}`).join('\n\n');
          handleCopy(bulkVo, `bulk_vo_${task.id}`, 'Seluruh Naskah VO');
        }}
      >
        {copySuccess[`bulk_vo_${task.id}`] ? 'Tersalin ✓' : '🎙️ Salin Semua VO'}
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        style={{ padding: '3px 8px', fontSize: '0.7rem' }}
        onClick={() => {
          const bulkT2i = storyboard.map((c, i) => `--- Klip ${i + 1} T2I Start Frame ---\n${c.t2i_prompt || ''}`).join('\n\n');
          handleCopy(bulkT2i, `bulk_t2i_${task.id}`, 'Semua Prompt T2I');
        }}
      >
        {copySuccess[`bulk_t2i_${task.id}`] ? 'Tersalin ✓' : '🖼️ Salin Semua Prompt T2I'}
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        style={{ padding: '3px 8px', fontSize: '0.7rem' }}
        onClick={() => {
          const bulkI2v = storyboard.map((c, i) => `--- Klip ${i + 1} I2V Motion ---\n${c.i2v_prompt || ''}`).join('\n\n');
          handleCopy(bulkI2v, `bulk_i2v_${task.id}`, 'Semua Prompt I2V');
        }}
      >
        {copySuccess[`bulk_i2v_${task.id}`] ? 'Tersalin ✓' : '🎬 Salin Semua Prompt I2V'}
      </button>
    </div>
  </div>

  {/* Clips edit rows */}
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    {storyboard.map((clip, cidx) => (
      <div key={cidx} style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--surface-interactive)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent-light)', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
          🎬 Klip #{cidx + 1}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Naskah Voiceover (VO) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>🎙️ Naskah Voiceover (VO)</label>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '2px 8px',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  background: copySuccess[`vo_${task.id}_${cidx}`] ? 'var(--status-success-soft)' : 'var(--surface)',
                  borderColor: copySuccess[`vo_${task.id}_${cidx}`] ? 'var(--status-success)' : 'var(--border-strong)',
                  color: copySuccess[`vo_${task.id}_${cidx}`] ? 'var(--status-success)' : 'var(--text-secondary)'
                }}
                onClick={() => handleCopy(clip.narration || '', `vo_${task.id}_${cidx}`, `VO Klip #${cidx + 1}`)}
              >
                {copySuccess[`vo_${task.id}_${cidx}`] ? 'Tersalin ✓' : '📋 Salin VO'}
              </button>
            </div>
            <textarea
              value={clip.narration || ''}
              onChange={(e) => {
                const updated = [...storyboard];
                updated[cidx].narration = e.target.value;
                setEditedStoryboards(prev => ({ ...prev, [task.id]: updated }));
              }}
              rows={2}
              style={{ width: '100%', padding: 10, fontSize: '0.82rem', background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6 }}
            />
          </div>

          {/* Aksi Visual */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>👁️ Aksi Visual</label>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '2px 8px',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  background: copySuccess[`vis_${task.id}_${cidx}`] ? 'var(--status-success-soft)' : 'var(--surface)',
                  borderColor: copySuccess[`vis_${task.id}_${cidx}`] ? 'var(--status-success)' : 'var(--border-strong)',
                  color: copySuccess[`vis_${task.id}_${cidx}`] ? 'var(--status-success)' : 'var(--text-secondary)'
                }}
                onClick={() => handleCopy(clip.visual_description || '', `vis_${task.id}_${cidx}`, `Aksi Visual Klip #${cidx + 1}`)}
              >
                {copySuccess[`vis_${task.id}_${cidx}`] ? 'Tersalin ✓' : '📋 Salin Visual'}
              </button>
            </div>
            <textarea
              value={clip.visual_description || ''}
              onChange={(e) => {
                const updated = [...storyboard];
                updated[cidx].visual_description = e.target.value;
                setEditedStoryboards(prev => ({ ...prev, [task.id]: updated }));
              }}
              rows={2}
              style={{ width: '100%', padding: 10, fontSize: '0.82rem', background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6 }}
            />
          </div>

          {/* Prompt T2I Start Frame (Pixel Lock) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>🖼️ Prompt T2I Start Frame (Pixel Lock)</label>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '2px 8px',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  background: copySuccess[`t2i_${task.id}_${cidx}`] ? 'var(--status-success-soft)' : 'var(--surface)',
                  borderColor: copySuccess[`t2i_${task.id}_${cidx}`] ? 'var(--status-success)' : 'var(--border-strong)',
                  color: copySuccess[`t2i_${task.id}_${cidx}`] ? 'var(--status-success)' : 'var(--text-secondary)'
                }}
                onClick={() => handleCopy(clip.t2i_prompt || '', `t2i_${task.id}_${cidx}`, `Prompt T2I Klip #${cidx + 1}`)}
              >
                {copySuccess[`t2i_${task.id}_${cidx}`] ? 'Tersalin ✓' : '📋 Salin Prompt T2I'}
              </button>
            </div>
            <textarea
              value={clip.t2i_prompt || ''}
              onChange={(e) => {
                const updated = [...storyboard];
                updated[cidx].t2i_prompt = e.target.value;
                setEditedStoryboards(prev => ({ ...prev, [task.id]: updated }));
              }}
              rows={2}
              style={{ width: '100%', padding: 10, fontSize: '0.8rem', background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6 }}
            />
          </div>

          {/* Prompt I2V (Motion Prompt) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>🎬 Prompt I2V (Motion Prompt)</label>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '2px 8px',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  background: copySuccess[`i2v_${task.id}_${cidx}`] ? 'var(--status-success-soft)' : 'var(--surface)',
                  borderColor: copySuccess[`i2v_${task.id}_${cidx}`] ? 'var(--status-success)' : 'var(--border-strong)',
                  color: copySuccess[`i2v_${task.id}_${cidx}`] ? 'var(--status-success)' : 'var(--text-secondary)'
                }}
                onClick={() => handleCopy(clip.i2v_prompt || '', `i2v_${task.id}_${cidx}`, `Prompt I2V Klip #${cidx + 1}`)}
              >
                {copySuccess[`i2v_${task.id}_${cidx}`] ? 'Tersalin ✓' : '📋 Salin Prompt I2V'}
              </button>
            </div>
            <textarea
              value={clip.i2v_prompt || ''}
              onChange={(e) => {
                const updated = [...storyboard];
                updated[cidx].i2v_prompt = e.target.value;
                setEditedStoryboards(prev => ({ ...prev, [task.id]: updated }));
              }}
              rows={2}
              style={{ width: '100%', padding: 10, fontSize: '0.8rem', background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6 }}
            />
          </div>
        </div>
      </div>
    ))}
  </div>
```
