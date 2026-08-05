# 📘 Source of Truth (SOT): MAKNA Flow — Distributed 3-Node Architecture

**Dokumen**: Source of Truth (SOT)  
**Sistem Target**: MAKNA Flow (AI Video Content Generator Multi-Node Cluster)  
**Versi SOT**: 1.0  
**Tanggal Rilis**: 31 Juli 2026  
**Status**: Authoritative & Active  

---

## 📌 1. Filosofi & Pendahuluan Arsitektur MAKNA Flow

MAKNA Flow adalah arsitektur terdistribusi (*Decoupled 3-Node Architecture*) dari MAKNA Engine. Arsitektur ini dirancang untuk memisahkan 3 beban kerja utama aplikasi modern:

1. **Presentation Layer (Fase 1)**: Antarmuka Web UI dan pembentukan ide kreatif berbasis Google Gemini AI.
2. **Compute & Render Layer (Fase 2)**: Pemrosesan visual berbasis GPU, software G-Labs Webhook (`127.0.0.1:8765`), TTS Studio, dan FFmpeg Smart Sync.
3. **Data & Storage Layer**: Central Database Master (PostgreSQL `maknaflow_db`), Media Vault Storage, dan API Ingestion ke ContentFlow.

---

## 📐 2. Topologi Jaringan & Alamat IP Produksi (Staging & Dev)

| Node / Peran | OS / Hardware | IP Address | Port Layanan Utama | Path Repository |
| :--- | :--- | :--- | :--- | :--- |
| **Server UI & Worker (Staging)** | Ubuntu Desktop (NUC) | `100.65.62.63` | `:5010` (Web UI), `:7010` (API) | `/home/sabeqmursyid/maknaflow-staging` |
| **Server Database Terpusat** | Linux Storage Server | `100.78.186.123` | `:3001` (ContentFlow), `:5432` (PostgreSQL) | `/var/www/contentflow` |
| **Server Webhook G-Labs (Dedicated)** | Windows/Dedicated Host | `100.64.70.61` | `:8765` (G-Labs Webhook) | - |
| **Server Developer (Testing/Sandbox)**| Development Host | `100.118.178.93` | `:5000` (Web UI), `:6000` (API) | `/home/sabeqmursyid/maknaflow` |

---

## ⚙️ 3. Aturan Konfigurasi Role Server & Environment Variables

Setiap node di-klasifikasikan menggunakan variabel lingkungan `NODE_ROLE` dan `ENABLE_SCHEDULER_WORKER`:

```mermaid
graph TD
    subgraph STAGING_NODE ["🖥️ Node Staging (100.65.62.63)"]
        N1_Role["NODE_ROLE=gateway<br/>ENABLE_SCHEDULER_WORKER=true<br/>PORT=5010"]
    end

    subgraph DB_NODE ["🗄️ Node Database (100.78.186.123)"]
        N3_Role["NODE_ROLE=storage<br/>Central Database & Vault Storage"]
    end

    subgraph GLABS_NODE ["🤖 Node G-Labs Webhook (100.64.70.61)"]
        GLabs["G-Labs Service (Port 8765)"]
    end

    subgraph DEV_NODE ["💻 Node Developer (100.118.178.93)"]
        Dev_Role["NODE_ROLE=standalone<br/>ENABLE_SCHEDULER_WORKER=true"]
    end
```

### `.env.local` Server Staging (`100.65.62.63`):
```env
NODE_ENV=production
NODE_ROLE=gateway
ENABLE_SCHEDULER_WORKER=true
PORT=5010
DATABASE_HOST=100.78.186.123
PGDATABASE=maknaflow_db
PG_SEARCH_PATH=staging
WEBHOOK_HOST=100.64.70.61
WEBHOOK_PORT=8765
```

### `.env.local` Server Developer (`100.118.178.93`):
```env
NODE_ENV=development
NODE_ROLE=standalone
ENABLE_SCHEDULER_WORKER=true
PORT=5000
DATABASE_HOST=100.78.186.123
PGDATABASE=maknaflow_dev
WEBHOOK_HOST=100.64.70.61
WEBHOOK_PORT=8765
```

---

## 🔄 4. Alur Kerja Terdistribusi (End-to-End Workflow SOT)

```mermaid
sequenceDiagram
    autonumber
    actor Staff as Staf / User
    participant N1 as Node 1: UI Gateway (100.65.62.63)
    participant N3_DB as Node 3: Central DB (100.78.186.123)
    participant N2 as Node 2: Worker GPU (100.117.59.92)
    participant GLabs as G-Labs Webhook (Windows 127.0.0.1)
    participant N3_Storage as Node 3: Vault & ContentFlow DB

    Staff->>N1: 1. Akses UI WebApp & Input Produk
    N1->>N1: 2. Generate Fase 1 (Gemini AI: Storyboard, VO, Naskah, DNA)
    N1->>N3_DB: 3. Simpan Kampanye (status: 'approved')
    N1-->>Staff: 4. Tampilkan Preview Storyboard & Naskah

    Note over N2,N3_DB: Background Queue Worker Polling
    N2->>N3_DB: 5. Polling Queue Item Berstatus 'approved' / 'pending'
    N2->>GLabs: 6. Request T2I Start Frame (127.0.0.1:8765)
    GLabs-->>N2: 7. Start Frame PNG Terbuat
    N2->>GLabs: 8. Request I2V Video Veo (127.0.0.1:8765)
    GLabs-->>N2: 9. Video Klip MP4 Terbuat
    N2->>N2: 10. Muxing Video + TTS via FFmpeg Smart Sync
    N2->>N3_Storage: 11. Stream & Upload Vault Aset (Video Final, Clips, PNG, MP3)
    N3_Storage->>N3_DB: 12. Direct DB Upsert ke ContentFlow (Single-Database Sync) & Update Google Sheets
    N2->>N3_DB: 13. Update Status Item ke 'completed'
```

---

## 🛡️ 5. Isolasi & Keamanan Terhadap System Legacy (`maknagen`)

1. **Folder Repositori**:
   - Legacy: `_maknagen` (Mac) dan `D:\server\maknagen` (Windows).
   - MAKNA Flow: `_maknaflow` (Mac) dan `D:\server\maknaflow` (Windows).
2. **Database System**:
   - Legacy: `data/makna.db`.
   - MAKNA Flow: PostgreSQL `maknaflow_db`.
3. **Beban Kerja GPU**:
   - G-Labs Webhook (`http://127.0.0.1:8765`) bersifat stateless dan siap melayani permintaan baik dari `maknagen` maupun `maknaflow` tanpa perlu restart.

---

## 🩺 6. Skrip Perawatan & Health Check Cluster

Untuk menguji kesehatan seluruh node cluster MAKNA Flow secara real-time, jalankan perintah berikut pada terminal Node 1 atau Node 2:

```bash
node scripts/test-cluster-health.js
```

### Hasil Verifikasi Standar SOT:
- **Node 1 (Gateway)**: `Role: GATEWAY`, `Worker Polling: NO 🚫`.
- **Node 2 (Worker)**: `Role: WORKER`, `Worker Polling: YES ✅`, `G-Labs Webhook: RESPONDING`.
- **Node 3 (Storage/DB)**: `ContentFlow API: ONLINE (HTTP 405)`.

---
*Dokumen SOT ini adalah panduan resmi operasional dan arsitektur MAKNA Flow.*
