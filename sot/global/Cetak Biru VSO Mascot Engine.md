# **CETAK BIRU SISTEM: VSO ANTHROPOMORPHIC MASCOT ENGINE (MAKNA V9.4 \- THE OTONOMOUS UNIVERSE UPDATE)**

Cetak biru ini menjelaskan perluasan fungsionalitas **Visual Swap Override (VSO) Engine** pada MAKNA Engine untuk mendukung pembuatan karakter kartun animasi non-manusia (*anthropomorphic mascots*). Pada pembaruan ini, antarmuka pengguna disederhanakan murni pada tingkat pemilihan Semesta (**Herbal, Kitchen, Home Living, dan Pet**). Gemini AI bertindak sebagai sutradara cerdas yang memilih karakter spesifik dari database semesta terkait secara otonom berdasarkan analisis narasi cerita yang sedang dibuat.

## **1\. STRATEGI ALUR KERJA (OTONOMOUS MASCOT PIPELINE)**

Ketika pengguna memilih salah satu kategori "Mascot Universe" di UI, sistem *VSO Preset Mapper* akan melakukan bypass terhadap aturan anatomi manusia (SOP jilbab, abaya, bare-hands, atau ras kaukasia) dan memberikan pustaka karakter semesta terkait ke Gemini AI.

  \[User Pilih Dropdown: Semesta Herbal (mascot\_universe\_herbal)\]  
                                 │  
                                 ▼  
                     \[VSO Preset Mapper V9.4\]  
  \- Nonaktifkan: Modesty Lock, Human Anatomy, Wardrobe (Manusia).  
  \- Tarik Pustaka Karakter Semesta Herbal ke Memori Server.  
                                 │  
                                 ▼  
                       \[Gemini AI Generator\]  
  \- Membaca Analisis Video Lama & Topik.  
  \- Memilih Otonom: Jahe Perkasa (mascot\_ginger\_guardian) karena resep wedang hangat.  
  \- Merangkai visual prompt 3D kartun di G-Labs dengan DNA Jahe Perkasa secara presisi.

## **2\. KORIDOR DNA KARAKTER GLOBAL (THE MASCOT CHARACTER DNA)**

Seluruh karakter di dalam 4 semesta wajib diproduksi dengan ketaatan visual ![][image1] terhadap aturan parameter berikut untuk menghindari inkonsistensi antar-klip:

1. **Gaya Animasi:** *3D stylized clay animation* (mirip film animasi modern/tanah liat, bukan fotorealistis).  
2. **Proporsi Tubuh:** Kepala besar, berukuran ![][image2] dari total tinggi tubuh (*super cute / chibby ratio*).  
3. **Wajah (Faceless Cartoon):** Tanpa hidung. Mata berbentuk oval hitam mengilap dengan satu highlight putih bulat di dalamnya. Mulut kecil sederhana yang sangat ekspresif.  
4. **Anggota Tubuh:** Tangan kecil berbentuk *rounded mitten* (4 jari menyatu, ibu jari terpisah). Kaki pendek membulat tanpa detail jari kaki.  
5. **Pakaian & Aksesori:** Tidak memakai pakaian manusia (kecuali aksesori kecil seperti kacamata daun, mahkota kecil, pita, atau topi kapten yang menjadi ciri khas).  
6. **Warna & Render:** Saturated warna cerah. Tanpa outline hitam. Material menyerupai *soft clay* (tanah liat lunak) doff dengan sedikit pantulan cahaya (*matte-specular reflections*).

## **3\. PUSTAKA PRESET SUBJEK MASKOT (THE QUAD-UNIVERSE MATRIX)**

Berikut adalah kamus karakter lengkap dari 4 semesta yang disimpan di server lokal (lib/prompts.js) sebagai panduan referensi bagi Gemini AI saat memilih karakter secara dinamis:

### **A. SEMESTA HERBAL (HERBAL UNIVERSE)**

