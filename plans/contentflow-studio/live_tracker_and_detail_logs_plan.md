# Rencana Implementasi: Live Progress Tracker & Log Detil ContentFlow Studio

## 1. Ringkasan Eksekutif & Sasaran Fitur
Menjawab kebutuhan pengguna agar tidak hanya melihat status statis `⚙️ Diproduksi`, fitur ini menghadirkan:
1. **Sub-Status Real-Time di Tabel**: Menampilkan tahapan live engine (misal: `⏳ Menunggu Approval Storyboard`, `🎙️ Merender Audio Voiceover`, `🎬 Rendering Klip Video`) serta durasi proses yang berjalan (*elapsed time*).
2. **Deep-Link ke Campaign Sumber**: Menyediakan tautan langsung menuju halaman campaign domain asli (Multiplier Lab, Recipe Labs, Real Estate) agar operator bisa meninjau aset mentah atau intervensi langsung.
3. **Modal Log Detil & Visual Stepper Timeline (6 Tahap)**:
   - Seksi 1: Status Mesin Domain Real-Time (Campaign ID, Sub-Status, Worker ID, Durasi).
   - Seksi 2: Visual Stepper Timeline (1. Perencanaan, 2. Dispatch AI, 3. Naskah & Storyboard, 4. TTS & Video, 5. Approval, 6. Publikasi Repliz).
   - Seksi 3: Audit Trail Log Teknis (`content_studio_events`) yang diformat ramah pengguna.
