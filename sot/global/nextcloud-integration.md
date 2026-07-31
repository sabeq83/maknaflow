# **Master Blueprint Ekstensi: Integrasi Penyimpanan Nextcloud (WebDAV)**

## **1\. Visi & Tujuan**

Menambahkan dukungan **Nextcloud Local/Remote Server** sebagai alternatif dari Google Drive untuk penyimpanan aset video final (hasil G Labs) dan file dokumen (Markdown). Ini memberikan kontrol penuh atas privasi data dan menghilangkan limitasi kapasitas *cloud* publik.

## **2\. Pembaruan Skema Database (SQLite)**

Kita perlu menyimpan kredensial Nextcloud di pengaturan global aplikasi.

**Tabel app\_settings (Penambahan Kolom):**

* storage\_provider: ENUM ('gdrive', 'nextcloud') \-\> *Default: 'gdrive'*  
* nextcloud\_url: String (Contoh: https://nextcloud.domain.com atau http://192.168.1.100:8080)  
* nextcloud\_username: String  
* nextcloud\_app\_password: String (Sangat disarankan menggunakan *App Password* dari Nextcloud, bukan *password* akun utama demi keamanan).  
* nextcloud\_target\_folder: String (Contoh: /MAKNA\_Production\_Final/)

## **3\. Integrasi Sistem (Backend Utility)**

Sistem akan menggunakan *library* standar WebDAV di Node.js (seperti modul webdav dari npm) untuk membuat jembatan komunikasi.

**A. Modul Klien WebDAV (lib/nextcloud-client.js)**

Modul ini akan bertugas:

1. Mengautentikasi koneksi ke server Nextcloud menggunakan URL, Username, dan App Password.  
2. checkAndCreateFolder(folderPath): Mengecek apakah folder target kampanye sudah ada, jika belum, buat foldernya.  
3. uploadFile(localFilePath, targetNextcloudPath): Membaca file .mp4 lokal hasil G Labs menggunakan *Stream*, lalu mengunggahnya ke Nextcloud.  
4. getShareLink(targetNextcloudPath): (Opsional) Meminta tautan *Share* publik dari Nextcloud agar URL-nya bisa ditulis kembali ke Google Sheets.

## **4\. Modifikasi Alur Kerja G Labs (Workflow 2\)**

Di dalam antrean **G Labs Campaign Queue** (yang menangani *Phase 1: Polling Status*), kita menyuntikkan logika *Storage Switcher*.

**Logika Saat G Labs Selesai (status \== 'completed'):**

1. Backend mengunduh video .mp4 dari webhook G Labs ke folder sementara lokal (Temp).  
2. Backend membaca storage\_provider dari tabel app\_settings.  
3. **JIKA 'gdrive':** \-\> Jalankan fungsi lawas uploadToDriveBatch().  
4. **JIKA 'nextcloud':** \-\> Jalankan fungsi baru uploadToNextcloud().  
5. Ambil URL file dari penyedia penyimpanan yang dipilih, lalu tulis ke Google Sheets (kolom video\_url), dan ubah status baris menjadi Done.  
6. Hapus file .mp4 di folder sementara lokal untuk menghemat ruang.

## **5\. UI/UX Global Settings (Untuk Frontend)**

Di halaman **"Settings & Integrations"**, tambahkan kartu/menu baru khusus untuk Storage:

**\[ CLOUD STORAGE CONFIGURATION \]**

**Active Storage Provider:** ( ) Google Drive (•) Nextcloud Server

**\> Nextcloud Connection Setup:**

* Server URL: \[ http://192.168.10.50/nextcloud \]  
* Username: \[ admin\_makna \]  
* App Password: \[ \*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\* \] *(Generate from Nextcloud Security Settings)*  
* Default Target Folder: \[ /MAKNA\_Video\_Generations \]  
  \[ TEST CONNECTION \] *(Tombol untuk memvalidasi kredensial ke server)*

## **6\. Pesan Implementasi untuk AI Coder (Antigravity/Cursor)**

Instruksikan AI Anda dengan prompt berikut:

"Tambahkan dukungan integrasi **Nextcloud** menggunakan protokol WebDAV.

1. Install library webdav (npm install webdav).  
2. Update skema database SQLite app\_settings untuk menampung konfigurasi Nextcloud (nextcloud\_url, nextcloud\_username, nextcloud\_app\_password, storage\_provider).  
3. Buat helper/utilitas baru di lib/nextcloud-helper.js yang mengekspor fungsi uploadVideoToNextcloud(localFilePath, folderPath, fileName).  
4. Di dalam antrean pemroses G Labs (glabsCampaignQueue atau fungsi *Polling Phase 1*), buat logika percabangan (*conditional if/else*). Jika app\_settings.storage\_provider \=== 'nextcloud', arahkan proses *upload* ke fungsi helper Nextcloud yang baru dibuat, alih-alih menggunakan Google Drive API.  
5. Pastikan membuat UI di menu Settings agar pengguna bisa mengganti *provider* dan memasukkan kredensial Nextcloud mereka."