* mascot\_ginger\_guardian : Karakter jahe 3D bertubuh kekar, tekstur serat jahe alami, tangan mungil kuat, senyum percaya diri, berdiri tegap.  
* mascot\_turmeric\_wisdom : Karakter kunyit 3D kuning keemasan, tubuh ramping, mata teduh, membawa tongkat kayu kecil, bijaksana.  
* mascot\_galangal\_explorer : Karakter lengkuas 3D bertekstur kasar, memakai ransel daun kecil, penuh rasa ingin tahu.  
* mascot\_fingerroot\_inventor: Karakter kencur 3D mungil, rambut daun kecil menyerupai antena, gemar bereksperimen.  
* mascot\_garlic\_genius : Karakter bawang putih 3D berbentuk siung bulat, cerdas, memakai kacamata daun mungil.  
* mascot\_shallot\_artist : Karakter bawang merah 3D berwarna ungu cerah, kreatif, gemar melukis memakai kelopak bunga.  
* mascot\_mint\_breeze : Karakter daun mint 3D hijau cerah yang sangat elastis, selalu bergerak lincah membawa kesegaran.  
* mascot\_pandan\_dreamer : Karakter daun pandan 3D panjang dengan rambut pita hijau, lembut dan tenang.  
* mascot\_basil\_singer : Karakter daun basil 3D mungil, ekspresi bernyanyi yang merdu.  
* mascot\_moringa\_helper : Karakter daun kelor 3D kecil, energik, suka membantu.  
* mascot\_lemongrass\_runner : Karakter serai 3D ramping dengan ikat kepala daun, pelari tercepat.  
* mascot\_betel\_guardian : Karakter daun sirih 3D berbentuk hati, pemberani dan menjaga ketertiban.  
* mascot\_rosella\_cheer : Karakter bunga rosella 3D merah cerah yang selalu ceria dan penuh semangat.  
* mascot\_chamomile\_sleepy : Karakter bunga chamomile 3D putih-kuning, mata setengah tertutup, pembawa suasana santai.  
* mascot\_clove\_captain : Karakter bunga cengkeh kering 3D kecil dengan topi kapten mungil, disiplin dan tegas.  
* mascot\_saffron\_queen : Karakter putik saffron 3D merah tua yang anggun, mengenakan mahkota emas kecil.  
* mascot\_lemon\_sunshine : Karakter lemon 3D bulat, kulit berpori alami, sangat optimis, tersenyum lebar.  
* mascot\_lime\_spark : Karakter jeruk nipis 3D mungil, hiperaktif, bergerak cepat.  
* mascot\_honey\_lemon\_duo : Karakter lemon dengan tetesan madu, lembut dan penyayang.  
* mascot\_tamarind\_storyteller: Karakter asam jawa 3D berbentuk polong, gemar menceritakan kisah-kisah lama.  
* mascot\_honey\_keeper : Karakter tetesan madu 3D berwarna emas transparan dengan sayap lebah mungil, ramah dan murah hati.

### **B. SEMESTA DAPUR (KITCHEN UNIVERSE)**

* mascot\_pan\_guardian : Karakter wajan keramik krem 3D, tangan dan kaki mungil, permukaan doff premium, selalu tersenyum hangat.  
* mascot\_pot\_grandma : Karakter panci enamel putih 3D bertutup merah, tubuh bulat menggemaskan, sabar dan penyayang.  
* mascot\_blender\_tornado : Karakter blender portable transparan 3D, pusaran buah pastel berputar di dalam gelas, sangat energik.  
* mascot\_spatula\_flex : Karakter spatula silikon krem bergagang kayu, tubuh lentur, gemar menari.  
* mascot\_whisk\_dancer : Karakter whisk stainless 3D, kaki kecil lincah, berputar-putar seperti penari balet.  
* mascot\_knife\_master : Karakter pisau chef premium 3D, mata tajam namun ramah, disiplin dan presisi.  
* mascot\_cuttingboard\_giant : Karakter talenan kayu oak 3D bertubuh lebar, tenang, kuat.  
* mascot\_ricecooker\_chef : Karakter rice cooker putih minimalis 3D, tutup membuka seperti topi, ahli memasak nasi.  
* mascot\_airfryer\_genius : Karakter air fryer hitam modern 3D, percaya diri, bangga memasak sehat tanpa minyak.  
* mascot\_kettle\_steam : Karakter teko listrik putih 3D, uap kecil sebagai rambut, ramah dan suka menyapa.  
* mascot\_egg\_shy : Karakter telur ayam 3D berwarna krem, pipi merah muda, pemalu dan berhati baik.  
* mascot\_tomato\_cheer : Karakter tomat merah 3D bulat mengilap, sangat ceria dan bersahabat.  
* mascot\_carrot\_runner : Karakter wortel oranye 3D bertubuh ramping, cepat berlari.  
* mascot\_broccoli\_professor : Karakter brokoli hijau 3D berkepala besar, cerdas, suka membaca buku.  
* mascot\_mushroom\_sleepy : Karakter jamur putih 3D mungil dengan topi besar, santai dan mengantuk.  
* mascot\_bread\_gentle : Karakter roti tawar 3D empuk dengan pinggiran kecokelatan, lembut dan penyayang.  
* mascot\_milk\_pure : Karakter botol susu kaca 3D mungil dengan isi susu putih cerah, polos dan jujur.  
* mascot\_bowl\_happy : Karakter mangkuk keramik putih 3D dengan wajah di bagian depan, ramah dan senang menampung makanan.  
* mascot\_timer\_tick : Karakter kitchen timer bulat 3D, jarum mungil yang terus bergerak disiplin.  
* mascot\_measuringcup\_precise: Karakter gelas ukur transparan 3D dengan skala warna pastel, perfeksionis.  
* mascot\_storagebox\_neat : Karakter food container transparan 3D bertutup hijau, sangat rapi.

### **C. SEMESTA RUMAH & DEKOR (HOME LIVING UNIVERSE)**

