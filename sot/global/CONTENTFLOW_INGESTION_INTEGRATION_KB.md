# KNOWLEDGE BASE (KB): Content Flow Ingestion Architecture (Single-Database / Satu Atap)

> **Dokumen Panduan Integrasi Backend & Content Pipeline (MAKNA Flow v2.2+)**  
> **Arsitektur**: Single-Database Direct DB Sync (Satu Atap) & Optional Remote HTTP Ingest API  
> **Status**: Zero-Config Local DB Ingest Active  

---

## 🎯 1. Ringkasan & Tujuan Integrasi

Dokumen ini menjelaskan arsitektur ingest data dari seluruh modul kampanye MAKNA Flow (OPC, RE, Strategic, Instant Factory, Autopilot) ke **Content Flow**.

Dalam arsitektur **Satu Atap (Zero-Config Direct Sync)**:
- Data konten video/produk disinkronkan **secara langsung dan real-time ke database terpusat (`content_flow_items`)** tanpa perlu perantara API HTTP / `CONTENT_FLOW_API_URL` terpisah antar-node.
- Tim publisher dapat langsung mengelola, mengunduh aset, menyalin caption/link affiliate, dan memperbarui status tayang (TikTok, Facebook, Instagram) dari Web App **Content Flow**.
- Opsi HTTP REST Ingestion (`/api/v1/content/ingest` via `X-API-Key`) bersifat opsional jika ada aplikasi pihak ketiga (seperti n8n atau bot eksternal) yang ingin meng-ingest data dari luar cluster MAKNA Flow.

---

## 🗝️ 2. Otentikasi (API Key)

Setiap request ke Ingestion API **wajib menyertakan HTTP Header `X-API-Key`**.  
API Key ini dibuat dan dikelola melalui Dashboard Admin Content Flow di menu *Manajemen API Key Ingestion*.

```http
X-API-Key: cf_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
Content-Type: application/json
```

> ⚠️ **Penting**: Simpan API Key ini secara aman di Environment Variable (`CONTENTFLOW_API_KEY`) aplikasi backend Anda. Jangan pernah meng-hardcode key dalam repositori publik.

---

## 📡 3. Spesifikasi Endpoint Ingestion

### `POST /api/v1/content/ingest`

Endpoint ini menerima payload JSON tunggal (*single object*) maupun daftar (*array of objects*) untuk secara otomatis membuat data baru atau memperbarui data yang sudah ada (*upsert*) berdasarkan `video_id` dan `account_name`.

#### **URL Endpoint**:
```text
https://contentflow.ast402.my.id/api/v1/content/ingest
```

---

## 📋 4. Skema Data & Spesifikasi Parameter (JSON Payload)

