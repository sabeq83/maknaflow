# Rencana Implementasi: Label AIGC Default Checked & Mode Publikasi Live Autopilot (Tanpa Approval)

## Ringkasan Eksekutif
Berdasarkan arahan pengguna, rencana ini mencakup dua peningkatan utama pada sistem penjadwalan publikasi Content Flow:

1. **Label AIGC Default Tercentang (`is_ai_generated = true`)**:
   - Menjadikan opsi *"Label AI-Generated Content (AIGC)"* aktif/tercentang secara default saat modal dibuka.
   - Memastikan seluruh konten video yang dibuat menggunakan pipeline AI otomatis mematuhi regulasi AI disclosure platform (TikTok AIGC, Meta AI Label, YouTube Synthetic Media) tanpa risiko lupa centang secara manual. Pengguna tetap dapat menghapus centang jika mempublikasikan konten non-AI.

2. **Mode Publikasi Live Autopilot Tanpa Approval (`approval_status = 'not_required'`)**:
   - Menghapus kewajiban approval manual pada mode Live.
   - Sebelumnya, setiap kali memilih mode Live, job ditandai `approval_status: 'pending_approval'`, yang mengunci antrean hingga pengguna meninjau dan menekan tombol Approve satu per satu di UI.
   - Dengan perbaikan ini, job dengan mode Live langsung berstatus `approval_status: 'not_required'`. Saat waktu tayang (`scheduled_at`) tiba, Publishing Worker langsung mengeksekusi dan mengunggah postingan ke Repliz secara otomatis (autopilot penuh).
   - Label pada dropdown UI diperbarui menjadi: *"Live (Langsung publish otomatis sesuai jadwal — Tanpa Approval)"*.

---

## Execution Task List
- [x] **Task 1: Perbarui Antarmuka Form Scheduler untuk AIGC Default Checked & Live Tanpa Approval** (`app/content-flow/PublishingScheduler.js`)
- [x] **Task 2: Ubah Aturan Approval Backend Menjadi Autopilot (`approvalStatus = 'not_required'`)** (`app/api/v2/publishing/jobs/route.js` & `app/api/v2/publishing/bulk-jobs/route.js`)
- [x] **Task 3: Selaraskan Default Repository `createPublishingJobs`** (`lib/publishing-repository.js`)
- [x] **Task 4: Sesuaikan dan Validasi Suite Unit Test Terkait Kontrak Penjadwalan** (`tests/bulk-publishing-jobs.test.js`, `tests/repliz-client.test.js`, `tests/publishing-scheduler.test.js`)
- [ ] **Task 5: Build Produksi Lokal, Verifikasi Zero Error, Rilis Patch Non-Interaktif, dan Deploy ke Dev & Staging Mac Mini**

---

## Before & After Code Snippets

### 1. `app/content-flow/PublishingScheduler.js`
1. Mengubah inisialisasi state `is_ai_generated` dari `false` menjadi `true`.
2. Memperbarui teks dropdown mode publikasi agar mencerminkan alur tanpa approval.

#### Code Sebelum (Current/Before):
```javascript
  // Schedule Modal State
  const defaultScheduleTime = getWibNowPlusMinutes(10);
  const [showScheduleModal, setShowScheduleModal] = useState(Boolean(initialPreloadItem || (Array.isArray(initialPreloadItems) && initialPreloadItems.length > 0)));
  const [scheduleForm, setScheduleForm] = useState({
    content_id: initialItemsList[0]?.video_id || initialItemsList[0]?.id || '',
    account_ids: [],
    platform: 'facebook',
    publish_mode: 'live',
    media_type: 'reels',
    caption: initialItemsList[0]?.caption || '',
    media_url: initialItemsList[0]?.url_asset || initialItemsList[0]?.nextcloud_url || '',
    scheduled_at: defaultScheduleTime,
    account_schedules: {},
    timezone: 'Asia/Jakarta',
    activeTabProvider: 'repliz',  // Default Repliz Cloud
    is_ai_generated: false
  });
```
*dan pada dropdown opsi:*
```jsx
                  <select
                    value={scheduleForm.publish_mode}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, publish_mode: e.target.value })}
                    style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--surface-interactive)', padding: '8px 10px', borderRadius: 6, color: 'var(--text-primary)', fontSize: 12 }}
                  >
                    <option value="live">Live (Memerlukan Approval sebelum publikasi)</option>
                    <option value="draft">Draft (Tersimpan sebagai draft platform)</option>
                  </select>
```

