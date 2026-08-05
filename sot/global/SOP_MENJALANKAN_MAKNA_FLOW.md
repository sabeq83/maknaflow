# 📜 Standard Operating Procedure (SOP): Panduan Menjalankan MAKNA Flow (3-Node Cluster)

**Dokumen**: Standard Operating Procedure (SOP)  
**Sistem Target**: MAKNA Flow (AI Video Content Generator Multi-Node Cluster)  
**Versi SOP**: 1.0  
**Tanggal Rilis**: 31 Juli 2026  
**Status**: Authoritative & Active  

---

## 📌 1. Pendahuluan & Filosofi Operasional

MAKNA Flow menggunakan **Decoupled 3-Node Architecture** untuk memisahkan beban kerja antarmuka pengguna (UI/Gemini AI), pemrosesan GPU/Video Render, dan penyimpanan data terpusat (Database/Storage Vault).

Panduan ini mengatur tata cara standar untuk mengaktifkan, menguji, dan memelihara seluruh node cluster agar beroperasi secara harmonis dan bebas hambatan (*seamless execution*).

---

## 📐 2. Ringkasan Topologi Cluster & SSH Quick Access

| Node / Peran | Operating System | IP Address | Port Utama | SSH Command | Path Repository / DB |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Node UI/Prod** | Ubuntu Desktop (NUC) | `100.65.62.63` | `:5000` (Web UI), `:6000` (API) | `ssh makna-ui` | `/home/sabeqmursyid/maknaflow` (branch: `main`) |
| **Node Staging** | Ubuntu Desktop (NUC) | `100.65.62.63` | `:5010` (Web UI), `:7010` (API) | `ssh makna-ui` | `/home/sabeqmursyid/maknaflow-staging` (branch: `staging`) |
| **Node Webhook** | Windows / Dedicated | `100.64.70.61` | `:8765` (G-Labs Webhook) | - | - |
| **Node DB** | Linux Storage | `100.78.186.123` | `:3001` (ContentFlow), `:5432` (PostgreSQL) | `ssh makna-db` | `/var/www/contentflow` (DB: `public` & `staging` schemas) |
| **Node Developer**| Development Host | `100.118.178.93`| `:5000` (Web UI), `:6000` (API) | `ssh ...` | `/home/sabeqmursyid/maknaflow` |

---

## ⚙️ 3. Konfigurasi Variable Lingkungan (`.env.local`)

Sebelum startup, pastikan file `.env.local` pada masing-masing node telah sesuai dengan spesifikasi arsitektur:

### 🖥️ Node 1 (Ubuntu Gateway UI — `100.65.62.63`)
```env
NODE_ENV=production
NODE_ROLE=gateway
ENABLE_SCHEDULER_WORKER=false
PORT=3005
DATABASE_HOST=100.78.186.123
PGDATABASE=maknaflow_db
```
> **Catatan Port**: Untuk pengujian lokal di komputer development agar tidak bentrok dengan `maknagen` yang menggunakan Port `3000`, gunakan Port **`3005`** (`PORT=3005`). Node 1 **TIDAK** menjalankan Background Queue Worker (`ENABLE_SCHEDULER_WORKER=false`).

### 🖥️ Node 1 Staging (Ubuntu Staging UI — `100.65.62.63`)
```env
NODE_ENV=production
NODE_ROLE=gateway
ENABLE_SCHEDULER_WORKER=true
PORT=5010
DATABASE_HOST=100.78.186.123
PGDATABASE=maknaflow_db
PG_SEARCH_PATH=staging
CONTENT_FLOW_API_URL=http://100.78.186.123:3001/api/v1/content/ingest
WEBHOOK_HOST=100.64.70.61
WEBHOOK_PORT=8765
```
> **Catatan Port Staging**: Staging berjalan pada Port **`5010`** (Web UI) dan Port **`7010`** (API Server) dengan schema database PostgreSQL bernama **`staging`** yang terisolasi dari data produksi utama (`public` schema) pada database `maknaflow_db`.

### 💻 Node Webhook (G-Labs Dedicated — `100.64.70.61`)
```env
PORT=8765
# G-Labs visual compute services ( stateless API )
```
> **Catatan**: Node Webhook bertindak sebagai mesin komputasi GPU dedicated yang mengeksekusi T2I (Start Frame PNG) dan I2V (Video Veo MP4) secara langsung melayani request dari Staging maupun Dev.

---

## 🚀 4. Urutan Menjalankan Cluster (Startup Sequence)

Ikuti urutan startup berantai berikut untuk memastikan ketergantungan database dan GPU webhook siap sebelum menerima beban kerja:

### 🟢 Langkah 1: Aktivasi Node 3 (Storage & Central DB Master)
1. Sambungkan via SSH:
   ```bash
   ssh makna-db
   ```
2. Pastikan layanan PostgreSQL dan database Master terhubung pada port `:5432` dengan database `maknaflow_db`. Sinkronisasi ContentFlow berjalan secara otomatis via Single-Database Direct DB Sync (Satu Atap).

---

### 🟢 Langkah 2: Aktivasi Node 2 (Windows Worker GPU Compute)
1. Sambungkan via SSH ke Windows PC:
   ```bash
   ssh vibe-server -p 2222
   ```
2. **Pastikan Aplikasi G-Labs Webhook Aktif**:
   - Pastikan G-Labs local server telah berjalan di Windows pada `http://127.0.0.1:8765`.
3. **Inisialisasi Environment Worker**:
   - Jalankan skrip bootstrap atau persiapkan file `.env.local`:
     ```cmd
     scripts\setup-node2-worker.bat
     ```
4. **Jalankan Worker Service**:
   ```cmd
   cd D:\server\maknaflow
   npm run dev
   ```
