# Usulan & Implementation Plan — Unified Modal Penjadwalan Konten (Single & Bulk Scheduling)

Dokumen rencana kerja dan arsitektur untuk modifikasi modal penjadwalan konten (`app/content-flow/PublishingScheduler.js`) agar dapat mengakomodasi **Penjadwalan Konten Massal (Bulk Scheduling)** sekaligus **Penjadwalan Konten Tunggal (Single Scheduling)** dalam satu modal terpadu (*Unified Modal Architecture*).

---

## 1. Analisis Kebutuhan & Desain Arsitektur Terpadu

1. **Alur Kerja & Modal Eksisting (`PublishingScheduler.js`)**:
   - Modal saat ini menerima prop `initialPreloadItem` untuk menjadwalkan 1 konten.
   - Modal sudah memiliki pipeline autentikasi lengkap (Meta Graph API & Repliz Cloud), filter Brand Profile (`modalBrandFilter`), pemilihan platform (TikTok, Instagram Reels, Facebook, YouTube Shorts), input caption, timezone switcher (`Asia/Jakarta`), dan penanda konten AI (`is_ai_generated`).
   - Pada baris 2627–2660 terdapat section **Preview Media Konten** yang merender pemutar video `<video>` atau `<img>`.
   - Pada baris 2603–2612 terdapat pemilih **Mode Publikasi** (`live` vs `draft`).

2. **Kebutuhan Fitur Baru (User Requirements)**:
   - **Unified Modal**: Memodifikasi `PublishingScheduler.js` agar mendukung prop `initialPreloadItems` (array konten) dan switcher mode (`[ 🎬 Single ]` vs `[ 📦 Bulk ]`).
   - **Preview Media DISABLED pada Bulk Mode**:
     - *Rasional*: Memuat player video untuk 5–20 konten resolusi tinggi (Nextcloud/S3) secara bersamaan akan membebani memori RAM browser, menyebabkan bottleneck jaringan, dan berisiko membuat browser *freeze*.
     - *Solusi*: Section preview media **dinonaktifkan (unmounted/hidden)** secara total saat bulk mode aktif dan digantikan dengan panel informasi efisiensi performa serta chips daftar ringkas konten terpilih.
   - **Mode Publikasi (Live vs Draft)**:
     - Tetap tersedia pada kedua mode (Single maupun Bulk).
     - Mode `Live`: Menjadwalkan konten untuk tayang otomatis ke publik (memerlukan approval).
     - Mode `Draft`: Mengunggah konten sebagai draft di platform (misal TikTok draft) tanpa langsung rilis ke feed pengikut.
   - **Fleksibilitas Jeda Interval & Waktu**:
     - Input tanggal mulai (misal `2026-10-13`) & jam mulai (misal `10:00 WIB`).
     - Tiga opsi strategi distribusi waktu:
       1. **⏱️ Jeda Interval**: Dilengkapi pilihan preset cepat (**30 Menit, 1 Jam, 2 Jam Rekomendasi, 3 Jam, 4 Jam, 6 Jam**) dan **Input Kustom Menit Bebas**.
       2. **⚡ Serentak**: Seluruh video tayang serentak pada jam yang sama.
       3. **📅 1 Konten/Hari (Slot Harian)**: Pilihan pola distribusi harian (**Tiap 1 Hari, Tiap 2 Hari, Tiap 3 Hari**).
     - **Tabel Simulasi Langsung (Live Simulation Table)**: Menampilkan kalkulasi tanggal/jam tayang dan status (LIVE / DRAFT) untuk tiap-tiap video secara real-time.
   - **Seleksi Massal di Content Library (`app/content-flow/page.js`)**:
     - Checkbox seleksi per kartu konten, tombol *Quick Select 5 Konten Terbaru*, dan *Floating Bulk Action Dock*.
     - Menghubungkan tombol aksi massal ke `PublishingScheduler` dengan meneruskan array `initialPreloadItems`.

---

## 2. Mockup HTML Interaktif (Standalone Simulation)