#### Code Sesudah (Proposed/After):
```javascript
  // Schedule Modal State
  const defaultScheduleTime = getWibNowPlusMinutes(10);
  const [showScheduleModal, setShowScheduleModal] = useState(Boolean(initialPreloadItem || (Array.isArray(initialPreloadItems) && initialPreloadItems.length > 0)));
  const [scheduleForm, setScheduleForm] = useState({
    content_id: initialItemsList[0]?.video_id || initialItemsList[0]?.id || '',
    account_ids: [],
    platform: 'facebook',
    publish_mode: 'live',
    media_type: 'reels',
    caption: initialItemsList[0]?.caption || '',
    media_url: initialItemsList[0]?.url_asset || initialItemsList[0]?.nextcloud_url || '',
    scheduled_at: defaultScheduleTime,
    account_schedules: {},
    timezone: 'Asia/Jakarta',
    activeTabProvider: 'repliz',  // Default Repliz Cloud
    is_ai_generated: true
  });
```
*dan pada dropdown opsi:*
```jsx
                  <select
                    value={scheduleForm.publish_mode}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, publish_mode: e.target.value })}
                    style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--surface-interactive)', padding: '8px 10px', borderRadius: 6, color: 'var(--text-primary)', fontSize: 12 }}
                  >
                    <option value="live">Live (Langsung publish otomatis sesuai jadwal — Tanpa Approval)</option>
                    <option value="draft">Draft (Tersimpan sebagai draft platform)</option>
                  </select>
```

---

### 2. `app/api/v2/publishing/jobs/route.js`
Menghilangkan status `pending_approval` pada mode Live sehingga job langsung berstatus `not_required` dan siap diproses otomatis.

#### Code Sebelum (Current/Before):
```javascript
    const targets = validated.account_ids.map(accId => ({
      accountId: accId,
      publishMode: validated.publish_mode,
      mediaType: validated.media_type,
      caption: validated.caption,
      mediaUrl: validated.media_url,
      scheduledAt: validated.schedules?.[accId] || validated.scheduled_at,
      approvalStatus: validated.publish_mode === 'live' ? 'pending_approval' : 'not_required',
      isAiGenerated: !!validated.is_ai_generated
    }));
```

#### Code Sesudah (Proposed/After):
```javascript
    const targets = validated.account_ids.map(accId => ({
      accountId: accId,
      publishMode: validated.publish_mode,
      mediaType: validated.media_type,
      caption: validated.caption,
      mediaUrl: validated.media_url,
      scheduledAt: validated.schedules?.[accId] || validated.scheduled_at,
      approvalStatus: 'not_required',
      isAiGenerated: !!validated.is_ai_generated
    }));
```

---

### 3. `app/api/v2/publishing/bulk-jobs/route.js`
Menghilangkan status `pending_approval` pada endpoint bulk scheduling.

#### Code Sebelum (Current/Before):
```javascript
      // Build target entries per account
      const targets = account_ids.map(accId => ({
        accountId: accId,
        publishMode: publish_mode,
        mediaType: rawItem.media_type || media_type || 'reels',
        caption: caption,
        mediaUrl: mediaUrl,
        scheduledAt: scheduledAt,
        approvalStatus: publish_mode === 'live' ? 'pending_approval' : 'not_required',
        isAiGenerated: !!is_ai_generated
      }));
```

#### Code Sesudah (Proposed/After):
```javascript
      // Build target entries per account
      const targets = account_ids.map(accId => ({
        accountId: accId,
        publishMode: publish_mode,
        mediaType: rawItem.media_type || media_type || 'reels',
        caption: caption,
        mediaUrl: mediaUrl,
        scheduledAt: scheduledAt,
        approvalStatus: 'not_required',
        isAiGenerated: !!is_ai_generated
      }));
```

---

### 4. `lib/publishing-repository.js`
Menyelaraskan default fallback `approvalStatus` dan `isAiGenerated` pada modul repository.

#### Code Sebelum (Current/Before):
```javascript
      const {
        accountId,
        platform,
        publishMode = 'draft',
        mediaType = 'text_only',
        caption = '',
        mediaUrl = '',
        scheduledAt,
        approvalStatus = (publishMode === 'live' ? 'pending_approval' : 'not_required'),
        isAiGenerated = false
      } = target;
```

#### Code Sesudah (Proposed/After):
```javascript
      const {
        accountId,
        platform,
        publishMode = 'draft',
        mediaType = 'text_only',
        caption = '',
        mediaUrl = '',
        scheduledAt,
        approvalStatus = 'not_required',
        isAiGenerated = true
      } = target;
```
