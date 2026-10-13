# Implementation Plan: Perbaikan Judul High CTR YouTube Shorts (opc_261012_lyg6eh & opc_261012_9ibcvk)

## Overview
Rencana perbaikan judul YouTube Shorts untuk 39 item konten pada 2 kampanye pilar:
1. **`opc_261012_9ibcvk`** (21 Item — Brand: **Ruang Akustik ID** / Solusi Akustik & Peredam Suara)
2. **`opc_261012_lyg6eh`** (18 Item — Brand: **Solusi Thermal ID** / Solusi Insulasi Atap & Termal)

### Akar Masalah Sebelumnya:
Pada injeksi sebelumnya, fungsi fallback memotong string hook secara statis pada 60 karakter (`base.slice(0, 60)...`), sehingga kalimat terputus di tengah jalan sebelum tag `#Shorts` (contoh: *"Bekerja di bawah atap tanpa insulasi sama seperti #Shorts"*).

### Standar Kualitas Judul Baru (High CTR YouTube Shorts):
1. **Panjang Karakter Optimal**: Berada di rentang 65–75 karakter (pasti di bawah batas maksimum 100 karakter), tidak akan terpotong pada tampilan mobile YouTube Shorts.
2. **Kalimat Utuh & Tuntas**: Tidak menggantung di tengah kata atau anak kalimat.
3. **Formula High CTR**: Menggunakan teknik *Curiosity Gap*, pertanyaan tajam, kata peringatan (*Fatal*, *Bahaya*, *Mitos Terbongkar*), angka konkret (*97%*, *2 Cm*), dan solusi langsung.
4. **Tag Resmi**: Diakhiri dengan `#Shorts`.
5. **Dua Schema DB Target**: Diperbarui serentak pada schema `staging` dan `dev` di tabel `pillar_campaign_items` dan `content_flow_items`.

---

## User Review Required

> [!IMPORTANT]
> Mohon tinjau tabel usulan 39 Judul High CTR di bawah ini sebelum eksekusi pembaruan database dilakukan.

### Daftar Perbandingan 39 Judul (Sebelum vs Sesudah Usulan)

