/**
 * Script untuk membuat 50 dummy data ContentFlow Hub untuk dummybrand01 & dummybrand02
 * Usage: node scripts/seed-dummy-contentflow.js
 */

import { getDb, upsertContentFlowItem, createBrandProfile } from '../lib/db.js';

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomDate(daysBack = 30) {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
  return date.toISOString().split('T')[0];
}

const sources = ['opc', 'strategic', 're', 'instant', 'recipe', 'bridge'];
const statuses = ['Not Published', 'Scheduled', 'Published'];
const pipelineStatuses = ['Completed'];

// Brand 1: dummybrand01 (Beauty & Skincare Niche)
const brand1Products = [
  'Serum Cokelat Glow',
  'Moisturizer Skin Barrier',
  'Sunscreen SPF 50+',
  'Cleansing Oil Rose Extract',
  'Lip Balm Tinted Cherry'
];

const brand1Titles = [
  'Kampanye Skincare Glowing Alami',
  'Banjir Promo Tanggal Kembar Skincare',
  'Edukasi Pertahanan Skin Barrier',
  'Rangkaian Rutinitas Pagi Ceria',
  'Review Pemakaian 14 Hari Rutin'
];

const brand1Hooks = [
  'Jangan skip serum ini kalau mau kulit glowing seketika! ✨',
  'Kulit kusam hilang dalam 7 hari tanpa ke klinik mahal 💖',
  'Solusi ampuh perbaiki skin barrier yang rusak & kemerahan! 🌿',
  'Sunscreen lokal terbaik anti lengket dan no whitecast! ☀️',
  'Rahasia bibir sehat lembab seharian pakai lip balm alami 💄'
];

const brand1Captions = [
  'Siapa yang masih suka bingung milih serum buat kulit sensitif? 🧐 Cobain rahasia kulit sehat pakai Serum Cokelat Glow ini guys! ✨ #skincareroutine #glowing #dummybrand01 #fyp #racuntiktok',
  'Jangan skip step ini kalau kamu mau hasil maksimal! Save dulu biar gak lupa ya 💖 #moisturizer #skincaretips #dummybrand01 #beautyhacks',
  'Spill promo spesial khusus minggu ini diskon up to 50%! Cek keranjang kuning sekarang 🛒 #promotiktok #dummybrand01 #diskonmurah',
  'Perbandingan sebelum dan sesudah 2 minggu rutin pemakaian. Hasilnya beneran sesuai ekspektasi! 😍 #transformation #dummybrand01 #honestreview'
];

// Brand 2: dummybrand02 (Healthy Food & Kitchen Niche)
const brand2Products = [
  'Minyak Zaitun Extra Virgin',
  'Madu Hutan Murni Premium',
  'Granola Superfood Crunchy',
  'Kopi Susu Gula Aren Organik',
  'Teh Hijau Detox Jasmine'
];

const brand2Titles = [
  'Kampanye Hidup Sehat & Fit',
  'Resep Simpel Sarapan Praktis 5 Menit',
  'Promo Paket Bundling Dapur Sehat',
  'Tips Diet Kenyangan Tanpa Menyiksa',
  'Edukasi Bahan Alami Bebas Pengawet'
];

const brand2Hooks = [
  'Bikin sarapan sehat cuma 5 menit, rasanya nagih banget! 🥗',
  'Madu hutan murni tanpa campuran gula, aman buat diet! 🍯',
  'Cemilan crunchy tinggi serat bikin kenyang lebih lama 🌾',
  'Cara bikin kopi gula aren rumahan serasa cafe mahal ☕',
  'Teh hijau detox alami hempas lemak perut membal! 🍵'
];

const brand2Captions = [
  'Solusi makan enak tanpa rasa bersalah! Pakai Minyak Zaitun Extra Virgin ini goreng-goreng jadi lebih sehat 🍳 #healthyfood #dummybrand02 #kulinersehat #dietsehat',
  'Madu hutan murni 100% dari lebah liar. Booster imun keluarga di musim hujan ☔ #maduasli #dummybrand02 #herbalis',
  'Granola crunchy kaya nutrisi cocok buat topping smoothie bowl kamu! 🥣 #breakfastideas #dummybrand02 #superfood',
  'Dapatkan harga khusus hari ini beli 2 gratis 1 pouch teh detox! Klik keranjang kuning sekarang 🛍️ #promodapur #dummybrand02'
];

