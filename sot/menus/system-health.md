# **BLUEPRINT SISTEM: SYSTEM HEALTH & AUDIT LOGS DASHBOARD (MAKNA ENGINE V8.7)**

Cetak biru ini menjelaskan arsitektur subsistem pelaporan dan pelacakan kesalahan (Error Tracking) agar MAKNA Engine dapat secara proaktif melaporkan saat sebuah *Background Worker* atau integrasi eksternal (seperti Google API, Gemini, atau Scraper) mengalami kegagalan (*crash*).

## **1\. STRATEGI PELAPORAN KESALAHAN (ERROR LOGGING PARADIGM)**

Saat ini, MAKNA Engine menggunakan mekanisme *Auto-Retry* yang sangat tangguh: jika sebuah tugas gagal, ia dikembalikan ke pending. Kelemahan fatalnya adalah **keheningan (*silence*)**. Pengguna tidak tahu jika tugas tersebut berulang kali *failed \-\> pending* di latar belakang akibat token Google kadaluarsa (seperti kasus invalid\_grant).

Kita akan memodifikasi pola tersebut dengan **Event-Driven Audit Logger**:

Setiap kali *Worker* gagal mengeksekusi suatu tugas, sebelum ia melakukan *reset* atau *cooldown*, ia **wajib menulis deskripsi kegagalannya ke dalam sebuah tabel khusus (system\_audit\_logs)** yang bisa dilihat dari antarmuka pengguna.

## **2\. MODIFIKASI SKEMA DATABASE (lib/db.js)**

Kita membuat satu tabel baru khusus untuk menampung riwayat insiden sistem secara terpusat. Tabel ini memiliki mekanisme *auto-trimming* (hanya menyimpan 500 baris terakhir) agar tidak membebani memori SQLite.

erDiagram  
    system\_audit\_logs {  
        integer id PK AUTOINCREMENT  
        text severity\_level "INFO | WARNING | CRITICAL"  
        text module\_name "Contoh: re\_analyzer, google\_auth, glabs\_api"  
        text reference\_id "ID Kampanye/Item yang memicu error (opsional)"  
        text error\_message "Pesan error teknis asli"  
        text human\_resolution\_hint "Saran perbaikan bahasa manusia"  
        integer is\_resolved "0: Unread, 1: Resolved/Dismissed"  
        datetime created\_at  
    }

### **Script Inisialisasi Database:**

CREATE TABLE IF NOT EXISTS system\_audit\_logs (  
    id INTEGER PRIMARY KEY AUTOINCREMENT,  
    severity\_level TEXT DEFAULT 'WARNING',  
    module\_name TEXT NOT NULL,  
    reference\_id TEXT,  
    error\_message TEXT NOT NULL,  
    human\_resolution\_hint TEXT,  
    is\_resolved INTEGER DEFAULT 0,  
    created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP  
);

## **3\. GLOBAL ERROR HANDLER & LOG INJECTION (lib/error-logger.js)**

Kita membuat sebuah utilitas *helper* yang bertugas menelan (*catch*) error dari blok *try/catch* di berbagai modul, dan memformulasikannya menjadi bahasa yang mudah dipahami pengguna (*Human-Readable Hints*).

import db from './db';

/\*\*  
 \* Mencatat error ke dalam database audit dengan tambahan saran perbaikan otomatis  
 \* @param {string} module \- Nama pekerja yang crash (e.g., 're\_analyzer')  
 \* @param {Error} errorObj \- Objek Error Node.js asli  
 \* @param {string} refId \- ID Kampanye/Item jika ada  
 \*/  