* mascot\_vacuum\_hunter : Karakter vacuum cleaner putih 3D modern, mata biru cerah, roda kecil lincah memburu debu.  
* mascot\_broom\_sweeper : Karakter sapu kayu 3D dengan bulu lembut berwarna krem, sederhana dan pekerja keras.  
* mascot\_mop\_dancer : Karakter pel putar 3D dengan kepala microfiber biru muda, gemar berputar seperti penari.  
* mascot\_sponge\_bubble : Karakter spons cuci kuning 3D dengan gelembung-gelembung sabun kecil di sekelilingnya, ceria.  
* mascot\_storagebox\_keeper : Karakter kotak penyimpanan transparan 3D bertutup sage green, rapi dan tenang.  
* mascot\_basket\_helper : Karakter keranjang rotan 3D dengan tekstur anyaman halus, murah hati membawa barang.  
* mascot\_hanger\_stretch : Karakter hanger kayu premium 3D bertangan lentur, tampil elegan merapikan pakaian.  
* mascot\_shoerack\_manager : Karakter rak sepatu minimalis 3D bertingkat, disiplin dan teratur.  
* mascot\_sofa\_hugger : Karakter sofa krem 3D empuk, suka memeluk semua teman yang kelelahan.  
* mascot\_pillow\_sleepy : Karakter bantal putih 3D lembut, mata setengah tertutup, suka menguap.  
* mascot\_table\_host : Karakter meja kayu oak 3D berkaki kokoh, bijaksana.  
* mascot\_chair\_support : Karakter kursi kayu minimalis 3D, kuat menopang siapa pun.  
* mascot\_lamp\_sunshine : Karakter lampu meja LED putih 3D, wajah bercahaya saat tersenyum, hangat dan positif.  
* mascot\_fan\_breeze : Karakter kipas angin putih 3D, baling-baling berputar perlahan saat berbicara, santai.  
* mascot\_humidifier\_cloud : Karakter humidifier putih 3D, mengeluarkan awan kecil lucu di atas kepala.  
* mascot\_airpurifier\_guardian: Karakter air purifier modern 3D bertubuh ramping, selalu menjaga udara tetap segar.  
* mascot\_trashbin\_clean : Karakter tempat sampah otomatis putih 3D bertutup membuka seperti mulut tersenyum.  
* mascot\_laundrybasket\_busy : Karakter keranjang laundry kain 3D yang selalu sibuk mengumpulkan pakaian.  
* mascot\_clothespin\_twin : Sepasang jepitan jemuran kayu 3D mungil yang bekerja sama dan tidak terpisahkan.  
* mascot\_cableclip\_neat : Karakter cable clip silikon 3D kecil, perfeksionis merapikan kabel.

### **D. SEMESTA HEWAN PELIHARAAN (PET UNIVERSE)**

* mascot\_oren\_buddy : Karakter kucing oren 3D, pipi tembam, ramah, penasaran, suka mencoba hal baru.  
* mascot\_mochi\_white : Karakter kucing putih 3D berbulu lembut, tenang, suka tidur di tempat hangat.  
* mascot\_shadow\_black : Karakter kucing hitam 3D bermata kuning keemasan, lincah, cerdas, pandai menyelinap.  
* mascot\_calico\_sunshine : Karakter kucing belang tiga warna 3D, ceria dan suka menghibur.  
* mascot\_corgi\_smile : Karakter anjing corgi 3D berkaki pendek, senyum lebar penuh semangat, setia.  
* mascot\_shiba\_proud : Karakter anjing shiba inu 3D cokelat muda, percaya diri, mandiri, berhati lembut.  
* mascot\_poodle\_gentle : Karakter pudel putih 3D berbulu keriting, rapi, sopan, menyukai kebersihan.  
* mascot\_golden\_helper : Karakter golden retriever 3D berbulu emas, penyabar dan suka membantu.  
* mascot\_bunny\_hopper : Karakter kelinci putih 3D bertelinga panjang, lincah melompat-lompat.  
* mascot\_hammy\_nibbles : Karakter hamster cokelat muda 3D bulat mungil, gemar mengumpulkan makanan.  
* mascot\_guinea\_cuddle : Karakter guinea pig krem-putih 3D berbulu halus, pemalu dan penyayang.  
* mascot\_hedgie\_roll : Karakter landak mini 3D berduri pendek lembut, akan menggulung saat terkejut.  
* mascot\_parrot\_talkie : Karakter burung nuri hijau 3D yang cerewet, suka mengulang kata-kata lucu.  
* mascot\_canary\_song : Karakter burung kenari kuning 3D bersuara merdu, membawa keceriaan.  
* mascot\_owl\_professor : Karakter burung hantu cokelat 3D bermata besar, bijaksana memberi nasihat.  
* mascot\_goldie\_bubble : Karakter ikan mas koki oranye 3D berekor lebar, suka meniup gelembung hati.  
* mascot\_betta\_flash : Karakter ikan cupang biru 3D dengan sirip indah mengembang, elegan.  
* mascot\_turtle\_slowmo : Karakter kura-kura hijau 3D bercangkang mengilap, sabar dan tenang.  
* mascot\_pawbowl\_kind : Karakter mangkuk makan hewan 3D berwarna pastel dengan ikon jejak kaki, ramah.  
* mascot\_ball\_bouncer : Karakter bola mainan hewan 3D berwarna merah cerah, suka memantul aktif.