function seedBrandData(brandName, products, titles, hooks, captions, count = 50) {
  console.log(`🌱 Generating ${count} dummy records for "${brandName}"...`);
  
  // Ensure Brand Profile exists in brand_profiles table
  try {
    const db = getDb();
    const existing = await db.prepare('SELECT id FROM brand_profiles WHERE LOWER(brand_name) = ?').get(brandName.toLowerCase());
    if (!existing) {
      await createBrandProfile({
        id: `bp_${brandName.toLowerCase()}`,
        brand_name: brandName,
        tone_of_voice: 'Kasual/Edukatif',
        visual_signature: 'Clean Aesthetic',
        color_palette: '#3b82f6, #10b981',
        brand_slogan_or_cta: 'Solusi Terbaik Untuk Gaya Hidup Anda'
      });
      console.log(`  └─ Created Brand Profile: ${brandName}`);
    }
  } catch (e) {
    console.warn(`  └─ Note: ${e.message}`);
  }

  for (let i = 1; i <= count; i++) {
    const sourceType = getRandomElement(sources);
    const title = getRandomElement(titles);
    const prod = getRandomElement(products);
    const hook = getRandomElement(hooks);
    const caption = getRandomElement(captions);
    const pipelineStatus = getRandomElement(pipelineStatuses);

    const tiktokStatus = getRandomElement(statuses);
    const fbStatus = getRandomElement(statuses);
    const igStatus = getRandomElement(statuses);

    const pDate = getRandomDate(20);
    const videoId = `${sourceType.toUpperCase()}-${brandName.toUpperCase()}-${String(i).padStart(3, '0')}`;

    const randAsset = Math.random();
    let driveLink = '';
    let nextcloudUrl = '';
    let urlAsset = '';

    if (randAsset < 0.45) {
      driveLink = `https://drive.google.com/drive/folders/${brandName}_asset_${i}`;
      urlAsset = driveLink;
    } else if (randAsset < 0.90) {
      nextcloudUrl = `http://100.78.186.123:8080/remote.php/webdav/${brandName}/${videoId}.mp4`;
      urlAsset = nextcloudUrl;
    }

    await upsertContentFlowItem({
      id: `cf_${brandName}_${String(i).padStart(3, '0')}`,
      source_type: sourceType,
      source_campaign_id: `camp_${brandName}_${i}`,
      source_item_id: `item_${brandName}_${i}`,
      account_name: brandName,
      video_id: videoId,
      campaign_title: title,
      hook: hook,
      nama_produk: prod,
      link_affiliate: `https://vt.tiktok.com/${brandName}_${i}`,
      link_produk: `https://${brandName}.id/products/${prod.toLowerCase().replace(/\s+/g, '-')}`,
      caption: caption,
      production_date: pDate,
      url_asset: urlAsset,
      drive_link: driveLink,
      nextcloud_url: nextcloudUrl,
      pipeline_status: pipelineStatus,
      tiktok_status: tiktokStatus,
      tiktok_publish_date: tiktokStatus !== 'Not Published' ? pDate : null,
      facebook_status: fbStatus,
      facebook_publish_date: fbStatus !== 'Not Published' ? pDate : null,
      instagram_status: igStatus,
      instagram_publish_date: igStatus !== 'Not Published' ? pDate : null
    });
  }
  console.log(`✅ Berhasil membuat ${count} data dummy untuk "${brandName}"!`);
}

// Clean up old 'dummybrand' data first
try {
  const db = getDb();
  await db.prepare("DELETE FROM content_flow_items WHERE account_name = 'dummybrand' OR account_name LIKE 'dummybrand%'").run();
  console.log('🧹 Cleaned up old dummybrand records from database.');
} catch (err) {
  console.error('Failed to cleanup old records:', err);
}

seedBrandData('dummybrand01', brand1Products, brand1Titles, brand1Hooks, brand1Captions, 50);
seedBrandData('dummybrand02', brand2Products, brand2Titles, brand2Hooks, brand2Captions, 50);

console.log('🚀 SEEDING COMPLETED SUCCESSFULLY!');
