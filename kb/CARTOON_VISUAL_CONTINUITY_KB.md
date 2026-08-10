# CARTOON VISUAL CONTINUITY KNOWLEDGE BASE

## 1. Character Identity Lock
Setiap karakter harus memiliki konsistensi visual yang ketat di seluruh scene:
- **Species/Breed Consistency:** Spesies dan ras tidak boleh berubah.
- **Fur/Skin Color:** Warna bulu atau kulit harus persis sama di setiap pencahayaan yang wajar.
- **Pattern/Markings:** Pola, bintik, atau corak khas harus berada di lokasi yang sama pada tubuh.
- **Eye Color:** Warna mata tidak boleh berubah antar scene.
- **Signature Clothing/Accessories:** Pakaian atau aksesoris khas (seperti syal, tas, celemek) harus selalu dipakai kecuali diinstruksikan sebaliknya.
- **Body Proportions & Relative Sizes:** Proporsi tubuh karakter dan ukuran karakter satu dengan yang lain harus konsisten (misal: anjing Corgi lebih besar dari Hamster).

## 2. Product Geometry Lock
Produk yang diiklankan harus memiliki kontinuitas absolut:
- **Identical Geometry:** Bentuk 3D produk harus sama persis antar scene.
- **Consistent Colors/Materials:** Warna dan material/tekstur produk harus konsisten.
- **Same Components:** Jumlah tombol, selang, atau bagian-bagian produk tidak boleh bertambah atau berkurang secara acak.
- **Relative Size:** Ukuran produk relatif terhadap karakter harus dijaga (tidak tiba-tiba membesar atau mengecil).
- **Moving Parts:** Posisi bagian yang bergerak (seperti pintu atau tutup) harus masuk akal dan alami kelanjutannya dari scene sebelumnya.
- **Logos:** Logo mungkin sulit di-render konsisten dan dapat dihilangkan, tetapi bentuk dasar produk (shape) MUTLAK TIDAK BOLEH BERUBAH.

## 3. Negative Prompts for Cartoon Animation
Selalu gunakan aturan pengecualian berikut untuk menjaga kualitas animasi:
- NO character morphing (karakter meleleh atau berubah bentuk)
- NO extra limbs (anggota tubuh tambahan yang tidak wajar)
- NO wardrobe drift (pakaian berubah gaya/warna dengan sendirinya)
- NO style drift (gaya animasi berubah, misalnya dari 3D clay tiba-tiba menjadi 2D vector)
- NO human characters (TIDAK BOLEH ada manusia di semesta ini)
- NO human hands (TIDAK BOLEH ada tangan manusia yang tiba-tiba muncul)
- NO text overlay inside animated world (jangan paksa AI menulis teks panjang di dalam dunia animasi karena sering cacat)
- NO watermark/logos
- NO photorealistic rendering (tetap pada gaya kartun/animasi yang disepakati)

## 4. Camera Movement Rules for I2V (Image-to-Video)
Aturan pergerakan kamera untuk generator video:
- Gunakan pergerakan kamera yang mulus dan stabil (smooth stable movements).
- HINDARI zoom yang terlalu cepat, karena dapat menyebabkan distorsi pada karakter atau lingkungan.
- Pan (geser horizontal) dan Dolly (maju/mundur perlahan) lebih aman digunakan daripada zoom optik.
- Transisi antar scene menggunakan *cuts* (potongan langsung), BUKAN efek morphing yang merusak bentuk objek.