## **4\. MODIFIKASI KODE PRESET MAPPER & PROMPT (lib/prompts.js)**

Kita mendefinisikan pustaka karakter per semesta. Saat fungsi buildVisualSwapOverridePrompt dipanggil dengan tipe mascot\_universe\_, sistem akan menyuntikkan seluruh daftar karakter semesta tersebut ke dalam instruksi agar Gemini yang memilih dan menyusun deskripsinya secara dinamis.

// Pengelompokan Karakter per Semesta di lib/prompts.js  
const MASCOT\_UNIVERSES \= {  
  mascot\_universe\_herbal: {  
    name: "Herbal Universe",  
    mascots: {  
      mascot\_ginger\_guardian: "a cute 3D stylized ginger root character, muscular tiny clay arms and legs, soft organic brown ginger clay texture",  
      mascot\_turmeric\_wisdom: "a cute 3D stylized turmeric root character, golden-yellow clay body, warm wise eyes, carrying a tiny wooden stick",  
      mascot\_galangal\_explorer: "a cute 3D stylized galangal root character, rough clay texture, wearing a tiny leaf backpack",  
      mascot\_fingerroot\_inventor: "a cute 3D stylized fingerroot character, hair resembling tiny leaf antennas, curious face",  
      mascot\_garlic\_genius: "a cute 3D stylized garlic bulb character, round chubby body, wearing tiny leaf glasses",  
      mascot\_shallot\_artist: "a cute 3D stylized shallot bulb character, bright purple-pink clay skin, artistic expression",  
      mascot\_mint\_breeze: "a cute 3D stylized green mint leaf character, bouncy and elastic, bringing cool fresh vibes",  
      mascot\_pandan\_dreamer: "a cute 3D stylized green pandan leaf character, long sleek hair, calm dreamy face",  
      mascot\_basil\_singer: "a cute 3D stylized green basil leaf character, tiny body, expressive singing face",  
      mascot\_moringa\_helper: "a cute 3D stylized green moringa leaf character, tiny and energetic body",  
      mascot\_lemongrass\_runner: "a cute 3D stylized lemongrass stalk character, slender tall body, wearing a tiny leaf headband",  
      mascot\_betel\_guardian: "a cute 3D stylized heart-shaped betel leaf character, brave facial expression",  
      mascot\_rosella\_cheer: "a cute 3D stylized red rosella flower character, extremely cheerful open smile",  
      mascot\_chamomile\_sleepy: "a cute 3D stylized chamomile flower character, white petals with yellow center, sleepy half-closed eyes",  
      mascot\_clove\_captain: "a cute 3D stylized brown clove character, wearing a tiny captain hat",  
      mascot\_saffron\_queen: "a cute 3D stylized deep red saffron thread character, wearing a tiny gold crown",  
      mascot\_lemon\_sunshine: "a cute 3D stylized yellow lemon character, textured porous fresh skin, joyful wide smile",  
      mascot\_lime\_spark: "a cute 3D stylized green lime character, hyperactive pose, tiny round body",  
      mascot\_honey\_lemon\_duo: "a cute 3D stylized lemon with a dripping golden honey drop on its head, gentle face",  
      mascot\_tamarind\_storyteller: "a cute 3D stylized brown tamarind pod character, warm wise storytelling face",  
      mascot\_honey\_keeper: "a cute 3D stylized honey drop character, golden semi-transparent honey body, tiny buzzing bee wings"  
    }  
  },  
  mascot\_universe\_kitchen: {  
    name: "Kitchen Universe",  
    mascots: {  
      mascot\_pan\_guardian: "a cute 3D stylized cream ceramic pan character, matte finish, tiny wooden handles as arms",  
      mascot\_pot\_grandma: "a cute 3D stylized white enamel pot character with a red lid, round loving body",  
      mascot\_blender\_tornado: "a cute 3D stylized transparent blender character, swirling pastel fruit smoothies inside its body",  
      mascot\_spatula\_flex: "a cute 3D stylized silicone spatula character, highly flexible body, wood-textured legs",  
      mascot\_whisk\_dancer: "a cute 3D stylized stainless whisk character, spinning on tiny elegant feet like a ballet dancer",  
      mascot\_knife\_master: "a cute 3D stylized chef knife character, sharp but friendly reflective metallic body",  
      mascot\_cuttingboard\_giant: "a cute 3D stylized oak wood cutting board character, wide calm flat body",  
      mascot\_ricecooker\_chef: "a cute 3D stylized minimal white rice cooker character, lid slightly open like a chef hat",  
      mascot\_airfryer\_genius: "a cute 3D stylized modern black air fryer, highly confident robotic face",  
      mascot\_kettle\_steam: "a cute 3D stylized white electric kettle, steam puff hair, friendly face",  
      mascot\_egg\_shy: "a cute 3D stylized beige egg character, blushing rosy cheeks, shy posture",  
      mascot\_tomato\_cheer: "a cute 3D stylized shiny red tomato, round chubby body, cheerful face",  
      mascot\_carrot\_runner: "a cute 3D stylized orange carrot character, slender athletic body, fast running stance",  
      mascot\_broccoli\_professor: "a cute 3D stylized green broccoli character, large puffy head, intelligent face",  
      mascot\_mushroom\_sleepy: "a cute 3D stylized white mushroom, wearing a large puffy cap, sleepy expression",  
      mascot\_bread\_gentle: "a cute 3D stylized soft bread loaf slice, gentle and warm face",  
      mascot\_milk\_pure: "a cute 3D stylized glass milk bottle, pure white liquid inside, innocent facial expression",  
      mascot\_bowl\_happy: "a cute 3D stylized white ceramic bowl, happy smiling face printed on the front",  
      mascot\_timer\_tick: "a cute 3D stylized kitchen timer, round ticking face",  
      mascot\_measuringcup\_precise: "a cute 3D stylized glass measuring cup with pastel scale lines, perfectionist face",  
      mascot\_storagebox\_neat: "a cute 3D stylized clear food container, green airtight lid, highly organized look"  
    }  
  },  
  mascot\_universe\_home\_living: {  
    name: "Home Living Universe",  
    mascots: {  
      mascot\_vacuum\_hunter: "a cute 3D stylized white vacuum cleaner, energetic glowing blue eyes, tiny rolling wheels",  
      mascot\_broom\_sweeper: "a cute 3D stylized wooden broom, soft cream bristles, hard-working posture",  
      mascot\_mop\_dancer: "a cute 3D stylized spin mop, light-blue microfiber head spinning elegantly",  
      mascot\_sponge\_bubble: "a cute 3D stylized yellow sponge, surrounded by tiny soapy floating bubbles",  
      mascot\_storagebox\_keeper: "a cute 3D stylized sage green storage box, neat and tidy posture",  
      mascot\_basket\_helper: "a cute 3D stylized woven rattan basket, warm wood textures",  
      mascot\_hanger\_stretch: "a cute 3D stylized wooden hanger, flexible arms, elegant stance",  
      mascot\_shoerack\_manager: "a cute 3D stylized tier shoe rack, neat and disciplined look",  
      mascot\_sofa\_hugger: "a cute 3D stylized cozy cream sofa, giant fluffy arms ready to hug",  
      mascot\_pillow\_sleepy: "a cute 3D stylized soft white pillow, sleepy half-closed eyes, yawning face",  
      mascot\_table\_host: "a cute 3D stylized oak wood table, solid sturdy legs",  
      mascot\_chair\_support: "a cute 3D stylized minimal wooden chair, loyal supportive stance",  
      mascot\_lamp\_sunshine: "a cute 3D stylized white desk lamp, face lighting up with bright yellow illumination",  
      mascot\_fan\_breeze: "a cute 3D stylized white desk fan, spinning blades, relaxed look",  
      mascot\_humidifier\_cloud: "a cute 3D stylized white humidifier, blowing a tiny soft cloud above its head",  
      mascot\_airpurifier\_guardian: "a cute 3D stylized sleek white air purifier, clean modern face",  
      mascot\_trashbin\_clean: "a cute 3D stylized automatic white trash bin, lid open like a wide happy smile",  
      mascot\_laundrybasket\_busy: "a cute 3D stylized canvas laundry hamper, busy and active posture",  
      mascot\_clothespin\_twin: "a pair of tiny cute 3D stylized wooden clothespins, inseparable twins holding hands",  
      mascot\_cableclip\_neat: "a cute 3D stylized pastel silicone cable clip, tidy and perfectionist look"  
    }  
  },  
  mascot\_universe\_pet: {  
    name: "Pet Universe",  
    mascots: {  
      mascot\_oren\_buddy: "a cute 3D stylized ginger tabby cat, round chubby face, curious sparkling black eyes",  
      mascot\_mochi\_white: "a cute 3D stylized fluffy white cat, looking like a soft mochi, peaceful sleeping expression",  
      mascot\_shadow\_black: "a cute 3D stylized black cat, golden-yellow glowing eyes, sleek agile posture",  
      mascot\_calico\_sunshine: "a cute 3D stylized tri-color calico cat, cheerful energetic face",  
      mascot\_corgi\_smile: "a cute 3D stylized fluffy corgi dog, short stubby legs, giant open-mouth happy smile",  
      mascot\_shiba\_proud: "a cute 3D stylized tan shiba inu dog, proud and confident posture, gentle face",  
      mascot\_poodle\_gentle: "a cute 3D stylized white curly poodle, clean and groomed look, polite expression",  
      mascot\_golden\_helper: "a cute 3D stylized golden retriever, loyal loving eyes, patient face",  
      mascot\_bunny\_hopper: "a cute 3D stylized white rabbit, long floppy ears, bouncy hopping pose",  
      mascot\_hammy\_nibbles: "a cute 3D stylized chubby brown hamster, stuffed cheeks, gathering food pose",  
      mascot\_guinea\_cuddle: "a cute 3D stylized fluffy cream guinea pig, shy cuddly posture",  
      mascot\_hedgie\_roll: "a cute 3D stylized tiny hedgehog, soft short spikes, rolling into a ball",  
      mascot\_parrot\_talkie: "a cute 3D stylized green parrot, clever talkative expression",  
      mascot\_canary\_song: "a cute 3D stylized bright yellow canary, singing posture, cheerful face",  
      mascot\_owl\_professor: "a cute 3D stylized wise brown owl, wearing tiny round leaf glasses",  
      mascot\_goldie\_bubble: "a cute 3D stylized orange goldfish, wide tail, blowing tiny heart-shaped bubbles",  
      mascot\_betta\_flash: "a cute 3D stylized blue betta fish, elegant flowing fins, confident posture",  
      mascot\_turtle\_slowmo: "a cute 3D stylized green sea turtle, smooth shiny shell, calm slow expression",  
      mascot\_pawbowl\_kind: "a cute 3D stylized pastel pet bowl with a paw icon, welcoming face",  
      mascot\_ball\_bouncer: "a cute 3D stylized red bouncy toy ball, hyperactive dynamic pose"  
    }  
  }  
};