| Parameter | Tipe Data | Wajib? | Deskripsi & Contoh |
|---|---|---|---|
| `account_name` | `string` | **WAJIB** | Nama akun / tab brand tujuan. Contoh: `"Skincare Official"`, `"nutribakeid"`. |
| `video_id` | `string` | **WAJIB** | ID Unik video konten. Contoh: `"VID-2026-010"`, `"VID-SKIN-005"`. |
| `hook` | `string` | Opsional | Teks Hook / Headline utama video. Contoh: `"Rahasia Kulit Glowing Tanpa Skincare Mahal"`. |
| `nama_produk` | `string` | Opsional | Nama produk yang dipromosikan. Contoh: `"Skintific Barrier Repair Serum"`. |
| `link_affiliate` | `string` | Opsional | URL Link Affiliate Shopee/TikTok/Tokopedia. Contoh: `"https://shopee.co.id/aff/skintific01"`. |
| `link_produk` | `string` | Opsional | URL landing page produk resmi. Contoh: `"https://skintific.id/product/serum"`. |
| `url_asset` | `string` | Opsional | URL unduh video asset (Google Drive / S3 / CDN). Contoh: `"https://assets.contentflow.id/videos/vid-2026-010.mp4"`. |
| `caption` | `string` | Opsional | Teks caption lengkap beserta hashtag. Contoh: `"Kalian wajib cobain serum ini! #skincare #glowing"`. |
| `pipeline_status` | `string` | Opsional | Status pipeline konten. Default: `"Completed"`. Pilihan: `"Completed"`, `"In Production"`. |
| `production_date` | `string` | Opsional | Tanggal selesai produksi format `YYYY-MM-DD`. Contoh: `"2026-07-23"`. |
| `tiktok_status` | `string` | Opsional | Status tayang awal di TikTok. Default: `"Not Published"`. Pilihan: `"Not Published"`, `"Scheduled"`, `"Published"`. |
| `tiktok_publish_date` | `string` | Opsional | Tanggal publish TikTok (`YYYY-MM-DD`). |
| `permalink_tiktok` | `string` | Opsional | Link URL postingan TikTok setelah published. |
| `facebook_status` | `string` | Opsional | Status tayang awal di Facebook. Default: `"Not Published"`. |
| `facebook_publish_date` | `string` | Opsional | Tanggal publish Facebook (`YYYY-MM-DD`). |
| `permalink_fb` | `string` | Opsional | Link URL postingan Facebook Reels. |
| `instagram_status` | `string` | Opsional | Status tayang awal di Instagram. Default: `"Not Published"`. |
| `instagram_publish_date` | `string` | Opsional | Tanggal publish Instagram (`YYYY-MM-DD`). |
| `permalink_ig` | `string` | Opsional | Link URL postingan Instagram Reels. |

---

## 💡 5. Contoh JSON Payload

### A. Pengiriman 1 Konten (Single Item Payload)

```json
{
  "account_name": "Skincare Official",
  "video_id": "VID-2026-088",
  "hook": "5 Rahasia Kulit Glowing Tanpa Skincare Mahal",
  "nama_produk": "Skintific Barrier Repair Serum",
  "link_affiliate": "https://shopee.co.id/aff/skintific088",
  "link_produk": "https://skintific.id/product/serum",
  "url_asset": "https://assets.contentflow.id/videos/vid-2026-088.mp4",
  "caption": "Cobain rutin serum ini setiap malam! Kulit jadi kenyal & glowing. #skincare #glowing #skintific",
  "pipeline_status": "Completed",
  "production_date": "2026-07-23"
}
```

### B. Pengiriman Banyak Konten Sekaligus (Batch Array Payload)

```json
[
  {
    "account_name": "nutribakeid",
    "video_id": "VID-NUTRI-101",
    "hook": "Resep Roti Tawar Gandum Super Lembut",
    "nama_produk": "Nutribake Whole Wheat Bread",
    "link_affiliate": "https://tokopedia.com/aff/nutri101",
    "url_asset": "https://assets.contentflow.id/videos/nutri101.mp4",
    "caption": "Sarapan sehat pakai roti gandum lembut! #rotigandum #nutribake",
    "pipeline_status": "Completed",
    "production_date": "2026-07-23"
  },
  {
    "account_name": "nutribakeid",
    "video_id": "VID-NUTRI-102",
    "hook": "Cemilan Oat Cookies Rendah Kalori",
    "nama_produk": "Nutribake Oat Cookies Premium",
    "link_affiliate": "https://shopee.co.id/aff/nutri102",
    "url_asset": "https://assets.contentflow.id/videos/nutri102.mp4",
    "caption": "Cemilan manis tanpa takut gemuk! #oatcookies #healthy",
    "pipeline_status": "Completed",
    "production_date": "2026-07-23"
  }
]
```

---

## 💻 6. Kode Contoh Integrasi Multi-Bahasa

### A. Python (`requests` / `httpx`)