#### Kampanye 1: `opc_261012_9ibcvk` (Ruang Akustik ID)
| ID | Judul Saat Ini (Sebelum / Terpotong) | Usulan Judul High CTR Baru (Sesudah) | Karakter |
|---|---|---|:---:|
| **1624** | Stop! Latar belakang VCmu hancurkan profesionalisme di mata klien? #Shorts | `Latar Belakang Zoom Menentukan Karirmu? Jangan Sepelekan! #Shorts` | 68 |
| **1625** | Bising ganggu kerja malam? Rockwool redam bocor suara sampai berapa dB? #Shorts | `Bising Luar Rusak Fokus Kerja? Bukti Rockwool Mampu Redam Suara! #Shorts` | 71 |
| **1626** | Gema hancurkan presentasi pentingmu? Rahasia suara jernih ada di sini! #Shorts | `Presentasi Hancur Karena Gema Ruangan? Atasi Dengan Cara Ini! #Shorts` | 69 |
| **1627** | Peredam Suara ≠ Akustik! Jangan Boros Renovasi Studio Sebelum Tahu! #Shorts | `Peredam Suara VS Akustik Ruang: Jangan Salah Beli Saat Renovasi! #Shorts` | 72 |
| **1628** | Apakah densitas material menentukan kemampuan penyerapan #Shorts | `Makin Padat Makin Kedap Suara? Mitos Densitas Peredam Terbongkar! #Shorts` | 72 |
| **1629** | Solusi tepat mengubah ruang pribadi menjadi area kerja yang #Shorts | `Kamar Berisik Bikin Stres? Ubah Jadi Ruang Kerja Super Hening! #Shorts` | 71 |
| **1630** | Tanpa perhitungan airgap yang benar, konstruksi dinding #Shorts | `Dinding Tebal Tapi Suara Bocor? Kesalahan Fatal Soal Airgap Ini! #Shorts` | 72 |
| **1631** | Ciptakan atmosfer studio podcast eksklusif yang memanjakan #Shorts | `Bikin Studio Podcast Mewah & Suara Bebas Gema: Ini Rahasianya! #Shorts` | 68 |
| **1632** | Pembuktian nyata penurunan desibel suara sebelum dan #Shorts | `Uji Kebisingan Nyata: Turun Berapa Desibel Pakai Insulasi Ini? #Shorts` | 70 |
| **1633** | Tingkat gema yang berlebih di tempat komersial dapat #Shorts | `Kafe Berisik Bikin Pelanggan Kabur? Solusi Kendalikan Gema Ruang! #Shorts` | 72 |
| **1634** | Mengapa menempelkan karpet tebal di dinding tidak cukup #Shorts | `Karpet Tebal Bisa Redam Suara? Jangan Percaya Mitos Sesat Ini! #Shorts` | 73 |
| **1635** | Mengatasi masalah gelombang frekuensi rendah yang membuat #Shorts | `Bass Menggema Bikin Pusing di Studio? Ini Trik Pasang Bass Trap! #Shorts` | 71 |
| **1636** | Menjaga artikulasi pesan tetap jernih dan mudah dipahami di #Shorts | `Suara Rapat Menggema Tak Jelas? Atasi Masalah Akustik Ruang Ini! #Shorts` | 69 |
| **1637** | Nikmati fasilitas hiburan pribadi di rumah tanpa khawatir #Shorts | `Home Theater Menggelegar Tanpa Ganggu Tetangga? Begini Caranya! #Shorts` | 70 |
| **1638** | Mengendalikan gema di area open-space office sekaligus #Shorts | `Kantor Open-Space Bising & Bergema? Redam Suara Tanpa Rusak Estetika #Shorts` | 70 |
| **1639** | Prosedur terukur dari survei lapangan hingga verifikasi #Shorts | `Bukan Tebak-Tebakan! Tahap Uji Akustik Presisi Standar Profesional #Shorts` | 72 |
| **1640** | Dinding sudah tebal namun suara tetap merambat? Kenali #Shorts | `Dinding Tebal Tapi Suara Tembus? Waspada Bocor Flanking Transmission #Shorts` | 73 |
| **1641** | Menghasilkan kualitas rekaman vokal yang jernih dan hangat #Shorts | `Rahasia Rekaman Vokal Jernih & Warm Tanpa Suara Ruang Mengganggu! #Shorts` | 70 |
| **1642** | Bedah perbedaan teknis Glasswool Board dan Rockwool Blanket #Shorts | `Glasswool VS Rockwool: Mana Yang Lebih Kuat Redam Suara & Panas? #Shorts` | 70 |
| **1643** | Memastikan setiap ucapan pembicara di aula atau tempat #Shorts | `Suara Khutbah & Pidato Menggema di Aula? Solusi Artikulasi Jernih! #Shorts` | 70 |
| **1644** | Celah pintu adalah titik terlemah kebocoran suara. Begini #Shorts | `Celah Pintu Bikin Suara Bocor? Cara Mudah Isolasi Pintu Studio! #Shorts` | 71 |

