import { getPgPool } from '../lib/db-pg.js';

const recipesEnrichment = {
  'Iced Almond Choco-Matcha Fusion Latte': {
    servings: '1 Porsi (Gelas 350ml)',
    prep_time_minutes: 2,
    cook_time_minutes: 3,
    difficulty: 'Mudah',
    ingredients: [
      { name: 'Nutrifarm Matcha Premium', amount: '1', unit: 'sdt (3g)', product_id: 'pe_1782440125537_336' },
      { name: 'Omura Premium Cocoa Powder', amount: '1.5', unit: 'sdm (15g)', product_id: 'pe_sync_1781148697786_850' },
      { name: 'Susu Almond Barista', amount: '150', unit: 'ml', product_id: null },
      { name: 'Air Hangat untuk Larutan', amount: '60', unit: 'ml', product_id: null },
      { name: 'Pemanis Alami (Madu/Stevia)', amount: '1', unit: 'sdt', product_id: null },
      { name: 'Es Batu Kristal', amount: '', unit: 'secukupnya', product_id: null }
    ],
    steps: [
      { index: 1, instruction: 'Larutkan 1.5 sdm Omura Premium Cocoa Powder dan 1 sdt madu dengan 30ml air hangat, tuang ke dasar gelas saji.' },
      { index: 2, instruction: 'Isi gelas dengan es batu kristal hingga penuh, lalu tuang 150ml susu almond secara perlahan membentuk layer putih di tengah.' },
      { index: 3, instruction: 'Larutkan 1 sdt Nutrifarm Matcha Premium dengan 30ml air hangat memakai frother hingga berbusa halus.' },
      { index: 4, instruction: 'Tuang larutan matcha di bagian paling atas untuk menghasilkan gradasi 3 layer velvet yang memukau dan siap disajikan!' }
    ],
    chef_tips: [
      'Tuangkan larutan matcha secara perlahan di atas punggung sendok agar layer warna tidak tercampur.',
      'Gunakan air hangat suhu 70-80°C agar aroma matcha dan cocoa terekstraksi optimal tanpa rasa gosong/pahit berlebih.'
    ],
    storyboard: [
      { index: 1, title: 'Scene 1: Hook / Pour Shot (3s)', visual: 'Extreme close-up penuangan larutan hijau matcha ke atas susu almond dengan layer cocoa di bawah.', vo: 'Stop beli latte 50 ribuan di kafe! Ini resep 3 layer almond choco-matcha terenak yang bisa kamu bikin cuma 3 menit!' },
      { index: 2, title: 'Scene 2: Melarutkan Dark Cocoa', visual: 'Aksi melarutkan Omura Premium Cocoa Powder kental dan menuangkannya ke dasar gelas.', vo: 'Pertama, larutkan Omura Premium Cocoa Powder asli tanpa pemanis buatan, aroma dark chocolate-nya harum banget!' },
      { index: 3, title: 'Scene 3: Fresh Almond & Matcha Froth', visual: 'Menuangkan susu almond dingin ke atas es, lalu mem-frothing Nutrifarm Matcha hingga velvety.', vo: 'Beri es batu, tuang almond milk, lalu tutup dengan Nutrifarm Matcha murni yang kaya antioksidan dan bikin fokus seharian.' },
      { index: 4, title: 'Scene 4: Taste Test & CTA', visual: 'Talent mengaduk minuman perlahan dengan sedotan kaca, mencicipi dengan ekspresi puas, grafis CTA keranjang.', vo: 'Perpaduan creamy, pahit manisnya pas banget! Yuk checkout kombo matcha dan cocoa murni ini di keranjang sekarang!' }
    ]
  },
  'Smoothie Diet Choco-Matcha Layer Shake': {
    servings: '1 Porsi Besar',
    prep_time_minutes: 2,
    cook_time_minutes: 3,
    difficulty: 'Sangat Mudah',
    ingredients: [
      { name: 'Nutrifarm Matcha Premium', amount: '1', unit: 'sdt', product_id: 'pe_1782440125537_336' },
      { name: 'Omura Premium Cocoa Powder', amount: '1', unit: 'sdt', product_id: 'pe_sync_1781148697786_850' },
      { name: 'SAMONO Portable Juicer Y5 Plus', amount: '1', unit: 'unit', product_id: 'pe_1780716733703' },
      { name: 'Pisang Beku (Frozen Banana)', amount: '1', unit: 'buah', product_id: null },
      { name: 'Susu Almond / Kedelai', amount: '180', unit: 'ml', product_id: null },
      { name: 'Biji Chia / Cacao Nibs', amount: '1', unit: 'sdt (opsional)', product_id: null }
    ],
    steps: [
      { index: 1, instruction: 'Untuk layer hijau: masukkan 1/2 buah pisang beku, 90ml susu almond, dan 1 sdt Nutrifarm Matcha Premium ke dalam botol SAMONO Portable Juicer Y5 Plus.' },
      { index: 2, instruction: 'Pasang mata pisau dan tekan tombol, biarkan SAMONO Juicer melumat halus selama 15 detik, lalu tuang ke gelas sebagai layer dasar.' },
      { index: 3, instruction: 'Bilas cepat botol blender, lalu masukkan sisa 1/2 buah pisang beku, 90ml susu almond, dan 1 sdt Omura Premium Cocoa Powder.' },
      { index: 4, instruction: 'Blend kembali selama 15 detik dengan SAMONO Juicer, lalu tuangkan perlahan di atas layer matcha untuk efek dua warna dua rasa.' }
    ],
    chef_tips: [
      'Gunakan pisang yang benar-benar beku agar tekstur smoothie mengental alami layaknya soft-serve ice cream tanpa perlu es batu cair.',
      'Daya putar 6 mata pisau SAMONO Juicer mampu melumat buah beku dalam hitungan detik tanpa meninggalkan serat kasar.'
    ],
    storyboard: [
      { index: 1, title: 'Scene 1: Hook / Problem (3-4s)', visual: 'Dua layer smoothie hijau dan cokelat kental dituang rapi ke dalam mason jar estetik.', vo: 'Pengen diet tapi gak tahan rasa hambar jus sayur? Kamu wajib coba Two-Tone Matcha Cocoa Shake ini, manis alami bikin kenyang!' },
      { index: 2, title: 'Scene 2: Quick Blend Matcha Layer', visual: 'Memasukkan pisang beku dan Nutrifarm Matcha ke botol SAMONO Juicer, lalu di-blend berputar cepat.', vo: 'Tinggal cemplungin pisang beku dan Nutrifarm Matcha ke SAMONO Portable Juicer Y5 Plus. 15 detik langsung lumat creamy!' },
      { index: 3, title: 'Scene 3: Quick Blend Cocoa Layer', visual: 'Melumatkan layer kedua dengan Omura Cocoa Powder, tekstur cokelat lumer tebal.', vo: 'Lanjut bikin layer cokelatnya dengan Omura Cocoa Powder murni. Blender portable SAMONO ini praktis banget dicuci dan dibawa ke mana-mana!' },
      { index: 4, title: 'Scene 4: Plating & CTA', visual: 'Taburan chia seed di atas smoothie, talent minum sambil tersenyum fresh.', vo: 'Segar, bernutrisi, dan nol gula pasir! Dapatkan paket matcha, cocoa, dan juicer SAMONO sekarang di keranjang kuning!' }
    ]
  },
  'Choco-Matcha Oat Booster Diet Shake': {
    servings: '1 Porsi Mengenyangkan',
    prep_time_minutes: 1,
    cook_time_minutes: 2,
    difficulty: 'Sangat Mudah',
    ingredients: [
      { name: 'Omura Premium Cocoa Powder', amount: '1', unit: 'sdm (10g)', product_id: 'pe_sync_1781148697786_850' },
      { name: 'Nutrifarm Matcha Premium', amount: '0.5', unit: 'sdt (2g)', product_id: 'pe_1782440125537_336' },
      { name: 'SAMONO Portable Juicer Y5 Plus', amount: '1', unit: 'unit', product_id: 'pe_1780716733703' },
      { name: 'Rolled Oat / Quick Oat', amount: '3', unit: 'sdm (30g)', product_id: null },
      { name: 'Susu Kedelai / Susu Sapi Low Fat', amount: '200', unit: 'ml', product_id: null },
      { name: 'Madu Murni', amount: '1', unit: 'sdt', product_id: null }
    ],
    steps: [
      { index: 1, instruction: 'Masukkan 3 sdm rolled oat, 1 sdm Omura Premium Cocoa Powder, dan 1/2 sdt Nutrifarm Matcha Premium langsung ke wadah botol SAMONO Juicer.' },
      { index: 2, instruction: 'Tambahkan 200ml susu kedelai dingin dan 1 sdt madu murni.' },
      { index: 3, instruction: 'Tutup rapat penutup pisau SAMONO Portable Juicer Y5 Plus, balikkan dan klik dua kali untuk memulai blending otomatis 20 detik.' },
      { index: 4, instruction: 'Ganti tutup pisau dengan tutup botol minum bawaan SAMONO, shake siap diminum langsung di tempat atau dibawa ngantor/gym!' }
    ],
    chef_tips: [
      'Bisa langsung diminum dari botol bawaan SAMONO tanpa perlu mengotori gelas lain.',
      'Matcha memberikan dorongan fokus kafein lepas lambat, sementara oat dan cocoa memberi rasa kenyang awet hingga 4 jam.'
    ],
    storyboard: [
      { index: 1, title: 'Scene 1: Hook / Rush Morning Problem (3s)', visual: 'Jam dinding berdetak cepat, talent terburu-buru mau berangkat kerja/olahraga.', vo: 'Gak sempat sarapan tapi lagi program diet? Bikin meal replacement shake ini cuma butuh 15 detik, kenyang sampai siang!' },
      { index: 2, title: 'Scene 2: One-Bottle Prep', visual: 'Memasukkan rolled oat, Omura Cocoa, dan Nutrifarm Matcha ke dalam botol juicer portabel.', vo: 'Cukup masukkan oat, Omura Cocoa murni untuk rasa cokelat mantap, dan sedikit Nutrifarm Matcha buat booster metabolisme.' },
      { index: 3, title: 'Scene 3: Instant Blending on SAMONO', visual: 'Juicer SAMONO menyala otomatis, oat dan cocoa larut menyatu halus.', vo: 'Tuang susu, klik SAMONO Juicer portabel ini. Sekali putar, serat oat langsung lembut tanpa gumpalan sama sekali!' },
      { index: 4, title: 'Scene 4: On-the-Go Drink & CTA', visual: 'Talent memasang tali lanyard juicer SAMONO dan meneguk shake di mobil/meja kerja.', vo: 'Botolnya higienis dan travel-friendly! Cek link bio untuk promo bundling hemat 3 produk ini sekarang!' }
    ]
  },
  'Avocado Choco-Matcha Slim Detox Juice': {
    servings: '1-2 Porsi',
    prep_time_minutes: 3,
    cook_time_minutes: 2,
    difficulty: 'Mudah',
    ingredients: [
      { name: 'SAMONO Portable Juicer Y5 Plus', amount: '1', unit: 'unit', product_id: 'pe_1780716733703' },
      { name: 'Nutrifarm Matcha Premium', amount: '1', unit: 'sdt', product_id: 'pe_1782440125537_336' },
      { name: 'Omura Premium Cocoa Powder', amount: '0.5', unit: 'sdt (Dusting Topping)', product_id: 'pe_sync_1781148697786_850' },
      { name: 'Alpukat Matang / Mentega', amount: '0.5', unit: 'buah (100g)', product_id: null },
      { name: 'Air Es / Air Kelapa Murni', amount: '150', unit: 'ml', product_id: null },
      { name: 'Air Perasan Lemon', amount: '0.5', unit: 'sdt (opsional)', product_id: null }
    ],
    steps: [
      { index: 1, instruction: 'Keruk 1/2 buah daging alpukat mentega, masukkan ke dalam wadah SAMONO Portable Juicer Y5 Plus.' },
      { index: 2, instruction: 'Tambahkan 1 sdt Nutrifarm Matcha Premium, 150ml air es dingin, dan beberapa tetes lemon.' },
      { index: 3, instruction: 'Kunci wadah juicer dan nyalakan SAMONO Juicer selama 15-20 detik hingga jus alpukat hijau mengilap dan bertekstur kental lembut.' },
      { index: 4, instruction: 'Tuangkan jus ke dalam gelas saji, lalu ayak 1/2 sdt Omura Premium Cocoa Powder di atasnya sebagai garnish mewah kaya antioksidan.' }
    ],
    chef_tips: [
      'Lemak baik dari alpukat bersinergi dengan antioksidan matcha (EGCG) untuk mempercepat rasa kenyang dan membakar lemak tubuh.',
      'Ayakan Omura Cocoa murni memberikan sensasi rasa seperti cokelat kafe tanpa menambah kalori gula.'
    ],
    storyboard: [
      { index: 1, title: 'Scene 1: Hook / Creamy Juice Shot (3s)', visual: 'Slow motion sendok menyendok jus alpukat super kental berwarna hijau segar dengan taburan bubuk cokelat.', vo: 'Jus alpukat kafe biasanya banjir kental manis? Yuk ganti dengan Avocado Matcha Detox ini, super creamy dan aman buat timbangan!' },
      { index: 2, title: 'Scene 2: High-Power Crushing', visual: 'Alpukat dan bubuk matcha dilumatkan di SAMONO Juicer, teksturnya seketika lembut.', vo: 'Masukkan alpukat mentega dan Nutrifarm Matcha ke SAMONO Juicer Y5 Plus. Pisau stainless-nya bikin jus lembut selembut gelato!' },
      { index: 3, title: 'Scene 3: Dusting Cocoa Powder', visual: 'Menuang jus ke gelas, lalu mengayak Omura Cocoa Powder membentuk pola estetik di permukaan.', vo: 'Tuang ke gelas, lalu beri taburan Omura Cocoa Powder murni di atasnya untuk aroma cokelat autentik yang mewah.' },
      { index: 4, title: 'Scene 4: Fresh Sip & CTA', visual: 'Talent menikmati satu tegukan penuh kenikmatan, senyum puas, grafis link pembelian.', vo: 'Rasanya nagih banget, sehat dan rendah gula! Amankan kombo resep sehat ini di keranjang sekarang ya!' }
    ]
  },
  'Banana Matcha-Choco Energy Slim Shake': {
    servings: '1 Porsi',
    prep_time_minutes: 2,
    cook_time_minutes: 3,
    difficulty: 'Sangat Mudah',
    ingredients: [
      { name: 'Nutrifarm Matcha Premium', amount: '1', unit: 'sdt (3g)', product_id: 'pe_1782440125537_336' },
      { name: 'Omura Premium Cocoa Powder', amount: '1', unit: 'sdt (5g)', product_id: 'pe_sync_1781148697786_850' },
      { name: 'SAMONO Portable Juicer Y5 Plus', amount: '1', unit: 'unit', product_id: 'pe_1780716733703' },
      { name: 'Pisang Cavendish Matang', amount: '1', unit: 'buah', product_id: null },
      { name: 'Air Kelapa Murni / Susu UHT Rendah Lemak', amount: '150', unit: 'ml', product_id: null },
      { name: 'Es Batu', amount: '3', unit: 'cube', product_id: null }
    ],
    steps: [
      { index: 1, instruction: 'Potong-potong 1 buah pisang matang, masukkan ke dalam botol blender SAMONO Portable Juicer Y5 Plus.' },
      { index: 2, instruction: 'Tambahkan 1 sdt Nutrifarm Matcha Premium dan 1 sdt Omura Premium Cocoa Powder bersama 3 cube es batu.' },
      { index: 3, instruction: 'Tuang 150ml air kelapa murni (atau susu rendah lemak) hingga batas takaran botol.' },
      { index: 4, instruction: 'Tutup rapat dan jalankan blender SAMONO selama 20 detik hingga terbentuk pusaran smoothie cokelat-matcha yang harum dan berbusa lembut.' }
    ],
    chef_tips: [
      'Gunakan pisang yang memiliki bintik hitam (sugar spots) agar tingkat manis alami maksimal tanpa memerlukan gula tambahan sama sekali.',
      'Kombinasi elektrolit air kelapa dan pisang sangat pas diminum sebelum atau sesudah olahraga (pre/post-workout drink).'
    ],
    storyboard: [
      { index: 1, title: 'Scene 1: Hook / Energy Boost Shot (3s)', visual: 'Close up pusaran smoothie matcha-choco yang berputar kencang di botol SAMONO portable juicer.', vo: 'Sering lemas dan ngantuk pas lagi diet? Coba bikin Banana Matcha-Choco Shake ini, stamina langsung on seharian!' },
      { index: 2, title: 'Scene 2: Natural Ingredients Combo', visual: 'Memasukkan potongan pisang, Nutrifarm Matcha hijau cerah, dan Omura Cocoa ke wadah juicer.', vo: 'Pakai 1 buah pisang matang, 1 sdt Nutrifarm Matcha untuk fokus alami, dan 1 sdt Omura Cocoa murni untuk antioksidan tinggi.' },
      { index: 3, title: 'Scene 3: Blend & Go Anywhere', visual: 'Menyalakan SAMONO Juicer dengan satu sentuhan tangan, smoothie berbusa tebal siap saji.', vo: 'Blender pakai SAMONO Portable Juicer Y5 Plus. Praktis tanpa kabel, bisa langsung dibawa ke kantor atau gym!' },
      { index: 4, title: 'Scene 4: Sip & Call to Action', visual: 'Talent berolahraga ringan atau tersenyum segar memegang juicer, grafis promo voucher.', vo: 'Badan lebih enteng dan bertenaga! Yuk dapatkan paket kombo 3 produk ini di keranjang sekarang!' }
    ]
  }
};

