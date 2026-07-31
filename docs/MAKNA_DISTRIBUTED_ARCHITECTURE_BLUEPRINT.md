# 🏛️ Architectural Blueprint: MAKNA Engine Distributed 3-Node Architecture (Production Deployment)

**Versi Dokumen**: 2.1  
**Tanggal**: 24 Juli 2026  
**Status**: Spesifikasi Konfigurasi Produksi 3-Node  
**Aplikasi Target**: MAKNA AI Video Content Generator  

---

## 📌 Ringkasan Topologi IP Produksi

Dokumen ini merinci alamat IP jaringan (*Tailscale / LAN Network*) yang dikonfigurasi untuk 3 node produksi MAKNA Engine:

| Node | Peran Server | OS & Perangkat | IP Address Produksi | Port Layanan |
| :--- | :--- | :--- | :--- | :--- |
| **Node 1 (Prod)** | **Server UI (Gateway Node)** | Ubuntu Desktop | `100.65.62.63` | `3000` (Web UI), `4000` (API) |
| **Node 1 (Staging)**| **Staging Gateway** | Ubuntu Desktop | `100.65.62.63` | `3010` (Web UI), `4010` (API) |
| **Node 2** | **Server Worker (Compute GPU Node)** | Windows PC | `100.117.59.92` | `3000` (Worker App), `8765` (G-Labs Local) |
| **Node 3 (Prod)** | **Server DB & Media Storage** | Linux Server | `100.78.186.123` | `3001` (ContentFlow API), `5432` (PostgreSQL - `public` schema) |
| **Node 3 (Staging)**| **Server DB Staging** | Linux Server | `100.78.186.123` | `5432` (PostgreSQL - `staging` schema) |

---

## 📐 Diagram Topologi Sistem (dengan IP Produksi)

```mermaid
graph TD
    subgraph STAF["👤 Antarmuka Pengguna / Staf"]
        Browser["🌐 Web Browser"]
    end

    subgraph NODE1["🖥️ NODE 1: Server UI (IP: 100.65.62.63)"]
        S1_App["🚀 MAKNA Web UI (Port 3000)"]
        S1_Gemini["🧠 Gemini AI Engine (Fase 1: Storyboard & VO)"]
        S1_Config["⚙️ env: NODE_ROLE=gateway<br/>ENABLE_SCHEDULER_WORKER=false"]
    end

    subgraph NODE2["💻 NODE 2: Server Worker GPU (IP: 100.117.59.92)"]
        S2_Worker["⚙️ Background Queue Worker Engine"]
        S2_GLabs["🤖 G-Labs Software (http://127.0.0.1:8765)"]
        S2_FFmpeg["🎞️ FFmpeg Muxing & Smart Sync Engine"]
        S2_Config["⚙️ env: NODE_ROLE=worker<br/>ENABLE_SCHEDULER_WORKER=true"]
    end

    subgraph NODE3["🗄️ NODE 3: Server DB & Storage (IP: 100.78.186.123)"]
        S3_DB[("📊 Central Database<br/>(PostgreSQL / makna.db)")]
        S3_Vault["☁️ Media Vault Storage (Nextcloud / NAS)"]
        S3_ContentFlow["🌐 ContentFlow Ingest Engine<br/>(http://100.78.186.123:3001/api/v1/content/ingest)"]
        S3_Sheets["📈 Google Sheets Sync Engine"]
    end

    Browser -->|HTTP: http://100.65.62.63:3000| S1_App
    S1_App -->|Calls Gemini API| S1_Gemini
    S1_Gemini -->|1. Simpan Storyboard Fase 1| S3_DB

    S2_Config -->|2. Poll Queue (100.78.186.123)| S3_DB
    S2_Config -->|3. Request T2I & I2V| S2_GLabs
    S2_Config -->|4. Muxing Video & Audio| S2_FFmpeg
    S2_FFmpeg -->|5. Upload Final Video & Clips| S3_Vault
    S3_Vault -->|6. Auto Ingest| S3_ContentFlow
    S3_Vault -->|7. Update 5 Kolom| S3_Sheets
```

---

## 🖥️ Spesifikasi Konfigurasi Per-Node

### 1. Node 1: Server UI (Ubuntu Desktop)
- **IP Address**: `100.65.62.63`
- **URL Akses Staf**: `http://100.65.62.63:3000`
- **Fungsi**:
  - Menyajikan antarmuka UI Next.js untuk staf input produk dan melihat preview storyboard.
  - Memanggil Gemini AI untuk Fase 1 (Storyboard, Naskah Voiceover, Social Package, 10 Parameter DNA).
  - Menyimpan data Fase 1 ke Central DB di Node 3 (`100.78.186.123`).
- **`.env` Konfigurasi**:
  ```env
  NODE_ENV=production
  NODE_ROLE=gateway
  ENABLE_SCHEDULER_WORKER=false
  PORT=3000
  DATABASE_URL=postgres://user:password@100.78.186.123:5432/maknadb
  ```

---

