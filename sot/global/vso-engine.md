# **BLUEPRINT SISTEM: VISUAL SWAP OVERRIDE ENGINE & FACELIFT CONTROLLER (MAKNA V8.4.1)**

Cetak biru ini menjelaskan implementasi fitur **Visual Swap Override (VSO)** pada MAKNA Engine V8.4.1. Versi pembaruan ini menyempurnakan kegunaan antarmuka dengan memperkenalkan **Preloaded Preset Selection (7 Kurasi Estetika Utama)** untuk meminimalkan input mengetik manual (*Zero-Thought UX*), sekaligus mempertahankan fleksibilitas kustomisasi melalui opsi *Override Manual*.

## **1\. STRATEGI ALUR KERJA DENGAN PRESET MATRIX**

Pipa pemrosesan visual bekerja dengan memetakan ID preset pilihan pengguna dari antarmuka ke dalam pustaka deskripsi visual instan (*In-Memory Prompt Library*) sebelum dikirimkan ke mesin G Labs:

  \[User Pilih Dropdown Preset di UI\]  
  (Misal: Dapur Skandinavian \+ Gamis Emerald Green)  
                         │  
                         ▼  
           \[In-Memory Preset Mapper\]  
   Mengonversi ID preset menjadi deskripsi visual   
   resolusi tinggi (Berdasarkan Gaya Auteur & Style Guide)  
                         │  
                         ▼  
             \[re\_analyzer worker V8.4.1\]  
   Suntikkan deskripsi visual instan ke prompt Gemini.  
   Gemini secara otonom menyusun Storyboard baru.

## **2\. SPESIFIKASI 7 PILIHAN PRESET YANG DIKURASI (THE SEVEN-CHOICE MATRIX)**

Sistem MAKNA menyediakan 7 opsi pramuat (*preloaded*) siap pakai untuk setiap kategori field kondisional:

### **A. Preset Warna & Gaya Pakaian (Wardrobe Style)**

