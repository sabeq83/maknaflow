# Rencana Implementasi: ContentFlow Publishing Tracker Hub (Satu Atap)

Integrasi fitur **ContentFlow Hub** langsung ke dalam Web App MAKNA Grid untuk mengelola & menandai status publishing sosial media (TikTok, Facebook, Instagram, YouTube) dari seluruh aset video yang dihasilkan oleh semua menu pembuatan kampanye (**OPC, Strategic, RE, Instant Factory, Recipe Labs, Bridge Injector**).

## Mockup Visual UI Dashboard (`/content-flow`)

![Mockup UI ContentFlow Publishing Tracker Hub](/Users/sabeqmmursyid/.gemini/antigravity-ide/brain/9e0fb06d-382f-44d1-95cd-5ff88223ac82/content_flow_ui_mockup_1784946549975.png)

---

## 🎨 Spesifikasi Desain & Palet Warna (Selaras MAKNA Grid)

| Elemen UI | Nilai Kode Warna / Style | Fungsi & Aplikasi |
|---|---|---|
| **Background Utama** | `#0b0f19` (`--bg-primary`) | Latar belakang utama aplikasi MAKNA Grid |
| **Card / Panel Container** | `#121318` / `#0f172a` dengan border `#27272a` | Container kartu konten dan panel filter |
| **Badge Tag OPC** | Emerald Glow (`background: rgba(16, 185, 129, 0.15)`, `color: #10b981`, `border: 1px solid rgba(16, 185, 129, 0.3)`) | Label penanda kampanye Organic Pillar (OPC) |
| **Badge Tag Strategic (SC)** | Indigo Glow (`background: rgba(99, 102, 241, 0.15)`, `color: #818cf8`, `border: 1px solid rgba(99, 102, 241, 0.35)`) | Label penanda kampanye Strategic |
| **Badge Tag Reverse Eng (RE)** | Amber Glow (`background: rgba(245, 158, 11, 0.15)`, `color: #fbbf24`, `border: 1px solid rgba(245, 158, 11, 0.3)`) | Label penanda kampanye Reverse Engineering |
| **Badge Tag Instant Factory** | Pink Glow (`background: rgba(236, 72, 153, 0.15)`, `color: #f472b6`, `border: 1px solid rgba(236, 72, 153, 0.3)`) | Label penanda kampanye Instant Factory |
| **Badge Tag Recipe Labs** | Purple Glow (`background: rgba(139, 92, 246, 0.15)`, `color: #a78bfa`, `border: 1px solid rgba(139, 92, 246, 0.3)`) | Label penanda kampanye Recipe Labs |
| **Badge Tag Bridge Injector** | Cyan Glow (`background: rgba(6, 182, 212, 0.15)`, `color: #38bdf8`, `border: 1px solid rgba(6, 182, 212, 0.3)`) | Label penanda kampanye Bridge Injector |
| **Tombol Buka Google Drive** | Gradient Hijau (`linear-gradient(135deg, #059669 0%, #10b981 100%)`) | Tautan cepat akses folder/file Google Drive |
| **Tombol Buka Nextcloud** | Gradient Biru (`linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)`) | Tautan cepat akses folder/file Nextcloud |
| **Status Published** | Green Badge (`#064e3b` bg, `#34d399` text) | Penanda postingan sudah tayang di platform |
| **Status Scheduled** | Amber Badge (`#78350f` bg, `#fbbf24` text) | Penanda postingan dalam antrean jadwal |
| **Status Not Published** | Dark Neutral Badge (`#27272a` bg, `#9ca3af` text) | Penanda postingan belum dipublish |

---

## Proposed Changes

### [Database Schema & Helper Module]

#### [MODIFY] [db.js](file:///Users/sabeqmmursyid/_makna-grid/lib/db.js)
- Menambahkan pembuatan tabel SQLite baru `content_flow_items` untuk menyimpan indeks publishing terpadu:
  - Meta data item: `id`, `source_type`, `source_campaign_id`, `source_item_id`, `account_name`, `video_id`, `campaign_title`, `hook`, `nama_produk`, `link_affiliate`, `link_produk`, `caption`, `production_date`.
  - Asset Cloud links: `drive_link`, `nextcloud_url`.
  - Publishing trackers (TikTok, FB, IG, YT): `*_status`, `*_publish_date`, `permalink_*`.
