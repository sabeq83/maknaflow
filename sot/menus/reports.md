# **📊 Blueprint Modul Pelaporan (Reporting) & Campaign Tracker (MAKNA V5)**

## **1\. Visi & Tujuan**

Membangun antarmuka pemantauan (*Observability Dashboard*) dan sistem pencatatan (*Audit Trail*) untuk MAKNA Scheduler & Campaign Engine.

Tujuan utamanya adalah memberikan transparansi total kepada pengguna mengenai **Kesehatan Antrean (Queue Health)**, **Konsumsi Kuota API (Cost Tracking)**, **Pelacakan Kegagalan (Error Debugging)**, serta **Progres Kampanye Standalone (RE & GLabs)** tanpa perlu membuka log server (terminal) secara manual.

## **2\. Struktur Data Pelaporan (Sumber Data)**

Modul Reporting bertindak sebagai mesin agregasi (*Aggregation Engine*) yang menarik, menyaring, dan menghitung data dari tabel-tabel SQLite secara *real-time*:

1. scheduler\_jobs (Untuk status tugas, waktu proses, antrean reguler, dan log error).  
2. api\_key\_usages & gemini\_api\_keys (Untuk memantau sisa "bahan bakar" API Pool secara global).  
3. **\[BARU\]** re\_campaigns & re\_campaign\_items (Untuk melacak progres dan status unduh/analisis setiap proyek RE Standalone).  
4. **\[BARU\]** glabs\_campaigns (Untuk melacak progres batch pada kampanye G Labs).

## **3\. Desain Dashboard Utama (UI/UX Frontend)**

Dashboard Reporting akan dibagi menjadi 4 Zona Utama:

### **Zona A: Executive Summary (Kartu Metrik Harian)**

Metrik sekilas pandang yang di-reset setiap jam 00:00 WIB.

* **🔋 Global API Pool Health:** \[ 45 / 60 Calls Used \] (Total kapasitas dari semua API Key yang digabungkan).  
* **🎯 Global Job Success Rate:** \[ 96% \] (Dihitung dari: Total Completed / (Total Completed \+ Total Failed)).  
* **⏱️ Average Processing Time:** \[ 42 Detik / Job \] (Waktu rata-rata pengerjaan tugas oleh engine).

### **Zona B: Queue Live Monitor (Status Per-Hub)**

Menampilkan beban kerja aktual dari seluruh Hub (Reguler & Campaign) secara *real-time*:

| Nama Hub (Queue) | PENDING | RUNNING | COMPLETED | FAILED | Status |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **\[Reguler\] Scraper Hub** | 0 | 1 | 24 | 0 | 🟢 Aman |
| **\[Reguler\] Analyzer Hub** | 2 | 0 | 5 | 1 | 🟡 1 Retry |
| **\[Reguler\] Production Hub** | 5 | 0 | 12 | 0 | 🔵 Menunggu Waktu |
| **\[Campaign\] Scraper Queue** | 10 | 2 | 30 | 0 | 🟢 Aman |
| **\[Campaign\] Analyzer Queue** | 30 | 1 | 0 | 0 | 🟢 Berjalan |
| **\[Campaign\] GLabs Queue** | 12 | 0 | 8 | 0 | 🔵 Menunggu Waktu |

### **Zona C: Active Campaigns Tracker (Progres Proyek)**

*(Ini adalah tambahan khusus untuk fitur Standalone V5)*

Menampilkan kartu (*cards*) atau baris progres untuk kampanye yang sedang berjalan:

* **📦 Kampanye RE: "Riset Skincare Nov"**  
  * Status: Running  
  * Progres Scrape: \[██████████░░\] 8/10 Downloaded  
  * Progres Analyze: \[████░░░░░░░░\] 3/10 Analyzed  
  * *Estimasi Selesai: 40 Menit (Berdasarkan interval 10 menit/video)*  
* **🎬 Kampanye GLabs: "Batch Launching Produk"**  
  * Status: Active  
  * Progres Render: \[████████████\] Batch 5 Selesai  
  * Folder Target: \[Buka Drive ↗\]

### **Zona D: Detailed Audit Trail (Tabel Log Interaktif)**

Tabel detail untuk melakukan *debugging* jika ada tugas yang gagal. Tabel ini memiliki fitur *Filter* (berdasarkan Queue/Status/Tanggal) dan *Pagination*.

*Kolom Tabel:*