#### Kampanye 2: `opc_261012_lyg6eh` (Solusi Thermal ID)
| ID | Judul Saat Ini (Sebelum / Terpotong) | Usulan Judul High CTR Baru (Sesudah) | Karakter |
|---|---|---|:---:|
| **1651** | Material insulasi sebagus apa pun tidak akan bekerja #Shorts | `Insulasi Mahal Tapi Tetap Panas? Fatalnya Kawat Penopang Kendur! #Shorts` | 72 |
| **1652** | Makin tebal belum tentu makin dingin. Dalam standar green #Shorts | `Makin Tebal Makin Dingin? Jangan Salah Paham Soal Nilai R-Value! #Shorts` | 71 |
| **1653** | Jika kompresor AC gedung Anda terus bekerja tanpa henti, #Shorts | `AC Nyala Non-Stop Tapi Ruangan Gerah? Sumber Masalahnya di Atap! #Shorts` | 71 |
| **1654** | Di balik lembar spesifikasi tender, inilah perbedaan #Shorts | `Serat Mineral VS Polimer: Mana Penahan Panas Atap Terbaik? #Shorts` | 70 |
| **1655** | Bekerja di bawah atap tanpa insulasi sama seperti #Shorts | `Bekerja di Bawah Atap Panas Bagai Dalam Oven! Selamatkan Pabrikmu #Shorts` | 71 |
| **1656** | Area loading dock memang terbuka, namun radiasi atap seng #Shorts | `Panas Atap Seng Rusak Kargo Gudang? Lindungi Area Loading Dock! #Shorts` | 71 |
| **1657** | Lihat bagaimana lembaran penghalang termal ini menahan #Shorts | `Uji Lampu Halogen: Bukti Insulasi Termal Mampu Blokir Panas Ekstrem #Shorts` | 71 |
| **1658** | Celah selebar dua sentimeter pada sambungan insulasi sudah #Shorts | `Celah 2 Cm Bocor Bikin Gedung Gerah! Bahaya Sambungan Insulasi Bolong #Shorts` | 70 |
| **1659** | Insulasi atap berisiko memicu korosi pada gording baja? #Shorts | `Insulasi Atap Bikin Rangka Baja Berkarat? Hati-Hati Kondensasi! #Shorts` | 71 |
| **1660** | Langit-langit bangunan yang tinggi tidak otomatis membuat #Shorts | `Plafon Tinggi Tapi Tetap Gerah? Terjebak Kantung Panas di Atap! #Shorts` | 70 |
| **1661** | Satu material untuk dua masalah industri: menekan gelombang #Shorts | `1 Solusi Untuk 2 Masalah: Redam Bising Hujan Sekaligus Blokir Panas! #Shorts` | 71 |
| **1662** | Bingung memilih polimer foil atau serat komposit? Kunci #Shorts | `Polimer Foil VS Serat Komposit: Jangan Terkecoh Emisivitas Panas! #Shorts` | 70 |
| **1663** | Suhu ruang di atas 30 derajat akibat radiasi seng terbukti #Shorts | `Suhu Pabrik Di Atas 30°C? Produktivitas Karyawan Anjlok Akibat Panas! #Shorts` | 72 |
| **1664** | Data-logger digital ini mencatat grafik penurunan #Shorts | `Bukti Uji Termal: Suhu Atap Turun Drastis Pakai Insulasi Aluminium! #Shorts` | 71 |
| **1665** | Rahasia daya tahan insulasi bentang luas hingga #Shorts | `Rahasia Insulasi Atap Awet Puluhan Tahun: Kuncinya Ada di Kawat Ini! #Shorts` | 72 |
| **1666** | Khawatir serat insulasi rontok seiring usia gedung? Mari #Shorts | `Takut Serat Insulasi Rontok & Berdebu? Lihat Uji Tarik Sampel Ini! #Shorts` | 71 |
| **1667** | Bunyi denting pemuaian rangka atap adalah sinyal fisik #Shorts | `Atap Pabrik Berbunyi Denting? Tanda Bahaya Rangka Memuai Karena Panas! #Shorts` | 73 |
| **1668** | Sama-sama tampak berkilau, namun lapisan aluminium murni #Shorts | `Sama-Sama Mengkilap, Tapi Aluminium Murni Pantulkan 97% Radiasi Panas! #Shorts` | 72 |

---

## Execution Task List
- [ ] Task 1: Perbarui skrip [`scripts/inject-opc-youtube-titles.js`](file:///Users/sabeqmmursyid/_contentflow-staging/scripts/inject-opc-youtube-titles.js) dengan mapping 39 judul High CTR kurasi dan parameter `--schema staging,dev`.
- [ ] Task 2: Jalankan skrip injeksi dengan flag `--apply` ke schema `staging` dan `dev`.
- [ ] Task 3: Verifikasi data di database PostgreSQL (memastikan seluruh 39 item di `pillar_campaign_items` dan `content_flow_items` telah berganti dengan judul baru yang utuh).
- [ ] Task 4: Uji build lokal (`npm run build`) untuk verifikasi integritas sistem.
- [ ] Task 5: Rilis patch non-interaktif (`npm run release-non-interactive`).
- [ ] Task 6: Deploy atomic ke Server Dev Mac Mini (`npm run deploy:dev:atomic -- --ref <full-git-sha> --apply --confirm-dev`) dan verifikasi.
- [ ] Task 7: Deploy atomic ke Server Staging Mac Mini (`npm run deploy:staging -- --ref <full-git-sha> --apply --confirm-staging`) dan verifikasi.