- Menambahkan fungsi pembantu database: `upsertContentFlowItem()`, `getContentFlowItems()`, `updateContentFlowPublishStatus()`, `syncAllCompletedAssets()`.

#### [NEW] [contentflow-ingest.js](file:///Users/sabeqmmursyid/_makna-grid/lib/contentflow-ingest.js)
- Modul helper penyerapan aset terpusat: `ingestItemToContentFlow(sourceType, campaign, item)` untuk memetakan payload dari berbagai menu kampanye.
- Fungsi pembacaan retroaktif `scanAndSyncExistingCampaigns()` untuk memindai seluruh kampanye lama yang pernah dibuat dari OPC, SC, RE, Instant, Recipe, dan Bridge.

---

### [Backend API Endpoints]

#### [NEW] [app/api/content-flow/route.js](file:///Users/sabeqmmursyid/_makna-grid/app/api/content-flow/route.js)
- `GET`: Mengambil daftar konten terindeks di ContentFlow Hub dengan opsi pencarian dan filter (`source_type`, `account_name`, `platform_status`, `search`).

#### [NEW] [app/api/content-flow/[id]/route.js](file:///Users/sabeqmmursyid/_makna-grid/app/api/content-flow/[id]/route.js)
- `PATCH`: Meng-update status publish (`Not Published` / `Scheduled` / `Published`), tanggal publish, dan permalink URL secara interaktif (*auto-save*).

#### [NEW] [app/api/content-flow/sync/route.js](file:///Users/sabeqmmursyid/_makna-grid/app/api/content-flow/sync/route.js)
- `POST`: Menjalankan pemicu pemindaian retroaktif (*Manual Trigger Sync*) seluruh aset dari semua menu.

---

### [Frontend Dashboard & Navigation]

#### [NEW] [app/content-flow/page.js](file:///Users/sabeqmmursyid/_makna-grid/app/content-flow/page.js)
- Halaman UI utama **ContentFlow Hub**:
  - **Stat Counter Header**: Ringkasan total aset, total belum publish, terjadwal, dan published.
  - **Multi-Filter Bar**: Filter berdasarkan Menu Asal (`All`, `OPC`, `Strategic`, `RE`, `Instant`, `Recipe`, `Bridge`), Filter Akun, dan Bar Pencarian.
  - **Kartu Konten Interaktif**:
    - Tag Label Menu (Emerald `OPC`, Indigo `Strategic`, Amber `RE`, Pink `Instant`, Purple `Recipe`, Cyan `Bridge`).
    - Metadata utama: Video ID, Nama Kampanye, Nama Produk, Hook.
    - Tombol Quick Action: **📁 Buka Google Drive**, **☁️ Buka Nextcloud**, **📋 Copy Caption & Hashtags**, **🔗 Copy Link Affiliate**.
    - Matriks Penanda Status Tayang TikTok, FB Reels, IG Reels, YT Shorts dengan *auto-save*.

#### [MODIFY] [Sidebar.js](file:///Users/sabeqmmursyid/_makna-grid/app/components/Sidebar.js)
- Menambahkan item navigasi baru **"ContentFlow Hub"** dengan ikon `📊` mengarah ke rute `/content-flow`.

---

## Verification Plan

### Automated Verification
- Menjalankan `npm run build` untuk mengonfirmasi bahwa seluruh rute API, fungsi helper, dan komponen UI baru terbebas dari syntax error atau broken import.

### Manual Verification
1. **Pengujian Halaman ContentFlow Hub (`/content-flow`)**:
   - Buka menu baru **ContentFlow Hub** dari Sidebar.
   - Klik tombol **"🔄 Sync Seluruh Aset Kampanye"** dan verifikasi seluruh video yang pernah selesai dari menu OPC, SC, RE, Instant, Recipe, dan Bridge muncul dengan label menu yang tepat.
2. **Pengujian Tautan Cloud Asset**:
   - Uji klik tombol **📁 Buka Google Drive** / **☁️ Buka Nextcloud** untuk memastikan link mengarah langsung ke asset folder/file tanpa streaming lokal MP4.
3. **Pengujian Quick Copy**:
   - Uji klik **📋 Copy Caption** dan **🔗 Copy Link Affiliate**, lalu pastikan teks berhasil masuk ke clipboard.
4. **Pengujian Penanda Status Publishing**:
   - Ubah status tayang TikTok ke `Published`, isi tanggal & permalink URL.
   - Refresh halaman dan verifikasi data tersimpan secara persisten.