**Pilihan Wardrobe Wanita (Wanita Gamis Syar'iy):**
1. `amber_terracotta` : Busana nuansa Amber Haze & Terracotta, memberikan kesan hangat dan berkelas.
2. `mocca_caramel`    : Perpaduan warna Mocca, Taupe, dan Caramel Latte yang netral dan elegan.
3. `warm_grey`        : Warna abu-abu hangat kontemporer.
4. `sage_muted`       : Warna hijau sage lembut yang estetik.
5. `lavender_lilac`   : Warna Lavender Soft & Soft Lilac yang feminin.
6. `butter_yellow`    : Warna Butter Yellow segar yang anggun dan cerah.
7. `teal_navy`        : Warna Teal & Navy Blue yang kontras dan kokoh.
8. `olive_modern`     : Warna hijau zaitun modern dan membumi.
9. `mahogany_maroon`  : Warna merah marun pekat premium.
10. `cloud_dancer`    : Warna Cloud Dancer (Off-White premium).

**Pilihan Wardrobe Pria (Pria Kaukasia):**
1. `male_casual_flannel` : Kemeja flanel motif kotak-kotak kasual dengan lengan digulung, memperlihatkan lengan dan tangan pria yang rapi.
2. `male_smart_oxford`    : Kemeja katun Oxford lengan panjang semi-formal dengan lengan digulung rapi.
3. `male_formal_suit`     : Lengan jas wol charcoal gelap formal dengan manset kemeja putih bersih di ujungnya.
4. `male_cozy_knit`       : Sweater rajut tebal bertekstur lembut dengan cuff lengan rajut yang hangat.

**Pilihan Wardrobe Wanita 3D Stylized (Muslimah Clay Art):**
1. `3d_fem_emerald`     : Abaya hijau emerald yang anggun dengan tekstur clay 3D yang halus.
2. `3d_fem_pastel_pink` : Abaya warna pink pastel lembut dengan tekstur clay 3D yang halus.
3. `3d_fem_jetblack`    : Abaya hitam legam elegan dengan tekstur clay 3D yang halus.
4. `3d_fem_mocca`       : Abaya warna mocca-caramel dengan tekstur clay 3D yang halus.

**Pilihan Wardrobe Pria 3D Stylized (Pria Clay Art):**
1. `3d_male_tan_knit`          : Sweater rajut tebal warna cokelat tan hangat dengan tekstur clay 3D yang halus.
2. `3d_male_sage_jacket`        : Jaket kasual hijau sage teduh dengan tekstur clay 3D yang halus.
3. `3d_male_charcoal_tshirt`    : Kaos t-shirt katun charcoal abu-abu gelap dengan tekstur clay 3D yang halus.
4. `3d_male_terracotta_flannel` : Kemeja flanel warna terracotta orange dengan tekstur clay 3D yang halus.

**Pilihan Tema Harmoni Duo 3D (2 Karakter Terkoordinasi):**
1. `3d_duo_earth`      : Tema 1 - Earthy Warmth (Tan Sweater Pria & Cream Abaya Wanita).
2. `3d_duo_contrast`   : Tema 2 - Urban Contrast (Terracotta Jacket Pria & Sage Abaya Wanita).
3. `3d_duo_monochrome` : Tema 3 - Minimalist Monochrome (Off-White T-shirt Pria & Black Abaya Wanita).
4. `3d_duo_pastel`     : Tema 4 - Soft Pastel Harmony (Mint Polo Pria & Lilac Abaya Wanita).
5. `3d_duo_cool`       : Tema 5 - Professional Cool Tones (Grey Flannel Pria & Teal Abaya Wanita).

---

### **B. Preset Desain Latar/Tempat (Environment Setting)**

1. nordic\_kitchen : Dapur modern minimalis bergaya Nordik/Skandinavian, marmer putih, kabinet kayu terang.  
2. cozy\_bedroom : Kamar tidur estetik hangat, sprei linen krem, tanaman hias hijau kecil, jendela kayu.  
3. vanity\_clutter : Meja rias estetik (cluttered vanity), tumpukan skincare mewah, cermin bulat menyala.  
4. urban\_cafe : Interior kafe urban bergaya industrial, dinding bata ekspos, meja kayu rustik gelap.  
5. warm\_livingroom: Ruang tamu keluarga yang hangat, sofa beludru abu-abu, karpet rajut, lampu hangat.  
6. sterile\_lab : Laboratorium modern steril, permukaan stainless steel, botol kaca lab, pencahayaan putih bersih.  
7. aesthetic\_void : Latar belakang "The Void" (Aesthetic Studio Studio), transisi gradasi warna pastel lembut tanpa batas.  
8. custom : *Input Teks Manual Kustom*

### **C. Preset Demografi Subjek (Subject Demographic)**

1. `syari_classic`          : Wanita Muslimah anggun, pembawaan tenang, dengan fokus framing strictly faceless (potong siku ke bawah, fokus 100% pada gerakan tangan).
2. `caucasian_male`          : Pria Kaukasia dengan fokus framing strictly faceless (potong siku ke bawah, fokus 100% pada gerakan tangan).
3. `stylized_3d_muslimah`   : Karakter kartun 3D Muslimah berwajah polos tanpa mata/hidung/mulut, memakai abaya & khimar longgar, gaya render clay halus.
4. `stylized_3d_male`       : Karakter kartun 3D Pria berwajah polos tanpa mata/hidung/mulut, dengan rambut pendek rapi, memakai pakaian kasual umum, gaya render clay halus.
5. `stylized_3d_duo`        : Dua karakter kartun 3D (Muslimah & Pria) berwajah polos dalam satu scene untuk mendukung cerita terintegrasi.
6. `custom`                 : *Input Teks Manual Kustom*

### **D. Preset Pencahayaan & Atmosfer (Lighting Style)**

1. window\_daylight: Soft natural daylight, cahaya matahari lembut dari jendela samping.  
2. golden\_hour : Golden hour warm sunset light, cahaya sore keemasan yang dramatis.  
3. moody\_shadow : Moody cinematic chiaroscuro, bayangan dramatis dengan fokus kontras tinggi.  
4. studio\_softbox : Clean professional studio softbox lighting, tanpa bayangan kasar, sangat bersih.  
5. lab\_cold : Cold white clinical lighting, pencahayaan laboratorium yang terang dan steril.  
6. cyber\_neon : Cyberpunk neon ambient, bias warna biru dan pink magenta dari sudut lampu neon.  
7. candle\_warm : Warm cozy candlelight, bias cahaya lilin yang hangat, syahdu, dan menenangkan.  
8. custom : *Input Teks Manual Kustom*

## **3\. MODIFIKASI SKEMA DATABASE SQLITE (lib/db.js)**

Untuk mendukung penyimpanan preset maupun teks kustom secara polimorfik, data JSON yang disimpan pada kolom visual\_overrides\_json di tabel re\_campaigns dikonfigurasi sebagai berikut:

{  
  "character\_concept": "faceless",  
  "subject\_demographic": "syari\_classic",  
  "subject\_demographic\_custom": "",  
  "wardrobe\_style": "emerald\_syari",  
  "wardrobe\_style\_custom": "",  
  "environment\_setting": "nordic\_kitchen",  
  "environment\_setting\_custom": "",  
  "lighting\_style": "window\_daylight",  
  "lighting\_style\_custom": ""  
}

## **4\. PEMBARUAN PROMPT SUNTIKAN KOGNITIF & PRESET MAPPER (lib/prompts.js)**

// Kamus Preset Visual Global MAKNA V9.3.0
const WARDROBE_PRESETS = {
  amber_terracotta: "wearing a modest loose-fitting gamis dress with long flowing sleeves covering the arms completely down to the wrists, in Amber Haze & Terracotta tones, warm and earthy colors, showcasing a classy aura perfect on matte or flowing fabric texture, strictly no t-shirts, strictly no rolled-up sleeves",
  mocca_caramel: "wearing a modest loose-fitting gamis dress with long flowing sleeves covering the arms completely down to the wrists, in Mocca, Taupe & Caramel Latte colors, timeless sophisticated neutral colors that are highly versatile and elegant, strictly no t-shirts, strictly no rolled-up sleeves",
  warm_grey: "wearing a modest loose-fitting gamis dress with long flowing sleeves covering the arms completely down to the wrists, in Warm Grey colors with a distinct warm undertone, modern and lively compared to classic grey, strictly no t-shirts, strictly no rolled-up sleeves",
  sage_muted: "wearing a modest loose-fitting gamis dress with long flowing sleeves covering the arms completely down to the wrists, in Sage Green Muted color, highly flexible elegant color blending beautifully with skin tones, strictly no t-shirts, strictly no rolled-up sleeves",
  lavender_lilac: "wearing a modest loose-fitting gamis dress with long flowing sleeves covering the arms completely down to the wrists, in Lavender Soft & Soft Lilac colors, offering a neat feminine touch perfect for textured or layered fabric, strictly no t-shirts, strictly no rolled-up sleeves",
  butter_yellow: "wearing a modest loose-fitting gamis dress with long flowing sleeves covering the arms completely down to the wrists, in Butter Yellow (Butter Cream) color, soft and fresh positive tone keeping a polite and modest look, strictly no t-shirts, strictly no rolled-up sleeves",
  teal_navy: "wearing a modest loose-fitting gamis dress with long flowing sleeves covering the arms completely down to the wrists, in Transformative Teal & Navy Blue colors, deep dark blue and blue-green colors showing class and authority, strictly no t-shirts, strictly no rolled-up sleeves",
  olive_modern: "wearing a modest loose-fitting gamis dress with long flowing sleeves covering the arms completely down to the wrists, in Olive Green Modern color, authoritative and earthy tone, strictly no t-shirts, strictly no rolled-up sleeves",
  mahogany_maroon: "wearing a modest loose-fitting gamis dress with long flowing sleeves covering the arms completely down to the wrists, in Mahogany & Maroon colors, rich pekat red-brown, premium luxury textured modest clothing, strictly no t-shirts, strictly no rolled-up sleeves",
  cloud_dancer: "wearing a modest loose-fitting gamis dress with long flowing sleeves covering the arms completely down to the wrists, in Cloud Dancer (Off-White Modern) color, clean premium off-white highlighting fabric texture and sewing details, strictly no t-shirts, strictly no rolled-up sleeves",
  male_casual_flannel: "wearing a casual checkered flannel shirt with rolled up sleeves, showing clean male arms and hands",
  male_smart_oxford: "wearing a smart-casual long-sleeve Oxford cotton shirt with sleeves neatly rolled up, showing professional male hands",
  male_formal_suit: "wearing a formal dark charcoal wool suit sleeve and a clean white cuffs shirt sleeve, showing refined male hands",
  male_cozy_knit: "wearing a cozy thick cable-knit crewneck sweater, soft textured sleeve cuff showing warm male hands",
  "3d_fem_emerald": "wearing a rich emerald green abaya with a matching green khimar in smooth 3D clay texture",
  "3d_fem_pastel_pink": "wearing a soft pastel pink abaya with a matching pink khimar in smooth 3D clay texture",
  "3d_fem_jetblack": "wearing an elegant jet-black abaya with a matching black khimar in smooth 3D clay texture",
  "3d_fem_mocca": "wearing a mocca-caramel abaya with a taupe khimar in smooth 3D clay texture",
  "3d_male_tan_knit": "wearing a warm tan beige cable-knit crewneck sweater in smooth 3D clay texture",
  "3d_male_sage_jacket": "wearing a muted sage green casual windbreaker jacket in smooth 3D clay texture",
  "3d_male_charcoal_tshirt": "wearing a clean dark charcoal cotton t-shirt in smooth 3D clay texture",
  "3d_male_terracotta_flannel": "wearing a terracotta orange checkered flannel shirt with rolled up sleeves in smooth 3D clay texture",
  "3d_duo_earth": "the Muslim woman wearing a soft cream abaya and beige khimar, while the male wears a warm tan caramel crewneck sweater, both in smooth 3D clay textures, presenting a warm earthy color harmony",
  "3d_duo_contrast": "the Muslim woman wearing a muted sage green abaya and dark grey khimar, while the male wears a terracotta casual zipper jacket, both in smooth 3D clay textures, presenting a vibrant modern contrast",
  "3d_duo_monochrome": "the Muslim woman wearing an elegant jet-black abaya and black khimar, while the male wears a clean off-white short-sleeve t-shirt, both in smooth 3D clay textures, presenting a clean minimalist monochrome look",
  "3d_duo_pastel": "the Muslim woman wearing a soft lavender abaya and white khimar, while the male wears a light mint-green polo shirt, both in smooth 3D clay textures, presenting a gentle pastel color harmony",
  "3d_duo_cool": "the Muslim woman wearing a deep teal abaya and dark navy khimar, while the male wears a steel grey checkered flannel shirt, both in smooth 3D clay textures, presenting a professional cool-toned color harmony"
};

const ENVIRONMENT_PRESETS = {
  nordic_kitchen: "inside a clean minimalist Nordic scandinavian kitchen, pristine white marble countertops, light pine-wood cabinets, small green potted plants in the background, modern aesthetic kitchen tools",
  cozy_bedroom: "inside a warm cozy bedroom aesthetic, soft beige linen bedsheets, warm wooden headboard, soft sunlight filtering through sheer white curtains",
  vanity_clutter: "in front of an aesthetic cluttered vanity table, array of elegant luxury glass skincare bottles and gold pump caps on the tabletop, glowing round illuminated mirror reflecting soft warm bokeh",
  urban_cafe: "inside an urban industrial design cafe, exposed red-brick walls, rustic dark wooden table, black metal frames, hanging warm Edison bulb lights in background",
  warm_livingroom: "inside a warm family living room, plush velvet grey sofa, knitted throws, warm light, wooden floor with a white woven rug",
  sterile_lab: "inside a futuristic sterile research laboratory, brushed stainless steel tables, scientific glassware, glass beakers with clear liquids, high-end clean cosmetic testing environment",
  aesthetic_void: "against a seamless dreamy studio void background, smooth soft pastel color gradient, zero horizon line, soft shadows, focusing 100% on the subject"
};

const DEMOGRAPHIC_PRESETS = {
  syari_classic: "a graceful Southeast Asian Muslimah wearing a modest loose-fitting gamis dress with long flowing sleeves covering the arms completely down to the wrists (strictly no t-shirts, strictly no rolled-up sleeves, strictly no casual knitwear), featuring delicate female hands with smooth light skin, slender fingers, and natural neat fingernails, strictly faceless framing, camera focused entirely on the hands and arms, cropped from the elbow down to show only the forearms and hands, strictly omitting the face, head, neck, chest, and shoulders, showcasing precise hand actions and movements",
  caucasian_male: "a Caucasian man wearing clean casual male attire, featuring clean male hands with smooth skin, natural neat fingernails, and a subtle wristwatch, strictly faceless framing, camera focused on the forearms, hands, and product workspace, cropped from the elbow down to show only the forearms and hands interacting naturally with the product, strictly omitting the face, head, neck, chest, and shoulders, showcasing precise hand actions",
  stylized_3d_muslimah: "a 3D stylized Muslim woman with a completely blank faceless smooth head (no eyes, nose, or mouth), dressed in an elegant loose-fitting modest abaya and a wide khimar covering her chest, smooth clay-like 3D render style, bare hands visible",
  stylized_3d_male: "a 3D stylized young male with a completely blank faceless smooth head (no eyes, nose, or mouth) and detailed short hair, dressed in clean casual attire, smooth clay-like 3D render style, bare hands visible",
  stylized_3d_duo: "two 3D stylized characters in the same scene, consisting of a Muslim woman dressed in modest clothing and a young male dressed in clean casual attire, both having completely blank faceless smooth heads (no eyes, nose, or mouth) in a smooth clay-like 3D render style, bare hands visible, showing clear interaction"
};

const LIGHTING\_PRESETS \= {  
  window\_daylight: "illuminated by soft natural daylight coming from a side window, realistic soft-shadow roll-off, clean highlights",  
  golden\_hour: "drenched in cinematic warm sunset golden hour lighting, rich amber tones, long warm shadows, beautiful light flare",  
  moody\_shadow: "dramatic moody chiaroscuro lighting, deep cinematic shadows, sharp contrast, key light highlighting subject's silhouette",  
  studio\_softbox: "high-end studio three-point professional softbox lighting, clean studio photography style, zero harsh shadows",  
  lab\_cold: "clinical bright white daylight illumination, cold-tinted lighting, clean lab shadows",  
  cyber\_neon: "moody cyberpunk ambient glow, cyan and magenta pink neon light casting colorful reflections on the skin and surface",  
  candle\_warm: "warm dim candlelight ambiance, flicker of fire, highly intimate and cozy golden shadows"  
};

/\*\*  
 \* Membangun prompt analisis video dengan penyaringan visual kustom (VSO V8.4.1)  
 \*/  
export function buildVisualSwapOverridePrompt(originalVideoAnalysis, overrides, productData) {  
  // Lakukan mapping dari ID Preset ke Deskripsi Teks, atau ambil input kustom jika dipilih  
  const targetConcept \= overrides.character\_concept || "faceless";  
    
  const targetCharacter \= overrides.subject\_demographic \=== "custom"   
    ? overrides.subject\_demographic\_custom   
    : (DEMOGRAPHIC\_PRESETS\[overrides.subject\_demographic\] || "a graceful Muslimah");

  const targetWardrobe \= overrides.wardrobe\_style \=== "custom"   
    ? overrides.wardrobe\_style\_custom   
    : (WARDROBE\_PRESETS\[overrides.wardrobe\_style\] || "modest clothing");

  const targetEnvironment \= overrides.environment\_setting \=== "custom"   
    ? overrides.environment\_setting\_custom   
    : (ENVIRONMENT\_PRESETS\[overrides.environment\_setting\] || "clean aesthetic setting");

  const targetLighting \= overrides.lighting\_style \=== "custom"   
    ? overrides.lighting\_style\_custom   
    : (LIGHTING\_PRESETS\[overrides.lighting\_style\] || "soft natural light");

  return \`  
Anda adalah Director of Photography (DoP) dan Prompt Engineer senior di MAKNA Engine V8.4.1.  
Tugas Anda: Lakukan rekonstruksi visual terhadap dekonstruksi video kompetitor di bawah ini. Anda wajib mempertahankan alur pacing naskah dan emosi asli, namun mengganti seluruh estetika visual secara semantik sesuai dengan spesifikasi preset VSO berikut.

\---  
DEKONSTRUKSI VISUAL VIDEO ASLI:  
${originalVideoAnalysis}

\---  
ATURAN KETAT VISUAL SWAP OVERRIDES (VSO PRESET):  
Anda wajib membuang jauh-giat visual asli dan menimpanya dengan spesifikasi ini di seluruh klip video baru:  
1. Konsep Karakter  : ${targetConcept} (${getConceptInstruction(targetConcept)})  
2. Demografi Subjek : ${targetCharacter}  
3. Pakaian/Wardrobe : ${targetWardrobe}  
4. Latar/Environment: ${targetEnvironment}  
5. Pencahayaan/Light: ${targetLighting}

\---  
FORMAT OUTPUT YANG DIHARAPKAN (JSON ARRAY VALID):  
[  
  {  
    "clip_index": 1,  
    "generation_mode": "T2V",  
    "voiceover": "Naskah VO...",  
    "t2v_prompt": "(VERTICAL 9:16) --ar 9:16 [LAYER 0: VISUAL TRUTH] (Geometric Truth: ...), [LAYER 1: SCENE & OPTICS] (Location: ${targetEnvironment}), (Subject: ${targetCharacter} ${targetWardrobe}), (Concept: ${targetConcept} Framing Cut elbow down, forearm and hand close-up only, strictly omitting the face, head, neck, chest, and shoulders)..."  
  }  
]  
  `;  
}

## **5\. RANCANGAN ANTARMUKA FORM DENGAN PRESET DROPDOWN DILENGKAPI CUSTOM FIELD (UI)**

Ketika pengguna memilih salah satu opsi dropdown, jika nilai yang dipilih adalah "custom", sistem menggunakan penanganan state dinamis React/JS untuk memunculkan kotak input teks tambahan secara otomatis.

<!-- Cuplikan Komponen Form Pembuatan Campaign RE Hybrid V8.4.1 -->  
<div class="form-section-glowing">  
  <div class="header-with-toggle">  
    <h3>🎭 Visual Swap Overrides (VSO V8.4.1)</h3>  
    <label class="switch">  
      <input type="checkbox" id="vso_active_toggle" onChange={toggleVsoForm} />  
      <span class="slider round"></span>  
    </label>  
  </div>  
  <p class="section-desc">Pilih dari preset kurasi MAKNA untuk mengubah estetika visual video kompetitor secara instan tanpa perlu mengetik prompt dari nol.</p>

  <!-- FORM KONDISIONAL: MUNCUL JIKA TOGGLE VSO AKTIF -->  
  <div id="vso-configuration-fields" class="conditional-field-box hidden">  
      
    <div class="form-row-2col">  
      <!-- A. KONSEPT KARAKTER -->  
      <div class="form-group">  
        <label>Konsep Karakter (Framing):</label>  
        <select name="character_concept" id="character_concept">  
          <option value="faceless">Faceless (Wajah Terpotong - Mandate 67)</option>  
          <option value="pov">POV (Sudut Pandang Orang Pertama)</option>  
          <option value="silhouette">Siluet Bayangan (Moody/Mysterious)</option>  
          <option value="stylized_3d">3D Stylized Claymation</option>  
        </select>  
      </div>

      <!-- B. DEMOGRAFI SUBJEK -->  
       <div class="form-group">  
         <label>Demografi Subjek / Model:</label>  
         <select name="subject_demographic" id="subject_demographic" onChange={handlePresetChange}>  
           <option value="syari_classic">Wanita Gamis Syar'iy (Hanya Tangan / Siku ke Bawah)</option>  
           <option value="caucasian_male">Pria Kaukasia (Hanya Tangan / Siku ke Bawah)</option>  
           <option value="custom">-- Tulis Custom Sendiri --</option>  
         </select>  
         <!-- INPUT TAMBAHAN JIKA USER MEMILIH CUSTOM -->  
         <input type="text" id="subject_demographic_custom" name="subject_demographic_custom" class="custom-field hidden" placeholder="Ketik deskripsi subjek kustom Anda di sini..." />  
       </div>  
     </div>

     <div class="form-row-2col">  
       <!-- C. GAYA PAKAIAN / WARDROBE (FILTER DINAMIS) -->  
       <div class="form-group">  
         <label>Pakaian / Wardrobe:</label>  
         <select name="wardrobe_style" id="wardrobe_style" onChange={handlePresetChange}>  
           <option value="random">🎲 Random (Acak)</option>  
           <!-- Jika Demografi Wanita: emerald_syari, pastel_pink, dll. -->
           <!-- Jika Demografi Pria: male_casual_flannel, male_smart_oxford, dll. -->
           <option value="custom">-- Tulis Custom Sendiri --</option>  
         </select>  
         <input type="text" id="wardrobe_style_custom" name="wardrobe_style_custom" class="custom-field hidden" placeholder="Ketik pakaian kustom di sini..." />  
       </div>

      \<\!-- D. LATAR TEMPAT / ENVIRONMENT \--\>  
      \<div class="form-group"\>  
        \<label\>Latar Tempat (Environment Setting):\</label\>  
        \<select name="environment\_setting" id="environment\_setting" onChange={handlePresetChange}\>  
          \<option value="nordic\_kitchen"\>Dapur Modern Minimalis Skandinavian\</option\>  
          \<option value="cozy\_bedroom"\>Kamar Tidur Linen Krem Estetik Hangat\</option\>  
          \<option value="vanity\_clutter"\>Meja Rias Skincare Mewah (Vanity Mirror)\</option\>  
          \<option value="urban\_cafe"\>Interior Kafe Urban Bata Ekspos (Industrial)\</option\>  
          \<option value="warm\_livingroom"\>Ruang Tamu Sofa Beludru Hangat\</option\>  
          \<option value="sterile\_lab"\>Laboratorium Steril Stainless-Steel\</option\>  
          \<option value="aesthetic\_void"\>Infinite Void Minimalis (Gradasi Pastel)\</option\>  
          \<option value="custom"\>-- Tulis Custom Sendiri \--\</option\>  
        \</select\>  
        \<input type="text" id="environment\_setting\_custom" name="environment\_setting\_custom" class="custom-field hidden" placeholder="Ketik deskripsi latar tempat kustom di sini..." /\>  
      \</div\>  
    \</div\>

    \<\!-- E. PENCAHAYAAN & ATMOSFER \--\>  
    \<div class="form-group"\>  
      \<label\>Pencahayaan & Gaya Sinematik (Lighting Ambiance):\</label\>  
      \<select name="lighting\_style" id="lighting\_style" onChange={handlePresetChange}\>  
        \<option value="window\_daylight"\>Soft Window Daylight (Cahaya jendela natural)\</option\>  
        \<option value="golden\_hour"\>Golden Hour Warm Sunset (Sorot sore keemasan)\</option\>  
        \<option value="moody\_shadow"\>Moody Cinematic Shadow (Kontras chiaroscuro dramatis)\</option\>  
        \<option value="studio\_softbox"\>Clean Professional Studio Softbox (Sangat bersih)\</option\>  
        \<option value="lab\_cold"\>Clinical Cold White (Putih lab bersih terang)\</option\>  
        \<option value="cyber\_neon"\>Moody Cyberpunk Blue-Pink Neon (Warna glow modern)\</option\>  
        \<option value="candle\_warm"\>Cozy Dim Candlelight Ambiance (Sangat syahdu hangat)\</option\>  
        \<option value="custom"\>-- Tulis Custom Sendiri \--\</option\>  
      \</select\>  
      \<input type="text" id="lighting\_style\_custom" name="lighting\_style\_custom" class="custom-field hidden" placeholder="Ketik gaya pencahayaan kustom di sini..." /\>  
    \</div\>

  \</div\>  
\</div\>

\<script\>  
  // Logika sederhana penanganan UI dinamis di frontend untuk menampilkan textbox kustom jika user memilih "custom"  
  function handlePresetChange(event) {  
    const selectElement \= event.target;  
    const customInputId \= selectElement.id \+ "\_custom";  
    const customInput \= document.getElementById(customInputId);  
      
    if (customInput) {  
      if (selectElement.value \=== "custom") {  
        customInput.classList.remove("hidden");  
        customInput.setAttribute("required", "true");  
      } else {  
        customInput.classList.add("hidden");  
        customInput.removeAttribute("required");  
        customInput.value \= ""; // Reset value kustom  
      }  
    }  
  }  
\</script\>

## **6\. MATRIX EVALUASI VISUAL BATCH (QA & VERIFICATION)**

Untuk menjamin ketaatan G Labs dalam membedakan detail visual asli dengan visual baru, sistem *Quality Assurance* memvalidasi prompt menggunakan pengujian berikut:

| Elemen Visual | Deskripsi Hasil Video Asli (Kompetitor) | Hasil Video Baru MAKNA V8.4.1 (VSO Verified) |
| :---- | :---- | :---- |
| **Karakter & Hijab** | Wanita berhijab biru biasa. | Wanita berhijab Syar'i hijau emerald menutup dada sesuai **emerald_syari** (Mandate 51). |
| **Framing Kepala** | Wajah nampak samping saat menuang air. | Frame dipotong tegas di siku ke bawah (**Mandate 67: Faceless**). Hanya nampak lengan dan jari tangan yang anggun. |
| **Latar Belakang** | Dapur pedesaan kayu klasik dengan cobek batu. | Dapur modern bergaya Nordik/Skandinavian sesuai preset **nordic_kitchen**. |
| **Pacing Narasi** | Kecepatan bicara 2.5 kata per detik (Jelas). | Kecepatan sama, namun dihiasi warna baju baru yang kontras. |

**EOF (End of Blueprint Document)**

*Sistem VSO MAKNA Engine V9.3.1 memberikan kemudahan operasional tertinggi melalui kurasi preset, sembari mempertahankan fleksibilitas kustomisasi visual iklan bagi pengguna.*