export function logSystemError(module, errorObj, refId \= null) {  
  const errorStr \= errorObj.toString();  
  let severity \= 'WARNING';  
  let hint \= "Cek log terminal untuk detail teknis. Sistem akan mencoba (retry) kembali secara otomatis.";

  // \=== KAMUS SENSOR PEMECAHAN MASALAH OTOMATIS (SMART HINTS) \===

  // 1\. Google OAuth Issues (Kasus invalid\_grant)  
  if (errorStr.includes('invalid\_grant') || errorStr.includes('No refresh token')) {  
    severity \= 'CRITICAL';  
    hint \= "Google Authentication Anda kedaluwarsa. Silakan masuk ke menu 'Settings', lalu klik 'Disconnect' dan sambungkan ulang akun Google Drive Anda.";  
  }  
    
  // 2\. Shopee/Tokopedia Login Wall  
  else if (errorStr.includes('Sepertinya Anda belum masuk') || errorStr.includes('Login Wall')) {  
    severity \= 'CRITICAL';  
    hint \= "Playwright terdeteksi sebagai Bot oleh e-commerce. Ubah mode di lib/url-scraper.js menjadi 'headless: false' untuk sementara, lalu login manual akun Tokopedia/Shopee Anda.";  
  }

  // 3\. Gemini API Exhausted  
  else if (errorStr.includes('429') || errorStr.includes('Quota exceeded')) {  
    severity \= 'WARNING';  
    hint \= "Limit API Gemini tercapai. Scheduler secara otomatis mengalihkan (cooldown) dan merotasi kunci API cadangan Anda. Tidak perlu panik.";  
  }

  // 4\. FFmpeg Crashes  
  else if (errorStr.includes('ffmpeg') && errorStr.includes('No such file')) {  
    severity \= 'CRITICAL';  
    hint \= "Aset video mentah hasil AI belum selesai terunduh, tetapi FFmpeg sudah mencoba menggabungkannya. Berkas corrupt.";  
  }

  // Masukkan ke SQLite  
  try {  
    db.prepare(\`  
      INSERT INTO system\_audit\_logs (severity\_level, module\_name, reference\_id, error\_message, human\_resolution\_hint)  
      VALUES (?, ?, ?, ?, ?)  
    \`).run(severity, module, refId, errorStr, hint);

    // Auto-Trim: Hapus log lama jika lebih dari 500 baris untuk efisiensi penyimpanan  
    db.exec(\`  
      DELETE FROM system\_audit\_logs   
      WHERE id NOT IN (SELECT id FROM system\_audit\_logs ORDER BY id DESC LIMIT 500\)  
    \`);

  } catch (dbErr) {  
    console.error("Gagal menulis ke system\_audit\_logs:", dbErr);  
  }  
}

## **4\. INTEGRASI LOG LOGGER KE WORKER SCHEDULER**

Di setiap fungsi *worker* (seperti processReAnalyzer atau processAutonomousCampaigns), kita menyuntikkan logSystemError() ke dalam blok catch (error).

Contoh implementasi di lib/scheduler-processors.js:

import { logSystemError } from './error-logger'; // Import Helper Logger V8.7

export async function processReAnalyzer() {  
  const item \= db.prepare("SELECT \* FROM re\_campaign\_items WHERE analyze\_status \= 'pending' LIMIT 1").get();  
  if (\!item) return;

  try {  
    // ... proses dekonstruksi Gemini ...  
    // ... proses simpan JSON Google Sheets ...

    db.prepare("UPDATE re\_campaign\_items SET analyze\_status \= 'completed' WHERE id \= ?").run(item.id);  
  } catch (error) {  
    // TANDAI RETRY DAN CATAT ERROR KE DASHBOARD  
    db.prepare("UPDATE re\_campaign\_items SET analyze\_status \= 'failed', retry\_count \= retry\_count \+ 1 WHERE id \= ?").run(item.id);  
      
    // Injeksi Logger V8.7 yang baru kita buat\!  
    logSystemError('re\_analyzer worker', error, item.campaign\_id);  
      
    console.error(\`Gagal menganalisis video untuk item ${item.id}:\`, error.message);  
  }  
}

## **5\. RANCANGAN ANTARMUKA: SYSTEM HEALTH DASHBOARD (/system-health)**

Kita membuat menu halaman penuh yang berdedikasi tinggi untuk fungsi *Engineering* (Observabilitas) ini. Pengguna (Anda) dapat mengawasi pergerakan *error* seolah sedang melihat layar monitor pilot maskapai.

\<\!-- Skema Struktur JSX Halaman /system-health \--\>  
\<div class="health-dashboard-container"\>  
    
  \<div class="health-header"\>  
    \<h2\>🩺 System Health & Troubleshooting\</h2\>  
    \<div class="health-status-badge glowing-green"\>  
      \<span class="pulse-dot"\>\</span\> Core Scheduler: ACTIVE  
    \</div\>  
  \</div\>

  \<\!-- PANEL ATAS: Statistik & Quick Actions \--\>  
  \<div class="health-metrics-grid"\>  
    \<div class="metric-card"\>  
      \<span class="label"\>Google OAuth Token\</span\>  
      \<strong class="value text-danger"\>EXPIRED\</strong\>  
      \<a href="/settings" class="action-link"\>Perbarui Token →\</a\>  
    \</div\>  
    \<div class="metric-card"\>  
      \<span class="label"\>Gemini Key Pool\</span\>  
      \<strong class="value text-success"\>Healthy (3 Active)\</strong\>  
    \</div\>  
    \<div class="metric-card"\>  
      \<span class="label"\>Pending Queue Tasks\</span\>  
      \<strong class="value"\>24 Tasks\</strong\>  
    \</div\>  
  \</div\>

  \<\!-- PANEL BAWAH: Live Error Logs Table \--\>  
  \<div class="log-panel"\>  
    \<div class="panel-header"\>  
      \<h3\>Daftar Insiden Crash (Audit Logs)\</h3\>  
      \<button class="ghost-btn"\>Clear All Resolved\</button\>  
    \</div\>

    \<table class="makna-table"\>  
      \<thead\>  
        \<tr\>  
          \<th\>Level\</th\>  
          \<th\>Waktu Kejadian\</th\>  
          \<th\>Modul Sistem\</th\>  
          \<th\>Masalah Utama (Error Msg)\</th\>  
          \<th\>Saran Perbaikan (Human Hint)\</th\>  
          \<th\>Aksi\</th\>  
        \</tr\>  
      \</thead\>  
      \<tbody\>  
        \<\!-- Baris Log Kritis \--\>  
        \<tr class="log-critical"\>  
          \<td\>\<span class="badge badge-critical"\>CRITICAL\</span\>\</td\>  
          \<td\>11:45 AM (Hari Ini)\</td\>  
          \<td\>\<code\>re\_analyzer\</code\>\</td\>  
          \<td\>\<div class="error-msg-box"\>SqliteError: invalid\_grant\</div\>\</td\>  
          \<td\>\<strong\>Google Authentication Anda kedaluwarsa.\</strong\> Silakan masuk ke menu 'Settings', lalu klik 'Disconnect' dan sambungkan ulang akun.\</td\>  
          \<td\>\<button class="mark-resolved-btn"\>Tandai Selesai\</button\>\</td\>  
        \</tr\>

        \<\!-- Baris Log Peringatan \--\>  
        \<tr class="log-warning"\>  
          \<td\>\<span class="badge badge-warning"\>WARNING\</span\>\</td\>  
          \<td\>10:12 AM (Hari Ini)\</td\>  
          \<td\>\<code\>re\_scraper\</code\>\</td\>  
          \<td\>\<div class="error-msg-box"\>Playwright Timeout: 30000ms\</div\>\</td\>  
          \<td\>Sistem terlalu lambat membuka Tokopedia. Otomatis menjeda antrean dan melempar ke task selanjutnya.\</td\>  
          \<td\>\<button class="mark-resolved-btn"\>Tandai Selesai\</button\>\</td\>  
        \</tr\>  
      \</tbody\>  
    \</table\>  
  \</div\>

\</div\>

**EOF (End of Blueprint Document)**

*System Health & Audit Logs (V8.7) mentransformasikan "silent failure" menjadi notifikasi perbaikan yang cerdas dan transparan untuk operator.*