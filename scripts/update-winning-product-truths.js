import { getDb } from '../lib/db.js';

const db = getDb();

const winningProducts = [
  {
    id: 'pe_1781998076875_150',
    product_truth: 'Official Nutrifarm Dark Chocolate Powder in an authentic clear PET plastic jar with black screw cap and clean white-green brand label',
    geometric_truth: 'Cylindrical transparent PET jar standing vertically, flat circular top cap, smooth matte label surface physics'
  },
  {
    id: 'pe_1784449324420_662',
    product_truth: 'Official Nutrifarm Organic Premium Matcha Powder in an authentic clear PET plastic jar with black screw cap and vibrant green brand label',
    geometric_truth: 'Cylindrical transparent PET jar standing vertically, flat circular top cap, vivid matcha green powder visible inside'
  },
  {
    id: 'pe_1782444787494_31',
    product_truth: 'Official Nutrifarm Psyllium Husk Powder in an authentic clear PET plastic jar with black screw cap and minimalist Nutrifarm brand label',
    geometric_truth: 'Cylindrical transparent plastic container standing vertically, smooth flat black cap, fine husk powder visible through clear walls'
  },
  {
    id: 'pe_1782440157006_614',
    product_truth: 'Official Nutrifarm Stevia Cair in an authentic clear glass liquid dropper bottle with black rubber pipette bulb cap',
    geometric_truth: 'Small cylindrical liquid dropper bottle standing vertically, narrow neck with black rubber pipette top, clear liquid physics'
  },
  {
    id: 'pe_1782444243745_260',
    product_truth: 'Official Nutrifarm Gula Aren Bubuk in an authentic clear PET plastic jar with black screw cap and brown palm sugar branding label',
    geometric_truth: 'Cylindrical clear plastic jar standing vertically, flat top cap, golden brown palm sugar powder visible inside'
  },
  {
    id: 'pe_sync_1781148697786_1',
    product_truth: 'Official Nutrifarm Extra Virgin Olive Oil in an authentic dark green bottle with black screw cap and golden olive label',
    geometric_truth: 'Tall slender olive oil bottle standing vertically, narrow neck with black cap, smooth dark bottle surface physics'
  },
  {
    id: 'pe_1781360108501_723',
    product_truth: 'Official Nutrifarm Extra Virgin Coconut Oil in an authentic clear bottle with white-green coconut branding label',
    geometric_truth: 'Tall cylindrical clear bottle standing vertically, screw cap top, crystal clear liquid coconut oil inside'
  },
  {
    id: 'pe_1782648825325_532',
    product_truth: 'Official Cocoa Powder Plain in an authentic standing matte aluminium foil pouch packaging with ziplock seal',
    geometric_truth: 'Flexible standing aluminium foil pouch, rectangular front face with sealed top border, matte foil surface physics'
  },
  {
    id: 'pe_1784449324421_312',
    product_truth: 'Official Nutrifarm Madu Hutan Murni in an authentic clear glass honey bottle with golden forest honey branding label',
    geometric_truth: 'Cylindrical clear glass bottle standing vertically, viscous amber honey visible inside, smooth glass refractions'
  },
  {
    id: 'pe_sync_1781148697787_757',
    product_truth: 'Official Nutrifarm Biji Chia Organik in an authentic clear PET plastic jar with black screw cap showing raw chia seeds inside',
    geometric_truth: 'Cylindrical transparent jar standing vertically, flat black cap, black and white chia seeds texture visible through clear plastic'
  },
  {
    id: 'pe_jit_1781322009601_915',
    product_truth: 'Official Nutrifarm Sari Lemon Murni in an authentic clear plastic bottle with yellow lemon branding label',
    geometric_truth: 'Tall cylindrical juice bottle standing vertically, narrow spout neck, natural yellow lemon juice visible inside'
  },
  {
    id: 'pe_sync_1781148697786_165',
    product_truth: 'Official Nutrifarm Jahe Merah Bubuk in an authentic clear PET plastic jar with black screw cap and ginger red branding label',
    geometric_truth: 'Cylindrical transparent plastic jar standing vertically, flat black cap, reddish ginger powder texture visible inside'
  },
  {
    id: 'pe_sync_1781148697787_117',
    product_truth: 'Official Nutrifarm Teh Bunga Telang in an authentic clear PET plastic jar showing vibrant blue dried butterfly pea flowers inside',
    geometric_truth: 'Cylindrical transparent jar standing vertically, flat black cap, deep blue dried floral petals visible through clear walls'
  },
  {
    id: 'pe_1782444508951_369',
    product_truth: 'Official Nutrifarm Teh Bunga Rosella in an authentic clear PET plastic jar showing rich red dried hibiscus flowers inside',
    geometric_truth: 'Cylindrical transparent jar standing vertically, flat black cap, deep red dried hibiscus petals visible through clear walls'
  },
  {
    id: 'pe_jit_1781329942894_306',
    product_truth: 'Official Rolled Oat Gandum Utuh Premium in an authentic clear plastic ziplock pouch with natural oat branding',
    geometric_truth: 'Flexible standing plastic pouch with ziplock top seal, whole rolled oats grain texture visible inside'
  },
  {
    id: 'pe_1781998087509_929',
    product_truth: 'Official Beorganik Peanut Butter in an authentic clear glass jar with metal screw cap and Beorganik label',
    geometric_truth: 'Stout cylindrical glass jar standing vertically, metallic lid, thick creamy peanut butter texture visible inside'
  },
  {
    id: 'pe_jit_1781333782551_124',
    product_truth: 'Official Heavenly Blush Greek Yogurt Plain in an authentic white plastic yogurt cup with blue-white Greek yogurt label',
    geometric_truth: 'Truncated conical plastic yogurt cup standing vertically, wider top rim with foil lid seal, smooth white plastic surface physics'
  }
];

console.log('🚀 Updating Product Truth & Geometric Truth for 17 winning products...');

const stmt = await db.prepare(`
  UPDATE product_extractions
  SET product_truth = ?, geometric_truth = ?
  WHERE id = ?
`);

let updatedCount = 0;
for (const p of winningProducts) {
  const res = stmt.run(p.product_truth, p.geometric_truth, p.id);
  if (res.changes > 0) {
    updatedCount++;
    console.log(`✅ [Updated ${p.id}]: product_truth & geometric_truth saved.`);
  } else {
    console.warn(`⚠️ [Not Found ${p.id}]`);
  }
}

console.log(`🎉 Successfully updated ${updatedCount}/17 winning products in product_extractions database!`);
