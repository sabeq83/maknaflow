# Rencana Implementasi: Perbaikan Drive Staging untuk Media Lokal, Visibilitas Riwayat Needs Review, dan Penjadwalan Ulang Job

## Ringkasan Eksekutif
Investigasi membuktikan bahwa kegagalan publikasi pada jam 07:47, 07:57, 09:47, dan 09:57 WIB terjadi karena:
1. File video final One-Person Campaign (OPC) tersimpan di disk server Mac Mini sebagai path relatif (`/temp/opc_final_XXXX.mp4`).
2. Staging worker memanggil `uploadUrlToPublicDrive(sourceUrl)` di `lib/drive-uploader.js` yang langsung menjalankan `fetch(sourceUrl)`. Karena bukan URL HTTP berprotokol, Node.js crash dengan `TypeError: Failed to parse URL from /temp/...`.
3. Kegagalan tersebut diklasifikasikan sebagai status `needs_review`. Pada fungsi `listPublishingJobs` di `lib/publishing-repository.js`, status `needs_review` tidak di-query pada tab Queue maupun History, sehingga job "ghaib" dari pandangan antarmuka pengguna.
4. Rencana ini memperbaiki uploader agar mendukung streaming file fisik lokal langsung dari disk ke Google Drive, menampilkan status `needs_review` secara transparan di Riwayat Publikasi (History), dan menjadwalkan ulang 12 job Facebook, Instagram, dan TikTok yang tertahan ke slot setelah antrean terakhir hari ini (15:47 & 15:57) dengan interval 2 jam (mulai 17:47, 17:57, 19:47, dan 19:57 WIB).

---

## Execution Task List
- [x] **Task 1: Perbarui Dukungan Dual-Source (HTTP & Local Disk) pada Drive Uploader** (`lib/drive-uploader.js`)
- [x] **Task 2: Tampilkan Status `needs_review` di Riwayat Publikasi Backend** (`lib/publishing-repository.js`)
- [x] **Task 3: Perkaya Status Badge `NEEDS REVIEW` di Antarmuka Publishing Scheduler** (`app/content-flow/PublishingScheduler.js`)
- [x] **Task 4: Validasi dan Uji Coba Unit Test Staging Uploader** (`tests/publishing-drive-staging.test.js`)
- [x] **Task 5: Jalankan Script Reschedule Job Database ke Jam 17:47, 17:57, 19:47, dan 19:57 WIB** (Database PostgreSQL `staging.publishing_jobs`)
- [ ] **Task 6: Build Produksi Lokal, Verifikasi Zero Error, Rilis Patch, dan Deploy ke Dev & Staging Mac Mini**

---

## Before & After Code Snippets

### 1. `lib/drive-uploader.js`
Menambahkan dukungan deteksi media path lokal (`/temp/...` atau `/uploads/...`) menggunakan `fs.createReadStream()` secara langsung tanpa melalui network `fetch()`.

#### Code Sebelum (Current/Before):
```javascript
  // Download dari source URL (misal Tailscale internal — no Cloudflare/robots.txt)
  const res = await fetch(sourceUrl, {
    signal: AbortSignal.timeout(120000),
    headers: { 'User-Agent': 'MAKNA-Publisher/1.0' }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch media from ${sourceUrl}: HTTP ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || 'video/mp4';

  // Stream langsung ke Drive (tanpa buffer ke disk)
  const requestBody = {
    name: filename,
    parents: [folderId],
  };
  if (Object.keys(appProperties).length > 0) {
    requestBody.appProperties = appProperties;
  }

  const uploaded = await drive.files.create({
    supportsAllDrives: true,
    requestBody,
    media: {
      mimeType: contentType,
      body: Readable.from(res.body),
    },
    fields: 'id, webViewLink',
  });
```

#### Code Sesudah (Proposed/After):
```javascript
  let mediaBody;
  let contentType = 'video/mp4';

  const isHttpUrl = typeof sourceUrl === 'string' && (sourceUrl.startsWith('http://') || sourceUrl.startsWith('https://'));

  if (isHttpUrl) {
    // Download dari source URL (misal Tailscale internal — no Cloudflare/robots.txt)
    const res = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(120000),
      headers: { 'User-Agent': 'MAKNA-Publisher/1.0' }
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch media from ${sourceUrl}: HTTP ${res.status}`);
    }

    contentType = res.headers.get('content-type') || 'video/mp4';
    mediaBody = Readable.from(res.body);
  } else {
    // Sumber file lokal pada disk (misal /temp/opc_final_1653.mp4 atau /uploads/...)
    const { createReadStream, existsSync } = await import('fs');
    const path = await import('path');
    const cleanPath = (sourceUrl || '').replace(/^\/+/, '');
    const candidates = [
      path.join(process.cwd(), 'public', cleanPath),
      path.join(process.cwd(), cleanPath),
      sourceUrl
    ];
    const resolvedLocalPath = candidates.find(c => c && existsSync(c));
    if (!resolvedLocalPath) {
      throw new Error(`Local media file not found for path: ${sourceUrl}`);
    }
    console.log(`[Drive Upload] Streaming local media from: ${resolvedLocalPath}`);
    mediaBody = createReadStream(resolvedLocalPath);
    if (resolvedLocalPath.endsWith('.png')) contentType = 'image/png';
    else if (resolvedLocalPath.endsWith('.jpg') || resolvedLocalPath.endsWith('.jpeg')) contentType = 'image/jpeg';
    else contentType = 'video/mp4';
  }

  // Stream langsung ke Drive (tanpa buffer ke disk)
  const requestBody = {
    name: filename,
    parents: [folderId],
  };
  if (Object.keys(appProperties).length > 0) {
    requestBody.appProperties = appProperties;
  }

  const uploaded = await drive.files.create({
    supportsAllDrives: true,
    requestBody,
    media: {
      mimeType: contentType,
      body: mediaBody,
    },
    fields: 'id, webViewLink',
  });