Simulasi visual dan interaksi lengkap telah dibuat dan diperbarui sesuai seluruh kriteria pengguna:
👉 **[`public/mockup_publishing_scheduler_unified_bulk.html`](file:///Users/sabeqmmursyid/_contentflow-staging/public/mockup_publishing_scheduler_unified_bulk.html)**

Fitur dalam mockup:
- **100% Semantic CSS Tokens** (`app/theme.css`) dengan switcher Dark Mode & Light Mode.
- **Peralihan Mode Single & Bulk**:
  - Di mode *Single*: Video ID search aktif, Video player preview **AKTIF**.
  - Di mode *Bulk*: Video ID digantikan oleh Chips 5 Konten, Video player preview **DINONAKTIFKAN (DISABLED)**.
- **Mode Publikasi (Live vs Draft)**: Dropdown interaktif lengkap dengan banner info draft dan status badge di tabel simulasi.
- **Konfigurasi Interval Fleksibel**: Preset 30m, 1h, 2h, 3h, 4h, 6h, kotak input custom menit, serta preset harian (1, 2, 3 hari).
- **Tabel Simulasi Real-Time**: Perhitungan jadwal tayang dinamis untuk 13 Oktober 2026 mulai jam 10:00 WIB.

---

## 3. Execution Task List

- [x] **Task 1: Analisis Codebase & Mockup Interaktif HTML**
  - [x] Analisis kelayakan modifikasi `PublishingScheduler.js` dan rasional penonaktifan preview media.
  - [x] Pembuatan file mockup interaktif [`public/mockup_publishing_scheduler_unified_bulk.html`](file:///Users/sabeqmmursyid/_contentflow-staging/public/mockup_publishing_scheduler_unified_bulk.html) dengan Semantic CSS Tokens.
  - [x] Penambahan selector Mode Publikasi (`Live` vs `Draft`) pada mockup.
  - [x] Penambahan panel pilihan durasi jeda interval (preset 30m–6h, input kustom, slot harian).
  - [x] Penyusunan `implementation_plan.md` dengan Before & After code snippets.
- [x] **Task 2: Backend API Batch `POST /api/v2/publishing/bulk-jobs`**
  - [x] Membuat endpoint di `app/api/v2/publishing/bulk-jobs/route.js`.
  - [x] Validasi payload batch (`items`, `account_ids`, `publish_mode`, `is_ai_generated`, `timezone`).
  - [x] Pembuatan publishing jobs di database PostgreSQL dan sinkronisasi status ke `content_flow_items`.
  - [x] Pembuatan dan eksekusi integration test `tests/bulk-publishing-jobs.test.js` (berhasil 100%).
- [x] **Task 3: Modifikasi State & Props pada `PublishingScheduler.js`**
  - [x] Menambahkan prop `initialPreloadItems` pada `PublishingScheduler({ initialPreloadItem, initialPreloadItems, ... })`.
  - [x] Menginisialisasi state `bulkItems`, `isBulkMode`, `bulkStrategy`, `bulkIntervalMinutes`, `bulkDailyStep`, `bulkTargetDate`, `bulkTargetTime`.
- [x] **Task 4: Implementasi UI Bulk Mode di `PublishingScheduler.js`**
  - [x] Menambahkan toggle switcher mode di header modal: `[ 🎬 Single ]` vs `[ 📦 Bulk Mode (X Konten) ]`.
  - [x] Merender scroller chips konten terpilih (dengan tombol hapus `✕`) menggantikan combobox video ID pada Bulk Mode.
  - [x] **Menonaktifkan (Disable/Hide) Media Preview Player** pada Bulk Mode dan menampilkan banner optimasi performa ramah pengguna.
  - [x] Menambahkan panel konfigurasi durasi jeda interval (preset 30m, 1h, 2h, 3h, 4h, 6h, custom minutes input, dan slot harian).
  - [x] Menampilkan Live Simulation Table untuk pratinjau kalkulasi jadwal tayang tiap konten sebelum submit.
- [x] **Task 5: Implementasi Submit Handler Terpadu di `PublishingScheduler.js`**
  - [x] Jika Single Mode: Kirim ke `POST /api/v2/publishing/jobs`.
  - [x] Jika Bulk Mode: Hitung ISO timestamp tiap item berdasarkan strategi dan interval, lalu kirim ke `POST /api/v2/publishing/bulk-jobs`.
- [x] **Task 6: Integrasi Pemanggilan dari `app/content-flow/page.js`**
  - [x] Menambahkan state `selectedItemIds` dan handler seleksi multi-konten pada kartu Content Library.
  - [x] Menambahkan tombol cepat *Quick Select 5 Konten Terbaru* dan *Select All*.
  - [x] Menambahkan Floating Bulk Action Dock di bagian bawah layar saat $\ge 1$ konten dipilih.
  - [x] Menghubungkan tombol "⏱️ Jadwalkan Massal" ke modal overlay `PublishingScheduler` dengan meneruskan `initialPreloadItems={selectedItemsList}`.
- [x] **Task 7: Pengujian, Validasi Build & Regression Test**
  - [x] Uji coba penjadwalan Single Mode (memastikan player video tetap muncul normal dan alur tidak regresi).
  - [x] Uji coba penjadwalan Bulk Mode (memastikan video player dinonaktifkan, interval dihitung tepat, dan batch jobs tersimpan di database).
  - [x] Verifikasi build Next.js (`npm run build` atau lint check) bebas error (Passed exit code 0).

---

## 4. Code Before & After Snippets

### File 1: `app/content-flow/PublishingScheduler.js`

#### Code Sebelum (Current/Before)
```javascript
// app/content-flow/PublishingScheduler.js (Props & State awal)
export default function PublishingScheduler({
  initialPreloadItem = null,
  onBackToLibrary = null,
  modalOnly = false,
  controlledBrandProfileId = null,
  controlledAccountName = null,
  controlledContentRunIds = null,
  controlledProgramId = null
}) {
  const defaultScheduleTime = getWibNowPlusMinutes(10);
  const [showScheduleModal, setShowScheduleModal] = useState(Boolean(initialPreloadItem));
  const [scheduleForm, setScheduleForm] = useState({
    content_id: initialPreloadItem?.video_id || '',
    account_ids: [],
    platform: 'facebook',
    publish_mode: 'live',
    media_type: 'reels',
    caption: initialPreloadItem?.caption || '',
    media_url: initialPreloadItem?.url_asset || initialPreloadItem?.nextcloud_url || '',
    scheduled_at: defaultScheduleTime,
    account_schedules: {},
    timezone: 'Asia/Jakarta',
    activeTabProvider: 'repliz',
    is_ai_generated: false
  });

// app/content-flow/PublishingScheduler.js (Media Preview baris 2627-2660)
  {/* 4. Preview Media Konten (Otomatis & Lebih Besar) */}
  {scheduleForm.media_url && (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>▶️</span>
          <span>Preview Media Konten</span>
          {selectedMediaFileName && (
            <span style={{ fontSize: 10, color: 'var(--link)', fontWeight: 600 }}>({selectedMediaFileName})</span>
          )}
        </label>
      </div>
      <div style={{
        background: '#070b13', borderRadius: 10, border: '1px solid var(--border-subtle)',
        overflow: 'hidden', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center',
        maxHeight: 380, padding: 4
      }}>
        {scheduleForm.media_type === 'image' ? (
          <img
            src={scheduleForm.media_url}
            alt="Preview Media"
            style={{ maxHeight: 370, maxWidth: '100%', objectFit: 'contain', borderRadius: 6 }}
          />
        ) : (
          <video
            src={scheduleForm.media_url}
            controls
            playsInline
            style={{ maxHeight: 370, maxWidth: '100%', width: 'auto', background: '#000', borderRadius: 6 }}
          />
        )}
      </div>
    </div>
  )}
```

#### Code Sesudah (Proposed/After)
```javascript
// app/content-flow/PublishingScheduler.js (Menerima initialPreloadItems & state Bulk Mode)
export default function PublishingScheduler({
  initialPreloadItem = null,
  initialPreloadItems = null, // Prop baru untuk Bulk Scheduling
  onBackToLibrary = null,
  modalOnly = false,
  controlledBrandProfileId = null,
  controlledAccountName = null,
  controlledContentRunIds = null,
  controlledProgramId = null
}) {
  const initialItemsList = useMemo(() => {
    if (Array.isArray(initialPreloadItems) && initialPreloadItems.length > 0) return initialPreloadItems;
    if (initialPreloadItem) return [initialPreloadItem];
    return [];
  }, [initialPreloadItems, initialPreloadItem]);

  const [bulkItems, setBulkItems] = useState(initialItemsList);
  const [isBulkMode, setIsBulkMode] = useState(initialItemsList.length > 1);
  const [bulkStrategy, setBulkStrategy] = useState('interval'); // 'interval', 'simultaneous', 'daily'
  const [bulkIntervalMinutes, setBulkIntervalMinutes] = useState(120);
  const [bulkDailyStep, setBulkDailyStep] = useState(1);
  const [bulkTargetDate, setBulkTargetDate] = useState('2026-10-13');
  const [bulkTargetTime, setBulkTargetTime] = useState('10:00');

// app/content-flow/PublishingScheduler.js (Media Preview DISABLED pada Bulk Mode)
  {/* 4. Preview Media Konten (DISABLED pada Bulk Mode sesuai instruksi) */}
  {isBulkMode ? (
    <div style={{
      marginBottom: 12, padding: '14px 16px', background: 'var(--surface-raised)',
      border: '1px dashed var(--border-strong)', borderRadius: 10, display: 'flex',
      alignItems: 'center', gap: 12
    }}>
      <span style={{ fontSize: 24, color: 'var(--text-muted)' }}>🔒</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
          Preview Media Dinonaktifkan (Mode Bulk Scheduling)
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>
          Pemutar video dinonaktifkan otomatis untuk {bulkItems.length} konten agar menghemat memori browser dan mencegah lag saat memuat video berukuran besar secara bersamaan.
        </div>
      </div>
    </div>
  ) : (
    scheduleForm.media_url && (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>▶️</span>
            <span>Preview Media Konten</span>
            {selectedMediaFileName && (
              <span style={{ fontSize: 10, color: 'var(--link)', fontWeight: 600 }}>({selectedMediaFileName})</span>
            )}
          </label>
        </div>
        <div style={{
          background: 'var(--canvas)', borderRadius: 10, border: '1px solid var(--border-subtle)',
          overflow: 'hidden', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center',
          maxHeight: 380, padding: 4
        }}>
          {scheduleForm.media_type === 'image' ? (
            <img src={scheduleForm.media_url} alt="Preview Media" style={{ maxHeight: 370, maxWidth: '100%', objectFit: 'contain', borderRadius: 6 }} />
          ) : (
            <video src={scheduleForm.media_url} controls playsInline style={{ maxHeight: 370, maxWidth: '100%', width: 'auto', background: '#000', borderRadius: 6 }} />
          )}
        </div>
      </div>
    )
  )}
```

---

### File 2: `app/content-flow/page.js`

#### Code Sebelum (Current/Before)
```javascript
// app/content-flow/page.js (State pembuka scheduler)
  const [schedulePreloadItem, setSchedulePreloadItem] = useState(null);

// app/content-flow/page.js (Modal scheduler overlay)
  {schedulePreloadItem && (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '20px', overflowY: 'auto'
    }}>
      <div style={{ width: '100%', maxWidth: '960px', position: 'relative' }}>
        <PublishingScheduler
          initialPreloadItem={schedulePreloadItem}
          modalOnly={true}
          onBackToLibrary={() => {
            setSchedulePreloadItem(null);
            loadContent();
          }}
        />
      </div>
    </div>
  )}
```

#### Code Sesudah (Proposed/After)
```javascript
// app/content-flow/page.js (Menambahkan state multi-seleksi dan bulk preload)
  const [schedulePreloadItem, setSchedulePreloadItem] = useState(null);
  const [bulkPreloadItems, setBulkPreloadItems] = useState(null); // Array item untuk bulk scheduler
  const [selectedIds, setSelectedIds] = useState(new Set());

  const handleToggleSelect = (itemId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleQuickSelect5 = () => {
    const top5 = items.slice(0, 5).map(it => it.id);
    setSelectedIds(new Set(top5));
    showToast(`${top5.length} konten terbaru berhasil dipilih.`);
  };

  const handleLaunchBulkSchedule = () => {
    const selectedItems = items.filter(it => selectedIds.has(it.id));
    if (selectedItems.length === 0) return;
    setBulkPreloadItems(selectedItems);
  };

// app/content-flow/page.js (Modal scheduler overlay mendukung Single & Bulk)
  {(schedulePreloadItem || (bulkPreloadItems && bulkPreloadItems.length > 0)) && (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'var(--overlay-backdrop)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '20px', overflowY: 'auto'
    }}>
      <div style={{ width: '100%', maxWidth: '960px', position: 'relative' }}>
        <PublishingScheduler
          initialPreloadItem={schedulePreloadItem}
          initialPreloadItems={bulkPreloadItems}
          modalOnly={true}
          onBackToLibrary={() => {
            setSchedulePreloadItem(null);
            setBulkPreloadItems(null);
            setSelectedIds(new Set());
            loadContent();
          }}
        />
      </div>
    </div>
  )}
```

---

### File 3: `app/api/v2/publishing/bulk-jobs/route.js`

#### Code Sesudah (Telah Diimplementasikan & Lulus Uji)
```javascript
import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import { createPublishingJobs } from '@/lib/publishing-repository';
import { pgQuery } from '@/lib/db-pg';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (request, user) => {
  try {
    const tenantId = getActiveTenantId();
    const body = await request.json();

    const {
      items = [],
      account_ids = [],
      publish_mode = 'live',
      media_type = 'reels',
      is_ai_generated = true,
      timezone = 'Asia/Jakarta'
    } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Daftar konten (items) wajib disertakan dan tidak boleh kosong.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(account_ids) || account_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Pilih minimal satu akun media sosial tujuan.' },
        { status: 400 }
      );
    }

    const allCreatedJobs = [];
    const scheduledContentIds = [];

    for (const rawItem of items) {
      const contentId = rawItem.content_id || rawItem.video_id;
      if (!contentId) continue;

      let caption = rawItem.caption || '';
      let mediaUrl = rawItem.media_url || '';
      const scheduledAt = rawItem.scheduled_at || new Date().toISOString();

      if (!caption || !mediaUrl) {
        try {
          const dbItemRes = await pgQuery(
            `SELECT hook, caption, url_asset, nextcloud_url 
             FROM content_flow_items 
             WHERE (video_id = $1 OR id::text = $1) AND tenant_id = $2
             LIMIT 1`,
            [contentId, tenantId]
          );
          if (dbItemRes.rowCount > 0) {
            const dbRow = dbItemRes.rows[0];
            if (!caption) caption = dbRow.caption || dbRow.hook || '';
            if (!mediaUrl) mediaUrl = dbRow.url_asset || dbRow.nextcloud_url || '';
          }
        } catch (_) {}
      }

      const targets = account_ids.map(accId => ({
        accountId: accId,
        publishMode: publish_mode,
        mediaType: media_type,
        caption: caption,
        mediaUrl: mediaUrl,
        scheduledAt: scheduledAt,
        approvalStatus: publish_mode === 'live' ? 'pending_approval' : 'not_required',
        isAiGenerated: !!is_ai_generated
      }));

      const created = await createPublishingJobs({
        tenantId,
        userId: user?.id || null,
        contentId,
        targets
      });

      allCreatedJobs.push(...created);
      scheduledContentIds.push(contentId);
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil menjadwalkan ${scheduledContentIds.length} konten massal (${allCreatedJobs.length} antrean publikasi).`,
      total_items: scheduledContentIds.length,
      total_jobs: allCreatedJobs.length,
      jobs: allCreatedJobs
    }, { status: 201 });
  } catch (error) {
    console.error('[Bulk Publishing Jobs API Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
```

---

## 5. Ringkasan Evaluasi & Rekomendasi Arsitektur

1. **Kelayakan Modifikasi Modal**: **100% Layak dan Sangat Direkomendasikan**. Modifikasi `PublishingScheduler.js` jauh lebih efisien karena mendaur ulang seluruh pipeline autentikasi Repliz & Meta, validasi preflight, dan manajemen state akun yang sudah teruji.
2. **Media Preview Disabled**: Sangat tepat secara teknis. Browser Chromium/WebKit mengalami lonjakan konsumsi memori dan degradasi rendering ketika 5-10 HTML5 `<video>` dimuat bersamaan. Menampilkan chips ringkas dan tabel kalkulasi waktu jauh lebih cepat, responsif, dan hemat memori.
3. **Mode Publikasi (Live vs Draft)**: Tetap diakomodasi penuh baik pada Single Mode maupun Bulk Mode. Pengguna dapat memilih apakah antrean massal akan dijadwalkan sebagai `Live` (otomatis tayang saat tiba waktunya setelah approval) atau disimpan sebagai `Draft` di platform target.
4. **Fleksibilitas Jeda Waktu Interval**: Menyediakan preset durasi (30 Menit, 1 Jam, 2 Jam, 3 Jam, 4 Jam, 6 Jam) serta input manual menit kustom agar pengguna bebas menentukan jarak publikasi sesuai strategi engagement media sosial mereka.
5. **Mockup Interaktif**: Pengguna dapat langsung menguji alur kerja di [`public/mockup_publishing_scheduler_unified_bulk.html`](file:///Users/sabeqmmursyid/_contentflow-staging/public/mockup_publishing_scheduler_unified_bulk.html).