```python
import os
import requests

API_KEY = os.getenv("CONTENTFLOW_API_KEY", "cf_live_YOUR_SECRET_KEY")
ENDPOINT = "https://contentflow.ast402.my.id/api/v1/content/ingest"

payload = {
    "account_name": "Skincare Official",
    "video_id": "VID-2026-099",
    "hook": "Review Honest Toner Centella Viral",
    "nama_produk": "Glad2Glow Centella Toner",
    "link_affiliate": "https://shopee.co.id/aff/g2g099",
    "url_asset": "https://assets.contentflow.id/videos/vid-2026-099.mp4",
    "caption": "Toner ini menenangkan kemerahan dalam semalam! #glad2glow #toner",
    "pipeline_status": "Completed",
    "production_date": "2026-07-23"
}

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

response = requests.post(ENDPOINT, json=payload, headers=headers)
print("Status Code:", response.status_code)
print("Response JSON:", response.json())
```

### B. Node.js / TypeScript (`axios` / `fetch`)

```typescript
import axios from 'axios';

const API_KEY = process.env.CONTENTFLOW_API_KEY || 'cf_live_YOUR_SECRET_KEY';
const ENDPOINT = 'https://contentflow.ast402.my.id/api/v1/content/ingest';

async function sendContentToContentFlow() {
  try {
    const response = await axios.post(
      ENDPOINT,
      {
        account_name: 'Skincare Official',
        video_id: 'VID-2026-100',
        hook: 'Sunscreen Ringan Tidak Lengket di Wajah',
        nama_produk: 'Anessa Perfect UV Sunscreen',
        link_affiliate: 'https://shopee.co.id/aff/anessa100',
        url_asset: 'https://assets.contentflow.id/videos/vid-2026-100.mp4',
        caption: 'Proteksi maksimal dari sinar UV! #sunscreen #anessa',
        pipeline_status: 'Completed',
        production_date: '2026-07-23'
      },
      {
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Ingest Success:', response.data);
  } catch (error) {
    console.error('Ingest Error:', error.response?.data || error.message);
  }
}

sendContentToContentFlow();
```

### C. cURL CLI Command

```bash
curl -X POST https://contentflow.ast402.my.id/api/v1/content/ingest \
  -H "X-API-Key: cf_live_YOUR_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "account_name": "Skincare Official",
    "video_id": "VID-CURL-001",
    "hook": "Uji Coba Kirim Data via cURL",
    "nama_produk": "Cetaphil Gentle Cleanser",
    "pipeline_status": "Completed",
    "production_date": "2026-07-23"
  }'
```

### D. Konfigurasi Node HTTP Request di n8n

- **Method**: `POST`
- **URL**: `https://contentflow.ast402.my.id/api/v1/content/ingest`
- **Authentication**: `Header Auth`
  - Name: `X-API-Key`
  - Value: `cf_live_YOUR_SECRET_KEY`
- **Send Body**: `JSON`
- **Specify Body**: `Using JSON`

---

## 🔄 7. HTTP Response Codes & Troubleshooting

| HTTP Code | Arti Status | Deskripsi & Tindakan |
|---|---|---|
| **`200 OK`** | Sukses | Data konten berhasil disimpan/di-update ke SQLite database Content Flow. |
| **`401 Unauthorized`** | Otentikasi Gagal | Header `X-API-Key` hilang, salah, atau telah dicabut oleh Admin. Periksa kembai API Key di Admin Panel. |
| **`400 Bad Request`** | Data Tidak Valid | Parameter wajib (`account_name` atau `video_id`) hilang atau format JSON rusak. |
| **`500 Internal Error`** | Server Error | Terjadi masalah internal pada server Content Flow. |

#### Sample Respon Sukses `200 OK`:
```json
{
  "status": "success",
  "message": "Berhasil meng-ingest 1 konten ke database SQLite Content Flow",
  "processed_count": 1
}
```

---

## 📌 8. Catatan Penting untuk Agent AI Backend

1. **Upsert Behavior**: Jika `video_id` pada `account_name` tersebut **sudah ada**, API akan otomatis **meng-update** field yang dikirimkan tanpa menghapus data lama yang tidak dikirim. Jika **belum ada**, API akan **membuat baris konten baru**.
2. **Order Output**: Content Flow Web App otomatis menampilkan konten terbaru (berdasarkan `production_date` terbaru dan `video_id` terbaru) di halaman pertama feed dashboard publisher.