### 2. Node 2: Server Worker (Windows PC + GPU)
- **IP Address**: `100.117.59.92`
- **G-Labs Local Webhook**: `http://127.0.0.1:8765`
- **Fungsi**:
  - Membaca antrean dari Central Database di Node 3 (`100.78.186.123`).
  - Menjalankan G-Labs Webhook lokal (`http://127.0.0.1:8765`) untuk T2I Start Frame dan I2V Video Veo.
  - Memproses TTS Studio & **FFmpeg Smart Sync Engine**.
  - Mengirimkan (*upload*) video final dan vault klip adegan langsung ke Node 3 (`100.78.186.123`).
- **`.env` Konfigurasi**:
  ```env
  NODE_ENV=production
  NODE_ROLE=worker
  ENABLE_SCHEDULER_WORKER=true
  PORT=3000
  WEBHOOK_PORT=8765
  WEBHOOK_HOST=127.0.0.1
  DATABASE_URL=postgres://user:password@100.78.186.123:5432/maknadb
  STORAGE_SERVER_URL=http://100.78.186.123:8080
  ```

---

### 3. Node 3: Server DB & Media Storage
- **IP Address**: `100.78.186.123`
- **ContentFlow API Ingest**: `http://100.78.186.123:3001/api/v1/content/ingest`
- **Fungsi**:
  - Menjadi **Central Database Master** untuk Node 1 dan Node 2.
  - Menjadi **Vault Penyimpanan Berkas Media** (Video Master Final, Klip Video per Adegan, Gambar Start Frame PNG, Audio Voiceover MP3).
  - Menyediakan Public Link untuk Google Sheets 5-Kolom dan auto-ingestion ContentFlow API.
- **`.env` Konfigurasi**:
  ```env
  STORAGE_PROVIDER=nextcloud
  NEXTCLOUD_URL=http://100.78.186.123:8080
  CONTENT_FLOW_API_URL=http://100.78.186.123:3001/api/v1/content/ingest
  DATABASE_TYPE=postgresql
  ```

---

## 🔄 Alur Komunikasi Antar Node (End-to-End Workflow)

```mermaid
sequenceDiagram
    autonumber
    actor Staff as Staf / User
    participant N1 as Node 1: UI (100.65.62.63)
    participant N3_DB as Node 3: DB (100.78.186.123)
    participant N2 as Node 2: Worker (100.117.59.92)
    participant GLabs as G-Labs (Windows 127.0.0.1)
    participant N3_Vault as Node 3: Storage & ContentFlow

    Staff->>N1: 1. Akses http://100.65.62.63:3000 & Buat Kampanye
    N1->>N1: 2. Eksekusi Fase 1 (Gemini AI: Storyboard & VO)
    N1->>N3_DB: 3. Simpan Kampanye ke 100.78.186.123
    N1-->>Staff: 4. Tampilkan Grid Preview Storyboard

    Note over N2,N3_DB: Background Queue Polling
    N2->>N3_DB: 5. Polling Job ke 100.78.186.123
    N2->>GLabs: 6. Request T2I Start Frame (127.0.0.1:8765)
    GLabs-->>N2: 7. Start Frame PNG Terbuat
    N2->>GLabs: 8. Request I2V Video Veo (127.0.0.1:8765)
    GLabs-->>N2: 9. Video Klip MP4 Terbuat
    N2->>N2: 10. Muxing Video + TTS via FFmpeg Smart Sync
    N2->>N3_Vault: 11. Upload Video Final & Vault Clips ke 100.78.186.123
    N3_Vault->>N3_Vault: 12. Auto Ingest ke http://100.78.186.123:3001/api/v1/content/ingest
    N2->>N3_DB: 13. Update Status Item ke 'completed'
```

---

## 💡 Keuntungan Konfigurasi Alamat IP Ini

1. **Jalur Komunikasi Jelas & Terisolasi**:  
   Koneksi jaringan antar-server dilakukan secara langsung melintasi IP terdedikasi (`100.65.62.63`, `100.117.59.92`, `100.78.186.123`).
2. **Keandalan G-Labs Webhook**:  
   G-Labs pada Server Worker Windows (`100.117.59.92`) dipanggil secara internal via `127.0.0.1:8765`, terhindar 100% dari batasan *localhost binding*.
3. **Penyimpanan Terintegrasi dengan ContentFlow**:  
   Node 3 (`100.78.186.123`) sekaligus mengurusi Central DB, Vault Media, dan ContentFlow API Ingest (`:3001`).

---

## 🔬 Isolasi Lingkungan Staging & Skema Data
Untuk mendukung siklus pengujian yang andal tanpa risiko merusak data produksi:
1. **Isolasi Folder**: Server staging berjalan pada folder terpisah `/home/sabeqmursyid/makna-grid-staging` di Node 1.
2. **Isolasi Port**:
   - Web UI Staging: Port **3010**
   - Headless API Staging: Port **4010**
3. **Isolasi PostgreSQL (Schema-Based)**:
   - Staging dan Produksi menggunakan instance PostgreSQL Node 3 yang sama (`100.78.186.123`).
   - Isolasi data dilakukan di tingkat **Schema** PostgreSQL.
   - Tabel produksi berada di schema `public`, sedangkan tabel staging berada di schema `staging`.
   - Hal ini diatur via environment variable `PG_SEARCH_PATH=staging` di `.env.local` staging server.

---
*Dokumen ini diperbarui dengan spesifikasi topologi staging oleh MAKNA Assistant.*
