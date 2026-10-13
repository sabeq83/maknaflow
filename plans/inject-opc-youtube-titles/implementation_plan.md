# Implementation Plan - Batch Injection YouTube Title untuk Kampanye OPC Eksisting

Rencana penyuntikan YouTube Title (`yt_title`) ke seluruh 39 baris konten kampanye pilar:
1. `opc_261012_lyg6eh` (Solusi Thermal ID — 18 item)
2. `opc_261012_9ibcvk` (Ruang Akustik ID — 21 item)

Serta memastikan sinkronisasi ke tabel `content_flow_items` sehingga judul video otomatis terkirim saat dipublikasikan ke YouTube via Repliz Cloud.

---

## User Review Required

> [!IMPORTANT]
> - **Integrasi Repliz**: Ketika judul YouTube disuntikkan, judul tersebut otomatis tersimpan di `pillar_campaign_items.result_json` dan `content_flow_items.social_media_package_json` (`title`).
> - Saat pengguna menjadwalkan konten ke YouTube via Repliz, `publishing-worker.js` membaca `content_title` dari `social_media_package_json->>'title'`, sehingga judul YouTube ini **100% otomatis digunakan oleh Repliz Cloud** sebagai Video Title, dan naskah panjang digunakan sebagai Description.
> - Runner script memiliki mode `--dry-run` untuk melihat dan meninjau seluruh 39 judul sebelum dieksekusi ke database dengan `--apply`.

---

## Execution Task List

- [x] **Task 1: Buat Batch Injection Script (`scripts/inject-opc-youtube-titles.js`)**
  - Membuat script mandiri yang mendukung opsi `--campaigns`, `--schema staging`, `--dry-run`, dan `--apply`.
  - Mengintegrasikan Gemini AI (via Key Pool MAKNA Flow) untuk merumuskan judul YouTube Shorts bernilai CTR tinggi (50–70 karakter + `#Shorts`).
  - Mengupdate `result_json` di `pillar_campaign_items` dan `social_media_package_json` di `content_flow_items`.
- [x] **Task 2: Eksekusi Dry-Run & Review 39 Judul**
  - Menjalankan script dalam mode `--dry-run` untuk memverifikasi seluruh 39 judul yang dihasilkan beserta panjang karakternya.
- [x] **Task 3: Eksekusi Penerapan ke Database Staging (`--apply`)**
  - Menerapkan perubahan ke schema `staging` PostgreSQL secara atomik.
- [x] **Task 4: Verifikasi Sinkronisasi Database & Pipeline Repliz**
  - Memverifikasi langsung pada database `staging.pillar_campaign_items` dan `staging.content_flow_items` bahwa `yt_title` dan `social_media_package_json->>'title'` telah terisi sempurna.

---

## Before & After Code Snippets

### 1. `scripts/inject-opc-youtube-titles.js` (File Baru)

#### Code Sebelum (Current/Before)
*(File belum ada di codebase)*

#### Code Sesudah (Proposed/After)
```javascript
/**
 * scripts/inject-opc-youtube-titles.js
 * Batch injection YouTube Title untuk kampanye OPC eksisting.
 * Menghasilkan judul YouTube Shorts (50-70 karakter + #Shorts) via Gemini AI,
 * lalu menyuntikkannya ke pillar_campaign_items dan content_flow_items.
 */

import { pgQuery } from '../lib/db-pg.js';
import { executeWithKeyPool } from '../lib/gemini-key-pool.js';
import { generateContentFlexible } from '../lib/gemini.js';

// Parsing argumen CLI (--campaigns, --schema, --dry-run, --apply)
// Query database staging.pillar_campaign_items dan staging.content_flow_items
// Loop 39 item, generate judul CTR tinggi dengan formula:
// "50-70 karakter, curiosity hook, relevan dengan naskah, akhiri #Shorts"
// Update result_json dan social_media_package_json
```

---

### 2. Kueri Sinkronisasi ke `content_flow_items`

#### Code Sebelum (Current/Before)
```sql
-- Di staging.content_flow_items sebelum disuntik:
-- social_media_package_json bernilai NULL atau tidak memiliki field title
SELECT id, video_id, social_media_package_json->>'title' AS yt_title 
FROM staging.content_flow_items 
WHERE source_campaign_id IN ('opc_261012_lyg6eh', 'opc_261012_9ibcvk');
-- Hasil: yt_title = NULL
```

#### Code Sesudah (Proposed/After)
```sql
-- Di staging.content_flow_items setelah disuntik:
UPDATE staging.content_flow_items
SET social_media_package_json = jsonb_set(
  COALESCE(social_media_package_json, '{}'::jsonb),
  '{title}',
  to_jsonb($1::text)
),
updated_at = NOW()
WHERE source_item_id = $2;
-- Hasil: social_media_package_json->>'title' = 'Bahaya Kawat Insulasi Kendur! Ruangan Tetap Panas #Shorts'
```

---

## Verification Plan

### Automated Verification
1. Jalankan `scripts/inject-opc-youtube-titles.js --dry-run` untuk memverifikasi 39 judul.
2. Jalankan `scripts/inject-opc-youtube-titles.js --apply` untuk menyimpan ke staging DB.
3. Kueri verifikasi SQL untuk memastikan tidak ada lagi item dengan `yt_title` kosong di kedua kampanye.

### Manual Verification by User
1. Buka Web App Staging -> Menu **Pillar Campaign** -> Buka kampanye `opc_261012_lyg6eh` atau `opc_261012_9ibcvk`.
2. Klik salah satu item -> Buka tab **Workbench**.
3. Pastikan kolom **Judul YouTube Video / Shorts** telah terisi judul yang menarik dan indikator counter karakter berwarna hijau/optimal.
4. Buka menu **Content Flow** -> Buka modal penjadwalan -> Pastikan judul YouTube otomatis terisi.
