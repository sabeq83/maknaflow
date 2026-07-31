# **INTEGRATION BLUEPRINT: RECIPE LABS ASYMMETRIC GRID CANVAS (MAKNA V8.8)**

Dokumen ini mendefinisikan panduan arsitektural dan langkah-langkah teknis untuk mengintegrasikan fitur **Asymmetric Grid Canvas (3-6 Gambar)** ke dalam modul **Recipe Labs** (recipe-labs.md). Integrasi ini menggantikan kolase 2x2 statis tradisional menjadi sistem kolase dinamis, asimetris, dan dapat disunting oleh pengguna (Human-in-the-loop) sebelum diekspor ke Nextcloud.

## **1\. MODIFIKASI SKEMA DATABASE SQLITE (lib/db.js)**

Untuk menyimpan preferensi tata letak asimetris dan konfigurasi teks kustom pengguna per resep, kita harus menambahkan kolom baru pada tabel recipe\_items secara aman (retrocompatible).

\-- Query Migrasi Tambahan untuk Tabel recipe\_items  
ALTER TABLE recipe\_items ADD COLUMN selected\_layout\_id TEXT DEFAULT '4\_editorial\_split';  
ALTER TABLE recipe\_items ADD COLUMN grid\_gap\_size INTEGER DEFAULT 12;  
ALTER TABLE recipe\_items ADD COLUMN grid\_border\_radius INTEGER DEFAULT 16;  
ALTER TABLE recipe\_items ADD COLUMN grid\_outer\_padding INTEGER DEFAULT 16;  
ALTER TABLE recipe\_items ADD COLUMN grid\_bg\_color TEXT DEFAULT '\#0d0d12';

\-- Metadata Teks Overlay  
ALTER TABLE recipe\_items ADD COLUMN show\_overlay\_text INTEGER DEFAULT 1; \-- 0: No, 1: Yes  
ALTER TABLE recipe\_items ADD COLUMN overlay\_title TEXT;  
ALTER TABLE recipe\_items ADD COLUMN overlay\_subtitle TEXT;  
ALTER TABLE recipe\_items ADD COLUMN overlay\_text\_position TEXT DEFAULT 'bottom'; \-- top | center | bottom

## **2\. INTEGRASI UI FRONTEND: "RECIPE GRID STUDIO" (app/recipe-labs/\[id\]/page.js)**

Kita menanamkan komponen React AsymmetricGridCanvas sebagai panel interaktif (Editor Accordion) di dalam halaman **Detail Kampanye Resep**.

### **Alur Interaksi UI:**

1. Saat halaman detail resep dibuka, komponen akan membaca gambar hasil G-Labs (img\_1\_raw\_path, img\_2\_process\_path, dll) yang tersimpan di baris database sebagai gambar *default* slot.  
2. Pengguna dapat memilih jumlah slot (3-6) dan memilih preset asimetris (seperti *Pinterest Masonry* atau *Editorial Tri-Split*).  
3. Pengguna dapat melakukan **Drag & Drop** atau klik untuk menukar posisi gambar antar-slot secara langsung di browser.  
4. Setelah puas menyusun estetika, pengguna mengeklik **"Save & Sync Grid"**. Ini akan mengirimkan (POST) koordinat visual dan state terbaru ke API lokal untuk disimpan ke SQLite.

## **3\. MATRIKS KOORDINAT SINKRONISASI BACKEND (lib/core/GridCoordinates.js)**

Agar mesin *backend* (sharp) dapat mereproduksi hasil kolase asimetris yang persis sama dengan pratinjau kanvas HTML5 di browser, kita menyamakan matriks koordinat grid 12x12 pada resolusi tinggi 1080x1920 px.

Buat file registry koordinat baru: lib/core/GridCoordinates.js

export const GRID\_LAYOUT\_COORDINATES \= {  
  3: {  
    '3\_split\_left': \[  
      { id: 1, x: 0, y: 0, w: 6, h: 12 },  
      { id: 2, x: 6, y: 0, w: 6, h: 6 },  
      { id: 3, x: 6, y: 6, w: 6, h: 6 }  
    \],  
    '3\_stacked\_horizontal': \[  
      { id: 1, x: 0, y: 0, w: 12, h: 3 },  
      { id: 2, x: 0, y: 3, w: 12, h: 4 },  
      { id: 3, x: 0, y: 7, w: 12, h: 5 }  
    \]  
  },  
  4: {  
    '4\_editorial\_split': \[  
      { id: 1, x: 0, y: 0, w: 7, h: 8 },  
      { id: 2, x: 7, y: 0, w: 5, h: 4 },  
      { id: 3, x: 7, y: 4, w: 5, h: 4 },  
      { id: 4, x: 0, y: 8, w: 12, h: 4 }  
    \],  
    '4\_modern\_masonry': \[  
      { id: 1, x: 0, y: 0, w: 12, h: 5 },  
      { id: 2, x: 0, y: 5, w: 6, h: 4 },  
      { id: 3, x: 6, y: 5, w: 6, h: 7 },  
      { id: 4, x: 0, y: 9, w: 6, h: 3 }  
    \]  
  },  
  5: {  
    '5\_pentagon\_grid': \[  
      { id: 1, x: 0, y: 0, w: 6, h: 4 },  
      { id: 2, x: 6, y: 0, w: 6, h: 3 },  
      { id: 3, x: 0, y: 4, w: 7, h: 5 },  
      { id: 4, x: 7, y: 3, w: 5, h: 6 },  
      { id: 5, x: 0, y: 9, w: 12, h: 3 }  
    \]  
  },  
  6: {  
    '6\_magazine\_spread': \[  
      { id: 1, x: 0, y: 0, w: 4, h: 4 },  
      { id: 2, x: 4, y: 0, w: 8, h: 4 },  
      { id: 3, x: 0, y: 4, w: 8, h: 4 },  
      { id: 4, x: 8, y: 4, w: 4, h: 4 },  
      { id: 5, x: 0, y: 8, w: 6, h: 4 },  
      { id: 6, x: 6, y: 8, w: 6, h: 4 }  
    \]  
  }  
};