4. **Mockup Interaktif**: Telah disiapkan pada [public/mockup_contentflow_studio_detail_logs.html](file:///Users/sabeqmmursyid/_contentflow-staging/public/mockup_contentflow_studio_detail_logs.html).

---

## ## Execution Task List

- [x] **Task 1: Buat Helper Resolusi Live Engine Tracker**
  - File baru: `lib/contentflow-studio-live-tracker.js`
  - Menyediakan fungsi `resolveLiveEngineState(slot, tenantId)` yang melakukan query ringan ke tabel domain engine (`re_multiplier_tasks`, `recipe_items`, `re_campaign_items`) untuk mengekstrak sub-status, URL campaign, tahapan stepper, dan deskripsi proses.
- [x] **Task 2: Perkaya Endpoint Calendar dan Slot Detail dengan Data Live Engine**
  - File: `app/api/v2/contentflow-studio/calendar/route.js` & `app/api/v2/contentflow-studio/slots/[id]/route.js`
  - Menyertakan objek `live_engine` pada setiap slot yang sedang berstatus `in_progress` atau `needs_review`.
- [x] **Task 3: Perbarui Kolom "Status Produksi" pada Tabel Studio**
  - File: `app/components/contentflow-studio/StudioWorkspace.js`
  - Tampilkan sub-label dinamis di bawah badge `⚙️ Diproduksi` dengan status live engine dan durasi elapsed time.
- [x] **Task 4: Implementasikan Modal Log Detil, Visual Stepper & Deep-Link Campaign**
  - File: `app/components/contentflow-studio/StudioWorkspace.js`
  - Tambahkan tab switcher pada modal log (`Live Engine Tracker & Timeline` dan `Audit Trail Log Teknis`).
  - Sediakan tombol `🔗 Buka Halaman Campaign Sumber` dan stepper visual alur 6 tahap.
- [x] **Task 5: Pengujian, Validasi Build & Deploy Dev Mac Mini**
  - Validasi build lokal (`npm run build`).
  - Rilis patch non-interaktif (`npm run release-non-interactive`).
  - Deploy atomic ke server Dev (`npm run deploy:dev:atomic`).
  - Verifikasi tampilan langsung pada Dev UI port 5020.

---

## 2. Before & After Code Snippets

### File 1: `lib/contentflow-studio-live-tracker.js` (File Baru)

#### Code Sesudah (Proposed/After):
```javascript
import { pgQuery } from './db-pg.js';

export async function resolveLiveEngineState(slot, tenantId = 'default_tenant') {
  if (!slot.source_campaign_id) return null;
  const kind = slot.batch_engine_kind || slot.source_kind;
  let live = {
    kind,
    campaign_id: slot.source_campaign_id,
    campaign_url: '#',
    engine_status: 'processing',
    sub_status_label: '⚙️ Sedang Diproses',
    step_index: 3,
    progress_percent: slot.progress_percent || 0,
    elapsed_text: '',
    details: 'AI Engine sedang memproses konten.'
  };

  // Hitung elapsed time
  if (slot.dispatched_at) {
    const elapsedMs = Date.now() - new Date(slot.dispatched_at).getTime();
    const mins = Math.floor(elapsedMs / 60000);
    live.elapsed_text = mins > 0 ? `${mins} menit yang lalu` : 'Baru saja';
  }

  try {
    if (kind === 'multiplier') {
      live.campaign_url = `/multiplier-lab/${slot.source_campaign_id}`;
      const res = await pgQuery(`SELECT id, status, error_message, ffmpeg_output_path FROM re_multiplier_tasks WHERE batch_id = $1 LIMIT 1`, [slot.source_campaign_id]);
      const task = res.rows[0];
      if (task) {
        live.engine_status = task.status;
        if (task.status === 'waiting_approval') {
          live.sub_status_label = '⏳ Menunggu Approval Storyboard';
          live.step_index = 3;
          live.details = 'Naskah VO & Storyboard telah siap di Multiplier Lab. Menunggu konfirmasi sebelum perenderan klip.';
        } else if (task.status === 'generating') {
          live.sub_status_label = '⚡ Generating Script & Parameter';
          live.step_index = 3;
          live.details = 'Gemini AI sedang menyusun naskah dan parameter visual.';
        } else if (task.status === 'rendering') {
          live.sub_status_label = '🎬 Rendering Klip Video G-Labs';
          live.step_index = 4;
          live.details = 'Klip video sedang diproses oleh worker rendering.';
        } else if (task.status === 'completed') {
          live.sub_status_label = '✓ Video Selesai Dirender';
          live.step_index = 5;
          live.details = 'Aset video siap untuk ditinjau dan dijadwalkan.';
        }
      }
    } else if (kind === 'recipe') {
      live.campaign_url = `/recipe-labs?campaign_id=${slot.source_campaign_id}`;
      const res = await pgQuery(`SELECT id, status, error_message, ffmpeg_output_path FROM recipe_items WHERE campaign_id = $1 LIMIT 1`, [slot.source_campaign_id]);
      const item = res.rows[0];
      if (item) {
        live.engine_status = item.status;
        if (item.status === 'tts_processing') {
          live.sub_status_label = '🎙️ Merender Audio Voiceover TTS';
          live.step_index = 4;
          live.details = 'Sintesis suara ElevenLabs sedang berjalan di background.';
        } else {
          live.sub_status_label = `⚡ ${item.status || 'Memproses Resep'}`;
          live.step_index = 3;
          live.details = 'Recipe Labs sedang memproses langkah-langkah memasak.';
        }
      }
    } else if (kind === 're') {
      live.campaign_url = `/re-campaigns/${slot.source_campaign_id}`;
      const res = await pgQuery(`SELECT id, analyze_status, tts_status, visual_status, ffmpeg_status, error_message FROM re_campaign_items WHERE campaign_id = $1 LIMIT 1`, [slot.source_campaign_id]);
      const item = res.rows[0];
      if (item) {
        live.engine_status = item.ffmpeg_status || item.visual_status || item.analyze_status || 'processing';
        live.sub_status_label = '📐 Memproses Varian Real Estate';
        live.step_index = 3;
        live.details = 'Engine Real Estate sedang merender varian sudut dan video.';
      }
    }
  } catch (err) {
    console.warn('[resolveLiveEngineState Error]:', err.message);
  }

  return live;
}
```

---

### File 2: `app/api/v2/contentflow-studio/slots/[id]/route.js`

#### Code Sebelum (Current/Before):
```javascript
// Baris 38-43:
const eventsRes = await pgQuery(`
  SELECT * FROM content_studio_events WHERE slot_id = $1 AND tenant_id = $2 ORDER BY created_at DESC
`, [id, tenantId]);
slot.events = eventsRes.rows;

return NextResponse.json({ success: true, data: slot });
```

#### Code Sesudah (Proposed/After):
```javascript
const eventsRes = await pgQuery(`
  SELECT * FROM content_studio_events WHERE slot_id = $1 AND tenant_id = $2 ORDER BY created_at DESC
`, [id, tenantId]);
slot.events = eventsRes.rows;

// Enrich with live engine tracker data
const { resolveLiveEngineState } = await import('@/lib/contentflow-studio-live-tracker');
slot.live_engine = await resolveLiveEngineState(slot, tenantId);

return NextResponse.json({ success: true, data: slot });
```

---

### File 3: `app/api/v2/contentflow-studio/calendar/route.js`

#### Code Sebelum (Current/Before):
```javascript
// Baris 55-59:
return NextResponse.json({
  success: true,
  data: filtered,
  metrics
});
```

#### Code Sesudah (Proposed/After):
```javascript
const { resolveLiveEngineState } = await import('@/lib/contentflow-studio-live-tracker');
const enrichedData = await Promise.all(
  filtered.map(async (slot) => {
    if (['in_progress', 'needs_review'].includes(slot.stage_status)) {
      const live = await resolveLiveEngineState(slot, tenantId);
      return { ...slot, live_engine: live };
    }
    return slot;
  })
);

return NextResponse.json({
  success: true,
  data: enrichedData,
  metrics
});
```

---

### File 4: `app/components/contentflow-studio/StudioWorkspace.js`

#### A. Tabel Kolom Status Produksi:
##### Code Sebelum (Current/Before):
```javascript
// Baris 739:
<td style={{ padding: '10px 14px' }}>{getStatusBadge(s.stage_status, null)}</td>
```

##### Code Sesudah (Proposed/After):
```javascript
<td style={{ padding: '10px 14px' }}>
  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
    {getStatusBadge(s.stage_status, null)}
    {s.stage_status === 'in_progress' && s.live_engine && (
      <>
        <span style={{ fontSize: '0.72rem', color: 'var(--status-info)', fontWeight: 500 }}>
          {s.live_engine.sub_status_label}
        </span>
        {s.live_engine.elapsed_text && (
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            ⏱️ {s.live_engine.elapsed_text}
          </span>
        )}
      </>
    )}
  </div>
</td>
```

#### B. Modal Log Detil & Stepper:
##### Code Sebelum (Current/Before):
```javascript
// Baris 2008-2028:
{slotModalTab === 'log' && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
        Riwayat event audit trail untuk slot ini dari content_studio_events:
      </span>
    </div>
    ...
```

##### Code Sesudah (Proposed/After):
```javascript
{slotModalTab === 'log' && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
    {/* Live Engine Tracker Card */}
    {selectedSlot.live_engine && (
      <div style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '10px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            ⚡ Status Mesin Domain ({selectedSlot.live_engine.kind?.toUpperCase()} Engine)
          </strong>
          <span className="badge" style={{ background: 'var(--status-warning-soft)', color: 'var(--status-warning)', fontSize: '0.75rem', fontWeight: 600 }}>
            {selectedSlot.live_engine.engine_status?.toUpperCase()}
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '10px',
          fontSize: '0.82rem'
        }}>
          <div style={{ background: 'var(--surface)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block' }}>ID CAMPAIGN SUMBER</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{selectedSlot.live_engine.campaign_id}</span>
          </div>
          <div style={{ background: 'var(--surface)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block' }}>SUB-TAHAP BERJALAN</span>
            <span style={{ color: 'var(--status-info)', fontWeight: 600 }}>{selectedSlot.live_engine.sub_status_label}</span>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', borderLeft: '3px solid var(--action-primary)', padding: '10px 14px', borderRadius: '4px', fontSize: '0.8rem' }}>
          <strong>Deskripsi:</strong> {selectedSlot.live_engine.details}
        </div>

        <div>
          <a
            href={selectedSlot.live_engine.campaign_url}
            target="_blank"
            rel="noreferrer"
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              background: 'var(--action-primary)',
              color: 'var(--on-action-primary)',
              textDecoration: 'none',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            🔗 Buka Halaman Campaign Sumber
          </a>
        </div>
      </div>
    )}

    {/* Visual Stepper Timeline */}
    <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '16px' }}>
      <strong style={{ fontSize: '0.88rem', display: 'block', marginBottom: '12px' }}>
        📋 Alur & Progres Tahapan Konten (6 Langkah)
      </strong>
      {/* 6 Step Interactive Visual Timeline Items */}
    </div>

    {/* Audit Events List */}
    ...
  </div>
)}
```