async function main() {
  const pool = getPgPool();
  try {
    const schemas = ['dev', 'staging', 'public'];
    for (const schema of schemas) {
      console.log(`\n--- Checking schema: ${schema} ---`);
      const res = await pool.query(`
        SELECT id, title, planner_id, product_reference, recipe_idea_json 
        FROM ${schema}.content_planner_rows 
        WHERE planner_id = $1
      `, ['pln_db44602b']);

      console.log(`Found ${res.rows.length} rows in ${schema}.content_planner_rows`);
      for (const row of res.rows) {
        const enrichment = recipesEnrichment[row.title];
        if (!enrichment) {
          console.warn(`No enrichment found for title: "${row.title}"`);
          continue;
        }

        const currentIdea = row.recipe_idea_json || {};
        const updatedIdea = {
          ...currentIdea,
          title: currentIdea.title || row.title,
          recipe_title: currentIdea.title || row.title,
          servings: enrichment.servings,
          estimated_servings: enrichment.servings,
          prep_time_minutes: enrichment.prep_time_minutes,
          cook_time_minutes: enrichment.cook_time_minutes,
          estimated_cooking_minutes: enrichment.cook_time_minutes,
          difficulty: enrichment.difficulty,
          ingredients: enrichment.ingredients,
          steps: enrichment.steps,
          chef_tips: enrichment.chef_tips,
          storyboard: enrichment.storyboard
        };

        await pool.query(`
          UPDATE ${schema}.content_planner_rows
          SET recipe_idea_json = $1
          WHERE id = $2
        `, [JSON.stringify(updatedIdea), row.id]);

        console.log(`Updated [${schema}] row ${row.id} (${row.title}) with ${enrichment.ingredients.length} ingredients, ${enrichment.steps.length} steps, ${enrichment.storyboard.length} scenes.`);
      }
    }
    console.log('\nAll rows enriched successfully!');
  } catch (err) {
    console.error('Error enriching rows:', err);
  } finally {
    await pool.end();
  }
}

main();