* **Job ID** (Klik untuk melihat Payload JSON).  
* **Queue** (Bisa filter antara antrean reguler atau antrean kampanye).  
* **Campaign Ref** (Nama kampanye jika job ini milik Workflow 1 atau 2).  
* **Status** (Completed / Failed / Pending).  
* **Attempts** (Berapa kali diulang, misal: 1/3 atau 3/3).  
* **Error Note** (Menampilkan ffmpeg failed, Gemini 429, dll).  
* **Timestamp** (completed\_at atau updated\_at).

## **4\. Sistem Peringatan Dini (Alerting System)**

Sistem akan memberikan notifikasi proaktif (Toast Notification):

1. **Warning (Kuning): "Key Exhaustion"** (API Key di *Pool* telah mencapai limit harian).  
2. **Critical (Merah): "Global Quota Empty"** (Seluruh Kuota API Pool habis, semua antrean di- *pause* hingga besok).  
3. **Success (Hijau): "Campaign Completed"**  
   * *Kondisi:* Seluruh item di re\_campaign\_items untuk suatu ID Kampanye telah berstatus analyzed.  
   * *Pesan UI:* "🎉 Kampanye RE \[Riset Skincare Nov\] telah selesai. File Markdown berhasil di-export ke Drive\!"

## **5\. Fitur Analitik Tambahan (SaaS Grade)**

### **A. Endpoint Pembersih Sampah (Auto-Cleanup / Retention Policy)**

* *Aturan:* Buat fungsi cron internal mingguan yang otomatis menghapus baris di tabel scheduler\_jobs yang umurnya **lebih dari 7 hari** DAN statusnya completed.  
* *Pengecualian:* Data di tabel re\_campaigns dan re\_campaign\_items TIDAK DIHAPUS otomatis agar *user* tetap bisa melihat riwayat proyek lama mereka.

### **B. Fitur "Re-Queue" Manual (Suntik Ulang)**

* *Aturan:* Pada "Detailed Audit Trail" (Zona D), sediakan tombol **"🔄 Retry Job"** untuk job berstatus failed. Tombol ini mereset attempts menjadi 0 dan status menjadi pending.

## **6\. Diagram Alir Komputasi Pelaporan (Mermaid)**

graph TD  
    subgraph "Database Aggregation (Backend)"  
        DB1\[(scheduler\_jobs)\] \--\>|COUNT by status| QStats\[Queue Statistics & Error Logs\]  
        DB2\[(api\_key\_usages)\] \--\>|SUM| APIPool\[API Pool Health\]  
        DB3\[(gemini\_api\_keys)\] \--\>|SUM| APIPool  
          
        DB4\[(re\_campaigns)\] \--\>|Monitor Status| CampTracker\[Campaign Tracker\]  
        DB5\[(re\_campaign\_items)\] \--\>|COUNT analyzed/downloaded| CampTracker  
        DB6\[(glabs\_campaigns)\] \--\>|Monitor Batch| CampTracker  
    end

    subgraph "Reporting Engine (API Route: /api/reports)"  
        QStats \--\> API\_Out{JSON Response}  
        APIPool \--\> API\_Out  
        CampTracker \--\> API\_Out  
    end

    subgraph "Frontend Dashboard (Client)"  
        API\_Out \--\> UI\_Cards\[Executive Cards\]  
        API\_Out \--\> UI\_Table\[Live Queue Table\]  
        API\_Out \--\> UI\_Campaigns\[Active Campaigns Progress\]  
          
        UI\_Table \-.-\>|Click Retry| Action\_Requeue\[Update Job Status to Pending\]  
        Action\_Requeue \-.-\> DB1  
    end

## **7\. Pesan Untuk AI Coder (Antigravity/Cursor)**

Instruksikan AI Anda:

"Bangun halaman UI Dashboard **Scheduler & Campaign Reports**.

Buat satu endpoint GET /api/scheduler/reports yang melakukan *query* agregasi SQLite yang efisien:

1. Gunakan GROUP BY queue\_name, status pada tabel scheduler\_jobs untuk mendanai tabel *Live Queue*. Pastikan queue baru (scraperCampaignQueue, analyzerCampaignQueue, glabsCampaignQueue) ikut terhitung.  
2. Lakukan *Join* pada tabel kampanye (re\_campaigns dan re\_campaign\_items) untuk menghitung persentase progres. Kirimkan data ini dalam array active\_campaigns di JSON response.  
3. Lakukan *Join* tabel api\_key\_usages dan gemini\_api\_keys untuk menghitung sisa persentase API Pool secara global hari ini.  
4. Implementasikan fungsi *Data Retention* (otomatis DELETE job reguler yang completed \> 7 hari).  
5. Tambahkan fungsi *action* agar user bisa me- *retry* spesifik Job ID yang gagal persisten dari tabel Audit Trail."