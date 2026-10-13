# Implementation Plan: Perbaikan Bug YouTube Title Repliz Scheduler (Menggunakan Judul High-CTR, Bukan Nama File)

## Ringkasan Eksekutif
Berdasarkan investigasi dan bukti nyata pada YouTube Studio, terdeteksi bug pada pipeline penjadwalan Repliz untuk platform YouTube di mana judul video yang terbit menjadi nama file/ID konten internal (`solusithermalid_opc_lyg6eh_06`), bukan judul video YouTube High-CTR yang telah digenerate (`Panas Atap Seng Rusak Kargo Gudang? Lindungi Area Loading Dock! #Shorts`).

Akar masalah:
1. `claimDuePublishingJob` di [lib/publishing-repository.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/publishing-repository.js) tidak melakukan `LEFT JOIN content_flow_items` dan tidak menyeleksi kolom `content_title`.
2. Akibatnya, `job.content_title` bernilai `undefined` saat diklaim oleh worker.
3. Di [lib/publishing-worker.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/publishing-worker.js#L715), kode `title: job.platform === 'youtube' ? (job.content_title || job.content_id || '') : ''` otomatis jatuh ke fallback `job.content_id` (nama file/slug).
4. Tabel `publishing_jobs` belum memiliki kolom `title_snapshot` untuk mengunci judul saat penjadwalan dibuat.
5. Form modal penjadwalan di UI belum menyediakan input judul video YouTube.

Rencana ini memperbaiki seluruh lapisan tersebut secara tuntas (*defense-in-depth*).

---

## Execution Task List
- [x] **Task 1: Buat Mockup HTML Standalone untuk Input Judul YouTube di Modal Penjadwalan** (`public/mockup_publishing_scheduler_youtube_title.html`)
- [x] **Task 2: Tambahkan Kolom `title_snapshot` pada Skema Database & Repositori** (`lib/db-pg.js` & `lib/publishing-repository.js`)
- [x] **Task 3: Perbaiki Query Klaim Worker `claimDuePublishingJob` agar Menyeleksi `content_title`** (`lib/publishing-repository.js`)
- [x] **Task 4: Tambahkan Proteksi Anti-Slug & Fallback Lookup di Worker Repliz** (`lib/publishing-worker.js`)
- [x] **Task 5: Dukung Field `title` pada Kontrak Validasi & API Routes** (`lib/publishing-contract.js`, `app/api/v2/publishing/jobs/route.js`, `app/api/v2/publishing/bulk-jobs/route.js`)
- [x] **Task 6: Tampilkan dan Integrasikan Input Judul YouTube pada UI Modal Penjadwalan** (`app/content-flow/PublishingScheduler.js`)
- [x] **Task 7: Validasi Suite Unit Test Terkait Resolusi Judul YouTube** (`tests/publishing-scheduler.test.js` & `tests/repliz-client.test.js`)
- [ ] **Task 8: Build Produksi Lokal, Verifikasi Zero Error, Rilis Patch Non-Interaktif, dan Deploy ke Dev & Staging Mac Mini**

---

## Before & After Code Snippets

### 1. `lib/publishing-repository.js` — Query `claimDuePublishingJob`
Menambahkan `LEFT JOIN content_flow_items` dan resolusi `content_title`.

#### Code Sebelum (Current/Before):
```javascript
    const selectSql = `
      SELECT 
        j.id, j.tenant_id, j.content_id, j.account_id, j.platform,
        j.publish_mode, j.media_type, j.caption_snapshot, j.media_url_snapshot,
        j.scheduled_at, j.status, j.approval_status, j.attempt_count, j.max_attempts,
        j.external_container_id, j.external_post_id, j.external_media_status,
        j.external_object_type, j.provider_stage, j.provider_state_json, j.verified_at,
        j.provider, j.external_schedule_id,
        a.token_ciphertext, a.facebook_page_id, a.instagram_user_id,
        a.timezone AS account_timezone, a.provider_account_id,
        a.status AS account_status, a.display_name AS account_display_name
      FROM publishing_jobs j
      JOIN publishing_accounts a ON j.account_id = a.id
      LEFT JOIN publishing_control ctrl ON ctrl.tenant_id = j.tenant_id
      WHERE 
        (ctrl.is_paused IS NOT TRUE)
        AND j.approval_status != 'pending_approval'
        AND j.approval_status != 'rejected'
```

#### Code Sesudah (Proposed/After):
```javascript
    const selectSql = `
      SELECT 
        j.id, j.tenant_id, j.content_id, j.account_id, j.platform,
        j.publish_mode, j.media_type, j.caption_snapshot, j.media_url_snapshot,
        j.scheduled_at, j.status, j.approval_status, j.attempt_count, j.max_attempts,
        j.external_container_id, j.external_post_id, j.external_media_status,
        j.external_object_type, j.provider_stage, j.provider_state_json, j.verified_at,
        j.provider, j.external_schedule_id, j.title_snapshot,
        a.token_ciphertext, a.facebook_page_id, a.instagram_user_id,
        a.timezone AS account_timezone, a.provider_account_id,
        a.status AS account_status, a.display_name AS account_display_name,
        COALESCE(
          NULLIF(j.title_snapshot, ''),
          NULLIF(c.social_media_package_json->>'title', ''),
          NULLIF(c.hook, ''),
          c.campaign_title,
          j.content_id
        ) AS content_title
      FROM publishing_jobs j
      JOIN publishing_accounts a ON j.account_id = a.id
      LEFT JOIN publishing_control ctrl ON ctrl.tenant_id = j.tenant_id
      LEFT JOIN content_flow_items c ON (c.video_id = j.content_id AND c.tenant_id = j.tenant_id)
      WHERE 
        (ctrl.is_paused IS NOT TRUE)
        AND j.approval_status != 'pending_approval'
        AND j.approval_status != 'rejected'
```

---

### 2. `lib/publishing-worker.js` — Payload Repliz untuk YouTube
Memastikan worker tidak mengirimkan ID file / slug mentah ke YouTube dan memiliki active fallback lookup.

#### Code Sebelum (Current/Before):
```javascript
      const payload = {
        accountId: job.provider_account_id,
        scheduleAt: job.scheduled_at,
        type: getReplizPostType(job.platform, job.media_type),
        title: job.platform === 'youtube' ? (job.content_title || job.content_id || '') : '',
        description: job.caption_snapshot || '',
```

#### Code Sesudah (Proposed/After):
```javascript
      // Resolve high-quality YouTube title (never send raw slug if human title exists)
      let resolvedYoutubeTitle = '';
      if (job.platform === 'youtube') {
        resolvedYoutubeTitle = (job.content_title || job.title_snapshot || '').trim();
        const isSlugLike = !resolvedYoutubeTitle || resolvedYoutubeTitle === job.content_id || /^[a-z0-9_]+$/i.test(resolvedYoutubeTitle);
        
        if (isSlugLike) {
          try {
            const { pgQuery } = await import('./db-pg.js');
            const cfRes = await pgQuery(
              `SELECT social_media_package_json->>'title' AS yt_title, hook, campaign_title 
               FROM content_flow_items 
               WHERE (video_id = $1 OR id = $1) AND tenant_id = $2 LIMIT 1`,
              [job.content_id, job.tenant_id]
            );
            if (cfRes.rows[0]) {
              resolvedYoutubeTitle = cfRes.rows[0].yt_title || cfRes.rows[0].hook || cfRes.rows[0].campaign_title || resolvedYoutubeTitle;
            }
          } catch (lookupErr) {
            console.warn(`[Publishing Worker] YouTube title fallback lookup error for job ${job.id}:`, lookupErr.message);
          }
        }
        resolvedYoutubeTitle = sanitizeYoutubeTitle(resolvedYoutubeTitle || job.content_id);
      }

      const payload = {
        accountId: job.provider_account_id,
        scheduleAt: job.scheduled_at,
        type: getReplizPostType(job.platform, job.media_type),
        title: job.platform === 'youtube' ? resolvedYoutubeTitle : '',
        description: job.caption_snapshot || '',
```

---

### 3. `lib/publishing-repository.js` — `createPublishingJobs`
Menyimpan snapshot judul ke kolom `title_snapshot`.

#### Code Sebelum (Current/Before):
```javascript
      const insertRes = await client.query(`
        INSERT INTO publishing_jobs (
          id, tenant_id, content_id, account_id, platform,
          publish_mode, media_type, caption_snapshot, media_url_snapshot,
          scheduled_at, status, approval_status, idempotency_key, created_by, provider,
          is_ai_generated
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13, $14, $15, $16
        )
```

#### Code Sesudah (Proposed/After):
```javascript
      // Resolve title snapshot from input or content_flow_items
      let resolvedTitleSnapshot = target.title || '';
      if (!resolvedTitleSnapshot) {
        const cfRes = await client.query(`
          SELECT social_media_package_json->>'title' AS yt_title, hook, campaign_title 
          FROM content_flow_items 
          WHERE video_id = $1 AND tenant_id = $2 LIMIT 1
        `, [contentId, tenantId]);
        if (cfRes.rows[0]) {
          resolvedTitleSnapshot = cfRes.rows[0].yt_title || cfRes.rows[0].hook || cfRes.rows[0].campaign_title || '';
        }
      }

      const insertRes = await client.query(`
        INSERT INTO publishing_jobs (
          id, tenant_id, content_id, account_id, platform,
          publish_mode, media_type, caption_snapshot, media_url_snapshot,
          scheduled_at, status, approval_status, idempotency_key, created_by, provider,
          is_ai_generated, title_snapshot
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13, $14, $15, $16, $17
        )
```

---

### 4. `app/content-flow/PublishingScheduler.js` — Input Judul YouTube di UI
Menambahkan field input judul YouTube di modal form jika salah satu akun yang dipilih adalah YouTube.

#### Code Sebelum (Current/Before):
```jsx
              {/* Option: AI Generated Content (AIGC) - Repliz */}
              {(scheduleForm.activeTabProvider || 'meta') === 'repliz' && (
```

#### Code Sesudah (Proposed/After):
```jsx
              {/* YouTube Title Input jika ada akun YouTube yang dipilih */}
              {accounts.some(a => scheduleForm.account_ids.includes(a.id) && a.platform === 'youtube') && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>
                    <span>Judul Video YouTube (High-CTR Title)</span>
                    <span style={{ color: (scheduleForm.title || '').length <= 85 ? 'var(--status-success)' : 'var(--status-warning)' }}>
                      {(scheduleForm.title || '').length} / 85 karakter
                    </span>
                  </label>
                  <input
                    type="text"
                    value={scheduleForm.title || ''}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })}
                    placeholder="Judul YouTube Shorts yang memikat penonton..."
                    style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--surface-interactive)', padding: '8px 10px', borderRadius: 6, color: 'var(--text-primary)', fontSize: 12 }}
                  />
                </div>
              )}

              {/* Option: AI Generated Content (AIGC) - Repliz */}
              {(scheduleForm.activeTabProvider || 'meta') === 'repliz' && (
```

---

## Verification Plan

### Automated Verification
1. Jalankan unit test `node --test tests/publishing-scheduler.test.js tests/repliz-client.test.js`.
2. Validasi query `claimDuePublishingJob` menghasilkan `content_title` terisi lengkap dan tidak lagi `undefined`.
3. Validasi payload Repliz untuk YouTube mengirimkan `title` sesuai judul konten, bukan `content_id`.

### Manual Verification
1. Jadwalkan konten video yang memiliki YouTube account via modal Publishing Scheduler.
2. Periksa bahwa judul video YouTube muncul di form input dan dapat disesuaikan.
3. Jalankan worker tick atau periksa database `publishing_jobs.title_snapshot` terisi dengan benar.
