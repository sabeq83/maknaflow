# Panduan Product Bridging & Template CSV OPC Mass

Panduan ini menjelaskan format dan tata cara pengisian berkas matriks konten (.csv atau .xlsx) untuk kampanye massal **Organic Pillar Campaign (OPC Mass)**. 

Format kolom dan nama header pada panduan ini telah **diselaraskan sepenuhnya dengan Sheets Autopilot** agar Anda dapat memindahkan berkas secara kompatibel tanpa mengubah header kolom.

---

## 📋 Struktur Kolom Wajib (4 Kolom Utama)

Berkas CSV/Excel Anda wajib memiliki 4 kolom header dengan nama persis seperti di bawah ini:

1.  **`Pilar Konten`**
    *   **Deskripsi**: Tema, topik, atau pilar edukasi video yang akan dibahas (misal: *Edukasi Kulit Kering*, *Review Skincare*).
2.  **`Hook`**
    *   **Deskripsi**: Kalimat pembuka video (3 detik pertama) yang menarik perhatian penonton.
3.  **`Visual Action`**
    *   **Deskripsi**: Panduan/deskripsi visual pergerakan kamera untuk adegan pembuka video (misal: *Close-up wajah lesu*, *Panned tracking ke arah produk*).
4.  **`link_product`**
    *   **Deskripsi**: Tautan/URL produk e-commerce (misalnya Shopee, Tokopedia, dll.). URL ini akan dibaca oleh skeduler otomatis untuk memicu **JIT (Just-In-Time) Sourcing**.

---

## ⚡ Cara Kerja JIT (Just-In-Time) Sourcing & Caching

Dengan mengisi kolom **`link_product`**:
1.  **Scraping Otomatis**: Skeduler backend (`pillar_sourcing`) akan secara otomatis mengunduh halaman produk, mengekstrak detail produk (Nama, Deskripsi, USP) menggunakan Gemini AI, dan mengunduh foto produk.
2.  **Pencarian Cache Database**: Sebelum melakukan scrape baru, sistem akan memeriksa database `product_extractions`. Jika URL produk tersebut sudah pernah di-scrape sebelumnya (oleh adegan lain atau kampanye lain), sistem akan **langsung menggunakan data cache lama**. Ini menghemat waktu eksekusi dan menghemat kuota token API Anda.

---

## 💾 Contoh Isi Berkas CSV
Anda dapat mengunduh berkas template di workspace Anda pada:
*   [opc_mass_template.csv](file:///Users/sabeqmmursyid/_maknagen/templates/opc_mass_template.csv)

```csv
Pilar Konten,Hook,Visual Action,link_product
Edukasi Kulit Kering,"Mengapa kulit Anda tetap kering meskipun sudah memakai pelembap?","Visual close-up kulit kering dan kusam","https://shopee.co.id/skintific-barrier-moisturizer"
Review Skincare,"Tiga kesalahan menggunakan pelembap malam yang merusak skin barrier.","Visual wanita memakai krim malam di cermin","https://shopee.co.id/skintific-barrier-moisturizer"
```
