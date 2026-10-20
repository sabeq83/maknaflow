# Implementation Plan: Accordion & Quick Jump Klip Storyboard (Multiplier & Pillar Campaign)

Rencana ini merespons kebutuhan penataan antarmuka detil klip storyboard pada setiap baris kampanye di **Multiplier Lab** (`app/multiplier-lab/[id]/page.js`) dan penambahan navigasi cepat di **Pillar Campaign** (`app/pillar-campaigns/[id]/page.js`):
1. **Multiplier Campaign — Default State**: Jika satu baris memiliki banyak klip (misal 8 klip), secara default **hanya card Klip #1** yang terbuka detilnya (`isExpanded = true`).
2. **Multiplier Campaign — Perilaku Akordion (Single Active Clip)**: Jika pengguna mengklik untuk membuka card **Klip #2**, maka card **Klip #1 otomatis tertutup**, sehingga fokus layar tetap ringkas dan teratur (sama seperti pola antarmuka pada menu **Pillar Campaign**).
3. **Multiplier Campaign — Header Preview Ringkas**: Saat kartu klip dalam kondisi tertutup, header klip menampilkan indikator panah (`▼` / `▶`), badge Bridge (jika klip transisi produk), serta cuplikan naskah VO singkat agar pengguna mudah mengenali adegan.
4. **Multiplier & Pillar Campaign — Toolbar Quick Jump (Lompat Cepat Klip #1 s.d. #N)**:
   - Menyediakan bar tombol chip *Lompat Cepat* di atas daftar klip pada kedua menu.
   - Mengklik chip klip tertentu langsung membuka kartu klip tersebut (sekaligus menutup klip lain) dan melakukan smooth scrolling ke posisi kartu klip.
   - Klip yang sedang aktif ditandai dengan sorotan warna aksen (`var(--accent)`).

---

## 🎨 Mockup HTML Standalone untuk Simulasi & Review

Sesuai SOP Makna Flow, simulasi visual dan interaktif standalone telah diperbarui dan siap diuji:
- **File Mockup:** [public/mockup_multiplier_clip_accordion.html](file:///Users/sabeqmmursyid/_contentflow-staging/public/mockup_multiplier_clip_accordion.html)
- **Fitur Simulasi di Mockup:**
  - **Simulasi 1 (Multiplier Lab — 8 Klip)**:
    - Default: Hanya Klip #1 yang terbuka, Klip #2 s.d. #8 tertutup.
    - Klik header kartu klip lain: Klip aktif sebelumnya menutup otomatis.
    - Toolbar **Quick Jump (Klip #1 s.d. #8)** dengan penanda badge bridge `🌉`.
  - **Simulasi 2 (Pillar Campaign — 4 Klip)**:
    - Integrasi toolbar **Quick Jump (Klip #1 s.d. #4)** di atas daftar klip.
    - Navigasi chip langsung sinkron dengan status buka/tutup accordion klip.
  - Dukungan toggle Dark Mode & Light Mode (100% semantic CSS design tokens).

---

## 📋 Execution Task List

- [x] **Task 1: Implementasi Accordion & Quick Jump pada Multiplier Lab (`app/multiplier-lab/[id]/page.js`)**
  - [x] Tambahkan state `activeClipIndex` per task (`{ [taskId]: number }`) di komponen `CampaignDetailPageContent`.
  - [x] Implementasikan helper `toggleClip(taskId, idx)` yang secara default menganggap Klip #1 (index 0) aktif bila belum diatur, dan menutup klip lain ketika klip baru dibuka.
  - [x] Tambahkan bar navigasi **Quick Jump Klip** di atas daftar storyboard dengan chip interaktif `Klip #1` s.d. `Klip #N`.
  - [x] Restrukturisasi card klip menjadi accordion dengan header interaktif (indikator panah `▼`/`▶`, cuplikan naskah VO saat tertutup, dan badge bridge transisi).
  - [x] Bungkus isi detail klip (VO, Visual, T2I, I2V) dalam blok `{isExpanded && ( ... )}` dan sematkan anchor ID untuk scrolling.

- [x] **Task 2: Penambahan Toolbar Quick Jump pada Pillar Campaign (`app/pillar-campaigns/[id]/page.js`)**
  - [x] Tambahkan bar navigasi **Quick Jump Klip** di atas daftar `plan.map` pada Workbench V2 Storyboard item.
  - [x] Hubungkan chip Quick Jump dengan state `activeClipIndex[item.id]` yang sudah ada di Pillar Campaign.
  - [x] Tambahkan anchor ID pada kartu klip Pillar (`id={`pillar-clip-${item.id}-${idx}`}`) agar tombol chip melakukan smooth scroll ke adegan yang dituju.

- [x] **Task 3: Pengujian & Verifikasi Kompatibilitas UI**
  - [x] Uji navigasi accordion dan tombol Quick Jump pada Multiplier Lab (4 klip, 6 klip, hingga 8 klip).
  - [x] Uji navigasi Quick Jump pada Pillar Campaign.
  - [x] Pastikan fungsi edit textarea (VO, Visual, T2I, I2V) dan tombol copy aset tetap bekerja normal tanpa regresi.
  - [x] Jalankan unit test `tests/multiplier-phase-recipe-card.test.js` dan pastikan build bersih.

---

## 🔍 Before & After Code Snippets

### 1. `app/multiplier-lab/[id]/page.js`

#### A. Penambahan State & Helper `toggleClip`
##### Code Sebelum (Current/Before):
```javascript
  const [editedStoryboards, setEditedStoryboards] = useState({});
  const [editedCaptions, setEditedCaptions] = useState({});
  const [editedYtTitles, setEditedYtTitles] = useState({});
  const [retryingTask, setRetryingTask] = useState({});
```

##### Code Sesudah (Proposed/After):
```javascript
  const [editedStoryboards, setEditedStoryboards] = useState({});
  const [editedCaptions, setEditedCaptions] = useState({});
  const [editedYtTitles, setEditedYtTitles] = useState({});
  const [retryingTask, setRetryingTask] = useState({});

  // Accordion Clip State per Task: { [taskId]: number }
  const [activeClipIndex, setActiveClipIndex] = useState({});
  const toggleClip = (taskId, idx) => {
    setActiveClipIndex(prev => {
      const currentActive = prev[taskId] !== undefined ? prev[taskId] : 0;
      return {
        ...prev,
        [taskId]: currentActive === idx ? -1 : idx
      };
    });
  };
```

#### B. Penambahan Toolbar Quick Jump & Restrukturisasi Card Klip ke Accordion
##### Code Sebelum (Current/Before):
```jsx
// app/multiplier-lab/[id]/page.js:L1541-L1547
                                     {/* Clips edit rows */}
                                     <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                       {storyboard.map((clip, cidx) => (
                                         <div key={cidx} style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--surface-interactive)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                                           <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent-light)', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                                             🎬 Klip #{cidx + 1}
                                           </div>
                                           <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
```

##### Code Sesudah (Proposed/After):
```jsx
// app/multiplier-lab/[id]/page.js:L1541-L1547
                                     {/* Quick Jump Bar Klip Storyboard */}
                                     {storyboard.length > 1 && (
                                       <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: '10px 14px', background: 'var(--surface-interactive)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                                         <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginRight: 4 }}>⚡ Lompat Cepat:</span>
                                         {storyboard.map((_, sidx) => {
                                           const isActive = (activeClipIndex[task.id] !== undefined ? activeClipIndex[task.id] : 0) === sidx;
                                           const isBridge = (bridging.isBridgingActive !== false) &&
                                             Number(sidx + 1) >= Number(bridging.bridgeAtClip || 0) &&
                                             Number(sidx + 1) < (Number(bridging.bridgeAtClip || 0) + Number(bridging.bridgeDurationClips || 1));
                                           return (
                                             <button
                                               key={sidx}
                                               type="button"
                                               onClick={() => {
                                                 setActiveClipIndex(prev => ({ ...prev, [task.id]: sidx }));
                                                 const el = document.getElementById(`mult-clip-${task.id}-${sidx}`);
                                                 if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                               }}
                                               style={{
                                                 padding: '4px 10px',
                                                 fontSize: '0.72rem',
                                                 fontWeight: isActive ? 700 : 500,
                                                 borderRadius: 4,
                                                 border: isActive ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                                                 background: isActive ? 'var(--accent)' : 'var(--surface)',
                                                 color: isActive ? 'var(--on-action-primary, #042f2e)' : 'var(--text-primary)',
                                                 cursor: 'pointer'
                                               }}
                                             >
                                               Klip #{sidx + 1} {isBridge ? '🌉' : ''}
                                             </button>
                                           );
                                         })}
                                       </div>
                                     )}

                                     {/* Clips edit rows dengan Accordion (Klip 1 default terbuka) */}
                                     <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                       {storyboard.map((clip, cidx) => {
                                         const isExpanded = (activeClipIndex[task.id] !== undefined ? activeClipIndex[task.id] : 0) === cidx;
                                         const isBridge = (bridging.isBridgingActive !== false) &&
                                           Number(cidx + 1) >= Number(bridging.bridgeAtClip || 0) &&
                                           Number(cidx + 1) < (Number(bridging.bridgeAtClip || 0) + Number(bridging.bridgeDurationClips || 1));

                                         return (
                                           <div
                                             key={cidx}
                                             id={`mult-clip-${task.id}-${cidx}`}
                                             style={{
                                               display: 'flex',
                                               flexDirection: 'column',
                                               gap: isExpanded ? 12 : 0,
                                               background: isExpanded ? 'var(--surface-raised)' : 'var(--surface-interactive)',
                                               padding: 16,
                                               borderRadius: 8,
                                               border: isExpanded ? '1px solid var(--accent)' : '1px solid var(--border)',
                                               borderLeft: isBridge ? '3px solid var(--status-info)' : undefined,
                                               transition: 'all 0.2s ease'
                                             }}
                                           >
                                             {/* Header Klip Interaktif (Toggle Accordion) */}
                                             <div
                                               onClick={() => toggleClip(task.id, cidx)}
                                               style={{
                                                 fontWeight: 700,
                                                 fontSize: '0.85rem',
                                                 color: isBridge ? 'var(--status-info)' : 'var(--accent-light)',
                                                 borderBottom: isExpanded ? '1px solid var(--border-subtle)' : 'none',
                                                 paddingBottom: isExpanded ? 8 : 0,
                                                 display: 'flex',
                                                 justifyContent: 'space-between',
                                                 alignItems: 'center',
                                                 cursor: 'pointer',
                                                 userSelect: 'none'
                                               }}
                                             >
                                               <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                 <span>{isExpanded ? '▼' : '▶'} 🎬 Klip #{cidx + 1}</span>
                                                 {isBridge && (
                                                   <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--status-info)', background: 'var(--status-info-soft)', padding: '2px 6px', borderRadius: 4 }}>
                                                     🌉 BRIDGE TRANSISI PRODUK
                                                   </span>
                                                 )}
                                                 {!isExpanded && clip.narration && (
                                                   <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '380px', fontStyle: 'italic' }}>
                                                     "{clip.narration.slice(0, 50)}..."
                                                   </span>
                                                 )}
                                               </div>
                                               <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                 {isExpanded ? 'Tutup Klip' : 'Buka Klip'}
                                               </span>
                                             </div>

                                             {isExpanded && (
                                               <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                                                 {/* Naskah Voiceover (VO), Aksi Visual, Prompt T2I, Prompt I2V */}
                                                 ...
                                               </div>
                                             )}
                                           </div>
                                         );
                                       })}
                                     </div>
```

---

### 2. `app/pillar-campaigns/[id]/page.js`

#### Penambahan Toolbar Quick Jump Klip di Atas Daftar Storyboard
##### Code Sebelum (Current/Before):
```jsx
// app/pillar-campaigns/[id]/page.js:L2278-L2286
                </div>
              </div>
            )}

            {/* Creative Clip Plans list */}
            {plan.map((p, idx) => {
              const isBridge = campaign?.visual_mode === 'hybrid_lock' && campaign?.is_bridging_active && Number(p.clip_index) === Number(campaign.bridge_at_clip);
              const isExpanded = (activeClipIndex[item.id] !== undefined ? activeClipIndex[item.id] : 0) === idx;

              return (
                <div key={idx} ...>
```

##### Code Sesudah (Proposed/After):
```jsx
// app/pillar-campaigns/[id]/page.js:L2278-L2286
                </div>
              </div>
            )}

            {/* Quick Jump Bar Klip Storyboard */}
            {plan.length > 1 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: '10px 14px', background: 'var(--surface-interactive)', border: '1px solid var(--border-subtle)', borderRadius: 8, marginBottom: 12 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginRight: 4 }}>⚡ Lompat Cepat:</span>
                {plan.map((p, pidx) => {
                  const isActive = (activeClipIndex[item.id] !== undefined ? activeClipIndex[item.id] : 0) === pidx;
                  const isBridgeClip = campaign?.visual_mode === 'hybrid_lock' && campaign?.is_bridging_active && Number(p.clip_index) === Number(campaign.bridge_at_clip);
                  return (
                    <button
                      key={pidx}
                      type="button"
                      onClick={() => {
                        setActiveClipIndex(prev => ({ ...prev, [item.id]: pidx }));
                        const el = document.getElementById(`pillar-clip-${item.id}-${pidx}`);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                      }}
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.72rem',
                        fontWeight: isActive ? 700 : 500,
                        borderRadius: 4,
                        border: isActive ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                        background: isActive ? 'var(--accent)' : 'var(--surface)',
                        color: isActive ? 'var(--on-action-primary, #042f2e)' : 'var(--text-primary)',
                        cursor: 'pointer'
                      }}
                    >
                      Klip #{p.clip_index || (pidx + 1)} {isBridgeClip ? '🌉' : ''}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Creative Clip Plans list */}
            {plan.map((p, idx) => {
              const isBridge = campaign?.visual_mode === 'hybrid_lock' && campaign?.is_bridging_active && Number(p.clip_index) === Number(campaign.bridge_at_clip);
              const isExpanded = (activeClipIndex[item.id] !== undefined ? activeClipIndex[item.id] : 0) === idx;

              return (
                <div key={idx} id={`pillar-clip-${item.id}-${idx}`} ...>
```