## **4\. PERBAIKAN ENGINE SHARP BACKEND (lib/campaign-scheduler.js)**

Kita merombak fungsi pembuat kolase statis di dalam skeduler resep untuk membaca matriks koordinat asimetris dinamis di atas menggunakan pustaka sharp.

### **Kode Baru Penggabungan Gambar Asimetris:**

import sharp from 'sharp';  
import { GRID\_LAYOUT\_COORDINATES } from './core/GridCoordinates';

/\*\*  
 \* Membuat Kolase Poster Asimetris Dinamis 1080p  
 \* @param {Object} itemRow \- Baris data dari tabel recipe\_items  
 \* @param {Array\<string\>} localImagePaths \- Array path fisik gambar mentah dari G-Labs  
 \* @param {string} outputPath \- Path output file hasil kolase (.jpg)  
 \*/  
export async function generateAsymmetricRecipeGrid(itemRow, localImagePaths, outputPath) {  
  const canvasW \= 1080;  
  const canvasH \= 1920;  
    
  const gap \= itemRow.grid\_gap\_size \* 2;  
  const radius \= itemRow.grid\_border\_radius \* 2;  
  const pad \= itemRow.grid\_outer\_padding \* 2;  
    
  const workingW \= canvasW \- (pad \* 2);  
  const workingH \= canvasH \- (pad \* 2);  
    
  const colW \= workingW / 12;  
  const rowH \= workingH / 12;

  // 1\. Ambil koordinat preset berdasarkan pilihan pengguna  
  const slots \= GRID\_LAYOUT\_COORDINATES\[localImagePaths.length\]\[itemRow.selected\_layout\_id\];  
    
  const compositionLayers \= \[\];

  // 2\. Loop dan potong (crop) setiap gambar secara asinkron untuk disesuaikan ke dalam slotnya  
  for (let i \= 0; i \< slots.length; i++) {  
    const slot \= slots\[i\];  
    const rawImgPath \= localImagePaths\[i\];

    const slotX \= Math.round(pad \+ (slot.x \* colW) \+ (gap / 2));  
    const slotY \= Math.round(pad \+ (slot.y \* rowH) \+ (gap / 2));  
    const slotW \= Math.round((slot.w \* colW) \- gap);  
    const slotH \= Math.round((slot.h \* rowH) \- gap);

    // Gunakan Sharp untuk melakukan resize & crop fit (cover) serta rounded corners  
    const processedBuffer \= await sharp(rawImgPath)  
      .resize(slotW, slotH, { fit: 'cover' })  
      .composite(\[{  
        input: Buffer.from(\`\<svg\>\<rect x="0" y="0" width="${slotW}" height="${slotH}" rx="${radius}" ry="${radius}"/\>\</svg\>\`),  
        blend: 'dest-in'  
      }\])  
      .toBuffer();

    compositionLayers.push({  
      input: processedBuffer,  
      top: slotY,  
      left: slotX  
    });  
  }

  // 3\. Gabungkan semua lapisan di atas kanvas background berwarna solid  
  await sharp({  
    create: {  
      width: canvasW,  
      height: canvasH,  
      channels: 4,  
      background: itemRow.grid\_bg\_color || '\#0d0d12'  
    }  
  })  
  .composite(compositionLayers)  
  .jpeg({ quality: 95 })  
  .toFile(outputPath);

  console.log(\`\[Sharp Engine\] Sukses merender kolase asimetris di: ${outputPath}\`);  
  return outputPath;  
}

## **5\. TINDAKAN MANDATORI AGENT (STEPS FOR ANTIGRAVITY AGENT)**

Sampaikan 4 instruksi terurut ini pada agen Antigravity Anda:

1. **Step 1:** Buka lib/db.js dan jalankan skrip migrasi SQL untuk menambahkan kolom-kolom baru pada tabel recipe\_items sesuai **Bagian 1**.  
2. **Step 2:** Buat file koordinat baru lib/core/GridCoordinates.js dan rekatkan seluruh objek koordinat dari **Bagian 3**.  
3. **Step 3:** Buka halaman detail Recipe Labs (app/recipe-labs/\[id\]/page.js) dan bungkus komponen AsymmetricGridCanvas (yang ada di berkas Canvas Anda saat ini) ke dalam komponen tersendiri untuk dirender di dalam halaman tersebut. Hubungkan tombol ekspornya agar melakukan fetch PUT untuk memperbarui pengaturan di SQLite.  
4. **Step 4:** Cari fungsi rendering kolase lama di dalam lib/campaign-scheduler.js (biasanya menggunakan fungsi composite kaku) dan ganti fungsinya dengan generateAsymmetricRecipeGrid dari **Bagian 4**.

**EOF (End of Blueprint Document)**