```

---

### 2. `lib/publishing-repository.js`
Memasukkan status `'needs_review'` ke dalam filter query `view === 'history'` agar semua kegagalan validasi atau uploader tampil transparan pada antarmuka pengguna.

#### Code Sebelum (Current/Before):
```javascript
    if (view === 'queue') {
      conditions.push("j.status IN ('scheduled', 'processing', 'creating_container', 'uploading_media', 'waiting_media', 'publishing', 'verifying', 'retry_wait')");
    } else if (view === 'history') {
      conditions.push("j.status IN ('draft_created', 'published', 'failed', 'cancelled')");
    }
```

#### Code Sesudah (Proposed/After):
```javascript
    if (view === 'queue') {
      conditions.push("j.status IN ('scheduled', 'processing', 'creating_container', 'uploading_media', 'waiting_media', 'publishing', 'verifying', 'retry_wait')");
    } else if (view === 'history') {
      conditions.push("j.status IN ('draft_created', 'published', 'failed', 'cancelled', 'needs_review')");
    }
```

---

### 3. `app/content-flow/PublishingScheduler.js`
Menambahkan badge khusus berdesain Semantic Tokens untuk status `NEEDS REVIEW`.

#### Code Sebelum (Current/Before):
```javascript
      case 'failed':
        return <span style={{ background: 'var(--status-danger-soft)', color: 'var(--status-danger)', padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-danger)' }}></span>FAILED</span>;
      case 'cancelled':
        return <span style={{ background: 'var(--surface)', color: 'var(--text-muted)', padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)' }}></span>CANCELLED</span>;
```

#### Code Sesudah (Proposed/After):
```javascript
      case 'needs_review':
        return <span style={{ background: 'var(--status-warning-soft)', color: 'var(--status-warning)', padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-warning)' }}></span>NEEDS REVIEW</span>;
      case 'failed':
        return <span style={{ background: 'var(--status-danger-soft)', color: 'var(--status-danger)', padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-danger)' }}></span>FAILED</span>;
      case 'cancelled':
        return <span style={{ background: 'var(--surface)', color: 'var(--text-muted)', padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)' }}></span>CANCELLED</span>;
```

---

## 4. Rincian Penjadwalan Ulang (Rescheduling Matrix)

Antrean terakhir yang terjadwal aktif hari ini adalah:
- **15:47 WIB** (`solusithermalid_opc_lyg6eh_02`)
- **15:57 WIB** (`ruangakustikid_opc_9ibcvk_08`)

Maka jadwal penempatan ulang job yang tertahan dengan jeda 2 jam setelah antrean terakhir adalah:

| No | Konten ID | Platform | Waktu Semula | Waktu Baru (WIB) | Waktu Baru (UTC) |
|---|---|---|---|---|---|
| 1 | `solusithermalid_opc_lyg6eh_03` | Facebook, Instagram, TikTok (3 jobs) | 07:47 WIB | **17:47:00 WIB** | `2026-10-13T10:47:00.000Z` |
| 2 | `ruangakustikid_opc_9ibcvk_07` | Facebook, Instagram, TikTok (3 jobs) | 07:57 WIB | **17:57:00 WIB** | `2026-10-13T10:57:00.000Z` |
| 3 | `solusithermalid_opc_lyg6eh_05` | Facebook, Instagram, TikTok (3 jobs) | 09:47 WIB | **19:47:00 WIB** | `2026-10-13T12:47:00.000Z` |
| 4 | `ruangakustikid_opc_9ibcvk_06` | Facebook, Instagram, TikTok (3 jobs) | 09:57 WIB | **19:57:00 WIB** | `2026-10-13T12:57:00.000Z` |

*(Catatan: Job YouTube untuk 4 item ini tetap berstatus `cancelled` sesuai konfigurasi batch awal)*.