const MASCOT\_ART\_STYLES \= {  
  "3d\_claymation\_cozy": "in a highly detailed 3D claymation style, soft cozy clay-like textures, matte finish, warm drop shadows, reminiscent of modern vinyl art toys, cute cozy game aesthetic, octane render",  
  "kawaii\_flat\_vector": "in a clean flat vector kawaii anime illustration style, bold clean outlines, simplified cute shapes, bright pastel color palette, minimalist design, zero gradients",  
  "ghibli\_watercolor": "in a whimsical hand-drawn watercolor illustration style, soft textured paper grain, gentle brush strokes, magical natural lighting, nostalgia anime aesthetic"  
};

/\*\*  
 \* Pembangun Prompt VSO V9.4 yang mendukung Pemilihan Maskot Otonom  
 \*/  
export function buildVisualSwapOverridePrompt(originalVideoAnalysis, overrides, productData) {  
  const isMascotUniverse \= overrides.subject\_demographic.startsWith('mascot\_universe\_');  
  const targetConcept \= overrides.character\_concept || "faceless";  
    
  let targetCharacter \= "";  
  let targetStyle \= "";  
  let mascotSystemDirective \= "";

  if (isMascotUniverse) {  
    // 1\. Dapatkan database semesta yang dipilih pengguna  
    const universeKey \= overrides.subject\_demographic; // e.g. 'mascot\_universe\_herbal'  
    const universeData \= MASCOT\_UNIVERSES\[universeKey\];  
      
    // 2\. Format daftar karakter semesta untuk disuapkan sebagai instruksi ke Gemini  
    const characterListString \= Object.entries(universeData.mascots)  
      .map((\[id, desc\]) \=\> \`- ID: \[${id}\] \-\> Deskripsi DNA: ${desc}\`)  
      .join('\\n');

    targetStyle \= MASCOT\_ART\_STYLES\[overrides.visual\_style\_preset\] || MASCOT\_ART\_STYLES\['3d\_claymation\_cozy'\];  
      
    // 3\. Rekayasa instruksi sistem untuk memaksa Gemini memilih karakter paling relevan secara cerdas  
    mascotSystemDirective \= \`  
\---  
ATURAN KHUSUS SEMESTA MASKOT (${universeData.name} \- MANDATE 97):  
\- Anda adalah sutradara animasi\! DILARANG KERAS memunculkan model manusia, jilbab, abaya, jas formal, atau organ tubuh manusia nyata di seluruh prompt klip baru\!  
\- Pilihlah secara otonom SATU ATAU DUA karakter paling relevan dari daftar di bawah ini berdasarkan alur cerita/resep yang Anda buat:  
${characterListString}  
\- Masukkan karakter pilihan Anda tersebut sebagai subjek utama visual prompt di setiap klip.  
\- Karakter harus digambarkan melakukan aksi memasak atau berinteraksi secara lucu menggunakan fisik kartunnya yang menggemaskan.  
\- Gaya visual wajib dikunci sepenuhnya menggunakan: \[${targetStyle}\].  
\`;  
    targetCharacter \= "an autonomous 3D mascot chosen from " \+ universeData.name;  
  } else {  
    // Gunakan preset manusia yang sudah ada di VSO V8.4.1  
    targetCharacter \= DEMOGRAPHIC\_PRESETS\[overrides.subject\_demographic\] || "a graceful Muslimah";  
    targetStyle \= "photorealistic raw photography, 8k resolution, cinematic lighting";  
  }

  const targetEnvironment \= overrides.environment\_setting \=== "custom"   
    ? overrides.environment\_setting\_custom   
    : (ENVIRONMENT\_PRESETS\[overrides.environment\_setting\] || "clean aesthetic setting");

  const targetLighting \= overrides.lighting\_style \=== "custom"   
    ? overrides.lighting\_style\_custom   
    : (LIGHTING\_PRESETS\[overrides.lighting\_style\] || "soft natural light");

  return \`  
Anda adalah Director of Animation dan Prompt Engineer senior di MAKNA Engine V9.4.  
Tugas Anda: Lakukan rekonstruksi visual terhadap dekonstruksi video kompetitor di bawah ini menjadi video baru dengan karakter baru sesuai dengan preset overrides yang ditentukan.

\---  
DEKONSTRUKSI VISUAL VIDEO ASLI:  
${originalVideoAnalysis}

\---  
ATURAN KETAT VISUAL SWAP OVERRIDES:  
1\. Konsep Karakter  : ${isMascotUniverse ? 'Stylized Mascot Animation' : targetConcept}  
2\. Demografi Subjek : ${targetCharacter}  
3\. Gaya Visual      : ${targetStyle}  
4\. Latar/Environment: ${targetEnvironment}  
5\. Pencahayaan/Light: ${targetLighting}  
${mascotSystemDirective}

\---  
FORMAT OUTPUT YANG DIHARAPKAN (JSON ARRAY VALID):  
\[  
  {  
    "clip\_index": 1,  
    "generation\_mode": "T2V",  
    "voiceover": "Naskah VO...",  
    "t2v\_prompt": "(VERTICAL 9:16) \--ar 9:16 \[LAYER 0: VISUAL TRUTH\] (Mascot Truth: \[Tuliskan ID\_MASCOT yang Anda pilih beserta deskripsi DNA-nya di sini\!\]), \[LAYER 1: SCENE & OPTICS\] (Location: ${targetEnvironment}), (Style: ${targetStyle}), (Lighting: ${targetLighting})..."  
  }  
\]  
  \`;  
}

## **5\. PENYESUAIAN ANTARMUKA PENGGUNA FORM VSO UI**

Pada halaman input kampanye, dropdown pilihan VSO dirancang secara cerdas untuk memisahkan pilihan subjek manusia dengan dropdown pilihan semesta maskot otonom.

\<\!-- Struktur Dropdown Demografi Baru pada Form VSO UI \--\>  
\<div class="form-group"\>  
  \<label\>Demografi Subjek / Model:\</label\>  
  \<select name="subject\_demographic" id="subject\_demographic" onChange={handleDemographicChange}\>  
    \<optgroup label="Manusia Terpercaya (Faceless)"\>  
      \<option value="syari\_classic"\>Wanita Gamis Syar'iy (Hanya Tangan)\</option\>  
      \<option value="caucasian\_male"\>Pria Kaukasia (Hanya Tangan)\</option\>  
    \</optgroup\>  
    \<optgroup label="Semesta Maskot Otonom (Anthropomorphic Mascots)"\>  
      \<option value="mascot\_universe\_herbal"\>Semesta Herbal (Herbal Universe)\</option\>  
      \<option value="mascot\_universe\_kitchen"\>Semesta Dapur (Kitchen Universe)\</option\>  
      \<option value="mascot\_universe\_home\_living"\>Semesta Rumah (Home Living Universe)\</option\>  
      \<option value="mascot\_universe\_pet"\>Semesta Hewan (Pet Universe)\</option\>  
    \</optgroup\>  
    \<option value="custom"\>-- Tulis Custom Sendiri \--\</option\>  
  \</select\>  
\</div\>

\<\!-- Dropdown Kondisional Gaya Animasi (Hanya muncul jika memilih kategori Mascot Universe) \--\>  
\<div id="mascot\_style\_group" class="form-group hidden"\>  
  \<label\>Gaya Estetika Animasi (Mascot Art Style):\</label\>  
  \<select name="visual\_style\_preset" id="visual\_style\_preset"\>  
    \<option value="3d\_claymation\_cozy"\>3D Claymation Cozy (Shaun the Sheep Look)\</option\>  
    \<option value="kawaii\_flat\_vector"\>2D Kawaii Flat Vector (Minimalis Jepang)\</option\>  
    \<option value="ghibli\_watercolor"\>Studio Ghibli Watercolor (Cat Air Magis)\</option\>  
  \</select\>  
\</div\>

\<script\>  
  function handleDemographicChange(e) {  
    const val \= e.target.value;  
    const styleGroup \= document.getElementById('mascot\_style\_group');  
      
    // Jika user memilih opsi berawalan 'mascot\_universe\_', tampilkan pilihan gaya animasi  
    if (val.startsWith('mascot\_universe\_')) {  
      styleGroup.classList.remove('hidden');  
    } else {  
      styleGroup.classList.add('hidden');  
    }  
  }  
\</script\>

## **6\. INSTRUKSI EKSEKUSI UNTUK AI AGENT DI ANTIGRAVITY**

Kirimkan instruksi terstruktur ini agar agen Antigravity Anda mengimplementasikan pembaruan ini dengan aman:

1. **Langkah 1 (Database):** Verifikasi skema database makna.db pada lib/db.js untuk memastikan semua tabel telah sesuai.  
2. **Langkah 2 (Preset Map):** Buka berkas lib/prompts.js dan gantilah fungsi buildVisualSwapOverridePrompt beserta konstanta VSO terkait dengan spesifikasi **Bagian 4** untuk mengaktifkan sistem semesta maskot otonom.  
3. **Langkah 3 (Frontend UI):** Buka berkas form VSO di modul RE Campaign (app/re-campaigns/page.js atau di modul detilnya) dan sesuaikan struktur dropdown demografi subjek dan penampil gaya kartun kondisional sesuai desain di **Bagian 5**.

**EOF (End of Blueprint Document)**

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAZCAYAAAB3oa15AAAClElEQVR4Xu2W24vNURTHz9Q8uOQScnRuv3OrE0rDJMkDRXkV5R/w4hJRlBeexhNNKZ6YlDIeqPEml1JT5JIizOR5FCJqGDFhfNac/Tsta/b+ORNF+X1rtff3u75777V+t3MymRT/MUql0rJ8Pl+wuka5XF5itX8CURS9JXqIXuKZzQvQK8SE1RPBgoN0vcvqMcgfIUaJT8QOmxcUCoU6V/eeHE7ctHm0bcQ3xd8Q45w7SGwmtsDfy3ru0EK91guMF2UDd6DEbusRoA8RNxR/StzWHg5fL3so3qW5AP6KeKD4oUajMUfmuVxuFkMnF2A5en9rUbsINVCv1+faQgSiUeR8w3+6g1Hz4tzVHuJWzPFvoOCNMY89mreNUANoj3ybOv9ZmddqtcXCZdQeCryu1zK/GqnnnvkxPDMUf9jWo+NDQgOihxqY1LmKR30e9HNap9g1mpucPHIXYj5t/GYDVwKe01an0JNR80UdrVQqK5R3yvppwRW0J6BP2VzrFDXo87hiJ/g65W1OA88TPAti7u6cvD8rtS8RchAL9/p0X3FaZ+wPeE45vdPmYhSLxdV4zsec+UsaP+zmIwwdLXMSXAP7fHqguJYeegfQ+ny6hsl3WD98QPMgZCGd7/foH+ymTpcGhmVOA+uE/+orZCHrq9XqPMXXWj98TPMgXAMHrE5x2+2mAtHIdWtObDWej8Q7rcVwxZ4x2lJ7VlsN8Cu4yBVwwuYErrmdih+3B9HMNbSvSpp8HFhXVloL5L5bTWD3jZIeIZKXoub/kRfEiBtfE+PaxxdipivmPuNj4nPG83K53BhxWfw0tcl6BOSeZ7PZ2VYXkLsTuc+51JTxnPPXQWE9VtMgP0B8IVbZXIoUKVKk+CP4ATmi8RO1PT43AAAAAElFTkSuQmCC>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADsAAAAZCAYAAACPQVaOAAAC/ElEQVR4Xu2W24uNYRTG92hyDEUZ7dO7T7XNVkIOiYxCckX8C1JcE6WUjAslNcWFJKWMC4o7h9TUXDCSC43j9RTKqWRGZpjtt2a/77Rm9e09Q9lDfU+t9lrPet7vW+s97S+RiBFjWpHNZiupVCpteY1cLrfUcv8dnHMfsE7sLPbc5gXweaxq+aaCAo5hP8WY+R02n06nS6zaIykUu2/zcHtlrIrfY8M8q1eeh+0m/izjWfnFemxTQQEj2EXxS6XSLPxRipsd8vgdUqSKV+pYQPwOe6ziw+Vyeb74yWRyLj+tTNZy+O7xQc0GL/8oqxBiGumSRvL5/DqlqcIfCLHnhrE+rcF6Qox+C81tDXHQ6HhKYFB7sVjMWD4CLZbQcP78FAqFrOZpdEXwec8S0civ1tDMPV08/m2nzin+Kb07iJ/81vZlcM7P4Cg2JD6zt9/qBJyxOZlMZo3lNRj/MBRcqVRm8qztVgN3XDel+Muap7T1pnm77a+GeEqQJiO4HmzEXvdw33QcBSnI2zUK6vBnSrZsV9DA3dKFB8Cdt7yMc7VL6IveHVY3JTBop+UEsj1c7SYNxcuKb7I6i6ClyBOBY1xBuDB55HqjivWNVdlBKZvTQNOPZlGI/Y6Q875K6/4UrZaoh9BsHf6N97vraM55vu77OEZr0VwJMf5bJumo9wcSk9wpMqOnQ5HYdZvXYCtttpxGeE4jvt6ZhbsUxWuYfIvVE9/U8QSQ7MNOhpjGL/jC9midgCKPyKVjeY3wkWB50+xG8Se7jS3IveSWX6jiDVZPPKjjCSB5xnIC+H5f4CGK2MXvM+yV1VmgXWYLEAgnZ0vHzkwo8Vfsk+YCXK2xsY8UxbXbd7lGzTZaKb58FvjD/wLbZ/P1gHaIcXdULJ+NE4oifxfuh6LGtiSTlVPcOFzEv4bAPtc12sZ/C7x0QApxtVtSCp0RoXmKDWI3RMsEbLMaAbnXbW1t8ywvIPcAO+j9yS+ofx000Wk5DVlN7Du22uZixIgRI0aMacIvG5H3iEkGxScAAAAASUVORK5CYII=>