5. Node 2 akan mulai melakukan polling ke Central DB (Node 3) untuk memproses queue item berstatus `approved` atau `pending`.

---

### 🟢 Langkah 3: Aktivasi Node 1 (Ubuntu UI Gateway)
1. Sambungkan via SSH ke NUC Gateway:
   ```bash
   ssh makna-ui
   ```
2. **Inisialisasi Environment Gateway**:
   ```bash
   bash scripts/setup-node1-gateway.sh
   ```
3. **Jalankan UI Gateway Service**:
   ```bash
   cd /home/sabeqmursyid/maknaflow
   npm run dev
   ```
4. Akses Web UI melalui browser di: `http://100.65.62.63:3000` (atau `http://localhost:3000` jika diakses secara lokal di Node 1).

---

## 🩺 5. Uji Kesehatan & Inspeksi Cluster Real-Time

Setiap kali cluster diaktifkan atau setelah pembaruan kode, **WAJIB** mengeksekusi skrip pengujian kesehatan cluster:

```bash
node scripts/test-cluster-health.js
```

### 📋 Checklist Verifikasi Standar (Clean Pass):
- [ ] **Node 1 (Gateway)**: `Role: GATEWAY` | `Worker Polling: NO 🚫`
- [ ] **Node 2 (Worker)**: `Role: WORKER` | `Worker Polling: YES ✅` | `G-Labs Webhook: RESPONDING`
- [ ] **Node 3 (Storage/DB)**: `Central DB: CONNECTED` | `ContentFlow API: ONLINE`

---

## 🛠️ 6. Troubleshooting & Isolasi Sistem Legacy

1. **G-Labs Webhook Tidak Merespon di Node 2**:
   - Pastikan software G-Labs berjalan di sesi UI Windows (`127.0.0.1:8765`).
   - Uji koneksi lokal G-Labs: `curl http://127.0.0.1:8765/health`.
2. **Isolasi Terhadap System Legacy (`maknagen`)**:
   - MAKNA Flow berjalan di folder terpisah (`_maknaflow` & `D:\server\maknaflow`).
   - Database MAKNA Flow terpisah (Central DB `maknaflow_db` di Node 3).
   - G-Labs Webhook (`127.0.0.1:8765`) bersifat stateless dan melayani `maknaflow` secara independen.

---

## 🔄 7. SOP Rilis Pasca-Perubahan Kode

Setelah menyelesaikan perbaikan atau penambahan fitur di `maknaflow` dan verifikasi `test-cluster-health.js` berhasil:
Jalankan rilis non-interaktif otomatis:

```bash
npm run release-non-interactive -- --type patch --title "Judul Perubahan" --points "Detail poin 1|Detail poin 2"
```

---

## 🌿 8. SOP Alur Kerja Git Staging & Deploy (Development Pipeline)

Untuk menjamin kualitas dan stabilitas sistem sebelum menyentuh server produksi, seluruh pengembang wajib mengikuti prosedur branching dan deployment pipeline berikut:

```
[Dev Lokal & Build Localhost] 
          │
          ▼
[Push ke cabang 'staging'] ──► [Deploy ke Server Staging] (Port 3010)
                                        │
                                        ▼
                                 [Uji di Staging]
                                        │
                          ┌──────────────┴──────────────┐
                     (Ada Bug)                     (Lolos Uji)
                          │                             │
                          ▼                             ▼
                   [Perbaikan Bug]            [Merge Staging ke Main]
                                                        │
                                                        ▼
                                              [Rilis Otomatis Versi]
                                            (Auto-Tag, Changelog, Git Push)
                                                        │
                                                        ▼
                                              [Deploy ke Produksi]
```

### 1. Pengembangan & Uji Coba Lokal
- Selesaikan pembuatan fitur atau perbaikan bug di server lokal (localhost).
- Jalankan perintah build lokal (`npm run build`) untuk memverifikasi tidak ada kesalahan sintaksis atau error kompilasi Next.js.

### 2. Push ke Cabang `staging` & Deploy Staging
- Kirim perubahan kode ke cabang `staging` di GitHub:
   ```bash
   git checkout staging
   git merge <nama-cabang-fitur>   # Atau lakukan commit langsung di staging
   git push origin staging
   ```
- Lakukan deployment ke server staging secara otomatis dari terminal Anda:
   ```bash
   npm run deploy:staging
   ```
- *Catatan*: Skrip ini akan melakukan SSH ke Node 1, memperbarui kode di folder `/home/sabeqmursyid/maknaflow-staging` (cabang `staging`), melakukan build, dan me-restart servis staging di Port `3010` (UI) & `4010` (API).

### 3. Validasi & Pengujian di Server Staging
- Uji fitur yang baru ditambahkan melalui browser di alamat: **`http://100.65.62.63:3010`**.
- Lakukan integrasi fungsional dan pastikan data tersimpan dengan benar di schema `staging` PostgreSQL Node 3.

### 4. Penggabungan ke `main` & Rilis Produksi
- Setelah tervalidasi di server staging, gabungkan kode ke cabang `main`:
   ```bash
   git checkout main
   git merge staging
   ```
- Jalankan perintah rilis otomatis untuk memperbarui versi rilis, memperbarui changelog, dan mengunggah git tag:
   ```bash
   npm run release-non-interactive -- --type patch --title "Judul Rilis" --points "Poin perubahan 1|Poin perubahan 2"
   ```
- Jalankan deployment ke server produksi utama:
   ```bash
   npm run deploy:node1  # Atau npm run deploy:cluster
   ```

---
*Dokumen ini merupakan SOP Resmi Operasional MAKNA Flow Multi-Node Cluster.*
